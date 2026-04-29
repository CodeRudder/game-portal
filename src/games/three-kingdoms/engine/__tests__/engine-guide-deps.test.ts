/**
 * engine-guide-deps.ts 单元测试
 *
 * 覆盖：
 * - createGuideSystems: 创建所有引导子系统实例
 * - registerGuideSystems: 注册到 SubsystemRegistry
 * - initGuideSystems: 初始化 + setStateMachine 依赖注入
 * - resetGuideSystems: 重置所有子系统
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  createGuideSystems,
  registerGuideSystems,
  initGuideSystems,
  resetGuideSystems,
} from '../engine-guide-deps';
import type { GuideSystems } from '../engine-guide-deps';
import type { SubsystemRegistry } from '../../core/engine/SubsystemRegistry';
import type { ISystemDeps } from '../../core/types';

// ── Mock factories ──────────────────────────────────

function createMockSubsystemRegistry(): {
  registry: SubsystemRegistry;
  registered: Map<string, unknown>;
} {
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

// ═══════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════

describe('engine-guide-deps', () => {
  // ── createGuideSystems ─────────────────────────────

  describe('createGuideSystems()', () => {
    it('创建包含所有 7 个子系统的集合', () => {
      const systems = createGuideSystems();

      expect(systems.tutorialStateMachine).toBeDefined();
      expect(systems.storyEventPlayer).toBeDefined();
      expect(systems.tutorialStepManager).toBeDefined();
      expect(systems.tutorialStepExecutor).toBeDefined();
      expect(systems.tutorialMaskSystem).toBeDefined();
      expect(systems.tutorialStorage).toBeDefined();
      expect(systems.firstLaunchDetector).toBeDefined();
    });

    it('每次调用返回新实例（非单例）', () => {
      const a = createGuideSystems();
      const b = createGuideSystems();
      expect(a.tutorialStateMachine).not.toBe(b.tutorialStateMachine);
      expect(a.storyEventPlayer).not.toBe(b.storyEventPlayer);
    });
  });

  // ── registerGuideSystems ───────────────────────────

  describe('registerGuideSystems()', () => {
    it('注册所有 7 个子系统到 registry', () => {
      const { registry, registered } = createMockSubsystemRegistry();
      const systems = createGuideSystems();

      registerGuideSystems(registry, systems);

      expect(registered.size).toBe(7);
      expect(registered.get('tutorialStateMachine')).toBe(systems.tutorialStateMachine);
      expect(registered.get('storyEventPlayer')).toBe(systems.storyEventPlayer);
      expect(registered.get('tutorialStepManager')).toBe(systems.tutorialStepManager);
      expect(registered.get('tutorialStepExecutor')).toBe(systems.tutorialStepExecutor);
      expect(registered.get('tutorialMaskSystem')).toBe(systems.tutorialMaskSystem);
      expect(registered.get('tutorialStorage')).toBe(systems.tutorialStorage);
      expect(registered.get('firstLaunchDetector')).toBe(systems.firstLaunchDetector);
    });

    it('调用 registry.register 7 次', () => {
      const { registry } = createMockSubsystemRegistry();
      const systems = createGuideSystems();

      registerGuideSystems(registry, systems);

      expect(registry.register).toHaveBeenCalledTimes(7);
    });
  });

  // ── initGuideSystems ───────────────────────────────

  describe('initGuideSystems()', () => {
    it('调用所有子系统的 init(deps)', () => {
      const systems = createGuideSystems();
      const deps = createMockDeps();

      // Spy on init methods
      const initSpies = [
        vi.spyOn(systems.tutorialStateMachine, 'init'),
        vi.spyOn(systems.storyEventPlayer, 'init'),
        vi.spyOn(systems.tutorialStepManager, 'init'),
        vi.spyOn(systems.tutorialStepExecutor, 'init'),
        vi.spyOn(systems.tutorialMaskSystem, 'init'),
        vi.spyOn(systems.tutorialStorage, 'init'),
        vi.spyOn(systems.firstLaunchDetector, 'init'),
      ];

      initGuideSystems(systems, deps);

      for (const spy of initSpies) {
        expect(spy).toHaveBeenCalledWith(deps);
      }
    });

    it('调用 setStateMachine 注入状态机到 4 个子系统', () => {
      const systems = createGuideSystems();
      const deps = createMockDeps();

      const smSpy1 = vi.spyOn(systems.tutorialStepManager, 'setStateMachine');
      const smSpy2 = vi.spyOn(systems.storyEventPlayer, 'setStateMachine');
      const smSpy3 = vi.spyOn(systems.tutorialStorage, 'setStateMachine');
      const smSpy4 = vi.spyOn(systems.firstLaunchDetector, 'setStateMachine');

      initGuideSystems(systems, deps);

      // 所有 4 个子系统应该收到同一个 TutorialStateMachine 实例
      const sm = systems.tutorialStateMachine;
      expect(smSpy1).toHaveBeenCalledWith(sm);
      expect(smSpy2).toHaveBeenCalledWith(sm);
      expect(smSpy3).toHaveBeenCalledWith(sm);
      expect(smSpy4).toHaveBeenCalledWith(sm);
    });

    it('setStateMachine 注入的是 init 后的同一个实例', () => {
      const systems = createGuideSystems();
      const deps = createMockDeps();

      const smSpy = vi.spyOn(systems.tutorialStepManager, 'setStateMachine');

      initGuideSystems(systems, deps);

      const injectedSm = smSpy.mock.calls[0][0];
      expect(injectedSm).toBe(systems.tutorialStateMachine);
    });
  });

  // ── resetGuideSystems ──────────────────────────────

  describe('resetGuideSystems()', () => {
    it('调用所有子系统的 reset()', () => {
      const systems = createGuideSystems();

      const resetSpies = [
        vi.spyOn(systems.tutorialStateMachine, 'reset'),
        vi.spyOn(systems.storyEventPlayer, 'reset'),
        vi.spyOn(systems.tutorialStepManager, 'reset'),
        vi.spyOn(systems.tutorialMaskSystem, 'reset'),
        vi.spyOn(systems.tutorialStorage, 'reset'),
        vi.spyOn(systems.firstLaunchDetector, 'reset'),
      ];

      resetGuideSystems(systems);

      for (const spy of resetSpies) {
        expect(spy).toHaveBeenCalled();
      }
    });
  });
});
