/**
 * 核心层 — 随机遭遇事件池模板配置
 *
 * 4子类型 × 5+模板 = 20+遭遇模板
 *   - combat（战斗）: 5个
 *   - diplomatic（外交）: 5个
 *   - exploration（探索）: 5个
 *   - disaster（天灾）: 5个
 *
 * @module core/event/encounter-templates
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

// ─────────────────────────────────────────────
// 全部模板汇总
// ─────────────────────────────────────────────

/** 所有遭遇模板列表 */
export const ALL_ENCOUNTER_TEMPLATES: EncounterTemplate[] = [
  // 战斗遭遇
  ENCOUNTER_COMBAT_BANDITS,
  ENCOUNTER_COMBAT_TIGER,
  ENCOUNTER_COMBAT_SCOUT,
  ENCOUNTER_COMBAT_BARBARIAN,
  ENCOUNTER_COMBAT_REBEL,
  // 外交遭遇
  ENCOUNTER_DIPLO_REFUGEES,
  ENCOUNTER_DIPLO_ENVOY,
  ENCOUNTER_DIPLO_SCHOLAR,
  ENCOUNTER_DIPLO_MERCHANTS,
  ENCOUNTER_DIPLO_ALLY_HELP,
  // 探索遭遇
  ENCOUNTER_EXPLORE_TOMB,
  ENCOUNTER_EXPLORE_HERMIT,
  ENCOUNTER_EXPLORE_TREASURE_MAP,
  ENCOUNTER_EXPLORE_SECRET_PASSAGE,
  ENCOUNTER_EXPLORE_SPRING,
  // 天灾人祸
  ENCOUNTER_DISASTER_DROUGHT,
  ENCOUNTER_DISASTER_FLOOD,
  ENCOUNTER_DISASTER_PLAGUE,
  ENCOUNTER_DISASTER_LOCUST,
  ENCOUNTER_DISASTER_EARTHQUAKE,
];

/** 按子类型分组的模板映射 */
export const ENCOUNTER_TEMPLATES_BY_SUBTYPE: Record<string, EncounterTemplate[]> = {
  combat: [
    ENCOUNTER_COMBAT_BANDITS,
    ENCOUNTER_COMBAT_TIGER,
    ENCOUNTER_COMBAT_SCOUT,
    ENCOUNTER_COMBAT_BARBARIAN,
    ENCOUNTER_COMBAT_REBEL,
  ],
  diplomatic: [
    ENCOUNTER_DIPLO_REFUGEES,
    ENCOUNTER_DIPLO_ENVOY,
    ENCOUNTER_DIPLO_SCHOLAR,
    ENCOUNTER_DIPLO_MERCHANTS,
    ENCOUNTER_DIPLO_ALLY_HELP,
  ],
  exploration: [
    ENCOUNTER_EXPLORE_TOMB,
    ENCOUNTER_EXPLORE_HERMIT,
    ENCOUNTER_EXPLORE_TREASURE_MAP,
    ENCOUNTER_EXPLORE_SECRET_PASSAGE,
    ENCOUNTER_EXPLORE_SPRING,
  ],
  disaster: [
    ENCOUNTER_DISASTER_DROUGHT,
    ENCOUNTER_DISASTER_FLOOD,
    ENCOUNTER_DISASTER_PLAGUE,
    ENCOUNTER_DISASTER_LOCUST,
    ENCOUNTER_DISASTER_EARTHQUAKE,
  ],
};
