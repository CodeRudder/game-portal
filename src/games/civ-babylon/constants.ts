/**
 * 四大文明·古巴比伦 (Civ Babylon) — 放置类游戏常量定义
 *
 * 核心玩法：
 * - 玩家建设空中花园、巴别塔、城墙
 * - 积累「泥砖」「铜币」「星象知识」三种资源
 * - 空中花园建造系统（逐层解锁）
 * - 占星术系统（观星台升级）
 * - 声望系统：重置进度获得「泥板」，提供永久加成
 * - 离线收益
 */

/** Canvas 尺寸 */
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ========== 资源常量 ==========

export const RESOURCE_IDS = {
  BRICK: 'brick',
  COPPER: 'copper',
  ASTRO: 'astro',
} as const;

/** 点击获得的泥砖数 */
export const BRICK_PER_CLICK = 1;

/** 声望加成系数（每泥板增加的产出倍率） */
export const PRESTIGE_BONUS_MULTIPLIER = 0.12; // 12% per tablet

/** 声望货币计算基数 */
export const PRESTIGE_BASE_TABLETS = 1;

/** 声望所需最低泥砖总量 */
export const MIN_PRESTIGE_BRICK = 5000;

// ========== 空中花园层定义 ==========

export interface GardenLayerDef {
  layer: number;
  name: string;
  icon: string;
  /** 解锁所需泥砖 */
  unlockCost: number;
  /** 产出资源类型 */
  productionResource: string;
  /** 基础产出 */
  baseProduction: number;
  /** 描述 */
  description: string;
  /** 花园颜色（Canvas 绘制用） */
  color: string;
  /** 植被颜色 */
  plantColor: string;
}

/** 空中花园层列表（7 层） */
export const GARDEN_LAYERS: GardenLayerDef[] = [
  {
    layer: 1,
    name: '基座平台',
    icon: '🧱',
    unlockCost: 0,
    productionResource: RESOURCE_IDS.BRICK,
    baseProduction: 0.5,
    description: '空中花园的坚实基础',
    color: '#8D6E63',
    plantColor: '#4CAF50',
  },
  {
    layer: 2,
    name: '灌溉水渠',
    icon: '💧',
    unlockCost: 500,
    productionResource: RESOURCE_IDS.BRICK,
    baseProduction: 1.0,
    description: '引幼发拉底河水灌溉',
    color: '#4FC3F7',
    plantColor: '#66BB6A',
  },
  {
    layer: 3,
    name: '花木台地',
    icon: '🌿',
    unlockCost: 2000,
    productionResource: RESOURCE_IDS.COPPER,
    baseProduction: 0.4,
    description: '种植异国奇花异草',
    color: '#66BB6A',
    plantColor: '#AED581',
  },
  {
    layer: 4,
    name: '棕榈回廊',
    icon: '🌴',
    unlockCost: 8000,
    productionResource: RESOURCE_IDS.COPPER,
    baseProduction: 0.8,
    description: '高大的棕榈树遮荫回廊',
    color: '#2E7D32',
    plantColor: '#81C784',
  },
  {
    layer: 5,
    name: '瀑布层叠',
    icon: '🌊',
    unlockCost: 25000,
    productionResource: RESOURCE_IDS.ASTRO,
    baseProduction: 0.3,
    description: '水流从高处倾泻而下',
    color: '#0288D1',
    plantColor: '#4DD0E1',
  },
  {
    layer: 6,
    name: '皇家观景台',
    icon: '👑',
    unlockCost: 80000,
    productionResource: RESOURCE_IDS.ASTRO,
    baseProduction: 0.6,
    description: '国王与王后远眺之处',
    color: '#FF8F00',
    plantColor: '#FFB74D',
  },
  {
    layer: 7,
    name: '天穹之巅',
    icon: '✨',
    unlockCost: 250000,
    productionResource: RESOURCE_IDS.ASTRO,
    baseProduction: 1.0,
    description: '触摸星空的至高殿堂',
    color: '#7C4DFF',
    plantColor: '#B388FF',
  },
];

// ========== 建筑定义 ==========

export const BUILDING_IDS = {
  BRICK_KILN: 'brick_kiln',
  COPPER_MINE: 'copper_mine',
  CITY_WALL: 'city_wall',
  OBSERVATORY: 'observatory',
  ZIGGURAT: 'ziggurat',
  MARKETPLACE: 'marketplace',
  HANGING_GARDEN: 'hanging_garden',
  ISHTAR_GATE: 'ishtar_gate',
} as const;

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
  /** 解锁条件（需要某资源达到数量） */
  unlockCondition?: Record<string, number>;
  /** 描述 */
  description: string;
}

