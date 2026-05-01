/**
 * 战役模块对抗式测试
 *
 * 覆盖子系统：S1:CampaignProgressSystem S2:ChallengeStageSystem
 * S3:SweepSystem S4:RewardDistributor S5:CampaignSerializer S6:VIPSystem
 *
 * 5维度：F-Normal / F-Error / F-Boundary / F-Cross / F-Lifecycle
 * @module tests/adversarial/campaign-adversarial
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CampaignProgressSystem } from '../../engine/campaign/CampaignProgressSystem';
import { ChallengeStageSystem } from '../../engine/campaign/ChallengeStageSystem';
import { SweepSystem } from '../../engine/campaign/SweepSystem';
import { RewardDistributor } from '../../engine/campaign/RewardDistributor';
import { serializeProgress, deserializeProgress, SAVE_VERSION } from '../../engine/campaign/CampaignSerializer';
import { VIPSystem } from '../../engine/campaign/VIPSystem';
import { campaignDataProvider } from '../../engine/campaign/campaign-config';
import type {
  Chapter, Stage, ICampaignDataProvider, StageState, CampaignProgress,
  CampaignSaveData, RewardDistributorDeps, StageReward,
} from '../../engine/campaign/campaign.types';
import type {
  ChallengeDeps, ChallengeStageConfig, ChallengeResult,
} from '../../engine/campaign/ChallengeStageSystem';
import type { SweepDeps, SweepSaveData } from '../../engine/campaign/sweep.types';
import type { StarRating } from '../../engine/battle/battle.types';
import { MAX_STARS } from '../../engine/campaign/campaign.types';
import type { ISystemDeps } from '../../core/types/subsystem';

// ── 测试辅助 ──────────────────────────────────

const mockDeps = (): ISystemDeps => ({
  eventBus: { on: vi.fn().mockReturnValue(vi.fn()), once: vi.fn().mockReturnValue(vi.fn()), emit: vi.fn(), off: vi.fn(), removeAllListeners: vi.fn() },
  config: { get: vi.fn(), set: vi.fn() },
  registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(), has: vi.fn(), unregister: vi.fn() },
} as unknown as ISystemDeps);

/** 构造假数据提供者，可自定义章节/关卡 */
function fakeDataProvider(chapters: Chapter[]): ICampaignDataProvider {
  const stageMap = new Map<string, Stage>();
  for (const ch of chapters) for (const st of ch.stages) stageMap.set(st.id, st);
  return {
    getChapters: () => chapters,
    getChapter: (id: string) => chapters.find(c => c.id === id),
    getStage: (id: string) => stageMap.get(id),
    getStagesByChapter: (chId: string) => chapters.find(c => c.id === chId)?.stages ?? [],
  };
}

/** 创建一个最小关卡 */
function mkStage(id: string, chapterId: string, order: number, overrides: Partial<Stage> = {}): Stage {
  return {
    id, name: `关卡${order}`, type: order % 3 === 0 ? 'boss' : 'normal',
    chapterId, order,
    enemyFormation: { id: `ef_${id}`, name: '敌军', units: [], recommendedPower: 100 },
    baseRewards: { grain: 100, gold: 50 }, baseExp: 200,
    firstClearRewards: { grain: 300 }, firstClearExp: 100,
    threeStarBonusMultiplier: 2.0,
    dropTable: [
      { type: 'resource', resourceType: 'grain', minAmount: 10, maxAmount: 50, probability: 0.8 },
      { type: 'fragment', generalId: 'hero_zhaoyun', minAmount: 1, maxAmount: 3, probability: 0.5 },
    ],
    recommendedPower: 100, description: '测试关卡',
    ...overrides,
  };
}

/** 创建一个最小章节 */
function mkChapter(id: string, order: number, stageCount: number, prereq: string | null = null): Chapter {
  const stages = Array.from({ length: stageCount }, (_, i) => mkStage(`${id}_stage${i + 1}`, id, i + 1));
  return {
    id, name: `第${order}章`, subtitle: '', order, stages,
    prerequisiteChapterId: prereq, description: '测试章节',
  };
}

/** 创建3章×3关的测试数据 */
function stdChapters(): Chapter[] {
  return [
    mkChapter('chapter1', 1, 3, null),
    mkChapter('chapter2', 2, 3, 'chapter1'),
    mkChapter('chapter3', 3, 3, 'chapter2'),
  ];
}

