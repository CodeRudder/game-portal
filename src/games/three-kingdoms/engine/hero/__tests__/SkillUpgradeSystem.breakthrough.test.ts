/**
 * SkillUpgradeSystem 单元测试 — P0突破解锁技能/CD减少/额外效果
 *
 * 覆盖功能点：F4.06/F4.07/F4.08 突破解锁技能、F5.08/F5.09 CD减少和额外效果
 *
 * 注意：unlockSkillOnBreakthrough / getCooldownReduce / hasExtraEffect
 * 依赖 SkillUpgradeSystem 内部的 heroSkills Map（private），
 * 测试中通过 (system as unknown as Record<string, unknown>).heroSkills 注入测试数据。
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SkillUpgradeSystem } from '../SkillUpgradeSystem';
import { HeroSystem } from '../HeroSystem';
import { HeroStarSystem } from '../HeroStarSystem';
import type { SkillUpgradeDeps, HeroSkillEntry } from '../SkillUpgradeSystem';

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

/**
 * 向 SkillUpgradeSystem 的 heroSkills Map 注入武将技能数据
 * 用于测试依赖 heroSkills 的方法（突破解锁、CD减少、额外效果）
 */
function injectHeroSkills(
  system: SkillUpgradeSystem,
  heroId: string,
  skills: { level: number }[],
  unlockedSkills: string[] = [],
): void {
  const entry: HeroSkillEntry = { skills, unlockedSkills: [...unlockedSkills] };
  (system as unknown as Record<string, unknown>).heroSkills.set(heroId, entry);
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
    it('突破等级10解锁被动技能强化', () => {
      // 注入武将技能数据（heroSkills Map 中必须有该武将）
      injectHeroSkills(skillSystem, 'guanyu', [{ level: 1 }, { level: 1 }]);

      const result = skillSystem.unlockSkillOnBreakthrough('guanyu', 10);

      expect(result).not.toBeNull();
      expect(result!.unlocked).toBe(true);
      expect(result!.skillType).toBe('passive_enhance');
      expect(result!.description).toContain('被动技能强化');
    });

    it('突破等级20解锁新技能', () => {
      injectHeroSkills(skillSystem, 'zhangfei', [{ level: 1 }, { level: 1 }, { level: 1 }, { level: 1 }]);

      const result = skillSystem.unlockSkillOnBreakthrough('zhangfei', 20);

      expect(result).not.toBeNull();
      expect(result!.unlocked).toBe(true);
      expect(result!.skillType).toBe('new_skill');
      expect(result!.description).toContain('解锁新技能');
    });

    it('突破等级30解锁终极技能强化', () => {
      injectHeroSkills(skillSystem, 'liubei', [{ level: 1 }, { level: 1 }]);

      const result = skillSystem.unlockSkillOnBreakthrough('liubei', 30);

      expect(result).not.toBeNull();
      expect(result!.unlocked).toBe(true);
      expect(result!.skillType).toBe('ultimate_enhance');
      expect(result!.description).toContain('终极技能强化');
    });

    it('突破等级40解锁终极强化+', () => {
      injectHeroSkills(skillSystem, 'guanyu', [{ level: 1 }, { level: 1 }]);

      const result = skillSystem.unlockSkillOnBreakthrough('guanyu', 40);

      expect(result).not.toBeNull();
      expect(result!.unlocked).toBe(true);
      expect(result!.skillType).toBe('ultimate_enhance_plus');
      expect(result!.description).toContain('终极技能强化+');
    });

    it('无效突破等级返回 null', () => {
      injectHeroSkills(skillSystem, 'guanyu', [{ level: 1 }]);

      expect(skillSystem.unlockSkillOnBreakthrough('guanyu', 5)).toBeNull();
      expect(skillSystem.unlockSkillOnBreakthrough('guanyu', 15)).toBeNull();
      expect(skillSystem.unlockSkillOnBreakthrough('guanyu', 99)).toBeNull();
    });

    it('武将不在 heroSkills 中返回 null', () => {
      expect(skillSystem.unlockSkillOnBreakthrough('nonexistent', 10)).toBeNull();
    });

    it('重复解锁同一突破等级返回 null', () => {
      injectHeroSkills(skillSystem, 'guanyu', [{ level: 1 }]);

      // 第一次解锁成功
      const first = skillSystem.unlockSkillOnBreakthrough('guanyu', 10);
      expect(first).not.toBeNull();

      // 第二次解锁同一等级返回 null
      const second = skillSystem.unlockSkillOnBreakthrough('guanyu', 10);
      expect(second).toBeNull();
    });

    it('不同武将独立解锁', () => {
      injectHeroSkills(skillSystem, 'guanyu', [{ level: 1 }]);
      injectHeroSkills(skillSystem, 'zhangfei', [{ level: 1 }]);

      const r1 = skillSystem.unlockSkillOnBreakthrough('guanyu', 10);
      const r2 = skillSystem.unlockSkillOnBreakthrough('zhangfei', 10);

      expect(r1).not.toBeNull();
      expect(r2).not.toBeNull();
      expect(r1!.unlocked).toBe(true);
      expect(r2!.unlocked).toBe(true);
    });
  });

  describe('getSkillUnlockState', () => {
    it('未解锁时所有突破等级状态为 false', () => {
      injectHeroSkills(skillSystem, 'guanyu', [{ level: 1 }]);

      const states = skillSystem.getSkillUnlockState('guanyu');

      // 应包含 10, 20, 30, 40 四个突破等级
      expect(states.length).toBe(4);
      for (const s of states) {
        expect(s.unlocked).toBe(false);
      }
    });

    it('解锁后对应突破等级状态为 true', () => {
      injectHeroSkills(skillSystem, 'guanyu', [{ level: 1 }]);

      skillSystem.unlockSkillOnBreakthrough('guanyu', 10);

      const states = skillSystem.getSkillUnlockState('guanyu');
      const lv10 = states.find(s => s.breakthroughLevel === 10);
      const lv20 = states.find(s => s.breakthroughLevel === 20);

      expect(lv10).toBeDefined();
      expect(lv10!.unlocked).toBe(true);
      expect(lv20).toBeDefined();
      expect(lv20!.unlocked).toBe(false);
    });

    it('多次突破后多个等级状态为 true', () => {
      injectHeroSkills(skillSystem, 'guanyu', [{ level: 1 }]);

      skillSystem.unlockSkillOnBreakthrough('guanyu', 10);
      skillSystem.unlockSkillOnBreakthrough('guanyu', 20);

      const states = skillSystem.getSkillUnlockState('guanyu');
      const unlocked = states.filter(s => s.unlocked);
      expect(unlocked.length).toBe(2);
    });

    it('武将不在 heroSkills 中时全部为 false', () => {
      const states = skillSystem.getSkillUnlockState('nonexistent');
      expect(states.length).toBe(4);
      for (const s of states) {
        expect(s.unlocked).toBe(false);
      }
    });
  });
});

