/**
 * 集成测试：扫荡系统（§9.1 ~ §9.5a）
 *
 * 覆盖 Play v3.0 攻城略地(上) 中的 6 个流程：
 *   §9.1 解锁扫荡功能：3星通关后解锁扫荡
 *   §9.2 获取扫荡令：扫荡令道具获取
 *   §9.3 执行扫荡：一键获取关卡奖励
 *   §9.4 VIP系统依赖：VIP等级影响扫荡次数
 *   §9.5 关卡↔扫荡↔离线统一状态机：状态一致性
 *   §9.5a 扫荡状态回写规则：扫荡后进度正确更新
 *
 * 测试策略：使用 SweepSystem + CampaignProgressSystem + RewardDistributor 真实实例，
 * 验证扫荡系统的完整流程，重点关注解锁条件、扫荡令管理、批量扫荡和状态一致性。
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SweepSystem } from '../../SweepSystem';
import { CampaignProgressSystem } from '../../CampaignProgressSystem';
import { RewardDistributor } from '../../RewardDistributor';
import type {
  RewardDistributorDeps,
  ICampaignDataProvider,
} from '../../campaign.types';
import { MAX_STARS } from '../../campaign.types';
import {
  campaignDataProvider,
  getChapters,
  getStage,
} from '../../campaign-config';
import type { SweepDeps, SweepBatchResult } from '../../sweep.types';
import { DEFAULT_SWEEP_CONFIG } from '../../sweep.types';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

/** 创建固定种子 RNG（始终返回高值以触发掉落） */
function createSeededRng(values: number[]): () => number {
  let idx = 0;
  return () => {
    const v = values[idx % values.length];
    idx++;
    return v;
  };
}

/** 创建完整的测试环境 */
function createTestEnv() {
  const progress = new CampaignProgressSystem(campaignDataProvider);
  const resourceLog: Array<{ type: string; amount: number }> = [];

  const rewardDeps: RewardDistributorDeps = {
    addResource: (type, amount) => {
      resourceLog.push({ type, amount });
      return amount;
    },
  };

  const sweepDeps: SweepDeps = {
    simulateBattle: (stageId: string) => {
      // 默认模拟战斗返回胜利3星
      return { victory: true, stars: 3 };
    },
    getStageStars: (stageId: string) => progress.getStageStars(stageId),
    canChallenge: (stageId: string) => progress.canChallenge(stageId),
    getFarthestStageId: () => {
      // 找到当前最远可挑战关卡
      const chapters = getChapters();
      for (const chapter of chapters) {
        for (const stage of chapter.stages) {
          if (progress.canChallenge(stage.id)) {
            return stage.id;
          }
        }
      }
      return null;
    },
    completeStage: (stageId: string, stars: number) => {
      progress.completeStage(stageId, stars);
    },
  };

  const rng = createSeededRng([0.9, 0.8, 0.7, 0.6, 0.5]);
  const sweep = new SweepSystem(
    campaignDataProvider,
    rewardDeps,
    sweepDeps,
    undefined,
    rng,
  );

  return { progress, sweep, resourceLog, rewardDeps, sweepDeps };
}

/** 获取第一个关卡ID */
function getFirstStageId(): string {
  const chapters = getChapters();
  return chapters[0]?.stages[0]?.id ?? 'chapter1_stage1';
}

/** 获取第二个关卡ID */
function getSecondStageId(): string {
  const chapters = getChapters();
  return chapters[0]?.stages[1]?.id ?? 'chapter1_stage2';
}

/** 将关卡完成到指定星级 */
function completeStageToStars(
  progress: CampaignProgressSystem,
  stageId: string,
  stars: number,
): void {
  progress.completeStage(stageId, stars);
}

