/**
 * 核心层 — 声望系统配置常量
 *
 * 包含声望等级、获取途径、声望商店商品、转生条件等配置。
 * 所有配置为只读常量，运行时不可修改。
 *
 * @module core/prestige/prestige-config
 */

import type {
  PrestigeSourceConfig,
  PrestigeShopGoods,
  RebirthCondition,
  RebirthMultiplier,
  RebirthAcceleration,
  RebirthUnlockContent,
  LevelUnlockReward,
  PrestigeQuestDef,
  RebirthQuestDef,
} from './prestige.types';

// ─────────────────────────────────────────────
// 1. 声望等级配置
// ─────────────────────────────────────────────

/** 最大声望等级 */
export const MAX_PRESTIGE_LEVEL = 50;

/** 声望等级阈值公式系数 */
export const PRESTIGE_BASE = 1000;

/** 声望等级阈值公式指数 */
export const PRESTIGE_EXPONENT = 1.8;

/** 等级标题 (按等级段) */
export const PRESTIGE_LEVEL_TITLES: Record<number, string> = {
  1: '布衣',
  5: '亭长',
  10: '县令',
  15: '郡守',
  20: '刺史',
  25: '州牧',
  30: '将军',
  35: '大将军',
  40: '丞相',
  45: '太傅',
  50: '帝王',
};

/** 产出加成公式: 1 + level * 0.02 */
export const PRODUCTION_BONUS_PER_LEVEL = 0.02;

// ─────────────────────────────────────────────
// 2. 声望获取途径配置 (9种)
// ─────────────────────────────────────────────

/** 声望获取途径配置 */
export const PRESTIGE_SOURCE_CONFIGS: PrestigeSourceConfig[] = [
  { type: 'daily_quest', basePoints: 10, dailyCap: 100, description: '完成日常任务' },
  { type: 'main_quest', basePoints: 50, dailyCap: -1, description: '完成主线任务' },
  { type: 'battle_victory', basePoints: 5, dailyCap: 200, description: '战斗胜利' },
  { type: 'building_upgrade', basePoints: 15, dailyCap: 150, description: '升级建筑' },
  { type: 'tech_research', basePoints: 20, dailyCap: 100, description: '研究科技' },
  { type: 'npc_interact', basePoints: 8, dailyCap: 80, description: 'NPC交互' },
  { type: 'expedition', basePoints: 25, dailyCap: 150, description: '远征完成' },
  { type: 'pvp_rank', basePoints: 30, dailyCap: 200, description: 'PVP排名提升' },
  { type: 'event_complete', basePoints: 15, dailyCap: 100, description: '完成活动事件' },
];

// ─────────────────────────────────────────────
// 3. 声望商店商品
// ─────────────────────────────────────────────

/** 声望商店商品列表 */
export const PRESTIGE_SHOP_GOODS: PrestigeShopGoods[] = [
  {
    id: 'psg-001', name: '精铁礼包', description: '获得精铁×100',
    requiredLevel: 1, costPoints: 50, goodsType: 'material',
    rewards: { iron: 100 }, purchaseLimit: 5, icon: '📦',
  },
  {
    id: 'psg-002', name: '粮草补给', description: '获得粮草×500',
    requiredLevel: 3, costPoints: 80, goodsType: 'resource',
    rewards: { grain: 500 }, purchaseLimit: 3, icon: '🌾',
  },
  {
    id: 'psg-003', name: '建设加速', description: '建筑升级速度+20%持续1天',
    requiredLevel: 5, costPoints: 150, goodsType: 'buff',
    rewards: { buildSpeedBuff: 20 }, purchaseLimit: 1, icon: '⚡',
  },
  {
    id: 'psg-004', name: '招贤令×3', description: '获得招贤令×3',
    requiredLevel: 8, costPoints: 200, goodsType: 'material',
    rewards: { recruit: 3 }, purchaseLimit: 2, icon: '📜',
  },
  {
    id: 'psg-005', name: '科技加速', description: '科技研究速度+30%持续1天',
    requiredLevel: 10, costPoints: 300, goodsType: 'buff',
    rewards: { techSpeedBuff: 30 }, purchaseLimit: 1, icon: '🔬',
  },
  {
    id: 'psg-006', name: '稀有装备箱', description: '随机获得一件稀有装备',
    requiredLevel: 15, costPoints: 500, goodsType: 'material',
    rewards: { equipmentBox: 1 }, purchaseLimit: 1, icon: '🎁',
  },
  {
    id: 'psg-007', name: '高级资源包', description: '获得金币×2000+粮草×1000',
    requiredLevel: 20, costPoints: 800, goodsType: 'resource',
    rewards: { gold: 2000, grain: 1000 }, purchaseLimit: 2, icon: '💰',
  },
  {
    id: 'psg-008', name: '转生加速符', description: '下次转生加速效果+50%',
    requiredLevel: 25, costPoints: 1200, goodsType: 'buff',
    rewards: { rebirthSpeedBuff: 50 }, purchaseLimit: 1, icon: '🔮',
  },
  {
    id: 'psg-009', name: '传说武将碎片', description: '随机传说武将碎片×5',
    requiredLevel: 30, costPoints: 2000, goodsType: 'material',
    rewards: { legendHeroShard: 5 }, purchaseLimit: 1, icon: '✨',
  },
  {
    id: 'psg-010', name: '帝王宝库', description: '获得大量资源和稀有材料',
    requiredLevel: 40, costPoints: 5000, goodsType: 'unlock',
    rewards: { gold: 10000, grain: 5000, iron: 2000, mandate: 10 },
    purchaseLimit: 1, icon: '👑',
  },
];

