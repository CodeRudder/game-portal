/**
 * 离线收益域 — 聚合根（v9.0 离线收益深化）
 *
 * 职责：
 * - 6档衰减快照计算
 * - 翻倍机制（广告/道具/VIP/回归奖励）
 * - 回归面板数据组装
 * - 离线加速道具管理
 * - 离线贸易行为模拟
 * - VIP离线加成
 * - 系统差异化修正系数
 * - 收益上限与资源保护
 * - 仓库扩容
 *
 * 规则：可引用 offline-config、offline.types，禁止引用其他域的 System
 *
 * @module engine/offline/OfflineRewardSystem
 */

import type { Resources } from '../../shared/types';
import type {
  DecayTier,
  OfflineSnapshot,
  TierDetail,
  DoubleRequest,
  DoubleResult,
  DoubleSource,
  ReturnPanelData,
  OfflineBoostItem,
  BoostUseResult,
  OfflineTradeEvent,
  OfflineTradeSummary,
  VipOfflineBonus,
  SystemEfficiencyModifier,
  OverflowRule,
  ResourceProtection,
  WarehouseExpansion,
  ExpansionResult,
  OfflineRewardResultV9,
  OfflineSaveData,
} from './offline.types';
import {
  DECAY_TIERS,
  MAX_OFFLINE_HOURS,
  MAX_OFFLINE_SECONDS,
  AD_DOUBLE_MULTIPLIER,
  ITEM_DOUBLE_MULTIPLIER,
  RETURN_BONUS_MULTIPLIER,
  RETURN_BONUS_MIN_HOURS,
  VIP_OFFLINE_BONUSES,
  SYSTEM_EFFICIENCY_MODIFIERS,
  OVERFLOW_RULES,
  RESOURCE_PROTECTIONS,
  DEFAULT_WAREHOUSE_EXPANSIONS,
  OFFLINE_TRADE_EFFICIENCY,
  MAX_OFFLINE_TRADES,
  OFFLINE_TRADE_DURATION,
  OFFLINE_SAVE_VERSION,
} from './offline-config';

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

/** 创建零资源对象 */
function zeroResources(): Resources {
  return { grain: 0, gold: 0, troops: 0, mandate: 0 };
}

/** 克隆资源对象 */
function cloneResources(r: Readonly<Resources>): Resources {
  return { ...r };
}

/** 叠加两个资源对象 */
function addResources(a: Resources, b: Readonly<Resources>): Resources {
  return {
    grain: a.grain + b.grain,
    gold: a.gold + b.gold,
    troops: a.troops + b.troops,
    mandate: a.mandate + b.mandate,
  };
}

/** 资源乘以标量 */
function multiplyResources(r: Readonly<Resources>, factor: number): Resources {
  return {
    grain: r.grain * factor,
    gold: r.gold * factor,
    troops: r.troops * factor,
    mandate: r.mandate * factor,
  };
}

/** 格式化离线时间 */
function formatOfflineTime(seconds: number): string {
  if (seconds <= 0) return '刚刚';
  if (seconds < 60) return `${Math.floor(seconds)}秒`;

  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    const remainHours = hours % 24;
    return remainHours > 0 ? `${days}天${remainHours}小时` : `${days}天`;
  }
  if (hours > 0) {
    const remainMinutes = minutes % 60;
    return remainMinutes > 0 ? `${hours}小时${remainMinutes}分钟` : `${hours}小时`;
  }
  return `${minutes}分钟`;
}

// ─────────────────────────────────────────────
// OfflineRewardSystem
// ─────────────────────────────────────────────

/**
 * 离线收益聚合根 — v9.0 离线收益深化
 *
 * 管理离线收益的全部计算和状态，包括：
 * - 6档衰减快照
 * - 翻倍机制
 * - VIP加成
 * - 系统修正系数
 * - 资源保护
 * - 仓库扩容
 * - 离线加速道具
 * - 离线贸易
 */
export class OfflineRewardSystem {

  // ── 状态 ──

  /** 加速道具库存 { itemId: count } */
  private boostInventory: Map<string, number> = new Map();

  /** VIP每日翻倍已用次数 */
  private vipDoubleUsedToday = 0;

  /** VIP翻倍次数重置日期（YYYY-MM-DD） */
  private vipDoubleResetDate = '';

  /** 仓库扩容等级 */
  private warehouseLevels: Map<string, number> = new Map();

  /** 离线贸易进行中事件 */
  private activeTradeEvents: OfflineTradeEvent[] = [];

