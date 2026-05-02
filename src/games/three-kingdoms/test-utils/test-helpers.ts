/**
 * 测试公共辅助函数与常量
 *
 * 提取自 9 个 v1 集成测试文件中重复的 createSim() 定义和魔法数字。
 * 所有集成测试共享同一个工厂函数和语义化常量，确保初始化逻辑一致。
 */

import { GameEventSimulator } from './GameEventSimulator';
import type { ResourceMap } from './GameEventSimulator';
import type { BuildingType } from '../shared/types';
import type { ISystemDeps } from '../core/types/subsystem';

// ── 工厂函数 ──

/**
 * 创建一个全新初始化的 GameEventSimulator 实例。
 *
 * 等价于：
 *   const sim = new GameEventSimulator();
 *   sim.init();
 *
 * 每次调用返回独立实例，测试之间互不干扰。
 */
export function createSim(): GameEventSimulator {
  const sim = new GameEventSimulator();
  sim.init();
  return sim;
}

/**
 * 创建真实的 ISystemDeps（基于引擎内部的真实 EventBus、ConfigRegistry、SubsystemRegistry）。
 * 用于替代 mockDeps()，让子系统单元测试使用真实依赖而非 mock。
 */
export function createRealDeps(): ISystemDeps {
  const sim = createSim();
  return sim.engine.getSystemDeps();
}

/**
 * 创建并初始化带有指定资源的 GameEventSimulator。
 * 用于需要自定义资源量的测试场景。
 */
export function createSimWithResources(resources: ResourceMap): GameEventSimulator {
  const sim = new GameEventSimulator();
  sim.init();
  sim.addResources(resources);
  return sim;
}

/**
 * 创建带有充足资源的 GameEventSimulator（用于升级测试）。
 * 等价于 createSimWithResources(SUFFICIENT_RESOURCES)。
 */
export function createSimForResourceUpgrade(): GameEventSimulator {
  return createSimWithResources(SUFFICIENT_RESOURCES);
}

// ── 建筑类型常量 ──

/** 所有 8 种建筑类型 */
export const ALL_BUILDING_TYPES: BuildingType[] = [
  'castle', 'farmland', 'market', 'barracks',
  'workshop', 'academy', 'clinic', 'wall',
];

// ── 资源常量 ──

/** 充足资源（用于一般升级测试） */
export const SUFFICIENT_RESOURCES: ResourceMap = { grain: 50000, gold: 50000, troops: 50000 };

/** 大量资源（用于多级升级测试） */
export const MASSIVE_RESOURCES: ResourceMap = { grain: 5000000, gold: 5000000, troops: 5000000 };

/** 初始资源值（PRD 定义） */
export const INITIAL_RESOURCES = { grain: 500, gold: 300, troops: 50, mandate: 0 };

/**
 * 创建一个市集等级 ≥ 5 的 GameEventSimulator（用于资源交易测试）。
 * 交错升级：castle→4, farmland→4, castle→5, market→5。
 * 每次升级前自动补充充足资源并提高上限。
 */
export function createSimWithMarketLevel5(): GameEventSimulator {
  const sim = new GameEventSimulator();
  sim.init();

  // 提高上限避免资源被截断
  sim.engine.resource.setCap('grain', 50_000_000);
  sim.engine.resource.setCap('gold', 100_000_000);
  sim.engine.resource.setCap('troops', 10_000_000);

  // 交错升级到 castle Lv5 + market Lv5
  // castle Lv4→5 需要至少一座其他建筑达到 Lv4
  sim.addResources({ grain: 10000000, gold: 20000000, troops: 5000000 });
  sim.upgradeBuildingTo('castle', 4);
  sim.engine.resource.setCap('grain', 50_000_000);
  sim.engine.resource.setCap('gold', 100_000_000);
  sim.engine.resource.setCap('troops', 10_000_000);
  sim.addResources({ grain: 10000000, gold: 20000000, troops: 5000000 });
  sim.upgradeBuildingTo('farmland', 4);
  sim.engine.resource.setCap('grain', 50_000_000);
  sim.engine.resource.setCap('gold', 100_000_000);
  sim.engine.resource.setCap('troops', 10_000_000);
  sim.addResources({ grain: 10000000, gold: 20000000, troops: 5000000 });
  sim.upgradeBuildingTo('castle', 5);
  sim.engine.resource.setCap('grain', 50_000_000);
  sim.engine.resource.setCap('gold', 100_000_000);
  sim.engine.resource.setCap('troops', 10_000_000);
  sim.addResources({ grain: 10000000, gold: 20000000, troops: 5000000 });
  sim.upgradeBuildingTo('market', 5);
  sim.engine.resource.setCap('grain', 50_000_000);
  sim.engine.resource.setCap('gold', 100_000_000);
  sim.engine.resource.setCap('troops', 10_000_000);

  return sim;
}


