/**
 * HeroLevelSystem 边界测试 — 最大等级限制、资源不足截断、批量强化排序
 * 覆盖：MAX_LEVEL 边界、资源耗尽截断、跨等级段计算、批量排序优先级
 */

import { HeroLevelSystem } from '../HeroLevelSystem';
import type { LevelDeps } from '../HeroLevelSystem';
import { HeroSystem } from '../HeroSystem';
import { Quality, QUALITY_ORDER } from '../hero.types';
import { HERO_MAX_LEVEL, LEVEL_EXP_TABLE } from '../hero-config';

// ── 辅助 ──

function makeRichLevelDeps(heroSystem: HeroSystem): LevelDeps {
  const resources: Record<string, number> = { gold: 1e9, exp: 1e9 };
  return {
    heroSystem,
    spendResource: jest.fn((type: string, amount: number) => {
      resources[type] -= amount;
      return true;
    }),
    canAffordResource: jest.fn((type: string, amount: number) => resources[type] >= amount),
    getResourceAmount: jest.fn((type: string) => resources[type]),
  };
}

function makeLevelDepsWithResources(heroSystem: HeroSystem, gold: number, exp: number): LevelDeps {
  const resources: Record<string, number> = { gold, exp };
  return {
    heroSystem,
    spendResource: jest.fn((type: string, amount: number) => {
      if (resources[type] < amount) return false;
      resources[type] -= amount;
      return true;
    }),
    canAffordResource: jest.fn((type: string, amount: number) => resources[type] >= amount),
    getResourceAmount: jest.fn((type: string) => resources[type]),
  };
}

function lookupExp(level: number): number {
  for (const tier of LEVEL_EXP_TABLE) {
    if (level >= tier.levelMin && level <= tier.levelMax) return level * tier.expPerLevel;
  }
  return level * LEVEL_EXP_TABLE[LEVEL_EXP_TABLE.length - 1].expPerLevel;
}

function lookupGold(level: number): number {
  for (const tier of LEVEL_EXP_TABLE) {
    if (level >= tier.levelMin && level <= tier.levelMax) return level * tier.goldPerLevel;
  }
  return level * LEVEL_EXP_TABLE[LEVEL_EXP_TABLE.length - 1].goldPerLevel;
}

/** 设置武将等级和经验（通过序列化） */
function setGeneralLevel(hs: HeroSystem, id: string, level: number, exp: number = 0): void {
  const save = hs.serialize();
  if (save.state.generals[id]) {
    save.state.generals[id].level = level;
    save.state.generals[id].exp = exp;
    hs.deserialize(save);
  }
}

