/**
 * 三国霸业 — 建筑操作 Hook
 *
 * 职责：
 *   封装所有建筑相关的操作和查询，通过 GameContext 获取引擎实例。
 *
 * 提供方法：
 *   - upgradeBuilding(type)     执行升级（扣资源 + 开始计时）
 *   - cancelUpgrade(type)       取消升级（返还 80% 资源）
 *   - checkUpgrade(type)        检查是否可升级
 *   - getUpgradeCost(type)      获取升级费用
 *   - getUpgradeProgress(type)  获取升级进度 [0, 1]
 *   - getUpgradeRemainingTime(type) 获取剩余时间（ms）
 *
 * 设计原则：
 *   - 所有数据从 snapshot 或引擎实时查询中提取（不可变）
 *   - 不包含渲染逻辑
 *   - 不直接 new Engine，通过 GameContext 获取
 */

import { useCallback } from 'react';
import { useGameContext } from '../context/GameContext';
import type { BuildingType, UpgradeCost, UpgradeCheckResult } from '../../shared/types';

// ─────────────────────────────────────────────
// 返回值类型
// ─────────────────────────────────────────────

export interface UseBuildingActionsResult {
  /** 执行建筑升级，失败时抛出 Error */
  upgradeBuilding: (type: BuildingType) => void;
  /** 取消建筑升级，返回返还的费用（null 表示该建筑未在升级） */
  cancelUpgrade: (type: BuildingType) => UpgradeCost | null;
  /** 检查建筑是否可升级 */
  checkUpgrade: (type: BuildingType) => UpgradeCheckResult;
  /** 获取升级费用，建筑已满级时返回 null */
  getUpgradeCost: (type: BuildingType) => UpgradeCost | null;
  /** 获取升级进度 [0, 1]，1 表示完成 */
  getUpgradeProgress: (type: BuildingType) => number;
  /** 获取升级剩余时间（ms），0 表示未在升级或已完成 */
  getUpgradeRemainingTime: (type: BuildingType) => number;
}

// ─────────────────────────────────────────────
// Hook 实现
// ─────────────────────────────────────────────

/**
 * useBuildingActions — 建筑操作 Hook。
 *
 * 必须在 GameProvider 内部使用。
 *
 * @example
 * ```tsx
 * const { upgradeBuilding, checkUpgrade } = useBuildingActions();
 * const result = checkUpgrade('farmland');
 * if (result.canUpgrade) {
 *   upgradeBuilding('farmland');
 * }
 * ```
 */
export function useBuildingActions(): UseBuildingActionsResult {
  const { engine } = useGameContext();

  const upgradeBuilding = useCallback(
    (type: BuildingType): void => {
      engine.upgradeBuilding(type);
    },
    [engine],
  );

  const cancelUpgrade = useCallback(
    (type: BuildingType): UpgradeCost | null => {
      return engine.cancelUpgrade(type);
    },
    [engine],
  );

  const checkUpgrade = useCallback(
    (type: BuildingType): UpgradeCheckResult => {
      return engine.checkUpgrade(type);
    },
    [engine],
  );

  const getUpgradeCost = useCallback(
    (type: BuildingType): UpgradeCost | null => {
      return engine.getUpgradeCost(type);
    },
    [engine],
  );

  const getUpgradeProgress = useCallback(
    (type: BuildingType): number => {
      return engine.getUpgradeProgress(type);
    },
    [engine],
  );

  const getUpgradeRemainingTime = useCallback(
    (type: BuildingType): number => {
      return engine.getUpgradeRemainingTime(type);
    },
    [engine],
  );

  return {
    upgradeBuilding,
    cancelUpgrade,
    checkUpgrade,
    getUpgradeCost,
    getUpgradeProgress,
    getUpgradeRemainingTime,
  };
}
