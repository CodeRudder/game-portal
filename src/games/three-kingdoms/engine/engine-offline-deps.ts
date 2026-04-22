/**
 * 离线收益子系统依赖注入辅助
 *
 * 从 ThreeKingdomsEngine 中拆分出的离线收益子系统(v9.0)的
 * 创建、初始化和注册逻辑。
 *
 * @module engine/engine-offline-deps
 */

import { OfflineRewardSystem } from './offline/OfflineRewardSystem';
import { OfflineEstimateSystem } from './offline/OfflineEstimateSystem';
import { OfflineSnapshotSystem } from './offline/OfflineSnapshotSystem';
import type { SubsystemRegistry } from '../core/engine/SubsystemRegistry';
import type { ISystemDeps } from '../core/types';

// ─────────────────────────────────────────────
// 离线子系统集合
// ─────────────────────────────────────────────

/** 离线收益子系统集合 */
export interface OfflineSystems {
  offlineReward: OfflineRewardSystem;
  offlineEstimate: OfflineEstimateSystem;
  offlineSnapshot: OfflineSnapshotSystem;
}

// ─────────────────────────────────────────────
// 创建离线子系统
// ─────────────────────────────────────────────

/**
 * 创建所有离线收益子系统实例
 */
export function createOfflineSystems(): OfflineSystems {
  return {
    offlineReward: new OfflineRewardSystem(),
    offlineEstimate: new OfflineEstimateSystem(),
    offlineSnapshot: new OfflineSnapshotSystem(),
  };
}

// ─────────────────────────────────────────────
// 注册离线子系统
// ─────────────────────────────────────────────

/**
 * 注册所有离线收益子系统到注册表
 */
export function registerOfflineSystems(registry: SubsystemRegistry, systems: OfflineSystems): void {
  const r = registry;
  r.register('offlineReward', systems.offlineReward);
  r.register('offlineEstimate', systems.offlineEstimate);
  r.register('offlineSnapshot', systems.offlineSnapshot);
}

// ─────────────────────────────────────────────
// 初始化离线子系统
// ─────────────────────────────────────────────

/**
 * 初始化离线收益子系统
 *
 * 离线子系统目前不需要外部依赖初始化，
 * 但保留接口以便未来扩展（如注入 EventBus、ConfigRegistry）。
 */
export function initOfflineSystems(_systems: OfflineSystems, _deps: ISystemDeps): void {
  // 离线子系统目前无需额外初始化
  // 未来可在此注入 EventBus 监听资源变化等
}

// ─────────────────────────────────────────────
// 重置离线子系统
// ─────────────────────────────────────────────

/**
 * 重置离线收益子系统
 */
export function resetOfflineSystems(systems: OfflineSystems): void {
  systems.offlineReward.reset();
  // OfflineEstimateSystem 无状态，无需重置
  systems.offlineSnapshot.clearSnapshot();
}
