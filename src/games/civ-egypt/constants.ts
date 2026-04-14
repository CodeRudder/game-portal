/**
 * 四大文明·古埃及 (Civ Egypt) — 放置类游戏常量定义
 *
 * 核心玩法：
 * - 玩家扮演法老，建设金字塔、神庙、尼罗河灌溉系统
 * - 积累「粮食」「黄金」「信仰」三种资源
 * - 法老威望系统和时代演进
 * - 声望系统：重置进度获得「太阳神赐福」，提供永久加成
 * - 离线收益
 */

/** Canvas 尺寸 */
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ========== 资源常量 ==========

export const RESOURCE_IDS = {
  FOOD: 'food',
  GOLD: 'gold',
  FAITH: 'faith',
} as const;

/** 点击获得的粮食数 */
export const FOOD_PER_CLICK = 1;

/** 声望加成系数（每太阳神赐福增加的产出倍率） */
export const PRESTIGE_BONUS_MULTIPLIER = 0.12; // 12% per blessing

/** 声望货币计算基数 */
export const PRESTIGE_BASE_BLESSINGS = 1;

/** 声望所需最低粮食总量 */
export const MIN_PRESTIGE_FOOD = 5000;

// ========== 时代定义 ==========

export interface EraDef {
  id: string;
  name: string;
  icon: string;
  /** 解锁所需法老威望 */
  requiredPrestige: number;
  /** 产出倍率 */
  productionMultiplier: number;
  /** 描述 */
  description: string;
  /** 背景天空色 */
  skyTop: string;
  skyBottom: string;
}

export const ERAS: EraDef[] = [
  {
    id: 'predynastic',
    name: '前王朝时代',
    icon: '🏺',
    requiredPrestige: 0,
    productionMultiplier: 1.0,
    description: '尼罗河畔的早期聚落',
    skyTop: '#1A237E',
    skyBottom: '#E65100',
  },
  {
    id: 'old_kingdom',
    name: '古王国时代',
    icon: '🏛️',
    requiredPrestige: 1,
    productionMultiplier: 1.5,
    description: '金字塔的黄金时代',
    skyTop: '#4A148C',
    skyBottom: '#FF6F00',
  },
  {
    id: 'middle_kingdom',
    name: '中王国时代',
    icon: '📜',
    requiredPrestige: 3,
    productionMultiplier: 2.0,
    description: '文化繁荣与扩张',
    skyTop: '#004D40',
    skyBottom: '#F9A825',
  },
  {
    id: 'new_kingdom',
    name: '新王国时代',
    icon: '👑',
    requiredPrestige: 6,
    productionMultiplier: 3.0,
    description: '帝国的巅峰荣耀',
    skyTop: '#880E4F',
    skyBottom: '#FFD600',
  },
];

// ========== 建筑定义 ==========

export const BUILDING_IDS = {
  FARM: 'farm',
  GRANARY: 'granary',
  QUARRY: 'quarry',
  PYRAMID: 'pyramid',
  TEMPLE: 'temple',
  IRRIGATION: 'irrigation',
  MARKETPLACE: 'marketplace',
  OBELISK: 'obelisk',
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
  /** 解锁条件（需要某资源达到数量） */
  unlockCondition?: Record<string, number>;
  /** 描述 */
  description: string;
}

