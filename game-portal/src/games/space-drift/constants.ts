/**
 * 太空漂流 (Space Drift) — 放置类游戏常量定义
 *
 * 核心玩法：
 * - 点击收集矿石 (ore)
 * - 建造太空设施，自动产出矿石/能量/数据
 * - 星系探索系统，解锁新区域
 * - 飞船升级系统
 * - 声望系统：重置进度获得星际信用点，提供永久加成
 * - 离线收益
 */

/** Canvas 尺寸 */
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ========== 资源常量 ==========

/** 资源 ID */
export const RESOURCE_IDS = {
  ORE: 'ore',
  ENERGY: 'energy',
  DATA: 'data',
} as const;

/** 点击获得的矿石数 */
export const ORE_PER_CLICK = 1;

/** 声望加成系数（每星际信用点增加的产出倍率） */
export const CREDIT_BONUS_MULTIPLIER = 0.15; // 15% per credit

/** 声望货币计算基数 */
export const PRESTIGE_BASE_CREDITS = 1;

/** 声望所需最低矿石总量 */
export const MIN_PRESTIGE_ORE = 50000;

// ========== 建筑 ID ==========

export const BUILDING_IDS = {
  MINER_DRONE: 'miner_drone',
  SOLAR_PANEL: 'solar_panel',
  RESEARCH_LAB: 'research_lab',
  REFINERY: 'refinery',
  SHIELD_GEN: 'shield_gen',
  WARP_DRIVE: 'warp_drive',
  QUANTUM_CORE: 'quantum_core',
  DYSON_SPHERE: 'dyson_sphere',
} as const;

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

/** 建筑列表（8 个） */
export const BUILDINGS: BuildingDef[] = [
  {
    id: 'miner_drone',
    name: '采矿无人机',
    icon: '⛏️',
    baseCost: { ore: 15 },
    costMultiplier: 1.15,
    maxLevel: 50,
    productionResource: 'ore',
    baseProduction: 0.5,
  },
  {
    id: 'solar_panel',
    name: '太阳能板',
    icon: '☀️',
    baseCost: { ore: 100 },
    costMultiplier: 1.18,
    maxLevel: 40,
    productionResource: 'energy',
    baseProduction: 0.3,
    requires: ['miner_drone'],
  },
  {
    id: 'research_lab',
    name: '研究实验室',
    icon: '🔬',
    baseCost: { ore: 200 },
    costMultiplier: 1.2,
    maxLevel: 30,
    productionResource: 'data',
    baseProduction: 0.2,
    requires: ['miner_drone'],
  },
  {
    id: 'refinery',
    name: '矿石精炼厂',
    icon: '🏭',
    baseCost: { ore: 800, energy: 20 },
    costMultiplier: 1.22,
    maxLevel: 30,
    productionResource: 'ore',
    baseProduction: 4,
    requires: ['solar_panel'],
  },
  {
    id: 'shield_gen',
    name: '护盾发生器',
    icon: '🛡️',
    baseCost: { ore: 1500, energy: 50 },
    costMultiplier: 1.25,
    maxLevel: 25,
    productionResource: 'energy',
    baseProduction: 2,
    requires: ['solar_panel', 'research_lab'],
  },
  {
    id: 'warp_drive',
    name: '曲速引擎',
    icon: '🚀',
    baseCost: { ore: 5000, energy: 200, data: 50 },
    costMultiplier: 1.28,
    maxLevel: 20,
    productionResource: 'data',
    baseProduction: 1,
    requires: ['research_lab', 'refinery'],
  },
  {
    id: 'quantum_core',
    name: '量子核心',
    icon: '💎',
    baseCost: { ore: 20000, energy: 800, data: 200 },
    costMultiplier: 1.3,
    maxLevel: 15,
    productionResource: 'ore',
    baseProduction: 20,
    requires: ['warp_drive', 'shield_gen'],
  },
  {
    id: 'dyson_sphere',
    name: '戴森球',
    icon: '🌟',
    baseCost: { ore: 100000, energy: 5000, data: 1000 },
    costMultiplier: 1.35,
    maxLevel: 10,
    productionResource: 'energy',
    baseProduction: 50,
    requires: ['quantum_core'],
  },
];

// ========== 星系定义 ==========

export interface GalaxyDef {
  id: string;
  name: string;
  icon: string;
  /** 解锁所需矿石 */
  unlockCost: number;
  /** 加成类型 */
  bonusType: 'click' | 'ore' | 'energy' | 'data' | 'all';
  /** 加成值 */
  bonusValue: number;
  /** 描述 */
  description: string;
  /** 星系颜色 */
  color: string;
  /** 核心颜色 */
  coreColor: string;
  /** 进化加成倍率 */
  evolutionMultiplier: number;
}

