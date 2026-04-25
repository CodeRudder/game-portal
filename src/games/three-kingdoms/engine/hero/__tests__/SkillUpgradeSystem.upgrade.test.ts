/**
 * 技能升级系统 — 升级核心逻辑测试
 *
 * 覆盖：
 *   1. 技能升级消耗计算
 *   2. 效果增强（每级+10%）
 *   3. 等级上限受星级影响
 *   4. 觉醒技能突破前置检查
 *   5. 策略推荐逻辑
 *   6. ISubsystem 接口合规
 *
 * @module engine/hero/__tests__/SkillUpgradeSystem.upgrade.test
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SkillUpgradeSystem } from '../SkillUpgradeSystem';
import { HeroSystem } from '../HeroSystem';
import { HeroStarSystem } from '../HeroStarSystem';
import type { SkillUpgradeDeps } from '../SkillUpgradeSystem';

// ── 辅助函数 ──────────────────────────────────

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

  const resources: Record<string, number> = { gold: 999999999, skillBooks: 999 };

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

/** 获取武将ID（依赖HeroSystem内部招募机制） */
function getFirstGeneralId(heroSystem: HeroSystem): string | null {
  const all = heroSystem.getAllGenerals();
  return all.length > 0 ? all[0].id : null;
}

// ── 测试 ──────────────────────────────────────

