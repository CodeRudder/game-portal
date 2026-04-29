/**
 * QuestActivityManager 单元测试
 *
 * 覆盖：
 * 1. getState / getCurrentPoints / getMaxPoints
 * 2. addPoints — 活跃度增加（不超过最大值）
 * 3. claimMilestone — 里程碑领取
 * 4. resetDaily / fullReset — 重置
 * 5. restoreState — 状态恢复
 */

import { QuestActivityManager, MAX_ACTIVITY_POINTS } from '../QuestActivityManager';

describe('QuestActivityManager', () => {
  let manager: QuestActivityManager;

  beforeEach(() => {
    manager = new QuestActivityManager();
  });

  // ─── 初始状态 ─────────────────────────────

  describe('初始状态', () => {
    it('初始活跃度应为 0', () => {
      expect(manager.getCurrentPoints()).toBe(0);
    });

    it('最大活跃度应为 MAX_ACTIVITY_POINTS', () => {
      expect(manager.getMaxPoints()).toBe(MAX_ACTIVITY_POINTS);
    });

    it('应有里程碑列表', () => {
      const milestones = manager.getMilestones();
      expect(milestones.length).toBeGreaterThan(0);
    });

    it('getState 应返回独立副本', () => {
      const s1 = manager.getState();
      const s2 = manager.getState();
      expect(s1).not.toBe(s2);
      expect(s1).toEqual(s2);
    });
  });

  // ─── addPoints ────────────────────────────

  describe('addPoints', () => {
    it('应正确增加活跃度', () => {
      manager.addPoints(30);
      expect(manager.getCurrentPoints()).toBe(30);
    });

    it('不应超过最大值', () => {
      manager.addPoints(MAX_ACTIVITY_POINTS + 100);
      expect(manager.getCurrentPoints()).toBe(MAX_ACTIVITY_POINTS);
    });

    it('累加后不应超过最大值', () => {
      manager.addPoints(80);
      manager.addPoints(50);
      expect(manager.getCurrentPoints()).toBe(MAX_ACTIVITY_POINTS);
    });

    it('增加0应无变化', () => {
      manager.addPoints(0);
      expect(manager.getCurrentPoints()).toBe(0);
    });
  });

  // ─── claimMilestone ───────────────────────

  describe('claimMilestone', () => {
    it('活跃度不足应返回 null', () => {
      const result = manager.claimMilestone(0);
      expect(result).toBeNull();
    });

    it('活跃度足够且未领取应成功', () => {
      manager.addPoints(MAX_ACTIVITY_POINTS);
      const milestones = manager.getMilestones();
      // 找到第一个可达的里程碑
      const reachable = milestones.find(m => manager.getCurrentPoints() >= m.points);
      if (reachable) {
        const idx = milestones.indexOf(reachable);
        const result = manager.claimMilestone(idx);
        expect(result).not.toBeNull();
      }
    });

    it('重复领取应返回 null', () => {
      manager.addPoints(MAX_ACTIVITY_POINTS);
      const milestones = manager.getMilestones();
      const reachable = milestones.find(m => manager.getCurrentPoints() >= m.points);
      if (reachable) {
        const idx = milestones.indexOf(reachable);
        manager.claimMilestone(idx);
        expect(manager.claimMilestone(idx)).toBeNull();
      }
    });

    it('越界索引应返回 null', () => {
      expect(manager.claimMilestone(-1)).toBeNull();
      expect(manager.claimMilestone(999)).toBeNull();
    });
  });

  // ─── resetDaily ───────────────────────────

  describe('resetDaily', () => {
    it('应重置活跃度为0', () => {
      manager.addPoints(50);
      manager.resetDaily();
      expect(manager.getCurrentPoints()).toBe(0);
    });

    it('应更新 lastResetDate', () => {
      manager.resetDaily();
      const state = manager.getState();
      expect(state.lastResetDate).not.toBe('');
    });
  });

  // ─── fullReset ────────────────────────────

  describe('fullReset', () => {
    it('应完全重置状态', () => {
      manager.addPoints(50);
      manager.fullReset();
      expect(manager.getCurrentPoints()).toBe(0);
      expect(manager.getState().lastResetDate).toBe('');
    });
  });

  // ─── restoreState ─────────────────────────

  describe('restoreState', () => {
    it('应从外部恢复状态', () => {
      const state = {
        currentPoints: 42,
        maxPoints: MAX_ACTIVITY_POINTS,
        milestones: [],
        lastResetDate: '2024-01-01',
      };
      manager.restoreState(state);
      expect(manager.getCurrentPoints()).toBe(42);
      expect(manager.getState().lastResetDate).toBe('2024-01-01');
    });
  });
});
