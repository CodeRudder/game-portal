import { vi } from 'vitest';
/**
 * HeroLevelSystem 单元测试 — 一键强化 + 批量测试部分
 * 覆盖：quickEnhance、quickEnhanceAll、getEnhancePreview、getBatchEnhancePreview
 *
 * 注意：HeroLevelSystem 和 HeroSystem 各自独立管理武将状态。
 * HeroLevelSystem 通过 syncToHeroSystem 将变更同步到 HeroSystem。
 * 测试中需要确保两个系统共享同一个 HeroSystem 实例。
 */

import { HeroLevelSystem } from '../HeroLevelSystem';
import type { LevelDeps, LevelUpResult, EnhancePreview, BatchEnhanceResult } from '../HeroLevelSystem';
import { HeroSystem } from '../HeroSystem';
import { Quality } from '../hero.types';
import type { GeneralData } from '../hero.types';
import { HERO_MAX_LEVEL, LEVEL_EXP_TABLE } from '../hero-config';

// ── 辅助 ──

/** 无限资源的 mock deps */
function makeRichLevelDeps(heroSystem: HeroSystem): LevelDeps {
  const resources: Record<string, number> = { gold: 1e9, exp: 1e9 };
  return {
    heroSystem,
    spendResource: vi.fn((type: string, amount: number) => {
      resources[type] -= amount;
      return true;
    }),
    canAffordResource: vi.fn((type: string, amount: number) => resources[type] >= amount),
    getResourceAmount: vi.fn((type: string) => resources[type]),
  };
}

/** 指定资源的 mock deps */
function makeLevelDepsWithResources(
  heroSystem: HeroSystem,
  gold: number,
  exp: number,
): LevelDeps {
  const resources: Record<string, number> = { gold, exp };
  return {
    heroSystem,
    spendResource: vi.fn((type: string, amount: number) => {
      if (resources[type] < amount) return false;
      resources[type] -= amount;
      return true;
    }),
    canAffordResource: vi.fn((type: string, amount: number) => resources[type] >= amount),
    getResourceAmount: vi.fn((type: string) => resources[type]),
  };
}

/** 查表获取升到下一级所需经验 */
function lookupExp(level: number): number {
  for (const tier of LEVEL_EXP_TABLE) {
    if (level >= tier.levelMin && level <= tier.levelMax) return level * tier.expPerLevel;
  }
  return level * LEVEL_EXP_TABLE[LEVEL_EXP_TABLE.length - 1].expPerLevel;
}

/** 查表获取升级铜钱 */
function lookupGold(level: number): number {
  for (const tier of LEVEL_EXP_TABLE) {
    if (level >= tier.levelMin && level <= tier.levelMax) return level * tier.goldPerLevel;
  }
  return level * LEVEL_EXP_TABLE[LEVEL_EXP_TABLE.length - 1].goldPerLevel;
}

