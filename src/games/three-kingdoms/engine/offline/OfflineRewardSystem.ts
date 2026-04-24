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
} from './offline-config';
import { getBoostItemList, useBoostItem, simulateOfflineTrade } from './OfflineTradeAndBoost';
import { zeroRes, cloneRes, addRes, mulRes } from './offline-utils';
import type { ISubsystem, ISystemDeps } from '../../core/types';

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
    const tradeSummary = this.simulateOfflineTrade(offlineSeconds, { grain: 0, gold: 10, troops: 0, mandate: 0, techPoint: 0, recruitToken: 0 });
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
  }
}
