/**
 * 远征系统 — 类型定义
 *
 * v12.0 远征天下模块的全部类型
 * 规则：只有 interface/type/enum/const，零运行时逻辑
 *
 * @module core/expedition/expedition.types
 */

import type { Faction } from '../../engine/hero/hero.types';

// ─────────────────────────────────────────────
// 1. 路线与节点
// ─────────────────────────────────────────────

/** 路线难度等级 */
export enum RouteDifficulty {
  /** 简单 ⭐~⭐⭐ */
  EASY = 'EASY',
  /** 普通 ⭐⭐⭐ */
  NORMAL = 'NORMAL',
  /** 困难 ⭐⭐⭐⭐ */
  HARD = 'HARD',
  /** 奇袭 ⭐⭐⭐⭐⭐ */
  AMBUSH = 'AMBUSH',
}

/** 难度标签映射 */
export const DIFFICULTY_LABELS: Record<RouteDifficulty, string> = {
  [RouteDifficulty.EASY]: '简单',
  [RouteDifficulty.NORMAL]: '普通',
  [RouteDifficulty.HARD]: '困难',
  [RouteDifficulty.AMBUSH]: '奇袭',
};

/** 难度星级数 */
export const DIFFICULTY_STARS: Record<RouteDifficulty, number> = {
  [RouteDifficulty.EASY]: 1,
  [RouteDifficulty.NORMAL]: 3,
  [RouteDifficulty.HARD]: 4,
  [RouteDifficulty.AMBUSH]: 5,
};

/** 节点类型 */
export enum NodeType {
  /** 山贼 — 低难度普通战斗 */
  BANDIT = 'BANDIT',
  /** 天险 — 中等难度地形挑战 */
  HAZARD = 'HAZARD',
  /** Boss — 高难度精英战斗 */
  BOSS = 'BOSS',
  /** 宝箱 — 直接获取奖励 */
  TREASURE = 'TREASURE',
  /** 休息点 — 恢复部分兵力 */
  REST = 'REST',
}

/** 节点状态 */
export enum NodeStatus {
  /** 已通关 */
  CLEARED = 'CLEARED',
  /** 行军中 */
  MARCHING = 'MARCHING',
  /** 未解锁 */
  LOCKED = 'LOCKED',
}

/** 节点数据 */
export interface ExpeditionNode {
  /** 节点唯一ID */
  id: string;
  /** 节点类型 */
  type: NodeType;
  /** 节点名称 */
  name: string;
  /** 节点状态 */
  status: NodeStatus;
  /** 后继节点ID列表（树状分支） */
  nextNodeIds: string[];
  /** 推荐战力 */
  recommendedPower: number;
  /** 敌方队伍配置ID（战斗节点使用） */
  enemyTeamId?: string;
  /** 休息恢复兵力百分比（仅REST类型） */
  healPercent?: number;
  /** 宝箱奖励ID（仅TREASURE类型） */
  rewardId?: string;
}

/** 路线数据 */
export interface ExpeditionRoute {
  /** 路线唯一ID */
  id: string;
  /** 路线名称 */
  name: string;
  /** 所属区域ID */
  regionId: string;
  /** 路线难度 */
  difficulty: RouteDifficulty;
  /** 起始节点ID */
  startNodeId: string;
  /** 终点节点ID */
  endNodeId: string;
  /** 所有节点 */
  nodes: Record<string, ExpeditionNode>;
  /** 推荐战力倍率 */
  powerMultiplier: number;
  /** 行军时长（秒） */
  marchDurationSeconds: number;
  /** 是否已解锁 */
  unlocked: boolean;
  /** 解锁条件：前置区域ID */
  requiredRegionId?: string;
  /** 解锁条件：需通关困难路线（奇袭路线） */
  requireHardClear?: boolean;
}

/** 区域数据 */
export interface ExpeditionRegion {
  /** 区域ID */
  id: string;
  /** 区域名称 */
  name: string;
  /** 区域顺序（解锁顺序） */
  order: number;
  /** 包含的路线ID列表 */
  routeIds: string[];
}

// ─────────────────────────────────────────────
// 2. 队伍与阵型
// ─────────────────────────────────────────────

