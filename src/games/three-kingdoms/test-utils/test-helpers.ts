/**
 * 测试公共辅助函数与常量
 *
 * 提取自 9 个 v1 集成测试文件中重复的 createSim() 定义和魔法数字。
 * 所有集成测试共享同一个工厂函数和语义化常量，确保初始化逻辑一致。
 */

import { GameEventSimulator } from './GameEventSimulator';
import type { ResourceMap } from './GameEventSimulator';
import type { BuildingType } from '../shared/types';

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
  'smithy', 'academy', 'clinic', 'wall',
];

// ── 资源常量 ──

/** 充足资源（用于一般升级测试） */
export const SUFFICIENT_RESOURCES: ResourceMap = { grain: 50000, gold: 50000, troops: 50000 };

/** 大量资源（用于多级升级测试） */
export const MASSIVE_RESOURCES: ResourceMap = { grain: 5000000, gold: 5000000, troops: 5000000 };

/** 初始资源值（PRD 定义） */
export const INITIAL_RESOURCES = { grain: 500, gold: 300, troops: 50, mandate: 0 };
