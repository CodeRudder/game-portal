/**
 * 阵营羁绊系统 — 数值配置
 *
 * 职责：阵营羁绊定义（4阵营×4等级）、搭档羁绊定义（特殊组合）、
 *       羁绊效果接口、常量配置
 * 规则：零逻辑，只有常量和数据结构
 *
 * 阵营羁绊规则：
 *   2人同阵营 → 初级（攻击+5%）
 *   3人同阵营 → 中级（攻击+10%，防御+5%）
 *   4人同阵营 → 高级（攻击+15%，防御+10%，生命+5%）
 *   5人同阵营 → 终极（攻击+20%，防御+15%，生命+10%，暴击+5%）
 *
 * 搭档羁绊：
 *   桃园结义：刘备+关羽+张飞 → 全属性+10%
 *   魏武之威：曹操+夏侯惇+许褚 → 攻击+15%
 *   赤壁之谋：孙权+周瑜 → 策略+20%
 *
 * @module engine/hero/faction-bond-config
 */

// ─────────────────────────────────────────────
// 1. 羁绊效果接口
// ─────────────────────────────────────────────

/** 羁绊加成效果（百分比，0.05 = 5%） */
export interface BondEffect {
  /** 攻击加成百分比 */
  attackBonus: number;
  /** 防御加成百分比 */
  defenseBonus: number;
  /** 生命加成百分比 */
  hpBonus: number;
  /** 暴击加成百分比 */
  critBonus: number;
  /** 策略加成百分比 */
  strategyBonus: number;
}

/** 空效果（无加成） */
export const EMPTY_BOND_EFFECT: BondEffect = {
  attackBonus: 0,
  defenseBonus: 0,
  hpBonus: 0,
  critBonus: 0,
  strategyBonus: 0,
};

// ─────────────────────────────────────────────
// 2. 羁绊配置接口
// ─────────────────────────────────────────────

/** 羁绊类型 */
export type BondType = 'faction' | 'partner';

/** 阵营标识 */
export type FactionId = 'wei' | 'shu' | 'wu' | 'neutral';

/** 羁绊配置 */
export interface BondConfig {
  /** 羁绊唯一ID */
  id: string;
  /** 羁绊名称 */
  name: string;
  /** 羁绊类型：阵营 / 搭档 */
  type: BondType;
  /** 关联阵营（阵营羁绊专用） */
  faction?: FactionId;
  /** 需要的武将ID列表（搭档羁绊专用） */
  requiredHeroes: string[];
  /** 最少需要几人激活 */
  minCount: number;
  /** 羁绊加成效果 */
  effect: BondEffect;
  /** 羁绊描述 */
  description: string;
}

// ─────────────────────────────────────────────
// 3. 阵营羁绊等级门槛
// ─────────────────────────────────────────────

/** 阵营羁绊等级定义 */
export interface FactionTierDef {
  /** 激活所需人数 */
  requiredCount: number;
  /** 等级名称 */
  tierName: string;
  /** 加成效果 */
  effect: BondEffect;
  /** 描述 */
  description: string;
}

// ─────────────────────────────────────────────
// 4. 阵营羁绊配置（4阵营 × 4等级）
// ─────────────────────────────────────────────

/** 蜀国羁绊等级（攻防兼备型） */
export const SHU_TIERS: ReadonlyArray<FactionTierDef> = [
  {
    requiredCount: 2,
    tierName: '初级',
    effect: { attackBonus: 0.05, defenseBonus: 0, hpBonus: 0, critBonus: 0, strategyBonus: 0 },
    description: '蜀国初级羁绊：攻击+5%',
  },
  {
    requiredCount: 3,
    tierName: '中级',
    effect: { attackBonus: 0.10, defenseBonus: 0.05, hpBonus: 0, critBonus: 0, strategyBonus: 0 },
    description: '蜀国中级羁绊：攻击+10%，防御+5%',
  },
  {
    requiredCount: 4,
    tierName: '高级',
    effect: { attackBonus: 0.15, defenseBonus: 0.10, hpBonus: 0.05, critBonus: 0, strategyBonus: 0 },
    description: '蜀国高级羁绊：攻击+15%，防御+10%，生命+5%',
  },
  {
    requiredCount: 5,
    tierName: '终极',
    effect: { attackBonus: 0.20, defenseBonus: 0.15, hpBonus: 0.10, critBonus: 0.05, strategyBonus: 0 },
    description: '蜀国终极羁绊：攻击+20%，防御+15%，生命+10%，暴击+5%',
  },
];

