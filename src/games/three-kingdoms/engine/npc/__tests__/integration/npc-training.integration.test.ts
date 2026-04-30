/**
 * 集成测试 §5+§6+§7 — NPC切磋/结盟/离线行为
 *
 * 覆盖 Play 流程：
 *   §5 切磋系统 — 与NPC武将切磋获得经验/道具
 *   §6 结盟系统 — 好感度满后结盟获得永久加成
 *   §7 离线行为 — 离线期间NPC自动交互/交易
 *
 * 集成系统：NPCTrainingSystem ↔ NPCSystem ↔ EventBus
 *
 * @module engine/npc/__tests__/integration/npc-training
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NPCTrainingSystem } from '../../NPCTrainingSystem';
import type { AllianceBonus, OfflineSummary } from '../../NPCTrainingTypes';
import { ALLIANCE_REQUIRED_AFFINITY, MAX_DIALOGUE_HISTORY, DIALOGUE_TRIM_TO } from '../../NPCTrainingTypes';
import type { ISystemDeps } from '../../../../core/types';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

function createMockDeps(): ISystemDeps {
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

/** 创建集成环境 */
function createTrainingEnv() {
  const deps = createMockDeps();
  const trainingSystem = new NPCTrainingSystem();
  trainingSystem.init(deps);

  const affinityChanges: Array<{ npcId: string; change: number; reason: string }> = [];
  const resourceChanges: Array<Record<string, number>> = [];

  trainingSystem.setAffinityCallback((npcId, change, reason) => {
    affinityChanges.push({ npcId, change, reason });
  });
  trainingSystem.setResourceCallback((changes) => {
    resourceChanges.push(changes);
  });

  return { trainingSystem, deps, affinityChanges, resourceChanges };
}

/** 创建NPC列表用于离线行为测试 */
function createNpcList(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `npc-${i + 1}`,
    name: `NPC${i + 1}`,
    profession: (['merchant', 'warrior', 'advisor', 'artisan'] as const)[i % 4],
  }));
}

// ─────────────────────────────────────────────
// §5 切磋系统
// ─────────────────────────────────────────────

