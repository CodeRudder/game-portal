/**
 * 挑战关卡系统 — 引擎层核心逻辑
 *
 * 管理挑战关卡的资源消耗、次数限制、奖励发放。
 * 覆盖PRD §11 (CBT-8) 的引擎层功能：
 * - 挑战关卡前置校验（兵力/次数/体力）
 * - 资源预锁与扣减/返还
 * - 挑战奖励计算与入账
 * - 每日次数重置
 *
 * @module engine/campaign/ChallengeStageSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types/subsystem';
import { DEFAULT_CHALLENGE_STAGES } from './challenge-stages';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 挑战关卡配置 */
export interface ChallengeStageConfig {
  /** 关卡ID */
  id: string;
  /** 关卡名称 */
  name: string;
  /** 兵力消耗 */
  armyCost: number;
  /** 体力消耗 */
  staminaCost: number;
  /** 首通额外奖励 */
  firstClearBonus: ChallengeReward[];
  /** 通关奖励（固定掉落） */
  rewards: ChallengeReward[];
  /** 概率掉落 */
  randomDrops: ChallengeRandomDrop[];
}

/** 挑战关卡奖励 */
export interface ChallengeReward {
  /** 资源类型 */
  type: string;
  /** 数量 */
  amount: number;
}

/** 概率掉落 */
export interface ChallengeRandomDrop {
  /** 物品类型 */
  type: string;
  /** 数量 */
  amount: number;
  /** 掉落概率 (0~1) */
  probability: number;
}

/** 挑战关卡状态 */
export type ChallengeStageStatus = 'locked' | 'available' | 'completed';

/** 单个挑战关卡进度 */
export interface ChallengeStageProgress {
  /** 关卡ID */
  stageId: string;
  /** 是否已首通 */
  firstCleared: boolean;
  /** 今日已挑战次数 */
  dailyAttempts: number;
}

/** 挑战系统状态 */
export interface ChallengeSystemState {
  /** 各关卡进度 */
  stageProgress: Record<string, ChallengeStageProgress>;
  /** 今日日期 */
  lastResetDate: string | null;
}

/** 挑战前置校验结果 */
export interface ChallengeCheckResult {
  /** 是否通过 */
  canChallenge: boolean;
  /** 失败原因列表 */
  reasons: string[];
}

/** 挑战结果 */
export interface ChallengeResult {
  /** 是否胜利 */
  victory: boolean;
  /** 获得的奖励 */
  rewards: ChallengeReward[];
  /** 是否为首通 */
  firstClear: boolean;
  /** 消耗的兵力 */
  armyCost: number;
  /** 消耗的体力 */
  staminaCost: number;
}

/** 挑战系统存档数据 */
export interface ChallengeSaveData {
  version: number;
  stageProgress: Record<string, ChallengeStageProgress>;
  lastResetDate: string | null;
}

/** 挑战系统外部依赖 */
export interface ChallengeDeps {
  /** 获取资源数量 */
  getResourceAmount: (type: string) => number;
  /** 消耗资源 */
  consumeResource: (type: string, amount: number) => boolean;
  /** 增加资源 */
  addResource: (type: string, amount: number) => void;
  /** 增加武将碎片 */
  addFragment: (heroId: string, count: number) => void;
  /** 增加武将经验 */
  addExp: (exp: number) => void;
}

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 每日挑战次数上限 */
const DAILY_CHALLENGE_LIMIT = 3;

/** 存档版本号 */
const SAVE_VERSION = 1;

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

