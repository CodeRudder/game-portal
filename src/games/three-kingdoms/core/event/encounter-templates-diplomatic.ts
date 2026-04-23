/**
 * 核心层 — 外交遭遇模板
 *
 * diplomatic 子类型遭遇模板（5个）
 *
 * @module core/event/encounter-templates-diplomatic
 */

import type { EncounterTemplate } from './event-engine.types';

// ─────────────────────────────────────────────
// 外交遭遇（diplomatic）— 5个
// ─────────────────────────────────────────────

/** 外交遭遇 — 流民投奔 */
export const ENCOUNTER_DIPLO_REFUGEES: EncounterTemplate = {
  id: 'enc-diplo-refugees',
  subType: 'diplomatic',
  name: '流民投奔',
  descriptionTemplate: '一群流离失所的百姓前来投奔{player}。',
  difficulty: 'easy',
  environments: ['plains', 'city'],
  baseWeight: 12,
  cooldownTurns: 5,
  options: [
    {
      id: 'accept',
      text: '收留安置',
      aiWeight: 50,
      consequences: {
        description: '收留流民，增加人口',
        resourceChanges: { grain: -30, troops: 15, mandate: 10 },
      },
    },
    {
      id: 'reject',
      text: '婉言拒绝',
      aiWeight: 40,
      consequences: {
        description: '资源有限，无法收留',
        resourceChanges: {},
      },
    },
  ],
};

/** 外交遭遇 — 异国使者 */
export const ENCOUNTER_DIPLO_ENVOY: EncounterTemplate = {
  id: 'enc-diplo-envoy',
  subType: 'diplomatic',
  name: '异国使者',
  descriptionTemplate: '远方国度的使者带来了一份外交提议。',
  difficulty: 'normal',
  environments: ['city'],
  baseWeight: 8,
  cooldownTurns: 8,
  options: [
    {
      id: 'alliance',
      text: '缔结同盟',
      aiWeight: 40,
      consequences: {
        description: '与远方国度结盟',
        resourceChanges: { gold: -100, mandate: 20 },
      },
    },
    {
      id: 'trade',
      text: '通商互市',
      aiWeight: 50,
      consequences: {
        description: '建立贸易关系',
        resourceChanges: { gold: 50, grain: -20 },
      },
    },
    {
      id: 'decline',
      text: '婉言谢绝',
      aiWeight: 10,
      consequences: {
        description: '保持独立',
        resourceChanges: {},
      },
    },
  ],
};

/** 外交遭遇 — 名士来访 */
export const ENCOUNTER_DIPLO_SCHOLAR: EncounterTemplate = {
  id: 'enc-diplo-scholar',
  subType: 'diplomatic',
  name: '名士来访',
  descriptionTemplate: '一位声名远播的名士前来拜访{player}。',
  difficulty: 'normal',
  environments: ['city'],
  baseWeight: 7,
  cooldownTurns: 10,
  options: [
    {
      id: 'recruit',
      text: '盛情款待并招揽',
      aiWeight: 50,
      consequences: {
        description: '成功招揽名士',
        resourceChanges: { gold: -80, mandate: 30 },
      },
    },
    {
      id: 'consult',
      text: '请教治国之策',
      aiWeight: 40,
      consequences: {
        description: '获得宝贵建议',
        resourceChanges: { gold: -30, mandate: 15 },
      },
    },
  ],
};

/** 外交遭遇 — 商队过境 */
export const ENCOUNTER_DIPLO_MERCHANTS: EncounterTemplate = {
  id: 'enc-diplo-merchants',
  subType: 'diplomatic',
  name: '商队过境',
  descriptionTemplate: '一支大型商队请求通过{player}的领地。',
  difficulty: 'easy',
  environments: ['plains', 'city', 'desert'],
  baseWeight: 10,
  cooldownTurns: 4,
  options: [
    {
      id: 'allow',
      text: '允许通行',
      aiWeight: 50,
      consequences: {
        description: '收取过路费',
        resourceChanges: { gold: 60 },
      },
    },
    {
      id: 'tax',
      text: '征收重税',
      aiWeight: 30,
      consequences: {
        description: '获得更多金币但名声受损',
        resourceChanges: { gold: 120, mandate: -10 },
      },
    },
    {
      id: 'refuse',
      text: '拒绝通行',
      aiWeight: 20,
      consequences: {
        description: '商队改道',
        resourceChanges: {},
      },
    },
  ],
};

/** 外交遭遇 — 盟友求援 */
export const ENCOUNTER_DIPLO_ALLY_HELP: EncounterTemplate = {
  id: 'enc-diplo-ally-help',
  subType: 'diplomatic',
  name: '盟友求援',
  descriptionTemplate: '盟友遭到敌军攻击，请求{player}派兵支援！',
  difficulty: 'hard',
  environments: ['plains', 'city'],
  baseWeight: 5,
  cooldownTurns: 12,
  options: [
    {
      id: 'send_troops',
      text: '派兵支援',
      aiWeight: 50,
      consequences: {
        description: '出兵援助盟友',
        resourceChanges: { troops: -30, mandate: 25 },
      },
    },
    {
      id: 'send_supplies',
      text: '提供物资',
      aiWeight: 35,
      consequences: {
        description: '不派兵但提供物资',
        resourceChanges: { grain: -100, gold: -50, mandate: 10 },
      },
    },
    {
      id: 'decline',
      text: '拒绝援助',
      aiWeight: 15,
      consequences: {
        description: '盟友可能离心',
        resourceChanges: { mandate: -20 },
      },
    },
  ],
};
