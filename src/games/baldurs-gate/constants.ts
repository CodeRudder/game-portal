/**
 * 博德之门 (Baldur's Gate) — 放置类游戏常量定义
 *
 * 核心玩法：
 * - 点击获得金币 (gold)
 * - 建设费伦大陆建筑，自动产出资源
 * - 招募队友，获得能力加成
 * - 地下城探索系统，获取魔法物品和经验
 * - 队友升级与装备系统
 * - 声望系统：重置进度获得命运点数，提供永久加成
 * - 离线收益
 */

/** Canvas 尺寸 */
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ========== 资源常量 ==========

/** 点击获得的金币数 */
export const GOLD_PER_CLICK = 1;

/** 声望加成系数（每命运点数增加的产出倍率） */
export const PRESTIGE_BONUS_MULTIPLIER = 0.15;

/** 声望货币计算基数 */
export const PRESTIGE_BASE_FATE = 1;

/** 声望所需最低金币总量 */
export const MIN_PRESTIGE_GOLD = 50000;

// ========== 资源 ID ==========

export const RESOURCE_IDS = {
  GOLD: 'gold',
  XP: 'xp',
  MAGIC_ITEM: 'magic_item',
} as const;

/** 建筑ID */
export const BUILDING_IDS = {
  TAVERN: 'tavern',
  BLACKSMITH: 'blacksmith',
  ALCHEMIST_SHOP: 'alchemist_shop',
  MERCHANT_GUILD: 'merchant_guild',
  ADVENTURE_GUILD: 'adventure_guild',
  MAGIC_TOWER: 'magic_tower',
  TEMPLE: 'temple',
  UNDERGROUND_DUNGEON: 'underground_dungeon',
} as const;

// ========== 队友定义 ==========

export interface CompanionDef {
  id: string;
  name: string;
  icon: string;
  /** 解锁所需金币 */
  unlockCost: number;
  /** 能力类型 */
  bonusType: 'click' | 'gold_production' | 'xp_production' | 'magic_item_production' | 'all';
  /** 能力值（百分比加成，0.1 = 10%） */
  bonusValue: number;
  /** 描述 */
  description: string;
  /** 颜色（Canvas 绘制用） */
  color: string;
  /** 升级加成倍率 */
  upgradeMultiplier: number;
  /** 职业描述 */
  className: string;
}

/** 队友列表 */
export const COMPANIONS: CompanionDef[] = [
  {
    id: 'shadowheart',
    name: '影心',
    icon: '🌙',
    unlockCost: 0,
    bonusType: 'click',
    bonusValue: 0.1,
    description: '点击产金 +10%',
    color: '#7B1FA2',
    upgradeMultiplier: 1.5,
    className: '牧师',
  },
  {
    id: 'gale',
    name: '盖尔',
    icon: '📖',
    unlockCost: 800,
    bonusType: 'xp_production',
    bonusValue: 0.15,
    description: '经验产出 +15%',
    color: '#1565C0',
    upgradeMultiplier: 1.4,
    className: '法师',
  },
  {
    id: 'astarion',
    name: '阿斯代伦',
    icon: '🗡️',
    unlockCost: 3000,
    bonusType: 'magic_item_production',
    bonusValue: 0.2,
    description: '魔法物品产出 +20%',
    color: '#B71C1C',
    upgradeMultiplier: 1.6,
    className: '游荡者',
  },
  {
    id: 'laezel',
    name: '莱泽尔',
    icon: '⚔️',
    unlockCost: 8000,
    bonusType: 'gold_production',
    bonusValue: 0.2,
    description: '金币产出 +20%',
    color: '#E65100',
    upgradeMultiplier: 1.3,
    className: '战士',
  },
  {
    id: 'wyll',
    name: '威尔',
    icon: '🔥',
    unlockCost: 25000,
    bonusType: 'gold_production',
    bonusValue: 0.3,
    description: '金币产出 +30%',
    color: '#C62828',
    upgradeMultiplier: 2.0,
    className: '邪术师',
  },
  {
    id: 'karlach',
    name: '卡拉克',
    icon: '🪓',
    unlockCost: 80000,
    bonusType: 'all',
    bonusValue: 0.25,
    description: '所有加成 +25%',
    color: '#D84315',
    upgradeMultiplier: 1.8,
    className: '野蛮人',
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
    id: 'blacksmith',
    name: '铁匠铺',
    icon: '🔨',
    baseCost: { gold: 120 },
    costMultiplier: 1.18,
    maxLevel: 30,
    productionResource: 'gold',
    baseProduction: 2,
    requires: ['tavern'],
  },
  {
    id: 'alchemist_shop',
    name: '炼金店',
    icon: '⚗️',
    baseCost: { gold: 600 },
    costMultiplier: 1.2,
    maxLevel: 30,
    productionResource: 'xp',
    baseProduction: 0.3,
    requires: ['tavern'],
  },
  {
    id: 'merchant_guild',
    name: '商会',
    icon: '💰',
    baseCost: { gold: 3000, xp: 20 },
    costMultiplier: 1.22,
    maxLevel: 20,
    productionResource: 'gold',
    baseProduction: 8,
    requires: ['blacksmith', 'alchemist_shop'],
  },
  {
    id: 'adventure_guild',
    name: '冒险公会',
    icon: '⚔️',
    baseCost: { gold: 15000, xp: 100 },
    costMultiplier: 1.25,
    maxLevel: 15,
    productionResource: 'xp',
    baseProduction: 1.5,
    requires: ['alchemist_shop'],
  },
  {
    id: 'magic_tower',
    name: '魔法塔',
    icon: '🔮',
    baseCost: { gold: 50000, xp: 200, magic_item: 10 },
    costMultiplier: 1.28,
    maxLevel: 12,
    productionResource: 'magic_item',
    baseProduction: 0.1,
    requires: ['merchant_guild', 'adventure_guild'],
  },
  {
    id: 'temple',
    name: '神殿',
    icon: '⛪',
    baseCost: { gold: 100000, magic_item: 30 },
    costMultiplier: 1.3,
    maxLevel: 10,
    productionResource: 'xp',
    baseProduction: 5,
    requires: ['adventure_guild'],
  },
  {
    id: 'underground_dungeon',
    name: '地下城',
    icon: '🏰',
    baseCost: { gold: 500000, xp: 500, magic_item: 50 },
    costMultiplier: 1.35,
    maxLevel: 8,
    productionResource: 'magic_item',
    baseProduction: 0.5,
    requires: ['magic_tower', 'temple'],
  },
];

