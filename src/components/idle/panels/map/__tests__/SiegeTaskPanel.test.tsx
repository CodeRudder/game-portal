/**
 * SiegeTaskPanel — 攻占任务面板测试
 *
 * 覆盖场景：
 * - 基础渲染：面板标题、任务数量、任务项
 * - 空状态：任务数组为空/仅有已完成任务时返回null
 * - 可见性：visible=false时返回null
 * - 状态显示：各状态对应正确的中文标签
 * - 状态颜色：各状态应用正确的颜色
 * - 策略标签：策略显示正确的中文标签
 * - 编队信息：将领名称和兵力
 * - ETA显示：行军中任务显示预计到达时间
 * - 进度条：行军中和攻城中任务显示进度条
 * - 路线显示：出发地→目标地
 * - 点击回调：点击任务项触发onSelectTask
 * - 关闭按钮：点击关闭按钮触发onClose
 * - 已完成任务过滤：已完成任务不显示在活跃列表中
 * - R9新增：defenseRatios驱动的攻城进度条
 * - R9新增：returnETAs驱动的回城ETA显示
 * - R9新增：已完成任务保留展示（最近5条）
 * - R9新增：onFocusMarchRoute回调
 * - R9新增：多任务同时存在时正确渲染
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SiegeTaskPanel from '../SiegeTaskPanel';
import type { SiegeTask } from '@/games/three-kingdoms/core/map/siege-task.types';

// ── Mock CSS ──
vi.mock('../SiegeTaskPanel.css', () => ({}));
vi.mock('../WorldMapTab.css', () => ({}));

// ── 辅助函数：构建 mock SiegeTask ──

function createMockTask(overrides: Partial<SiegeTask> = {}): SiegeTask {
  return {
    id: 'task-1',
    status: 'marching',
    targetId: 'city-xuchang',
    targetName: '许昌',
    sourceId: 'city-luoyang',
    sourceName: '洛阳',
    strategy: 'forceAttack',
    expedition: {
      forceId: 'force-1',
      heroId: 'hero-guanyu',
      heroName: '关羽',
      troops: 500,
    },
    cost: { troops: 200, grain: 50 },
    createdAt: Date.now() - 60000,
    marchStartedAt: Date.now() - 30000,
    estimatedArrival: Date.now() + 60000,
    arrivedAt: null,
    siegeCompletedAt: null,
    returnCompletedAt: null,
    marchPath: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
    result: null,
    ...overrides,
  };
}

describe('SiegeTaskPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 基础渲染 ──

  it('渲染面板并显示活跃任务数量', () => {
    const tasks = [
      createMockTask({ id: 'task-1' }),
      createMockTask({ id: 'task-2', status: 'sieging', targetName: '长安' }),
    ];
    render(<SiegeTaskPanel tasks={tasks} />);

    expect(screen.getByText(/攻占任务.*2/)).toBeTruthy();
    expect(screen.getByText('许昌')).toBeTruthy();
    expect(screen.getByText('长安')).toBeTruthy();
  });

  // ── 空状态 ──

  it('任务数组为空时显示空状态引导', () => {
    const { container } = render(<SiegeTaskPanel tasks={[]} />);
    // R12: 空状态不再返回 null，而是显示引导面板
    expect(container.innerHTML).not.toBe('');
    expect(screen.getByTestId('siege-task-empty-state')).toBeTruthy();
  });

  it('仅有已完成任务时面板可见（显示已完成任务区域）', () => {
    const tasks = [
      createMockTask({ id: 'task-1', status: 'completed' }),
    ];
    const { container } = render(<SiegeTaskPanel tasks={tasks} />);
    // 面板不应为空，因为已完成任务区域可以展开
    expect(container.innerHTML).not.toBe('');
    // 应有展开按钮
    expect(screen.getByText(/展开已完成任务/)).toBeTruthy();
  });

  // ── 可见性 ──

  it('visible=false时返回null', () => {
    const tasks = [createMockTask()];
    const { container } = render(<SiegeTaskPanel tasks={tasks} visible={false} />);
    expect(container.innerHTML).toBe('');
  });

  // ── 状态标签 ──

  it('显示正确的状态标签 — preparing', () => {
    const tasks = [createMockTask({ status: 'preparing' })];
    render(<SiegeTaskPanel tasks={tasks} />);
    expect(screen.getByText(/准备中/)).toBeTruthy();
  });

  it('显示正确的状态标签 — marching', () => {
    const tasks = [createMockTask({ status: 'marching' })];
    render(<SiegeTaskPanel tasks={tasks} />);
    expect(screen.getByText(/行军中/)).toBeTruthy();
  });

  it('显示正确的状态标签 — sieging', () => {
    const tasks = [createMockTask({ status: 'sieging' })];
    render(<SiegeTaskPanel tasks={tasks} />);
    expect(screen.getByText(/攻城中/)).toBeTruthy();
  });

  it('显示正确的状态标签 — settling', () => {
    const tasks = [createMockTask({ status: 'settling' })];
    render(<SiegeTaskPanel tasks={tasks} />);
    expect(screen.getByText(/结算中/)).toBeTruthy();
  });

  it('显示正确的状态标签 — returning', () => {
    const tasks = [createMockTask({ status: 'returning' })];
    render(<SiegeTaskPanel tasks={tasks} />);
    expect(screen.getByText(/回城中/)).toBeTruthy();
  });

  // ── 状态颜色 ──

  it('行军中状态应用蓝色 (#4a9eff)', () => {
    const tasks = [createMockTask({ status: 'marching' })];
    render(<SiegeTaskPanel tasks={tasks} />);
    const statusEl = screen.getByText(/行军中/).closest('.siege-task-panel__status');
    expect(statusEl).toBeTruthy();
    expect(statusEl!.style.color).toBe('rgb(74, 158, 255)'); // #4a9eff
  });

  it('攻城中状态应用蓝色 (#4a9eff)', () => {
    const tasks = [createMockTask({ status: 'sieging' })];
    render(<SiegeTaskPanel tasks={tasks} />);
    const statusEl = screen.getByText(/攻城中/).closest('.siege-task-panel__status');
    expect(statusEl).toBeTruthy();
    expect(statusEl!.style.color).toBe('rgb(74, 158, 255)'); // #4a9eff
  });

  it('回城中状态应用紫色 (#9c27b0)', () => {
    const tasks = [createMockTask({ status: 'returning' })];
    render(<SiegeTaskPanel tasks={tasks} />);
    const statusEl = screen.getByText(/回城中/).closest('.siege-task-panel__status');
    expect(statusEl).toBeTruthy();
    expect(statusEl!.style.color).toBe('rgb(156, 39, 176)'); // #9c27b0
  });

  it('准备中状态应用灰色 (#888)', () => {
    const tasks = [createMockTask({ status: 'preparing' })];
    render(<SiegeTaskPanel tasks={tasks} />);
    const statusEl = screen.getByText(/准备中/).closest('.siege-task-panel__status');
    expect(statusEl).toBeTruthy();
    expect(statusEl!.style.color).toBe('rgb(136, 136, 136)'); // #888
  });

  // ── 策略标签 ──

  it('显示策略标签 — forceAttack→强攻', () => {
    const tasks = [createMockTask({ strategy: 'forceAttack' })];
    render(<SiegeTaskPanel tasks={tasks} />);
    expect(screen.getByText('强攻')).toBeTruthy();
  });

  it('显示策略标签 — siege→围困', () => {
    const tasks = [createMockTask({ strategy: 'siege' })];
    render(<SiegeTaskPanel tasks={tasks} />);
    expect(screen.getByText('围困')).toBeTruthy();
  });

  it('显示策略标签 — nightRaid→夜袭', () => {
    const tasks = [createMockTask({ strategy: 'nightRaid' })];
    render(<SiegeTaskPanel tasks={tasks} />);
    expect(screen.getByText('夜袭')).toBeTruthy();
  });

  it('显示策略标签 — insider→内应', () => {
    const tasks = [createMockTask({ strategy: 'insider' })];
    render(<SiegeTaskPanel tasks={tasks} />);
    expect(screen.getByText('内应')).toBeTruthy();
  });

  it('策略为null时不显示策略标签', () => {
    const tasks = [createMockTask({ strategy: null })];
    render(<SiegeTaskPanel tasks={tasks} />);
    expect(screen.queryByText('强攻')).toBeNull();
    expect(screen.queryByText('围困')).toBeNull();
    expect(screen.queryByText('夜袭')).toBeNull();
    expect(screen.queryByText('内应')).toBeNull();
  });

  // ── 编队信息 ──

  it('显示将领名称和兵力', () => {
    const tasks = [createMockTask({
      expedition: {
        forceId: 'force-1',
        heroId: 'hero-guanyu',
        heroName: '关羽',
        troops: 800,
      },
    })];
    render(<SiegeTaskPanel tasks={tasks} />);

    expect(screen.getByText('关羽')).toBeTruthy();
    expect(screen.getByText('800兵')).toBeTruthy();
  });

  // ── ETA 显示 ──

  it('行军中任务显示预计到达时间', () => {
    const tasks = [createMockTask({
      status: 'marching',
      estimatedArrival: Date.now() + 45000, // 45秒后到达
    })];
    render(<SiegeTaskPanel tasks={tasks} />);

    expect(screen.getByText(/预计/)).toBeTruthy();
  });

  it('非行军中任务不显示ETA', () => {
    const tasks = [createMockTask({ status: 'sieging' })];
    render(<SiegeTaskPanel tasks={tasks} />);

    expect(screen.queryByText(/预计/)).toBeNull();
  });

  // ── 进度条 ──

  it('行军中任务显示进度条（无defenseRatios时50%占位）', () => {
    const tasks = [createMockTask({ status: 'marching' })];
    const { container } = render(<SiegeTaskPanel tasks={tasks} />);

    const progressBar = container.querySelector('.siege-task-panel__progress-bar');
    expect(progressBar).toBeTruthy();
    expect((progressBar as HTMLElement).style.width).toBe('50%');
  });

  it('攻城中任务显示进度条（无defenseRatios时50%占位）', () => {
    const tasks = [createMockTask({ status: 'sieging' })];
    const { container } = render(<SiegeTaskPanel tasks={tasks} />);

    const progressBar = container.querySelector('.siege-task-panel__progress-bar');
    expect(progressBar).toBeTruthy();
    expect((progressBar as HTMLElement).style.width).toBe('50%');
  });

  it('准备中任务不显示进度条', () => {
    const tasks = [createMockTask({ status: 'preparing' })];
    const { container } = render(<SiegeTaskPanel tasks={tasks} />);

    const progressBar = container.querySelector('.siege-task-panel__progress-bar');
    expect(progressBar).toBeNull();
  });

  // ── 路线显示 ──

  it('显示出发地→目标地路线', () => {
    const tasks = [createMockTask({
      sourceName: '洛阳',
      targetName: '许昌',
    })];
    render(<SiegeTaskPanel tasks={tasks} />);

    expect(screen.getByText('洛阳 → 许昌')).toBeTruthy();
  });

  // ── 点击回调 ──

  it('点击任务项触发onSelectTask', () => {
    const task = createMockTask({ id: 'task-click-test' });
    const onSelectTask = vi.fn();
    render(<SiegeTaskPanel tasks={[task]} onSelectTask={onSelectTask} />);

    fireEvent.click(screen.getByText('许昌'));
    expect(onSelectTask).toHaveBeenCalledWith(task);
  });

  // ── 关闭按钮 ──

  it('点击关闭按钮触发onClose', () => {
    const tasks = [createMockTask()];
    const onClose = vi.fn();
    render(<SiegeTaskPanel tasks={tasks} onClose={onClose} />);

    const closeBtn = screen.getByText('✕');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── 已完成任务过滤 ──

  it('已完成任务不在活跃列表中显示', () => {
    const tasks = [
      createMockTask({ id: 'task-active', status: 'marching', targetName: '许昌' }),
      createMockTask({ id: 'task-done', status: 'completed', targetName: '长安' }),
    ];
    render(<SiegeTaskPanel tasks={tasks} />);

    // 应显示活跃任务
    expect(screen.getByText('许昌')).toBeTruthy();
    // 已完成任务的展开按钮存在，但内容不在活跃列表中
    expect(screen.getByText(/攻占任务.*1/)).toBeTruthy();
  });

  // ═══════════════════════════════════════════
  // R9 新增测试：defenseRatios 驱动的攻城进度条
  // ═══════════════════════════════════════════

  it('defenseRatios prop 传递后攻城进度条更新', () => {
    const tasks = [createMockTask({ id: 'task-siege-1', status: 'sieging' })];
    // 城防比例0.3 -> 进度 = 1 - 0.3 = 0.7 -> 70%
    const defenseRatios = { 'task-siege-1': 0.3 };
    const { container } = render(
      <SiegeTaskPanel tasks={tasks} defenseRatios={defenseRatios} />,
    );

    const progressBar = container.querySelector('.siege-task-panel__progress-bar');
    expect(progressBar).toBeTruthy();
    expect((progressBar as HTMLElement).style.width).toBe('70%');
  });

  it('defenseRatios=0时攻城进度100%', () => {
    const tasks = [createMockTask({ id: 'task-siege-2', status: 'sieging' })];
    const defenseRatios = { 'task-siege-2': 0 };
    const { container } = render(
      <SiegeTaskPanel tasks={tasks} defenseRatios={defenseRatios} />,
    );

    const progressBar = container.querySelector('.siege-task-panel__progress-bar');
    expect(progressBar).toBeTruthy();
    expect((progressBar as HTMLElement).style.width).toBe('100%');
  });

  it('defenseRatios=1时攻城进度0%', () => {
    const tasks = [createMockTask({ id: 'task-siege-3', status: 'sieging' })];
    const defenseRatios = { 'task-siege-3': 1 };
    const { container } = render(
      <SiegeTaskPanel tasks={tasks} defenseRatios={defenseRatios} />,
    );

    const progressBar = container.querySelector('.siege-task-panel__progress-bar');
    expect(progressBar).toBeTruthy();
    expect((progressBar as HTMLElement).style.width).toBe('0%');
  });

  // ═══════════════════════════════════════════
  // R9 新增测试：returnETAs 驱动的回城ETA显示
  // ═══════════════════════════════════════════

  it('returnETAs prop 传递后回城任务显示ETA', () => {
    const tasks = [createMockTask({ id: 'task-ret-1', status: 'returning' })];
    // 30秒后到达
    const returnETAs = { 'task-ret-1': Date.now() + 30000 };
    render(<SiegeTaskPanel tasks={tasks} returnETAs={returnETAs} />);

    expect(screen.getByText(/回城中 ETA:/)).toBeTruthy();
    expect(screen.getByText(/30秒/)).toBeTruthy();
  });

  it('returnETAs不存在时回城任务不显示ETA行', () => {
    const tasks = [createMockTask({ id: 'task-ret-2', status: 'returning' })];
    render(<SiegeTaskPanel tasks={tasks} />);

    expect(screen.queryByText(/回城中 ETA:/)).toBeNull();
  });

  it('returnETAs已过期时显示即将到达', () => {
    const tasks = [createMockTask({ id: 'task-ret-3', status: 'returning' })];
    // 已过期
    const returnETAs = { 'task-ret-3': Date.now() - 5000 };
    render(<SiegeTaskPanel tasks={tasks} returnETAs={returnETAs} />);

    expect(screen.getByText(/回城中 ETA: 即将到达/)).toBeTruthy();
  });

  // ═══════════════════════════════════════════
  // R9 新增测试：已完成任务保留展示
  // ═══════════════════════════════════════════

  it('已完成任务显示在底部展开区域', () => {
    const tasks = [
      createMockTask({ id: 'task-active-1', status: 'marching', targetName: '许昌' }),
      createMockTask({
        id: 'task-done-1',
        status: 'completed',
        targetName: '长安',
        result: { victory: true, casualties: null, actualCost: { troops: 100, grain: 20 }, rewardMultiplier: 1.0, specialEffectTriggered: false },
      }),
    ];
    render(<SiegeTaskPanel tasks={tasks} />);

    // 活跃任务始终显示
    expect(screen.getByText('许昌')).toBeTruthy();
    // 已完成任务默认折叠，但有展开按钮
    expect(screen.getByText(/展开已完成任务.*1/)).toBeTruthy();

    // 点击展开
    fireEvent.click(screen.getByText(/展开已完成任务/));
    // 展开后应显示已完成任务的内容
    expect(screen.getByText('长安')).toBeTruthy();
    expect(screen.getByText('胜利')).toBeTruthy();
  });

  it('已完成任务最多保留5条', () => {
    const tasks = Array.from({ length: 7 }, (_, i) =>
      createMockTask({
        id: `task-done-${i}`,
        status: 'completed',
        targetName: `城市${i}`,
        siegeCompletedAt: Date.now() - i * 1000,
      }),
    );
    render(<SiegeTaskPanel tasks={tasks} />);

    // 展开按钮显示5
    expect(screen.getByText(/展开已完成任务.*5/)).toBeTruthy();

    // 展开
    fireEvent.click(screen.getByText(/展开已完成任务/));

    // 应只显示最近5个（城市0~城市4，按时间排序）
    expect(screen.getByText('城市0')).toBeTruthy();
    expect(screen.getByText('城市4')).toBeTruthy();
    expect(screen.queryByText('城市5')).toBeNull();
    expect(screen.queryByText('城市6')).toBeNull();
  });

  it('已完成任务以暗淡样式显示', () => {
    const tasks = [
      createMockTask({
        id: 'task-done-dim',
        status: 'completed',
        targetName: '暗淡城',
        siegeCompletedAt: Date.now(),
      }),
    ];
    const { container } = render(<SiegeTaskPanel tasks={tasks} />);

    // 展开
    fireEvent.click(screen.getByText(/展开已完成任务/));

    const completedItem = container.querySelector('.siege-task-panel__item--completed');
    expect(completedItem).toBeTruthy();
    expect((completedItem as HTMLElement).style.opacity).toBe('0.6');
  });

  // ═══════════════════════════════════════════
  // R9 新增测试：onFocusMarchRoute 回调
  // ═══════════════════════════════════════════

  it('onFocusMarchRoute 回调被触发', () => {
    const tasks = [createMockTask({ id: 'task-focus-1', status: 'marching' })];
    const onFocusMarchRoute = vi.fn();
    render(
      <SiegeTaskPanel tasks={tasks} onFocusMarchRoute={onFocusMarchRoute} />,
    );

    // 聚焦路线按钮应存在
    const focusBtn = screen.getByText('聚焦路线');
    expect(focusBtn).toBeTruthy();
    fireEvent.click(focusBtn);
    expect(onFocusMarchRoute).toHaveBeenCalledWith('task-focus-1');
  });

  it('不传onFocusMarchRoute时不显示聚焦路线按钮', () => {
    const tasks = [createMockTask({ status: 'marching' })];
    render(<SiegeTaskPanel tasks={tasks} />);
    expect(screen.queryByText('聚焦路线')).toBeNull();
  });

  // ═══════════════════════════════════════════
  // R9 新增测试：多个任务同时存在时正确渲染
  // ═══════════════════════════════════════════

  it('多个任务同时存在时正确渲染所有状态', () => {
    const tasks = [
      createMockTask({ id: 'task-m', status: 'marching', targetName: '行军城' }),
      createMockTask({ id: 'task-s', status: 'sieging', targetName: '攻城城' }),
      createMockTask({ id: 'task-r', status: 'returning', targetName: '回城城' }),
      createMockTask({
        id: 'task-c',
        status: 'completed',
        targetName: '完成城',
        siegeCompletedAt: Date.now(),
      }),
    ];
    const defenseRatios = { 'task-s': 0.6 };
    const returnETAs = { 'task-r': Date.now() + 20000 };
    const { container } = render(
      <SiegeTaskPanel
        tasks={tasks}
        defenseRatios={defenseRatios}
        returnETAs={returnETAs}
      />,
    );

    // 活跃任务数量 = 3
    expect(screen.getByText(/攻占任务.*3/)).toBeTruthy();

    // 所有活跃任务目标可见
    expect(screen.getByText('行军城')).toBeTruthy();
    expect(screen.getByText('攻城城')).toBeTruthy();
    expect(screen.getByText('回城城')).toBeTruthy();

    // 回城ETA可见
    expect(screen.getByText(/回城中 ETA:/)).toBeTruthy();

    // 攻城进度条使用defenseRatios: 1-0.6=0.4 -> 40%
    const progressBars = container.querySelectorAll('.siege-task-panel__progress-bar');
    expect(progressBars.length).toBeGreaterThanOrEqual(3); // marching + sieging + returning

    // 已完成任务展开按钮
    expect(screen.getByText(/展开已完成任务.*1/)).toBeTruthy();
    fireEvent.click(screen.getByText(/展开已完成任务/));
    expect(screen.getByText('完成城')).toBeTruthy();
  });

  it('点击任务项触发onSelectTask（含新props）', () => {
    const task = createMockTask({ id: 'task-click-2', status: 'sieging', targetName: '攻城城' });
    const onSelectTask = vi.fn();
    render(
      <SiegeTaskPanel
        tasks={[task]}
        onSelectTask={onSelectTask}
        defenseRatios={{ 'task-click-2': 0.5 }}
        returnETAs={{}}
        onFocusMarchRoute={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('攻城城'));
    expect(onSelectTask).toHaveBeenCalledWith(task);
  });

  // ═══════════════════════════════════════════
  // R12 新增测试：编队摘要 (Formation Summary)
  // ═══════════════════════════════════════════

  it('R12: 编队摘要显示将领名称', () => {
    const tasks = [createMockTask({
      id: 'task-fs-1',
      status: 'marching',
      expedition: {
        forceId: 'force-1',
        heroId: 'hero-zhaoyun',
        heroName: '赵云',
        troops: 1200,
      },
    })];
    render(<SiegeTaskPanel tasks={tasks} />);

    const formationSummary = screen.getByTestId('formation-summary-task-fs-1');
    expect(formationSummary).toBeTruthy();
    expect(formationSummary.textContent).toContain('赵云');
  });

  it('R12: 编队摘要显示兵力数量', () => {
    const tasks = [createMockTask({
      id: 'task-fs-2',
      status: 'marching',
      expedition: {
        forceId: 'force-1',
        heroId: 'hero-zhangfei',
        heroName: '张飞',
        troops: 3000,
      },
    })];
    render(<SiegeTaskPanel tasks={tasks} />);

    const formationSummary = screen.getByTestId('formation-summary-task-fs-2');
    expect(formationSummary).toBeTruthy();
    expect(formationSummary.textContent).toContain('3000兵');
  });

  // ═══════════════════════════════════════════
  // R12 新增测试：状态图标 (Status Icons)
  // ═══════════════════════════════════════════

  it('R12: 行军中(marching)状态图标为 →', () => {
    const tasks = [createMockTask({ id: 'task-icon-m', status: 'marching' })];
    render(<SiegeTaskPanel tasks={tasks} />);

    const statusIcon = screen.getByTestId('status-icon-task-icon-m');
    expect(statusIcon).toBeTruthy();
    expect(statusIcon.textContent).toBe('→');
  });

  it('R12: 攻城中(sieging)状态图标为 ⚔', () => {
    const tasks = [createMockTask({ id: 'task-icon-s', status: 'sieging' })];
    render(<SiegeTaskPanel tasks={tasks} />);

    const statusIcon = screen.getByTestId('status-icon-task-icon-s');
    expect(statusIcon).toBeTruthy();
    expect(statusIcon.textContent).toBe('⚔');
  });

  it('R12: 回城中(returning)状态图标为 ←', () => {
    const tasks = [createMockTask({ id: 'task-icon-r', status: 'returning' })];
    render(<SiegeTaskPanel tasks={tasks} />);

    const statusIcon = screen.getByTestId('status-icon-task-icon-r');
    expect(statusIcon).toBeTruthy();
    expect(statusIcon.textContent).toBe('←');
  });

  it('R12: 已完成(completed)状态图标为 ✓（绿色）', () => {
    const tasks = [createMockTask({
      id: 'task-icon-c',
      status: 'completed',
      result: { victory: true, casualties: null, actualCost: { troops: 50, grain: 10 }, rewardMultiplier: 1.0, specialEffectTriggered: false },
    })];
    render(<SiegeTaskPanel tasks={tasks} />);

    // 展开已完成任务
    fireEvent.click(screen.getByText(/展开已完成任务/));

    const statusIcon = screen.getByTestId('status-icon-completed-task-icon-c');
    expect(statusIcon).toBeTruthy();
    expect(statusIcon.textContent).toBe('✓');
    // 绿色
    const statusEl = statusIcon.closest('.siege-task-panel__status');
    expect(statusEl!.style.color).toBe('rgb(76, 175, 80)'); // #4caf50
  });

  it('R12: 失败(failed)状态图标为 ✗（红色）', () => {
    const tasks = [createMockTask({
      id: 'task-icon-f',
      status: 'completed',
      result: { victory: false, casualties: null, actualCost: { troops: 200, grain: 50 }, rewardMultiplier: 0, specialEffectTriggered: false },
    })];
    render(<SiegeTaskPanel tasks={tasks} />);

    // 展开已完成任务
    fireEvent.click(screen.getByText(/展开已完成任务/));

    const statusIcon = screen.getByTestId('status-icon-completed-task-icon-f');
    expect(statusIcon).toBeTruthy();
    expect(statusIcon.textContent).toBe('✗');
    // 红色
    const statusEl = statusIcon.closest('.siege-task-panel__status');
    expect(statusEl!.style.color).toBe('rgb(244, 67, 54)'); // #f44336
  });

  it('R12: preparing状态显示正确图标 ⏳', () => {
    const task = createMockTask({ id: 'task-icon-prep', status: 'preparing' });
    render(<SiegeTaskPanel tasks={[task]} />);
    const icon = screen.getByTestId(`status-icon-task-icon-prep`);
    expect(icon.textContent).toContain('⏳');
  });

  it('R12: settling状态显示正确图标 📋', () => {
    const task = createMockTask({ id: 'task-icon-sett', status: 'settling' });
    render(<SiegeTaskPanel tasks={[task]} />);
    const icon = screen.getByTestId(`status-icon-task-icon-sett`);
    expect(icon.textContent).toContain('📋');
  });

  // ═══════════════════════════════════════════
  // R12 新增测试：空状态引导 (Empty State)
  // ═══════════════════════════════════════════

  it('R12: 无任务时显示空状态容器', () => {
    render(<SiegeTaskPanel tasks={[]} />);

    const emptyState = screen.getByTestId('siege-task-empty-state');
    expect(emptyState).toBeTruthy();
    expect(emptyState.className).toContain('siege-task-panel__empty-state');
  });

  it('R12: 空状态显示正确的引导文本', () => {
    render(<SiegeTaskPanel tasks={[]} />);

    const emptyState = screen.getByTestId('siege-task-empty-state');
    expect(emptyState.textContent).toBe('选择敌方城市开始攻城');
  });

  // ═══════════════════════════════════════════
  // R12 新增测试：创建时间显示 (Creation Time)
  // R13 Task6 P3 #2.3: 使用 vi.useFakeTimers 替代 Date.now()
  // ═══════════════════════════════════════════

  it('R12: 显示创建时间（分钟前）', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-01T12:00:00Z'));

    try {
      // 3分钟前创建
      const tasks = [createMockTask({
        id: 'task-ct-1',
        status: 'marching',
        createdAt: Date.now() - 3 * 60 * 1000,
      })];
      render(<SiegeTaskPanel tasks={tasks} />);

      const createdTime = screen.getByTestId('created-time-task-ct-1');
      expect(createdTime).toBeTruthy();
      expect(createdTime.textContent).toContain('分钟前');
    } finally {
      vi.useRealTimers();
    }
  });

  it('R12: 显示创建时间（小时前）', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-01T12:00:00Z'));

    try {
      // 2小时前创建
      const tasks = [createMockTask({
        id: 'task-ct-2',
        status: 'marching',
        createdAt: Date.now() - 2 * 60 * 60 * 1000,
      })];
      render(<SiegeTaskPanel tasks={tasks} />);

      const createdTime = screen.getByTestId('created-time-task-ct-2');
      expect(createdTime).toBeTruthy();
      expect(createdTime.textContent).toContain('小时前');
    } finally {
      vi.useRealTimers();
    }
  });

  // ═══════════════════════════════════════════
  // R13 Task6 P3 #2.3: formatElapsedTime 边界值测试
  // ═══════════════════════════════════════════

  it('R13: 59秒前显示"秒前"，61秒前显示"分钟前" (秒/分边界)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-01T12:00:00Z'));

    try {
      // 59秒前 — 应显示"秒前"
      const tasks59 = [createMockTask({
        id: 'task-boundary-59',
        status: 'marching',
        createdAt: Date.now() - 59 * 1000,
      })];
      render(<SiegeTaskPanel tasks={tasks59} />);
      const ct59 = screen.getByTestId('created-time-task-boundary-59');
      expect(ct59.textContent).toContain('秒前');

      // cleanup
      const { unmount } = render(<></>);

      // 61秒前 — 应显示"分钟前"（1分钟1秒）
      const tasks61 = [createMockTask({
        id: 'task-boundary-61',
        status: 'marching',
        createdAt: Date.now() - 61 * 1000,
      })];
      render(<SiegeTaskPanel tasks={tasks61} />);
      const ct61 = screen.getByTestId('created-time-task-boundary-61');
      expect(ct61.textContent).toContain('分钟前');
    } finally {
      vi.useRealTimers();
    }
  });

  it('R13: 3599秒前显示"分钟前"，3601秒前显示"小时前" (分/时边界)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-01T12:00:00Z'));

    try {
      // 3599秒 = 59分59秒 — 应显示"分钟前"
      const tasks3599 = [createMockTask({
        id: 'task-boundary-3599',
        status: 'marching',
        createdAt: Date.now() - 3599 * 1000,
      })];
      render(<SiegeTaskPanel tasks={tasks3599} />);
      const ct3599 = screen.getByTestId('created-time-task-boundary-3599');
      expect(ct3599.textContent).toContain('分钟前');

      // 3601秒 = 1小时1秒 — 应显示"小时前"
      const tasks3601 = [createMockTask({
        id: 'task-boundary-3601',
        status: 'marching',
        createdAt: Date.now() - 3601 * 1000,
      })];
      render(<SiegeTaskPanel tasks={tasks3601} />);
      const ct3601 = screen.getByTestId('created-time-task-boundary-3601');
      expect(ct3601.textContent).toContain('小时前');
    } finally {
      vi.useRealTimers();
    }
  });

  // ═══════════════════════════════════════════
  // R12 新增测试：向后兼容（Backward Compatibility）
  // ═══════════════════════════════════════════

  it('R12: 向后兼容 — 进度条仍然正常显示', () => {
    const tasks = [createMockTask({ id: 'task-bc-1', status: 'sieging' })];
    const defenseRatios = { 'task-bc-1': 0.4 };
    const { container } = render(
      <SiegeTaskPanel tasks={tasks} defenseRatios={defenseRatios} />,
    );

    const progressBar = container.querySelector('.siege-task-panel__progress-bar');
    expect(progressBar).toBeTruthy();
    expect((progressBar as HTMLElement).style.width).toBe('60%');
  });

  it('R12: 向后兼容 — ETA仍然正常显示', () => {
    const tasks = [createMockTask({
      id: 'task-bc-2',
      status: 'marching',
      estimatedArrival: Date.now() + 30000,
    })];
    render(<SiegeTaskPanel tasks={tasks} />);

    expect(screen.getByText(/预计/)).toBeTruthy();
  });

  it('R12: 向后兼容 — 已完成任务折叠展开仍然正常', () => {
    const tasks = [
      createMockTask({
        id: 'task-bc-3',
        status: 'completed',
        targetName: '兼容城',
        siegeCompletedAt: Date.now(),
      }),
    ];
    render(<SiegeTaskPanel tasks={tasks} />);

    expect(screen.getByText(/展开已完成任务/)).toBeTruthy();
    fireEvent.click(screen.getByText(/展开已完成任务/));
    expect(screen.getByText('兼容城')).toBeTruthy();
  });
});
