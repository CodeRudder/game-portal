/**
 * 引擎地图系统依赖注入
 *
 * 从 ThreeKingdomsEngine 中拆分出的地图系统初始化逻辑。
 * 职责：创建地图子系统实例、注入依赖、提供上下文接口
 *
 * 包含子系统：
 *   - WorldMapSystem — 世界地图核心（区域、地形、地标、视口）
 *   - TerritorySystem — 领土管理（归属、产出、升级、相邻关系）
 *   - SiegeSystem — 攻城战（条件校验、战斗执行、占领变更）
 *   - GarrisonSystem — 驻防系统（武将驻防、防御加成）
 *   - SiegeEnhancer — 攻城增强（胜率预估、攻城奖励）
 *
 * @module engine/engine-map-deps
 */

import { WorldMapSystem } from './map/WorldMapSystem';
import { TerritorySystem } from './map/TerritorySystem';
import { SiegeSystem } from './map/SiegeSystem';
import { GarrisonSystem } from './map/GarrisonSystem';
import { SiegeEnhancer } from './map/SiegeEnhancer';
import type { ISystemDeps } from '../core/types';

// ─────────────────────────────────────────────
// 地图子系统集合
// ─────────────────────────────────────────────

/** 地图域所有子系统的集合 */
export interface MapSystems {
  readonly worldMap: WorldMapSystem;
  readonly territory: TerritorySystem;
  readonly siege: SiegeSystem;
  readonly garrison: GarrisonSystem;
  readonly siegeEnhancer: SiegeEnhancer;
}

// ─────────────────────────────────────────────
// 创建 & 初始化
// ─────────────────────────────────────────────

/**
 * 创建地图子系统实例
 *
 * 地图子系统间通过 SubsystemRegistry 互相查询，
 * 无需在构造时注入直接依赖。
 *
 * 初始化顺序（init 调用顺序）：
 * 1. WorldMapSystem — 地图基础数据
 * 2. TerritorySystem — 领土数据（依赖地标数据初始化）
 * 3. GarrisonSystem — 驻防（依赖领土系统）
 * 4. SiegeSystem — 攻城（通过 registry 查询 TerritorySystem）
 * 5. SiegeEnhancer — 攻城增强（通过 registry 查询 SiegeSystem）
 */
export function createMapSystems(): MapSystems {
  const worldMap = new WorldMapSystem();
  const territory = new TerritorySystem();
  const siege = new SiegeSystem();
  const garrison = new GarrisonSystem();
  const siegeEnhancer = new SiegeEnhancer();

  return { worldMap, territory, siege, garrison, siegeEnhancer };
}

/**
 * 初始化地图子系统（注入依赖）
 *
 * 按依赖顺序初始化，确保基础系统先就绪。
 */
export function initMapSystems(systems: MapSystems, deps: ISystemDeps): void {
  systems.worldMap.init(deps);
  systems.territory.init(deps);
  systems.garrison.init(deps);
  systems.siege.init(deps);
  systems.siegeEnhancer.init(deps);
}
