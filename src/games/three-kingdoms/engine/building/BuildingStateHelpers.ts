/**
 * 建筑域 — 状态辅助函数
 *
 * 职责：纯函数，提供建筑初始状态创建和外观阶段计算
 * 从 BuildingSystem.ts 拆分以控制文件行数
 *
 * @module engine/building/BuildingStateHelpers
 */

import type {
  BuildingType,
  BuildingState,
  AppearanceStage,
} from './building.types';
import { BUILDING_TYPES } from './building.types';
import {
  BUILDING_UNLOCK_LEVELS,
} from './building-config';

/** 根据等级获取外观阶段 */
export function getAppearanceStage(level: number): AppearanceStage {
  if (level <= 5) return 'humble';
  if (level <= 12) return 'orderly';
  if (level <= 20) return 'refined';
  return 'glorious';
}

/** 创建单个建筑的初始状态 */
export function createInitialState(type: BuildingType): BuildingState {
  const unlocked = BUILDING_UNLOCK_LEVELS[type] === 0;
  return {
    type,
    level: unlocked ? 1 : 0,
    status: unlocked ? 'idle' : 'locked',
    upgradeStartTime: null,
    upgradeEndTime: null,
  };
}

/** 创建所有建筑的初始状态映射 */
export function createAllStates(): Record<BuildingType, BuildingState> {
  const s = {} as Record<BuildingType, BuildingState>;
  for (const t of BUILDING_TYPES) s[t] = createInitialState(t);
  return s;
}
