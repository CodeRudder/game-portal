/**
 * 核心层 — 任务系统类型定义
 *
 * 定义 v7.0 任务系统的所有核心类型：
 *   - 任务类型（主线/支线/日常）
 *   - 任务目标与进度
 *   - 活跃度系统
 *   - 任务奖励
 *
 * @module core/quest/quest.types
 */

// ─────────────────────────────────────────────
// 1. 任务基础类型
// ─────────────────────────────────────────────

/** 任务唯一标识 */
export type QuestId = string;

/** 任务类型 */
export type QuestCategory = 'main' | 'side' | 'daily' | 'weekly' | 'achievement';

/** 任务状态 */
export type QuestStatus = 'locked' | 'available' | 'active' | 'completed' | 'failed' | 'expired';

/** 目标类型 — 对应不同游戏行为 */
export type ObjectiveType =
  | 'build_upgrade'     // 升级建筑 N 次
  | 'battle_clear'      // 通关关卡 N 次
  | 'recruit_hero'      // 招募武将 N 次
  | 'collect_resource'  // 收集资源 N 个
  | 'npc_interact'      // 与 NPC 交互 N 次
  | 'npc_gift'          // 赠送 NPC N 次
  | 'tech_research'     // 研究科技 N 项
  | 'event_complete'    // 完成事件 N 个
  | 'daily_login'       // 每日登录
  | 'reach_chapter';    // 到达指定章节

/** 目标监听事件映射（QuestTrackerSystem 用） */
export const OBJECTIVE_EVENT_MAP: Record<ObjectiveType, string> = {
  build_upgrade: 'building:upgraded',
  battle_clear: 'battle:completed',
  recruit_hero: 'hero:recruited',
  collect_resource: 'resource:collected',
  npc_interact: 'npc:interacted',
  npc_gift: 'npc:gifted',
  tech_research: 'tech:researched',
  event_complete: 'event:resolved',
  daily_login: 'player:dailyLogin',
  reach_chapter: 'chapter:reached',
} as const;

// ─────────────────────────────────────────────
// 2. 任务目标
// ─────────────────────────────────────────────

/** 任务目标定义 */
export interface QuestObjective {
  /** 目标唯一 ID */
  id: string;
  /** 目标类型 */
  type: ObjectiveType;
  /** 目标描述 */
  description: string;
  /** 目标数量 */
  targetCount: number;
  /** 当前进度 */
  currentCount: number;
  /** 目标参数（如具体建筑类型、资源类型等） */
  params?: Record<string, unknown>;
}

// ─────────────────────────────────────────────
// 3. 任务奖励
// ─────────────────────────────────────────────

/** 任务奖励 */
export interface QuestReward {
  /** 资源奖励 */
  resources?: Record<string, number>;
  /** 经验奖励 */
  experience?: number;
  /** 解锁 ID */
  unlockIds?: string[];
  /** 活跃度奖励（仅日常任务） */
  activityPoints?: number;
}

// ─────────────────────────────────────────────
// 4. 任务定义（模板）
// ─────────────────────────────────────────────

/** 任务定义（模板） */
export interface QuestDef {
  /** 任务唯一 ID */
  id: QuestId;
  /** 任务标题 */
  title: string;
  /** 任务描述 */
  description: string;
  /** 任务类型 */
  category: QuestCategory;
  /** 目标列表 */
  objectives: QuestObjective[];
  /** 奖励 */
  rewards: QuestReward;
  /** 前置任务 ID */
  prerequisiteQuestIds?: QuestId[];
  /** 前置条件 */
  requiredLevel?: number;
  /** 过期时间（日常任务，小时） */
  expireHours?: number;
  /** 跳转目标（UI 路由） */
  jumpTarget?: string;
  /** 排序权重 */
  sortOrder?: number;
}

// ─────────────────────────────────────────────
// 5. 任务实例（运行时）
// ─────────────────────────────────────────────

