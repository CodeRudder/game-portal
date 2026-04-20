/**
 * QuestTrackerSystem 单元测试
 *
 * 覆盖任务追踪系统的所有功能：
 * - ISubsystem 接口
 * - EventBus 事件监听与进度驱动（#19）
 * - 任务跳转映射（#20）
 * - 绑定 QuestSystem
 */

import { QuestTrackerSystem } from '../QuestTrackerSystem';
import type { ISystemDeps } from '../../../core/types';
import { OBJECTIVE_EVENT_MAP } from '../../../core/quest';
import { EventBus } from '../../../core/events/EventBus';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

function mockDeps(eventBus?: Partial<ISystemDeps['eventBus']>): ISystemDeps {
  const bus = new EventBus();
  return {
    eventBus: eventBus ? {
      on: eventBus.on ?? jest.fn().mockReturnValue(jest.fn()),
      once: eventBus.once ?? jest.fn().mockReturnValue(jest.fn()),
      emit: eventBus.emit ?? jest.fn(),
      off: eventBus.off ?? jest.fn(),
      removeAllListeners: eventBus.removeAllListeners ?? jest.fn(),
    } : bus,
    config: { get: jest.fn(), set: jest.fn() },
    registry: { register: jest.fn(), get: jest.fn(), getAll: jest.fn(), has: jest.fn(), unregister: jest.fn() },
  } as unknown as ISystemDeps;
}

function createTracker(useRealBus = false): { tracker: QuestTrackerSystem; deps: ISystemDeps } {
  const deps = useRealBus
    ? mockDeps()
    : mockDeps({
        on: jest.fn().mockReturnValue(jest.fn()),
        once: jest.fn().mockReturnValue(jest.fn()),
        emit: jest.fn(),
        off: jest.fn(),
        removeAllListeners: jest.fn(),
      });
  const tracker = new QuestTrackerSystem();
  tracker.init(deps);
  return { tracker, deps };
}

// ═══════════════════════════════════════════════════════════

