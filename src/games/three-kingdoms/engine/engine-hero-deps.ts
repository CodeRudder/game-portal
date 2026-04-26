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
import type { ResourceType } from '../shared/types';

// ─────────────────────────────────────────────
// 资源安全操作（供武将系统回调）
// ─────────────────────────────────────────────

const VALID_RESOURCE_TYPES: readonly ResourceType[] = ['grain', 'gold', 'troops', 'mandate', 'techPoint', 'recruitToken'];

/** 类型守卫：检查字符串是否为合法 ResourceType */
function isResourceType(type: string): type is ResourceType {
  return (VALID_RESOURCE_TYPES as readonly string[]).includes(type);
}

/** 安全消耗资源（武将系统回调用） */
export function safeSpendResource(resource: ResourceSystem, type: string, amount: number): boolean {
  if (!isResourceType(type)) return false;
  try {
    resource.consumeResource(type, amount);
    return true;
  } catch {
    return false;
  }
}

/** 安全检查资源是否充足（武将系统回调用） */
export function safeCanAfford(resource: ResourceSystem, type: string, amount: number): boolean {
  if (!isResourceType(type)) return false;
  const current = resource.getAmount(type);
  // 防御 NaN / undefined：非有限数值一律视为不足
  if (!Number.isFinite(current)) return false;
  // 粮草需要扣除保留量（MIN_GRAIN_RESERVE = 10）
  if (type === 'grain') {
    return Math.max(0, current - 10) >= amount;
  }
  return current >= amount;
}

/** 安全获取资源数量（武将系统回调用） */
export function safeGetAmount(resource: ResourceSystem, type: string): number {
  if (!isResourceType(type)) return 0;
  return resource.getAmount(type);
}

// ─────────────────────────────────────────────
// 武将子系统初始化
// ─────────────────────────────────────────────

/** 武将子系统集合（供 initHeroSystems 参数使用） */
export interface HeroSystems {
  hero: HeroSystem;
  heroRecruit: HeroRecruitSystem;
  heroLevel: HeroLevelSystem;
  /** 升星/突破系统（提供动态等级上限） */
  heroStar: import('./hero/HeroStarSystem').HeroStarSystem;
  /** 觉醒系统（提供觉醒后等级上限120） */
  awakening?: import('./hero/AwakeningSystem').AwakeningSystem;
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
    addResource: (type, amount) => { if (isResourceType(type)) resource.addResource(type, amount); },
  });

  // 升级系统 — 注入资源查询/消耗回调 + 等级上限回调
  // 等级上限优先级：觉醒(120) > 突破阶段(50/60/70/80/100) > 默认(50)
  systems.heroLevel.init(deps);
  systems.heroLevel.setLevelDeps({
    heroSystem: systems.hero,
    spendResource: (type, amount) => safeSpendResource(resource, type, amount),
    canAffordResource: (type, amount) => safeCanAfford(resource, type, amount),
    getResourceAmount: (type) => safeGetAmount(resource, type),
    getLevelCap: (generalId: string) => {
      // 觉醒武将等级上限120，否则取突破阶段上限
      if (systems.awakening?.isAwakened(generalId)) {
        return 120;
      }
      return systems.heroStar.getLevelCap(generalId);
    },
  });

  // 武将系统 — 注入等级上限回调（觉醒(120) > 突破阶段 → 等级上限联动）
  systems.hero.setLevelCapGetter((generalId: string) => {
    if (systems.awakening?.isAwakened(generalId)) {
      return 120;
    }
    return systems.heroStar.getLevelCap(generalId);
  });
}
