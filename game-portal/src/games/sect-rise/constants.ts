/**
 * 门派崛起 (Sect Rise) — 放置游戏常量 v2.0
 *
 * 基于统一子系统架构重建。使用 BuildingSystem + PrestigeSystem +
 * StageSystem(门派阶段) + UnitSystem(弟子) + TechTreeSystem(武学)。
 */

import type { BuildingDef } from '@/engines/idle/modules/BuildingSystem';
import type { PrestigeConfig } from '@/engines/idle/modules/PrestigeSystem';
import type { UIColorScheme } from '@/engines/idle/modules/CanvasUIRenderer';
import type { StageDef } from '@/engines/idle/modules/StageSystem';
import type { TechDef } from '@/engines/idle/modules/TechTreeSystem';

// ═══════════════════════════════════════════════════════════════
// 游戏标识
// ═══════════════════════════════════════════════════════════════

export const GAME_ID = 'sect-rise';
export const GAME_TITLE = '门派崛起';

export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ═══════════════════════════════════════════════════════════════
// 建筑系统 (8个)
// ═══════════════════════════════════════════════════════════════

export const BUILDINGS: BuildingDef[] = [
  { id: 'lumber', name: '灵木场', icon: '🪵', baseCost: { wood: 10 }, costMultiplier: 1.07, maxLevel: 0, productionResource: 'wood', baseProduction: 0.1, unlockCondition: '初始' },
  { id: 'mine', name: '灵铁矿', icon: '⚙️', baseCost: { wood: 30 }, costMultiplier: 1.08, maxLevel: 0, productionResource: 'iron', baseProduction: 0.08, requires: ['lumber'], unlockCondition: '灵木场 Lv.1' },
  { id: 'hall', name: '传功殿', icon: '📚', baseCost: { wood: 50, iron: 20 }, costMultiplier: 1.09, maxLevel: 0, productionResource: 'stone', baseProduction: 0.06, requires: ['mine'], unlockCondition: '灵铁矿 Lv.1' },
  { id: 'forge', name: '炼器坊', icon: '🔨', baseCost: { iron: 60, wood: 40 }, costMultiplier: 1.10, maxLevel: 0, productionResource: 'iron', baseProduction: 0.04, requires: ['hall'], unlockCondition: '传功殿 Lv.1' },
  { id: 'garden', name: '灵药园', icon: '🌱', baseCost: { stone: 200, iron: 100 }, costMultiplier: 1.12, maxLevel: 0, productionResource: 'wood', baseProduction: 0.10, requires: ['forge'], unlockCondition: '炼器坊 Lv.1' },
  { id: 'tower', name: '观星塔', icon: '🔮', baseCost: { stone: 300, iron: 150 }, costMultiplier: 1.11, maxLevel: 0, productionResource: 'stone', baseProduction: 0.08, requires: ['garden'], unlockCondition: '灵药园 Lv.1' },
  { id: 'gate', name: '山门', icon: '⛩️', baseCost: { stone: 600, iron: 400, wood: 100 }, costMultiplier: 1.14, maxLevel: 0, productionResource: 'iron', baseProduction: 0.15, requires: ['tower'], unlockCondition: '观星塔 Lv.1' },
  { id: 'golden_hall', name: '金顶大殿', icon: '🏯', baseCost: { stone: 1500, iron: 1000, wood: 300 }, costMultiplier: 1.18, maxLevel: 0, productionResource: 'stone', baseProduction: 0.25, requires: ['gate'], unlockCondition: '山门 Lv.1' },
];

// ═══════════════════════════════════════════════════════════════
// 门派阶段 → StageSystem (6个)
// ═══════════════════════════════════════════════════════════════

