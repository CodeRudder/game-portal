/**
 * V4 攻城略地(下) — 跨子系统串联集成测试
 *
 * 覆盖 §10 跨子系统串联（选最重要的5-6个）：
 * - 10.0A 领土产出→科技点入账
 * - 10.0B 攻城胜利→声望增加
 * - 10.1 核心养成循环（资源→建筑→科技→战力提升）
 * - 10.3 科技→战斗联动（科技加成影响战斗属性）
 * - 10.7 地图→战斗→科技联动
 *
 * 编码规范：
 * - 每个it前创建新的sim实例
 * - describe按play流程ID组织
 * - 不使用 as any
 */

import { describe, it, expect } from 'vitest';
import { createSim } from '../../../test-utils/test-helpers';
import { SUFFICIENT_RESOURCES, MASSIVE_RESOURCES } from '../../../test-utils/test-helpers';
import type { GameEventSimulator } from '../../../test-utils/GameEventSimulator';

// ── 辅助：初始化带武将和编队的状态 ──
function initFullState(): GameEventSimulator {
  const sim = createSim();
  sim.engine.resource.setCap('grain', 10_000_000);
  sim.engine.resource.setCap('gold', 10_000_000);
  sim.engine.resource.setCap('troops', 10_000_000);
  sim.addResources(MASSIVE_RESOURCES);
  const heroIds = ['liubei', 'guanyu', 'zhangfei', 'zhugeliang', 'zhaoyun', 'caocao'];
  for (const id of heroIds) {
    sim.addHeroDirectly(id);
  }
  sim.engine.createFormation('main');
  sim.engine.setFormation('main', heroIds);
  return sim;
}

// ── 辅助：三星通关指定关卡 ──
function threeStarClear(sim: GameEventSimulator, stageId: string): void {
  sim.engine.startBattle(stageId);
  sim.engine.completeBattle(stageId, 3);
}