/** 阵型类型 */
export enum FormationType {
  /** 鱼鳞 — 防御+15%，攻击-5% */
  FISH_SCALE = 'FISH_SCALE',
  /** 鹤翼 — 攻击+15%，防御-5% */
  CRANE_WING = 'CRANE_WING',
  /** 锋矢 — 速度+20%，防御-10% */
  WEDGE = 'WEDGE',
  /** 雁行 — 谋略+15%，速度+5% */
  GOOSE = 'GOOSE',
  /** 长蛇 — 攻击+10%，速度+10%，防御-15% */
  SNAKE = 'SNAKE',
  /** 方圆 — 防御+20%，速度-10% */
  SQUARE = 'SQUARE',
}

/** 阵型中文名映射 */
export const FORMATION_LABELS: Record<FormationType, string> = {
  [FormationType.FISH_SCALE]: '鱼鳞',
  [FormationType.CRANE_WING]: '鹤翼',
  [FormationType.WEDGE]: '锋矢',
  [FormationType.GOOSE]: '雁行',
  [FormationType.SNAKE]: '长蛇',
  [FormationType.SQUARE]: '方圆',
};

/** 阵型效果（属性修正百分比） */
export interface FormationEffect {
  /** 攻击修正（正=增益，负=减益） */
  attackMod: number;
  /** 防御修正 */
  defenseMod: number;
  /** 速度修正 */
  speedMod: number;
  /** 智力修正 */
  intelligenceMod: number;
}

/** 阵型效果配置 */
export const FORMATION_EFFECTS: Record<FormationType, FormationEffect> = {
  [FormationType.FISH_SCALE]: { attackMod: -0.05, defenseMod: 0.15, speedMod: 0, intelligenceMod: 0 },
  [FormationType.CRANE_WING]: { attackMod: 0.15, defenseMod: -0.05, speedMod: 0, intelligenceMod: 0 },
  [FormationType.WEDGE]: { attackMod: 0, defenseMod: -0.10, speedMod: 0.20, intelligenceMod: 0 },
  [FormationType.GOOSE]: { attackMod: 0, defenseMod: 0, speedMod: 0.05, intelligenceMod: 0.15 },
  [FormationType.SNAKE]: { attackMod: 0.10, defenseMod: -0.15, speedMod: 0.10, intelligenceMod: 0 },
  [FormationType.SQUARE]: { attackMod: 0, defenseMod: 0.20, speedMod: -0.10, intelligenceMod: 0 },
};

/** 阵型克制关系：克制方全属性+10% */
export const FORMATION_COUNTERS: Record<FormationType, FormationType> = {
  [FormationType.FISH_SCALE]: FormationType.WEDGE,     // 鱼鳞 > 锋矢
  [FormationType.CRANE_WING]: FormationType.FISH_SCALE, // 鹤翼 > 鱼鳞
  [FormationType.WEDGE]: FormationType.GOOSE,           // 锋矢 > 雁行
  [FormationType.GOOSE]: FormationType.CRANE_WING,      // 雁行 > 鹤翼
  [FormationType.SNAKE]: FormationType.SQUARE,          // 长蛇 > 方圆
  [FormationType.SQUARE]: FormationType.SNAKE,          // 方圆 > 长蛇（互克）
};

/** 远征队伍数据 */
export interface ExpeditionTeam {
  /** 队伍ID */
  id: string;
  /** 队伍名称 */
  name: string;
  /** 武将ID列表（最多5名） */
  heroIds: string[];
  /** 阵型 */
  formation: FormationType;
  /** 当前兵力 */
  troopCount: number;
  /** 最大兵力 */
  maxTroops: number;
  /** 队伍总战力 */
  totalPower: number;
  /** 当前所在路线ID */
  currentRouteId: string | null;
  /** 当前所在节点ID */
  currentNodeId: string | null;
  /** 是否正在远征 */
  isExpeditioning: boolean;
}

// ─────────────────────────────────────────────
// 3. 战斗结果
// ─────────────────────────────────────────────

