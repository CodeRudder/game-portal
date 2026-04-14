/**
 * 挂机修仙·凡人篇 (Idle Xianxia) 放置类游戏 — 常量定义
 *
 * 核心玩法：
 * - 点击/空格键获得灵气
 * - 境界修炼系统（8大境界突破）
 * - 建筑系统（灵脉、灵石矿、丹房、藏经阁、炼器坊、仙缘阁）
 * - 声望系统（重置获得道韵，永久加成）
 * - 离线收益
 * - 自动存档/读档
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
  MORTAL: 'mortal',
  QI_REFINING: 'qi-refining',
  FOUNDATION: 'foundation',
  GOLDEN_CORE: 'golden-core',
  NASCENT_SOUL: 'nascent-soul',
  SPIRIT_SEVERING: 'spirit-severing',
  SPIRIT_TRANSFORMATION: 'spirit-transformation',
  VOID_REFINING: 'void-refining',
  BODY_INTEGRATION: 'body-integration',
  MAHAYANA: 'mahayana',
  TRIBULATION: 'tribulation',
  GREAT_ASCENSION: 'great-ascension',
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
  /** 解锁所需境界索引 */
  unlockRealmIndex: number;
}

/** 境界定义 */
export interface RealmDef {
  id: string;
  name: string;
  nameEn: string;
  icon: string;
  description: string;
  /** 突破所需资源 */
  cost: Record<string, number>;
  /** 突破失败时灵气损失比例 */
  failLossRate: number;
  /** 基础突破成功率 (0~1) */
  baseSuccessRate: number;
  /** 产出倍率 */
  productionMultiplier: number;
  /** 解锁哪个资源 */
  unlockResource?: string;
}

/** 建筑列表 */
export const BUILDINGS: BuildingDef[] = [
  {
    id: BUILDING_IDS.SPIRIT_POOL,
    name: '灵气池',
    icon: '🌀',
    description: '基础建筑，汇聚天地灵气',
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
    description: '开采灵石，中级资源',
    baseCost: { spirit: 50 },
    costMultiplier: 1.18,
    maxLevel: 50,
    productionResource: RESOURCE_IDS.STONE,
    baseProduction: 0.3,
    unlockCondition: { spirit: 30 },
    unlockRealmIndex: 1,
  },
  {
    id: BUILDING_IDS.PILL_FURNACE,
    name: '炼丹炉',
    icon: '🧪',
    description: '炼制丹药，高级资源',
    baseCost: { spirit: 200, stone: 50 },
    costMultiplier: 1.2,
    maxLevel: 30,
    productionResource: RESOURCE_IDS.PILL,
    baseProduction: 0.1,
    unlockCondition: { spirit: 100, stone: 20 },
    unlockRealmIndex: 2,
  },
  {
    id: BUILDING_IDS.CAVE_DWELLING,
    name: '洞府',
    icon: '🏔️',
    description: '修炼洞府，提升点击力量 5%/级',
    baseCost: { spirit: 500, stone: 100 },
    costMultiplier: 1.25,
    maxLevel: 20,
    productionResource: RESOURCE_IDS.SPIRIT,
    baseProduction: 0,
    unlockCondition: { spirit: 300, stone: 50 },
    unlockRealmIndex: 2,
  },
  {
    id: BUILDING_IDS.BEAST_GARDEN,
    name: '灵兽园',
    icon: '🐉',
    description: '饲养灵兽，提升产出倍率',
    baseCost: { spirit: 2000, stone: 500, pill: 100 },
    costMultiplier: 1.3,
    maxLevel: 30,
    productionResource: RESOURCE_IDS.PILL,
    baseProduction: 0.2,
    unlockCondition: { spirit: 1000, stone: 200, pill: 50 },
    unlockRealmIndex: 3,
  },
  {
    id: BUILDING_IDS.FATE_PAVILION,
    name: '仙缘阁',
    icon: '⛩️',
    description: '结仙缘，声望建筑',
    baseCost: { spirit: 50000, stone: 10000, pill: 2000 },
    costMultiplier: 1.5,
    maxLevel: 10,
    productionResource: RESOURCE_IDS.FATE,
    baseProduction: 0.005,
    unlockCondition: { spirit: 20000, stone: 5000, pill: 500 },
    unlockRealmIndex: 4,
  },
];

