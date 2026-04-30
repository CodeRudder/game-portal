/**
 * 武将序列化器 — 负责武将状态的序列化/反序列化与深拷贝
 *
 * 从 HeroSystem 拆分而来，降低主类行数。
 * 规则：可引用 hero-config 和 hero.types，禁止引用其他域的 System
 *
 * @module engine/hero/HeroSerializer
 */

import type {
  GeneralData,
  HeroState,
  HeroSaveData,
  SkillData,
} from './hero.types';
import { HERO_SAVE_VERSION } from './hero-config';
import { gameLog } from '../../core/logger';

// ─────────────────────────────────────────────
// 深拷贝辅助
// ─────────────────────────────────────────────

/** 创建空的武将系统状态 */
export function createEmptyState(): HeroState {
  return {
    generals: {},
    fragments: {},
  };
}

/** 深拷贝武将数据 */
export function cloneGeneral(g: GeneralData): GeneralData {
  return {
    ...g,
    baseStats: { ...g.baseStats },
    skills: g.skills.map((s) => ({ ...s })),
  };
}

/** 深拷贝武将系统状态 */
export function cloneState(state: HeroState): HeroState {
  const generals: Record<string, GeneralData> = {};
  for (const [id, g] of Object.entries(state.generals)) {
    generals[id] = cloneGeneral(g);
  }
  return {
    generals,
    fragments: { ...state.fragments },
  };
}

// ─────────────────────────────────────────────
// 序列化 / 反序列化
// ─────────────────────────────────────────────

/**
 * 序列化武将系统状态
 *
 * @param state - 武将系统运行时状态
 * @returns 可存储的存档数据
 */
export function serializeHeroState(state: HeroState): HeroSaveData {
  return {
    version: HERO_SAVE_VERSION,
    state: cloneState(state),
  };
}

/**
 * 反序列化恢复武将系统状态
 *
 * @param data - 存档数据
 * @returns 恢复后的 HeroState
 */
export function deserializeHeroState(data: HeroSaveData): HeroState {
  if (!data || !data.state) {
    gameLog.warn('HeroSystem: 存档数据为空，返回空状态');
    return createEmptyState();
  }
  if (data.version !== HERO_SAVE_VERSION) {
    gameLog.warn(
      `HeroSystem: 存档版本不匹配 (期望 ${HERO_SAVE_VERSION}，实际 ${data.version})`,
    );
  }

  // 恢复武将数据
  const generals: Record<string, GeneralData> = {};
  for (const [id, g] of Object.entries(data.state.generals)) {
    generals[id] = cloneGeneral(g);
  }

  // 恢复碎片数据
  return {
    generals,
    fragments: { ...data.state.fragments },
  };
}