/** 魏国羁绊等级（铁壁防御型） */
export const WEI_TIERS: ReadonlyArray<FactionTierDef> = [
  {
    requiredCount: 2,
    tierName: '初级',
    effect: { attackBonus: 0.05, defenseBonus: 0, hpBonus: 0, critBonus: 0, strategyBonus: 0 },
    description: '魏国初级羁绊：攻击+5%',
  },
  {
    requiredCount: 3,
    tierName: '中级',
    effect: { attackBonus: 0.10, defenseBonus: 0.05, hpBonus: 0, critBonus: 0, strategyBonus: 0 },
    description: '魏国中级羁绊：攻击+10%，防御+5%',
  },
  {
    requiredCount: 4,
    tierName: '高级',
    effect: { attackBonus: 0.15, defenseBonus: 0.10, hpBonus: 0.05, critBonus: 0, strategyBonus: 0 },
    description: '魏国高级羁绊：攻击+15%，防御+10%，生命+5%',
  },
  {
    requiredCount: 5,
    tierName: '终极',
    effect: { attackBonus: 0.20, defenseBonus: 0.15, hpBonus: 0.10, critBonus: 0.05, strategyBonus: 0 },
    description: '魏国终极羁绊：攻击+20%，防御+15%，生命+10%，暴击+5%',
  },
];

/** 吴国羁绊等级（疾风迅雷型） */
export const WU_TIERS: ReadonlyArray<FactionTierDef> = [
  {
    requiredCount: 2,
    tierName: '初级',
    effect: { attackBonus: 0.05, defenseBonus: 0, hpBonus: 0, critBonus: 0, strategyBonus: 0 },
    description: '吴国初级羁绊：攻击+5%',
  },
  {
    requiredCount: 3,
    tierName: '中级',
    effect: { attackBonus: 0.10, defenseBonus: 0.05, hpBonus: 0, critBonus: 0, strategyBonus: 0 },
    description: '吴国中级羁绊：攻击+10%，防御+5%',
  },
  {
    requiredCount: 4,
    tierName: '高级',
    effect: { attackBonus: 0.15, defenseBonus: 0.10, hpBonus: 0.05, critBonus: 0, strategyBonus: 0 },
    description: '吴国高级羁绊：攻击+15%，防御+10%，生命+5%',
  },
  {
    requiredCount: 5,
    tierName: '终极',
    effect: { attackBonus: 0.20, defenseBonus: 0.15, hpBonus: 0.10, critBonus: 0.05, strategyBonus: 0 },
    description: '吴国终极羁绊：攻击+20%，防御+15%，生命+10%，暴击+5%',
  },
];

/** 群雄羁绊等级（奇策百出型） */
export const NEUTRAL_TIERS: ReadonlyArray<FactionTierDef> = [
  {
    requiredCount: 2,
    tierName: '初级',
    effect: { attackBonus: 0.05, defenseBonus: 0, hpBonus: 0, critBonus: 0, strategyBonus: 0 },
    description: '群雄初级羁绊：攻击+5%',
  },
  {
    requiredCount: 3,
    tierName: '中级',
    effect: { attackBonus: 0.10, defenseBonus: 0.05, hpBonus: 0, critBonus: 0, strategyBonus: 0 },
    description: '群雄中级羁绊：攻击+10%，防御+5%',
  },
  {
    requiredCount: 4,
    tierName: '高级',
    effect: { attackBonus: 0.15, defenseBonus: 0.10, hpBonus: 0.05, critBonus: 0, strategyBonus: 0 },
    description: '群雄高级羁绊：攻击+15%，防御+10%，生命+5%',
  },
  {
    requiredCount: 5,
    tierName: '终极',
    effect: { attackBonus: 0.20, defenseBonus: 0.15, hpBonus: 0.10, critBonus: 0.05, strategyBonus: 0 },
    description: '群雄终极羁绊：攻击+20%，防御+15%，生命+10%，暴击+5%',
  },
];

/** 阵营到等级配置的映射 */
export const FACTION_TIER_MAP: Readonly<Record<FactionId, ReadonlyArray<FactionTierDef>>> = {
  wei: WEI_TIERS,
  shu: SHU_TIERS,
  wu: WU_TIERS,
  neutral: NEUTRAL_TIERS,
};

// ─────────────────────────────────────────────
// 5. 搭档羁绊配置（特殊组合）
// ─────────────────────────────────────────────

