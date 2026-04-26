/**
 * 战力公式测试 — 羁绊系数 + 装备系数集成验证
 *
 * 覆盖：
 * - P0-R6-1: 羁绊系数作为第5乘区集成到 calculatePower
 * - 遗留P0: 装备系数集成验证
 * - 向后兼容：无羁绊时系数=1.0，不影响现有战力
 * - BondSystem 模块导出验证
 *
 * @module engine/hero/__tests__/power-formula-bond-equip
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HeroSystem } from '../HeroSystem';
import { BondSystem } from '../BondSystem';
import type { BondSystemDeps, GeneralMeta } from '../BondSystem';
import {
  BondSystem as BondSystemFromIndex,
} from '../index';
import {
  QUALITY_MULTIPLIERS,
  POWER_WEIGHTS,
  LEVEL_COEFFICIENT_PER_LEVEL,
} from '../hero-config';
import { getStarMultiplier } from '../star-up-config';
import { Quality } from '../hero.types';

// ── 辅助：创建 mock ISystemDeps ──
function makeMockDeps() {
  return {
    eventBus: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
    config: { get: vi.fn(), set: vi.fn(), has: vi.fn() },
    registry: { get: vi.fn(), register: vi.fn(), has: vi.fn(), getAll: vi.fn(), unregister: vi.fn() },
  };
}

/** 创建 mock GeneralMeta */
function makeMeta(overrides: Partial<GeneralMeta>): GeneralMeta {
  return {
    id: overrides.id ?? 'guanyu',
    faction: overrides.faction ?? 'shu',
    star: overrides.star ?? 1,
    isActive: overrides.isActive ?? true,
  };
}

