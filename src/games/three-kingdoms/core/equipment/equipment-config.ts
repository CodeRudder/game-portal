/**
 * 装备域 — 配置常量
 *
 * 装备模板、炼制权重、强化曲线、套装定义等配置数据
 * 规则：纯数据配置，零逻辑
 *
 * @module core/equipment/equipment-config
 */

import type { EquipmentRarity, EquipmentSlot, MainStatType, SubStatType } from './equipment.types';
import type { ForgeConfig, EnhanceConfig, EquipmentSetDef, SetId } from './equipment-forge.types';

// ─────────────────────────────────────────────
// 1. 装备模板
// ─────────────────────────────────────────────

/** 装备模板定义 */
export interface EquipmentTemplateDef {
  id: string;
  name: string;
  slot: EquipmentSlot;
  /** 主属性类型 */
  mainStatType: MainStatType;
  /** 主属性基础值（按品质倍率计算） */
  baseMainStat: number;
  /** 副属性池 */
  subStatPool: SubStatType[];
  /** 副属性数量范围 */
  subStatCount: [number, number];
  /** 所属套装（null=无套装） */
  setId: SetId | null;
  /** 最低掉落品质 */
  minRarity: EquipmentRarity;
}

/** 装备模板表 */
export const EQUIPMENT_TEMPLATES: EquipmentTemplateDef[] = [
  // 武器
  { id: 'sword_iron', name: '铁剑', slot: 'weapon', mainStatType: 'attack', baseMainStat: 10, subStatPool: ['critRate', 'critDamage', 'hitRate'], subStatCount: [1, 2], setId: 'warrior', minRarity: 'white' },
  { id: 'sword_steel', name: '钢剑', slot: 'weapon', mainStatType: 'attack', baseMainStat: 20, subStatPool: ['critRate', 'critDamage', 'hitRate'], subStatCount: [1, 3], setId: 'warrior', minRarity: 'green' },
  { id: 'sword_dragon', name: '龙渊剑', slot: 'weapon', mainStatType: 'attack', baseMainStat: 40, subStatPool: ['critRate', 'critDamage', 'hitRate'], subStatCount: [2, 3], setId: 'dragon', minRarity: 'blue' },
  { id: 'sword_overlord', name: '霸王剑', slot: 'weapon', mainStatType: 'attack', baseMainStat: 80, subStatPool: ['critRate', 'critDamage', 'hitRate'], subStatCount: [2, 4], setId: 'overlord', minRarity: 'purple' },
  // 防具
  { id: 'armor_leather', name: '皮甲', slot: 'armor', mainStatType: 'defense', baseMainStat: 8, subStatPool: ['dodgeRate', 'antiCritRate', 'hp'], subStatCount: [1, 2], setId: 'guardian', minRarity: 'white' },
  { id: 'armor_iron', name: '铁甲', slot: 'armor', mainStatType: 'defense', baseMainStat: 18, subStatPool: ['dodgeRate', 'antiCritRate', 'hp'], subStatCount: [1, 3], setId: 'guardian', minRarity: 'green' },
  { id: 'armor_dragon', name: '龙鳞甲', slot: 'armor', mainStatType: 'defense', baseMainStat: 36, subStatPool: ['dodgeRate', 'antiCritRate', 'hp'], subStatCount: [2, 3], setId: 'dragon', minRarity: 'blue' },
  { id: 'armor_phoenix', name: '凤羽甲', slot: 'armor', mainStatType: 'defense', baseMainStat: 70, subStatPool: ['dodgeRate', 'antiCritRate', 'hp'], subStatCount: [2, 4], setId: 'phoenix', minRarity: 'purple' },
  // 饰品
  { id: 'ring_jade', name: '玉佩', slot: 'accessory', mainStatType: 'intelligence', baseMainStat: 8, subStatPool: ['skillDamage', 'cooldownReduce', 'rageRecovery'], subStatCount: [1, 2], setId: 'scholar', minRarity: 'white' },
  { id: 'ring_gold', name: '金环', slot: 'accessory', mainStatType: 'intelligence', baseMainStat: 16, subStatPool: ['skillDamage', 'cooldownReduce', 'rageRecovery'], subStatCount: [1, 3], setId: 'scholar', minRarity: 'green' },
  { id: 'ring_dragon', name: '龙纹佩', slot: 'accessory', mainStatType: 'intelligence', baseMainStat: 32, subStatPool: ['skillDamage', 'cooldownReduce', 'rageRecovery'], subStatCount: [2, 3], setId: 'dragon', minRarity: 'blue' },
  // 坐骑
  { id: 'mount_horse', name: '战马', slot: 'mount', mainStatType: 'speed', baseMainStat: 6, subStatPool: ['movement', 'initiative', 'morale'], subStatCount: [1, 2], setId: 'swift', minRarity: 'white' },
  { id: 'mount_black', name: '乌骓马', slot: 'mount', mainStatType: 'speed', baseMainStat: 14, subStatPool: ['movement', 'initiative', 'morale'], subStatCount: [1, 3], setId: 'swift', minRarity: 'green' },
  { id: 'mount_redhare', name: '赤兔马', slot: 'mount', mainStatType: 'speed', baseMainStat: 30, subStatPool: ['movement', 'initiative', 'morale'], subStatCount: [2, 3], setId: 'overlord', minRarity: 'blue' },
];

