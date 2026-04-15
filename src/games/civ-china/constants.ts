/**
 * 四大文明·华夏 (Civ China) — 放置游戏常量 v2.0
 *
 * 基于统一子系统架构重建。使用 BuildingSystem + PrestigeSystem +
 * StageSystem(朝代) + UnitSystem(官员) + TechTreeSystem(发明)。
 */

import type { BuildingDef } from '@/engines/idle/modules/BuildingSystem';
import type { PrestigeConfig } from '@/engines/idle/modules/PrestigeSystem';
import type { UIColorScheme } from '@/engines/idle/modules/CanvasUIRenderer';
import type { StageDef } from '@/engines/idle/modules/StageSystem';
import type { TechDef } from '@/engines/idle/modules/TechTreeSystem';

// ═══════════════════════════════════════════════════════════════
// 游戏标识
// ═══════════════════════════════════════════════════════════════

export const GAME_ID = 'civ-china';
export const GAME_TITLE = '华夏文明';

export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ═══════════════════════════════════════════════════════════════
// 建筑系统 (8个)
// ═══════════════════════════════════════════════════════════════

export const BUILDINGS: BuildingDef[] = [
  { id: 'farm', name: '农田', icon: '🌾', baseCost: { food: 10 }, costMultiplier: 1.07, maxLevel: 0, productionResource: 'food', baseProduction: 0.1, unlockCondition: '初始' },
  { id: 'silk_workshop', name: '丝绸坊', icon: '🧵', baseCost: { food: 50 }, costMultiplier: 1.08, maxLevel: 0, productionResource: 'silk', baseProduction: 0.08, unlockCondition: '初始' },
  { id: 'academy', name: '书院', icon: '📚', baseCost: { food: 30, silk: 20 }, costMultiplier: 1.09, maxLevel: 0, productionResource: 'culture', baseProduction: 0.05, unlockCondition: '累计 100 粮食' },
  { id: 'great_wall', name: '长城', icon: '🏯', baseCost: { food: 100, silk: 50 }, costMultiplier: 1.12, maxLevel: 0, productionResource: 'food', baseProduction: 0.15, requires: ['farm'], unlockCondition: '农田 Lv.5' },
  { id: 'silk_road', name: '丝绸之路', icon: '🐪', baseCost: { silk: 200 }, costMultiplier: 1.10, maxLevel: 0, productionResource: 'silk', baseProduction: 0.2, requires: ['silk_workshop'], unlockCondition: '丝绸坊 Lv.5' },
  { id: 'imperial_palace', name: '皇宫', icon: '🏛️', baseCost: { food: 500, silk: 300, culture: 100 }, costMultiplier: 1.15, maxLevel: 0, productionResource: 'culture', baseProduction: 0.15, requires: ['academy'], unlockCondition: '书院 Lv.5' },
  { id: 'grand_canal', name: '大运河', icon: '🚢', baseCost: { food: 800, silk: 400 }, costMultiplier: 1.13, maxLevel: 0, productionResource: 'food', baseProduction: 0.25, requires: ['great_wall'], unlockCondition: '长城 Lv.3' },
  { id: 'forbidden_city', name: '紫禁城', icon: '🏯', baseCost: { food: 2000, silk: 1500, culture: 500 }, costMultiplier: 1.18, maxLevel: 0, productionResource: 'culture', baseProduction: 0.3, requires: ['imperial_palace'], unlockCondition: '皇宫 Lv.3' },
];

// ═══════════════════════════════════════════════════════════════
// 朝代系统 → StageSystem (6个)
// ═══════════════════════════════════════════════════════════════

