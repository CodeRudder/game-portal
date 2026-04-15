/**
 * 家族传说 (Clan Saga) — 放置游戏常量 v2.0
 *
 * 基于统一子系统架构重建。使用 BuildingSystem + PrestigeSystem +
 * StageSystem(家族阶段) + UnitSystem(族人) + TechTreeSystem(传承)。
 */

import type { BuildingDef } from '@/engines/idle/modules/BuildingSystem';
import type { PrestigeConfig } from '@/engines/idle/modules/PrestigeSystem';
import type { UIColorScheme } from '@/engines/idle/modules/CanvasUIRenderer';
import type { StageDef } from '@/engines/idle/modules/StageSystem';
import type { TechDef } from '@/engines/idle/modules/TechTreeSystem';

// ═══════════════════════════════════════════════════════════════
// 游戏标识
// ═══════════════════════════════════════════════════════════════

export const GAME_ID = 'clan-saga';
export const GAME_TITLE = '家族传说';

export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ═══════════════════════════════════════════════════════════════
// 建筑系统 (8个)
// ═══════════════════════════════════════════════════════════════

export const BUILDINGS: BuildingDef[] = [
  { id: 'farm', name: '灵田', icon: '🌾', baseCost: { grain: 10 }, costMultiplier: 1.07, maxLevel: 0, productionResource: 'grain', baseProduction: 0.1, unlockCondition: '初始' },
  { id: 'workshop', name: '织造坊', icon: '🧵', baseCost: { grain: 30 }, costMultiplier: 1.08, maxLevel: 0, productionResource: 'silk', baseProduction: 0.08, requires: ['farm'], unlockCondition: '灵田 Lv.1' },
  { id: 'mine', name: '灵石矿', icon: '💎', baseCost: { grain: 50, silk: 20 }, costMultiplier: 1.09, maxLevel: 0, productionResource: 'stone', baseProduction: 0.06, requires: ['workshop'], unlockCondition: '织造坊 Lv.1' },
  { id: 'shrine', name: '祖祠', icon: '⛩️', baseCost: { silk: 60, stone: 40 }, costMultiplier: 1.10, maxLevel: 0, productionResource: 'prestige', baseProduction: 0.04, requires: ['mine'], unlockCondition: '灵石矿 Lv.1' },
  { id: 'school', name: '族学', icon: '📚', baseCost: { stone: 200, silk: 100 }, costMultiplier: 1.12, maxLevel: 0, productionResource: 'grain', baseProduction: 0.10, requires: ['shrine'], unlockCondition: '祖祠 Lv.1' },
  { id: 'treasury', name: '宝库', icon: '🏦', baseCost: { stone: 300, prestige: 150 }, costMultiplier: 1.11, maxLevel: 0, productionResource: 'silk', baseProduction: 0.08, requires: ['school'], unlockCondition: '族学 Lv.1' },
  { id: 'mansion', name: '府邸', icon: '🏠', baseCost: { stone: 600, silk: 400, prestige: 100 }, costMultiplier: 1.14, maxLevel: 0, productionResource: 'stone', baseProduction: 0.15, requires: ['treasury'], unlockCondition: '宝库 Lv.1' },
  { id: 'palace', name: '宗祠大殿', icon: '🏯', baseCost: { stone: 1500, silk: 1000, prestige: 300 }, costMultiplier: 1.18, maxLevel: 0, productionResource: 'prestige', baseProduction: 0.25, requires: ['mansion'], unlockCondition: '府邸 Lv.1' },
];

// ═══════════════════════════════════════════════════════════════
// 家族阶段系统 → StageSystem (6个)
// ═══════════════════════════════════════════════════════════════

