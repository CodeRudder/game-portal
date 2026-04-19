/**
 * 炼丹大师 (Alchemy Master) 放置类游戏 — 常量定义
 *
 * 核心玩法：
 * - 点击/空格键获得灵药
 * - 6种灵药田（百草园、灵泉、药王谷、丹炉、丹房、丹道阁）
 * - 6种丹方（疗伤丹、聚灵丹、淬体丹、破境丹、九转金丹、仙丹）
 * - 8种境界（炼丹学徒→丹神）
 * - 声望系统（重置获得丹道，永久加成）
 * - 离线收益
 * - 自动存档/读档
 */

/** Canvas 尺寸 */
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

/** 每次点击获得的灵药数 */
export const HERB_PER_CLICK = 1;

/** 资源 ID 常量 */
export const RESOURCE_IDS = {
  HERB: 'herb',
  PILL_ENERGY: 'pill-energy',
  PILL: 'pill',
  ALCHEMY_WAY: 'alchemy-way',
} as const;

/** 灵药田 ID 常量 */
export const FIELD_IDS = {
  HERB_GARDEN: 'herb-garden',
  SPIRIT_SPRING: 'spirit-spring',
  MEDICINE_VALLEY: 'medicine-valley',
  FURNACE: 'furnace',
  PILL_ROOM: 'pill-room',
  ALCHEMY_PAVILION: 'alchemy-pavilion',
} as const;

/** 丹方 ID 常量 */
export const RECIPE_IDS = {
  HEALING_PILL: 'healing-pill',
  SPIRIT_PILL: 'spirit-pill',
  BODY_PILL: 'body-pill',
  BREAKTHROUGH_PILL: 'breakthrough-pill',
  DIVINE_PILL: 'divine-pill',
  IMMORTAL_PILL: 'immortal-pill',
} as const;

/** 境界 ID 常量 */
export const REALM_IDS = {
  APPRENTICE: 'apprentice',
  DISCIPLE: 'disciple',
  MASTER: 'master',
  SENIOR_MASTER: 'senior-master',
  GRANDMASTER: 'grandmaster',
  SAGE: 'sage',
  SAINT: 'saint',
  GOD: 'god',
} as const;

/** 灵药田定义 */
export interface FieldDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  baseCost: Record<string, number>;
  costMultiplier: number;
  maxLevel: number;
  productionResource: string;
  baseProduction: number;
  /** 解锁所需的前置灵药田等级 */
  unlockCondition?: Record<string, number>;
}

/** 丹方定义 */
export interface RecipeDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  /** 消耗资源 */
  cost: Record<string, number>;
  /** 丹药产出 */
  pillYield: number;
  /** 丹气产出 */
  energyYield: number;
  /** 冷却时间（毫秒） */
  cooldown: number;
  /** 所需境界 ID */
  realmRequired: string;
}

/** 境界定义 */
export interface RealmDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  /** 升级所需丹药数 */
  requiredPills: number;
  /** 产出倍率 */
  productionMultiplier: number;
}

/** 灵药田列表 */
export const FIELDS: FieldDef[] = [
  {
    id: FIELD_IDS.HERB_GARDEN,
    name: '百草园',
    icon: '🌿',
    description: '种植灵药的基础药园',
    baseCost: { herb: 10 },
    costMultiplier: 1.15,
    maxLevel: 50,
    productionResource: RESOURCE_IDS.HERB,
    baseProduction: 0.5,
  },
  {
    id: FIELD_IDS.SPIRIT_SPRING,
    name: '灵泉',
    icon: '💧',
    description: '灵泉滋养，提升灵药产出',
    baseCost: { herb: 50 },
    costMultiplier: 1.18,
    maxLevel: 50,
    productionResource: RESOURCE_IDS.HERB,
    baseProduction: 1.0,
    unlockCondition: { [FIELD_IDS.HERB_GARDEN]: 3 },
  },
  {
    id: FIELD_IDS.MEDICINE_VALLEY,
    name: '药王谷',
    icon: '🏔️',
    description: '药王谷产出丹气',
    baseCost: { herb: 200 },
    costMultiplier: 1.20,
    maxLevel: 40,
    productionResource: RESOURCE_IDS.PILL_ENERGY,
    baseProduction: 0.3,
    unlockCondition: { [FIELD_IDS.SPIRIT_SPRING]: 2 },
  },
  {
    id: FIELD_IDS.FURNACE,
    name: '丹炉',
    icon: '🔥',
    description: '核心炼丹设施，产出丹药',
    baseCost: { herb: 500 },
    costMultiplier: 1.22,
    maxLevel: 40,
    productionResource: RESOURCE_IDS.PILL,
    baseProduction: 0.2,
    unlockCondition: { [FIELD_IDS.MEDICINE_VALLEY]: 2 },
  },
  {
    id: FIELD_IDS.PILL_ROOM,
    name: '丹房',
    icon: '🏛️',
    description: '丹房产出更多丹药',
    baseCost: { herb: 2000 },
    costMultiplier: 1.25,
    maxLevel: 30,
    productionResource: RESOURCE_IDS.PILL,
    baseProduction: 0.8,
    unlockCondition: { [FIELD_IDS.FURNACE]: 3 },
  },
  {
    id: FIELD_IDS.ALCHEMY_PAVILION,
    name: '丹道阁',
    icon: '⛩️',
    description: '丹道阁产出丹道',
    baseCost: { herb: 8000 },
    costMultiplier: 1.30,
    maxLevel: 25,
    productionResource: RESOURCE_IDS.ALCHEMY_WAY,
    baseProduction: 0.1,
    unlockCondition: { [FIELD_IDS.PILL_ROOM]: 2 },
  },
];

