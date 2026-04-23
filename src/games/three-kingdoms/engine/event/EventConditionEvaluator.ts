/**
 * 引擎层 — 事件条件评估器
 * 从 EventTriggerSystem 中提取的条件评估逻辑
 * 支持 turn_range、resource_threshold、affinity_level、building_level、event_completed 五种条件类型
 *
 * @module engine/event/EventConditionEvaluator
 */

import type { EventId, EventCondition } from '../../core/event';

/** 事件条件评估器所需的上下文数据 */
export interface ConditionContext {
  /** 当前游戏回合 */
  currentTurn: number;
  /** 已完成的事件ID集合（用于 event_completed 条件判断） */
  completedEventIds: Set<EventId>;
  /** 可选的游戏状态（资源值、好感度、建筑等级等） */
  gameState?: Record<string, number>;
}

/** 管理事件条件的评估逻辑，支持五种条件类型 */
export class EventConditionEvaluator {
  /**
   * 评估单个条件
   * 支持 turn_range、resource_threshold、affinity_level、building_level、event_completed 五种类型
   *
   * @param cond - 事件条件
   * @param ctx - 条件评估上下文
   * @returns 条件是否满足
   */
  evaluate(cond: EventCondition, ctx: ConditionContext): boolean {
    switch (cond.type) {
      case 'turn_range':
        return this.evaluateTurnRangeCondition(cond.params, ctx.currentTurn);

      case 'resource_threshold':
        return this.evaluateResourceCondition(cond.params, ctx.gameState);

      case 'affinity_level':
        return this.evaluateAffinityCondition(cond.params, ctx.gameState);

      case 'building_level':
        return this.evaluateBuildingCondition(cond.params, ctx.gameState);

      case 'event_completed':
        return this.evaluateEventCompletedCondition(cond.params, ctx.completedEventIds);

      default:
        // 未知条件类型默认通过（向后兼容）
        return true;
    }
  }

  /**
   * 评估多个条件（AND 逻辑 — 所有条件必须满足）
   *
   * @param conditions - 条件数组
   * @param ctx - 条件评估上下文
   * @returns 所有条件是否都满足
   */
  evaluateAll(conditions: EventCondition[] | undefined, ctx: ConditionContext): boolean {
    if (!conditions || conditions.length === 0) return true;

    for (const cond of conditions) {
      if (!this.evaluate(cond, ctx)) return false;
    }

    return true;
  }

  /**
   * 评估时间条件（turn_range）
   * 支持 minTurn / maxTurn / turnInterval 参数
   */
  private evaluateTurnRangeCondition(
    params: Record<string, unknown>,
    currentTurn: number,
  ): boolean {
    const minTurn = params['minTurn'] as number | undefined;
    const maxTurn = params['maxTurn'] as number | undefined;
    const turnInterval = params['turnInterval'] as number | undefined;

    if (minTurn !== undefined && currentTurn < minTurn) return false;
    if (maxTurn !== undefined && currentTurn > maxTurn) return false;
    if (turnInterval !== undefined && currentTurn % turnInterval !== 0) return false;

    return true;
  }

  /**
   * 评估资源条件（resource_threshold）
   * 支持 resource / minAmount / maxAmount / operator 参数
   */
  private evaluateResourceCondition(
    params: Record<string, unknown>,
    gameState?: Record<string, number>,
  ): boolean {
    if (!gameState) return true; // 无游戏状态时默认通过（兼容旧逻辑）

    const target = params['resource'] as string;
    const value = gameState[target] ?? 0;

    return this.compareValue(value, params);
  }

  /**
   * 评估好感度条件（affinity_level）
   * 支持 target / value / operator 参数
   */
  private evaluateAffinityCondition(
    params: Record<string, unknown>,
    gameState?: Record<string, number>,
  ): boolean {
    if (!gameState) return true;

    const target = params['target'] as string;
    const value = gameState[target] ?? 0;

    return this.compareValue(value, params);
  }

  /**
   * 评估建筑等级条件（building_level）
   * 支持 target / value / operator 参数
   */
  private evaluateBuildingCondition(
    params: Record<string, unknown>,
    gameState?: Record<string, number>,
  ): boolean {
    if (!gameState) return true;

    const target = params['target'] as string;
    const value = gameState[target] ?? 0;

    return this.compareValue(value, params);
  }

  /**
   * 评估事件完成条件（event_completed）
   * 支持 eventId 参数
   */
  private evaluateEventCompletedCondition(
    params: Record<string, unknown>,
    completedEventIds: Set<EventId>,
  ): boolean {
    const eventId = params['eventId'] as EventId | undefined;
    if (!eventId) return true;

    return completedEventIds.has(eventId);
  }

  /**
   * 通用比较运算（支持 6 种运算符）
   * operator: '>=' | '<=' | '==' | '!=' | '>' | '<'
   * 默认使用 '>='
   */
  private compareValue(
    actual: number,
    params: Record<string, unknown>,
  ): boolean {
    const expected = params['value'] as number | undefined
      ?? params['minAmount'] as number | undefined
      ?? 0;
    const operator = (params['operator'] as string) ?? '>=';

    switch (operator) {
      case '>=': return actual >= expected;
      case '<=': return actual <= expected;
      case '==': return actual === expected;
      case '!=': return actual !== expected;
      case '>':  return actual > expected;
      case '<':  return actual < expected;
      default:   return actual >= expected;
    }
  }
}
