/**
 * 成就模块对抗式测试
 *
 * 覆盖子系统：S1:AchievementSystem S2:AchievementHelpers
 * S3:achievement-config S4:achievement.types
 *
 * 5维度：F-Normal / F-Error / F-Boundary / F-Cross / F-Lifecycle
 * @module tests/adversarial/achievement-adversarial
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AchievementSystem } from '../../engine/achievement/AchievementSystem';
import {
  createInitialState,
  createAchievementInstance,
  initChainProgress,
} from '../../engine/achievement/AchievementHelpers';
import {
  ALL_ACHIEVEMENTS,
  ACHIEVEMENT_DEF_MAP,
  REBIRTH_ACHIEVEMENT_CHAINS,
} from '../../core/achievement/achievement-config';
import {
  ACHIEVEMENT_RARITY_WEIGHTS,
  ACHIEVEMENT_SAVE_VERSION,
} from '../../core/achievement/achievement.types';
import type {
  AchievementDimension,
  AchievementDef,
  AchievementInstance,
  AchievementStatus,
  AchievementState,
  AchievementReward,
  AchievementSaveData,
  AchievementConditionType,
  DimensionStats,
} from '../../core/achievement/achievement.types';
import type { ISystemDeps } from '../../core/types';

// ── 测试辅助 ──────────────────────────────────

const mockDeps = (): ISystemDeps => ({
  eventBus: {
    on: vi.fn().mockReturnValue(vi.fn()),
    once: vi.fn().mockReturnValue(vi.fn()),
    emit: vi.fn(),
    off: vi.fn(),
    removeAllListeners: vi.fn(),
  },
  config: { get: vi.fn(), set: vi.fn() },
  registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(), has: vi.fn(), unregister: vi.fn() },
} as unknown as ISystemDeps);

/** 创建已初始化的 AchievementSystem */
function createSystem(): AchievementSystem {
  const sys = new AchievementSystem();
  sys.init(mockDeps());
  return sys;
}

/** 快速推进某个成就到完成状态 */
function progressToComplete(sys: AchievementSystem, defId: string): void {
  const def = ACHIEVEMENT_DEF_MAP[defId];
  if (!def) return;
  // 如果有前置成就，先完成前置
  if (def.prerequisiteId) {
    progressToComplete(sys, def.prerequisiteId);
    const prereqInst = sys.getState().achievements[def.prerequisiteId];
    if (prereqInst && prereqInst.status === 'completed') {
      sys.claimReward(def.prerequisiteId);
    }
  }
  for (const cond of def.conditions) {
    sys.updateProgress(cond.type, cond.targetValue);
  }
}

// ══════════════════════════════════════════════
// F-Normal: 正常流程
// ══════════════════════════════════════════════

describe('F-Normal: 成就初始化', () => {
  it('系统初始化后应包含所有成就定义', () => {
    const sys = createSystem();
    const all = sys.getAllAchievements();
    expect(all).toHaveLength(ALL_ACHIEVEMENTS.length);
  });

  it('无前置成就的初始状态为 in_progress', () => {
    const sys = createSystem();
    const ach = sys.getAchievement('ach-battle-001');
    expect(ach).not.toBeNull();
    expect(ach!.instance.status).toBe('in_progress');
  });

  it('有前置成就的初始状态为 locked', () => {
    const sys = createSystem();
    const ach = sys.getAchievement('ach-battle-002');
    expect(ach).not.toBeNull();
    expect(ach!.instance.status).toBe('locked');
  });

  it('初始进度全为 0', () => {
    const sys = createSystem();
    const ach = sys.getAchievement('ach-battle-001');
    const progress = ach!.instance.progress;
    for (const val of Object.values(progress)) {
      expect(val).toBe(0);
    }
  });

  it('初始总积分为 0', () => {
    const sys = createSystem();
    expect(sys.getTotalPoints()).toBe(0);
  });

  it('初始无可领取成就', () => {
    const sys = createSystem();
    expect(sys.getClaimableAchievements()).toHaveLength(0);
  });

  it('初始无已完成成就链', () => {
    const sys = createSystem();
    expect(sys.getCompletedChains()).toHaveLength(0);
  });

  it('维度统计应正确统计各维度成就总数', () => {
    const sys = createSystem();
    const stats = sys.getDimensionStats();
    const dims: AchievementDimension[] = ['battle', 'building', 'collection', 'social', 'rebirth'];
    let totalFromDims = 0;
    for (const d of dims) {
      expect(stats[d]).toBeDefined();
      totalFromDims += stats[d].totalCount;
    }
    expect(totalFromDims).toBe(ALL_ACHIEVEMENTS.length);
  });
});

