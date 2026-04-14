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
