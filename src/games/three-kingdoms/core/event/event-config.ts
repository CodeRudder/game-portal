/**
 * 核心层 — 事件数据配置
 *
 * 包含预定义的事件模板、横幅模板和遭遇模板。
 * 所有配置为只读常量，运行时不可修改。
 *
 * @module core/event/event-config
 */

import type {
  EventDef,
  EventBanner,
  BannerType,
} from './event.types';

// ─────────────────────────────────────────────
// 1. 紧急程度 → 横幅类型映射
// ─────────────────────────────────────────────

/** 紧急程度到横幅类型的映射 */
export const URGENCY_TO_BANNER_TYPE: Record<string, BannerType> = {
  low: 'info',
  medium: 'warning',
  high: 'danger',
  critical: 'opportunity',
} as const;

/** 紧急程度到优先级的映射 */
export const URGENCY_PRIORITY: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
} as const;

// ─────────────────────────────────────────────
// 2. 预定义事件模板
// ─────────────────────────────────────────────

/** 随机事件 — 流民求助 */
export const EVENT_RANDOM_REFUGEES: EventDef = {
  id: 'event-random-refugees',
  title: '流民求助',
  description: '一群流民来到你的领地，恳求你收留他们。他们看起来饥寒交迫，但也可能带来有用的技能。',
  triggerType: 'random',
  urgency: 'medium',
  scope: 'global',
  triggerProbability: 0.2,
  cooldownTurns: 10,
  options: [
    {
      id: 'accept',
      text: '收留流民',
      description: '提供食物和住所',
      consequences: {
        description: '消耗粮草，但增加人口和民心',
        resourceChanges: { grain: -50, troops: 20 },
        affinityChanges: {},
      },
    },
    {
      id: 'reject',
      text: '婉言拒绝',
      description: '资源有限，无法收留',
      consequences: {
        description: '流民失望离去',
        resourceChanges: {},
        affinityChanges: {},
      },
      isDefault: true,
    },
  ],
  expireAfterTurns: 3,
};

/** 随机事件 — 商队来访 */
export const EVENT_RANDOM_MERCHANTS: EventDef = {
  id: 'event-random-merchants',
  title: '商队来访',
  description: '一支远道而来的商队请求经过你的领地，并愿意支付过路费。',
  triggerType: 'random',
  urgency: 'low',
  scope: 'global',
  triggerProbability: 0.25,
  cooldownTurns: 8,
  options: [
    {
      id: 'allow',
      text: '允许通行',
      description: '收取过路费',
      consequences: {
        description: '获得金币收入',
        resourceChanges: { gold: 80 },
        affinityChanges: {},
      },
    },
    {
      id: 'tax',
      text: '征收重税',
      description: '收取高额过路费',
      consequences: {
        description: '获得更多金币，但名声受损',
        resourceChanges: { gold: 150 },
        affinityChanges: {},
      },
    },
    {
      id: 'refuse',
      text: '拒绝通行',
      isDefault: true,
      consequences: {
        description: '商队改道离去',
        resourceChanges: {},
        affinityChanges: {},
      },
    },
  ],
  expireAfterTurns: 2,
};

/** 固定事件 — 丰收祭典 */
export const EVENT_FIXED_HARVEST: EventDef = {
  id: 'event-fixed-harvest',
  title: '丰收祭典',
  description: '今年收成不错，百姓建议举办丰收祭典，以感谢上天恩赐。',
  triggerType: 'fixed',
  urgency: 'low',
  scope: 'global',
  triggerConditions: [
    { type: 'resource_threshold', params: { resource: 'grain', minAmount: 500 } },
  ],
  options: [
    {
      id: 'celebrate',
      text: '举办祭典',
      description: '花费粮草举办盛大祭典',
      consequences: {
        description: '消耗粮草，大幅提升民心',
        resourceChanges: { grain: -200, mandate: 30 },
        affinityChanges: {},
      },
    },
    {
      id: 'save',
      text: '储备粮草',
      isDefault: true,
      consequences: {
        description: '稳妥起见，储备粮草以备不时之需',
        resourceChanges: {},
        affinityChanges: {},
      },
    },
  ],
};

