/**
 * SkillUpgradeSystem 单元测试 — P0突破解锁技能/CD减少/额外效果
 *
 * 覆盖功能点：F4.06/F4.07/F4.08 突破解锁技能、F5.08/F5.09 CD减少和额外效果
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SkillUpgradeSystem } from '../SkillUpgradeSystem';
import { HeroSystem } from '../HeroSystem';
import { HeroStarSystem } from '../HeroStarSystem';
import type { SkillUpgradeDeps } from '../SkillUpgradeSystem';

// ── 辅助函数 ──

function makeMockDeps() {
  return {
    eventBus: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
    config: { get: vi.fn(), set: vi.fn(), has: vi.fn() },
    registry: { get: vi.fn(), register: vi.fn(), has: vi.fn(), getAll: vi.fn(), unregister: vi.fn() },
  };
}

function createTestSetup() {
  const heroSystem = new HeroSystem();
  heroSystem.init(makeMockDeps());
  const starSystem = new HeroStarSystem(heroSystem);
  starSystem.init(makeMockDeps());

  const resources: Record<string, number> = { gold: 999999999 };

  const skillDeps: SkillUpgradeDeps = {
    heroSystem,
    heroStarSystem: starSystem,
    spendResource: vi.fn((type: string, amount: number) => {
      if ((resources[type] ?? 0) >= amount) { resources[type] -= amount; return true; }
      return false;
    }),
    canAffordResource: vi.fn((type: string, amount: number) => (resources[type] ?? 0) >= amount),
    getResourceAmount: vi.fn((type: string) => resources[type] ?? 0),
  };

  const skillSystem = new SkillUpgradeSystem();
  skillSystem.init(makeMockDeps());
  skillSystem.setSkillUpgradeDeps(skillDeps);

  return { heroSystem, starSystem, skillSystem, resources };
}

// ═══════════════════════════════════════════
// P0-1: 突破解锁技能系统
// ═══════════════════════════════════════════

describe('SkillUpgradeSystem 突破解锁技能 (F4.06/F4.07/F4.08)', () => {
  let skillSystem: SkillUpgradeSystem;

  beforeEach(() => {
    const setup = createTestSetup();
    skillSystem = setup.skillSystem;
  });

  describe('unlockSkillOnBreakthrough', () => {
    it('should unlock skills at breakthrough level 10', () => {
      const unlocked = skillSystem.unlockSkillOnBreakthrough('guanyu', 10);
      expect(unlocked.length).toBeGreaterThan(0);
      expect(unlocked).toContain(1); // passive skill index
    });

    it('should unlock skills at breakthrough level 20', () => {
      const unlocked = skillSystem.unlockSkillOnBreakthrough('zhangfei', 20);
      expect(unlocked.length).toBeGreaterThan(0);
      // Should include both Lv10 and Lv20 unlocks
      expect(unlocked).toContain(1); // Lv10 passive
      expect(unlocked).toContain(3); // Lv20 new skill
    });

    it('should unlock skills at breakthrough level 30', () => {
      const unlocked = skillSystem.unlockSkillOnBreakthrough('liubei', 30);
      expect(unlocked.length).toBeGreaterThanOrEqual(1);
      // Should include Lv10, Lv20, and Lv30 unlocks
      expect(unlocked).toContain(1); // Lv10 passive
      expect(unlocked).toContain(3); // Lv20 new skill
      expect(unlocked).toContain(0); // Lv30 ultimate
    });

    it('should return empty array for level below minimum (5)', () => {
      const unlocked = skillSystem.unlockSkillOnBreakthrough('guanyu', 5);
      expect(unlocked).toEqual([]);
    });

    it('should not double-unlock for same hero+level', () => {
      skillSystem.unlockSkillOnBreakthrough('guanyu', 10);
      const secondUnlock = skillSystem.unlockSkillOnBreakthrough('guanyu', 10);
      expect(secondUnlock).toEqual([]); // Already unlocked
    });

    it('should handle different heroes independently', () => {
      skillSystem.unlockSkillOnBreakthrough('guanyu', 10);
      const zhangfeiUnlocked = skillSystem.unlockSkillOnBreakthrough('zhangfei', 10);
      expect(zhangfeiUnlocked.length).toBeGreaterThan(0);
    });
  });

  describe('getSkillUnlockState', () => {
    it('should return empty state for hero with no unlocks', () => {
      const state = skillSystem.getSkillUnlockState('guanyu');
      expect(state.heroId).toBe('guanyu');
      expect(state.unlockedSkills).toEqual([]);
    });

    it('should return correct unlock state after breakthrough', () => {
      skillSystem.unlockSkillOnBreakthrough('guanyu', 10);
      const state = skillSystem.getSkillUnlockState('guanyu');
      expect(state.unlockedSkills.length).toBeGreaterThan(0);
      expect(state.unlockedSkills[0].breakthroughLevel).toBe(10);
      expect(state.unlockedSkills[0].unlockType).toBe('passive_enhance');
    });

    it('should return multiple unlocks for higher breakthrough', () => {
      skillSystem.unlockSkillOnBreakthrough('guanyu', 30);
      const state = skillSystem.getSkillUnlockState('guanyu');
      expect(state.unlockedSkills.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('state persistence', () => {
    it('should include breakthroughSkillUnlocks in getState', () => {
      skillSystem.unlockSkillOnBreakthrough('guanyu', 10);
      const state = skillSystem.getState();
      expect(state.breakthroughSkillUnlocks).toBeDefined();
      expect(Object.keys(state.breakthroughSkillUnlocks).length).toBeGreaterThan(0);
    });

    it('should reset breakthroughSkillUnlocks on reset', () => {
      skillSystem.unlockSkillOnBreakthrough('guanyu', 10);
      skillSystem.reset();
      const state = skillSystem.getState();
      expect(Object.keys(state.breakthroughSkillUnlocks)).toHaveLength(0);
    });
  });
});

// ═══════════════════════════════════════════
// P0-2: 技能CD减少和额外效果
// ═══════════════════════════════════════════

describe('SkillUpgradeSystem CD减少和额外效果 (F5.08/F5.09)', () => {
  let heroSystem: HeroSystem;
  let skillSystem: SkillUpgradeSystem;

  beforeEach(() => {
    const setup = createTestSetup();
    heroSystem = setup.heroSystem;
    skillSystem = setup.skillSystem;
    heroSystem.addGeneral('guanyu');
  });

  describe('getCooldownReduce', () => {
    it('should return 0 for level 1 skill', () => {
      expect(skillSystem.getCooldownReduce('guanyu', 0)).toBe(0);
    });

    it('should return 0.5 for level 2 skill', () => {
      heroSystem.updateSkillLevel('guanyu', 0, 2);
      expect(skillSystem.getCooldownReduce('guanyu', 0)).toBe(0.5);
    });

    it('should return 2.0 for level 5 skill', () => {
      heroSystem.updateSkillLevel('guanyu', 0, 5);
      expect(skillSystem.getCooldownReduce('guanyu', 0)).toBe(2.0);
    });

    it('should return 0 for nonexistent hero', () => {
      expect(skillSystem.getCooldownReduce('nonexistent', 0)).toBe(0);
    });

    it('should return 0 for invalid skill index', () => {
      expect(skillSystem.getCooldownReduce('guanyu', 99)).toBe(0);
    });
  });

  describe('hasExtraEffect', () => {
    it('should return false for skill below level 5', () => {
      heroSystem.updateSkillLevel('guanyu', 0, 4);
      expect(skillSystem.hasExtraEffect('guanyu', 0)).toBe(false);
    });

    it('should return true for skill at level 5', () => {
      heroSystem.updateSkillLevel('guanyu', 0, 5);
      expect(skillSystem.hasExtraEffect('guanyu', 0)).toBe(true);
    });

    it('should return true for skill above level 5', () => {
      heroSystem.updateSkillLevel('guanyu', 0, 8);
      expect(skillSystem.hasExtraEffect('guanyu', 0)).toBe(true);
    });

    it('should return false for nonexistent hero', () => {
      expect(skillSystem.hasExtraEffect('nonexistent', 0)).toBe(false);
    });
  });

  describe('getExtraEffect', () => {
    it('should return null for skill below level 5', () => {
      heroSystem.updateSkillLevel('guanyu', 0, 4);
      expect(skillSystem.getExtraEffect('guanyu', 0)).toBeNull();
    });

    it('should return extra effect for skill at level 5', () => {
      heroSystem.updateSkillLevel('guanyu', 0, 5);
      const effect = skillSystem.getExtraEffect('guanyu', 0);
      expect(effect).not.toBeNull();
      expect(effect!.bonus).toBeGreaterThan(0);
      expect(effect!.skillIndex).toBe(0);
    });

    it('should return higher bonus for higher level', () => {
      heroSystem.updateSkillLevel('guanyu', 0, 5);
      const effect5 = skillSystem.getExtraEffect('guanyu', 0);

      heroSystem.updateSkillLevel('guanyu', 0, 8);
      const effect8 = skillSystem.getExtraEffect('guanyu', 0);

      expect(effect8!.bonus).toBeGreaterThan(effect5!.bonus);
    });

    it('should return null for nonexistent hero', () => {
      expect(skillSystem.getExtraEffect('nonexistent', 0)).toBeNull();
    });

    it('should return null for invalid skill index', () => {
      expect(skillSystem.getExtraEffect('guanyu', 99)).toBeNull();
    });
  });
});
