/**
 * 装备域 — 锻造系统聚合根
 *
 * 职责：装备炼制（基础/高级/定向）、保底机制、装备升阶
 * 保底逻辑委托给 ForgePityManager
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
import { ForgePityManager } from './ForgePityManager';

// ─────────────────────────────────────────────
// 炼制概率配置
// ─────────────────────────────────────────────

const BASIC_FORGE_WEIGHTS: Record<string, Record<string, number>> = {
  white: { green: 85, blue: 14, purple: 1 },
  green: { blue: 80, purple: 18, gold: 2 },
  blue: { purple: 78, gold: 22 },
  purple: { gold: 100 },
};

const ADVANCED_FORGE_WEIGHTS: Record<string, Record<string, number>> = {
  white: { green: 70, blue: 25, purple: 5 },
  green: { blue: 65, purple: 30, gold: 5 },
  blue: { purple: 60, gold: 40 },
  purple: { gold: 100 },
};

const TARGETED_FORGE_WEIGHTS = BASIC_FORGE_WEIGHTS;

const BASIC_FORGE_INPUT_COUNT = 3;
const ADVANCED_FORGE_INPUT_COUNT = 5;
const TARGETED_FORGE_INPUT_COUNT = 3;

const FORGE_COPPER_COST: Record<string, number> = { basic: 500, advanced: 2000, targeted: 5000 };
const FORGE_STONE_COST: Record<string, number> = { basic: 1, advanced: 3, targeted: 5 };
const FORGE_REFINE_STONE_COST: Record<string, number> = { basic: 0, advanced: 1, targeted: 3 };

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

function random(): number { return Math.random(); }

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

function getNextRarity(rarity: EquipmentRarity): EquipmentRarity | null {
  const idx = EQUIPMENT_RARITIES.indexOf(rarity);
  if (idx < 0 || idx >= EQUIPMENT_RARITIES.length - 1) return null;
  return EQUIPMENT_RARITIES[idx + 1];
}

// ─────────────────────────────────────────────
// EquipmentForgeSystem
// ─────────────────────────────────────────────

export class EquipmentForgeSystem implements ISubsystem {
  readonly name = 'equipmentForge';
  private deps: ISystemDeps | null = null;
  private equipmentSystem: EquipmentSystem | null = null;
  private pityManager: ForgePityManager = new ForgePityManager();
  private totalForgeCount: number = 0;

  constructor(equipmentSystem?: EquipmentSystem) {
    if (equipmentSystem) this.equipmentSystem = equipmentSystem;
  }

  // ─── ISubsystem 接口 ───────────────────────

  init(deps: ISystemDeps): void { this.deps = deps; }
  update(_dt: number): void {}
  getState(): ForgeSaveData { return this.serialize(); }
  reset(): void { this.pityManager.reset(); this.totalForgeCount = 0; }

  setEquipmentSystem(eqSystem: EquipmentSystem): void { this.equipmentSystem = eqSystem; }

  // ─────────────────────────────────────────────
  // 炼制主流程
  // ─────────────────────────────────────────────

  basicForge(inputUids?: string[], rng?: () => number): ForgeResult {
    const uids = inputUids ?? this.autoSelectInputs('basic');
    return this.executeForge('basic', uids, null, rng);
  }

  advancedForge(inputUids?: string[], rng?: () => number): ForgeResult {
    const uids = inputUids ?? this.autoSelectInputs('advanced');
    return this.executeForge('advanced', uids, null, rng);
  }

  targetedForge(
    inputUidsOrSlot?: string[] | EquipmentSlot,
    targetSlotOrRng?: EquipmentSlot | (() => number),
    rng?: () => number,
  ): ForgeResult {
    let uids: string[];
    let slot: EquipmentSlot | null;
    let finalRng: (() => number) | undefined;

    if (Array.isArray(inputUidsOrSlot)) {
      uids = inputUidsOrSlot;
      slot = targetSlotOrRng as EquipmentSlot ?? null;
      finalRng = rng;
    } else if (typeof inputUidsOrSlot === 'string') {
      slot = inputUidsOrSlot;
      uids = this.autoSelectInputs('targeted');
      finalRng = typeof targetSlotOrRng === 'function' ? targetSlotOrRng : undefined;
    } else {
      uids = this.autoSelectInputs('targeted');
      slot = null;
      finalRng = typeof targetSlotOrRng === 'function' ? targetSlotOrRng : rng;
    }
    return this.executeForge('targeted', uids, slot, finalRng);
  }

  // ─────────────────────────────────────────────
  // 执行炼制
  // ─────────────────────────────────────────────

  private executeForge(type: ForgeType, inputUids: string[], targetSlot: EquipmentSlot | null, rng?: () => number): ForgeResult {
    const validation = this.validateForgeInput(type, inputUids);
    if (!validation.valid) {
      return { success: false, equipment: null, cost: { copper: 0, enhanceStone: 0, refineStone: 0 }, pityTriggered: false };
    }

    const inputRarity = validation.inputRarity!;
    const cost = { copper: FORGE_COPPER_COST[type], enhanceStone: FORGE_STONE_COST[type], refineStone: FORGE_REFINE_STONE_COST[type] };

    // 确定输出品质（含保底）
    const outputRarity = this.determineOutputRarity(type, inputRarity, rng);
    const pityTriggered = this.pityManager.update(type, outputRarity);

    // 消耗输入
    this.consumeInputEquipments(inputUids);

    // 生成新装备（generateEquipment 已自动 addToBag）
    const outputSlot = targetSlot ?? this.randomSlot(rng);
    let equipment: EquipmentInstance | null = null;
    if (this.equipmentSystem) {
      equipment = this.equipmentSystem.generateEquipment(outputSlot, outputRarity, 'forge');
    }

    this.totalForgeCount++;
    return { success: equipment !== null, equipment, cost, pityTriggered };
  }

  // ─────────────────────────────────────────────
  // 验证
  // ─────────────────────────────────────────────

  private validateForgeInput(type: ForgeType, inputUids: string[]): { valid: boolean; inputRarity?: EquipmentRarity; reason?: string } {
    if (!inputUids || !Array.isArray(inputUids)) return { valid: false, reason: '投入装备列表无效' };

    const requiredCount = type === 'advanced' ? ADVANCED_FORGE_INPUT_COUNT : type === 'targeted' ? TARGETED_FORGE_INPUT_COUNT : BASIC_FORGE_INPUT_COUNT;
    if (inputUids.length !== requiredCount) return { valid: false, reason: `需要投入${requiredCount}件装备` };
    if (!this.equipmentSystem) return { valid: false, reason: '装备系统未初始化' };

    const equipments: EquipmentInstance[] = [];
    for (const uid of inputUids) {
      const eq = this.equipmentSystem.getEquipment(uid);
      if (!eq) return { valid: false, reason: `装备${uid}不存在` };
      if (eq.isEquipped) return { valid: false, reason: '已穿戴装备不可炼制' };
      equipments.push(eq);
    }

    const firstRarity = equipments[0].rarity;
    if (!equipments.every(e => e.rarity === firstRarity)) return { valid: false, reason: '投入装备品质不一致' };
    if (firstRarity === 'gold') return { valid: false, reason: '金色装备不可炼制' };

    return { valid: true, inputRarity: firstRarity };
  }

  // ─────────────────────────────────────────────
  // 品质确定
  // ─────────────────────────────────────────────

  private determineOutputRarity(type: ForgeType, inputRarity: EquipmentRarity, rng?: () => number): EquipmentRarity {
    const weightsTable = type === 'advanced' ? ADVANCED_FORGE_WEIGHTS : type === 'targeted' ? TARGETED_FORGE_WEIGHTS : BASIC_FORGE_WEIGHTS;
    const weights = weightsTable[inputRarity];
    if (!weights) return getNextRarity(inputRarity) ?? inputRarity;

    // 检查保底
    if (this.pityManager.shouldTrigger(type)) return this.pityManager.getPityRarity(type);

    // 正常随机
    if (rng) return this.rollWithCustomRng(weights, rng) as EquipmentRarity;
    return rollRarity(weights) as EquipmentRarity;
  }

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

  // ─────────────────────────────────────────────
  // 自动选材
  // ─────────────────────────────────────────────

  private autoSelectInputs(type: ForgeType): string[] {
    if (!this.equipmentSystem) return [];
    const requiredCount = type === 'advanced' ? ADVANCED_FORGE_INPUT_COUNT : type === 'targeted' ? TARGETED_FORGE_INPUT_COUNT : BASIC_FORGE_INPUT_COUNT;

    const candidates = this.equipmentSystem.getAllEquipments()
      .filter(eq => !eq.isEquipped && eq.rarity !== 'gold')
      .sort((a, b) => (RARITY_ORDER[a.rarity] ?? 0) - (RARITY_ORDER[b.rarity] ?? 0));

    const rarityGroups = new Map<string, string[]>();
    for (const eq of candidates) {
      const group = rarityGroups.get(eq.rarity) ?? [];
      group.push(eq.uid);
      rarityGroups.set(eq.rarity, group);
    }

    for (const rarity of ['white', 'green', 'blue', 'purple']) {
      const group = rarityGroups.get(rarity);
      if (group && group.length >= requiredCount) return group.slice(0, requiredCount);
    }
    return [];
  }

  // ─────────────────────────────────────────────
  // 辅助方法
  // ─────────────────────────────────────────────

  private randomSlot(rng?: () => number): EquipmentSlot {
    const slots: EquipmentSlot[] = ['weapon', 'armor', 'accessory', 'mount'];
    const weights = [30, 30, 25, 15];
    const total = weights.reduce((s, w) => s + w, 0);
    const roll = (rng ? rng() : random()) * total;
    let acc = 0;
    for (let i = 0; i < slots.length; i++) { acc += weights[i]; if (roll <= acc) return slots[i]; }
    return slots[slots.length - 1];
  }

  private consumeInputEquipments(uids: string[]): void {
    if (!this.equipmentSystem) return;
    for (const uid of uids) this.equipmentSystem.removeFromBag(uid);
  }

  // ─────────────────────────────────────────────
  // 查询
  // ─────────────────────────────────────────────

  getPityState(): ForgePityState { return this.pityManager.getState(); }
  getTotalForgeCount(): number { return this.totalForgeCount; }

  getForgeCostPreview(type: ForgeType): { copper: number; enhanceStone: number; refineStone: number; inputCount: number } {
    return {
      copper: FORGE_COPPER_COST[type], enhanceStone: FORGE_STONE_COST[type], refineStone: FORGE_REFINE_STONE_COST[type],
      inputCount: type === 'advanced' ? ADVANCED_FORGE_INPUT_COUNT : type === 'targeted' ? TARGETED_FORGE_INPUT_COUNT : BASIC_FORGE_INPUT_COUNT,
    };
  }

  getForgeCost(type: ForgeType): { copper: number; enhanceStone: number; refineStone: number } {
    return { copper: FORGE_COPPER_COST[type], enhanceStone: FORGE_STONE_COST[type], refineStone: FORGE_REFINE_STONE_COST[type] };
  }

  // ─────────────────────────────────────────────
  // 序列化
  // ─────────────────────────────────────────────

  serialize(): ForgeSaveData {
    return { pityState: this.pityManager.getState(), pity: this.pityManager.getState(), totalForgeCount: this.totalForgeCount };
  }

  deserialize(data: ForgeSaveData): void {
    this.pityManager.restore(data.pityState ?? { basicBluePity: 0, advancedPurplePity: 0, targetedGoldPity: 0 });
    this.totalForgeCount = data.totalForgeCount ?? 0;
  }
}