/** 连锁事件 — 第1幕：密信 */
export const EVENT_CHAIN_SECRET_LETTER_1: EventDef = {
  id: 'event-chain-letter-1',
  title: '神秘密信',
  description: '一封来历不明的密信被送到了你的案头，信中提到北方有一处宝藏，但需要三把钥匙才能开启。',
  triggerType: 'chain',
  urgency: 'high',
  scope: 'global',
  prerequisiteEventIds: [],
  options: [
    {
      id: 'investigate',
      text: '派人调查',
      consequences: {
        description: '派人暗中调查密信的来源',
        resourceChanges: { gold: -50 },
        triggerEventId: 'event-chain-letter-2',
      },
    },
    {
      id: 'ignore',
      text: '置之不理',
      isDefault: true,
      consequences: {
        description: '可能只是骗局，不值得冒险',
        resourceChanges: {},
      },
    },
  ],
  expireAfterTurns: 5,
};

/** 连锁事件 — 第2幕：线索 */
export const EVENT_CHAIN_SECRET_LETTER_2: EventDef = {
  id: 'event-chain-letter-2',
  title: '线索浮现',
  description: '你的探子回报，密信所言非虚。在一处古庙中发现了第一把钥匙的线索。',
  triggerType: 'chain',
  urgency: 'high',
  scope: 'global',
  prerequisiteEventIds: ['event-chain-letter-1'],
  options: [
    {
      id: 'explore',
      text: '前往古庙',
      consequences: {
        description: '亲自前往古庙探查',
        resourceChanges: { gold: -100, troops: -10 },
        triggerEventId: 'event-chain-letter-3',
      },
    },
    {
      id: 'send_troops',
      text: '派遣士兵',
      consequences: {
        description: '派遣精兵前往探索',
        resourceChanges: { troops: -30 },
        triggerEventId: 'event-chain-letter-3',
      },
    },
  ],
};

/** 连锁事件 — 第3幕：宝藏 */
export const EVENT_CHAIN_SECRET_LETTER_3: EventDef = {
  id: 'event-chain-letter-3',
  title: '宝藏现世',
  description: '经过一番探索，你终于找到了传说中的宝藏！大量金银珠宝和上古兵法呈现在眼前。',
  triggerType: 'chain',
  urgency: 'critical',
  scope: 'global',
  prerequisiteEventIds: ['event-chain-letter-1', 'event-chain-letter-2'],
  options: [
    {
      id: 'take_all',
      text: '尽数收下',
      consequences: {
        description: '将所有宝物收入囊中',
        resourceChanges: { gold: 500, mandate: 20 },
        affinityChanges: {},
      },
    },
    {
      id: 'share',
      text: '分赏将士',
      consequences: {
        description: '将部分宝物赏赐给将士，提升士气',
        resourceChanges: { gold: 300, troops: 50, mandate: 40 },
        affinityChanges: {},
      },
    },
  ],
};

/** 所有预定义事件映射 */
export const PREDEFINED_EVENTS: Record<string, EventDef> = {
  'event-random-refugees': EVENT_RANDOM_REFUGEES,
  'event-random-merchants': EVENT_RANDOM_MERCHANTS,
  'event-fixed-harvest': EVENT_FIXED_HARVEST,
  'event-chain-letter-1': EVENT_CHAIN_SECRET_LETTER_1,
  'event-chain-letter-2': EVENT_CHAIN_SECRET_LETTER_2,
  'event-chain-letter-3': EVENT_CHAIN_SECRET_LETTER_3,
} as const;

/** 存档版本号 */
export const EVENT_SAVE_VERSION = 1;
