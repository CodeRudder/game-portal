/**
 * QuestPanel UI渲染测试 — P1-7修复
 *
 * 覆盖场景：
 * - 基础渲染：面板容器、活跃度条、Tab切换、任务列表
 * - 任务信息展示：标题、描述、奖励预览、类型标签、进度条
 * - 交互：领取奖励、一键领取、里程碑领取
 * - 空状态：无任务时友好提示
 * - Badge红点：可领取奖励数量提示
 * - 任务跳转按钮
 *
 * @module panels/quest/__tests__/QuestPanel.test
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import QuestPanel from '../QuestPanel';

// ── Mock SharedPanel ──
vi.mock('@/components/idle/components/SharedPanel', () => ({
  default: function MockSharedPanel({ children, visible }: { children: React.ReactNode; visible?: boolean }) {
    return visible !== false ? <div data-testid="shared-panel">{children}</div> : null;
  },
}));

// ── Mock CSS ──
vi.mock('../QuestPanel.css', () => ({}));

// ── 测试数据工厂 ──

function makeQuestDef(overrides: Record<string, any> = {}) {
  return {
    id: 'test-main-001',
    title: '初入乱世',
    description: '升级任意建筑1次',
    category: 'main',
    objectives: [
      { id: 'obj-1', type: 'build_upgrade', description: '升级建筑1次', targetCount: 1, currentCount: 0 },
    ],
    rewards: { resources: { gold: 2000 }, experience: 1000 },
    sortOrder: 1,
    ...overrides,
  };
}

function makeQuestInstance(overrides: Record<string, any> = {}) {
  return {
    instanceId: 'quest-inst-1',
    questDefId: 'test-main-001',
    status: 'active',
    objectives: [
      { id: 'obj-1', type: 'build_upgrade', description: '升级建筑1次', targetCount: 1, currentCount: 0 },
    ],
    acceptedAt: Date.now(),
    completedAt: null,
    rewardClaimed: false,
    ...overrides,
  };
}

function makeEngine(overrides: Record<string, any> = {}) {
  const questDefs = new Map<string, any>();
  questDefs.set('test-main-001', makeQuestDef());
  questDefs.set('test-daily-001', makeQuestDef({
    id: 'test-daily-001', title: '勤劳建设', description: '升级建筑2次',
    category: 'daily', expireHours: 24,
    rewards: { resources: { gold: 1000 }, activityPoints: 10 },
  }));

  const dailyQuests = [
    makeQuestInstance({ instanceId: 'quest-inst-d1', questDefId: 'test-daily-001', status: 'active' }),
  ];

  const activeQuests = [
    makeQuestInstance({ instanceId: 'quest-inst-1', questDefId: 'test-main-001', status: 'active' }),
    ...dailyQuests,
  ];

  const completedQuest = makeQuestInstance({
    instanceId: 'quest-inst-2', questDefId: 'test-main-001', status: 'completed',
  });

  return {
    getQuestSystem: () => ({
      getDailyQuests: () => dailyQuests,
      getWeeklyQuests: () => [],
      getActiveQuestsByCategory: (cat: string) => cat === 'main' ? [activeQuests[0]] : [],
      getActiveQuests: () => activeQuests,
      getQuestDef: (id: string) => questDefs.get(id),
      getActivityState: () => ({
        currentPoints: 30, maxPoints: 100,
        milestones: [
          { points: 40, claimed: false, rewards: { gold: 5000 } },
          { points: 60, claimed: false, rewards: { gem: 50 } },
          { points: 80, claimed: false, rewards: { gem: 100 } },
          { points: 100, claimed: false, rewards: { gem: 200 } },
        ],
      }),
      getQuestInstance: (id: string) => activeQuests.find((q: any) => q.instanceId === id),
      claimReward: vi.fn().mockReturnValue({ resources: { gold: 2000 }, experience: 1000 }),
      claimAllRewards: vi.fn().mockReturnValue([{ resources: { gold: 2000 } }]),
      claimActivityMilestone: vi.fn().mockReturnValue({ gold: 5000 }),
      getTrackedQuests: () => activeQuests,
      getMaxTrackedQuests: () => 3,
    }),
    ...overrides,
  };
}

// ═══════════════════════════════════════════════
// QuestPanel UI渲染测试
// ═══════════════════════════════════════════════

describe('QuestPanel UI渲染测试', () => {
  let engine: ReturnType<typeof makeEngine>;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = makeEngine();
  });

  // ── 基础渲染 ──

  it('渲染面板容器', () => {
    render(<QuestPanel engine={engine} />);
    expect(screen.getByTestId('quest-panel')).toBeTruthy();
  });

  it('渲染活跃度区域', () => {
    render(<QuestPanel engine={engine} />);
    expect(screen.getByTestId('quest-panel-activity')).toBeTruthy();
  });

  it('渲染Tab按钮（日常/周常/主线/支线）', () => {
    render(<QuestPanel engine={engine} />);
    expect(screen.getByTestId('quest-panel-tab-daily')).toBeTruthy();
    expect(screen.getByTestId('quest-panel-tab-weekly')).toBeTruthy();
    expect(screen.getByTestId('quest-panel-tab-main')).toBeTruthy();
    expect(screen.getByTestId('quest-panel-tab-side')).toBeTruthy();
  });

  it('渲染一键领取按钮', () => {
    render(<QuestPanel engine={engine} />);
    expect(screen.getByTestId('quest-panel-claim-all')).toBeTruthy();
  });

  // ── 任务信息展示 ──

  it('显示任务标题（从questDef获取）', () => {
    render(<QuestPanel engine={engine} />);
    // 默认tab=daily，应显示日常任务标题
    expect(screen.getByText('勤劳建设')).toBeTruthy();
  });

  it('显示任务描述文字', () => {
    render(<QuestPanel engine={engine} />);
    expect(screen.getByText('升级建筑2次')).toBeTruthy();
  });

  it('显示奖励预览', () => {
    render(<QuestPanel engine={engine} />);
    // 奖励区域应包含铜钱×1000
    const panel = screen.getByTestId('quest-panel');
    expect(panel.textContent).toContain('铜钱');
    expect(panel.textContent).toContain('1000');
  });

  it('显示任务类型标签', () => {
    render(<QuestPanel engine={engine} />);
    // 日常任务应显示"日常"标签
    expect(screen.getByText('日常')).toBeTruthy();
  });

  it('显示进度条和进度数字', () => {
    render(<QuestPanel engine={engine} />);
    // 进度显示 0/1
    expect(screen.getByText('0/1')).toBeTruthy();
  });

  // ── Tab切换 ──

  it('点击Tab切换到主线任务', () => {
    render(<QuestPanel engine={engine} />);
    const mainTab = screen.getByTestId('quest-panel-tab-main');
    fireEvent.click(mainTab);
    // 主线任务应显示
    expect(screen.getByText('初入乱世')).toBeTruthy();
  });

  it('点击周常Tab显示空状态', () => {
    render(<QuestPanel engine={engine} />);
    const weeklyTab = screen.getByTestId('quest-panel-tab-weekly');
    fireEvent.click(weeklyTab);
    expect(screen.getByText(/暂无.*任务/)).toBeTruthy();
  });

  // ── 交互：领取奖励 ──

  it('完成任务后显示领取按钮', () => {
    const completedEngine = makeEngine();
    const completedQuest = makeQuestInstance({
      instanceId: 'quest-inst-c1', questDefId: 'test-daily-001',
      status: 'completed',
      objectives: [{ id: 'obj-1', type: 'build_upgrade', description: '升级建筑2次', targetCount: 2, currentCount: 2 }],
    });
    completedEngine.getQuestSystem = () => ({
      ...engine.getQuestSystem(),
      getDailyQuests: () => [completedQuest],
      getActiveQuests: () => [completedQuest],
    });

    render(<QuestPanel engine={completedEngine} />);
    expect(screen.getByTestId('quest-panel-claim-quest-inst-c1')).toBeTruthy();
  });

  it('点击领取按钮调用claimReward', () => {
    const claimMock = vi.fn().mockReturnValue({ resources: { gold: 1000 } });
    const completedQuest = makeQuestInstance({
      instanceId: 'quest-inst-c1', questDefId: 'test-daily-001',
      status: 'completed',
      objectives: [{ id: 'obj-1', type: 'build_upgrade', description: '升级建筑2次', targetCount: 2, currentCount: 2 }],
    });
    const claimEngine = makeEngine();
    claimEngine.getQuestSystem = () => ({
      ...engine.getQuestSystem(),
      getDailyQuests: () => [completedQuest],
      getActiveQuests: () => [completedQuest],
      claimReward: claimMock,
    });

    render(<QuestPanel engine={claimEngine} />);
    const claimBtn = screen.getByTestId('quest-panel-claim-quest-inst-c1');
    fireEvent.click(claimBtn);
    expect(claimMock).toHaveBeenCalledWith('quest-inst-c1');
  });

  it('点击一键领取调用claimAllRewards', () => {
    const claimAllMock = vi.fn().mockReturnValue([{ resources: { gold: 2000 } }]);
    const claimAllEngine = makeEngine();
    claimAllEngine.getQuestSystem = () => ({
      ...engine.getQuestSystem(),
      claimAllRewards: claimAllMock,
    });

    render(<QuestPanel engine={claimAllEngine} />);
    const claimAllBtn = screen.getByTestId('quest-panel-claim-all');
    fireEvent.click(claimAllBtn);
    expect(claimAllMock).toHaveBeenCalled();
  });

  // ── 活跃度里程碑 ──

  it('显示活跃度进度', () => {
    render(<QuestPanel engine={engine} />);
    const activity = screen.getByTestId('quest-panel-activity');
    expect(activity.textContent).toContain('30/100');
  });

  it('显示里程碑按钮', () => {
    render(<QuestPanel engine={engine} />);
    // 里程碑按钮应显示分数
    expect(screen.getByText(/40分/)).toBeTruthy();
  });

  // ── Badge红点 ──

  it('有可领取奖励时显示Badge红点', () => {
    const completedQuest = makeQuestInstance({
      instanceId: 'quest-inst-c1', questDefId: 'test-daily-001',
      status: 'completed', rewardClaimed: false,
    });
    const badgeEngine = makeEngine();
    badgeEngine.getQuestSystem = () => ({
      ...engine.getQuestSystem(),
      getDailyQuests: () => [completedQuest],
      getActiveQuests: () => [completedQuest],
    });

    render(<QuestPanel engine={badgeEngine} />);
    expect(screen.getByTestId('quest-panel-badge')).toBeTruthy();
  });

  // ── 空状态 ──

  it('无任务时显示空状态提示', () => {
    const emptyEngine = makeEngine();
    emptyEngine.getQuestSystem = () => ({
      ...engine.getQuestSystem(),
      getDailyQuests: () => [],
      getActiveQuests: () => [],
    });

    render(<QuestPanel engine={emptyEngine} />);
    expect(screen.getByText(/暂无.*任务/)).toBeTruthy();
  });

  // ── 无引擎时安全降级 ──

  it('engine为null时不崩溃', () => {
    render(<QuestPanel engine={null} />);
    expect(screen.getByTestId('quest-panel')).toBeTruthy();
  });

  // ── 过期倒计时 ──

  it('有过期时间的任务显示倒计时', () => {
    render(<QuestPanel engine={engine} />);
    // 日常任务有expireHours=24，应显示 ⏰ 24h
    const panel = screen.getByTestId('quest-panel');
    expect(panel.textContent).toContain('⏰');
  });
});
