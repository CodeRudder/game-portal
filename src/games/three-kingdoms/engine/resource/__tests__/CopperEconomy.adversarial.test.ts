/**
 * CopperEconomySystem 对抗式测试
 *
 * 五维度挑战覆盖：
 *   F-Normal: 被动产出、日常任务、关卡通关、商店购买
 *   F-Boundary: 日产出上限、安全线、商店限购
 *   F-Error: 无效输入、重复领取、余额不足
 *   F-Cross: 与ResourceSystem的gold联动
 *   F-Lifecycle: 每日重置、序列化/反序列化
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CopperEconomySystem } from '../copper-economy-system';
import type { CopperEconomyDeps, SpendCategory } from '../copper-economy-system';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

function createMockDeps() {
  return {
    eventBus: { on: vi.fn(), once: vi.fn(), emit: vi.fn(), off: vi.fn(), removeAllListeners: vi.fn() },
    config: { get: vi.fn(), set: vi.fn(), has: vi.fn(() => false) },
    registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(() => new Map()), has: vi.fn(() => false), unregister: vi.fn() },
  };
}

let goldAmount = 10000;
function createEconomyDeps(): CopperEconomyDeps {
  goldAmount = 10000;
  return {
    addGold: vi.fn((amount: number) => {
      goldAmount += amount;
      return amount;
    }),
    consumeGold: vi.fn((amount: number) => {
      if (goldAmount - amount < 500) return false;
      goldAmount -= amount;
      return true;
    }),
    getGoldAmount: vi.fn(() => goldAmount),
    addItem: vi.fn(),
  };
}

function createSystem(): CopperEconomySystem {
  const sys = new CopperEconomySystem();
  sys.init(createMockDeps() as any);
  sys.setEconomyDeps(createEconomyDeps());
  return sys;
}

// ═══════════════════════════════════════════════════════════

describe('CopperEconomySystem 对抗式测试', () => {
  let sys: CopperEconomySystem;

  beforeEach(() => {
    sys = createSystem();
  });

  // ═══════════════════════════════════════════
  // F-Normal: 主线流程
  // ═══════════════════════════════════════════

  describe('[F-Normal] 铜钱经济', () => {
    it('被动产出铜钱', () => {
      sys.tick(1); // 1秒
      expect(sys.getDailyCopperProduced()).toBeGreaterThan(0);
    });

    it('日常任务铜钱领取', () => {
      const reward = sys.claimDailyTaskCopper();
      expect(reward).toBe(2000);
    });

    it('关卡通关铜钱奖励', () => {
      const reward = sys.claimStageClearCopper(10);
      expect(reward).toBe(100 + 10 * 20); // 300
    });

    it('商店购买成功', () => {
      const result = sys.purchaseItem('recruitToken', 1);
      expect(result).toBe(true);
    });

    it('升级消耗', () => {
      const cost = sys.spendOnLevelUp('hero1', 5);
      expect(cost).toBeGreaterThan(0);
    });

    it('升星消耗', () => {
      const cost = sys.spendOnStarUp('hero1', 1);
      expect(cost).toBe(5000);
    });
  });

  // ═══════════════════════════════════════════
  // F-Boundary: 边界条件
  // ═══════════════════════════════════════════

  describe('[F-Boundary] 边界条件', () => {
    it('安全线以下禁止消耗', () => {
      // 设置余额刚好在安全线+1
      goldAmount = 501;
      const result = sys.spendOnLevelUp('hero1', 1);
      expect(result).toBe(0); // 安全线检查失败
    });

    it('商店日消耗上限', () => {
      // SHOP_DAILY_SPEND_LIMIT = 9000
      // recruitToken: price=100, dailyLimit=50
      // 买50个 = 5000 < 9000
      for (let i = 0; i < 50; i++) {
        sys.purchaseItem('recruitToken', 1);
      }
      // 已花5000，还能花4000
      // breakthroughStone: price=2000, dailyLimit=10
      expect(sys.purchaseItem('breakthroughStone', 2)).toBe(true); // +4000 = 9000
      // 再买就超限了
      expect(sys.purchaseItem('expBook', 1)).toBe(false);
    });

    it('商品每日限购', () => {
      // recruitToken dailyLimit=50
      expect(sys.purchaseItem('recruitToken', 50)).toBe(true);
      expect(sys.purchaseItem('recruitToken', 1)).toBe(false); // 超限
    });

    it('关卡等级0无奖励', () => {
      expect(sys.claimStageClearCopper(0)).toBe(0);
    });

    it('关卡等级负数无奖励', () => {
      expect(sys.claimStageClearCopper(-5)).toBe(0);
    });

    it('日常任务只能领取一次', () => {
      expect(sys.claimDailyTaskCopper()).toBe(2000);
      expect(sys.claimDailyTaskCopper()).toBe(0);
    });

    it('购买数量为0失败', () => {
      expect(sys.purchaseItem('recruitToken', 0)).toBe(false);
    });

    it('购买数量为负数失败', () => {
      expect(sys.purchaseItem('recruitToken', -1)).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // F-Error: 异常路径
  // ═══════════════════════════════════════════

  describe('[F-Error] 异常路径', () => {
    it('不存在的商品购买失败', () => {
      expect(sys.purchaseItem('nonexistent', 1)).toBe(false);
    });

    it('空heroId升级消耗返回0', () => {
      expect(sys.spendOnLevelUp('', 5)).toBe(0);
    });

    it('负数等级升级消耗返回0', () => {
      expect(sys.spendOnLevelUp('hero1', -1)).toBe(0);
    });

    it('空heroId升星消耗返回0', () => {
      expect(sys.spendOnStarUp('', 1)).toBe(0);
    });

    it('负数星等升星消耗返回0', () => {
      expect(sys.spendOnStarUp('hero1', -1)).toBe(0);
    });

    it('空heroId突破消耗返回0', () => {
      expect(sys.spendOnBreakthrough('', 1)).toBe(0);
    });

    it('空heroId技能升级返回0', () => {
      expect(sys.spendOnSkillUpgrade('', 1)).toBe(0);
    });

    it('负数技能等级返回0', () => {
      expect(sys.spendOnSkillUpgrade('hero1', 0)).toBe(0);
    });

    it('economyDeps未设置时不崩溃', () => {
      const raw = new CopperEconomySystem();
      raw.init(createMockDeps() as any);
      expect(() => raw.tick(1)).not.toThrow();
      expect(() => raw.claimDailyTaskCopper()).not.toThrow();
      expect(() => raw.purchaseItem('recruitToken', 1)).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════
  // F-Cross: 跨系统交互
  // ═══════════════════════════════════════════

  describe('[F-Cross] 跨系统交互', () => {
    it('消耗分类统计正确', () => {
      sys.spendOnLevelUp('hero1', 5);
      sys.spendOnStarUp('hero1', 1);
      expect(sys.getSpendByCategory('levelUp')).toBeGreaterThan(0);
      expect(sys.getSpendByCategory('starUp')).toBeGreaterThan(0);
    });

    it('经济平衡：日产出-日消耗', () => {
      sys.tick(14400); // 4小时
      sys.claimDailyTaskCopper();
      const produced = sys.getDailyCopperProduced();
      expect(produced).toBeGreaterThan(0);
      expect(sys.getEconomyBalance()).toBeGreaterThan(0);
    });

    it('查询接口返回正确', () => {
      expect(sys.getPassiveRate()).toBe(1.3);
      expect(sys.getShopDailySpendLimit()).toBe(9000);
      expect(sys.getCopperSafetyLine()).toBe(500);
      expect(sys.getShopItemIds().length).toBeGreaterThan(0);
    });

    it('计算接口一致性', () => {
      expect(sys.calculateStageClearCopper(10)).toBe(sys.claimStageClearCopper(10));
      expect(sys.calculateLevelUpCost(5)).toBeGreaterThan(0);
      expect(sys.calculateStarUpCost(1)).toBe(5000);
    });
  });

  // ═══════════════════════════════════════════
  // F-Lifecycle: 数据生命周期
  // ═══════════════════════════════════════════

  describe('[F-Lifecycle] 生命周期', () => {
    it('序列化数据完整', () => {
      sys.tick(100);
      sys.claimDailyTaskCopper();
      const data = sys.serialize();
      expect(data.version).toBe(1);
      expect(data.dailyTaskClaimed).toBe(true);
      expect(data.dailyCopperProduced).toBeGreaterThan(0);
    });

    it('反序列化恢复状态', () => {
      sys.claimDailyTaskCopper();
      const data = sys.serialize();
      const sys2 = createSystem();
      sys2.deserialize(data);
      expect(sys2.getDailyTaskClaimed()).toBe(true);
    });

    it('reset恢复初始状态', () => {
      sys.claimDailyTaskCopper();
      sys.tick(1000);
      sys.reset();
      expect(sys.getDailyTaskClaimed()).toBe(false);
      expect(sys.getDailyCopperProduced()).toBe(0);
      expect(sys.getTotalCopperProduced()).toBe(0);
    });

    it('每日重置清零日统计', () => {
      sys.tick(100);
      sys.claimDailyTaskCopper();
      // 修改lastResetDate触发重置
      const data = sys.serialize();
      data.lastResetDate = '2000-01-01';
      sys.deserialize(data);
      // 触发checkDailyReset（通过getDailyCopperProduced）
      expect(sys.getDailyCopperProduced()).toBe(0);
      expect(sys.getDailyTaskClaimed()).toBe(false);
    });

    it('累计统计不受每日重置影响', () => {
      sys.tick(100);
      const totalBefore = sys.getTotalCopperProduced();
      // 触发每日重置
      const data = sys.serialize();
      data.lastResetDate = '2000-01-01';
      sys.deserialize(data);
      expect(sys.getTotalCopperProduced()).toBe(totalBefore);
    });
  });
});
