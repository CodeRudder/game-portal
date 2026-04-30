/**
 * AwakeningSystem 补充测试 — 覆盖已有测试未覆盖的盲区
 *
 * 聚焦：
 *   1. getAwakeningSkillPreview（不要求已觉醒）
 *   2. calculateAwakenedStats — 未觉醒/不存在武将
 *   3. getAwakeningStatDiff — 差值计算边界
 *   4. getPassiveSummary — 多阵营、上限叠加、空状态
 *   5. 序列化/反序列化 — 版本不匹配、空数据
 *   6. ISubsystem 接口 — update/getState
 *   7. 觉醒经验/金币表边界
 *   8. 资源不足路径 — checkResources/spendResources 分支
 *   9. getAwakenedLevelCap
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AwakeningSystem } from '../AwakeningSystem';
import type { AwakeningDeps } from '../AwakeningSystem';
import { HeroSystem } from '../HeroSystem';
import { HeroStarSystem } from '../HeroStarSystem';
import { Quality } from '../hero.types';
import {
  AWAKENING_MAX_LEVEL,
  AWAKENING_COST,
  AWAKENING_STAT_MULTIPLIER,
  AWAKENING_SAVE_VERSION,
  AWAKENING_PASSIVE,
  AWAKENING_EXP_TABLE,
  AWAKENING_GOLD_TABLE,
} from '../awakening-config';

// ── 辅助 ──

function makeMockCoreDeps() {
  return {
    eventBus: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
    config: { get: vi.fn(), set: vi.fn(), has: vi.fn() },
    registry: { get: vi.fn(), register: vi.fn(), has: vi.fn(), getAll: vi.fn(), unregister: vi.fn() },
  };
}

interface MockResources {
  gold: number;
  breakthroughStone: number;
  skillBook: number;
  awakeningStone: number;
}

function makeAwakeningDeps(resources?: Partial<MockResources>): AwakeningDeps & { resources: MockResources } {
  const res: MockResources = {
    gold: resources?.gold ?? 999999999,
    breakthroughStone: resources?.breakthroughStone ?? 999999999,
    skillBook: resources?.skillBook ?? 999999999,
    awakeningStone: resources?.awakeningStone ?? 999999999,
  };
  return {
    resources: res,
    canAffordResource: vi.fn((type: string, amount: number) => (res[type as keyof MockResources] ?? 0) >= amount),
    spendResource: vi.fn((type: string, amount: number) => {
      if ((res[type as keyof MockResources] ?? 0) >= amount) {
        res[type as keyof MockResources] -= amount;
        return true;
      }
      return false;
    }),
    getResourceAmount: vi.fn((type: string) => res[type as keyof MockResources] ?? 0),
  };
}

function makeStarDeps() {
  const resources: Record<string, number> = { gold: 999999999, breakthroughStone: 999999999 };
  return {
    resources,
    spendFragments: vi.fn(),
    getFragments: vi.fn(),
    spendResource: vi.fn((type: string, amount: number) => {
      if ((resources[type] ?? 0) >= amount) { resources[type] -= amount; return true; }
      return false;
    }),
    canAffordResource: vi.fn((type: string, amount: number) => (resources[type] ?? 0) >= amount),
    getResourceAmount: vi.fn((type: string) => resources[type] ?? 0),
  };
}

function createTestEnv(
  heroId: string,
  opts?: {
    level?: number;
    star?: number;
    breakthrough?: number;
    fragments?: number;
    resources?: Partial<MockResources>;
  },
) {
  const heroSystem = new HeroSystem();
  heroSystem.init(makeMockCoreDeps());
  heroSystem.addGeneral(heroId);

  if (opts?.fragments) {
    heroSystem.addFragment(heroId, opts.fragments);
  }
  if (opts?.level) {
    heroSystem.setLevelAndExp(heroId, opts.level, 0);
  }

  const starSystem = new HeroStarSystem(heroSystem);
  starSystem.init(makeMockCoreDeps());
  const starDeps = makeStarDeps();
  starDeps.getFragments = (id: string) => heroSystem.getFragments(id);
  starDeps.spendFragments = (id: string, count: number) => heroSystem.useFragments(id, count);
  starSystem.setDeps(starDeps);
  heroSystem.setLevelCapGetter((id: string) => starSystem.getLevelCap(id));

  if (opts?.star) {
    (starSystem as any).state.stars[heroId] = opts.star;
  }
  if (opts?.breakthrough) {
    (starSystem as any).state.breakthroughStages[heroId] = opts.breakthrough;
  }

  const awakeningSystem = new AwakeningSystem(heroSystem, starSystem);
  awakeningSystem.init(makeMockCoreDeps());
  const awakeningDeps = makeAwakeningDeps(opts?.resources);
  awakeningSystem.setDeps(awakeningDeps);

  return { heroSystem, starSystem, awakeningSystem, awakeningDeps };
}

// ═══════════════════════════════════════════
// 测试
// ═══════════════════════════════════════════

describe('AwakeningSystem — 补充覆盖', () => {

  // ─────────────────────────────────────────
  // 1. getAwakeningSkillPreview
  // ─────────────────────────────────────────
  describe('getAwakeningSkillPreview', () => {
    it('should return skill preview even for unawakened hero', () => {
      const { awakeningSystem } = createTestEnv('guanyu');
      const preview = awakeningSystem.getAwakeningSkillPreview('guanyu');
      expect(preview).not.toBeNull();
    });

    it('should return null for hero without awakening skill definition', () => {
      const { awakeningSystem } = createTestEnv('guanyu');
      const preview = awakeningSystem.getAwakeningSkillPreview('nonexistent_hero');
      expect(preview).toBeNull();
    });
  });

  // ─────────────────────────────────────────
  // 2. calculateAwakenedStats — 边界
  // ─────────────────────────────────────────
  describe('calculateAwakenedStats 边界', () => {
    it('should return zero stats for nonexistent hero', () => {
      const { awakeningSystem } = createTestEnv('guanyu');
      const stats = awakeningSystem.calculateAwakenedStats('nonexistent');
      expect(stats).toEqual({ attack: 0, defense: 0, intelligence: 0, speed: 0 });
    });

    it('should return base stats (not multiplied) for unawakened hero', () => {
      const { awakeningSystem, heroSystem } = createTestEnv('guanyu');
      const general = heroSystem.getGeneral('guanyu')!;
      const stats = awakeningSystem.calculateAwakenedStats('guanyu');
      expect(stats.attack).toBe(general.baseStats.attack);
      expect(stats.defense).toBe(general.baseStats.defense);
    });

    it('should apply multiplier after awakening', () => {
      const { awakeningSystem, heroSystem } = createTestEnv('guanyu', {
        level: 100, star: 6, breakthrough: 4, fragments: 300,
      });
      const baseStats = heroSystem.getGeneral('guanyu')!.baseStats;
      awakeningSystem.awaken('guanyu');
      const stats = awakeningSystem.calculateAwakenedStats('guanyu');
      expect(stats.attack).toBe(Math.floor(baseStats.attack * AWAKENING_STAT_MULTIPLIER));
      expect(stats.defense).toBe(Math.floor(baseStats.defense * AWAKENING_STAT_MULTIPLIER));
    });
  });

  // ─────────────────────────────────────────
  // 3. getAwakeningStatDiff
  // ─────────────────────────────────────────
  describe('getAwakeningStatDiff', () => {
    it('should return zero diff for unawakened hero', () => {
      const { awakeningSystem } = createTestEnv('guanyu');
      const diff = awakeningSystem.getAwakeningStatDiff('guanyu');
      expect(diff.attack).toBe(0);
      expect(diff.defense).toBe(0);
    });

    it('should return positive diff after awakening', () => {
      const { awakeningSystem } = createTestEnv('guanyu', {
        level: 100, star: 6, breakthrough: 4, fragments: 300,
      });
      awakeningSystem.awaken('guanyu');
      const diff = awakeningSystem.getAwakeningStatDiff('guanyu');
      expect(diff.attack).toBeGreaterThan(0);
      expect(diff.defense).toBeGreaterThan(0);
    });

    it('should return zero diff for nonexistent hero', () => {
      const { awakeningSystem } = createTestEnv('guanyu');
      const diff = awakeningSystem.getAwakeningStatDiff('nonexistent');
      expect(diff).toEqual({ attack: 0, defense: 0, intelligence: 0, speed: 0 });
    });
  });

  // ─────────────────────────────────────────
  // 4. getPassiveSummary — 多阵营/上限
  // ─────────────────────────────────────────
  describe('getPassiveSummary 边界', () => {
    it('should return zero bonuses with no awakened heroes', () => {
      const { awakeningSystem } = createTestEnv('guanyu');
      const summary = awakeningSystem.getPassiveSummary();
      expect(summary.awakenedCount).toBe(0);
      expect(summary.globalStatBonus).toBe(0);
      expect(summary.resourceBonus).toBe(0);
      expect(summary.expBonus).toBe(0);
    });

    it('should cap global stat bonus at max stacks', () => {
      const heroSystem = new HeroSystem();
      heroSystem.init(makeMockCoreDeps());

      const heroIds = ['guanyu', 'zhangfei', 'zhaoyun', 'zhugeliang', 'caocao', 'lvbu'];
      for (const id of heroIds) {
        heroSystem.addGeneral(id);
        heroSystem.setLevelAndExp(id, 100, 0);
        heroSystem.addFragment(id, 300);
      }

      const starSystem = new HeroStarSystem(heroSystem);
      starSystem.init(makeMockCoreDeps());
      const starDeps = makeStarDeps();
      starDeps.getFragments = (id: string) => heroSystem.getFragments(id);
      starDeps.spendFragments = (id: string, count: number) => heroSystem.useFragments(id, count);
      starSystem.setDeps(starDeps);
      heroSystem.setLevelCapGetter((id: string) => starSystem.getLevelCap(id));

      const awakeningSystem = new AwakeningSystem(heroSystem, starSystem);
      awakeningSystem.init(makeMockCoreDeps());
      const awakeningDeps = makeAwakeningDeps();
      awakeningSystem.setDeps(awakeningDeps);

      for (const id of heroIds) {
        (starSystem as any).state.stars[id] = 6;
        (starSystem as any).state.breakthroughStages[id] = 4;
        awakeningSystem.awaken(id);
      }

      const summary = awakeningSystem.getPassiveSummary();
      expect(summary.awakenedCount).toBe(heroIds.length);
      const maxBonus = AWAKENING_PASSIVE.globalMaxStacks * AWAKENING_PASSIVE.globalStatBonus;
      expect(summary.globalStatBonus).toBe(maxBonus);
    });

    it('should include unawakened heroes in state but skip them in passive calc', () => {
      const { awakeningSystem } = createTestEnv('guanyu');
      // Manually add an unawakened entry to state
      (awakeningSystem as any).state.heroes['guanyu'] = { isAwakened: false, awakeningLevel: 0 };
      const summary = awakeningSystem.getPassiveSummary();
      expect(summary.awakenedCount).toBe(0);
      expect(summary.globalStatBonus).toBe(0);
    });
  });

  // ─────────────────────────────────────────
  // 5. 序列化边界
  // ─────────────────────────────────────────
  describe('序列化边界', () => {
    it('should handle deserialization with version mismatch gracefully', () => {
      const { awakeningSystem } = createTestEnv('guanyu');
      expect(() => {
        awakeningSystem.deserialize({ version: 999, state: { heroes: {} } });
      }).not.toThrow();
    });

    it('should handle deserialization with null heroes', () => {
      const { awakeningSystem } = createTestEnv('guanyu');
      awakeningSystem.deserialize({
        version: AWAKENING_SAVE_VERSION,
        state: { heroes: null as any },
      });
      expect(awakeningSystem.isAwakened('guanyu')).toBe(false);
    });

    it('should preserve awakened state through serialize/deserialize cycle', () => {
      const { awakeningSystem } = createTestEnv('guanyu', {
        level: 100, star: 6, breakthrough: 4, fragments: 300,
      });
      awakeningSystem.awaken('guanyu');
      const data = awakeningSystem.serialize();

      const { awakeningSystem: sys2 } = createTestEnv('guanyu');
      sys2.deserialize(data);
      expect(sys2.isAwakened('guanyu')).toBe(true);
    });
  });

  // ─────────────────────────────────────────
  // 6. ISubsystem 接口
  // ─────────────────────────────────────────
  describe('ISubsystem 接口', () => {
    it('update should be a no-op', () => {
      const { awakeningSystem } = createTestEnv('guanyu');
      expect(() => awakeningSystem.update(0.016)).not.toThrow();
    });

    it('getState should return serialized state', () => {
      const { awakeningSystem } = createTestEnv('guanyu');
      const state = awakeningSystem.getState();
      expect(state).toHaveProperty('version');
      expect(state).toHaveProperty('state');
    });

    it('reset should clear all hero states', () => {
      const { awakeningSystem } = createTestEnv('guanyu', {
        level: 100, star: 6, breakthrough: 4, fragments: 300,
      });
      awakeningSystem.awaken('guanyu');
      expect(awakeningSystem.isAwakened('guanyu')).toBe(true);
      awakeningSystem.reset();
      expect(awakeningSystem.isAwakened('guanyu')).toBe(false);
    });
  });

  // ─────────────────────────────────────────
  // 7. 觉醒经验/金币表边界
  // ─────────────────────────────────────────
  describe('觉醒经验/金币表边界', () => {
    it('should return 0 for level below 101', () => {
      const { awakeningSystem } = createTestEnv('guanyu');
      expect(awakeningSystem.getAwakeningExpRequired(100)).toBe(0);
      expect(awakeningSystem.getAwakeningGoldRequired(100)).toBe(0);
    });

    it('should return 0 for level above 120', () => {
      const { awakeningSystem } = createTestEnv('guanyu');
      expect(awakeningSystem.getAwakeningExpRequired(121)).toBe(0);
      expect(awakeningSystem.getAwakeningGoldRequired(121)).toBe(0);
    });

    it('should return positive values for valid awakening levels', () => {
      const { awakeningSystem } = createTestEnv('guanyu');
      for (let lv = 101; lv <= 120; lv++) {
        expect(awakeningSystem.getAwakeningExpRequired(lv)).toBeGreaterThan(0);
        expect(awakeningSystem.getAwakeningGoldRequired(lv)).toBeGreaterThan(0);
      }
    });
  });

  // ─────────────────────────────────────────
  // 8. getAwakeningSkill
  // ─────────────────────────────────────────
  describe('getAwakeningSkill', () => {
    it('should return a copy (not reference) of the skill', () => {
      const { awakeningSystem } = createTestEnv('guanyu');
      const skill1 = awakeningSystem.getAwakeningSkill('guanyu');
      const skill2 = awakeningSystem.getAwakeningSkill('guanyu');
      if (skill1 && skill2) {
        expect(skill1).toEqual(skill2);
        expect(skill1).not.toBe(skill2);
      }
    });
  });

  // ─────────────────────────────────────────
  // 9. 资源不足路径 — 覆盖 checkResources/spendResources 分支
  // ─────────────────────────────────────────
  describe('资源不足路径', () => {
    it('should fail when gold is insufficient', () => {
      const { awakeningSystem } = createTestEnv('guanyu', {
        level: 100, star: 6, breakthrough: 4, fragments: 300,
        resources: { gold: 0, breakthroughStone: 999999, skillBook: 999999, awakeningStone: 999999 },
      });
      const result = awakeningSystem.awaken('guanyu');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('资源不足');
    });

    it('should fail when breakthrough stones are insufficient', () => {
      const { awakeningSystem } = createTestEnv('guanyu', {
        level: 100, star: 6, breakthrough: 4, fragments: 300,
        resources: { gold: 999999, breakthroughStone: 0, skillBook: 999999, awakeningStone: 999999 },
      });
      const result = awakeningSystem.awaken('guanyu');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('资源不足');
    });

    it('should fail when fragments are insufficient', () => {
      const { awakeningSystem } = createTestEnv('guanyu', {
        level: 100, star: 6, breakthrough: 4, fragments: 0,
      });
      const result = awakeningSystem.awaken('guanyu');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('资源不足');
    });

    it('should fail when deps not set (null deps)', () => {
      const heroSystem = new HeroSystem();
      heroSystem.init(makeMockCoreDeps());
      heroSystem.addGeneral('guanyu');
      heroSystem.setLevelAndExp('guanyu', 100, 0);
      heroSystem.addFragment('guanyu', 300);

      const starSystem = new HeroStarSystem(heroSystem);
      starSystem.init(makeMockCoreDeps());
      const starDeps = makeStarDeps();
      starDeps.getFragments = (id: string) => heroSystem.getFragments(id);
      starDeps.spendFragments = (id: string, count: number) => heroSystem.useFragments(id, count);
      starSystem.setDeps(starDeps);
      heroSystem.setLevelCapGetter((id: string) => starSystem.getLevelCap(id));
      (starSystem as any).state.stars['guanyu'] = 6;
      (starSystem as any).state.breakthroughStages['guanyu'] = 4;

      const awakeningSystem = new AwakeningSystem(heroSystem, starSystem);
      awakeningSystem.init(makeMockCoreDeps());
      // NOT calling setDeps — deps stays null

      const result = awakeningSystem.awaken('guanyu');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('资源系统未初始化');
    });
  });

  // ─────────────────────────────────────────
  // 10. getAwakenedLevelCap
  // ─────────────────────────────────────────
  describe('getAwakenedLevelCap', () => {
    it('should return 120 for awakened hero', () => {
      const { awakeningSystem } = createTestEnv('guanyu', {
        level: 100, star: 6, breakthrough: 4, fragments: 300,
      });
      awakeningSystem.awaken('guanyu');
      expect(awakeningSystem.getAwakenedLevelCap('guanyu')).toBe(AWAKENING_MAX_LEVEL);
    });

    it('should return star system cap for unawakened hero', () => {
      const { awakeningSystem, starSystem } = createTestEnv('guanyu', { star: 3 });
      const expectedCap = starSystem.getLevelCap('guanyu');
      expect(awakeningSystem.getAwakenedLevelCap('guanyu')).toBe(expectedCap);
    });
  });

  // ─────────────────────────────────────────
  // 11. getAwakeningState
  // ─────────────────────────────────────────
  describe('getAwakeningState', () => {
    it('should return default state for unknown hero', () => {
      const { awakeningSystem } = createTestEnv('guanyu');
      const state = awakeningSystem.getAwakeningState('nonexistent');
      expect(state).toEqual({ isAwakened: false, awakeningLevel: 0 });
    });

    it('should return awakened state after awakening', () => {
      const { awakeningSystem } = createTestEnv('guanyu', {
        level: 100, star: 6, breakthrough: 4, fragments: 300,
      });
      awakeningSystem.awaken('guanyu');
      const state = awakeningSystem.getAwakeningState('guanyu');
      expect(state.isAwakened).toBe(true);
      expect(state.awakeningLevel).toBe(1);
    });
  });
});
