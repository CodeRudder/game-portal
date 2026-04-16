/**
 * 三国霸业 — 征战关卡系统
 *
 * 关卡设计为游戏故事挑战关卡（攻城略地），而非科技树。
 * 每个关卡对应一座城市/要塞的攻占，包含：
 * - 关卡地图（城池布局）
 * - 敌方守军配置
 * - 胜利条件（攻破城门/击败守将/全歼敌军）
 * - 失败条件（兵力耗尽/超时）
 * - 星级评价
 * - 关卡奖励（领土+资源+武将）
 *
 * 关卡进度与故事线关联，逐步解锁三国历史事件。
 *
 * @module games/three-kingdoms/CampaignSystem
 */

// ═══════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════

/** 关卡难度 */
export type CampaignDifficulty = 'easy' | 'normal' | 'hard';

/** 胜利条件类型 */
export type VictoryCondition =
  | 'defeat_commander'    // 击败守将
  | 'destroy_gate'       // 攻破城门
  | 'eliminate_all'      // 全歼敌军
  | 'survive_waves'      // 坚守N波
  | 'capture_flag';      // 占领旗帜

/** 关卡状态 */
export type CampaignStageStatus = 'locked' | 'available' | 'in_progress' | 'victory' | 'defeated';

/** 敌方将领 */
export interface EnemyCommander {
  id: string;
  name: string;
  title: string;          // 称号（如"飞将吕布"）
  hp: number;
  attack: number;
  defense: number;
  intelligence: number;
  abilities: string[];
  dialogue: {
    opening: string;      // 开战对话
    mid: string;          // 战中对话
    defeat: string;       // 战败对话
  };
}

/** 敌方兵种 */
export interface EnemyUnit {
  type: string;           // infantry/cavalry/archer/siege
  name: string;
  count: number;
  hpPerUnit: number;
  attackPerUnit: number;
  defensePerUnit: number;
}

/** 关卡地图布局 */
export interface CampaignMap {
  width: number;
  height: number;
  walls: Array<{ x: number; y: number; hp: number }>;
  gates: Array<{ x: number; y: number; hp: number; direction: 'north' | 'south' | 'east' | 'west' }>;
  towers: Array<{ x: number; y: number; attack: number; range: number }>;
  flagPositions: Array<{ x: number; y: number }>;
  deploymentZone: { x: number; y: number; width: number; height: number };
}

/** 关卡在地图上的坐标位置 */
export interface CampaignMapPosition {
  /** 地图上的 X 坐标（归一化 0-1） */
  x: number;
  /** 地图上的 Y 坐标（归一化 0-1） */
  y: number;
}

/** 关卡连接路线 */
export interface CampaignConnection {
  /** 起点关卡 ID */
  from: string;
  /** 终点关卡 ID */
  to: string;
  /** 路线类型 */
  type: 'main_road' | 'mountain_pass' | 'river_crossing' | 'plain';
}

/** 关卡定义 */
export interface CampaignStage {
  id: string;
  name: string;
  subtitle: string;         // 副标题（如"第一战·涿郡"）
  description: string;      // 故事背景描述
  order: number;
  prerequisiteStageId: string | null;

  // 目标城市
  targetTerritoryId: string;
  targetCityName: string;

  // 难度
  difficulty: CampaignDifficulty;

  // 胜利条件
  victoryCondition: VictoryCondition;
  victoryParams: Record<string, number>;  // 如 waves: 5

  // 敌方配置
  enemyCommander: EnemyCommander;
  enemyUnits: EnemyUnit[];

  // 城防等级（1-10）
  fortificationLevel: number;

  // 地图
  mapLayout: CampaignMap;

  // 地图坐标位置（用于关卡地图可视化）
  mapPosition: CampaignMapPosition;

  // 奖励
  rewards: {
    territory: string;              // 获得的领土ID
    resources: Record<string, number>;
    unlockHero?: string;            // 解锁的武将
    unlockFeature?: string;         // 解锁的功能
  };

  // 星级评价阈值
  starThresholds: {
    /** 3星：剩余兵力百分比 */
    threeStar: number;
    /** 2星：剩余兵力百分比 */
    twoStar: number;
  };

  // 视觉
  iconAsset: string;
  themeColor: string;
  backgroundImage?: string;
}

// ═══════════════════════════════════════════════════════════════
// 扩展关卡数据结构（战役详情）
// ═══════════════════════════════════════════════════════════════

/** 关卡详情难度（含 legendary） */
export type CampaignDetailDifficulty = 'easy' | 'normal' | 'hard' | 'legendary';

/** 兵力配置（步兵/骑兵/弓兵） */
export interface TroopComposition {
  infantry: number;
  cavalry: number;
  archers: number;
}

/** 关卡守军信息 */
export interface LevelDefender {
  /** 主将名称 */
  lord: string;
  /** 副将列表 */
  officers: string[];
  /** 兵力配置 */
  troops: TroopComposition;
  /** 城防等级 1-10 */
  fortLevel: number;
}

/** 关卡奖励 */
export interface CampaignLevelRewards {
  gold: number;
  food: number;
  materials: number;
  /** 可招募武将 ID */
  recruitHero?: string;
  /** 解锁建筑 ID */
  unlockBuilding?: string;
}

/** 关卡战斗配置 */
export interface LevelBattleConfig {
  difficulty: CampaignDetailDifficulty;
  /** 攻打冷却时间（秒） */
  cooldownSeconds: number;
  /** 最大尝试次数（0=无限） */
  maxAttempts: number;
}

/**
 * 关卡详情数据结构
 *
 * 在 CampaignStage 基础上提供更丰富的历史战役信息，
 * 包含守军兵力、奖励明细、战斗配置等。
 */
export interface CampaignLevelDetail {
  /** 关卡 ID（与 CampaignStage.id 一一对应） */
  id: string;
  /** 关卡名称 */
  name: string;
  /** 历史背景描述 */
  description: string;
  /** 在地图上的位置坐标（归一化 0-1） */
  mapPosition: { x: number; y: number };

  /** 守军信息 */
  defender: LevelDefender;

  /** 奖励 */
  rewards: CampaignLevelRewards;

