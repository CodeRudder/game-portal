/**
 * 远征系统 — 类型定义（聚合导出）
 *
 * v12.0 远征天下模块的全部类型
 * 规则：只有 interface/type/enum/const，零运行时逻辑
 *
 * 子模块：
 *   - expedition-battle.types — 战斗评级、奖励、扫荡、里程碑
 *
 * @module core/expedition/expedition.types
 */

import type { Faction } from '../../shared/types';

// 从战斗/奖励子模块重新导出
export {
  BattleGrade,
  GRADE_STARS,
  GRADE_LABELS,
  SweepType,
  SWEEP_CONFIG,
  MilestoneType,
} from './expedition-battle.types';

export type {
  ExpeditionBattleResult,
  ExpeditionReward,
  DropItem,
  MilestoneConfig,
} from './expedition-battle.types';

// 从子模块导入，用于本模块内引用
import type { ExpeditionReward } from './expedition-battle.types';
import { MilestoneType, SweepType } from './expedition-battle.types';

// ─────────────────────────────────────────────
// 1. 路线与节点
// ─────────────────────────────────────────────

/** 路线难度等级 */
export enum RouteDifficulty {
  EASY = 'EASY',
  NORMAL = 'NORMAL',
  HARD = 'HARD',
  EPIC = 'EPIC',
  AMBUSH = 'AMBUSH',
}

/** 难度标签映射 */
export const DIFFICULTY_LABELS: Record<RouteDifficulty, string> = {
  [RouteDifficulty.EASY]: '简单',
  [RouteDifficulty.NORMAL]: '普通',
  [RouteDifficulty.HARD]: '困难',
  [RouteDifficulty.EPIC]: '史诗',
  [RouteDifficulty.AMBUSH]: '奇袭',
};

/** 难度星级映射 */
export const DIFFICULTY_STARS: Record<RouteDifficulty, number> = {
  [RouteDifficulty.EASY]: 1,
  [RouteDifficulty.NORMAL]: 2,
  [RouteDifficulty.HARD]: 3,
  [RouteDifficulty.EPIC]: 4,
  [RouteDifficulty.AMBUSH]: 5,
};

/** 节点类型 */
export enum NodeType {
  BATTLE = 'BATTLE',
  EVENT = 'EVENT',
  TREASURE = 'TREASURE',
  REST = 'REST',
  BOSS = 'BOSS',
  SHOP = 'SHOP',
  BANDIT = 'BANDIT',
  HAZARD = 'HAZARD',
}

/** 节点状态 */
export enum NodeStatus {
  LOCKED = 'LOCKED',
  AVAILABLE = 'AVAILABLE',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CLEARED = 'CLEARED',
  MARCHING = 'MARCHING',
}

/** 远征节点 */
export interface ExpeditionNode {
  /** 节点ID */
  id: string;
  /** 节点类型 */
  type: NodeType;
  /** 节点状态 */
  status: NodeStatus;
  /** 节点名称 */
  name: string;
  /** 节点描述 */
  description?: string;
  /** 难度（仅战斗节点） */
  difficulty?: RouteDifficulty;
  /** 前置节点ID列表 */
  prerequisiteNodeIds?: string[];
  /** 后续节点ID列表 */
  nextNodeIds: string[];
  /** 位置坐标 */
  position?: { x: number; y: number };
  /** 推荐战力 */
  recommendedPower?: number;
  /** 休息治疗百分比 */
  healPercent?: number;
}

/** 远征路线 */
export interface ExpeditionRoute {
  /** 路线ID */
  id: string;
  /** 路线名称 */
  name: string;
  /** 路线描述 */
  description?: string;
  /** 所属区域ID */
  regionId: string;
  /** 难度等级 */
  difficulty: RouteDifficulty;
  /** 需要的等级 */
  requiredLevel?: number;
  /** 节点映射 */
  nodes: Record<string, ExpeditionNode>;
  /** 起始节点ID */
  startNodeId: string;
  /** 终止节点ID */
  endNodeId: string;
  /** 预计消耗兵力 */
  estimatedTroopCost?: number;
  /** 路线奖励 */
  reward?: ExpeditionReward;
  /** 阵营限制（空=不限） */
  factionRestriction?: Faction;
  /** 战力倍率 */
  powerMultiplier?: number;
  /** 行军时长（秒） */
  marchDurationSeconds?: number;
  /** 是否已解锁 */
  unlocked?: boolean;
  /** 前置区域ID */
  requiredRegionId?: string;
  /** 是否需要困难通关 */
  requireHardClear?: boolean;
}

