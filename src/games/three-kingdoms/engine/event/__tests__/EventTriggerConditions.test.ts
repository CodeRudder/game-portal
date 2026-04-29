/**
 * EventTriggerConditions 单元测试
 *
 * 覆盖：evaluateCondition、evaluateTurnRangeCondition、evaluateResourceCondition、
 *       evaluateAffinityCondition、evaluateBuildingCondition、evaluateEventCompletedCondition、compareValue
 */
import { describe, it, expect } from 'vitest';
import {
  evaluateCondition,
  evaluateTurnRangeCondition,
  evaluateResourceCondition,
  evaluateAffinityCondition,
  evaluateBuildingCondition,
  evaluateEventCompletedCondition,
  compareValue,
} from '../EventTriggerConditions';
import type { EventCondition } from '../../../core/event';

// ─── evaluateTurnRangeCondition ────────────────

describe('EventTriggerConditions', () => {
  describe('evaluateTurnRangeCondition', () => {
    it('无参数时默认通过', () => {
      expect(evaluateTurnRangeCondition({}, 10)).toBe(true);
    });

    it('minTurn 条件满足', () => {
      expect(evaluateTurnRangeCondition({ minTurn: 5 }, 10)).toBe(true);
    });

    it('minTurn 条件不满足', () => {
      expect(evaluateTurnRangeCondition({ minTurn: 15 }, 10)).toBe(false);
    });

    it('maxTurn 条件满足', () => {
      expect(evaluateTurnRangeCondition({ maxTurn: 20 }, 10)).toBe(true);
    });

    it('maxTurn 条件不满足', () => {
      expect(evaluateTurnRangeCondition({ maxTurn: 5 }, 10)).toBe(false);
    });

    it('turnInterval 条件满足', () => {
      expect(evaluateTurnRangeCondition({ turnInterval: 5 }, 10)).toBe(true);
    });

    it('turnInterval 条件不满足', () => {
      expect(evaluateTurnRangeCondition({ turnInterval: 3 }, 10)).toBe(false);
    });

    it('组合条件全部满足', () => {
      expect(evaluateTurnRangeCondition({ minTurn: 5, maxTurn: 15, turnInterval: 5 }, 10)).toBe(true);
    });

    it('组合条件部分不满足', () => {
      expect(evaluateTurnRangeCondition({ minTurn: 5, maxTurn: 8 }, 10)).toBe(false);
    });

    it('边界值：currentTurn 等于 minTurn', () => {
      expect(evaluateTurnRangeCondition({ minTurn: 10 }, 10)).toBe(true);
    });

    it('边界值：currentTurn 等于 maxTurn', () => {
      expect(evaluateTurnRangeCondition({ maxTurn: 10 }, 10)).toBe(true);
    });
  });

  // ─── evaluateResourceCondition ──────────────────

  describe('evaluateResourceCondition', () => {
    it('无 gameState 时默认通过', () => {
      expect(evaluateResourceCondition({ resource: 'gold', value: 100 })).toBe(true);
    });

    it('资源满足 >= 条件', () => {
      expect(evaluateResourceCondition(
        { resource: 'gold', value: 100, operator: '>=' },
        { gold: 150 },
      )).toBe(true);
    });

    it('资源不满足 >= 条件', () => {
      expect(evaluateResourceCondition(
        { resource: 'gold', value: 100, operator: '>=' },
        { gold: 50 },
      )).toBe(false);
    });

    it('资源不存在时使用默认值 0', () => {
      expect(evaluateResourceCondition(
        { resource: 'iron', value: 10, operator: '>=' },
        { gold: 100 },
      )).toBe(false);
    });

    it('使用 minAmount 替代 value', () => {
      expect(evaluateResourceCondition(
        { resource: 'gold', minAmount: 50 },
        { gold: 60 },
      )).toBe(true);
    });
  });

  // ─── evaluateAffinityCondition ──────────────────

  describe('evaluateAffinityCondition', () => {
    it('无 gameState 时默认通过', () => {
      expect(evaluateAffinityCondition({ target: 'npc1', value: 50 })).toBe(true);
    });

    it('好感度满足条件', () => {
      expect(evaluateAffinityCondition(
        { target: 'npc1', value: 50, operator: '>=' },
        { npc1: 80 },
      )).toBe(true);
    });

    it('好感度不满足条件', () => {
      expect(evaluateAffinityCondition(
        { target: 'npc1', value: 50, operator: '>' },
        { npc1: 50 },
      )).toBe(false);
    });
  });

  // ─── evaluateBuildingCondition ──────────────────

  describe('evaluateBuildingCondition', () => {
    it('无 gameState 时默认通过', () => {
      expect(evaluateBuildingCondition({ target: 'barracks', value: 3 })).toBe(true);
    });

    it('建筑等级满足条件', () => {
      expect(evaluateBuildingCondition(
        { target: 'barracks', value: 3, operator: '>=' },
        { barracks: 5 },
      )).toBe(true);
    });

    it('建筑等级不满足条件', () => {
      expect(evaluateBuildingCondition(
        { target: 'barracks', value: 3, operator: '>=' },
        { barracks: 2 },
      )).toBe(false);
    });
  });

  // ─── evaluateEventCompletedCondition ────────────

  describe('evaluateEventCompletedCondition', () => {
    it('无 eventId 时默认通过', () => {
      expect(evaluateEventCompletedCondition({})).toBe(true);
    });

    it('无 isCompleted 查询函数时默认通过', () => {
      expect(evaluateEventCompletedCondition({ eventId: 'evt-1' })).toBe(true);
    });

    it('事件已完成', () => {
      const checker = (id: string) => id === 'evt-1';
      expect(evaluateEventCompletedCondition({ eventId: 'evt-1' }, checker)).toBe(true);
    });

    it('事件未完成', () => {
      const checker = (id: string) => id === 'evt-2';
      expect(evaluateEventCompletedCondition({ eventId: 'evt-1' }, checker)).toBe(false);
    });
  });

  // ─── compareValue ──────────────────────────────

  describe('compareValue', () => {
    it('默认使用 >= 运算符', () => {
      expect(compareValue(10, { value: 10 })).toBe(true);
      expect(compareValue(9, { value: 10 })).toBe(false);
    });

    it('>= 运算符', () => {
      expect(compareValue(10, { value: 10, operator: '>=' })).toBe(true);
      expect(compareValue(9, { value: 10, operator: '>=' })).toBe(false);
    });

    it('<= 运算符', () => {
      expect(compareValue(10, { value: 10, operator: '<=' })).toBe(true);
      expect(compareValue(11, { value: 10, operator: '<=' })).toBe(false);
    });

    it('== 运算符', () => {
      expect(compareValue(10, { value: 10, operator: '==' })).toBe(true);
      expect(compareValue(11, { value: 10, operator: '==' })).toBe(false);
    });

    it('!= 运算符', () => {
      expect(compareValue(11, { value: 10, operator: '!=' })).toBe(true);
      expect(compareValue(10, { value: 10, operator: '!=' })).toBe(false);
    });

    it('> 运算符', () => {
      expect(compareValue(11, { value: 10, operator: '>' })).toBe(true);
      expect(compareValue(10, { value: 10, operator: '>' })).toBe(false);
    });

    it('< 运算符', () => {
      expect(compareValue(9, { value: 10, operator: '<' })).toBe(true);
      expect(compareValue(10, { value: 10, operator: '<' })).toBe(false);
    });

    it('未知运算符回退为 >=', () => {
      expect(compareValue(10, { value: 10, operator: 'unknown' })).toBe(true);
      expect(compareValue(9, { value: 10, operator: 'unknown' })).toBe(false);
    });

    it('无 value 和 minAmount 时 expected 为 0', () => {
      expect(compareValue(0, { operator: '>=' })).toBe(true);
      expect(compareValue(-1, { operator: '>=' })).toBe(false);
    });
  });

  // ─── evaluateCondition（集成入口）─────────────

  describe('evaluateCondition', () => {
    it('turn_range 类型', () => {
      const cond: EventCondition = { type: 'turn_range', params: { minTurn: 5 } };
      expect(evaluateCondition(cond, 10)).toBe(true);
      expect(evaluateCondition(cond, 3)).toBe(false);
    });

    it('resource_threshold 类型', () => {
      const cond: EventCondition = { type: 'resource_threshold', params: { resource: 'gold', value: 100 } };
      expect(evaluateCondition(cond, 1, { gold: 150 })).toBe(true);
      expect(evaluateCondition(cond, 1, { gold: 50 })).toBe(false);
    });

    it('affinity_level 类型', () => {
      const cond: EventCondition = { type: 'affinity_level', params: { target: 'npc1', value: 50 } };
      expect(evaluateCondition(cond, 1, { npc1: 80 })).toBe(true);
    });

    it('building_level 类型', () => {
      const cond: EventCondition = { type: 'building_level', params: { target: 'barracks', value: 3 } };
      expect(evaluateCondition(cond, 1, { barracks: 5 })).toBe(true);
    });

    it('event_completed 类型', () => {
      const cond: EventCondition = { type: 'event_completed', params: { eventId: 'evt-1' } };
      expect(evaluateCondition(cond, 1, undefined, (id) => id === 'evt-1')).toBe(true);
      expect(evaluateCondition(cond, 1, undefined, (id) => id === 'evt-2')).toBe(false);
    });

    it('未知条件类型默认通过', () => {
      const cond = { type: 'unknown_type', params: {} } as unknown as EventCondition;
      expect(evaluateCondition(cond, 10)).toBe(true);
    });
  });
});
