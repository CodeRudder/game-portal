/**
 * 武将羁绊系统 — 数值配置
 *
 * 职责：羁绊定义、阵营羁绊配置、搭档羁绊配置、星级→等级映射
 * 规则：零逻辑，只有常量和数据结构
 * 数值来源：hero-bond-system.md v1.0
 *
 * @module engine/hero/bond-config
 */

import type { Faction } from '../../shared/types';

// ─────────────────────────────────────────────
// 1. 羁绊类型枚举
// ─────────────────────────────────────────────

/** 羁绊类型 */
export enum BondType {
  /** 阵营羁绊（魏蜀吴群） */
  FACTION = 'faction',
  /** 搭档羁绊（特定武将组合） */
  PARTNER = 'partner',
}

// ─────────────────────────────────────────────
// 2. 羁绊等级配置
// ─────────────────────────────────────────────

/**
 * 羁绊等级：由参与武将的最低星级决定
 *
 * Lv1: 所有参与武将 ≥ 1星 → 效果倍率 ×1.0
 * Lv2: 所有参与武将 ≥ 3星 → 效果倍率 ×1.5
 * Lv3: 所有参与武将 ≥ 5星 → 效果倍率 ×2.0
 */
export const BOND_STAR_LEVEL_MAP: ReadonlyArray<{
  /** 羁绊等级 */
  level: number;
  /** 所需最低星级 */
  minStar: number;
  /** 效果倍率 */
  multiplier: number;
}> = [
  { level: 1, minStar: 1, multiplier: 1.0 },
  { level: 2, minStar: 3, multiplier: 1.5 },
  { level: 3, minStar: 5, multiplier: 2.0 },
] as const;

/** 根据最低星级获取羁绊等级（从高到低匹配） */
export function getBondLevelByMinStar(minStar: number): number {
  for (let i = BOND_STAR_LEVEL_MAP.length - 1; i >= 0; i--) {
    if (minStar >= BOND_STAR_LEVEL_MAP[i].minStar) {
      return BOND_STAR_LEVEL_MAP[i].level;
    }
  }
  return 1;
}

/** 根据羁绊等级获取效果倍率 */
export function getBondLevelMultiplier(level: number): number {
  const entry = BOND_STAR_LEVEL_MAP.find((e) => e.level === level);
  return entry ? entry.multiplier : 1.0;
}

// ─────────────────────────────────────────────
// 3. 羁绊效果接口
// ─────────────────────────────────────────────

/** 单个属性效果 */
export interface BondEffect {
  /** 属性类型 */
  stat: 'attack' | 'defense' | 'intelligence' | 'speed' | 'hp' | 'critRate' | 'critDamage' | 'skillDamage' | 'passiveTriggerRate' | 'skillRange';
  /** 加成百分比（如 0.15 表示 +15%） */
  value: number;
}

/** 羁绊等级门槛（用于阵营羁绊） */
export interface BondTier {
  /** 激活所需人数 */
  requiredCount: number;
  /** 该等级的效果列表 */
  effects: ReadonlyArray<BondEffect>;
}

// ─────────────────────────────────────────────
// 4. 羁绊定义接口
// ─────────────────────────────────────────────

/** 阵营羁绊定义 */
export interface FactionBondDefinition {
  /** 羁绊ID */
  id: string;
  /** 羁绊类型 */
  type: BondType.FACTION;
  /** 羁绊名称 */
  name: string;
  /** 对应阵营 */
  faction: Faction;
  /** 各等级门槛（按 requiredCount 升序） */
  tiers: ReadonlyArray<BondTier>;
}

/** 搭档羁绊定义 */
export interface PartnerBondDefinition {
  /** 羁绊ID */
  id: string;
  /** 羁绊类型 */
  type: BondType.PARTNER;
  /** 羁绊名称 */
  name: string;
  /** 参与武将ID列表（全部上阵才激活） */
  generalIds: ReadonlyArray<string>;
  /** 基础效果（Lv1 时的效果） */
  effects: ReadonlyArray<BondEffect>;
  /** 搭档羁绊需要最低人数（如五虎上将只需3人即可激活） */
  minRequired: number;
}

/** 羁绊定义联合类型 */
export type BondDefinition = FactionBondDefinition | PartnerBondDefinition;

// ─────────────────────────────────────────────
// 5. 阵营羁绊配置（4阵营 × 3等级）
// ─────────────────────────────────────────────

/**
 * 阵营羁绊配置
 *
 * 来源：hero-bond-system.md §2.1
 * 2人激活基础效果，3人/4人逐级增强
 */