/** 丹方列表 */
export const RECIPES: RecipeDef[] = [
  {
    id: RECIPE_IDS.HEALING_PILL,
    name: '疗伤丹',
    icon: '💊',
    description: '基础疗伤丹药',
    cost: { herb: 5 },
    pillYield: 1,
    energyYield: 1,
    cooldown: 1000,
    realmRequired: REALM_IDS.APPRENTICE,
  },
  {
    id: RECIPE_IDS.SPIRIT_PILL,
    name: '聚灵丹',
    icon: '✨',
    description: '聚灵凝气，提升修为',
    cost: { herb: 20 },
    pillYield: 3,
    energyYield: 2,
    cooldown: 2000,
    realmRequired: REALM_IDS.DISCIPLE,
  },
  {
    id: RECIPE_IDS.BODY_PILL,
    name: '淬体丹',
    icon: '🔶',
    description: '淬炼体魄，铜皮铁骨',
    cost: { herb: 80 },
    pillYield: 8,
    energyYield: 5,
    cooldown: 3000,
    realmRequired: REALM_IDS.MASTER,
  },
  {
    id: RECIPE_IDS.BREAKTHROUGH_PILL,
    name: '破境丹',
    icon: '🔮',
    description: '突破瓶颈，提升境界',
    cost: { herb: 300 },
    pillYield: 20,
    energyYield: 12,
    cooldown: 5000,
    realmRequired: REALM_IDS.SENIOR_MASTER,
  },
  {
    id: RECIPE_IDS.DIVINE_PILL,
    name: '九转金丹',
    icon: '🌟',
    description: '九转成丹，白日飞升',
    cost: { herb: 1500 },
    pillYield: 100,
    energyYield: 50,
    cooldown: 10000,
    realmRequired: REALM_IDS.SAGE,
  },
  {
    id: RECIPE_IDS.IMMORTAL_PILL,
    name: '仙丹',
    icon: '⭐',
    description: '传说中的仙丹',
    cost: { herb: 8000 },
    pillYield: 500,
    energyYield: 200,
    cooldown: 20000,
    realmRequired: REALM_IDS.GOD,
  },
];

/** 境界列表 */
export const REALMS: RealmDef[] = [
  {
    id: REALM_IDS.APPRENTICE,
    name: '炼丹学徒',
    icon: '🌱',
    description: '初入炼丹之道',
    requiredPills: 0,
    productionMultiplier: 1.0,
  },
  {
    id: REALM_IDS.DISCIPLE,
    name: '炼丹弟子',
    icon: '📗',
    description: '略有小成',
    requiredPills: 10,
    productionMultiplier: 1.2,
  },
  {
    id: REALM_IDS.MASTER,
    name: '炼丹师',
    icon: '📘',
    description: '炼丹有成',
    requiredPills: 50,
    productionMultiplier: 1.5,
  },
  {
    id: REALM_IDS.SENIOR_MASTER,
    name: '高级炼丹师',
    icon: '📙',
    description: '炉火纯青',
    requiredPills: 200,
    productionMultiplier: 2.0,
  },
  {
    id: REALM_IDS.GRANDMASTER,
    name: '炼丹大师',
    icon: '📕',
    description: '出神入化',
    requiredPills: 1000,
    productionMultiplier: 3.0,
  },
  {
    id: REALM_IDS.SAGE,
    name: '丹道宗师',
    icon: '🔮',
    description: '一代宗师',
    requiredPills: 5000,
    productionMultiplier: 5.0,
  },
  {
    id: REALM_IDS.SAINT,
    name: '丹圣',
    icon: '💠',
    description: '超凡入圣',
    requiredPills: 20000,
    productionMultiplier: 8.0,
  },
  {
    id: REALM_IDS.GOD,
    name: '丹神',
    icon: '☀️',
    description: '炼丹之巅',
    requiredPills: 100000,
    productionMultiplier: 15.0,
  },
];

