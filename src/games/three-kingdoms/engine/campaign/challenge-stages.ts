/**
 * 挑战关卡配置数据 — 8个烽火台关卡
 *
 * 挑战关卡独立于主线战役，固定难度不随主线进度变化。
 * 每日重置，消耗兵力和天命。
 *
 * @module engine/campaign/challenge-stages
 */

import type { ChallengeStageConfig } from './ChallengeStageSystem';

/** 默认挑战关卡配置（8个挑战关卡） */
export const DEFAULT_CHALLENGE_STAGES: ChallengeStageConfig[] = [
  {
    id: 'challenge_1', name: '烽火台·壹',
    armyCost: 200, staminaCost: 12,
    firstClearBonus: [{ type: 'mandate', amount: 50 }, { type: 'fragment_zhangjiao', amount: 5 }],
    rewards: [
      { type: 'grain', amount: 500 }, { type: 'gold', amount: 300 },
      { type: 'exp_book_small', amount: 2 },
    ],
    randomDrops: [
      { type: 'fragment_guanyu', amount: 1, probability: 0.15 },
      { type: 'tiger_tally', amount: 1, probability: 0.3 },
    ],
  },
  {
    id: 'challenge_2', name: '烽火台·贰',
    armyCost: 300, staminaCost: 14,
    firstClearBonus: [{ type: 'mandate', amount: 50 }, { type: 'fragment_dongzhuo', amount: 5 }],
    rewards: [
      { type: 'grain', amount: 800 }, { type: 'gold', amount: 500 },
      { type: 'exp_book_medium', amount: 1 },
    ],
    randomDrops: [
      { type: 'fragment_zhaoyun', amount: 1, probability: 0.12 },
      { type: 'tiger_tally', amount: 2, probability: 0.25 },
    ],
  },
  {
    id: 'challenge_3', name: '烽火台·叁',
    armyCost: 400, staminaCost: 16,
    firstClearBonus: [{ type: 'mandate', amount: 50 }, { type: 'fragment_caocao', amount: 5 }],
    rewards: [
      { type: 'grain', amount: 1200 }, { type: 'gold', amount: 800 },
      { type: 'exp_book_medium', amount: 2 },
    ],
    randomDrops: [
      { type: 'fragment_zhugeliang', amount: 1, probability: 0.1 },
      { type: 'war_script', amount: 1, probability: 0.2 },
    ],
  },
  {
    id: 'challenge_4', name: '烽火台·肆',
    armyCost: 500, staminaCost: 16,
    firstClearBonus: [{ type: 'mandate', amount: 50 }, { type: 'fragment_zhouyu', amount: 5 }],
    rewards: [
      { type: 'grain', amount: 1500 }, { type: 'gold', amount: 1000 },
      { type: 'exp_book_large', amount: 1 },
    ],
    randomDrops: [
      { type: 'fragment_sunquan', amount: 1, probability: 0.1 },
      { type: 'forge_stone', amount: 1, probability: 0.25 },
    ],
  },
  {
    id: 'challenge_5', name: '烽火台·伍',
    armyCost: 600, staminaCost: 18,
    firstClearBonus: [{ type: 'mandate', amount: 50 }, { type: 'fragment_liubei', amount: 5 }],
    rewards: [
      { type: 'grain', amount: 2000 }, { type: 'gold', amount: 1500 },
      { type: 'exp_book_large', amount: 2 },
    ],
    randomDrops: [
      { type: 'fragment_simayi', amount: 1, probability: 0.08 },
      { type: 'forge_stone', amount: 2, probability: 0.2 },
    ],
  },
  {
    id: 'challenge_6', name: '烽火台·陆',
    armyCost: 700, staminaCost: 18,
    firstClearBonus: [{ type: 'mandate', amount: 50 }, { type: 'fragment_lvbu', amount: 3 }],
    rewards: [
      { type: 'grain', amount: 2500 }, { type: 'gold', amount: 2000 },
      { type: 'exp_book_large', amount: 2 },
    ],
    randomDrops: [
      { type: 'fragment_lvbu', amount: 1, probability: 0.06 },
      { type: 'war_script', amount: 2, probability: 0.15 },
    ],
  },
  {
    id: 'challenge_7', name: '烽火台·柒',
    armyCost: 800, staminaCost: 20,
    firstClearBonus: [{ type: 'mandate', amount: 100 }, { type: 'fragment_guanyu', amount: 5 }],
    rewards: [
      { type: 'grain', amount: 3000 }, { type: 'gold', amount: 2500 },
      { type: 'exp_book_large', amount: 3 },
    ],
    randomDrops: [
      { type: 'fragment_guanyu', amount: 1, probability: 0.08 },
      { type: 'tiger_tally', amount: 3, probability: 0.2 },
    ],
  },
  {
    id: 'challenge_8', name: '烽火台·捌',
    armyCost: 1000, staminaCost: 20,
    firstClearBonus: [{ type: 'mandate', amount: 100 }, { type: 'fragment_zhugeliang', amount: 5 }],
    rewards: [
      { type: 'grain', amount: 5000 }, { type: 'gold', amount: 4000 },
      { type: 'exp_book_large', amount: 5 },
    ],
    randomDrops: [
      { type: 'fragment_zhugeliang', amount: 1, probability: 0.06 },
      { type: 'forge_stone', amount: 3, probability: 0.15 },
    ],
  },
];