describe('§5 切磋系统集成', () => {
  let env: ReturnType<typeof createTrainingEnv>;

  beforeEach(() => {
    env = createTrainingEnv();
  });

  describe('§5.1 切磋基本流程', () => {
    it('§5.1.1 应能以同等级与NPC切磋并获得结果', () => {
      const result = env.trainingSystem.training('npc-warrior-01', 10, 10);

      expect(result).toBeDefined();
      expect(result.npcId).toBe('npc-warrior-01');
      expect(['win', 'lose', 'draw']).toContain(result.outcome);
      expect(result.message).toBeDefined();
    });

    it('§5.1.2 切磋胜利时应获得经验奖励', () => {
      // 多次切磋以提高至少一次胜利的概率
      const results = Array.from({ length: 20 }, () =>
        env.trainingSystem.training(`npc-test-${Math.random()}`, 20, 1),
      );

      const wins = results.filter((r) => r.outcome === 'win');

      // 前置断言：20次切磋中应至少有1次胜利
      expect(wins.length).toBeGreaterThan(0);

      expect(wins[0].rewards).not.toBeNull();
      expect(wins[0].rewards!.experience).toBeGreaterThan(0);
    });

    it('§5.1.3 切磋后应记录到训练记录', () => {
      env.trainingSystem.training('npc-record-01', 10, 10);

      const records = env.trainingSystem.getTrainingRecords('npc-record-01');
      expect(records.length).toBeGreaterThanOrEqual(1);
      expect(records[0].npcId).toBe('npc-record-01');
      expect(records[0].timestamp).toBeGreaterThan(0);
    });

    it('§5.1.4 切磋应触发好感度回调', () => {
      env.trainingSystem.training('npc-aff-01', 10, 10);

      // 胜利+5，平局+2，失败不触发
      // 前置断言：切磋后应至少触发一次好感度变化
      expect(env.affinityChanges.length).toBeGreaterThan(0);

      expect(env.affinityChanges[0].npcId).toBe('npc-aff-01');
      expect(env.affinityChanges[0].reason).toBe('training');
    });
  });

  describe('§5.2 切磋冷却', () => {
    it('§5.2.1 切磋后应进入冷却状态', () => {
      env.trainingSystem.training('npc-cd-01', 10, 10);

      expect(env.trainingSystem.canTraining('npc-cd-01')).toBe(false);
      expect(env.trainingSystem.getTrainingCooldown('npc-cd-01')).toBeGreaterThan(0);
    });

    it('§5.2.2 冷却中的NPC切磋应返回draw且无奖励', () => {
      env.trainingSystem.training('npc-cd-02', 10, 10);
      const result = env.trainingSystem.training('npc-cd-02', 10, 10);

      expect(result.outcome).toBe('draw');
      expect(result.rewards).toBeNull();
      expect(result.message).toContain('冷却');
    });

    it('§5.2.3 冷却应随update递减', () => {
      env.trainingSystem.training('npc-cd-03', 10, 10);

      // 模拟时间流逝
      env.trainingSystem.update(100);
      expect(env.trainingSystem.canTraining('npc-cd-03')).toBe(true);
    });
  });

  describe('§5.3 切磋统计', () => {
    it('§5.3.1 应正确统计单个NPC的切磋战绩', () => {
      // 使用不同NPC ID避免冷却
      env.trainingSystem.training('npc-stats-01', 10, 10);

      const stats = env.trainingSystem.getTrainingStats('npc-stats-01');
      expect(stats.total).toBe(1);
      expect(stats.wins + stats.losses + stats.draws).toBe(stats.total);
    });

    it('§5.3.2 不存在的NPC应返回空统计', () => {
      const stats = env.trainingSystem.getTrainingStats('npc-nonexistent');
      expect(stats.total).toBe(0);
      expect(stats.wins).toBe(0);
      expect(stats.losses).toBe(0);
      expect(stats.draws).toBe(0);
    });
  });
});

// ─────────────────────────────────────────────
// §6 结盟系统
// ─────────────────────────────────────────────

