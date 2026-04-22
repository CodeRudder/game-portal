import { vi } from 'vitest';
/**
 * FusionTechSystem 单元测试
 * 覆盖：融合科技定义、前置条件、解锁逻辑、效果汇总、v5.0联动、序列化
 */

import { FusionTechSystem } from '../FusionTechSystem';
import { TechTreeSystem } from '../TechTreeSystem';
import { TechLinkSystem } from '../TechLinkSystem';
import { FUSION_TECH_DEFS, FUSION_TECH_MAP } from '../fusion-tech.types';
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

describe('FusionTechSystem', () => {
  let fusion: FusionTechSystem;
  let techTree: TechTreeSystem;

  beforeEach(() => {
    techTree = new TechTreeSystem();
    techTree.init(mockDeps());
    fusion = new FusionTechSystem();
    fusion.init(mockDeps());
    fusion.setTechTree(techTree);
  });

  // ═══════════════════════════════════════════
  // 1. 初始化与定义
  // ═══════════════════════════════════════════
  describe('初始化与融合科技定义', () => {
    it('融合科技定义存在', () => {
      expect(FUSION_TECH_DEFS.length).toBeGreaterThanOrEqual(6);
    });

    it('三种路线组合各有融合科技', () => {
      const milEco = FUSION_TECH_DEFS.filter(
        (d) => (d.pathPair[0] === 'military' && d.pathPair[1] === 'economy') ||
               (d.pathPair[0] === 'economy' && d.pathPair[1] === 'military'),
      );
      expect(milEco.length).toBeGreaterThanOrEqual(1);
      const milCul = FUSION_TECH_DEFS.filter(
        (d) => (d.pathPair[0] === 'military' && d.pathPair[1] === 'culture') ||
               (d.pathPair[0] === 'culture' && d.pathPair[1] === 'military'),
      );
      expect(milCul.length).toBeGreaterThanOrEqual(1);
      const ecoCul = FUSION_TECH_DEFS.filter(
        (d) => (d.pathPair[0] === 'economy' && d.pathPair[1] === 'culture') ||
               (d.pathPair[0] === 'culture' && d.pathPair[1] === 'economy'),
      );
      expect(ecoCul.length).toBeGreaterThanOrEqual(1);
    });

    it('所有融合科技都有必要字段', () => {
      for (const def of FUSION_TECH_DEFS) {
        expect(def.id).toBeTruthy();
        expect(def.name).toBeTruthy();
        expect(def.pathPair).toHaveLength(2);
        expect(def.costPoints).toBeGreaterThan(0);
        expect(def.researchTime).toBeGreaterThan(0);
        expect(def.effects.length).toBeGreaterThan(0);
      }
    });

    it('FUSION_TECH_MAP 与 FUSION_TECH_DEFS 一致', () => {
      expect(FUSION_TECH_MAP.size).toBe(FUSION_TECH_DEFS.length);
    });

    it('初始所有融合科技为 locked', () => {
      const states = fusion.getAllFusionStates();
      for (const def of FUSION_TECH_DEFS) {
        expect(states[def.id]?.status).toBe('locked');
      }
    });
  });

  // ═══════════════════════════════════════════
  // 2. 前置条件检查
  // ═══════════════════════════════════════════
  describe('前置条件检查', () => {
    it('未完成前置时，前置条件不满足', () => {
      for (const def of FUSION_TECH_DEFS) {
        expect(fusion.arePrerequisitesMet(def.id)).toBe(false);
      }
    });

    it('只完成一条路线前置时，前置条件不满足', () => {
      techTree.completeNode('mil_t2_charge');
      fusion.refreshAllAvailability();
      expect(fusion.arePrerequisitesMet('fusion_mil_eco_1')).toBe(false);
    });

    it('两条路线前置都完成后，前置条件满足', () => {
      techTree.completeNode('mil_t1_attack');
      techTree.completeNode('mil_t2_charge');
      techTree.completeNode('eco_t1_farming');
      techTree.completeNode('eco_t2_irrigation');
      fusion.refreshAllAvailability();
      expect(fusion.arePrerequisitesMet('fusion_mil_eco_1')).toBe(true);
    });

    it('getUnmetPrerequisites 正确报告未满足条件', () => {
      const result = fusion.getUnmetPrerequisites('fusion_mil_eco_1');
      expect(result.pathA).toBe(false);
      expect(result.pathB).toBe(false);
    });

    it('部分满足时 getUnmetPrerequisites 正确报告', () => {
      techTree.completeNode('mil_t1_attack');
      techTree.completeNode('mil_t2_charge');
      fusion.refreshAllAvailability();
      const result = fusion.getUnmetPrerequisites('fusion_mil_eco_1');
      expect(result.pathA).toBe(true);
      expect(result.pathB).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // 3. 解锁逻辑
  // ═══════════════════════════════════════════
  describe('解锁逻辑', () => {
    it('前置完成后节点变为 available', () => {
      techTree.completeNode('mil_t1_attack');
      techTree.completeNode('mil_t2_charge');
      techTree.completeNode('eco_t1_farming');
      techTree.completeNode('eco_t2_irrigation');
      fusion.refreshAllAvailability();
      expect(fusion.getFusionState('fusion_mil_eco_1')?.status).toBe('available');
    });

    it('canResearch 允许已解锁的融合科技', () => {
      techTree.completeNode('mil_t1_attack');
      techTree.completeNode('mil_t2_charge');
      techTree.completeNode('eco_t1_farming');
      techTree.completeNode('eco_t2_irrigation');
      fusion.refreshAllAvailability();
      expect(fusion.canResearch('fusion_mil_eco_1').can).toBe(true);
    });

    it('canResearch 拒绝未解锁的融合科技', () => {
      const result = fusion.canResearch('fusion_mil_eco_1');
      expect(result.can).toBe(false);
      expect(result.reason).toContain('前置');
    });

    it('canResearch 拒绝已完成的融合科技', () => {
      fusion.completeFusionNode('fusion_mil_eco_1');
      const result = fusion.canResearch('fusion_mil_eco_1');
      expect(result.can).toBe(false);
      expect(result.reason).toContain('已完成');
    });

    it('canResearch 拒绝研究中的融合科技', () => {
      fusion.setResearching('fusion_mil_eco_1', Date.now(), Date.now() + 900000);
      const result = fusion.canResearch('fusion_mil_eco_1');
      expect(result.can).toBe(false);
      expect(result.reason).toContain('研究中');
    });

    it('canResearch 拒绝不存在的节点', () => {
      const result = fusion.canResearch('nonexistent');
      expect(result.can).toBe(false);
      expect(result.reason).toContain('不存在');
    });
  });

  // ═══════════════════════════════════════════
  // 4. 状态变更
  // ═══════════════════════════════════════════
  describe('状态变更', () => {
    it('setResearching 正确设置状态', () => {
      const now = Date.now();
      fusion.setResearching('fusion_mil_eco_1', now, now + 900000);
      const state = fusion.getFusionState('fusion_mil_eco_1');
      expect(state?.status).toBe('researching');
      expect(state?.researchStartTime).toBe(now);
    });

    it('completeFusionNode 设置完成状态', () => {
      fusion.completeFusionNode('fusion_mil_eco_1');
      const state = fusion.getFusionState('fusion_mil_eco_1');
      expect(state?.status).toBe('completed');
      expect(state?.researchStartTime).toBeNull();
    });

    it('completeFusionNode 发出事件', () => {
      const deps = mockDeps();
      fusion.init(deps);
      fusion.completeFusionNode('fusion_mil_eco_1');
      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'economy:fusionTechCompleted',
        expect.objectContaining({ techId: 'fusion_mil_eco_1', techName: '兵精粮足' }),
      );
    });

    it('cancelResearch 恢复为 available', () => {
      fusion.setResearching('fusion_mil_eco_1', Date.now(), Date.now() + 900000);
      fusion.cancelResearch('fusion_mil_eco_1');
      expect(fusion.getFusionState('fusion_mil_eco_1')?.status).toBe('available');
    });

    it('cancelResearch 不影响非研究中的节点', () => {
      fusion.cancelResearch('fusion_mil_eco_1');
      expect(fusion.getFusionState('fusion_mil_eco_1')?.status).toBe('locked');
    });
  });

  // ═══════════════════════════════════════════
  // 5. 效果汇总
  // ═══════════════════════════════════════════
  describe('效果汇总', () => {
    it('初始无效果', () => {
      expect(fusion.getAllCompletedEffects()).toHaveLength(0);
    });

    it('完成融合科技后获取效果', () => {
      fusion.completeFusionNode('fusion_mil_eco_1');
      expect(fusion.getAllCompletedEffects().length).toBeGreaterThanOrEqual(2);
    });

    it('getEffectValue 正确汇总', () => {
      fusion.completeFusionNode('fusion_mil_eco_1');
      expect(fusion.getEffectValue('troop_attack', 'all')).toBe(15);
    });

    it('多个融合科技效果叠加', () => {
      fusion.completeFusionNode('fusion_mil_eco_1');
      fusion.completeFusionNode('fusion_mil_cul_1');
      expect(fusion.getEffectValue('troop_defense', 'all')).toBe(15);
    });
  });

  // ═══════════════════════════════════════════
  // 6. 查询
  // ═══════════════════════════════════════════
  describe('查询', () => {
    it('getFusionDef 返回正确定义', () => {
      expect(fusion.getFusionDef('fusion_mil_eco_1')?.name).toBe('兵精粮足');
    });

    it('getFusionDef 不存在返回 undefined', () => {
      expect(fusion.getFusionDef('nonexistent')).toBeUndefined();
    });

    it('getFusionsByPathPair 顺序无关', () => {
      const a = fusion.getFusionsByPathPair('military', 'economy');
      const b = fusion.getFusionsByPathPair('economy', 'military');
      expect(a.length).toBe(b.length);
    });
  });

  // ═══════════════════════════════════════════
  // 7. 序列化
  // ═══════════════════════════════════════════
  describe('序列化/反序列化', () => {
    it('序列化空的融合科技', () => {
      const data = fusion.serialize();
      expect(data.completedFusionIds).toHaveLength(0);
      expect(data.version).toBe(1);
    });

    it('序列化已完成的融合科技', () => {
      fusion.completeFusionNode('fusion_mil_eco_1');
      fusion.completeFusionNode('fusion_eco_cul_1');
      const data = fusion.serialize();
      expect(data.completedFusionIds).toContain('fusion_mil_eco_1');
    });

    it('反序列化恢复状态', () => {
      fusion.completeFusionNode('fusion_mil_eco_1');
      const data = fusion.serialize();
      const newFusion = new FusionTechSystem();
      newFusion.init(mockDeps());
      newFusion.setTechTree(techTree);
      newFusion.deserialize(data);
      expect(newFusion.getFusionState('fusion_mil_eco_1')?.status).toBe('completed');
    });

    it('reset 恢复初始状态', () => {
      fusion.completeFusionNode('fusion_mil_eco_1');
      fusion.reset();
      expect(fusion.getFusionState('fusion_mil_eco_1')?.status).toBe('locked');
    });
  });

  // ═══════════════════════════════════════════
  // 8. v5.0 融合科技联动效果
  // ═══════════════════════════════════════════
  describe('v5.0 融合科技联动效果', () => {
    it('融合科技有联动效果定义', () => {
      expect(fusion.getFusionLinkEffects('fusion_mil_eco_1').length).toBeGreaterThan(0);
    });

    it('未完成融合科技时无活跃联动', () => {
      expect(fusion.getActiveFusionLinkEffects()).toHaveLength(0);
    });

    it('完成融合科技后联动变为活跃', () => {
      fusion.completeFusionNode('fusion_mil_eco_1');
      const active = fusion.getActiveFusionLinkEffects();
      expect(active.length).toBeGreaterThan(0);
      expect(active.every((l) => l.fusionTechId === 'fusion_mil_eco_1')).toBe(true);
    });

    it('getFusionLinkBonus 正确汇总', () => {
      fusion.completeFusionNode('fusion_mil_eco_1');
      expect(fusion.getFusionLinkBonus('building', 'barracks')).toBe(10);
    });

    it('未完成融合科技时 getFusionLinkBonus 返回 0', () => {
      expect(fusion.getFusionLinkBonus('building', 'barracks')).toBe(0);
    });

    it('联动效果同步到 TechLinkSystem', () => {
      const linkSys = new TechLinkSystem();
      linkSys.init(mockDeps());
      fusion.setLinkSystem(linkSys);
      fusion.completeFusionNode('fusion_mil_eco_1');
      expect(linkSys.getLinksByTechId('fusion_mil_eco_1').length).toBeGreaterThan(0);
    });

    it('联动系统可查询融合科技加成', () => {
      const linkSys = new TechLinkSystem();
      linkSys.init(mockDeps());
      fusion.setLinkSystem(linkSys);
      fusion.completeFusionNode('fusion_mil_eco_1');
      expect(linkSys.getResourceLinkBonus('grain').productionBonus).toBeGreaterThanOrEqual(15);
    });

    it('不存在的融合科技联动效果为空', () => {
      expect(fusion.getFusionLinkEffects('nonexistent')).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════
  // 9. v5.0 详细前置条件检查
  // ═══════════════════════════════════════════
  describe('v5.0 详细前置条件检查', () => {
    it('checkPrerequisitesDetailed 返回详细结果', () => {
      const result = fusion.checkPrerequisitesDetailed('fusion_mil_eco_1');
      expect(result.met).toBe(false);
      expect(result.groups).toHaveLength(2);
    });

    it('部分完成时正确反映进度', () => {
      techTree.completeNode('mil_t1_attack');
      techTree.completeNode('mil_t2_charge');
      const result = fusion.checkPrerequisitesDetailed('fusion_mil_eco_1');
      const milGroup = result.groups.find((g) => g.path === 'military');
      expect(milGroup?.met).toBe(true);
      const ecoGroup = result.groups.find((g) => g.path === 'economy');
      expect(ecoGroup?.met).toBe(false);
    });

    it('全部完成时 met 为 true', () => {
      techTree.completeNode('mil_t1_attack');
      techTree.completeNode('mil_t2_charge');
      techTree.completeNode('eco_t1_farming');
      techTree.completeNode('eco_t2_irrigation');
      const result = fusion.checkPrerequisitesDetailed('fusion_mil_eco_1');
      expect(result.met).toBe(true);
      expect(result.groups.every((g) => g.met)).toBe(true);
    });

    it('不存在的融合科技返回空结果', () => {
      const result = fusion.checkPrerequisitesDetailed('nonexistent');
      expect(result.met).toBe(false);
      expect(result.groups).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════
  // 10. v5.0 路线组合进度
  // ═══════════════════════════════════════════
  describe('v5.0 路线组合进度', () => {
    it('初始路线组合进度全部锁定', () => {
      const progress = fusion.getPathPairProgress('military', 'economy');
      expect(progress.total).toBeGreaterThanOrEqual(2);
      expect(progress.locked).toBe(progress.total);
    });

    it('完成前置后进度更新', () => {
      techTree.completeNode('mil_t1_attack');
      techTree.completeNode('mil_t2_charge');
      techTree.completeNode('eco_t1_farming');
      techTree.completeNode('eco_t2_irrigation');
      fusion.refreshAllAvailability();
      const progress = fusion.getPathPairProgress('military', 'economy');
      expect(progress.available).toBeGreaterThanOrEqual(1);
    });

    it('完成融合科技后进度反映完成', () => {
      techTree.completeNode('mil_t1_attack');
      techTree.completeNode('mil_t2_charge');
      techTree.completeNode('eco_t1_farming');
      techTree.completeNode('eco_t2_irrigation');
      fusion.refreshAllAvailability();
      fusion.completeFusionNode('fusion_mil_eco_1');
      const progress = fusion.getPathPairProgress('military', 'economy');
      expect(progress.completed).toBeGreaterThanOrEqual(1);
    });
  });

  // ═══════════════════════════════════════════
  // 11. ISubsystem 接口
  // ═══════════════════════════════════════════
  describe('ISubsystem 接口', () => {
    it('name 正确', () => {
      expect(fusion.name).toBe('fusion-tech');
    });

    it('getState 返回完整状态', () => {
      const state = fusion.getState();
      expect(state.nodes).toBeDefined();
      expect(Object.keys(state.nodes)).toHaveLength(FUSION_TECH_DEFS.length);
    });

    it('update 不抛异常', () => {
      expect(() => fusion.update(0.016)).not.toThrow();
    });
  });
});
