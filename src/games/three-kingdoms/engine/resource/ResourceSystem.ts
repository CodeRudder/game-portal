/**
 * 资源域 — 聚合根
 *
 * 职责：资源存储、产出、消耗、上限管理、离线收益、序列化/反序列化
 * 规则：可引用 resource-config 和 resource.types，禁止引用其他域的 System
 */

import type {
  ResourceType,
  Resources,
  ResourceCap,
  ProductionRate,
  ResourceCost,
  CostCheckResult,
  CapWarning,
  CapWarningLevel,
  Bonuses,
  OfflineEarnings,
  OfflineTierBreakdown,
  ResourceSaveData,
} from './resource.types';
import { RESOURCE_TYPES } from './resource.types';
import {
  INITIAL_RESOURCES,
  INITIAL_PRODUCTION_RATES,
  INITIAL_CAPS,
  BUILDING_PRODUCTION,
  CAP_WARNING_THRESHOLDS,
  OFFLINE_TIERS,
  OFFLINE_MAX_SECONDS,
  MIN_GRAIN_RESERVE,
  SAVE_VERSION,
  GRANARY_CAPACITY_TABLE,
  BARRACKS_CAPACITY_TABLE,
} from './resource-config';
import type { ISubsystem, ISystemDeps } from '../../core/types';

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

/** 创建一个全零的 Resources 对象 */
function zeroResources(): Resources {
  return { grain: 0, gold: 0, troops: 0, mandate: 0 };
}

/** 克隆 Resources */
function cloneResources(r: Resources): Resources {
  return { grain: r.grain, gold: r.gold, troops: r.troops, mandate: r.mandate };
}

