/**
 * 每日签到系统 — 引擎层
 *
 * 职责：7天循环签到、补签机制、连续签到加成
 * 规则：
 *   - 7天循环：第1天~第7天，循环重置
 *   - 连续3天加成20%，连续7天加成50%
 *   - 补签：消耗元宝50/次，每周最多2次
 *   - 每日0点重置签到状态
 *
 * @module engine/activity/SignInSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  SignInReward,
  SignInData,
  SignInConfig,
} from '../../core/activity/activity.types';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 签到奖励配置（7天循环） */
export const DEFAULT_SIGN_IN_REWARDS: SignInReward[] = [
  { day: 1, description: '铜钱×1000', rewards: { copper: 1000 }, tokenReward: 0 },
  { day: 2, description: '加速道具×1', rewards: { speedItem: 1 }, tokenReward: 0 },
  { day: 3, description: '元宝×20', rewards: { gold: 20 }, tokenReward: 10 },
  { day: 4, description: '铜钱×2000', rewards: { copper: 2000 }, tokenReward: 0 },
  { day: 5, description: '招募令×1', rewards: { recruitOrder: 1 }, tokenReward: 0 },
  { day: 6, description: '装备箱×1', rewards: { equipBox: 1 }, tokenReward: 20 },
  { day: 7, description: '武将碎片×5', rewards: { heroFragment: 5 }, tokenReward: 50 },
];

/** 默认签到配置 */
export const DEFAULT_SIGN_IN_CONFIG: SignInConfig = {
  retroactiveCostGold: 50,
  weeklyRetroactiveLimit: 2,
  consecutive3Bonus: 20,
  consecutive7Bonus: 50,
};

/** 签到循环天数 */
export const SIGN_IN_CYCLE_DAYS = 7;

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────

/** 创建默认签到数据 */
export function createDefaultSignInData(): SignInData {
  return {
    consecutiveDays: 0,
    todaySigned: false,
    lastSignInTime: 0,
    weeklyRetroactiveCount: 0,
    lastRetroactiveResetWeek: 0,
  };
}

/**
 * 判断两个时间戳是否同一天
 */
function isSameDay(ts1: number, ts2: number): boolean {
  const d1 = new Date(ts1);
  const d2 = new Date(ts2);
  return d1.getFullYear() === d2.getFullYear()
    && d1.getMonth() === d2.getMonth()
    && d1.getDate() === d2.getDate();
}

/**
 * 判断是否是连续的第二天
 */
function isConsecutiveDay(lastTime: number, now: number): boolean {
  const last = new Date(lastTime);
  const current = new Date(now);
  const diffMs = current.getTime() - last.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  return diffDays === 1;
}

/**
 * 获取当前周编号（用于补签重置）
 */
function getWeekNumber(ts: number): number {
  const d = new Date(ts);
  const start = new Date(d.getFullYear(), 0, 1);
  const diff = d.getTime() - start.getTime();
  return Math.ceil((diff / (24 * 60 * 60 * 1000) + start.getDay() + 1) / 7);
}

// ─────────────────────────────────────────────
// SignInSystem 类
// ─────────────────────────────────────────────

/**
 * 签到系统
 *
 * 管理7天循环签到、补签、连续加成
 */
export class SignInSystem implements ISubsystem {
  // ─── ISubsystem 接口 ───────────────────────

  readonly name = 'signIn' as const;
  private deps: ISystemDeps | null = null;

  private config: SignInConfig;
  private rewards: SignInReward[];

  constructor(
    config?: Partial<SignInConfig>,
    rewards?: SignInReward[],
  ) {
    this.config = { ...DEFAULT_SIGN_IN_CONFIG, ...config };
    this.rewards = rewards ?? [...DEFAULT_SIGN_IN_REWARDS];
  }

  // ─── ISubsystem 适配层 ─────────────────────

  /** 注入依赖 */
  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  /** 签到系统无需帧更新 */
  update(_dt: number): void {
    // 签到系统由事件驱动，无需帧更新
  }

