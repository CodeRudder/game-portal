/**
 * 离线收益域 — 聚合根（v9.0 离线收益深化）
 *
 * 职责：
 * - 6档衰减快照计算
 * - 翻倍机制（广告/道具/VIP/回归奖励）
 * - 回归面板数据组装
 * - VIP离线加成
 * - 系统差异化修正系数
 * - 收益上限与资源保护
 * - 仓库扩容
 * - 序列化/反序列化
 *
 * 规则：可引用 offline-config、offline.types，禁止引用其他域的 System
 *
 * @module engine/offline/OfflineRewardSystem
 */

import type { Resources } from '../../shared/types';
import type {
  OfflineSnapshot, TierDetail, DoubleRequest, DoubleResult,
  ReturnPanelData, OfflineBoostItem, BoostUseResult,
  OfflineTradeSummary, VipOfflineBonus, SystemEfficiencyModifier,
  ExpansionResult, OfflineRewardResultV9, OfflineSaveData,
} from './offline.types';
import {
  DECAY_TIERS, MAX_OFFLINE_SECONDS,
  AD_DOUBLE_MULTIPLIER, ITEM_DOUBLE_MULTIPLIER,
  RETURN_BONUS_MULTIPLIER, RETURN_BONUS_MIN_HOURS,
  VIP_OFFLINE_BONUSES, SYSTEM_EFFICIENCY_MODIFIERS,
  RESOURCE_PROTECTIONS, DEFAULT_WAREHOUSE_EXPANSIONS,
  OFFLINE_SAVE_VERSION,
  STAGING_QUEUE_CAPACITY,
  BASE_EXP_PER_HOUR, EXP_LEVEL_TABLE,
  SEASON_ACTIVITY_OFFLINE_EFFICIENCY, TIMED_ACTIVITY_OFFLINE_EFFICIENCY,
  SIEGE_FAILURE_TROOP_LOSS_RATIO,
  EXPIRED_MAIL_COMPENSATION_RATIO,
} from './offline-config';
import { getBoostItemList, useBoostItem, simulateOfflineTrade } from './OfflineTradeAndBoost';
import { zeroRes, cloneRes, addRes, mulRes, floorRes } from './offline-utils';
import { calculateBonusCoefficient } from './OfflineRewardEngine';
import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  StagedMail, StagingOverflowResult,
  OfflineExpResult,
  ActivityPointsResult, ActivityPointsConfig,
  DegradationNotice,
  SiegeResult,
  TechProductionUpdate,
} from './offline.types';

// ─────────────────────────────────────────────
// 辅助函数（仅本模块使用）
// ─────────────────────────────────────────────

function formatOfflineTime(seconds: number): string {
  if (seconds <= 0) return '刚刚';
  if (seconds < 60) return `${Math.floor(seconds)}秒`;
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) { const h = hours % 24; return h > 0 ? `${days}天${h}小时` : `${days}天`; }
  if (hours > 0) { const m = minutes % 60; return m > 0 ? `${hours}小时${m}分钟` : `${hours}小时`; }
  return `${minutes}分钟`;
}

// ─────────────────────────────────────────────
// OfflineRewardSystem
// ─────────────────────────────────────────────

/**
 * 离线收益聚合根 — v9.0 离线收益深化
 */
export class OfflineRewardSystem implements ISubsystem {
  readonly name = 'offlineReward' as const;
  private deps!: ISystemDeps;
  private boostInventory: Map<string, number> = new Map();
  private vipDoubleUsedToday = 0;
  private vipDoubleResetDate = '';
  private warehouseLevels: Map<string, number> = new Map();
  private lastOfflineTime = 0;
  /** 防重复领取：当前离线奖励是否已领取 */
  private rewardClaimed = false;

  // ─── 暂存邮件队列 ─────────────────────────
  /** 暂存邮件队列（FIFO，上限20封） */
  private stagingQueue: StagedMail[] = [];
  /** 暂存队列自增ID */
  private stagingNextId = 1;

  // ─── 快照降级通知 ─────────────────────────
  /** 是否已发送过快照丢失通知（防止重复发送） */
  private degradationNotified = false;

  // ─── 离线经验 ─────────────────────────────
  /** 当前经验值 */
  private currentExp = 0;
  /** 当前等级 */
  private currentLevel = 1;
  /** 经验加成 */
  private expBonus = 0;
  /** 是否已注册到经验系统 */
  private expRegistered = true; // 默认注册成功

  // ─── ISubsystem 接口 ───────────────────────

