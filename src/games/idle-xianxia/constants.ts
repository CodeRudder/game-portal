/**
 * 修仙放置 (Idle Xianxia) — 放置游戏常量 v2.0
 *
 * 基于统一子系统架构重建。使用 BuildingSystem + PrestigeSystem +
 * StageSystem(境界) + UnitSystem(仙友) + TechTreeSystem(功法)。
 */

import type { BuildingDef } from '@/engines/idle/modules/BuildingSystem';
import type { PrestigeConfig } from '@/engines/idle/modules/PrestigeSystem';
import type { UIColorScheme } from '@/engines/idle/modules/CanvasUIRenderer';
import type { StageDef } from '@/engines/idle/modules/StageSystem';
import type { TechDef } from '@/engines/idle/modules/TechTreeSystem';

// ═══════════════════════════════════════════════════════════════
// 游戏标识
// ═══════════════════════════════════════════════════════════════

export const GAME_ID = 'idle-xianxia';
export const GAME_TITLE = '修仙放置';

export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ═══════════════════════════════════════════════════════════════
// 建筑系统 (8个)
// ═══════════════════════════════════════════════════════════════

export const BUILDINGS: BuildingDef[] = [
  { id: 'qi_pool', name: '灵泉', icon: '🌿', baseCost: { qi: 10 }, costMultiplier: 1.07, maxLevel: 0, productionResource: 'qi', baseProduction: 0.1, unlockCondition: '初始' },
  { id: 'herb_garden', name: '灵草园', icon: '🌱', baseCost: { qi: 30 }, costMultiplier: 1.08, maxLevel: 0, productionResource: 'herb', baseProduction: 0.08, requires: ['qi_pool'], unlockCondition: '灵泉 Lv.1' },
  { id: 'pill_furnace', name: '炼丹炉', icon: '💊', baseCost: { qi: 50, herb: 20 }, costMultiplier: 1.09, maxLevel: 0, productionResource: 'pill', baseProduction: 0.06, requires: ['herb_garden'], unlockCondition: '灵草园 Lv.1' },
  { id: 'spirit_mine', name: '灵石矿', icon: '💎', baseCost: { herb: 60, qi: 40 }, costMultiplier: 1.10, maxLevel: 0, productionResource: 'stone', baseProduction: 0.04, requires: ['pill_furnace'], unlockCondition: '炼丹炉 Lv.1' },
  { id: 'scripture', name: '藏经阁', icon: '📚', baseCost: { stone: 200, herb: 100 }, costMultiplier: 1.12, maxLevel: 0, productionResource: 'qi', baseProduction: 0.10, requires: ['spirit_mine'], unlockCondition: '灵石矿 Lv.1' },
  { id: 'formation', name: '阵法台', icon: '⛩️', baseCost: { stone: 300, herb: 150 }, costMultiplier: 1.11, maxLevel: 0, productionResource: 'stone', baseProduction: 0.08, requires: ['scripture'], unlockCondition: '藏经阁 Lv.1' },
  { id: 'pagoda', name: '宝塔', icon: '🏛️', baseCost: { stone: 600, herb: 400, pill: 100 }, costMultiplier: 1.14, maxLevel: 0, productionResource: 'herb', baseProduction: 0.15, requires: ['formation'], unlockCondition: '阵法台 Lv.1' },
  { id: 'heaven_palace', name: '天宫', icon: '🏯', baseCost: { stone: 1500, herb: 1000, pill: 300 }, costMultiplier: 1.18, maxLevel: 0, productionResource: 'stone', baseProduction: 0.25, requires: ['pagoda'], unlockCondition: '宝塔 Lv.1' },
];

// ═══════════════════════════════════════════════════════════════
// 境界系统 → StageSystem (6个)
// ═══════════════════════════════════════════════════════════════