/** 奖励分发回调 mock */
function mockRewardDeps(): RewardDistributorDeps & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    addResource: vi.fn((type, amount) => { calls.push(`res:${type}:${amount}`); return amount; }),
    addFragment: vi.fn((id, count) => { calls.push(`frag:${id}:${count}`); }),
    addExp: vi.fn((exp) => { calls.push(`exp:${exp}`); }),
  };
}

/** 挑战系统依赖 mock */
function mockChallengeDeps(): ChallengeDeps {
  const resources: Record<string, number> = { troops: 10000, mandate: 500 };
  return {
    getResourceAmount: vi.fn((type: string) => resources[type] ?? 0),
    consumeResource: vi.fn((type: string, amount: number) => {
      if ((resources[type] ?? 0) >= amount) { resources[type] -= amount; return true; }
      return false;
    }),
    addResource: vi.fn((type: string, amount: number) => { resources[type] = (resources[type] ?? 0) + amount; }),
    addFragment: vi.fn(),
    addExp: vi.fn(),
  };
}

/** 扫荡系统依赖 mock */
function mockSweepDeps(): SweepDeps {
  return {
    simulateBattle: vi.fn(() => ({ victory: true, stars: 3 })),
    getStageStars: vi.fn(() => 3),
    canChallenge: vi.fn(() => true),
    getFarthestStageId: vi.fn(() => 'chapter1_stage3'),
    completeStage: vi.fn(),
  };
}

// ════════════════════════════════════════════════
// F-Normal: 正常流程
// ════════════════════════════════════════════════

describe('F-Normal · 战役初始化', () => {
  it('初始化后第1章第1关为 available，其余 locked', () => {
    const dp = fakeDataProvider(stdChapters());
    const sys = new CampaignProgressSystem(dp);
    sys.initProgress();

    expect(sys.getStageStatus('chapter1_stage1')).toBe('available');
    expect(sys.getStageStatus('chapter1_stage2')).toBe('locked');
    expect(sys.getStageStatus('chapter2_stage1')).toBe('locked');
  });

  it('初始进度 totalStars 为 0', () => {
    const sys = new CampaignProgressSystem(fakeDataProvider(stdChapters()));
    sys.initProgress();
    expect(sys.getTotalStars()).toBe(0);
  });

  it('初始 currentChapterId 为第1章', () => {
    const sys = new CampaignProgressSystem(fakeDataProvider(stdChapters()));
    sys.initProgress();
    expect(sys.getProgress().currentChapterId).toBe('chapter1');
  });

  it('使用真实 campaignDataProvider 初始化不报错', () => {
    const sys = new CampaignProgressSystem(campaignDataProvider);
    sys.initProgress();
    expect(sys.getProgress().currentChapterId).toBe('chapter1');
  });
});

describe('F-Normal · 章节解锁', () => {
  it('通关第1章全部关卡后第2章第1关变为 available', () => {
    const dp = fakeDataProvider(stdChapters());
    const sys = new CampaignProgressSystem(dp);
    sys.initProgress();

    sys.completeStage('chapter1_stage1', 2);
    sys.completeStage('chapter1_stage2', 2);
    sys.completeStage('chapter1_stage3', 2);

    expect(sys.getStageStatus('chapter2_stage1')).toBe('available');
  });

  it('currentChapterId 在通关整章后推进', () => {
    const dp = fakeDataProvider(stdChapters());
    const sys = new CampaignProgressSystem(dp);
    sys.initProgress();

    sys.completeStage('chapter1_stage1', 3);
    sys.completeStage('chapter1_stage2', 3);
    sys.completeStage('chapter1_stage3', 3);

    expect(sys.getProgress().currentChapterId).toBe('chapter2');
  });
});

describe('F-Normal · 关卡挑战', () => {
  it('canChallenge 对 available 关卡返回 true', () => {
    const sys = new CampaignProgressSystem(fakeDataProvider(stdChapters()));
    sys.initProgress();
    expect(sys.canChallenge('chapter1_stage1')).toBe(true);
  });

  it('canChallenge 对 locked 关卡返回 false', () => {
    const sys = new CampaignProgressSystem(fakeDataProvider(stdChapters()));
    sys.initProgress();
    expect(sys.canChallenge('chapter1_stage2')).toBe(false);
  });

  it('通关后可重复挑战', () => {
    const sys = new CampaignProgressSystem(fakeDataProvider(stdChapters()));
    sys.initProgress();
    sys.completeStage('chapter1_stage1', 2);
    expect(sys.canChallenge('chapter1_stage1')).toBe(true);
  });
});

