/**
 * 战斗系统 — 战斗特效管理器
 *
 * 职责：
 * - #2 武技特效触发和渲染数据生成（粒子/光效配置）
 * - #5 伤害数字动画数据生成（伤害/治疗/暴击飘字）
 * - #4 手机端战斗全屏布局适配数据
 * - 特效与战斗速度联动（4x 简化特效）
 * - 特效生命周期管理
 *
 * 设计原则：
 * - 纯数据层，输出结构化数据供渲染层消费
 * - 不依赖 Canvas/WebGL，不执行实际渲染
 * - 与 DamageNumberSystem 协同但不替代
 *
 * @module engine/battle/BattleEffectManager
 */

import type { BattleUnit, BattleSkill, DamageResult, BattleAction } from './battle.types';
import { BuffType } from './battle.types';
import { BattleSpeed } from './battle-v4.types';
import {
  DamageNumberSystem,
  DamageNumberType,
  type DamageNumber,
} from './DamageNumberSystem';
import {
  ELEMENT_PARTICLE_PRESETS,
  ELEMENT_GLOW_PRESETS,
  SCREEN_PRESETS,
  BUFF_ELEMENT_MAP,
} from './battle-effect-presets';
import type {
  EffectElement,
  EffectTrigger,
  ParticleConfig,
  ScreenShakeConfig,
  MobileLayoutConfig,
  ScreenClass,
} from './battle-effect-presets';
import type { ISubsystem, ISystemDeps } from '../../core/types';

// ─────────────────────────────────────────────
// 1. 武技特效数据
// ─────────────────────────────────────────────

/** 完整的武技特效数据 */
export interface SkillEffectData {
  id: string;
  skillId: string;
  skillName: string;
  element: EffectElement;
  trigger: EffectTrigger;
  particles: ParticleConfig;
  glow: { color: string; radius: number; intensity: number; duration: number; pulseFrequency: number };
  screenShake: ScreenShakeConfig;
  totalDuration: number;
  createdAt: number;
  simplified: boolean;
}

/** 伤害数字动画增强数据 */
export interface DamageAnimationData {
  number: DamageNumber;
  actionId: string | null;
  triggerShake: boolean;
  shakeIntensity: number;
  delayMs: number;
  isCombo: boolean;
}

// ─────────────────────────────────────────────
// 2. 辅助函数
// ─────────────────────────────────────────────

/** 技能 ID → 元素类型推断 */
function inferElement(skill: BattleSkill): EffectElement {
  const id = skill.id.toLowerCase();
  if (id.includes('fire') || id.includes('flame') || id.includes('burn')) return 'fire';
  if (id.includes('ice') || id.includes('frost') || id.includes('freeze')) return 'ice';
  if (id.includes('thunder') || id.includes('lightning') || id.includes('shock')) return 'thunder';
  if (id.includes('wind') || id.includes('gale')) return 'wind';
  if (id.includes('earth') || id.includes('quake')) return 'earth';
  if (id.includes('holy') || id.includes('light') || id.includes('heal')) return 'light';
  if (id.includes('dark') || id.includes('shadow')) return 'dark';
  return 'neutral';
}

/** 技能 → 触发时机推断 */
function inferTrigger(skill: BattleSkill): EffectTrigger {
  if (skill.rageCost > 0) return 'onSkillCast';
  if (skill.type === 'passive') return 'onHit';
  return 'onSkillCast';
}

// ─────────────────────────────────────────────
// 3. BattleEffectManager
// ─────────────────────────────────────────────

let effectIdCounter = 0;

/**
 * 战斗特效管理器
 *
 * 管理战斗中的所有视觉效果数据：武技特效、伤害数字动画、手机端布局。
 * 纯数据层，输出结构化数据供渲染层消费。
 */
export class BattleEffectManager implements ISubsystem {
  // ── ISubsystem 接口 ──
  readonly name = 'battleEffectManager' as const;
  private sysDeps: ISystemDeps | null = null;

  private readonly damageNumbers: DamageNumberSystem;
  private battleSpeed: BattleSpeed;
  private layoutConfig: MobileLayoutConfig;
  private activeEffects: SkillEffectData[];
  private damageAnimations: DamageAnimationData[];

  constructor() {
    this.damageNumbers = new DamageNumberSystem();
    this.battleSpeed = BattleSpeed.X2;
    this.layoutConfig = { ...SCREEN_PRESETS.medium, screenClass: 'medium' };
    this.activeEffects = [];
    this.damageAnimations = [];
  }

