/**
 * 家族风云 (Clan Saga) 放置类游戏 — 常量定义
 *
 * 核心玩法：
 * - 点击/空格键获得财富
 * - 建筑系统（商铺、书院、武馆、祠堂、茶馆、钱庄、使馆、宝库）
 * - 后代培养系统（武将、文士、商人、外交官）
 * - 联姻系统（与其他家族联姻获得加成）
 * - 声望系统（转生获得家族传承，永久加成）
 * - 离线收益
 * - 自动存档/读档
 */

/** Canvas 尺寸 */
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

/** 点击产生的财富数量 */
export const WEALTH_PER_CLICK = 1;

/** 资源 ID 常量 */
export const RESOURCE_IDS = {
  WEALTH: 'wealth',
  REPUTATION: 'reputation',
  CONNECTION: 'connection',
} as const;

/** 建筑 ID 常量 */
export const BUILDING_IDS = {
  SHOP: 'shop',
  ACADEMY: 'academy',
  DOJO: 'dojo',
  ANCESTRAL_HALL: 'ancestral-hall',
  TEA_HOUSE: 'tea-house',
  BANK: 'bank',
  EMBASSY: 'embassy',
  TREASURY: 'treasury',
} as const;

/** 后代类型 */
export const HEIR_TYPES = {
  WARRIOR: 'warrior',
  SCHOLAR: 'scholar',
  MERCHANT: 'merchant',
  DIPLOMAT: 'diplomat',
} as const;

/** 建筑定义 */
export interface BuildingDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  baseCost: Record<string, number>;
  costMultiplier: number;
  maxLevel: number;
  productionResource: string;
  baseProduction: number;
  /** 解锁条件：需要某种资源达到一定量 */
  unlockCondition?: Record<string, number>;
  /** 解锁需要的建筑等级 { buildingId: level } */
  unlockBuildingLevel?: Record<string, number>;
}

/** 后代类型定义 */
export interface HeirTypeDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  /** 培养消耗 */
  trainCost: Record<string, number>;
  /** 培养消耗倍率（每级） */
  trainCostMultiplier: number;
  /** 被动加成目标资源 */
  bonusTarget: string;
  /** 被动加成值（每级） */
  bonusPerLevel: number;
  /** 最大等级 */
  maxLevel: number;
}

/** 联姻家族定义 */
export interface MarriageFamilyDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  /** 联姻消耗 */
  cost: Record<string, number>;
  /** 联姻加成 */
  bonus: Record<string, number>;
  /** 需要后代类型 */
  requiredHeirType?: string;
  /** 需要后代最低等级 */
  requiredHeirLevel?: number;
}

