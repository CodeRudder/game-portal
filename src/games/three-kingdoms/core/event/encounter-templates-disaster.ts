/**
 * 核心层 — 天灾遭遇模板
 *
 * disaster 子类型遭遇模板（5个）
 *
 * @module core/event/encounter-templates-disaster
 */

import type { EncounterTemplate } from './event-v15.types';

// ─────────────────────────────────────────────
// 天灾人祸（disaster）— 5个
// ─────────────────────────────────────────────

/** 天灾 — 旱灾 */
export const ENCOUNTER_DISASTER_DROUGHT: EncounterTemplate = {
  id: 'enc-disaster-drought',
  subType: 'disaster',
  name: '大旱之年',
  descriptionTemplate: '连续数月无雨，{player}的领地遭遇严重旱灾！',
  difficulty: 'hard',
  environments: ['plains', 'desert'],
  baseWeight: 4,
  cooldownTurns: 15,
  options: [
    {
      id: 'irrigate',
      text: '兴修水利',
      aiWeight: 50,
      consequences: {
        description: '投入资源修建灌溉系统',
        resourceChanges: { gold: -200, grain: -50, mandate: 20 },
      },
    },
    {
      id: 'ration',
      text: '配给粮食',
      aiWeight: 40,
      consequences: {
        description: '实行粮食配给制度',
        resourceChanges: { grain: -100, mandate: -10 },
      },
    },
  ],
};

/** 天灾 — 洪水 */
export const ENCOUNTER_DISASTER_FLOOD: EncounterTemplate = {
  id: 'enc-disaster-flood',
  subType: 'disaster',
  name: '洪水泛滥',
  descriptionTemplate: '连日暴雨导致河水暴涨，{player}的领地洪水泛滥！',
  difficulty: 'hard',
  environments: ['plains', 'river'],
  baseWeight: 4,
  cooldownTurns: 15,
  options: [
    {
      id: 'reinforce',
      text: '加固堤坝',
      aiWeight: 50,
      consequences: {
        description: '紧急加固堤坝',
        resourceChanges: { gold: -150, troops: -10, mandate: 15 },
      },
    },
    {
      id: 'evacuate',
      text: '紧急撤离',
      aiWeight: 40,
      consequences: {
        description: '组织百姓撤离',
        resourceChanges: { troops: -5, grain: -80 },
      },
    },
  ],
};

/** 天灾 — 瘟疫 */
export const ENCOUNTER_DISASTER_PLAGUE: EncounterTemplate = {
  id: 'enc-disaster-plague',
  subType: 'disaster',
  name: '瘟疫蔓延',
  descriptionTemplate: '一场可怕的瘟疫在{player}的领地蔓延开来！',
  difficulty: 'epic',
  environments: ['city', 'plains'],
  baseWeight: 2,
  cooldownTurns: 20,
  options: [
    {
      id: 'quarantine',
      text: '隔离封锁',
      aiWeight: 50,
      consequences: {
        description: '封锁疫区，隔离患者',
        resourceChanges: { troops: -15, grain: -100, mandate: 10 },
      },
    },
    {
      id: 'treat',
      text: '全力救治',
      aiWeight: 40,
      consequences: {
        description: '征召医师全力救治',
        resourceChanges: { gold: -200, troops: -10, mandate: 25 },
      },
    },
    {
      id: 'abandon',
      text: '弃城转移',
      aiWeight: 10,
      consequences: {
        description: '放弃疫区，转移人口',
        resourceChanges: { troops: -30, grain: -150, mandate: -20 },
      },
    },
  ],
};

/** 天灾 — 蝗灾 */
export const ENCOUNTER_DISASTER_LOCUST: EncounterTemplate = {
  id: 'enc-disaster-locust',
  subType: 'disaster',
  name: '蝗虫成灾',
  descriptionTemplate: '铺天盖地的蝗虫席卷了{player}的农田！',
  difficulty: 'normal',
  environments: ['plains'],
  baseWeight: 5,
  cooldownTurns: 12,
  options: [
    {
      id: 'burn',
      text: '焚烧驱蝗',
      aiWeight: 50,
      consequences: {
        description: '焚烧部分农田驱赶蝗虫',
        resourceChanges: { grain: -80, mandate: 5 },
      },
    },
    {
      id: 'protect',
      text: '保护核心农田',
      aiWeight: 40,
      consequences: {
        description: '集中力量保护核心产区',
        resourceChanges: { grain: -60, troops: -5 },
      },
    },
  ],
};

/** 天灾 — 地震 */
export const ENCOUNTER_DISASTER_EARTHQUAKE: EncounterTemplate = {
  id: 'enc-disaster-earthquake',
  subType: 'disaster',
  name: '地动山摇',
  descriptionTemplate: '一场突如其来的地震袭击了{player}的领地！',
  difficulty: 'epic',
  environments: ['city', 'mountain', 'plains'],
  baseWeight: 2,
  cooldownTurns: 25,
  options: [
    {
      id: 'rescue',
      text: '全力救援',
      aiWeight: 60,
      consequences: {
        description: '组织力量全力救援',
        resourceChanges: { gold: -200, troops: -15, grain: -80, mandate: 20 },
      },
    },
    {
      id: 'rebuild',
      text: '灾后重建',
      aiWeight: 40,
      consequences: {
        description: '投入资源进行重建',
        resourceChanges: { gold: -300, mandate: 30 },
      },
    },
  ],
};
