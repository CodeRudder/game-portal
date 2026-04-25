/**
 * v15.0 事件风云 — 连锁事件链深化集成测试
 *
 * 覆盖范围：
 * - §1 连锁事件链注册与验证（注册/批量注册/深度校验）
 * - §2 链节点推进与分支选择（开始/推进/分支/完成）
 * - §3 链完成奖励与进度追踪（进度统计/完成检测）
 * - §4 链状态持久化（序列化/反序列化/存档恢复）
 * - §5 事件链深化系统（EventChainSystem 剧情事件/日志/急报）
 *
 * @see docs/games/three-kingdoms/play/v15-play.md
 */

import { describe, it, expect } from 'vitest';
import { createSim } from '../../../test-utils/test-helpers';
import { ChainEventSystem } from '../../event/ChainEventSystem';
import { EventChainSystem } from '../../event/EventChainSystem';
import type { EventChainDef, ChainNodeDef } from '../../event/chain-event-types';
import type { EventChain, StoryEventDef, EventLogEntry, ReturnAlert } from '../../event/event-chain.types';
import { MAX_ALLOWED_DEPTH } from '../../event/chain-event-types';

// ── 辅助：创建最小 deps ──
function createDeps() {
  const listeners: Record<string, Array<(...a: unknown[]) => void>> = {};
  return {
    eventBus: {
      on: (evt: string, fn: (...a: unknown[]) => void) => {
        (listeners[evt] ??= []).push(fn);
      },
      emit: (evt: string, ...args: unknown[]) => {
        (listeners[evt] ??= []).forEach(fn => fn(...args));
      },
      off: () => {},
    },
    config: { get: () => undefined },
    registry: { get: () => undefined },
  };
}

// ── 辅助：创建线性事件链 ──
function createLinearChain(chainId: string, nodeCount: number): EventChainDef {
  const nodes: ChainNodeDef[] = [];
  for (let i = 0; i < nodeCount; i++) {
    nodes.push({
      id: `${chainId}-node-${i}`,
      eventDefId: `evt-${chainId}-${i}`,
      ...(i > 0 ? { parentNodeId: `${chainId}-node-${i - 1}`, parentOptionId: `opt-next-${i - 1}` } : {}),
      depth: i,
    });
  }
  return { id: chainId, name: `测试链-${chainId}`, description: '测试用链', nodes, maxDepth: Math.min(nodeCount, MAX_ALLOWED_DEPTH) };
}

// ── 辅助：创建分支事件链 ──
function createBranchChain(): EventChainDef {
  return {
    id: 'branch-chain',
    name: '分支测试链',
    description: '带分支的事件链',
    nodes: [
      { id: 'root', eventDefId: 'evt-root', depth: 0 },
      { id: 'branch-a', eventDefId: 'evt-branch-a', parentNodeId: 'root', parentOptionId: 'opt-a', depth: 1 },
      { id: 'branch-b', eventDefId: 'evt-branch-b', parentNodeId: 'root', parentOptionId: 'opt-b', depth: 1 },
      { id: 'leaf-a1', eventDefId: 'evt-leaf-a1', parentNodeId: 'branch-a', parentOptionId: 'opt-a1', depth: 2 },
      { id: 'leaf-b1', eventDefId: 'evt-leaf-b1', parentNodeId: 'branch-b', parentOptionId: 'opt-b1', depth: 2 },
    ],
    maxDepth: 3,
  };
}