/** 声望倍率 */
export const PRESTIGE_MULTIPLIER = 0.05;

/** 最低转生所需丹药数 */
export const MIN_PRESTIGE_PILLS = 100;

/** 颜色主题 */
export const COLORS = {
  bgGradient1: '#0c0a08',
  bgGradient2: '#1a1410',
  inkDark: '#1e1a14',
  inkMid: '#2e2820',
  inkLight: '#3e362c',
  firePrimary: '#d4602a',
  fireLight: '#f0a050',
  fireDark: '#8b3a10',
  goldPrimary: '#c9a84c',
  goldLight: '#f0d080',
  goldDark: '#8b6914',
  herbGreen: '#5a9e6f',
  herbDark: '#3a6e4a',
  textPrimary: '#f0e0c8',
  textSecondary: '#c8a878',
  textDim: '#887060',
  accentFire: '#d4602a',
  accentGold: '#c9a84c',
  accentGreen: '#5a9e6f',
  accentRed: '#c05050',
  panelBg: 'rgba(20, 16, 12, 0.92)',
  panelBorder: 'rgba(212, 96, 42, 0.3)',
  selectedBg: 'rgba(212, 96, 42, 0.15)',
  selectedBorder: 'rgba(212, 96, 42, 0.6)',
  affordable: '#5a9e6f',
  unaffordable: '#c05050',
  alchemyColor: '#f0a050',
  herbColor: '#5a9e6f',
  pillColor: '#c9a84c',
  pillEnergyColor: '#8a9ee8',
  alchemyWayColor: '#e070d0',
  furnaceColor: '#f0a050',
  furnaceGlow: 'rgba(240, 160, 80, 0.15)',
  fireParticle: '#f0a050',
  smokeColor: 'rgba(160, 140, 120, 0.08)',
  mountainFar: '#1a1610',
  mountainNear: '#2a2418',
  cloudColor: 'rgba(200, 180, 140, 0.06)',
  paperWhite: '#f5e6c8',
  successGlow: '#5a9e6f',
  failGlow: '#c05050',
  prestigeGlow: '#e070d0',
  accentBrown: '#8b6914',
  accentOrange: '#f0a050',
} as const;

/** 升级列表面板参数 */
export const UPGRADE_PANEL = {
  startY: 300,
  itemHeight: 48,
  itemPadding: 4,
  itemMarginX: 12,
  itemWidth: CANVAS_WIDTH - 24,
  visibleCount: 6,
} as const;

/** 资源图标映射 */
export const RESOURCE_ICONS: Record<string, string> = {
  [RESOURCE_IDS.HERB]: '🌿',
  [RESOURCE_IDS.PILL_ENERGY]: '⚡',
  [RESOURCE_IDS.PILL]: '💊',
  [RESOURCE_IDS.ALCHEMY_WAY]: '☯️',
};

/** 资源名称映射 */
export const RESOURCE_NAMES: Record<string, string> = {
  [RESOURCE_IDS.HERB]: '灵药',
  [RESOURCE_IDS.PILL_ENERGY]: '丹气',
  [RESOURCE_IDS.PILL]: '丹药',
  [RESOURCE_IDS.ALCHEMY_WAY]: '丹道',
};

/** 飘字效果持续时间（毫秒） */
export const FLOATING_TEXT_DURATION = 1200;

/** 烟雾粒子最大数量 */
export const MAX_SMOKE_PARTICLES = 10;

/** 烟雾上升速度（像素/秒） */
export const SMOKE_RISE_SPEED = 30;

/** 灵药粒子数量 */
export const HERB_PARTICLE_COUNT = 30;

/** 动画参数 */
export const ANIMATION = {
  floatingTextDuration: 1200,
  smokeMaxCount: 10,
  herbParticleCount: 30,
  herbParticleColors: ['#5a9e6f', '#81c784', '#a5d6a7', '#c8e6c9'],
} as const;

/** 丹炉绘制参数 */
export const FURNACE_DRAW = {
  centerX: 240,
  centerY: 160,
  bodyRadiusX: 24,
  bodyRadiusY: 18,
  lidRadiusX: 18,
  lidRadiusY: 8,
  topDecorRadius: 4,
  flameWidth: 9,
  flameHeight: 12,
} as const;
