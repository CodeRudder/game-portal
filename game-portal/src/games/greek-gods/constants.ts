/**
 * 希腊众神 (Greek Gods) — 放置类游戏常量定义
 *
 * 核心玩法：
 * - 点击获得金币 (gold)
 * - 建设神殿建筑，自动产出资源
 * - 积累三种资源：金币、信仰、荣耀
 * - 众神恩赐系统（类似声望）：获得众神庇护，提供永久加成
 * - 离线收益
 */

/** Canvas 尺寸 */
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ========== 资源 ID ==========

export const RESOURCE_IDS = {
  GOLD: 'gold',
  FAITH: 'faith',
  GLORY: 'glory',
} as const;

// ========== 核心常量 ==========

/** 点击获得的金币数 */
export const GOLD_PER_CLICK = 1;

/** 声望（众神恩赐）加成系数（每点恩赐增加的产出倍率） */
export const BLESSING_BONUS_MULTIPLIER = 0.15; // 15% per blessing

/** 声望货币计算基数 */
export const PRESTIGE_BASE_BLESSING = 1;

/** 声望所需最低金币总量 */
export const MIN_PRESTIGE_GOLD = 50000;

// ========== 建筑 ID ==========

export const BUILDING_IDS = {
  TEMPLE_OF_ZEUS: 'temple_of_zeus',
  SHRINE_OF_ATHENA: 'shrine_of_athena',
  FORGE_OF_HEPHAESTUS: 'forge_of_hephaestus',
  GARDEN_OF_DEMETER: 'garden_of_demeter',
  LIBRARY_OF_APOLLO: 'library_of_apollo',
  BARRACKS_OF_ARES: 'barracks_of_ares',
  ARENA: 'arena',
  ORACLE_OF_DELPHI: 'oracle_of_delphi',
} as const;

// ========== 建筑定义 ==========

export interface BuildingDef {
  id: string;
  name: string;
  icon: string;
  /** 基础费用 */
  baseCost: Record<string, number>;
  /** 费用递增系数 */
  costMultiplier: number;
  /** 最大等级 */
  maxLevel: number;
  /** 产出资源 */
  productionResource: string;
  /** 每级基础产出 */
  baseProduction: number;
  /** 前置建筑（需达到指定等级） */
  requires?: string[];
}

/** 建筑列表 */
export const BUILDINGS: BuildingDef[] = [
  {
    id: 'temple_of_zeus',
    name: '宙斯神殿',
    icon: '⚡',
    baseCost: { gold: 15 },
    costMultiplier: 1.15,
    maxLevel: 50,
    productionResource: 'gold',
    baseProduction: 0.5,
  },
  {
    id: 'shrine_of_athena',
    name: '雅典娜圣坛',
    icon: '🦉',
    baseCost: { gold: 120 },
    costMultiplier: 1.18,
    maxLevel: 30,
    productionResource: 'faith',
    baseProduction: 0.3,
    requires: ['temple_of_zeus'],
  },
  {
    id: 'forge_of_hephaestus',
    name: '赫淮斯托斯锻造场',
    icon: '🔥',
    baseCost: { gold: 600 },
    costMultiplier: 1.2,
    maxLevel: 30,
    productionResource: 'gold',
    baseProduction: 5,
    requires: ['temple_of_zeus'],
  },
  {
    id: 'garden_of_demeter',
    name: '德墨忒尔花园',
    icon: '🌾',
    baseCost: { gold: 3000, faith: 20 },
    costMultiplier: 1.22,
    maxLevel: 20,
    productionResource: 'faith',
    baseProduction: 0.8,
    requires: ['shrine_of_athena', 'forge_of_hephaestus'],
  },
  {
    id: 'library_of_apollo',
    name: '阿波罗图书馆',
    icon: '📜',
    baseCost: { gold: 15000, faith: 100 },
    costMultiplier: 1.25,
    maxLevel: 15,
    productionResource: 'faith',
    baseProduction: 2,
    requires: ['shrine_of_athena'],
  },
  {
    id: 'barracks_of_ares',
    name: '阿瑞斯兵营',
    icon: '⚔️',
    baseCost: { gold: 50000, faith: 300 },
    costMultiplier: 1.28,
    maxLevel: 15,
    productionResource: 'glory',
    baseProduction: 0.5,
    requires: ['forge_of_hephaestus'],
  },
  {
    id: 'arena',
    name: '竞技场',
    icon: '🏟️',
    baseCost: { gold: 200000, faith: 500, glory: 30 },
    costMultiplier: 1.3,
    maxLevel: 10,
    productionResource: 'glory',
    baseProduction: 1.5,
    requires: ['barracks_of_ares', 'library_of_apollo'],
  },
  {
    id: 'oracle_of_delphi',
    name: '德尔斐神谕所',
    icon: '🔮',
    baseCost: { gold: 1000000, faith: 2000, glory: 200 },
    costMultiplier: 1.35,
    maxLevel: 10,
    productionResource: 'glory',
    baseProduction: 5,
    requires: ['arena', 'garden_of_demeter'],
  },
];

// ========== 众神定义 ==========