describe('F-Normal · 星级评定', () => {
  it('completeStage 记录星级', () => {
    const sys = new CampaignProgressSystem(fakeDataProvider(stdChapters()));
    sys.initProgress();
    sys.completeStage('chapter1_stage1', 3);
    expect(sys.getStageStars('chapter1_stage1')).toBe(3);
  });

  it('星级取历史最高', () => {
    const sys = new CampaignProgressSystem(fakeDataProvider(stdChapters()));
    sys.initProgress();
    sys.completeStage('chapter1_stage1', 1);
    sys.completeStage('chapter1_stage1', 2);
    expect(sys.getStageStars('chapter1_stage1')).toBe(2);

    sys.completeStage('chapter1_stage1', 1);
    expect(sys.getStageStars('chapter1_stage1')).toBe(2); // 不降级
  });

  it('三星通关状态为 threeStar', () => {
    const sys = new CampaignProgressSystem(fakeDataProvider(stdChapters()));
    sys.initProgress();
    sys.completeStage('chapter1_stage1', 3);
    expect(sys.getStageStatus('chapter1_stage1')).toBe('threeStar');
  });

  it('1-2星通关状态为 cleared', () => {
    const sys = new CampaignProgressSystem(fakeDataProvider(stdChapters()));
    sys.initProgress();
    sys.completeStage('chapter1_stage1', 1);
    expect(sys.getStageStatus('chapter1_stage1')).toBe('cleared');
  });
});

describe('F-Normal · 扫荡', () => {
  it('三星通关后可扫荡', () => {
    const dp = fakeDataProvider(stdChapters());
    const rewardDeps = mockRewardDeps();
    const sweepDeps = mockSweepDeps();
    const sweep = new SweepSystem(dp, rewardDeps, sweepDeps);
    sweep.addTickets(10);

    const result = sweep.sweep('chapter1_stage1', 3);
    expect(result.success).toBe(true);
    expect(result.executedCount).toBe(3);
    expect(result.ticketsUsed).toBe(3);
  });

  it('未三星通关不可扫荡', () => {
    const dp = fakeDataProvider(stdChapters());
    const rewardDeps = mockRewardDeps();
    const sweepDeps: SweepDeps = {
      ...mockSweepDeps(),
      getStageStars: vi.fn(() => 2),
    };
    const sweep = new SweepSystem(dp, rewardDeps, sweepDeps);
    sweep.addTickets(10);

    const result = sweep.sweep('chapter1_stage1', 1);
    expect(result.success).toBe(false);
    expect(result.failureReason).toContain('三星');
  });

  it('领取每日扫荡令', () => {
    const sweep = new SweepSystem(
      fakeDataProvider(stdChapters()), mockRewardDeps(), mockSweepDeps(),
    );
    const amount = sweep.claimDailyTickets();
    expect(amount).toBeGreaterThan(0);
    expect(sweep.getTicketCount()).toBe(amount);
  });
});

describe('F-Normal · 首通奖励', () => {
  it('首通标记 firstCleared 为 true', () => {
    const sys = new CampaignProgressSystem(fakeDataProvider(stdChapters()));
    sys.initProgress();
    expect(sys.isFirstCleared('chapter1_stage1')).toBe(false);
    sys.completeStage('chapter1_stage1', 2);
    expect(sys.isFirstCleared('chapter1_stage1')).toBe(true);
  });

  it('RewardDistributor 首通时碎片必掉', () => {
    const dp = fakeDataProvider(stdChapters());
    const rewardDeps = mockRewardDeps();
    const dist = new RewardDistributor(dp, rewardDeps, () => 0.99); // 高随机值，概率掉落应全部miss

    const reward = dist.calculateRewards('chapter1_stage1', 3, true);
    // 首通碎片必掉（即使rng=0.99 > probability=0.5）
    expect(reward.fragments['hero_zhaoyun']).toBeGreaterThanOrEqual(1);
  });

  it('非首通时碎片按概率掉落（rng=0.99 全部 miss）', () => {
    const dp = fakeDataProvider(stdChapters());
    const rewardDeps = mockRewardDeps();
    const dist = new RewardDistributor(dp, rewardDeps, () => 0.99);

    const reward = dist.calculateRewards('chapter1_stage1', 3, false);
    expect(Object.keys(reward.fragments)).toHaveLength(0);
  });
});

