/**
 * OfflineRewardSystem v9.0 — 单元测试
 *
 * 覆盖16个功能点中的离线收益深化模块：
 * - 6档衰减快照
 * - 翻倍机制（广告/道具/VIP/回归奖励）
 * - 回归面板
 * - 离线加速道具
 * - 离线贸易行为
 * - VIP离线加成
 * - 收益上限与溢出
 * - 资源保护机制
 * - 仓库扩容
 * - 系统差异化修正系数
 * - 序列化/反序列化
 */

import { OfflineRewardSystem } from '../OfflineRewardSystem';
import type {
  DoubleRequest,
  OfflineBoostItem,
} from '../offline.types';

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────

const HOUR_S = 3600;

function zeroRes() {
  return { grain: 0, gold: 0, troops: 0, mandate: 0 };
}

function makeRates(overrides = {} as Partial<typeof zeroRes>) {
  return { grain: 1, gold: 2, troops: 0.5, mandate: 0, ...overrides };
}

// ─────────────────────────────────────────────
// 测试套件
// ─────────────────────────────────────────────

describe('OfflineRewardSystem v9.0', () => {
  let system: OfflineRewardSystem;

  beforeEach(() => {
    system = new OfflineRewardSystem();
  });

  // ═══════════════════════════════════════════
  // 1. 6档衰减快照
  // ═══════════════════════════════════════════

  describe('6档衰减快照', () => {
    it('0秒离线应返回空快照', () => {
      const snap = system.calculateSnapshot(0, makeRates());
      expect(snap.offlineSeconds).toBe(0);
      expect(snap.tierDetails).toHaveLength(0);
      expect(snap.totalEarned.grain).toBe(0);
      expect(snap.isCapped).toBe(false);
    });

    it('负数秒应返回空快照', () => {
      const snap = system.calculateSnapshot(-100, makeRates());
      expect(snap.offlineSeconds).toBe(0);
    });

    it('1小时应只使用tier1（100%效率）', () => {
      const rates = makeRates({ grain: 10 });
      const snap = system.calculateSnapshot(1 * HOUR_S, rates);

      expect(snap.tierDetails).toHaveLength(1);
      expect(snap.tierDetails[0].tierId).toBe('tier1');
      expect(snap.tierDetails[0].efficiency).toBe(1.0);
      expect(snap.tierDetails[0].seconds).toBe(3600);
      // grain = 10 * 3600 * 1.0 = 36000
      expect(snap.totalEarned.grain).toBeCloseTo(36000, 2);
    });

    it('3小时应跨tier1和tier2', () => {
      const rates = makeRates({ grain: 10 });
      const snap = system.calculateSnapshot(3 * HOUR_S, rates);

      expect(snap.tierDetails).toHaveLength(2);
      // tier1: 2h * 100% = 72000
      expect(snap.tierDetails[0].earned.grain).toBeCloseTo(72000, 2);
      // tier2: 1h * 80% = 28800
      expect(snap.tierDetails[1].earned.grain).toBeCloseTo(28800, 2);
    });

    it('10小时应跨tier1~tier4', () => {
      const rates = makeRates({ gold: 5 });
      const snap = system.calculateSnapshot(10 * HOUR_S, rates);

      expect(snap.tierDetails).toHaveLength(4);
      // tier1: 2h, tier2: 2h, tier3: 4h, tier4: 2h
      expect(snap.tierDetails[0].seconds).toBe(2 * HOUR_S);
      expect(snap.tierDetails[1].seconds).toBe(2 * HOUR_S);
      expect(snap.tierDetails[2].seconds).toBe(4 * HOUR_S);
      expect(snap.tierDetails[3].seconds).toBe(2 * HOUR_S);
    });

    it('72小时应使用全部6档', () => {
      const rates = makeRates({ grain: 1 });
      const snap = system.calculateSnapshot(72 * HOUR_S, rates);

      expect(snap.tierDetails).toHaveLength(6);
      expect(snap.isCapped).toBe(false);
    });

    it('超过72小时应封顶', () => {
      const rates = makeRates({ grain: 1 });
      const snap = system.calculateSnapshot(100 * HOUR_S, rates);

      expect(snap.isCapped).toBe(true);
      expect(snap.offlineSeconds).toBe(100 * HOUR_S);
      // 但计算只基于72小时
      expect(snap.tierDetails).toHaveLength(6);
    });

    it('综合效率应随时间递减', () => {
      const rates = makeRates({ grain: 1 });
      const snap2h = system.calculateSnapshot(2 * HOUR_S, rates);
      const snap24h = system.calculateSnapshot(24 * HOUR_S, rates);
      const snap72h = system.calculateSnapshot(72 * HOUR_S, rates);

      expect(snap2h.overallEfficiency).toBeGreaterThan(snap24h.overallEfficiency);
      expect(snap24h.overallEfficiency).toBeGreaterThan(snap72h.overallEfficiency);
    });

    it('2小时效率应为100%', () => {
      const rates = makeRates({ grain: 1 });
      const snap = system.calculateSnapshot(2 * HOUR_S, rates);
      expect(snap.overallEfficiency).toBe(1.0);
    });
  });

  // ═══════════════════════════════════════════
  // 2. 翻倍机制
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
  // 3. 回归面板
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
  // 4. 离线加速道具
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
  // 5. 离线贸易行为
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
  // 6. VIP离线加成
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
  // 7. 收益上限与溢出
  // ═══════════════════════════════════════════

  describe('收益上限与溢出', () => {
    it('无上限资源应全部获得', () => {
      const earned = { grain: 0, gold: 1000, troops: 0, mandate: 0 };
      const current = zeroRes();
      const caps = { grain: 500, gold: null, troops: 200, mandate: null };

      const { cappedEarned, overflowResources } = system.applyCapAndOverflow(earned, current, caps);
      expect(cappedEarned.gold).toBe(1000);
      expect(overflowResources.gold).toBe(0);
    });

    it('有上限资源应截断溢出', () => {
      const earned = { grain: 1000, gold: 0, troops: 0, mandate: 0 };
      const current = { grain: 400, gold: 0, troops: 0, mandate: 0 };
      const caps = { grain: 500, gold: null, troops: 200, mandate: null };

      const { cappedEarned, overflowResources } = system.applyCapAndOverflow(earned, current, caps);
      // space = 500 - 400 = 100
      expect(cappedEarned.grain).toBe(100);
      expect(overflowResources.grain).toBe(900);
    });

    it('当前资源已达上限应全部溢出', () => {
      const earned = { grain: 100, gold: 0, troops: 0, mandate: 0 };
      const current = { grain: 500, gold: 0, troops: 0, mandate: 0 };
      const caps = { grain: 500, gold: null, troops: 200, mandate: null };

      const { cappedEarned, overflowResources } = system.applyCapAndOverflow(earned, current, caps);
      expect(cappedEarned.grain).toBe(0);
      expect(overflowResources.grain).toBe(100);
    });
  });

  // ═══════════════════════════════════════════
  // 8. 资源保护机制
  // ═══════════════════════════════════════════

  describe('资源保护机制', () => {
    it('grain应有30%保护', () => {
      const protected_ = system.getResourceProtection('grain', 1000);
      expect(protected_).toBe(300);
    });

    it('grain保护下限为100', () => {
      const protected_ = system.getResourceProtection('grain', 50);
      expect(protected_).toBe(100);
    });

    it('gold应有20%保护（不低于500）', () => {
      const protected_ = system.getResourceProtection('gold', 10000);
      expect(protected_).toBe(2000); // 10000 * 0.2 = 2000 > 500
    });

    it('gold保护下限为500', () => {
      const protected_ = system.getResourceProtection('gold', 100);
      expect(protected_).toBe(500); // max(100*0.2, 500) = 500
    });

    it('troops应有40%保护', () => {
      const protected_ = system.getResourceProtection('troops', 500);
      expect(protected_).toBe(200);
    });

    it('mandate应无保护', () => {
      const protected_ = system.getResourceProtection('mandate', 1000);
      expect(protected_).toBe(0);
    });

    it('applyResourceProtection应正确限制消耗', () => {
      // grain: 1000, protected 300, available 700
      const available = system.applyResourceProtection('grain', 1000, 800);
      expect(available).toBe(700);
    });

    it('请求量小于可用量时应返回请求量', () => {
      const available = system.applyResourceProtection('grain', 1000, 100);
      expect(available).toBe(100);
    });
  });

  // ═══════════════════════════════════════════
  // 9. 仓库扩容
  // ═══════════════════════════════════════════

  describe('仓库扩容', () => {
    it('初始grain容量应为2000', () => {
      expect(system.getWarehouseCapacity('grain')).toBe(2000);
    });

    it('初始troops容量应为500', () => {
      expect(system.getWarehouseCapacity('troops')).toBe(500);
    });

    it('升级后容量应增加', () => {
      const result = system.upgradeWarehouse('grain');
      expect(result.success).toBe(true);
      expect(result.newCapacity).toBe(3000);
      expect(result.newLevel).toBe(2);
    });

    it('连续升级应正确累加', () => {
      system.upgradeWarehouse('grain'); // Lv2: 3000
      system.upgradeWarehouse('grain'); // Lv3: 4000
      expect(system.getWarehouseCapacity('grain')).toBe(4000);
      expect(system.getWarehouseLevel('grain')).toBe(3);
    });

    it('无效资源类型应返回0容量', () => {
      expect(system.getWarehouseCapacity('gold')).toBe(0);
    });

    it('升级无效资源类型应失败', () => {
      const result = system.upgradeWarehouse('gold');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('无效');
    });
  });

  // ═══════════════════════════════════════════
  // 10. 系统差异化修正系数
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

  // ═══════════════════════════════════════════
  // 11. 完整离线收益计算
  // ═══════════════════════════════════════════

  describe('完整离线收益计算', () => {
    it('应返回完整的结果结构', () => {
      const result = system.calculateFullReward(
        10 * HOUR_S,
        makeRates(),
        zeroRes(),
        { grain: 5000, gold: null, troops: 1000, mandate: null },
        0,
      );

      expect(result.snapshot).toBeDefined();
      expect(result.vipBoostedEarned).toBeDefined();
      expect(result.systemModifiedEarned).toBeDefined();
      expect(result.cappedEarned).toBeDefined();
      expect(result.overflowResources).toBeDefined();
      expect(result.tradeSummary).toBeDefined();
      expect(result.panelData).toBeDefined();
    });

    it('VIP加成应叠加到收益上', () => {
      const result0 = system.calculateFullReward(
        10 * HOUR_S,
        makeRates({ grain: 10 }),
        zeroRes(),
        { grain: 999999, gold: null, troops: 999999, mandate: null },
        0,
      );
      const result3 = system.calculateFullReward(
        10 * HOUR_S,
        makeRates({ grain: 10 }),
        zeroRes(),
        { grain: 999999, gold: null, troops: 999999, mandate: null },
        3,
      );

      expect(result3.vipBoostedEarned.grain).toBeGreaterThan(result0.vipBoostedEarned.grain);
    });

    it('系统修正应正确应用', () => {
      const resultBuilding = system.calculateFullReward(
        10 * HOUR_S,
        makeRates({ grain: 10 }),
        zeroRes(),
        { grain: 999999, gold: null, troops: 999999, mandate: null },
        0,
        'building',
      );
      const resultTrade = system.calculateFullReward(
        10 * HOUR_S,
        makeRates({ grain: 10 }),
        zeroRes(),
        { grain: 999999, gold: null, troops: 999999, mandate: null },
        0,
        'trade',
      );

      // trade modifier = 0.8, building = 1.0
      expect(resultTrade.systemModifiedEarned.grain)
        .toBeLessThan(resultBuilding.systemModifiedEarned.grain);
    });
  });

  // ═══════════════════════════════════════════
  // 12. 序列化/反序列化
  // ═══════════════════════════════════════════

  describe('序列化/反序列化', () => {
    it('序列化后反序列化应恢复状态', () => {
      system.addBoostItem('offline_boost_1h', 5);
      system.setLastOfflineTime(12345);

      const data = system.serialize();
      const newSystem = new OfflineRewardSystem();
      newSystem.deserialize(data);

      expect(newSystem.getLastOfflineTime()).toBe(12345);
      const items = newSystem.getBoostItems();
      const item = items.find(i => i.id === 'offline_boost_1h');
      expect(item!.count).toBe(5);
    });

    it('重置应清空所有状态', () => {
      system.addBoostItem('offline_boost_1h', 5);
      system.setLastOfflineTime(12345);
      system.reset();

      expect(system.getLastOfflineTime()).toBe(0);
      const items = system.getBoostItems();
      expect(items.every(i => i.count === 0)).toBe(true);
    });
  });
});