// ─────────────────────────────────────────────
// 4. 等级解锁奖励
// ─────────────────────────────────────────────

/** 等级解锁奖励列表 */
export const LEVEL_UNLOCK_REWARDS: LevelUnlockReward[] = [
  { level: 1, description: '声望系统开启', resources: { gold: 100 }, claimed: false },
  { level: 5, description: '声望商店解锁', resources: { gold: 500 }, privilegeId: 'prestige_shop', claimed: false },
  { level: 10, description: '高级声望任务', resources: { gold: 1000, grain: 500 }, privilegeId: 'advanced_prestige_quest', claimed: false },
  { level: 15, description: '声望加成提升', resources: { gold: 2000 }, privilegeId: 'prestige_bonus_2', claimed: false },
  { level: 20, description: '转生系统解锁', resources: { gold: 5000 }, privilegeId: 'rebirth_system', claimed: false },
  { level: 30, description: '高级转生特权', resources: { gold: 10000, mandate: 50 }, privilegeId: 'advanced_rebirth', claimed: false },
  { level: 40, description: '帝王特权', resources: { gold: 50000, mandate: 200 }, privilegeId: 'emperor_privilege', claimed: false },
  { level: 50, description: '至高荣耀', resources: { gold: 100000, mandate: 500 }, privilegeId: 'supreme_glory', claimed: false },
];

// ─────────────────────────────────────────────
// 5. 转生系统配置
// ─────────────────────────────────────────────

/** 转生解锁条件 */
export const REBIRTH_CONDITIONS: RebirthCondition = {
  minPrestigeLevel: 20,
  minCastleLevel: 10,
  minHeroCount: 5,
  minTotalPower: 10000,
};

/** 转生倍率配置 */
export const REBIRTH_MULTIPLIER: RebirthMultiplier = {
  base: 1.0,
  perRebirth: 0.5,
  max: 10.0,
};

/** 转生保留规则列表 */
export const REBIRTH_KEEP_RULES = [
  'keep_heroes',
  'keep_equipment',
  'keep_tech_points',
  'keep_prestige',
  'keep_achievements',
  'keep_vip',
] as const;

/** 转生重置规则列表 */
export const REBIRTH_RESET_RULES = [
  'reset_buildings',
  'reset_resources',
  'reset_map_progress',
  'reset_quest_progress',
  'reset_campaign',
] as const;

/** 转生加速配置 (基于转生次数) */
export const REBIRTH_ACCELERATION: RebirthAcceleration = {
  buildSpeedMultiplier: 1.5,
  techSpeedMultiplier: 1.5,
  resourceMultiplier: 2.0,
  expMultiplier: 2.0,
  durationDays: 7,
};

