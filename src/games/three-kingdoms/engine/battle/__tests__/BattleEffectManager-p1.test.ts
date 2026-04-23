/**
 * BattleEffectManager — 单元测试
 *
 * 覆盖：
 * - #2 武技特效触发和渲染数据生成
 * - #4 手机端战斗全屏布局适配
 * - #5 伤害数字动画数据生成
 * - 特效与战斗速度联动
 * - 生命周期管理
 *
 * @module engine/battle/__tests__/BattleEffectManager.test
 */

import { BattleEffectManager } from '../BattleEffectManager';
import type {
  SkillEffectData,
  MobileLayoutConfig,
  DamageAnimationData,
  EffectElement,
} from '../BattleEffectManager';
import type { BattleUnit, BattleSkill, BattleAction, DamageResult } from '../battle.types';
import { TroopType, BuffType, SkillTargetType } from '../battle.types';
import { BattleSpeed } from '../battle-v4.types';
import { DamageNumberType } from '../DamageNumberSystem';

// ─────────────────────────────────────────────
// 测试工具
// ─────────────────────────────────────────────

function createTestSkill(overrides: Partial<BattleSkill> = {}): BattleSkill {
  return {
    id: 'fire_slash',
    name: '烈焰斩',
    type: 'active',
    level: 1,
    description: '火属性攻击',
    multiplier: 1.5,
    targetType: SkillTargetType.SINGLE_ENEMY,
    rageCost: 50,
    cooldown: 3,
    currentCooldown: 0,
    ...overrides,
  };
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
      description: '普通攻击', multiplier: 1.0, targetType: SkillTargetType.SINGLE_ENEMY,
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
    skillMultiplier: 1.5,
    isCritical: false,
    criticalMultiplier: 1.0,
    restraintMultiplier: 1.0,
    randomFactor: 1.0,
    isMinDamage: false,
    ...overrides,
  };
}