/** 建筑列表 */
export const BUILDINGS: BuildingDef[] = [
  {
    id: BUILDING_IDS.SHOP,
    name: '商铺',
    icon: '🏪',
    description: '基础建筑，经营买卖赚取财富',
    baseCost: { wealth: 10 },
    costMultiplier: 1.15,
    maxLevel: 50,
    productionResource: RESOURCE_IDS.WEALTH,
    baseProduction: 0.5,
  },
  {
    id: BUILDING_IDS.ACADEMY,
    name: '书院',
    icon: '📚',
    description: '培养文士，产出声望',
    baseCost: { wealth: 50 },
    costMultiplier: 1.18,
    maxLevel: 50,
    productionResource: RESOURCE_IDS.REPUTATION,
    baseProduction: 0.3,
    unlockCondition: { wealth: 30 },
  },
  {
    id: BUILDING_IDS.DOJO,
    name: '武馆',
    icon: '⚔️',
    description: '训练武将，提升点击力量',
    baseCost: { wealth: 100 },
    costMultiplier: 1.2,
    maxLevel: 30,
    productionResource: RESOURCE_IDS.WEALTH,
    baseProduction: 0,
    unlockCondition: { wealth: 60 },
  },
  {
    id: BUILDING_IDS.ANCESTRAL_HALL,
    name: '祠堂',
    icon: '🏛️',
    description: '祭祀先祖，提升产出倍率',
    baseCost: { wealth: 300, reputation: 50 },
    costMultiplier: 1.25,
    maxLevel: 20,
    productionResource: RESOURCE_IDS.REPUTATION,
    baseProduction: 0.1,
    unlockCondition: { wealth: 200, reputation: 30 },
  },
  {
    id: BUILDING_IDS.TEA_HOUSE,
    name: '茶馆',
    icon: '🍵',
    description: '结交人脉，产出人脉资源',
    baseCost: { wealth: 500, reputation: 100 },
    costMultiplier: 1.22,
    maxLevel: 40,
    productionResource: RESOURCE_IDS.CONNECTION,
    baseProduction: 0.2,
    unlockCondition: { wealth: 300, reputation: 60 },
  },
  {
    id: BUILDING_IDS.BANK,
    name: '钱庄',
    icon: '🏦',
    description: '经营金融，大量产出财富',
    baseCost: { wealth: 2000, reputation: 300, connection: 100 },
    costMultiplier: 1.3,
    maxLevel: 30,
    productionResource: RESOURCE_IDS.WEALTH,
    baseProduction: 1.0,
    unlockCondition: { wealth: 1000, reputation: 150 },
  },
  {
    id: BUILDING_IDS.EMBASSY,
    name: '使馆',
    icon: '🏰',
    description: '外交联络，大量产出人脉',
    baseCost: { wealth: 5000, reputation: 500, connection: 200 },
    costMultiplier: 1.35,
    maxLevel: 25,
    productionResource: RESOURCE_IDS.CONNECTION,
    baseProduction: 0.5,
    unlockCondition: { wealth: 3000, reputation: 300, connection: 100 },
  },
  {
    id: BUILDING_IDS.TREASURY,
    name: '宝库',
    icon: '💎',
    description: '家族宝库，提升所有产出',
    baseCost: { wealth: 10000, reputation: 1000, connection: 500 },
    costMultiplier: 1.5,
    maxLevel: 15,
    productionResource: RESOURCE_IDS.WEALTH,
    baseProduction: 0,
    unlockCondition: { wealth: 5000, reputation: 500, connection: 200 },
  },
];

/** 后代类型列表 */
export const HEIR_TYPE_DEFS: HeirTypeDef[] = [
  {
    id: HEIR_TYPES.WARRIOR,
    name: '武将',
    icon: '⚔️',
    description: '勇武过人，提升点击力量',
    trainCost: { wealth: 100, reputation: 20 },
    trainCostMultiplier: 1.5,
    bonusTarget: RESOURCE_IDS.WEALTH,
    bonusPerLevel: 0.5,
    maxLevel: 20,
  },
  {
    id: HEIR_TYPES.SCHOLAR,
    name: '文士',
    icon: '📖',
    description: '才学渊博，提升声望产出',
    trainCost: { wealth: 80, connection: 10 },
    trainCostMultiplier: 1.4,
    bonusTarget: RESOURCE_IDS.REPUTATION,
    bonusPerLevel: 0.3,
    maxLevel: 20,
  },
  {
    id: HEIR_TYPES.MERCHANT,
    name: '商人',
    icon: '💰',
    description: '精于商道，提升财富产出',
    trainCost: { wealth: 150, connection: 20 },
    trainCostMultiplier: 1.6,
    bonusTarget: RESOURCE_IDS.WEALTH,
    bonusPerLevel: 0.4,
    maxLevel: 20,
  },
  {
    id: HEIR_TYPES.DIPLOMAT,
    name: '外交官',
    icon: '🤝',
    description: '长袖善舞，提升人脉产出',
    trainCost: { wealth: 120, reputation: 30 },
    trainCostMultiplier: 1.45,
    bonusTarget: RESOURCE_IDS.CONNECTION,
    bonusPerLevel: 0.3,
    maxLevel: 20,
  },
];