export const DYNASTIES: StageDef[] = [
  { id: 'xia', name: '夏', description: '大禹治水，华夏初兴', order: 1, prerequisiteStageId: null, requiredResources: {}, requiredConditions: [], rewards: [], productionMultiplier: 1.0, combatMultiplier: 1.0, iconAsset: '🏺', themeColor: '#8b6914' },
  { id: 'shang', name: '商', description: '青铜时代，甲骨文始', order: 2, prerequisiteStageId: 'xia', requiredResources: { food: 500 }, requiredConditions: [], rewards: [], productionMultiplier: 1.2, combatMultiplier: 1.0, iconAsset: '🔔', themeColor: '#a0522d' },
  { id: 'zhou', name: '周', description: '礼乐文明，百家争鸣', order: 3, prerequisiteStageId: 'shang', requiredResources: { food: 3000, silk: 1000 }, requiredConditions: [], rewards: [], productionMultiplier: 1.5, combatMultiplier: 1.0, iconAsset: '📜', themeColor: '#b8860b' },
  { id: 'qin', name: '秦', description: '始皇统一，书同文车同轨', order: 4, prerequisiteStageId: 'zhou', requiredResources: { food: 10000, silk: 5000, culture: 2000 }, requiredConditions: [], rewards: [], productionMultiplier: 2.0, combatMultiplier: 1.0, iconAsset: '🗡️', themeColor: '#cd853f' },
  { id: 'tang', name: '唐', description: '盛世大唐，万邦来朝', order: 5, prerequisiteStageId: 'qin', requiredResources: { food: 50000, silk: 30000, culture: 10000 }, requiredConditions: [], rewards: [], productionMultiplier: 2.5, combatMultiplier: 1.0, iconAsset: '🏮', themeColor: '#daa520' },
  { id: 'song', name: '宋', description: '文化巅峰，科技领先', order: 6, prerequisiteStageId: 'tang', requiredResources: { food: 200000, silk: 100000, culture: 50000 }, requiredConditions: [], rewards: [], productionMultiplier: 3.0, combatMultiplier: 1.0, iconAsset: '🎨', themeColor: '#ffd700' },
];

// ═══════════════════════════════════════════════════════════════
// 官员系统 → UnitSystem (8个)
// ═══════════════════════════════════════════════════════════════

export interface OfficialDef {
  id: string;
  name: string;
  title: string;
  rarity: string;
  baseStats: { administration: number; military: number; culture: number };
  growthRates: { administration: number; military: number; culture: number };
  recruitCost: { food: number; silk: number };
  bonus: string;
}

const OFFICIAL_RARITY_GROWTH: Record<string, number> = { uncommon: 2, rare: 3.5, epic: 5, legendary: 7 };
const OFFICIAL_RARITY_COST: Record<string, { food: number; silk: number }> = {
  uncommon: { food: 200, silk: 100 },
  rare: { food: 600, silk: 300 },
  epic: { food: 2000, silk: 1000 },
  legendary: { food: 8000, silk: 4000 },
};

function makeOfficial(id: string, name: string, title: string, rarity: string, adm: number, mil: number, cul: number, bonus: string): OfficialDef {
  const g = OFFICIAL_RARITY_GROWTH[rarity];
  return {
    id, name, title, rarity,
    baseStats: { administration: adm, military: mil, culture: cul },
    growthRates: { administration: g, military: g, culture: g },
    recruitCost: OFFICIAL_RARITY_COST[rarity],
    bonus,
  };
}

export const OFFICIALS: OfficialDef[] = [
  makeOfficial('confucius', '孔子', '至圣先师', 'legendary', 70, 30, 95, '文化产出 +50%'),
  makeOfficial('laozi', '老子', '道家始祖', 'epic', 50, 20, 90, '全部产出 +15%'),
  makeOfficial('sunbin', '孙膑', '兵法大家', 'rare', 30, 90, 50, '粮食产出 +30%'),
  makeOfficial('shangyang', '商鞅', '变法先驱', 'epic', 90, 60, 40, '建筑费用 -10%'),
  makeOfficial('zhuge', '诸葛亮', '卧龙', 'legendary', 85, 80, 95, '全部产出 +25%'),
  makeOfficial('libai', '李白', '诗仙', 'rare', 20, 30, 95, '文化产出 +30%'),
  makeOfficial('sima', '司马迁', '太史令', 'uncommon', 60, 20, 80, '声望收益 +20%'),
  makeOfficial('mengzi', '孟子', '亚圣', 'rare', 65, 25, 85, '文化产出 +25%'),
];

// ═══════════════════════════════════════════════════════════════
// 发明系统 → TechTreeSystem (9项)
// ═══════════════════════════════════════════════════════════════