/** 星系列表 */
export const GALAXIES: GalaxyDef[] = [
  {
    id: 'sol',
    name: '太阳系',
    icon: '☀️',
    unlockCost: 0,
    bonusType: 'click',
    bonusValue: 0.1,
    description: '点击采矿 +10%',
    color: '#FFA726',
    coreColor: '#FFF176',
    evolutionMultiplier: 1.5,
  },
  {
    id: 'alpha_centauri',
    name: '半人马座α',
    icon: '⭐',
    unlockCost: 1000,
    bonusType: 'ore',
    bonusValue: 0.15,
    description: '矿石产出 +15%',
    color: '#42A5F5',
    coreColor: '#90CAF9',
    evolutionMultiplier: 1.4,
  },
  {
    id: 'sirius',
    name: '天狼星系',
    icon: '✨',
    unlockCost: 5000,
    bonusType: 'energy',
    bonusValue: 0.2,
    description: '能量产出 +20%',
    color: '#AB47BC',
    coreColor: '#CE93D8',
    evolutionMultiplier: 1.6,
  },
  {
    id: 'andromeda',
    name: '仙女座',
    icon: '🌀',
    unlockCost: 20000,
    bonusType: 'data',
    bonusValue: 0.2,
    description: '数据产出 +20%',
    color: '#26A69A',
    coreColor: '#80CBC4',
    evolutionMultiplier: 1.3,
  },
  {
    id: 'orion',
    name: '猎户座',
    icon: '🌌',
    unlockCost: 80000,
    bonusType: 'ore',
    bonusValue: 0.3,
    description: '矿石产出 +30%',
    color: '#EF5350',
    coreColor: '#EF9A9A',
    evolutionMultiplier: 2.0,
  },
  {
    id: 'milky_way',
    name: '银河核心',
    icon: '🌠',
    unlockCost: 300000,
    bonusType: 'all',
    bonusValue: 0.25,
    description: '所有加成 +25%',
    color: '#FFD54F',
    coreColor: '#FFF9C4',
    evolutionMultiplier: 1.8,
  },
];

// ========== 飞船升级定义 ==========

/** 飞船升级费用表（按等级） */
export const SHIP_UPGRADE_COSTS: Record<number, Record<string, number>> = {
  1: { energy: 10, data: 5 },
  2: { energy: 50, data: 20, ore: 100 },
  3: { energy: 200, data: 80, ore: 500 },
  4: { energy: 800, data: 300, ore: 2000 },
  5: { energy: 3000, data: 1000, ore: 8000 },
};

/** 最大飞船升级等级 */
export const MAX_SHIP_LEVEL = 5;

// ========== 颜色主题（太空深蓝/紫色/星光色调） ==========

export const COLORS = {
  bgGradient1: '#0D0D2B',
  bgGradient2: '#1A0A2E',
  spaceLight: '#1A237E',
  spaceDark: '#0D0D2B',
  nebulaTop: '#4A148C',
  nebulaBottom: '#1A237E',
  starGlow: '#FFD54F',
  textPrimary: '#E8EAF6',
  textSecondary: '#9FA8DA',
  textDim: '#5C6BC0',
  accent: '#FFD54F',
  accentGreen: '#69F0AE',
  accentRed: '#FF5252',
  accentBlue: '#40C4FF',
  accentPurple: '#B388FF',
  panelBg: 'rgba(26, 10, 46, 0.9)',
  panelBorder: 'rgba(255, 213, 79, 0.3)',
  selectedBg: 'rgba(255, 213, 79, 0.15)',
  selectedBorder: 'rgba(255, 213, 79, 0.6)',
  affordable: '#69F0AE',
  unaffordable: '#FF5252',
  shipShadow: 'rgba(0,0,0,0.3)',
  oreColor: '#FFB74D',
  energyColor: '#40C4FF',
  dataColor: '#B388FF',
  engineFlame: '#FF6D00',
  nebulaColor1: '#7C4DFF',
  nebulaColor2: '#448AFF',
} as const;

// ========== 渲染参数 ==========

export const SHIP_DRAW = {
  centerX: 240,
  centerY: 200,
  bodyWidth: 30,
  bodyHeight: 50,
  wingWidth: 45,
  wingHeight: 20,
  cockpitRadius: 10,
  engineRadius: 6,
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
