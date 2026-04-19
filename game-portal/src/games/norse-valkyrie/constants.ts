/**
 * 北欧英灵 (Norse Valkyrie) — 放置类游戏常量定义
 *
 * 核心玩法：
 * - 点击获得铁矿石 (iron)
 * - 建设北欧建筑（长船、英灵殿等），自动产出资源
 * - 招募英灵战士，获得战斗加成
 * - 卢恩符文系统，镶嵌符文获得永久增益
 * - 声望系统：荣耀重生，获得永久加成
 * - 离线收益
 */

/** Canvas 尺寸 */
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ========== 资源 ID ==========

export const RESOURCE_IDS = {
  IRON: 'iron',
  GLORY: 'glory',
  RUNE: 'rune',
} as const;

// ========== 资源常量 ==========

/** 点击获得的铁矿石数 */
export const IRON_PER_CLICK = 1;

/** 声望加成系数（每荣耀增加的产出倍率） */
export const GLORY_BONUS_MULTIPLIER = 0.15;

/** 声望货币计算基数 */
export const PRESTIGE_BASE_GLORY = 1;

/** 声望所需最低铁矿石总量 */
export const MIN_PRESTIGE_IRON = 50000;

// ========== 建筑 ID ==========

export const BUILDING_IDS = {
  MINING_PIT: 'mining_pit',
  LONGSHIP: 'longship',
  FORGE: 'forge',
  VALHALLA: 'valhalla',
  RUNE_SHRINE: 'rune_shrine',
  BARRACKS: 'barracks',
  TEMPLE: 'temple',
  YGGDRASIL: 'yggdrasil',
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
    id: 'mining_pit',
    name: '矿坑',
    icon: '⛏️',
    baseCost: { iron: 15 },
    costMultiplier: 1.15,
    maxLevel: 50,
    productionResource: 'iron',
    baseProduction: 0.5,
  },
  {
    id: 'longship',
    name: '长船',
    icon: '🚢',
    baseCost: { iron: 120 },
    costMultiplier: 1.18,
    maxLevel: 30,
    productionResource: 'glory',
    baseProduction: 0.3,
    requires: ['mining_pit'],
  },
  {
    id: 'forge',
    name: '锻造炉',
    icon: '🔥',
    baseCost: { iron: 600 },
    costMultiplier: 1.2,
    maxLevel: 30,
    productionResource: 'iron',
    baseProduction: 5,
    requires: ['mining_pit'],
  },
  {
    id: 'valhalla',
    name: '英灵殿',
    icon: '🏛️',
    baseCost: { iron: 3000, glory: 20 },
    costMultiplier: 1.22,
    maxLevel: 20,
    productionResource: 'rune',
    baseProduction: 0.1,
    requires: ['longship', 'forge'],
  },
  {
    id: 'rune_shrine',
    name: '符文祭坛',
    icon: '🔮',
    baseCost: { iron: 15000, glory: 100 },
    costMultiplier: 1.25,
    maxLevel: 15,
    productionResource: 'glory',
    baseProduction: 0.2,
    requires: ['longship'],
  },
  {
    id: 'barracks',
    name: '战士营房',
    icon: '⚔️',
    baseCost: { iron: 100000, rune: 30 },
    costMultiplier: 1.3,
    maxLevel: 10,
    productionResource: 'rune',
    baseProduction: 0.5,
    requires: ['valhalla', 'rune_shrine'],
  },
  {
    id: 'temple',
    name: '神殿',
    icon: '🌟',
    baseCost: { iron: 500000, glory: 500, rune: 50 },
    costMultiplier: 1.35,
    maxLevel: 10,
    productionResource: 'glory',
    baseProduction: 1.0,
    requires: ['barracks'],
  },
  {
    id: 'yggdrasil',
    name: '世界树',
    icon: '🌳',
    baseCost: { iron: 2000000, glory: 2000, rune: 200 },
    costMultiplier: 1.4,
    maxLevel: 5,
    productionResource: 'rune',
    baseProduction: 2.0,
    requires: ['temple'],
  },
];

// ========== 英灵战士定义 ==========

export interface EinherjarDef {
  id: string;
  name: string;
  icon: string;
  /** 解锁所需铁矿石 */
  unlockCost: number;
  /** 能力类型 */
  bonusType: 'click' | 'production' | 'glory' | 'rune' | 'all';
  /** 能力值（百分比加成，0.1 = 10%） */
  bonusValue: number;
  /** 描述 */
  description: string;
  /** 颜色（Canvas 绘制用） */
  color: string;
  /** 盾牌颜色 */
  shieldColor: string;
  /** 进化加成倍率 */
  evolutionMultiplier: number;
}