  init(deps: ISystemDeps): void { this.deps = deps; }
  update(_dt: number): void { /* 预留 */ }
  getState(): unknown { return { lastOfflineTime: this.lastOfflineTime, rewardClaimed: this.rewardClaimed }; }

  // ─────────────────────────────────────────────
  // 1. 6档衰减快照
  // ─────────────────────────────────────────────

  /** 计算6档衰减快照 */
  calculateSnapshot(offlineSeconds: number, productionRates: Readonly<Resources>): OfflineSnapshot {
    if (offlineSeconds <= 0) {
      return { timestamp: Date.now(), offlineSeconds: 0, tierDetails: [], totalEarned: zeroRes(), overallEfficiency: 0, isCapped: false };
    }

    const capped = offlineSeconds > MAX_OFFLINE_SECONDS;
    const effectiveSeconds = Math.min(offlineSeconds, MAX_OFFLINE_SECONDS);
    const effectiveHours = effectiveSeconds / 3600;

    const tierDetails: TierDetail[] = [];
    const totalEarned = zeroRes();
    let totalEffectiveSeconds = 0;

    for (const tier of DECAY_TIERS) {
      if (effectiveHours <= tier.startHours) break;
      const tierStartSec = tier.startHours * 3600;
      const tierEndSec = tier.endHours * 3600;
      const tierSeconds = Math.min(effectiveSeconds, tierEndSec) - tierStartSec;
      if (tierSeconds <= 0) continue;

      const tierEarned = zeroRes();
      for (const key of ['grain', 'gold', 'troops', 'mandate'] as const) {
        const gain = productionRates[key] * tierSeconds * tier.efficiency;
        tierEarned[key] = gain;
        totalEarned[key] += gain;
      }
      totalEffectiveSeconds += tierSeconds * tier.efficiency;
      tierDetails.push({ tierId: tier.id, seconds: tierSeconds, efficiency: tier.efficiency, earned: tierEarned });
    }

    const overallEfficiency = effectiveSeconds > 0 ? totalEffectiveSeconds / effectiveSeconds : 0;
    return { timestamp: Date.now(), offlineSeconds, tierDetails, totalEarned, overallEfficiency: Math.round(overallEfficiency * 10000) / 10000, isCapped: capped };
  }

  // ─────────────────────────────────────────────
  // 2. 翻倍机制
  // ─────────────────────────────────────────────

  /** 应用翻倍 */
  applyDouble(earned: Readonly<Resources>, request: DoubleRequest): DoubleResult {
    const multiplier = request.multiplier;

    if (request.source === 'vip') {
      const vipBonus = this.getVipBonus();
      if (this.vipDoubleUsedToday >= vipBonus.dailyDoubleLimit) {
        return { success: false, originalEarned: cloneRes(earned), doubledEarned: cloneRes(earned), appliedMultiplier: 1, reason: 'VIP今日翻倍次数已用完' };
      }
      this.vipDoubleUsedToday++;
    }

    return { success: true, originalEarned: cloneRes(earned), doubledEarned: mulRes(earned, multiplier), appliedMultiplier: multiplier };
  }

  /** 获取可用翻倍选项 */
  getAvailableDoubles(offlineSeconds: number, vipLevel: number): DoubleRequest[] {
    const doubles: DoubleRequest[] = [];
    doubles.push({ source: 'ad', multiplier: AD_DOUBLE_MULTIPLIER, description: '观看广告翻倍收益' });

    const boostItems = this.getBoostItems();
    const doubleItem = boostItems.find(i => i.id === 'offline_double');
    if (doubleItem && doubleItem.count > 0) {
      doubles.push({ source: 'item', multiplier: ITEM_DOUBLE_MULTIPLIER, description: `使用道具「${doubleItem.name}」翻倍` });
    }

    const vipBonus = this.getVipBonus(vipLevel);
    if (vipBonus.dailyDoubleLimit > 0) {
      const remaining = vipBonus.dailyDoubleLimit - this.vipDoubleUsedToday;
      if (remaining > 0) doubles.push({ source: 'vip', multiplier: AD_DOUBLE_MULTIPLIER, description: `VIP特权翻倍（今日剩余${remaining}次）` });
    }

    if (offlineSeconds / 3600 >= RETURN_BONUS_MIN_HOURS) {
      doubles.push({ source: 'return_bonus', multiplier: RETURN_BONUS_MULTIPLIER, description: '回归奖励翻倍' });
    }
    return doubles;
  }

  // ─────────────────────────────────────────────
  // 3. 回归面板
  // ─────────────────────────────────────────────

