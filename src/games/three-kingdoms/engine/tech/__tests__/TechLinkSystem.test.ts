/**
 * TechLinkSystem 单元测试
 * 覆盖：联动注册、建筑联动、武将联动、资源联动、活跃查询
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TechLinkSystem } from '../TechLinkSystem';
import type { TechLinkEffect, LinkTarget } from '../TechLinkSystem';
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

describe('TechLinkSystem', () => {
  let link: TechLinkSystem;

  beforeEach(() => {
    link = new TechLinkSystem();
    link.init(mockDeps());
  });

  // ═══════════════════════════════════════════
  // 1. 初始化与默认联动
  // ═══════════════════════════════════════════
  describe('初始化与默认联动', () => {
    it('默认联动效果已注册', () => {
      const state = link.getState();
      expect(state.totalLinks).toBeGreaterThan(0);
    });

    it('初始无活跃联动', () => {
      const state = link.getState();
      expect(state.activeLinks).toBe(0);
    });

    it('包含建筑联动', () => {
      const bonuses = link.getAllBuildingBonuses();
      expect(bonuses.length).toBeGreaterThan(0);
    });

    it('包含武将联动', () => {
      const bonuses = link.getAllHeroBonuses();
      expect(bonuses.length).toBeGreaterThan(0);
    });

    it('包含资源联动', () => {
      const bonuses = link.getAllResourceBonuses();
      expect(bonuses.length).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════
  // 2. 联动注册
  // ═══════════════════════════════════════════
  describe('联动注册', () => {
    it('注册新联动效果', () => {
      const initialCount = link.getState().totalLinks;
      link.registerLink({
        id: 'custom_link_1',
        techId: 'mil_t1_attack',
        target: 'building',
        targetSub: 'custom_building',
        description: '自定义联动',
        value: 10,
      });
      expect(link.getState().totalLinks).toBe(initialCount + 1);
    });

    it('批量注册联动效果', () => {
      const initialCount = link.getState().totalLinks;
      link.registerLinks([
        { id: 'batch_1', techId: 'mil_t1_attack', target: 'building', targetSub: 'b1', description: '批量1', value: 5 },
        { id: 'batch_2', techId: 'eco_t1_farming', target: 'resource', targetSub: 'grain', description: '批量2', value: 10 },
      ]);
      expect(link.getState().totalLinks).toBe(initialCount + 2);
    });

    it('移除联动效果', () => {
      link.registerLink({
        id: 'to_remove',
        techId: 'mil_t1_attack',
        target: 'building',
        targetSub: 'test',
        description: '待移除',
        value: 5,
      });
      expect(link.unregisterLink('to_remove')).toBe(true);
      expect(link.unregisterLink('nonexistent')).toBe(false);
    });

    it('注册覆盖同 ID 联动', () => {
      link.registerLink({
        id: 'override_test',
        techId: 'mil_t1_attack',
        target: 'building',
        targetSub: 'test',
        description: '原始',
        value: 5,
      });
      link.registerLink({
        id: 'override_test',
        techId: 'eco_t1_farming',
        target: 'resource',
        targetSub: 'test',
        description: '覆盖',
        value: 10,
      });
      // 同 ID 应被覆盖，总数不变
      const links = link.getLinksByTechId('eco_t1_farming');
      const found = links.find((l) => l.id === 'override_test');
      expect(found).toBeDefined();
      expect(found!.value).toBe(10);
    });
  });

  // ═══════════════════════════════════════════
  // 3. 科技完成同步
  // ═══════════════════════════════════════════
  describe('科技完成同步', () => {
    it('同步已完成的科技 ID', () => {
      link.syncCompletedTechIds(['mil_t1_attack', 'eco_t1_farming']);
      expect(link.getState().activeLinks).toBeGreaterThan(0);
    });

    it('添加单个已完成科技', () => {
      link.addCompletedTech('mil_t1_attack');
      expect(link.getState().activeLinks).toBeGreaterThan(0);
    });

    it('移除已完成科技', () => {
      link.addCompletedTech('mil_t1_attack');
      const activeBefore = link.getState().activeLinks;
      link.removeCompletedTech('mil_t1_attack');
      const activeAfter = link.getState().activeLinks;
      expect(activeAfter).toBeLessThan(activeBefore);
    });

    it('reset 清除已完成状态', () => {
      link.syncCompletedTechIds(['mil_t1_attack']);
      link.reset();
      expect(link.getState().activeLinks).toBe(0);
    });
  });

  // ═══════════════════════════════════════════
  // 4. 建筑联动
  // ═══════════════════════════════════════════
  describe('建筑联动', () => {
    it('未完成科技时建筑无加成', () => {
      const bonus = link.getBuildingLinkBonus('farm');
      expect(bonus.productionBonus).toBe(0);
      expect(bonus.unlockFeature).toBe(false);
    });

    it('完成科技后建筑获得产出加成', () => {
      link.addCompletedTech('eco_t1_farming');
      const bonus = link.getBuildingLinkBonus('farm');
      expect(bonus.productionBonus).toBeGreaterThan(0);
    });

    it('多个科技叠加建筑加成', () => {
      link.addCompletedTech('eco_t1_farming');
      link.addCompletedTech('eco_t2_irrigation');
      const bonus = link.getBuildingLinkBonus('farm');
      expect(bonus.productionBonus).toBe(45); // 20 + 25
    });

    it('科技解锁建筑新功能', () => {
      link.addCompletedTech('mil_t1_attack');
      const bonus = link.getBuildingLinkBonus('barracks');
      expect(bonus.unlockFeature).toBe(true);
      expect(bonus.unlockDescription).toBeTruthy();
    });

    it('不相关建筑无加成', () => {
      link.addCompletedTech('eco_t1_farming');
      const bonus = link.getBuildingLinkBonus('barracks');
      expect(bonus.productionBonus).toBe(0);
    });

    it('getAllBuildingBonuses 返回所有建筑类型', () => {
      link.syncCompletedTechIds(['eco_t1_farming', 'eco_t1_trade', 'mil_t1_attack']);
      const bonuses = link.getAllBuildingBonuses();
      expect(bonuses.length).toBeGreaterThan(0);
      // 至少包含 farm, market, barracks
      const types = bonuses.map((b) => b.buildingType);
      expect(types).toContain('farm');
      expect(types).toContain('market');
    });
  });

  // ═══════════════════════════════════════════
  // 5. 武将联动
  // ═══════════════════════════════════════════
  describe('武将联动', () => {
    it('未完成科技时武将无加成', () => {
      const bonus = link.getHeroLinkBonus('cavalry_charge');
      expect(bonus.enhanceBonus).toBe(0);
      expect(bonus.unlockSkill).toBe(false);
    });

    it('完成科技后武将技能获得强化', () => {
      link.addCompletedTech('mil_t2_charge');
      const bonus = link.getHeroLinkBonus('cavalry_charge');
      expect(bonus.enhanceBonus).toBe(20);
    });

    it('科技解锁武将新技能', () => {
      link.addCompletedTech('cul_t2_talent');
      const bonus = link.getHeroLinkBonus('recruit_quality');
      expect(bonus.unlockSkill).toBe(true);
      expect(bonus.newSkillDescription).toBeTruthy();
    });

    it('多个科技叠加武将加成', () => {
      link.addCompletedTech('cul_t1_education');
      link.addCompletedTech('cul_t3_scholar');
      const bonus = link.getHeroLinkBonus('all_skill_exp');
      expect(bonus.enhanceBonus).toBe(40); // 15 + 25
    });

    it('getAllHeroBonuses 返回所有技能', () => {
      link.syncCompletedTechIds(['mil_t2_charge', 'cul_t1_education']);
      const bonuses = link.getAllHeroBonuses();
      expect(bonuses.length).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════
  // 6. 资源联动
  // ═══════════════════════════════════════════
  describe('资源联动', () => {
    it('未完成科技时资源无加成', () => {
      const bonus = link.getResourceLinkBonus('grain');
      expect(bonus.productionBonus).toBe(0);
      expect(bonus.storageBonus).toBe(0);
      expect(bonus.tradeBonus).toBe(0);
    });

    it('完成科技后资源获得产出加成', () => {
      link.addCompletedTech('eco_t1_farming');
      const bonus = link.getResourceLinkBonus('grain');
      expect(bonus.productionBonus).toBeGreaterThan(0);
    });

    it('科技影响资源存储上限', () => {
      link.addCompletedTech('eco_t3_granary');
      const bonus = link.getResourceLinkBonus('grain');
      expect(bonus.productionBonus).toBeGreaterThan(0);
      expect(bonus.storageBonus).toBeGreaterThan(0);
    });

    it('多个科技叠加资源加成', () => {
      link.addCompletedTech('eco_t1_farming');
      link.addCompletedTech('eco_t3_granary');
      const bonus = link.getResourceLinkBonus('grain');
      expect(bonus.productionBonus).toBe(25); // 10 + 15
    });

    it('铜钱资源联动', () => {
      link.addCompletedTech('eco_t1_trade');
      link.addCompletedTech('eco_t3_marketplace');
      const bonus = link.getResourceLinkBonus('gold');
      expect(bonus.productionBonus).toBe(25); // 10 + 15
    });

    it('天命资源联动', () => {
      link.addCompletedTech('cul_t1_education');
      const bonus = link.getResourceLinkBonus('mandate');
      expect(bonus.productionBonus).toBe(10);
    });

    it('getAllResourceBonuses 返回所有资源类型', () => {
      link.syncCompletedTechIds(['eco_t1_farming', 'eco_t1_trade', 'cul_t1_education']);
      const bonuses = link.getAllResourceBonuses();
      expect(bonuses.length).toBeGreaterThan(0);
      const types = bonuses.map((b) => b.resourceType);
      expect(types).toContain('grain');
      expect(types).toContain('gold');
    });
  });

  // ═══════════════════════════════════════════
  // 7. 通用联动查询
  // ═══════════════════════════════════════════
  describe('通用联动查询', () => {
    it('getLinksByTechId 返回指定科技的联动', () => {
      const links = link.getLinksByTechId('eco_t1_farming');
      expect(links.length).toBeGreaterThan(0);
      expect(links.every((l) => l.techId === 'eco_t1_farming')).toBe(true);
    });

    it('getLinksByTechId 不存在返回空', () => {
      const links = link.getLinksByTechId('nonexistent');
      expect(links).toHaveLength(0);
    });

    it('getActiveLinksByTarget 返回活跃联动', () => {
      link.syncCompletedTechIds(['eco_t1_farming']);
      const activeBuildingLinks = link.getActiveLinksByTarget('building');
      expect(activeBuildingLinks.length).toBeGreaterThan(0);
      expect(activeBuildingLinks.every((l) => l.target === 'building')).toBe(true);
    });

    it('getActiveLinksByTarget 无活跃返回空', () => {
      const activeLinks = link.getActiveLinksByTarget('building');
      expect(activeLinks).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════
  // 8. 统一查询接口 getTechBonus
  // ═══════════════════════════════════════════
  describe('getTechBonus 统一查询', () => {
    it('未完成科技时 getTechBonus 返回 0', () => {
      expect(link.getTechBonus('building', 'farm')).toBe(0);
      expect(link.getTechBonus('hero', 'cavalry_charge')).toBe(0);
      expect(link.getTechBonus('resource', 'grain')).toBe(0);
    });

    it('getTechBonus 查询建筑联动加成', () => {
      link.addCompletedTech('eco_t1_farming');
      expect(link.getTechBonus('building', 'farm')).toBe(20);
    });

    it('getTechBonus 查询武将联动加成', () => {
      link.addCompletedTech('mil_t2_charge');
      expect(link.getTechBonus('hero', 'cavalry_charge')).toBe(20);
    });

    it('getTechBonus 查询资源联动加成', () => {
      link.addCompletedTech('eco_t1_farming');
      expect(link.getTechBonus('resource', 'grain')).toBe(10);
    });

    it('getTechBonus 多科技叠加', () => {
      link.addCompletedTech('eco_t1_farming');
      link.addCompletedTech('eco_t2_irrigation');
      // 建筑 farm 加成: 20 + 25 = 45
      expect(link.getTechBonus('building', 'farm')).toBe(45);
    });

    it('getTechBonus 不相关目标返回 0', () => {
      link.addCompletedTech('eco_t1_farming');
      expect(link.getTechBonus('building', 'barracks')).toBe(0);
      expect(link.getTechBonus('hero', 'cavalry_charge')).toBe(0);
    });

    it('getTechBonusMultiplier 返回正确乘数', () => {
      link.addCompletedTech('eco_t1_farming');
      expect(link.getTechBonusMultiplier('building', 'farm')).toBeCloseTo(1.2);
    });

    it('getTechBonusMultiplier 无加成返回 1.0', () => {
      expect(link.getTechBonusMultiplier('building', 'farm')).toBe(1.0);
    });
  });

  // ═══════════════════════════════════════════
  // 9. 联动事件通知
  // ═══════════════════════════════════════════
  describe('联动事件通知', () => {
    it('addCompletedTech 触发 linksChanged 事件', () => {
      const deps = mockDeps();
      link.init(deps);
      link.addCompletedTech('eco_t1_farming');
      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'tech:linksChanged',
        expect.objectContaining({
          totalActive: expect.any(Number),
        }),
      );
    });

    it('syncCompletedTechIds 触发 linksChanged 事件', () => {
      const deps = mockDeps();
      link.init(deps);
      link.syncCompletedTechIds(['eco_t1_farming']);
      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'tech:linksChanged',
        expect.objectContaining({
          totalActive: expect.any(Number),
        }),
      );
    });

    it('removeCompletedTech 触发 linksChanged 事件', () => {
      const deps = mockDeps();
      link.init(deps);
      link.addCompletedTech('eco_t1_farming');
      link.removeCompletedTech('eco_t1_farming');
      // emit called at least twice (add + remove)
      expect((deps.eventBus.emit as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ═══════════════════════════════════════════
  // 10. 综合联动快照
  // ═══════════════════════════════════════════
  describe('综合联动快照', () => {
    it('getTechLinkSnapshot 返回指定科技的联动快照', () => {
      const snapshot = link.getTechLinkSnapshot('eco_t1_farming');
      expect(snapshot.building).toBeDefined();
      expect(snapshot.hero).toBeDefined();
      expect(snapshot.resource).toBeDefined();
    });

    it('getAllActiveBonuses 返回所有活跃加成', () => {
      link.syncCompletedTechIds(['eco_t1_farming', 'mil_t2_charge']);
      const bonuses = link.getAllActiveBonuses();
      expect(bonuses.buildings).toBeDefined();
      expect(bonuses.heroes).toBeDefined();
      expect(bonuses.resources).toBeDefined();
    });
  });
});