// ═══════════════════════════════════════════════════════════════
// §1 连锁事件链注册与验证
// ═══════════════════════════════════════════════════════════════
describe('v15.0 连锁事件链深化 — §1 链注册与验证', () => {

  it('should register a single event chain and retrieve it', () => {
    const sys = new ChainEventSystem();
    sys.init(createDeps());

    const chain = createLinearChain('chain-1', 3);
    sys.registerChain(chain);

    expect(sys.getChain('chain-1')).toBeDefined();
    expect(sys.getChain('chain-1')!.name).toBe('测试链-chain-1');
    expect(sys.getChain('chain-1')!.nodes.length).toBe(3);
  });

  it('should batch register multiple chains', () => {
    const sys = new ChainEventSystem();
    sys.init(createDeps());

    sys.registerChains([
      createLinearChain('batch-1', 2),
      createLinearChain('batch-2', 3),
      createLinearChain('batch-3', 4),
    ]);

    expect(sys.getAllChains().length).toBe(3);
  });

  it('should reject chain with maxDepth exceeding limit', () => {
    const sys = new ChainEventSystem();
    sys.init(createDeps());

    const invalidChain: EventChainDef = {
      id: 'too-deep',
      name: '超深链',
      description: '',
      nodes: [{ id: 'n0', eventDefId: 'e0', depth: 0 }],
      maxDepth: MAX_ALLOWED_DEPTH + 1,
    };

    expect(() => sys.registerChain(invalidChain)).toThrow();
  });

  it('should reject node with depth exceeding chain maxDepth', () => {
    const sys = new ChainEventSystem();
    sys.init(createDeps());

    const chain: EventChainDef = {
      id: 'bad-depth',
      name: '深度超限',
      description: '',
      nodes: [
        { id: 'n0', eventDefId: 'e0', depth: 0 },
        { id: 'n1', eventDefId: 'e1', depth: 10 },
      ],
      maxDepth: 3,
    };

    expect(() => sys.registerChain(chain)).toThrow();
  });

  it('should return undefined for non-existent chain', () => {
    const sys = new ChainEventSystem();
    sys.init(createDeps());

    expect(sys.getChain('nonexistent')).toBeUndefined();
  });

  it('should return empty array when no chains registered', () => {
    const sys = new ChainEventSystem();
    sys.init(createDeps());

    expect(sys.getAllChains()).toEqual([]);
  });

});

// ═══════════════════════════════════════════════════════════════
// §2 链节点推进与分支选择
// ═══════════════════════════════════════════════════════════════
describe('v15.0 连锁事件链深化 — §2 链节点推进与分支选择', () => {

  it('should start chain and return root node', () => {
    const sys = new ChainEventSystem();
    sys.init(createDeps());
    sys.registerChain(createLinearChain('start-test', 3));

    const rootNode = sys.startChain('start-test');
    expect(rootNode).not.toBeNull();
    expect(rootNode!.depth).toBe(0);
    expect(rootNode!.id).toBe('start-test-node-0');
  });

  it('should return null when starting non-existent chain', () => {
    const sys = new ChainEventSystem();
    sys.init(createDeps());

    expect(sys.startChain('no-such-chain')).toBeNull();
  });

  it('should advance chain to next node on correct option', () => {
    const sys = new ChainEventSystem();
    sys.init(createDeps());
    sys.registerChain(createLinearChain('advance-test', 3));

    sys.startChain('advance-test');
    const result = sys.advanceChain('advance-test', 'opt-next-0');

    expect(result.success).toBe(true);
    expect(result.currentNode).not.toBeNull();
    expect(result.currentNode!.id).toBe('advance-test-node-1');
    expect(result.chainCompleted).toBe(false);
  });

  it('should track completed nodes during advancement', () => {
    const sys = new ChainEventSystem();
    sys.init(createDeps());
    sys.registerChain(createLinearChain('track-test', 3));

    sys.startChain('track-test');
    sys.advanceChain('track-test', 'opt-next-0');

    const progress = sys.getProgress('track-test');
    expect(progress).toBeDefined();
    expect(progress!.completedNodeIds.size).toBe(1);
    expect(progress!.completedNodeIds.has('track-test-node-0')).toBe(true);
  });

  it('should follow branch-a when option-a is selected', () => {
    const sys = new ChainEventSystem();
    sys.init(createDeps());
    sys.registerChain(createBranchChain());

    sys.startChain('branch-chain');
    const result = sys.advanceChain('branch-chain', 'opt-a');

    expect(result.success).toBe(true);
    expect(result.currentNode!.id).toBe('branch-a');
  });

  it('should follow branch-b when option-b is selected', () => {
    const sys = new ChainEventSystem();
    sys.init(createDeps());
    sys.registerChain(createBranchChain());

    sys.startChain('branch-chain');
    const result = sys.advanceChain('branch-chain', 'opt-b');

    expect(result.success).toBe(true);
    expect(result.currentNode!.id).toBe('branch-b');
  });

  it('should complete chain when no matching next node exists', () => {
    const sys = new ChainEventSystem();
    sys.init(createDeps());
    sys.registerChain(createLinearChain('complete-test', 2));

    sys.startChain('complete-test');
    sys.advanceChain('complete-test', 'opt-next-0');
    // Node 1 has no further nodes with parentOptionId='opt-terminus'
    const result = sys.advanceChain('complete-test', 'opt-terminus');

    expect(result.success).toBe(true);
    expect(result.chainCompleted).toBe(true);
    expect(result.currentNode).toBeNull();
  });

  it('should reject advancement on already completed chain', () => {
    const sys = new ChainEventSystem();
    sys.init(createDeps());
    sys.registerChain(createLinearChain('done-test', 1));

    sys.startChain('done-test');
    sys.advanceChain('done-test', 'opt-end');

    const result = sys.advanceChain('done-test', 'opt-end');
    expect(result.success).toBe(false);
    expect(result.reason).toContain('已完成');
  });

  it('should return failure when advancing non-existent chain', () => {
    const sys = new ChainEventSystem();
    sys.init(createDeps());

    const result = sys.advanceChain('ghost-chain', 'opt');
    expect(result.success).toBe(false);
    expect(result.reason).toContain('不存在');
  });

  it('should get next nodes for a given node', () => {
    const sys = new ChainEventSystem();
    sys.init(createDeps());
    sys.registerChain(createBranchChain());

    const nextNodes = sys.getNextNodes('branch-chain', 'root');
    expect(nextNodes.length).toBe(2);
    expect(nextNodes.map(n => n.id)).toContain('branch-a');
    expect(nextNodes.map(n => n.id)).toContain('branch-b');
  });

});

