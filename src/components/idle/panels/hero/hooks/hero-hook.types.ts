/**
 * hero-hook.types — 武将子 Hook 共享类型
 *
 * 从原 useHeroEngine.ts 中提取的参数/返回类型定义，
 * 供各子 Hook 和聚合 Hook 共用。
 *
 * @module components/idle/panels/hero/hooks/hero-hook.types
 */

import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import type { GeneralData } from '@/games/three-kingdoms/engine';
import type { ActiveBond } from '@/games/three-kingdoms/engine/hero/BondSystem';
import type { SkillItem } from '../SkillUpgradePanel';
import type { HeroBrief, BuildingBrief } from '../HeroDispatchPanel';
import type { HeroInfo, RecommendPlan } from '../FormationRecommendPanel';
import type { BondCatalogItem } from '../BondCollectionPanel';

// ─────────────────────────────────────────────
// Hook 参数类型
// ─────────────────────────────────────────────

/** 所有子 Hook 共享的参数 */
export interface UseHeroEngineParams {
  /** ThreeKingdomsEngine 实例 */
  engine: ThreeKingdomsEngine;
  /** 快照版本号，用于触发重渲染 */
  snapshotVersion: number;
  /** 当前选中的武将ID（用于技能面板等） */
  selectedHeroId?: string;
  /** 编队中的武将ID列表 */
  formationHeroIds?: string[];
}

// ─────────────────────────────────────────────
// 子 Hook 返回类型
// ─────────────────────────────────────────────

/** useHeroList 返回类型 */
export interface UseHeroListReturn {
  allGenerals: GeneralData[];
  ownedHeroIds: string[];
  heroBriefs: HeroBrief[];
  heroInfos: HeroInfo[];
}

/** useHeroSkills 返回类型 */
export interface UseHeroSkillsReturn {
  skills: SkillItem[];
  skillBookAmount: number;
  goldAmount: number;
  upgradeSkill: (heroId: string, skillIndex: number) => void;
}

/** useHeroBonds 返回类型 */
export interface UseHeroBondsReturn {
  activeBonds: ActiveBond[];
  bondCatalog: BondCatalogItem[];
  heroFactionMap: Record<string, string>;
}

/** useHeroDispatch 返回类型 */
export interface UseHeroDispatchReturn {
  buildings: BuildingBrief[];
  dispatchHero: (heroId: string, buildingId: string) => void;
  recallHero: (buildingId: string) => void;
}

/** useFormation 返回类型 */
export interface UseFormationReturn {
  currentFormation: (string | null)[];
  powerCalculator: (heroes: HeroInfo[]) => number;
  generateRecommendations: () => RecommendPlan[];
  applyRecommend: (heroIds: (string | null)[]) => void;
}

// ─────────────────────────────────────────────
// 聚合 Hook 返回类型
// ─────────────────────────────────────────────

/** useHeroEngine 聚合返回类型（向后兼容） */
export type UseHeroEngineReturn = UseHeroListReturn &
  UseHeroSkillsReturn &
  UseHeroBondsReturn &
  UseHeroDispatchReturn &
  UseFormationReturn;
