/**
 * 货币域 — 配置常量
 */

import type { CurrencyType, CurrencyWallet, SpendPriorityConfig, ExchangeRate } from './currency.types';

/** 货币存档版本 */
export const CURRENCY_SAVE_VERSION = 1;

/** 初始钱包余额 */
export const INITIAL_WALLET: CurrencyWallet = {
  copper: 1000,
  mandate: 0,
  recruit: 0,
  summon: 0,
  expedition: 0,
  guild: 0,
  reputation: 0,
  ingot: 0,
};

/** 各货币上限（null=无上限） */
export const CURRENCY_CAPS: Record<CurrencyType, number | null> = {
  copper: null,
  mandate: null,
  recruit: 999,
  summon: 99,
  expedition: null,
  guild: null,
  reputation: 99999,
  ingot: null,
};

/** 消耗优先级配置 */
export const SPEND_PRIORITY_CONFIG: SpendPriorityConfig = {
  normal: ['copper', 'mandate'],
  black_market: ['reputation', 'copper'],
  limited_time: ['ingot'],
  vip: ['ingot', 'copper'],
  military: ['copper', 'mandate'],
  npc: ['reputation', 'copper'],
};

/** 基础汇率表（以铜钱为基准） */
export const BASE_EXCHANGE_RATES: ExchangeRate[] = [
  { from: 'copper', to: 'copper', rate: 1 },
  { from: 'mandate', to: 'copper', rate: 100 },
  { from: 'ingot', to: 'copper', rate: 1000 },
  { from: 'reputation', to: 'copper', rate: 50 },
];

/** 货币获取途径提示 */
export const CURRENCY_ACQUIRE_HINTS: Record<CurrencyType, string[]> = {
  copper: ['建筑产出', '贸易收入', '出售物品', '关卡奖励'],
  mandate: ['主线任务', '成就奖励', '每日签到'],
  recruit: ['日常任务', '活动奖励', '商店购买'],
  summon: ['充值赠送', '大型活动', '竞技场排名'],
  expedition: ['远征玩法', '远征商店兑换'],
  guild: ['公会任务', '公会战奖励', '公会捐献'],
  reputation: ['NPC互动', '好感度奖励', '贸易事件'],
  ingot: ['充值获取', '成就奖励'],
};
