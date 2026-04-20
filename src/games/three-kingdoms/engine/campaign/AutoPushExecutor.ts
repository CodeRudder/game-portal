/**
 * 扫荡系统 — 自动推图
 *
 * 负责自动推图功能，从当前最远关卡开始循环挑战直到失败。
 * 已三星通关的关卡使用扫荡，未三星的关卡模拟战斗。
 *
 * @module engine/campaign/AutoPushExecutor
 */

import type { ICampaignDataProvider } from './campaign.types';
import { MAX_STARS } from './campaign.types';
import { RewardDistributor } from './RewardDistributor';
import type {
  AutoPushProgress,
  AutoPushResult,
  SweepConfig,
  SweepDeps,
  SweepResult,
} from './sweep.types';

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

/**
 * 合并资源到目标对象
 */
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

/**
 * 合并碎片到目标对象
 */
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
// AutoPushExecutor
// ─────────────────────────────────────────────

/**
 * 自动推图执行器
 *
 * 封装自动推图的核心循环逻辑，与 SweepSystem 解耦。
 * 支持扫荡令管理和模拟战斗的协调。
 */
export class AutoPushExecutor {
  private readonly dataProvider: ICampaignDataProvider;
  private readonly rewardDistributor: RewardDistributor;
  private readonly sweepDeps: SweepDeps;
  private readonly config: SweepConfig;

  /** 自动推图进度 */
  private progress: AutoPushProgress;

  constructor(
    dataProvider: ICampaignDataProvider,
    rewardDistributor: RewardDistributor,
    sweepDeps: SweepDeps,
    config: SweepConfig,
  ) {
    this.dataProvider = dataProvider;
    this.rewardDistributor = rewardDistributor;
    this.sweepDeps = sweepDeps;
    this.config = config;

    this.progress = {
      isRunning: false,
      startStageId: '',
      currentStageId: '',
      attempts: 0,
      victories: 0,
      defeats: 0,
    };
  }

  /**
   * 获取自动推图进度
   */
  getProgress(): AutoPushProgress {
    return { ...this.progress };
  }

  /**
   * 重置进度
   */
  resetProgress(): void {
    this.progress = {
      isRunning: false,
      startStageId: '',
      currentStageId: '',
      attempts: 0,
      victories: 0,
      defeats: 0,
    };
  }