describe('F-Normal · 前置条件', () => {
  it('跳关挑战被拒绝', () => {
    const sys = new CampaignProgressSystem(fakeDataProvider(stdChapters()));
    sys.initProgress();
    expect(sys.canChallenge('chapter1_stage3')).toBe(false);
  });

  it('按顺序通关后可挑战后续关卡', () => {
    const sys = new CampaignProgressSystem(fakeDataProvider(stdChapters()));
    sys.initProgress();
    sys.completeStage('chapter1_stage1', 2);
    expect(sys.canChallenge('chapter1_stage2')).toBe(true);
    expect(sys.canChallenge('chapter1_stage3')).toBe(false);
  });
});

// ════════════════════════════════════════════════
// F-Error: 错误路径
// ════════════════════════════════════════════════

describe('F-Error · 无效关卡ID', () => {
  it('completeStage 对不存在的关卡抛出异常', () => {
    const sys = new CampaignProgressSystem(fakeDataProvider(stdChapters()));
    sys.initProgress();
    expect(() => sys.completeStage('nonexistent_stage', 3)).toThrow('关卡不存在');
  });

  it('getStageStatus 对不存在关卡返回 locked', () => {
    const sys = new CampaignProgressSystem(fakeDataProvider(stdChapters()));
    sys.initProgress();
    expect(sys.getStageStatus('nonexistent')).toBe('locked');
  });

  it('getStageStars 对不存在关卡返回 0', () => {
    const sys = new CampaignProgressSystem(fakeDataProvider(stdChapters()));
    expect(sys.getStageStars('nonexistent')).toBe(0);
  });

  it('RewardDistributor 对不存在的关卡抛出异常', () => {
    const dist = new RewardDistributor(fakeDataProvider(stdChapters()), mockRewardDeps());
    expect(() => dist.calculateRewards('no_such_stage', 3, false)).toThrow('关卡不存在');
  });
});

describe('F-Error · 挑战系统错误路径', () => {
  it('checkCanChallenge 对不存在关卡返回失败', () => {
    const challenge = new ChallengeStageSystem(mockChallengeDeps());
    const result = challenge.checkCanChallenge('nonexistent');
    expect(result.canChallenge).toBe(false);
    expect(result.reasons).toContain('关卡不存在');
  });

  it('completeChallenge 未预锁资源返回空结果', () => {
    const challenge = new ChallengeStageSystem(mockChallengeDeps());
    const result = challenge.completeChallenge('challenge_1', true);
    expect(result.victory).toBe(false);
    expect(result.rewards).toHaveLength(0);
  });
});

describe('F-Error · 扫荡系统错误路径', () => {
  it('扫荡次数为 0 返回失败', () => {
    const sweep = new SweepSystem(
      fakeDataProvider(stdChapters()), mockRewardDeps(), mockSweepDeps(),
    );
    sweep.addTickets(10);
    const result = sweep.sweep('chapter1_stage1', 0);
    expect(result.success).toBe(false);
    expect(result.failureReason).toContain('大于0');
  });

  it('扫荡令不足返回失败', () => {
    const sweep = new SweepSystem(
      fakeDataProvider(stdChapters()), mockRewardDeps(), mockSweepDeps(),
    );
    const result = sweep.sweep('chapter1_stage1', 1);
    expect(result.success).toBe(false);
    expect(result.failureReason).toContain('扫荡令不足');
  });

  it('addTickets 传入负数或 0 抛出异常', () => {
    const sweep = new SweepSystem(
      fakeDataProvider(stdChapters()), mockRewardDeps(), mockSweepDeps(),
    );
    expect(() => sweep.addTickets(-1)).toThrow();
    expect(() => sweep.addTickets(0)).toThrow();
  });
});

