/**
 * 战役域 — 共享工具函数
 *
 * 统一管理 campaign 域各子系统共用的合并工具函数，
 * 消除 SweepSystem / AutoPushExecutor 中的重复定义。
 *
 * @module engine/campaign/campaign-utils
 */

// ─────────────────────────────────────────────
// 合并工具
// ─────────────────────────────────────────────

/**
 * 合并资源到目标对象
 *
 * 将 source 中所有正数值累加到 target 对应字段上。
 */
export function mergeResources(
  target: Partial<Record<string, number>>,
  source: Partial<Record<string, number>>,
): void {
  for (const [type, amount] of Object.entries(source)) {
    if (amount !== undefined && amount > 0) {
      target[type] = (target[type] ?? 0) + amount;
    }
  }
}

/**
 * 合并碎片到目标对象
 *
 * 将 source 中所有正数值累加到 target 对应字段上。
 */
export function mergeFragments(
  target: Record<string, number>,
  source: Record<string, number>,
): void {
  for (const [id, count] of Object.entries(source)) {
    if (count > 0) {
      target[id] = (target[id] ?? 0) + count;
    }
  }
}
