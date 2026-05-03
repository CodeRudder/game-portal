/**
 * 资源域 — 聚合根
 *
 * 职责：资源状态管理、产出/消耗/上限编排、序列化/反序列化
 * 计算逻辑委托给 resource-calculator，配置常量来自 resource-config
 * 规则：可引用 resource-calculator、resource-config 和 resource.types，禁止引用其他域的 System
 */

import type {
  ResourceType,
  Resources,
  ResourceCap,
  ProductionRate,
  ResourceCost,
  CostCheckResult,
  CapWarning,
  Bonuses,
  OfflineEarnings,
  ResourceSaveData,
} from './resource.types';
import { RESOURCE_TYPES } from './resource.types';
import {
  INITIAL_RESOURCES,
  INITIAL_PRODUCTION_RATES,
  INITIAL_CAPS,
  MIN_GRAIN_RESERVE,
  SAVE_VERSION,
} from './resource-config';
import type { ISubsystem, ISystemDeps } from '../../core/types';
import {
  zeroResources,
  cloneResources,
  calculateBonusMultiplier,
  lookupCap,
  calculateCapWarnings,
  calculateCapWarning,
} from './resource-calculator';
import {
  calculateOfflineEarnings,
  formatOfflineTime,
  getOfflineEfficiencyPercent,
} from './OfflineEarningsCalculator';
import { gameLog } from '../../core/logger';

// ─────────────────────────────────────────────
// 辅助函数（仅本模块使用）
// ─────────────────────────────────────────────

/** 创建默认上限 */
function defaultCaps(): ResourceCap {
  return { grain: INITIAL_CAPS.grain, gold: INITIAL_CAPS.gold, ore: INITIAL_CAPS.ore, wood: INITIAL_CAPS.wood, troops: INITIAL_CAPS.troops, mandate: null, techPoint: null, recruitToken: null, skillBook: null };
}

// ─────────────────────────────────────────────
// ResourceSystem
// ─────────────────────────────────────────────

export class ResourceSystem implements ISubsystem {
  // ── ISubsystem 接口 ──
  readonly name = 'resource' as const;
  private deps: ISystemDeps | null = null;

  // ── 存储状态 ──
  private resources: Resources;
  private caps: ResourceCap;
  private productionRates: ProductionRate;

  // ── 时间戳 ──
  private lastSaveTime: number;

  constructor() {
    this.resources = cloneResources(INITIAL_RESOURCES);
    this.caps = defaultCaps();
    this.productionRates = { ...INITIAL_PRODUCTION_RATES };
    this.lastSaveTime = Date.now();
  }

  // ── ISubsystem 适配层 ──

  /** 注入依赖（事件总线、配置注册表等） */
  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  /** ISubsystem.update — 适配 tick(deltaMs)，dt 为秒 */
  update(dt: number): void {
    this.tick(dt * 1000);
  }

  /** ISubsystem.getState — 适配 serialize() */
  getState(): unknown {
    return this.serialize();
  }

  // ── 1. 资源读取 ──

  /** 获取当前所有资源数量（只读副本） */
  getResources(): Readonly<Resources> {
    return cloneResources(this.resources);
  }

  /** 获取指定资源数量 */
  getAmount(type: ResourceType): number {
    return this.resources[type];
  }

  /** 获取当前产出速率（只读副本） */
  getProductionRates(): Readonly<ProductionRate> {
    return { ...this.productionRates };
  }

  /** 获取当前资源上限（只读副本） */
  getCaps(): Readonly<ResourceCap> {
    return { ...this.caps };
  }

  // ── 2. 资源产出（主循环 tick 驱动） ──

  /** 每帧更新资源产出。@param deltaMs 毫秒 @param bonuses 加成集合（可选） */
  tick(deltaMs: number, bonuses?: Bonuses): void {
    // FIX-707: NaN deltaMs 防护
    if (!Number.isFinite(deltaMs) || deltaMs <= 0) return;

    const deltaSec = deltaMs / 1000;
    const multiplier = calculateBonusMultiplier(bonuses);

    for (const type of RESOURCE_TYPES) {
      const rate = this.productionRates[type];
      if (!Number.isFinite(rate) || rate <= 0) continue;

      const gain = rate * deltaSec * multiplier;
      // FIX-707: gain NaN 防护（multiplier 可能因 NaN bonus 变 NaN）
      if (!Number.isFinite(gain) || gain <= 0) continue;
      this.addResource(type, gain);
    }
  }

