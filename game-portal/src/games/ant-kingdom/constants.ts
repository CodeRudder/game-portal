/**
 * Ant Kingdom（蚂蚁王国）放置类游戏 — 常量定义
 *
 * 核心玩法：
 * - 点击/空格键获得食物
 * - 建筑系统（蚁穴、真菌农场、蚁酸工厂、育婴室、兵蚁训练营、蜜蚁巢穴）
 * - 蚂蚁兵种系统（工蚁、兵蚁、侦察蚁、收割蚁、织叶蚁、子弹蚁）
 * - 声望系统（重置获得蚁后之息，永久加成）
 * - 离线收益
 * - 自动存档/读档
 */

/** Canvas 尺寸 */
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

/** 点击产生的食物数量 */
export const FOOD_PER_CLICK = 1;

/** 资源 ID 常量 */
export const RESOURCE_IDS = {
  FOOD: 'food',
  LEAF: 'leaf',
  ACID: 'acid',
  HONEY: 'honey',
} as const;

/** 建筑 ID 常量 */
export const BUILDING_IDS = {
  NEST: 'nest',
  FUNGUS_FARM: 'fungus-farm',
  ACID_FACTORY: 'acid-factory',
  NURSERY: 'nursery',
  SOLDIER_CAMP: 'soldier-camp',
  HONEY_VAULT: 'honey-vault',
} as const;

/** 蚂蚁兵种 ID 常量 */
export const ANT_IDS = {
  WORKER: 'worker',
  SOLDIER: 'soldier',
  SCOUT: 'scout',
  HARVESTER: 'harvester',
  WEAVER: 'weaver',
  BULLET_ANT: 'bullet-ant',
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
  productionResource: string;
  baseProduction: number;
  unlockCondition?: Record<string, number>;
}

/** 蚂蚁兵种定义 */
export interface AntDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  unlockCost: Record<string, number>;
  bonusType: string; // 加成类型
  bonusValue: number; // 加成值（百分比）
  bonusTarget: string; // 加成目标
}

/** 建筑列表 */
export const BUILDINGS: BuildingDef[] = [
  {
    id: BUILDING_IDS.NEST,
    name: '蚁穴',
    icon: '🏠',
    description: '基础建筑，工蚁采集食物',
    baseCost: { food: 10 },
    costMultiplier: 1.15,
    maxLevel: 50,
    productionResource: RESOURCE_IDS.FOOD,
    baseProduction: 0.5,
  },
  {
    id: BUILDING_IDS.FUNGUS_FARM,
    name: '真菌农场',
    icon: '🍄',
    description: '用食物培养真菌，产出树叶',
    baseCost: { food: 50 },
    costMultiplier: 1.18,
    maxLevel: 50,
    productionResource: RESOURCE_IDS.LEAF,
    baseProduction: 0.3,
    unlockCondition: { food: 30 },
  },
  {
    id: BUILDING_IDS.ACID_FACTORY,
    name: '蚁酸工厂',
    icon: '⚗️',
    description: '生产蚁酸，用于兵种强化',
    baseCost: { food: 200, leaf: 50 },
    costMultiplier: 1.2,
    maxLevel: 30,
    productionResource: RESOURCE_IDS.ACID,
    baseProduction: 0.1,
    unlockCondition: { food: 100, leaf: 20 },
  },
  {
    id: BUILDING_IDS.NURSERY,
    name: '育婴室',
    icon: '🥚',
    description: '加速蚂蚁繁殖，提升所有产出 5%/级',
    baseCost: { food: 500, leaf: 100 },
    costMultiplier: 1.25,
    maxLevel: 20,
    productionResource: RESOURCE_IDS.FOOD,
    baseProduction: 0,
    unlockCondition: { food: 300, leaf: 50 },
  },
  {
    id: BUILDING_IDS.SOLDIER_CAMP,
    name: '兵蚁训练营',
    icon: '⚔️',
    description: '训练兵蚁，防御加成',
    baseCost: { food: 2000, leaf: 500, acid: 100 },
    costMultiplier: 1.3,
    maxLevel: 30,
    productionResource: RESOURCE_IDS.ACID,
    baseProduction: 0.2,
    unlockCondition: { food: 1000, leaf: 200, acid: 50 },
  },
  {
    id: BUILDING_IDS.HONEY_VAULT,
    name: '蜜蚁巢穴',
    icon: '🍯',
    description: '产出蜂蜜，声望建筑',
    baseCost: { food: 50000, leaf: 10000, acid: 2000 },
    costMultiplier: 1.5,
    maxLevel: 10,
    productionResource: RESOURCE_IDS.HONEY,
    baseProduction: 0.005,
    unlockCondition: { food: 20000, leaf: 5000, acid: 500 },
  },
];

