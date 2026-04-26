/**
 * useHeroEngine — 武将系统聚合 Hook（重构版）
 *
 * 职责：
 * - 作为6个子 Hook 的聚合层，保持向后兼容
 * - 对外暴露与原版完全一致的接口
 *
 * 架构：
 *   useHeroEngine
 *     ├─ useHeroList        武将列表数据
 *     ├─ useHeroSkills      技能数据+升级操作
 *     ├─ useHeroBonds       羁绊数据
 *     ├─ useHeroDispatch    派遣数据+操作
 *     ├─ useFormation       编队数据+推荐
 *     └─ useHeroGuide       引导操作
 *
 * @module components/idle/panels/hero/hooks/useHeroEngine
 */

import { useMemo } from 'react';
import type { GeneralData } from '@/games/three-kingdoms/engine';
import type { UseHeroEngineParams, UseHeroEngineReturn } from './hero-hook.types';
import { useHeroList } from './useHeroList';
import { useHeroSkills } from './useHeroSkills';
import { useHeroBonds } from './useHeroBonds';
import { useHeroDispatch } from './useHeroDispatch';
import { useFormation } from './useFormation';

// 向后兼容：重新导出类型
export type { UseHeroEngineParams, UseHeroEngineReturn } from './hero-hook.types';

/**
 * 武将系统聚合 Hook
 *
 * 将6个子 Hook 的返回值合并为统一的接口，
 * 保持与原版 useHeroEngine 完全一致的 API。
 */
export function useHeroEngine(params: UseHeroEngineParams): UseHeroEngineReturn {
  // ── 子 Hook 调用 ──
  const heroList = useHeroList(params);
  const heroSkills = useHeroSkills(params);

  // useHeroBonds 依赖 heroList 的数据
  const heroBonds = useHeroBonds(params, useMemo(() => ({
    allGenerals: heroList.allGenerals,
    ownedHeroIds: heroList.ownedHeroIds,
  }), [heroList.allGenerals, heroList.ownedHeroIds]));

  const heroDispatch = useHeroDispatch(params);

  // useFormation 依赖 heroInfos
  const formation = useFormation(params, useMemo(() => ({
    heroInfos: heroList.heroInfos,
  }), [heroList.heroInfos]));

  return {
    ...heroList,
    ...heroSkills,
    ...heroBonds,
    ...heroDispatch,
    ...formation,
  };
}