  /** 关卡状态 */
  status: CampaignStageStatus;
  /** 前置关卡 ID */
  prerequisite: string | null;

  /** 战斗配置 */
  battleConfig: LevelBattleConfig;
}

/** 战斗结果（简化版，用于 CampaignSystem 内部计算） */
export interface CampaignBattleResult {
  victory: boolean;
  playerLosses: TroopComposition;
  enemyLosses: TroopComposition;
  /** 战斗回合数 */
  rounds: number;
  /** 战斗日志（每回合简报） */
  battleLog: string[];
  /** 胜利奖励（仅胜利时有） */
  rewards?: CampaignLevelRewards;
}

/** 关卡状态查询结果 */
export interface LevelStatusInfo {
  status: CampaignStageStatus;
  canAttack: boolean;
  reason?: string;
  cooldownRemaining: number;
  attemptsRemaining: number;
}

// ═══════════════════════════════════════════════════════════════
// 6 关卡详细数据（基于三国历史）
// ═══════════════════════════════════════════════════════════════

export const CAMPAIGN_LEVEL_DETAILS: CampaignLevelDetail[] = [
  // ── 第一章：涿郡起义 ──
  {
    id: 'campaign_zhuo',
    name: '涿郡起义',
    description: '东汉末年，黄巾之乱爆发，天下大乱。刘备在涿郡起兵，与关羽、张飞桃园结义，誓要匡扶汉室。首战涿郡，平定黄巾贼众，建立根据地。',
    mapPosition: { x: 0.15, y: 0.30 },
    defender: {
      lord: '黄巾渠帅',
      officers: ['黄巾力士头目', '黄巾弓手队长'],
      troops: { infantry: 500, cavalry: 100, archers: 200 },
      fortLevel: 2,
    },
    rewards: {
      gold: 500,
      food: 1000,
      materials: 200,
      recruitHero: 'liubei',
    },
    status: 'available',
    prerequisite: null,
    battleConfig: {
      difficulty: 'easy',
      cooldownSeconds: 10,
      maxAttempts: 0,
    },
  },

  // ── 第二章：虎牢关 ──
  {
    id: 'campaign_hulao',
    name: '虎牢关',
    description: '十八路诸侯讨伐董卓，兵至虎牢关。天下第一猛将吕布率西凉铁骑镇守此关，刘关张三兄弟联手迎战，三英战吕布传为佳话。',
    mapPosition: { x: 0.35, y: 0.25 },
    defender: {
      lord: '董卓',
      officers: ['吕布', '李儒', '华雄'],
      troops: { infantry: 5000, cavalry: 3000, archers: 2000 },
      fortLevel: 5,
    },
    rewards: {
      gold: 2000,
      food: 3000,
      materials: 800,
      recruitHero: 'guanyu',
    },
    status: 'locked',
    prerequisite: 'campaign_zhuo',
    battleConfig: {
      difficulty: 'normal',
      cooldownSeconds: 30,
      maxAttempts: 0,
    },
  },

  // ── 第三章：官渡之战 ──
  {
    id: 'campaign_guandu',
    name: '官渡之战',
    description: '建安五年，袁绍与曹操决战于官渡。袁绍坐拥河北四州，兵多将广；曹操以少胜多，奇袭乌巢，火烧粮草，一举击溃袁军十万大军。',
    mapPosition: { x: 0.50, y: 0.40 },
    defender: {
      lord: '袁绍',
      officers: ['颜良', '文丑', '张郃'],
      troops: { infantry: 8000, cavalry: 5000, archers: 4000 },
      fortLevel: 6,
    },
    rewards: {
      gold: 5000,
      food: 8000,
      materials: 2000,
      recruitHero: 'caocao',
      unlockBuilding: 'barracks',
    },
    status: 'locked',
    prerequisite: 'campaign_hulao',
    battleConfig: {
      difficulty: 'hard',
      cooldownSeconds: 60,
      maxAttempts: 0,
    },
  },

  // ── 第四章：赤壁之战 ──
  {
    id: 'campaign_chibi',
    name: '赤壁之战',
    description: '建安十三年，曹操率八十万大军南下，欲一统天下。孙刘联军以火攻大破曹军于赤壁，东风助势，火烧连营，奠定三分天下之格局。',
    mapPosition: { x: 0.55, y: 0.65 },
    defender: {
      lord: '曹操',
      officers: ['张辽', '许褚', '曹洪'],
      troops: { infantry: 10000, cavalry: 2000, archers: 8000 },
      fortLevel: 7,
    },
    rewards: {
      gold: 8000,
      food: 10000,
      materials: 3000,
      recruitHero: 'zhugeliang',
    },
    status: 'locked',
    prerequisite: 'campaign_guandu',
    battleConfig: {
      difficulty: 'hard',
      cooldownSeconds: 60,
      maxAttempts: 0,
    },
  },

  // ── 第五章：定军山 ──
  {
    id: 'campaign_dingjun',
    name: '定军山',
    description: '建安二十四年，刘备进取汉中。老将黄忠于定军山力斩曹魏名将夏侯渊，威震天下。此役夺取汉中要地，蜀汉基业由此奠定。',
    mapPosition: { x: 0.40, y: 0.75 },
    defender: {
      lord: '夏侯渊',
      officers: ['张郃', '郭淮', '曹真'],
      troops: { infantry: 12000, cavalry: 8000, archers: 6000 },
      fortLevel: 8,
    },
    rewards: {
      gold: 15000,
      food: 20000,
      materials: 5000,
      recruitHero: 'zhangfei',
    },
    status: 'locked',
    prerequisite: 'campaign_chibi',
    battleConfig: {
      difficulty: 'legendary',
      cooldownSeconds: 120,
      maxAttempts: 0,
    },
  },

  // ── 第六章：天下一统 ──
  {
    id: 'campaign_unification',
    name: '天下一统',
    description: '历经数十年征战，天下大势已定。最终决战于长安，司马懿率魏国精锐据守。攻克此城，天下一统，万民归心，三国归晋！',
    mapPosition: { x: 0.50, y: 0.50 },
    defender: {
      lord: '司马懿',
      officers: ['司马师', '司马昭', '邓艾', '钟会'],
      troops: { infantry: 20000, cavalry: 15000, archers: 10000 },
      fortLevel: 10,
    },
    rewards: {
      gold: 50000,
      food: 50000,
      materials: 20000,
    },
    status: 'locked',
    prerequisite: 'campaign_dingjun',
    battleConfig: {
      difficulty: 'legendary',
      cooldownSeconds: 180,
      maxAttempts: 0,
    },
  },
];

