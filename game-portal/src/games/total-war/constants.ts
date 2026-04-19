/**
 * 全面战争 (Total War) — 放置类游戏常量定义
 *
 * 核心玩法：
 * - 点击获得金币 (gold)
 * - 建设帝国建筑，自动产出资源
 * - 训练军队征服领土
 * - 三种资源：金币、铁矿石、兵力
 * - 声望系统：重置进度获得荣耀点，提供永久加成
 * - 离线收益
 */

/** Canvas 尺寸 */
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ========== 资源 ID ==========

export const RESOURCE_IDS = {
  GOLD: 'gold',
  IRON: 'iron',
  TROOP: 'troop',
} as const;

// ========== 建筑ID ==========

export const BUILDING_IDS = {
  GOLD_MINE: 'gold_mine',
  IRON_MINE: 'iron_mine',
  BARRACKS: 'barracks',
  BLACKSMITH: 'blacksmith',
  ARCHERY_RANGE: 'archery_range',
  STABLE: 'stable',
  WAR_CAMP: 'war_camp',
  CASTLE: 'castle',
} as const;

// ========== 核心数值常量 ==========

/** 每次点击获得的金币 */
export const GOLD_PER_CLICK = 1;

/** 声望加成系数（每荣耀点增加的产出倍率） */
export const PRESTIGE_BONUS_MULTIPLIER = 0.15;

/** 声望货币计算基数 */
export const PRESTIGE_BASE_GLORY = 1;

/** 声望所需最低金币总量 */
export const MIN_PRESTIGE_GOLD = 50000;

// ========== 兵种定义 ==========

export interface TroopTypeDef {
  id: string;
  name: string;
  icon: string;
  /** 训练费用 */
  cost: Record<string, number>;
  /** 攻击力 */
  attack: number;
  /** 防御力 */
  defense: number;
  /** 解锁所需建筑等级 */
  requiredBuilding: string;
  requiredLevel: number;
  /** 颜色 */
  color: string;
  /** 进化加成倍率 */
  upgradeMultiplier: number;
  /** 描述 */
  description: string;
}

/** 兵种列表 */
export const TROOP_TYPES: TroopTypeDef[] = [
  {
    id: 'militia',
    name: '民兵',
    icon: '🗡️',
    cost: { gold: 10 },
    attack: 2,
    defense: 1,
    requiredBuilding: 'barracks',
    requiredLevel: 1,
    color: '#8D6E63',
    upgradeMultiplier: 1.3,
    description: '基础步兵，攻2防1',
  },
  {
    id: 'swordsman',
    name: '剑士',
    icon: '⚔️',
    cost: { gold: 50, iron: 20 },
    attack: 5,
    defense: 4,
    requiredBuilding: 'blacksmith',
    requiredLevel: 1,
    color: '#78909C',
    upgradeMultiplier: 1.4,
    description: '精锐剑士，攻5防4',
  },
  {
    id: 'archer',
    name: '弓箭手',
    icon: '🏹',
    cost: { gold: 40, iron: 10 },
    attack: 7,
    defense: 2,
    requiredBuilding: 'archery_range',
    requiredLevel: 1,
    color: '#66BB6A',
    upgradeMultiplier: 1.5,
    description: '远程弓手，攻7防2',
  },
  {
    id: 'cavalry',
    name: '骑兵',
    icon: '🐴',
    cost: { gold: 120, iron: 60 },
    attack: 10,
    defense: 6,
    requiredBuilding: 'stable',
    requiredLevel: 1,
    color: '#FFA726',
    upgradeMultiplier: 1.6,
    description: '重装骑兵，攻10防6',
  },
  {
    id: 'siege',
    name: '攻城器械',
    icon: '🏰',
    cost: { gold: 300, iron: 150 },
    attack: 20,
    defense: 3,
    requiredBuilding: 'war_camp',
    requiredLevel: 1,
    color: '#EF5350',
    upgradeMultiplier: 1.8,
    description: '攻城利器，攻20防3',
  },
  {
    id: 'knight',
    name: '圣骑士',
    icon: '🛡️',
    cost: { gold: 500, iron: 250 },
    attack: 15,
    defense: 15,
    requiredBuilding: 'castle',
    requiredLevel: 1,
    color: '#AB47BC',
    upgradeMultiplier: 2.0,
    description: '终极兵种，攻15防15',
  },
];

// ========== 领土定义 ==========

export interface TerritoryDef {
  id: string;
  name: string;
  icon: string;
  /** 所需总战斗力（attack + defense） */
  requiredPower: number;
  /** 征服奖励：每秒金币 */
  goldReward: number;
  /** 征服奖励：每秒铁矿石 */
  ironReward: number;
  /** 征服奖励：一次性兵力 */
  troopReward: number;
  /** 颜色 */
  color: string;
  /** 描述 */
  description: string;
}

