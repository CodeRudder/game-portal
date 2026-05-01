/**
 * 核心层 — 声望系统类型定义
 *
 * 定义 v14.0 声望+转生系统的所有核心类型：
 *   - 声望等级与阈值公式 (1000 × N^1.8)
 *   - 声望获取途径 (9种)
 *   - 声望商店商品
 *   - 转生系统 (条件/倍率/保留/重置/加速)
 *   - 收益模拟器
 *
 * @module core/prestige/prestige.types
 */

// ─────────────────────────────────────────────
// 1. 声望等级
// ─────────────────────────────────────────────

/** 声望等级编号 (1~50) */
export type PrestigeLevel = number;

/** 声望等级信息 */
export interface PrestigeLevelInfo {
  /** 等级 */
  level: PrestigeLevel;
  /** 升级所需声望值 (1000 × N^1.8) */
  requiredPoints: number;
  /** 等级标题 */
  title: string;
  /** 产出加成倍率 */
  productionBonus: number;
  /** 解锁特权列表 */
  privileges: string[];
}

/** 声望分栏 */
export interface PrestigePanel {
  /** 当前声望值 */
  currentPoints: number;
  /** 当前等级 */
  currentLevel: PrestigeLevel;
  /** 距下一级所需声望 */
  nextLevelPoints: number;
  /** 累计声望 */
  totalPoints: number;
  /** 产出加成 */
  productionBonus: number;
}

// ─────────────────────────────────────────────
// 2. 声望获取途径
// ─────────────────────────────────────────────

/** 声望获取途径类型 (9种) */
export type PrestigeSourceType =
  | 'daily_quest'        // 完成日常任务
  | 'main_quest'         // 完成主线任务
  | 'battle_victory'     // 战斗胜利
  | 'building_upgrade'   // 升级建筑
  | 'tech_research'      // 研究科技
  | 'npc_interact'       // NPC交互
  | 'expedition'         // 远征完成
  | 'pvp_rank'           // PVP排名提升
  | 'event_complete';    // 完成活动事件

/** 声望获取配置 */
export interface PrestigeSourceConfig {
  /** 途径类型 */
  type: PrestigeSourceType;
  /** 基础声望值 */
  basePoints: number;
  /** 每日上限 (-1 表示无限) */
  dailyCap: number;
  /** 描述 */
  description: string;
}

/** 声望获取记录 */
export interface PrestigeGainRecord {
  /** 途径类型 */
  source: PrestigeSourceType;
  /** 获得声望值 */
  points: number;
  /** 获取时间戳 */
  timestamp: number;
  /** 关联ID (如任务ID、建筑ID) */
  relatedId?: string;
}

// ─────────────────────────────────────────────
// 3. 声望商店
// ─────────────────────────────────────────────

/** 声望商店商品定义 */
export interface PrestigeShopGoods {
  /** 商品ID */
  id: string;
  /** 商品名称 */
  name: string;
  /** 商品描述 */
  description: string;
  /** 所需声望等级 */
  requiredLevel: PrestigeLevel;
  /** 声望值消耗 */
  costPoints: number;
  /** 商品类型 */
  goodsType: 'resource' | 'material' | 'buff' | 'unlock';
  /** 奖励内容 */
  rewards: Record<string, number>;
  /** 限购数量 (-1=无限) */
  purchaseLimit: number;
  /** 图标 */
  icon: string;
}

/** 声望商店商品实例 */
export interface PrestigeShopItem {
  /** 商品定义ID */
  defId: string;
  /** 已购买数量 */
  purchased: number;
  /** 是否解锁 */
  unlocked: boolean;
}

// ─────────────────────────────────────────────
// 4. 等级解锁奖励
// ─────────────────────────────────────────────

/** 等级解锁奖励 */
export interface LevelUnlockReward {
  /** 解锁等级 */
  level: PrestigeLevel;
  /** 奖励描述 */
  description: string;
  /** 资源奖励 */
  resources: Record<string, number>;
  /** 解锁特权ID */
  privilegeId?: string;
  /** 是否已领取 */
  claimed: boolean;
}

// ─────────────────────────────────────────────
// 5. 转生系统
// ─────────────────────────────────────────────

