/**
 * TechResearchPanel — 研究队列面板
 *
 * 功能：
 * - 当前研究进度+倒计时
 * - 加速按钮（天命/元宝）
 * - 队列槽位显示
 * - 取消研究
 *
 * PC端：内嵌在科技树面板底部
 * 手机端：紧凑显示
 */

import React, { useState, useMemo, useCallback } from 'react';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import type { ResearchSlot } from '@/games/three-kingdoms/engine';
import { TECH_NODE_MAP } from '@/games/three-kingdoms/engine';
import './TechResearchPanel.css';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────
interface TechResearchPanelProps {
  engine: ThreeKingdomsEngine;
  snapshotVersion: number;
  tick: number;
}

// ─────────────────────────────────────────────
// 格式化剩余时间
// ─────────────────────────────────────────────
function formatRemaining(seconds: number): string {
  if (seconds <= 0) return '即将完成';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}时${m}分${s}秒`;
  }
  if (m > 0) {
    return `${m}分${s}秒`;
  }
  return `${s}秒`;
}

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────
const TechResearchPanel: React.FC<TechResearchPanelProps> = ({
  engine,
  snapshotVersion,
  tick,
}) => {
  const [expandedSlot, setExpandedSlot] = useState<string | null>(null);

  const researchSystem = engine.getTechResearchSystem();
  const treeSystem = engine.getTechTreeSystem();

  // ── 队列数据 ──
  const queue: ResearchSlot[] = useMemo(
    () => researchSystem.getQueue(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [snapshotVersion, tick],
  );

  const maxQueueSize = useMemo(
    () => researchSystem.getMaxQueueSize(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [snapshotVersion],
  );

  // ── 加速费用 ──
  const speedUpCosts = useMemo(() => {
    const costs: Record<string, { mandate: number; ingot: number }> = {};
    for (const slot of queue) {
      costs[slot.techId] = {
        mandate: researchSystem.calculateMandateCost(slot.techId),
        ingot: researchSystem.calculateIngotCost(slot.techId),
      };
    }
    return costs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshotVersion, tick]);

  // ── 处理加速 ──
  const handleSpeedUp = useCallback(
    (techId: string, method: 'mandate' | 'ingot') => {
      const costs = speedUpCosts[techId];
      if (!costs) return;
      const amount = method === 'mandate' ? costs.mandate : costs.ingot;
      if (amount <= 0) return;
      researchSystem.speedUp(techId, method, amount);
      setExpandedSlot(null);
    },
    [speedUpCosts, researchSystem],
  );

  // ── 处理取消 ──
  const handleCancel = useCallback(
    (techId: string) => {
      researchSystem.cancelResearch(techId);
      setExpandedSlot(null);
    },
    [researchSystem],
  );

  // ── 切换加速选项展开 ──
  const toggleExpand = useCallback((techId: string) => {
    setExpandedSlot((prev) => (prev === techId ? null : techId));
  }, []);

  // ── 渲染空槽位 ──
  const renderEmptySlot = (index: number) => (
    <div
      key={`empty-${index}`}
      className="tk-tech-research-slot tk-tech-research-slot--empty"
      data-testid={`research-slot-empty-${index}`}
    >
      <span className="tk-tech-research-slot-empty-text">
        空闲槽位 {index + 1}
      </span>
    </div>
  );

  // ── 渲染研究槽位 ──
  const renderSlot = (slot: ResearchSlot, index: number) => {
    const def = TECH_NODE_MAP.get(slot.techId);
    if (!def) return null;

    const progress = researchSystem.getResearchProgress(slot.techId);
    const remaining = researchSystem.getRemainingTime(slot.techId);
    const isActive = index === 0;
    const isExpanded = expandedSlot === slot.techId;
    const costs = speedUpCosts[slot.techId];

    return (
      <div
        key={slot.techId}
        className={`tk-tech-research-slot ${isActive ? 'tk-tech-research-slot--active' : ''}`}
        data-testid={`research-slot-${slot.techId}`}
      >
        {/* 头部 */}
        <div className="tk-tech-research-slot-header">
          <div className="tk-tech-research-slot-name">
            <span className="tk-tech-research-slot-icon">{def.icon}</span>
            <span>{def.name}</span>
          </div>
          <span className="tk-tech-research-slot-percent">
            {Math.round(progress * 100)}%
          </span>
        </div>

        {/* 进度条 */}
        <div className="tk-tech-research-progress">
          <div
            className="tk-tech-research-progress-fill"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>

        {/* 底部 */}
        <div className="tk-tech-research-slot-footer">
          <span className="tk-tech-research-remaining">
            ⏱️ {formatRemaining(remaining)}
          </span>
          <div className="tk-tech-research-actions">
            <button
              className="tk-tech-research-action-btn tk-tech-research-action-btn--speedup"
              onClick={() => toggleExpand(slot.techId)}
              data-testid={`research-speedup-toggle-${slot.techId}`}
            >
              加速
            </button>
            <button
              className="tk-tech-research-action-btn tk-tech-research-action-btn--cancel"
              onClick={() => handleCancel(slot.techId)}
              data-testid={`research-cancel-${slot.techId}`}
            >
              取消
            </button>
          </div>
        </div>

        {/* 加速选项 */}
        {isExpanded && costs && (
          <div className="tk-tech-speedup-options" data-testid={`speedup-options-${slot.techId}`}>
            {costs.mandate > 0 && (
              <div
                className="tk-tech-speedup-option"
                onClick={() => handleSpeedUp(slot.techId, 'mandate')}
                data-testid={`speedup-mandate-${slot.techId}`}
              >
                <span className="tk-tech-speedup-option-label">
                  👑 天命加速
                </span>
                <span className="tk-tech-speedup-option-cost">
                  ×{costs.mandate}
                </span>
              </div>
            )}
            {costs.ingot > 0 && (
              <div
                className="tk-tech-speedup-option"
                onClick={() => handleSpeedUp(slot.techId, 'ingot')}
                data-testid={`speedup-ingot-${slot.techId}`}
              >
                <span className="tk-tech-speedup-option-label">
                  💎 元宝秒完成
                </span>
                <span className="tk-tech-speedup-option-cost">
                  ×{costs.ingot}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="tk-tech-research-panel" data-testid="tech-research-panel">
      {/* 标题 */}
      <div className="tk-tech-research-title">
        <span className="tk-tech-research-title-text">🔬 研究队列</span>
        <span className="tk-tech-research-title-slots">
          {queue.length}/{maxQueueSize}
        </span>
      </div>

      {/* 研究槽位 */}
      {queue.map((slot, idx) => renderSlot(slot, idx))}

      {/* 空闲槽位 */}
      {Array.from({ length: Math.max(0, maxQueueSize - queue.length) }, (_, i) =>
        renderEmptySlot(queue.length + i),
      )}
    </div>
  );
};

export default TechResearchPanel;
