/**
 * 四大文明·印度 (Civ India) — 放置游戏常量 v2.0
 *
 * 基于统一子系统架构重建。使用 BuildingSystem + PrestigeSystem +
 * StageSystem(时代) + UnitSystem(英雄) + TechTreeSystem(发明)。
 */

import type { BuildingDef } from '@/engines/idle/modules/BuildingSystem';
import type { PrestigeConfig } from '@/engines/idle/modules/PrestigeSystem';
import type { UIColorScheme } from '@/engines/idle/modules/CanvasUIRenderer';
import type { StageDef } from '@/engines/idle/modules/StageSystem';
import type { TechDef } from '@/engines/idle/modules/TechTreeSystem';

// ═══════════════════════════════════════════════════════════════
// 游戏标识
// ═══════════════════════════════════════════════════════════════

export const GAME_ID = 'civ-india';
export const GAME_TITLE = '印度文明';

export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ═══════════════════════════════════════════════════════════════
// 建筑系统 (8个)
// ═══════════════════════════════════════════════════════════════

export const BUILDINGS: BuildingDef[] = [
  { id: 'rice_paddy', name: '稻田', icon: '🍚', baseCost: { rice: 10 }, costMultiplier: 1.07, maxLevel: 0, productionResource: 'rice', baseProduction: 0.1, unlockCondition: '初始' },
  { id: 'spice_garden', name: '香料园', icon: '🌶️', baseCost: { rice: 30 }, costMultiplier: 1.08, maxLevel: 0, productionResource: 'spice', baseProduction: 0.08, requires: ['rice_paddy'], unlockCondition: '稻田 Lv.1' },
  { id: 'gem_mine', name: '宝石矿', icon: '💎', baseCost: { rice: 50, spice: 20 }, costMultiplier: 1.09, maxLevel: 0, productionResource: 'gem', baseProduction: 0.06, requires: ['spice_garden'], unlockCondition: '香料园 Lv.1' },
  { id: 'bazaar', name: '集市', icon: '💰', baseCost: { spice: 60, rice: 40 }, costMultiplier: 1.10, maxLevel: 0, productionResource: 'gold', baseProduction: 0.04, requires: ['gem_mine'], unlockCondition: '宝石矿 Lv.1' },
  { id: 'temple', name: '神庙', icon: '⛩️', baseCost: { gold: 200, gem: 100 }, costMultiplier: 1.12, maxLevel: 0, productionResource: 'spice', baseProduction: 0.10, requires: ['bazaar'], unlockCondition: '集市 Lv.1' },
  { id: 'university', name: '那烂陀大学', icon: '📚', baseCost: { gold: 300, gem: 150 }, costMultiplier: 1.11, maxLevel: 0, productionResource: 'gold', baseProduction: 0.08, requires: ['temple'], unlockCondition: '神庙 Lv.1' },
  { id: 'taj_mahal', name: '泰姬陵', icon: '🕌', baseCost: { gold: 600, gem: 400, spice: 100 }, costMultiplier: 1.14, maxLevel: 0, productionResource: 'rice', baseProduction: 0.15, requires: ['university'], unlockCondition: '那烂陀大学 Lv.1' },
  { id: 'ashoka_pillar', name: '阿育王柱', icon: '🏛️', baseCost: { gold: 1500, gem: 1000, spice: 300 }, costMultiplier: 1.18, maxLevel: 0, productionResource: 'gold', baseProduction: 0.25, requires: ['taj_mahal'], unlockCondition: '泰姬陵 Lv.1' },
];

// ═══════════════════════════════════════════════════════════════
// 时代系统 → StageSystem (6个)
// ═══════════════════════════════════════════════════════════════

