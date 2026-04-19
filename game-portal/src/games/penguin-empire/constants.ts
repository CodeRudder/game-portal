/**
 * Penguin Empire（企鹅帝国）放置类游戏 — 常量定义
 *
 * 核心玩法：
 * - 点击/空格键获得冰块
 * - 建筑系统（冰屋、鱼塘、冰晶矿场、企鹅学校、冰雕工坊、企鹅皇宫）
 * - 声望系统（重置获得极光之力，永久加成）
 * - 离线收益
 * - 自动存档/读档
 */

/** Canvas 尺寸 */
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

/** 点击产生的冰块数量 */
export const ICE_PER_CLICK = 1;

/** 资源 ID 常量 */
export const RESOURCE_IDS = {
  ICE: 'ice',
  FISH: 'fish',
  COINS: 'coins',
  CRYSTAL: 'crystal',
} as const;

/** 建筑 ID 常量 */
export const BUILDING_IDS = {
  IGLOO: 'igloo',
  FISH_POND: 'fish-pond',
  CRYSTAL_MINE: 'crystal-mine',
  PENGUIN_SCHOOL: 'penguin-school',
  ICE_SCULPTURE_STUDIO: 'ice-sculpture-studio',
  PENGUIN_PALACE: 'penguin-palace',
} as const;

/** 建筑定义 */
export interface BuildingDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  baseCost: Record<string, number>;
  costMultiplier: number;
  maxLevel: number;
  productionResource: string; // 产出的资源 ID
  baseProduction: number; // 每级每秒基础产出
  unlockCondition?: Record<string, number>; // 解锁条件：资源 ID -> 最少数量
}

/** 建筑列表 */
export const BUILDINGS: BuildingDef[] = [
  {
    id: BUILDING_IDS.IGLOO,
    name: '冰屋',
    icon: '🏠',
    description: '企鹅的温馨冰屋，产出冰块',
    baseCost: { ice: 10 },
    costMultiplier: 1.15,
    maxLevel: 50,
    productionResource: RESOURCE_IDS.ICE,
    baseProduction: 0.5,
  },
  {
    id: BUILDING_IDS.FISH_POND,
    name: '鱼塘',
    icon: '🐟',
    description: '自动产出鱼的海水鱼塘',
    baseCost: { ice: 50 },
    costMultiplier: 1.18,
    maxLevel: 50,
    productionResource: RESOURCE_IDS.FISH,
    baseProduction: 0.3,
    unlockCondition: { ice: 30 },
  },
  {
    id: BUILDING_IDS.CRYSTAL_MINE,
    name: '冰晶矿场',
    icon: '⛏️',
    description: '开采珍贵的冰晶石',
    baseCost: { ice: 200, fish: 50 },
    costMultiplier: 1.2,
    maxLevel: 30,
    productionResource: RESOURCE_IDS.CRYSTAL,
    baseProduction: 0.1,
    unlockCondition: { ice: 100, fish: 20 },
  },
  {
    id: BUILDING_IDS.PENGUIN_SCHOOL,
    name: '企鹅学校',
    icon: '📚',
    description: '提升所有产出效率 5%/级',
    baseCost: { ice: 500, fish: 100 },
    costMultiplier: 1.25,
    maxLevel: 20,
    productionResource: RESOURCE_IDS.ICE,
    baseProduction: 0,
    unlockCondition: { ice: 300, fish: 50 },
  },
  {
    id: BUILDING_IDS.ICE_SCULPTURE_STUDIO,
    name: '冰雕工坊',
    icon: '🗿',
    description: '用冰块和鱼制作企鹅币',
    baseCost: { ice: 2000, fish: 500 },
    costMultiplier: 1.3,
    maxLevel: 30,
    productionResource: RESOURCE_IDS.COINS,
    baseProduction: 0.2,
    unlockCondition: { ice: 1000, fish: 200 },
  },
  {
    id: BUILDING_IDS.PENGUIN_PALACE,
    name: '企鹅皇宫',
    icon: '🏰',
    description: '声望建筑，提升极光之力获取',
    baseCost: { ice: 50000, fish: 10000, coins: 1000 },
    costMultiplier: 1.5,
    maxLevel: 10,
    productionResource: RESOURCE_IDS.CRYSTAL,
    baseProduction: 0.005,
    unlockCondition: { ice: 20000, fish: 5000, coins: 500 },
  },
];