describe('战力公式 — 羁绊系数 + 装备系数', () => {
  let heroSys: HeroSystem;

  beforeEach(() => {
    vi.restoreAllMocks();
    heroSys = new HeroSystem();
    heroSys.init(makeMockDeps());
  });

  // ═══════════════════════════════════════════
  // 1. 羁绊系数集成（P0-R6-1）
  // ═══════════════════════════════════════════
  describe('羁绊系数集成（P0-R6-1）', () => {
    it('无羁绊时 bondMultiplier=1.0，战力不受影响', () => {
      const g = heroSys.addGeneral('guanyu')!;
      const powerNoBond = heroSys.calculatePower(g, 1, 0, 1.0);
      const powerDefault = heroSys.calculatePower(g);
      expect(powerNoBond).toBe(powerDefault);
    });

    it('羁绊系数=1.2 时战力正确提升20%', () => {
      const g = heroSys.addGeneral('guanyu')!;
      const basePower = heroSys.calculatePower(g, 1, 0, 1.0);
      const bondedPower = heroSys.calculatePower(g, 1, 0, 1.2);
      // 允许 floor 误差 ±1
      expect(bondedPower).toBeGreaterThanOrEqual(Math.floor(basePower * 1.2) - 1);
      expect(bondedPower).toBeLessThanOrEqual(Math.floor(basePower * 1.2) + 1);
    });

    it('羁绊系数=2.0（上限）时战力翻倍', () => {
      const g = heroSys.addGeneral('guanyu')!;
      const basePower = heroSys.calculatePower(g, 1, 0, 1.0);
      const maxBondPower = heroSys.calculatePower(g, 1, 0, 2.0);
      expect(maxBondPower).toBeGreaterThanOrEqual(basePower * 2 - 1);
      expect(maxBondPower).toBeLessThanOrEqual(basePower * 2 + 1);
    });

    it('羁绊系数与装备系数、星级系数叠加', () => {
      const g = heroSys.addGeneral('guanyu')!;
      // star=3 → starCoeff=1.35, equipPower=500 → equipmentCoeff=1.5, bondMultiplier=1.3
      const power = heroSys.calculatePower(g, 3, 500, 1.3);
      // 手动计算
      const { attack, defense, intelligence, speed } = g.baseStats;
      const statsPower = attack * POWER_WEIGHTS.attack + defense * POWER_WEIGHTS.defense
        + intelligence * POWER_WEIGHTS.intelligence + speed * POWER_WEIGHTS.speed;
      const levelCoeff = 1 + g.level * LEVEL_COEFFICIENT_PER_LEVEL;
      const qualityCoeff = QUALITY_MULTIPLIERS[g.quality];
      const starCoeff = getStarMultiplier(3);
      const equipmentCoeff = 1 + 500 / 1000;
      const bondCoeff = 1.3;
      const expected = Math.floor(statsPower * levelCoeff * qualityCoeff * starCoeff * equipmentCoeff * bondCoeff);
      expect(power).toBe(expected);
    });

    it('羁绊系数与品质系数叠加', () => {
      heroSys.addGeneral('guanyu'); // LEGENDARY
      heroSys.addGeneral('dianwei'); // RARE
      const gLegendary = heroSys.getGeneral('guanyu')!;
      const gRare = heroSys.getGeneral('dianwei')!;
      const bondCoeff = 1.5;
      const pLegendary = heroSys.calculatePower(gLegendary, 1, 0, bondCoeff);
      const pRare = heroSys.calculatePower(gRare, 1, 0, bondCoeff);
      // 传奇品质战力仍应高于稀有品质（羁绊系数相同）
      expect(pLegendary).toBeGreaterThan(pRare);
    });

    it('calculateFormationPower 无羁绊注入时返回基础总战力', () => {
      heroSys.addGeneral('guanyu');
      heroSys.addGeneral('liubei');
      const g1 = heroSys.getGeneral('guanyu')!;
      const g2 = heroSys.getGeneral('liubei')!;
      const expected = heroSys.calculatePower(g1) + heroSys.calculatePower(g2);
      const formationPower = heroSys.calculateFormationPower(['guanyu', 'liubei']);
      expect(formationPower).toBe(expected);
    });

    it('calculateFormationPower 注入羁绊回调后正确应用羁绊系数', () => {
      heroSys.addGeneral('guanyu');
      heroSys.addGeneral('liubei');
      heroSys.addGeneral('zhangfei');
      // 注入羁绊回调，模拟桃园结义激活 → bondMultiplier=1.15
      heroSys.setBondMultiplierGetter((_ids: string[]) => 1.15);
      const g1 = heroSys.getGeneral('guanyu')!;
      const g2 = heroSys.getGeneral('liubei')!;
      const g3 = heroSys.getGeneral('zhangfei')!;
      const basePower = heroSys.calculatePower(g1) + heroSys.calculatePower(g2) + heroSys.calculatePower(g3);
      const formationPower = heroSys.calculateFormationPower(['guanyu', 'liubei', 'zhangfei']);
      expect(formationPower).toBe(Math.floor(basePower * 1.15));
    });

    it('setBondMultiplierGetter 注入后 calculateFormationPower 使用注入回调', () => {
      heroSys.addGeneral('guanyu');
      const mockFn = vi.fn((_ids: string[]) => 1.5);
      heroSys.setBondMultiplierGetter(mockFn);
      heroSys.calculateFormationPower(['guanyu']);
      expect(mockFn).toHaveBeenCalledWith(['guanyu']);
    });
  });

  // ═══════════════════════════════════════════
  // 2. 装备系数集成验证（遗留P0）
  // ═══════════════════════════════════════════
  describe('装备系数集成验证（遗留P0）', () => {
    it('setEquipmentPowerGetter 注入后 calculatePower 使用注入回调', () => {
      const g = heroSys.addGeneral('guanyu')!;
      const mockFn = vi.fn((_id: string) => 800);
      heroSys.setEquipmentPowerGetter(mockFn);
      const power = heroSys.calculatePower(g);
      expect(mockFn).toHaveBeenCalledWith('guanyu');
      // equipmentCoeff = 1 + 800/1000 = 1.8
      const powerNoEquip = heroSys.calculatePower(g, 1, 0);
      // 验证注入回调生效
      expect(power).toBeGreaterThan(powerNoEquip);
    });

    it('显式传入 totalEquipmentPower 优先于注入回调', () => {
      const g = heroSys.addGeneral('guanyu')!;
      heroSys.setEquipmentPowerGetter((_id: string) => 800);
      const powerExplicit = heroSys.calculatePower(g, 1, 200);
      const powerInjected = heroSys.calculatePower(g, 1); // 使用注入回调 800
      // 200 < 800，显式传入的更低
      expect(powerExplicit).toBeLessThan(powerInjected);
    });

    it('装备系数通过注入回调自动生效于 calculateTotalPower', () => {
      heroSys.addGeneral('guanyu');
      heroSys.addGeneral('liubei');
      heroSys.setEquipmentPowerGetter((_id: string) => 500);
      const total = heroSys.calculateTotalPower();
      const g1 = heroSys.getGeneral('guanyu')!;
      const g2 = heroSys.getGeneral('liubei')!;
      // 每个武将的装备系数 = 1 + 500/1000 = 1.5
      const expected = heroSys.calculatePower(g1, 1, 500) + heroSys.calculatePower(g2, 1, 500);
      expect(total).toBe(expected);
    });
  });

  // ═══════════════════════════════════════════
  // 3. BondSystem 与 HeroSystem 联动
  // ═══════════════════════════════════════════
  describe('BondSystem ↔ HeroSystem 联动', () => {
    it('BondSystem.getBondMultiplier 返回值可直接作为羁绊系数', () => {
      const bondSys = new BondSystem();
      bondSys.init(makeMockDeps());
      // 注入羁绊依赖：3个蜀国武将（激活蜀国2人羁绊）
      bondSys.initBondDeps({
        getGeneralMeta: (id: string) => {
          const metas: Record<string, GeneralMeta> = {
            guanyu: makeMeta({ id: 'guanyu', faction: 'shu', star: 1, isActive: true }),
            liubei: makeMeta({ id: 'liubei', faction: 'shu', star: 1, isActive: true }),
            zhangfei: makeMeta({ id: 'zhangfei', faction: 'shu', star: 1, isActive: true }),
          };
          return metas[id];
        },
      });
      const bondMultiplier = bondSys.getBondMultiplier(['guanyu', 'liubei', 'zhangfei']);
      expect(bondMultiplier).toBeGreaterThan(1.0);
      // 将羁绊系数传入战力计算
      heroSys.addGeneral('guanyu');
      const g = heroSys.getGeneral('guanyu')!;
      const basePower = heroSys.calculatePower(g);
      const bondedPower = heroSys.calculatePower(g, 1, 0, bondMultiplier);
      expect(bondedPower).toBeGreaterThan(basePower);
    });

    it('通过 setBondMultiplierGetter 将 BondSystem 集成到 HeroSystem', () => {
      const bondSys = new BondSystem();
      bondSys.init(makeMockDeps());
      bondSys.initBondDeps({
        getGeneralMeta: (id: string) => {
          const metas: Record<string, GeneralMeta> = {
            guanyu: makeMeta({ id: 'guanyu', faction: 'shu', star: 1, isActive: true }),
            liubei: makeMeta({ id: 'liubei', faction: 'shu', star: 1, isActive: true }),
          };
          return metas[id];
        },
      });
      heroSys.addGeneral('guanyu');
      heroSys.addGeneral('liubei');
      // 注入羁绊回调
      heroSys.setBondMultiplierGetter((ids) => bondSys.getBondMultiplier(ids));
      const formationPower = heroSys.calculateFormationPower(['guanyu', 'liubei']);
      const basePower = heroSys.calculatePower(heroSys.getGeneral('guanyu')!)
        + heroSys.calculatePower(heroSys.getGeneral('liubei')!);
      // 有羁绊加成时编队战力 > 基础战力之和
      expect(formationPower).toBeGreaterThan(basePower);
    });

    it('无羁绊激活时编队战力 = 基础总战力', () => {
      const bondSys = new BondSystem();
      bondSys.init(makeMockDeps());
      // 注入空依赖（无武将元信息）→ 无羁绊激活
      bondSys.initBondDeps({
        getGeneralMeta: (_id: string) => undefined,
      });
      heroSys.addGeneral('guanyu');
      heroSys.addGeneral('liubei');
      heroSys.setBondMultiplierGetter((ids) => bondSys.getBondMultiplier(ids));
      const formationPower = heroSys.calculateFormationPower(['guanyu', 'liubei']);
      const basePower = heroSys.calculatePower(heroSys.getGeneral('guanyu')!)
        + heroSys.calculatePower(heroSys.getGeneral('liubei')!);
      expect(formationPower).toBe(basePower);
    });
  });

  // ═══════════════════════════════════════════
  // 4. 模块导出验证（P0-R6-2）
  // ═══════════════════════════════════════════
  describe('模块导出验证（P0-R6-2）', () => {
    it('BondSystem 可从 hero/index.ts 标准引入', () => {
      expect(BondSystemFromIndex).toBe(BondSystem);
      expect(typeof BondSystemFromIndex).toBe('function');
    });

    it('导出的 BondSystem 可正常实例化', () => {
      const instance = new BondSystemFromIndex();
      expect(instance.name).toBe('bond');
      expect(typeof instance.getBondMultiplier).toBe('function');
      expect(typeof instance.getActiveBonds).toBe('function');
    });
  });

  // ═══════════════════════════════════════════
  // 5. 向后兼容性验证
  // ═══════════════════════════════════════════
  describe('向后兼容性', () => {
    it('不传 bondMultiplier 时战力与R5一致', () => {
      const g = heroSys.addGeneral('guanyu')!;
      const power = heroSys.calculatePower(g);
      // R5 公式（无羁绊系数）: floor(statsPower * levelCoeff * qualityCoeff * starCoeff * equipmentCoeff)
      // R7 公式（羁绊系数=1.0）: 同上
      const { attack, defense, intelligence, speed } = g.baseStats;
      const statsPower = attack * POWER_WEIGHTS.attack + defense * POWER_WEIGHTS.defense
        + intelligence * POWER_WEIGHTS.intelligence + speed * POWER_WEIGHTS.speed;
      const levelCoeff = 1 + g.level * LEVEL_COEFFICIENT_PER_LEVEL;
      const qualityCoeff = QUALITY_MULTIPLIERS[g.quality];
      const starCoeff = getStarMultiplier(1);
      const equipmentCoeff = 1 + 0 / 1000;
      const expected = Math.floor(statsPower * levelCoeff * qualityCoeff * starCoeff * equipmentCoeff);
      expect(power).toBe(expected);
    });

    it('calculatePower(g, star) 二参数调用兼容', () => {
      const g = heroSys.addGeneral('guanyu')!;
      const power = heroSys.calculatePower(g, 3);
      const { attack, defense, intelligence, speed } = g.baseStats;
      const statsPower = attack * POWER_WEIGHTS.attack + defense * POWER_WEIGHTS.defense
        + intelligence * POWER_WEIGHTS.intelligence + speed * POWER_WEIGHTS.speed;
      const levelCoeff = 1 + g.level * LEVEL_COEFFICIENT_PER_LEVEL;
      const qualityCoeff = QUALITY_MULTIPLIERS[g.quality];
      const starCoeff = getStarMultiplier(3);
      const equipmentCoeff = 1.0;
      const expected = Math.floor(statsPower * levelCoeff * qualityCoeff * starCoeff * equipmentCoeff);
      expect(power).toBe(expected);
    });

    it('calculatePower(g, star, equipPower) 三参数调用兼容', () => {
      const g = heroSys.addGeneral('guanyu')!;
      const power = heroSys.calculatePower(g, 1, 300);
      const { attack, defense, intelligence, speed } = g.baseStats;
      const statsPower = attack * POWER_WEIGHTS.attack + defense * POWER_WEIGHTS.defense
        + intelligence * POWER_WEIGHTS.intelligence + speed * POWER_WEIGHTS.speed;
      const levelCoeff = 1 + g.level * LEVEL_COEFFICIENT_PER_LEVEL;
      const qualityCoeff = QUALITY_MULTIPLIERS[g.quality];
      const starCoeff = getStarMultiplier(1);
      const equipmentCoeff = 1 + 300 / 1000;
      const expected = Math.floor(statsPower * levelCoeff * qualityCoeff * starCoeff * equipmentCoeff);
      expect(power).toBe(expected);
    });
  });
});
