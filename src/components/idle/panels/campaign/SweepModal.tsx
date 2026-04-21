/**
 * SweepModal — 扫荡弹窗
 *
 * 功能：
 * - 关卡选择 + 扫荡次数控制
 * - 扫荡令数量显示 + 消耗计算
 * - 批量扫荡结果展示（资源/经验/碎片）
 * - 自动推图开关
 * - 失败原因提示
 *
 * 引擎依赖：SweepSystem.sweep() / SweepSystem.autoPush()
 *
 * @module components/idle/panels/campaign/SweepModal
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import type { SweepBatchResult, AutoPushResult } from '@/games/three-kingdoms/engine/campaign/sweep.types';
import { DEFAULT_SWEEP_CONFIG } from '@/games/three-kingdoms/engine/campaign/sweep.types';
import './SweepModal.css';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────
export interface SweepModalProps {
  /** 关卡ID */
  stageId: string;
  /** 关卡名称 */
  stageName: string;
  /** 章节名称 */
  chapterName: string;
  /** 关卡星级 */
  stars: number;
  /** 当前扫荡令数量 */
  ticketCount: number;
  /** 是否可扫荡（三星通关） */
  canSweep: boolean;
  /** 不可扫荡原因 */
  cannotSweepReason?: string;
  /** 预计单次奖励（资源） */
  previewResources?: Partial<Record<string, number>>;
  /** 预计单次经验 */
  previewExp?: number;
  /** 关闭回调 */
  onClose: () => void;
  /** 确认扫荡回调 (stageId, count) => result */
  onSweep: (stageId: string, count: number) => SweepBatchResult;
  /** 自动推图回调 */
  onAutoPush?: () => AutoPushResult;
}

// ─────────────────────────────────────────────
// 资源类型显示配置
// ─────────────────────────────────────────────
const RESOURCE_DISPLAY: Record<string, { icon: string; label: string }> = {
  grain: { icon: '🌾', label: '粮草' },
  gold: { icon: '💰', label: '铜钱' },
  troops: { icon: '⚔️', label: '兵力' },
  mandate: { icon: '📜', label: '天命' },
  exp: { icon: '📚', label: '经验' },
};