// ═══════════════════════════════════════════════════════════════
// §3 链完成奖励与进度追踪
// ═══════════════════════════════════════════════════════════════
describe('v15.0 连锁事件链深化 — §3 进度追踪', () => {

  it('should report progress stats for a started chain', () => {
    const sys = new ChainEventSystem();
    sys.init(createDeps());
    sys.registerChain(createLinearChain('stats-test', 4));

    sys.startChain('stats-test');
    const stats = sys.getProgressStats('stats-test');

    expect(stats.total).toBe(4);
    expect(stats.completed).toBe(0);
    expect(stats.percentage).toBe(0);
  });

  it('should update progress stats after advancing', () => {
    const sys = new ChainEventSystem();
    sys.init(createDeps());
    sys.registerChain(createLinearChain('prog-test', 3));

    sys.startChain('prog-test');
    sys.advanceChain('prog-test', 'opt-next-0');

    const stats = sys.getProgressStats('prog-test');
    expect(stats.completed).toBe(1);
    expect(stats.percentage).toBeGreaterThanOrEqual(33);
  });

  it('should report zero stats for non-existent chain', () => {
    const sys = new ChainEventSystem();
    sys.init(createDeps());

    const stats = sys.getProgressStats('no-chain');
    expect(stats.completed).toBe(0);
    expect(stats.total).toBe(0);
    expect(stats.percentage).toBe(0);
  });

  it('should detect chain started vs not started', () => {
    const sys = new ChainEventSystem();
    sys.init(createDeps());
    sys.registerChain(createLinearChain('started-test', 2));

    expect(sys.isChainStarted('started-test')).toBe(false);
    sys.startChain('started-test');
    expect(sys.isChainStarted('started-test')).toBe(true);
  });

  it('should detect chain completed', () => {
    const sys = new ChainEventSystem();
    sys.init(createDeps());
    sys.registerChain(createLinearChain('comp-detect', 1));

    sys.startChain('comp-detect');
    expect(sys.isChainCompleted('comp-detect')).toBe(false);

    sys.advanceChain('comp-detect', 'opt-end');
    expect(sys.isChainCompleted('comp-detect')).toBe(true);
  });

  it('should get current node during chain progression', () => {
    const sys = new ChainEventSystem();
    sys.init(createDeps());
    sys.registerChain(createLinearChain('cur-node', 3));

    sys.startChain('cur-node');
    expect(sys.getCurrentNode('cur-node')!.id).toBe('cur-node-node-0');

    sys.advanceChain('cur-node', 'opt-next-0');
    expect(sys.getCurrentNode('cur-node')!.id).toBe('cur-node-node-1');
  });

});

