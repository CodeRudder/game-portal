/**
 * 四大文明·巴比伦 (Civ Babylon) — 放置游戏常量 v2.0
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

export const GAME_ID = 'civ-babylon';
export const GAME_TITLE = '巴比伦文明';

export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ═══════════════════════════════════════════════════════════════
// 建筑系统 (8个)
// ═══════════════════════════════════════════════════════════════

export const BUILDINGS: BuildingDef[] = [
  { id: 'farm', name: '农田', icon: '🌾', baseCost: { grain: 10 }, costMultiplier: 1.07, maxLevel: 0, productionResource: 'grain', baseProduction: 0.1, unlockCondition: '初始' },
  { id: 'brick_kiln', name: '砖窑', icon: '🧱', baseCost: { grain: 30 }, costMultiplier: 1.08, maxLevel: 0, productionResource: 'clay', baseProduction: 0.08, requires: ['farm'], unlockCondition: '农田 Lv.1' },
  { id: 'copper_mine', name: '铜矿', icon: '🔶', baseCost: { grain: 50, clay: 20 }, costMultiplier: 1.09, maxLevel: 0, productionResource: 'copper', baseProduction: 0.06, requires: ['brick_kiln'], unlockCondition: '砖窑 Lv.1' },
  { id: 'market', name: '市集', icon: '💰', baseCost: { clay: 60, grain: 40 }, costMultiplier: 1.10, maxLevel: 0, productionResource: 'silver', baseProduction: 0.04, requires: ['copper_mine'], unlockCondition: '铜矿 Lv.1' },
  { id: 'ziggurat', name: '金字形神塔', icon: '🏛️', baseCost: { silver: 200, copper: 100 }, costMultiplier: 1.12, maxLevel: 0, productionResource: 'clay', baseProduction: 0.10, requires: ['market'], unlockCondition: '市集 Lv.1' },
  { id: 'library', name: '图书馆', icon: '📚', baseCost: { silver: 300, copper: 150 }, costMultiplier: 1.11, maxLevel: 0, productionResource: 'silver', baseProduction: 0.08, requires: ['ziggurat'], unlockCondition: '金字形神塔 Lv.1' },
  { id: 'hanging_garden', name: '空中花园', icon: '🌺', baseCost: { silver: 600, copper: 400, clay: 100 }, costMultiplier: 1.14, maxLevel: 0, productionResource: 'grain', baseProduction: 0.15, requires: ['library'], unlockCondition: '图书馆 Lv.1' },
  { id: 'ishtar_gate', name: '伊什塔尔门', icon: '🚪', baseCost: { silver: 1500, copper: 1000, clay: 300 }, costMultiplier: 1.18, maxLevel: 0, productionResource: 'silver', baseProduction: 0.25, requires: ['hanging_garden'], unlockCondition: '空中花园 Lv.1' },
];

// ═══════════════════════════════════════════════════════════════
// 时代系统 → StageSystem (6个)
// ═══════════════════════════════════════════════════════════════

export const DYNASTIES: StageDef[] = [
  { id: 'sumer', name: '苏美尔', description: '两河初兴，文明萌芽', order: 1, prerequisiteStageId: null, requiredResources: {}, requiredConditions: [], rewards: [], productionMultiplier: 1.0, combatMultiplier: 1.0, iconAsset: '🏺', themeColor: '#8b6914' },
  { id: 'akkadian', name: '阿卡德', description: '萨尔贡一统，帝国崛起', order: 2, prerequisiteStageId: 'sumer', requiredResources: { grain: 500, clay: 200 }, requiredConditions: [], rewards: [], productionMultiplier: 1.3, combatMultiplier: 1.0, iconAsset: '⚔️', themeColor: '#a0522d' },
  { id: 'babylonian', name: '巴比伦', description: '汉谟拉比法典，文明鼎盛', order: 3, prerequisiteStageId: 'akkadian', requiredResources: { grain: 3000, clay: 1500, copper: 300 }, requiredConditions: [], rewards: [], productionMultiplier: 1.6, combatMultiplier: 1.0, iconAsset: '🏛️', themeColor: '#b8860b' },
  { id: 'assyrian', name: '亚述', description: '铁血帝国，征伐四方', order: 4, prerequisiteStageId: 'babylonian', requiredResources: { grain: 15000, clay: 8000, copper: 2000, silver: 500 }, requiredConditions: [], rewards: [], productionMultiplier: 2.0, combatMultiplier: 1.0, iconAsset: '🗡️', themeColor: '#cd853f' },
  { id: 'neobabylonian', name: '新巴比伦', description: '空中花园，世界奇迹', order: 5, prerequisiteStageId: 'assyrian', requiredResources: { grain: 80000, clay: 40000, copper: 10000, silver: 3000 }, requiredConditions: [], rewards: [], productionMultiplier: 2.5, combatMultiplier: 1.0, iconAsset: '🌺', themeColor: '#daa520' },
  { id: 'persian', name: '波斯', description: '居鲁士征服，万邦归一', order: 6, prerequisiteStageId: 'neobabylonian', requiredResources: { grain: 300000, clay: 150000, copper: 50000, silver: 15000 }, requiredConditions: [], rewards: [], productionMultiplier: 3.0, combatMultiplier: 1.0, iconAsset: '👑', themeColor: '#ffd700' },
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
  recruitCost: { grain: number; clay: number };
  bonus: string;
}

const HERO_RARITY_GROWTH: Record<string, number> = { uncommon: 2, rare: 3.5, epic: 5, legendary: 7 };
const HERO_RARITY_COST: Record<string, { grain: number; clay: number }> = {
  uncommon: { grain: 200, clay: 100 },
  rare: { grain: 600, clay: 300 },
  epic: { grain: 2000, clay: 1000 },
  legendary: { grain: 8000, clay: 4000 },
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
  makeHero('gilgamesh', '吉尔伽美什', '乌鲁克之王', 'legendary', 80, 95, 70, '全部产出 +25%'),
  makeHero('enkidu', '恩奇都', '荒野之子', 'epic', 50, 85, 60, '军事产出 +30%'),
  makeHero('hammurabi', '汉谟拉比', '立法者', 'legendary', 95, 60, 85, '全部产出 +25%'),
  makeHero('sargon', '萨尔贡', '阿卡德之主', 'epic', 85, 90, 50, '军事产出 +30%'),
  makeHero('nebuchadnezzar', '尼布甲尼撒', '伟大建造者', 'rare', 70, 50, 75, '建筑费用 -10%'),
  makeHero('semiramis', '塞米拉米斯', '传奇女王', 'rare', 60, 65, 70, '谷物产出 +30%'),
  makeHero('enheduanna', '恩赫杜安娜', '月神祭司', 'uncommon', 40, 20, 80, '文化产出 +20%'),
  makeHero('nabu', '纳布', '智慧之神', 'uncommon', 55, 25, 75, '声望收益 +20%'),
];

// ═══════════════════════════════════════════════════════════════
// 发明系统 → TechTreeSystem (9项)
// ═══════════════════════════════════════════════════════════════

export const INVENTIONS: TechDef[] = [
  // 建筑路线
  { id: 'mudbrick', name: '泥砖烧制', description: '黏土产出 +50%', requires: [], cost: { clay: 500 }, researchTime: 30000, tier: 1, icon: '🧱', branch: 'building', effects: [{ type: 'multiplier', target: 'clay', value: 1.5, description: '黏土产出 ×1.5' }] },
  { id: 'arch', name: '拱券技术', description: '黏土产出 ×2.0', requires: ['mudbrick'], cost: { clay: 2000 }, researchTime: 60000, tier: 2, icon: '🏛️', branch: 'building', effects: [{ type: 'multiplier', target: 'clay', value: 2.0, description: '黏土产出 ×2.0' }] },
  { id: 'aqueduct', name: '引水渠', description: '谷物产出 ×2.0', requires: ['arch'], cost: { grain: 3000 }, researchTime: 120000, tier: 3, icon: '💧', branch: 'building', effects: [{ type: 'multiplier', target: 'grain', value: 2.0, description: '谷物产出 ×2.0' }] },
  // 农业路线
  { id: 'irrigation', name: '灌溉术', description: '谷物产出 +50%', requires: [], cost: { grain: 400 }, researchTime: 30000, tier: 1, icon: '🌾', branch: 'agriculture', effects: [{ type: 'multiplier', target: 'grain', value: 1.5, description: '谷物产出 ×1.5' }] },
  { id: 'plow', name: '犁耕技术', description: '谷物产出 ×2.0', requires: ['irrigation'], cost: { grain: 1500 }, researchTime: 60000, tier: 2, icon: '🐂', branch: 'agriculture', effects: [{ type: 'multiplier', target: 'grain', value: 2.0, description: '谷物产出 ×2.0' }] },
  { id: 'calendar', name: '太阴历', description: '全部产出 +30%', requires: ['plow'], cost: { grain: 5000, silver: 2000 }, researchTime: 120000, tier: 3, icon: '🌙', branch: 'agriculture', effects: [{ type: 'multiplier', target: 'all_resources', value: 1.3, description: '全部产出 +30%' }] },
  // 文化路线
  { id: 'cuneiform', name: '楔形文字', description: '招募费用 -20%', requires: [], cost: { silver: 600 }, researchTime: 30000, tier: 1, icon: '📝', branch: 'culture', effects: [{ type: 'modifier', target: 'recruit_cost', value: -0.2, description: '招募费用 -20%' }] },
  { id: 'astronomy', name: '天文学', description: '全部产出 ×1.5', requires: ['cuneiform'], cost: { grain: 3000, silver: 2000 }, researchTime: 90000, tier: 2, icon: '🔭', branch: 'culture', effects: [{ type: 'multiplier', target: 'all_resources', value: 1.5, description: '全部产出 ×1.5' }] },
  { id: 'mathematics', name: '六十进制', description: '全部加成 ×2.0', requires: ['astronomy'], cost: { silver: 8000, grain: 5000 }, researchTime: 150000, tier: 3, icon: '🔢', branch: 'culture', effects: [{ type: 'multiplier', target: 'all', value: 2.0, description: '全部加成 ×2.0' }] },
];

// ═══════════════════════════════════════════════════════════════
// 声望配置
// ═══════════════════════════════════════════════════════════════

export const PRESTIGE_CONFIG: PrestigeConfig = {
  currencyName: '神眷',
  currencyIcon: '⭐',
  base: 10,
  threshold: 12000,
  bonusMultiplier: 0.12,
  retention: 0.1,
};

// ═══════════════════════════════════════════════════════════════
// UI 色彩主题（沙漠棕金系）
// ═══════════════════════════════════════════════════════════════

export const COLOR_THEME: UIColorScheme = {
  bgGradient1: '#1a0f05',
  bgGradient2: '#2d1f10',
  textPrimary: '#f5f0e8',
  textSecondary: '#c4b99a',
  textDim: '#7a7060',
  accentGold: '#c9a96e',
  accentGreen: '#8b7d3c',
  panelBg: 'rgba(201,169,110,0.05)',
  selectedBg: 'rgba(201,169,110,0.1)',
  selectedBorder: 'rgba(201,169,110,0.4)',
  affordable: '#8b7d3c',
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
  { id: 'clay', name: '黏土', icon: '🧱' },
  { id: 'copper', name: '铜矿', icon: '🔶' },
  { id: 'silver', name: '白银', icon: '🥈' },
];

export const INITIAL_RESOURCES: Record<string, number> = { grain: 50, clay: 0, copper: 0, silver: 0 };
export const INITIALLY_UNLOCKED: string[] = ['farm'];
export const CLICK_REWARD = { grain: 1 };