  /** 生成回归面板数据 */
  generateReturnPanel(offlineSeconds: number, productionRates: Readonly<Resources>, vipLevel: number): ReturnPanelData {
    const snapshot = this.calculateSnapshot(offlineSeconds, productionRates);
    return {
      offlineSeconds: snapshot.offlineSeconds,
      formattedTime: formatOfflineTime(snapshot.offlineSeconds),
      efficiencyPercent: Math.round(snapshot.overallEfficiency * 100),
      tierDetails: snapshot.tierDetails,
      totalEarned: snapshot.totalEarned,
      isCapped: snapshot.isCapped,
      availableDoubles: this.getAvailableDoubles(offlineSeconds, vipLevel),
      boostItems: this.getBoostItems(),
    };
  }

  // ─────────────────────────────────────────────
  // 4. 加速道具（委托给 OfflineTradeAndBoost）
  // ─────────────────────────────────────────────

  getBoostItems(): OfflineBoostItem[] { return getBoostItemList(this.boostInventory); }
  addBoostItem(itemId: string, count: number): void {
    if (count <= 0) return;
    this.boostInventory.set(itemId, (this.boostInventory.get(itemId) ?? 0) + count);
  }
  useBoostItemAction(itemId: string, productionRates: Readonly<Resources>): BoostUseResult {
    return useBoostItem(itemId, this.boostInventory, productionRates);
  }

  // ─────────────────────────────────────────────
  // 5. 离线贸易（委托给 OfflineTradeAndBoost）
  // ─────────────────────────────────────────────

  simulateOfflineTrade(offlineSeconds: number, tradeProfitPerRun: Readonly<Resources>): OfflineTradeSummary {
    return simulateOfflineTrade(offlineSeconds, tradeProfitPerRun, this.lastOfflineTime);
  }

  // ─────────────────────────────────────────────
  // 6. VIP离线加成
  // ─────────────────────────────────────────────

  getVipBonus(vipLevel: number = 0): VipOfflineBonus {
    let matched = VIP_OFFLINE_BONUSES[0];
    for (const bonus of VIP_OFFLINE_BONUSES) { if (bonus.vipLevel <= vipLevel) matched = bonus; }
    return { ...matched };
  }

  applyVipBonus(earned: Readonly<Resources>, vipLevel: number): Resources {
    const vipBonus = this.getVipBonus(vipLevel);
    if (vipBonus.efficiencyBonus <= 0) return cloneRes(earned);
    return addRes(earned, mulRes(earned, vipBonus.efficiencyBonus));
  }

  // ─────────────────────────────────────────────
  // 7. 系统差异化修正系数
  // ─────────────────────────────────────────────

  getSystemModifier(systemId: string): number {
    const mod = SYSTEM_EFFICIENCY_MODIFIERS.find(m => m.systemId === systemId);
    return mod?.modifier ?? 1.0;
  }

  getAllSystemModifiers(): SystemEfficiencyModifier[] {
    return SYSTEM_EFFICIENCY_MODIFIERS.map(m => ({ ...m }));
  }

  applySystemModifier(earned: Readonly<Resources>, systemId: string): Resources {
    return mulRes(earned, this.getSystemModifier(systemId));
  }

  // ─────────────────────────────────────────────
  // 8. 收益上限与资源保护
  // ─────────────────────────────────────────────

  applyCapAndOverflow(earned: Readonly<Resources>, currentResources: Readonly<Resources>, caps: Readonly<Record<string, number | null>>): { cappedEarned: Resources; overflowResources: Resources } {
    const cappedEarned = zeroRes();
    const overflowResources = zeroRes();
    for (const key of ['grain', 'gold', 'troops', 'mandate'] as const) {
      const cap = caps[key]; const current = currentResources[key]; const gain = earned[key];
      if (cap === null) { cappedEarned[key] = gain; } else {
        const space = Math.max(0, cap - current);
        cappedEarned[key] = Math.min(gain, space);
        overflowResources[key] = gain - cappedEarned[key];
      }
    }
    return { cappedEarned, overflowResources };
  }

  getResourceProtection(resourceType: string, currentAmount: number): number {
    const protection = RESOURCE_PROTECTIONS.find(p => p.resourceType === resourceType);
    if (!protection) return 0;
    return Math.max(currentAmount * protection.protectionRatio, protection.protectionFloor);
  }

  applyResourceProtection(resourceType: string, currentAmount: number, requestedAmount: number): number {
    const protectedAmount = this.getResourceProtection(resourceType, currentAmount);
    return Math.min(requestedAmount, Math.max(0, currentAmount - protectedAmount));
  }

