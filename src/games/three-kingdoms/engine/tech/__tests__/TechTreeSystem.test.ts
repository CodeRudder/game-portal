import { vi } from 'vitest';
/**
 * TechTreeSystem 单元测试
 * 覆盖：节点管理、三条科技路线、前置依赖、互斥分支、效果汇总、序列化
 */

import { TechTreeSystem } from '../TechTreeSystem';
import type { TechPath, TechNodeState } from '../tech.types';
import { TECH_PATHS, TECH_PATH_LABELS, TECH_PATH_COLORS } from '../tech.types';
import { TECH_NODE_DEFS, TECH_NODE_MAP, TECH_EDGES } from '../tech-config';
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

describe('TechTreeSystem', () => {
  let sys: TechTreeSystem;

  beforeEach(() => {
    sys = new TechTreeSystem();
    sys.init(mockDeps());
  });

  // ═══════════════════════════════════════════
  // 1. 初始化 & 三条路线
  // ═══════════════════════════════════════════
  describe('初始化与三条科技路线', () => {
    it('三条路线全部存在', () => {
      expect(TECH_PATHS).toHaveLength(3);
      expect(TECH_PATHS).toContain('military');
      expect(TECH_PATHS).toContain('economy');
      expect(TECH_PATHS).toContain('culture');
    });

    it('路线标签正确', () => {
      expect(TECH_PATH_LABELS.military).toBe('军事');
      expect(TECH_PATH_LABELS.economy).toBe('经济');
      expect(TECH_PATH_LABELS.culture).toBe('文化');
    });

    it('路线颜色正确：红/黄/紫', () => {
      expect(TECH_PATH_COLORS.military).toBe('#DC2626');
      expect(TECH_PATH_COLORS.economy).toBe('#D97706');
      expect(TECH_PATH_COLORS.culture).toBe('#7C3AED');
    });

    it('每条路线都有节点', () => {
      for (const path of TECH_PATHS) {
        const nodes = sys.getPathNodes(path);
        expect(nodes.length).toBeGreaterThan(0);
      }
    });

    it('所有节点都有定义', () => {
      const allStates = sys.getAllNodeStates();
      expect(Object.keys(allStates)).toHaveLength(TECH_NODE_DEFS.length);
    });

    it('每条路线有 4 个层级', () => {
      for (const path of TECH_PATHS) {
        for (let tier = 1; tier <= 4; tier++) {
          const nodes = sys.getTierNodes(path, tier);
          expect(nodes.length).toBeGreaterThan(0);
        }
      }
    });
  });

  // ═══════════════════════════════════════════
  // 2. 节点管理
  // ═══════════════════════════════════════════
  describe('节点管理', () => {
    it('Tier 1 节点初始为 available（无前置依赖）', () => {
      for (const path of TECH_PATHS) {
        const t1Nodes = sys.getTierNodes(path, 1);
        for (const node of t1Nodes) {
          const state = sys.getNodeState(node.id);
          expect(state?.status).toBe('available');
        }
      }
    });

    it('Tier 2+ 节点初始为 locked（有前置依赖）', () => {
      for (const path of TECH_PATHS) {
        for (let tier = 2; tier <= 4; tier++) {
          const nodes = sys.getTierNodes(path, tier);
          for (const node of nodes) {
            const state = sys.getNodeState(node.id);
            expect(state?.status).toBe('locked');
          }
        }
      }
    });

    it('可以获取节点定义', () => {
      const def = sys.getNodeDef('mil_t1_attack');
      expect(def).toBeDefined();
      expect(def!.name).toBe('锐兵术');
      expect(def!.path).toBe('military');
      expect(def!.tier).toBe(1);
    });

    it('不存在的节点返回 undefined', () => {
      expect(sys.getNodeDef('nonexistent')).toBeUndefined();
      expect(sys.getNodeState('nonexistent')).toBeUndefined();
    });

    it('所有节点定义都有必要字段', () => {
      for (const def of TECH_NODE_DEFS) {
        expect(def.id).toBeTruthy();
        expect(def.name).toBeTruthy();
        expect(def.path).toBeTruthy();
        expect(def.tier).toBeGreaterThanOrEqual(1);
        expect(def.costPoints).toBeGreaterThan(0);
        expect(def.researchTime).toBeGreaterThan(0);
        expect(def.effects.length).toBeGreaterThan(0);
      }
    });
  });

  // ═══════════════════════════════════════════
  // 3. 前置依赖
  // ═══════════════════════════════════════════
  describe('前置依赖', () => {
    it('Tier 1 节点前置依赖为空，自动满足', () => {
      for (const path of TECH_PATHS) {
        const t1Nodes = sys.getTierNodes(path, 1);
        for (const node of t1Nodes) {
          expect(node.prerequisites).toHaveLength(0);
          expect(sys.arePrerequisitesMet(node.id)).toBe(true);
        }
      }
    });

    it('Tier 2 节点前置依赖未满足', () => {
      for (const path of TECH_PATHS) {
        const t2Nodes = sys.getTierNodes(path, 2);
        for (const node of t2Nodes) {
          expect(sys.arePrerequisitesMet(node.id)).toBe(false);
          expect(sys.getUnmetPrerequisites(node.id).length).toBeGreaterThan(0);
        }
      }
    });

    it('完成前置后，后续节点变为 available', () => {
      // 完成 mil_t1_attack
      sys.completeNode('mil_t1_attack');

      // mil_t2_charge 的前置是 mil_t1_attack，应变为 available
      const state = sys.getNodeState('mil_t2_charge');
      expect(state?.status).toBe('available');
    });

    it('未完成所有前置时，节点仍为 locked', () => {
      // mil_t2_charge 需要 mil_t1_attack
      // 不完成前置
      expect(sys.arePrerequisitesMet('mil_t2_charge')).toBe(false);
    });

    it('连线数据包含前置依赖连线', () => {
      const prereqEdges = TECH_EDGES.filter((e) => e.type === 'prerequisite');
      expect(prereqEdges.length).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════
  // 4. 互斥分支
  // ═══════════════════════════════════════════
  describe('互斥分支', () => {
    it('Tier 1 有互斥节点', () => {
      for (const path of TECH_PATHS) {
        const t1Nodes = sys.getTierNodes(path, 1);
        const mutexNodes = t1Nodes.filter((n) => n.mutexGroup !== '');
        expect(mutexNodes.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('选择一个互斥节点后，另一个被锁定', () => {
      // 选择 mil_t1_attack
      sys.completeNode('mil_t1_attack');

      // mil_t1_defense 应被锁定
      const defenseState = sys.getNodeState('mil_t1_defense');
      expect(defenseState?.status).toBe('locked');
      expect(sys.isMutexLocked('mil_t1_defense')).toBe(true);
    });

    it('已选节点自身不被互斥锁定', () => {
      sys.completeNode('mil_t1_attack');
      expect(sys.isMutexLocked('mil_t1_attack')).toBe(false);
    });

    it('canResearch 正确拒绝互斥锁定的节点', () => {
      sys.completeNode('mil_t1_attack');
      const result = sys.canResearch('mil_t1_defense');
      expect(result.can).toBe(false);
      expect(result.reason).toContain('互斥');
    });

    it('获取互斥替代节点', () => {
      const alts = sys.getMutexAlternatives('mil_t1_attack');
      expect(alts).toContain('mil_t1_defense');
    });

    it('连线数据包含互斥连线', () => {
      const mutexEdges = TECH_EDGES.filter((e) => e.type === 'mutex');
      expect(mutexEdges.length).toBeGreaterThan(0);
    });

    it('互斥选择记录在 chosenMutexNodes 中', () => {
      sys.completeNode('mil_t1_attack');
      const chosen = sys.getChosenMutexNodes();
      const mutexKey = 'mil_t1';
      expect(chosen[mutexKey]).toBe('mil_t1_attack');
    });
  });

  // ═══════════════════════════════════════════
  // 5. 状态变更
  // ═══════════════════════════════════════════
  describe('状态变更', () => {
    it('setResearching 正确设置状态', () => {
      const now = Date.now();
      sys.setResearching('mil_t1_attack', now, now + 120000);
      const state = sys.getNodeState('mil_t1_attack');
      expect(state?.status).toBe('researching');
      expect(state?.researchStartTime).toBe(now);
      expect(state?.researchEndTime).toBe(now + 120000);
    });

    it('cancelResearch 恢复节点为 available', () => {
      const now = Date.now();
      sys.setResearching('mil_t1_attack', now, now + 120000);
      sys.cancelResearch('mil_t1_attack');
      const state = sys.getNodeState('mil_t1_attack');
      expect(state?.status).toBe('available');
      expect(state?.researchStartTime).toBeNull();
    });

    it('completeNode 设置完成状态', () => {
      sys.completeNode('mil_t1_attack');
      const state = sys.getNodeState('mil_t1_attack');
      expect(state?.status).toBe('completed');
    });

    it('canResearch 拒绝已完成的节点', () => {
      sys.completeNode('mil_t1_attack');
      const result = sys.canResearch('mil_t1_attack');
      expect(result.can).toBe(false);
      expect(result.reason).toContain('已完成');
    });

    it('canResearch 拒绝研究中的节点', () => {
      sys.setResearching('mil_t1_attack', Date.now(), Date.now() + 120000);
      const result = sys.canResearch('mil_t1_attack');
      expect(result.can).toBe(false);
      expect(result.reason).toContain('研究中');
    });

    it('canResearch 拒绝不存在的节点', () => {
      const result = sys.canResearch('nonexistent');
      expect(result.can).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // 6. 效果汇总
  // ═══════════════════════════════════════════
  describe('效果汇总', () => {
    it('初始无效果', () => {
      expect(sys.getAllCompletedEffects()).toHaveLength(0);
    });

    it('完成节点后获取效果', () => {
      sys.completeNode('mil_t1_attack');
      const effects = sys.getAllCompletedEffects();
      expect(effects.length).toBeGreaterThan(0);
    });

    it('getEffectValue 正确汇总', () => {
      sys.completeNode('mil_t1_attack');
      const value = sys.getEffectValue('troop_attack', 'all');
      expect(value).toBe(10); // 锐兵术 +10% 攻击
    });

    it('多个完成节点效果叠加', () => {
      sys.completeNode('mil_t1_attack');
      sys.completeNode('eco_t1_farming');
      const attackBonus = sys.getEffectValue('troop_attack', 'all');
      const grainBonus = sys.getEffectValue('resource_production', 'grain');
      expect(attackBonus).toBe(10);
      expect(grainBonus).toBe(15);
    });

    it('getTechBonusMultiplier 返回资源产出加成', () => {
      // eco_t3_marketplace 有 target='all' 的 resource_production 效果
      // 但需要先完成前置，直接用 completeNode 模拟
      sys.completeNode('eco_t1_trade');
      sys.completeNode('eco_t2_minting');
      sys.completeNode('eco_t3_marketplace');
      const mult = sys.getTechBonusMultiplier();
      expect(mult).toBeCloseTo(0.10); // +10% 全资源产出
    });
  });

  // ═══════════════════════════════════════════
  // 7. 路线进度
  // ═══════════════════════════════════════════
  describe('路线进度', () => {
    it('初始进度为 0', () => {
      for (const path of TECH_PATHS) {
        const progress = sys.getPathProgress(path);
        expect(progress.completed).toBe(0);
        expect(progress.total).toBeGreaterThan(0);
      }
    });

    it('完成节点后进度增加', () => {
      sys.completeNode('mil_t1_attack');
      const progress = sys.getPathProgress('military');
      expect(progress.completed).toBe(1);
    });

    it('getAllPathProgress 返回三条路线', () => {
      const all = sys.getAllPathProgress();
      expect(Object.keys(all)).toHaveLength(3);
    });
  });

  // ═══════════════════════════════════════════
  // 8. 序列化
  // ═══════════════════════════════════════════
  describe('序列化/反序列化', () => {
    it('序列化空的科技树', () => {
      const data = sys.serialize();
      expect(data.completedTechIds).toHaveLength(0);
    });

    it('序列化已完成的科技', () => {
      sys.completeNode('mil_t1_attack');
      sys.completeNode('eco_t1_farming');
      const data = sys.serialize();
      expect(data.completedTechIds).toContain('mil_t1_attack');
      expect(data.completedTechIds).toContain('eco_t1_farming');
    });

    it('序列化互斥选择', () => {
      sys.completeNode('mil_t1_attack');
      const data = sys.serialize();
      expect(data.chosenMutexNodes['mil_t1']).toBe('mil_t1_attack');
    });

    it('反序列化恢复状态', () => {
      sys.completeNode('mil_t1_attack');
      sys.completeNode('eco_t1_farming');
      const data = sys.serialize();

      const newSys = new TechTreeSystem();
      newSys.init(mockDeps());
      newSys.deserialize(data);

      expect(newSys.getNodeState('mil_t1_attack')?.status).toBe('completed');
      expect(newSys.getNodeState('eco_t1_farming')?.status).toBe('completed');
      expect(newSys.getNodeState('mil_t1_defense')?.status).toBe('locked'); // 互斥锁定
    });

    it('reset 恢复初始状态', () => {
      sys.completeNode('mil_t1_attack');
      sys.reset();
      expect(sys.getNodeState('mil_t1_attack')?.status).toBe('available');
      expect(Object.keys(sys.getChosenMutexNodes())).toHaveLength(0);
    });
  });
});
