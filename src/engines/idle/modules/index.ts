/**
 * P0/P1 子系统模块 — 统一导出
 *
 * 汇总导出放置游戏引擎的 7 个核心模块及其类型定义。
 *
 * 模块清单：
 * - CanvasUIRenderer  Canvas UI 渲染工具
 * - BuildingSystem    建筑系统核心（P0）
 * - PrestigeSystem    声望系统核心（P0）
 * - UnlockChecker     解锁检查器（P0）
 * - InputHandler      输入处理器（P0）
 * - UnitSystem        角色招募 + 进化系统（P1）
 * - StageSystem       阶段演进系统（P1）
 * - ParticleSystem    通用粒子子系统（P1）
 * - FloatingTextSystem 飘字效果子系统（P1）
 * - StatisticsTracker  统计追踪子系统（P1）
 * - BattleSystem      战斗波次系统（P2）
 * - SeasonSystem      季节循环系统（P2）
 * - CraftingSystem    炼制/合成系统（P2）
 * - ExpeditionSystem  远征系统（P2）
 * - TechTreeSystem    科技树系统（P2）
 * - TerritorySystem   领土征服系统（P2）
 * - QuestSystem       任务系统（P3）
 * - StorySystem       剧情系统（P3）
 * - EventSystem       活动系统（P3）
 * - RewardSystem      奖励系统（P3）
 * - InteractionSystem 互动系统（P3）
 * - MiniGameSystem    小游戏系统（P3）
 * - DecorationSystem  装饰系统（P3）
 * - OfflineRewardCalculator 离线收益计算器（特性层）
 * - SpeedManager      加速管理器（特性层）
 * - AutoPlayController 自动操作控制器（特性层）
 * - BatchOperationHandler 批量操作处理器（特性层）
 *
 * @module engines/idle/modules
 */

// CanvasUIRenderer — Canvas UI 渲染工具类
export { CanvasUIRenderer } from './CanvasUIRenderer';
export type {
  ResourceDisplayItem,
  BuildingDisplayItem,
  FloatingText,
  BadgeOptions,
  ResourcePanelConfig,
  BuildingListConfig,
  UIColorScheme,
} from './CanvasUIRenderer';

// BuildingSystem — 建筑系统核心模块
export { BuildingSystem } from './BuildingSystem';
export type {
  BuildingDef,
  BuildingState,
  BuildingEvent,
  BuildingSystemConfig,
} from './BuildingSystem';

// PrestigeSystem — 声望系统核心模块
export { PrestigeSystem } from './PrestigeSystem';
export type {
  PrestigeConfig,
  PrestigeState,
  PrestigePreview,
  PrestigeResult,
} from './PrestigeSystem';

// UnlockChecker — 解锁检查器
export { UnlockChecker } from './UnlockChecker';
export type {
  UnlockCondition,
  UnlockResult,
  Unlockable,
  UnlockContext,
} from './UnlockChecker';

// InputHandler — 输入处理器
export { InputHandler } from './InputHandler';
export type {
  InputAction,
  KeyBinding,
  InputConfig,
  InputEvent,
  InputCallback,
} from './InputHandler';

// UnitSystem — 角色招募 + 进化系统（P1）
export { UnitSystem, UnitRarity } from './UnitSystem';
export type {
  MaterialCost,
  EvolutionBranch,
  UnitDef,
  UnitState,
  UnitSystemEvent,
  UnitResult,
} from './UnitSystem';

// StageSystem — 阶段演进系统（P1）
export { StageSystem } from './StageSystem';
export type {
  StageReward,
  StageCondition,
  StageDef,
  StageInfo,
  StageSystemEvent,
  StageResult,
} from './StageSystem';

// ParticleSystem — 通用粒子子系统（P1）
export { ParticleSystem } from './ParticleSystem';
export type {
  EmitterShape,
  ParticleColorConfig,
  ParticleSizeConfig,
  ParticleSpeedConfig,
  EmitterConfig,
  Particle,
} from './ParticleSystem';

// FloatingTextSystem — 飘字效果子系统（P1）
export { FloatingTextSystem } from './FloatingTextSystem';
export type {
  EasingType,
  TrajectoryType,
  FloatingTextStyle,
  FloatingTextInstance,
  FloatingTextOptions,
} from './FloatingTextSystem';

// StatisticsTracker — 统计追踪子系统（P1）
export { StatisticsTracker } from './StatisticsTracker';
export type {
  StatValue,
  AggregationType,
  StatDefinition,
  StatRecord,
  TimeSeriesPoint,
  AchievementProgressCallback,
} from './StatisticsTracker';

// BattleSystem — 战斗波次系统（P2）
export { BattleSystem } from './BattleSystem';
export type {
  EnemyDef,
  BattleDef,
  BattleBuff,
  BattleEnemy,
  BattleStats,
  BattleState,
  BattleEvent,
} from './BattleSystem';

// SeasonSystem — 季节循环系统（P2）
export { SeasonSystem } from './SeasonSystem';
export type {
  SeasonEffect,
  Season,
  SeasonRecord,
  SeasonState,
  SeasonEvent,
} from './SeasonSystem';

// CraftingSystem — 炼制/合成系统（P2）
export { CraftingSystem } from './CraftingSystem';
export type {
  CraftQuality,
  RecipeDef,
  ActiveCraft,
  CraftResult,
  CraftingState,
  CraftingEvent,
  CraftingEventListener,
} from './CraftingSystem';