/** 模板快速查找 Map */
export const TEMPLATE_MAP = new Map(EQUIPMENT_TEMPLATES.map(t => [t.id, t]));

// ─────────────────────────────────────────────
// 2. 品质倍率
// ─────────────────────────────────────────────

/** 品质主属性倍率 — 与PRD EQP-2对齐 */
export const RARITY_MAIN_STAT_MULTIPLIER: Record<EquipmentRarity, number> = {
  white: 1.0,
  green: 1.3,
  blue: 1.7,   // PRD: 1.7x
  purple: 2.2,  // PRD: 2.2x
  gold: 2.5,
};

/** 品质副属性倍率 — 与PRD EQP-2对齐 */
export const RARITY_SUB_STAT_MULTIPLIER: Record<EquipmentRarity, number> = {
  white: 0.5,   // PRD: 0.5x（原1.0x）
  green: 0.8,   // PRD: 0.8x（原1.2x）
  blue: 1.0,    // PRD: 1.0x（原1.5x）
  purple: 1.2,  // PRD: 1.2x（原2.0x）
  gold: 1.5,    // PRD: 1.5x（原2.8x）
};

/** 品质强化系数加成 */
export const RARITY_ENHANCE_BONUS: Record<EquipmentRarity, number> = {
  white: 0,
  green: 0.05,
  blue: 0.10,
  purple: 0.15,
  gold: 0.20,
};

// ─────────────────────────────────────────────
// 3. 炼制配置
// ─────────────────────────────────────────────

/** 基础炼制配置 */
export const BASIC_FORGE_CONFIG: ForgeConfig = {
  type: 'basic',
  cost: { copper: 500, enhanceStone: 1, refineStone: 0 },
  rarityWeights: { white: 60, green: 25, blue: 10, purple: 4, gold: 1 },
  targetSlot: null,
};

/** 高级炼制配置 */
export const ADVANCED_FORGE_CONFIG: ForgeConfig = {
  type: 'advanced',
  cost: { copper: 2000, enhanceStone: 3, refineStone: 1 },
  rarityWeights: { white: 10, green: 30, blue: 35, purple: 18, gold: 7 },
  targetSlot: null,
};

/** 定向炼制配置 */
export const TARGETED_FORGE_CONFIG: ForgeConfig = {
  type: 'targeted',
  cost: { copper: 5000, enhanceStone: 5, refineStone: 3 },
  rarityWeights: { white: 5, green: 15, blue: 35, purple: 30, gold: 15 },
  targetSlot: null, // 运行时指定
};

/** 保底阈值 */
export const FORGE_PITY_THRESHOLDS = {
  basicBluePity: 10,      // 基础炼制10次不出蓝品，下次保底蓝品
  advancedPurplePity: 10,  // 高级炼制10次不出紫品，下次保底紫品
  targetedGoldPity: 20,    // 定向炼制20次不出金品，下次保底金品
};

// ─────────────────────────────────────────────
// 4. 强化配置
// ─────────────────────────────────────────────