/** 远征区域 */
export interface ExpeditionRegion {
  /** 区域ID */
  id: string;
  /** 区域名称 */
  name: string;
  /** 区域描述 */
  description?: string;
  /** 需要的等级 */
  requiredLevel?: number;
  /** 路线ID列表 */
  routeIds: string[];
  /** 区域背景图 */
  backgroundImage?: string;
  /** 排序序号 */
  order?: number;
}

// ─────────────────────────────────────────────
// 2. 阵型系统（从子模块导出）
// ─────────────────────────────────────────────

export {
  FormationType,
  FORMATION_LABELS,
  FORMATION_EFFECTS,
  FORMATION_COUNTERS,
} from './expedition-formation.types';

export type { FormationEffect } from './expedition-formation.types';

import { FormationType } from './expedition-formation.types';

/** 远征队伍 */
export interface ExpeditionTeam {
  /** 队伍ID */
  id: string;
  /** 队伍名称 */
  name: string;
  /** 武将ID列表 */
  heroIds: string[];
  /** 阵型 */
  formation: FormationType;
  /** 当前兵力 */
  troopCount: number;
  /** 最大兵力 */
  maxTroops: number;
  /** 总战力 */
  totalPower: number;
  /** 当前路线ID */
  currentRouteId: string | null;
  /** 当前节点ID */
  currentNodeId: string | null;
  /** 是否正在远征 */
  isExpeditioning: boolean;
}

// ─────────────────────────────────────────────
// 5. 自动远征
// ─────────────────────────────────────────────

/** 失败处理方式 */
export type FailureAction = 'pause' | 'skip';

/** 背包满处理方式 */
export type BagFullAction = 'pause' | 'auto_sell';

/** 兵力不足处理方式 */
export type LowTroopAction = 'pause' | 'use_item';

/** 自动远征设置 */
export interface AutoExpeditionConfig {
  /** 重复次数（0=无限） */
  repeatCount: number;
  /** 失败处理 */
  failureAction: FailureAction;
  /** 背包满处理 */
  bagFullAction: BagFullAction;
  /** 兵力不足处理 */
  lowTroopAction: LowTroopAction;
}

/** 自动远征默认配置 */
export const DEFAULT_AUTO_CONFIG: AutoExpeditionConfig = {
  repeatCount: 0, // 无限
  failureAction: 'pause',
  bagFullAction: 'pause',
  lowTroopAction: 'pause',
};

/** 暂停原因 */
export enum PauseReason {
  /** 兵力耗尽 */
  TROOPS_EXHAUSTED = 'TROOPS_EXHAUSTED',
  /** 背包已满 */
  BAG_FULL = 'BAG_FULL',
  /** 连续失败2次 */
  CONSECUTIVE_FAILURES = 'CONSECUTIVE_FAILURES',
  /** 手动暂停 */
  MANUAL = 'MANUAL',
  /** 完成设定次数 */
  COMPLETED = 'COMPLETED',
}

// ─────────────────────────────────────────────
// 6. 离线远征
// ─────────────────────────────────────────────

/** 离线远征配置 */
export const OFFLINE_EXPEDITION_CONFIG = {
  /** 离线战斗效率系数 */
  battleEfficiency: 0.85,
  /** 离线时间上限（小时） */
  maxOfflineHours: 72,
  /** 离线胜率修正 */
  winRateModifier: 0.85,
} as const;

