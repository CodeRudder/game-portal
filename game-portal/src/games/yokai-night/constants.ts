/**
 * 日本妖怪 (Yokai Night) — 放置类游戏常量定义
 *
 * 核心玩法：
 * - 点击收集灵力 (spirit)
 * - 建设妖怪村建筑，自动产出资源
 * - 收集不同妖怪，获得能力加成
 * - 妖怪进化升级系统
 * - 声望系统：重置进度获得御守，提供永久加成
 * - 离线收益
 */

/** Canvas 尺寸 */
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ========== 资源 ID ==========

export const RESOURCE_IDS = {
  SPIRIT: 'spirit',
  YOKAI_COIN: 'yokai_coin',
  OMAMORI: 'omamori',
} as const;

// ========== 资源常量 ==========

/** 点击获得的灵力数 */
export const SPIRIT_PER_CLICK = 1;

/** 声望加成系数（每御守增加的产出倍率） */
export const OMAMORI_BONUS_MULTIPLIER = 0.12; // 12% per omamori

/** 声望货币计算基数 */
export const PRESTIGE_BASE_OMAMORI = 1;

/** 声望所需最低灵力总量 */
export const MIN_PRESTIGE_SPIRIT = 50000;

// ========== 建筑 ID ==========

export const BUILDING_IDS = {
  TORII_GATE: 'torii_gate',
  SPIRIT_SHRINE: 'spirit_shrine',
  TEA_HOUSE: 'tea_house',
  YOKAI_MARKET: 'yokai_market',
  HOT_SPRINGS: 'hot_springs',
  SAKURA_GARDEN: 'sakura_garden',
  ONI_DOJO: 'oni_dojo',
  DRAGON_TEMPLE: 'dragon_temple',
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

/** 建筑列表 */
export const BUILDINGS: BuildingDef[] = [
  {
    id: 'torii_gate',
    name: '鸟居',
    icon: '⛩️',
    baseCost: { spirit: 15 },
    costMultiplier: 1.15,
    maxLevel: 50,
    productionResource: 'spirit',
    baseProduction: 0.5,
  },
  {
    id: 'spirit_shrine',
    name: '灵堂',
    icon: '🏯',
    baseCost: { spirit: 120 },
    costMultiplier: 1.18,
    maxLevel: 30,
    productionResource: 'yokai_coin',
    baseProduction: 0.3,
    requires: ['torii_gate'],
  },
  {
    id: 'tea_house',
    name: '茶屋',
    icon: '🍵',
    baseCost: { spirit: 600 },
    costMultiplier: 1.2,
    maxLevel: 30,
    productionResource: 'spirit',
    baseProduction: 5,
    requires: ['torii_gate'],
  },
  {
    id: 'yokai_market',
    name: '妖怪市集',
    icon: '🏮',
    baseCost: { spirit: 3000, yokai_coin: 20 },
    costMultiplier: 1.22,
    maxLevel: 20,
    productionResource: 'omamori',
    baseProduction: 0.1,
    requires: ['spirit_shrine', 'tea_house'],
  },
  {
    id: 'hot_springs',
    name: '温泉',
    icon: '♨️',
    baseCost: { spirit: 15000, yokai_coin: 100 },
    costMultiplier: 1.25,
    maxLevel: 15,
    productionResource: 'yokai_coin',
    baseProduction: 2,
    requires: ['spirit_shrine'],
  },
  {
    id: 'sakura_garden',
    name: '樱花庭园',
    icon: '🌸',
    baseCost: { spirit: 50000, yokai_coin: 300 },
    costMultiplier: 1.28,
    maxLevel: 15,
    productionResource: 'spirit',
    baseProduction: 25,
    requires: ['tea_house', 'hot_springs'],
  },
  {
    id: 'oni_dojo',
    name: '鬼道场',
    icon: '👹',
    baseCost: { spirit: 200000, yokai_coin: 800, omamori: 10 },
    costMultiplier: 1.3,
    maxLevel: 10,
    productionResource: 'omamori',
    baseProduction: 0.5,
    requires: ['yokai_market', 'sakura_garden'],
  },
  {
    id: 'dragon_temple',
    name: '龙神殿',
    icon: '🐉',
    baseCost: { spirit: 1000000, yokai_coin: 5000, omamori: 50 },
    costMultiplier: 1.35,
    maxLevel: 10,
    productionResource: 'omamori',
    baseProduction: 2,
    requires: ['oni_dojo'],
  },
];

// ========== 妖怪品种定义 ==========

export interface YokaiBreedDef {
  id: string;
  name: string;
  icon: string;
  /** 解锁所需灵力 */
  unlockCost: number;
  /** 能力类型 */
  bonusType: 'click' | 'production' | 'coin' | 'omamori' | 'all';
  /** 能力值（百分比加成，0.1 = 10%） */
  bonusValue: number;
  /** 描述 */
  description: string;
  /** 颜色（Canvas 绘制用） */
  color: string;
  /** 腹部颜色 */
  bellyColor: string;
  /** 进化加成倍率 */
  evolutionMultiplier: number;
}

/** 妖怪品种列表 */
export const YOKAI_BREEDS: YokaiBreedDef[] = [
  {
    id: 'kitsune',
    name: '狐火',
    icon: '🦊',
    unlockCost: 0,
    bonusType: 'click',
    bonusValue: 0.1,
    description: '点击灵力 +10%',
    color: '#FF8F00',
    bellyColor: '#FFE082',
    evolutionMultiplier: 1.5,
  },
  {
    id: 'tengu',
    name: '天狗',
    icon: '🦅',
    unlockCost: 800,
    bonusType: 'production',
    bonusValue: 0.15,
    description: '所有产出 +15%',
    color: '#5C6BC0',
    bellyColor: '#9FA8DA',
    evolutionMultiplier: 1.4,
  },
  {
    id: 'tanuki',
    name: '狸猫',
    icon: '🐾',
    unlockCost: 3000,
    bonusType: 'coin',
    bonusValue: 0.2,
    description: '妖怪币产出 +20%',
    color: '#8D6E63',
    bellyColor: '#D7CCC8',
    evolutionMultiplier: 1.6,
  },
  {
    id: 'kappa',
    name: '河童',
    icon: '🐸',
    unlockCost: 8000,
    bonusType: 'omamori',
    bonusValue: 0.2,
    description: '御守产出 +20%',
    color: '#2E7D32',
    bellyColor: '#81C784',
    evolutionMultiplier: 1.3,
  },
  {
    id: 'yurei',
    name: '幽灵',
    icon: '👻',
    unlockCost: 25000,
    bonusType: 'production',
    bonusValue: 0.3,
    description: '所有产出 +30%',
    color: '#B0BEC5',
    bellyColor: '#ECEFF1',
    evolutionMultiplier: 2.0,
  },
  {
    id: 'ryu',
    name: '龙神',
    icon: '🐲',
    unlockCost: 80000,
    bonusType: 'all',
    bonusValue: 0.25,
    description: '所有加成 +25%',
    color: '#C62828',
    bellyColor: '#EF9A9A',
    evolutionMultiplier: 1.8,
  },
];

// ========== 颜色主题（日本和风：靛蓝/朱红/金色） ==========

export const COLORS = {
  bgGradient1: '#1A1A2E',
  bgGradient2: '#0F0F1A',
  groundLight: '#2D2D44',
  groundDark: '#1A1A2E',
  skyTop: '#0D1B2A',
  skyBottom: '#1B2838',
  moonGlow: '#FFE0B2',
  textPrimary: '#FFF3E0',
  textSecondary: '#D1C4E9',
  textDim: '#7E57C2',
  accent: '#FF6F00',
  accentGold: '#FFD54F',
  accentRed: '#E53935',
  accentBlue: '#42A5F5',
  panelBg: 'rgba(26, 26, 46, 0.9)',
  panelBorder: 'rgba(255, 111, 0, 0.3)',
  selectedBg: 'rgba(255, 111, 0, 0.15)',
  selectedBorder: 'rgba(255, 111, 0, 0.6)',
  affordable: '#76FF03',
  unaffordable: '#FF1744',
  spiritColor: '#E1BEE7',
  coinColor: '#FFE082',
  omamoriColor: '#A5D6A7',
  lanternGlow: '#FF8F00',
  yokaiShadow: 'rgba(0,0,0,0.3)',
} as const;

// ========== 渲染参数 ==========

export const YOKAI_DRAW = {
  centerX: 240,
  centerY: 200,
  bodyWidth: 60,
  bodyHeight: 40,
  headRadius: 25,
  eyeRadius: 4,
  tailLength: 35,
  legHeight: 15,
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