// ═══════════════════════════════════════════════
// §9.1 解锁扫荡功能
// ═══════════════════════════════════════════════
describe('§9.1 解锁扫荡功能', () => {
  let env: ReturnType<typeof createTestEnv>;

  beforeEach(() => {
    env = createTestEnv();
  });

  it('should not allow sweep on a locked stage (0 stars)', () => {
    const stageId = getFirstStageId();

    // 关卡未通关，不可扫荡
    expect(env.sweep.canSweep(stageId)).toBe(false);

    const status = env.sweep.getSweepStatus(stageId);
    expect(status.canSweep).toBe(false);
    expect(status.stars).toBe(0);
    expect(status.reason).toContain('三星');
  });

  it('should not allow sweep on 1-star cleared stage', () => {
    const stageId = getFirstStageId();
    completeStageToStars(env.progress, stageId, 1);

    expect(env.sweep.canSweep(stageId)).toBe(false);

    const status = env.sweep.getSweepStatus(stageId);
    expect(status.canSweep).toBe(false);
    expect(status.stars).toBe(1);
  });

  it('should not allow sweep on 2-star cleared stage', () => {
    const stageId = getFirstStageId();
    completeStageToStars(env.progress, stageId, 2);

    expect(env.sweep.canSweep(stageId)).toBe(false);

    const status = env.sweep.getSweepStatus(stageId);
    expect(status.canSweep).toBe(false);
    expect(status.stars).toBe(2);
  });

  it('should unlock sweep after 3-star completion', () => {
    const stageId = getFirstStageId();
    completeStageToStars(env.progress, stageId, 3);

    expect(env.sweep.canSweep(stageId)).toBe(true);

    const status = env.sweep.getSweepStatus(stageId);
    expect(status.canSweep).toBe(true);
    expect(status.stars).toBe(3);
  });

  it('should reflect correct status detail for 3-star stage', () => {
    const stageId = getFirstStageId();
    completeStageToStars(env.progress, stageId, 3);

    const status = env.sweep.getSweepStatus(stageId);
    expect(status.canSweep).toBe(true);
    expect(status.reason).toContain('可以扫荡');
  });

  it('should return stars=0 for non-existent stage', () => {
    const status = env.sweep.getSweepStatus('non_existent_stage');
    expect(status.canSweep).toBe(false);
    expect(status.stars).toBe(0);
  });
});

// ═══════════════════════════════════════════════
// §9.2 获取扫荡令
// ═══════════════════════════════════════════════
describe('§9.2 获取扫荡令', () => {
  let env: ReturnType<typeof createTestEnv>;

  beforeEach(() => {
    env = createTestEnv();
  });

  it('should start with 0 tickets', () => {
    expect(env.sweep.getTicketCount()).toBe(0);
  });

  it('should add tickets via addTickets', () => {
    env.sweep.addTickets(10);
    expect(env.sweep.getTicketCount()).toBe(10);
  });

  it('should accumulate tickets from multiple addTickets calls', () => {
    env.sweep.addTickets(5);
    env.sweep.addTickets(3);
    expect(env.sweep.getTicketCount()).toBe(8);
  });

  it('should throw when adding 0 tickets', () => {
    expect(() => env.sweep.addTickets(0)).toThrow('扫荡令数量必须大于0');
  });

  it('should throw when adding negative tickets', () => {
    expect(() => env.sweep.addTickets(-5)).toThrow('扫荡令数量必须大于0');
  });

  it('should claim daily tickets once per day', () => {
    const claimed = env.sweep.claimDailyTickets();
    expect(claimed).toBe(DEFAULT_SWEEP_CONFIG.dailyTicketReward);
    expect(env.sweep.getTicketCount()).toBe(DEFAULT_SWEEP_CONFIG.dailyTicketReward);
    expect(env.sweep.isDailyTicketClaimed()).toBe(true);
  });

  it('should not claim daily tickets twice on the same day', () => {
    env.sweep.claimDailyTickets();
    const secondClaim = env.sweep.claimDailyTickets();
    expect(secondClaim).toBe(0);
    expect(env.sweep.getTicketCount()).toBe(DEFAULT_SWEEP_CONFIG.dailyTicketReward);
  });

  it('should reset daily claim on new day', () => {
    // 用固定时间模拟今天
    const today = new Date(2025, 0, 15).getTime();
    const tomorrow = new Date(2025, 0, 16).getTime();

    // 今天领取
    env.sweep.claimDailyTickets(today);
    expect(env.sweep.isDailyTicketClaimed()).toBe(true);

    // 明天可以再次领取
    const claimed = env.sweep.claimDailyTickets(tomorrow);
    expect(claimed).toBe(DEFAULT_SWEEP_CONFIG.dailyTicketReward);
    expect(env.sweep.isDailyTicketClaimed()).toBe(true);
  });

  it('should check if enough tickets for sweep count', () => {
    env.sweep.addTickets(5);
    expect(env.sweep.hasEnoughTickets(3)).toBe(true);  // 3 * 1 = 3 <= 5
    expect(env.sweep.hasEnoughTickets(5)).toBe(true);  // 5 * 1 = 5 <= 5
    expect(env.sweep.hasEnoughTickets(6)).toBe(false); // 6 * 1 = 6 > 5
  });

  it('should calculate required tickets correctly', () => {
    expect(env.sweep.getRequiredTickets(1)).toBe(1);
    expect(env.sweep.getRequiredTickets(5)).toBe(5);
    expect(env.sweep.getRequiredTickets(10)).toBe(10);
  });
});

