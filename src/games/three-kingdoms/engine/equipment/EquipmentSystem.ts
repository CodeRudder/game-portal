/**
 * 装备域 — 装备管理聚合根
 *
 * 职责：装备生成、穿戴/卸下、属性计算、分解、图鉴、序列化
 * 背包管理委托给 EquipmentBagManager
 * 规则：可引用 core/equipment 下的类型和配置，禁止引用其他域的 System
 *
 * @module engine/equipment/EquipmentSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  EquipmentSlot, EquipmentRarity, EquipmentInstance, EquipmentSource,
  MainStat, SubStat, SpecialEffect, SubStatType,
  BagSortMode, BagFilter, BagOperationResult,
  DecomposeResult, BatchDecomposeResult, EquipmentSaveData,
  HeroEquipSlots, EquipResult, CampaignType, CodexEntry,
} from '../../core/equipment';
import {
  EQUIPMENT_SLOTS, EQUIPMENT_RARITIES, RARITY_ORDER,
  SLOT_MAIN_STAT_TYPE, SLOT_MAIN_STAT_BASE,
  SLOT_SUB_STAT_POOL, SLOT_SPECIAL_EFFECT_POOL,
  SLOT_NAME_PREFIXES, RARITY_NAME_PREFIX,
} from '../../core/equipment';
import {
  DEFAULT_BAG_CAPACITY, RARITY_ENHANCE_CAP,
  RARITY_MAIN_STAT_MULTIPLIER, RARITY_SUB_STAT_MULTIPLIER,
  RARITY_SUB_STAT_COUNT, RARITY_SPECIAL_EFFECT_CHANCE,
  ENHANCE_MAIN_STAT_FACTOR, ENHANCE_SUB_STAT_FACTOR,
  SUB_STAT_BASE_RANGE, SPECIAL_EFFECT_VALUE_RANGE,
  DECOMPOSE_COPPER_BASE, DECOMPOSE_STONE_BASE, DECOMPOSE_ENHANCE_BONUS,
  EQUIPMENT_SAVE_VERSION, TEMPLATE_MAP,
} from '../../core/equipment';
import { EquipmentBagManager } from './EquipmentBagManager';

// ─────────────────────────────────────────────
// 关卡掉落权重
// ─────────────────────────────────────────────

const CAMPAIGN_DROP_WEIGHTS: Record<CampaignType, Record<EquipmentRarity, number>> = {
  normal: { white: 60, green: 30, blue: 8, purple: 2, gold: 0 },
  elite: { white: 30, green: 40, blue: 22, purple: 7, gold: 1 },
  boss: { white: 10, green: 25, blue: 35, purple: 22, gold: 8 },
};

const SOURCE_RARITY_WEIGHTS: Record<string, Record<EquipmentRarity, number>> = {
  equipment_box: { white: 0, green: 0, blue: 20, purple: 55, gold: 25 },
  event: { white: 0, green: 0, blue: 40, purple: 45, gold: 15 },
};

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

let _uidCounter = 0;

/** 生成唯一ID */
function generateUid(): string {
  return `eq_${Date.now()}_${(_uidCounter++).toString(36).padStart(4, '0')}_${Math.random().toString(36).slice(2, 6)}`;
}

/** 重置UID计数器（测试用） */
export function resetUidCounter(): void {
  _uidCounter = 0;
}

/** 范围内随机整数 */
function randInt(min: number, max: number, seed: number): number {
  return min + (seed % (max - min + 1));
}

/** 范围内随机浮点 */
function randFloat(min: number, max: number, seed: number): number {
  const norm = ((seed * 9301 + 49297) % 233280) / 233280;
  return min + norm * (max - min);
}