  /** 上次离线时间戳 */
  private lastOfflineTime = 0;

  // ─────────────────────────────────────────────
  // 1. 6档衰减快照
  // ─────────────────────────────────────────────

  /**
   * 计算6档衰减快照
   *
   * 将离线时长按6个衰减档位分段计算收益，
   * 每档位有独立效率系数。
   *
   * @param offlineSeconds 离线秒数
   * @param productionRates 产出速率（每秒）
   * @returns 离线快照数据
   */
  calculateSnapshot(
    offlineSeconds: number,
    productionRates: Readonly<Resources>,
  ): OfflineSnapshot {
    if (offlineSeconds <= 0) {
      return {
        timestamp: Date.now(),
        offlineSeconds: 0,
        tierDetails: [],
        totalEarned: zeroResources(),
        overallEfficiency: 0,
        isCapped: false,
      };
    }

    const capped = offlineSeconds > MAX_OFFLINE_SECONDS;
    const effectiveSeconds = Math.min(offlineSeconds, MAX_OFFLINE_SECONDS);
    const effectiveHours = effectiveSeconds / 3600;

    const tierDetails: TierDetail[] = [];
    const totalEarned = zeroResources();
    let totalEffectiveSeconds = 0;

    for (const tier of DECAY_TIERS) {
      if (effectiveHours <= tier.startHours) break;

      const tierStartSec = tier.startHours * 3600;
      const tierEndSec = tier.endHours * 3600;
      const tierSeconds = Math.min(effectiveSeconds, tierEndSec) - tierStartSec;
      if (tierSeconds <= 0) continue;

      const tierEarned = zeroResources();
      for (const key of ['grain', 'gold', 'troops', 'mandate'] as const) {
        const gain = productionRates[key] * tierSeconds * tier.efficiency;
        tierEarned[key] = gain;
        totalEarned[key] += gain;
      }

      totalEffectiveSeconds += tierSeconds * tier.efficiency;

      tierDetails.push({
        tierId: tier.id,
        seconds: tierSeconds,
        efficiency: tier.efficiency,
        earned: tierEarned,
      });
    }

    const overallEfficiency = effectiveSeconds > 0
      ? totalEffectiveSeconds / effectiveSeconds
      : 0;

    return {
      timestamp: Date.now(),
      offlineSeconds,
      tierDetails,
      totalEarned,
      overallEfficiency: Math.round(overallEfficiency * 10000) / 10000,
      isCapped: capped,
    };
  }

  // ─────────────────────────────────────────────
  // 2. 翻倍机制
  // ─────────────────────────────────────────────

  /**
   * 应用翻倍
   *
   * 支持广告、道具、VIP、回归奖励四种翻倍来源。
   * 翻倍叠加到已有收益上。
   *
   * @param earned 原始收益
   * @param request 翻倍请求
   * @returns 翻倍结果
   */
  applyDouble(
    earned: Readonly<Resources>,
    request: DoubleRequest,
  ): DoubleResult {
    const multiplier = request.multiplier;

    // VIP翻倍检查每日次数
    if (request.source === 'vip') {
      const vipBonus = this.getVipBonus();
      if (this.vipDoubleUsedToday >= vipBonus.dailyDoubleLimit) {
        return {
          success: false,
          originalEarned: cloneResources(earned),
          doubledEarned: cloneResources(earned),
          appliedMultiplier: 1,
          reason: 'VIP今日翻倍次数已用完',
        };
      }
      this.vipDoubleUsedToday++;
    }

    // 回归奖励检查离线时长
    if (request.source === 'return_bonus') {
      // 回归奖励由调用方确保条件满足
    }

    const doubledEarned = multiplyResources(earned, multiplier);

    return {
      success: true,
      originalEarned: cloneResources(earned),
      doubledEarned,
      appliedMultiplier: multiplier,
    };
  }

