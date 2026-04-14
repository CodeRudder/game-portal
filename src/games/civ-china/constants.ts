/**
 * 四大文明·古中国 (Civ China) — 放置类游戏常量定义
 *
 * 核心玩法：
 * - 点击获得粮食 (food)
 * - 建设古代建筑，自动产出资源
 * - 朝代更替系统，解锁新建筑与加成
 * - 科举制度，招募官员获得全局加成
 * - 积累粮食、丝绸、文化三种核心资源
 * - 声望系统：朝代更替获得天命点，提供永久加成
 * - 离线收益
 */

/** Canvas 尺寸 */
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ========== 资源 ID ==========

export const RESOURCE_IDS = {
  FOOD: 'food',
  SILK: 'silk',
  CULTURE: 'culture',
} as const;

/** 点击获得的粮食数 */
export const FOOD_PER_CLICK = 1;

/** 声望加成系数（每点天命增加的产出倍率） */
export const MANDATE_BONUS_MULTIPLIER = 0.15;

/** 声望货币计算基数 */
export const PRESTIGE_BASE_MANDATE = 1;

/** 声望所需最低粮食总量 */
export const MIN_PRESTIGE_FOOD = 50000;

/** 朝代加成系数 */
export const DYNASTY_BONUS = 0.15;

// ========== 建筑 ID ==========

export const BUILDING_IDS = {
  FARM: 'farm',
  SILK_WORKSHOP: 'silk_workshop',
  GREAT_WALL: 'great_wall',
  SILK_ROAD: 'silk_road',
  ACADEMY: 'academy',
  IMPERIAL_PALACE: 'imperial_palace',
  GRAND_CANAL: 'grand_canal',
  FORBIDDEN_CITY: 'forbidden_city',
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
  /** 解锁所需朝代索引 */
  requiredDynasty?: number;
}

/** 建筑列表 */
export const BUILDINGS: BuildingDef[] = [
  {
    id: 'farm',
    name: '农田',
    icon: '🌾',
    baseCost: { food: 15 },
    costMultiplier: 1.15,
    maxLevel: 50,
    productionResource: 'food',
    baseProduction: 0.5,
  },
  {
    id: 'silk_workshop',
    name: '丝绸作坊',
    icon: '🧵',
    baseCost: { food: 120 },
    costMultiplier: 1.18,
    maxLevel: 30,
    productionResource: 'silk',
    baseProduction: 0.3,
    requires: ['farm'],
  },
  {
    id: 'great_wall',
    name: '长城',
    icon: '🏯',
    baseCost: { food: 600, silk: 30 },
    costMultiplier: 1.2,
    maxLevel: 30,
    productionResource: 'culture',
    baseProduction: 0.2,
    requires: ['farm'],
  },
  {
    id: 'silk_road',
    name: '丝绸之路',
    icon: '🐪',
    baseCost: { food: 3000, silk: 200 },
    costMultiplier: 1.22,
    maxLevel: 20,
    productionResource: 'silk',
    baseProduction: 2,
    requires: ['silk_workshop', 'great_wall'],
    requiredDynasty: 1,
  },
  {
    id: 'academy',
    name: '科举书院',
    icon: '📜',
    baseCost: { food: 1500, culture: 50 },
    costMultiplier: 1.2,
    maxLevel: 25,
    productionResource: 'culture',
    baseProduction: 0.5,
    requires: ['great_wall'],
  },
  {
    id: 'imperial_palace',
    name: '皇宫',
    icon: '🏛️',
    baseCost: { food: 10000, silk: 500, culture: 200 },
    costMultiplier: 1.25,
    maxLevel: 15,
    productionResource: 'food',
    baseProduction: 10,
    requires: ['academy'],
    requiredDynasty: 1,
  },
  {
    id: 'grand_canal',
    name: '大运河',
    icon: '🌊',
    baseCost: { food: 50000, silk: 2000, culture: 800 },
    costMultiplier: 1.28,
    maxLevel: 12,
    productionResource: 'silk',
    baseProduction: 5,
    requires: ['silk_road', 'imperial_palace'],
    requiredDynasty: 2,
  },
  {
    id: 'forbidden_city',
    name: '紫禁城',
    icon: '🏰',
    baseCost: { food: 200000, silk: 8000, culture: 3000 },
    costMultiplier: 1.3,
    maxLevel: 10,
    productionResource: 'culture',
    baseProduction: 8,
    requires: ['grand_canal'],
    requiredDynasty: 3,
  },
];

// ========== 朝代系统 ==========

export const DYNASTY_IDS = {
  XIA: 'xia',
  SHANG: 'shang',
  ZHOU: 'zhou',
  QIN: 'qin',
  HAN: 'han',
  TANG: 'tang',
  SONG: 'song',
  MING: 'ming',
} as const;

export interface DynastyDef {
  id: string;
  name: string;
  icon: string;
  /** 解锁所需天命点 */
  requiredMandate: number;
  /** 该朝代全局加成 */
  bonusType: 'food' | 'silk' | 'culture' | 'all';
  bonusValue: number;
  description: string;
  color: string;
}

