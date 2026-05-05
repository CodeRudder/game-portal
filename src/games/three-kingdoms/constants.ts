// 三国霸业 — 游戏常量配置
//
// 所有类型内联定义，不导入任何外部模块。

// ═══════════════════════════════════════════════════════════════
// 内联类型定义
// ═══════════════════════════════════════════════════════════════

/** 建筑分类 */
export type BuildingCategory = 'military' | 'economic' | 'civilian' | 'resource';

/** 建筑定义 */
export interface BuildingDef {
  id: string;
  name: string;
  icon: string;
  category?: BuildingCategory;
  baseCost: Record<string, number>;
  costMultiplier: number;
  maxLevel: number;
  productionResource: string;
  baseProduction: number;
  requires?: string[];
  unlockCondition?: string;
}

/** 武将定义 */
export interface GeneralDef {
  id: string;
  name: string;
  rarity: string;
  faction: string;
  baseStats: { attack: number; defense: number; intelligence: number; command: number };
  growthRates: { attack: number; defense: number; intelligence: number; command: number };
  recruitCost: { grain: number; gold: number; troops: number };
  evolution: string;
}

/** 领土定义 */
export interface TerritoryDef {
  id: string;
  name: string;
  powerRequired: number;
  rewards: Record<string, number>;
  conquestBonus?: Record<string, number>;
  adjacent: string[];
  type: 'plains' | 'mountain' | 'forest' | 'desert' | 'coastal' | 'capital';
  defenseMultiplier: number;
  level: number;
  specialEffect?: string;
  position: { x: number; y: number };
}

/** 科技效果 */
export interface TechEffect {
  type: 'multiplier' | 'unlock' | 'modifier' | 'ability';
  target: string;
  value: number;
  description: string;
}

/** 科技定义 */
export interface TechDef {
  id: string;
  name: string;
  description: string;
  requires: string[];
  cost: Record<string, number>;
  researchTime: number;
  effects: TechEffect[];
  tier: number;
  icon: string;
  branch?: string;
}

/** 敌人定义 */
export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  attack: number;
  defense: number;
  drops: Record<string, number>;
  abilities: string[];
  isBoss: boolean;
}

/** 战斗波次定义 */
export interface BattleDef {
  id: string;
  stageId: string;
  wave: number;
  enemies: EnemyDef[];
  rewards: Record<string, number>;
  timeLimit: number;
  nextWave?: string;
  tags: string[];
}

/** 阶段奖励 */
export interface StageReward {
  type: 'resource' | 'unit' | 'feature' | 'multiplier';
  targetId: string;
  value: number;
}

/** 阶段条件 */
export interface StageCondition {
  type: string;
  targetId: string;
  minValue: number;
}

/** 阶段定义 */
export interface StageDef {
  id: string;
  name: string;
  description: string;
  order: number;
  prerequisiteStageId: string | null;
  requiredResources: Record<string, number>;
  requiredConditions: StageCondition[];
  rewards: StageReward[];
  productionMultiplier: number;
  combatMultiplier: number;
  iconAsset: string;
  themeColor: string;
}

/** 声望配置 */
export interface PrestigeConfig {
  currencyName: string;
  currencyIcon: string;
  base: number;
  threshold: number;
  bonusMultiplier: number;
  retention: number;
  offlineBonusPerPoint?: number;
}

/** UI 色彩主题 */
export interface UIColorScheme {
  bgGradient1: string;
  bgGradient2: string;
  textPrimary: string;
  textSecondary: string;
  textDim: string;
  accentGold: string;
  accentGreen: string;
  panelBg: string;
  selectedBg: string;
  selectedBorder: string;
  affordable: string;
  unaffordable: string;
}

// ═══════════════════════════════════════════════════════════════
// 游戏标识
// ═══════════════════════════════════════════════════════════════

export const GAME_ID = 'three-kingdoms';
export const GAME_TITLE = '三国霸业';

// ═══════════════════════════════════════════════════════════════
// 建筑系统 (15个)
// ═══════════════════════════════════════════════════════════════

/**
 * 建筑三国特色描述 — PRD BLD-1 八座建筑
 *
 * 每种建筑附带一段三国历史背景描述，
 * 增强游戏的三国主题沉浸感。
 */
export const BUILDING_DESCRIPTIONS: Record<string, string> = {
  castle: '天下之主，居中调度，全资源加成',
  farm: '曹操推行屯田制，兵农合一，粮草源源不断',
  market: '天下商贾汇聚，互通有无，富国强兵',
  barracks: '练兵千日，用兵一时，铁血铸就精锐之师',
  smithy: '千锤百炼，铸造神兵利器，武装三军将士',
  academy: '太学兴教，传承经典，培育经天纬地之才',
  clinic: '悬壶济世，妙手回春，保百姓安居乐业',
  wall: '高城深池，驻军守备，固若金汤守四方',
};

export const BUILDINGS: BuildingDef[] = [
  // ── 核心中央 ──
  {
    id: 'castle', name: '主城', icon: '🏛️', category: 'economic',
    baseCost: { grain: 200, gold: 150 }, costMultiplier: 1.8, maxLevel: 30,
    productionResource: 'gold', baseProduction: 0,
    unlockCondition: '初始解锁',
  },
  // ── 左侧民生 ──
  {
    id: 'farm', name: '农田', icon: '🌾', category: 'resource',
    baseCost: { grain: 100, gold: 50 }, costMultiplier: 1.8, maxLevel: 25,
    productionResource: 'grain', baseProduction: 0.8,
    unlockCondition: '初始解锁',
  },
  {
    id: 'market', name: '市集', icon: '💰', category: 'economic',
    baseCost: { grain: 80, gold: 100 }, costMultiplier: 1.8, maxLevel: 25,
    productionResource: 'gold', baseProduction: 0.6,
    unlockCondition: '主城 Lv2',
  },
  // ── 中央军事 ──
  {
    id: 'barracks', name: '兵营', icon: '⚔️', category: 'military',
    baseCost: { grain: 120, gold: 80 }, costMultiplier: 1.8, maxLevel: 25,
    productionResource: 'troops', baseProduction: 0.4,
    unlockCondition: '主城 Lv2',
  },
  {
    id: 'smithy', name: '铁匠铺', icon: '🔨', category: 'military',
    baseCost: { grain: 200, gold: 300 }, costMultiplier: 2.0, maxLevel: 20,
    productionResource: 'gold', baseProduction: 0,
    unlockCondition: '主城 Lv3',
  },
  // ── 右侧文教 ──
  {
    id: 'academy', name: '书院', icon: '📚', category: 'civilian',
    baseCost: { grain: 150, gold: 200 }, costMultiplier: 1.8, maxLevel: 20,
    productionResource: 'destiny', baseProduction: 0,
    unlockCondition: '主城 Lv3',
  },
  {
    id: 'clinic', name: '医馆', icon: '🏥', category: 'civilian',
    baseCost: { grain: 100, gold: 150 }, costMultiplier: 1.8, maxLevel: 20,
    productionResource: 'troops', baseProduction: 0,
    unlockCondition: '主城 Lv4',
  },
  // ── 上方防御 ──
  {
    id: 'wall', name: '城墙', icon: '🏯', category: 'military',
    baseCost: { grain: 300, gold: 200, troops: 100 }, costMultiplier: 2.0, maxLevel: 20,
    productionResource: 'troops', baseProduction: 0,
    unlockCondition: '主城 Lv5',
  },
];