// ═══════════════════════════════════════════════════════════════
// 关卡数据
// ═══════════════════════════════════════════════════════════════

export const CAMPAIGN_STAGES: CampaignStage[] = [
  // ── 第一章：涿郡起兵 ──
  {
    id: 'campaign_zhuo',
    name: '涿郡起兵',
    subtitle: '第一章·桃园结义',
    description: '东汉末年，天下大乱。刘备、关羽、张飞桃园三结义，誓要匡扶汉室。第一战，攻占涿郡，建立根据地。',
    order: 1,
    prerequisiteStageId: null,
    targetTerritoryId: 'beiping',
    targetCityName: '涿郡',
    difficulty: 'easy',
    victoryCondition: 'eliminate_all',
    victoryParams: {},
    enemyCommander: {
      id: 'yellow_chief', name: '黄巾渠帅', title: '天公将军部下',
      hp: 200, attack: 15, defense: 8, intelligence: 5,
      abilities: ['rally'],
      dialogue: {
        opening: '苍天已死，黄天当立！',
        mid: '尔等休要猖狂！',
        defeat: '天意如此...',
      },
    },
    enemyUnits: [
      { type: 'infantry', name: '黄巾力士', count: 20, hpPerUnit: 30, attackPerUnit: 8, defensePerUnit: 3 },
      { type: 'archer', name: '黄巾弓手', count: 10, hpPerUnit: 20, attackPerUnit: 12, defensePerUnit: 2 },
    ],
    mapLayout: {
      width: 12, height: 10,
      walls: [
        { x: 3, y: 2, hp: 100 }, { x: 4, y: 2, hp: 100 }, { x: 5, y: 2, hp: 100 },
        { x: 3, y: 7, hp: 100 }, { x: 4, y: 7, hp: 100 }, { x: 5, y: 7, hp: 100 },
        { x: 3, y: 3, hp: 100 }, { x: 3, y: 4, hp: 100 }, { x: 3, y: 5, hp: 100 }, { x: 3, y: 6, hp: 100 },
        { x: 5, y: 3, hp: 100 }, { x: 5, y: 4, hp: 100 }, { x: 5, y: 5, hp: 100 }, { x: 5, y: 6, hp: 100 },
      ],
      gates: [{ x: 4, y: 4, hp: 150, direction: 'south' }],
      towers: [{ x: 3, y: 2, attack: 10, range: 3 }, { x: 5, y: 2, attack: 10, range: 3 }],
      flagPositions: [{ x: 4, y: 4 }],
      deploymentZone: { x: 0, y: 3, width: 3, height: 4 },
    },
    rewards: {
      territory: 'beiping',
      resources: { grain: 100, gold: 50 },
      unlockHero: 'liubei',
    },
    starThresholds: { threeStar: 80, twoStar: 50 },
    iconAsset: '⚔️', themeColor: '#4CAF50',
    fortificationLevel: 2,
    mapPosition: { x: 0.15, y: 0.30 },
  },

  // ── 第二章：虎牢关之战 ──
  {
    id: 'campaign_hulao',
    name: '虎牢关',
    subtitle: '第二章·三英战吕布',
    description: '诸侯联军讨伐董卓，兵至虎牢关。天下第一猛将吕布镇守此关，刘关张三兄弟联手迎战。',
    order: 2,
    prerequisiteStageId: 'campaign_zhuo',
    targetTerritoryId: 'luoyang',
    targetCityName: '虎牢关',
    difficulty: 'normal',
    victoryCondition: 'defeat_commander',
    victoryParams: {},
    enemyCommander: {
      id: 'lvbu', name: '吕布', title: '飞将·天下无双',
      hp: 800, attack: 60, defense: 25, intelligence: 15,
      abilities: ['unmatched', 'charge', 'sweep'],
      dialogue: {
        opening: '吾乃吕布，谁敢来战！',
        mid: '不过如此！',
        defeat: '不可能...竟有人能胜我！',
      },
    },
    enemyUnits: [
      { type: 'cavalry', name: '西凉铁骑', count: 30, hpPerUnit: 50, attackPerUnit: 20, defensePerUnit: 12 },
      { type: 'infantry', name: '并州狼骑', count: 20, hpPerUnit: 40, attackPerUnit: 18, defensePerUnit: 10 },
      { type: 'archer', name: '弓弩手', count: 15, hpPerUnit: 25, attackPerUnit: 15, defensePerUnit: 5 },
    ],
    mapLayout: {
      width: 14, height: 12,
      walls: [
        { x: 4, y: 1, hp: 200 }, { x: 5, y: 1, hp: 200 }, { x: 6, y: 1, hp: 200 }, { x: 7, y: 1, hp: 200 }, { x: 8, y: 1, hp: 200 }, { x: 9, y: 1, hp: 200 },
        { x: 4, y: 10, hp: 200 }, { x: 5, y: 10, hp: 200 }, { x: 6, y: 10, hp: 200 }, { x: 7, y: 10, hp: 200 }, { x: 8, y: 10, hp: 200 }, { x: 9, y: 10, hp: 200 },
        { x: 4, y: 2, hp: 200 }, { x: 4, y: 3, hp: 200 }, { x: 4, y: 4, hp: 200 },
        { x: 9, y: 2, hp: 200 }, { x: 9, y: 3, hp: 200 }, { x: 9, y: 4, hp: 200 },
      ],
      gates: [
        { x: 6, y: 5, hp: 300, direction: 'south' },
        { x: 7, y: 5, hp: 300, direction: 'south' },
      ],
      towers: [
        { x: 4, y: 1, attack: 20, range: 4 }, { x: 9, y: 1, attack: 20, range: 4 },
        { x: 4, y: 10, attack: 20, range: 4 }, { x: 9, y: 10, attack: 20, range: 4 },
      ],
      flagPositions: [{ x: 7, y: 6 }],
      deploymentZone: { x: 0, y: 4, width: 4, height: 4 },
    },
    rewards: {
      territory: 'luoyang',
      resources: { gold: 200, troops: 150 },
      unlockHero: 'guanyu',
    },
    starThresholds: { threeStar: 70, twoStar: 40 },
    iconAsset: '🗡️', themeColor: '#F44336',
    fortificationLevel: 5,
    mapPosition: { x: 0.35, y: 0.25 },
  },

  // ── 第三章：官渡之战 ──
  {
    id: 'campaign_guandu',
    name: '官渡之战',
    subtitle: '第三章·以少胜多',
    description: '曹操与袁绍对峙于官渡。兵力悬殊十倍，唯有奇袭乌巢，烧其粮草，方能逆转战局。',
    order: 3,
    prerequisiteStageId: 'campaign_hulao',
    targetTerritoryId: 'xuchang',
    targetCityName: '官渡',
    difficulty: 'hard',
    victoryCondition: 'destroy_gate',
    victoryParams: { gatesToDestroy: 1 },
    enemyCommander: {
      id: 'yuanshao', name: '袁绍', title: '四世三公·河北霸主',
      hp: 1000, attack: 55, defense: 30, intelligence: 40,
      abilities: ['rally', 'reinforce', 'fortify'],
      dialogue: {
        opening: '我有十万大军，何惧曹贼！',
        mid: '粮草...我的粮草！',
        defeat: '天不助我...',
      },
    },
    enemyUnits: [
      { type: 'infantry', name: '河北精兵', count: 50, hpPerUnit: 45, attackPerUnit: 16, defensePerUnit: 12 },
      { type: 'cavalry', name: '幽州突骑', count: 25, hpPerUnit: 55, attackPerUnit: 22, defensePerUnit: 14 },
      { type: 'archer', name: '冀州弓弩', count: 30, hpPerUnit: 30, attackPerUnit: 18, defensePerUnit: 6 },
      { type: 'siege', name: '冲车', count: 5, hpPerUnit: 100, attackPerUnit: 40, defensePerUnit: 20 },
    ],
    mapLayout: {
      width: 16, height: 14,
      walls: [], // 开放战场
      gates: [{ x: 12, y: 7, hp: 500, direction: 'west' }], // 乌巢粮仓大门
      towers: [
        { x: 10, y: 4, attack: 25, range: 5 }, { x: 14, y: 4, attack: 25, range: 5 },
        { x: 10, y: 10, attack: 25, range: 5 }, { x: 14, y: 10, attack: 25, range: 5 },
      ],
      flagPositions: [{ x: 12, y: 7 }],
      deploymentZone: { x: 0, y: 5, width: 4, height: 4 },
    },
    rewards: {
      territory: 'xuchang',
      resources: { grain: 500, gold: 300, troops: 200 },
      unlockHero: 'caocao',
    },
    starThresholds: { threeStar: 65, twoStar: 35 },
    iconAsset: '🏰', themeColor: '#FF9800',
    fortificationLevel: 6,
    mapPosition: { x: 0.50, y: 0.40 },
  },

  // ── 第四章：赤壁之战 ──
  {
    id: 'campaign_chibi',
    name: '赤壁之战',
    subtitle: '第四章·火烧连营',
    description: '曹操率八十万大军南下，孙刘联军以火攻大破曹军于赤壁。此战奠定三分天下之格局。',
    order: 4,
    prerequisiteStageId: 'campaign_guandu',
    targetTerritoryId: 'chaisang',
    targetCityName: '赤壁',
    difficulty: 'hard',
    victoryCondition: 'survive_waves',
    victoryParams: { waves: 5 },
    enemyCommander: {
      id: 'caocao_chibi', name: '曹操', title: '魏武帝·乱世奸雄',
      hp: 2000, attack: 80, defense: 40, intelligence: 90,
      abilities: ['ambition', 'stratagem', 'rally'],
      dialogue: {
        opening: '天下英雄，使君与操耳。',
        mid: '这火...不好！',
        defeat: '既生瑜，何生亮...',
      },
    },
    enemyUnits: [
      { type: 'infantry', name: '曹军先锋', count: 40, hpPerUnit: 50, attackPerUnit: 20, defensePerUnit: 15 },
      { type: 'cavalry', name: '虎豹骑', count: 20, hpPerUnit: 70, attackPerUnit: 30, defensePerUnit: 18 },
      { type: 'archer', name: '弓弩营', count: 30, hpPerUnit: 35, attackPerUnit: 22, defensePerUnit: 8 },
      { type: 'siege', name: '战船', count: 8, hpPerUnit: 150, attackPerUnit: 50, defensePerUnit: 25 },
    ],
    mapLayout: {
      width: 18, height: 16,
      walls: [],
      gates: [],
      towers: [],
      flagPositions: [{ x: 9, y: 8 }],
      deploymentZone: { x: 0, y: 6, width: 5, height: 4 },
    },
    rewards: {
      territory: 'chaisang',
      resources: { gold: 500, troops: 400, grain: 300 },
      unlockHero: 'zhugeliang',
    },
    starThresholds: { threeStar: 60, twoStar: 30 },
    iconAsset: '🔥', themeColor: '#E91E63',
    fortificationLevel: 7,
    mapPosition: { x: 0.55, y: 0.65 },
  },

  // ── 第五章：定军山 ──
  {
    id: 'campaign_dingjun',
    name: '定军山',
    subtitle: '第五章·老将建功',
    description: '刘备进取汉中，老将黄忠定军山斩夏侯渊，夺取汉中要地。蜀汉基业由此奠定。',
    order: 5,
    prerequisiteStageId: 'campaign_chibi',
    targetTerritoryId: 'hanzhong',
    targetCityName: '定军山',
    difficulty: 'hard',
    victoryCondition: 'defeat_commander',
    victoryParams: {},
    enemyCommander: {
      id: 'xiahouyuan', name: '夏侯渊', title: '疾行将军·魏国名将',
      hp: 1500, attack: 70, defense: 35, intelligence: 30,
      abilities: ['swift_strike', 'charge'],
      dialogue: {
        opening: '定军山固若金汤！',
        mid: '蜀军来得太快了！',
        defeat: '黄忠老将军...名不虚传...',
      },
    },
    enemyUnits: [
      { type: 'infantry', name: '魏国精锐', count: 35, hpPerUnit: 55, attackPerUnit: 22, defensePerUnit: 16 },
      { type: 'cavalry', name: '虎卫骑', count: 15, hpPerUnit: 65, attackPerUnit: 28, defensePerUnit: 18 },
      { type: 'archer', name: '弩手营', count: 25, hpPerUnit: 35, attackPerUnit: 24, defensePerUnit: 8 },
    ],
    mapLayout: {
      width: 14, height: 12,
      walls: [
        { x: 5, y: 2, hp: 250 }, { x: 6, y: 2, hp: 250 }, { x: 7, y: 2, hp: 250 }, { x: 8, y: 2, hp: 250 },
        { x: 5, y: 3, hp: 250 }, { x: 8, y: 3, hp: 250 },
        { x: 5, y: 8, hp: 250 }, { x: 6, y: 8, hp: 250 }, { x: 7, y: 8, hp: 250 }, { x: 8, y: 8, hp: 250 },
        { x: 5, y: 7, hp: 250 }, { x: 8, y: 7, hp: 250 },
      ],
      gates: [{ x: 6, y: 5, hp: 350, direction: 'south' }, { x: 7, y: 5, hp: 350, direction: 'south' }],
      towers: [{ x: 5, y: 2, attack: 22, range: 4 }, { x: 8, y: 2, attack: 22, range: 4 }],
      flagPositions: [{ x: 7, y: 5 }],
      deploymentZone: { x: 0, y: 4, width: 5, height: 4 },
    },
    rewards: {
      territory: 'hanzhong',
      resources: { grain: 800, troops: 500, gold: 400 },
      unlockHero: 'zhangfei',
    },
    starThresholds: { threeStar: 70, twoStar: 40 },
    iconAsset: '⛰️', themeColor: '#795548',
    fortificationLevel: 8,
    mapPosition: { x: 0.40, y: 0.75 },
  },

  // ── 第六章：一统天下 ──
  {
    id: 'campaign_unification',
    name: '天下一统',
    subtitle: '终章·龙御九天',
    description: '历经千辛万苦，终于兵临天下最后一座城池。攻克此城，天下一统，万民归心！',
    order: 6,
    prerequisiteStageId: 'campaign_dingjun',
    targetTerritoryId: 'changan',
    targetCityName: '长安',
    difficulty: 'hard',
    victoryCondition: 'capture_flag',
    victoryParams: { flagsToCapture: 3 },
    enemyCommander: {
      id: 'simayi', name: '司马懿', title: '冢虎·晋朝奠基者',
      hp: 3500, attack: 100, defense: 60, intelligence: 95,
      abilities: ['stratagem', 'endurance', 'ambush', 'fortify'],
      dialogue: {
        opening: '天下大势，分久必合，合久必分。',
        mid: '一切尽在掌握之中...',
        defeat: '天命...不在司马氏...',
      },
    },
    enemyUnits: [
      { type: 'infantry', name: '禁卫军', count: 60, hpPerUnit: 70, attackPerUnit: 28, defensePerUnit: 20 },
      { type: 'cavalry', name: '铁甲骑兵', count: 30, hpPerUnit: 80, attackPerUnit: 35, defensePerUnit: 22 },
      { type: 'archer', name: '神射手', count: 40, hpPerUnit: 45, attackPerUnit: 30, defensePerUnit: 10 },
      { type: 'siege', name: '投石车', count: 10, hpPerUnit: 120, attackPerUnit: 60, defensePerUnit: 15 },
    ],
    mapLayout: {
      width: 20, height: 18,
      walls: [], // 长安大城，开放式
      gates: [],
      towers: [
        { x: 6, y: 4, attack: 30, range: 6 }, { x: 13, y: 4, attack: 30, range: 6 },
        { x: 6, y: 13, attack: 30, range: 6 }, { x: 13, y: 13, attack: 30, range: 6 },
        { x: 10, y: 8, attack: 35, range: 7 },
      ],
      flagPositions: [{ x: 8, y: 6 }, { x: 12, y: 6 }, { x: 10, y: 12 }],
      deploymentZone: { x: 0, y: 7, width: 5, height: 4 },
    },
    rewards: {
      territory: 'changan',
      resources: { gold: 2000, troops: 1000, grain: 1500 },
    },
    starThresholds: { threeStar: 60, twoStar: 30 },
    iconAsset: '👑', themeColor: '#FFD700',
    fortificationLevel: 10,
    mapPosition: { x: 0.50, y: 0.50 },
  },
];

