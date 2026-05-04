/**
 * BattleEnterExitAnimation — 战斗进入/退出动画组件
 *
 * 功能：
 * - 进入动画：渐入 + 武将滑入 + "第X回合"文字
 * - 退出动画分三套：
 *   - 胜利：金色光效 + "大获全胜"文字
 *   - 失败：暗色 + "战败"文字
 *   - 平局：中性 + "势均力敌"文字
 * - 动画时长1-2秒，不循环不脉冲
 * - 通过 props 控制播放
 *
 * @module components/idle/panels/campaign/BattleEnterExitAnimation
 */

import React, { useEffect, useState, useCallback } from 'react';
import './BattleEnterExitAnimation.css';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

/** 动画阶段 */
export type AnimationPhase = 'idle' | 'entering' | 'active' | 'exiting' | 'done';

/** 退出动画结果类型 */
export type ExitResult = 'victory' | 'defeat' | 'draw';

export interface BattleEnterExitAnimationProps {
  /** 当前动画阶段 */
  phase: AnimationPhase;
  /** 退出动画结果类型（phase=exiting 时生效） */
  exitResult?: ExitResult;
  /** 回合数（进入动画显示用） */
  turnNumber?: number;
  /** 我方武将名称列表（进入动画滑入用） */
  allyNames?: string[];
  /** 敌方武将名称列表（进入动画滑入用） */
  enemyNames?: string[];
  /** 动画完成回调 */
  onAnimationComplete?: () => void;
}

// ─────────────────────────────────────────────
// 进入动画子组件
// ─────────────────────────────────────────────

const EnterAnimation: React.FC<{
  turnNumber: number;
  allyNames: string[];
  enemyNames: string[];
  onComplete: () => void;
}> = ({ turnNumber, allyNames, enemyNames, onComplete }) => {
  // 整体动画 1.8s 后自动完成
  useEffect(() => {
    const timer = setTimeout(onComplete, 1800);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="tk-battle-anim tk-battle-anim--enter" data-testid="battle-anim-enter">
      {/* 背景渐入 */}
      <div className="tk-battle-anim__bg" />

      {/* 我方武将滑入（从左侧） */}
      <div className="tk-battle-anim__ally-slide">
        {allyNames.slice(0, 3).map((name, i) => (
          <span
            key={i}
            className="tk-battle-anim__hero tk-battle-anim__hero--ally"
            style={{ animationDelay: `${0.2 + i * 0.1}s` }}
          >
            {name}
          </span>
        ))}
      </div>

      {/* VS 分隔 */}
      <div className="tk-battle-anim__vs">VS</div>

      {/* 敌方武将滑入（从右侧） */}
      <div className="tk-battle-anim__enemy-slide">
        {enemyNames.slice(0, 3).map((name, i) => (
          <span
            key={i}
            className="tk-battle-anim__hero tk-battle-anim__hero--enemy"
            style={{ animationDelay: `${0.2 + i * 0.1}s` }}
          >
            {name}
          </span>
        ))}
      </div>

      {/* 回合文字 */}
      <div className="tk-battle-anim__turn-text">
        第 {turnNumber} 回合
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// 退出动画子组件
// ─────────────────────────────────────────────

const EXIT_TEXT: Record<ExitResult, string> = {
  victory: '大获全胜',
  defeat: '战  败',
  draw: '势均力敌',
};

const ExitAnimation: React.FC<{
  result: ExitResult;
  onComplete: () => void;
}> = ({ result, onComplete }) => {
  // 整体动画 2s 后自动完成
  useEffect(() => {
    const timer = setTimeout(onComplete, 2000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className={`tk-battle-anim tk-battle-anim--exit tk-battle-anim--${result}`} data-testid="battle-anim-exit">
      {/* 结果背景 */}
      <div className={`tk-battle-anim__exit-bg tk-battle-anim__exit-bg--${result}`} />

      {/* 装饰纹路 */}
      {result === 'victory' && (
        <div className="tk-battle-anim__victory-decor">
          <div className="tk-battle-anim__victory-line tk-battle-anim__victory-line--left" />
          <div className="tk-battle-anim__victory-line tk-battle-anim__victory-line--right" />
        </div>
      )}

      {/* 结果文字 */}
      <div className={`tk-battle-anim__exit-text tk-battle-anim__exit-text--${result}`}>
        {EXIT_TEXT[result]}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────

const BattleEnterExitAnimation: React.FC<BattleEnterExitAnimationProps> = ({
  phase,
  exitResult = 'victory',
  turnNumber = 1,
  allyNames = [],
  enemyNames = [],
  onAnimationComplete,
}) => {
  const handleComplete = useCallback(() => {
    onAnimationComplete?.();
  }, [onAnimationComplete]);

  // idle / active / done 阶段不渲染
  if (phase === 'idle' || phase === 'active' || phase === 'done') {
    return null;
  }

  // 进入动画
  if (phase === 'entering') {
    return (
      <EnterAnimation
        turnNumber={turnNumber}
        allyNames={allyNames}
        enemyNames={enemyNames}
        onComplete={handleComplete}
      />
    );
  }

  // 退出动画
  if (phase === 'exiting') {
    return (
      <ExitAnimation
        result={exitResult}
        onComplete={handleComplete}
      />
    );
  }

  return null;
};

BattleEnterExitAnimation.displayName = 'BattleEnterExitAnimation';
export default BattleEnterExitAnimation;