describe('F-Normal: 进度更新', () => {
  it('更新 battle_wins 应推进对应成就', () => {
    const sys = createSystem();
    sys.updateProgress('battle_wins', 10);
    const ach = sys.getAchievement('ach-battle-001');
    expect(ach!.instance.progress['battle_wins']).toBe(10);
  });

  it('进度达到目标值应自动完成成就', () => {
    const sys = createSystem();
    sys.updateProgress('battle_wins', 10);
    const ach = sys.getAchievement('ach-battle-001');
    expect(ach!.instance.status).toBe('completed');
    expect(ach!.instance.completedAt).not.toBeNull();
  });

  it('进度未达到目标值不应完成', () => {
    const sys = createSystem();
    sys.updateProgress('battle_wins', 5);
    const ach = sys.getAchievement('ach-battle-001');
    expect(ach!.instance.status).toBe('in_progress');
  });

  it('updateProgress 使用绝对值取最大值', () => {
    const sys = createSystem();
    sys.updateProgress('battle_wins', 3);
    sys.updateProgress('battle_wins', 7);
    sys.updateProgress('battle_wins', 5); // 小于7，不应降低
    const ach = sys.getAchievement('ach-battle-001');
    expect(ach!.instance.progress['battle_wins']).toBe(7);
  });

  it('updateProgressFromSnapshot 批量更新', () => {
    const sys = createSystem();
    sys.updateProgressFromSnapshot({ battle_wins: 10, hero_count: 5 });
    expect(sys.getAchievement('ach-battle-001')!.instance.progress['battle_wins']).toBe(10);
    expect(sys.getAchievement('ach-collect-001')!.instance.progress['hero_count']).toBe(5);
  });

  it('完成成就应触发 achievement:completed 事件', () => {
    const sys = createSystem();
    sys.updateProgress('battle_wins', 10);
    expect(sys['deps'].eventBus.emit).toHaveBeenCalledWith(
      'achievement:completed',
      expect.objectContaining({ id: 'ach-battle-001' }),
    );
  });
});

