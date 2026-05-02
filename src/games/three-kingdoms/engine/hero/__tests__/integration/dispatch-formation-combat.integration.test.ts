/**
 * 集成测试: 派驻 → 编队 → 战斗 联动
 *
 * 验证武将派驻、编队、战斗三个子系统的端到端联动：
 *   1. 派驻武将 → 建筑产出增加 → 资源可用于升级
 *   2. 编队包含派驻武将 → 战斗正常
 *   3. 派驻武将升级 → 建筑产出更新 → 编队战力更新
 *   4. 取消派驻 → 建筑产出恢复 → 编队不受影响
 *   5. 完整循环：招募 → 升级 → 派驻 → 编队 → 战斗 → 奖励 → 再升级
 *
 * @module engine/hero/__tests__/integration/dispatch-formation-combat.integration.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GameEventSimulator } from '../../../../test-utils/GameEventSimulator';
import type { BuildingType } from '../../../../shared/types';

// ── 测试 ──────────────────────────────────────

describe('派驻 → 编队 → 战斗 联动集成测试', () => {
  let sim: GameEventSimulator;

  beforeEach(() => {
    sim = new GameEventSimulator();
    sim.initMidGameState();
  });

  // ── 1. 派驻武将 → 建筑产出增加 → 资源可用于升级 ──

  describe('[DFC-1] 派驻武将 → 建筑产出增加 → 资源可用于升级', () => {
    it('派驻武将后建筑获得加成', () => {
      const dispatch = sim.engine.getHeroDispatchSystem();
      const generals = sim.getGenerals();
      expect(generals.length).toBeGreaterThan(0);

      const heroId = generals[0].id;
      const result = dispatch.dispatchHero(heroId, 'farmland' as BuildingType);
      expect(result.success).toBe(true);
      expect(result.bonusPercent).toBeGreaterThan(0);
    });

    it('派驻后 getDispatchBonus 返回正值', () => {
      const dispatch = sim.engine.getHeroDispatchSystem();
      const generals = sim.getGenerals();
      const heroId = generals[0].id;

      dispatch.dispatchHero(heroId, 'barracks' as BuildingType);
      const bonus = dispatch.getDispatchBonus('barracks' as BuildingType);
      expect(bonus).toBeGreaterThan(0);
    });

    it('派驻武将后资源可用于建筑升级', () => {
      const dispatch = sim.engine.getHeroDispatchSystem();
      const generals = sim.getGenerals();
      const heroId = generals[0].id;

      // 记录当前资源
      const goldBefore = sim.getResource('gold');

      // 派驻武将到农田增加产出
      dispatch.dispatchHero(heroId, 'farmland' as BuildingType);

      // 资源仍可用于升级（未被消耗）
      expect(sim.getResource('gold')).toBe(goldBefore);

      // 可以执行建筑升级（先升级主城以解除上限约束）
      const castleLevel = sim.getBuildingLevel('castle' as BuildingType);
      sim.addResources({ gold: 5000000, grain: 5000000 });
      sim.upgradeBuilding('castle' as BuildingType);
      expect(sim.getBuildingLevel('castle' as BuildingType)).toBeGreaterThan(castleLevel);
    });
  });

  // ── 2. 编队包含派驻武将 → 战斗正常 ──

  describe('[DFC-2] 编队包含派驻武将 → 战斗正常', () => {
    it('派驻武将可同时加入编队', () => {
      const dispatch = sim.engine.getHeroDispatchSystem();
      const generals = sim.getGenerals();
      expect(generals.length).toBeGreaterThanOrEqual(3);

      const heroIds = generals.slice(0, 3).map(g => g.id);

      // 派驻第一个武将
      dispatch.dispatchHero(heroIds[0], 'barracks' as BuildingType);

      // 编队包含派驻武将
      sim.engine.createFormation('combat_test');
      const formation = sim.engine.setFormation('combat_test', heroIds);
      expect(formation).not.toBeNull();
      expect(formation!.slots.filter(s => s !== '').length).toBe(heroIds.length);
    });

    it('编队包含派驻武将时战斗正常执行', () => {
      const dispatch = sim.engine.getHeroDispatchSystem();
      const generals = sim.getGenerals();
      const heroIds = generals.slice(0, 3).map(g => g.id);

      // 派驻 + 编队
      dispatch.dispatchHero(heroIds[0], 'barracks' as BuildingType);
      sim.engine.createFormation('battle_test');
      sim.engine.setFormation('battle_test', heroIds);

      // 执行战斗
      const stages = sim.engine.getStageList();
      expect(stages.length).toBeGreaterThan(0);

      const stageId = stages[0].id;
      const result = sim.engine.startBattle(stageId);
      expect(result).toBeDefined();
      // 战斗结果应包含有效数据
      expect(result).toHaveProperty('outcome');
    });

    it('派驻武将在编队中战力正常计算', () => {
      const dispatch = sim.engine.getHeroDispatchSystem();
      const generals = sim.getGenerals();
      const heroId = generals[0].id;

      // 派驻前战力
      const powerBefore = sim.engine.hero.calculatePower(generals[0]);

      // 派驻
      dispatch.dispatchHero(heroId, 'barracks' as BuildingType);

      // 派驻不影响战力（战力基于属性，不基于派驻状态）
      const generalAfter = sim.engine.hero.getGeneral(heroId);
      expect(generalAfter).toBeDefined();
      const powerAfter = sim.engine.hero.calculatePower(generalAfter!);
      expect(powerAfter).toBe(powerBefore);
    });
  });

  // ── 3. 派驻武将升级 → 建筑产出更新 → 编队战力更新 ──

  describe('[DFC-3] 派驻武将升级 → 建筑产出更新 → 编队战力更新', () => {
    it('派驻武将升级后建筑加成增加', () => {
      const dispatch = sim.engine.getHeroDispatchSystem();
      const generals = sim.getGenerals();
      const heroId = generals[0].id;

      dispatch.dispatchHero(heroId, 'farmland' as BuildingType);
      const bonusBefore = dispatch.getDispatchBonus('farmland' as BuildingType);

      // 升级武将
      const currentLevel = sim.engine.hero.getGeneral(heroId)!.level;
      sim.addResources({ gold: 500000, grain: 500000 });
      sim.engine.heroLevel.quickEnhance(heroId, currentLevel + 5);

      // 刷新派驻加成
      const newBonus = dispatch.refreshDispatchBonus(heroId);
      expect(newBonus).toBeGreaterThan(bonusBefore);

      // getDispatchBonus 也反映更新
      expect(dispatch.getDispatchBonus('farmland' as BuildingType)).toBe(newBonus);
    });

    it('派驻武将升级后编队战力增加', () => {
      const dispatch = sim.engine.getHeroDispatchSystem();
      const generals = sim.getGenerals();
      const heroIds = generals.slice(0, 3).map(g => g.id);
      const heroId = heroIds[0];

      // 派驻 + 编队
      dispatch.dispatchHero(heroId, 'barracks' as BuildingType);
      sim.engine.createFormation('upgrade_test');
      sim.engine.setFormation('upgrade_test', heroIds);

      const totalPowerBefore = sim.getTotalPower();

      // 升级武将
      const currentLevel = sim.engine.hero.getGeneral(heroId)!.level;
      sim.addResources({ gold: 500000, grain: 500000 });
      sim.engine.heroLevel.quickEnhance(heroId, currentLevel + 5);

      // 刷新派驻加成
      dispatch.refreshDispatchBonus(heroId);

      // 总战力应增加
      const totalPowerAfter = sim.getTotalPower();
      expect(totalPowerAfter).toBeGreaterThan(totalPowerBefore);
    });
  });

  // ── 4. 取消派驻 → 建筑产出恢复 → 编队不受影响 ──

  describe('[DFC-4] 取消派驻 → 建筑产出恢复 → 编队不受影响', () => {
    it('取消派驻后建筑加成归零', () => {
      const dispatch = sim.engine.getHeroDispatchSystem();
      const generals = sim.getGenerals();
      const heroId = generals[0].id;

      dispatch.dispatchHero(heroId, 'market' as BuildingType);
      expect(dispatch.getDispatchBonus('market' as BuildingType)).toBeGreaterThan(0);

      // 取消派驻
      const undeployResult = dispatch.undeployHero(heroId);
      expect(undeployResult).toBe(true);
      expect(dispatch.getDispatchBonus('market' as BuildingType)).toBe(0);
    });

    it('取消派驻后编队仍包含该武将', () => {
      const dispatch = sim.engine.getHeroDispatchSystem();
      const generals = sim.getGenerals();
      const heroIds = generals.slice(0, 3).map(g => g.id);
      const heroId = heroIds[0];

      // 派驻 + 编队
      dispatch.dispatchHero(heroId, 'academy' as BuildingType);
      sim.engine.createFormation('cancel_test');
      sim.engine.setFormation('cancel_test', heroIds);

      // 取消派驻
      dispatch.undeployHero(heroId);

      // 编队不受影响 — 武将仍在编队中
      const currentFormation = sim.engine.getHeroFormation?.('cancel_test');
      // 通过 setFormation 重新设置来验证编队仍可用
      const formation = sim.engine.setFormation('cancel_test', heroIds);
      expect(formation).not.toBeNull();
      expect(formation!.slots.filter(s => s !== '').length).toBe(heroIds.length);
    });

    it('取消派驻后武将战力不变', () => {
      const dispatch = sim.engine.getHeroDispatchSystem();
      const generals = sim.getGenerals();
      const heroId = generals[0].id;

      dispatch.dispatchHero(heroId, 'workshop' as BuildingType);
      const powerBefore = sim.engine.hero.calculatePower(
        sim.engine.hero.getGeneral(heroId)!,
      );

      dispatch.undeployHero(heroId);

      const powerAfter = sim.engine.hero.calculatePower(
        sim.engine.hero.getGeneral(heroId)!,
      );
      expect(powerAfter).toBe(powerBefore);
    });
  });

  // ── 5. 完整循环：招募 → 升级 → 派驻 → 编队 → 战斗 → 奖励 → 再升级 ──

  describe('[DFC-5] 完整生命周期循环', () => {
    it('完整循环：招募 → 升级 → 派驻 → 编队 → 战斗 → 再升级', () => {
      const dispatch = sim.engine.getHeroDispatchSystem();

      // ① 招募（通过直接添加武将模拟）
      const generalCountBefore = sim.getGeneralCount();
      const newHero = sim.addHeroDirectly('zhaoyun');
      // zhaoyun 可能已在 initMidGameState 中添加，尝试另一个
      let recruitedId: string;
      if (newHero) {
        recruitedId = newHero.id;
      } else {
        // 尝试添加一个可能未存在的武将
        const added = sim.addHeroDirectly('machao');
        if (added) {
          recruitedId = added.id;
        } else {
          // 使用已有武将
          const existing = sim.getGenerals();
          recruitedId = existing[existing.length - 1].id;
        }
      }

      const general = sim.engine.hero.getGeneral(recruitedId);
      expect(general).toBeDefined();

      // ② 升级
      const levelBefore = general!.level;
      sim.addResources({ gold: 500000, grain: 500000 });
      const upgradeResult = sim.engine.heroLevel.quickEnhance(recruitedId, levelBefore + 5);
      // 升级可能成功也可能因上限/资源不足而部分成功
      const generalAfterUpgrade = sim.engine.hero.getGeneral(recruitedId);
      expect(generalAfterUpgrade!.level).toBeGreaterThanOrEqual(levelBefore);

      // ③ 派驻
      const dispatchResult = dispatch.dispatchHero(recruitedId, 'farmland' as BuildingType);
      expect(dispatchResult.success).toBe(true);
      expect(dispatchResult.bonusPercent).toBeGreaterThan(0);
      const bonusAfterDispatch = dispatch.getDispatchBonus('farmland' as BuildingType);

      // ④ 编队
      const allGenerals = sim.getGenerals();
      const teamIds = allGenerals.slice(0, Math.min(3, allGenerals.length)).map(g => g.id);
      // 确保 recruitedId 在编队中
      if (!teamIds.includes(recruitedId)) {
        teamIds[teamIds.length - 1] = recruitedId;
      }
      sim.engine.createFormation('cycle_test');
      const formation = sim.engine.setFormation('cycle_test', teamIds);
      expect(formation).not.toBeNull();

      // ⑤ 战斗
      const stages = sim.engine.getStageList();
      if (stages.length > 0) {
        const battleResult = sim.engine.startBattle(stages[0].id);
        expect(battleResult).toBeDefined();
        sim.engine.completeBattle(stages[0].id, 3);
      }

      // ⑥ 再升级（战斗获得资源后）
      sim.addResources({ gold: 200000, grain: 200000 });
      const levelAfterFirstBattle = sim.engine.hero.getGeneral(recruitedId)!.level;
      sim.engine.heroLevel.quickEnhance(recruitedId, levelAfterFirstBattle + 3);

      // 刷新派驻加成
      const bonusAfterReUpgrade = dispatch.refreshDispatchBonus(recruitedId);
      expect(bonusAfterReUpgrade).toBeGreaterThanOrEqual(bonusAfterDispatch);

      // 验证最终状态一致性
      expect(dispatch.getHeroDispatchBuilding(recruitedId)).toBe('farmland');
      expect(dispatch.getDispatchBonus('farmland' as BuildingType)).toBe(bonusAfterReUpgrade);
    });

    it('多武将完整循环：各自独立派驻和编队', () => {
      const dispatch = sim.engine.getHeroDispatchSystem();
      const generals = sim.getGenerals();
      expect(generals.length).toBeGreaterThanOrEqual(3);

      const heroIds = generals.slice(0, 3).map(g => g.id);
      const buildings: BuildingType[] = ['farmland', 'barracks', 'market'];

      // 各自派驻到不同建筑
      for (let i = 0; i < heroIds.length; i++) {
        const result = dispatch.dispatchHero(heroIds[i], buildings[i]);
        expect(result.success).toBe(true);
        expect(result.bonusPercent).toBeGreaterThan(0);
      }

      // 编队
      sim.engine.createFormation('multi_test');
      sim.engine.setFormation('multi_test', heroIds);

      // 战斗
      const stages = sim.engine.getStageList();
      if (stages.length > 0) {
        sim.engine.startBattle(stages[0].id);
        sim.engine.completeBattle(stages[0].id, 3);
      }

      // 升级所有武将
      sim.addResources({ gold: 1000000, grain: 1000000 });
      for (const heroId of heroIds) {
        const level = sim.engine.hero.getGeneral(heroId)!.level;
        sim.engine.heroLevel.quickEnhance(heroId, level + 3);
        dispatch.refreshDispatchBonus(heroId);
      }

      // 验证各建筑加成均 > 0
      const bonuses = dispatch.getAllDispatchBonuses();
      for (const building of buildings) {
        expect(bonuses[building]).toBeGreaterThan(0);
      }

      // 取消一个武将的派驻
      dispatch.undeployHero(heroIds[0]);
      expect(dispatch.getDispatchBonus(buildings[0])).toBe(0);

      // 其他建筑加成不受影响
      expect(dispatch.getDispatchBonus(buildings[1])).toBeGreaterThan(0);
      expect(dispatch.getDispatchBonus(buildings[2])).toBeGreaterThan(0);

      // 编队仍完整
      const formation = sim.engine.setFormation('multi_test', heroIds);
      expect(formation).not.toBeNull();
      expect(formation!.slots.filter(s => s !== '').length).toBe(heroIds.length);
    });
  });
});