// ════════════════════════════════════════════════
// F-Boundary: 边界条件
// ════════════════════════════════════════════════

describe('F-Boundary · 空章节', () => {
  it('空数据提供者不崩溃', () => {
    const dp = fakeDataProvider([]);
    const sys = new CampaignProgressSystem(dp);
    sys.initProgress();
    expect(sys.getProgress().currentChapterId).toBe('');
    expect(sys.getTotalStars()).toBe(0);
  });

  it('空章节不崩溃（章节有0个关卡）', () => {
    const chapters = [mkChapter('chapter1', 1, 0)];
    const dp = fakeDataProvider(chapters);
    const sys = new CampaignProgressSystem(dp);
    sys.initProgress();
    expect(sys.getProgress().currentChapterId).toBe('chapter1');
  });
});

describe('F-Boundary · NaN 输入', () => {
  it('completeStage 传入 NaN 星级不崩溃，视为 0', () => {
    const sys = new CampaignProgressSystem(fakeDataProvider(stdChapters()));
    sys.initProgress();
    sys.completeStage('chapter1_stage1', NaN);
    expect(sys.getStageStars('chapter1_stage1')).toBe(0);
    expect(sys.isFirstCleared('chapter1_stage1')).toBe(true);
  });

  it('completeStage 传入负数星级截断为 0', () => {
    const sys = new CampaignProgressSystem(fakeDataProvider(stdChapters()));
    sys.initProgress();
    sys.completeStage('chapter1_stage1', -5);
    expect(sys.getStageStars('chapter1_stage1')).toBe(0);
  });

  it('completeStage 传入超大星级截断为 3', () => {
    const sys = new CampaignProgressSystem(fakeDataProvider(stdChapters()));
    sys.initProgress();
    sys.completeStage('chapter1_stage1', 999);
    expect(sys.getStageStars('chapter1_stage1')).toBe(3);
  });

  it('completeStage 传入小数星级向下取整', () => {
    const sys = new CampaignProgressSystem(fakeDataProvider(stdChapters()));
    sys.initProgress();
    sys.completeStage('chapter1_stage1', 2.7);
    expect(sys.getStageStars('chapter1_stage1')).toBe(2);
  });
});

describe('F-Boundary · 序列化边界', () => {
  it('版本不匹配时反序列化抛出异常', () => {
    const dp = fakeDataProvider(stdChapters());
    const badData: CampaignSaveData = { version: 999, progress: { currentChapterId: 'x', stageStates: {}, lastClearTime: 0 } };
    expect(() => deserializeProgress(badData, dp)).toThrow('版本不兼容');
  });

  it('反序列化自动补全新增关卡', () => {
    const dp = fakeDataProvider(stdChapters());
    const sys = new CampaignProgressSystem(dp);
    sys.initProgress();
    sys.completeStage('chapter1_stage1', 3);

    const saved = sys.serialize();
    // 模拟新增关卡（删除一个关卡状态）
    delete saved.progress.stageStates['chapter1_stage3'];

    const sys2 = new CampaignProgressSystem(dp);
    sys2.deserialize(saved);
    expect(sys2.getStageStars('chapter1_stage1')).toBe(3);
    expect(sys2.getStageStars('chapter1_stage3')).toBe(0);
  });
});

describe('F-Boundary · 扫荡边界', () => {
  it('超过最大扫荡次数返回失败', () => {
    const sweep = new SweepSystem(
      fakeDataProvider(stdChapters()), mockRewardDeps(), mockSweepDeps(),
      { maxSweepCount: 5 },
    );
    sweep.addTickets(100);
    const result = sweep.sweep('chapter1_stage1', 20);
    expect(result.success).toBe(false);
    expect(result.failureReason).toContain('最大');
  });

  it('每日扫荡令同一天只能领取一次', () => {
    const sweep = new SweepSystem(
      fakeDataProvider(stdChapters()), mockRewardDeps(), mockSweepDeps(),
    );
    const first = sweep.claimDailyTickets();
    const second = sweep.claimDailyTickets();
    expect(first).toBeGreaterThan(0);
    expect(second).toBe(0);
  });
});

// ════════════════════════════════════════════════
// F-Lifecycle: 序列化 / 生命周期
// ════════════════════════════════════════════════

