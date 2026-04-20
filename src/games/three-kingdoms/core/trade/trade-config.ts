/**
 * 贸易域 — 配置常量
 */

import type {
  CityDef, CityId, TradeRouteDef, TradeGoodsDef,
  ProsperityTier, ProsperityLevel, NpcMerchantDef,
  TradeEventDef,
} from './trade.types';

// ─────────────────────────────────────────────
// 城市配置
// ─────────────────────────────────────────────

/** 8座城市定义 */
export const CITY_DEFS: Record<CityId, CityDef> = {
  luoyang: { id: 'luoyang', name: '洛阳', level: 5, x: 50, y: 40 },
  changan: { id: 'changan', name: '长安', level: 5, x: 20, y: 30 },
  xuchang: { id: 'xuchang', name: '许昌', level: 4, x: 55, y: 50 },
  ye: { id: 'ye', name: '邺城', level: 4, x: 55, y: 20 },
  chengdu: { id: 'chengdu', name: '成都', level: 4, x: 15, y: 60 },
  jianye: { id: 'jianye', name: '建业', level: 4, x: 80, y: 60 },
  xiangyang: { id: 'xiangyang', name: '襄阳', level: 3, x: 40, y: 55 },
  chaisang: { id: 'chaisang', name: '柴桑', level: 3, x: 65, y: 65 },
};

// ─────────────────────────────────────────────
// 商路配置
// ─────────────────────────────────────────────

/** 8条商路定义 */
export const TRADE_ROUTE_DEFS: TradeRouteDef[] = [
  {
    id: 'route_luoyang_xuchang',
    from: 'luoyang', to: 'xuchang',
    requiredCastleLevel: 1,
    openCost: { copper: 500 },
    baseTravelTime: 600, // 10分钟
    baseProfitRate: 0.15,
  },
  {
    id: 'route_xuchang_xiangyang',
    from: 'xuchang', to: 'xiangyang',
    requiredCastleLevel: 2,
    requiredRoute: 'route_luoyang_xuchang',
    openCost: { copper: 1000 },
    baseTravelTime: 900,
    baseProfitRate: 0.18,
  },
  {
    id: 'route_xiangyang_chengdu',
    from: 'xiangyang', to: 'chengdu',
    requiredCastleLevel: 3,
    requiredRoute: 'route_xuchang_xiangyang',
    openCost: { copper: 2000, mandate: 5 },
    baseTravelTime: 1200,
    baseProfitRate: 0.22,
  },
  {
    id: 'route_luoyang_ye',
    from: 'luoyang', to: 'ye',
    requiredCastleLevel: 3,
    openCost: { copper: 1500 },
    baseTravelTime: 900,
    baseProfitRate: 0.16,
  },
  {
    id: 'route_ye_changan',
    from: 'ye', to: 'changan',
    requiredCastleLevel: 4,
    requiredRoute: 'route_luoyang_ye',
    openCost: { copper: 3000 },
    baseTravelTime: 1200,
    baseProfitRate: 0.20,
  },
  {
    id: 'route_xuchang_jianye',
    from: 'xuchang', to: 'jianye',
    requiredCastleLevel: 5,
    requiredRoute: 'route_xuchang_xiangyang',
    openCost: { copper: 5000, mandate: 10 },
    baseTravelTime: 1500,
    baseProfitRate: 0.25,
  },
  {
    id: 'route_jianye_chaisang',
    from: 'jianye', to: 'chaisang',
    requiredCastleLevel: 6,
    requiredRoute: 'route_xuchang_jianye',
    openCost: { copper: 8000 },
    baseTravelTime: 1200,
    baseProfitRate: 0.20,
  },
  {
    id: 'route_changan_chengdu',
    from: 'changan', to: 'chengdu',
    requiredCastleLevel: 8,
    requiredRoute: 'route_ye_changan',
    openCost: { copper: 15000, mandate: 20 },
    baseTravelTime: 1800,
    baseProfitRate: 0.30,
  },
];

// ─────────────────────────────────────────────
// 贸易商品配置
// ─────────────────────────────────────────────