/** 转生次数解锁内容 */
export const REBIRTH_UNLOCK_CONTENTS: RebirthUnlockContent[] = [
  { requiredRebirthCount: 1, description: '解锁转生商店', type: 'feature', unlockId: 'rebirth_shop' },
  { requiredRebirthCount: 2, description: '解锁高级武将', type: 'hero', unlockId: 'hero_legend' },
  { requiredRebirthCount: 3, description: '解锁特殊建筑', type: 'building', unlockId: 'building_special' },
  { requiredRebirthCount: 5, description: '解锁高级科技', type: 'tech', unlockId: 'tech_advanced' },
  { requiredRebirthCount: 7, description: '解锁秘境区域', type: 'area', unlockId: 'area_secret' },
  { requiredRebirthCount: 10, description: '解锁帝王之路', type: 'feature', unlockId: 'emperor_road' },
];

// ─────────────────────────────────────────────
// 6. 声望专属任务
// ─────────────────────────────────────────────

/** 声望专属任务列表 */
export const PRESTIGE_QUESTS: PrestigeQuestDef[] = [
  {
    id: 'pq-001', title: '声望初显', description: '达到声望等级3',
    requiredPrestigeLevel: 1, objectiveType: 'reach_prestige_level',
    targetCount: 3, rewards: { prestigePoints: 100, resources: { gold: 200 } },
  },
  {
    id: 'pq-002', title: '声名远扬', description: '累计获得1000声望值',
    requiredPrestigeLevel: 3, objectiveType: 'earn_prestige_points',
    targetCount: 1000, rewards: { prestigePoints: 200, resources: { gold: 500 } },
    prerequisiteId: 'pq-001',
  },
  {
    id: 'pq-003', title: '声望商人', description: '在声望商店购买3次',
    requiredPrestigeLevel: 5, objectiveType: 'buy_prestige_shop',
    targetCount: 3, rewards: { prestigePoints: 300, resources: { gold: 800 } },
    prerequisiteId: 'pq-002',
  },
  {
    id: 'pq-004', title: '名满天下', description: '达到声望等级15',
    requiredPrestigeLevel: 10, objectiveType: 'reach_prestige_level',
    targetCount: 15, rewards: { prestigePoints: 500, resources: { gold: 2000, mandate: 10 } },
    prerequisiteId: 'pq-003',
  },
  {
    id: 'pq-005', title: '特权解锁', description: '解锁5个特权',
    requiredPrestigeLevel: 15, objectiveType: 'unlock_privilege',
    targetCount: 5, rewards: { prestigePoints: 800, resources: { gold: 5000 } },
    prerequisiteId: 'pq-004',
  },
  {
    id: 'pq-006', title: '声望巅峰', description: '达到声望等级30',
    requiredPrestigeLevel: 20, objectiveType: 'reach_prestige_level',
    targetCount: 30, rewards: { prestigePoints: 1500, resources: { gold: 10000, mandate: 50 } },
    prerequisiteId: 'pq-005',
  },
];

/** 转生专属任务列表 */
export const REBIRTH_QUESTS: RebirthQuestDef[] = [
  {
    id: 'rq-001', title: '初次转生', description: '完成第一次转生',
    requiredRebirthCount: 0, objectiveType: 'rebirth_count',
    targetCount: 1, rewards: { prestigePoints: 500, resources: { gold: 3000 } },
  },
  {
    id: 'rq-002', title: '快速起步', description: '转生后3天内达到主城5级',
    requiredRebirthCount: 1, objectiveType: 'rebirth_speed',
    targetCount: 5, rewards: { prestigePoints: 300, resources: { gold: 2000 } },
  },
  {
    id: 'rq-003', title: '转生建设', description: '转生后升级建筑10次',
    requiredRebirthCount: 1, objectiveType: 'post_rebirth_build',
    targetCount: 10, rewards: { prestigePoints: 400, resources: { gold: 2500 } },
  },
  {
    id: 'rq-004', title: '转生征战', description: '转生后通关关卡20次',
    requiredRebirthCount: 1, objectiveType: 'post_rebirth_battle',
    targetCount: 20, rewards: { prestigePoints: 500, resources: { gold: 3000 } },
  },
  {
    id: 'rq-005', title: '三次轮回', description: '累计转生3次',
    requiredRebirthCount: 2, objectiveType: 'rebirth_count',
    targetCount: 3, rewards: { prestigePoints: 1000, resources: { gold: 8000, mandate: 20 } },
  },
  {
    id: 'rq-006', title: '轮回大师', description: '累计转生5次',
    requiredRebirthCount: 4, objectiveType: 'rebirth_count',
    targetCount: 5, rewards: { prestigePoints: 2000, resources: { gold: 15000, mandate: 50 } },
  },
];

