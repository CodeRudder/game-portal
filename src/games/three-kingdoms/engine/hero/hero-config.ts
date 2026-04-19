/**
 * 武将域 — 数值配置
 *
 * 规则：零逻辑，只有常量和数据结构
 * 数值来源：HER-heroes-prd.md
 *
 * @module engine/hero/hero-config
 */

import type {
  Quality,
  GeneralStats,
  Faction,
  SkillData,
  QualityProbability,
  LevelExpTier,
} from './hero.types';
import { Quality as Q } from './hero.types';

// ─────────────────────────────────────────────
// 1. 品质倍率表
// ─────────────────────────────────────────────

/**
 * 各品质的属性倍率
 *
 * 用于战力计算和属性成长。品质越高，倍率越大。
 * PRD 中基础属性范围：普通60~75 → 传说100~120
 */
export const QUALITY_MULTIPLIERS: Record<Quality, number> = {
  [Q.COMMON]: 1.0,
  [Q.FINE]: 1.15,
  [Q.RARE]: 1.3,
  [Q.EPIC]: 1.5,
  [Q.LEGENDARY]: 1.8,
};

// ─────────────────────────────────────────────
// 2. 品质概率表
// ─────────────────────────────────────────────

/**
 * 招募品质概率表
 *
 * 来源：PRD HER-2 招募概率
 * 普通招贤：普通60% / 精良30% / 稀有8% / 史诗2% / 传说0%
 * 高级招贤：普通20% / 精良40% / 稀有25% / 史诗13% / 传说2%
 */
export const QUALITY_PROBABILITIES: readonly QualityProbability[] = [
  { quality: Q.COMMON, normalRate: 0.60, advancedRate: 0.20 },
  { quality: Q.FINE, normalRate: 0.30, advancedRate: 0.40 },
  { quality: Q.RARE, normalRate: 0.08, advancedRate: 0.25 },
  { quality: Q.EPIC, normalRate: 0.02, advancedRate: 0.13 },
  { quality: Q.LEGENDARY, normalRate: 0.00, advancedRate: 0.02 },
] as const;

// ─────────────────────────────────────────────
// 3. 升级经验表
// ─────────────────────────────────────────────

/**
 * 等级段经验需求配置
 *
 * 来源：PRD HER-3 升级消耗
 * 经验需求 = 等级 × expPerLevel
 * 铜钱消耗 = 等级 × goldPerLevel
 */
export const LEVEL_EXP_TABLE: readonly LevelExpTier[] = [
  { levelMin: 1, levelMax: 10, expPerLevel: 50, goldPerLevel: 20 },
  { levelMin: 11, levelMax: 20, expPerLevel: 120, goldPerLevel: 50 },
  { levelMin: 21, levelMax: 30, expPerLevel: 250, goldPerLevel: 100 },
  { levelMin: 31, levelMax: 40, expPerLevel: 500, goldPerLevel: 200 },
  { levelMin: 41, levelMax: 50, expPerLevel: 1000, goldPerLevel: 400 },
] as const;

/** 武将等级上限 */
export const HERO_MAX_LEVEL = 50;

// ─────────────────────────────────────────────
// 4. 重复武将碎片转化表
// ─────────────────────────────────────────────

/**
 * 重复武将转化为碎片的数量
 *
 * 来源：PRD HER-2 重复武将处理
 */
export const DUPLICATE_FRAGMENT_COUNT: Record<Quality, number> = {
  [Q.COMMON]: 5,
  [Q.FINE]: 10,
  [Q.RARE]: 20,
  [Q.EPIC]: 40,
  [Q.LEGENDARY]: 80,
};

// ─────────────────────────────────────────────
// 5. 升星碎片消耗表
// ─────────────────────────────────────────────

/**
 * 升星所需碎片数量
 *
 * 来源：PRD HER-5 升星消耗
 * 星级范围：1~6 星
 */
export const STAR_UP_FRAGMENT_COST: readonly number[] = [
  0,    // 0→1 星（初始，无消耗）
  20,   // 1→2 星
  40,   // 2→3 星
  80,   // 3→4 星
  150,  // 4→5 星
  300,  // 5→6 星
];