/** 10种贸易商品 */
export const TRADE_GOODS_DEFS: TradeGoodsDef[] = [
  { id: 'silk', name: '丝绸', basePrice: 100, volatility: 0.15, weight: 1, originCity: 'chengdu' },
  { id: 'tea', name: '茶叶', basePrice: 80, volatility: 0.12, weight: 1, originCity: 'jianye' },
  { id: 'iron', name: '铁矿石', basePrice: 60, volatility: 0.10, weight: 3, originCity: 'ye' },
  { id: 'horse', name: '战马', basePrice: 200, volatility: 0.18, weight: 5, originCity: 'changan' },
  { id: 'grain_trade', name: '精粮', basePrice: 30, volatility: 0.08, weight: 2, originCity: 'xuchang' },
  { id: 'wine', name: '美酒', basePrice: 120, volatility: 0.14, weight: 2, originCity: 'luoyang' },
  { id: 'jade', name: '玉石', basePrice: 300, volatility: 0.20, weight: 1, originCity: 'changan' },
  { id: 'medicine', name: '药材', basePrice: 150, volatility: 0.16, weight: 1, originCity: 'xiangyang' },
  { id: 'salt', name: '食盐', basePrice: 50, volatility: 0.10, weight: 2, originCity: 'chaisang' },
  { id: 'lacquerware', name: '漆器', basePrice: 250, volatility: 0.22, weight: 1, originCity: 'chengdu' },
];

// ─────────────────────────────────────────────
// 价格波动配置
// ─────────────────────────────────────────────

/** 价格刷新间隔（秒）6h = 21600s */
export const PRICE_REFRESH_INTERVAL = 21600;

/** 连续涨跌上限 */
export const MAX_CONSECUTIVE_DIRECTION = 3;

// ─────────────────────────────────────────────
// 繁荣度配置
// ─────────────────────────────────────────────

/** 繁荣度等级配置 */
export const PROSPERITY_TIERS: ProsperityTier[] = [
  { level: 'declining', minProsperity: 0, maxProsperity: 25, outputMultiplier: 0.8, unlockNpcMerchant: false },
  { level: 'normal', minProsperity: 25, maxProsperity: 50, outputMultiplier: 1.0, unlockNpcMerchant: false },
  { level: 'thriving', minProsperity: 50, maxProsperity: 75, outputMultiplier: 1.3, unlockNpcMerchant: true },
  { level: 'golden', minProsperity: 75, maxProsperity: 100, outputMultiplier: 1.6, unlockNpcMerchant: true },
];

/** 繁荣度初始值 */
export const INITIAL_PROSPERITY = 30;

/** 每次贸易繁荣度增长 */
export const PROSPERITY_GAIN_PER_TRADE = 3;

/** 繁荣度自然衰减（每次tick） */
export const PROSPERITY_DECAY_RATE = 0.01;

// ─────────────────────────────────────────────
// 商队配置
// ─────────────────────────────────────────────

/** 初始商队数量 */
export const INITIAL_CARAVAN_COUNT = 2;

/** 商队最大数量 */
export const MAX_CARAVAN_COUNT = 5;

/** 商队基础属性 */
export const BASE_CARAVAN_ATTRIBUTES = {
  capacity: 20,
  speedMultiplier: 1.0,
  bargainingPower: 1.0,
};

/** 每趟运输最大事件数 */
export const MAX_EVENTS_PER_TRIP = 2;

/** 有护卫时遇盗概率降低 */
export const GUARD_RISK_REDUCTION = 0.5;

// ─────────────────────────────────────────────
// NPC商人配置
// ─────────────────────────────────────────────

/** 5种NPC商人 */
export const NPC_MERCHANT_DEFS: NpcMerchantDef[] = [
  { type: 'wandering', name: '行商', requiredProsperity: 'normal', appearanceChance: 0.3, specialGoods: ['silk', 'tea'], discountRate: 0.9 },
  { type: 'rare', name: '珍品商人', requiredProsperity: 'thriving', appearanceChance: 0.15, specialGoods: ['jade', 'lacquerware'], discountRate: 0.85 },
  { type: 'luxury', name: '奢侈品商', requiredProsperity: 'thriving', appearanceChance: 0.1, specialGoods: ['horse', 'wine'], discountRate: 0.8 },
  { type: 'black_market', name: '黑市商人', requiredProsperity: 'golden', appearanceChance: 0.08, specialGoods: ['jade', 'horse', 'lacquerware'], discountRate: 0.7 },
  { type: 'master', name: '商业大师', requiredProsperity: 'golden', appearanceChance: 0.05, specialGoods: ['silk', 'jade', 'lacquerware', 'medicine'], discountRate: 0.75 },
];

