/**
 * 地下城探险 (Dungeon Explore) — 放置类游戏常量定义
 *
 * 核心玩法：
 * - 探索地下城获得金币、经验、宝石
 * - 建造酒馆、铁匠铺、魔法塔等建筑
 * - 角色升级系统
 * - 装备系统（武器/护甲/饰品）
 * - 声望系统：重置进度获得远古之魂，提供永久加成
 * - 离线收益
 */

/** Canvas 尺寸 */
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ========== 资源 ID ==========

export const RESOURCE_IDS = {
  GOLD: 'gold',
  EXP: 'exp',
  GEM: 'gem',
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

// ========== 建筑 ID ==========

export const BUILDING_IDS = {
  TAVERN: 'tavern',
  BLACKSMITH: 'blacksmith',
  MAGIC_TOWER: 'magic_tower',
  TRAINING_GROUND: 'training_ground',
  ALCHEMY_LAB: 'alchemy_lab',
  MERCHANT: 'merchant',
  TREASURE_ROOM: 'treasure_room',
  ARENA: 'arena',
} as const;

/** 建筑列表 */
export const BUILDINGS: BuildingDef[] = [
  {
    id: BUILDING_IDS.TAVERN,
    name: '酒馆',
    icon: '🍺',
    baseCost: { gold: 15 },
    costMultiplier: 1.15,
    maxLevel: 50,
    productionResource: RESOURCE_IDS.GOLD,
    baseProduction: 0.5,
  },
  {
    id: BUILDING_IDS.BLACKSMITH,
    name: '铁匠铺',
    icon: '⚒️',
    baseCost: { gold: 100 },
    costMultiplier: 1.18,
    maxLevel: 40,
    productionResource: RESOURCE_IDS.GOLD,
    baseProduction: 3,
    requires: [BUILDING_IDS.TAVERN],
  },
  {
    id: BUILDING_IDS.MAGIC_TOWER,
    name: '魔法塔',
    icon: '🔮',
    baseCost: { gold: 500, gem: 5 },
    costMultiplier: 1.2,
    maxLevel: 30,
    productionResource: RESOURCE_IDS.GEM,
    baseProduction: 0.2,
    requires: [BUILDING_IDS.BLACKSMITH],
  },
  {
    id: BUILDING_IDS.TRAINING_GROUND,
    name: '训练场',
    icon: '⚔️',
    baseCost: { gold: 200 },
    costMultiplier: 1.16,
    maxLevel: 40,
    productionResource: RESOURCE_IDS.EXP,
    baseProduction: 1,
    requires: [BUILDING_IDS.TAVERN],
  },
  {
    id: BUILDING_IDS.ALCHEMY_LAB,
    name: '炼金实验室',
    icon: '⚗️',
    baseCost: { gold: 2000, gem: 20 },
    costMultiplier: 1.22,
    maxLevel: 25,
    productionResource: RESOURCE_IDS.GEM,
    baseProduction: 0.5,
    requires: [BUILDING_IDS.MAGIC_TOWER],
  },
  {
    id: BUILDING_IDS.MERCHANT,
    name: '商人公会',
    icon: '💰',
    baseCost: { gold: 5000 },
    costMultiplier: 1.25,
    maxLevel: 20,
    productionResource: RESOURCE_IDS.GOLD,
    baseProduction: 20,
    requires: [BUILDING_IDS.BLACKSMITH, BUILDING_IDS.TRAINING_GROUND],
  },
  {
    id: BUILDING_IDS.TREASURE_ROOM,
    name: '宝物室',
    icon: '👑',
    baseCost: { gold: 20000, gem: 100 },
    costMultiplier: 1.3,
    maxLevel: 15,
    productionResource: RESOURCE_IDS.GEM,
    baseProduction: 1,
    requires: [BUILDING_IDS.ALCHEMY_LAB],
  },
  {
    id: BUILDING_IDS.ARENA,
    name: '竞技场',
    icon: '🏟️',
    baseCost: { gold: 50000, gem: 200 },
    costMultiplier: 1.35,
    maxLevel: 10,
    productionResource: RESOURCE_IDS.EXP,
    baseProduction: 10,
    requires: [BUILDING_IDS.MERCHANT, BUILDING_IDS.TREASURE_ROOM],
  },
];

// ========== 装备定义 ==========

export type EquipmentSlot = 'weapon' | 'armor' | 'accessory';

export interface EquipmentDef {
  id: string;
  name: string;
  icon: string;
  slot: EquipmentSlot;
  /** 购买费用 */
  cost: Record<string, number>;
  /** 属性加成 */
  bonus: {
    type: 'click_gold' | 'click_exp' | 'click_gem' | 'production' | 'exp_production' | 'gem_production';
    value: number;
  };
  /** 需要角色等级 */
  requireLevel: number;
  /** 描述 */
  description: string;
}

export const EQUIPMENTS: EquipmentDef[] = [
  {
    id: 'wooden_sword',
    name: '木剑',
    icon: '🗡️',
    slot: 'weapon',
    cost: { gold: 50 },
    bonus: { type: 'click_gold', value: 1 },
    requireLevel: 1,
    description: '点击金币 +1',
  },
  {
    id: 'iron_sword',
    name: '铁剑',
    icon: '⚔️',
    slot: 'weapon',
    cost: { gold: 500, gem: 10 },
    bonus: { type: 'click_gold', value: 3 },
    requireLevel: 5,
    description: '点击金币 +3',
  },
  {
    id: 'leather_armor',
    name: '皮甲',
    icon: '🛡️',
    slot: 'armor',
    cost: { gold: 80 },
    bonus: { type: 'production', value: 0.1 },
    requireLevel: 2,
    description: '所有产出 +10%',
  },
  {
    id: 'chain_mail',
    name: '锁子甲',
    icon: '🛡️',
    slot: 'armor',
    cost: { gold: 1000, gem: 20 },
    bonus: { type: 'production', value: 0.25 },
    requireLevel: 8,
    description: '所有产出 +25%',
  },
  {
    id: 'ring_wisdom',
    name: '智慧之戒',
    icon: '💍',
    slot: 'accessory',
    cost: { gold: 200, gem: 5 },
    bonus: { type: 'exp_production', value: 0.2 },
    requireLevel: 3,
    description: '经验产出 +20%',
  },
  {
    id: 'amulet_fortune',
    name: '财富护符',
    icon: '📿',
    slot: 'accessory',
    cost: { gold: 3000, gem: 50 },
    bonus: { type: 'gem_production', value: 0.3 },
    requireLevel: 10,
    description: '宝石产出 +30%',
  },
  {
    id: 'flame_sword',
    name: '烈焰之剑',
    icon: '🔥',
    slot: 'weapon',
    cost: { gold: 10000, gem: 100 },
    bonus: { type: 'click_gold', value: 10 },
    requireLevel: 15,
    description: '点击金币 +10',
  },
  {
    id: 'dragon_armor',
    name: '龙鳞甲',
    icon: '🐉',
    slot: 'armor',
    cost: { gold: 50000, gem: 200 },
    bonus: { type: 'production', value: 0.5 },
    requireLevel: 20,
    description: '所有产出 +50%',
  },
];

// ========== 角色升级经验表 ==========

/** 每级所需经验 = BASE * MULTIPLIER^(level-1) */
export const LEVEL_EXP_BASE = 50;
export const LEVEL_EXP_MULTIPLIER = 1.5;
/** 最大角色等级 */
export const MAX_CHARACTER_LEVEL = 50;

/**
 * 获取指定等级所需经验
 */
export function getExpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.floor(LEVEL_EXP_BASE * Math.pow(LEVEL_EXP_MULTIPLIER, level - 2));
}