/** 强化成功率曲线（索引=强化等级）— 与PRD EQP-4对齐 */
export const ENHANCE_SUCCESS_RATES = [
  1.0,   // 0→1: 100%  (PRD: +1→+2 100%)
  1.0,   // 1→2: 100%  (PRD: +2→+3 100%)
  1.0,   // 2→3: 100%  (PRD: +3→+4 100%)
  0.80,  // 3→4: 80%   (PRD: +4→+5 80%)
  0.70,  // 4→5: 70%   (PRD: +5→+6 70%)
  0.55,  // 5→6: 55%   (PRD: +6→+7 55%)
  0.40,  // 6→7: 40%   (PRD: +7→+8 40%)
  0.30,  // 7→8: 30%   (PRD: +8→+9 30%)
  0.20,  // 8→9: 20%   (PRD: +9→+10 20%)
  0.10,  // 9→10: 10%  (PRD: +10→+11 10%)
  0.07,  // 10→11: 7%  (PRD: +11→+12 7%)
  0.05,  // 11→12: 5%  (PRD: +12→+13 5%)
  0.03,  // 12→13: 3%  (PRD: +13→+14 3%)
  0.02,  // 13→14: 2%  (PRD: +14→+15 2%)
  0.01,  // 14→15: 1%  (PRD未定义+15，沿用最低)
];

/** 强化系统配置 — 与PRD EQP-4对齐 */
export const ENHANCE_CONFIG: EnhanceConfig = {
  maxLevel: 15,
  safeLevel: 5,
  successRates: ENHANCE_SUCCESS_RATES,
  downgradeChance: 0.5,  // PRD: 失败50%概率降1级
  protectionCost: { 6: 1, 7: 1, 8: 2, 9: 2, 10: 3, 11: 3, 12: 4, 13: 5, 14: 5, 15: 6 },
  costConfig: {
    baseCopper: 100,
    copperGrowth: 1.5,
    baseStone: 1,
    stoneGrowth: 1.3,
  },
};

/** 强化每级属性增长 */
export const ENHANCE_STAT_GROWTH = 0.05; // 每级增长5%

// ─────────────────────────────────────────────
// 5. 套装定义
// ─────────────────────────────────────────────

/** 7套套装定义 */
export const EQUIPMENT_SETS: EquipmentSetDef[] = [
  {
    id: 'warrior', name: '战神套', description: '提升攻击与暴击', icon: '⚔️',
    minRarity: 'white',
    bonus2: { description: '攻击力+10%', bonuses: { attack: 0.10 } },
    bonus4: { description: '暴击率+15%，暴击伤害+25%', bonuses: { critRate: 0.15, critDamage: 0.25 } },
  },
  {
    id: 'guardian', name: '守护套', description: '提升防御与生命', icon: '🛡️',
    minRarity: 'white',
    bonus2: { description: '防御力+10%', bonuses: { defense: 0.10 } },
    bonus4: { description: '生命+20%，格挡率+10%', bonuses: { hp: 0.20, block: 0.10 } },
  },
  {
    id: 'scholar', name: '谋士套', description: '提升智力与技能', icon: '📖',
    minRarity: 'white',
    bonus2: { description: '智力+10%', bonuses: { intelligence: 0.10 } },
    bonus4: { description: '技能伤害+20%，冷却缩减+10%', bonuses: { skillDamage: 0.20, cooldownReduce: 0.10 } },
  },
  {
    id: 'swift', name: '疾风套', description: '提升速度与先攻', icon: '💨',
    minRarity: 'white',
    bonus2: { description: '速度+10%', bonuses: { speed: 0.10 } },
    bonus4: { description: '先攻值+25%，移动力+15%', bonuses: { initiative: 0.25, movement: 0.15 } },
  },
  {
    id: 'dragon', name: '龙魂套', description: '全属性均衡提升', icon: '🐉',
    minRarity: 'blue',
    bonus2: { description: '全属性+8%', bonuses: { attack: 0.08, defense: 0.08, intelligence: 0.08, speed: 0.08 } },
    bonus4: { description: '全属性+15%，额外吸血+5%', bonuses: { attack: 0.15, defense: 0.15, intelligence: 0.15, speed: 0.15, lifeSteal: 0.05 } },
  },
  {
    id: 'phoenix', name: '凤翼套', description: '强化防御与反伤', icon: '🔥',
    minRarity: 'blue',
    bonus2: { description: '防御+12%，生命+10%', bonuses: { defense: 0.12, hp: 0.10 } },
    bonus4: { description: '反伤+15%，韧性+20%', bonuses: { damageReflect: 0.15, tenacity: 0.20 } },
  },
  {
    id: 'overlord', name: '霸王套', description: '极致攻击与破甲', icon: '👑',
    minRarity: 'purple',
    bonus2: { description: '攻击+15%，破甲+10%', bonuses: { attack: 0.15, armorPen: 0.10 } },
    bonus4: { description: '攻击+25%，连击+15%，冲锋+10%', bonuses: { attack: 0.25, comboAttack: 0.15, charge: 0.10 } },
  },
];