// ═══════════════════════════════════════════════════════════════
// 关卡连接路线
// ═══════════════════════════════════════════════════════════════

export const CAMPAIGN_CONNECTIONS: CampaignConnection[] = [
  { from: 'campaign_zhuo', to: 'campaign_hulao', type: 'plain' },
  { from: 'campaign_hulao', to: 'campaign_guandu', type: 'mountain_pass' },
  { from: 'campaign_guandu', to: 'campaign_chibi', type: 'river_crossing' },
  { from: 'campaign_chibi', to: 'campaign_dingjun', type: 'mountain_pass' },
  { from: 'campaign_dingjun', to: 'campaign_unification', type: 'main_road' },
];

// ═══════════════════════════════════════════════════════════════
// 兵种图标映射
// ═══════════════════════════════════════════════════════════════

export const UNIT_TYPE_ICONS: Record<string, string> = {
  infantry: '🗡️',
  cavalry: '🐎',
  archer: '🏹',
  siege: '💥',
};

/** 资源名称映射 */
export const RESOURCE_NAMES: Record<string, string> = {
  grain: '粮草',
  gold: '铜钱',
  troops: '兵力',
  techPoints: '科技点',
  intel: '情报',
  gem: '宝石',
};

// ═══════════════════════════════════════════════════════════════
// 关卡进度管理类
// ═══════════════════════════════════════════════════════════════