// ═══════════════════════════════════════════════════════════════
// §4 链状态持久化
// ═══════════════════════════════════════════════════════════════
describe('v15.0 连锁事件链深化 — §4 状态持久化', () => {

  it('should export save data with chain progresses', () => {
    const sys = new ChainEventSystem();
    sys.init(createDeps());
    sys.registerChain(createLinearChain('save-test', 3));

    sys.startChain('save-test');
    sys.advanceChain('save-test', 'opt-next-0');

    const saveData = sys.exportSaveData();
    expect(saveData.version).toBe(1);
    expect(saveData.chainProgresses.length).toBe(1);
    expect(saveData.chainProgresses[0].chainId).toBe('save-test');
    expect(saveData.chainProgresses[0].completedNodeIds).toContain('save-test-node-0');
  });

  it('should import save data and restore chain state', () => {
    const sys = new ChainEventSystem();
    sys.init(createDeps());
    sys.registerChain(createLinearChain('restore-test', 3));

    sys.startChain('restore-test');
    sys.advanceChain('restore-test', 'opt-next-0');
    const saveData = sys.exportSaveData();

    // Import into new system
    const sys2 = new ChainEventSystem();
    sys2.init(createDeps());
    sys2.registerChain(createLinearChain('restore-test', 3));
    sys2.importSaveData(saveData);

    const progress = sys2.getProgress('restore-test');
    expect(progress).toBeDefined();
    expect(progress!.currentNodeId).toBe('restore-test-node-1');
    expect(progress!.completedNodeIds.has('restore-test-node-0')).toBe(true);
  });

  it('should clear progress on import of empty save data', () => {
    const sys = new ChainEventSystem();
    sys.init(createDeps());
    sys.registerChain(createLinearChain('clear-test', 2));
    sys.startChain('clear-test');

    sys.importSaveData({ version: 1, chainProgresses: [] });
    expect(sys.getProgress('clear-test')).toBeUndefined();
  });

  it('should reset all chains and progresses', () => {
    const sys = new ChainEventSystem();
    sys.init(createDeps());
    sys.registerChain(createLinearChain('reset-test', 2));
    sys.startChain('reset-test');

    sys.reset();
    expect(sys.getAllChains()).toEqual([]);
    expect(sys.getProgress('reset-test')).toBeUndefined();
  });

});

