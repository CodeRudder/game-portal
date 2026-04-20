/**
 * TechOfflinePanel — 离线研究面板
 *
 * 功能：
 * - 显示离线期间完成的研究列表
 * - 显示已获得但未分配的科技点
 * - 科技重置按钮（退还已研究科技的资源）
 * - 离线研究进度预览
 *
 * @module components/idle/panels/tech/TechOfflinePanel
 */

import React, { useMemo, useState } from 'react';
import Modal from '../../common/Modal';
import './TechOfflinePanel.css';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────
export interface TechOfflineReport {
  /** 离线时长（秒） */
  offlineSeconds: number;
  /** 离线期间完成的研究ID列表 */
  completedTechIds: string[];
  /** 离线期间获得的效果汇总 */
  effectsGained: Record<string, number>;
  /** 累计科技点 */
  techPoints: number;
}

export interface TechOfflinePanelProps {
  /** 是否显示 */
  visible: boolean;
  /** 离线报告数据 */
  report: TechOfflineReport | null;
  /** 当前已研究科技列表 */
  researchedTechs: Array<{ id: string; name: string }>;
  /** 科技重置回调 */
  onResetTech?: () => void;
  /** 关闭面板回调 */
  onClose: () => void;
  /** 分配科技点回调 */
  onAllocatePoints?: (points: number) => void;
}

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}秒`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分${Math.floor(seconds % 60)}秒`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}时${m}分`;
}

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────
const TechOfflinePanel: React.FC<TechOfflinePanelProps> = ({
  visible,
  report,
  researchedTechs,
  onResetTech,
  onClose,
  onAllocatePoints,
}) => {
  const [confirmReset, setConfirmReset] = useState(false);

  // ── 离线效果列表 ──
  const effectEntries = useMemo(() => {
    if (!report?.effectsGained) return [];
    return Object.entries(report.effectsGained).filter(([, v]) => v !== 0);
  }, [report]);

  // ── 重置确认 ──
  const handleResetClick = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    onResetTech?.();
    setConfirmReset(false);
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      type="info"
      title="📚 离线研究报告"
      cancelText="关闭"
      onCancel={onClose}
      width="460px"
    >
      <div className="tk-tech-offline" data-testid="tech-offline-panel">
        {report ? (
          <>
            {/* ── 离线时长 ── */}
            <div className="tk-tech-offline-duration" data-testid="offline-duration">
              <span className="tk-tech-offline-duration-icon">⏱️</span>
              <span className="tk-tech-offline-duration-text">
                离线时长: <strong>{formatDuration(report.offlineSeconds)}</strong>
              </span>
            </div>

            {/* ── 完成的研究 ── */}
            {report.completedTechIds.length > 0 && (
              <div className="tk-tech-offline-section">
                <h4 className="tk-tech-offline-section-title">
                  ✅ 离线完成的研究 ({report.completedTechIds.length})
                </h4>
                <div className="tk-tech-offline-tech-list">
                  {report.completedTechIds.map((id) => {
                    const tech = researchedTechs.find((t) => t.id === id);
                    return (
                      <div key={id} className="tk-tech-offline-tech-item" data-testid={`offline-tech-${id}`}>
                        <span className="tk-tech-offline-tech-icon">🔬</span>
                        <span className="tk-tech-offline-tech-name">{tech?.name ?? id}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── 获得效果 ── */}
            {effectEntries.length > 0 && (
              <div className="tk-tech-offline-section">
                <h4 className="tk-tech-offline-section-title">📊 获得效果加成</h4>
                <div className="tk-tech-offline-effects">
                  {effectEntries.map(([key, value]) => (
                    <div key={key} className="tk-tech-offline-effect-item" data-testid={`offline-effect-${key}`}>
                      <span className="tk-tech-offline-effect-key">{key}</span>
                      <span className="tk-tech-offline-effect-value">
                        {value > 0 ? '+' : ''}{(value * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── 科技点 ── */}
            {report.techPoints > 0 && (
              <div className="tk-tech-offline-points" data-testid="offline-points">
                <span className="tk-tech-offline-points-icon">💎</span>
                <span className="tk-tech-offline-points-text">
                  获得科技点: <strong>{report.techPoints}</strong>
                </span>
                {onAllocatePoints && (
                  <button
                    className="tk-tech-offline-allocate-btn"
                    data-testid="allocate-points-btn"
                    onClick={() => onAllocatePoints(report.techPoints)}
                  >
                    分配
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="tk-tech-offline-empty" data-testid="offline-empty">
            暂无离线研究数据
          </div>
        )}

        {/* ── 科技重置 ── */}
        {researchedTechs.length > 0 && onResetTech && (
          <div className="tk-tech-offline-reset" data-testid="tech-reset-section">
            <div className="tk-tech-offline-reset-info">
              <span className="tk-tech-offline-reset-label">已研究科技: {researchedTechs.length} 项</span>
              <span className="tk-tech-offline-reset-hint">重置将退还所有已研究科技的资源消耗</span>
            </div>
            <button
              className={`tk-tech-offline-reset-btn ${confirmReset ? 'tk-tech-offline-reset-btn--confirm' : ''}`}
              data-testid="tech-reset-btn"
              onClick={handleResetClick}
            >
              {confirmReset ? '⚠️ 确认重置？' : '🔄 重置科技树'}
            </button>
            {confirmReset && (
              <button
                className="tk-tech-offline-reset-cancel"
                data-testid="tech-reset-cancel"
                onClick={() => setConfirmReset(false)}
              >
                取消
              </button>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default TechOfflinePanel;
