/**
 * 集成测试 — §1 引导状态机
 *
 * 覆盖：5阶段转换、首次/老用户路径、加速跳过、进度追踪、序列化、冲突解决
 * 验证：TutorialStateMachine + TutorialStepManager + FirstLaunchDetector 联动
 * 20 用例 · vitest · describe 嵌套 § 编号
 *
 * @module engine/guide/__tests__/integration/tutorial-state-machine
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TutorialStateMachine } from '../../TutorialStateMachine';
import { TutorialStepManager } from '../../TutorialStepManager';
import { FirstLaunchDetector } from '../../FirstLaunchDetector';
import { CORE_STEP_DEFINITIONS } from '../../../../core/guide/guide-config';
import type { TutorialSaveData } from '../../../../core/guide/guide.types';

// ─── 测试基础设施 ──────────────────────────

function createMockDeps() {
  const listeners = new Map<string, Function[]>();
  return {
    eventBus: {
      on: vi.fn((event: string, handler: Function) => {
        if (!listeners.has(event)) listeners.set(event, []);
        listeners.get(event)!.push(handler);
        return () => { const a = listeners.get(event); if (a) { const i = a.indexOf(handler); if (i >= 0) a.splice(i, 1); } };
      }),
      emit: vi.fn((event: string, payload?: unknown) => {
        listeners.get(event)?.forEach(h => h(payload));
      }),
      once: vi.fn(), off: vi.fn(),
    },
    config: { get: vi.fn(), set: vi.fn(), has: vi.fn() },
    registry: { get: vi.fn(), register: vi.fn(), getAll: vi.fn(() => new Map()), has: vi.fn(), unregister: vi.fn() },
  };
}

function createBundle() {
  const deps = createMockDeps();
  const sm = new TutorialStateMachine();
  const stepMgr = new TutorialStepManager();
  const fld = new FirstLaunchDetector();
  sm.init(deps); stepMgr.init(deps); fld.init(deps);
  stepMgr.setStateMachine(sm); fld.setStateMachine(sm);
  return { deps, sm, stepMgr, fld };
}

/** 完成一个步骤（开始 → 推进所有子步骤） */
function finishStep(mgr: TutorialStepManager, stepId: string) {
  const r = mgr.startStep(stepId as unknown as Record<string, unknown>);
  if (!r.success) return r;
  for (let i = 0; i < r.step!.subSteps.length; i++) mgr.advanceSubStep();
  return r;
}

// ─── §1 引导状态机集成测试 ──────────────────

