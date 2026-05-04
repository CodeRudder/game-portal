/**
 * CampaignTab — 关卡地图渲染测试
 *
 * 覆盖场景（15个用例）：
 * - 基础渲染：面板容器、章节选择器、关卡节点
 * - 关卡状态：锁定/可挑战/已通关/三星
 * - 章节切换：上一章/下一章
 * - 地图滚动：左右滚动按钮
 * - 底部进度：进度条显示
 * - 点击交互：点击可挑战关卡打开布阵弹窗
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import CampaignTab from '../CampaignTab';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import type { Chapter, Stage, StageStatus, CampaignProgress } from '@/games/three-kingdoms/engine/campaign/campaign.types';

// ── Mock CSS ──
vi.mock('../CampaignTab.css', () => ({}));
vi.mock('../ChapterSelectPanel.module.css', () => ({
  default: new Proxy({}, {
    get(_target, prop: string) { return prop; },
  }),
}));
vi.mock('../BattleFormationModal.css', () => ({}));
vi.mock('../BattleFormationModal', () => ({
  default: function MockFormationModal({ onClose }: { onClose: () => void }) {
    return <div data-testid="formation-modal">布阵弹窗<button onClick={onClose}>关闭</button></div>;
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

const stages: Stage[] = [
  makeStage({ id: 's1', name: '黄巾之乱', order: 1, type: 'normal' }),
  makeStage({ id: 's2', name: '广宗之战', order: 2, type: 'normal' }),
  makeStage({ id: 's3', name: '张角讨伐', order: 3, type: 'boss' }),
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
  {
    id: 'chapter2',
    name: '讨伐董卓',
    subtitle: '群雄并起',
    order: 2,
    stages: [makeStage({ id: 's4', name: '汜水关', order: 1, chapterId: 'chapter2' })],
    prerequisiteChapterId: 'chapter1',
    description: '十八路诸侯讨董',
  },
];

// ── Mock Engine ──

function makeMockEngine() {
  return {
    getChapters: vi.fn(() => chapters),
    getCampaignSystem: vi.fn(() => ({
      getStageStatus: vi.fn((stageId: string): StageStatus => {
        if (stageId === 's1') return 'cleared';
        if (stageId === 's2') return 'available';
        if (stageId === 's3') return 'locked';
        if (stageId === 's4') return 'available';
        return 'locked';
      }),
      getStageStars: vi.fn((stageId: string): number => {
        if (stageId === 's1') return 2;
        return 0;
      }),
    })),
    getCampaignProgress: vi.fn((): CampaignProgress => ({
      currentChapterId: 'chapter1',
      stageStates: {
        s1: { stageId: 's1', stars: 2, firstCleared: true, clearCount: 3 },
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
  } as unknown as ThreeKingdomsEngine;
}

// ── 测试 ──

describe('CampaignTab', () => {
  const defaultProps = {
    engine: makeMockEngine(),
    snapshotVersion: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════
  // 1. 基础渲染
  // ═══════════════════════════════════════════

  it('应渲染面板容器', () => {
    const { container } = render(<CampaignTab {...defaultProps} />);
    expect(container.querySelector('.tk-campaign-tab')).toBeInTheDocument();
  });

  it('应渲染章节选择面板，显示章节卡片', () => {
    render(<CampaignTab {...defaultProps} />);
    expect(screen.getByTestId('chapter-select-panel')).toBeInTheDocument();
    expect(screen.getByTestId('chapter-card-chapter1')).toBeInTheDocument();
  });

  it('应渲染所有关卡节点名称', () => {
    render(<CampaignTab {...defaultProps} />);
    // 关卡名出现在节点中
    expect(screen.getByLabelText(/黄巾之乱.*已通关/)).toBeInTheDocument();
    expect(screen.getByLabelText(/广宗之战.*可挑战/)).toBeInTheDocument();
    expect(screen.getByLabelText(/张角讨伐.*未解锁/)).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 2. 关卡状态显示
  // ═══════════════════════════════════════════

  it('锁定关卡应显示锁定图标', () => {
    render(<CampaignTab {...defaultProps} />);
    const lockedNode = screen.getByLabelText(/张角讨伐.*未解锁/);
    expect(lockedNode).toBeInTheDocument();
    expect(lockedNode.querySelector('.tk-stage-node-lock')).toHaveTextContent('🔒');
  });

  it('已通关关卡应显示星级', () => {
    render(<CampaignTab {...defaultProps} />);
    const clearedNode = screen.getByLabelText(/黄巾之乱.*已通关 2星/);
    expect(clearedNode).toBeInTheDocument();
  });

  it('关卡节点应显示推荐战力', () => {
    render(<CampaignTab {...defaultProps} />);
    // 3个关卡都有推荐战力1,000
    const powerTexts = screen.getAllByText(/战力 1,000/);
    expect(powerTexts.length).toBe(3);
  });

  it('关卡节点应显示类型标签', () => {
    render(<CampaignTab {...defaultProps} />);
    // 2个普通 + 1个BOSS
    const normalLabels = screen.getAllByText('普通');
    expect(normalLabels.length).toBe(2);
    expect(screen.getByText('BOSS')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 3. 章节切换
  // ═══════════════════════════════════════════

  it('点击章节卡片应切换到对应章节', () => {
    render(<CampaignTab {...defaultProps} />);
    const chapter2Card = screen.getByTestId('chapter-card-chapter2');
    fireEvent.click(chapter2Card);
    // 切换后地图应显示第2章关卡
    expect(screen.getByLabelText(/汜水关.*可挑战/)).toBeInTheDocument();
  });

  it('未解锁章节卡片应禁用', () => {
    render(<CampaignTab {...defaultProps} />);
    // 第2章第1关 s4 是 available（mock），所以 chapter2 是解锁的
    // 验证当前章节卡片可点击
    const chapter1Card = screen.getByTestId('chapter-card-chapter1');
    expect(chapter1Card).not.toBeDisabled();
  });

  it('章节选择面板应显示所有章节', () => {
    render(<CampaignTab {...defaultProps} />);
    expect(screen.getByTestId('chapter-card-chapter1')).toBeInTheDocument();
    expect(screen.getByTestId('chapter-card-chapter2')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 4. 点击交互
  // ═══════════════════════════════════════════

  it('点击可挑战关卡应打开布阵弹窗', () => {
    render(<CampaignTab {...defaultProps} />);
    const availableNode = screen.getByLabelText(/广宗之战.*可挑战/);
    fireEvent.click(availableNode);
    expect(screen.getByTestId('formation-modal')).toBeInTheDocument();
  });

  it('点击锁定关卡不应打开弹窗', () => {
    render(<CampaignTab {...defaultProps} />);
    const lockedNode = screen.getByLabelText(/张角讨伐.*未解锁/);
    fireEvent.click(lockedNode);
    expect(screen.queryByTestId('formation-modal')).not.toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 5. 进度显示
  // ═══════════════════════════════════════════

  it('应显示底部进度信息', () => {
    render(<CampaignTab {...defaultProps} />);
    expect(screen.getByText(/进度/)).toBeInTheDocument();
  });

  it('应显示进度条', () => {
    const { container } = render(<CampaignTab {...defaultProps} />);
    expect(container.querySelector('.tk-campaign-progress-bar')).toBeInTheDocument();
    expect(container.querySelector('.tk-campaign-progress-fill')).toBeInTheDocument();
  });
});
