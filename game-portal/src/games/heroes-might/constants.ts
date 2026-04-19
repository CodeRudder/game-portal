/**
 * 英雄无敌 (Heroes Might) — 放置类游戏常量定义
 *
 * 核心玩法：
 * - 点击获得金币 (gold)
 * - 建设城堡建筑，自动产出金币、宝石、魔法水晶
 * - 招募英雄，获得能力加成
 * - 魔法系统：消耗魔法水晶施放增益魔法
 * - 声望系统：重置进度获得荣耀勋章，提供永久加成
 * - 离线收益
 */

/** Canvas 尺寸 */
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ========== 资源 ID ==========

export const RESOURCE_IDS = {
  GOLD: 'gold',
  GEM: 'gem',
  CRYSTAL: 'crystal',
} as const;

// ========== 资源常量 ==========

/** 点击获得的金币数 */
export const GOLD_PER_CLICK = 1;

/** 声望加成系数（每荣耀勋章增加的产出倍率） */
export const HONOR_BONUS_MULTIPLIER = 0.12; // 12% per honor

/** 声望货币计算基数 */
export const PRESTIGE_BASE_HONOR = 1;

/** 声望所需最低金币总量 */
export const MIN_PRESTIGE_GOLD = 50000;

// ========== 建筑 ID ==========

export const BUILDING_IDS = {
  GOLD_MINE: 'gold_mine',
  LUMBER_MILL: 'lumber_mill',
  BARRACKS: 'barracks',
  ARCHER_TOWER: 'archer_tower',
  MAGIC_TOWER: 'magic_tower',
  GEM_MINE: 'gem_mine',
  CRYSTAL_CAVERN: 'crystal_cavern',
  DRAGON_LAIR: 'dragon_lair',
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
}

/** 建筑列表 */
export const BUILDINGS: BuildingDef[] = [
  {
    id: BUILDING_IDS.GOLD_MINE,
    name: '金矿',
    icon: '⛏️',
    baseCost: { gold: 15 },
    costMultiplier: 1.15,
    maxLevel: 50,
    productionResource: 'gold',
    baseProduction: 0.5,
  },
  {
    id: BUILDING_IDS.LUMBER_MILL,
    name: '伐木场',
    icon: '🪵',
    baseCost: { gold: 100 },
    costMultiplier: 1.18,
    maxLevel: 40,
    productionResource: 'gold',
    baseProduction: 3,
    requires: [BUILDING_IDS.GOLD_MINE],
  },
  {
    id: BUILDING_IDS.BARRACKS,
    name: '兵营',
    icon: '⚔️',
    baseCost: { gold: 500 },
    costMultiplier: 1.2,
    maxLevel: 30,
    productionResource: 'gold',
    baseProduction: 10,
    requires: [BUILDING_IDS.GOLD_MINE],
  },
  {
    id: BUILDING_IDS.ARCHER_TOWER,
    name: '箭塔',
    icon: '🏹',
    baseCost: { gold: 2000, gem: 5 },
    costMultiplier: 1.22,
    maxLevel: 25,
    productionResource: 'gold',
    baseProduction: 30,
    requires: [BUILDING_IDS.BARRACKS],
  },
  {
    id: BUILDING_IDS.MAGIC_TOWER,
    name: '魔法塔',
    icon: '🔮',
    baseCost: { gold: 8000, gem: 20 },
    costMultiplier: 1.25,
    maxLevel: 20,
    productionResource: 'crystal',
    baseProduction: 0.2,
    requires: [BUILDING_IDS.ARCHER_TOWER],
  },
  {
    id: BUILDING_IDS.GEM_MINE,
    name: '宝石矿',
    icon: '💎',
    baseCost: { gold: 5000 },
    costMultiplier: 1.2,
    maxLevel: 30,
    productionResource: 'gem',
    baseProduction: 0.3,
    requires: [BUILDING_IDS.LUMBER_MILL],
  },
  {
    id: BUILDING_IDS.CRYSTAL_CAVERN,
    name: '水晶洞',
    icon: '💠',
    baseCost: { gold: 15000, gem: 30 },
    costMultiplier: 1.25,
    maxLevel: 20,
    productionResource: 'crystal',
    baseProduction: 0.1,
    requires: [BUILDING_IDS.GEM_MINE, BUILDING_IDS.MAGIC_TOWER],
  },
  {
    id: BUILDING_IDS.DRAGON_LAIR,
    name: '龙巢',
    icon: '🐉',
    baseCost: { gold: 100000, gem: 100, crystal: 50 },
    costMultiplier: 1.3,
    maxLevel: 10,
    productionResource: 'gold',
    baseProduction: 200,
    requires: [BUILDING_IDS.CRYSTAL_CAVERN, BUILDING_IDS.ARCHER_TOWER],
  },
];

