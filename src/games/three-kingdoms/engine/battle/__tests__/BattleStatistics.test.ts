/**
 * BattleStatistics 测试 — 战斗统计模块
 *
 * 覆盖：
 *   1. calculateBattleStats — 伤害统计、连击统计
 *   2. generateSummary — 摘要文本生成
 *   3. BattleStatisticsSubsystem — ISubsystem 包装
 *   4. 边界：空日志、零伤害、全暴击
 */

import { describe, it, expect } from 'vitest';
import {
  calculateBattleStats,
  generateSummary,
  BattleStatisticsSubsystem,
} from '../BattleStatistics';
import { BattleOutcome, StarRating, BattlePhase } from '../battle.types';
import type { BattleState, BattleAction } from '../battle.types';
import type { ISystemDeps } from '../../../../core/types';

// ── 辅助 ──

function makeMockDeps(): ISystemDeps {
  return {
    eventBus: { on: () => {}, off: () => {}, emit: () => {} } as any,
    config: { get: () => null, set: () => {}, has: () => false } as any,
    registry: { get: () => null, register: () => {}, has: () => false, getAll: () => [], unregister: () => {} } as any,
  };
}

function makeAction(
  actorSide: 'ally' | 'enemy',
  targets: Record<string, { damage: number; isCritical: boolean }>,
): BattleAction {
  return {
    turn: 1,
    actorId: `${actorSide}_actor`,
    actorName: 'Test Actor',
    actorSide,
    skill: null,
    targetIds: Object.keys(targets),
    damageResults: Object.fromEntries(
      Object.entries(targets).map(([id, r]) => [id, {
        damage: r.damage,
        baseDamage: r.damage,
        skillMultiplier: 1.0,
        isCritical: r.isCritical,
        criticalMultiplier: r.isCritical ? 1.5 : 1.0,
        restraintMultiplier: 1.0,
        randomFactor: 1.0,
        isMinDamage: false,
      }]),
    ),
    description: '',
    isNormalAttack: true,
  };
}

function makeState(actions: BattleAction[]): BattleState {
  return {
    id: 'test',
    phase: BattlePhase.FINISHED,
    currentTurn: 1,
    maxTurns: 10,
    allyTeam: { units: [], side: 'ally' },
    enemyTeam: { units: [], side: 'enemy' },
    turnOrder: [],
    currentActorIndex: 0,
    actionLog: actions,
    result: null,
  };
}

// ═══════════════════════════════════════════
// 测试
// ═══════════════════════════════════════════

describe('calculateBattleStats', () => {
  it('should sum ally and enemy damage correctly', () => {
    const state = makeState([
      makeAction('ally', { e1: { damage: 100, isCritical: false }, e2: { damage: 50, isCritical: false } }),
      makeAction('enemy', { a1: { damage: 80, isCritical: false } }),
    ]);
    const stats = calculateBattleStats(state);
    expect(stats.allyTotalDamage).toBe(150);
    expect(stats.enemyTotalDamage).toBe(80);
  });

  it('should track max single damage', () => {
    const state = makeState([
      makeAction('ally', { e1: { damage: 200, isCritical: false } }),
      makeAction('ally', { e1: { damage: 500, isCritical: true } }),
      makeAction('enemy', { a1: { damage: 300, isCritical: false } }),
    ]);
    const stats = calculateBattleStats(state);
    expect(stats.maxSingleDamage).toBe(500);
  });

  it('should track max combo (consecutive criticals)', () => {
    const state = makeState([
      makeAction('ally', {
        e1: { damage: 100, isCritical: true },
        e2: { damage: 100, isCritical: true },
        e3: { damage: 100, isCritical: true },
      }),
    ]);
    const stats = calculateBattleStats(state);
    expect(stats.maxCombo).toBe(3);
  });

  it('should reset combo on non-critical', () => {
    const state = makeState([
      makeAction('ally', {
        e1: { damage: 100, isCritical: true },
        e2: { damage: 100, isCritical: true },
        e3: { damage: 50, isCritical: false },
        e4: { damage: 100, isCritical: true },
      }),
    ]);
    const stats = calculateBattleStats(state);
    expect(stats.maxCombo).toBe(2);
  });

  it('should handle zero-damage hits', () => {
    const state = makeState([
      makeAction('ally', { e1: { damage: 0, isCritical: false } }),
    ]);
    const stats = calculateBattleStats(state);
    expect(stats.allyTotalDamage).toBe(0);
    expect(stats.maxSingleDamage).toBe(0);
  });

  it('should return all zeros for empty action log', () => {
    const state = makeState([]);
    const stats = calculateBattleStats(state);
    expect(stats).toEqual({
      allyTotalDamage: 0,
      enemyTotalDamage: 0,
      maxSingleDamage: 0,
      maxCombo: 0,
    });
  });

  it('should track combo across multiple actions', () => {
    const state = makeState([
      makeAction('ally', { e1: { damage: 100, isCritical: true } }),
      makeAction('enemy', { a1: { damage: 50, isCritical: true } }),
      makeAction('ally', { e1: { damage: 100, isCritical: true } }),
    ]);
    const stats = calculateBattleStats(state);
    // Combo continues across different actions (3 consecutive crits)
    expect(stats.maxCombo).toBe(3);
  });
});

