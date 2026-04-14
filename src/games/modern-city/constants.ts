/**
 * 现代都市 (Modern City) — 放置类游戏常量定义
 *
 * 核心玩法：
 * - 点击获得金币 (coin)
 * - 建设城市建筑，自动产出资源（金币/人口/科技）
 * - 城市升级系统，解锁更多建筑和功能
 * - 科技树系统（通过建筑前置依赖体现）
 * - 声望系统：重置进度获得声望点数，提供永久加成
 * - 离线收益
 */

/** Canvas 尺寸 */
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ========== 资源 ID ==========

export const RESOURCE_IDS = {
  COIN: 'coin',
  POPULATION: 'population',
  TECH: 'tech',
} as const;

// ========== 建筑 ID ==========

export const BUILDING_IDS = {
  HOUSE: 'house',
  SHOP: 'shop',
  FACTORY: 'factory',
  SCHOOL: 'school',
  OFFICE: 'office',
  HOSPITAL: 'hospital',
  LABORATORY: 'laboratory',
  SKYSCRAPER: 'skyscraper',
} as const;

// ========== 核心常量 ==========

/** 点击获得的金币数 */
export const COIN_PER_CLICK = 1;

/** 声望加成系数（每声望点数增加的产出倍率） */
export const PRESTIGE_BONUS_MULTIPLIER = 0.1; // 10% per prestige point

/** 声望货币计算基数 */
export const PRESTIGE_BASE_POINTS = 1;

/** 声望所需最低总金币 */
export const MIN_PRESTIGE_COIN = 50000;

/** 城市等级所需金币表 */
export const CITY_LEVEL_COSTS: Record<number, number> = {
  2: 500,
  3: 2000,
  4: 8000,
  5: 30000,
  6: 100000,
  7: 500000,
  8: 2000000,
  9: 10000000,
  10: 50000000,
};

/** 最大城市等级 */
export const MAX_CITY_LEVEL = 10;

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
  /** 前置城市等级 */
  requiresCityLevel?: number;
}

/** 建筑列表 */
export const BUILDINGS: BuildingDef[] = [
  {
    id: 'house',
    name: '住宅',
    icon: '🏠',
    baseCost: { coin: 15 },
    costMultiplier: 1.15,
    maxLevel: 50,
    productionResource: 'population',
    baseProduction: 0.5,
  },
  {
    id: 'shop',
    name: '商店',
    icon: '🏪',
    baseCost: { coin: 100 },
    costMultiplier: 1.18,
    maxLevel: 40,
    productionResource: 'coin',
    baseProduction: 2,
    requires: ['house'],
  },
  {
    id: 'factory',
    name: '工厂',
    icon: '🏭',
    baseCost: { coin: 500 },
    costMultiplier: 1.2,
    maxLevel: 30,
    productionResource: 'coin',
    baseProduction: 8,
    requires: ['shop'],
  },
  {
    id: 'school',
    name: '学校',
    icon: '🏫',
    baseCost: { coin: 800 },
    costMultiplier: 1.22,
    maxLevel: 25,
    productionResource: 'tech',
    baseProduction: 1,
    requires: ['factory'],
  },
  {
    id: 'office',
    name: '办公楼',
    icon: '🏢',
    baseCost: { coin: 3000, tech: 5 },
    costMultiplier: 1.25,
    maxLevel: 20,
    productionResource: 'coin',
    baseProduction: 20,
    requires: ['school'],
    requiresCityLevel: 3,
  },
  {
    id: 'hospital',
    name: '医院',
    icon: '🏥',
    baseCost: { coin: 8000, population: 20, tech: 10 },
    costMultiplier: 1.28,
    maxLevel: 15,
    productionResource: 'population',
    baseProduction: 3,
    requires: ['office'],
    requiresCityLevel: 4,
  },
  {
    id: 'laboratory',
    name: '实验室',
    icon: '🔬',
    baseCost: { coin: 15000, population: 50, tech: 20 },
    costMultiplier: 1.3,
    maxLevel: 15,
    productionResource: 'tech',
    baseProduction: 5,
    requires: ['hospital'],
    requiresCityLevel: 5,
  },
  {
    id: 'skyscraper',
    name: '摩天大楼',
    icon: '🏙️',
    baseCost: { coin: 100000, population: 200, tech: 100 },
    costMultiplier: 1.35,
    maxLevel: 10,
    productionResource: 'coin',
    baseProduction: 200,
    requires: ['laboratory'],
    requiresCityLevel: 7,
  },
];

// ========== 颜色主题（现代都市风格：蓝色/灰色/霓虹色调） ==========

export const COLORS = {
  bgGradient1: '#0D1B2A',
  bgGradient2: '#1B2838',
  groundLight: '#2C3E50',
  groundDark: '#1A252F',
  skyTop: '#0A1628',
  skyBottom: '#162447',
  textPrimary: '#ECF0F1',
  textSecondary: '#BDC3C7',
  textDim: '#7F8C8D',
  accent: '#3498DB',
  accentGreen: '#2ECC71',
  accentRed: '#E74C3C',
  accentBlue: '#3498DB',
  accentYellow: '#F1C40F',
  panelBg: 'rgba(44, 62, 80, 0.9)',
  panelBorder: 'rgba(52, 152, 219, 0.3)',
  selectedBg: 'rgba(52, 152, 219, 0.15)',
  selectedBorder: 'rgba(52, 152, 219, 0.6)',
  affordable: '#2ECC71',
  unaffordable: '#E74C3C',
  buildingShadow: 'rgba(0,0,0,0.3)',
  coinColor: '#F1C40F',
  populationColor: '#2ECC71',
  techColor: '#9B59B6',
  windowColor: '#F39C12',
  neonGlow: '#00D4FF',
} as const;

// ========== 渲染参数 ==========

export const CITY_DRAW = {
  centerX: 240,
  centerY: 220,
  buildingWidth: 50,
  buildingHeight: 80,
  windowSize: 4,
  windowPadding: 8,
  groundY: 300,
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
