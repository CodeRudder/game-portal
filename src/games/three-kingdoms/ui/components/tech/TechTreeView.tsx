/**
 * 三国霸业 — 科技树可视化组件
 *
 * 展示三条科技路线（军事/经济/文化），支持：
 *   - 节点按层级排列，连线展示前置依赖
 *   - 互斥分支标记（同组内只能选一个）
 *   - 已研究/可研究/锁定/研究中四种状态
 *   - 点击节点查看详情或发起研究
 *
 * 引擎依赖：engine/tech/ 下的 TechTreeSystem, TechResearchSystem
 *
 * @module ui/components/tech/TechTreeView
 */

import { useState, useMemo, useCallback } from 'react';
import { useGameContext } from '../../context/GameContext';
import { useDebouncedAction } from '../../hooks/useDebouncedAction';
import type {
  TechPath,
  TechNodeDef,
  TechNodeState,
  TechNodeStatus,
  TechEdge,
} from '../../../engine/tech/tech.types';
import {
  TECH_PATHS,
  TECH_PATH_LABELS,
  TECH_PATH_COLORS,
  TECH_PATH_ICONS,
} from '../../../engine/tech/tech.types';

// ─────────────────────────────────────────────
// 类型
// ─────────────────────────────────────────────

/** 节点状态对应的样式配置 */
interface NodeStyleConfig {
  background: string;
  borderColor: string;
  textColor: string;
  label: string;
}

/** 科技树视图状态 */
interface TechTreeViewState {
  /** 当前选中的路线 */
  selectedPath: TechPath;
  /** 当前选中的节点 ID */
  selectedNodeId: string | null;
  /** 是否显示详情面板 */
  showDetail: boolean;
}

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 节点状态样式映射 */
const STATUS_STYLES: Record<TechNodeStatus, NodeStyleConfig> = {
  completed: { background: '#1a3a1a', borderColor: '#4ade80', textColor: '#4ade80', label: '已完成' },
  available: { background: '#1a2a3a', borderColor: '#60a5fa', textColor: '#60a5fa', label: '可研究' },
  locked: { background: '#1a1a1a', borderColor: '#555555', textColor: '#666666', label: '锁定' },
  researching: { background: '#2a2a1a', borderColor: '#fbbf24', textColor: '#fbbf24', label: '研究中' },
};

/** 互斥标记颜色 */
const MUTEX_COLOR = '#ef4444';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

export interface TechTreeViewProps {
  /** 点击节点回调 */
  onNodeClick?: (nodeId: string, nodeDef: TechNodeDef) => void;
  /** 发起研究回调 */
  onResearch?: (nodeId: string) => void;
  /** 额外类名 */
  className?: string;
}

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

/** 获取节点样式 */
function getNodeStyle(status: TechNodeStatus): NodeStyleConfig {
  return STATUS_STYLES[status] ?? STATUS_STYLES.locked;
}

/** 计算路线完成百分比 */
function calcPathPercent(completed: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((completed / total) * 100);
}

/** 按层级分组节点 */
function groupByTier(nodes: TechNodeDef[]): Map<number, TechNodeDef[]> {
  const map = new Map<number, TechNodeDef[]>();
  for (const node of nodes) {
    const list = map.get(node.tier) ?? [];
    list.push(node);
    map.set(node.tier, list);
  }
  return map;
}

/** 判断连线是否为互斥类型 */
function isMutexEdge(edges: TechEdge[], fromId: string, toId: string): boolean {
  return edges.some((e) => e.from === fromId && e.to === toId && e.type === 'mutex');
}

// ─────────────────────────────────────────────
// 纯逻辑管理器（用于测试）
// ─────────────────────────────────────────────

/**
 * TechTreeLogic — 科技树视图状态管理器
 *
 * 封装科技树 UI 的核心逻辑，不依赖 React DOM。
 * 可直接在测试中实例化验证。
 */
export class TechTreeLogic {
  private state: TechTreeViewState;
  private nodeStates: Record<string, TechNodeState>;
  private nodeDefs: TechNodeDef[];
  private edges: TechEdge[];
  private chosenMutexNodes: Record<string, string>;

