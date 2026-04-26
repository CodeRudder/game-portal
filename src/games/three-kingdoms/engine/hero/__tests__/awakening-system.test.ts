/**
 * AwakeningSystem 单元测试 — 觉醒条件检查、觉醒执行、属性计算、技能解锁
 *
 * 覆盖功能点：
 *   - 觉醒条件检查（等级/星级/突破/品质/未拥有）
 *   - 觉醒执行（资源消耗、属性提升、技能解锁）
 *   - 觉醒后等级上限（100→120）
 *   - 觉醒后属性计算（+50%）
 *   - 觉醒技能获取
 *   - 边界测试（已觉醒/资源不足/条件不满足）
 *
 * 设计来源：HER-heroes-prd.md §13 觉醒系统
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AwakeningSystem } from '../AwakeningSystem';
import type { AwakeningDeps, AwakeningResult, AwakeningEligibility } from '../AwakeningSystem';
import { HeroSystem } from '../HeroSystem';
import { HeroStarSystem } from '../HeroStarSystem';
import { Quality } from '../hero.types';
import type { StarSystemDeps } from '../star-up.types';
import {
  AWAKENING_MAX_LEVEL,
  AWAKENING_COST,
  AWAKENING_STAT_MULTIPLIER,
  AWAKENING_SKILLS,
  AWAKENING_PASSIVE,
  AWAKENING_EXP_TABLE,
  AWAKENING_GOLD_TABLE,
  AWAKENABLE_QUALITIES,
} from '../awakening-config';

// ── 辅助函数 ──

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

function makeStarDeps(overrides?: Partial<{ gold: number; breakthroughStones: number }>) {
  const resources: Record<string, number> = {
    gold: overrides?.gold ?? 999999999,
    breakthroughStone: overrides?.breakthroughStones ?? 999999999,
  };
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

/**
 * 创建完整的测试环境
 *
 * @param heroId - 武将ID
 * @param opts - 可选配置：等级、星级、突破阶段、碎片、资源
 */
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

  // 添加武将
  heroSystem.addGeneral(heroId);

  // 设置碎片
  if (opts?.fragments) {
    heroSystem.addFragment(heroId, opts.fragments);
  }

  // 设置等级和经验
  if (opts?.level) {
    heroSystem.setLevelAndExp(heroId, opts.level, 0);
  }

  // 创建升星系统
  const starSystem = new HeroStarSystem(heroSystem);
  starSystem.init(makeMockCoreDeps());
  const starDeps = makeStarDeps();
  starDeps.getFragments = (id: string) => heroSystem.getFragments(id);
  starDeps.spendFragments = (id: string, count: number) => heroSystem.useFragments(id, count);
  starSystem.setDeps(starDeps);

  // 注入等级上限回调
  heroSystem.setLevelCapGetter((id: string) => starSystem.getLevelCap(id));

  // 设置星级（通过内部状态直接设置）
  if (opts?.star) {
    (starSystem as any).state.stars[heroId] = opts.star;
  }

  // 设置突破阶段
  if (opts?.breakthrough) {
    (starSystem as any).state.breakthroughStages[heroId] = opts.breakthrough;
  }

  // 创建觉醒系统
  const awakeningSystem = new AwakeningSystem(heroSystem, starSystem);
  awakeningSystem.init(makeMockCoreDeps());
  const awakeningDeps = makeAwakeningDeps(opts?.resources);
  awakeningSystem.setDeps(awakeningDeps);

  return { heroSystem, starSystem, awakeningSystem, awakeningDeps };
}

// ═══════════════════════════════════════════
// 测试用例
// ═══════════════════════════════════════════

