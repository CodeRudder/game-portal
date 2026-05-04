/**
 * BLD-F12 自动升级系统
 *
 * 子流程：
 * - F12-01: 优先级算法 — 根据策略(经济/军事/均衡)自动选择升级目标
 * - F12-02: 资源保护 — 自动升级不消耗低于安全阈值的资源
 *
 * 规则：可引用 BuildingSystem 和 building-config，禁止引用其他域的 System
 */

import type { BuildingType, UpgradeCost } from '../../../shared/types';
import { BUILDING_TYPES, BUILDING_ZONES } from './building.types';
import { BUILDING_DEFS, BUILDING_MAX_LEVELS } from './building-config';
import type { BuildingSystem } from './BuildingSystem';
import { gameLog } from '../../core/logger';

// ── 策略定义 ──

/** 自动升级策略 */
export type AutoUpgradeStrategy = 'economy' | 'military' | 'balanced';

/** 自动升级配置 */
export interface AutoUpgradeConfig {
  /** 升级策略：经济/军事/均衡 */
  strategy: AutoUpgradeStrategy;
  /** 是否启用 */
  enabled: boolean;
  /** 资源保护百分比 (0~100)，保护X%的资源不被自动升级消耗 */
  resourceProtectionPercent: number;
  /** 排除的建筑类型（不参与自动升级） */
  excludedBuildings: BuildingType[];
  /** 自动升级停止的主城等级（达到后停止） */
  maxCastleLevel: number;
}

/** 自动升级执行结果 */
export interface AutoUpgradeResult {
  /** 是否执行了升级 */
  upgraded: BuildingType | null;
  /** 消耗的资源 */
  cost: Record<string, number>;
  /** 未升级原因（调试用） */
  reason?: string;
}

/** 自动升级系统序列化数据 */
export interface AutoUpgradeSaveData {
  version: number;
  config: AutoUpgradeConfig;
}

// ── 常量 ──

const SAVE_VERSION = 1;

/** 经济策略优先级顺序 */
const ECONOMY_PRIORITY: readonly BuildingType[] = [
  'farmland',
  'market',
  'mine',
  'lumberMill',
  'academy',
  'workshop',
  'barracks',
  'wall',
  'clinic',
  'tavern',
  'port',
  'castle',
] as const;

/** 军事策略优先级顺序 */
const MILITARY_PRIORITY: readonly BuildingType[] = [
  'barracks',
  'wall',
  'workshop',
  'academy',
  'clinic',
  'farmland',
  'market',
  'mine',
  'lumberMill',
  'tavern',
  'port',
  'castle',
] as const;

/** 资源保护检查中使用的费用字段 */
const COST_RESOURCE_FIELDS: readonly (keyof UpgradeCost)[] = [
  'grain', 'gold', 'ore', 'wood', 'troops',
] as const;

// ── 默认配置 ──

const DEFAULT_CONFIG: AutoUpgradeConfig = {
  strategy: 'balanced',
  enabled: false,
  resourceProtectionPercent: 30,
  excludedBuildings: [],
  maxCastleLevel: 30,
};

// ── AutoUpgradeSystem ──

export class AutoUpgradeSystem {
  private config: AutoUpgradeConfig;
  private buildingSystem: BuildingSystem | null = null;
  private getResources: (() => Record<string, number>) | null = null;
  private deductResources: ((cost: Record<string, number>) => void) | null = null;

  constructor() {
    this.config = { ...DEFAULT_CONFIG, excludedBuildings: [] };
  }

  // ── 依赖注入 ──

  /** 注入建筑系统引用 */
  setBuildingSystem(bs: BuildingSystem): void {
    this.buildingSystem = bs;
  }

  /**
   * 注入资源获取回调
   * @param getResources 返回当前资源数量 { grain, gold, ore, wood, troops, ... }
   */
  setResourceProvider(getResources: () => Record<string, number>): void {
    this.getResources = getResources;
  }

  /**
   * 注入资源扣除回调
   * @param deductResources 扣除指定资源
   */
  setResourceDeductor(deductResources: (cost: Record<string, number>) => void): void {
    this.deductResources = deductResources;
  }

  // ── 配置管理 ──

  /** 更新配置（合并） */
  setConfig(partial: Partial<AutoUpgradeConfig>): void {
    if (partial.strategy !== undefined) this.config.strategy = partial.strategy;
    if (partial.enabled !== undefined) this.config.enabled = partial.enabled;
    if (partial.resourceProtectionPercent !== undefined) {
      this.config.resourceProtectionPercent = Math.max(0, Math.min(100, partial.resourceProtectionPercent));
    }
    if (partial.excludedBuildings !== undefined) {
      this.config.excludedBuildings = [...partial.excludedBuildings];
    }
    if (partial.maxCastleLevel !== undefined) {
      this.config.maxCastleLevel = partial.maxCastleLevel;
    }
  }

