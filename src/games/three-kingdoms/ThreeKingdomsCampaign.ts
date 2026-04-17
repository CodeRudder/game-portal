/**
 * 三国霸业 — 攻城略地关卡数据定义
 *
 * 以三国历史为背景的故事挑战关卡，从「黄巾之乱」到「三分天下」共6章。
 * 每个关卡对应一个历史战役，包含推荐战力、敌方势力、通关奖励等。
 *
 * 与 CampaignSystem.ts 中的详细关卡数据互补：
 * - CampaignSystem 提供完整的战斗地图、兵力配置、城防等
 * - 本文件提供简化的关卡元数据（时代、难度、战力要求、奖励）
 *
 * @module games/three-kingdoms/ThreeKingdomsCampaign
 */

// ═══════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════

/** 历史时期 */
export type CampaignEra = '黄巾' | '董卓' | '群雄' | '官渡' | '赤壁' | '三国';

/** 星级评价（0=未通过, 1-3星） */
export type StarRating = 0 | 1 | 2 | 3;

/** 关卡奖励 */
export interface CampaignRewards {
  /** 铜钱奖励 */
  gold?: number;
  /** 粮草奖励 */
  food?: number;
  /** 铁材奖励 */
  iron?: number;
  /** 声望奖励 */
  reputation?: number;
  /** 可掉落的武将 ID */
  heroId?: string;
}

/** 关卡定义（简化版，用于关卡列表展示和战力对比） */
export interface CampaignStage {
  /** 关卡唯一 ID */
  id: string;
  /** 关卡名称（如"黄巾之乱"） */
  name: string;
  /** 关卡描述 */
  description: string;
  /** 历史时期 */
  era: CampaignEra;
  /** 难度等级 1-5 */
  difficulty: number;
  /** 敌方势力名称 */
  enemyFaction: string;
  /** 敌方首领名称 */
  enemyLeader: string;
  /** 推荐战力（敌方战力值） */
  requiredPower: number;
  /** 通关奖励 */
  rewards: CampaignRewards;
  /** 是否已解锁 */
  unlocked: boolean;
  /** 是否已完成 */
  completed: boolean;
  /** 通关星级 */
  stars: StarRating;
}

/** 关卡挑战结果 */
export interface ChallengeResult {
  /** 是否胜利 */
  won: boolean;
  /** 获得的星级 */
  stars: StarRating;
  /** 获得的奖励（胜利时） */
  rewards: CampaignRewards;
}

// ═══════════════════════════════════════════════════════════════
// 6 关卡数据（对应三国历史进程）
// ═══════════════════════════════════════════════════════════════

/**
 * 初始关卡数据（所有关卡默认锁定，第一章除外）
 *
 * 关卡按历史顺序排列，战力递增：
 * - 第一章 黄巾之乱：战力 1000（新手入门）
 * - 第二章 讨伐董卓：战力 5000（初具规模）
 * - 第三章 群雄割据：战力 15000（群雄并起）
 * - 第四章 官渡之战：战力 30000（以少胜多）
 * - 第五章 赤壁之战：战力 50000（三分天下）
 * - 第六章 三分天下：战力 100000（终局之战）
 */