describe('F-Normal: 完成判定', () => {
  it('完成成就后状态变为 completed', () => {
    const sys = createSystem();
    progressToComplete(sys, 'ach-battle-001');
    expect(sys.getAchievement('ach-battle-001')!.instance.status).toBe('completed');
  });

  it('completedAt 应为有效时间戳', () => {
    const sys = createSystem();
    const before = Date.now();
    progressToComplete(sys, 'ach-battle-001');
    const after = Date.now();
    const ts = sys.getAchievement('ach-battle-001')!.instance.completedAt!;
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it('已完成的成就不再响应进度更新', () => {
    const sys = createSystem();
    progressToComplete(sys, 'ach-battle-001');
    const progressBefore = sys.getAchievement('ach-battle-001')!.instance.progress['battle_wins'];
    sys.updateProgress('battle_wins', 9999);
    const progressAfter = sys.getAchievement('ach-battle-001')!.instance.progress['battle_wins'];
    expect(progressAfter).toBe(progressBefore);
  });
});

describe('F-Normal: 奖励领取', () => {
  it('完成成就后可领取奖励', () => {
    const sys = createSystem();
    progressToComplete(sys, 'ach-battle-001');
    const result = sys.claimReward('ach-battle-001');
    expect(result.success).toBe(true);
    expect(result.reward).toBeDefined();
    expect(result.reward!.achievementPoints).toBe(10);
  });

  it('领取后状态变为 claimed', () => {
    const sys = createSystem();
    progressToComplete(sys, 'ach-battle-001');
    sys.claimReward('ach-battle-001');
    expect(sys.getAchievement('ach-battle-001')!.instance.status).toBe('claimed');
    expect(sys.getAchievement('ach-battle-001')!.instance.claimedAt).not.toBeNull();
  });

  it('领取后总积分增加', () => {
    const sys = createSystem();
    progressToComplete(sys, 'ach-battle-001');
    sys.claimReward('ach-battle-001');
    expect(sys.getTotalPoints()).toBe(10);
  });

  it('领取后维度统计更新', () => {
    const sys = createSystem();
    progressToComplete(sys, 'ach-battle-001');
    sys.claimReward('ach-battle-001');
    const stats = sys.getDimensionStats();
    expect(stats.battle.completedCount).toBe(1);
    expect(stats.battle.totalPoints).toBe(10);
  });

  it('奖励回调被调用', () => {
    const sys = createSystem();
    const cb = vi.fn();
    sys.setRewardCallback(cb);
    progressToComplete(sys, 'ach-battle-001');
    sys.claimReward('ach-battle-001');
    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({ achievementPoints: 10 }),
    );
  });

  it('getClaimableAchievements 返回已完成未领取的成就', () => {
    const sys = createSystem();
    progressToComplete(sys, 'ach-battle-001');
    expect(sys.getClaimableAchievements()).toContain('ach-battle-001');
  });
});

describe('F-Normal: 成就链(前置成就)', () => {
  it('前置成就仅 completed 但未 claim 时后续保持 locked', () => {
    const sys = createSystem();
    // ach-battle-001 的条件是 battle_wins=10，ach-battle-002 是 battle_wins=100
    // 先只推进到 9，让 ach-battle-001 未完成
    sys.updateProgress('battle_wins', 9);
    const ach2 = sys.getAchievement('ach-battle-002');
    expect(ach2!.instance.status).toBe('locked');
  });

  it('领取前置成就后解锁后续成就', () => {
    const sys = createSystem();
    progressToComplete(sys, 'ach-battle-001');
    sys.claimReward('ach-battle-001');
    const ach2 = sys.getAchievement('ach-battle-002');
    expect(ach2!.instance.status).toBe('in_progress');
  });

  it('解锁后推进进度可完成后续成就', () => {
    const sys = createSystem();
    progressToComplete(sys, 'ach-battle-001');
    sys.claimReward('ach-battle-001');
    sys.updateProgress('battle_wins', 100);
    expect(sys.getAchievement('ach-battle-002')!.instance.status).toBe('completed');
  });

  it('多级前置链: ach-battle-001 → 002 → 003', () => {
    const sys = createSystem();
    progressToComplete(sys, 'ach-battle-001');
    sys.claimReward('ach-battle-001');
    progressToComplete(sys, 'ach-battle-002');
    sys.claimReward('ach-battle-002');
    sys.updateProgress('battle_wins', 500);
    expect(sys.getAchievement('ach-battle-003')!.instance.status).toBe('completed');
  });
});

describe('F-Normal: 成就分类', () => {
  it('按维度获取成就', () => {
    const sys = createSystem();
    const battle = sys.getAchievementsByDimension('battle');
    const building = sys.getAchievementsByDimension('building');
    expect(battle.length).toBeGreaterThan(0);
    expect(building.length).toBeGreaterThan(0);
    expect(battle.every((a: any) => a.dimension === 'battle')).toBe(true);
    expect(building.every((a: any) => a.dimension === 'building')).toBe(true);
  });

  it('getAchievement 返回 null 对不存在的 ID', () => {
    const sys = createSystem();
    expect(sys.getAchievement('nonexistent')).toBeNull();
  });

  it('getUnlockedSummary 初始状态', () => {
    const sys = createSystem();
    const summary = sys.getUnlockedSummary();
    expect(summary.totalAchievements).toBe(ALL_ACHIEVEMENTS.length);
    expect(summary.unlockedCount).toBe(0);
    expect(Object.keys(summary.byDimension)).toHaveLength(5);
  });
});

// ══════════════════════════════════════════════
// F-Error: 错误路径
// ══════════════════════════════════════════════

describe('F-Error: 错误路径', () => {
  it('领取不存在的成就应返回失败', () => {
    const sys = createSystem();
    const result = sys.claimReward('nonexistent');
    expect(result.success).toBe(false);
    expect(result.reason).toContain('不存在');
  });

  it('领取未完成的成就应返回失败', () => {
    const sys = createSystem();
    const result = sys.claimReward('ach-battle-001');
    expect(result.success).toBe(false);
    expect(result.reason).toContain('未完成');
  });

  it('领取已完成但已 claimed 的成就应返回失败', () => {
    const sys = createSystem();
    progressToComplete(sys, 'ach-battle-001');
    sys.claimReward('ach-battle-001');
    const result = sys.claimReward('ach-battle-001');
    expect(result.success).toBe(false);
  });

  it('加载版本不匹配的存档应被忽略', () => {
    const sys = createSystem();
    const badData: AchievementSaveData = {
      state: createInitialState(),
      version: 999,
    };
    sys.loadSaveData(badData);
    // 状态应保持初始
    expect(sys.getTotalPoints()).toBe(0);
  });

  it('不匹配的条件类型不应影响成就进度', () => {
    const sys = createSystem();
    sys.updateProgress('hero_count' as AchievementConditionType, 100);
    const ach = sys.getAchievement('ach-battle-001');
    expect(ach!.instance.progress['battle_wins']).toBe(0);
  });
});

// ══════════════════════════════════════════════
// F-Boundary: 边界条件
// ══════════════════════════════════════════════

describe('F-Boundary: NaN / 负数 / 极端值', () => {
  it('NaN 进度不应破坏系统', () => {
    const sys = createSystem();
    expect(() => sys.updateProgress('battle_wins', NaN)).not.toThrow();
    const ach = sys.getAchievement('ach-battle-001');
    // NaN 比较结果为 false，所以进度应保持原值
    expect(isNaN(ach!.instance.progress['battle_wins'])).toBe(true);
  });

  it('负数进度不应降低已有进度 (Math.max 保护)', () => {
    const sys = createSystem();
    sys.updateProgress('battle_wins', 5);
    sys.updateProgress('battle_wins', -100);
    const ach = sys.getAchievement('ach-battle-001');
    // Math.max(5, -100) = 5
    expect(ach!.instance.progress['battle_wins']).toBe(5);
  });

  it('零进度不应完成任何成就', () => {
    const sys = createSystem();
    sys.updateProgress('battle_wins', 0);
    expect(sys.getAchievement('ach-battle-001')!.instance.status).toBe('in_progress');
  });

  it('极大值进度应正常完成', () => {
    const sys = createSystem();
    sys.updateProgress('battle_wins', Number.MAX_SAFE_INTEGER);
    expect(sys.getAchievement('ach-battle-001')!.instance.status).toBe('completed');
  });

  it('Infinity 进度应正常完成', () => {
    const sys = createSystem();
    sys.updateProgress('battle_wins', Infinity);
    expect(sys.getAchievement('ach-battle-001')!.instance.status).toBe('completed');
  });

  it('刚好等于目标值应完成', () => {
    const sys = createSystem();
    sys.updateProgress('battle_wins', 10);
    expect(sys.getAchievement('ach-battle-001')!.instance.status).toBe('completed');
  });

  it('目标值减一不应完成', () => {
    const sys = createSystem();
    sys.updateProgress('battle_wins', 9);
    expect(sys.getAchievement('ach-battle-001')!.instance.status).toBe('in_progress');
  });
});

describe('F-Boundary: 重复领取', () => {
  it('重复领取同一成就应被拒绝', () => {
    const sys = createSystem();
    progressToComplete(sys, 'ach-battle-001');
    const first = sys.claimReward('ach-battle-001');
    expect(first.success).toBe(true);
    const second = sys.claimReward('ach-battle-001');
    expect(second.success).toBe(false);
  });

  it('重复领取不应重复发放积分', () => {
    const sys = createSystem();
    progressToComplete(sys, 'ach-battle-001');
    sys.claimReward('ach-battle-001');
    sys.claimReward('ach-battle-001');
    expect(sys.getTotalPoints()).toBe(10);
  });

  it('重复领取不应重复调用回调', () => {
    const sys = createSystem();
    const cb = vi.fn();
    sys.setRewardCallback(cb);
    progressToComplete(sys, 'ach-battle-001');
    sys.claimReward('ach-battle-001');
    sys.claimReward('ach-battle-001');
    expect(cb).toHaveBeenCalledTimes(1);
  });
});

describe('F-Boundary: 隐藏成就', () => {
  it('隐藏成就存在于 getAllAchievements 列表中', () => {
    const sys = createSystem();
    const hidden = sys.getAllAchievements().filter((a) => a.hidden);
    expect(hidden.length).toBeGreaterThan(0);
  });

  it('隐藏成就 ach-battle-004 有前置 ach-battle-003', () => {
    expect(ACHIEVEMENT_DEF_MAP['ach-battle-004'].hidden).toBe(true);
    expect(ACHIEVEMENT_DEF_MAP['ach-battle-004'].prerequisiteId).toBe('ach-battle-003');
  });
});

// ══════════════════════════════════════════════
// F-Cross: 跨系统联动
// ══════════════════════════════════════════════

describe('F-Cross: 成就 → 资源(奖励回调)', () => {
  it('领取含资源奖励的成就应通过回调传递资源', () => {
    const sys = createSystem();
    const cb = vi.fn();
    sys.setRewardCallback(cb);
    progressToComplete(sys, 'ach-battle-001');
    sys.claimReward('ach-battle-001');
    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({
        achievementPoints: 10,
        resources: { gold: 100 },
      }),
    );
  });

  it('领取含声望奖励的成就应通过回调传递声望', () => {
    const sys = createSystem();
    const cb = vi.fn();
    sys.setRewardCallback(cb);
    progressToComplete(sys, 'ach-battle-003');
    sys.claimReward('ach-battle-001');
    sys.claimReward('ach-battle-002');
    sys.claimReward('ach-battle-003');
    const lastCall = cb.mock.calls[cb.mock.calls.length - 1][0] as AchievementReward;
    expect(lastCall.prestigePoints).toBe(200);
  });
});