export interface GodDef {
  id: string;
  name: string;
  icon: string;
  /** 解锁所需金币 */
  unlockCost: number;
  /** 能力类型 */
  bonusType: 'click' | 'gold_production' | 'faith_production' | 'glory_production' | 'all';
  /** 能力值（百分比加成，0.1 = 10%） */
  bonusValue: number;
  /** 描述 */
  description: string;
  /** 颜色（Canvas 绘制用） */
  color: string;
  /** 光环颜色 */
  auraColor: string;
  /** 恩赐加成倍率 */
  blessingMultiplier: number;
}

/** 众神列表 */
export const GODS: GodDef[] = [
  {
    id: 'zeus',
    name: '宙斯',
    icon: '⚡',
    unlockCost: 0,
    bonusType: 'click',
    bonusValue: 0.1,
    description: '点击产金 +10%',
    color: '#FFD700',
    auraColor: '#FFF8DC',
    blessingMultiplier: 1.5,
  },
  {
    id: 'athena',
    name: '雅典娜',
    icon: '🦉',
    unlockCost: 1000,
    bonusType: 'gold_production',
    bonusValue: 0.15,
    description: '金币产出 +15%',
    color: '#4169E1',
    auraColor: '#B0C4DE',
    blessingMultiplier: 1.4,
  },
  {
    id: 'poseidon',
    name: '波塞冬',
    icon: '🔱',
    unlockCost: 5000,
    bonusType: 'faith_production',
    bonusValue: 0.2,
    description: '信仰产出 +20%',
    color: '#008B8B',
    auraColor: '#AFEEEE',
    blessingMultiplier: 1.6,
  },
  {
    id: 'aphrodite',
    name: '阿佛洛狄忒',
    icon: '🌹',
    unlockCost: 15000,
    bonusType: 'faith_production',
    bonusValue: 0.15,
    description: '信仰产出 +15%',
    color: '#FF69B4',
    auraColor: '#FFB6C1',
    blessingMultiplier: 1.3,
  },
  {
    id: 'hermes',
    name: '赫尔墨斯',
    icon: '👟',
    unlockCost: 50000,
    bonusType: 'click',
    bonusValue: 0.25,
    description: '点击产金 +25%',
    color: '#DAA520',
    auraColor: '#EEE8AA',
    blessingMultiplier: 1.7,
  },
  {
    id: 'ares',
    name: '阿瑞斯',
    icon: '⚔️',
    unlockCost: 150000,
    bonusType: 'glory_production',
    bonusValue: 0.3,
    description: '荣耀产出 +30%',
    color: '#B22222',
    auraColor: '#CD5C5C',
    blessingMultiplier: 2.0,
  },
  {
    id: 'apollo',
    name: '阿波罗',
    icon: '☀️',
    unlockCost: 500000,
    bonusType: 'all',
    bonusValue: 0.2,
    description: '所有产出 +20%',
    color: '#FF8C00',
    auraColor: '#FFD700',
    blessingMultiplier: 1.8,
  },
  {
    id: 'hades',
    name: '哈迪斯',
    icon: '💀',
    unlockCost: 2000000,
    bonusType: 'all',
    bonusValue: 0.35,
    description: '所有产出 +35%',
    color: '#4B0082',
    auraColor: '#9370DB',
    blessingMultiplier: 2.2,
  },
];

// ========== 颜色主题（古希腊风格：金色/白色/蓝色） ==========

export const COLORS = {
  bgGradient1: '#0D1B2A',
  bgGradient2: '#1B2838',
  groundLight: '#C4A35A',
  groundDark: '#8B7340',
  skyTop: '#0D1B2A',
  skyBottom: '#1B3A5C',
  textPrimary: '#FFF8DC',
  textSecondary: '#D4C5A0',
  textDim: '#8B7D6B',
  accent: '#FFD700',
  accentGreen: '#76FF03',
  accentRed: '#FF1744',
  accentBlue: '#40C4FF',
  panelBg: 'rgba(13, 27, 42, 0.9)',
  panelBorder: 'rgba(255, 215, 0, 0.3)',
  selectedBg: 'rgba(255, 215, 0, 0.15)',
  selectedBorder: 'rgba(255, 215, 0, 0.6)',
  affordable: '#76FF03',
  unaffordable: '#FF1744',
  goldColor: '#FFD700',
  faithColor: '#40C4FF',
  gloryColor: '#FF6F00',
  templeColor: '#D4A44C',
  columnColor: '#E8DCC8',
  pillarShadow: 'rgba(0,0,0,0.3)',
  starColor: '#FFF8DC',
  lightningColor: '#FFD700',
} as const;

// ========== 渲染参数 ==========

export const TEMPLE_DRAW = {
  centerX: 240,
  centerY: 200,
  bodyWidth: 70,
  bodyHeight: 50,
  roofHeight: 35,
  pillarWidth: 8,
  pillarHeight: 40,
  pillarCount: 4,
} as const;

/** 建筑列表面板参数 */
export const BUILDING_PANEL = {
  startY: 360,
  itemHeight: 42,
  itemPadding: 4,
  itemMarginX: 12,
  itemWidth: CANVAS_WIDTH - 24,
  visibleCount: 8,
} as const;

/** 资源面板参数 */
export const RESOURCE_PANEL = {
  startY: 8,
  itemHeight: 24,
  itemPadding: 4,
  padding: 8,
} as const;
