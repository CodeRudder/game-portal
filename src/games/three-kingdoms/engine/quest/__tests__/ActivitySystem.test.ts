/**
 * ActivitySystem 单元测试
 *
 * 覆盖活跃度系统的所有功能：
 * - ISubsystem 接口
 * - 活跃度累积（#18）
 * - 里程碑宝箱奖励
 * - 每日重置
 * - 序列化
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ActivitySystem } from '../ActivitySystem';
import type { ISystemDeps } from '../../../core/types';
import { DEFAULT_ACTIVITY_MILESTONES } from '../../../core/quest';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

function mockDeps(): ISystemDeps {
  return {
    eventBus: {
      on: vi.fn().mockReturnValue(vi.fn()),
      once: vi.fn().mockReturnValue(vi.fn()),
      emit: vi.fn(),
      off: vi.fn(),
      removeAllListeners: vi.fn(),
    },
    config: { get: vi.fn(), set: vi.fn() },
    registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(), has: vi.fn(), unregister: vi.fn() },
  } as unknown as ISystemDeps;
}

function createSystem(): ActivitySystem {
  const sys = new ActivitySystem();
  sys.init(mockDeps());
  return sys;
}

// ═══════════════════════════════════════════════════════════

describe('ActivitySystem', () => {
  let system: ActivitySystem;

  beforeEach(() => {
    system = createSystem();
  });

  // ═══════════════════════════════════════════
  // 1. ISubsystem 接口
  // ═══════════════════════════════════════════
  describe('ISubsystem 接口', () => {
    it('name 为 activity', () => {
      expect(system.name).toBe('activity');
    });

    it('init 后系统可用', () => {
      const sys = new ActivitySystem();
      sys.init(mockDeps());
      expect(sys.getState()).toBeDefined();
    });

    it('reset 恢复初始状态', () => {
      system.addPoints(50);
      system.reset();
      expect(system.getCurrentPoints()).toBe(0);
    });

    it('getState 返回活跃度状态', () => {
      const state = system.getState();
      expect(state).toHaveProperty('activity');
      expect(state.activity.currentPoints).toBe(0);
    });
  });

  // ═══════════════════════════════════════════
  // 2. 活跃度累积（#18）
  // ═══════════════════════════════════════════
  describe('活跃度累积', () => {
    it('增加活跃度点数', () => {
      system.addPoints(10);
      expect(system.getCurrentPoints()).toBe(10);
    });

    it('累积活跃度不超过最大值', () => {
      system.addPoints(200);
      expect(system.getCurrentPoints()).toBe(system.getMaxPoints());
    });

    it('多次增加累积', () => {
      system.addPoints(30);
      system.addPoints(40);
      expect(system.getCurrentPoints()).toBe(70);
    });

    it('增加后触发事件', () => {
      const deps = mockDeps();
      const sys = new ActivitySystem();
      sys.init(deps);
      sys.addPoints(10);
      expect(deps.eventBus.emit).toHaveBeenCalledWith('quest:activityChanged', {
        current: 10,
        max: 100,
      });
    });

    it('getProgressRatio 返回正确比例', () => {
      expect(system.getProgressRatio()).toBe(0);
      system.addPoints(50);
      expect(system.getProgressRatio()).toBe(0.5);
    });

    it('getMaxPoints 返回 100', () => {
      expect(system.getMaxPoints()).toBe(100);
    });
  });

  // ═══════════════════════════════════════════
  // 3. 里程碑宝箱奖励（#18）
  // ═══════════════════════════════════════════
  describe('里程碑宝箱奖励', () => {
    it('默认有5个里程碑', () => {
      const state = system.getActivityState();
      expect(state.milestones).toHaveLength(5);
    });

    it('里程碑阈值为 20/40/60/80/100', () => {
      const state = system.getActivityState();
      const points = state.milestones.map((m) => m.points);
      expect(points).toEqual([20, 40, 60, 80, 100]);
    });

    it('活跃度不足时不能领取宝箱', () => {
      expect(system.claimMilestone(0)).toBeNull();
    });

    it('活跃度达到阈值后可以领取宝箱', () => {
      const rewards: unknown[] = [];
      system.setRewardCallback((r) => rewards.push(r));

      system.addPoints(20);
      const reward = system.claimMilestone(0);
      expect(reward).not.toBeNull();
      expect(reward!.resources!.gold).toBe(100);
      expect(rewards).toHaveLength(1);
    });

    it('已领取的宝箱不能重复领取', () => {
      system.addPoints(20);
      system.claimMilestone(0);
      expect(system.claimMilestone(0)).toBeNull();
    });

    it('领取宝箱后标记为已领取', () => {
      system.addPoints(20);
      system.claimMilestone(0);
      const state = system.getActivityState();
      expect(state.milestones[0].claimed).toBe(true);
    });

    it('可以领取多个宝箱', () => {
      system.addPoints(60);
      expect(system.claimMilestone(0)).not.toBeNull();
      expect(system.claimMilestone(1)).not.toBeNull();
      expect(system.claimMilestone(2)).not.toBeNull();
    });

    it('索引越界返回 null', () => {
      expect(system.claimMilestone(-1)).toBeNull();
      expect(system.claimMilestone(99)).toBeNull();
    });

    it('isMilestoneClaimable 判断正确', () => {
      expect(system.isMilestoneClaimable(0)).toBe(false);
      system.addPoints(20);
      expect(system.isMilestoneClaimable(0)).toBe(true);
      system.claimMilestone(0);
      expect(system.isMilestoneClaimable(0)).toBe(false);
    });

    it('getNextClaimableIndex 返回正确索引', () => {
      expect(system.getNextClaimableIndex()).toBe(-1);
      system.addPoints(40);
      expect(system.getNextClaimableIndex()).toBe(0);
      system.claimMilestone(0);
      expect(system.getNextClaimableIndex()).toBe(1);
    });

    it('claimAllMilestones 一键领取所有可领取的', () => {
      system.addPoints(60);
      const rewards = system.claimAllMilestones();
      expect(rewards).toHaveLength(3); // 20, 40, 60
    });

    it('领取宝箱触发事件', () => {
      const deps = mockDeps();
      const sys = new ActivitySystem();
      sys.init(deps);
      sys.addPoints(20);
      sys.claimMilestone(0);
      expect(deps.eventBus.emit).toHaveBeenCalledWith('quest:activityMilestoneClaimed', {
        index: 0,
        points: 20,
      });
    });
  });

  // ═══════════════════════════════════════════
  // 4. 每日重置
  // ═══════════════════════════════════════════
  describe('每日重置', () => {
    it('resetDaily 清零活跃度', () => {
      system.addPoints(50);
      system.resetDaily();
      expect(system.getCurrentPoints()).toBe(0);
    });

    it('resetDaily 重置所有宝箱为未领取', () => {
      system.addPoints(50);
      system.claimMilestone(0);
      system.resetDaily();

      const state = system.getActivityState();
      expect(state.milestones.every((m) => !m.claimed)).toBe(true);
    });

    it('resetDaily 触发事件', () => {
      const deps = mockDeps();
      const sys = new ActivitySystem();
      sys.init(deps);
      sys.resetDaily();
      expect(deps.eventBus.emit).toHaveBeenCalledWith('quest:activityReset', expect.any(Object));
    });

    it('checkDailyReset 同一天不重置', () => {
      system.resetDaily();
      const date = system.getActivityState().lastResetDate;
      expect(system.checkDailyReset(date)).toBe(false);
    });

    it('checkDailyReset 不同天执行重置', () => {
      system.resetDaily();
      expect(system.checkDailyReset('2099-12-31')).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // 5. 序列化
  // ═══════════════════════════════════════════
  describe('序列化', () => {
    it('serialize/deserialize 保持活跃度', () => {
      system.addPoints(45);
      const data = system.serialize();
      expect(data.activityState.currentPoints).toBe(45);

      const newSystem = createSystem();
      newSystem.deserialize(data);
      expect(newSystem.getCurrentPoints()).toBe(45);
    });

    it('serialize/deserialize 保持宝箱领取状态', () => {
      system.addPoints(60);
      system.claimMilestone(0);
      system.claimMilestone(1);

      const data = system.serialize();
      const newSystem = createSystem();
      newSystem.deserialize(data);

      const state = newSystem.getActivityState();
      expect(state.milestones[0].claimed).toBe(true);
      expect(state.milestones[1].claimed).toBe(true);
      expect(state.milestones[2].claimed).toBe(false);
    });

    it('deserialize 空数据不报错', () => {
      const newSystem = createSystem();
      expect(() => newSystem.deserialize({ version: 1, activityState: { currentPoints: 0, maxPoints: 100, milestones: [], lastResetDate: '' } })).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════
  // 6. 边界情况
  // ═══════════════════════════════════════════
  describe('边界情况', () => {
    it('活跃度为0时 getProgressRatio 返回 0', () => {
      expect(system.getProgressRatio()).toBe(0);
    });

    it('活跃度满时 getProgressRatio 返回 1', () => {
      system.addPoints(100);
      expect(system.getProgressRatio()).toBe(1);
    });

    it('getActivityState 返回副本', () => {
      const state1 = system.getActivityState();
      const state2 = system.getActivityState();
      expect(state1).not.toBe(state2);
      expect(state1.milestones).not.toBe(state2.milestones);
    });
  });
});