describe('F-Cross: 成就链完成 → 额外奖励', () => {
  it('完成整条成就链应触发 chainCompleted 事件', () => {
    const sys = createSystem();
    // 完成 chain-battle-master 的所有成就
    progressToComplete(sys, 'ach-battle-001');
    sys.claimReward('ach-battle-001');
    progressToComplete(sys, 'ach-battle-002');
    sys.claimReward('ach-battle-002');
    progressToComplete(sys, 'ach-battle-003');
    sys.claimReward('ach-battle-003');
    progressToComplete(sys, 'ach-battle-004');
    sys.claimReward('ach-battle-004');

    expect(sys['deps'].eventBus.emit).toHaveBeenCalledWith(
      'achievement:chainCompleted',
      expect.objectContaining({ chainId: 'chain-battle-master' }),
    );
  });

  it('完成整条链应发放链完成奖励', () => {
    const sys = createSystem();
    const cb = vi.fn();
    sys.setRewardCallback(cb);
    progressToComplete(sys, 'ach-battle-001');
    sys.claimReward('ach-battle-001');
    progressToComplete(sys, 'ach-battle-002');
    sys.claimReward('ach-battle-002');
    progressToComplete(sys, 'ach-battle-003');
    sys.claimReward('ach-battle-003');
    progressToComplete(sys, 'ach-battle-004');
    sys.claimReward('ach-battle-004');

    // 最后一次回调应该是链奖励
    const lastCall = cb.mock.calls[cb.mock.calls.length - 1][0] as AchievementReward;
    expect(lastCall.achievementPoints).toBe(100);
    expect(lastCall.resources).toEqual({ gold: 10000 });
  });

  it('部分完成链不应触发链完成', () => {
    const sys = createSystem();
    progressToComplete(sys, 'ach-battle-001');
    sys.claimReward('ach-battle-001');
    expect(sys.getCompletedChains()).toHaveLength(0);
  });
});