/** 关卡完成记录（含星级评价） */
export interface StageCompletionRecord {
  stageId: string;
  stars: number;           // 1-3 星
  completedAt: number;     // 时间戳
  troopsRemaining: number; // 剩余兵力百分比
}

/**
 * 征战关卡进度管理系统
 *
 * 管理关卡解锁、完成、星级评价和进度持久化。
 * 与 ThreeKingdomsEngine 集成，通过 serialize/deserialize 支持存档。
 */
export class CampaignSystem {
  /** 已完成的关卡 ID 集合 */
  private completedStages: Set<string> = new Set();

  /** 当前关卡索引（下一个待挑战的关卡） */
  private currentStageIndex: number = 0;

  /** 关卡完成记录（含星级等详细信息） */
  private completionRecords: Map<string, StageCompletionRecord> = new Map();

  /**
   * 获取当前待挑战的关卡
   * @returns 当前关卡定义，若全部完成则返回 undefined
   */
  getCurrentStage(): CampaignStage | undefined {
    return CAMPAIGN_STAGES[this.currentStageIndex];
  }

  /**
   * 获取当前关卡索引
   */
  getCurrentStageIndex(): number {
    return this.currentStageIndex;
  }

  /**
   * 获取所有已完成的关卡 ID
   */
  getCompletedStages(): string[] {
    return [...this.completedStages];
  }

