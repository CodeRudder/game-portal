/**
 * DamageCalculator 单元测试
 *
 * 覆盖伤害计算管道的所有分支：
 * - 基础伤害计算
 * - 防御减伤
 * - 暴击判定
 * - 闪避判定
 * - 元素克制
 * - 边界值
 */

import { describe, it, expect, vi } from 'vitest';
import {
  calculateDamage,
  getElementEffectiveness,
  getEffectivenessMultiplier,
  type DamageContext,
} from '../../modules/battle/DamageCalculator';

// ============================================================
// 测试数据工厂
// ============================================================

/** 创建默认伤害上下文 */
function createContext(overrides: Partial<DamageContext> = {}): DamageContext {
  return {
    attackerAttack: 100,
    defenderDefense: 20,
    attackerCritRate: 0,
    attackerCritMultiplier: 1.5,
    defenderEvasion: 0,
    ...overrides,
  };
}

// ============================================================
// 测试套件
// ============================================================

describe('DamageCalculator', () => {

  // ============================================================
  // getElementEffectiveness
  // ============================================================

  describe('getElementEffectiveness', () => {
    it('fire 克制 ice → super', () => {
      expect(getElementEffectiveness('fire', 'ice')).toBe('super');
    });

    it('ice 克制 thunder → super', () => {
      expect(getElementEffectiveness('ice', 'thunder')).toBe('super');
    });

    it('thunder 克制 fire → super', () => {
      expect(getElementEffectiveness('thunder', 'fire')).toBe('super');
    });

    it('fire 被 thunder 克制 → weak', () => {
      expect(getElementEffectiveness('fire', 'thunder')).toBe('weak');
    });

    it('ice 被 fire 克制 → weak', () => {
      expect(getElementEffectiveness('ice', 'fire')).toBe('weak');
    });

    it('thunder 被 ice 克制 → weak', () => {
      expect(getElementEffectiveness('thunder', 'ice')).toBe('weak');
    });

    it('相同元素 → normal', () => {
      expect(getElementEffectiveness('fire', 'fire')).toBe('normal');
      expect(getElementEffectiveness('ice', 'ice')).toBe('normal');
    });

    it('normal 属性无克制 → normal', () => {
      expect(getElementEffectiveness('normal', 'fire')).toBe('normal');
      expect(getElementEffectiveness('fire', 'normal')).toBe('normal');
    });

    it('undefined 元素 → normal', () => {
      expect(getElementEffectiveness(undefined, 'fire')).toBe('normal');
      expect(getElementEffectiveness('fire', undefined)).toBe('normal');
      expect(getElementEffectiveness(undefined, undefined)).toBe('normal');
    });

    it('未知元素之间 → normal', () => {
      expect(getElementEffectiveness('dark', 'light')).toBe('normal');
    });
  });

  // ============================================================
  // getEffectivenessMultiplier
  // ============================================================

  describe('getEffectivenessMultiplier', () => {
    it('super → 1.5', () => {
      expect(getEffectivenessMultiplier('super')).toBe(1.5);
    });

    it('weak → 0.5', () => {
      expect(getEffectivenessMultiplier('weak')).toBe(0.5);
    });

    it('normal → 1.0', () => {
      expect(getEffectivenessMultiplier('normal')).toBe(1.0);
    });
  });

  // ============================================================
  // calculateDamage — 基础伤害
  // ============================================================

  describe('calculateDamage — 基础伤害', () => {
    it('应使用 attackerAttack 作为基础伤害', () => {
      const ctx = createContext({ attackerAttack: 100, defenderDefense: 0 });
      const result = calculateDamage(ctx);
      expect(result.finalDamage).toBe(100);
      expect(result.isMiss).toBe(false);
    });

    it('应优先使用 skillDamage 而非 attackerAttack', () => {
      const ctx = createContext({ attackerAttack: 100, skillDamage: 200, defenderDefense: 0 });
      const result = calculateDamage(ctx);
      expect(result.finalDamage).toBe(200);
    });

    it('skillDamage 为 0 时应使用 skillDamage', () => {
      const ctx = createContext({ attackerAttack: 100, skillDamage: 0, defenderDefense: 0 });
      // skillDamage=0 被显式设置，优先使用，基础伤害为 0
      // 防御减伤：max(1, 0 - 0) = 1
      const result = calculateDamage(ctx);
      expect(result.finalDamage).toBe(1);
    });
  });

  // ============================================================
  // calculateDamage — 防御减伤
  // ============================================================

  describe('calculateDamage — 防御减伤', () => {
    it('防御减伤公式：max(1, baseDmg - defense * 0.5)', () => {
      const ctx = createContext({ attackerAttack: 100, defenderDefense: 20 });
      const result = calculateDamage(ctx);
      // 100 - 20*0.5 = 90
      expect(result.finalDamage).toBe(90);
    });

    it('高防御时伤害至少为 1', () => {
      const ctx = createContext({ attackerAttack: 5, defenderDefense: 100 });
      const result = calculateDamage(ctx);
      // max(1, 5 - 50) = 1
      expect(result.finalDamage).toBeGreaterThanOrEqual(1);
    });

    it('0 防御时伤害等于攻击力', () => {
      const ctx = createContext({ attackerAttack: 80, defenderDefense: 0 });
      const result = calculateDamage(ctx);
      expect(result.finalDamage).toBe(80);
    });
  });

  // ============================================================
  // calculateDamage — 暴击
  // ============================================================

  describe('calculateDamage — 暴击', () => {
    it('100% 暴击率应触发暴击', () => {
      // Mock Math.random to return 0 for crit check (always crit)
      const randomSpy = vi.spyOn(Math, 'random');
      // 闪避检查: random() >= 0 → 不闪避
      // 暴击检查: random() < 1.0 → 暴击
      randomSpy.mockReturnValue(0.5);
      const ctx = createContext({ attackerCritRate: 1.0, attackerCritMultiplier: 2.0, defenderDefense: 0 });
      const result = calculateDamage(ctx);
      expect(result.isCrit).toBe(true);
      expect(result.finalDamage).toBe(200); // 100 * 2.0
      randomSpy.mockRestore();
    });

    it('0% 暴击率不应触发暴击', () => {
      const ctx = createContext({ attackerCritRate: 0, defenderDefense: 0 });
      const result = calculateDamage(ctx);
      expect(result.isCrit).toBe(false);
    });

    it('暴击倍率应正确应用', () => {
      const randomSpy = vi.spyOn(Math, 'random');
      randomSpy.mockReturnValue(0.5); // 不闪避，触发暴击
      const ctx = createContext({
        attackerAttack: 100,
        attackerCritRate: 1.0,
        attackerCritMultiplier: 1.5,
        defenderDefense: 0,
      });
      const result = calculateDamage(ctx);
      expect(result.finalDamage).toBe(150);
      randomSpy.mockRestore();
    });
  });

  // ============================================================
  // calculateDamage — 闪避
  // ============================================================

  describe('calculateDamage — 闪避', () => {
    it('100% 闪避率应完全闪避', () => {
      const randomSpy = vi.spyOn(Math, 'random');
      randomSpy.mockReturnValue(0); // < 1.0 → 闪避
      const ctx = createContext({ defenderEvasion: 1.0 });
      const result = calculateDamage(ctx);
      expect(result.isMiss).toBe(true);
      expect(result.finalDamage).toBe(0);
      randomSpy.mockRestore();
    });

    it('0% 闪避率不应闪避', () => {
      const ctx = createContext({ defenderEvasion: 0 });
      const result = calculateDamage(ctx);
      expect(result.isMiss).toBe(false);
    });

    it('闪避时不应触发暴击', () => {
      const randomSpy = vi.spyOn(Math, 'random');
      randomSpy.mockReturnValue(0); // 闪避
      const ctx = createContext({ defenderEvasion: 1.0, attackerCritRate: 1.0 });
      const result = calculateDamage(ctx);
      expect(result.isMiss).toBe(true);
      expect(result.isCrit).toBe(false);
      randomSpy.mockRestore();
    });
  });

  // ============================================================
  // calculateDamage — 元素克制
  // ============================================================

  describe('calculateDamage — 元素克制', () => {
    it('克制时应造成 1.5 倍伤害', () => {
      const randomSpy = vi.spyOn(Math, 'random');
      randomSpy.mockReturnValue(0.5); // 不闪避，不暴击
      const ctx = createContext({
        attackerAttack: 100,
        attackerElement: 'fire',
        defenderElement: 'ice',
        defenderDefense: 0,
      });
      const result = calculateDamage(ctx);
      expect(result.effectiveness).toBe('super');
      expect(result.finalDamage).toBe(150); // 100 * 1.5
      randomSpy.mockRestore();
    });

    it('被克制时应造成 0.5 倍伤害', () => {
      const randomSpy = vi.spyOn(Math, 'random');
      randomSpy.mockReturnValue(0.5);
      const ctx = createContext({
        attackerAttack: 100,
        attackerElement: 'fire',
        defenderElement: 'thunder',
        defenderDefense: 0,
      });
      const result = calculateDamage(ctx);
      expect(result.effectiveness).toBe('weak');
      expect(result.finalDamage).toBe(50); // Math.floor(100 * 0.5)
      randomSpy.mockRestore();
    });

    it('无克制时应造成正常伤害', () => {
      const ctx = createContext({
        attackerAttack: 100,
        attackerElement: 'fire',
        defenderElement: 'fire',
        defenderDefense: 0,
      });
      const result = calculateDamage(ctx);
      expect(result.effectiveness).toBe('normal');
      expect(result.finalDamage).toBe(100);
    });
  });

  // ============================================================
  // calculateDamage — 边界值
  // ============================================================

  describe('calculateDamage — 边界值', () => {
    it('0 攻击力 + 0 防御 → 伤害为 1', () => {
      const ctx = createContext({ attackerAttack: 0, defenderDefense: 0 });
      const result = calculateDamage(ctx);
      // max(1, 0 - 0) = 1 → floor(1) = 1
      expect(result.finalDamage).toBeGreaterThanOrEqual(1);
    });

    it('0 攻击力 + 高防御 → 伤害为 1', () => {
      const ctx = createContext({ attackerAttack: 0, defenderDefense: 999 });
      const result = calculateDamage(ctx);
      expect(result.finalDamage).toBeGreaterThanOrEqual(1);
    });

    it('极高攻击力应正常计算', () => {
      const ctx = createContext({ attackerAttack: 99999, defenderDefense: 0 });
      const result = calculateDamage(ctx);
      expect(result.finalDamage).toBe(99999);
    });

    it('克制 + 暴击应叠加', () => {
      const randomSpy = vi.spyOn(Math, 'random');
      randomSpy.mockReturnValue(0.5); // 不闪避，触发暴击
      const ctx = createContext({
        attackerAttack: 100,
        attackerCritRate: 1.0,
        attackerCritMultiplier: 2.0,
        attackerElement: 'fire',
        defenderElement: 'ice',
        defenderDefense: 0,
      });
      const result = calculateDamage(ctx);
      // 100 * 1.5 (克制) * 2.0 (暴击) = 300
      expect(result.effectiveness).toBe('super');
      expect(result.isCrit).toBe(true);
      expect(result.finalDamage).toBe(300);
      randomSpy.mockRestore();
    });

    it('被克制 + 高防御应产生低伤害', () => {
      const randomSpy = vi.spyOn(Math, 'random');
      randomSpy.mockReturnValue(0.5);
      const ctx = createContext({
        attackerAttack: 10,
        defenderDefense: 10,
        attackerElement: 'ice',
        defenderElement: 'fire',
      });
      const result = calculateDamage(ctx);
      // max(1, 10 - 5) = 5 → 5 * 0.5 = 2.5 → floor = 2
      expect(result.finalDamage).toBe(2);
      randomSpy.mockRestore();
    });
  });
});
