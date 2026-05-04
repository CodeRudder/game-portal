/**
 * 酒馆→招募系统桥接注入测试
 *
 * 验证 tavern-bridge 的概率加成能正确注入到 HeroRecruitSystem 的抽卡流程中。
 *
 * @module engine/hero/__tests__/tavern-bonus-injection
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HeroRecruitSystem } from '../HeroRecruitSystem';
import { HeroSystem } from '../HeroSystem';
import type { RecruitDeps } from '../recruit-types';
import { Quality as Q } from '../hero.types';
import { getRecruitBonus } from '../../building/tavern-bridge';

// ─── 辅助工具 ─────────────────────────────────────────────

/** 创建 mock RecruitDeps（无限资源） */
function makeRichDeps(heroSystem: HeroSystem): RecruitDeps {
  return {
    heroSystem,
    spendResource: vi.fn().mockReturnValue(true),
    canAffordResource: vi.fn().mockReturnValue(true),
  };
}

/** 统计单抽品质分布 */
function samplePulls(
  system: HeroRecruitSystem,
  type: 'normal' | 'advanced',
  count: number,
): Record<string, number> {
  const dist: Record<string, number> = {};
  for (let i = 0; i < count; i++) {
    const result = system.recruitSingle(type);
    const q = result?.results[0]?.quality ?? 'UNKNOWN';
    dist[q] = (dist[q] ?? 0) + 1;
  }
  return dist;
}

// ─── 测试用例 ─────────────────────────────────────────────

describe('Tavern bonus injection into HeroRecruitSystem', () => {
  let system: HeroRecruitSystem;
  let heroSystem: HeroSystem;

  beforeEach(() => {
    heroSystem = new HeroSystem();
    system = new HeroRecruitSystem();
    system.setRecruitDeps(makeRichDeps(heroSystem));
  });

  it('未设置 bonus 时使用基础概率', () => {
    // 无 bonus — 高级招募 EPIC 基础概率 13%
    const dist = samplePulls(system, 'advanced', 5000);
    const epicRate = (dist[Q.EPIC] ?? 0) / 5000;
    // EPIC 基础 13%，允许 ±5% 波动
    expect(epicRate).toBeGreaterThan(0.08);
    expect(epicRate).toBeLessThan(0.20);
  });

  it('tavern bonus = 0 时概率不变', () => {
    system.setTavernBonus(() => 0);
    const dist = samplePulls(system, 'advanced', 5000);
    const epicRate = (dist[Q.EPIC] ?? 0) / 5000;
    // EPIC 基础 13%，bonus=0 不应改变
    expect(epicRate).toBeGreaterThan(0.08);
    expect(epicRate).toBeLessThan(0.20);
  });

  it('设置 tavern bonus=0.05 后，COMMON 概率应提升', () => {
    // bonus=0.05 加到 rates[0]（COMMON）上
    // advanced COMMON: 0.20 → 0.25
    system.setTavernBonus(() => 0.05);
    const dist = samplePulls(system, 'advanced', 5000);
    const commonRate = (dist[Q.COMMON] ?? 0) / 5000;
    // 0.25 ± 5% 容差
    expect(commonRate).toBeGreaterThan(0.18);
    expect(commonRate).toBeLessThan(0.35);
  });

  it('设置 tavern bonus=0.10 后，COMMON 概率显著提升', () => {
    // advanced COMMON: 0.20 → 0.30
    system.setTavernBonus(() => 0.10);
    const dist = samplePulls(system, 'advanced', 5000);
    const commonRate = (dist[Q.COMMON] ?? 0) / 5000;
    expect(commonRate).toBeGreaterThan(0.23);
    expect(commonRate).toBeLessThan(0.40);
  });

  it('可通过 tavern-bridge.getRecruitBonus 注入', () => {
    // 模拟酒馆 Lv5 → bonus = 5 × 0.02 = 0.10
    const tavernLevel = 5;
    system.setTavernBonus(() => getRecruitBonus(tavernLevel));
    const dist = samplePulls(system, 'advanced', 5000);
    const commonRate = (dist[Q.COMMON] ?? 0) / 5000;
    // 0.20 + 0.10 = 0.30
    expect(commonRate).toBeGreaterThan(0.23);
    expect(commonRate).toBeLessThan(0.40);
  });

  it('setTavernBonus(null) 可移除 bonus', () => {
    // 先设置 bonus，再移除
    system.setTavernBonus(() => 0.10);
    system.setTavernBonus(null);
    const dist = samplePulls(system, 'advanced', 5000);
    const commonRate = (dist[Q.COMMON] ?? 0) / 5000;
    // 回到基础 0.20
    expect(commonRate).toBeGreaterThan(0.13);
    expect(commonRate).toBeLessThan(0.28);
  });

  it('普通招募同样受 bonus 影响', () => {
    // normal COMMON: 0.60 → 0.65 (bonus=0.05)
    system.setTavernBonus(() => 0.05);
    const dist = samplePulls(system, 'normal', 5000);
    const commonRate = (dist[Q.COMMON] ?? 0) / 5000;
    expect(commonRate).toBeGreaterThan(0.58);
    expect(commonRate).toBeLessThan(0.75);
  });
});
