/**
 * 三国霸业 — 战斗速度控制组件
 *
 * 支持战斗速度调节：
 *   - X1/X2/X4 速度切换
 *   - 自动战斗开关
 *   - 当前速度状态显示
 *   - 速度变更事件监听
 *
 * 引擎依赖：engine/battle/ 下的 BattleSpeedController
 *
 * @module ui/components/battle/BattleSpeedControl
 */

import { useState, useMemo, useCallback } from 'react';
import { useGameContext } from '../../context/GameContext';

// ─────────────────────────────────────────────
// 类型
// ─────────────────────────────────────────────

/** 速度档位 */
type SpeedLevel = 1 | 2 | 4;

/** 速度控制状态 */
interface SpeedControlState {
  /** 当前速度 */
  currentSpeed: SpeedLevel;
  /** 是否自动战斗 */
  autoBattle: boolean;
  /** 是否暂停 */
  paused: boolean;
}

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 可用速度档位 */
const SPEED_LEVELS: SpeedLevel[] = [1, 2, 4];

/** 速度档位配置 */
const SPEED_CONFIG: Record<SpeedLevel, { label: string; color: string; interval: number }> = {
  1: { label: 'X1', color: '#a0a0a0', interval: 1000 },
  2: { label: 'X2', color: '#60a5fa', interval: 500 },
  4: { label: 'X4', color: '#fbbf24', interval: 250 },
};

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

export interface BattleSpeedControlProps {
  /** 速度变更回调 */
  onSpeedChange?: (speed: SpeedLevel) => void;
  /** 自动战斗变更回调 */
  onAutoBattleChange?: (auto: boolean) => void;
  /** 额外类名 */
  className?: string;
}

// ─────────────────────────────────────────────
// 纯逻辑管理器（用于测试）
// ─────────────────────────────────────────────

/**
 * SpeedControlLogic — 速度控制逻辑管理器
 *
 * 封装战斗速度控制的核心逻辑，不依赖 React DOM。
 */
export class SpeedControlLogic {
  private state: SpeedControlState;
  private availableSpeeds: SpeedLevel[];

  constructor(
    initialSpeed: SpeedLevel = 1,
    availableSpeeds: SpeedLevel[] = SPEED_LEVELS,
  ) {
    this.state = {
      currentSpeed: initialSpeed,
      autoBattle: false,
      paused: false,
    };
    this.availableSpeeds = availableSpeeds;
  }

  /** 获取当前速度 */
  getSpeed(): SpeedLevel {
    return this.state.currentSpeed;
  }

  /** 设置速度 */
  setSpeed(speed: SpeedLevel): { changed: boolean; previousSpeed: SpeedLevel } {
    if (!this.isValidSpeed(speed)) {
      return { changed: false, previousSpeed: this.state.currentSpeed };
    }
    if (this.state.currentSpeed === speed) {
      return { changed: false, previousSpeed: speed };
    }
    const previousSpeed = this.state.currentSpeed;
    this.state.currentSpeed = speed;
    return { changed: true, previousSpeed };
  }

  /** 循环切换速度 1→2→4→1 */
  cycleSpeed(): SpeedLevel {
    const currentIndex = this.availableSpeeds.indexOf(this.state.currentSpeed);
    const nextIndex = (currentIndex + 1) % this.availableSpeeds.length;
    this.state.currentSpeed = this.availableSpeeds[nextIndex];
    return this.state.currentSpeed;
  }

  /** 切换自动战斗 */
  toggleAutoBattle(): boolean {
    this.state.autoBattle = !this.state.autoBattle;
    return this.state.autoBattle;
  }

  /** 获取自动战斗状态 */
  isAutoBattle(): boolean {
    return this.state.autoBattle;
  }

  /** 暂停 */
  pause(): void {
    this.state.paused = true;
  }

  /** 恢复 */
  resume(): void {
    this.state.paused = false;
  }

  /** 获取暂停状态 */
  isPaused(): boolean {
    return this.state.paused;
  }

  /** 获取回合间隔（ms） */
  getTurnInterval(): number {
    return SPEED_CONFIG[this.state.currentSpeed].interval;
  }

  /** 获取动画速度缩放 */
  getAnimationSpeedScale(): number {
    return this.state.currentSpeed;
  }

  /** 是否需要简化特效 */
  shouldSimplifyEffects(): boolean {
    return this.state.currentSpeed >= 4;
  }

  /** 验证速度是否合法 */
  isValidSpeed(speed: number): boolean {
    return this.availableSpeeds.includes(speed as SpeedLevel);
  }

  /** 获取速度配置 */
  getSpeedConfig(): { label: string; color: string; interval: number } {
    return SPEED_CONFIG[this.state.currentSpeed];
  }

  /** 获取所有可用速度 */
  getAvailableSpeeds(): SpeedLevel[] {
    return [...this.availableSpeeds];
  }

  /** 获取完整状态 */
  getState(): SpeedControlState {
    return { ...this.state };
  }

  /** 重置 */
  reset(): void {
    this.state = { currentSpeed: 1, autoBattle: false, paused: false };
  }
}

