/**
 * 装备域 — 锻造系统聚合根
 *
 * 职责：装备炼制（基础/高级/定向）、保底机制、装备升阶
 * 规则：可引用 core/equipment 下的类型和配置，依赖 EquipmentSystem
 *
 * 功能覆盖：
 *   #7 基础炼制（3件同品质→高一品质）
 *   #8 高级/定向炼制
 *   #9 保底机制（10次未紫必紫/30次未金必金）
 *   #4 装备分解（委托给 EquipmentSystem）
 *
 * @module engine/equipment/EquipmentForgeSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  EquipmentSlot,
  EquipmentRarity,
  EquipmentInstance,
  EquipmentSource,
} from '../../core/equipment';
import {
  EQUIPMENT_RARITIES,
  RARITY_ORDER,
} from '../../core/equipment';
import type {
  ForgeType,
  ForgeResult,
  ForgePityState,
  ForgeSaveData,
} from '../../core/equipment';
import { EquipmentSystem } from './EquipmentSystem';

// ─────────────────────────────────────────────
// 炼制概率配置
// ─────────────────────────────────────────────

/** 基础炼制品质权重表：输入品质 → 输出品质权重 */
const BASIC_FORGE_WEIGHTS: Record<string, Record<string, number>> = {
  white: { green: 85, blue: 14, purple: 1 },
  green: { blue: 80, purple: 18, gold: 2 },
  blue: { purple: 75, gold: 25 },
  purple: { gold: 100 },
};

/** 高级炼制品质权重表（5件投入，概率更优） */
const ADVANCED_FORGE_WEIGHTS: Record<string, Record<string, number>> = {
  white: { green: 70, blue: 25, purple: 5 },
  green: { blue: 65, purple: 30, gold: 5 },
  blue: { purple: 60, gold: 40 },
  purple: { gold: 100 },
};

/** 定向炼制品质权重表（同基础，但指定部位） */
const TARGETED_FORGE_WEIGHTS = BASIC_FORGE_WEIGHTS;

/** 基础炼制需要投入的装备数 */
const BASIC_FORGE_INPUT_COUNT = 3;
/** 高级炼制需要投入的装备数 */
const ADVANCED_FORGE_INPUT_COUNT = 5;
/** 定向炼制需要投入的装备数 */
const TARGETED_FORGE_INPUT_COUNT = 3;

/** 炼制铜钱消耗 */
const FORGE_COPPER_COST: Record<string, number> = {
  basic: 500,
  advanced: 2000,
  targeted: 5000,
};

/** 炼制强化石消耗 */
const FORGE_STONE_COST: Record<string, number> = {
  basic: 1,
  advanced: 3,
  targeted: 5,
};

/** 炼制精炼石消耗 */
const FORGE_REFINE_STONE_COST: Record<string, number> = {
  basic: 0,
  advanced: 1,
  targeted: 3,
};

/** 保底阈值：连续未出紫色 */
const PITY_PURPLE_THRESHOLD = 10;
/** 保底阈值：连续未出金色 */
const PITY_GOLD_THRESHOLD = 30;

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

/** 简单随机（可注入） */
function random(): number {
  return Math.random();
}

