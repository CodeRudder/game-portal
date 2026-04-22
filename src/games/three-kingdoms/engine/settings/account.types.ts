/**
 * 账号系统 — 类型与常量
 *
 * 从 AccountSystem.ts 拆分，保持主文件 ≤500 行。
 *
 * @module engine/settings/account.types
 */

import type {
  BindingInfo,
  DeviceInfo,
  AccountSettings,
} from '../../core/settings';
import {
  ACCOUNT_DELETE_COOLDOWN_DAYS,
  DEVICE_UNBIND_COOLDOWN_HOURS,
} from '../../core/settings';

// ─────────────────────────────────────────────
// 类型
// ─────────────────────────────────────────────

/** 账号操作结果 */
export interface AccountResult {
  success: boolean;
  message: string;
}

/** 绑定操作结果（含奖励信息） */
export interface BindResult extends AccountResult {
  /** 是否触发了首次绑定奖励 */
  rewardGranted: boolean;
  /** 奖励元宝数量 */
  rewardAmount: number;
}

/** 设备操作结果 */
export interface DeviceResult extends AccountResult {
  /** 更新后的设备列表 */
  devices: DeviceInfo[];
}

/** 删除流程状态 */
export enum DeleteFlowState {
  /** 未发起 */
  None = 'none',
  /** 已输入确认文字 */
  Confirmed = 'confirmed',
  /** 二次确认完成，冷静期中 */
  CoolingDown = 'coolingDown',
  /** 冷静期结束，可永久删除 */
  ReadyToDelete = 'readyToDelete',
}

/** 删除流程数据 */
export interface DeleteFlowData {
  /** 当前状态 */
  state: DeleteFlowState;
  /** 发起时间 */
  initiatedAt: number;
  /** 冷静期结束时间 */
  cooldownEndAt: number;
}

/** 账号变更回调 */
export type AccountChangeCallback = (
  settings: Readonly<AccountSettings>,
) => void;

/** 元宝消耗函数签名 */
export type SpendIngotFn = (amount: number) => boolean;

/** 元宝奖励函数签名 */
export type GrantIngotFn = (amount: number) => void;

/** 当前时间函数（便于测试注入） */
export type NowFn = () => number;

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 确认删除文字 */
export const DELETE_CONFIRM_TEXT = '确认删除';

/** 冷静期天数转毫秒 */
export const COOLDOWN_MS = ACCOUNT_DELETE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

/** 设备解绑冷却毫秒 */
export const UNBIND_COOLDOWN_MS = DEVICE_UNBIND_COOLDOWN_HOURS * 60 * 60 * 1000;

/** 游客账号清除天数 */
export const GUEST_EXPIRE_DAYS = 30;

/** 游客账号清除毫秒 */
export const GUEST_EXPIRE_MS = GUEST_EXPIRE_DAYS * 24 * 60 * 60 * 1000;

// 重导出核心类型供外部使用
export type { BindingInfo, DeviceInfo, AccountSettings } from '../../core/settings';