function createTestAction(overrides: Partial<BattleAction> = {}): BattleAction {
  return {
    turn: 1,
    actorId: 'test-unit',
    actorName: '测试武将',
    actorSide: 'ally',
    skill: createTestSkill(),
    targetIds: ['enemy-1'],
    damageResults: { 'enemy-1': createDamageResult() },
    description: '测试行动',
    isNormalAttack: false,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════

describe('BattleEffectManager', () => {
  let manager: BattleEffectManager;

  beforeEach(() => {
    manager = new BattleEffectManager();
  });

  // ─────────────────────────────────────────
  // #2 武技特效
  // ─────────────────────────────────────────
  describe('#2 武技特效', () => {
    it('为火属性技能生成正确的特效数据', () => {
      const skill = createTestSkill({ id: 'fire_slash' });
      const actor = createTestUnit();
      const effect = manager.generateSkillEffect(skill, actor);

      expect(effect.skillId).toBe('fire_slash');
      expect(effect.element).toBe('fire');
      expect(effect.particles.count).toBeGreaterThan(0);
      expect(effect.particles.colors).toContain('#FF4500');
      expect(effect.glow.color).toBe('#FF4500');
      expect(effect.totalDuration).toBeGreaterThan(0);
      expect(effect.simplified).toBe(false);
    });

    it('为冰属性技能生成正确的特效数据', () => {
      const skill = createTestSkill({ id: 'ice_blade' });
      const actor = createTestUnit();
      const effect = manager.generateSkillEffect(skill, actor);

      expect(effect.element).toBe('ice');
      expect(effect.particles.colors).toContain('#00BFFF');
    });

    it('为雷属性技能生成正确的特效数据', () => {
      const skill = createTestSkill({ id: 'thunder_strike' });
      const effect = manager.generateSkillEffect(skill, createTestUnit());

      expect(effect.element).toBe('thunder');
      expect(effect.particles.colors).toContain('#FFD700');
    });

    it('暴击时触发时机为 onCritical', () => {
      const skill = createTestSkill({ id: 'fire_slash' });
      const dmgResult = createDamageResult({ isCritical: true });
      const effect = manager.generateSkillEffect(skill, createTestUnit(), dmgResult);

      expect(effect.trigger).toBe('onCritical');
    });

    it('大招技能（rageCost > 0）启用屏幕震动', () => {
      const skill = createTestSkill({ rageCost: 50 });
      const effect = manager.generateSkillEffect(skill, createTestUnit());

      expect(effect.screenShake.enabled).toBe(true);
      expect(effect.screenShake.intensity).toBeGreaterThan(0);
    });

    it('普攻技能（rageCost = 0）不启用屏幕震动', () => {
      const skill = createTestSkill({ rageCost: 0 });
      const effect = manager.generateSkillEffect(skill, createTestUnit());

      expect(effect.screenShake.enabled).toBe(false);
    });

    it('大招增强光效半径和强度', () => {
      const ultimateSkill = createTestSkill({ rageCost: 100, id: 'fire_ultimate' });
      const normalSkill = createTestSkill({ rageCost: 0, id: 'fire_normal' });

      const ultEffect = manager.generateSkillEffect(ultimateSkill, createTestUnit());
      manager.clear();
      const normEffect = manager.generateSkillEffect(normalSkill, createTestUnit());

      expect(ultEffect.glow.radius).toBeGreaterThan(normEffect.glow.radius);
    });

    it('未知元素类型默认为 neutral', () => {
      const skill = createTestSkill({ id: 'unknown_skill' });
      const effect = manager.generateSkillEffect(skill, createTestUnit());

      expect(effect.element).toBe('neutral');
    });

    it('被动技能触发时机为 onHit', () => {
      const skill = createTestSkill({ type: 'passive', rageCost: 0 });
      const effect = manager.generateSkillEffect(skill, createTestUnit());

      expect(effect.trigger).toBe('onHit');
    });

    it('每个特效有唯一 ID', () => {
      const skill = createTestSkill();
      const effect1 = manager.generateSkillEffect(skill, createTestUnit());
      manager.clear();
      const effect2 = manager.generateSkillEffect(skill, createTestUnit());

      expect(effect1.id).not.toBe(effect2.id);
    });

    it('getActiveEffects 返回活跃特效列表', () => {
      const skill = createTestSkill();
      manager.generateSkillEffect(skill, createTestUnit());
      manager.generateSkillEffect(skill, createTestUnit());

      const active = manager.getActiveEffects();
      expect(active.length).toBe(2);
    });
  });

  // ─────────────────────────────────────────
  // Buff 特效
  // ─────────────────────────────────────────
  describe('Buff 特效', () => {
    it('灼烧 Buff 生成火元素特效', () => {
      const effect = manager.generateBuffEffect(BuffType.BURN, createTestUnit());
      expect(effect.element).toBe('fire');
    });

    it('冰冻 Buff 生成冰元素特效', () => {
      const effect = manager.generateBuffEffect(BuffType.FREEZE, createTestUnit());
      expect(effect.element).toBe('ice');
    });

    it('护盾 Buff 生成光元素特效', () => {
      const effect = manager.generateBuffEffect(BuffType.SHIELD, createTestUnit());
      expect(effect.element).toBe('light');
    });

    it('Buff 特效不启用屏幕震动', () => {
      const effect = manager.generateBuffEffect(BuffType.ATK_UP, createTestUnit());
      expect(effect.screenShake.enabled).toBe(false);
    });
  });

  // ─────────────────────────────────────────
  // #4 手机端战斗全屏布局
  // ─────────────────────────────────────────
  describe('#4 手机端战斗全屏布局', () => {
    it('小屏幕（375x667）返回 small 分类', () => {
      const layout = manager.getMobileLayout(375, 667);
      expect(layout.screenClass).toBe('small');
      expect(layout.canvasWidth).toBe(375);
      expect(layout.canvasHeight).toBe(667);
      expect(layout.simplifiedEffects).toBe(true);
      expect(layout.skillButtonSize).toBe(48);
    });

    it('中等屏幕（414x896）返回 medium 分类', () => {
      const layout = manager.getMobileLayout(414, 896);
      expect(layout.screenClass).toBe('medium');
      expect(layout.simplifiedEffects).toBe(false);
      expect(layout.skillButtonSize).toBe(56);
    });

    it('大屏幕（768x1024）返回 large 分类', () => {
      const layout = manager.getMobileLayout(768, 1024);
      expect(layout.screenClass).toBe('large');
      expect(layout.skillButtonSize).toBe(64);