/** 远征战斗评级 */
export enum BattleGrade {
  /** 大捷 ⭐⭐⭐ — 剩余血量>50%且无武将阵亡 */
  GREAT_VICTORY = 'GREAT_VICTORY',
  /** 小胜 ⭐⭐ — 剩余血量10%~50%或有武将阵亡 */
  MINOR_VICTORY = 'MINOR_VICTORY',
  /** 惨胜 ⭐ — 剩余血量<10% */
  PYRRHIC_VICTORY = 'PYRRHIC_VICTORY',
  /** 惜败 — 战斗失败 */
  NARROW_DEFEAT = 'NARROW_DEFEAT',
}

/** 评级星级映射 */
export const GRADE_STARS: Record<BattleGrade, number> = {
  [BattleGrade.GREAT_VICTORY]: 3,
  [BattleGrade.MINOR_VICTORY]: 2,
  [BattleGrade.PYRRHIC_VICTORY]: 1,
  [BattleGrade.NARROW_DEFEAT]: 0,
};

/** 评级标签映射 */
export const GRADE_LABELS: Record<BattleGrade, string> = {
  [BattleGrade.GREAT_VICTORY]: '大捷',
  [BattleGrade.MINOR_VICTORY]: '小胜',
  [BattleGrade.PYRRHIC_VICTORY]: '惨胜',
  [BattleGrade.NARROW_DEFEAT]: '惜败',
};

/** 远征战斗结果 */
export interface ExpeditionBattleResult {
  /** 战斗评级 */
  grade: BattleGrade;
  /** 星级 */
  stars: number;
  /** 总回合数 */
  totalTurns: number;
  /** 我方剩余血量百分比 */
  allyHpPercent: number;
  /** 我方阵亡数 */
  allyDeaths: number;
  /** 获得的经验值 */
  expGained: number;
}

// ─────────────────────────────────────────────
// 4. 奖励
// ─────────────────────────────────────────────

/** 远征奖励 */
export interface ExpeditionReward {
  /** 粮草 */
  grain: number;
  /** 铜钱 */
  gold: number;
  /** 铁矿 */
  iron: number;
  /** 装备碎片数 */
  equipFragments: number;
  /** 经验值 */
  exp: number;
  /** 掉落物品列表 */
  drops: DropItem[];
}

/** 掉落物品 */
export interface DropItem {
  /** 物品类型 */
  type: 'equip_fragment' | 'hero_fragment' | 'skill_book' | 'rare_material' | 'legendary_equip';
  /** 物品ID */
  id: string;
  /** 物品名称 */
  name: string;
  /** 数量 */
  count: number;
}

/** 扫荡类型 */
export enum SweepType {
  /** 普通扫荡 — 扫荡令×1，奖励×100% */
  NORMAL = 'NORMAL',
  /** 高级扫荡 — 扫荡令×3，奖励×150%+保底稀有 */
  ADVANCED = 'ADVANCED',
  /** 免费扫荡 — 无消耗，奖励×50% */
  FREE = 'FREE',
}

/** 扫荡配置 */
export const SWEEP_CONFIG: Record<SweepType, {
  cost: number;
  rewardMultiplier: number;
  dailyLimit: number;
  guaranteedRare: boolean;
}> = {
  [SweepType.NORMAL]: { cost: 1, rewardMultiplier: 1.0, dailyLimit: 5, guaranteedRare: false },
  [SweepType.ADVANCED]: { cost: 3, rewardMultiplier: 1.5, dailyLimit: 3, guaranteedRare: true },
  [SweepType.FREE]: { cost: 0, rewardMultiplier: 0.5, dailyLimit: 1, guaranteedRare: false },
};

/** 里程碑类型 */
export enum MilestoneType {
  /** 初出茅庐 — 通关第1条路线 */
  FIRST_CLEAR = 'FIRST_CLEAR',
  /** 百战之师 — 通关10条路线 */
  TEN_CLEARS = 'TEN_CLEARS',
  /** 远征名将 — 通关30条路线 */
  THIRTY_CLEARS = 'THIRTY_CLEARS',
  /** 天下布武 — 通关全部路线 */
  ALL_CLEARS = 'ALL_CLEARS',
}

/** 里程碑配置 */
export interface MilestoneConfig {
  type: MilestoneType;
  name: string;
  requiredClears: number;
  reward: ExpeditionReward;
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
}