/** 离线远征结果 */
export interface OfflineExpeditionResult {
  /** 离线时长（秒） */
  offlineSeconds: number;
  /** 完成的路线次数 */
  completedRuns: number;
  /** 总收益 */
  totalReward: ExpeditionReward;
  /** 综合效率 */
  efficiency: number;
  /** 是否达到时间上限 */
  isTimeCapped: boolean;
}

// ─────────────────────────────────────────────
// 7. 队列槽位
// ─────────────────────────────────────────────

/** 主城等级对应的远征队伍上限 */
export const CASTLE_LEVEL_SLOTS: Record<number, number> = {
  5: 1,
  10: 2,
  15: 3,
  20: 4,
};

/** 兵力消耗配置 */
export const TROOP_COST = {
  /** 远征出发每武将消耗 */
  expeditionPerHero: 20,
  /** 扫荡每武将消耗 */
  sweepPerHero: 10,
  /** 自然恢复：每5分钟恢复1点 */
  recoveryIntervalSeconds: 300,
  recoveryAmount: 1,
} as const;

/** 阵营羁绊阈值 */
export const FACTION_BOND_THRESHOLD = 3;
/** 阵营羁绊加成 */
export const FACTION_BOND_BONUS = 0.10;

/** 远征队伍武将上限 */
export const MAX_HEROES_PER_TEAM = 5;

// ─────────────────────────────────────────────
// 7.5 快速派遣配置
// ─────────────────────────────────────────────

/** 上次派遣配置（用于快速重派） */
export interface ExpeditionLastDispatchConfig {
  /** 队伍ID */
  teamId: string;
  /** 路线ID */
  routeId: string;
  /** 武将ID列表 */
  heroIds: string[];
  /** 阵型 */
  formation: FormationType;
  /** 派遣时间戳 */
  timestamp: number;
}

// ─────────────────────────────────────────────
// 8. 远征系统状态
// ─────────────────────────────────────────────

/** 远征系统运行时状态 */
export interface ExpeditionState {
  /** 所有路线数据 */
  routes: Record<string, ExpeditionRoute>;
  /** 所有区域数据 */
  regions: Record<string, ExpeditionRegion>;
  /** 所有远征队伍 */
  teams: Record<string, ExpeditionTeam>;
  /** 已解锁的队伍槽位数 */
  unlockedSlots: number;
  /** 已通关路线ID集合 */
  clearedRouteIds: Set<string>;
  /** 各路线三星记录 */
  routeStars: Record<string, number>;
  /** 各路线扫荡次数（今日） */
  sweepCounts: Record<string, Record<SweepType, number>>;
  /** 里程碑达成记录 */
  achievedMilestones: Set<MilestoneType>;
  /** 自动远征配置 */
  autoConfig: AutoExpeditionConfig;
  /** 连续失败次数 */
  consecutiveFailures: number;
  /** 是否自动远征中 */
  isAutoExpeditioning: boolean;
  /** 上次派遣配置（用于快速重派） */
  lastDispatchConfig: ExpeditionLastDispatchConfig | null;
}

/** 远征系统存档数据（可序列化） */
export interface ExpeditionSaveData {
  version: number;
  clearedRouteIds: string[];
  routeStars: Record<string, number>;
  sweepCounts: Record<string, Record<string, number>>;
  achievedMilestones: string[];
  teams: Record<string, {
    id: string;
    name: string;
    heroIds: string[];
    formation: FormationType;
    troopCount: number;
    maxTroops: number;
    totalPower: number;
    currentRouteId: string | null;
    currentNodeId: string | null;
    isExpeditioning: boolean;
  }>;
  autoConfig: AutoExpeditionConfig;
  /** 已解锁的队伍槽位数 */
  unlockedSlots: number;
  /** 连续失败次数 */
  consecutiveFailures: number;
  /** 是否自动远征中 */
  isAutoExpeditioning: boolean;
  /** 路线节点状态（路线ID → 节点ID → 状态字符串） */
  routeNodeStatuses?: Record<string, Record<string, string>>;
  /** 上次派遣配置 */
  lastDispatchConfig?: ExpeditionLastDispatchConfig | null;
}
