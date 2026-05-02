/**
 * BattlePauseMenu — 战斗暂停菜单
 *
 * 功能：
 * - 右上角暂停按钮触发
 * - 半透明遮罩 + 居中菜单面板
 * - 菜单选项：继续战斗 / 查看战斗日志 / 放弃战斗
 * - 键盘 ESC 触发暂停/恢复
 * - 三国古风视觉风格（无neon/glow）
 *
 * @module components/idle/panels/campaign/BattlePauseMenu
 */

import React, { useEffect, useCallback } from 'react';
import './BattlePauseMenu.css';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

export interface BattlePauseMenuProps {
  /** 是否已暂停 */
  paused: boolean;
  /** 暂停状态切换回调 */
  onTogglePause: () => void;
  /** 查看战斗日志回调 */
  onViewLog: () => void;
  /** 放弃战斗回调 */
  onQuit: () => void;
  /** 是否禁用（战斗结束时） */
  disabled?: boolean;
}

// ─────────────────────────────────────────────
// 组件
// ─────────────────────────────────────────────

const BattlePauseMenu: React.FC<BattlePauseMenuProps> = ({
  paused,
  onTogglePause,
  onViewLog,
  onQuit,
  disabled = false,
}) => {
  // ── ESC 键监听 ──
  useEffect(() => {
    if (disabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onTogglePause();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onTogglePause, disabled]);

  // ── 查看日志：关闭暂停菜单并展开日志 ──
  const handleViewLog = useCallback(() => {
    onViewLog();
  }, [onViewLog]);

  // ── 放弃战斗 ──
  const handleQuit = useCallback(() => {
    onQuit();
  }, [onQuit]);

  return (
    <>
      {/* 右上角暂停按钮 */}
      {!disabled && (
        <button
          className="tk-pause-btn"
          onClick={onTogglePause}
          aria-label={paused ? '恢复战斗' : '暂停战斗'}
          data-testid="battle-pause-btn"
        >
          {paused ? '▶' : '⏸'}
        </button>
      )}

      {/* 暂停菜单遮罩 + 面板 */}
      {paused && (
        <div className="tk-pause-overlay" data-testid="battle-pause-overlay">
          <div className="tk-pause-panel" role="dialog" aria-label="暂停菜单">
            <div className="tk-pause-title">暂 停</div>

            <div className="tk-pause-options">
              <button
                className="tk-pause-option"
                onClick={onTogglePause}
                data-testid="battle-pause-resume"
              >
                <span className="tk-pause-option-icon">⚔</span>
                <span className="tk-pause-option-text">继续战斗</span>
              </button>

              <button
                className="tk-pause-option"
                onClick={handleViewLog}
                data-testid="battle-pause-log"
              >
                <span className="tk-pause-option-icon">📜</span>
                <span className="tk-pause-option-text">查看战斗日志</span>
              </button>

              <button
                className="tk-pause-option tk-pause-option--danger"
                onClick={handleQuit}
                data-testid="battle-pause-quit"
              >
                <span className="tk-pause-option-icon">🚪</span>
                <span className="tk-pause-option-text">放弃战斗</span>
              </button>
            </div>

            <div className="tk-pause-hint">按 ESC 继续</div>
          </div>
        </div>
      )}
    </>
  );
};

BattlePauseMenu.displayName = 'BattlePauseMenu';
export default BattlePauseMenu;
