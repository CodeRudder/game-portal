/**
 * 宗门崛起 (Sect Rise) — 放置类游戏常量定义
 *
 * 核心玩法：
 * - 点击获得灵石 (spirit-stone)
 * - 建设宗门建筑，自动产出资源
 * - 招募弟子，获得能力加成
 * - 声望系统：重置进度获得宗门气运，提供永久加成
 * - 离线收益
 */

/** Canvas 尺寸 */
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ========== 资源常量 ==========

/** 点击获得的灵石数 */
export const SPIRIT_STONE_PER_CLICK = 1;

/** 声望加成系数（每宗门气运增加的产出倍率） */
export const PRESTIGE_MULTIPLIER = 0.035; // 3.5% per fortune

/** 声望货币计算基数 */
export const PRESTIGE_BASE_FORTUNE = 1;

/** 声望所需最低灵石总量 */
export const MIN_PRESTIGE_STONES = 15000;

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

/** 弟子列表 */
export const DISCIPLES: DiscipleDef[] = [
  {
    id: 'outer-disciple',
    name: '外门弟子',
    icon: '👦',
    unlockCost: 0,
    bonusType: 'spirit_stone',
    bonusValue: 0.1,
    description: '灵石产出 +10%',
    color: '#8D6E63',
    robeColor: '#A1887F',
  },
  {
    id: 'inner-disciple',
    name: '内门弟子',
    icon: '🧑',
    unlockCost: 1000,
    bonusType: 'spirit_stone',
    bonusValue: 0.15,
    description: '修炼效率 +15%',
    color: '#5C6BC0',
    robeColor: '#7986CB',
  },
  {
    id: 'core-disciple',
    name: '核心弟子',
    icon: '👨',
    unlockCost: 5000,
    bonusType: 'herb',
    bonusValue: 0.2,
    description: '仙草产出 +20%',
    color: '#2E7D32',
    robeColor: '#43A047',
  },
  {
    id: 'elder',
    name: '长老',
    icon: '🧓',
    unlockCost: 20000,
    bonusType: 'artifact',
    bonusValue: 0.25,
    description: '法器产出 +25%',
    color: '#E65100',
    robeColor: '#F57C00',
  },
  {
    id: 'supreme-elder',
    name: '太上长老',
    icon: '👴',
    unlockCost: 80000,
    bonusType: 'all',
    bonusValue: 0.2,
    description: '全产出 +20%',
    color: '#6A1B9A',
    robeColor: '#8E24AA',
  },
  {
    id: 'master',
    name: '掌门',
    icon: '🧙',
    unlockCost: 300000,
    bonusType: 'all',
    bonusValue: 0.4,
    description: '全产出 +40%',
    color: '#B71C1C',
    robeColor: '#D32F2F',
  },
];

// ========== 建筑定义 ==========

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
    id: 'main-hall',
    name: '主殿',
    icon: '🏛️',
    baseCost: { 'spirit-stone': 15 },
    costMultiplier: 1.15,
    maxLevel: 50,
    productionResource: 'spirit-stone',
    baseProduction: 0.5,
  },
  {
    id: 'herb-garden',
    name: '药园',
    icon: '🌿',
    baseCost: { 'spirit-stone': 120 },
    costMultiplier: 1.18,
    maxLevel: 30,
    productionResource: 'herb',
    baseProduction: 0.3,
    requires: ['main-hall'],
  },
  {
    id: 'forge',
    name: '锻造坊',
    icon: '🔨',
    baseCost: { 'spirit-stone': 600 },
    costMultiplier: 1.2,
    maxLevel: 30,
    productionResource: 'artifact',
    baseProduction: 0.2,
    requires: ['main-hall'],
  },
  {
    id: 'library',
    name: '藏经阁',
    icon: '📚',
    baseCost: { 'spirit-stone': 3000, herb: 20 },
    costMultiplier: 1.22,
    maxLevel: 20,
    productionResource: 'spirit-stone',
    baseProduction: 5,
    requires: ['herb-garden'],
  },
  {
    id: 'trial-ground',
    name: '试炼场',
    icon: '⚔️',
    baseCost: { 'spirit-stone': 15000, artifact: 10 },
    costMultiplier: 1.25,
    maxLevel: 15,
    productionResource: 'herb',
    baseProduction: 2,
    requires: ['forge'],
  },
  {
    id: 'sect-array',
    name: '护宗大阵',
    icon: '🔮',
    baseCost: { 'spirit-stone': 100000, artifact: 30 },
    costMultiplier: 1.3,
    maxLevel: 10,
    productionResource: 'reputation',
    baseProduction: 0.1,
    requires: ['library', 'trial-ground'],
  },
];

// ========== 颜色主题（水墨国风：山青/水墨/云白/朱红） ==========

export const COLORS = {
  bgGradient1: '#1a1a2e',
  bgGradient2: '#0f0f1a',
  mountainFar: '#2d3436',
  mountainMid: '#353b48',
  mountainNear: '#404050',
  mistColor: 'rgba(200, 210, 220, 0.08)',
  skyTop: '#0d1b2a',
  skyBottom: '#1b2838',
  textPrimary: '#f0e6d3',
  textSecondary: '#c4b8a5',
  textDim: '#8a7e6e',
  accent: '#c0392b',
  accentGold: '#d4a017',
  accentGreen: '#2ecc71',
  accentBlue: '#5dade2',
  panelBg: 'rgba(26, 26, 46, 0.92)',
  panelBorder: 'rgba(192, 57, 43, 0.3)',
  selectedBg: 'rgba(192, 57, 43, 0.15)',
  selectedBorder: 'rgba(192, 57, 43, 0.6)',
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
