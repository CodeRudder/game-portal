/**
 * 集成测试 §10~§14 — 连锁事件+剧情事件+日志+急报
 * §10 连锁事件 §11 剧情事件 §13 事件日志 §14 急报
 * 集成：ChainEventSystem ↔ StoryEventSystem ↔ EventLogSystem ↔ EventBus
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChainEventSystem } from '../../../event/ChainEventSystem';
import type { EventChainDef, ChainNodeDef } from '../../../event/chain-event-types';
import { StoryEventSystem, type StoryEventDef, type StoryActDef } from '../../../event/StoryEventSystem';
import { EventLogSystem } from '../../../event/EventLogSystem';
import type { ISystemDeps } from '../../../../core/types';

// ─── helpers ──────────────────────────────────

function createMockDeps(): ISystemDeps {
  return {
    eventBus: { on: vi.fn().mockReturnValue(vi.fn()), once: vi.fn().mockReturnValue(vi.fn()), emit: vi.fn(), off: vi.fn(), removeAllListeners: vi.fn() },
    config: { get: vi.fn(), set: vi.fn() },
    registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(), has: vi.fn(), unregister: vi.fn() },
  } as unknown as ISystemDeps;
}

function makeChain(overrides: Partial<EventChainDef> = {}): EventChainDef {
  return {
    id: 'chain-1', name: '测试链', description: '集成测试',
    nodes: [
      { id: 'n-a', eventDefId: 'evt-a', depth: 0 },
      { id: 'n-b', eventDefId: 'evt-b', parentNodeId: 'n-a', parentOptionId: 'opt-1', depth: 1 },
      { id: 'n-c', eventDefId: 'evt-c', parentNodeId: 'n-a', parentOptionId: 'opt-2', depth: 1 },
    ],
    maxDepth: 3, ...overrides,
  };
}

function makeStory(overrides: Partial<StoryEventDef> = {}): StoryEventDef {
  return {
    id: 'story-1', title: '黄巾之乱', description: '东汉末年',
    acts: [
      { id: 'act-1', title: '第一幕', storyLines: [{ speaker: '旁白', text: '天下大乱' }] },
      { id: 'act-2', title: '第二幕', storyLines: [{ speaker: '刘备', text: '起兵' }], isFinal: true },
    ],
    triggerConditions: [{ type: 'turn', params: { minTurn: 1 } }],
    era: '黄巾之乱', order: 1, isKeyStory: true, ...overrides,
  };
}

function createEnv() {
  const deps = createMockDeps();
  const emit = vi.fn(); deps.eventBus.emit = emit;
  const chain = new ChainEventSystem(); chain.init(deps);
  const story = new StoryEventSystem(); story.init(deps);
  const log = new EventLogSystem(); log.init(deps);
  return { chain, story, log, deps, emit };
}

// ─── §10 连锁事件 ─────────────────────────────

describe('§10 连锁事件集成', () => {
  let env: ReturnType<typeof createEnv>;
  beforeEach(() => { env = createEnv(); });

  describe('§10.1 注册与启动', () => {
    it('§10.1.1 注册事件链后可查询', () => {
      env.chain.registerChain(makeChain());
      expect(env.chain.getChain('chain-1')).toBeDefined();
    });

    it('§10.1.2 批量注册事件链', () => {
      env.chain.registerChains([makeChain({ id: 'c1' }), makeChain({ id: 'c2' })]);
      expect(env.chain.getAllChains().length).toBeGreaterThanOrEqual(2);
    });

    it('§10.1.3 深度超限抛错', () => {
      expect(() => env.chain.registerChain(makeChain({ maxDepth: 999 }))).toThrow();
    });

    it('§10.1.4 启动链返回根节点', () => {
      env.chain.registerChain(makeChain());
      const root = env.chain.startChain('chain-1');
      expect(root).not.toBeNull();
      expect(root!.depth).toBe(0);
    });
  });

  describe('§10.2 推进与进度', () => {
    it('§10.2.1 推进链到分支节点', () => {
      env.chain.registerChain(makeChain());
      env.chain.startChain('chain-1');
      const r = env.chain.advanceChain('chain-1', 'opt-1');
      expect(r.success).toBe(true);
      expect(r.currentNode!.id).toBe('n-b');
    });

    it('§10.2.2 未启动链推进失败', () => {
      env.chain.registerChain(makeChain());
      expect(env.chain.advanceChain('chain-1', 'opt-1').success).toBe(false);
    });

    it('§10.2.3 获取进度与统计', () => {
      env.chain.registerChain(makeChain());
      env.chain.startChain('chain-1');
      const p = env.chain.getProgress('chain-1');
      expect(p!.isCompleted).toBe(false);
      const s = env.chain.getProgressStats('chain-1');
      expect(s).toHaveProperty('percentage');
    });

    it('§10.2.4 序列化与反序列化', () => {
      env.chain.registerChain(makeChain());
      env.chain.startChain('chain-1');
      const saved = env.chain.exportSaveData();
      const env2 = createEnv();
      env2.chain.registerChain(makeChain());
      env2.chain.importSaveData(saved);
      expect(env2.chain.isChainStarted('chain-1')).toBe(true);
    });
  });
});

// ─── §11 剧情事件 ─────────────────────────────

describe('§11 剧情事件集成', () => {
  let env: ReturnType<typeof createEnv>;
  beforeEach(() => { env = createEnv(); });

  describe('§11.1 注册与触发', () => {
    it('§11.1.1 注册与查询剧情', () => {
      env.story.registerStory(makeStory());
      expect(env.story.getStory('story-1')).toBeDefined();
    });

    it('§11.1.2 按时代查询剧情', () => {
      env.story.registerStory(makeStory({ era: '黄巾之乱' }));
      env.story.registerStory(makeStory({ id: 'story-2', era: '官渡之战', order: 2 }));
      expect(env.story.getStoriesByEra('黄巾之乱').length).toBeGreaterThanOrEqual(1);
    });

    it('§11.1.3 触发剧情', () => {
      env.story.registerStory(makeStory());
      expect(env.story.triggerStory('story-1')).not.toBeNull();
      expect(env.story.isStoryTriggered('story-1')).toBe(true);
    });

    it('§11.1.4 不存在的剧情触发返回null', () => {
      expect(env.story.triggerStory('nope')).toBeNull();
    });

    it('§11.1.5 检查触发条件', () => {
      env.story.registerStory(makeStory());
      expect(typeof env.story.canTriggerStory('story-1', 1)).toBe('boolean');
    });
  });

  describe('§11.2 推进与序列化', () => {
    it('§11.2.1 推进剧情到下一幕', () => {
      env.story.registerStory(makeStory());
      env.story.triggerStory('story-1');
      const r = env.story.advanceStory('story-1');
      expect(r).toBeDefined();
    });

    it('§11.2.2 获取当前幕', () => {
      env.story.registerStory(makeStory());
      env.story.triggerStory('story-1');
      expect(env.story.getCurrentAct('story-1')).not.toBeNull();
    });

    it('§11.2.3 剧情序列化恢复', () => {
      env.story.registerStory(makeStory());
      env.story.triggerStory('story-1');
      const saved = env.story.exportSaveData();
      const env2 = createEnv();
      env2.story.registerStory(makeStory());
      env2.story.importSaveData(saved);
      expect(env2.story.isStoryTriggered('story-1')).toBe(true);
    });
  });
});

// ─── §13 事件日志 ─────────────────────────────

describe('§13 事件日志集成', () => {
  let env: ReturnType<typeof createEnv>;
  beforeEach(() => { env = createEnv(); });

  describe('§13.1 记录与查询', () => {
    it('§13.1.1 记录事件日志', () => {
      const e = env.log.logEvent({ eventDefId: 'e1', title: '测试', description: '...', triggeredTurn: 1, timestamp: Date.now(), eventType: 'random' });
      expect(e.id).toBeDefined();
    });

    it('§13.1.2 按类型查询日志', () => {
      env.log.logEvent({ eventDefId: 'e1', title: 'A', description: '', triggeredTurn: 1, timestamp: 0, eventType: 'random' });
      env.log.logEvent({ eventDefId: 'e2', title: 'B', description: '', triggeredTurn: 2, timestamp: 0, eventType: 'story' });
      expect(env.log.getEventLog({ eventType: 'random' }).length).toBe(1);
    });

    it('§13.1.3 按回合范围查询', () => {
      env.log.logEvent({ eventDefId: 'e1', title: '早', description: '', triggeredTurn: 3, timestamp: 0, eventType: 'random' });
      env.log.logEvent({ eventDefId: 'e2', title: '晚', description: '', triggeredTurn: 15, timestamp: 0, eventType: 'random' });
      expect(env.log.getEventLog({ fromTurn: 10, toTurn: 20 }).length).toBe(1);
    });

    it('§13.1.4 日志序列化恢复', () => {
      env.log.logEvent({ eventDefId: 'e1', title: 'X', description: '', triggeredTurn: 1, timestamp: 0, eventType: 'chain' });
      const saved = env.log.exportSaveData();
      const env2 = createEnv();
      env2.log.importSaveData(saved);
      expect(env2.log.getLogCount()).toBe(1);
    });
  });

  describe('§13.2 日志与事件联动', () => {
    it('§13.2.1 连锁事件可记录到日志', () => {
      env.chain.registerChain(makeChain());
      env.chain.startChain('chain-1');
      env.log.logEvent({ eventDefId: 'evt-a', title: '连锁', description: '', triggeredTurn: 1, timestamp: 0, eventType: 'chain' });
      expect(env.log.getLogCountByType('chain')).toBe(1);
    });

    it('§13.2.2 剧情事件可记录到日志', () => {
      env.story.registerStory(makeStory());
      env.story.triggerStory('story-1');
      env.log.logEvent({ eventDefId: 'story-1', title: '剧情', description: '', triggeredTurn: 1, timestamp: 0, eventType: 'story' });
      expect(env.log.getLogCountByType('story')).toBe(1);
    });
  });
});

// ─── §14 急报 ─────────────────────────────────

describe('§14 急报集成', () => {
  let env: ReturnType<typeof createEnv>;
  beforeEach(() => { env = createEnv(); });

  describe('§14.1 急报管理', () => {
    it('§14.1.1 添加急报', () => {
      const a = env.log.addAlert({ title: '敌袭', description: '曹操南下', urgency: 'critical', alertType: 'random' });
      expect(a.id).toBeDefined();
      expect(a.read).toBe(false);
    });

    it('§14.1.2 获取急报堆统计', () => {
      env.log.addAlert({ title: 'A', description: '', urgency: 'high', alertType: 'random' });
      env.log.addAlert({ title: 'B', description: '', urgency: 'critical', alertType: 'story' });
      const s = env.log.getAlertStack();
      expect(s.totalCount).toBe(2);
      expect(s.highestUrgency).toBe('critical');
    });

    it('§14.1.3 标记已读与清除', () => {
      const a = env.log.addAlert({ title: 'X', description: '', urgency: 'medium', alertType: 'random' });
      env.log.markAlertRead(a.id);
      expect(env.log.getUnreadAlertCount()).toBe(0);
      env.log.clearReadAlerts();
      expect(env.log.getAlerts().length).toBe(0);
    });

    it('§14.1.4 批量添加离线急报', () => {
      env.log.addOfflineAlerts([
        { title: '离线1', description: '', urgency: 'medium' },
        { title: '离线2', description: '', urgency: 'high' },
      ]);
      expect(env.log.getUnreadAlertCount()).toBe(2);
    });

    it('§14.1.5 急报序列化恢复', () => {
      env.log.addAlert({ title: '急报', description: '', urgency: 'critical', alertType: 'random' });
      const saved = env.log.exportSaveData();
      const env2 = createEnv();
      env2.log.importSaveData(saved);
      expect(env2.log.getAlerts().length).toBe(1);
    });
  });
});