// ═══════════════════════════════════════════════════════════════
// 武将系统 (12个)
// 蜀: liubei(legendary), guanyu(epic), zhangfei(epic), zhugeliang(mythic)
// 魏: caocao(legendary), xiahoudun(rare), simayi(epic), xuchu(uncommon)
// 吴: sunquan(legendary), zhouyu(epic), ganning(rare), luxun(rare)
// ═══════════════════════════════════════════════════════════════

const RARITY_GROWTH: Record<string, number> = {
  uncommon: 3,
  rare: 4.5,
  epic: 6,
  legendary: 8,
  mythic: 10,
};

const RARITY_COST: Record<string, { grain: number; gold: number; troops: number }> = {
  uncommon: { grain: 200, gold: 300, troops: 100 },
  rare: { grain: 500, gold: 800, troops: 300 },
  epic: { grain: 1500, gold: 2000, troops: 800 },
  legendary: { grain: 5000, gold: 8000, troops: 3000 },
  mythic: { grain: 15000, gold: 25000, troops: 10000 },
};

function makeGeneral(
  id: string, name: string, rarity: string, faction: string,
  atk: number, def: number, int: number, cmd: number, evolution: string,
): GeneralDef {
  const g = RARITY_GROWTH[rarity];
  return {
    id, name, rarity, faction,
    baseStats: { attack: atk, defense: def, intelligence: int, command: cmd },
    growthRates: { attack: g, defense: g, intelligence: g, command: g },
    recruitCost: RARITY_COST[rarity],
    evolution,
  };
}

export const GENERALS: GeneralDef[] = [
  // ── 蜀国 ──
  makeGeneral('liubei',     '刘备',   'legendary', 'shu', 65, 70, 80, 90, '汉昭烈帝'),
  makeGeneral('guanyu',     '关羽',   'epic',      'shu', 95, 75, 60, 85, '武圣'),
  makeGeneral('zhangfei',   '张飞',   'epic',      'shu', 90, 50, 40, 70, '猛将'),
  makeGeneral('zhugeliang', '诸葛亮', 'mythic',    'shu', 50, 60, 99, 95, '卧龙'),
  // ── 魏国 ──
  makeGeneral('caocao',     '曹操',   'legendary', 'wei', 80, 75, 90, 95, '魏武帝'),
  makeGeneral('xiahoudun',  '夏侯惇', 'rare',      'wei', 85, 80, 35, 65, '独目将军'),
  makeGeneral('simayi',     '司马懿', 'epic',      'wei', 55, 65, 95, 90, '冢虎'),
  makeGeneral('xuchu',      '许褚',   'uncommon',  'wei', 80, 70, 20, 55, '虎痴'),
  // ── 吴国 ──
  makeGeneral('sunquan',    '孙权',   'legendary', 'wu',  70, 80, 85, 88, '吴大帝'),
  makeGeneral('zhouyu',     '周瑜',   'epic',      'wu',  65, 60, 95, 90, '美周郎'),
  makeGeneral('ganning',    '甘宁',   'rare',      'wu',  88, 55, 50, 70, '锦帆贼'),
  makeGeneral('luxun',      '陆逊',   'rare',      'wu',  55, 65, 92, 85, '火烧连营'),
];

// ═══════════════════════════════════════════════════════════════
// 领土系统 (15块)
// ═══════════════════════════════════════════════════════════════

export const TERRITORIES: TerritoryDef[] = [
  { id: 'nanzhong',  name: '南中',  powerRequired: 1200, rewards: { grain: 3 },          adjacent: ['chengdu'],                           type: 'desert',   defenseMultiplier: 1.0, level: 1, position: { x: 100, y: 400 } },
  { id: 'chaisang',  name: '柴桑',  powerRequired: 1000, rewards: { grain: 2 },          adjacent: ['jiangling', 'jianye', 'yiling'],     type: 'forest',   defenseMultiplier: 1.0, level: 1, position: { x: 500, y: 350 } },
  { id: 'jiangling', name: '江陵',  powerRequired: 1200, rewards: { gold: 2, grain: 1 }, adjacent: ['jingzhou', 'chaisang'],              type: 'coastal',  defenseMultiplier: 1.0, level: 1, position: { x: 450, y: 300 } },
  { id: 'chengdu',   name: '成都',  powerRequired: 1500, rewards: { grain: 4, gold: 1 }, adjacent: ['hanzhong', 'nanzhong'],              type: 'plains',   defenseMultiplier: 1.0, level: 1, position: { x: 200, y: 350 } },
  { id: 'yiling',    name: '夷陵',  powerRequired: 1500, rewards: { grain: 2, troops: 1 }, adjacent: ['chaisang', 'xiangyang'],           type: 'forest',   defenseMultiplier: 1.0, level: 1, position: { x: 500, y: 250 } },
  { id: 'hanzhong',  name: '汉中',  powerRequired: 2000, rewards: { troops: 2 },         adjacent: ['changan', 'chengdu'],                type: 'mountain', defenseMultiplier: 1.2, level: 1, position: { x: 250, y: 250 } },
  { id: 'xuchang',   name: '许昌',  powerRequired: 2000, rewards: { gold: 3 },           adjacent: ['luoyang', 'ye', 'jingzhou'],         type: 'plains',   defenseMultiplier: 1.0, level: 1, position: { x: 450, y: 200 } },
  { id: 'hefei',     name: '合肥',  powerRequired: 1800, rewards: { troops: 2, grain: 1 }, adjacent: ['jianye', 'xiangyang'],             type: 'plains',   defenseMultiplier: 1.0, level: 1, position: { x: 600, y: 250 } },
  { id: 'xiangyang', name: '襄阳',  powerRequired: 2200, rewards: { gold: 3, troops: 1 }, adjacent: ['jingzhou', 'hefei', 'yiling'],      type: 'mountain', defenseMultiplier: 1.2, level: 1, position: { x: 500, y: 200 } },
  { id: 'jingzhou',  name: '荆州',  powerRequired: 1800, rewards: { grain: 3, gold: 2 }, adjacent: ['xuchang', 'jiangling', 'xiangyang'], type: 'plains',   defenseMultiplier: 1.0, level: 1, position: { x: 450, y: 250 } },
  { id: 'ye',        name: '邺城',  powerRequired: 2500, rewards: { troops: 2, gold: 1 }, adjacent: ['luoyang', 'xuchang', 'beiping'],     type: 'mountain', defenseMultiplier: 1.2, level: 1, position: { x: 400, y: 120 } },
  { id: 'jianye',    name: '建业',  powerRequired: 2500, rewards: { gold: 4, grain: 2 }, adjacent: ['chaisang', 'hefei'],                 type: 'coastal',  defenseMultiplier: 1.0, level: 1, position: { x: 650, y: 300 } },
  { id: 'beiping',   name: '北平',  powerRequired: 2000, rewards: { troops: 3 },         adjacent: ['changan', 'ye'],                     type: 'mountain', defenseMultiplier: 1.2, level: 1, position: { x: 350, y: 50 } },
  { id: 'changan',   name: '长安',  powerRequired: 3000, rewards: { grain: 3, gold: 2 }, adjacent: ['luoyang', 'hanzhong', 'beiping'],   type: 'plains',   defenseMultiplier: 1.0, level: 1, position: { x: 300, y: 150 } },
  { id: 'luoyang',   name: '洛阳',  powerRequired: 5000, rewards: { gold: 5, troops: 2 }, adjacent: ['changan', 'xuchang', 'ye'],         type: 'capital',  defenseMultiplier: 1.5, level: 2, position: { x: 380, y: 180 } },
];

