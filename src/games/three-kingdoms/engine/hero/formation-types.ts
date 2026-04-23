/**
 * Formation - types and constants
 *
 * Extracted from HeroFormation.ts.
 */

import type { GeneralData } from './hero.types';
import type { ISubsystem, ISystemDeps } from '../../core/types/subsystem';
// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

export const MAX_FORMATIONS = 3;

/** 每个编队最大武将数 */
export const MAX_SLOTS_PER_FORMATION = 6;

// ─────────────────────────────────────────────
// 类型
// ─────────────────────────────────────────────

/** 编队数据 */
export interface FormationData {
  /** 编队ID（'1' | '2' | '3'） */
  id: string;
  /** 编队名称 */
  name: string;
  /** 武将ID列表（最多6个，空位为空字符串） */
  slots: string[];
}

/** 编队系统状态 */
export interface FormationState {
  /** 所有编队 */
  formations: Record<string, FormationData>;
  /** 当前激活的编队ID */
  activeFormationId: string | null;
}

/** 编队系统存档数据 */
export interface FormationSaveData {
  version: number;
  state: FormationState;
}

// ─────────────────────────────────────────────
// 默认编队名称
// ─────────────────────────────────────────────

export const DEFAULT_NAMES: Record<string, string> = {
  '1': '第一队',
  '2': '第二队',
  '3': '第三队',
};

// ─────────────────────────────────────────────
// HeroFormation
// ─────────────────────────────────────────────

/**
 * 武将编队系统
 *
 * 管理编队的创建、编辑、切换和战力计算。
 * 编队中的武将ID需要通过 HeroSystem 校验。
 */