  constructor(
    nodeStates: Record<string, TechNodeState>,
    nodeDefs: TechNodeDef[],
    edges: TechEdge[],
    chosenMutexNodes: Record<string, string>,
  ) {
    this.state = { selectedPath: 'military', selectedNodeId: null, showDetail: false };
    this.nodeStates = nodeStates;
    this.nodeDefs = nodeDefs;
    this.edges = edges;
    this.chosenMutexNodes = chosenMutexNodes;
  }

  /** 切换路线 */
  selectPath(path: TechPath): TechPath {
    this.state.selectedPath = path;
    this.state.selectedNodeId = null;
    this.state.showDetail = false;
    return this.state.selectedPath;
  }

  /** 选择节点 */
  selectNode(nodeId: string): void {
    this.state.selectedNodeId = nodeId;
    this.state.showDetail = true;
  }

  /** 关闭详情 */
  closeDetail(): void {
    this.state.selectedNodeId = null;
    this.state.showDetail = false;
  }

  /** 获取当前路线节点（按层级分组） */
  getPathNodesGrouped(path: TechPath): Map<number, TechNodeDef[]> {
    const nodes = this.nodeDefs.filter((n) => n.path === path);
    return groupByTier(nodes);
  }

  /** 获取节点状态 */
  getNodeStatus(nodeId: string): TechNodeStatus {
    return this.nodeStates[nodeId]?.status ?? 'locked';
  }

  /** 获取节点定义 */
  getNodeDef(nodeId: string): TechNodeDef | undefined {
    return this.nodeDefs.find((n) => n.id === nodeId);
  }

  /** 获取路线进度 */
  getPathProgress(path: TechPath): { completed: number; total: number; percent: number } {
    const nodes = this.nodeDefs.filter((n) => n.path === path);
    const completed = nodes.filter((n) => this.nodeStates[n.id]?.status === 'completed').length;
    return { completed, total: nodes.length, percent: calcPathPercent(completed, nodes.length) };
  }

  /** 获取所有路线进度 */
  getAllPathProgress(): Record<TechPath, { completed: number; total: number; percent: number }> {
    const result = {} as Record<TechPath, { completed: number; total: number; percent: number }>;
    for (const path of TECH_PATHS) {
      result[path] = this.getPathProgress(path);
    }
    return result;
  }

  /** 检查节点是否被互斥锁定 */
  isMutexLocked(nodeId: string): boolean {
    const def = this.getNodeDef(nodeId);
    if (!def || !def.mutexGroup) return false;
    const chosen = this.chosenMutexNodes[def.mutexGroup];
    return !!chosen && chosen !== nodeId;
  }

  /** 获取节点的互斥替代节点 */
  getMutexAlternatives(nodeId: string): string[] {
    const def = this.getNodeDef(nodeId);
    if (!def || !def.mutexGroup) return [];
    return this.nodeDefs
      .filter((n) => n.mutexGroup === def.mutexGroup && n.id !== nodeId)
      .map((n) => n.id);
  }

  /** 获取选中节点信息 */
  getSelectedNodeInfo(): { def: TechNodeDef; state: TechNodeState; style: NodeStyleConfig } | null {
    if (!this.state.selectedNodeId) return null;
    const def = this.getNodeDef(this.state.selectedNodeId);
    const nodeState = this.nodeStates[this.state.selectedNodeId];
    if (!def || !nodeState) return null;
    return { def, state: nodeState, style: getNodeStyle(nodeState.status) };
  }

  /** 获取当前视图状态 */
  getViewState(): TechTreeViewState {
    return { ...this.state };
  }

  /** 是否可以研究指定节点 */
  canResearchNode(nodeId: string): boolean {
    const status = this.getNodeStatus(nodeId);
    return status === 'available';
  }

  /** 获取前置依赖描述 */
  getPrerequisiteDesc(nodeId: string): string[] {
    const def = this.getNodeDef(nodeId);
    if (!def) return [];
    return def.prerequisites.map((preId) => {
      const preDef = this.getNodeDef(preId);
      const status = this.getNodeStatus(preId);
      const label = preDef?.name ?? preId;
      const done = status === 'completed';
      return done ? `✅ ${label}` : `❌ ${label}`;
    });
  }