describe('QuestTrackerSystem', () => {
  let tracker: QuestTrackerSystem;

  beforeEach(() => {
    ({ tracker } = createTracker());
  });

  // ═══════════════════════════════════════════
  // 1. ISubsystem 接口
  // ═══════════════════════════════════════════
  describe('ISubsystem 接口', () => {
    it('name 为 questTracker', () => {
      expect(tracker.name).toBe('questTracker');
    });

    it('init 后加载默认跳转映射', () => {
      const state = tracker.getState();
      expect(state.jumpTargets.size).toBeGreaterThan(0);
    });

    it('reset 清除状态', () => {
      tracker.reset();
      const state = tracker.getState();
      expect(state.jumpTargets.size).toBe(0);
    });

    it('update 不抛异常', () => {
      expect(() => tracker.update(16)).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════
  // 2. EventBus 事件监听（#19）
  // ═══════════════════════════════════════════
  describe('EventBus 事件监听', () => {
    it('startTracking 注册所有目标类型的事件监听', () => {
      const { tracker, deps } = createTracker();
      const mockOn = jest.fn().mockReturnValue(jest.fn());
      (deps.eventBus as { on: typeof mockOn }).on = mockOn;

      tracker.startTracking();

      // 应为每个 OBJECTIVE_EVENT_MAP 条目注册一个监听器
      const eventTypes = Object.values(OBJECTIVE_EVENT_MAP);
      expect(mockOn).toHaveBeenCalledTimes(eventTypes.length);
      for (const eventType of eventTypes) {
        expect(mockOn).toHaveBeenCalledWith(eventType, expect.any(Function));
      }
    });

    it('unsubscribe 停止所有监听', () => {
      const unsubs = Array.from({ length: 20 }, () => jest.fn());
      const { tracker, deps } = createTracker();
      let callIdx = 0;
      (deps.eventBus as { on: () => () => void }).on = () => unsubs[callIdx++];

      tracker.startTracking();
      tracker.unsubscribe();

      for (const unsub of unsubs.slice(0, callIdx)) {
        expect(unsub).toHaveBeenCalled();
      }
    });

    it('事件触发时调用 questSystem.updateProgressByType', () => {
      const bus = new EventBus();
      const deps = {
        eventBus: bus,
        config: { get: jest.fn(), set: jest.fn() },
        registry: { register: jest.fn(), get: jest.fn(), getAll: jest.fn(), has: jest.fn(), unregister: jest.fn() },
      } as unknown as ISystemDeps;

      const tracker = new QuestTrackerSystem();
      tracker.init(deps);

      const updateFn = jest.fn();
      tracker.bindQuestSystem({ updateProgressByType: updateFn });
      tracker.startTracking();

      // 模拟建筑升级事件
      bus.emit('building:upgraded', { buildingType: 'barracks' });

      expect(updateFn).toHaveBeenCalledWith('build_upgrade', 1, { buildingType: 'barracks' });
    });

    it('未绑定 questSystem 时事件不崩溃', () => {
      const bus = new EventBus();
      const deps = {
        eventBus: bus,
        config: { get: jest.fn(), set: jest.fn() },
        registry: { register: jest.fn(), get: jest.fn(), getAll: jest.fn(), has: jest.fn(), unregister: jest.fn() },
      } as unknown as ISystemDeps;

      const tracker = new QuestTrackerSystem();
      tracker.init(deps);
      tracker.startTracking();

      expect(() => bus.emit('building:upgraded', {})).not.toThrow();
    });

    it('资源收集事件提取 resource 参数', () => {
      const bus = new EventBus();
      const deps = {
        eventBus: bus,
        config: { get: jest.fn(), set: jest.fn() },
        registry: { register: jest.fn(), get: jest.fn(), getAll: jest.fn(), has: jest.fn(), unregister: jest.fn() },
      } as unknown as ISystemDeps;

      const tracker = new QuestTrackerSystem();
      tracker.init(deps);

      const updateFn = jest.fn();
      tracker.bindQuestSystem({ updateProgressByType: updateFn });
      tracker.startTracking();

      bus.emit('resource:collected', { resource: 'grain' });
      expect(updateFn).toHaveBeenCalledWith('collect_resource', 1, { resource: 'grain' });
    });
  });

  // ═══════════════════════════════════════════
  // 3. 任务跳转映射（#20）
  // ═══════════════════════════════════════════
  describe('任务跳转映射', () => {
    it('getJumpTarget 返回默认映射', () => {
      const target = tracker.getJumpTarget('build_upgrade');
      expect(target).toBeDefined();
      expect(target!.route).toBe('/buildings');
    });

    it('getAllJumpTargets 返回所有映射', () => {
      const targets = tracker.getAllJumpTargets();
      expect(targets.length).toBeGreaterThan(0);
    });

    it('registerJumpTarget 注册自定义映射', () => {
      tracker.registerJumpTarget({
        objectiveType: 'build_upgrade',
        route: '/custom-buildings',
        description: '自定义建筑',
      });
      const target = tracker.getJumpTarget('build_upgrade');
      expect(target!.route).toBe('/custom-buildings');
    });

    it('getQuestJumpRoute 优先使用任务定义的 jumpTarget', () => {
      const route = tracker.getQuestJumpRoute({
        id: 'q1',
        title: '测试',
        description: '测试',
        category: 'main',
        objectives: [{ id: 'o1', type: 'build_upgrade', description: '升级', targetCount: 1, currentCount: 0 }],
        rewards: {},
        jumpTarget: '/custom-route',
      });
      expect(route).toBe('/custom-route');
    });

    it('getQuestJumpRoute 无 jumpTarget 时使用目标类型映射', () => {
      const route = tracker.getQuestJumpRoute({
        id: 'q1',
        title: '测试',
        description: '测试',
        category: 'main',
        objectives: [{ id: 'o1', type: 'build_upgrade', description: '升级', targetCount: 1, currentCount: 0 }],
        rewards: {},
      });
      expect(route).toBe('/buildings');
    });

    it('getQuestJumpRoute 无匹配时返回 null', () => {
      tracker.reset(); // 清除所有映射
      const route = tracker.getQuestJumpRoute({
        id: 'q1',
        title: '测试',
        description: '测试',
        category: 'main',
        objectives: [{ id: 'o1', type: 'build_upgrade', description: '升级', targetCount: 1, currentCount: 0 }],
        rewards: {},
      });
      expect(route).toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // 4. 序列化
  // ═══════════════════════════════════════════
  describe('序列化', () => {
    it('serialize 返回版本号', () => {
      const data = tracker.serialize();
      expect(data.version).toBe(1);
    });

    it('deserialize 不报错', () => {
      expect(() => tracker.deserialize({ version: 1 })).not.toThrow();
    });
  });
});
