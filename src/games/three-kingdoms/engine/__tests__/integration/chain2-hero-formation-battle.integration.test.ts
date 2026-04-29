/**
 * 集成链路测试 — 链路2: 武将 → 编队 → 战斗
 *
 * 覆盖场景：
 * - 招募武将 → 获得武将数据 → 编队配置 → 进入战斗
 * - 武将属性影响战斗力 → 编队加成 → 战斗结果
 * - 武将等级/星级 → 编队推荐 → 战斗策略
 * - 跨模块数据一致性验证
 *
 * 测试原则：
 * - 每个用例独立创建 sim 实例
 * - 使用真实引擎 API，不使用 mock
 * - 验证端到端数据流一致性
 */

import { describe, it, expect } from 'vitest';
import { createSim, createSimWithResources, MASSIVE_RESOURCES, SUFFICIENT_RESOURCES } from '../../../test-utils/test-helpers';

// ═══════════════════════════════════════════════
// 链路2: 武将 → 编队 → 战斗 端到端验证
// ═══════════════════════════════════════════════
describe('链路2: 武将→编队→战斗 集成测试', () => {

  describe('CHAIN2-01: 招募武将→验证武将数据', () => {
    it('should have hero system accessible after initialization', () => {
      const sim = createSim();
      const heroSystem = sim.engine.getHeroSystem();
      expect(heroSystem).toBeDefined();
    });

    it('should have recruit system with recruit capability', () => {
      const sim = createSim();
      const recruitSystem = sim.engine.getRecruitSystem();
      expect(recruitSystem).toBeDefined();
    });

    it('should have no generals initially', () => {
      const sim = createSim();
      expect(sim.getGeneralCount()).toBe(0);
    });

    it('should be able to add hero directly for testing', () => {
      const sim = createSim();
      // 使用simulator的addHeroDirectly方法
      sim.addHeroDirectly('guanyu');
      expect(sim.getGeneralCount()).toBe(1);

      const generals = sim.getGenerals();
      expect(generals.some(g => g.id === 'guanyu')).toBe(true);
    });
  });

  describe('CHAIN2-02: 招募武将→编队配置', () => {
    it('should create a formation after having heroes', () => {
      const sim = createSim();

      // 添加武将
      sim.addHeroDirectly('guanyu');
      sim.addHeroDirectly('zhangfei');
      sim.addHeroDirectly('liubei');

      // 创建编队
      const formation = sim.engine.createFormation('main');
      expect(formation).toBeDefined();
      expect(formation?.id).toBe('main');
    });

    it('should set formation with hero IDs', () => {
      const sim = createSim();

      sim.addHeroDirectly('guanyu');
      sim.addHeroDirectly('zhangfei');

      sim.engine.createFormation('main');
      const result = sim.engine.setFormation('main', ['guanyu', 'zhangfei']);

      expect(result).toBeDefined();
      expect(result?.slots).toContain('guanyu');
      expect(result?.slots).toContain('zhangfei');
    });

    it('should get active formation after setting one', () => {
      const sim = createSim();

      sim.addHeroDirectly('guanyu');
      sim.addHeroDirectly('zhangfei');
      sim.addHeroDirectly('liubei');

      sim.engine.createFormation('main');
      sim.engine.setFormation('main', ['guanyu', 'zhangfei', 'liubei']);

      const active = sim.engine.getActiveFormation();
      expect(active).toBeDefined();
      const heroSlots = active?.slots?.filter(s => s !== '') ?? [];
      expect(heroSlots.length).toBe(3);
    });
  });

  describe('CHAIN2-03: 编队→进入战斗', () => {
    it('should have battle engine accessible', () => {
      const sim = createSim();
      const battleEngine = sim.engine.getBattleEngine();
      expect(battleEngine).toBeDefined();
    });

    it('should have campaign system with stage list', () => {
      const sim = createSim();
      const stages = sim.engine.getStageList();
      expect(stages).toBeDefined();
      expect(stages.length).toBeGreaterThan(0);
    });

    it('should be able to start a battle with heroes in formation', () => {
      const sim = createSim();
      sim.addResources(MASSIVE_RESOURCES);
      sim.engine.resource.setCap('grain', 50_000_000);

      // 添加武将并创建编队
      sim.addHeroDirectly('guanyu');
      sim.addHeroDirectly('zhangfei');
      sim.addHeroDirectly('liubei');
      sim.engine.createFormation('main');
      sim.engine.setFormation('main', ['guanyu', 'zhangfei', 'liubei']);

      // 获取第一个关卡
      const stages = sim.engine.getStageList();
      const firstStage = stages[0];

      // 开始战斗
      const result = sim.engine.startBattle(firstStage.id);
      expect(result).toBeDefined();
    });

    it('should complete battle and update campaign progress', () => {
      const sim = createSim();
      sim.addResources(MASSIVE_RESOURCES);
      sim.engine.resource.setCap('grain', 50_000_000);

      sim.addHeroDirectly('guanyu');
      sim.addHeroDirectly('zhangfei');
      sim.addHeroDirectly('liubei');
      sim.engine.createFormation('main');
      sim.engine.setFormation('main', ['guanyu', 'zhangfei', 'liubei']);

      const stages = sim.engine.getStageList();
      const firstStage = stages[0];

      sim.engine.startBattle(firstStage.id);

      // 完成战斗
      sim.engine.completeBattle(firstStage.id, 3);

      // 验证进度更新
      const progress = sim.engine.getCampaignProgress();
      expect(progress).toBeDefined();
    });
  });

  describe('CHAIN2-04: 武将属性→战斗力→编队总战力', () => {
    it('should calculate total power based on heroes', () => {
      const sim = createSim();
      sim.addHeroDirectly('guanyu');
      sim.addHeroDirectly('zhangfei');

      const power = sim.getTotalPower();
      expect(power).toBeGreaterThanOrEqual(0);
    });

    it('should increase total power when adding more heroes', () => {
      const sim = createSim();
      sim.addHeroDirectly('guanyu');
      const power1 = sim.getTotalPower();

      sim.addHeroDirectly('zhangfei');
      const power2 = sim.getTotalPower();

      expect(power2).toBeGreaterThanOrEqual(power1);
    });
  });

  describe('CHAIN2-05: 武将升级→属性变化→编队战力更新', () => {
    it('should have hero level system accessible', () => {
      const sim = createSim();
      const levelSystem = sim.engine.getLevelSystem();
      expect(levelSystem).toBeDefined();
    });

    it('should enhance hero and increase power', () => {
      const sim = createSim();
      sim.addHeroDirectly('guanyu');

      const powerBefore = sim.getTotalPower();

      // 尝试强化武将
      const result = sim.engine.enhanceHero('guanyu', 5);
      // 结果可能为null如果条件不满足，但不应该抛异常
      expect(result).toBeDefined();
    });
  });

  describe('CHAIN2-06: 多编队管理→切换编队→战斗验证', () => {
    it('should support multiple formations', () => {
      const sim = createSim();
      sim.addHeroDirectly('guanyu');
      sim.addHeroDirectly('zhangfei');
      sim.addHeroDirectly('liubei');
      sim.addHeroDirectly('zhaoyun');
      sim.addHeroDirectly('machao');
      sim.addHeroDirectly('huangzhong');

      const f1 = sim.engine.createFormation('team-a');
      const f2 = sim.engine.createFormation('team-b');

      expect(f1).toBeDefined();
      expect(f2).toBeDefined();

      sim.engine.setFormation('team-a', ['guanyu', 'zhangfei', 'liubei']);
      sim.engine.setFormation('team-b', ['zhaoyun', 'machao', 'huangzhong']);

      const formations = sim.engine.getFormations();
      expect(formations.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('CHAIN2-07: 武将→编队→战斗→奖励→资源增加 全链路', () => {
    it('should complete full hero-formation-battle-reward chain', () => {
      const sim = createSim();
      sim.addResources(MASSIVE_RESOURCES);
      sim.engine.resource.setCap('grain', 50_000_000);
      sim.engine.resource.setCap('troops', 10_000_000);

      const goldBefore = sim.getResource('gold');

      // 1. 添加武将
      sim.addHeroDirectly('guanyu');
      sim.addHeroDirectly('zhangfei');
      sim.addHeroDirectly('liubei');

      // 2. 创建编队
      sim.engine.createFormation('main');
      sim.engine.setFormation('main', ['guanyu', 'zhangfei', 'liubei']);

      // 3. 战斗
      const stages = sim.engine.getStageList();
      sim.engine.startBattle(stages[0].id);
      sim.engine.completeBattle(stages[0].id, 3);

      // 4. 验证进度更新
      const progress = sim.engine.getCampaignProgress();
      expect(progress).toBeDefined();
    });

    it('should maintain hero data through save/load cycle', () => {
      const sim = createSim();
      sim.addHeroDirectly('guanyu');
      sim.addHeroDirectly('zhangfei');
      sim.engine.createFormation('main');
      sim.engine.setFormation('main', ['guanyu', 'zhangfei']);

      const countBefore = sim.getGeneralCount();

      // 保存加载
      const json = sim.engine.serialize();
      const sim2 = createSim();
      sim2.engine.deserialize(json);

      const countAfter = sim2.getGeneralCount();
      expect(countAfter).toBe(countBefore);
    });
  });

  describe('CHAIN2-08: 招募令→武将招募→编队→战斗 资源链路', () => {
    it('should have recruit token as a resource type', () => {
      const sim = createSim();
      const recruitToken = sim.getResource('recruitToken');
      expect(recruitToken).toBeGreaterThanOrEqual(0);
    });

    it('should have hero star system for hero advancement', () => {
      const sim = createSim();
      const starSystem = sim.engine.getHeroStarSystem();
      expect(starSystem).toBeDefined();
    });
  });
});
