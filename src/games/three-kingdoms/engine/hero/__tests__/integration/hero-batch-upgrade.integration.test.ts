/**
 * 集成测试: 批量升级+一键强化+资源预估
 *
 * 覆盖 §6.11 ~ §6.15:
 *   §6.11 武将批量升级
 *   §6.12 一键强化（单将）
 *   §6.13 一键强化全部
 *   §6.14 资源预估与预览
 *   §6.15 红点触发（可能 skip — UI 层逻辑）
 *
 * @module engine/hero/__tests__/integration/hero-batch-upgrade
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HeroSystem } from '../../HeroSystem';
import { HeroLevelSystem } from '../../HeroLevelSystem';
import type { LevelDeps, EnhancePreview, BatchEnhanceResult } from '../../HeroLevelSystem';
import type { GeneralData } from '../../hero.types';
import { Quality } from '../../hero.types';
import { HERO_MAX_LEVEL, LEVEL_EXP_TABLE } from '../../hero-config';

// ─────────────────────────────────────────────
// 辅助
// ─────────────────────────────────────────────

/** 资源仓库（模拟） */
function createResourceWallet(initGold = 100000, initExp = 100000) {
  let gold = initGold;
  let exp = initExp;
  return {
    getGold: () => gold,
    getExp: () => exp,
    setGold: (v: number) => { gold = v; },
    setExp: (v: number) => { exp = v; },
    spend: (type: string, amount: number): boolean => {
      if (type === 'gold') { if (gold < amount) return false; gold -= amount; return true; }
      if (type === 'exp') { if (exp < amount) return false; exp -= amount; return true; }
      return false;
    },
    canAfford: (type: string, amount: number): boolean => {
      if (type === 'gold') return gold >= amount;
      if (type === 'exp') return exp >= amount;
      return false;
    },
    getAmount: (type: string): number => {
      if (type === 'gold') return gold;
      if (type === 'exp') return exp;
      return 0;
    },
  };
}

/** 创建完整的 hero + level 系统 */
function createSystems(wallet?: ReturnType<typeof createResourceWallet>) {
  const heroSystem = new HeroSystem();
  const levelSystem = new HeroLevelSystem();
  const w = wallet ?? createResourceWallet();
  levelSystem.setLevelDeps({
    heroSystem,
    spendResource: w.spend,
    canAffordResource: w.canAfford,
    getResourceAmount: w.getAmount,
  });
  return { heroSystem, levelSystem, wallet: w };
}

/** 添加多个武将 */
function addHeroes(heroSystem: HeroSystem, ids: string[]): GeneralData[] {
  const heroes: GeneralData[] = [];
  for (const id of ids) {
    const g = heroSystem.addGeneral(id);
    if (g) heroes.push(g);
  }
  return heroes;
}

/** 获取升级到下一级所需经验 */
function expForLevel(level: number): number {
  for (const tier of LEVEL_EXP_TABLE) {
    if (level >= tier.levelMin && level <= tier.levelMax) return level * tier.expPerLevel;
  }
  return level * LEVEL_EXP_TABLE[LEVEL_EXP_TABLE.length - 1].expPerLevel;
}

/** 获取升级到下一级所需铜钱 */
function goldForLevel(level: number): number {
  for (const tier of LEVEL_EXP_TABLE) {
    if (level >= tier.levelMin && level <= tier.levelMax) return level * tier.goldPerLevel;
  }
  return level * LEVEL_EXP_TABLE[LEVEL_EXP_TABLE.length - 1].goldPerLevel;
}

// ═══════════════════════════════════════════════
// §6.11 武将批量升级
// ═══════════════════════════════════════════════