// ─────────────────────────────────────────────
// 子组件：速度按钮
// ─────────────────────────────────────────────

interface SpeedButtonProps {
  level: SpeedLevel;
  isActive: boolean;
  onClick: () => void;
}

function SpeedButton({ level, isActive, onClick }: SpeedButtonProps) {
  const config = SPEED_CONFIG[level];
  return (
    <button
      style={{
        ...styles.speedBtn,
        borderColor: isActive ? config.color : 'rgba(255,255,255,0.1)',
        color: isActive ? config.color : '#a0a0a0',
        backgroundColor: isActive ? config.color + '15' : 'transparent',
      }}
      onClick={onClick}
      role="radio"
      aria-checked={isActive}
      aria-label={`${config.label}速度`}
    >
      {config.label}
    </button>
  );
}

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────

/**
 * BattleSpeedControl — 战斗速度控制组件
 *
 * @example
 * ```tsx
 * <BattleSpeedControl onSpeedChange={(s) => controller.setSpeed(s)} />
 * ```
 */
export function BattleSpeedControl({ onSpeedChange, onAutoBattleChange, className }: BattleSpeedControlProps) {
  const { engine } = useGameContext();
  const [speedState, setSpeedState] = useState<SpeedControlState>({
    currentSpeed: 1,
    autoBattle: false,
    paused: false,
  });

  // 创建逻辑实例
  const logic = useMemo(() => new SpeedControlLogic(speedState.currentSpeed), [speedState.currentSpeed]);

  const handleSpeedChange = useCallback((level: SpeedLevel) => {
    const result = logic.setSpeed(level);
    if (result.changed) {
      setSpeedState((prev) => ({ ...prev, currentSpeed: level }));
      onSpeedChange?.(level);
    }
  }, [logic, onSpeedChange]);

  const handleCycleSpeed = useCallback(() => {
    const newSpeed = logic.cycleSpeed();
    setSpeedState((prev) => ({ ...prev, currentSpeed: newSpeed }));
    onSpeedChange?.(newSpeed);
  }, [logic, onSpeedChange]);

  const handleToggleAuto = useCallback(() => {
    const auto = logic.toggleAutoBattle();
    setSpeedState((prev) => ({ ...prev, autoBattle: auto }));
    onAutoBattleChange?.(auto);
  }, [logic, onAutoBattleChange]);

  const handlePause = useCallback(() => {
    logic.pause();
    setSpeedState((prev) => ({ ...prev, paused: true }));
  }, [logic]);

  const handleResume = useCallback(() => {
    logic.resume();
    setSpeedState((prev) => ({ ...prev, paused: false }));
  }, [logic]);

  const speedConfig = SPEED_CONFIG[speedState.currentSpeed];

  return (
    <div
      style={styles.container}
      className={`tk-battle-speed ${className ?? ''}`.trim()}
      role="toolbar"
      aria-label="战斗速度控制"
    >
      {/* 速度档位 */}
      <div style={styles.speedGroup} role="radiogroup" aria-label="速度选择">
        {SPEED_LEVELS.map((level) => (
          <SpeedButton
            key={level}
            level={level}
            isActive={speedState.currentSpeed === level}
            onClick={() => handleSpeedChange(level)}
          />
        ))}
      </div>

      {/* 当前速度指示 */}
      <div style={{ ...styles.speedIndicator, color: speedConfig.color }}>
        {speedConfig.label} ({speedConfig.interval}ms)
      </div>

      {/* 暂停/恢复 */}
      <button
        style={styles.controlBtn}
        onClick={speedState.paused ? handleResume : handlePause}
        aria-label={speedState.paused ? '恢复' : '暂停'}
      >
        {speedState.paused ? '▶️' : '⏸️'}
      </button>

      {/* 自动战斗 */}
      <button
        style={{
          ...styles.controlBtn,
          ...(speedState.autoBattle ? styles.autoActive : {}),
        }}
        onClick={handleToggleAuto}
        aria-label={speedState.autoBattle ? '关闭自动战斗' : '开启自动战斗'}
        aria-pressed={speedState.autoBattle}
      >
        🤖 自动
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// 样式
// ─────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    background: 'rgba(13, 17, 23, 0.95)',
    borderBottom: '1px solid rgba(212, 165, 116, 0.3)',
    borderRadius: '8px',
    color: '#e8e0d0',
    fontSize: '13px',
  },
  speedGroup: {
    display: 'flex',
    gap: '4px',
  },
  speedBtn: {
    padding: '4px 10px',
    border: '1px solid',
    borderRadius: '4px',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 700,
    transition: 'all 0.15s ease',
    minWidth: '36px',
  },
  speedIndicator: {
    fontSize: '11px',
    fontWeight: 600,
    minWidth: '60px',
    textAlign: 'center',
  },
  controlBtn: {
    padding: '4px 8px',
    border: '1px solid rgba(212, 165, 116, 0.2)',
    borderRadius: '4px',
    background: 'transparent',
    color: '#e8e0d0',
    cursor: 'pointer',
    fontSize: '12px',
    transition: 'all 0.15s ease',
  },
  autoActive: {
    borderColor: '#4ade80',
    color: '#4ade80',
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
  },
};
