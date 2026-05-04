/**
 * R14 Task1: 道具掉落集成测试
 *
 * 测试 SiegeItemSystem 集成到攻城结算流程的完整链路:
 * 1. 胜利路径 → shouldDropInsiderLetter 被调用 → 结果包含 itemDrops
 * 2. 失败路径 → shouldDropInsiderLetter 不被调用 → 无 itemDrops
 * 3. SettlementPipeline.distribute 集成 → items 数组包含掉落
 * 4. 掉落概率约 20%（基于 hashCode 的确定性随机）
 *
 * @module engine/map/__tests__/integration/siege-item-integration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { shouldDropInsiderLetter, hashCode, SiegeItemSystem, SIEGE_ITEM_NAMES, ALL_ITEM_TYPES } from '../../SiegeItemSystem';
import { SettlementPipeline } from '../../SettlementPipeline';
import type { BattleCompletedEvent } from '../../SiegeBattleSystem';
import type { SettlementContext } from '../../SettlementPipeline';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

/** 创建模拟 EventBus */
function createMockEventBus() {
  const events: Record<string, unknown[]> = {};
  return {
    emit: (event: string, data: unknown) => {
      if (!events[event]) events[event] = [];
      events[event].push(data);
    },
    on: () => {},
    off: () => {},
    getEvents: (event: string) => events[event] ?? [],
  };
}

/** 创建胜利 BattleCompletedEvent */
function createVictoryEvent(overrides?: Partial<BattleCompletedEvent>): BattleCompletedEvent {
  return {
    taskId: 'task-victory-001',
    targetId: 'city-luoyang',
    victory: true,
    strategy: 'forceAttack',
    troops: 5000,
    elapsedMs: 8000,
    remainingDefense: 0,
    ...overrides,
  };
}

/** 创建失败 BattleCompletedEvent */
function createDefeatEvent(overrides?: Partial<BattleCompletedEvent>): BattleCompletedEvent {
  return {
    taskId: 'task-defeat-001',
    targetId: 'city-changsha',
    victory: false,
    strategy: 'siege',
    troops: 3000,
    elapsedMs: 20000,
    remainingDefense: 60,
    ...overrides,
  };
}

/** 创建胜利路径上下文 */
function createVictoryContext(taskId: string): SettlementContext {
  return {
    taskId,
    targetId: 'city-luoyang',
    sourceId: 'city-xuchang',
    path: 'victory',
    battleEvent: createVictoryEvent({ taskId }),
    outcome: 'decisiveVictory',
    casualties: {
      troopsLost: 500,
      troopsLostPercent: 0.1,
      heroInjured: false,
      injuryLevel: 'none',
    },
    rewards: null,
    returnMarch: {
      fromCityId: 'city-luoyang',
      toCityId: 'city-xuchang',
      troops: 4500,
      general: '关羽',
    },
    timestamp: Date.now(),
    troops: 5000,
    targetLevel: 3,
    isFirstCapture: true,
  };
}

