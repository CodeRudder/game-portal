/**
 * 恐龙牧场 (Dino Ranch) — 放置类游戏常量定义
 *
 * 核心玩法：
 * - 点击获得肉 (meat)
 * - 建设牧场建筑，自动产出资源
 * - 解锁不同品种恐龙，获得能力加成
 * - 恐龙进化升级系统
 * - 声望系统：重置进度获得远古基因，提供永久加成
 * - 离线收益
 */

/** Canvas 尺寸 */
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ========== 资源常量 ==========

/** 点击获得的肉数 */
export const MEAT_PER_CLICK = 1;

/** 声望加成系数（每远古基因增加的产出倍率） */
export const GENE_BONUS_MULTIPLIER = 0.15; // 15% per gene

/** 声望货币计算基数 */
export const PRESTIGE_BASE_GENES = 1;

/** 声望所需最低肉总量 */
export const PRESTIGE_MIN_TOTAL_MEAT = 5000;

// ========== 恐龙品种定义 ==========

export interface DinoBreedDef {
  id: string;
  name: string;
  icon: string;
  /** 解锁所需肉 */
  unlockCost: number;
  /** 能力类型 */
  bonusType: 'click' | 'production' | 'egg' | 'fossil' | 'gene_fragment' | 'all';
  /** 能力值（百分比加成，0.1 = 10%） */
  bonusValue: number;
  /** 描述 */
  description: string;
  /** 颜色（Canvas 绘制用） */
  color: string;
  /** 腹部颜色 */
  bellyColor: string;
  /** 进化加成倍率 */
  evolutionMultiplier: number;
}

/** 恐龙品种列表 */
export const DINO_BREEDS: DinoBreedDef[] = [
  {
    id: 'velociraptor',
    name: '迅猛龙',
    icon: '🦎',
    unlockCost: 0,
    bonusType: 'click',
    bonusValue: 0.1,
    description: '点击产肉 +10%',
    color: '#4A7C3F',
    bellyColor: '#8BC34A',
    evolutionMultiplier: 1.5,
  },
  {
    id: 'triceratops',
    name: '三角龙',
    icon: '🦕',
    unlockCost: 800,
    bonusType: 'production',
    bonusValue: 0.15,
    description: '所有产出 +15%',
    color: '#8B6914',
    bellyColor: '#D4A44C',
    evolutionMultiplier: 1.4,
  },
  {
    id: 'pterodactyl',
    name: '翼龙',
    icon: '🦅',
    unlockCost: 3000,
    bonusType: 'egg',
    bonusValue: 0.2,
    description: '恐龙蛋产出 +20%',
    color: '#5C6BC0',
    bellyColor: '#9FA8DA',
    evolutionMultiplier: 1.6,
  },
  {
    id: 'stegosaurus',
    name: '剑龙',
    icon: '🦎',
    unlockCost: 8000,
    bonusType: 'fossil',
    bonusValue: 0.2,
    description: '化石产出 +20%',
    color: '#E65100',
    bellyColor: '#FFB74D',
    evolutionMultiplier: 1.3,
  },
  {
    id: 'trex',
    name: '霸王龙',
    icon: '🦖',
    unlockCost: 25000,
    bonusType: 'production',
    bonusValue: 0.3,
    description: '所有产出 +30%',
    color: '#B71C1C',
    bellyColor: '#EF5350',
    evolutionMultiplier: 2.0,
  },
  {
    id: 'brontosaurus',
    name: '雷龙',
    icon: '🦕',
    unlockCost: 80000,
    bonusType: 'all',
    bonusValue: 0.25,
    description: '所有加成 +25%',
    color: '#2E7D32',
    bellyColor: '#66BB6A',
    evolutionMultiplier: 1.8,
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
    id: 'fence',
    name: '围栏',
    icon: '🏗️',
    baseCost: { meat: 15 },
    costMultiplier: 1.15,
    maxLevel: 50,
    productionResource: 'meat',
    baseProduction: 0.5,
  },
  {
    id: 'hatchery',
    name: '孵化室',
    icon: '🥚',
    baseCost: { meat: 120 },
    costMultiplier: 1.18,
    maxLevel: 30,
    productionResource: 'dino_eggs',
    baseProduction: 0.3,
    requires: ['fence'],
  },
  {
    id: 'feed_lot',
    name: '饲料场',
    icon: '🌾',
    baseCost: { meat: 600 },
    costMultiplier: 1.2,
    maxLevel: 30,
    productionResource: 'meat',
    baseProduction: 5,
    requires: ['fence'],
  },
  {
    id: 'gene_lab',
    name: '基因实验室',
    icon: '🔬',
    baseCost: { meat: 3000, dino_eggs: 20 },
    costMultiplier: 1.22,
    maxLevel: 20,
    productionResource: 'gene_fragments',
    baseProduction: 0.1,
    requires: ['hatchery', 'feed_lot'],
  },
  {
    id: 'fossil_museum',
    name: '化石博物馆',
    icon: '🦴',
    baseCost: { meat: 15000, dino_eggs: 100 },
    costMultiplier: 1.25,
    maxLevel: 15,
    productionResource: 'fossils',
    baseProduction: 0.2,
    requires: ['hatchery'],
  },
  {
    id: 'arena',
    name: '恐龙竞技场',
    icon: '🏟️',
    baseCost: { meat: 100000, fossils: 30 },
    costMultiplier: 1.3,
    maxLevel: 10,
    productionResource: 'gene_fragments',
    baseProduction: 0.5,
    requires: ['gene_lab', 'fossil_museum'],
  },
];

// ========== 颜色主题（像素复古风格：绿色/棕色/火山色调） ==========

export const COLORS = {
  bgGradient1: '#3E2723',
  bgGradient2: '#1B0F0A',
  groundLight: '#5D4037',
  groundDark: '#3E2723',
  skyTop: '#4A148C',
  skyBottom: '#880E4F',
  volcanoGlow: '#FF6F00',
  textPrimary: '#FFF8E1',
  textSecondary: '#D7CCC8',
  textDim: '#8D6E63',
  accent: '#FF6F00',
  accentGreen: '#76FF03',
  accentRed: '#FF1744',
  accentBlue: '#40C4FF',
  panelBg: 'rgba(62, 39, 35, 0.9)',
  panelBorder: 'rgba(255, 111, 0, 0.3)',
  selectedBg: 'rgba(255, 111, 0, 0.15)',
  selectedBorder: 'rgba(255, 111, 0, 0.6)',
  affordable: '#76FF03',
  unaffordable: '#FF1744',
  dinoShadow: 'rgba(0,0,0,0.3)',
  meatColor: '#E53935',
  eggColor: '#FFF9C4',
  fossilColor: '#BCAAA4',
  geneColor: '#7C4DFF',
  lavaColor: '#FF3D00',
} as const;

// ========== 渲染参数 ==========

export const DINO_DRAW = {
  centerX: 240,
  centerY: 200,
  bodyWidth: 60,
  bodyHeight: 40,
  headRadius: 25,
  eyeRadius: 4,
  tailLength: 35,
  legHeight: 15,
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
