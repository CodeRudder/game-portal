/**
 * 事件模块对抗式测试
 *
 * 覆盖子系统：
 *   S1: EventTriggerSystem  S2: EventChainSystem
 *   S3: EventLogSystem      S4: EventTriggerConditions
 *   S5: EventTriggerLifecycle
 *
 * 5维度：F-Normal / F-Error / F-Boundary / F-Cross / F-Lifecycle
 * @module tests/adversarial/event-adversarial
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventTriggerSystem } from '../../engine/event/EventTriggerSystem';
import { EventChainSystem } from '../../engine/event/EventChainSystem';
import { EventLogSystem } from '../../engine/event/EventLogSystem';
import { evaluateCondition } from '../../engine/event/EventTriggerConditions';
import { resolveEvent, expireEvents } from '../../engine/event/EventTriggerLifecycle';
import { DEFAULT_EVENT_TRIGGER_CONFIG } from '../../core/event';
import type {
  EventId, EventDef, EventInstance, EventCondition, EventSystemSaveData,
} from '../../core/event';
import type { EventChain, StoryEventDef } from '../../engine/event/event-chain.types';
import type { ISystemDeps } from '../../core/types/subsystem';

// ── 测试辅助 ──────────────────────────────────

const mockDeps = (): ISystemDeps => ({
  eventBus: { on: vi.fn().mockReturnValue(vi.fn()), once: vi.fn().mockReturnValue(vi.fn()), emit: vi.fn(), off: vi.fn(), removeAllListeners: vi.fn() },
  config: { get: vi.fn(), set: vi.fn() },
  registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(), has: vi.fn(), unregister: vi.fn() },
} as unknown as ISystemDeps);

function createTriggerSystem(): EventTriggerSystem { const s = new EventTriggerSystem(); s.init(mockDeps()); return s; }
function createChainSystem(): EventChainSystem { const s = new EventChainSystem(); s.init(mockDeps()); return s; }
function createLogSystem(): EventLogSystem { const s = new EventLogSystem(); s.init(mockDeps()); return s; }

function makeEventDef(o: Partial<EventDef> = {}): EventDef {
  return {
    id: 'test-event-001', title: '测试事件', description: '用于测试', triggerType: 'random',
    urgency: 'medium', scope: 'global', triggerProbability: 0.5,
    options: [
      { id: 'opt-a', text: '选项A', consequences: { description: 'A后果', resourceChanges: { gold: 100 } } },
      { id: 'opt-b', text: '选项B', consequences: { description: 'B后果', resourceChanges: { grain: -50 }, triggerEventId: 'test-event-002' } },
    ],
    ...o,
  };
}

function makeChain(o: Partial<EventChain> = {}): EventChain {
  return {
    id: 'chain-test', name: '测试链', description: '测试用', maxDepth: 3,
    nodes: [
      { id: 'node-0', eventDefId: 'evt-1', depth: 0 },
      { id: 'node-1a', eventDefId: 'evt-2a', parentNodeId: 'node-0', parentOptionId: 'opt-a', depth: 1 },
      { id: 'node-1b', eventDefId: 'evt-2b', parentNodeId: 'node-0', parentOptionId: 'opt-b', depth: 1 },
    ],
    ...o,
  };
}

function makeStoryEvent(id = 'story-001'): StoryEventDef {
  return { id, title: '剧情事件', storyLines: [{ speaker: '旁白', text: '故事开始' }], triggerConditions: [], triggered: false };
}

// ══════════════════════════════════════════════
// F-Normal: 正常流程
// ══════════════════════════════════════════════

describe('F-Normal: 事件触发系统初始化', () => {
  it('初始化后应加载预定义事件', () => {
    expect(createTriggerSystem().getAllEventDefs().length).toBeGreaterThan(0);
  });
  it('初始无活跃事件', () => { expect(createTriggerSystem().getActiveEvents()).toHaveLength(0); });
  it('初始无已完成事件', () => { expect(createTriggerSystem().getCompletedEventIds()).toHaveLength(0); });
  it('默认配置应与常量一致', () => {
    const cfg = createTriggerSystem().getConfig();
    expect(cfg.maxActiveEvents).toBe(DEFAULT_EVENT_TRIGGER_CONFIG.maxActiveEvents);
  });
});

describe('F-Normal: 事件注册与查询', () => {
  it('注册自定义事件后可查询到', () => {
    const sys = createTriggerSystem(); const def = makeEventDef();
    sys.registerEvent(def);
    expect(sys.getEventDef(def.id)).toEqual(def);
  });
  it('批量注册事件', () => {
    const sys = createTriggerSystem();
    sys.registerEvents([makeEventDef({ id: 'e1' }), makeEventDef({ id: 'e2' })]);
    expect(sys.getEventDef('e1')).toBeDefined();
    expect(sys.getEventDef('e2')).toBeDefined();
  });
  it('按触发类型查询事件', () => {
    const sys = createTriggerSystem();
    sys.registerEvent(makeEventDef({ id: 'f1', triggerType: 'fixed' }));
    expect(sys.getEventDefsByType('random').length).toBeGreaterThanOrEqual(1);
    expect(sys.getEventDefsByType('fixed').length).toBeGreaterThanOrEqual(1);
  });
  it('查询不存在的事件返回 undefined', () => { expect(createTriggerSystem().getEventDef('nonexistent')).toBeUndefined(); });
});

describe('F-Normal: 事件触发', () => {
  it('强制触发事件应成功', () => {
    const sys = createTriggerSystem(); sys.registerEvent(makeEventDef({ id: 'trigger-test' }));
    const r = sys.forceTriggerEvent('trigger-test', 1);
    expect(r.triggered).toBe(true); expect(r.instance!.eventDefId).toBe('trigger-test');
  });
  it('触发后应出现在活跃事件列表', () => {
    const sys = createTriggerSystem(); sys.registerEvent(makeEventDef({ id: 'active-test' }));
    sys.forceTriggerEvent('active-test', 1);
    expect(sys.hasActiveEvent('active-test')).toBe(true);
  });
  it('触发后可按 instanceId 获取实例', () => {
    const sys = createTriggerSystem(); sys.registerEvent(makeEventDef({ id: 'inst-test' }));
    const r = sys.forceTriggerEvent('inst-test', 1);
    expect(sys.getInstance(r.instance!.instanceId)).toBeDefined();
    expect(sys.getInstance(r.instance!.instanceId)!.status).toBe('active');
  });
  it('带过期回合的事件实例应记录 expireTurn', () => {
    const sys = createTriggerSystem(); sys.registerEvent(makeEventDef({ id: 'exp-test', expireAfterTurns: 5 }));
    expect(sys.forceTriggerEvent('exp-test', 10).instance!.expireTurn).toBe(15);
  });
  it('无过期设置的事件 expireTurn 为 null', () => {
    const sys = createTriggerSystem(); sys.registerEvent(makeEventDef({ id: 'no-exp', expireAfterTurns: null }));
    expect(sys.forceTriggerEvent('no-exp', 1).instance!.expireTurn).toBeNull();
  });
});

describe('F-Normal: 事件解决', () => {
  it('选择选项后返回正确后果', () => {
    const sys = createTriggerSystem(); sys.registerEvent(makeEventDef({ id: 'resolve-test' }));
    const t = sys.forceTriggerEvent('resolve-test', 1);
    const r = sys.resolveEvent(t.instance!.instanceId, 'opt-a');
    expect(r!.optionId).toBe('opt-a');
    expect(r!.consequences.resourceChanges!.gold).toBe(100);
  });
  it('解决后事件从活跃列表移除', () => {
    const sys = createTriggerSystem(); sys.registerEvent(makeEventDef({ id: 'rm-test' }));
    const t = sys.forceTriggerEvent('rm-test', 1);
    sys.resolveEvent(t.instance!.instanceId, 'opt-a');
    expect(sys.getActiveEvents()).toHaveLength(0);
  });
  it('解决后事件ID加入已完成集合', () => {
    const sys = createTriggerSystem(); sys.registerEvent(makeEventDef({ id: 'comp-test' }));
    const t = sys.forceTriggerEvent('comp-test', 1);
    sys.resolveEvent(t.instance!.instanceId, 'opt-a');
    expect(sys.isEventCompleted('comp-test')).toBe(true);
  });
  it('带冷却的事件解决后设置冷却', () => {
    const sys = createTriggerSystem(); sys.registerEvent(makeEventDef({ id: 'cd-test', cooldownTurns: 5 }));
    const t = sys.forceTriggerEvent('cd-test', 1);
    sys.resolveEvent(t.instance!.instanceId, 'opt-a');
    expect(sys.canTrigger('cd-test', 3)).toBe(false);
  });
  it('选择含 triggerEventId 的选项应返回 chainEventId', () => {
    const sys = createTriggerSystem(); sys.registerEvent(makeEventDef({ id: 'chain-trig' }));
    const t = sys.forceTriggerEvent('chain-trig', 1);
    expect(sys.resolveEvent(t.instance!.instanceId, 'opt-b')!.chainEventId).toBe('test-event-002');
  });
});

describe('F-Normal: 事件链系统', () => {
  it('注册事件链后可开始链', () => {
    const sys = createChainSystem(); sys.registerChain(makeChain());
    const first = sys.startChain('chain-test');
    expect(first).not.toBeNull(); expect(first!.depth).toBe(0);
  });
  it('推进事件链应返回下一个节点', () => {
    const sys = createChainSystem(); sys.registerChain(makeChain());
    sys.startChain('chain-test');
    const next = sys.advanceChain('chain-test', 'opt-a');
    expect(next!.eventDefId).toBe('evt-2a');
  });
  it('不同选项推进到不同分支', () => {
    const sys = createChainSystem(); sys.registerChain(makeChain());
    sys.startChain('chain-test');
    const nextB = sys.advanceChain('chain-test', 'opt-b');
    expect(nextB!.eventDefId).toBe('evt-2b');
  });
  it('链进度应正确统计', () => {
    const sys = createChainSystem(); sys.registerChain(makeChain());
    const p = sys.getChainProgress('chain-test');
    expect(p.completedCount).toBe(0); expect(p.totalCount).toBe(3);
  });
  it('批量注册事件链', () => {
    const sys = createChainSystem();
    sys.registerChains([makeChain({ id: 'c1' }), makeChain({ id: 'c2' })]);
    expect(sys.getChainProgress('c1')).toBeDefined();
    expect(sys.getChainProgress('c2')).toBeDefined();
  });
});

describe('F-Normal: 剧情事件', () => {
  it('注册剧情事件后可触发', () => {
    const sys = createChainSystem(); sys.registerStoryEvent(makeStoryEvent());
    expect(sys.triggerStoryEvent('story-001')!.triggered).toBe(true);
  });
  it('已触发的剧情事件不能再次触发', () => {
    const sys = createChainSystem(); sys.registerStoryEvent(makeStoryEvent());
    sys.triggerStoryEvent('story-001');
    expect(sys.triggerStoryEvent('story-001')).toBeNull();
  });
  it('canTriggerStoryEvent 对已触发事件返回 false', () => {
    const sys = createChainSystem(); sys.registerStoryEvent(makeStoryEvent());
    sys.triggerStoryEvent('story-001');
    expect(sys.canTriggerStoryEvent('story-001')).toBe(false);
  });
});

describe('F-Normal: 事件日志系统', () => {
  it('记录日志条目', () => {
    const sys = createLogSystem();
    const e = sys.logEvent({ eventDefId: 'e1', title: 'T', description: '', triggeredTurn: 5, timestamp: Date.now(), eventType: 'random' });
    expect(e.id).toMatch(/^log-/); expect(sys.getLogCount()).toBe(1);
  });
  it('按类型筛选日志', () => {
    const sys = createLogSystem();
    sys.logEvent({ eventDefId: 'e1', title: 'A', description: '', triggeredTurn: 1, timestamp: 0, eventType: 'random' });
    sys.logEvent({ eventDefId: 'e2', title: 'B', description: '', triggeredTurn: 2, timestamp: 0, eventType: 'fixed' });
    expect(sys.getEventLog({ eventType: 'random' })).toHaveLength(1);
  });
  it('按回合范围筛选日志', () => {
    const sys = createLogSystem();
    sys.logEvent({ eventDefId: 'e1', title: 'A', description: '', triggeredTurn: 3, timestamp: 0, eventType: 'random' });
    sys.logEvent({ eventDefId: 'e2', title: 'B', description: '', triggeredTurn: 7, timestamp: 0, eventType: 'random' });
    sys.logEvent({ eventDefId: 'e3', title: 'C', description: '', triggeredTurn: 12, timestamp: 0, eventType: 'random' });
    expect(sys.getEventLog({ fromTurn: 5, toTurn: 10 })).toHaveLength(1);
  });
  it('急报添加和查询', () => {
    const sys = createLogSystem();
    sys.addAlert({ title: '紧急', description: '测试急报', urgency: 'high', alertType: 'random' });
    expect(sys.getUnreadAlertCount()).toBe(1);
  });
  it('标记急报已读', () => {
    const sys = createLogSystem();
    sys.addAlert({ title: 'A', description: '', urgency: 'medium', alertType: 'fixed' });
    sys.markAlertRead(sys.getAlertStack().alerts[0].id);
    expect(sys.getUnreadAlertCount()).toBe(0);
  });
  it('批量添加离线急报', () => {
    const sys = createLogSystem();
    expect(sys.addOfflineAlerts([{ title: 'A', description: 'a', urgency: 'high' }, { title: 'B', description: 'b', urgency: 'low' }])).toHaveLength(2);
  });
});

// ══════════════════════════════════════════════
// F-Error: 错误路径
// ══════════════════════════════════════════════

describe('F-Error: 无效触发', () => {
  it('触发不存在的事件应返回失败', () => {
    const r = createTriggerSystem().forceTriggerEvent('nonexistent', 1);
    expect(r.triggered).toBe(false); expect(r.reason).toBeDefined();
  });
  it('解决不存在的事件实例返回 null', () => {
    expect(createTriggerSystem().resolveEvent('nonexistent', 'opt-a')).toBeNull();
  });
  it('选择不存在的选项返回 null', () => {
    const sys = createTriggerSystem(); sys.registerEvent(makeEventDef());
    const t = sys.forceTriggerEvent('test-event-001', 1);
    expect(sys.resolveEvent(t.instance!.instanceId, 'invalid-opt')).toBeNull();
  });
  it('对已解决的事件再次解决返回 null', () => {
    const sys = createTriggerSystem(); sys.registerEvent(makeEventDef());
    const t = sys.forceTriggerEvent('test-event-001', 1);
    const id = t.instance!.instanceId;
    sys.resolveEvent(id, 'opt-a');
    expect(sys.resolveEvent(id, 'opt-a')).toBeNull();
  });
  it('canTrigger 对不存在的事件返回 false', () => {
    expect(createTriggerSystem().canTrigger('ghost', 1)).toBe(false);
  });
});

describe('F-Error: 事件链错误路径', () => {
  it('注册 maxDepth>3 的链应抛出错误', () => {
    expect(() => createChainSystem().registerChain(makeChain({ maxDepth: 4 }))).toThrow();
  });
  it('开始不存在的链返回 null', () => { expect(createChainSystem().startChain('no-chain')).toBeNull(); });
  it('推进不存在的链返回 null', () => { expect(createChainSystem().advanceChain('no-chain', 'opt-a')).toBeNull(); });
  it('触发不存在的剧情事件返回 null', () => { expect(createChainSystem().triggerStoryEvent('no-story')).toBeNull(); });
  it('获取不存在链的进度返回零', () => {
    expect(createChainSystem().getChainProgress('no-chain')).toEqual({ completedCount: 0, totalCount: 0 });
  });
});

describe('F-Error: 日志系统错误路径', () => {
  it('标记不存在的急报已读返回 false', () => { expect(createLogSystem().markAlertRead('no-id')).toBe(false); });
  it('获取不存在的日志条目返回 undefined', () => { expect(createLogSystem().getLogEntry('no-id')).toBeUndefined(); });
  it('获取不存在的急报返回 undefined', () => { expect(createLogSystem().getAlert('no-id')).toBeUndefined(); });
  it('移除不存在的急报返回 false', () => { expect(createLogSystem().removeAlert('no-id')).toBe(false); });
});

// ══════════════════════════════════════════════
// F-Boundary: 边界条件
// ══════════════════════════════════════════════

describe('F-Boundary: NaN/Infinity 回合', () => {
  it('checkAndTriggerEvents 对 NaN 回合返回空数组', () => { expect(createTriggerSystem().checkAndTriggerEvents(NaN)).toEqual([]); });
  it('checkAndTriggerEvents 对 Infinity 回合返回空数组', () => { expect(createTriggerSystem().checkAndTriggerEvents(Infinity)).toEqual([]); });
  it('checkAndTriggerEvents 对负数回合返回空数组', () => { expect(createTriggerSystem().checkAndTriggerEvents(-1)).toEqual([]); });
});

describe('F-Boundary: 空ID和特殊字符', () => {
  it('注册空ID事件定义不崩溃', () => {
    const sys = createTriggerSystem(); sys.registerEvent(makeEventDef({ id: '' }));
    expect(sys.getEventDef('')).toBeDefined();
  });
  it('forceTriggerEvent 空ID返回失败', () => {
    expect(createTriggerSystem().forceTriggerEvent('', 1).triggered).toBe(false);
  });
  it('resolveEvent 空instanceId返回null', () => {
    expect(createTriggerSystem().resolveEvent('', 'opt-a')).toBeNull();
  });
});

describe('F-Boundary: 活跃事件上限', () => {
  it('达到上限后 canTrigger 返回 false', () => {
    const sys = createTriggerSystem(); sys.setConfig({ maxActiveEvents: 2 });
    for (let i = 0; i < 3; i++) { sys.registerEvent(makeEventDef({ id: `max-${i}` })); sys.forceTriggerEvent(`max-${i}`, 1); }
    sys.registerEvent(makeEventDef({ id: 'max-extra' }));
    expect(sys.canTrigger('max-extra', 1)).toBe(false);
  });
});

describe('F-Boundary: 事件过期', () => {
  it('expireEvents 正确处理过期事件', () => {
    const sys = createTriggerSystem(); sys.registerEvent(makeEventDef({ id: 'exp-evt', expireAfterTurns: 3 }));
    sys.forceTriggerEvent('exp-evt', 5);
    const exp = sys.expireEvents(8);
    expect(exp).toHaveLength(1); expect(exp[0].status).toBe('expired');
  });
  it('未到过期时间不触发过期', () => {
    const sys = createTriggerSystem(); sys.registerEvent(makeEventDef({ id: 'not-exp', expireAfterTurns: 10 }));
    sys.forceTriggerEvent('not-exp', 1);
    expect(sys.expireEvents(5)).toHaveLength(0);
  });
  it('expireTurn为null的事件永不过期', () => {
    const sys = createTriggerSystem(); sys.registerEvent(makeEventDef({ id: 'never-exp', expireAfterTurns: null }));
    sys.forceTriggerEvent('never-exp', 1);
    expect(sys.expireEvents(9999)).toHaveLength(0);
  });
});

describe('F-Boundary: 日志上限截断', () => {
  it('日志超过200条自动截断', () => {
    const sys = createLogSystem();
    for (let i = 0; i < 250; i++) sys.logEvent({ eventDefId: `e-${i}`, title: `T${i}`, description: '', triggeredTurn: i, timestamp: 0, eventType: 'random' });
    expect(sys.getLogCount()).toBeLessThanOrEqual(200);
  });
  it('急报超过50条自动截断', () => {
    const sys = createLogSystem();
    for (let i = 0; i < 60; i++) sys.addAlert({ title: `A${i}`, description: '', urgency: 'low', alertType: 'random' });
    expect(sys.getAlerts().length).toBeLessThanOrEqual(50);
  });
});

describe('F-Boundary: 条件评估边界', () => {
  it('evaluateCondition 对未知类型默认通过', () => {
    expect(evaluateCondition({ type: 'unknown' as any, params: {} }, 1)).toBe(true);
  });
  it('evaluateCondition 对 turn_range 边界值', () => {
    const cond: EventCondition = { type: 'turn_range', params: { minTurn: 5, maxTurn: 10 } };
    expect(evaluateCondition(cond, 5)).toBe(true);
    expect(evaluateCondition(cond, 10)).toBe(true);
    expect(evaluateCondition(cond, 4)).toBe(false);
    expect(evaluateCondition(cond, 11)).toBe(false);
  });
  it('evaluateCondition 对 resource_threshold 无状态时默认通过（向后兼容）', () => {
    expect(evaluateCondition({ type: 'resource_threshold', params: { resource: 'gold', operator: '>=', value: 100 } }, 1, undefined)).toBe(true);
  });
  it('evaluateCondition 对 resource_threshold 有状态时正确比较', () => {
    const c: EventCondition = { type: 'resource_threshold', params: { resource: 'gold', operator: '>=', value: 100 } };
    expect(evaluateCondition(c, 1, { gold: 50 })).toBe(false);
    expect(evaluateCondition(c, 1, { gold: 150 })).toBe(true);
  });
  it('evaluateCondition 对 event_completed 无检查函数时默认通过', () => {
    expect(evaluateCondition({ type: 'event_completed', params: { eventId: 'e1' } }, 1, undefined, undefined)).toBe(true);
  });
  it('evaluateCondition 对 event_completed 有检查函数时正确判断', () => {
    const c: EventCondition = { type: 'event_completed', params: { eventId: 'e1' } };
    expect(evaluateCondition(c, 1, undefined, () => false)).toBe(false);
    expect(evaluateCondition(c, 1, undefined, () => true)).toBe(true);
  });
});

// ══════════════════════════════════════════════
// F-Cross: 跨系统联动
// ══════════════════════════════════════════════

describe('F-Cross: 事件→日志联动', () => {
  it('事件解决后可记录到日志系统', () => {
    const trigger = createTriggerSystem(); const log = createLogSystem();
    trigger.registerEvent(makeEventDef({ id: 'cross-log' }));
    const t = trigger.forceTriggerEvent('cross-log', 5);
    const r = trigger.resolveEvent(t.instance!.instanceId, 'opt-a');
    if (r) log.logEvent({ eventDefId: 'cross-log', title: '测试', description: '', chosenOptionText: '选项A', consequenceDescription: r.consequences.description, triggeredTurn: 5, timestamp: Date.now(), eventType: 'random' });
    expect(log.getLogCount()).toBe(1);
    expect(log.getRecentLogs(1)[0].chosenOptionText).toBe('选项A');
  });
});

describe('F-Cross: 事件链→急报联动', () => {
  it('事件链推进时产生急报', () => {
    const sys = createChainSystem(); sys.registerChain(makeChain());
    sys.startChain('chain-test'); sys.advanceChain('chain-test', 'opt-a');
    sys.addReturnAlert({ title: '连锁事件进展', description: '已推进', urgency: 'high', alertType: 'chain' });
    expect(sys.getUnreadAlertCount()).toBe(1);
  });
});

describe('F-Cross: 事件→资源变化', () => {
  it('事件后果中的资源变化应可被外部读取', () => {
    const sys = createTriggerSystem(); sys.registerEvent(makeEventDef({ id: 'res-evt' }));
    const t = sys.forceTriggerEvent('res-evt', 1);
    expect(sys.resolveEvent(t.instance!.instanceId, 'opt-a')!.consequences.resourceChanges).toEqual({ gold: 100 });
  });
  it('事件后果中的声望变化应可被外部读取', () => {
    const sys = createTriggerSystem();
    sys.registerEvent(makeEventDef({ id: 'rep-evt', options: [{ id: 'opt-rep', text: '提升声望', consequences: { description: '声望增加', affinityChanges: { reputation: 50 } } }] }));
    const t = sys.forceTriggerEvent('rep-evt', 1);
    expect(sys.resolveEvent(t.instance!.instanceId, 'opt-rep')!.consequences.affinityChanges).toEqual({ reputation: 50 });
  });
});

describe('F-Cross: 过期事件→急报堆', () => {
  it('过期事件应可生成急报通知', () => {
    const trigger = createTriggerSystem(); const log = createLogSystem();
    trigger.registerEvent(makeEventDef({ id: 'exp-alert', expireAfterTurns: 2 }));
    trigger.forceTriggerEvent('exp-alert', 1);
    const expired = trigger.expireEvents(4);
    for (const e of expired) log.addAlert({ title: '事件已过期', description: `事件 ${e.eventDefId} 已过期`, urgency: 'medium', alertType: 'random' });
    expect(log.getUnreadAlertCount()).toBe(1);
  });
});

describe('F-Cross: 事件→EventBus 通知', () => {
  it('事件解决时发出 event:resolved 事件', () => {
    const deps = mockDeps(); const sys = new EventTriggerSystem(); sys.init(deps);
    sys.registerEvent(makeEventDef({ id: 'bus-test' }));
    const t = sys.forceTriggerEvent('bus-test', 1);
    sys.resolveEvent(t.instance!.instanceId, 'opt-a');
    expect(deps.eventBus.emit).toHaveBeenCalledWith('event:resolved', expect.objectContaining({ eventDefId: 'bus-test', optionId: 'opt-a' }));
  });
  it('事件过期时发出 event:expired 事件', () => {
    const deps = mockDeps(); const sys = new EventTriggerSystem(); sys.init(deps);
    sys.registerEvent(makeEventDef({ id: 'exp-bus', expireAfterTurns: 1 }));
    sys.forceTriggerEvent('exp-bus', 1); sys.expireEvents(3);
    expect(deps.eventBus.emit).toHaveBeenCalledWith('event:expired', expect.objectContaining({ eventDefId: 'exp-bus' }));
  });
});

// ══════════════════════════════════════════════
// F-Lifecycle: 序列化与生命周期
// ══════════════════════════════════════════════

describe('F-Lifecycle: EventTriggerSystem 序列化', () => {
  it('序列化后反序列化应恢复活跃事件', () => {
    const sys = createTriggerSystem();
    sys.registerEvents([makeEventDef({ id: 's1' }), makeEventDef({ id: 's2' })]);
    sys.forceTriggerEvent('s1', 1); sys.forceTriggerEvent('s2', 2);
    const data = sys.serialize();
    const sys2 = createTriggerSystem();
    sys2.registerEvents([makeEventDef({ id: 's1' }), makeEventDef({ id: 's2' })]);
    sys2.deserialize(data);
    expect(sys2.getActiveEvents()).toHaveLength(2);
  });
  it('序列化保留已完成事件ID', () => {
    const sys = createTriggerSystem(); sys.registerEvent(makeEventDef({ id: 'sc' }));
    const t = sys.forceTriggerEvent('sc', 1); sys.resolveEvent(t.instance!.instanceId, 'opt-a');
    const data = sys.serialize();
    const sys2 = createTriggerSystem(); sys2.registerEvent(makeEventDef({ id: 'sc' }));
    sys2.deserialize(data);
    expect(sys2.isEventCompleted('sc')).toBe(true);
  });
  it('反序列化 null 数据不崩溃', () => { expect(() => createTriggerSystem().deserialize(null as any)).not.toThrow(); });
  it('反序列化 undefined 数据不崩溃', () => { expect(() => createTriggerSystem().deserialize(undefined as any)).not.toThrow(); });
});

describe('F-Lifecycle: EventChainSystem 序列化', () => {
  it('序列化后反序列化应恢复链进度', () => {
    const sys = createChainSystem(); sys.registerChain(makeChain()); sys.registerStoryEvent(makeStoryEvent());
    sys.startChain('chain-test'); sys.advanceChain('chain-test', 'opt-a'); sys.triggerStoryEvent('story-001');
    const data = sys.serialize();
    const sys2 = createChainSystem(); sys2.registerChain(makeChain()); sys2.registerStoryEvent(makeStoryEvent());
    sys2.deserialize(data);
    expect(sys2.getChainProgress('chain-test').completedCount).toBe(1);
  });
  it('序列化保留日志和急报', () => {
    const sys = createChainSystem();
    sys.addLogEntry({ eventDefId: 'e1', title: 'T', description: '', triggeredTurn: 1, timestamp: 0, eventType: 'random' });
    sys.addReturnAlert({ title: 'A', description: '', urgency: 'high', alertType: 'chain' });
    const data = sys.serialize();
    const sys2 = createChainSystem(); sys2.deserialize(data);
    expect(sys2.getLogCount()).toBe(1); expect(sys2.getReturnAlerts()).toHaveLength(1);
  });
});

describe('F-Lifecycle: EventLogSystem 序列化', () => {
  it('序列化后反序列化恢复日志', () => {
    const sys = createLogSystem();
    sys.logEvent({ eventDefId: 'e1', title: 'T', description: '', triggeredTurn: 1, timestamp: 0, eventType: 'random' });
    sys.addAlert({ title: 'A', description: '', urgency: 'high', alertType: 'random' });
    const data = sys.exportSaveData();
    const sys2 = createLogSystem(); sys2.importSaveData(data);
    expect(sys2.getLogCount()).toBe(1); expect(sys2.getAlerts()).toHaveLength(1);
  });
  it('反序列化空数据不崩溃', () => {
    expect(() => createLogSystem().importSaveData({ version: 1, eventLog: [], returnAlerts: [] })).not.toThrow();
  });
});

describe('F-Lifecycle: 系统重置', () => {
  it('EventTriggerSystem reset 清空所有状态', () => {
    const sys = createTriggerSystem(); sys.registerEvent(makeEventDef({ id: 'reset-t' }));
    sys.forceTriggerEvent('reset-t', 1); sys.reset();
    expect(sys.getActiveEvents()).toHaveLength(0); expect(sys.getCompletedEventIds()).toHaveLength(0);
  });
  it('EventChainSystem reset 清空所有状态', () => {
    const sys = createChainSystem(); sys.registerChain(makeChain()); sys.registerStoryEvent(makeStoryEvent());
    sys.startChain('chain-test');
    sys.addLogEntry({ eventDefId: 'e1', title: 'T', description: '', triggeredTurn: 1, timestamp: 0, eventType: 'random' });
    sys.reset();
    expect(sys.getLogCount()).toBe(0); expect(sys.getReturnAlerts()).toHaveLength(0);
  });
  it('EventLogSystem reset 清空所有状态', () => {
    const sys = createLogSystem();
    sys.logEvent({ eventDefId: 'e1', title: 'T', description: '', triggeredTurn: 1, timestamp: 0, eventType: 'random' });
    sys.addAlert({ title: 'A', description: '', urgency: 'high', alertType: 'random' });
    sys.reset();
    expect(sys.getLogCount()).toBe(0); expect(sys.getAlerts()).toHaveLength(0);
  });
});

describe('F-Lifecycle: 概率计算', () => {
  it('注册概率条件后可查询', () => {
    const sys = createTriggerSystem(); sys.registerEvent(makeEventDef({ id: 'prob-evt' }));
    sys.registerProbabilityCondition('prob-evt', { baseProbability: 0.5, modifiers: [{ type: 'additive', value: 0.1, active: true }] });
    expect(sys.getProbabilityCondition('prob-evt')!.baseProbability).toBe(0.5);
  });
  it('calculateProbability 正确计算', () => {
    const r = createTriggerSystem().calculateProbability({ baseProbability: 0.3, modifiers: [{ type: 'additive', value: 0.2, active: true }, { type: 'multiplicative', value: 1.5, active: true }] });
    expect(r.finalProbability).toBeGreaterThanOrEqual(0); expect(r.finalProbability).toBeLessThanOrEqual(1);
  });
  it('calculateProbability 基础概率为0时返回0', () => {
    expect(createTriggerSystem().calculateProbability({ baseProbability: 0, modifiers: [] }).finalProbability).toBe(0);
  });
});

describe('F-Lifecycle: resolveEvent/expireEvents 纯函数', () => {
  const emptyState = () => ({ activeEvents: new Map<string, EventInstance>(), completedEventIds: new Set<EventId>(), cooldowns: new Map<EventId, number>(), eventDefs: new Map<EventId, EventDef>() });
  it('resolveEvent 对非活跃实例返回 null', () => { expect(resolveEvent('x', 'y', emptyState())).toBeNull(); });
  it('expireEvents 对空活跃事件返回空数组', () => { expect(expireEvents(100, emptyState())).toEqual([]); });
});