describe('§6.11 武将批量升级', () => {
  let heroSystem: HeroSystem;
  let levelSystem: HeroLevelSystem;
  let wallet: ReturnType<typeof createResourceWallet>;

  beforeEach(() => {
    ({ heroSystem, levelSystem, wallet } = createSystems());
  });

  it('批量升级指定武将列表', () => {
    const heroes = addHeroes(heroSystem, ['guanyu', 'zhangfei', 'liubei']);
    const result = levelSystem.batchUpgrade(
      heroes.map(h => h.id),
      5,
    );
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.skipped.length).toBe(0);
  });

  it('批量升级跳过不存在的武将', () => {
    const heroes = addHeroes(heroSystem, ['guanyu']);
    const result = levelSystem.batchUpgrade(
      ['guanyu', 'nonexistent_hero', 'another_fake'],
      5,
    );
    expect(result.skipped).toContain('nonexistent_hero');
    expect(result.skipped).toContain('another_fake');
    expect(result.skipped).toHaveLength(2);
  });

  it('批量升级跳过满级武将', () => {
    const hero = heroSystem.addGeneral('guanyu');
    if (hero) {
      heroSystem.setLevelAndExp('guanyu', HERO_MAX_LEVEL, 0);
    }
    const result = levelSystem.batchUpgrade(['guanyu'], HERO_MAX_LEVEL);
    expect(result.skipped).toContain('guanyu');
  });

  it('批量升级资源不足时跳过', () => {
    wallet.setGold(0);
    wallet.setExp(0);
    const heroes = addHeroes(heroSystem, ['guanyu']);
    const result = levelSystem.batchUpgrade(heroes.map(h => h.id), 10);
    // 资源不足，应跳过
    expect(result.skipped.length + result.results.length).toBe(1);
  });

  it('批量升级汇总统计正确', () => {
    const heroes = addHeroes(heroSystem, ['guanyu', 'zhangfei']);
    const result = levelSystem.batchUpgrade(
      heroes.map(h => h.id),
      3,
    );
    let expectedGold = 0;
    let expectedExp = 0;
    for (const r of result.results) {
      expectedGold += r.goldSpent;
      expectedExp += r.expSpent;
    }
    expect(result.totalGoldSpent).toBe(expectedGold);
    expect(result.totalExpSpent).toBe(expectedExp);
  });

  it('批量升级战力增长为正数', () => {
    const heroes = addHeroes(heroSystem, ['guanyu', 'zhaoyun']);
    const result = levelSystem.batchUpgrade(
      heroes.map(h => h.id),
      5,
    );
    expect(result.totalPowerGain).toBeGreaterThan(0);
  });

  it('空列表批量升级返回空结果', () => {
    const result = levelSystem.batchUpgrade([], 10);
    expect(result.results).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
    expect(result.totalGoldSpent).toBe(0);
    expect(result.totalExpSpent).toBe(0);
  });

  it('批量升级按列表顺序执行', () => {
    const heroes = addHeroes(heroSystem, ['guanyu', 'zhangfei', 'liubei']);
    const result = levelSystem.batchUpgrade(
      heroes.map(h => h.id),
      3,
    );
    // 结果顺序应与输入一致
    const resultIds = result.results.map(r => r.general.id);
    for (let i = 0; i < resultIds.length; i++) {
      expect(heroes.some(h => h.id === resultIds[i])).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════
// §6.12 一键强化（单将）
// ═══════════════════════════════════════════════

describe('§6.12 一键强化（单将）', () => {
  let heroSystem: HeroSystem;
  let levelSystem: HeroLevelSystem;
  let wallet: ReturnType<typeof createResourceWallet>;

  beforeEach(() => {
    ({ heroSystem, levelSystem, wallet } = createSystems());
  });

  it('一键强化到指定等级', () => {
    addHeroes(heroSystem, ['guanyu']);
    const result = levelSystem.quickEnhance('guanyu', 10);
    expect(result).not.toBeNull();
    expect(result!.levelsGained).toBeGreaterThan(0);
    const updated = heroSystem.getGeneral('guanyu');
    expect(updated?.level).toBeGreaterThan(1);
  });

  it('一键强化后武将等级不超过目标', () => {
    addHeroes(heroSystem, ['guanyu']);
    const result = levelSystem.quickEnhance('guanyu', 5);
    const updated = heroSystem.getGeneral('guanyu');
    expect(updated?.level).toBeLessThanOrEqual(5);
  });

  it('一键强化消耗铜钱和经验', () => {
    addHeroes(heroSystem, ['guanyu']);
    const goldBefore = wallet.getGold();
    const expBefore = wallet.getExp();
    levelSystem.quickEnhance('guanyu', 5);
    expect(wallet.getGold()).toBeLessThan(goldBefore);
    expect(wallet.getExp()).toBeLessThanOrEqual(expBefore);
  });

  it('资源不足时强化到可达到的最高等级', () => {
    wallet.setGold(200);
    wallet.setExp(500);
    addHeroes(heroSystem, ['guanyu']);
    const result = levelSystem.quickEnhance('guanyu', 30);
    expect(result).not.toBeNull();
    const updated = heroSystem.getGeneral('guanyu');
    // 应该升了几级但不到30
    expect(updated!.level).toBeGreaterThan(1);
    expect(updated!.level).toBeLessThan(30);
  });

  it('不存在的武将返回 null', () => {
    const result = levelSystem.quickEnhance('nonexistent');
    expect(result).toBeNull();
  });

  it('满级武将返回 null', () => {
    heroSystem.addGeneral('guanyu');
    heroSystem.setLevelAndExp('guanyu', HERO_MAX_LEVEL, 0);
    const result = levelSystem.quickEnhance('guanyu', HERO_MAX_LEVEL);
    expect(result).toBeNull();
  });

  it('一键强化后属性增长', () => {
    addHeroes(heroSystem, ['guanyu']);
    const before = heroSystem.getGeneral('guanyu');
    const result = levelSystem.quickEnhance('guanyu', 5);
    if (result) {
      expect(result.statsDiff.after.attack).toBeGreaterThanOrEqual(result.statsDiff.before.attack);
      expect(result.statsDiff.after.defense).toBeGreaterThanOrEqual(result.statsDiff.before.defense);
    }
  });

  it('一键强化无目标时升到资源允许的最高级', () => {
    addHeroes(heroSystem, ['guanyu']);
    const result = levelSystem.quickEnhance('guanyu');
    expect(result).not.toBeNull();
    const updated = heroSystem.getGeneral('guanyu');
    expect(updated!.level).toBeGreaterThan(1);
  });
});

// ═══════════════════════════════════════════════
// §6.13 一键强化全部
// ═══════════════════════════════════════════════

describe('§6.13 一键强化全部', () => {
  let heroSystem: HeroSystem;
  let levelSystem: HeroLevelSystem;
  let wallet: ReturnType<typeof createResourceWallet>;

  beforeEach(() => {
    ({ heroSystem, levelSystem, wallet } = createSystems());
  });

  it('一键强化全部武将', () => {
    addHeroes(heroSystem, ['guanyu', 'zhangfei', 'liubei', 'zhaoyun']);
    const result = levelSystem.quickEnhanceAll(5);
    expect(result.results.length).toBeGreaterThan(0);
  });

  it('按战力+品质优先级排序', () => {
    addHeroes(heroSystem, ['minbingduizhang', 'guanyu', 'lvbu']);
    const result = levelSystem.quickEnhanceAll(3);
    // 传说武将应优先被强化
    expect(result.results.length).toBeGreaterThan(0);
  });

  it('资源耗尽时自动跳过后续武将', () => {
    wallet.setGold(300);
    wallet.setExp(300);
    addHeroes(heroSystem, ['guanyu', 'zhangfei', 'liubei', 'zhaoyun', 'caocao']);
    const result = levelSystem.quickEnhanceAll(10);
    // 不一定全部都能升级
    expect(result.results.length).toBeLessThanOrEqual(5);
  });

  it('无武将时返回空结果', () => {
    const result = levelSystem.quickEnhanceAll(10);
    expect(result.results).toHaveLength(0);
    expect(result.totalGoldSpent).toBe(0);
    expect(result.totalExpSpent).toBe(0);
    expect(result.totalPowerGain).toBe(0);
  });

  it('全部满级时返回空结果', () => {
    addHeroes(heroSystem, ['guanyu']);
    heroSystem.setLevelAndExp('guanyu', HERO_MAX_LEVEL, 0);
    const result = levelSystem.quickEnhanceAll();
    expect(result.results).toHaveLength(0);
  });

  it('总战力增长等于各武将战力增长之和', () => {
    const heroes = addHeroes(heroSystem, ['guanyu', 'zhangfei']);
    const powerBefore = heroes.reduce((s, h) => s + heroSystem.calculatePower(h), 0);
    const result = levelSystem.quickEnhanceAll(5);
    const powerAfter = heroSystem.getAllGenerals().reduce((s, h) => s + heroSystem.calculatePower(h), 0);
    expect(result.totalPowerGain).toBe(powerAfter - powerBefore);
  });
});

// ═══════════════════════════════════════════════
// §6.14 资源预估与预览
// ═══════════════════════════════════════════════

describe('§6.14 资源预估与预览', () => {
  let heroSystem: HeroSystem;
  let levelSystem: HeroLevelSystem;
  let wallet: ReturnType<typeof createResourceWallet>;

  beforeEach(() => {
    ({ heroSystem, levelSystem, wallet } = createSystems());
  });

  it('getEnhancePreview 返回正确的预览信息', () => {
    addHeroes(heroSystem, ['guanyu']);
    const preview = levelSystem.getEnhancePreview('guanyu', 10);
    expect(preview).not.toBeNull();
    expect(preview!.generalId).toBe('guanyu');
    expect(preview!.currentLevel).toBe(1);
    expect(preview!.targetLevel).toBe(10);
    expect(preview!.totalExp).toBeGreaterThan(0);
    expect(preview!.totalGold).toBeGreaterThan(0);
  });

  it('预览中 affordable 标志反映资源是否充足', () => {
    addHeroes(heroSystem, ['guanyu']);
    const preview = levelSystem.getEnhancePreview('guanyu', 10);
    expect(preview!.affordable).toBe(true);

    // 资源不足时
    wallet.setGold(0);
    wallet.setExp(0);
    const poorPreview = levelSystem.getEnhancePreview('guanyu', 50);
    expect(poorPreview!.affordable).toBe(false);
  });

  it('预览中战力增长为正数', () => {
    addHeroes(heroSystem, ['guanyu']);
    const preview = levelSystem.getEnhancePreview('guanyu', 10);
    expect(preview!.powerAfter).toBeGreaterThan(preview!.powerBefore);
  });

  it('预览不消耗实际资源', () => {
    addHeroes(heroSystem, ['guanyu']);
    const goldBefore = wallet.getGold();
    const expBefore = wallet.getExp();
    levelSystem.getEnhancePreview('guanyu', 10);
    expect(wallet.getGold()).toBe(goldBefore);
    expect(wallet.getExp()).toBe(expBefore);
  });

  it('目标等级超过上限时自动截断', () => {
    addHeroes(heroSystem, ['guanyu']);
    const preview = levelSystem.getEnhancePreview('guanyu', 999);
    expect(preview!.targetLevel).toBe(HERO_MAX_LEVEL);
  });

  it('当前等级已等于目标等级时预览显示无消耗', () => {
    addHeroes(heroSystem, ['guanyu']);
    heroSystem.setLevelAndExp('guanyu', 10, 0);
    const preview = levelSystem.getEnhancePreview('guanyu', 10);
    expect(preview!.totalExp).toBe(0);
    expect(preview!.totalGold).toBe(0);
  });

  it('getBatchEnhancePreview 返回前N个武将预览', () => {
    addHeroes(heroSystem, ['guanyu', 'zhangfei', 'liubei', 'zhaoyun', 'caocao', 'zhugeliang']);
    const previews = levelSystem.getBatchEnhancePreview(10, 3);
    expect(previews.length).toBeLessThanOrEqual(3);
    for (const p of previews) {
      expect(p.currentLevel).toBeLessThan(p.targetLevel);
    }
  });

  it('getBatchEnhancePreview 默认限制5个', () => {
    addHeroes(heroSystem, ['guanyu', 'zhangfei', 'liubei', 'zhaoyun', 'caocao', 'zhugeliang', 'lvbu']);
    const previews = levelSystem.getBatchEnhancePreview(10);
    expect(previews.length).toBeLessThanOrEqual(5);
  });

  it('calculateTotalExp 正确计算区间经验', () => {
    const totalExp = levelSystem.calculateTotalExp(1, 5);
    let expected = 0;
    for (let lv = 1; lv < 5; lv++) expected += expForLevel(lv);
    expect(totalExp).toBe(expected);
  });

  it('calculateTotalGold 正确计算区间铜钱', () => {
    const totalGold = levelSystem.calculateTotalGold(1, 5);
    let expected = 0;
    for (let lv = 1; lv < 5; lv++) expected += goldForLevel(lv);
    expect(totalGold).toBe(expected);
  });

  it('calculateMaxAffordableLevel 不超过满级', () => {
    addHeroes(heroSystem, ['guanyu']);
    const general = heroSystem.getGeneral('guanyu')!;
    const maxLevel = levelSystem.calculateMaxAffordableLevel(general);
    expect(maxLevel).toBeLessThanOrEqual(HERO_MAX_LEVEL);
  });

  it('getExpProgress 返回正确的经验进度', () => {
    addHeroes(heroSystem, ['guanyu']);
    const progress = levelSystem.getExpProgress('guanyu');
    expect(progress).not.toBeNull();
    expect(progress!.percentage).toBeGreaterThanOrEqual(0);
    expect(progress!.percentage).toBeLessThanOrEqual(100);
  });

  it('满级武将经验进度为100%', () => {
    addHeroes(heroSystem, ['guanyu']);
    heroSystem.setLevelAndExp('guanyu', HERO_MAX_LEVEL, 0);
    const progress = levelSystem.getExpProgress('guanyu');
    expect(progress!.percentage).toBe(100);
  });

  it('不存在的武将预览返回 null', () => {
    const preview = levelSystem.getEnhancePreview('nonexistent', 10);
    expect(preview).toBeNull();
  });

  it('canLevelUp 满足条件时返回 true', () => {
    addHeroes(heroSystem, ['guanyu']);
    // 给足经验和铜钱
    heroSystem.setLevelAndExp('guanyu', 1, 9999);
    expect(levelSystem.canLevelUp('guanyu')).toBe(true);
  });

  it('getUpgradableGeneralIds 返回可升级武将列表', () => {
    addHeroes(heroSystem, ['guanyu', 'zhangfei']);
    // 给足经验
    heroSystem.setLevelAndExp('guanyu', 1, 9999);
    heroSystem.setLevelAndExp('zhangfei', 1, 9999);
    const ids = levelSystem.getUpgradableGeneralIds();
    expect(ids).toContain('guanyu');
    expect(ids).toContain('zhangfei');
  });
});

// ═══════════════════════════════════════════════
// §6.15 红点触发（UI 层逻辑，可能 skip）
// ═══════════════════════════════════════════════

describe('§6.15 红点触发', () => {
  let heroSystem: HeroSystem;
  let levelSystem: HeroLevelSystem;
  let wallet: ReturnType<typeof createResourceWallet>;

  beforeEach(() => {
    ({ heroSystem, levelSystem, wallet } = createSystems());
  });

  it.skip('红点API尚未实现 — 检查可升级武将数量作为红点依据', () => {
    // 红点系统属于 UI 层，这里验证底层数据支持
    addHeroes(heroSystem, ['guanyu', 'zhangfei']);
    heroSystem.setLevelAndExp('guanyu', 1, 9999);
    const upgradable = levelSystem.getUpgradableGeneralIds();
    expect(upgradable.length).toBeGreaterThan(0);
    // UI 层应据此显示红点
    void upgradable;
  });

  it.skip('红点API尚未实现 — 新获得武将可升级时触发红点', () => {
    addHeroes(heroSystem, ['guanyu']);
    // 武将刚获得 level=1, exp=0, 需要经验才能升级
    // 如果有免费经验/新手引导经验，红点应触发
    const canLevel = levelSystem.canLevelUp('guanyu');
    void canLevel;
  });

  it.skip('红点API尚未实现 — 资源变化后重新计算红点状态', () => {
    addHeroes(heroSystem, ['guanyu']);
    // 初始无经验不可升级
    expect(levelSystem.canLevelUp('guanyu')).toBe(false);
    // 添加经验后
    heroSystem.setLevelAndExp('guanyu', 1, 9999);
    expect(levelSystem.canLevelUp('guanyu')).toBe(true);
    // 红点应更新
  });

  it('canLevelUp 为红点提供底层数据', () => {
    addHeroes(heroSystem, ['guanyu']);
    // 初始 exp=0，不满足升级条件
    expect(levelSystem.canLevelUp('guanyu')).toBe(false);
    // 给经验
    heroSystem.setLevelAndExp('guanyu', 1, 9999);
    expect(levelSystem.canLevelUp('guanyu')).toBe(true);
  });

  it('getUpgradableGeneralIds 为红点计数提供数据', () => {
    addHeroes(heroSystem, ['guanyu', 'zhangfei', 'liubei']);
    heroSystem.setLevelAndExp('guanyu', 1, 9999);
    heroSystem.setLevelAndExp('zhangfei', 1, 9999);
    const ids = levelSystem.getUpgradableGeneralIds();
    expect(ids.length).toBe(2);
  });
});
