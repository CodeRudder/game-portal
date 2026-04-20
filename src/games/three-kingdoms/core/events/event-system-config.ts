/**
 * 核心层 — 事件系统数据配置
 *
 * 包含默认事件定义、横幅配置等静态数据。
 * 所有配置为只读常量，运行时不可修改。
 *
 * @module core/events/event-system-config
 */

import type {
  GameEventDef,
  EventBanner,
  EventPriority,
} from './event-system.types';

// ─────────────────────────────────────────────
// 1. 横幅配置（#22）
// ─────────────────────────────────────────────

/** 横幅默认显示时长（毫秒） */
export const BANNER_DEFAULT_DURATION = 5000;

/** 横幅最大队列长度 */
export const BANNER_MAX_QUEUE_SIZE = 5;

/** 横幅优先级排序权重 */
export const BANNER_PRIORITY_WEIGHT: Record<EventPriority, number> = {
  urgent: 4,
  high: 3,
  normal: 2,
  low: 1,
} as const;

/** 横幅图标映射 */
export const BANNER_ICONS: Record<string, string> = {
  military: '⚔️',
  diplomatic: '🤝',
  economic: '💰',
  natural: '🌧️',
  social: '👥',
  mystery: '❓',
} as const;

// ─────────────────────────────────────────────
// 2. 事件触发配置
// ─────────────────────────────────────────────

/** 全局事件触发冷却（回合数） */
export const GLOBAL_EVENT_COOLDOWN = 3;

/** 每回合最大触发事件数 */
export const MAX_EVENTS_PER_TURN = 2;

/** 离线处理最大事件数 */
export const MAX_OFFLINE_EVENTS = 10;

/** 离线领土损失上限比例 */
export const OFFLINE_TERRITORY_LOSS_CAP = 0.2;

// ─────────────────────────────────────────────
// 3. 默认事件定义（#21）
// ─────────────────────────────────────────────

/** 随机事件 — 流民投奔 */
export const EVENT_REFUGEES: GameEventDef = {
  id: 'evt-refugees',
  name: '流民投奔',
  description: '一群流离失所的百姓前来投奔，是否接纳？',
  triggerType: 'random',
  category: 'social',
  priority: 'normal',
  triggerProbability: 0.15,
  cooldownTurns: 10,
  durationTurns: 0,
  minTurn: 5,
  options: [
    {
      id: 'refugees-accept',
      text: '接纳流民',
      description: '增加人口，消耗粮草',
      consequences: [
        { type: 'resource_change', target: 'grain', value: -50, description: '粮草 -50' },
        { type: 'resource_change', target: 'troops', value: 30, description: '兵力 +30' },
      ],
      isDefault: true,
      aiWeight: 0.8,
    },
    {
      id: 'refugees-reject',
      text: '婉拒流民',
      description: '节省粮草，可能降低声望',
      consequences: [
        { type: 'resource_change', target: 'mandate', value: -5, description: '天命 -5' },
      ],
      aiWeight: 0.2,
    },
  ],
  offlineProcessable: true,
};

/** 随机事件 — 商队来访 */
export const EVENT_MERCHANT_CARAVAN: GameEventDef = {
  id: 'evt-merchant-caravan',
  name: '商队来访',
  description: '一支远方商队请求通行并交易，是否允许？',
  triggerType: 'random',
  category: 'economic',
  priority: 'normal',
  triggerProbability: 0.12,
  cooldownTurns: 8,
  durationTurns: 0,
  minTurn: 3,
  options: [
    {
      id: 'caravan-trade',
      text: '允许交易',
      description: '花费金币获取物资',
      consequences: [
        { type: 'resource_change', target: 'gold', value: -80, description: '金币 -80' },
        { type: 'resource_change', target: 'grain', value: 100, description: '粮草 +100' },
        { type: 'resource_change', target: 'troops', value: 20, description: '兵力 +20' },
      ],
      isDefault: true,
      aiWeight: 0.7,
    },
    {
      id: 'caravan-tax',
      text: '收取过路费',
      description: '获得金币，可能影响商路',
      consequences: [
        { type: 'resource_change', target: 'gold', value: 40, description: '金币 +40' },
      ],
      aiWeight: 0.3,
    },
    {
      id: 'caravan-reject',
      text: '拒绝通行',
      description: '无收益无损失',
      consequences: [],
      aiWeight: 0.1,
    },
  ],
  offlineProcessable: true,
};

