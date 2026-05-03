/**
 * 领土产出管理系统 (MAP-F07)
 *
 * 管理领土资源产出:
 * - 基于城市等级的产出速率
 * - 建筑加成
 * - 产出队列
 * - 存储上限
 *
 * @module engine/map/ProductionSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 资源类型 */
export type ResourceType = 'gold' | 'grain' | 'troops' | 'mandate';

/** 产出配置 */
export interface ProductionConfig {
  /** 基础产出速率(每秒) */
  baseRate: number;
  /** 等级倍率(每级+20%) */
  levelMultiplier: number;
  /** 存储上限 */
  storageCapacity: number;
}

/** 领土产出数据 */
export interface TerritoryProduction {
  /** 领土ID */
  territoryId: string;
  /** 城市等级 */
  level: number;
  /** 当前资源量 */
  resources: Record<ResourceType, number>;
  /** 建筑加成 */
  buildingBonuses: Record<string, number>;
  /** 最后更新时间 */
  lastUpdateTime: number;
}

/** 产出系统状态 */
export interface ProductionState {
  territories: TerritoryProduction[];
  globalMultiplier: number;
}

/** 存档数据 */
export interface ProductionSaveData {
  territories: TerritoryProduction[];
  globalMultiplier: number;
  version: number;
}

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 默认产出配置 */
const DEFAULT_PRODUCTION: Record<ResourceType, ProductionConfig> = {
  gold: { baseRate: 0.5, levelMultiplier: 0.2, storageCapacity: 10000 },
  grain: { baseRate: 0.3, levelMultiplier: 0.2, storageCapacity: 8000 },
  troops: { baseRate: 0.1, levelMultiplier: 0.15, storageCapacity: 5000 },
  mandate: { baseRate: 0.05, levelMultiplier: 0.1, storageCapacity: 1000 },
};

/** 存档版本 */
const SAVE_VERSION = 1;

// ─────────────────────────────────────────────
// ProductionSystem
// ─────────────────────────────────────────────

/**
 * 领土产出管理系统
 */
export class ProductionSystem implements ISubsystem {
  readonly name = 'production';

  private deps!: ISystemDeps;
  private territories: Map<string, TerritoryProduction> = new Map();
  private globalMultiplier = 1;

