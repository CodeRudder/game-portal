/**
 * 地图事件类型配置数据
 *
 * 定义5种地图事件类型的配置：触发权重、持续时间、奖励等。
 * 与PRD MAP-5 §8.5 一致。
 *
 * @module engine/map/map-event-config
 */

import type { MapEventTypeConfig } from './MapEventSystem';

/** 事件类型配置表（与PRD MAP-5一致） */
export const EVENT_TYPE_CONFIGS: MapEventTypeConfig[] = [
  {
    type: 'bandit',
    name: '流寇入侵',
    description: '一队流寇出现在你的领土附近，威胁过往商旅。',
    isCombat: true,
    choices: ['attack', 'negotiate', 'ignore'],
    weight: 25,
    duration: 7200000, // 2小时
    attackRewards: [
      { type: 'gold', amount: 500 },
      { type: 'grain', amount: 300 },
    ],
    negotiateRewards: [
      { type: 'gold', amount: 200 },
    ],
    ignoreRewards: [],
  },
  {
    type: 'caravan',
    name: '商队经过',
    description: '一支商队途经你的领地，是护送还是截获？',
    isCombat: false,
    choices: ['attack', 'negotiate', 'ignore'],
    weight: 20,
    duration: 5400000, // 1.5小时
    attackRewards: [
      { type: 'gold', amount: 800 },
      { type: 'grain', amount: 200 },
    ],
    negotiateRewards: [
      { type: 'gold', amount: 400 },
      { type: 'grain', amount: 100 },
    ],
    ignoreRewards: [],
  },
  {
    type: 'disaster',
    name: '天灾降临',
    description: '一场自然灾害正在逼近，需要尽快应对。',
    isCombat: false,
    choices: ['negotiate', 'ignore'],
    weight: 15,
    duration: 86400000, // 24小时
    attackRewards: [],
    negotiateRewards: [
      { type: 'grain', amount: 500 },
      { type: 'gold', amount: 200 },
    ],
    ignoreRewards: [],
  },
  {
    type: 'ruins',
    name: '遗迹发现',
    description: '探险者发现了一处古代遗迹，可能藏有珍宝。',
    isCombat: false,
    choices: ['attack', 'negotiate', 'ignore'],
    weight: 25,
    duration: 14400000, // 4小时
    attackRewards: [
      { type: 'gold', amount: 1000 },
      { type: 'techPoint', amount: 50 },
    ],
    negotiateRewards: [
      { type: 'gold', amount: 500 },
      { type: 'techPoint', amount: 20 },
    ],
    ignoreRewards: [],
  },
  {
    type: 'conflict',
    name: '阵营冲突',
    description: '两个阵营在你的边境发生冲突，局势紧张。',
    isCombat: true,
    choices: ['attack', 'negotiate', 'ignore'],
    weight: 15,
    duration: 172800000, // 48小时
    attackRewards: [
      { type: 'gold', amount: 1500 },
      { type: 'troops', amount: 200 },
    ],
    negotiateRewards: [
      { type: 'gold', amount: 600 },
      { type: 'troops', amount: 100 },
    ],
    ignoreRewards: [],
  },
];
