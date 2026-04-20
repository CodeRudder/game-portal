/**
 * 引擎科技系统依赖注入
 *
 * 从 ThreeKingdomsEngine 中拆分出的科技系统初始化逻辑。
 * 职责：创建科技子系统实例、注入依赖、提供上下文接口
 *
 * v5.0 新增：
 *   - FusionTechSystem — 融合科技系统
 *   - TechLinkSystem — 科技联动系统
 *   - TechOfflineSystem — 离线研究系统
 *   - TechDetailProvider — 科技详情数据提供者
 *
 * @module engine/engine-tech-deps
 */

import { TechTreeSystem } from './tech/TechTreeSystem';
import { TechPointSystem } from './tech/TechPointSystem';
import { TechResearchSystem } from './tech/TechResearchSystem';
import { FusionTechSystem } from './tech/FusionTechSystem';
import { TechLinkSystem } from './tech/TechLinkSystem';
import { TechOfflineSystem } from './tech/TechOfflineSystem';
import { TechDetailProvider } from './tech/TechDetailProvider';
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
  /** v5.0: 融合科技系统 */
  readonly fusionSystem: FusionTechSystem;
  /** v5.0: 科技联动系统 */
  readonly linkSystem: TechLinkSystem;
  /** v5.0: 离线研究系统 */
  readonly offlineSystem: TechOfflineSystem;
  /** v5.0: 科技详情数据提供者 */
  readonly detailProvider: TechDetailProvider;
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
 * v5.0 新增：
 * - FusionTechSystem 依赖 TechTreeSystem（查询节点状态）
 * - TechLinkSystem 无外部依赖
 * - TechOfflineSystem 依赖 TechTreeSystem + TechResearchSystem
 * - TechDetailProvider 依赖 TechTreeSystem + FusionTechSystem + TechLinkSystem
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

  // v5.0: 创建融合科技系统（依赖 TechTreeSystem）
  const fusionSystem = new FusionTechSystem();
  fusionSystem.setTechTree(treeSystem);

  // v5.0: 创建科技联动系统
  const linkSystem = new TechLinkSystem();

  // v5.0: 注入联动系统到融合科技系统（双向依赖）
  fusionSystem.setLinkSystem(linkSystem);

  // v5.0: 创建离线研究系统（依赖 TechTreeSystem + TechResearchSystem）
  const offlineSystem = new TechOfflineSystem(treeSystem, researchSystem);

  // v5.0: 创建科技详情数据提供者
  const detailProvider = new TechDetailProvider(
    () => pointSystem.getState().current,
    () => 0, // 研究速度加成预留
  );
  detailProvider.setTechTree(treeSystem);
  detailProvider.setFusionSystem(fusionSystem);
  detailProvider.setLinkSystem(linkSystem);

  return {
    treeSystem, pointSystem, researchSystem,
    fusionSystem, linkSystem, offlineSystem, detailProvider,
  };
}

/**
 * 初始化科技子系统（注入依赖）
 *
 * 逐个调用 init(deps)，注入事件总线、配置注册表和子系统注册表。
 */
export function initTechSystems(systems: TechSystems, deps: ISystemDeps): void {
  systems.treeSystem.init(deps);
  systems.pointSystem.init(deps);
  systems.researchSystem.init(deps);
  // v5.0: 初始化新增子系统
  systems.fusionSystem.init(deps);
  systems.linkSystem.init(deps);
  systems.offlineSystem.init(deps);
  // TechDetailProvider 不实现 ISubsystem，无需 init
}
