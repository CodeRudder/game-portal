/**
 * engine-event-deps.ts 单元测试
 *
 * 覆盖：
 * - createEventSystems: 创建所有事件子系统实例
 * - initEventSystems: 按顺序初始化所有子系统
 */

import { vi, describe, it, expect } from 'vitest';
import { createEventSystems, initEventSystems } from '../engine-event-deps';
import type { ISystemDeps } from '../../core/types';

function createMockDeps(): ISystemDeps {
  return {
    eventBus: { on: vi.fn(), off: vi.fn(), emit: vi.fn() } as unknown,
    config: { get: vi.fn(), register: vi.fn() } as unknown,
    registry: { get: vi.fn(), register: vi.fn() } as unknown,
  } as unknown as ISystemDeps;
}

describe('engine-event-deps', () => {
  // ── createEventSystems ─────────────────────────────

  describe('createEventSystems()', () => {
    it('创建包含所有 6 个子系统的集合', () => {
      const systems = createEventSystems();

      expect(systems.trigger).toBeDefined();
      expect(systems.notification).toBeDefined();
      expect(systems.uiNotification).toBeDefined();
      expect(systems.chain).toBeDefined();
      expect(systems.log).toBeDefined();
      expect(systems.offline).toBeDefined();
    });

    it('每次调用返回新实例', () => {
      const a = createEventSystems();
      const b = createEventSystems();
      expect(a.trigger).not.toBe(b.trigger);
      expect(a.notification).not.toBe(b.notification);
    });
  });

  // ── initEventSystems ───────────────────────────────

  describe('initEventSystems()', () => {
    it('调用所有子系统的 init(deps)', () => {
      const systems = createEventSystems();
      const deps = createMockDeps();

      const initSpies = [
        vi.spyOn(systems.trigger, 'init'),
        vi.spyOn(systems.notification, 'init'),
        vi.spyOn(systems.uiNotification, 'init'),
        vi.spyOn(systems.chain, 'init'),
        vi.spyOn(systems.log, 'init'),
        vi.spyOn(systems.offline, 'init'),
      ];

      initEventSystems(systems, deps);

      for (const spy of initSpies) {
        expect(spy).toHaveBeenCalledWith(deps);
      }
    });

    it('初始化顺序：trigger → notification → uiNotification → chain → log → offline', () => {
      const systems = createEventSystems();
      const deps = createMockDeps();
      const order: string[] = [];

      vi.spyOn(systems.trigger, 'init').mockImplementation(() => order.push('trigger'));
      vi.spyOn(systems.notification, 'init').mockImplementation(() => order.push('notification'));
      vi.spyOn(systems.uiNotification, 'init').mockImplementation(() => order.push('uiNotification'));
      vi.spyOn(systems.chain, 'init').mockImplementation(() => order.push('chain'));
      vi.spyOn(systems.log, 'init').mockImplementation(() => order.push('log'));
      vi.spyOn(systems.offline, 'init').mockImplementation(() => order.push('offline'));

      initEventSystems(systems, deps);

      expect(order).toEqual(['trigger', 'notification', 'uiNotification', 'chain', 'log', 'offline']);
    });
  });
});
