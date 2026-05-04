/**
 * ChallengeStagePanel + OfflinePushPanel 集成测试
 *
 * 验证：
 * - 挑战关卡面板渲染8个烽火台卡片
 * - 每日次数显示、倒计时
 * - 离线推图面板渲染设置和挂机收益区
 * - CampaignTab 底部入口按钮可打开面板
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CampaignTab from '../CampaignTab';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import type { Chapter, Stage, StageStatus, CampaignProgress } from '@/games/three-kingdoms/engine/campaign/campaign.types';

// ── Mock CSS ──
vi.mock('../CampaignTab.css', () => ({}));
vi.mock('../ChallengeStagePanel.css', () => ({}));
vi.mock('../OfflinePushPanel.css', () => ({}));
vi.mock('../BattleFormationModal.css', () => ({}));
vi.mock('../BattleFormationModal', () => ({
  default: function MockFormationModal({ onClose }: { onClose: () => void }) {
    return <div data-testid="formation-modal">布阵弹窗<button onClick={onClose}>关闭</button></div>;
  },
}));
vi.mock('../BattleResultModal.css', () => ({}));
vi.mock('../BattleResultModal', () => ({
  default: function MockResultModal({ onConfirm }: { onConfirm: () => void }) {
    return <div data-testid="result-modal">结算弹窗<button onClick={onConfirm}>确认</button></div>;
  },
}));
vi.mock('../SweepModal.css', () => ({}));
vi.mock('../SweepModal', () => ({
  default: function MockSweepModal({ onClose }: { onClose: () => void }) {
    return <div data-testid="sweep-modal">扫荡弹窗<button onClick={onClose}>关闭</button></div>;
  },
}));

// ── 测试数据 ──

const makeStage = (overrides: Partial<Stage> = {}): Stage => ({
  id: 'chapter1_stage1',
  name: '黄巾之乱',
  type: 'normal',
  chapterId: 'chapter1',
  order: 1,
  enemyFormation: { id: 'ef1', name: '黄巾军', units: [], recommendedPower: 1000 },
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

const stages: Stage[] = [
  makeStage({ id: 's1', name: '黄巾之乱', order: 1, type: 'normal' }),
  makeStage({ id: 's2', name: '广宗之战', order: 2, type: 'normal' }),
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

// ── Mock Engine ──

const CHALLENGE_STAGES = [
  { id: 'challenge_1', name: '烽火台·壹', armyCost: 200, staminaCost: 12,
    firstClearBonus: [], rewards: [{ type: 'grain', amount: 500 }], randomDrops: [] },
  { id: 'challenge_2', name: '烽火台·贰', armyCost: 300, staminaCost: 14,
    firstClearBonus: [], rewards: [{ type: 'grain', amount: 800 }], randomDrops: [] },
  { id: 'challenge_3', name: '烽火台·叁', armyCost: 400, staminaCost: 16,
    firstClearBonus: [], rewards: [{ type: 'grain', amount: 1200 }], randomDrops: [] },
  { id: 'challenge_4', name: '烽火台·肆', armyCost: 500, staminaCost: 16,
    firstClearBonus: [], rewards: [{ type: 'grain', amount: 1500 }], randomDrops: [] },
  { id: 'challenge_5', name: '烽火台·伍', armyCost: 600, staminaCost: 18,
    firstClearBonus: [], rewards: [{ type: 'grain', amount: 2000 }], randomDrops: [] },
  { id: 'challenge_6', name: '烽火台·陆', armyCost: 700, staminaCost: 18,
    firstClearBonus: [], rewards: [{ type: 'grain', amount: 2500 }], randomDrops: [] },
  { id: 'challenge_7', name: '烽火台·柒', armyCost: 800, staminaCost: 20,
    firstClearBonus: [], rewards: [{ type: 'grain', amount: 3000 }], randomDrops: [] },
  { id: 'challenge_8', name: '烽火台·捌', armyCost: 1000, staminaCost: 20,
    firstClearBonus: [], rewards: [{ type: 'grain', amount: 5000 }], randomDrops: [] },
];

function makeMockEngine() {
  return {
    getChapters: vi.fn(() => chapters),
    getCampaignSystem: vi.fn(() => ({
      getStageStatus: vi.fn((): StageStatus => 'available'),
      getStageStars: vi.fn(() => 0),
    })),
    getCampaignProgress: vi.fn((): CampaignProgress => ({
      currentChapterId: 'chapter1',
      stageStates: {},
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
    getSweepSystem: vi.fn(() => ({
      getTicketCount: vi.fn(() => 5),
      getAutoPushProgress: vi.fn(() => ({
        isRunning: false, startStageId: '', currentStageId: '',
        attempts: 0, victories: 0, defeats: 0,
      })),
    })),
    getChallengeStageSystem: vi.fn(() => ({
      getStageConfigs: vi.fn(() => CHALLENGE_STAGES),
      getDailyRemaining: vi.fn(() => 3),
      isFirstCleared: vi.fn(() => false),
      checkCanChallenge: vi.fn(() => ({ canChallenge: true, reasons: [] })),
      preLockResources: vi.fn(() => true),
      completeChallenge: vi.fn(() => ({
        victory: false, rewards: [], firstClear: false, armyCost: 0, staminaCost: 0,
      })),
    })),
    getOfflineRewardSystem: vi.fn(() => ({
      calculateSnapshot: vi.fn(() => ({
        timestamp: Date.now(),
        offlineSeconds: 3600,
        tierDetails: [],
        totalEarned: { grain: 100, gold: 50, troops: 20, mandate: 5, techPoint: 0, recruitToken: 0, skillBook: 0 },
        overallEfficiency: 1,
        isCapped: false,
      })),
      calculateOfflineReward: vi.fn(() => ({
        snapshot: { timestamp: Date.now(), offlineSeconds: 3600, tierDetails: [], totalEarned: {}, overallEfficiency: 1, isCapped: false },
        vipBoostedEarned: {},
        systemModifiedEarned: {},
        cappedEarned: { grain: 100, gold: 50, troops: 20, mandate: 5, techPoint: 0, recruitToken: 0, skillBook: 0 },
        overflowResources: {},
        tradeSummary: null,
        panelData: { offlineSeconds: 3600, formattedTime: '1小时', efficiencyPercent: 100, tierDetails: [], totalEarned: {}, isCapped: false, availableDoubles: [], boostItems: [] },
      })),
      claimReward: vi.fn(() => ({ grain: 100, gold: 50, troops: 20, mandate: 5, techPoint: 0, recruitToken: 0, skillBook: 0 })),
    })),
    getResourceAmount: vi.fn(() => 9999),
  } as unknown as ThreeKingdomsEngine;
}

// ── 测试 ──

describe('ChallengeStagePanel', () => {
  let engine: ThreeKingdomsEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = makeMockEngine();
  });

  it('renders challenge panel entry button in CampaignTab', () => {
    render(<CampaignTab engine={engine} snapshotVersion={0} />);
    const btn = screen.getByTestId('btn-open-challenge-panel');
    expect(btn).toBeTruthy();
    expect(btn.textContent).toContain('烽火台');
  });

  it('opens challenge stage panel when clicking entry button', () => {
    render(<CampaignTab engine={engine} snapshotVersion={0} />);
    const btn = screen.getByTestId('btn-open-challenge-panel');
    fireEvent.click(btn);
    expect(screen.getByTestId('challenge-stage-panel')).toBeTruthy();
  });

  it('renders 8 challenge stage cards', () => {
    render(<CampaignTab engine={engine} snapshotVersion={0} />);
    fireEvent.click(screen.getByTestId('btn-open-challenge-panel'));
    const cards = screen.getAllByTestId(/^challenge-card-challenge_\d+$/);
    expect(cards.length).toBe(8);
  });

  it('shows daily reset countdown', () => {
    render(<CampaignTab engine={engine} snapshotVersion={0} />);
    fireEvent.click(screen.getByTestId('btn-open-challenge-panel'));
    const countdown = screen.getByTestId('challenge-reset-countdown');
    expect(countdown.textContent).toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  it('closes challenge panel via close button', () => {
    render(<CampaignTab engine={engine} snapshotVersion={0} />);
    fireEvent.click(screen.getByTestId('btn-open-challenge-panel'));
    expect(screen.getByTestId('challenge-stage-panel')).toBeTruthy();
    fireEvent.click(screen.getByTestId('challenge-panel-close'));
    expect(screen.queryByTestId('challenge-stage-panel')).toBeNull();
  });

  it('shows remaining attempts for each stage', () => {
    render(<CampaignTab engine={engine} snapshotVersion={0} />);
    fireEvent.click(screen.getByTestId('btn-open-challenge-panel'));
    const card = screen.getByTestId('challenge-card-challenge_1');
    expect(card.textContent).toContain('今日');
    expect(card.textContent).toContain('3');
  });
});

describe('OfflinePushPanel', () => {
  let engine: ThreeKingdomsEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = makeMockEngine();
  });

  it('renders offline push entry button in CampaignTab', () => {
    render(<CampaignTab engine={engine} snapshotVersion={0} />);
    const btn = screen.getByTestId('btn-open-offline-push');
    expect(btn).toBeTruthy();
    expect(btn.textContent).toContain('离线推图');
  });

  it('opens offline push panel when clicking entry button', () => {
    render(<CampaignTab engine={engine} snapshotVersion={0} />);
    fireEvent.click(screen.getByTestId('btn-open-offline-push'));
    expect(screen.getByTestId('offline-push-panel')).toBeTruthy();
  });

  it('renders idle timer and progress bar', () => {
    render(<CampaignTab engine={engine} snapshotVersion={0} />);
    fireEvent.click(screen.getByTestId('btn-open-offline-push'));
    expect(screen.getByTestId('offline-push-timer')).toBeTruthy();
    expect(screen.getByTestId('offline-push-progress')).toBeTruthy();
  });

  it('renders auto push toggle switch', () => {
    render(<CampaignTab engine={engine} snapshotVersion={0} />);
    fireEvent.click(screen.getByTestId('btn-open-offline-push'));
    const toggle = screen.getByTestId('offline-push-toggle');
    expect(toggle).toBeTruthy();
    expect(toggle.getAttribute('aria-checked')).toBe('false');
  });

  it('toggles auto push on and off', () => {
    render(<CampaignTab engine={engine} snapshotVersion={0} />);
    fireEvent.click(screen.getByTestId('btn-open-offline-push'));
    const toggle = screen.getByTestId('offline-push-toggle');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-checked')).toBe('false');
  });

  it('renders power threshold input', () => {
    render(<CampaignTab engine={engine} snapshotVersion={0} />);
    fireEvent.click(screen.getByTestId('btn-open-offline-push'));
    const input = screen.getByTestId('offline-push-threshold') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.value).toBe('10000');
  });

  it('renders empty battle log when no logs', () => {
    render(<CampaignTab engine={engine} snapshotVersion={0} />);
    fireEvent.click(screen.getByTestId('btn-open-offline-push'));
    expect(screen.getByTestId('offline-push-empty')).toBeTruthy();
    expect(screen.getByTestId('offline-push-empty').textContent).toContain('暂无战报');
  });

  it('simulates accumulation and shows claim button', () => {
    render(<CampaignTab engine={engine} snapshotVersion={0} />);
    fireEvent.click(screen.getByTestId('btn-open-offline-push'));

    // 点击模拟按钮
    const simulateBtn = screen.getByTestId('offline-push-simulate');
    fireEvent.click(simulateBtn);

    // 验证计时器更新
    const timer = screen.getByTestId('offline-push-timer');
    expect(timer.textContent).toContain('1小时');

    // 验证领取按钮可用
    const claimBtn = screen.getByTestId('offline-push-claim') as HTMLButtonElement;
    expect(claimBtn.disabled).toBe(false);
  });

  it('closes offline push panel via close button', () => {
    render(<CampaignTab engine={engine} snapshotVersion={0} />);
    fireEvent.click(screen.getByTestId('btn-open-offline-push'));
    expect(screen.getByTestId('offline-push-panel')).toBeTruthy();
    fireEvent.click(screen.getByTestId('offline-push-close'));
    expect(screen.queryByTestId('offline-push-panel')).toBeNull();
  });
});
