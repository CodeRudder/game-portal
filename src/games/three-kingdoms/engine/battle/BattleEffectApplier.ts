/**
 * 战斗系统 — 科技效果应用器
 *
 * 职责：
 * - 将军事科技加成应用到伤害计算
 * - 武技特效配置（纯数据，不涉及渲染）
 * - 暴击率/暴击伤害的科技加成
 * - 与 DamageCalculator 协同工作
 *
 * @module engine/battle/BattleEffectApplier
 */

import type { BattleUnit, DamageResult } from './battle.types';
import { TroopType } from './battle.types';
import type { TechEffectSystem, EffectCategory } from '../tech/TechEffectSystem';
import type { EffectElement, EffectTrigger } from './battle-effect-presets';
import type { ISubsystem, ISystemDeps } from '../../core/types';

// Re-export from the canonical definition in battle-effect-presets
export type { EffectElement, EffectTrigger } from './battle-effect-presets';

// ─────────────────────────────────────────────
// 1. 武技特效配置（纯数据）
// ─────────────────────────────────────────────

/** 武技特效配置 */
export interface SkillEffectConfig {
  /** 技能 ID */
  skillId: string;
  /** 技能名称 */
  skillName: string;
  /** 特效元素 */
  element: EffectElement;
  /** 粒子数量 */
  particleCount: number;
  /** 特效持续时间（ms） */
  duration: number;
  /** 触发时机 */
  trigger: EffectTrigger;
  /** 光效颜色（十六进制） */
  color: string;
  /** 特效缩放 */
  scale: number;
  /** 是否有屏幕震动 */
  screenShake: boolean;
  /** 震动强度（0~1） */
  shakeIntensity: number;
}

/** 预设武技特效配置表 */
const SKILL_EFFECT_PRESETS: SkillEffectConfig[] = [
  {
    skillId: 'fire_slash', skillName: '烈焰斩', element: 'fire',
    particleCount: 30, duration: 800, trigger: 'onSkillCast',
    color: '#FF4500', scale: 1.2, screenShake: true, shakeIntensity: 0.3,
  },
  {
    skillId: 'ice_blade', skillName: '寒冰刃', element: 'ice',
    particleCount: 25, duration: 700, trigger: 'onSkillCast',
    color: '#00BFFF', scale: 1.0, screenShake: false, shakeIntensity: 0,
  },
  {
    skillId: 'thunder_strike', skillName: '雷霆一击', element: 'thunder',
    particleCount: 40, duration: 1000, trigger: 'onCritical',
    color: '#FFD700', scale: 1.5, screenShake: true, shakeIntensity: 0.5,
  },
  {
    skillId: 'wind_slash', skillName: '疾风斩', element: 'wind',
    particleCount: 20, duration: 500, trigger: 'onHit',
    color: '#90EE90', scale: 0.8, screenShake: false, shakeIntensity: 0,
  },
  {
    skillId: 'earth_quake', skillName: '地裂斩', element: 'earth',
    particleCount: 35, duration: 900, trigger: 'onSkillCast',
    color: '#8B4513', scale: 1.3, screenShake: true, shakeIntensity: 0.4,
  },
  {
    skillId: 'holy_light', skillName: '圣光术', element: 'light',
    particleCount: 15, duration: 600, trigger: 'onHeal',
    color: '#FFFFE0', scale: 1.0, screenShake: false, shakeIntensity: 0,
  },
  {
    skillId: 'dark_blade', skillName: '暗影刃', element: 'dark',
    particleCount: 28, duration: 750, trigger: 'onSkillCast',
    color: '#4B0082', scale: 1.1, screenShake: true, shakeIntensity: 0.2,
  },
];

/** 按 skillId 索引的特效配置映射 */
const SKILL_EFFECT_MAP: ReadonlyMap<string, SkillEffectConfig> = new Map(
  SKILL_EFFECT_PRESETS.map((cfg) => [cfg.skillId, cfg]),
);

// ─────────────────────────────────────────────
// 2. 兵种到 target 的映射
// ─────────────────────────────────────────────

/** 兵种类型到科技效果 target 的映射 */
const TROOP_TYPE_TARGET_MAP: ReadonlyMap<TroopType, string> = new Map([
  [TroopType.CAVALRY, 'cavalry'],
  [TroopType.INFANTRY, 'infantry'],
  [TroopType.SPEARMAN, 'spearman'],
  [TroopType.ARCHER, 'archer'],
  [TroopType.STRATEGIST, 'strategist'],
]);

