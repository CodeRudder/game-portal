/**
 * BarracksTrainingSystem 单元测试
 *
 * 覆盖：
 * - 普通训练：消耗grain×500→获得100兵力
 * - 加速训练：消耗grain×1000→获得150兵力(+50%)
 * - 精英训练：消耗grain×2500+gold×1000→获得200兵力(+100%)
 * - 粮草不足时训练失败
 * - 铜钱不足时精英训练失败
 * - 训练效率查询
 * - 序列化/反序列化
 */

import { BarracksTrainingSystem } from '../BarracksTrainingSystem';

// ── 辅助：创建 mock 资源系统 ──
function makeResources(initialGrain: number, initialGold: number) {
  const resources: Record<string, number> = {
    grain: initialGrain,
    gold: initialGold,
  };

  return {
    getResource: (type: string) => resources[type] ?? 0,
    spendResource: (type: string, amount: number): boolean => {
      if ((resources[type] ?? 0) < amount) return false;
      resources[type] -= amount;
      return true;
    },
    getRemaining: (type: string) => resources[type] ?? 0,
  };
}

describe('BarracksTrainingSystem', () => {
  let system: BarracksTrainingSystem;
  let resources: ReturnType<typeof makeResources>;

  beforeEach(() => {
    system = new BarracksTrainingSystem();
    resources = makeResources(10000, 5000);
    system.init(1, resources.getResource, resources.spendResource);
  });

  // ═══════════════════════════════════════════
  // 1. 普通训练
  // ═══════════════════════════════════════════
  describe('普通训练', () => {
    it('消耗grain×500→获得100兵力', () => {
      const result = system.train('normal', 100);

      expect(result.success).toBe(true);
      expect(result.troopsGained).toBe(100);
      expect(result.cost.grain).toBe(500);
      expect(result.cost.gold).toBeUndefined();
      expect(resources.getRemaining('grain')).toBe(9500);
    });

    it('普通训练效率为1.0', () => {
      expect(system.getTrainingEfficiency('normal')).toBe(1.0);
    });
  });

  // ═══════════════════════════════════════════
  // 2. 加速训练
  // ═══════════════════════════════════════════
  describe('加速训练', () => {
    it('消耗grain×1000→获得150兵力(+50%)', () => {
      const result = system.train('accelerated', 100);

      expect(result.success).toBe(true);
      expect(result.troopsGained).toBe(150);
      expect(result.cost.grain).toBe(1000);
      expect(resources.getRemaining('grain')).toBe(9000);
    });

    it('加速训练效率为1.5', () => {
      expect(system.getTrainingEfficiency('accelerated')).toBe(1.5);
    });
  });

  // ═══════════════════════════════════════════
  // 3. 精英训练
  // ═══════════════════════════════════════════
  describe('精英训练', () => {
    it('消耗grain×2500+gold×1000→获得200兵力(+100%)', () => {
      const result = system.train('elite', 100);

      expect(result.success).toBe(true);
      expect(result.troopsGained).toBe(200);
      expect(result.cost.grain).toBe(2500);
      expect(result.cost.gold).toBe(1000);
      expect(resources.getRemaining('grain')).toBe(7500);
      expect(resources.getRemaining('gold')).toBe(4000);
    });

    it('精英训练效率为2.0', () => {
      expect(system.getTrainingEfficiency('elite')).toBe(2.0);
    });
  });

  // ═══════════════════════════════════════════
  // 4. 资源不足
  // ═══════════════════════════════════════════
  describe('资源不足', () => {
    it('粮草不足时训练失败', () => {
      const poorResources = makeResources(100, 5000);
      system.init(1, poorResources.getResource, poorResources.spendResource);

      const result = system.train('normal', 100);

      expect(result.success).toBe(false);
      expect(result.troopsGained).toBe(0);
      expect(result.reason).toBe('粮草不足');
    });

    it('铜钱不足时精英训练失败', () => {
      const poorGold = makeResources(10000, 500);
      system.init(1, poorGold.getResource, poorGold.spendResource);

      const result = system.train('elite', 100);

      expect(result.success).toBe(false);
      expect(result.troopsGained).toBe(0);
      expect(result.reason).toBe('铜钱不足');
    });
  });

  // ═══════════════════════════════════════════
  // 5. 训练效率查询
  // ═══════════════════════════════════════════
  describe('训练效率查询', () => {
    it('未知模式返回默认1.0', () => {
      expect(system.getTrainingEfficiency('unknown')).toBe(1.0);
    });

    it('所有模式效率正确', () => {
      expect(system.getTrainingEfficiency('normal')).toBe(1.0);
      expect(system.getTrainingEfficiency('accelerated')).toBe(1.5);
      expect(system.getTrainingEfficiency('elite')).toBe(2.0);
    });
  });

  // ═══════════════════════════════════════════
  // 6. 消耗查询
  // ═══════════════════════════════════════════
  describe('消耗查询', () => {
    it('普通训练消耗grain= troopCount×5', () => {
      const cost = system.getTrainingCost('normal', 50);
      expect(cost.grain).toBe(250);
      expect(cost.gold).toBeUndefined();
    });

    it('加速训练消耗grain= troopCount×10', () => {
      const cost = system.getTrainingCost('accelerated', 50);
      expect(cost.grain).toBe(500);
    });

    it('精英训练消耗grain= troopCount×25 + gold=1000', () => {
      const cost = system.getTrainingCost('elite', 50);
      expect(cost.grain).toBe(1250);
      expect(cost.gold).toBe(1000);
    });
  });

  // ═══════════════════════════════════════════
  // 7. 序列化/反序列化
  // ═══════════════════════════════════════════
  describe('序列化/反序列化', () => {
    it('序列化后反序列化恢复状态', () => {
      system.train('normal', 100);
      system.train('elite', 50);

      const data = system.serialize();
      const newSystem = new BarracksTrainingSystem();
      newSystem.deserialize(data);

      const stats = newSystem.getStats();
      expect(stats.totalTroopsTrained).toBe(200); // 100 + 100(50×2.0)
      expect(stats.totalGrainSpent).toBe(1750);   // 500 + 1250
      expect(stats.totalGoldSpent).toBe(1000);    // 1000
    });

    it('反序列化无效数据不崩溃', () => {
      expect(() => system.deserialize('invalid json')).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════
  // 8. 重置
  // ═══════════════════════════════════════════
  describe('重置', () => {
    it('重置后统计数据清零', () => {
      system.train('normal', 100);
      system.reset();

      const stats = system.getStats();
      expect(stats.totalTroopsTrained).toBe(0);
      expect(stats.totalGrainSpent).toBe(0);
      expect(stats.totalGoldSpent).toBe(0);
    });

    it('重置后兵营等级恢复为1', () => {
      system.init(10, resources.getResource, resources.spendResource);
      expect(system.getBarracksLevel()).toBe(10);

      system.reset();
      expect(system.getBarracksLevel()).toBe(1);
    });
  });

  // ═══════════════════════════════════════════
  // 9. 参数校验
  // ═══════════════════════════════════════════
  describe('参数校验', () => {
    it('训练数量为0时失败', () => {
      const result = system.train('normal', 0);
      expect(result.success).toBe(false);
      expect(result.reason).toBe('训练兵力数量必须大于0');
    });

    it('未初始化时训练失败', () => {
      const uninitialized = new BarracksTrainingSystem();
      const result = uninitialized.train('normal', 100);
      expect(result.success).toBe(false);
      expect(result.reason).toBe('系统未初始化');
    });
  });
});