  // ─────────────────────────────────────────
  // ISubsystem 适配层
  // ─────────────────────────────────────────

  /** ISubsystem.init — 注入依赖 */
  init(deps: ISystemDeps): void {
    this.sysDeps = deps;
  }

  /** ISubsystem.getState — 返回特效管理器状态快照 */
  getState(): { activeEffectCount: number; battleSpeed: BattleSpeed } {
    return {
      activeEffectCount: this.activeEffects.length,
      battleSpeed: this.battleSpeed,
    };
  }

  /** ISubsystem.reset — 重置特效管理器状态 */
  reset(): void {
    this.activeEffects = [];
    this.damageAnimations = [];
    this.damageNumbers.clear();
  }

  // ─────────────────────────────────────────
  // #2 武技特效
  // ─────────────────────────────────────────

  /** 为技能释放生成武技特效数据 */
  generateSkillEffect(
    skill: BattleSkill, actor: BattleUnit,
    damageResult?: DamageResult, timestamp: number = Date.now(),
  ): SkillEffectData {
    const element = inferElement(skill);
    const trigger = damageResult?.isCritical ? 'onCritical' : inferTrigger(skill);
    const is4x = this.battleSpeed === BattleSpeed.X4;
    const scale = is4x ? this.layoutConfig.particleScale * 0.5 : this.layoutConfig.particleScale;

    const base = ELEMENT_PARTICLE_PRESETS[element];
    const particles: ParticleConfig = {
      ...base,
      count: is4x ? Math.floor(base.count * 0.4) : base.count,
      sizeRange: [base.sizeRange[0] * scale, base.sizeRange[1] * scale],
    };

    const glow = { ...ELEMENT_GLOW_PRESETS[element] };
    if (skill.rageCost > 0) { glow.radius *= 1.5; glow.intensity = Math.min(1, glow.intensity * 1.3); }

    const screenShake: ScreenShakeConfig = {
      enabled: !is4x && (skill.rageCost > 0 || (damageResult?.isCritical ?? false)),
      intensity: skill.rageCost > 0 ? 0.4 : (damageResult?.isCritical ? 0.2 : 0),
      duration: skill.rageCost > 0 ? 500 : 200,
      frequency: 10,
    };

    const effect: SkillEffectData = {
      id: `fx_${++effectIdCounter}`, skillId: skill.id, skillName: skill.name,
      element, trigger, particles, glow, screenShake,
      totalDuration: Math.max(particles.lifetimeRange[1], glow.duration, screenShake.enabled ? screenShake.duration : 0),
      createdAt: timestamp, simplified: is4x,
    };

    this.activeEffects.push(effect);
    this.trimEffects();
    return effect;
  }

  /** 为 Buff 应用生成特效数据 */
  generateBuffEffect(buffType: BuffType, _target: BattleUnit, timestamp: number = Date.now()): SkillEffectData {
    const element = BUFF_ELEMENT_MAP[buffType] ?? 'neutral';
    const is4x = this.battleSpeed === BattleSpeed.X4;
    const base = ELEMENT_PARTICLE_PRESETS[element];
    const particles: ParticleConfig = {
      ...base,
      count: is4x ? Math.floor(base.count * 0.3) : Math.floor(base.count * 0.5),
    };
    const baseGlow = ELEMENT_GLOW_PRESETS[element];
    const glow = { ...baseGlow, intensity: baseGlow.intensity * 0.5 };

    const effect: SkillEffectData = {
      id: `fx_${++effectIdCounter}`, skillId: `buff_${buffType}`, skillName: `${buffType}效果`,
      element, trigger: 'onHit', particles, glow,
      screenShake: { enabled: false, intensity: 0, duration: 0, frequency: 0 },
      totalDuration: particles.lifetimeRange[1], createdAt: timestamp, simplified: is4x,
    };

    this.activeEffects.push(effect);
    this.trimEffects();
    return effect;
  }

  getActiveEffects(): SkillEffectData[] { return [...this.activeEffects]; }

  cleanupEffects(currentTime: number): void {
    this.activeEffects = this.activeEffects.filter(fx => (currentTime - fx.createdAt) < 3000);
  }

  // ─────────────────────────────────────────
  // #5 伤害数字动画
  // ─────────────────────────────────────────