/** 任务实例（运行时） */
export interface QuestInstance {
  /** 实例唯一 ID */
  instanceId: string;
  /** 任务定义 ID */
  questDefId: QuestId;
  /** 任务状态 */
  status: QuestStatus;
  /** 目标进度 */
  objectives: QuestObjective[];
  /** 接受时间 */
  acceptedAt: number;
  /** 完成时间 */
  completedAt: number | null;
  /** 是否已领取奖励 */
  rewardClaimed: boolean;
}

// ─────────────────────────────────────────────
// 6. 活跃度系统
// ─────────────────────────────────────────────

/** 活跃度宝箱阈值 */
export interface ActivityMilestone {
  /** 所需活跃度 */
  points: number;
  /** 宝箱奖励 */
  rewards: QuestReward;
  /** 是否已领取 */
  claimed: boolean;
}

/** 活跃度系统状态 */
export interface ActivityState {
  /** 当前活跃度 */
  currentPoints: number;
  /** 今日最大活跃度 */
  maxPoints: number;
  /** 里程碑列表 */
  milestones: ActivityMilestone[];
  /** 上次重置日期 */
  lastResetDate: string;
}

/** 默认活跃度里程碑 */
export const DEFAULT_ACTIVITY_MILESTONES: ActivityMilestone[] = [
  { points: 40, rewards: { resources: { gold: 5000, strengthening_stone: 2 }, activityPoints: 0 }, claimed: false },
  { points: 60, rewards: { resources: { gem: 50, recruit_token: 1 }, activityPoints: 0 }, claimed: false },
  { points: 80, rewards: { resources: { gem: 100, purple_equipment_box: 1 }, activityPoints: 0 }, claimed: false },
  { points: 100, rewards: { resources: { gem: 200, golden_fragment: 3 }, activityPoints: 0 }, claimed: false },
];

// ─────────────────────────────────────────────
// 7. 日常任务池配置
// ─────────────────────────────────────────────

/** 日常任务池配置 */
export interface DailyQuestPoolConfig {
  /** 任务池大小 */
  poolSize: number;
  /** 每日抽取数量 */
  dailyPickCount: number;
  /** 刷新时间（小时，0~23） */
  refreshHour: number;
}

/** 默认日常任务池配置 */
export const DEFAULT_DAILY_POOL_CONFIG: DailyQuestPoolConfig = {
  poolSize: 20,
  dailyPickCount: 6,
  refreshHour: 5,
};

// ─────────────────────────────────────────────
// 7.5 周常任务池配置
// ─────────────────────────────────────────────

/** 周常任务池配置 */
export interface WeeklyQuestPoolConfig {
  /** 任务池大小 */
  poolSize: number;
  /** 每周抽取数量 */
  weeklyPickCount: number;
  /** 刷新时间（周几，1=周一） */
  refreshDay: number;
  /** 刷新时间（小时，0~23） */
  refreshHour: number;
}

/** 默认周常任务池配置（PRD §QST-3: 每周一05:00重置） */
export const DEFAULT_WEEKLY_POOL_CONFIG: WeeklyQuestPoolConfig = {
  poolSize: 12,
  weeklyPickCount: 4,
  refreshDay: 1, // 周一
  refreshHour: 5,
};

// ─────────────────────────────────────────────
// 8. 任务系统存档
// ─────────────────────────────────────────────

/** 任务系统存档数据 */
export interface QuestSystemSaveData {
  /** 活跃任务实例 */
  activeQuests: QuestInstance[];
  /** 已完成任务 ID 列表 */
  completedQuestIds: QuestId[];
  /** 活跃度状态 */
  activityState: ActivityState;
  /** 日常任务刷新日期 */
  dailyRefreshDate: string;
  /** 当前日常任务实例 ID 列表 */
  dailyQuestInstanceIds: string[];
  /** 周常任务刷新日期 */
  weeklyRefreshDate?: string;
  /** 当前周常任务实例 ID 列表 */
  weeklyQuestInstanceIds?: string[];
  /** 追踪中的任务实例 ID 列表 */
  trackedQuestIds?: string[];
  /** 实例计数器（用于生成唯一 instanceId） */
  instanceCounter?: number;
  /** 版本号 */
  version: number;
}

/** 任务系统存档版本 */
export const QUEST_SAVE_VERSION = 1;