/** 随机事件 — 暴风雨 */
export const EVENT_STORM: GameEventDef = {
  id: 'evt-storm',
  name: '暴风雨来袭',
  description: '一场猛烈的暴风雨正在逼近，如何应对？',
  triggerType: 'random',
  category: 'natural',
  priority: 'high',
  triggerProbability: 0.08,
  cooldownTurns: 15,
  durationTurns: 0,
  minTurn: 10,
  options: [
    {
      id: 'storm-prepare',
      text: '加固城防',
      description: '消耗资源但减少损失',
      consequences: [
        { type: 'resource_change', target: 'gold', value: -30, description: '金币 -30' },
        { type: 'resource_change', target: 'grain', value: -20, description: '粮草 -20' },
      ],
      isDefault: true,
      aiWeight: 0.9,
    },
    {
      id: 'storm-ignore',
      text: '听天由命',
      description: '不投入资源，可能遭受更大损失',
      consequences: [
        { type: 'resource_change', target: 'grain', value: -80, description: '粮草 -80' },
        { type: 'military_effect', target: 'troop_morale', value: -10, description: '士气下降' },
      ],
      aiWeight: 0.1,
    },
  ],
  offlineProcessable: true,
};

/** 固定事件 — 虎牢关之战 */
export const EVENT_HULAO_PASS: GameEventDef = {
  id: 'evt-hulao-pass',
  name: '虎牢关之战',
  description: '虎牢关乃兵家必争之地，夺取此关可扼守要道！',
  triggerType: 'fixed',
  category: 'military',
  priority: 'high',
  triggerProbability: 1.0,
  cooldownTurns: 0,
  durationTurns: 0,
  minTurn: 20,
  options: [
    {
      id: 'hulao-attack',
      text: '强攻虎牢关',
      description: '消耗大量兵力但可占领要塞',
      consequences: [
        { type: 'resource_change', target: 'troops', value: -200, description: '兵力 -200' },
        { type: 'territory_effect', target: 'pass-hulao', value: 1, description: '占领虎牢关' },
      ],
      aiWeight: 0.6,
    },
    {
      id: 'hulao-bypass',
      text: '绕道而行',
      description: '保存实力但错失良机',
      consequences: [],
      aiWeight: 0.4,
    },
  ],
  offlineProcessable: false,
};

/** 连锁事件 — 暗谋之始 */
export const EVENT_SHADOW_PLOT_START: GameEventDef = {
  id: 'evt-shadow-plot-start',
  name: '暗谋之始',
  description: '探子来报，有人在暗中策划阴谋……',
  triggerType: 'chain',
  category: 'mystery',
  priority: 'urgent',
  triggerProbability: 0.05,
  cooldownTurns: 30,
  durationTurns: 5,
  minTurn: 30,
  options: [
    {
      id: 'shadow-investigate',
      text: '深入调查',
      description: '花费资源调查，可能发现真相',
      consequences: [
        { type: 'resource_change', target: 'gold', value: -60, description: '金币 -60' },
        { type: 'unlock_content', target: 'evt-shadow-plot-mid', value: 1, description: '解锁后续事件' },
      ],
      isDefault: true,
      aiWeight: 0.7,
    },
    {
      id: 'shadow-ignore',
      text: '暂时搁置',
      description: '不投入资源，但阴谋可能继续',
      consequences: [
        { type: 'military_effect', target: 'defense', value: -5, description: '防御力下降' },
      ],
      aiWeight: 0.3,
    },
  ],
  offlineProcessable: false,
};

/** 所有事件定义映射 */
export const DEFAULT_EVENT_DEFS: Record<string, GameEventDef> = {
  [EVENT_REFUGEES.id]: EVENT_REFUGEES,
  [EVENT_MERCHANT_CARAVAN.id]: EVENT_MERCHANT_CARAVAN,
  [EVENT_STORM.id]: EVENT_STORM,
  [EVENT_HULAO_PASS.id]: EVENT_HULAO_PASS,
  [EVENT_SHADOW_PLOT_START.id]: EVENT_SHADOW_PLOT_START,
} as const;

// ─────────────────────────────────────────────
// 4. 存档版本
// ─────────────────────────────────────────────

/** 事件系统存档版本号 */
export const EVENT_SYSTEM_SAVE_VERSION = 1;
