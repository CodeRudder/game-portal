/**
 * 引擎层 — 事件触发条件评估
 * 从 EventTriggerSystem 中提取的纯条件判断逻辑
 *
 * 支持 turn_range、resource_threshold、affinity_level、building_level、event_completed 五种条件类型
 * 以及 6 种比较运算符（>=, <=, ==, !=, >, <）
 *
 * @module engine/event/EventTriggerConditions
 */

import type { EventCondition, EventId } from '../../core/event';

// ─── 公共类型 ─────────────────────────────────

/** 事件完成状态查询函数（用于解耦对 EventTriggerSystem 的依赖） */
export type CompletedEventChecker = (eventId: EventId) => boolean;

// ─── 主入口 ───────────────────────────────────

/**
 * 评估单个事件条件
 *
 * 支持 turn_range、resource_threshold、affinity_level、building_level、event_completed 五种类型
 *
 * @param cond - 事件条件
 * @param currentTurn - 当前回合
 * @param gameState - 可选的游戏状态（用于状态条件评估）
 * @param isCompleted - 可选的完成状态查询函数（用于 event_completed 条件）
 */
export function evaluateCondition(
  cond: EventCondition,
  currentTurn: number,
  gameState?: Record<string, number>,
  isCompleted?: CompletedEventChecker,
): boolean {
  switch (cond.type) {
    case 'turn_range':
      return evaluateTurnRangeCondition(cond.params, currentTurn);

    case 'resource_threshold':
      return evaluateResourceCondition(cond.params, gameState);

    case 'affinity_level':
      return evaluateAffinityCondition(cond.params, gameState);

    case 'building_level':
      return evaluateBuildingCondition(cond.params, gameState);

    case 'event_completed':
      return evaluateEventCompletedCondition(cond.params, isCompleted);

    default:
      // 未知条件类型默认通过（向后兼容）
      return true;
  }
}

// ─── 具体条件评估 ──────────────────────────────

/**
 * 评估时间条件（turn_range）
 * 支持 minTurn / maxTurn / turnInterval 参数
 */
export function evaluateTurnRangeCondition(
  params: Record<string, unknown>,
  currentTurn: number,
): boolean {
  const minTurn = params['minTurn'] as number | undefined;
  const maxTurn = params['maxTurn'] as number | undefined;
  const turnInterval = params['turnInterval'] as number | undefined;

  // F-04: NaN防护 — 非有限数视为未设置
  if (minTurn !== undefined && Number.isFinite(minTurn) && currentTurn < minTurn) return false;
  if (maxTurn !== undefined && Number.isFinite(maxTurn) && currentTurn > maxTurn) return false;
  if (turnInterval !== undefined && Number.isFinite(turnInterval) && turnInterval > 0 && currentTurn % turnInterval !== 0) return false;

  return true;
}

/**
 * 评估资源条件（resource_threshold）
 * 支持 resource / minAmount / maxAmount / operator 参数
 */
export function evaluateResourceCondition(
  params: Record<string, unknown>,
  gameState?: Record<string, number>,
): boolean {
  if (!gameState) return true; // 无游戏状态时默认通过（兼容旧逻辑）

  const target = params['resource'] as string;
  const value = gameState[target] ?? 0;

  return compareValue(value, params);
}

/**
 * 评估好感度条件（affinity_level）
 * 支持 target / value / operator 参数
 */
export function evaluateAffinityCondition(
  params: Record<string, unknown>,
  gameState?: Record<string, number>,
): boolean {
  if (!gameState) return true;

  const target = params['target'] as string;
  const value = gameState[target] ?? 0;

  return compareValue(value, params);
}

/**
 * 评估建筑等级条件（building_level）
 * 支持 target / value / operator 参数
 */
export function evaluateBuildingCondition(
  params: Record<string, unknown>,
  gameState?: Record<string, number>,
): boolean {
  if (!gameState) return true;

  const target = params['target'] as string;
  const value = gameState[target] ?? 0;

  return compareValue(value, params);
}

/**
 * 评估事件完成条件（event_completed）
 * 支持 eventId 参数
 */
export function evaluateEventCompletedCondition(
  params: Record<string, unknown>,
  isCompleted?: CompletedEventChecker,
): boolean {
  const eventId = params['eventId'] as EventId | undefined;
  if (!eventId) return true;

  // 若未提供查询函数，默认通过（向后兼容）
  if (!isCompleted) return true;

  return isCompleted(eventId);
}

// ─── 通用工具 ─────────────────────────────────

/**
 * 通用比较运算（支持 6 种运算符）
 * operator: '>=' | '<=' | '==' | '!=' | '>' | '<'
 * 默认使用 '>='
 */
export function compareValue(
  actual: number,
  params: Record<string, unknown>,
): boolean {
  const rawExpected = params['value'] as number | undefined
    ?? params['minAmount'] as number | undefined;
  // F-05: NaN防护 — 非有限expected默认为0
  const expected = (rawExpected !== undefined && Number.isFinite(rawExpected)) ? rawExpected : 0;
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
