/**
 * 测试公共辅助函数
 *
 * 提取自 9 个 v1 集成测试文件中重复的 createSim() 定义。
 * 所有集成测试共享同一个工厂函数，确保初始化逻辑一致。
 */

import { GameEventSimulator } from './GameEventSimulator';

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