/** 英灵战士列表 */
export const EINHERJAR: EinherjarDef[] = [
  {
    id: 'berserker',
    name: '狂战士',
    icon: '🪓',
    unlockCost: 0,
    bonusType: 'click',
    bonusValue: 0.1,
    description: '点击产铁 +10%',
    color: '#8B4513',
    shieldColor: '#A0522D',
    evolutionMultiplier: 1.5,
  },
  {
    id: 'shieldmaiden',
    name: '盾女',
    icon: '🛡️',
    unlockCost: 800,
    bonusType: 'production',
    bonusValue: 0.15,
    description: '所有产出 +15%',
    color: '#4682B4',
    shieldColor: '#5F9EA0',
    evolutionMultiplier: 1.4,
  },
  {
    id: 'ranger',
    name: '游侠',
    icon: '🏹',
    unlockCost: 3000,
    bonusType: 'glory',
    bonusValue: 0.2,
    description: '荣耀产出 +20%',
    color: '#2E8B57',
    shieldColor: '#3CB371',
    evolutionMultiplier: 1.6,
  },
  {
    id: 'runecaster',
    name: '符文法师',
    icon: '🔮',
    unlockCost: 8000,
    bonusType: 'rune',
    bonusValue: 0.2,
    description: '卢恩产出 +20%',
    color: '#6A0DAD',
    shieldColor: '#8A2BE2',
    evolutionMultiplier: 1.3,
  },
  {
    id: 'jarl',
    name: '雅尔',
    icon: '👑',
    unlockCost: 25000,
    bonusType: 'production',
    bonusValue: 0.3,
    description: '所有产出 +30%',
    color: '#B8860B',
    shieldColor: '#DAA520',
    evolutionMultiplier: 2.0,
  },
  {
    id: 'valkyrie',
    name: '瓦尔基里',
    icon: '🦅',
    unlockCost: 80000,
    bonusType: 'all',
    bonusValue: 0.25,
    description: '所有加成 +25%',
    color: '#C0C0C0',
    shieldColor: '#E8E8E8',
    evolutionMultiplier: 1.8,
  },
];

// ========== 卢恩符文定义 ==========

export interface RuneDef {
  id: string;
  name: string;
  icon: string;
  /** 镶嵌费用（卢恩） */
  inscribeCost: number;
  /** 能力类型 */
  bonusType: 'click' | 'production' | 'glory' | 'rune' | 'all';
  /** 能力值 */
  bonusValue: number;
  /** 描述 */
  description: string;
  /** 颜色 */
  color: string;
}

/** 卢恩符文列表 */
export const RUNES: RuneDef[] = [
  {
    id: 'fehu',
    name: '费胡',
    icon: 'ᚠ',
    inscribeCost: 10,
    bonusType: 'click',
    bonusValue: 0.15,
    description: '点击产铁 +15%',
    color: '#FFD700',
  },
  {
    id: 'uruz',
    name: '乌鲁兹',
    icon: 'ᚢ',
    inscribeCost: 25,
    bonusType: 'production',
    bonusValue: 0.2,
    description: '所有产出 +20%',
    color: '#FF6347',
  },
  {
    id: 'thurisaz',
    name: '苏里萨兹',
    icon: 'ᚦ',
    inscribeCost: 50,
    bonusType: 'glory',
    bonusValue: 0.25,
    description: '荣耀产出 +25%',
    color: '#4169E1',
  },
  {
    id: 'ansuz',
    name: '安苏兹',
    icon: 'ᚨ',
    inscribeCost: 100,
    bonusType: 'rune',
    bonusValue: 0.3,
    description: '卢恩产出 +30%',
    color: '#9400D3',
  },
  {
    id: 'raidho',
    name: '莱多',
    icon: 'ᚱ',
    inscribeCost: 200,
    bonusType: 'all',
    bonusValue: 0.2,
    description: '所有加成 +20%',
    color: '#00CED1',
  },
  {
    id: 'kenaz',
    name: '凯纳兹',
    icon: 'ᚲ',
    inscribeCost: 500,
    bonusType: 'production',
    bonusValue: 0.35,
    description: '所有产出 +35%',
    color: '#FF4500',
  },
  {
    id: 'gebo',
    name: '盖博',
    icon: 'ᚷ',
    inscribeCost: 1000,
    bonusType: 'all',
    bonusValue: 0.3,
    description: '所有加成 +30%',
    color: '#32CD32',
  },
  {
    id: 'wunjo',
    name: '温究',
    icon: 'ᚹ',
    inscribeCost: 2500,
    bonusType: 'click',
    bonusValue: 0.5,
    description: '点击产铁 +50%',
    color: '#FF69B4',
  },
];

// ========== 颜色主题（北欧神话风格：深蓝/冰白/金色） ==========

export const COLORS = {
  bgGradient1: '#0D1B2A',
  bgGradient2: '#1B2838',
  groundLight: '#2C3E50',
  groundDark: '#1A252F',
  skyTop: '#0D1B2A',
  skyBottom: '#1B3A5C',
  auroraGreen: '#00FF7F',
  auroraBlue: '#00BFFF',
  textPrimary: '#E8E8E8',
  textSecondary: '#B0C4DE',
  textDim: '#708090',
  accent: '#FFD700',
  accentGreen: '#00FF7F',
  accentRed: '#FF4444',
  accentBlue: '#4FC3F7',
  panelBg: 'rgba(13, 27, 42, 0.9)',
  panelBorder: 'rgba(255, 215, 0, 0.3)',
  selectedBg: 'rgba(255, 215, 0, 0.15)',
  selectedBorder: 'rgba(255, 215, 0, 0.6)',
  affordable: '#00FF7F',
  unaffordable: '#FF4444',
  ironColor: '#B0B0B0',
  gloryColor: '#FFD700',
  runeColor: '#9400D3',
  snowColor: '#FFFFFF',
  fireColor: '#FF6600',
} as const;

// ========== 渲染参数 ==========

export const WARRIOR_DRAW = {
  centerX: 240,
  centerY: 200,
  bodyWidth: 50,
  bodyHeight: 45,
  headRadius: 18,
  shieldRadius: 15,
  swordLength: 35,
  legHeight: 15,
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
