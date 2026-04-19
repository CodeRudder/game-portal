/**
 * 渡劫飞升（Tribulation）放置类游戏 — 常量定义
 *
 * 核心玩法：
 * - 点击/空格键获得灵力
 * - 建筑系统（修炼洞府、聚灵阵、炼器坊、渡劫台、道殿、藏宝阁、天门、仙池）
 * - 天劫系统（雷劫、火劫、风劫、心劫、天劫，逐步挑战）
 * - 飞升系统（渡过所有天劫后可飞升转生）
 * - 离线收益
 * - 自动存档/读档
 */

/** Canvas 尺寸 */
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

/** 点击产生的灵力数量 */
export const SPIRIT_POWER_PER_CLICK = 1;

/** 资源 ID 常量 */
export const RESOURCE_IDS = {
  SPIRIT_POWER: 'spirit-power',
  DAO_RHYME: 'dao-rhyme',
  HEAVEN_AWE: 'heaven-awe',
} as const;

/** 建筑 ID 常量 */
export const BUILDING_IDS = {
  CAVE: 'cave',
  SPIRIT_ARRAY: 'spirit-array',
  FORGE: 'forge',
  TRIBULATION_PLATFORM: 'tribulation-platform',
  DAO_HALL: 'dao-hall',
  TREASURE_PAVILION: 'treasure-pavilion',
  HEAVEN_GATE: 'heaven-gate',
  IMMORTAL_POOL: 'immortal-pool',
} as const;

/** 天劫等级常量 */
export const TRIBULATION_LEVELS = {
  THUNDER: 'thunder',
  FIRE: 'fire',
  WIND: 'wind',
  HEART: 'heart',
  HEAVEN: 'heaven',
} as const;

/** 飞升最小灵力要求 */
export const MIN_PRESTIGE_SPIRIT = 80000;

/** 声望倍率 */
export const PRESTIGE_MULTIPLIER = 0.04;

/** 建筑定义接口 */
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
  unlockTribulationIndex: number; // 需要完成第几个天劫才解锁（-1=初始解锁）
}

/** 天劫定义接口 */
export interface TribulationLevelDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  cost: Record<string, number>;
  successRate: number;
  failLossRate: number;
  rewardHeavenAwe: number;
  order: number;
}

/** 建筑列表 */
export const BUILDINGS: BuildingDef[] = [
  {
    id: BUILDING_IDS.CAVE,
    name: '修炼洞府',
    icon: '🏔️',
    description: '基础修炼之地，产出灵力',
    baseCost: { [RESOURCE_IDS.SPIRIT_POWER]: 10 },
    costMultiplier: 1.15,
    maxLevel: 50,
    productionResource: RESOURCE_IDS.SPIRIT_POWER,
    baseProduction: 0.5,
    unlockTribulationIndex: -1,
  },
  {
    id: BUILDING_IDS.SPIRIT_ARRAY,
    name: '聚灵阵',
    icon: '🌀',
    description: '汇聚天地灵气，提升灵力产出',
    baseCost: { [RESOURCE_IDS.SPIRIT_POWER]: 50 },
    costMultiplier: 1.18,
    maxLevel: 50,
    productionResource: RESOURCE_IDS.SPIRIT_POWER,
    baseProduction: 0.8,
    unlockTribulationIndex: -1,
  },
  {
    id: BUILDING_IDS.FORGE,
    name: '炼器坊',
    icon: '🔨',
    description: '炼制法宝，产出道韵',
    baseCost: { [RESOURCE_IDS.SPIRIT_POWER]: 200 },
    costMultiplier: 1.2,
    maxLevel: 40,
    productionResource: RESOURCE_IDS.DAO_RHYME,
    baseProduction: 0.3,
    unlockTribulationIndex: 0,
  },
  {
    id: BUILDING_IDS.TRIBULATION_PLATFORM,
    name: '渡劫台',
    icon: '⚡',
    description: '修炼渡劫之术，提升点击力量 5%/级',
    baseCost: { [RESOURCE_IDS.SPIRIT_POWER]: 500, [RESOURCE_IDS.DAO_RHYME]: 50 },
    costMultiplier: 1.25,
    maxLevel: 30,
    productionResource: RESOURCE_IDS.SPIRIT_POWER,
    baseProduction: 0,
    unlockTribulationIndex: 0,
  },
  {
    id: BUILDING_IDS.DAO_HALL,
    name: '道殿',
    icon: '🏛️',
    description: '参悟大道，产出道韵',
    baseCost: { [RESOURCE_IDS.SPIRIT_POWER]: 2000, [RESOURCE_IDS.DAO_RHYME]: 200 },
    costMultiplier: 1.3,
    maxLevel: 30,
    productionResource: RESOURCE_IDS.DAO_RHYME,
    baseProduction: 0.5,
    unlockTribulationIndex: 1,
  },
  {
    id: BUILDING_IDS.TREASURE_PAVILION,
    name: '藏宝阁',
    icon: '🏯',
    description: '珍藏天材地宝，产出天威',
    baseCost: { [RESOURCE_IDS.SPIRIT_POWER]: 5000, [RESOURCE_IDS.DAO_RHYME]: 500 },
    costMultiplier: 1.35,
    maxLevel: 25,
    productionResource: RESOURCE_IDS.HEAVEN_AWE,
    baseProduction: 0.2,
    unlockTribulationIndex: 2,
  },
  {
    id: BUILDING_IDS.HEAVEN_GATE,
    name: '天门',
    icon: '⛩️',
    description: '沟通天地，大幅产出天威',
    baseCost: { [RESOURCE_IDS.SPIRIT_POWER]: 20000, [RESOURCE_IDS.DAO_RHYME]: 2000, [RESOURCE_IDS.HEAVEN_AWE]: 100 },
    costMultiplier: 1.4,
    maxLevel: 20,
    productionResource: RESOURCE_IDS.HEAVEN_AWE,
    baseProduction: 0.5,
    unlockTribulationIndex: 3,
  },
  {
    id: BUILDING_IDS.IMMORTAL_POOL,
    name: '仙池',
    icon: '🌊',
    description: '仙池洗礼，全资源产出加成',
    baseCost: { [RESOURCE_IDS.SPIRIT_POWER]: 50000, [RESOURCE_IDS.DAO_RHYME]: 5000, [RESOURCE_IDS.HEAVEN_AWE]: 300 },
    costMultiplier: 1.5,
    maxLevel: 15,
    productionResource: RESOURCE_IDS.SPIRIT_POWER,
    baseProduction: 2.0,
    unlockTribulationIndex: 4,
  },
];

