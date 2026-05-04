/**
 * SiegeTaskPanel — 攻占任务面板
 *
 * 显示当前活跃的攻占任务列表，包括：
 * - 任务状态（行军中/攻城中/回城中）
 * - 编队信息（将领/兵力）
 * - 预计到达时间
 * - 目标领土信息
 * - 实时进度条（基于 defenseRatios / returnETAs）
 * - 已完成任务的保留展示（最近 5 条）
 *
 * @module components/idle/panels/map/SiegeTaskPanel
 */
import React, { useMemo, useState } from 'react';
import type { SiegeTask, SiegeTaskStatus } from '@/games/three-kingdoms/core/map/siege-task.types';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

export interface SiegeTaskPanelProps {
  /** 活跃的攻占任务列表 */
  tasks?: SiegeTask[];
  /** 点击任务项回调 */
  onSelectTask?: (task: SiegeTask) => void;
  /** 面板可见性 */
  visible?: boolean;
  /** 关闭回调 */
  onClose?: () => void;
  /** 实时城防比例（taskId -> ratio 0~1），用于攻城中进度条 */
  defenseRatios?: Record<string, number>;
  /** 回城行军预估到达时间（taskId -> timestamp ms） */
  returnETAs?: Record<string, number>;
  /** 点击任务项后聚焦到地图上的行军路线 */
  onFocusMarchRoute?: (taskId: string) => void;
}

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 扩展状态标签（含 failed） */
type ExtendedStatus = SiegeTaskStatus | 'failed';

const STATUS_LABELS: Record<ExtendedStatus, string> = {
  preparing: '准备中',
  marching: '行军中',
  sieging: '攻城中',
  settling: '结算中',
  returning: '回城中',
  completed: '已完成',
  failed: '失败',
};

const STATUS_COLORS: Record<ExtendedStatus, string> = {
  preparing: '#888',
  marching: '#4a9eff',
  sieging: '#4a9eff',
  settling: '#ffc107',
  returning: '#9c27b0',
  completed: '#4caf50',
  failed: '#f44336',
};

const STRATEGY_LABELS: Record<string, string> = {
  forceAttack: '强攻',
  siege: '围困',
  nightRaid: '夜袭',
  insider: '内应',
};

/** 已完成任务最大保留数 */
const MAX_COMPLETED_TASKS = 5;

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────

function formatDuration(ms: number): string {
  if (ms <= 0) return '即将到达';
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) return `${seconds}秒`;
  const minutes = Math.floor(seconds / 60);
  const remainSeconds = seconds % 60;
  return `${minutes}分${remainSeconds}秒`;
}

function formatEtaSeconds(seconds: number): string {
  if (seconds <= 0) return '即将到达';
  return `${seconds}秒`;
}

function getEta(task: SiegeTask): string {
  if (task.status === 'marching' && task.estimatedArrival) {
    const remaining = task.estimatedArrival - Date.now();
    return formatDuration(remaining);
  }
  return '';
}

function getStatusIcon(status: ExtendedStatus): string {
  switch (status) {
    case 'preparing': return '⏳';
    case 'marching': return '→';
    case 'sieging': return '⚔';
    case 'settling': return '📋';
    case 'returning': return '←';
    case 'completed': return '✓';
    case 'failed': return '✗';
  }
}

/**
 * 解析任务的实际显示状态（将 failed 的 completed 区分出来）
 */
function getDisplayStatus(task: SiegeTask): ExtendedStatus {
  if (task.status === 'completed' && task.result && !task.result.victory) {
    return 'failed';
  }
  return task.status;
}

/**
 * 格式化任务创建至今的经过时间
 */
function formatElapsedTime(createdAt: number): string {
  const elapsed = Date.now() - createdAt;
  if (elapsed < 0) return '刚刚';
  const seconds = Math.floor(elapsed / 1000);
  if (seconds < 60) return `${seconds}秒前`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
}

/**
 * 计算任务进度百分比（0~100）
 * - marching: 无预估数据时使用 50% 占位
 * - sieging: 进度 = 1 - (defenseRatios[taskId] ?? 1)
 * - returning: 基于 returnETAs 计算剩余时间（无数据时 50%）
 * - settling: 90%
 * - completed: 100%
 */
