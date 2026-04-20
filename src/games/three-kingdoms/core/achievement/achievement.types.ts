/**
 * 核心层 — 成就系统类型定义
 *
 * 定义 v14.0 成就系统的所有核心类型：
 *   - 5维度成就框架 (战斗/建设/收集/社交/转生)
 *   - 成就奖励
 *   - 转生成就链
 *
 * @module core/achievement/achievement.types
 */

// ─────────────────────────────────────────────
// 1. 成就维度
// ─────────────────────────────────────────────

/** 成就维度 (5维度) */
export type AchievementDimension =
  | 'battle'      // 战斗维度 — 战斗胜利、关卡进度、PVP排名
  | 'building'    // 建设维度 — 建筑等级、升级次数、建筑种类
  | 'collection'  // 收集维度 — 武将收集、装备收集、资源总量
  | 'social'      // 社交维度 — NPC好感、公会贡献、好友互动
  | 'rebirth';    // 转生维度 — 转生次数、转生速度、转生后成就

/** 成就维度标签 */
export const ACHIEVEMENT_DIMENSION_LABELS: Record<AchievementDimension, string> = {
  battle: '战斗',
  building: '建设',
  collection: '收集',
  social: '社交',
  rebirth: '转生',
};

/** 成就维度图标 */
export const ACHIEVEMENT_DIMENSION_ICONS: Record<AchievementDimension, string> = {
  battle: '⚔️',
  building: '🏗️',
  collection: '📦',
  social: '🤝',
  rebirth: '🔄',
};

// ─────────────────────────────────────────────
// 2. 成就定义
// ─────────────────────────────────────────────

/** 成就稀有度 */
export type AchievementRarity = 'common' | 'rare' | 'epic' | 'legendary';

/** 成就稀有度标签 */
export const ACHIEVEMENT_RARITY_LABELS: Record<AchievementRarity, string> = {
  common: '普通',
  rare: '稀有',
  epic: '史诗',
  legendary: '传说',
};

/** 成就稀有度积分权重 */
export const ACHIEVEMENT_RARITY_WEIGHTS: Record<AchievementRarity, number> = {
  common: 1,
  rare: 3,
  epic: 10,
  legendary: 30,
};

/** 成就触发条件类型 */
export type AchievementConditionType =
  | 'battle_wins'          // 战斗胜利次数
  | 'battle_win_streak'    // 连胜次数
  | 'campaign_chapters'    // 通关章节数
  | 'pvp_rank'             // PVP排名
  | 'building_level'       // 建筑最高等级
  | 'building_count'       // 建筑总数
  | 'building_upgrades'    // 建筑升级总次数
  | 'hero_count'           // 武将数量
  | 'hero_star_total'      // 武将星级总和
  | 'equipment_count'      // 装备数量
  | 'resource_total'       // 资源总量
  | 'npc_max_favorability' // NPC最大好感度
  | 'alliance_contribution'// 公会贡献
  | 'friend_count'         // 好友数量
  | 'rebirth_count'        // 转生次数
  | 'rebirth_speed'        // 转生速度(天数)
  | 'post_rebirth_level'   // 转生后达到等级
  | 'prestige_level'       // 声望等级
  | 'prestige_points'      // 声望总点数
  | 'quest_completed'      // 完成任务总数
  | 'play_time';           // 游戏时长(小时)

/** 成就条件 */
export interface AchievementCondition {
  /** 条件类型 */
  type: AchievementConditionType;
  /** 目标值 */
  targetValue: number;
  /** 参数 */
  params?: Record<string, unknown>;
}

/** 成就定义 (模板) */
export interface AchievementDef {
  /** 成就唯一ID */
  id: string;
  /** 成就名称 */
  name: string;
  /** 成就描述 */
  description: string;
  /** 所属维度 */
  dimension: AchievementDimension;
  /** 稀有度 */
  rarity: AchievementRarity;
  /** 达成条件 */
  conditions: AchievementCondition[];
  /** 奖励 */
  rewards: AchievementReward;
  /** 前置成就ID */
  prerequisiteId?: string;
  /** 是否隐藏 (达成前不显示) */
  hidden: boolean;
  /** 排序权重 */
  sortOrder: number;
}

// ─────────────────────────────────────────────
// 3. 成就奖励
// ─────────────────────────────────────────────

/** 成就奖励 */
export interface AchievementReward {
  /** 资源奖励 */
  resources?: Record<string, number>;
  /** 经验奖励 */
  experience?: number;
  /** 声望值奖励 */
  prestigePoints?: number;
  /** 成就积分 */
  achievementPoints: number;
  /** 解锁ID */
  unlockIds?: string[];
}

// ─────────────────────────────────────────────
// 4. 转生成就链
// ─────────────────────────────────────────────

/** 转生成就链阶段 */
export interface RebirthAchievementChain {
  /** 链ID */
  chainId: string;
  /** 链名称 */
  chainName: string;
  /** 链描述 */
  description: string;
  /** 链中成就ID列表 (有序) */
  achievementIds: string[];
  /** 完成整条链的额外奖励 */
  chainBonusReward: AchievementReward;
}

// ─────────────────────────────────────────────
// 5. 成就实例 (运行时)
// ─────────────────────────────────────────────

/** 成就进度状态 */
export type AchievementStatus = 'locked' | 'in_progress' | 'completed' | 'claimed';

/** 成就实例 (运行时) */
export interface AchievementInstance {
  /** 成就定义ID */
  defId: string;
  /** 当前状态 */
  status: AchievementStatus;
  /** 各条件当前进度 */
  progress: Record<string, number>;
  /** 完成时间 */
  completedAt: number | null;
  /** 领取时间 */
  claimedAt: number | null;
}

// ─────────────────────────────────────────────
// 6. 成就系统状态
// ─────────────────────────────────────────────

/** 成就维度统计 */
export interface DimensionStats {
  /** 维度 */
  dimension: AchievementDimension;
  /** 已完成数量 */
  completedCount: number;
  /** 总数量 */
  totalCount: number;
  /** 维度积分 */
  totalPoints: number;
}

/** 成就系统状态 */
export interface AchievementState {
  /** 成就实例列表 */
  achievements: Record<string, AchievementInstance>;
  /** 总成就积分 */
  totalPoints: number;
  /** 各维度统计 */
  dimensionStats: Record<AchievementDimension, DimensionStats>;
  /** 已完成的成就链 */
  completedChains: string[];
  /** 成就链进度 */
  chainProgress: Record<string, number>;
}

/** 成就系统存档数据 */
export interface AchievementSaveData {
  /** 成就状态 */
  state: AchievementState;
  /** 版本号 */
  version: number;
}

/** 成就系统存档版本 */
export const ACHIEVEMENT_SAVE_VERSION = 1;
