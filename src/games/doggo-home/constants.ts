/**
 * 狗狗家园 (Doggo Home) — 放置类游戏常量定义
 *
 * 核心玩法：
 * - 点击获得骨头饼干 (treats)
 * - 建设牧场建筑，自动产出资源
 * - 解锁不同品种狗狗，获得能力加成
 * - 参加比赛获得奖牌
 * - 声望系统：重置进度获得星星，提供永久加成
 */

/** Canvas 尺寸 */
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ========== 资源常量 ==========

/** 点击获得的饼干数 */
export const TREATS_PER_CLICK = 1;

/** 声望加成系数（每颗星星增加的产出倍率） */
export const STAR_BONUS_MULTIPLIER = 0.1; // 10% per star

/** 声望货币计算基数 */
export const PRESTIGE_BASE_STARS = 1;

/** 声望所需最低 treats 总量 */
export const PRESTIGE_MIN_TOTAL_TREATS = 1000;

// ========== 狗狗品种定义 ==========

export interface DogBreedDef {
  id: string;
  name: string;
  icon: string;
  /** 解锁所需 treats */
  unlockCost: number;
  /** 能力类型 */
  bonusType: 'click' | 'production' | 'love' | 'medal' | 'star' | 'all';
  /** 能力值（百分比加成，0.1 = 10%） */
  bonusValue: number;
  /** 描述 */
  description: string;
  /** 颜色（Canvas 绘制用） */
  color: string;
  /** 耳朵颜色 */
  earColor: string;
}

/** 狗狗品种列表 */
export const DOG_BREEDS: DogBreedDef[] = [
  {
    id: 'shiba',
    name: '柴犬',
    icon: '🐕',
    unlockCost: 0,
    bonusType: 'click',
    bonusValue: 0.1,
    description: '点击饼干 +10%',
    color: '#E8A94E',
    earColor: '#C48530',
  },
  {
    id: 'golden',
    name: '金毛',
    icon: '🦮',
    unlockCost: 500,
    bonusType: 'production',
    bonusValue: 0.15,
    description: '所有产出 +15%',
    color: '#D4A44C',
    earColor: '#B08530',
  },
  {
    id: 'husky',
    name: '哈士奇',
    icon: '🐺',
    unlockCost: 2000,
    bonusType: 'medal',
    bonusValue: 0.2,
    description: '比赛奖牌 +20%',
    color: '#8BA4B8',
    earColor: '#6B8498',
  },
  {
    id: 'corgi',
    name: '柯基',
    icon: '🐶',
    unlockCost: 5000,
    bonusType: 'love',
    bonusValue: 0.2,
    description: '爱心产出 +20%',
    color: '#E8A94E',
    earColor: '#FFFFFF',
  },
  {
    id: 'labrador',
    name: '拉布拉多',
    icon: '🐕‍🦺',
    unlockCost: 15000,
    bonusType: 'production',
    bonusValue: 0.25,
    description: '所有产出 +25%',
    color: '#C4A050',
    earColor: '#A08030',
  },
  {
    id: 'border_collie',
    name: '边牧',
    icon: '🐕',
    unlockCost: 50000,
    bonusType: 'click',
    bonusValue: 0.3,
    description: '点击饼干 +30%',
    color: '#2C2C2C',
    earColor: '#FFFFFF',
  },
  {
    id: 'samoyed',
    name: '萨摩耶',
    icon: '🐩',
    unlockCost: 150000,
    bonusType: 'love',
    bonusValue: 0.3,
    description: '爱心产出 +30%',
    color: '#F5F0E8',
    earColor: '#E8E0D0',
  },
  {
    id: 'german_shepherd',
    name: '德牧',
    icon: '🐕',
    unlockCost: 500000,
    bonusType: 'all',
    bonusValue: 0.2,
    description: '所有加成 +20%',
    color: '#5A4030',
    earColor: '#3A2520',
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
    id: 'kennel',
    name: '狗窝',
    icon: '🏠',
    baseCost: { treats: 10 },
    costMultiplier: 1.15,
    maxLevel: 50,
    productionResource: 'treats',
    baseProduction: 0.5,
  },
  {
    id: 'training_ground',
    name: '训练场',
    icon: '🎯',
    baseCost: { treats: 100 },
    costMultiplier: 1.18,
    maxLevel: 30,
    productionResource: 'treats',
    baseProduction: 2,
    requires: ['kennel'],
  },
  {
    id: 'treat_factory',
    name: '零食工厂',
    icon: '🏭',
    baseCost: { treats: 500 },
    costMultiplier: 1.2,
    maxLevel: 30,
    productionResource: 'treats',
    baseProduction: 8,
    requires: ['kennel'],
  },
  {
    id: 'garden',
    name: '牧场花园',
    icon: '🌸',
    baseCost: { treats: 2000, love: 10 },
    costMultiplier: 1.22,
    maxLevel: 20,
    productionResource: 'love',
    baseProduction: 0.5,
    requires: ['kennel', 'training_ground'],
  },
  {
    id: 'arena',
    name: '比赛场地',
    icon: '🏟️',
    baseCost: { treats: 10000, love: 50 },
    costMultiplier: 1.25,
    maxLevel: 15,
    productionResource: 'medals',
    baseProduction: 0.2,
    requires: ['training_ground', 'garden'],
  },
  {
    id: 'paradise',
    name: '狗狗乐园',
    icon: '🎡',
    baseCost: { treats: 100000, medals: 20 },
    costMultiplier: 1.3,
    maxLevel: 10,
    productionResource: 'stars',
    baseProduction: 0.01,
    requires: ['arena'],
  },
];

// ========== 颜色主题 ==========

export const COLORS = {
  bgGradient1: '#2D5016',
  bgGradient2: '#1A3A0A',
  grassLight: '#4CAF50',
  grassDark: '#388E3C',
  skyTop: '#87CEEB',
  skyBottom: '#B8E6FF',
  textPrimary: '#FFFFFF',
  textSecondary: '#D0E8C0',
  textDim: '#80A060',
  accent: '#FFD700',
  accentGreen: '#00E676',
  accentPink: '#FF69B4',
  accentBlue: '#42A5F5',
  panelBg: 'rgba(30, 50, 10, 0.85)',
  panelBorder: 'rgba(100, 200, 50, 0.3)',
  selectedBg: 'rgba(100, 200, 50, 0.15)',
  selectedBorder: 'rgba(100, 200, 50, 0.6)',
  affordable: '#00E676',
  unaffordable: '#FF4757',
  dogShadow: 'rgba(0,0,0,0.2)',
  treatColor: '#F5DEB3',
  treatDark: '#D2B48C',
  loveColor: '#FF69B4',
  medalColor: '#FFD700',
  starColor: '#FFD700',
} as const;

// ========== 渲染参数 ==========

export const DOG_DRAW = {
  centerX: 240,
  centerY: 220,
  bodyRadius: 50,
  headRadius: 35,
  earWidth: 15,
  earHeight: 25,
  eyeRadius: 5,
  noseRadius: 6,
  tailLength: 30,
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
