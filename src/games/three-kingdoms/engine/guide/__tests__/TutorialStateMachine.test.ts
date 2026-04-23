/**
 * 引擎层测试 — 引导状态机 (TutorialStateMachine)
 *
 * 覆盖功能点：
 *   #1  引导状态机 — 5状态管理+转换条件
 *   #8  引导进度存储 — 序列化/反序列化
 *   #9  冲突解决 — 取并集最大进度
 *   #14 自由探索过渡 — 推荐行动+已解锁功能
 *   #18 新手保护机制 — 30分钟保护
 *
 * @module engine/guide/__tests__/TutorialStateMachine.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TutorialStateMachine } from '../TutorialStateMachine';
import type { TutorialSaveData } from '../../../core/guide';

// ─────────────────────────────────────────────
// Mock 依赖
// ─────────────────────────────────────────────

function createMockDeps() {
  const listeners = new Map<string, Function[]>();
  return {
    eventBus: {
      on: vi.fn((event: string, handler: Function) => {
        if (!listeners.has(event)) listeners.set(event, []);
        listeners.get(event)!.push(handler);
        return () => {
          const arr = listeners.get(event);
          if (arr) {
            const idx = arr.indexOf(handler);
            if (idx >= 0) arr.splice(idx, 1);
          }
        };
      }),
      emit: vi.fn((event: string, payload?: unknown) => {
        const handlers = listeners.get(event);
        if (handlers) handlers.forEach(h => h(payload));
      }),
      once: vi.fn(),
      off: vi.fn(),
    },
    config: {
      get: vi.fn(),
      set: vi.fn(),
      has: vi.fn(),
    },
    registry: {
      get: vi.fn(),
      register: vi.fn(),
      getAll: vi.fn(() => new Map()),
      has: vi.fn(),
      unregister: vi.fn(),
    },
  };
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('TutorialStateMachine', () => {
  let sm: TutorialStateMachine;
  let deps: ReturnType<typeof createMockDeps>;

  beforeEach(() => {
    sm = new TutorialStateMachine();
    deps = createMockDeps();
    sm.init(deps as unknown as Record<string, unknown>);
  });

  // ── #1 引导状态机 ──────────────────────

  describe('#1 引导状态机 — 5状态管理+转换条件', () => {
    it('初始状态应为 not_started', () => {
      expect(sm.getCurrentPhase()).toBe('not_started');
    });

    it('isFirstLaunch 在 not_started 时返回 true', () => {
      expect(sm.isFirstLaunch()).toBe(true);
    });

    it('首次进入 → not_started → core_guiding', () => {
      const result = sm.transition('first_enter');
      expect(result.success).toBe(true);
      expect(sm.getCurrentPhase()).toBe('core_guiding');
    });

    it('首次进入时记录开始时间', () => {
      const before = Date.now();
      sm.transition('first_enter');
      const state = sm.getState();
      expect(state.tutorialStartTime).toBeGreaterThanOrEqual(before);
    });

    it('步骤6完成 → core_guiding → free_explore', () => {
      sm.transition('first_enter');
      const result = sm.transition('step6_complete');
      expect(result.success).toBe(true);
      expect(sm.getCurrentPhase()).toBe('free_explore');
    });

    it('加速跳过 → core_guiding → free_explore', () => {
      sm.transition('first_enter');
      const result = sm.transition('skip_to_explore');
      expect(result.success).toBe(true);
      expect(sm.getCurrentPhase()).toBe('free_explore');
    });

    it('过渡完成 → free_explore → free_play', () => {
      sm.transition('first_enter');
      sm.transition('step6_complete');
      const result = sm.transition('explore_done');
      expect(result.success).toBe(true);
      expect(sm.getCurrentPhase()).toBe('free_play');
    });

    it('条件触发 → free_play → mini_tutorial', () => {
      sm.transition('first_enter');
      sm.transition('step6_complete');
      sm.transition('explore_done');
      const result = sm.transition('condition_trigger');
      expect(result.success).toBe(true);
      expect(sm.getCurrentPhase()).toBe('mini_tutorial');
    });

    it('Mini完成 → mini_tutorial → free_play', () => {
      sm.transition('first_enter');
      sm.transition('step6_complete');
      sm.transition('explore_done');
      sm.transition('condition_trigger');
      const result = sm.transition('mini_done');
      expect(result.success).toBe(true);
      expect(sm.getCurrentPhase()).toBe('free_play');
    });

    it('非法转换应失败', () => {
      const result = sm.transition('step6_complete');
      expect(result.success).toBe(false);
      expect(result.reason).toBeDefined();
    });

    it('core_guiding 不允许 explore_done', () => {
      sm.transition('first_enter');
      const result = sm.transition('explore_done');
      expect(result.success).toBe(false);
    });

    it('free_play 允许 non_first_enter', () => {
      sm.transition('first_enter');
      sm.transition('step6_complete');
      sm.transition('explore_done');
      const result = sm.transition('non_first_enter');
      expect(result.success).toBe(true);
      expect(sm.getCurrentPhase()).toBe('free_play');
    });

    it('状态转换应发射 tutorial:phaseChanged 事件', () => {
      sm.transition('first_enter');
      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'tutorial:phaseChanged',
        expect.objectContaining({
          from: 'not_started',
          to: 'core_guiding',
          event: 'first_enter',
        }),
      );
    });

    it('引导完成应发射 tutorial:completed 事件', () => {
      sm.transition('first_enter');
      sm.transition('step6_complete');
      sm.transition('explore_done');
      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'tutorial:completed',
        expect.objectContaining({ timestamp: expect.any(Number) }),
      );
    });

    it('状态转换日志应记录', () => {
      sm.transition('first_enter');
      const state = sm.getState();
      expect(state.transitionLogs).toHaveLength(1);
      expect(state.transitionLogs[0]).toEqual({
        from: 'not_started',
        to: 'core_guiding',
        event: 'first_enter',
        timestamp: expect.any(Number),
      });
    });
  });

  // ── 非首次进入 ──────────────────────────

  describe('非首次进入', () => {
    it('enterAsReturning 应直接进入 free_play', () => {
      sm.enterAsReturning();
      expect(sm.getCurrentPhase()).toBe('free_play');
      expect(sm.getState().tutorialStartTime).toBeNull();
    });
  });

  // ── 进度管理 ────────────────────────────

  describe('进度管理', () => {
    it('completeStep 应记录步骤完成', () => {
      sm.completeStep('step1_castle_overview');
      expect(sm.isStepCompleted('step1_castle_overview')).toBe(true);
    });

    it('completeStep 不应重复记录', () => {
      sm.completeStep('step1_castle_overview');
      sm.completeStep('step1_castle_overview');
      expect(sm.getCompletedStepCount()).toBe(1);
    });

    it('completeStep 应发射 tutorial:stepCompleted 事件', () => {
      sm.completeStep('step1_castle_overview');
      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'tutorial:stepCompleted',
        expect.objectContaining({
          stepId: 'step1_castle_overview',
          timestamp: expect.any(Number),
        }),
      );
    });

    it('completeStoryEvent 应记录剧情完成', () => {
      sm.completeStoryEvent('e1_peach_garden');
      expect(sm.isStoryEventCompleted('e1_peach_garden')).toBe(true);
    });

    it('completeStoryEvent 应发射事件', () => {
      sm.completeStoryEvent('e1_peach_garden', true);
      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'tutorial:storyCompleted',
        { eventId: 'e1_peach_garden', skipped: true },
      );
    });

    it('setCurrentStep 应更新当前步骤', () => {
      sm.setCurrentStep('step2_build_farm', 2);
      const state = sm.getState();
      expect(state.currentStepId).toBe('step2_build_farm');
      expect(state.currentSubStepIndex).toBe(2);
    });

    it('advanceSubStep 应推进子步骤', () => {
      sm.setCurrentStep('step1_castle_overview', 0);
      const result = sm.advanceSubStep(5);
      expect(result.completed).toBe(false);
      expect(result.newIndex).toBe(1);
    });

    it('advanceSubStep 到末尾应标记完成', () => {
      sm.setCurrentStep('step1_castle_overview', 4);
      const result = sm.advanceSubStep(5);
      expect(result.completed).toBe(true);
    });

    it('getCompletedCoreStepCount 应统计核心步骤', () => {
      sm.completeStep('step1_castle_overview');
      sm.completeStep('step3_recruit_hero');
      expect(sm.getCompletedCoreStepCount()).toBe(2);
    });
  });

  // ── #18 新手保护机制 ────────────────────

  describe('#18 新手保护机制', () => {
    it('初始时无新手保护', () => {
      expect(sm.isNewbieProtectionActive()).toBe(false);
    });

    it('首次进入后开启新手保护', () => {
      sm.transition('first_enter');
      expect(sm.isNewbieProtectionActive()).toBe(true);
    });

    it('保护期内 getProtectionRemainingMs 应返回正值', () => {
      sm.transition('first_enter');
      expect(sm.getProtectionRemainingMs()).toBeGreaterThan(0);
    });

    it('enterAsReturning 不开启新手保护', () => {
      sm.enterAsReturning();
      expect(sm.isNewbieProtectionActive()).toBe(false);
    });
  });

  // ── #14 自由探索过渡 ────────────────────

  describe('#14 自由探索过渡', () => {
    it('getFreeExploreData 应返回推荐行动和已解锁功能', () => {
      const data = sm.getFreeExploreData();
      expect(data.recommendedActions).toHaveLength(3);
      expect(data.unlockedFeatures.length).toBeGreaterThan(0);
      expect(data.phaseReward).toBeDefined();
      expect(data.phaseReward.title).toBe('初出茅庐');
    });

    it('推荐行动应包含升级建筑、招募武将、探索地图', () => {
      const data = sm.getFreeExploreData();
      const ids = data.recommendedActions.map(a => a.id);
      expect(ids).toContain('upgrade_building');
      expect(ids).toContain('recruit_more');
      expect(ids).toContain('explore_map');
    });

    it('已解锁功能应包含核心系统', () => {
      const data = sm.getFreeExploreData();
      const names = data.unlockedFeatures.map(f => f.name);
      expect(names).toContain('建筑系统');
      expect(names).toContain('武将系统');
      expect(names).toContain('科技系统');
    });
  });

  // ── #8 序列化 ──────────────────────────

  describe('#8 序列化/反序列化', () => {
    it('serialize 应返回完整存档数据', () => {
      sm.transition('first_enter');
      sm.completeStep('step1_castle_overview');
      const data = sm.serialize();
      expect(data.version).toBe(1);
      expect(data.currentPhase).toBe('core_guiding');
      expect(data.completedSteps).toContain('step1_castle_overview');
      expect(data.transitionLogs).toHaveLength(1);
    });

    it('loadSaveData 应恢复状态', () => {
      const saveData: TutorialSaveData = {
        version: 1,
        currentPhase: 'free_play',
        completedSteps: ['step1_castle_overview', 'step2_build_farm'],
        completedEvents: ['e1_peach_garden'],
        currentStepId: null,
        currentSubStepIndex: 0,
        tutorialStartTime: 1000,
        transitionLogs: [],
        dailyReplayCount: 0,
        lastReplayDate: '',
        protectionStartTime: null,
      };
      sm.loadSaveData(saveData);
      expect(sm.getCurrentPhase()).toBe('free_play');
      expect(sm.isStepCompleted('step1_castle_overview')).toBe(true);
      expect(sm.isStoryEventCompleted('e1_peach_garden')).toBe(true);
    });
  });

  // ── #9 冲突解决 ──────────────────────────

  describe('#9 冲突解决 — 取并集最大进度', () => {
    it('应合并步骤并集', () => {
      const local: TutorialSaveData = {
        version: 1, currentPhase: 'core_guiding',
        completedSteps: ['step1_castle_overview', 'step2_build_farm'],
        completedEvents: ['e1_peach_garden'],
        currentStepId: 'step3_recruit_hero', currentSubStepIndex: 0,
        tutorialStartTime: 1000, transitionLogs: [],
        dailyReplayCount: 0, lastReplayDate: '', protectionStartTime: null,
      };
      const remote: TutorialSaveData = {
        version: 1, currentPhase: 'free_play',
        completedSteps: ['step1_castle_overview', 'step3_recruit_hero'],
        completedEvents: ['e2_yellow_turban'],
        currentStepId: null, currentSubStepIndex: 0,
        tutorialStartTime: 2000, transitionLogs: [],
        dailyReplayCount: 1, lastReplayDate: '2024-01-01', protectionStartTime: null,
      };
      const merged = sm.resolveConflict(local, remote);
      expect(merged.completedSteps).toContain('step1_castle_overview');
      expect(merged.completedSteps).toContain('step2_build_farm');
      expect(merged.completedSteps).toContain('step3_recruit_hero');
      expect(merged.completedEvents).toContain('e1_peach_garden');
      expect(merged.completedEvents).toContain('e2_yellow_turban');
    });

    it('应取进度更高的阶段', () => {
      const local: TutorialSaveData = {
        version: 1, currentPhase: 'core_guiding',
        completedSteps: [], completedEvents: [],
        currentStepId: null, currentSubStepIndex: 0,
        tutorialStartTime: null, transitionLogs: [],
        dailyReplayCount: 0, lastReplayDate: '', protectionStartTime: null,
      };
      const remote: TutorialSaveData = {
        version: 1, currentPhase: 'free_play',
        completedSteps: [], completedEvents: [],
        currentStepId: null, currentSubStepIndex: 0,
        tutorialStartTime: null, transitionLogs: [],
        dailyReplayCount: 0, lastReplayDate: '', protectionStartTime: null,
      };
      const merged = sm.resolveConflict(local, remote);
      expect(merged.currentPhase).toBe('free_play');
    });
  });

  // ── reset ──────────────────────────────

  describe('reset', () => {
    it('reset 应恢复初始状态', () => {
      sm.transition('first_enter');
      sm.completeStep('step1_castle_overview');
      sm.reset();
      expect(sm.getCurrentPhase()).toBe('not_started');
      expect(sm.getCompletedStepCount()).toBe(0);
      expect(sm.isFirstLaunch()).toBe(true);
    });
  });
});
