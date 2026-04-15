/**
 * 四大文明·古埃及 (Civ Egypt) — 放置游戏常量 v2.0
 *
 * 基于统一子系统架构重建。使用 BuildingSystem + PrestigeSystem +
 * StageSystem(时代) + UnitSystem(神明) + TechTreeSystem(发明)。
 */

import type { BuildingDef } from '@/engines/idle/modules/BuildingSystem';
import type { PrestigeConfig } from '@/engines/idle/modules/PrestigeSystem';
import type { UIColorScheme } from '@/engines/idle/modules/CanvasUIRenderer';
import type { StageDef } from '@/engines/idle/modules/StageSystem';
import type { TechDef } from '@/engines/idle/modules/TechTreeSystem';

// ═══════════════════════════════════════════════════════════════
// 游戏标识
// ═══════════════════════════════════════════════════════════════

export const GAME_ID = 'civ-egypt';
export const GAME_TITLE = '古埃及文明';

export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ═══════════════════════════════════════════════════════════════
// 建筑系统 (8个)
// ═══════════════════════════════════════════════════════════════

export const BUILDINGS: BuildingDef[] = [
  { id: 'farm', name: '农田', icon: '🌾', baseCost: { grain: 10 }, costMultiplier: 1.07, maxLevel: 0, productionResource: 'grain', baseProduction: 0.1, unlockCondition: '初始' },
  { id: 'quarry', name: '采石场', icon: '🪨', baseCost: { grain: 50 }, costMultiplier: 1.08, maxLevel: 0, productionResource: 'stone', baseProduction: 0.08, unlockCondition: '初始' },
  { id: 'papyrus_field', name: '纸莎草田', icon: '📜', baseCost: { grain: 30, stone: 20 }, costMultiplier: 1.09, maxLevel: 0, productionResource: 'papyrus', baseProduction: 0.05, unlockCondition: '累计 100 谷物' },
  { id: 'gold_mine', name: '金矿', icon: '💰', baseCost: { grain: 100, stone: 50 }, costMultiplier: 1.12, maxLevel: 0, productionResource: 'gold', baseProduction: 0.15, requires: ['farm'], unlockCondition: '农田 Lv.5' },
  { id: 'temple', name: '神庙', icon: '🏛️', baseCost: { stone: 200 }, costMultiplier: 1.10, maxLevel: 0, productionResource: 'stone', baseProduction: 0.2, requires: ['quarry'], unlockCondition: '采石场 Lv.5' },
  { id: 'obelisk', name: '方尖碑', icon: '🗼', baseCost: { grain: 500, stone: 300, papyrus: 100 }, costMultiplier: 1.15, maxLevel: 0, productionResource: 'papyrus', baseProduction: 0.15, requires: ['papyrus_field'], unlockCondition: '纸莎草田 Lv.5' },
  { id: 'sphinx', name: '狮身人面像', icon: '🦁', baseCost: { grain: 800, stone: 400 }, costMultiplier: 1.13, maxLevel: 0, productionResource: 'grain', baseProduction: 0.25, requires: ['gold_mine'], unlockCondition: '金矿 Lv.3' },
  { id: 'pyramid', name: '金字塔', icon: '🔺', baseCost: { grain: 2000, stone: 1500, gold: 500 }, costMultiplier: 1.18, maxLevel: 0, productionResource: 'gold', baseProduction: 0.3, requires: ['temple'], unlockCondition: '神庙 Lv.3' },
];

// ═══════════════════════════════════════════════════════════════
// 时代系统 → StageSystem (6个)
// ═══════════════════════════════════════════════════════════════

