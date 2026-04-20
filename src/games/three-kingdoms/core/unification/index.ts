/**
 * 核心层 — v20.0 天下一统(下) 统一导出
 *
 * @module core/unification
 */

// v19.0 统一系统类型
export {
  CloudSyncStatus,
  AccountStatus,
  AnimationPlayState,
  SaveAction,
} from './unification.types';

export type {
  CloudSyncResult,
  CloudSavePayload,
  CloudSyncConfig,
  AccountDeleteRequest,
  BindResult,
  DeviceUnbindResult,
  GraphicsPresetConfig,
  QualityDetectionResult,
  GraphicsChangeEvent,
  AnimationPlayRequest,
  AnimationInstance,
  AnimationControllerState,
  SaveActionResult,
  AutoSaveTimerState,
} from './unification.types';

// v20.0 数值平衡类型
export type {
  ValidationLevel,
  ValidationEntry,
  NumericRange,
  BalanceDimension,
  BalanceReport,
  BalanceSummary,
  BalanceResourceType,
  ResourceCurvePoint,
  ResourceBalanceConfig,
  ResourceBalanceResult,
  HeroQualityTier,
  HeroPowerPoint,
  HeroBaseStats,
  HeroBalanceConfig,
  HeroBalanceResult,
  StageDifficultyPoint,
  BattleDifficultyConfig,
  BattleDifficultyResult,
  BalanceCurrencyType,
  CurrencyFlowPoint,
  EconomyBalanceConfig,
  EconomyBalanceResult,
  RebirthMultiplierPoint,
  RebirthBalanceConfig,
  RebirthBalanceResult,
} from './balance.types';

// v20.0 性能监控类型
export type {
  FPSSample,
  FPSStats,
  FPSAlertLevel,
  FPSThresholds,
  MemorySample,
  MemoryStats,
  MemoryAlertLevel,
  MemoryThresholds,
  LoadingPhase,
  LoadingRecord,
  LoadingStats,
  LoadingThresholds,
  PerformanceBottleneck,
  PerformanceReport,
  PerformanceMonitorConfig,
  ObjectPoolState,
  DirtyRect,
  RenderFrameData,
} from './performance.types';

// v20.0 交互审查 & 视觉一致性类型
export type {
  UIComponentType,
  InteractionState,
  InteractionEventType,
  InteractionRule,
  FeedbackType,
  InteractionCheckResult,
  InteractionViolation,
  InteractionAuditReport,
  InteractionAuditSummary,
  AnimationCategory,
  AnimationSpec,
  AnimationCheckResult,
  AnimationAuditReport,
  AnimationAuditSummary,
  ColorUsageCategory,
  QualityColorDef,
  FactionColorDef,
  FunctionalColorDef,
  StatusColorDef,
  ColorCheckResult,
  ColorAuditReport,
  ColorAuditSummary,
  VisualConsistencyReport,
} from './interaction.types';

// v20.0 全系统联调类型
export type {
  IntegrationLevel,
  IntegrationDimension,
  IntegrationStep,
  CoreLoopPhase,
  CoreLoopResult,
  DataFlowPath,
  DataFlowCheckResult,
  CrossSystemFlowResult,
  RebirthCyclePhase,
  RebirthCycleResult,
  OfflineSubsystem,
  OfflineSubsystemResult,
  OfflineFullResult,
  IntegrationReport,
} from './integration.types';