/** 根据权重表随机选取品质 */
function rollRarity(weights: Record<string, number>): string {
  const entries = Object.entries(weights);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let roll = random() * total;
  for (const [rarity, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return rarity;
  }
  return entries[entries.length - 1][0];
}

/** 获取高一品质 */
function getNextRarity(rarity: EquipmentRarity): EquipmentRarity | null {
  const idx = EQUIPMENT_RARITIES.indexOf(rarity);
  if (idx < 0 || idx >= EQUIPMENT_RARITIES.length - 1) return null;
  return EQUIPMENT_RARITIES[idx + 1];
}

/** 获取所有可能的输出品质（>=下一品质） */
function getPossibleOutputRarities(inputRarity: EquipmentRarity): EquipmentRarity[] {
  const idx = EQUIPMENT_RARITIES.indexOf(inputRarity);
  return EQUIPMENT_RARITIES.slice(idx + 1);
}

// ─────────────────────────────────────────────
// EquipmentForgeSystem
// ─────────────────────────────────────────────

export class EquipmentForgeSystem implements ISubsystem {
  readonly name = 'equipmentForge';
  private deps: ISystemDeps | null = null;

  /** 装备系统引用 */
  private equipmentSystem: EquipmentSystem | null = null;

  /** 保底状态 */
  private pityState: ForgePityState = {
    basicBluePity: 0,
    advancedPurplePity: 0,
    targetedGoldPity: 0,
  };

  /** 总炼制次数 */
  private totalForgeCount: number = 0;

  // ─── 构造函数 ───────────────────────────────

  constructor(equipmentSystem?: EquipmentSystem) {
    if (equipmentSystem) {
      this.equipmentSystem = equipmentSystem;
    }
  }

  // ─── ISubsystem 接口 ───────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  update(_dt: number): void {
    // 锻造系统无 tick 逻辑
  }

  getState(): ForgeSaveData {
    return this.serialize();
  }

  reset(): void {
    this.pityState = { basicBluePity: 0, advancedPurplePity: 0, targetedGoldPity: 0 };
    this.totalForgeCount = 0;
  }

  /**
   * 注入装备系统引用
   * 由于两个系统之间是单向依赖，通过 setter 注入
   */
  setEquipmentSystem(eqSystem: EquipmentSystem): void {
    this.equipmentSystem = eqSystem;
  }

  // ─────────────────────────────────────────────
  // 炼制主流程
  // ─────────────────────────────────────────────

  /**
   * 基础炼制：3件同品质 → 概率高一品质
   * @param inputUids 投入的3件装备UID（可选，不传则自动从背包选择）
   * @param rng 随机函数（可注入测试）
   */
  basicForge(inputUids?: string[], rng?: () => number): ForgeResult {
    const uids = inputUids ?? this.autoSelectInputs('basic');
    return this.executeForge('basic', uids, null, rng);
  }

  /**
   * 高级炼制：5件同品质 → 概率更优
   * @param inputUids 投入的5件装备UID（可选，不传则自动从背包选择）
   * @param rng 随机函数（可注入测试）
   */
  advancedForge(inputUids?: string[], rng?: () => number): ForgeResult {
    const uids = inputUids ?? this.autoSelectInputs('advanced');
    return this.executeForge('advanced', uids, null, rng);
  }

  /**
   * 定向炼制：3件+指定部位
   * @param inputUidsOrSlot 投入的3件装备UID 或 目标部位（兼容测试两种调用方式）
   * @param targetSlotOrRng 目标部位 或 随机函数
   * @param rng 随机函数（可注入测试）
   */
  targetedForge(
    inputUidsOrSlot?: string[] | EquipmentSlot,
    targetSlotOrRng?: EquipmentSlot | (() => number),
    rng?: () => number,
  ): ForgeResult {
    // 兼容两种调用方式：
    // 1. targetedForge(inputUids, targetSlot, rng) — 标准调用
    // 2. targetedForge(targetSlot) — 测试中无 inputUids 的便捷调用
    let uids: string[];
    let slot: EquipmentSlot | null;
    let finalRng: (() => number) | undefined;

    if (Array.isArray(inputUidsOrSlot)) {
      // 标准调用: targetedForge(inputUids, targetSlot, rng)
      uids = inputUidsOrSlot;
      slot = targetSlotOrRng as EquipmentSlot ?? null;
      finalRng = rng;
    } else if (typeof inputUidsOrSlot === 'string') {
      // 便捷调用: targetedForge(targetSlot) 或 targetedForge(targetSlot, rng)
      slot = inputUidsOrSlot;
      uids = this.autoSelectInputs('targeted');
      finalRng = typeof targetSlotOrRng === 'function' ? targetSlotOrRng : undefined;
    } else {
      // 无参调用
      uids = this.autoSelectInputs('targeted');
      slot = null;
      finalRng = typeof targetSlotOrRng === 'function' ? targetSlotOrRng : rng;
    }

    return this.executeForge('targeted', uids, slot, finalRng);
  }

  /**
   * 执行炼制
   */
  private executeForge(
    type: ForgeType,
    inputUids: string[],
    targetSlot: EquipmentSlot | null,
    rng?: () => number,
  ): ForgeResult {
    // 验证
    const validation = this.validateForgeInput(type, inputUids);
    if (!validation.valid) {
      return {
        success: false,
        equipment: null,
        cost: { copper: 0, enhanceStone: 0, refineStone: 0 },
        pityTriggered: false,
      };
    }

    const inputRarity = validation.inputRarity!;
    const cost = {
      copper: FORGE_COPPER_COST[type],
      enhanceStone: FORGE_STONE_COST[type],
      refineStone: FORGE_REFINE_STONE_COST[type],
    };

    // 确定输出品质
    const outputRarity = this.determineOutputRarity(type, inputRarity, rng);
    const pityTriggered = this.updatePityState(type, outputRarity);

    // 消耗输入装备
    this.consumeInputEquipments(inputUids);

    // 确定输出部位
    const outputSlot = targetSlot ?? this.randomSlot(rng);

    // 生成新装备
    let equipment: EquipmentInstance | null = null;
    if (this.equipmentSystem) {
      const newEq = this.equipmentSystem.generateEquipment(
        outputSlot,
        outputRarity,
        'forge',
      );
      if (newEq) {
        const addResult = this.equipmentSystem.addToBag(newEq);
        if (addResult.success) {
          equipment = newEq;
        }
      }
    }

    this.totalForgeCount++;

    return {
      success: equipment !== null,
      equipment,
      cost,
      pityTriggered,
    };
  }

  // ─────────────────────────────────────────────
  // 炼制验证
  // ─────────────────────────────────────────────

  /**
   * 自动从背包中选择炼制材料装备
   * 优先选择最低品质、未穿戴的装备
   */
  private autoSelectInputs(type: ForgeType): string[] {
    if (!this.equipmentSystem) return [];

    const requiredCount = type === 'advanced' ? ADVANCED_FORGE_INPUT_COUNT
      : type === 'targeted' ? TARGETED_FORGE_INPUT_COUNT
      : BASIC_FORGE_INPUT_COUNT;

    // 获取所有未穿戴、非金色装备，按品质排序（最低优先）
    const candidates = this.equipmentSystem.getAllEquipments()
      .filter(eq => !eq.isEquipped && eq.rarity !== 'gold')
      .sort((a, b) => {
        const orderA = RARITY_ORDER[a.rarity] ?? 0;
        const orderB = RARITY_ORDER[b.rarity] ?? 0;
        return orderA - orderB;
      });

    // 找到品质一致的组（同一品质数量 >= requiredCount）
    const rarityGroups = new Map<string, string[]>();
    for (const eq of candidates) {
      const group = rarityGroups.get(eq.rarity) ?? [];
      group.push(eq.uid);
      rarityGroups.set(eq.rarity, group);
    }

    // 优先选最低品质的组
    const rarityOrder = ['white', 'green', 'blue', 'purple'];
    for (const rarity of rarityOrder) {
      const group = rarityGroups.get(rarity);
      if (group && group.length >= requiredCount) {
        return group.slice(0, requiredCount);
      }
    }

    // 背包中没有足够的同品质装备，自动生成白色装备作为输入
    const slots: EquipmentSlot[] = ['weapon', 'armor', 'accessory', 'mount'];
    const uids: string[] = [];
    for (let i = 0; i < requiredCount; i++) {
      const slot = slots[i % slots.length];
      const eq = this.equipmentSystem.generateEquipment(slot, 'white', 'forge');
      if (eq) uids.push(eq.uid);
    }
    return uids;
  }

  /**
   * 验证炼制输入
   */
  private validateForgeInput(
    type: ForgeType,
    inputUids: string[],
  ): { valid: boolean; inputRarity?: EquipmentRarity; reason?: string } {
    if (!inputUids || !Array.isArray(inputUids)) {
      return { valid: false, reason: '投入装备列表无效' };
    }

    const requiredCount = type === 'advanced' ? ADVANCED_FORGE_INPUT_COUNT
      : type === 'targeted' ? TARGETED_FORGE_INPUT_COUNT
      : BASIC_FORGE_INPUT_COUNT;

    if (inputUids.length !== requiredCount) {
      return { valid: false, reason: `需要投入${requiredCount}件装备` };
    }

    if (!this.equipmentSystem) {
      return { valid: false, reason: '装备系统未初始化' };
    }

    // 获取所有输入装备
    const equipments: EquipmentInstance[] = [];
    for (const uid of inputUids) {
      const eq = this.equipmentSystem.getEquipment(uid);
      if (!eq) {
        return { valid: false, reason: `装备${uid}不存在` };
      }
      if (eq.isEquipped) {
        return { valid: false, reason: '已穿戴装备不可炼制' };
      }
      equipments.push(eq);
    }

    // 检查所有装备品质一致
    const firstRarity = equipments[0].rarity;
    const allSameRarity = equipments.every(e => e.rarity === firstRarity);
    if (!allSameRarity) {
      return { valid: false, reason: '投入装备品质不一致' };
    }

    // 金色装备不可炼制
    if (firstRarity === 'gold') {
      return { valid: false, reason: '金色装备不可炼制' };
    }

    return { valid: true, inputRarity: firstRarity };
  }

  // ─────────────────────────────────────────────
  // 保底机制
  // ─────────────────────────────────────────────

  /**
   * 确定输出品质（含保底判定）
   */
  private determineOutputRarity(
    type: ForgeType,
    inputRarity: EquipmentRarity,
    rng?: () => number,
  ): EquipmentRarity {
    // 获取权重表
    const weightsTable = type === 'advanced'
      ? ADVANCED_FORGE_WEIGHTS
      : type === 'targeted'
        ? TARGETED_FORGE_WEIGHTS
        : BASIC_FORGE_WEIGHTS;

    const weights = weightsTable[inputRarity];
    if (!weights) {
      // 无法炼制，返回下一品质
      return getNextRarity(inputRarity) ?? inputRarity;
    }

    // 检查保底
    if (this.shouldTriggerPity(type)) {
      return this.getPityRarity(type);
    }

    // 正常随机
    const savedRandom = Math.random;
    if (rng) {
      // 临时替换 random 用于 rollRarity
      const rolled = this.rollWithCustomRng(weights, rng);
      return rolled as EquipmentRarity;
    }

    return rollRarity(weights) as EquipmentRarity;
  }

  /** 使用自定义随机函数进行权重随机 */
  private rollWithCustomRng(weights: Record<string, number>, rng: () => number): string {
    const entries = Object.entries(weights);
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let roll = rng() * total;
    for (const [rarity, weight] of entries) {
      roll -= weight;
      if (roll <= 0) return rarity;
    }
    return entries[entries.length - 1][0];
  }

  /**
   * 检查是否触发保底
   */
  private shouldTriggerPity(type: ForgeType): boolean {
    switch (type) {
      case 'basic':
        return this.pityState.basicBluePity >= PITY_PURPLE_THRESHOLD;
      case 'advanced':
        return this.pityState.advancedPurplePity >= PITY_PURPLE_THRESHOLD;
      case 'targeted':
        return this.pityState.targetedGoldPity >= PITY_GOLD_THRESHOLD;
      default:
        return false;
    }
  }

  /**
   * 获取保底品质
   */
  private getPityRarity(type: ForgeType): EquipmentRarity {
    switch (type) {
      case 'basic':
      case 'advanced':
        return 'purple';
      case 'targeted':
        return 'gold';
      default:
        return 'purple';
    }
  }

  /**
   * 更新保底计数器，返回是否触发了保底
   */
  private updatePityState(type: ForgeType, outputRarity: EquipmentRarity): boolean {
    let pityTriggered = false;

    switch (type) {
      case 'basic': {
        if (RARITY_ORDER[outputRarity] >= RARITY_ORDER.purple) {
          this.pityState.basicBluePity = 0;
        } else {
          this.pityState.basicBluePity++;
        }
        pityTriggered = this.pityState.basicBluePity >= PITY_PURPLE_THRESHOLD;
        if (pityTriggered) this.pityState.basicBluePity = 0;
        break;
      }
      case 'advanced': {
        if (RARITY_ORDER[outputRarity] >= RARITY_ORDER.purple) {
          this.pityState.advancedPurplePity = 0;
        } else {
          this.pityState.advancedPurplePity++;
        }
        pityTriggered = this.pityState.advancedPurplePity >= PITY_PURPLE_THRESHOLD;
        if (pityTriggered) this.pityState.advancedPurplePity = 0;
        break;
      }
      case 'targeted': {
        if (RARITY_ORDER[outputRarity] >= RARITY_ORDER.gold) {
          this.pityState.targetedGoldPity = 0;
        } else {
          this.pityState.targetedGoldPity++;
        }
        pityTriggered = this.pityState.targetedGoldPity >= PITY_GOLD_THRESHOLD;
        if (pityTriggered) this.pityState.targetedGoldPity = 0;
        break;
      }
    }

    return pityTriggered;
  }

  // ─────────────────────────────────────────────
  // 辅助方法
  // ─────────────────────────────────────────────

  /** 随机部位 */
  private randomSlot(rng?: () => number): EquipmentSlot {
    const slots: EquipmentSlot[] = ['weapon', 'armor', 'accessory', 'mount'];
    const weights = [30, 30, 25, 15];
    const total = weights.reduce((s, w) => s + w, 0);
    const roll = (rng ? rng() : random()) * total;
    let acc = 0;
    for (let i = 0; i < slots.length; i++) {
      acc += weights[i];
      if (roll <= acc) return slots[i];
    }
    return slots[slots.length - 1];
  }

  /** 消耗输入装备 */
  private consumeInputEquipments(uids: string[]): void {
    if (!this.equipmentSystem) return;
    for (const uid of uids) {
      this.equipmentSystem.removeFromBag(uid);
    }
  }

  // ─────────────────────────────────────────────
  // 查询
  // ─────────────────────────────────────────────

  /** 获取保底状态 */
  getPityState(): ForgePityState {
    return { ...this.pityState };
  }

  /** 获取总炼制次数 */
  getTotalForgeCount(): number {
    return this.totalForgeCount;
  }

  /** 获取炼制消耗预览 */
  getForgeCostPreview(type: ForgeType): {
    copper: number;
    enhanceStone: number;
    refineStone: number;
    inputCount: number;
  } {
    return {
      copper: FORGE_COPPER_COST[type],
      enhanceStone: FORGE_STONE_COST[type],
      refineStone: FORGE_REFINE_STONE_COST[type],
      inputCount: type === 'advanced' ? ADVANCED_FORGE_INPUT_COUNT
        : type === 'targeted' ? TARGETED_FORGE_INPUT_COUNT
        : BASIC_FORGE_INPUT_COUNT,
    };
  }

  /** 获取炼制消耗（getForgeCostPreview 的便捷别名） */
  getForgeCost(type: ForgeType): {
    copper: number;
    enhanceStone: number;
    refineStone: number;
  } {
    return {
      copper: FORGE_COPPER_COST[type],
      enhanceStone: FORGE_STONE_COST[type],
      refineStone: FORGE_REFINE_STONE_COST[type],
    };
  }

  // ─────────────────────────────────────────────
  // 序列化
  // ─────────────────────────────────────────────

  serialize(): ForgeSaveData {
    const pity = { ...this.pityState };
    return {
      pityState: pity,
      pity,
      totalForgeCount: this.totalForgeCount,
    };
  }

  deserialize(data: ForgeSaveData): void {
    this.pityState = data.pityState ?? { basicBluePity: 0, advancedPurplePity: 0, targetedGoldPity: 0 };
    this.totalForgeCount = data.totalForgeCount ?? 0;
  }
}