describe('§1 引导状态机集成测试', () => {
  let b: ReturnType<typeof createBundle>;
  beforeEach(() => { b = createBundle(); });

  // ── §1.1 初始状态 ──────────────────────

  describe('§1.1 初始状态', () => {
    it('#1 新建状态机应处于 not_started', () => {
      expect(b.sm.getCurrentPhase()).toBe('not_started');
    });

    it('#2 初始应无已完成步骤且为首次启动', () => {
      const s = b.sm.getState();
      expect(s.completedSteps).toEqual([]);
      expect(s.completedEvents).toEqual([]);
      expect(b.sm.isFirstLaunch()).toBe(true);
    });

    it('#3 初始应无新手保护', () => {
      expect(b.sm.isNewbieProtectionActive()).toBe(false);
      expect(b.sm.getProtectionRemainingMs()).toBe(0);
    });
  });

  // ── §1.2 首次用户完整路径 ────────────────

  describe('§1.2 首次用户完整路径', () => {
    it('#4 first_enter → core_guiding 并记录时间戳', () => {
      const r = b.sm.transition('first_enter');
      expect(r.success).toBe(true);
      expect(b.sm.getCurrentPhase()).toBe('core_guiding');
      expect(b.sm.getState().tutorialStartTime).toBeGreaterThan(0);
    });

    it('#5 首次进入应开启新手保护', () => {
      b.sm.transition('first_enter');
      expect(b.sm.isNewbieProtectionActive()).toBe(true);
    });

    it('#6 step6_complete → free_explore', () => {
      b.sm.transition('first_enter');
      expect(b.sm.transition('step6_complete').success).toBe(true);
      expect(b.sm.getCurrentPhase()).toBe('free_explore');
    });

    it('#7 explore_done → free_play 并发射 completed 事件', () => {
      b.sm.transition('first_enter');
      b.sm.transition('step6_complete');
      b.deps.eventBus.emit.mockClear();
      b.sm.transition('explore_done');
      expect(b.sm.getCurrentPhase()).toBe('free_play');
      expect(b.deps.eventBus.emit).toHaveBeenCalledWith(
        'tutorial:completed', expect.objectContaining({ timestamp: expect.any(Number) }),
      );
    });
  });

  // ── §1.3 老用户路径与 Mini-tutorial ──────────

  describe('§1.3 老用户路径与 Mini-tutorial', () => {
    it('#8 老用户应直接进入 free_play 且无保护', () => {
      b.fld.handleReturningUser();
      expect(b.sm.getCurrentPhase()).toBe('free_play');
      expect(b.sm.isFirstLaunch()).toBe(false);
      expect(b.sm.isNewbieProtectionActive()).toBe(false);
    });

    it('#9 free_play → mini_tutorial → free_play 循环', () => {
      b.fld.handleReturningUser();
      expect(b.sm.transition('condition_trigger').success).toBe(true);
      expect(b.sm.getCurrentPhase()).toBe('mini_tutorial');
      expect(b.sm.transition('mini_done').success).toBe(true);
      expect(b.sm.getCurrentPhase()).toBe('free_play');
    });
  });

  // ── §1.4 加速跳过路径 ───────────────────

  describe('§1.4 加速跳过路径', () => {
    it('#10 skip_to_explore 跳过核心引导到 free_explore', () => {
      b.sm.transition('first_enter');
      expect(b.sm.transition('skip_to_explore').success).toBe(true);
      expect(b.sm.getCurrentPhase()).toBe('free_explore');
    });

    it('#11 跳过后仍可正常完成到 free_play', () => {
      b.sm.transition('first_enter');
      b.sm.transition('skip_to_explore');
      expect(b.sm.transition('explore_done').success).toBe(true);
      expect(b.sm.getCurrentPhase()).toBe('free_play');
    });

    it('#12 跳过后自由探索数据应可用', () => {
      b.sm.transition('first_enter');
      b.sm.transition('skip_to_explore');
      const data = b.sm.getFreeExploreData();
      expect(data.recommendedActions.length).toBeGreaterThan(0);
      expect(data.unlockedFeatures.length).toBe(5);
    });
  });

  // ── §1.5 非法转换 ──────────────────────

  describe('§1.5 非法状态转换', () => {
    it('#13 not_started 不允许 step6_complete', () => {
      const r = b.sm.transition('step6_complete');
      expect(r.success).toBe(false);
      expect(r.reason).toBeDefined();
    });

    it('#14 core_guiding 不允许 explore_done', () => {
      b.sm.transition('first_enter');
      expect(b.sm.transition('explore_done').success).toBe(false);
    });

    it('#15 free_play 不允许 first_enter', () => {
      b.fld.handleReturningUser();
      expect(b.sm.transition('first_enter').success).toBe(false);
    });
  });

  // ── §1.6 进度追踪与步骤执行 ────────────────

  describe('§1.6 进度追踪与步骤执行', () => {
    beforeEach(() => { b.sm.transition('first_enter'); });

    it('#16 核心步骤应按顺序完成且计数正确', () => {
      const ids = CORE_STEP_DEFINITIONS.map(s => s.stepId);
      expect(ids.length).toBe(6);
      finishStep(b.stepMgr, ids[0]);
      expect(b.sm.getCompletedCoreStepCount()).toBe(1);
      finishStep(b.stepMgr, ids[1]);
      expect(b.sm.getCompletedCoreStepCount()).toBe(2);
    });

    it('#17 跳过前置步骤应失败', () => {
      const r = b.stepMgr.startStep('step3_recruit_hero');
      expect(r.success).toBe(false);
      expect(r.reason).toContain('前置步骤');
    });

    it('#18 转换日志应记录完整历史', () => {
      b.sm.transition('step6_complete');
      b.sm.transition('explore_done');
      const logs = b.sm.getState().transitionLogs;
      expect(logs.length).toBe(3); // first_enter + step6_complete + explore_done
      expect(logs.map(l => l.event)).toEqual(['first_enter', 'step6_complete', 'explore_done']);
    });
  });

  // ── §1.7 序列化与冲突解决 ────────────────

  describe('§1.7 序列化与冲突解决', () => {
    it('#19 序列化→反序列化往返数据一致', () => {
      b.sm.transition('first_enter');
      finishStep(b.stepMgr, 'step1_castle_overview');
      const saved = b.sm.serialize();

      const b2 = createBundle();
      b2.sm.loadSaveData(saved);
      const restored = b2.sm.serialize();
      expect(restored.completedSteps).toEqual(saved.completedSteps);
      expect(restored.currentPhase).toBe(saved.currentPhase);
    });

    it('#20 冲突解决应取步骤并集和更高阶段', () => {
      b.sm.transition('first_enter');
      finishStep(b.stepMgr, 'step1_castle_overview');
      const local = b.sm.serialize();

      const b2 = createBundle();
      b2.sm.transition('first_enter');
      finishStep(b2.stepMgr, 'step1_castle_overview');
      finishStep(b2.stepMgr, 'step2_build_farm');
      b2.sm.transition('step6_complete');
      const remote = b2.sm.serialize();

      const merged = b.sm.resolveConflict(local, remote);
      expect(merged.completedSteps).toContain('step1_castle_overview');
      expect(merged.completedSteps).toContain('step2_build_farm');
      expect(merged.currentPhase).toBe('free_explore'); // remote 阶段更高
    });
  });
});