  /** 为战斗行动生成伤害数字动画数据 */
  generateDamageAnimations(action: BattleAction, timestamp: number = Date.now()): DamageAnimationData[] {
    const results: DamageAnimationData[] = [];
    const targetIds = Object.keys(action.damageResults);

    for (let i = 0; i < targetIds.length; i++) {
      const tid = targetIds[i];
      const dmg = action.damageResults[tid];
      const numType = dmg.damage === 0 ? DamageNumberType.IMMUNE
        : dmg.isCritical ? DamageNumberType.CRITICAL : DamageNumberType.NORMAL;

      results.push({
        number: this.damageNumbers.createDamageNumber(numType, dmg.damage, tid, timestamp),
        actionId: action.actorId,
        triggerShake: dmg.isCritical,
        shakeIntensity: dmg.isCritical ? 0.15 : 0,
        delayMs: i * 80,
        isCombo: false,
      });
    }

    this.damageAnimations.push(...results);
    return results;
  }

  /** 生成治疗动画 */
  generateHealAnimation(healerId: string, targetId: string, amount: number, ts = Date.now()): DamageAnimationData {
    const data: DamageAnimationData = {
      number: this.damageNumbers.spawnHeal(amount, targetId, ts),
      actionId: healerId, triggerShake: false, shakeIntensity: 0, delayMs: 0, isCombo: false,
    };
    this.damageAnimations.push(data);
    return data;
  }

  /** 生成 DOT 动画 */
  generateDotAnimation(targetId: string, dmg: number, ts = Date.now()): DamageAnimationData {
    const data: DamageAnimationData = {
      number: this.damageNumbers.spawnDOT(dmg, targetId, ts),
      actionId: null, triggerShake: false, shakeIntensity: 0, delayMs: 0, isCombo: false,
    };
    this.damageAnimations.push(data);
    return data;
  }

  getDamageAnimations(): DamageAnimationData[] { return [...this.damageAnimations]; }

  cleanupAnimations(currentTime: number): void {
    this.damageAnimations = this.damageAnimations.filter(a => (currentTime - a.number.createdAt) < 2500);
    this.damageNumbers.update(currentTime);
  }

  // ─────────────────────────────────────────
  // #4 手机端战斗全屏布局
  // ─────────────────────────────────────────

  /** 根据屏幕尺寸获取适配布局配置 */
  getMobileLayout(screenWidth: number, screenHeight: number): MobileLayoutConfig {
    const sc: ScreenClass = screenWidth <= 375 ? 'small' : screenWidth <= 428 ? 'medium' : 'large';
    const preset = SCREEN_PRESETS[sc];
    this.layoutConfig = { ...preset, screenClass: sc, canvasWidth: screenWidth, canvasHeight: screenHeight };
    return { ...this.layoutConfig };
  }

  /** 获取技能按钮的触摸区域布局 */
  getSkillButtonLayout(count: number): Array<{ x: number; y: number; width: number; height: number }> {
    const c = this.layoutConfig;
    const total = count * c.skillButtonSize + (count - 1) * c.skillButtonGap;
    const startX = (c.canvasWidth - total) / 2;
    const y = c.canvasHeight - c.skillBarOffsetY;
    return Array.from({ length: count }, (_, i) => ({
      x: startX + i * (c.skillButtonSize + c.skillButtonGap) - c.touchPadding,
      y: y - c.touchPadding,
      width: c.skillButtonSize + c.touchPadding * 2,
      height: c.skillButtonSize + c.touchPadding * 2,
    }));
  }

  getLayoutConfig(): Readonly<MobileLayoutConfig> { return { ...this.layoutConfig }; }

  // ─────────────────────────────────────────
  // 战斗速度 & 生命周期
  // ─────────────────────────────────────────

  setBattleSpeed(speed: BattleSpeed): void { this.battleSpeed = speed; }
  getBattleSpeed(): BattleSpeed { return this.battleSpeed; }

  clear(): void {
    this.activeEffects = [];
    this.damageAnimations = [];
    this.damageNumbers.clear();
  }

  update(currentTime: number): void {
    this.cleanupEffects(currentTime);
    this.cleanupAnimations(currentTime);
  }

  private trimEffects(): void {
    while (this.activeEffects.length > this.layoutConfig.maxActiveEffects) this.activeEffects.shift();
  }
}