export const DYNASTIES: StageDef[] = [
  { id: 'predynastic', name: '前王朝', description: '尼罗河畔，文明初现', order: 1, prerequisiteStageId: null, requiredResources: {}, requiredConditions: [], rewards: [], productionMultiplier: 1.0, combatMultiplier: 1.0, iconAsset: '🏺', themeColor: '#c2a366' },
  { id: 'old_kingdom', name: '古王国', description: '金字塔时代，法老集权', order: 2, prerequisiteStageId: 'predynastic', requiredResources: { grain: 500 }, requiredConditions: [], rewards: [], productionMultiplier: 1.2, combatMultiplier: 1.0, iconAsset: '🔺', themeColor: '#daa520' },
  { id: 'middle_kingdom', name: '中王国', description: '文学繁荣，灌溉扩展', order: 3, prerequisiteStageId: 'old_kingdom', requiredResources: { grain: 3000, stone: 1000 }, requiredConditions: [], rewards: [], productionMultiplier: 1.5, combatMultiplier: 1.0, iconAsset: '📜', themeColor: '#b8860b' },
  { id: 'new_kingdom', name: '新王国', description: '帝国鼎盛，征服四方', order: 4, prerequisiteStageId: 'middle_kingdom', requiredResources: { grain: 10000, stone: 5000, gold: 2000 }, requiredConditions: [], rewards: [], productionMultiplier: 2.0, combatMultiplier: 1.0, iconAsset: '⚔️', themeColor: '#cd853f' },
  { id: 'late_period', name: '后期王朝', description: '外族入侵，文明交融', order: 5, prerequisiteStageId: 'new_kingdom', requiredResources: { grain: 50000, stone: 30000, gold: 10000 }, requiredConditions: [], rewards: [], productionMultiplier: 2.5, combatMultiplier: 1.0, iconAsset: '🏺', themeColor: '#d2691e' },
  { id: 'ptolemaic', name: '托勒密', description: '希腊化时代，亚历山大灯塔', order: 6, prerequisiteStageId: 'late_period', requiredResources: { grain: 200000, stone: 100000, gold: 50000 }, requiredConditions: [], rewards: [], productionMultiplier: 3.0, combatMultiplier: 1.0, iconAsset: '🌟', themeColor: '#ffd700' },
];

// ═══════════════════════════════════════════════════════════════
// 神明系统 → UnitSystem (8个)
// ═══════════════════════════════════════════════════════════════

export interface DeityDef {
  id: string;
  name: string;
  title: string;
  rarity: string;
  baseStats: { administration: number; military: number; culture: number };
  growthRates: { administration: number; military: number; culture: number };
  recruitCost: { grain: number; stone: number };
  bonus: string;
}

const DEITY_RARITY_GROWTH: Record<string, number> = { uncommon: 2, rare: 3.5, epic: 5, legendary: 7 };
const DEITY_RARITY_COST: Record<string, { grain: number; stone: number }> = {
  uncommon: { grain: 200, stone: 100 },
  rare: { grain: 600, stone: 300 },
  epic: { grain: 2000, stone: 1000 },
  legendary: { grain: 8000, stone: 4000 },
};

function makeDeity(id: string, name: string, title: string, rarity: string, adm: number, mil: number, cul: number, bonus: string): DeityDef {
  const g = DEITY_RARITY_GROWTH[rarity];
  return {
    id, name, title, rarity,
    baseStats: { administration: adm, military: mil, culture: cul },
    growthRates: { administration: g, military: g, culture: g },
    recruitCost: DEITY_RARITY_COST[rarity],
    bonus,
  };
}

export const DEITIES: DeityDef[] = [
  makeDeity('ra', '拉', '太阳之神', 'legendary', 70, 30, 95, '谷物产出 +50%'),
  makeDeity('osiris', '奥西里斯', '冥界之王', 'epic', 50, 20, 90, '全部产出 +15%'),
  makeDeity('isis', '伊西斯', '生命女神', 'rare', 30, 90, 50, '石料产出 +30%'),
  makeDeity('horus', '荷鲁斯', '天空之神', 'epic', 90, 60, 40, '建筑费用 -10%'),
  makeDeity('anubis', '阿努比斯', '死神', 'legendary', 85, 80, 95, '全部产出 +25%'),
  makeDeity('thoth', '托特', '智慧之神', 'rare', 20, 30, 95, '纸莎草产出 +30%'),
  makeDeity('bastet', '巴斯泰特', '猫神', 'uncommon', 60, 20, 80, '声望收益 +20%'),
  makeDeity('ptah', '普塔', '工匠之神', 'rare', 65, 25, 85, '石料产出 +25%'),
];

// ═══════════════════════════════════════════════════════════════
// 发明系统 → TechTreeSystem (9项)
// ═══════════════════════════════════════════════════════════════

