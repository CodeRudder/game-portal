/**
 * 最终幻想 (Final Fantasy) — 放置类游戏常量定义
 *
 * 核心玩法：
 * - 点击获得金币 (gold)
 * - 建设奇幻世界建筑，自动产出金币/经验/魔力
 * - 招募伙伴（职业系统：战士/法师/盗贼/牧师/龙骑士/召唤师）
 * - 召唤兽系统（伊弗利特/湿婆/巴哈姆特/奥丁/亚历山大）
 * - 声望系统：转生重置进度获得水晶，提供永久加成
 * - 离线收益
 */

/** Canvas 尺寸 */
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ========== 资源 ID ==========

export const RESOURCE_IDS = {
  GOLD: 'gold',
  EXP: 'exp',
  MANA: 'mana',
} as const;

// ========== 建筑 ID ==========

export const BUILDING_IDS = {
  TAVERN: 'tavern',
  TRAINING_GROUND: 'training_ground',
  MAGIC_TOWER: 'magic_tower',
  BLACKSMITH: 'blacksmith',
  ARENA: 'arena',
  SUMMONING_SHRINE: 'summoning_shrine',
  CRYSTAL_MINE: 'crystal_mine',
  CASTLE: 'castle',
} as const;

// ========== 资源常量 ==========

/** 点击获得的金币数 */
export const GOLD_PER_CLICK = 1;

/** 声望加成系数（每水晶增加的产出倍率） */
export const CRYSTAL_BONUS_MULTIPLIER = 0.15;

/** 声望货币计算基数 */
export const PRESTIGE_BASE_CRYSTALS = 1;

/** 声望所需最低金币总量 */
export const MIN_PRESTIGE_GOLD = 50000;

// ========== 职业定义 ==========

export interface JobDef {
  id: string;
  name: string;
  icon: string;
  /** 解锁所需金币 */
  unlockCost: number;
  /** 能力类型 */
  bonusType: 'click' | 'gold_production' | 'exp_production' | 'mana_production' | 'all';
  /** 能力值（百分比加成，0.1 = 10%） */
  bonusValue: number;
  /** 描述 */
  description: string;
  /** 颜色（Canvas 绘制用） */
  color: string;
  /** 进化加成倍率 */
  promotionMultiplier: number;
}

/** 职业列表 */
export const JOBS: JobDef[] = [
  {
    id: 'warrior',
    name: '战士',
    icon: '⚔️',
    unlockCost: 0,
    bonusType: 'click',
    bonusValue: 0.1,
    description: '点击产金 +10%',
    color: '#C62828',
    promotionMultiplier: 1.5,
  },
  {
    id: 'mage',
    name: '法师',
    icon: '🔮',
    unlockCost: 500,
    bonusType: 'mana_production',
    bonusValue: 0.2,
    description: '魔力产出 +20%',
    color: '#1565C0',
    promotionMultiplier: 1.6,
  },
  {
    id: 'thief',
    name: '盗贼',
    icon: '🗡️',
    unlockCost: 2000,
    bonusType: 'click',
    bonusValue: 0.25,
    description: '点击产金 +25%',
    color: '#4E342E',
    promotionMultiplier: 1.4,
  },
  {
    id: 'cleric',
    name: '牧师',
    icon: '✨',
    unlockCost: 8000,
    bonusType: 'exp_production',
    bonusValue: 0.2,
    description: '经验产出 +20%',
    color: '#F9A825',
    promotionMultiplier: 1.5,
  },
  {
    id: 'dragoon',
    name: '龙骑士',
    icon: '🐉',
    unlockCost: 30000,
    bonusType: 'gold_production',
    bonusValue: 0.3,
    description: '金币产出 +30%',
    color: '#2E7D32',
    promotionMultiplier: 1.8,
  },
  {
    id: 'summoner',
    name: '召唤师',
    icon: '🌟',
    unlockCost: 100000,
    bonusType: 'all',
    bonusValue: 0.25,
    description: '所有加成 +25%',
    color: '#6A1B9A',
    promotionMultiplier: 2.0,
  },
];

// ========== 召唤兽定义 ==========

export interface SummonDef {
  id: string;
  name: string;
  icon: string;
  /** 解锁所需魔力 */
  unlockCost: number;
  /** 加成倍率 */
  bonusMultiplier: number;
  /** 加成目标 */
  bonusTarget: 'gold' | 'exp' | 'mana' | 'all';
  /** 描述 */
  description: string;
  /** 颜色 */
  color: string;
  /** 光环颜色 */
  auraColor: string;
}

