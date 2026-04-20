/**
 * 科技联动 + 融合科技 集成测试
 *
 * 验收标准：
 * 1. 融合科技在两条路线各完成指定节点后解锁
 * 2. 科技联动效果正确应用到建筑/武将/资源系统
 * 3. getTechBonus() 查询接口正确
 * 4. 融合科技联动效果同步到 TechLinkSystem
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TechTreeSystem } from '../TechTreeSystem';
import { TechLinkSystem } from '../TechLinkSystem';
import { FusionTechSystem } from '../FusionTechSystem';
import { FUSION_TECH_DEFS } from '../fusion-tech.types';
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

interface TechFixture {
  deps: ISystemDeps;
  techTree: TechTreeSystem;
  linkSystem: TechLinkSystem;
  fusionSystem: FusionTechSystem;
}

function createTechFixture(): TechFixture {
  const deps = mockDeps();
  const techTree = new TechTreeSystem();
  techTree.init(deps);
  const linkSystem = new TechLinkSystem();
  linkSystem.init(deps);
  const fusionSystem = new FusionTechSystem();
  fusionSystem.init(deps);
  fusionSystem.setTechTree(techTree);
  fusionSystem.setLinkSystem(linkSystem);
  return { deps, techTree, linkSystem, fusionSystem };
}

describe('科技联动 + 融合科技 集成测试', () => {
  let fixture: TechFixture;

  beforeEach(() => {
    fixture = createTechFixture();
  });

  // ═══════════════════════════════════════════
  // 1. 核心循环：研究科技 → 联动效果增强
  // ═══════════════════════════════════════════
  describe('核心循环', () => {
    it('完成经济科技 → 建筑农田产出联动生效', () => {
      const { techTree, linkSystem } = fixture;

      // 完成经济路线 T1 农耕
      techTree.completeNode('eco_t1_farming');
      linkSystem.addCompletedTech('eco_t1_farming');

      // 验证联动效果
      expect(linkSystem.getTechBonus('building', 'farm')).toBe(20);
      expect(linkSystem.getTechBonus('resource', 'grain')).toBe(10);
    });

    it('完成军事科技 → 武将技能联动生效', () => {
      const { techTree, linkSystem } = fixture;

      // 完成军事路线 T2 冲锋
      techTree.completeNode('mil_t1_attack');
      techTree.completeNode('mil_t2_charge');
      linkSystem.addCompletedTech('mil_t2_charge');

      // 验证武将联动
      expect(linkSystem.getTechBonus('hero', 'cavalry_charge')).toBe(20);
    });

    it('完成文化科技 → 资源天命联动生效', () => {
      const { techTree, linkSystem } = fixture;

      // 完成文化路线 T1 兴学
      techTree.completeNode('cul_t1_education');
      linkSystem.addCompletedTech('cul_t1_education');

      // 验证资源联动
      expect(linkSystem.getTechBonus('resource', 'mandate')).toBe(10);
      // 同时武将经验也联动
      expect(linkSystem.getTechBonus('hero', 'all_skill_exp')).toBe(15);
    });

    it('多科技叠加联动效果', () => {
      const { techTree, linkSystem } = fixture;

      // 完成 eco_t1_farming + eco_t2_irrigation
      techTree.completeNode('eco_t1_farming');
      techTree.completeNode('eco_t2_irrigation');
      linkSystem.syncCompletedTechIds(['eco_t1_farming', 'eco_t2_irrigation']);

      // 建筑 farm 加成: 20 + 25 = 45
      expect(linkSystem.getTechBonus('building', 'farm')).toBe(45);
      // 资源 grain 加成: 10 (仅 eco_t1_farming)
      expect(linkSystem.getTechBonus('resource', 'grain')).toBe(10);
    });
  });

  // ═══════════════════════════════════════════
  // 2. 融合科技解锁流程
  // ═══════════════════════════════════════════
  describe('融合科技解锁流程', () => {
    it('军事+经济路线完成 → 解锁兵精粮足', () => {
      const { techTree, fusionSystem } = fixture;

      // 完成军事路线前置
      techTree.completeNode('mil_t1_attack');
      techTree.completeNode('mil_t2_charge');

      // 未完成经济路线 → 仍锁定
      fusionSystem.refreshAllAvailability();
      expect(fusionSystem.arePrerequisitesMet('fusion_mil_eco_1')).toBe(false);

      // 完成经济路线前置
      techTree.completeNode('eco_t1_farming');
      techTree.completeNode('eco_t2_irrigation');
      fusionSystem.refreshAllAvailability();

      // 两条路线都完成 → 解锁
      expect(fusionSystem.arePrerequisitesMet('fusion_mil_eco_1')).toBe(true);
      const state = fusionSystem.getFusionState('fusion_mil_eco_1');
      expect(state?.status).toBe('available');
    });

    it('军事+文化路线完成 → 解锁兵法大家', () => {
      const { techTree, fusionSystem } = fixture;

      techTree.completeNode('mil_t1_attack');
      techTree.completeNode('mil_t2_fortify');
      techTree.completeNode('cul_t1_education');
      techTree.completeNode('cul_t2_academy');
      fusionSystem.refreshAllAvailability();

      expect(fusionSystem.arePrerequisitesMet('fusion_mil_cul_1')).toBe(true);
    });

    it('经济+文化路线完成 → 解锁文景之治', () => {
      const { techTree, fusionSystem } = fixture;

      techTree.completeNode('eco_t1_farming');
      techTree.completeNode('eco_t2_irrigation');
      techTree.completeNode('cul_t1_education');
      techTree.completeNode('cul_t2_academy');
      fusionSystem.refreshAllAvailability();

      expect(fusionSystem.arePrerequisitesMet('fusion_eco_cul_1')).toBe(true);
    });

    it('融合科技解锁后可研究', () => {
      const { techTree, fusionSystem } = fixture;

      techTree.completeNode('mil_t1_attack');
      techTree.completeNode('mil_t2_charge');
      techTree.completeNode('eco_t1_farming');
      techTree.completeNode('eco_t2_irrigation');
      fusionSystem.refreshAllAvailability();

      const result = fusionSystem.canResearch('fusion_mil_eco_1');
      expect(result.can).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // 3. 融合科技联动效果传播
  // ═══════════════════════════════════════════
  describe('融合科技联动效果传播', () => {
    it('完成融合科技 → 联动效果注册到 TechLinkSystem', () => {
      const { techTree, linkSystem, fusionSystem } = fixture;

      // 先完成前置
      techTree.completeNode('mil_t1_attack');
      techTree.completeNode('mil_t2_charge');
      techTree.completeNode('eco_t1_farming');
      techTree.completeNode('eco_t2_irrigation');
      fusionSystem.refreshAllAvailability();

      // 完成融合科技
      fusionSystem.completeFusionNode('fusion_mil_eco_1');

      // 验证联动效果已传播
      expect(linkSystem.getTechBonus('building', 'barracks')).toBe(10);
      expect(linkSystem.getTechBonus('resource', 'grain')).toBeGreaterThanOrEqual(15);
    });

    it('普通科技 + 融合科技联动叠加', () => {
      const { techTree, linkSystem, fusionSystem } = fixture;

      // 完成普通科技联动
      techTree.completeNode('eco_t1_farming');
      linkSystem.addCompletedTech('eco_t1_farming');

      const grainBefore = linkSystem.getTechBonus('resource', 'grain');
      expect(grainBefore).toBe(10);

      // 完成融合科技
      techTree.completeNode('mil_t1_attack');
      techTree.completeNode('mil_t2_charge');
      techTree.completeNode('eco_t2_irrigation');
      fusionSystem.refreshAllAvailability();
      fusionSystem.completeFusionNode('fusion_mil_eco_1');

      // 融合科技联动叠加
      const grainAfter = linkSystem.getTechBonus('resource', 'grain');
      expect(grainAfter).toBeGreaterThanOrEqual(grainBefore + 15);
    });

    it('多融合科技联动叠加到同一目标', () => {
      const { techTree, linkSystem, fusionSystem } = fixture;

      // 完成兵法大家 → academy +10%
      techTree.completeNode('mil_t1_attack');
      techTree.completeNode('mil_t2_fortify');
      techTree.completeNode('cul_t1_education');
      techTree.completeNode('cul_t2_academy');
      fusionSystem.refreshAllAvailability();
      fusionSystem.completeFusionNode('fusion_mil_cul_1');

      // 完成文景之治 → hero exp +15%
      techTree.completeNode('eco_t1_farming');
      techTree.completeNode('eco_t2_irrigation');
      fusionSystem.refreshAllAvailability();
      fusionSystem.completeFusionNode('fusion_eco_cul_1');

      // 验证叠加
      const heroExpBonus = fusionSystem.getFusionLinkBonus('hero', 'all_skill_exp');
      expect(heroExpBonus).toBeGreaterThanOrEqual(35); // 20 + 15
    });
  });

  // ═══════════════════════════════════════════
  // 4. getTechBonus 统一查询接口
  // ═══════════════════════════════════════════
  describe('getTechBonus 统一查询接口', () => {
    it('getTechBonus 返回建筑联动加成', () => {
      const { linkSystem } = fixture;
      linkSystem.addCompletedTech('eco_t1_farming');
      expect(linkSystem.getTechBonus('building', 'farm')).toBe(20);
    });

    it('getTechBonus 返回武将联动加成', () => {
      const { linkSystem } = fixture;
      linkSystem.addCompletedTech('mil_t2_charge');
      expect(linkSystem.getTechBonus('hero', 'cavalry_charge')).toBe(20);
    });

    it('getTechBonus 返回资源联动加成', () => {
      const { linkSystem } = fixture;
      linkSystem.addCompletedTech('eco_t1_farming');
      expect(linkSystem.getTechBonus('resource', 'grain')).toBe(10);
    });

    it('getTechBonusMultiplier 返回正确乘数', () => {
      const { linkSystem } = fixture;
      linkSystem.addCompletedTech('eco_t1_farming');
      expect(linkSystem.getTechBonusMultiplier('building', 'farm')).toBeCloseTo(1.2);
    });

    it('getTechBonus 无匹配返回 0', () => {
      const { linkSystem } = fixture;
      expect(linkSystem.getTechBonus('building', 'nonexistent')).toBe(0);
      expect(linkSystem.getTechBonus('hero', 'nonexistent')).toBe(0);
      expect(linkSystem.getTechBonus('resource', 'nonexistent')).toBe(0);
    });
  });

  // ═══════════════════════════════════════════
  // 5. 联动效果变更事件
  // ═══════════════════════════════════════════
  describe('联动效果变更事件', () => {
    it('科技完成触发 linksChanged 事件', () => {
      const { deps, linkSystem } = fixture;
      linkSystem.addCompletedTech('eco_t1_farming');

      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'tech:linksChanged',
        expect.objectContaining({
          buildingLinks: expect.any(Number),
          heroLinks: expect.any(Number),
          resourceLinks: expect.any(Number),
          totalActive: expect.any(Number),
        }),
      );
    });

    it('融合科技完成触发 fusionTechCompleted 事件', () => {
      const { deps, fusionSystem } = fixture;
      fusionSystem.completeFusionNode('fusion_mil_eco_1');

      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'economy:fusionTechCompleted',
        expect.objectContaining({
          techId: 'fusion_mil_eco_1',
          techName: '兵精粮足',
        }),
      );
    });

    it('批量同步触发事件', () => {
      const { deps, linkSystem } = fixture;
      linkSystem.syncCompletedTechIds(['eco_t1_farming', 'mil_t2_charge']);

      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'tech:linksChanged',
        expect.objectContaining({
          totalActive: expect.any(Number),
        }),
      );
    });
  });

  // ═══════════════════════════════════════════
  // 6. 完整端到端场景
  // ═══════════════════════════════════════════
  describe('完整端到端场景', () => {
    it('场景：全面发展 → 融合科技解锁 → 联动生效', () => {
      const { techTree, linkSystem, fusionSystem } = fixture;

      // Step 1: 完成军事路线 T1-T2
      techTree.completeNode('mil_t1_attack');
      techTree.completeNode('mil_t2_charge');
      linkSystem.addCompletedTech('mil_t2_charge');

      // Step 2: 完成经济路线 T1-T2
      techTree.completeNode('eco_t1_farming');
      techTree.completeNode('eco_t2_irrigation');
      linkSystem.syncCompletedTechIds(['eco_t1_farming', 'eco_t2_irrigation', 'mil_t2_charge']);

      // Step 3: 验证普通科技联动生效
      expect(linkSystem.getTechBonus('building', 'farm')).toBe(45); // 20 + 25
      expect(linkSystem.getTechBonus('resource', 'grain')).toBe(10);
      expect(linkSystem.getTechBonus('hero', 'cavalry_charge')).toBe(20);

      // Step 4: 融合科技解锁
      fusionSystem.refreshAllAvailability();
      expect(fusionSystem.arePrerequisitesMet('fusion_mil_eco_1')).toBe(true);
      expect(fusionSystem.getFusionState('fusion_mil_eco_1')?.status).toBe('available');

      // Step 5: 完成融合科技
      fusionSystem.completeFusionNode('fusion_mil_eco_1');

      // Step 6: 验证融合科技联动叠加
      const totalGrainBonus = linkSystem.getTechBonus('resource', 'grain');
      expect(totalGrainBonus).toBeGreaterThanOrEqual(25); // 10 + 15 (融合)
    });

    it('场景：三条路线各完成 → 解锁所有融合科技', () => {
      const { techTree, fusionSystem } = fixture;

      // 完成所有路线的 T1-T2
      const allTechs = [
        'mil_t1_attack', 'mil_t2_charge', 'mil_t2_fortify',
        'eco_t1_farming', 'eco_t2_irrigation',
        'cul_t1_education', 'cul_t2_academy',
      ];
      for (const tech of allTechs) {
        techTree.completeNode(tech);
      }
      fusionSystem.refreshAllAvailability();

      // 验证 T2 级融合科技解锁
      expect(fusionSystem.arePrerequisitesMet('fusion_mil_eco_1')).toBe(true);
      expect(fusionSystem.arePrerequisitesMet('fusion_mil_cul_1')).toBe(true);
      expect(fusionSystem.arePrerequisitesMet('fusion_eco_cul_1')).toBe(true);
    });

    it('场景：重置后联动清除', () => {
      const { techTree, linkSystem, fusionSystem } = fixture;

      // 完成科技
      techTree.completeNode('eco_t1_farming');
      linkSystem.addCompletedTech('eco_t1_farming');
      expect(linkSystem.getTechBonus('building', 'farm')).toBe(20);

      // 重置
      linkSystem.reset();
      fusionSystem.reset();

      // 验证联动已清除
      expect(linkSystem.getTechBonus('building', 'farm')).toBe(0);
      expect(linkSystem.getState().activeLinks).toBe(0);
    });

    it('场景：序列化/反序列化保持联动状态', () => {
      const { techTree, linkSystem, fusionSystem } = fixture;

      // 完成融合科技
      techTree.completeNode('mil_t1_attack');
      techTree.completeNode('mil_t2_charge');
      techTree.completeNode('eco_t1_farming');
      techTree.completeNode('eco_t2_irrigation');
      fusionSystem.refreshAllAvailability();
      fusionSystem.completeFusionNode('fusion_mil_eco_1');

      // 序列化
      const fusionData = fusionSystem.serialize();

      // 反序列化到新系统
      const newFusion = new FusionTechSystem();
      newFusion.init(mockDeps());
      newFusion.setTechTree(techTree);
      newFusion.deserialize(fusionData);

      // 验证状态恢复
      expect(newFusion.getFusionState('fusion_mil_eco_1')?.status).toBe('completed');
      expect(newFusion.getAllCompletedEffects().length).toBeGreaterThanOrEqual(2);
    });
  });

  // ═══════════════════════════════════════════
  // 7. 联动快照查询
  // ═══════════════════════════════════════════
  describe('联动快照查询', () => {
    it('getTechLinkSnapshot 返回完整快照', () => {
      const { linkSystem } = fixture;
      const snapshot = linkSystem.getTechLinkSnapshot('eco_t1_farming');

      expect(snapshot.building).toBeDefined();
      expect(snapshot.hero).toBeDefined();
      expect(snapshot.resource).toBeDefined();
      // eco_t1_farming 关联 farm 建筑
      const farmBonus = snapshot.building.find(b => b.buildingType === 'farm');
      expect(farmBonus).toBeDefined();
    });

    it('getAllActiveBonuses 返回所有活跃加成', () => {
      const { linkSystem } = fixture;
      linkSystem.syncCompletedTechIds([
        'eco_t1_farming',
        'mil_t2_charge',
        'cul_t1_education',
      ]);

      const bonuses = linkSystem.getAllActiveBonuses();
      expect(bonuses.buildings.length).toBeGreaterThan(0);
      expect(bonuses.heroes.length).toBeGreaterThan(0);
      expect(bonuses.resources.length).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════
  // 8. 边界情况
  // ═══════════════════════════════════════════
  describe('边界情况', () => {
    it('重复添加已完成科技不重复触发', () => {
      const { deps, linkSystem } = fixture;
      linkSystem.addCompletedTech('eco_t1_farming');
      const emitCount = (deps.eventBus.emit as ReturnType<typeof vi.fn>).mock.calls.length;
      linkSystem.addCompletedTech('eco_t1_farming'); // 重复
      // 不应新增 emit（因为 addCompletedTech 内部有去重检查）
      expect((deps.eventBus.emit as ReturnType<typeof vi.fn>).mock.calls.length).toBe(emitCount);
    });

    it('移除不存在的科技不报错', () => {
      expect(() => {
        fixture.linkSystem.removeCompletedTech('nonexistent');
      }).not.toThrow();
    });

    it('融合科技联动效果不影响非关联目标', () => {
      const { linkSystem, fusionSystem } = fixture;
      fusionSystem.completeFusionNode('fusion_mil_eco_1');

      // 不相关的建筑不应有加成
      expect(linkSystem.getTechBonus('building', 'academy')).toBe(0);
    });

    it('所有融合科技定义合法', () => {
      for (const def of FUSION_TECH_DEFS) {
        expect(def.id).toMatch(/^fusion_/);
        expect(def.pathPair).toHaveLength(2);
        expect(def.pathPair[0]).not.toBe(def.pathPair[1]);
        expect(def.costPoints).toBeGreaterThan(0);
        expect(def.researchTime).toBeGreaterThan(0);
        expect(def.effects.length).toBeGreaterThan(0);
      }
    });
  });
});
