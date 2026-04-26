/**
 * 武将觉醒系统 — 数值配置
 *
 * 规则：零逻辑，只有常量和数据结构
 * 数值来源：HER-heroes-prd.md §13 觉醒系统
 *
 * @module engine/hero/awakening-config
 */

import type { Quality, Faction } from './hero.types';
import { Quality as Q, QUALITY_ORDER } from './hero.types';

// ─────────────────────────────────────────────
// 1. 觉醒等级上限
// ─────────────────────────────────────────────

/** 觉醒后等级上限（从100提升至120） */
export const AWAKENING_MAX_LEVEL = 120;

/** 觉醒前等级上限（四阶突破后） */
export const PRE_AWAKENING_MAX_LEVEL = 100;

// ─────────────────────────────────────────────
// 2. 觉醒条件
// ─────────────────────────────────────────────

/**
 * 觉醒所需前置条件
 *
 * 来源：PRD HER-13.2 觉醒条件
 * - 等级 = 100（满级）
 * - 星级 = 6（满星）
 * - 突破阶段 = 4（满突破）
 * - 品质 ≥ RARE（稀有及以上）
 */
export const AWAKENING_REQUIREMENTS = {
  /** 武将等级要求 */
  minLevel: 100,
  /** 武将星级要求 */
  minStars: 6,
  /** 突破阶段要求 */
  minBreakthrough: 4,
  /** 最低品质要求（数值，用于比较 QUALITY_ORDER） */
  minQualityOrder: QUALITY_ORDER[Q.RARE],
} as const;

/**
 * 可觉醒品质列表
 *
 * COMMON/FINE 品质武将不可觉醒，引导玩家集中培养高品质武将
 */
export const AWAKENABLE_QUALITIES: readonly Quality[] = [Q.RARE, Q.EPIC, Q.LEGENDARY];

// ─────────────────────────────────────────────
// 3. 觉醒消耗
// ─────────────────────────────────────────────

/**
 * 觉醒所需资源消耗
 *
 * 来源：PRD HER-13.3 觉醒消耗
 * 单武将觉醒约需14~21天资源积累
 */
export const AWAKENING_COST = {
  /** 铜钱：约10天铜钱结余 */
  copper: 500000,
  /** 突破石：约5天突破石产出 */
  breakthroughStones: 100,
  /** 技能书：约6天技能书产出 */
  skillBooks: 50,
  /** 觉醒石：新资源，觉醒副本和赛季排行获取 */
  awakeningStones: 30,
  /** 同名武将碎片 */
  fragments: 200,
} as const;

/** 觉醒消耗资源类型键名 */
export type AwakeningCostKey = keyof typeof AWAKENING_COST;

// ─────────────────────────────────────────────
// 4. 101~120级经验表
// ─────────────────────────────────────────────

/**
 * 觉醒后 101~120 级经验需求表
 *
 * 来源：PRD HER-13.4.2 101~120级经验需求
 * 经验需求 = 等级 × 系数（按等级段递增）
 *
 * | 等级范围 | 经验系数 | 铜钱系数 |
 * |---------|---------|---------|
 * | 101~105 | 12000   | 5000    |
 * | 106~110 | 15000   | 7000    |
 * | 111~115 | 20000   | 10000   |
 * | 116~120 | 25000   | 13000   |
 */
export const AWAKENING_EXP_TIERS: readonly { levelMin: number; levelMax: number; expPerLevel: number; goldPerLevel: number }[] = [
  { levelMin: 101, levelMax: 105, expPerLevel: 12000, goldPerLevel: 5000 },
  { levelMin: 106, levelMax: 110, expPerLevel: 15000, goldPerLevel: 7000 },
  { levelMin: 111, levelMax: 115, expPerLevel: 20000, goldPerLevel: 10000 },
  { levelMin: 116, levelMax: 120, expPerLevel: 25000, goldPerLevel: 13000 },
] as const;

/**
 * 101~120级每级经验需求（查找表）
 *
 * 经验 = 等级 × expPerLevel
 */
export const AWAKENING_EXP_TABLE: Record<number, number> = {};
for (const tier of AWAKENING_EXP_TIERS) {
  for (let lv = tier.levelMin; lv <= tier.levelMax; lv++) {
    AWAKENING_EXP_TABLE[lv] = lv * tier.expPerLevel;
  }
}

/**
 * 101~120级每级铜钱消耗（查找表）
 *
 * 铜钱 = 等级 × goldPerLevel
 */
