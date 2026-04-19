/**
 * 武将域 — 类型定义
 *
 * 规则：只有 interface/type/enum，零逻辑
 *
 * @module engine/hero/hero.types
 */

// ─────────────────────────────────────────────
// 1. 品质枚举
// ─────────────────────────────────────────────

/**
 * 武将品质等级
 *
 * 从低到高：普通 → 精良 → 稀有 → 史诗 → 传说
 * 对应 PRD 中的 Uncommon → Rare → Epic → Legendary → Mythic
 */
export enum Quality {
  /** 普通 — 灰绿边框 */
  COMMON = 'COMMON',
  /** 精良 — 蓝银边框 */
  FINE = 'FINE',
  /** 稀有 — 紫金边框 */
  RARE = 'RARE',
  /** 史诗 — 赤金边框 */
  EPIC = 'EPIC',
  /** 传说 — 天命紫+流光边框 */
  LEGENDARY = 'LEGENDARY',
}

/** 品质等级数值（用于比较大小） */
export const QUALITY_ORDER: Record<Quality, number> = {
  [Quality.COMMON]: 1,
  [Quality.FINE]: 2,
  [Quality.RARE]: 3,
  [Quality.EPIC]: 4,
  [Quality.LEGENDARY]: 5,
};

/** 所有品质的只读数组（从低到高） */
export const QUALITY_TIERS: readonly Quality[] = [
  Quality.COMMON,
  Quality.FINE,
  Quality.RARE,
  Quality.EPIC,
  Quality.LEGENDARY,
] as const;

/** 品质中文名映射 */
export const QUALITY_LABELS: Record<Quality, string> = {
  [Quality.COMMON]: '普通',
  [Quality.FINE]: '精良',
  [Quality.RARE]: '稀有',
  [Quality.EPIC]: '史诗',
  [Quality.LEGENDARY]: '传说',
};

/** 品质边框色映射 */
export const QUALITY_BORDER_COLORS: Record<Quality, string> = {
  [Quality.COMMON]: '#8B9A6B',
  [Quality.FINE]: '#5B8BD4',
  [Quality.RARE]: '#9B6DBF',
  [Quality.EPIC]: '#D4553A',
  [Quality.LEGENDARY]: '#C9A84C',
};

// ─────────────────────────────────────────────
// 2. 阵营
// ─────────────────────────────────────────────

/** 武将阵营 */
export type Faction = 'shu' | 'wei' | 'wu' | 'qun';

/** 阵营中文名映射 */
export const FACTION_LABELS: Record<Faction, string> = {
  shu: '蜀',
  wei: '魏',
  wu: '吴',
  qun: '群',
};

/** 所有阵营的只读数组 */
export const FACTIONS: readonly Faction[] = ['shu', 'wei', 'wu', 'qun'] as const;

// ─────────────────────────────────────────────
// 3. 四维属性
// ─────────────────────────────────────────────

/**
 * 武将四维属性
 *
 * 对应 PRD 中的：武力(ATK)、统率(CMD)、智力(INT)、政治(POL)
 * 此处使用 attack/defense/intelligence/speed 命名，
 * 映射关系：attack↔武力, defense↔统率, intelligence↔智力, speed↔政治
 */
export interface GeneralStats {
  /** 攻击（武力）— 影响普攻伤害、物理技能伤害 */
  attack: number;
  /** 防御（统率）— 影响带兵量、防御、部队生存 */
  defense: number;
  /** 智力 — 影响技能伤害、策略效果 */
  intelligence: number;
  /** 速度（政治）— 影响行动顺序、内政效果 */
  speed: number;
}

// ─────────────────────────────────────────────
// 4. 技能
// ─────────────────────────────────────────────

/** 技能类型 */
export type SkillType = 'active' | 'passive' | 'faction' | 'awaken';

/** 技能数据 */
export interface SkillData {
  /** 技能ID */
  id: string;
  /** 技能名称 */
  name: string;
  /** 技能类型 */
  type: SkillType;
  /** 技能等级 */
  level: number;
  /** 技能描述 */
  description: string;
}

// ─────────────────────────────────────────────
// 5. 武将数据
// ─────────────────────────────────────────────

/**
 * 武将完整数据
 *
 * 包含武将的静态配置和运行时状态
 */
export interface GeneralData {
  /** 武将唯一ID */
  id: string;
  /** 武将名称 */
  name: string;
  /** 武将品质 */
  quality: Quality;
  /** 基础四维属性 */
  baseStats: GeneralStats;
  /** 当前等级 */
  level: number;
  /** 当前经验值 */
  exp: number;
  /** 武将阵营 */
  faction: Faction;
  /** 武将技能列表 */
  skills: SkillData[];
}

// ─────────────────────────────────────────────
// 6. 武将碎片
// ─────────────────────────────────────────────

/** 武将碎片记录 */
export interface FragmentData {
  /** 武将ID */
  generalId: string;
  /** 碎片数量 */
  count: number;
}

// ─────────────────────────────────────────────
// 7. 武将系统状态
// ─────────────────────────────────────────────

/**
 * 武将系统运行时状态
 *
 * 用于序列化/反序列化
 */
export interface HeroState {
  /** 已拥有的武将 Map<generalId, GeneralData> */
  generals: Record<string, GeneralData>;
  /** 武将碎片 Map<generalId, count> */
  fragments: Record<string, number>;
}

// ─────────────────────────────────────────────
// 8. 序列化
// ─────────────────────────────────────────────

/** 武将系统存档数据 */
export interface HeroSaveData {
  /** 存档版本号 */
  version: number;
  /** 武将状态 */
  state: HeroState;
}

// ─────────────────────────────────────────────
// 9. 品质概率配置
// ─────────────────────────────────────────────

/** 招募品质概率条目 */
export interface QualityProbability {
  /** 品质 */
  quality: Quality;
  /** 普通招募概率 (0~1) */
  normalRate: number;
  /** 高级招募概率 (0~1) */
  advancedRate: number;
}

// ─────────────────────────────────────────────
// 10. 升级经验配置
// ─────────────────────────────────────────────

/** 等级段经验配置 */
export interface LevelExpTier {
  /** 等级范围起始（含） */
  levelMin: number;
  /** 等级范围结束（含） */
  levelMax: number;
  /** 每级经验需求系数 */
  expPerLevel: number;
  /** 每级铜钱消耗系数 */
  goldPerLevel: number;
}