  /**
   * 获取可用翻倍选项
   *
   * 根据离线时长和VIP等级返回可用的翻倍方式。
   */
  getAvailableDoubles(offlineSeconds: number, vipLevel: number): DoubleRequest[] {
    const doubles: DoubleRequest[] = [];

    // 广告翻倍（始终可用）
    doubles.push({
      source: 'ad',
      multiplier: AD_DOUBLE_MULTIPLIER,
      description: '观看广告翻倍收益',
    });

    // 道具翻倍（检查库存）
    const boostItems = this.getBoostItems();
    const doubleItem = boostItems.find(i => i.id === 'offline_double');
    if (doubleItem && doubleItem.count > 0) {
      doubles.push({
        source: 'item',
        multiplier: ITEM_DOUBLE_MULTIPLIER,
        description: `使用道具「${doubleItem.name}」翻倍`,
      });
    }

    // VIP翻倍
    const vipBonus = this.getVipBonus(vipLevel);
    if (vipBonus.dailyDoubleLimit > 0) {
      const remaining = vipBonus.dailyDoubleLimit - this.vipDoubleUsedToday;
      if (remaining > 0) {
        doubles.push({
          source: 'vip',
          multiplier: AD_DOUBLE_MULTIPLIER,
          description: `VIP特权翻倍（今日剩余${remaining}次）`,
        });
      }
    }

    // 回归奖励（离线>24h）
    const hours = offlineSeconds / 3600;
    if (hours >= RETURN_BONUS_MIN_HOURS) {
      doubles.push({
        source: 'return_bonus',
        multiplier: RETURN_BONUS_MULTIPLIER,
        description: '回归奖励翻倍',
      });
    }

    return doubles;
  }

  // ─────────────────────────────────────────────
  // 3. 回归面板
  // ─────────────────────────────────────────────

