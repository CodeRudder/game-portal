// 三国霸业 — 游戏常量配置
//
// 所有类型内联定义，不导入任何外部模块。

// ═══════════════════════════════════════════════════════════════
// 内联类型定义
// ═══════════════════════════════════════════════════════════════

/** 建筑定义 */
export interface BuildingDef {
  id: string;
  name: string;
  icon: string;
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
// 建筑系统 (8个)
// ═══════════════════════════════════════════════════════════════

export const BUILDINGS: BuildingDef[] = [
  {
    id: 'farm', name: '农田', icon: '🌾',
    baseCost: { grain: 10 }, costMultiplier: 1.07, maxLevel: 0,
    productionResource: 'grain', baseProduction: 0.1,
    unlockCondition: '初始解锁',
  },
  {
    id: 'market', name: '市集', icon: '💰',
    baseCost: { grain: 50 }, costMultiplier: 1.08, maxLevel: 0,
    productionResource: 'gold', baseProduction: 0.08,
    unlockCondition: '初始解锁',
  },
  {
    id: 'barracks', name: '兵营', icon: '⚔️',
    baseCost: { grain: 30, gold: 20 }, costMultiplier: 1.09, maxLevel: 0,
    productionResource: 'troops', baseProduction: 0.05,
    unlockCondition: '累计 100 粮草',
  },
  {
    id: 'smithy', name: '铁匠铺', icon: '🔨',
    baseCost: { gold: 100, troops: 30 }, costMultiplier: 1.10, maxLevel: 0,
    productionResource: 'troops', baseProduction: 0.08,
    requires: ['barracks'],
    unlockCondition: '兵营 Lv.3',
  },
  {
    id: 'academy', name: '书院', icon: '📚',
    baseCost: { gold: 200 }, costMultiplier: 1.12, maxLevel: 0,
    productionResource: 'gold', baseProduction: 0.15,
    unlockCondition: '累计 500 铜钱',
  },
  {
    id: 'clinic', name: '医馆', icon: '💊',
    baseCost: { gold: 80, grain: 60 }, costMultiplier: 1.08, maxLevel: 0,
    productionResource: 'grain', baseProduction: 0.12,
    unlockCondition: '累计 300 粮草',
  },
  {
    id: 'wall', name: '城墙', icon: '🏰',
    baseCost: { gold: 150, troops: 50 }, costMultiplier: 1.15, maxLevel: 0,
    productionResource: 'troops', baseProduction: 0.03,
    requires: ['barracks'],
    unlockCondition: '兵营 Lv.5',
  },
  {
    id: 'tavern', name: '招贤馆', icon: '🏯',
    baseCost: { gold: 500 }, costMultiplier: 1.18, maxLevel: 0,
    productionResource: 'gold', baseProduction: 0.2,
    requires: ['academy'],
    unlockCondition: '书院 Lv.3',
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
    id: 'mil_3', name: '神兵利器', description: '兵力产出 ×2.0',
    requires: ['mil_2'], cost: { gold: 8000 }, researchTime: 120000,
    tier: 3, icon: '🗡️', branch: 'military',
    effects: [{ type: 'multiplier', target: 'troops', value: 2.0, description: '兵力产出 ×2.0' }],
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
    id: 'eco_3', name: '治国安邦', description: '全部资源产出 ×1.3',
    requires: ['eco_2'], cost: { gold: 6000 }, researchTime: 120000,
    tier: 3, icon: '📜', branch: 'economy',
    effects: [{ type: 'multiplier', target: 'all_resources', value: 1.3, description: '全部资源产出 ×1.3' }],
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
    id: 'cul_3', name: '王道仁政', description: '声望收益 +30%',
    requires: ['cul_2'], cost: { gold: 10000 }, researchTime: 120000,
    tier: 3, icon: '🏛️', branch: 'culture',
    effects: [{ type: 'multiplier', target: 'prestige_gain', value: 1.3, description: '声望收益 +30%' }],
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

export const COLOR_THEME: UIColorScheme = {
  bgGradient1: '#1a0a0a',
  bgGradient2: '#2d1b1b',
  textPrimary: '#ffffff',
  textSecondary: '#cccccc',
  textDim: '#888888',
  accentGold: '#ffd700',
  accentGreen: '#4caf50',
  panelBg: 'rgba(255,255,255,0.05)',
  selectedBg: 'rgba(255,215,0,0.1)',
  selectedBorder: 'rgba(255,215,0,0.4)',
  affordable: '#4caf50',
  unaffordable: '#666666',
};

// ═══════════════════════════════════════════════════════════════
// 稀有度颜色
// ═══════════════════════════════════════════════════════════════

export const RARITY_COLORS: Record<string, string> = {
  common: '#aaaaaa',
  uncommon: '#4caf50',
  rare: '#2196f3',
  epic: '#9c27b0',
  legendary: '#ff9800',
  mythic: '#ff4444',
};

// ═══════════════════════════════════════════════════════════════
// 资源定义
// ═══════════════════════════════════════════════════════════════

export const RESOURCES = [
  { id: 'grain', name: '粮草', icon: '🌾' },
  { id: 'gold', name: '铜钱', icon: '💰' },
  { id: 'troops', name: '兵力', icon: '⚔️' },
  { id: 'destiny', name: '天命', icon: '👑' },
];

// ═══════════════════════════════════════════════════════════════
// 初始资源
// ═══════════════════════════════════════════════════════════════

export const INITIAL_RESOURCES: Record<string, number> = {
  grain: 50,
  gold: 0,
  troops: 0,
  destiny: 0,
};

// ═══════════════════════════════════════════════════════════════
// 初始解锁建筑
// ═══════════════════════════════════════════════════════════════

export const INITIALLY_UNLOCKED: string[] = ['farm'];

// ═══════════════════════════════════════════════════════════════
// 点击产出
// ═══════════════════════════════════════════════════════════════

export const CLICK_REWARD = { grain: 1 };
