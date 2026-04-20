/**
 * 核心层 — v15.0 事件深化类型定义
 *
 * 新增类型：
 *   - 随机遭遇事件池（4子类型 + 模板）
 *   - 触发条件引擎（时间+条件+概率）
 *   - 通知优先级（6级）
 *   - 事件冷却
 *   - 离线事件堆积
 *   - 代币兑换商店
 *   - 活动排行榜
 *   - 限时活动完整流程
 *   - 节日活动框架
 *
 * @module core/event/event-v15.types
 */

import type { EventId, EventDef, EventConsequence } from './event.types';

// 重新导出 EventConsequence，供引擎层直接从本模块引用
export type { EventConsequence } from './event.types';

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

// ─────────────────────────────────────────────
// 13. 离线事件堆积处理（#13）
// ─────────────────────────────────────────────

/** 离线事件堆积记录 */
export interface OfflineEventPile {
  /** 堆积ID */
  id: string;
  /** 离线开始时间 */
  offlineStart: number;
  /** 离线结束时间 */
  offlineEnd: number;
  /** 离线回合数 */
  offlineTurns: number;
  /** 堆积的事件列表 */
  events: OfflineEventEntry[];
  /** 是否已处理 */
  processed: boolean;
}

/** 自动处理结果 */
export interface AutoResolveResult {
  /** 选择的选项ID */
  chosenOptionId: string;
  /** 选择原因 */
  reason: 'default' | 'highest_weight' | 'time_expired';
  /** 后果 */
  consequences: EventConsequence;
}

// ─────────────────────────────────────────────
// 14. 代币兑换商店（#14）
// ─────────────────────────────────────────────

/** 商品稀有度（七阶体系） */
export type ShopItemRarity =
  | 'common'     // 普通 — 铜钱、粮草
  | 'uncommon'   // 优秀 — 加速道具、招募令
  | 'rare'       // 稀有 — 装备箱、技能书
  | 'epic'       // 史诗 — 武将碎片、高级装备
  | 'legendary'  // 传说 — 专属武器、坐骑
  | 'mythic'     // 神话 — 限定武将、神器
  | 'supreme';   // 至尊 — 全服唯一、赛季限定

/** 代币商店商品定义 */
export interface TokenShopItem {
  /** 商品ID */
  id: string;
  /** 商品名称 */
  name: string;
  /** 商品描述 */
  description: string;
  /** 稀有度 */
  rarity: ShopItemRarity;
  /** 代币价格 */
  tokenPrice: number;
  /** 限购数量（0=不限） */
  purchaseLimit: number;
  /** 已购数量 */
  purchased: number;
  /** 奖励 */
  rewards: Record<string, number>;
  /** 活动ID（空=通用商品） */
  activityId: string;
  /** 是否上架 */
  available: boolean;
}

/** 代币商店配置 */
export interface TokenShopConfig {
  /** 代币类型名称 */
  tokenName: string;
  /** 每日刷新 */
  dailyRefresh: boolean;
  /** 最大商品数量 */
  maxItems: number;
}

// ─────────────────────────────────────────────
// 15. 活动排行榜（#15）
// ─────────────────────────────────────────────

/** 排行榜条目 */
export interface ActivityRankEntry {
  /** 排名 */
  rank: number;
  /** 玩家ID */
  playerId: string;
  /** 玩家名称 */
  playerName: string;
  /** 积分 */
  points: number;
  /** 代币 */
  tokens: number;
  /** 头像 */
  avatar: string;
}

/** 排行榜配置 */
export interface ActivityLeaderboardConfig {
  /** 活动ID */
  activityId: string;
  /** 最大显示人数 */
  maxEntries: number;
  /** 奖励梯度（排名→奖励） */
  rewardTiers: LeaderboardRewardTier[];
}

/** 排行奖励梯度 */
export interface LeaderboardRewardTier {
  /** 最低排名 */
  minRank: number;
  /** 最高排名 */
  maxRank: number;
  /** 奖励 */
  rewards: Record<string, number>;
}

// ─────────────────────────────────────────────
// 16. 限时活动完整流程（#16）
// ─────────────────────────────────────────────

