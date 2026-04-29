/**
 * F03 武将招募 P1-3 集成测试：BattleFormationModal 传递 onRetry 给 BattleResultModal
 *
 * 验证：
 * 1. BattleFormationModal 在战斗失败后将 handleRetry 作为 onRetry 传递
 * 2. 点击重新挑战后回到布阵界面
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BattleFormationModal from '@/components/idle/panels/campaign/BattleFormationModal';
import type { BattleResult } from '@/games/three-kingdoms/engine/battle/battle.types';
import type { Stage } from '@/games/three-kingdoms/engine/campaign/campaign.types';
import type { GeneralData } from '@/games/three-kingdoms/engine/hero/hero.types';
import { Quality } from '@/games/three-kingdoms/engine/hero/hero.types';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';

// ── Mock CSS ──
vi.mock('@/components/idle/panels/campaign/BattleFormationModal.css', () => ({}));
vi.mock('@/components/idle/panels/campaign/BattleScene.css', () => ({}));
vi.mock('@/components/idle/panels/campaign/BattleAnimation.css', () => ({}));
vi.mock('@/components/idle/panels/campaign/BattleResultModal.css', () => ({}));

// ── Mock BattleScene ──
vi.mock('@/components/idle/panels/campaign/BattleScene', () => ({
  default: function MockBattleScene({ onBattleEnd }: { onBattleEnd: (r: any) => void }) {
    return (
      <div data-testid="battle-scene">
        战斗场景
        <button
          data-testid="battle-end-defeat"
          onClick={() => onBattleEnd({
            outcome: 'DEFEAT',
            stars: 0,
            totalTurns: 8,
            allySurvivors: 0,
            enemySurvivors: 3,
            allyTotalDamage: 1500,
            enemyTotalDamage: 4000,
            maxSingleDamage: 800,
            maxCombo: 1,
            summary: '战斗失败',
          })}
        >
          模拟失败
        </button>
      </div>
    );
  },
}));

// ── Mock BattleResultModal ──
vi.mock('@/components/idle/panels/campaign/BattleResultModal', () => ({
  default: function MockResultModal({
    onConfirm,
    onRetry,
  }: {
    onConfirm: () => void;
    onRetry?: () => void;
    result: BattleResult;
    stage: Stage;
  }) {
    return (
      <div data-testid="result-modal">
        <span data-testid="result-modal-has-retry">{onRetry ? 'has-retry' : 'no-retry'}</span>
        <button data-testid="result-modal-confirm" onClick={onConfirm}>确认</button>
        {onRetry && <button data-testid="result-modal-retry" onClick={onRetry}>重新挑战</button>}
      </div>
    );
  },
}));

// ── 测试数据 ──

const makeGeneral = (overrides: Partial<GeneralData> = {}): GeneralData => ({
  id: 'guanyu',
  name: '关羽',
  quality: Quality.LEGENDARY,
  baseStats: { attack: 115, defense: 90, intelligence: 65, speed: 78 },
  level: 10, exp: 500, faction: 'shu',
  skills: [{ id: 's1', name: '青龙偃月', type: 'active', level: 1, description: '200%物伤' }],
  ...overrides,
});

const generals: GeneralData[] = [
  makeGeneral({ id: 'guanyu', name: '关羽' }),
  makeGeneral({ id: 'zhangfei', name: '张飞', quality: Quality.EPIC, baseStats: { attack: 105, defense: 80, intelligence: 40, speed: 70 } }),
];

function makeMockEngine(generalList: GeneralData[] = generals) {
  const powerMap: Record<string, number> = {};
  generalList.forEach((g) => {
    const s = g.baseStats;
    powerMap[g.id] = Math.floor((s.attack * 2 + s.defense * 1.5 + s.intelligence * 2 + s.speed) * (1 + g.level * 0.05));
  });

  const mockFormation = {
    id: 'f1', name: '主力编队',
    slots: generalList.map((g) => g.id).concat(Array(6 - generalList.length).fill('')),
    isActive: true,
  };

  return {
    getGenerals: vi.fn(() => [...generalList]),
    getHeroSystem: vi.fn(() => ({
      calculatePower: vi.fn((g: GeneralData) => powerMap[g.id] ?? 0),
      getGeneral: vi.fn((id: string) => generalList.find((g) => g.id === id)),
      getGeneralsSortedByPower: vi.fn(() => [...generalList]),
    })),
    getActiveFormation: vi.fn(() => mockFormation),
    getFormationSystem: vi.fn(() => ({})),
    createFormation: vi.fn(() => ({ id: 'f2', name: '新编队', slots: Array(6).fill(''), isActive: false })),
    setFormation: vi.fn(),
    getBattleEngine: vi.fn(() => ({})),
    completeBattle: vi.fn(),
  } as unknown as ThreeKingdomsEngine;
}

const makeStage = (): Stage => ({
  id: 'chapter1_stage1',
  name: '黄巾之乱',
  type: 'normal',
  chapterId: 'chapter1',
  order: 1,
  description: '黄巾起义的第一战',
  enemyFormation: {
    id: 'ef1',
    name: '黄巾军',
    units: [
      { id: 'e1', name: '黄巾兵', faction: 'qun', troopType: 'INFANTRY' as any, level: 5, attack: 50, defense: 30, intelligence: 20, speed: 40, maxHp: 500, position: 'front' },
    ],
    recommendedPower: 1000,
  },
  baseRewards: { grain: 100, gold: 50 },
  baseExp: 200,
  firstClearRewards: { gold: 200 },
  firstClearExp: 100,
  threeStarBonusMultiplier: 1.5,
  dropTable: [],
  recommendedPower: 1000,
});

// ── 测试 ──

describe('F03 P1-3: BattleFormationModal 失败重试链路', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('BattleFormationModal 应将 handleRetry 作为 onRetry 传递给 BattleResultModal', () => {
    const engine = makeMockEngine();
    render(<BattleFormationModal engine={engine} stage={makeStage()} onClose={onClose} snapshotVersion={1} />);

    // 点击出征进入战斗
    fireEvent.click(screen.getByText(/出征/));

    // 模拟战斗结束（失败）
    expect(screen.getByTestId('battle-scene')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('battle-end-defeat'));

    // 验证结算弹窗出现，且 onRetry 已传递
    expect(screen.getByTestId('result-modal')).toBeInTheDocument();
    expect(screen.getByTestId('result-modal-has-retry').textContent).toBe('has-retry');
  });

  it('点击重新挑战后应回到布阵界面（结果弹窗消失）', () => {
    const engine = makeMockEngine();
    render(<BattleFormationModal engine={engine} stage={makeStage()} onClose={onClose} snapshotVersion={1} />);

    // 出征
    fireEvent.click(screen.getByText(/出征/));
    // 模拟失败
    fireEvent.click(screen.getByTestId('battle-end-defeat'));

    // 验证结算弹窗出现
    expect(screen.getByTestId('result-modal')).toBeInTheDocument();

    // 点击重新挑战
    fireEvent.click(screen.getByTestId('result-modal-retry'));

    // 结算弹窗应消失，回到布阵界面
    expect(screen.queryByTestId('result-modal')).not.toBeInTheDocument();
    // 布阵界面应重新可见（显示出征按钮）
    expect(screen.getByText(/出征/)).toBeInTheDocument();
  });
});
