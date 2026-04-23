/**
 * 装备域 — 装备管理聚合根
 *
 * 职责：装备生成、穿戴/卸下、属性计算、分解、图鉴、序列化
 * 背包管理委托给 EquipmentBagManager
 * 规则：可引用 core/equipment 下的类型和配置，禁止引用其他域的 System
 *
 * @module engine/equipment/EquipmentSystem
 */
export { generateUid, resetUidCounter, weightedPickRarity } from './equipment-reexports';


import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  EquipmentSlot, EquipmentRarity, EquipmentInstance, EquipmentSource,
  MainStat, SubStat, SpecialEffect,
  BagSortMode, BagFilter, BagOperationResult,
  DecomposeResult, BatchDecomposeResult, EquipmentSaveData,
  HeroEquipSlots, EquipResult, CampaignType, CodexEntry,
} from '../../core/equipment';
import {
  EQUIPMENT_SLOTS, EQUIPMENT_RARITIES, RARITY_ORDER,
  DEFAULT_BAG_CAPACITY, TEMPLATE_MAP,
} from '../../core/equipment';
import {
  RARITY_ENHANCE_CAP,
  EQUIPMENT_SAVE_VERSION,
  RARITY_MAIN_STAT_MULTIPLIER,
  RARITY_SUB_STAT_MULTIPLIER,
  ENHANCE_MAIN_STAT_FACTOR,
  ENHANCE_SUB_STAT_FACTOR,
} from '../../core/equipment';
import { EquipmentBagManager } from './EquipmentBagManager';
import { EquipmentDecomposer } from './EquipmentDecomposer';
import * as genHelper from './EquipmentGenHelper';
import { weightedPickRarity, seedPick } from './EquipmentGenHelper';
import { CAMPAIGN_DROP_WEIGHTS, SOURCE_RARITY_WEIGHTS } from './EquipmentDropWeights';
import { gameLog } from '../../core/logger';

// ─────────────────────────────────────────────
// 重新导出生成辅助函数（保持向后兼容）
export class EquipmentSystem implements ISubsystem {
  readonly name = 'equipment';
  private deps: ISystemDeps | null = null;

  /** 背包管理器 */
  private bag: EquipmentBagManager;
  /** 分解与图鉴管理器 */
  private decomposer: EquipmentDecomposer;
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
    this.decomposer = new EquipmentDecomposer(
      this.bag, this.codex, (event, payload) => this.emitEvent(event, payload),
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
  // 装备分解 — 委托到 EquipmentDecomposer
  // ─────────────────────────────────────────────

  calculateDecomposeReward(eq: EquipmentInstance): DecomposeResult {
    return this.decomposer.calculateDecomposeReward(eq);
  }

  getDecomposePreview(uid: string): DecomposeResult | null {
    return this.decomposer.getDecomposePreview(uid);
  }

  decompose(uidOrUids: string | string[]): { success: boolean; result?: DecomposeResult; reason?: string } | BatchDecomposeResult {
    return this.decomposer.decompose(uidOrUids);
  }

  batchDecompose(uids: string[]): BatchDecomposeResult {
    return this.decomposer.batchDecompose(uids);
  }

  decomposeAllUnequipped(): BatchDecomposeResult {
    return this.decomposer.decomposeAllUnequipped(() => this.getAllEquipments());
  }

  // ─────────────────────────────────────────────
  // 图鉴 — 委托到 EquipmentDecomposer
  // ─────────────────────────────────────────────

  isCodexDiscovered(templateId: string): boolean { return this.decomposer.isCodexDiscovered(templateId); }
  getCodexEntry(templateId: string): CodexEntry | null { return this.decomposer.getCodexEntry(templateId); }

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
      gameLog.warn(`EquipmentSystem: 存档版本 ${data.version} ≠ 当前版本 ${EQUIPMENT_SAVE_VERSION}`);
    }
  }

  // ─────────────────────────────────────────────
  // 私有方法 — 委托到 EquipmentGenHelper
  // ─────────────────────────────────────────────

  private isSlot(value: string): value is EquipmentSlot {
    return genHelper.isSlot(value);
  }

  private generateBySlot(slot: EquipmentSlot, rarity: EquipmentRarity, source: EquipmentSource, seed: number): EquipmentInstance {
    return genHelper.generateBySlot(slot, rarity, source, seed);
  }

  private generateByTemplate(templateId: string, rarity: EquipmentRarity, seed: number): EquipmentInstance | null {
    return genHelper.generateByTemplate(templateId, rarity, seed);
  }

  private genMainStat(slot: EquipmentSlot, rarity: EquipmentRarity, seed: number): MainStat {
    return genHelper.genMainStat(slot, rarity, seed);
  }

  private genSubStats(slot: EquipmentSlot, rarity: EquipmentRarity, seed: number): SubStat[] {
    return genHelper.genSubStats(slot, rarity, seed);
  }

  private genSpecialEffect(slot: EquipmentSlot, rarity: EquipmentRarity, seed: number): SpecialEffect | null {
    return genHelper.genSpecialEffect(slot, rarity, seed);
  }

  private updateCodex(eq: EquipmentInstance): void {
    this.decomposer.updateCodex(eq);
  }

  private emitEvent(event: string, payload: unknown): void {
    if (this.deps?.eventBus) this.deps.eventBus.emit(event, payload);
  }
}
