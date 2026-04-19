/**
 * 埃及神话 (Egypt Myth) — 放置类游戏常量定义
 *
 * 核心玩法：
 * - 点击获得黄金 (gold)
 * - 建设金字塔、神庙等建筑，自动产出资源
 * - 解锁埃及神明庇护，获得能力加成
 * - 木乃伊系统：收集木乃伊碎片，召唤木乃伊获得永久加成
 * - 神明恩赐系统：定期获得神明赐予的奖励
 * - 声望系统：重置进度获得「神圣之力」，提供永久加成
 * - 离线收益
 */

/** Canvas 尺寸 */
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ========== 资源常量 ==========

/** 资源 ID 枚举 */
export const RESOURCE_IDS = {
  GOLD: 'gold',
  PAPYRUS: 'papyrus',
  DIVINE_POWER: 'divine_power',
} as const;

/** 点击获得的黄金数 */
export const GOLD_PER_CLICK = 1;

/** 声望加成系数（每点神圣之力增加的产出倍率） */
export const PRESTIGE_BONUS_MULTIPLIER = 0.15; // 15% per divine power

/** 声望货币计算基数 */
export const PRESTIGE_BASE_DIVINE = 1;

/** 声望所需最低黄金总量 */
export const MIN_PRESTIGE_GOLD = 50000;

// ========== 神明定义 ==========

export interface GodDef {
  id: string;
  name: string;
  icon: string;
  /** 解锁所需黄金 */
  unlockCost: number;
  /** 能力类型 */
  bonusType: 'click' | 'production' | 'papyrus' | 'divine_power' | 'all';
  /** 能力值（百分比加成，0.1 = 10%） */
  bonusValue: number;
  /** 描述 */
  description: string;
  /** 颜色（Canvas 绘制用） */
  color: string;
  /** 光环颜色 */
  auraColor: string;
  /** 进化/庇护加成倍率 */
  blessingMultiplier: number;
}

/** 神明列表 */
export const GODS: GodDef[] = [
  {
    id: 'ra',
    name: '拉神',
    icon: '☀️',
    unlockCost: 0,
    bonusType: 'click',
    bonusValue: 0.1,
    description: '太阳神庇护，点击产金 +10%',
    color: '#FFD600',
    auraColor: '#FFF176',
    blessingMultiplier: 1.5,
  },
  {
    id: 'isis',
    name: '伊西斯',
    icon: '🌿',
    unlockCost: 800,
    bonusType: 'production',
    bonusValue: 0.15,
    description: '生命女神庇护，所有产出 +15%',
    color: '#4CAF50',
    auraColor: '#A5D6A7',
    blessingMultiplier: 1.4,
  },
  {
    id: 'thoth',
    name: '托特',
    icon: '📜',
    unlockCost: 3000,
    bonusType: 'papyrus',
    bonusValue: 0.2,
    description: '智慧之神庇护，莎草纸产出 +20%',
    color: '#2196F3',
    auraColor: '#90CAF9',
    blessingMultiplier: 1.6,
  },
  {
    id: 'anubis',
    name: '阿努比斯',
    icon: '🐺',
    unlockCost: 8000,
    bonusType: 'divine_power',
    bonusValue: 0.2,
    description: '死神庇护，神圣之力产出 +20%',
    color: '#9C27B0',
    auraColor: '#CE93D8',
    blessingMultiplier: 1.3,
  },
  {
    id: 'horus',
    name: '荷鲁斯',
    icon: '🦅',
    unlockCost: 25000,
    bonusType: 'production',
    bonusValue: 0.3,
    description: '天空之神庇护，所有产出 +30%',
    color: '#FF9800',
    auraColor: '#FFE0B2',
    blessingMultiplier: 2.0,
  },
  {
    id: 'osiris',
    name: '欧西里斯',
    icon: '👑',
    unlockCost: 80000,
    bonusType: 'all',
    bonusValue: 0.25,
    description: '冥王庇护，所有加成 +25%',
    color: '#00BCD4',
    auraColor: '#80DEEA',
    blessingMultiplier: 1.8,
  },
];

// ========== 木乃伊定义 ==========

export interface MummyDef {
  id: string;
  name: string;
  icon: string;
  /** 召唤所需碎片 */
  fragments: number;
  /** 加成类型 */
  bonusType: 'click' | 'production' | 'all';
  /** 加成值 */
  bonusValue: number;
  /** 描述 */
  description: string;
  /** 颜色 */
  color: string;
}

/** 木乃伊列表 */
export const MUMMIES: MummyDef[] = [
  {
    id: 'common_mummy',
    name: '普通木乃伊',
    icon: '🧟',
    fragments: 10,
    bonusType: 'click',
    bonusValue: 0.05,
    description: '点击产金 +5%',
    color: '#8D6E63',
  },
  {
    id: 'royal_mummy',
    name: '法老木乃伊',
    icon: '🏛️',
    fragments: 50,
    bonusType: 'production',
    bonusValue: 0.1,
    description: '所有产出 +10%',
    color: '#FFD600',
  },
  {
    id: 'divine_mummy',
    name: '神圣木乃伊',
    icon: '✨',
    fragments: 200,
    bonusType: 'all',
    bonusValue: 0.15,
    description: '所有加成 +15%',
    color: '#E040FB',
  },
];