function getProgressPercent(
  task: SiegeTask,
  defenseRatios?: Record<string, number>,
  returnETAs?: Record<string, number>,
): number {
  switch (task.status) {
    case 'marching':
      return 50;
    case 'sieging': {
      const ratio = defenseRatios?.[task.id];
      if (ratio !== undefined) {
        return Math.min(100, Math.max(0, Math.round((1 - ratio) * 100)));
      }
      return 50;
    }
    case 'returning': {
      const eta = returnETAs?.[task.id];
      if (eta && task.returnCompletedAt === null) {
        const remaining = Math.max(0, Math.ceil((eta - Date.now()) / 1000));
        if (remaining <= 0) return 100;
        // Assume max return time is 120s for progress estimation
        const totalEstimate = 120;
        return Math.min(100, Math.max(0, Math.round(((totalEstimate - remaining) / totalEstimate) * 100)));
      }
      return 50;
    }
    case 'settling':
      return 90;
    case 'completed':
      return 100;
    default:
      return 0;
  }
}

// ─────────────────────────────────────────────
// 组件
// ─────────────────────────────────────────────

const SiegeTaskPanel: React.FC<SiegeTaskPanelProps> = ({
  tasks = [],
  onSelectTask,
  visible = true,
  onClose,
  defenseRatios,
  returnETAs,
  onFocusMarchRoute,
}) => {
  const [completedExpanded, setCompletedExpanded] = useState(false);

  const activeTasks = useMemo(
    () => tasks.filter((t) => t.status !== 'completed'),
    [tasks],
  );

  const completedTasks = useMemo(
    () => {
      const done = tasks.filter((t) => t.status === 'completed');
      // Sort by most recent first (using siegeCompletedAt or createdAt)
      done.sort((a, b) => (b.siegeCompletedAt ?? b.createdAt) - (a.siegeCompletedAt ?? a.createdAt));
      return done.slice(0, MAX_COMPLETED_TASKS);
    },
    [tasks],
  );

  const hasNoTasks = activeTasks.length === 0 && completedTasks.length === 0;

  if (!visible) return null;

  // 空状态：没有任何任务时显示引导提示
  if (hasNoTasks) {
    return (
      <div className="siege-task-panel" data-testid="siege-task-panel">
        <div className="siege-task-panel__header">
          <span className="siege-task-panel__title">
            攻占任务 (0)
          </span>
          {onClose && (
            <button
              className="siege-task-panel__close"
              onClick={onClose}
            >
              ✕
            </button>
          )}
        </div>
        <div
          className="siege-task-panel__empty-state"
          data-testid="siege-task-empty-state"
          style={{ color: '#999', textAlign: 'center', padding: '24px 16px' }}
        >
          选择敌方城市开始攻城
        </div>
      </div>
    );
  }

  return (
    <div className="siege-task-panel" data-testid="siege-task-panel">
      {/* 标题栏 */}
      <div className="siege-task-panel__header">
        <span className="siege-task-panel__title">
          攻占任务 ({activeTasks.length})
        </span>
        {onClose && (
          <button
            className="siege-task-panel__close"
            onClick={onClose}
          >
            ✕
          </button>
        )}
      </div>

      {/* 活跃任务列表 */}
      <div className="siege-task-panel__list">
        {activeTasks.map((task) => {
          const displayStatus = getDisplayStatus(task);
          return (
            <div
              key={task.id}
              className="siege-task-panel__item"
              onClick={() => onSelectTask?.(task)}
              data-testid={`task-item-${task.id}`}
            >
              {/* 状态指示（含状态图标） */}
              <div
                className="siege-task-panel__status"
                style={{ color: STATUS_COLORS[displayStatus] }}
              >
                <span
                  className="siege-task-panel__status-icon"
                  data-testid={`status-icon-${task.id}`}
                >
                  {getStatusIcon(displayStatus)}
                </span>
                {' '}
                {STATUS_LABELS[displayStatus]}
              </div>

              {/* 目标信息 */}
              <div className="siege-task-panel__target">
                <span className="siege-task-panel__target-name">
                  {task.targetName}
                </span>
                {task.strategy && (
                  <span className="siege-task-panel__strategy">
                    {STRATEGY_LABELS[task.strategy] ?? task.strategy}
                  </span>
                )}
              </div>

              {/* 编队摘要 */}
              <div
                className="siege-task-panel__formation-summary"
                data-testid={`formation-summary-${task.id}`}
              >
                ⚔ {task.expedition.heroName} × {task.expedition.troops}兵
              </div>

              {/* 编队信息（保留旧版兼容） */}
              <div className="siege-task-panel__expedition">
                <span>{task.expedition.heroName}</span>
                <span className="siege-task-panel__troops">
                  {task.expedition.troops}兵
                </span>
              </div>

              {/* 预计到达（行军中） */}
              {task.status === 'marching' && (
                <div className="siege-task-panel__eta">
                  预计 {getEta(task)}
                </div>
              )}

              {/* 回城 ETA（回城中） */}
              {task.status === 'returning' && returnETAs?.[task.id] && (() => {
                const remaining = Math.max(0, Math.ceil((returnETAs[task.id] - Date.now()) / 1000));
                return (
                  <div className="siege-task-panel__return-eta">
                    回城中 ETA: {formatEtaSeconds(remaining)}
                  </div>
                );
              })()}

              {/* 进度条（行军中 / 攻城中 / 回城中 / 结算中） */}
              {(task.status === 'marching' || task.status === 'sieging' || task.status === 'returning' || task.status === 'settling') && (
                <div className="siege-task-panel__progress">
                  <div
                    className="siege-task-panel__progress-bar"
                    style={{
                      backgroundColor: STATUS_COLORS[displayStatus],
                      width: `${getProgressPercent(task, defenseRatios, returnETAs)}%`,
                    }}
                  />
                </div>
              )}

              {/* 出发→目标路线 */}
              <div className="siege-task-panel__route">
                {task.sourceName} → {task.targetName}
              </div>

              {/* 任务创建时间 */}
              <div
                className="siege-task-panel__created-time"
                data-testid={`created-time-${task.id}`}
              >
                {formatElapsedTime(task.createdAt)}
              </div>

              {/* 聚焦行军路线按钮 */}
              {onFocusMarchRoute && (
                <button
                  className="siege-task-panel__focus-route"
                  onClick={(e) => {
                    e.stopPropagation();
                    onFocusMarchRoute(task.id);
                  }}
                >
                  聚焦路线
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* 已完成任务（保留展示最近 5 条） */}
      {completedTasks.length > 0 && (
        <div className="siege-task-panel__completed-section">
          <button
            className="siege-task-panel__completed-toggle"
            onClick={() => setCompletedExpanded((prev) => !prev)}
          >
            {completedExpanded ? '收起' : '展开'}已完成任务 ({completedTasks.length})
          </button>
          {completedExpanded && (
            <div className="siege-task-panel__completed-list">
              {completedTasks.map((task) => {
                const displayStatus = getDisplayStatus(task);
                return (
                  <div
                    key={task.id}
                    className="siege-task-panel__item siege-task-panel__item--completed"
                    style={{ opacity: 0.6 }}
                    data-testid={`task-item-completed-${task.id}`}
                  >
                    {/* 状态指示（含状态图标） */}
                    <div
                      className="siege-task-panel__status"
                      style={{ color: STATUS_COLORS[displayStatus] }}
                    >
                      <span
                        className="siege-task-panel__status-icon"
                        data-testid={`status-icon-completed-${task.id}`}
                      >
                        {getStatusIcon(displayStatus)}
                      </span>
                      {' '}
                      {STATUS_LABELS[displayStatus]}
                    </div>

                    {/* 目标信息 */}
                    <div className="siege-task-panel__target">
                      <span className="siege-task-panel__target-name">
                        {task.targetName}
                      </span>
                      {task.result && (
                        <span className="siege-task-panel__result-badge">
                          {task.result.victory ? '胜利' : '失败'}
                        </span>
                      )}
                    </div>

                    {/* 编队摘要 */}
                    <div
                      className="siege-task-panel__formation-summary"
                      data-testid={`formation-summary-completed-${task.id}`}
                    >
                      ⚔ {task.expedition.heroName} × {task.expedition.troops}兵
                    </div>

                    {/* 编队信息 */}
                    <div className="siege-task-panel__expedition">
                      <span>{task.expedition.heroName}</span>
                      <span className="siege-task-panel__troops">
                        {task.expedition.troops}兵
                      </span>
                    </div>

                    {/* 出发→目标路线 */}
                    <div className="siege-task-panel__route">
                      {task.sourceName} → {task.targetName}
                    </div>

                    {/* 任务创建时间 */}
                    <div
                      className="siege-task-panel__created-time"
                      data-testid={`created-time-completed-${task.id}`}
                    >
                      {formatElapsedTime(task.createdAt)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SiegeTaskPanel;