// ═══════════════════════════════════════════════════════════════
// §5 事件链深化系统（EventChainSystem）
// ═══════════════════════════════════════════════════════════════
describe('v15.0 连锁事件链深化 — §5 EventChainSystem 深化', () => {

  it('should register and start an EventChain via EventChainSystem', () => {
    const sys = new EventChainSystem();
    sys.init(createDeps());

    const chain: EventChain = {
      id: 'ec-test',
      name: '深化测试链',
      description: '',
      nodes: [
        { id: 'ec-n0', eventDefId: 'evt-ec-0', depth: 0 },
        { id: 'ec-n1', eventDefId: 'evt-ec-1', parentNodeId: 'ec-n0', parentOptionId: 'ec-opt-a', depth: 1 },
      ],
      maxDepth: 2,
    };

    sys.registerChain(chain);
    const firstNode = sys.startChain('ec-test');
    expect(firstNode).not.toBeNull();
    expect(firstNode!.depth).toBe(0);
  });

  it('should advance EventChain via EventChainSystem', () => {
    const sys = new EventChainSystem();
    sys.init(createDeps());

    sys.registerChain({
      id: 'ec-adv',
      name: '推进测试',
      description: '',
      nodes: [
        { id: 'n0', eventDefId: 'e0', depth: 0 },
        { id: 'n1', eventDefId: 'e1', parentNodeId: 'n0', parentOptionId: 'go', depth: 1 },
      ],
      maxDepth: 2,
    });

    sys.startChain('ec-adv');
    const next = sys.advanceChain('ec-adv', 'go');
    expect(next).not.toBeNull();
    expect(next!.id).toBe('n1');
  });

  it('should register and trigger story events', () => {
    const sys = new EventChainSystem();
    sys.init(createDeps());

    const storyEvent: StoryEventDef = {
      id: 'story-test-001',
      title: '桃园结义',
      storyLines: [
        { speaker: '刘备', text: '吾等三人虽异姓，既结为兄弟...' },
        { speaker: '关羽', text: '誓同生死，共图大业！', choices: [{ text: '继续', consequence: '结义成功', resourceChanges: { gold: 100 } }] },
      ],
      triggerConditions: [],
      triggered: false,
    };

    sys.registerStoryEvent(storyEvent);
    expect(sys.canTriggerStoryEvent('story-test-001')).toBe(true);

    const triggered = sys.triggerStoryEvent('story-test-001');
    expect(triggered).not.toBeNull();
    expect(triggered!.title).toBe('桃园结义');
    expect(triggered!.triggered).toBe(true);

    // Cannot trigger again
    expect(sys.canTriggerStoryEvent('story-test-001')).toBe(false);
  });

  it('should add and query event log entries', () => {
    const sys = new EventChainSystem();
    sys.init(createDeps());

    sys.addLogEntry({
      eventDefId: 'evt-log-1',
      title: '天降祥瑞',
      description: '天降祥瑞，国泰民安',
      eventType: 'random',
      triggeredTurn: 5,
      timestamp: Date.now(),
    });

    sys.addLogEntry({
      eventDefId: 'evt-log-2',
      title: '黄巾之乱',
      description: '黄巾军起',
      eventType: 'chain',
      triggeredTurn: 8,
      timestamp: Date.now(),
    });

    expect(sys.getLogCount()).toBe(2);

    const allLogs = sys.getEventLog();
    expect(allLogs.length).toBe(2);

    const chainLogs = sys.getEventLog(undefined, 'chain');
    expect(chainLogs.length).toBe(1);
    expect(chainLogs[0].eventType).toBe('chain');

    const limitedLogs = sys.getEventLog(1);
    expect(limitedLogs.length).toBe(1);
  });

  it('should manage return alerts (回归急报)', () => {
    const sys = new EventChainSystem();
    sys.init(createDeps());

    // 添加急报
    const alert1 = sys.addReturnAlert({ title: '急报：敌袭', description: '曹操大军来袭！', urgency: 'critical', alertType: 'event' });
    expect(alert1.id).toBeTruthy();
    expect(alert1.read).toBe(false);

    const alert2 = sys.addReturnAlert({ title: 'NPC即将离开', description: '张角即将离开', urgency: 'high', alertType: 'npc' });

    // 查询急报
    const allAlerts = sys.getReturnAlerts();
    expect(allAlerts.length).toBe(2);

    const unread = sys.getReturnAlerts(true);
    expect(unread.length).toBe(2);

    // 标记已读
    sys.markAlertRead(alert1.id);
    expect(sys.getUnreadAlertCount()).toBe(1);

    // 全部标记已读
    sys.markAllAlertsRead();
    expect(sys.getUnreadAlertCount()).toBe(0);

    // 清除已读
    sys.clearReadAlerts();
    expect(sys.getReturnAlerts().length).toBe(0);
  });

  it('should batch add offline alerts', () => {
    const sys = new EventChainSystem();
    sys.init(createDeps());

    const offlineAlerts = sys.addOfflineAlerts([
      { title: '离线事件1', description: '发生事件A', urgency: 'low' },
      { title: '离线事件2', description: '发生事件B', urgency: 'medium' },
      { title: '离线事件3', description: '发生事件C', urgency: 'high' },
    ]);

    expect(offlineAlerts.length).toBe(3);
    expect(sys.getReturnAlerts().length).toBe(3);
  });

  it('should serialize and deserialize EventChainSystem state', () => {
    const sys = new EventChainSystem();
    sys.init(createDeps());

    sys.registerChain({
      id: 'ser-test',
      name: '序列化测试链',
      description: '',
      nodes: [{ id: 's0', eventDefId: 'se0', depth: 0 }],
      maxDepth: 1,
    });
    sys.startChain('ser-test');

    sys.registerStoryEvent({
      id: 'story-ser',
      title: '测试剧情',
      storyLines: [{ speaker: '旁白', text: '测试' }],
      triggerConditions: [],
      triggered: true,
    });

    sys.addLogEntry({
      eventDefId: 'evt-ser',
      title: '日志',
      description: '测试日志',
      eventType: 'story',
      triggeredTurn: 1,
      timestamp: Date.now(),
    });

    const save = sys.serialize();
    expect(save.eventChains.length).toBe(1);
    expect(save.triggeredStoryEventIds).toContain('story-ser');
    expect(save.eventLog.length).toBe(1);

    // Deserialize into new system
    const sys2 = new EventChainSystem();
    sys2.init(createDeps());
    sys2.registerChain({
      id: 'ser-test',
      name: '序列化测试链',
      description: '',
      nodes: [{ id: 's0', eventDefId: 'se0', depth: 0 }],
      maxDepth: 1,
    });
    sys2.registerStoryEvent({
      id: 'story-ser',
      title: '测试剧情',
      storyLines: [{ speaker: '旁白', text: '测试' }],
      triggerConditions: [],
      triggered: false,
    });
    sys2.deserialize(save);

    expect(sys2.getStoryEvent('story-ser')!.triggered).toBe(true);
    expect(sys2.getLogCount()).toBe(1);
  });

  it('should access chain system via engine getter', () => {
    const sim = createSim();
    const chain = sim.engine.getEventChainSystem();
    expect(chain).toBeDefined();
    expect(chain.name).toBe('eventChain');
  });

});
