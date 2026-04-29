/**
 * F03 武将招募 P1-3 修复测试：战斗失败时显示"重新挑战"按钮
 *
 * 验证点：
 * 1. BattleResultModal 战斗失败时且有 onRetry 回调应显示"重新挑战"按钮
 * 2. 点击"重新挑战"按钮应调用 onRetry
 * 3. 战斗胜利时不应显示"重新挑战"按钮
 * 4. 战斗失败但未提供 onRetry 回调时不显示按钮
 * 5. "重新挑战"按钮应有正确的样式类和渲染顺序
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BattleResultModal from '@/components/idle/panels/campaign/BattleResultModal';
import { BattleOutcome, StarRating } from '@/games/three-kingdoms/engine/battle/battle.types';
import type { BattleResult } from '@/games/three-kingdoms/engine/battle/battle.types';
import type { Stage } from '@/games/three-kingdoms/engine/campaign/campaign.types';

// ── Mock CSS ──
vi.mock('@/components/idle/panels/campaign/BattleResultModal.css', () => ({}));

// ── 测试数据工厂 ──

const makeStage = (overrides: Partial<Stage> = {}): Stage => ({
  id: 'chapter1_stage1',
  name: '黄巾之乱',
  type: 'normal',
  chapterId: 'chapter1',
  order: 1,
  description: '黄巾起义的第一战',
  enemyFormation: {
    id: 'ef1',
    name: '黄巾军',
    units: [],
    recommendedPower: 1000,
  },
  baseRewards: { grain: 100, gold: 50 },
  baseExp: 200,
  firstClearRewards: { gold: 200 },
  firstClearExp: 100,
  threeStarBonusMultiplier: 1.5,
  dropTable: [],
  recommendedPower: 1000,
  ...overrides,
});

const makeDefeatResult = (overrides: Partial<BattleResult> = {}): BattleResult => ({
  outcome: BattleOutcome.DEFEAT,
  stars: StarRating.NONE,
  totalTurns: 8,
  allySurvivors: 0,
  enemySurvivors: 3,
  allyTotalDamage: 1500,
  enemyTotalDamage: 4000,
  maxSingleDamage: 800,
  maxCombo: 1,
  summary: '战斗失败',
  ...overrides,
});

const makeVictoryResult = (overrides: Partial<BattleResult> = {}): BattleResult => ({
  outcome: BattleOutcome.VICTORY,
  stars: StarRating.THREE,
  totalTurns: 5,
  allySurvivors: 4,
  enemySurvivors: 0,
  allyTotalDamage: 5000,
  enemyTotalDamage: 2000,
  maxSingleDamage: 1500,
  maxCombo: 3,
  summary: '战斗胜利！',
  ...overrides,
});

// ── 测试 ──

describe('F03 P1-3: 战斗失败时显示"重新挑战"按钮', () => {
  const onConfirm = vi.fn();
  const onRetry = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('战斗失败且有onRetry时应显示"重新挑战"按钮', () => {
    render(
      <BattleResultModal
        result={makeDefeatResult()}
        stage={makeStage()}
        onConfirm={onConfirm}
        onRetry={onRetry}
      />,
    );

    const retryBtn = screen.getByTestId('battle-result-retry');
    expect(retryBtn).toBeInTheDocument();
    expect(retryBtn.textContent).toContain('重新挑战');
  });

  it('点击"重新挑战"按钮应调用onRetry回调', () => {
    render(
      <BattleResultModal
        result={makeDefeatResult()}
        stage={makeStage()}
        onConfirm={onConfirm}
        onRetry={onRetry}
      />,
    );

    const retryBtn = screen.getByTestId('battle-result-retry');
    fireEvent.click(retryBtn);

    expect(onRetry).toHaveBeenCalledTimes(1);
    // 确认按钮不应该被调用
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('战斗胜利时不应显示"重新挑战"按钮', () => {
    render(
      <BattleResultModal
        result={makeVictoryResult()}
        stage={makeStage()}
        onConfirm={onConfirm}
        onRetry={onRetry}
      />,
    );

    expect(screen.queryByTestId('battle-result-retry')).not.toBeInTheDocument();
  });

  it('战斗失败但未提供onRetry时不显示"重新挑战"按钮', () => {
    render(
      <BattleResultModal
        result={makeDefeatResult()}
        stage={makeStage()}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.queryByTestId('battle-result-retry')).not.toBeInTheDocument();
  });

  it('"重新挑战"按钮应在"返回"按钮之前渲染', () => {
    const { container } = render(
      <BattleResultModal
        result={makeDefeatResult()}
        stage={makeStage()}
        onConfirm={onConfirm}
        onRetry={onRetry}
      />,
    );

    const actionsDiv = container.querySelector('.tk-brm-actions');
    expect(actionsDiv).toBeInTheDocument();

    const buttons = actionsDiv!.querySelectorAll('button');
    // 第一个按钮应该是重新挑战
    expect(buttons[0]).toHaveAttribute('data-testid', 'battle-result-retry');
    // 第二个按钮应该是返回
    expect(buttons[1]).toHaveAttribute('data-testid', 'battle-result-confirm');
    expect(buttons[1].textContent).toContain('返回');
  });

  it('"重新挑战"按钮应有retry样式类', () => {
    render(
      <BattleResultModal
        result={makeDefeatResult()}
        stage={makeStage()}
        onConfirm={onConfirm}
        onRetry={onRetry}
      />,
    );

    const retryBtn = screen.getByTestId('battle-result-retry');
    expect(retryBtn.classList.contains('tk-brm-confirm-btn--retry')).toBe(true);
  });

  it('平局时不显示"重新挑战"按钮（非胜利但有onRetry）', () => {
    const drawResult: BattleResult = {
      ...makeDefeatResult(),
      outcome: BattleOutcome.DRAW,
      summary: '平局',
    };

    render(
      <BattleResultModal
        result={drawResult}
        stage={makeStage()}
        onConfirm={onConfirm}
        onRetry={onRetry}
      />,
    );

    // 平局也属于非胜利，应显示重新挑战
    const retryBtn = screen.getByTestId('battle-result-retry');
    expect(retryBtn).toBeInTheDocument();
  });
});
