/**
 * SweepModal — 扫荡弹窗组件
 *
 * 提供关卡扫荡功能：次数控制、扫荡令消耗、预计奖励、自动推图开关。
 * 仅当关卡三星通关后才可扫荡。
 *
 * 设计风格：水墨江山·铜纹霸业
 */
import React, { useState, useCallback } from 'react';
import './SweepModal.css';
import type { SweepBatchResult } from '@/games/three-kingdoms/engine/campaign/sweep.types';

/** 扫荡弹窗 Props */
export interface SweepModalProps {
  /** 关卡ID */
  stageId: string;
  /** 关卡名称 */
  stageName: string;
  /** 章节名称 */
  chapterName: string;
  /** 当前星级（0-3） */
  stars: number;
  /** 扫荡令数量 */
  ticketCount: number;
  /** 是否可扫荡 */
  canSweep: boolean;
  /** 不可扫荡原因 */
  cannotSweepReason?: string;
  /** 预计资源奖励 */
  previewResources?: Partial<Record<string, number>>;
  /** 预计经验奖励 */
  previewExp?: number;
  /** 关闭回调 */
  onClose: () => void;
  /** 执行扫荡回调，返回批量结果 */
  onSweep: (stageId: string, count: number) => SweepBatchResult;
  /** 自动推图回调（不传则不显示开关） */
  onAutoPush?: (stageId: string) => void;
}

/** 单次扫荡消耗扫荡令数量 */
const COST_PER_RUN = 1;

const SweepModal: React.FC<SweepModalProps> = ({
  stageId,
  stageName,
  chapterName,
  stars,
  ticketCount,
  canSweep,
  cannotSweepReason,
  previewResources,
  previewExp,
  onClose,
  onSweep,
  onAutoPush,
}) => {
  const [count, setCount] = useState(1);
  const [autoPush, setAutoPush] = useState(false);
  const [result, setResult] = useState<SweepBatchResult | null>(null);

  const maxCount = ticketCount;

  const handleIncrease = useCallback(() => {
    setCount((prev) => Math.min(prev + 1, maxCount));
  }, [maxCount]);

  const handleDecrease = useCallback(() => {
    setCount((prev) => Math.max(prev - 1, 1));
  }, []);

  const handleMax = useCallback(() => {
    setCount(maxCount);
  }, [maxCount]);

  const handleConfirm = useCallback(() => {
    const sweepResult = onSweep(stageId, count);
    setResult(sweepResult);
  }, [onSweep, stageId, count]);

  const handleAutoPushToggle = useCallback(() => {
    setAutoPush((prev) => !prev);
  }, []);

  const isConfirmDisabled = !canSweep || ticketCount < COST_PER_RUN;

  return (
    <div className="tk-sweep-overlay">
      <div className="tk-sweep-modal">
        {/* ── 头部 ── */}
        <div className="tk-sweep-header">
          <h2 className="tk-sweep-title">
            {chapterName} · {stageName} · 扫荡
          </h2>
          <button
            className="tk-sweep-close"
            aria-label="关闭"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* ── 关卡信息 ── */}
        <div className="tk-sweep-stage-info">
          <span className="tk-sweep-stage-name">{stageName}</span>
          <span className="tk-sweep-stars">
            {Array.from({ length: 3 }, (_, i) => (
              <span key={i} className={i < stars ? 'tk-star--filled' : 'tk-star--empty'}>
                {i < stars ? '★' : '☆'}
              </span>
            ))}
          </span>
        </div>

        {/* ── 扫荡状态 ── */}
        <div className="tk-sweep-status">
          {canSweep ? (
            <span className="tk-sweep-status--available">✓ 可扫荡</span>
          ) : (
            <>
              <span className="tk-sweep-status--locked">🔒 未解锁</span>
              {cannotSweepReason && (
                <span className="tk-sweep-reason">{cannotSweepReason}</span>
              )}
            </>
          )}
        </div>

        {/* ── 扫荡令 ── */}
        <div className="tk-sweep-tickets">
          <span className="tk-sweep-ticket-label">扫荡令</span>
          <span className="tk-sweep-ticket-count">{ticketCount}</span>
          <span
            className={
              ticketCount < COST_PER_RUN
                ? 'tk-sweep-ticket-cost tk-sweep-ticket-cost--insufficient'
                : 'tk-sweep-ticket-cost'
            }
          >
            消耗: {count}
          </span>
        </div>

        {/* ── 次数控制 ── */}
        {canSweep && (
          <div className="tk-sweep-count-control">
            <button
              className="tk-sweep-count-btn"
              aria-label="减少次数"
              disabled={count <= 1}
              onClick={handleDecrease}
            >
              −
            </button>
            <span className="tk-sweep-count-display">{count}</span>
            <button
              className="tk-sweep-count-btn"
              aria-label="增加次数"
              disabled={count >= maxCount}
              onClick={handleIncrease}
            >
              +
            </button>
            <button className="tk-sweep-max-btn" onClick={handleMax}>
              MAX
            </button>
          </div>
        )}

        {/* ── 预计奖励 ── */}
        {previewResources && canSweep && (
          <div className="tk-sweep-preview">
            <h3 className="tk-sweep-preview-title">预计获得</h3>
            <div className="tk-sweep-preview-resources">
              {Object.entries(previewResources).map(([key, value]) => (
                <span key={key} className="tk-sweep-preview-item">
                  {key}: {typeof value === 'number' ? value * count : value}
                </span>
              ))}
              {previewExp && (
                <span className="tk-sweep-preview-item">
                  exp: {previewExp * count}
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── 扫荡结果 ── */}
        {result && (
          <div className="tk-sweep-result">
            {result.success ? (
              <div className="tk-sweep-result--success">
                <span>扫荡完成！执行 {result.executedCount} 次</span>
                <div className="tk-sweep-result-details">
                  {Object.entries(result.totalResources).map(([key, value]) => (
                    <span key={key}>{key}: {value}</span>
                  ))}
                  {result.totalExp > 0 && <span>exp: {result.totalExp}</span>}
                </div>
              </div>
            ) : (
              <div className="tk-sweep-result--fail">
                扫荡失败：{result.failureReason}
              </div>
            )}
          </div>
        )}

        {/* ── 自动推图开关 ── */}
        {onAutoPush && (
          <div className="tk-sweep-auto-push">
            <span>🚀 自动推图</span>
            <button
              role="switch"
              aria-checked={autoPush ? 'true' : 'false'}
              aria-label="自动推图开关"
              className="tk-sweep-auto-push-toggle"
              onClick={handleAutoPushToggle}
            >
              <span className="tk-sweep-auto-push-thumb" />
            </button>
          </div>
        )}

        {/* ── 操作按钮 ── */}
        <div className="tk-sweep-actions">
          <button className="tk-sweep-btn tk-sweep-btn--cancel" onClick={onClose}>
            取消
          </button>
          <button
            className="tk-sweep-btn tk-sweep-btn--confirm"
            disabled={isConfirmDisabled}
            onClick={handleConfirm}
          >
            确认扫荡
          </button>
        </div>
      </div>
    </div>
  );
};

export default SweepModal;