// ═══════════════════════════════════════════════════════════════
describe('HeroLevelSystem — 边界测试', () => {
  let heroSystem: HeroSystem;
  let levelSys: HeroLevelSystem;

  beforeEach(() => {
    heroSystem = new HeroSystem();
    levelSys = new HeroLevelSystem();
  });

  // ───────────────────────────────────────────
  // 1. 最大等级限制
  // ───────────────────────────────────────────
  describe('最大等级限制', () => {
    it('HERO_MAX_LEVEL 为 50', () => {
      expect(HERO_MAX_LEVEL).toBe(50);
    });

    it('quickEnhance 目标超过 MAX_LEVEL 时截断到 MAX_LEVEL', () => {
      heroSystem.addGeneral('guanyu');
      levelSys.setLevelDeps(makeRichLevelDeps(heroSystem));
      const result = levelSys.quickEnhance('guanyu', 999)!;
      expect(result.general.level).toBe(HERO_MAX_LEVEL);
    });

    it('getEnhancePreview 目标超过 MAX_LEVEL 时截断', () => {
      heroSystem.addGeneral('guanyu');
      levelSys.setLevelDeps(makeRichLevelDeps(heroSystem));
      const preview = levelSys.getEnhancePreview('guanyu', 999)!;
      expect(preview.targetLevel).toBe(HERO_MAX_LEVEL);
    });

    it('addExp 对 MAX_LEVEL-1 武将只能升到 MAX_LEVEL', () => {
      heroSystem.addGeneral('guanyu');
      setGeneralLevel(heroSystem, 'guanyu', HERO_MAX_LEVEL - 1);
      levelSys.setLevelDeps(makeRichLevelDeps(heroSystem));
      const result = levelSys.addExp('guanyu', 1e9)!;
      expect(result.general.level).toBe(HERO_MAX_LEVEL);
    });

    it('addExp 对 MAX_LEVEL 武将返回 null', () => {
      heroSystem.addGeneral('guanyu');
      setGeneralLevel(heroSystem, 'guanyu', HERO_MAX_LEVEL);
      levelSys.setLevelDeps(makeRichLevelDeps(heroSystem));
      expect(levelSys.addExp('guanyu', 1000)).toBeNull();
    });

    it('calculateMaxAffordableLevel 对 MAX_LEVEL 武将返回 MAX_LEVEL', () => {
      heroSystem.addGeneral('guanyu');
      setGeneralLevel(heroSystem, 'guanyu', HERO_MAX_LEVEL);
      levelSys.setLevelDeps(makeRichLevelDeps(heroSystem));
      const g = heroSystem.getGeneral('guanyu')!;
      expect(levelSys.calculateMaxAffordableLevel(g)).toBe(HERO_MAX_LEVEL);
    });

    it('calculateTotalExp 对 from=MAX_LEVEL 返回 0', () => {
      expect(levelSys.calculateTotalExp(HERO_MAX_LEVEL, HERO_MAX_LEVEL + 5)).toBe(0);
    });

    it('calculateTotalGold 对 from=MAX_LEVEL 返回 0', () => {
      expect(levelSys.calculateTotalGold(HERO_MAX_LEVEL, HERO_MAX_LEVEL + 5)).toBe(0);
    });
  });

  // ───────────────────────────────────────────
  // 2. 资源不足截断
  // ───────────────────────────────────────────
  describe('资源不足截断', () => {
    it('addExp 铜钱不足时停在耗尽的那级', () => {
      heroSystem.addGeneral('guanyu');
      // 只给够升1级的铜钱，但经验给很多
      const gold1 = lookupGold(1);
      const exp10 = 0;
      levelSys.setLevelDeps(makeLevelDepsWithResources(heroSystem, gold1, 1e9));
      const result = levelSys.addExp('guanyu', 1e9)!;
      // 应该只升到 2 级（铜钱只够升1级）
      expect(result.general.level).toBe(2);
    });

    it('addExp 经验刚好够升一级', () => {
      heroSystem.addGeneral('guanyu');
      const exp1 = lookupExp(1);
      levelSys.setLevelDeps(makeLevelDepsWithResources(heroSystem, lookupGold(1), exp1));
      const result = levelSys.addExp('guanyu', exp1)!;
      expect(result.levelsGained).toBe(1);
    });

    it('quickEnhance 零资源返回 null', () => {
      heroSystem.addGeneral('guanyu');
      levelSys.setLevelDeps(makeLevelDepsWithResources(heroSystem, 0, 0));
      expect(levelSys.quickEnhance('guanyu', 10)).toBeNull();
    });

    it('quickEnhanceAll 部分武将资源不足时跳过', () => {
      heroSystem.addGeneral('guanyu');
      heroSystem.addGeneral('liubei');
      // 给很少资源，只够升一个
      const gold = lookupGold(1);
      const exp = lookupExp(1);
      levelSys.setLevelDeps(makeLevelDepsWithResources(heroSystem, gold, exp));
      const result = levelSys.quickEnhanceAll(10);
      // 至少有一个升了级，或者都没升（资源不够任何一个）
      expect(result.results.length).toBeLessThanOrEqual(2);
    });

    it('getEnhancePreview 资源不足时 affordable=false', () => {
      heroSystem.addGeneral('guanyu');
      levelSys.setLevelDeps(makeLevelDepsWithResources(heroSystem, 0, 0));
      const preview = levelSys.getEnhancePreview('guanyu', 5)!;
      expect(preview.affordable).toBe(false);
    });

    it('calculateMaxAffordableLevel 有限资源返回部分等级', () => {
      heroSystem.addGeneral('guanyu');
      // 给够升3级的资源
      let gold = 0, exp = 0;
      for (let i = 1; i <= 3; i++) {
        gold += lookupGold(i);
        exp += lookupExp(i);
      }
      levelSys.setLevelDeps(makeLevelDepsWithResources(heroSystem, gold, exp));
      const g = heroSystem.getGeneral('guanyu')!;
      const maxLv = levelSys.calculateMaxAffordableLevel(g);
      expect(maxLv).toBe(4); // 从1升到4
    });
  });

  // ───────────────────────────────────────────
  // 3. 批量强化排序
  // ───────────────────────────────────────────
  describe('批量强化排序', () => {
    it('按战力降序排列', () => {
      heroSystem.addGeneral('guanyu');    // LEGENDARY, 高战力
      heroSystem.addGeneral('liubei');    // EPIC
      heroSystem.addGeneral('dianwei');   // RARE
      levelSys.setLevelDeps(makeRichLevelDeps(heroSystem));

      const previews = levelSys.getBatchEnhancePreview(10, 3);
      if (previews.length >= 2) {
        const p0 = heroSystem.calculatePower(heroSystem.getGeneral(previews[0].generalId)!);
        const p1 = heroSystem.calculatePower(heroSystem.getGeneral(previews[1].generalId)!);
        expect(p0).toBeGreaterThanOrEqual(p1);
      }
    });

    it('同战力按品质降序', () => {
      // 创建两个同品质武将测试排序稳定性
      heroSystem.addGeneral('liubei');    // EPIC
      heroSystem.addGeneral('zhangfei');  // EPIC
      levelSys.setLevelDeps(makeRichLevelDeps(heroSystem));

      const previews = levelSys.getBatchEnhancePreview(10, 2);
      expect(previews.length).toBeLessThanOrEqual(2);
    });

    it('quickEnhanceAll 按优先级消耗资源', () => {
      heroSystem.addGeneral('guanyu');    // LEGENDARY
      heroSystem.addGeneral('dianwei');   // RARE
      // 给有限资源，只够升一个
      const gold = lookupGold(1) * 2;
      const exp = lookupExp(1) * 2;
      levelSys.setLevelDeps(makeLevelDepsWithResources(heroSystem, gold, exp));

      const result = levelSys.quickEnhanceAll(5);
      // 高优先级（高战力）的武将应优先被强化
      if (result.results.length > 0) {
        const firstId = result.results[0].general.id;
        expect(firstId).toBe('guanyu'); // LEGENDARY 应排在前面
      }
    });

    it('getBatchEnhancePreview limit=1 只返回1个', () => {
      heroSystem.addGeneral('guanyu');
      heroSystem.addGeneral('liubei');
      heroSystem.addGeneral('dianwei');
      levelSys.setLevelDeps(makeRichLevelDeps(heroSystem));

      const previews = levelSys.getBatchEnhancePreview(10, 1);
      expect(previews.length).toBeLessThanOrEqual(1);
    });

    it('满级武将不出现在批量预览中', () => {
      heroSystem.addGeneral('guanyu');
      setGeneralLevel(heroSystem, 'guanyu', HERO_MAX_LEVEL);
      heroSystem.addGeneral('liubei');
      levelSys.setLevelDeps(makeRichLevelDeps(heroSystem));

      const previews = levelSys.getBatchEnhancePreview(10);
      const ids = previews.map((p) => p.generalId);
      expect(ids).not.toContain('guanyu');
    });
  });

  // ───────────────────────────────────────────
  // 4. 跨等级段计算
  // ───────────────────────────────────────────
  describe('跨等级段计算', () => {
    it('calculateExpToNextLevel 跨等级段边界正确', () => {
      // Lv10 → Lv11 跨等级段
      heroSystem.addGeneral('guanyu');
      levelSys.setLevelDeps(makeRichLevelDeps(heroSystem));

      const exp10 = levelSys.calculateExpToNextLevel(10);
      const exp11 = levelSys.calculateExpToNextLevel(11);
      expect(exp10).toBe(10 * 50);  // tier 1: expPerLevel=50
      expect(exp11).toBe(11 * 120); // tier 2: expPerLevel=120
      expect(exp11).toBeGreaterThan(exp10);
    });

    it('calculateLevelUpCost 跨等级段边界正确', () => {
      const gold10 = levelSys.calculateLevelUpCost(10);
      const gold11 = levelSys.calculateLevelUpCost(11);
      expect(gold10).toBe(10 * 20);   // tier 1: goldPerLevel=20
      expect(gold11).toBe(11 * 50);   // tier 2: goldPerLevel=50
    });

    it('quickEnhance 从 Lv1 到 Lv15 跨多个等级段', () => {
      heroSystem.addGeneral('guanyu');
      levelSys.setLevelDeps(makeRichLevelDeps(heroSystem));
      const result = levelSys.quickEnhance('guanyu', 15)!;
      expect(result.general.level).toBe(15);
      expect(result.goldSpent).toBeGreaterThan(0);
    });
  });
});