  /**
   * 获取指定关卡的完成记录
   */
  getCompletionRecord(stageId: string): StageCompletionRecord | undefined {
    return this.completionRecords.get(stageId);
  }

  /**
   * 获取所有关卡的完成记录
   */
  getAllCompletionRecords(): StageCompletionRecord[] {
    return [...this.completionRecords.values()];
  }

  /**
   * 判断关卡是否已完成
   */
  isStageCompleted(stageId: string): boolean {
    return this.completedStages.has(stageId);
  }

  /**
   * 判断关卡是否已解锁（可挑战）
   */
  isStageUnlocked(stageId: string): boolean {
    const stage = CAMPAIGN_STAGES.find(s => s.id === stageId);
    if (!stage) return false;
    // 第一章始终解锁
    if (stage.prerequisiteStageId === null) return true;
    // 后续章节需要前置关卡完成
    return this.completedStages.has(stage.prerequisiteStageId);
  }

  /**
   * 获取关卡状态
   */
  getStageStatus(stageId: string): CampaignStageStatus {
    if (this.completedStages.has(stageId)) return 'victory';
    if (this.isStageUnlocked(stageId)) return 'available';
    return 'locked';
  }

  /**
   * 完成关卡并推进进度
   *
   * @param stageId 关卡 ID
   * @param troopsRemaining 剩余兵力百分比 (0-100)
   * @returns 是否成功推进到下一关
   */
  completeStage(stageId: string, troopsRemaining: number = 100): boolean {
    const idx = CAMPAIGN_STAGES.findIndex(s => s.id === stageId);
    if (idx < 0) return false;

    // 记录完成
    this.completedStages.add(stageId);

    // 计算星级
    const stage = CAMPAIGN_STAGES[idx];
    let stars = 1;
    if (troopsRemaining >= stage.starThresholds.twoStar) stars = 2;
    if (troopsRemaining >= stage.starThresholds.threeStar) stars = 3;

    // 保存完成记录（如果已有记录，保留最高星级）
    const existing = this.completionRecords.get(stageId);
    if (!existing || stars > existing.stars) {
      this.completionRecords.set(stageId, {
        stageId,
        stars,
        completedAt: Date.now(),
        troopsRemaining,
      });
    }

    // 推进当前关卡索引
    if (idx >= this.currentStageIndex && idx + 1 < CAMPAIGN_STAGES.length) {
      this.currentStageIndex = idx + 1;
      return true;
    }
    // 已是最后一关
    if (idx === CAMPAIGN_STAGES.length - 1) {
      this.currentStageIndex = CAMPAIGN_STAGES.length; // 越界表示全部完成
    }
    return false;
  }

  /**
   * 获取总星数
   */
  getTotalStars(): number {
    let total = 0;
    for (const record of this.completionRecords.values()) {
      total += record.stars;
    }
    return total;
  }

  /**
   * 获取最大星数（3 × 关卡数）
   */
  getMaxStars(): number {
    return CAMPAIGN_STAGES.length * 3;
  }

  /**
   * 判断是否全部通关
   */
  isAllCompleted(): boolean {
    return this.currentStageIndex >= CAMPAIGN_STAGES.length;
  }

  // ═══════════════════════════════════════════════════════════
  // 战斗计算方法
  // ═══════════════════════════════════════════════════════════

  /**
   * 获取关卡详情数据
   *
   * @param levelId - 关卡 ID
   * @returns 关卡详情，不存在则返回 undefined
   */
  getLevelDetail(levelId: string): CampaignLevelDetail | undefined {
    return CAMPAIGN_LEVEL_DETAILS.find(l => l.id === levelId);
  }

  /**
   * 获取所有关卡详情
   */
  getAllLevelDetails(): CampaignLevelDetail[] {
    return [...CAMPAIGN_LEVEL_DETAILS];
  }

  /**
   * 检查是否可以攻打指定关卡
   *
   * 综合判断：解锁状态、冷却时间、尝试次数。
   *
   * @param levelId - 关卡 ID
   * @returns 是否可以攻打
   */
  canAttackLevel(levelId: string): boolean {
    const info = this.getLevelStatus(levelId);
    return info.canAttack;
  }