export const INVENTIONS: TechDef[] = [
  // 建筑路线
  { id: 'stone_masonry', name: '石工术', description: '石料产出 +50%', requires: [], cost: { stone: 500 }, researchTime: 30000, tier: 1, icon: '🧱', branch: 'architecture', effects: [{ type: 'multiplier', target: 'stone', value: 1.5, description: '石料产出 ×1.5' }] },
  { id: 'pyramid_building', name: '金字塔建造', description: '石料产出 ×2.0', requires: ['stone_masonry'], cost: { stone: 2000 }, researchTime: 60000, tier: 2, icon: '🔺', branch: 'architecture', effects: [{ type: 'multiplier', target: 'stone', value: 2.0, description: '石料产出 ×2.0' }] },
  { id: 'obelisk_carving', name: '方尖碑雕刻', description: '黄金产出 ×2.0', requires: ['pyramid_building'], cost: { gold: 3000 }, researchTime: 120000, tier: 3, icon: '🗼', branch: 'architecture', effects: [{ type: 'multiplier', target: 'gold', value: 2.0, description: '黄金产出 ×2.0' }] },
  // 农业路线
  { id: 'nilometer', name: '尼罗河水尺', description: '谷物产出 +50%', requires: [], cost: { grain: 400 }, researchTime: 30000, tier: 1, icon: '🌊', branch: 'agriculture', effects: [{ type: 'multiplier', target: 'grain', value: 1.5, description: '谷物产出 ×1.5' }] },
  { id: 'shaduf', name: '沙杜夫灌溉', description: '谷物产出 ×2.0', requires: ['nilometer'], cost: { grain: 1500 }, researchTime: 60000, tier: 2, icon: '💧', branch: 'agriculture', effects: [{ type: 'multiplier', target: 'grain', value: 2.0, description: '谷物产出 ×2.0' }] },
  { id: 'canal_system', name: '运河体系', description: '全部产出 +30%', requires: ['shaduf'], cost: { grain: 5000, stone: 2000 }, researchTime: 120000, tier: 3, icon: '🚢', branch: 'agriculture', effects: [{ type: 'multiplier', target: 'all_resources', value: 1.3, description: '全部产出 +30%' }] },
  // 神学路线
  { id: 'hieroglyphs', name: '象形文字', description: '招募费用 -20%', requires: [], cost: { papyrus: 600 }, researchTime: 30000, tier: 1, icon: '📝', branch: 'theology', effects: [{ type: 'modifier', target: 'recruit_cost', value: -0.2, description: '招募费用 -20%' }] },
  { id: 'book_of_dead', name: '死者之书', description: '全部产出 ×1.5', requires: ['hieroglyphs'], cost: { grain: 3000, papyrus: 2000 }, researchTime: 90000, tier: 2, icon: '📖', branch: 'theology', effects: [{ type: 'multiplier', target: 'all_resources', value: 1.5, description: '全部产出 ×1.5' }] },
  { id: 'divine_judgment', name: '神之审判', description: '全部加成 ×2.0', requires: ['book_of_dead'], cost: { papyrus: 8000, gold: 5000 }, researchTime: 150000, tier: 3, icon: '⚖️', branch: 'theology', effects: [{ type: 'multiplier', target: 'all', value: 2.0, description: '全部加成 ×2.0' }] },
];

// ═══════════════════════════════════════════════════════════════
// 声望配置
// ═══════════════════════════════════════════════════════════════

export const PRESTIGE_CONFIG: PrestigeConfig = {
  currencyName: '神恩',
  currencyIcon: '🌟',
  base: 10,
  threshold: 10000,
  bonusMultiplier: 0.15,
  retention: 0.1,
};

// ═══════════════════════════════════════════════════════════════
// UI 色彩主题（沙漠金色系：深棕+金色+沙色）
// ═══════════════════════════════════════════════════════════════

export const COLOR_THEME: UIColorScheme = {
  bgGradient1: '#1a1008',
  bgGradient2: '#2d1f0e',
  textPrimary: '#f5ecd7',
  textSecondary: '#c4a35a',
  textDim: '#7a6530',
  accentGold: '#daa520',
  accentGreen: '#8fbc3b',
  panelBg: 'rgba(218,165,32,0.05)',
  selectedBg: 'rgba(218,165,32,0.1)',
  selectedBorder: 'rgba(218,165,32,0.4)',
  affordable: '#8fbc3b',
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
  { id: 'grain', name: '谷物', icon: '🌾' },
  { id: 'stone', name: '石料', icon: '🪨' },
  { id: 'papyrus', name: '纸莎草', icon: '📜' },
  { id: 'gold', name: '黄金', icon: '💰' },
];

export const INITIAL_RESOURCES: Record<string, number> = { grain: 50, stone: 0, papyrus: 0, gold: 0 };
export const INITIALLY_UNLOCKED: string[] = ['farm'];
export const CLICK_REWARD = { grain: 1 };
