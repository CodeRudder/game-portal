/**
 * 医馆治疗系统 — 类型定义
 *
 * 规则：只有 interface/type/const，零运行时逻辑
 *
 * @module engine/clinic/clinic.types
 */

import type { TroopType } from '../barracks/barracks.types';

// ─────────────────────────────────────────────
// 伤兵池
// ─────────────────────────────────────────────

/** 伤兵池 */
export interface WoundedPool {
  /** 伤兵总数 */
  totalWounded: number;
  /** 按兵种分类的伤兵数量 */
  woundedByType: Record<TroopType, number>;
}

// ─────────────────────────────────────────────
// 治疗结果
// ─────────────────────────────────────────────

/** 治疗结果 */
export interface TreatmentResult {
  /** 恢复的兵力数量 */
  healed: number;
  /** 消耗的资源 */
  cost: Record<string, number>;
  /** 产出Buff是否激活 */
  buffActive: boolean;
}

// ─────────────────────────────────────────────
// 系统状态 & 存档
// ─────────────────────────────────────────────

/** 医馆系统状态 */
export interface ClinicState {
  /** 伤兵池 */
  woundedPool: WoundedPool;
  /** 治疗冷却结束时间戳（ms） */
  treatmentCooldownEnd: number;
  /** 产出Buff结束时间戳（ms） */
  buffEndTime: number;
}

/** 医馆系统存档数据 */
export interface ClinicSaveData {
  version: number;
  state: ClinicState;
  clinicLevel: number;
}

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 治疗冷却时间：30分钟（ms） */
export const TREATMENT_COOLDOWN_MS = 30 * 60 * 1000;

/** 产出Buff持续时间：10分钟（ms） */
export const PRODUCTION_BUFF_DURATION_MS = 10 * 60 * 1000;

/** 治疗恢复比例：10% */
export const TREATMENT_HEAL_RATE = 0.1;

/** 产出Buff加成：+10% */
export const PRODUCTION_BUFF_BONUS = 0.1;

/** 被动恢复速率：每级2% */
export const PASSIVE_HEAL_RATE_PER_LEVEL = 0.02;
