/**
 * 末日生存 (Doomsday) — 放置类游戏常量定义
 *
 * 核心玩法：
 * - 点击收集物资 (supply)
 * - 建设避难所建筑，自动产出物资/弹药/电力
 * - 丧尸防御系统
 * - 避难所升级
 * - 声望系统：重置进度获得「末日芯片」，提供永久加成
 * - 离线收益
 */

/** Canvas 尺寸 */
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ========== 资源 ID ==========

export const RESOURCE_IDS = {
  SUPPLY: 'supply',
  AMMO: 'ammo',
  POWER: 'power',
} as const;

// ========== 建筑 ID ==========

export const BUILDING_IDS = {
  SHELTER: 'shelter',
  GENERATOR: 'generator',
  WORKSHOP: 'workshop',
  ARMORY: 'armory',
  TURRET: 'turret',
  LAB: 'lab',
  TRADING_POST: 'trading_post',
  FORTRESS: 'fortress',
} as const;

// ========== 核心常量 ==========

/** 点击获得的物资数 */
export const SUPPLY_PER_CLICK = 1;

/** 声望加成系数（每末日芯片增加的产出倍率） */
export const CHIP_BONUS_MULTIPLIER = 0.12; // 12% per chip

/** 声望货币计算基数 */
export const PRESTIGE_BASE_CHIPS = 1;

/** 声望所需最低物资总量 */
export const MIN_PRESTIGE_SUPPLY = 50000;

// ========== 丧尸波次定义 ==========

export interface ZombieWaveDef {
  /** 波次编号 */
  wave: number;
  /** 丧尸数量 */
  count: number;
  /** 每只丧尸生命值 */
  hp: number;
  /** 击败奖励 */
  reward: Record<string, number>;
}

/** 丧尸波次列表 */
export const ZOMBIE_WAVES: ZombieWaveDef[] = [
  { wave: 1, count: 5, hp: 10, reward: { supply: 50 } },
  { wave: 2, count: 8, hp: 20, reward: { supply: 120, ammo: 20 } },
  { wave: 3, count: 12, hp: 35, reward: { supply: 250, ammo: 50 } },
  { wave: 4, count: 18, hp: 55, reward: { supply: 500, ammo: 100, power: 20 } },
  { wave: 5, count: 25, hp: 80, reward: { supply: 1000, ammo: 200, power: 50 } },
  { wave: 6, count: 35, hp: 120, reward: { supply: 2000, ammo: 400, power: 100 } },
  { wave: 7, count: 50, hp: 180, reward: { supply: 5000, ammo: 800, power: 200 } },
  { wave: 8, count: 70, hp: 260, reward: { supply: 10000, ammo: 1500, power: 500 } },
  { wave: 9, count: 100, hp: 400, reward: { supply: 25000, ammo: 3000, power: 1000 } },
  { wave: 10, count: 150, hp: 600, reward: { supply: 50000, ammo: 5000, power: 2000 } },
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
  /** 解锁条件描述 */
  description: string;
}

/** 建筑列表 */
export const BUILDINGS: BuildingDef[] = [
  {
    id: 'shelter',
    name: '避难所',
    icon: '🏠',
    baseCost: { supply: 15 },
    costMultiplier: 1.15,
    maxLevel: 50,
    productionResource: 'supply',
    baseProduction: 0.5,
    description: '基础物资产出',
  },
  {
    id: 'generator',
    name: '发电站',
    icon: '⚡',
    baseCost: { supply: 100 },
    costMultiplier: 1.18,
    maxLevel: 40,
    productionResource: 'power',
    baseProduction: 0.3,
    requires: ['shelter'],
    description: '生产电力',
  },
  {
    id: 'workshop',
    name: '武器工坊',
    icon: '🔧',
    baseCost: { supply: 200, power: 20 },
    costMultiplier: 1.2,
    maxLevel: 30,
    productionResource: 'ammo',
    baseProduction: 0.2,
    requires: ['shelter'],
    description: '生产弹药',
  },
  {
    id: 'armory',
    name: '军械库',
    icon: '🔫',
    baseCost: { supply: 500, ammo: 50 },
    costMultiplier: 1.22,
    maxLevel: 30,
    productionResource: 'supply',
    baseProduction: 3,
    requires: ['generator', 'workshop'],
    description: '高级物资产出',
  },
  {
    id: 'turret',
    name: '防御塔',
    icon: '🗼',
    baseCost: { supply: 2000, ammo: 200, power: 50 },
    costMultiplier: 1.25,
    maxLevel: 25,
    productionResource: 'ammo',
    baseProduction: 8,
    requires: ['workshop'],
    description: '防御丧尸，产出弹药',
  },
  {
    id: 'lab',
    name: '实验室',
    icon: '🔬',
    baseCost: { supply: 8000, ammo: 500, power: 200 },
    costMultiplier: 1.28,
    maxLevel: 20,
    productionResource: 'power',
    baseProduction: 1,
    requires: ['armory'],
    description: '高级电力产出',
  },
  {
    id: 'trading_post',
    name: '交易站',
    icon: '🏪',
    baseCost: { supply: 20000, ammo: 1000, power: 500 },
    costMultiplier: 1.3,
    maxLevel: 15,
    productionResource: 'supply',
    baseProduction: 5,
    requires: ['armory', 'lab'],
    description: '大量物资产出',
  },
  {
    id: 'fortress',
    name: '堡垒',
    icon: '🏰',
    baseCost: { supply: 100000, ammo: 5000, power: 2000 },
    costMultiplier: 1.35,
    maxLevel: 10,
    productionResource: 'supply',
    baseProduction: 50,
    requires: ['trading_post'],
    description: '终极建筑，大量物资',
  },
];

// ========== 颜色主题（末日废土风格：灰绿/锈红/暗黄） ==========

export const COLORS = {
  bgGradient1: '#1A1A2E',
  bgGradient2: '#0F0F1A',
  groundLight: '#2D2D3A',
  groundDark: '#1A1A2E',
  skyTop: '#16213E',
  skyBottom: '#0F3460',
  ruinColor: '#3A3A4A',
  textPrimary: '#E0E0E0',
  textSecondary: '#A0A0B0',
  textDim: '#606070',
  accent: '#E94560',
  accentGreen: '#4CAF50',
  accentYellow: '#FFC107',
  accentBlue: '#00BCD4',
  panelBg: 'rgba(26, 26, 46, 0.9)',
  panelBorder: 'rgba(233, 69, 96, 0.3)',
  selectedBg: 'rgba(233, 69, 96, 0.15)',
  selectedBorder: 'rgba(233, 69, 96, 0.6)',
  affordable: '#4CAF50',
  unaffordable: '#E94560',
  shadowColor: 'rgba(0,0,0,0.3)',
  supplyColor: '#FFC107',
  ammoColor: '#FF5722',
  powerColor: '#00BCD4',
  zombieGreen: '#76FF03',
  fireOrange: '#FF6F00',
  bloodRed: '#B71C1C',
} as const;

// ========== 渲染参数 ==========

export const SCENE_DRAW = {
  centerX: 240,
  centerY: 200,
  bunkerWidth: 80,
  bunkerHeight: 60,
  doorWidth: 20,
  doorHeight: 30,
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