/** 套装快速查找 Map */
export const SET_MAP = new Map(EQUIPMENT_SETS.map(s => [s.id, s]));

/** 所有套装ID */
export const SET_IDS: SetId[] = ['warrior', 'guardian', 'scholar', 'swift', 'dragon', 'phoenix', 'overlord'];

// ─────────────────────────────────────────────
// 6. 分解配置
// ─────────────────────────────────────────────

/** 品质分解产出 */
export const DECOMPOSE_OUTPUT: Record<EquipmentRarity, { copper: number; enhanceStone: number }> = {
  white: { copper: 50, enhanceStone: 1 },
  green: { copper: 150, enhanceStone: 2 },
  blue: { copper: 400, enhanceStone: 4 },
  purple: { copper: 1000, enhanceStone: 8 },
  gold: { copper: 2500, enhanceStone: 15 },
};

// ─────────────────────────────────────────────
// 7. 背包配置
// ─────────────────────────────────────────────

/** 默认背包容量 */
export const DEFAULT_BAG_CAPACITY = 50;

/** 背包扩容步长 */
export const BAG_EXPAND_STEP = 20;

/** 背包扩容费用（铜钱） */
export const BAG_EXPAND_COST = 500;

// ─────────────────────────────────────────────
// 8. 强化转移配置
// ─────────────────────────────────────────────

/** 强化转移费用系数（等级×系数） */
export const TRANSFER_COST_FACTOR = 200;

/** 强化转移等级损耗（-1级） */
export const TRANSFER_LEVEL_LOSS = 1;

// ─────────────────────────────────────────────
// 9. 部位→主属性映射
// ─────────────────────────────────────────────

import type { SpecialEffectType } from './equipment.types';

/** 各部位对应的主属性类型 */
export const SLOT_MAIN_STAT_TYPE: Record<EquipmentSlot, MainStatType> = {
  weapon: 'attack',
  armor: 'defense',
  accessory: 'intelligence',
  mount: 'speed',
};

/** 各部位主属性基础值范围 */
export const SLOT_MAIN_STAT_BASE: Record<EquipmentSlot, { min: number; max: number }> = {
  weapon: { min: 10, max: 30 },
  armor: { min: 8, max: 25 },
  accessory: { min: 8, max: 20 },
  mount: { min: 6, max: 18 },
};

/** 各部位副属性池 */
export const SLOT_SUB_STAT_POOL: Record<EquipmentSlot, SubStatType[]> = {
  weapon: ['critRate', 'critDamage', 'hitRate'],
  armor: ['dodgeRate', 'antiCritRate', 'hp'],
  accessory: ['skillDamage', 'cooldownReduce', 'rageRecovery'],
  mount: ['movement', 'initiative', 'morale'],
};

/** 各部位特殊词条池 */
export const SLOT_SPECIAL_EFFECT_POOL: Record<EquipmentSlot, SpecialEffectType[]> = {
  weapon: ['lifeSteal', 'armorPen', 'comboAttack'],
  armor: ['damageReflect', 'block', 'tenacity'],
  accessory: ['skillChain', 'rangeIncrease', 'controlEnhance'],
  mount: ['pursuit', 'retreat', 'charge'],
};

/** 各部位名称前缀 */
export const SLOT_NAME_PREFIXES: Record<EquipmentSlot, string[]> = {
  weapon: ['剑', '刀', '枪', '戟', '弓'],
  armor: ['甲', '铠', '袍', '盾', '衣'],
  accessory: ['佩', '环', '坠', '珠', '符'],
  mount: ['马', '骥', '驹', '骑', '鹿'],
};

// ─────────────────────────────────────────────
// 10. 品质名称前缀
// ─────────────────────────────────────────────

/** 品质名称前缀 */
export const RARITY_NAME_PREFIX: Record<EquipmentRarity, string> = {
  white: '',
  green: '良·',
  blue: '上·',
  purple: '精·',
  gold: '传·',
};

// ─────────────────────────────────────────────
// 11. 背包上限与扩容
// ─────────────────────────────────────────────