export const DYNASTIES: StageDef[] = [
  { id: 'small_sect', name: '小门派', description: '草创之初，百废待兴', order: 1, prerequisiteStageId: null, requiredResources: {}, requiredConditions: [], rewards: [], productionMultiplier: 1.0, combatMultiplier: 1.0, iconAsset: '🏕️', themeColor: '#5a7a5a' },
  { id: 'growing', name: '初具规模', description: '门派渐成，弟子初聚', order: 2, prerequisiteStageId: 'small_sect', requiredResources: { wood: 500, iron: 200 }, requiredConditions: [], rewards: [], productionMultiplier: 1.3, combatMultiplier: 1.0, iconAsset: '🏘️', themeColor: '#6b8e6b' },
  { id: 'known', name: '名声远扬', description: '声名鹊起，江湖闻名', order: 3, prerequisiteStageId: 'growing', requiredResources: { wood: 3000, iron: 1500, stone: 300 }, requiredConditions: [], rewards: [], productionMultiplier: 1.6, combatMultiplier: 1.0, iconAsset: '🏯', themeColor: '#40a080' },
  { id: 'dominant', name: '一方霸主', description: '雄踞一方，无人敢犯', order: 4, prerequisiteStageId: 'known', requiredResources: { wood: 15000, iron: 8000, stone: 2000 }, requiredConditions: [], rewards: [], productionMultiplier: 2.0, combatMultiplier: 1.0, iconAsset: '⚔️', themeColor: '#30b090' },
  { id: 'alliance', name: '武林盟主', description: '统领江湖，号令群雄', order: 5, prerequisiteStageId: 'dominant', requiredResources: { wood: 80000, iron: 40000, stone: 10000 }, requiredConditions: [], rewards: [], productionMultiplier: 2.5, combatMultiplier: 1.0, iconAsset: '👑', themeColor: '#40e0d0' },
  { id: 'founder', name: '开宗立派', description: '开宗立派，万世流芳', order: 6, prerequisiteStageId: 'alliance', requiredResources: { wood: 300000, iron: 150000, stone: 50000 }, requiredConditions: [], rewards: [], productionMultiplier: 3.0, combatMultiplier: 1.0, iconAsset: '🌟', themeColor: '#ffd700' },
];

// ═══════════════════════════════════════════════════════════════
// 弟子系统 → UnitSystem (8个)
// ═══════════════════════════════════════════════════════════════

export interface HeroDef {
  id: string;
  name: string;
  title: string;
  rarity: string;
  baseStats: { martial: number; internal: number; charisma: number };
  growthRates: { martial: number; internal: number; charisma: number };
  recruitCost: { wood: number; iron: number };
  bonus: string;
}

const HERO_RARITY_GROWTH: Record<string, number> = { uncommon: 2, rare: 3.5, epic: 5, legendary: 7 };
const HERO_RARITY_COST: Record<string, { wood: number; iron: number }> = {
  uncommon: { wood: 200, iron: 100 },
  rare: { wood: 600, iron: 300 },
  epic: { wood: 2000, iron: 1000 },
  legendary: { wood: 8000, iron: 4000 },
};

function makeHero(id: string, name: string, title: string, rarity: string, martial: number, internal: number, charisma: number, bonus: string): HeroDef {
  const g = HERO_RARITY_GROWTH[rarity];
  return {
    id, name, title, rarity,
    baseStats: { martial, internal, charisma },
    growthRates: { martial: g, internal: g, charisma: g },
    recruitCost: HERO_RARITY_COST[rarity],
    bonus,
  };
}

export const HEROES: HeroDef[] = [
  makeHero('zhangsanfeng', '张三丰', '太极宗师', 'legendary', 90, 95, 80, '全部产出 +50%'),
  makeHero('dongfang', '东方不败', '日月神教', 'epic', 95, 70, 50, '灵铁产出 +40%'),
  makeHero('linghu', '令狐冲', '独孤九剑', 'rare', 85, 60, 70, '灵木产出 +30%'),
  makeHero('yangguo', '杨过', '神雕大侠', 'epic', 90, 80, 65, '灵石产出 +35%'),
  makeHero('guojing', '郭靖', '北侠', 'legendary', 85, 70, 90, '全部产出 +25%'),
  makeHero('xiaolongnv', '小龙女', '古墓传人', 'rare', 60, 90, 85, '灵石产出 +30%'),
  makeHero('huangrong', '黄蓉', '桃花岛主', 'uncommon', 50, 70, 90, '建筑费用 -10%'),
  makeHero('qiaofeng', '乔峰', '丐帮帮主', 'uncommon', 90, 50, 75, '灵铁产出 +20%'),
];

// ═══════════════════════════════════════════════════════════════
// 武学系统 → TechTreeSystem (9项：武学3+炼器3+管理3)
// ═══════════════════════════════════════════════════════════════