  // ── 3. 资源增减 ──

  /** 增加资源（受上限约束，自动截断）。
   *  RES-CAP-02: 当资源被截断时发出 resource:overflow 事件 */
  addResource(type: ResourceType, amount: number): number {
    // FIX-701: NaN amount 防护（NaN <= 0 = false 绕过原守卫）
    if (!Number.isFinite(amount) || amount <= 0) return 0;

    const cap = this.caps[type];
    const before = this.resources[type];
    const after = cap !== null ? Math.min(before + amount, cap) : before + amount;
    const actual = after - before;
    const overflow = amount - actual;

    this.resources[type] = after;

    // RES-CAP-02: 资源溢出时发出通知
    if (overflow > 0) {
      this.deps?.eventBus.emit('resource:overflow', {
        resourceType: type,
        requested: amount,
        actual,
        overflow,
        cap,
        current: after,
      });
    }

    return actual;
  }

  /** 消耗资源。@throws 资源不足时抛出错误 */
  consumeResource(type: ResourceType, amount: number): number {
    // FIX-702/703: NaN amount 防护
    if (!Number.isFinite(amount) || amount <= 0) return 0;

    const current = this.resources[type];

    // 粮草保护：始终保留 MIN_GRAIN_RESERVE
    if (type === 'grain') {
      const available = Math.max(0, current - MIN_GRAIN_RESERVE);
      if (available < amount) {
        throw new Error(
          `粮草不足：需要 ${amount}，可用 ${available}（保留 ${MIN_GRAIN_RESERVE}）`
        );
      }
      this.resources.grain -= amount;
      return amount;
    }

    // 通用消耗（防御 NaN / undefined：Number.isFinite 对 NaN/undefined 返回 false）
    if (!Number.isFinite(current) || current < amount) {
      throw new Error(
        `${type} 资源不足：需要 ${amount}，当前 ${current}`
      );
    }

    this.resources[type] -= amount;
    return amount;
  }

  /**
   * 直接设置资源数量（用于加载存档等场景）
   */
  setResource(type: ResourceType, amount: number): void {
    // FIX-718: NaN 防护（Math.max(0, NaN) = NaN）
    if (!Number.isFinite(amount)) amount = 0;
    amount = Math.max(0, amount);
    const cap = this.caps[type];
    this.resources[type] = cap !== null ? Math.min(amount, cap) : amount;
  }

  // ── 4. 消耗检查 ──

  /**
   * 检查是否能负担指定消耗
   */
  canAfford(cost: ResourceCost): CostCheckResult {
    const shortages: CostCheckResult['shortages'] = {};

    for (const type of RESOURCE_TYPES) {
      const required = cost[type];
      // FIX-705: NaN cost 值防护
      if (required === undefined || !Number.isFinite(required) || required <= 0) continue;

      const current = this.resources[type];
      // FIX-704: NaN 资源值防护（NaN < required = false 绕过检查）
      if (!Number.isFinite(current)) {
        shortages[type] = { required, current: 0 };
        continue;
      }
      // 粮草需要扣除保留量
      const available =
        type === 'grain'
          ? Math.max(0, current - MIN_GRAIN_RESERVE)
          : current;

      if (available < required) {
        shortages[type] = { required, current: available };
      }
    }

    return {
      canAfford: Object.keys(shortages).length === 0,
      shortages,
    };
  }

  /**
   * 批量消耗资源（原子操作：要么全部成功，要么全部失败）
   */
  consumeBatch(cost: ResourceCost): void {
    const check = this.canAfford(cost);
    if (!check.canAfford) {
      const details = Object.entries(check.shortages)
        .map(([type, info]) => `${type}: 需要 ${info!.required}，可用 ${info!.current}`)
        .join('; ');
      throw new Error(`资源不足 — ${details}`);
    }

    // 全部扣除
    for (const type of RESOURCE_TYPES) {
      const amount = cost[type];
      // FIX-706: NaN amount 防护
      if (amount !== undefined && Number.isFinite(amount) && amount > 0) {
        this.resources[type] -= amount;
      }
    }
  }