  // ── ISubsystem 接口 ──────────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
    this.territories.clear();
    this.globalMultiplier = 1;
  }

  update(dt: number): void {
    // 每帧更新产出(累积到资源池)
    for (const [id, territory] of this.territories) {
      this.updateTerritoryProduction(territory, dt);
    }
  }

  getState(): ProductionState {
    return {
      territories: Array.from(this.territories.values()),
      globalMultiplier: this.globalMultiplier,
    };
  }

  reset(): void {
    this.territories.clear();
    this.globalMultiplier = 1;
  }

  // ── 领土管理 ─────────────────────────────────

  /**
   * 注册领土
   */
  registerTerritory(territoryId: string, level: number): void {
    const territory: TerritoryProduction = {
      territoryId,
      level,
      resources: { gold: 0, grain: 0, troops: 0, mandate: 0 },
      buildingBonuses: {},
      lastUpdateTime: Date.now(),
    };
    this.territories.set(territoryId, territory);
  }

  /**
   * 移除领土
   */
  unregisterTerritory(territoryId: string): void {
    this.territories.delete(territoryId);
  }

  /**
   * 更新领土等级
   */
  updateLevel(territoryId: string, level: number): void {
    const territory = this.territories.get(territoryId);
    if (territory) {
      territory.level = level;
    }
  }

  /**
   * 设置建筑加成
   */
  setBuildingBonus(territoryId: string, buildingId: string, bonus: number): void {
    const territory = this.territories.get(territoryId);
    if (territory) {
      territory.buildingBonuses[buildingId] = bonus;
    }
  }

  /**
   * 移除建筑加成
   */
  removeBuildingBonus(territoryId: string, buildingId: string): void {
    const territory = this.territories.get(territoryId);
    if (territory) {
      delete territory.buildingBonuses[buildingId];
    }
  }

  // ── 资源操作 ─────────────────────────────────

  /**
   * 获取领土资源
   */
  getResources(territoryId: string): Record<ResourceType, number> | null {
    const territory = this.territories.get(territoryId);
    return territory ? { ...territory.resources } : null;
  }

  /**
   * 消耗资源
   */
  consumeResources(territoryId: string, costs: Partial<Record<ResourceType, number>>): boolean {
    const territory = this.territories.get(territoryId);
    if (!territory) return false;

    // 检查是否足够
    for (const [resource, amount] of Object.entries(costs)) {
      if ((territory.resources[resource as ResourceType] || 0) < (amount || 0)) {
        return false;
      }
    }

    // 扣除
    for (const [resource, amount] of Object.entries(costs)) {
      territory.resources[resource as ResourceType] -= amount || 0;
    }

    return true;
  }

  /**
   * 添加资源
   */
  addResources(territoryId: string, amounts: Partial<Record<ResourceType, number>>): void {
    const territory = this.territories.get(territoryId);
    if (!territory) return;

    for (const [resource, amount] of Object.entries(amounts)) {
      const key = resource as ResourceType;
      const config = DEFAULT_PRODUCTION[key];
      const maxCapacity = config.storageCapacity * (1 + (territory.level - 1) * 0.1);
      territory.resources[key] = Math.min(
        maxCapacity,
        (territory.resources[key] || 0) + (amount || 0),
      );
    }
  }

  /**
   * 设置全局产出倍率
   */
  setGlobalMultiplier(multiplier: number): void {
    this.globalMultiplier = Math.max(0.1, Math.min(5, multiplier));
  }

  /**
   * 获取产出速率(每秒)
   */
  getProductionRate(territoryId: string): Record<ResourceType, number> | null {
    const territory = this.territories.get(territoryId);
    if (!territory) return null;

    const rates: Record<string, number> = {};
    for (const [resource, config] of Object.entries(DEFAULT_PRODUCTION)) {
      const levelBonus = 1 + (territory.level - 1) * config.levelMultiplier;
      const buildingBonus = this.calculateBuildingBonus(territory);
      rates[resource] = config.baseRate * levelBonus * buildingBonus * this.globalMultiplier;
    }

    return rates as Record<ResourceType, number>;
  }

  /**
   * 快速产出(离线补偿)
   */
  quickProduce(territoryId: string, seconds: number): Record<ResourceType, number> {
    const territory = this.territories.get(territoryId);
    if (!territory) return { gold: 0, grain: 0, troops: 0, mandate: 0 };

    const rates = this.getProductionRate(territoryId);
    if (!rates) return { gold: 0, grain: 0, troops: 0, mandate: 0 };

    const produced: Record<string, number> = {};
    for (const [resource, rate] of Object.entries(rates)) {
      const amount = Math.floor(rate * seconds);
      produced[resource] = amount;
      this.addResources(territoryId, { [resource]: amount });
    }

    return produced as Record<ResourceType, number>;
  }

  // ── 内部方法 ─────────────────────────────────

  private updateTerritoryProduction(territory: TerritoryProduction, dt: number): void {
    for (const [resource, config] of Object.entries(DEFAULT_PRODUCTION)) {
      const key = resource as ResourceType;
      const levelBonus = 1 + (territory.level - 1) * config.levelMultiplier;
      const buildingBonus = this.calculateBuildingBonus(territory);
      const produced = config.baseRate * levelBonus * buildingBonus * this.globalMultiplier * dt;

      const maxCapacity = config.storageCapacity * (1 + (territory.level - 1) * 0.1);
      territory.resources[key] = Math.min(
        maxCapacity,
        territory.resources[key] + produced,
      );
    }
  }

  private calculateBuildingBonus(territory: TerritoryProduction): number {
    let bonus = 1;
    for (const b of Object.values(territory.buildingBonuses)) {
      bonus += b;
    }
    return bonus;
  }

  // ── 序列化 ───────────────────────────────────

  serialize(): ProductionSaveData {
    return {
      territories: Array.from(this.territories.values()),
      globalMultiplier: this.globalMultiplier,
      version: SAVE_VERSION,
    };
  }

  deserialize(data: ProductionSaveData): void {
    if (!data) return;
    this.territories.clear();
    for (const t of data.territories || []) {
      this.territories.set(t.territoryId, t);
    }
    this.globalMultiplier = data.globalMultiplier || 1;
  }
}
