/**
 * OfflineRewardSystem v9.0 — 5档衰减快照测试
 *
 * 从 OfflineRewardSystem.test.ts 拆分而来
 * 覆盖：衰减快照计算、综合效率验证
 */

import { OfflineRewardSystem } from '../OfflineRewardSystem';

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────

const HOUR_S = 3600;

function makeRates(overrides = {} as Partial<{ grain: number; gold: number; troops: number; mandate: number }>) {
  return { grain: 1, gold: 2, troops: 0.5, mandate: 0, ...overrides };
}

// ─────────────────────────────────────────────
// 测试套件
// ─────────────────────────────────────────────

describe('OfflineRewardSystem v9.0 — 5档衰减快照', () => {
  let system: OfflineRewardSystem;

  beforeEach(() => {
    system = new OfflineRewardSystem();
  });

  // ═══════════════════════════════════════════
  // 1. 基本衰减快照
  // ═══════════════════════════════════════════

  it('0秒离线应返回空快照', () => {
    const snap = system.calculateSnapshot(0, makeRates());
    expect(snap.offlineSeconds).toBe(0);
    expect(snap.tierDetails).toHaveLength(0);
    expect(snap.totalEarned.grain).toBe(0);
    expect(snap.isCapped).toBe(false);
  });

  it('负数秒应返回空快照', () => {
    const snap = system.calculateSnapshot(-100, makeRates());
    expect(snap.offlineSeconds).toBe(0);
  });

  it('1小时应只使用tier1（100%效率）', () => {
    const rates = makeRates({ grain: 10 });
    const snap = system.calculateSnapshot(1 * HOUR_S, rates);

    expect(snap.tierDetails).toHaveLength(1);
    expect(snap.tierDetails[0].tierId).toBe('tier1');
    expect(snap.tierDetails[0].efficiency).toBe(1.0);
    expect(snap.tierDetails[0].seconds).toBe(3600);
    // grain = 10 * 3600 * 1.0 = 36000
    expect(snap.totalEarned.grain).toBeCloseTo(36000, 2);
  });

  it('3小时应跨tier1和tier2', () => {
    const rates = makeRates({ grain: 10 });
    const snap = system.calculateSnapshot(3 * HOUR_S, rates);

    expect(snap.tierDetails).toHaveLength(2);
    // tier1: 2h * 100% = 72000
    expect(snap.tierDetails[0].earned.grain).toBeCloseTo(72000, 2);
    // tier2: 1h * 80% = 28800
    expect(snap.tierDetails[1].earned.grain).toBeCloseTo(28800, 2);
  });

  it('10小时应跨tier1~tier3', () => {
    const rates = makeRates({ gold: 5 });
    const snap = system.calculateSnapshot(10 * HOUR_S, rates);

    expect(snap.tierDetails).toHaveLength(3);
    // tier1: 2h, tier2: 6h, tier3: 2h
    expect(snap.tierDetails[0].seconds).toBe(2 * HOUR_S);
    expect(snap.tierDetails[1].seconds).toBe(6 * HOUR_S);
    expect(snap.tierDetails[2].seconds).toBe(2 * HOUR_S);
  });

  it('72小时应使用全部5档', () => {
    const rates = makeRates({ grain: 1 });
    const snap = system.calculateSnapshot(72 * HOUR_S, rates);

    expect(snap.tierDetails).toHaveLength(5);
    expect(snap.isCapped).toBe(false);
  });

  it('超过72小时应封顶', () => {
    const rates = makeRates({ grain: 1 });
    const snap = system.calculateSnapshot(100 * HOUR_S, rates);

    expect(snap.isCapped).toBe(true);
    expect(snap.offlineSeconds).toBe(100 * HOUR_S);
    // 但计算只基于72小时
    expect(snap.tierDetails).toHaveLength(5);
  });

  it('综合效率应随时间递减', () => {
    const rates = makeRates({ grain: 1 });
    const snap2h = system.calculateSnapshot(2 * HOUR_S, rates);
    const snap24h = system.calculateSnapshot(24 * HOUR_S, rates);
    const snap72h = system.calculateSnapshot(72 * HOUR_S, rates);

    expect(snap2h.overallEfficiency).toBeGreaterThan(snap24h.overallEfficiency);
    expect(snap24h.overallEfficiency).toBeGreaterThan(snap72h.overallEfficiency);
  });

  it('2小时效率应为100%', () => {
    const rates = makeRates({ grain: 1 });
    const snap = system.calculateSnapshot(2 * HOUR_S, rates);
    expect(snap.overallEfficiency).toBe(1.0);
  });
});
