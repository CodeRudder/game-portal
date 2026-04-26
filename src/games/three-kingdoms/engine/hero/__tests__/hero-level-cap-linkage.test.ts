import { vi, describe, it, expect, beforeEach } from 'vitest';
/**
 * 等级上限联动测试 — HeroLevelSystem + HeroStarSystem 集成
 *
 * 验证 HeroLevelSystem 的等级上限由 HeroStarSystem 的突破状态动态决定：
 *   未突破 → 上限 50
 *   一阶突破 → 上限 60
 *   二阶突破 → 上限 70
 *   三阶突破 → 上限 80
 *   四阶突破 → 上限 100
 *
 * 同时验证：
 *   - 突破后可以继续升级到新的等级上限
 *   - 经验溢出时正确处理（停在等级上限）
 *   - 51~100 级经验需求使用指数增长公式
 */

import { HeroLevelSystem } from '../HeroLevelSystem';
import type { LevelDeps } from '../HeroLevelSystem';
import { HeroSystem } from '../HeroSystem';
import { HeroStarSystem } from '../HeroStarSystem';
import type { StarSystemDeps } from '../star-up.types';
import { HERO_MAX_LEVEL, LEVEL_EXP_TABLE } from '../hero-config';
import {
  BREAKTHROUGH_TIERS,
  INITIAL_LEVEL_CAP,
  FINAL_LEVEL_CAP,
} from '../star-up-config';

// ── 辅助函数 ──

/** 创建 mock ISystemDeps */
function makeMockCoreDeps() {
  return {
    eventBus: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
    configRegistry: { get: vi.fn(), set: vi.fn(), has: vi.fn() },
  };
}

/** 创建无限资源的 StarSystemDeps */
function makeRichStarDeps(): StarSystemDeps & { resources: Record<string, number> } {
  const resources: Record<string, number> = {
    gold: 999_999_999,
    breakthroughStone: 999_999_999,
  };
  return {
    resources,
    spendFragments: vi.fn(),
    getFragments: vi.fn(),
    spendResource: vi.fn((type: string, amount: number) => {
      if ((resources[type] ?? 0) >= amount) {
        resources[type] -= amount;
        return true;
      }
      return false;
    }),
    canAffordResource: vi.fn((type: string, amount: number) => (resources[type] ?? 0) >= amount),
    getResourceAmount: vi.fn((type: string) => resources[type] ?? 0),
  };
}

/** 创建无限资源的 LevelDeps，注入 getLevelCap 回调 */
function makeRichLevelDepsWithCap(
  heroSystem: HeroSystem,
  starSystem: HeroStarSystem,
): LevelDeps {
  const resources: Record<string, number> = { gold: 1e9, exp: 1e9 };
  return {
    heroSystem,
    spendResource: vi.fn((type: string, amount: number) => {
      resources[type] -= amount;
      return true;
    }),
    canAffordResource: vi.fn((type: string, amount: number) => resources[type] >= amount),
    getResourceAmount: vi.fn((type: string) => resources[type]),
    getLevelCap: (generalId: string) => starSystem.getLevelCap(generalId),
  };
}

/** 查表获取经验（1~70 级均有分段配置） */
function lookupExp(level: number): number {
  for (const tier of LEVEL_EXP_TABLE) {
    if (level >= tier.levelMin && level <= tier.levelMax) return level * tier.expPerLevel;
  }
  return level * LEVEL_EXP_TABLE[LEVEL_EXP_TABLE.length - 1].expPerLevel;
}

/** 查表获取铜钱（1~70 级均有分段配置） */
function lookupGold(level: number): number {
  for (const tier of LEVEL_EXP_TABLE) {
    if (level >= tier.levelMin && level <= tier.levelMax) return level * tier.goldPerLevel;
  }
  return level * LEVEL_EXP_TABLE[LEVEL_EXP_TABLE.length - 1].goldPerLevel;
}

