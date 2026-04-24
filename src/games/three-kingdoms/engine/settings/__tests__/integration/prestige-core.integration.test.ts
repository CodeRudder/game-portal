/**
 * 集成测试 — 声望核心系统 (v14.0)
 *
 * 覆盖：声望等级阈值、声望获取途径(9种)、产出加成公式、声望商店商品、
 *       等级解锁奖励、每日上限、事件驱动升级、存档/读档。
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PrestigeSystem, calcRequiredPoints, calcProductionBonus } from '../../../prestige/PrestigeSystem';
import type { ISystemDeps } from '../../../../core/types';
import type { PrestigeSourceType } from '../../../../core/prestige';
import {
  MAX_PRESTIGE_LEVEL,
  PRESTIGE_BASE,
  PRESTIGE_EXPONENT,
  PRODUCTION_BONUS_PER_LEVEL,
  PRESTIGE_SOURCE_CONFIGS,
  PRESTIGE_SHOP_GOODS,
  LEVEL_UNLOCK_REWARDS,
  PRESTIGE_QUESTS,
  PRESTIGE_SAVE_VERSION,
} from '../../../../core/prestige';

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

function createSystem(): PrestigeSystem {
  const sys = new PrestigeSystem();
  sys.init(mockDeps());
  return sys;
}

// ═══════════════════════════════════════════════════════════════════════

describe('v14.0 声望核心 集成测试', () => {

  // ═══════════════════════════════════════════════════════════════════
  // 1. 声望等级阈值
  // ═══════════════════════════════════════════════════════════════════

  describe('声望等级阈值 (#2)', () => {
    it('calcRequiredPoints: 公式 floor(1000 × N^1.8) 正确', () => {
      expect(calcRequiredPoints(1)).toBe(Math.floor(1000 * Math.pow(1, 1.8)));
      expect(calcRequiredPoints(5)).toBe(Math.floor(1000 * Math.pow(5, 1.8)));
      expect(calcRequiredPoints(10)).toBe(Math.floor(1000 * Math.pow(10, 1.8)));
    });

    it('calcRequiredPoints: level ≤ 0 返回 0', () => {
      expect(calcRequiredPoints(0)).toBe(0);
      expect(calcRequiredPoints(-1)).toBe(0);
    });

    it('等级阈值随等级递增', () => {
      for (let i = 1; i < MAX_PRESTIGE_LEVEL; i++) {
        expect(calcRequiredPoints(i + 1)).toBeGreaterThan(calcRequiredPoints(i));
      }
    });

    it('getLevelInfo 返回正确的等级信息', () => {
      const sys = createSystem();
      const info = sys.getLevelInfo(10);
      expect(info.level).toBe(10);
      expect(info.requiredPoints).toBe(calcRequiredPoints(10));
      expect(info.productionBonus).toBe(calcProductionBonus(10));
      expect(info.title).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 2. 声望获取途径
  // ═══════════════════════════════════════════════════════════════════

  describe('声望获取途径 (#5)', () => {
    it('共 9 种获取途径', () => {
      expect(PRESTIGE_SOURCE_CONFIGS).toHaveLength(9);
    });

    it('addPrestigePoints: 正常获取声望', () => {
      const sys = createSystem();
      const gained = sys.addPrestigePoints('daily_quest', 10);
      expect(gained).toBe(10);
      expect(sys.getState().currentPoints).toBe(10);
      expect(sys.getState().totalPoints).toBe(10);
    });

    it('addPrestigePoints: 每日上限生效', () => {
      const sys = createSystem();
      // daily_quest dailyCap=100
      sys.addPrestigePoints('daily_quest', 80);
      const gained2 = sys.addPrestigePoints('daily_quest', 30);
      expect(gained2).toBe(20); // 100-80=20 remaining
      expect(sys.getState().dailyGained['daily_quest']).toBe(100);
    });

    it('addPrestigePoints: 达到每日上限后返回 0', () => {
      const sys = createSystem();
      sys.addPrestigePoints('daily_quest', 100);
      const gained = sys.addPrestigePoints('daily_quest', 10);
      expect(gained).toBe(0);
    });

    it('addPrestigePoints: dailyCap=-1 无上限', () => {
      const sys = createSystem();
      // main_quest dailyCap=-1
      const gained = sys.addPrestigePoints('main_quest', 9999);
      expect(gained).toBe(9999);
    });

    it('addPrestigePoints: 无效 source 返回 0', () => {
      const sys = createSystem();
      const gained = sys.addPrestigePoints('invalid_source' as PrestigeSourceType, 100);
      expect(gained).toBe(0);
    });

    it('getSourceConfigs 返回全部途径配置', () => {
      const sys = createSystem();
      expect(sys.getSourceConfigs()).toHaveLength(9);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 3. 产出加成
  // ═══════════════════════════════════════════════════════════════════

  describe('产出加成 (#4)', () => {
    it('calcProductionBonus: 公式 1 + level × 0.02', () => {
      expect(calcProductionBonus(0)).toBe(1);
      expect(calcProductionBonus(1)).toBeCloseTo(1.02);
      expect(calcProductionBonus(10)).toBeCloseTo(1.2);
      expect(calcProductionBonus(50)).toBeCloseTo(2.0);
    });

    it('初始等级1产出加成为 1.02', () => {
      const sys = createSystem();
      expect(sys.getProductionBonus()).toBeCloseTo(1 + 1 * PRODUCTION_BONUS_PER_LEVEL);
    });

    it('getPrestigePanel 返回正确的产出加成', () => {
      const sys = createSystem();
      const panel = sys.getPrestigePanel();
      expect(panel.productionBonus).toBeCloseTo(1.02);
      expect(panel.currentLevel).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 4. 自动升级
  // ═══════════════════════════════════════════════════════════════════

  describe('自动升级 (#3)', () => {
    it('声望达到阈值自动升级', () => {
      const sys = createSystem();
      // level 1→2, 需要 calcRequiredPoints(2) 声望
      const needed = calcRequiredPoints(2);
      sys.addPrestigePoints('main_quest', needed);
      expect(sys.getState().currentLevel).toBe(2);
    });

    it('连续多级升级', () => {
      const sys = createSystem();
      // 给足够多声望，连续升级多级
      const massivePoints = calcRequiredPoints(5);
      sys.addPrestigePoints('main_quest', massivePoints);
      expect(sys.getState().currentLevel).toBeGreaterThanOrEqual(5);
    });

    it('不超过 MAX_PRESTIGE_LEVEL(50)', () => {
      const sys = createSystem();
      sys.addPrestigePoints('main_quest', 999_999_999);
      expect(sys.getState().currentLevel).toBe(MAX_PRESTIGE_LEVEL);
    });

    it('升级时触发 levelUp 事件', () => {
      const sys = createSystem();
      const deps = mockDeps();
      sys.init(deps);
      const needed = calcRequiredPoints(2);
      sys.addPrestigePoints('main_quest', needed);
      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'prestige:levelUp',
        expect.objectContaining({ level: 2 }),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 5. 声望商店商品
  // ═══════════════════════════════════════════════════════════════════

  describe('声望商店商品', () => {
    it('商店商品列表非空', () => {
      expect(PRESTIGE_SHOP_GOODS.length).toBeGreaterThan(0);
    });

    it('商品 requiredLevel 范围合法 [1, 50]', () => {
      for (const g of PRESTIGE_SHOP_GOODS) {
        expect(g.requiredLevel).toBeGreaterThanOrEqual(1);
        expect(g.requiredLevel).toBeLessThanOrEqual(MAX_PRESTIGE_LEVEL);
      }
    });

    it('商品 costPoints > 0', () => {
      for (const g of PRESTIGE_SHOP_GOODS) {
        expect(g.costPoints).toBeGreaterThan(0);
      }
    });

    it('商品 ID 唯一', () => {
      const ids = PRESTIGE_SHOP_GOODS.map((g) => g.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('商品类型合法', () => {
      const validTypes = ['resource', 'material', 'buff', 'unlock'];
      for (const g of PRESTIGE_SHOP_GOODS) {
        expect(validTypes).toContain(g.goodsType);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 6. 等级解锁奖励
  // ═══════════════════════════════════════════════════════════════════

  describe('等级解锁奖励 (#7)', () => {
    it('claimLevelReward: 等级不足时拒绝', () => {
      const sys = createSystem();
      const result = sys.claimLevelReward(5);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('等级不足');
    });

    it('claimLevelReward: 等级足够时成功领取', () => {
      const sys = createSystem();
      // 升到等级5
      const needed = calcRequiredPoints(5);
      sys.addPrestigePoints('main_quest', needed);
      const result = sys.claimLevelReward(5);
      expect(result.success).toBe(true);
      expect(result.reward).toBeDefined();
    });

    it('claimLevelReward: 重复领取被拒绝', () => {
      const sys = createSystem();
      const needed = calcRequiredPoints(5);
      sys.addPrestigePoints('main_quest', needed);
      sys.claimLevelReward(5);
      const result = sys.claimLevelReward(5);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('已领取');
    });

    it('claimLevelReward: 无效等级返回失败', () => {
      const sys = createSystem();
      const result = sys.claimLevelReward(999);
      expect(result.success).toBe(false);
    });

    it('getLevelRewards 返回带 claimed 状态', () => {
      const sys = createSystem();
      const rewards = sys.getLevelRewards();
      expect(rewards.length).toBeGreaterThan(0);
      // 初始等级1，只有level=1的奖励可领取
      const level1 = rewards.find((r) => r.level === 1);
      expect(level1).toBeDefined();
      expect(level1!.claimed).toBe(false);
    });

    it('领取时触发 rewardCallback', () => {
      const sys = createSystem();
      const cb = vi.fn();
      sys.setRewardCallback(cb);
      sys.claimLevelReward(1);
      expect(cb).toHaveBeenCalledWith(expect.objectContaining({ gold: 100 }));
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 7. 存档 / 读档
  // ═══════════════════════════════════════════════════════════════════

  describe('存档 / 读档', () => {
    it('getSaveData 包含正确版本号', () => {
      const sys = createSystem();
      const save = sys.getSaveData();
      expect(save.version).toBe(PRESTIGE_SAVE_VERSION);
    });

    it('loadSaveData 恢复状态', () => {
      const sys = createSystem();
      sys.addPrestigePoints('main_quest', 500);
      const save = sys.getSaveData();

      const sys2 = createSystem();
      sys2.loadSaveData(save);
      expect(sys2.getState().totalPoints).toBe(500);
    });

    it('loadSaveData 版本不匹配时忽略', () => {
      const sys = createSystem();
      sys.addPrestigePoints('main_quest', 500);
      const save = sys.getSaveData();
      save.version = 999;

      const sys2 = createSystem();
      sys2.loadSaveData(save);
      expect(sys2.getState().totalPoints).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 8. reset / init
  // ═══════════════════════════════════════════════════════════════════

  describe('reset / init', () => {
    it('reset 恢复初始状态', () => {
      const sys = createSystem();
      sys.addPrestigePoints('main_quest', 9999);
      sys.reset();
      expect(sys.getState().currentPoints).toBe(0);
      expect(sys.getState().currentLevel).toBe(1);
    });

    it('init 注册 prestige:gain 和 calendar:dayChanged 事件', () => {
      const deps = mockDeps();
      const sys = new PrestigeSystem();
      sys.init(deps);
      expect(deps.eventBus.on).toHaveBeenCalledWith('prestige:gain', expect.any(Function));
      expect(deps.eventBus.on).toHaveBeenCalledWith('calendar:dayChanged', expect.any(Function));
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 9. 声望专属任务
  // ═══════════════════════════════════════════════════════════════════

  describe('声望专属任务 (#14)', () => {
    it('getPrestigeQuests: 按当前等级过滤', () => {
      const sys = createSystem();
      // 初始等级1，只有 requiredPrestigeLevel ≤ 1 的任务可见
      const quests = sys.getPrestigeQuests();
      for (const q of quests) {
        expect(q.requiredPrestigeLevel).toBeLessThanOrEqual(1);
      }
    });

    it('等级提升后可见更多任务', () => {
      const sys = createSystem();
      const before = sys.getPrestigeQuests().length;
      const needed = calcRequiredPoints(5);
      sys.addPrestigePoints('main_quest', needed);
      const after = sys.getPrestigeQuests().length;
      expect(after).toBeGreaterThanOrEqual(before);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 10. 转生专属任务
  // ═══════════════════════════════════════════════════════════════════

  describe('转生专属任务 (#15)', () => {
    it('getRebirthQuests: 按转生次数过滤', () => {
      const sys = createSystem();
      // 转生次数0，只有 requiredRebirthCount ≤ 0 的任务
      const quests = sys.getRebirthQuests(0);
      for (const q of quests) {
        expect(q.requiredRebirthCount).toBeLessThanOrEqual(0);
      }
    });

    it('转生次数增加后可见更多任务', () => {
      const sys = createSystem();
      const q0 = sys.getRebirthQuests(0).length;
      const q2 = sys.getRebirthQuests(2).length;
      expect(q2).toBeGreaterThanOrEqual(q0);
    });
  });
});
