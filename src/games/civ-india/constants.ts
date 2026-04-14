/**
 * 四大文明·古印度 (Civ India) — 放置类游戏常量定义
 *
 * 核心玩法：
 * - 点击获得香料 (spice)
 * - 建设佛塔、恒河灌溉、瑜伽修行所等建筑
 * - 积累香料、宝石、业力三种资源
 * - 种姓制度系统：婆罗门 / 刹帝利 / 吠舍 / 首陀罗
 * - 佛法修行系统：冥想 / 布施 / 忍辱 / 精进 / 禅定 / 般若
 * - 声望系统：涅槃重生，获得永久加成
 * - 离线收益
 */

/** Canvas 尺寸 */
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ========== 资源 ID ==========

export const RESOURCE_IDS = {
  SPICE: 'spice',
  GEM: 'gem',
  KARMA: 'karma',
} as const;

/** 点击获得的香料数 */
export const SPICE_PER_CLICK = 1;

/** 声望加成系数（每涅槃点增加的产出倍率） */
export const NIRVANA_BONUS_MULTIPLIER = 0.12; // 12% per nirvana point

/** 声望货币计算基数 */
export const PRESTIGE_BASE_NIRVANA = 1;

/** 声望所需最低香料总量 */
export const MIN_PRESTIGE_SPICE = 50000;

// ========== 种姓等级 ==========

export interface CasteDef {
  id: string;
  name: string;
  icon: string;
  /** 解锁所需香料 */
  unlockCost: number;
  /** 加成类型 */
  bonusType: 'click' | 'production' | 'gem' | 'karma' | 'all';
  /** 加成值（百分比，0.1 = 10%） */
  bonusValue: number;
  /** 描述 */
  description: string;
  /** 颜色 */
  color: string;
  /** 修行加成倍率 */
 修行Multiplier: number;
}

/** 种姓列表（从低到高） */
export const CASTES: CasteDef[] = [
  {
    id: 'sudra',
    name: '首陀罗',
    icon: '👷',
    unlockCost: 0,
    bonusType: 'click',
    bonusValue: 0.1,
    description: '点击产香料 +10%',
    color: '#8D6E63',
    修行Multiplier: 1.3,
  },
  {
    id: 'vaisya',
    name: '吠舍',
    icon: '💰',
    unlockCost: 800,
    bonusType: 'production',
    bonusValue: 0.15,
    description: '所有产出 +15%',
    color: '#FFB300',
    修行Multiplier: 1.4,
  },
  {
    id: 'kshatriya',
    name: '刹帝利',
    icon: '⚔️',
    unlockCost: 5000,
    bonusType: 'gem',
    bonusValue: 0.2,
    description: '宝石产出 +20%',
    color: '#E53935',
    修行Multiplier: 1.5,
  },
  {
    id: 'brahmin',
    name: '婆罗门',
    icon: '🙏',
    unlockCost: 30000,
    bonusType: 'all',
    bonusValue: 0.25,
    description: '所有加成 +25%',
    color: '#FF8F00',
    修行Multiplier: 2.0,
  },
];

// ========== 佛法修行定义 ==========

export interface DharmaDef {
  id: string;
  name: string;
  icon: string;
  /** 解锁所需业力 */
  unlockCost: number;
  /** 加成类型 */
  bonusType: 'click' | 'production' | 'gem' | 'karma' | 'all';
  /** 加成值 */
  bonusValue: number;
  /** 描述 */
  description: string;
  /** 进化加成倍率 */
  evolutionMultiplier: number;
}

