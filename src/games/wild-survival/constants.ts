/**
 * 野外求生 (Wild Survival) — 放置类游戏常量定义
 *
 * 核心玩法：
 * - 点击获得石头 (stone)
 * - 建造营地建筑，自动产出资源
 * - 三种核心资源：石头、食物、毛皮
 * - 季节系统：春夏秋冬循环，影响资源产出
 * - 生存技能树：解锁被动技能提升能力
 * - 声望系统：重置进度获得远古智慧，提供永久加成
 * - 离线收益
 */

/** Canvas 尺寸 */
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ========== 资源 ID ==========

export const RESOURCE_IDS = {
  STONE: 'stone',
  FOOD: 'food',
  FUR: 'fur',
} as const;

// ========== 建筑 ID ==========

export const BUILDING_IDS = {
  CAMPFIRE: 'campfire',
  SHELTER: 'shelter',
  TRAP: 'trap',
  QUARRY: 'quarry',
  TANNERY: 'tannery',
  WORKSHOP: 'workshop',
  WATCHTOWER: 'watchtower',
  FORTRESS: 'fortress',
} as const;

// ========== 核心常量 ==========

/** 点击获得的石头数 */
export const STONE_PER_CLICK = 1;

/** 声望加成系数（每远古智慧增加的产出倍率） */
export const WISDOM_BONUS_MULTIPLIER = 0.12; // 12% per wisdom

/** 声望货币计算基数 */
export const PRESTIGE_BASE_WISDOM = 1;

/** 声望所需最低石头总量 */
export const MIN_PRESTIGE_STONE = 50000;

// ========== 季节系统 ==========

/** 季节枚举 */
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

/** 季节名称 */
export const SEASON_NAMES: Record<Season, string> = {
  spring: '春',
  summer: '夏',
  autumn: '秋',
  winter: '冬',
};

/** 季节图标 */
export const SEASON_ICONS: Record<Season, string> = {
  spring: '🌸',
  summer: '☀️',
  autumn: '🍂',
  winter: '❄️',
};

/** 季节产出倍率 */
export const SEASON_MULTIPLIERS: Record<Season, number> = {
  spring: 1.0,
  summer: 1.3,
  autumn: 1.1,
  winter: 0.6,
};

/** 每个季节持续毫秒（游戏内时间，30秒=一个季节） */
export const SEASON_DURATION = 30_000;

/** 季节顺序 */
export const SEASON_ORDER: Season[] = ['spring', 'summer', 'autumn', 'winter'];

// ========== 技能树 ==========

export interface SkillDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  maxLevel: number;
  /** 技能类型 */
  type: 'click' | 'production' | 'season_resist' | 'unlock_resource' | 'all';
  /** 每级加成值 */
  bonusPerLevel: number;
  /** 解锁需要的前置技能 */
  requires?: string[];
  /** 学习费用（石头） */
  cost: number;
  /** 费用递增系数 */
  costMultiplier: number;
}

