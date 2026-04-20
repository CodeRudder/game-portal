/**
 * 贸易域 — 类型定义
 *
 * 规则：只有 interface/type/enum，零逻辑
 * 涵盖：贸易路线、商队、价格波动、贸易事件、繁荣度、NPC商人
 */

// ─────────────────────────────────────────────
// 1. 城市与商路
// ─────────────────────────────────────────────

/** 城市ID */
export type CityId = 'luoyang' | 'changan' | 'xuchang' | 'ye' | 'chengdu' | 'jianye' | 'xiangyang' | 'chaisang';

/** 所有城市ID */
export const CITY_IDS: readonly CityId[] = [
  'luoyang', 'changan', 'xuchang', 'ye', 'chengdu', 'jianye', 'xiangyang', 'chaisang',
] as const;

/** 城市名称映射 */
export const CITY_LABELS: Record<CityId, string> = {
  luoyang: '洛阳',
  changan: '长安',
  xuchang: '许昌',
  ye: '邺城',
  chengdu: '成都',
  jianye: '建业',
  xiangyang: '襄阳',
  chaisang: '柴桑',
};

/** 城市定义 */
export interface CityDef {
  id: CityId;
  name: string;
  /** 城市等级（影响商品品质） */
  level: number;
  /** 坐标X */
  x: number;
  /** 坐标Y */
  y: number;
}

/** 商路ID */
export type TradeRouteId = string;

/** 商路定义 */
export interface TradeRouteDef {
  id: TradeRouteId;
  /** 起始城市 */
  from: CityId;
  /** 目标城市 */
  to: CityId;
  /** 开通条件：主城等级 */
  requiredCastleLevel: number;
  /** 开通条件：前置商路ID（空=无前置） */
  requiredRoute?: TradeRouteId;
  /** 开通费用 */
  openCost: Record<string, number>;
  /** 基础运输时间（秒） */
  baseTravelTime: number;
  /** 基础利润率 */
  baseProfitRate: number;
}

/** 商路状态 */
export interface TradeRouteState {
  /** 商路ID */
  routeId: TradeRouteId;
  /** 是否已开通 */
  opened: boolean;
  /** 繁荣度 0~100 */
  prosperity: number;
  /** 完成贸易次数 */
  completedTrades: number;
}

// ─────────────────────────────────────────────
// 2. 贸易商品
// ─────────────────────────────────────────────

/** 贸易商品ID */
export type TradeGoodsId = string;

/** 贸易商品定义 */
export interface TradeGoodsDef {
  id: TradeGoodsId;
  name: string;
  /** 基础价格 */
  basePrice: number;
  /** 价格波动率（0~1） */
  volatility: number;
  /** 重量（影响载重） */
  weight: number;
  /** 所属城市 */
  originCity: CityId;
}

/** 贸易商品运行时价格 */
export interface TradeGoodsPrice {
  goodsId: TradeGoodsId;
  /** 当前价格 */
  currentPrice: number;
  /** 上次价格 */
  lastPrice: number;
  /** 连续涨跌次数（正=涨，负=跌） */
  consecutiveDirection: number;
  /** 上次刷新时间 */
  lastRefreshTime: number;
}

// ─────────────────────────────────────────────
// 3. 商队
// ─────────────────────────────────────────────

/** 商队状态 */
export type CaravanStatus = 'idle' | 'traveling' | 'trading' | 'returning';

/** 商队状态标签 */
export const CARAVAN_STATUS_LABELS: Record<CaravanStatus, string> = {
  idle: '待命',
  traveling: '运输中',
  trading: '交易中',
  returning: '返回中',
};

/** 商队属性 */
export interface CaravanAttributes {
  /** 载重上限 */
  capacity: number;
  /** 移动速度倍率 */
  speedMultiplier: number;
  /** 议价能力（影响利润） */
  bargainingPower: number;
  /** 当前载重 */
  currentLoad: number;
}

/** 商队实例 */
export interface Caravan {
  /** 商队唯一ID */
  id: string;
  /** 商队名称 */
  name: string;
  /** 商队等级 */
  level: number;
  /** 商队属性 */
  attributes: CaravanAttributes;
  /** 商队状态 */
  status: CaravanStatus;
  /** 当前执行商路ID */
  currentRouteId: TradeRouteId | null;
  /** 携带的货物 { goodsId: quantity } */
  cargo: Record<string, number>;
  /** 护卫武将ID */
  guardHeroId: string | null;
  /** 出发时间 */
  departTime: number;
  /** 预计到达时间 */
  arrivalTime: number;
}

/** 商队派遣请求 */
export interface CaravanDispatchRequest {
  /** 商队ID */
  caravanId: string;
  /** 商路ID */
  routeId: TradeRouteId;
  /** 货物列表 */
  cargo: Record<string, number>;
  /** 护卫武将ID（可选） */
  guardHeroId?: string;
}

/** 商队派遣结果 */
export interface CaravanDispatchResult {
  success: boolean;
  reason?: string;
  /** 预计到达时间 */
  estimatedArrival?: number;
  /** 预计利润 */
  estimatedProfit?: number;
}

// ─────────────────────────────────────────────
// 4. 利润计算
// ─────────────────────────────────────────────