/** 声望系统常量 */
export const PRESTIGE_MULTIPLIER = 0.02; // 每点极光之力提供 2% 加成
export const MIN_PRESTIGE_ICE = 10000; // 最低声望重置所需冰块

/** 数字格式化后缀 */
export const NUMBER_SUFFIXES: [number, string][] = [
  [1e18, 'Qi'],
  [1e15, 'Qa'],
  [1e12, 'T'],
  [1e9, 'B'],
  [1e6, 'M'],
  [1e3, 'K'],
];

/** 颜色主题 — 冰晶卡通风格 */
export const COLORS = {
  bgGradient1: '#0a1628',
  bgGradient2: '#1a3a5c',
  groundColor: '#b0d4e8',
  iceSurface: '#d6eef8',
  iceHighlight: '#e8f6ff',
  skyColor: '#0d1f3c',
  textPrimary: '#ffffff',
  textSecondary: '#a0c8e0',
  textDim: '#5080a0',
  accentBlue: '#4fc3f7',
  accentGold: '#ffd700',
  accentGreen: '#00e676',
  accentCyan: '#00e5ff',
  accentPurple: '#b388ff',
  panelBg: 'rgba(10, 30, 60, 0.85)',
  panelBorder: 'rgba(79, 195, 247, 0.3)',
  selectedBg: 'rgba(79, 195, 247, 0.15)',
  selectedBorder: 'rgba(79, 195, 247, 0.6)',
  affordable: '#00e676',
  unaffordable: '#ff4757',
  penguinBody: '#1a1a2e',
  penguinBelly: '#f0f0f0',
  penguinBeak: '#ff8c00',
  penguinFeet: '#ff6600',
  iceColor: '#81d4fa',
  fishColor: '#4fc3f7',
  coinsColor: '#ffd700',
  crystalColor: '#b388ff',
  auroraGreen: '#00e676',
  auroraBlue: '#4fc3f7',
  auroraPurple: '#b388ff',
  snowColor: '#ffffff',
} as const;

/** 升级列表面板参数 */
export const UPGRADE_PANEL = {
  startY: 280,
  itemHeight: 48,
  itemPadding: 4,
  itemMarginX: 12,
  itemWidth: CANVAS_WIDTH - 24,
  visibleCount: 6,
} as const;

/** 企鹅绘制参数 */
export const PENGUIN_DRAW = {
  centerX: 240,
  centerY: 180,
  size: 40,
} as const;

/** 资源图标映射 */
export const RESOURCE_ICONS: Record<string, string> = {
  [RESOURCE_IDS.ICE]: '🧊',
  [RESOURCE_IDS.FISH]: '🐟',
  [RESOURCE_IDS.COINS]: '🪙',
  [RESOURCE_IDS.CRYSTAL]: '💎',
};

/** 资源名称映射 */
export const RESOURCE_NAMES: Record<string, string> = {
  [RESOURCE_IDS.ICE]: '冰块',
  [RESOURCE_IDS.FISH]: '鱼',
  [RESOURCE_IDS.COINS]: '企鹅币',
  [RESOURCE_IDS.CRYSTAL]: '冰晶石',
};

/** 场景中最大企鹅数量 */
export const MAX_VISIBLE_PENGUINS = 8;

/** 企鹅行走速度（像素/秒） */
export const PENGUIN_WALK_SPEED = 25;

/** 飘字效果持续时间（毫秒） */
export const FLOATING_TEXT_DURATION = 1000;
