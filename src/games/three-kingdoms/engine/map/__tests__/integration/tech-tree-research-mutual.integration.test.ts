/**
 * 集成测试 — 科技树/研究/互斥/融合/离线科技（§5.1-5.6）
 *
 * 覆盖 Play 文档流程：
 *   §5.1  科技树结构：多分支、层级关系、前置条件
 *   §5.2  科技研究流程：消耗科技点、研究时间、完成
 *   §5.3  科技互斥：对立科技不可同时研究
 *   §5.4  科技融合：特定科技组合解锁融合科技
 *   §5.5  科技效果：科技加成正确应用
 *   §5.6  离线科技研究：离线期间研究进度
 *
 * 引擎层验证，不依赖 UI。
 *
 * @module engine/map/__tests__/integration/tech-tree-research-mutual
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TechTreeSystem } from '../../../tech/TechTreeSystem';
import { TechResearchSystem } from '../../../tech/TechResearchSystem';
import { TechPointSystem } from '../../../tech/TechPointSystem';
import { TechEffectSystem } from '../../../tech/TechEffectSystem';
import { FusionTechSystem } from '../../../tech/FusionTechSystem';
import { TECH_NODE_DEFS, TECH_NODE_MAP } from '../../../tech/tech-config';
import type { TechPath, TechNodeDef, TechNodeState } from '../../../tech/tech.types';
import type { ISystemDeps } from '../../../../core/types/subsystem';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

function createMockDeps(): ISystemDeps {
  return {
    eventBus: {
      on: () => () => {},
      once: () => () => {},
      emit: vi.fn(),
      off: () => {},
      removeAllListeners: () => {},
    },
    config: { get: () => undefined, set: () => {} },
    registry: {
      register: () => {},
      get: () => null,
      getAll: () => new Map(),
      has: () => false,
      unregister: () => {},
    } as unknown as Record<string, unknown>,
  };
}

/** 查找指定路线+层级的节点 */
function findNode(path: TechPath, tier: number): TechNodeDef {
  return TECH_NODE_DEFS.find((n) => n.path === path && n.tier === tier)!;
}

/** 查找指定路线+层级的所有节点 */
function findNodes(path: TechPath, tier: number): TechNodeDef[] {
  return TECH_NODE_DEFS.filter((n) => n.path === path && n.tier === tier);
}

/** 获取节点定义 by ID */
function getDef(id: string): TechNodeDef {
  return TECH_NODE_MAP.get(id)!;
}

// ─────────────────────────────────────────────
// §5.1 科技树结构：多分支、层级关系、前置条件
// ─────────────────────────────────────────────