// ═══════════════════════════════════════════════════════════════
// 科技树 (12项：军事4 + 经济4 + 文化4)
// ═══════════════════════════════════════════════════════════════

export const TECHS: TechDef[] = [
  // ── 军事路线 ──
  {
    id: 'mil_1', name: '兵法入门', description: '兵力产出 +50%',
    requires: [], cost: { gold: 500 }, researchTime: 30000,
    tier: 1, icon: '⚔️', branch: 'military',
    effects: [{ type: 'multiplier', target: 'troops', value: 1.5, description: '兵力产出 ×1.5' }],
  },
  {
    id: 'mil_2', name: '阵法精通', description: '战斗伤害 +20%',
    requires: ['mil_1'], cost: { gold: 2000 }, researchTime: 60000,
    tier: 2, icon: '🛡️', branch: 'military',
    effects: [{ type: 'modifier', target: 'battle_damage', value: 0.2, description: '战斗伤害 +20%' }],
  },
  {
    id: 'mil_2b', name: '连弩术', description: '攻击速度 +25%，连射破甲',
    requires: ['mil_1'], cost: { gold: 2500, iron: 300 }, researchTime: 50000,
    tier: 2, icon: '🏹', branch: 'military',
    effects: [{ type: 'modifier', target: 'attack_speed', value: 0.25, description: '攻击速度 +25%' }],
  },
  {
    id: 'mil_3', name: '神兵利器', description: '兵力产出 ×2.0',
    requires: ['mil_2'], cost: { gold: 8000 }, researchTime: 120000,
    tier: 3, icon: '🗡️', branch: 'military',
    effects: [{ type: 'multiplier', target: 'troops', value: 2.0, description: '兵力产出 ×2.0' }],
  },
  {
    id: 'mil_3b', name: '铁骑冲锋', description: '骑兵伤害 +35%，冲锋破阵',
    requires: ['mil_2', 'mil_2b'], cost: { gold: 6000, iron: 500 }, researchTime: 90000,
    tier: 3, icon: '🐎', branch: 'military',
    effects: [{ type: 'modifier', target: 'cavalry_damage', value: 0.35, description: '骑兵伤害 +35%' }],
  },
  {
    id: 'mil_3c', name: '火攻计策', description: '火攻伤害 +40%，范围灼烧',
    requires: ['mil_2b'], cost: { gold: 7000, grain: 1000 }, researchTime: 100000,
    tier: 3, icon: '🔥', branch: 'military',
    effects: [{ type: 'modifier', target: 'fire_damage', value: 0.4, description: '火攻伤害 +40%' }],
  },
  {
    id: 'mil_4', name: '百战百胜', description: '全部军事加成 ×1.5',
    requires: ['mil_3'], cost: { gold: 30000 }, researchTime: 180000,
    tier: 4, icon: '🏆', branch: 'military',
    effects: [{ type: 'multiplier', target: 'military_all', value: 1.5, description: '全部军事加成 ×1.5' }],
  },
  // ── 经济路线 ──
  {
    id: 'eco_1', name: '农耕改良', description: '粮草产出 ×1.5',
    requires: [], cost: { grain: 800 }, researchTime: 30000,
    tier: 1, icon: '🌾', branch: 'economy',
    effects: [{ type: 'multiplier', target: 'grain', value: 1.5, description: '粮草产出 ×1.5' }],
  },
  {
    id: 'eco_2', name: '商贸繁荣', description: '铜钱产出 ×1.5',
    requires: ['eco_1'], cost: { gold: 1500 }, researchTime: 60000,
    tier: 2, icon: '💰', branch: 'economy',
    effects: [{ type: 'multiplier', target: 'gold', value: 1.5, description: '铜钱产出 ×1.5' }],
  },
  {
    id: 'eco_2b', name: '屯田制', description: '粮草产出 +30%，兵农合一',
    requires: ['eco_1'], cost: { gold: 1200, grain: 500 }, researchTime: 45000,
    tier: 2, icon: '🏘️', branch: 'economy',
    effects: [{ type: 'multiplier', target: 'grain', value: 1.3, description: '粮草产出 +30%' }],
  },
  {
    id: 'eco_3', name: '治国安邦', description: '全部资源产出 ×1.3',
    requires: ['eco_2'], cost: { gold: 6000 }, researchTime: 120000,
    tier: 3, icon: '📜', branch: 'economy',
    effects: [{ type: 'multiplier', target: 'all_resources', value: 1.3, description: '全部资源产出 ×1.3' }],
  },
  {
    id: 'eco_3b', name: '丝绸之路', description: '铜钱产出 +50%，商队往来',
    requires: ['eco_2', 'eco_2b'], cost: { gold: 5000, grain: 800 }, researchTime: 90000,
    tier: 3, icon: '🐪', branch: 'economy',
    effects: [{ type: 'multiplier', target: 'gold', value: 1.5, description: '铜钱产出 +50%' }],
  },
  {
    id: 'eco_3c', name: '铜钱铸造', description: '铜钱产出 +40%，钱币标准化',
    requires: ['eco_2b'], cost: { gold: 4000, iron: 300 }, researchTime: 80000,
    tier: 3, icon: '🪙', branch: 'economy',
    effects: [{ type: 'multiplier', target: 'gold', value: 1.4, description: '铜钱产出 +40%' }],
  },
  {
    id: 'eco_4', name: '富国强兵', description: '全部产出 ×2.0',
    requires: ['eco_3'], cost: { gold: 25000 }, researchTime: 180000,
    tier: 4, icon: '👑', branch: 'economy',
    effects: [{ type: 'multiplier', target: 'all_resources', value: 2.0, description: '全部产出 ×2.0' }],
  },
  // ── 文化路线 ──
  {
    id: 'cul_1', name: '招贤纳士', description: '武将招募费用 -15%',
    requires: [], cost: { gold: 600 }, researchTime: 30000,
    tier: 1, icon: '📝', branch: 'culture',
    effects: [{ type: 'modifier', target: 'recruit_cost', value: -0.15, description: '招募费用 -15%' }],
  },
  {
    id: 'cul_2', name: '礼贤下士', description: '武将经验 +25%',
    requires: ['cul_1'], cost: { gold: 2500 }, researchTime: 60000,
    tier: 2, icon: '🎓', branch: 'culture',
    effects: [{ type: 'multiplier', target: 'general_exp', value: 1.25, description: '武将经验 +25%' }],
  },
  {
    id: 'cul_2b', name: '招贤令', description: '解锁高级武将招募，招募费用 -10%',
    requires: ['cul_1'], cost: { gold: 2000, grain: 500 }, researchTime: 45000,
    tier: 2, icon: '📜', branch: 'culture',
    effects: [{ type: 'modifier', target: 'recruit_cost', value: -0.1, description: '招募费用 -10%' }],
  },
  {
    id: 'cul_3', name: '王道仁政', description: '声望收益 +30%',
    requires: ['cul_2'], cost: { gold: 10000 }, researchTime: 120000,
    tier: 3, icon: '🏛️', branch: 'culture',
    effects: [{ type: 'multiplier', target: 'prestige_gain', value: 1.3, description: '声望收益 +30%' }],
  },
  {
    id: 'cul_3b', name: '礼贤下士·贰', description: '武将经验 +40%，广纳天下英才',
    requires: ['cul_2', 'cul_2b'], cost: { gold: 8000, grain: 1000 }, researchTime: 90000,
    tier: 3, icon: '🤝', branch: 'culture',
    effects: [{ type: 'multiplier', target: 'general_exp', value: 1.4, description: '武将经验 +40%' }],
  },
  {
    id: 'cul_3c', name: '王道仁政·贰', description: '民心恢复 +50%，仁政安民',
    requires: ['cul_2b'], cost: { gold: 7000, grain: 800 }, researchTime: 80000,
    tier: 3, icon: '🕊️', branch: 'culture',
    effects: [{ type: 'multiplier', target: 'morale_recovery', value: 1.5, description: '民心恢复 +50%' }],
  },
  {
    id: 'cul_4', name: '天下归心', description: '全部加成 ×1.5',
    requires: ['cul_3'], cost: { gold: 40000 }, researchTime: 180000,
    tier: 4, icon: '🌟', branch: 'culture',
    effects: [{ type: 'multiplier', target: 'all', value: 1.5, description: '全部加成 ×1.5' }],
  },
];