/** 建筑列表（8 个建筑） */
export const BUILDINGS: BuildingDef[] = [
  {
    id: BUILDING_IDS.FARM,
    name: '农田',
    icon: '🌾',
    baseCost: { food: 15 },
    costMultiplier: 1.15,
    maxLevel: 50,
    productionResource: RESOURCE_IDS.FOOD,
    baseProduction: 0.5,
    description: '尼罗河畔的肥沃农田，产出粮食',
  },
  {
    id: BUILDING_IDS.GRANARY,
    name: '粮仓',
    icon: '🏗️',
    baseCost: { food: 120 },
    costMultiplier: 1.18,
    maxLevel: 30,
    productionResource: RESOURCE_IDS.FOOD,
    baseProduction: 3,
    requires: [BUILDING_IDS.FARM],
    description: '储存粮食的大型仓库',
  },
  {
    id: BUILDING_IDS.QUARRY,
    name: '采石场',
    icon: '⛰️',
    baseCost: { food: 600 },
    costMultiplier: 1.2,
    maxLevel: 30,
    productionResource: RESOURCE_IDS.GOLD,
    baseProduction: 0.3,
    requires: [BUILDING_IDS.FARM],
    description: '开采石灰岩与花岗岩',
  },
  {
    id: BUILDING_IDS.PYRAMID,
    name: '金字塔',
    icon: '🔺',
    baseCost: { food: 3000, gold: 50 },
    costMultiplier: 1.22,
    maxLevel: 20,
    productionResource: RESOURCE_IDS.FAITH,
    baseProduction: 0.2,
    requires: [BUILDING_IDS.QUARRY, BUILDING_IDS.GRANARY],
    description: '法老永恒的安息之所',
  },
  {
    id: BUILDING_IDS.TEMPLE,
    name: '神庙',
    icon: '🏛️',
    baseCost: { food: 1500, gold: 100 },
    costMultiplier: 1.2,
    maxLevel: 25,
    productionResource: RESOURCE_IDS.FAITH,
    baseProduction: 0.4,
    requires: [BUILDING_IDS.QUARRY],
    description: '供奉众神的宏伟殿堂',
  },
  {
    id: BUILDING_IDS.IRRIGATION,
    name: '灌溉系统',
    icon: '🌊',
    baseCost: { food: 4000, gold: 200 },
    costMultiplier: 1.25,
    maxLevel: 20,
    productionResource: RESOURCE_IDS.FOOD,
    baseProduction: 8,
    requires: [BUILDING_IDS.GRANARY],
    description: '尼罗河水的引水工程',
  },
  {
    id: BUILDING_IDS.MARKETPLACE,
    name: '集市',
    icon: '🏪',
    baseCost: { food: 8000, gold: 500 },
    costMultiplier: 1.25,
    maxLevel: 15,
    productionResource: RESOURCE_IDS.GOLD,
    baseProduction: 1.5,
    requires: [BUILDING_IDS.TEMPLE],
    description: '繁华的贸易中心',
  },
  {
    id: BUILDING_IDS.OBELISK,
    name: '方尖碑',
    icon: '🗼',
    baseCost: { food: 20000, gold: 1000, faith: 50 },
    costMultiplier: 1.3,
    maxLevel: 10,
    productionResource: RESOURCE_IDS.FAITH,
    baseProduction: 1.0,
    requires: [BUILDING_IDS.PYRAMID, BUILDING_IDS.TEMPLE],
    description: '刺破苍穹的神圣纪念碑',
  },
];

// ========== 颜色主题（古埃及沙漠/金色色调） ==========

export const COLORS = {
  bgGradient1: '#3E2723',
  bgGradient2: '#1B0F0A',
  sandLight: '#D4A44C',
  sandDark: '#8B6914',
  groundLight: '#C8A96E',
  groundDark: '#8B7355',
  skyTop: '#1A237E',
  skyBottom: '#E65100',
  nileColor: '#1565C0',
  nileHighlight: '#42A5F5',
  textPrimary: '#FFF8E1',
  textSecondary: '#D7CCC8',
  textDim: '#8D6E63',
  accent: '#FFD600',
  accentGreen: '#76FF03',
  accentRed: '#FF1744',
  accentBlue: '#40C4FF',
  panelBg: 'rgba(62, 39, 35, 0.9)',
  panelBorder: 'rgba(255, 214, 0, 0.3)',
  selectedBg: 'rgba(255, 214, 0, 0.15)',
  selectedBorder: 'rgba(255, 214, 0, 0.6)',
  affordable: '#76FF03',
  unaffordable: '#FF1744',
  foodColor: '#8BC34A',
  goldColor: '#FFD600',
  faithColor: '#CE93D8',
  sunColor: '#FFD600',
  pyramidColor: '#D4A44C',
  pyramidShadow: '#8B6914',
  shadowColor: 'rgba(0,0,0,0.3)',
} as const;

// ========== 渲染参数 ==========

export const PYRAMID_DRAW = {
  centerX: 240,
  centerY: 200,
  baseWidth: 120,
  height: 90,
  layerCount: 4,
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
