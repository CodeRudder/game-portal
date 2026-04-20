/**
 * TechResearchSystem 单元测试
 * 覆盖：研究流程、队列规则、加速机制、序列化
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TechTreeSystem } from '../TechTreeSystem';
import { TechPointSystem } from '../TechPointSystem';
import { TechResearchSystem } from '../TechResearchSystem';
import type { ISystemDeps } from '../../../../core/types';

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

describe('TechResearchSystem', () => {
  let treeSys: TechTreeSystem;
  let pointSys: TechPointSystem;
  let researchSys: TechResearchSystem;
  let baseTime: number;
  let mandateAmount: number;

  beforeEach(() => {
    vi.restoreAllMocks();
    baseTime = 1_000_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(baseTime);
    mandateAmount = 100;

    treeSys = new TechTreeSystem();
    pointSys = new TechPointSystem();
    researchSys = new TechResearchSystem(
      treeSys,
      pointSys,
      () => 3, // academy level 3
      () => mandateAmount,
      (amt: number) => {
        if (mandateAmount >= amt) {
          mandateAmount -= amt;
          return true;
        }
        return false;
      },
    );

    const deps = mockDeps();
    treeSys.init(deps);
    pointSys.init(deps);
    researchSys.init(deps);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 辅助：给科技点系统充入足够的点数
  function grantPoints(amount: number): void {
    pointSys.syncAcademyLevel(20);
    // 1.76/秒，需要 amount/1.76 秒
    const seconds = Math.ceil(amount / 1.76) + 10;
    pointSys.update(seconds);
  }

  // 辅助：推进时间
  function advanceTime(ms: number): void {
    vi.spyOn(Date, 'now').mockReturnValue(baseTime + ms);
  }

  // ═══════════════════════════════════════════
  // 1. 研究流程
  // ═══════════════════════════════════════════
  describe('研究流程', () => {
    it('成功开始研究', () => {
      grantPoints(100);
      const result = researchSys.startResearch('mil_t1_attack');
      expect(result.success).toBe(true);
    });

    it('开始研究后节点变为 researching', () => {
      grantPoints(100);
      researchSys.startResearch('mil_t1_attack');
      expect(treeSys.getNodeState('mil_t1_attack')?.status).toBe('researching');
    });

    it('开始研究后消耗科技点', () => {
      grantPoints(100);
      const before = pointSys.getCurrentPoints();
      researchSys.startResearch('mil_t1_attack');
      expect(pointSys.getCurrentPoints()).toBeCloseTo(before - 50);
    });

    it('不存在的节点无法研究', () => {
      grantPoints(100);
      const result = researchSys.startResearch('nonexistent');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('不存在');
    });

    it('科技点不足无法研究', () => {
      // 不充入科技点
      const result = researchSys.startResearch('mil_t1_attack');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('不足');
    });

    it('已完成的节点无法研究', () => {
      grantPoints(200);
      researchSys.startResearch('mil_t1_attack');
      advanceTime(200 * 1000); // 超过研究时间
      researchSys.update(0);
      const result = researchSys.startResearch('mil_t1_attack');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('已完成');
    });

    it('前置未完成无法研究', () => {
      grantPoints(1000);
      const result = researchSys.startResearch('mil_t2_charge');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('前置');
    });

    it('互斥锁定的节点无法研究', () => {
      grantPoints(200);
      researchSys.startResearch('mil_t1_attack');
      advanceTime(200 * 1000);
      researchSys.update(0);
      // mil_t1_defense 被互斥锁定
      const result = researchSys.startResearch('mil_t1_defense');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('互斥');
    });

    it('研究完成后节点变为 completed', () => {
      grantPoints(100);
      researchSys.startResearch('mil_t1_attack');
      advanceTime(200 * 1000); // 超过 120 秒
      researchSys.update(0);
      expect(treeSys.getNodeState('mil_t1_attack')?.status).toBe('completed');
    });

    it('研究完成后队列清空', () => {
      grantPoints(100);
      researchSys.startResearch('mil_t1_attack');
      advanceTime(200 * 1000);
      researchSys.update(0);
      expect(researchSys.getQueue()).toHaveLength(0);
    });

    it('研究完成后解锁后续节点', () => {
      grantPoints(1000);
      researchSys.startResearch('mil_t1_attack');
      advanceTime(200 * 1000);
      researchSys.update(0);
      // mil_t2_charge 的前置是 mil_t1_attack
      expect(treeSys.getNodeState('mil_t2_charge')?.status).toBe('available');
    });
  });

  // ═══════════════════════════════════════════
  // 2. 取消研究
  // ═══════════════════════════════════════════
  describe('取消研究', () => {
    it('成功取消研究', () => {
      grantPoints(100);
      researchSys.startResearch('mil_t1_attack');
      const result = researchSys.cancelResearch('mil_t1_attack');
      expect(result.success).toBe(true);
      expect(result.refundPoints).toBe(50);
    });

    it('取消后节点恢复为 available', () => {
      grantPoints(100);
      researchSys.startResearch('mil_t1_attack');
      researchSys.cancelResearch('mil_t1_attack');
      expect(treeSys.getNodeState('mil_t1_attack')?.status).toBe('available');
    });

    it('取消后返还科技点', () => {
      grantPoints(100);
      const before = pointSys.getCurrentPoints();
      researchSys.startResearch('mil_t1_attack');
      researchSys.cancelResearch('mil_t1_attack');
      expect(pointSys.getCurrentPoints()).toBeCloseTo(before);
    });

    it('取消不存在的科技返回失败', () => {
      const result = researchSys.cancelResearch('nonexistent');
      expect(result.success).toBe(false);
      expect(result.refundPoints).toBe(0);
    });
  });

  // ═══════════════════════════════════════════
  // 3. 研究队列规则
  // ═══════════════════════════════════════════
  describe('研究队列规则', () => {
    it('初始队列大小为 1（书院等级 3）', () => {
      expect(researchSys.getMaxQueueSize()).toBe(1);
    });

    it('队列满时无法开始新研究', () => {
      grantPoints(500);
      researchSys.startResearch('mil_t1_attack');
      // 队列已满，尝试研究另一个
      const result = researchSys.startResearch('eco_t1_farming');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('已满');
    });

    it('同一科技不能重复入队', () => {
      grantPoints(500);
      researchSys.startResearch('mil_t1_attack');
      const result = researchSys.startResearch('mil_t1_attack');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('研究');
    });

    it('书院等级 5 时队列大小为 2', () => {
      const sys2 = new TechResearchSystem(treeSys, pointSys, () => 5, () => 0, () => false);
      sys2.init(mockDeps());
      expect(sys2.getMaxQueueSize()).toBe(2);
    });

    it('书院等级 10 时队列大小为 3', () => {
      const sys3 = new TechResearchSystem(treeSys, pointSys, () => 10, () => 0, () => false);
      sys3.init(mockDeps());
      expect(sys3.getMaxQueueSize()).toBe(3);
    });

    it('书院等级 20 时队列大小为 5', () => {
      const sys5 = new TechResearchSystem(treeSys, pointSys, () => 20, () => 0, () => false);
      sys5.init(mockDeps());
      expect(sys5.getMaxQueueSize()).toBe(5);
    });

    it('队列大小随书院等级递增', () => {
      const levels = [1, 5, 10, 15, 20];
      const sizes = levels.map((l) => {
        const s = new TechResearchSystem(treeSys, pointSys, () => l, () => 0, () => false);
        return s.getMaxQueueSize();
      });
      for (let i = 1; i < sizes.length; i++) {
        expect(sizes[i]).toBeGreaterThanOrEqual(sizes[i - 1]);
      }
    });
  });

  // ═══════════════════════════════════════════
  // 4. 研究进度
  // ═══════════════════════════════════════════
  describe('研究进度', () => {
    it('初始进度为 0', () => {
      expect(researchSys.getResearchProgress('mil_t1_attack')).toBe(0);
    });

    it('开始研究后进度 > 0', () => {
      grantPoints(100);
      researchSys.startResearch('mil_t1_attack');
      advanceTime(60 * 1000); // 过了 60 秒
      const progress = researchSys.getResearchProgress('mil_t1_attack');
      expect(progress).toBeGreaterThan(0);
      expect(progress).toBeLessThan(1);
    });

    it('超过研究时间后进度为 1', () => {
      grantPoints(100);
      researchSys.startResearch('mil_t1_attack');
      advanceTime(200 * 1000);
      const progress = researchSys.getResearchProgress('mil_t1_attack');
      expect(progress).toBe(1);
    });

    it('getRemainingTime 返回正确秒数', () => {
      grantPoints(100);
      researchSys.startResearch('mil_t1_attack');
      advanceTime(60 * 1000);
      const remaining = researchSys.getRemainingTime('mil_t1_attack');
      expect(remaining).toBeCloseTo(60, -1); // ~60秒
    });

    it('isResearching 正确判断', () => {
      grantPoints(100);
      expect(researchSys.isResearching('mil_t1_attack')).toBe(false);
      researchSys.startResearch('mil_t1_attack');
      expect(researchSys.isResearching('mil_t1_attack')).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // 5. 加速机制
  // ═══════════════════════════════════════════
  describe('加速机制', () => {
    it('天命加速减少剩余时间', () => {
      grantPoints(100);
      researchSys.startResearch('mil_t1_attack');
      advanceTime(10 * 1000); // 过了 10 秒

      const result = researchSys.speedUp('mil_t1_attack', 'mandate', 1);
      expect(result.success).toBe(true);
      expect(result.timeReduced).toBe(60); // 1 点天命 = 60 秒
      expect(result.cost).toBe(1);
    });

    it('天命加速消耗天命', () => {
      grantPoints(100);
      researchSys.startResearch('mil_t1_attack');
      advanceTime(10 * 1000);
      const beforeMandate = mandateAmount;
      researchSys.speedUp('mil_t1_attack', 'mandate', 2);
      expect(mandateAmount).toBe(beforeMandate - 2);
    });

    it('天命不足时加速失败', () => {
      grantPoints(100);
      researchSys.startResearch('mil_t1_attack');
      mandateAmount = 0;
      const result = researchSys.speedUp('mil_t1_attack', 'mandate', 1);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('天命不足');
    });

    it('天命加速可以立即完成', () => {
      grantPoints(100);
      researchSys.startResearch('mil_t1_attack');
      advanceTime(10 * 1000);
      // 需要约 2 点天命完成 110 秒（1 点 = 60 秒）
      const result = researchSys.speedUp('mil_t1_attack', 'mandate', 3);
      expect(result.success).toBe(true);
      expect(result.completed).toBe(true);
    });

    it('元宝加速立即完成', () => {
      grantPoints(100);
      researchSys.startResearch('mil_t1_attack');
      advanceTime(10 * 1000);
      const result = researchSys.speedUp('mil_t1_attack', 'ingot', 0);
      expect(result.success).toBe(true);
      expect(result.completed).toBe(true);
    });

    it('calculateIngotCost 返回正确值', () => {
      grantPoints(100);
      researchSys.startResearch('mil_t1_attack');
      advanceTime(60 * 1000); // 剩余 60 秒
      const cost = researchSys.calculateIngotCost('mil_t1_attack');
      // 60秒 / 600 = 1
      expect(cost).toBeGreaterThanOrEqual(1);
    });

    it('calculateMandateCost 返回正确值', () => {
      grantPoints(100);
      researchSys.startResearch('mil_t1_attack');
      advanceTime(60 * 1000); // 剩余 60 秒
      const cost = researchSys.calculateMandateCost('mil_t1_attack');
      // 60秒 / 60 = 1
      expect(cost).toBeGreaterThanOrEqual(1);
    });

    it('加速不存在的科技返回失败', () => {
      const result = researchSys.speedUp('nonexistent', 'mandate', 1);
      expect(result.success).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // 6. 研究速度加成
  // ═══════════════════════════════════════════
  describe('研究速度加成', () => {
    it('有研究速度加成时研究时间缩短', () => {
      grantPoints(100);
      pointSys.syncResearchSpeedBonus(50); // +50% 速度
      researchSys.startResearch('mil_t1_attack');

      // 原始时间 120 秒，加成后 120/1.5 = 80 秒
      const slot = researchSys.getQueue()[0];
      const duration = (slot.endTime - slot.startTime) / 1000;
      expect(duration).toBeCloseTo(80, -1);
    });
  });

  // ═══════════════════════════════════════════
  // 7. 序列化
  // ═══════════════════════════════════════════
  describe('序列化/反序列化', () => {
    it('空队列序列化为 null', () => {
      const data = researchSys.serialize();
      expect(data.activeResearch).toBeNull();
    });

    it('研究中的科技序列化', () => {
      grantPoints(100);
      researchSys.startResearch('mil_t1_attack');
      const data = researchSys.serialize();
      expect(data.activeResearch).not.toBeNull();
      expect(data.activeResearch!.techId).toBe('mil_t1_attack');
    });

    it('反序列化恢复研究状态', () => {
      grantPoints(100);
      researchSys.startResearch('mil_t1_attack');
      const data = researchSys.serialize();

      const newSys = new TechResearchSystem(treeSys, pointSys, () => 3, () => 0, () => false);
      newSys.init(mockDeps());
      newSys.deserialize(data);
      expect(newSys.getQueue()).toHaveLength(1);
      expect(newSys.getQueue()[0].techId).toBe('mil_t1_attack');
    });

    it('reset 清空队列', () => {
      grantPoints(100);
      researchSys.startResearch('mil_t1_attack');
      researchSys.reset();
      expect(researchSys.getQueue()).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════
  // 8. 完整流程测试
  // ═══════════════════════════════════════════
  describe('完整流程', () => {
    it('选择→消耗→等待→完成 完整流程', () => {
      // 1. 充入科技点
      grantPoints(100);
      const pointsBefore = pointSys.getCurrentPoints();

      // 2. 开始研究
      const startResult = researchSys.startResearch('mil_t1_attack');
      expect(startResult.success).toBe(true);

      // 3. 验证消耗
      expect(pointSys.getCurrentPoints()).toBeCloseTo(pointsBefore - 50);

      // 4. 验证节点状态
      expect(treeSys.getNodeState('mil_t1_attack')?.status).toBe('researching');

      // 5. 推进时间（未完成）
      advanceTime(60 * 1000);
      researchSys.update(0);
      expect(treeSys.getNodeState('mil_t1_attack')?.status).toBe('researching');

      // 6. 推进时间（完成）
      advanceTime(200 * 1000);
      researchSys.update(0);

      // 7. 验证完成
      expect(treeSys.getNodeState('mil_t1_attack')?.status).toBe('completed');
      expect(researchSys.getQueue()).toHaveLength(0);

      // 8. 验证后续节点解锁
      expect(treeSys.getNodeState('mil_t2_charge')?.status).toBe('available');

      // 9. 验证互斥锁定
      expect(treeSys.getNodeState('mil_t1_defense')?.status).toBe('locked');
    });

    it('三条路线可以并行研究不同节点', () => {
      // 使用大队列
      const bigSys = new TechResearchSystem(treeSys, pointSys, () => 20, () => 0, () => false);
      bigSys.init(mockDeps());

      grantPoints(500);
      expect(bigSys.startResearch('mil_t1_attack').success).toBe(true);
      expect(bigSys.startResearch('eco_t1_farming').success).toBe(true);
      expect(bigSys.startResearch('cul_t1_education').success).toBe(true);

      expect(bigSys.getQueue()).toHaveLength(3);
    });
  });
});
