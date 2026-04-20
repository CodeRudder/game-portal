/**
 * OfflineRewardSystem v9.0 — 功能特性测试
 *
 * 从 OfflineRewardSystem.test.ts 拆分而来
 * 覆盖：翻倍机制、回归面板、加速道具、离线贸易、VIP加成、系统修正系数
 */

import { OfflineRewardSystem } from '../OfflineRewardSystem';
import type {
  DoubleRequest,
} from '../offline.types';

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────

const HOUR_S = 3600;

function makeRates(overrides = {} as Partial<{ grain: number; gold: number; troops: number; mandate: number }>) {
  return { grain: 1, gold: 2, troops: 0.5, mandate: 0, ...overrides };
}

// ─────────────────────────────────────────────
// 测试套件
// ─────────────────────────────────────────────

describe('OfflineRewardSystem v9.0 — 功能特性', () => {
  let system: OfflineRewardSystem;

  beforeEach(() => {
    system = new OfflineRewardSystem();
  });

  // ═══════════════════════════════════════════
  // 1. 翻倍机制
  // ═══════════════════════════════════════════

  describe('翻倍机制', () => {
    it('广告翻倍应将收益翻倍', () => {
      const earned = { grain: 100, gold: 200, troops: 0, mandate: 0 };
      const result = system.applyDouble(earned, {
        source: 'ad',
        multiplier: 2,
        description: '广告翻倍',
      });

      expect(result.success).toBe(true);
      expect(result.doubledEarned.grain).toBe(200);
      expect(result.doubledEarned.gold).toBe(400);
      expect(result.appliedMultiplier).toBe(2);
    });

    it('原始收益不应被修改', () => {
      const earned = { grain: 100, gold: 0, troops: 0, mandate: 0 };
      const result = system.applyDouble(earned, {
        source: 'ad',
        multiplier: 2,
        description: '广告翻倍',
      });

      expect(result.originalEarned.grain).toBe(100);
      expect(earned.grain).toBe(100); // 原始对象不变
    });

    it('VIP翻倍应受每日次数限制', () => {
      const earned = { grain: 100, gold: 0, troops: 0, mandate: 0 };
      const req: DoubleRequest = {
        source: 'vip',
        multiplier: 2,
        description: 'VIP翻倍',
      };

      // VIP0默认每日1次
      const r1 = system.applyDouble(earned, req);
      expect(r1.success).toBe(true);

      // 第二次应失败
      const r2 = system.applyDouble(earned, req);
      expect(r2.success).toBe(false);
      expect(r2.reason).toContain('已用完');
    });

    it('VIP翻倍次数可通过resetVipDailyCount重置', () => {
      const earned = { grain: 100, gold: 0, troops: 0, mandate: 0 };
      const req: DoubleRequest = {
        source: 'vip',
        multiplier: 2,
        description: 'VIP翻倍',
      };

      system.applyDouble(earned, req);
      system.resetVipDailyCount();
      const r2 = system.applyDouble(earned, req);
      expect(r2.success).toBe(true);
    });

    it('回归奖励翻倍应正常工作', () => {
      const earned = { grain: 1000, gold: 0, troops: 0, mandate: 0 };
      const result = system.applyDouble(earned, {
        source: 'return_bonus',
        multiplier: 2,
        description: '回归奖励',
      });

      expect(result.success).toBe(true);
      expect(result.doubledEarned.grain).toBe(2000);
    });

    it('getAvailableDoubles应返回广告翻倍', () => {
      const doubles = system.getAvailableDoubles(3600, 0);
      const adDouble = doubles.find(d => d.source === 'ad');
      expect(adDouble).toBeDefined();
      expect(adDouble!.multiplier).toBe(2);
    });

    it('离线>24h应返回回归奖励翻倍', () => {
      const doubles = system.getAvailableDoubles(25 * HOUR_S, 0);
      const returnDouble = doubles.find(d => d.source === 'return_bonus');
      expect(returnDouble).toBeDefined();
    });

    it('离线<24h不应返回回归奖励翻倍', () => {
      const doubles = system.getAvailableDoubles(23 * HOUR_S, 0);
      const returnDouble = doubles.find(d => d.source === 'return_bonus');
      expect(returnDouble).toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════
  // 2. 回归面板
  // ═══════════════════════════════════════════

  describe('回归面板', () => {
    it('应生成完整的面板数据', () => {
      const panel = system.generateReturnPanel(10 * HOUR_S, makeRates(), 0);

      expect(panel.offlineSeconds).toBe(10 * HOUR_S);
      expect(panel.formattedTime).toContain('10');
      expect(panel.efficiencyPercent).toBeGreaterThan(0);
      expect(panel.tierDetails.length).toBeGreaterThan(0);
      expect(panel.isCapped).toBe(false);
      expect(panel.availableDoubles.length).toBeGreaterThan(0);
    });

    it('格式化时间应正确', () => {
      const panel1 = system.generateReturnPanel(90, makeRates(), 0);
      expect(panel1.formattedTime).toContain('1分钟');

      const panel2 = system.generateReturnPanel(25 * HOUR_S, makeRates(), 0);
      expect(panel2.formattedTime).toContain('1天');
    });
  });

  // ═══════════════════════════════════════════
  // 3. 离线加速道具
  // ═══════════════════════════════════════════

  describe('离线加速道具', () => {
    it('初始道具数量应为0', () => {
      const items = system.getBoostItems();
      expect(items.every(i => i.count === 0)).toBe(true);
    });

    it('添加道具后应能查到', () => {
      system.addBoostItem('offline_boost_1h', 3);
      const items = system.getBoostItems();
      const item = items.find(i => i.id === 'offline_boost_1h');
      expect(item!.count).toBe(3);
    });

    it('使用道具应消耗数量并返回收益', () => {
      const rates = makeRates({ grain: 10 });
      system.addBoostItem('offline_boost_1h', 2);

      const result = system.useBoostItemAction('offline_boost_1h', rates);
      expect(result.success).toBe(true);
      expect(result.addedSeconds).toBe(3600);
      expect(result.addedEarned.grain).toBeCloseTo(36000, 2);
      expect(result.remainingCount).toBe(1);
    });

    it('道具不足时应失败', () => {
      const result = system.useBoostItemAction('offline_boost_1h', makeRates());
      expect(result.success).toBe(false);
      expect(result.reason).toContain('不足');
    });

    it('无效道具ID应失败', () => {
      system.addBoostItem('invalid_item', 1);
      const result = system.useBoostItemAction('invalid_item', makeRates());
      expect(result.success).toBe(false);
      expect(result.reason).toContain('无效');
    });
  });

  // ═══════════════════════════════════════════
  // 4. 离线贸易行为
  // ═══════════════════════════════════════════

  describe('离线贸易行为', () => {
    it('离线不足1小时应无贸易', () => {
      const summary = system.simulateOfflineTrade(1800, { grain: 0, gold: 100, troops: 0, mandate: 0 });
      expect(summary.completedTrades).toBe(0);
      expect(summary.events).toHaveLength(0);
    });

    it('离线1小时应完成1次贸易', () => {
      const profit = { grain: 0, gold: 100, troops: 0, mandate: 0 };
      const summary = system.simulateOfflineTrade(HOUR_S, profit);

      expect(summary.completedTrades).toBe(1);
      expect(summary.events).toHaveLength(1);
      // 100 * 0.6 = 60
      expect(summary.totalProfit.gold).toBeCloseTo(60, 2);
    });

    it('贸易次数不应超过MAX_OFFLINE_TRADES', () => {
      const profit = { grain: 0, gold: 100, troops: 0, mandate: 0 };
      const summary = system.simulateOfflineTrade(10 * HOUR_S, profit);

      expect(summary.completedTrades).toBe(3); // MAX_OFFLINE_TRADES
    });
  });

  // ═══════════════════════════════════════════
  // 5. VIP离线加成
  // ═══════════════════════════════════════════

  describe('VIP离线加成', () => {
    it('VIP0应无效率加成', () => {
      const bonus = system.getVipBonus(0);
      expect(bonus.efficiencyBonus).toBe(0);
    });

    it('VIP3应有15%效率加成', () => {
      const bonus = system.getVipBonus(3);
      expect(bonus.efficiencyBonus).toBeCloseTo(0.15, 3);
    });

    it('VIP5应有25%效率加成', () => {
      const bonus = system.getVipBonus(5);
      expect(bonus.efficiencyBonus).toBeCloseTo(0.25, 3);
    });

    it('applyVipBonus应正确加成', () => {
      const earned = { grain: 1000, gold: 0, troops: 0, mandate: 0 };
      const result = system.applyVipBonus(earned, 3);
      // 1000 + 1000 * 0.15 = 1150
      expect(result.grain).toBeCloseTo(1150, 2);
    });

    it('VIP0加成应返回原始收益', () => {
      const earned = { grain: 500, gold: 0, troops: 0, mandate: 0 };
      const result = system.applyVipBonus(earned, 0);
      expect(result.grain).toBe(500);
    });
  });

  // ═══════════════════════════════════════════
  // 6. 系统差异化修正系数
  // ═══════════════════════════════════════════

  describe('系统差异化修正系数', () => {
    it('resource修正系数应为1.0', () => {
      expect(system.getSystemModifier('resource')).toBe(1.0);
    });

    it('building修正系数应为1.2', () => {
      expect(system.getSystemModifier('building')).toBe(1.2);
    });

    it('tech修正系数应为1.0', () => {
      expect(system.getSystemModifier('tech')).toBe(1.0);
    });

    it('expedition修正系数应为0.85', () => {
      expect(system.getSystemModifier('expedition')).toBe(0.85);
    });

    it('trade修正系数应为0.8', () => {
      expect(system.getSystemModifier('trade')).toBe(0.8);
    });

    it('hero修正系数应为0.5', () => {
      expect(system.getSystemModifier('hero')).toBe(0.5);
    });

    it('campaign修正系数应为0.4', () => {
      expect(system.getSystemModifier('campaign')).toBe(0.4);
    });

    it('未知系统应返回1.0', () => {
      expect(system.getSystemModifier('unknown')).toBe(1.0);
    });

    it('applySystemModifier应正确修正', () => {
      const earned = { grain: 1000, gold: 0, troops: 0, mandate: 0 };
      const modified = system.applySystemModifier(earned, 'building');
      expect(modified.grain).toBe(1200);
    });

    it('getAllSystemModifiers应返回7个系统', () => {
      const modifiers = system.getAllSystemModifiers();
      expect(modifiers).toHaveLength(7);
    });
  });
});
