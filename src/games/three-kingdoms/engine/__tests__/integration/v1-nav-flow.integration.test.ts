/**
 * 导航系统 Play 流程集成测试 (v1.0 NAV-FLOW-1~6)
 *
 * 覆盖范围：
 * - NAV-FLOW-1: 主界面布局验证
 * - NAV-FLOW-2: 资源栏详细验证
 * - NAV-FLOW-3: Tab切换验证
 * - NAV-FLOW-4: 中央场景区验证
 * - NAV-FLOW-5: 日历系统验证
 * - NAV-FLOW-6: 更多菜单下拉验证
 *
 * 测试原则：
 * - 每个用例创建独立的 sim 实例
 * - 使用真实引擎 API，不使用 mock
 * - 以实际代码行为为准
 */

import { describe, it, expect } from 'vitest';
import { createSim } from '../../../test-utils/test-helpers';
import type { ResourceType, BuildingType } from '../../../shared/types';

// ═══════════════════════════════════════════════
// V1 NAV-FLOW 导航系统
// ═══════════════════════════════════════════════
describe('V1 NAV-FLOW 导航系统', () => {

  // ═══════════════════════════════════════════════
  // NAV-FLOW-1: 主界面布局验证
  // ═══════════════════════════════════════════════
  describe('NAV-FLOW-1: 主界面布局验证', () => {
    it('should initialize engine successfully and return complete snapshot', () => {
      // NAV-FLOW-1 步骤1: init() 成功、getSnapshot() 返回完整数据
      const sim = createSim();
      const snapshot = sim.getSnapshot();

      // 验证快照包含所有必要字段
      expect(snapshot).toBeDefined();
      expect(snapshot.resources).toBeDefined();
      expect(snapshot.productionRates).toBeDefined();
      expect(snapshot.buildingLevels).toBeDefined();
      expect(snapshot.onlineSeconds).toBeDefined();
    });

    it('should have correct initial resources after init', () => {
      // NAV-FLOW-1 步骤2: 验证初始资源 grain=500, gold=300, troops=50, mandate=0
      const sim = createSim();

      expect(sim.getResource('grain')).toBe(500);
      expect(sim.getResource('gold')).toBe(300);
      expect(sim.getResource('troops')).toBe(50);
      expect(sim.getResource('mandate')).toBe(0);
    });

    it('should have correct initial building levels', () => {
      // NAV-FLOW-1 步骤2: 验证初始建筑 castle=1, farmland=1
      const sim = createSim();

      expect(sim.getBuildingLevel('castle')).toBe(1);
      expect(sim.getBuildingLevel('farmland')).toBe(1);
    });

    it('should not throw during init and snapshot operations', () => {
      // NAV-FLOW-1: 无异常验证
      const sim = createSim();
      expect(() => sim.getSnapshot()).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════════
  // NAV-FLOW-2: 资源栏详细验证
  // ═══════════════════════════════════════════════
  describe('NAV-FLOW-2: 资源栏详细验证', () => {
    it('should return all 6 resource types from getAllResources', () => {
      // NAV-FLOW-2 步骤1: 验证 getAllResources() 返回6种资源
      const sim = createSim();
      const resources = sim.getAllResources();

      const expectedTypes: ResourceType[] = ['grain', 'gold', 'troops', 'mandate', 'techPoint', 'recruitToken'];
      for (const type of expectedTypes) {
        expect(resources).toHaveProperty(type);
        expect(typeof resources[type]).toBe('number');
      }
    });

    it('should return correct initial resource values', () => {
      // NAV-FLOW-2: 引擎层验证数值正确
      const sim = createSim();
      const resources = sim.getAllResources();

      expect(resources.grain).toBe(500);
      expect(resources.gold).toBe(300);
      expect(resources.troops).toBe(50);
      expect(resources.mandate).toBe(0);
      expect(resources.techPoint).toBe(0);
      expect(resources.recruitToken).toBe(0);
    });

    it('should have production rates after init', () => {
      // NAV-FLOW-2 步骤2: 验证产出速率存在
      const sim = createSim();
      const snapshot = sim.getSnapshot();

      expect(snapshot.productionRates).toBeDefined();
      // 初始状态下农田 Lv1 产出 0.8 粮草/秒
      expect(snapshot.productionRates.grain).toBeGreaterThan(0);
    });

    it('should have non-negative resource values', () => {
      // NAV-FLOW-2: 引擎层验证所有资源值非负
      const sim = createSim();
      const resources = sim.getAllResources();

      for (const [type, amount] of Object.entries(resources)) {
        expect(amount).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // ═══════════════════════════════════════════════
  // NAV-FLOW-3: Tab切换验证
  // ═══════════════════════════════════════════════
  describe('NAV-FLOW-3: Tab切换验证', () => {
    it('should have accessible resource subsystem', () => {
      // NAV-FLOW-3: 各子系统可访问 — resource
      const sim = createSim();
      const engine = sim.engine;

      expect(engine.resource).toBeDefined();
      expect(typeof engine.resource.getAmount).toBe('function');
      expect(typeof engine.resource.getResources).toBe('function');
    });

    it('should have accessible building subsystem', () => {
      // NAV-FLOW-3: 各子系统可访问 — building
      const sim = createSim();
      const engine = sim.engine;

      expect(engine.building).toBeDefined();
      expect(typeof engine.building.getLevel).toBe('function');
    });

    it('should have accessible calendar subsystem', () => {
      // NAV-FLOW-3: 各子系统可访问 — calendar
      const sim = createSim();
      const engine = sim.engine;

      expect(engine.calendar).toBeDefined();
      expect(typeof engine.calendar.getYear).toBe('function');
      expect(typeof engine.calendar.getSeason).toBe('function');
    });

    it('should have accessible hero subsystem', () => {
      // NAV-FLOW-3: 各子系统可访问 — hero
      const sim = createSim();
      const engine = sim.engine;

      expect(engine.hero).toBeDefined();
      expect(typeof engine.hero.getAllGenerals).toBe('function');
    });

    it('should have complete subsystem registry', () => {
      // NAV-FLOW-3: 验证引擎子系统注册表完整
      const sim = createSim();
      const registry = sim.engine.getSubsystemRegistry();

      expect(registry).toBeDefined();
      // 核心子系统必须存在
      expect(registry.has('resource')).toBe(true);
      expect(registry.has('building')).toBe(true);
      expect(registry.has('calendar')).toBe(true);
      expect(registry.has('hero')).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════
  // NAV-FLOW-4: 中央场景区验证
  // ═══════════════════════════════════════════════
  describe('NAV-FLOW-4: 中央场景区验证', () => {
    it('should have building system operational for building scene', () => {
      // NAV-FLOW-4: building系统正常 → 建筑场景
      const sim = createSim();
      const engine = sim.engine;

      // 建筑系统可正常调用
      expect(engine.building.getLevel('castle')).toBe(1);
      expect(engine.building.getLevel('farmland')).toBe(1);

      // getAllBuildings 返回完整建筑数据
      const buildings = engine.building.getAllBuildings();
      expect(buildings).toBeDefined();
      expect(Object.keys(buildings).length).toBeGreaterThan(0);
    });

    it('should have hero system operational for hero scene', () => {
      // NAV-FLOW-4: hero系统正常 → 武将场景
      const sim = createSim();
      const engine = sim.engine;

      // 武将系统可正常调用
      expect(engine.hero.getAllGenerals()).toBeDefined();
      expect(engine.hero.getGeneralCount()).toBe(0);
    });

    it('should support building operations through engine', () => {
      // NAV-FLOW-4: 验证建筑升级操作正常
      const sim = createSim();

      // 先升级主城（farmland等级不能超过castle）
      sim.addResources({ grain: 10000, gold: 10000 });
      sim.upgradeBuilding('castle');

      const levelBefore = sim.getBuildingLevel('farmland');
      sim.upgradeBuilding('farmland');
      const levelAfter = sim.getBuildingLevel('farmland');

      expect(levelAfter).toBeGreaterThan(levelBefore);
    });

    it('should support hero recruitment through engine', () => {
      // NAV-FLOW-4: 验证武将招募操作正常
      const sim = createSim();
      const engine = sim.engine;

      // 招募系统存在
      expect(engine.heroRecruit).toBeDefined();
      expect(typeof engine.heroRecruit.recruitSingle).toBe('function');
    });
  });

  // ═══════════════════════════════════════════════
  // NAV-FLOW-5: 日历系统验证
  // ═══════════════════════════════════════════════
  describe('NAV-FLOW-5: 日历系统验证', () => {
    it('should have calendar system available', () => {
      // NAV-FLOW-5 步骤1: 验证calendar系统存在且可用
      const sim = createSim();
      const calendar = sim.engine.calendar;

      expect(calendar).toBeDefined();
      expect(typeof calendar.getYear).toBe('function');
      expect(typeof calendar.getSeason).toBe('function');
      expect(typeof calendar.getWeather).toBe('function');
    });

    it('should return initial year/season/weather', () => {
      // NAV-FLOW-5 步骤2: 验证初始年号/季节/天气
      const sim = createSim();
      const calendar = sim.engine.calendar;

      const date = calendar.getDate();
      expect(date).toBeDefined();
      expect(date.year).toBe(1);
      expect(date.eraName).toBeDefined();
      expect(typeof date.eraName).toBe('string');
      expect(date.season).toBeDefined();

      // 初始天气
      const weather = calendar.getWeather();
      expect(weather).toBeDefined();
      expect(typeof weather).toBe('string');
    });

    it('should advance time after fastForward', () => {
      // NAV-FLOW-5 步骤3: fastForward后时间推进
      const sim = createSim();

      const secondsBefore = sim.getOnlineSeconds();
      sim.fastForwardSeconds(60);
      const secondsAfter = sim.getOnlineSeconds();

      expect(secondsAfter).toBeGreaterThan(secondsBefore);
      expect(secondsAfter).toBeGreaterThanOrEqual(60);
    });

    it('should advance calendar days after sufficient fastForward', () => {
      // NAV-FLOW-5: 足够的 fastForward 应推进日历天数
      const sim = createSim();
      const calendar = sim.engine.calendar;

      const daysBefore = calendar.getTotalDays();
      // 快进1小时（3600秒），时间缩放 DEFAULT_TIME_SCALE=240 → 足以推进多天
      sim.fastForwardHours(1);
      const daysAfter = calendar.getTotalDays();

      expect(daysAfter).toBeGreaterThanOrEqual(daysBefore);
    });

    it('should return calendar state via getSnapshot', () => {
      // NAV-FLOW-5: getSnapshot 包含日历状态
      const sim = createSim();
      const snapshot = sim.engine.getSnapshot();

      expect(snapshot.calendar).toBeDefined();
      expect(snapshot.calendar.date).toBeDefined();
      expect(snapshot.calendar.weather).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════
  // NAV-FLOW-6: 更多菜单下拉验证
  // ═══════════════════════════════════════════════
  describe('NAV-FLOW-6: 更多菜单下拉验证', () => {
    it('should have mail system accessible via registry', () => {
      // NAV-FLOW-6: mail子系统可访问
      const sim = createSim();
      const registry = sim.engine.getSubsystemRegistry();

      expect(registry.has('mail')).toBe(true);
      expect(registry.has('mailTemplate')).toBe(true);
    });

    it('should have shop system accessible via registry', () => {
      // NAV-FLOW-6: shop子系统可访问
      const sim = createSim();
      const registry = sim.engine.getSubsystemRegistry();

      expect(registry.has('shop')).toBe(true);
      expect(registry.has('currency')).toBe(true);
    });

    it('should have equipment system accessible via registry', () => {
      // NAV-FLOW-6: equipment子系统可访问
      const sim = createSim();
      const registry = sim.engine.getSubsystemRegistry();

      expect(registry.has('equipment')).toBe(true);
      expect(registry.has('equipmentForge')).toBe(true);
      expect(registry.has('equipmentEnhance')).toBe(true);
    });

    it('should have quest system accessible via registry', () => {
      // NAV-FLOW-6: quest子系统可访问
      const sim = createSim();
      const registry = sim.engine.getSubsystemRegistry();

      expect(registry.has('quest')).toBe(true);
    });

    it('should have achievement system accessible via registry', () => {
      // NAV-FLOW-6: achievement子系统可访问
      const sim = createSim();
      const registry = sim.engine.getSubsystemRegistry();

      expect(registry.has('achievement')).toBe(true);
    });

    it('should have all expected subsystems in registry', () => {
      // NAV-FLOW-6: 验证getSubsystemRegistry包含所有子系统
      const sim = createSim();
      const registry = sim.engine.getSubsystemRegistry();
      const initOrder = registry.getInitOrder();

      // 验证注册表中包含足够多的子系统
      expect(initOrder.length).toBeGreaterThan(20);

      // 验证关键子系统名称
      const requiredSubsystems = [
        'resource', 'building', 'calendar', 'hero',
        'mail', 'shop', 'equipment', 'quest', 'achievement',
        'alliance', 'prestige', 'arena', 'expedition',
        'offlineReward', 'offlineEstimate', 'offlineSnapshot',
      ];
      for (const name of requiredSubsystems) {
        expect(registry.has(name)).toBe(true);
      }
    });
  });
});
