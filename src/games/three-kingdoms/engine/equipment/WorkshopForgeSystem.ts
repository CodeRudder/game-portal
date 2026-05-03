/**
 * 装备域 — 工坊锻造系统
 *
 * Sprint 2: BLD-F24 工坊装备系统
 * 职责：从资源锻造装备、批量锻造、装备分解回收矿石
 * 依赖：EquipmentSystem（装备生成/背包）、BuildingSystem（工坊等级/效率）
 *
 * 功能覆盖：
 *   BLD-F24-01: 装备锻造 — 矿石+木材+铜钱→装备(品质判定)
 *   BLD-F24-01b: 装备强化 — 消耗矿石→属性提升(含工坊折扣)
 *   BLD-F24-02: 批量锻造 — 工坊Lv10解锁→一次锻造多件
 *   BLD-F24-03: 装备分解 — 装备→回收矿石(回收率受等级影响)
 *   BLD-F24-05: 装备穿戴 — 装备绑定武将→属性加成注入
 *   XI-009: BLD→EQP — 工坊等级→锻造效率/强化折扣
 *
 * @module engine/equipment/WorkshopForgeSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  EquipmentSlot,
  EquipmentRarity,
  EquipmentInstance,
} from '../../core/equipment';
import { EQUIPMENT_RARITIES } from '../../core/equipment';
import type { EquipmentSystem } from './EquipmentSystem';
import type { BuildingSystem } from '../building/BuildingSystem';

// ─────────────────────────────────────────────
// 配置常量
// ─────────────────────────────────────────────

/** 单次锻造资源消耗 */
export const FORGE_RESOURCE_COST = {
  /** 矿石消耗 */
  ore: 10,
  /** 木材消耗 */
  wood: 10,
  /** 铜钱消耗 */
  gold: 1000,
} as const;

/** 锻造品质权重（基础权重，受工坊效率影响） */
export const FORGE_RARITY_WEIGHTS: Record<string, number> = {
  white: 40,
  green: 35,
  blue: 18,
  purple: 6,
  gold: 1,
};

/** 工坊效率对高品质概率的加成系数 */
export const FORGE_EFFICIENCY_BONUS = 0.5; // 每点效率加成0.5%高品质概率

/** 批量锻造解锁等级 */
export const BATCH_FORGE_UNLOCK_LEVEL = 10;

/** 批量锻造最大数量 */
export const BATCH_FORGE_MAX_COUNT = 10;

/** 分解回收率基础百分比（按品质） */
export const DECOMPOSE_RECOVERY_RATE: Record<string, number> = {
  white: 0.3,
  green: 0.5,
  blue: 0.6,
  purple: 0.7,
  gold: 0.8,
};

/** 工坊等级对分解回收率的加成（每级+2%） */
export const DECOMPOSE_LEVEL_BONUS = 0.02;

/** 强化每级属性增长百分比 */
export const ENHANCE_STAT_GROWTH_PER_LEVEL = 0.05;

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 锻造结果 */
export interface WorkshopForgeResult {
  /** 是否成功 */
  success: boolean;
  /** 产出的装备（失败时为null） */
  equipment: EquipmentInstance | null;
  /** 实际消耗的资源 */
  cost: { ore: number; wood: number; gold: number };
  /** 失败原因 */
  reason?: string;
}

/** 批量锻造结果 */
export interface BatchForgeResult {
  /** 是否成功 */
  success: boolean;
  /** 产出的装备列表 */
  equipments: EquipmentInstance[];
  /** 实际消耗的总资源 */
  totalCost: { ore: number; wood: number; gold: number };
  /** 请求锻造数量 */
  requestedCount: number;
  /** 实际锻造数量 */
  forgedCount: number;
  /** 失败原因 */
  reason?: string;
}

/** 工坊分解结果 */
export interface WorkshopDecomposeResult {
  /** 是否成功 */
  success: boolean;
  /** 回收的矿石数量 */
  recoveredOre: number;
  /** 回收率百分比 */
  recoveryRate: number;
  /** 失败原因 */
  reason?: string;
}

