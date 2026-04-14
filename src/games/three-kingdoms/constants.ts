/**
 * 三国志 (Three Kingdoms) — 放置类游戏常量定义
 *
 * 核心玩法：
 * - 点击获得粮草 (grain)
 * - 建设城池建筑，自动产出资源
 * - 招募三国武将，获得能力加成
 * - 武将升级系统
 * - 声望系统：重置进度获得「天命」，提供永久加成
 * - 离线收益
 */

/** Canvas 尺寸 */
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ========== 资源 ID ==========

export const RESOURCE_IDS = {
  GRAIN: 'grain',
  GOLD: 'gold',
  TROOP: 'troop',
} as const;

// ========== 建筑 ID ==========

export const BUILDING_IDS = {
  FARM: 'farm',
  MARKET: 'market',
  BARRACKS: 'barracks',
  GRANARY: 'granary',
  TRADING_POST: 'trading_post',
  TRAINING_GROUND: 'training_ground',
  ACADEMY: 'academy',
  WAR_COUNCIL: 'war_council',
} as const;

// ========== 资源常量 ==========

/** 点击获得的粮草数 */
export const GRAIN_PER_CLICK = 1;

/** 声望加成系数（每天命增加的产出倍率） */
export const MANDATE_BONUS_MULTIPLIER = 0.15;

/** 声望所需最低粮草总量 */
export const MIN_PRESTIGE_GRAIN = 50000;

// ========== 武将定义 ==========

export interface GeneralDef {
  id: string;
  name: string;
  title: string;
  icon: string;
  /** 解锁所需粮草 */
  unlockCost: number;
  /** 能力类型 */
  bonusType: 'click' | 'production' | 'gold' | 'troop' | 'all';
  /** 能力值（百分比加成，0.1 = 10%） */
  bonusValue: number;
  /** 描述 */
  description: string;
  /** 阵营颜色 */
  color: string;
  /** 辅助颜色 */
  subColor: string;
  /** 升级加成倍率 */
  upgradeMultiplier: number;
  /** 所属势力 */
  faction: 'shu' | 'wei' | 'wu';
}

