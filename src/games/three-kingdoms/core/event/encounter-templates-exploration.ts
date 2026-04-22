/**
 * 核心层 — 探索遭遇模板
 *
 * exploration 子类型遭遇模板（5个）
 *
 * @module core/event/encounter-templates-exploration
 */

import type { EncounterTemplate } from './event-v15.types';

// ─────────────────────────────────────────────
// 探索遭遇（exploration）— 5个
// ─────────────────────────────────────────────

/** 探索遭遇 — 古墓遗迹 */
export const ENCOUNTER_EXPLORE_TOMB: EncounterTemplate = {
  id: 'enc-explore-tomb',
  subType: 'exploration',
  name: '古墓遗迹',
  descriptionTemplate: '在{environment}发现了一处上古遗迹！',
  difficulty: 'hard',
  environments: ['mountain', 'desert'],
  baseWeight: 4,
  cooldownTurns: 12,
  options: [
    {
      id: 'explore',
      text: '深入探索',
      aiWeight: 40,
      consequences: {
        description: '探索古墓，可能获得宝物',
        resourceChanges: { troops: -10, gold: 200 },
      },
    },
    {
      id: 'excavate',
      text: '小心发掘',
      aiWeight: 50,
      consequences: {
        description: '谨慎发掘，获得少量宝物',
        resourceChanges: { gold: 80 },
      },
    },
    {
      id: 'seal',
      text: '封存不动',
      aiWeight: 10,
      consequences: {
        description: '尊重遗迹，不动分毫',
        resourceChanges: {},
      },
    },
  ],
};

/** 探索遭遇 — 隐世高人 */
export const ENCOUNTER_EXPLORE_HERMIT: EncounterTemplate = {
  id: 'enc-explore-hermit',
  subType: 'exploration',
  name: '隐世高人',
  descriptionTemplate: '在深山中偶遇一位隐世高人！',
  difficulty: 'normal',
  environments: ['mountain', 'forest'],
  baseWeight: 3,
  cooldownTurns: 15,
  options: [
    {
      id: 'learn',
      text: '虚心请教',
      aiWeight: 60,
      consequences: {
        description: '高人传授技艺',
        resourceChanges: { mandate: 30 },
      },
    },
    {
      id: 'recruit',
      text: '邀请出山',
      aiWeight: 30,
      consequences: {
        description: '成功说服高人出山',
        resourceChanges: { gold: -100, mandate: 50 },
      },
    },
  ],
};

/** 探索遭遇 — 宝藏线索 */
export const ENCOUNTER_EXPLORE_TREASURE_MAP: EncounterTemplate = {
  id: 'enc-explore-treasure-map',
  subType: 'exploration',
  name: '宝藏线索',
  descriptionTemplate: '在一处破旧的庙宇中发现了藏宝图碎片！',
  difficulty: 'normal',
  environments: ['mountain', 'forest', 'city'],
  baseWeight: 6,
  cooldownTurns: 8,
  options: [
    {
      id: 'follow',
      text: '循线寻宝',
      aiWeight: 50,
      consequences: {
        description: '按图索骥寻找宝藏',
        resourceChanges: { gold: -30, troops: -5 },
      },
    },
    {
      id: 'sell',
      text: '出售线索',
      aiWeight: 30,
      consequences: {
        description: '将线索卖给商人',
        resourceChanges: { gold: 50 },
      },
    },
    {
      id: 'keep',
      text: '收藏备用',
      aiWeight: 20,
      consequences: {
        description: '先收起来以后再说',
        resourceChanges: {},
      },
    },
  ],
};

/** 探索遭遇 — 密道发现 */
export const ENCOUNTER_EXPLORE_SECRET_PASSAGE: EncounterTemplate = {
  id: 'enc-explore-passage',
  subType: 'exploration',
  name: '密道发现',
  descriptionTemplate: '在城墙下发现了一条隐秘的密道！',
  difficulty: 'normal',
  environments: ['city'],
  baseWeight: 5,
  cooldownTurns: 10,
  options: [
    {
      id: 'enter',
      text: '进入探查',
      aiWeight: 50,
      consequences: {
        description: '探索密道内部',
        resourceChanges: { troops: -5, gold: 100 },
      },
    },
    {
      id: 'guard',
      text: '派人驻守',
      aiWeight: 40,
      consequences: {
        description: '封锁密道防止敌人利用',
        resourceChanges: { troops: -3 },
      },
    },
  ],
};

/** 探索遭遇 — 灵泉圣水 */
export const ENCOUNTER_EXPLORE_SPRING: EncounterTemplate = {
  id: 'enc-explore-spring',
  subType: 'exploration',
  name: '灵泉圣水',
  descriptionTemplate: '在山林深处发现了一处传说中的灵泉！',
  difficulty: 'easy',
  environments: ['mountain', 'forest'],
  baseWeight: 4,
  cooldownTurns: 12,
  options: [
    {
      id: 'drink',
      text: '饮用灵泉',
      aiWeight: 60,
      consequences: {
        description: '全军士气大振',
        resourceChanges: { troops: 20, mandate: 10 },
      },
    },
    {
      id: 'bottle',
      text: '收集圣水',
      aiWeight: 30,
      consequences: {
        description: '收集灵泉水备用',
        resourceChanges: { gold: 50 },
      },
    },
  ],
};