/** 技能列表 */
export const SKILLS: SkillDef[] = [
  {
    id: 'stone_mastery',
    name: '采石术',
    icon: '⛏️',
    description: '点击产出 +20%',
    maxLevel: 10,
    type: 'click',
    bonusPerLevel: 0.2,
    cost: 50,
    costMultiplier: 1.5,
  },
  {
    id: 'foraging',
    name: '觅食术',
    icon: '🌿',
    description: '食物产出 +25%',
    maxLevel: 10,
    type: 'production',
    bonusPerLevel: 0.25,
    cost: 100,
    costMultiplier: 1.6,
  },
  {
    id: 'hunting',
    name: '狩猎术',
    icon: '🏹',
    description: '毛皮产出 +25%',
    maxLevel: 10,
    type: 'production',
    bonusPerLevel: 0.25,
    cost: 100,
    costMultiplier: 1.6,
  },
  {
    id: 'winter_craft',
    name: '御寒术',
    icon: '🔥',
    description: '减少冬季产出惩罚 15%',
    maxLevel: 5,
    type: 'season_resist',
    bonusPerLevel: 0.15,
    cost: 200,
    costMultiplier: 1.8,
    requires: ['stone_mastery'],
  },
  {
    id: 'advanced_mining',
    name: '高级采矿',
    icon: '💎',
    description: '所有产出 +15%',
    maxLevel: 10,
    type: 'all',
    bonusPerLevel: 0.15,
    cost: 500,
    costMultiplier: 2.0,
    requires: ['stone_mastery'],
  },
  {
    id: 'survival_instinct',
    name: '求生本能',
    icon: '🏕️',
    description: '所有产出 +10%',
    maxLevel: 10,
    type: 'all',
    bonusPerLevel: 0.1,
    cost: 300,
    costMultiplier: 1.7,
    requires: ['foraging', 'hunting'],
  },
];

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
    id: 'campfire',
    name: '篝火',
    icon: '🔥',
    baseCost: { stone: 10 },
    costMultiplier: 1.15,
    maxLevel: 50,
    productionResource: 'stone',
    baseProduction: 0.5,
  },
  {
    id: 'shelter',
    name: '庇护所',
    icon: '🏠',
    baseCost: { stone: 80 },
    costMultiplier: 1.18,
    maxLevel: 30,
    productionResource: 'food',
    baseProduction: 0.3,
    requires: ['campfire'],
  },
  {
    id: 'trap',
    name: '陷阱',
    icon: '🪤',
    baseCost: { stone: 50, food: 20 },
    costMultiplier: 1.16,
    maxLevel: 40,
    productionResource: 'fur',
    baseProduction: 0.2,
    requires: ['campfire'],
  },
  {
    id: 'quarry',
    name: '采石场',
    icon: '⛏️',
    baseCost: { stone: 400 },
    costMultiplier: 1.2,
    maxLevel: 30,
    productionResource: 'stone',
    baseProduction: 4,
    requires: ['campfire'],
  },
  {
    id: 'tannery',
    name: '制革坊',
    icon: '🧥',
    baseCost: { stone: 300, fur: 30 },
    costMultiplier: 1.22,
    maxLevel: 25,
    productionResource: 'fur',
    baseProduction: 0.8,
    requires: ['trap'],
  },
  {
    id: 'workshop',
    name: '工坊',
    icon: '🔨',
    baseCost: { stone: 800, food: 100 },
    costMultiplier: 1.25,
    maxLevel: 20,
    productionResource: 'stone',
    baseProduction: 10,
    requires: ['quarry', 'shelter'],
  },
  {
    id: 'watchtower',
    name: '瞭望塔',
    icon: '🗼',
    baseCost: { stone: 3000, food: 200, fur: 100 },
    costMultiplier: 1.28,
    maxLevel: 15,
    productionResource: 'food',
    baseProduction: 5,
    requires: ['workshop', 'tannery'],
  },
  {
    id: 'fortress',
    name: '堡垒',
    icon: '🏰',
    baseCost: { stone: 15000, food: 1000, fur: 500 },
    costMultiplier: 1.3,
    maxLevel: 10,
    productionResource: 'stone',
    baseProduction: 50,
    requires: ['watchtower'],
  },
];

// ========== 颜色主题（荒野求生风格：绿色/棕色/土黄色） ==========

export const COLORS = {
  bgGradient1: '#1B3A2D',
  bgGradient2: '#0D1F17',
  groundLight: '#3E5C3A',
  groundDark: '#2A3F28',
  skyTop: '#1A3C5E',
  skyBottom: '#2D6B4A',
  textPrimary: '#E8F5E9',
  textSecondary: '#A5D6A7',
  textDim: '#6B8F71',
  accent: '#FFB300',
  accentGreen: '#76FF03',
  accentRed: '#FF1744',
  accentBlue: '#40C4FF',
  panelBg: 'rgba(27, 58, 45, 0.9)',
  panelBorder: 'rgba(255, 179, 0, 0.3)',
  selectedBg: 'rgba(255, 179, 0, 0.15)',
  selectedBorder: 'rgba(255, 179, 0, 0.6)',
  affordable: '#76FF03',
  unaffordable: '#FF1744',
  stoneColor: '#9E9E9E',
  foodColor: '#66BB6A',
  furColor: '#8D6E63',
  fireColor: '#FF6F00',
  treeGreen: '#2E7D32',
  treeDark: '#1B5E20',
  mountainColor: '#5D4037',
  snowColor: '#E0E0E0',
  campColor: '#FF8F00',
} as const;

// ========== 渲染参数 ==========

export const CAMP_DRAW = {
  centerX: 240,
  centerY: 220,
  tentWidth: 80,
  tentHeight: 50,
  fireRadius: 12,
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

/** 季节面板参数 */
export const SEASON_PANEL = {
  x: CANVAS_WIDTH - 100,
  y: 8,
  width: 90,
  height: 28,
} as const;