// ─────────────────────────────────────────────
// 7. v16.0 传承系统深化配置
// ─────────────────────────────────────────────

import type {
  RebirthInitialGift,
  RebirthInstantBuild,
  RebirthUnlockContentV16,
} from './prestige.types';

/** 转生后初始资源赠送 */
export const REBIRTH_INITIAL_GIFT: RebirthInitialGift = {
  grain: 5000,
  gold: 3000,
  troops: 1000,
};

/** 转生后低级建筑瞬间升级配置 */
export const REBIRTH_INSTANT_BUILD: RebirthInstantBuild = {
  maxInstantLevel: 10,
  speedDivisor: 10, // 建筑升级时间÷10（几乎瞬间）
};

/** v16.0 转生次数解锁内容（覆盖v14.0） */
export const REBIRTH_UNLOCK_CONTENTS_V16: RebirthUnlockContentV16[] = [
  { requiredRebirthCount: 1, description: '天命系统解锁', type: 'feature', unlockId: 'mandate_system' },
  { requiredRebirthCount: 2, description: '专属科技路线', type: 'tech', unlockId: 'exclusive_tech' },
  { requiredRebirthCount: 3, description: '神话武将招募池', type: 'hero', unlockId: 'mythic_hero_pool' },
  { requiredRebirthCount: 5, description: '跨服竞技场', type: 'feature', unlockId: 'cross_server_arena' },
];

/** 收益模拟器边际收益递减拐点（小时） */
export const SIMULATION_DIMINISHING_RETURNS_HOUR = 72;

// ─────────────────────────────────────────────
// 8. 转生倍率纯计算（PRS-P1-01 fix: 从 unification/BalanceUtils 迁入）
// ─────────────────────────────────────────────

/**
 * 转生倍率增长曲线类型
 *
 * PRS-P1-01 修复：将转生倍率计算从 unification/BalanceUtils 迁移至 core/prestige，
 * 消除 RebirthSystem → unification 的跨域依赖。
 * 转生倍率是声望域的核心关注点，应内聚在 prestige 模块内。
 */
export type RebirthCurveType = 'linear' | 'diminishing' | 'accelerating' | 'logarithmic';

/** 转生倍率计算配置 */
export interface PrestigeRebirthConfig {
  maxRebirthCount: number;
  baseMultiplier: number;
  perRebirthIncrement: number;
  maxMultiplier: number;
  curveType: RebirthCurveType;
  decayFactor: number;
}

/**
 * 计算转生倍率（权威版本）
 *
 * 使用 REBIRTH_MULTIPLIER 常量作为默认配置。
 * 支持对数衰减曲线和递减曲线两种模式。
 *
 * @param count - 转生次数
 * @param config - 可选的自定义配置（默认使用 REBIRTH_MULTIPLIER）
 * @returns 转生倍率，保留两位小数
 */
export function calcRebirthMultiplierFromConfig(count: number, config?: Partial<PrestigeRebirthConfig>): number {
  // FIX-503: NaN/非有限数防护
  if (!Number.isFinite(count) || count <= 0) return 1.0;

  const cfg: PrestigeRebirthConfig = {
    maxRebirthCount: 100,
    baseMultiplier: REBIRTH_MULTIPLIER.base,
    perRebirthIncrement: REBIRTH_MULTIPLIER.perRebirth,
    maxMultiplier: REBIRTH_MULTIPLIER.max,
    curveType: 'logarithmic',
    decayFactor: 1.0,
    ...config,
  };

  if (cfg.curveType === 'logarithmic') {
    // 对数衰减曲线：multiplier = base + perRebirth × ln(1 + count) / ln(2)
    // 高转生次数时倍率增长自然放缓，避免线性失控
    const logIncrement = cfg.perRebirthIncrement * Math.log(1 + count) / Math.log(2);
    const multiplier = Math.min(cfg.baseMultiplier + logIncrement, cfg.maxMultiplier);
    return Math.round(multiplier * 100) / 100;
  }

  // 原有递减曲线逻辑（linear / diminishing / accelerating）
  let multiplier = cfg.baseMultiplier;
  for (let i = 1; i <= count; i++) {
    const increment = cfg.perRebirthIncrement * Math.pow(cfg.decayFactor, i - 1);
    multiplier = Math.min(multiplier + increment, cfg.maxMultiplier);
  }
  return Math.round(multiplier * 100) / 100;
}