// ExpeditionSystem — 远征系统核心模块（P2）
export { ExpeditionSystem } from './ExpeditionSystem';
export type {
  ExpeditionDef,
  ActiveExpedition,
  ExpeditionStats,
  ExpeditionState,
  ExpeditionEvent,
} from './ExpeditionSystem';

// TechTreeSystem — 科技树系统核心模块（P2）
export { TechTreeSystem } from './TechTreeSystem';
export type {
  TechEffect,
  TechDef,
  ActiveResearch,
  TechTreeState,
  TechTreeEvent,
} from './TechTreeSystem';

// CharacterLevelSystem — 角色等级系统核心模块（P2）
export { CharacterLevelSystem } from './CharacterLevelSystem';
export type {
  LevelTable,
  CharacterLevelState,
  CharacterLevelEvent,
} from './CharacterLevelSystem';

// EquipmentSystem — 装备系统核心模块（P2）
export { EquipmentSystem } from './EquipmentSystem';
export type {
  EquipSlot,
  EquipDef,
  EquipInstance,
  EquipState,
  EquipEvent,
} from './EquipmentSystem';

// DeitySystem — 神明庇护系统核心模块（P2）
export { DeitySystem } from './DeitySystem';
export type {
  DeityDef,
  DeityState,
  DeityEvent,
} from './DeitySystem';

// TerritorySystem — 领土征服系统核心模块（P2）
export { TerritorySystem } from './TerritorySystem';
export type {
  TerritoryDef,
  TerritoryStatus,
  TerritoryState,
  TerritoryEvent,
} from './TerritorySystem';

// QuestSystem — 任务系统核心模块（P3）
export { QuestSystem } from './QuestSystem';
export type {
  QuestType,
  QuestConditionType,
  QuestCondition,
  QuestReward,
  QuestDef,
  QuestState,
  QuestEvent,
  QuestSystemConfig,
  QuestEventListener,
} from './QuestSystem';

// StorySystem — 剧情系统核心模块（P3）
export { StorySystem } from './StorySystem';
export type {
  DialogueCharacter,
  DialogueLine,
  DialogueChoice,
  StoryTrigger,
  ChapterDef,
  ChapterState,
  StoryEvent,
  StoryEventListener,
} from './StorySystem';

// EventSystem — 活动系统核心模块（P3）
export { EventSystem } from './EventSystem';
export type {
  EventStatus,
  EventTier,
  EventReward,
  EventShopItem,
  EventMilestone,
  GameEvent,
  EventSystemEvent,
  EventSystemListener,
} from './EventSystem';

// RewardSystem — 奖励系统核心模块（P3）
export { RewardSystem } from './RewardSystem';
export type {
  RewardType,
  RewardItem,
  Mail,
  LoginBonusDef,
  LevelRewardDef,
  RewardEvent,
  RewardEventListener,
} from './RewardSystem';

// InteractionSystem — 互动系统核心模块（P3）
export { InteractionSystem } from './InteractionSystem';
export type {
  FriendStatus,
  Friend,
  ChatMessage,
  GiftRecord,
  VisitRecord,
  Guild,
  GuildMember,
  InteractionEvent,
  InteractionEventListener,
} from './InteractionSystem';

// MiniGameSystem — 小游戏系统核心模块（P3）
export { MiniGameSystem } from './MiniGameSystem';
export type {
  MiniGameType,
  MiniGameDef,
  WheelPrize,
  DrawPrize,
  QuizQuestion,
  MiniGameState,
  MiniGameResult,
  MiniGameEvent,
  MiniGameEventListener,
} from './MiniGameSystem';

// DecorationSystem — 装饰系统核心模块（P3）
export { DecorationSystem } from './DecorationSystem';
export type {
  SkinType,
  Rarity,
  SkinDef,
  TitleDef,
  AvatarFrameDef,
  EffectDef,
  DecorationState,
  DecorationEvent,
  DecorationEventListener,
} from './DecorationSystem';

// ============================================================
// 模块集成协议（ModuleIntegrationProtocol）
// ============================================================

// ModuleRegistry — 模块注册中心
export { ModuleRegistry } from './ModuleRegistry';
export type {
  ModuleDescriptor,
  ModuleState,
  RegistrySnapshot,
  Initializable,
  Updatable,
  Resetable,
  Serializable,
} from './ModuleRegistry';

// ModuleEventBus — 模块间事件总线
export { ModuleEventBus } from './ModuleEventBus';
export type {
  BusEvent,
  EventHandler,
  EventMiddleware,
} from './ModuleEventBus';

// IdleIntegrationAdapter — 放置游戏引擎集成适配器
export { IdleIntegrationAdapter } from './IdleIntegrationAdapter';

// SpeedManager — 加速管理器（特性层）
export { SpeedManager } from './SpeedManager';
export type {
  SpeedConfig,
  SpeedState,
  SpeedEvent,
  SpeedEventListener,
} from './SpeedManager';

// AutoPlayController — 自动操作控制器（特性层）
export { AutoPlayController } from './AutoPlayController';
export type {
  AutoPlayRule,
  AutoPlayState,
  AutoPlayEvent,
  AutoPlayEventListener,
} from './AutoPlayController';

// BatchOperationHandler — 批量操作处理器（特性层）
export { BatchOperationHandler } from './BatchOperationHandler';
export type {
  BatchResult,
  BatchAction,
} from './BatchOperationHandler';

// OfflineRewardCalculator — 离线收益计算器（特性层）
export { OfflineRewardCalculator } from './OfflineRewardCalculator';
export type {
  ProductionSource,
  OfflineRewardConfig,
  SourceBreakdown,
  OfflineRewardResult,
} from './OfflineRewardCalculator';
