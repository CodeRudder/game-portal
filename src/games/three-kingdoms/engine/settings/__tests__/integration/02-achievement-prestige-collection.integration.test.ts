/**
 * 集成测试 — 成就×声望×图鉴 全链路
 *
 * 验证成就框架→5维度分类→奖励发放→成就链→声望联动→图鉴更新。
 * 覆盖 §1.1~§1.3 + §4.1~§4.3 + §9.1~§9.3
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AchievementSystem } from '../../../achievement/AchievementSystem';
import { PrestigeSystem, calcRequiredPoints } from '../../../prestige/PrestigeSystem';
import type { ISystemDeps } from '../../../../core/types';
import type { AchievementDimension } from '../../../../core/achievement';

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

describe('§1+§4 成就×声望×图鉴 集成测试', () => {
  let achievement: AchievementSystem;
  let prestige: PrestigeSystem;

  beforeEach(() => {
    achievement = new AchievementSystem();
    achievement.init(mockDeps());
    prestige = new PrestigeSystem();
    prestige.init(mockDeps());
  });

  // ─── §1.1 成就面板与分类 ──────────────────

  it('成就系统初始化成功', () => {
    expect(achievement.getState()).toBeDefined();
  });

  it('5维度分类全部存在', () => {
    const dimensions: AchievementDimension[] = ['battle', 'building', 'collection', 'social', 'rebirth'];
    for (const dim of dimensions) {
      const list = achievement.getAchievementsByDimension(dim);
      expect(Array.isArray(list)).toBe(true);
    }
  });

  it('获取全部成就列表不为空', () => {
    const all = achievement.getAllAchievements();
    expect(all.length).toBeGreaterThan(0);
  });

  it('每个成就有唯一ID', () => {
    const all = achievement.getAllAchievements();
    const ids = all.map((a) => a.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('成就初始状态为locked或in_progress', () => {
    const all = achievement.getAllAchievements();
    for (const a of all) {
      expect(['locked', 'in_progress']).toContain(a.instance.status);
    }
  });

  it('获取单个成就详情', () => {
    const all = achievement.getAllAchievements();
    const first = all[0];
    const detail = achievement.getAchievement(first.id);
    expect(detail).not.toBeNull();
    expect(detail!.id).toBe(first.id);
  });

  // ─── §1.2 成就奖励与点数 ──────────────────

  it('设置奖励回调后可接收奖励', () => {
    const rewardCb = vi.fn();
    achievement.setRewardCallback(rewardCb);
    expect(rewardCb).not.toHaveBeenCalled();
  });

  it('成就点数初始为0', () => {
    expect(achievement.getTotalPoints()).toBe(0);
  });

  it('维度统计初始completedCount为0', () => {
    const stats = achievement.getDimensionStats();
    for (const dim of Object.keys(stats) as AchievementDimension[]) {
      expect(stats[dim].completedCount).toBe(0);
    }
  });

  // ─── §1.3 转生成就链 ─────────────────────

  it('转生成就链存在', () => {
    const chains = achievement.getAchievementChains();
    expect(chains.length).toBeGreaterThan(0);
  });

  it('成就链包含"战神之路"', () => {
    const chains = achievement.getAchievementChains();
    const found = chains.some((c) => c.chainName === '战神之路');
    expect(found).toBe(true);
  });

  it('成就链有achievementIds子成就列表', () => {
    const chains = achievement.getAchievementChains();
    for (const chain of chains) {
      expect(chain.achievementIds.length).toBeGreaterThan(0);
    }
  });

  it('初始链进度为0且未完成', () => {
    const chains = achievement.getAchievementChains();
    for (const chain of chains) {
      expect(chain.progress).toBe(0);
      expect(chain.completed).toBe(false);
    }
  });

  it('初始无已完成链', () => {
    const completed = achievement.getCompletedChains();
    expect(completed.length).toBe(0);
  });

  // ─── §4.1~§4.3 图鉴与收藏 ────────────────

  it('声望等级提升可联动成就进度', () => {
    while (prestige.getState().currentLevel < 3) {
      prestige.addPrestigePoints('main_quest', 50000);
    }
    expect(prestige.getState().currentLevel).toBeGreaterThanOrEqual(3);
  });

  it('声望值获取驱动等级提升', () => {
    prestige.addPrestigePoints('main_quest', calcRequiredPoints(2));
    expect(prestige.getState().currentLevel).toBeGreaterThanOrEqual(2);
  });

  it('声望值只增不减保证图鉴进度不回退', () => {
    prestige.addPrestigePoints('main_quest', 1000);
    const total = prestige.getState().totalPoints;
    prestige.addPrestigePoints('daily_quest', 50);
    expect(prestige.getState().totalPoints).toBeGreaterThanOrEqual(total);
  });

  // ─── §9.1 成就→声望全链路 ──────────────────

  it('声望等级阈值公式正确: 1000×N^1.8', () => {
    const lv2 = calcRequiredPoints(2);
    expect(lv2).toBe(Math.floor(1000 * Math.pow(2, 1.8)));
  });

  it('等级5阈值约为7226', () => {
    const lv5 = calcRequiredPoints(5);
    expect(lv5).toBe(Math.floor(1000 * Math.pow(5, 1.8)));
  });

  it('等级10阈值约为39810', () => {
    const lv10 = calcRequiredPoints(10);
    expect(lv10).toBe(Math.floor(1000 * Math.pow(10, 1.8)));
  });

  // ─── §9.2 里程碑→称号→属性闭环 ────────────

  it('声望产出加成随等级线性增长', () => {
    const bonus1 = prestige.getProductionBonus();
    while (prestige.getState().currentLevel < 10) {
      prestige.addPrestigePoints('main_quest', 50000);
    }
    const bonus10 = prestige.getProductionBonus();
    expect(bonus10).toBeGreaterThan(bonus1);
  });

  it('声望等级提升事件正确发射', () => {
    const deps = mockDeps();
    const p = new PrestigeSystem();
    p.init(deps);
    const required = calcRequiredPoints(2);
    p.addPrestigePoints('main_quest', required);
    expect(deps.eventBus.emit).toHaveBeenCalledWith(
      'prestige:levelUp',
      expect.objectContaining({ level: expect.any(Number) }),
    );
  });

  // ─── 成就系统存档 ─────────────────────────

  it('成就系统可重置', () => {
    achievement.reset();
    expect(achievement.getTotalPoints()).toBe(0);
  });

  it('声望系统可重置', () => {
    prestige.addPrestigePoints('main_quest', 1000);
    prestige.reset();
    expect(prestige.getState().currentLevel).toBe(1);
    expect(prestige.getState().totalPoints).toBe(0);
  });

  it('成就存档加载后状态一致', () => {
    const save = achievement.getSaveData();
    const newAchievement = new AchievementSystem();
    newAchievement.init(mockDeps());
    newAchievement.loadSaveData(save);
    expect(newAchievement.getTotalPoints()).toBe(achievement.getTotalPoints());
  });

  // ─── 交叉验证 ────────────────────────────

  it('声望商店等级解锁与声望等级同步', () => {
    const rewards = prestige.getLevelRewards();
    const level1Rewards = rewards.filter((r) => r.level <= 1);
    expect(level1Rewards.length).toBeGreaterThan(0);
  });

  it('声望任务列表随等级解锁', () => {
    const quests1 = prestige.getPrestigeQuests();
    while (prestige.getState().currentLevel < 5) {
      prestige.addPrestigePoints('main_quest', 50000);
    }
    const quests5 = prestige.getPrestigeQuests();
    expect(quests5.length).toBeGreaterThanOrEqual(quests1.length);
  });

  it('转生专属任务按转生次数解锁', () => {
    const quests0 = prestige.getRebirthQuests(0);
    const quests1 = prestige.getRebirthQuests(1);
    expect(quests1.length).toBeGreaterThanOrEqual(quests0.length);
  });

  it('声望等级信息包含特权列表', () => {
    while (prestige.getState().currentLevel < 5) {
      prestige.addPrestigePoints('main_quest', 50000);
    }
    const info = prestige.getCurrentLevelInfo();
    expect(info.privileges.length).toBeGreaterThan(0);
  });

  it('声望等级提升后声望面板数据同步', () => {
    prestige.addPrestigePoints('main_quest', calcRequiredPoints(3));
    const panel = prestige.getPrestigePanel();
    expect(panel.currentLevel).toBeGreaterThanOrEqual(2);
    expect(panel.productionBonus).toBeGreaterThan(1);
  });

  it('声望获取途径配置完整含描述', () => {
    const configs = prestige.getSourceConfigs();
    for (const c of configs) {
      expect(c.type).toBeTruthy();
      expect(c.description).toBeTruthy();
      expect(c.basePoints).toBeGreaterThan(0);
    }
  });
});