  /** 获取效果描述 */
  getEffectDesc(nodeId: string): string[] {
    const def = this.getNodeDef(nodeId);
    if (!def) return [];
    return def.effects.map((e) => `${e.type}(${e.target}): +${e.value}%`);
  }
}

// ─────────────────────────────────────────────
// 子组件：路线标签
// ─────────────────────────────────────────────

interface PathTabProps {
  path: TechPath;
  isActive: boolean;
  progress: { completed: number; total: number; percent: number };
  onClick: () => void;
}

function PathTab({ path, isActive, progress, onClick }: PathTabProps) {
  const color = TECH_PATH_COLORS[path];
  return (
    <button
      style={{
        ...styles.pathTab,
        borderColor: isActive ? color : 'transparent',
        backgroundColor: isActive ? color + '15' : 'transparent',
      }}
      onClick={onClick}
      role="tab"
      aria-selected={isActive}
    >
      <span>{TECH_PATH_ICONS[path]}</span>
      <span style={{ color: isActive ? color : '#a0a0a0' }}>{TECH_PATH_LABELS[path]}</span>
      <span style={{ ...styles.pathPercent, color }}>{progress.percent}%</span>
    </button>
  );
}

// ─────────────────────────────────────────────
// 子组件：科技节点
// ─────────────────────────────────────────────

interface TechNodeCardProps {
  def: TechNodeDef;
  status: TechNodeStatus;
  isMutexLocked: boolean;
  isSelected: boolean;
  onClick: () => void;
}