// ========== 英雄定义 ==========

export interface HeroDef {
  id: string;
  name: string;
  icon: string;
  /** 招募费用 */
  recruitCost: Record<string, number>;
  /** 能力类型 */
  bonusType: 'click' | 'production' | 'gem' | 'crystal' | 'all';
  /** 能力值（百分比加成，0.1 = 10%） */
  bonusValue: number;
  /** 描述 */
  description: string;
  /** 颜色（Canvas 绘制用） */
  color: string;
  /** 进化加成倍率 */
  evolutionMultiplier: number;
}

/** 英雄列表 */
export const HEROES: HeroDef[] = [
  {
    id: 'knight',
    name: '骑士',
    icon: '🗡️',
    recruitCost: { gold: 0 },
    bonusType: 'click',
    bonusValue: 0.1,
    description: '点击产金 +10%',
    color: '#78909C',
    evolutionMultiplier: 1.5,
  },
  {
    id: 'ranger',
    name: '游侠',
    icon: '🏹',
    recruitCost: { gold: 500 },
    bonusType: 'production',
    bonusValue: 0.15,
    description: '所有产出 +15%',
    color: '#4CAF50',
    evolutionMultiplier: 1.4,
  },
  {
    id: 'mage',
    name: '法师',
    icon: '🧙',
    recruitCost: { gold: 2000, gem: 10 },
    bonusType: 'crystal',
    bonusValue: 0.2,
    description: '水晶产出 +20%',
    color: '#7C4DFF',
    evolutionMultiplier: 1.6,
  },
  {
    id: 'paladin',
    name: '圣骑士',
    icon: '🛡️',
    recruitCost: { gold: 5000, gem: 20 },
    bonusType: 'all',
    bonusValue: 0.15,
    description: '所有加成 +15%',
    color: '#FFD600',
    evolutionMultiplier: 1.8,
  },
  {
    id: 'sorceress',
    name: '女巫',
    icon: '🔮',
    recruitCost: { gold: 15000, gem: 50, crystal: 10 },
    bonusType: 'gem',
    bonusValue: 0.25,
    description: '宝石产出 +25%',
    color: '#E040FB',
    evolutionMultiplier: 1.5,
  },
  {
    id: 'dragonlord',
    name: '龙骑士',
    icon: '🐲',
    recruitCost: { gold: 50000, gem: 100, crystal: 30 },
    bonusType: 'all',
    bonusValue: 0.3,
    description: '所有加成 +30%',
    color: '#FF6D00',
    evolutionMultiplier: 2.0,
  },
];

// ========== 魔法定义 ==========

export interface SpellDef {
  id: string;
  name: string;
  icon: string;
  /** 施法消耗 */
  cost: Record<string, number>;
  /** 效果类型 */
  effectType: 'multiply_production' | 'add_production' | 'multiply_click';
  /** 效果目标资源 */
  target: string;
  /** 效果值 */
  value: number;
  /** 持续时间（毫秒） */
  duration: number;
  /** 冷却时间（毫秒） */
  cooldown: number;
  /** 描述 */
  description: string;
}

