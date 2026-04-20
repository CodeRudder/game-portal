/**
 * 引擎层 — 新手引导系统统一导出
 *
 * @module engine/guide
 */

export { TutorialStateMachine } from './TutorialStateMachine';
export { StoryEventPlayer } from './StoryEventPlayer';
export type {
  StoryPlayState,
  TypewriterState,
  StoryPlayProgress,
  StoryGameState,
  SkipConfirmResult,
} from './StoryEventPlayer';
export { TutorialStepManager } from './TutorialStepManager';
export type {
  TutorialGameState,
  AccelerationState,
  StepExecutionResult,
} from './TutorialStepManager';
export { TutorialStepExecutor } from './TutorialStepExecutor';
export type { StepExecutorStateSlice } from './TutorialStepExecutor';
export { TutorialMaskSystem } from './TutorialMaskSystem';
export type {
  HighlightBounds,
  MaskRenderData,
  BubbleRenderData,
  TutorialOverlayRenderData,
  ElementBoundsProvider,
  ViewportSize,
} from './TutorialMaskSystem';
export { FirstLaunchDetector } from './FirstLaunchDetector';
export type {
  FirstLaunchStep,
  FirstLaunchFlowState,
  DeviceHardwareInfo,
  NewbieProtectionState,
  LanguageDetector,
  HardwareInfoProvider,
  PermissionRequester,
} from './FirstLaunchDetector';