describe('AwakeningSystem', () => {

  // ─────────────────────────────────────────
  // 1. 初始化
  // ─────────────────────────────────────────
  describe('初始化', () => {
    it('should have correct subsystem name', () => {
      const { awakeningSystem } = createTestEnv('guanyu');
      expect(awakeningSystem.name).toBe('awakening');
    });

    it('should return default awakening state for unknown hero', () => {
      const { awakeningSystem } = createTestEnv('guanyu');
      const state = awakeningSystem.getAwakeningState('unknown');
      expect(state.isAwakened).toBe(false);
      expect(state.awakeningLevel).toBe(0);
    });

    it('should return false for isAwakened on unawakened hero', () => {
      const { awakeningSystem } = createTestEnv('guanyu');
      expect(awakeningSystem.isAwakened('guanyu')).toBe(false);
    });
  });

  // ─────────────────────────────────────────
  // 2. 觉醒条件检查
  // ─────────────────────────────────────────
  describe('觉醒条件检查', () => {
    it('should be eligible when all conditions met (LEGENDARY hero)', () => {
      const { awakeningSystem } = createTestEnv('guanyu', {
        level: 100, star: 6, breakthrough: 4, fragments: 200,
      });
      const result = awakeningSystem.checkAwakeningEligible('guanyu');
      expect(result.eligible).toBe(true);
      expect(result.failures).toHaveLength(0);
      expect(result.details.owned).toBe(true);
      expect(result.details.level.met).toBe(true);
      expect(result.details.stars.met).toBe(true);
      expect(result.details.breakthrough.met).toBe(true);
      expect(result.details.quality.met).toBe(true);
    });

    it('should be eligible for RARE quality hero', () => {
      const { awakeningSystem } = createTestEnv('dianwei', {
        level: 100, star: 6, breakthrough: 4, fragments: 200,
      });
      const result = awakeningSystem.checkAwakeningEligible('dianwei');
      expect(result.eligible).toBe(true);
      expect(result.details.quality.current).toBe('RARE');
    });

    it('should be eligible for EPIC quality hero', () => {
      const { awakeningSystem } = createTestEnv('liubei', {
        level: 100, star: 6, breakthrough: 4, fragments: 200,
      });
      const result = awakeningSystem.checkAwakeningEligible('liubei');
      expect(result.eligible).toBe(true);
      expect(result.details.quality.current).toBe('EPIC');
    });

    it('should fail when level is insufficient', () => {
      const { awakeningSystem } = createTestEnv('guanyu', {
        level: 99, star: 6, breakthrough: 4,
      });
      const result = awakeningSystem.checkAwakeningEligible('guanyu');
      expect(result.eligible).toBe(false);
      expect(result.details.level.met).toBe(false);
      expect(result.details.level.current).toBe(99);
      expect(result.failures.some(f => f.includes('等级不足'))).toBe(true);
    });

    it('should fail when stars are insufficient', () => {
      const { awakeningSystem } = createTestEnv('guanyu', {
        level: 100, star: 5, breakthrough: 4,
      });
      const result = awakeningSystem.checkAwakeningEligible('guanyu');
      expect(result.eligible).toBe(false);
      expect(result.details.stars.met).toBe(false);
      expect(result.details.stars.current).toBe(5);
    });

    it('should fail when breakthrough is insufficient', () => {
      const { awakeningSystem } = createTestEnv('guanyu', {
        level: 100, star: 6, breakthrough: 3,
      });
      const result = awakeningSystem.checkAwakeningEligible('guanyu');
      expect(result.eligible).toBe(false);
      expect(result.details.breakthrough.met).toBe(false);
      expect(result.details.breakthrough.current).toBe(3);
    });

    it('should fail when quality is COMMON', () => {
      const { awakeningSystem } = createTestEnv('minbingduizhang', {
        level: 100, star: 6, breakthrough: 4,
      });
      const result = awakeningSystem.checkAwakeningEligible('minbingduizhang');
      expect(result.eligible).toBe(false);
      expect(result.details.quality.met).toBe(false);
      expect(result.details.quality.current).toBe('COMMON');
    });

    it('should fail when quality is FINE', () => {
      const { awakeningSystem } = createTestEnv('junshou', {
        level: 100, star: 6, breakthrough: 4,
      });
      const result = awakeningSystem.checkAwakeningEligible('junshou');
      expect(result.eligible).toBe(false);
      expect(result.details.quality.current).toBe('FINE');
    });

    it('should fail when hero is not owned', () => {
      const { awakeningSystem } = createTestEnv('guanyu');
      const result = awakeningSystem.checkAwakeningEligible('nonexistent');
      expect(result.eligible).toBe(false);
      expect(result.details.owned).toBe(false);
    });

    it('should report multiple failures at once', () => {
      const { awakeningSystem } = createTestEnv('guanyu', {
        level: 50, star: 3, breakthrough: 1,
      });
      const result = awakeningSystem.checkAwakeningEligible('guanyu');
      expect(result.eligible).toBe(false);
      expect(result.failures.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ─────────────────────────────────────────
  // 3. 觉醒执行
  // ─────────────────────────────────────────
  describe('觉醒执行', () => {
    it('should awaken successfully with all conditions and resources met', () => {
      const { awakeningSystem, awakeningDeps } = createTestEnv('guanyu', {
        level: 100, star: 6, breakthrough: 4, fragments: 300,
      });

      const result = awakeningSystem.awaken('guanyu');

      expect(result.success).toBe(true);
      expect(result.generalId).toBe('guanyu');
      expect(result.costSpent).toEqual(AWAKENING_COST);
      expect(result.reason).toBeUndefined();
    });

    it('should consume copper resource', () => {
      const { awakeningSystem, awakeningDeps } = createTestEnv('guanyu', {
        level: 100, star: 6, breakthrough: 4, fragments: 300,
      });

      awakeningSystem.awaken('guanyu');

      expect(awakeningDeps.spendResource).toHaveBeenCalledWith('gold', AWAKENING_COST.copper);
    });

    it('should consume breakthrough stones', () => {
      const { awakeningSystem, awakeningDeps } = createTestEnv('guanyu', {
        level: 100, star: 6, breakthrough: 4, fragments: 300,
      });

      awakeningSystem.awaken('guanyu');

      expect(awakeningDeps.spendResource).toHaveBeenCalledWith('breakthroughStone', AWAKENING_COST.breakthroughStones);
    });

    it('should consume skill books', () => {
      const { awakeningSystem, awakeningDeps } = createTestEnv('guanyu', {
        level: 100, star: 6, breakthrough: 4, fragments: 300,
      });

      awakeningSystem.awaken('guanyu');

      expect(awakeningDeps.spendResource).toHaveBeenCalledWith('skillBook', AWAKENING_COST.skillBooks);
    });

    it('should consume awakening stones', () => {
      const { awakeningSystem, awakeningDeps } = createTestEnv('guanyu', {
        level: 100, star: 6, breakthrough: 4, fragments: 300,
      });

      awakeningSystem.awaken('guanyu');

      expect(awakeningDeps.spendResource).toHaveBeenCalledWith('awakeningStone', AWAKENING_COST.awakeningStones);
    });

    it('should consume hero fragments', () => {
      const { awakeningSystem, heroSystem } = createTestEnv('guanyu', {
        level: 100, star: 6, breakthrough: 4, fragments: 300,
      });

      awakeningSystem.awaken('guanyu');

      // 300 - 200 = 100 remaining
      expect(heroSystem.getFragments('guanyu')).toBe(300 - AWAKENING_COST.fragments);
    });

    it('should update awakening state after success', () => {
      const { awakeningSystem } = createTestEnv('guanyu', {
        level: 100, star: 6, breakthrough: 4, fragments: 300,
      });

      awakeningSystem.awaken('guanyu');

      expect(awakeningSystem.isAwakened('guanyu')).toBe(true);
      const state = awakeningSystem.getAwakeningState('guanyu');
      expect(state.isAwakened).toBe(true);
      expect(state.awakeningLevel).toBe(1);
    });

    it('should unlock awakening skill on success', () => {
      const { awakeningSystem } = createTestEnv('guanyu', {
        level: 100, star: 6, breakthrough: 4, fragments: 300,
      });

      const result = awakeningSystem.awaken('guanyu');

      expect(result.skillUnlocked).not.toBeNull();
      expect(result.skillUnlocked!.id).toBe('guanyu_awaken');
      expect(result.skillUnlocked!.name).toBe('武圣·青龙偃月');
    });

    it('should return awakened stats on success', () => {
      const { awakeningSystem } = createTestEnv('guanyu', {
        level: 100, star: 6, breakthrough: 4, fragments: 300,
      });

      const result = awakeningSystem.awaken('guanyu');

      expect(result.awakenedStats).not.toBeNull();
      // 关羽基础攻击115，觉醒后 115 * 1.5 = 172.5 → floor = 172
      expect(result.awakenedStats!.attack).toBe(Math.floor(115 * AWAKENING_STAT_MULTIPLIER));
    });
  });

  // ─────────────────────────────────────────
  // 4. 觉醒后等级上限
  // ─────────────────────────────────────────
  describe('觉醒后等级上限', () => {
    it('should return 120 level cap after awakening', () => {
      const { awakeningSystem } = createTestEnv('guanyu', {
        level: 100, star: 6, breakthrough: 4, fragments: 300,
      });

      awakeningSystem.awaken('guanyu');

      expect(awakeningSystem.getAwakenedLevelCap('guanyu')).toBe(120);
    });

    it('should return original level cap before awakening', () => {
      const { awakeningSystem } = createTestEnv('guanyu', {
        level: 100, star: 6, breakthrough: 4,
      });

      // 未觉醒，突破4阶 → 100
      expect(awakeningSystem.getAwakenedLevelCap('guanyu')).toBe(100);
    });

    it('should return 50 level cap with no breakthrough', () => {
      const { awakeningSystem } = createTestEnv('guanyu');

      expect(awakeningSystem.getAwakenedLevelCap('guanyu')).toBe(50);
    });
  });

  // ─────────────────────────────────────────
  // 5. 觉醒后属性计算
  // ─────────────────────────────────────────
  describe('觉醒后属性计算', () => {
    it('should apply +50% stat bonus after awakening', () => {
      const { awakeningSystem, heroSystem } = createTestEnv('guanyu', {
        level: 100, star: 6, breakthrough: 4, fragments: 300,
      });

      const beforeAwaken = awakeningSystem.calculateAwakenedStats('guanyu');
      awakeningSystem.awaken('guanyu');
      const afterAwaken = awakeningSystem.calculateAwakenedStats('guanyu');

      // 未觉醒时返回原始属性
      expect(beforeAwaken.attack).toBe(115);
      // 觉醒后 115 * 1.5 = 172
      expect(afterAwaken.attack).toBe(Math.floor(115 * 1.5));
    });

    it('should correctly calculate all four stats', () => {
      const { awakeningSystem } = createTestEnv('zhugeliang', {
        level: 100, star: 6, breakthrough: 4, fragments: 300,
      });

      awakeningSystem.awaken('zhugeliang');
      const stats = awakeningSystem.calculateAwakenedStats('zhugeliang');

      // 诸葛亮 baseStats: attack:68, defense:72, intelligence:118, speed:88
      expect(stats.attack).toBe(Math.floor(68 * 1.5));
      expect(stats.defense).toBe(Math.floor(72 * 1.5));
      expect(stats.intelligence).toBe(Math.floor(118 * 1.5));
      expect(stats.speed).toBe(Math.floor(88 * 1.5));
    });

    it('should return original stats for unawakened hero', () => {
      const { awakeningSystem } = createTestEnv('guanyu');

      const stats = awakeningSystem.calculateAwakenedStats('guanyu');
      expect(stats.attack).toBe(115);
      expect(stats.defense).toBe(90);
    });

    it('should return zero stats for nonexistent hero', () => {
      const { awakeningSystem } = createTestEnv('guanyu');
      const stats = awakeningSystem.calculateAwakenedStats('nonexistent');
      expect(stats).toEqual({ attack: 0, defense: 0, intelligence: 0, speed: 0 });
    });

    it('should calculate stat diff correctly', () => {
      const { awakeningSystem } = createTestEnv('guanyu', {
        level: 100, star: 6, breakthrough: 4, fragments: 300,
      });

      awakeningSystem.awaken('guanyu');
      const diff = awakeningSystem.getAwakeningStatDiff('guanyu');

      // 115 * 0.5 = 57.5 → floor = 57
      expect(diff.attack).toBe(Math.floor(115 * 0.5));
    });
  });

  // ─────────────────────────────────────────
  // 6. 觉醒技能获取
  // ─────────────────────────────────────────
  describe('觉醒技能获取', () => {
    it('should return awakening skill for LEGENDARY hero', () => {
      const { awakeningSystem } = createTestEnv('guanyu');
      const skill = awakeningSystem.getAwakeningSkill('guanyu');

      expect(skill).not.toBeNull();
      expect(skill!.name).toBe('武圣·青龙偃月');
      expect(skill!.damageMultiplier).toBe(3.0);
      expect(skill!.cooldown).toBe(5);
    });

    it('should return awakening skill for each quality tier', () => {
      // RARE
      const { awakeningSystem: rareSys } = createTestEnv('dianwei');
      expect(rareSys.getAwakeningSkill('dianwei')!.name).toBe('恶来·死战不退');

      // EPIC
      const { awakeningSystem: epicSys } = createTestEnv('liubei');
      expect(epicSys.getAwakeningSkill('liubei')!.name).toBe('仁德·桃园结义');

      // LEGENDARY
      const { awakeningSystem: legendSys } = createTestEnv('caocao');
      expect(legendSys.getAwakeningSkill('caocao')!.name).toBe('奸雄·挟天子');
    });

    it('should return null for hero without awakening skill', () => {
      const { awakeningSystem } = createTestEnv('minbingduizhang');
      expect(awakeningSystem.getAwakeningSkill('minbingduizhang')).toBeNull();
    });

    it('should return skill preview same as skill', () => {
      const { awakeningSystem } = createTestEnv('guanyu');
      const skill = awakeningSystem.getAwakeningSkill('guanyu');
      const preview = awakeningSystem.getAwakeningSkillPreview('guanyu');
      expect(preview).toEqual(skill);
    });

    it('should return all expected awakening skills', () => {
      const expectedHeroes = ['guanyu', 'zhugeliang', 'zhaoyun', 'caocao', 'lvbu',
        'liubei', 'zhangfei', 'simayi', 'zhouyu', 'dianwei', 'lushu', 'huanggai',
        'ganning', 'xuhuang', 'zhangliao', 'weiyan'];

      for (const heroId of expectedHeroes) {
        const { awakeningSystem } = createTestEnv(heroId);
        const skill = awakeningSystem.getAwakeningSkill(heroId);
        expect(skill, `Missing awakening skill for ${heroId}`).not.toBeNull();
        expect(skill!.id, `Wrong skill ID for ${heroId}`).toBe(`${heroId}_awaken`);
      }
    });
  });

  // ─────────────────────────────────────────
  // 7. 边界测试
  // ─────────────────────────────────────────
  describe('边界测试', () => {
    it('should fail to awaken already awakened hero', () => {
      const { awakeningSystem } = createTestEnv('guanyu', {
        level: 100, star: 6, breakthrough: 4, fragments: 500,
      });

      const first = awakeningSystem.awaken('guanyu');
      expect(first.success).toBe(true);

      const second = awakeningSystem.awaken('guanyu');
      expect(second.success).toBe(false);
      expect(second.reason).toContain('已觉醒');
    });

    it('should fail when resources are insufficient (copper)', () => {
      const { awakeningSystem } = createTestEnv('guanyu', {
        level: 100, star: 6, breakthrough: 4, fragments: 300,
        resources: { gold: 100000 }, // 不足500000
      });

      const result = awakeningSystem.awaken('guanyu');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('资源不足');
    });

    it('should fail when resources are insufficient (awakening stones)', () => {
      const { awakeningSystem } = createTestEnv('guanyu', {
        level: 100, star: 6, breakthrough: 4, fragments: 300,
        resources: { awakeningStone: 10 }, // 不足30
      });

      const result = awakeningSystem.awaken('guanyu');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('资源不足');
    });

    it('should fail when fragments are insufficient', () => {
      const { awakeningSystem } = createTestEnv('guanyu', {
        level: 100, star: 6, breakthrough: 4, fragments: 100, // 不足200
      });

      const result = awakeningSystem.awaken('guanyu');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('资源不足');
    });

    it('should fail when conditions are not met', () => {
      const { awakeningSystem } = createTestEnv('guanyu', {
        level: 80, star: 4, breakthrough: 2, fragments: 300,
      });

      const result = awakeningSystem.awaken('guanyu');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('条件不满足');
    });

    it('should fail when deps are not set', () => {
      const heroSystem = new HeroSystem();
      heroSystem.init(makeMockCoreDeps());
      heroSystem.addGeneral('guanyu');
      heroSystem.setLevelAndExp('guanyu', 100, 0);

      const starSystem = new HeroStarSystem(heroSystem);
      starSystem.init(makeMockCoreDeps());
      (starSystem as any).state.stars['guanyu'] = 6;
      (starSystem as any).state.breakthroughStages['guanyu'] = 4;

      const awakeningSystem = new AwakeningSystem(heroSystem, starSystem);
      awakeningSystem.init(makeMockCoreDeps());
      // 不设置 deps

      const result = awakeningSystem.awaken('guanyu');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('资源系统未初始化');
    });

    it('should fail for COMMON quality hero even with max level/stars', () => {
      const { awakeningSystem } = createTestEnv('minbingduizhang', {
        level: 100, star: 6, breakthrough: 4, fragments: 300,
      });

      const result = awakeningSystem.awaken('minbingduizhang');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('条件不满足');
    });
  });

  // ─────────────────────────────────────────
  // 8. 觉醒被动效果
  // ─────────────────────────────────────────
  describe('觉醒被动效果', () => {
    it('should return zero bonuses with no awakened heroes', () => {
      const { awakeningSystem } = createTestEnv('guanyu');
      const summary = awakeningSystem.getPassiveSummary();

      expect(summary.awakenedCount).toBe(0);
      expect(summary.globalStatBonus).toBe(0);
      expect(summary.resourceBonus).toBe(0);
      expect(summary.expBonus).toBe(0);
    });

    it('should calculate passive bonuses for single awakened hero', () => {
      const { awakeningSystem } = createTestEnv('guanyu', {
        level: 100, star: 6, breakthrough: 4, fragments: 300,
      });

      awakeningSystem.awaken('guanyu');
      const summary = awakeningSystem.getPassiveSummary();

      expect(summary.awakenedCount).toBe(1);
      expect(summary.factionStacks['shu']).toBe(1);
      expect(summary.globalStatBonus).toBe(AWAKENING_PASSIVE.globalStatBonus);
      expect(summary.resourceBonus).toBe(AWAKENING_PASSIVE.resourceBonus);
      expect(summary.expBonus).toBe(AWAKENING_PASSIVE.expBonus);
    });

    it('should stack faction bonuses for same faction', () => {
      const heroSystem = new HeroSystem();
      heroSystem.init(makeMockCoreDeps());

      // 蜀国三人组
      const shuHeroes = ['guanyu', 'zhaoyun', 'zhugeliang'];
      for (const id of shuHeroes) {
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

      for (const id of shuHeroes) {
        (starSystem as any).state.stars[id] = 6;
        (starSystem as any).state.breakthroughStages[id] = 4;
      }

      const awakeningSystem = new AwakeningSystem(heroSystem, starSystem);
      awakeningSystem.init(makeMockCoreDeps());
      awakeningSystem.setDeps(makeAwakeningDeps());

      for (const id of shuHeroes) {
        awakeningSystem.awaken(id);
      }

      const summary = awakeningSystem.getPassiveSummary();
      expect(summary.awakenedCount).toBe(3);
      expect(summary.factionStacks['shu']).toBe(3); // 最多3次
      expect(summary.globalStatBonus).toBe(3 * AWAKENING_PASSIVE.globalStatBonus);
    });

    it('should cap faction stacks at max', () => {
      const heroSystem = new HeroSystem();
      heroSystem.init(makeMockCoreDeps());

      // 4个蜀国武将
      const shuHeroes = ['guanyu', 'zhaoyun', 'zhugeliang', 'liubei'];
      for (const id of shuHeroes) {
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

      for (const id of shuHeroes) {
        (starSystem as any).state.stars[id] = 6;
        (starSystem as any).state.breakthroughStages[id] = 4;
      }

      const awakeningSystem = new AwakeningSystem(heroSystem, starSystem);
      awakeningSystem.init(makeMockCoreDeps());
      awakeningSystem.setDeps(makeAwakeningDeps());

      for (const id of shuHeroes) {
        awakeningSystem.awaken(id);
      }

      const summary = awakeningSystem.getPassiveSummary();
      // 阵营光环最多叠加3次，即使有4个蜀国觉醒武将
      expect(summary.factionStacks['shu']).toBe(AWAKENING_PASSIVE.factionMaxStacks);
    });
  });

  // ─────────────────────────────────────────
  // 9. 觉醒经验表
  // ─────────────────────────────────────────
  describe('觉醒经验表', () => {
    it('should return correct exp for level 101', () => {
      const { awakeningSystem } = createTestEnv('guanyu');
      expect(awakeningSystem.getAwakeningExpRequired(101)).toBe(101 * 12000);
    });

    it('should return correct exp for level 110', () => {
      const { awakeningSystem } = createTestEnv('guanyu');
      expect(awakeningSystem.getAwakeningExpRequired(110)).toBe(110 * 15000);
    });

    it('should return correct exp for level 120', () => {
      const { awakeningSystem } = createTestEnv('guanyu');
      expect(awakeningSystem.getAwakeningExpRequired(120)).toBe(120 * 25000);
    });

    it('should return 0 for non-awakening level (100)', () => {
      const { awakeningSystem } = createTestEnv('guanyu');
      expect(awakeningSystem.getAwakeningExpRequired(100)).toBe(0);
    });

    it('should return correct gold for level 101', () => {
      const { awakeningSystem } = createTestEnv('guanyu');
      expect(awakeningSystem.getAwakeningGoldRequired(101)).toBe(101 * 5000);
    });

    it('should return correct gold for level 115', () => {
      const { awakeningSystem } = createTestEnv('guanyu');
      expect(awakeningSystem.getAwakeningGoldRequired(115)).toBe(115 * 10000);
    });

    it('should return 0 for non-awakening gold level', () => {
      const { awakeningSystem } = createTestEnv('guanyu');
      expect(awakeningSystem.getAwakeningGoldRequired(99)).toBe(0);
    });
  });

  // ─────────────────────────────────────────
  // 10. 序列化/反序列化
  // ─────────────────────────────────────────
  describe('序列化', () => {
    it('should serialize empty state', () => {
      const { awakeningSystem } = createTestEnv('guanyu');
      const data = awakeningSystem.serialize();

      expect(data.version).toBe(1);
      expect(data.state.heroes).toEqual({});
    });

    it('should serialize awakened hero state', () => {
      const { awakeningSystem } = createTestEnv('guanyu', {
        level: 100, star: 6, breakthrough: 4, fragments: 300,
      });

      awakeningSystem.awaken('guanyu');
      const data = awakeningSystem.serialize();

      expect(data.state.heroes['guanyu']).toEqual({
        isAwakened: true,
        awakeningLevel: 1,
      });
    });

    it('should deserialize and restore state', () => {
      const { awakeningSystem } = createTestEnv('guanyu', {
        level: 100, star: 6, breakthrough: 4, fragments: 300,
      });

      awakeningSystem.awaken('guanyu');
      const data = awakeningSystem.serialize();

      // 创建新系统并恢复
      const { awakeningSystem: newSystem } = createTestEnv('guanyu');
      newSystem.deserialize(data);

      expect(newSystem.isAwakened('guanyu')).toBe(true);
    });

    it('should reset to empty state', () => {
      const { awakeningSystem } = createTestEnv('guanyu', {
        level: 100, star: 6, breakthrough: 4, fragments: 300,
      });

      awakeningSystem.awaken('guanyu');
      awakeningSystem.reset();

      expect(awakeningSystem.isAwakened('guanyu')).toBe(false);
    });
  });

  // ─────────────────────────────────────────
  // 11. 多武将觉醒场景
  // ─────────────────────────────────────────
  describe('多武将觉醒场景', () => {
    it('should independently awaken multiple heroes', () => {
      const heroSystem = new HeroSystem();
      heroSystem.init(makeMockCoreDeps());

      const heroes = ['guanyu', 'caocao'];
      for (const id of heroes) {
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

      for (const id of heroes) {
        (starSystem as any).state.stars[id] = 6;
        (starSystem as any).state.breakthroughStages[id] = 4;
      }

      const awakeningSystem = new AwakeningSystem(heroSystem, starSystem);
      awakeningSystem.init(makeMockCoreDeps());
      awakeningSystem.setDeps(makeAwakeningDeps());

      const result1 = awakeningSystem.awaken('guanyu');
      const result2 = awakeningSystem.awaken('caocao');

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(awakeningSystem.isAwakened('guanyu')).toBe(true);
      expect(awakeningSystem.isAwakened('caocao')).toBe(true);

      // 不同武将应有不同技能
      expect(result1.skillUnlocked!.id).toBe('guanyu_awaken');
      expect(result2.skillUnlocked!.id).toBe('caocao_awaken');
    });
  });
});