/**
 * 搭档羁绊配置 — 12组（蜀3/魏3/吴3/群3）
 *
 * 蜀国：桃园结义(刘关张)、五虎上将(关张赵马黄)、卧龙凤雏(诸葛亮庞统)
 * 魏国：五子良将(张辽徐晃于禁张郃乐进)、曹氏宗族(曹仁曹洪夏侯惇夏侯渊)、虎痴双雄(许褚典韦)
 * 吴国：江东双璧(孙策周瑜)、东吴四英(鲁肃吕蒙陆逊)、孙氏父子(孙坚孙策孙权)
 * 群雄：三英战吕布(刘关张+吕布)、董卓之乱(董卓吕布貂蝉)、袁绍谋士(田丰沮授)
 */
export const PARTNER_BOND_CONFIGS: ReadonlyArray<BondConfig> = [
  // ═══════════════════════════════════════════
  // 蜀国（3组）
  // ═══════════════════════════════════════════
  {
    id: 'partner_taoyuan',
    name: '桃园结义',
    type: 'partner',
    requiredHeroes: ['liubei', 'guanyu', 'zhangfei'],
    minCount: 3,
    effect: {
      attackBonus: 0.10,
      defenseBonus: 0.10,
      hpBonus: 0.10,
      critBonus: 0.10,
      strategyBonus: 0.10,
    },
    description: '刘备、关羽、张飞桃园结义，全属性+10%',
  },
  {
    id: 'partner_wuhu',
    name: '五虎上将',
    type: 'partner',
    requiredHeroes: ['guanyu', 'zhangfei', 'zhaoyun', 'machao', 'huangzhong'],
    minCount: 3,
    effect: {
      attackBonus: 0.08,
      defenseBonus: 0,
      hpBonus: 0,
      critBonus: 0.10,
      strategyBonus: 0,
    },
    description: '五虎上将任意3人，暴击+10%，攻击+8%',
  },
  {
    id: 'partner_wolong_fengchu',
    name: '卧龙凤雏',
    type: 'partner',
    requiredHeroes: ['zhugeliang', 'pangtong'],
    minCount: 2,
    effect: {
      attackBonus: 0,
      defenseBonus: 0,
      hpBonus: 0,
      critBonus: 0,
      strategyBonus: 0.20,
    },
    description: '诸葛亮、庞统卧龙凤雏，策略+20%',
  },
  // ═══════════════════════════════════════════
  // 魏国（3组）
  // ═══════════════════════════════════════════
  {
    id: 'partner_wuzi',
    name: '五子良将',
    type: 'partner',
    requiredHeroes: ['zhangliao', 'xuhuang', 'yujin', 'zhanghe', 'lejin'],
    minCount: 3,
    effect: {
      attackBonus: 0,
      defenseBonus: 0.12,
      hpBonus: 0,
      critBonus: 0,
      strategyBonus: 0,
    },
    description: '五子良将任意3人，防御+12%',
  },
  {
    id: 'partner_cao_clan',
    name: '曹氏宗族',
    type: 'partner',
    requiredHeroes: ['caoren', 'caohong', 'xiahoudun', 'xiahouyuan'],
    minCount: 2,
    effect: {
      attackBonus: 0,
      defenseBonus: 0,
      hpBonus: 0.15,
      critBonus: 0,
      strategyBonus: 0,
    },
    description: '曹氏宗族任意2人，生命+15%',
  },
  {
    id: 'partner_huchi',
    name: '虎痴双雄',
    type: 'partner',
    requiredHeroes: ['xuchu', 'dianwei'],
    minCount: 2,
    effect: {
      attackBonus: 0.12,
      defenseBonus: 0.08,
      hpBonus: 0,
      critBonus: 0,
      strategyBonus: 0,
    },
    description: '许褚、典韦虎痴双雄，攻击+12%，防御+8%',
  },
  // ═══════════════════════════════════════════
  // 吴国（3组）
  // ═══════════════════════════════════════════
  {
    id: 'partner_jiangdong',
    name: '江东双璧',
    type: 'partner',
    requiredHeroes: ['sunce', 'zhouyu'],
    minCount: 2,
    effect: {
      attackBonus: 0,
      defenseBonus: 0,
      hpBonus: 0,
      critBonus: 0,
      strategyBonus: 0.20,
    },
    description: '孙策、周瑜江东双璧，策略+20%',
  },
  {
    id: 'partner_dongwu_siying',
    name: '东吴四英',
    type: 'partner',
    requiredHeroes: ['lusu', 'lvmeng', 'luxun'],
    minCount: 2,
    effect: {
      attackBonus: 0,
      defenseBonus: 0,
      hpBonus: 0,
      critBonus: 0,
      strategyBonus: 0.15,
    },
    description: '东吴四英任意2人，策略+15%',
  },
  {
    id: 'partner_sun_family',
    name: '孙氏父子',
    type: 'partner',
    requiredHeroes: ['sunjian', 'sunce', 'sunquan'],
    minCount: 3,
    effect: {
      attackBonus: 0.10,
      defenseBonus: 0,
      hpBonus: 0,
      critBonus: 0,
      strategyBonus: 0,
    },
    description: '孙坚、孙策、孙权孙氏父子，攻击+10%',
  },
  // ═══════════════════════════════════════════
  // 群雄（3组）
  // ═══════════════════════════════════════════
  {
    id: 'partner_sanying_lvbu',
    name: '三英战吕布',
    type: 'partner',
    requiredHeroes: ['liubei', 'guanyu', 'zhangfei', 'lvbu'],
    minCount: 4,
    effect: {
      attackBonus: 0.18,
      defenseBonus: 0,
      hpBonus: 0,
      critBonus: 0,
      strategyBonus: 0,
    },
    description: '刘备、关羽、张飞、吕布三英战吕布，攻击+18%',
  },
  {
    id: 'partner_dongzhuo',
    name: '董卓之乱',
    type: 'partner',
    requiredHeroes: ['dongzhuo', 'lvbu', 'diaochan'],
    minCount: 3,
    effect: {
      attackBonus: 0,
      defenseBonus: 0,
      hpBonus: 0,
      critBonus: 0.15,
      strategyBonus: 0,
    },
    description: '董卓、吕布、貂蝉董卓之乱，暴击+15%',
  },
  {
    id: 'partner_yuanshao_moushi',
    name: '袁绍谋士',
    type: 'partner',
    requiredHeroes: ['tianfeng', 'jushou'],
    minCount: 2,
    effect: {
      attackBonus: 0,
      defenseBonus: 0,
      hpBonus: 0,
      critBonus: 0,
      strategyBonus: 0.12,
    },
    description: '田丰、沮授袁绍谋士，策略+12%',
  },
];

