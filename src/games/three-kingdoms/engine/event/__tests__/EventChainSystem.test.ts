/**
 * EventChainSystem 单元测试
 *
 * 覆盖事件深化系统的所有功能：
 * - ISubsystem 接口
 * - 连锁事件链推进（#10）
 * - 历史剧情事件（#11）
 * - 事件日志面板（#13）
 * - 回归急报堆（#14）
 * - 序列化
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventChainSystem } from '../EventChainSystem';
import type { EventChain, StoryEventDef } from '../EventChainSystem';
import type { ISystemDeps } from '../../../core/types';

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

function createSystem(): EventChainSystem {
  const sys = new EventChainSystem();
  sys.init(mockDeps());
  return sys;
}

function createChain(overrides?: Partial<EventChain>): EventChain {
  return {
    id: 'chain-1',
    name: '测试连锁链',
    description: '测试',
    nodes: [
      { id: 'node-0', eventDefId: 'event-a', depth: 0 },
      { id: 'node-1a', eventDefId: 'event-b1', parentNodeId: 'node-0', parentOptionId: 'option-1', depth: 1 },
      { id: 'node-1b', eventDefId: 'event-b2', parentNodeId: 'node-0', parentOptionId: 'option-2', depth: 1 },
      { id: 'node-2a', eventDefId: 'event-c1', parentNodeId: 'node-1a', parentOptionId: 'option-3', depth: 2 },
    ],
    maxDepth: 3,
    ...overrides,
  };
}

function createStoryEvent(overrides?: Partial<StoryEventDef>): StoryEventDef {
  return {
    id: 'story-1',
    title: '桃园三结义',
    storyLines: [
      { speaker: '刘备', text: '我愿与二位结为兄弟。' },
      { speaker: '关羽', text: '正合我意！', choices: [
        { text: '赞同', consequence: '三人结为兄弟', resourceChanges: { gold: 100 } },
        { text: '犹豫', consequence: '刘备独自离去', resourceChanges: {} },
      ]},
    ],
    triggerConditions: [],
    backgroundImage: 'peach-garden',
    characterPortraits: ['liubei', 'guanyu', 'zhangfei'],
    triggered: false,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════

describe('EventChainSystem', () => {
  let system: EventChainSystem;

  beforeEach(() => {
    system = createSystem();
  });

  // ═══════════════════════════════════════════
  // 1. ISubsystem 接口
  // ═══════════════════════════════════════════
  describe('ISubsystem 接口', () => {
    it('name 为 eventChain', () => {
      expect(system.name).toBe('eventChain');
    });

    it('init 后系统可用', () => {
      const state = system.getState();
      expect(state).toHaveProperty('chains');
      expect(state).toHaveProperty('eventLog');
    });

    it('reset 清除所有状态', () => {
      system.registerChain(createChain());
      system.reset();
      expect(system.getEventLog()).toHaveLength(0);
      expect(system.getReturnAlerts()).toHaveLength(0);
    });

    it('update 不抛异常', () => {
      expect(() => system.update(16)).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════
  // 2. 连锁事件链（#10）
  // ═══════════════════════════════════════════
  describe('连锁事件链', () => {
    it('registerChain 注册事件链', () => {
      system.registerChain(createChain());
      expect(system.getCurrentChainNode('chain-1')).toBeNull(); // 未开始
    });

    it('最大深度超过3时抛出异常', () => {
      expect(() => system.registerChain(createChain({ maxDepth: 4 }))).toThrow(
        '最大深度不能超过3',
      );
    });

    it('startChain 开始事件链', () => {
      system.registerChain(createChain());
      const node = system.startChain('chain-1');
      expect(node).not.toBeNull();
      expect(node!.id).toBe('node-0');
      expect(node!.depth).toBe(0);
    });

    it('startChain 不存在的链返回 null', () => {
      expect(system.startChain('nonexistent')).toBeNull();
    });

    it('advanceChain 根据选择推进到不同分支', () => {
      system.registerChain(createChain());
      system.startChain('chain-1');

      // 选择 option-1 → node-1a
      const node1a = system.advanceChain('chain-1', 'option-1');
      expect(node1a).not.toBeNull();
      expect(node1a!.eventDefId).toBe('event-b1');

      // 选择 option-3 → node-2a
      const node2a = system.advanceChain('chain-1', 'option-3');
      expect(node2a).not.toBeNull();
      expect(node2a!.eventDefId).toBe('event-c1');
    });

    it('advanceChain 不同选择触发不同分支', () => {
      system.registerChain(createChain());
      system.startChain('chain-1');

      // 选择 option-2 → node-1b
      const node1b = system.advanceChain('chain-1', 'option-2');
      expect(node1b).not.toBeNull();
      expect(node1b!.eventDefId).toBe('event-b2');
    });

    it('advanceChain 无匹配选项返回 null', () => {
      system.registerChain(createChain());
      system.startChain('chain-1');

      const node = system.advanceChain('chain-1', 'option-nonexistent');
      expect(node).toBeNull();
    });

    it('getChainProgress 返回链进度', () => {
      system.registerChain(createChain());
      system.startChain('chain-1');
      system.advanceChain('chain-1', 'option-1');

      const progress = system.getChainProgress('chain-1');
      expect(progress.completedCount).toBe(1); // node-0 完成
      expect(progress.totalCount).toBe(4);
    });

    it('不存在的链返回空进度', () => {
      const progress = system.getChainProgress('nonexistent');
      expect(progress.completedCount).toBe(0);
      expect(progress.totalCount).toBe(0);
    });

    it('advanceChain 触发 event:chainAdvanced 事件', () => {
      const deps = mockDeps();
      const sys = new EventChainSystem();
      sys.init(deps);

      sys.registerChain(createChain());
      sys.startChain('chain-1');
      sys.advanceChain('chain-1', 'option-1');

      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'event:chainAdvanced',
        expect.objectContaining({ chainId: 'chain-1' }),
      );
    });
  });

  // ═══════════════════════════════════════════
  // 3. 历史剧情事件（#11）
  // ═══════════════════════════════════════════
  describe('历史剧情事件', () => {
    it('registerStoryEvent 注册剧情事件', () => {
      system.registerStoryEvent(createStoryEvent());
      expect(system.getStoryEvent('story-1')).toBeDefined();
    });

    it('getAllStoryEvents 返回所有剧情事件', () => {
      system.registerStoryEvent(createStoryEvent({ id: 's1' }));
      system.registerStoryEvent(createStoryEvent({ id: 's2' }));
      expect(system.getAllStoryEvents()).toHaveLength(2);
    });

    it('canTriggerStoryEvent 未触发的事件可以触发', () => {
      system.registerStoryEvent(createStoryEvent());
      expect(system.canTriggerStoryEvent('story-1')).toBe(true);
    });

    it('canTriggerStoryEvent 已触发的事件不能再次触发', () => {
      system.registerStoryEvent(createStoryEvent());
      system.triggerStoryEvent('story-1');
      expect(system.canTriggerStoryEvent('story-1')).toBe(false);
    });

    it('triggerStoryEvent 触发剧情事件', () => {
      system.registerStoryEvent(createStoryEvent());
      const event = system.triggerStoryEvent('story-1');
      expect(event).not.toBeNull();
      expect(event!.triggered).toBe(true);
    });

    it('triggerStoryEvent 不存在的事件返回 null', () => {
      expect(system.triggerStoryEvent('nonexistent')).toBeNull();
    });

    it('triggerStoryEvent 记录日志', () => {
      system.registerStoryEvent(createStoryEvent());
      system.triggerStoryEvent('story-1');
      expect(system.getEventLog()).toHaveLength(1);
      expect(system.getEventLog()[0].eventType).toBe('story');
    });

    it('triggerStoryEvent 添加急报', () => {
      system.registerStoryEvent(createStoryEvent());
      system.triggerStoryEvent('story-1');
      expect(system.getReturnAlerts()).toHaveLength(1);
      expect(system.getReturnAlerts()[0].alertType).toBe('story');
    });

    it('triggerStoryEvent 触发 event:storyTriggered 事件', () => {
      const deps = mockDeps();
      const sys = new EventChainSystem();
      sys.init(deps);

      sys.registerStoryEvent(createStoryEvent());
      sys.triggerStoryEvent('story-1');

      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'event:storyTriggered',
        expect.objectContaining({ eventId: 'story-1' }),
      );
    });
  });

  // ═══════════════════════════════════════════
  // 4. 事件日志面板（#13）
  // ═══════════════════════════════════════════
  describe('事件日志面板', () => {
    it('addLogEntry 添加日志', () => {
      const entry = system.addLogEntry({
        eventDefId: 'event-1',
        title: '测试事件',
        description: '描述',
        eventType: 'random',
        triggeredTurn: 1,
        timestamp: Date.now(),
      });
      expect(entry.id).toBeDefined();
      expect(system.getEventLog()).toHaveLength(1);
    });

    it('logEventResolved 记录事件解决', () => {
      system.logEventResolved(
        'event-1', '测试', '描述', '选项A', '后果', 'random', 1, 2,
      );
      const log = system.getEventLog();
      expect(log).toHaveLength(1);
      expect(log[0].chosenOptionText).toBe('选项A');
      expect(log[0].consequenceDescription).toBe('后果');
    });

    it('getEventLog 支持按类型过滤', () => {
      system.addLogEntry({ eventDefId: 'e1', title: 'A', description: '', eventType: 'random', triggeredTurn: 1, timestamp: 0 });
      system.addLogEntry({ eventDefId: 'e2', title: 'B', description: '', eventType: 'chain', triggeredTurn: 2, timestamp: 0 });

      const random = system.getEventLog(undefined, 'random');
      expect(random).toHaveLength(1);
      expect(random[0].eventType).toBe('random');
    });

    it('getEventLog 支持限制数量', () => {
      for (let i = 0; i < 10; i++) {
        system.addLogEntry({ eventDefId: `e${i}`, title: `T${i}`, description: '', eventType: 'random', triggeredTurn: i, timestamp: 0 });
      }
      const log = system.getEventLog(3);
      expect(log).toHaveLength(3);
    });

    it('日志超过200条自动截断', () => {
      for (let i = 0; i < 250; i++) {
        system.addLogEntry({ eventDefId: `e${i}`, title: `T${i}`, description: '', eventType: 'random', triggeredTurn: i, timestamp: 0 });
      }
      expect(system.getLogCount()).toBeLessThanOrEqual(100); // 截断到100
    });

    it('getLogCount 返回日志总数', () => {
      system.addLogEntry({ eventDefId: 'e1', title: 'A', description: '', eventType: 'random', triggeredTurn: 1, timestamp: 0 });
      system.addLogEntry({ eventDefId: 'e2', title: 'B', description: '', eventType: 'random', triggeredTurn: 2, timestamp: 0 });
      expect(system.getLogCount()).toBe(2);
    });
  });

  // ═══════════════════════════════════════════
  // 5. 回归急报堆（#14）
  // ═══════════════════════════════════════════
  describe('回归急报堆', () => {
    it('addReturnAlert 添加急报', () => {
      const alert = system.addReturnAlert({
        title: '紧急事件',
        description: '敌人来袭！',
        urgency: 'high',
        alertType: 'event',
      });
      expect(alert.id).toBeDefined();
      expect(alert.read).toBe(false);
      expect(system.getReturnAlerts()).toHaveLength(1);
    });

    it('addOfflineAlerts 批量添加离线急报', () => {
      const alerts = system.addOfflineAlerts([
        { title: '事件1', description: '描述1', urgency: 'low' },
        { title: '事件2', description: '描述2', urgency: 'high' },
      ]);
      expect(alerts).toHaveLength(2);
    });

    it('getReturnAlerts 只返回未读', () => {
      system.addReturnAlert({ title: 'A', description: '', urgency: 'low', alertType: 'event' });
      system.addReturnAlert({ title: 'B', description: '', urgency: 'low', alertType: 'event' });

      system.markAlertRead(system.getReturnAlerts()[0].id);
      const unread = system.getReturnAlerts(true);
      expect(unread).toHaveLength(1);
    });

    it('markAlertRead 标记已读', () => {
      system.addReturnAlert({ title: 'A', description: '', urgency: 'low', alertType: 'event' });
      const alertId = system.getReturnAlerts()[0].id;
      expect(system.markAlertRead(alertId)).toBe(true);
      expect(system.getReturnAlerts()[0].read).toBe(true);
    });

    it('markAlertRead 不存在的 ID 返回 false', () => {
      expect(system.markAlertRead('nonexistent')).toBe(false);
    });

    it('markAllAlertsRead 全部标记已读', () => {
      system.addReturnAlert({ title: 'A', description: '', urgency: 'low', alertType: 'event' });
      system.addReturnAlert({ title: 'B', description: '', urgency: 'low', alertType: 'event' });
      system.markAllAlertsRead();
      expect(system.getUnreadAlertCount()).toBe(0);
    });

    it('clearReadAlerts 清除已读急报', () => {
      system.addReturnAlert({ title: 'A', description: '', urgency: 'low', alertType: 'event' });
      system.addReturnAlert({ title: 'B', description: '', urgency: 'low', alertType: 'event' });
      system.markAlertRead(system.getReturnAlerts()[0].id);
      system.clearReadAlerts();
      expect(system.getReturnAlerts()).toHaveLength(1);
    });

    it('getUnreadAlertCount 返回未读数量', () => {
      system.addReturnAlert({ title: 'A', description: '', urgency: 'low', alertType: 'event' });
      system.addReturnAlert({ title: 'B', description: '', urgency: 'low', alertType: 'event' });
      expect(system.getUnreadAlertCount()).toBe(2);
    });
  });

  // ═══════════════════════════════════════════
  // 6. 序列化
  // ═══════════════════════════════════════════
  describe('序列化', () => {
    it('serialize/deserialize 保持链进度', () => {
      system.registerChain(createChain());
      system.startChain('chain-1');
      system.advanceChain('chain-1', 'option-1');

      const data = system.serialize();
      const newSys = createSystem();
      newSys.registerChain(createChain());
      newSys.deserialize(data);

      const progress = newSys.getChainProgress('chain-1');
      expect(progress.completedCount).toBe(1);
    });

    it('serialize/deserialize 保持剧情事件触发状态', () => {
      system.registerStoryEvent(createStoryEvent());
      system.triggerStoryEvent('story-1');

      const data = system.serialize();
      const newSys = createSystem();
      newSys.registerStoryEvent(createStoryEvent());
      newSys.deserialize(data);

      expect(newSys.canTriggerStoryEvent('story-1')).toBe(false);
    });

    it('serialize/deserialize 保持事件日志', () => {
      system.addLogEntry({ eventDefId: 'e1', title: 'A', description: '', eventType: 'random', triggeredTurn: 1, timestamp: 0 });
      const data = system.serialize();

      const newSys = createSystem();
      newSys.deserialize(data);
      expect(newSys.getLogCount()).toBe(1);
    });

    it('serialize/deserialize 保持急报', () => {
      system.addReturnAlert({ title: 'A', description: '', urgency: 'low', alertType: 'event' });
      const data = system.serialize();

      const newSys = createSystem();
      newSys.deserialize(data);
      expect(newSys.getReturnAlerts()).toHaveLength(1);
    });
  });
});