// ─────────────────────────────────────────────
// 3. 效果应用结果
// ─────────────────────────────────────────────

/** 科技加成应用到战斗单位后的增强属性 */
export interface EnhancedBattleStats {
  /** 增强后的攻击力 */
  enhancedAttack: number;
  /** 增强后的防御力 */
  enhancedDefense: number;
  /** 攻击力加成百分比 */
  attackBonusPercent: number;
  /** 防御力加成百分比 */
  defenseBonusPercent: number;
  /** 暴击率额外加成 */
  critRateBonus: number;
  /** 伤害额外加成百分比 */
  damageBonusPercent: number;
}

/** 增强后的伤害结果 */
export interface EnhancedDamageResult extends DamageResult {
  /** 科技攻击加成比例 */
  techAttackBonus: number;
  /** 科技防御加成比例 */
  techDefenseBonus: number;
  /** 科技伤害加成比例 */
  techDamageBonus: number;
  /** 最终增强伤害 */
  enhancedDamage: number;
}

// ─────────────────────────────────────────────
// 4. BattleEffectApplier
// ─────────────────────────────────────────────

/**
 * 战斗效果应用器
 *
 * 将科技系统中的军事科技加成应用到战斗伤害计算中。
 * 通过依赖注入 TechEffectSystem 获取科技加成数据。
 */
export class BattleEffectApplier implements ISubsystem {
  /** @inheritdoc */
  readonly name = 'battle-effect-applier';

  /** 科技效果系统引用 */
  private techEffect: TechEffectSystem | null = null;

  /** 武技特效配置表 */
  private skillEffects: ReadonlyMap<string, SkillEffectConfig>;

  /** 系统依赖 */
  private deps: ISystemDeps | null = null;

  constructor() {
    this.skillEffects = SKILL_EFFECT_MAP;
  }

  // ─── ISubsystem 接口 ───────────────────────

  /** @inheritdoc */
  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  /** @inheritdoc */
  update(_dt: number): void {
    // 效果应用器按需调用，不在 update 中自动执行
  }

  /** @inheritdoc */
  getState(): { techEffectBound: boolean; skillEffectCount: number } {
    return {
      techEffectBound: this.techEffect !== null,
      skillEffectCount: this.skillEffects.size,
    };
  }

  /** @inheritdoc */
  reset(): void {
    this.techEffect = null;
    this.skillEffects = SKILL_EFFECT_MAP;
    this.deps = null;
  }

  // ─────────────────────────────────────────
  // 依赖注入
  // ─────────────────────────────────────────

  /** 注入科技效果系统 */
  setTechEffectSystem(techEffect: TechEffectSystem): void {
    this.techEffect = techEffect;
  }

  // ─────────────────────────────────────────
  // 属性增强
  // ─────────────────────────────────────────

  /**
   * 计算战斗单位经过科技加成后的增强属性
   *
   * 会同时考虑「全军加成」和「兵种专属加成」
   *
   * @param unit - 战斗单位
   * @returns 增强后的属性
   */
  getEnhancedStats(unit: BattleUnit): EnhancedBattleStats {
    const target = TROOP_TYPE_TARGET_MAP.get(unit.troopType) ?? 'all';

    // 全军加成（target='all' 的效果）
    const allAtkBonus = this.getTechAttackBonusForAllOnly();
    const allDefBonus = this.getTechDefenseBonusForAllOnly();

    // 兵种专属加成（仅 target=具体兵种 的效果）
    const troopAtkBonus = target !== 'all' ? this.getTechTroopAttackBonus(target) : 0;
    const troopDefBonus = target !== 'all' ? this.getTechTroopDefenseBonus(target) : 0;

    // 合计加成
    const attackBonusPercent = allAtkBonus + troopAtkBonus;
    const defenseBonusPercent = allDefBonus + troopDefBonus;

    // 暴击和伤害加成（来自军事科技）
    const critRateBonus = 0; // 预留：暴击率科技加成
    const damageBonusPercent = 0; // 预留：伤害加成科技

    return {
      enhancedAttack: Math.floor(unit.baseAttack * (1 + attackBonusPercent / 100)),
      enhancedDefense: Math.floor(unit.baseDefense * (1 + defenseBonusPercent / 100)),
      attackBonusPercent,
      defenseBonusPercent,
      critRateBonus,
      damageBonusPercent,
    };
  }