// ─────────────────────────────────────────────
// 6. 武将阵营映射（内置数据）
// ─────────────────────────────────────────────

/**
 * 武将ID → 阵营映射
 *
 * 用于 FactionBondSystem 查询武将所属阵营。
 * 外部可通过 setHeroFactionResolver() 覆盖查询逻辑。
 */
export const HERO_FACTION_MAP: Readonly<Record<string, FactionId>> = {
  // ── 蜀国 ──
  liubei: 'shu',
  guanyu: 'shu',
  zhangfei: 'shu',
  zhaoyun: 'shu',
  machao: 'shu',
  huangzhong: 'shu',
  zhugeliang: 'shu',
  pangtong: 'shu',

  // ── 魏国 ──
  caocao: 'wei',
  xiahoudun: 'wei',
  xuchu: 'wei',
  simayi: 'wei',
  xiahouyuan: 'wei',
  zhangliao: 'wei',
  dianwei: 'wei',
  caoren: 'wei',
  caohong: 'wei',
  xuhuang: 'wei',
  yujin: 'wei',
  zhanghe: 'wei',
  lejin: 'wei',

  // ── 吴国 ──
  sunquan: 'wu',
  zhouyu: 'wu',
  lvmeng: 'wu',
  luxun: 'wu',
  sunshangxiang: 'wu',
  ganning: 'wu',
  taishici: 'wu',
  sunce: 'wu',
  sunjian: 'wu',
  lusu: 'wu',

  // ── 群雄 ──
  lvbu: 'neutral',
  diaochan: 'neutral',
  yuanzhao: 'neutral',
  jiaxu: 'neutral',
  zhangjiao: 'neutral',
  dongzhuo: 'neutral',
  tianfeng: 'neutral',
  jushou: 'neutral',
};

// ─────────────────────────────────────────────
// 7. 常量
// ─────────────────────────────────────────────

/** 阵营羁绊最高激活等级人数 */
export const MAX_FACTION_TIER_COUNT = 5;

/** 所有阵营ID */
export const ALL_FACTIONS: ReadonlyArray<FactionId> = ['wei', 'shu', 'wu', 'neutral'];

/** 阵营中文名映射 */
export const FACTION_NAMES: Readonly<Record<FactionId, string>> = {
  wei: '魏',
  shu: '蜀',
  wu: '吴',
  neutral: '群雄',
};
