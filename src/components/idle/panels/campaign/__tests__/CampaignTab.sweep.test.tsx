/**
 * CampaignTab — 扫荡功能测试
 *
 * 覆盖场景（4个用例）：
 * - 扫荡按钮仅对三星通关关卡显示
 * - 点击扫荡按钮应触发 handleSweep（调用 engine.startBattle）
 * - 扫荡后应显示 BattleResultModal 结算弹窗
 * - 非三星关卡不应显示扫荡按钮
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CampaignTab from '../CampaignTab';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import type { Chapter, Stage, StageStatus, CampaignProgress } from '@/games/three-kingdoms/engine/campaign/campaign.types';
import { BattleOutcome, StarRating } from '@/games/three-kingdoms/engine/battle/battle.types';
import type { BattleResult } from '@/games/three-kingdoms/engine/battle/battle.types';

// ── Mock CSS ──
vi.mock('../CampaignTab.css', () => ({}));
vi.mock('../BattleFormationModal.css', () => ({}));
vi.mock('../BattleFormationModal', () => ({
  default: function MockFormationModal({ onClose }: { onClose: () => void }) {
    return <div data-testid="formation-modal">布阵弹窗<button onClick={onClose}>关闭</button></div>;
  },
}));
vi.mock('../BattleResultModal.css', () => ({}));
vi.mock('../BattleResultModal', () => ({
  default: function MockResultModal({ result, onConfirm }: { result: BattleResult; onConfirm: () => void }) {
    return (
      <div data-testid="result-modal">
        结算弹窗 — {result.outcome}
        <button onClick={onConfirm}>确认</button>
      </div>
    );
  },
}));

// ── 测试数据 ──

const makeStage = (overrides: Partial<Stage> = {}): Stage => ({
  id: 'chapter1_stage1',
  name: '黄巾之乱',
  type: 'normal',
  chapterId: 'chapter1',
  order: 1,
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
  description: '黄巾起义的第一战',
  ...overrides,
});

/** 创建包含三个不同状态关卡的章节 */
function makeChapters() {
  const stages: Stage[] = [
    makeStage({ id: 's_three_star', name: '三星关卡', order: 1 }),   // 三星通关
    makeStage({ id: 's_cleared', name: '已通关关卡', order: 2 }),     // 已通关非三星
    makeStage({ id: 's_available', name: '可挑战关卡', order: 3 }),   // 可挑战
    makeStage({ id: 's_locked', name: '未解锁关卡', order: 4 }),      // 锁定
  ];

  const chapters: Chapter[] = [
    {
      id: 'chapter1',
      name: '黄巾之乱',
      subtitle: '乱世开端',
      order: 1,
      stages,
      prerequisiteChapterId: null,
      description: '东汉末年黄巾起义',
    },
  ];
  return chapters;
}

// ── Mock Engine ──

function makeMockEngine() {
  const chapters = makeChapters();

  const mockStartBattle = vi.fn((): BattleResult => ({
    outcome: BattleOutcome.VICTORY,
    stars: StarRating.THREE,
    totalTurns: 3,
    allySurvivors: 5,
    enemySurvivors: 0,
    allyTotalDamage: 6000,
    enemyTotalDamage: 1000,
    maxSingleDamage: 2000,
    maxCombo: 4,
    summary: '扫荡胜利',
  }));

  const engine = {
    getChapters: vi.fn(() => chapters),
    getCampaignSystem: vi.fn(() => ({
      getStageStatus: vi.fn((stageId: string): StageStatus => {
        if (stageId === 's_three_star') return 'threeStar';
        if (stageId === 's_cleared') return 'cleared';
        if (stageId === 's_available') return 'available';
        return 'locked';
      }),
      getStageStars: vi.fn((stageId: string): number => {
        if (stageId === 's_three_star') return 3;
        if (stageId === 's_cleared') return 2;
        return 0;
      }),
    })),
    getCampaignProgress: vi.fn((): CampaignProgress => ({
      currentChapterId: 'chapter1',
      stageStates: {
        s_three_star: { stageId: 's_three_star', stars: 3, firstCleared: true, clearCount: 10 },
        s_cleared: { stageId: 's_cleared', stars: 2, firstCleared: true, clearCount: 3 },
      },
      lastClearTime: Date.now(),
    })),
    getFormationSystem: vi.fn(() => ({})),
    getHeroSystem: vi.fn(() => ({
      getGeneral: vi.fn(),
      calculatePower: vi.fn(() => 500),
    })),
    getActiveFormation: vi.fn(() => null),
    getBattleEngine: vi.fn(),
    getGenerals: vi.fn(() => []),
    startBattle: mockStartBattle,
    completeBattle: vi.fn(),
  } as unknown as ThreeKingdomsEngine;

  return { engine, mockStartBattle };
}

// ── 测试 ──

describe('CampaignTab — 扫荡功能', () => {
  const { engine, mockStartBattle } = makeMockEngine();
  const defaultProps = {
    engine,
    snapshotVersion: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════
  // 1. 扫荡按钮渲染
  // ═══════════════════════════════════════════

  it('应仅对三星通关关卡显示扫荡按钮', () => {
    render(<CampaignTab {...defaultProps} />);
    // 三星关卡应显示扫荡按钮
    const sweepBtn = screen.getByLabelText('扫荡 三星关卡');
    expect(sweepBtn).toBeInTheDocument();
    expect(sweepBtn).toHaveTextContent('⚡ 扫荡');
  });

  it('非三星关卡不应显示扫荡按钮', () => {
    render(<CampaignTab {...defaultProps} />);
    // 已通关（2星）不应有扫荡按钮
    expect(screen.queryByLabelText('扫荡 已通关关卡')).not.toBeInTheDocument();
    // 可挑战关卡不应有扫荡按钮
    expect(screen.queryByLabelText('扫荡 可挑战关卡')).not.toBeInTheDocument();
    // 锁定关卡不应有扫荡按钮
    expect(screen.queryByLabelText('扫荡 未解锁关卡')).not.toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 2. 扫荡交互
  // ═══════════════════════════════════════════

  it('点击扫荡按钮应触发 handleSweep 调用 engine.startBattle', () => {
    render(<CampaignTab {...defaultProps} />);
    const sweepBtn = screen.getByLabelText('扫荡 三星关卡');
    fireEvent.click(sweepBtn);
    expect(mockStartBattle).toHaveBeenCalledTimes(1);
    expect(mockStartBattle).toHaveBeenCalledWith('s_three_star');
  });

  it('扫荡后应显示 BattleResultModal 结算弹窗', () => {
    render(<CampaignTab {...defaultProps} />);
    // 初始不应显示结算弹窗
    expect(screen.queryByTestId('result-modal')).not.toBeInTheDocument();

    // 点击扫荡
    const sweepBtn = screen.getByLabelText('扫荡 三星关卡');
    fireEvent.click(sweepBtn);

    // 应显示结算弹窗
    expect(screen.getByTestId('result-modal')).toBeInTheDocument();
    expect(screen.getByText(/结算弹窗/)).toBeInTheDocument();
  });

  it('点击结算弹窗确认后应关闭弹窗', () => {
    render(<CampaignTab {...defaultProps} />);
    // 点击扫荡
    fireEvent.click(screen.getByLabelText('扫荡 三星关卡'));
    expect(screen.getByTestId('result-modal')).toBeInTheDocument();

    // 点击确认
    fireEvent.click(screen.getByText('确认'));
    expect(screen.queryByTestId('result-modal')).not.toBeInTheDocument();
  });
});