  // ── 5. 产出速率管理 ──

  /**
   * 根据建筑产出数据重新计算产出速率
   *
   * 统一使用 building-config 的 levelTable 数据源，
   * 由 BuildingSystem.calculateTotalProduction() 提供。
   *
   * @param buildingProductions 各建筑的资源产出映射 { resourceType: totalRate }
   *        来源：BuildingSystem.calculateTotalProduction()
   */
  recalculateProduction(buildingProductions: Record<string, number>): void {
    // 重置为 0
    const newRates: ProductionRate = {
      grain: 0,
      gold: 0,
      troops: 0,
      mandate: 0,
      techPoint: 0,
      recruitToken: 0,
      skillBook: 0,
      ore: 0,
      wood: 0,
    };

    // 累加各资源类型的产出值（已由 BuildingSystem 从 levelTable 查表计算）
    for (const [resourceType, rate] of Object.entries(buildingProductions)) {
      // FIX-709: NaN rate 防护
      if (!Number.isFinite(rate)) continue;
      if (resourceType in newRates) {
        newRates[resourceType as ResourceType] += rate;
      }
    }

    // 保留 recruitToken 基础被动产出（日常积累）
    newRates.recruitToken += INITIAL_PRODUCTION_RATES.recruitToken;

    this.productionRates = newRates;
  }

  /**
   * 直接设置产出速率（用于测试或特殊场景）
   */
  setProductionRate(type: ResourceType, rate: number): void {
    // FIX-709: NaN rate 防护
    this.productionRates[type] = Number.isFinite(rate) ? rate : 0;
  }

  // ── 6. 上限管理 ──

  /**
   * 更新资源上限（Sprint 1: 4种资源独立上限）
   * @param granaryLevel 粮仓等级（=农田等级）
   * @param barracksLevel 兵营等级
   * @param mineLevel 矿场等级
   * @param lumberMillLevel 伐木场等级
   */
  updateCaps(granaryLevel: number, barracksLevel: number, mineLevel?: number, lumberMillLevel?: number): void {
    this.caps.grain = lookupCap(granaryLevel, 'granary');
    this.caps.troops = lookupCap(barracksLevel, 'barracks');
    // Sprint 1 BLD-F15: 矿石/木材独立上限
    if (mineLevel !== undefined) {
      this.caps.ore = lookupCap(mineLevel, 'ore');
    }
    if (lumberMillLevel !== undefined) {
      this.caps.wood = lookupCap(lumberMillLevel, 'wood');
    }
    // gold 和 mandate 始终为 null（无上限）

    // 上限可能降低，截断溢出资源
    this.enforceCaps();
  }

  /**
   * 设置指定资源的上限
   */
  setCap(type: ResourceType, cap: number | null): void {
    // 使用类型断言绕过窄类型（gold/mandate 固定为 null）
    (this.caps as Record<ResourceType, number | null>)[type] = cap;
    this.enforceCaps();
  }

  /** 截断超出上限的资源 */
  private enforceCaps(): void {
    for (const type of RESOURCE_TYPES) {
      // FIX-R2-P1-007: NaN 资源纵深防护
      if (!Number.isFinite(this.resources[type])) {
        this.resources[type] = 0;
      }
      const cap = this.caps[type];
      if (cap !== null && this.resources[type] > cap) {
        this.resources[type] = cap;
      }
    }
  }

  // ── 7. 容量警告（委托给 resource-calculator） ──

  /**
   * 获取所有有上限资源的容量警告
   */
  getCapWarnings(): CapWarning[] {
    return calculateCapWarnings(this.resources, this.caps);
  }

  /** 获取指定资源的容量警告 */
  getCapWarning(type: ResourceType): CapWarning | null {
    return calculateCapWarning(type, this.resources, this.caps);
  }

  // ── 8. 离线收益（委托给 OfflineEarningsCalculator） ──

  /**
   * 计算离线收益
   * @param offlineSeconds 离线秒数
   * @param bonuses 加成集合
   * @returns 离线收益详情
   */
  calculateOfflineEarnings(offlineSeconds: number, bonuses?: Bonuses): OfflineEarnings {
    return calculateOfflineEarnings(offlineSeconds, this.productionRates, bonuses);
  }