/** 领土列表 */
export const TERRITORIES: TerritoryDef[] = [
  {
    id: 'village',
    name: '边境村庄',
    icon: '🏘️',
    requiredPower: 10,
    goldReward: 1,
    ironReward: 0.2,
    troopReward: 5,
    color: '#A5D6A7',
    description: '宁静的边境小村',
  },
  {
    id: 'forest',
    name: '暗影森林',
    icon: '🌲',
    requiredPower: 30,
    goldReward: 2,
    ironReward: 0.5,
    troopReward: 10,
    color: '#2E7D32',
    description: '神秘的古老森林',
  },
  {
    id: 'mountain',
    name: '铁壁山脉',
    icon: '⛰️',
    requiredPower: 80,
    goldReward: 3,
    ironReward: 1.5,
    troopReward: 20,
    color: '#78909C',
    description: '富含铁矿的山脉',
  },
  {
    id: 'desert',
    name: '灼热沙漠',
    icon: '🏜️',
    requiredPower: 200,
    goldReward: 6,
    ironReward: 2,
    troopReward: 40,
    color: '#FFB74D',
    description: '黄金遍地的沙漠',
  },
  {
    id: 'swamp',
    name: '死亡沼泽',
    icon: '🐊',
    requiredPower: 500,
    goldReward: 10,
    ironReward: 3,
    troopReward: 80,
    color: '#558B2F',
    description: '危险的瘴气沼泽',
  },
  {
    id: 'fortress',
    name: '钢铁要塞',
    icon: '🏯',
    requiredPower: 1200,
    goldReward: 20,
    ironReward: 6,
    troopReward: 150,
    color: '#B71C1C',
    description: '坚不可摧的要塞',
  },
  {
    id: 'capital',
    name: '帝都王城',
    icon: '👑',
    requiredPower: 3000,
    goldReward: 50,
    ironReward: 15,
    troopReward: 300,
    color: '#FFD600',
    description: '帝国的心脏',
  },
  {
    id: 'darklands',
    name: '暗黑领域',
    icon: '💀',
    requiredPower: 8000,
    goldReward: 100,
    ironReward: 30,
    troopReward: 500,
    color: '#4A148C',
    description: '最终征服之地',
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

/** 建筑列表 */
export const BUILDINGS: BuildingDef[] = [
  {
    id: 'gold_mine',
    name: '金矿场',
    icon: '⛏️',
    baseCost: { gold: 15 },
    costMultiplier: 1.15,
    maxLevel: 50,
    productionResource: 'gold',
    baseProduction: 0.5,
  },
  {
    id: 'iron_mine',
    name: '铁矿场',
    icon: '🔩',
    baseCost: { gold: 80 },
    costMultiplier: 1.18,
    maxLevel: 40,
    productionResource: 'iron',
    baseProduction: 0.2,
    requires: ['gold_mine'],
  },
  {
    id: 'barracks',
    name: '兵营',
    icon: '🏕️',
    baseCost: { gold: 200, iron: 30 },
    costMultiplier: 1.2,
    maxLevel: 30,
    productionResource: 'troop',
    baseProduction: 0.3,
    requires: ['gold_mine'],
  },
  {
    id: 'blacksmith',
    name: '铁匠铺',
    icon: '🔨',
    baseCost: { gold: 500, iron: 100 },
    costMultiplier: 1.22,
    maxLevel: 25,
    productionResource: 'iron',
    baseProduction: 1,
    requires: ['iron_mine', 'barracks'],
  },
  {
    id: 'archery_range',
    name: '射箭场',
    icon: '🎯',
    baseCost: { gold: 1000, iron: 200 },
    costMultiplier: 1.25,
    maxLevel: 20,
    productionResource: 'troop',
    baseProduction: 0.8,
    requires: ['barracks'],
  },
  {
    id: 'stable',
    name: '马厩',
    icon: '🐎',
    baseCost: { gold: 3000, iron: 500 },
    costMultiplier: 1.28,
    maxLevel: 15,
    productionResource: 'troop',
    baseProduction: 1.5,
    requires: ['archery_range', 'blacksmith'],
  },
  {
    id: 'war_camp',
    name: '战争营地',
    icon: '⚔️',
    baseCost: { gold: 10000, iron: 2000 },
    costMultiplier: 1.3,
    maxLevel: 10,
    productionResource: 'troop',
    baseProduction: 3,
    requires: ['stable'],
  },
  {
    id: 'castle',
    name: '城堡',
    icon: '🏰',
    baseCost: { gold: 50000, iron: 10000 },
    costMultiplier: 1.35,
    maxLevel: 8,
    productionResource: 'troop',
    baseProduction: 5,
    requires: ['war_camp'],
  },
];

// ========== 颜色主题（中世纪战争风格） ==========

export const COLORS = {
  bgGradient1: '#1A237E',
  bgGradient2: '#0D1B2A',
  groundLight: '#5D4037',
  groundDark: '#3E2723',
  skyTop: '#0D1B2A',
  skyBottom: '#1B2838',
  bannerRed: '#B71C1C',
  bannerGold: '#FFD600',
  textPrimary: '#FFF8E1',
  textSecondary: '#B0BEC5',
  textDim: '#607D8B',
  accent: '#FFD600',
  accentGreen: '#76FF03',
  accentRed: '#FF1744',
  accentBlue: '#40C4FF',
  panelBg: 'rgba(26, 35, 126, 0.85)',
  panelBorder: 'rgba(255, 214, 0, 0.3)',
  selectedBg: 'rgba(255, 214, 0, 0.15)',
  selectedBorder: 'rgba(255, 214, 0, 0.6)',
  affordable: '#76FF03',
  unaffordable: '#FF1744',
  shadowColor: 'rgba(0,0,0,0.3)',
  goldColor: '#FFD600',
  ironColor: '#90A4AE',
  troopColor: '#EF5350',
  fireColor: '#FF6F00',
  swordColor: '#CFD8DC',
} as const;

// ========== 渲染参数 ==========

export const CASTLE_DRAW = {
  centerX: 240,
  centerY: 180,
  width: 80,
  height: 100,
  towerWidth: 20,
  towerHeight: 50,
  flagHeight: 25,
} as const;

/** 建筑列表面板参数 */
export const BUILDING_PANEL = {
  startY: 360,
  itemHeight: 42,
  itemPadding: 4,
  itemMarginX: 12,
  itemWidth: CANVAS_WIDTH - 24,
  visibleCount: 5,
} as const;

/** 资源面板参数 */
export const RESOURCE_PANEL = {
  startY: 8,
  itemHeight: 24,
  itemPadding: 4,
  padding: 8,
} as const;