/** 佛法修行列表 */
export const DHARMAS: DharmaDef[] = [
  {
    id: 'meditation',
    name: '冥想',
    icon: '🧘',
    unlockCost: 0,
    bonusType: 'click',
    bonusValue: 0.1,
    description: '点击产香料 +10%',
    evolutionMultiplier: 1.4,
  },
  {
    id: 'dana',
    name: '布施',
    icon: '🤲',
    unlockCost: 200,
    bonusType: 'production',
    bonusValue: 0.12,
    description: '所有产出 +12%',
    evolutionMultiplier: 1.3,
  },
  {
    id: 'ksanti',
    name: '忍辱',
    icon: '🛡️',
    unlockCost: 800,
    bonusType: 'gem',
    bonusValue: 0.15,
    description: '宝石产出 +15%',
    evolutionMultiplier: 1.5,
  },
  {
    id: 'virya',
    name: '精进',
    icon: '⚡',
    unlockCost: 3000,
    bonusType: 'karma',
    bonusValue: 0.2,
    description: '业力产出 +20%',
    evolutionMultiplier: 1.6,
  },
  {
    id: 'dhyana',
    name: '禅定',
    icon: '🔮',
    unlockCost: 10000,
    bonusType: 'all',
    bonusValue: 0.18,
    description: '所有加成 +18%',
    evolutionMultiplier: 1.8,
  },
  {
    id: 'prajna',
    name: '般若',
    icon: '💡',
    unlockCost: 50000,
    bonusType: 'all',
    bonusValue: 0.3,
    description: '所有加成 +30%',
    evolutionMultiplier: 2.0,
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

// ========== 建筑 ID ==========

export const BUILDING_IDS = {
  SPICE_GARDEN: 'spice_garden',
  STUPA: 'stupa',
  GANGES_IRRIGATION: 'ganges_irrigation',
  YOGA_STUDIO: 'yoga_studio',
  GEM_MINE: 'gem_mine',
  TEMPLE: 'temple',
  MONASTERY: 'monastery',
  ASHOKA_PILLAR: 'ashoka_pillar',
} as const;

/** 建筑列表 */
export const BUILDINGS: BuildingDef[] = [
  {
    id: BUILDING_IDS.SPICE_GARDEN,
    name: '香料园',
    icon: '🌿',
    baseCost: { spice: 15 },
    costMultiplier: 1.15,
    maxLevel: 50,
    productionResource: RESOURCE_IDS.SPICE,
    baseProduction: 0.5,
  },
  {
    id: BUILDING_IDS.STUPA,
    name: '佛塔',
    icon: '🏛️',
    baseCost: { spice: 120 },
    costMultiplier: 1.18,
    maxLevel: 30,
    productionResource: RESOURCE_IDS.SPICE,
    baseProduction: 3,
    requires: [BUILDING_IDS.SPICE_GARDEN],
  },
  {
    id: BUILDING_IDS.GANGES_IRRIGATION,
    name: '恒河灌溉',
    icon: '🌊',
    baseCost: { spice: 600 },
    costMultiplier: 1.2,
    maxLevel: 30,
    productionResource: RESOURCE_IDS.SPICE,
    baseProduction: 8,
    requires: [BUILDING_IDS.SPICE_GARDEN],
  },
  {
    id: BUILDING_IDS.YOGA_STUDIO,
    name: '瑜伽修行所',
    icon: '🧘',
    baseCost: { spice: 3000, gem: 20 },
    costMultiplier: 1.22,
    maxLevel: 20,
    productionResource: RESOURCE_IDS.KARMA,
    baseProduction: 0.2,
    requires: [BUILDING_IDS.STUPA, BUILDING_IDS.GANGES_IRRIGATION],
  },
  {
    id: BUILDING_IDS.GEM_MINE,
    name: '宝石矿场',
    icon: '💎',
    baseCost: { spice: 5000 },
    costMultiplier: 1.2,
    maxLevel: 25,
    productionResource: RESOURCE_IDS.GEM,
    baseProduction: 0.3,
    requires: [BUILDING_IDS.STUPA],
  },
  {
    id: BUILDING_IDS.TEMPLE,
    name: '印度教神庙',
    icon: '🛕',
    baseCost: { spice: 15000, gem: 100 },
    costMultiplier: 1.25,
    maxLevel: 15,
    productionResource: RESOURCE_IDS.KARMA,
    baseProduction: 0.5,
    requires: [BUILDING_IDS.YOGA_STUDIO],
  },
  {
    id: BUILDING_IDS.MONASTERY,
    name: '佛教寺院',
    icon: '🏯',
    baseCost: { spice: 50000, gem: 200, karma: 50 },
    costMultiplier: 1.28,
    maxLevel: 12,
    productionResource: RESOURCE_IDS.KARMA,
    baseProduction: 1.0,
    requires: [BUILDING_IDS.TEMPLE, BUILDING_IDS.GEM_MINE],
  },
  {
    id: BUILDING_IDS.ASHOKA_PILLAR,
    name: '阿育王柱',
    icon: '🗼',
    baseCost: { spice: 200000, gem: 500, karma: 200 },
    costMultiplier: 1.3,
    maxLevel: 10,
    productionResource: RESOURCE_IDS.KARMA,
    baseProduction: 2.0,
    requires: [BUILDING_IDS.MONASTERY],
  },
];

// ========== 颜色主题（印度风格：金色/橙色/深红/紫色） ==========

export const COLORS = {
  bgGradient1: '#1A0A2E',
  bgGradient2: '#0D0520',
  groundLight: '#4A148C',
  groundDark: '#1A0A2E',
  skyTop: '#FF6F00',
  skyBottom: '#E65100',
  riverColor: '#1565C0',
  riverHighlight: '#42A5F5',
  textPrimary: '#FFF8E1',
  textSecondary: '#D7CCC8',
  textDim: '#8D6E63',
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
  spiceColor: '#FF8F00',
  gemColor: '#40C4FF',
  karmaColor: '#CE93D8',
  stupaColor: '#FFD54F',
  sunColor: '#FF6F00',
  sunGlow: 'rgba(255, 111, 0, 0.2)',
  lotusColor: '#F48FB1',
  lotusLeaf: '#4CAF50',
} as const;

// ========== 渲染参数 ==========

export const STUPA_DRAW = {
  centerX: 240,
  centerY: 200,
  bodyWidth: 50,
  bodyHeight: 60,
  domeRadius: 30,
  spireHeight: 40,
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

// ========== 修行进化费用 ==========

/** 进化费用表（按进化等级） */
export const EVOLUTION_COSTS: Record<number, Record<string, number>> = {
  1: { gem: 10, karma: 5 },
  2: { gem: 50, karma: 20, spice: 500 },
  3: { gem: 200, karma: 80, spice: 2000 },
  4: { gem: 800, karma: 300, spice: 8000 },
  5: { gem: 3000, karma: 1000, spice: 30000 },
};

/** 最大进化等级 */
export const MAX_EVOLUTION_LEVEL = 5;
