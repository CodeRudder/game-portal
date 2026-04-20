/**
 * AchievementSystem 单元测试
 *
 * 覆盖成就系统所有功能：
 * - #16 成就框架(5维度) — 战斗/建设/收集/社交/转生
 * - #17 成就奖励 — 资源+积分+声望值+解锁
 * - #18 转生成就链 — 链式成就+链完成奖励
 */

import { AchievementSystem } from '../AchievementSystem';
import type { ISystemDeps } from '../../../core/types';
import type { AchievementDimension, AchievementConditionType } from '../../../core/achievement';
import { ALL_ACHIEVEMENTS, REBIRTH_ACHIEVEMENT_CHAINS } from '../../../core/achievement';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

function mockDeps(): ISystemDeps {
  return {
    eventBus: {
      on: jest.fn().mockReturnValue(jest.fn()),
      once: jest.fn().mockReturnValue(jest.fn()),
      emit: jest.fn(),
      off: jest.fn(),
      removeAllListeners: jest.fn(),
    },
    config: { get: jest.fn(), set: jest.fn() },
    registry: { register: jest.fn(), get: jest.fn(), getAll: jest.fn(), has: jest.fn(), unregister: jest.fn() },
  } as unknown as ISystemDeps;
}

function createSystem(): AchievementSystem {
  const sys = new AchievementSystem();
  sys.init(mockDeps());
  return sys;
}

// ═══════════════════════════════════════════════════════════