/** 召唤兽列表 */
export const SUMMONS: SummonDef[] = [
  {
    id: 'ifrit',
    name: '伊弗利特',
    icon: '🔥',
    unlockCost: 50,
    bonusMultiplier: 1.5,
    bonusTarget: 'gold',
    description: '金币产出 ×1.5',
    color: '#FF6F00',
    auraColor: 'rgba(255, 111, 0, 0.3)',
  },
  {
    id: 'shiva',
    name: '湿婆',
    icon: '❄️',
    unlockCost: 200,
    bonusMultiplier: 1.5,
    bonusTarget: 'mana',
    description: '魔力产出 ×1.5',
    color: '#4FC3F7',
    auraColor: 'rgba(79, 195, 247, 0.3)',
  },
  {
    id: 'bahamut',
    name: '巴哈姆特',
    icon: '🐲',
    unlockCost: 1000,
    bonusMultiplier: 2.0,
    bonusTarget: 'all',
    description: '所有产出 ×2.0',
    color: '#7C4DFF',
    auraColor: 'rgba(124, 77, 255, 0.3)',
  },
  {
    id: 'odin',
    name: '奥丁',
    icon: '⚡',
    unlockCost: 5000,
    bonusMultiplier: 2.5,
    bonusTarget: 'gold',
    description: '金币产出 ×2.5',
    color: '#90A4AE',
    auraColor: 'rgba(144, 164, 174, 0.3)',
  },
  {
    id: 'alexander',
    name: '亚历山大',
    icon: '🛡️',
    unlockCost: 20000,
    bonusMultiplier: 3.0,
    bonusTarget: 'all',
    description: '所有产出 ×3.0',
    color: '#FFD600',
    auraColor: 'rgba(255, 214, 0, 0.3)',
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
    id: 'tavern',
    name: '酒馆',
    icon: '🍺',
    baseCost: { gold: 15 },
    costMultiplier: 1.15,
    maxLevel: 50,
    productionResource: 'gold',
    baseProduction: 0.5,
  },
  {
    id: 'training_ground',
    name: '训练场',
    icon: '⚔️',
    baseCost: { gold: 100 },
    costMultiplier: 1.18,
    maxLevel: 30,
    productionResource: 'exp',
    baseProduction: 0.3,
    requires: ['tavern'],
  },
  {
    id: 'magic_tower',
    name: '魔法塔',
    icon: '🔮',
    baseCost: { gold: 500 },
    costMultiplier: 1.2,
    maxLevel: 30,
    productionResource: 'mana',
    baseProduction: 0.2,
    requires: ['tavern'],
  },
  {
    id: 'blacksmith',
    name: '铁匠铺',
    icon: '🔨',
    baseCost: { gold: 2000 },
    costMultiplier: 1.2,
    maxLevel: 30,
    productionResource: 'gold',
    baseProduction: 4,
    requires: ['tavern'],
  },
  {
    id: 'arena',
    name: '斗技场',
    icon: '🏟️',
    baseCost: { gold: 8000, exp: 50 },
    costMultiplier: 1.22,
    maxLevel: 20,
    productionResource: 'exp',
    baseProduction: 1.0,
    requires: ['training_ground', 'blacksmith'],
  },
  {
    id: 'summoning_shrine',
    name: '召唤殿',
    icon: '🌀',
    baseCost: { gold: 15000, mana: 30 },
    costMultiplier: 1.25,
    maxLevel: 15,
    productionResource: 'mana',
    baseProduction: 0.8,
    requires: ['magic_tower'],
  },
  {
    id: 'crystal_mine',
    name: '水晶矿',
    icon: '💎',
    baseCost: { gold: 50000, exp: 200, mana: 100 },
    costMultiplier: 1.3,
    maxLevel: 10,
    productionResource: 'gold',
    baseProduction: 20,
    requires: ['arena', 'summoning_shrine'],
  },
  {
    id: 'castle',
    name: '城堡',
    icon: '🏰',
    baseCost: { gold: 200000, exp: 500, mana: 300 },
    costMultiplier: 1.35,
    maxLevel: 10,
    productionResource: 'gold',
    baseProduction: 50,
    requires: ['crystal_mine'],
  },
];

// ========== 进阶费用表（按进阶等级） ==========

export const PROMOTION_COSTS: Record<number, Record<string, number>> = {
  1: { exp: 10, mana: 5 },
  2: { exp: 50, mana: 20 },
  3: { exp: 200, mana: 80 },
  4: { exp: 800, mana: 300 },
  5: { exp: 3000, mana: 1000 },
};

/** 最大进阶等级 */
export const MAX_PROMOTION_LEVEL = 5;

// ========== 颜色主题（奇幻风格：深蓝/金色/紫色） ==========

export const COLORS = {
  bgGradient1: '#0D1B2A',
  bgGradient2: '#1B2838',
  groundLight: '#2C3E50',
  groundDark: '#1A252F',
  skyTop: '#0D1B2A',
  skyBottom: '#1B3A5C',
  textPrimary: '#F5E6CC',
  textSecondary: '#BDC3C7',
  textDim: '#7F8C8D',
  accent: '#F1C40F',
  accentGreen: '#2ECC71',
  accentRed: '#E74C3C',
  accentBlue: '#3498DB',
  panelBg: 'rgba(13, 27, 42, 0.9)',
  panelBorder: 'rgba(241, 196, 15, 0.3)',
  selectedBg: 'rgba(241, 196, 15, 0.15)',
  selectedBorder: 'rgba(241, 196, 15, 0.6)',
  affordable: '#2ECC71',
  unaffordable: '#E74C3C',
  goldColor: '#F1C40F',
  expColor: '#2ECC71',
  manaColor: '#9B59B6',
  crystalColor: '#00BCD4',
  starColor: '#F1C40F',
  characterShadow: 'rgba(0,0,0,0.3)',
} as const;

// ========== 渲染参数 ==========

export const CHARACTER_DRAW = {
  centerX: 240,
  centerY: 200,
  bodyWidth: 40,
  bodyHeight: 50,
  headRadius: 18,
  eyeRadius: 3,
  swordLength: 30,
  staffLength: 35,
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