export const FACTION_BONDS: ReadonlyArray<FactionBondDefinition> = [
  // ── 蜀国：攻防兼备，均衡型 ──
  {
    id: 'faction_shu',
    type: BondType.FACTION,
    name: '蜀国',
    faction: 'shu',
    tiers: [
      { requiredCount: 2, effects: [{ stat: 'attack', value: 0.05 }] },
      { requiredCount: 3, effects: [{ stat: 'attack', value: 0.10 }, { stat: 'defense', value: 0.05 }] },
      { requiredCount: 4, effects: [{ stat: 'attack', value: 0.15 }, { stat: 'defense', value: 0.10 }, { stat: 'hp', value: 0.05 }] },
    ],
  },
  // ── 魏国：铁壁防御，谋略型 ──
  {
    id: 'faction_wei',
    type: BondType.FACTION,
    name: '魏国',
    faction: 'wei',
    tiers: [
      { requiredCount: 2, effects: [{ stat: 'defense', value: 0.05 }] },
      { requiredCount: 3, effects: [{ stat: 'defense', value: 0.10 }, { stat: 'intelligence', value: 0.05 }] },
      { requiredCount: 4, effects: [{ stat: 'defense', value: 0.15 }, { stat: 'intelligence', value: 0.10 }, { stat: 'passiveTriggerRate', value: 0.10 }] },
    ],
  },
  // ── 吴国：疾风迅雷，暴击型 ──
  {
    id: 'faction_wu',
    type: BondType.FACTION,
    name: '吴国',
    faction: 'wu',
    tiers: [
      { requiredCount: 2, effects: [{ stat: 'speed', value: 0.05 }] },
      { requiredCount: 3, effects: [{ stat: 'speed', value: 0.10 }, { stat: 'attack', value: 0.05 }] },
      { requiredCount: 4, effects: [{ stat: 'speed', value: 0.15 }, { stat: 'attack', value: 0.10 }, { stat: 'critRate', value: 0.10 }] },
    ],
  },
  // ── 群雄：奇策百出，策略型 ──
  {
    id: 'faction_qun',
    type: BondType.FACTION,
    name: '群雄',
    faction: 'qun',
    tiers: [
      { requiredCount: 2, effects: [{ stat: 'intelligence', value: 0.05 }] },
      { requiredCount: 3, effects: [{ stat: 'intelligence', value: 0.10 }, { stat: 'defense', value: 0.05 }] },
      { requiredCount: 4, effects: [{ stat: 'intelligence', value: 0.15 }, { stat: 'defense', value: 0.10 }, { stat: 'skillRange', value: 1 }] },
    ],
  },
] as const;

// ─────────────────────────────────────────────
// 6. 搭档羁绊配置（12组：蜀3/魏3/吴3/群3）
// ─────────────────────────────────────────────

/**
 * 搭档羁绊配置 — 12组
 *
 * 来源：hero-bond-system.md §2.2 + P1-3 扩充
 * 设计原则：每阵营3组搭档羁绊，覆盖不同收集难度和策略方向
 *
 * 蜀国：桃园结义(刘关张)、五虎上将(关张赵马黄)、卧龙凤雏(诸葛亮庞统)
 * 魏国：五子良将(张辽徐晃于禁张郃乐进)、曹氏宗族(曹仁曹洪夏侯惇夏侯渊)、虎痴双雄(许褚典韦)
 * 吴国：江东双璧(孙策周瑜)、东吴四英(鲁肃吕蒙陆逊)、孙氏父子(孙坚孙策孙权)
 * 群雄：三英战吕布(刘关张+吕布)、董卓之乱(董卓吕布貂蝉)、袁绍谋士(田丰沮授)
 */
