import { describe, it, expect } from 'vitest';
import {
  SiegeResultCalculator,
  OUTCOME_CASUALTY_RATES,
  OUTCOME_INJURY_RATES,
  OUTCOME_REWARD_MULTIPLIER,
  type BattleOutcome,
} from '../SiegeResultCalculator';
import type { BattleCompletedEvent } from '../SiegeBattleSystem';

// ─── Helpers ───

function makeEvent(overrides: Partial<BattleCompletedEvent> = {}): BattleCompletedEvent {
  return {
    taskId: 'task-1',
    targetId: 'territory-1',
    victory: true,
    strategy: 'direct' as const,
    troops: 1000,
    elapsedMs: 5000,
    remainingDefense: 0,
    ...overrides,
  };
}

/** Seeded PRNG (mulberry32) for deterministic tests */
function seededRng(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('SiegeResultCalculator', () => {
  const calc = new SiegeResultCalculator();

  // ─── 1. Decisive Victory ───

  it('should classify as decisiveVictory when victory, remainingDefense=0, elapsedMs < 10000', () => {
    const event = makeEvent({ victory: true, remainingDefense: 0, elapsedMs: 5000 });
    const result = calc.calculateSettlement(event, { targetLevel: 1, isFirstCapture: false, rng: seededRng(42) });
    expect(result.outcome).toBe('decisiveVictory');
    expect(result.victory).toBe(true);
  });

  // ─── 2. Victory (normal) ───

  it('should classify as victory when victory, remainingDefense=0, elapsedMs 10000-40000', () => {
    const event = makeEvent({ victory: true, remainingDefense: 0, elapsedMs: 25000 });
    const result = calc.calculateSettlement(event, { targetLevel: 1, isFirstCapture: false, rng: seededRng(42) });
    expect(result.outcome).toBe('victory');
    expect(result.victory).toBe(true);
  });

  // ─── 3. Narrow Victory ───

  it('should classify as narrowVictory when victory and elapsedMs > 40000', () => {
    const event = makeEvent({ victory: true, remainingDefense: 0, elapsedMs: 55000 });
    const result = calc.calculateSettlement(event, { targetLevel: 1, isFirstCapture: false, rng: seededRng(42) });
    expect(result.outcome).toBe('narrowVictory');
    expect(result.victory).toBe(true);
  });

  // ─── 4. Defeat ───

  it('should classify as defeat when not victory and remainingDefense <= 50', () => {
    const event = makeEvent({ victory: false, remainingDefense: 30, elapsedMs: 5000 });
    const result = calc.calculateSettlement(event, { targetLevel: 1, isFirstCapture: false, rng: seededRng(42) });
    expect(result.outcome).toBe('defeat');
    expect(result.victory).toBe(false);
  });

  // ─── 5. Rout ───

  it('should classify as rout when not victory and remainingDefense > 50', () => {
    const event = makeEvent({ victory: false, remainingDefense: 75, elapsedMs: 5000 });
    const result = calc.calculateSettlement(event, { targetLevel: 1, isFirstCapture: false, rng: seededRng(42) });
    expect(result.outcome).toBe('rout');
    expect(result.victory).toBe(false);
  });

  // ─── 6. Troop loss within configured range ───

  it('should calculate troop loss within the configured range for each outcome', () => {
    const outcomes: BattleOutcome[] = ['decisiveVictory', 'victory', 'narrowVictory', 'defeat', 'rout'];
    const rng = seededRng(123);
    const troops = 1000;

    for (const outcome of outcomes) {
      const { troopsLost, troopsLostPercent } = calc.calculateTroopLoss(outcome, troops, rng);
      const rate = OUTCOME_CASUALTY_RATES[outcome];
      expect(troopsLostPercent).toBeGreaterThanOrEqual(rate.min);
      expect(troopsLostPercent).toBeLessThanOrEqual(rate.max);
      expect(troopsLost).toBe(Math.floor(troops * troopsLostPercent));
    }
  });

  // ─── 7. Hero injury probability (Monte Carlo) ───

  it('should produce hero injury at roughly 5% for decisiveVictory (Monte Carlo, 1000 iterations)', () => {
    const iterations = 1000;
    let injuryCount = 0;
    const rng = seededRng(999);

    for (let i = 0; i < iterations; i++) {
      const { heroInjured } = calc.rollHeroInjury('decisiveVictory', rng);
      if (heroInjured) injuryCount++;
    }

    const observedRate = injuryCount / iterations;
    // Expected: ~5%, allow generous band [1%, 12%] for randomness
    expect(observedRate).toBeGreaterThan(0.01);
    expect(observedRate).toBeLessThan(0.12);
  });

  // ─── 8. Reward multiplier with first capture bonus ───

  it('should apply 1.5x bonus on first capture for decisiveVictory', () => {
    const event = makeEvent({ victory: true, remainingDefense: 0, elapsedMs: 5000 });

    const normalResult = calc.calculateSettlement(event, {
      targetLevel: 1,
      isFirstCapture: false,
      rng: seededRng(42),
    });
    const firstCaptureResult = calc.calculateSettlement(event, {
      targetLevel: 1,
      isFirstCapture: true,
      rng: seededRng(42),
    });

    expect(normalResult.rewardMultiplier).toBe(OUTCOME_REWARD_MULTIPLIER['decisiveVictory']); // 1.5
    expect(firstCaptureResult.rewardMultiplier).toBe(OUTCOME_REWARD_MULTIPLIER['decisiveVictory'] * 1.5); // 2.25
    expect(firstCaptureResult.rewardMultiplier).toBeGreaterThan(normalResult.rewardMultiplier);
  });

  // ─── 9. No reward for defeat/rout ───

  it('should give zero reward multiplier for defeat and rout', () => {
    expect(OUTCOME_REWARD_MULTIPLIER['defeat']).toBe(0);
    expect(OUTCOME_REWARD_MULTIPLIER['rout']).toBe(0);
  });

  // ─── 10. Injury level selection from allowed pool ───

  it('should only select injury levels from the allowed pool for each outcome', () => {
    const rng = seededRng(77);
    // Force injury by using outcome with high probability (rout: 80%)
    // Run many iterations and check all injury levels are valid
    const outcomes: BattleOutcome[] = ['decisiveVictory', 'victory', 'narrowVictory', 'defeat', 'rout'];
    for (const outcome of outcomes) {
      const config = OUTCOME_INJURY_RATES[outcome];
      // Collect injuries across many rolls
      for (let i = 0; i < 200; i++) {
        const { heroInjured, injuryLevel } = calc.rollHeroInjury(outcome, rng);
        if (heroInjured) {
          expect(config.levels).toContain(injuryLevel);
        }
      }
    }
  });

  // ─── 11. determineOutcome pure function tests ───

  it('should return victory when remainingDefense > 0 and elapsedMs in [10000, 40000]', () => {
    const event = makeEvent({ victory: true, remainingDefense: 10, elapsedMs: 20000 });
    expect(calc.determineOutcome(event)).toBe('victory');
  });

  // ─── 12. Full settlement result structure ───

  it('should return a complete SiegeSettlementResult with all fields populated', () => {
    const event = makeEvent({ victory: true, remainingDefense: 0, elapsedMs: 3000 });
    const result = calc.calculateSettlement(event, {
      targetLevel: 3,
      isFirstCapture: false,
      rng: seededRng(42),
    });

    expect(result).toHaveProperty('outcome');
    expect(result).toHaveProperty('victory');
    expect(result).toHaveProperty('troopsLost');
    expect(result).toHaveProperty('troopsLostPercent');
    expect(result).toHaveProperty('heroInjured');
    expect(result).toHaveProperty('injuryLevel');
    expect(result).toHaveProperty('rewardMultiplier');

    expect(typeof result.outcome).toBe('string');
    expect(typeof result.victory).toBe('boolean');
    expect(typeof result.troopsLost).toBe('number');
    expect(typeof result.troopsLostPercent).toBe('number');
    expect(typeof result.heroInjured).toBe('boolean');
    expect(typeof result.injuryLevel).toBe('string');
    expect(typeof result.rewardMultiplier).toBe('number');
  });
});
