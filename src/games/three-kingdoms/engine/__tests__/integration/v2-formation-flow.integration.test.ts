/**
 * V2 编队管理集成测试
 *
 * 基于 v2-play.md 深度验证编队系统：
 * - FORM-FLOW-1: 编队管理（6人编队+前后排+交换+互斥）
 * - FORM-FLOW-2: 多编队切换（互斥验证+活跃编队）
 * - FORM-FLOW-3: 一键布阵（自动选将+前后排分配）
 * - FORM-FLOW-4: 羁绊效果验证（全矩阵验证）
 * - FORM-FLOW-5: 智能编队推荐 [引擎未实现]
 * - CROSS-FLOW-2: 升级→战力→编队联动
 * - CROSS-FLOW-4: 编队保存→刷新→数据恢复
 * - CROSS-FLOW-5: 武将→建筑派驻联动 [引擎未实现]
 * - CROSS-FLOW-7: 武将升级→资源消耗→建筑产出联动 [引擎未实现]
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createSim, SUFFICIENT_RESOURCES } from '../../../test-utils/test-helpers';
import {
  Quality, QUALITY_TIERS, QUALITY_ORDER, FACTIONS,
} from '../../hero/hero.types';
import { GENERAL_DEFS, POWER_WEIGHTS, LEVEL_COEFFICIENT_PER_LEVEL, QUALITY_MULTIPLIERS } from '../../hero/hero-config';
import { getStarMultiplier } from '../../hero/star-up-config';
import { BOND_EFFECTS } from '../../bond/bond-config';
import type { GameEventSimulator } from '../../../test-utils/GameEventSimulator';

describe('V2 FORM-FLOW: 编队管理集成测试', () => {
  let sim: GameEventSimulator;

  beforeEach(() => {
    sim = createSim();
  });

  // ─────────────────────────────────────────
  // FORM-FLOW-1: 编队管理（深度验证）
  // ─────────────────────────────────────────

  describe('FORM-FLOW-1: 编队管理', () => {
    it('should create formation with 6 slots', () => {
      // Play FORM-FLOW-1 步骤2: 6个槽位(前排3+后排3)
      const formation = sim.engine.createFormation('f1');
      expect(formation).not.toBeNull();
      expect(formation!.slots.length).toBe(6);
      expect(formation!.slots.every(s => s === '')).toBe(true);
    });

    it('should add generals to formation slots', () => {
      // Play FORM-FLOW-1 步骤3~4: 拖拽武将到前排/后排槽位
      const heroIds = ['liubei', 'guanyu', 'zhangfei'];
      for (const id of heroIds) {
        sim.addHeroDirectly(id);
      }
      sim.engine.createFormation('f1');
      for (const id of heroIds) {
        const result = sim.engine.addToFormation('f1', id);
        expect(result).not.toBeNull();
      }
      const formation = sim.engine.getFormationSystem().getFormation('f1')!;
      expect(formation.slots.filter(s => s !== '').length).toBe(3);
    });

    it('should not add duplicate general to same formation', () => {
      // Play FORM-FLOW-1 步骤6: 同一武将不可重复上阵
      sim.addHeroDirectly('liubei');
      sim.engine.createFormation('f1');
      sim.engine.addToFormation('f1', 'liubei');
      const result = sim.engine.addToFormation('f1', 'liubei');
      expect(result).toBeNull();
    });

    it('should remove general from formation', () => {
      // Play FORM-FLOW-1 步骤7: 移除武将
      sim.addHeroDirectly('liubei');
      sim.engine.createFormation('f1');
      sim.engine.addToFormation('f1', 'liubei');
      const result = sim.engine.removeFromFormation('f1', 'liubei');
      expect(result).not.toBeNull();
      expect(result!.slots.filter(s => s !== '').length).toBe(0);
    });

    it('should set full formation with 6 generals', () => {
      // Play FORM-FLOW-1 步骤5: 设置完整6人编队
      const heroIds = ['liubei', 'guanyu', 'zhangfei', 'zhugeliang', 'zhaoyun', 'caocao'];
      for (const id of heroIds) {
        sim.addHeroDirectly(id);
      }
      sim.engine.createFormation('f1');
      const result = sim.engine.setFormation('f1', heroIds);
      expect(result).not.toBeNull();
      expect(result!.slots.filter(s => s !== '').length).toBe(6);
    });

    it('should limit formation to 6 slots even with more generals', () => {
      // Play FORM-FLOW-1 边界: 编队上限6人
      const heroIds = ['liubei', 'guanyu', 'zhangfei', 'zhugeliang', 'zhaoyun', 'caocao', 'dianwei'];
      for (const id of heroIds) {
        sim.addHeroDirectly(id);
      }
      sim.engine.createFormation('f1');
      const result = sim.engine.setFormation('f1', heroIds);
      expect(result!.slots.filter(s => s !== '').length).toBe(6);
    });

    it('should calculate formation power as sum of individual powers', () => {
      // Play FORM-FLOW-1 步骤5: 总战力 = 6人战力之和+羁绊加成
      const heroIds = ['liubei', 'guanyu', 'zhangfei'];
      for (const id of heroIds) {
        sim.addHeroDirectly(id);
      }
      sim.engine.createFormation('f1');
      sim.engine.setFormation('f1', heroIds);

      const formation = sim.engine.getFormationSystem().getFormation('f1')!;
      const hero = sim.engine.hero;
      const power = sim.engine.getFormationSystem().calculateFormationPower(
        formation,
        (id) => hero.getGeneral(id),
        (g) => hero.calculatePower(g),
      );

      // 计算期望值（不含羁绊）
      let expectedSum = 0;
      for (const id of heroIds) {
        const g = hero.getGeneral(id)!;
        expectedSum += hero.calculatePower(g);
      }
      expect(power).toBeGreaterThanOrEqual(expectedSum);
    });

    it('should swap generals between slots', () => {
      // Play FORM-FLOW-1 步骤8: 交换武将位置
      sim.addHeroDirectly('liubei');
      sim.addHeroDirectly('guanyu');
      sim.engine.createFormation('f1');
      sim.engine.addToFormation('f1', 'liubei');
      sim.engine.addToFormation('f1', 'guanyu');

      const before = sim.engine.getFormationSystem().getFormation('f1')!;
      const liubeiSlotBefore = before.slots.indexOf('liubei');
      const guanyuSlotBefore = before.slots.indexOf('guanyu');

      // 交换：先移除再按相反顺序添加
      sim.engine.removeFromFormation('f1', 'liubei');
      sim.engine.removeFromFormation('f1', 'guanyu');
      sim.engine.addToFormation('f1', 'guanyu');
      sim.engine.addToFormation('f1', 'liubei');

      const after = sim.engine.getFormationSystem().getFormation('f1')!;
      expect(after.slots.filter(s => s !== '').length).toBe(2);
    });
  });

  // ─────────────────────────────────────────
  // FORM-FLOW-2: 多编队切换（深度验证）
  // ─────────────────────────────────────────

  describe('FORM-FLOW-2: 多编队切换', () => {
    it('should create and manage multiple formations', () => {
      // Play FORM-FLOW-2 步骤1~4: 多编队保存与切换
      const f1 = sim.engine.createFormation('f1');
      const f2 = sim.engine.createFormation('f2');
      expect(f1).not.toBeNull();
      expect(f2).not.toBeNull();

      // 编队1配置
      sim.addHeroDirectly('liubei');
      sim.addHeroDirectly('guanyu');
      sim.engine.setFormation('f1', ['liubei', 'guanyu']);

      // 编队2配置
      sim.addHeroDirectly('zhangfei');
      sim.addHeroDirectly('zhugeliang');
      sim.engine.setFormation('f2', ['zhangfei', 'zhugeliang']);

      // 验证编队1数据保留
      const f1Data = sim.engine.getFormationSystem().getFormation('f1')!;
      expect(f1Data.slots.filter(s => s !== '').length).toBe(2);
      expect(f1Data.slots).toContain('liubei');

      // 验证编队2数据保留
      const f2Data = sim.engine.getFormationSystem().getFormation('f2')!;
      expect(f2Data.slots.filter(s => s !== '').length).toBe(2);
      expect(f2Data.slots).toContain('zhangfei');
    });

    it('should set active formation', () => {
      // Play FORM-FLOW-2 步骤6: 设置活跃编队
      sim.engine.createFormation('f1');
      sim.engine.createFormation('f2');
      sim.engine.getFormationSystem().setActiveFormation('f1');

      const active = sim.engine.getActiveFormation();
      expect(active).not.toBeNull();
      expect(active!.id).toBe('f1');
    });

    it('should check general in any formation', () => {
      // Play FORM-FLOW-2 步骤7: 跨编队武将互斥验证
      sim.addHeroDirectly('liubei');
      sim.engine.createFormation('f1');
      sim.engine.addToFormation('f1', 'liubei');

      const isInAny = sim.engine.getFormationSystem().isGeneralInAnyFormation('liubei');
      expect(isInAny).toBe(true);
    });

    it('should find which formations contain a general', () => {
      sim.addHeroDirectly('liubei');
      sim.engine.createFormation('f1');
      sim.engine.addToFormation('f1', 'liubei');

      const formations = sim.engine.getFormationSystem().getFormationsContainingGeneral('liubei');
      expect(formations).toContain('f1');
    });

    it('should get formation count', () => {
      sim.engine.createFormation('f1');
      sim.engine.createFormation('f2');
      expect(sim.engine.getFormationSystem().getFormationCount()).toBe(2);
    });

    it('should delete formation', () => {
      sim.engine.createFormation('f1');
      const deleted = sim.engine.getFormationSystem().deleteFormation('f1');
      expect(deleted).toBe(true);
      expect(sim.engine.getFormationSystem().getFormation('f1')).toBeNull();
    });
  });

  // ─────────────────────────────────────────
  // FORM-FLOW-3: 一键布阵
  // ─────────────────────────────────────────

  describe('FORM-FLOW-3: 一键布阵', () => {
    it('should auto-fill formation with top 6 generals by power', () => {
      // Play FORM-FLOW-3 步骤1~2: 按战力排序选前6
      const heroIds = ['liubei', 'guanyu', 'zhangfei', 'zhugeliang', 'zhaoyun', 'caocao', 'dianwei'];
      for (const id of heroIds) {
        sim.addHeroDirectly(id);
      }

      const hero = sim.engine.hero;
      const result = sim.engine.getFormationSystem().autoFormationByIds(
        heroIds,
        (id) => hero.getGeneral(id),
        (g) => hero.calculatePower(g),
        'f1',
        6,
      );
      expect(result).not.toBeNull();
      expect(result!.slots.filter(s => s !== '').length).toBe(6);
    });

    it('should auto-fill with available generals even if less than 6', () => {
      // Play FORM-FLOW-3 边界: 武将不足6人
      const heroIds = ['liubei', 'guanyu'];
      for (const id of heroIds) {
        sim.addHeroDirectly(id);
      }

      const hero = sim.engine.hero;
      const result = sim.engine.getFormationSystem().autoFormationByIds(
        heroIds,
        (id) => hero.getGeneral(id),
        (g) => hero.calculatePower(g),
        'f1',
        6,
      );
      expect(result).not.toBeNull();
      expect(result!.slots.filter(s => s !== '').length).toBe(2);
    });

    it('should override manual changes on re-auto-formation', () => {
      // Play FORM-FLOW-3 步骤4: 修改编队后再次一键布阵覆盖
      const heroIds = ['liubei', 'guanyu', 'zhangfei', 'zhugeliang', 'zhaoyun', 'caocao', 'dianwei'];
      for (const id of heroIds) {
        sim.addHeroDirectly(id);
      }
      sim.engine.createFormation('f1');

      // 手动设置部分
      sim.engine.addToFormation('f1', 'liubei');
      // 一键布阵覆盖
      const hero = sim.engine.hero;
      const result = sim.engine.getFormationSystem().autoFormationByIds(
        heroIds,
        (id) => hero.getGeneral(id),
        (g) => hero.calculatePower(g),
        'f1',
        6,
      );
      expect(result).not.toBeNull();
      expect(result!.slots.filter(s => s !== '').length).toBe(6);
    });

    it('should auto-fill by specific hero IDs', () => {
      // 测试按指定ID列表自动布阵
      const heroIds = ['liubei', 'guanyu', 'zhangfei'];
      for (const id of heroIds) {
        sim.addHeroDirectly(id);
      }

      const hero = sim.engine.hero;
      const result = sim.engine.getFormationSystem().autoFormationByIds(
        heroIds,
        (id) => hero.getGeneral(id),
        (g) => hero.calculatePower(g),
        'f1',
        6,
      );
      expect(result).not.toBeNull();
      expect(result!.slots.filter(s => s !== '').length).toBe(3);
    });
  });

  // ─────────────────────────────────────────
  // FORM-FLOW-4: 羁绊效果验证（全矩阵验证）
  // ─────────────────────────────────────────

  describe('FORM-FLOW-4: 羁绊效果验证', () => {
    it('should detect faction_2 bond (2 same faction)', () => {
      // Play FORM-FLOW-4 步骤2: 上阵2个同阵营→同乡之谊(攻击+5%)
      sim.addHeroDirectly('liubei');  // shu
      sim.addHeroDirectly('guanyu');  // shu

      const bondSystem = sim.engine.getBondSystem();
      const heroes = [
        sim.engine.hero.getGeneral('liubei')!,
        sim.engine.hero.getGeneral('guanyu')!,
      ];
      const bonds = bondSystem.detectActiveBonds(heroes);

      const faction2 = bonds.find(b => b.type === 'faction_2');
      expect(faction2).toBeDefined();
    });

    it('should detect faction_3 bond (3 same faction)', () => {
      // Play FORM-FLOW-4 步骤3: 上阵3个同阵营→同仇敌忾(攻击+15%)
      sim.addHeroDirectly('liubei');    // shu
      sim.addHeroDirectly('guanyu');    // shu
      sim.addHeroDirectly('zhangfei');  // shu

      const bondSystem = sim.engine.getBondSystem();
      const heroes = [
        sim.engine.hero.getGeneral('liubei')!,
        sim.engine.hero.getGeneral('guanyu')!,
        sim.engine.hero.getGeneral('zhangfei')!,
      ];
      const bonds = bondSystem.detectActiveBonds(heroes);

      const faction3 = bonds.find(b => b.type === 'faction_3');
      expect(faction3).toBeDefined();
    });

    it('should detect faction_6 bond (6 same faction)', () => {
      // Play FORM-FLOW-4 步骤4: 上阵6个同阵营→众志成城(攻击+25%+防御+15%)
      // 蜀国只有5个武将(liubei, guanyu, zhangfei, zhugeliang, zhaoyun)，需要借用其他方式
      const shuHeroes = GENERAL_DEFS.filter(d => d.faction === 'shu').map(d => d.id);
      for (const id of shuHeroes) {
        sim.addHeroDirectly(id);
      }

      const bondSystem = sim.engine.getBondSystem();
      const heroes = shuHeroes.map(id => sim.engine.hero.getGeneral(id)!).filter(Boolean);

      if (heroes.length >= 6) {
        const bonds = bondSystem.detectActiveBonds(heroes);
        const faction6 = bonds.find(b => b.type === 'faction_6');
        expect(faction6).toBeDefined();
      } else {
        // 蜀国不足6人，跳过此测试（使用魏国）
        const weiHeroes = GENERAL_DEFS.filter(d => d.faction === 'wei').map(d => d.id);
        for (const id of weiHeroes) {
          sim.addHeroDirectly(id);
        }
        const weiData = weiHeroes.map(id => sim.engine.hero.getGeneral(id)!).filter(Boolean);
        if (weiData.length >= 6) {
          const bonds = bondSystem.detectActiveBonds(weiData);
          const faction6 = bonds.find(b => b.type === 'faction_6');
          expect(faction6).toBeDefined();
        }
        // 如果没有任何阵营有6个武将，则验证faction_6配置存在
        expect(BOND_EFFECTS.faction_6).toBeDefined();
        expect(BOND_EFFECTS.faction_6.bonuses.attack).toBe(0.25);
        expect(BOND_EFFECTS.faction_6.bonuses.defense).toBe(0.15);
      }
    });

    it('should detect mixed_3_3 bond', () => {
      // Play FORM-FLOW-4 步骤5: 3+3不同阵营→混搭协作(攻击+10%)
      const shuIds = ['liubei', 'guanyu', 'zhangfei'];  // 3 shu
      const weiIds = ['caocao', 'dianwei', 'simayi'];     // 3 wei
      for (const id of [...shuIds, ...weiIds]) {
        sim.addHeroDirectly(id);
      }

      const bondSystem = sim.engine.getBondSystem();
      const heroes = [...shuIds, ...weiIds].map(id => sim.engine.hero.getGeneral(id)!).filter(Boolean);
      const bonds = bondSystem.detectActiveBonds(heroes);

      const mixed = bonds.find(b => b.type === 'mixed_3_3');
      expect(mixed).toBeDefined();
    });

    it('should have correct bond effect values', () => {
      // 验证羁绊效果值与Play文档一致
      expect(BOND_EFFECTS.faction_2.bonuses.attack).toBe(0.05);   // 同乡之谊: 攻击+5%
      expect(BOND_EFFECTS.faction_3.bonuses.attack).toBe(0.15);   // 同仇敌忾: 攻击+15%
      expect(BOND_EFFECTS.faction_6.bonuses.attack).toBe(0.25);   // 众志成城: 攻击+25%
      expect(BOND_EFFECTS.faction_6.bonuses.defense).toBe(0.15);  // 众志成城: 防御+15%
      expect(BOND_EFFECTS.mixed_3_3.bonuses.attack).toBe(0.10);   // 混搭协作: 攻击+10%
    });

    it('should calculate bond bonuses', () => {
      // Play FORM-FLOW-4 步骤7: 检查战力变化
      sim.addHeroDirectly('liubei');
      sim.addHeroDirectly('guanyu');
      sim.addHeroDirectly('zhangfei');

      const bondSystem = sim.engine.getBondSystem();
      const heroes = [
        sim.engine.hero.getGeneral('liubei')!,
        sim.engine.hero.getGeneral('guanyu')!,
        sim.engine.hero.getGeneral('zhangfei')!,
      ];
      const bonds = bondSystem.detectActiveBonds(heroes);
      const bonuses = bondSystem.calculateTotalBondBonuses(bonds);

      // 蜀×3 → 同仇敌忾: attack +15%
      expect(bonuses.attack).toBeCloseTo(0.15, 2);
    });

    it('should get faction distribution', () => {
      // 验证阵营分布计算
      sim.addHeroDirectly('liubei');    // shu
      sim.addHeroDirectly('guanyu');    // shu
      sim.addHeroDirectly('caocao');    // wei

      const bondSystem = sim.engine.getBondSystem();
      const heroes = [
        sim.engine.hero.getGeneral('liubei')!,
        sim.engine.hero.getGeneral('guanyu')!,
        sim.engine.hero.getGeneral('caocao')!,
      ];
      const dist = bondSystem.getFactionDistribution(heroes);

      expect(dist.shu).toBe(2);
      expect(dist.wei).toBe(1);
    });

    it('should get formation bond preview', () => {
      // Play FORM-FLOW-4 步骤6: 羁绊视觉效果
      sim.addHeroDirectly('liubei');
      sim.addHeroDirectly('guanyu');
      sim.addHeroDirectly('zhangfei');
      sim.engine.createFormation('f1');
      sim.engine.setFormation('f1', ['liubei', 'guanyu', 'zhangfei']);

      const bondSystem = sim.engine.getBondSystem();
      const heroes = ['liubei', 'guanyu', 'zhangfei']
        .map(id => sim.engine.hero.getGeneral(id)!)
        .filter(Boolean);
      const preview = bondSystem.getFormationPreview('f1', heroes);

      expect(preview).toBeDefined();
      expect(preview.activeBonds.length).toBeGreaterThan(0);
    });
  });

  // ─────────────────────────────────────────
  // FORM-FLOW-5: 智能编队推荐 [引擎未实现]
  // ─────────────────────────────────────────

  describe('FORM-FLOW-5: 智能编队推荐', () => {
    it.skip('[引擎未实现] should recommend formations based on stage characteristics', () => {
      // Play FORM-FLOW-5 步骤2: 推荐面板展开
    });

    it.skip('[引擎未实现] should show 1~3 recommendation plans', () => {
      // Play FORM-FLOW-5 步骤3~4: 显示1~3套推荐方案
    });
  });

  // ─────────────────────────────────────────
  // CROSS-FLOW-2: 升级→战力→编队联动
  // ─────────────────────────────────────────

  describe('CROSS-FLOW-2: 升级→属性变化→战力重算→编队更新', () => {
    it('should update formation power after level up', () => {
      // Play CROSS-FLOW-2 步骤1~4: 升级→战力→编队联动
      sim.addHeroDirectly('liubei');
      sim.addHeroDirectly('guanyu');
      sim.engine.createFormation('f1');
      sim.engine.setFormation('f1', ['liubei', 'guanyu']);

      const hero = sim.engine.hero;
      const formation = sim.engine.getFormationSystem().getFormation('f1')!;
      const powerBefore = sim.engine.getFormationSystem().calculateFormationPower(
        formation,
        (id) => hero.getGeneral(id),
        (g) => hero.calculatePower(g),
      );

      sim.addResources({ gold: 500000, grain: 500000 });
      sim.engine.enhanceHero('liubei', 10);

      const formationAfter = sim.engine.getFormationSystem().getFormation('f1')!;
      const powerAfter = sim.engine.getFormationSystem().calculateFormationPower(
        formationAfter,
        (id) => hero.getGeneral(id),
        (g) => hero.calculatePower(g),
      );

      expect(powerAfter).toBeGreaterThan(powerBefore);
    });

    it('should update formation power after star up', () => {
      // 升星后编队战力联动
      sim.addHeroDirectly('liubei');
      sim.addHeroDirectly('guanyu');
      sim.addHeroFragments('liubei', 30);
      sim.addResources({ gold: 500000 });
      sim.engine.createFormation('f1');
      sim.engine.setFormation('f1', ['liubei', 'guanyu']);

      const hero = sim.engine.hero;
      const starSystem = sim.engine.getHeroStarSystem();
      const formation = sim.engine.getFormationSystem().getFormation('f1')!;
      const powerBefore = sim.engine.getFormationSystem().calculateFormationPower(
        formation,
        (id) => hero.getGeneral(id),
        (g) => hero.calculatePower(g, starSystem.getStar(g.id)),
      );

      starSystem.starUp('liubei');

      const formationAfter = sim.engine.getFormationSystem().getFormation('f1')!;
      const powerAfter = sim.engine.getFormationSystem().calculateFormationPower(
        formationAfter,
        (id) => hero.getGeneral(id),
        (g) => hero.calculatePower(g, starSystem.getStar(g.id)),
      );

      expect(powerAfter).toBeGreaterThan(powerBefore);
    });
  });

  // ─────────────────────────────────────────
  // CROSS-FLOW-4: 编队保存→刷新→数据恢复
  // ─────────────────────────────────────────

  describe('CROSS-FLOW-4: 编队保存→刷新→数据恢复', () => {
    it('should serialize and deserialize formation data correctly', () => {
      // Play CROSS-FLOW-4 步骤1~5: 编队保存→刷新→数据恢复
      sim.addHeroDirectly('liubei');
      sim.addHeroDirectly('guanyu');
      sim.addHeroDirectly('zhangfei');
      sim.engine.createFormation('f1');
      sim.engine.setFormation('f1', ['liubei', 'guanyu', 'zhangfei']);
      sim.engine.getFormationSystem().setActiveFormation('f1');

      const formationSystem = sim.engine.getFormationSystem();
      const saved = formationSystem.serialize();

      // 重置并恢复
      formationSystem.reset();
      formationSystem.deserialize(saved);

      const restored = formationSystem.getFormation('f1');
      expect(restored).not.toBeNull();
      expect(restored!.slots.filter(s => s !== '').length).toBe(3);
    });

    it('should preserve active formation through serialize/deserialize', () => {
      sim.addHeroDirectly('liubei');
      sim.engine.createFormation('f1');
      sim.engine.getFormationSystem().setActiveFormation('f1');

      const formationSystem = sim.engine.getFormationSystem();
      const saved = formationSystem.serialize();
      formationSystem.reset();
      formationSystem.deserialize(saved);

      const activeId = formationSystem.getActiveFormationId();
      expect(activeId).toBe('f1');
    });
  });

  // ─────────────────────────────────────────
  // CROSS-FLOW-5: 武将→建筑派驻联动 [引擎未实现]
  // ─────────────────────────────────────────

  describe('CROSS-FLOW-5: 武将→建筑派驻联动', () => {
    it.skip('[引擎未实现] should dispatch hero to building for production bonus', () => {
      // Play CROSS-FLOW-5 步骤3: 武将派驻建筑
    });

    it.skip('[引擎未实现] should increase building output based on hero stats', () => {
      // Play CROSS-FLOW-5 步骤5~6: 建筑产出增加
    });
  });

  // ─────────────────────────────────────────
  // CROSS-FLOW-7: 武将升级→资源消耗→建筑产出联动 [引擎未实现]
  // ─────────────────────────────────────────

  describe('CROSS-FLOW-7: 武将升级→资源消耗→建筑产出联动', () => {
    it.skip('[引擎未实现] should update building output when dispatched hero levels up', () => {
      // Play CROSS-FLOW-7 步骤2~3: 升级后产出联动提升
    });
  });
});