describe('SkillUpgradeSystem — 升级核心逻辑', () => {
  let setup: ReturnType<typeof createTestSetup>;

  beforeEach(() => {
    setup = createTestSetup();
  });

  // ── 1. 技能升级消耗计算 ──

  describe('技能升级消耗计算', () => {
    it('Lv1→Lv2 消耗应为 1技能书 + 500铜钱', () => {
      const { heroSystem, skillSystem } = setup;
      const heroId = getFirstGeneralId(heroSystem);
      if (!heroId) return;

      // 确保有足够材料
      setup.resources.skillBooks = 10;
      setup.resources.gold = 100000;

      const result = skillSystem.upgradeSkill(heroId, 0, { skillBooks: 10, gold: 100000 });
      expect(result.success).toBe(true);
      // 消耗: skillBooks=1, gold=500（PRD阶梯表 Lv1→Lv2）
      expect(result.materialsUsed.skillBooks).toBe(1);
      expect(result.materialsUsed.gold).toBe(500);
    });

    it('Lv2→Lv3 消耗应为 1技能书 + 1500铜钱', () => {
      const { heroSystem, skillSystem } = setup;
      const heroId = getFirstGeneralId(heroSystem);
      if (!heroId) return;

      setup.resources.skillBooks = 10;
      setup.resources.gold = 100000;

      // 第一次升级 Lv1→Lv2
      skillSystem.upgradeSkill(heroId, 0, { skillBooks: 10, gold: 100000 });
      // 第二次升级 Lv2→Lv3
      const result = skillSystem.upgradeSkill(heroId, 0, { skillBooks: 10, gold: 100000 });
      expect(result.success).toBe(true);
      // 消耗: skillBooks=1, gold=1500（PRD阶梯表 Lv2→Lv3）
      expect(result.materialsUsed.gold).toBe(1500);
    });

    it('Lv3→Lv4 消耗应为 2技能书 + 4000铜钱', () => {
      const { heroSystem, skillSystem } = setup;
      const heroId = getFirstGeneralId(heroSystem);
      if (!heroId) return;

      setup.resources.skillBooks = 10;
      setup.resources.gold = 100000;

      skillSystem.upgradeSkill(heroId, 0, { skillBooks: 10, gold: 100000 });
      skillSystem.upgradeSkill(heroId, 0, { skillBooks: 10, gold: 100000 });
      const result = skillSystem.upgradeSkill(heroId, 0, { skillBooks: 10, gold: 100000 });
      expect(result.success).toBe(true);
      // gold=4000, skillBooks=2（PRD阶梯表 Lv3→Lv4）
      expect(result.materialsUsed.gold).toBe(4000);
      expect(result.materialsUsed.skillBooks).toBe(2);
    });

    it('材料不足时应失败', () => {
      const { heroSystem, skillSystem } = setup;
      const heroId = getFirstGeneralId(heroSystem);
      if (!heroId) return;

      const result = skillSystem.upgradeSkill(heroId, 0, { skillBooks: 0, gold: 0 });
      expect(result.success).toBe(false);
    });
  });

  // ── 2. 效果增强（每级+10%）──

  describe('效果增强（每级+10%）', () => {
    it('Lv1 效果应为 1.0', () => {
      const { heroSystem, skillSystem } = setup;
      const heroId = getFirstGeneralId(heroSystem);
      if (!heroId) return;

      const effect = skillSystem.getSkillEffect(heroId, 0);
      expect(effect).toBeCloseTo(1.0, 5);
    });

    it('Lv2 效果应为 1.1（+10%）', () => {
      const { heroSystem, skillSystem } = setup;
      const heroId = getFirstGeneralId(heroSystem);
      if (!heroId) return;

      setup.resources.skillBooks = 10;
      setup.resources.gold = 100000;

      skillSystem.upgradeSkill(heroId, 0, { skillBooks: 10, gold: 100000 });
      const effect = skillSystem.getSkillEffect(heroId, 0);
      expect(effect).toBeCloseTo(1.1, 5);
    });

    it('Lv3 效果应为 1.2（+20%）', () => {
      const { heroSystem, skillSystem } = setup;
      const heroId = getFirstGeneralId(heroSystem);
      if (!heroId) return;

      setup.resources.skillBooks = 10;
      setup.resources.gold = 100000;

      skillSystem.upgradeSkill(heroId, 0, { skillBooks: 10, gold: 100000 });
      skillSystem.upgradeSkill(heroId, 0, { skillBooks: 10, gold: 100000 });
      const effect = skillSystem.getSkillEffect(heroId, 0);
      expect(effect).toBeCloseTo(1.2, 5);
    });

    it('升级前后效果差应为 0.1', () => {
      const { heroSystem, skillSystem } = setup;
      const heroId = getFirstGeneralId(heroSystem);
      if (!heroId) return;

      setup.resources.skillBooks = 10;
      setup.resources.gold = 100000;

      const effectBefore = skillSystem.getSkillEffect(heroId, 0);
      const result = skillSystem.upgradeSkill(heroId, 0, { skillBooks: 10, gold: 100000 });
      expect(result.success).toBe(true);
      expect(result.effectAfter - result.effectBefore).toBeCloseTo(0.1, 5);
      expect(result.effectAfter - effectBefore).toBeCloseTo(0.1, 5);
    });
  });

  // ── 3. 等级上限受星级影响 ──

  describe('等级上限受星级影响', () => {
    it('1星 技能等级上限为 3', () => {
      expect(setup.skillSystem.getSkillLevelCap(1)).toBe(3);
    });

    it('2星 技能等级上限为 4', () => {
      expect(setup.skillSystem.getSkillLevelCap(2)).toBe(4);
    });

    it('3星 技能等级上限为 5', () => {
      expect(setup.skillSystem.getSkillLevelCap(3)).toBe(5);
    });

    it('4星 技能等级上限为 6', () => {
      expect(setup.skillSystem.getSkillLevelCap(4)).toBe(6);
    });

    it('5星 技能等级上限为 8', () => {
      expect(setup.skillSystem.getSkillLevelCap(5)).toBe(8);
    });

    it('6星 技能等级上限为 10', () => {
      expect(setup.skillSystem.getSkillLevelCap(6)).toBe(10);
    });

    it('0星或负数星级应回退到默认上限', () => {
      expect(setup.skillSystem.getSkillLevelCap(0)).toBe(3);
      expect(setup.skillSystem.getSkillLevelCap(-1)).toBe(3);
    });

    it('达到等级上限后不能再升级', () => {
      const { heroSystem, skillSystem, starSystem } = setup;
      const heroId = getFirstGeneralId(heroSystem);
      if (!heroId) return;

      setup.resources.skillBooks = 100;
      setup.resources.gold = 1000000;

      // 1星上限为3，升级2次到Lv3
      skillSystem.upgradeSkill(heroId, 0, { skillBooks: 100, gold: 1000000 });
      skillSystem.upgradeSkill(heroId, 0, { skillBooks: 100, gold: 1000000 });

      // 第3次升级应失败（已达上限）
      const result = skillSystem.upgradeSkill(heroId, 0, { skillBooks: 100, gold: 1000000 });
      expect(result.success).toBe(false);
    });
  });

  // ── 4. 觉醒技能突破前置检查 ──

  describe('觉醒技能突破前置检查', () => {
    it('未突破时觉醒技能不能升级', () => {
      const { skillSystem } = setup;
      // 默认无突破，canUpgradeAwakenSkill 应返回 false
      expect(skillSystem.canUpgradeAwakenSkill('any_hero')).toBe(false);
    });

    it('有突破后觉醒技能可以升级', () => {
      const { heroSystem, starSystem, skillSystem } = setup;
      const heroId = getFirstGeneralId(heroSystem);
      if (!heroId) return;

      // 模拟突破阶段=1（通过 setBreakthroughStage 内部方法）
      // HeroStarSystem 的突破状态存储在 state.breakthroughStages
      (starSystem as unknown as { state: { breakthroughStages: Record<string, number> } }).state.breakthroughStages[heroId] = 1;

      expect(skillSystem.canUpgradeAwakenSkill(heroId)).toBe(true);
    });
  });

  // ── 5. 策略推荐逻辑 ──

  describe('策略推荐逻辑', () => {
    it('灼烧型敌人应推荐被动+主动技能', () => {
      const rec = setup.skillSystem.recommendStrategy('burn-heavy');
      expect(rec.prioritySkillTypes).toContain('passive');
      expect(rec.prioritySkillTypes).toContain('active');
      expect(rec.focusStats).toContain('intelligence');
    });

    it('物理型敌人应推荐被动+阵营技能', () => {
      const rec = setup.skillSystem.recommendStrategy('physical');
      expect(rec.prioritySkillTypes).toContain('passive');
      expect(rec.prioritySkillTypes).toContain('faction');
      expect(rec.focusStats).toContain('defense');
    });

    it('BOSS型敌人应推荐主动+觉醒技能', () => {
      const rec = setup.skillSystem.recommendStrategy('boss');
      expect(rec.prioritySkillTypes).toContain('active');
      expect(rec.prioritySkillTypes).toContain('awaken');
      expect(rec.focusStats).toContain('attack');
    });

    it('推荐结果应包含描述', () => {
      const rec = setup.skillSystem.recommendStrategy('boss');
      expect(rec.description).toBeTruthy();
      expect(typeof rec.description).toBe('string');
    });
  });

  // ── 6. ISubsystem 接口合规 ──

  describe('ISubsystem 接口合规', () => {
    it('应正确实现 name 属性', () => {
      expect(setup.skillSystem.name).toBe('skillUpgrade');
    });

    it('应正确实现 init', () => {
      const newSystem = new SkillUpgradeSystem();
      expect(() => newSystem.init(makeMockDeps())).not.toThrow();
    });

    it('应正确实现 update（无操作）', () => {
      expect(() => setup.skillSystem.update(16)).not.toThrow();
    });

    it('应正确实现 getState', () => {
      const state = setup.skillSystem.getState();
      expect(state).toHaveProperty('upgradeHistory');
      expect(state).toHaveProperty('breakthroughSkillUnlocks');
    });

    it('应正确实现 reset', () => {
      const { heroSystem, skillSystem } = setup;
      const heroId = getFirstGeneralId(heroSystem);
      if (!heroId) return;

      setup.resources.skillBooks = 10;
      setup.resources.gold = 100000;

      skillSystem.upgradeSkill(heroId, 0, { skillBooks: 10, gold: 100000 });
      const stateBefore = skillSystem.getState();
      expect(Object.keys(stateBefore.upgradeHistory).length).toBeGreaterThan(0);

      skillSystem.reset();
      const stateAfter = skillSystem.getState();
      expect(Object.keys(stateAfter.upgradeHistory).length).toBe(0);
    });
  });

  // ── 边界条件 ──

  describe('边界条件', () => {
    it('不存在的武将应返回失败', () => {
      const result = setup.skillSystem.upgradeSkill('nonexistent', 0, { skillBooks: 10, gold: 1000 });
      expect(result.success).toBe(false);
    });

    it('无效的技能索引应返回失败', () => {
      const { heroSystem, skillSystem } = setup;
      const heroId = getFirstGeneralId(heroSystem);
      if (!heroId) return;

      const result = skillSystem.upgradeSkill(heroId, -1, { skillBooks: 10, gold: 1000 });
      expect(result.success).toBe(false);

      const result2 = skillSystem.upgradeSkill(heroId, 999, { skillBooks: 10, gold: 1000 });
      expect(result2.success).toBe(false);
    });

    it('未设置依赖时升级应失败', () => {
      const system = new SkillUpgradeSystem();
      const result = system.upgradeSkill('hero1', 0, { skillBooks: 10, gold: 1000 });
      expect(result.success).toBe(false);
    });

    it('getSkillLevel 未设置依赖时返回 0', () => {
      const system = new SkillUpgradeSystem();
      expect(system.getSkillLevel('hero1', 0)).toBe(0);
    });

    it('getSkillEffect 未设置依赖时返回基础效果', () => {
      const system = new SkillUpgradeSystem();
      expect(system.getSkillEffect('hero1', 0)).toBe(1.0);
    });
  });
});
