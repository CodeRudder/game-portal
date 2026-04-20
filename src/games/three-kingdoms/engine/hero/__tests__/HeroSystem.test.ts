/**
 * HeroSystem 单元测试 — 核心部分
 * 覆盖：初始化、武将管理、碎片管理、升级经验、查询工具、update()
 */

import { HeroSystem } from '../HeroSystem';
import type { GeneralData, Quality, Faction } from '../hero.types';
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
    eventBus: { on: jest.fn(), off: jest.fn(), emit: jest.fn() },
    config: { get: jest.fn(), set: jest.fn(), has: jest.fn() },
    registry: { get: jest.fn(), register: jest.fn(), has: jest.fn(), getAll: jest.fn(), unregister: jest.fn() },
  };
}

describe('HeroSystem', () => {
  let sys: HeroSystem;

  beforeEach(() => {
    jest.restoreAllMocks();
    sys = new HeroSystem();
    sys.init(makeMockDeps());
  });

  // ═══════════════════════════════════════════
  // 1. 初始化
  // ═══════════════════════════════════════════
  describe('初始化', () => {
    it('should have correct subsystem name', () => {
      expect(sys.name).toBe('hero');
    });

    it('should start with empty generals and fragments', () => {
      expect(sys.getAllGenerals()).toHaveLength(0);
      expect(sys.getGeneralCount()).toBe(0);
      expect(sys.getAllFragments()).toEqual({});
    });

    it('should return correct save version', () => {
      const save = sys.serialize();
      expect(save.version).toBe(HERO_SAVE_VERSION);
    });

    it(`should load ${GENERAL_DEFS.length} general definitions`, () => {
      const defs = sys.getAllGeneralDefs();
      expect(defs).toHaveLength(GENERAL_DEFS.length);
    });
  });

  // ═══════════════════════════════════════════
  // 2. 武将管理
  // ═══════════════════════════════════════════
  describe('武将管理', () => {
    it('should add a general by id', () => {
      const g = sys.addGeneral('guanyu');
      expect(g).not.toBeNull();
      expect(g!.id).toBe('guanyu');
      expect(g!.name).toBe('关羽');
      expect(g!.level).toBe(1);
      expect(g!.exp).toBe(0);
    });

    it('should return null when adding duplicate general', () => {
      sys.addGeneral('guanyu');
      const dup = sys.addGeneral('guanyu');
      expect(dup).toBeNull();
    });

    it('should return null when adding general with invalid id', () => {
      const g = sys.addGeneral('nonexistent');
      expect(g).toBeNull();
    });

    it('should get a general by id', () => {
      sys.addGeneral('guanyu');
      const g = sys.getGeneral('guanyu');
      expect(g).toBeDefined();
      expect(g!.id).toBe('guanyu');
    });

    it('should return undefined when getting nonexistent general', () => {
      const g = sys.getGeneral('nonexistent');
      expect(g).toBeUndefined();
    });

    it('should check if general exists', () => {
      expect(sys.hasGeneral('guanyu')).toBe(false);
      sys.addGeneral('guanyu');
      expect(sys.hasGeneral('guanyu')).toBe(true);
    });

    it('should return correct general count', () => {
      expect(sys.getGeneralCount()).toBe(0);
      sys.addGeneral('guanyu');
      expect(sys.getGeneralCount()).toBe(1);
      sys.addGeneral('liubei');
      expect(sys.getGeneralCount()).toBe(2);
    });

    it('should get all generals', () => {
      sys.addGeneral('guanyu');
      sys.addGeneral('liubei');
      const all = sys.getAllGenerals();
      expect(all).toHaveLength(2);
      const ids = all.map((g) => g.id);
      expect(ids).toContain('guanyu');
      expect(ids).toContain('liubei');
    });

    it('should remove a general', () => {
      sys.addGeneral('guanyu');
      const removed = sys.removeGeneral('guanyu');
      expect(removed).not.toBeNull();
      expect(removed!.id).toBe('guanyu');
      expect(sys.hasGeneral('guanyu')).toBe(false);
    });

    it('should return null when removing nonexistent general', () => {
      const removed = sys.removeGeneral('nonexistent');
      expect(removed).toBeNull();
    });

    it('should return cloned data (immutability)', () => {
      sys.addGeneral('guanyu');
      const g1 = sys.getGeneral('guanyu')!;
      g1.level = 99;
      const g2 = sys.getGeneral('guanyu')!;
      expect(g2.level).toBe(1);
    });

    it('should initialize general with correct faction', () => {
      const g = sys.addGeneral('caocao');
      expect(g!.faction).toBe('wei');
    });

    it('should initialize general with correct quality', () => {
      const g = sys.addGeneral('guanyu');
      expect(g!.quality).toBe(Q.LEGENDARY);
    });

    it('should initialize general with correct skills', () => {
      const g = sys.addGeneral('guanyu');
      expect(g!.skills).toHaveLength(2);
      expect(g!.skills[0].id).toBe('guanyu_01');
    });

    it('should initialize general with correct baseStats', () => {
      const g = sys.addGeneral('guanyu');
      expect(g!.baseStats).toEqual({ attack: 115, defense: 90, intelligence: 65, speed: 78 });
    });
  });

  // ═══════════════════════════════════════════
  // 3. 碎片管理
  // ═══════════════════════════════════════════
  describe('碎片管理', () => {
    it('should add fragments', () => {
      sys.addFragment('guanyu', 10);
      expect(sys.getFragments('guanyu')).toBe(10);
    });

    it('should accumulate fragments', () => {
      sys.addFragment('guanyu', 5);
      sys.addFragment('guanyu', 10);
      expect(sys.getFragments('guanyu')).toBe(15);
    });

    it('should return 0 for nonexistent fragments', () => {
      expect(sys.getFragments('nonexistent')).toBe(0);
    });

    it('should use fragments successfully', () => {
      sys.addFragment('guanyu', 20);
      const result = sys.useFragments('guanyu', 10);
      expect(result).toBe(true);
      expect(sys.getFragments('guanyu')).toBe(10);
    });

    it('should fail to use fragments when insufficient', () => {
      sys.addFragment('guanyu', 5);
      const result = sys.useFragments('guanyu', 10);
      expect(result).toBe(false);
      expect(sys.getFragments('guanyu')).toBe(5);
    });

    it('should fail to use fragments when none exist', () => {
      const result = sys.useFragments('guanyu', 1);
      expect(result).toBe(false);
    });

    it('should delete fragment entry when count reaches 0', () => {
      sys.addFragment('guanyu', 10);
      sys.useFragments('guanyu', 10);
      const all = sys.getAllFragments();
      expect('guanyu' in all).toBe(false);
    });

    it('should not add fragments when count is 0 or negative', () => {
      sys.addFragment('guanyu', 0);
      expect(sys.getFragments('guanyu')).toBe(0);
      sys.addFragment('guanyu', -5);
      expect(sys.getFragments('guanyu')).toBe(0);
    });

    it('should handle duplicate general conversion correctly', () => {
      const count = sys.handleDuplicate('guanyu', Q.LEGENDARY);
      expect(count).toBe(DUPLICATE_FRAGMENT_COUNT[Q.LEGENDARY]);
      expect(sys.getFragments('guanyu')).toBe(DUPLICATE_FRAGMENT_COUNT[Q.LEGENDARY]);
    });

    it('should handle duplicate for each quality', () => {
      for (const q of [Q.COMMON, Q.FINE, Q.RARE, Q.EPIC, Q.LEGENDARY]) {
        sys.handleDuplicate('test', q);
        expect(sys.getFragments('test')).toBeGreaterThanOrEqual(DUPLICATE_FRAGMENT_COUNT[q]);
      }
    });

    it('should return a copy from getAllFragments', () => {
      sys.addFragment('guanyu', 10);
      const f1 = sys.getAllFragments();
      f1['guanyu'] = 999;
      expect(sys.getFragments('guanyu')).toBe(10);
    });
  });

  // ═══════════════════════════════════════════
  // 4. 升级经验
  // ═══════════════════════════════════════════
  describe('升级经验', () => {
    it('should get exp required for level 1', () => {
      // Level 1: tier levelMin=1, levelMax=10, expPerLevel=50 => 1*50=50
      expect(sys.getExpRequired(1)).toBe(50);
    });

    it('should get exp required for level 10', () => {
      // Level 10: tier levelMin=1, levelMax=10, expPerLevel=50 => 10*50=500
      expect(sys.getExpRequired(10)).toBe(500);
    });

    it('should get exp required for level 11', () => {
      // Level 11: tier levelMin=11, levelMax=20, expPerLevel=120 => 11*120=1320
      expect(sys.getExpRequired(11)).toBe(1320);
    });

    it('should get exp required for level 41', () => {
      // Level 41: tier levelMin=41, levelMax=50, expPerLevel=1000 => 41*1000=41000
      expect(sys.getExpRequired(41)).toBe(41000);
    });

    it('should get gold required for level 1', () => {
      // Level 1: goldPerLevel=20 => 1*20=20
      expect(sys.getGoldRequired(1)).toBe(20);
    });

    it('should get gold required for level 11', () => {
      // Level 11: goldPerLevel=50 => 11*50=550
      expect(sys.getGoldRequired(11)).toBe(550);
    });

    it('should add exp and auto level up', () => {
      sys.addGeneral('guanyu');
      const result = sys.addExp('guanyu', 50);
      expect(result).not.toBeNull();
      expect(result!.levelsGained).toBe(1);
      expect(result!.general.level).toBe(2);
    });

    it('should add exp and level up multiple times', () => {
      sys.addGeneral('guanyu');
      const result = sys.addExp('guanyu', 500);
      expect(result).not.toBeNull();
      expect(result!.levelsGained).toBeGreaterThan(1);
    });

    it('should return null for nonexistent general', () => {
      const result = sys.addExp('nonexistent', 100);
      expect(result).toBeNull();
    });

    it('should handle max level correctly', () => {
      sys.addGeneral('guanyu');
      // Level up to max
      while (sys.getGeneral('guanyu')!.level < HERO_MAX_LEVEL) {
        const g = sys.getGeneral('guanyu')!;
        sys.addExp('guanyu', sys.getExpRequired(g.level));
      }
      const g = sys.getGeneral('guanyu')!;
      expect(g.level).toBe(HERO_MAX_LEVEL);
      // Adding more exp should return null
      const result = sys.addExp('guanyu', 1000);
      expect(result).toBeNull();
    });

    it('should preserve remaining exp after level up', () => {
      sys.addGeneral('guanyu');
      // Need 50 exp for level 2, give 120 => level 2 with 70 exp remaining
      // level 2 needs 100 exp => level 3 with 0 exp remaining... wait
      // Actually: give 120 exp. Level 1 needs 50. After: remaining 70, level 2.
      // Level 2 needs 100. 70 < 100, so exp = 70, level 2.
      sys.addExp('guanyu', 120);
      const g = sys.getGeneral('guanyu')!;
      expect(g.level).toBe(2);
      expect(g.exp).toBe(70);
    });
  });

  // ═══════════════════════════════════════════
  // 5. 查询工具
  // ═══════════════════════════════════════════
  describe('查询工具', () => {
    beforeEach(() => {
      sys.addGeneral('guanyu');   // shu, LEGENDARY
      sys.addGeneral('liubei');   // shu, EPIC
      sys.addGeneral('caocao');   // wei, LEGENDARY
      sys.addGeneral('dianwei');  // wei, RARE
    });

    it('should filter generals by faction', () => {
      const shu = sys.getGeneralsByFaction('shu');
      expect(shu).toHaveLength(2);
      expect(shu.every((g) => g.faction === 'shu')).toBe(true);
    });

    it('should return empty array for faction with no generals', () => {
      const wu = sys.getGeneralsByFaction('wu');
      expect(wu).toHaveLength(0);
    });

    it('should filter generals by quality', () => {
      const legendary = sys.getGeneralsByQuality(Q.LEGENDARY);
      expect(legendary).toHaveLength(2);
      expect(legendary.every((g) => g.quality === Q.LEGENDARY)).toBe(true);
    });

    it('should sort generals by power descending', () => {
      const sorted = sys.getGeneralsSortedByPower(true);
      for (let i = 1; i < sorted.length; i++) {
        expect(sys.calculatePower(sorted[i - 1])).toBeGreaterThanOrEqual(
          sys.calculatePower(sorted[i]),
        );
      }
    });

    it('should sort generals by power ascending', () => {
      const sorted = sys.getGeneralsSortedByPower(false);
      for (let i = 1; i < sorted.length; i++) {
        expect(sys.calculatePower(sorted[i - 1])).toBeLessThanOrEqual(
          sys.calculatePower(sorted[i]),
        );
      }
    });

    it('should get general def by id', () => {
      const def = sys.getGeneralDef('guanyu');
      expect(def).toBeDefined();
      expect(def!.name).toBe('关羽');
    });

    it('should return undefined for invalid general def id', () => {
      const def = sys.getGeneralDef('nonexistent');
      expect(def).toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════
  // 6. update() 方法
  // ═══════════════════════════════════════════
  describe('update()', () => {
    it('should not throw when update is called', () => {
      expect(() => sys.update(16)).not.toThrow();
    });
  });
});