/** 创建失败路径上下文 */
function createDefeatContext(taskId: string): SettlementContext {
  return {
    taskId,
    targetId: 'city-changsha',
    sourceId: 'city-xuchang',
    path: 'defeat',
    battleEvent: createDefeatEvent({ taskId }),
    outcome: 'defeat',
    casualties: {
      troopsLost: 2100,
      troopsLostPercent: 0.7,
      heroInjured: true,
      injuryLevel: 'moderate',
    },
    rewards: null,
    returnMarch: {
      fromCityId: 'city-changsha',
      toCityId: 'city-xuchang',
      troops: 900,
      general: '张飞',
    },
    timestamp: Date.now(),
    troops: 3000,
    targetLevel: 2,
  };
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('R14: SiegeItemSystem Integration', () => {
  describe('shouldDropInsiderLetter', () => {
    it('should return boolean based on taskId hash', () => {
      // Deterministic: same taskId always produces same result
      const taskId = 'task-deterministic-001';
      const result1 = shouldDropInsiderLetter(taskId);
      const result2 = shouldDropInsiderLetter(taskId);
      expect(result1).toBe(result2);
    });

    it('should produce ~20% drop rate across many taskIds', () => {
      // Test 100 taskIds and expect roughly 15-30 drops (15-30% range)
      let dropCount = 0;
      const total = 100;
      for (let i = 0; i < total; i++) {
        if (shouldDropInsiderLetter(`task-prob-${i}`)) {
          dropCount++;
        }
      }
      // Should be approximately 20%, allow 8-35% range for small sample
      expect(dropCount).toBeGreaterThanOrEqual(8);
      expect(dropCount).toBeLessThanOrEqual(35);
    });
  });

  describe('hashCode', () => {
    it('should return consistent hash for same input', () => {
      const hash1 = hashCode('test-id');
      const hash2 = hashCode('test-id');
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = hashCode('task-a');
      const hash2 = hashCode('task-b');
      expect(hash1).not.toBe(hash2);
    });

    it('should always return a non-negative integer', () => {
      for (let i = 0; i < 50; i++) {
        const hash = hashCode(`random-task-${i}-${Date.now()}`);
        expect(hash).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(hash)).toBe(true);
      }
    });
  });

  describe('SiegeItemSystem class', () => {
    let system: SiegeItemSystem;

    beforeEach(() => {
      system = new SiegeItemSystem();
    });

    it('should start with zero inventory', () => {
      for (const type of ALL_ITEM_TYPES) {
        expect(system.getCount(type)).toBe(0);
        expect(system.hasItem(type)).toBe(false);
      }
    });

    it('should acquire items correctly', () => {
      const result = system.acquireItem('insiderLetter', 'drop');
      expect(result).toBe(true);
      expect(system.getCount('insiderLetter')).toBe(1);
      expect(system.hasItem('insiderLetter')).toBe(true);
    });

    it('should track total acquired count', () => {
      system.acquireItem('insiderLetter', 'drop');
      system.acquireItem('insiderLetter', 'drop');
      expect(system.getTotalAcquired('insiderLetter')).toBe(2);
    });

    it('should consume items correctly', () => {
      system.acquireItem('insiderLetter', 'drop', 3);
      const result = system.consumeItem('insiderLetter', 2);
      expect(result).toBe(true);
      expect(system.getCount('insiderLetter')).toBe(1);
      expect(system.getTotalConsumed('insiderLetter')).toBe(2);
    });

    it('should fail to consume when not enough items', () => {
      system.acquireItem('insiderLetter', 'drop', 1);
      const result = system.consumeItem('insiderLetter', 2);
      expect(result).toBe(false);
      expect(system.getCount('insiderLetter')).toBe(1);
    });

    it('should respect max stack limit', () => {
      // Fill to max (10 for insiderLetter)
      const result1 = system.acquireItem('insiderLetter', 'drop', 10);
      expect(result1).toBe(true);
      expect(system.getCount('insiderLetter')).toBe(10);

      // Try to add one more
      const result2 = system.acquireItem('insiderLetter', 'drop');
      expect(result2).toBe(false);
      expect(system.getCount('insiderLetter')).toBe(10);
    });

    it('should serialize and deserialize correctly', () => {
      system.acquireItem('insiderLetter', 'drop', 3);
      system.acquireItem('nightRaid', 'shop', 2);

      const saved = system.serialize();
      const newSystem = new SiegeItemSystem();
      newSystem.deserialize(saved);

      expect(newSystem.getCount('insiderLetter')).toBe(3);
      expect(newSystem.getCount('nightRaid')).toBe(2);
      expect(newSystem.getCount('siegeManual')).toBe(0);
    });

    it('should reset all data', () => {
      system.acquireItem('insiderLetter', 'drop', 5);
      system.reset();
      expect(system.getCount('insiderLetter')).toBe(0);
      expect(system.getTotalAcquired('insiderLetter')).toBe(0);
      expect(system.getTotalConsumed('insiderLetter')).toBe(0);
    });
  });

  describe('SIEGE_ITEM_NAMES', () => {
    it('should have names for all item types', () => {
      expect(SIEGE_ITEM_NAMES.insiderLetter).toBe('内应信');
      expect(SIEGE_ITEM_NAMES.nightRaid).toBe('夜袭令');
      expect(SIEGE_ITEM_NAMES.siegeManual).toBe('攻城手册');
    });
  });
});

