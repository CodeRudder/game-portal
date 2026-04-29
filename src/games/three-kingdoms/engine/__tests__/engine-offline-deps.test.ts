/**
 * engine-offline-deps.ts 单元测试
 *
 * 覆盖：
 * - createOfflineSystems: 创建所有离线子系统实例
 * - registerOfflineSystems: 注册到 SubsystemRegistry
 * - initOfflineSystems: 初始化（当前为空操作）
 * - resetOfflineSystems: 重置子系统
 */

import { vi, describe, it, expect } from 'vitest';
import {
  createOfflineSystems,
  registerOfflineSystems,
  initOfflineSystems,
  resetOfflineSystems,
} from '../engine-offline-deps';
import type { SubsystemRegistry } from '../../core/engine/SubsystemRegistry';
import type { ISystemDeps } from '../../core/types';

function createMockRegistry(): { registry: SubsystemRegistry; registered: Map<string, unknown> } {
  const registered = new Map<string, unknown>();
  const registry = {
    register: vi.fn((name: string, subsystem: unknown) => {
      registered.set(name, subsystem);
    }),
    get: vi.fn(),
    has: vi.fn(),
    unregister: vi.fn(),
    getAll: vi.fn(),
    forEach: vi.fn(),
  } as unknown as SubsystemRegistry;
  return { registry, registered };
}

function createMockDeps(): ISystemDeps {
  return {
    eventBus: { on: vi.fn(), off: vi.fn(), emit: vi.fn() } as unknown,
    config: { get: vi.fn(), register: vi.fn() } as unknown,
    registry: { get: vi.fn(), register: vi.fn() } as unknown,
  } as unknown as ISystemDeps;
}

describe('engine-offline-deps', () => {
  describe('createOfflineSystems()', () => {
    it('创建包含 3 个子系统的集合', () => {
      const systems = createOfflineSystems();
      expect(systems.offlineReward).toBeDefined();
      expect(systems.offlineEstimate).toBeDefined();
      expect(systems.offlineSnapshot).toBeDefined();
    });

    it('每次调用返回新实例', () => {
      const a = createOfflineSystems();
      const b = createOfflineSystems();
      expect(a.offlineReward).not.toBe(b.offlineReward);
      expect(a.offlineEstimate).not.toBe(b.offlineEstimate);
      expect(a.offlineSnapshot).not.toBe(b.offlineSnapshot);
    });
  });

  describe('registerOfflineSystems()', () => {
    it('注册 3 个子系统到 registry', () => {
      const { registry, registered } = createMockRegistry();
      const systems = createOfflineSystems();

      registerOfflineSystems(registry, systems);

      expect(registered.size).toBe(3);
      expect(registered.get('offlineReward')).toBe(systems.offlineReward);
      expect(registered.get('offlineEstimate')).toBe(systems.offlineEstimate);
      expect(registered.get('offlineSnapshot')).toBe(systems.offlineSnapshot);
    });

    it('调用 registry.register 3 次', () => {
      const { registry } = createMockRegistry();
      const systems = createOfflineSystems();

      registerOfflineSystems(registry, systems);

      expect(registry.register).toHaveBeenCalledTimes(3);
    });
  });

  describe('initOfflineSystems()', () => {
    it('不抛异常（当前为空操作）', () => {
      const systems = createOfflineSystems();
      const deps = createMockDeps();
      expect(() => initOfflineSystems(systems, deps)).not.toThrow();
    });
  });

  describe('resetOfflineSystems()', () => {
    it('调用 offlineReward.reset() 和 offlineSnapshot.clearSnapshot()', () => {
      const systems = createOfflineSystems();
      const rewardSpy = vi.spyOn(systems.offlineReward, 'reset');
      const snapshotSpy = vi.spyOn(systems.offlineSnapshot, 'clearSnapshot');

      resetOfflineSystems(systems);

      expect(rewardSpy).toHaveBeenCalled();
      expect(snapshotSpy).toHaveBeenCalled();
    });
  });
});