/** 魔法列表 */
export const SPELLS: SpellDef[] = [
  {
    id: 'gold_rush',
    name: '淘金术',
    icon: '💰',
    cost: { crystal: 3 },
    effectType: 'multiply_production',
    target: 'gold',
    value: 3,
    duration: 10000,
    cooldown: 30000,
    description: '金币产出 x3 持续10秒',
  },
  {
    id: 'gem_blessing',
    name: '宝石祝福',
    icon: '✨',
    cost: { crystal: 5 },
    effectType: 'multiply_production',
    target: 'gem',
    value: 5,
    duration: 8000,
    cooldown: 45000,
    description: '宝石产出 x5 持续8秒',
  },
  {
    id: 'crystal_surge',
    name: '水晶涌动',
    icon: '💎',
    cost: { crystal: 8 },
    effectType: 'multiply_production',
    target: 'crystal',
    value: 4,
    duration: 12000,
    cooldown: 60000,
    description: '水晶产出 x4 持续12秒',
  },
  {
    id: 'click_frenzy',
    name: '狂暴点击',
    icon: '⚡',
    cost: { crystal: 2 },
    effectType: 'multiply_click',
    target: 'gold',
    value: 5,
    duration: 5000,
    cooldown: 20000,
    description: '点击产金 x5 持续5秒',
  },
];

// ========== 英雄进化费用表 ==========

export const EVOLUTION_COSTS: Record<number, Record<string, number>> = {
  1: { gem: 5, crystal: 2 },
  2: { gem: 25, crystal: 10 },
  3: { gem: 100, crystal: 40 },
  4: { gem: 400, crystal: 150 },
  5: { gem: 1500, crystal: 500 },
};

/** 最大进化等级 */
export const MAX_EVOLUTION_LEVEL = 5;

// ========== 颜色主题（奇幻中世纪风格：金色/紫色/蓝色） ==========

export const COLORS = {
  bgGradient1: '#1A0A2E',
  bgGradient2: '#0D0520',
  groundLight: '#2C1810',
  groundDark: '#1A0E08',
  skyTop: '#0D1B2A',
  skyBottom: '#1B2838',
  castleStone: '#5D4E37',
  castleRoof: '#8B0000',
  textPrimary: '#FFE4B5',
  textSecondary: '#C0A882',
  textDim: '#8B7355',
  accent: '#FFD700',
  accentGreen: '#76FF03',
  accentRed: '#FF1744',
  accentBlue: '#40C4FF',
  accentPurple: '#E040FB',
  panelBg: 'rgba(26, 10, 46, 0.9)',
  panelBorder: 'rgba(255, 215, 0, 0.3)',
  selectedBg: 'rgba(255, 215, 0, 0.15)',
  selectedBorder: 'rgba(255, 215, 0, 0.6)',
  affordable: '#76FF03',
  unaffordable: '#FF1744',
  goldColor: '#FFD700',
  gemColor: '#E040FB',
  crystalColor: '#40C4FF',
  heroShadow: 'rgba(0,0,0,0.3)',
  torchGlow: '#FF6F00',
  moonGlow: '#E8EAF6',
} as const;

// ========== 布局常量 ==========

export const CASTLE_DRAW = {
  centerX: 240,
  centerY: 280,
  width: 120,
  height: 100,
  towerWidth: 30,
  towerHeight: 60,
  gateWidth: 30,
  gateHeight: 40,
} as const;

export const RESOURCE_PANEL = {
  padding: 8,
  startY: 8,
  itemHeight: 22,
  itemPadding: 4,
} as const;

export const BUILDING_PANEL = {
  startY: 420,
  itemHeight: 44,
  itemPadding: 4,
  itemMarginX: 8,
  itemWidth: 464,
} as const;
