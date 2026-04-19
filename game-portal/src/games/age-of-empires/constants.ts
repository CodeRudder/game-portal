/**
 * 帝国时代 (Age of Empires) — 放置类游戏常量定义
 *
 * 核心玩法：
 * - 点击获得食物 (food)
 * - 建设中世纪建筑，自动产出食物、木材、石头
 * - 时代演进系统（黑暗时代 → 封建时代 → 城堡时代 → 帝王时代）
 * - 文明升级系统
 * - 声望系统：重置进度获得帝国荣耀，提供永久加成
 * - 离线收益
 */

/** Canvas 尺寸 */
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ========== 资源 ID ==========

export const RESOURCE_IDS = {
  FOOD: 'food',
  WOOD: 'wood',
  STONE: 'stone',
} as const;

// ========== 点击常量 ==========

/** 点击获得的食物数 */
export const FOOD_PER_CLICK = 1;

// ========== 声望常量 ==========

/** 声望加成系数（每帝国荣耀增加的产出倍率） */
export const GLORY_BONUS_MULTIPLIER = 0.15; // 15% per glory

/** 声望货币计算基数 */
export const PRESTIGE_BASE_GLORY = 1;

/** 声望所需最低食物总量 */
export const MIN_PRESTIGE_FOOD = 50000;

// ========== 建筑 ID ==========

export const BUILDING_IDS = {
  FARM: 'farm',
  LUMBER_CAMP: 'lumber_camp',
  STONE_QUARRY: 'stone_quarry',
  MARKET: 'market',
  BLACKSMITH: 'blacksmith',
  CASTLE: 'castle',
  UNIVERSITY: 'university',
  WONDER: 'wonder',
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
    id: 'farm',
    name: '农场',
    icon: '🌾',
    baseCost: { food: 15 },
    costMultiplier: 1.15,
    maxLevel: 50,
    productionResource: 'food',
    baseProduction: 0.5,
  },
  {
    id: 'lumber_camp',
    name: '伐木场',
    icon: '🪓',
    baseCost: { food: 100 },
    costMultiplier: 1.18,
    maxLevel: 40,
    productionResource: 'wood',
    baseProduction: 0.3,
    requires: ['farm'],
  },
  {
    id: 'stone_quarry',
    name: '采石场',
    icon: '⛏️',
    baseCost: { food: 200, wood: 50 },
    costMultiplier: 1.2,
    maxLevel: 30,
    productionResource: 'stone',
    baseProduction: 0.2,
    requires: ['lumber_camp'],
  },
  {
    id: 'market',
    name: '市场',
    icon: '🏪',
    baseCost: { food: 500, wood: 200 },
    costMultiplier: 1.22,
    maxLevel: 25,
    productionResource: 'food',
    baseProduction: 3,
    requires: ['lumber_camp'],
  },
  {
    id: 'blacksmith',
    name: '铁匠铺',
    icon: '🔨',
    baseCost: { food: 1000, wood: 500, stone: 100 },
    costMultiplier: 1.25,
    maxLevel: 20,
    productionResource: 'wood',
    baseProduction: 2,
    requires: ['stone_quarry', 'market'],
  },
  {
    id: 'castle',
    name: '城堡',
    icon: '🏰',
    baseCost: { food: 5000, wood: 2000, stone: 1000 },
    costMultiplier: 1.3,
    maxLevel: 15,
    productionResource: 'stone',
    baseProduction: 1.5,
    requires: ['blacksmith'],
  },
  {
    id: 'university',
    name: '大学',
    icon: '📚',
    baseCost: { food: 10000, wood: 5000, stone: 3000 },
    costMultiplier: 1.35,
    maxLevel: 10,
    productionResource: 'food',
    baseProduction: 10,
    requires: ['castle'],
  },
  {
    id: 'wonder',
    name: '奇迹',
    icon: '🏛️',
    baseCost: { food: 50000, wood: 30000, stone: 20000 },
    costMultiplier: 1.5,
    maxLevel: 5,
    productionResource: 'food',
    baseProduction: 50,
    requires: ['university'],
  },
];

// ========== 时代定义 ==========

export interface AgeDef {
  id: string;
  name: string;
  icon: string;
  /** 升级所需食物 */
  foodCost: number;
  /** 升级所需木材 */
  woodCost: number;
  /** 升级所需石头 */
  stoneCost: number;
  /** 产出倍率加成 */
  productionBonus: number;
  /** 点击倍率加成 */
  clickBonus: number;
  /** 描述 */
  description: string;
}

/** 时代列表（按顺序） */
export const AGES: AgeDef[] = [
  {
    id: 'dark_age',
    name: '黑暗时代',
    icon: '🌑',
    foodCost: 0,
    woodCost: 0,
    stoneCost: 0,
    productionBonus: 1.0,
    clickBonus: 1.0,
    description: '文明的起点，一切从零开始',
  },
  {
    id: 'feudal_age',
    name: '封建时代',
    icon: '🏰',
    foodCost: 500,
    woodCost: 200,
    stoneCost: 0,
    productionBonus: 1.5,
    clickBonus: 1.2,
    description: '建立封建制度，解锁更多建筑',
  },
  {
    id: 'castle_age',
    name: '城堡时代',
    icon: '⚔️',
    foodCost: 3000,
    woodCost: 1500,
    stoneCost: 500,
    productionBonus: 2.5,
    clickBonus: 1.5,
    description: '建造城堡，强化军事和经济',
  },
  {
    id: 'imperial_age',
    name: '帝王时代',
    icon: '👑',
    foodCost: 15000,
    woodCost: 8000,
    stoneCost: 5000,
    productionBonus: 5.0,
    clickBonus: 2.0,
    description: '帝国鼎盛，文明达到巅峰',
  },
];

