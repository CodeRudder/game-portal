/**
 * HeroSystem 单元测试 — 高级部分
 * 覆盖：战力计算、序列化/反序列化、边界情况
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HeroSystem } from '../HeroSystem';
import { Quality as Q } from '../hero.types';
import {
  GENERAL_DEFS,
  QUALITY_MULTIPLIERS,
  POWER_WEIGHTS,
  LEVEL_COEFFICIENT_PER_LEVEL,
  HERO_SAVE_VERSION,
  HERO_MAX_LEVEL,
  LEVEL_EXP_TABLE,
  DUPLICATE_FRAGMENT_COUNT,
} from '../hero-config';

// ── 辅助：创建 mock ISystemDeps ──
function makeMockDeps() {
  return {
    eventBus: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
    config: { get: vi.fn(), set: vi.fn(), has: vi.fn() },
    registry: { get: vi.fn(), register: vi.fn(), has: vi.fn(), getAll: vi.fn(), unregister: vi.fn() },
  };
}

describe('HeroSystem — 高级测试', () => {
  let sys: HeroSystem;

  beforeEach(() => {
    vi.restoreAllMocks();
    sys = new HeroSystem();
    sys.init(makeMockDeps());
  });

  // ═══════════════════════════════════════════
  // 1. 战力计算
  // ═══════════════════════════════════════════
  describe('战力计算', () => {
    it('should calculate power correctly for level 1', () => {
      const g = sys.addGeneral('guanyu')!;
      const power = sys.calculatePower(g);
      // ATK*2 + DEF*1.5 + INT*2 + SPD*1 = 115*2 + 90*1.5 + 65*2 + 78*1 = 230+135+130+78 = 573
      // levelCoeff = 1 + 1*0.05 = 1.05
      // qualityCoeff = 1.8 (LEGENDARY)
      // power = floor(573 * 1.05 * 1.8) = floor(1082.97) = 1082
      expect(power).toBe(1082);
    });

    it('should calculate power correctly for higher level', () => {
      sys.addGeneral('guanyu');
      sys.addExp('guanyu', 99999);
      const g = sys.getGeneral('guanyu')!;
      const power = sys.calculatePower(g);
      const levelCoeff = 1 + g.level * LEVEL_COEFFICIENT_PER_LEVEL;
      const qualityCoeff = QUALITY_MULTIPLIERS[Q.LEGENDARY];
      const statsPower =
        g.baseStats.attack * POWER_WEIGHTS.attack +
        g.baseStats.defense * POWER_WEIGHTS.defense +
        g.baseStats.intelligence * POWER_WEIGHTS.intelligence +
        g.baseStats.speed * POWER_WEIGHTS.speed;
      expect(power).toBe(Math.floor(statsPower * levelCoeff * qualityCoeff));
    });

    it('should calculate total power as sum of all generals', () => {
      sys.addGeneral('guanyu');
      sys.addGeneral('liubei');
      const total = sys.calculateTotalPower();
      const g1 = sys.getGeneral('guanyu')!;
      const g2 = sys.getGeneral('liubei')!;
      expect(total).toBe(sys.calculatePower(g1) + sys.calculatePower(g2));
    });

    it('should return 0 total power when no generals', () => {
      expect(sys.calculateTotalPower()).toBe(0);
    });

    it('should apply quality multiplier correctly', () => {
      sys.addGeneral('guanyu'); // LEGENDARY
      sys.addGeneral('dianwei'); // RARE
      const pLegendary = sys.calculatePower(sys.getGeneral('guanyu')!);
      const pRare = sys.calculatePower(sys.getGeneral('dianwei')!);
      // Both at level 1, quality multiplier is the main difference factor
      expect(pLegendary).toBeGreaterThan(pRare);
    });

    it('should floor the power result', () => {
      const g = sys.addGeneral('liubei')!;
      const power = sys.calculatePower(g);
      expect(Number.isInteger(power)).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // 2. 序列化/反序列化
  // ═══════════════════════════════════════════
  describe('序列化/反序列化', () => {
    it('should serialize and deserialize correctly', () => {
      sys.addGeneral('guanyu');
      sys.addFragment('guanyu', 10);
      sys.addExp('guanyu', 200);

      const save = sys.serialize();
      expect(save.version).toBe(HERO_SAVE_VERSION);
      expect(save.state.generals['guanyu']).toBeDefined();
      expect(save.state.fragments['guanyu']).toBe(10);

      const sys2 = new HeroSystem();
      sys2.deserialize(save);
      expect(sys2.hasGeneral('guanyu')).toBe(true);
      expect(sys2.getFragments('guanyu')).toBe(10);
      expect(sys2.getGeneral('guanyu')!.level).toBeGreaterThan(1);
    });

    it('should handle version mismatch gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      sys.deserialize({ version: 999, state: { generals: {}, fragments: {} } });
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should reset to empty state', () => {
      sys.addGeneral('guanyu');
      sys.addFragment('guanyu', 10);
      sys.reset();
      expect(sys.getGeneralCount()).toBe(0);
      expect(sys.getAllFragments()).toEqual({});
    });

    it('should return state via getState()', () => {
      const state = sys.getState();
      expect(state).toHaveProperty('version');
      expect(state).toHaveProperty('state');
    });
  });

  // ═══════════════════════════════════════════
  // 3. 边界情况
  // ═══════════════════════════════════════════
  describe('边界情况', () => {
    it('should handle empty state operations', () => {
      expect(sys.calculateTotalPower()).toBe(0);
      expect(sys.getAllGenerals()).toHaveLength(0);
      expect(sys.getGeneralCount()).toBe(0);
    });

    it('should handle invalid general id for all operations', () => {
      expect(sys.getGeneral('invalid')).toBeUndefined();
      expect(sys.hasGeneral('invalid')).toBe(false);
      expect(sys.removeGeneral('invalid')).toBeNull();
      expect(sys.addExp('invalid', 100)).toBeNull();
      expect(sys.getFragments('invalid')).toBe(0);
    });

    it('should handle adding all 14 generals', () => {
      const ids = GENERAL_DEFS.map((d) => d.id);
      for (const id of ids) {
        const result = sys.addGeneral(id);
        expect(result).not.toBeNull();
      }
      expect(sys.getGeneralCount()).toBe(GENERAL_DEFS.length);
    });

    it('should handle exp required for out-of-range levels', () => {
      // Beyond all tiers, should use last tier
      const exp = sys.getExpRequired(100);
      expect(exp).toBe(100 * LEVEL_EXP_TABLE[LEVEL_EXP_TABLE.length - 1].expPerLevel);
    });

    it('should handle gold required for out-of-range levels', () => {
      const gold = sys.getGoldRequired(100);
      expect(gold).toBe(100 * LEVEL_EXP_TABLE[LEVEL_EXP_TABLE.length - 1].goldPerLevel);
    });

    it('should handle useFragments with exact amount', () => {
      sys.addFragment('guanyu', 10);
      expect(sys.useFragments('guanyu', 10)).toBe(true);
      expect(sys.getFragments('guanyu')).toBe(0);
    });
  });
});
