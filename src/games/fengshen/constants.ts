/**
 * 封神演义 (Fengshen) — 放置类游戏常量定义
 *
 * 核心玩法：
 * - 点击获得灵力 (spirit)
 * - 建设洞府建筑，自动产出资源
 * - 招募神仙，获得能力加成
 * - 法宝炼制系统
 * - 封神榜转生系统（天命）
 * - 三种资源：灵力、法宝、功德
 * - 离线收益
 */

/** Canvas 尺寸 */
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ========== 资源 ID ==========

export const RESOURCE_IDS = {
  SPIRIT: 'spirit',
  TREASURE: 'treasure',
  MERIT: 'merit',
} as const;

// ========== 建筑 ID ==========

export const BUILDING_IDS = {
  CAVE: 'cave',
  ALTAR: 'altar',
  TOWER: 'tower',
  FORGE: 'forge',
  GARDEN: 'garden',
  HALL: 'hall',
  TEMPLE: 'temple',
  PALACE: 'palace',
} as const;

// ========== 核心常量 ==========

/** 点击获得的灵力数 */
export const SPIRIT_PER_CLICK = 1;

/** 转生加成系数（每点天命增加的产出倍率） */
export const PRESTIGE_BONUS_MULTIPLIER = 0.15;

/** 转生货币计算基数 */
export const PRESTIGE_BASE_FATE = 1;

/** 转生所需最低灵力总量 */
export const MIN_PRESTIGE_SPIRIT = 50000;

/** 最大进化等级 */
export const MAX_EVOLUTION_LEVEL = 5;

// ========== 进化费用表（按进化等级） ==========

export const EVOLUTION_COSTS: Record<number, Record<string, number>> = {
  1: { treasure: 5, merit: 10 },
  2: { treasure: 20, merit: 50, spirit: 500 },
  3: { treasure: 80, merit: 200, spirit: 2000 },
  4: { treasure: 300, merit: 800, spirit: 8000 },
  5: { treasure: 1000, merit: 3000, spirit: 30000 },
};

// ========== 神仙定义 ==========

export interface ImmortalDef {
  id: string;
  name: string;
  title: string;
  icon: string;
  /** 解锁所需灵力 */
  unlockCost: number;
  /** 能力类型 */
  bonusType: 'click' | 'production' | 'merit' | 'treasure' | 'all';
  /** 能力值（百分比加成，0.1 = 10%） */
  bonusValue: number;
  /** 描述 */
  description: string;
  /** 颜色（Canvas 绘制用） */
  color: string;
  /** 光环颜色 */
  auraColor: string;
  /** 进化加成倍率 */
  evolutionMultiplier: number;
}

/** 神仙列表（6 个） */
export const IMMORTALS: ImmortalDef[] = [
  {
    id: 'ne_zha',
    name: '哪吒',
    title: '三太子',
    icon: '🔥',
    unlockCost: 0,
    bonusType: 'click',
    bonusValue: 0.1,
    description: '点击产灵力 +10%',
    color: '#E53935',
    auraColor: '#FF8A80',
    evolutionMultiplier: 1.5,
  },
  {
    id: 'yang_jian',
    name: '杨戬',
    title: '二郎神',
    icon: '⚔️',
    unlockCost: 800,
    bonusType: 'production',
    bonusValue: 0.15,
    description: '所有产出 +15%',
    color: '#1565C0',
    auraColor: '#82B1FF',
    evolutionMultiplier: 1.4,
  },
  {
    id: 'lei_zhen_zi',
    name: '雷震子',
    title: '雷神',
    icon: '⚡',
    unlockCost: 5000,
    bonusType: 'merit',
    bonusValue: 0.2,
    description: '功德产出 +20%',
    color: '#F9A825',
    auraColor: '#FFF59D',
    evolutionMultiplier: 1.6,
  },
  {
    id: 'jiang_zi_ya',
    name: '姜子牙',
    title: '封神之人',
    icon: '🎣',
    unlockCost: 20000,
    bonusType: 'all',
    bonusValue: 0.15,
    description: '所有加成 +15%',
    color: '#2E7D32',
    auraColor: '#A5D6A7',
    evolutionMultiplier: 1.8,
  },
  {
    id: 'huang_tian_hua',
    name: '黄天化',
    title: '三山正神',
    icon: '🗡️',
    unlockCost: 60000,
    bonusType: 'treasure',
    bonusValue: 0.2,
    description: '法宝产出 +20%',
    color: '#6A1B9A',
    auraColor: '#CE93D8',
    evolutionMultiplier: 1.3,
  },
  {
    id: 'wen_zhong',
    name: '闻仲',
    title: '九天应元雷声普化天尊',
    icon: '🌩️',
    unlockCost: 150000,
    bonusType: 'production',
    bonusValue: 0.3,
    description: '所有产出 +30%',
    color: '#BF360C',
    auraColor: '#FF8A65',
    evolutionMultiplier: 2.0,
  },
];

// ========== 法宝定义 ==========

export interface TreasureDef {
  id: string;
  name: string;
  icon: string;
  /** 炼制费用 */
  forgeCost: Record<string, number>;
  /** 描述 */
  description: string;
  /** 点击加成 */
  clickBonus: number;
  /** 颜色 */
  color: string;
}