  /**
   * 执行自动推图
   *
   * @param ticketCount - 当前扫荡令数量
   * @returns 自动推图结果和消耗的扫荡令数量
   */
  execute(ticketCount: number): { result: AutoPushResult; ticketsUsed: number } {
    const startStageId = this.sweepDeps.getFarthestStageId();
    if (!startStageId) {
      return { result: this.emptyResult(''), ticketsUsed: 0 };
    }

    // 初始化进度
    this.progress = {
      isRunning: true,
      startStageId,
      currentStageId: startStageId,
      attempts: 0,
      victories: 0,
      defeats: 0,
    };

    const results: SweepResult[] = [];
    const totalResources: Partial<Record<string, number>> = {};
    let totalExp = 0;
    const totalFragments: Record<string, number> = {};
    let ticketsUsed = 0;
    let currentStageId = startStageId;
    let reachedMaxAttempts = false;
    let remainingTickets = ticketCount;

    for (let i = 0; i < this.config.autoPushMaxAttempts; i++) {
      this.progress.currentStageId = currentStageId;
      this.progress.attempts = i + 1;

      // 检查关卡是否可挑战
      if (!this.sweepDeps.canChallenge(currentStageId)) {
        break;
      }

      const stars = this.sweepDeps.getStageStars(currentStageId);

      // 已三星通关 → 使用扫荡（消耗扫荡令）
      if (stars >= MAX_STARS) {
        if (remainingTickets >= this.config.sweepCostPerRun) {
          // 使用扫荡
          const reward = this.rewardDistributor.calculateRewards(currentStageId, stars, false);
          const sweepResult: SweepResult = { stageId: currentStageId, stars, reward };
          results.push(sweepResult);
          mergeResources(totalResources, reward.resources);
          totalExp += reward.exp;
          mergeFragments(totalFragments, reward.fragments);
          remainingTickets -= this.config.sweepCostPerRun;
          ticketsUsed += this.config.sweepCostPerRun;
          this.progress.victories++;
        } else {
          // 扫荡令不足，尝试模拟战斗
          const battleExp = this.simulateAndRecord(
            currentStageId, results, totalResources, totalFragments,
          );
          if (battleExp === null) {
            this.progress.defeats++;
            break;
          }
          totalExp += battleExp;
          this.progress.victories++;
        }
      } else {
        // 未三星 → 模拟战斗
        const battleExp = this.simulateAndRecord(
          currentStageId, results, totalResources, totalFragments,
        );
        if (battleExp === null) {
          this.progress.defeats++;
          break;
        }
        totalExp += battleExp;
        this.progress.victories++;
      }

      // 检查是否达到最大尝试次数（在推进前检查）
      if (i + 1 >= this.config.autoPushMaxAttempts) {
        reachedMaxAttempts = true;
        break;
      }

      // 尝试推进到下一关
      const nextStageId = this.getNextStage(currentStageId);
      if (!nextStageId) {
        break;
      }
      currentStageId = nextStageId;
    }

    this.progress.isRunning = false;

    return {
      result: {
        reachedMaxAttempts,
        startStageId,
        endStageId: currentStageId,
        totalAttempts: this.progress.attempts,
        victories: this.progress.victories,
        defeats: this.progress.defeats,
        results,
        totalResources,
        totalExp,
        totalFragments,
        ticketsUsed,
      },
      ticketsUsed,
    };
  }

  // ─────────────────────────────────────────────
  // 内部方法
  // ─────────────────────────────────────────────

  /**
   * 模拟战斗并记录结果
   *
   * @returns 战斗经验的奖励（null 表示战斗失败）
   */
  private simulateAndRecord(
    stageId: string,
    results: SweepResult[],
    totalResources: Partial<Record<string, number>>,
    totalFragments: Record<string, number>,
  ): number | null {
    const battleResult = this.sweepDeps.simulateBattle(stageId);
    const { victory, stars } = battleResult;

    if (victory) {
      this.sweepDeps.completeStage(stageId, stars);
      const reward = this.rewardDistributor.calculateRewards(stageId, stars, false);
      results.push({ stageId, stars, reward });
      mergeResources(totalResources, reward.resources);
      mergeFragments(totalFragments, reward.fragments);
      return reward.exp;
    }

    return null;
  }

  /**
   * 获取下一关卡ID
   */
  private getNextStage(currentStageId: string): string | null {
    const stage = this.dataProvider.getStage(currentStageId);
    if (!stage) return null;

    // 同章节下一关
    const stages = this.dataProvider.getStagesByChapter(stage.chapterId);
    const nextInChapter = stages.find((s) => s.order === stage.order + 1);
    if (nextInChapter) return nextInChapter.id;

    // 下一章第一关
    const chapter = this.dataProvider.getChapter(stage.chapterId);
    if (!chapter) return null;

    const allChapters = this.dataProvider.getChapters();
    const nextChapter = allChapters.find(
      (ch) => ch.prerequisiteChapterId === chapter.id,
    );
    if (nextChapter && nextChapter.stages.length > 0) {
      return nextChapter.stages[0].id;
    }

    return null;
  }

  /**
   * 创建空结果
   */
  private emptyResult(startStageId: string): AutoPushResult {
    return {
      reachedMaxAttempts: false,
      startStageId,
      endStageId: startStageId,
      totalAttempts: 0,
      victories: 0,
      defeats: 0,
      results: [],
      totalResources: {},
      totalExp: 0,
      totalFragments: {},
      ticketsUsed: 0,
    };
  }
}