export const DYNASTIES: StageDef[] = [
  { id: 'indus_valley', name: '印度河', description: '哈拉帕文明，印度河畔的曙光', order: 1, prerequisiteStageId: null, requiredResources: {}, requiredConditions: [], rewards: [], productionMultiplier: 1.0, combatMultiplier: 1.0, iconAsset: '🏺', themeColor: '#a0522d' },
  { id: 'vedic', name: '吠陀', description: '吠陀经典，婆罗门教兴起', order: 2, prerequisiteStageId: 'indus_valley', requiredResources: { rice: 500, spice: 200 }, requiredConditions: [], rewards: [], productionMultiplier: 1.3, combatMultiplier: 1.0, iconAsset: '📿', themeColor: '#b8860b' },
  { id: 'maurya', name: '孔雀', description: '阿育王统一，佛法远播', order: 3, prerequisiteStageId: 'vedic', requiredResources: { rice: 3000, spice: 1500, gem: 300 }, requiredConditions: [], rewards: [], productionMultiplier: 1.6, combatMultiplier: 1.0, iconAsset: '🦁', themeColor: '#cd853f' },
  { id: 'gupta', name: '笈多', description: '黄金时代，科学艺术鼎盛', order: 4, prerequisiteStageId: 'maurya', requiredResources: { rice: 15000, spice: 8000, gem: 2000, gold: 500 }, requiredConditions: [], rewards: [], productionMultiplier: 2.0, combatMultiplier: 1.0, iconAsset: '💎', themeColor: '#daa520' },
  { id: 'mughal', name: '莫卧儿', description: '泰姬陵耸立，帝国辉煌', order: 5, prerequisiteStageId: 'gupta', requiredResources: { rice: 80000, spice: 40000, gem: 10000, gold: 3000 }, requiredConditions: [], rewards: [], productionMultiplier: 2.5, combatMultiplier: 1.0, iconAsset: '🕌', themeColor: '#e8a040' },
  { id: 'modern', name: '现代', description: '新兴大国，科技腾飞', order: 6, prerequisiteStageId: 'mughal', requiredResources: { rice: 300000, spice: 150000, gem: 50000, gold: 15000 }, requiredConditions: [], rewards: [], productionMultiplier: 3.0, combatMultiplier: 1.0, iconAsset: '🚀', themeColor: '#ffd700' },
];

// ═══════════════════════════════════════════════════════════════
// 英雄系统 → UnitSystem (8个)
// ═══════════════════════════════════════════════════════════════

export interface HeroDef {
  id: string;
  name: string;
  title: string;
  rarity: string;
  baseStats: { administration: number; military: number; culture: number };
  growthRates: { administration: number; military: number; culture: number };
  recruitCost: { rice: number; spice: number };
  bonus: string;
}

const HERO_RARITY_GROWTH: Record<string, number> = { uncommon: 2, rare: 3.5, epic: 5, legendary: 7 };
const HERO_RARITY_COST: Record<string, { rice: number; spice: number }> = {
  uncommon: { rice: 200, spice: 100 },
  rare: { rice: 600, spice: 300 },
  epic: { rice: 2000, spice: 1000 },
  legendary: { rice: 8000, spice: 4000 },
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
  makeHero('ashoka', '阿育王', '伟大的转轮圣王', 'legendary', 90, 85, 80, '全部产出 +25%'),
  makeHero('chandragupta', '旃陀罗笈多', '孔雀帝国缔造者', 'legendary', 85, 90, 60, '军事产出 +40%'),
  makeHero('akbar', '阿克巴大帝', '莫卧儿明君', 'epic', 80, 70, 75, '全部产出 +15%'),
  makeHero('ramanuja', '罗摩奴阇', '吠檀多哲学大师', 'epic', 50, 30, 90, '文化产出 +35%'),
  makeHero('chanakya', '考底利耶', '政事论作者', 'rare', 95, 60, 70, '建筑费用 -10%'),
  makeHero('kalidasa', '迦梨陀娑', '梵文诗圣', 'rare', 30, 20, 95, '文化产出 +30%'),
  makeHero('aryabhata', '阿耶波多', '数学天文学家', 'uncommon', 70, 25, 85, '科技速度 +20%'),
  makeHero('buddha', '佛陀', '觉悟者', 'uncommon', 60, 20, 90, '业力收益 +20%'),
];

// ═══════════════════════════════════════════════════════════════
// 发明系统 → TechTreeSystem (9项)
// ═══════════════════════════════════════════════════════════════