describe('§6 结盟系统集成', () => {
  let env: ReturnType<typeof createTrainingEnv>;

  beforeEach(() => {
    env = createTrainingEnv();
  });

  describe('§6.1 结盟基本流程', () => {
    it('§6.1.1 好感度达标时应能成功结盟', () => {
      const result = env.trainingSystem.formAlliance(
        'npc-ally-01', 'def-warrior', ALLIANCE_REQUIRED_AFFINITY,
      );

      expect(result.success).toBe(true);
      expect(env.trainingSystem.isAllied('npc-ally-01')).toBe(true);
    });

    it('§6.1.2 好感度不足时应拒绝结盟', () => {
      const result = env.trainingSystem.formAlliance(
        'npc-ally-02', 'def-merchant', ALLIANCE_REQUIRED_AFFINITY - 1,
      );

      expect(result.success).toBe(false);
      expect(result.reason).toContain('好感度不足');
      expect(env.trainingSystem.isAllied('npc-ally-02')).toBe(false);
    });

    it('§6.1.3 重复结盟应被拒绝', () => {
      env.trainingSystem.formAlliance('npc-ally-03', 'def-advisor', ALLIANCE_REQUIRED_AFFINITY);
      const result = env.trainingSystem.formAlliance('npc-ally-03', 'def-advisor', ALLIANCE_REQUIRED_AFFINITY);

      expect(result.success).toBe(false);
      expect(result.reason).toContain('已经');
    });

    it('§6.1.4 结盟成功应触发事件', () => {
      env.trainingSystem.formAlliance('npc-ally-04', 'def-artisan', ALLIANCE_REQUIRED_AFFINITY);

      expect(env.deps.eventBus.emit).toHaveBeenCalledWith(
        'npc:allianceFormed',
        expect.objectContaining({ npcId: 'npc-ally-04', defId: 'def-artisan' }),
      );
    });
  });

  describe('§6.2 结盟加成', () => {
    it('§6.2.1 应能获取结盟数据', () => {
      const bonuses: AllianceBonus[] = [
        { type: 'attack', value: 10, description: '攻击+10' },
        { type: 'defense', value: 5, description: '防御+5' },
      ];
      env.trainingSystem.formAlliance('npc-bonus-01', 'def-warrior', ALLIANCE_REQUIRED_AFFINITY, bonuses);

      const alliance = env.trainingSystem.getAlliance('npc-bonus-01');
      expect(alliance).toBeDefined();
      expect(alliance!.bonuses).toEqual(bonuses);
    });

    it('§6.2.2 多个结盟加成应累加', () => {
      env.trainingSystem.formAlliance('npc-bonus-02', 'def-warrior', ALLIANCE_REQUIRED_AFFINITY, [
        { type: 'attack', value: 10, description: '攻击+10' },
      ]);
      env.trainingSystem.formAlliance('npc-bonus-03', 'def-advisor', ALLIANCE_REQUIRED_AFFINITY, [
        { type: 'attack', value: 5, description: '攻击+5' },
        { type: 'resource', value: 8, description: '资源+8' },
      ]);

      const totals = env.trainingSystem.getAllAllianceBonuses();
      expect(totals.attack).toBe(15);
      expect(totals.resource).toBe(8);
    });

    it('§6.2.3 应能获取所有结盟列表', () => {
      env.trainingSystem.formAlliance('npc-list-01', 'def-a', ALLIANCE_REQUIRED_AFFINITY);
      env.trainingSystem.formAlliance('npc-list-02', 'def-b', ALLIANCE_REQUIRED_AFFINITY);

      expect(env.trainingSystem.getAllianceCount()).toBe(2);
      const alliances = env.trainingSystem.getAllAlliances();
      expect(alliances.length).toBe(2);
    });
  });

  describe('§6.3 解除结盟', () => {
    it('§6.3.1 应能解除已有结盟', () => {
      env.trainingSystem.formAlliance('npc-break-01', 'def-x', ALLIANCE_REQUIRED_AFFINITY);
      const result = env.trainingSystem.breakAlliance('npc-break-01');

      expect(result).toBe(true);
      expect(env.trainingSystem.isAllied('npc-break-01')).toBe(false);
    });

    it('§6.3.2 解除不存在的结盟应返回false', () => {
      expect(env.trainingSystem.breakAlliance('npc-nonexistent')).toBe(false);
    });

    it('§6.3.3 解除结盟应触发事件', () => {
      env.trainingSystem.formAlliance('npc-break-02', 'def-y', ALLIANCE_REQUIRED_AFFINITY);
      env.trainingSystem.breakAlliance('npc-break-02');

      expect(env.deps.eventBus.emit).toHaveBeenCalledWith(
        'npc:allianceBroken',
        expect.objectContaining({ npcId: 'npc-break-02' }),
      );
    });
  });
});

// ─────────────────────────────────────────────
// §7 离线行为
// ─────────────────────────────────────────────