/** 武将列表 */
export const GENERALS: GeneralDef[] = [
  {
    id: 'liubei',
    name: '刘备',
    title: '仁德之主',
    icon: '👑',
    unlockCost: 0,
    bonusType: 'click',
    bonusValue: 0.1,
    description: '点击产粮 +10%',
    color: '#2E7D32',
    subColor: '#66BB6A',
    upgradeMultiplier: 1.5,
    faction: 'shu',
  },
  {
    id: 'guanyu',
    name: '关羽',
    title: '武圣',
    icon: '⚔️',
    unlockCost: 800,
    bonusType: 'troop',
    bonusValue: 0.2,
    description: '兵力产出 +20%',
    color: '#C62828',
    subColor: '#EF5350',
    upgradeMultiplier: 1.4,
    faction: 'shu',
  },
  {
    id: 'caocao',
    name: '曹操',
    title: '乱世枭雄',
    icon: '🗡️',
    unlockCost: 3000,
    bonusType: 'production',
    bonusValue: 0.15,
    description: '所有产出 +15%',
    color: '#1565C0',
    subColor: '#42A5F5',
    upgradeMultiplier: 1.6,
    faction: 'wei',
  },
  {
    id: 'zhugeliang',
    name: '诸葛亮',
    title: '卧龙',
    icon: '🪶',
    unlockCost: 8000,
    bonusType: 'gold',
    bonusValue: 0.2,
    description: '金币产出 +20%',
    color: '#4A148C',
    subColor: '#9C27B0',
    upgradeMultiplier: 1.3,
    faction: 'shu',
  },
  {
    id: 'sunquan',
    name: '孙权',
    title: '江东之主',
    icon: '🛡️',
    unlockCost: 25000,
    bonusType: 'production',
    bonusValue: 0.25,
    description: '所有产出 +25%',
    color: '#E65100',
    subColor: '#FF9800',
    upgradeMultiplier: 1.5,
    faction: 'wu',
  },
  {
    id: 'zhaoyun',
    name: '赵云',
    title: '常山赵子龙',
    icon: '🐴',
    unlockCost: 80000,
    bonusType: 'all',
    bonusValue: 0.2,
    description: '所有加成 +20%',
    color: '#004D40',
    subColor: '#26A69A',
    upgradeMultiplier: 1.8,
    faction: 'shu',
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
  /** 解锁条件（需要某资源达到数量） */
  unlockCondition?: Record<string, number>;
}

/** 建筑列表（8个） */
export const BUILDINGS: BuildingDef[] = [
  {
    id: 'farm',
    name: '农田',
    icon: '🌾',
    baseCost: { grain: 15 },
    costMultiplier: 1.15,
    maxLevel: 50,
    productionResource: 'grain',
    baseProduction: 0.5,
  },
  {
    id: 'market',
    name: '集市',
    icon: '🏪',
    baseCost: { grain: 120 },
    costMultiplier: 1.18,
    maxLevel: 30,
    productionResource: 'gold',
    baseProduction: 0.3,
    requires: ['farm'],
  },
  {
    id: 'barracks',
    name: '兵营',
    icon: '⚔️',
    baseCost: { grain: 600 },
    costMultiplier: 1.2,
    maxLevel: 30,
    productionResource: 'troop',
    baseProduction: 0.4,
    requires: ['farm'],
  },
  {
    id: 'granary',
    name: '粮仓',
    icon: '🏛️',
    baseCost: { grain: 3000, gold: 20 },
    costMultiplier: 1.22,
    maxLevel: 20,
    productionResource: 'grain',
    baseProduction: 5,
    requires: ['market', 'barracks'],
  },
  {
    id: 'trading_post',
    name: '商栈',
    icon: '🚢',
    baseCost: { grain: 15000, gold: 100 },
    costMultiplier: 1.25,
    maxLevel: 15,
    productionResource: 'gold',
    baseProduction: 0.8,
    requires: ['market'],
  },
  {
    id: 'training_ground',
    name: '演武场',
    icon: '🏹',
    baseCost: { grain: 50000, troop: 50 },
    costMultiplier: 1.28,
    maxLevel: 15,
    productionResource: 'troop',
    baseProduction: 1.0,
    requires: ['barracks'],
  },
  {
    id: 'academy',
    name: '书院',
    icon: '📜',
    baseCost: { grain: 100000, gold: 200 },
    costMultiplier: 1.3,
    maxLevel: 10,
    productionResource: 'grain',
    baseProduction: 20,
    requires: ['granary'],
  },
  {
    id: 'war_council',
    name: '军机处',
    icon: '🏯',
    baseCost: { grain: 500000, gold: 500, troop: 200 },
    costMultiplier: 1.35,
    maxLevel: 10,
    productionResource: 'troop',
    baseProduction: 3.0,
    requires: ['training_ground', 'academy'],
  },
];

// ========== 颜色主题（古风水墨色调） ==========

export const COLORS = {
  bgGradient1: '#1A1A2E',
  bgGradient2: '#16213E',
  groundLight: '#3E2723',
  groundDark: '#1B0F0A',
  skyTop: '#0D1B2A',
  skyBottom: '#1B2838',
  textPrimary: '#FFF8E1',
  textSecondary: '#D7CCC8',
  textDim: '#8D6E63',
  accent: '#FFB300',
  accentGreen: '#76FF03',
  accentRed: '#FF1744',
  accentBlue: '#40C4FF',
  panelBg: 'rgba(26, 26, 46, 0.9)',
  panelBorder: 'rgba(255, 179, 0, 0.3)',
  selectedBg: 'rgba(255, 179, 0, 0.15)',
  selectedBorder: 'rgba(255, 179, 0, 0.6)',
  affordable: '#76FF03',
  unaffordable: '#FF1744',
  grainColor: '#FFB300',
  goldColor: '#FFD700',
  troopColor: '#EF5350',
  mountainFar: '#2C3E50',
  mountainNear: '#34495E',
  waterColor: '#1A5276',
  moonGlow: 'rgba(255, 248, 225, 0.15)',
  cloudColor: 'rgba(255, 255, 255, 0.08)',
  generalShadow: 'rgba(0,0,0,0.3)',
} as const;

// ========== 渲染参数 ==========

export const SCENE_DRAW = {
  centerX: 240,
  centerY: 200,
  bodyWidth: 50,
  bodyHeight: 50,
  headRadius: 18,
  eyeRadius: 3,
  weaponLength: 40,
  legHeight: 12,
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