/** 获取今日日期字符串 (YYYY-MM-DD) */
function getTodayString(now: number = Date.now()): string {
  const d = new Date(now);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ─────────────────────────────────────────────
// ChallengeStageSystem
// ─────────────────────────────────────────────

/**
 * 挑战关卡系统
 *
 * 管理每日挑战关卡的资源消耗、次数限制和奖励发放。
 * 挑战关卡独立于主线战役，固定难度不随主线进度变化。
 *
 * @example
 * ```ts
 * const challenge = new ChallengeStageSystem(deps);
 * const check = challenge.checkCanChallenge('challenge_1');
 * if (check.canChallenge) {
 *   challenge.preLockResources('challenge_1');
 *   // ... 进入战斗 ...
 *   challenge.completeChallenge('challenge_1', true); // 胜利
 * }
 * ```
 */
export class ChallengeStageSystem implements ISubsystem {
  readonly name = 'challengeStageSystem' as const;
  private sysDeps: ISystemDeps | null = null;

  private readonly stages: ChallengeStageConfig[];
  private readonly deps: ChallengeDeps;
  private readonly rng: () => number;

  /** 各关卡进度 */
  private stageProgress: Record<string, ChallengeStageProgress>;
  /** 上次重置日期 */
  private lastResetDate: string | null;
  /** 当前预锁的资源 { stageId: { army, stamina } } */
  private preLockedResources: Record<string, { army: number; stamina: number }>;

  constructor(
    deps: ChallengeDeps,
    stages?: ChallengeStageConfig[],
    rng?: () => number,
  ) {
    this.deps = deps;
    this.stages = stages ?? DEFAULT_CHALLENGE_STAGES;
    this.rng = rng ?? Math.random;
    this.stageProgress = {};
    this.lastResetDate = null;
    this.preLockedResources = {};

    // 初始化所有关卡进度
    for (const stage of this.stages) {
      this.stageProgress[stage.id] = {
        stageId: stage.id,
        firstCleared: false,
        dailyAttempts: 0,
      };
    }
  }

  // ── ISubsystem 接口 ──

  init(deps: ISystemDeps): void { this.sysDeps = deps; }
  update(_dt: number): void { /* 事件驱动 */ }

  getState(): ChallengeSystemState {
    return {
      stageProgress: { ...this.stageProgress },
      lastResetDate: this.lastResetDate,
    };
  }

  reset(): void {
    this.stageProgress = {};
    this.lastResetDate = null;
    this.preLockedResources = {};
    for (const stage of this.stages) {
      this.stageProgress[stage.id] = {
        stageId: stage.id,
        firstCleared: false,
        dailyAttempts: 0,
      };
    }
  }

  // ── 每日重置 ──

  /** 检查并执行每日重置 */
  private resetDailyIfNeeded(now: number = Date.now()): void {
    const today = getTodayString(now);
    if (this.lastResetDate !== today) {
      for (const id of Object.keys(this.stageProgress)) {
        this.stageProgress[id].dailyAttempts = 0;
      }
      this.lastResetDate = today;
    }
  }

  // ── 查询 ──

  /** 获取所有挑战关卡配置 */
  getStageConfigs(): ChallengeStageConfig[] { return this.stages; }

  /** 获取指定关卡配置 */
  getStageConfig(stageId: string): ChallengeStageConfig | undefined {
    return this.stages.find(s => s.id === stageId);
  }

  /** 获取关卡进度 */
  getStageProgress(stageId: string): ChallengeStageProgress | undefined {
    return this.stageProgress[stageId];
  }

  /** 获取今日已挑战次数 */
  getDailyAttempts(stageId: string, now: number = Date.now()): number {
    this.resetDailyIfNeeded(now);
    return this.stageProgress[stageId]?.dailyAttempts ?? 0;
  }

  /** 获取今日剩余挑战次数 */
  getDailyRemaining(stageId: string, now: number = Date.now()): number {
    this.resetDailyIfNeeded(now);
    return Math.max(0, DAILY_CHALLENGE_LIMIT - this.getDailyAttempts(stageId, now));
  }

  /** 是否已首通 */
  isFirstCleared(stageId: string): boolean {
    return this.stageProgress[stageId]?.firstCleared ?? false;
  }

  // ── 前置校验 ──

  /**
   * 检查是否可以挑战指定关卡
   * 校验：兵力 ≥ 消耗 AND 每日次数未满 AND 体力 ≥ 消耗
   */
  checkCanChallenge(stageId: string, now: number = Date.now()): ChallengeCheckResult {
    this.resetDailyIfNeeded(now);
    const reasons: string[] = [];
    const config = this.getStageConfig(stageId);

    if (!config) {
      return { canChallenge: false, reasons: ['关卡不存在'] };
    }

    // 检查每日次数
    const attempts = this.getDailyAttempts(stageId, now);
    if (attempts >= DAILY_CHALLENGE_LIMIT) {
      reasons.push('今日挑战次数已用完');
    }

    // 检查兵力
    const armyAmount = this.deps.getResourceAmount('troops');
    if (armyAmount < config.armyCost) {
      reasons.push(`兵力不足（需要${config.armyCost}，当前${armyAmount}）`);
    }

    // 检查体力（使用天命mandate作为替代）
    const mandateAmount = this.deps.getResourceAmount('mandate');
    if (mandateAmount < config.staminaCost) {
      reasons.push(`天命不足（需要${config.staminaCost}，当前${mandateAmount}）`);
    }

    return { canChallenge: reasons.length === 0, reasons };
  }

  // ── 资源预锁 ──

  /**
   * 预锁资源（出征确认时）
   * 不实际扣减但冻结资源，战斗结束后确认扣减
   */
  preLockResources(stageId: string): boolean {
    const config = this.getStageConfig(stageId);
    if (!config) return false;

    const check = this.checkCanChallenge(stageId);
    if (!check.canChallenge) return false;

    // 检查是否已有预锁
    if (this.preLockedResources[stageId]) return false;

    // 预锁（实际扣减，但记录以便失败时返还）
    const armyOk = this.deps.consumeResource('troops', config.armyCost);
    const mandateOk = this.deps.consumeResource('mandate', config.staminaCost);

    if (!armyOk || !mandateOk) {
      // 回滚
      if (armyOk) this.deps.addResource('troops', config.armyCost);
      if (mandateOk) this.deps.addResource('mandate', config.staminaCost);
      return false;
    }

    this.preLockedResources[stageId] = {
      army: config.armyCost,
      stamina: config.staminaCost,
    };

    return true;
  }

  // ── 挑战完成 ──

  /**
   * 完成挑战关卡
   * @param stageId 关卡ID
   * @param victory 是否胜利
   * @returns 挑战结果
   */
  completeChallenge(stageId: string, victory: boolean): ChallengeResult {
    const config = this.getStageConfig(stageId);
    if (!config) {
      return { victory: false, rewards: [], firstClear: false, armyCost: 0, staminaCost: 0 };
    }

    const preLocked = this.preLockedResources[stageId];
    const armyCost = preLocked?.army ?? 0;
    const staminaCost = preLocked?.stamina ?? 0;

    // 清除预锁记录
    delete this.preLockedResources[stageId];

    if (victory) {
      // 胜利：确认扣减（已预锁），发放奖励
      const progress = this.stageProgress[stageId];
      const firstClear = !progress.firstCleared;

      // 更新进度
      if (progress) {
        progress.firstCleared = true;
        progress.dailyAttempts++;
      }

      // 计算奖励
      const rewards = this.calculateRewards(config, firstClear);

      // 发放奖励
      for (const reward of rewards) {
        if (reward.type.startsWith('fragment_')) {
          // 碎片奖励
          const heroId = reward.type.replace('fragment_', '');
          this.deps.addFragment(heroId, reward.amount);
        } else {
          this.deps.addResource(reward.type, reward.amount);
        }
      }

      // 发放武将经验（挑战关卡经验 = 主线同难度 × 1.5）
      const baseExp = 100 * 1.5; // 基础挑战经验
      this.deps.addExp(Math.floor(baseExp));

      return { victory: true, rewards, firstClear, armyCost, staminaCost };
    } else {
      // 失败：返还预锁资源，不消耗每日次数
      if (preLocked) {
        this.deps.addResource('troops', preLocked.army);
        this.deps.addResource('mandate', preLocked.stamina);
      }
      return { victory: false, rewards: [], firstClear: false, armyCost: 0, staminaCost: 0 };
    }
  }

  /**
   * 计算挑战奖励
   */
  private calculateRewards(config: ChallengeStageConfig, firstClear: boolean): ChallengeReward[] {
    const rewards: ChallengeReward[] = [];

    // 固定奖励
    for (const r of config.rewards) {
      rewards.push({ ...r });
    }

    // 概率掉落
    for (const drop of config.randomDrops) {
      if (this.rng() < drop.probability) {
        rewards.push({ type: drop.type, amount: drop.amount });
      }
    }

    // 首通额外奖励
    if (firstClear) {
      for (const r of config.firstClearBonus) {
        rewards.push({ ...r });
      }
    }

    return rewards;
  }

  // ── 存档 ──

  /** 序列化 */
  serialize(): ChallengeSaveData {
    return {
      version: SAVE_VERSION,
      stageProgress: { ...this.stageProgress },
      lastResetDate: this.lastResetDate,
    };
  }

  /** 反序列化 */
  deserialize(data: ChallengeSaveData): void {
    if (!data || data.version !== SAVE_VERSION) return;
    this.stageProgress = { ...data.stageProgress };
    this.lastResetDate = data.lastResetDate;
    this.preLockedResources = {};
  }
}
