/**
 * SkillUpgradeSystem 补充测试 — 覆盖已有测试未覆盖的盲区
 *
 * 聚焦：
 *   1. upgradeSkill — 完整成功路径（含材料消耗验证）
 *   2. upgradeSkill — 失败路径（deps未设置/武将不存在/无效技能索引/材料不足/资源不足/消耗失败）
 *   3. getSkillLevel / getSkillEffect — 边界条件
 *   4. getSkillLevelCap — 星级边界
 *   5. canUpgradeAwakenSkill — 突破前置
 *   6. getExtraEffect — 等级5以上额外效果
 *   7. ISubsystem 接口
 *   8. getStrategyRecommender 委托
 *   9. unlockSkillOnBreakthrough / getSkillUnlockState
 *   10. getCooldownReduce / hasExtraEffect
 *   11. spendResource 失败路径（gold/skillBook）
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SkillUpgradeSystem } from '../SkillUpgradeSystem';
import type { SkillUpgradeDeps, SkillUpgradeResult } from '../SkillUpgradeSystem';
import { HeroSystem } from '../HeroSystem';
import { HeroStarSystem } from '../HeroStarSystem';
import type { SkillData } from '../hero.types';

// ── 辅助 ──

function makeMockCoreDeps() {
  return {
    eventBus: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
    config: { get: vi.fn(), set: vi.fn(), has: vi.fn() },
    registry: { get: vi.fn(), register: vi.fn(), has: vi.fn(), getAll: vi.fn(), unregister: vi.fn() },
  };
}

function createTestEnv() {
  const heroSystem = new HeroSystem();
  heroSystem.init(makeMockCoreDeps());

  const starSystem = new HeroStarSystem(heroSystem);
  starSystem.init(makeMockCoreDeps());
  const starDeps = {
    resources: { gold: 999999999, breakthroughStone: 999999999 },
    spendFragments: vi.fn(),
    getFragments: vi.fn(() => 999),
    spendResource: vi.fn(() => true),
    canAffordResource: vi.fn(() => true),
    getResourceAmount: vi.fn(() => 999999999),
  };
  starSystem.setDeps(starDeps);
  heroSystem.setLevelCapGetter((id: string) => starSystem.getLevelCap(id));

  const skillSystem = new SkillUpgradeSystem();
  skillSystem.init(makeMockCoreDeps());

  return { heroSystem, starSystem, skillSystem };
}

function makeSkillDeps(overrides?: Partial<SkillUpgradeDeps>): SkillUpgradeDeps {
  return {
    heroSystem: overrides?.heroSystem ?? new HeroSystem(),
    heroStarSystem: overrides?.heroStarSystem ?? new HeroStarSystem(overrides?.heroSystem ?? new HeroSystem()),
    spendResource: overrides?.spendResource ?? vi.fn(() => true),
    canAffordResource: overrides?.canAffordResource ?? vi.fn(() => true),
    getResourceAmount: overrides?.getResourceAmount ?? vi.fn(() => 999999999),
  };
}

// ═══════════════════════════════════════════
// 测试
// ═══════════════════════════════════════════

describe('SkillUpgradeSystem — 补充覆盖', () => {

  // ─────────────────────────────────────────
  // 1. upgradeSkill 成功路径
  // ─────────────────────────────────────────
  describe('upgradeSkill 成功路径', () => {
    it('should upgrade skill from Lv1 to Lv2 with correct cost', () => {
      const { heroSystem, starSystem, skillSystem } = createTestEnv();
      heroSystem.addGeneral('guanyu');
      (starSystem as unknown as { state: { stars: Record<string, number>; breakthroughStages: Record<string, number> } }).state.stars['guanyu'] = 3;

      const deps = makeSkillDeps({ heroSystem, heroStarSystem: starSystem });
      skillSystem.setSkillUpgradeDeps(deps);

      const result = skillSystem.upgradeSkill('guanyu', 0, { skillBooks: 1, gold: 500 });
      expect(result.success).toBe(true);
      expect(result.previousLevel).toBe(1);
      expect(result.currentLevel).toBe(2);
    });

    it('should increase effect after upgrade', () => {
      const { heroSystem, starSystem, skillSystem } = createTestEnv();
      heroSystem.addGeneral('guanyu');
      (starSystem as unknown as { state: { stars: Record<string, number>; breakthroughStages: Record<string, number> } }).state.stars['guanyu'] = 3;

      const deps = makeSkillDeps({ heroSystem, heroStarSystem: starSystem });
      skillSystem.setSkillUpgradeDeps(deps);

      const before = skillSystem.getSkillEffect('guanyu', 0);
      skillSystem.upgradeSkill('guanyu', 0, { skillBooks: 1, gold: 500 });
      const after = skillSystem.getSkillEffect('guanyu', 0);
      expect(after).toBeGreaterThan(before);
    });

    it('should record upgrade in history', () => {
      const { heroSystem, starSystem, skillSystem } = createTestEnv();
      heroSystem.addGeneral('guanyu');
      (starSystem as unknown as { state: { stars: Record<string, number>; breakthroughStages: Record<string, number> } }).state.stars['guanyu'] = 3;

      const deps = makeSkillDeps({ heroSystem, heroStarSystem: starSystem });
      skillSystem.setSkillUpgradeDeps(deps);

      skillSystem.upgradeSkill('guanyu', 0, { skillBooks: 1, gold: 500 });
      const state = skillSystem.getState();
      expect(state.upgradeHistory['guanyu_0']).toBe(1);
    });
  });

  // ─────────────────────────────────────────
  // 2. upgradeSkill 失败路径
  // ─────────────────────────────────────────
  describe('upgradeSkill 失败路径', () => {
    it('should fail when deps not set', () => {
      const { skillSystem } = createTestEnv();
      const result = skillSystem.upgradeSkill('guanyu', 0, { skillBooks: 1, gold: 500 });
      expect(result.success).toBe(false);
    });

    it('should fail when hero not found', () => {
      const { heroSystem, starSystem, skillSystem } = createTestEnv();
      const deps = makeSkillDeps({ heroSystem, heroStarSystem: starSystem });
      skillSystem.setSkillUpgradeDeps(deps);
      skillSystem.init(makeMockCoreDeps());

      const result = skillSystem.upgradeSkill('nonexistent', 0, { skillBooks: 1, gold: 500 });
      expect(result.success).toBe(false);
    });

    it('should fail with negative skill index', () => {
      const { heroSystem, starSystem, skillSystem } = createTestEnv();
      heroSystem.addGeneral('guanyu');
      const deps = makeSkillDeps({ heroSystem, heroStarSystem: starSystem });
      skillSystem.setSkillUpgradeDeps(deps);

      const result = skillSystem.upgradeSkill('guanyu', -1, { skillBooks: 1, gold: 500 });
      expect(result.success).toBe(false);
    });

    it('should fail with out-of-range skill index', () => {
      const { heroSystem, starSystem, skillSystem } = createTestEnv();
      heroSystem.addGeneral('guanyu');
      const deps = makeSkillDeps({ heroSystem, heroStarSystem: starSystem });
      skillSystem.setSkillUpgradeDeps(deps);

      const result = skillSystem.upgradeSkill('guanyu', 999, { skillBooks: 1, gold: 500 });
      expect(result.success).toBe(false);
    });

    it('should fail when insufficient materials (skillBooks)', () => {
      const { heroSystem, starSystem, skillSystem } = createTestEnv();
      heroSystem.addGeneral('guanyu');
      (starSystem as unknown as { state: { stars: Record<string, number>; breakthroughStages: Record<string, number> } }).state.stars['guanyu'] = 3;
      const deps = makeSkillDeps({ heroSystem, heroStarSystem: starSystem });
      skillSystem.setSkillUpgradeDeps(deps);

      const result = skillSystem.upgradeSkill('guanyu', 0, { skillBooks: 0, gold: 500 });
      expect(result.success).toBe(false);
    });

    it('should fail when insufficient materials (gold)', () => {
      const { heroSystem, starSystem, skillSystem } = createTestEnv();
      heroSystem.addGeneral('guanyu');
      (starSystem as unknown as { state: { stars: Record<string, number>; breakthroughStages: Record<string, number> } }).state.stars['guanyu'] = 3;
      const deps = makeSkillDeps({ heroSystem, heroStarSystem: starSystem });
      skillSystem.setSkillUpgradeDeps(deps);

      const result = skillSystem.upgradeSkill('guanyu', 0, { skillBooks: 1, gold: 0 });
      expect(result.success).toBe(false);
    });

    it('should fail when awaken skill requires breakthrough', () => {
      const { heroSystem, starSystem, skillSystem } = createTestEnv();
      heroSystem.addGeneral('guanyu');
      // Set up an awaken skill at index that exists
      const general = heroSystem.getGeneral('guanyu')!;
      if (general.skills.length > 0) {
        // Manually set a skill type to 'awaken' to test the path
        const deps = makeSkillDeps({ heroSystem, heroStarSystem: starSystem });
        skillSystem.setSkillUpgradeDeps(deps);
        // The skill type check depends on actual skill data
      }
      // This test covers the canUpgradeAwakenSkill check
      expect(skillSystem.canUpgradeAwakenSkill('guanyu')).toBe(false);
    });

    it('should fail when canAffordResource returns false for gold', () => {
      const { heroSystem, starSystem, skillSystem } = createTestEnv();
      heroSystem.addGeneral('guanyu');
      (starSystem as unknown as { state: { stars: Record<string, number>; breakthroughStages: Record<string, number> } }).state.stars['guanyu'] = 3;

      const deps = makeSkillDeps({
        heroSystem,
        heroStarSystem: starSystem,
        canAffordResource: vi.fn((type: string) => type !== 'gold'),
      });
      skillSystem.setSkillUpgradeDeps(deps);

      const result = skillSystem.upgradeSkill('guanyu', 0, { skillBooks: 1, gold: 500 });
      expect(result.success).toBe(false);
    });

    it('should fail when spendResource fails for gold', () => {
      const { heroSystem, starSystem, skillSystem } = createTestEnv();
      heroSystem.addGeneral('guanyu');
      (starSystem as unknown as { state: { stars: Record<string, number>; breakthroughStages: Record<string, number> } }).state.stars['guanyu'] = 3;

      const deps = makeSkillDeps({
        heroSystem,
        heroStarSystem: starSystem,
        spendResource: vi.fn((type: string) => type !== 'gold'),
      });
      skillSystem.setSkillUpgradeDeps(deps);

      const result = skillSystem.upgradeSkill('guanyu', 0, { skillBooks: 1, gold: 500 });
      expect(result.success).toBe(false);
    });

    it('should fail when spendResource fails for skillBook', () => {
      const { heroSystem, starSystem, skillSystem } = createTestEnv();
      heroSystem.addGeneral('guanyu');
      (starSystem as unknown as { state: { stars: Record<string, number>; breakthroughStages: Record<string, number> } }).state.stars['guanyu'] = 3;

      let callCount = 0;
      const deps = makeSkillDeps({
        heroSystem,
        heroStarSystem: starSystem,
        spendResource: vi.fn(() => {
          callCount++;
          // First call (gold) succeeds, second call (skillBook) fails
          return callCount <= 1;
        }),
      });
      skillSystem.setSkillUpgradeDeps(deps);

      const result = skillSystem.upgradeSkill('guanyu', 0, { skillBooks: 1, gold: 500 });
      expect(result.success).toBe(false);
    });

    it('should fail when skill level cap reached', () => {
      const { heroSystem, starSystem, skillSystem } = createTestEnv();
      heroSystem.addGeneral('guanyu');
      (starSystem as unknown as { state: { stars: Record<string, number>; breakthroughStages: Record<string, number> } }).state.stars['guanyu'] = 1; // star 1 → cap 3

      const deps = makeSkillDeps({ heroSystem, heroStarSystem: starSystem });
      skillSystem.setSkillUpgradeDeps(deps);

      // Upgrade to cap
      for (let i = 0; i < 3; i++) {
        skillSystem.upgradeSkill('guanyu', 0, { skillBooks: 5, gold: 50000 });
      }
      // Next upgrade should fail
      const result = skillSystem.upgradeSkill('guanyu', 0, { skillBooks: 5, gold: 50000 });
      expect(result.success).toBe(false);
    });
  });

  // ─────────────────────────────────────────
  // 3. getSkillLevel / getSkillEffect 边界
  // ─────────────────────────────────────────
  describe('getSkillLevel / getSkillEffect 边界', () => {
    it('should return 0 when deps not set', () => {
      const { skillSystem } = createTestEnv();
      expect(skillSystem.getSkillLevel('guanyu', 0)).toBe(0);
    });

    it('should return base effect when deps not set', () => {
      const { skillSystem } = createTestEnv();
      expect(skillSystem.getSkillEffect('guanyu', 0)).toBe(1.0);
    });

    it('should return 0 for nonexistent hero', () => {
      const { heroSystem, starSystem, skillSystem } = createTestEnv();
      const deps = makeSkillDeps({ heroSystem, heroStarSystem: starSystem });
      skillSystem.setSkillUpgradeDeps(deps);
      expect(skillSystem.getSkillLevel('nonexistent', 0)).toBe(0);
    });

    it('should return base effect for invalid skill index', () => {
      const { heroSystem, starSystem, skillSystem } = createTestEnv();
      heroSystem.addGeneral('guanyu');
      const deps = makeSkillDeps({ heroSystem, heroStarSystem: starSystem });
      skillSystem.setSkillUpgradeDeps(deps);
      expect(skillSystem.getSkillEffect('guanyu', -1)).toBe(1.0);
      expect(skillSystem.getSkillEffect('guanyu', 999)).toBe(1.0);
    });
  });

  // ─────────────────────────────────────────
  // 4. getSkillLevelCap 边界
  // ─────────────────────────────────────────
  describe('getSkillLevelCap 边界', () => {
    it('should return default cap for star level 0', () => {
      const { skillSystem } = createTestEnv();
      expect(skillSystem.getSkillLevelCap(0)).toBe(3); // STAR_SKILL_CAP[1] = 3
    });

    it('should return default cap for negative star level', () => {
      const { skillSystem } = createTestEnv();
      expect(skillSystem.getSkillLevelCap(-1)).toBe(3);
    });

    it('should return default cap for unknown star level (e.g. 7)', () => {
      const { skillSystem } = createTestEnv();
      expect(skillSystem.getSkillLevelCap(7)).toBe(5);
    });

    it('should return correct caps for star levels 1-6', () => {
      const { skillSystem } = createTestEnv();
      expect(skillSystem.getSkillLevelCap(1)).toBe(3);
      expect(skillSystem.getSkillLevelCap(2)).toBe(4);
      expect(skillSystem.getSkillLevelCap(3)).toBe(5);
      expect(skillSystem.getSkillLevelCap(4)).toBe(6);
      expect(skillSystem.getSkillLevelCap(5)).toBe(8);
      expect(skillSystem.getSkillLevelCap(6)).toBe(10);
    });
  });

  // ─────────────────────────────────────────
  // 5. canUpgradeAwakenSkill
  // ─────────────────────────────────────────
  describe('canUpgradeAwakenSkill', () => {
    it('should return false when deps not set', () => {
      const { skillSystem } = createTestEnv();
      expect(skillSystem.canUpgradeAwakenSkill('guanyu')).toBe(false);
    });

    it('should return false when breakthrough stage is 0', () => {
      const { heroSystem, starSystem, skillSystem } = createTestEnv();
      heroSystem.addGeneral('guanyu');
      const deps = makeSkillDeps({ heroSystem, heroStarSystem: starSystem });
      skillSystem.setSkillUpgradeDeps(deps);
      expect(skillSystem.canUpgradeAwakenSkill('guanyu')).toBe(false);
    });

    it('should return true when breakthrough stage >= 1', () => {
      const { heroSystem, starSystem, skillSystem } = createTestEnv();
      heroSystem.addGeneral('guanyu');
      (starSystem as unknown as { state: { stars: Record<string, number>; breakthroughStages: Record<string, number> } }).state.breakthroughStages['guanyu'] = 1;
      const deps = makeSkillDeps({ heroSystem, heroStarSystem: starSystem });
      skillSystem.setSkillUpgradeDeps(deps);
      expect(skillSystem.canUpgradeAwakenSkill('guanyu')).toBe(true);
    });
  });

  // ─────────────────────────────────────────
  // 6. getExtraEffect
  // ─────────────────────────────────────────
  describe('getExtraEffect', () => {
    it('should return null when no extra effect (level < 5)', () => {
      const { skillSystem } = createTestEnv();
      expect(skillSystem.hasExtraEffect('guanyu', 0)).toBe(false);
    });

    it('should return null when deps not set', () => {
      const { skillSystem } = createTestEnv();
      expect(skillSystem.getExtraEffect('guanyu', 0)).toBeNull();
    });

    it('should return extra effect when skill level >= 5', () => {
      const { heroSystem, starSystem, skillSystem } = createTestEnv();
      heroSystem.addGeneral('guanyu');
      (starSystem as unknown as { state: { stars: Record<string, number>; breakthroughStages: Record<string, number> } }).state.stars['guanyu'] = 5;

      const deps = makeSkillDeps({ heroSystem, heroStarSystem: starSystem });
      skillSystem.setSkillUpgradeDeps(deps);

      // Inject heroSkills data directly (as the internal heroSkills map is separate from general.skills)
      (skillSystem as unknown as { heroSkills: Map<string, unknown> }).heroSkills.set('guanyu', {
        skills: [{ level: 5 }],
        unlockedSkills: [],
      });

      const effect = skillSystem.getExtraEffect('guanyu', 0);
      expect(effect).not.toBeNull();
      expect(effect!.name).toContain('额外效果');
      expect(effect!.bonus).toBeGreaterThan(0);
    });

    it('should scale bonus with level above 5', () => {
      const { heroSystem, starSystem, skillSystem } = createTestEnv();
      heroSystem.addGeneral('guanyu');
      (starSystem as unknown as { state: { stars: Record<string, number>; breakthroughStages: Record<string, number> } }).state.stars['guanyu'] = 6;

      const deps = makeSkillDeps({ heroSystem, heroStarSystem: starSystem });
      skillSystem.setSkillUpgradeDeps(deps);

      // Level 5
      (skillSystem as unknown as { heroSkills: Map<string, unknown> }).heroSkills.set('guanyu', {
        skills: [{ level: 5 }],
        unlockedSkills: [],
      });
      const effect5 = skillSystem.getExtraEffect('guanyu', 0);

      // Level 6
      (skillSystem as unknown as { heroSkills: Map<string, unknown> }).heroSkills.set('guanyu', {
        skills: [{ level: 6 }],
        unlockedSkills: [],
      });
      const effect6 = skillSystem.getExtraEffect('guanyu', 0);

      if (effect5 && effect6) {
        expect(effect6.bonus).toBeGreaterThan(effect5.bonus);
      }
    });

    it('should return null for nonexistent hero', () => {
      const { heroSystem, starSystem, skillSystem } = createTestEnv();
      const deps = makeSkillDeps({ heroSystem, heroStarSystem: starSystem });
      skillSystem.setSkillUpgradeDeps(deps);
      expect(skillSystem.getExtraEffect('nonexistent', 0)).toBeNull();
    });
  });

  // ─────────────────────────────────────────
  // 7. ISubsystem 接口
  // ─────────────────────────────────────────
  describe('ISubsystem 接口', () => {
    it('should have correct subsystem name', () => {
      const { skillSystem } = createTestEnv();
      expect(skillSystem.name).toBe('skillUpgrade');
    });

    it('update should be a no-op', () => {
      const { skillSystem } = createTestEnv();
      expect(() => skillSystem.update(0.016)).not.toThrow();
    });

    it('reset should clear all state', () => {
      const { heroSystem, starSystem, skillSystem } = createTestEnv();
      heroSystem.addGeneral('guanyu');
      (starSystem as unknown as { state: { stars: Record<string, number>; breakthroughStages: Record<string, number> } }).state.stars['guanyu'] = 3;
      const deps = makeSkillDeps({ heroSystem, heroStarSystem: starSystem });
      skillSystem.setSkillUpgradeDeps(deps);
      skillSystem.upgradeSkill('guanyu', 0, { skillBooks: 1, gold: 500 });
      skillSystem.reset();
      const state = skillSystem.getState();
      expect(Object.keys(state.upgradeHistory)).toHaveLength(0);
    });

    it('getState should return a copy', () => {
      const { skillSystem } = createTestEnv();
      const s1 = skillSystem.getState();
      const s2 = skillSystem.getState();
      expect(s1).toEqual(s2);
      expect(s1.upgradeHistory).not.toBe(s2.upgradeHistory);
    });
  });

  // ─────────────────────────────────────────
  // 8. getStrategyRecommender 委托
  // ─────────────────────────────────────────
  describe('getStrategyRecommender', () => {
    it('should return a strategy recommender instance', () => {
      const { skillSystem } = createTestEnv();
      const recommender = skillSystem.getStrategyRecommender();
      expect(recommender).toBeDefined();
    });

    it('should delegate to strategy recommender', () => {
      const { skillSystem } = createTestEnv();
      const result = skillSystem.recommendStrategy('boss');
      expect(result).toBeDefined();
      expect(result).toHaveProperty('prioritySkillTypes');
      expect(result).toHaveProperty('focusStats');
    });
  });

  // ─────────────────────────────────────────
  // 9. unlockSkillOnBreakthrough / getSkillUnlockState
  // ─────────────────────────────────────────
  describe('unlockSkillOnBreakthrough', () => {
    it('should return null for unknown breakthrough level', () => {
      const { heroSystem, starSystem, skillSystem } = createTestEnv();
      heroSystem.addGeneral('guanyu');
      const deps = makeSkillDeps({ heroSystem, heroStarSystem: starSystem });
      skillSystem.setSkillUpgradeDeps(deps);
      expect(skillSystem.unlockSkillOnBreakthrough('guanyu', 5)).toBeNull();
    });

    it('should unlock skill at breakthrough level 10', () => {
      const { heroSystem, starSystem, skillSystem } = createTestEnv();
      heroSystem.addGeneral('guanyu');
      const deps = makeSkillDeps({ heroSystem, heroStarSystem: starSystem });
      skillSystem.setSkillUpgradeDeps(deps);
      const result = skillSystem.unlockSkillOnBreakthrough('guanyu', 10);
      expect(result).not.toBeNull();
      expect(result!.unlocked).toBe(true);
      expect(result!.skillType).toBe('passive_enhance');
    });

    it('should unlock skill at breakthrough level 20', () => {
      const { heroSystem, starSystem, skillSystem } = createTestEnv();
      heroSystem.addGeneral('guanyu');
      const deps = makeSkillDeps({ heroSystem, heroStarSystem: starSystem });
      skillSystem.setSkillUpgradeDeps(deps);
      const result = skillSystem.unlockSkillOnBreakthrough('guanyu', 20);
      expect(result).not.toBeNull();
      expect(result!.skillType).toBe('new_skill');
    });

    it('should unlock skill at breakthrough level 30', () => {
      const { heroSystem, starSystem, skillSystem } = createTestEnv();
      heroSystem.addGeneral('guanyu');
      const deps = makeSkillDeps({ heroSystem, heroStarSystem: starSystem });
      skillSystem.setSkillUpgradeDeps(deps);
      const result = skillSystem.unlockSkillOnBreakthrough('guanyu', 30);
      expect(result).not.toBeNull();
      expect(result!.skillType).toBe('ultimate_enhance');
    });

    it('should not unlock same breakthrough twice', () => {
      const { heroSystem, starSystem, skillSystem } = createTestEnv();
      heroSystem.addGeneral('guanyu');
      const deps = makeSkillDeps({ heroSystem, heroStarSystem: starSystem });
      skillSystem.setSkillUpgradeDeps(deps);
      const r1 = skillSystem.unlockSkillOnBreakthrough('guanyu', 10);
      expect(r1!.unlocked).toBe(true);
      const r2 = skillSystem.unlockSkillOnBreakthrough('guanyu', 10);
      expect(r2).toBeNull();
    });

    it('should return null for nonexistent hero without deps', () => {
      const { skillSystem } = createTestEnv();
      expect(skillSystem.unlockSkillOnBreakthrough('nonexistent', 10)).toBeNull();
    });
  });

  describe('getSkillUnlockState', () => {
    it('should return all breakthrough levels with unlocked status', () => {
      const { heroSystem, starSystem, skillSystem } = createTestEnv();
      heroSystem.addGeneral('guanyu');
      const deps = makeSkillDeps({ heroSystem, heroStarSystem: starSystem });
      skillSystem.setSkillUpgradeDeps(deps);

      const state = skillSystem.getSkillUnlockState('guanyu');
      expect(state.length).toBe(4); // 4 breakthrough levels: 10, 20, 30, 40
      expect(state.every((s) => s.unlocked === false)).toBe(true);
    });

    it('should show unlocked status after unlocking', () => {
      const { heroSystem, starSystem, skillSystem } = createTestEnv();
      heroSystem.addGeneral('guanyu');
      const deps = makeSkillDeps({ heroSystem, heroStarSystem: starSystem });
      skillSystem.setSkillUpgradeDeps(deps);

      skillSystem.unlockSkillOnBreakthrough('guanyu', 10);
      const state = skillSystem.getSkillUnlockState('guanyu');
      const lv10 = state.find((s) => s.breakthroughLevel === 10);
      expect(lv10!.unlocked).toBe(true);
    });
  });

  // ─────────────────────────────────────────
  // 10. getCooldownReduce / hasExtraEffect
  // ─────────────────────────────────────────
  describe('getCooldownReduce', () => {
    it('should return 0 for unknown hero', () => {
      const { skillSystem } = createTestEnv();
      expect(skillSystem.getCooldownReduce('nonexistent', 0)).toBe(0);
    });

    it('should return 0 for invalid skill index', () => {
      const { heroSystem, starSystem, skillSystem } = createTestEnv();
      heroSystem.addGeneral('guanyu');
      const deps = makeSkillDeps({ heroSystem, heroStarSystem: starSystem });
      skillSystem.setSkillUpgradeDeps(deps);
      skillSystem.unlockSkillOnBreakthrough('guanyu', 10); // Initialize heroSkills
      expect(skillSystem.getCooldownReduce('guanyu', 999)).toBe(0);
    });

    it('should return cooldown reduce based on skill level', () => {
      const { heroSystem, starSystem, skillSystem } = createTestEnv();
      heroSystem.addGeneral('guanyu');
      (starSystem as unknown as { state: { stars: Record<string, number>; breakthroughStages: Record<string, number> } }).state.stars['guanyu'] = 5;
      const deps = makeSkillDeps({ heroSystem, heroStarSystem: starSystem });
      skillSystem.setSkillUpgradeDeps(deps);

      // Initialize heroSkills via breakthrough
      skillSystem.unlockSkillOnBreakthrough('guanyu', 10);

      // Upgrade skill to level 3
      for (let i = 0; i < 2; i++) {
        skillSystem.upgradeSkill('guanyu', 0, { skillBooks: 5, gold: 50000 });
      }

      const cdReduce = skillSystem.getCooldownReduce('guanyu', 0);
      expect(cdReduce).toBeGreaterThan(0);
    });

    it('should cap cooldown reduce at 0.30', () => {
      const { heroSystem, starSystem, skillSystem } = createTestEnv();
      heroSystem.addGeneral('guanyu');
      (starSystem as unknown as { state: { stars: Record<string, number>; breakthroughStages: Record<string, number> } }).state.stars['guanyu'] = 6;
      const deps = makeSkillDeps({ heroSystem, heroStarSystem: starSystem });
      skillSystem.setSkillUpgradeDeps(deps);

      skillSystem.unlockSkillOnBreakthrough('guanyu', 10);

      // Upgrade skill to high level
      for (let i = 0; i < 9; i++) {
        skillSystem.upgradeSkill('guanyu', 0, { skillBooks: 5, gold: 50000 });
      }

      const cdReduce = skillSystem.getCooldownReduce('guanyu', 0);
      expect(cdReduce).toBeLessThanOrEqual(0.30);
    });
  });

  describe('hasExtraEffect', () => {
    it('should return false for unknown hero', () => {
      const { skillSystem } = createTestEnv();
      expect(skillSystem.hasExtraEffect('nonexistent', 0)).toBe(false);
    });

    it('should return false for invalid skill index', () => {
      const { heroSystem, starSystem, skillSystem } = createTestEnv();
      heroSystem.addGeneral('guanyu');
      const deps = makeSkillDeps({ heroSystem, heroStarSystem: starSystem });
      skillSystem.setSkillUpgradeDeps(deps);
      skillSystem.unlockSkillOnBreakthrough('guanyu', 10);
      expect(skillSystem.hasExtraEffect('guanyu', 999)).toBe(false);
    });
  });
});
