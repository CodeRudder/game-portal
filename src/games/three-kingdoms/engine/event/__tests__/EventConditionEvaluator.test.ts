/**
 * EventConditionEvaluator 单元测试
 *
 * 覆盖：evaluate、evaluateAll（五种条件类型 + AND 逻辑）
 */
import { describe, it, expect } from 'vitest';
import { EventConditionEvaluator } from '../EventConditionEvaluator';
import type { ConditionContext } from '../EventConditionEvaluator';
import type { EventCondition, EventId } from '../../../core/event';

function makeCtx(overrides: Partial<ConditionContext> = {}): ConditionContext {
  return {
    currentTurn: 10,
    completedEventIds: new Set<EventId>(['evt-done']),
    gameState: {
      gold: 100,
      npc1: 80,
      barracks: 5,
    },
    ...overrides,
  };
}

describe('EventConditionEvaluator', () => {
  const evaluator = new EventConditionEvaluator();

  // ─── evaluate — turn_range ─────────────────

  describe('evaluate — turn_range', () => {
    it('满足条件', () => {
      const cond: EventCondition = { type: 'turn_range', params: { minTurn: 5, maxTurn: 15 } };
      expect(evaluator.evaluate(cond, makeCtx({ currentTurn: 10 }))).toBe(true);
    });

    it('不满足条件', () => {
      const cond: EventCondition = { type: 'turn_range', params: { minTurn: 20 } };
      expect(evaluator.evaluate(cond, makeCtx({ currentTurn: 10 }))).toBe(false);
    });
  });

  // ─── evaluate — resource_threshold ──────────

  describe('evaluate — resource_threshold', () => {
    it('资源满足', () => {
      const cond: EventCondition = { type: 'resource_threshold', params: { resource: 'gold', value: 50, operator: '>=' } };
      expect(evaluator.evaluate(cond, makeCtx())).toBe(true);
    });

    it('资源不满足', () => {
      const cond: EventCondition = { type: 'resource_threshold', params: { resource: 'gold', value: 200, operator: '>=' } };
      expect(evaluator.evaluate(cond, makeCtx())).toBe(false);
    });

    it('无 gameState 默认通过', () => {
      const cond: EventCondition = { type: 'resource_threshold', params: { resource: 'gold', value: 100 } };
      expect(evaluator.evaluate(cond, makeCtx({ gameState: undefined }))).toBe(true);
    });
  });

  // ─── evaluate — affinity_level ──────────────

  describe('evaluate — affinity_level', () => {
    it('好感度满足', () => {
      const cond: EventCondition = { type: 'affinity_level', params: { target: 'npc1', value: 50 } };
      expect(evaluator.evaluate(cond, makeCtx())).toBe(true);
    });

    it('好感度不满足', () => {
      const cond: EventCondition = { type: 'affinity_level', params: { target: 'npc1', value: 100, operator: '>' } };
      expect(evaluator.evaluate(cond, makeCtx())).toBe(false);
    });
  });

  // ─── evaluate — building_level ──────────────

  describe('evaluate — building_level', () => {
    it('建筑等级满足', () => {
      const cond: EventCondition = { type: 'building_level', params: { target: 'barracks', value: 3 } };
      expect(evaluator.evaluate(cond, makeCtx())).toBe(true);
    });

    it('建筑等级不满足', () => {
      const cond: EventCondition = { type: 'building_level', params: { target: 'barracks', value: 10 } };
      expect(evaluator.evaluate(cond, makeCtx())).toBe(false);
    });
  });

  // ─── evaluate — event_completed ─────────────

  describe('evaluate — event_completed', () => {
    it('事件已完成', () => {
      const cond: EventCondition = { type: 'event_completed', params: { eventId: 'evt-done' } };
      expect(evaluator.evaluate(cond, makeCtx())).toBe(true);
    });

    it('事件未完成', () => {
      const cond: EventCondition = { type: 'event_completed', params: { eventId: 'evt-not-done' } };
      expect(evaluator.evaluate(cond, makeCtx())).toBe(false);
    });

    it('无 eventId 默认通过', () => {
      const cond: EventCondition = { type: 'event_completed', params: {} };
      expect(evaluator.evaluate(cond, makeCtx())).toBe(true);
    });
  });

  // ─── evaluate — 未知类型 ────────────────────

  describe('evaluate — 未知类型', () => {
    it('未知条件类型默认通过', () => {
      const cond = { type: 'custom_unknown', params: {} } as unknown as EventCondition;
      expect(evaluator.evaluate(cond, makeCtx())).toBe(true);
    });
  });

  // ─── evaluateAll ────────────────────────────

  describe('evaluateAll', () => {
    it('空条件数组默认通过', () => {
      expect(evaluator.evaluateAll([], makeCtx())).toBe(true);
    });

    it('undefined 条件默认通过', () => {
      expect(evaluator.evaluateAll(undefined, makeCtx())).toBe(true);
    });

    it('所有条件满足', () => {
      const conditions: EventCondition[] = [
        { type: 'turn_range', params: { minTurn: 5 } },
        { type: 'resource_threshold', params: { resource: 'gold', value: 50 } },
        { type: 'event_completed', params: { eventId: 'evt-done' } },
      ];
      expect(evaluator.evaluateAll(conditions, makeCtx())).toBe(true);
    });

    it('任一条件不满足则整体不通过', () => {
      const conditions: EventCondition[] = [
        { type: 'turn_range', params: { minTurn: 5 } },
        { type: 'resource_threshold', params: { resource: 'gold', value: 500 } },
      ];
      expect(evaluator.evaluateAll(conditions, makeCtx())).toBe(false);
    });
  });
});
