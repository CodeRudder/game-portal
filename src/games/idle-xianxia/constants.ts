/**
 * 挂机修仙·凡人篇 (Idle Xianxia) — 常量定义
 *
 * 核心玩法：
 * - 点击/打坐获得灵气
 * - 境界修炼 + 突破系统（8大境界）
 * - 修炼建筑（灵气池、灵石矿、炼丹炉、洞府、灵兽园、仙缘阁）
 * - 声望系统（重置获得道韵，永久加成）
 * - 离线收益
 * - 自动存档/读档
 * - 水墨国风画面（黑/白/淡青/金色）
 */

/** Canvas 尺寸 */
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

/** 点击产生的灵气数量 */
export const SPIRIT_PER_CLICK = 1;

/** 资源 ID 常量 */
export const RESOURCE_IDS = {
  SPIRIT: 'spirit',
  STONE: 'stone',
  PILL: 'pill',
  FATE: 'fate',
} as const;

/** 建筑 ID 常量 */
export const BUILDING_IDS = {
  SPIRIT_POOL: 'spirit-pool',
  STONE_MINE: 'stone-mine',
  PILL_FURNACE: 'pill-furnace',
  CAVE_DWELLING: 'cave-dwelling',
  BEAST_GARDEN: 'beast-garden',
  FATE_PAVILION: 'fate-pavilion',
} as const;

/** 境界 ID 常量 */
export const REALM_IDS = {
  QI_REFINING: 'qi-refining',
  FOUNDATION: 'foundation',
  GOLDEN_CORE: 'golden-core',
  NASCENT_SOUL: 'nascent-soul',
  SPIRIT_SEVERING: 'spirit-severing',
  VOID_REFINING: 'void-refining',
  BODY_INTEGRATION: 'body-integration',
  GREAT_ASCENSION: 'great-ascension',
} as const;

/** 境界定义 */
export interface RealmDef {
  id: string;
  name: string;
  nameEn: string;
  index: number;
  /** 突破所需资源 */
  cost: Record<string, number>;
  /** 基础突破成功率 */
  baseSuccessRate: number;
  /** 突破失败损失灵气比例 */
  failLossRate: number;
}

