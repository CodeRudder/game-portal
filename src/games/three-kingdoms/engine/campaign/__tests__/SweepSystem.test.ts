import { vi } from 'vitest';
/**
 * 扫荡系统测试 — 扫荡解锁条件 + 扫荡令管理
 *
 * 覆盖：
 * - #6 扫荡解锁条件（三星通关检查）
 * - #7 扫荡令获取（每日任务/商店购买）
 * - ISubsystem 接口
 * - 序列化/反序列化
 */

import { SweepSystem } from '../SweepSystem';
import type { ICampaignDataProvider, RewardDistributorDeps } from '../campaign.types';
import type { SweepDeps, SweepConfig } from '../sweep.types';
import { DEFAULT_SWEEP_CONFIG } from '../sweep.types';
import { getChapters, getChapter, getStage, getStagesByChapter } from '../campaign-config';

// ─────────────────────────────────────────────
// 测试辅助
// ─────────────────────────────────────────────

const dataProvider: ICampaignDataProvider = {
  getChapters, getChapter, getStage, getStagesByChapter,
};

const noDropRng = () => 1.0;

function createTrackedDeps() {
  const resources: Record<string, number> = {};
  const fragments: Record<string, number> = {};
  let totalExp = 0;
  return {
    deps: {
      addResource: (type: any, amount: number) => {
        resources[type] = (resources[type] ?? 0) + amount;
        return resources[type];
      },
      addFragment: (generalId: string, count: number) => {
        fragments[generalId] = (fragments[generalId] ?? 0) + count;
      },
      addExp: (exp: number) => { totalExp += exp; },
    } satisfies RewardDistributorDeps,
    resources, fragments,
    get totalExp() { return totalExp; },
  };
}

type StarMap = Record<string, number>;

function createSweepDeps(starMap: StarMap = {}, options?: {
  battleResults?: Record<string, { victory: boolean; stars: number }>;
  farthestStageId?: string;
}) {
  const battleResults = options?.battleResults ?? {};
  const farthestStageId = options?.farthestStageId ?? null;
  return {
    simulateBattle: vi.fn((stageId: string) => {
      if (battleResults[stageId]) return battleResults[stageId];
      return { victory: true, stars: 3 };
    }),
    getStageStars: vi.fn((stageId: string) => starMap[stageId] ?? 0),
    canChallenge: vi.fn((stageId: string) => {
      return (starMap[stageId] ?? 0) > 0 || stageId === farthestStageId;
    }),
    getFarthestStageId: vi.fn(() => farthestStageId),
    completeStage: vi.fn(),
  } satisfies SweepDeps;
}

export function createSweepSystem(starMap: StarMap = {}, options?: {
  battleResults?: Record<string, { victory: boolean; stars: number }>;
  farthestStageId?: string;
  config?: Partial<SweepConfig>;
  initialTickets?: number;
}) {
  const tracked = createTrackedDeps();
  const deps = createSweepDeps(starMap, options);
  const system = new SweepSystem(dataProvider, tracked.deps, deps, options?.config, noDropRng);
  if (options?.initialTickets) system.addTickets(options.initialTickets);
  return { system, tracked, deps };
}

// ═══════════════════════════════════════════════
// 1. ISubsystem 接口 & 初始化
// ═══════════════════════════════════════════════

describe('SweepSystem ISubsystem 接口', () => {
  let system: SweepSystem;

  beforeEach(() => {
    ({ system } = createSweepSystem());
  });

  it('ISubsystem.name 为 sweepSystem', () => {
    expect(system.name).toBe('sweepSystem');
  });

  it('update 不抛异常', () => {
    expect(() => system.update(0.016)).not.toThrow();
  });

  it('getState 返回扫荡令数量和每日领取状态', () => {
    expect(system.getState()).toEqual({ ticketCount: 0, dailyTicketClaimed: false });
  });

  it('reset 清空扫荡令和每日状态', () => {
    system.addTickets(10);
    system.claimDailyTickets();
    expect(system.getTicketCount()).toBe(13);

    system.reset();
    expect(system.getTicketCount()).toBe(0);
    expect(system.isDailyTicketClaimed()).toBe(false);
  });
});

// ═══════════════════════════════════════════════
// 2. 扫荡解锁条件（#6 三星通关检查）
// ═══════════════════════════════════════════════