/** 建筑列表（8 个建筑） */
export const BUILDINGS: BuildingDef[] = [
  {
    id: BUILDING_IDS.BRICK_KILN,
    name: '泥砖窑',
    icon: '🧱',
    baseCost: { brick: 15 },
    costMultiplier: 1.15,
    maxLevel: 50,
    productionResource: RESOURCE_IDS.BRICK,
    baseProduction: 0.5,
    description: '烧制泥砖的基础窑炉',
  },
  {
    id: BUILDING_IDS.COPPER_MINE,
    name: '铜矿场',
    icon: '⛏️',
    baseCost: { brick: 120 },
    costMultiplier: 1.18,
    maxLevel: 30,
    productionResource: RESOURCE_IDS.COPPER,
    baseProduction: 0.3,
    requires: [BUILDING_IDS.BRICK_KILN],
    description: '开采铜矿石的矿场',
  },
  {
    id: BUILDING_IDS.CITY_WALL,
    name: '城墙',
    icon: '🏰',
    baseCost: { brick: 600 },
    costMultiplier: 1.2,
    maxLevel: 30,
    productionResource: RESOURCE_IDS.BRICK,
    baseProduction: 3,
    requires: [BUILDING_IDS.BRICK_KILN],
    description: '保卫巴比伦城的宏伟城墙',
  },
  {
    id: BUILDING_IDS.OBSERVATORY,
    name: '观星台',
    icon: '🔭',
    baseCost: { brick: 3000, copper: 50 },
    costMultiplier: 1.22,
    maxLevel: 20,
    productionResource: RESOURCE_IDS.ASTRO,
    baseProduction: 0.2,
    requires: [BUILDING_IDS.COPPER_MINE, BUILDING_IDS.CITY_WALL],
    description: '仰望星空，探索宇宙奥秘',
  },
  {
    id: BUILDING_IDS.ZIGGURAT,
    name: '巴别塔',
    icon: '🏛️',
    baseCost: { brick: 1500, copper: 100 },
    costMultiplier: 1.2,
    maxLevel: 25,
    productionResource: RESOURCE_IDS.ASTRO,
    baseProduction: 0.4,
    requires: [BUILDING_IDS.COPPER_MINE],
    description: '通天高塔，连接天地',
  },
  {
    id: BUILDING_IDS.MARKETPLACE,
    name: '集市',
    icon: '🏪',
    baseCost: { brick: 4000, copper: 200 },
    costMultiplier: 1.25,
    maxLevel: 20,
    productionResource: RESOURCE_IDS.COPPER,
    baseProduction: 2,
    requires: [BUILDING_IDS.COPPER_MINE, BUILDING_IDS.CITY_WALL],
    description: '繁荣的贸易集市',
  },
  {
    id: BUILDING_IDS.HANGING_GARDEN,
    name: '空中花园',
    icon: '🌺',
    baseCost: { brick: 20000, copper: 500, astro: 20 },
    costMultiplier: 1.3,
    maxLevel: 15,
    productionResource: RESOURCE_IDS.ASTRO,
    baseProduction: 0.8,
    requires: [BUILDING_IDS.OBSERVATORY, BUILDING_IDS.ZIGGURAT],
    description: '世界七大奇迹之一的空中花园',
  },
  {
    id: BUILDING_IDS.ISHTAR_GATE,
    name: '伊什塔尔门',
    icon: '🚪',
    baseCost: { brick: 100000, copper: 2000, astro: 100 },
    costMultiplier: 1.35,
    maxLevel: 10,
    productionResource: RESOURCE_IDS.COPPER,
    baseProduction: 5,
    requires: [BUILDING_IDS.MARKETPLACE, BUILDING_IDS.HANGING_GARDEN],
    description: '巴比伦最宏伟的城门',
  },
];

// ========== 颜色主题（美索不达米亚风格：金色/蓝色/赭石色调） ==========

export const COLORS = {
  bgGradient1: '#1A237E',
  bgGradient2: '#0D1B2A',
  groundLight: '#C4A35A',
  groundDark: '#8B6914',
  skyTop: '#0D47A1',
  skyBottom: '#1A237E',
  starGlow: '#FFD54F',
  textPrimary: '#FFF8E1',
  textSecondary: '#D7CCC8',
  textDim: '#8D6E63',
  accent: '#FFB300',
  accentGreen: '#76FF03',
  accentRed: '#FF1744',
  accentBlue: '#40C4FF',
  panelBg: 'rgba(26, 35, 126, 0.85)',
  panelBorder: 'rgba(255, 179, 0, 0.3)',
  selectedBg: 'rgba(255, 179, 0, 0.15)',
  selectedBorder: 'rgba(255, 179, 0, 0.6)',
  affordable: '#76FF03',
  unaffordable: '#FF1744',
  brickColor: '#D84315',
  copperColor: '#FF8F00',
  astroColor: '#7C4DFF',
  waterColor: '#0288D1',
  gardenShadow: 'rgba(0,0,0,0.3)',
} as const;

// ========== 渲染参数 ==========

export const GARDEN_DRAW = {
  centerX: 240,
  baseY: 340,
  layerWidth: 120,
  layerHeight: 30,
  plantHeight: 20,
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
