/**
 * BattleEffectApplier — 单元测试
 *
 * 覆盖：
 * - 科技效果应用到战斗单位
 * - 兵种专属加成
 * - 武技特效配置查询
 * - 增强伤害结果
 * - 自定义特效注册
 *
 * @module engine/battle/__tests__/BattleEffectApplier.test
 */

import { BattleEffectApplier } from '../BattleEffectApplier';
import type { SkillEffectConfig } from '../BattleEffectApplier';
import type { BattleUnit, DamageResult } from '../battle.types';
import { TroopType } from '../battle.types';
import { TechEffectSystem } from '../../tech/TechEffectSystem';
import { TechTreeSystem } from '../../tech/TechTreeSystem';
import type { ISystemDeps } from '../../../../core/types';

// ─────────────────────────────────────────────
// 测试工具
// ─────────────────────────────────────────────

function mockDeps(): ISystemDeps {
  return {
    eventBus: {
      on: jest.fn().mockReturnValue(jest.fn()),
      once: jest.fn().mockReturnValue(jest.fn()),
      emit: jest.fn(),
      off: jest.fn(),
      removeAllListeners: jest.fn(),
    },
    config: { get: jest.fn(), set: jest.fn() },
    registry: { register: jest.fn(), get: jest.fn(), getAll: jest.fn(), has: jest.fn(), unregister: jest.fn() },
  } as unknown as ISystemDeps;
}

function createTestUnit(overrides: Partial<BattleUnit> = {}): BattleUnit {
  return {
    id: 'test-unit',
    name: '测试武将',
    faction: 'shu',
    troopType: TroopType.CAVALRY,
    position: 'front',
    side: 'ally',
    attack: 100,
    baseAttack: 100,
    defense: 50,
    baseDefense: 50,
    intelligence: 60,
    speed: 80,
    hp: 1000,
    maxHp: 1000,
    isAlive: true,
    rage: 0,
    maxRage: 100,
    normalAttack: {
      id: 'normal', name: '普攻', type: 'active', level: 1,
      description: '普通攻击', multiplier: 1.0, targetType: 'SINGLE_ENEMY',
      rageCost: 0, cooldown: 0, currentCooldown: 0,
    },
    skills: [],
    buffs: [],
    ...overrides,
  };
}

function createDamageResult(overrides: Partial<DamageResult> = {}): DamageResult {
  return {
    damage: 100,
    baseDamage: 80,
    skillMultiplier: 1.0,
    isCritical: false,
    criticalMultiplier: 1.0,
    restraintMultiplier: 1.0,
    randomFactor: 1.0,
    isMinDamage: false,
    ...overrides,
  };
}

/** 创建完整的 applier + tech 系统 */
function createFullSystems() {
  const treeSys = new TechTreeSystem();
  treeSys.init(mockDeps());

  const effectSys = new TechEffectSystem();
  effectSys.init(mockDeps());
  effectSys.setTechTree(treeSys);

  const applier = new BattleEffectApplier();
  applier.setTechEffectSystem(effectSys);

  return { applier, effectSys, treeSys };
}

// ═══════════════════════════════════════════════
// 测试
// ═══════════════════════════════════════════════

