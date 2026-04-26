/**
 * useHeroEngine — 向后兼容代理
 *
 * 此文件保留在原路径，重新导出 hooks/ 目录下的聚合 Hook，
 * 确保所有原有 import 路径继续正常工作。
 *
 * 推荐新代码使用：
 *   import { useHeroEngine } from './hooks';
 *   // 或直接导入子 Hook：
 *   import { useHeroList, useHeroSkills } from './hooks';
 *
 * @module components/idle/panels/hero/useHeroEngine
 */

export { useHeroEngine } from './hooks/useHeroEngine';
export type { UseHeroEngineParams, UseHeroEngineReturn } from './hooks/hero-hook.types';