/** 限时活动阶段 */
export type TimedActivityPhase = 'preview' | 'active' | 'settlement' | 'closed';

/** 限时活动流程状态 */
export interface TimedActivityFlow {
  /** 活动ID */
  activityId: string;
  /** 当前阶段 */
  phase: TimedActivityPhase;
  /** 预览开始时间 */
  previewStart: number;
  /** 活动开始时间 */
  activeStart: number;
  /** 活动结束时间 */
  activeEnd: number;
  /** 结算开始时间 */
  settlementStart: number;
  /** 关闭时间 */
  closedTime: number;
}

// ─────────────────────────────────────────────
// 17. 节日活动框架（#17）
// ─────────────────────────────────────────────

/** 节日类型 */
export type FestivalType = 'spring' | 'lantern' | 'dragon_boat' | 'mid_autumn' | 'double_ninth' | 'custom';

/** 节日活动定义 */
export interface FestivalActivityDef {
  /** 节日ID */
  id: string;
  /** 节日类型 */
  festivalType: FestivalType;
  /** 节日名称 */
  name: string;
  /** 节日描述 */
  description: string;
  /** 特殊主题色 */
  themeColor: string;
  /** 专属商品列表 */
  exclusiveItems: TokenShopItem[];
  /** 专属任务 */
  exclusiveTasks: Array<{
    id: string;
    name: string;
    description: string;
    targetCount: number;
    rewards: Record<string, number>;
  }>;
}

// ─────────────────────────────────────────────
// 18. 活动离线进度（#18）
// ─────────────────────────────────────────────

/** 已在 activity.types.ts 中定义 OfflineActivityResult */

/** 活动离线进度汇总 */
export interface ActivityOfflineSummary {
  /** 离线时长(ms) */
  offlineDurationMs: number;
  /** 各活动进度 */
  activityResults: import('../../core/activity/activity.types').OfflineActivityResult[];
  /** 总获得积分 */
  totalPoints: number;
  /** 总获得代币 */
  totalTokens: number;
  /** 处理的事件堆积 */
  eventPile: OfflineEventPile | null;
}

// ─────────────────────────────────────────────
// 19. v15 事件系统状态扩展
// ─────────────────────────────────────────────

/** v15 事件系统状态扩展 */
export interface EventV15State {
  /** 遭遇事件冷却 */
  encounterCooldowns: Map<string, number>;
  /** 通知队列 */
  notifications: EventNotification[];
  /** 离线事件堆积 */
  offlineEventPiles: OfflineEventPile[];
  /** 代币余额 */
  tokenBalance: number;
}

/** v15 事件系统存档 */
export interface EventV15SaveData {
  version: number;
  encounterCooldowns: Record<string, number>;
  notifications: EventNotification[];
  offlineEventPiles: OfflineEventPile[];
  tokenBalance: number;
}

// ─────────────────────────────────────────────
// 20. 事件分类（5类）
// ─────────────────────────────────────────────

/** 事件分类（5类：剧情/随机/触发/连锁/世界） */
export type EventCategory = 'story' | 'random' | 'triggered' | 'chain' | 'world';

/** 事件分类元数据 */
export interface EventCategoryMeta {
  /** 分类名称 */
  label: string;
  /** 默认权重 */
  defaultWeight: number;
  /** 描述 */
  description: string;
}

/** 事件分类元数据常量 */
export const EVENT_CATEGORY_META: Record<EventCategory, EventCategoryMeta> = {
  story: { label: '剧情事件', defaultWeight: 80, description: '主线/支线剧情事件' },
  random: { label: '随机事件', defaultWeight: 50, description: '随机触发的事件' },
  triggered: { label: '触发事件', defaultWeight: 70, description: '满足条件触发的事件' },
  chain: { label: '连锁事件', defaultWeight: 60, description: '多步骤连锁事件' },
  world: { label: '世界事件', defaultWeight: 40, description: '全服世界事件' },
};

// ─────────────────────────────────────────────
// 21. 事件权重系统
// ─────────────────────────────────────────────

