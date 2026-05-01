/**
 * 账号删除流程 — 状态机逻辑
 *
 * 从 AccountSystem.ts 拆分，将删除流程的三步状态机
 * （确认文字 → 二次确认 → 冷静期 → 永久删除）提取为纯函数。
 *
 * 同时包含游客账号过期检测逻辑。
 *
 * @module engine/settings/account-delete-flow
 */

import { ACCOUNT_DELETE_COOLDOWN_DAYS } from '../../core/settings';
import type { AccountSettings } from '../../core/settings';
import {
  type AccountResult,
  type NowFn,
  DeleteFlowState,
  type DeleteFlowData,
  DELETE_CONFIRM_TEXT,
  COOLDOWN_MS,
  GUEST_EXPIRE_MS,
} from './account.types';

// ─────────────────────────────────────────────
// 删除流程 — 步骤1：确认文字
// ─────────────────────────────────────────────

/**
 * 发起账号删除（步骤1：输入确认文字）
 *
 * @param confirmText - 用户输入的确认文字
 * @param settings - 当前账号设置
 * @param existingFlow - 已有的删除流程数据（如有）
 * @param nowFn - 当前时间函数
 * @returns 操作结果 + 新的删除流程数据
 */
export function initiateDelete(
  confirmText: string,
  settings: AccountSettings,
  existingFlow: DeleteFlowData | null,
  nowFn: NowFn,
): { result: AccountResult; flow: DeleteFlowData | null } {
  if (settings.isGuest) {
    return {
      result: { success: false, message: '游客账号无需删除流程' },
      flow: existingFlow,
    };
  }

  if (existingFlow && existingFlow.state !== DeleteFlowState.None) {
    return {
      result: { success: false, message: '删除流程已在进行中' },
      flow: existingFlow,
    };
  }

  if (confirmText !== DELETE_CONFIRM_TEXT) {
    return {
      result: { success: false, message: '确认文字不匹配' },
      flow: existingFlow,
    };
  }

  const flow: DeleteFlowData = {
    state: DeleteFlowState.Confirmed,
    initiatedAt: nowFn(),
    cooldownEndAt: 0,
  };

  return {
    result: { success: true, message: '已确认，请进行二次确认' },
    flow,
  };
}

// ─────────────────────────────────────────────
// 删除流程 — 步骤2：二次确认
// ─────────────────────────────────────────────

/**
 * 二次确认删除（步骤2：进入冷静期）
 *
 * @param flow - 当前删除流程数据
 * @param nowFn - 当前时间函数
 * @returns 操作结果 + 更新后的删除流程数据
 */
export function confirmDelete(
  flow: DeleteFlowData | null,
  nowFn: NowFn,
): { result: AccountResult; flow: DeleteFlowData | null } {
  if (!flow || flow.state !== DeleteFlowState.Confirmed) {
    return {
      result: { success: false, message: '请先完成步骤1' },
      flow,
    };
  }

  const now = nowFn();
  const updated: DeleteFlowData = {
    ...flow,
    state: DeleteFlowState.CoolingDown,
    cooldownEndAt: now + COOLDOWN_MS,
  };

  return {
    result: { success: true, message: `已进入${ACCOUNT_DELETE_COOLDOWN_DAYS}天冷静期` },
    flow: updated,
  };
}

// ─────────────────────────────────────────────
// 删除流程 — 冷静期检查
// ─────────────────────────────────────────────

/**
 * 检查冷静期是否结束
 *
 * 如果冷静期已结束，自动将状态推进到 ReadyToDelete。
 *
 * @param flow - 当前删除流程数据
 * @param nowFn - 当前时间函数
 * @returns 更新后的删除流程数据（可能状态已变更）
 */
export function checkDeleteCooldown(
  flow: DeleteFlowData | null,
  nowFn: NowFn,
): DeleteFlowData | null {
  if (!flow) return null;

  if (
    flow.state === DeleteFlowState.CoolingDown &&
    nowFn() >= flow.cooldownEndAt
  ) {
    return {
      ...flow,
      state: DeleteFlowState.ReadyToDelete,
    };
  }

  return { ...flow };
}

// ─────────────────────────────────────────────
// 删除流程 — 步骤3：永久删除
// ─────────────────────────────────────────────

/**
 * 执行永久删除（步骤3：冷静期结束后）
 *
 * 返回重置后的设置，由调用方决定如何应用。
 *
 * @param flow - 当前删除流程数据
 * @param settings - 当前账号设置
 * @returns 操作结果 + 重置后的设置
 */
export function executeDelete(
  flow: DeleteFlowData | null,
  settings: AccountSettings,
): { result: AccountResult; resetSettings: AccountSettings | null } {
  if (!flow || flow.state !== DeleteFlowState.ReadyToDelete) {
    return {
      result: { success: false, message: '冷静期未结束或未发起删除' },
      resetSettings: null,
    };
  }

  const resetSettings: AccountSettings = {
    ...settings,
    bindings: [],
    isGuest: true,
    firstBindRewardClaimed: false,
    devices: [],
  };

  return {
    result: { success: true, message: '账号已永久删除' },
    resetSettings,
  };
}

// ─────────────────────────────────────────────
// 删除流程 — 撤销
// ─────────────────────────────────────────────

/**
 * 撤销删除（冷静期内）
 *
 * @param flow - 当前删除流程数据
 * @returns 操作结果 + 更新后的删除流程数据（null 表示已清除）
 */
export function cancelDelete(
  flow: DeleteFlowData | null,
): { result: AccountResult; flow: DeleteFlowData | null } {
  if (!flow) {
    return {
      result: { success: false, message: '无进行中的删除流程' },
      flow: null,
    };
  }

  if (flow.state === DeleteFlowState.ReadyToDelete) {
    return {
      result: { success: false, message: '冷静期已结束，请执行删除或联系客服' },
      flow,
    };
  }

  return {
    result: { success: true, message: '删除已撤销' },
    flow: null,
  };
}

// ─────────────────────────────────────────────
// 游客账号过期检测
// ─────────────────────────────────────────────

/**
 * 检查游客账号是否过期
 *
 * @param settings - 当前账号设置
 * @param createdAt - 账号创建时间戳
 * @param nowFn - 当前时间函数
 * @returns 是否已过期
 */
export function isGuestExpired(
  settings: AccountSettings,
  createdAt: number,
  nowFn: NowFn,
): boolean {
  if (!settings.isGuest) return false;
  // FIX-009: NaN createdAt 防护
  if (!Number.isFinite(createdAt)) return true;
  return nowFn() - createdAt >= GUEST_EXPIRE_MS;
}

/**
 * 获取游客账号剩余天数
 *
 * @param settings - 当前账号设置
 * @param createdAt - 账号创建时间戳
 * @param nowFn - 当前时间函数
 * @returns 剩余天数（0 表示已过期）
 */
export function getGuestRemainingDays(
  settings: AccountSettings,
  createdAt: number,
  nowFn: NowFn,
): number {
  if (!settings.isGuest) return 0;
  const elapsed = nowFn() - createdAt;
  const remaining = GUEST_EXPIRE_MS - elapsed;
  return Math.max(0, Math.ceil(remaining / (24 * 60 * 60 * 1000)));
}
