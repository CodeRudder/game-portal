/**
 * BattleSpeedControl — 战斗加速控件
 *
 * 功能：
 * - 1x / 2x / 4x 三档速度切换
 * - 当前速度高亮显示
 * - 4x 速度特殊视觉标识（红色脉冲）
 * - 速度变更回调
 * - 可集成到 BattleScene 顶部控制栏
 *
 * 使用方式：
 * 1. 独立使用：传入 currentSpeed + onSpeedChange
 * 2. 集成到 BattleScene：替换原有单按钮 toggleSpeed
 *
 * @module components/idle/panels/campaign/BattleSpeedControl
 */

import React, { useCallback } from 'react';
import './BattleSpeedControl.css';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

/** 速度档位 */
export type BattleSpeedLevel = 1 | 2 | 4;

/** 速度配置项 */
export interface SpeedOption {
  level: BattleSpeedLevel;
  label: string;
}

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────
export interface BattleSpeedControlProps {
  /** 当前速度 */
  currentSpeed: BattleSpeedLevel;
  /** 速度变更回调 */
  onSpeedChange: (speed: BattleSpeedLevel) => void;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否显示速度指示器 */
  showIndicator?: boolean;
}

// ─────────────────────────────────────────────
// 速度选项配置
// ─────────────────────────────────────────────
const SPEED_OPTIONS: SpeedOption[] = [
  { level: 1, label: '1x' },
  { level: 2, label: '2x' },
  { level: 4, label: '4x' },
];

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────
const BattleSpeedControl: React.FC<BattleSpeedControlProps> = ({
  currentSpeed,
  onSpeedChange,
  disabled = false,
  showIndicator = false,
}) => {
  // ── 速度切换 ──
  const handleSpeedClick = useCallback(
    (level: BattleSpeedLevel) => {
      if (!disabled && level !== currentSpeed) {
        onSpeedChange(level);
      }
    },
    [currentSpeed, disabled, onSpeedChange],
  );

  // ── 键盘支持 ──
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, level: BattleSpeedLevel) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleSpeedClick(level);
      }
    },
    [handleSpeedClick],
  );

  return (
    <div className="tk-speed-control" role="radiogroup" aria-label="战斗速度" data-testid="battle-speed-control">
      {/* 速度指示器 */}
      {showIndicator && (
        <div className="tk-speed-indicator">
          <span className="tk-speed-indicator-icon">⏩</span>
          <span className="tk-speed-indicator-value">{currentSpeed}x</span>
        </div>
      )}

      {showIndicator && <div className="tk-speed-divider" />}

      {/* 速度按钮组 */}
      {SPEED_OPTIONS.map((option) => {
        const isActive = currentSpeed === option.level;
        const isFast = option.level === 4;

        return (
          <button
            key={option.level}
            className={[
              'tk-speed-btn',
              isActive ? 'tk-speed-btn--active' : '',
              isActive && isFast ? 'tk-speed-btn--fast' : '',
            ].filter(Boolean).join(' ')}
            onClick={() => handleSpeedClick(option.level)}
            onKeyDown={(e) => handleKeyDown(e, option.level)}
            disabled={disabled}
            role="radio"
            aria-checked={isActive}
            aria-label={`${option.level}倍速`}
            data-testid={`speed-btn-${option.level}x`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};

BattleSpeedControl.displayName = 'BattleSpeedControl';

export default BattleSpeedControl;
