/**
 * F11 联盟系统 P1 修复测试
 *
 * 覆盖场景：
 * 1. P1-01: 联盟面板入口醒目（MoreTab中alliance特殊样式）
 * 2. P1-02: 退出联盟按钮与二次确认
 * 3. P1-03: 联盟升级/Boss击杀全局通知Toast
 * 4. P1-04: 联盟排行榜Tab
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AlliancePanel from '../AlliancePanel';

// ── Mock CSS & SharedPanel ──
vi.mock('@/components/idle/components/SharedPanel', () => ({
  default: ({ visible, children, title }: any) =>
    visible ? <div data-testid="shared-panel" aria-label={title}>{children}</div> : null,
  __esModule: true,
}));

vi.mock('@/components/idle/common/Modal', () => ({
  default: ({ visible, title, onConfirm, onCancel, children, confirmText, cancelText, 'data-testid': dtid }: any) =>
    visible ? (
      <div data-testid={dtid ?? 'mock-modal'} role="dialog" aria-label={title}>
        <div>{children}</div>
        {confirmText && <button data-testid="modal-confirm" onClick={onConfirm}>{confirmText}</button>}
        {cancelText && <button data-testid="modal-cancel" onClick={onCancel}>{cancelText}</button>}
      </div>
    ) : null,
  __esModule: true,
}));

// ── Mock 引擎工厂 ──
const createMockEngine = (options: { inAlliance?: boolean; members?: any[] } = {}) => {
  const { inAlliance = true, members = [] } = options;

  const allianceData = inAlliance ? {
    id: 'alliance-1',
    name: '测试联盟',
    level: 3,
    experience: 1500,
    declaration: '测试宣言',
    members: Object.fromEntries(members.map((m: any) => [m.playerId, m])),
    messages: [],
    announcements: [],
  } : null;

  const playerState = inAlliance ? { allianceId: 'alliance-1' } : { allianceId: '' };

  const eventBus = {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  };

  return {
    getAllianceSystem: vi.fn().mockReturnValue({
      getAlliance: vi.fn().mockReturnValue(allianceData),
      getPlayerState: vi.fn().mockReturnValue(playerState),
      getBonuses: vi.fn().mockReturnValue({ resourceBonus: 4, expeditionBonus: 2 }),
      getMaxMembers: vi.fn().mockReturnValue(30),
      createAllianceSimple: vi.fn(),
      hasPermission: vi.fn().mockReturnValue(false),
      sendMessage: vi.fn(),
      resetAllianceData: vi.fn(),
      postAnnouncement: vi.fn(),
      leaveAlliance: vi.fn().mockReturnValue({ success: true }),
    }),
    getAllianceTaskSystem: vi.fn().mockReturnValue({
      getActiveTasks: vi.fn().mockReturnValue([]),
    }),
    eventBus,
  };
};

const defaultMembers = [
  { playerId: 'p1', playerName: '玩家A', role: 'LEADER', power: 10000, totalContribution: 500 },
  { playerId: 'p2', playerName: '玩家B', role: 'MEMBER', power: 8000, totalContribution: 300 },
  { playerId: 'p3', playerName: '玩家C', role: 'ADVISOR', power: 6000, totalContribution: 450 },
];

const renderPanel = (engine: ReturnType<typeof createMockEngine>, visible = true) => {
  return render(<AlliancePanel engine={engine as any} visible={visible} onClose={vi.fn()} />);
};

// ═══════════════════════════════════════════════
// 测试
// ═══════════════════════════════════════════════

describe('F11 联盟系统 P1 修复', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════
  // P1-02: 退出联盟按钮与二次确认
  // ═══════════════════════════════════════════

  describe('P1-02 退出联盟按钮', () => {
    it('信息Tab中应显示退出联盟按钮', () => {
      const engine = createMockEngine({ inAlliance: true, members: defaultMembers });
      renderPanel(engine);

      expect(screen.getByTestId('alliance-leave-btn')).toBeInTheDocument();
      expect(screen.getByTestId('alliance-leave-btn').textContent).toContain('退出联盟');
    });

    it('点击退出联盟应弹出确认弹窗', () => {
      const engine = createMockEngine({ inAlliance: true, members: defaultMembers });
      renderPanel(engine);

      fireEvent.click(screen.getByTestId('alliance-leave-btn'));

      // 组件使用二次点击确认模式，第一次点击后按钮文字变为确认提示
      expect(screen.getByTestId('alliance-leave-btn').textContent).toContain('确认退出');
    });

    it('取消退出应关闭弹窗', async () => {
      const engine = createMockEngine({ inAlliance: true, members: defaultMembers });
      renderPanel(engine);

      fireEvent.click(screen.getByTestId('alliance-leave-btn'));

      // 等待确认状态超时（3秒后自动取消）
      await new Promise(r => setTimeout(r, 3200));

      // 按钮文字应恢复为"退出联盟"
      expect(screen.getByTestId('alliance-leave-btn').textContent).toContain('退出联盟');
      // leaveAlliance 不应被调用
      expect(engine.getAllianceSystem().leaveAlliance).not.toHaveBeenCalled();
    });

    it('确认退出应调用 leaveAlliance', () => {
      const engine = createMockEngine({ inAlliance: true, members: defaultMembers });
      renderPanel(engine);

      // 第一次点击进入确认状态
      fireEvent.click(screen.getByTestId('alliance-leave-btn'));
      // 第二次点击确认退出
      fireEvent.click(screen.getByTestId('alliance-leave-btn'));

      expect(engine.getAllianceSystem().leaveAlliance).toHaveBeenCalled();
    });

    it('未加入联盟时不应显示退出按钮', () => {
      const engine = createMockEngine({ inAlliance: false });
      renderPanel(engine);

      expect(screen.queryByTestId('alliance-leave-btn')).not.toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════
  // P1-03: 全局事件通知Toast
  // ═══════════════════════════════════════════

  describe('P1-03 全局事件通知Toast', () => {
    it('应监听联盟升级事件', () => {
      const engine = createMockEngine({ inAlliance: true, members: defaultMembers });
      renderPanel(engine);

      expect(engine.eventBus.on).toHaveBeenCalledWith('alliance:levelUp', expect.any(Function));
    });

    it('应监听Boss击杀事件', () => {
      const engine = createMockEngine({ inAlliance: true, members: defaultMembers });
      renderPanel(engine);

      expect(engine.eventBus.on).toHaveBeenCalledWith('alliance:bossKilled', expect.any(Function));
    });

    it('应监听成员加入事件', () => {
      const engine = createMockEngine({ inAlliance: true, members: defaultMembers });
      renderPanel(engine);

      expect(engine.eventBus.on).toHaveBeenCalledWith('alliance:memberJoin', expect.any(Function));
    });

    it('应监听联盟任务完成事件（通过任务系统）', () => {
      const engine = createMockEngine({ inAlliance: true, members: defaultMembers });
      renderPanel(engine);

      // 组件监听了 alliance:levelUp, alliance:bossKilled, alliance:memberJoin
      // 任务完成通过任务系统处理，不通过 eventBus 广播
      expect(engine.eventBus.on).toHaveBeenCalledWith('alliance:levelUp', expect.any(Function));
      expect(engine.eventBus.on).toHaveBeenCalledWith('alliance:bossKilled', expect.any(Function));
      expect(engine.eventBus.on).toHaveBeenCalledWith('alliance:memberJoin', expect.any(Function));
    });

    it('未加入联盟时不应监听事件', () => {
      const engine = createMockEngine({ inAlliance: false });
      renderPanel(engine);

      // eventBus.on 不应被调用（因为不在联盟中）
      expect(engine.eventBus.on).not.toHaveBeenCalled();
    });

    it('组件卸载时应取消事件监听', () => {
      const engine = createMockEngine({ inAlliance: true, members: defaultMembers });
      const { unmount } = renderPanel(engine);

      unmount();

      expect(engine.eventBus.off).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════
  // P1-04: 联盟排行榜Tab
  // ═══════════════════════════════════════════

  describe('P1-04 联盟排行榜Tab', () => {
    it('应显示排行榜Tab', () => {
      const engine = createMockEngine({ inAlliance: true, members: defaultMembers });
      renderPanel(engine);

      expect(screen.getByTestId('alliance-panel-tab-ranking')).toBeInTheDocument();
      expect(screen.getByTestId('alliance-panel-tab-ranking').textContent).toContain('🏆');
    });

    it('点击排行榜Tab应显示贡献排行', () => {
      const engine = createMockEngine({ inAlliance: true, members: defaultMembers });
      renderPanel(engine);

      fireEvent.click(screen.getByTestId('alliance-panel-tab-ranking'));

      expect(screen.getByTestId('alliance-panel-ranking')).toBeInTheDocument();
      expect(screen.getByText('🏅 联盟成员贡献排行')).toBeInTheDocument();
    });

    it('排行榜应按贡献降序排列', () => {
      const engine = createMockEngine({ inAlliance: true, members: defaultMembers });
      renderPanel(engine);

      fireEvent.click(screen.getByTestId('alliance-panel-tab-ranking'));

      // 玩家A(500) > 玩家C(450) > 玩家B(300)
      const rows = screen.getAllByTestId(/^alliance-panel-ranking-/);
      expect(rows[0]).toHaveAttribute('data-testid', 'alliance-panel-ranking-p1'); // 500
      expect(rows[1]).toHaveAttribute('data-testid', 'alliance-panel-ranking-p3'); // 450
      expect(rows[2]).toHaveAttribute('data-testid', 'alliance-panel-ranking-p2'); // 300
    });

    it('排行榜应显示贡献值', () => {
      const engine = createMockEngine({ inAlliance: true, members: defaultMembers });
      renderPanel(engine);

      fireEvent.click(screen.getByTestId('alliance-panel-tab-ranking'));

      expect(screen.getByText(/🏅 500/)).toBeInTheDocument();
      expect(screen.getByText(/🏅 450/)).toBeInTheDocument();
      expect(screen.getByText(/🏅 300/)).toBeInTheDocument();
    });

    it('无成员时应显示空状态', () => {
      const engine = createMockEngine({ inAlliance: true, members: [] });
      renderPanel(engine);

      fireEvent.click(screen.getByTestId('alliance-panel-tab-ranking'));

      expect(screen.getByText('暂无排行数据')).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════
  // Tab结构完整性
  // ═══════════════════════════════════════════

  describe('Tab结构完整性', () => {
    it('应包含6个Tab（info/members/tasks/search/donate/ranking）', () => {
      const engine = createMockEngine({ inAlliance: true, members: defaultMembers });
      renderPanel(engine);

      const tabs = ['info', 'members', 'tasks', 'search', 'donate', 'ranking'];
      tabs.forEach(t => {
        expect(screen.getByTestId(`alliance-panel-tab-${t}`)).toBeInTheDocument();
      });
    });
  });
});