export const DYNASTIES: StageDef[] = [
  { id: 'qi_refining', name: '炼气', description: '感应灵气，踏入修仙门槛', order: 1, prerequisiteStageId: null, requiredResources: {}, requiredConditions: [], rewards: [], productionMultiplier: 1.0, combatMultiplier: 1.0, iconAsset: '💨', themeColor: '#7b68ee' },
  { id: 'foundation', name: '筑基', description: '筑就道基，根基稳固', order: 2, prerequisiteStageId: 'qi_refining', requiredResources: { qi: 500, herb: 200 }, requiredConditions: [], rewards: [], productionMultiplier: 1.3, combatMultiplier: 1.0, iconAsset: '🏗️', themeColor: '#9370db' },
  { id: 'golden_core', name: '金丹', description: '凝结金丹，实力飞跃', order: 3, prerequisiteStageId: 'foundation', requiredResources: { qi: 3000, herb: 1500, stone: 300 }, requiredConditions: [], rewards: [], productionMultiplier: 1.6, combatMultiplier: 1.0, iconAsset: '🔮', themeColor: '#ba55d3' },
  { id: 'nascent_soul', name: '元婴', description: '元婴出窍，神通初显', order: 4, prerequisiteStageId: 'golden_core', requiredResources: { qi: 15000, herb: 8000, stone: 2000, pill: 500 }, requiredConditions: [], rewards: [], productionMultiplier: 2.0, combatMultiplier: 1.0, iconAsset: '👶', themeColor: '#da70d6' },
  { id: 'tribulation', name: '渡劫', description: '渡天劫，超凡脱俗', order: 5, prerequisiteStageId: 'nascent_soul', requiredResources: { qi: 80000, herb: 40000, stone: 10000, pill: 3000 }, requiredConditions: [], rewards: [], productionMultiplier: 2.5, combatMultiplier: 1.0, iconAsset: '⚡', themeColor: '#ff6347' },
  { id: 'ascension', name: '飞升', description: '飞升仙界，得道成仙', order: 6, prerequisiteStageId: 'tribulation', requiredResources: { qi: 300000, herb: 150000, stone: 50000, pill: 15000 }, requiredConditions: [], rewards: [], productionMultiplier: 3.0, combatMultiplier: 1.0, iconAsset: '🌈', themeColor: '#ffd700' },
];

// ═══════════════════════════════════════════════════════════════
// 仙友系统 → UnitSystem (8个)
// ═══════════════════════════════════════════════════════════════

export interface HeroDef {
  id: string;
  name: string;
  title: string;
  rarity: string;
  baseStats: { administration: number; military: number; culture: number };
  growthRates: { administration: number; military: number; culture: number };
  recruitCost: { qi: number; herb: number };
  bonus: string;
}

const HERO_RARITY_GROWTH: Record<string, number> = { rare: 3.5, epic: 5, legendary: 7, mythic: 9 };
const HERO_RARITY_COST: Record<string, { qi: number; herb: number }> = {
  rare: { qi: 600, herb: 300 },
  epic: { qi: 2000, herb: 1000 },
  legendary: { qi: 8000, herb: 4000 },
  mythic: { qi: 20000, herb: 10000 },
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
  makeHero('wukong', '孙悟空', '齐天大圣', 'mythic', 80, 100, 70, '全部产出 +30%'),
  makeHero('taiyi', '太乙真人', '阐教金仙', 'legendary', 70, 60, 90, '丹药产出 +50%'),
  makeHero('guanyin', '观音大士', '大慈大悲', 'legendary', 60, 40, 95, '灵气产出 +50%'),
  makeHero('yuding', '玉鼎真人', '阐教金仙', 'epic', 65, 75, 60, '灵石产出 +30%'),
  makeHero('cihang', '慈航道人', '阐教弟子', 'epic', 55, 50, 80, '仙草产出 +30%'),
  makeHero('nezha', '哪吒', '三太子', 'epic', 50, 95, 45, '战斗产出 +40%'),
  makeHero('huanglong', '黄龙真人', '阐教弟子', 'rare', 45, 40, 65, '全部产出 +10%'),
  makeHero('zhenyuan', '镇元子', '地仙之祖', 'rare', 70, 30, 80, '灵草产出 +25%'),
];

// ═══════════════════════════════════════════════════════════════
// 功法系统 → TechTreeSystem (9项)
// ═══════════════════════════════════════════════════════════════

