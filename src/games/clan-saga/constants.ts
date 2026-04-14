/**
 * Clan Saga（家族风云）放置类游戏 — 常量定义
 *
 * 核心玩法：
 * - 点击/空格键获得家族贡献点
 * - 建筑系统（祠堂、练功房、丹药房、藏书阁、演武场、灵兽园）
 * - 家族成员系统（家主、长老、精英弟子、普通弟子、外门弟子、杂役）
 * - 声望系统（重置获得传承点，永久加成）
 * - 离线收益
 * - 自动存档/读档
 */

/** Canvas 尺寸 */
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

/** 点击产生的贡献点数量 */
export const CONTRIBUTION_PER_CLICK = 1;

/** 资源 ID 常量 */
export const RESOURCE_IDS = {
  CONTRIBUTION: 'contribution',
  SPIRIT_STONE: 'spirit-stone',
  PILL: 'pill',
  PRESTIGE: 'prestige',
} as const;

/** 建筑 ID 常量 */
export const BUILDING_IDS = {
  SHRINE: 'shrine',
  TRAINING_GROUND: 'training-ground',
  PILL_ROOM: 'pill-room',
  LIBRARY: 'library',
  ARENA: 'arena',
  BEAST_GARDEN: 'beast-garden',
} as const;

/** 家族成员 ID 常量 */
export const MEMBER_IDS = {
  PATRIARCH: 'patriarch',
  ELDER: 'elder',
  ELITE: 'elite',
  DISCIPLE: 'disciple',
  OUTER: 'outer',
  SERVANT: 'servant',
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
  unlockCondition?: Record<string, number>;
}

/** 家族成员定义 */
export interface MemberDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  unlockCost: Record<string, number>;
  bonusType: string;
  bonusValue: number;
  bonusTarget: string;
}

/** 建筑列表 */
export const BUILDINGS: BuildingDef[] = [
  {
    id: BUILDING_IDS.SHRINE,
    name: '祠堂',
    icon: '🏯',
    description: '基础建筑，产出贡献点',
    baseCost: { contribution: 10 },
    costMultiplier: 1.15,
    maxLevel: 50,
    productionResource: RESOURCE_IDS.CONTRIBUTION,
    baseProduction: 0.5,
  },
  {
    id: BUILDING_IDS.TRAINING_GROUND,
    name: '练功房',
    icon: '⚔️',
    description: '弟子修炼，产出贡献点',
    baseCost: { contribution: 50 },
    costMultiplier: 1.18,
    maxLevel: 50,
    productionResource: RESOURCE_IDS.CONTRIBUTION,
    baseProduction: 0.3,
    unlockCondition: { contribution: 30 },
  },
  {
    id: BUILDING_IDS.PILL_ROOM,
    name: '丹药房',
    icon: '⚗️',
    description: '炼制丹药，产出灵石',
    baseCost: { contribution: 200, 'spirit-stone': 50 },
    costMultiplier: 1.2,
    maxLevel: 30,
    productionResource: RESOURCE_IDS.SPIRIT_STONE,
    baseProduction: 0.1,
    unlockCondition: { contribution: 100, 'spirit-stone': 20 },
  },
  {
    id: BUILDING_IDS.LIBRARY,
    name: '藏书阁',
    icon: '📚',
    description: '藏经纳典，产出丹药',
    baseCost: { contribution: 500, 'spirit-stone': 100 },
    costMultiplier: 1.25,
    maxLevel: 20,
    productionResource: RESOURCE_IDS.PILL,
    baseProduction: 0.05,
    unlockCondition: { contribution: 300, 'spirit-stone': 50 },
  },
  {
    id: BUILDING_IDS.ARENA,
    name: '演武场',
    icon: '🏟️',
    description: '比武较技，产出声望',
    baseCost: { contribution: 2000, 'spirit-stone': 500, pill: 100 },
    costMultiplier: 1.3,
    maxLevel: 30,
    productionResource: RESOURCE_IDS.PRESTIGE,
    baseProduction: 0.02,
    unlockCondition: { contribution: 1000, 'spirit-stone': 200, pill: 50 },
  },
  {
    id: BUILDING_IDS.BEAST_GARDEN,
    name: '灵兽园',
    icon: '🐉',
    description: '驯养灵兽，产出丹药和声望',
    baseCost: { contribution: 50000, 'spirit-stone': 10000, pill: 2000 },
    costMultiplier: 1.5,
    maxLevel: 10,
    productionResource: RESOURCE_IDS.PILL,
    baseProduction: 0.005,
    unlockCondition: { contribution: 20000, 'spirit-stone': 5000, pill: 500 },
  },
];