describe('BattleEffectApplier', () => {
  let applier: BattleEffectApplier;

  beforeEach(() => {
    applier = new BattleEffectApplier();
  });

  // ─────────────────────────────────────────
  // 1. 无科技时基础行为
  // ─────────────────────────────────────────
  describe('无科技时基础行为', () => {
    it('无科技加成时属性不变', () => {
      const unit = createTestUnit();
      const stats = applier.getEnhancedStats(unit);

      expect(stats.enhancedAttack).toBe(100);
      expect(stats.enhancedDefense).toBe(50);
      expect(stats.attackBonusPercent).toBe(0);
      expect(stats.defenseBonusPercent).toBe(0);
    });

    it('无科技时 applyTechBonusesToUnit 不改变属性', () => {
      const unit = createTestUnit();
      applier.applyTechBonusesToUnit(unit);

      expect(unit.attack).toBe(100);
      expect(unit.defense).toBe(50);
    });

    it('无科技时增强伤害结果不变', () => {
      const unit = createTestUnit();
      const result = createDamageResult({ damage: 100 });
      const enhanced = applier.enhanceDamageResult(result, unit);

      expect(enhanced.enhancedDamage).toBe(100);
      expect(enhanced.techAttackBonus).toBe(0);
    });
  });

  // ─────────────────────────────────────────
  // 2. 军事科技应用到战斗
  // ─────────────────────────────────────────
  describe('军事科技应用到战斗', () => {
    it('锐兵术 +10% 攻击正确应用', () => {
      const { applier, treeSys, effectSys } = createFullSystems();

      treeSys.completeNode('mil_t1_attack');
      effectSys.invalidateCache();

      const unit = createTestUnit();
      const stats = applier.getEnhancedStats(unit);

      expect(stats.attackBonusPercent).toBe(10);
      expect(stats.enhancedAttack).toBe(110); // 100 * 1.1
    });

    it('铁壁术 +10% 防御正确应用', () => {
      const { applier, treeSys, effectSys } = createFullSystems();

      treeSys.completeNode('mil_t1_defense');
      effectSys.invalidateCache();

      const unit = createTestUnit();
      const stats = applier.getEnhancedStats(unit);

      expect(stats.defenseBonusPercent).toBe(10);
      expect(stats.enhancedDefense).toBe(55); // 50 * 1.1
    });

    it('骑兵专属加成叠加全军加成', () => {
      const { applier, treeSys, effectSys } = createFullSystems();

      treeSys.completeNode('mil_t1_attack'); // 全军 +10
      treeSys.completeNode('mil_t2_charge'); // 骑兵 +15
      effectSys.invalidateCache();

      const cavalryUnit = createTestUnit({ troopType: TroopType.CAVALRY });
      const stats = applier.getEnhancedStats(cavalryUnit);

      // 全军 10 + 骑兵 15 = 25
      expect(stats.attackBonusPercent).toBe(25);
      expect(stats.enhancedAttack).toBe(125); // 100 * 1.25
    });

    it('步兵专属加成只影响步兵', () => {
      const { applier, treeSys, effectSys } = createFullSystems();

      treeSys.completeNode('mil_t1_defense');
      treeSys.completeNode('mil_t2_fortify'); // 步兵防御 +15, 步兵生命 +10
      effectSys.invalidateCache();

      const infantryUnit = createTestUnit({ troopType: TroopType.INFANTRY, baseDefense: 50 });
      const cavalryUnit = createTestUnit({ troopType: TroopType.CAVALRY, baseDefense: 50 });

      const infStats = applier.getEnhancedStats(infantryUnit);
      const cavStats = applier.getEnhancedStats(cavalryUnit);

      // 步兵: 全军 10 + 步兵 15 = 25
      expect(infStats.defenseBonusPercent).toBe(25);
      expect(infStats.enhancedDefense).toBe(62); // 50 * 1.25

      // 骑兵: 全军 10
      expect(cavStats.defenseBonusPercent).toBe(10);
      expect(cavStats.enhancedDefense).toBe(55); // 50 * 1.1
    });

    it('applyTechBonusesToUnit 直接修改单位属性', () => {
      const { applier, treeSys, effectSys } = createFullSystems();

      treeSys.completeNode('mil_t1_attack');
      effectSys.invalidateCache();

      const unit = createTestUnit();
      applier.applyTechBonusesToUnit(unit);

      expect(unit.attack).toBe(110);
    });

    it('applyTechBonusesToTeam 批量应用', () => {
      const { applier, treeSys, effectSys } = createFullSystems();

      treeSys.completeNode('mil_t1_attack');
      effectSys.invalidateCache();

      const units = [
        createTestUnit({ id: 'u1' }),
        createTestUnit({ id: 'u2' }),
        createTestUnit({ id: 'u3' }),
      ];

      applier.applyTechBonusesToTeam(units);

      for (const unit of units) {
        expect(unit.attack).toBe(110);
      }
    });
  });

  // ─────────────────────────────────────────
  // 3. 增强伤害结果
  // ─────────────────────────────────────────
  describe('增强伤害结果', () => {
    it('科技加成正确应用到伤害结果', () => {
      const { applier, treeSys, effectSys } = createFullSystems();

      treeSys.completeNode('mil_t1_attack');
      effectSys.invalidateCache();

      const unit = createTestUnit();
      const result = createDamageResult({ damage: 100 });
      const enhanced = applier.enhanceDamageResult(result, unit);

      expect(enhanced.techAttackBonus).toBe(10);
      expect(enhanced.enhancedDamage).toBe(110); // 100 * 1.1
    });

    it('多层科技加成叠加', () => {
      const { applier, treeSys, effectSys } = createFullSystems();

      treeSys.completeNode('mil_t1_attack'); // +10
      treeSys.completeNode('mil_t2_charge'); // 骑兵 +15
      effectSys.invalidateCache();

      const unit = createTestUnit({ troopType: TroopType.CAVALRY });
      const result = createDamageResult({ damage: 100 });
      const enhanced = applier.enhanceDamageResult(result, unit);

      expect(enhanced.techAttackBonus).toBe(25);
      expect(enhanced.enhancedDamage).toBe(125); // 100 * 1.25
    });

    it('增强结果保留原始结果字段', () => {
      const { applier } = createFullSystems();

      const unit = createTestUnit();
      const result = createDamageResult({
        damage: 100,
        isCritical: true,
        criticalMultiplier: 1.5,
      });
      const enhanced = applier.enhanceDamageResult(result, unit);

      expect(enhanced.isCritical).toBe(true);
      expect(enhanced.criticalMultiplier).toBe(1.5);
      expect(enhanced.damage).toBe(100);
    });
  });

  // ─────────────────────────────────────────
  // 4. 武技特效配置
  // ─────────────────────────────────────────
  describe('武技特效配置（#2）', () => {
    it('获取预设特效配置', () => {
      const effect = applier.getSkillEffect('fire_slash');

      expect(effect).not.toBeNull();
      expect(effect!.skillName).toBe('烈焰斩');
      expect(effect!.element).toBe('fire');
      expect(effect!.particleCount).toBe(30);
      expect(effect!.screenShake).toBe(true);
    });

    it('获取所有预设特效', () => {
      const effects = applier.getAllSkillEffects();
      expect(effects.length).toBeGreaterThanOrEqual(7);
    });

    it('不存在的技能返回 null', () => {
      expect(applier.getSkillEffect('nonexistent')).toBeNull();
    });

    it('注册自定义特效', () => {
      const customConfig: SkillEffectConfig = {
        skillId: 'custom_skill',
        skillName: '自定义技能',
        element: 'fire',
        particleCount: 50,
        duration: 1500,
        trigger: 'onSkillCast',
        color: '#FF0000',
        scale: 2.0,
        screenShake: true,
        shakeIntensity: 0.8,
      };

      applier.registerSkillEffect(customConfig);

      const effect = applier.getSkillEffect('custom_skill');
      expect(effect).not.toBeNull();
      expect(effect!.skillName).toBe('自定义技能');
      expect(effect!.particleCount).toBe(50);
    });

    it('覆盖已有特效配置', () => {
      const override: SkillEffectConfig = {
        skillId: 'fire_slash',
        skillName: '超级烈焰斩',
        element: 'fire',
        particleCount: 100,
        duration: 2000,
        trigger: 'onCritical',
        color: '#FF0000',
        scale: 3.0,
        screenShake: true,
        shakeIntensity: 1.0,
      };

      applier.registerSkillEffect(override);

      const effect = applier.getSkillEffect('fire_slash');
      expect(effect!.skillName).toBe('超级烈焰斩');
      expect(effect!.particleCount).toBe(100);
    });

    it('特效元素类型正确', () => {
      const fireEffect = applier.getSkillEffect('fire_slash');
      expect(fireEffect!.element).toBe('fire');

      const iceEffect = applier.getSkillEffect('ice_blade');
      expect(iceEffect!.element).toBe('ice');

      const thunderEffect = applier.getSkillEffect('thunder_strike');
      expect(thunderEffect!.element).toBe('thunder');
    });

    it('各特效触发时机正确', () => {
      expect(applier.getSkillEffect('fire_slash')!.trigger).toBe('onSkillCast');
      expect(applier.getSkillEffect('thunder_strike')!.trigger).toBe('onCritical');
      expect(applier.getSkillEffect('wind_slash')!.trigger).toBe('onHit');
      expect(applier.getSkillEffect('holy_light')!.trigger).toBe('onHeal');
    });
  });

  // ─────────────────────────────────────────
  // 5. 多兵种场景
  // ─────────────────────────────────────────
  describe('多兵种场景', () => {
    it('五种兵种都能正确映射', () => {
      const { applier, treeSys, effectSys } = createFullSystems();
      treeSys.completeNode('mil_t1_attack');
      effectSys.invalidateCache();

      const troopTypes = [
        TroopType.CAVALRY,
        TroopType.INFANTRY,
        TroopType.SPEARMAN,
        TroopType.ARCHER,
        TroopType.STRATEGIST,
      ];

      for (const tt of troopTypes) {
        const unit = createTestUnit({ troopType: tt });
        const stats = applier.getEnhancedStats(unit);
        // 全军 +10%
        expect(stats.attackBonusPercent).toBe(10);
        expect(stats.enhancedAttack).toBe(110);
      }
    });
  });
});
