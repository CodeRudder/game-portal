/**
 * 三国霸业 — 通用引擎系统集成测试
 *
 * 验证 QuestSystem、EventSystem、RewardSystem 已正确集成到 ThreeKingdomsEngine。
 * 覆盖：引擎初始化后系统可用、任务注册正确、活动注册正确、getter 方法。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ThreeKingdomsEngine } from '@/games/three-kingdoms/ThreeKingdomsEngine';

// ═══════════════════════════════════════════════════════════════
// 测试辅助
// ═══════════════════════════════════════════════════════════════

function createEngine(): ThreeKingdomsEngine {
  const engine = new ThreeKingdomsEngine();
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 600;
  (engine as any).canvas = canvas;
  (engine as any).ctx = canvas.getContext('2d');
  (engine as any)._status = 'playing';
  (engine as any).onInit();
  return engine;
}

// ═══════════════════════════════════════════════════════════════
// 测试
// ═══════════════════════════════════════════════════════════════

describe('ThreeKingdomsEngine — 通用引擎系统集成', () => {
  let engine: ThreeKingdomsEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  // ── 1. 引擎初始化后 QuestSystem 可用 ──────────────────────
  it('初始化后 QuestSystem 可用', () => {
    const qs = engine.questSystem;
    expect(qs).toBeDefined();
    expect(typeof qs.register).toBe('function');
    expect(typeof qs.acceptQuest).toBe('function');
    expect(typeof qs.updateProgress).toBe('function');
  });

  // ── 2. 引擎初始化后 EventSystem 可用 ──────────────────────
  it('初始化后 EventSystem 可用', () => {
    const es = engine.eventSystem;
    expect(es).toBeDefined();
    expect(typeof es.registerEvent).toBe('function');
    expect(typeof es.getActiveEvents).toBe('function');
    expect(typeof es.updateEventStatuses).toBe('function');
  });

  // ── 3. 主线任务注册正确 ──────────────────────────────────
  it('主线任务注册正确（6 个）', () => {
    const qs = engine.questSystem;
    const mainIds = ['q01', 'q02', 'q03', 'q04', 'q05', 'q06'];
    for (const id of mainIds) {
      const def = qs.getDef(id);
      expect(def).toBeDefined();
      expect(def!.type).toBe('main');
    }
    // q01 自动接取，应在 activeQuests 中
    const q01 = qs.getDef('q01');
    expect(q01!.name).toBe('初入乱世');
    expect(q01!.conditions[0].targetId).toBe('farm');
  });

  // ── 4. 日常任务注册正确 ──────────────────────────────────
  it('日常任务注册正确（3 个）', () => {
    const qs = engine.questSystem;
    const dailyIds = ['dq01', 'dq02', 'dq03'];
    for (const id of dailyIds) {
      const def = qs.getDef(id);
      expect(def).toBeDefined();
      expect(def!.type).toBe('daily');
    }
    const dq01 = qs.getDef('dq01');
    expect(dq01!.name).toBe('日积月累');
  });

  // ── 5. 周常任务注册正确 ──────────────────────────────────
  it('周常任务注册正确（1 个）', () => {
    const qs = engine.questSystem;
    const def = qs.getDef('wq01');
    expect(def).toBeDefined();
    expect(def!.type).toBe('weekly');
    expect(def!.name).toBe('周末征伐');
  });

  // ── 6. 限时活动注册正确 ──────────────────────────────────
  it('限时活动注册正确（5 个）', () => {
    const es = engine.eventSystem;
    // ev01, ev02, ev05 应为 active（时间窗口内）
    const active = es.getActiveEvents();
    const activeIds = active.map(e => e.id);
    expect(activeIds).toContain('ev01');
    expect(activeIds).toContain('ev02');
    expect(activeIds).toContain('ev05');

    // ev03, ev04 为 upcoming
    const upcoming = es.getUpcomingEvents();
    const upcomingIds = upcoming.map(e => e.id);
    expect(upcomingIds).toContain('ev03');
    expect(upcomingIds).toContain('ev04');
  });

  // ── 7. getter 方法返回正确实例 ────────────────────────────
  it('getter 方法返回 RewardSystem 实例', () => {
    const rs = engine.rewardSystem;
    expect(rs).toBeDefined();
    expect(typeof rs.grantReward).toBe('function');
    expect(rs.pendingRewards).toEqual([]);
  });

  // ── 8. 任务总数验证 ──────────────────────────────────────
  it('任务总数为 10（6 主线 + 3 日常 + 1 周常）', () => {
    const qs = engine.questSystem;
    const allIds = [
      'q01', 'q02', 'q03', 'q04', 'q05', 'q06',
      'dq01', 'dq02', 'dq03',
      'wq01',
    ];
    for (const id of allIds) {
      expect(qs.getDef(id)).toBeDefined();
    }
  });
});
