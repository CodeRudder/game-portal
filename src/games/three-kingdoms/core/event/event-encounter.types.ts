/**
 * 核心层 — v15.0 基础事件类型
 *
 * 包含：遭遇事件、剧情事件、NPC事件、天灾人祸、限时机遇、
 *       触发条件引擎、概率公式、通知优先级、事件冷却、选项系统、连锁事件
 *
 * @module core/event/event-encounter.types
 */

import type { EventId, EventConsequence } from './event.types';

// ─────────────────────────────────────────────
// 1. 随机遭遇事件池（#1）— 4子类型 + 20+模板
// ─────────────────────────────────────────────

/** 随机遭遇子类型 */
export type EncounterSubType =
  | 'combat'      // 战斗遭遇 — 匪寇、猛兽、敌军
  | 'diplomatic'  // 外交遭遇 — 使者、商人、流民
  | 'exploration' // 探索遭遇 — 遗迹、宝藏、密道
  | 'disaster';   // 天灾人祸 — 旱灾、洪水、瘟疫

/** 遭遇难度 */
export type EncounterDifficulty = 'easy' | 'normal' | 'hard' | 'epic';

/** 遭遇环境 */
export type EncounterEnvironment = 'plains' | 'mountain' | 'forest' | 'river' | 'city' | 'desert';

/** 遭遇模板 */
export interface EncounterTemplate {
  /** 模板ID */
  id: string;
  /** 遭遇子类型 */
  subType: EncounterSubType;
  /** 遭遇名称 */
  name: string;
  /** 遭遇描述模板（支持{player}等占位符） */
  descriptionTemplate: string;
  /** 难度 */
  difficulty: EncounterDifficulty;
  /** 适用环境 */
  environments: EncounterEnvironment[];
  /** 基础触发权重 */
  baseWeight: number;
  /** 选项列表（2-3个分支） */
  options: EncounterTemplateOption[];
  /** 冷却回合数 */
  cooldownTurns: number;
}

/** 遭遇模板选项 */
export interface EncounterTemplateOption {
  /** 选项ID */
  id: string;
  /** 选项文本 */
  text: string;
  /** 后果 */
  consequences: EventConsequence;
  /** AI选择权重（自动选择用） */
  aiWeight: number;
}

// ─────────────────────────────────────────────
// 2. 剧情事件（#2）
// ─────────────────────────────────────────────

/** 剧情事件定义 */
export interface StoryEventDef {
  /** 事件ID */
  id: EventId;
  /** 剧情章节 */
  chapter: string;
  /** 剧情标题 */
  title: string;
  /** 剧情描述 */
  description: string;
  /** 触发回合范围 */
  turnRange: { min: number; max: number };
  /** 选项列表 */
  options: StoryEventOption[];
}

/** 剧情事件选项 */
export interface StoryEventOption {
  id: string;
  text: string;
  consequences: EventConsequence;
  /** 是否推进到下一章 */
  advancesChapter?: boolean;
}

// ─────────────────────────────────────────────
// 3. NPC事件（#3）
// ─────────────────────────────────────────────

/** NPC事件定义 */
export interface NpcEventDef {
  /** 事件ID */
  id: EventId;
  /** NPC ID */
  npcId: string;
  /** NPC名称 */
  npcName: string;
  /** 事件标题 */
  title: string;
  /** 事件描述 */
  description: string;
  /** 所需好感度最低值 */
  minAffinity: number;
  /** 选项列表 */
  options: NpcEventOption[];
}

/** NPC事件选项 */
export interface NpcEventOption {
  id: string;
  text: string;
  consequences: EventConsequence;
  /** 好感度变化 */
  affinityChange: number;
}

// ─────────────────────────────────────────────
// 4. 天灾人祸（#4）
// ─────────────────────────────────────────────

/** 灾害类型 */
export type DisasterType = 'drought' | 'flood' | 'plague' | 'locust' | 'earthquake' | 'fire';

/** 天灾人祸定义 */
export interface DisasterEventDef {
  /** 事件ID */
  id: EventId;
  /** 灾害类型 */
  disasterType: DisasterType;
  /** 灾害名称 */
  name: string;
  /** 灾害描述 */
  description: string;
  /** 基础触发概率 */
  baseProbability: number;
  /** 影响资源类型 */
  affectedResources: string[];
  /** 损失百分比 */
  lossPercent: number;
  /** 持续回合数 */
  durationTurns: number;
  /** 选项列表 */
  options: DisasterEventOption[];
}

/** 灾害事件选项 */
export interface DisasterEventOption {
  id: string;
  text: string;
  consequences: EventConsequence;
  /** 减免损失百分比 */
  mitigationPercent: number;
}

// ─────────────────────────────────────────────
// 5. 限时机遇（#5）
// ─────────────────────────────────────────────

/** 限时机遇定义 */
export interface TimedOpportunityDef {
  /** 机遇ID */
  id: EventId;
  /** 机遇名称 */
  name: string;
  /** 机遇描述 */
  description: string;
  /** 持续回合数 */
  durationTurns: number;
  /** 触发概率 */
  probability: number;
  /** 奖励 */
  rewards: Record<string, number>;
  /** 选项列表 */
  options: TimedOpportunityOption[];
}

/** 限时机遇选项 */
export interface TimedOpportunityOption {
  id: string;
  text: string;
  /** 奖励倍率 */
  rewardMultiplier: number;
  consequences: EventConsequence;
}