// ═══════════════════════════════════════════════════════════════
// 战斗系统 (5关卡 × 3波 = 15场战斗)
// ═══════════════════════════════════════════════════════════════

export const BATTLES: BattleDef[] = [
  // ── 关卡1：黄巾贼 ──
  {
    id: 'yellow_1', stageId: 'yellow_turban', wave: 1,
    enemies: [{ id: 'yellow_soldier', name: '黄巾力士', hp: 100, attack: 15, defense: 5, drops: { grain: 0.3 }, abilities: [], isBoss: false }],
    rewards: { grain: 50 }, timeLimit: 0, tags: [],
  },
  {
    id: 'yellow_2', stageId: 'yellow_turban', wave: 2,
    enemies: [{ id: 'yellow_mage', name: '黄巾术士', hp: 150, attack: 20, defense: 8, drops: { gold: 0.2 }, abilities: [], isBoss: false }],
    rewards: { gold: 30 }, timeLimit: 0, tags: [],
  },
  {
    id: 'yellow_3', stageId: 'yellow_turban', wave: 3,
    enemies: [{ id: 'zhangjiao', name: '张角', hp: 300, attack: 30, defense: 12, drops: { troops: 0.1 }, abilities: ['thunder'], isBoss: true }],
    rewards: { grain: 100, gold: 50 }, timeLimit: 0, tags: ['boss'],
  },
  // ── 关卡2：董卓军 ──
  {
    id: 'dongzhuo_1', stageId: 'dongzhuo', wave: 1,
    enemies: [{ id: 'xiliang_cavalry', name: '西凉铁骑', hp: 250, attack: 35, defense: 15, drops: { troops: 0.3 }, abilities: [], isBoss: false }],
    rewards: { troops: 80 }, timeLimit: 0, tags: [],
  },
  {
    id: 'dongzhuo_2', stageId: 'dongzhuo', wave: 2,
    enemies: [{ id: 'feixiong_army', name: '飞熊军', hp: 350, attack: 40, defense: 20, drops: { gold: 0.3 }, abilities: [], isBoss: false }],
    rewards: { gold: 80 }, timeLimit: 0, tags: [],
  },
  {
    id: 'dongzhuo_3', stageId: 'dongzhuo', wave: 3,
    enemies: [{ id: 'lvbu', name: '吕布', hp: 800, attack: 60, defense: 25, drops: { troops: 0.2 }, abilities: ['unmatched'], isBoss: true }],
    rewards: { gold: 200, troops: 150 }, timeLimit: 0, tags: ['boss'],
  },
  // ── 关卡3：袁绍军 ──
  {
    id: 'yuanshao_1', stageId: 'yuanshao', wave: 1,
    enemies: [{ id: 'hebei_archer', name: '河北弓手', hp: 300, attack: 30, defense: 18, drops: { grain: 0.3 }, abilities: [], isBoss: false }],
    rewards: { grain: 150 }, timeLimit: 0, tags: [],
  },
  {
    id: 'yuanshao_2', stageId: 'yuanshao', wave: 2,
    enemies: [{ id: 'jizhou_elite', name: '冀州精兵', hp: 450, attack: 45, defense: 25, drops: { troops: 0.3 }, abilities: [], isBoss: false }],
    rewards: { troops: 120 }, timeLimit: 0, tags: [],
  },
  {
    id: 'yuanshao_3', stageId: 'yuanshao', wave: 3,
    enemies: [{ id: 'yuanshao', name: '袁绍', hp: 1000, attack: 55, defense: 30, drops: { gold: 0.4 }, abilities: ['rally'], isBoss: true }],
    rewards: { gold: 300, grain: 200 }, timeLimit: 0, tags: ['boss'],
  },
  // ── 关卡4：赤壁大战 ──
  {
    id: 'chibi_1', stageId: 'chibi', wave: 1,
    enemies: [{ id: 'cao_vanguard', name: '曹军先锋', hp: 500, attack: 50, defense: 30, drops: { troops: 0.4 }, abilities: [], isBoss: false }],
    rewards: { troops: 200 }, timeLimit: 0, tags: [],
  },
  {
    id: 'chibi_2', stageId: 'chibi', wave: 2,
    enemies: [{ id: 'tiger_cavalry', name: '虎豹骑', hp: 700, attack: 65, defense: 35, drops: { gold: 0.4 }, abilities: ['charge'], isBoss: false }],
    rewards: { gold: 250 }, timeLimit: 0, tags: [],
  },
  {
    id: 'chibi_3', stageId: 'chibi', wave: 3,
    enemies: [{ id: 'caocao_chibi', name: '曹操(赤壁)', hp: 2000, attack: 80, defense: 40, drops: { troops: 0.3 }, abilities: ['ambition'], isBoss: true }],
    rewards: { gold: 500, troops: 400 }, timeLimit: 0, tags: ['boss'],
  },
  // ── 关卡5：北伐中原 ──
  {
    id: 'beifa_1', stageId: 'beifa', wave: 1,
    enemies: [{ id: 'wei_garrison', name: '魏国守军', hp: 800, attack: 70, defense: 40, drops: { grain: 0.4 }, abilities: [], isBoss: false }],
    rewards: { grain: 400 }, timeLimit: 0, tags: [],
  },
  {
    id: 'beifa_2', stageId: 'beifa', wave: 2,
    enemies: [{ id: 'elite_guard', name: '精锐禁卫', hp: 1200, attack: 85, defense: 50, drops: { gold: 0.5 }, abilities: ['shield_wall'], isBoss: false }],
    rewards: { gold: 500 }, timeLimit: 0, tags: [],
  },
  {
    id: 'beifa_3', stageId: 'beifa', wave: 3,
    enemies: [{ id: 'simayi_final', name: '司马懿', hp: 3500, attack: 100, defense: 60, drops: { troops: 0.5 }, abilities: ['stratagem', 'endurance'], isBoss: true }],
    rewards: { gold: 1000, troops: 800, grain: 800 }, timeLimit: 0, tags: ['boss', 'final'],
  },
];

