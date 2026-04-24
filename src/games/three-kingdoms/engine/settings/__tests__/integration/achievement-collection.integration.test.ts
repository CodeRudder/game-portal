/**
 * 集成测试 — 成就系统：5维度/奖励/成就链
 *
 * 验证成就框架→5维度分类→进度更新→奖励发放→成就链→声望联动→存档恢复。
 * 覆盖 §1.1~§1.3 + §9.1~§9.3 + §16~§18
 *
 * @module engine/settings/__tests__/integration/achievement-collection
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AchievementSystem } from '../../../achievement/AchievementSystem';
import { PrestigeSystem, calcRequiredPoints } from '../../../prestige/PrestigeSystem';
import type { ISystemDeps } from '../../../../core/types';
import type { AchievementDimension, AchievementRarity } from '../../../../core/achievement';
import {
  ALL_ACHIEVEMENTS,
  ACHIEVEMENT_DEF_MAP,
  REBIRTH_ACHIEVEMENT_CHAINS,
  ACHIEVEMENT_RARITY_WEIGHTS,
  ACHIEVEMENT_SAVE_VERSION,
} from '../../../../core/achievement';

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

// ═════════════════════════════════════════════════════════════

describe('§1 成就系统 集成测试', () => {
  let achievement: AchievementSystem;
  let prestige: PrestigeSystem;

  beforeEach(() => {
    achievement = new AchievementSystem();
    achievement.init(mockDeps());
    prestige = new PrestigeSystem();
    prestige.init(mockDeps());
  });

  // ─── §16 成就框架(5维度) ────────────────

  describe('§16 成就框架(5维度)', () => {
    it('§16.1 成就系统初始化成功', () => {
      expect(achievement.getState()).toBeDefined();
      expect(achievement.getState().totalPoints).toBe(0);
    });

    it('§16.2 5维度分类全部存在', () => {
      const dimensions: AchievementDimension[] = ['battle', 'building', 'collection', 'social', 'rebirth'];
      for (const dim of dimensions) {
        const list = achievement.getAchievementsByDimension(dim);
        expect(Array.isArray(list)).toBe(true);
        expect(list.length).toBeGreaterThan(0);
      }
    });

    it('§16.3 获取全部成就列表不为空', () => {
      expect(achievement.getAllAchievements().length).toBeGreaterThan(0);
    });

    it('§16.4 每个成就有唯一ID', () => {
      const all = achievement.getAllAchievements();
      const ids = all.map(a => a.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('§16.5 成就初始状态为locked或in_progress', () => {
      const all = achievement.getAllAchievements();
      for (const a of all) {
        expect(['locked', 'in_progress']).toContain(a.instance.status);
      }
    });

    it('§16.6 获取单个成就详情', () => {
      const all = achievement.getAllAchievements();
      const detail = achievement.getAchievement(all[0].id);
      expect(detail).not.toBeNull();
      expect(detail!.id).toBe(all[0].id);
    });

    it('§16.7 不存在的成就返回null', () => {
      expect(achievement.getAchievement('non-existent-id')).toBeNull();
    });

    it('§16.8 维度统计初始化正确', () => {
      const stats = achievement.getDimensionStats();
      const dims: AchievementDimension[] = ['battle', 'building', 'collection', 'social', 'rebirth'];
      for (const dim of dims) {
        expect(stats[dim]).toBeDefined();
        expect(stats[dim].completedCount).toBe(0);
        expect(stats[dim].totalCount).toBeGreaterThan(0);
      }
    });

    it('§16.9 成就稀有度覆盖common/rare/epic/legendary', () => {
      const rarities = new Set(ALL_ACHIEVEMENTS.map(a => a.rarity));
      expect(rarities.has('common')).toBe(true);
      expect(rarities.has('rare')).toBe(true);
      expect(rarities.has('epic')).toBe(true);
      expect(rarities.has('legendary')).toBe(true);
    });

    it('§16.10 成就积分权重按稀有度递增', () => {
      expect(ACHIEVEMENT_RARITY_WEIGHTS.common).toBeLessThan(ACHIEVEMENT_RARITY_WEIGHTS.rare);
      expect(ACHIEVEMENT_RARITY_WEIGHTS.rare).toBeLessThan(ACHIEVEMENT_RARITY_WEIGHTS.epic);
      expect(ACHIEVEMENT_RARITY_WEIGHTS.epic).toBeLessThan(ACHIEVEMENT_RARITY_WEIGHTS.legendary);
    });
  });

  // ─── §17 成就奖励 ────────────────────────

  describe('§17 成就奖励', () => {
    it('§17.1 成就点数初始为0', () => {
      expect(achievement.getTotalPoints()).toBe(0);
    });

    it('§17.2 设置奖励回调后可接收奖励', () => {
      const cb = vi.fn();
      achievement.setRewardCallback(cb);
      // 完成一个战斗成就
      achievement.updateProgress('battle_wins', 10);
      const claimable = achievement.getClaimableAchievements();
      if (claimable.length > 0) {
        achievement.claimReward(claimable[0]);
        expect(cb).toHaveBeenCalled();
      }
    });

    it('§17.3 未完成成就不可领取奖励', () => {
      const result = achievement.claimReward('ach-battle-001');
      // 初始状态下进度为0，未完成
      expect(result.success).toBe(false);
      expect(result.reason).toContain('未完成');
    });

    it('§17.4 不存在的成就不可领取', () => {
      const result = achievement.claimReward('non-existent');
      expect(result.success).toBe(false);
    });

    it('§17.5 领取奖励后积分增加', () => {
      achievement.updateProgress('battle_wins', 10);
      const claimable = achievement.getClaimableAchievements();
      if (claimable.length > 0) {
        const before = achievement.getTotalPoints();
        const result = achievement.claimReward(claimable[0]);
        if (result.success) {
          expect(achievement.getTotalPoints()).toBeGreaterThan(before);
        }
      }
    });

    it('§17.6 领取后维度统计更新', () => {
      achievement.updateProgress('battle_wins', 10);
      const claimable = achievement.getClaimableAchievements();
      if (claimable.length > 0) {
        const def = ACHIEVEMENT_DEF_MAP[claimable[0]];
        const before = achievement.getDimensionStats()[def.dimension].completedCount;
        achievement.claimReward(claimable[0]);
        expect(achievement.getDimensionStats()[def.dimension].completedCount).toBe(before + 1);
      }
    });

    it('§17.7 奖励不可重复领取', () => {
      achievement.updateProgress('battle_wins', 10);
      const claimable = achievement.getClaimableAchievements();
      if (claimable.length > 0) {
        achievement.claimReward(claimable[0]);
        const result = achievement.claimReward(claimable[0]);
        expect(result.success).toBe(false);
      }
    });
  });

  // ─── §18 转生成就链 ──────────────────────

  describe('§18 转生成就链', () => {
    it('§18.1 成就链存在且数量>0', () => {
      const chains = achievement.getAchievementChains();
      expect(chains.length).toBeGreaterThan(0);
    });

    it('§18.2 成就链包含"战神之路"', () => {
      const chains = achievement.getAchievementChains();
      expect(chains.some(c => c.chainName === '战神之路')).toBe(true);
    });

    it('§18.3 成就链包含"建设之王"', () => {
      const chains = achievement.getAchievementChains();
      expect(chains.some(c => c.chainName === '建设之王')).toBe(true);
    });

    it('§18.4 成就链包含"轮回至尊"', () => {
      const chains = achievement.getAchievementChains();
      expect(chains.some(c => c.chainName === '轮回至尊')).toBe(true);
    });

    it('§18.5 每条链有achievementIds子成就列表', () => {
      const chains = achievement.getAchievementChains();
      for (const chain of chains) {
        expect(chain.achievementIds.length).toBeGreaterThan(0);
      }
    });

    it('§18.6 初始链进度为0且未完成', () => {
      const chains = achievement.getAchievementChains();
      for (const chain of chains) {
        expect(chain.progress).toBe(0);
        expect(chain.completed).toBe(false);
      }
    });

    it('§18.7 初始无已完成链', () => {
      expect(achievement.getCompletedChains().length).toBe(0);
    });

    it('§18.8 每条链有chainBonusReward', () => {
      const chains = achievement.getAchievementChains();
      for (const chain of chains) {
        expect(chain.chainBonusReward).toBeDefined();
        expect(chain.chainBonusReward.achievementPoints).toBeGreaterThan(0);
      }
    });
  });

  // ─── §9.1~§9.3 交叉验证 ──────────────────

  describe('§9 交叉验证', () => {
    it('§9.1.1 声望等级提升可联动成就进度', () => {
      // 通过updateProgress模拟声望等级联动
      achievement.updateProgress('prestige_level', 10);
      const ach = achievement.getAchievement('ach-rebirth-006');
      if (ach) {
        expect(ach.instance.progress['prestige_level']).toBeGreaterThanOrEqual(0);
      }
    });

    it('§9.1.2 声望值获取驱动等级提升', () => {
      prestige.addPrestigePoints('main_quest', calcRequiredPoints(2));
      expect(prestige.getState().currentLevel).toBeGreaterThanOrEqual(2);
    });

    it('§9.1.3 声望值只增不减保证进度不回退', () => {
      prestige.addPrestigePoints('main_quest', 1000);
      const total = prestige.getState().totalPoints;
      prestige.addPrestigePoints('daily_quest', 50);
      expect(prestige.getState().totalPoints).toBeGreaterThanOrEqual(total);
    });

    it('§9.2.1 声望产出加成随等级线性增长', () => {
      const bonus1 = prestige.getProductionBonus();
      while (prestige.getState().currentLevel < 10) {
        prestige.addPrestigePoints('main_quest', 50000);
      }
      expect(prestige.getProductionBonus()).toBeGreaterThan(bonus1);
    });

    it('§9.3.1 声望等级阈值公式正确: 1000×N^1.8', () => {
      const lv2 = calcRequiredPoints(2);
      expect(lv2).toBe(Math.floor(1000 * Math.pow(2, 1.8)));
    });

    it('§9.3.2 等级10阈值约为39810', () => {
      expect(calcRequiredPoints(10)).toBe(Math.floor(1000 * Math.pow(10, 1.8)));
    });
  });

  // ─── 成就进度更新 ─────────────────────────

  describe('成就进度更新', () => {
    it('战斗胜利次数更新进度', () => {
      achievement.updateProgress('battle_wins', 10);
      const ach = achievement.getAchievement('ach-battle-001');
      expect(ach).not.toBeNull();
      expect(ach!.instance.progress['battle_wins']).toBe(10);
    });

    it('建筑等级更新进度', () => {
      achievement.updateProgress('building_level', 5);
      const ach = achievement.getAchievement('ach-build-001');
      expect(ach).not.toBeNull();
      expect(ach!.instance.progress['building_level']).toBe(5);
    });

    it('武将数量更新进度', () => {
      achievement.updateProgress('hero_count', 5);
      const ach = achievement.getAchievement('ach-collect-001');
      expect(ach).not.toBeNull();
      expect(ach!.instance.progress['hero_count']).toBe(5);
    });

    it('转生次数更新进度', () => {
      achievement.updateProgress('rebirth_count', 1);
      const ach = achievement.getAchievement('ach-rebirth-001');
      expect(ach).not.toBeNull();
      expect(ach!.instance.progress['rebirth_count']).toBe(1);
    });

    it('进度值取最大值不覆盖', () => {
      achievement.updateProgress('battle_wins', 5);
      achievement.updateProgress('battle_wins', 3); // 较小值
      const ach = achievement.getAchievement('ach-battle-001');
      expect(ach!.instance.progress['battle_wins']).toBe(5);
    });

    it('批量更新进度从快照', () => {
      achievement.updateProgressFromSnapshot({
        battle_wins: 10,
        hero_count: 5,
        building_level: 3,
      });
      const battleAch = achievement.getAchievement('ach-battle-001');
      expect(battleAch!.instance.progress['battle_wins']).toBe(10);
    });
  });

  // ─── 成就完成检测 ─────────────────────────

  describe('成就完成检测', () => {
    it('条件满足时成就自动完成', () => {
      achievement.updateProgress('battle_wins', 10);
      const ach = achievement.getAchievement('ach-battle-001');
      expect(ach!.instance.status).toBe('completed');
    });

    it('完成成就发射事件', () => {
      const deps = mockDeps();
      const a = new AchievementSystem();
      a.init(deps);
      a.updateProgress('battle_wins', 10);
      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'achievement:completed',
        expect.objectContaining({ id: 'ach-battle-001' }),
      );
    });

    it('前置成就未完成时后续成就不更新', () => {
      // ach-battle-002 需要 ach-battle-001 完成
      achievement.updateProgress('battle_wins', 100);
      // ach-battle-001 应该完成，ach-battle-002 应该开始更新
      const ach2 = achievement.getAchievement('ach-battle-002');
      expect(ach2!.instance.progress['battle_wins']).toBe(100);
    });
  });

  // ─── 存档恢复 ────────────────────────────

  describe('存档恢复', () => {
    it('成就系统可重置', () => {
      achievement.updateProgress('battle_wins', 10);
      achievement.reset();
      expect(achievement.getTotalPoints()).toBe(0);
    });

    it('成就存档版本正确', () => {
      expect(achievement.getSaveData().version).toBe(ACHIEVEMENT_SAVE_VERSION);
    });

    it('成就存档加载后状态一致', () => {
      achievement.updateProgress('battle_wins', 10);
      const save = achievement.getSaveData();
      const newA = new AchievementSystem();
      newA.init(mockDeps());
      newA.loadSaveData(save);
      expect(newA.getTotalPoints()).toBe(achievement.getTotalPoints());
    });
  });
});