/** 朝代列表 */
export const DYNASTIES: DynastyDef[] = [
  {
    id: 'xia',
    name: '夏',
    icon: '🔰',
    requiredMandate: 0,
    bonusType: 'food',
    bonusValue: 0.1,
    description: '粮食产出 +10%',
    color: '#8D6E63',
  },
  {
    id: 'shang',
    name: '商',
    icon: '🏺',
    requiredMandate: 3,
    bonusType: 'silk',
    bonusValue: 0.15,
    description: '丝绸产出 +15%',
    color: '#5D4037',
  },
  {
    id: 'zhou',
    name: '周',
    icon: '🗡️',
    requiredMandate: 10,
    bonusType: 'culture',
    bonusValue: 0.2,
    description: '文化产出 +20%',
    color: '#1565C0',
  },
  {
    id: 'qin',
    name: '秦',
    icon: '🏛️',
    requiredMandate: 25,
    bonusType: 'all',
    bonusValue: 0.2,
    description: '所有产出 +20%',
    color: '#2E2E2E',
  },
  {
    id: 'han',
    name: '汉',
    icon: '🐉',
    requiredMandate: 50,
    bonusType: 'all',
    bonusValue: 0.3,
    description: '所有产出 +30%',
    color: '#B71C1C',
  },
  {
    id: 'tang',
    name: '唐',
    icon: '🌸',
    requiredMandate: 100,
    bonusType: 'all',
    bonusValue: 0.4,
    description: '所有产出 +40%',
    color: '#FF6F00',
  },
  {
    id: 'song',
    name: '宋',
    icon: '📖',
    requiredMandate: 200,
    bonusType: 'all',
    bonusValue: 0.5,
    description: '所有产出 +50%',
    color: '#1B5E20',
  },
  {
    id: 'ming',
    name: '明',
    icon: '🏯',
    requiredMandate: 500,
    bonusType: 'all',
    bonusValue: 0.6,
    description: '所有产出 +60%',
    color: '#FFD600',
  },
];

// ========== 科举官员定义 ==========

export interface OfficialDef {
  id: string;
  name: string;
  title: string;
  icon: string;
  /** 招募费用（文化） */
  recruitCost: number;
  /** 能力类型 */
  bonusType: 'click' | 'production' | 'food' | 'silk' | 'culture' | 'all';
  /** 能力值（百分比加成，0.1 = 10%） */
  bonusValue: number;
  description: string;
  color: string;
}

/** 科举官员列表 */
export const OFFICIALS: OfficialDef[] = [
  {
    id: 'scholar',
    name: '秀才',
    title: '文士',
    icon: '📖',
    recruitCost: 0,
    bonusType: 'click',
    bonusValue: 0.1,
    description: '点击产粮 +10%',
    color: '#4CAF50',
  },
  {
    id: 'juren',
    name: '举人',
    title: '地方官',
    icon: '📝',
    recruitCost: 500,
    bonusType: 'production',
    bonusValue: 0.15,
    description: '所有产出 +15%',
    color: '#2196F3',
  },
  {
    id: 'jinshi',
    name: '进士',
    title: '朝臣',
    icon: '🎓',
    recruitCost: 2000,
    bonusType: 'culture',
    bonusValue: 0.25,
    description: '文化产出 +25%',
    color: '#9C27B0',
  },
  {
    id: 'zhuangyuan',
    name: '状元',
    title: '宰相',
    icon: '👑',
    recruitCost: 8000,
    bonusType: 'all',
    bonusValue: 0.3,
    description: '所有加成 +30%',
    color: '#FFD700',
  },
];

// ========== 颜色主题（古典中国风：红金黑） ==========

export const COLORS = {
  background: '#1a0a00',
  bgGradient1: '#1A0A00',
  bgGradient2: '#0D0500',
  groundLight: '#3E2723',
  groundDark: '#1A0A00',
  skyTop: '#1A237E',
  skyBottom: '#4A148C',
  textPrimary: '#FFF8E1',
  textSecondary: '#D7CCC8',
  textDim: '#8D6E63',
  accent: '#FFD700',
  accentRed: '#D32F2F',
  accentGreen: '#76FF03',
  accentBlue: '#40C4FF',
  panelBg: 'rgba(62, 39, 35, 0.9)',
  panelBorder: 'rgba(255, 215, 0, 0.3)',
  selectedBg: 'rgba(255, 215, 0, 0.15)',
  selectedBorder: 'rgba(255, 215, 0, 0.6)',
  affordable: '#76FF03',
  unaffordable: '#FF1744',
  foodColor: '#8BC34A',
  silkColor: '#FFD700',
  cultureColor: '#40C4FF',
  mountainFar: '#37474F',
  mountainNear: '#263238',
  cloudColor: 'rgba(255, 248, 225, 0.12)',
  lanternGlow: '#FF6F00',
  wallColor: '#795548',
  wallTop: '#A1887F',
  treeGreen: '#2E7D32',
  treeTrunk: '#4E342E',
  dynastyXia: '#8D6E63',
  dynastyShang: '#5D4037',
  dynastyZhou: '#1565C0',
  dynastyQin: '#2E2E2E',
  dynastyHan: '#B71C1C',
  dynastyTang: '#FF6F00',
  dynastySong: '#1B5E20',
  dynastyMing: '#FFD600',
} as const;

// ========== 渲染参数 ==========

export const SCENE_DRAW = {
  centerX: 240,
  centerY: 200,
  wallWidth: 120,
  wallHeight: 50,
  towerWidth: 20,
  towerHeight: 70,
  pagodaX: 380,
  pagodaY: 140,
  pagodaWidth: 40,
  pagodaFloors: 5,
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
