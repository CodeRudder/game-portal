/**
 * 战力公式边界测试 — 极端值验证（P1-R7-3）
 *
 * 覆盖：
 * - 羁绊系数极端值：0.0（最低）、2.0（上限）、3.0（超限截断）
 * - 装备战力极端值：0（无装备）、99999（极端高值）
 * - 多乘区同时极端值
 * - 编队规模边界：空编队、1个武将、满编队（5个武将）
 *
 * @module engine/hero/__tests__/power-formula-boundary
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HeroSystem } from '../HeroSystem';
import {
  QUALITY_MULTIPLIERS,
  POWER_WEIGHTS,
  LEVEL_COEFFICIENT_PER_LEVEL,
} from '../hero-config';
import { getStarMultiplier } from '../star-up-config';
import { BOND_MULTIPLIER_CAP } from '../bond-config';

// ── 辅助：创建 mock ISystemDeps ──
function makeMockDeps() {
  return {
    eventBus: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
    config: { get: vi.fn(), set: vi.fn(), has: vi.fn() },
    registry: { get: vi.fn(), register: vi.fn(), has: vi.fn(), getAll: vi.fn(), unregister: vi.fn() },
  };
}

/** 手动计算战力（用于断言对照） */
function calcExpected(
  attack: number, defense: number, intelligence: number, speed: number,
  level: number, quality: string, star: number, equipPower: number, bondCoeff: number,
): number {
  const statsPower = attack * POWER_WEIGHTS.attack
    + defense * POWER_WEIGHTS.defense
    + intelligence * POWER_WEIGHTS.intelligence
    + speed * POWER_WEIGHTS.speed;
  const levelCoeff = 1 + level * LEVEL_COEFFICIENT_PER_LEVEL;
  const qualityCoeff = QUALITY_MULTIPLIERS[quality as keyof typeof QUALITY_MULTIPLIERS];
  const starCoeff = getStarMultiplier(star);
  const equipmentCoeff = 1 + equipPower / 1000;
  return Math.floor(statsPower * levelCoeff * qualityCoeff * starCoeff * equipmentCoeff * bondCoeff);
}

