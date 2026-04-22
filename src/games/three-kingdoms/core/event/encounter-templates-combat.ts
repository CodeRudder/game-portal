/**
 * 核心层 — 战斗遭遇模板
 *
 * combat 子类型遭遇模板（5个）
 *
 * @module core/event/encounter-templates-combat
 */

import type { EncounterTemplate } from './event-v15.types';

// ─────────────────────────────────────────────
// 战斗遭遇（combat）— 5个
// ─────────────────────────────────────────────

/** 战斗遭遇 — 山贼伏击 */
export const ENCOUNTER_COMBAT_BANDITS: EncounterTemplate = {
  id: 'enc-combat-bandits',
  subType: 'combat',
  name: '山贼伏击',
  descriptionTemplate: '一支山贼在{environment}伏击了{player}的队伍！',
  difficulty: 'normal',
  environments: ['mountain', 'forest'],
  baseWeight: 10,
  cooldownTurns: 5,
  options: [
    {
      id: 'fight',
      text: '正面迎敌',
      aiWeight: 60,
      consequences: {
        description: '与山贼激战',
        resourceChanges: { troops: -15, gold: 30 },
      },
    },
    {
      id: 'negotiate',
      text: '招安收编',
      aiWeight: 30,
      consequences: {
        description: '花费金币招安山贼',
        resourceChanges: { gold: -50, troops: 25 },
      },
    },
    {
      id: 'retreat',
      text: '撤退绕行',
      aiWeight: 10,
      consequences: {
        description: '绕路而行，损失时间',
        resourceChanges: { grain: -10 },
      },
    },
  ],
};

/** 战斗遭遇 — 猛虎拦路 */
export const ENCOUNTER_COMBAT_TIGER: EncounterTemplate = {
  id: 'enc-combat-tiger',
  subType: 'combat',
  name: '猛虎拦路',
  descriptionTemplate: '一只猛虎挡住了{player}的去路，虎视眈眈！',
  difficulty: 'hard',
  environments: ['mountain', 'forest'],
  baseWeight: 5,
  cooldownTurns: 8,
  options: [
    {
      id: 'hunt',
      text: '猎杀猛虎',
      aiWeight: 40,
      consequences: {
        description: '武将单挑猛虎',
        resourceChanges: { troops: -5 },
        unlockIds: ['item-tiger-pelt'],
      },
    },
    {
      id: 'bypass',
      text: '绕道而行',
      aiWeight: 60,
      consequences: {
        description: '避开猛虎',
        resourceChanges: { grain: -5 },
      },
    },
  ],
};

/** 战斗遭遇 — 敌军斥候 */
export const ENCOUNTER_COMBAT_SCOUT: EncounterTemplate = {
  id: 'enc-combat-scout',
  subType: 'combat',
  name: '敌军斥候',
  descriptionTemplate: '在{environment}发现了敌军的斥候小队！',
  difficulty: 'easy',
  environments: ['plains', 'mountain', 'forest'],
  baseWeight: 12,
  cooldownTurns: 3,
  options: [
    {
      id: 'ambush',
      text: '伏击消灭',
      aiWeight: 50,
      consequences: {
        description: '消灭斥候获取情报',
        resourceChanges: { troops: -3, gold: 20 },
      },
    },
    {
      id: 'track',
      text: '跟踪侦察',
      aiWeight: 40,
      consequences: {
        description: '跟踪斥候发现敌营位置',
        resourceChanges: {},
      },
    },
    {
      id: 'ignore',
      text: '放任不管',
      aiWeight: 10,
      consequences: {
        description: '敌军可能获得我方情报',
        resourceChanges: {},
      },
    },
  ],
};

/** 战斗遭遇 — 蛮族入侵 */
export const ENCOUNTER_COMBAT_BARBARIAN: EncounterTemplate = {
  id: 'enc-combat-barbarian',
  subType: 'combat',
  name: '蛮族入侵',
  descriptionTemplate: '北方蛮族骑兵突然出现在边境！',
  difficulty: 'epic',
  environments: ['plains', 'desert'],
  baseWeight: 3,
  cooldownTurns: 15,
  options: [
    {
      id: 'defend',
      text: '据城坚守',
      aiWeight: 50,
      consequences: {
        description: '消耗大量资源守城',
        resourceChanges: { troops: -30, grain: -100, gold: 50 },
      },
    },
    {
      id: 'counter',
      text: '主动出击',
      aiWeight: 30,
      consequences: {
        description: '以攻代守，风险极大',
        resourceChanges: { troops: -50, gold: 100, mandate: 20 },
      },
    },
    {
      id: 'tribute',
      text: '纳贡求和',
      aiWeight: 20,
      consequences: {
        description: '花费大量资源换取和平',
        resourceChanges: { gold: -200, grain: -150 },
      },
    },
  ],
};

/** 战斗遭遇 — 叛军作乱 */
export const ENCOUNTER_COMBAT_REBEL: EncounterTemplate = {
  id: 'enc-combat-rebel',
  subType: 'combat',
  name: '叛军作乱',
  descriptionTemplate: '境内叛军趁{player}出征之际发动叛乱！',
  difficulty: 'hard',
  environments: ['city', 'plains'],
  baseWeight: 6,
  cooldownTurns: 10,
  options: [
    {
      id: 'suppress',
      text: '出兵镇压',
      aiWeight: 60,
      consequences: {
        description: '平定叛乱，恢复秩序',
        resourceChanges: { troops: -20, mandate: 15 },
      },
    },
    {
      id: 'pardon',
      text: '招抚安民',
      aiWeight: 30,
      consequences: {
        description: '宽大处理，收拢人心',
        resourceChanges: { gold: -80, mandate: 25 },
      },
    },
  ],
};