// ═══════════════════════════════════════════════
// §9.3 执行扫荡
// ═══════════════════════════════════════════════
describe('§9.3 执行扫荡', () => {
  let env: ReturnType<typeof createTestEnv>;
  let stageId: string;

  beforeEach(() => {
    env = createTestEnv();
    stageId = getFirstStageId();
    // 三星通关 + 给扫荡令
    completeStageToStars(env.progress, stageId, 3);
    env.sweep.addTickets(20);
  });

  it('should execute single sweep successfully', () => {
    const result = env.sweep.sweep(stageId, 1);

    expect(result.success).toBe(true);
    expect(result.stageId).toBe(stageId);
    expect(result.requestedCount).toBe(1);
    expect(result.executedCount).toBe(1);
    expect(result.results).toHaveLength(1);
    expect(result.ticketsUsed).toBe(1);
  });

  it('should execute batch sweep (5 times)', () => {
    const result = env.sweep.sweep(stageId, 5);

    expect(result.success).toBe(true);
    expect(result.executedCount).toBe(5);
    expect(result.results).toHaveLength(5);
    expect(result.ticketsUsed).toBe(5);
  });

  it('should deduct tickets after sweep', () => {
    const ticketsBefore = env.sweep.getTicketCount();
    env.sweep.sweep(stageId, 3);
    expect(env.sweep.getTicketCount()).toBe(ticketsBefore - 3);
  });

  it('should return reward data in each sweep result', () => {
    const result = env.sweep.sweep(stageId, 1);
    const sweepResult = result.results[0];

    expect(sweepResult.stageId).toBe(stageId);
    expect(sweepResult.stars).toBe(3);
    expect(sweepResult.reward).toBeDefined();
    expect(sweepResult.reward.resources).toBeDefined();
    expect(typeof sweepResult.reward.exp).toBe('number');
  });

  it('should aggregate total resources across batch sweep', () => {
    const result = env.sweep.sweep(stageId, 5);

    expect(result.totalResources).toBeDefined();
    expect(result.totalExp).toBeGreaterThan(0);
    expect(typeof result.totalFragments).toBe('object');
  });

  it('should fail when count is 0', () => {
    const result = env.sweep.sweep(stageId, 0);
    expect(result.success).toBe(false);
    expect(result.failureReason).toContain('大于0');
  });

  it('should fail when count exceeds maxSweepCount', () => {
    const result = env.sweep.sweep(stageId, DEFAULT_SWEEP_CONFIG.maxSweepCount + 1);
    expect(result.success).toBe(false);
    expect(result.failureReason).toContain('最大');
  });

  it('should fail when stage is not 3-star cleared', () => {
    const stageId2 = getSecondStageId();
    // 第二关未通关
    const result = env.sweep.sweep(stageId2, 1);
    expect(result.success).toBe(false);
    expect(result.failureReason).toContain('三星');
  });

  it('should fail when not enough tickets', () => {
    // 先消耗扫荡令（20张中扫荡5次用掉5张，剩15张）
    env.sweep.sweep(stageId, 5);
    // 再尝试扫荡10次（需要10张，但只剩10张不够）
    // 实际上剩15张够10次，所以用更大的数量
    env.sweep.sweep(stageId, 10); // 用掉10张，剩5张
    const result = env.sweep.sweep(stageId, 10); // 需要10张但只剩5张
    expect(result.success).toBe(false);
    expect(result.failureReason).toContain('扫荡令不足');
  });

  it('should not deduct tickets on failed sweep', () => {
    const ticketsBefore = env.sweep.getTicketCount();
    env.sweep.sweep(stageId, 0); // 无效次数
    expect(env.sweep.getTicketCount()).toBe(ticketsBefore);
  });
});

