/**
 * pvp/ArenaConfig.ts 单元测试
 *
 * 覆盖导出函数：
 * - createDefaultDefenseFormation
 * - createDefaultArenaPlayerState
 *
 * 验证常量：
 * - DEFAULT_MATCH_CONFIG
 * - DEFAULT_REFRESH_CONFIG
 * - DEFAULT_CHALLENGE_CONFIG
 * - ARENA_SAVE_VERSION
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_MATCH_CONFIG,
  DEFAULT_REFRESH_CONFIG,
  DEFAULT_CHALLENGE_CONFIG,
  ARENA_SAVE_VERSION,
  createDefaultDefenseFormation,
  createDefaultArenaPlayerState,
} from '../ArenaConfig';

// ═══════════════════════════════════════════
// createDefaultDefenseFormation
// ═══════════════════════════════════════════
describe('createDefaultDefenseFormation', () => {
  it('返回5个空槽位', () => {
    const formation = createDefaultDefenseFormation();
    expect(formation.slots).toHaveLength(5);
    expect(formation.slots.every((s) => s === '')).toBe(true);
  });

  it('有有效的阵型类型', () => {
    const formation = createDefaultDefenseFormation();
    expect(formation.formation).toBeTruthy();
  });

  it('有有效的 AI 策略', () => {
    const formation = createDefaultDefenseFormation();
    expect(formation.strategy).toBeTruthy();
  });

  it('每次调用返回新对象', () => {
    const a = createDefaultDefenseFormation();
    const b = createDefaultDefenseFormation();
    expect(a).not.toBe(b);
    expect(a.slots).not.toBe(b.slots);
  });

  it('slots 是可修改的副本', () => {
    const a = createDefaultDefenseFormation();
    const b = createDefaultDefenseFormation();
    a.slots[0] = 'hero1';
    expect(b.slots[0]).toBe('');
  });
});

// ═══════════════════════════════════════════
// createDefaultArenaPlayerState
// ═══════════════════════════════════════════
describe('createDefaultArenaPlayerState', () => {
  it('无参调用使用空 playerId', () => {
    const state = createDefaultArenaPlayerState();
    expect(state.playerId).toBe('');
  });

  it('传入 playerId 正确设置', () => {
    const state = createDefaultArenaPlayerState('player123');
    expect(state.playerId).toBe('player123');
  });

  it('初始分数为 0', () => {
    const state = createDefaultArenaPlayerState('p1');
    expect(state.score).toBe(0);
  });

  it('初始排名为 0', () => {
    const state = createDefaultArenaPlayerState('p1');
    expect(state.ranking).toBe(0);
  });

  it('初始段位为 BRONZE_V', () => {
    const state = createDefaultArenaPlayerState('p1');
    expect(state.rankId).toBe('BRONZE_V');
  });

  it('dailyChallengesLeft 等于配置的免费次数', () => {
    const state = createDefaultArenaPlayerState('p1');
    expect(state.dailyChallengesLeft).toBe(DEFAULT_CHALLENGE_CONFIG.dailyFreeChallenges);
  });

  it('dailyBoughtChallenges 初始为 0', () => {
    const state = createDefaultArenaPlayerState('p1');
    expect(state.dailyBoughtChallenges).toBe(0);
  });

  it('dailyManualRefreshes 初始为 0', () => {
    const state = createDefaultArenaPlayerState('p1');
    expect(state.dailyManualRefreshes).toBe(0);
  });

  it('opponents 初始为空', () => {
    const state = createDefaultArenaPlayerState('p1');
    expect(state.opponents).toEqual([]);
  });

  it('defenseFormation 有效', () => {
    const state = createDefaultArenaPlayerState('p1');
    expect(state.defenseFormation).toBeDefined();
    expect(state.defenseFormation.slots).toHaveLength(5);
  });

  it('defenseLogs 和 replays 初始为空', () => {
    const state = createDefaultArenaPlayerState('p1');
    expect(state.defenseLogs).toEqual([]);
    expect(state.replays).toEqual([]);
  });

  it('arenaCoins 初始为 0', () => {
    const state = createDefaultArenaPlayerState('p1');
    expect(state.arenaCoins).toBe(0);
  });

  it('每次调用返回新对象', () => {
    const a = createDefaultArenaPlayerState('p1');
    const b = createDefaultArenaPlayerState('p1');
    expect(a).not.toBe(b);
    expect(a.defenseFormation).not.toBe(b.defenseFormation);
  });
});

// ═══════════════════════════════════════════
// 常量验证
// ═══════════════════════════════════════════
describe('常量', () => {
  it('DEFAULT_MATCH_CONFIG 战力比在合理范围', () => {
    expect(DEFAULT_MATCH_CONFIG.powerMinRatio).toBeGreaterThan(0);
    expect(DEFAULT_MATCH_CONFIG.powerMinRatio).toBeLessThan(1);
    expect(DEFAULT_MATCH_CONFIG.powerMaxRatio).toBeGreaterThan(1);
  });

  it('DEFAULT_MATCH_CONFIG 候选人数 > 0', () => {
    expect(DEFAULT_MATCH_CONFIG.candidateCount).toBeGreaterThan(0);
  });

  it('DEFAULT_MATCH_CONFIG 排名偏移合理', () => {
    expect(DEFAULT_MATCH_CONFIG.rankMinOffset).toBeGreaterThan(0);
    expect(DEFAULT_MATCH_CONFIG.rankMaxOffset).toBeGreaterThanOrEqual(DEFAULT_MATCH_CONFIG.rankMinOffset);
  });

  it('DEFAULT_REFRESH_CONFIG 免费间隔 > 0', () => {
    expect(DEFAULT_REFRESH_CONFIG.freeIntervalMs).toBeGreaterThan(0);
  });

  it('DEFAULT_REFRESH_CONFIG 手动刷新消耗 > 0', () => {
    expect(DEFAULT_REFRESH_CONFIG.manualCostCopper).toBeGreaterThan(0);
  });

  it('DEFAULT_REFRESH_CONFIG 每日手动限制 > 0', () => {
    expect(DEFAULT_REFRESH_CONFIG.dailyManualLimit).toBeGreaterThan(0);
  });

  it('DEFAULT_CHALLENGE_CONFIG 每日免费次数 > 0', () => {
    expect(DEFAULT_CHALLENGE_CONFIG.dailyFreeChallenges).toBeGreaterThan(0);
  });

  it('DEFAULT_CHALLENGE_CONFIG 购买消耗 > 0', () => {
    expect(DEFAULT_CHALLENGE_CONFIG.buyCostGold).toBeGreaterThan(0);
  });

  it('ARENA_SAVE_VERSION 为正整数', () => {
    expect(ARENA_SAVE_VERSION).toBeGreaterThan(0);
    expect(Number.isInteger(ARENA_SAVE_VERSION)).toBe(true);
  });
});
