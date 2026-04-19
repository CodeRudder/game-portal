/**
 * 武将系统依赖注入辅助
 *
 * 从 ThreeKingdomsEngine 中拆分出的武将子系统初始化和资源回调。
 * 职责：安全资源操作、武将子系统依赖注入
 *
 * @module engine/engine-hero-deps
 */

import type { ResourceSystem } from './resource/ResourceSystem';
import type { HeroSystem } from './hero/HeroSystem';
import type { HeroRecruitSystem } from './hero/HeroRecruitSystem';
import type { HeroLevelSystem } from './hero/HeroLevelSystem';
import type { ISystemDeps } from '../core/types';

// ─────────────────────────────────────────────
// 资源安全操作（供武将系统回调）
// ─────────────────────────────────────────────

const VALID_RESOURCE_TYPES = ['grain', 'gold', 'troops', 'mandate'] as const;

/** 安全消耗资源（武将系统回调用） */
export function safeSpendResource(resource: ResourceSystem, type: string, amount: number): boolean {
  if (!VALID_RESOURCE_TYPES.includes(type as any)) return false;
  try {
    resource.consumeResource(type as any, amount);
    return true;
  } catch {
    return false;
  }
}

/** 安全检查资源是否充足（武将系统回调用） */
export function safeCanAfford(resource: ResourceSystem, type: string, amount: number): boolean {
  if (!VALID_RESOURCE_TYPES.includes(type as any)) return false;
  const current = resource.getAmount(type as any);
  // 粮草需要扣除保留量（MIN_GRAIN_RESERVE = 10）
  if (type === 'grain') {
    return Math.max(0, current - 10) >= amount;
  }
  return current >= amount;
}

/** 安全获取资源数量（武将系统回调用） */
export function safeGetAmount(resource: ResourceSystem, type: string): number {
  if (!VALID_RESOURCE_TYPES.includes(type as any)) return 0;
  return resource.getAmount(type as any);
}

// ─────────────────────────────────────────────
// 武将子系统初始化
// ─────────────────────────────────────────────

/** 武将子系统集合（供 initHeroSystems 参数使用） */
export interface HeroSystems {
  hero: HeroSystem;
  heroRecruit: HeroRecruitSystem;
  heroLevel: HeroLevelSystem;
}

/** 初始化武将子系统（注入依赖和回调） */
export function initHeroSystems(
  systems: HeroSystems,
  resource: ResourceSystem,
  deps: ISystemDeps,
): void {
  // HeroSystem
  systems.hero.init(deps);

  // 招募系统 — 注入资源消耗回调
  systems.heroRecruit.init(deps);
  systems.heroRecruit.setRecruitDeps({
    heroSystem: systems.hero,
    spendResource: (type, amount) => safeSpendResource(resource, type, amount),
    canAffordResource: (type, amount) => safeCanAfford(resource, type, amount),
  });

  // 升级系统 — 注入资源查询/消耗回调
  systems.heroLevel.init(deps);
  systems.heroLevel.setLevelDeps({
    heroSystem: systems.hero,
    spendResource: (type, amount) => safeSpendResource(resource, type, amount),
    canAffordResource: (type, amount) => safeCanAfford(resource, type, amount),
    getResourceAmount: (type) => safeGetAmount(resource, type),
  });
}