export const AWAKENING_GOLD_TABLE: Record<number, number> = {};
for (const tier of AWAKENING_EXP_TIERS) {
  for (let lv = tier.levelMin; lv <= tier.levelMax; lv++) {
    AWAKENING_GOLD_TABLE[lv] = lv * tier.goldPerLevel;
  }
}

// ─────────────────────────────────────────────
// 5. 属性加成
// ─────────────────────────────────────────────

/**
 * 觉醒后全属性加成倍率
 *
 * 来源：PRD HER-13.4.1 属性飞跃
 * 全属性 +50%，即倍率 1.5
 * 综合战力提升约 +150%（叠加到6乘区公式后）
 */
export const AWAKENING_STAT_MULTIPLIER = 1.5;

// ─────────────────────────────────────────────
// 6. 觉醒技能模板
// ─────────────────────────────────────────────

/**
 * 觉醒终极技能定义
 *
 * 来源：PRD HER-13.4.4 终极技能
 * 每个可觉醒武将解锁独特的终极技能，技能效果与武将历史典故深度绑定
 * CD较长（5~8回合），伤害/效果显著但不可滥用
 */
export interface AwakeningSkill {
  /** 技能唯一ID */
  id: string;
  /** 技能名称 */
  name: string;
  /** 技能描述 */
  description: string;
  /** 伤害倍率（相对于攻击力或智力） */
  damageMultiplier: number;
  /** 冷却回合数 */
  cooldown: number;
  /** 附加效果描述 */
  effect?: string;
}

/**
 * 全武将觉醒技能配置表
 *
 * 来源：PRD HER-13.4.4 终极技能表
 * 仅包含可觉醒品质（RARE/EPIC/LEGENDARY）的武将
 */
export const AWAKENING_SKILLS: Readonly<Record<string, AwakeningSkill>> = {
  // ── 传说品质 ──
  guanyu: {
    id: 'guanyu_awaken',
    name: '武圣·青龙偃月',
    description: '对单体造成300%ATK伤害，击杀后回复30%HP',
    damageMultiplier: 3.0,
    cooldown: 5,
    effect: '击杀回复30%HP',
  },
  zhugeliang: {
    id: 'zhugeliang_awaken',
    name: '卧龙·八阵图',
    description: '全体友军获得护盾（诸葛亮INT×3），持续3回合',
    damageMultiplier: 3.0,
    cooldown: 7,
    effect: '全体护盾INT×3',
  },
  zhaoyun: {
    id: 'zhaoyun_awaken',
    name: '常胜·七进七出',
    description: '连续攻击7次，每次对随机敌人造成80%ATK伤害',
    damageMultiplier: 0.8,
    cooldown: 6,
    effect: '随机7次攻击',
  },
  caocao: {
    id: 'caocao_awaken',
    name: '奸雄·挟天子',
    description: '全体敌人ATK-20%、INT-20%，持续3回合',
    damageMultiplier: 0,
    cooldown: 7,
    effect: '敌方ATK/INT-20%持续3回合',
  },
  lvbu: {
    id: 'lvbu_awaken',
    name: '飞将·天下无双',
    description: '对单体造成400%ATK伤害，自身获得无敌1回合',
    damageMultiplier: 4.0,
    cooldown: 8,
    effect: '无敌1回合',
  },

  // ── 史诗品质 ──
  liubei: {
    id: 'liubei_awaken',
    name: '仁德·桃园结义',
    description: '全体友军回复40%最大HP，攻击力+15%持续2回合',
    damageMultiplier: 0,
    cooldown: 7,
    effect: '全体回复40%HP+ATK+15%',
  },
  zhangfei: {
    id: 'zhangfei_awaken',
    name: '万人敌·长坂怒吼',
    description: '对全体造成150%ATK伤害，附加眩晕1回合（50%概率）',
    damageMultiplier: 1.5,
    cooldown: 6,
    effect: '50%概率眩晕1回合',
  },
  simayi: {
    id: 'simayi_awaken',
    name: '隐忍·鹰视狼顾',
    description: '对全体造成120%INT策略伤害，偷取20%属性持续2回合',
    damageMultiplier: 1.2,
    cooldown: 7,
    effect: '偷取20%属性持续2回合',
  },
  zhouyu: {
    id: 'zhouyu_awaken',
    name: '火神·赤壁焚天',
    description: '对全体造成180%INT灼烧伤害，持续3回合每回合30%INT',
    damageMultiplier: 1.8,
    cooldown: 7,
    effect: '灼烧3回合每回合30%INT',
  },

  // ── 稀有品质 ──
  dianwei: {
    id: 'dianwei_awaken',
    name: '恶来·死战不退',
    description: '对单体造成250%ATK伤害，自身HP越低伤害越高（最高+100%）',
    damageMultiplier: 2.5,
    cooldown: 5,
    effect: 'HP越低伤害越高(最高+100%)',
  },
  lushu: {
    id: 'lushu_awaken',
    name: '联盟·唇枪舌剑',
    description: '全体友军防御+25%持续3回合，清除所有负面状态',
    damageMultiplier: 0,
    cooldown: 6,
    effect: '全体DEF+25%+清除负面',
  },
  huanggai: {
    id: 'huanggai_awaken',
    name: '苦肉·赤壁先锋',
    description: '牺牲20%HP，对全体造成200%ATK伤害',
    damageMultiplier: 2.0,
    cooldown: 5,
    effect: '牺牲20%HP',
  },
  ganning: {
    id: 'ganning_awaken',
    name: '锦帆·百骑劫营',
    description: '对后排造成220%ATK伤害，50%概率沉默2回合',
    damageMultiplier: 2.2,
    cooldown: 6,
    effect: '50%概率沉默2回合',
  },
  xuhuang: {
    id: 'xuhuang_awaken',
    name: '坚守·以逸待劳',
    description: '全体友军获得护盾（自身DEF×2.5），反击伤害30%',
    damageMultiplier: 0,
    cooldown: 7,
    effect: '全体护盾DEF×2.5+反击30%',
  },
  zhangliao: {
    id: 'zhangliao_awaken',
    name: '突袭·威震逍遥津',
    description: '先手对单体造成280%ATK伤害，降低目标防御30%持续2回合',
    damageMultiplier: 2.8,
    cooldown: 5,
    effect: '先手+DEF-30%持续2回合',
  },
  weiyan: {
    id: 'weiyan_awaken',
    name: '狂攻·子午谷奇谋',
    description: '连续攻击3次，每次造成150%ATK伤害，无视30%防御',
    damageMultiplier: 1.5,
    cooldown: 6,
    effect: '3次攻击+无视30%DEF',
  },
} as const;