/** 境界列表 */
export const REALMS: RealmDef[] = [
  {
    id: REALM_IDS.QI_REFINING,
    name: '炼气',
    nameEn: 'Qi Refining',
    icon: '💨',
    description: '感应灵气，踏入修仙门槛',
    cost: {},
    failLossRate: 0,
    baseSuccessRate: 1,
    productionMultiplier: 1,
  },
  {
    id: REALM_IDS.FOUNDATION,
    name: '筑基',
    nameEn: 'Foundation',
    icon: '🏗️',
    description: '筑就道基，根基稳固',
    cost: { spirit: 1000 },
    failLossRate: 0.1,
    baseSuccessRate: 0.95,
    productionMultiplier: 1.5,
    unlockResource: RESOURCE_IDS.STONE,
  },
  {
    id: REALM_IDS.GOLDEN_CORE,
    name: '金丹',
    nameEn: 'Golden Core',
    icon: '🔮',
    description: '凝结金丹，实力飞跃',
    cost: { spirit: 5000, stone: 200, pill: 10 },
    failLossRate: 0.15,
    baseSuccessRate: 0.85,
    productionMultiplier: 2.5,
    unlockResource: RESOURCE_IDS.PILL,
  },
  {
    id: REALM_IDS.NASCENT_SOUL,
    name: '元婴',
    nameEn: 'Nascent Soul',
    icon: '👶',
    description: '元婴出窍，神通初显',
    cost: { spirit: 20000, stone: 1000, pill: 50 },
    failLossRate: 0.2,
    baseSuccessRate: 0.70,
    productionMultiplier: 4,
  },
  {
    id: REALM_IDS.SPIRIT_SEVERING,
    name: '斩灵',
    nameEn: 'Spirit Severing',
    icon: '✨',
    description: '斩灵入道，超凡脱俗',
    cost: { spirit: 100000, stone: 5000, pill: 200 },
    failLossRate: 0.25,
    baseSuccessRate: 0.55,
    productionMultiplier: 7,
    unlockResource: RESOURCE_IDS.FATE,
  },
  {
    id: REALM_IDS.VOID_REFINING,
    name: '炼虚',
    nameEn: 'Void Refining',
    icon: '🌟',
    description: '炼虚期，接近合体',
    cost: { spirit: 500000, stone: 20000, pill: 500 },
    failLossRate: 0.3,
    baseSuccessRate: 0.40,
    productionMultiplier: 12,
  },
  {
    id: REALM_IDS.BODY_INTEGRATION,
    name: '合体',
    nameEn: 'Body Integration',
    icon: '⚡',
    description: '合体期，天人合一',
    cost: { spirit: 2000000, stone: 100000, pill: 2000 },
    failLossRate: 0.35,
    baseSuccessRate: 0.25,
    productionMultiplier: 20,
  },
  {
    id: REALM_IDS.GREAT_ASCENSION,
    name: '大乘',
    nameEn: 'Great Ascension',
    icon: '🌈',
    description: '大乘期，飞升在即',
    cost: { spirit: 10000000, stone: 500000, pill: 10000 },
    failLossRate: 0.4,
    baseSuccessRate: 0.15,
    productionMultiplier: 35,
  },
];

/** 声望系统常量 */
export const PRESTIGE_MULTIPLIER = 0.04;
export const MIN_PRESTIGE_SPIRIT = 100000;

