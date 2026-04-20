// ============================================================
// UITreeExtractor — 统一导出入口
// ============================================================

// 枚举
export { UINodeType, DiffType } from './types';

// 常量
export { DEFAULT_EXTRACTOR_CONFIG } from './types';

// 适配器
export { ReactDOMAdapter } from './ReactDOMAdapter';
export { PixiJSAdapter } from './PixiJSAdapter';

// 合并提取器
export { CompositeExtractor } from './CompositeExtractor';

// 差异对比引擎
export { UITreeDiffer } from './UITreeDiffer';

// 类型
export type {
  UINodeSource,
  UIBounds,
  UINodeState,
  UITreeNode,
  UITreeSnapshot,
  UITreeStats,
  UITreeDiffNode,
  UITreeDiff,
  UITreeExtractorConfig,
  UITreeQuery,
  UIScoreDimension,
  UIReviewReport,
  UIFinding,
} from './types';

export type {
  PixiDisplayObjectLike,
  PixiContainerLike,
} from './PixiJSAdapter';