// ─────────────────────────────────────────────
// 6. 触发条件引擎（#6）— 时间+条件+概率
// ─────────────────────────────────────────────

/** 触发条件组合 */
export interface TriggerConditionGroup {
  /** 条件组ID */
  id: string;
  /** 关联事件ID */
  eventId: EventId;
  /** 时间条件 */
  timeCondition?: TimeCondition;
  /** 游戏状态条件列表 */
  stateConditions: StateCondition[];
  /** 概率条件 */
  probabilityCondition: ProbabilityCondition;
  /** 逻辑关系（AND/OR） */
  logicOperator: 'AND' | 'OR';
}

/** 时间条件 */
export interface TimeCondition {
  /** 最小回合 */
  minTurn?: number;
  /** 最大回合 */
  maxTurn?: number;
  /** 特定回合（如每10回合） */
  turnInterval?: number;
  /** 游戏内时间范围 */
  gameTimeRange?: { startHour: number; endHour: number };
}

/** 游戏状态条件 */
export interface StateCondition {
  /** 条件类型 */
  type: 'resource' | 'building_level' | 'troop_count' | 'affinity' | 'event_completed' | 'turn_number';
  /** 资源/属性名 */
  target: string;
  /** 比较操作符 */
  operator: '>=' | '<=' | '==' | '!=' | '>' | '<';
  /** 比较值 */
  value: number;
}

/** 概率条件 */
export interface ProbabilityCondition {
  /** 基础概率 */
  baseProbability: number;
  /** 概率修正因子列表 */
  modifiers: ProbabilityModifier[];
}

/** 概率修正因子 */
export interface ProbabilityModifier {
  /** 修正因子名称 */
  name: string;
  /** 修正值（加到概率上） */
  additiveBonus: number;
  /** 修正倍率（乘到概率上） */
  multiplicativeBonus: number;
  /** 是否生效（由外部条件决定） */
  active: boolean;
}

// ─────────────────────────────────────────────
// 7. 概率触发公式（#7）
// ─────────────────────────────────────────────

/** 概率计算结果 */
export interface ProbabilityResult {
  /** 最终概率 */
  finalProbability: number;
  /** 基础概率 */
  baseProbability: number;
  /** 加法修正总和 */
  additiveTotal: number;
  /** 乘法修正总和 */
  multiplicativeTotal: number;
  /** 是否触发 */
  triggered: boolean;
}

// ─────────────────────────────────────────────
// 8. 通知优先级（6级）（#8）
// ─────────────────────────────────────────────

/** 通知优先级（6级） */
export enum NotificationPriority {
  /** P0 — 系统级：服务器维护、强制更新 */
  SYSTEM = 0,
  /** P1 — 紧急：天灾、敌袭、联盟战 */
  URGENT = 1,
  /** P2 — 高：限时活动即将结束、连锁事件下一步 */
  HIGH = 2,
  /** P3 — 中：随机遭遇、NPC事件 */
  MEDIUM = 3,
  /** P4 — 低：日常任务完成、资源产出 */
  LOW = 4,
  /** P5 — 信息：系统提示、帮助信息 */
  INFO = 5,
}

/** 通知数据 */
export interface EventNotification {
  /** 通知ID */
  id: string;
  /** 关联事件ID */
  eventId: EventId;
  /** 通知标题 */
  title: string;
  /** 通知内容 */
  content: string;
  /** 优先级 */
  priority: NotificationPriority;
  /** 创建时间 */
  createdAt: number;
  /** 过期时间（null=不过期） */
  expireAt: number | null;
  /** 是否已读 */
  read: boolean;
}

// ─────────────────────────────────────────────
// 9. 事件冷却（#9）
// ─────────────────────────────────────────────

/** 冷却记录 */
export interface CooldownRecord {
  /** 事件ID */
  eventId: EventId;
  /** 冷却开始回合 */
  startTurn: number;
  /** 冷却结束回合 */
  endTurn: number;
  /** 冷却中剩余回合 */
  remainingTurns: number;
}

// ─────────────────────────────────────────────
// 10. 事件选项系统（#10）— 2-3分支
// ─────────────────────────────────────────────

/** 分支选项（含条件可见性） */
export interface BranchOption {
  /** 选项ID */
  id: string;
  /** 选项文本 */
  text: string;
  /** 选项描述 */
  description?: string;
  /** 是否可用 */
  available: boolean;
  /** 不可用原因 */
  unavailableReason?: string;
  /** 后果 */
  consequences: EventConsequence;
  /** 显示条件 */
  visibilityConditions?: StateCondition[];
}

// ─────────────────────────────────────────────
// 11-12. 连锁事件引擎（#11 #12）
// ─────────────────────────────────────────────

/** 连锁事件分支追踪 */
export interface ChainBranch {
  /** 分支ID */
  id: string;
  /** 链ID */
  chainId: string;
  /** 分支路径（选项ID序列） */
  path: string[];
  /** 分支状态 */
  status: 'active' | 'completed' | 'abandoned';
}

/** 连锁事件快照 */
export interface ChainSnapshot {
  /** 链ID */
  chainId: string;
  /** 当前分支 */
  currentBranch: ChainBranch | null;
  /** 所有历史分支 */
  branches: ChainBranch[];
  /** 当前深度 */
  currentDepth: number;
  /** 最大深度 */
  maxDepth: number;
  /** 完成百分比 */
  completionPercent: number;
}
