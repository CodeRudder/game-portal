/**
 * 对抗式测试 — 科技点边界与消耗
 *
 * 维度：F-Boundary + F-Error
 * 重点：科技点刚好/差1、负数/零值/溢出、兑换边界
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TechPointSystem } from '../TechPointSystem';
import { TechTreeSystem } from '../TechTreeSystem';
import { TechResearchSystem } from '../TechResearchSystem';
import { createRealDeps } from '../../../test-utils/test-helpers';

describe('对抗式测试: 科技点边界与消耗', () => {
  let pointSys: TechPointSystem;
  let treeSys: TechTreeSystem;
  let researchSys: TechResearchSystem;
  let baseTime: number;
  let currentTime: number;

  beforeEach(() => {
    vi.restoreAllMocks();
    baseTime = 1_000_000_000_000;
    currentTime = baseTime;
    vi.spyOn(Date, 'now').mockReturnValue(currentTime);

    pointSys = new TechPointSystem();
    treeSys = new TechTreeSystem();
    let goldAmount = 1000000;
    researchSys = new TechResearchSystem(
      treeSys, pointSys, () => 20, () => 100, () => true,
      () => goldAmount,
      (amt: number) => { goldAmount -= amt; return true; },
    );
    const deps = createRealDeps();
    pointSys.init(deps);
    treeSys.init(deps);
    researchSys.init(deps);
  });

  afterEach(() => vi.restoreAllMocks());

  function advanceTime(ms: number) {
    currentTime += ms;
    vi.spyOn(Date, 'now').mockReturnValue(currentTime);
  }

  // ═══════════════════════════════════════════
  // 科技点刚好够/差1
  // ═══════════════════════════════════════════
  describe('科技点刚好/差1', () => {
    it('科技点刚好50 → 可以研究 mil_t1_attack（cost=50×10=500）', () => {
      // 直接通过 exchange 充入精确点数（实际消耗 = 50 × 10 = 500）
      pointSys.exchangeGoldForTechPoints(50000, 10); // 50000/100 = 500
      expect(pointSys.getCurrentPoints()).toBeCloseTo(500, 0);
      const result = researchSys.startResearch('mil_t1_attack');
      expect(result.success).toBe(true);
    });

    it('科技点49.99 → 无法研究 mil_t1_attack（cost=50）', () => {
      // 充入 4999 铜钱 = 49.99 科技点
      pointSys.exchangeGoldForTechPoints(4999, 10);
      expect(pointSys.getCurrentPoints()).toBeCloseTo(49.99, 1);
      const result = researchSys.startResearch('mil_t1_attack');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('不足');
    });

    it('科技点0 → 无法研究任何科技', () => {
      expect(pointSys.getCurrentPoints()).toBe(0);
      const result = researchSys.startResearch('mil_t1_attack');
      expect(result.success).toBe(false);
    });

    it('科技点刚好够Tier4（cost=800×10=8000）', () => {
      pointSys.exchangeGoldForTechPoints(800000, 10); // 800000/100 = 8000
      // 需要先完成前置链
      // 直接设置节点完成状态
      treeSys.completeNode('mil_t1_attack');
      treeSys.completeNode('mil_t2_charge');
      treeSys.completeNode('mil_t3_blitz');
      const result = researchSys.startResearch('mil_t4_dominance');
      expect(result.success).toBe(true);
      expect(pointSys.getCurrentPoints()).toBeCloseTo(0, 0);
    });
  });

  // ═══════════════════════════════════════════
  // 负数/零值输入
  // ═══════════════════════════════════════════
  describe('负数/零值输入', () => {
    it('spend(0) 不改变科技点', () => {
      pointSys.exchangeGoldForTechPoints(1000, 10);
      const before = pointSys.getCurrentPoints();
      pointSys.spend(0);
      expect(pointSys.getCurrentPoints()).toBeCloseTo(before, 5);
    });

    it('spend(负数) 不会让科技点变负', () => {
      pointSys.exchangeGoldForTechPoints(1000, 10);
      const before = pointSys.getCurrentPoints();
      pointSys.spend(-10);
      // spend 内部: current -= (-10) = current + 10, 然后 Math.max(0, ...)
      // totalSpent += -10 会让 totalSpent 减少
      expect(pointSys.getCurrentPoints()).toBeGreaterThanOrEqual(0);
    });

    it('refund(0) 不改变科技点', () => {
      pointSys.exchangeGoldForTechPoints(1000, 10);
      const before = pointSys.getCurrentPoints();
      pointSys.refund(0);
      expect(pointSys.getCurrentPoints()).toBeCloseTo(before, 5);
    });

    it('refund(负数) 不会让科技点变负', () => {
      pointSys.exchangeGoldForTechPoints(1000, 10);
      pointSys.refund(-100);
      expect(pointSys.getCurrentPoints()).toBeGreaterThanOrEqual(0);
    });

    it('trySpend(0) 应成功', () => {
      const result = pointSys.trySpend(0);
      expect(result.success).toBe(true);
    });

    it('trySpend(负数) 应失败（FIX-501: 负数被拒绝）', () => {
      const result = pointSys.trySpend(-10);
      expect(result.success).toBe(false);
    });

    it('canAfford(0) 返回 true', () => {
      expect(pointSys.canAfford(0)).toBe(true);
    });

    it('canAfford(负数) 返回 false（FIX-501: 负数被拒绝）', () => {
      expect(pointSys.canAfford(-10)).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // 极大值/溢出
  // ═══════════════════════════════════════════
  describe('极大值/溢出', () => {
    it('exchangeGoldForTechPoints 极大值', () => {
      const result = pointSys.exchangeGoldForTechPoints(Number.MAX_SAFE_INTEGER, 10);
      expect(result.success).toBe(true);
      expect(pointSys.getCurrentPoints()).toBeGreaterThan(0);
    });

    it('多次 exchange 累积', () => {
      for (let i = 0; i < 100; i++) {
        pointSys.exchangeGoldForTechPoints(10000, 10);
      }
      expect(pointSys.getCurrentPoints()).toBeCloseTo(10000, 0);
      expect(pointSys.getTotalEarned()).toBeCloseTo(10000, 0);
    });
  });

  // ═══════════════════════════════════════════
  // 铜钱兑换边界
  // ═══════════════════════════════════════════
  describe('铜钱兑换边界', () => {
    it('书院等级 < 5 不能兑换', () => {
      const check = pointSys.canExchange(4);
      expect(check.can).toBe(false);
      expect(check.reason).toContain('书院等级不足');
    });

    it('书院等级 = 5 可以兑换', () => {
      const check = pointSys.canExchange(5);
      expect(check.can).toBe(true);
    });

    it('书院等级 > 5 可以兑换', () => {
      const check = pointSys.canExchange(20);
      expect(check.can).toBe(true);
    });

    it('铜钱数量 = 0 不能兑换', () => {
      const result = pointSys.exchangeGoldForTechPoints(0, 10);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('大于0');
    });

    it('铜钱数量 < 0 不能兑换', () => {
      const result = pointSys.exchangeGoldForTechPoints(-100, 10);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('大于0');
    });

    it('铜钱数量 = 100 刚好兑换 1 科技点', () => {
      const result = pointSys.exchangeGoldForTechPoints(100, 10);
      expect(result.success).toBe(true);
      expect(result.pointsGained).toBeCloseTo(1, 5);
      expect(result.goldSpent).toBe(100);
    });

    it('铜钱数量 = 1 兑换 0.01 科技点', () => {
      const result = pointSys.exchangeGoldForTechPoints(1, 10);
      expect(result.success).toBe(true);
      expect(result.pointsGained).toBeCloseTo(0.01, 5);
    });

    it('兑换比率验证: 100铜钱 = 1科技点', () => {
      expect(TechPointSystem.EXCHANGE_RATE).toBe(100);
    });

    it('最低书院等级验证: Lv5', () => {
      expect(TechPointSystem.EXCHANGE_MIN_ACADEMY_LEVEL).toBe(5);
    });
  });

  // ═══════════════════════════════════════════
  // 科技点产出
  // ═══════════════════════════════════════════
  describe('科技点产出', () => {
    it('书院等级 0 → 不产出', () => {
      pointSys.syncAcademyLevel(0);
      pointSys.update(100);
      expect(pointSys.getCurrentPoints()).toBe(0);
    });

    it('书院等级 1 → 0.01/秒', () => {
      pointSys.syncAcademyLevel(1);
      pointSys.update(100); // 100秒
      expect(pointSys.getCurrentPoints()).toBeCloseTo(1, 3);
    });

    it('书院等级 20 → 1.76/秒', () => {
      pointSys.syncAcademyLevel(20);
      pointSys.update(100); // 100秒
      expect(pointSys.getCurrentPoints()).toBeCloseTo(176, 1);
    });

    it('getProductionRate 返回正确值', () => {
      pointSys.syncAcademyLevel(0);
      expect(pointSys.getProductionRate()).toBe(0);
      pointSys.syncAcademyLevel(1);
      expect(pointSys.getProductionRate()).toBeCloseTo(0.01, 3);
      pointSys.syncAcademyLevel(20);
      expect(pointSys.getProductionRate()).toBeCloseTo(1.76, 3);
    });

    it('未同步书院等级时不产出', () => {
      pointSys.update(1000);
      expect(pointSys.getCurrentPoints()).toBe(0);
    });
  });

  // ═══════════════════════════════════════════
  // 研究速度加成
  // ═══════════════════════════════════════════
  describe('研究速度加成', () => {
    it('无加成时 multiplier = 1.0', () => {
      expect(pointSys.getResearchSpeedMultiplier()).toBeCloseTo(1.0, 5);
    });

    it('+50% 加成时 multiplier = 1.5', () => {
      pointSys.syncResearchSpeedBonus(50);
      expect(pointSys.getResearchSpeedMultiplier()).toBeCloseTo(1.5, 5);
    });

    it('+100% 加成时 multiplier = 2.0', () => {
      pointSys.syncResearchSpeedBonus(100);
      expect(pointSys.getResearchSpeedMultiplier()).toBeCloseTo(2.0, 5);
    });

    it('负数加成时 multiplier 被钳位到 1.0（FIX-501: 负值防护）', () => {
      pointSys.syncResearchSpeedBonus(-50);
      expect(pointSys.getResearchSpeedMultiplier()).toBeCloseTo(1.0, 5);
    });

    it('研究速度加成影响实际研究时间', () => {
      pointSys.exchangeGoldForTechPoints(100000, 10); // 1000 points, enough for 50*10=500
      pointSys.syncResearchSpeedBonus(100); // 2x速度
      // academyLevel=20 → academySpeed = 1 + 20*0.1 = 3.0
      // totalSpeed = 2.0 * 3.0 = 6.0, duration = 120 / 6 = 20秒
      researchSys.startResearch('mil_t1_attack');
      const slot = researchSys.getQueue()[0];
      const duration = (slot.endTime - slot.startTime) / 1000;
      expect(duration).toBeCloseTo(20, -1);
    });
  });

  // ═══════════════════════════════════════════
  // 取消研究返还科技点
  // ═══════════════════════════════════════════
  describe('取消研究返还科技点', () => {
    it('取消后科技点恢复到研究前', () => {
      pointSys.exchangeGoldForTechPoints(100000, 10); // 1000 points
      const before = pointSys.getCurrentPoints();
      researchSys.startResearch('mil_t1_attack');
      expect(pointSys.getCurrentPoints()).toBeCloseTo(before - 50 * 10, 1);

      researchSys.cancelResearch('mil_t1_attack');
      expect(pointSys.getCurrentPoints()).toBeCloseTo(before, 1);
    });

    it('取消不存在的科技不返还', () => {
      pointSys.exchangeGoldForTechPoints(10000, 10);
      const before = pointSys.getCurrentPoints();
      const result = researchSys.cancelResearch('nonexistent');
      expect(result.success).toBe(false);
      expect(result.refundPoints).toBe(0);
      expect(pointSys.getCurrentPoints()).toBeCloseTo(before, 5);
    });
  });

  // ═══════════════════════════════════════════
  // 序列化
  // ═══════════════════════════════════════════
  describe('科技点序列化', () => {
    it('序列化/反序列化保持科技点状态', () => {
      pointSys.exchangeGoldForTechPoints(5000, 10);
      pointSys.spend(20);
      const data = pointSys.serialize();

      const newSys = new TechPointSystem();
      newSys.init(createRealDeps());
      newSys.deserialize(data);

      expect(newSys.getCurrentPoints()).toBeCloseTo(pointSys.getCurrentPoints(), 5);
      expect(newSys.getTotalEarned()).toBeCloseTo(pointSys.getTotalEarned(), 5);
      expect(newSys.getTotalSpent()).toBeCloseTo(pointSys.getTotalSpent(), 5);
    });

    it('reset 清空科技点', () => {
      pointSys.exchangeGoldForTechPoints(5000, 10);
      pointSys.reset();
      expect(pointSys.getCurrentPoints()).toBe(0);
      expect(pointSys.getTotalEarned()).toBe(0);
      expect(pointSys.getTotalSpent()).toBe(0);
    });
  });
});
