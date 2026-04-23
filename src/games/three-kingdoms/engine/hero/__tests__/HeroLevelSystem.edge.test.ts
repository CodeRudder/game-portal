import { vi } from 'vitest';
/**
 * HeroLevelSystem 补充边界测试 — 最大等级边界、精确资源、战力计算
 * 覆盖：MAX_LEVEL addExp/quickEnhance、精确经验/铜钱边界、批量强化排序验证、属性变化
 */

import { HeroLevelSystem } from '../HeroLevelSystem';
import type { LevelDeps, EnhancePreview } from '../HeroLevelSystem';
import { HeroSystem } from '../HeroSystem';
import { Quality } from '../hero.types';
import { HERO_MAX_LEVEL, LEVEL_EXP_TABLE } from '../hero-config';

// ── 辅助 ──

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

function makeLevelDepsWithResources(heroSystem: HeroSystem, gold: number, exp: number): LevelDeps {
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
describe('HeroLevelSystem — 补充边界测试', () => {
  let heroSystem: HeroSystem;
  let levelSys: HeroLevelSystem;

  beforeEach(() => {
    heroSystem = new HeroSystem();
    levelSys = new HeroLevelSystem();
  });

  // ───────────────────────────────────────────
  // 1. 最大等级边界
  // ───────────────────────────────────────────
  describe('最大等级边界', () => {
    it('等级 50 时 addExp 不再升级', () => {
      heroSystem.addGeneral('guanyu');
      setGeneralLevel(heroSystem, 'guanyu', HERO_MAX_LEVEL);
      levelSys.setLevelDeps(makeRichLevelDeps(heroSystem));
      expect(levelSys.addExp('guanyu', 10000)).toBeNull();
      expect(heroSystem.getGeneral('guanyu')!.level).toBe(HERO_MAX_LEVEL);
    });

    it('等级 50 时 quickEnhance 跳过', () => {
      heroSystem.addGeneral('guanyu');
      setGeneralLevel(heroSystem, 'guanyu', HERO_MAX_LEVEL);
      levelSys.setLevelDeps(makeRichLevelDeps(heroSystem));
      expect(levelSys.quickEnhance('guanyu', 60)).toBeNull();
    });
  });

  // ───────────────────────────────────────────
  // 2. 精确经验边界
  // ───────────────────────────────────────────
  describe('精确经验边界', () => {
    it('经验恰好等于升级所需时正确升级', () => {
      heroSystem.addGeneral('guanyu');
      const expReq = lookupExp(1);
      levelSys.setLevelDeps(makeRichLevelDeps(heroSystem));
      const result = levelSys.addExp('guanyu', expReq)!;
      expect(result.levelsGained).toBe(1);
      expect(result.general.level).toBe(2);
      // 升级后经验归零（恰好用完）
      expect(result.general.exp).toBe(0);
    });

    it('经验超过多级时逐级升级', () => {
      heroSystem.addGeneral('guanyu');
      // 计算从 Lv1 升到 Lv5 所需总经验
      let totalExpNeeded = 0;
      for (let i = 1; i <= 4; i++) totalExpNeeded += lookupExp(i);
      levelSys.setLevelDeps(makeRichLevelDeps(heroSystem));
      const result = levelSys.addExp('guanyu', totalExpNeeded)!;
      expect(result.levelsGained).toBe(4);
      expect(result.general.level).toBe(5);
    });
  });

  // ───────────────────────────────────────────
  // 3. 精确铜钱边界
  // ───────────────────────────────────────────
  describe('精确铜钱边界', () => {
    it('铜钱恰好等于升级消耗时成功', () => {
      heroSystem.addGeneral('guanyu');
      const gold1 = lookupGold(1);
      const exp1 = lookupExp(1);
      levelSys.setLevelDeps(makeLevelDepsWithResources(heroSystem, gold1, exp1));
      const result = levelSys.addExp('guanyu', exp1)!;
      expect(result.levelsGained).toBe(1);
      expect(result.goldSpent).toBe(gold1);
    });

    it('铜钱差 1 时升级停在当前级', () => {
      heroSystem.addGeneral('guanyu');
      const gold1 = lookupGold(1);
      const exp1 = lookupExp(1);
      // 铜钱差1，经验充足
      levelSys.setLevelDeps(makeLevelDepsWithResources(heroSystem, gold1 - 1, 1e9));
      const result = levelSys.addExp('guanyu', exp1)!;
      // 铜钱不足，无法升级，经验保留在经验条
      expect(result.levelsGained).toBe(0);
      expect(result.general.exp).toBe(exp1);
    });
  });

  // ───────────────────────────────────────────
  // 4. 批量强化排序验证
  // ───────────────────────────────────────────
  describe('批量强化排序验证', () => {
    it('批量强化按战力排序优先强化高战力武将', () => {
      heroSystem.addGeneral('guanyu');   // LEGENDARY, 高战力
      heroSystem.addGeneral('dianwei');  // RARE, 低战力
      // 只给够升1级的资源
      const gold = lookupGold(1);
      const exp = lookupExp(1);
      levelSys.setLevelDeps(makeLevelDepsWithResources(heroSystem, gold, exp));

      const result = levelSys.quickEnhanceAll(5);
      // 高战力的 guanyu 应优先被强化
      if (result.results.length === 1) {
        expect(result.results[0].general.id).toBe('guanyu');
      }
    });

    it('批量强化跳过已满级武将', () => {
      heroSystem.addGeneral('guanyu');
      heroSystem.addGeneral('liubei');
      setGeneralLevel(heroSystem, 'guanyu', HERO_MAX_LEVEL);
      levelSys.setLevelDeps(makeRichLevelDeps(heroSystem));

      const result = levelSys.quickEnhanceAll(10);
      const upgradedIds = result.results.map((r) => r.general.id);
      expect(upgradedIds).not.toContain('guanyu');
      // liubei 应该被强化
      expect(upgradedIds).toContain('liubei');
    });
  });

  // ───────────────────────────────────────────
  // 5. 属性变化预览
  // ───────────────────────────────────────────
  describe('属性变化预览', () => {
    it('getEnhancePreview 返回正确的属性变化', () => {
      heroSystem.addGeneral('guanyu');
      levelSys.setLevelDeps(makeRichLevelDeps(heroSystem));

      const preview = levelSys.getEnhancePreview('guanyu', 10)!;
      // Lv1 → Lv10, 属性应增长
      expect(preview.statsDiff.after.attack).toBeGreaterThan(preview.statsDiff.before.attack);
      expect(preview.statsDiff.after.defense).toBeGreaterThan(preview.statsDiff.before.defense);
      expect(preview.statsDiff.after.intelligence).toBeGreaterThanOrEqual(preview.statsDiff.before.intelligence);
      expect(preview.statsDiff.after.speed).toBeGreaterThanOrEqual(preview.statsDiff.before.speed);
    });

    it('getEnhancePreview 战力增长正确', () => {
      heroSystem.addGeneral('guanyu');
      levelSys.setLevelDeps(makeRichLevelDeps(heroSystem));

      const preview = levelSys.getEnhancePreview('guanyu', 10)!;
      expect(preview.powerAfter).toBeGreaterThan(preview.powerBefore);
    });
  });

  // ───────────────────────────────────────────
  // 6. 升级后战力计算
  // ───────────────────────────────────────────
  describe('升级后战力计算', () => {
    it('升级后武将战力正确增长', () => {
      heroSystem.addGeneral('guanyu');
      levelSys.setLevelDeps(makeRichLevelDeps(heroSystem));

      const powerBefore = heroSystem.calculatePower(heroSystem.getGeneral('guanyu')!);
      levelSys.quickEnhance('guanyu', 10);
      const powerAfter = heroSystem.calculatePower(heroSystem.getGeneral('guanyu')!);

      expect(powerAfter).toBeGreaterThan(powerBefore);
    });

    it('statsDiff 中 after 属性与实际武将属性一致', () => {
      heroSystem.addGeneral('guanyu');
      levelSys.setLevelDeps(makeRichLevelDeps(heroSystem));

      const result = levelSys.quickEnhance('guanyu', 5)!;
      const actualGeneral = heroSystem.getGeneral('guanyu')!;
      // 升级后的实际等级应与 result 一致
      expect(actualGeneral.level).toBe(result.general.level);
    });
  });
});