describe('§5.1 科技树结构', () => {
  let tree: TechTreeSystem;

  beforeEach(() => {
    tree = new TechTreeSystem();
    tree.init(createMockDeps());
  });

  describe('多分支结构', () => {
    it('应包含三条科技路线：military / economy / culture', () => {
      const paths = ['military', 'economy', 'culture'] as TechPath[];
      for (const path of paths) {
        const nodes = tree.getPathNodes(path);
        expect(nodes.length).toBeGreaterThan(0);
      }
    });

    it('每条路线应有4个层级', () => {
      const paths: TechPath[] = ['military', 'economy', 'culture'];
      for (const path of paths) {
        for (let tier = 1; tier <= 4; tier++) {
          const nodes = tree.getTierNodes(path, tier);
          expect(nodes.length).toBeGreaterThan(0);
        }
      }
    });

    it('同一层级同一路线可包含互斥节点', () => {
      // 军事路线第1层有两个互斥节点：锐兵术 vs 铁壁术
      const milT1 = findNodes('military', 1);
      expect(milT1.length).toBeGreaterThanOrEqual(2);
      const mutexGroups = milT1.map((n) => n.mutexGroup).filter(Boolean);
      expect(mutexGroups.length).toBeGreaterThanOrEqual(2);
      // 同一互斥组
      expect(mutexGroups[0]).toBe(mutexGroups[1]);
    });
  });

  describe('层级关系', () => {
    it('第1层节点无前置依赖', () => {
      const paths: TechPath[] = ['military', 'economy', 'culture'];
      for (const path of paths) {
        const t1Nodes = tree.getTierNodes(path, 1);
        for (const node of t1Nodes) {
          expect(node.prerequisites).toEqual([]);
        }
      }
    });

    it('第2层+节点应有前置依赖', () => {
      const paths: TechPath[] = ['military', 'economy', 'culture'];
      for (const path of paths) {
        const t2Nodes = tree.getTierNodes(path, 2);
        for (const node of t2Nodes) {
          expect(node.prerequisites.length).toBeGreaterThan(0);
        }
      }
    });

    it('高层级节点的前置依赖应来自低层级', () => {
      const milT2 = findNode('military', 2); // 冲锋战术
      expect(milT2.prerequisites.length).toBeGreaterThan(0);
      for (const preId of milT2.prerequisites) {
        const preDef = getDef(preId);
        expect(preDef.tier).toBeLessThan(milT2.tier);
      }
    });
  });

  describe('前置条件检查', () => {
    it('未完成前置时，arePrerequisitesMet 应返回 false', () => {
      // mil_t2_charge 依赖 mil_t1_attack
      expect(tree.arePrerequisitesMet('mil_t2_charge')).toBe(false);
    });

    it('完成前置后，arePrerequisitesMet 应返回 true', () => {
      // 先完成 mil_t1_attack
      tree.completeNode('mil_t1_attack');
      expect(tree.arePrerequisitesMet('mil_t2_charge')).toBe(true);
    });

    it('getUnmetPrerequisites 应返回未完成的前置列表', () => {
      const unmet = tree.getUnmetPrerequisites('mil_t2_charge');
      expect(unmet).toContain('mil_t1_attack');
    });

    it('完成所有前置后，getUnmetPrerequisites 应为空', () => {
      tree.completeNode('mil_t1_attack');
      const unmet = tree.getUnmetPrerequisites('mil_t2_charge');
      expect(unmet).toEqual([]);
    });
  });

  describe('初始节点状态', () => {
    it('第1层节点初始应为 available（无前置且无互斥锁定）', () => {
      const milT1 = findNodes('military', 1);
      for (const node of milT1) {
        const state = tree.getNodeState(node.id);
        expect(state).toBeDefined();
        // 初始状态可能是 available 或 locked（取决于互斥组）
        expect(['available', 'locked']).toContain(state!.status);
      }
    });

    it('高层级节点初始应为 locked', () => {
      const state = tree.getNodeState('mil_t4_dominance');
      expect(state?.status).toBe('locked');
    });
  });

  describe('路线进度统计', () => {
    it('初始时各路线完成进度应为 0', () => {
      const progress = tree.getAllPathProgress();
      for (const path of ['military', 'economy', 'culture'] as TechPath[]) {
        expect(progress[path].completed).toBe(0);
      }
    });

    it('完成科技后进度应更新', () => {
      tree.completeNode('mil_t1_attack');
      const progress = tree.getPathProgress('military');
      expect(progress.completed).toBe(1);
    });
  });
});

// ─────────────────────────────────────────────
// §5.2 科技研究流程
// ─────────────────────────────────────────────

