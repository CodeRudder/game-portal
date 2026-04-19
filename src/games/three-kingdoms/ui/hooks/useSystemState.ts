/**
 * 三国霸业 — 子系统状态订阅 Hook
 *
 * 职责：
 *   从 GameContext 的 snapshot 中提取各子系统的状态，
 *   为 UI 组件提供细粒度的数据切片。
 *
 * 返回数据（全部从 snapshot 提取，不可变）：
 *   - resources     当前资源数量
 *   - rates         产出速率（每秒）
 *   - caps          资源上限
 *   - buildings     所有建筑状态
 *   - onlineSeconds 在线时长
 *
 * 设计原则：
 *   - 纯数据提取，不含任何逻辑
 *   - 不包含渲染逻辑
 *   - 不直接引用 Engine 实例
 */

import { useMemo } from 'react';
import { useGameContext } from '../context/GameContext';
import type {
  Resources,
  ProductionRate,
  ResourceCap,
  BuildingType,
  BuildingState,
} from '../../shared/types';

// ─────────────────────────────────────────────
// 返回值类型
// ─────────────────────────────────────────────

export interface UseSystemStateResult {
  /** 当前资源数量（不可变引用） */
  resources: Readonly<Resources> | null;
  /** 产出速率（每秒） */
  rates: Readonly<ProductionRate> | null;
  /** 资源上限 */
  caps: Readonly<ResourceCap> | null;
  /** 所有建筑状态 */
  buildings: Readonly<Record<BuildingType, BuildingState>> | null;
  /** 在线时长（秒） */
  onlineSeconds: number;
  /** 快照是否可用 */
  isAvailable: boolean;
}

// ─────────────────────────────────────────────
// Hook 实现
// ─────────────────────────────────────────────

/**
 * useSystemState — 子系统状态订阅 Hook。
 *
 * 从 GameContext 提供的 snapshot 中提取各子系统状态。
 * 必须在 GameProvider 内部使用。
 *
 * @example
 * ```tsx
 * const { resources, rates, caps, buildings } = useSystemState();
 * ```
 */
export function useSystemState(): UseSystemStateResult {
  const { snapshot } = useGameContext();

  return useMemo<UseSystemStateResult>(() => {
    if (!snapshot) {
      return {
        resources: null,
        rates: null,
        caps: null,
        buildings: null,
        onlineSeconds: 0,
        isAvailable: false,
      };
    }

    return {
      resources: snapshot.resources,
      rates: snapshot.productionRates,
      caps: snapshot.caps,
      buildings: snapshot.buildings,
      onlineSeconds: snapshot.onlineSeconds,
      isAvailable: true,
    };
  }, [snapshot]);
}
