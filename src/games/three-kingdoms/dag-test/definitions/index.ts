/**
 * DAG定义 — 统一导出
 *
 * 将所有DAG类型定义集中导出，方便外部模块引用。
 */

export type {
  // NavigationDAG
  NavNodeType,
  NavNode,
  NavEdge,
  NavigationDAG,

  // FlowDAG
  FlowEdgeType,
  FlowNode,
  FlowEdge,
  FlowDAG,

  // ResourceDAG
  ResourceType,
  ResourceNode,
  ResourceFlowType,
  ResourceEdge,
  ResourceDAG,

  // EventDAG
  EventRelationType,
  EventNode,
  EventEdge,
  EventDAG,

  // StateDAG
  StateNode,
  StateEdge,
  StateDAG,

  // Reports
  CoverageReport,
  IssueSeverity,
  DAGType,
  Issue,
  EvaluationReport,

  // Generic
  BaseNode,
  BaseEdge,
  BaseDAG,
} from './dag-types';