/** 事件权重修正 */
export interface EventWeightModifier {
  /** 修正来源标识 */
  source: string;
  /** 修正类型 */
  type: 'additive' | 'multiplicative';
  /** 修正值 */
  value: number;
}

/** 事件权重 */
export interface EventWeight {
  /** 事件定义ID */
  eventDefId: EventId;
  /** 基础权重 */
  baseWeight: number;
  /** 当前权重（含修正） */
  currentWeight: number;
  /** 权重修正列表 */
  modifiers: EventWeightModifier[];
}

// ─────────────────────────────────────────────
// 22. 事件冷却
// ─────────────────────────────────────────────

/** 事件冷却记录 */
export interface EventCooldown {
  /** 事件定义ID */
  eventDefId: EventId;
  /** 冷却开始回合 */
  startTurn: number;
  /** 冷却结束回合 */
  endTurn: number;
  /** 剩余回合 */
  remainingTurns: number;
}

// ─────────────────────────────────────────────
// 23. 扩展条件系统
// ─────────────────────────────────────────────

/** 扩展事件条件（支持嵌套子条件） */
export interface ExtendedEventCondition {
  /** 条件类型 */
  type: string;
  /** 条件参数 */
  params: Record<string, unknown>;
  /** 是否取反 */
  negate?: boolean;
  /** 子条件 */
  subConditions?: ExtendedEventCondition[];
  /** 逻辑运算符 */
  operator?: 'and' | 'or';
}

/** 条件上下文 */
export interface ConditionContext {
  /** 当前回合 */
  currentTurn: number;
  /** 资源映射 */
  resources?: Record<string, number>;
  /** 已完成事件ID集合 */
  completedEventIds?: Set<string>;
  /** 已招募武将ID集合 */
  recruitedHeroIds?: Set<string>;
  /** 领地数量 */
  territoryCount?: number;
  /** 战斗胜利次数 */
  battlesWon?: number;
  /** 活跃活动ID集合 */
  activeActivityIds?: Set<string>;
}

// ─────────────────────────────────────────────
// 24. 加权选择
// ─────────────────────────────────────────────

/** 加权选择结果 */
export interface WeightedSelectionResult {
  /** 选中事件ID */
  eventDefId: EventId;
  /** 选中权重 */
  selectedWeight: number;
  /** 总权重 */
  totalWeight: number;
  /** 候选列表 */
  candidates: Array<{ eventDefId: string; weight: number }>;
}

/** 加权事件选项 */
export interface WeightedEventOption {
  /** 选项ID */
  id: string;
  /** 选项文本 */
  text: string;
  /** 选项描述 */
  description?: string;
  /** 权重 */
  weight: number;
  /** 后果 */
  consequences: EventConsequence;
}

// ─────────────────────────────────────────────
// 25. 选项后果与选择结果
// ─────────────────────────────────────────────

/** 选项后果（与 EventConsequence 对齐） */
export interface OptionConsequence {
  /** 描述 */
  description?: string;
  /** 资源变化 */
  resourceChanges?: Record<string, number>;
  /** 好感度变化 */
  affinityChanges?: Record<string, number>;
  /** 触发后续事件ID */
  triggerEventId?: string;
  /** 解锁ID列表 */
  unlockIds?: string[];
}

/** 选项选择结果 */
export interface OptionSelectionResult {
  /** 选择的选项ID */
  optionId: string;
  /** 是否自动选择 */
  isAuto: boolean;
  /** 后果 */
  consequences: OptionConsequence;
  /** 下一个事件ID */
  nextEventId?: string;
}

// ─────────────────────────────────────────────
// 26. 活动事件绑定
// ─────────────────────────────────────────────

/** 活动事件绑定 */
export interface ActivityEventBinding {
  /** 绑定ID */
  id: string;
  /** 活动ID */
  activityId: string;
  /** 关联事件定义ID列表 */
  eventDefIds: EventId[];
  /** 绑定类型 */
  bindingType: 'exclusive' | 'shared' | 'bonus' | 'trigger';
  /** 是否启用 */
  enabled: boolean;
}

// ─────────────────────────────────────────────
// 27. 限时事件配置
// ─────────────────────────────────────────────