/** 蚂蚁兵种列表 */
export const ANTS: AntDef[] = [
  {
    id: ANT_IDS.WORKER,
    name: '工蚁',
    icon: '🐜',
    description: '基础工蚁，食物采集+10%',
    unlockCost: {},
    bonusType: 'multiply_production',
    bonusValue: 0.10,
    bonusTarget: RESOURCE_IDS.FOOD,
  },
  {
    id: ANT_IDS.SOLDIER,
    name: '兵蚁',
    icon: '🪖',
    description: '强壮兵蚁，防御+15%',
    unlockCost: { food: 500 },
    bonusType: 'add_defense',
    bonusValue: 0.15,
    bonusTarget: 'defense',
  },
  {
    id: ANT_IDS.SCOUT,
    name: '侦察蚁',
    icon: '🔭',
    description: '敏捷侦察蚁，探索+20%',
    unlockCost: { food: 2000 },
    bonusType: 'multiply_production',
    bonusValue: 0.20,
    bonusTarget: RESOURCE_IDS.LEAF,
  },
  {
    id: ANT_IDS.HARVESTER,
    name: '收割蚁',
    icon: '🌾',
    description: '高效收割蚁，树叶+25%',
    unlockCost: { food: 5000 },
    bonusType: 'multiply_production',
    bonusValue: 0.25,
    bonusTarget: RESOURCE_IDS.LEAF,
  },
  {
    id: ANT_IDS.WEAVER,
    name: '织叶蚁',
    icon: '🧵',
    description: '灵巧织叶蚁，建筑效率+20%',
    unlockCost: { food: 15000 },
    bonusType: 'cost_reduction',
    bonusValue: 0.20,
    bonusTarget: 'buildings',
  },
  {
    id: ANT_IDS.BULLET_ANT,
    name: '子弹蚁',
    icon: '💥',
    description: '最强兵种，全加成+30%',
    unlockCost: { food: 50000 },
    bonusType: 'multiply_all',
    bonusValue: 0.30,
    bonusTarget: 'all',
  },
];

/** 声望系统常量 */
export const PRESTIGE_MULTIPLIER = 0.03;
export const MIN_PRESTIGE_FOOD = 8000;

/** 颜色主题 — 微观写实风格（棕色/土色/绿色自然色调） */
export const COLORS = {
  bgGradient1: '#1a0e05',
  bgGradient2: '#2d1a0a',
  groundColor: '#5c3d1e',
  soilSurface: '#8b6914',
  soilHighlight: '#a07828',
  tunnelColor: '#3d2810',
  skyColor: '#1a2e0a',
  textPrimary: '#f5e6c8',
  textSecondary: '#c4a06a',
  textDim: '#8b7040',
  accentBrown: '#c89050',
  accentGold: '#daa520',
  accentGreen: '#4caf50',
  accentAmber: '#ff8f00',
  accentRed: '#d84315',
  panelBg: 'rgba(30, 18, 5, 0.9)',
  panelBorder: 'rgba(200, 144, 80, 0.3)',
  selectedBg: 'rgba(200, 144, 80, 0.15)',
  selectedBorder: 'rgba(200, 144, 80, 0.6)',
  affordable: '#4caf50',
  unaffordable: '#d84315',
  antBody: '#2d1a0a',
  antLegs: '#1a0e05',
  foodColor: '#8bc34a',
  leafColor: '#4caf50',
  acidColor: '#76ff03',
  honeyColor: '#ffc107',
  rootColor: '#5d4037',
  dirtColor: '#795548',
  grassColor: '#33691e',
  eggColor: '#efebe9',
  queenColor: '#daa520',
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

/** 蚁后绘制参数 */
export const QUEEN_DRAW = {
  centerX: 240,
  centerY: 180,
  size: 40,
} as const;

/** 资源图标映射 */
export const RESOURCE_ICONS: Record<string, string> = {
  [RESOURCE_IDS.FOOD]: '🍎',
  [RESOURCE_IDS.LEAF]: '🍃',
  [RESOURCE_IDS.ACID]: '🧪',
  [RESOURCE_IDS.HONEY]: '🍯',
};

/** 资源名称映射 */
export const RESOURCE_NAMES: Record<string, string> = {
  [RESOURCE_IDS.FOOD]: '食物',
  [RESOURCE_IDS.LEAF]: '树叶',
  [RESOURCE_IDS.ACID]: '蚁酸',
  [RESOURCE_IDS.HONEY]: '蜂蜜',
};

/** 场景中最大蚂蚁数量 */
export const MAX_VISIBLE_ANTS = 10;

/** 蚂蚁行走速度（像素/秒） */
export const ANT_WALK_SPEED = 30;

/** 飘字效果持续时间（毫秒） */
export const FLOATING_TEXT_DURATION = 1000;
