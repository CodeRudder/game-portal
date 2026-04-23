import { vi } from 'vitest';
/**
 * FusionTechSystem v5.0 扩展测试
 * 覆盖：融合科技联动效果、详细前置条件检查、路线组合进度
 */

import { FusionTechSystem } from '../FusionTechSystem';
import { TechTreeSystem } from '../TechTreeSystem';
import { TechLinkSystem } from '../TechLinkSystem';
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

describe('FusionTechSystem v5.0', () => {
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
  // 1. 融合科技联动效果
  // ═══════════════════════════════════════════
  describe('融合科技联动效果', () => {
    it('融合科技有联动效果定义', () => {
      const links = fusion.getFusionLinkEffects('fusion_mil_eco_1');
      expect(links.length).toBeGreaterThan(0);
    });

    it('每个融合科技联动效果包含必要字段', () => {
      const links = fusion.getFusionLinkEffects('fusion_mil_eco_1');
      for (const link of links) {
        expect(link.id).toBeTruthy();
        expect(link.fusionTechId).toBe('fusion_mil_eco_1');
        expect(link.target).toBeTruthy();
        expect(link.targetSub).toBeTruthy();
        expect(link.description).toBeTruthy();
        expect(link.value).toBeGreaterThan(0);
      }
    });

    it('所有融合科技都有联动效果', () => {
      const allDefs = fusion.getAllFusionDefs();
      for (const def of allDefs) {
        const links = fusion.getFusionLinkEffects(def.id);
        expect(links.length).toBeGreaterThan(0);
      }
    });

    it('未完成融合科技时无活跃联动', () => {
      const activeLinks = fusion.getActiveFusionLinkEffects();
      expect(activeLinks).toHaveLength(0);
    });

    it('完成融合科技后联动变为活跃', () => {
      fusion.completeFusionNode('fusion_mil_eco_1');
      const activeLinks = fusion.getActiveFusionLinkEffects();
      expect(activeLinks.length).toBeGreaterThan(0);
      expect(activeLinks.every((l) => l.fusionTechId === 'fusion_mil_eco_1')).toBe(true);
    });

    it('多个融合科技联动独立', () => {
      fusion.completeFusionNode('fusion_mil_eco_1');
      fusion.completeFusionNode('fusion_mil_cul_1');
      const activeLinks = fusion.getActiveFusionLinkEffects();
      const milEcoLinks = activeLinks.filter((l) => l.fusionTechId === 'fusion_mil_eco_1');
      const milCulLinks = activeLinks.filter((l) => l.fusionTechId === 'fusion_mil_cul_1');
      expect(milEcoLinks.length).toBeGreaterThan(0);
      expect(milCulLinks.length).toBeGreaterThan(0);
    });

    it('getFusionLinkBonus 正确汇总', () => {
      fusion.completeFusionNode('fusion_mil_eco_1');
      const bonus = fusion.getFusionLinkBonus('building', 'barracks');
      expect(bonus).toBe(10); // 兵精粮足 → 兵营训练速度+10%
    });

    it('未完成融合科技时 getFusionLinkBonus 返回 0', () => {
      const bonus = fusion.getFusionLinkBonus('building', 'barracks');
      expect(bonus).toBe(0);
    });

    it('不存在的融合科技联动效果为空', () => {
      const links = fusion.getFusionLinkEffects('nonexistent');
      expect(links).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════
  // 2. 融合科技联动与 TechLinkSystem 集成
  // ═══════════════════════════════════════════
  describe('融合科技联动与 TechLinkSystem 集成', () => {
    let linkSys: TechLinkSystem;

    beforeEach(() => {
      linkSys = new TechLinkSystem();
      linkSys.init(mockDeps());
      fusion.setLinkSystem(linkSys);
    });

    it('联动效果同步到 TechLinkSystem', () => {
      fusion.completeFusionNode('fusion_mil_eco_1');
      const links = linkSys.getLinksByTechId('fusion_mil_eco_1');
      expect(links.length).toBeGreaterThan(0);
    });

    it('联动系统可查询融合科技建筑加成', () => {
      fusion.completeFusionNode('fusion_mil_eco_1');
      const bonus = linkSys.getBuildingLinkBonus('barracks');
      expect(bonus.productionBonus).toBeGreaterThanOrEqual(10);
    });

    it('联动系统可查询融合科技资源加成', () => {
      fusion.completeFusionNode('fusion_mil_eco_1');
      const bonus = linkSys.getResourceLinkBonus('grain');
      expect(bonus.productionBonus).toBeGreaterThanOrEqual(15);
    });

    it('联动系统可查询融合科技武将加成', () => {
      fusion.completeFusionNode('fusion_mil_cul_1');
      const bonus = linkSys.getHeroLinkBonus('all_skill_exp');
      expect(bonus.enhanceBonus).toBeGreaterThanOrEqual(20);
    });

    it('融合科技联动与普通科技联动叠加', () => {
      // 先添加普通科技联动
      linkSys.addCompletedTech('eco_t1_farming'); // farm +20% 建筑
      // 再完成融合科技
      fusion.completeFusionNode('fusion_mil_eco_1');

      const farmBonus = linkSys.getBuildingLinkBonus('farm');
      expect(farmBonus.productionBonus).toBeGreaterThanOrEqual(20);
    });

    it('融合科技联动通过 getTechBonus 查询', () => {
      fusion.completeFusionNode('fusion_mil_eco_1');
      const bonus = linkSys.getTechBonus('building', 'barracks');
      expect(bonus).toBeGreaterThanOrEqual(10);
    });

    it('融合科技联动通过 getTechBonusMultiplier 查询', () => {
      fusion.completeFusionNode('fusion_mil_eco_1');
      const mult = linkSys.getTechBonusMultiplier('building', 'barracks');
      expect(mult).toBeGreaterThanOrEqual(1.1);
    });
  });

  // ═══════════════════════════════════════════
  // 3. 详细前置条件检查
  // ═══════════════════════════════════════════
  describe('详细前置条件检查', () => {
    it('checkPrerequisitesDetailed 返回详细结果', () => {
      const result = fusion.checkPrerequisitesDetailed('fusion_mil_eco_1');
      expect(result.met).toBe(false);
      expect(result.groups).toHaveLength(2);
    });

    it('每组包含完整信息', () => {
      const result = fusion.checkPrerequisitesDetailed('fusion_mil_eco_1');
      for (const group of result.groups) {
        expect(group.path).toBeTruthy();
        expect(group.requiredNodes).toHaveLength(1);
        expect(group.minCompleted).toBe(1);
        expect(typeof group.met).toBe('boolean');
        expect(typeof group.actualCompleted).toBe('number');
      }
    });

    it('未完成前置时各组显示未完成', () => {
      const result = fusion.checkPrerequisitesDetailed('fusion_mil_eco_1');
      expect(result.groups[0].met).toBe(false);
      expect(result.groups[1].met).toBe(false);
      expect(result.groups[0].completedNodes).toHaveLength(0);
    });

    it('部分完成时正确反映进度', () => {
      techTree.completeNode('mil_t1_attack');
      techTree.completeNode('mil_t2_charge');
      const result = fusion.checkPrerequisitesDetailed('fusion_mil_eco_1');
      const milGroup = result.groups.find((g) => g.path === 'military');
      expect(milGroup?.met).toBe(true);
      expect(milGroup?.actualCompleted).toBe(1);
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

    it('所有融合科技都可以详细检查', () => {
      const allDefs = fusion.getAllFusionDefs();
      for (const def of allDefs) {
        const result = fusion.checkPrerequisitesDetailed(def.id);
        expect(result.groups).toHaveLength(2);
      }
    });
  });

  // ═══════════════════════════════════════════
  // 4. 路线组合进度
  // ═══════════════════════════════════════════
  describe('路线组合进度', () => {
    it('初始路线组合进度全部锁定', () => {
      const progress = fusion.getPathPairProgress('military', 'economy');
      expect(progress.total).toBeGreaterThanOrEqual(2);
      expect(progress.locked).toBe(progress.total);
      expect(progress.completed).toBe(0);
      expect(progress.available).toBe(0);
    });

    it('完成前置后进度更新', () => {
      techTree.completeNode('mil_t1_attack');
      techTree.completeNode('mil_t2_charge');
      techTree.completeNode('eco_t1_farming');
      techTree.completeNode('eco_t2_irrigation');
      fusion.refreshAllAvailability();

      const progress = fusion.getPathPairProgress('military', 'economy');
      expect(progress.available).toBeGreaterThanOrEqual(1);
      expect(progress.locked).toBeLessThan(progress.total);
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

    it('不同路线组合独立计算', () => {
      // 完成军事+经济前置
      techTree.completeNode('mil_t1_attack');
      techTree.completeNode('mil_t2_charge');
      techTree.completeNode('eco_t1_farming');
      techTree.completeNode('eco_t2_irrigation');
      fusion.refreshAllAvailability();

      const milEcoProgress = fusion.getPathPairProgress('military', 'economy');
      const milCulProgress = fusion.getPathPairProgress('military', 'culture');

      expect(milEcoProgress.available).toBeGreaterThanOrEqual(1);
      // 军事+文化的前置未完成
      expect(milCulProgress.locked).toBe(milCulProgress.total);
    });

    it('顺序无关的路线组合查询', () => {
      const a = fusion.getPathPairProgress('military', 'economy');
      const b = fusion.getPathPairProgress('economy', 'military');
      expect(a.total).toBe(b.total);
    });
  });
});