describe('generateSummary', () => {
  it('should generate victory summary with 3 stars', () => {
    const summary = generateSummary(BattleOutcome.VICTORY, StarRating.THREE, 5, 4);
    expect(summary).toContain('战斗胜利');
    expect(summary).toContain('★★★');
    expect(summary).toContain('5回合');
    expect(summary).toContain('存活4人');
  });

  it('should generate one-star victory summary', () => {
    const summary = generateSummary(BattleOutcome.VICTORY, StarRating.ONE, 8, 1);
    expect(summary).toContain('★☆☆');
    expect(summary).toContain('8回合');
    expect(summary).toContain('存活1人');
  });

  it('should generate two-star victory summary', () => {
    const summary = generateSummary(BattleOutcome.VICTORY, StarRating.TWO, 6, 4);
    expect(summary).toContain('★★☆');
  });

  it('should generate defeat summary', () => {
    const summary = generateSummary(BattleOutcome.DEFEAT, StarRating.NONE, 3, 0);
    expect(summary).toContain('战斗失败');
    expect(summary).toContain('第3回合');
  });

  it('should generate draw summary', () => {
    const summary = generateSummary(BattleOutcome.DRAW, StarRating.NONE, 10, 2);
    expect(summary).toContain('战斗平局');
    expect(summary).toContain('10回合');
  });
});

describe('BattleStatisticsSubsystem', () => {
  it('should have correct subsystem name', () => {
    const sub = new BattleStatisticsSubsystem();
    expect(sub.name).toBe('battleStatistics');
  });

  it('should init with deps', () => {
    const sub = new BattleStatisticsSubsystem();
    expect(() => sub.init(makeMockDeps())).not.toThrow();
  });

  it('should return null lastStats before calculation', () => {
    const sub = new BattleStatisticsSubsystem();
    expect(sub.getState().lastStats).toBeNull();
  });

  it('should calculate and store stats', () => {
    const sub = new BattleStatisticsSubsystem();
    sub.init(makeMockDeps());
    const state = makeState([
      makeAction('ally', { e1: { damage: 200, isCritical: false } }),
    ]);
    const stats = sub.calculate(state);
    expect(stats.allyTotalDamage).toBe(200);
    expect(sub.getState().lastStats).toEqual(stats);
  });

  it('should reset stats', () => {
    const sub = new BattleStatisticsSubsystem();
    sub.init(makeMockDeps());
    sub.calculate(makeState([
      makeAction('ally', { e1: { damage: 100, isCritical: false } }),
    ]));
    expect(sub.getState().lastStats).not.toBeNull();
    sub.reset();
    expect(sub.getState().lastStats).toBeNull();
  });

  it('should delegate summary generation', () => {
    const sub = new BattleStatisticsSubsystem();
    const summary = sub.summary(BattleOutcome.VICTORY, StarRating.THREE, 5, 4);
    expect(summary).toContain('战斗胜利');
  });

  it('update should be a no-op', () => {
    const sub = new BattleStatisticsSubsystem();
    expect(() => sub.update(0.016)).not.toThrow();
  });

  it('should overwrite stats on subsequent calculate calls', () => {
    const sub = new BattleStatisticsSubsystem();
    sub.init(makeMockDeps());
    const state1 = makeState([
      makeAction('ally', { e1: { damage: 100, isCritical: false } }),
    ]);
    const state2 = makeState([
      makeAction('ally', { e1: { damage: 500, isCritical: true } }),
    ]);
    sub.calculate(state1);
    sub.calculate(state2);
    expect(sub.getState().lastStats!.allyTotalDamage).toBe(500);
  });
});