// ========== 点击常量 ==========

/** 点击获得的金币 */
export const GOLD_PER_CLICK = 1;
/** 点击获得的经验 */
export const EXP_PER_CLICK = 2;

// ========== 声望常量 ==========

/** 声望加成系数（每远古之魂增加的产出倍率） */
export const SOUL_BONUS_MULTIPLIER = 0.2; // 20% per soul
/** 声望所需最低金币总量 */
export const MIN_PRESTIGE_GOLD = 50000;
/** 声望货币计算基数 */
export const PRESTIGE_BASE_SOULS = 1;

// ========== 颜色主题（地下城暗色调） ==========

export const COLORS = {
  bgGradient1: '#1A0A2E',
  bgGradient2: '#0D0520',
  groundLight: '#2D1B4E',
  groundDark: '#1A0A2E',
  skyTop: '#0D0520',
  skyBottom: '#1A0A2E',
  dungeonGlow: '#FF6F00',
  textPrimary: '#E8E0F0',
  textSecondary: '#B8A9D4',
  textDim: '#7B6B99',
  accent: '#FFB300',
  accentGreen: '#76FF03',
  accentRed: '#FF1744',
  accentBlue: '#40C4FF',
  accentPurple: '#CE93D8',
  panelBg: 'rgba(26, 10, 46, 0.9)',
  panelBorder: 'rgba(255, 179, 0, 0.3)',
  selectedBg: 'rgba(255, 179, 0, 0.15)',
  selectedBorder: 'rgba(255, 179, 0, 0.6)',
  affordable: '#76FF03',
  unaffordable: '#FF1744',
  shadow: 'rgba(0,0,0,0.3)',
  goldColor: '#FFD700',
  expColor: '#4FC3F7',
  gemColor: '#CE93D8',
  torchColor: '#FF9100',
  torchGlow: 'rgba(255, 145, 0, 0.2)',
} as const;

// ========== 渲染参数 ==========

export const HERO_DRAW = {
  centerX: 240,
  centerY: 200,
  bodyWidth: 30,
  bodyHeight: 40,
  headRadius: 14,
  eyeRadius: 3,
  swordLength: 30,
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