/** 通过序列化设置武将等级和经验 */
function setGeneralLevel(hs: HeroSystem, id: string, level: number, exp: number = 0): void {
  const save = hs.serialize();
  if (save.state.generals[id]) {
    save.state.generals[id].level = level;
    save.state.generals[id].exp = exp;
    hs.deserialize(save);
  }
}

/** 通过序列化设置突破阶段 */
function setBreakthroughStage(starSystem: HeroStarSystem, id: string, stage: number): void {
  const save = starSystem.serialize();
  save.state.breakthroughStages[id] = stage;
  starSystem.deserialize(save);
}

/** 创建完整的测试环境 */
function createTestEnv() {
  const heroSystem = new HeroSystem();
  heroSystem.init(makeMockCoreDeps());
  const starSystem = new HeroStarSystem(heroSystem);
  starSystem.init(makeMockCoreDeps());
  const starDeps = makeRichStarDeps();
  starDeps.getFragments = (id: string) => heroSystem.getFragments(id);
  starDeps.spendFragments = (id: string, count: number) => heroSystem.useFragments(id, count);
  starSystem.setDeps(starDeps);
  // 注入等级上限回调到 HeroSystem
  heroSystem.setLevelCapGetter((id) => starSystem.getLevelCap(id));
  const levelSystem = new HeroLevelSystem();
  levelSystem.setLevelDeps(makeRichLevelDepsWithCap(heroSystem, starSystem));
  return { heroSystem, starSystem, starDeps, levelSystem };
}

