/**
 * 宗门崛起 (Sect Rise) — 放置类游戏常量定义
 *
 * 核心玩法：
 * - 点击获得灵石 (spirit-stone)
 * - 建设宗门建筑，自动产出资源
 * - 招募弟子，获得能力加成
 * - 声望系统：重置进度获得道韵，提供永久加成
 * - 离线收益
 * - 自动存档
 */

/** Canvas 尺寸 */
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ========== 资源常量 ==========

/** 点击获得的灵石数 */
export const SPIRIT_STONE_PER_CLICK = 1;

/** 声望加成系数（每道韵增加的产出倍率） */
export const PRESTIGE_MULTIPLIER = 0.035; // 3.5% per dao-rhyme

/** 声望货币计算基数 */
export const PRESTIGE_BASE_RHYME = 1;

/** 声望货币计算基数（别名） */
export const PRESTIGE_BASE_FORTUNE = 1;

/** 声望所需最低灵石总量 */
export const MIN_PRESTIGE_STONES = 30000;

// ========== 资源 ID ==========

export const RESOURCE_IDS = {
  SPIRIT_STONE: 'spirit-stone',
  HERB: 'herb',
  ARTIFACT: 'artifact',
  REPUTATION: 'reputation',
} as const;

// ========== 弟子定义 ==========

export interface DiscipleDef {
  id: string;
  name: string;
  icon: string;
  /** 解锁所需灵石 */
  unlockCost: number;
  /** 能力类型 */
  bonusType: 'spirit_stone' | 'herb' | 'artifact' | 'reputation' | 'all';
  /** 能力值（百分比加成，0.1 = 10%） */
  bonusValue: number;
  /** 描述 */
  description: string;
  /** 颜色（Canvas 绘制用） */
  color: string;
  robeColor: string;
}

/** 弟子列表 — 6 种 */
export const DISCIPLES: DiscipleDef[] = [
  {
    id: 'outer',
    name: '外门弟子',
    icon: '👦',
    unlockCost: 0,
    bonusType: 'spirit_stone',
    bonusValue: 0.1,
    description: '灵石采集 +10%',
    color: '#8D6E63',
    robeColor: '#A1887F',
  },
  {
    id: 'inner',
    name: '内门弟子',
    icon: '🧑',
    unlockCost: 500,
    bonusType: 'spirit_stone',
    bonusValue: 0.15,
    description: '修炼效率 +15%',
    color: '#5C6BC0',
    robeColor: '#7986CB',
  },
  {
    id: 'core',
    name: '核心弟子',
    icon: '👨',
    unlockCost: 3000,
    bonusType: 'herb',
    bonusValue: 0.2,
    description: '产出 +20%',
    color: '#2E7D32',
    robeColor: '#43A047',
  },
  {
    id: 'elder',
    name: '长老',
    icon: '🧓',
    unlockCost: 10000,
    bonusType: 'all',
    bonusValue: 0.15,
    description: '全加成 +15%',
    color: '#E65100',
    robeColor: '#F57C00',
  },
  {
    id: 'supreme',
    name: '太上长老',
    icon: '👴',
    unlockCost: 50000,
    bonusType: 'all',
    bonusValue: 0.25,
    description: '全加成 +25%',
    color: '#6A1B9A',
    robeColor: '#8E24AA',
  },
  {
    id: 'patriarch',
    name: '掌门',
    icon: '🧙',
    unlockCost: 200000,
    bonusType: 'all',
    bonusValue: 0.4,
    description: '全加成 +40%',
    color: '#B71C1C',
    robeColor: '#D32F2F',
  },
];

// ========== 建筑定义 ==========

export const BUILDING_IDS = {
  STONE_MINE: 'stone-mine',
  HERB_GARDEN: 'herb-garden',
  PILL_ROOM: 'pill-room',
  SCRIPTURE: 'scripture',
  ARENA: 'arena',
  FORMATION: 'formation',
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
  /** 解锁条件：资源 ID -> 最少数量 */
  unlockCondition?: Record<string, number>;
}

