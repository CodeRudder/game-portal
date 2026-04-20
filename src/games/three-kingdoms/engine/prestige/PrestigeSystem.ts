/**
 * 引擎层 — 声望系统
 *
 * 管理声望等级、声望获取、产出加成特权：
 *   #1 声望分栏 — 当前等级/声望值/产出加成
 *   #2 等级阈值 — 1000 × N^1.8 公式
 *   #3 升级规则 — 自动检测升级
 *   #4 产出加成特权 — 1 + level × 0.02
 *   #5 声望获取途径 — 9种途径，每日上限
 *   #7 等级解锁奖励
 *   #14 声望专属任务
 *   #15 转生专属任务
 *
 * @module engine/prestige/PrestigeSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  PrestigeLevel,
  PrestigeLevelInfo,
  PrestigePanel,
  PrestigeSourceType,
  PrestigeGainRecord,
  PrestigeState,
  PrestigeSaveData,
  LevelUnlockReward,
} from '../../core/prestige';
import {
  MAX_PRESTIGE_LEVEL,
  PRESTIGE_BASE,
  PRESTIGE_EXPONENT,
  PRESTIGE_LEVEL_TITLES,
  PRODUCTION_BONUS_PER_LEVEL,
  PRESTIGE_SOURCE_CONFIGS,
  LEVEL_UNLOCK_REWARDS,
  PRESTIGE_SAVE_VERSION,
  PRESTIGE_QUESTS,
  REBIRTH_QUESTS,
} from '../../core/prestige';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 声望事件前缀 */
const EVENT_PREFIX = 'prestige';

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

/**
 * 计算等级所需声望值
 * 公式: 1000 × N^1.8
 */
export function calcRequiredPoints(level: number): number {
  if (level <= 0) return 0;
  return Math.floor(PRESTIGE_BASE * Math.pow(level, PRESTIGE_EXPONENT));
}

/**
 * 计算产出加成倍率
 * 公式: 1 + level × 0.02
 */
export function calcProductionBonus(level: number): number {
  return 1 + level * PRODUCTION_BONUS_PER_LEVEL;
}

/** 获取等级标题 */
function getLevelTitle(level: number): string {
  // 找到不超过当前level的最大key
  const keys = Object.keys(PRESTIGE_LEVEL_TITLES).map(Number).sort((a, b) => a - b);
  let title = '布衣';
  for (const k of keys) {
    if (level >= k) title = PRESTIGE_LEVEL_TITLES[k];
  }
  return title;
}

/** 获取等级特权列表 */
function getLevelPrivileges(level: number): string[] {
  const privileges: string[] = [];
  for (const reward of LEVEL_UNLOCK_REWARDS) {
    if (level >= reward.level && reward.privilegeId) {
      privileges.push(reward.privilegeId);
    }
  }
  return privileges;
}

/** 创建初始声望状态 */
function createInitialState(): PrestigeState {
  const dailyGained: Record<string, number> = {};
  for (const cfg of PRESTIGE_SOURCE_CONFIGS) {
    dailyGained[cfg.type] = 0;
  }
  return {
    currentPoints: 0,
    totalPoints: 0,
    currentLevel: 1,
    dailyGained: dailyGained as Record<PrestigeSourceType, number>,
    lastDailyReset: '',
    shopPurchases: {},
    claimedLevelRewards: [],
    completedPrestigeQuests: [],
    prestigeQuestProgress: {},
  };
}

// ─────────────────────────────────────────────
// PrestigeSystem 类
// ─────────────────────────────────────────────

/**
 * 声望系统
 *
 * 管理声望等级、获取途径、产出加成和等级解锁奖励。
 */
export class PrestigeSystem implements ISubsystem {
  readonly name = 'prestige';

  private deps!: ISystemDeps;
  private state: PrestigeState = createInitialState();
  private rewardCallback?: (reward: Record<string, number>) => void;

  // ─── 生命周期 ───────────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;

    // 监听声望获取事件
    this.deps.eventBus.on<{ source: PrestigeSourceType; points: number; relatedId?: string }>(
      `${EVENT_PREFIX}:gain`,
      (payload) => this.handlePrestigeGain(payload),
    );