/** 转生条件 */
export interface RebirthCondition {
  /** 最低声望等级 */
  minPrestigeLevel: number;
  /** 最低主城等级 */
  minCastleLevel: number;
  /** 最低武将数量 */
  minHeroCount: number;
  /** 最低总战力 */
  minTotalPower: number;
  /** 最低通关阶段（如 4 = 第4阶段"赤壁之战"） */
  minCampaignStage: number;
  /** 成就链ID（如 "first_glory" = "初露锋芒"） */
  requiredAchievementChainId: string;
  /** 成就链所需完成的子成就数量 */
  requiredAchievementChainCount: number;
}

/** 转生倍率配置 */
export interface RebirthMultiplier {
  /** 基础倍率 */
  base: number;
  /** 每次转生增加 */
  perRebirth: number;
  /** 最大倍率 */
  max: number;
}

/** 转生保留规则 */
export type RebirthKeepRule =
  | 'keep_heroes'         // 保留武将
  | 'keep_equipment'      // 保留装备
  | 'keep_tech_points'    // 保留科技点
  | 'keep_prestige'       // 保留声望等级
  | 'keep_achievements'   // 保留成就
  | 'keep_vip';           // 保留VIP等级

/** 转生重置规则 */
export type RebirthResetRule =
  | 'reset_buildings'     // 重置建筑
  | 'reset_resources'     // 重置资源
  | 'reset_map_progress'  // 重置地图进度
  | 'reset_quest_progress'// 重置任务进度
  | 'reset_campaign';     // 重置战役进度

/** 转生加速配置 */
export interface RebirthAcceleration {
  /** 建筑升级加速倍率 */
  buildSpeedMultiplier: number;
  /** 科技研究加速倍率 */
  techSpeedMultiplier: number;
  /** 资源产出加速倍率 */
  resourceMultiplier: number;
  /** 经验获取加速倍率 */
  expMultiplier: number;
  /** 加速持续天数 */
  durationDays: number;
}

/** 转生次数解锁内容 */
export interface RebirthUnlockContent {
  /** 所需转生次数 */
  requiredRebirthCount: number;
  /** 解锁内容描述 */
  description: string;
  /** 解锁类型 */
  type: 'hero' | 'building' | 'tech' | 'feature' | 'area';
  /** 解锁ID */
  unlockId: string;
}

/** 转生记录 */
export interface RebirthRecord {
  /** 转生次数 */
  rebirthCount: number;
  /** 转生前声望等级 */
  prestigeLevelBefore: number;
  /** 获得的转生倍率 */
  multiplier: number;
  /** 转生时间戳 */
  timestamp: number;
}

// ─────────────────────────────────────────────
// 6. 收益模拟器
// ─────────────────────────────────────────────

/** 收益模拟参数 */
export interface SimulationParams {
  /** 当前声望等级 */
  currentPrestigeLevel: number;
  /** 当前转生次数 */
  currentRebirthCount: number;
  /** 模拟天数 */
  simulateDays: number;
  /** 每日在线时长(小时) */
  dailyOnlineHours: number;
}

/** 收益模拟结果 */
export interface SimulationResult {
  /** 预计获得资源 */
  estimatedResources: Record<string, number>;
  /** 预计声望增长 */
  estimatedPrestigeGain: number;
  /** 预计等级提升 */
  estimatedLevelUps: number;
  /** 转生后加速收益 */
  rebirthAccelerationBonus: Record<string, number>;
  /** 模拟天数 */
  days: number;
}

// ─────────────────────────────────────────────
// 7. 声望专属任务
// ─────────────────────────────────────────────

/** 声望任务目标类型 */
export type PrestigeObjectiveType =
  | 'reach_prestige_level'   // 达到声望等级
  | 'earn_prestige_points'   // 获得声望值
  | 'complete_rebirth'       // 完成转生
  | 'buy_prestige_shop'      // 声望商店购买
  | 'unlock_privilege';      // 解锁特权

/** 声望任务定义 */
export interface PrestigeQuestDef {
  /** 任务ID */
  id: string;
  /** 任务标题 */
  title: string;
  /** 任务描述 */
  description: string;
  /** 所需声望等级 */
  requiredPrestigeLevel: number;
  /** 目标类型 */
  objectiveType: PrestigeObjectiveType;
  /** 目标数量 */
  targetCount: number;
  /** 奖励 */
  rewards: {
    resources?: Record<string, number>;
    prestigePoints?: number;
    experience?: number;
  };
  /** 前置任务 */
  prerequisiteId?: string;
}