/** 家族成员列表 */
export const MEMBERS: MemberDef[] = [
  {
    id: MEMBER_IDS.PATRIARCH,
    name: '家主',
    icon: '👑',
    description: '家族之主，全加成+30%',
    unlockCost: {},
    bonusType: 'multiply_all',
    bonusValue: 0.30,
    bonusTarget: 'all',
  },
  {
    id: MEMBER_IDS.ELDER,
    name: '长老',
    icon: '🧙',
    description: '家族长老，全加成+20%',
    unlockCost: { contribution: 500 },
    bonusType: 'multiply_all',
    bonusValue: 0.20,
    bonusTarget: 'all',
  },
  {
    id: MEMBER_IDS.ELITE,
    name: '精英弟子',
    icon: '🗡️',
    description: '精英弟子，贡献加成+25%',
    unlockCost: { contribution: 2000 },
    bonusType: 'multiply_production',
    bonusValue: 0.25,
    bonusTarget: RESOURCE_IDS.CONTRIBUTION,
  },
  {
    id: MEMBER_IDS.DISCIPLE,
    name: '普通弟子',
    icon: '🥋',
    description: '普通弟子，贡献加成+15%',
    unlockCost: { contribution: 5000 },
    bonusType: 'multiply_production',
    bonusValue: 0.15,
    bonusTarget: RESOURCE_IDS.CONTRIBUTION,
  },
  {
    id: MEMBER_IDS.OUTER,
    name: '外门弟子',
    icon: '👘',
    description: '外门弟子，贡献加成+10%',
    unlockCost: { contribution: 15000 },
    bonusType: 'multiply_production',
    bonusValue: 0.10,
    bonusTarget: RESOURCE_IDS.CONTRIBUTION,
  },
  {
    id: MEMBER_IDS.SERVANT,
    name: '杂役',
    icon: '🧹',
    description: '杂役仆从，贡献加成+5%',
    unlockCost: { contribution: 50000 },
    bonusType: 'multiply_production',
    bonusValue: 0.05,
    bonusTarget: RESOURCE_IDS.CONTRIBUTION,
  },
];

/** 声望系统常量 */
export const PRESTIGE_MULTIPLIER = 0.03;
export const MIN_PRESTIGE_CONTRIBUTION = 8000;

/** 颜色主题 — 水墨国风 */
export const COLORS = {
  bgGradient1: '#0a0f1a',
  bgGradient2: '#1a1a2e',
  mountainFar: '#16213e',
  mountainNear: '#1a1a2e',
  inkColor: '#2c3e50',
  textPrimary: '#e8d5b7',
  textSecondary: '#b8a088',
  textDim: '#7a6a5a',
  accentGold: '#d4a853',
  accentJade: '#5a8f7b',
  accentCinnabar: '#c0392b',
  accentAzure: '#3498db',
  panelBg: 'rgba(15, 15, 30, 0.9)',
  panelBorder: 'rgba(212, 168, 83, 0.3)',
  selectedBg: 'rgba(212, 168, 83, 0.15)',
  selectedBorder: 'rgba(212, 168, 83, 0.6)',
  affordable: '#5a8f7b',
  unaffordable: '#c0392b',
  contributionColor: '#d4a853',
  spiritStoneColor: '#3498db',
  pillColor: '#e74c3c',
  prestigeColor: '#9b59b6',
  inkWash1: 'rgba(44, 62, 80, 0.1)',
  inkWash2: 'rgba(44, 62, 80, 0.2)',
  cloudColor: 'rgba(200, 200, 220, 0.08)',
  bambooColor: '#2d5a3f',
  cherryColor: '#d4756b',
} as const;

/** 升级列表面板参数 */
export const UPGRADE_PANEL = {
  startY: 280,
  itemHeight: 48,
  itemPadding: 4,
  itemMarginX: 12,
  itemWidth: CANVAS_WIDTH - 24,
  visibleCount: 6,
} as const;

/** 资源图标映射 */
export const RESOURCE_ICONS: Record<string, string> = {
  [RESOURCE_IDS.CONTRIBUTION]: '🏯',
  [RESOURCE_IDS.SPIRIT_STONE]: '💎',
  [RESOURCE_IDS.PILL]: '💊',
  [RESOURCE_IDS.PRESTIGE]: '⭐',
};

/** 资源名称映射 */
export const RESOURCE_NAMES: Record<string, string> = {
  [RESOURCE_IDS.CONTRIBUTION]: '贡献点',
  [RESOURCE_IDS.SPIRIT_STONE]: '灵石',
  [RESOURCE_IDS.PILL]: '丹药',
  [RESOURCE_IDS.PRESTIGE]: '声望',
};

/** 场景中最大成员数量 */
export const MAX_VISIBLE_MEMBERS = 8;

/** 成员行走速度（像素/秒） */
export const MEMBER_WALK_SPEED = 25;

/** 飘字效果持续时间（毫秒） */
export const FLOATING_TEXT_DURATION = 1000;
