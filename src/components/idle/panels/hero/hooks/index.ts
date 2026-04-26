/**
 * hooks/index — 武将 Hook 统一导出
 *
 * 提供所有子 Hook 和聚合 Hook 的统一入口。
 *
 * @module components/idle/panels/hero/hooks
 */

// ── 聚合 Hook（主要入口） ──
export { useHeroEngine } from './useHeroEngine';
export type { UseHeroEngineParams, UseHeroEngineReturn } from './hero-hook.types';

// ── 子 Hook（可独立使用） ──
export { useHeroList } from './useHeroList';
export { useHeroSkills } from './useHeroSkills';
export { useHeroBonds } from './useHeroBonds';
export { useHeroDispatch } from './useHeroDispatch';
export { useFormation } from './useFormation';
export { useHeroGuide } from './useHeroGuide';
export type { UseHeroGuideReturn } from './useHeroGuide';

// ── 子 Hook 返回类型 ──
export type {
  UseHeroListReturn,
  UseHeroSkillsReturn,
  UseHeroBondsReturn,
  UseHeroDispatchReturn,
  UseFormationReturn,
} from './hero-hook.types';

// ── 共享常量（按需导入） ──
export {
  QUALITY_ORDER,
  UPGRADE_COST_TABLE,
  DEFAULT_COST,
  STAT_LABELS,
  MAX_FORMATION_SLOTS,
} from './hero-constants';