/** 贸易利润计算结果 */
export interface TradeProfit {
  /** 总收入 */
  revenue: number;
  /** 总成本 */
  cost: number;
  /** 净利润 */
  profit: number;
  /** 利润率 */
  profitRate: number;
  /** 繁荣度加成 */
  prosperityBonus: number;
  /** 议价加成 */
  bargainingBonus: number;
  /** 护卫保护费 */
  guardCost: number;
}

// ─────────────────────────────────────────────
// 5. 护卫系统
// ─────────────────────────────────────────────

/** 护卫派遣结果 */
export interface GuardDispatchResult {
  success: boolean;
  reason?: string;
  /** 遇盗概率降低值 */
  riskReduction?: number;
}

/** 护卫武将互斥检查结果 */
export interface GuardMutexCheck {
  /** 是否可用 */
  available: boolean;
  /** 冲突的商队ID */
  conflictCaravanId?: string;
}

// ─────────────────────────────────────────────
// 6. 贸易事件
// ─────────────────────────────────────────────

/** 贸易事件类型 */
export type TradeEventType =
  | 'bandit'       // 山贼袭击
  | 'storm'        // 暴雨
  | 'tax'          // 关税
  | 'good_news'    // 商业繁荣
  | 'npc_trade'    // NPC商人
  | 'road_block'   // 道路堵塞
  | 'lucky_find'   // 意外发现
  | 'competition'; // 商业竞争

/** 贸易事件定义 */
export interface TradeEventDef {
  /** 事件类型 */
  type: TradeEventType;
  /** 事件名称 */
  name: string;
  /** 事件描述 */
  description: string;
  /** 风险等级（影响护卫自动处理） */
  riskLevel: 'low' | 'medium' | 'high';
  /** 护卫可自动处理 */
  guardCanAutoResolve: boolean;
  /** 无护卫时的处理选项 */
  options: TradeEventOption[];
}

/** 事件处理选项 */
export interface TradeEventOption {
  /** 选项ID */
  id: string;
  /** 选项描述 */
  label: string;
  /** 货物损失比例（0~1） */
  cargoLossRate: number;
  /** 货币消耗 */
  currencyCost?: Record<string, number>;
  /** 时间延迟（秒） */
  timeDelay: number;
  /** 繁荣度影响 */
  prosperityChange: number;
}

/** 贸易事件实例 */
export interface TradeEventInstance {
  /** 事件唯一ID */
  id: string;
  /** 事件定义类型 */
  eventType: TradeEventType;
  /** 关联商队ID */
  caravanId: string;
  /** 关联商路ID */
  routeId: TradeRouteId;
  /** 是否已处理 */
  resolved: boolean;
  /** 选择的选项ID */
  chosenOptionId?: string;
  /** 触发时间 */
  triggeredAt: number;
}

// ─────────────────────────────────────────────
// 7. 繁荣度
// ─────────────────────────────────────────────

/** 繁荣度等级 */
export type ProsperityLevel = 'declining' | 'normal' | 'thriving' | 'golden';

/** 繁荣度等级标签 */
export const PROSPERITY_LABELS: Record<ProsperityLevel, string> = {
  declining: '萧条',
  normal: '平稳',
  thriving: '繁荣',
  golden: '鼎盛',
};

/** 繁荣度等级阈值和产出倍率 */
export interface ProsperityTier {
  level: ProsperityLevel;
  minProsperity: number;
  maxProsperity: number;
  /** 产出倍率 */
  outputMultiplier: number;
  /** NPC商人解锁 */
  unlockNpcMerchant: boolean;
}

// ─────────────────────────────────────────────
// 8. NPC特殊商人
// ─────────────────────────────────────────────

/** NPC商人类型 */
export type NpcMerchantType = 'wandering' | 'rare' | 'luxury' | 'black_market' | 'master';

/** NPC商人定义 */
export interface NpcMerchantDef {
  type: NpcMerchantType;
  name: string;
  /** 出现条件：繁荣度等级 */
  requiredProsperity: ProsperityLevel;
  /** 出现概率 */
  appearanceChance: number;
  /** 特殊商品列表 */
  specialGoods: string[];
  /** 折扣率 */
  discountRate: number;
}

/** NPC商人实例 */
export interface NpcMerchantInstance {
  id: string;
  defType: NpcMerchantType;
  /** 所在城市 */
  cityId: CityId;
  /** 出现时间 */
  appearedAt: number;
  /** 持续时间（秒） */
  duration: number;
  /** 是否已交互 */
  interacted: boolean;
}

// ─────────────────────────────────────────────
// 9. 贸易系统存档
// ─────────────────────────────────────────────

/** 贸易系统存档数据 */
export interface TradeSaveData {
  /** 商路状态 */
  routes: Record<TradeRouteId, TradeRouteState>;
  /** 商品价格 */
  prices: Record<TradeGoodsId, TradeGoodsPrice>;
  /** 商队列表 */
  caravans: Caravan[];
  /** 活跃事件 */
  activeEvents: TradeEventInstance[];
  /** NPC商人 */
  npcMerchants: NpcMerchantInstance[];
  /** 版本号 */
  version: number;
}
