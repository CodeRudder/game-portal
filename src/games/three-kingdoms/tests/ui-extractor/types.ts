// ============================================================
// UITreeExtractor — 统一类型定义
// 技术栈：React 18 + PixiJS v8 双层架构
// ============================================================

/** UI节点来源 */
export type UINodeSource = 'react-dom' | 'pixijs';

/** UI节点类型枚举 */
export enum UINodeType {
  // React DOM 节点
  ReactComponent = 'react-component',
  HtmlElement = 'html-element',
  TextNode = 'text-node',
  // PixiJS 节点
  PixiContainer = 'pixi-container',
  PixiSprite = 'pixi-sprite',
  PixiGraphics = 'pixi-graphics',
  PixiText = 'pixi-text',
  PixiMesh = 'pixi-mesh',
  // 通用
  Unknown = 'unknown',
}

/** 位置和尺寸 */
export interface UIBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 节点状态 */
export interface UINodeState {
  visible: boolean;
  enabled?: boolean;
  active?: boolean;
  alpha?: number;
  zIndex?: number;
  text?: string;
  className?: string;
  style?: Record<string, string>;
  attributes?: Record<string, string>;
}

/** 统一UI树节点 */
export interface UITreeNode {
  /** 唯一标识 */
  id: string;
  /** 节点来源 */
  source: UINodeSource;
  /** 节点类型 */
  type: UINodeType;
  /** 显示名称（组件名/标签名/对象名） */
  name: string;
  /** 位置和尺寸 */
  bounds: UIBounds;
  /** 节点状态 */
  state: UINodeState;
  /** 子节点 */
  children: UITreeNode[];
  /** 原始引用（测试时可用） */
  _raw?: unknown;
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/** UI树快照 */
export interface UITreeSnapshot {
  /** 快照ID */
  id: string;
  /** 快照时间戳 */
  timestamp: number;
  /** 根节点 */
  root: UITreeNode;
  /** 统计信息 */
  stats: UITreeStats;
}

/** 统计信息 */
export interface UITreeStats {
  totalNodes: number;
  reactNodes: number;
  pixiNodes: number;
  maxDepth: number;
  nodeTypeDistribution: Record<UINodeType, number>;
}

/** 差异类型 */
export enum DiffType {
  Added = 'added',
  Removed = 'removed',
  Changed = 'changed',
  Moved = 'moved',
}

/** 差异节点 */
export interface UITreeDiffNode {
  diffType: DiffType;
  path: string;
  nodeId: string;
  nodeName: string;
  oldValue?: unknown;
  newValue?: unknown;
  property?: string;
}

/** 差异结果 */
export interface UITreeDiff {
  baseSnapshotId: string;
  targetSnapshotId: string;
  diffs: UITreeDiffNode[];
  summary: {
    added: number;
    removed: number;
    changed: number;
    moved: number;
  };
}

/** 提取器配置 */
export interface UITreeExtractorConfig {
  maxDepth: number;       // 默认20
  includeHidden: boolean; // 默认false
  captureState: boolean;  // 默认true
  captureBounds: boolean; // 默认true
  filter?: (node: UITreeNode) => boolean;
}

/** 查询条件 */
export interface UITreeQuery {
  type?: UINodeType;
  name?: string;
  namePattern?: RegExp;
  source?: UINodeSource;
  state?: Partial<UINodeState>;
  bounds?: Partial<UIBounds>;
  customFilter?: (node: UITreeNode) => boolean;
}

/** 评分维度 */
export interface UIScoreDimension {
  name: string;
  weight: number;
  score: number;
  maxScore: number;
  details: string;
}

/** UI评测报告 */
export interface UIReviewReport {
  version: string;
  timestamp: number;
  totalScore: number;
  maxScore: number;
  dimensions: UIScoreDimension[];
  findings: UIFinding[];
  treeStats: UITreeStats;
}

/** 发现项 */
export interface UIFinding {
  severity: 'critical' | 'major' | 'minor' | 'info';
  category: string;
  description: string;
  expected?: string;
  actual?: string;
  nodeId?: string;
  suggestion?: string;
}

/** 默认配置 */
export const DEFAULT_EXTRACTOR_CONFIG: UITreeExtractorConfig = {
  maxDepth: 20,
  includeHidden: false,
  captureState: true,
  captureBounds: true,
};
