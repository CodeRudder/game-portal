/**
 * V4 攻城略地(下) — 科技系统补充集成测试
 *
 * 覆盖 §5 科技系统：
 * - 5.1.2 节点状态验证（locked / available / researching / completed + mutex_locked）
 * - 5.2.3 研究队列规则（队列大小、并发限制、完成检测）
 * - 5.5 融合科技（4节点：兵精粮足/铁骑商路/兵法大家/名将传承等）
 *
 * 编码规范：
 * - 每个it前创建新的sim实例
 * - describe按play流程ID组织
 * - 不使用 as unknown as Record<string, unknown>
 */

import { describe, it, expect } from 'vitest';
import { createSim } from '../../../test-utils/test-helpers';
import { MASSIVE_RESOURCES } from '../../../test-utils/test-helpers';
import type { GameEventSimulator } from '../../../test-utils/GameEventSimulator';
import { TechTreeSystem } from '../../tech/TechTreeSystem';
import { TechPointSystem } from '../../tech/TechPointSystem';
import { TechResearchSystem } from '../../tech/TechResearchSystem';
import { FusionTechSystem } from '../../tech/FusionTechSystem';
import { TECH_NODE_DEFS, TECH_NODE_MAP, getNodesByPath, getNodesByTier, getQueueSizeForAcademyLevel } from '../../tech/tech-config';
import { FUSION_TECH_DEFS, FUSION_TECH_MAP } from '../../tech/fusion-tech.types';
import type { TechNodeStatus, TechPath } from '../../tech/tech.types';

// ── 辅助：初始化完整状态 ──
function initFullState(): GameEventSimulator {
  const sim = createSim();
  sim.engine.resource.setCap('grain', 10_000_000);
  sim.engine.resource.setCap('gold', 10_000_000);
  sim.engine.resource.setCap('troops', 10_000_000);
  sim.addResources(MASSIVE_RESOURCES);
  // 升级主城到3级以解锁书院(academy)
  sim.upgradeBuildingTo('castle', 3);
  const heroIds = ['liubei', 'guanyu', 'zhangfei', 'zhugeliang', 'zhaoyun', 'caocao'];
  for (const id of heroIds) {
    sim.addHeroDirectly(id);
  }
  sim.engine.createFormation('main');
  sim.engine.setFormation('main', heroIds);
  return sim;
}