// ========== 文明升级定义 ==========

export interface CivilizationUpgradeDef {
  id: string;
  name: string;
  icon: string;
  /** 所需最低时代 */
  requiredAge: string;
  /** 费用 */
  cost: Record<string, number>;
  /** 效果类型 */
  effectType: 'click' | 'production' | 'food' | 'wood' | 'stone' | 'all';
  /** 效果值 */
  effectValue: number;
  /** 描述 */
  description: string;
}

/** 文明升级列表 */
export const CIVILIZATION_UPGRADES: CivilizationUpgradeDef[] = [
  {
    id: 'wheelbarrow',
    name: '手推车',
    icon: '🛒',
    requiredAge: 'dark_age',
    cost: { food: 200 },
    effectType: 'food',
    effectValue: 0.25,
    description: '食物产出 +25%',
  },
  {
    id: 'double_bit_axe',
    name: '双刃斧',
    icon: '🪓',
    requiredAge: 'feudal_age',
    cost: { food: 300, wood: 150 },
    effectType: 'wood',
    effectValue: 0.3,
    description: '木材产出 +30%',
  },
  {
    id: 'stone_masonry',
    name: '石工术',
    icon: '🧱',
    requiredAge: 'feudal_age',
    cost: { food: 400, stone: 100 },
    effectType: 'stone',
    effectValue: 0.3,
    description: '石头产出 +30%',
  },
  {
    id: 'loom',
    name: '织布机',
    icon: '🧵',
    requiredAge: 'dark_age',
    cost: { food: 150 },
    effectType: 'click',
    effectValue: 0.15,
    description: '点击食物 +15%',
  },
  {
    id: 'iron_casting',
    name: '铸铁术',
    icon: '⚒️',
    requiredAge: 'castle_age',
    cost: { food: 1000, wood: 500, stone: 200 },
    effectType: 'all',
    effectValue: 0.5,
    description: '所有产出 +50%',
  },
  {
    id: 'crop_rotation',
    name: '轮作制',
    icon: '🌱',
    requiredAge: 'castle_age',
    cost: { food: 2000, wood: 800 },
    effectType: 'food',
    effectValue: 0.5,
    description: '食物产出 +50%',
  },
  {
    id: 'banking',
    name: '银行业',
    icon: '🏦',
    requiredAge: 'imperial_age',
    cost: { food: 5000, wood: 2000, stone: 1000 },
    effectType: 'production',
    effectValue: 1.0,
    description: '所有建筑产出翻倍',
  },
  {
    id: 'chemistry',
    name: '化学',
    icon: '⚗️',
    requiredAge: 'imperial_age',
    cost: { food: 8000, wood: 3000, stone: 2000 },
    effectType: 'all',
    effectValue: 0.75,
    description: '所有产出 +75%',
  },
];

// ========== 颜色主题（中世纪风格：金色/棕色/深绿） ==========

export const COLORS = {
  bgGradient1: '#2C1810',
  bgGradient2: '#1A0F0A',
  groundLight: '#5D4E37',
  groundDark: '#3E2F1E',
  skyTop: '#1A237E',
  skyBottom: '#4A148C',
  textPrimary: '#FFF8E1',
  textSecondary: '#D7CCC8',
  textDim: '#8D6E63',
  accent: '#FFB300',
  accentGreen: '#76FF03',
  accentRed: '#FF1744',
  accentBlue: '#40C4FF',
  panelBg: 'rgba(62, 39, 35, 0.9)',
  panelBorder: 'rgba(255, 179, 0, 0.3)',
  selectedBg: 'rgba(255, 179, 0, 0.15)',
  selectedBorder: 'rgba(255, 179, 0, 0.6)',
  affordable: '#76FF03',
  unaffordable: '#FF1744',
  castleColor: '#78909C',
  castleRoof: '#D32F2F',
  castleWindow: '#FFF176',
  castleFlag: '#FFB300',
  castleStone: '#90A4AE',
  treeGreen: '#2E7D32',
  treeTrunk: '#5D4037',
  waterColor: '#1565C0',
  torchColor: '#FF6F00',
  torchGlow: 'rgba(255, 111, 0, 0.3)',
} as const;

// ========== 渲染参数 ==========

export const CASTLE_DRAW = {
  centerX: 240,
  centerY: 200,
  castleWidth: 80,
  castleHeight: 60,
  towerWidth: 20,
  towerHeight: 80,
  flagHeight: 25,
} as const;

/** 建筑列表面板参数 */
export const BUILDING_PANEL = {
  startY: 360,
  itemHeight: 42,
  itemPadding: 4,
  itemMarginX: 12,
  itemWidth: CANVAS_WIDTH - 24,
  visibleCount: 6,
} as const;

/** 资源面板参数 */
export const RESOURCE_PANEL = {
  startY: 8,
  itemHeight: 24,
  itemPadding: 4,
  padding: 8,
} as const;