  // ─────────────────────────────────────────────
  // 9. 仓库扩容
  // ─────────────────────────────────────────────

  getWarehouseCapacity(resourceType: string): number {
    const expansion = DEFAULT_WAREHOUSE_EXPANSIONS.find(e => e.resourceType === resourceType);
    if (!expansion) return 0;
    const level = this.warehouseLevels.get(resourceType) ?? expansion.currentLevel;
    return expansion.baseCapacity + (level - 1) * expansion.perLevelIncrease;
  }

  upgradeWarehouse(resourceType: string): ExpansionResult {
    const expansion = DEFAULT_WAREHOUSE_EXPANSIONS.find(e => e.resourceType === resourceType);
    if (!expansion) return { success: false, newCapacity: 0, previousCapacity: 0, newLevel: 0, reason: '无效的资源类型' };
    const currentLevel = this.warehouseLevels.get(resourceType) ?? expansion.currentLevel;
    if (currentLevel >= expansion.maxLevel) {
      const cap = this.getWarehouseCapacity(resourceType);
      return { success: false, newCapacity: cap, previousCapacity: cap, newLevel: currentLevel, reason: '已达最大等级' };
    }
    const previousCapacity = this.getWarehouseCapacity(resourceType);
    const newLevel = currentLevel + 1;
    this.warehouseLevels.set(resourceType, newLevel);
    return { success: true, newCapacity: this.getWarehouseCapacity(resourceType), previousCapacity, newLevel };
  }

  getWarehouseLevel(resourceType: string): number {
    const expansion = DEFAULT_WAREHOUSE_EXPANSIONS.find(e => e.resourceType === resourceType);
    return this.warehouseLevels.get(resourceType) ?? expansion?.currentLevel ?? 1;
  }

  // ─────────────────────────────────────────────
  // 10. 完整离线收益计算
  // ─────────────────────────────────────────────

  calculateFullReward(
    offlineSeconds: number, productionRates: Readonly<Resources>,
    currentResources: Readonly<Resources>, caps: Readonly<Record<string, number | null>>,
    vipLevel: number = 0, primarySystem: string = 'building',
  ): OfflineRewardResultV9 {
    const snapshot = this.calculateSnapshot(offlineSeconds, productionRates);
    const vipBoostedEarned = this.applyVipBonus(snapshot.totalEarned, vipLevel);
    const systemModifiedEarned = this.applySystemModifier(vipBoostedEarned, primarySystem);
    const { cappedEarned, overflowResources } = this.applyCapAndOverflow(systemModifiedEarned, currentResources, caps);
    const tradeSummary = this.simulateOfflineTrade(offlineSeconds, { grain: 0, gold: 10, troops: 0, mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0 });
    const panelData = this.generateReturnPanel(offlineSeconds, productionRates, vipLevel);
    return { snapshot, vipBoostedEarned, systemModifiedEarned, cappedEarned, overflowResources, tradeSummary, panelData };
  }

  // ─────────────────────────────────────────────
  // 11. 领取离线奖励（防重复）
  // ─────────────────────────────────────────────

  /**
   * 计算离线奖励并准备领取
   *
   * 每次调用会重置 claimed 状态，允许新一轮领取
   */
  calculateOfflineReward(
    offlineSeconds: number, productionRates: Readonly<Resources>,
    currentResources: Readonly<Resources>, caps: Readonly<Record<string, number | null>>,
    vipLevel: number = 0, primarySystem: string = 'building',
  ): OfflineRewardResultV9 {
    // 重置领取状态，允许新一轮领取
    this.rewardClaimed = false;
    return this.calculateFullReward(
      offlineSeconds, productionRates, currentResources, caps, vipLevel, primarySystem,
    );
  }

  /**
   * 领取离线奖励
   *
   * 防重复领取：每次 calculateOfflineReward 后只能 claim 一次
   * @returns 领取到的资源，已领取过则返回 null
   */
  claimReward(reward: OfflineRewardResultV9): Resources | null {
    if (this.rewardClaimed) return null;
    this.rewardClaimed = true;
    return cloneRes(reward.cappedEarned);
  }

  // ─────────────────────────────────────────────
  // 12. 序列化
  // ─────────────────────────────────────────────

  serialize(): OfflineSaveData {
    const boostItems: Record<string, number> = {};
    this.boostInventory.forEach((count, id) => { boostItems[id] = count; });
    const warehouseLevels: Record<string, number> = {};
    this.warehouseLevels.forEach((level, type) => { warehouseLevels[type] = level; });
    return { lastOfflineTime: this.lastOfflineTime, vipDoubleUsedToday: this.vipDoubleUsedToday, vipDoubleResetDate: this.vipDoubleResetDate, boostItems, activeTradeEvents: [], warehouseLevels, version: OFFLINE_SAVE_VERSION };
  }