  /** 获取系统状态快照 */
  getState(): Record<string, unknown> {
    return {
      name: this.name,
      config: this.config,
      rewardsCount: this.rewards.length,
    };
  }

  /** 重置系统状态 */
  reset(): void {
    this.config = { ...DEFAULT_SIGN_IN_CONFIG };
    this.rewards = [...DEFAULT_SIGN_IN_REWARDS];
  }

  // ── 签到操作 ──────────────────────────────

  /**
   * 签到
   */
  signIn(data: SignInData, now: number): {
    data: SignInData;
    reward: SignInReward;
    bonusPercent: number;
  } {
    // FIX-SIGN-007: NaN防护
    if (!Number.isFinite(now)) throw new Error('时间参数异常');

    if (data.todaySigned && isSameDay(data.lastSignInTime, now)) {
      throw new Error('今日已签到');
    }

    // 计算连续天数
    let consecutiveDays: number;
    if (data.lastSignInTime === 0) {
      // 首次签到
      consecutiveDays = 1;
    } else if (isConsecutiveDay(data.lastSignInTime, now)) {
      // 连续签到
      consecutiveDays = data.consecutiveDays + 1;
    } else if (isSameDay(data.lastSignInTime, now)) {
      // 同一天（不应该到这里，因为todaySigned检查）
      consecutiveDays = data.consecutiveDays;
    } else {
      // 断签，重新从1开始
      consecutiveDays = 1;
    }

    // 7天循环
    const cycleDay = ((consecutiveDays - 1) % SIGN_IN_CYCLE_DAYS) + 1;

    // 获取奖励
    const reward = this.getReward(cycleDay);

    // 计算加成
    const bonusPercent = this.getConsecutiveBonus(consecutiveDays);

    // 检查并重置补签次数（新的一周）
    let weeklyRetroactiveCount = data.weeklyRetroactiveCount;
    const currentWeek = getWeekNumber(now);
    if (currentWeek !== data.lastRetroactiveResetWeek) {
      weeklyRetroactiveCount = 0;
    }

    const newData: SignInData = {
      consecutiveDays,
      todaySigned: true,
      lastSignInTime: now,
      weeklyRetroactiveCount,
      lastRetroactiveResetWeek: currentWeek,
    };

    return { data: newData, reward, bonusPercent };
  }

  /**
   * 补签
   */
  retroactive(data: SignInData, now: number, goldAvailable: number): {
    data: SignInData;
    goldCost: number;
  } {
    // FIX-SIGN-007b: NaN防护
    if (!Number.isFinite(now)) throw new Error('时间参数异常');
    // FIX-SIGN-008: NaN防护 — goldAvailable为NaN时拒绝
    if (!Number.isFinite(goldAvailable)) throw new Error('元宝数据异常');

    // 检查是否需要补签（今天已签到则无需补签）
    if (data.todaySigned && isSameDay(data.lastSignInTime, now)) {
      throw new Error('今日已签到，无需补签');
    }

    // 检查补签次数
    const currentWeek = getWeekNumber(now);
    let weeklyCount = data.weeklyRetroactiveCount;
    if (currentWeek !== data.lastRetroactiveResetWeek) {
      weeklyCount = 0;
    }

    if (weeklyCount >= this.config.weeklyRetroactiveLimit) {
      throw new Error('本周补签次数已用完');
    }

    // 检查元宝
    if (goldAvailable < this.config.retroactiveCostGold) {
      throw new Error('元宝不足');
    }

    // FIX-SIGN-009: 补签连续性修正 — 补签视为"补上漏签的那一天"
    // 设计意图：补签消耗元宝，目的是维持连续天数，因此consecutiveDays+1
    // 但如果从未签到过（lastSignInTime=0），补签视为首次签到
    let newConsecutiveDays: number;
    if (data.lastSignInTime === 0) {
      // 从未签到过，补签视为首次
      newConsecutiveDays = 1;
    } else {
      // 已有签到记录，补签视为补上漏签的那一天
      newConsecutiveDays = data.consecutiveDays + 1;
    }

    const newData: SignInData = {
      ...data,
      weeklyRetroactiveCount: weeklyCount + 1,
      lastRetroactiveResetWeek: currentWeek,
      consecutiveDays: newConsecutiveDays,
      todaySigned: true,
      lastSignInTime: now,
    };

    return {
      data: newData,
      goldCost: this.config.retroactiveCostGold,
    };
  }

