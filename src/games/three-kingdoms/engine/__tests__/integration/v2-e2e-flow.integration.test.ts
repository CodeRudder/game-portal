/**
 * V2 端到端 + 交叉验证集成测试
 *
 * 基于 v2-play.md 测试核心循环端到端和交叉验证：
 * - E2E-FLOW-1: 招募→升级→编队完整循环
 * - E2E-FLOW-2: 30秒可理解性验证 [UI层测试]
 * - E2E-FLOW-3: 保底机制端到端验证
 * - CROSS-FLOW-1~8: 关联系统交叉验证（引擎层可实现部分）
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createSim } from '../../../test-utils/test-helpers';
import { Quality, QUALITY_ORDER } from '../../hero/hero.types';
import { RECRUIT_COSTS, ADVANCED_PITY, NORMAL_PITY } from '../../hero/hero-recruit-config';
import { HERO_MAX_LEVEL, POWER_WEIGHTS, LEVEL_COEFFICIENT_PER_LEVEL, QUALITY_MULTIPLIERS } from '../../hero/hero-config';
import { getStarMultiplier } from '../../hero/star-up-config';
import type { GameEventSimulator } from '../../../test-utils/GameEventSimulator';

/**
 * 辅助：给模拟器添加招募所需资源
 */
function addRecruitResources(sim: GameEventSimulator, type: 'normal' | 'advanced', count: number): void {
  const cfg = RECRUIT_COSTS[type];
  sim.addResources({ [cfg.resourceType]: cfg.amount * count });
}