export const PARTNER_BONDS: ReadonlyArray<PartnerBondDefinition> = [
  // ═══════════════════════════════════════════
  // 蜀国（3组）
  // ═══════════════════════════════════════════

  // ── 桃园结义：刘备+关羽+张飞 ──
  {
    id: 'partner_taoyuan',
    type: BondType.PARTNER,
    name: '桃园结义',
    generalIds: ['liubei', 'guanyu', 'zhangfei'],
    effects: [{ stat: 'attack', value: 0.15 }],
    minRequired: 3,
  },
  // ── 五虎上将：任意3个（关羽/张飞/赵云/马超/黄忠） ──
  {
    id: 'partner_wuhu',
    type: BondType.PARTNER,
    name: '五虎上将',
    generalIds: ['guanyu', 'zhangfei', 'zhaoyun', 'machao', 'huangzhong'],
    effects: [{ stat: 'critRate', value: 0.10 }],
    minRequired: 3,
  },
  // ── 卧龙凤雏：诸葛亮+庞统 ──
  {
    id: 'partner_wolong_fengchu',
    type: BondType.PARTNER,
    name: '卧龙凤雏',
    generalIds: ['zhugeliang', 'pangtong'],
    effects: [{ stat: 'skillDamage', value: 0.20 }],
    minRequired: 2,
  },

  // ═══════════════════════════════════════════
  // 魏国（3组）
  // ═══════════════════════════════════════════

  // ── 五子良将：任意3个（张辽/徐晃/于禁/张郃/乐进） ──
  {
    id: 'partner_wuzi',
    type: BondType.PARTNER,
    name: '五子良将',
    generalIds: ['zhangliao', 'xuhuang', 'yujin', 'zhanghe', 'lejin'],
    effects: [{ stat: 'defense', value: 0.12 }],
    minRequired: 3,
  },
  // ── 曹氏宗族：任意2个（曹仁/曹洪/夏侯惇/夏侯渊） ──
  {
    id: 'partner_cao_clan',
    type: BondType.PARTNER,
    name: '曹氏宗族',
    generalIds: ['caoren', 'caohong', 'xiahoudun', 'xiahouyuan'],
    effects: [{ stat: 'hp', value: 0.15 }],
    minRequired: 2,
  },
  // ── 虎痴双雄：许褚+典韦 ──
  {
    id: 'partner_huchi',
    type: BondType.PARTNER,
    name: '虎痴双雄',
    generalIds: ['xuchu', 'dianwei'],
    effects: [{ stat: 'attack', value: 0.12 }, { stat: 'defense', value: 0.08 }],
    minRequired: 2,
  },

  // ═══════════════════════════════════════════
  // 吴国（3组）
  // ═══════════════════════════════════════════

  // ── 江东双璧：孙策+周瑜 ──
  {
    id: 'partner_jiangdong',
    type: BondType.PARTNER,
    name: '江东双璧',
    generalIds: ['sunce', 'zhouyu'],
    effects: [{ stat: 'speed', value: 0.15 }, { stat: 'skillDamage', value: 0.10 }],
    minRequired: 2,
  },
  // ── 东吴四英：任意2个（鲁肃/吕蒙/陆逊） ──
  {
    id: 'partner_dongwu_siying',
    type: BondType.PARTNER,
    name: '东吴四英',
    generalIds: ['lusu', 'lvmeng', 'luxun'],
    effects: [{ stat: 'intelligence', value: 0.15 }],
    minRequired: 2,
  },
  // ── 孙氏父子：孙坚+孙策+孙权 ──
  {
    id: 'partner_sun_family',
    type: BondType.PARTNER,
    name: '孙氏父子',
    generalIds: ['sunjian', 'sunce', 'sunquan'],
    effects: [{ stat: 'attack', value: 0.10 }, { stat: 'speed', value: 0.10 }],
    minRequired: 3,
  },

  // ═══════════════════════════════════════════
  // 群雄（3组）
  // ═══════════════════════════════════════════

  // ── 三英战吕布：刘备+关羽+张飞+吕布 ──
  {
    id: 'partner_sanying_lvbu',
    type: BondType.PARTNER,
    name: '三英战吕布',
    generalIds: ['liubei', 'guanyu', 'zhangfei', 'lvbu'],
    effects: [{ stat: 'attack', value: 0.18 }],
    minRequired: 4,
  },
  // ── 董卓之乱：董卓+吕布+貂蝉 ──
  {
    id: 'partner_dongzhuo',
    type: BondType.PARTNER,
    name: '董卓之乱',
    generalIds: ['dongzhuo', 'lvbu', 'diaochan'],
    effects: [{ stat: 'critDamage', value: 0.15 }],
    minRequired: 3,
  },
  // ── 袁绍谋士：田丰+沮授 ──
  {
    id: 'partner_yuanshao_moushi',
    type: BondType.PARTNER,
    name: '袁绍谋士',
    generalIds: ['tianfeng', 'jushou'],
    effects: [{ stat: 'intelligence', value: 0.12 }, { stat: 'skillRange', value: 1 }],
    minRequired: 2,
  },
] as const;

// ─────────────────────────────────────────────
// 7. 常量
// ─────────────────────────────────────────────

/** 羁绊系数上限（防止极端叠加） */
export const BOND_MULTIPLIER_CAP = 2.0;

/** 派驻效果系数 */
export const DISPATCH_FACTOR = 0.5;

/** 上阵效果系数 */
export const ACTIVE_FACTOR = 1.0;