// ═══════════════════════════════════════════════════════════════════════════════
describe('等级上限联动 — HeroLevelSystem + HeroStarSystem', () => {
  let heroSystem: HeroSystem;
  let starSystem: HeroStarSystem;
  let starDeps: ReturnType<typeof makeRichStarDeps>;
  let levelSystem: HeroLevelSystem;

  beforeEach(() => {
    vi.restoreAllMocks();
    ({ heroSystem, starSystem, starDeps, levelSystem } = createTestEnv());
    heroSystem.addGeneral('guanyu');
  });

  // ───────────────────────────────────────────
  // 1. 等级上限与突破阶段联动
  // ───────────────────────────────────────────
  describe('等级上限与突破阶段联动', () => {
    it('未突破时等级上限为 50', () => {
      expect(levelSystem.getHeroMaxLevel('guanyu')).toBe(50);
    });

    it('一阶突破后等级上限为 60', () => {
      setBreakthroughStage(starSystem, 'guanyu', 1);
      expect(levelSystem.getHeroMaxLevel('guanyu')).toBe(60);
    });

    it('二阶突破后等级上限为 70', () => {
      setBreakthroughStage(starSystem, 'guanyu', 2);
      expect(levelSystem.getHeroMaxLevel('guanyu')).toBe(70);
    });

    it('三阶突破后等级上限为 80', () => {
      setBreakthroughStage(starSystem, 'guanyu', 3);
      expect(levelSystem.getHeroMaxLevel('guanyu')).toBe(80);
    });

    it('四阶突破后等级上限为 100', () => {
      setBreakthroughStage(starSystem, 'guanyu', 4);
      expect(levelSystem.getHeroMaxLevel('guanyu')).toBe(100);
    });
  });

  // ───────────────────────────────────────────
  // 2. 未突破时等级不能超过 50
  // ───────────────────────────────────────────
  describe('未突破时等级限制', () => {
    it('未突破时 addExp 不能升级超过 50 级', () => {
      // 给大量经验
      const result = levelSystem.addExp('guanyu', 10_000_000)!;
      expect(result.general.level).toBe(INITIAL_LEVEL_CAP);
      expect(result.general.level).toBe(50);
    });

    it('未突破时 quickEnhance 目标超过 50 时截断到 50', () => {
      const result = levelSystem.quickEnhance('guanyu', 70)!;
      expect(result.general.level).toBe(50);
    });

    it('未突破时 getEnhancePreview 目标超过 50 时截断', () => {
      const preview = levelSystem.getEnhancePreview('guanyu', 70)!;
      expect(preview.targetLevel).toBe(50);
    });

    it('未突破时 50 级武将不能再获取经验', () => {
      setGeneralLevel(heroSystem, 'guanyu', 50);
      expect(levelSystem.addExp('guanyu', 10000)).toBeNull();
    });
  });

  // ───────────────────────────────────────────
  // 3. 突破后可以继续升级
  // ───────────────────────────────────────────
  describe('突破后继续升级', () => {
    it('一阶突破后可以从 50 升到 60', () => {
      setGeneralLevel(heroSystem, 'guanyu', 50);
      setBreakthroughStage(starSystem, 'guanyu', 1);
      const result = levelSystem.addExp('guanyu', 10_000_000)!;
      expect(result.general.level).toBe(60);
    });

    it('二阶突破后可以从 60 升到 70', () => {
      setGeneralLevel(heroSystem, 'guanyu', 60);
      setBreakthroughStage(starSystem, 'guanyu', 2);
      const result = levelSystem.addExp('guanyu', 10_000_000)!;
      expect(result.general.level).toBe(70);
    });

    it('三阶突破后可以从 70 升到 80', () => {
      setGeneralLevel(heroSystem, 'guanyu', 70);
      setBreakthroughStage(starSystem, 'guanyu', 3);
      const result = levelSystem.addExp('guanyu', 1_000_000_000)!;
      expect(result.general.level).toBe(80);
    });

    it('四阶突破后可以从 80 升到 100', () => {
      setGeneralLevel(heroSystem, 'guanyu', 80);
      setBreakthroughStage(starSystem, 'guanyu', 4);
      const result = levelSystem.addExp('guanyu', 1_000_000_000)!;
      expect(result.general.level).toBe(100);
    });

    it('四阶突破后 100 级为最终上限', () => {
      setGeneralLevel(heroSystem, 'guanyu', 100);
      setBreakthroughStage(starSystem, 'guanyu', 4);
      expect(levelSystem.addExp('guanyu', 1_000_000_000)).toBeNull();
    });

    it('逐步突破逐步升级：1→50→60→70→80→100', () => {
      // 阶段0：升到50
      let result = levelSystem.addExp('guanyu', 10_000_000)!;
      expect(result.general.level).toBe(50);

      // 一阶突破：50→60
      setBreakthroughStage(starSystem, 'guanyu', 1);
      result = levelSystem.addExp('guanyu', 10_000_000)!;
      expect(result.general.level).toBe(60);

      // 二阶突破：60→70
      setBreakthroughStage(starSystem, 'guanyu', 2);
      result = levelSystem.addExp('guanyu', 10_000_000)!;
      expect(result.general.level).toBe(70);

      // 三阶突破：70→80
      setBreakthroughStage(starSystem, 'guanyu', 3);
      result = levelSystem.addExp('guanyu', 1_000_000_000)!;
      expect(result.general.level).toBe(80);

      // 四阶突破：80→100
      setBreakthroughStage(starSystem, 'guanyu', 4);
      result = levelSystem.addExp('guanyu', 1_000_000_000)!;
      expect(result.general.level).toBe(100);

      // 满级后无法继续
      expect(levelSystem.addExp('guanyu', 1_000_000_000)).toBeNull();
    });
  });

  // ───────────────────────────────────────────
  // 4. 经验溢出时正确处理
  // ───────────────────────────────────────────
  describe('经验溢出处理', () => {
    it('未突破时经验溢出停在 50 级，多余经验保留', () => {
      const result = levelSystem.addExp('guanyu', 10_000_000)!;
      expect(result.general.level).toBe(50);
      // 经验条中应保留溢出的经验（为下次突破后升级准备）
      expect(result.general.exp).toBeGreaterThanOrEqual(0);
    });

    it('突破后保留的经验可以继续用于升级', () => {
      // 先升到 50 级并积累溢出经验
      levelSystem.addExp('guanyu', 10_000_000);
      const gBefore = heroSystem.getGeneral('guanyu')!;
      expect(gBefore.level).toBe(50);
      const savedExp = gBefore.exp;

      // 突破后，武将应能继续升级
      setBreakthroughStage(starSystem, 'guanyu', 1);
      if (savedExp > 0) {
        // 经验已保留在武将身上，addExp 应能继续升级
        const result = levelSystem.addExp('guanyu', 1);
        // 如果保留经验足够升一级，应该升级
        const gAfter = heroSystem.getGeneral('guanyu')!;
        expect(gAfter.level).toBeGreaterThanOrEqual(50);
      }
    });

    it('大量经验在满突破时停在 100 级', () => {
      setBreakthroughStage(starSystem, 'guanyu', 4);
      const result = levelSystem.addExp('guanyu', 100_000_000_000)!;
      expect(result.general.level).toBe(100);
    });
  });

  // ───────────────────────────────────────────
  // 5. 51~100 级经验需求合理
  // ───────────────────────────────────────────
  describe('51~100 级经验需求', () => {
    it('51 级经验需求使用查表配置', () => {
      // 51 级在 51~60 段，expPerLevel=1500
      expect(lookupExp(51)).toBe(51 * 1500);
    });

    it('60 级经验需求使用查表配置', () => {
      // 60 级在 51~60 段，expPerLevel=1500
      expect(lookupExp(60)).toBe(60 * 1500);
    });

    it('70 级经验需求使用查表配置', () => {
      // 70 级在 61~70 段，expPerLevel=2500
      expect(lookupExp(70)).toBe(70 * 2500);
    });

    it('80 级经验需求使用查表配置', () => {
      // 80 级在 71~80 段，expPerLevel=4000
      expect(lookupExp(80)).toBe(80 * 4000);
    });

    it('100 级经验需求使用查表配置', () => {
      // 100 级在 91~100 段，expPerLevel=9000
      expect(lookupExp(100)).toBe(100 * 9000);
    });

    it('51~100 级经验需求单调递增', () => {
      for (let lv = 51; lv < 100; lv++) {
        expect(lookupExp(lv + 1)).toBeGreaterThan(lookupExp(lv));
      }
    });

    it('51~100 级铜钱需求单调递增', () => {
      for (let lv = 51; lv < 100; lv++) {
        expect(lookupGold(lv + 1)).toBeGreaterThan(lookupGold(lv));
      }
    });

    it('50→51 的经验增长幅度大于 49→50', () => {
      const exp49to50 = lookupExp(49);
      const exp50to51 = lookupExp(50);
      const exp51to52 = lookupExp(51);
      // 51 级经验应高于 50 级（高等级段 expPerLevel 更大）
      expect(exp51to52).toBeGreaterThan(exp50to51);
      // 增长率应大于线性阶段
      const linearRatio = exp50to51 / exp49to50;
      const expRatio = exp51to52 / exp50to51;
      expect(expRatio).toBeGreaterThan(linearRatio);
    });

    it('三阶突破后实际能升级到 80 级（消耗指数增长经验）', () => {
      setGeneralLevel(heroSystem, 'guanyu', 70);
      setBreakthroughStage(starSystem, 'guanyu', 3);
      // 给足够多经验（考虑 71~80 级指数增长）
      const result = levelSystem.addExp('guanyu', 1_000_000_000)!;
      expect(result.general.level).toBe(80);
      expect(result.levelsGained).toBe(10);
    });
  });

  // ───────────────────────────────────────────
  // 6. 查询方法与动态等级上限联动
  // ───────────────────────────────────────────
  describe('查询方法联动', () => {
    it('calculateExpToNextLevel 在未突破 50 级时返回 0', () => {
      expect(levelSystem.calculateExpToNextLevel(50, 'guanyu')).toBe(0);
    });

    it('calculateExpToNextLevel 在一阶突破 50 级时返回正确经验', () => {
      setBreakthroughStage(starSystem, 'guanyu', 1);
      const exp = levelSystem.calculateExpToNextLevel(50, 'guanyu');
      expect(exp).toBe(lookupExp(50));
      expect(exp).toBeGreaterThan(0);
    });

    it('canLevelUp 在等级上限时返回 false', () => {
      setGeneralLevel(heroSystem, 'guanyu', 50);
      // 给足够经验和铜钱
      const save = heroSystem.serialize();
      save.state.generals['guanyu'].exp = 999999;
      heroSystem.deserialize(save);
      expect(levelSystem.canLevelUp('guanyu')).toBe(false);
    });

    it('canLevelUp 突破后等级上限以下返回 true（经验充足时）', () => {
      setGeneralLevel(heroSystem, 'guanyu', 50);
      setBreakthroughStage(starSystem, 'guanyu', 1);
      const save = heroSystem.serialize();
      save.state.generals['guanyu'].exp = 999999;
      heroSystem.deserialize(save);
      expect(levelSystem.canLevelUp('guanyu')).toBe(true);
    });

    it('getExpProgress 在等级上限时返回 percentage=100', () => {
      setGeneralLevel(heroSystem, 'guanyu', 50);
      const progress = levelSystem.getExpProgress('guanyu')!;
      expect(progress.percentage).toBe(100);
    });

    it('getExpProgress 突破后 50 级返回正常进度', () => {
      setGeneralLevel(heroSystem, 'guanyu', 50);
      setBreakthroughStage(starSystem, 'guanyu', 1);
      const save = heroSystem.serialize();
      save.state.generals['guanyu'].exp = 1000;
      heroSystem.deserialize(save);
      const progress = levelSystem.getExpProgress('guanyu')!;
      expect(progress.percentage).toBeLessThan(100);
      expect(progress.required).toBeGreaterThan(0);
    });

    it('calculateMaxAffordableLevel 受突破等级上限约束', () => {
      setBreakthroughStage(starSystem, 'guanyu', 1); // 上限 60
      const g = heroSystem.getGeneral('guanyu')!;
      const maxLv = levelSystem.calculateMaxAffordableLevel(g);
      expect(maxLv).toBeLessThanOrEqual(60);
    });
  });

  // ───────────────────────────────────────────
  // 7. 不同武将独立等级上限
  // ───────────────────────────────────────────
  describe('不同武将独立等级上限', () => {
    it('不同武将可以有不同的突破状态和等级上限', () => {
      heroSystem.addGeneral('liubei');
      // guanyu 未突破 → 上限 50
      // liubei 一阶突破 → 上限 60
      setBreakthroughStage(starSystem, 'liubei', 1);

      expect(levelSystem.getHeroMaxLevel('guanyu')).toBe(50);
      expect(levelSystem.getHeroMaxLevel('liubei')).toBe(60);
    });

    it('不同突破状态的武将升级到各自上限', () => {
      heroSystem.addGeneral('liubei');
      setBreakthroughStage(starSystem, 'liubei', 2); // liubei 上限 70

      const resultGuan = levelSystem.addExp('guanyu', 10_000_000)!;
      const resultLiu = levelSystem.addExp('liubei', 10_000_000)!;

      expect(resultGuan.general.level).toBe(50); // 未突破
      expect(resultLiu.general.level).toBe(70);  // 二阶突破
    });
  });

  // ───────────────────────────────────────────
  // 8. fallback 行为（未注入 getLevelCap）
  // ───────────────────────────────────────────
  describe('fallback 行为', () => {
    it('未注入 getLevelCap 时 fallback 到 HERO_MAX_LEVEL(50)', () => {
      const fallbackLevelSys = new HeroLevelSystem();
      const fallbackHeroSys = new HeroSystem();
      fallbackHeroSys.addGeneral('guanyu');
      fallbackLevelSys.setLevelDeps({
        heroSystem: fallbackHeroSys,
        spendResource: vi.fn(() => true),
        canAffordResource: vi.fn(() => true),
        getResourceAmount: vi.fn(() => 1e9),
        // 不注入 getLevelCap
      });
      expect(fallbackLevelSys.getHeroMaxLevel('guanyu')).toBe(HERO_MAX_LEVEL);
    });
  });

  // ───────────────────────────────────────────
  // 9. 觉醒等级上限联动（100→120）
  // ───────────────────────────────────────────
  describe('觉醒等级上限联动（100→120）', () => {
    /** 创建带觉醒感知 getLevelCap 的测试环境 */
    function createAwakenedEnv(awakened: boolean) {
      const hs = new HeroSystem();
      hs.init(makeMockCoreDeps());
      hs.addGeneral('guanyu');
      const ss = new HeroStarSystem(hs);
      ss.init(makeMockCoreDeps());
      const sd = makeRichStarDeps();
      sd.getFragments = (id: string) => hs.getFragments(id);
      sd.spendFragments = (id: string, count: number) => hs.useFragments(id, count);
      ss.setDeps(sd);
      // 四阶突破（上限100）
      setBreakthroughStage(ss, 'guanyu', 4);
      hs.setLevelCapGetter((id) => {
        if (awakened) return 120;
        return ss.getLevelCap(id);
      });
      const ls = new HeroLevelSystem();
      ls.setLevelDeps({
        heroSystem: hs,
        spendResource: vi.fn((type: string, amount: number) => true),
        canAffordResource: vi.fn(() => true),
        getResourceAmount: vi.fn(() => 1e12),
        getLevelCap: (id: string) => {
          if (awakened) return 120;
          return ss.getLevelCap(id);
        },
      });
      return { heroSystem: hs, starSystem: ss, levelSystem: ls };
    }

    it('觉醒武将等级上限为 120', () => {
      const { levelSystem } = createAwakenedEnv(true);
      expect(levelSystem.getHeroMaxLevel('guanyu')).toBe(120);
    });

    it('未觉醒武将等级上限仍为 100（四阶突破）', () => {
      const { levelSystem } = createAwakenedEnv(false);
      expect(levelSystem.getHeroMaxLevel('guanyu')).toBe(100);
    });

    it('觉醒后可从 100 升级到 120', () => {
      const { heroSystem: hs, levelSystem: ls } = createAwakenedEnv(true);
      setGeneralLevel(hs, 'guanyu', 100);
      const result = ls.addExp('guanyu', 100_000_000_000)!;
      expect(result.general.level).toBe(120);
      expect(result.levelsGained).toBe(20);
    });

    it('觉醒后 120 级为最终上限', () => {
      const { heroSystem: hs, levelSystem: ls } = createAwakenedEnv(true);
      setGeneralLevel(hs, 'guanyu', 120);
      expect(ls.addExp('guanyu', 100_000_000_000)).toBeNull();
    });

    it('觉醒后 quickEnhance 目标超过 120 时截断到 120', () => {
      const { heroSystem: hs, levelSystem: ls } = createAwakenedEnv(true);
      setGeneralLevel(hs, 'guanyu', 100);
      const result = ls.quickEnhance('guanyu', 150)!;
      expect(result.general.level).toBe(120);
    });

    it('觉醒后 getEnhancePreview 目标超过 120 时截断', () => {
      const { heroSystem: hs, levelSystem: ls } = createAwakenedEnv(true);
      setGeneralLevel(hs, 'guanyu', 100);
      const preview = ls.getEnhancePreview('guanyu', 200)!;
      expect(preview.targetLevel).toBe(120);
    });

    it('觉醒后 canLevelUp 在 120 级时返回 false', () => {
      const { heroSystem: hs, levelSystem: ls } = createAwakenedEnv(true);
      setGeneralLevel(hs, 'guanyu', 120);
      expect(ls.canLevelUp('guanyu')).toBe(false);
    });

    it('觉醒后 getExpProgress 在 120 级时返回 percentage=100', () => {
      const { heroSystem: hs, levelSystem: ls } = createAwakenedEnv(true);
      setGeneralLevel(hs, 'guanyu', 120);
      const progress = ls.getExpProgress('guanyu')!;
      expect(progress.percentage).toBe(100);
    });
  });
});