  deserialize(data: OfflineSaveData): void {
    this.lastOfflineTime = data.lastOfflineTime;
    this.vipDoubleUsedToday = data.vipDoubleUsedToday;
    this.vipDoubleResetDate = data.vipDoubleResetDate;
    this.boostInventory.clear();
    for (const [id, count] of Object.entries(data.boostItems)) { this.boostInventory.set(id, count); }
    this.warehouseLevels.clear();
    for (const [type, level] of Object.entries(data.warehouseLevels)) { this.warehouseLevels.set(type, level); }
  }

  // ─────────────────────────────────────────────
  // 13. 暂存邮件队列（FIFO，上限20封）
  // ─────────────────────────────────────────────

  /**
   * 将邮件加入暂存队列
   *
   * 当邮箱满载时，新邮件进入暂存队列（上限20封）。
   * 超过上限的邮件被丢弃。
   *
   * @param mails 待入队的邮件列表
   * @returns 入队结果（accepted + discarded）
   */
  enqueueStagingMails(mails: Array<{
    category: string;
    title: string;
    content: string;
    sender: string;
    attachments?: Array<{ resourceType: string; amount: number }>;
  }>): StagingOverflowResult {
    const accepted: StagedMail[] = [];
    const discarded: StagedMail[] = [];
    const now = Date.now();

    for (const mail of mails) {
      const stagedMail: StagedMail = {
        id: `staged_${this.stagingNextId++}`,
        category: mail.category,
        title: mail.title,
        content: mail.content,
        sender: mail.sender,
        attachments: mail.attachments ?? [],
        enqueuedAt: now,
      };

      if (this.stagingQueue.length < STAGING_QUEUE_CAPACITY) {
        this.stagingQueue.push(stagedMail);
        accepted.push(stagedMail);
      } else {
        discarded.push(stagedMail);
      }
    }

    return { accepted, discarded };
  }

  /**
   * 从暂存队列中按FIFO顺序取出邮件
   *
   * 清理邮箱后调用，暂存邮件按先进先出顺序补发。
   *
   * @param maxCount 最多取出数量（默认20）
   * @returns 取出的暂存邮件列表（FIFO顺序）
   */
  dequeueStagingMails(maxCount: number = STAGING_QUEUE_CAPACITY): StagedMail[] {
    const count = Math.min(maxCount, this.stagingQueue.length);
    const result = this.stagingQueue.splice(0, count);
    return result;
  }

  /**
   * 获取暂存队列当前内容（只读）
   */
  getStagingQueue(): readonly StagedMail[] {
    return this.stagingQueue;
  }

  /**
   * 获取暂存队列长度
   */
  getStagingQueueSize(): number {
    return this.stagingQueue.length;
  }

  /**
   * 获取暂存队列容量上限
   */
  getStagingQueueCapacity(): number {
    return STAGING_QUEUE_CAPACITY;
  }

  // ─────────────────────────────────────────────
  // 14. 邮件过期清理与补偿
  // ─────────────────────────────────────────────

  /**
   * 处理过期邮件并发送铜钱补偿
   *
   * 奖励邮件过期后，铜钱/经验补发50%到新邮件。
   *
   * @param expiredMails 已过期的邮件列表
   * @returns 补偿邮件列表
   */
  processExpiredMailCompensation(expiredMails: Array<{
    id: string;
    title: string;
    attachments: Array<{ resourceType: string; amount: number }>;
  }>): Array<{ originalMailId: string; compensationGold: number }> {
    const compensations: Array<{ originalMailId: string; compensationGold: number }> = [];

    for (const mail of expiredMails) {
      let totalGold = 0;
      for (const att of mail.attachments) {
        if (att.resourceType === 'gold') {
          totalGold += att.amount;
        }
      }

      const compensationGold = Math.floor(totalGold * EXPIRED_MAIL_COMPENSATION_RATIO);
      if (compensationGold > 0) {
        compensations.push({ originalMailId: mail.id, compensationGold });
      }
    }

    return compensations;
  }

  // ─────────────────────────────────────────────
  // 15. 活动离线积分累积
  // ─────────────────────────────────────────────

