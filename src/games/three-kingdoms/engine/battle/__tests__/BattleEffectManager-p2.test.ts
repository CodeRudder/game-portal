import { BattleEffectManager } from '../BattleEffectManager';
import type {
import type { BattleUnit, BattleSkill, BattleAction, DamageResult } from '../battle.types';
import { TroopType, BuffType, SkillTargetType } from '../battle.types';
import { BattleSpeed } from '../battle-v4.types';
import { DamageNumberType } from '../DamageNumberSystem';


    it('触摸热区大于按钮尺寸', () => {
      const layout = manager.getMobileLayout(375, 667);
      expect(layout.touchPadding).toBeGreaterThan(0);

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