    // 监听每日重置
    this.deps.eventBus.on('calendar:dayChanged', () => this.resetDailyGains());
  }

  update(_dt: number): void {
    // 声望系统不依赖帧更新，由事件驱动
  }

  getState(): PrestigeState {
    return { ...this.state };
  }

  reset(): void {
    this.state = createInitialState();
  }

  // ─── 公开 API ───────────────────────────

  /** 设置奖励回调 */
  setRewardCallback(cb: (reward: Record<string, number>) => void): void {
    this.rewardCallback = cb;
  }

  /** 获取声望分栏信息 (#1) */
  getPrestigePanel(): PrestigePanel {
    const nextLevel = this.state.currentLevel + 1;
    return {
      currentPoints: this.state.currentPoints,
      currentLevel: this.state.currentLevel,
      nextLevelPoints: nextLevel <= MAX_PRESTIGE_LEVEL
        ? calcRequiredPoints(nextLevel)
        : calcRequiredPoints(this.state.currentLevel),
      totalPoints: this.state.totalPoints,
      productionBonus: calcProductionBonus(this.state.currentLevel),
    };
  }

  /** 获取指定等级信息 (#2) */
  getLevelInfo(level: number): PrestigeLevelInfo {
    return {
      level,
      requiredPoints: calcRequiredPoints(level),
      title: getLevelTitle(level),
      productionBonus: calcProductionBonus(level),
      privileges: getLevelPrivileges(level),
    };
  }

  /** 获取当前等级信息 */
  getCurrentLevelInfo(): PrestigeLevelInfo {
    return this.getLevelInfo(this.state.currentLevel);
  }

  /**
   * 手动增加声望值 (#5)
   * @returns 实际获得的声望值（考虑每日上限）
   */
  addPrestigePoints(source: PrestigeSourceType, basePoints: number, relatedId?: string): number {
    const config = PRESTIGE_SOURCE_CONFIGS.find((c) => c.type === source);
    if (!config) return 0;

    // 检查每日上限
    const dailyGained = this.state.dailyGained[source] ?? 0;
    if (config.dailyCap > 0 && dailyGained >= config.dailyCap) {
      return 0;
    }

    // 计算实际获得（不超过每日上限）
    let actualPoints = basePoints;
    if (config.dailyCap > 0) {
      const remaining = config.dailyCap - dailyGained;
      actualPoints = Math.min(basePoints, remaining);
    }

    // 更新状态
    this.state.currentPoints += actualPoints;
    this.state.totalPoints += actualPoints;
    this.state.dailyGained[source] = dailyGained + actualPoints;

    // 检查升级 (#3)
    this.checkLevelUp();

    // 更新声望任务进度
    this.updatePrestigeQuestProgress(source, actualPoints);

    return actualPoints;
  }

  /** 获取产出加成倍率 (#4) */
  getProductionBonus(): number {
    return calcProductionBonus(this.state.currentLevel);
  }

  /** 获取所有声望获取途径配置 (#5) */
  getSourceConfigs() {
    return PRESTIGE_SOURCE_CONFIGS;
  }

  /** 获取等级解锁奖励列表 (#7) */
  getLevelRewards(): LevelUnlockReward[] {
    return LEVEL_UNLOCK_REWARDS.map((r) => ({
      ...r,
      claimed: this.state.claimedLevelRewards.includes(r.level),
    }));
  }

  /** 领取等级解锁奖励 (#7) */
  claimLevelReward(level: number): { success: boolean; reward?: Record<string, number>; reason?: string } {
    if (this.state.currentLevel < level) {
      return { success: false, reason: `声望等级不足，需要等级${level}` };
    }
    if (this.state.claimedLevelRewards.includes(level)) {
      return { success: false, reason: '奖励已领取' };
    }

    const reward = LEVEL_UNLOCK_REWARDS.find((r) => r.level === level);
    if (!reward) {
      return { success: false, reason: '无效的等级奖励' };
    }

    this.state.claimedLevelRewards.push(level);

    if (this.rewardCallback && reward.resources) {
      this.rewardCallback(reward.resources);
    }

    return { success: true, reward: reward.resources };
  }

  /** 获取声望专属任务 (#14) */
  getPrestigeQuests() {
    return PRESTIGE_QUESTS.filter((q) => this.state.currentLevel >= q.requiredPrestigeLevel);
  }

  /** 获取转生专属任务 (#15) */
  getRebirthQuests(rebirthCount: number) {
    return REBIRTH_QUESTS.filter((q) => rebirthCount >= q.requiredRebirthCount);
  }

  /** 获取声望任务进度 */
  getPrestigeQuestProgress(questId: string): number {
    return this.state.prestigeQuestProgress[questId] ?? 0;
  }

  /** 检查并完成声望任务 */
  checkPrestigeQuestCompletion(questId: string): boolean {
    const quest = PRESTIGE_QUESTS.find((q) => q.id === questId);
    if (!quest) return false;
    if (this.state.completedPrestigeQuests.includes(questId)) return false;

    const progress = this.state.prestigeQuestProgress[questId] ?? 0;
    if (progress >= quest.targetCount) {
      this.state.completedPrestigeQuests.push(questId);
      // 发放奖励
      if (quest.rewards.resources && this.rewardCallback) {
        this.rewardCallback(quest.rewards.resources);
      }
      if (quest.rewards.prestigePoints) {
        this.addPrestigePoints('event_complete', quest.rewards.prestigePoints);
      }
      return true;
    }
    return false;
  }

  /** 获取存档数据 */
  getSaveData(): PrestigeSaveData {
    return {
      prestige: { ...this.state },
      rebirth: {
        rebirthCount: 0,
        currentMultiplier: 1.0,
        rebirthRecords: [],
        accelerationDaysLeft: 0,
        completedRebirthQuests: [],
        rebirthQuestProgress: {},
      },
      version: PRESTIGE_SAVE_VERSION,
    };
  }

  /** 加载存档数据 */
  loadSaveData(data: PrestigeSaveData): void {
    if (data.version !== PRESTIGE_SAVE_VERSION) return;
    this.state = { ...data.prestige };
  }

  // ─── 内部方法 ───────────────────────────

  /** 处理声望获取事件 */
  private handlePrestigeGain(payload: { source: PrestigeSourceType; points: number; relatedId?: string }): void {
    this.addPrestigePoints(payload.source, payload.points, payload.relatedId);
  }

  /** 检查声望等级升级 (#3) */
  private checkLevelUp(): void {
    while (this.state.currentLevel < MAX_PRESTIGE_LEVEL) {
      const nextLevel = this.state.currentLevel + 1;
      const required = calcRequiredPoints(nextLevel);
      if (this.state.currentPoints >= required) {
        this.state.currentLevel = nextLevel;
        this.deps.eventBus.emit(`${EVENT_PREFIX}:levelUp`, {
          level: nextLevel,
          title: getLevelTitle(nextLevel),
          bonus: calcProductionBonus(nextLevel),
        });
      } else {
        break;
      }
    }
  }

  /** 重置每日声望获取 */
  private resetDailyGains(): void {
    for (const cfg of PRESTIGE_SOURCE_CONFIGS) {
      this.state.dailyGained[cfg.type] = 0;
    }
    this.state.lastDailyReset = new Date().toISOString().split('T')[0];
  }

  /** 更新声望任务进度 */
  private updatePrestigeQuestProgress(source: PrestigeSourceType, points: number): void {
    for (const quest of PRESTIGE_QUESTS) {
      if (this.state.completedPrestigeQuests.includes(quest.id)) continue;
      if (this.state.currentLevel < quest.requiredPrestigeLevel) continue;

      switch (quest.objectiveType) {
        case 'earn_prestige_points':
          this.state.prestigeQuestProgress[quest.id] =
            (this.state.prestigeQuestProgress[quest.id] ?? 0) + points;
          break;
        case 'reach_prestige_level':
          this.state.prestigeQuestProgress[quest.id] = this.state.currentLevel;
          break;
        default:
          break;
      }

      this.checkPrestigeQuestCompletion(quest.id);
    }
  }
}
