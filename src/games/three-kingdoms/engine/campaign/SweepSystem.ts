/**
 * 扫荡系统 — 核心逻辑
 *
 * 管理关卡扫荡功能，包括：
 * - 扫荡解锁条件（三星通关）
 * - 扫荡令管理（获取/消耗/数量检查）
 * - 批量扫荡执行（选择关卡+次数→结算）
 * - 奖励计算（复用 RewardDistributor）
 * - 自动推图（委托 AutoPushExecutor）
 *
 * @module engine/campaign/SweepSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  ICampaignDataProvider,
  RewardDistributorDeps,
} from './campaign.types';
import { MAX_STARS } from './campaign.types';
import { RewardDistributor } from './RewardDistributor';
import { AutoPushExecutor } from './AutoPushExecutor';
import type {
  AutoPushProgress,
  AutoPushResult,
  SweepBatchResult,
  SweepConfig,
  SweepDeps,
  SweepResult,
  SweepSaveData,
} from './sweep.types';
import { DEFAULT_SWEEP_CONFIG } from './sweep.types';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 存档数据版本号 */
const SAVE_VERSION = 1;

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

/** 获取今日日期字符串（YYYY-MM-DD） */
function getTodayString(now: number = Date.now()): string {
  const d = new Date(now);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 合并资源到目标 */
function mergeResources(
  target: Partial<Record<string, number>>,
  source: Partial<Record<string, number>>,
): void {
  for (const [type, amount] of Object.entries(source)) {
    if (amount !== undefined && amount > 0) {
      target[type] = (target[type] ?? 0) + amount;
    }
  }
}

/** 合并碎片到目标 */
function mergeFragments(
  target: Record<string, number>,
  source: Record<string, number>,
): void {
  for (const [id, count] of Object.entries(source)) {
    if (count > 0) {
      target[id] = (target[id] ?? 0) + count;
    }
  }
}

// ─────────────────────────────────────────────
// SweepSystem
// ─────────────────────────────────────────────

/**
 * 扫荡系统
 *
 * 管理关卡扫荡功能，跳过战斗直接获得奖励。
 * 三星通关的关卡可以扫荡，每次扫荡消耗扫荡令。
 *
 * @example
 * ```ts
 * const sweep = new SweepSystem(dataProvider, rewardDeps, sweepDeps);
 * if (sweep.canSweep('chapter1_stage1')) {
 *   const result = sweep.sweep('chapter1_stage1', 5);
 * }
 * ```
 */
export class SweepSystem implements ISubsystem {
  // ── ISubsystem 接口 ──
  readonly name = 'sweepSystem' as const;
  private sysDeps: ISystemDeps | null = null;

  private readonly dataProvider: ICampaignDataProvider;
  private readonly rewardDistributor: RewardDistributor;
  private readonly sweepDeps: SweepDeps;
  private readonly config: SweepConfig;

  /** 扫荡令数量 */
  private ticketCount: number;
  /** 今日已领取每日扫荡令 */
  private dailyTicketClaimed: boolean;
  /** 上次领取每日扫荡令的日期 */
  private lastDailyTicketDate: string | null;

  /** 自动推图执行器 */
  private readonly autoPushExecutor: AutoPushExecutor;

  constructor(
    dataProvider: ICampaignDataProvider,
    rewardDeps: RewardDistributorDeps,
    sweepDeps: SweepDeps,
    config?: Partial<SweepConfig>,
    rng?: () => number,
  ) {
    this.dataProvider = dataProvider;
    this.rewardDistributor = new RewardDistributor(dataProvider, rewardDeps, rng);
    this.sweepDeps = sweepDeps;
    this.config = { ...DEFAULT_SWEEP_CONFIG, ...config };

    this.ticketCount = 0;
    this.dailyTicketClaimed = false;
    this.lastDailyTicketDate = null;

    this.autoPushExecutor = new AutoPushExecutor(
      dataProvider, this.rewardDistributor, sweepDeps, this.config,
    );
  }

  // ── ISubsystem 适配层 ──

  init(deps: ISystemDeps): void { this.sysDeps = deps; }
  update(_dt: number): void { /* 事件驱动，不需要每帧更新 */ }

  getState(): { ticketCount: number; dailyTicketClaimed: boolean } {
    return {
      ticketCount: this.ticketCount,
      dailyTicketClaimed: this.dailyTicketClaimed,
    };
  }

  reset(): void {
    this.ticketCount = 0;
    this.dailyTicketClaimed = false;
    this.lastDailyTicketDate = null;
    this.autoPushExecutor.resetProgress();
  }

  // ─────────────────────────────────────────────
  // 1. 扫荡解锁条件检查
  // ─────────────────────────────────────────────

  /**
   * 检查关卡是否可扫荡（条件：三星通关）
   */
  canSweep(stageId: string): boolean {
    return this.sweepDeps.getStageStars(stageId) >= MAX_STARS;
  }

  /**
   * 获取关卡扫荡状态详情
   */
  getSweepStatus(stageId: string): {
    canSweep: boolean;
    reason: string;
    stars: number;
  } {
    const stars = this.sweepDeps.getStageStars(stageId);
    const stage = this.dataProvider.getStage(stageId);

    if (!stage) {
      return { canSweep: false, reason: '关卡不存在', stars: 0 };
    }
    if (stars < MAX_STARS) {
      return { canSweep: false, reason: `需要三星通关（当前${stars}星）`, stars };
    }
    return { canSweep: true, reason: '可以扫荡', stars };
  }

  // ─────────────────────────────────────────────
  // 2. 扫荡令管理
  // ─────────────────────────────────────────────

  /** 获取当前扫荡令数量 */
  getTicketCount(): number { return this.ticketCount; }

  /**
   * 增加扫荡令
   * @throws {Error} 数量 ≤ 0 时抛出异常
   */
  addTickets(amount: number): void {
    if (amount <= 0) {
      throw new Error(`[SweepSystem] 扫荡令数量必须大于0: ${amount}`);
    }
    this.ticketCount += amount;
  }

  /** 检查扫荡令是否足够 */
  hasEnoughTickets(count: number): boolean {
    return this.ticketCount >= count * this.config.sweepCostPerRun;
  }

  /** 计算所需扫荡令数量 */
  getRequiredTickets(count: number): number {
    return count * this.config.sweepCostPerRun;
  }

  /**
   * 领取每日扫荡令（每天一次，跨日重置）
   * @returns 领取到的数量，已领取返回0
   */
  claimDailyTickets(now: number = Date.now()): number {
    const today = getTodayString(now);

    if (this.lastDailyTicketDate !== today) {
      this.dailyTicketClaimed = false;
      this.lastDailyTicketDate = today;
    }

    if (this.dailyTicketClaimed) return 0;

    this.dailyTicketClaimed = true;
    this.lastDailyTicketDate = today;
    this.ticketCount += this.config.dailyTicketReward;
    return this.config.dailyTicketReward;
  }

  /** 今日是否已领取 */
  isDailyTicketClaimed(): boolean { return this.dailyTicketClaimed; }

  // ─────────────────────────────────────────────
  // 3. 批量扫荡执行
  // ─────────────────────────────────────────────

  /**
   * 执行批量扫荡
   *
   * @param stageId - 关卡ID
   * @param count - 扫荡次数
   * @returns 批量扫荡结果
   */
  sweep(stageId: string, count: number): SweepBatchResult {
    // 参数校验
    if (count <= 0) {
      return this.failResult(stageId, count, '扫荡次数必须大于0');
    }
    if (count > this.config.maxSweepCount) {
      return this.failResult(stageId, count, `单次扫荡最大${this.config.maxSweepCount}次`);
    }

    // 三星通关检查
    if (!this.canSweep(stageId)) {
      const stars = this.sweepDeps.getStageStars(stageId);
      return this.failResult(stageId, count, `需要三星通关（当前${stars}星）`);
    }

    // 扫荡令检查
    const required = this.getRequiredTickets(count);
    if (this.ticketCount < required) {
      return this.failResult(stageId, count, `扫荡令不足（需要${required}，当前${this.ticketCount}）`);
    }

    // 执行扫荡
    const results: SweepResult[] = [];
    const totalResources: Partial<Record<string, number>> = {};
    let totalExp = 0;
    const totalFragments: Record<string, number> = {};

    for (let i = 0; i < count; i++) {
      const result = this.executeSingleSweep(stageId);
      results.push(result);
      mergeResources(totalResources, result.reward.resources);
      totalExp += result.reward.exp;
      mergeFragments(totalFragments, result.reward.fragments);
    }

    // 消耗扫荡令
    this.ticketCount -= required;

    return {
      success: true, stageId, requestedCount: count, executedCount: count,
      results, totalResources, totalExp, totalFragments, ticketsUsed: required,
    };
  }

  // ─────────────────────────────────────────────
  // 4. 自动推图（委托 AutoPushExecutor）
  // ─────────────────────────────────────────────

  /** 获取自动推图进度 */
  getAutoPushProgress(): AutoPushProgress {
    return this.autoPushExecutor.getProgress();
  }

  /**
   * 执行自动推图
   *
   * 从当前最远可挑战关卡开始，循环挑战直到失败或达到最大尝试次数。
   */
  autoPush(): AutoPushResult {
    const { result, ticketsUsed } = this.autoPushExecutor.execute(this.ticketCount);
    // 消耗扫荡令
    this.ticketCount -= ticketsUsed;
    return result;
  }

  // ─────────────────────────────────────────────
  // 5. 序列化
  // ─────────────────────────────────────────────

  serialize(): SweepSaveData {
    return {
      version: SAVE_VERSION,
      ticketCount: this.ticketCount,
      dailyTicketClaimed: this.dailyTicketClaimed,
      lastDailyTicketDate: this.lastDailyTicketDate,
    };
  }

  deserialize(data: SweepSaveData): void {
    if (data.version !== SAVE_VERSION) {
      throw new Error(
        `[SweepSystem] 存档版本不兼容: 期望 ${SAVE_VERSION}, 实际 ${data.version}`,
      );
    }
    this.ticketCount = data.ticketCount;
    this.dailyTicketClaimed = data.dailyTicketClaimed;
    this.lastDailyTicketDate = data.lastDailyTicketDate;
  }

  // ─────────────────────────────────────────────
  // 内部方法
  // ─────────────────────────────────────────────

  /** 执行单次扫荡（使用历史最高星级，非首通） */
  private executeSingleSweep(stageId: string): SweepResult {
    const stars = this.sweepDeps.getStageStars(stageId);
    const reward = this.rewardDistributor.calculateRewards(stageId, stars, false);
    return { stageId, stars, reward };
  }

  /** 创建失败结果 */
  private failResult(stageId: string, requestedCount: number, reason: string): SweepBatchResult {
    return {
      success: false, stageId, requestedCount, executedCount: 0,
      results: [], totalResources: {}, totalExp: 0, totalFragments: {},
      ticketsUsed: 0, failureReason: reason,
    };
  }
}
