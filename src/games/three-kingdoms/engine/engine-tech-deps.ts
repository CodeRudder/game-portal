/**
 * 引擎科技系统依赖注入
 *
 * 从 ThreeKingdomsEngine 中拆分出的科技系统初始化逻辑。
 * 职责：创建科技子系统实例、注入依赖、提供上下文接口
 *
 * @module engine/engine-tech-deps
 */

import { TechTreeSystem } from './tech/TechTreeSystem';
import { TechPointSystem } from './tech/TechPointSystem';
import { TechResearchSystem } from './tech/TechResearchSystem';
import type { BuildingSystem } from './building/BuildingSystem';
import type { ISystemDeps } from '../core/types';

// ─────────────────────────────────────────────
// 科技子系统集合
// ─────────────────────────────────────────────

/** 科技域所有子系统的集合 */
export interface TechSystems {
  readonly treeSystem: TechTreeSystem;
  readonly pointSystem: TechPointSystem;
  readonly researchSystem: TechResearchSystem;
}

// ─────────────────────────────────────────────
// 创建 & 初始化
// ─────────────────────────────────────────────

/**
 * 创建科技子系统实例
 *
 * 注意：ResearchSystem 依赖 TreeSystem 和 PointSystem，
 * 以及建筑系统的书院等级查询。
 *
 * @param buildingSystem - 建筑系统（获取书院等级）
 */
export function createTechSystems(buildingSystem: BuildingSystem): TechSystems {
  const treeSystem = new TechTreeSystem();
  const pointSystem = new TechPointSystem();

  // 研究系统依赖科技树和科技点系统
  // 书院等级从建筑系统获取
  // 天命相关暂时用默认值（预留）
  const researchSystem = new TechResearchSystem(
    treeSystem,
    pointSystem,
    () => buildingSystem.getLevel('academy'),
    // getMandate 预留：未来从资源系统获取
    () => 0,
    // spendMandate 预留：未来从资源系统消耗
    () => false,
  );

  return { treeSystem, pointSystem, researchSystem };
}

/**
 * 初始化科技子系统（注入依赖）
 */
export function initTechSystems(systems: TechSystems, deps: ISystemDeps): void {
  systems.treeSystem.init(deps);
  systems.pointSystem.init(deps);
  systems.researchSystem.init(deps);
}