/** 装备属性加成汇总 */
export interface EquipmentBonus {
  /** 攻击加成 */
  attack: number;
  /** 防御加成 */
  defense: number;
  /** 智力加成 */
  intelligence: number;
  /** 速度加成 */
  speed: number;
}

// ─────────────────────────────────────────────
// WorkshopForgeSystem
// ─────────────────────────────────────────────

export class WorkshopForgeSystem implements ISubsystem {
  readonly name = 'workshopForge';
  private deps: ISystemDeps | null = null;
  private equipmentSystem: EquipmentSystem | null = null;
  private buildingSystem: BuildingSystem | null = null;
  /** 资源扣除回调 */
  private deductResources: ((cost: { ore: number; wood: number; gold: number }) => boolean) | null = null;
  /** 资源增加回调 */
  private addResources: ((resources: { ore?: number; wood?: number; gold?: number }) => void) | null = null;
  /** 随机数种子 */
  private rngState = 42;

  constructor() {}

  // ─── ISubsystem 接口 ───────────────────────

  init(deps: ISystemDeps): void { this.deps = deps; }
  update(_dt: number): void {}
  getState(): Record<string, unknown> { return this.serialize(); }
  reset(): void { this.rngState = 42; }

  // ─── 依赖注入 ──────────────────────────────

  setEquipmentSystem(eq: EquipmentSystem): void { this.equipmentSystem = eq; }
  setBuildingSystem(bs: BuildingSystem): void { this.buildingSystem = bs; }
  setResourceDeductor(fn: (cost: { ore: number; wood: number; gold: number }) => boolean): void { this.deductResources = fn; }
  setResourceAdder(fn: (resources: { ore?: number; wood?: number; gold?: number }) => void): void { this.addResources = fn; }

  // ─────────────────────────────────────────────
  // BLD-F24-01: 装备锻造 — 矿石+木材+铜钱→装备
  // ─────────────────────────────────────────────

  /** 锻造单件装备 */
  forgeEquipment(slot?: EquipmentSlot, rngOverride?: () => number): WorkshopForgeResult {
    if (!this.equipmentSystem) {
      return { success: false, equipment: null, cost: { ore: 0, wood: 0, gold: 0 }, reason: '装备系统未初始化' };
    }

    // 检查背包是否已满
    if (this.equipmentSystem.isBagFull()) {
      return { success: false, equipment: null, cost: { ore: 0, wood: 0, gold: 0 }, reason: '背包已满' };
    }

    const cost = { ...FORGE_RESOURCE_COST };

    // 工坊效率可能影响消耗（未来扩展）
    // const efficiency = this.getForgeEfficiency();

    // 扣除资源
    if (this.deductResources) {
      const deducted = this.deductResources(cost);
      if (!deducted) {
        return { success: false, equipment: null, cost: { ore: 0, wood: 0, gold: 0 }, reason: '资源不足' };
      }
    }

    // 品质判定（受工坊效率影响）
    const rarity = this.rollForgeRarity(rngOverride);
    const targetSlot = slot ?? this.randomSlot(rngOverride);

    // 生成装备
    const equipment = this.equipmentSystem.generateEquipment(targetSlot, rarity, 'forge');

    if (!equipment) {
      // 生成失败，退还资源
      if (this.addResources) {
        this.addResources({ ore: cost.ore, wood: cost.wood, gold: cost.gold });
      }
      return { success: false, equipment: null, cost: { ore: 0, wood: 0, gold: 0 }, reason: '装备生成失败' };
    }

    return { success: true, equipment, cost };
  }

  // ─────────────────────────────────────────────
  // BLD-F24-02: 批量锻造 — 工坊Lv10解锁
  // ─────────────────────────────────────────────