describe('F-Lifecycle · 序列化往返', () => {
  it('CampaignProgressSystem 序列化→反序列化 数据一致', () => {
    const dp = fakeDataProvider(stdChapters());
    const sys = new CampaignProgressSystem(dp);
    sys.initProgress();
    sys.completeStage('chapter1_stage1', 3);
    sys.completeStage('chapter1_stage2', 2);

    const saved = sys.serialize();
    expect(saved.version).toBe(SAVE_VERSION);

    const sys2 = new CampaignProgressSystem(dp);
    sys2.deserialize(saved);

    expect(sys2.getStageStars('chapter1_stage1')).toBe(3);
    expect(sys2.getStageStars('chapter1_stage2')).toBe(2);
    expect(sys2.getClearCount('chapter1_stage1')).toBe(1);
    expect(sys2.isFirstCleared('chapter1_stage1')).toBe(true);
  });

  it('SweepSystem 序列化→反序列化 数据一致', () => {
    const sweep = new SweepSystem(
      fakeDataProvider(stdChapters()), mockRewardDeps(), mockSweepDeps(),
    );
    sweep.addTickets(10);
    sweep.claimDailyTickets();

    const saved = sweep.serialize();
    const sweep2 = new SweepSystem(
      fakeDataProvider(stdChapters()), mockRewardDeps(), mockSweepDeps(),
    );
    sweep2.deserialize(saved);

    expect(sweep2.getTicketCount()).toBe(saved.ticketCount);
    expect(sweep2.isDailyTicketClaimed()).toBe(saved.dailyTicketClaimed);
  });

  it('VIPSystem 序列化→反序列化 数据一致', () => {
    const vip = new VIPSystem();
    vip.addExp(500);

    const saved = vip.serialize();
    const vip2 = new VIPSystem();
    vip2.deserialize(saved);

    expect(vip2.getExp()).toBe(500);
    expect(vip2.getBaseLevel()).toBe(2);
  });

  it('ChallengeStageSystem 序列化→反序列化 数据一致', () => {
    const deps = mockChallengeDeps();
    const challenge = new ChallengeStageSystem(deps);
    // 模拟首通
    challenge.preLockResources('challenge_1');
    challenge.completeChallenge('challenge_1', true);

    const saved = challenge.serialize();
    const challenge2 = new ChallengeStageSystem(deps);
    challenge2.deserialize(saved);

    expect(challenge2.isFirstCleared('challenge_1')).toBe(true);
  });

  it('版本不匹配的 VIP 存档被忽略', () => {
    const vip = new VIPSystem();
    vip.addExp(500);
    // 强行修改版本
    const badData = { version: 999, vipExp: 500, freeSweepUsedToday: 0, lastFreeSweepResetDate: null };
    vip.deserialize(badData as any);
    // deserialize 版本不匹配时不更新
    expect(vip.getExp()).toBe(500); // 保持原值
  });
});

describe('F-Lifecycle · reset', () => {
  it('CampaignProgressSystem reset 恢复初始状态', () => {
    const sys = new CampaignProgressSystem(fakeDataProvider(stdChapters()));
    sys.initProgress();
    sys.completeStage('chapter1_stage1', 3);
    sys.reset();
    expect(sys.getTotalStars()).toBe(0);
    expect(sys.getStageStatus('chapter1_stage1')).toBe('available');
  });

  it('VIPSystem reset 清零经验', () => {
    const vip = new VIPSystem();
    vip.addExp(1000);
    vip.reset();
    expect(vip.getExp()).toBe(0);
    expect(vip.getBaseLevel()).toBe(0);
  });
});

// ════════════════════════════════════════════════
// F-Cross: 跨系统联动
// ════════════════════════════════════════════════

describe('F-Cross · 战役→战斗→资源', () => {
  it('completeStage → RewardDistributor → 资源入账', () => {
    const dp = fakeDataProvider(stdChapters());
    const rewardDeps = mockRewardDeps();
    const dist = new RewardDistributor(dp, rewardDeps, () => 0.5);

    const reward = dist.calculateAndDistribute('chapter1_stage1', 3, true);

    // 验证资源入账
    expect(rewardDeps.calls.length).toBeGreaterThan(0);
    expect(reward.isFirstClear).toBe(true);
    expect(reward.starMultiplier).toBe(2.0); // 三星倍率
    expect(reward.exp).toBeGreaterThan(0);
  });

  it('三星奖励是两星奖励的更多倍', () => {
    const dp = fakeDataProvider(stdChapters());
    const dist = new RewardDistributor(dp, mockRewardDeps(), () => 0.1);

    const r2 = dist.calculateRewards('chapter1_stage1', 2, false);
    const r3 = dist.calculateRewards('chapter1_stage1', 3, false);

    expect(r3.resources.grain!).toBeGreaterThan(r2.resources.grain!);
  });
});