// ═══════════════════════════════════════════════════════════════
// 阶段系统 (6个历史阶段)
// ═══════════════════════════════════════════════════════════════

export const STAGES: StageDef[] = [
  {
    id: 'yellow_turban', name: '黄巾之乱', description: '天下大乱，群雄并起',
    order: 1, prerequisiteStageId: null,
    requiredResources: {}, requiredConditions: [], rewards: [],
    productionMultiplier: 1.0, combatMultiplier: 1.0,
    iconAsset: '⚔️', themeColor: '#8b4513',
  },
  {
    id: 'warlords', name: '群雄割据', description: '诸侯争霸，逐鹿中原',
    order: 2, prerequisiteStageId: 'yellow_turban',
    requiredResources: { grain: 500, gold: 300 },
    requiredConditions: [],
    rewards: [{ type: 'feature', targetId: 'barracks', value: 1 }],
    productionMultiplier: 1.2, combatMultiplier: 1.1,
    iconAsset: '🏰', themeColor: '#a0522d',
  },
  {
    id: 'guandu', name: '官渡之战', description: '以少胜多，奠定北方',
    order: 3, prerequisiteStageId: 'warlords',
    requiredResources: { grain: 3000, gold: 2000, troops: 1000 },
    requiredConditions: [],
    rewards: [{ type: 'feature', targetId: 'academy', value: 1 }],
    productionMultiplier: 1.5, combatMultiplier: 1.3,
    iconAsset: '🗡️', themeColor: '#b8860b',
  },
  {
    id: 'chibi', name: '赤壁之战', description: '火烧赤壁，三分天下',
    order: 4, prerequisiteStageId: 'guandu',
    requiredResources: { grain: 10000, gold: 8000, troops: 5000 },
    requiredConditions: [],
    rewards: [{ type: 'feature', targetId: 'wall', value: 1 }],
    productionMultiplier: 2.0, combatMultiplier: 1.6,
    iconAsset: '🔥', themeColor: '#cd853f',
  },
  {
    id: 'tripartite', name: '三国鼎立', description: '三足鼎立，天下未定',
    order: 5, prerequisiteStageId: 'chibi',
    requiredResources: { grain: 50000, gold: 30000, troops: 20000 },
    requiredConditions: [],
    rewards: [{ type: 'feature', targetId: 'all_generals', value: 1 }],
    productionMultiplier: 2.5, combatMultiplier: 2.0,
    iconAsset: '👑', themeColor: '#daa520',
  },
  {
    id: 'unification', name: '一统天下', description: '终结乱世，天下一统',
    order: 6, prerequisiteStageId: 'tripartite',
    requiredResources: { grain: 200000, gold: 100000, troops: 80000 },
    requiredConditions: [],
    rewards: [{ type: 'multiplier', targetId: 'all', value: 2 }],
    productionMultiplier: 3.0, combatMultiplier: 2.5,
    iconAsset: '🏆', themeColor: '#ffd700',
  },
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
// UI 色彩主题
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// UI 色彩主题 — 三国古风配色
// 从纯黑背景升级为深棕/暗金渐变，加入三国经典色调
// ═══════════════════════════════════════════════════════════════

export const COLOR_THEME: UIColorScheme = {
  bgGradient1: '#1a0f05',         // 深墨棕 — 古卷底色（更深沉）
  bgGradient2: '#3a2010',         // 暗赤金 — 古风氛围（更浓烈）
  textPrimary: '#f8f0dc',         // 米白 — 宣纸色（更亮）
  textSecondary: '#d8c8a8',       // 浅棕灰（更暖）
  textDim: '#b09060',             // 暗棕灰（更明显）
  accentGold: '#f0c040',          // 赤金 — 帝王金（更鲜亮）
  accentGreen: '#5aaa4a',         // 翠墨绿（更鲜明）
  panelBg: 'rgba(60,35,15,0.75)', // 半透明深棕（更深沉）
  selectedBg: 'rgba(240,192,64,0.22)',  // 金色选中（更明显）
  selectedBorder: 'rgba(240,192,64,0.7)',
  affordable: '#5aaa4a',
  unaffordable: '#6a5a4a',
};

// ═══════════════════════════════════════════════════════════════
// 稀有度颜色
// ═══════════════════════════════════════════════════════════════

export const RARITY_COLORS: Record<string, string> = {
  common: '#bbbbbb',
  uncommon: '#5cbf60',
  rare: '#42a5f5',
  epic: '#ab47bc',
  legendary: '#ffa726',
  mythic: '#ff5252',
};

// ═══════════════════════════════════════════════════════════════
// 资源定义
// ═══════════════════════════════════════════════════════════════

/**
 * 4种核心资源 — PRD RES-1
 *
 * | 资源 | 存储上限 | 色彩标识 |
 * |------|---------|---------|
 * | 粮草 | 初始2,000 | 翠竹绿 #7EC850 |
 * | 铜钱 | ∞（无上限）| 古铜金 #C9A84C |
 * | 兵力 | 初始500 | 赤焰红 #B8423A |
 * | 天命 | ∞（无上限）| 天命紫 #7B5EA7 |
 */
export const RESOURCES = [
  { id: 'grain',   name: '粮草', icon: '🌾', color: '#7EC850' },
  { id: 'gold',    name: '铜钱', icon: '💰', color: '#C9A84C' },
  { id: 'troops',  name: '兵力', icon: '⚔️', color: '#B8423A' },
  { id: 'destiny', name: '天命', icon: '👑', color: '#7B5EA7' },
];

// ═══════════════════════════════════════════════════════════════
// 初始资源
// ═══════════════════════════════════════════════════════════════

/**
 * 初始资源 — PRD RES-1
 *
 * 粮草: 500 (PRD RES-1)
 * 铜钱: 300 (PRD RES-1)
 * 兵力: 100 (PRD RES-1)
 * 天命: 0 (PRD RES-1: 通过转生/成就/远征获取)
 */
export const INITIAL_RESOURCES: Record<string, number> = {
  grain: 500,
  gold: 300,
  troops: 100,
  destiny: 0,
};

// ═══════════════════════════════════════════════════════════════
// 初始解锁建筑
// ═══════════════════════════════════════════════════════════════

/**
 * 初始解锁建筑 — PRD BLD-4
 *
 * 主城Lv1: 初始解锁主城、农田
 * 主城Lv2: 解锁市集、兵营
 * 主城Lv3: 解锁铁匠铺、书院
 * 主城Lv4: 解锁医馆
 * 主城Lv5: 解锁城墙
 */
export const INITIALLY_UNLOCKED: string[] = [
  'castle',
  'farm',
];

// ═══════════════════════════════════════════════════════════════
// 点击产出
// ═══════════════════════════════════════════════════════════════

export const CLICK_REWARD = { grain: 1 };

// ═══════════════════════════════════════════════════════════════
// 免费赠送武将（新手福利）
// ═══════════════════════════════════════════════════════════════

/** 新手免费赠送的武将 ID（取第一个 uncommon 武将） */
export const FREE_STARTER_HERO = GENERALS.find(g => g.rarity === 'uncommon')?.id ?? 'xuchu';

// ═══════════════════════════════════════════════════════════════
// v3.0 关卡系统 (6章 × 3关 = 18个关卡)
// ═══════════════════════════════════════════════════════════════

/** 关卡敌人定义 */
export interface LevelStageEnemy {
  name: string;
  attack: number;
  defense: number;
  hp: number;
}

/** 关卡定义 */
export interface LevelStageData {
  id: string;
  chapter: number;
  chapterName: string;
  name: string;
  description: string;
  recommendedPower: number;
  enemies: LevelStageEnemy[];
  rewards: { resource: string; amount: number }[];
  prevStageId?: string;
}

/** 18个关卡数据（6章 × 3关） */
export const LEVEL_STAGES: LevelStageData[] = [
  // 第一章 黄巾之乱
  { id: 's1_1', chapter: 1, chapterName: '黄巾之乱', name: '黄巾前哨', description: '黄巾贼四处劫掠，前方发现敌军前哨', recommendedPower: 50, enemies: [{ name: '黄巾兵', attack: 8, defense: 3, hp: 30 }], rewards: [{ resource: 'grain', amount: 30 }, { resource: 'gold', amount: 50 }], prevStageId: undefined },
  { id: 's1_2', chapter: 1, chapterName: '黄巾之乱', name: '广宗之战', description: '张角主力盘踞广宗，需正面突破', recommendedPower: 80, enemies: [{ name: '黄巾力士', attack: 12, defense: 5, hp: 50 }, { name: '黄巾术士', attack: 10, defense: 3, hp: 35 }], rewards: [{ resource: 'grain', amount: 50 }, { resource: 'gold', amount: 80 }, { resource: 'iron', amount: 20 }], prevStageId: 's1_1' },
  { id: 's1_3', chapter: 1, chapterName: '黄巾之乱', name: '黄巾大营', description: '黄巾首领张角在此坐镇', recommendedPower: 120, enemies: [{ name: '张角', attack: 18, defense: 8, hp: 80 }, { name: '黄巾精锐', attack: 14, defense: 6, hp: 45 }], rewards: [{ resource: 'grain', amount: 100 }, { resource: 'gold', amount: 150 }, { resource: 'iron', amount: 50 }], prevStageId: 's1_2' },
  // 第二章 群雄割据
  { id: 's2_1', chapter: 2, chapterName: '群雄割据', name: '汜水关', description: '诸侯联军攻打汜水关', recommendedPower: 160, enemies: [{ name: '华雄', attack: 22, defense: 10, hp: 100 }], rewards: [{ resource: 'grain', amount: 80 }, { resource: 'gold', amount: 120 }], prevStageId: 's1_3' },
  { id: 's2_2', chapter: 2, chapterName: '群雄割据', name: '虎牢关', description: '吕布镇守虎牢关，天下第一猛将', recommendedPower: 220, enemies: [{ name: '吕布', attack: 30, defense: 15, hp: 150 }], rewards: [{ resource: 'grain', amount: 120 }, { resource: 'gold', amount: 200 }, { resource: 'iron', amount: 80 }], prevStageId: 's2_1' },
  { id: 's2_3', chapter: 2, chapterName: '群雄割据', name: '董卓之乱', description: '董卓祸乱朝纲，需一举歼灭', recommendedPower: 280, enemies: [{ name: '董卓', attack: 25, defense: 20, hp: 180 }, { name: '李傕', attack: 18, defense: 10, hp: 80 }], rewards: [{ resource: 'grain', amount: 200 }, { resource: 'gold', amount: 300 }], prevStageId: 's2_2' },
  // 第三章 官渡之战
  { id: 's3_1', chapter: 3, chapterName: '官渡之战', name: '延津', description: '袁绍大军南下，延津首当其冲', recommendedPower: 350, enemies: [{ name: '袁绍先锋', attack: 28, defense: 15, hp: 130 }], rewards: [{ resource: 'grain', amount: 150 }, { resource: 'gold', amount: 250 }], prevStageId: 's2_3' },
  { id: 's3_2', chapter: 3, chapterName: '官渡之战', name: '白马', description: '颜良文丑率精兵驻守白马', recommendedPower: 420, enemies: [{ name: '颜良', attack: 35, defense: 18, hp: 160 }, { name: '文丑', attack: 32, defense: 16, hp: 150 }], rewards: [{ resource: 'grain', amount: 200 }, { resource: 'gold', amount: 350 }, { resource: 'iron', amount: 100 }], prevStageId: 's3_1' },
  { id: 's3_3', chapter: 3, chapterName: '官渡之战', name: '官渡决战', description: '决定北方霸主的关键之战', recommendedPower: 500, enemies: [{ name: '袁绍', attack: 40, defense: 25, hp: 250 }, { name: '张郃', attack: 35, defense: 20, hp: 180 }], rewards: [{ resource: 'grain', amount: 300 }, { resource: 'gold', amount: 500 }, { resource: 'iron', amount: 150 }], prevStageId: 's3_2' },
  // 第四章 赤壁之战
  { id: 's4_1', chapter: 4, chapterName: '赤壁之战', name: '借东风', description: '诸葛亮借东风，火烧连环船', recommendedPower: 600, enemies: [{ name: '曹军水师', attack: 38, defense: 20, hp: 200 }], rewards: [{ resource: 'grain', amount: 250 }, { resource: 'gold', amount: 400 }], prevStageId: 's3_3' },
  { id: 's4_2', chapter: 4, chapterName: '赤壁之战', name: '草船借箭', description: '大雾弥漫，草船趁势借箭十万', recommendedPower: 700, enemies: [{ name: '曹操', attack: 50, defense: 30, hp: 300 }], rewards: [{ resource: 'grain', amount: 350 }, { resource: 'gold', amount: 550 }, { resource: 'iron', amount: 200 }], prevStageId: 's4_1' },
  { id: 's4_3', chapter: 4, chapterName: '赤壁之战', name: '赤壁大战', description: '孙刘联军火烧赤壁，大败曹军', recommendedPower: 850, enemies: [{ name: '曹操主力', attack: 55, defense: 35, hp: 400 }, { name: '许褚', attack: 45, defense: 30, hp: 280 }], rewards: [{ resource: 'grain', amount: 500 }, { resource: 'gold', amount: 800 }, { resource: 'iron', amount: 300 }], prevStageId: 's4_2' },
  // 第五章 三国鼎立
  { id: 's5_1', chapter: 5, chapterName: '三国鼎立', name: '荆州之争', description: '荆州战略要地，三方争夺', recommendedPower: 1000, enemies: [{ name: '吕蒙', attack: 60, defense: 35, hp: 350 }], rewards: [{ resource: 'grain', amount: 400 }, { resource: 'gold', amount: 600 }], prevStageId: 's4_3' },
  { id: 's5_2', chapter: 5, chapterName: '三国鼎立', name: '夷陵之战', description: '刘备为关羽报仇，亲征东吴', recommendedPower: 1200, enemies: [{ name: '陆逊', attack: 70, defense: 40, hp: 450 }], rewards: [{ resource: 'grain', amount: 500 }, { resource: 'gold', amount: 800 }, { resource: 'iron', amount: 250 }], prevStageId: 's5_1' },
  { id: 's5_3', chapter: 5, chapterName: '三国鼎立', name: '五丈原', description: '诸葛亮最后一次北伐', recommendedPower: 1400, enemies: [{ name: '司马懿', attack: 80, defense: 50, hp: 500 }, { name: '司马昭', attack: 65, defense: 40, hp: 380 }], rewards: [{ resource: 'grain', amount: 600 }, { resource: 'gold', amount: 1000 }, { resource: 'iron', amount: 400 }], prevStageId: 's5_2' },
  // 第六章 一统天下
  { id: 's6_1', chapter: 6, chapterName: '一统天下', name: '合肥之战', description: '张辽威震逍遥津', recommendedPower: 1600, enemies: [{ name: '张辽', attack: 85, defense: 45, hp: 500 }], rewards: [{ resource: 'grain', amount: 600 }, { resource: 'gold', amount: 1000 }], prevStageId: 's5_3' },
  { id: 's6_2', chapter: 6, chapterName: '一统天下', name: '街亭之战', description: '马谡失街亭，北伐功亏一篑', recommendedPower: 1800, enemies: [{ name: '张郃', attack: 90, defense: 50, hp: 550 }], rewards: [{ resource: 'grain', amount: 800 }, { resource: 'gold', amount: 1200 }, { resource: 'iron', amount: 500 }], prevStageId: 's6_1' },
  { id: 's6_3', chapter: 6, chapterName: '一统天下', name: '天下归一', description: '最终决战，统一天下！', recommendedPower: 2000, enemies: [{ name: '最终BOSS', attack: 100, defense: 60, hp: 800 }, { name: '精英护卫', attack: 75, defense: 45, hp: 400 }], rewards: [{ resource: 'grain', amount: 1000 }, { resource: 'gold', amount: 2000 }, { resource: 'iron', amount: 800 }], prevStageId: 's6_2' },
];

// ═══════════════════════════════════════════════════════════════
// v1.0 数据表 — 严格按PRD数值表
// ═══════════════════════════════════════════════════════════════

/**
 * 主城等级→建筑解锁映射 — PRD BLD-4
 *
 * | 主城等级 | 解锁建筑 |
 * |---------|---------|
 * | Lv1     | 主城、农田 |
 * | Lv2     | 市集、兵营 |
 * | Lv3     | 铁匠铺、书院 |
 * | Lv4     | 医馆 |
 * | Lv5     | 城墙 |
 */
export const CASTLE_UNLOCK_MAP: Record<number, string[]> = {
  1: ['castle', 'farm'],
  2: ['market', 'barracks'],
  3: ['smithy', 'academy'],
  4: ['clinic'],
  5: ['wall'],
};

/**
 * 获取建筑解锁所需的主城等级
 */
export function getUnlockCastleLevel(buildingId: string): number {
  for (const [level, ids] of Object.entries(CASTLE_UNLOCK_MAP)) {
    if (ids.includes(buildingId)) return Number(level);
  }
  return 0;
}

/**
 * 主城等级→全资源加成 — PRD BLD-2
 *
 * Lv1: 0%, Lv2: +2%, Lv3: +4%, ... Lv10: +18%
 * Lv10~15: +20%~28%, Lv15~20: +30%~38%
 * Lv20~25: +40%~48%, Lv25~30: +50%~58%
 */
export function getCastleBonusPercent(castleLevel: number): number {
  if (castleLevel <= 1) return 0;
  if (castleLevel <= 10) return (castleLevel - 1) * 2;
  return 18 + (castleLevel - 10) * 2;
}

/**
 * 资源上限配置 — PRD RES-4
 *
 * | 资源 | 初始上限 | 上限来源 |
 * |------|---------|---------|
 * | 粮草 | 2,000   | 农田等级 |
 * | 铜钱 | ∞       | 无上限   |
 * | 兵力 | 500     | 兵营等级 |
 * | 天命 | ∞       | 无上限   |
 */
export const RESOURCE_CAPS: Record<string, { hasCap: boolean; initialCap: number; capBuilding: string | null }> = {
  grain:   { hasCap: true,  initialCap: 2000, capBuilding: 'farm' },
  gold:    { hasCap: false, initialCap: Infinity, capBuilding: null },
  troops:  { hasCap: true,  initialCap: 500,  capBuilding: 'barracks' },
  destiny: { hasCap: false, initialCap: Infinity, capBuilding: null },
};

/**
 * 粮草上限表 — PRD RES-4 仓库升级容量表
 *
 * 粮仓等级（=农田等级）→ 粮草上限
 */
export const GRAIN_CAP_TABLE: Record<number, number> = {
  1: 2000, 5: 5000, 10: 12000, 15: 25000, 20: 50000, 25: 100000,
};

/**
 * 兵力上限表 — PRD RES-4 兵营容量表
 *
 * 兵营等级 → 兵力上限
 */
export const TROOPS_CAP_TABLE: Record<number, number> = {
  1: 500, 5: 1200, 10: 3000, 15: 6000, 20: 12000, 25: 25000,
};

/**
 * 获取粮草上限（基于农田等级，线性插值）
 */
export function getGrainCap(farmLevel: number): number {
  if (farmLevel <= 0) return 2000;
  if (farmLevel > 25) return 100000;
  if (GRAIN_CAP_TABLE[farmLevel] !== undefined) return GRAIN_CAP_TABLE[farmLevel];
  const levels = [1, 5, 10, 15, 20, 25];
  for (let i = 0; i < levels.length - 1; i++) {
    if (farmLevel > levels[i] && farmLevel < levels[i + 1]) {
      const t = (farmLevel - levels[i]) / (levels[i + 1] - levels[i]);
      return Math.floor(GRAIN_CAP_TABLE[levels[i]] + t * (GRAIN_CAP_TABLE[levels[i + 1]] - GRAIN_CAP_TABLE[levels[i]]));
    }
  }
  return 2000;
}

/**
 * 获取兵力上限（基于兵营等级，线性插值）
 */
export function getTroopsCap(barracksLevel: number): number {
  if (barracksLevel <= 0) return 500;
  if (barracksLevel > 25) return 25000;
  if (TROOPS_CAP_TABLE[barracksLevel] !== undefined) return TROOPS_CAP_TABLE[barracksLevel];
  const levels = [1, 5, 10, 15, 20, 25];
  for (let i = 0; i < levels.length - 1; i++) {
    if (barracksLevel > levels[i] && barracksLevel < levels[i + 1]) {
      const t = (barracksLevel - levels[i]) / (levels[i + 1] - levels[i]);
      return Math.floor(TROOPS_CAP_TABLE[levels[i]] + t * (TROOPS_CAP_TABLE[levels[i + 1]] - TROOPS_CAP_TABLE[levels[i]]));
    }
  }
  return 500;
}

/**
 * 主城升级费用表 — PRD BLD-2
 *
 * 精确值（currentLevel → 升到 currentLevel+1 的费用）:
 * 1→2: 粮200 铜150 兵0
 * 2→3: 粮500 铜400 兵50
 * 3→4: 粮1200 铜900 兵150
 * 4→5: 粮2500 铜2000 兵400
 * 5→6: 粮5000 铜4000 兵800
 * 6→7: 粮9000 铜7500 兵1500
 * 7→8: 粮15000 铜12000 兵3000
 * 8→9: 粮25000 铜20000 兵5000
 * 9→10: 粮40000 铜32000 兵8000
 * 10→15: 每级×1.8
 * 15→20: 每级×1.6
 * 20→25: 每级×1.5
 * 25→30: 每级×1.4
 */
export const CASTLE_COST_TABLE: Record<number, { grain: number; gold: number; troops: number }> = {
  1: { grain: 200, gold: 150, troops: 0 },
  2: { grain: 500, gold: 400, troops: 50 },
  3: { grain: 1200, gold: 900, troops: 150 },
  4: { grain: 2500, gold: 2000, troops: 400 },
  5: { grain: 5000, gold: 4000, troops: 800 },
  6: { grain: 9000, gold: 7500, troops: 1500 },
  7: { grain: 15000, gold: 12000, troops: 3000 },
  8: { grain: 25000, gold: 20000, troops: 5000 },
  9: { grain: 40000, gold: 32000, troops: 8000 },
};

/**
 * 农田升级费用表 — PRD BLD-2
 *
 * 1→2: 粮100 铜50
 * 2→3: 粮250 铜120
 * 3→4: 粮500 铜250
 * 4→5: 粮1000 铜500
 * 5→10: 每级×1.8
 * 10→15: 每级×1.6
 * 15→20: 每级×1.5
 * 20→25: 每级×1.4
 */
export const FARM_COST_TABLE: Record<number, { grain: number; gold: number }> = {
  1: { grain: 100, gold: 50 },
  2: { grain: 250, gold: 120 },
  3: { grain: 500, gold: 250 },
  4: { grain: 1000, gold: 500 },
};

/**
 * 市集升级费用表 — PRD BLD-2
 *
 * 1→2: 粮80 铜100
 * 2→3: 粮200 铜250
 * 3→4: 粮400 铜500
 * 4→5: 粮800 铜1000
 * 5→25: 同农田曲线
 */
export const MARKET_COST_TABLE: Record<number, { grain: number; gold: number }> = {
  1: { grain: 80, gold: 100 },
  2: { grain: 200, gold: 250 },
  3: { grain: 400, gold: 500 },
  4: { grain: 800, gold: 1000 },
};

/**
 * 兵营升级费用表 — PRD BLD-2
 *
 * 1→2: 粮120 铜80 兵0
 * 2→3: 粮300 铜200 兵30
 * 3→4: 粮600 铜400 兵80
 * 4→5: 粮1200 铜800 兵200
 * 5→25: 同农田曲线，兵力消耗每级×1.8
 */
export const BARRACKS_COST_TABLE: Record<number, { grain: number; gold: number; troops: number }> = {
  1: { grain: 120, gold: 80, troops: 0 },
  2: { grain: 300, gold: 200, troops: 30 },
  3: { grain: 600, gold: 400, troops: 80 },
  4: { grain: 1200, gold: 800, troops: 200 },
};

/**
 * 铁匠铺升级费用表 — PRD BLD-2
 *
 * 1→2: 粮200 铜300
 * 2→3: 粮500 铜800
 * 3→5: 每级×2.0
 * 5→10: 每级×1.7
 * 10→20: 每级×1.5
 */
export const SMITHY_COST_TABLE: Record<number, { grain: number; gold: number }> = {
  1: { grain: 200, gold: 300 },
  2: { grain: 500, gold: 800 },
};

/**
 * 书院升级费用表 — PRD BLD-2
 *
 * 1→2: 粮150 铜200
 * 2→3: 粮400 铜500
 * 3→5: 每级×1.8
 * 5→10: 每级×1.6
 * 10→20: 每级×1.5
 */
export const ACADEMY_COST_TABLE: Record<number, { grain: number; gold: number }> = {
  1: { grain: 150, gold: 200 },
  2: { grain: 400, gold: 500 },
};

/**
 * 医馆升级费用表 — PRD BLD-2
 *
 * 1→2: 粮100 铜150
 * 2→5: 每级×1.8
 * 5→10: 每级×1.6
 * 10→20: 每级×1.5
 */
export const CLINIC_COST_TABLE: Record<number, { grain: number; gold: number }> = {
  1: { grain: 100, gold: 150 },
};

/**
 * 城墙升级费用表 — PRD BLD-2
 *
 * 1→2: 粮300 铜200 兵100
 * 2→3: 粮800 铜500 兵250
 * 3→5: 每级×2.0
 * 5→10: 每级×1.7
 * 10→20: 每级×1.5
 */
export const WALL_COST_TABLE: Record<number, { grain: number; gold: number; troops: number }> = {
  1: { grain: 300, gold: 200, troops: 100 },
  2: { grain: 800, gold: 500, troops: 250 },
};

/**
 * 农田产出表 — PRD BLD-2 & BLD-3
 *
 * Lv1: 0.8/s, Lv2: 1.0/s, Lv3: 1.5/s, Lv4: 2.2/s, Lv5: 3.0/s
 * Lv5~10: 3.0~8.0, Lv10~15: 8.0~16.0, Lv15~20: 16.0~28.0, Lv20~25: 28.0~45.0
 */
export const FARM_PRODUCTION_TABLE: Record<number, number> = {
  0: 0, 1: 0.8, 2: 1.0, 3: 1.5, 4: 2.2, 5: 3.0,
  10: 8.0, 15: 16.0, 20: 28.0, 25: 45.0,
};

/**
 * 市集产出表 — PRD BLD-2 & BLD-3
 *
 * Lv1: 0.6/s, Lv2: 0.8/s, Lv3: 1.2/s, Lv4: 1.8/s, Lv5: 2.5/s
 * Lv5~25: 同农田曲线比例
 */
export const MARKET_PRODUCTION_TABLE: Record<number, number> = {
  0: 0, 1: 0.6, 2: 0.8, 3: 1.2, 4: 1.8, 5: 2.5,
  10: 4.8, 15: 18.0, 20: 35.0, 25: 50.0,
};

/**
 * 兵营产出表 — PRD BLD-2 & BLD-3
 *
 * Lv1: 0.4/s, Lv2: 0.5/s, Lv3: 0.8/s, Lv4: 1.2/s, Lv5: 1.8/s
 * Lv5~25: 同农田曲线比例
 */
export const BARRACKS_PRODUCTION_TABLE: Record<number, number> = {
  0: 0, 1: 0.4, 2: 0.5, 3: 0.8, 4: 1.2, 5: 1.8,
  10: 3.2, 15: 14.0, 20: 28.0, 25: 40.0,
};

/**
 * 离线收益效率系数 — PRD RES-4 离线效率系数表
 *
 * | 离线时长 | 效率系数 |
 * |---------|---------|
 * | 0~2h    | 100%    |
 * | 2~8h    | 80%     |
 * | 8~24h   | 60%     |
 * | 24~48h  | 40%     |
 * | 48~72h  | 25%     |
 * | >72h    | 15%（封底）|
 */
export const OFFLINE_EFFICIENCY_TIERS = [
  { maxSeconds: 2 * 3600,  efficiency: 1.0 },
  { maxSeconds: 8 * 3600,  efficiency: 0.8 },
  { maxSeconds: 24 * 3600, efficiency: 0.6 },
  { maxSeconds: 48 * 3600, efficiency: 0.4 },
  { maxSeconds: 72 * 3600, efficiency: 0.25 },
];

/** 离线收益最大计算时长（72小时） */
export const MAX_OFFLINE_SECONDS = 72 * 3600;

/**
 * 自动保存键名
 */
export const AUTOSAVE_KEY = 'tk_autosave_v1';

/**
 * 自动保存间隔（毫秒）— PRD SPEC #24: 每30秒
 */
export const AUTOSAVE_INTERVAL = 30000;