// ─────────────────────────────────────────────
// 7. 觉醒被动效果
// ─────────────────────────────────────────────

/**
 * 觉醒被动效果配置
 *
 * 来源：PRD HER-13.5 觉醒被动效果
 * 觉醒武将即使未上阵也提供全局被动加成
 */
export const AWAKENING_PASSIVE = {
  /** 阵营光环：同阵营所有武将ATK+3%，最多叠加3次 */
  factionAtkBonus: 0.03,
  factionMaxStacks: 3,
  /** 全局属性：所有武将全属性+1%，最多叠加5次 */
  globalStatBonus: 0.01,
  globalMaxStacks: 5,
  /** 资源加成：铜钱/招贤令产出+2%，最多叠加3次 */
  resourceBonus: 0.02,
  resourceMaxStacks: 3,
  /** 经验加成：所有武将经验获取+3%，最多叠加3次 */
  expBonus: 0.03,
  expMaxStacks: 3,
} as const;

// ─────────────────────────────────────────────
// 8. 觉醒品质视觉升级
// ─────────────────────────────────────────────

/**
 * 觉醒后品质视觉配置
 *
 * 来源：PRD HER-13.4.3 品质视觉升级
 */
export const AWAKENING_VISUAL: Record<Quality, { borderStyle: string; effect: string }> = {
  [Q.COMMON]: { borderStyle: '灰绿', effect: '不可觉醒' },
  [Q.FINE]: { borderStyle: '蓝银', effect: '不可觉醒' },
  [Q.RARE]: { borderStyle: '暗金+紫焰', effect: '紫色粒子环绕' },
  [Q.EPIC]: { borderStyle: '天金+赤焰', effect: '金色光柱+火焰底座' },
  [Q.LEGENDARY]: { borderStyle: '圣金+天命光环', effect: '全身光环+翅膀投影' },
};

// ─────────────────────────────────────────────
// 9. 存档版本
// ─────────────────────────────────────────────

/** 觉醒系统存档版本号 */
export const AWAKENING_SAVE_VERSION = 1;