/** 从数组中按种子选取 */
function seedPick<T>(arr: readonly T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

/** 根据权重和种子选取品质 */
function weightedPickRarity(weights: Record<string, number>, seed: number): string {
  const entries = Object.entries(weights);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  if (total === 0) return entries[0]?.[0] ?? 'white';
  let roll = ((seed * 9301 + 49297) % 233280) / 233280 * total;
  for (const [key, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

// ─────────────────────────────────────────────
// EquipmentSystem
// ─────────────────────────────────────────────

export class EquipmentSystem implements ISubsystem {
  readonly name = 'equipment';
  private deps: ISystemDeps | null = null;

  /** 背包管理器 */
  private bag: EquipmentBagManager;
  /** 武将装备栏 heroId → HeroEquipSlots */
  private heroEquips: Map<string, HeroEquipSlots> = new Map();
  /** 装备图鉴 templateId → CodexEntry */
  private codex: Map<string, CodexEntry> = new Map();
  /** 内部种子计数器 */
  private seedCounter = 0;

  constructor() {
    this.bag = new EquipmentBagManager(
      (event, payload) => this.emitEvent(event, payload),
      (templateId) => TEMPLATE_MAP.get(templateId) as { setId?: string } | undefined,
    );
  }

  // ─── ISubsystem 接口 ───────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  update(_dt: number): void {
    // 装备系统无 tick 逻辑
  }

  getState(): EquipmentSaveData {
    return this.serialize();
  }

  reset(): void {
    this.bag.reset();
    this.heroEquips.clear();
    this.codex.clear();
    this.seedCounter = 0;
  }

  // ─────────────────────────────────────────────
  // 装备生成
  // ─────────────────────────────────────────────

  /**
   * 生成装备（双签名）
   * - generateEquipment(slot, rarity, source?, seed?) — 按部位+品质
   * - generateEquipment(templateId, rarity) — 按模板
   */
  generateEquipment(
    slotOrTemplateId: EquipmentSlot | string,
    rarity: EquipmentRarity,
    source: EquipmentSource = 'campaign_drop',
    seed?: number,
  ): EquipmentInstance | null {
    const usedSeed = seed ?? (Date.now() + this.seedCounter++);
    let eq: EquipmentInstance | null;
    if (this.isSlot(slotOrTemplateId)) {
      eq = this.generateBySlot(slotOrTemplateId, rarity, source, usedSeed);
    } else {
      eq = this.generateByTemplate(slotOrTemplateId, rarity, usedSeed);
    }
    if (eq) this.addToBag(eq);
    return eq;
  }

  /** 关卡掉落生成 */
  generateCampaignDrop(campaignType: CampaignType, seed?: number): EquipmentInstance {
    const usedSeed = seed ?? (Date.now() + this.seedCounter++);
    const weights = CAMPAIGN_DROP_WEIGHTS[campaignType];
    const rarity = weightedPickRarity(weights, usedSeed) as EquipmentRarity;
    const slot = seedPick(EQUIPMENT_SLOTS, usedSeed + 1) as EquipmentSlot;
    const eq = this.generateBySlot(slot, rarity, 'campaign_drop', usedSeed + 2)!;
    this.addToBag(eq);
    return eq;
  }

  /** 按来源生成（装备箱/活动） */
  generateFromSource(source: EquipmentSource, seed?: number): EquipmentInstance {
    const usedSeed = seed ?? (Date.now() + this.seedCounter++);
    const weights = SOURCE_RARITY_WEIGHTS[source] ?? CAMPAIGN_DROP_WEIGHTS.normal;
    const rarity = weightedPickRarity(weights, usedSeed) as EquipmentRarity;
    const slot = seedPick(EQUIPMENT_SLOTS, usedSeed + 1) as EquipmentSlot;
    const eq = this.generateBySlot(slot, rarity, source, usedSeed + 2)!;
    this.addToBag(eq);
    return eq;
  }

  // ─────────────────────────────────────────────
  // 属性计算
  // ─────────────────────────────────────────────

  /** 计算主属性值 */
  calculateMainStatValue(eq: EquipmentInstance | { mainStat: MainStat; rarity: EquipmentRarity; enhanceLevel: number }): number {
    const rarityMul = RARITY_MAIN_STAT_MULTIPLIER[eq.rarity];
    return Math.floor(eq.mainStat.baseValue * rarityMul * (1 + eq.enhanceLevel * ENHANCE_MAIN_STAT_FACTOR.min));
  }

  /** 计算副属性值 */
  calculateSubStatValue(subStat: SubStat, rarity: EquipmentRarity, enhanceLevel: number): number {
    const rarityMul = RARITY_SUB_STAT_MULTIPLIER[rarity];
    return Math.floor(subStat.baseValue * rarityMul * (1 + enhanceLevel * ENHANCE_SUB_STAT_FACTOR.min));
  }

  /** 重算装备属性（别名） */
  recalcStats(eq: EquipmentInstance): EquipmentInstance {
    return this.recalculateStats(eq);
  }

  /** 重算装备所有属性 */
  recalculateStats(eq: EquipmentInstance): EquipmentInstance {
    const mainValue = this.calculateMainStatValue(eq);
    const subStats = eq.subStats.map(ss => ({
      ...ss,
      value: this.calculateSubStatValue(ss, eq.rarity, eq.enhanceLevel),
    }));
    return { ...eq, mainStat: { ...eq.mainStat, value: mainValue }, subStats };
  }

  /** 计算装备战力评分 */
  calculatePower(eq: EquipmentInstance): number {
    const updated = this.recalculateStats(eq);
    let power = updated.mainStat.value;
    for (const ss of updated.subStats) power += ss.value;
    if (updated.specialEffect) power += updated.specialEffect.value * 5;
    power += RARITY_ORDER[updated.rarity] * 10;
    return Math.floor(power);
  }

  // ─────────────────────────────────────────────
  // 品质判定
  // ─────────────────────────────────────────────

  getEnhanceCap(rarity: EquipmentRarity): number { return RARITY_ENHANCE_CAP[rarity]; }
  canEnhanceTo(rarity: EquipmentRarity, level: number): boolean { return level <= RARITY_ENHANCE_CAP[rarity]; }
  compareRarity(a: EquipmentRarity, b: EquipmentRarity): number { return RARITY_ORDER[a] - RARITY_ORDER[b]; }
  rollRarity(weights: Record<string, number>, seed: number): EquipmentRarity { return weightedPickRarity(weights, seed) as EquipmentRarity; }

  // ─────────────────────────────────────────────
  // 背包管理（委托给 EquipmentBagManager）
  // ─────────────────────────────────────────────

  addToBag(equipment: EquipmentInstance): BagOperationResult {
    const result = this.bag.add(equipment);
    if (result.success && this.bag.get(equipment.uid)) this.updateCodex(equipment);
    return result;
  }

  removeEquipment(uid: string): boolean { return this.bag.remove(uid); }
  removeFromBag(uid: string): BagOperationResult { return this.bag.removeFromBag(uid); }
  getEquipment(uid: string): EquipmentInstance | undefined { return this.bag.get(uid); }
  updateEquipment(eq: EquipmentInstance): void { this.bag.update(eq); }
  getAllEquipments(): EquipmentInstance[] { return this.bag.getAll(); }
  getBagUsedCount(): number { return this.bag.getUsedCount(); }
  getBagSize(): number { return this.bag.getSize(); }
  getBagCapacity(): number { return this.bag.getCapacity(); }
  isBagFull(): boolean { return this.bag.isFull(); }
  expandBag(): BagOperationResult { return this.bag.expand(); }
  sortEquipments(mode: BagSortMode, list?: EquipmentInstance[]): EquipmentInstance[] { return this.bag.sort(mode, list); }
  getSortedEquipments(mode: BagSortMode): EquipmentInstance[] { return this.bag.sort(mode); }
  filterEquipments(filter: BagFilter): EquipmentInstance[] { return this.bag.filter(filter); }
  getFilteredEquipments(filter: BagFilter): EquipmentInstance[] { return this.bag.filter(filter); }
  groupBySlot(): Record<string, EquipmentInstance[]> { return this.bag.groupBySlot(); }

  // ─────────────────────────────────────────────
  // 穿戴/卸下
  // ─────────────────────────────────────────────

  markEquipped(uid: string, heroId: string): BagOperationResult {
    const eq = this.bag.get(uid);
    if (!eq) return { success: false, reason: '装备不存在' };
    if (eq.isEquipped) return { success: false, reason: '装备已被穿戴' };
    eq.isEquipped = true;
    eq.equippedHeroId = heroId;
    return { success: true };
  }

  markUnequipped(uid: string): BagOperationResult {
    const eq = this.bag.get(uid);
    if (!eq) return { success: false, reason: '装备不存在' };
    if (!eq.isEquipped) return { success: false, reason: '装备未被穿戴' };
    eq.isEquipped = false;
    eq.equippedHeroId = null;
    return { success: true };
  }

  equipItem(heroId: string, equipmentUid: string): EquipResult {
    const eq = this.bag.get(equipmentUid);
    if (!eq) return { success: false, reason: '装备不存在' };
    if (eq.isEquipped && eq.equippedHeroId !== heroId) return { success: false, reason: '装备已被其他武将穿戴' };

    let slots = this.heroEquips.get(heroId);
    if (!slots) {
      slots = { weapon: null, armor: null, accessory: null, mount: null };
      this.heroEquips.set(heroId, slots);
    }

    let replacedUid: string | undefined;
    const existingUid = slots[eq.slot];
    if (existingUid && existingUid !== equipmentUid) {
      const oldEq = this.bag.get(existingUid);
      if (oldEq) { oldEq.isEquipped = false; oldEq.equippedHeroId = null; }
      replacedUid = existingUid;
    }

    slots[eq.slot] = equipmentUid;
    eq.isEquipped = true;
    eq.equippedHeroId = heroId;
    return { success: true, replacedUid };
  }

  unequipItem(heroId: string, slot: EquipmentSlot): EquipResult {
    const slots = this.heroEquips.get(heroId);
    if (!slots) return { success: false, reason: '武将无装备栏' };
    const uid = slots[slot];
    if (!uid) return { success: false, reason: '该部位无装备' };
    const eq = this.bag.get(uid);
    if (eq) { eq.isEquipped = false; eq.equippedHeroId = null; }
    slots[slot] = null;
    return { success: true };
  }

  getHeroEquips(heroId: string): HeroEquipSlots {
    const slots = this.heroEquips.get(heroId);
    if (!slots) return { weapon: null, armor: null, accessory: null, mount: null };
    return { ...slots };
  }

  getHeroEquipItems(heroId: string): (EquipmentInstance | null)[] {
    const slots = this.heroEquips.get(heroId);
    if (!slots) return [null, null, null, null];
    return EQUIPMENT_SLOTS.map(slot => {
      const uid = slots[slot];
      return uid ? (this.bag.get(uid) ?? null) : null;
    });
  }

  getHeroEquipments(heroId: string): EquipmentInstance[] {
    const slots = this.heroEquips.get(heroId);
    if (!slots) return [];
    const result: EquipmentInstance[] = [];
    for (const slot of EQUIPMENT_SLOTS) {
      const uid = slots[slot];
      if (uid) { const eq = this.bag.get(uid); if (eq) result.push(eq); }
    }
    return result;
  }

  // ─────────────────────────────────────────────
  // 装备分解
  // ─────────────────────────────────────────────

  calculateDecomposeReward(eq: EquipmentInstance): DecomposeResult {
    const enhanceBonus = 1 + eq.enhanceLevel * DECOMPOSE_ENHANCE_BONUS;
    return {
      copper: Math.floor(DECOMPOSE_COPPER_BASE[eq.rarity] * enhanceBonus),
      enhanceStone: Math.floor(DECOMPOSE_STONE_BASE[eq.rarity] * enhanceBonus),
    };
  }

  getDecomposePreview(uid: string): DecomposeResult | null {
    const eq = this.bag.get(uid);
    if (!eq) return null;
    return this.calculateDecomposeReward(eq);
  }

  private decomposeSingle(uid: string): { success: boolean; result?: DecomposeResult; reason?: string } {
    const eq = this.bag.get(uid);
    if (!eq) return { success: false, reason: '装备不存在' };
    if (eq.isEquipped) return { success: false, reason: '已穿戴装备不可分解' };
    const reward = this.calculateDecomposeReward(eq);
    this.bag.removeFromBag(uid);
    this.emitEvent('equipment:decomposed', { uid, reward });
    return { success: true, result: reward };
  }

  decompose(uidOrUids: string | string[]): { success: boolean; result?: DecomposeResult; reason?: string } | BatchDecomposeResult {
    if (Array.isArray(uidOrUids)) return this.batchDecompose(uidOrUids);
    return this.decomposeSingle(uidOrUids);
  }

  batchDecompose(uids: string[]): BatchDecomposeResult {
    const total: DecomposeResult = { copper: 0, enhanceStone: 0 };
    const decomposedUids: string[] = [];
    const skippedUids: string[] = [];
    for (const uid of uids) {
      const r = this.decomposeSingle(uid);
      if ('success' in r && r.success && r.result) {
        total.copper += r.result.copper;
        total.enhanceStone += r.result.enhanceStone;
        decomposedUids.push(uid);
      } else { skippedUids.push(uid); }
    }
    return { total, decomposedUids, skippedUids };
  }

  decomposeAllUnequipped(): BatchDecomposeResult {
    const uids = this.getAllEquipments().filter(e => !e.isEquipped).map(e => e.uid);
    return this.batchDecompose(uids);
  }

  // ─────────────────────────────────────────────
  // 图鉴
  // ─────────────────────────────────────────────

  isCodexDiscovered(templateId: string): boolean { return this.codex.has(templateId); }
  getCodexEntry(templateId: string): CodexEntry | null { return this.codex.get(templateId) ?? null; }

  // ─────────────────────────────────────────────
  // 序列化
  // ─────────────────────────────────────────────

  serialize(): EquipmentSaveData {
    return {
      version: EQUIPMENT_SAVE_VERSION,
      equipments: Array.from(this.bag.getMap().values()),
      bagCapacity: this.bag.getCapacity(),
    };
  }

  deserialize(data: EquipmentSaveData): void {
    this.bag.reset();
    this.heroEquips.clear();
    this.bag.setCapacity(data.bagCapacity ?? DEFAULT_BAG_CAPACITY);
    for (const eq of data.equipments ?? []) {
      this.bag.getMap().set(eq.uid, eq);
      if (eq.isEquipped && eq.equippedHeroId) {
        let slots = this.heroEquips.get(eq.equippedHeroId);
        if (!slots) {
          slots = { weapon: null, armor: null, accessory: null, mount: null };
          this.heroEquips.set(eq.equippedHeroId, slots);
        }
        slots[eq.slot] = eq.uid;
      }
      this.updateCodex(eq);
    }
    if (data.version !== EQUIPMENT_SAVE_VERSION) {
      console.warn(`EquipmentSystem: 存档版本 ${data.version} ≠ 当前版本 ${EQUIPMENT_SAVE_VERSION}`);
    }
  }

  // ─────────────────────────────────────────────
  // 私有方法
  // ─────────────────────────────────────────────

  private isSlot(value: string): value is EquipmentSlot {
    return (EQUIPMENT_SLOTS as readonly string[]).includes(value);
  }

  private generateBySlot(slot: EquipmentSlot, rarity: EquipmentRarity, source: EquipmentSource, seed: number): EquipmentInstance {
    const uid = generateUid();
    const mainStat = this.genMainStat(slot, rarity, seed);
    const subStats = this.genSubStats(slot, rarity, seed + 100);
    const specialEffect = this.genSpecialEffect(slot, rarity, seed + 200);
    const namePrefix = RARITY_NAME_PREFIX[rarity];
    const baseName = seedPick(SLOT_NAME_PREFIXES[slot], seed + 300);
    return {
      uid, templateId: `tpl_${slot}_${rarity}`, name: namePrefix ? `${namePrefix}${baseName}` : baseName,
      slot, rarity, enhanceLevel: 0, mainStat, subStats, specialEffect,
      source, acquiredAt: Date.now(), isEquipped: false, equippedHeroId: null, seed,
    };
  }

  private generateByTemplate(templateId: string, rarity: EquipmentRarity, seed: number): EquipmentInstance | null {
    const tpl = TEMPLATE_MAP.get(templateId);
    if (!tpl) return null;
    const uid = generateUid();
    const mainStat: MainStat = {
      type: tpl.mainStatType, baseValue: tpl.baseMainStat,
      value: Math.floor(tpl.baseMainStat * RARITY_MAIN_STAT_MULTIPLIER[rarity]),
    };
    const [minC, maxC] = RARITY_SUB_STAT_COUNT[rarity];
    const count = minC + (seed % (maxC - minC + 1));
    const subStats: SubStat[] = [];
    for (let i = 0; i < Math.min(count, tpl.subStatPool.length); i++) {
      const statType = tpl.subStatPool[(seed + i) % tpl.subStatPool.length];
      const range = SUB_STAT_BASE_RANGE[statType];
      const baseValue = randFloat(range.min, range.max, seed + i + 50);
      subStats.push({ type: statType, baseValue: Math.floor(baseValue), value: Math.floor(baseValue * RARITY_SUB_STAT_MULTIPLIER[rarity]) });
    }
    return {
      uid, templateId: tpl.id, name: `${RARITY_NAME_PREFIX[rarity]}${tpl.name}`,
      slot: tpl.slot, rarity, enhanceLevel: 0, mainStat, subStats,
      specialEffect: this.genSpecialEffect(tpl.slot, rarity, seed + 200),
      source: 'forge', acquiredAt: Date.now(), isEquipped: false, equippedHeroId: null, seed,
    };
  }

  private genMainStat(slot: EquipmentSlot, rarity: EquipmentRarity, seed: number): MainStat {
    const type = SLOT_MAIN_STAT_TYPE[slot];
    const range = SLOT_MAIN_STAT_BASE[slot];
    const baseValue = randInt(range.min, range.max, seed);
    return { type, baseValue, value: Math.floor(baseValue * RARITY_MAIN_STAT_MULTIPLIER[rarity]) };
  }

  private genSubStats(slot: EquipmentSlot, rarity: EquipmentRarity, seed: number): SubStat[] {
    const [minC, maxC] = RARITY_SUB_STAT_COUNT[rarity];
    const count = minC === maxC ? minC : minC + (seed % (maxC - minC + 1));
    const pool = SLOT_SUB_STAT_POOL[slot];
    const result: SubStat[] = [];
    const used = new Set<SubStatType>();
    for (let i = 0; i < count && i < pool.length; i++) {
      const idx = Math.abs(seed + i * 7) % pool.length;
      const statType = pool[idx];
      if (used.has(statType)) continue;
      used.add(statType);
      const range = SUB_STAT_BASE_RANGE[statType];
      const baseValue = randFloat(range.min, range.max, seed + i * 13);
      result.push({ type: statType, baseValue: Math.floor(baseValue), value: Math.floor(baseValue * RARITY_SUB_STAT_MULTIPLIER[rarity]) });
    }
    return result;
  }

  private genSpecialEffect(slot: EquipmentSlot, rarity: EquipmentRarity, seed: number): SpecialEffect | null {
    const chance = RARITY_SPECIAL_EFFECT_CHANCE[rarity];
    if (chance <= 0) return null;
    const roll = ((seed * 9301 + 49297) % 233280) / 233280;
    if (roll >= chance) return null;
    const pool = SLOT_SPECIAL_EFFECT_POOL[slot];
    const effectType = pool[Math.abs(seed) % pool.length];
    const range = SPECIAL_EFFECT_VALUE_RANGE[effectType];
    const value = randFloat(range.min, range.max, seed + 77);
    return { type: effectType, value: Math.floor(value * 10) / 10, description: `${effectType} +${Math.floor(value)}%` };
  }

  private updateCodex(eq: EquipmentInstance): void {
    const tid = eq.templateId;
    const existing = this.codex.get(tid);
    if (existing) {
      existing.obtainCount++;
      if (RARITY_ORDER[eq.rarity] > RARITY_ORDER[existing.bestRarity ?? 'white']) existing.bestRarity = eq.rarity;
    } else {
      this.codex.set(tid, { templateId: tid, discovered: true, bestRarity: eq.rarity, obtainCount: 1 });
    }
  }

  private emitEvent(event: string, payload: unknown): void {
    if (this.deps?.eventBus) (this.deps.eventBus as any).emit(event, payload);
  }
}