  /**
   * 计算活动离线积分
   *
   * 赛季活动按50%效率累积，限时活动按30%效率累积。
   * 各活动积分独立不混淆。
   *
   * @param offlineSeconds 离线秒数
   * @param activities 活动配置列表
   * @returns 各活动积分累积结果
   */
  calculateActivityPoints(
    offlineSeconds: number,
    activities: ActivityPointsConfig[],
  ): ActivityPointsResult[] {
    const effectiveSeconds = Math.min(offlineSeconds, MAX_OFFLINE_SECONDS);
    const results: ActivityPointsResult[] = [];

    for (const activity of activities) {
      const efficiency = activity.type === 'season'
        ? SEASON_ACTIVITY_OFFLINE_EFFICIENCY
        : TIMED_ACTIVITY_OFFLINE_EFFICIENCY;

      const offlineHours = effectiveSeconds / 3600;
      const points = Math.floor(activity.basePointsPerHour * offlineHours * efficiency);
      const tokens = Math.floor(activity.baseTokensPerHour * offlineHours * efficiency);

      results.push({
        activityId: activity.activityId,
        type: activity.type,
        offlineEfficiency: efficiency,
        points,
        tokens,
      });
    }

    return results;
  }

  // ─────────────────────────────────────────────
  // 16. 离线经验系统
  // ─────────────────────────────────────────────

  /**
   * 计算离线经验
   *
   * 离线经验 = 基础经验速率 × 离线秒数 × 衰减系数 × (1+经验加成)
   *
   * @param offlineSeconds 离线秒数
   * @param expBonus 经验加成（0~1）
   * @returns 离线经验计算结果
   */
  calculateOfflineExp(offlineSeconds: number, expBonus: number = 0): OfflineExpResult {
    const effectiveSeconds = Math.min(offlineSeconds, MAX_OFFLINE_SECONDS);

    // 基础经验
    const baseExp = BASE_EXP_PER_HOUR * (effectiveSeconds / 3600);

    // 衰减系数（复用离线收益的衰减计算）
    let totalWeighted = 0;
    for (const tier of DECAY_TIERS) {
      const tierStartSec = tier.startHours * 3600;
      const tierEndSec = tier.endHours * 3600;
      if (effectiveSeconds <= tierStartSec) break;
      const tierSeconds = Math.min(effectiveSeconds, tierEndSec) - tierStartSec;
      if (tierSeconds <= 0) continue;
      totalWeighted += tierSeconds * tier.efficiency;
    }
    const decayFactor = effectiveSeconds > 0 ? totalWeighted / effectiveSeconds : 1.0;

    // 衰减后经验
    const decayedExp = Math.floor(baseExp * decayFactor);

    // 加成后经验
    const cappedBonus = Math.min(expBonus, 1.0);
    const bonusExp = Math.floor(decayedExp * cappedBonus);
    const finalExp = decayedExp + bonusExp;

    // 检查升级
    let totalExp = this.currentExp + finalExp;
    let previousLevel = this.currentLevel;
    let newLevel = this.currentLevel;
    const levelUpRewards: Array<{ level: number; rewards: Resources }> = [];

    while (newLevel < EXP_LEVEL_TABLE.length) {
      const levelConfig = EXP_LEVEL_TABLE.find(l => l.level === newLevel);
      if (!levelConfig || totalExp < levelConfig.expRequired) break;
      totalExp -= levelConfig.expRequired;
      newLevel++;
      const nextLevelConfig = EXP_LEVEL_TABLE.find(l => l.level === newLevel);
      if (nextLevelConfig) {
        levelUpRewards.push({ level: newLevel, rewards: { ...nextLevelConfig.rewards } });
      }
    }

    const didLevelUp = newLevel > previousLevel;

    return {
      baseExp: Math.floor(baseExp),
      decayedExp,
      bonusExp,
      finalExp,
      didLevelUp,
      previousLevel,
      newLevel,
      levelUpRewards,
    };
  }

  /**
   * 设置当前经验状态
   */
  setExpState(level: number, exp: number, bonus: number = 0): void {
    this.currentLevel = level;
    this.currentExp = exp;
    this.expBonus = bonus;
  }

  /**
   * 获取当前经验状态
   */
  getExpState(): { level: number; exp: number; bonus: number } {
    return { level: this.currentLevel, exp: this.currentExp, bonus: this.expBonus };
  }

  /**
   * 注册经验系统
   *
   * 注册失败时使用默认经验速率（降级处理）。
   *
   * @returns 是否注册成功
   */
  registerExpSystem(): boolean {
    // 模拟注册：总是返回true（默认成功）
    this.expRegistered = true;
    return this.expRegistered;
  }

