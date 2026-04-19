/**
 * Kittens Kingdom（猫咪王国）放置类游戏 — 常量定义
 */

/** Canvas 尺寸 */
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

/** 点击产生的鱼干数量 */
export const FISH_PER_CLICK = 1;

/** 资源 ID 常量 */
export const RESOURCE_IDS = {
  FISH: 'fish',
  CATNIP: 'catnip',
  YARN: 'yarn',
  GEMS: 'gems',
} as const;

/** 建筑 ID 常量 */
export const BUILDING_IDS = {
  CAT_BED: 'cat-bed',
  FISH_POND: 'fish-pond',
  CATNIP_FIELD: 'catnip-field',
  WEAVING_SHOP: 'weaving-shop',
  CAT_SCHOOL: 'cat-school',
  CAT_TEMPLE: 'cat-temple',
} as const;

/** 猫咪品种 ID */
export const BREED_IDS = {
  ORANGE: 'orange',
  BRITISH_SHORTHAIR: 'british-shorthair',
  RAGDOLL: 'ragdoll',
  SIAMESE: 'siamese',
  PERSIAN: 'persian',
  MAINE_COON: 'maine-coon',
  SPHYNX: 'sphynx',
  SCOTTISH_FOLD: 'scottish-fold',
} as const;

/** 猫咪品种定义 */
export interface CatBreedDef {
  id: string;
  name: string;
  icon: string;
  bonusType: string; // 'fish_production' | 'catnip_production' | 'yarn_production' | 'all_production' | 'click_power'
  bonusValue: number;
  unlockCost: Record<string, number>;
  description: string;
}

/** 猫咪品种列表 */
export const CAT_BREEDS: CatBreedDef[] = [
  {
    id: BREED_IDS.ORANGE,
    name: '橘猫',
    icon: '🐱',
    bonusType: 'click_power',
    bonusValue: 1,
    unlockCost: {},
    description: '初始伙伴，增加点击鱼干产出',
  },
  {
    id: BREED_IDS.BRITISH_SHORTHAIR,
    name: '英短',
    icon: '😻',
    bonusType: 'fish_production',
    bonusValue: 0.1,
    unlockCost: { fish: 50 },
    description: '鱼干产出 +10%',
  },
  {
    id: BREED_IDS.RAGDOLL,
    name: '布偶猫',
    icon: '😸',
    bonusType: 'catnip_production',
    bonusValue: 0.15,
    unlockCost: { fish: 200, catnip: 10 },
    description: '猫薄荷产出 +15%',
  },
  {
    id: BREED_IDS.SIAMESE,
    name: '暹罗猫',
    icon: '😺',
    bonusType: 'all_production',
    bonusValue: 0.05,
    unlockCost: { fish: 500, catnip: 50 },
    description: '所有产出 +5%',
  },
  {
    id: BREED_IDS.PERSIAN,
    name: '波斯猫',
    icon: '🐱‍👤',
    bonusType: 'yarn_production',
    bonusValue: 0.2,
    unlockCost: { fish: 1000, catnip: 100, yarn: 20 },
    description: '毛线产出 +20%',
  },
  {
    id: BREED_IDS.MAINE_COON,
    name: '缅因猫',
    icon: '🦁',
    bonusType: 'all_production',
    bonusValue: 0.1,
    unlockCost: { fish: 5000, catnip: 500, yarn: 100 },
    description: '所有产出 +10%',
  },
  {
    id: BREED_IDS.SPHYNX,
    name: '无毛猫',
    icon: '👽',
    bonusType: 'click_power',
    bonusValue: 5,
    unlockCost: { fish: 20000, catnip: 2000, yarn: 500 },
    description: '点击鱼干产出 +5',
  },
  {
    id: BREED_IDS.SCOTTISH_FOLD,
    name: '折耳猫',
    icon: '🥺',
    bonusType: 'all_production',
    bonusValue: 0.15,
    unlockCost: { fish: 100000, catnip: 10000, yarn: 3000 },
    description: '所有产出 +15%',
  },
];

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
    id: BUILDING_IDS.CAT_BED,
    name: '猫窝',
    icon: '🏠',
    description: '猫咪的温馨小窝，产出鱼干',
    baseCost: { fish: 10 },
    costMultiplier: 1.15,
    maxLevel: 50,
    productionResource: RESOURCE_IDS.FISH,
    baseProduction: 0.5,
  },
  {
    id: BUILDING_IDS.FISH_POND,
    name: '鱼塘',
    icon: '🐟',
    description: '自动产出鱼干的鱼塘',
    baseCost: { fish: 50 },
    costMultiplier: 1.18,
    maxLevel: 50,
    productionResource: RESOURCE_IDS.FISH,
    baseProduction: 2,
    unlockCondition: { fish: 30 },
  },
  {
    id: BUILDING_IDS.CATNIP_FIELD,
    name: '猫薄荷田',
    icon: '🌿',
    description: '种植猫薄荷的田地',
    baseCost: { fish: 200 },
    costMultiplier: 1.2,
    maxLevel: 30,
    productionResource: RESOURCE_IDS.CATNIP,
    baseProduction: 0.3,
    unlockCondition: { fish: 100 },
  },
  {
    id: BUILDING_IDS.WEAVING_SHOP,
    name: '编织坊',
    icon: '🧶',
    description: '用猫薄荷编织毛线',
    baseCost: { catnip: 50 },
    costMultiplier: 1.25,
    maxLevel: 30,
    productionResource: RESOURCE_IDS.YARN,
    baseProduction: 0.1,
    unlockCondition: { catnip: 20 },
  },
  {
    id: BUILDING_IDS.CAT_SCHOOL,
    name: '猫咪学校',
    icon: '📚',
    description: '提升所有产出效率 5%/级',
    baseCost: { fish: 1000, catnip: 100 },
    costMultiplier: 1.3,
    maxLevel: 20,
    productionResource: RESOURCE_IDS.FISH,
    baseProduction: 0,
    unlockCondition: { fish: 500, catnip: 50 },
  },
  {
    id: BUILDING_IDS.CAT_TEMPLE,
    name: '猫咪神殿',
    icon: '⛩️',
    description: '声望建筑，提升猫宝石获取',
    baseCost: { fish: 50000, catnip: 5000, yarn: 1000 },
    costMultiplier: 1.5,
    maxLevel: 10,
    productionResource: RESOURCE_IDS.GEMS,
    baseProduction: 0.001,
    unlockCondition: { fish: 10000, catnip: 1000, yarn: 200 },
  },
];

