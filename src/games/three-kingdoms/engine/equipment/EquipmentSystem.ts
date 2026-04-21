/**
 * 装备域 — 装备管理聚合根
 *
 * 职责：装备生成、背包管理、穿戴/卸下、属性计算、分解、图鉴
 * 规则：可引用 core/equipment 下的类型和配置，禁止引用其他域的 System
 *
 * @module engine/equipment/EquipmentSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  EquipmentSlot,
  EquipmentRarity,
  EquipmentInstance,
  EquipmentSource,
  MainStat,
  SubStat,
  SpecialEffect,
  MainStatType,
  SubStatType,
  SpecialEffectType,
  BagSortMode,
  BagFilter,
  BagOperationResult,
  DecomposeResult,
  BatchDecomposeResult,
  EquipmentSaveData,
  HeroEquipSlots,
  EquipResult,
  CampaignType,
  CodexEntry,
} from '../../core/equipment';
import {
  EQUIPMENT_SLOTS,
  EQUIPMENT_RARITIES,
  RARITY_ORDER,
  SLOT_MAIN_STAT_TYPE,
  SLOT_MAIN_STAT_BASE,
  SLOT_SUB_STAT_POOL,
  SLOT_SPECIAL_EFFECT_POOL,
  SLOT_NAME_PREFIXES,
  RARITY_NAME_PREFIX,
} from '../../core/equipment';
import {
  DEFAULT_BAG_CAPACITY,
  MAX_BAG_CAPACITY,
  BAG_EXPAND_INCREMENT,
  BAG_EXPAND_COST,
  RARITY_ENHANCE_CAP,
  RARITY_MAIN_STAT_MULTIPLIER,
  RARITY_SUB_STAT_MULTIPLIER,
  RARITY_SUB_STAT_COUNT,
  RARITY_SPECIAL_EFFECT_CHANCE,
  ENHANCE_MAIN_STAT_FACTOR,
  ENHANCE_SUB_STAT_FACTOR,
  SUB_STAT_BASE_RANGE,
  SPECIAL_EFFECT_VALUE_RANGE,
  DECOMPOSE_COPPER_BASE,
  DECOMPOSE_STONE_BASE,
  DECOMPOSE_ENHANCE_BONUS,
  EQUIPMENT_SAVE_VERSION,
  EQUIPMENT_TEMPLATES,
  TEMPLATE_MAP,
} from '../../core/equipment';

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

  /** 背包装备列表 */
  private equipments: Map<string, EquipmentInstance> = new Map();
  /** 背包容量 */
  private bagCapacity: number = DEFAULT_BAG_CAPACITY;
  /** 武将装备栏 heroId → HeroEquipSlots */
  private heroEquips: Map<string, HeroEquipSlots> = new Map();
  /** 装备图鉴 templateId → CodexEntry */
  private codex: Map<string, CodexEntry> = new Map();
  /** 内部种子计数器 */
  private seedCounter = 0;

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
    this.equipments.clear();
    this.heroEquips.clear();
    this.codex.clear();
    this.bagCapacity = DEFAULT_BAG_CAPACITY;
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

    // 判断是部位还是模板ID
    let eq: EquipmentInstance | null;
    if (this.isSlot(slotOrTemplateId)) {
      eq = this.generateBySlot(slotOrTemplateId, rarity, source, usedSeed);
    } else {
      eq = this.generateByTemplate(slotOrTemplateId, rarity, usedSeed);
    }
    if (eq) {
      this.addToBag(eq);
    }
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
    const enhanceLevel = eq.enhanceLevel;
    return Math.floor(eq.mainStat.baseValue * rarityMul * (1 + enhanceLevel * ENHANCE_MAIN_STAT_FACTOR.min));
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

  /** 获取品质强化上限 */
  getEnhanceCap(rarity: EquipmentRarity): number {
    return RARITY_ENHANCE_CAP[rarity];
  }

  /** 判断是否可强化到指定等级 */
  canEnhanceTo(rarity: EquipmentRarity, level: number): boolean {
    return level <= RARITY_ENHANCE_CAP[rarity];
  }

  /** 比较品质高低 */
  compareRarity(a: EquipmentRarity, b: EquipmentRarity): number {
    return RARITY_ORDER[a] - RARITY_ORDER[b];
  }

  /** 根据权重随机品质 */
  rollRarity(weights: Record<string, number>, seed: number): EquipmentRarity {
    const result = weightedPickRarity(weights, seed);
    return result as EquipmentRarity;
  }

  // ─────────────────────────────────────────────
  // 背包管理
  // ─────────────────────────────────────────────

  /** 添加装备到背包 */
  addToBag(equipment: EquipmentInstance): BagOperationResult {
    if (this.equipments.size >= this.bagCapacity) {
      return { success: false, reason: '背包已满' };
    }
    if (this.equipments.has(equipment.uid)) {
      // 幂等：已存在视为成功
      return { success: true };
    }
    this.equipments.set(equipment.uid, equipment);
    this.emitEvent('equipment:added', { uid: equipment.uid });
    this.updateCodex(equipment);
    return { success: true };
  }

  /** 删除装备（removeFromBag 的别名） */
  removeEquipment(uid: string): boolean {
    const result = this.removeFromBag(uid);
    return result.success;
  }

  /** 从背包移除装备 */
  removeFromBag(uid: string): BagOperationResult {
    const eq = this.equipments.get(uid);
    if (!eq) return { success: false, reason: '装备不存在' };
    if (eq.isEquipped) return { success: false, reason: '已穿戴装备不可移除' };
    this.equipments.delete(uid);
    this.emitEvent('equipment:removed', { uid });
    return { success: true };
  }

  /** 按UID获取装备 */
  getEquipment(uid: string): EquipmentInstance | undefined {
    return this.equipments.get(uid);
  }

  /** 更新装备数据 */
  updateEquipment(eq: EquipmentInstance): void {
    if (this.equipments.has(eq.uid)) {
      this.equipments.set(eq.uid, eq);
    }
  }

  /** 获取所有装备 */
  getAllEquipments(): EquipmentInstance[] {
    return Array.from(this.equipments.values());
  }

  /** 获取背包已用数量 */
  getBagUsedCount(): number {
    return this.equipments.size;
  }

  /** 获取背包大小（别名） */
  getBagSize(): number {
    return this.equipments.size;
  }

  /** 获取背包容量 */
  getBagCapacity(): number {
    return this.bagCapacity;
  }

  /** 背包是否已满 */
  isBagFull(): boolean {
    return this.equipments.size >= this.bagCapacity;
  }

  /** 扩容背包 */
  expandBag(): BagOperationResult {
    if (this.bagCapacity >= MAX_BAG_CAPACITY) {
      return { success: false, reason: '已达最大容量' };
    }
    // 扣除扩容费用
    if (this.deps?.eventBus) {
      // 通过事件通知资源系统扣除铜钱
      // 如果有 CurrencySystem 可用，应在此检查并扣除
      // 此处发出事件让外部系统处理费用扣除
      (this.deps.eventBus as any).emit('equipment:bag_expand_cost', {
        cost: BAG_EXPAND_COST,
        currency: 'copper',
      });
    }
    this.bagCapacity = Math.min(this.bagCapacity + BAG_EXPAND_INCREMENT, MAX_BAG_CAPACITY);
    this.emitEvent('equipment:bag_expanded', { capacity: this.bagCapacity });
    return { success: true };
  }

  /** 排序装备 */
  sortEquipments(mode: BagSortMode, list?: EquipmentInstance[]): EquipmentInstance[] {
    const sorted = [...(list ?? this.getAllEquipments())];
    switch (mode) {
      case 'rarity_desc':
        sorted.sort((a, b) => RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity]);
        break;
      case 'rarity_asc':
        sorted.sort((a, b) => RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity]);
        break;
      case 'level_desc':
        sorted.sort((a, b) => b.enhanceLevel - a.enhanceLevel);
        break;
      case 'level_asc':
        sorted.sort((a, b) => a.enhanceLevel - b.enhanceLevel);
        break;
      case 'slot_type':
        sorted.sort((a, b) => EQUIPMENT_SLOTS.indexOf(a.slot) - EQUIPMENT_SLOTS.indexOf(b.slot));
        break;
      case 'acquired_time':
        sorted.sort((a, b) => a.acquiredAt - b.acquiredAt);
        break;
    }
    return sorted;
  }

  /** 获取排序后的装备（别名） */
  getSortedEquipments(mode: BagSortMode): EquipmentInstance[] {
    return this.sortEquipments(mode);
  }

  /** 筛选装备 */
  filterEquipments(filter: BagFilter): EquipmentInstance[] {
    let list = this.getAllEquipments();
    if (filter.slot) list = list.filter(e => e.slot === filter.slot);
    if (filter.rarity) list = list.filter(e => e.rarity === filter.rarity);
    if (filter.unequippedOnly) list = list.filter(e => !e.isEquipped);
    if (filter.setOnly) {
      list = list.filter(e => {
        const tpl = TEMPLATE_MAP.get(e.templateId);
        return tpl?.setId != null;
      });
    }
    return list;
  }

  /** 筛选装备（别名） */
  getFilteredEquipments(filter: BagFilter): EquipmentInstance[] {
    return this.filterEquipments(filter);
  }

  /** 按部位分组 */
  groupBySlot(): Record<string, EquipmentInstance[]> {
    const groups: Record<string, EquipmentInstance[]> = {
      weapon: [], armor: [], accessory: [], mount: [],
    };
    for (const eq of this.getAllEquipments()) {
      groups[eq.slot]?.push(eq);
    }
    return groups;
  }

  // ─────────────────────────────────────────────
  // 穿戴/卸下
  // ─────────────────────────────────────────────

  /** 标记装备为已穿戴 */
  markEquipped(uid: string, heroId: string): BagOperationResult {
    const eq = this.equipments.get(uid);
    if (!eq) return { success: false, reason: '装备不存在' };
    if (eq.isEquipped) return { success: false, reason: '装备已被穿戴' };
    eq.isEquipped = true;
    eq.equippedHeroId = heroId;
    return { success: true };
  }

  /** 标记装备为未穿戴 */
  markUnequipped(uid: string): BagOperationResult {
    const eq = this.equipments.get(uid);
    if (!eq) return { success: false, reason: '装备不存在' };
    if (!eq.isEquipped) return { success: false, reason: '装备未被穿戴' };
    eq.isEquipped = false;
    eq.equippedHeroId = null;
    return { success: true };
  }

  /** 穿戴装备到武将 */
  equipItem(heroId: string, equipmentUid: string): EquipResult {
    const eq = this.equipments.get(equipmentUid);
    if (!eq) return { success: false, reason: '装备不存在' };
    if (eq.isEquipped && eq.equippedHeroId !== heroId) {
      return { success: false, reason: '装备已被其他武将穿戴' };
    }

    let slots = this.heroEquips.get(heroId);
    if (!slots) {
      slots = { weapon: null, armor: null, accessory: null, mount: null };
      this.heroEquips.set(heroId, slots);
    }

    let replacedUid: string | undefined;
    const existingUid = slots[eq.slot];
    if (existingUid && existingUid !== equipmentUid) {
      const oldEq = this.equipments.get(existingUid);
      if (oldEq) {
        oldEq.isEquipped = false;
        oldEq.equippedHeroId = null;
      }
      replacedUid = existingUid;
    }

    slots[eq.slot] = equipmentUid;
    eq.isEquipped = true;
    eq.equippedHeroId = heroId;
    return { success: true, replacedUid };
  }

  /** 卸下武将装备 */
  unequipItem(heroId: string, slot: EquipmentSlot): EquipResult {
    const slots = this.heroEquips.get(heroId);
    if (!slots) return { success: false, reason: '武将无装备栏' };
    const uid = slots[slot];
    if (!uid) return { success: false, reason: '该部位无装备' };
    const eq = this.equipments.get(uid);
    if (eq) {
      eq.isEquipped = false;
      eq.equippedHeroId = null;
    }
    slots[slot] = null;
    return { success: true };
  }

  /** 获取武将装备栏 */
  getHeroEquips(heroId: string): HeroEquipSlots {
    const slots = this.heroEquips.get(heroId);
    if (!slots) return { weapon: null, armor: null, accessory: null, mount: null };
    return { ...slots };
  }

  /** 获取武将已穿戴装备列表（含null） */
  getHeroEquipItems(heroId: string): (EquipmentInstance | null)[] {
    const slots = this.heroEquips.get(heroId);
    if (!slots) return [null, null, null, null];
    return EQUIPMENT_SLOTS.map(slot => {
      const uid = slots[slot];
      return uid ? (this.equipments.get(uid) ?? null) : null;
    });
  }

  /** 获取武将已穿戴装备列表（不含null） */
  getHeroEquipments(heroId: string): EquipmentInstance[] {
    const slots = this.heroEquips.get(heroId);
    if (!slots) return [];
    const result: EquipmentInstance[] = [];
    for (const slot of EQUIPMENT_SLOTS) {
      const uid = slots[slot];
      if (uid) {
        const eq = this.equipments.get(uid);
        if (eq) result.push(eq);
      }
    }
    return result;
  }

  // ─────────────────────────────────────────────
  // 装备分解
  // ─────────────────────────────────────────────

  /** 计算分解产出 */
  calculateDecomposeReward(eq: EquipmentInstance): DecomposeResult {
    const enhanceBonus = 1 + eq.enhanceLevel * DECOMPOSE_ENHANCE_BONUS;
    return {
      copper: Math.floor(DECOMPOSE_COPPER_BASE[eq.rarity] * enhanceBonus),
      enhanceStone: Math.floor(DECOMPOSE_STONE_BASE[eq.rarity] * enhanceBonus),
    };
  }

  /** 分解预览 */
  getDecomposePreview(uid: string): DecomposeResult | null {
    const eq = this.equipments.get(uid);
    if (!eq) return null;
    return this.calculateDecomposeReward(eq);
  }

  /** 分解单件装备 */
  private decomposeSingle(uid: string): { success: boolean; result?: DecomposeResult; reason?: string } {
    const eq = this.equipments.get(uid);
    if (!eq) return { success: false, reason: '装备不存在' };
    if (eq.isEquipped) return { success: false, reason: '已穿戴装备不可分解' };

    const reward = this.calculateDecomposeReward(eq);
    this.equipments.delete(uid);
    this.emitEvent('equipment:decomposed', { uid, reward });
    return { success: true, result: reward };
  }

  /** 分解装备（单件或批量） */
  decompose(uidOrUids: string | string[]): { success: boolean; result?: DecomposeResult; reason?: string } | BatchDecomposeResult {
    if (Array.isArray(uidOrUids)) {
      return this.batchDecompose(uidOrUids);
    }
    return this.decomposeSingle(uidOrUids);
  }

  /** 批量分解 */
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
      } else {
        skippedUids.push(uid);
      }
    }
    return { total, decomposedUids, skippedUids };
  }

  /** 分解所有未穿戴装备 */
  decomposeAllUnequipped(): BatchDecomposeResult {
    const uids = this.getAllEquipments()
      .filter(e => !e.isEquipped)
      .map(e => e.uid);
    return this.batchDecompose(uids);
  }

  // ─────────────────────────────────────────────
  // 图鉴
  // ─────────────────────────────────────────────

  /** 图鉴是否已发现 */
  isCodexDiscovered(templateId: string): boolean {
    return this.codex.has(templateId);
  }

  /** 获取图鉴条目 */
  getCodexEntry(templateId: string): CodexEntry | null {
    return this.codex.get(templateId) ?? null;
  }

  // ─────────────────────────────────────────────
  // 序列化
  // ─────────────────────────────────────────────

  serialize(): EquipmentSaveData {
    return {
      version: EQUIPMENT_SAVE_VERSION,
      equipments: Array.from(this.equipments.values()),
      bagCapacity: this.bagCapacity,
    };
  }

  deserialize(data: EquipmentSaveData): void {
    this.equipments.clear();
    this.heroEquips.clear();
    this.bagCapacity = data.bagCapacity ?? DEFAULT_BAG_CAPACITY;
    for (const eq of data.equipments ?? []) {
      this.equipments.set(eq.uid, eq);
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

  /** 判断是否为装备部位 */
  private isSlot(value: string): value is EquipmentSlot {
    return (EQUIPMENT_SLOTS as readonly string[]).includes(value);
  }

  /** 按部位+品质生成装备 */
  private generateBySlot(
    slot: EquipmentSlot,
    rarity: EquipmentRarity,
    source: EquipmentSource,
    seed: number,
  ): EquipmentInstance {
    const uid = generateUid();
    const mainStat = this.genMainStat(slot, rarity, seed);
    const subStats = this.genSubStats(slot, rarity, seed + 100);
    const specialEffect = this.genSpecialEffect(slot, rarity, seed + 200);
    const namePrefix = RARITY_NAME_PREFIX[rarity];
    const baseName = seedPick(SLOT_NAME_PREFIXES[slot], seed + 300);
    const name = namePrefix ? `${namePrefix}${baseName}` : baseName;

    return {
      uid,
      templateId: `tpl_${slot}_${rarity}`,
      name,
      slot,
      rarity,
      enhanceLevel: 0,
      mainStat,
      subStats,
      specialEffect,
      source,
      acquiredAt: Date.now(),
      isEquipped: false,
      equippedHeroId: null,
      seed,
    };
  }

  /** 按模板生成装备 */
  private generateByTemplate(
    templateId: string,
    rarity: EquipmentRarity,
    seed: number,
  ): EquipmentInstance | null {
    const tpl = TEMPLATE_MAP.get(templateId);
    if (!tpl) return null;

    const uid = generateUid();
    const mainStat: MainStat = {
      type: tpl.mainStatType,
      baseValue: tpl.baseMainStat,
      value: Math.floor(tpl.baseMainStat * RARITY_MAIN_STAT_MULTIPLIER[rarity]),
    };

    const [minC, maxC] = RARITY_SUB_STAT_COUNT[rarity];
    const count = minC + (seed % (maxC - minC + 1));
    const subStats: SubStat[] = [];
    for (let i = 0; i < Math.min(count, tpl.subStatPool.length); i++) {
      const statType = tpl.subStatPool[(seed + i) % tpl.subStatPool.length];
      const range = SUB_STAT_BASE_RANGE[statType];
      const baseValue = randFloat(range.min, range.max, seed + i + 50);
      subStats.push({
        type: statType,
        baseValue: Math.floor(baseValue),
        value: Math.floor(baseValue * RARITY_SUB_STAT_MULTIPLIER[rarity]),
      });
    }

    const specialEffect = this.genSpecialEffect(tpl.slot, rarity, seed + 200);

    return {
      uid,
      templateId: tpl.id,
      name: `${RARITY_NAME_PREFIX[rarity]}${tpl.name}`,
      slot: tpl.slot,
      rarity,
      enhanceLevel: 0,
      mainStat,
      subStats,
      specialEffect,
      source: 'forge',
      acquiredAt: Date.now(),
      isEquipped: false,
      equippedHeroId: null,
      seed,
    };
  }

  private genMainStat(slot: EquipmentSlot, rarity: EquipmentRarity, seed: number): MainStat {
    const type = SLOT_MAIN_STAT_TYPE[slot];
    const range = SLOT_MAIN_STAT_BASE[slot];
    const baseValue = randInt(range.min, range.max, seed);
    const value = Math.floor(baseValue * RARITY_MAIN_STAT_MULTIPLIER[rarity]);
    return { type, baseValue, value };
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
      const value = Math.floor(baseValue * RARITY_SUB_STAT_MULTIPLIER[rarity]);
      result.push({ type: statType, baseValue: Math.floor(baseValue), value });
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
    return {
      type: effectType,
      value: Math.floor(value * 10) / 10,
      description: `${effectType} +${Math.floor(value)}%`,
    };
  }

  private updateCodex(eq: EquipmentInstance): void {
    const tid = eq.templateId;
    const existing = this.codex.get(tid);
    if (existing) {
      existing.obtainCount++;
      if (RARITY_ORDER[eq.rarity] > RARITY_ORDER[existing.bestRarity ?? 'white']) {
        existing.bestRarity = eq.rarity;
      }
    } else {
      this.codex.set(tid, {
        templateId: tid,
        discovered: true,
        bestRarity: eq.rarity,
        obtainCount: 1,
      });
    }
  }

  private emitEvent(event: string, payload: unknown): void {
    if (this.deps?.eventBus) {
      (this.deps.eventBus as any).emit(event, payload);
    }
  }
}