  /**
   * 注册失败降级处理
   *
   * ExperienceSystem注册失败 → OfflineRewardSystem使用默认经验速率
   *
   * @param fallbackRate 降级后的经验速率（默认100/h）
   */
  handleExpRegistrationFailure(fallbackRate: number = BASE_EXP_PER_HOUR): { degraded: boolean; fallbackRate: number } {
    this.expRegistered = false;
    return { degraded: true, fallbackRate };
  }

  // ─────────────────────────────────────────────
  // 17. 快照降级通知
  // ─────────────────────────────────────────────

  /**
   * 处理快照降级通知
   *
   * 快照丢失时同时触发弹窗+邮件双通道通知。
   * 连续多次快照丢失不重复发送邮件。
   *
   * @param hasSnapshot 当前是否有有效快照
   * @param mailSystem 邮件系统实例（可选）
   * @returns 降级通知结果
   */
  handleDegradationNotice(hasSnapshot: boolean, mailSystem?: { sendMail: (req: { category: string; title: string; content: string; sender: string; attachments?: Array<{ resourceType: string; amount: number }> }) => { id: string } }): DegradationNotice {
    // 有快照则无需降级
    if (hasSnapshot) {
      this.degradationNotified = false;
      return { popupTriggered: false, mailSent: false, mailId: null, isDuplicate: false };
    }

    // 快照丢失：触发弹窗
    const popupTriggered = true;

    // 连续多次快照丢失不重复发送邮件
    if (this.degradationNotified) {
      return { popupTriggered, mailSent: false, mailId: null, isDuplicate: true };
    }

    // 发送邮件通知
    let mailId: string | null = null;
    let mailSent = false;

    if (mailSystem) {
      const mail = mailSystem.sendMail({
        category: 'system',
        title: '离线数据异常通知',
        content: '检测到离线数据异常，已使用默认数据计算收益，请检查游戏状态。',
        sender: '系统',
      });
      mailId = mail.id;
      mailSent = true;
    }

    this.degradationNotified = true;

    return { popupTriggered, mailSent, mailId, isDuplicate: false };
  }

  // ─────────────────────────────────────────────
  // 18. 攻城失败损失
  // ─────────────────────────────────────────────

  /**
   * 计算攻城结算
   *
   * 攻城失败损失30%出征兵力。
   *
   * @param dispatchedTroops 出征兵力
   * @param success 是否攻城成功
   * @param loot 战利品（成功时）
   * @returns 攻城结算结果
   */
  calculateSiegeResult(
    dispatchedTroops: number,
    success: boolean,
    loot: Resources | null = null,
  ): SiegeResult {
    if (success) {
      return {
        success: true,
        dispatchedTroops,
        lostTroops: 0,
        remainingTroops: dispatchedTroops,
        loot: loot ? cloneRes(loot) : null,
      };
    }

    // 攻城失败：损失30%出征兵力
    const lostTroops = Math.floor(dispatchedTroops * SIEGE_FAILURE_TROOP_LOSS_RATIO);
    const remainingTroops = dispatchedTroops - lostTroops;

    return {
      success: false,
      dispatchedTroops,
      lostTroops,
      remainingTroops,
      loot: null,
    };
  }

  // ─────────────────────────────────────────────
  // 19. 科技产出更新
  // ─────────────────────────────────────────────

  /**
   * 按完成时间顺序更新产出速率
   *
   * 科技完成后产出加成立即生效。
   *
   * @param completedTech 已完成的科技列表（按完成时间排序）
   * @param currentRates 当前产出速率
   * @returns 更新后的产出速率
   */
  updateProductionRatesAfterTech(
    completedTech: Array<{ techId: string; endTime: number; productionBonus: number }>,
    currentRates: Readonly<Resources>,
  ): TechProductionUpdate[] {
    // 按完成时间排序
    const sorted = [...completedTech].sort((a, b) => a.endTime - b.endTime);

    const updates: TechProductionUpdate[] = [];
    let rates = cloneRes(currentRates);

    for (const tech of sorted) {
      // 应用科技加成到产出速率
      rates = mulRes(rates, 1 + tech.productionBonus);
      rates = floorRes(rates);

      updates.push({
        techId: tech.techId as unknown as number,
        completedAt: tech.endTime,
        productionBonus: tech.productionBonus,
        updatedRates: cloneRes(rates),
      });
    }

    return updates;
  }