/** 最大星级 */
const MAX_STARS = 3;

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────
const SweepModal: React.FC<SweepModalProps> = ({
  stageId,
  stageName,
  chapterName,
  stars,
  ticketCount,
  canSweep,
  cannotSweepReason,
  previewResources = {},
  previewExp = 0,
  onClose,
  onSweep,
  onAutoPush,
}) => {
  // ── ESC 键关闭 ──
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // ── 状态 ──
  const [sweepCount, setSweepCount] = useState(1);
  const [autoPushEnabled, setAutoPushEnabled] = useState(false);
  const [result, setResult] = useState<SweepBatchResult | null>(null);
  const [autoPushResult, setAutoPushResult] = useState<AutoPushResult | null>(null);

  const maxSweep = DEFAULT_SWEEP_CONFIG.maxSweepCount;
  const costPerRun = DEFAULT_SWEEP_CONFIG.sweepCostPerRun;
  const requiredTickets = sweepCount * costPerRun;
  const hasEnoughTickets = ticketCount >= requiredTickets;
  const canConfirm = canSweep && hasEnoughTickets && sweepCount > 0;

  // ── 计算预计奖励 ──
  const previewItems = useMemo(() => {
    const items: { icon: string; label: string; value: number }[] = [];
    for (const [key, amount] of Object.entries(previewResources)) {
      if (amount && amount > 0) {
        const display = RESOURCE_DISPLAY[key] || { icon: '📦', label: key };
        items.push({
          icon: display.icon,
          label: display.label,
          value: amount * sweepCount,
        });
      }
    }
    if (previewExp > 0) {
      items.push({
        icon: '📚',
        label: '经验',
        value: previewExp * sweepCount,
      });
    }
    return items;
  }, [previewResources, previewExp, sweepCount]);

  // ── 计算最大可扫荡次数 ──
  const maxAffordable = useMemo(() => {
    if (costPerRun <= 0) return maxSweep;
    return Math.min(maxSweep, Math.floor(ticketCount / costPerRun));
  }, [ticketCount, costPerRun, maxSweep]);

  // ── 事件处理 ──
  const handleDecrease = useCallback(() => {
    setSweepCount((prev) => Math.max(1, prev - 1));
  }, []);

  const handleIncrease = useCallback(() => {
    setSweepCount((prev) => Math.min(maxSweep, prev + 1));
  }, [maxSweep]);

  const handleMax = useCallback(() => {
    setSweepCount(Math.max(1, maxAffordable));
  }, [maxAffordable]);

  const handleConfirm = useCallback(() => {
    if (autoPushEnabled && onAutoPush) {
      const pushResult = onAutoPush();
      setAutoPushResult(pushResult);
    } else {
      const sweepResult = onSweep(stageId, sweepCount);
      setResult(sweepResult);
    }
  }, [autoPushEnabled, onAutoPush, onSweep, stageId, sweepCount]);

  // ── 渲染星级 ──
  const renderStars = () => {
    const elements: React.ReactNode[] = [];
    for (let i = 0; i < MAX_STARS; i++) {
      elements.push(
        <span key={i} className="tk-sweep-stage-star">
          {i < stars ? '★' : '☆'}
        </span>,
      );
    }
    return elements;
  };

  // ── 渲染资源结果 ──
  const renderResourceResults = (resources: Partial<Record<string, number>>) => {
    const entries = Object.entries(resources).filter(([, v]) => v && v > 0);
    if (entries.length === 0) return null;
    return (
      <div className="tk-sweep-results-summary">
        {entries.map(([key, amount]) => {
          const display = RESOURCE_DISPLAY[key] || { icon: '📦', label: key };
          return (
            <div key={key} className="tk-sweep-result-row">
              <span className="tk-sweep-result-label">
                {display.icon} {display.label}
              </span>
              <span className="tk-sweep-result-value">+{amount!.toLocaleString()}</span>
            </div>
          );
        })}
      </div>
    );
  };

  // ── 渲染碎片结果 ──
  const renderFragments = (fragments: Record<string, number>) => {
    const entries = Object.entries(fragments).filter(([, v]) => v > 0);
    if (entries.length === 0) return null;
    return (
      <div className="tk-sweep-fragments">
        {entries.map(([id, count]) => (
          <span key={id} className="tk-sweep-fragment-tag">
            💎 {id} ×{count}
          </span>
        ))}
      </div>
    );
  };

  // ── 渲染扫荡结果 ──
  const renderSweepResult = () => {
    if (!result) return null;

    if (!result.success) {
      return (
        <div className="tk-sweep-error">
          ❌ {result.failureReason || '扫荡失败'}
        </div>
      );
    }

    return (
      <div className="tk-sweep-results">
        <div className="tk-sweep-results-title">
          🎉 扫荡完成 ({result.executedCount}次)
        </div>
        {renderResourceResults(result.totalResources)}
        {result.totalExp > 0 && (
          <div className="tk-sweep-results-summary">
            <div className="tk-sweep-result-row tk-sweep-result-row--exp">
              <span className="tk-sweep-result-label">📚 经验</span>
              <span className="tk-sweep-result-value">+{result.totalExp.toLocaleString()}</span>
            </div>
            <div className="tk-sweep-result-row tk-sweep-result-row--tickets">
              <span className="tk-sweep-result-label">🎫 消耗扫荡令</span>
              <span className="tk-sweep-result-value">-{result.ticketsUsed}</span>
            </div>
          </div>
        )}
        {renderFragments(result.totalFragments)}
      </div>
    );
  };

  // ── 渲染自动推图结果 ──
  const renderAutoPushResult = () => {
    if (!autoPushResult) return null;

    return (
      <div className="tk-sweep-results">
        <div className="tk-sweep-results-title">
          🚀 自动推图完成
        </div>
        <div className="tk-sweep-results-summary">
          <div className="tk-sweep-result-row">
            <span className="tk-sweep-result-label">胜/败</span>
            <span className="tk-sweep-result-value">
              {autoPushResult.victories}/{autoPushResult.defeats}
            </span>
          </div>
          <div className="tk-sweep-result-row">
            <span className="tk-sweep-result-label">总尝试</span>
            <span className="tk-sweep-result-value">{autoPushResult.totalAttempts}</span>
          </div>
          <div className="tk-sweep-result-row tk-sweep-result-row--exp">
            <span className="tk-sweep-result-label">📚 经验</span>
            <span className="tk-sweep-result-value">+{autoPushResult.totalExp.toLocaleString()}</span>
          </div>
          <div className="tk-sweep-result-row tk-sweep-result-row--tickets">
            <span className="tk-sweep-result-label">🎫 扫荡令</span>
            <span className="tk-sweep-result-value">-{autoPushResult.ticketsUsed}</span>
          </div>
        </div>
        {renderResourceResults(autoPushResult.totalResources)}
        {renderFragments(autoPushResult.totalFragments)}
      </div>
    );
  };

  return (
    <div className="tk-sweep-overlay" role="dialog" aria-modal="true" aria-label="扫荡弹窗" onClick={onClose}>
      <div className="tk-sweep-modal" onClick={e => e.stopPropagation()}>
        {/* ── 标题栏 ── */}
        <div className="tk-sweep-header">
          <h3 className="tk-sweep-title">
            {chapterName} · {stageName} · 扫荡
          </h3>
          <button className="tk-sweep-close-btn" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>

        {/* ── 关卡信息 ── */}
        <div className="tk-sweep-stage-info">
          <span className="tk-sweep-stage-icon">⚔️</span>
          <div className="tk-sweep-stage-detail">
            <div className="tk-sweep-stage-name">{stageName}</div>
            <div className="tk-sweep-stage-stars">{renderStars()}</div>
          </div>
          <span className={`tk-sweep-status-badge ${canSweep ? 'tk-sweep-status-badge--ready' : 'tk-sweep-status-badge--locked'}`}>
            {canSweep ? '✓ 可扫荡' : '🔒 未解锁'}
          </span>
        </div>

        {/* ── 不可扫荡提示 ── */}
        {!canSweep && cannotSweepReason && (
          <div className="tk-sweep-error">{cannotSweepReason}</div>
        )}

        {/* ── 扫荡次数 ── */}
        {canSweep && (
          <div className="tk-sweep-count-section">
            <div className="tk-sweep-section-label">扫荡次数</div>
            <div className="tk-sweep-count-control">
              <button
                className="tk-sweep-count-btn"
                onClick={handleDecrease}
                disabled={sweepCount <= 1}
                aria-label="减少次数"
              >
                −
              </button>
              <div className="tk-sweep-count-display">{sweepCount}</div>
              <button
                className="tk-sweep-count-btn"
                onClick={handleIncrease}
                disabled={sweepCount >= maxSweep}
                aria-label="增加次数"
              >
                +
              </button>
              <button className="tk-sweep-max-btn" onClick={handleMax}>
                MAX {maxAffordable}
              </button>
            </div>
          </div>
        )}

        {/* ── 扫荡令 ── */}
        {canSweep && (
          <div className="tk-sweep-ticket-bar">
            <div className="tk-sweep-ticket-info">
              <span className="tk-sweep-ticket-icon">🎫</span>
              <span>扫荡令: <span className="tk-sweep-ticket-count">{ticketCount}</span></span>
            </div>
            <span className={`tk-sweep-ticket-cost ${!hasEnoughTickets ? 'tk-sweep-ticket-cost--insufficient' : ''}`}>
              需要 {requiredTickets}
            </span>
          </div>
        )}

        {/* ── 预计奖励 ── */}
        {canSweep && previewItems.length > 0 && !result && !autoPushResult && (
          <div className="tk-sweep-preview-section">
            <div className="tk-sweep-section-label">预计获得</div>
            <div className="tk-sweep-preview-list">
              {previewItems.map((item, idx) => (
                <div key={idx} className="tk-sweep-preview-item">
                  <span className="tk-sweep-preview-item-icon">{item.icon}</span>
                  <span className="tk-sweep-preview-item-value">+{item.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 自动推图开关 ── */}
        {canSweep && onAutoPush && (
          <div className="tk-sweep-auto-push">
            <span className="tk-sweep-auto-push-label">🚀 自动推图</span>
            <button
              className={`tk-sweep-toggle ${autoPushEnabled ? 'tk-sweep-toggle--active' : ''}`}
              onClick={() => setAutoPushEnabled((prev) => !prev)}
              role="switch"
              aria-checked={autoPushEnabled}
              aria-label="自动推图开关"
            >
              <span className="tk-sweep-toggle-knob" />
            </button>
          </div>
        )}

        {/* ── 扫荡结果 ── */}
        {renderSweepResult()}
        {renderAutoPushResult()}

        {/* ── 操作按钮 ── */}
        <div className="tk-sweep-actions">
          <button className="tk-sweep-btn tk-sweep-btn--cancel" onClick={onClose}>
            取消
          </button>
          <button
            className="tk-sweep-btn tk-sweep-btn--confirm"
            onClick={handleConfirm}
            disabled={!canConfirm || !!result || !!autoPushResult}
          >
            {autoPushEnabled ? '确认推图' : '确认扫荡'}
          </button>
        </div>
      </div>
    </div>
  );
};

SweepModal.displayName = 'SweepModal';

export default SweepModal;