  /**
   * 将科技加成应用到战斗单位的攻防属性
   *
   * 直接修改 unit 的 attack 和 defense 字段
   *
   * @param unit - 战斗单位
   */
  applyTechBonusesToUnit(unit: BattleUnit): void {
    const stats = this.getEnhancedStats(unit);
    unit.attack = stats.enhancedAttack;
    unit.defense = stats.enhancedDefense;
  }

  /**
   * 批量应用科技加成到队伍所有单位
   *
   * @param units - 战斗单位数组
   */
  applyTechBonusesToTeam(units: BattleUnit[]): void {
    for (const unit of units) {
      this.applyTechBonusesToUnit(unit);
    }
  }

  // ─────────────────────────────────────────
  // 伤害增强
  // ─────────────────────────────────────────

  /**
   * 对已有伤害结果应用科技伤害加成
   *
   * @param result - 原始伤害结果
   * @param attacker - 攻击方
   * @returns 增强后的伤害结果
   */
  enhanceDamageResult(result: DamageResult, attacker: BattleUnit): EnhancedDamageResult {
    const target = TROOP_TYPE_TARGET_MAP.get(attacker.troopType) ?? 'all';
    const techAttackBonus = this.getTechAttackBonus(target);
    const techDefenseBonus = 0; // 防御加成已在 getEnhancedStats 中处理
    const techDamageBonus = 0; // 预留

    // 科技加成乘数
    const techMultiplier = 1 + techAttackBonus / 100;
    const enhancedDamage = Math.floor(result.damage * techMultiplier);

    return {
      ...result,
      techAttackBonus,
      techDefenseBonus,
      techDamageBonus,
      enhancedDamage,
    };
  }

  // ─────────────────────────────────────────
  // 武技特效查询
  // ─────────────────────────────────────────

  /**
   * 获取技能的特效配置
   *
   * @param skillId - 技能 ID
   * @returns 特效配置，不存在则返回 null
   */
  getSkillEffect(skillId: string): SkillEffectConfig | null {
    return this.skillEffects.get(skillId) ?? null;
  }

  /** 获取所有预设特效配置 */
  getAllSkillEffects(): SkillEffectConfig[] {
    return [...this.skillEffects.values()];
  }

  /**
   * 注册自定义武技特效
   *
   * @param config - 特效配置
   */
  registerSkillEffect(config: SkillEffectConfig): void {
    const mutableMap = new Map(this.skillEffects);
    mutableMap.set(config.skillId, config);
    this.skillEffects = mutableMap;
  }

  // ─────────────────────────────────────────
  // 内部方法
  // ─────────────────────────────────────────

  /** 获取科技攻击加成 */
  private getTechAttackBonus(target: string): number {
    if (!this.techEffect) return 0;
    return this.techEffect.getAttackBonus(target);
  }

  /** 获取科技防御加成 */
  private getTechDefenseBonus(target: string): number {
    if (!this.techEffect) return 0;
    return this.techEffect.getDefenseBonus(target);
  }

  /** 获取仅 target='all' 的攻击加成（不含兵种专属） */
  private getTechAttackBonusForAllOnly(): number {
    if (!this.techEffect) return 0;
    // getEffectValueByTarget 匹配 target='all' 的效果
    return this.techEffect.getEffectValueByTarget('troop_attack' as const, 'all');
  }

  /** 获取仅 target='all' 的防御加成 */
  private getTechDefenseBonusForAllOnly(): number {
    if (!this.techEffect) return 0;
    return this.techEffect.getEffectValueByTarget('troop_defense' as const, 'all');
  }

  /** 获取兵种专属攻击加成（不含 all） */
  private getTechTroopAttackBonus(troop: string): number {
    if (!this.techEffect) return 0;
    // 直接查询 TechTreeSystem 获取仅匹配该兵种的效果
    return this.techEffect.getEffectValueByTarget('troop_attack' as const, troop)
      - this.getTechAttackBonusForAllOnly();
  }

  /** 获取兵种专属防御加成（不含 all） */
  private getTechTroopDefenseBonus(troop: string): number {
    if (!this.techEffect) return 0;
    return this.techEffect.getEffectValueByTarget('troop_defense' as const, troop)
      - this.getTechDefenseBonusForAllOnly();
  }
}