/** NPC商人持续时间（秒） */
export const NPC_MERCHANT_DURATION = 3600; // 1小时

// ─────────────────────────────────────────────
// 贸易事件配置
// ─────────────────────────────────────────────

/** 8种贸易事件 */
export const TRADE_EVENT_DEFS: TradeEventDef[] = [
  {
    type: 'bandit', name: '山贼袭击', description: '商队遭遇山贼！',
    riskLevel: 'high', guardCanAutoResolve: true,
    options: [
      { id: 'fight', label: '战斗', cargoLossRate: 0.1, timeDelay: 120, prosperityChange: 1 },
      { id: 'pay', label: '缴纳过路费', cargoLossRate: 0, currencyCost: { copper: 200 }, timeDelay: 0, prosperityChange: -1 },
      { id: 'bribe', label: '贿赂', cargoLossRate: 0, currencyCost: { copper: 100 }, timeDelay: 60, prosperityChange: -2 },
    ],
  },
  {
    type: 'storm', name: '暴雨', description: '突如其来的暴雨阻碍了商队前进！',
    riskLevel: 'low', guardCanAutoResolve: true,
    options: [
      { id: 'wait', label: '等待雨停', cargoLossRate: 0, timeDelay: 300, prosperityChange: 0 },
      { id: 'push_through', label: '冒雨前进', cargoLossRate: 0.15, timeDelay: 60, prosperityChange: 0 },
    ],
  },
  {
    type: 'tax', name: '关税', description: '前方关卡征收额外关税。',
    riskLevel: 'low', guardCanAutoResolve: false,
    options: [
      { id: 'pay_tax', label: '缴纳税费', cargoLossRate: 0, currencyCost: { copper: 150 }, timeDelay: 0, prosperityChange: -1 },
      { id: 'detour', label: '绕道而行', cargoLossRate: 0, timeDelay: 240, prosperityChange: 0 },
    ],
  },
  {
    type: 'good_news', name: '商业繁荣', description: '沿途商业繁荣，商品价格上涨！',
    riskLevel: 'low', guardCanAutoResolve: true,
    options: [
      { id: 'sell_high', label: '高价出售', cargoLossRate: 0, timeDelay: 0, prosperityChange: 3 },
    ],
  },
  {
    type: 'npc_trade', name: '偶遇商人', description: '路上遇到一位行商，可以交换货物。',
    riskLevel: 'low', guardCanAutoResolve: false,
    options: [
      { id: 'trade', label: '交换货物', cargoLossRate: 0, timeDelay: 60, prosperityChange: 2 },
      { id: 'decline', label: '婉拒', cargoLossRate: 0, timeDelay: 0, prosperityChange: 0 },
    ],
  },
  {
    type: 'road_block', name: '道路堵塞', description: '前方道路被山石堵塞。',
    riskLevel: 'medium', guardCanAutoResolve: false,
    options: [
      { id: 'clear', label: '清理道路', cargoLossRate: 0, timeDelay: 180, prosperityChange: 1 },
      { id: 'detour_block', label: '绕道而行', cargoLossRate: 0.05, timeDelay: 300, prosperityChange: 0 },
    ],
  },
  {
    type: 'lucky_find', name: '意外发现', description: '商队在路边发现了遗落的宝箱！',
    riskLevel: 'low', guardCanAutoResolve: true,
    options: [
      { id: 'open', label: '打开宝箱', cargoLossRate: 0, timeDelay: 30, prosperityChange: 2 },
    ],
  },
  {
    type: 'competition', name: '商业竞争', description: '另一支商队也在运输同类商品，价格受影响。',
    riskLevel: 'medium', guardCanAutoResolve: false,
    options: [
      { id: 'lower_price', label: '降价竞争', cargoLossRate: 0, currencyCost: { copper: 100 }, timeDelay: 0, prosperityChange: 1 },
      { id: 'wait_competition', label: '等待对手离开', cargoLossRate: 0, timeDelay: 240, prosperityChange: 0 },
    ],
  },
];

/** 贸易事件触发概率（每趟运输） */
export const TRADE_EVENT_TRIGGER_CHANCE = 0.4;

/** 贸易存档版本 */
export const TRADE_SAVE_VERSION = 1;