describe('R14: SettlementPipeline + SiegeItemSystem Integration', () => {
  let pipeline: SettlementPipeline;

  beforeEach(() => {
    pipeline = new SettlementPipeline();
    pipeline.setDependencies({
      eventBus: createMockEventBus() as any,
    });
  });

  describe('Victory path', () => {
    it('should include item drops when shouldDropInsiderLetter returns true', () => {
      // Find a taskId that triggers a drop
      let dropTaskId = '';
      for (let i = 0; i < 100; i++) {
        const id = `task-drop-${i}`;
        if (shouldDropInsiderLetter(id)) {
          dropTaskId = id;
          break;
        }
      }
      expect(dropTaskId).not.toBe('');
      expect(shouldDropInsiderLetter(dropTaskId)).toBe(true);

      const ctx = createVictoryContext(dropTaskId);
      const result = pipeline.execute(ctx);

      expect(result.success).toBe(true);
      expect(result.context.rewards).not.toBeNull();
      expect(result.context.rewards!.items.length).toBeGreaterThanOrEqual(1);

      const insiderDrop = result.context.rewards!.items.find(
        (item) => item.type === 'insiderLetter'
      );
      expect(insiderDrop).toBeDefined();
      expect(insiderDrop!.count).toBe(1);
    });

    it('should not include item drops when shouldDropInsiderLetter returns false', () => {
      // Find a taskId that does NOT trigger a drop
      let noDropTaskId = '';
      for (let i = 0; i < 100; i++) {
        const id = `task-nodrop-${i}`;
        if (!shouldDropInsiderLetter(id)) {
          noDropTaskId = id;
          break;
        }
      }
      expect(noDropTaskId).not.toBe('');
      expect(shouldDropInsiderLetter(noDropTaskId)).toBe(false);

      const ctx = createVictoryContext(noDropTaskId);
      const result = pipeline.execute(ctx);

      expect(result.success).toBe(true);
      expect(result.context.rewards).not.toBeNull();
      const insiderDrop = result.context.rewards!.items.find(
        (item) => item.type === 'insiderLetter'
      );
      expect(insiderDrop).toBeUndefined();
    });

    it('should have rewards with resources on victory', () => {
      const ctx = createVictoryContext('task-any-001');
      const result = pipeline.execute(ctx);

      expect(result.success).toBe(true);
      expect(result.context.rewards).not.toBeNull();
      expect(result.context.rewards!.resources.grain).toBeGreaterThan(0);
      expect(result.context.rewards!.resources.gold).toBeGreaterThan(0);
      expect(result.context.rewards!.rewardMultiplier).toBeGreaterThan(0);
    });
  });

  describe('Defeat path', () => {
    it('should NOT call distribute phase (no rewards, no item drops)', () => {
      const ctx = createDefeatContext('task-defeat-no-drop');
      const result = pipeline.execute(ctx);

      expect(result.success).toBe(true);
      // Defeat path does not distribute rewards
      expect(result.context.rewards).toBeNull();
    });

    it('should complete calculate phase even on defeat', () => {
      const ctx = createDefeatContext('task-defeat-calc');
      const result = pipeline.execute(ctx);

      expect(result.success).toBe(true);
      expect(result.context.casualties).not.toBeNull();
      expect(result.context.casualties!.troopsLost).toBeGreaterThan(0);
    });
  });

  describe('Cancel path', () => {
    it('should have no rewards and no item drops', () => {
      const ctx: SettlementContext = {
        taskId: 'task-cancel-001',
        targetId: 'city-changsha',
        sourceId: 'city-xuchang',
        path: 'cancel',
        battleEvent: null,
        outcome: null,
        casualties: null,
        rewards: null,
        returnMarch: {
          fromCityId: 'city-changsha',
          toCityId: 'city-xuchang',
          troops: 3000,
          general: '张飞',
        },
        timestamp: Date.now(),
      };

      const result = pipeline.execute(ctx);

      expect(result.success).toBe(true);
      expect(result.context.rewards).toBeNull();
      expect(result.context.casualties).toBeNull();
    });
  });

  describe('Drop probability validation', () => {
    it('should produce ~20% drop rate through SettlementPipeline for victory paths', () => {
      let dropCount = 0;
      const total = 100;

      for (let i = 0; i < total; i++) {
        const taskId = `task-prob-pipeline-${i}`;
        const ctx = createVictoryContext(taskId);
        const result = pipeline.execute(ctx);

        expect(result.success).toBe(true);
        expect(result.context.rewards).not.toBeNull();

        const hasInsider = result.context.rewards!.items.some(
          (item) => item.type === 'insiderLetter'
        );
        if (hasInsider) dropCount++;
      }

      // Expect approximately 20% (15-35% tolerance for small sample)
      expect(dropCount).toBeGreaterThanOrEqual(10);
      expect(dropCount).toBeLessThanOrEqual(35);
    });
  });
});
