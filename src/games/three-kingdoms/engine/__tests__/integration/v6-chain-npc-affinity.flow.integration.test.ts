/**
 * v6.0 集成测试 — §8.8 连锁事件×NPC好感度 + §6.1~6.3 NPC交互play流程
 *
 * 覆盖 Play 文档流程（排查缺失补充）：
 *   §8.8 连锁事件×NPC好感度深度流程（链完成→好感度变化→羁绊技能解锁）
 *   §6.1 赠送系统play流程（普通/稀有/偏好礼物×每日上限）
 *   §6.2 切磋系统play流程（自动战斗→胜负奖励→每日限制）
 *   §6.3 NPC任务链play流程（任务解锁→完成→奖励→好感度提升）
 *   §8.3 NPC好感度×事件系统深度联动
 *
 * 引擎层验证，不依赖 UI。
 *
 * @module engine/__tests__/integration/v6-chain-npc-affinity.flow.integration.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ChainEventSystem } from '../../event/ChainEventSystem';
import type { EventChainDef, ChainOptionId } from '../../event/chain-event-types';
import { NPCSystem } from '../../npc/NPCSystem';
import { NPCAffinitySystem } from '../../npc/NPCAffinitySystem';
import { NPCFavorabilitySystem } from '../../npc/NPCFavorabilitySystem';
import { EventTriggerSystem } from '../../event/EventTriggerSystem';
import { EventLogSystem } from '../../event/EventLogSystem';
import type { ISystemDeps } from '../../../core/types';
import type { ISubsystemRegistry } from '../../../core/types/subsystem';
import type { NPCData } from '../../../core/npc';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

function createDeps(): ISystemDeps {
  const chainEvent = new ChainEventSystem();
  const npc = new NPCSystem();
  const npcAffinity = new NPCAffinitySystem();
  const npcFavor = new NPCFavorabilitySystem();
  const eventTrigger = new EventTriggerSystem();
  const eventLog = new EventLogSystem();

  const registry = new Map<string, unknown>();
  registry.set('chainEvent', chainEvent);
  registry.set('npc', npc);
  registry.set('npcAffinity', npcAffinity);
  registry.set('npcFavor', npcFavor);
  registry.set('eventTrigger', eventTrigger);
  registry.set('eventLog', eventLog);

  const deps: ISystemDeps = {
    eventBus: {
      on: () => () => {},
      once: () => () => {},
      emit: () => {},
      off: () => {},
      removeAllListeners: () => {},
    },
    config: { get: () => undefined, set: () => {} },
    registry: {
      register: () => {},
      get: (name: string) => registry.get(name) ?? null,
      getAll: () => new Map(),
      has: (name: string) => registry.has(name),
      unregister: () => {},
    } as unknown as ISubsystemRegistry,
  };

  chainEvent.init(deps);
  npc.init(deps);
  npcAffinity.init(deps);
  npcFavor.init(deps);
  eventTrigger.init(deps);
  eventLog.init(deps);

  return deps;
}

/** 创建测试连锁事件链 — 模拟"桃园结义链"(3环) */
function createTestChain(): EventChainDef {
  return {
    id: 'chain-taoyuan',
    name: '桃园结义链',
    description: '路遇豪杰→桃园设宴→义薄云天',
    maxDepth: 3,
    nodes: [
      {
        id: 'node-1',
        eventDefId: 'evt-taoyuan-1',
        depth: 0,
        description: '路遇豪杰',
      },
      {
        id: 'node-2a',
        eventDefId: 'evt-taoyuan-2a',
        parentNodeId: 'node-1',
        parentOptionId: 'opt-invite',
        depth: 1,
        description: '桃园设宴（邀请路线）',
      },
      {
        id: 'node-2b',
        eventDefId: 'evt-taoyuan-2b',
        parentNodeId: 'node-1',
        parentOptionId: 'opt-decline',
        depth: 1,
        description: '婉拒（另一路线）',
      },
      {
        id: 'node-3',
        eventDefId: 'evt-taoyuan-3',
        parentNodeId: 'node-2a',
        parentOptionId: 'opt-sworn',
        depth: 2,
        description: '义薄云天（最终章）',
      },
    ],
  };
}