export const INVENTIONS: TechDef[] = [
  // 武学路线
  { id: 'basic_sword', name: '基础剑法', description: '灵木产出 +50%', requires: [], cost: { wood: 500 }, researchTime: 30000, tier: 1, icon: '⚔️', branch: 'martial', effects: [{ type: 'multiplier', target: 'wood', value: 1.5, description: '灵木产出 ×1.5' }] },
  { id: 'tai_chi', name: '太极拳法', description: '灵木产出 ×2.0', requires: ['basic_sword'], cost: { wood: 2000 }, researchTime: 60000, tier: 2, icon: '☯️', branch: 'martial', effects: [{ type: 'multiplier', target: 'wood', value: 2.0, description: '灵木产出 ×2.0' }] },
  { id: 'nine_yang', name: '九阳神功', description: '全部产出 ×2.0', requires: ['tai_chi'], cost: { stone: 3000 }, researchTime: 120000, tier: 3, icon: '🔥', branch: 'martial', effects: [{ type: 'multiplier', target: 'all_resources', value: 2.0, description: '全部产出 ×2.0' }] },
  // 炼器路线
  { id: 'basic_forge', name: '基础锻造', description: '灵铁产出 +50%', requires: [], cost: { iron: 400 }, researchTime: 30000, tier: 1, icon: '🔨', branch: 'crafting', effects: [{ type: 'multiplier', target: 'iron', value: 1.5, description: '灵铁产出 ×1.5' }] },
  { id: 'refining', name: '精炼秘术', description: '灵铁产出 ×2.0', requires: ['basic_forge'], cost: { iron: 1500 }, researchTime: 60000, tier: 2, icon: '⚒️', branch: 'crafting', effects: [{ type: 'multiplier', target: 'iron', value: 2.0, description: '灵铁产出 ×2.0' }] },
  { id: 'divine_forge', name: '神兵锻造', description: '全部产出 +30%', requires: ['refining'], cost: { iron: 5000, stone: 2000 }, researchTime: 120000, tier: 3, icon: '🗡️', branch: 'crafting', effects: [{ type: 'multiplier', target: 'all_resources', value: 1.3, description: '全部产出 +30%' }] },
  // 管理路线
  { id: 'sect_rules', name: '门派规矩', description: '招募费用 -20%', requires: [], cost: { stone: 600 }, researchTime: 30000, tier: 1, icon: '📜', branch: 'management', effects: [{ type: 'modifier', target: 'recruit_cost', value: -0.2, description: '招募费用 -20%' }] },
  { id: 'formation', name: '阵法研究', description: '全部产出 ×1.5', requires: ['sect_rules'], cost: { wood: 3000, iron: 2000 }, researchTime: 90000, tier: 2, icon: '🔷', branch: 'management', effects: [{ type: 'multiplier', target: 'all_resources', value: 1.5, description: '全部产出 ×1.5' }] },
  { id: 'mandate', name: '天命所归', description: '全部加成 ×2.0', requires: ['formation'], cost: { stone: 8000, wood: 5000 }, researchTime: 150000, tier: 3, icon: '🌟', branch: 'management', effects: [{ type: 'multiplier', target: 'all', value: 2.0, description: '全部加成 ×2.0' }] },
];

// ═══════════════════════════════════════════════════════════════
// 声望配置
// ═══════════════════════════════════════════════════════════════

export const PRESTIGE_CONFIG: PrestigeConfig = {
  currencyName: '声望',
  currencyIcon: '⭐',
  base: 10,
  threshold: 12000,
  bonusMultiplier: 0.12,
  retention: 0.1,
};

// ═══════════════════════════════════════════════════════════════
// UI 色彩主题（武侠青绿系）
// ═══════════════════════════════════════════════════════════════

export const COLOR_THEME: UIColorScheme = {
  bgGradient1: '#0a1a0f',
  bgGradient2: '#0f2a1a',
  textPrimary: '#e8f5e8',
  textSecondary: '#a0c4a0',
  textDim: '#607060',
  accentGold: '#40e0d0',
  accentGreen: '#2e8b57',
  panelBg: 'rgba(64,224,208,0.05)',
  selectedBg: 'rgba(64,224,208,0.1)',
  selectedBorder: 'rgba(64,224,208,0.4)',
  affordable: '#2e8b57',
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
  { id: 'wood', name: '灵木', icon: '🪵' },
  { id: 'iron', name: '灵铁', icon: '⚙️' },
  { id: 'stone', name: '灵石', icon: '💎' },
  { id: 'reputation', name: '声望', icon: '⭐' },
];

export const INITIAL_RESOURCES: Record<string, number> = { wood: 50, iron: 0, stone: 0, reputation: 0 };
export const INITIALLY_UNLOCKED: string[] = ['lumber'];
export const CLICK_REWARD = { wood: 1 };