  /** 批量锻造装备 */
  batchForge(count: number, slot?: EquipmentSlot, rngOverride?: () => number): BatchForgeResult {
    // 检查批量锻造解锁
    if (!this.isBatchForgeUnlocked()) {
      return { success: false, equipments: [], totalCost: { ore: 0, wood: 0, gold: 0 }, requestedCount: count, forgedCount: 0, reason: '工坊等级不足，需Lv10解锁批量锻造' };
    }

    if (!this.equipmentSystem) {
      return { success: false, equipments: [], totalCost: { ore: 0, wood: 0, gold: 0 }, requestedCount: count, forgedCount: 0, reason: '装备系统未初始化' };
    }

    // 限制最大数量
    const actualCount = Math.min(count, BATCH_FORGE_MAX_COUNT);
    if (actualCount <= 0) {
      return { success: false, equipments: [], totalCost: { ore: 0, wood: 0, gold: 0 }, requestedCount: count, forgedCount: 0, reason: '锻造数量无效' };
    }

    // 检查背包剩余空间
    const bagSpace = this.equipmentSystem.getBagCapacity() - this.equipmentSystem.getBagUsedCount();
    const forgeCount = Math.min(actualCount, bagSpace);
    if (forgeCount <= 0) {
      return { success: false, equipments: [], totalCost: { ore: 0, wood: 0, gold: 0 }, requestedCount: count, forgedCount: 0, reason: '背包空间不足' };
    }

    // 计算总消耗
    const totalCost = {
      ore: FORGE_RESOURCE_COST.ore * forgeCount,
      wood: FORGE_RESOURCE_COST.wood * forgeCount,
      gold: FORGE_RESOURCE_COST.gold * forgeCount,
    };

    // 扣除资源
    if (this.deductResources) {
      const deducted = this.deductResources(totalCost);
      if (!deducted) {
        return { success: false, equipments: [], totalCost: { ore: 0, wood: 0, gold: 0 }, requestedCount: count, forgedCount: 0, reason: '资源不足' };
      }
    }

    // 逐件锻造
    const equipments: EquipmentInstance[] = [];
    for (let i = 0; i < forgeCount; i++) {
      const rarity = this.rollForgeRarity(rngOverride);
      const targetSlot = slot ?? this.randomSlot(rngOverride);
      const eq = this.equipmentSystem.generateEquipment(targetSlot, rarity, 'forge');
      if (eq) equipments.push(eq);
    }

    return {
      success: equipments.length > 0,
      equipments,
      totalCost: equipments.length > 0 ? totalCost : { ore: 0, wood: 0, gold: 0 },
      requestedCount: count,
      forgedCount: equipments.length,
    };
  }

  // ─────────────────────────────────────────────
  // BLD-F24-03: 装备分解 — 装备→回收矿石
  // ─────────────────────────────────────────────

  /** 分解装备回收矿石 */
  decomposeEquipment(uid: string): WorkshopDecomposeResult {
    if (!this.equipmentSystem) {
      return { success: false, recoveredOre: 0, recoveryRate: 0, reason: '装备系统未初始化' };
    }

    const eq = this.equipmentSystem.getEquipment(uid);
    if (!eq) {
      return { success: false, recoveredOre: 0, recoveryRate: 0, reason: '装备不存在' };
    }
    if (eq.isEquipped) {
      return { success: false, recoveredOre: 0, recoveryRate: 0, reason: '已穿戴装备不可分解' };
    }

    // 计算回收率
    const recoveryRate = this.calculateRecoveryRate(eq.rarity, eq.enhanceLevel);

    // 计算回收矿石数量
    const baseOre = FORGE_RESOURCE_COST.ore; // 基于锻造消耗的矿石
    const recoveredOre = Math.max(1, Math.floor(baseOre * recoveryRate));

    // 从背包移除装备
    this.equipmentSystem.removeFromBag(uid);

    // 增加矿石
    if (this.addResources) {
      this.addResources({ ore: recoveredOre });
    }

    return { success: true, recoveredOre, recoveryRate };
  }

