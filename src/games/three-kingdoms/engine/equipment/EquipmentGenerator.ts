/**
 * 装备生成器 — 纯函数工具集
 *
 * 职责：装备实例的生成（按部位/模板）、属性计算、UID 生成
 * 所有方法均为无副作用的纯函数，便于测试
 *
 * @module engine/equipment/EquipmentGenerator
 */

import type {
  EquipmentSlot,
  EquipmentRarity,
  EquipmentInstance,
  EquipmentSource,
  MainStat,
  SubStat,
  SpecialEffect,
  SubStatType,
} from '../../core/equipment';
import {
  EQUIPMENT_SLOTS,
  RARITY_ORDER,
  RARITY_MAIN_STAT_MULTIPLIER,
  RARITY_SUB_STAT_MULTIPLIER,
  RARITY_SUB_STAT_COUNT,
  RARITY_SPECIAL_EFFECT_CHANCE,
  SLOT_MAIN_STAT_TYPE,
  SLOT_MAIN_STAT_BASE,
  SLOT_SUB_STAT_POOL,
  SLOT_SPECIAL_EFFECT_POOL,
  SLOT_NAME_PREFIXES,
  RARITY_NAME_PREFIX,
  SUB_STAT_BASE_RANGE,
  SPECIAL_EFFECT_VALUE_RANGE,
  TEMPLATE_MAP,
} from '../../core/equipment';

// ─────────────────────────────────────────────
// UID 生成
// ─────────────────────────────────────────────

let _uidCounter = 0;

/** 生成唯一ID */
export function generateUid(): string {
  return `eq_${Date.now()}_${(_uidCounter++).toString(36).padStart(4, '0')}_${Math.random().toString(36).slice(2, 6)}`;
}

/** 重置UID计数器（测试用） */
export function resetUidCounter(): void {
  _uidCounter = 0;
}

// ─────────────────────────────────────────────
// 种子随机工具
// ─────────────────────────────────────────────

/** 范围内随机整数 */
export function randInt(min: number, max: number, seed: number): number {
  return min + (seed % (max - min + 1));
}

/** 范围内随机浮点 */
export function randFloat(min: number, max: number, seed: number): number {
  const norm = ((seed * 9301 + 49297) % 233280) / 233280;
  return min + norm * (max - min);
}

/** 从数组中按种子选取 */
export function seedPick<T>(arr: readonly T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

/** 根据权重和种子选取品质 */
export function weightedPickRarity(weights: Record<string, number>, seed: number): string {
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
// 装备生成
// ─────────────────────────────────────────────

/** 判断是否为装备部位 */
export function isSlot(value: string): value is EquipmentSlot {
  return (EQUIPMENT_SLOTS as readonly string[]).includes(value);
}

/** 按部位+品质生成装备实例 */
export function generateBySlot(
  slot: EquipmentSlot,
  rarity: EquipmentRarity,
  source: EquipmentSource,
  seed: number,
): EquipmentInstance {
  const uid = generateUid();
  const mainStat = genMainStat(slot, rarity, seed);
  const subStats = genSubStats(slot, rarity, seed + 100);
  const specialEffect = genSpecialEffect(slot, rarity, seed + 200);
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

/** 按模板生成装备实例 */
export function generateByTemplate(
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

  const specialEffect = genSpecialEffect(tpl.slot, rarity, seed + 200);

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

// ─────────────────────────────────────────────
// 属性生成
// ─────────────────────────────────────────────

/** 生成主属性 */
export function genMainStat(slot: EquipmentSlot, rarity: EquipmentRarity, seed: number): MainStat {
  const type = SLOT_MAIN_STAT_TYPE[slot];
  const range = SLOT_MAIN_STAT_BASE[slot];
  const baseValue = randInt(range.min, range.max, seed);
  const value = Math.floor(baseValue * RARITY_MAIN_STAT_MULTIPLIER[rarity]);
  return { type, baseValue, value };
}

/** 生成副属性列表 */
export function genSubStats(slot: EquipmentSlot, rarity: EquipmentRarity, seed: number): SubStat[] {
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

/** 生成特殊词条 */
export function genSpecialEffect(slot: EquipmentSlot, rarity: EquipmentRarity, seed: number): SpecialEffect | null {
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