describe('AchievementSystem', () => {
  // ═══════════════════════════════════════════
  // 1. ISubsystem 接口
  // ═══════════════════════════════════════════

  describe('ISubsystem', () => {
    test('name 为 achievement', () => {
      const sys = createSystem();
      expect(sys.name).toBe('achievement');
    });

    test('初始状态正确', () => {
      const sys = createSystem();
      const state = sys.getState();
      expect(state.totalPoints).toBe(0);
      expect(state.completedChains).toHaveLength(0);
    });

    test('reset 恢复初始状态', () => {
      const sys = createSystem();
      sys.updateProgress('battle_wins', 100);
      sys.reset();
      expect(sys.getState().totalPoints).toBe(0);
    });
  });

  // ═══════════════════════════════════════════
  // 2. 成就框架 (#16) — 5维度
  // ═══════════════════════════════════════════

  describe('成就框架 — 5维度', () => {
    const dimensions: AchievementDimension[] = ['battle', 'building', 'collection', 'social', 'rebirth'];

    test('所有5维度都有成就', () => {
      const sys = createSystem();
      for (const dim of dimensions) {
        const achs = sys.getAchievementsByDimension(dim);
        expect(achs.length).toBeGreaterThan(0);
      }
    });

    test('getAllAchievements 返回所有成就', () => {
      const sys = createSystem();
      const all = sys.getAllAchievements();
      expect(all).toHaveLength(ALL_ACHIEVEMENTS.length);
    });

    test('getAchievement 返回单个成就', () => {
      const sys = createSystem();
      const ach = sys.getAchievement('ach-battle-001');
      expect(ach).not.toBeNull();
      expect(ach!.id).toBe('ach-battle-001');
      expect(ach!.name).toBe('初出茅庐');
      expect(ach!.instance).toBeDefined();
    });

    test('getAchievement 不存在返回 null', () => {
      const sys = createSystem();
      expect(sys.getAchievement('nonexistent')).toBeNull();
    });

    test('维度统计正确', () => {
      const sys = createSystem();
      const stats = sys.getDimensionStats();
      for (const dim of dimensions) {
        expect(stats[dim]).toBeDefined();
        expect(stats[dim].completedCount).toBe(0);
        expect(stats[dim].totalCount).toBeGreaterThan(0);
      }
    });

    test('初始总积分为0', () => {
      const sys = createSystem();
      expect(sys.getTotalPoints()).toBe(0);
    });
  });

  // ═══════════════════════════════════════════
  // 3. 成就进度更新 (#16)
  // ═══════════════════════════════════════════

  describe('成就进度更新', () => {
    test('updateProgress 更新匹配条件', () => {
      const sys = createSystem();
      sys.updateProgress('battle_wins', 5);
      const ach = sys.getAchievement('ach-battle-001');
      expect(ach!.instance.progress['battle_wins']).toBe(5);
    });

    test('updateProgress 取最大值', () => {
      const sys = createSystem();
      sys.updateProgress('battle_wins', 5);
      sys.updateProgress('battle_wins', 3); // 更小值
      const ach = sys.getAchievement('ach-battle-001');
      expect(ach!.instance.progress['battle_wins']).toBe(5);
    });

    test('达到目标自动完成', () => {
      const sys = createSystem();
      sys.updateProgress('battle_wins', 10);
      const ach = sys.getAchievement('ach-battle-001');
      expect(ach!.instance.status).toBe('completed');
    });

    test('完成时发射 achievement:completed 事件', () => {
      const deps = mockDeps();
      const emitSpy = jest.spyOn(deps.eventBus, 'emit');
      const sys = new AchievementSystem();
      sys.init(deps);

      sys.updateProgress('battle_wins', 10);
      expect(emitSpy).toHaveBeenCalledWith('achievement:completed', expect.objectContaining({
        id: 'ach-battle-001',
      }));
    });

    test('未完成状态为 in_progress', () => {
      const sys = createSystem();
      sys.updateProgress('battle_wins', 5);
      const ach = sys.getAchievement('ach-battle-001');
      expect(ach!.instance.status).toBe('in_progress');
    });

    test('有前置的成就在前置完成后解锁', () => {
      const sys = createSystem();
      // ach-battle-002 需要 ach-battle-001 完成
      const ach002 = sys.getAchievement('ach-battle-002');
      expect(ach002!.instance.status).toBe('locked');

      // 完成 ach-battle-001
      sys.updateProgress('battle_wins', 10);
      // 领取 ach-battle-001 以解锁 ach-battle-002
      sys.claimReward('ach-battle-001');
      // 现在 ach-battle-002 应该解锁
      const ach002After = sys.getAchievement('ach-battle-002');
      expect(ach002After!.instance.status).toBe('in_progress');
    });

    test('updateProgressFromSnapshot 批量更新', () => {
      const sys = createSystem();
      sys.updateProgressFromSnapshot({
        battle_wins: 10,
        building_level: 5,
      });
      const achBattle = sys.getAchievement('ach-battle-001');
      const achBuild = sys.getAchievement('ach-build-001');
      expect(achBattle!.instance.progress['battle_wins']).toBe(10);
      expect(achBuild!.instance.progress['building_level']).toBe(5);
    });
  });

  // ═══════════════════════════════════════════
  // 4. 成就奖励 (#17)
  // ═══════════════════════════════════════════

  describe('成就奖励', () => {
    test('领取完成成就的奖励', () => {
      const sys = createSystem();
      sys.updateProgress('battle_wins', 10);
      const result = sys.claimReward('ach-battle-001');
      expect(result.success).toBe(true);
      expect(result.reward).toBeDefined();
      expect(result.reward!.achievementPoints).toBe(10);
    });

    test('领取后积分增加', () => {
      const sys = createSystem();
      sys.updateProgress('battle_wins', 10);
      sys.claimReward('ach-battle-001');
      expect(sys.getTotalPoints()).toBe(10);
    });

    test('未完成不能领取', () => {
      const sys = createSystem();
      sys.updateProgress('battle_wins', 5);
      const result = sys.claimReward('ach-battle-001');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('未完成');
    });

    test('已领取不能重复领取', () => {
      const sys = createSystem();
      sys.updateProgress('battle_wins', 10);
      sys.claimReward('ach-battle-001');
      const result = sys.claimReward('ach-battle-001');
      expect(result.success).toBe(false);
    });

    test('不存在的成就不能领取', () => {
      const sys = createSystem();
      const result = sys.claimReward('nonexistent');
      expect(result.success).toBe(false);
    });

    test('领取后触发奖励回调', () => {
      const sys = createSystem();
      const cb = jest.fn();
      sys.setRewardCallback(cb);
      sys.updateProgress('battle_wins', 10);
      sys.claimReward('ach-battle-001');
      expect(cb).toHaveBeenCalledTimes(1);
      expect(cb).toHaveBeenCalledWith(expect.objectContaining({ achievementPoints: 10 }));
    });

    test('getClaimableAchievements 返回可领取列表', () => {
      const sys = createSystem();
      sys.updateProgress('battle_wins', 10);
      const claimable = sys.getClaimableAchievements();
      expect(claimable).toContain('ach-battle-001');
    });

    test('领取后维度统计更新', () => {
      const sys = createSystem();
      sys.updateProgress('battle_wins', 10);
      sys.claimReward('ach-battle-001');
      const stats = sys.getDimensionStats();
      expect(stats.battle.completedCount).toBe(1);
      expect(stats.battle.totalPoints).toBe(10);
    });
  });

  // ═══════════════════════════════════════════
  // 5. 转生成就链 (#18)
  // ═══════════════════════════════════════════

  describe('转生成就链', () => {
    test('初始无已完成链', () => {
      const sys = createSystem();
      expect(sys.getCompletedChains()).toHaveLength(0);
    });

    test('getAchievementChains 返回所有链', () => {
      const sys = createSystem();
      const chains = sys.getAchievementChains();
      expect(chains).toHaveLength(REBIRTH_ACHIEVEMENT_CHAINS.length);
    });

    test('链进度初始为0', () => {
      const sys = createSystem();
      const chains = sys.getAchievementChains();
      for (const chain of chains) {
        expect(chain.progress).toBe(0);
        expect(chain.completed).toBe(false);
      }
    });

    test('完成链中所有成就后链标记完成', () => {
      const sys = createSystem();
      const rewardCb = jest.fn();
      sys.setRewardCallback(rewardCb);

      // 战神之路链: ach-battle-001, 002, 003, 004
      // 逐步完成并领取
      sys.updateProgress('battle_wins', 10);
      sys.claimReward('ach-battle-001');

      sys.updateProgress('battle_wins', 100);
      sys.claimReward('ach-battle-002');

      sys.updateProgress('battle_wins', 500);
      sys.claimReward('ach-battle-003');

      sys.updateProgress('battle_wins', 2000);
      sys.claimReward('ach-battle-004');

      const completed = sys.getCompletedChains();
      expect(completed).toContain('chain-battle-master');
    });

    test('链完成发放链奖励', () => {
      const sys = createSystem();
      const rewardCb = jest.fn();
      sys.setRewardCallback(rewardCb);

      // 完成战神之路链
      sys.updateProgress('battle_wins', 10);
      sys.claimReward('ach-battle-001');
      sys.updateProgress('battle_wins', 100);
      sys.claimReward('ach-battle-002');
      sys.updateProgress('battle_wins', 500);
      sys.claimReward('ach-battle-003');
      sys.updateProgress('battle_wins', 2000);
      sys.claimReward('ach-battle-004');

      // 最后一次回调应该是链奖励
      const lastCall = rewardCb.mock.calls[rewardCb.mock.calls.length - 1][0];
      expect(lastCall.achievementPoints).toBe(100); // chainBonusReward
    });
  });

  // ═══════════════════════════════════════════
  // 6. 事件监听
  // ═══════════════════════════════════════════

  describe('事件监听', () => {
    test('监听 battle:completed 事件', () => {
      const deps = mockDeps();
      const sys = new AchievementSystem();
      sys.init(deps);

      const onCalls = (deps.eventBus.on as jest.Mock).mock.calls;
      const battleCall = onCalls.find((c: string[]) => c[0] === 'battle:completed');
      expect(battleCall).toBeDefined();
    });

    test('监听 rebirth:completed 事件', () => {
      const deps = mockDeps();
      const sys = new AchievementSystem();
      sys.init(deps);

      const onCalls = (deps.eventBus.on as jest.Mock).mock.calls;
      const rebirthCall = onCalls.find((c: string[]) => c[0] === 'rebirth:completed');
      expect(rebirthCall).toBeDefined();
    });

    test('监听 prestige:levelUp 事件', () => {
      const deps = mockDeps();
      const sys = new AchievementSystem();
      sys.init(deps);

      const onCalls = (deps.eventBus.on as jest.Mock).mock.calls;
      const prestigeCall = onCalls.find((c: string[]) => c[0] === 'prestige:levelUp');
      expect(prestigeCall).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════
  // 7. 存档
  // ═══════════════════════════════════════════

  describe('存档', () => {
    test('存档和读档一致', () => {
      const sys = createSystem();
      sys.updateProgress('battle_wins', 10);
      sys.claimReward('ach-battle-001');

      const saveData = sys.getSaveData();
      const newSys = createSystem();
      newSys.loadSaveData(saveData);

      expect(newSys.getTotalPoints()).toBe(10);
      expect(newSys.getState().completedChains).toEqual(sys.getState().completedChains);
    });

    test('版本不匹配不加载', () => {
      const sys = createSystem();
      sys.updateProgress('battle_wins', 10);
      const before = sys.getTotalPoints();

      sys.loadSaveData({ state: sys.getState(), version: 999 });
      // 应该忽略不匹配的版本
      expect(sys.getTotalPoints()).toBe(before);
    });
  });
});