export const INVENTIONS: TechDef[] = [
  // 修炼路线
  { id: 'qi_gathering', name: '聚灵术', description: '灵气产出 +50%', requires: [], cost: { qi: 500 }, researchTime: 30000, tier: 1, icon: '💨', branch: 'cultivation', effects: [{ type: 'multiplier', target: 'qi', value: 1.5, description: '灵气产出 ×1.5' }] },
  { id: 'inner_alchemy', name: '内丹术', description: '灵气产出 ×2.0', requires: ['qi_gathering'], cost: { qi: 2000 }, researchTime: 60000, tier: 2, icon: '🔮', branch: 'cultivation', effects: [{ type: 'multiplier', target: 'qi', value: 2.0, description: '灵气产出 ×2.0' }] },
  { id: 'celestial_art', name: '天罡三十六变', description: '全部产出 ×2.0', requires: ['inner_alchemy'], cost: { qi: 8000, herb: 3000 }, researchTime: 120000, tier: 3, icon: '✨', branch: 'cultivation', effects: [{ type: 'multiplier', target: 'all_resources', value: 2.0, description: '全部产出 ×2.0' }] },
  // 炼丹路线
  { id: 'basic_alchemy', name: '基础炼丹', description: '丹药产出 +50%', requires: [], cost: { herb: 400 }, researchTime: 30000, tier: 1, icon: '⚗️', branch: 'alchemy', effects: [{ type: 'multiplier', target: 'pill', value: 1.5, description: '丹药产出 ×1.5' }] },
  { id: 'advanced_alchemy', name: '高级炼丹', description: '丹药产出 ×2.0', requires: ['basic_alchemy'], cost: { herb: 1500, pill: 200 }, researchTime: 60000, tier: 2, icon: '🧪', branch: 'alchemy', effects: [{ type: 'multiplier', target: 'pill', value: 2.0, description: '丹药产出 ×2.0' }] },
  { id: 'elixir_master', name: '丹道宗师', description: '全部产出 +30%', requires: ['advanced_alchemy'], cost: { herb: 5000, pill: 1000 }, researchTime: 120000, tier: 3, icon: '🌟', branch: 'alchemy', effects: [{ type: 'multiplier', target: 'all_resources', value: 1.3, description: '全部产出 +30%' }] },
  // 阵法路线
  { id: 'basic_formation', name: '基础阵法', description: '招募费用 -20%', requires: [], cost: { stone: 600 }, researchTime: 30000, tier: 1, icon: '🔷', branch: 'formation', effects: [{ type: 'modifier', target: 'recruit_cost', value: -0.2, description: '招募费用 -20%' }] },
  { id: 'advanced_formation', name: '高级阵法', description: '全部产出 ×1.5', requires: ['basic_formation'], cost: { stone: 3000, qi: 2000 }, researchTime: 90000, tier: 2, icon: '🔶', branch: 'formation', effects: [{ type: 'multiplier', target: 'all_resources', value: 1.5, description: '全部产出 ×1.5' }] },
  { id: 'heaven_formation', name: '天罡阵', description: '全部加成 ×2.0', requires: ['advanced_formation'], cost: { stone: 10000, qi: 8000, herb: 5000 }, researchTime: 150000, tier: 3, icon: '⭐', branch: 'formation', effects: [{ type: 'multiplier', target: 'all', value: 2.0, description: '全部加成 ×2.0' }] },
];

// ═══════════════════════════════════════════════════════════════
// 飞升配置
// ═══════════════════════════════════════════════════════════════

export const PRESTIGE_CONFIG: PrestigeConfig = {
  currencyName: '道果',
  currencyIcon: '🔮',
  base: 10,
  threshold: 15000,
  bonusMultiplier: 0.15,
  retention: 0.08,
};

// ═══════════════════════════════════════════════════════════════
// UI 色彩主题（仙侠蓝紫系）
// ═══════════════════════════════════════════════════════════════

export const COLOR_THEME: UIColorScheme = {
  bgGradient1: '#0a0a2e',
  bgGradient2: '#1a0a3e',
  textPrimary: '#e8e0f0',
  textSecondary: '#b8a8d8',
  textDim: '#706090',
  accentGold: '#7b68ee',
  accentGreen: '#6b8e23',
  panelBg: 'rgba(123,104,238,0.05)',
  selectedBg: 'rgba(123,104,238,0.1)',
  selectedBorder: 'rgba(123,104,238,0.4)',
  affordable: '#6b8e23',
  unaffordable: '#555555',
};

// ═══════════════════════════════════════════════════════════════
// 稀有度颜色
// ═══════════════════════════════════════════════════════════════

export const RARITY_COLORS: Record<string, string> = {
  rare: '#2196f3',
  epic: '#9c27b0',
  legendary: '#ff9800',
  mythic: '#e91e63',
};

// ═══════════════════════════════════════════════════════════════
// 资源定义
// ═══════════════════════════════════════════════════════════════

export const RESOURCES = [
  { id: 'qi', name: '灵气', icon: '🌿' },
  { id: 'herb', name: '仙草', icon: '🌱' },
  { id: 'pill', name: '丹药', icon: '💊' },
  { id: 'stone', name: '灵石', icon: '💎' },
];

export const INITIAL_RESOURCES: Record<string, number> = { qi: 50, herb: 0, pill: 0, stone: 0, dao_fruit: 0 };
export const INITIALLY_UNLOCKED: string[] = ['qi_pool'];
export const CLICK_REWARD = { qi: 1 };