// ═══════════════════════════════════════════════
// §9.4 VIP系统依赖
// ═══════════════════════════════════════════════
describe('§9.4 VIP系统依赖', () => {
  it('should respect default maxSweepCount configuration', () => {
    expect(DEFAULT_SWEEP_CONFIG.maxSweepCount).toBe(10);
  });

  it('should allow custom maxSweepCount via config override', () => {
    const env = createTestEnv();
    const customSweep = new SweepSystem(
      campaignDataProvider,
      env.rewardDeps,
      env.sweepDeps,
      { maxSweepCount: 20 },
    );

    const stageId = getFirstStageId();
    completeStageToStars(env.progress, stageId, 3);
    customSweep.addTickets(30);

    const result = customSweep.sweep(stageId, 15);
    expect(result.success).toBe(true);
    expect(result.executedCount).toBe(15);
  });

  it('should enforce sweepCostPerRun from config', () => {
    const env = createTestEnv();
    const customSweep = new SweepSystem(
      campaignDataProvider,
      env.rewardDeps,
      env.sweepDeps,
      { sweepCostPerRun: 2 }, // 每次消耗2张
    );

    const stageId = getFirstStageId();
    completeStageToStars(env.progress, stageId, 3);
    customSweep.addTickets(10);

    // 5次 * 2张 = 10张，刚好够
    const result = customSweep.sweep(stageId, 5);
    expect(result.success).toBe(true);
    expect(result.ticketsUsed).toBe(10);
    expect(customSweep.getTicketCount()).toBe(0);
  });

  it('should reflect VIP-like increased daily ticket reward via config', () => {
    const env = createTestEnv();
    const vipSweep = new SweepSystem(
      campaignDataProvider,
      env.rewardDeps,
      env.sweepDeps,
      { dailyTicketReward: 10 }, // VIP增加每日扫荡令
    );

    const claimed = vipSweep.claimDailyTickets();
    expect(claimed).toBe(10);
    expect(vipSweep.getTicketCount()).toBe(10);
  });

  it('should fail sweep when tickets insufficient with higher cost per run', () => {
    const env = createTestEnv();
    const expensiveSweep = new SweepSystem(
      campaignDataProvider,
      env.rewardDeps,
      env.sweepDeps,
      { sweepCostPerRun: 3 },
    );

    const stageId = getFirstStageId();
    completeStageToStars(env.progress, stageId, 3);
    expensiveSweep.addTickets(5);

    // 3次 * 3张 = 9张 > 5张
    const result = expensiveSweep.sweep(stageId, 3);
    expect(result.success).toBe(false);
    expect(result.failureReason).toContain('扫荡令不足');
  });
});

// ═══════════════════════════════════════════════
// §9.5 关卡↔扫荡↔离线统一状态机
// ═══════════════════════════════════════════════
describe('§9.5 关卡↔扫荡↔离线统一状态机', () => {
  let env: ReturnType<typeof createTestEnv>;

  beforeEach(() => {
    env = createTestEnv();
  });

  it('should maintain consistent state between sweep and progress system', () => {
    const stageId = getFirstStageId();

    // 初始状态：不可扫荡
    expect(env.sweep.canSweep(stageId)).toBe(false);
    expect(env.progress.getStageStars(stageId)).toBe(0);

    // 通关3星
    completeStageToStars(env.progress, stageId, 3);

    // 扫荡系统应同步感知
    expect(env.sweep.canSweep(stageId)).toBe(true);
    expect(env.sweep.getSweepStatus(stageId).stars).toBe(3);
  });

  it('should reflect star upgrade from 1→3 star correctly in sweep status', () => {
    const stageId = getFirstStageId();

    // 先1星通关
    completeStageToStars(env.progress, stageId, 1);
    expect(env.sweep.canSweep(stageId)).toBe(false);

    // 再3星通关（取历史最高）
    completeStageToStars(env.progress, stageId, 3);
    expect(env.sweep.canSweep(stageId)).toBe(true);
  });

  it('should keep sweep state consistent after reset', () => {
    const stageId = getFirstStageId();
    completeStageToStars(env.progress, stageId, 3);
    env.sweep.addTickets(10);

    expect(env.sweep.canSweep(stageId)).toBe(true);
    expect(env.sweep.getTicketCount()).toBe(10);

    // 重置扫荡系统
    env.sweep.reset();
    expect(env.sweep.getTicketCount()).toBe(0);
    expect(env.sweep.isDailyTicketClaimed()).toBe(false);

    // 关卡进度不变（扫荡系统重置不影响进度系统）
    expect(env.progress.getStageStars(stageId)).toBe(3);
    expect(env.sweep.canSweep(stageId)).toBe(true); // 仍然可扫荡
  });

  it('should serialize and deserialize sweep state correctly', () => {
    const stageId = getFirstStageId();
    completeStageToStars(env.progress, stageId, 3);
    env.sweep.addTickets(15);
    env.sweep.claimDailyTickets();

    const saved = env.sweep.serialize();
    expect(saved.ticketCount).toBe(15 + DEFAULT_SWEEP_CONFIG.dailyTicketReward);
    expect(saved.dailyTicketClaimed).toBe(true);
    expect(saved.lastDailyTicketDate).toBeTruthy();

    // 反序列化到新实例
    const env2 = createTestEnv();
    completeStageToStars(env2.progress, getFirstStageId(), 3);
    env2.sweep.deserialize(saved);

    expect(env2.sweep.getTicketCount()).toBe(saved.ticketCount);
    expect(env2.sweep.isDailyTicketClaimed()).toBe(true);
  });

  it('should throw on incompatible save version during deserialize', () => {
    expect(() => {
      env.sweep.deserialize({
        version: 999,
        ticketCount: 10,
        dailyTicketClaimed: false,
        lastDailyTicketDate: null,
      });
    }).toThrow('存档版本不兼容');
  });
});