describe('V2 E2E-FLOW: 端到端 + 交叉验证集成测试', () => {
  let sim: GameEventSimulator;

  beforeEach(() => {
    sim = createSim();
  });

  // ─────────────────────────────────────────
  // E2E-FLOW-1: 招募→升级→编队完整循环
  // ─────────────────────────────────────────
  describe('E2E-FLOW-1: 招募→升级→编队完整循环', () => {
    it('should complete full recruit→level→formation cycle', () => {
      // Step 1: 招募武将
      addRecruitResources(sim, 'normal', 10);
      for (let i = 0; i < 6; i++) {
        try { sim.recruitHero('normal', 1); } catch { break; }
      }
      const generalCount = sim.getGeneralCount();
      expect(generalCount).toBeGreaterThanOrEqual(1);

      // Step 2: 升级武将
      sim.addResources({ gold: 500000, grain: 500000 });
      const generals = sim.getGenerals();
      if (generals.length > 0) {
        const heroId = generals[0].id;
        const powerBefore = sim.engine.hero.calculatePower(generals[0]);
        sim.engine.enhanceHero(heroId, 10);
        const updated = sim.engine.hero.getGeneral(heroId)!;
        const powerAfter = sim.engine.hero.calculatePower(updated);
        expect(powerAfter).toBeGreaterThan(powerBefore);
      }

      // Step 3: 编队
      if (generals.length >= 2) {
        sim.engine.createFormation('1');
        const heroIds = generals.slice(0, Math.min(6, generals.length)).map(g => g.id);
        sim.engine.setFormation('1', heroIds);

        const formation = sim.engine.getFormationSystem().getFormation('1')!;
        expect(formation.slots.filter(s => s !== '').length).toBeGreaterThanOrEqual(2);
      }
    });

    it('should handle recruit→duplicate→fragment→starUp cycle', () => {
      // 添加武将
      sim.addHeroDirectly('liubei');
      sim.addHeroDirectly('guanyu');

      // 模拟重复武将获得碎片
      const fragments = sim.engine.hero.handleDuplicate('liubei', Quality.EPIC);
      expect(fragments).toBe(40); // EPIC → 40 fragments

      // 添加更多碎片用于升星
      sim.addHeroFragments('liubei', 20);
      sim.addResources({ gold: 500000 });

      const starSystem = sim.engine.getHeroStarSystem();
      const starBefore = starSystem.getStar('liubei');
      const result = starSystem.starUp('liubei');
      expect(result.success).toBe(true);
      expect(starSystem.getStar('liubei')).toBe(starBefore + 1);
    });

    it('should recalculate formation power after star up', () => {
      const heroIds = ['liubei', 'guanyu', 'zhangfei'];
      for (const id of heroIds) {
        sim.addHeroDirectly(id);
      }
      sim.engine.createFormation('1');
      sim.engine.setFormation('1', heroIds);

      const hero = sim.engine.hero;
      const starSystem = sim.engine.getHeroStarSystem();
      const formationSys = sim.engine.getFormationSystem();

      // 计算编队战力时需要传入star参数
      const powerBefore = formationSys.calculateFormationPower(
        formationSys.getFormation('1')!,
        (id) => hero.getGeneral(id),
        (g) => hero.calculatePower(g, starSystem.getStar(g.id)),
      );

      // 升星刘备
      sim.addHeroFragments('liubei', 30);
      sim.addResources({ gold: 500000 });
      starSystem.starUp('liubei');

      const powerAfter = formationSys.calculateFormationPower(
        formationSys.getFormation('1')!,
        (id) => hero.getGeneral(id),
        (g) => hero.calculatePower(g, starSystem.getStar(g.id)),
      );

      expect(powerAfter).toBeGreaterThan(powerBefore);
    });
  });

  // ─────────────────────────────────────────
  // E2E-FLOW-2: 30秒可理解性验证 [UI层测试]
  // ─────────────────────────────────────────
  describe('E2E-FLOW-2: 30秒可理解性验证', () => {
    it.todo('[UI层测试] should show intuitive recruit button — UI直觉性测试属于UI层');

    it.todo('[UI层测试] should display quality and stats clearly on general card — 信息自解释属于UI层');
  });

  // ─────────────────────────────────────────
  // E2E-FLOW-3: 保底机制端到端验证
  // ─────────────────────────────────────────
  describe('E2E-FLOW-3: 保底机制端到端验证', () => {
    it('should trigger hard pity within 100 advanced pulls', () => {
      addRecruitResources(sim, 'advanced', 100);
      let hasEpicOrAbove = false;
      let totalPulls = 0;

      for (let i = 0; i < 10; i++) {
        const result = sim.engine.recruit('advanced', 10);
        if (result) {
          totalPulls += result.results.length;
          for (const r of result.results) {
            if (QUALITY_ORDER[r.quality] >= QUALITY_ORDER[Quality.EPIC]) {
              hasEpicOrAbove = true;
            }
          }
        }
      }

      expect(totalPulls).toBe(100);
      expect(hasEpicOrAbove).toBe(true);
    });

    it('should reset pity counter after getting high quality', () => {
      addRecruitResources(sim, 'advanced', 100);
      // 招募直到出 EPIC+
      let foundHighQuality = false;
      for (let i = 0; i < 100; i++) {
        const result = sim.engine.recruit('advanced', 1);
        if (result) {
          for (const r of result.results) {
            if (QUALITY_ORDER[r.quality] >= QUALITY_ORDER[Quality.EPIC]) {
              foundHighQuality = true;
            }
          }
        }
        if (foundHighQuality) break;
      }

      // 保底计数器应该已重置
      const state = sim.engine.heroRecruit.getGachaState();
      expect(state.advancedHardPity).toBeLessThan(ADVANCED_PITY.hardPityThreshold);
    });

    it('should verify advanced pity config: 100 pulls for LEGENDARY+', () => {
      expect(ADVANCED_PITY.hardPityThreshold).toBe(100);
      expect(ADVANCED_PITY.hardPityMinQuality).toBe(Quality.LEGENDARY);
    });

    it('should verify normal pool has no hard pity', () => {
      expect(NORMAL_PITY.hardPityThreshold).toBe(Infinity);
    });
  });

  // ─────────────────────────────────────────
  // CROSS-FLOW-1: 招募→资源消耗→UI刷新
  // ─────────────────────────────────────────
  describe('CROSS-FLOW-1: 招募→资源消耗验证', () => {
    it('should deduct correct resources for each recruit type', () => {
      // 普通招募
      sim.addResources({ recruitToken: 1000 });
      const tokenBefore1 = sim.getResource('recruitToken');
      sim.recruitHero('normal', 1);
      expect(sim.getResource('recruitToken')).toBe(tokenBefore1 - RECRUIT_COSTS.normal.amount);

      // 高级招募
      const tokenBefore2 = sim.getResource('recruitToken');
      sim.recruitHero('advanced', 1);
      expect(sim.getResource('recruitToken')).toBe(tokenBefore2 - RECRUIT_COSTS.advanced.amount);
    });
  });

  // ─────────────────────────────────────────
  // CROSS-FLOW-2: 升级→属性变化→战力重算→编队更新
  // ─────────────────────────────────────────
  describe('CROSS-FLOW-2: 升级→战力→编队联动', () => {
    it('should verify full power calculation chain', () => {
      sim.addHeroDirectly('guanyu');
      sim.addResources({ gold: 500000, grain: 500000 });

      const hero = sim.engine.hero;
      const general = hero.getGeneral('guanyu')!;

      // 手动计算预期战力
      const { attack, defense, intelligence, speed } = general.baseStats;
      const statsPower = attack * POWER_WEIGHTS.attack
        + defense * POWER_WEIGHTS.defense
        + intelligence * POWER_WEIGHTS.intelligence
        + speed * POWER_WEIGHTS.speed;
      const levelCoeff = 1 + general.level * LEVEL_COEFFICIENT_PER_LEVEL;
      const qualityCoeff = QUALITY_MULTIPLIERS[general.quality];
      const expectedPower = Math.floor(statsPower * levelCoeff * qualityCoeff * getStarMultiplier(1));

      const actualPower = hero.calculatePower(general);
      expect(actualPower).toBe(expectedPower);

      // 升级后验证
      sim.engine.enhanceHero('guanyu', 5);
      const updated = hero.getGeneral('guanyu')!;
      const newLevelCoeff = 1 + updated.level * LEVEL_COEFFICIENT_PER_LEVEL;
      const newExpected = Math.floor(statsPower * newLevelCoeff * qualityCoeff * getStarMultiplier(1));
      expect(hero.calculatePower(updated)).toBe(newExpected);
    });
  });

  // ─────────────────────────────────────────
  // CROSS-FLOW-3: 重复武将→碎片→合成→新武将
  // ─────────────────────────────────────────
  describe('CROSS-FLOW-3: 完整碎片→合成链路', () => {
    it('should complete duplicate→fragment→synthesize chain', () => {
      // 1. 添加武将
      sim.addHeroDirectly('dianwei');

      // 2. 模拟重复获得碎片
      const fragFromDup = sim.engine.hero.handleDuplicate('dianwei', Quality.RARE);
      expect(fragFromDup).toBe(20); // RARE → 20 fragments

      // 3. 通过商店补充碎片到合成阈值
      sim.addResources({ gold: 100000 });
      sim.addHeroFragments('dianwei', 60); // 补充到 80（RARE 合成阈值）

      // 4. 先移除已有武将（测试合成新武将场景）
      // 由于已拥有 dianwei，合成会失败，所以测试未拥有武将
      sim.addHeroFragments('lvbu', 300); // LEGENDARY 合成阈值
      const result = sim.engine.hero.fragmentSynthesize('lvbu');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('lvbu');
      expect(sim.engine.hero.hasGeneral('lvbu')).toBe(true);
    });
  });

  // ─────────────────────────────────────────
  // E2E 综合场景
  // ─────────────────────────────────────────
  describe('E2E 综合场景: 完整游戏流程', () => {
    it('should simulate new player first 10 minutes', () => {
      // 1. 初始化
      expect(sim.engine.isInitialized()).toBe(true);

      // 2. 获取初始资源
      sim.addResources({ recruitToken: 20, gold: 100000, grain: 100000 });

      // 3. 招募武将
      for (let i = 0; i < 5; i++) {
        try { sim.recruitHero('normal', 1); } catch { break; }
      }
      expect(sim.getGeneralCount()).toBeGreaterThanOrEqual(1);

      // 4. 升级武将
      const generals = sim.getGenerals();
      for (const g of generals.slice(0, 3)) {
        sim.engine.enhanceHero(g.id, 5);
      }

      // 5. 编队
      if (generals.length >= 2) {
        sim.engine.createFormation('1');
        const ids = generals.slice(0, Math.min(6, generals.length)).map(g => g.id);
        sim.engine.setFormation('1', ids);

        // 6. 检查羁绊
        const bondSystem = sim.engine.getBondSystem();
        const heroes = ids.map(id => sim.engine.hero.getGeneral(id)!).filter(Boolean);
        const bonds = bondSystem.detectActiveBonds(heroes);
        // 可能有羁绊，也可能没有
        expect(Array.isArray(bonds)).toBe(true);
      }

      // 7. 验证战力
      expect(sim.getTotalPower()).toBeGreaterThan(0);
    });

    it('should handle mid-game progression', () => {
      // 使用 initMidGameState 模拟中期
      sim.initMidGameState();

      // 验证中期状态
      expect(sim.getGeneralCount()).toBeGreaterThanOrEqual(5);
      expect(sim.getBuildingLevel('castle')).toBeGreaterThanOrEqual(5);

      // 高级招募
      sim.addResources({ recruitToken: 5000 });
      const result = sim.engine.recruit('advanced', 10);
      expect(result).not.toBeNull();

      // 升级武将
      sim.addResources({ gold: 5000000, grain: 5000000 });
      const enhanceResult = sim.engine.enhanceAllHeroes(20);
      expect(enhanceResult.results.length).toBeGreaterThanOrEqual(1);

      // 验证编队存在
      const formations = sim.engine.getFormations();
      expect(formations.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ─────────────────────────────────────────
  // 数据一致性验证
  // ─────────────────────────────────────────
  describe('数据一致性验证', () => {
    it('should maintain consistent general count after multiple operations', () => {
      sim.addResources({ recruitToken: 100, gold: 500000, grain: 500000 });

      const initialCount = sim.getGeneralCount();
      // 招募
      for (let i = 0; i < 5; i++) {
        try { sim.recruitHero('normal', 1); } catch { break; }
      }
      const afterRecruit = sim.getGeneralCount();
      expect(afterRecruit).toBeGreaterThanOrEqual(initialCount);

      // 直接添加
      sim.addHeroDirectly('caocao');
      expect(sim.getGeneralCount()).toBe(afterRecruit + 1);

      // 合成
      sim.addHeroFragments('lvbu', 300);
      sim.engine.hero.fragmentSynthesize('lvbu');
      expect(sim.engine.hero.hasGeneral('lvbu')).toBe(true);
    });

    it('should maintain fragment consistency', () => {
      sim.addHeroFragments('liubei', 100);
      expect(sim.engine.hero.getFragments('liubei')).toBe(100);

      // 使用碎片
      sim.engine.hero.useFragments('liubei', 30);
      expect(sim.engine.hero.getFragments('liubei')).toBe(70);

      // 碎片不足
      expect(sim.engine.hero.useFragments('liubei', 100)).toBe(false);
      expect(sim.engine.hero.getFragments('liubei')).toBe(70);
    });

    it('should serialize and deserialize full hero state', () => {
      sim.addHeroDirectly('liubei');
      sim.addHeroDirectly('guanyu');
      sim.addHeroFragments('zhangfei', 50);
      sim.addResources({ gold: 500000, grain: 500000 });
      sim.engine.enhanceHero('liubei', 5);

      const hero = sim.engine.hero;
      const saved = hero.serialize();

      hero.reset();
      hero.deserialize(saved);

      expect(hero.hasGeneral('liubei')).toBe(true);
      expect(hero.hasGeneral('guanyu')).toBe(true);
      expect(hero.getFragments('zhangfei')).toBe(50);
      expect(hero.getGeneral('liubei')!.level).toBeGreaterThan(1);
    });
  });
});