  /**
   * 获取关卡完整状态信息
   *
   * @param levelId - 关卡 ID
   * @returns 关卡状态详情
   */
  getLevelStatus(levelId: string): LevelStatusInfo {
    const detail = CAMPAIGN_LEVEL_DETAILS.find(l => l.id === levelId);
    if (!detail) {
      return {
        status: 'locked',
        canAttack: false,
        reason: '关卡不存在',
        cooldownRemaining: 0,
        attemptsRemaining: 0,
      };
    }

    // 已通关的关卡不可再攻打
    if (this.completedStages.has(levelId)) {
      return {
        status: 'victory',
        canAttack: false,
        reason: '该关卡已攻克',
        cooldownRemaining: 0,
        attemptsRemaining: 0,
      };
    }

    // 检查前置关卡
    if (detail.prerequisite !== null && !this.completedStages.has(detail.prerequisite)) {
      return {
        status: 'locked',
        canAttack: false,
        reason: `需要先攻克前置关卡`,
        cooldownRemaining: 0,
        attemptsRemaining: detail.battleConfig.maxAttempts || Infinity,
      };
    }

    // 检查冷却
    const cooldownRemaining = this.getCooldownRemaining(levelId);
    if (cooldownRemaining > 0) {
      return {
        status: 'available',
        canAttack: false,
        reason: `冷却中，还需等待 ${cooldownRemaining} 秒`,
        cooldownRemaining,
        attemptsRemaining: this.getAttemptsRemaining(levelId),
      };
    }

    // 检查尝试次数
    const attemptsRemaining = this.getAttemptsRemaining(levelId);
    if (attemptsRemaining <= 0 && detail.battleConfig.maxAttempts > 0) {
      return {
        status: 'available',
        canAttack: false,
        reason: '已达到最大尝试次数',
        cooldownRemaining: 0,
        attemptsRemaining: 0,
      };
    }

    return {
      status: 'available',
      canAttack: true,
      cooldownRemaining: 0,
      attemptsRemaining,
    };
  }

  /**
   * 计算战斗结果
   *
   * 基于双方兵力对比自动计算战斗结果。算法：
   * 1. 计算双方总兵力值（步兵×1 + 骑兵×1.5 + 弓兵×1.2）
   * 2. 城防等级提供守方加成（每级 +5%）
   * 3. 兵力比决定胜负概率
   * 4. 回合制模拟，每回合双方互相造成伤害
   * 5. 生成战斗日志
   *
   * @param playerTroops - 玩家兵力配置
   * @param levelId - 关卡 ID
   * @returns 战斗结果
   */
  calculateBattle(
    playerTroops: TroopComposition,
    levelId: string,
  ): CampaignBattleResult {
    const detail = CAMPAIGN_LEVEL_DETAILS.find(l => l.id === levelId);
    if (!detail) {
      return this.createDefaultBattleResult(false, ['关卡不存在']);
    }

    // 计算双方兵力值
    const playerPower = this.calculateTroopPower(playerTroops);
    const enemyPower = this.calculateTroopPower(detail.defender.troops);

    // 城防加成：每级 +5%
    const fortBonus = 1 + detail.defender.fortLevel * 0.05;
    const effectiveEnemyPower = enemyPower * fortBonus;

    // 兵力比
    const ratio = playerPower / Math.max(1, effectiveEnemyPower);

    // 模拟回合制战斗
    const battleLog: string[] = [];
    const maxRounds = 8;

    let playerRemaining = { ...playerTroops };
    let enemyRemaining = { ...detail.defender.troops };

    let playerTotal = this.troopTotal(playerRemaining);
    let enemyTotal = this.troopTotal(enemyRemaining);

    battleLog.push(`⚔️ ${detail.name} 战斗开始！`);
    battleLog.push(`我军兵力：步兵${playerTroops.infantry} 骑兵${playerTroops.cavalry} 弓兵${playerTroops.archers}`);
    battleLog.push(`敌军兵力：步兵${detail.defender.troops.infantry} 骑兵${detail.defender.troops.cavalry} 弓兵${detail.defender.troops.archers}`);
    battleLog.push(`守将：${detail.defender.lord}，城防等级：${detail.defender.fortLevel}`);
    battleLog.push(`兵力比：${ratio.toFixed(2)}`);

    let roundsFought = 0;

    for (let round = 1; round <= maxRounds; round++) {
      if (this.troopTotal(playerRemaining) <= 0 || this.troopTotal(enemyRemaining) <= 0) break;

      roundsFought = round;

      // 每回合伤害 = (己方兵力值 / maxRounds) × 随机波动
      const variance = 0.85 + Math.random() * 0.3; // 0.85~1.15
      const playerDamageBase = (playerPower / maxRounds) * variance;
      const enemyDamageBase = (effectiveEnemyPower / maxRounds) * (1.1 - variance + 0.85);

      // 攻方对守方造成伤害
      const enemyLoss = this.applyDamage(enemyRemaining, playerDamageBase);
      // 守方对攻方造成伤害
      const playerLoss = this.applyDamage(playerRemaining, enemyDamageBase);

      battleLog.push(
        `第${round}回合：我军损失 步兵${playerLoss.infantry} 骑兵${playerLoss.cavalry} 弓兵${playerLoss.archers}，` +
        `敌军损失 步兵${enemyLoss.infantry} 骑兵${enemyLoss.cavalry} 弓兵${enemyLoss.archers}`,
      );
    }

    // 判定胜负
    const finalPlayerTotal = this.troopTotal(playerRemaining);
    const finalEnemyTotal = this.troopTotal(enemyRemaining);

    let victory: boolean;
    if (finalEnemyTotal <= 0) {
      victory = true;
    } else if (finalPlayerTotal <= 0) {
      victory = false;
    } else {
      // 按兵力比判定
      victory = ratio > 0.8;
    }

    // 计算总损失
    const playerLosses: TroopComposition = {
      infantry: playerTroops.infantry - playerRemaining.infantry,
      cavalry: playerTroops.cavalry - playerRemaining.cavalry,
      archers: playerTroops.archers - playerRemaining.archers,
    };
    const enemyLosses: TroopComposition = {
      infantry: detail.defender.troops.infantry - enemyRemaining.infantry,
      cavalry: detail.defender.troops.cavalry - enemyRemaining.cavalry,
      archers: detail.defender.troops.archers - enemyRemaining.archers,
    };

    if (victory) {
      battleLog.push(`🏆 战斗胜利！攻克${detail.name}！`);
    } else {
      battleLog.push(`💀 战斗失败，我军撤退。`);
    }

    return {
      victory,
      playerLosses,
      enemyLosses,
      rounds: roundsFought,
      battleLog,
      rewards: victory ? detail.rewards : undefined,
    };
  }