describe('F-Cross · 挑战系统资源预锁→胜利→奖励', () => {
  it('完整流程：预锁→胜利→奖励入账', () => {
    const deps = mockChallengeDeps();
    const challenge = new ChallengeStageSystem(deps);
    challenge.init(mockDeps());

    const preLock = challenge.preLockResources('challenge_1');
    expect(preLock).toBe(true);

    const result = challenge.completeChallenge('challenge_1', true);
    expect(result.victory).toBe(true);
    expect(result.firstClear).toBe(true);
    expect(result.rewards.length).toBeGreaterThan(0);
  });

  it('完整流程：预锁→失败→资源返还', () => {
    const deps = mockChallengeDeps();
    const challenge = new ChallengeStageSystem(deps);
    challenge.init(mockDeps());

    const troopsBefore = deps.getResourceAmount('troops');
    challenge.preLockResources('challenge_1');
    const troopsAfterLock = deps.getResourceAmount('troops');
    expect(troopsAfterLock).toBeLessThan(troopsBefore);

    challenge.completeChallenge('challenge_1', false);
    const troopsAfterFail = deps.getResourceAmount('troops');
    expect(troopsAfterFail).toBe(troopsBefore); // 返还
  });

  it('兵力不足时 checkCanChallenge 返回失败', () => {
    const deps = mockChallengeDeps();
    // 清空兵力
    deps.consumeResource('troops', 10000);
    const challenge = new ChallengeStageSystem(deps);

    const result = challenge.checkCanChallenge('challenge_1');
    expect(result.canChallenge).toBe(false);
    expect(result.reasons.some(r => r.includes('兵力不足'))).toBe(true);
  });
});

describe('F-Cross · 战役→声望(VIP)', () => {
  it('VIP经验累积提升等级', () => {
    const vip = new VIPSystem();
    vip.addExp(100);
    expect(vip.getBaseLevel()).toBe(1);
    vip.addExp(200);
    expect(vip.getBaseLevel()).toBe(2);
  });

  it('VIP5 解锁免费扫荡特权', () => {
    const vip = new VIPSystem();
    vip.addExp(1500);
    expect(vip.getEffectiveLevel()).toBe(5);
    expect(vip.canUseFreeSweep()).toBe(true);
    expect(vip.getFreeSweepRemaining()).toBe(3);
  });

  it('VIP0 无免费扫荡', () => {
    const vip = new VIPSystem();
    expect(vip.getFreeSweepRemaining()).toBe(0);
  });

  it('VIP GM命令覆盖等级', () => {
    const vip = new VIPSystem();
    vip.gmSetLevel(5);
    expect(vip.getEffectiveLevel()).toBe(5);
    expect(vip.canUseFreeSweep()).toBe(true);
    vip.gmResetLevel();
    expect(vip.getEffectiveLevel()).toBe(0);
  });
});

describe('F-Cross · 扫荡→奖励→VIP联动', () => {
  it('VIP5 免费扫荡优先于扫荡令消耗', () => {
    const dp = fakeDataProvider(stdChapters());
    const rewardDeps = mockRewardDeps();
    const sweepDeps = mockSweepDeps();
    const vip = new VIPSystem();
    vip.addExp(1500); // VIP5

    const sweep = new SweepSystem(dp, rewardDeps, sweepDeps, undefined, undefined, vip);
    sweep.addTickets(1); // 只有1张令

    // 扫荡3次，VIP5免费3次，不需要扫荡令
    const result = sweep.sweep('chapter1_stage1', 3);
    expect(result.success).toBe(true);
    expect(result.ticketsUsed).toBe(0);
    expect(result.freeSweepUsed).toBe(3);
  });

  it('VIP每日额外扫荡令在领取时一并发放', () => {
    const dp = fakeDataProvider(stdChapters());
    const vip = new VIPSystem();
    vip.addExp(1500); // VIP5 → extra_sweep_ticket_1(1) + extra_sweep_ticket_2(2) = +3

    const sweep = new SweepSystem(dp, mockRewardDeps(), mockSweepDeps(), undefined, undefined, vip);
    const amount = sweep.claimDailyTickets();
    // 基础3 + VIP额外3 = 6
    expect(amount).toBe(6);
  });
});

