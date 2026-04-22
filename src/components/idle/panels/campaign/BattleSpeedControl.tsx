/**
 * BattleSpeedControl — 战斗加速控件
 *
 * 提供三档速度切换（1x / 2x / 4x），支持禁用状态和速度指示器。
 */
import React, { useCallback, useMemo } from 'react';
import './BattleSpeedControl.css';

/** 速度等级类型 */
export type BattleSpeedLevel = 1 | 2 | 4;

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

const SPEED_LEVELS: BattleSpeedLevel[] = [1, 2, 4];

const BattleSpeedControl: React.FC<BattleSpeedControlProps> = ({
  currentSpeed,
  onSpeedChange,
  disabled = false,
  showIndicator = false,
}) => {
  const handleClick = useCallback(
    (speed: BattleSpeedLevel) => {
      if (!disabled && speed !== currentSpeed) {
        onSpeedChange(speed);
      }
    },
    [disabled, currentSpeed, onSpeedChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, speed: BattleSpeedLevel) => {
      if ((e.key === 'Enter' || e.key === ' ') && !disabled && speed !== currentSpeed) {
        e.preventDefault();
        onSpeedChange(speed);
      }
    },
    [disabled, currentSpeed, onSpeedChange],
  );

  return (
    <div data-testid="battle-speed-control" role="radiogroup">
      {SPEED_LEVELS.map((speed) => {
        const isActive = currentSpeed === speed;
        const isFast = speed === 4;
        const classNames = [
          'tk-speed-btn',
          isActive ? 'tk-speed-btn--active' : '',
          isFast ? 'tk-speed-btn--fast' : '',
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <button
            key={speed}
            data-testid={`speed-btn-${speed}x`}
            className={classNames}
            role="radio"
            aria-checked={isActive ? 'true' : 'false'}
            disabled={disabled}
            onClick={() => handleClick(speed)}
            onKeyDown={(e) => handleKeyDown(e, speed)}
          >
            {speed}x
          </button>
        );
      })}
      {showIndicator && (
        <span className="tk-speed-indicator">
          ⏩ <span className="tk-speed-indicator-value">{currentSpeed}x</span>
        </span>
      )}
    </div>
  );
};

export default BattleSpeedControl;
