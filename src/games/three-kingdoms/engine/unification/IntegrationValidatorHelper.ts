/**
 * 全系统联调验证器 — 工具函数
 *
 * 从 IntegrationValidator 中提取的辅助函数。
 *
 * @module engine/unification/IntegrationValidatorHelper
 */

import type { IntegrationStep } from '../../core/unification';

/** 创建检查步骤 */
export function makeStep(
  stepId: string,
  description: string,
  checkFn: () => boolean,
  errorPrefix: string,
): IntegrationStep {
  const start = performance.now();
  let passed = false;
  let error: string | undefined;
  try {
    passed = checkFn();
    if (!passed) {
      error = `${errorPrefix}: Check returned false`;
    }
  } catch (e) {
    error = `${errorPrefix}: ${e instanceof Error ? e.message : String(e)}`;
  }
  return {
    stepId,
    description,
    passed,
    error,
    durationMs: performance.now() - start,
  };
}