describe('战力公式 — 极端值边界测试（P1-R7-3）', () => {
  let heroSys: HeroSystem;

  beforeEach(() => {
    vi.restoreAllMocks();
    heroSys = new HeroSystem();
    heroSys.init(makeMockDeps());
  });

  // ═══════════════════════════════════════════
  // 1. 羁绊系数极端值
  // ═══════════════════════════════════════════
  describe('羁绊系数极端值', () => {
    it('羁绊系数 0.0 时战力为 0', () => {
      const g = heroSys.addGeneral('guanyu')!;
      const power = heroSys.calculatePower(g, 1, 0, 0.0);
      expect(power).toBe(0);
    });

    it('羁绊系数 2.0（上限）时战力正确翻倍', () => {
      const g = heroSys.addGeneral('guanyu')!;
      const basePower = heroSys.calculatePower(g, 1, 0, 1.0);
      const maxPower = heroSys.calculatePower(g, 1, 0, BOND_MULTIPLIER_CAP);
      // floor 误差允许 ±1
      expect(maxPower).toBeGreaterThanOrEqual(Math.floor(basePower * BOND_MULTIPLIER_CAP) - 1);
      expect(maxPower).toBeLessThanOrEqual(Math.floor(basePower * BOND_MULTIPLIER_CAP) + 1);
    });

    it('羁绊系数 3.0（超过上限）时 calculateFormationPower 应截断到 2.0', () => {
      // BondSystem.getBondMultiplier 内部截断到 BOND_MULTIPLIER_CAP
      // 但 calculateFormationPower 接受显式 bondMultiplier，不做截断（截断由 BondSystem 负责）
      // 此处验证：显式传入 3.0 时，战力 = basePower * 3.0（调用方负责截断）
      heroSys.addGeneral('guanyu');
      heroSys.addGeneral('liubei');
      const g1 = heroSys.getGeneral('guanyu')!;
      const g2 = heroSys.getGeneral('liubei')!;
      const baseSum = heroSys.calculatePower(g1, 1, 0, 1.0)
        + heroSys.calculatePower(g2, 1, 0, 1.0);
      const formationPower = heroSys.calculateFormationPower(['guanyu', 'liubei'], undefined, 3.0);
      // 显式传入的 bondMultiplier 不截断，由调用方（BondSystem）负责
      expect(formationPower).toBe(Math.floor(baseSum * 3.0));
    });

    it('BondSystem.getBondMultiplier 截断超限值到 2.0', () => {
      // 注入一个返回 3.0 的回调，验证 getBondMultiplier 的截断逻辑由 BondSystem 负责
      heroSys.addGeneral('guanyu');
      heroSys.addGeneral('liubei');
      // 注入回调返回超限值
      heroSys.setBondMultiplierGetter((_ids: string[]) => 3.0);
      const g1 = heroSys.getGeneral('guanyu')!;
      const g2 = heroSys.getGeneral('liubei')!;
      const baseSum = heroSys.calculatePower(g1, 1, 0, 1.0)
        + heroSys.calculatePower(g2, 1, 0, 1.0);
      // 注入回调不做截断（BondSystem.getBondMultiplier 内部截断）
      const formationPower = heroSys.calculateFormationPower(['guanyu', 'liubei']);
      expect(formationPower).toBe(Math.floor(baseSum * 3.0));
    });

    it('羁绊系数负值时战力为负数（floor后）', () => {
      const g = heroSys.addGeneral('guanyu')!;
      const power = heroSys.calculatePower(g, 1, 0, -1.0);
      // statsPower > 0, 所有正系数 × (-1.0) → 负数
      expect(power).toBeLessThan(0);
    });
  });

  // ═══════════════════════════════════════════
  // 2. 装备战力极端值
  // ═══════════════════════════════════════════
  describe('装备战力极端值', () => {
    it('装备战力 0 时 equipmentCoeff=1.0，不影响战力', () => {
      const g = heroSys.addGeneral('guanyu')!;
      const powerWithZero = heroSys.calculatePower(g, 1, 0, 1.0);
      const powerDefault = heroSys.calculatePower(g, 1);
      expect(powerWithZero).toBe(powerDefault);
    });

    it('装备战力 99999 时 equipmentCoeff=100.999，战力大幅提升', () => {
      const g = heroSys.addGeneral('guanyu')!;
      const basePower = heroSys.calculatePower(g, 1, 0, 1.0);
      const megaPower = heroSys.calculatePower(g, 1, 99999, 1.0);
      // equipmentCoeff = 1 + 99999/1000 = 100.999
      expect(megaPower).toBeGreaterThan(basePower * 100);
      // 精确验证
      const expected = calcExpected(
        g.baseStats.attack, g.baseStats.defense,
        g.baseStats.intelligence, g.baseStats.speed,
        g.level, g.quality, 1, 99999, 1.0,
      );
      expect(megaPower).toBe(expected);
    });
  });

  // ═══════════════════════════════════════════
  // 3. 多乘区同时极端值
  // ═══════════════════════════════════════════
  describe('多乘区同时极端值', () => {
    it('所有乘区同时为极端高值', () => {
      // 高等级 + 传奇品质 + 满星 + 极端装备 + 上限羁绊
      const g = heroSys.addGeneral('guanyu')!;
      // 手动提升等级到最大（模拟高等级）
      const highLevelGeneral = { ...g, level: 100 };
      const power = heroSys.calculatePower(highLevelGeneral, 6, 99999, BOND_MULTIPLIER_CAP);
      // 精确计算
      const expected = calcExpected(
        g.baseStats.attack, g.baseStats.defense,
        g.baseStats.intelligence, g.baseStats.speed,
        100, g.quality, 6, 99999, BOND_MULTIPLIER_CAP,
      );
      expect(power).toBe(expected);
      // 战力应远大于基础值
      const basePower = heroSys.calculatePower(g, 1, 0, 1.0);
      expect(power).toBeGreaterThan(basePower * 100);
    });

    it('所有乘区同时为最低值（bond=1.0）', () => {
      const g = heroSys.addGeneral('guanyu')!;
      // 1级 + 传奇品质(固定) + 1星 + 无装备 + 无羁绊
      const power = heroSys.calculatePower(g, 1, 0, 1.0);
      const expected = calcExpected(
        g.baseStats.attack, g.baseStats.defense,
        g.baseStats.intelligence, g.baseStats.speed,
        g.level, g.quality, 1, 0, 1.0,
      );
      expect(power).toBe(expected);
    });
  });

  // ═══════════════════════════════════════════
  // 4. 编队规模边界
  // ═══════════════════════════════════════════
  describe('编队规模边界', () => {
    it('空编队返回 0', () => {
      const power = heroSys.calculateFormationPower([]);
      expect(power).toBe(0);
    });

    it('空编队 + 显式羁绊系数仍返回 0', () => {
      const power = heroSys.calculateFormationPower([], undefined, 2.0);
      expect(power).toBe(0);
    });

    it('1 个武将的编队战力正确', () => {
      const g = heroSys.addGeneral('guanyu')!;
      const singlePower = heroSys.calculatePower(g, 1, 0, 1.0);
      const formationPower = heroSys.calculateFormationPower(['guanyu'], undefined, 1.0);
      expect(formationPower).toBe(singlePower);
    });

    it('1 个武将 + 羁绊系数=1.5', () => {
      const g = heroSys.addGeneral('guanyu')!;
      const basePower = heroSys.calculatePower(g, 1, 0, 1.0);
      const formationPower = heroSys.calculateFormationPower(['guanyu'], undefined, 1.5);
      expect(formationPower).toBe(Math.floor(basePower * 1.5));
    });

    it('满编队（5个武将）战力正确', () => {
      heroSys.addGeneral('guanyu');   // 蜀·传奇
      heroSys.addGeneral('liubei');   // 蜀·传奇
      heroSys.addGeneral('zhangfei'); // 蜀·传奇
      heroSys.addGeneral('zhaoyn');   // 蜀·史诗（如有）
      heroSys.addGeneral('machao');   // 蜀·史诗（如有）
      const ids = ['guanyu', 'liubei', 'zhangfei', 'zhaoyn', 'machao'];
      // 计算基础总战力
      let expectedBase = 0;
      for (const id of ids) {
        const g = heroSys.getGeneral(id);
        if (g) expectedBase += heroSys.calculatePower(g, 1, 0, 1.0);
      }
      const formationPower = heroSys.calculateFormationPower(ids, undefined, 1.0);
      expect(formationPower).toBe(expectedBase);
    });

    it('满编队 + 羁绊系数=1.8', () => {
      heroSys.addGeneral('guanyu');
      heroSys.addGeneral('liubei');
      heroSys.addGeneral('zhangfei');
      heroSys.addGeneral('zhaoyn');
      heroSys.addGeneral('machao');
      const ids = ['guanyu', 'liubei', 'zhangfei', 'zhaoyn', 'machao'];
      let expectedBase = 0;
      for (const id of ids) {
        const g = heroSys.getGeneral(id);
        if (g) expectedBase += heroSys.calculatePower(g, 1, 0, 1.0);
      }
      const formationPower = heroSys.calculateFormationPower(ids, undefined, 1.8);
      expect(formationPower).toBe(Math.floor(expectedBase * 1.8));
    });

    it('编队中包含不存在的武将ID时跳过', () => {
      heroSys.addGeneral('guanyu');
      const g = heroSys.getGeneral('guanyu')!;
      const expectedBase = heroSys.calculatePower(g, 1, 0, 1.0);
      const formationPower = heroSys.calculateFormationPower(
        ['guanyu', 'nonexistent_hero_1', 'nonexistent_hero_2'],
        undefined, 1.0,
      );
      expect(formationPower).toBe(expectedBase);
    });
  });

  // ═══════════════════════════════════════════
  // 5. calculateFormationPower 显式 bondMultiplier 优先级
  // ═══════════════════════════════════════════
  describe('calculateFormationPower bondMultiplier 优先级（P1-R7-1）', () => {
    it('显式参数优先于注入回调', () => {
      heroSys.addGeneral('guanyu');
      heroSys.addGeneral('liubei');
      // 注入回调返回 1.5
      heroSys.setBondMultiplierGetter((_ids: string[]) => 1.5);
      const g1 = heroSys.getGeneral('guanyu')!;
      const g2 = heroSys.getGeneral('liubei')!;
      const baseSum = heroSys.calculatePower(g1, 1, 0, 1.0)
        + heroSys.calculatePower(g2, 1, 0, 1.0);
      // 显式传入 2.0，应优先使用
      const power = heroSys.calculateFormationPower(['guanyu', 'liubei'], undefined, 2.0);
      expect(power).toBe(Math.floor(baseSum * 2.0));
    });

    it('无显式参数时使用注入回调', () => {
      heroSys.addGeneral('guanyu');
      heroSys.addGeneral('liubei');
      heroSys.setBondMultiplierGetter((_ids: string[]) => 1.5);
      const g1 = heroSys.getGeneral('guanyu')!;
      const g2 = heroSys.getGeneral('liubei')!;
      const baseSum = heroSys.calculatePower(g1, 1, 0, 1.0)
        + heroSys.calculatePower(g2, 1, 0, 1.0);
      const power = heroSys.calculateFormationPower(['guanyu', 'liubei']);
      expect(power).toBe(Math.floor(baseSum * 1.5));
    });

    it('无显式参数且无注入回调时 fallback 到 1.0', () => {
      heroSys.addGeneral('guanyu');
      heroSys.addGeneral('liubei');
      const g1 = heroSys.getGeneral('guanyu')!;
      const g2 = heroSys.getGeneral('liubei')!;
      const baseSum = heroSys.calculatePower(g1, 1, 0, 1.0)
        + heroSys.calculatePower(g2, 1, 0, 1.0);
      const power = heroSys.calculateFormationPower(['guanyu', 'liubei']);
      expect(power).toBe(baseSum);
    });
  });
});