/** 建筑列表 — 6 种 */
export const BUILDINGS: BuildingDef[] = [
  {
    id: BUILDING_IDS.STONE_MINE,
    name: '灵石矿场',
    icon: '⛏️',
    baseCost: { 'spirit-stone': 15 },
    costMultiplier: 1.15,
    maxLevel: 50,
    productionResource: RESOURCE_IDS.SPIRIT_STONE,
    baseProduction: 0.5,
  },
  {
    id: BUILDING_IDS.HERB_GARDEN,
    name: '药园',
    icon: '🌿',
    baseCost: { 'spirit-stone': 120 },
    costMultiplier: 1.18,
    maxLevel: 30,
    productionResource: RESOURCE_IDS.HERB,
    baseProduction: 0.3,
    requires: ['stone-mine'],
    unlockCondition: { 'spirit-stone': 80 },
  },
  {
    id: BUILDING_IDS.PILL_ROOM,
    name: '炼丹房',
    icon: '⚗️',
    baseCost: { 'spirit-stone': 600, herb: 20 },
    costMultiplier: 1.2,
    maxLevel: 30,
    productionResource: RESOURCE_IDS.ARTIFACT,
    baseProduction: 0.2,
    requires: ['herb-garden'],
    unlockCondition: { 'spirit-stone': 400, herb: 10 },
  },
  {
    id: BUILDING_IDS.SCRIPTURE,
    name: '藏经阁',
    icon: '📚',
    baseCost: { 'spirit-stone': 3000, herb: 50 },
    costMultiplier: 1.22,
    maxLevel: 20,
    productionResource: RESOURCE_IDS.SPIRIT_STONE,
    baseProduction: 5,
    requires: ['herb-garden'],
    unlockCondition: { 'spirit-stone': 2000 },
  },
  {
    id: BUILDING_IDS.ARENA,
    name: '演武场',
    icon: '⚔️',
    baseCost: { 'spirit-stone': 15000, artifact: 10 },
    costMultiplier: 1.25,
    maxLevel: 15,
    productionResource: RESOURCE_IDS.HERB,
    baseProduction: 2,
    requires: ['pill-room'],
    unlockCondition: { 'spirit-stone': 8000, artifact: 5 },
  },
  {
    id: BUILDING_IDS.FORMATION,
    name: '护宗大阵',
    icon: '🔮',
    baseCost: { 'spirit-stone': 100000, artifact: 30 },
    costMultiplier: 1.3,
    maxLevel: 10,
    productionResource: RESOURCE_IDS.REPUTATION,
    baseProduction: 0.1,
    requires: ['scripture', 'arena'],
    unlockCondition: { 'spirit-stone': 50000, artifact: 20 },
  },
];

// ========== 数字格式化后缀 ==========

export const NUMBER_SUFFIXES: [number, string][] = [
  [1e18, 'Qi'],
  [1e15, 'Qa'],
  [1e12, 'T'],
  [1e9, 'B'],
  [1e6, 'M'],
  [1e3, 'K'],
];

// ========== 资源图标映射 ==========

export const RESOURCE_ICONS: Record<string, string> = {
  [RESOURCE_IDS.SPIRIT_STONE]: '💎',
  [RESOURCE_IDS.HERB]: '🌿',
  [RESOURCE_IDS.ARTIFACT]: '⚒️',
  [RESOURCE_IDS.REPUTATION]: '🏆',
};

/** 资源名称映射 */
export const RESOURCE_NAMES: Record<string, string> = {
  [RESOURCE_IDS.SPIRIT_STONE]: '灵石',
  [RESOURCE_IDS.HERB]: '灵草',
  [RESOURCE_IDS.ARTIFACT]: '法器',
  [RESOURCE_IDS.REPUTATION]: '声望',
};

// ========== 颜色主题（水墨国风：青色/白色/金色） ==========

export const COLORS = {
  bgGradient1: '#0d1b2a',
  bgGradient2: '#1b2838',
  mountainFar: '#2d3436',
  mountainMid: '#353b48',
  mountainNear: '#404050',
  mistColor: 'rgba(200, 210, 220, 0.08)',
  skyTop: '#0a1628',
  skyBottom: '#162a40',
  textPrimary: '#f0e6d3',
  textSecondary: '#c4b8a5',
  textDim: '#8a7e6e',
  accent: '#c0392b',
  accentGold: '#d4a017',
  accentGreen: '#2ecc71',
  accentBlue: '#5dade2',
  accentCyan: '#00bcd4',
  panelBg: 'rgba(13, 27, 42, 0.92)',
  panelBorder: 'rgba(0, 188, 212, 0.3)',
  selectedBg: 'rgba(0, 188, 212, 0.15)',
  selectedBorder: 'rgba(0, 188, 212, 0.6)',
  affordable: '#2ecc71',
  unaffordable: '#e74c3c',
  spiritStoneColor: '#5dade2',
  herbColor: '#27ae60',
  artifactColor: '#d4a017',
  reputationColor: '#c0392b',
  cloudWhite: 'rgba(240, 230, 211, 0.12)',
  inkBlack: '#1a1a2e',
  inkWash: 'rgba(26, 26, 46, 0.3)',
  pagodaRed: '#c0392b',
  pagodaGold: '#d4a017',
  moonGlow: 'rgba(240, 230, 211, 0.9)',
  moonHalo: 'rgba(240, 230, 211, 0.08)',
  starColor: '#f0e6d3',
  spiritGlow: 'rgba(212, 160, 23, 0.2)',
} as const;

// ========== 渲染参数 ==========

export const SECT_DRAW = {
  centerX: 240,
  centerY: 180,
  pagodaWidth: 80,
  pagodaHeight: 100,
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

/** 灵气粒子最大数量 */
export const MAX_SPIRIT_PARTICLES = 30;

/** 飘字效果持续时间（毫秒） */
export const FLOATING_TEXT_DURATION = 1000;