export const CAMPAIGN_STAGE_DEFINITIONS: ReadonlyArray<{
  id: string;
  name: string;
  description: string;
  era: CampaignEra;
  difficulty: number;
  enemyFaction: string;
  enemyLeader: string;
  requiredPower: number;
  rewards: CampaignRewards;
}> = [
  {
    id: 'stage_1',
    name: '黄巾之乱',
    description: '天下大乱，黄巾军四起。张角以"苍天已死，黄天当立"号召百万信徒，天下震动。刘备、关羽、张飞桃园结义，起兵平乱，建立功勋。',
    era: '黄巾',
    difficulty: 1,
    enemyFaction: '黄巾军',
    enemyLeader: '张角',
    requiredPower: 1000,
    rewards: {
      gold: 500,
      food: 800,
      iron: 100,
      reputation: 10,
      heroId: 'liubei',
    },
  },
  {
    id: 'stage_2',
    name: '讨伐董卓',
    description: '董卓乱政，废帝专权。十八路诸侯歃血为盟，公推袁绍为盟主，联合讨伐董卓。虎牢关前，三英战吕布，留下千古佳话。',
    era: '董卓',
    difficulty: 2,
    enemyFaction: '董卓军',
    enemyLeader: '董卓',
    requiredPower: 5000,
    rewards: {
      gold: 2000,
      food: 3000,
      iron: 500,
      reputation: 25,
      heroId: 'guanyu',
    },
  },
  {
    id: 'stage_3',
    name: '群雄割据',
    description: '各路诸侯争夺地盘，天下四分五裂。曹操挟天子以令诸侯，袁绍坐拥河北四州，刘表据荆州，孙策平定江东。群雄并起，逐鹿中原。',
    era: '群雄',
    difficulty: 2,
    enemyFaction: '袁绍军',
    enemyLeader: '袁绍',
    requiredPower: 15000,
    rewards: {
      gold: 5000,
      food: 8000,
      iron: 1500,
      reputation: 50,
      heroId: 'caocao',
    },
  },
  {
    id: 'stage_4',
    name: '官渡之战',
    description: '曹操与袁绍决战于官渡。袁绍坐拥十万大军，曹操仅两万。奇袭乌巢，火烧粮草，以少胜多，一战定北方。',
    era: '官渡',
    difficulty: 3,
    enemyFaction: '袁绍军',
    enemyLeader: '袁绍',
    requiredPower: 30000,
    rewards: {
      gold: 10000,
      food: 15000,
      iron: 3000,
      reputation: 80,
    },
  },
  {
    id: 'stage_5',
    name: '赤壁之战',
    description: '孙刘联军抗曹，诸葛亮借东风，周瑜施火攻。八十万曹军灰飞烟灭，三分天下之局由此奠定。',
    era: '赤壁',
    difficulty: 4,
    enemyFaction: '曹军',
    enemyLeader: '曹操',
    requiredPower: 50000,
    rewards: {
      gold: 20000,
      food: 30000,
      iron: 6000,
      reputation: 120,
      heroId: 'zhugeliang',
    },
  },
  {
    id: 'stage_6',
    name: '三分天下',
    description: '魏蜀吴三足鼎立，天下三分。诸葛亮六出祁山，姜维九伐中原，司马氏篡魏，最终三国归晋。天下大势，分久必合。',
    era: '三国',
    difficulty: 5,
    enemyFaction: '司马军',
    enemyLeader: '司马懿',
    requiredPower: 100000,
    rewards: {
      gold: 50000,
      food: 80000,
      iron: 15000,
      reputation: 200,
    },
  },
];

// ═══════════════════════════════════════════════════════════════
// 难度显示配置
// ═══════════════════════════════════════════════════════════════

/** 难度等级对应的显示信息 */
export const DIFFICULTY_DISPLAY: Readonly<Record<number, { label: string; color: string; stars: string }>> = {
  1: { label: '入门', color: '#4ade80', stars: '★☆☆☆☆' },
  2: { label: '普通', color: '#facc15', stars: '★★☆☆☆' },
  3: { label: '困难', color: '#f97316', stars: '★★★☆☆' },
  4: { label: '噩梦', color: '#ef4444', stars: '★★★★☆' },
  5: { label: '地狱', color: '#dc2626', stars: '★★★★★' },
};

/** 时代对应的显示颜色 */
export const ERA_COLORS: Readonly<Record<CampaignEra, string>> = {
  '黄巾': '#facc15',
  '董卓': '#f97316',
  '群雄': '#a78bfa',
  '官渡': '#60a5fa',
  '赤壁': '#ef4444',
  '三国': '#dc2626',
};