/** 限时事件配置 */
export interface TimedEventConfig {
  /** 事件定义ID */
  eventDefId: EventId;
  /** 开始时间 */
  startTime: number;
  /** 结束时间 */
  endTime: number;
  /** 奖励倍率 */
  rewardMultiplier: number;
  /** 是否活动专属 */
  isActivityExclusive?: boolean;
}

// ─────────────────────────────────────────────
// 28. 活动奖励联动
// ─────────────────────────────────────────────

/** 活动奖励联动 */
export interface ActivityRewardLink {
  /** 联动ID */
  id: string;
  /** 关联事件定义ID */
  eventDefId: EventId;
  /** 联动类型 */
  linkType: 'bonus_multiplier' | 'extra_reward';
  /** 联动参数 */
  params: Record<string, unknown>;
  /** 是否启用 */
  enabled: boolean;
}

// ─────────────────────────────────────────────
// 29. 事件引擎存档数据
// ─────────────────────────────────────────────

/** 事件引擎存档数据 */
export interface EventSaveDataV15 {
  /** 存档版本 */
  version: number;
  /** 事件权重列表 */
  eventWeights: Array<{
    eventDefId: EventId;
    baseWeight: number;
    currentWeight: number;
  }>;
  /** 冷却列表 */
  cooldowns: Array<{
    eventDefId: EventId;
    startTurn: number;
    endTurn: number;
  }>;
  /** 连锁事件进度 */
  chainProgresses: Array<{
    chainId: string;
    currentNodeId: string | null;
    completedNodeIds: string[];
    visitedBranches: string[];
    isCompleted: boolean;
    startedAtTurn: number;
    completedAtTurn: number | null;
    isTimedOut: boolean;
  }>;
  /** 离线事件队列 */
  offlineQueue: OfflineEventEntry[];
  /** 活动事件绑定列表 */
  activityBindings: Array<{
    id: string;
    activityId: string;
    eventDefIds: EventId[];
    bindingType: string;
    enabled: boolean;
  }>;
  /** 限时事件列表 */
  timedEvents: Array<{
    eventDefId: EventId;
    startTime: number;
    endTime: number;
    rewardMultiplier: number;
  }>;
  /** 自动处理规则 */
  autoProcessRules: AutoProcessRule[];
}

// ─────────────────────────────────────────────
// 30. 连锁事件系统 v15 类型
// ─────────────────────────────────────────────

/** 连锁事件链 ID */
export type ChainId = string;

/** 连锁事件节点 ID */
export type ChainNodeId = string;

/** 连锁事件合并点 */
export interface ChainMergePoint {
  /** 合并目标节点 ID */
  mergeNodeId: ChainNodeId;
  /** 来源节点 ID 列表 */
  sourceNodeIds: ChainNodeId[];
  /** 是否需要所有来源都完成 */
  requireAll: boolean;
}

/** 连锁事件节点定义 v15 */
export interface ChainNodeDefV15 {
  /** 节点 ID */
  id: ChainNodeId;
  /** 关联事件定义 ID */
  eventDefId: EventId;
  /** 前序节点 ID */
  parentNodeId?: ChainNodeId;
  /** 前序选项 ID */
  parentOptionId?: string;
  /** 深度 */
  depth: number;
  /** 节点描述 */
  description?: string;
  /** 是否合并节点 */
  isMergeNode?: boolean;
  /** 合并来源节点 ID 列表 */
  mergeSourceIds?: ChainNodeId[];
}

/** 连锁事件链定义 v15 */
export interface EventChainDefV15 {
  /** 链 ID */
  id: ChainId;
  /** 链名称 */
  name: string;
  /** 链描述 */
  description: string;
  /** 事件分类 */
  category: EventCategory;
  /** 最大深度 */
  maxDepth: number;
  /** 超时回合数（null=不超时） */
  timeoutTurns: number | null;
  /** 合并点列表 */
  mergePoints: ChainMergePoint[];
  /** 节点列表 */
  nodes: ChainNodeDefV15[];
}

