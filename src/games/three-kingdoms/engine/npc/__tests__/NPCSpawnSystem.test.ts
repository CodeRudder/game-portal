/**
 * NPCSpawnSystem 单元测试
 *
 * 覆盖：registerRule、removeRule、setRuleEnabled、checkSpawnConditions、
 *       forceSpawn、getActiveCountForRule、serialize/deserialize
 */
import { describe, it, expect, vi } from 'vitest';
import { NPCSpawnSystem } from '../NPCSpawnSystem';
import type { NPCSpawnRule, SpawnSaveData } from '../NPCSpawnSystem';
import type { ISystemDeps } from '../../../core/types';

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

function makeRule(overrides: Partial<NPCSpawnRule> = {}): NPCSpawnRule {
  return {
    id: 'rule-1',
    defId: 'def-1',
    spawnX: 10,
    spawnY: 20,
    respawnInterval: 30,
    maxCount: 3,
    enabled: true,
    ...overrides,
  };
}

describe('NPCSpawnSystem', () => {
  function createSystem(): NPCSpawnSystem {
    const sys = new NPCSpawnSystem();
    sys.init(mockDeps());
    return sys;
  }

  describe('规则管理', () => {
    it('注册规则', () => {
      const sys = createSystem();
      sys.registerRule(makeRule());

      expect(sys.getRule('rule-1')).toBeDefined();
      expect(sys.getRuleIds()).toContain('rule-1');
    });

    it('批量注册规则', () => {
      const sys = createSystem();
      sys.registerRules([
        makeRule({ id: 'rule-1' }),
        makeRule({ id: 'rule-2' }),
      ]);

      expect(sys.getRuleIds()).toHaveLength(2);
    });

    it('移除规则', () => {
      const sys = createSystem();
      sys.registerRule(makeRule());
      expect(sys.removeRule('rule-1')).toBe(true);
      expect(sys.getRule('rule-1')).toBeUndefined();
    });

    it('移除不存在的规则返回 false', () => {
      const sys = createSystem();
      expect(sys.removeRule('not-exist')).toBe(false);
    });

    it('启用/禁用规则', () => {
      const sys = createSystem();
      sys.registerRule(makeRule());

      expect(sys.setRuleEnabled('rule-1', false)).toBe(true);
      expect(sys.getRule('rule-1')!.enabled).toBe(false);

      expect(sys.setRuleEnabled('rule-1', true)).toBe(true);
      expect(sys.getRule('rule-1')!.enabled).toBe(true);
    });

    it('设置不存在的规则启用状态返回 false', () => {
      const sys = createSystem();
      expect(sys.setRuleEnabled('not-exist', true)).toBe(false);
    });
  });

  describe('刷新逻辑', () => {
    it('checkSpawnConditions 禁用规则不触发', () => {
      const sys = createSystem();
      sys.registerRule(makeRule({ enabled: false }));
      sys.setSpawnCallback(() => 'npc-1');

      const results = sys.checkSpawnConditions({ currentTurn: 1, events: [] });
      expect(results).toHaveLength(0);
    });

    it('checkSpawnConditions 达到上限不触发', () => {
      const sys = createSystem();
      sys.registerRule(makeRule({ maxCount: 0 }));
      sys.setSpawnCallback(() => 'npc-1');

      const results = sys.checkSpawnConditions({ currentTurn: 1, events: [] });
      expect(results).toHaveLength(0);
    });

    it('forceSpawn 成功', () => {
      const sys = createSystem();
      sys.registerRule(makeRule());
      sys.setSpawnCallback(() => 'npc-1');

      const result = sys.forceSpawn('rule-1');
      expect(result.success).toBe(true);
      expect(result.npcId).toBe('npc-1');
    });

    it('forceSpawn 规则不存在', () => {
      const sys = createSystem();
      const result = sys.forceSpawn('not-exist');
      expect(result.success).toBe(false);
      expect(result.reason).toBe('规则不存在');
    });

    it('forceSpawn 达到上限', () => {
      const sys = createSystem();
      sys.registerRule(makeRule({ maxCount: 1 }));
      sys.setSpawnCallback(() => 'npc-1');

      sys.forceSpawn('rule-1');
      const result = sys.forceSpawn('rule-1');
      expect(result.success).toBe(false);
      expect(result.reason).toBe('已达最大数量');
    });

    it('无 spawn 回调时失败', () => {
      const sys = createSystem();
      sys.registerRule(makeRule());

      const result = sys.forceSpawn('rule-1');
      expect(result.success).toBe(false);
      expect(result.reason).toBe('未设置spawn回调');
    });

    it('spawn 回调返回 null 时失败', () => {
      const sys = createSystem();
      sys.registerRule(makeRule());
      sys.setSpawnCallback(() => null);

      const result = sys.forceSpawn('rule-1');
      expect(result.success).toBe(false);
      expect(result.reason).toBe('spawn回调返回null');
    });

    it('分配巡逻路径', () => {
      const sys = createSystem();
      sys.registerRule(makeRule({ patrolPathId: 'path-1' }));
      sys.setSpawnCallback(() => 'npc-1');
      const patrolCb = vi.fn();
      sys.setPatrolAssignCallback(patrolCb);

      sys.forceSpawn('rule-1');
      expect(patrolCb).toHaveBeenCalledWith('npc-1', 'path-1');
    });

    it('设置刷新间隔计时器', () => {
      const sys = createSystem();
      sys.registerRule(makeRule({ respawnInterval: 30 }));
      sys.setSpawnCallback(() => 'npc-1');

      sys.forceSpawn('rule-1');

      // 计时器应该被设置
      const state = sys.getState();
      expect(state.spawnTimers.get('rule-1')).toBe(30);
    });
  });

  describe('查询', () => {
    it('getActiveCountForRule', () => {
      const sys = createSystem();
      sys.registerRule(makeRule({ maxCount: 5 }));
      sys.setSpawnCallback(() => 'npc-1');

      expect(sys.getActiveCountForRule('rule-1')).toBe(0);
      sys.forceSpawn('rule-1');
      expect(sys.getActiveCountForRule('rule-1')).toBe(1);
    });

    it('getActiveNPCCount', () => {
      const sys = createSystem();
      sys.registerRules([makeRule({ id: 'r1' }), makeRule({ id: 'r2' })]);
      sys.setSpawnCallback(() => 'npc-1');

      expect(sys.getActiveNPCCount()).toBe(0);
    });

    it('getActiveNPCsForRule', () => {
      const sys = createSystem();
      expect(sys.getActiveNPCsForRule('not-exist')).toEqual([]);
    });

    it('getRuleIdForNPC', () => {
      const sys = createSystem();
      sys.registerRule(makeRule());
      sys.setSpawnCallback(() => 'npc-1');
      sys.forceSpawn('rule-1');

      expect(sys.getRuleIdForNPC('npc-1')).toBe('rule-1');
      expect(sys.getRuleIdForNPC('not-exist')).toBeUndefined();
    });
  });

  describe('update', () => {
    it('更新游戏时间', () => {
      const sys = createSystem();
      sys.update(10);
      expect(sys.getGameTime()).toBeCloseTo(10, 5);
      sys.update(5);
      expect(sys.getGameTime()).toBeCloseTo(15, 5);
    });

    it('倒计时刷新计时器', () => {
      const sys = createSystem();
      sys.registerRule(makeRule({ respawnInterval: 30 }));
      sys.setSpawnCallback(() => 'npc-1');
      sys.forceSpawn('rule-1');

      sys.update(10);
      const state = sys.getState();
      expect(state.spawnTimers.get('rule-1')).toBeCloseTo(20, 5);
    });

    it('despawnAfter 超时消失', () => {
      const sys = createSystem();
      sys.registerRule(makeRule({ despawnAfter: 5 }));
      sys.setSpawnCallback(() => 'npc-1');
      const despawnCb = vi.fn();
      sys.setDespawnCallback(despawnCb);

      sys.forceSpawn('rule-1');
      sys.update(6);

      expect(despawnCb).toHaveBeenCalledWith('npc-1');
    });
  });

  describe('条件评估', () => {
    it('turn 条件', () => {
      const sys = createSystem();
      sys.registerRule(makeRule({
        conditions: [{ type: 'turn', params: { minTurn: 10 } }],
      }));
      sys.setSpawnCallback(() => 'npc-1');

      const results = sys.checkSpawnConditions({ currentTurn: 5, events: [] });
      expect(results).toHaveLength(0);

      const results2 = sys.checkSpawnConditions({ currentTurn: 15, events: [] });
      expect(results2).toHaveLength(1);
    });

    it('event 条件', () => {
      const sys = createSystem();
      sys.registerRule(makeRule({
        conditions: [{ type: 'event', params: { eventId: 'evt-1' } }],
      }));
      sys.setSpawnCallback(() => 'npc-1');

      const results = sys.checkSpawnConditions({ currentTurn: 1, events: [] });
      expect(results).toHaveLength(0);

      const results2 = sys.checkSpawnConditions({ currentTurn: 1, events: ['evt-1'] });
      expect(results2).toHaveLength(1);
    });
  });

  describe('序列化', () => {
    it('serialize/deserialize 往返一致', () => {
      const sys = createSystem();
      sys.registerRule(makeRule());
      sys.setSpawnCallback(() => 'npc-1');
      sys.forceSpawn('rule-1');

      const data = sys.serialize();

      const sys2 = createSystem();
      sys2.deserialize(data);

      expect(sys2.getActiveCountForRule('rule-1')).toBe(1);
    });

    it('reset 清空所有状态', () => {
      const sys = createSystem();
      sys.registerRule(makeRule());
      sys.setSpawnCallback(() => 'npc-1');
      sys.forceSpawn('rule-1');
      sys.update(10);

      sys.reset();

      expect(sys.getRuleIds()).toHaveLength(0);
      expect(sys.getGameTime()).toBe(0);
    });
  });
});
