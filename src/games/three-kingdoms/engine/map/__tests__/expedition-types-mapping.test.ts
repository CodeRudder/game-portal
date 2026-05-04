/**
 * R16 Task5: Shared InjuryLevel mapping and recovery config tests
 *
 * Verifies:
 * - mapInjuryLevel maps all engine levels to correct UI levels
 * - INJURY_RECOVERY_HOURS is consistent with INJURY_RECOVERY_TIME
 * - INJURY_RECOVERY_HOURS values match expected durations
 * - All InjuryLevel values are covered
 */

import { describe, it, expect } from 'vitest';
import {
  mapInjuryLevel,
  INJURY_RECOVERY_HOURS,
  INJURY_RECOVERY_TIME,
  type InjuryLevel,
  type UIInjuryLevel,
} from '../expedition-types';

// ─────────────────────────────────────────────
// mapInjuryLevel
// ─────────────────────────────────────────────

describe('R16: mapInjuryLevel (shared engine config)', () => {
  it('maps minor → light', () => {
    expect(mapInjuryLevel('minor')).toBe('light');
  });

  it('maps moderate → medium', () => {
    expect(mapInjuryLevel('moderate')).toBe('medium');
  });

  it('maps severe → severe', () => {
    expect(mapInjuryLevel('severe')).toBe('severe');
  });

  it('maps none → none', () => {
    expect(mapInjuryLevel('none')).toBe('none');
  });

  it('covers all InjuryLevel values', () => {
    const levels: InjuryLevel[] = ['none', 'minor', 'moderate', 'severe'];
    for (const level of levels) {
      const ui = mapInjuryLevel(level);
      expect(typeof ui).toBe('string');
      expect(['none', 'light', 'medium', 'severe']).toContain(ui);
    }
  });
});

// ─────────────────────────────────────────────
// INJURY_RECOVERY_HOURS
// ─────────────────────────────────────────────

describe('R16: INJURY_RECOVERY_HOURS (shared config)', () => {
  it('none = 0 hours', () => {
    expect(INJURY_RECOVERY_HOURS.none).toBe(0);
  });

  it('light = 0.5 hours (30 minutes)', () => {
    expect(INJURY_RECOVERY_HOURS.light).toBe(0.5);
  });

  it('medium = 2 hours', () => {
    expect(INJURY_RECOVERY_HOURS.medium).toBe(2);
  });

  it('severe = 6 hours', () => {
    expect(INJURY_RECOVERY_HOURS.severe).toBe(6);
  });

  it('hours are derived from INJURY_RECOVERY_TIME milliseconds', () => {
    const msPerHour = 60 * 60 * 1000;
    expect(INJURY_RECOVERY_HOURS.light).toBe(INJURY_RECOVERY_TIME.minor / msPerHour);
    expect(INJURY_RECOVERY_HOURS.medium).toBe(INJURY_RECOVERY_TIME.moderate / msPerHour);
    expect(INJURY_RECOVERY_HOURS.severe).toBe(INJURY_RECOVERY_TIME.severe / msPerHour);
  });

  it('covers all UIInjuryLevel values', () => {
    const uiLevels: UIInjuryLevel[] = ['none', 'light', 'medium', 'severe'];
    for (const level of uiLevels) {
      expect(typeof INJURY_RECOVERY_HOURS[level]).toBe('number');
      expect(INJURY_RECOVERY_HOURS[level]).toBeGreaterThanOrEqual(0);
    }
  });
});

// ─────────────────────────────────────────────
// Consistency: mapInjuryLevel + INJURY_RECOVERY_HOURS
// ─────────────────────────────────────────────

describe('R16: mapping + recovery consistency', () => {
  it('mapped recovery hours match expected pattern', () => {
    // minor → light → 0.5h (30min)
    expect(INJURY_RECOVERY_HOURS[mapInjuryLevel('minor')]).toBe(0.5);
    // moderate → medium → 2h
    expect(INJURY_RECOVERY_HOURS[mapInjuryLevel('moderate')]).toBe(2);
    // severe → severe → 6h
    expect(INJURY_RECOVERY_HOURS[mapInjuryLevel('severe')]).toBe(6);
    // none → none → 0h
    expect(INJURY_RECOVERY_HOURS[mapInjuryLevel('none')]).toBe(0);
  });

  it('recovery times are ordered: none < light < medium < severe', () => {
    expect(INJURY_RECOVERY_HOURS.none).toBeLessThan(INJURY_RECOVERY_HOURS.light);
    expect(INJURY_RECOVERY_HOURS.light).toBeLessThan(INJURY_RECOVERY_HOURS.medium);
    expect(INJURY_RECOVERY_HOURS.medium).toBeLessThan(INJURY_RECOVERY_HOURS.severe);
  });
});