describe('F-Cross · ISubsystem 适配层', () => {
  it('CampaignProgressSystem init/getState/reset 正常工作', () => {
    const sys = new CampaignProgressSystem(fakeDataProvider(stdChapters()));
    const d = mockDeps();
    sys.init(d);
    sys.initProgress();
    sys.completeStage('chapter1_stage1', 3);

    const state = sys.getState() as CampaignProgress;
    expect(state.stageStates['chapter1_stage1'].stars).toBe(3);

    sys.reset();
    expect((sys.getState() as CampaignProgress).stageStates['chapter1_stage1'].stars).toBe(0);
  });

  it('RewardDistributor distribute 处理 fragments 为 null', () => {
    const dp = fakeDataProvider(stdChapters());
    const rewardDeps = mockRewardDeps();
    const dist = new RewardDistributor(dp, rewardDeps, () => 0.5);

    // 手动构造 fragments 为 null 的奖励
    const reward: StageReward = {
      resources: { grain: 100 }, exp: 50, fragments: null as any,
      isFirstClear: false, starMultiplier: 1.0,
    };
    expect(() => dist.distribute(reward)).not.toThrow();
  });
});

describe('F-Cross · RewardDistributor 统一奖励 API', () => {
  it('getUnificationRewards S级包含帝王称号', () => {
    const dp = fakeDataProvider(stdChapters());
    const dist = new RewardDistributor(dp, mockRewardDeps());
    const rewards = dist.getUnificationRewards('S');
    expect(rewards.some(r => r.id === 'title-emperor')).toBe(true);
    expect(rewards.some(r => r.type === 'currency' && r.amount === 3000)).toBe(true);
  });

  it('getUnificationRewards 默认C级', () => {
    const dp = fakeDataProvider(stdChapters());
    const dist = new RewardDistributor(dp, mockRewardDeps());
    const rewards = dist.getUnificationRewards();
    expect(rewards.some(r => r.id === 'title-hero')).toBe(true);
  });

  it('getFinalStageBonus 星级加成', () => {
    const dp = fakeDataProvider(stdChapters());
    const dist = new RewardDistributor(dp, mockRewardDeps());
    const bonus = dist.getFinalStageBonus(3);
    expect(bonus.starMultiplier).toBe(3);
    expect(bonus.bonusGold).toBe(15000);
  });
});

describe('F-Cross · 通关次数统计', () => {
  it('重复挑战增加 clearCount', () => {
    const sys = new CampaignProgressSystem(fakeDataProvider(stdChapters()));
    sys.initProgress();
    sys.completeStage('chapter1_stage1', 2);
    sys.completeStage('chapter1_stage1', 3);
    sys.completeStage('chapter1_stage1', 1);
    expect(sys.getClearCount('chapter1_stage1')).toBe(3);
  });

  it('lastClearTime 随通关更新', () => {
    const sys = new CampaignProgressSystem(fakeDataProvider(stdChapters()));
    sys.initProgress();
    const before = sys.getProgress().lastClearTime;
    sys.completeStage('chapter1_stage1', 2);
    const after = sys.getProgress().lastClearTime;
    expect(after).toBeGreaterThanOrEqual(before);
  });
});

describe('F-Cross · 挑战系统每日重置', () => {
  it('每日重置挑战次数', () => {
    const deps = mockChallengeDeps();
    const challenge = new ChallengeStageSystem(deps);

    // 用完今日次数
    for (let i = 0; i < 3; i++) {
      challenge.preLockResources('challenge_1');
      challenge.completeChallenge('challenge_1', true);
    }

    expect(challenge.getDailyRemaining('challenge_1')).toBe(0);

    // 模拟次日
    const tomorrow = Date.now() + 86400000;
    expect(challenge.getDailyRemaining('challenge_1', tomorrow)).toBe(3);
  });
});