// ========== 地下城定义 ==========

export interface DungeonDef {
  id: string;
  name: string;
  icon: string;
  /** 探索所需时间（毫秒） */
  exploreTime: number;
  /** 奖励金币 */
  goldReward: number;
  /** 奖励经验 */
  xpReward: number;
  /** 奖励魔法物品 */
  magicItemReward: number;
  /** 解锁所需队友数量 */
  requiredCompanions: number;
  /** 描述 */
  description: string;
}

/** 地下城列表 */
export const DUNGEONS: DungeonDef[] = [
  {
    id: 'goblin_cave',
    name: '哥布林洞穴',
    icon: '🕳️',
    exploreTime: 5000,
    goldReward: 50,
    xpReward: 20,
    magicItemReward: 0,
    requiredCompanions: 1,
    description: '一个充满哥布林的阴暗洞穴',
  },
  {
    id: 'undead_crypt',
    name: '亡灵墓穴',
    icon: '💀',
    exploreTime: 10000,
    goldReward: 200,
    xpReward: 100,
    magicItemReward: 1,
    requiredCompanions: 2,
    description: '古老的墓穴中回荡着低语',
  },
  {
    id: 'mind_flayer_lair',
    name: '夺心魔巢穴',
    icon: '🧠',
    exploreTime: 20000,
    goldReward: 1000,
    xpReward: 500,
    magicItemReward: 3,
    requiredCompanions: 3,
    description: '幽暗的地底深处，夺心魔在等待',
  },
  {
    id: 'dragon_lair',
    name: '巨龙巢穴',
    icon: '🐉',
    exploreTime: 40000,
    goldReward: 5000,
    xpReward: 2000,
    magicItemReward: 8,
    requiredCompanions: 4,
    description: '巨龙的宝藏无人敢觊觎',
  },
  {
    id: 'bhaals_temple',
    name: '巴尔神殿',
    icon: '🗡️',
    exploreTime: 60000,
    goldReward: 20000,
    xpReward: 10000,
    magicItemReward: 20,
    requiredCompanions: 5,
    description: '谋杀之神的殿堂，终极试炼',
  },
];

// ========== 队友升级费用表 ==========

export const COMPANION_UPGRADE_COSTS: Record<number, Record<string, number>> = {
  1: { xp: 10, magic_item: 2 },
  2: { xp: 50, magic_item: 8 },
  3: { xp: 200, magic_item: 25 },
  4: { xp: 800, magic_item: 60 },
  5: { xp: 3000, magic_item: 150 },
};

/** 最大升级等级 */
export const MAX_COMPANION_LEVEL = 5;

// ========== 颜色主题（暗黑奇幻风格：紫/金/暗红） ==========

export const COLORS = {
  bgGradient1: '#1A0A2E',
  bgGradient2: '#0D0520',
  groundLight: '#2D1B4E',
  groundDark: '#1A0A2E',
  skyTop: '#0D0520',
  skyBottom: '#1A0A2E',
  portalGlow: '#FFD700',
  textPrimary: '#FFF8E1',
  textSecondary: '#D7CCC8',
  textDim: '#8D6E63',
  accent: '#FFD700',
  accentGreen: '#76FF03',
  accentRed: '#FF1744',
  accentBlue: '#40C4FF',
  accentPurple: '#CE93D8',
  panelBg: 'rgba(26, 10, 46, 0.9)',
  panelBorder: 'rgba(255, 215, 0, 0.3)',
  selectedBg: 'rgba(255, 215, 0, 0.15)',
  selectedBorder: 'rgba(255, 215, 0, 0.6)',
  affordable: '#76FF03',
  unaffordable: '#FF1744',
  companionShadow: 'rgba(0,0,0,0.3)',
  goldColor: '#FFD700',
  xpColor: '#7C4DFF',
  magicItemColor: '#00E5FF',
  portalColor: '#FFD700',
  torchColor: '#FF9800',
  fogColor: 'rgba(138, 43, 226, 0.1)',
} as const;

// ========== 渲染参数 ==========

export const HERO_DRAW = {
  centerX: 240,
  centerY: 200,
  bodyWidth: 40,
  bodyHeight: 50,
  headRadius: 18,
  eyeRadius: 3,
  swordLength: 30,
  capeLength: 25,
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
