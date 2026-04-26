/**
 * 货币域 — 类型定义
 *
 * 规则：只有 interface/type/enum，零逻辑
 * 涵盖：8种常驻货币、消耗优先级、汇率转换
 */

// ─────────────────────────────────────────────
// 1. 货币类型
// ─────────────────────────────────────────────

/** 8种常驻货币类型 */
export type CurrencyType =
  | 'copper'       // 铜钱 — 基础货币
  | 'mandate'      // 天命 — 稀有货币
  | 'recruit'      // 招贤令 — 武将招募
  | 'summon'       // 求贤令 — 高级招募
  | 'expedition'   // 远征币 — 远征商店
  | 'guild'        // 公会币 — 公会商店
  | 'reputation'   // 声望值 — NPC交易
  | 'ingot';       // 元宝 — 付费货币

/** 所有货币类型数组 */
export const CURRENCY_TYPES: readonly CurrencyType[] = [
  'copper',
  'mandate',
  'recruit',
  'summon',
  'expedition',
  'guild',
  'reputation',
  'ingot',
] as const;

/** 货币中文名映射 */
export const CURRENCY_LABELS: Record<CurrencyType, string> = {
  copper: '铜钱',
  mandate: '天命',
  recruit: '招贤令',
  summon: '求贤令',
  expedition: '远征币',
  guild: '公会币',
  reputation: '声望值',
  ingot: '元宝',
};

/** 货币颜色标识 */
export const CURRENCY_COLORS: Record<CurrencyType, string> = {
  copper: '#C9A84C',
  mandate: '#7B5EA7',
  recruit: '#4A90D9',
  summon: '#E6A817',
  expedition: '#D4763A',
  guild: '#5DAE4F',
  reputation: '#E85D75',
  ingot: '#FFD700',
};

/** 货币图标映射 */
export const CURRENCY_ICONS: Record<CurrencyType, string> = {
  copper: '🪙',
  mandate: '📜',
  recruit: '📋',
  summon: '📯',
  expedition: '⚔️',
  guild: '🏰',
  reputation: '⭐',
  ingot: '💎',
};

/** 货币是否为付费货币 */
export const CURRENCY_IS_PAID: Record<CurrencyType, boolean> = {
  copper: false,
  mandate: false,
  recruit: false,
  summon: false,
  expedition: false,
  guild: false,
  reputation: false,
  ingot: true,
};

// ─────────────────────────────────────────────
// 2. 货币余额
// ─────────────────────────────────────────────

/** 货币余额集合 */
export interface CurrencyWallet {
  copper: number;
  mandate: number;
  recruit: number;
  summon: number;
  expedition: number;
  guild: number;
  reputation: number;
  ingot: number;
}

// ─────────────────────────────────────────────
// 3. 消耗优先级
// ─────────────────────────────────────────────

/** 消耗优先级规则 */
export interface SpendPriority {
  /** 货币消耗顺序（优先消耗排在前面的） */
  order: CurrencyType[];
  /** 商店类型 */
  shopType: string;
}

/** 默认消耗优先级配置（按商店类型） */
export interface SpendPriorityConfig {
  /** 集市：优先铜钱 */
  normal: CurrencyType[];
  /** 黑市：优先声望值 */
  black_market: CurrencyType[];
  /** 限时特惠：仅元宝 */
  limited_time: CurrencyType[];
  /** VIP商店：优先元宝 */
  vip: CurrencyType[];
  /** 军需处：兵力+铜钱组合 */
  military: CurrencyType[];
  /** NPC交易：以物易物+铜钱补差 */
  npc: CurrencyType[];
}

// ─────────────────────────────────────────────
// 4. 汇率转换
// ─────────────────────────────────────────────

/** 汇率对 */
export interface ExchangeRate {
  /** 源货币 */
  from: CurrencyType;
  /** 目标货币 */
  to: CurrencyType;
  /** 汇率（1单位源 = rate单位目标） */
  rate: number;
}

/** 汇率转换请求 */
export interface ExchangeRequest {
  /** 源货币 */
  from: CurrencyType;
  /** 目标货币 */
  to: CurrencyType;
  /** 源货币数量 */
  amount: number;
}

/** 汇率转换结果 */
export interface ExchangeResult {
  /** 是否成功 */
  success: boolean;
  /** 消耗的源货币 */
  spent: number;
  /** 获得的目标货币 */
  received: number;
  /** 错误原因 */
  reason?: string;
}

// ─────────────────────────────────────────────
// 5. 货币不足提示
// ─────────────────────────────────────────────

/** 货币不足信息 */
export interface CurrencyShortage {
  /** 货币类型 */
  currency: CurrencyType;
  /** 需要数量 */
  required: number;
  /** 当前持有 */
  current: number;
  /** 缺口 */
  gap: number;
  /** 获取途径列表 */
  acquireHints: string[];
}

// ─────────────────────────────────────────────
// 6. 货币系统存档
// ─────────────────────────────────────────────

/** 货币系统存档数据 */
export interface CurrencySaveData {
  /** 钱包余额 */
  wallet: CurrencyWallet;
  /** 版本号 */
  version: number;
}
