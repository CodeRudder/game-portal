/**
 * 红色警戒 (Red Alert) — 放置类游戏常量定义
 *
 * 核心玩法：
 * - 点击采集矿石 (ore)
 * - 建设军事基地建筑，自动产出矿石/电力/科技点
 * - 训练部队（兵种系统）
 * - 科技树升级系统
 * - 声望系统：重置进度获得「指挥官勋章」，提供永久加成
 * - 离线收益
 */

/** Canvas 尺寸 */
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ========== 资源 ID ==========

export const RESOURCE_IDS = {
  ORE: 'ore',
  POWER: 'power',
  TECH: 'tech',
} as const;

// ========== 建筑 ID（8 个） ==========

export const BUILDING_IDS = {
  ORE_REFINERY: 'ore_refinery',
  POWER_PLANT: 'power_plant',
  BARRACKS: 'barracks',
  WAR_FACTORY: 'war_factory',
  TECH_CENTER: 'tech_center',
  RADAR_STATION: 'radar_station',
  BATTLE_LAB: 'battle_lab',
  COMMAND_CENTER: 'command_center',
} as const;

// ========== 资源常量 ==========

/** 点击获得的矿石数 */
export const ORE_PER_CLICK = 1;

/** 声望加成系数（每指挥官勋章增加的产出倍率） */
export const MEDAL_BONUS_MULTIPLIER = 0.12; // 12% per medal

/** 声望货币计算基数 */
export const PRESTIGE_BASE_MEDALS = 1;

/** 声望所需最低矿石总量 */
export const MIN_PRESTIGE_ORE = 50000;

// ========== 兵种定义 ==========

export interface UnitDef {
  id: string;
  name: string;
  icon: string;
  /** 解锁所需矿石 */
  unlockCost: number;
  /** 能力类型 */
  bonusType: 'click' | 'production' | 'power' | 'tech' | 'all';
  /** 能力值（百分比加成，0.1 = 10%） */
  bonusValue: number;
  /** 描述 */
  description: string;
  /** 颜色（Canvas 绘制用） */
  color: string;
  /** 进化（升级）加成倍率 */
  upgradeMultiplier: number;
}