  /**
   * 生成回归面板数据
   *
   * 组装离线收益的全部展示信息，包括：
   * 各档位明细、总收益、翻倍选项、加速道具等。
   */
  generateReturnPanel(
    offlineSeconds: number,
    productionRates: Readonly<Resources>,
    vipLevel: number,
  ): ReturnPanelData {
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
  // 4. 离线加速道具
  // ─────────────────────────────────────────────

  /**
   * 获取所有加速道具
   */
  getBoostItems(): OfflineBoostItem[] {
    const items: OfflineBoostItem[] = [];

    const defs: Array<{ id: string; name: string; boostHours: number; desc: string }> = [
      { id: 'offline_boost_1h', name: '离线加速1小时', boostHours: 1, desc: '增加1小时离线收益' },
      { id: 'offline_boost_4h', name: '离线加速4小时', boostHours: 4, desc: '增加4小时离线收益' },
      { id: 'offline_boost_8h', name: '离线加速8小时', boostHours: 8, desc: '增加8小时离线收益' },
      { id: 'offline_double', name: '离线翻倍卡', boostHours: 0, desc: '离线收益翻倍' },
    ];

    for (const def of defs) {
      const count = this.boostInventory.get(def.id) ?? 0;
      items.push({
        id: def.id,
        name: def.name,
        boostHours: def.boostHours,
        count,
        description: def.desc,
      });
    }

    return items;
  }

  /**
   * 添加加速道具
   */
  addBoostItem(itemId: string, count: number): void {
    if (count <= 0) return;
    const current = this.boostInventory.get(itemId) ?? 0;
    this.boostInventory.set(itemId, current + count);
  }

  /**
   * 使用加速道具
   *
   * @param itemId 道具ID
   * @param productionRates 当前产出速率
   * @returns 使用结果
   */
  useBoostItem(
    itemId: string,
    productionRates: Readonly<Resources>,
  ): BoostUseResult {
    const count = this.boostInventory.get(itemId) ?? 0;
    if (count <= 0) {
      return {
        success: false,
        addedSeconds: 0,
        addedEarned: zeroResources(),
        remainingCount: 0,
        reason: '道具数量不足',
      };
    }

    // 查找道具定义
    const itemDefs: Record<string, number> = {
      'offline_boost_1h': 1,
      'offline_boost_4h': 4,
      'offline_boost_8h': 8,
    };

    const boostHours = itemDefs[itemId];
    if (boostHours === undefined) {
      return {
        success: false,
        addedSeconds: 0,
        addedEarned: zeroResources(),
        remainingCount: count,
        reason: '无效的道具ID',
      };
    }

    // 消耗道具
    this.boostInventory.set(itemId, count - 1);

    // 计算加速收益（使用100%效率，因为这是额外时间）
    const addedSeconds = boostHours * 3600;
    const addedEarned = zeroResources();
    for (const key of ['grain', 'gold', 'troops', 'mandate'] as const) {
      addedEarned[key] = productionRates[key] * addedSeconds;
    }

    return {
      success: true,
      addedSeconds,
      addedEarned,
      remainingCount: count - 1,
    };
  }

  // ─────────────────────────────────────────────
  // 5. 离线贸易行为
  // ─────────────────────────────────────────────

  /**
   * 模拟离线贸易
   *
   * 根据离线时长计算完成的贸易次数和收益。
   *
   * @param offlineSeconds 离线秒数
   * @param tradeProfitPerRun 每次贸易收益
   * @returns 离线贸易汇总
   */
  simulateOfflineTrade(
    offlineSeconds: number,
    tradeProfitPerRun: Readonly<Resources>,
  ): OfflineTradeSummary {
    if (offlineSeconds < OFFLINE_TRADE_DURATION) {
      return { completedTrades: 0, totalProfit: zeroResources(), events: [] };
    }

    // 计算可完成次数（受MAX_OFFLINE_TRADES限制）
    const maxTradesByTime = Math.floor(offlineSeconds / OFFLINE_TRADE_DURATION);
    const completedTrades = Math.min(maxTradesByTime, MAX_OFFLINE_TRADES);

    const events: OfflineTradeEvent[] = [];
    const totalProfit = zeroResources();

    for (let i = 0; i < completedTrades; i++) {
      const startTime = this.lastOfflineTime + i * OFFLINE_TRADE_DURATION;
      const completeTime = startTime + OFFLINE_TRADE_DURATION;

      const estimatedProfit = multiplyResources(
        tradeProfitPerRun,
        OFFLINE_TRADE_EFFICIENCY,
      );

      events.push({
        id: `offline_trade_${i}`,
        routeId: `auto_route_${i}`,
        startTime,
        completeTime,
        estimatedProfit,
      });

      // 累加收益
      totalProfit.grain += estimatedProfit.grain;
      totalProfit.gold += estimatedProfit.gold;
      totalProfit.troops += estimatedProfit.troops;
      totalProfit.mandate += estimatedProfit.mandate;
    }

    return { completedTrades, totalProfit, events };
  }

  // ─────────────────────────────────────────────
  // 6. VIP离线加成
  // ─────────────────────────────────────────────

  /**
   * 获取VIP离线加成配置
   *
   * @param vipLevel VIP等级（默认0）
   * @returns VIP加成配置
   */
  getVipBonus(vipLevel: number = 0): VipOfflineBonus {
    // 查找匹配的VIP等级（取不超过当前等级的最大配置）
    let matched = VIP_OFFLINE_BONUSES[0];
    for (const bonus of VIP_OFFLINE_BONUSES) {
      if (bonus.vipLevel <= vipLevel) {
        matched = bonus;
      }
    }
    return { ...matched };
  }

  /**
   * 应用VIP加成到收益
   *
   * VIP加成包括：
   * - 效率加成（直接提升收益）
   * - 额外离线时长（增加有效计算时间）
   */
  applyVipBonus(
    earned: Readonly<Resources>,
    vipLevel: number,
  ): Resources {
    const vipBonus = this.getVipBonus(vipLevel);
    if (vipBonus.efficiencyBonus <= 0) {
      return cloneResources(earned);
    }

    const bonusEarned = multiplyResources(earned, vipBonus.efficiencyBonus);
    return addResources(earned, bonusEarned);
  }

  // ─────────────────────────────────────────────
  // 7. 系统差异化修正系数
  // ─────────────────────────────────────────────

  /**
   * 获取系统修正系数
   *
   * @param systemId 系统标识
   * @returns 修正系数（0~1）
   */
  getSystemModifier(systemId: string): number {
    const mod = SYSTEM_EFFICIENCY_MODIFIERS.find(m => m.systemId === systemId);
    return mod?.modifier ?? 1.0;
  }

  /**
   * 获取所有系统修正系数
   */
  getAllSystemModifiers(): SystemEfficiencyModifier[] {
    return SYSTEM_EFFICIENCY_MODIFIERS.map(m => ({ ...m }));
  }

  /**
   * 应用系统修正系数到收益
   *
   * @param earned 原始收益
   * @param systemId 系统标识
   * @returns 修正后收益
   */
  applySystemModifier(
    earned: Readonly<Resources>,
    systemId: string,
  ): Resources {
    const modifier = this.getSystemModifier(systemId);
    return multiplyResources(earned, modifier);
  }

  // ─────────────────────────────────────────────
  // 8. 收益上限与资源保护
  // ─────────────────────────────────────────────

  /**
   * 应用收益上限
   *
   * 根据溢出规则处理超出上限的资源。
   *
   * @param earned 待应用收益
   * @param currentResources 当前资源
   * @param caps 资源上限
   * @returns 应用上限后的收益和溢出资源
   */
  applyCapAndOverflow(
    earned: Readonly<Resources>,
    currentResources: Readonly<Resources>,
    caps: Readonly<Record<string, number | null>>,
  ): { cappedEarned: Resources; overflowResources: Resources } {
    const cappedEarned = zeroResources();
    const overflowResources = zeroResources();

    for (const key of ['grain', 'gold', 'troops', 'mandate'] as const) {
      const cap = caps[key];
      const current = currentResources[key];
      const gain = earned[key];

      if (cap === null) {
        // 无上限，全部获得
        cappedEarned[key] = gain;
      } else {
        const space = Math.max(0, cap - current);
        const actual = Math.min(gain, space);
        cappedEarned[key] = actual;
        overflowResources[key] = gain - actual;
      }
    }

    return { cappedEarned, overflowResources };
  }

  /**
   * 获取资源保护量
   *
   * 计算指定资源在保护机制下不可被掠夺/消耗的数量。
   *
   * @param resourceType 资源类型
   * @param currentAmount 当前数量
   * @returns 受保护的资源数量
   */
  getResourceProtection(
    resourceType: string,
    currentAmount: number,
  ): number {
    const protection = RESOURCE_PROTECTIONS.find(
      p => p.resourceType === resourceType,
    );
    if (!protection) return 0;

    const ratioProtection = currentAmount * protection.protectionRatio;
    return Math.max(ratioProtection, protection.protectionFloor);
  }

  /**
   * 应用资源保护机制
   *
   * 计算扣除保护量后实际可被掠夺/消耗的资源数量。
   *
   * @param resourceType 资源类型
   * @param currentAmount 当前数量
   * @param requestedAmount 请求消耗数量
   * @returns 实际可消耗数量
   */
  applyResourceProtection(
    resourceType: string,
    currentAmount: number,
    requestedAmount: number,
  ): number {
    const protectedAmount = this.getResourceProtection(resourceType, currentAmount);
    const available = Math.max(0, currentAmount - protectedAmount);
    return Math.min(requestedAmount, available);
  }

  // ─────────────────────────────────────────────
  // 9. 仓库扩容
  // ─────────────────────────────────────────────

  /**
   * 获取仓库当前容量
   *
   * @param resourceType 资源类型
   * @returns 当前容量
   */
  getWarehouseCapacity(resourceType: string): number {
    const expansion = DEFAULT_WAREHOUSE_EXPANSIONS.find(
      e => e.resourceType === resourceType,
    );
    if (!expansion) return 0;

    const level = this.warehouseLevels.get(resourceType) ?? expansion.currentLevel;
    return expansion.baseCapacity + (level - 1) * expansion.perLevelIncrease;
  }

  /**
   * 升级仓库
   *
   * @param resourceType 资源类型
   * @returns 升级结果
   */
  upgradeWarehouse(resourceType: string): ExpansionResult {
    const expansion = DEFAULT_WAREHOUSE_EXPANSIONS.find(
      e => e.resourceType === resourceType,
    );
    if (!expansion) {
      return {
        success: false,
        newCapacity: 0,
        previousCapacity: 0,
        newLevel: 0,
        reason: '无效的资源类型',
      };
    }

    const currentLevel = this.warehouseLevels.get(resourceType) ?? expansion.currentLevel;
    if (currentLevel >= expansion.maxLevel) {
      return {
        success: false,
        newCapacity: this.getWarehouseCapacity(resourceType),
        previousCapacity: this.getWarehouseCapacity(resourceType),
        newLevel: currentLevel,
        reason: '已达最大等级',
      };
    }

    const previousCapacity = this.getWarehouseCapacity(resourceType);
    const newLevel = currentLevel + 1;
    this.warehouseLevels.set(resourceType, newLevel);
    const newCapacity = this.getWarehouseCapacity(resourceType);

    return {
      success: true,
      newCapacity,
      previousCapacity,
      newLevel,
    };
  }

  /**
   * 获取仓库扩容等级
   */
  getWarehouseLevel(resourceType: string): number {
    const expansion = DEFAULT_WAREHOUSE_EXPANSIONS.find(
      e => e.resourceType === resourceType,
    );
    return this.warehouseLevels.get(resourceType) ?? expansion?.currentLevel ?? 1;
  }

  // ─────────────────────────────────────────────
  // 10. 完整离线收益计算
  // ─────────────────────────────────────────────

  /**
   * 计算完整的离线收益（v9.0）
   *
   * 流程：
   * 1. 6档衰减快照计算
   * 2. VIP加成
   * 3. 系统修正系数
   * 4. 收益上限与溢出
   * 5. 离线贸易
   * 6. 回归面板组装
   *
   * @param offlineSeconds 离线秒数
   * @param productionRates 产出速率
   * @param currentResources 当前资源
   * @param caps 资源上限
   * @param vipLevel VIP等级
   * @param primarySystem 主要产出系统ID
   */
  calculateFullReward(
    offlineSeconds: number,
    productionRates: Readonly<Resources>,
    currentResources: Readonly<Resources>,
    caps: Readonly<Record<string, number | null>>,
    vipLevel: number = 0,
    primarySystem: string = 'building',
  ): OfflineRewardResultV9 {
    // 1. 快照
    const snapshot = this.calculateSnapshot(offlineSeconds, productionRates);

    // 2. VIP加成
    const vipBoostedEarned = this.applyVipBonus(snapshot.totalEarned, vipLevel);

    // 3. 系统修正
    const systemModifiedEarned = this.applySystemModifier(vipBoostedEarned, primarySystem);

    // 4. 上限与溢出
    const { cappedEarned, overflowResources } = this.applyCapAndOverflow(
      systemModifiedEarned,
      currentResources,
      caps,
    );

    // 5. 离线贸易
    const tradeSummary = this.simulateOfflineTrade(
      offlineSeconds,
      { grain: 0, gold: 10, troops: 0, mandate: 0 }, // 默认贸易收益
    );

    // 6. 回归面板
    const panelData = this.generateReturnPanel(offlineSeconds, productionRates, vipLevel);

    return {
      snapshot,
      vipBoostedEarned,
      systemModifiedEarned,
      cappedEarned,
      overflowResources,
      tradeSummary,
      panelData,
    };
  }

  // ─────────────────────────────────────────────
  // 11. 序列化
  // ─────────────────────────────────────────────

  /** 序列化为存档数据 */
  serialize(): OfflineSaveData {
    const boostItems: Record<string, number> = {};
    this.boostInventory.forEach((count, id) => {
      boostItems[id] = count;
    });

    const warehouseLevels: Record<string, number> = {};
    this.warehouseLevels.forEach((level, type) => {
      warehouseLevels[type] = level;
    });

    return {
      lastOfflineTime: this.lastOfflineTime,
      vipDoubleUsedToday: this.vipDoubleUsedToday,
      vipDoubleResetDate: this.vipDoubleResetDate,
      boostItems,
      activeTradeEvents: [...this.activeTradeEvents],
      warehouseLevels,
      version: OFFLINE_SAVE_VERSION,
    };
  }

  /** 从存档数据恢复 */
  deserialize(data: OfflineSaveData): void {
    if (data.version !== OFFLINE_SAVE_VERSION) {
      console.warn(`OfflineRewardSystem: 存档版本不匹配`);
    }

    this.lastOfflineTime = data.lastOfflineTime;
    this.vipDoubleUsedToday = data.vipDoubleUsedToday;
    this.vipDoubleResetDate = data.vipDoubleResetDate;

    this.boostInventory.clear();
    for (const [id, count] of Object.entries(data.boostItems)) {
      this.boostInventory.set(id, count);
    }

    this.activeTradeEvents = [...data.activeTradeEvents];

    this.warehouseLevels.clear();
    for (const [type, level] of Object.entries(data.warehouseLevels)) {
      this.warehouseLevels.set(type, level);
    }
  }

  // ─────────────────────────────────────────────
  // 12. 工具方法
  // ─────────────────────────────────────────────

  /** 重置VIP每日计数 */
  resetVipDailyCount(): void {
    const today = new Date().toISOString().slice(0, 10);
    if (this.vipDoubleResetDate !== today) {
      this.vipDoubleUsedToday = 0;
      this.vipDoubleResetDate = today;
    }
  }

  /** 设置上次离线时间 */
  setLastOfflineTime(timestamp: number): void {
    this.lastOfflineTime = timestamp;
  }

  /** 获取上次离线时间 */
  getLastOfflineTime(): number {
    return this.lastOfflineTime;
  }

  /** 重置为初始状态 */
  reset(): void {
    this.boostInventory.clear();
    this.vipDoubleUsedToday = 0;
    this.vipDoubleResetDate = '';
    this.warehouseLevels.clear();
    this.activeTradeEvents = [];
    this.lastOfflineTime = 0;
  }
}
