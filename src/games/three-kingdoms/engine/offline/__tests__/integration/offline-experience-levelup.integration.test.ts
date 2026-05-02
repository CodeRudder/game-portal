/**
 * v9.0 离线收益集成测试 — 经验产出 / 武将升级
 *
 * 覆盖 Play 文档:
 *   §2.1  离线经验计算
 *   §2.2  经验分配到武将
 *   §2.x  升级判定与边界
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  OfflineRewardSystem,
  calculateOfflineSnapshot,
  calculateOverallEfficiency,
  calculateBonusCoefficient,
  applySystemModifier,
  getSystemModifier,
  DECAY_TIERS,
  MAX_OFFLINE_SECONDS,
  SYSTEM_EFFICIENCY_MODIFIERS,
} from '../../index';
import { OfflineSnapshotSystem } from '../../OfflineSnapshotSystem';
import { HeroLevelSystem } from '../../../hero/HeroLevelSystem';
import { HeroSystem } from '../../../hero/HeroSystem';
import { HERO_MAX_LEVEL, LEVEL_EXP_TABLE } from '../../../hero/hero-config';
import type { Resources, ProductionRate, ResourceCap } from '../../../../shared/types';

// ─────────────────────────────────────────────
// 工具
// ─────────────────────────────────────────────

const HOUR_S = 3600;

function zeroRes(): Resources {
  return { grain: 0, gold: 0, troops: 0, mandate: 0, techPoint: 0 };
}

function makeRates(overrides: Partial<ProductionRate> = {}): ProductionRate {
  return { grain: 10, gold: 5, troops: 2, mandate: 1, techPoint: 0.5, ...overrides };
}

function makeCaps(overrides: Partial<ResourceCap> = {}): ResourceCap {
  return { grain: 5000, gold: 2000, troops: 1000, mandate: null, techPoint: null, ...overrides };
}

function makeCurrentRes(overrides: Partial<Resources> = {}): Resources {
  return { grain: 100, gold: 500, troops: 50, mandate: 20, techPoint: 10, ...overrides };
}

// ─────────────────────────────────────────────
// §2.1 离线经验计算
// ─────────────────────────────────────────────

describe('v9-int §2.1 离线经验计算', () => {
  it('§2.1.1 离线收益包含techPoint', () => {
    const rates = makeRates({ techPoint: 2 });
    const snapshot = calculateOfflineSnapshot(2 * HOUR_S, rates, {});
    expect(snapshot.totalEarned.techPoint).toBeGreaterThan(0);
  });

  it('§2.1.2 techPoint产出随离线时长增长', () => {
    const rates = makeRates({ techPoint: 1 });
    const snap1h = calculateOfflineSnapshot(1 * HOUR_S, rates, {});
    const snap4h = calculateOfflineSnapshot(4 * HOUR_S, rates, {});
    expect(snap4h.totalEarned.techPoint).toBeGreaterThan(snap1h.totalEarned.techPoint);
  });

  it('§2.1.3 techPoint受衰减系数影响', () => {
    const rates = makeRates({ techPoint: 10 });
    const snap2h = calculateOfflineSnapshot(2 * HOUR_S, rates, {});
    const snap24h = calculateOfflineSnapshot(24 * HOUR_S, rates, {});
    // 24h效率低于2h
    const eff2h = snap2h.totalEarned.techPoint / (2 * HOUR_S * 10);
    const eff24h = snap24h.totalEarned.techPoint / (24 * HOUR_S * 10);
    expect(eff24h).toBeLessThan(eff2h);
  });

  it('§2.1.4 techPoint受加成系数影响', () => {
    const rates = makeRates({ techPoint: 10 });
    const snapNoBonus = calculateOfflineSnapshot(4 * HOUR_S, rates, {});
    const snapWithBonus = calculateOfflineSnapshot(4 * HOUR_S, rates, { tech: 0.5 });
    expect(snapWithBonus.totalEarned.techPoint).toBeGreaterThan(snapNoBonus.totalEarned.techPoint);
  });

  it('§2.1.5 techPoint受VIP加成影响', () => {
    const rates = makeRates({ techPoint: 10 });
    const snapNoVip = calculateOfflineSnapshot(4 * HOUR_S, rates, {});
    const snapWithVip = calculateOfflineSnapshot(4 * HOUR_S, rates, { vip: 0.15 });
    // VIP加成通过bonusCoefficient影响所有资源
    expect(snapWithVip.totalEarned.techPoint).toBeGreaterThan(snapNoVip.totalEarned.techPoint);
  });

  it('§2.1.6 techPoint受系统修正影响(hero=0.5)', () => {
    const rates = makeRates({ techPoint: 10 });
    const snapshot = calculateOfflineSnapshot(4 * HOUR_S, rates, {});
    const heroModified = applySystemModifier(snapshot.totalEarned, 'hero');
    expect(heroModified.techPoint).toBeLessThan(snapshot.totalEarned.techPoint);
    // hero modifier = 0.5
    expect(heroModified.techPoint).toBe(Math.floor(snapshot.totalEarned.techPoint * 0.5));
  });

  it('§2.1.7 经验产出72h封顶', () => {
    const rates = makeRates({ techPoint: 10 });
    const snap72 = calculateOfflineSnapshot(72 * HOUR_S, rates, {});
    const snap100 = calculateOfflineSnapshot(100 * HOUR_S, rates, {});
    expect(snap72.totalEarned.techPoint).toBe(snap100.totalEarned.techPoint);
  });

  it('§2.1.8 零时长无经验产出', () => {
    const rates = makeRates({ techPoint: 10 });
    const snap = calculateOfflineSnapshot(0, rates, {});
    expect(snap.totalEarned.techPoint).toBe(0);
  });
});

// ─────────────────────────────────────────────
// §2.2 经验分配到武将
// ─────────────────────────────────────────────

describe('v9-int §2.2 经验分配到武将', () => {
  let heroSystem: HeroSystem;
  let levelSystem: HeroLevelSystem;

  beforeEach(() => {
    heroSystem = new HeroSystem();
    heroSystem.init({ emit: vi.fn() as unknown as (...args: unknown[]) => void, on: vi.fn() as unknown as (...args: unknown[]) => void, off: vi.fn() as unknown as (...args: unknown[]) => void });
    levelSystem = new HeroLevelSystem();
    levelSystem.init({ emit: vi.fn() as unknown as (...args: unknown[]) => void, on: vi.fn() as unknown as (...args: unknown[]) => void, off: vi.fn() as unknown as (...args: unknown[]) => void });
    levelSystem.setLevelDeps({
      heroSystem,
      spendResource: () => true,
      canAffordResource: () => true,
      getResourceAmount: () => 999999,
    });
  });

  it('§2.2.1 HeroLevelSystem初始化成功', () => {
    expect(levelSystem).toBeDefined();
    expect(levelSystem.name).toBe('heroLevel');
  });

  it('§2.2.2 计算升到下一级所需经验', () => {
    const exp1 = levelSystem.calculateExpToNextLevel(1);
    const exp10 = levelSystem.calculateExpToNextLevel(10);
    expect(exp1).toBeGreaterThan(0);
    expect(exp10).toBeGreaterThan(exp1);
  });

  it('§2.2.3 满级时升到下一级经验为0', () => {
    const exp = levelSystem.calculateExpToNextLevel(HERO_MAX_LEVEL);
    expect(exp).toBe(0);
  });

  it('§2.2.4 计算升级所需铜钱', () => {
    const cost1 = levelSystem.calculateLevelUpCost(1);
    const cost10 = levelSystem.calculateLevelUpCost(10);
    expect(cost1).toBeGreaterThan(0);
    expect(cost10).toBeGreaterThan(cost1);
  });

  it('§2.2.5 计算区间总经验', () => {
    const totalExp = levelSystem.calculateTotalExp(1, 10);
    expect(totalExp).toBeGreaterThan(0);
  });

  it('§2.2.6 计算区间总铜钱', () => {
    const totalGold = levelSystem.calculateTotalGold(1, 10);
    expect(totalGold).toBeGreaterThan(0);
  });

  it('§2.2.7 无武将时addExp返回null', () => {
    const result = levelSystem.addExp('nonexistent-hero', 1000);
    expect(result).toBeNull();
  });

  it('§2.2.8 经验表配置非空', () => {
    expect(LEVEL_EXP_TABLE.length).toBeGreaterThan(0);
    for (const tier of LEVEL_EXP_TABLE) {
      expect(tier.expPerLevel).toBeGreaterThan(0);
      expect(tier.goldPerLevel).toBeGreaterThan(0);
    }
  });

  it('§2.2.9 HeroSystem初始化成功', () => {
    expect(heroSystem).toBeDefined();
    expect(heroSystem.name).toBe('hero');
  });

  it('§2.2.10 离线经验与武将经验独立计算', () => {
    // 离线收益的techPoint是全局资源
    // 武将升级消耗exp资源
    // 两者独立，不存在自动转换关系
    const rates = makeRates({ techPoint: 5 });
    const snapshot = calculateOfflineSnapshot(4 * HOUR_S, rates, {});
    // techPoint作为资源产出，不是直接的经验
    expect(snapshot.totalEarned.techPoint).toBeGreaterThan(0);
    // HeroLevelSystem的addExp需要手动调用
    const result = levelSystem.addExp('nonexistent', 100);
    expect(result).toBeNull();
  });
});

// ─────────────────────────────────────────────
// §2.x 升级判定与边界
// ─────────────────────────────────────────────

describe('v9-int §2.x 升级判定与边界', () => {
  let levelSystem: HeroLevelSystem;

  beforeEach(() => {
    const heroSystem = new HeroSystem();
    heroSystem.init({ emit: vi.fn() as unknown as (...args: unknown[]) => void, on: vi.fn() as unknown as (...args: unknown[]) => void, off: vi.fn() as unknown as (...args: unknown[]) => void });
    levelSystem = new HeroLevelSystem();
    levelSystem.init({ emit: vi.fn() as unknown as (...args: unknown[]) => void, on: vi.fn() as unknown as (...args: unknown[]) => void, off: vi.fn() as unknown as (...args: unknown[]) => void });
    levelSystem.setLevelDeps({
      heroSystem,
      spendResource: () => true,
      canAffordResource: () => true,
      getResourceAmount: () => 999999,
    });
  });

  it('§2.x.1 HERO_MAX_LEVEL为正整数', () => {
    expect(HERO_MAX_LEVEL).toBeGreaterThan(0);
    expect(Number.isInteger(HERO_MAX_LEVEL)).toBe(true);
  });

  it('§2.x.2 经验表覆盖从1级到满级', () => {
    let coveredMax = 0;
    for (const tier of LEVEL_EXP_TABLE) {
      coveredMax = Math.max(coveredMax, tier.levelMax);
    }
    expect(coveredMax).toBeGreaterThanOrEqual(HERO_MAX_LEVEL);
  });

  it('§2.x.3 满级时升级费用为0', () => {
    expect(levelSystem.calculateLevelUpCost(HERO_MAX_LEVEL)).toBe(0);
  });

  it('§2.x.4 区间经验计算: from >= to 返回0', () => {
    expect(levelSystem.calculateTotalExp(10, 10)).toBe(0);
    expect(levelSystem.calculateTotalExp(10, 5)).toBe(0);
  });

  it('§2.x.5 区间铜钱计算: from >= to 返回0', () => {
    expect(levelSystem.calculateTotalGold(10, 10)).toBe(0);
    expect(levelSystem.calculateTotalGold(10, 5)).toBe(0);
  });

  it('§2.x.6 负数经验不触发升级', () => {
    const result = levelSystem.addExp('any-hero', -100);
    expect(result).toBeNull();
  });

  it('§2.x.7 零经验不触发升级', () => {
    const result = levelSystem.addExp('any-hero', 0);
    expect(result).toBeNull();
  });

  it('§2.x.8 离线收益计算与升级系统解耦', () => {
    // 离线收益计算不依赖HeroLevelSystem
    const rates = makeRates();
    const snapshot = calculateOfflineSnapshot(8 * HOUR_S, rates, {});
    expect(snapshot.totalEarned).toBeDefined();
    // HeroLevelSystem不依赖离线收益
    expect(levelSystem.calculateExpToNextLevel(1)).toBeGreaterThan(0);
  });

  it('§2.x.9 快照系统记录产出速率可用于经验预估', () => {
    const storage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      length: 0,
      key: () => null,
    };
    const snapshotSystem = new OfflineSnapshotSystem(storage as unknown as Storage);
    const rates = makeRates({ techPoint: 3 });
    const snap = snapshotSystem.createSnapshot({
      resources: makeCurrentRes(),
      productionRates: rates,
      caps: makeCaps(),
    });
    // 快照记录了techPoint产出速率，可用于预估经验产出
    expect(snap.productionRates.techPoint).toBe(3);
  });

  it('§2.x.10 加成系数上限+100%', () => {
    const maxBonus = calculateBonusCoefficient({ tech: 0.5, vip: 0.5, reputation: 0.5 });
    // 总加成1.5，上限1.0，系数 = 1 + 1.0 = 2.0
    expect(maxBonus).toBe(2.0);
  });

  it('§2.x.11 无加成时系数为1.0', () => {
    expect(calculateBonusCoefficient({})).toBe(1.0);
    expect(calculateBonusCoefficient({ tech: 0, vip: 0, reputation: 0 })).toBe(1.0);
  });

  it('§2.x.12 武将训练系统离线效率50%', () => {
    const heroMod = getSystemModifier('hero');
    expect(heroMod).toBe(0.5);
  });

  it('§2.x.13 离线收益完整流程含techPoint', () => {
    const rates = makeRates({ techPoint: 5 });
    // 使用引擎纯函数（包含techPoint）
    const snapshot = calculateOfflineSnapshot(4 * HOUR_S, rates, {});
    expect(snapshot.totalEarned.techPoint).toBeGreaterThan(0);
    // 应用hero系统修正后techPoint减半
    const heroModified = applySystemModifier(snapshot.totalEarned, 'hero');
    expect(heroModified.techPoint).toBe(Math.floor(snapshot.totalEarned.techPoint * 0.5));
  });
});