function TechNodeCard({ def, status, isMutexLocked, isSelected, onClick }: TechNodeCardProps) {
  const style = getNodeStyle(status);

  return (
    <div
      style={{
        ...styles.nodeCard,
        background: style.background,
        borderColor: isSelected ? '#fff' : style.borderColor,
        opacity: isMutexLocked ? 0.4 : 1,
      }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`${def.name} - ${style.label}`}
    >
      {/* 互斥标记 */}
      {isMutexLocked && (
        <div style={{ ...styles.mutexBadge, backgroundColor: MUTEX_COLOR }}>互斥</div>
      )}

      {/* 图标 + 名称 */}
      <div style={styles.nodeIcon}>{def.icon}</div>
      <div style={{ ...styles.nodeName, color: style.textColor }}>{def.name}</div>

      {/* 状态标签 */}
      <div style={{ ...styles.nodeStatus, color: style.textColor }}>{style.label}</div>

      {/* 层级 */}
      <div style={styles.nodeTier}>T{def.tier}</div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 子组件：详情面板
// ─────────────────────────────────────────────

interface DetailPanelProps {
  def: TechNodeDef;
  status: TechNodeStatus;
  isMutexLocked: boolean;
  prerequisiteDesc: string[];
  effectDesc: string[];
  onResearch: () => void;
  onClose: () => void;
}

function DetailPanel({ def, status, isMutexLocked, prerequisiteDesc, effectDesc, onResearch, onClose }: DetailPanelProps) {
  const style = getNodeStyle(status);
  const canResearch = status === 'available';

  return (
    <div style={styles.detailPanel}>
      <div style={styles.detailHeader}>
        <span style={{ fontSize: '20px' }}>{def.icon}</span>
        <span style={{ ...styles.detailName, color: style.textColor }}>{def.name}</span>
        <button style={styles.closeBtn} onClick={onClose}>✕</button>
      </div>

      <div style={styles.detailDesc}>{def.description}</div>

      {/* 前置依赖 */}
      {prerequisiteDesc.length > 0 && (
        <div style={styles.detailSection}>
          <div style={styles.sectionTitle}>前置科技</div>
          {prerequisiteDesc.map((desc, i) => (
            <div key={i} style={styles.sectionItem}>{desc}</div>
          ))}
        </div>
      )}

      {/* 效果 */}
      {effectDesc.length > 0 && (
        <div style={styles.detailSection}>
          <div style={styles.sectionTitle}>科技效果</div>
          {effectDesc.map((desc, i) => (
            <div key={i} style={styles.sectionItem}>{desc}</div>
          ))}
        </div>
      )}

      {/* 消耗 */}
      <div style={styles.detailSection}>
        <div style={styles.sectionTitle}>研究消耗</div>
        <div style={styles.sectionItem}>科技点: {def.costPoints}</div>
        <div style={styles.sectionItem}>耗时: {def.researchTime}秒</div>
      </div>

      {/* 操作按钮 */}
      {canResearch && !isMutexLocked && (
        <button style={styles.researchBtn} onClick={onResearch}>
          开始研究
        </button>
      )}

      {isMutexLocked && (
        <div style={{ ...styles.mutexWarning, color: MUTEX_COLOR }}>
          ⚠️ 互斥分支已选择其他节点，无法研究
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────

/**
 * TechTreeView — 科技树可视化组件
 *
 * @example
 * ```tsx
 * <TechTreeView onResearch={(id) => engine.getTechResearchSystem().startResearch(id)} />
 * ```
 */
export function TechTreeView({ onNodeClick, onResearch, className }: TechTreeViewProps) {
  const { engine, snapshot } = useGameContext();
  const [selectedPath, setSelectedPath] = useState<TechPath>('military');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // 获取引擎数据
  const techTreeSystem = engine.getTechTreeSystem();
  const allNodeDefs = techTreeSystem.getAllNodeDefs();
  const allNodeStates = techTreeSystem.getAllNodeStates();
  const edges = techTreeSystem.getEdges();
  const chosenMutex = techTreeSystem.getChosenMutexNodes();

  // 创建逻辑实例
  const logic = useMemo(
    () => new TechTreeLogic(allNodeStates, allNodeDefs, edges, chosenMutex),
    [allNodeStates, allNodeDefs, edges, chosenMutex],
  );

  // 路线进度
  const allProgress = useMemo(() => logic.getAllPathProgress(), [logic]);

  // 当前路线节点（按层级分组）
  const tierNodes = useMemo(
    () => logic.getPathNodesGrouped(selectedPath),
    [logic, selectedPath],
  );

  // 选中节点信息
  const selectedInfo = useMemo(() => {
    if (!selectedNodeId) return null;
    const def = logic.getNodeDef(selectedNodeId);
    const status = logic.getNodeStatus(selectedNodeId);
    if (!def) return null;
    return {
      def,
      status,
      isMutexLocked: logic.isMutexLocked(selectedNodeId),
      prerequisiteDesc: logic.getPrerequisiteDesc(selectedNodeId),
      effectDesc: logic.getEffectDesc(selectedNodeId),
    };
  }, [logic, selectedNodeId]);

  const handlePathSelect = useCallback((path: TechPath) => {
    setSelectedPath(path);
    setSelectedNodeId(null);
  }, []);

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      setSelectedNodeId(nodeId);
      const def = logic.getNodeDef(nodeId);
      if (def) onNodeClick?.(nodeId, def);
    },
    [logic, onNodeClick],
  );

  const handleResearch = useCallback(() => {
    if (selectedNodeId) onResearch?.(selectedNodeId);
  }, [selectedNodeId, onResearch]);

  // P0-UI-02: 防抖包裹
  const { action: debouncedResearch, isActing: isResearching } = useDebouncedAction(handleResearch, 500);

  const handleCloseDetail = useCallback(() => setSelectedNodeId(null), []);

  if (!snapshot) {
    return <div style={styles.loading}>加载中...</div>;
  }

  return (
    <div
      style={styles.container}
      className={`tk-tech-tree ${className ?? ''}`.trim()}
      role="region"
      aria-label="科技树"
    >
      {/* 路线标签 */}
      <div style={styles.pathTabs} role="tablist">
        {TECH_PATHS.map((path) => (
          <PathTab
            key={path}
            path={path}
            isActive={selectedPath === path}
            progress={allProgress[path]}
            onClick={() => handlePathSelect(path)}
          />
        ))}
      </div>

      {/* 路线进度条 */}
      <div style={styles.progressBar}>
        <div
          style={{
            ...styles.progressFill,
            width: `${allProgress[selectedPath].percent}%`,
            backgroundColor: TECH_PATH_COLORS[selectedPath],
          }}
        />
      </div>

      {/* 节点网格 */}
      <div style={styles.nodeGrid}>
        {Array.from(tierNodes.entries())
          .sort(([a], [b]) => a - b)
          .map(([tier, nodes]) => (
            <div key={tier} style={styles.tierRow}>
              <div style={styles.tierLabel}>T{tier}</div>
              <div style={styles.tierNodes}>
                {nodes.map((node) => (
                  <TechNodeCard
                    key={node.id}
                    def={node}
                    status={logic.getNodeStatus(node.id)}
                    isMutexLocked={logic.isMutexLocked(node.id)}
                    isSelected={selectedNodeId === node.id}
                    onClick={() => handleNodeClick(node.id)}
                  />
                ))}
              </div>
            </div>
          ))}
      </div>

      {/* 详情面板 */}
      {selectedInfo && (
        <DetailPanel
          def={selectedInfo.def}
          status={selectedInfo.status}
          isMutexLocked={selectedInfo.isMutexLocked}
          prerequisiteDesc={selectedInfo.prerequisiteDesc}
          effectDesc={selectedInfo.effectDesc}
          onResearch={debouncedResearch}
          onClose={handleCloseDetail}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// 样式
// ─────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '12px',
    color: '#e8e0d0',
    minHeight: '400px',
  },
  loading: {
    padding: '24px',
    textAlign: 'center',
    color: '#a0a0a0',
  },
  pathTabs: {
    display: 'flex',
    gap: '4px',
    marginBottom: '8px',
  },
  pathTab: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 12px',
    border: '2px solid transparent',
    borderRadius: '6px',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
    transition: 'all 0.15s ease',
  },
  pathPercent: {
    fontSize: '11px',
    fontWeight: 700,
  },
  progressBar: {
    width: '100%',
    height: '4px',
    background: 'rgba(255,255,255,0.08)',
    borderRadius: '2px',
    overflow: 'hidden',
    marginBottom: '12px',
  },
  progressFill: {
    height: '100%',
    borderRadius: '2px',
    transition: 'width 0.3s ease',
  },
  nodeGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  tierRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
  },
  tierLabel: {
    fontSize: '11px',
    color: '#666',
    fontWeight: 700,
    minWidth: '24px',
    paddingTop: '8px',
  },
  tierNodes: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    flex: 1,
  },
  nodeCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px',
    padding: '8px',
    border: '2px solid',
    borderRadius: '6px',
    minWidth: '80px',
    cursor: 'pointer',
    transition: 'border-color 0.15s ease',
    position: 'relative',
  },
  nodeIcon: { fontSize: '18px' },
  nodeName: { fontSize: '12px', fontWeight: 600 },
  nodeStatus: { fontSize: '10px' },
  nodeTier: { fontSize: '9px', color: '#666' },
  mutexBadge: {
    position: 'absolute',
    top: '-4px',
    right: '-4px',
    padding: '1px 4px',
    fontSize: '9px',
    fontWeight: 700,
    borderRadius: '3px',
    color: '#fff',
  },
  mutexWarning: {
    padding: '8px',
    fontSize: '12px',
    textAlign: 'center',
  },
  detailPanel: {
    marginTop: '12px',
    padding: '12px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(212, 165, 116, 0.2)',
    borderRadius: '8px',
  },
  detailHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
  },
  detailName: {
    flex: 1,
    fontSize: '16px',
    fontWeight: 700,
  },
  detailDesc: {
    fontSize: '13px',
    color: '#a0a0a0',
    marginBottom: '8px',
  },
  detailSection: {
    marginBottom: '8px',
  },
  sectionTitle: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#d4a574',
    marginBottom: '4px',
  },
  sectionItem: {
    fontSize: '12px',
    color: '#e8e0d0',
    paddingLeft: '8px',
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: '#a0a0a0',
    cursor: 'pointer',
    fontSize: '16px',
  },
  researchBtn: {
    width: '100%',
    padding: '8px',
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
};