  /** 获取当前配置（只读副本） */
  getConfig(): Readonly<AutoUpgradeConfig> {
    return { ...this.config, excludedBuildings: [...this.config.excludedBuildings] };
  }

  /** 启用自动升级 */
  enable(): void {
    this.config.enabled = true;
  }

  /** 禁用自动升级 */
  disable(): void {
    this.config.enabled = false;
  }

  /** 是否已启用 */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  // ── F12-01: 优先级算法 ──

  /**
   * 根据当前策略计算下一个自动升级目标。
   * 返回建筑类型或 null（无可升级目标）。
   */
  getNextUpgradeTarget(): BuildingType | null {
    if (!this.buildingSystem) return null;

    const bs = this.buildingSystem;

    // 检查主城等级是否达到停止阈值
    if (bs.getCastleLevel() >= this.config.maxCastleLevel) {
      return null;
    }

    // 检查升级队列是否已满
    if (bs.isQueueFull()) {
      return null;
    }

    // 获取候选建筑列表（排除指定建筑）
    const candidates = this.getCandidates();
    if (candidates.length === 0) {
      return null;
    }

    // 按策略排序并选择第一个可升级的
    const sorted = this.sortByStrategy(candidates);

    for (const type of sorted) {
      if (this.canUpgradeBuilding(type)) {
        return type;
      }
    }

    return null;
  }

  // ── F12-02: 资源保护检查 ──

  /**
   * 检查在资源保护阈值之上是否能负担指定建筑的升级费用。
   *
   * protectedAmount = currentResource × protectionPercent / 100
   * available = currentResource - protectedAmount
   * 如果 available >= 升级费用 → true
   */
  canAffordWithProtection(buildingType: BuildingType): boolean {
    if (!this.buildingSystem || !this.getResources) return false;

    const cost = this.buildingSystem.getUpgradeCost(buildingType);
    if (!cost) return false;

    const currentResources = this.getResources();
    const protectionPct = this.config.resourceProtectionPercent;

    for (const field of COST_RESOURCE_FIELDS) {
      const required = cost[field] ?? 0;
      if (required <= 0) continue;

      const current = currentResources[field] ?? 0;
      const protectedAmount = current * protectionPct / 100;
      const available = current - protectedAmount;

      if (available < required) {
        return false;
      }
    }

    return true;
  }

  // ── 执行自动升级 ──

  /**
   * 每帧调用，尝试执行一次自动升级。
   *
   * 流程：
   * 1. 检查是否启用
   * 2. 获取下一个升级目标
   * 3. 检查资源保护
   * 4. 执行升级
   *
   * @returns 升级结果
   */
  tickAutoUpgrade(): AutoUpgradeResult {
    // 1. 检查是否启用
    if (!this.config.enabled) {
      return { upgraded: null, cost: {}, reason: '自动升级未启用' };
    }

    if (!this.buildingSystem) {
      return { upgraded: null, cost: {}, reason: '建筑系统未注入' };
    }

    // 2. 获取下一个升级目标
    const target = this.getNextUpgradeTarget();
    if (!target) {
      return { upgraded: null, cost: {}, reason: '无可升级目标' };
    }

    // 3. 检查资源保护
    if (!this.canAffordWithProtection(target)) {
      return { upgraded: null, cost: {}, reason: `资源保护限制：${target} 升级费用超出可用资源` };
    }

    // 4. 执行升级
    return this.executeUpgrade(target);
  }

  // ── 序列化 ──

  serialize(): string {
    const data: AutoUpgradeSaveData = {
      version: SAVE_VERSION,
      config: {
        ...this.config,
        excludedBuildings: [...this.config.excludedBuildings],
      },
    };
    return JSON.stringify(data);
  }

  deserialize(data: string): void {
    try {
      const parsed: AutoUpgradeSaveData = JSON.parse(data);
      if (!parsed || !parsed.config) {
        gameLog.warn('AutoUpgradeSystem: deserialize 收到无效数据');
        return;
      }
      this.config = {
        strategy: parsed.config.strategy ?? DEFAULT_CONFIG.strategy,
        enabled: parsed.config.enabled ?? DEFAULT_CONFIG.enabled,
        resourceProtectionPercent: parsed.config.resourceProtectionPercent ?? DEFAULT_CONFIG.resourceProtectionPercent,
        excludedBuildings: parsed.config.excludedBuildings ?? [],
        maxCastleLevel: parsed.config.maxCastleLevel ?? DEFAULT_CONFIG.maxCastleLevel,
      };
    } catch {
      gameLog.warn('AutoUpgradeSystem: deserialize 解析失败');
    }
  }

