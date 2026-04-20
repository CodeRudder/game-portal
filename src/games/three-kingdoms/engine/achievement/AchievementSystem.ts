/**
 * 引擎层 — 成就系统
 *
 * 管理成就框架、5维度成就和奖励：
 *   #16 成就框架(5维度) — 战斗/建设/收集/社交/转生
 *   #17 成就奖励 — 资源+积分+声望值+解锁
 *   #18 转生成就链 — 链式成就+链完成奖励
 *
 * @module engine/achievement/AchievementSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  AchievementDimension,
  AchievementDef,
  AchievementInstance,
  AchievementStatus,
  AchievementState,
  AchievementReward,
  DimensionStats,
  RebirthAchievementChain,
  AchievementSaveData,
  AchievementConditionType,
} from '../../core/achievement';
import {
  ACHIEVEMENT_RARITY_WEIGHTS,
  ACHIEVEMENT_SAVE_VERSION,
} from '../../core/achievement';
import {
  ALL_ACHIEVEMENTS,
  ACHIEVEMENT_DEF_MAP,
  REBIRTH_ACHIEVEMENT_CHAINS,
} from '../../core/achievement';

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

/** 创建初始成就实例 */
function createAchievementInstance(def: AchievementDef): AchievementInstance {
  const progress: Record<string, number> = {};
  for (const cond of def.conditions) {
    progress[cond.type] = 0;
  }
  return {
    defId: def.id,
    status: def.prerequisiteId ? 'locked' : 'in_progress',
    progress,
    completedAt: null,
    claimedAt: null,
  };
}

/** 创建初始成就状态 */
function createInitialState(): AchievementState {
  const achievements: Record<string, AchievementInstance> = {};
  const dimensionStats: Record<string, DimensionStats> = {
    battle: { dimension: 'battle', completedCount: 0, totalCount: 0, totalPoints: 0 },
    building: { dimension: 'building', completedCount: 0, totalCount: 0, totalPoints: 0 },
    collection: { dimension: 'collection', completedCount: 0, totalCount: 0, totalPoints: 0 },
    social: { dimension: 'social', completedCount: 0, totalCount: 0, totalPoints: 0 },
    rebirth: { dimension: 'rebirth', completedCount: 0, totalCount: 0, totalPoints: 0 },
  };

  for (const def of ALL_ACHIEVEMENTS) {
    achievements[def.id] = createAchievementInstance(def);
    const dim = dimensionStats[def.dimension];
    if (dim) dim.totalCount++;
  }

  return {
    achievements,
    totalPoints: 0,
    dimensionStats: dimensionStats as Record<AchievementDimension, DimensionStats>,
    completedChains: [],
    chainProgress: {},
  };
}

/** 初始化成就链进度 */
function initChainProgress(): Record<string, number> {
  const progress: Record<string, number> = {};
  for (const chain of REBIRTH_ACHIEVEMENT_CHAINS) {
    progress[chain.chainId] = 0;
  }
  return progress;
}

// ─────────────────────────────────────────────
// AchievementSystem 类
// ─────────────────────────────────────────────

/**
 * 成就系统
 *
 * 管理5维度成就的进度追踪、完成检测和奖励发放。
 */
export class AchievementSystem implements ISubsystem {
  readonly name = 'achievement';

  private deps!: ISystemDeps;
  private state: AchievementState = createInitialState();
  private chainProgress: Record<string, number> = initChainProgress();
  private rewardCallback?: (reward: AchievementReward) => void;

  // ─── 生命周期 ───────────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;