/** 兵种列表 */
export const UNITS: UnitDef[] = [
  {
    id: 'gi',
    name: '美国大兵',
    icon: '🔫',
    unlockCost: 0,
    bonusType: 'click',
    bonusValue: 0.1,
    description: '点击采矿 +10%',
    color: '#4A6741',
    upgradeMultiplier: 1.5,
  },
  {
    id: 'rocketeer',
    name: '火箭飞行兵',
    icon: '🚀',
    unlockCost: 500,
    bonusType: 'production',
    bonusValue: 0.15,
    description: '所有产出 +15%',
    color: '#5C6BC0',
    upgradeMultiplier: 1.4,
  },
  {
    id: 'tank',
    name: '灰熊坦克',
    icon: '🛡️',
    unlockCost: 3000,
    bonusType: 'power',
    bonusValue: 0.2,
    description: '电力产出 +20%',
    color: '#8B6914',
    upgradeMultiplier: 1.6,
  },
  {
    id: 'sniper',
    name: '狙击手',
    icon: '🎯',
    unlockCost: 8000,
    bonusType: 'tech',
    bonusValue: 0.2,
    description: '科技点产出 +20%',
    color: '#2E7D32',
    upgradeMultiplier: 1.3,
  },
  {
    id: 'tesla',
    name: '磁暴步兵',
    icon: '⚡',
    unlockCost: 25000,
    bonusType: 'production',
    bonusValue: 0.3,
    description: '所有产出 +30%',
    color: '#B71C1C',
    upgradeMultiplier: 2.0,
  },
  {
    id: 'chrono',
    name: '超时空军团兵',
    icon: '🌀',
    unlockCost: 80000,
    bonusType: 'all',
    bonusValue: 0.25,
    description: '所有加成 +25%',
    color: '#6A1B9A',
    upgradeMultiplier: 1.8,
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

/** 建筑列表（8 个） */
export const BUILDINGS: BuildingDef[] = [
  {
    id: 'ore_refinery',
    name: '矿厂',
    icon: '⛏️',
    baseCost: { ore: 15 },
    costMultiplier: 1.15,
    maxLevel: 50,
    productionResource: 'ore',
    baseProduction: 0.5,
  },
  {
    id: 'power_plant',
    name: '电厂',
    icon: '⚡',
    baseCost: { ore: 100 },
    costMultiplier: 1.18,
    maxLevel: 40,
    productionResource: 'power',
    baseProduction: 0.3,
    requires: ['ore_refinery'],
  },
  {
    id: 'barracks',
    name: '兵营',
    icon: '🏕️',
    baseCost: { ore: 500 },
    costMultiplier: 1.2,
    maxLevel: 30,
    productionResource: 'ore',
    baseProduction: 4,
    requires: ['ore_refinery'],
  },
  {
    id: 'war_factory',
    name: '战车工厂',
    icon: '🏭',
    baseCost: { ore: 2000, power: 10 },
    costMultiplier: 1.22,
    maxLevel: 25,
    productionResource: 'ore',
    baseProduction: 15,
    requires: ['barracks', 'power_plant'],
  },
  {
    id: 'tech_center',
    name: '科技中心',
    icon: '🔬',
    baseCost: { ore: 5000, power: 50 },
    costMultiplier: 1.25,
    maxLevel: 20,
    productionResource: 'tech',
    baseProduction: 0.2,
    requires: ['power_plant'],
  },
  {
    id: 'radar_station',
    name: '雷达站',
    icon: '📡',
    baseCost: { ore: 10000, power: 100, tech: 10 },
    costMultiplier: 1.28,
    maxLevel: 15,
    productionResource: 'power',
    baseProduction: 3,
    requires: ['tech_center'],
  },
  {
    id: 'battle_lab',
    name: '作战实验室',
    icon: '🧪',
    baseCost: { ore: 30000, power: 200, tech: 50 },
    costMultiplier: 1.3,
    maxLevel: 10,
    productionResource: 'tech',
    baseProduction: 1,
    requires: ['radar_station'],
  },
  {
    id: 'command_center',
    name: '指挥中心',
    icon: '🏛️',
    baseCost: { ore: 80000, power: 500, tech: 150 },
    costMultiplier: 1.35,
    maxLevel: 10,
    productionResource: 'tech',
    baseProduction: 3,
    requires: ['battle_lab'],
  },
];

// ========== 科技树定义 ==========

export interface TechDef {
  id: string;
  name: string;
  icon: string;
  /** 基础费用 */
  baseCost: Record<string, number>;
  /** 费用递增系数 */
  costMultiplier: number;
  /** 最大等级 */
  maxLevel: number;
  /** 效果类型 */
  effectType: 'multiply_ore' | 'multiply_power' | 'multiply_tech' | 'click_bonus' | 'all_bonus';
  /** 效果值 */
  effectValue: number;
  /** 前置科技 */
  requires?: string[];
  /** 描述 */
  description: string;
}

/** 科技树列表 */
export const TECHS: TechDef[] = [
  {
    id: 'rapid_mining',
    name: '快速采矿',
    icon: '⛏️',
    baseCost: { tech: 5 },
    costMultiplier: 1.5,
    maxLevel: 10,
    effectType: 'multiply_ore',
    effectValue: 0.1,
    description: '矿石产出 +10%/级',
  },
  {
    id: 'advanced_power',
    name: '先进电力',
    icon: '⚡',
    baseCost: { tech: 10, ore: 1000 },
    costMultiplier: 1.5,
    maxLevel: 10,
    effectType: 'multiply_power',
    effectValue: 0.1,
    description: '电力产出 +10%/级',
  },
  {
    id: 'weapon_upgrades',
    name: '武器升级',
    icon: '🔫',
    baseCost: { tech: 15, ore: 3000 },
    costMultiplier: 1.6,
    maxLevel: 10,
    effectType: 'click_bonus',
    effectValue: 0.15,
    description: '点击采矿 +15%/级',
  },
  {
    id: 'ai_system',
    name: 'AI 系统',
    icon: '🤖',
    baseCost: { tech: 30, ore: 10000 },
    costMultiplier: 1.7,
    maxLevel: 10,
    effectType: 'all_bonus',
    effectValue: 0.08,
    description: '所有产出 +8%/级',
    requires: ['rapid_mining', 'advanced_power'],
  },
  {
    id: 'chronotech',
    name: '超时空科技',
    icon: '🌀',
    baseCost: { tech: 80, ore: 50000 },
    costMultiplier: 2.0,
    maxLevel: 5,
    effectType: 'all_bonus',
    effectValue: 0.2,
    description: '所有产出 +20%/级',
    requires: ['ai_system'],
  },
];

// ========== 颜色主题（军事红色警戒风格） ==========

export const COLORS = {
  bgGradient1: '#1a0a0a',
  bgGradient2: '#0a0a1a',
  groundLight: '#3E2723',
  groundDark: '#1B0F0A',
  skyTop: '#1a0000',
  skyBottom: '#330000',
  textPrimary: '#FFEBEE',
  textSecondary: '#EF9A9A',
  textDim: '#8D6E63',
  accent: '#F44336',
  accentGreen: '#76FF03',
  accentRed: '#FF1744',
  accentBlue: '#40C4FF',
  panelBg: 'rgba(40, 10, 10, 0.9)',
  panelBorder: 'rgba(244, 67, 54, 0.3)',
  selectedBg: 'rgba(244, 67, 54, 0.15)',
  selectedBorder: 'rgba(244, 67, 54, 0.6)',
  affordable: '#76FF03',
  unaffordable: '#FF1744',
  buildingShadow: 'rgba(0,0,0,0.3)',
  oreColor: '#FFB300',
  powerColor: '#42A5F5',
  techColor: '#AB47BC',
  radarGlow: '#F44336',
} as const;

// ========== 渲染参数 ==========

export const BASE_DRAW = {
  centerX: 240,
  centerY: 200,
  width: 80,
  height: 60,
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