  // ─────────────────────────────────────────────
  // BLD-F24-01b: 装备强化 — 消耗矿石→属性提升
  // ─────────────────────────────────────────────

  /** 计算强化消耗矿石（含工坊折扣） */
  calculateEnhanceOreCost(baseCost: number): number {
    const discount = this.getEnhanceDiscountMultiplier();
    return Math.max(1, Math.floor(baseCost * discount));
  }

  // ─────────────────────────────────────────────
  // BLD-F24-05 / XI-013: 装备属性→武将属性
  // ─────────────────────────────────────────────

  /** 计算武将所有装备的属性加成 */
  calculateHeroEquipmentBonus(heroId: string): EquipmentBonus {
    const bonus: EquipmentBonus = { attack: 0, defense: 0, intelligence: 0, speed: 0 };

    if (!this.equipmentSystem) return bonus;

    const equips = this.equipmentSystem.getHeroEquipments(heroId);
    for (const eq of equips) {
      const updated = this.equipmentSystem.recalculateStats(eq);

      // 主属性映射到武将属性
      const mainType = updated.mainStat.type;
      const mainValue = updated.mainStat.value;
      bonus[this.mapStatType(mainType)] += mainValue;

      // 副属性映射（hp等特殊属性不直接映射到四维）
      for (const sub of updated.subStats) {
        const mapped = this.mapSubStatType(sub.type);
        if (mapped) {
          bonus[mapped] += sub.value;
        }
      }
    }

    return bonus;
  }

  /** 计算武将穿戴装备后的总属性（基础+装备加成） */
  calculateHeroTotalStats(heroId: string, baseStats: { attack: number; defense: number; intelligence: number; speed: number }): EquipmentBonus {
    const equipBonus = this.calculateHeroEquipmentBonus(heroId);
    return {
      attack: baseStats.attack + equipBonus.attack,
      defense: baseStats.defense + equipBonus.defense,
      intelligence: baseStats.intelligence + equipBonus.intelligence,
      speed: baseStats.speed + equipBonus.speed,
    };
  }

  /** 计算装备对派驻建筑产出的加成百分比 */
  calculateBuildingProductionBonus(heroId: string): number {
    const bonus = this.calculateHeroEquipmentBonus(heroId);
    // 攻击力的10%作为建筑产出加成
    return bonus.attack * 0.1;
  }

  // ─────────────────────────────────────────────
  // 查询方法
  // ─────────────────────────────────────────────

  /** 获取锻造效率百分比 */
  getForgeEfficiency(): number {
    if (!this.buildingSystem) return 0;
    return this.buildingSystem.getWorkshopForgeEfficiency();
  }

  /** 获取工坊锻造等级（代理 BuildingSystem） */
  getForgeLevel(): number {
    if (!this.buildingSystem) return 0;
    return this.buildingSystem.getWorkshopLevel();
  }

  /** 获取强化折扣乘数 */
  getEnhanceDiscountMultiplier(): number {
    if (!this.buildingSystem) return 1.0;
    return this.buildingSystem.getWorkshopEnhanceDiscountMultiplier();
  }

  /** 是否解锁批量锻造 */
  isBatchForgeUnlocked(): boolean {
    if (!this.buildingSystem) return false;
    return this.buildingSystem.isBatchForgeUnlocked();
  }

  /** 获取锻造消耗预览 */
  getForgeCostPreview(): { ore: number; wood: number; gold: number } {
    return { ...FORGE_RESOURCE_COST };
  }

  /** 获取批量锻造消耗预览 */
  getBatchForgeCostPreview(count: number): { ore: number; wood: number; gold: number } {
    const actual = Math.min(count, BATCH_FORGE_MAX_COUNT);
    return {
      ore: FORGE_RESOURCE_COST.ore * actual,
      wood: FORGE_RESOURCE_COST.wood * actual,
      gold: FORGE_RESOURCE_COST.gold * actual,
    };
  }

