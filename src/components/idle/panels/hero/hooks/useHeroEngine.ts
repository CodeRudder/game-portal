/**
 * useHeroEngine — 武将系统聚合 Hook（重构版）
 *
 * 职责：
 * - 作为6个子 Hook 的聚合层，保持向后兼容
 * - 对外暴露与原版完全一致的接口
 * - 细粒度版本号分发：各子Hook只监听自己关心的版本号
 *
 * 架构：
 *   useHeroEngine
 *     ├─ useHeroList        武将列表数据      ← heroVersion
 *     ├─ useHeroSkills      技能数据+升级操作  ← heroVersion
 *     ├─ useHeroBonds       羁绊数据          ← bondVersion
 *     ├─ useHeroDispatch    派遣数据+操作      ← dispatchVersion
 *     ├─ useFormation       编队数据+推荐      ← formationVersion
 *     └─ useHeroGuide       引导操作
 *
 * 解耦说明（R12）：
 * - useHeroBonds 和 useFormation 不再依赖 useHeroList 的返回值
 * - 各子 Hook 直接从引擎获取所需数据，独立可用
 *
 * @module components/idle/panels/hero/hooks/useHeroEngine
 */

import { useMemo } from 'react';
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
 *
 * 细粒度版本号分发：
 * - heroVersion → useHeroList, useHeroSkills（武将/星级/技能变更）
 * - bondVersion → useHeroBonds（羁绊/阵营变更）
 * - formationVersion → useFormation（编队变更）
 * - dispatchVersion → useHeroDispatch（派遣/建筑变更）
 * - 未传入细粒度版本号时 fallback 到 snapshotVersion
 */
export function useHeroEngine(params: UseHeroEngineParams): UseHeroEngineReturn {
  const { snapshotVersion } = params;

  // ── 细粒度版本号解析（fallback 到 snapshotVersion） ──
  const heroVersion = params.heroVersion ?? snapshotVersion;
  const bondVersion = params.bondVersion ?? snapshotVersion;
  const formationVersion = params.formationVersion ?? snapshotVersion;
  const dispatchVersion = params.dispatchVersion ?? snapshotVersion;

  // ── 构建各子Hook的参数（只传递关心的版本号） ──
  const heroListParams = useMemo(() => ({
    ...params,
    // 只传 heroVersion，避免其他版本变化触发重计算
    snapshotVersion: heroVersion,
  }), [params.engine, heroVersion, params.selectedHeroId, params.formationHeroIds]);

  const heroSkillsParams = useMemo(() => ({
    ...params,
    snapshotVersion: heroVersion,
  }), [params.engine, heroVersion, params.selectedHeroId, params.formationHeroIds]);

  const heroBondsParams = useMemo(() => ({
    ...params,
    snapshotVersion: bondVersion,
  }), [params.engine, bondVersion, params.selectedHeroId, params.formationHeroIds]);

  const heroDispatchParams = useMemo(() => ({
    ...params,
    snapshotVersion: dispatchVersion,
  }), [params.engine, dispatchVersion, params.selectedHeroId, params.formationHeroIds]);

  const formationParams = useMemo(() => ({
    ...params,
    snapshotVersion: formationVersion,
  }), [params.engine, formationVersion, params.selectedHeroId, params.formationHeroIds]);

  // ── 子 Hook 调用（各子 Hook 独立，不传递其他 Hook 的返回值） ──
  const heroList = useHeroList(heroListParams);
  const heroSkills = useHeroSkills(heroSkillsParams);
  // useHeroBonds 直接从引擎获取武将数据，不依赖 heroList 返回值
  const heroBonds = useHeroBonds(heroBondsParams);
  const heroDispatch = useHeroDispatch(heroDispatchParams);
  // useFormation 直接从引擎获取武将数据，不依赖 heroList 返回值
  const formation = useFormation(formationParams);

  return {
    ...heroList,
    ...heroSkills,
    ...heroBonds,
    ...heroDispatch,
    ...formation,
  };
}