    // 监听各种游戏事件以更新成就进度
    this.setupEventListeners();
  }

  update(_dt: number): void {
    // 成就系统不依赖帧更新
  }

  getState(): AchievementState {
    return {
      ...this.state,
      achievements: { ...this.state.achievements },
      dimensionStats: { ...this.state.dimensionStats },
    };
  }

  reset(): void {
    this.state = createInitialState();
    this.chainProgress = initChainProgress();
  }

  // ─── 配置 ───────────────────────────────

  /** 设置奖励回调 */
  setRewardCallback(cb: (reward: AchievementReward) => void): void {
    this.rewardCallback = cb;
  }

  // ─── 公开 API: 成就框架 (#16) ──────────

  /** 获取所有成就列表（含进度） */
  getAllAchievements(): (AchievementDef & { instance: AchievementInstance })[] {
    return ALL_ACHIEVEMENTS.map((def) => ({
      ...def,
      instance: this.state.achievements[def.id] ?? createAchievementInstance(def),
    }));
  }

  /** 按维度获取成就 */
  getAchievementsByDimension(dimension: AchievementDimension): (AchievementDef & { instance: AchievementInstance })[] {
    return this.getAllAchievements().filter((a) => a.dimension === dimension);
  }

  /** 获取单个成就详情 */
  getAchievement(id: string): (AchievementDef & { instance: AchievementInstance }) | null {
    const def = ACHIEVEMENT_DEF_MAP[id];
    if (!def) return null;
    return {
      ...def,
      instance: this.state.achievements[id] ?? createAchievementInstance(def),
    };
  }

  /** 获取维度统计 */
  getDimensionStats(): Record<AchievementDimension, DimensionStats> {
    return { ...this.state.dimensionStats };
  }

  /** 获取总成就积分 */
  getTotalPoints(): number {
    return this.state.totalPoints;
  }

  // ─── 公开 API: 成就进度更新 (#16) ──────

  /**
   * 更新成就进度
   * @param conditionType 条件类型
   * @param value 当前值（绝对值，非增量）
   */
  updateProgress(conditionType: AchievementConditionType, value: number): void {
    for (const def of ALL_ACHIEVEMENTS) {
      const instance = this.state.achievements[def.id];
      if (!instance || instance.status === 'completed' || instance.status === 'claimed') continue;

      // 检查前置成就
      if (def.prerequisiteId) {
        const prereq = this.state.achievements[def.prerequisiteId];
        if (!prereq || prereq.status === 'locked' || prereq.status === 'in_progress') continue;
      }

      // 解锁成就
      if (instance.status === 'locked' && !def.prerequisiteId) {
        instance.status = 'in_progress';
      } else if (instance.status === 'locked' && def.prerequisiteId) {
        const prereq = this.state.achievements[def.prerequisiteId];
        if (prereq && (prereq.status === 'completed' || prereq.status === 'claimed')) {
          instance.status = 'in_progress';
        }
      }

      if (instance.status !== 'in_progress') continue;

      // 更新匹配条件的进度
      for (const cond of def.conditions) {
        if (cond.type === conditionType) {
          instance.progress[cond.type] = Math.max(instance.progress[cond.type], value);
        }
      }

      // 检查是否达成
      this.checkCompletion(def);
    }
  }

  /**
   * 批量更新进度（从游戏状态快照）
   */
  updateProgressFromSnapshot(snapshot: Record<string, number>): void {
    for (const [type, value] of Object.entries(snapshot)) {
      this.updateProgress(type as AchievementConditionType, value);
    }
  }

  // ─── 公开 API: 成就奖励 (#17) ──────────

  /** 领取成就奖励 */
  claimReward(achievementId: string): {
    success: boolean;
    reward?: AchievementReward;
    reason?: string;
  } {
    const instance = this.state.achievements[achievementId];
    if (!instance) {
      return { success: false, reason: '成就不存在' };
    }
    if (instance.status !== 'completed') {
      return { success: false, reason: '成就未完成' };
    }

    const def = ACHIEVEMENT_DEF_MAP[achievementId];
    if (!def) return { success: false, reason: '成就定义不存在' };

    instance.status = 'claimed';
    instance.claimedAt = Date.now();

    // 更新积分
    this.state.totalPoints += def.rewards.achievementPoints;

    // 更新维度统计
    const dimStats = this.state.dimensionStats[def.dimension];
    if (dimStats) {
      dimStats.completedCount++;
      dimStats.totalPoints += def.rewards.achievementPoints;
    }

    // 发放奖励
    if (this.rewardCallback) {
      this.rewardCallback(def.rewards);
    }

    // 检查成就链进度 (#18)
    this.checkChainProgress();

    // 解锁后续成就
    this.unlockDependentAchievements(achievementId);

    return { success: true, reward: def.rewards };
  }

  /** 获取可领取的成就列表 */
  getClaimableAchievements(): string[] {
    return Object.entries(this.state.achievements)
      .filter(([, inst]) => inst.status === 'completed')
      .map(([id]) => id);
  }

  // ─── 公开 API: 转生成就链 (#18) ────────

  /** 获取所有成就链 */
  getAchievementChains(): (RebirthAchievementChain & { progress: number; completed: boolean })[] {
    return REBIRTH_ACHIEVEMENT_CHAINS.map((chain) => ({
      ...chain,
      progress: this.chainProgress[chain.chainId] ?? 0,
      completed: this.state.completedChains.includes(chain.chainId),
    }));
  }

  /** 获取已完成的成就链 */
  getCompletedChains(): string[] {
    return [...this.state.completedChains];
  }

  // ─── 存档 ───────────────────────────────

  /** 获取存档数据 */
  getSaveData(): AchievementSaveData {
    return {
      state: {
        ...this.state,
        achievements: { ...this.state.achievements },
        dimensionStats: { ...this.state.dimensionStats },
      },
      version: ACHIEVEMENT_SAVE_VERSION,
    };
  }

  /** 加载存档 */
  loadSaveData(data: AchievementSaveData): void {
    if (data.version !== ACHIEVEMENT_SAVE_VERSION) return;
    this.state = {
      ...data.state,
      achievements: { ...data.state.achievements },
      dimensionStats: { ...data.state.dimensionStats },
    };
    // 重建成就链进度
    this.checkChainProgress();
  }

  // ─── 内部方法 ───────────────────────────

  /** 设置事件监听 */
  private setupEventListeners(): void {
    // 监听战斗事件
    this.deps.eventBus.on<{ wins?: number }>('battle:completed', (p) => {
      if (p.wins) this.updateProgress('battle_wins', p.wins);
    });

    // 监听建筑事件
    this.deps.eventBus.on<{ level?: number; totalUpgrades?: number }>('building:upgraded', (p) => {
      if (p.level) this.updateProgress('building_level', p.level);
      if (p.totalUpgrades) this.updateProgress('building_upgrades', p.totalUpgrades);
    });

    // 监听武将事件
    this.deps.eventBus.on<{ count?: number; starTotal?: number }>('hero:recruited', (p) => {
      if (p.count) this.updateProgress('hero_count', p.count);
      if (p.starTotal) this.updateProgress('hero_star_total', p.starTotal);
    });

    // 监听转生事件
    this.deps.eventBus.on<{ count: number }>('rebirth:completed', (p) => {
      this.updateProgress('rebirth_count', p.count);
    });

    // 监听声望事件
    this.deps.eventBus.on<{ level: number }>('prestige:levelUp', (p) => {
      this.updateProgress('prestige_level', p.level);
    });
  }

  /** 检查单个成就是否完成 */
  private checkCompletion(def: AchievementDef): void {
    const instance = this.state.achievements[def.id];
    if (!instance || instance.status !== 'in_progress') return;

    const allMet = def.conditions.every((cond) => {
      const current = instance.progress[cond.type] ?? 0;
      return current >= cond.targetValue;
    });

    if (allMet) {
      instance.status = 'completed';
      instance.completedAt = Date.now();

      this.deps.eventBus.emit('achievement:completed', {
        id: def.id,
        name: def.name,
        dimension: def.dimension,
        rarity: def.rarity,
      });
    }
  }

  /** 解锁依赖此成就的后续成就 */
  private unlockDependentAchievements(completedId: string): void {
    for (const def of ALL_ACHIEVEMENTS) {
      if (def.prerequisiteId === completedId) {
        const instance = this.state.achievements[def.id];
        if (instance && instance.status === 'locked') {
          instance.status = 'in_progress';
        }
      }
    }
  }

  /** 检查成就链进度 (#18) */
  private checkChainProgress(): void {
    for (const chain of REBIRTH_ACHIEVEMENT_CHAINS) {
      let completedInChain = 0;
      for (const achId of chain.achievementIds) {
        const instance = this.state.achievements[achId];
        if (instance && (instance.status === 'completed' || instance.status === 'claimed')) {
          completedInChain++;
        }
      }

      this.chainProgress[chain.chainId] = completedInChain;

      // 检查链是否全部完成
      if (completedInChain === chain.achievementIds.length
          && !this.state.completedChains.includes(chain.chainId)) {
        this.state.completedChains.push(chain.chainId);

        // 发放链完成奖励
        if (this.rewardCallback) {
          this.rewardCallback(chain.chainBonusReward);
        }

        this.deps.eventBus.emit('achievement:chainCompleted', {
          chainId: chain.chainId,
          chainName: chain.chainName,
        });
      }
    }
  }
}