/** 境界列表（从低到高） */
export const REALMS: RealmDef[] = [
  {
    id: REALM_IDS.QI_REFINING,
    name: '炼气',
    nameEn: 'Qi Refining',
    index: 0,
    cost: {},
    baseSuccessRate: 1,
    failLossRate: 0,
  },
  {
    id: REALM_IDS.FOUNDATION,
    name: '筑基',
    nameEn: 'Foundation',
    index: 1,
    cost: { spirit: 1000 },
    baseSuccessRate: 0.95,
    failLossRate: 0.1,
  },
  {
    id: REALM_IDS.GOLDEN_CORE,
    name: '金丹',
    nameEn: 'Golden Core',
    index: 2,
    cost: { spirit: 10000, stone: 100 },
    baseSuccessRate: 0.85,
    failLossRate: 0.15,
  },
  {
    id: REALM_IDS.NASCENT_SOUL,
    name: '元婴',
    nameEn: 'Nascent Soul',
    index: 3,
    cost: { spirit: 50000, stone: 500, pill: 10 },
    baseSuccessRate: 0.7,
    failLossRate: 0.2,
  },
  {
    id: REALM_IDS.SPIRIT_SEVERING,
    name: '化神',
    nameEn: 'Spirit Severing',
    index: 4,
    cost: { spirit: 200000, stone: 2000, pill: 50 },
    baseSuccessRate: 0.55,
    failLossRate: 0.25,
  },
  {
    id: REALM_IDS.VOID_REFINING,
    name: '炼虚',
    nameEn: 'Void Refining',
    index: 5,
    cost: { spirit: 1000000, stone: 10000, pill: 200 },
    baseSuccessRate: 0.4,
    failLossRate: 0.3,
  },
  {
    id: REALM_IDS.BODY_INTEGRATION,
    name: '合体',
    nameEn: 'Body Integration',
    index: 6,
    cost: { spirit: 5000000, stone: 50000, pill: 500 },
    baseSuccessRate: 0.3,
    failLossRate: 0.35,
  },
  {
    id: REALM_IDS.GREAT_ASCENSION,
    name: '大乘',
    nameEn: 'Great Ascension',
    index: 7,
    cost: { spirit: 50000000, stone: 500000, pill: 2000 },
    baseSuccessRate: 0.2,
    failLossRate: 0.4,
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
  productionResource: string;
  baseProduction: number;
  /** 境界解锁条件：境界索引 >= 此值时解锁 */
  unlockRealmIndex: number;
}

/** 建筑列表 */
export const BUILDINGS: BuildingDef[] = [
  {
    id: BUILDING_IDS.SPIRIT_POOL,
    name: '灵气池',
    icon: '🌀',
    description: '聚集天地灵气，产出灵气',
    baseCost: { spirit: 10 },
    costMultiplier: 1.15,
    maxLevel: 50,
    productionResource: RESOURCE_IDS.SPIRIT,
    baseProduction: 0.5,
    unlockRealmIndex: 0,
  },
  {
    id: BUILDING_IDS.STONE_MINE,
    name: '灵石矿',
    icon: '💎',
    description: '开采灵石矿脉',
    baseCost: { spirit: 50 },
    costMultiplier: 1.18,
    maxLevel: 50,
    productionResource: RESOURCE_IDS.STONE,
    baseProduction: 0.2,
    unlockRealmIndex: 1,
  },
  {
    id: BUILDING_IDS.PILL_FURNACE,
    name: '炼丹炉',
    icon: '⚗️',
    description: '炼制丹药辅助突破',
    baseCost: { spirit: 200, stone: 50 },
    costMultiplier: 1.2,
    maxLevel: 40,
    productionResource: RESOURCE_IDS.PILL,
    baseProduction: 0.05,
    unlockRealmIndex: 2,
  },
  {
    id: BUILDING_IDS.CAVE_DWELLING,
    name: '洞府',
    icon: '🏔️',
    description: '提升修炼效率 5%/级',
    baseCost: { spirit: 500, stone: 100 },
    costMultiplier: 1.25,
    maxLevel: 20,
    productionResource: RESOURCE_IDS.SPIRIT,
    baseProduction: 0,
    unlockRealmIndex: 2,
  },
  {
    id: BUILDING_IDS.BEAST_GARDEN,
    name: '灵兽园',
    icon: '🐉',
    description: '灵兽辅助修炼，提升全产出',
    baseCost: { spirit: 5000, stone: 1000, pill: 20 },
    costMultiplier: 1.3,
    maxLevel: 20,
    productionResource: RESOURCE_IDS.SPIRIT,
    baseProduction: 0,
    unlockRealmIndex: 3,
  },
  {
    id: BUILDING_IDS.FATE_PAVILION,
    name: '仙缘阁',
    icon: '🏮',
    description: '结仙缘，产出仙缘',
    baseCost: { spirit: 20000, stone: 5000, pill: 100 },
    costMultiplier: 1.5,
    maxLevel: 15,
    productionResource: RESOURCE_IDS.FATE,
    baseProduction: 0.01,
    unlockRealmIndex: 4,
  },
];

/** 声望系统常量 */
export const PRESTIGE_MULTIPLIER = 0.04; // 每点道韵提供 4% 加成
export const MIN_PRESTIGE_SPIRIT = 100000; // 最低声望重置所需灵气

/** 数字格式化后缀 */
export const NUMBER_SUFFIXES: [number, string][] = [
  [1e18, 'Qi'],
  [1e15, 'Qa'],
  [1e12, 'T'],
  [1e9, 'B'],
  [1e6, 'M'],
  [1e3, 'K'],
];

/** 颜色主题 — 水墨国风（黑/白/淡青/金色） */
export const COLORS = {
  bgGradient1: '#0d1117',
  bgGradient2: '#1a2332',
  mountainFar: 'rgba(40, 60, 80, 0.4)',
  mountainNear: 'rgba(30, 45, 60, 0.6)',
  groundColor: '#1a2332',
  textPrimary: '#f0e6d3',
  textSecondary: '#a0b8c8',
  textDim: '#607080',
  accentCyan: '#7ec8c8',
  accentGold: '#d4a843',
  accentGreen: '#6abf69',
  accentRed: '#c75050',
  spiritColor: '#7ec8c8',
  stoneColor: '#a0c4e8',
  pillColor: '#e8a040',
  fateColor: '#d4a843',
  panelBg: 'rgba(15, 25, 35, 0.9)',
  panelBorder: 'rgba(126, 200, 200, 0.25)',
  selectedBg: 'rgba(126, 200, 200, 0.12)',
  selectedBorder: 'rgba(126, 200, 200, 0.5)',
  affordable: '#6abf69',
  unaffordable: '#c75050',
  inkBlack: '#1a1a2e',
  inkGray: '#3a3a5e',
  inkLight: '#6a6a8e',
  paperWhite: '#f0e6d3',
  cloudColor: 'rgba(200, 220, 240, 0.06)',
  mistColor: 'rgba(126, 200, 200, 0.08)',
  breakthroughGlow: 'rgba(212, 168, 67, 0.3)',
} as const;

/** 升级列表面板参数 */
export const UPGRADE_PANEL = {
  startY: 300,
  itemHeight: 44,
  itemPadding: 3,
  itemMarginX: 12,
  itemWidth: CANVAS_WIDTH - 24,
  visibleCount: 6,
} as const;

/** 资源图标映射 */
export const RESOURCE_ICONS: Record<string, string> = {
  [RESOURCE_IDS.SPIRIT]: '🌀',
  [RESOURCE_IDS.STONE]: '💎',
  [RESOURCE_IDS.PILL]: '⚗️',
  [RESOURCE_IDS.FATE]: '🏮',
};

/** 资源名称映射 */
export const RESOURCE_NAMES: Record<string, string> = {
  [RESOURCE_IDS.SPIRIT]: '灵气',
  [RESOURCE_IDS.STONE]: '灵石',
  [RESOURCE_IDS.PILL]: '丹药',
  [RESOURCE_IDS.FATE]: '仙缘',
};

/** 打坐相关参数 */
export const MEDITATION = {
  /** 打坐持续时间（毫秒） */
  duration: 5000,
  /** 打坐灵气倍率 */
  multiplier: 3,
  /** 冷却时间（毫秒） */
  cooldown: 10000,
} as const;

/** 动画参数 */
export const ANIMATION = {
  /** 飘字持续时间 */
  floatingTextDuration: 1200,
  /** 云雾粒子数量 */
  cloudCount: 8,
  /** 灵气粒子数量 */
  spiritParticleCount: 15,
  /** 最大可见灵兽数 */
  maxBeasts: 4,
  /** 突破光效持续时间 */
  breakthroughDuration: 2000,
} as const;
