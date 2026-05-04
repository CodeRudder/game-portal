/**
 * 对抗式测试 — 状态转换
 *
 * 维度：F-State
 * 重点：locked→available→researching→completed 全生命周期
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TechTreeSystem } from '../TechTreeSystem';
import { TechPointSystem } from '../TechPointSystem';
import { TechResearchSystem } from '../TechResearchSystem';
import { createRealDeps } from '../../../test-utils/test-helpers';

describe('对抗式测试: 状态转换', () => {
  let treeSys: TechTreeSystem;
  let pointSys: TechPointSystem;
  let researchSys: TechResearchSystem;
  let baseTime: number;
  let currentTime: number;

  beforeEach(() => {
    vi.restoreAllMocks();
    baseTime = 1_000_000_000_000;
    currentTime = baseTime;
    vi.spyOn(Date, 'now').mockReturnValue(currentTime);

    treeSys = new TechTreeSystem();
    pointSys = new TechPointSystem();
    researchSys = new TechResearchSystem(
      treeSys, pointSys, () => 20, () => 100, () => true,
      () => 100000, () => true,
    );
    const deps = createRealDeps();
    treeSys.init(deps);
    pointSys.init(deps);
    researchSys.init(deps);
  });

  afterEach(() => vi.restoreAllMocks());

  function grantPoints(amount: number) {
    // Sprint 3: startResearch now costs costPoints × RESEARCH_START_TECH_POINT_MULTIPLIER (10)
    // amount is the nominal costPoints, so we need amount × 10 actual tech points
    const actualNeeded = amount * 10;
    pointSys.syncAcademyLevel(20);
    pointSys.update(Math.ceil(actualNeeded / 1.76) + 10);
  }

  function advanceTime(ms: number) {
    currentTime += ms;
    vi.spyOn(Date, 'now').mockReturnValue(currentTime);
  }

  function completeTech(techId: string) {
    grantPoints(1000);
    researchSys.startResearch(techId);
    advanceTime(2000 * 1000);
    researchSys.update(0);
  }

  // ═══════════════════════════════════════════
  // S1: locked → available（前置完成）
  // ═══════════════════════════════════════════
  describe('S1: locked → available', () => {
    it('Tier2节点初始为locked', () => {
      expect(treeSys.getNodeState('mil_t2_charge')?.status).toBe('locked');
    });

    it('完成前置后变为available', () => {
      completeTech('mil_t1_attack');
      expect(treeSys.getNodeState('mil_t2_charge')?.status).toBe('available');
    });

    it('多级前置：逐级解锁', () => {
      expect(treeSys.getNodeState('mil_t3_blitz')?.status).toBe('locked');
      completeTech('mil_t1_attack');
      expect(treeSys.getNodeState('mil_t3_blitz')?.status).toBe('locked');
      completeTech('mil_t2_charge');
      expect(treeSys.getNodeState('mil_t3_blitz')?.status).toBe('available');
    });
  });

  // ═══════════════════════════════════════════
  // S2: available → researching（开始研究）
  // ═══════════════════════════════════════════
  describe('S2: available → researching', () => {
    it('开始研究后状态变为researching', () => {
      grantPoints(100);
      researchSys.startResearch('mil_t1_attack');
      expect(treeSys.getNodeState('mil_t1_attack')?.status).toBe('researching');
    });

    it('researching 状态有时间戳', () => {
      grantPoints(100);
      researchSys.startResearch('mil_t1_attack');
      const state = treeSys.getNodeState('mil_t1_attack');
      expect(state?.researchStartTime).toBe(baseTime);
      expect(state?.researchEndTime).toBeGreaterThan(baseTime);
    });
  });

  // ═══════════════════════════════════════════
  // S3: researching → completed（时间到）
  // ═══════════════════════════════════════════
  describe('S3: researching → completed', () => {
    it('时间到达后自动完成', () => {
      grantPoints(100);
      researchSys.startResearch('mil_t1_attack');
      advanceTime(200 * 1000); // 超过120秒
      researchSys.update(0);
      expect(treeSys.getNodeState('mil_t1_attack')?.status).toBe('completed');
    });

    it('完成时时间戳清空', () => {
      grantPoints(100);
      researchSys.startResearch('mil_t1_attack');
      advanceTime(200 * 1000);
      researchSys.update(0);
      const state = treeSys.getNodeState('mil_t1_attack');
      expect(state?.researchStartTime).toBeNull();
      expect(state?.researchEndTime).toBeNull();
    });

    it('时间刚好到 endTime 时完成', () => {
      grantPoints(100);
      researchSys.startResearch('mil_t1_attack');
      const slot = researchSys.getQueue()[0];
      // 精确推到 endTime
      advanceTime(slot.endTime - baseTime);
      researchSys.update(0);
      expect(treeSys.getNodeState('mil_t1_attack')?.status).toBe('completed');
    });

    it('时间差1ms未完成', () => {
      grantPoints(100);
      researchSys.startResearch('mil_t1_attack');
      const slot = researchSys.getQueue()[0];
      // 差1ms
      advanceTime(slot.endTime - baseTime - 1);
      researchSys.update(0);
      expect(treeSys.getNodeState('mil_t1_attack')?.status).toBe('researching');
    });
  });

  // ═══════════════════════════════════════════
  // S4: researching → available（取消研究）
  // ═══════════════════════════════════════════
  describe('S4: researching → available（取消）', () => {
    it('取消后恢复为available', () => {
      grantPoints(100);
      researchSys.startResearch('mil_t1_attack');
      expect(treeSys.getNodeState('mil_t1_attack')?.status).toBe('researching');
      researchSys.cancelResearch('mil_t1_attack');
      expect(treeSys.getNodeState('mil_t1_attack')?.status).toBe('available');
    });

    it('取消后时间戳清空', () => {
      grantPoints(100);
      researchSys.startResearch('mil_t1_attack');
      researchSys.cancelResearch('mil_t1_attack');
      const state = treeSys.getNodeState('mil_t1_attack');
      expect(state?.researchStartTime).toBeNull();
      expect(state?.researchEndTime).toBeNull();
    });

    it('取消后可以重新研究', () => {
      grantPoints(200);
      researchSys.startResearch('mil_t1_attack');
      researchSys.cancelResearch('mil_t1_attack');
      const result = researchSys.startResearch('mil_t1_attack');
      expect(result.success).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // S5: available → locked（互斥锁定）
  // ═══════════════════════════════════════════
  describe('S5: available → locked（互斥锁定）', () => {
    it('完成互斥节点后替代节点被锁定', () => {
      // 初始都为 available
      expect(treeSys.getNodeState('mil_t1_attack')?.status).toBe('available');
      expect(treeSys.getNodeState('mil_t1_defense')?.status).toBe('available');

      completeTech('mil_t1_attack');
      expect(treeSys.getNodeState('mil_t1_defense')?.status).toBe('locked');
    });

    it('被互斥锁定的节点无法研究', () => {
      completeTech('mil_t1_attack');
      grantPoints(100);
      const result = researchSys.startResearch('mil_t1_defense');
      expect(result.success).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // S7: completed → completed（幂等）
  // ═══════════════════════════════════════════
  describe('S7: completed 幂等性', () => {
    it('重复调用 completeNode 不报错', () => {
      completeTech('mil_t1_attack');
      expect(treeSys.getNodeState('mil_t1_attack')?.status).toBe('completed');
      // 再次调用
      treeSys.completeNode('mil_t1_attack');
      expect(treeSys.getNodeState('mil_t1_attack')?.status).toBe('completed');
    });

    it('已完成的节点 cannot research', () => {
      completeTech('mil_t1_attack');
      grantPoints(100);
      const result = researchSys.startResearch('mil_t1_attack');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('已完成');
    });
  });

  // ═══════════════════════════════════════════
  // S9: researching → 取消 → 重新研究 → completed
  // ═══════════════════════════════════════════
  describe('S9: 完整取消-重研流程', () => {
    it('取消后重新研究可以正常完成', () => {
      grantPoints(200);
      // 第一次研究
      researchSys.startResearch('mil_t1_attack');
      advanceTime(30 * 1000); // 研究了30秒
      // 取消
      researchSys.cancelResearch('mil_t1_attack');
      expect(treeSys.getNodeState('mil_t1_attack')?.status).toBe('available');

      // 重新研究
      const result = researchSys.startResearch('mil_t1_attack');
      expect(result.success).toBe(true);
      expect(treeSys.getNodeState('mil_t1_attack')?.status).toBe('researching');

      // 完成
      advanceTime(200 * 1000);
      researchSys.update(0);
      expect(treeSys.getNodeState('mil_t1_attack')?.status).toBe('completed');
    });
  });

  // ═══════════════════════════════════════════
  // S10: 互斥选择A → 取消A → B变为available → 研究B
  // ═══════════════════════════════════════════
  describe('S10: 互斥选择取消后切换', () => {
    it('取消研究不触发互斥锁定（因为未完成）', () => {
      grantPoints(200);
      researchSys.startResearch('mil_t1_attack');
      // 研究中但未完成，互斥未生效
      // mil_t1_defense 仍然 available
      expect(treeSys.getNodeState('mil_t1_defense')?.status).toBe('available');

      // 取消
      researchSys.cancelResearch('mil_t1_attack');
      // 两个都恢复 available
      expect(treeSys.getNodeState('mil_t1_attack')?.status).toBe('available');
      expect(treeSys.getNodeState('mil_t1_defense')?.status).toBe('available');

      // 现在可以研究另一个
      const result = researchSys.startResearch('mil_t1_defense');
      expect(result.success).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // 对抗: setResearching 对不存在节点静默跳过
  // ═══════════════════════════════════════════
  describe('对抗: 静默跳过', () => {
    it('setResearching 对不存在的节点不报错', () => {
      expect(() => treeSys.setResearching('nonexistent', 0, 0)).not.toThrow();
    });

    it('completeNode 对不存在的节点不报错', () => {
      expect(() => treeSys.completeNode('nonexistent')).not.toThrow();
    });

    it('cancelResearch 对非researching节点不报错', () => {
      // locked 节点
      expect(() => treeSys.cancelResearch('mil_t2_charge')).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════
  // 对抗: 多个科技同时完成
  // ═══════════════════════════════════════════
  describe('对抗: 多个科技同时完成', () => {
    it('队列中多个科技同时到期都应完成', () => {
      grantPoints(5000);
      // 使用大队列
      const bigSys = new TechResearchSystem(
        treeSys, pointSys, () => 20, () => 100, () => true,
        () => 100000, () => true,
      );
      bigSys.init(createRealDeps());

      bigSys.startResearch('mil_t1_attack');
      bigSys.startResearch('eco_t1_farming');
      bigSys.startResearch('cul_t1_education');

      // 推过所有研究时间
      advanceTime(200 * 1000);
      bigSys.update(0);

      expect(treeSys.getNodeState('mil_t1_attack')?.status).toBe('completed');
      expect(treeSys.getNodeState('eco_t1_farming')?.status).toBe('completed');
      expect(treeSys.getNodeState('cul_t1_education')?.status).toBe('completed');
      expect(bigSys.getQueue()).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════
  // 对抗: 队列满时的边界
  // ═══════════════════════════════════════════
  describe('对抗: 队列边界', () => {
    it('书院Lv1 队列大小=1', () => {
      const sys = new TechResearchSystem(
        treeSys, pointSys, () => 1, () => 100, () => true,
        () => 100000, () => true,
      );
      sys.init(createRealDeps());
      expect(sys.getMaxQueueSize()).toBe(1);
    });

    it('书院Lv5 队列大小=2', () => {
      const sys = new TechResearchSystem(
        treeSys, pointSys, () => 5, () => 100, () => true,
        () => 100000, () => true,
      );
      sys.init(createRealDeps());
      expect(sys.getMaxQueueSize()).toBe(2);
    });

    it('书院Lv10 队列大小=3', () => {
      const sys = new TechResearchSystem(
        treeSys, pointSys, () => 10, () => 100, () => true,
        () => 100000, () => true,
      );
      sys.init(createRealDeps());
      expect(sys.getMaxQueueSize()).toBe(3);
    });

    it('书院Lv15 队列大小=4', () => {
      const sys = new TechResearchSystem(
        treeSys, pointSys, () => 15, () => 100, () => true,
        () => 100000, () => true,
      );
      sys.init(createRealDeps());
      expect(sys.getMaxQueueSize()).toBe(4);
    });

    it('书院Lv20 队列大小=5', () => {
      const sys = new TechResearchSystem(
        treeSys, pointSys, () => 20, () => 100, () => true,
        () => 100000, () => true,
      );
      sys.init(createRealDeps());
      expect(sys.getMaxQueueSize()).toBe(5);
    });

    it('队列刚好满时入队失败', () => {
      grantPoints(5000);
      const sys = new TechResearchSystem(
        treeSys, pointSys, () => 1, () => 100, () => true,
        () => 100000, () => true,
      );
      sys.init(createRealDeps());
      sys.startResearch('mil_t1_attack');
      const result = sys.startResearch('eco_t1_farming');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('已满');
    });

    it('队列完成一个后空出位置', () => {
      grantPoints(5000);
      const sys = new TechResearchSystem(
        treeSys, pointSys, () => 1, () => 100, () => true,
        () => 100000, () => true,
      );
      sys.init(createRealDeps());
      sys.startResearch('mil_t1_attack');
      advanceTime(200 * 1000);
      sys.update(0);
      // 队列空了
      expect(sys.getQueue()).toHaveLength(0);
      // 可以研究新的
      const result = sys.startResearch('eco_t1_farming');
      expect(result.success).toBe(true);
    });
  });
});