/** 颜色主题 — 水墨国风（墨色/青色/金色） */
export const COLORS = {
  bgGradient1: '#0a0f14',
  bgGradient2: '#101820',
  inkDark: '#1a1a2e',
  inkMid: '#2d2d44',
  inkLight: '#3d3d5c',
  cyanPrimary: '#4a90a4',
  cyanLight: '#7ec8d8',
  cyanDark: '#2d5f6f',
  goldPrimary: '#c9a84c',
  goldLight: '#f0d080',
  goldDark: '#8b6914',
  textPrimary: '#e8dcc8',
  textSecondary: '#b8a888',
  textDim: '#787060',
  accentCyan: '#4a90a4',
  accentGold: '#c9a84c',
  accentGreen: '#5a9e6f',
  accentRed: '#c05050',
  panelBg: 'rgba(16, 24, 32, 0.92)',
  panelBorder: 'rgba(74, 144, 164, 0.3)',
  selectedBg: 'rgba(74, 144, 164, 0.15)',
  selectedBorder: 'rgba(74, 144, 164, 0.6)',
  affordable: '#5a9e6f',
  unaffordable: '#c05050',
  spiritColor: '#7ec8d8',
  stoneColor: '#b8a8e8',
  pillColor: '#e8a070',
  fateColor: '#f0d080',
  paperWhite: '#f5e6c8',
  mountainFar: '#1a2a3a',
  mountainNear: '#2a3a4a',
  inkGray: '#3d3d5c',
  mountainColor: '#1a2a3a',
  mountainHighlight: '#2a3a4a',
  cloudColor: 'rgba(200, 210, 220, 0.15)',
  moonColor: '#f5e6c8',
  bambooColor: '#3a5a3a',
  inkSplash: 'rgba(30, 30, 50, 0.4)',
  mistColor: 'rgba(100, 140, 160, 0.08)',
  breakthroughGlow: '#c9a84c',
  successGlow: '#5a9e6f',
  failGlow: '#c05050',
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

/** 修仙者绘制参数 */
export const CULTIVATOR_DRAW = {
  centerX: 240,
  centerY: 160,
  size: 40,
} as const;

/** 资源图标映射 */
export const RESOURCE_ICONS: Record<string, string> = {
  [RESOURCE_IDS.SPIRIT]: '🌀',
  [RESOURCE_IDS.STONE]: '💎',
  [RESOURCE_IDS.PILL]: '🧪',
  [RESOURCE_IDS.FATE]: '🌟',
};

/** 资源名称映射 */
export const RESOURCE_NAMES: Record<string, string> = {
  [RESOURCE_IDS.SPIRIT]: '灵气',
  [RESOURCE_IDS.STONE]: '灵石',
  [RESOURCE_IDS.PILL]: '丹药',
  [RESOURCE_IDS.FATE]: '仙缘',
};

/** 境界名称映射 */
export const REALM_NAMES: Record<string, string> = {
  [REALM_IDS.MORTAL]: '凡人',
  [REALM_IDS.QI_REFINING]: '炼气',
  [REALM_IDS.FOUNDATION]: '筑基',
  [REALM_IDS.GOLDEN_CORE]: '金丹',
  [REALM_IDS.NASCENT_SOUL]: '元婴',
  [REALM_IDS.SPIRIT_SEVERING]: '化神',
  [REALM_IDS.VOID_REFINING]: '大乘',
  [REALM_IDS.BODY_INTEGRATION]: '渡劫',
};

/** 飘字效果持续时间（毫秒） */
export const FLOATING_TEXT_DURATION = 1000;

/** 突破动画持续时间（毫秒） */
export const BREAKTHROUGH_ANIM_DURATION = 1500;

/** 灵气粒子数量 */
export const MAX_SPIRIT_PARTICLES = 15;

/** 灵气粒子速度（像素/秒） */
export const SPIRIT_PARTICLE_SPEED = 20;

/** 云朵数量 */
export const MAX_CLOUDS = 5;

/** 云朵飘动速度（像素/秒） */
export const CLOUD_SPEED = 8;

/** 打坐系统常量 */
export const MEDITATION = {
  /** 打坐持续时间（毫秒） */
  duration: 5000,
  /** 打坐灵气产出倍率 */
  multiplier: 3,
  /** 打坐冷却时间（毫秒） */
  cooldown: 10000,
} as const;

/** 动画参数 */
export const ANIMATION = {
  /** 飘字效果持续时间（毫秒） */
  floatingTextDuration: 1200,
  /** 云朵数量 */
  cloudCount: 8,
  /** 灵气粒子数量 */
  spiritParticleCount: 15,
  /** 突破光效持续时间（毫秒） */
  breakthroughDuration: 2000,
} as const;
