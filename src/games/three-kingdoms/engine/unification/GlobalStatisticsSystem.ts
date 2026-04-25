/**
 * 引擎层 — 全局统计系统 (GlobalStatisticsSystem)
 *
 * v20.0 天下一统(下) 统计子系统。
 * 汇总全局游戏统计数据，包括总游戏时长、成就汇总等。
 *
 * @module engine/unification/GlobalStatisticsSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';

// ─────────────────────────────────────────────
// 1. 类型定义
// ─────────────────────────────────────────────

/** 全局统计快照 */
export interface GlobalStatistics {
  /** 总游戏时长（秒） */
  totalPlayTime: number;
  /** 总战力 */
  totalPower: number;
  /** 武将数量 */
  heroCount: number;
  /** 领土占领数 */
  territoryOwned: number;
  /** 领土总数 */
  territoryTotal: number;
  /** 声望等级 */
  prestigeLevel: number;
  /** 成就已解锁数 */
  achievementsUnlocked: number;
  /** 成就总数 */
  achievementsTotal: number;
}

/** 全局统计序列化数据 */
export interface GlobalStatisticsSaveData {
  /** 累计在线时长（秒） */
  accumulatedOnlineSeconds: number;
}

// ─────────────────────────────────────────────
// 2. GlobalStatisticsSystem 实现
// ─────────────────────────────────────────────

/**
 * 全局统计系统
 *
 * 聚合各子系统数据，提供统一的全局统计视图。
 */
export class GlobalStatisticsSystem implements ISubsystem {
  readonly name = 'globalStatistics';

  private deps!: ISystemDeps;
  private accumulatedOnlineSeconds = 0;

  // ─── 生命周期 ───────────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  update(dt: number): void {
    this.accumulatedOnlineSeconds += dt;
  }

  reset(): void {
    this.accumulatedOnlineSeconds = 0;
  }

  // ─── 公开 API ───────────────────────────

  /**
   * 获取全局统计快照
   *
   * 聚合各子系统状态，返回统一统计视图。
   */
  getSnapshot(): GlobalStatistics {
    const registry = this.deps?.registry;

    let totalPower = 0;
    let heroCount = 0;
    let territoryOwned = 0;
    let territoryTotal = 0;
    let prestigeLevel = 1;
    let achievementsUnlocked = 0;
    let achievementsTotal = 0;

    try {
      if (registry) {
        // 英雄系统
        const hero = registry.get('hero') as {
          calculateTotalPower?: () => number;
          getAllGenerals?: () => { id: string }[];
        } | null;
        if (hero) {
          if (typeof hero.calculateTotalPower === 'function') {
            totalPower = hero.calculateTotalPower();
          }
          if (typeof hero.getAllGenerals === 'function') {
            heroCount = hero.getAllGenerals().length;
          }
        }

        // 领土系统
        const territory = registry.get('territory') as {
          getPlayerTerritoryCount?: () => number;
          getTotalTerritoryCount?: () => number;
        } | null;
        if (territory) {
          if (typeof territory.getPlayerTerritoryCount === 'function') {
            territoryOwned = territory.getPlayerTerritoryCount();
          }
          if (typeof territory.getTotalTerritoryCount === 'function') {
            territoryTotal = territory.getTotalTerritoryCount();
          }
        }

        // 声望系统
        const prestige = registry.get('prestige') as {
          getState?: () => { level?: number };
        } | null;
        if (prestige && typeof prestige.getState === 'function') {
          const pState = prestige.getState();
          if (pState?.level !== undefined) {
            prestigeLevel = pState.level;
          }
        }

        // 成就系统
        const achievement = registry.get('achievement') as {
          getAllAchievements?: () => { instance: { status: string } }[];
        } | null;
        if (achievement && typeof achievement.getAllAchievements === 'function') {
          const all = achievement.getAllAchievements();
          achievementsTotal = all.length;
          achievementsUnlocked = all.filter(a =>
            a.instance.status === 'completed' || a.instance.status === 'claimed',
          ).length;
        }
      }
    } catch {
      // 查询失败时使用默认值
    }

    return {
      totalPlayTime: this.accumulatedOnlineSeconds,
      totalPower,
      heroCount,
      territoryOwned,
      territoryTotal,
      prestigeLevel,
      achievementsUnlocked,
      achievementsTotal,
    };
  }

  /**
   * 获取总游戏时长（秒）
   */
  getTotalPlayTime(): number {
    return this.accumulatedOnlineSeconds;
  }

  /**
   * 序列化（用于存档）
   */
  serialize(): GlobalStatisticsSaveData {
    return {
      accumulatedOnlineSeconds: this.accumulatedOnlineSeconds,
    };
  }

  /**
   * 反序列化（用于读档）
   */
  deserialize(data: GlobalStatisticsSaveData): void {
    this.accumulatedOnlineSeconds = data.accumulatedOnlineSeconds;
  }

  /** 获取内部状态 */
  getState(): GlobalStatisticsSaveData {
    return this.serialize();
  }
}
