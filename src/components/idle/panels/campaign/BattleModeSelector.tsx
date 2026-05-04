/**
 * BattleModeSelector — 战斗模式选择器
 *
 * 提供三种战斗模式切换：全自动 / 半自动 / 全手动
 * - 全自动(AUTO)：系统自动释放所有技能
 * - 半自动(SEMI_AUTO)：普攻自动，大招就绪时触发时停，玩家选择释放时机
 * - 全手动(MANUAL)：每个技能需手动选择目标和释放
 *
 * 默认全自动，战斗进行中可切换。
 *
 * 设计风格：水墨江山·铜纹霸业（无neon/glow/脉冲动画）
 *
 * @module components/idle/panels/campaign/BattleModeSelector
 */

import React, { useCallback } from 'react';
import { BattleMode } from '@/games/three-kingdoms/engine';
import './BattleModeSelector.css';

// ─────────────────────────────────────────────
// 类型
// ─────────────────────────────────────────────

export interface BattleModeSelectorProps {
  /** 当前战斗模式 */
  currentMode: BattleMode;
  /** 模式变更回调 */
  onModeChange: (mode: BattleMode) => void;
  /** 是否禁用（战斗结束时禁用） */
  disabled?: boolean;
}

/** 模式配置 */
interface ModeConfig {
  mode: BattleMode;
  label: string;
  icon: string;
  description: string;
  testId: string;
}

// ─────────────────────────────────────────────
// 模式配置表
// ─────────────────────────────────────────────

const MODE_CONFIGS: ModeConfig[] = [
  {
    mode: BattleMode.AUTO,
    label: '全自动',
    icon: '⚔',
    description: '系统自动释放所有技能',
    testId: 'battle-mode-auto',
  },
  {
    mode: BattleMode.SEMI_AUTO,
    label: '半自动',
    icon: '⚡',
    description: '大招就绪时暂停，手动选择释放时机',
    testId: 'battle-mode-semi-auto',
  },
  {
    mode: BattleMode.MANUAL,
    label: '全手动',
    icon: '🎯',
    description: '所有技能需手动选择目标和释放',
    testId: 'battle-mode-manual',
  },
];

// ─────────────────────────────────────────────
// 组件
// ─────────────────────────────────────────────

/**
 * 战斗模式选择器
 *
 * 三按钮横排布局，当前模式高亮显示。
 * 切换时通知父组件更新 BattleEngine 的 battleMode。
 */
const BattleModeSelector: React.FC<BattleModeSelectorProps> = ({
  currentMode,
  onModeChange,
  disabled = false,
}) => {
  const handleClick = useCallback(
    (mode: BattleMode) => {
      if (!disabled && mode !== currentMode) {
        onModeChange(mode);
      }
    },
    [disabled, currentMode, onModeChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, mode: BattleMode) => {
      if ((e.key === 'Enter' || e.key === ' ') && !disabled && mode !== currentMode) {
        e.preventDefault();
        onModeChange(mode);
      }
    },
    [disabled, currentMode, onModeChange],
  );

  return (
    <div
      className="tk-mode-selector"
      data-testid="battle-mode-selector"
      role="radiogroup"
      aria-label="战斗模式选择"
    >
      {MODE_CONFIGS.map((config) => {
        const isActive = currentMode === config.mode;
        const classNames = [
          'tk-mode-btn',
          isActive ? 'tk-mode-btn--active' : '',
          `tk-mode-btn--${config.mode.toLowerCase()}`,
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <button
            key={config.mode}
            data-testid={config.testId}
            className={classNames}
            role="radio"
            aria-checked={isActive ? 'true' : 'false'}
            aria-label={`${config.label}：${config.description}`}
            disabled={disabled}
            onClick={() => handleClick(config.mode)}
            onKeyDown={(e) => handleKeyDown(e, config.mode)}
            title={config.description}
          >
            <span className="tk-mode-btn__icon">{config.icon}</span>
            <span className="tk-mode-btn__label">{config.label}</span>
          </button>
        );
      })}
    </div>
  );
};

BattleModeSelector.displayName = 'BattleModeSelector';
export default BattleModeSelector;