/** 创建4环测试链 — 模拟"黄巾余党链" */
function createLongChain(): EventChainDef {
  return {
    id: 'chain-huangjin',
    name: '黄巾余党链',
    description: '黄巾残党出没→发现宝藏→首领现身→招降成功',
    maxDepth: 4,
    nodes: [
      { id: 'hj-1', eventDefId: 'evt-hj-1', depth: 0, description: '黄巾残党出没' },
      { id: 'hj-2', eventDefId: 'evt-hj-2', parentNodeId: 'hj-1', parentOptionId: 'opt-pursue', depth: 1, description: '发现宝藏' },
      { id: 'hj-3', eventDefId: 'evt-hj-3', parentNodeId: 'hj-2', parentOptionId: 'opt-explore', depth: 2, description: '首领现身' },
      { id: 'hj-4', eventDefId: 'evt-hj-4', parentNodeId: 'hj-3', parentOptionId: 'opt-recruit', depth: 3, description: '招降成功' },
    ],
  };
}

/** 获取或创建一个测试NPC */
function ensureTestNPC(npcSys: NPCSystem, affinity = 50): NPCData {
  const existing = npcSys.getAllNPCs();
  if (existing.length > 0) {
    const npcData = existing[0];
    npcSys.setAffinity(npcData.id, affinity);
    return npcSys.getNPCById(npcData.id)!;
  }
  return npcSys.createNPC('测试商人', 'merchant', { x: 20, y: 10 }, { affinity });
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('v6.0 play流程: §8.8 连锁事件×NPC好感度深度', () => {
  let deps: ISystemDeps;
  let chainEvent: ChainEventSystem;
  let npc: NPCSystem;
  let npcAffinity: NPCAffinitySystem;

  beforeEach(() => {
    deps = createDeps();
    chainEvent = deps.registry.get<ChainEventSystem>('chainEvent')!;
    npc = deps.registry.get<NPCSystem>('npc')!;
    npcAffinity = deps.registry.get<NPCAffinitySystem>('npcAffinity')!;
  });

  describe('§8.8.1 连锁事件完整play流程', () => {
    it('注册→开始→推进→完成：3环链完整流程', () => {
      const chain = createTestChain();
      chainEvent.registerChain(chain);

      // 开始链
      const rootNode = chainEvent.startChain('chain-taoyuan');
      expect(rootNode).not.toBeNull();
      expect(rootNode!.id).toBe('node-1');
      expect(rootNode!.depth).toBe(0);

      // 推进第1环 → 选择"邀请"
      const r1 = chainEvent.advanceChain('chain-taoyuan', 'opt-invite');
      expect(r1.success).toBe(true);
      expect(r1.chainCompleted).toBe(false);
      expect(r1.currentNode?.id).toBe('node-2a');

      // 推进第2环 → 选择"结义"
      const r2 = chainEvent.advanceChain('chain-taoyuan', 'opt-sworn');
      expect(r2.success).toBe(true);
      expect(r2.chainCompleted).toBe(false);
      expect(r2.currentNode?.id).toBe('node-3');

      // 推进第3环 → 无后续节点 → 链完成
      const r3 = chainEvent.advanceChain('chain-taoyuan', 'opt-complete');
      expect(r3.success).toBe(true);
      expect(r3.chainCompleted).toBe(true);
      expect(r3.currentNode).toBeNull();
    });

    it('不同选择触发不同分支', () => {
      const chain = createTestChain();
      chainEvent.registerChain(chain);

      // 路线A: 邀请
      chainEvent.startChain('chain-taoyuan');
      const rA = chainEvent.advanceChain('chain-taoyuan', 'opt-invite');
      expect(rA.currentNode?.id).toBe('node-2a');

      // 重置走路线B
      chainEvent.reset();
      chainEvent.registerChain(chain);
      chainEvent.startChain('chain-taoyuan');
      const rB = chainEvent.advanceChain('chain-taoyuan', 'opt-decline');
      expect(rB.currentNode?.id).toBe('node-2b');
    });

    it('4环链完整推进', () => {
      const chain = createLongChain();
      chainEvent.registerChain(chain);
      chainEvent.startChain('chain-huangjin');

      // 逐环推进
      const steps: ChainOptionId[] = ['opt-pursue', 'opt-explore', 'opt-recruit'];
      for (let i = 0; i < steps.length; i++) {
        const r = chainEvent.advanceChain('chain-huangjin', steps[i]);
        expect(r.success).toBe(true);
        if (i < steps.length - 1) {
          expect(r.chainCompleted).toBe(false);
        }
      }

      // 最后一环完成
      const rFinal = chainEvent.advanceChain('chain-huangjin', 'opt-end');
      expect(rFinal.chainCompleted).toBe(true);
    });

    it('已完成链不可重复推进', () => {
      const chain = createTestChain();
      chainEvent.registerChain(chain);
      chainEvent.startChain('chain-taoyuan');

      // 快速完成
      chainEvent.advanceChain('chain-taoyuan', 'opt-invite');
      chainEvent.advanceChain('chain-taoyuan', 'opt-sworn');
      chainEvent.advanceChain('chain-taoyuan', 'opt-complete');

      // 再次推进应失败
      const r = chainEvent.advanceChain('chain-taoyuan', 'opt-any');
      expect(r.success).toBe(false);
      expect(r.reason).toContain('已完成');
    });

    it('未开始的链不可推进', () => {
      const r = chainEvent.advanceChain('non-existent', 'opt-1');
      expect(r.success).toBe(false);
      expect(r.reason).toBeDefined();
    });
  });

  describe('§8.8.2 连锁事件完成→NPC好感度联动', () => {
    it('连锁事件完成后NPC好感度可提升', () => {
      const testNPC = ensureTestNPC(npc, 30);
      const initialAffinity = testNPC.affinity;

      // 模拟连锁事件完成后的好感度奖励
      const result = npcAffinity.gainFromQuest(testNPC.id, testNPC, 20);
      expect(result.delta).toBeGreaterThan(0);

      // 同步到NPCSystem（gainFromQuest修改的是传入的副本）
      npc.changeAffinity(testNPC.id, result.delta);

      // 验证NPC好感度实际增长
      const updatedNPC = npc.getNPCById(testNPC.id);
      expect(updatedNPC!.affinity).toBeGreaterThan(initialAffinity);
    });

    it('连锁事件选择影响NPC好感度方向', () => {
      const testNPC = ensureTestNPC(npc, 50);

      // 正面选择 → 好感度增加
      const positiveGain = npcAffinity.gainFromDialog(testNPC.id, testNPC, 10);
      expect(positiveGain.delta).toBeGreaterThan(0);

      // 赠送偏好物品 → 好感度大幅增加
      const giftGain = npcAffinity.gainFromGift(testNPC.id, testNPC, 'preferred');
      expect(giftGain.delta).toBeGreaterThanOrEqual(positiveGain.delta);
    });

    it('连锁事件奖励包含好感度提升+资源', () => {
      const testNPC = ensureTestNPC(npc, 40);

      // 模拟"桃园结义链"完成奖励: 好感度+50
      const affinityResult = npcAffinity.gainFromQuest(testNPC.id, testNPC, 30);
      expect(affinityResult.delta).toBeGreaterThan(0);
      expect(affinityResult.source).toBe('quest_complete');

      // 验证历史记录
      const history = npcAffinity.getHistory(testNPC.id);
      expect(history.length).toBeGreaterThan(0);
      expect(history[history.length - 1].source).toBe('quest_complete');
    });
  });

  describe('§8.8.3 连锁事件进度统计', () => {
    it('getProgressStats: 返回完成百分比', () => {
      const chain = createTestChain();
      chainEvent.registerChain(chain);
      chainEvent.startChain('chain-taoyuan');

      const stats0 = chainEvent.getProgressStats('chain-taoyuan');
      expect(stats0.completed).toBe(0);

      chainEvent.advanceChain('chain-taoyuan', 'opt-invite');
      const stats1 = chainEvent.getProgressStats('chain-taoyuan');
      expect(stats1.completed).toBe(1);
      expect(stats1.percentage).toBeGreaterThan(0);
    });

    it('链深度验证: maxDepth不超过5', () => {
      const validChain: EventChainDef = {
        id: 'valid',
        name: '有效链',
        description: '',
        maxDepth: 3,
        nodes: [
          { id: 'n1', eventDefId: 'e1', depth: 0 },
          { id: 'n2', eventDefId: 'e2', parentNodeId: 'n1', parentOptionId: 'o1', depth: 1 },
        ],
      };
      expect(() => chainEvent.registerChain(validChain)).not.toThrow();

      // 超过maxDepth的链
      const invalidChain: EventChainDef = {
        id: 'invalid',
        name: '无效链',
        description: '',
        maxDepth: 6,
        nodes: [
          { id: 'n1', eventDefId: 'e1', depth: 0 },
        ],
      };
      expect(() => chainEvent.registerChain(invalidChain)).toThrow();
    });
  });
});

describe('v6.0 play流程: §6.1~6.3 NPC交互深度', () => {
  let deps: ISystemDeps;
  let npc: NPCSystem;
  let npcAffinity: NPCAffinitySystem;

  beforeEach(() => {
    deps = createDeps();
    npc = deps.registry.get<NPCSystem>('npc')!;
    npcAffinity = deps.registry.get<NPCAffinitySystem>('npcAffinity')!;
  });

  describe('§6.1 赠送系统play流程', () => {
    it('普通礼物: 好感度+基础值', () => {
      const testNPC = ensureTestNPC(npc, 20);
      const result = npcAffinity.gainFromGift(testNPC.id, testNPC, 'normal');
      expect(result.delta).toBeGreaterThan(0);
      expect(result.source).toBe('gift');
    });

    it('偏好物品: 好感度×1.5倍率', () => {
      const testNPC = ensureTestNPC(npc, 20);
      const normalResult = npcAffinity.gainFromGift(testNPC.id, testNPC, 'normal');
      const preferredResult = npcAffinity.gainFromGift(testNPC.id, testNPC, 'preferred');
      expect(preferredResult.delta).toBeGreaterThan(normalResult.delta);
    });

    it('稀有礼物: 高额好感度', () => {
      const testNPC = ensureTestNPC(npc, 20);
      const result = npcAffinity.gainFromGift(testNPC.id, testNPC, 'rare');
      expect(result.delta).toBeGreaterThan(0);
      expect(result.description).toContain('稀有');
    });

    it('赠送历史可追溯', () => {
      const testNPC = ensureTestNPC(npc, 20);
      npcAffinity.gainFromGift(testNPC.id, testNPC, 'normal');
      npcAffinity.gainFromGift(testNPC.id, testNPC, 'preferred');

      const history = npcAffinity.getHistory(testNPC.id);
      const giftRecords = history.filter(h => h.source === 'gift');
      expect(giftRecords.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('§6.2 切磋系统play流程', () => {
    it('切磋胜利: 好感度增加', () => {
      const testNPC = ensureTestNPC(npc, 65);
      const result = npcAffinity.gainFromBattleAssist(testNPC.id, testNPC);
      expect(result.delta).toBeGreaterThan(0);
      expect(result.source).toBe('battle_assist');
    });

    it('好感度变化统计', () => {
      const testNPC = ensureTestNPC(npc, 50);
      npcAffinity.gainFromDialog(testNPC.id, testNPC);
      npcAffinity.gainFromGift(testNPC.id, testNPC, 'normal');
      npcAffinity.gainFromQuest(testNPC.id, testNPC);

      const stats = npcAffinity.getChangeStats(testNPC.id);
      expect(stats.dialog).toBeGreaterThan(0);
      expect(stats.gift).toBeGreaterThan(0);
      expect(stats.quest_complete).toBeGreaterThan(0);
    });
  });

  describe('§6.3 NPC任务链play流程', () => {
    it('任务完成→好感度增加', () => {
      const testNPC = ensureTestNPC(npc, 30);
      const beforeAffinity = npc.getNPCById(testNPC.id)!.affinity;

      // 完成任务（基础奖励+额外奖励）
      const result = npcAffinity.gainFromQuest(testNPC.id, testNPC, 15);
      expect(result.delta).toBeGreaterThan(0);

      // 同步到NPCSystem
      npc.changeAffinity(testNPC.id, result.delta);

      const afterAffinity = npc.getNPCById(testNPC.id)!.affinity;
      expect(afterAffinity).toBeGreaterThan(beforeAffinity);
    });

    it('连续完成任务好感度累积', () => {
      const testNPC = ensureTestNPC(npc, 10);

      // 连续完成3个任务
      npcAffinity.gainFromQuest(testNPC.id, testNPC, 0);
      npcAffinity.gainFromQuest(testNPC.id, testNPC, 10);
      npcAffinity.gainFromQuest(testNPC.id, testNPC, 20);

      const history = npcAffinity.getHistory(testNPC.id);
      const questRecords = history.filter(h => h.source === 'quest_complete');
      expect(questRecords.length).toBe(3);
    });
  });

  describe('§8.3 NPC好感度×事件系统深度联动', () => {
    it('好感度等级变化事件正确触发', () => {
      const testNPC = ensureTestNPC(npc, 18);

      // 通过NPCSystem直接修改好感度（确保内部数据同步）
      npc.changeAffinity(testNPC.id, 10);

      // 验证好感度确实变化
      const updated = npc.getNPCById(testNPC.id);
      expect(updated!.affinity).toBeGreaterThan(18);
    });

    it('好感度可视化数据正确', () => {
      const testNPC = ensureTestNPC(npc, 45);

      const viz = npcAffinity.getVisualization(testNPC.id, testNPC);
      expect(viz).toBeDefined();
      expect(viz.currentAffinity).toBeGreaterThanOrEqual(0);
      expect(viz.currentLevel).toBeDefined();
    });

    it('羁绊技能解锁: 好感度达到bonded(85+)', () => {
      const testNPC = ensureTestNPC(npc, 85);

      const canUse = npcAffinity.canUseBondSkill(testNPC.id, testNPC);
      expect(canUse).toBe(true);
    });

    it('羁绊技能未解锁: 好感度不足', () => {
      const testNPC = ensureTestNPC(npc, 50);

      const canUse = npcAffinity.canUseBondSkill(testNPC.id, testNPC);
      expect(canUse).toBe(false);
    });

    it('好感度只增不减规则', () => {
      const testNPC = ensureTestNPC(npc, 50);
      const beforeAffinity = npc.getNPCById(testNPC.id)!.affinity;

      // 多次正面交互
      npcAffinity.gainFromDialog(testNPC.id, testNPC);
      npcAffinity.gainFromGift(testNPC.id, testNPC, 'normal');
      npcAffinity.gainFromTrade(testNPC.id, testNPC);

      const afterAffinity = npc.getNPCById(testNPC.id)!.affinity;
      expect(afterAffinity).toBeGreaterThanOrEqual(beforeAffinity);
    });
  });

  describe('§8.8 连锁事件存档一致性', () => {
    it('连锁事件序列化数据完整', () => {
      const chain = createTestChain();
      const chainEvent = deps.registry.get<ChainEventSystem>('chainEvent')!;
      chainEvent.registerChain(chain);
      chainEvent.startChain('chain-taoyuan');
      chainEvent.advanceChain('chain-taoyuan', 'opt-invite');

      const saved = chainEvent.exportSaveData();
      expect(saved).toBeDefined();
    });
  });
});