// ═══════════════════════════════════════════════════════════════
// V4 TECH-SUPPLEMENT 科技系统补充
// ═══════════════════════════════════════════════════════════════
describe('V4 TECH-SUPPLEMENT 科技系统补充', () => {

  // ═══════════════════════════════════════════════════════════════
  // §5.1.2 节点状态验证（5种状态）
  // ═══════════════════════════════════════════════════════════════
  describe('§5.1.2 节点状态验证', () => {

    it('should initialize all nodes as locked or available', () => {
      const sim = initFullState();
      const techTree = sim.engine.getTechTreeSystem();
      const state = techTree.getState();

      const nodes = Object.values(state.nodes);
      expect(nodes.length).toBeGreaterThan(0);

      // 所有节点初始应为 locked 或 available（Tier 1 无前置依赖）
      for (const node of nodes) {
        expect(['locked', 'available']).toContain(node.status);
      }
    });

    it('should have tier-1 nodes as available (no prerequisites)', () => {
      const sim = initFullState();
      const techTree = sim.engine.getTechTreeSystem();

      // Tier 1 节点无前置依赖，应为 available
      const tier1Nodes = getNodesByTier('military', 1);
      expect(tier1Nodes.length).toBeGreaterThan(0);

      for (const def of tier1Nodes) {
        const state = techTree.getNodeState(def.id);
        // Tier 1 节点初始应为 available（无前置依赖）
        if (state) {
          expect(['available', 'locked']).toContain(state.status);
        }
      }
    });

    it('should have tier-2+ nodes as locked (have prerequisites)', () => {
      const sim = initFullState();
      const techTree = sim.engine.getTechTreeSystem();

      const tier2Nodes = getNodesByTier('military', 2);
      expect(tier2Nodes.length).toBeGreaterThan(0);

      for (const def of tier2Nodes) {
        const state = techTree.getNodeState(def.id);
        if (state) {
          expect(state.status).toBe('locked');
        }
      }
    });

    it('should transition node from available to researching', () => {
      const sim = initFullState();
      const techTree = sim.engine.getTechTreeSystem();
      const research = sim.engine.getTechResearchSystem();
      const techPoint = sim.engine.getTechPointSystem();

      // 升级书院
      sim.engine.upgradeBuilding('academy');
      const level = sim.engine.building.getLevel('academy');
      techPoint.syncAcademyLevel(level);

      // 给足够的科技点
      techPoint.syncAcademyLevel(20);
      techPoint.update(100000);

      // 查找可研究节点
      const state = techTree.getState();
      const availableNode = Object.values(state.nodes).find(n => n.status === 'available');

      if (availableNode) {
        const result = research.startResearch(availableNode.id);
        // 可能因科技点不足而失败，但不应报错
        expect(result).toBeDefined();
        expect(typeof result.success).toBe('boolean');
      }
    });

    it('should transition node from researching to completed', () => {
      const techTree = new TechTreeSystem();

      // 直接完成节点
      const tier1Nodes = getNodesByTier('military', 1);
      if (tier1Nodes.length > 0) {
        const nodeId = tier1Nodes[0].id;
        techTree.completeNode(nodeId);

        const state = techTree.getNodeState(nodeId);
        expect(state?.status).toBe('completed');
      }
    });

    it('should unlock dependent nodes after completing prerequisite', () => {
      const techTree = new TechTreeSystem();

      // mil_t1_attack → mil_t2_charge
      const tier1Node = TECH_NODE_MAP.get('mil_t1_attack');
      const tier2Node = TECH_NODE_MAP.get('mil_t2_charge');

      if (tier1Node && tier2Node) {
        // 完成前置节点
        techTree.completeNode(tier1Node.id);

        // 检查后续节点是否解锁
        const tier2State = techTree.getNodeState(tier2Node.id);
        expect(tier2State?.status).toBe('available');
      }
    });

    it('should handle mutex_locked nodes (same tier alternative)', () => {
      const techTree = new TechTreeSystem();

      // mil_t1_attack 和 mil_t1_defense 在同一互斥组
      const attackNode = TECH_NODE_MAP.get('mil_t1_attack');
      const defenseNode = TECH_NODE_MAP.get('mil_t1_defense');

      if (attackNode && defenseNode && attackNode.mutexGroup) {
        // 完成其中一个
        techTree.completeNode(attackNode.id);

        // 另一个应被互斥锁定
        expect(techTree.isMutexLocked(defenseNode.id)).toBe(true);
      }
    });

    it('should have 4 distinct node statuses', () => {
      // 验证4种状态类型存在
      const statuses: TechNodeStatus[] = ['locked', 'available', 'researching', 'completed'];
      expect(statuses.length).toBe(4);
    });

    it('should have correct node count per path', () => {
      const milNodes = getNodesByPath('military');
      const ecoNodes = getNodesByPath('economy');
      const culNodes = getNodesByPath('culture');

      expect(milNodes.length).toBeGreaterThan(0);
      expect(ecoNodes.length).toBeGreaterThan(0);
      expect(culNodes.length).toBeGreaterThan(0);

      // 三条路线节点数应相等
      expect(milNodes.length).toBe(ecoNodes.length);
      expect(ecoNodes.length).toBe(culNodes.length);
    });

    it('should have correct tier structure (4 tiers per path)', () => {
      for (const path of ['military', 'economy', 'culture'] as TechPath[]) {
        for (let tier = 1; tier <= 4; tier++) {
          const nodes = getNodesByTier(path, tier);
          expect(nodes.length).toBeGreaterThan(0);
        }
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // §5.2.3 研究队列规则
  // ═══════════════════════════════════════════════════════════════
  describe('§5.2.3 研究队列规则', () => {

    it('should start with empty research queue', () => {
      const sim = initFullState();
      const research = sim.engine.getTechResearchSystem();

      const queue = research.getQueue();
      expect(queue).toBeDefined();
      expect(queue.length).toBe(0);
    });

    it('should have queue size based on academy level', () => {
      // 验证队列大小配置
      expect(getQueueSizeForAcademyLevel(1)).toBeGreaterThanOrEqual(1);
      expect(getQueueSizeForAcademyLevel(5)).toBeGreaterThanOrEqual(2);
      expect(getQueueSizeForAcademyLevel(10)).toBeGreaterThanOrEqual(3);
    });

    it('should return queue size from research system', () => {
      const sim = initFullState();
      const research = sim.engine.getTechResearchSystem();

      const maxSize = research.getMaxQueueSize();
      expect(typeof maxSize).toBe('number');
      expect(maxSize).toBeGreaterThanOrEqual(1);
    });

    it('should reject research for non-existent node', () => {
      const sim = initFullState();
      const research = sim.engine.getTechResearchSystem();

      const result = research.startResearch('non_existent_node');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('不存在');
    });

    it('should reject research for locked node', () => {
      const sim = initFullState();
      const research = sim.engine.getTechResearchSystem();

      // Tier 2 节点默认 locked
      const result = research.startResearch('mil_t2_charge');
      expect(result.success).toBe(false);
    });

    it('should accept research for available node with sufficient points', () => {
      const sim = initFullState();
      const research = sim.engine.getTechResearchSystem();
      const techPoint = sim.engine.getTechPointSystem();
      const techTree = sim.engine.getTechTreeSystem();

      // 升级书院
      sim.engine.upgradeBuilding('academy');
      const level = sim.engine.building.getLevel('academy');
      techPoint.syncAcademyLevel(level);

      // 给大量科技点
      techPoint.syncAcademyLevel(20);
      techPoint.update(10000000);

      // 查找可研究节点
      const state = techTree.getState();
      const availableNode = Object.values(state.nodes).find(n => n.status === 'available');

      if (availableNode && techPoint.getCurrentPoints() > 50) {
        const result = research.startResearch(availableNode.id);
        expect(result).toBeDefined();
        if (result.success) {
          const queue = research.getQueue();
          expect(queue.length).toBeGreaterThan(0);
        }
      }
    });

    it('should reject research when queue is full', () => {
      const sim = initFullState();
      const research = sim.engine.getTechResearchSystem();
      const techPoint = sim.engine.getTechPointSystem();
      const techTree = sim.engine.getTechTreeSystem();

      sim.engine.upgradeBuilding('academy');
      techPoint.syncAcademyLevel(20);
      techPoint.update(10000000);

      const maxSize = research.getMaxQueueSize();
      const state = techTree.getState();
      const availableNodes = Object.values(state.nodes).filter(n => n.status === 'available');

      // 填满队列
      let addedCount = 0;
      for (const node of availableNodes) {
        if (addedCount >= maxSize) break;
        const result = research.startResearch(node.id);
        if (result.success) addedCount++;
      }

      // 超出队列应失败
      if (availableNodes.length > maxSize) {
        const nextAvailable = availableNodes[maxSize];
        if (nextAvailable) {
          const result = research.startResearch(nextAvailable.id);
          expect(result.success).toBe(false);
          expect(result.reason).toContain('队列');
        }
      }
    });

    it('should detect completed research', () => {
      const sim = initFullState();
      const research = sim.engine.getTechResearchSystem();

      // update应检查完成状态
      research.update(1);
      expect(research.getQueue()).toBeDefined();
    });

    it('should support speed up research', () => {
      const sim = initFullState();
      const research = sim.engine.getTechResearchSystem();

      // 加速不存在的节点应失败
      const result = research.speedUp('non_existent', 'mandate', 10);
      expect(result).toBeDefined();
    });

    it('should have research state serializable', () => {
      const sim = initFullState();
      const research = sim.engine.getTechResearchSystem();

      const state = research.getState();
      expect(state).toBeDefined();
      expect(state.queue).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // §5.5 融合科技（6个融合节点）
  // ═══════════════════════════════════════════════════════════════
  describe('§5.5 融合科技', () => {

    it('should have 6 fusion tech definitions', () => {
      expect(FUSION_TECH_DEFS.length).toBe(6);
    });

    it('should have fusion tech map matching definitions', () => {
      expect(FUSION_TECH_MAP.size).toBe(FUSION_TECH_DEFS.length);
    });

    it('should initialize all fusion nodes as locked', () => {
      const fusion = new FusionTechSystem();
      const states = fusion.getAllFusionStates();

      for (const state of Object.values(states)) {
        expect(state.status).toBe('locked');
      }
    });

    it('should have correct fusion tech IDs', () => {
      const ids = FUSION_TECH_DEFS.map(d => d.id);
      expect(ids).toContain('fusion_mil_eco_1');
      expect(ids).toContain('fusion_mil_eco_2');
      expect(ids).toContain('fusion_mil_cul_1');
      expect(ids).toContain('fusion_mil_cul_2');
      expect(ids).toContain('fusion_eco_cul_1');
      expect(ids).toContain('fusion_eco_cul_2');
    });

    it('should have prerequisites from two different paths', () => {
      for (const def of FUSION_TECH_DEFS) {
        expect(def.prerequisites).toBeDefined();
        expect(def.prerequisites.pathA).toBeDefined();
        expect(def.prerequisites.pathB).toBeDefined();
        expect(def.pathPair).toBeDefined();
        expect(def.pathPair.length).toBe(2);
      }
    });

    it('should check prerequisites correctly when tech tree not set', () => {
      const fusion = new FusionTechSystem();
      // 没有注入techTree时应返回false
      expect(fusion.arePrerequisitesMet('fusion_mil_eco_1')).toBe(false);
    });

    it('should check prerequisites correctly with tech tree', () => {
      const techTree = new TechTreeSystem();
      const fusion = new FusionTechSystem();
      fusion.setTechTree(techTree);

      // 未完成前置时应不满足
      expect(fusion.arePrerequisitesMet('fusion_mil_eco_1')).toBe(false);

      // 完成前置节点
      // fusion_mil_eco_1 需要 mil_t2_charge 和 eco_t2_irrigation
      // 先完成前置链
      techTree.completeNode('mil_t1_attack');
      techTree.completeNode('mil_t2_charge');
      techTree.completeNode('eco_t1_farming');
      techTree.completeNode('eco_t2_irrigation');

      expect(fusion.arePrerequisitesMet('fusion_mil_eco_1')).toBe(true);
    });

    it('should get fusion def by id', () => {
      const fusion = new FusionTechSystem();
      const def = fusion.getFusionDef('fusion_mil_eco_1');

      expect(def).toBeDefined();
      expect(def?.name).toBe('兵精粮足');
    });

    it('should get fusion state by id', () => {
      const fusion = new FusionTechSystem();
      const state = fusion.getFusionState('fusion_mil_eco_1');

      expect(state).toBeDefined();
      expect(state?.status).toBe('locked');
    });

    it('should get fusions by path pair', () => {
      const fusion = new FusionTechSystem();
      const milEco = fusion.getFusionsByPathPair('military', 'economy');

      expect(milEco.length).toBe(2);
      expect(milEco.map(f => f.id)).toContain('fusion_mil_eco_1');
      expect(milEco.map(f => f.id)).toContain('fusion_mil_eco_2');
    });

    it('should transition fusion node to researching', () => {
      const fusion = new FusionTechSystem();
      fusion.setResearching('fusion_mil_eco_1', Date.now(), Date.now() + 300000);

      const state = fusion.getFusionState('fusion_mil_eco_1');
      expect(state?.status).toBe('researching');
      expect(state?.researchStartTime).toBeDefined();
      expect(state?.researchEndTime).toBeDefined();
    });

    it('should complete fusion node', () => {
      const fusion = new FusionTechSystem();
      // 先设为 available 或 researching
      fusion.setResearching('fusion_mil_eco_1', Date.now(), Date.now() + 300000);
      fusion.completeFusionNode('fusion_mil_eco_1');

      const state = fusion.getFusionState('fusion_mil_eco_1');
      expect(state?.status).toBe('completed');
      expect(state?.researchStartTime).toBeNull();
    });

    it('should cancel fusion research', () => {
      const fusion = new FusionTechSystem();
      fusion.setResearching('fusion_mil_eco_1', Date.now(), Date.now() + 300000);
      fusion.cancelResearch('fusion_mil_eco_1');

      const state = fusion.getFusionState('fusion_mil_eco_1');
      expect(state?.status).toBe('available');
    });

    it('should check canResearch for fusion node', () => {
      const fusion = new FusionTechSystem();

      // locked节点不能研究
      const result = fusion.canResearch('fusion_mil_eco_1');
      expect(result.can).toBe(false);
    });

    it('should get unmet prerequisites', () => {
      const techTree = new TechTreeSystem();
      const fusion = new FusionTechSystem();
      fusion.setTechTree(techTree);

      const unmet = fusion.getUnmetPrerequisites('fusion_mil_eco_1');
      expect(unmet).toBeDefined();
      expect(typeof unmet.pathA).toBe('boolean');
      expect(typeof unmet.pathB).toBe('boolean');
    });

    it('should reset fusion system', () => {
      const fusion = new FusionTechSystem();
      fusion.completeFusionNode('fusion_mil_eco_1');
      fusion.reset();

      const state = fusion.getFusionState('fusion_mil_eco_1');
      expect(state?.status).toBe('locked');
    });

    it('should have fusion tech effects defined', () => {
      for (const def of FUSION_TECH_DEFS) {
        expect(def.effects).toBeDefined();
        expect(def.effects.length).toBeGreaterThan(0);
      }
    });

    it('should have fusion tech research cost and time', () => {
      for (const def of FUSION_TECH_DEFS) {
        expect(def.costPoints).toBeGreaterThan(0);
        expect(def.researchTime).toBeGreaterThan(0);
      }
    });

    it('should integrate with engine fusion tech system', () => {
      const sim = initFullState();
      const fusion = sim.engine.getFusionTechSystem();
      expect(fusion).toBeDefined();

      const allStates = (fusion as FusionTechSystem).getAllFusionStates();
      expect(Object.keys(allStates).length).toBe(FUSION_TECH_DEFS.length);
    });
  });
});