// ═══════════════════════════════════════════════════════════════
describe('HeroLevelSystem — 一键强化 + 批量测试', () => {
  let heroSystem: HeroSystem;
  let levelSys: HeroLevelSystem;

  beforeEach(() => {
    heroSystem = new HeroSystem();
    heroSystem.addGeneral('guanyu');
    levelSys = new HeroLevelSystem();
    levelSys.setLevelDeps(makeRichLevelDeps(heroSystem));
  });

  // ───────────────────────────────────────────
  // 1. quickEnhance 一键强化
  // ───────────────────────────────────────────
  describe('quickEnhance', () => {
    it('强化到指定等级', () => {
      const result = levelSys.quickEnhance('guanyu', 10);
      expect(result).not.toBeNull();
      expect(result!.general.level).toBe(10);
      expect(result!.levelsGained).toBe(9);
    });

    it('不指定目标等级则强化到资源允许的最高等级', () => {
      const result = levelSys.quickEnhance('guanyu');
      expect(result).not.toBeNull();
      expect(result!.general.level).toBeGreaterThan(1);
    });

    it('消耗正确数量的铜钱和经验', () => {
      const mockDeps = makeRichLevelDeps(heroSystem);
      levelSys.setLevelDeps(mockDeps);
      const result = levelSys.quickEnhance('guanyu', 5)!;

      // 计算预期消耗
      let expectedGold = 0;
      let expectedExp = 0;
      for (let lv = 1; lv < 5; lv++) {
        expectedGold += lookupGold(lv);
        expectedExp += lookupExp(lv);
      }
      expect(result.goldSpent).toBe(expectedGold);
      expect(result.expSpent).toBe(expectedExp);
    });

    it('资源不足时强化到最高可达等级', () => {
      // 只给够升1级的资源
      levelSys.setLevelDeps(makeLevelDepsWithResources(
        heroSystem,
        lookupGold(1),
        lookupExp(1),
      ));
      const result = levelSys.quickEnhance('guanyu', 10);
      expect(result).not.toBeNull();
      expect(result!.general.level).toBe(2); // 只能升1级
    });

    it('目标等级超过上限时截断到 MAX_LEVEL', () => {
      const result = levelSys.quickEnhance('guanyu', 999);
      expect(result).not.toBeNull();
      expect(result!.general.level).toBe(HERO_MAX_LEVEL);
    });

    it('目标等级 <= 当前等级返回 null', () => {
      expect(levelSys.quickEnhance('guanyu', 1)).toBeNull();
      expect(levelSys.quickEnhance('guanyu', 0)).toBeNull();
    });

    it('武将不存在返回 null', () => {
      expect(levelSys.quickEnhance('nobody', 10)).toBeNull();
    });

    it('满级武将返回 null', () => {
      const save = heroSystem.serialize();
      save.state.generals['guanyu'].level = HERO_MAX_LEVEL;
      const hs2 = new HeroSystem();
      hs2.deserialize(save);
      levelSys.setLevelDeps(makeRichLevelDeps(hs2));
      expect(levelSys.quickEnhance('guanyu', 60)).toBeNull();
    });
  });

  // ───────────────────────────────────────────
  // 2. quickEnhanceAll 批量强化
  // ───────────────────────────────────────────
  describe('quickEnhanceAll', () => {
    beforeEach(() => {
      heroSystem.addGeneral('liubei');
      heroSystem.addGeneral('caocao');
      levelSys.setLevelDeps(makeRichLevelDeps(heroSystem));
    });

    it('批量强化所有武将', () => {
      const result = levelSys.quickEnhanceAll(10);
      expect(result.results.length).toBeGreaterThan(0);
    });

    it('返回汇总消耗和战力增长', () => {
      const result = levelSys.quickEnhanceAll(5);
      expect(result.totalGoldSpent).toBeGreaterThan(0);
      expect(result.totalExpSpent).toBeGreaterThanOrEqual(0);
      expect(result.totalPowerGain).toBeGreaterThan(0);
    });

    it('无武将时返回空结果', () => {
      const emptyHero = new HeroSystem();
      levelSys.setLevelDeps(makeRichLevelDeps(emptyHero));
      const result = levelSys.quickEnhanceAll(10);
      expect(result.results).toHaveLength(0);
      expect(result.totalGoldSpent).toBe(0);
    });

    it('满级武将被跳过', () => {
      const save = heroSystem.serialize();
      save.state.generals['guanyu'].level = HERO_MAX_LEVEL;
      const hs2 = new HeroSystem();
      hs2.deserialize(save);
      levelSys.setLevelDeps(makeRichLevelDeps(hs2));
      const result = levelSys.quickEnhanceAll(10);
      const upgraded = result.results.map((r) => r.general.id);
      expect(upgraded).not.toContain('guanyu');
    });

    it('未设置依赖时返回空结果', () => {
      const ls = new HeroLevelSystem();
      const result = ls.quickEnhanceAll(10);
      expect(result.results).toHaveLength(0);
    });
  });

  // ───────────────────────────────────────────
  // 3. getEnhancePreview 预览
  // ───────────────────────────────────────────
  describe('getEnhancePreview', () => {
    it('预览信息字段完整', () => {
      const preview = levelSys.getEnhancePreview('guanyu', 10);
      expect(preview).not.toBeNull();
      expect(preview!.generalId).toBe('guanyu');
      expect(preview!.currentLevel).toBe(1);
      expect(preview!.targetLevel).toBe(10);
      expect(preview!.totalGold).toBeGreaterThan(0);
      expect(preview!.totalExp).toBeGreaterThanOrEqual(0);
      expect(preview!.statsDiff).toBeDefined();
      expect(preview!.powerBefore).toBeGreaterThan(0);
      expect(preview!.powerAfter).toBeGreaterThan(0);
      expect(typeof preview!.affordable).toBe('boolean');
    });

    it('预览不执行实际操作', () => {
      const mockDeps = makeRichLevelDeps(heroSystem);
      levelSys.setLevelDeps(mockDeps);
      levelSys.getEnhancePreview('guanyu', 10);
      expect(mockDeps.spendResource).not.toHaveBeenCalled();
      expect(heroSystem.getGeneral('guanyu')!.level).toBe(1);
    });

    it('目标等级超过上限截断到 MAX_LEVEL', () => {
      const preview = levelSys.getEnhancePreview('guanyu', 999);
      expect(preview!.targetLevel).toBe(HERO_MAX_LEVEL);
    });

    it('当前等级 >= 目标等级时预览无变化', () => {
      const preview = levelSys.getEnhancePreview('guanyu', 1);
      expect(preview!.targetLevel).toBe(1);
      expect(preview!.totalGold).toBe(0);
      expect(preview!.totalExp).toBe(0);
      expect(preview!.powerBefore).toBe(preview!.powerAfter);
    });

    it('武将不存在返回 null', () => {
      expect(levelSys.getEnhancePreview('nobody', 10)).toBeNull();
    });

    it('资源不足时 affordable=false', () => {
      levelSys.setLevelDeps(makeLevelDepsWithResources(heroSystem, 0, 0));
      const preview = levelSys.getEnhancePreview('guanyu', 10);
      expect(preview!.affordable).toBe(false);
    });
  });

  // ───────────────────────────────────────────
  // 4. getBatchEnhancePreview
  // ───────────────────────────────────────────
  describe('getBatchEnhancePreview', () => {
    beforeEach(() => {
      heroSystem.addGeneral('liubei');
      heroSystem.addGeneral('caocao');
      levelSys.setLevelDeps(makeRichLevelDeps(heroSystem));
    });

    it('默认最多返回 5 个预览', () => {
      // 添加更多武将
      heroSystem.addGeneral('zhangfei');
      heroSystem.addGeneral('dianwei');
      heroSystem.addGeneral('zhouyu');
      heroSystem.addGeneral('lvbu');
      const previews = levelSys.getBatchEnhancePreview(10);
      expect(previews.length).toBeLessThanOrEqual(5);
    });

    it('limit 参数控制数量', () => {
      const previews = levelSys.getBatchEnhancePreview(10, 2);
      expect(previews.length).toBeLessThanOrEqual(2);
    });

    it('预览按优先级排序', () => {
      const previews = levelSys.getBatchEnhancePreview(10);
      if (previews.length >= 2) {
        const p0 = heroSystem.calculatePower(heroSystem.getGeneral(previews[0].generalId)!);
        const p1 = heroSystem.calculatePower(heroSystem.getGeneral(previews[1].generalId)!);
        expect(p0).toBeGreaterThanOrEqual(p1);
      }
    });

    it('未设置依赖返回空数组', () => {
      const ls = new HeroLevelSystem();
      expect(ls.getBatchEnhancePreview(10)).toEqual([]);
    });
  });
});
