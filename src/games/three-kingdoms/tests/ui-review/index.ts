/**
 * UI评测框架 — 核心验证器
 *
 * @module ui-review
 *
 * 导出：
 * - PlanValidator: PLAN版本文档验证器，解析功能点并验证实现覆盖
 * - PrdChecker: PRD需求检查器，解析需求并检查实现满足度
 * - UIReviewScorer: 自动评分系统，综合评分生成10分制评测报告
 * - UIReviewOrchestrator: 流水线编排器，串联所有组件完成版本评测
 */

export {
  PlanValidator,
  type PlanFeature,
  type VersionPlan,
  type PlanValidationResult,
  type FeatureValidationDetail,
} from './PlanValidator';

export {
  PrdChecker,
  type PrdRequirement,
  type PrdDocument,
  type PrdCheckResult,
  type UnsatisfiedRequirement,
} from './PrdChecker';

export {
  UIReviewScorer,
  DEFAULT_DIMENSIONS,
  type ScoreDimension,
  type DimensionScore,
  type VersionReviewReport,
  type UIReviewScorerOptions,
} from './UIReviewScorer';

export {
  UIReviewOrchestrator,
  type UIReviewOrchestratorOptions,
} from './UIReviewOrchestrator';
