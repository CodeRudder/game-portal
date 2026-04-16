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

  // 地图
  mapLayout: CampaignMap;

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
  },
];