/** 连锁事件进度 v15 */
export interface ChainProgressV15 {
  /** 链 ID */
  chainId: ChainId;
  /** 当前节点 ID */
  currentNodeId: ChainNodeId | null;
  /** 已完成节点 ID 集合 */
  completedNodeIds: Set<ChainNodeId>;
  /** 已访问分支路径 */
  visitedBranches: string[];
  /** 是否已完成 */
  isCompleted: boolean;
  /** 开始回合 */
  startedAtTurn: number;
  /** 完成回合 */
  completedAtTurn: number | null;
  /** 是否超时 */
  isTimedOut: boolean;
}

/** 连锁事件推进结果 v15 */
export interface ChainAdvanceResultV15 {
  /** 是否成功 */
  success: boolean;
  /** 前一个节点 ID */
  previousNodeId: ChainNodeId | null;
  /** 当前节点 */
  currentNode: ChainNodeDefV15 | null;
  /** 链是否已完成 */
  chainCompleted: boolean;
  /** 是否为合并推进 */
  isMerge: boolean;
  /** 是否超时 */
  isTimedOut: boolean;
  /** 失败原因 */
  reason?: string;
}

// ─────────────────────────────────────────────
// 31. 离线事件处理系统类型
// ─────────────────────────────────────────────

/** 离线事件条目（扩展版，供 OfflineEventSystem 使用） */
export interface OfflineEventEntry {
  /** 条目 ID */
  id: string;
  /** 事件 ID（兼容 OfflineEventHandler） */
  eventId: EventId;
  /** 事件定义 ID */
  eventDefId: EventId;
  /** 事件标题 */
  title: string;
  /** 事件描述 */
  description: string;
  /** 紧急程度 */
  urgency: 'critical' | 'high' | 'medium' | 'low';
  /** 事件分类 */
  category: EventCategory;
  /** 触发时间（回合） */
  triggeredAt: number;
  /** 触发回合 */
  triggerTurn: number;
  /** 事件定义 */
  eventDef: EventDef;
  /** 自动处理结果（null=需玩家处理） */
  autoResult: AutoResolveResult | null;
  /** 是否已自动处理 */
  autoProcessed: boolean;
  /** 自动处理规则 ID */
  autoRuleId?: string;
  /** 自动选择的选项 ID */
  autoSelectedOptionId?: string;
  /** 是否需要手动操作 */
  requiresManualAction: boolean;
}

/** 自动处理策略 */
export type AutoSelectStrategy =
  | 'default_option'
  | 'best_outcome'
  | 'safest'
  | 'weighted_random'
  | 'skip';

/** 自动处理规则 */
export interface AutoProcessRule {
  /** 规则 ID */
  id: string;
  /** 规则名称 */
  name: string;
  /** 规则描述 */
  description: string;
  /** 是否启用 */
  enabled: boolean;
  /** 优先级（越高越先匹配） */
  priority: number;
  /** 紧急程度阈值（高于此值不自动处理） */
  urgencyThreshold: 'critical' | 'high' | 'medium' | 'low';
  /** 适用的分类列表（空=全部分类） */
  applicableCategories: EventCategory[];
  /** 适用的事件 ID 列表（空=全部事件） */
  applicableEventIds: EventId[];
  /** 选择策略 */
  strategy: AutoSelectStrategy;
}

/** 离线事件处理结果 */
export interface OfflineEventProcessResult {
  /** 自动处理数量 */
  autoProcessedCount: number;
  /** 需手动处理数量 */
  manualRequiredCount: number;
  /** 已处理条目列表 */
  processedEntries: Array<{
    entryId: string;
    eventDefId: EventId;
    selectedOptionId: string;
    consequences: OptionConsequence;
  }>;
  /** 待处理条目列表 */
  pendingEntries: OfflineEventEntry[];
  /** 事件回溯数据 */
  retrospectiveData: EventRetrospectiveData;
}

/** 事件回溯数据 */
export interface EventRetrospectiveData {
  /** 离线事件列表 */
  offlineEvents: OfflineEventEntry[];
  /** 资源变化汇总 */
  totalResourceChanges: Record<string, number>;
  /** 时间线 */
  timeline: Array<{
    timestamp: number;
    eventTitle: string;
    action: string;
    result: string;
  }>;
}