/** 最大星级 */
export const MAX_STAR_LEVEL = 6;

// ─────────────────────────────────────────────
// 6. 战力计算系数
// ─────────────────────────────────────────────

/**
 * 战力计算公式参数
 *
 * 来源：PRD HER-1-3 战力计算
 *
 * 单将战力 = (ATK × w_atk + DEF × w_def + INT × w_int + SPD × w_spd)
 *            × 等级系数 × 品质系数
 *
 * 等级系数 = 1 + 等级 × 0.05
 * 品质系数 = QUALITY_MULTIPLIERS[quality]
 */
export const POWER_WEIGHTS = {
  /** 攻击力权重 */
  attack: 2.0,
  /** 防御力权重 */
  defense: 1.5,
  /** 智力权重 */
  intelligence: 2.0,
  /** 速度权重 */
  speed: 1.0,
} as const;

/** 等级系数公式中的每级增量 */
export const LEVEL_COEFFICIENT_PER_LEVEL = 0.05;

// ─────────────────────────────────────────────
// 7. 武将存档版本
// ─────────────────────────────────────────────

/** 武将存档数据版本号 */
export const HERO_SAVE_VERSION = 1;

// ─────────────────────────────────────────────
// 8. 武将数据配置
// ─────────────────────────────────────────────

/**
 * 武将静态数据定义
 *
 * 包含所有武将的基础属性、品质、阵营、技能等配置数据
 * 数值参考 PRD 品质基础属性范围：
 *   普通 60~75 / 精良 70~85 / 稀有 80~95 / 史诗 90~105 / 传说 100~120
 */
export interface GeneralDef {
  /** 武将唯一ID */
  id: string;
  /** 武将名称 */
  name: string;
  /** 武将品质 */
  quality: Quality;
  /** 所属阵营 */
  faction: Faction;
  /** 基础四维属性（Lv1时的属性） */
  baseStats: GeneralStats;
  /** 武将技能列表 */
  skills: SkillData[];
}

/**
 * 全部武将定义数据
 *
 * 至少包含10个三国经典武将，覆盖四个阵营
 */