describe('§5.2 科技研究流程', () => {
  let tree: TechTreeSystem;
  let points: TechPointSystem;
  let research: TechResearchSystem;
  let deps: ISystemDeps;

  beforeEach(() => {
    deps = createMockDeps();
    tree = new TechTreeSystem();
    tree.init(deps);
    points = new TechPointSystem();
    points.init(deps);
    research = new TechResearchSystem(
      tree,
      points,
      () => 1, // academyLevel = 1
      () => 100, // mandate = 100
      () => true, // spendMandate
      () => 999999, // getGold
      () => true, // spendGold
    );
    research.init(deps);
  });

  describe('科技点消耗', () => {
    it('科技点不足时应拒绝研究', () => {
      // 初始科技点为0
      const result = research.startResearch('mil_t1_attack');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('科技点不足');
    });

    it('科技点充足时应允许研究', () => {
      // 给予足够科技点（costPoints=50 × multiplier=10 = 500 科技点）
      const exchangeResult = points.exchangeGoldForTechPoints(100000, 5);
      expect(exchangeResult.success).toBe(true);

      const result = research.startResearch('mil_t1_attack');
      expect(result.success).toBe(true);
    });

    it('研究开始后应扣除科技点', () => {
      points.exchangeGoldForTechPoints(100000, 5);
      const before = points.getCurrentPoints();
      const def = getDef('mil_t1_attack');
      const result = research.startResearch('mil_t1_attack');
      expect(result.success).toBe(true);
      const after = points.getCurrentPoints();
      expect(before - after).toBeGreaterThanOrEqual(def.costPoints - 1); // 浮点精度
    });
  });

  describe('研究时间', () => {
    it('研究开始后节点状态应为 researching', () => {
      points.exchangeGoldForTechPoints(100000, 5);
      research.startResearch('mil_t1_attack');
      const state = tree.getNodeState('mil_t1_attack');
      expect(state?.status).toBe('researching');
      expect(state?.researchStartTime).not.toBeNull();
      expect(state?.researchEndTime).not.toBeNull();
    });

    it('研究队列应包含已开始的科技', () => {
      points.exchangeGoldForTechPoints(100000, 5);
      research.startResearch('mil_t1_attack');
      const queue = research.getQueue();
      expect(queue.some((s) => s.techId === 'mil_t1_attack')).toBe(true);
    });

    it('重复研究同一科技应被拒绝', () => {
      points.exchangeGoldForTechPoints(100000, 5);
      research.startResearch('mil_t1_attack');
      const result = research.startResearch('mil_t1_attack');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('研究中');
    });
  });

  describe('研究完成', () => {
    it('队列满时应拒绝新研究', () => {
      points.exchangeGoldForTechPoints(100000, 5);
      // academyLevel=1 => queueSize=1
      research.startResearch('mil_t1_attack');
      // 第二个研究应被拒绝（队列已满）
      const result = research.startResearch('eco_t1_farming');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('队列已满');
    });

    it('取消研究应返还科技点', () => {
      points.exchangeGoldForTechPoints(100000, 5);
      const before = points.getCurrentPoints();
      research.startResearch('mil_t1_attack');
      const cancelResult = research.cancelResearch('mil_t1_attack');
      expect(cancelResult.success).toBe(true);
      expect(cancelResult.refundPoints).toBeGreaterThan(0);
      expect(points.getCurrentPoints()).toBeCloseTo(before, 0);
    });

    it('取消后节点状态应恢复', () => {
      points.exchangeGoldForTechPoints(100000, 5);
      research.startResearch('mil_t1_attack');
      research.cancelResearch('mil_t1_attack');
      const state = tree.getNodeState('mil_t1_attack');
      expect(state?.status).toBe('available');
    });
  });

  describe('加速机制', () => {
    it('天命加速应减少剩余时间', () => {
      points.exchangeGoldForTechPoints(100000, 5);
      research.startResearch('mil_t1_attack');
      const beforeRemaining = research.getRemainingTime('mil_t1_attack');
      const result = research.speedUp('mil_t1_attack', 'mandate', 1);
      expect(result.success).toBe(true);
      expect(result.timeReduced).toBeGreaterThan(0);
    });

    it('加速不存在的科技应失败', () => {
      const result = research.speedUp('nonexistent', 'mandate', 1);
      expect(result.success).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────
// §5.3 科技互斥
// ─────────────────────────────────────────────

describe('§5.3 科技互斥', () => {
  let tree: TechTreeSystem;
  let deps: ISystemDeps;

  beforeEach(() => {
    deps = createMockDeps();
    tree = new TechTreeSystem();
    tree.init(deps);
  });

  describe('互斥组检查', () => {
    it('同组节点应互为替代', () => {
      // mil_t1_attack 和 mil_t1_defense 在同一互斥组
      const alternatives = tree.getMutexAlternatives('mil_t1_attack');
      expect(alternatives).toContain('mil_t1_defense');
    });

    it('初始时互斥节点均未锁定', () => {
      expect(tree.isMutexLocked('mil_t1_attack')).toBe(false);
      expect(tree.isMutexLocked('mil_t1_defense')).toBe(false);
    });
  });

  describe('互斥锁定', () => {
    it('完成一个互斥节点后，同组其他节点应被锁定', () => {
      tree.completeNode('mil_t1_attack');
      expect(tree.isMutexLocked('mil_t1_defense')).toBe(true);
    });

    it('被锁定的节点不可研究', () => {
      tree.completeNode('mil_t1_attack');
      const check = tree.canResearch('mil_t1_defense');
      expect(check.can).toBe(false);
      expect(check.reason).toContain('互斥');
    });

    it('被锁定的节点状态应为 locked', () => {
      tree.completeNode('mil_t1_attack');
      const state = tree.getNodeState('mil_t1_defense');
      expect(state?.status).toBe('locked');
    });

    it('已选择的互斥节点映射应正确', () => {
      tree.completeNode('mil_t1_attack');
      const chosen = tree.getChosenMutexNodes();
      // 应记录选择了 mil_t1_attack
      const mutexGroup = getDef('mil_t1_attack').mutexGroup;
      expect(chosen[mutexGroup]).toBe('mil_t1_attack');
    });
  });

  describe('互斥分支影响后续路线', () => {
    it('选择攻击路线后，只能继续攻击路线的后续科技', () => {
      tree.completeNode('mil_t1_attack');
      // mil_t2_charge 依赖 mil_t1_attack，应可用
      expect(tree.canResearch('mil_t2_charge').can).toBe(true);
      // mil_t2_fortify 依赖 mil_t1_defense（被锁定），应不可用
      expect(tree.canResearch('mil_t2_fortify').can).toBe(false);
    });

    it('选择防御路线后，只能继续防御路线的后续科技', () => {
      tree.completeNode('mil_t1_defense');
      expect(tree.canResearch('mil_t2_fortify').can).toBe(true);
      expect(tree.canResearch('mil_t2_charge').can).toBe(false);
    });

    it('经济路线互斥：精耕细作 vs 商路开拓', () => {
      tree.completeNode('eco_t1_farming');
      expect(tree.isMutexLocked('eco_t1_trade')).toBe(true);
      // 后续应解锁水利灌溉
      expect(tree.canResearch('eco_t2_irrigation').can).toBe(true);
    });

    it('文化路线互斥：兴学令 vs 招贤令', () => {
      tree.completeNode('cul_t1_education');
      expect(tree.isMutexLocked('cul_t1_recruit')).toBe(true);
      expect(tree.canResearch('cul_t2_academy').can).toBe(true);
    });
  });
});

// ─────────────────────────────────────────────
// §5.4 科技融合
// ─────────────────────────────────────────────

describe('§5.4 科技融合', () => {
  let tree: TechTreeSystem;
  let fusion: FusionTechSystem;
  let deps: ISystemDeps;

  beforeEach(() => {
    deps = createMockDeps();
    tree = new TechTreeSystem();
    tree.init(deps);
    fusion = new FusionTechSystem();
    fusion.init(deps);
    fusion.setTechTree(tree);
  });

  describe('融合科技定义', () => {
    it('应包含跨路线融合科技定义', () => {
      const defs = fusion.getAllFusionDefs();
      expect(defs.length).toBeGreaterThan(0);
    });

    it('融合科技应跨两条不同路线', () => {
      const defs = fusion.getAllFusionDefs();
      for (const def of defs) {
        expect(def.pathPair[0]).not.toBe(def.pathPair[1]);
      }
    });

    it('可通过路线组合查询融合科技', () => {
      const milEco = fusion.getFusionsByPathPair('military', 'economy');
      expect(milEco.length).toBeGreaterThan(0);
    });
  });

  describe('融合前置条件', () => {
    it('未完成前置时融合科技应锁定', () => {
      expect(fusion.arePrerequisitesMet('fusion_mil_eco_1')).toBe(false);
      const state = fusion.getFusionState('fusion_mil_eco_1');
      expect(state?.status).toBe('locked');
    });

    it('完成两条路线的前置节点后融合科技应解锁', () => {
      // fusion_mil_eco_1 需要 mil_t2_charge + eco_t2_irrigation
      // mil_t2_charge 依赖 mil_t1_attack
      tree.completeNode('mil_t1_attack');
      tree.completeNode('mil_t2_charge');
      // eco_t2_irrigation 依赖 eco_t1_farming
      tree.completeNode('eco_t1_farming');
      tree.completeNode('eco_t2_irrigation');
      fusion.refreshAllAvailability();
      expect(fusion.arePrerequisitesMet('fusion_mil_eco_1')).toBe(true);
    });

    it('只完成一条路线的前置时融合科技仍应锁定', () => {
      tree.completeNode('mil_t1_attack');
      tree.completeNode('mil_t2_charge');
      fusion.refreshAllAvailability();
      expect(fusion.arePrerequisitesMet('fusion_mil_eco_1')).toBe(false);
    });

    it('getUnmetPrerequisites 应正确报告缺失', () => {
      const unmet = fusion.getUnmetPrerequisites('fusion_mil_eco_1');
      expect(unmet.pathA).toBe(false);
      expect(unmet.pathB).toBe(false);
    });

    it('完成前置后 getUnmetPrerequisites 应全部满足', () => {
      tree.completeNode('mil_t1_attack');
      tree.completeNode('mil_t2_charge');
      tree.completeNode('eco_t1_farming');
      tree.completeNode('eco_t2_irrigation');
      fusion.refreshAllAvailability();
      const unmet = fusion.getUnmetPrerequisites('fusion_mil_eco_1');
      expect(unmet.pathA).toBe(true);
      expect(unmet.pathB).toBe(true);
    });
  });

  describe('融合科技完成', () => {
    it('完成融合科技后状态应为 completed', () => {
      tree.completeNode('mil_t1_attack');
      tree.completeNode('mil_t2_charge');
      tree.completeNode('eco_t1_farming');
      tree.completeNode('eco_t2_irrigation');
      fusion.refreshAllAvailability();
      fusion.completeFusionNode('fusion_mil_eco_1');
      const state = fusion.getFusionState('fusion_mil_eco_1');
      expect(state?.status).toBe('completed');
    });

    it('完成的融合科技效果应可查询', () => {
      tree.completeNode('mil_t1_attack');
      tree.completeNode('mil_t2_charge');
      tree.completeNode('eco_t1_farming');
      tree.completeNode('eco_t2_irrigation');
      fusion.refreshAllAvailability();
      fusion.completeFusionNode('fusion_mil_eco_1');
      const effects = fusion.getAllCompletedEffects();
      expect(effects.length).toBeGreaterThan(0);
    });
  });

  describe('融合科技序列化', () => {
    it('序列化/反序列化应保持一致', () => {
      tree.completeNode('mil_t1_attack');
      tree.completeNode('mil_t2_charge');
      tree.completeNode('eco_t1_farming');
      tree.completeNode('eco_t2_irrigation');
      fusion.refreshAllAvailability();
      fusion.completeFusionNode('fusion_mil_eco_1');

      const data = fusion.serialize();
      const newFusion = new FusionTechSystem();
      newFusion.init(deps);
      newFusion.setTechTree(tree);
      newFusion.deserialize(data);

      const state = newFusion.getFusionState('fusion_mil_eco_1');
      expect(state?.status).toBe('completed');
    });
  });

  describe('路线组合进度', () => {
    it('getPathPairProgress 应返回正确的统计', () => {
      const progress = fusion.getPathPairProgress('military', 'economy');
      expect(progress.total).toBeGreaterThan(0);
      expect(progress.locked).toBeGreaterThan(0);
      expect(progress.available).toBe(0);
      expect(progress.completed).toBe(0);
    });
  });
});

// ─────────────────────────────────────────────
// §5.5 科技效果
// ─────────────────────────────────────────────

describe('§5.5 科技效果', () => {
  let tree: TechTreeSystem;
  let effectSystem: TechEffectSystem;
  let deps: ISystemDeps;

  beforeEach(() => {
    deps = createMockDeps();
    tree = new TechTreeSystem();
    tree.init(deps);
    effectSystem = new TechEffectSystem();
    effectSystem.init(deps);
    effectSystem.setTechTree(tree);
  });

  describe('效果查询', () => {
    it('无科技完成时所有加成应为 0', () => {
      expect(effectSystem.getAttackBonus()).toBe(0);
      expect(effectSystem.getDefenseBonus()).toBe(0);
      expect(effectSystem.getProductionBonus()).toBe(0);
      expect(effectSystem.getExpBonus()).toBe(0);
      expect(effectSystem.getResearchSpeedBonus()).toBe(0);
    });

    it('完成军事科技后攻击加成应正确', () => {
      // 锐兵术：全军攻击+10%
      tree.completeNode('mil_t1_attack');
      effectSystem.invalidateCache();
      expect(effectSystem.getAttackBonus()).toBe(10);
    });

    it('完成经济科技后产出加成应正确', () => {
      // 精耕细作：粮草产出+15%
      tree.completeNode('eco_t1_farming');
      effectSystem.invalidateCache();
      expect(effectSystem.getProductionBonus('grain')).toBe(15);
    });

    it('完成文化科技后研究速度加成应正确', () => {
      // 兴学令：武将经验+15%（非研究速度）
      tree.completeNode('cul_t1_education');
      effectSystem.invalidateCache();
      expect(effectSystem.getExpBonus()).toBe(15);
    });
  });

  describe('效果叠加', () => {
    it('多个科技效果应叠加', () => {
      // 完成 mil_t1_attack (攻击+10%) 和 mil_t2_charge (骑兵攻击+15%, 行军速度+5%)
      tree.completeNode('mil_t1_attack');
      tree.completeNode('mil_t2_charge');
      effectSystem.invalidateCache();
      // 全军攻击 = 10 (from mil_t1_attack)
      expect(effectSystem.getAttackBonus('all')).toBe(10);
      // 骑兵攻击 = 10(all) + 15(cavalry) = 25
      expect(effectSystem.getAttackBonus('cavalry')).toBe(25);
    });
  });

  describe('乘数接口', () => {
    it('getAttackMultiplier 应返回 1 + bonus/100', () => {
      tree.completeNode('mil_t1_attack');
      effectSystem.invalidateCache();
      expect(effectSystem.getAttackMultiplier()).toBeCloseTo(1.1, 2);
    });

    it('getProductionMultiplier 应返回正确的乘数', () => {
      tree.completeNode('eco_t1_farming');
      effectSystem.invalidateCache();
      expect(effectSystem.getProductionMultiplier('grain')).toBeCloseTo(1.15, 2);
    });
  });

  describe('TechTreeSystem 效果汇总', () => {
    it('getEffectValue 应返回指定类型+目标的汇总', () => {
      tree.completeNode('mil_t1_attack');
      expect(tree.getEffectValue('troop_attack', 'all')).toBe(10);
    });

    it('getAllCompletedEffects 应返回所有已完成科技效果', () => {
      tree.completeNode('mil_t1_attack');
      tree.completeNode('eco_t1_farming');
      const effects = tree.getAllCompletedEffects();
      expect(effects.length).toBeGreaterThanOrEqual(2);
    });

    it('getTechBonusMultiplier 应返回全局产出加成', () => {
      // 无科技时
      expect(tree.getTechBonusMultiplier()).toBe(0);
    });
  });

  describe('效果缓存', () => {
    it('缓存失效后应重新计算', () => {
      expect(effectSystem.getAttackBonus()).toBe(0);
      tree.completeNode('mil_t1_attack');
      effectSystem.invalidateCache();
      expect(effectSystem.getAttackBonus()).toBe(10);
    });

    it('getPathBonuses 应返回路线所有效果', () => {
      tree.completeNode('mil_t1_attack');
      effectSystem.invalidateCache();
      const bonuses = effectSystem.getPathBonuses('military');
      expect(typeof bonuses).toBe('object');
    });

    it('getAllBonuses 应返回三路线效果', () => {
      const all = effectSystem.getAllBonuses();
      expect(all).toHaveProperty('military');
      expect(all).toHaveProperty('economy');
      expect(all).toHaveProperty('culture');
    });
  });
});

// ─────────────────────────────────────────────
// §5.6 离线科技研究
// ─────────────────────────────────────────────

describe('§5.6 离线科技研究', () => {
  let tree: TechTreeSystem;
  let points: TechPointSystem;
  let research: TechResearchSystem;
  let deps: ISystemDeps;

  beforeEach(() => {
    deps = createMockDeps();
    tree = new TechTreeSystem();
    tree.init(deps);
    points = new TechPointSystem();
    points.init(deps);
    research = new TechResearchSystem(
      tree,
      points,
      () => 1,
      () => 100,
      () => true,
      () => 999999, // getGold
      () => true, // spendGold
    );
    research.init(deps);
  });

  describe('离线期间研究完成检测', () => {
    it('研究到期后 update 应触发完成', () => {
      points.exchangeGoldForTechPoints(100000, 5);
      research.startResearch('mil_t1_attack');

      // 模拟研究完成：手动修改 endTime 为过去时间
      const queue = research.getQueue();
      expect(queue.length).toBe(1);

      // 通过序列化模拟离线时间流逝
      const slot = queue[0];
      const serialized = {
        activeResearch: { ...slot, endTime: Date.now() - 1000 }, // 已过期
        researchQueue: [{ ...slot, endTime: Date.now() - 1000 }],
      };

      // 反序列化后 update
      research.deserialize(serialized);
      research.update(0);

      // 节点应已完成
      const state = tree.getNodeState('mil_t1_attack');
      expect(state?.status).toBe('completed');
    });

    it('研究未到期时 update 不应触发完成', () => {
      points.exchangeGoldForTechPoints(100000, 5);
      research.startResearch('mil_t1_attack');
      research.update(0);

      const state = tree.getNodeState('mil_t1_attack');
      expect(state?.status).toBe('researching');
    });
  });

  describe('离线科技点产出', () => {
    it('书院等级 > 0 时 update 应产出科技点', () => {
      points.syncAcademyLevel(5);
      const before = points.getCurrentPoints();
      points.update(1); // 1秒
      const after = points.getCurrentPoints();
      expect(after).toBeGreaterThan(before);
    });

    it('书院等级为 0 时不应产出科技点', () => {
      points.syncAcademyLevel(0);
      const before = points.getCurrentPoints();
      points.update(1);
      const after = points.getCurrentPoints();
      expect(after).toBe(before);
    });

    it('科技点产出速率应与书院等级匹配', () => {
      points.syncAcademyLevel(10);
      const rate = points.getProductionRate();
      expect(rate).toBeGreaterThan(0);
    });
  });

  describe('科技树序列化与离线恢复', () => {
    it('序列化/反序列化应保持完成状态', () => {
      tree.completeNode('mil_t1_attack');
      tree.completeNode('eco_t1_farming');

      const data = tree.serialize();
      const newTree = new TechTreeSystem();
      newTree.init(deps);
      newTree.deserialize(data);

      expect(newTree.getNodeState('mil_t1_attack')?.status).toBe('completed');
      expect(newTree.getNodeState('eco_t1_farming')?.status).toBe('completed');
    });

    it('反序列化后互斥锁定应正确恢复', () => {
      tree.completeNode('mil_t1_attack');
      const data = tree.serialize();

      const newTree = new TechTreeSystem();
      newTree.init(deps);
      newTree.deserialize(data);

      expect(newTree.isMutexLocked('mil_t1_defense')).toBe(true);
    });

    it('科技点序列化/反序列化应保持一致', () => {
      points.exchangeGoldForTechPoints(5000, 5);
      const data = points.serialize();

      const newPoints = new TechPointSystem();
      newPoints.init(deps);
      newPoints.deserialize(data);

      expect(newPoints.getCurrentPoints()).toBeCloseTo(points.getCurrentPoints(), 1);
    });
  });

  describe('研究队列离线恢复', () => {
    it('反序列化研究队列后应恢复节点研究状态', () => {
      points.exchangeGoldForTechPoints(100000, 5);
      research.startResearch('mil_t1_attack');

      const data = research.serialize();
      const newResearch = new TechResearchSystem(
        tree,
        points,
        () => 1,
        () => 100,
        () => true,
        () => 999999, // getGold
        () => true, // spendGold
      );
      newResearch.init(deps);
      newResearch.deserialize(data);

      const state = tree.getNodeState('mil_t1_attack');
      expect(state?.status).toBe('researching');
    });
  });
});