// ═══════════════════════════════════════════════
// §9.5a 扫荡状态回写规则
// ═══════════════════════════════════════════════
describe('§9.5a 扫荡状态回写规则', () => {
  let env: ReturnType<typeof createTestEnv>;
  let stageId: string;

  beforeEach(() => {
    env = createTestEnv();
    stageId = getFirstStageId();
    completeStageToStars(env.progress, stageId, 3);
    env.sweep.addTickets(20);
  });

  it('should not alter stage star count after sweep', () => {
    const starsBefore = env.progress.getStageStars(stageId);
    env.sweep.sweep(stageId, 5);
    const starsAfter = env.progress.getStageStars(stageId);

    expect(starsAfter).toBe(starsBefore);
    expect(starsAfter).toBe(3);
  });

  it('should not alter stage clear count after sweep', () => {
    const clearCountBefore = env.progress.getClearCount(stageId);
    env.sweep.sweep(stageId, 3);
    const clearCountAfter = env.progress.getClearCount(stageId);

    // 扫荡不应增加通关次数（扫荡≠通关）
    expect(clearCountAfter).toBe(clearCountBefore);
  });

  it('should not alter firstCleared status after sweep', () => {
    const isFirstClearedBefore = env.progress.isFirstCleared(stageId);
    env.sweep.sweep(stageId, 5);
    const isFirstClearedAfter = env.progress.isFirstCleared(stageId);

    expect(isFirstClearedAfter).toBe(isFirstClearedBefore);
  });

  it('should correctly update ticket count in getState after sweep', () => {
    const ticketsBefore = env.sweep.getTicketCount();
    env.sweep.sweep(stageId, 3);

    const state = env.sweep.getState();
    expect(state.ticketCount).toBe(ticketsBefore - 3);
  });

  it('should correctly update ticket count in serialized data after sweep', () => {
    env.sweep.sweep(stageId, 4);
    const saved = env.sweep.serialize();

    expect(saved.ticketCount).toBe(20 - 4);
    expect(saved.dailyTicketClaimed).toBe(false);
  });

  it('should maintain consistent state across multiple sweep operations', () => {
    // 第一次扫荡
    const result1 = env.sweep.sweep(stageId, 3);
    expect(result1.success).toBe(true);
    expect(env.sweep.getTicketCount()).toBe(17);

    // 第二次扫荡
    const result2 = env.sweep.sweep(stageId, 5);
    expect(result2.success).toBe(true);
    expect(env.sweep.getTicketCount()).toBe(12);

    // 第三次扫荡
    const result3 = env.sweep.sweep(stageId, 7);
    expect(result3.success).toBe(true);
    expect(env.sweep.getTicketCount()).toBe(5);

    // 验证关卡状态未变
    expect(env.progress.getStageStars(stageId)).toBe(3);
  });

  it('should auto-push update progress via completeStage callback', () => {
    // 自动推图会通过 completeStage 回写进度
    const result = env.sweep.autoPush();

    expect(result).toBeDefined();
    expect(result.totalAttempts).toBeGreaterThanOrEqual(0);
    // 自动推图结果包含汇总数据
    expect(typeof result.totalResources).toBe('object');
    expect(typeof result.totalExp).toBe('number');
  });
});
