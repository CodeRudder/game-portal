/**
 * R23-2: 战力计算公式边界条件覆盖
 *
 * 覆盖场景：
 * - 空编队战力
 * - 单武将战力
 * - 羁绊加成溢出
 * - 极端等级/属性
 * - 品质倍率
 */

import { describe, it, expect } from 'vitest';
import { HeroSystem } from '../HeroSystem';
import type { GeneralData } from '../hero.types';
import { QUALITY_MULTIPLIERS, POWER_WEIGHTS, LEVEL_COEFFICIENT_PER_LEVEL } from '../hero-config';
import { vi } from 'vitest';

function createMockDeps() {
  return {
    eventBus: { on: vi.fn(), once: vi.fn(), emit: vi.fn(), off: vi.fn(), removeAllListeners: vi.fn() },
    config: { get: vi.fn(), set: vi.fn(), has: vi.fn(() => false) },
    registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(() => new Map()), has: vi.fn(() => false), unregister: vi.fn() },
  };
}

describe('R23-2: 战力计算公式边界条件', () => {
  let hs: HeroSystem;
  beforeEach(() => {
    hs = new HeroSystem();
    hs.init(createMockDeps());
  });

  // ═══════════════════════════════════════════
  // 空编队战力
  // ═══════════════════════════════════════════
  describe('空编队战力', () => {
    it('无武将时总战力为 0', () => {
      expect(hs.calculateTotalPower()).toBe(0);
    });

    it('空编队 calculateFormationPower 返回 0', () => {
      expect(hs.calculateFormationPower([])).toBe(0);
    });
  });

  // ═══════════════════════════════════════════
  // 单武将战力
  // ═══════════════════════════════════════════
  describe('单武将战力', () => {
    it('Lv1 武将战力 = 属性加权和 × 等级系数(1.05) × 品质系数', () => {
      hs.addGeneral('liubei');
      const g = hs.getGeneral('liubei')!;
      const power = hs.calculatePower(g);

      // 手动计算
      const { attack, defense, intelligence, speed } = g.baseStats;
      const statsPower = attack * POWER_WEIGHTS.attack
        + defense * POWER_WEIGHTS.defense
        + intelligence * POWER_WEIGHTS.intelligence
        + speed * POWER_WEIGHTS.speed;
      const levelCoeff = 1 + 1 * LEVEL_COEFFICIENT_PER_LEVEL; // Lv1: 1 + 0.05 = 1.05
      const qualityCoeff = QUALITY_MULTIPLIERS[g.quality];
      const expected = Math.floor(statsPower * levelCoeff * qualityCoeff * 1.0 * 1.0); // star=1, equip=0

      expect(power).toBe(expected);
    });

    it('不同品质武将战力差异显著', () => {
      // 添加不同品质武将
      hs.addGeneral('dianwei'); // RARE
      hs.addGeneral('zhangfei'); // EPIC
      hs.addGeneral('guanyu'); // LEGENDARY

      const rarePower = hs.calculatePower(hs.getGeneral('dianwei')!);
      const epicPower = hs.calculatePower(hs.getGeneral('zhangfei')!);
      const legendaryPower = hs.calculatePower(hs.getGeneral('guanyu')!);

      // 同等级下，品质越高战力越高（属性也更高，但品质系数也更高）
      expect(legendaryPower).toBeGreaterThan(rarePower);
    });
  });

  // ═══════════════════════════════════════════
  // 羁绊加成溢出
  // ═══════════════════════════════════════════
  describe('羁绊加成', () => {
    it('显式羁绊系数 1.0 等于无羁绊', () => {
      hs.addGeneral('liubei');
      const g = hs.getGeneral('liubei')!;
      const noBond = hs.calculatePower(g, 1, 0, 1.0);
      const defaultBond = hs.calculatePower(g, 1, 0);
      expect(noBond).toBe(defaultBond);
    });

    it('羁绊系数 2.0（最大）战力翻倍', () => {
      hs.addGeneral('liubei');
      const g = hs.getGeneral('liubei')!;
      const normal = hs.calculatePower(g, 1, 0, 1.0);
      const doubled = hs.calculatePower(g, 1, 0, 2.0);
      expect(doubled).toBe(normal * 2);
    });

    it('羁绊系数 0 不使战力为负', () => {
      hs.addGeneral('liubei');
      const g = hs.getGeneral('liubei')!;
      const power = hs.calculatePower(g, 1, 0, 0);
      expect(power).toBe(0);
    });

    it('calculateFormationPower 使用羁绊系数', () => {
      hs.addGeneral('liubei');
      hs.addGeneral('guanyu');
      const normal = hs.calculateFormationPower(['liubei', 'guanyu'], () => 1, 1.0);
      const doubled = hs.calculateFormationPower(['liubei', 'guanyu'], () => 1, 2.0);
      expect(doubled).toBe(normal * 2);
    });
  });

  // ═══════════════════════════════════════════
  // 装备战力
  // ═══════════════════════════════════════════
  describe('装备战力', () => {
    it('装备战力 0 时装备系数为 1.0', () => {
      hs.addGeneral('liubei');
      const g = hs.getGeneral('liubei')!;
      const power = hs.calculatePower(g, 1, 0);
      const noEquip = hs.calculatePower(g, 1, 0, 1.0);
      expect(power).toBe(noEquip);
    });

    it('装备战力 1000 时装备系数为 2.0', () => {
      hs.addGeneral('liubei');
      const g = hs.getGeneral('liubei')!;
      const normal = hs.calculatePower(g, 1, 0);
      const withEquip = hs.calculatePower(g, 1, 1000);
      expect(withEquip).toBe(Math.floor(normal * 2)); // 1 + 1000/1000 = 2
    });
  });

  // ═══════════════════════════════════════════
  // 极端属性
  // ═══════════════════════════════════════════
  describe('极端属性', () => {
    it('全零属性武将战力为 0', () => {
      const zeroGeneral: GeneralData = {
        id: 'zero',
        name: 'ZeroHero',
        quality: 'COMMON' as any, // 使用枚举大写值
        baseStats: { attack: 0, defense: 0, intelligence: 0, speed: 0 },
        level: 1,
        exp: 0,
        faction: 'shu',
        skills: [],
      };
      const power = hs.calculatePower(zeroGeneral);
      // 全零属性: 0*2 + 0*1.5 + 0*2 + 0*1 = 0 → Math.floor(0) = 0
      expect(power).toBe(0);
    });

    it('极高属性武将战力不溢出 Number.MAX_SAFE_INTEGER', () => {
      const godGeneral: GeneralData = {
        id: 'god',
        name: 'GodHero',
        quality: 'LEGENDARY' as any,
        baseStats: { attack: 99999, defense: 99999, intelligence: 99999, speed: 99999 },
        level: 100,
        exp: 0,
        faction: 'shu',
        skills: [],
      };
      const power = hs.calculatePower(godGeneral, 6, 99999, 2.0);
      expect(power).toBeGreaterThan(0);
      expect(isFinite(power)).toBe(true);
      expect(power).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER);
    });
  });

  // ═══════════════════════════════════════════
  // 星级系数
  // ═══════════════════════════════════════════
  describe('星级系数', () => {
    it('1星和6星战力差异显著', () => {
      hs.addGeneral('liubei');
      const g = hs.getGeneral('liubei')!;
      const star1 = hs.calculatePower(g, 1);
      const star6 = hs.calculatePower(g, 6);
      expect(star6).toBeGreaterThan(star1);
    });
  });
});