/** 转生专属任务定义 */
export interface RebirthQuestDef {
  /** 任务ID */
  id: string;
  /** 任务标题 */
  title: string;
  /** 任务描述 */
  description: string;
  /** 所需转生次数 */
  requiredRebirthCount: number;
  /** 目标类型 */
  objectiveType: 'rebirth_count' | 'rebirth_speed' | 'post_rebirth_build' | 'post_rebirth_battle';
  /** 目标数量 */
  targetCount: number;
  /** 奖励 */
  rewards: {
    resources?: Record<string, number>;
    prestigePoints?: number;
    experience?: number;
  };
}

// ─────────────────────────────────────────────
// 8. 声望系统状态
// ─────────────────────────────────────────────

/** 声望系统状态 */
export interface PrestigeState {
  /** 当前声望值 */
  currentPoints: number;
  /** 累计声望值 */
  totalPoints: number;
  /** 当前声望等级 */
  currentLevel: PrestigeLevel;
  /** 各途径每日已获取声望 */
  dailyGained: Record<PrestigeSourceType, number>;
  /** 上次每日重置日期 */
  lastDailyReset: string;
  /** 声望商店购买记录 */
  shopPurchases: Record<string, number>;
  /** 等级奖励领取记录 */
  claimedLevelRewards: number[];
  /** 声望任务完成记录 */
  completedPrestigeQuests: string[];
  /** 声望任务进度 */
  prestigeQuestProgress: Record<string, number>;
}

/** 转生系统状态 */
export interface RebirthState {
  /** 转生次数 */
  rebirthCount: number;
  /** 当前转生倍率 */
  currentMultiplier: number;
  /** 转生记录 */
  rebirthRecords: RebirthRecord[];
  /** 加速效果剩余天数 */
  accelerationDaysLeft: number;
  /** 转生任务完成记录 */
  completedRebirthQuests: string[];
  /** 转生任务进度 */
  rebirthQuestProgress: Record<string, number>;
  /** 上次转生时间戳（毫秒），用于72小时冷却计算；首次转生时为0 */
  lastRebirthTimestamp?: number;
}

/** 声望系统存档数据 */
export interface PrestigeSaveData {
  /** 声望状态 */
  prestige: PrestigeState;
  /** 转生状态 */
  rebirth: RebirthState;
  /** 版本号 */
  version: number;
}

/** 声望系统存档版本 */
export const PRESTIGE_SAVE_VERSION = 1;

// ─────────────────────────────────────────────
// 9. v16.0 传承系统深化
// ─────────────────────────────────────────────

/** 转生后初始资源赠送 */
export interface RebirthInitialGift {
  /** 粮草赠送量 */
  grain: number;
  /** 铜钱赠送量 */
  gold: number;
  /** 兵力赠送量 */
  troops: number;
}

/** 转生后加速建筑配置（低级建筑瞬间升级） */
export interface RebirthInstantBuild {
  /** 可瞬间升级的最高建筑等级 */
  maxInstantLevel: number;
  /** 建筑升级时间除以倍率 */
  speedDivisor: number;
}

/** 一键重建配置 */
export interface RebirthAutoRebuild {
  /** 是否启用 */
  enabled: boolean;
  /** 按上次优先级自动升级 */
  useLastPriority: boolean;
}

/** 转生次数解锁内容（v16.0 更新） */
export interface RebirthUnlockContentV16 {
  /** 所需转生次数 */
  requiredRebirthCount: number;
  /** 解锁内容描述 */
  description: string;
  /** 解锁类型 */
  type: 'hero' | 'tech' | 'feature' | 'area';
  /** 解锁ID */
  unlockId: string;
}

/** 收益模拟器倍率对比结果 */
export interface RebirthSimulationComparison {
  /** 立即转生的倍率 */
  immediateMultiplier: number;
  /** 等待X小时后转生的倍率 */
  waitMultiplier: number;
  /** 等待时间（小时） */
  waitHours: number;
  /** 边际收益递减拐点（小时） */
  diminishingReturnsHour: number;
  /** 推荐转生时机 */
  recommendedAction: 'rebirth_now' | 'wait' | 'no_difference';
  /** 置信度 */
  confidence: 'high' | 'medium' | 'low';
}

/** 收益模拟器完整结果（v16.0 深化） */
export interface SimulationResultV16 extends SimulationResult {
  /** 声望增长预测曲线数据点 */
  prestigeGrowthCurve: Array<{ day: number; prestige: number }>;
  /** 倍率对比（每个等待选项一个结果） */
  comparison: RebirthSimulationComparison[];
  /** 推荐转生时机描述 */
  recommendation: string;
}