export const GENERAL_DEFS: readonly GeneralDef[] = [
  // ── 蜀国 ──
  {
    id: 'liubei',
    name: '刘备',
    quality: Q.EPIC,
    faction: 'shu',
    baseStats: { attack: 78, defense: 85, intelligence: 82, speed: 72 },
    skills: [
      { id: 'liubei_01', name: '仁德', type: 'active', level: 1, description: '恢复己方全体生命值，回复量为刘备智力的120%' },
      { id: 'liubei_02', name: '蜀汉之主', type: 'faction', level: 1, description: '蜀国武将攻击+5%' },
    ],
  },
  {
    id: 'guanyu',
    name: '关羽',
    quality: Q.LEGENDARY,
    faction: 'shu',
    baseStats: { attack: 115, defense: 90, intelligence: 65, speed: 78 },
    skills: [
      { id: 'guanyu_01', name: '青龙偃月', type: 'active', level: 1, description: '对单体造成攻击力200%的物理伤害，无视30%防御' },
      { id: 'guanyu_02', name: '武圣', type: 'passive', level: 1, description: '暴击率+15%，暴击伤害+30%' },
    ],
  },
  {
    id: 'zhangfei',
    name: '张飞',
    quality: Q.EPIC,
    faction: 'shu',
    baseStats: { attack: 105, defense: 78, intelligence: 45, speed: 68 },
    skills: [
      { id: 'zhangfei_01', name: '怒吼长坂', type: 'active', level: 1, description: '对敌方前排造成攻击力160%的物理伤害，50%概率眩晕1回合' },
      { id: 'zhangfei_02', name: '万人敌', type: 'passive', level: 1, description: '生命值低于50%时攻击力+25%' },
    ],
  },
  {
    id: 'zhugeliang',
    name: '诸葛亮',
    quality: Q.LEGENDARY,
    faction: 'shu',
    baseStats: { attack: 68, defense: 72, intelligence: 118, speed: 88 },
    skills: [
      { id: 'zhugeliang_01', name: '空城计', type: 'active', level: 1, description: '对敌方全体造成智力150%的策略伤害，降低敌方攻击力20%持续2回合' },
      { id: 'zhugeliang_02', name: '卧龙', type: 'passive', level: 1, description: '每回合开始时为己方随机2人附加护盾，吸收智力50%的伤害' },
    ],
  },
  {
    id: 'zhaoyun',
    name: '赵云',
    quality: Q.LEGENDARY,
    faction: 'shu',
    baseStats: { attack: 108, defense: 95, intelligence: 72, speed: 98 },
    skills: [
      { id: 'zhaoyun_01', name: '龙胆', type: 'active', level: 1, description: '对单体造成攻击力180%的物理伤害，并回复自身生命值' },
      { id: 'zhaoyun_02', name: '一身是胆', type: 'passive', level: 1, description: '受到致命伤害时有30%概率免疫并恢复20%生命值' },
    ],
  },

  // ── 魏国 ──
  {
    id: 'caocao',
    name: '曹操',
    quality: Q.LEGENDARY,
    faction: 'wei',
    baseStats: { attack: 92, defense: 88, intelligence: 110, speed: 82 },
    skills: [
      { id: 'caocao_01', name: '奸雄', type: 'active', level: 1, description: '对敌方全体造成智力130%的策略伤害，偷取敌方10%攻击力持续2回合' },
      { id: 'caocao_02', name: '魏武挥鞭', type: 'faction', level: 1, description: '魏国武将防御+8%' },
    ],
  },
  {
    id: 'dianwei',
    name: '典韦',
    quality: Q.RARE,
    faction: 'wei',
    baseStats: { attack: 95, defense: 82, intelligence: 35, speed: 55 },
    skills: [
      { id: 'dianwei_01', name: '古之恶来', type: 'active', level: 1, description: '对单体造成攻击力170%的物理伤害' },
      { id: 'dianwei_02', name: '死战', type: 'passive', level: 1, description: '生命值越低攻击力越高，最高+40%' },
    ],
  },
  {
    id: 'simayi',
    name: '司马懿',
    quality: Q.EPIC,
    faction: 'wei',
    baseStats: { attack: 62, defense: 78, intelligence: 105, speed: 85 },
    skills: [
      { id: 'simayi_01', name: '鹰视狼顾', type: 'active', level: 1, description: '对敌方单体造成智力180%的策略伤害，附加灼烧效果持续2回合' },
      { id: 'simayi_02', name: '隐忍', type: 'passive', level: 1, description: '受到攻击时20%概率反弹50%伤害' },
    ],
  },

  // ── 吴国 ──
  {
    id: 'zhouyu',
    name: '周瑜',
    quality: Q.EPIC,
    faction: 'wu',
    baseStats: { attack: 75, defense: 70, intelligence: 100, speed: 90 },
    skills: [
      { id: 'zhouyu_01', name: '火烧赤壁', type: 'active', level: 1, description: '对敌方全体造成智力140%的策略伤害，附加灼烧效果' },
      { id: 'zhouyu_02', name: '雅量高致', type: 'passive', level: 1, description: '己方吴国武将智力+10%' },
    ],
  },

  // ── 群雄 ──
  {
    id: 'lvbu',
    name: '吕布',
    quality: Q.LEGENDARY,
    faction: 'qun',
    baseStats: { attack: 120, defense: 75, intelligence: 40, speed: 85 },
    skills: [
      { id: 'lvbu_01', name: '天下无双', type: 'active', level: 1, description: '对单体造成攻击力220%的物理伤害，无视50%防御' },
      { id: 'lvbu_02', name: '飞将', type: 'passive', level: 1, description: '攻击时额外造成目标当前生命值8%的真实伤害' },
    ],
  },
] as const;

/**
 * 武将定义查找表
 *
 * 以武将ID为键的快速查找映射
 */
export const GENERAL_DEF_MAP: Readonly<Map<string, GeneralDef>> = new Map(
  GENERAL_DEFS.map((def) => [def.id, def]),
);
