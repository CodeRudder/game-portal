/**
 * QuestDailyManager 单元测试
 *
 * 覆盖：
 * 1. refresh — 日常任务刷新（20选6）
 * 2. isRefreshedToday — 刷新状态检查
 * 3. fullReset — 完全重置
 * 4. restoreState — 状态恢复
 */

import { QuestDailyManager } from '../QuestDailyManager';

import type { QuestDef, QuestInstance } from '../../../core/quest';

describe('QuestDailyManager', () => {
  let manager: QuestDailyManager;

  const mockDefs: QuestDef[] = Array.from({ length: 20 }, (_, i) => ({
    id: `daily_${i}`,
    category: 'daily' as const,
    name: `日常${i}`,
    description: '',
    objectives: [],
    rewards: { gold: 10 },
  }));

  function makeDeps() {
    const registered: QuestDef[] = [];
    return {
      registerAndAccept: jest.fn((def: QuestDef): QuestInstance | null => {
        registered.push(def);
        return {
          instanceId: `inst_${def.id}`,
          questDefId: def.id,
          status: 'active',
          objectives: [],
          rewardClaimed: false,
        };
      }),
      expireQuest: jest.fn(),
      emitEvent: jest.fn(),
    };
  }

  beforeEach(() => {
    manager = new QuestDailyManager();
  });

  // ─── 初始状态 ─────────────────────────────

  describe('初始状态', () => {
    it('初始无日常任务', () => {
      expect(manager.getInstanceIds()).toEqual([]);
    });

    it('初始未刷新', () => {
      expect(manager.isRefreshedToday()).toBe(false);
    });
  });

  // ─── refresh ──────────────────────────────

  describe('refresh', () => {
    it('未注入依赖应返回空数组', () => {
      const result = manager.refresh();
      expect(result).toEqual([]);
    });

    it('注入依赖后应刷新任务', () => {
      const deps = makeDeps();
      manager.setDeps(deps);
      const result = manager.refresh();
      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBeLessThanOrEqual(6);
    });

    it('同一天重复刷新应返回空', () => {
      const deps = makeDeps();
      manager.setDeps(deps);
      manager.refresh();
      const result = manager.refresh();
      expect(result).toEqual([]);
    });

    it('应触发事件', () => {
      const deps = makeDeps();
      manager.setDeps(deps);
      manager.refresh();
      expect(deps.emitEvent).toHaveBeenCalledWith('quest:dailyRefreshed', expect.any(Object));
    });

    it('刷新后 isRefreshedToday 应为 true', () => {
      const deps = makeDeps();
      manager.setDeps(deps);
      manager.refresh();
      expect(manager.isRefreshedToday()).toBe(true);
    });
  });

  // ─── fullReset ────────────────────────────

  describe('fullReset', () => {
    it('应清除所有状态', () => {
      const deps = makeDeps();
      manager.setDeps(deps);
      manager.refresh();
      manager.fullReset();
      expect(manager.getInstanceIds()).toEqual([]);
      expect(manager.getRefreshDate()).toBe('');
    });
  });

  // ─── restoreState ─────────────────────────

  describe('restoreState', () => {
    it('应恢复外部状态', () => {
      manager.restoreState('2024-01-01', ['inst_1', 'inst_2']);
      expect(manager.getRefreshDate()).toBe('2024-01-01');
      expect(manager.getInstanceIds()).toEqual(['inst_1', 'inst_2']);
    });
  });
});
