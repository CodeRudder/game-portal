/**
 * OfflineRewardSystem v9.0 — 集成与序列化测试
 *
 * 从 OfflineRewardSystem.test.ts 拆分而来
 * 覆盖：收益上限与溢出、资源保护、仓库扩容、完整离线收益计算、序列化/反序列化
 */

import { OfflineRewardSystem } from '../OfflineRewardSystem';

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────

const HOUR_S = 3600;

function zeroRes() {
  return { grain: 0, gold: 0, troops: 0, mandate: 0 };
}

function makeRates(overrides = {} as Partial<{ grain: number; gold: number; troops: number; mandate: number }>) {
  return { grain: 1, gold: 2, troops: 0.5, mandate: 0, ...overrides };
}

// ─────────────────────────────────────────────
// 测试套件
// ─────────────────────────────────────────────

describe('OfflineRewardSystem v9.0 — 集成与序列化', () => {
  let system: OfflineRewardSystem;

  beforeEach(() => {
    system = new OfflineRewardSystem();
  });

  // ═══════════════════════════════════════════
  // 1. 收益上限与溢出
  // ═══════════════════════════════════════════

  describe('收益上限与溢出', () => {
    it('无上限资源应全部获得', () => {
      const earned = { grain: 0, gold: 1000, troops: 0, mandate: 0 };
      const current = zeroRes();
      const caps = { grain: 500, gold: 2000, troops: 200, mandate: null };

      const { cappedEarned, overflowResources } = system.applyCapAndOverflow(earned, current, caps);
      expect(cappedEarned.gold).toBe(1000);
      expect(overflowResources.gold).toBe(0);
    });

    it('有上限资源应截断溢出', () => {
      const earned = { grain: 1000, gold: 0, troops: 0, mandate: 0 };
      const current = { grain: 400, gold: 0, troops: 0, mandate: 0 };
      const caps = { grain: 500, gold: 2000, troops: 200, mandate: null };

      const { cappedEarned, overflowResources } = system.applyCapAndOverflow(earned, current, caps);
      // space = 500 - 400 = 100
      expect(cappedEarned.grain).toBe(100);
      expect(overflowResources.grain).toBe(900);
    });

    it('当前资源已达上限应全部溢出', () => {
      const earned = { grain: 100, gold: 0, troops: 0, mandate: 0 };
      const current = { grain: 500, gold: 0, troops: 0, mandate: 0 };
      const caps = { grain: 500, gold: 2000, troops: 200, mandate: null };

      const { cappedEarned, overflowResources } = system.applyCapAndOverflow(earned, current, caps);
      expect(cappedEarned.grain).toBe(0);
      expect(overflowResources.grain).toBe(100);
    });
  });

  // ═══════════════════════════════════════════
  // 2. 资源保护机制
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
  // 3. 仓库扩容
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
  // 4. 完整离线收益计算
  // ═══════════════════════════════════════════

  describe('完整离线收益计算', () => {
    it('应返回完整的结果结构', () => {
      const result = system.calculateFullReward(
        10 * HOUR_S,
        makeRates(),
        zeroRes(),
        { grain: 5000, gold: 2000, troops: 1000, mandate: null },
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
        { grain: 999999, gold: 2000, troops: 999999, mandate: null },
        0,
      );
      const result3 = system.calculateFullReward(
        10 * HOUR_S,
        makeRates({ grain: 10 }),
        zeroRes(),
        { grain: 999999, gold: 2000, troops: 999999, mandate: null },
        3,
      );

      expect(result3.vipBoostedEarned.grain).toBeGreaterThan(result0.vipBoostedEarned.grain);
    });

    it('系统修正应正确应用', () => {
      const resultBuilding = system.calculateFullReward(
        10 * HOUR_S,
        makeRates({ grain: 10 }),
        zeroRes(),
        { grain: 999999, gold: 2000, troops: 999999, mandate: null },
        0,
        'building',
      );
      const resultTrade = system.calculateFullReward(
        10 * HOUR_S,
        makeRates({ grain: 10 }),
        zeroRes(),
        { grain: 999999, gold: 2000, troops: 999999, mandate: null },
        0,
        'trade',
      );

      // trade modifier = 0.8, building = 1.0
      expect(resultTrade.systemModifiedEarned.grain)
        .toBeLessThan(resultBuilding.systemModifiedEarned.grain);
    });
  });

  // ═══════════════════════════════════════════
  // 5. 序列化/反序列化
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