export const DYNASTIES: StageDef[] = [
  { id: 'small_clan', name: '小族', description: '初兴家族，聚族而居', order: 1, prerequisiteStageId: null, requiredResources: {}, requiredConditions: [], rewards: [], productionMultiplier: 1.0, combatMultiplier: 1.0, iconAsset: '🏠', themeColor: '#8b6914' },
  { id: 'growing_clan', name: '望族', description: '声名渐起，人丁兴旺', order: 2, prerequisiteStageId: 'small_clan', requiredResources: { grain: 500, silk: 200 }, requiredConditions: [], rewards: [], productionMultiplier: 1.3, combatMultiplier: 1.0, iconAsset: '🏘️', themeColor: '#a0522d' },
  { id: 'noble', name: '名门', description: '名门望族，世代簪缨', order: 3, prerequisiteStageId: 'growing_clan', requiredResources: { grain: 3000, silk: 1500, stone: 300 }, requiredConditions: [], rewards: [], productionMultiplier: 1.6, combatMultiplier: 1.0, iconAsset: '🏯', themeColor: '#b8860b' },
  { id: 'aristocrat', name: '世家', description: '世家大族，权倾一方', order: 4, prerequisiteStageId: 'noble', requiredResources: { grain: 15000, silk: 8000, stone: 2000, prestige: 500 }, requiredConditions: [], rewards: [], productionMultiplier: 2.0, combatMultiplier: 1.0, iconAsset: '🏛️', themeColor: '#cd853f' },
  { id: 'great_clan', name: '大族', description: '一方豪族，门生故吏遍布', order: 5, prerequisiteStageId: 'aristocrat', requiredResources: { grain: 80000, silk: 40000, stone: 10000, prestige: 3000 }, requiredConditions: [], rewards: [], productionMultiplier: 2.5, combatMultiplier: 1.0, iconAsset: '🏰', themeColor: '#daa520' },
  { id: 'holy_clan', name: '圣族', description: '圣族降临，万世不朽', order: 6, prerequisiteStageId: 'great_clan', requiredResources: { grain: 300000, silk: 150000, stone: 50000, prestige: 15000 }, requiredConditions: [], rewards: [], productionMultiplier: 3.0, combatMultiplier: 1.0, iconAsset: '✨', themeColor: '#ffd700' },
];

// ═══════════════════════════════════════════════════════════════
// 族人系统 → UnitSystem (8个)
// ═══════════════════════════════════════════════════════════════

export interface HeroDef {
  id: string;
  name: string;
  title: string;
  rarity: string;
  baseStats: { administration: number; military: number; culture: number };
  growthRates: { administration: number; military: number; culture: number };
  recruitCost: { grain: number; silk: number };
  bonus: string;
}

const HERO_RARITY_GROWTH: Record<string, number> = { uncommon: 2, rare: 3.5, epic: 5, legendary: 7 };
const HERO_RARITY_COST: Record<string, { grain: number; silk: number }> = {
  uncommon: { grain: 200, silk: 100 },
  rare: { grain: 600, silk: 300 },
  epic: { grain: 2000, silk: 1000 },
  legendary: { grain: 8000, silk: 4000 },
};

function makeHero(id: string, name: string, title: string, rarity: string, adm: number, mil: number, cul: number, bonus: string): HeroDef {
  const g = HERO_RARITY_GROWTH[rarity];
  return {
    id, name, title, rarity,
    baseStats: { administration: adm, military: mil, culture: cul },
    growthRates: { administration: g, military: g, culture: g },
    recruitCost: HERO_RARITY_COST[rarity],
    bonus,
  };
}

export const HEROES: HeroDef[] = [
  makeHero('clan_head', '族长', '一族之主', 'legendary', 80, 70, 90, '全部产出 +30%'),
  makeHero('elder', '大长老', '德高望重', 'epic', 75, 40, 80, '粮食产出 +25%'),
  makeHero('prodigy', '天才', '天资聪颖', 'rare', 50, 60, 70, '文化产出 +30%'),
  makeHero('matriarch', '族母', '慈爱持家', 'epic', 60, 30, 85, '丝绸产出 +25%'),
  makeHero('general', '武将', '勇冠三军', 'rare', 30, 95, 40, '灵石产出 +30%'),
  makeHero('scholar', '学士', '博学多才', 'uncommon', 55, 20, 75, '威望产出 +20%'),
  makeHero('alchemist', '炼药师', '丹道宗师', 'uncommon', 40, 35, 65, '建筑费用 -10%'),
  makeHero('artisan', '工匠', '巧夺天工', 'uncommon', 45, 50, 55, '全部产出 +10%'),
];

// ═══════════════════════════════════════════════════════════════
// 传承系统 → TechTreeSystem (9项)
// ═══════════════════════════════════════════════════════════════