// ========== 建筑定义 ==========

/** 建筑 ID 枚举 */
export const BUILDING_IDS = {
  SAND_PIT: 'sand_pit',
  PYRAMID: 'pyramid',
  PAPYRUS_WORKSHOP: 'papyrus_workshop',
  TEMPLE: 'temple',
  OBELISK: 'obelisk',
  SPHINX: 'sphinx',
  SACRED_ALTAR: 'sacred_altar',
  DIVINE_STATUE: 'divine_statue',
} as const;

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
    id: 'sand_pit',
    name: '采砂场',
    icon: '🏜️',
    baseCost: { gold: 15 },
    costMultiplier: 1.15,
    maxLevel: 50,
    productionResource: 'gold',
    baseProduction: 0.5,
  },
  {
    id: 'pyramid',
    name: '金字塔',
    icon: '🔺',
    baseCost: { gold: 120 },
    costMultiplier: 1.18,
    maxLevel: 30,
    productionResource: 'papyrus',
    baseProduction: 0.3,
    requires: ['sand_pit'],
  },
  {
    id: 'papyrus_workshop',
    name: '莎草纸工坊',
    icon: '📜',
    baseCost: { gold: 600 },
    costMultiplier: 1.2,
    maxLevel: 30,
    productionResource: 'gold',
    baseProduction: 5,
    requires: ['sand_pit'],
  },
  {
    id: 'temple',
    name: '神庙',
    icon: '🏛️',
    baseCost: { gold: 3000, papyrus: 20 },
    costMultiplier: 1.22,
    maxLevel: 20,
    productionResource: 'divine_power',
    baseProduction: 0.1,
    requires: ['pyramid', 'papyrus_workshop'],
  },
  {
    id: 'obelisk',
    name: '方尖碑',
    icon: '🗿',
    baseCost: { gold: 15000, papyrus: 100 },
    costMultiplier: 1.25,
    maxLevel: 15,
    productionResource: 'papyrus',
    baseProduction: 0.2,
    requires: ['pyramid'],
  },
  {
    id: 'sphinx',
    name: '狮身人面像',
    icon: '🦁',
    baseCost: { gold: 50000, divine_power: 10 },
    costMultiplier: 1.28,
    maxLevel: 12,
    productionResource: 'gold',
    baseProduction: 20,
    requires: ['temple', 'obelisk'],
  },
  {
    id: 'sacred_altar',
    name: '神圣祭坛',
    icon: '🔥',
    baseCost: { gold: 200000, papyrus: 500, divine_power: 30 },
    costMultiplier: 1.3,
    maxLevel: 10,
    productionResource: 'divine_power',
    baseProduction: 0.5,
    requires: ['temple'],
  },
  {
    id: 'divine_statue',
    name: '神像殿堂',
    icon: '📿',
    baseCost: { gold: 1000000, divine_power: 100 },
    costMultiplier: 1.35,
    maxLevel: 8,
    productionResource: 'divine_power',
    baseProduction: 2,
    requires: ['sacred_altar', 'sphinx'],
  },
];

// ========== 颜色主题（古埃及金色/沙漠色调） ==========

export const COLORS = {
  bgGradient1: '#1A0F00',
  bgGradient2: '#0D0700',
  groundLight: '#D4A44C',
  groundDark: '#8B6914',
  skyTop: '#1A237E',
  skyBottom: '#4A148C',
  pyramidLight: '#FFD54F',
  pyramidDark: '#F9A825',
  textPrimary: '#FFF8E1',
  textSecondary: '#D7CCC8',
  textDim: '#8D6E63',
  accent: '#FFD600',
  accentGreen: '#76FF03',
  accentRed: '#FF1744',
  accentBlue: '#40C4FF',
  panelBg: 'rgba(26, 15, 0, 0.9)',
  panelBorder: 'rgba(255, 214, 0, 0.3)',
  selectedBg: 'rgba(255, 214, 0, 0.15)',
  selectedBorder: 'rgba(255, 214, 0, 0.6)',
  affordable: '#76FF03',
  unaffordable: '#FF1744',
  godShadow: 'rgba(0,0,0,0.3)',
  goldColor: '#FFD600',
  papyrusColor: '#A1887F',
  divineColor: '#E040FB',
  sandColor: '#D4A44C',
  starColor: '#FFF8E1',
} as const;

// ========== 渲染参数 ==========

export const GOD_DRAW = {
  centerX: 240,
  centerY: 200,
  bodyWidth: 50,
  bodyHeight: 45,
  headRadius: 22,
  eyeRadius: 4,
  crownHeight: 20,
  auraRadius: 60,
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