/** 声望系统常量 */
export const PRESTIGE_MULTIPLIER = 0.01; // 每个猫宝石提供 1% 加成
export const MIN_PRESTIGE_FISH = 10000; // 最低声望重置所需鱼干

/** 数字格式化后缀 */
export const NUMBER_SUFFIXES: [number, string][] = [
  [1e18, 'Qi'],
  [1e15, 'Qa'],
  [1e12, 'T'],
  [1e9, 'B'],
  [1e6, 'M'],
  [1e3, 'K'],
];

/** 颜色主题 */
export const COLORS = {
  bgGradient1: '#1a0a2e',
  bgGradient2: '#2d1b4e',
  groundColor: '#3d2b1f',
  grassColor: '#4a7c3f',
  skyColor: '#1a1a3e',
  textPrimary: '#ffffff',
  textSecondary: '#c0b0d0',
  textDim: '#706080',
  accentPink: '#ff6b9d',
  accentGold: '#ffd700',
  accentGreen: '#00e676',
  accentCyan: '#00bcd4',
  panelBg: 'rgba(30, 20, 60, 0.85)',
  panelBorder: 'rgba(255, 107, 157, 0.3)',
  selectedBg: 'rgba(255, 107, 157, 0.15)',
  selectedBorder: 'rgba(255, 107, 157, 0.6)',
  affordable: '#00e676',
  unaffordable: '#ff4757',
  catOrange: '#f4a460',
  catBlack: '#333333',
  catWhite: '#f5f5f5',
  catGray: '#888888',
  fishColor: '#4fc3f7',
  catnipColor: '#66bb6a',
  yarnColor: '#ef5350',
  gemColor: '#ab47bc',
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

/** 猫咪绘制参数 */
export const CAT_DRAW = {
  centerX: 240,
  centerY: 180,
  size: 40,
} as const;

/** 资源图标映射 */
export const RESOURCE_ICONS: Record<string, string> = {
  [RESOURCE_IDS.FISH]: '🐟',
  [RESOURCE_IDS.CATNIP]: '🌿',
  [RESOURCE_IDS.YARN]: '🧶',
  [RESOURCE_IDS.GEMS]: '💎',
};

/** 资源名称映射 */
export const RESOURCE_NAMES: Record<string, string> = {
  [RESOURCE_IDS.FISH]: '鱼干',
  [RESOURCE_IDS.CATNIP]: '猫薄荷',
  [RESOURCE_IDS.YARN]: '毛线',
  [RESOURCE_IDS.GEMS]: '猫宝石',
};

/** 猫咪最大数量（场景中显示） */
export const MAX_VISIBLE_CATS = 8;

/** 猫咪行走速度（像素/秒） */
export const CAT_WALK_SPEED = 30;

/** 飘字效果持续时间（毫秒） */
export const FLOATING_TEXT_DURATION = 1000;