export const INVENTIONS: TechDef[] = [
  // 农业路线 (agriculture)
  { id: 'seed_selection', name: '选种术', description: '粮食产出 +50%', requires: [], cost: { grain: 500 }, researchTime: 30000, tier: 1, icon: '🌱', branch: 'agriculture', effects: [{ type: 'multiplier', target: 'grain', value: 1.5, description: '粮食产出 ×1.5' }] },
  { id: 'crop_rotation', name: '轮作制', description: '粮食产出 ×2.0', requires: ['seed_selection'], cost: { grain: 2000 }, researchTime: 60000, tier: 2, icon: '🌾', branch: 'agriculture', effects: [{ type: 'multiplier', target: 'grain', value: 2.0, description: '粮食产出 ×2.0' }] },
  { id: 'spirit_farming', name: '灵植术', description: '全部产出 ×1.5', requires: ['crop_rotation'], cost: { grain: 5000, stone: 2000 }, researchTime: 120000, tier: 3, icon: '🌿', branch: 'agriculture', effects: [{ type: 'multiplier', target: 'all_resources', value: 1.5, description: '全部产出 ×1.5' }] },
  // 商业路线 (commerce)
  { id: 'trade_route', name: '商道路', description: '丝绸产出 +50%', requires: [], cost: { silk: 400 }, researchTime: 30000, tier: 1, icon: '🛤️', branch: 'commerce', effects: [{ type: 'multiplier', target: 'silk', value: 1.5, description: '丝绸产出 ×1.5' }] },
  { id: 'weaving_art', name: '织造术', description: '丝绸产出 ×2.0', requires: ['trade_route'], cost: { silk: 1500 }, researchTime: 60000, tier: 2, icon: '🧵', branch: 'commerce', effects: [{ type: 'multiplier', target: 'silk', value: 2.0, description: '丝绸产出 ×2.0' }] },
  { id: 'silk_road', name: '灵路贸易', description: '全部产出 +30%', requires: ['weaving_art'], cost: { silk: 5000, prestige: 2000 }, researchTime: 120000, tier: 3, icon: '🐪', branch: 'commerce', effects: [{ type: 'multiplier', target: 'all_resources', value: 1.3, description: '全部产出 +30%' }] },
  // 修炼路线 (cultivation)
  { id: 'meditation', name: '冥想术', description: '灵石产出 +50%', requires: [], cost: { stone: 600 }, researchTime: 30000, tier: 1, icon: '🧘', branch: 'cultivation', effects: [{ type: 'multiplier', target: 'stone', value: 1.5, description: '灵石产出 ×1.5' }] },
  { id: 'alchemy', name: '炼丹术', description: '全部产出 ×1.5', requires: ['meditation'], cost: { stone: 3000, grain: 2000 }, researchTime: 90000, tier: 2, icon: '⚗️', branch: 'cultivation', effects: [{ type: 'multiplier', target: 'all_resources', value: 1.5, description: '全部产出 ×1.5' }] },
  { id: 'ascension', name: '飞升术', description: '全部加成 ×2.0', requires: ['alchemy'], cost: { stone: 8000, prestige: 5000 }, researchTime: 150000, tier: 3, icon: '🌟', branch: 'cultivation', effects: [{ type: 'multiplier', target: 'all', value: 2.0, description: '全部加成 ×2.0' }] },
];

// ═══════════════════════════════════════════════════════════════
// 血脉（声望）配置
// ═══════════════════════════════════════════════════════════════

export const PRESTIGE_CONFIG: PrestigeConfig = {
  currencyName: '血脉',
  currencyIcon: '🩸',
  base: 10,
  threshold: 13000,
  bonusMultiplier: 0.13,
  retention: 0.1,
};

// ═══════════════════════════════════════════════════════════════
// UI 色彩主题（古典红金系）
// ═══════════════════════════════════════════════════════════════

export const COLOR_THEME: UIColorScheme = {
  bgGradient1: '#1a0505',
  bgGradient2: '#2a0a0a',
  textPrimary: '#f5e6d0',
  textSecondary: '#c4a882',
  textDim: '#7a6050',
  accentGold: '#c0392b',
  accentGreen: '#6b8e23',
  panelBg: 'rgba(192,57,43,0.05)',
  selectedBg: 'rgba(192,57,43,0.1)',
  selectedBorder: 'rgba(192,57,43,0.4)',
  affordable: '#6b8e23',
  unaffordable: '#555555',
};

// ═══════════════════════════════════════════════════════════════
// 稀有度颜色
// ═══════════════════════════════════════════════════════════════

export const RARITY_COLORS: Record<string, string> = {
  rare: '#3498db',
  epic: '#9b59b6',
  legendary: '#f39c12',
  mythic: '#e74c3c',
};

// ═══════════════════════════════════════════════════════════════
// 资源定义
// ═══════════════════════════════════════════════════════════════

export const RESOURCES = [
  { id: 'grain', name: '粮食', icon: '🌾' },
  { id: 'silk', name: '丝绸', icon: '🧵' },
  { id: 'stone', name: '灵石', icon: '💎' },
  { id: 'prestige', name: '威望', icon: '👑' },
];

export const INITIAL_RESOURCES: Record<string, number> = { grain: 50, silk: 0, stone: 0, prestige: 0 };
export const INITIALLY_UNLOCKED: string[] = ['farm'];
export const CLICK_REWARD = { grain: 1 };