/** 联姻家族列表 */
export const MARRIAGE_FAMILIES: MarriageFamilyDef[] = [
  {
    id: 'family-zhang',
    name: '张家',
    icon: '🏠',
    description: '书香门第，声望加成',
    cost: { wealth: 500, reputation: 100 },
    bonus: { reputation: 0.5 },
    requiredHeirType: HEIR_TYPES.SCHOLAR,
    requiredHeirLevel: 1,
  },
  {
    id: 'family-li',
    name: '李家',
    icon: '⚔️',
    description: '武将世家，点击力量加成',
    cost: { wealth: 800, reputation: 50, connection: 50 },
    bonus: { wealth: 1.0 },
    requiredHeirType: HEIR_TYPES.WARRIOR,
    requiredHeirLevel: 2,
  },
  {
    id: 'family-wang',
    name: '王家',
    icon: '💰',
    description: '商贾巨族，财富产出加成',
    cost: { wealth: 2000, reputation: 200, connection: 100 },
    bonus: { wealth: 2.0, reputation: 0.3 },
    requiredHeirType: HEIR_TYPES.MERCHANT,
    requiredHeirLevel: 3,
  },
  {
    id: 'family-zhao',
    name: '赵家',
    icon: '🏰',
    description: '名门望族，全资源加成',
    cost: { wealth: 5000, reputation: 500, connection: 300 },
    bonus: { wealth: 1.0, reputation: 1.0, connection: 1.0 },
    requiredHeirType: HEIR_TYPES.DIPLOMAT,
    requiredHeirLevel: 5,
  },
  {
    id: 'family-chen',
    name: '陈家',
    icon: '🏯',
    description: '皇亲国戚，大幅全资源加成',
    cost: { wealth: 20000, reputation: 2000, connection: 1000 },
    bonus: { wealth: 3.0, reputation: 2.0, connection: 2.0 },
    requiredHeirType: HEIR_TYPES.DIPLOMAT,
    requiredHeirLevel: 8,
  },
];

/** 声望系统常量 */
export const PRESTIGE_MULTIPLIER = 0.04;
export const MIN_PRESTIGE_WEALTH = 50000;

/** 颜色主题 — 古风雅韵（朱红/金色/墨色） */
export const COLORS = {
  bgGradient1: '#1a0f0a',
  bgGradient2: '#2a1810',
  bgGradient3: '#1a1210',
  inkDark: '#2a1a10',
  inkMid: '#3d2a1a',
  inkLight: '#5a4030',
  redPrimary: '#c05040',
  redLight: '#e07060',
  redDark: '#8b3020',
  goldPrimary: '#c9a84c',
  goldLight: '#f0d080',
  goldDark: '#8b6914',
  textPrimary: '#f0e0c8',
  textSecondary: '#c0a888',
  textDim: '#807060',
  accentRed: '#c05040',
  accentGold: '#c9a84c',
  accentGreen: '#5a9e6f',
  accentBlue: '#4a90a4',
  panelBg: 'rgba(26, 15, 10, 0.92)',
  panelBorder: 'rgba(201, 168, 76, 0.3)',
  selectedBg: 'rgba(201, 168, 76, 0.15)',
  selectedBorder: 'rgba(201, 168, 76, 0.6)',
  affordable: '#5a9e6f',
  unaffordable: '#c05050',
  wealthColor: '#f0d080',
  reputationColor: '#e07060',
  connectionColor: '#7ec8d8',
  paperWhite: '#f5e6c8',
  roofRed: '#8b3020',
  wallGray: '#d0c0a0',
  lanternGlow: 'rgba(240, 160, 60, 0.3)',
  courtyardGreen: '#3a5a3a',
  prestigeGlow: '#c9a84c',
  successGlow: '#5a9e6f',
  failGlow: '#c05050',
} as const;

/** 升级列表面板参数 */
export const UPGRADE_PANEL = {
  startY: 300,
  itemHeight: 48,
  itemPadding: 4,
  itemMarginX: 12,
  itemWidth: CANVAS_WIDTH - 24,
  visibleCount: 6,
} as const;

/** 资源图标映射 */
export const RESOURCE_ICONS: Record<string, string> = {
  [RESOURCE_IDS.WEALTH]: '💰',
  [RESOURCE_IDS.REPUTATION]: '⭐',
  [RESOURCE_IDS.CONNECTION]: '🤝',
};

/** 资源名称映射 */
export const RESOURCE_NAMES: Record<string, string> = {
  [RESOURCE_IDS.WEALTH]: '财富',
  [RESOURCE_IDS.REPUTATION]: '声望',
  [RESOURCE_IDS.CONNECTION]: '人脉',
};

/** 飘字效果持续时间（毫秒） */
export const FLOATING_TEXT_DURATION = 1000;

/** 灯笼粒子数量 */
export const MAX_LANTERN_PARTICLES = 8;

/** 落叶粒子数量 */
export const MAX_LEAF_PARTICLES = 10;

/** 动画参数 */
export const ANIMATION = {
  /** 飘字效果持续时间（毫秒） */
  floatingTextDuration: 1200,
  /** 灯笼粒子数量 */
  lanternCount: 8,
  /** 落叶粒子数量 */
  leafCount: 10,
  /** 转生光效持续时间（毫秒） */
  prestigeDuration: 2000,
} as const;