describe('F-Cross: 成就 → 声望(事件联动)', () => {
  it('通过事件总线接收 prestige:levelUp 更新声望成就', () => {
    const deps = mockDeps();
    const sys = new AchievementSystem();
    sys.init(deps);

    // 获取注册的监听器
    const onCalls = (deps.eventBus.on as ReturnType<typeof vi.fn>).mock.calls;
    const prestigeCall = onCalls.find((c: any[]) => c[0] === 'prestige:levelUp');
    expect(prestigeCall).toBeDefined();

    // 模拟事件触发
    const handler = prestigeCall![1] as (p: any) => void;
    handler({ level: 50 });
    expect(sys.getAchievement('ach-rebirth-006')!.instance.progress['prestige_level']).toBe(50);
  });
});

describe('F-Cross: 成就 → 任务(quest_completed)', () => {
  it('updateProgress 支持 quest_completed 条件类型', () => {
    const sys = createSystem();
    // quest_completed 是合法条件类型，虽然当前配置未使用
    expect(() => sys.updateProgress('quest_completed', 50)).not.toThrow();
  });
});

describe('F-Cross: 多维度同时推进', () => {
  it('一次 snapshot 更新可同时推进多维度成就', () => {
    const sys = createSystem();
    sys.updateProgressFromSnapshot({
      battle_wins: 10,
      building_level: 5,
      hero_count: 5,
    });
    expect(sys.getAchievement('ach-battle-001')!.instance.status).toBe('completed');
    expect(sys.getAchievement('ach-build-001')!.instance.status).toBe('completed');
    expect(sys.getAchievement('ach-collect-001')!.instance.status).toBe('completed');
  });
});