export const INVENTIONS: TechDef[] = [
  // 农业路线
  { id: 'stepwell', name: '阶梯井', description: '稻米产出 +50%', requires: [], cost: { rice: 500 }, researchTime: 30000, tier: 1, icon: '🪣', branch: 'agriculture', effects: [{ type: 'multiplier', target: 'rice', value: 1.5, description: '稻米产出 ×1.5' }] },
  { id: 'spice_trade_route', name: '香料贸易路', description: '香料产出 ×2.0', requires: ['stepwell'], cost: { rice: 2000 }, researchTime: 60000, tier: 2, icon: '🐪', branch: 'agriculture', effects: [{ type: 'multiplier', target: 'spice', value: 2.0, description: '香料产出 ×2.0' }] },
  { id: 'cotton_gin', name: '轧棉术', description: '全部产出 ×1.5', requires: ['spice_trade_route'], cost: { spice: 3000 }, researchTime: 120000, tier: 3, icon: '🧶', branch: 'agriculture', effects: [{ type: 'multiplier', target: 'all_resources', value: 1.5, description: '全部产出 ×1.5' }] },
  // 商业路线
  { id: 'gem_cutting', name: '宝石切割', description: '宝石产出 +50%', requires: [], cost: { gem: 400 }, researchTime: 30000, tier: 1, icon: '💎', branch: 'commerce', effects: [{ type: 'multiplier', target: 'gem', value: 1.5, description: '宝石产出 ×1.5' }] },
  { id: 'decimal_system', name: '十进制', description: '黄金产出 ×2.0', requires: ['gem_cutting'], cost: { gem: 1500 }, researchTime: 60000, tier: 2, icon: '🔢', branch: 'commerce', effects: [{ type: 'multiplier', target: 'gold', value: 2.0, description: '黄金产出 ×2.0' }] },
  { id: 'zero_concept', name: '零的发明', description: '全部产出 +30%', requires: ['decimal_system'], cost: { gem: 5000, gold: 2000 }, researchTime: 120000, tier: 3, icon: '0️⃣', branch: 'commerce', effects: [{ type: 'multiplier', target: 'all_resources', value: 1.3, description: '全部产出 +30%' }] },
  // 精神路线
  { id: 'meditation', name: '冥想术', description: '招募费用 -20%', requires: [], cost: { spice: 600 }, researchTime: 30000, tier: 1, icon: '🧘', branch: 'spirituality', effects: [{ type: 'modifier', target: 'recruit_cost', value: -0.2, description: '招募费用 -20%' }] },
  { id: 'yoga', name: '瑜伽', description: '全部产出 ×1.5', requires: ['meditation'], cost: { rice: 3000, spice: 2000 }, researchTime: 90000, tier: 2, icon: '🙏', branch: 'spirituality', effects: [{ type: 'multiplier', target: 'all_resources', value: 1.5, description: '全部产出 ×1.5' }] },
  { id: 'nirvana', name: '涅槃', description: '全部加成 ×2.0', requires: ['yoga'], cost: { spice: 8000, rice: 5000 }, researchTime: 150000, tier: 3, icon: '☸️', branch: 'spirituality', effects: [{ type: 'multiplier', target: 'all', value: 2.0, description: '全部加成 ×2.0' }] },
];

// ═══════════════════════════════════════════════════════════════
// 业力（声望）配置
// ═══════════════════════════════════════════════════════════════

export const PRESTIGE_CONFIG: PrestigeConfig = {
  currencyName: '业力',
  currencyIcon: '🕉️',
  base: 10,
  threshold: 13000,
  bonusMultiplier: 0.13,
  retention: 0.1,
};

// ═══════════════════════════════════════════════════════════════
// UI 色彩主题（印度暖色系：深棕+橙金+米白）
// ═══════════════════════════════════════════════════════════════

export const COLOR_THEME: UIColorScheme = {
  bgGradient1: '#1a0a00',
  bgGradient2: '#2d1508',
  textPrimary: '#f5f0e8',
  textSecondary: '#c4a882',
  textDim: '#7a6050',
  accentGold: '#e8a040',
  accentGreen: '#8b8e23',
  panelBg: 'rgba(232,160,64,0.05)',
  selectedBg: 'rgba(232,160,64,0.1)',
  selectedBorder: 'rgba(232,160,64,0.4)',
  affordable: '#8b8e23',
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
  { id: 'rice', name: '稻米', icon: '🍚' },
  { id: 'spice', name: '香料', icon: '🌶️' },
  { id: 'gem', name: '宝石', icon: '💎' },
  { id: 'gold', name: '黄金', icon: '💰' },
];

export const INITIAL_RESOURCES: Record<string, number> = { rice: 50, spice: 0, gem: 0, gold: 0, karma: 0 };
export const INITIALLY_UNLOCKED: string[] = ['rice_paddy'];
export const CLICK_REWARD = { rice: 1 };