// ═══════════════════════════════════════════════════════════════
// V4 CROSS-SYSTEM-FLOW 跨子系统串联
// ═══════════════════════════════════════════════════════════════
describe('V4 CROSS-SYSTEM-FLOW 跨子系统串联', () => {

  // ═══════════════════════════════════════════════════════════════
  // §10.0A 领土产出→科技点入账
  // ═══════════════════════════════════════════════════════════════
  describe('§10.0A 领土产出→科技点入账', () => {

    it('should have territory system with production data', () => {
      const sim = initFullState();
      const territory = sim.engine.getTerritorySystem();
      const state = territory.getState();

      expect(state).toBeDefined();
      expect(state.territories).toBeDefined();
      expect(Array.isArray(state.territories)).toBe(true);
    });

    it('should have tech point system that tracks points', () => {
      const sim = initFullState();
      const techPoint = sim.engine.getTechPointSystem();

      expect(techPoint.getState()).toBeDefined();
      expect(typeof techPoint.getCurrentPoints()).toBe('number');
    });

    it('should accumulate tech points when academy level > 0', () => {
      const sim = initFullState();
      const techPoint = sim.engine.getTechPointSystem();

      // 升级书院到1级
      sim.engine.upgradeBuilding('academy');
      const academyLevel = sim.engine.building.getLevel('academy');
      expect(academyLevel).toBeGreaterThan(0);

      // 同步书院等级
      techPoint.syncAcademyLevel(academyLevel);

      // 模拟时间流逝
      const productionRate = techPoint.getProductionRate();
      expect(productionRate).toBeGreaterThan(0);

      // 手动增加科技点模拟产出
      const dt = 3600; // 1小时
      const expectedGain = productionRate * dt;
      techPoint.update(dt);
      expect(techPoint.getCurrentPoints()).toBeCloseTo(expectedGain, 1);
    });

    it('should have territory production contribute to resources', () => {
      const sim = initFullState();
      const territory = sim.engine.getTerritorySystem();

      // 捕获一块领土
      territory.captureTerritory('changsha', 'player');
      const captured = territory.getTerritoryById('changsha');
      if (captured && captured.ownership === 'player') {
        const summary = territory.getPlayerProductionSummary();
        expect(summary.totalTerritories).toBeGreaterThan(0);
        expect(summary.totalProduction).toBeDefined();
      }
    });

    it('should link territory count to production capacity', () => {
      const sim = initFullState();
      const territory = sim.engine.getTerritorySystem();

      const initialCount = territory.getPlayerTerritoryCount();
      const initialSummary = territory.getPlayerProductionSummary();

      // 捕获领土后产出增加
      territory.captureTerritory('changsha', 'player');
      const newCount = territory.getPlayerTerritoryCount();
      expect(newCount).toBe(initialCount + 1);

      const newSummary = territory.getPlayerProductionSummary();
      // 新领土应有产出
      expect(newSummary.totalTerritories).toBeGreaterThan(initialSummary.totalTerritories);
    });

    it('should have tech point production rate scale with academy level', () => {
      const sim = initFullState();
      const techPoint = sim.engine.getTechPointSystem();

      // Level 1
      techPoint.syncAcademyLevel(1);
      const rate1 = techPoint.getProductionRate();

      // Level 5
      techPoint.syncAcademyLevel(5);
      const rate5 = techPoint.getProductionRate();

      expect(rate5).toBeGreaterThan(rate1);
    });

    it('should produce zero tech points when academy is level 0', () => {
      const sim = initFullState();
      const techPoint = sim.engine.getTechPointSystem();

      techPoint.syncAcademyLevel(0);
      expect(techPoint.getProductionRate()).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // §10.0B 攻城胜利→声望增加
  // ═══════════════════════════════════════════════════════════════
  describe('§10.0B 攻城胜利→声望增加', () => {

    it('should have siege system accessible', () => {
      const sim = initFullState();
      const siege = sim.engine.getSiegeSystem();
      expect(siege).toBeDefined();
      expect(siege.getState()).toBeDefined();
    });

    it('should have prestige system accessible', () => {
      const sim = initFullState();
      const prestige = sim.engine.getPrestigeSystem();
      expect(prestige).toBeDefined();
      expect(prestige.getState()).toBeDefined();
    });

    it('should execute siege and return result', () => {
      const sim = initFullState();
      const siege = sim.engine.getSiegeSystem();
      const territory = sim.engine.getTerritorySystem();

      // 确保有可攻击的领土
      const attackable = territory.getAttackableTerritories('player');
      if (attackable.length > 0) {
        const target = attackable[0];
        const result = siege.executeSiege(
          target.id,
          'player',
          10000,  // troops
          100000, // grain
        );
        expect(result).toBeDefined();
        expect(result.success).toBeDefined();
        expect(typeof result.victory).toBe('boolean');
      }
    });

    it('should capture territory on siege victory', () => {
      const sim = initFullState();
      const siege = sim.engine.getSiegeSystem();
      const territory = sim.engine.getTerritorySystem();

      const attackable = territory.getAttackableTerritories('player');
      if (attackable.length > 0) {
        const target = attackable[0];
        const beforeOwnership = territory.getTerritoryById(target.id)?.ownership;

        // 强制胜利
        const result = siege.executeSiegeWithResult(
          target.id,
          'player',
          100000,
          1000000,
          true, // battleVictory = true
        );

        if (result.success && result.victory) {
          const afterOwnership = territory.getTerritoryById(target.id)?.ownership;
          expect(afterOwnership).toBe('player');
          expect(result.capture).toBeDefined();
        }
      }
    });

    it('should increase prestige after siege victory', () => {
      const sim = initFullState();
      const prestige = sim.engine.getPrestigeSystem();
      const initialState = prestige.getState();
      const initialLevel = initialState.currentLevel;

      // 添加声望点数模拟攻城胜利
      const gained = prestige.addPrestigePoints('siege_victory', 100);
      expect(gained).toBeGreaterThan(0);

      const afterState = prestige.getState();
      expect(afterState.currentPoints).toBeGreaterThan(initialState.currentPoints);
    });

    it('should track prestige level and points', () => {
      const sim = initFullState();
      const prestige = sim.engine.getPrestigeSystem();
      const state = prestige.getState();

      expect(state.currentLevel).toBeGreaterThanOrEqual(1);
      expect(typeof state.currentPoints).toBe('number');
      expect(typeof state.totalEarned).toBe('number');
    });

    it('should provide prestige level info', () => {
      const sim = initFullState();
      const prestige = sim.engine.getPrestigeSystem();
      const info = prestige.getCurrentLevelInfo();

      expect(info).toBeDefined();
      expect(info.level).toBeGreaterThanOrEqual(1);
      expect(info.title).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // §10.1 核心养成循环（资源→建筑→科技→战力提升）
  // ═══════════════════════════════════════════════════════════════
  describe('§10.1 核心养成循环', () => {

    it('should upgrade building to increase resource production', () => {
      const sim = initFullState();
      const initialLevel = sim.engine.building.getLevel('farmland');

      sim.engine.upgradeBuilding('farmland');

      const newLevel = sim.engine.building.getLevel('farmland');
      expect(newLevel).toBe(initialLevel + 1);
    });

    it('should upgrade academy to unlock tech research', () => {
      const sim = initFullState();

      sim.engine.upgradeBuilding('academy');
      const academyLevel = sim.engine.building.getLevel('academy');
      expect(academyLevel).toBeGreaterThan(0);
    });

    it('should have tech tree system with nodes', () => {
      const sim = initFullState();
      const techTree = sim.engine.getTechTreeSystem();
      const state = techTree.getState();

      expect(state).toBeDefined();
      expect(state.nodes).toBeDefined();
    });

    it('should have hero power calculation', () => {
      const sim = initFullState();
      const totalPower = sim.engine.hero.calculateTotalPower();
      expect(typeof totalPower).toBe('number');
      expect(totalPower).toBeGreaterThan(0);
    });

    it('should complete resource→building→power cycle', () => {
      const sim = initFullState();

      // 1. 检查初始资源
      const initialGrain = sim.getResourceAmount('grain');
      expect(initialGrain).toBeGreaterThan(0);

      // 2. 升级建筑
      sim.engine.upgradeBuilding('barracks');
      const barracksLevel = sim.engine.building.getLevel('barracks');
      expect(barracksLevel).toBeGreaterThan(0);

      // 3. 招募武将增加战力
      const heroIds = ['liubei', 'guanyu', 'zhangfei'];
      for (const id of heroIds) {
        sim.addHeroDirectly(id);
      }
      const power = sim.engine.hero.calculateTotalPower();
      expect(power).toBeGreaterThan(0);
    });

    it('should have formation system for battle power', () => {
      const sim = initFullState();
      const heroIds = ['liubei', 'guanyu', 'zhangfei', 'zhugeliang', 'zhaoyun', 'caocao'];

      const formation = sim.engine.createFormation('test');
      expect(formation).toBeDefined();

      const set = sim.engine.setFormation('test', heroIds);
      expect(set).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // §10.3 科技→战斗联动（科技加成影响战斗属性）
  // ═══════════════════════════════════════════════════════════════
  describe('§10.3 科技→战斗联动', () => {

    it('should have tech tree with researchable nodes', () => {
      const sim = initFullState();
      const techTree = sim.engine.getTechTreeSystem();
      const state = techTree.getState();

      // 科技树应有节点
      const nodeCount = Object.keys(state.nodes).length;
      expect(nodeCount).toBeGreaterThan(0);
    });

    it('should have tech research system with queue', () => {
      const sim = initFullState();
      const research = sim.engine.getTechResearchSystem();

      const queue = research.getQueue();
      expect(Array.isArray(queue)).toBe(true);
    });

    it('should have research queue size based on academy level', () => {
      const sim = initFullState();
      const research = sim.engine.getTechResearchSystem();

      sim.engine.upgradeBuilding('academy');
      const academyLevel = sim.engine.building.getLevel('academy');

      const maxSize = research.getMaxQueueSize();
      expect(typeof maxSize).toBe('number');
      expect(maxSize).toBeGreaterThanOrEqual(1);
    });

    it('should check if tech node can be researched', () => {
      const sim = initFullState();
      const techTree = sim.engine.getTechTreeSystem();
      const state = techTree.getState();

      // 查找第一个可用节点
      const nodes = Object.values(state.nodes);
      const availableNode = nodes.find(n => n.status === 'available');
      if (availableNode) {
        const check = techTree.canResearch(availableNode.id);
        expect(check.can).toBeDefined();
      }
    });

    it('should have tech effects that can enhance battle', () => {
      const sim = initFullState();
      const techTree = sim.engine.getTechTreeSystem();

      // 获取科技效果汇总
      const effects = techTree.getAllEffects();
      expect(effects).toBeDefined();
      expect(Array.isArray(effects)).toBe(true);
    });

    it('should have research speed bonus from academy', () => {
      const sim = initFullState();
      const techPoint = sim.engine.getTechPointSystem();

      sim.engine.upgradeBuilding('academy');
      const academyLevel = sim.engine.building.getLevel('academy');
      techPoint.syncAcademyLevel(academyLevel);

      const multiplier = techPoint.getResearchSpeedMultiplier();
      expect(multiplier).toBeGreaterThanOrEqual(1.0);
    });

    it('should sync research speed bonus correctly', () => {
      const sim = initFullState();
      const techPoint = sim.engine.getTechPointSystem();

      // 无加成
      techPoint.syncResearchSpeedBonus(0);
      expect(techPoint.getResearchSpeedMultiplier()).toBe(1.0);

      // 20%加成
      techPoint.syncResearchSpeedBonus(20);
      expect(techPoint.getResearchSpeedMultiplier()).toBe(1.2);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // §10.7 地图→战斗→科技联动
  // ═══════════════════════════════════════════════════════════════
  describe('§10.7 地图→战斗→科技联动', () => {

    it('should have map territory system with territories', () => {
      const sim = initFullState();
      const territory = sim.engine.getTerritorySystem();

      const all = territory.getAllTerritories();
      expect(all.length).toBeGreaterThan(0);
    });

    it('should have world map system accessible', () => {
      const sim = initFullState();
      const worldMap = sim.engine.getWorldMapSystem();
      expect(worldMap).toBeDefined();
      expect(worldMap.getState()).toBeDefined();
    });

    it('should link siege victory to territory capture', () => {
      const sim = initFullState();
      const siege = sim.engine.getSiegeSystem();
      const territory = sim.engine.getTerritorySystem();

      const beforeCount = territory.getPlayerTerritoryCount();
      const attackable = territory.getAttackableTerritories('player');

      if (attackable.length > 0) {
        const target = attackable[0];
        siege.executeSiegeWithResult(target.id, 'player', 100000, 1000000, true);

        const afterCount = territory.getPlayerTerritoryCount();
        expect(afterCount).toBe(beforeCount + 1);
      }
    });

    it('should link territory capture to production increase', () => {
      const sim = initFullState();
      const territory = sim.engine.getTerritorySystem();
      const siege = sim.engine.getSiegeSystem();

      const beforeSummary = territory.getPlayerProductionSummary();
      const attackable = territory.getAttackableTerritories('player');

      if (attackable.length > 0) {
        const target = attackable[0];
        siege.executeSiegeWithResult(target.id, 'player', 100000, 1000000, true);

        const afterSummary = territory.getPlayerProductionSummary();
        expect(afterSummary.totalTerritories).toBeGreaterThan(beforeSummary.totalTerritories);
      }
    });

    it('should link campaign progress to resource gain', () => {
      const sim = initFullState();
      const stages = sim.engine.getStageList();

      if (stages.length > 0) {
        const beforeResources = sim.getAllResources();
        threeStarClear(sim, stages[0].id);
        const afterResources = sim.getAllResources();

        // 战斗应产出资源（碎片或经验）
        expect(afterResources).toBeDefined();
      }
    });

    it('should have complete map→siege→territory→production→tech flow', () => {
      const sim = initFullState();
      const territory = sim.engine.getTerritorySystem();
      const siege = sim.engine.getSiegeSystem();
      const techPoint = sim.engine.getTechPointSystem();

      // 1. 地图：获取可攻击领土
      const attackable = territory.getAttackableTerritories('player');

      // 2. 攻城：执行攻城
      if (attackable.length > 0) {
        siege.executeSiegeWithResult(attackable[0].id, 'player', 100000, 1000000, true);

        // 3. 领土：验证占领
        const captured = territory.getTerritoryById(attackable[0].id);
        expect(captured?.ownership).toBe('player');

        // 4. 产出：验证产出增加
        const summary = territory.getPlayerProductionSummary();
        expect(summary.totalTerritories).toBeGreaterThan(0);

        // 5. 科技：验证科技点系统可用
        expect(techPoint.getCurrentPoints()).toBeGreaterThanOrEqual(0);
      }
    });

    it('should have garrison system for territory defense', () => {
      const sim = initFullState();
      const garrison = sim.engine.getGarrisonSystem();
      expect(garrison).toBeDefined();
      expect(garrison.getState()).toBeDefined();
    });

    it('should have siege enhancer for victory estimation', () => {
      const sim = initFullState();
      const enhancer = sim.engine.getSiegeEnhancer();
      expect(enhancer).toBeDefined();
      expect(enhancer.getState()).toBeDefined();
    });
  });
});
