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

import { describe, it, expect, vi, beforeEach } from 'vitest';
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
    });

    it('触摸热区大于按钮尺寸', () => {
      const layout = manager.getMobileLayout(375, 667);
      expect(layout.touchPadding).toBeGreaterThan(0);
    });

    it('getSkillButtonLayout 返回正确数量的按钮位置', () => {
      manager.getMobileLayout(375, 667);
      const buttons = manager.getSkillButtonLayout(3);
      expect(buttons.length).toBe(3);

      // 每个按钮有 x, y, width, height
      for (const btn of buttons) {
        expect(btn.x).toBeGreaterThanOrEqual(0);
        expect(btn.y).toBeGreaterThan(0);
        expect(btn.width).toBeGreaterThan(0);
        expect(btn.height).toBeGreaterThan(0);
      }
    });

    it('技能按钮之间有间距', () => {
      manager.getMobileLayout(414, 896);
      const buttons = manager.getSkillButtonLayout(3);
      // 第二个按钮的 x 应大于第一个
      expect(buttons[1].x).toBeGreaterThan(buttons[0].x);
    });

    it('getLayoutConfig 返回当前配置', () => {
      manager.getMobileLayout(375, 667);
      const config = manager.getLayoutConfig();
      expect(config.screenClass).toBe('small');
    });
  });

  // ─────────────────────────────────────────
  // #5 伤害数字动画
  // ─────────────────────────────────────────
  describe('#5 伤害数字动画', () => {
    it('为普通伤害生成动画数据', () => {
      const action = createTestAction({
        damageResults: { 'enemy-1': createDamageResult({ damage: 100, isCritical: false }) },
      });
      const animations = manager.generateDamageAnimations(action);

      expect(animations.length).toBe(1);
      expect(animations[0].number.value).toBe(100);
      expect(animations[0].triggerShake).toBe(false);
      expect(animations[0].delayMs).toBe(0);
    });

    it('为暴击伤害生成动画数据并触发震动', () => {
      const action = createTestAction({
        damageResults: { 'enemy-1': createDamageResult({ damage: 200, isCritical: true }) },
      });
      const animations = manager.generateDamageAnimations(action);

      expect(animations[0].triggerShake).toBe(true);
      expect(animations[0].shakeIntensity).toBeGreaterThan(0);
    });

    it('AOE 技能多目标错开显示（递增延迟）', () => {
      const action = createTestAction({
        targetIds: ['e1', 'e2', 'e3'],
        damageResults: {
          'e1': createDamageResult({ damage: 80 }),
          'e2': createDamageResult({ damage: 90 }),
          'e3': createDamageResult({ damage: 70 }),
        },
      });
      const animations = manager.generateDamageAnimations(action);

      expect(animations.length).toBe(3);
      expect(animations[0].delayMs).toBe(0);
      expect(animations[1].delayMs).toBe(80);
      expect(animations[2].delayMs).toBe(160);
    });

    it('0 伤害生成免疫数字', () => {
      const action = createTestAction({
        damageResults: { 'enemy-1': createDamageResult({ damage: 0 }) },
      });
      const animations = manager.generateDamageAnimations(action);

      expect(animations[0].number.type).toBe(DamageNumberType.IMMUNE);
    });

    it('generateHealAnimation 生成治疗动画', () => {
      const anim = manager.generateHealAnimation('healer', 'target', 50);

      expect(anim.number.value).toBe(50);
      expect(anim.number.type).toBe(DamageNumberType.HEAL);
      expect(anim.triggerShake).toBe(false);
      expect(anim.delayMs).toBe(0);
    });

    it('generateDotAnimation 生成 DOT 动画', () => {
      const anim = manager.generateDotAnimation('target', 30);

      expect(anim.number.value).toBe(30);
      expect(anim.number.type).toBe(DamageNumberType.DOT);
      expect(anim.actionId).toBeNull();
    });

    it('getDamageAnimations 返回活跃动画列表', () => {
      manager.generateHealAnimation('h', 't', 50);
      manager.generateDotAnimation('t', 30);

      const anims = manager.getDamageAnimations();
      expect(anims.length).toBe(2);
    });
  });

  // ─────────────────────────────────────────
  // 战斗速度联动
  // ─────────────────────────────────────────
  describe('战斗速度联动', () => {
    it('默认速度为 X2', () => {
      expect(manager.getBattleSpeed()).toBe(BattleSpeed.X2);
    });

    it('4x 速度时特效为简化版本', () => {
      manager.setBattleSpeed(BattleSpeed.X4);
      const skill = createTestSkill({ id: 'fire_slash', rageCost: 50 });
      const effect = manager.generateSkillEffect(skill, createTestUnit());

      expect(effect.simplified).toBe(true);
      expect(effect.screenShake.enabled).toBe(false);
    });

    it('4x 速度时粒子数量减少', () => {
      manager.setBattleSpeed(BattleSpeed.X1);
      const skill = createTestSkill({ id: 'fire_slash' });
      const effect1 = manager.generateSkillEffect(skill, createTestUnit());
      manager.clear();

      manager.setBattleSpeed(BattleSpeed.X4);
      const effect4 = manager.generateSkillEffect(skill, createTestUnit());

      expect(effect4.particles.count).toBeLessThan(effect1.particles.count);
    });

    it('4x 速度时 Buff 特效也简化', () => {
      manager.setBattleSpeed(BattleSpeed.X4);
      const effect = manager.generateBuffEffect(BuffType.BURN, createTestUnit());
      expect(effect.simplified).toBe(true);
    });

    it('1x 速度时特效不简化', () => {
      manager.setBattleSpeed(BattleSpeed.X1);
      const skill = createTestSkill({ id: 'fire_slash' });
      const effect = manager.generateSkillEffect(skill, createTestUnit());

      expect(effect.simplified).toBe(false);
    });
  });

  // ─────────────────────────────────────────
  // 生命周期管理
  // ─────────────────────────────────────────
  describe('生命周期管理', () => {
    it('clear 清除所有特效和动画', () => {
      const skill = createTestSkill();
      manager.generateSkillEffect(skill, createTestUnit());
      manager.generateHealAnimation('h', 't', 50);

      manager.clear();

      expect(manager.getActiveEffects().length).toBe(0);
      expect(manager.getDamageAnimations().length).toBe(0);
    });

    it('cleanupEffects 清除过期特效', () => {
      const skill = createTestSkill();
      const now = Date.now();
      manager.generateSkillEffect(skill, createTestUnit(), undefined, now - 4000);

      manager.cleanupEffects(now);

      expect(manager.getActiveEffects().length).toBe(0);
    });

    it('未过期的特效保留', () => {
      const skill = createTestSkill();
      const now = Date.now();
      manager.generateSkillEffect(skill, createTestUnit(), undefined, now);

      manager.cleanupEffects(now);

      expect(manager.getActiveEffects().length).toBe(1);
    });

    it('cleanupAnimations 清除过期动画', () => {
      const now = Date.now();
      manager.generateHealAnimation('h', 't', 50, now - 3000);

      manager.cleanupAnimations(now);

      expect(manager.getDamageAnimations().length).toBe(0);
    });

    it('update 同时清理特效和动画', () => {
      const now = Date.now();
      const skill = createTestSkill();
      manager.generateSkillEffect(skill, createTestUnit(), undefined, now - 4000);
      manager.generateHealAnimation('h', 't', 50, now - 3000);

      manager.update(now);

      expect(manager.getActiveEffects().length).toBe(0);
      expect(manager.getDamageAnimations().length).toBe(0);
    });

    it('特效数量超过上限时自动裁剪', () => {
      manager.getMobileLayout(375, 667); // small: maxActiveEffects = 5
      const skill = createTestSkill();

      // 生成超过上限的特效
      for (let i = 0; i < 10; i++) {
        manager.generateSkillEffect(skill, createTestUnit());
      }

      const active = manager.getActiveEffects();
      expect(active.length).toBeLessThanOrEqual(5);
    });
  });

  // ─────────────────────────────────────────
  // 集成场景
  // ─────────────────────────────────────────
  describe('集成场景', () => {
    it('完整战斗行动：技能特效 + 伤害数字', () => {
      const skill = createTestSkill({ id: 'thunder_strike', rageCost: 80 });
      const actor = createTestUnit();
      const dmgResult = createDamageResult({ damage: 250, isCritical: true });

      // 生成技能特效
      const effect = manager.generateSkillEffect(skill, actor, dmgResult);
      expect(effect.element).toBe('thunder');
      expect(effect.screenShake.enabled).toBe(true);

      // 生成伤害动画
      const action = createTestAction({
        actorId: actor.id,
        skill,
        damageResults: { 'enemy-1': dmgResult },
      });
      const animations = manager.generateDamageAnimations(action);
      expect(animations.length).toBe(1);
      expect(animations[0].triggerShake).toBe(true);
    });

    it('手机端 + 4x速度完整场景', () => {
      manager.getMobileLayout(375, 667);
      manager.setBattleSpeed(BattleSpeed.X4);

      const skill = createTestSkill({ id: 'fire_slash', rageCost: 50 });
      const effect = manager.generateSkillEffect(skill, createTestUnit());

      expect(effect.simplified).toBe(true);
      expect(effect.screenShake.enabled).toBe(false);
      expect(effect.particles.count).toBeLessThan(30);
    });
  });
});