/** 法宝列表（4 个） */
export const TREASURES: TreasureDef[] = [
  {
    id: 'fire_spear',
    name: '火尖枪',
    icon: '🔥',
    forgeCost: { treasure: 10, spirit: 500 },
    description: '点击灵力 +20%',
    clickBonus: 0.2,
    color: '#FF6F00',
  },
  {
    id: 'gold_brick',
    name: '金砖',
    icon: '🧱',
    forgeCost: { treasure: 30, spirit: 2000 },
    description: '点击灵力 +30%',
    clickBonus: 0.3,
    color: '#FFD700',
  },
  {
    id: 'thunder_whip',
    name: '打神鞭',
    icon: '⚡',
    forgeCost: { treasure: 80, spirit: 8000 },
    description: '点击灵力 +50%',
    clickBonus: 0.5,
    color: '#40C4FF',
  },
  {
    id: 'chaos_sword',
    name: '混沌剑',
    icon: '⚔️',
    forgeCost: { treasure: 200, spirit: 30000 },
    description: '点击灵力 +80%',
    clickBonus: 0.8,
    color: '#E040FB',
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
    id: 'cave',
    name: '修炼洞府',
    icon: '🏔️',
    baseCost: { spirit: 15 },
    costMultiplier: 1.15,
    maxLevel: 50,
    productionResource: 'spirit',
    baseProduction: 0.5,
  },
  {
    id: 'altar',
    name: '祭天坛',
    icon: '🪔',
    baseCost: { spirit: 120 },
    costMultiplier: 1.18,
    maxLevel: 30,
    productionResource: 'merit',
    baseProduction: 0.3,
    requires: ['cave'],
  },
  {
    id: 'tower',
    name: '观星塔',
    icon: '🗼',
    baseCost: { spirit: 600 },
    costMultiplier: 1.2,
    maxLevel: 30,
    productionResource: 'spirit',
    baseProduction: 5,
    requires: ['cave'],
  },
  {
    id: 'forge',
    name: '炼器坊',
    icon: '🔨',
    baseCost: { spirit: 3000, merit: 20 },
    costMultiplier: 1.22,
    maxLevel: 20,
    productionResource: 'treasure',
    baseProduction: 0.1,
    requires: ['cave'],
  },
  {
    id: 'garden',
    name: '灵药园',
    icon: '🌿',
    baseCost: { spirit: 15000, merit: 100 },
    costMultiplier: 1.25,
    maxLevel: 15,
    productionResource: 'merit',
    baseProduction: 0.2,
    requires: ['altar'],
  },
  {
    id: 'hall',
    name: '封神殿',
    icon: '🏛️',
    baseCost: { spirit: 80000, treasure: 30 },
    costMultiplier: 1.28,
    maxLevel: 12,
    productionResource: 'treasure',
    baseProduction: 0.5,
    requires: ['forge', 'garden'],
  },
  {
    id: 'temple',
    name: '天庭',
    icon: '☁️',
    baseCost: { spirit: 300000, merit: 500, treasure: 100 },
    costMultiplier: 1.3,
    maxLevel: 10,
    productionResource: 'spirit',
    baseProduction: 20,
    requires: ['hall'],
  },
  {
    id: 'palace',
    name: '混沌宫',
    icon: '✨',
    baseCost: { spirit: 1000000, merit: 2000, treasure: 500 },
    costMultiplier: 1.35,
    maxLevel: 8,
    productionResource: 'treasure',
    baseProduction: 2,
    requires: ['temple', 'hall'],
  },
];

// ========== 颜色主题（仙侠古风：紫金/青绿/朱红） ==========

export const COLORS = {
  bgGradient1: '#1A0A2E',
  bgGradient2: '#0D0520',
  groundLight: '#2D1B4E',
  groundDark: '#1A0A2E',
  skyTop: '#0D0520',
  skyBottom: '#2D1B4E',
  textPrimary: '#F3E5F5',
  textSecondary: '#CE93D8',
  textDim: '#7B1FA2',
  accent: '#FFD700',
  accentGreen: '#76FF03',
  accentRed: '#FF1744',
  accentBlue: '#40C4FF',
  panelBg: 'rgba(45, 27, 78, 0.9)',
  panelBorder: 'rgba(255, 215, 0, 0.3)',
  selectedBg: 'rgba(255, 215, 0, 0.15)',
  selectedBorder: 'rgba(255, 215, 0, 0.6)',
  affordable: '#76FF03',
  unaffordable: '#FF1744',
  spiritColor: '#E1BEE7',
  meritColor: '#FFF9C4',
  treasureColor: '#B2EBF2',
  cloudColor: 'rgba(255, 255, 255, 0.08)',
  mountainColor: '#1B0A3C',
  mountainHighlight: '#311B5E',
  starColor: '#FFD700',
  generalShadow: 'rgba(0,0,0,0.3)',
  fireGlow: '#FF6F00',
  sealColor: '#FFD700',
} as const;

// ========== 渲染参数 ==========

export const IMMORTAL_DRAW = {
  centerX: 240,
  centerY: 200,
  bodyWidth: 50,
  bodyHeight: 55,
  headRadius: 22,
  eyeRadius: 3,
  auraRadius: 45,
  staffLength: 40,
} as const;

/** 建筑列表面板参数 */
export const BUILDING_PANEL = {
  startY: 360,
  itemHeight: 36,
  itemPadding: 3,
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