  /** 重置为默认配置 */
  reset(): void {
    this.config = { ...DEFAULT_CONFIG, excludedBuildings: [] };
  }

  // ── 私有方法 ──

  /** 获取候选建筑列表（已解锁、未满级、未在升级中、未被排除） */
  private getCandidates(): BuildingType[] {
    if (!this.buildingSystem) return [];

    const bs = this.buildingSystem;
    const excluded = new Set(this.config.excludedBuildings);

    return BUILDING_TYPES.filter((type) => {
      // 排除指定建筑
      if (excluded.has(type)) return false;

      const state = bs.getBuilding(type);

      // 未解锁
      if (state.status === 'locked') return false;

      // 正在升级中
      if (state.status === 'upgrading') return false;

      // 已满级
      if (state.level >= BUILDING_MAX_LEVELS[type]) return false;

      return true;
    });
  }

  /**
   * 根据策略对候选建筑排序。
   * - economy: 按经济优先级顺序
   * - military: 按军事优先级顺序
   * - balanced: 按当前等级升序（最低等级优先）
   */
  private sortByStrategy(candidates: BuildingType[]): BuildingType[] {
    if (!this.buildingSystem) return candidates;

    const bs = this.buildingSystem;

    switch (this.config.strategy) {
      case 'economy':
        return this.sortByPriorityList(candidates, ECONOMY_PRIORITY);

      case 'military':
        return this.sortByPriorityList(candidates, MILITARY_PRIORITY);

      case 'balanced':
        return [...candidates].sort((a, b) => {
          const levelA = bs.getLevel(a);
          const levelB = bs.getLevel(b);
          // 等级相同则按 BUILDING_TYPES 原始顺序
          if (levelA !== levelB) return levelA - levelB;
          return BUILDING_TYPES.indexOf(a) - BUILDING_TYPES.indexOf(b);
        });

      default:
        return candidates;
    }
  }

  /** 按优先级列表排序（列表中靠前的优先） */
  private sortByPriorityList(candidates: BuildingType[], priority: readonly BuildingType[]): BuildingType[] {
    const priorityMap = new Map<BuildingType, number>();
    priority.forEach((type, index) => priorityMap.set(type, index));

    return [...candidates].sort((a, b) => {
      const pa = priorityMap.get(a) ?? priority.length;
      const pb = priorityMap.get(b) ?? priority.length;
      return pa - pb;
    });
  }

  /** 检查单个建筑是否满足升级前置条件（不含资源检查） */
  private canUpgradeBuilding(type: BuildingType): boolean {
    if (!this.buildingSystem) return false;

    const check = this.buildingSystem.checkUpgrade(type);
    return check.canUpgrade;
  }

  /** 执行升级并扣除资源 */
  private executeUpgrade(type: BuildingType): AutoUpgradeResult {
    if (!this.buildingSystem || !this.getResources) {
      return { upgraded: null, cost: {}, reason: '依赖未注入' };
    }

    const bs = this.buildingSystem;
    const currentResources = this.getResources();

    // 构造 Resources 对象给 BuildingSystem.startUpgrade
    const resourcesForUpgrade = {
      grain: currentResources.grain ?? 0,
      gold: currentResources.gold ?? 0,
      ore: currentResources.ore ?? 0,
      wood: currentResources.wood ?? 0,
      troops: currentResources.troops ?? 0,
      mandate: currentResources.mandate ?? 0,
      techPoint: currentResources.techPoint ?? 0,
      recruitToken: currentResources.recruitToken ?? 0,
      skillBook: currentResources.skillBook ?? 0,
    };

    try {
      const cost = bs.startUpgrade(type, resourcesForUpgrade);

      // 通过回调扣除资源
      const costRecord: Record<string, number> = {};
      for (const field of COST_RESOURCE_FIELDS) {
        const amount = cost[field] ?? 0;
        if (amount > 0) costRecord[field] = amount;
      }

      if (this.deductResources) {
        this.deductResources(costRecord);
      }

      gameLog.info(`AutoUpgrade: 自动升级 ${type}，消耗 ${JSON.stringify(costRecord)}`);

      return { upgraded: type, cost: costRecord };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      gameLog.warn(`AutoUpgrade: 升级 ${type} 失败 - ${msg}`);
      return { upgraded: null, cost: {}, reason: msg };
    }
  }
}