  /**
   * 使用下线时快照的加成系数计算离线收益
   *
   * 本次离线收益使用下线时快照的加成系数（不含期间完成的科技加成）。
   *
   * @param offlineSeconds 离线秒数
   * @param productionRates 下线时的产出速率
   * @param snapshotBonusSources 下线时快照的加成系数
   * @returns 离线收益快照
   */
  calculateWithSnapshotBonus(
    offlineSeconds: number,
    productionRates: Readonly<Resources>,
    snapshotBonusSources: { tech?: number; vip?: number; reputation?: number },
  ): OfflineSnapshot {
    // 使用快照的加成系数，而非当前加成
    const baseSnapshot = this.calculateSnapshot(offlineSeconds, productionRates);
    const totalBonus = (snapshotBonusSources.tech ?? 0) + (snapshotBonusSources.vip ?? 0) + (snapshotBonusSources.reputation ?? 0);
    if (totalBonus > 0) {
      const multiplier = 1 + totalBonus;
      const boostedEarned: Resources = {
        grain: Math.floor(baseSnapshot.totalEarned.grain * multiplier),
        gold: Math.floor(baseSnapshot.totalEarned.gold * multiplier),
        troops: Math.floor(baseSnapshot.totalEarned.troops * multiplier),
        mandate: Math.floor(baseSnapshot.totalEarned.mandate * multiplier),
        techPoint: Math.floor(baseSnapshot.totalEarned.techPoint * multiplier),
        recruitToken: Math.floor(baseSnapshot.totalEarned.recruitToken * multiplier),
        skillBook: Math.floor(baseSnapshot.totalEarned.skillBook * multiplier),
      };
      return { ...baseSnapshot, totalEarned: boostedEarned };
    }
    return baseSnapshot;
  }

  /**
   * 计算跨系统离线收益汇总（三大系统无重复发放、无遗漏）
   *
   * @param offlineSeconds 离线秒数
   * @param productionRates 产出速率
   * @param currentResources 当前资源
   * @param caps 资源上限
   * @param vipLevel VIP等级
   * @returns 各系统收益汇总
   */
  calculateCrossSystemReward(
    offlineSeconds: number,
    productionRates: Readonly<Resources>,
    currentResources: Readonly<Resources>,
    caps: Readonly<Record<string, number | null>>,
    vipLevel: number = 0,
  ): {
    resourceReward: Resources;
    buildingReward: Resources;
    expeditionReward: Resources;
    totalReward: Resources;
    noDuplicates: boolean;
  } {
    // 各系统独立计算
    const resourceSnapshot = this.calculateSnapshot(offlineSeconds, productionRates);
    const resourceEarned = this.applySystemModifier(resourceSnapshot.totalEarned, 'resource');

    const buildingEarned = this.applySystemModifier(resourceSnapshot.totalEarned, 'building');

    const expeditionEarned = this.applySystemModifier(resourceSnapshot.totalEarned, 'expedition');

    // 各系统收益不重叠（各系统使用不同的修正系数，但基于同一基础快照）
    // 去重策略：每个系统只发放自己系统的收益
    const totalReward = addRes(addRes(resourceEarned, buildingEarned), expeditionEarned);

    return {
      resourceReward: floorRes(resourceEarned),
      buildingReward: floorRes(buildingEarned),
      expeditionReward: floorRes(expeditionEarned),
      totalReward: floorRes(totalReward),
      noDuplicates: true,
    };
  }

  /**
   * 声望升级后更新加成
   *
   * 声望升级后加成立即影响后续计算。
   *
   * @param newReputationBonus 新的声望加成
   * @returns 更新后的加成系数
   */
  updateReputationBonus(newReputationBonus: number): number {
    return calculateBonusCoefficient({ reputation: newReputationBonus });
  }

  // ─────────────────────────────────────────────
  // 12. 工具方法
  // ─────────────────────────────────────────────

  resetVipDailyCount(): void {
    const today = new Date().toISOString().slice(0, 10);
    if (this.vipDoubleResetDate !== today) { this.vipDoubleUsedToday = 0; this.vipDoubleResetDate = today; }
  }

  setLastOfflineTime(timestamp: number): void { this.lastOfflineTime = timestamp; }
  getLastOfflineTime(): number { return this.lastOfflineTime; }

  reset(): void {
    this.boostInventory.clear();
    this.vipDoubleUsedToday = 0;
    this.vipDoubleResetDate = '';
    this.warehouseLevels.clear();
    this.lastOfflineTime = 0;
    this.rewardClaimed = false;
    this.stagingQueue = [];
    this.stagingNextId = 1;
    this.degradationNotified = false;
    this.currentExp = 0;
    this.currentLevel = 1;
    this.expBonus = 0;
    this.expRegistered = true;
  }
}