/** 天劫列表 */
export const TRIBULATIONS: TribulationLevelDef[] = [
  {
    id: TRIBULATION_LEVELS.THUNDER,
    name: '雷劫',
    icon: '⚡',
    description: '天雷轰顶，基础劫难',
    cost: { [RESOURCE_IDS.SPIRIT_POWER]: 1000, [RESOURCE_IDS.DAO_RHYME]: 50 },
    successRate: 0.80,
    failLossRate: 0.1,
    rewardHeavenAwe: 10,
    order: 1,
  },
  {
    id: TRIBULATION_LEVELS.FIRE,
    name: '火劫',
    icon: '🔥',
    description: '烈火焚身，火之考验',
    cost: { [RESOURCE_IDS.SPIRIT_POWER]: 5000, [RESOURCE_IDS.DAO_RHYME]: 300, [RESOURCE_IDS.HEAVEN_AWE]: 10 },
    successRate: 0.65,
    failLossRate: 0.15,
    rewardHeavenAwe: 50,
    order: 2,
  },
  {
    id: TRIBULATION_LEVELS.WIND,
    name: '风劫',
    icon: '🌪️',
    description: '罡风削骨，风之考验',
    cost: { [RESOURCE_IDS.SPIRIT_POWER]: 20000, [RESOURCE_IDS.DAO_RHYME]: 1500, [RESOURCE_IDS.HEAVEN_AWE]: 50 },
    successRate: 0.50,
    failLossRate: 0.2,
    rewardHeavenAwe: 200,
    order: 3,
  },
  {
    id: TRIBULATION_LEVELS.HEART,
    name: '心劫',
    icon: '👹',
    description: '心魔侵扰，心之考验',
    cost: { [RESOURCE_IDS.SPIRIT_POWER]: 80000, [RESOURCE_IDS.DAO_RHYME]: 5000, [RESOURCE_IDS.HEAVEN_AWE]: 200 },
    successRate: 0.40,
    failLossRate: 0.25,
    rewardHeavenAwe: 800,
    order: 4,
  },
  {
    id: TRIBULATION_LEVELS.HEAVEN,
    name: '天劫',
    icon: '🌟',
    description: '天道威压，终极考验',
    cost: { [RESOURCE_IDS.SPIRIT_POWER]: 300000, [RESOURCE_IDS.DAO_RHYME]: 20000, [RESOURCE_IDS.HEAVEN_AWE]: 800 },
    successRate: 0.30,
    failLossRate: 0.3,
    rewardHeavenAwe: 3000,
    order: 5,
  },
];

/** 颜色主题 — 紫金仙侠风 */
export const COLORS = {
  bgGradient1: '#1a0a2e',
  bgGradient2: '#2d1a4e',
  bgDeep: '#0d0520',
  skyPurple: '#3a1a6e',
  cloudColor: '#5c3d8f',
  textPrimary: '#f5e6ff',
  textSecondary: '#c4a0e6',
  textDim: '#8b70a0',
  accentPurple: '#9c27b0',
  accentGold: '#ffd700',
  accentWhite: '#e8e0f0',
  accentCyan: '#00e5ff',
  accentRed: '#ff1744',
  accentGreen: '#76ff03',
  panelBg: 'rgba(30, 10, 50, 0.9)',
  panelBorder: 'rgba(200, 160, 255, 0.3)',
  selectedBg: 'rgba(200, 160, 255, 0.15)',
  selectedBorder: 'rgba(200, 160, 255, 0.6)',
  affordable: '#76ff03',
  unaffordable: '#ff1744',
  lightningColor: '#ffd700',
  fireColor: '#ff6d00',
  windColor: '#00e5ff',
  demonColor: '#d500f9',
  meritColor: '#ffd700',
  spiritColor: '#bb86fc',
  daoRhymeColor: '#00e5ff',
  heavenAweColor: '#ffd700',
  tribulationColor: '#ff1744',
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

/** 资源图标映射 */
export const RESOURCE_ICONS: Record<string, string> = {
  [RESOURCE_IDS.SPIRIT_POWER]: '✨',
  [RESOURCE_IDS.DAO_RHYME]: '🌀',
  [RESOURCE_IDS.HEAVEN_AWE]: '⚡',
};

/** 资源名称映射 */
export const RESOURCE_NAMES: Record<string, string> = {
  [RESOURCE_IDS.SPIRIT_POWER]: '灵力',
  [RESOURCE_IDS.DAO_RHYME]: '道韵',
  [RESOURCE_IDS.HEAVEN_AWE]: '天威',
};

/** 飘字效果持续时间（毫秒） */
export const FLOATING_TEXT_DURATION = 1000;

/** 场景粒子数量 */
export const MAX_PARTICLES = 30;

/** 粒子飘动速度（像素/秒） */
export const PARTICLE_SPEED = 20;

/** 天劫动画持续时间（毫秒） */
export const TRIBULATION_ANIM_DURATION = 1500;