describe('§7 离线行为集成', () => {
  let env: ReturnType<typeof createTrainingEnv>;

  beforeEach(() => {
    env = createTrainingEnv();
  });

  describe('§7.1 离线行为计算', () => {
    it('§7.1.1 离线时应根据时长和NPC数量生成行为', () => {
      const npcs = createNpcList(3);
      const summary = env.trainingSystem.calculateOfflineActions(3600, npcs);

      expect(summary).toBeDefined();
      expect(summary.offlineDuration).toBe(3600);
      expect(summary.actions.length).toBeGreaterThan(0);
    });

    it('§7.1.2 无NPC时应返回空摘要', () => {
      const summary = env.trainingSystem.calculateOfflineActions(3600, []);

      expect(summary.actions).toEqual([]);
      expect(summary.totalResourceChanges).toEqual({});
    });

    it('§7.1.3 离线时长为0时应返回空摘要', () => {
      const npcs = createNpcList(3);
      const summary = env.trainingSystem.calculateOfflineActions(0, npcs);

      expect(summary.actions).toEqual([]);
    });

    it('§7.1.4 离线行为应产生资源变化汇总', () => {
      const npcs = createNpcList(5);
      const summary = env.trainingSystem.calculateOfflineActions(7200, npcs);

      // 至少应有部分行为产生资源变化
      expect(summary.totalResourceChanges).toBeDefined();
      expect(typeof summary.totalResourceChanges).toBe('object');
    });

    it('§7.1.5 离线行为应触发资源回调', () => {
      const npcs = createNpcList(3);
      env.trainingSystem.calculateOfflineActions(3600, npcs);

      // 前置断言：离线行为应至少触发一次资源变化
      expect(env.resourceChanges.length).toBeGreaterThan(0);

      expect(typeof env.resourceChanges[0]).toBe('object');
    });
  });

  describe('§7.2 离线摘要管理', () => {
    it('§7.2.1 应能获取离线摘要', () => {
      const npcs = createNpcList(2);
      env.trainingSystem.calculateOfflineActions(3600, npcs);

      const summary = env.trainingSystem.getOfflineSummary();
      expect(summary).not.toBeNull();
      expect(summary!.offlineDuration).toBe(3600);
    });

    it('§7.2.2 应能清除离线摘要', () => {
      const npcs = createNpcList(2);
      env.trainingSystem.calculateOfflineActions(3600, npcs);

      env.trainingSystem.clearOfflineSummary();
      expect(env.trainingSystem.getOfflineSummary()).toBeNull();
    });

    it('§7.2.3 未计算离线行为时摘要应为null', () => {
      expect(env.trainingSystem.getOfflineSummary()).toBeNull();
    });
  });

  describe('§7.3 切磋+结盟+离线行为联动', () => {
    it('§7.3.1 切磋后结盟，离线行为应保留结盟状态', () => {
      // 先结盟
      env.trainingSystem.formAlliance('npc-int-01', 'def-warrior', ALLIANCE_REQUIRED_AFFINITY);
      expect(env.trainingSystem.isAllied('npc-int-01')).toBe(true);

      // 离线
      const npcs = [{ id: 'npc-int-01', name: '张飞', profession: 'warrior' }];
      env.trainingSystem.calculateOfflineActions(3600, npcs);

      // 结盟状态应保留
      expect(env.trainingSystem.isAllied('npc-int-01')).toBe(true);
    });

    it('§7.3.2 序列化/反序列化应保留完整状态', () => {
      // 创建完整状态
      env.trainingSystem.training('npc-ser-01', 10, 10);
      env.trainingSystem.formAlliance('npc-ser-02', 'def-a', ALLIANCE_REQUIRED_AFFINITY);
      env.trainingSystem.recordDialogue('npc-ser-01', '张飞', '讨论战术', 5, 'attack');

      const saved = env.trainingSystem.serialize();

      // 反序列化到新系统
      const newEnv = createTrainingEnv();
      newEnv.trainingSystem.deserialize(saved);

      expect(newEnv.trainingSystem.isAllied('npc-ser-02')).toBe(true);
      expect(newEnv.trainingSystem.getDialogueCount()).toBeGreaterThanOrEqual(1);
    });

    it('§7.3.3 reset应清除所有切磋/结盟/离线数据', () => {
      env.trainingSystem.training('npc-reset-01', 10, 10);
      env.trainingSystem.formAlliance('npc-reset-02', 'def-b', ALLIANCE_REQUIRED_AFFINITY);
      env.trainingSystem.recordDialogue('npc-reset-01', '关羽', '聊天', 3);

      env.trainingSystem.reset();

      expect(env.trainingSystem.getTrainingRecords()).toEqual([]);
      expect(env.trainingSystem.getAllianceCount()).toBe(0);
      expect(env.trainingSystem.getOfflineSummary()).toBeNull();
      expect(env.trainingSystem.getDialogueCount()).toBe(0);
    });
  });
});
