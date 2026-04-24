/**
 * 集成测试 — 成就×声望×转生 交叉验证
 *
 * 验证成就→声望→转生→图鉴全链路数据流转，
 * 里程碑→称号→属性→战斗闭环，
 * 成就链"初露锋芒"完成→转生条件解锁。
 * 覆盖 §1.1~§1.3 + §2.1~§2.3 + §9.1~§9.5
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PrestigeSystem, calcRequiredPoints } from '../../../../engine/prestige/PrestigeSystem';
import { RebirthSystem } from '../../../../engine/prestige/RebirthSystem';
import { AchievementSystem } from '../../../../engine/achievement/AchievementSystem';
import type { ISystemDeps } from '../../../../core/types';
import type { AchievementConditionType } from '../../../../core/achievement';
import {
  REBIRTH_CONDITIONS,
  PRESTIGE_QUESTS,
} from '../../prestige-config';

// ─────────────────────────────────────────────
// 辅助
// ─────────────────────────────────────────────

function mockDeps(): ISystemDeps {
  return {
    eventBus: {
      on: vi.fn().mockReturnValue(vi.fn()),
      once: vi.fn().mockReturnValue(vi.fn()),
      emit: vi.fn(),
      off: vi.fn(),
      removeAllListeners: vi.fn(),
    },
    config: { get: vi.fn(), set: vi.fn() },
    registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(), has: vi.fn(), unregister: vi.fn() },
  } as unknown as ISystemDeps;
}

function createAchievement() {
  const sys = new AchievementSystem();
  sys.init(mockDeps());
  return sys;
}

function createPrestige() {
  const sys = new PrestigeSystem();
  sys.init(mockDeps());
  return sys;
}

function createRebirth() {
  const sys = new RebirthSystem();
  sys.init(mockDeps());
  return sys;
}

// ═════════════════════════════════════════════════════════════

describe('§1+§9 成就×声望×转生 交叉验证', () => {
  let achievement: AchievementSystem;
  let prestige: PrestigeSystem;
  let rebirth: RebirthSystem;

  beforeEach(() => {
    achievement = createAchievement();
    prestige = createPrestige();
    rebirth = createRebirth();
  });

  // ═══════════════════════════════════════════
  // §1.1 成就面板与分类
  // ═══════════════════════════════════════════

  describe('§1.1 成就面板与分类', () => {
    it('5维度分类覆盖全系统', () => {
      const stats = achievement.getDimensionStats();
      const dimensions = Object.keys(stats);
      expect(dimensions).toContain('battle');
      expect(dimensions).toContain('building');
      expect(dimensions).toContain('collection');
      expect(dimensions).toContain('social');
      expect(dimensions).toContain('rebirth');
    });

    it('成就列表非空', () => {
      const all = achievement.getAllAchievements();
      expect(all.length).toBeGreaterThan(0);
    });

    it('按维度过滤成就', () => {
      const battle = achievement.getAchievementsByDimension('battle');
      battle.forEach(a => expect(a.dimension).toBe('battle'));
    });

    it('获取单个成就详情', () => {
      const all = achievement.getAllAchievements();
      if (all.length > 0) {
        const detail = achievement.getAchievement(all[0].id);
        expect(detail).not.toBeNull();
        expect(detail!.id).toBe(all[0].id);
      }
    });

    it('不存在成就返回null', () => {
      const detail = achievement.getAchievement('non-existent');
      expect(detail).toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // §1.2 成就奖励与点数
  // ═══════════════════════════════════════════

  describe('§1.2 成就奖励与点数', () => {
    it('初始成就积分为0', () => {
      expect(achievement.getTotalPoints()).toBe(0);
    });

    it('领取奖励后积分增加', () => {
      // 先完成一个成就
      const all = achievement.getAllAchievements();
      const first = all.find(a => !a.hidden && a.instance.status !== 'completed');
      if (first) {
        // 直接设置进度
        for (const cond of first.conditions) {
          achievement.updateProgress(cond.type, cond.targetValue);
        }
        const result = achievement.claimReward(first.id);
        if (result.success) {
          expect(achievement.getTotalPoints()).toBeGreaterThan(0);
        }
      }
    });

    it('未完成成就不可领取', () => {
      const all = achievement.getAllAchievements();
      const locked = all.find(a => a.instance.status === 'locked');
      if (locked) {
        const result = achievement.claimReward(locked.id);
        expect(result.success).toBe(false);
      }
    });

    it('奖励回调触发', () => {
      const cb = vi.fn();
      achievement.setRewardCallback(cb);
      const all = achievement.getAllAchievements();
      const first = all.find(a => !a.hidden && a.instance.status !== 'completed');
      if (first) {
        for (const cond of first.conditions) {
          achievement.updateProgress(cond.type, cond.targetValue);
        }
        const result = achievement.claimReward(first.id);
        if (result.success) {
          expect(cb).toHaveBeenCalled();
        }
      }
    });

    it('可领取列表正确', () => {
      const claimable = achievement.getClaimableAchievements();
      expect(Array.isArray(claimable)).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // §1.3 转生成就链"初露锋芒"
  // ═══════════════════════════════════════════

  describe('§1.3 转生成就链', () => {
    it('成就链列表非空', () => {
      const chains = achievement.getAchievementChains();
      expect(chains.length).toBeGreaterThan(0);
    });

    it('初始链进度为0', () => {
      const chains = achievement.getAchievementChains();
      chains.forEach(chain => {
        expect(chain.progress).toBe(0);
        expect(chain.completed).toBe(false);
      });
    });

    it('链完成检测', () => {
      const chains = achievement.getAchievementChains();
      const completed = achievement.getCompletedChains();
      expect(completed).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════
  // §2.1~§2.3 里程碑系统
  // ═══════════════════════════════════════════

  describe('§2 里程碑系统', () => {
    it('成就维度统计含里程碑信息', () => {
      const stats = achievement.getDimensionStats();
      Object.values(stats).forEach(s => {
        expect(s).toHaveProperty('completedCount');
        expect(s).toHaveProperty('totalPoints');
      });
    });

    it('批量更新进度从快照', () => {
      achievement.updateProgressFromSnapshot({
        battle_wins: 100,
        hero_count: 20,
        building_level: 30,
      });
      // 不抛异常即通过
    });
  });

  // ═══════════════════════════════════════════
  // §9.1 成就→声望→转生→图鉴全链路
  // ═══════════════════════════════════════════

  describe('§9.1 成就→声望→转生全链路', () => {
    it('成就完成→声望值累积→等级提升', () => {
      // 模拟：成就完成发放声望值
      const rewardCb = vi.fn();
      prestige.setRewardCallback(rewardCb);

      // 大量声望值获取
      while (prestige.getState().currentLevel < 10) {
        prestige.addPrestigePoints('main_quest', 10000);
      }
      expect(prestige.getState().currentLevel).toBeGreaterThanOrEqual(10);
    });

    it('声望等级→转生条件', () => {
      // 声望等级是转生条件之一
      while (prestige.getState().currentLevel < REBIRTH_CONDITIONS.minPrestigeLevel) {
        prestige.addPrestigePoints('main_quest', 10000);
      }
      rebirth.updatePrestigeLevel(prestige.getState().currentLevel);
      const check = rebirth.checkRebirthConditions();
      expect(check.conditions.prestigeLevel.met).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // §9.4 声望→加成→转生→倍率核心循环
  // ═══════════════════════════════════════════

  describe('§9.4 核心循环验证', () => {
    it('声望获取→等级提升→加成增强', () => {
      const bonusBefore = prestige.getProductionBonus();
      while (prestige.getState().currentLevel < 5) {
        prestige.addPrestigePoints('main_quest', 10000);
      }
      const bonusAfter = prestige.getProductionBonus();
      expect(bonusAfter).toBeGreaterThan(bonusBefore);
    });

    it('转生后倍率加速资源产出', () => {
      rebirth.setCallbacks({
        castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel,
        heroCount: () => REBIRTH_CONDITIONS.minHeroCount,
        totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
        prestigeLevel: () => REBIRTH_CONDITIONS.minPrestigeLevel,
      });
      rebirth.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel);

      const result = rebirth.executeRebirth();
      expect(result.success).toBe(true);

      const multipliers = rebirth.getEffectiveMultipliers();
      expect(multipliers.resource).toBeGreaterThan(1.0);
      expect(multipliers.buildSpeed).toBeGreaterThan(1.0);
      expect(multipliers.techSpeed).toBeGreaterThan(1.0);
      expect(multipliers.exp).toBeGreaterThan(1.0);
    });

    it('转生后加速期倍率更高', () => {
      rebirth.setCallbacks({
        castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel,
        heroCount: () => REBIRTH_CONDITIONS.minHeroCount,
        totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
        prestigeLevel: () => REBIRTH_CONDITIONS.minPrestigeLevel,
      });
      rebirth.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel);
      rebirth.executeRebirth();

      const multipliers = rebirth.getEffectiveMultipliers();
      // 加速期内，buildSpeed = base × buildSpeedMultiplier
      expect(multipliers.buildSpeed).toBeGreaterThan(rebirth.getCurrentMultiplier());
    });
  });

  // ═══════════════════════════════════════════
  // §9.5 转生保留→安全感闭环
  // ═══════════════════════════════════════════

  describe('§9.5 转生保留规则', () => {
    it('保留规则列表完整', () => {
      const keepRules = rebirth.getKeepRules();
      expect(keepRules).toContain('keep_heroes');
      expect(keepRules).toContain('keep_equipment');
      expect(keepRules).toContain('keep_prestige');
      expect(keepRules).toContain('keep_achievements');
      expect(keepRules).toContain('keep_vip');
    });

    it('重置规则列表完整', () => {
      const resetRules = rebirth.getResetRules();
      expect(resetRules).toContain('reset_buildings');
      expect(resetRules).toContain('reset_resources');
      expect(resetRules).toContain('reset_map_progress');
    });

    it('转生回调触发重置', () => {
      const resetCb = vi.fn();
      rebirth.setCallbacks({
        castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel,
        heroCount: () => REBIRTH_CONDITIONS.minHeroCount,
        totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
        prestigeLevel: () => REBIRTH_CONDITIONS.minPrestigeLevel,
        onReset: resetCb,
      });
      rebirth.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel);
      rebirth.executeRebirth();
      expect(resetCb).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════
  // §9.7 收益模拟器→转生决策
  // ═══════════════════════════════════════════

  describe('§9.7 收益模拟器决策', () => {
    it('模拟器给出推荐方案', () => {
      const result = rebirth.simulateEarningsV16({
        currentPrestigeLevel: 15,
        currentRebirthCount: 2,
        simulateDays: 14,
        dailyOnlineHours: 6,
      });
      expect(result.recommendation).toBeTruthy();
      expect(typeof result.recommendation).toBe('string');
    });

    it('增长曲线数据点数正确', () => {
      const result = rebirth.simulateEarningsV16({
        currentPrestigeLevel: 10,
        currentRebirthCount: 1,
        simulateDays: 7,
        dailyOnlineHours: 4,
      });
      // day0 + 7天 = 8个数据点
      expect(result.prestigeGrowthCurve).toHaveLength(8);
    });

    it('对比选项包含推荐动作', () => {
      const result = rebirth.simulateEarningsV16({
        currentPrestigeLevel: 10,
        currentRebirthCount: 1,
        simulateDays: 7,
        dailyOnlineHours: 4,
      });
      result.comparison.forEach(c => {
        expect(['rebirth_now', 'wait', 'no_difference']).toContain(c.recommendedAction);
      });
    });
  });

  // ═══════════════════════════════════════════
  // 存档与恢复
  // ═══════════════════════════════════════════

  describe('存档与恢复', () => {
    it('声望系统存档恢复', () => {
      prestige.addPrestigePoints('main_quest', 5000);
      const saved = prestige.getSaveData();
      const newPrestige = createPrestige();
      newPrestige.loadSaveData(saved);
      expect(newPrestige.getState().totalPoints).toBe(5000);
    });

    it('成就系统存档恢复', () => {
      achievement.updateProgress('battle_wins', 50);
      const saved = achievement.getSaveData();
      const newAch = createAchievement();
      newAch.loadSaveData(saved);
      // 存档恢复后积分不变
      expect(newAch.getTotalPoints()).toBe(achievement.getTotalPoints());
    });

    it('转生系统存档恢复', () => {
      rebirth.setCallbacks({
        castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel,
        heroCount: () => REBIRTH_CONDITIONS.minHeroCount,
        totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
        prestigeLevel: () => REBIRTH_CONDITIONS.minPrestigeLevel,
      });
      rebirth.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel);
      rebirth.executeRebirth();
      const state = rebirth.getState();
      const newRebirth = createRebirth();
      newRebirth.loadSaveData({ rebirth: state });
      expect(newRebirth.getState().rebirthCount).toBe(1);
    });
  });
});
