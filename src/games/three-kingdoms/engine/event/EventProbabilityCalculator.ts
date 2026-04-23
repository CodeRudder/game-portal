/**
 * 引擎层 — 事件概率计算器
 * 从 EventTriggerSystem 中提取的概率评估逻辑
 *
 * 公式：P = clamp(base + Σ(active_additive) × Π(active_multiplicative), 0, 1)
 *
 * @module engine/event/EventProbabilityCalculator
 */

import type { EventId } from '../../core/event';
import type {
  ProbabilityCondition,
  ProbabilityResult,
} from '../../core/event/event-v15-event.types';

/**
 * 计算最终触发概率
 *
 * 公式：P = clamp(base + Σ(active_additive) × Π(active_multiplicative), 0, 1)
 *
 * @param probCondition - 概率条件（含基础概率和修正因子）
 * @returns 概率计算结果
 */
export function calculateProbability(probCondition: ProbabilityCondition): ProbabilityResult {
  const { baseProbability, modifiers } = probCondition;

  // 仅计算 active 的修正因子
  const activeModifiers = modifiers.filter((m) => m.active);

  // Σ(additive) — 所有活跃加法修正之和
  const additiveTotal = activeModifiers.reduce(
    (sum, m) => sum + m.additiveBonus, 0,
  );

  // Π(multiplicative) — 所有活跃乘法修正之积
  const multiplicativeTotal = activeModifiers.reduce(
    (product, m) => product * m.multiplicativeBonus, 1,
  );

  // P = clamp(base + Σ(add) × Π(mul), 0, 1)
  const finalProbability = Math.max(
    0, Math.min(1, (baseProbability + additiveTotal) * multiplicativeTotal),
  );

  return {
    finalProbability,
    baseProbability,
    additiveTotal,
    multiplicativeTotal,
    triggered: Math.random() < finalProbability,
  };
}
