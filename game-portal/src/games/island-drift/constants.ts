/**
 * 海岛漂流 (Island Drift) — 放置类游戏常量定义
 *
 * 核心玩法：
 * - 点击收集木材 (wood)
 * - 建设岛屿建筑，自动产出资源
 * - 探险系统：派遣探险队发现新岛屿
 * - 岛屿解锁：逐步解锁新的岛屿区域
 * - 声望系统：重置进度获得「漂流瓶」，提供永久加成
 * - 离线收益
 */

/** Canvas 尺寸 */
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ========== 资源常量 ==========

/** 资源 ID */
export const RESOURCE_IDS = {
  WOOD: 'wood',
  FOOD: 'food',
  SHELL: 'shell',
} as const;

/** 点击获得的木材数 */
export const WOOD_PER_CLICK = 1;

/** 声望加成系数（每漂流瓶增加的产出倍率） */
export const PRESTIGE_BONUS_MULTIPLIER = 0.12; // 12% per bottle

/** 声望货币计算基数 */
export const PRESTIGE_BASE_BOTTLES = 1;

/** 声望所需最低木材总量 */
export const MIN_PRESTIGE_WOOD = 50000;

// ========== 岛屿定义 ==========

export interface IslandDef {
  id: string;
  name: string;
  icon: string;
  /** 解锁所需木材 */
  unlockCost: number;
  /** 探险奖励倍率 */
  rewardMultiplier: number;
  /** 描述 */
  description: string;
  /** 颜色主题 */
  color: string;
  /** 岛屿在 Canvas 上的位置 */
  x: number;
  y: number;
  /** 岛屿大小 */
  radius: number;
}

/** 岛屿列表 */
export const ISLANDS: IslandDef[] = [
  {
    id: 'beach_island',
    name: '沙滩岛',
    icon: '🏝️',
    unlockCost: 0,
    rewardMultiplier: 1,
    description: '初始岛屿，温暖宜人',
    color: '#FFE082',
    x: 240,
    y: 180,
    radius: 40,
  },
  {
    id: 'forest_island',
    name: '密林岛',
    icon: '🌴',
    unlockCost: 500,
    rewardMultiplier: 1.5,
    description: '茂密丛林，木材丰富',
    color: '#66BB6A',
    x: 140,
    y: 250,
    radius: 35,
  },
  {
    id: 'coral_island',
    name: '珊瑚岛',
    icon: '🐠',
    unlockCost: 3000,
    rewardMultiplier: 2,
    description: '五彩珊瑚，贝壳宝库',
    color: '#FF8A65',
    x: 340,
    y: 230,
    radius: 35,
  },
  {
    id: 'volcano_island',
    name: '火山岛',
    icon: '🌋',
    unlockCost: 15000,
    rewardMultiplier: 3,
    description: '危险但资源丰富',
    color: '#EF5350',
    x: 200,
    y: 320,
    radius: 38,
  },
  {
    id: 'ice_island',
    name: '冰晶岛',
    icon: '❄️',
    unlockCost: 80000,
    rewardMultiplier: 5,
    description: '极寒之地，珍贵资源',
    color: '#81D4FA',
    x: 300,
    y: 150,
    radius: 32,
  },
];

// ========== 建筑定义 ==========

/** 建筑 ID */
export const BUILDING_IDS = [
  'shelter',
  'fishing_hut',
  'workshop',
  'farm',
  'lighthouse',
  'dock',
  'warehouse',
  'temple',
] as const;

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
    id: 'shelter',
    name: '庇护所',
    icon: '🏕️',
    baseCost: { wood: 10 },
    costMultiplier: 1.15,
    maxLevel: 50,
    productionResource: 'wood',
    baseProduction: 0.5,
  },
  {
    id: 'fishing_hut',
    name: '渔屋',
    icon: '🎣',
    baseCost: { wood: 50 },
    costMultiplier: 1.18,
    maxLevel: 40,
    productionResource: 'food',
    baseProduction: 0.3,
    requires: ['shelter'],
  },
  {
    id: 'workshop',
    name: '工坊',
    icon: '🔨',
    baseCost: { wood: 200, food: 20 },
    costMultiplier: 1.2,
    maxLevel: 30,
    productionResource: 'wood',
    baseProduction: 3,
    requires: ['shelter'],
  },
  {
    id: 'farm',
    name: '农场',
    icon: '🌾',
    baseCost: { wood: 500, food: 50 },
    costMultiplier: 1.22,
    maxLevel: 30,
    productionResource: 'food',
    baseProduction: 2,
    requires: ['fishing_hut', 'workshop'],
  },
  {
    id: 'lighthouse',
    name: '灯塔',
    icon: '🗼',
    baseCost: { wood: 2000, food: 200, shell: 30 },
    costMultiplier: 1.25,
    maxLevel: 20,
    productionResource: 'shell',
    baseProduction: 0.2,
    requires: ['farm'],
  },
  {
    id: 'dock',
    name: '码头',
    icon: '⚓',
    baseCost: { wood: 5000, food: 500, shell: 100 },
    costMultiplier: 1.28,
    maxLevel: 20,
    productionResource: 'food',
    baseProduction: 8,
    requires: ['lighthouse'],
  },
  {
    id: 'warehouse',
    name: '仓库',
    icon: '🏗️',
    baseCost: { wood: 15000, shell: 300 },
    costMultiplier: 1.3,
    maxLevel: 15,
    productionResource: 'wood',
    baseProduction: 15,
    requires: ['dock'],
  },
  {
    id: 'temple',
    name: '神殿',
    icon: '🏛️',
    baseCost: { wood: 50000, food: 5000, shell: 1000 },
    costMultiplier: 1.35,
    maxLevel: 10,
    productionResource: 'shell',
    baseProduction: 1,
    requires: ['warehouse'],
  },
];

// ========== 颜色主题（海岛风格：蓝色/绿色/沙色） ==========

export const COLORS = {
  bgGradient1: '#0D47A1',
  bgGradient2: '#01579B',
  oceanLight: '#1976D2',
  oceanDark: '#0D47A1',
  sandLight: '#FFE082',
  sandDark: '#FFB74D',
  skyTop: '#039BE5',
  skyBottom: '#4FC3F7',
  waveColor: '#29B6F6',
  foamColor: '#E1F5FE',
  textPrimary: '#FFFFFF',
  textSecondary: '#B3E5FC',
  textDim: '#4FC3F7',
  accent: '#FFB300',
  accentGreen: '#69F0AE',
  accentRed: '#FF5252',
  accentBlue: '#40C4FF',
  panelBg: 'rgba(13, 71, 161, 0.85)',
  panelBorder: 'rgba(255, 179, 0, 0.3)',
  selectedBg: 'rgba(255, 179, 0, 0.15)',
  selectedBorder: 'rgba(255, 179, 0, 0.6)',
  affordable: '#69F0AE',
  unaffordable: '#FF5252',
  islandShadow: 'rgba(0,0,0,0.3)',
  woodColor: '#8D6E63',
  foodColor: '#FF8A65',
  shellColor: '#FFE082',
  palmColor: '#4CAF50',
  trunkColor: '#795548',
  sailColor: '#FAFAFA',
  boatColor: '#5D4037',
} as const;

// ========== 渲染参数 ==========

export const ISLAND_DRAW = {
  centerX: 240,
  centerY: 220,
  palmWidth: 8,
  palmHeight: 50,
  leafLength: 25,
  boatX: 380,
  boatY: 350,
  boatWidth: 40,
  boatHeight: 15,
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