export const INVENTIONS: TechDef[] = [
  // 农业路线
  { id: 'irrigation', name: '灌溉术', description: '粮食产出 +50%', requires: [], cost: { food: 500 }, researchTime: 30000, tier: 1, icon: '💧', branch: 'agriculture', effects: [{ type: 'multiplier', target: 'food', value: 1.5, description: '粮食产出 ×1.5' }] },
  { id: 'plow', name: '铁犁牛耕', description: '粮食产出 ×2.0', requires: ['irrigation'], cost: { food: 2000 }, researchTime: 60000, tier: 2, icon: '🐂', branch: 'agriculture', effects: [{ type: 'multiplier', target: 'food', value: 2.0, description: '粮食产出 ×2.0' }] },
  { id: 'printing', name: '活字印刷', description: '文化产出 ×2.0', requires: ['plow'], cost: { culture: 3000 }, researchTime: 120000, tier: 3, icon: '📖', branch: 'agriculture', effects: [{ type: 'multiplier', target: 'culture', value: 2.0, description: '文化产出 ×2.0' }] },
  // 工艺路线
  { id: 'sericulture', name: '养蚕术', description: '丝绸产出 +50%', requires: [], cost: { silk: 400 }, researchTime: 30000, tier: 1, icon: '🐛', branch: 'craft', effects: [{ type: 'multiplier', target: 'silk', value: 1.5, description: '丝绸产出 ×1.5' }] },
  { id: 'porcelain', name: '瓷器烧制', description: '丝绸产出 ×2.0', requires: ['sericulture'], cost: { silk: 1500 }, researchTime: 60000, tier: 2, icon: '🏺', branch: 'craft', effects: [{ type: 'multiplier', target: 'silk', value: 2.0, description: '丝绸产出 ×2.0' }] },
  { id: 'compass', name: '指南针', description: '全部产出 +30%', requires: ['porcelain'], cost: { silk: 5000, culture: 2000 }, researchTime: 120000, tier: 3, icon: '🧭', branch: 'craft', effects: [{ type: 'multiplier', target: 'all_resources', value: 1.3, description: '全部产出 +30%' }] },
  // 治国路线
  { id: 'civil_service', name: '科举制', description: '招募费用 -20%', requires: [], cost: { culture: 600 }, researchTime: 30000, tier: 1, icon: '📝', branch: 'governance', effects: [{ type: 'modifier', target: 'recruit_cost', value: -0.2, description: '招募费用 -20%' }] },
  { id: 'gunpowder', name: '火药', description: '全部产出 ×1.5', requires: ['civil_service'], cost: { food: 3000, silk: 2000 }, researchTime: 90000, tier: 2, icon: '💥', branch: 'governance', effects: [{ type: 'multiplier', target: 'all_resources', value: 1.5, description: '全部产出 ×1.5' }] },
  { id: 'paper', name: '造纸术', description: '全部加成 ×2.0', requires: ['gunpowder'], cost: { culture: 8000, food: 5000 }, researchTime: 150000, tier: 3, icon: '📜', branch: 'governance', effects: [{ type: 'multiplier', target: 'all', value: 2.0, description: '全部加成 ×2.0' }] },
];

// ═══════════════════════════════════════════════════════════════
// 声望配置
// ═══════════════════════════════════════════════════════════════

export const PRESTIGE_CONFIG: PrestigeConfig = {
  currencyName: '天命',
  currencyIcon: '👑',
  base: 10,
  threshold: 10000,
  bonusMultiplier: 0.15,
  retention: 0.1,
};

// ═══════════════════════════════════════════════════════════════
// UI 色彩主题（华夏古风：墨绿+金色+米白）
// ═══════════════════════════════════════════════════════════════

export const COLOR_THEME: UIColorScheme = {
  bgGradient1: '#0a1a0a',
  bgGradient2: '#1b2d1b',
  textPrimary: '#f5f0e8',
  textSecondary: '#c4b99a',
  textDim: '#7a7060',
  accentGold: '#daa520',
  accentGreen: '#6b8e23',
  panelBg: 'rgba(218,165,32,0.05)',
  selectedBg: 'rgba(218,165,32,0.1)',
  selectedBorder: 'rgba(218,165,32,0.4)',
  affordable: '#6b8e23',
  unaffordable: '#555555',
};

// ═══════════════════════════════════════════════════════════════
// 稀有度颜色
// ═══════════════════════════════════════════════════════════════

export const RARITY_COLORS: Record<string, string> = {
  uncommon: '#4caf50',
  rare: '#2196f3',
  epic: '#9c27b0',
  legendary: '#ff9800',
};

// ═══════════════════════════════════════════════════════════════
// 资源定义
// ═══════════════════════════════════════════════════════════════

export const RESOURCES = [
  { id: 'food', name: '粮食', icon: '🌾' },
  { id: 'silk', name: '丝绸', icon: '🧵' },
  { id: 'culture', name: '文化', icon: '📜' },
  { id: 'mandate', name: '天命', icon: '👑' },
];

export const INITIAL_RESOURCES: Record<string, number> = { food: 50, silk: 0, culture: 0, mandate: 0 };
export const INITIALLY_UNLOCKED: string[] = ['farm', 'silk_workshop'];
export const CLICK_REWARD = { food: 1 };