  /**
   * 应用离线收益（添加到当前资源，受上限约束）
   * @returns 实际获得的资源（可能因上限截断）
   */
  applyOfflineEarnings(offlineSeconds: number, bonuses?: Bonuses): OfflineEarnings {
    const result = this.calculateOfflineEarnings(offlineSeconds, bonuses);

    // 应用各资源收益（受上限约束）
    for (const type of RESOURCE_TYPES) {
      this.addResource(type, result.earned[type]);
    }

    return result;
  }

  // ── 9. 序列化 / 反序列化 ──

  /** 序列化为存档数据 */
  serialize(): ResourceSaveData {
    // FIX-719: 序列化前修复 NaN 资源值（JSON.stringify(NaN) → null → 反序列化变 0）
    const safeResources = cloneResources(this.resources);
    for (const type of RESOURCE_TYPES) {
      if (!Number.isFinite(safeResources[type])) {
        gameLog.warn(`ResourceSystem.serialize: ${type} 值为 NaN/Infinity，已修复为 0`);
        safeResources[type] = 0;
      }
    }

    return {
      resources: safeResources,
      lastSaveTime: Date.now(),
      productionRates: { ...this.productionRates },
      caps: { ...this.caps },
      version: SAVE_VERSION,
    };
  }

  /** 从存档数据恢复 */
  deserialize(data: ResourceSaveData): void {
    // FIX-717: null/undefined 防护
    if (!data) {
      gameLog.warn('ResourceSystem.deserialize: 存档数据为空，使用默认值');
      this.reset();
      return;
    }

    // 版本检查
    if (data.version !== SAVE_VERSION) {
      gameLog.warn(
        `ResourceSystem: 存档版本不匹配 (期望 ${SAVE_VERSION}，实际 ${data.version})，尝试兼容加载`
      );
    }

    this.resources = cloneResources(data.resources);
    // 校验每个资源值：防止 NaN、负数、undefined
    for (const type of RESOURCE_TYPES) {
      const val = this.resources[type];
      this.resources[type] = Math.max(0, Number(val) || 0);
    }
    this.productionRates = { ...data.productionRates };
    this.caps = { ...data.caps };
    this.lastSaveTime = data.lastSaveTime;

    // 确保上限约束
    this.enforceCaps();
  }

  /** 获取上次保存时间戳 */
  getLastSaveTime(): number {
    return this.lastSaveTime;
  }

  /** 更新保存时间戳 */
  touchSaveTime(): void {
    this.lastSaveTime = Date.now();
  }

  // ── 10. 静态工具方法（委托给 OfflineEarningsCalculator） ──

  /**
   * 格式化离线时间为可读字符串
   *
   * 将秒数转换为人类友好的时间描述，如 "2小时30分钟"。
   * 自动选择合适的单位组合。
   *
   * @param seconds - 离线秒数
   * @returns 格式化后的时间字符串
   *
   * @example
   * ```ts
   * ResourceSystem.formatOfflineTime(90);    // "1分钟"
   * ResourceSystem.formatOfflineTime(3661);  // "1小时1分钟"
   * ResourceSystem.formatOfflineTime(90000); // "1天1小时"
   * ResourceSystem.formatOfflineTime(0);     // "刚刚"
   * ```
   */
  static formatOfflineTime(seconds: number): string {
    return formatOfflineTime(seconds);
  }

  /**
   * 获取指定离线时长的综合效率百分比
   *
   * 用于 UI 显示"当前效率"提示。
   *
   * @param offlineSeconds - 离线秒数
   * @returns 效率百分比（0~100）
   */
  static getOfflineEfficiencyPercent(offlineSeconds: number): number {
    return getOfflineEfficiencyPercent(offlineSeconds);
  }

  // ── 11. 重置 ──

  /** 重置为初始状态 */
  reset(): void {
    this.resources = cloneResources(INITIAL_RESOURCES);
    this.caps = defaultCaps();
    this.productionRates = { ...INITIAL_PRODUCTION_RATES };
    this.lastSaveTime = Date.now();
  }
}
