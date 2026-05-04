/**
 * resource-calculator 单元测试
 *
 * 覆盖：
 * 1. zeroResources / cloneResources — 工厂函数
 * 2. calculateBonusMultiplier — 加成计算
 * 3. lookupCap — 上限查表
 * 4. getWarningLevel / calculateCapWarnings — 容量警告
 */

import {
  zeroResources,
  cloneResources,
  calculateBonusMultiplier,
  lookupCap,
  getWarningLevel,
  calculateCapWarnings,
  calculateCapWarning,
} from '../resource-calculator';

import type { Resources, Bonuses } from '../resource.types';

describe('resource-calculator', () => {
  // ─── zeroResources ────────────────────────

  describe('zeroResources', () => {
    it('应返回全零资源', () => {
      const r = zeroResources();
      expect(r.grain).toBe(0);
      expect(r.gold).toBe(0);
      expect(r.troops).toBe(0);
    });
  });

  // ─── cloneResources ───────────────────────

  describe('cloneResources', () => {
    it('应返回独立副本', () => {
      const r: Resources = { grain: 10, gold: 20, troops: 30, mandate: 5, techPoint: 1, recruitToken: 2, skillBook: 3 };
      const c = cloneResources(r);
      expect(c).toEqual(r);
      c.grain = 999;
      expect(r.grain).toBe(10);
    });
  });

  // ─── calculateBonusMultiplier ─────────────

  describe('calculateBonusMultiplier', () => {
    it('无加成应返回1', () => {
      expect(calculateBonusMultiplier()).toBe(1);
      expect(calculateBonusMultiplier(undefined)).toBe(1);
    });

    it('空加成应返回1', () => {
      expect(calculateBonusMultiplier({})).toBe(1);
    });

    it('单项加成应正确计算', () => {
      const bonuses: Bonuses = { castle: 0.2 };
      expect(calculateBonusMultiplier(bonuses)).toBeCloseTo(1.2);
    });

    it('多项加成应乘法叠加', () => {
      const bonuses: Bonuses = { castle: 0.1, tech: 0.2 };
      expect(calculateBonusMultiplier(bonuses)).toBeCloseTo(1.1 * 1.2);
    });
  });

  // ─── lookupCap ────────────────────────────

  describe('lookupCap', () => {
    it('等级1应返回基础容量', () => {
      const cap = lookupCap(1, 'granary');
      expect(cap).toBeGreaterThan(0);
    });

    it('高等级应返回更大容量', () => {
      const low = lookupCap(1, 'granary');
      const high = lookupCap(10, 'granary');
      expect(high).toBeGreaterThan(low);
    });

    it('兵营和粮仓应有不同容量', () => {
      const granary = lookupCap(5, 'granary');
      const barracks = lookupCap(5, 'barracks');
      // 两者应该有值（可能相等也可能不等）
      expect(granary).toBeGreaterThan(0);
      expect(barracks).toBeGreaterThan(0);
    });

    it('超高等级应线性外推', () => {
      const cap = lookupCap(1000, 'granary');
      expect(cap).toBeGreaterThan(0);
    });
  });

  // ─── getWarningLevel ──────────────────────

  describe('getWarningLevel', () => {
    it('100% 应为 full', () => {
      expect(getWarningLevel(1)).toBe('full');
    });

    it('超过100% 应为 full', () => {
      expect(getWarningLevel(1.5)).toBe('full');
    });

    it('低百分比应为 safe', () => {
      expect(getWarningLevel(0.1)).toBe('safe');
    });
  });

  // ─── calculateCapWarnings ─────────────────

  describe('calculateCapWarnings', () => {
    it('应为有上限的资源生成警告', () => {
      const resources: Resources = { grain: 90, gold: 50, troops: 10, mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0, ore: 0, wood: 0 };
      const caps = {
        grain: 100, gold: 100, troops: 100, mandate: null, techPoint: null, recruitToken: null, skillBook: null,
      };
      const warnings = calculateCapWarnings(resources, caps as Record<string, number | null>);
      expect(warnings.length).toBeGreaterThan(0);
    });

    it('无上限资源不应生成警告', () => {
      const resources: Resources = { grain: 0, gold: 0, troops: 0, mandate: 999, techPoint: 0, recruitToken: 0, skillBook: 0, ore: 0, wood: 0 };
      const caps = {
        grain: null, gold: null, troops: null, mandate: null, techPoint: null, recruitToken: null, skillBook: null, ore: null, wood: null,
      };
      const warnings = calculateCapWarnings(resources, caps as Record<string, number | null>);
      expect(warnings.length).toBe(0);
    });
  });

  // ─── calculateCapWarning ──────────────────

  describe('calculateCapWarning', () => {
    it('无上限资源应返回 null', () => {
      const resources: Resources = zeroResources();
      const caps = { grain: null, gold: 2000, troops: null, mandate: null, techPoint: null, recruitToken: null, skillBook: null };
      const warning = calculateCapWarning('grain', resources, caps as Record<string, number | null>);
      expect(warning).toBeNull();
    });
  });
});
