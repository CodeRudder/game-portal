/**
 * DAG测试体系 — 核心类型定义
 *
 * 定义5类DAG（有向无环图）的数据结构：
 *   1. NavigationDAG — 页面导航树
 *   2. FlowDAG       — 游戏流程步骤树
 *   3. ResourceDAG   — 资源流转树
 *   4. EventDAG      — 事件关系树
 *   5. StateDAG      — 状态转换树
 *
 * 以及覆盖率报告（CoverageReport）和评估报告（EvaluationReport）。
 */

// ═══════════════════════════════════════════════════════════════
// 1. NavigationDAG — 页面导航树
// ═══════════════════════════════════════════════════════════════

/** 导航节点类型 */
export type NavNodeType = 'page' | 'panel' | 'dialog' | 'tab';

/** 导航节点 */
export interface NavNode {
  id: string;
  type: NavNodeType;
  label: string;
  /** 前置条件描述 */
  preconditions: string[];
  /** 结构版本号 */
  version: string;
}

/** 导航边 */
export interface NavEdge {
  from: string;
  to: string;
  /** 触发导航的动作描述 */
  action: string;
  /** 导转条件（可选） */
  condition?: string;
  /** 是否双向导航 */
  bidirectional?: boolean;
}

/** 页面导航DAG */
export interface NavigationDAG {
  id: string;
  name: string;
  nodes: NavNode[];
  edges: NavEdge[];
  /** DAG入口节点ID列表 */
  entryPoints: string[];
}

// ═══════════════════════════════════════════════════════════════
// 2. FlowDAG — 游戏流程步骤树
// ═══════════════════════════════════════════════════════════════

/** 流程边类型 */
export type FlowEdgeType = 'sequence' | 'branch' | 'parallel' | 'loop';

/** 流程节点 */
export interface FlowNode {
  id: string;
  version: string;
  /** 所属模块 */
  module: string;
  /** 操作描述 */
  operation: string;
  preconditions: string[];
  /** 校验点列表 */
  validations: string[];
  /** 预期结果列表 */
  expectedResults: string[];
}

/** 流程边 */
export interface FlowEdge {
  from: string;
  to: string;
  type: FlowEdgeType;
  condition?: string;
  label?: string;
}

/** 游戏流程DAG */
export interface FlowDAG {
  id: string;
  name: string;
  version: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  /** 关键路径（节点ID序列的集合） */
  criticalPaths: string[][];
}

// ═══════════════════════════════════════════════════════════════
// 3. ResourceDAG — 资源流转树
// ═══════════════════════════════════════════════════════════════

/** 资源类型 */
export type ResourceType = 'currency' | 'material' | 'token' | 'premium';

/** 资源节点 */
export interface ResourceNode {
  id: string;
  name: string;
  type: ResourceType;
  /** 上限（可选） */
  cap?: number;
  /** 初始值（可选） */
  initial?: number;
}

/** 资源流转类型 */
export type ResourceFlowType = 'produce' | 'consume' | 'convert' | 'trade';

/** 资源流转边 */
export interface ResourceEdge {
  from: string;
  to: string;
  /** 关联的资源ID */
  resourceId: string;
  type: ResourceFlowType;
  /** 流转数量 */
  amount: number;
  /** 触发条件 */
  trigger: string;
  version?: string;
}

/** 资源流转DAG */
export interface ResourceDAG {
  id: string;
  name: string;
  resources: ResourceNode[];
  flows: ResourceEdge[];
}

// ═══════════════════════════════════════════════════════════════
// 4. EventDAG — 事件关系树
// ═══════════════════════════════════════════════════════════════

/** 事件关系类型 */
export type EventRelationType = 'emit-listen' | 'cascade' | 'block';

/** 事件节点 */
export interface EventNode {
  id: string;
  eventType: string;
  /** 事件发射者 */
  emitter: string;
  /** 事件载荷描述（可选） */
  payload?: string;
  version?: string;
}

/** 事件关系边 */
export interface EventEdge {
  from: string;
  to: string;
  /** 监听者（可选） */
  listener?: string;
  type: EventRelationType;
  /** 处理函数描述（可选） */
  handler?: string;
}

/** 事件关系DAG */
export interface EventDAG {
  id: string;
  name: string;
  events: EventNode[];
  relations: EventEdge[];
}

// ═══════════════════════════════════════════════════════════════
// 5. StateDAG — 状态转换树
// ═══════════════════════════════════════════════════════════════

/** 状态节点 */
export interface StateNode {
  id: string;
  /** 所属实体 */
  entity: string;
  /** 状态值 */
  state: string;
  /** 是否为初始状态 */
  isInitial?: boolean;
  /** 是否为终态 */
  isFinal?: boolean;
}

/** 状态转换边 */
export interface StateEdge {
  from: string;
  to: string;
  /** 触发转换的事件/动作 */
  trigger: string;
  /** 转换条件（可选） */
  condition?: string;
  /** 转换副作用（可选） */
  sideEffects?: string[];
}

/** 状态转换DAG */
export interface StateDAG {
  id: string;
  name: string;
  /** 关联实体 */
  entity: string;
  states: StateNode[];
  transitions: StateEdge[];
}

// ═══════════════════════════════════════════════════════════════
// 6. CoverageReport — 覆盖率报告
// ═══════════════════════════════════════════════════════════════

/** 覆盖率报告 */
export interface CoverageReport {
  /** 节点覆盖率 (0~1) */
  nodeCoverage: number;
  /** 边覆盖率 (0~1) */
  edgeCoverage: number;
  /** 路径覆盖率 (0~1) */
  pathCoverage: number;
  /** 数据覆盖率 (0~1) */
  dataCoverage: number;
  /** 状态覆盖率 (0~1) */
  stateCoverage: number;
  /** 综合覆盖率：加权 0.25×node + 0.25×edge + 0.20×path + 0.15×data + 0.15×state */
  overall: number;
  /** 上一次综合覆盖率（用于对比） */
  previousOverall?: number;
  /** 与上次的差值 */
  delta?: number;
  /** 未覆盖节点ID */
  uncoveredNodes: string[];
  /** 未覆盖边 [from, to] */
  uncoveredEdges: [string, string][];
  /** 未覆盖路径 */
  uncoveredPaths: string[][];
}

// ═══════════════════════════════════════════════════════════════
// 7. EvaluationReport — 评估报告
// ═══════════════════════════════════════════════════════════════

/** 问题严重等级 */
export type IssueSeverity = 'P0' | 'P1' | 'P2' | 'P3';

/** DAG类型枚举（用于标记问题来源） */
export type DAGType = 'navigation' | 'flow' | 'resource' | 'event' | 'state';

/** 单个问题 */
export interface Issue {
  id: string;
  severity: IssueSeverity;
  dagType: DAGType;
  /** 问题所在路径（可选） */
  path?: string;
  description: string;
  suggestion: string;
}

/** 评估报告 */
export interface EvaluationReport {
  /** 迭代次数 */
  iteration: number;
  timestamp: string;
  coverage: CoverageReport;
  issues: Issue[];
  fixes: string[];
  nextActions: string[];
}

// ═══════════════════════════════════════════════════════════════
// 通用工具类型
// ═══════════════════════════════════════════════════════════════

/** 通用DAG节点约束 — 至少包含id */
export interface BaseNode {
  id: string;
}

/** 通用DAG边约束 — 至少包含from和to */
export interface BaseEdge {
  from: string;
  to: string;
}

/** 通用DAG结构 */
export interface BaseDAG<TNode extends BaseNode, TEdge extends BaseEdge> {
  nodes: TNode[];
  edges: TEdge[];
}
