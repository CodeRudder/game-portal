/**
 * TechSystem 深度路径覆盖测试
 *
 * 覆盖复杂分支路径和组合场景：
 * 1. 科技解锁：前置科技满足/不满足/多层依赖
 * 2. 科技升级：资源足够/不够/刚好够/队列满
 * 3. 科技效果：加成计算/叠加/互斥分支锁定
 * 4. 融合科技：满足条件/不满足/部分满足
 * 5. 序列化：存档/读档一致性
 * 6. 科技重置：重置后状态恢复
 *
 * @module engine/tech/__tests__/TechSystem.path-coverage
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TechTreeSystem } from '../TechTreeSystem';
import { TechPointSystem } from '../TechPointSystem';
import { TechResearchSystem } from '../TechResearchSystem';
import { FusionTechSystem } from '../FusionTechSystem';
import type { ISystemDeps } from '../../../../core/types';

// ── Mock ISystemDeps 工厂 ──

function createMockDeps(): ISystemDeps {
  return {
    eventBus: {
      on: vi.fn().mockReturnValue(vi.fn()),
      once: vi.fn().mockReturnValue(vi.fn()),
      emit: vi.fn(),
      off: vi.fn(),
      removeAllListeners: vi.fn(),
    },
    config: { get: vi.fn(), set: vi.fn() },
    registry: {
      register: vi.fn(),
      get: vi.fn(),
      getAll: vi.fn(() => new Map()),
      has: vi.fn(() => false),
      unregister: vi.fn(),
    },
  };
}

// ── 测试 ──

describe('TechSystem 路径覆盖测试', () => {
  let treeSys: TechTreeSystem;
  let pointSys: TechPointSystem;
  let researchSys: TechResearchSystem;
  let fusionSys: FusionTechSystem;
  let deps: ISystemDeps;
  let baseTime: number;
  let mandateAmount: number;

  beforeEach(() => {
    vi.restoreAllMocks();
    baseTime = 1_000_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(baseTime);
    mandateAmount = 100;

    deps = createMockDeps();
    treeSys = new TechTreeSystem();
    pointSys = new TechPointSystem();
    fusionSys = new FusionTechSystem();

    researchSys = new TechResearchSystem(
      treeSys,
      pointSys,
      () => 3,
      () => mandateAmount,
      (amt: number) => {
        if (mandateAmount >= amt) {
          mandateAmount -= amt;
          return true;
        }
        return false;
      },
    );

    treeSys.init(deps);
    pointSys.init(deps);
    researchSys.init(deps);
    fusionSys.init(deps);
    fusionSys.setTechTree(treeSys);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 辅助：给科技点系统充入点数
  function grantPoints(amount: number): void {
    pointSys.syncAcademyLevel(20);
    const seconds = Math.ceil(amount / 1.76) + 10;
    pointSys.update(seconds);
  }

  // 辅助：推进时间
  function advanceTime(ms: number): void {
    vi.spyOn(Date, 'now').mockReturnValue(baseTime + ms);
  }

  // 辅助：直接完成一个科技节点（跳过研究流程）
  function forceCompleteNode(techId: string): void {
    treeSys.completeNode(techId);
  }

  // ═══════════════════════════════════════════
  // 1. 科技解锁 — 前置依赖路径
  // ═══════════════════════════════════════════

  describe('科技解锁：前置依赖路径', () => {
    it('无前置依赖的Tier1科技默认可用', () => {
      const check = treeSys.canResearch('mil_t1_attack');
      expect(check.can).toBe(true);
    });

    it('前置科技未完成时无法解锁Tier2', () => {
      // mil_t2_charge 需要 mil_t1_attack 前置
      const check = treeSys.canResearch('mil_t2_charge');
      expect(check.can).toBe(false);
      expect(check.reason).toContain('前置');
    });

    it('完成前置科技后Tier2变为可用', () => {
      forceCompleteNode('mil_t1_attack');

      const check = treeSys.canResearch('mil_t2_charge');
      expect(check.can).toBe(true);
    });

    it('多层前置依赖需逐级完成', () => {
      // mil_t3_blitz 需要 mil_t2_charge → 需要 mil_t1_attack
      expect(treeSys.canResearch('mil_t3_blitz').can).toBe(false);

      forceCompleteNode('mil_t1_attack');
      expect(treeSys.canResearch('mil_t3_blitz').can).toBe(false);

      forceCompleteNode('mil_t2_charge');
      expect(treeSys.canResearch('mil_t3_blitz').can).toBe(true);
    });

    it('已完成节点不可再次研究', () => {
      forceCompleteNode('mil_t1_attack');
      const check = treeSys.canResearch('mil_t1_attack');
      expect(check.can).toBe(false);
      expect(check.reason).toContain('已完成');
    });

    it('不存在的节点返回不可研究', () => {
      const check = treeSys.canResearch('nonexistent_tech');
      expect(check.can).toBe(false);
      expect(check.reason).toContain('不存在');
    });
  });

  // ═══════════════════════════════════════════
  // 2. 科技升级 — 资源消耗路径
  // ═══════════════════════════════════════════

  describe('科技升级：资源消耗路径', () => {
    it('资源足够时成功开始研究', () => {
      grantPoints(200);

      const result = researchSys.startResearch('mil_t1_attack');
      expect(result.success).toBe(true);
    });

    it('资源不足时拒绝研究', () => {
      // 不充入科技点
      const result = researchSys.startResearch('mil_t1_attack');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('不足');
    });

    it('资源刚好够时成功研究（边界值）', () => {
      // mil_t1_attack 需要 50 科技点
      pointSys.syncAcademyLevel(20);
      // 精确充入 50 点
      pointSys.exchangeGoldForTechPoints(50 * 100, 10);

      const result = researchSys.startResearch('mil_t1_attack');
      expect(result.success).toBe(true);
    });

    it('队列已满时拒绝研究', () => {
      grantPoints(2000);

      // academy level 3 → queue size 1
      researchSys.startResearch('mil_t1_attack');

      const result = researchSys.startResearch('eco_t1_farming');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('已满');
    });

    it('取消研究后可重新研究同一科技', () => {
      grantPoints(2000);

      researchSys.startResearch('mil_t1_attack');

      // 取消后重新检查
      const cancelResult = researchSys.cancelResearch('mil_t1_attack');
      expect(cancelResult.success).toBe(true);

      // 取消后可以再次研究
      const restartResult = researchSys.startResearch('mil_t1_attack');
      expect(restartResult.success).toBe(true);
    });

    it('科技满级后（已完成）不可继续升级', () => {
      forceCompleteNode('mil_t1_attack');

      // 已完成的科技不能再研究
      const check = treeSys.canResearch('mil_t1_attack');
      expect(check.can).toBe(false);

      // 尝试通过研究系统启动也应失败
      grantPoints(200);
      const result = researchSys.startResearch('mil_t1_attack');
      expect(result.success).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // 3. 科技效果 — 加成计算与叠加
  // ═══════════════════════════════════════════

  describe('科技效果：加成计算路径', () => {
    it('单个科技效果正确计算', () => {
      forceCompleteNode('mil_t1_attack');
      // mil_t1_attack: troop_attack +10% to all
      const value = treeSys.getEffectValue('troop_attack', 'all');
      expect(value).toBe(10);
    });

    it('多个科技效果正确叠加（同目标叠加）', () => {
      forceCompleteNode('mil_t1_attack'); // troop_attack +10% to all
      forceCompleteNode('mil_t2_charge'); // troop_attack +15% to cavalry

      // getEffectValue 匹配 target==='cavalry' 或 target==='all'
      const allAtk = treeSys.getEffectValue('troop_attack', 'all');
      const cavalryAtk = treeSys.getEffectValue('troop_attack', 'cavalry');
      expect(allAtk).toBe(10); // 只有 target='all' 的效果
      expect(cavalryAtk).toBe(25); // 15(cavalry) + 10(all) = 25
    });

    it('科技加成百分比计算正确（getTechBonusMultiplier）', () => {
      forceCompleteNode('eco_t3_marketplace');
      // eco_t3_marketplace: resource_production +10% to all
      const bonus = treeSys.getTechBonusMultiplier();
      expect(bonus).toBe(0.1);
    });

    it('互斥分支选择后另一分支被锁定', () => {
      forceCompleteNode('mil_t1_attack'); // 选择攻击路线

      // mil_t1_defense 应被互斥锁定
      const check = treeSys.canResearch('mil_t1_defense');
      expect(check.can).toBe(false);
      expect(check.reason).toContain('互斥');
    });

    it('路线进度统计正确', () => {
      forceCompleteNode('mil_t1_attack');
      forceCompleteNode('mil_t2_charge');

      const progress = treeSys.getPathProgress('military');
      expect(progress.completed).toBe(2);
      expect(progress.total).toBeGreaterThan(2);
    });

    it('无已完成科技时效果值为0', () => {
      const value = treeSys.getEffectValue('troop_attack', 'all');
      expect(value).toBe(0);

      const bonus = treeSys.getTechBonusMultiplier();
      expect(bonus).toBe(0);
    });
  });

  // ═══════════════════════════════════════════
  // 4. 融合科技 — 跨路线组合路径
  // ═══════════════════════════════════════════

  describe('融合科技：跨路线组合路径', () => {
    it('融合科技前置条件未满足时锁定', () => {
      const allDefs = fusionSys.getAllFusionDefs();
      if (allDefs.length === 0) return;

      const firstFusion = allDefs[0];
      const state = fusionSys.getFusionState(firstFusion.id);
      expect(state).toBeDefined();
      expect(state!.status).toBe('locked');
    });

    it('部分前置满足时仍锁定', () => {
      const allDefs = fusionSys.getAllFusionDefs();
      if (allDefs.length === 0) return;

      const firstFusion = allDefs[0];
      const prereqs = firstFusion.prerequisites;

      // 只完成一条路线的前置
      if ('pathA' in prereqs) {
        const p = prereqs as { pathA: string; pathB: string };
        forceCompleteNode(p.pathA);
        // 不完成 pathB
      }

      fusionSys.refreshAllAvailability();
      const check = fusionSys.canResearch(firstFusion.id);
      expect(check.can).toBe(false);
    });

    it('所有前置满足后融合科技解锁', () => {
      const allDefs = fusionSys.getAllFusionDefs();
      if (allDefs.length === 0) return;

      const firstFusion = allDefs[0];
      const prereqs = firstFusion.prerequisites;

      if ('pathA' in prereqs) {
        const p = prereqs as { pathA: string; pathB: string };
        forceCompleteNode(p.pathA);
        forceCompleteNode(p.pathB);
      }

      fusionSys.refreshAllAvailability();
      const check = fusionSys.canResearch(firstFusion.id);
      expect(check.can).toBe(true);
    });

    it('融合科技完成后效果汇总正确', () => {
      const allDefs = fusionSys.getAllFusionDefs();
      if (allDefs.length === 0) return;

      const firstFusion = allDefs[0];
      fusionSys.completeFusionNode(firstFusion.id);

      const effects = fusionSys.getAllCompletedEffects();
      expect(effects.length).toBeGreaterThan(0);
    });

    it('序列化与反序列化保持一致性', () => {
      forceCompleteNode('mil_t1_attack');
      forceCompleteNode('mil_t2_charge');

      const saved = treeSys.serialize();
      const newTree = new TechTreeSystem();
      newTree.init(deps);
      newTree.deserialize(saved);

      expect(newTree.getNodeState('mil_t1_attack')?.status).toBe('completed');
      expect(newTree.getNodeState('mil_t2_charge')?.status).toBe('completed');
    });

    it('科技重置后所有节点回到初始状态', () => {
      forceCompleteNode('mil_t1_attack');
      forceCompleteNode('mil_t2_charge');

      // 验证已完成
      expect(treeSys.getNodeState('mil_t1_attack')?.status).toBe('completed');

      // 重置
      treeSys.reset();

      // 验证回到初始状态
      expect(treeSys.getNodeState('mil_t1_attack')?.status).toBe('available');
      expect(treeSys.getNodeState('mil_t2_charge')?.status).toBe('locked');

      // 互斥选择也应清空
      const chosen = treeSys.getChosenMutexNodes();
      expect(Object.keys(chosen)).toHaveLength(0);
    });
  });
});