// ═══════════════════════════════════════════
// P0-2: 技能CD减少和额外效果
// ═══════════════════════════════════════════

describe('SkillUpgradeSystem CD减少和额外效果 (F5.08/F5.09)', () => {
  let skillSystem: SkillUpgradeSystem;

  beforeEach(() => {
    const setup = createTestSetup();
    skillSystem = setup.skillSystem;
  });

  describe('getCooldownReduce', () => {
    it('技能等级1时CD减少为 0.05', () => {
      injectHeroSkills(skillSystem, 'guanyu', [{ level: 1 }]);
      expect(skillSystem.getCooldownReduce('guanyu', 0)).toBe(0.05);
    });

    it('每级减少5%，等级4时CD减少为 0.20', () => {
      injectHeroSkills(skillSystem, 'guanyu', [{ level: 4 }]);
      expect(skillSystem.getCooldownReduce('guanyu', 0)).toBeCloseTo(0.20);
    });

    it('等级6时CD减少为 0.30（达到上限）', () => {
      injectHeroSkills(skillSystem, 'guanyu', [{ level: 6 }]);
      expect(skillSystem.getCooldownReduce('guanyu', 0)).toBe(0.30);
    });

    it('等级10时CD减少仍为 0.30（不超过上限）', () => {
      injectHeroSkills(skillSystem, 'guanyu', [{ level: 10 }]);
      expect(skillSystem.getCooldownReduce('guanyu', 0)).toBe(0.30);
    });

    it('不存在的武将返回 0', () => {
      expect(skillSystem.getCooldownReduce('nonexistent', 0)).toBe(0);
    });

    it('无效技能索引返回 0', () => {
      injectHeroSkills(skillSystem, 'guanyu', [{ level: 5 }]);
      expect(skillSystem.getCooldownReduce('guanyu', 99)).toBe(0);
    });
  });

  describe('hasExtraEffect', () => {
    it('技能等级 < 5 时返回 false', () => {
      injectHeroSkills(skillSystem, 'guanyu', [{ level: 4 }]);
      expect(skillSystem.hasExtraEffect('guanyu', 0)).toBe(false);
    });

    it('技能等级 ≥ 5 时返回 true', () => {
      injectHeroSkills(skillSystem, 'guanyu', [{ level: 5 }]);
      expect(skillSystem.hasExtraEffect('guanyu', 0)).toBe(true);
    });

    it('技能等级 > 5 时返回 true', () => {
      injectHeroSkills(skillSystem, 'guanyu', [{ level: 8 }]);
      expect(skillSystem.hasExtraEffect('guanyu', 0)).toBe(true);
    });

    it('不存在的武将返回 false', () => {
      expect(skillSystem.hasExtraEffect('nonexistent', 0)).toBe(false);
    });

    it('无效技能索引返回 false', () => {
      injectHeroSkills(skillSystem, 'guanyu', [{ level: 5 }]);
      expect(skillSystem.hasExtraEffect('guanyu', 99)).toBe(false);
    });
  });
});