  /**
   * 执行攻城战斗
   *
   * 完整流程：检查条件 → 计算战斗 → 更新状态 → 返回结果。
   *
   * @param levelId - 关卡 ID
   * @param playerTroops - 玩家兵力配置
   * @returns 战斗结果
   */
  attackLevel(levelId: string, playerTroops: TroopComposition): CampaignBattleResult {
    // 检查是否可以攻打
    if (!this.canAttackLevel(levelId)) {
      const info = this.getLevelStatus(levelId);
      return this.createDefaultBattleResult(false, [info.reason || '无法攻打该关卡']);
    }

    // 检查最低兵力
    const totalTroops = this.troopTotal(playerTroops);
    if (totalTroops < 10) {
      return this.createDefaultBattleResult(false, ['兵力不足，至少需要10名士兵']);
    }

    // 记录攻击尝试
    this.recordAttempt(levelId);

    // 计算战斗
    const result = this.calculateBattle(playerTroops, levelId);

    // 设置冷却
    const detail = CAMPAIGN_LEVEL_DETAILS.find(l => l.id === levelId);
    if (detail) {
      this.setCooldown(levelId, detail.battleConfig.cooldownSeconds);
    }

    // 处理胜利
    if (result.victory) {
      this.completeStage(levelId, this.calculateTroopsRemainingPercent(playerTroops, result.playerLosses));
    }

    return result;
  }

  // ─── 战斗辅助方法 ─────────────────────────────────────────

  /**
   * 计算兵力值
   *
   * 步兵×1.0 + 骑兵×1.5 + 弓兵×1.2
   */
  private calculateTroopPower(troops: TroopComposition): number {
    return troops.infantry * 1.0 + troops.cavalry * 1.5 + troops.archers * 1.2;
  }

  /**
   * 计算总兵力数
   */
  private troopTotal(troops: TroopComposition): number {
    return troops.infantry + troops.cavalry + troops.archers;
  }

  /**
   * 对兵力配置施加伤害，返回损失明细
   */
  private applyDamage(troops: TroopComposition, damage: number): TroopComposition {
    const total = this.troopTotal(troops);
    if (total <= 0 || damage <= 0) {
      return { infantry: 0, cavalry: 0, archers: 0 };
    }

    // 按兵种比例分摊伤害
    const infantryRatio = troops.infantry / total;
    const cavalryRatio = troops.cavalry / total;
    const archerRatio = troops.archers / total;

    const infantryLoss = Math.min(troops.infantry, Math.floor(damage * infantryRatio));
    const cavalryLoss = Math.min(troops.cavalry, Math.floor(damage * cavalryRatio));
    const archerLoss = Math.min(troops.archers, Math.floor(damage * archerRatio));

    troops.infantry -= infantryLoss;
    troops.cavalry -= cavalryLoss;
    troops.archers -= archerLoss;

    return { infantry: infantryLoss, cavalry: cavalryLoss, archers: archerLoss };
  }

  /**
   * 计算剩余兵力百分比
   */
  private calculateTroopsRemainingPercent(
    original: TroopComposition,
    losses: TroopComposition,
  ): number {
    const totalOriginal = this.troopTotal(original);
    const totalLosses = this.troopTotal(losses);
    if (totalOriginal === 0) return 0;
    return ((totalOriginal - totalLosses) / totalOriginal) * 100;
  }

  /**
   * 创建默认战斗结果（用于错误情况）
   */
  private createDefaultBattleResult(victory: boolean, log: string[]): CampaignBattleResult {
    return {
      victory,
      playerLosses: { infantry: 0, cavalry: 0, archers: 0 },
      enemyLosses: { infantry: 0, cavalry: 0, archers: 0 },
      rounds: 0,
      battleLog: log,
      rewards: undefined,
    };
  }

  // ─── 冷却与尝试次数管理 ─────────────────────────────────────

  /** 冷却记录：levelId → 冷却结束时间戳(ms) */
  private cooldowns: Map<string, number> = new Map();

  /** 尝试次数记录：levelId → 已尝试次数 */
  private attemptCounts: Map<string, number> = new Map();

  /**
   * 设置关卡冷却
   */
  private setCooldown(levelId: string, seconds: number): void {
    this.cooldowns.set(levelId, Date.now() + seconds * 1000);
  }

  /**
   * 获取剩余冷却时间（秒）
   */
  private getCooldownRemaining(levelId: string): number {
    const endTime = this.cooldowns.get(levelId);
    if (!endTime) return 0;
    return Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
  }

  /**
   * 记录一次攻击尝试
   */
  private recordAttempt(levelId: string): void {
    const current = this.attemptCounts.get(levelId) || 0;
    this.attemptCounts.set(levelId, current + 1);
  }

  /**
   * 获取剩余尝试次数
   */
  private getAttemptsRemaining(levelId: number | string): number {
    const detail = CAMPAIGN_LEVEL_DETAILS.find(l => l.id === levelId);
    if (!detail) return 0;
    if (detail.battleConfig.maxAttempts === 0) return Infinity;
    const used = this.attemptCounts.get(String(levelId)) || 0;
    return Math.max(0, detail.battleConfig.maxAttempts - used);
  }

  // ─── 序列化（扩展） ─────────────────────────────────────────

  /**
   * 序列化进度数据
   */
  serialize(): object {
    return {
      completed: [...this.completedStages],
      currentIndex: this.currentStageIndex,
      records: [...this.completionRecords.entries()].map(([id, r]) => [id, r]),
      cooldowns: [...this.cooldowns.entries()],
      attemptCounts: [...this.attemptCounts.entries()],
    };
  }

  /**
   * 反序列化进度数据
   */
  deserialize(data: any): void {
    this.completedStages = new Set(data?.completed ?? []);
    this.currentStageIndex = data?.currentIndex ?? 0;
    this.completionRecords = new Map(
      (data?.records ?? []).map(([id, r]: [string, any]) => [id, r as StageCompletionRecord]),
    );
    this.cooldowns = new Map(data?.cooldowns ?? []);
    this.attemptCounts = new Map(data?.attemptCounts ?? []);
  }
}
