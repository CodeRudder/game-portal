/**
 * OfflineEventSystem 离线事件系统测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OfflineEventSystem } from '../OfflineEventSystem';
import type { ISystemDeps } from '../../../core/types';

function createMockDeps(): ISystemDeps {
  return {
    eventBus: {
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      once: vi.fn(),
    },
  } as unknown as ISystemDeps;
}

describe('OfflineEventSystem', () => {
  let system: OfflineEventSystem;
  let deps: ISystemDeps;

  beforeEach(() => {
    system = new OfflineEventSystem();
    deps = createMockDeps();
    system.init(deps);
  });

  // ── 初始化 ─────────────────────────────────

  describe('初始化', () => {
    it('name为offlineEvents', () => {
      expect(system.name).toBe('offlineEvents');
    });

    it('初始无待处理事件', () => {
      expect(system.getPendingEvents()).toEqual([]);
    });

    it('reset清空状态', () => {
      system.setCities([{ id: 'c1', faction: 'player', level: 3 }]);
      system.reset();
      expect(system.getPendingEvents()).toEqual([]);
    });
  });

  // ── 城市数据 ───────────────────────────────

  describe('城市数据', () => {
    it('setCities设置城市数据', () => {
      system.setCities([
        { id: 'c1', faction: 'player', level: 3 },
        { id: 'c2', faction: 'wei', level: 2 },
      ]);
      const state = system.getState();
      expect(state).toBeTruthy();
    });
  });

  // ── 离线处理 ───────────────────────────────

  describe('离线处理', () => {
    it('短时间离线不产生事件', () => {
      system.setCities([{ id: 'c1', faction: 'player', level: 1 }]);
      const reward = system.processOfflineTime();
      expect(reward.offlineDuration).toBe(0);
    });

    it('长时间离线产生资源事件', () => {
      system.setCities([{ id: 'c1', faction: 'player', level: 1 }]);

      // 模拟1小时离线
      (system as any).lastOnlineTime = Date.now() - 3600 * 1000;
      const reward = system.processOfflineTime();

      expect(reward.offlineDuration).toBeGreaterThan(0);
      expect(reward.resources.gold).toBeGreaterThan(0);
      expect(reward.events.length).toBeGreaterThan(0);
    });

    it('非玩家城市不产生资源', () => {
      system.setCities([{ id: 'c1', faction: 'wei', level: 1 }]);

      (system as any).lastOnlineTime = Date.now() - 3600 * 1000;
      const reward = system.processOfflineTime();

      expect(reward.resources.gold || 0).toBe(0);
    });

    it('高等级城市产出更多', () => {
      system.setCities([{ id: 'c1', faction: 'player', level: 5 }]);

      (system as any).lastOnlineTime = Date.now() - 3600 * 1000;
      const reward = system.processOfflineTime();

      // level 5: multiplier = 1 + (5-1)*0.2 = 1.8
      expect(reward.resources.gold).toBeGreaterThan(1000);
    });

    it('离线时长上限24小时', () => {
      system.setCities([{ id: 'c1', faction: 'player', level: 1 }]);

      // 模拟48小时离线
      (system as any).lastOnlineTime = Date.now() - 48 * 3600 * 1000;
      const reward = system.processOfflineTime();

      // 应该被限制在24小时
      expect(reward.offlineDuration).toBeLessThanOrEqual(86400 + 1);
    });

    it('emit offline:processed事件', () => {
      system.setCities([{ id: 'c1', faction: 'player', level: 1 }]);

      (system as any).lastOnlineTime = Date.now() - 3600 * 1000;
      system.processOfflineTime();

      expect(deps.eventBus.emit).toHaveBeenCalledWith('offline:processed', expect.anything());
    });
  });

  // ── 事件管理 ───────────────────────────────

  describe('事件管理', () => {
    it('markProcessed标记事件', () => {
      system.setCities([{ id: 'c1', faction: 'player', level: 1 }]);
      (system as any).lastOnlineTime = Date.now() - 3600 * 1000;
      const reward = system.processOfflineTime();

      if (reward.events.length > 0) {
        system.markProcessed(reward.events[0].id);
        const pending = system.getPendingEvents();
        expect(pending.find(e => e.id === reward.events[0].id)).toBeUndefined();
      }
    });

    it('clearProcessed清除已处理事件', () => {
      system.setCities([{ id: 'c1', faction: 'player', level: 1 }]);
      (system as any).lastOnlineTime = Date.now() - 3600 * 1000;
      const reward = system.processOfflineTime();

      for (const event of reward.events) {
        system.markProcessed(event.id);
      }
      system.clearProcessed();

      expect(system.getPendingEvents().length).toBe(0);
    });
  });

  // ── heartbeat ──────────────────────────────

  describe('heartbeat', () => {
    it('heartbeat更新最后在线时间', () => {
      const before = system.getState().lastOnlineTime;
      system.heartbeat();
      expect(system.getState().lastOnlineTime).toBeGreaterThanOrEqual(before);
    });
  });

  // ── 序列化 ─────────────────────────────────

  describe('序列化', () => {
    it('serialize返回存档数据', () => {
      const save = system.serialize();
      expect(save.version).toBe(1);
      expect(save.lastOnlineTime).toBeGreaterThan(0);
    });

    it('deserialize恢复状态', () => {
      system.setCities([{ id: 'c1', faction: 'player', level: 1 }]);
      (system as any).lastOnlineTime = Date.now() - 3600 * 1000;
      system.processOfflineTime();

      const save = system.serialize();
      const system2 = new OfflineEventSystem();
      system2.init(createMockDeps());
      system2.deserialize(save);

      expect(system2.getState().pendingEvents.length).toBe(system.getState().pendingEvents.length);
    });

    it('deserialize处理空数据', () => {
      expect(() => system.deserialize(null as any)).not.toThrow();
    });
  });
});