/** 最大背包容量 */
export const MAX_BAG_CAPACITY = 500;

/** 背包扩容步长（与 BAG_EXPAND_STEP 同义，兼容旧名称） */
export const BAG_EXPAND_INCREMENT = BAG_EXPAND_STEP;

// ─────────────────────────────────────────────
// 12. 品质强化上限
// ─────────────────────────────────────────────

/** 各品质强化等级上限 */
export const RARITY_ENHANCE_CAP: Record<EquipmentRarity, number> = {
  white: 5,
  green: 8,
  blue: 10,
  purple: 12,
  gold: 15,
};

// ─────────────────────────────────────────────
// 13. 品质副属性数量
// ─────────────────────────────────────────────

/** 各品质副属性数量范围 [最小, 最大] — 与PRD EQP-2对齐 */
export const RARITY_SUB_STAT_COUNT: Record<EquipmentRarity, [number, number]> = {
  white: [0, 1],   // PRD: 0~1条
  green: [1, 1],   // PRD: 1条
  blue: [1, 2],    // PRD: 1~2条（原2~3）
  purple: [2, 2],  // PRD: 2条（原3~4）
  gold: [2, 3],    // PRD: 2~3条（原4）
};

/** 各品质特殊词条概率 */
export const RARITY_SPECIAL_EFFECT_CHANCE: Record<EquipmentRarity, number> = {
  white: 0,
  green: 0,
  blue: 0.05,
  purple: 0.20,
  gold: 1.0,
};

// ─────────────────────────────────────────────
// 14. 强化属性系数
// ─────────────────────────────────────────────

/** 主属性强化系数范围 */
export const ENHANCE_MAIN_STAT_FACTOR = { min: 0.02, max: 0.05 };

/** 副属性强化系数范围 */
export const ENHANCE_SUB_STAT_FACTOR = { min: 0.01, max: 0.03 };

// ─────────────────────────────────────────────
// 15. 副属性基础值范围
// ─────────────────────────────────────────────

/** 各副属性类型基础值范围 */
export const SUB_STAT_BASE_RANGE: Record<SubStatType, { min: number; max: number }> = {
  critRate: { min: 1, max: 5 },
  critDamage: { min: 3, max: 10 },
  hitRate: { min: 2, max: 8 },
  dodgeRate: { min: 1, max: 5 },
  antiCritRate: { min: 2, max: 6 },
  hp: { min: 10, max: 50 },
  skillDamage: { min: 2, max: 8 },
  cooldownReduce: { min: 1, max: 5 },
  rageRecovery: { min: 2, max: 6 },
  movement: { min: 1, max: 4 },
  initiative: { min: 2, max: 8 },
  morale: { min: 1, max: 5 },
};

/** 各特殊词条类型效果值范围 */
export const SPECIAL_EFFECT_VALUE_RANGE: Record<SpecialEffectType, { min: number; max: number }> = {
  lifeSteal: { min: 2, max: 8 },
  armorPen: { min: 3, max: 10 },
  comboAttack: { min: 2, max: 6 },
  damageReflect: { min: 2, max: 8 },
  block: { min: 3, max: 10 },
  tenacity: { min: 2, max: 8 },
  skillChain: { min: 1, max: 5 },
  rangeIncrease: { min: 2, max: 6 },
  controlEnhance: { min: 2, max: 8 },
  pursuit: { min: 2, max: 6 },
  retreat: { min: 1, max: 4 },
  charge: { min: 3, max: 8 },
};

// ─────────────────────────────────────────────
// 16. 分解配置（兼容旧名称）
// ─────────────────────────────────────────────

/** 各品质分解铜钱产出 */
export const DECOMPOSE_COPPER_BASE: Record<EquipmentRarity, number> = {
  white: 50,
  green: 150,
  blue: 400,
  purple: 1000,
  gold: 2500,
};

/** 各品质分解强化石产出 */
export const DECOMPOSE_STONE_BASE: Record<EquipmentRarity, number> = {
  white: 1,
  green: 2,
  blue: 4,
  purple: 8,
  gold: 15,
};

/** 分解强化等级加成系数 */
export const DECOMPOSE_ENHANCE_BONUS = 0.1;

// ─────────────────────────────────────────────
// 17. 存档版本
// ─────────────────────────────────────────────

/** 装备存档版本号 */
export const EQUIPMENT_SAVE_VERSION = 1;