/** 创建默认上限 */
function defaultCaps(): ResourceCap {
  return { grain: INITIAL_CAPS.grain, gold: null, troops: INITIAL_CAPS.troops, mandate: null };
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
    const deltaSec = deltaMs / 1000;
    const multiplier = this.calculateBonusMultiplier(bonuses);

    for (const type of RESOURCE_TYPES) {
      const rate = this.productionRates[type];
      if (rate <= 0) continue;

      const gain = rate * deltaSec * multiplier;
      this.addResource(type, gain);
    }
  }

  /**
   * 计算加成乘数：Π(1 + 各类加成)，乘法叠加
   *
   * 支持的加成类型（BonusType）：
   *   - castle  : 主城加成 — v5.0 已接入
   *   - tech    : 科技加成 — v5.1 预留（值始终为 0）
   *   - hero    : 武将加成 — v5.2 预留（值始终为 0）
   *   - rebirth : 转生加成 — v5.3 预留（值始终为 0）
   *   - vip     : VIP加成  — v5.4 预留（值始终为 0）
   *
   * 扩展方式：在 ThreeKingdomsEngine.tick() 中组装 Bonuses 对象，
   * 将对应类型的值从 0 改为实际加成百分比即可，本方法无需修改。
   */
  private calculateBonusMultiplier(bonuses?: Bonuses): number {
    if (!bonuses) return 1;
    let multiplier = 1;
    for (const value of Object.values(bonuses)) {
      if (value !== undefined) {
        multiplier *= (1 + value);
      }
    }
    return multiplier;
  }

  // ── 3. 资源增减 ──

  /** 增加资源（受上限约束，自动截断） */
  addResource(type: ResourceType, amount: number): number {
    if (amount <= 0) return 0;

    const cap = this.caps[type];
    const before = this.resources[type];
    const after = cap !== null ? Math.min(before + amount, cap) : before + amount;
    const actual = after - before;

    this.resources[type] = after;
    return actual;
  }

  /** 消耗资源。@throws 资源不足时抛出错误 */
  consumeResource(type: ResourceType, amount: number): number {
    if (amount <= 0) return 0;

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

    // 通用消耗
    if (current < amount) {
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
      if (required === undefined || required <= 0) continue;

      const current = this.resources[type];
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
      if (amount !== undefined && amount > 0) {
        this.resources[type] -= amount;
      }
    }
  }

  // ── 5. 产出速率管理 ──

  /**
   * 根据建筑等级重新计算产出速率
   * @param buildingLevels 各建筑的当前等级 { farmland: 1, market: 1, barracks: 1, ... }
   */
  recalculateProduction(buildingLevels: Record<string, number>): void {
    // 重置为 0
    const newRates: ProductionRate = {
      grain: 0,
      gold: 0,
      troops: 0,
      mandate: 0,
    };

    // 累加各建筑产出
    for (const [buildingId, level] of Object.entries(buildingLevels)) {
      const config = BUILDING_PRODUCTION[buildingId];
      if (!config || level <= 0) continue;

      newRates[config.resourceType] += config.baseRate + config.levelFactor * level;
    }

    this.productionRates = newRates;
  }

  /**
   * 直接设置产出速率（用于测试或特殊场景）
   */
  setProductionRate(type: ResourceType, rate: number): void {
    this.productionRates[type] = rate;
  }

  // ── 6. 上限管理 ──

  /**
   * 更新资源上限
   * @param granaryLevel 粮仓等级
   * @param barracksLevel 兵营等级
   */
  updateCaps(granaryLevel: number, barracksLevel: number): void {
    this.caps.grain = this.lookupCap(granaryLevel, 'granary');
    this.caps.troops = this.lookupCap(barracksLevel, 'barracks');
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

  /** 根据建筑等级查表获取上限 */
  private lookupCap(level: number, table: 'granary' | 'barracks'): number {
    const capacityTable = table === 'granary' ? GRANARY_CAPACITY_TABLE : BARRACKS_CAPACITY_TABLE;

    // 找到 <= level 的最大 key
    const keys = Object.keys(capacityTable)
      .map(Number)
      .sort((a, b) => a - b);

    let result = capacityTable[1]; // 最低等级
    for (const key of keys) {
      if (key <= level) {
        result = capacityTable[key];
      } else {
        break;
      }
    }

    // 超过最大等级时，线性外推
    const maxKey = keys[keys.length - 1];
    if (level > maxKey) {
      const lastCap = capacityTable[maxKey];
      const prevCap = capacityTable[keys[keys.length - 2]] ?? 0;
      const incrementPerLevel = (lastCap - prevCap) / (maxKey - (keys[keys.length - 2] ?? 0));
      result = lastCap + Math.floor((level - maxKey) * incrementPerLevel);
    }

    return result;
  }

  /** 截断超出上限的资源 */
  private enforceCaps(): void {
    for (const type of RESOURCE_TYPES) {
      const cap = this.caps[type];
      if (cap !== null && this.resources[type] > cap) {
        this.resources[type] = cap;
      }
    }
  }

  // ── 7. 容量警告 ──

  /**
   * 获取所有有上限资源的容量警告
   */
  getCapWarnings(): CapWarning[] {
    const warnings: CapWarning[] = [];

    for (const type of RESOURCE_TYPES) {
      const cap = this.caps[type];
      if (cap === null) continue; // 无上限资源跳过

      const current = this.resources[type];
      const percentage = current / cap;
      const level = this.getWarningLevel(percentage);

      warnings.push({ resourceType: type, level, current, cap, percentage });
    }

    return warnings;
  }

  /** 获取指定资源的容量警告 */
  getCapWarning(type: ResourceType): CapWarning | null {
    const cap = this.caps[type];
    if (cap === null) return null;

    const current = this.resources[type];
    const percentage = current / cap;
    const level = this.getWarningLevel(percentage);

    return { resourceType: type, level, current, cap, percentage };
  }

  /** 根据百分比判定警告等级 */
  private getWarningLevel(percentage: number): CapWarningLevel {
    if (percentage >= 1) return 'full';
    if (percentage >= CAP_WARNING_THRESHOLDS.urgent) return 'urgent';
    if (percentage >= CAP_WARNING_THRESHOLDS.warning) return 'warning';
    if (percentage >= CAP_WARNING_THRESHOLDS.notice) return 'notice';
    return 'safe';
  }

  // ── 8. 离线收益计算 ──

  /**
   * 计算离线收益
   * @param offlineSeconds 离线秒数
   * @param bonuses 加成集合
   * @returns 离线收益详情
   */
  calculateOfflineEarnings(offlineSeconds: number, bonuses?: Bonuses): OfflineEarnings {
    const capped = offlineSeconds > OFFLINE_MAX_SECONDS;
    const effectiveSeconds = Math.min(offlineSeconds, OFFLINE_MAX_SECONDS);
    const multiplier = this.calculateBonusMultiplier(bonuses);

    const earned: Resources = zeroResources();
    const tierBreakdown: OfflineTierBreakdown[] = [];

    for (const tier of OFFLINE_TIERS) {
      if (effectiveSeconds <= tier.startSeconds) break;

      const tierSeconds = Math.min(effectiveSeconds, tier.endSeconds) - tier.startSeconds;
      if (tierSeconds <= 0) continue;

      const tierEarned = zeroResources();
      for (const type of RESOURCE_TYPES) {
        const gain = this.productionRates[type] * tierSeconds * tier.efficiency * multiplier;
        tierEarned[type] = gain;
        earned[type] += gain;
      }

      tierBreakdown.push({ tier, seconds: tierSeconds, earned: tierEarned });
    }

    return {
      offlineSeconds,
      earned,
      isCapped: capped,
      tierBreakdown,
    };
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
    return {
      resources: cloneResources(this.resources),
      lastSaveTime: Date.now(),
      productionRates: { ...this.productionRates },
      caps: { ...this.caps },
      version: SAVE_VERSION,
    };
  }

  /** 从存档数据恢复 */
  deserialize(data: ResourceSaveData): void {
    // 版本检查
    if (data.version !== SAVE_VERSION) {
      console.warn(
        `ResourceSystem: 存档版本不匹配 (期望 ${SAVE_VERSION}，实际 ${data.version})，尝试兼容加载`
      );
    }

    this.resources = cloneResources(data.resources);
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

  // ── 10. 离线收益静态工具方法 ──

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

  /**
   * 获取指定离线时长的综合效率百分比
   *
   * 用于 UI 显示"当前效率"提示。
   *
   * @param offlineSeconds - 离线秒数
   * @returns 效率百分比（0~100）
   */
  static getOfflineEfficiencyPercent(offlineSeconds: number): number {
    if (offlineSeconds <= 0) return 100;

    const clamped = Math.min(offlineSeconds, OFFLINE_MAX_SECONDS);
    let totalEffective = 0;

    for (const tier of OFFLINE_TIERS) {
      if (clamped <= tier.startSeconds) break;
      const tierSeconds = Math.min(clamped, tier.endSeconds) - tier.startSeconds;
      if (tierSeconds <= 0) continue;
      totalEffective += tierSeconds * tier.efficiency;
    }

    return Math.round((totalEffective / clamped) * 100);
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