  /** 获取分解预览 */
  getDecomposePreview(uid: string): { recoveredOre: number; recoveryRate: number } | null {
    if (!this.equipmentSystem) return null;
    const eq = this.equipmentSystem.getEquipment(uid);
    if (!eq) return null;
    const recoveryRate = this.calculateRecoveryRate(eq.rarity, eq.enhanceLevel);
    const recoveredOre = Math.max(1, Math.floor(FORGE_RESOURCE_COST.ore * recoveryRate));
    return { recoveredOre, recoveryRate };
  }

  // ─────────────────────────────────────────────
  // 序列化
  // ─────────────────────────────────────────────

  serialize(): Record<string, unknown> {
    return { rngState: this.rngState };
  }

  deserialize(data: Record<string, unknown>): void {
    if (data?.rngState && typeof data.rngState === 'number') {
      this.rngState = data.rngState;
    }
  }

  // ─────────────────────────────────────────────
  // 私有方法
  // ─────────────────────────────────────────────

  /** 锻造品质判定（受工坊效率影响） */
  private rollForgeRarity(rngOverride?: () => number): EquipmentRarity {
    const rng = rngOverride ?? (() => this.randomFloat());

    // 基础权重
    const weights = { ...FORGE_RARITY_WEIGHTS };

    // 工坊效率加成：提升高品质概率
    const efficiency = this.getForgeEfficiency();
    if (efficiency > 0) {
      // 从白色权重中转移一部分到高品质
      const bonus = efficiency * FORGE_EFFICIENCY_BONUS;
      weights.white = Math.max(10, weights.white - bonus * 3);
      weights.blue = (weights.blue ?? 0) + bonus;
      weights.purple = (weights.purple ?? 0) + bonus * 0.8;
      weights.gold = (weights.gold ?? 0) + bonus * 0.2;
    }

    // 加权随机
    const entries = Object.entries(weights);
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let roll = rng() * total;
    for (const [rarity, weight] of entries) {
      roll -= weight;
      if (roll <= 0) return rarity as EquipmentRarity;
    }
    return 'white' as EquipmentRarity;
  }

  /** 随机部位 */
  private randomSlot(rngOverride?: () => number): EquipmentSlot {
    const slots: EquipmentSlot[] = ['weapon', 'armor', 'accessory', 'mount'];
    const rng = rngOverride ?? (() => this.randomFloat());
    return slots[Math.floor(rng() * slots.length)];
  }

  /** 计算分解回收率 */
  private calculateRecoveryRate(rarity: EquipmentRarity, enhanceLevel: number): number {
    const baseRate = DECOMPOSE_RECOVERY_RATE[rarity] ?? 0.3;
    const levelBonus = this.getWorkshopLevel() * DECOMPOSE_LEVEL_BONUS;
    const enhanceBonus = enhanceLevel * 0.02; // 每强化等级+2%回收率
    return Math.min(1.0, baseRate + levelBonus + enhanceBonus);
  }

  /** 获取工坊等级 */
  private getWorkshopLevel(): number {
    if (!this.buildingSystem) return 0;
    return this.buildingSystem.getWorkshopLevel();
  }

  /** 主属性类型→武将四维映射 */
  private mapStatType(type: string): keyof EquipmentBonus {
    const map: Record<string, keyof EquipmentBonus> = {
      attack: 'attack',
      defense: 'defense',
      intelligence: 'intelligence',
      speed: 'speed',
    };
    return map[type] ?? 'attack';
  }

  /** 副属性类型→武将四维映射（部分副属性不直接映射） */
  private mapSubStatType(type: string): keyof EquipmentBonus | null {
    const map: Record<string, keyof EquipmentBonus> = {
      attack: 'attack',
      defense: 'defense',
      intelligence: 'intelligence',
      speed: 'speed',
      hp: 'defense', // HP映射为防御
    };
    return map[type] ?? null;
  }

  /** 伪随机数生成 */
  private randomFloat(): number {
    this.rngState = (this.rngState * 1103515245 + 12345) & 0x7fffffff;
    return this.rngState / 0x7fffffff;
  }
}
