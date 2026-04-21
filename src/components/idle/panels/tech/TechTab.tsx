/**
 * TechTab — 科技树主Tab面板
 *
 * 功能：
 * - 三条路线切换（军事红/经济黄/文化紫）
 * - 科技树节点展示（节点+连线+前置依赖）
 * - 互斥分支可视化（锁定状态）
 * - 当前研究进度条
 * - 点击节点打开详情弹窗
 *
 * PC端：三路线并排展示
 * 手机端：Tab切换+竖向时间轴
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import type {
  TechPath,
  TechNodeDef,
  TechNodeState,
  TechNodeStatus,
  ResearchSlot,
} from '@/games/three-kingdoms/engine';
import {
  TECH_PATHS,
  TECH_PATH_LABELS,
  TECH_PATH_COLORS,
  TECH_PATH_ICONS,
  TECH_NODE_MAP,
  getNodesByPath,
} from '@/games/three-kingdoms/engine';
import TechNodeDetailModal from './TechNodeDetailModal';
import TechResearchPanel from './TechResearchPanel';
import './TechTab.css';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────
interface TechTabProps {
  engine: ThreeKingdomsEngine;
  snapshotVersion: number;
}

// ─────────────────────────────────────────────
// 状态标签映射
// ─────────────────────────────────────────────
const STATUS_LABELS: Record<TechNodeStatus, string> = {
  completed: '✅',
  researching: '🔵',
  available: '🔓',
  locked: '🔒',
};

// ─────────────────────────────────────────────
// 格式化剩余时间
// ─────────────────────────────────────────────
function formatTime(seconds: number): string {
  if (seconds <= 0) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────
const TechTab: React.FC<TechTabProps> = ({ engine, snapshotVersion }) => {
  // ── 状态 ──
  const [activePath, setActivePath] = useState<TechPath>('military');
  const [selectedTechId, setSelectedTechId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval>>();

  // 每秒刷新研究进度
  useEffect(() => {
    timerRef.current = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  // 响应式：监听窗口宽度变化
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 767px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // ── 引擎引用 ──
  const treeSystem = engine.getTechTreeSystem();
  const researchSystem = engine.getTechResearchSystem();
  const pointSystem = engine.getTechPointSystem();

  // ── 数据获取 ──
  const allNodeStates = useMemo(
    () => treeSystem.getAllNodeStates(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [snapshotVersion, tick],
  );

  const researchQueue: ResearchSlot[] = useMemo(
    () => researchSystem.getQueue(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [snapshotVersion, tick],
  );

  const techPoints = useMemo(
    () => pointSystem.getTechPointState(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [snapshotVersion, tick],
  );

  const productionRate = useMemo(
    () => pointSystem.getProductionRate(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [snapshotVersion],
  );

  const chosenMutex = useMemo(
    () => treeSystem.getChosenMutexNodes(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [snapshotVersion],
  );

  // ── 路线进度 ──
  const pathProgress = useMemo(() => {
    const result: Record<string, { completed: number; total: number }> = {};
    for (const path of TECH_PATHS) {
      const nodes = getNodesByPath(path);
      const completed = nodes.filter(
        (n) => allNodeStates[n.id]?.status === 'completed',
      ).length;
      result[path] = { completed, total: nodes.length };
    }
    return result;
  }, [allNodeStates]);

  // ── 按路线+层级分组节点 ──
  const pathTierNodes = useMemo(() => {
    const result: Record<string, Map<number, TechNodeDef[]>> = {};
    for (const path of TECH_PATHS) {
      const nodes = getNodesByPath(path);
      const tierMap = new Map<number, TechNodeDef[]>();
      for (const node of nodes) {
        const list = tierMap.get(node.tier) ?? [];
        list.push(node);
        tierMap.set(node.tier, list);
      }
      result[path] = tierMap;
    }
    return result;
  }, []);

  // ── 获取节点显示状态 ──
  const getNodeDisplayStatus = useCallback(
    (nodeDef: TechNodeDef): TechNodeStatus => {
      const state = allNodeStates[nodeDef.id];
      if (!state) return 'locked';
      return state.status;
    },
    [allNodeStates],
  );

  // ── 是否被互斥锁定 ──
  const isMutexLocked = useCallback(
    (nodeDef: TechNodeDef): boolean => {
      if (!nodeDef.mutexGroup) return false;
      const chosen = chosenMutex[nodeDef.mutexGroup];
      return !!chosen && chosen !== nodeDef.id;
    },
    [chosenMutex],
  );

  // ── 当前研究中的科技 ──
  const activeResearch = researchQueue.length > 0 ? researchQueue[0] : null;
  const activeResearchDef = activeResearch
    ? TECH_NODE_MAP.get(activeResearch.techId)
    : null;
  const activeProgress = activeResearch
    ? researchSystem.getResearchProgress(activeResearch.techId)
    : 0;
  const activeRemaining = activeResearch
    ? researchSystem.getRemainingTime(activeResearch.techId)
    : 0;

  // ── 选中节点 ──
  const selectedDef = selectedTechId ? TECH_NODE_MAP.get(selectedTechId) : null;
  const selectedState = selectedTechId ? allNodeStates[selectedTechId] : null;

  // ── 渲染节点 ──
  const renderNode = useCallback(
    (nodeDef: TechNodeDef) => {
      const status = getNodeDisplayStatus(nodeDef);
      const mutexLocked = isMutexLocked(nodeDef);
      const isResearching = status === 'researching';
      const progress = isResearching
        ? researchSystem.getResearchProgress(nodeDef.id)
        : 0;

      const statusClass = mutexLocked ? 'mutex-locked' : status;

      return (
        <div
          key={nodeDef.id}
          className={`tk-tech-node tk-tech-node--${statusClass}`}
          onClick={() => setSelectedTechId(nodeDef.id)}
          title={nodeDef.name}
          data-testid={`tech-node-${nodeDef.id}`}
        >
          {/* 状态角标 */}
          <span
            className={`tk-tech-node-badge tk-tech-node-badge--${status}`}
            data-testid={`tech-badge-${nodeDef.id}`}
          >
            {STATUS_LABELS[status]}
          </span>

          {/* 图标 */}
          <div className="tk-tech-node-icon">{nodeDef.icon}</div>

          {/* 名称 */}
          <span className="tk-tech-node-name">{nodeDef.name}</span>

          {/* 研究进度条 */}
          {isResearching && (
            <div className="tk-tech-node-progress">
              <div
                className="tk-tech-node-progress-fill"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
          )}

          {/* 互斥标签 */}
          {nodeDef.mutexGroup && !mutexLocked && status !== 'completed' && (
            <span className="tk-tech-mutex-tag">二选一</span>
          )}
        </div>
      );
    },
    [getNodeDisplayStatus, isMutexLocked, researchSystem],
  );

  // ── 渲染单条路线 ──
  const renderPathColumn = useCallback(
    (path: TechPath) => {
      const tierMap = pathTierNodes[path];
      if (!tierMap) return null;

      const tiers = Array.from(tierMap.entries()).sort(([a], [b]) => a - b);

      return (
        <div className="tk-tech-path-column" data-testid={`tech-path-${path}`}>
          {/* 路线标题 */}
          <div className={`tk-tech-path-title tk-tech-path-title--${path}`}>
            <span>{TECH_PATH_ICONS[path]}</span>
            <span>{TECH_PATH_LABELS[path]}路线</span>
          </div>

          {/* 按层级渲染 */}
          {tiers.map(([tier, nodes], tierIdx) => (
            <React.Fragment key={tier}>
              {/* 层间连线 */}
              {tierIdx > 0 && (
                <div
                  className={`tk-tech-tier-connector ${
                    nodes.some((n) => allNodeStates[n.id]?.status !== 'locked')
                      ? 'tk-tech-tier-connector--active'
                      : 'tk-tech-tier-connector--locked'
                  }`}
                />
              )}

              {/* 节点行 */}
              <div className="tk-tech-tier-row">
                {nodes.map((nodeDef) => renderNode(nodeDef))}
              </div>
            </React.Fragment>
          ))}
        </div>
      );
    },
    [pathTierNodes, allNodeStates, renderNode],
  );

  // ── 处理详情弹窗关闭 ──
  const handleCloseDetail = useCallback(() => {
    setSelectedTechId(null);
  }, []);

  // ── 处理研究开始 ──
  const handleStartResearch = useCallback(
    (techId: string) => {
      const result = researchSystem.startResearch(techId);
      if (!result.success) {
        // 可通过 toast 提示，此处简单处理
        console.warn('研究失败:', result.reason);
      }
    },
    [researchSystem],
  );

  return (
    <div className="tk-tech-tab" data-testid="tech-tab">
      {/* 路线切换Tab */}
      <div className="tk-tech-path-tabs">
        {TECH_PATHS.map((path) => (
          <button
            key={path}
            className={`tk-tech-path-tab tk-tech-path-tab--${path} ${
              activePath === path ? 'tk-tech-path-tab--active' : ''
            }`}
            onClick={() => setActivePath(path)}
            data-testid={`tech-path-tab-${path}`}
          >
            <span className="tk-tech-path-icon">{TECH_PATH_ICONS[path]}</span>
            <span>{TECH_PATH_LABELS[path]}</span>
            {pathProgress[path] && (
              <span className="tk-tech-path-progress">
                {pathProgress[path].completed}/{pathProgress[path].total}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 科技点信息 */}
      <div className="tk-tech-points-bar">
        <span className="tk-tech-points-label">📚 科技点:</span>
        <span className="tk-tech-points-value">
          {Math.floor(techPoints.current)}
        </span>
        {productionRate > 0 && (
          <span className="tk-tech-points-rate">
            +{productionRate.toFixed(2)}/s
          </span>
        )}
      </div>

      {/* 科技树画布 */}
      <div className="tk-tech-canvas" data-testid="tech-canvas">
        {/* PC端：显示所有路线 / 手机端：仅显示选中路线 */}
        {(isMobile ? [activePath] : TECH_PATHS).map((path) => (
          <React.Fragment key={path}>{renderPathColumn(path)}</React.Fragment>
        ))}
      </div>

      {/* 研究队列面板 */}
      <TechResearchPanel
        engine={engine}
        snapshotVersion={snapshotVersion}
        tick={tick}
      />

      {/* 手机端底部研究进度浮动条 */}
      {activeResearch && activeResearchDef && (
        <div className="tk-tech-research-float" data-testid="tech-research-float">
          <span className="tk-tech-research-float-name">
            {activeResearchDef.icon} {activeResearchDef.name}
          </span>
          <div className="tk-tech-research-float-bar">
            <div
              className="tk-tech-research-float-fill"
              style={{ width: `${Math.round(activeProgress * 100)}%` }}
            />
          </div>
          <span className="tk-tech-research-float-time">
            {formatTime(activeRemaining)}
          </span>
          <button
            className="tk-tech-research-float-speedup"
            onClick={() => setSelectedTechId(activeResearch.techId)}
          >
            加速
          </button>
        </div>
      )}

      {/* 科技详情弹窗 */}
      {selectedDef && selectedState && (
        <TechNodeDetailModal
          nodeDef={selectedDef}
          nodeState={selectedState}
          engine={engine}
          onClose={handleCloseDetail}
          onStartResearch={handleStartResearch}
          snapshotVersion={snapshotVersion}
          tick={tick}
        />
      )}
    </div>
  );
};

export default TechTab;