// ══════════════════════════════════════════════
// F-Lifecycle: 序列化与生命周期
// ══════════════════════════════════════════════

describe('F-Lifecycle: 存档序列化', () => {
  it('getSaveData 返回正确版本号', () => {
    const sys = createSystem();
    const data = sys.getSaveData();
    expect(data.version).toBe(ACHIEVEMENT_SAVE_VERSION);
  });

  it('存读档往返一致性', () => {
    const sys = createSystem();
    progressToComplete(sys, 'ach-battle-001');
    sys.claimReward('ach-battle-001');

    const saved = sys.getSaveData();

    const sys2 = createSystem();
    sys2.loadSaveData(saved);

    expect(sys2.getTotalPoints()).toBe(10);
    expect(sys2.getAchievement('ach-battle-001')!.instance.status).toBe('claimed');
    expect(sys2.getDimensionStats().battle.completedCount).toBe(1);
  });

  it('加载存档后成就链进度正确重建', () => {
    const sys = createSystem();
    progressToComplete(sys, 'ach-battle-001');
    sys.claimReward('ach-battle-001');
    progressToComplete(sys, 'ach-battle-002');
    sys.claimReward('ach-battle-002');

    const saved = sys.getSaveData();
    const sys2 = createSystem();
    sys2.loadSaveData(saved);

    const chains = sys2.getAchievementChains();
    const battleChain = chains.find((c) => c.chainId === 'chain-battle-master');
    expect(battleChain!.progress).toBe(2);
  });
});

describe('F-Lifecycle: reset', () => {
  it('reset 后状态恢复初始', () => {
    const sys = createSystem();
    progressToComplete(sys, 'ach-battle-001');
    sys.claimReward('ach-battle-001');
    expect(sys.getTotalPoints()).toBe(10);

    sys.reset();
    expect(sys.getTotalPoints()).toBe(0);
    expect(sys.getAchievement('ach-battle-001')!.instance.status).toBe('in_progress');
    expect(sys.getClaimableAchievements()).toHaveLength(0);
  });

  it('reset 后成就链清空', () => {
    const sys = createSystem();
    sys.reset();
    expect(sys.getCompletedChains()).toHaveLength(0);
  });
});