  // ── 奖励查询 ──────────────────────────────

  /**
   * 获取指定天数的奖励
   */
  getReward(day: number): SignInReward {
    const idx = Math.max(0, Math.min(day - 1, this.rewards.length - 1));
    return { ...this.rewards[idx], rewards: { ...this.rewards[idx].rewards } };
  }

  /**
   * 获取全部奖励列表
   */
  getAllRewards(): SignInReward[] {
    return [...this.rewards];
  }

  /**
   * 获取连续签到加成
   */
  getConsecutiveBonus(consecutiveDays: number): number {
    if (consecutiveDays >= 7) return this.config.consecutive7Bonus;
    if (consecutiveDays >= 3) return this.config.consecutive3Bonus;
    return 0;
  }

  /**
   * 获取当前循环天数
   */
  getCycleDay(consecutiveDays: number): number {
    if (consecutiveDays <= 0) return 1;
    return ((consecutiveDays - 1) % SIGN_IN_CYCLE_DAYS) + 1;
  }

  // ── 状态查询 ──────────────────────────────

  /**
   * 检查是否可以签到
   */
  canSignIn(data: SignInData): boolean {
    return !data.todaySigned;
  }

  /**
   * 检查是否可以补签
   */
  canRetroactive(data: SignInData, now: number, goldAvailable: number): {
    canRetroactive: boolean;
    reason: string;
  } {
    if (data.todaySigned) return { canRetroactive: false, reason: '今日已签到' };

    const currentWeek = getWeekNumber(now);
    const weeklyCount = currentWeek !== data.lastRetroactiveResetWeek
      ? 0
      : data.weeklyRetroactiveCount;

    if (weeklyCount >= this.config.weeklyRetroactiveLimit) {
      return { canRetroactive: false, reason: '本周补签次数已用完' };
    }
    if (goldAvailable < this.config.retroactiveCostGold) {
      return { canRetroactive: false, reason: '元宝不足' };
    }
    return { canRetroactive: true, reason: '' };
  }

  /**
   * 获取本周剩余补签次数
   */
  getRemainingRetroactive(data: SignInData, now: number): number {
    const currentWeek = getWeekNumber(now);
    const weeklyCount = currentWeek !== data.lastRetroactiveResetWeek
      ? 0
      : data.weeklyRetroactiveCount;
    return Math.max(0, this.config.weeklyRetroactiveLimit - weeklyCount);
  }

  // ── 序列化 ──────────────────────────────

  /**
   * 导出签到数据
   *
   * FIX-ARCH-004: SignInSystem 缺失 serialize/deserialize
   * 签到数据需持久化到存档，否则刷新页面后连续天数/补签次数归零
   */
  serialize(): {
    config: SignInConfig;
    rewards: SignInReward[];
  } {
    return {
      config: { ...this.config },
      rewards: this.rewards.map(r => ({ ...r, rewards: { ...r.rewards } })),
    };
  }

  /**
   * 导入签到数据
   *
   * FIX-ARCH-004: 支持从存档恢复配置和奖励列表
   */
  deserialize(data: {
    config?: SignInConfig;
    rewards?: SignInReward[];
  }): void {
    if (!data) return;
    if (data.config && typeof data.config === 'object') {
      this.config = { ...DEFAULT_SIGN_IN_CONFIG, ...data.config };
    }
    if (Array.isArray(data.rewards) && data.rewards.length > 0) {
      this.rewards = data.rewards.map(r => ({ ...r, rewards: { ...r.rewards } }));
    }
  }

  // ── 工具方法 ──────────────────────────────

  /** 获取配置 */
  getConfig(): SignInConfig {
    return { ...this.config };
  }

  /** 获取签到循环天数 */
  getCycleDays(): number {
    return SIGN_IN_CYCLE_DAYS;
  }
}