describe('SweepSystem 扫荡解锁条件', () => {
  it('三星通关关卡可扫荡', () => {
    const { system } = createSweepSystem({ chapter1_stage1: 3 });
    expect(system.canSweep('chapter1_stage1')).toBe(true);
  });

  it('二星通关关卡不可扫荡', () => {
    const { system } = createSweepSystem({ chapter1_stage1: 2 });
    expect(system.canSweep('chapter1_stage1')).toBe(false);
  });

  it('一星通关关卡不可扫荡', () => {
    const { system } = createSweepSystem({ chapter1_stage1: 1 });
    expect(system.canSweep('chapter1_stage1')).toBe(false);
  });

  it('未通关关卡不可扫荡', () => {
    const { system } = createSweepSystem({ chapter1_stage1: 0 });
    expect(system.canSweep('chapter1_stage1')).toBe(false);
  });

  it('不存在关卡不可扫荡', () => {
    const { system } = createSweepSystem({});
    expect(system.canSweep('nonexistent')).toBe(false);
  });

  it('getSweepStatus 返回正确状态（三星）', () => {
    const { system } = createSweepSystem({ chapter1_stage1: 3 });
    const status = system.getSweepStatus('chapter1_stage1');
    expect(status.canSweep).toBe(true);
    expect(status.stars).toBe(3);
    expect(status.reason).toBe('可以扫荡');
  });

  it('getSweepStatus 返回正确状态（二星）', () => {
    const { system } = createSweepSystem({ chapter1_stage1: 2 });
    const status = system.getSweepStatus('chapter1_stage1');
    expect(status.canSweep).toBe(false);
    expect(status.stars).toBe(2);
    expect(status.reason).toContain('2星');
  });

  it('getSweepStatus 不存在关卡', () => {
    const { system } = createSweepSystem({});
    const status = system.getSweepStatus('nonexistent');
    expect(status.canSweep).toBe(false);
    expect(status.reason).toBe('关卡不存在');
  });
});

// ═══════════════════════════════════════════════
// 3. 扫荡令获取（#7 每日任务/商店购买）
// ═══════════════════════════════════════════════

describe('SweepSystem 扫荡令管理', () => {
  let system: SweepSystem;

  beforeEach(() => {
    ({ system } = createSweepSystem());
  });

  it('初始扫荡令为0', () => {
    expect(system.getTicketCount()).toBe(0);
  });

  it('addTickets 增加扫荡令', () => {
    system.addTickets(10);
    expect(system.getTicketCount()).toBe(10);
  });

  it('addTickets 多次累加', () => {
    system.addTickets(5);
    system.addTickets(3);
    expect(system.getTicketCount()).toBe(8);
  });

  it('addTickets 数量 ≤ 0 抛出异常', () => {
    expect(() => system.addTickets(0)).toThrow('必须大于0');
    expect(() => system.addTickets(-1)).toThrow('必须大于0');
  });

  it('hasEnoughTickets 正确判断', () => {
    system.addTickets(5);
    expect(system.hasEnoughTickets(5)).toBe(true);
    expect(system.hasEnoughTickets(6)).toBe(false);
  });

  it('getRequiredTickets 正确计算', () => {
    expect(system.getRequiredTickets(1)).toBe(1);
    expect(system.getRequiredTickets(5)).toBe(5);
  });

  it('领取每日扫荡令', () => {
    const gained = system.claimDailyTickets();
    expect(gained).toBe(DEFAULT_SWEEP_CONFIG.dailyTicketReward);
    expect(system.getTicketCount()).toBe(DEFAULT_SWEEP_CONFIG.dailyTicketReward);
  });

  it('每日扫荡令只能领取一次', () => {
    system.claimDailyTickets();
    expect(system.claimDailyTickets()).toBe(0);
  });

  it('isDailyTicketClaimed 反映领取状态', () => {
    expect(system.isDailyTicketClaimed()).toBe(false);
    system.claimDailyTickets();
    expect(system.isDailyTicketClaimed()).toBe(true);
  });

  it('跨日可重新领取每日扫荡令', () => {
    const day1 = new Date('2024-01-15T12:00:00').getTime();
    system.claimDailyTickets(day1);

    const day2 = new Date('2024-01-16T12:00:00').getTime();
    expect(system.claimDailyTickets(day2)).toBe(DEFAULT_SWEEP_CONFIG.dailyTicketReward);
  });

  it('同一天内不能重复领取', () => {
    const now = new Date('2024-01-15T08:00:00').getTime();
    const later = new Date('2024-01-15T20:00:00').getTime();
    system.claimDailyTickets(now);
    expect(system.claimDailyTickets(later)).toBe(0);
  });
});

// ═══════════════════════════════════════════════
// 4. 序列化/反序列化
// ═══════════════════════════════════════════════

describe('SweepSystem 序列化', () => {
  it('序列化和反序列化保持一致', () => {
    const { system } = createSweepSystem({}, { initialTickets: 10 });
    system.claimDailyTickets();

    const saved = system.serialize();
    expect(saved.version).toBe(1);
    expect(saved.ticketCount).toBe(13);

    const { system: system2 } = createSweepSystem();
    system2.deserialize(saved);
    expect(system2.getTicketCount()).toBe(13);
    expect(system2.isDailyTicketClaimed()).toBe(true);
  });

  it('版本不兼容时抛出异常', () => {
    const { system } = createSweepSystem();
    expect(() => {
      system.deserialize({ version: 999, ticketCount: 0, dailyTicketClaimed: false, lastDailyTicketDate: null });
    }).toThrow('存档版本不兼容');
  });

  it('重置后序列化数据为初始值', () => {
    const { system } = createSweepSystem({}, { initialTickets: 10 });
    system.claimDailyTickets();
    system.reset();

    const saved = system.serialize();
    expect(saved.ticketCount).toBe(0);
    expect(saved.dailyTicketClaimed).toBe(false);
    expect(saved.lastDailyTicketDate).toBeNull();
  });
});