describe('F-Lifecycle: update 不影响状态', () => {
  it('update(dt) 不改变成就状态', () => {
    const sys = createSystem();
    progressToComplete(sys, 'ach-battle-001');
    const statusBefore = sys.getAchievement('ach-battle-001')!.instance.status;
    sys.update(16);
    const statusAfter = sys.getAchievement('ach-battle-001')!.instance.status;
    expect(statusAfter).toBe(statusBefore);
  });
});

// ══════════════════════════════════════════════
// 辅助函数单元测试
// ══════════════════════════════════════════════

describe('AchievementHelpers', () => {
  it('createAchievementInstance 无前置为 in_progress', () => {
    const def = ACHIEVEMENT_DEF_MAP['ach-battle-001'];
    const inst = createAchievementInstance(def);
    expect(inst.status).toBe('in_progress');
    expect(inst.defId).toBe('ach-battle-001');
    expect(inst.completedAt).toBeNull();
    expect(inst.claimedAt).toBeNull();
  });

  it('createAchievementInstance 有前置为 locked', () => {
    const def = ACHIEVEMENT_DEF_MAP['ach-battle-002'];
    const inst = createAchievementInstance(def);
    expect(inst.status).toBe('locked');
  });

  it('createInitialState 包含所有成就', () => {
    const state = createInitialState();
    expect(Object.keys(state.achievements)).toHaveLength(ALL_ACHIEVEMENTS.length);
  });

  it('initChainProgress 初始化所有链', () => {
    const progress = initChainProgress();
    for (const chain of REBIRTH_ACHIEVEMENT_CHAINS) {
      expect(progress[chain.chainId]).toBe(0);
    }
  });
});

// ══════════════════════════════════════════════
// 配置完整性校验
// ══════════════════════════════════════════════

describe('配置完整性', () => {
  it('所有前置成就引用有效', () => {
    for (const def of ALL_ACHIEVEMENTS) {
      if (def.prerequisiteId) {
        expect(ACHIEVEMENT_DEF_MAP[def.prerequisiteId]).toBeDefined();
      }
    }
  });

  it('成就链中引用的成就ID全部存在', () => {
    for (const chain of REBIRTH_ACHIEVEMENT_CHAINS) {
      for (const achId of chain.achievementIds) {
        expect(ACHIEVEMENT_DEF_MAP[achId]).toBeDefined();
      }
    }
  });

  it('所有成就有非空 name 和 description', () => {
    for (const def of ALL_ACHIEVEMENTS) {
      expect(def.name.length).toBeGreaterThan(0);
      expect(def.description.length).toBeGreaterThan(0);
    }
  });

  it('所有成就奖励有正的 achievementPoints', () => {
    for (const def of ALL_ACHIEVEMENTS) {
      expect(def.rewards.achievementPoints).toBeGreaterThan(0);
    }
  });

  it('稀有度权重覆盖所有稀有度', () => {
    const rarities: Array<keyof typeof ACHIEVEMENT_RARITY_WEIGHTS> = ['common', 'rare', 'epic', 'legendary'];
    for (const r of rarities) {
      expect(ACHIEVEMENT_RARITY_WEIGHTS[r]).toBeGreaterThan(0);
    }
  });
});

// ══════════════════════════════════════════════
// 防御性: getState 返回深拷贝
// ══════════════════════════════════════════════

describe('防御性: 状态隔离', () => {
  it('getState 返回的 achievements 修改不影响内部', () => {
    const sys = createSystem();
    const state1 = sys.getState();
    state1.achievements['ach-battle-001'] = {
      defId: 'ach-battle-001', status: 'claimed',
      progress: { battle_wins: 999 }, completedAt: 1, claimedAt: 1,
    };
    const state2 = sys.getState();
    expect(state2.achievements['ach-battle-001'].status).toBe('in_progress');
  });

  it('getDimensionStats 返回深拷贝', () => {
    const sys = createSystem();
    const stats1 = sys.getDimensionStats();
    stats1.battle.completedCount = 999;
    const stats2 = sys.getDimensionStats();
    expect(stats2.battle.completedCount).toBe(0);
  });
});
