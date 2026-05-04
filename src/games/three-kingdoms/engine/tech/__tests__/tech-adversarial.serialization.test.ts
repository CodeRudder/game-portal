/**
 * 对抗式测试 — 序列化与加速对抗
 *
 * 维度：F-Error + F-Boundary
 * 重点：序列化损坏数据、加速边界、反序列化兼容性
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TechTreeSystem } from '../TechTreeSystem';
import { TechPointSystem } from '../TechPointSystem';
import { TechResearchSystem } from '../TechResearchSystem';
import { FusionTechSystem } from '../FusionTechSystem';
import { createRealDeps } from '../../../test-utils/test-helpers';

describe('对抗式测试: 序列化与加速对抗', () => {
  let treeSys: TechTreeSystem;
  let pointSys: TechPointSystem;
  let researchSys: TechResearchSystem;
  let fusionSys: FusionTechSystem;
  let baseTime: number;
  let currentTime: number;
  let mandateAmount: number;

  beforeEach(() => {
    vi.restoreAllMocks();
    baseTime = 1_000_000_000_000;
    currentTime = baseTime;
    vi.spyOn(Date, 'now').mockReturnValue(currentTime);
    mandateAmount = 100;

    treeSys = new TechTreeSystem();
    pointSys = new TechPointSystem();
    let goldAmount = 100000;
    researchSys = new TechResearchSystem(
      treeSys, pointSys, () => 20,
      () => mandateAmount,
      (amt: number) => {
        if (mandateAmount >= amt) {
          mandateAmount -= amt;
          return true;
        }
        return false;
      },
      () => goldAmount,
      (amt: number) => {
        if (goldAmount >= amt) {
          goldAmount -= amt;
          return true;
        }
        return false;
      },
    );
    fusionSys = new FusionTechSystem();
    fusionSys.setTechTree(treeSys);

    const deps = createRealDeps();
    treeSys.init(deps);
    pointSys.init(deps);
    researchSys.init(deps);
    fusionSys.init(deps);
  });

  afterEach(() => vi.restoreAllMocks());

  function grantPoints(amount: number) {
    pointSys.syncAcademyLevel(20);
    // actual cost = costPoints * RESEARCH_START_TECH_POINT_MULTIPLIER (10)
    // so we need to generate amount * 10 tech points
    const needed = amount * 10;
    pointSys.update(Math.ceil(needed / 1.76) + 10);
  }

  function advanceTime(ms: number) {
    currentTime += ms;
    vi.spyOn(Date, 'now').mockReturnValue(currentTime);
  }

  // ═══════════════════════════════════════════
  // 序列化对抗
  // ═══════════════════════════════════════════
  describe('序列化对抗', () => {
    it('空数据反序列化不崩溃', () => {
      const newTree = new TechTreeSystem();
      newTree.init(createRealDeps());
      expect(() => newTree.deserialize({
        completedTechIds: [],
        chosenMutexNodes: {},
      })).not.toThrow();
    });

    it('包含不存在ID的 completedTechIds 不崩溃', () => {
      const newTree = new TechTreeSystem();
      newTree.init(createRealDeps());
      expect(() => newTree.deserialize({
        completedTechIds: ['nonexistent_id', 'another_fake'],
        chosenMutexNodes: {},
      })).not.toThrow();
    });

    it('混合有效和无效ID', () => {
      const newTree = new TechTreeSystem();
      newTree.init(createRealDeps());
      newTree.deserialize({
        completedTechIds: ['mil_t1_attack', 'nonexistent'],
        chosenMutexNodes: {},
      });
      expect(newTree.getNodeState('mil_t1_attack')?.status).toBe('completed');
    });

    it('反序列化后可用性正确刷新', () => {
      const newTree = new TechTreeSystem();
      newTree.init(createRealDeps());
      newTree.deserialize({
        completedTechIds: ['mil_t1_attack'],
        chosenMutexNodes: { 'mil_t1': 'mil_t1_attack' },
      });
      // mil_t2_charge 前置满足，应 available
      expect(newTree.getNodeState('mil_t2_charge')?.status).toBe('available');
      // mil_t1_defense 互斥锁定
      expect(newTree.getNodeState('mil_t1_defense')?.status).toBe('locked');
    });

    it('研究系统反序列化兼容旧存档（只有activeResearch）', () => {
      grantPoints(100);
      researchSys.startResearch('mil_t1_attack');
      const data = {
        activeResearch: researchSys.serialize().activeResearch,
      };

      const newSys = new TechResearchSystem(
        treeSys, pointSys, () => 20, () => 0, () => false,
        () => 100000, () => true,
      );
      newSys.init(createRealDeps());
      // 旧存档没有 researchQueue 字段
      newSys.deserialize(data);
      expect(newSys.getQueue()).toHaveLength(1);
      expect(newSys.getQueue()[0].techId).toBe('mil_t1_attack');
    });

    it('研究系统反序列化优先使用 researchQueue', () => {
      grantPoints(200);
      researchSys.startResearch('mil_t1_attack');
      researchSys.startResearch('eco_t1_farming');
      const data = researchSys.serialize();

      const newSys = new TechResearchSystem(
        treeSys, pointSys, () => 20, () => 0, () => false,
        () => 100000, () => true,
      );
      newSys.init(createRealDeps());
      newSys.deserialize(data);
      expect(newSys.getQueue()).toHaveLength(2);
    });

    it('科技点反序列化空数据不崩溃', () => {
      const newSys = new TechPointSystem();
      newSys.init(createRealDeps());
      expect(() => newSys.deserialize({
        techPoints: { current: 0, totalEarned: 0, totalSpent: 0 },
      })).not.toThrow();
    });

    it('融合科技序列化/反序列化', () => {
      fusionSys.deserialize({
        version: 1,
        completedFusionIds: ['fusion_mil_eco_1'],
      });
      expect(fusionSys.getFusionState('fusion_mil_eco_1')?.status).toBe('completed');

      const data = fusionSys.serialize();
      expect(data.completedFusionIds).toContain('fusion_mil_eco_1');
    });

    it('融合科技反序列化空数据', () => {
      expect(() => fusionSys.deserialize({
        version: 1,
        completedFusionIds: [],
      })).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════
  // 加速对抗
  // ═══════════════════════════════════════════
  describe('加速对抗', () => {
    it('天命加速 amount=0 不减少时间', () => {
      grantPoints(100);
      researchSys.startResearch('mil_t1_attack');
      const result = researchSys.speedUp('mil_t1_attack', 'mandate', 0);
      // amount=0 被视为无效，返回失败
      expect(result.success).toBe(false);
      expect(result.reason).toContain('无效');
    });

    it('天命加速 amount=负数', () => {
      grantPoints(100);
      researchSys.startResearch('mil_t1_attack');
      // 负数被视为无效加速数量
      const result = researchSys.speedUp('mil_t1_attack', 'mandate', -1);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('无效');
    });

    it('天命加速刚好完成', () => {
      grantPoints(100);
      researchSys.startResearch('mil_t1_attack');
      advanceTime(10 * 1000);
      // academyLevel=20 → speedMultiplier=3.0 → actualTime=120/3=40s
      // advanceTime(10s) → remaining=30s → ceil(30/60)=1 点天命
      const cost = researchSys.calculateMandateCost('mil_t1_attack');
      const result = researchSys.speedUp('mil_t1_attack', 'mandate', cost);
      expect(result.success).toBe(true);
      expect(result.completed).toBe(true);
    });

    it('天命加速超量完成', () => {
      grantPoints(100);
      researchSys.startResearch('mil_t1_attack');
      advanceTime(10 * 1000);
      const result = researchSys.speedUp('mil_t1_attack', 'mandate', 100);
      expect(result.success).toBe(true);
      expect(result.completed).toBe(true);
    });

    it('元宝加速完成', () => {
      grantPoints(100);
      researchSys.startResearch('mil_t1_attack');
      advanceTime(10 * 1000);
      // ingot 模式忽略 amount，但需要 amount > 0 通过前置校验
      const result = researchSys.speedUp('mil_t1_attack', 'ingot', 1);
      expect(result.success).toBe(true);
      expect(result.completed).toBe(true);
    });

    it('加速已完成的科技（remaining<=0）', () => {
      grantPoints(100);
      researchSys.startResearch('mil_t1_attack');
      advanceTime(200 * 1000);
      // 不调用 update，队列中仍有但 endTime 已过
      const result = researchSys.speedUp('mil_t1_attack', 'mandate', 1);
      // remaining <= 0 → success=false, completed=true
      expect(result.success).toBe(false);
      expect(result.completed).toBe(true);
    });

    it('加速不在队列中的科技', () => {
      const result = researchSys.speedUp('nonexistent', 'mandate', 1);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('未找到');
    });

    it('天命不足时加速失败', () => {
      grantPoints(100);
      researchSys.startResearch('mil_t1_attack');
      mandateAmount = 0;
      const result = researchSys.speedUp('mil_t1_attack', 'mandate', 1);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('天命不足');
    });

    it('spendMandate 返回false时加速失败', () => {
      grantPoints(100);
      const failSys = new TechResearchSystem(
        treeSys, pointSys, () => 20,
        () => 100,
        () => false, // 总是失败
        () => 100000, () => true,
      );
      failSys.init(createRealDeps());
      failSys.startResearch('mil_t1_attack');
      const result = failSys.speedUp('mil_t1_attack', 'mandate', 1);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('天命消耗失败');
    });

    it('未知加速方式', () => {
      grantPoints(100);
      researchSys.startResearch('mil_t1_attack');
      const result = researchSys.speedUp('mil_t1_attack', 'unknown' as any, 1);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('未知加速方式');
    });

    it('calculateIngotCost 不在队列返回0', () => {
      expect(researchSys.calculateIngotCost('nonexistent')).toBe(0);
    });

    it('calculateMandateCost 不在队列返回0', () => {
      expect(researchSys.calculateMandateCost('nonexistent')).toBe(0);
    });
  });

  // ═══════════════════════════════════════════
  // 重复操作对抗
  // ═══════════════════════════════════════════
  describe('重复操作对抗', () => {
    it('重复研究同一科技失败', () => {
      grantPoints(200);
      researchSys.startResearch('mil_t1_attack');
      const result = researchSys.startResearch('mil_t1_attack');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('正在研究');
    });

    it('重复取消同一科技第二次失败', () => {
      grantPoints(100);
      researchSys.startResearch('mil_t1_attack');
      const r1 = researchSys.cancelResearch('mil_t1_attack');
      expect(r1.success).toBe(true);
      const r2 = researchSys.cancelResearch('mil_t1_attack');
      expect(r2.success).toBe(false);
    });

    it('reset后可以重新研究', () => {
      grantPoints(200);
      researchSys.startResearch('mil_t1_attack');
      advanceTime(200 * 1000);
      researchSys.update(0);
      // 已完成，不能研究
      expect(researchSys.startResearch('mil_t1_attack').success).toBe(false);

      // reset
      treeSys.reset();
      researchSys.reset();
      pointSys.reset();
      grantPoints(100);
      const result = researchSys.startResearch('mil_t1_attack');
      expect(result.success).toBe(true);
    });
  });
});
