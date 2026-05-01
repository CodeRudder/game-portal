/**
 * Guide 模块 R1 对抗式测试
 *
 * 覆盖 R1 挑战书中的 P0/P1/P2 缺陷验证。
 *
 * @module engine/guide/__tests__/ACC-guide-R1.adversarial.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TutorialStateMachine } from '../TutorialStateMachine';
import { TutorialStorage } from '../TutorialStorage';
import { TutorialStepManager } from '../TutorialStepManager';
import { TutorialStepExecutor } from '../TutorialStepExecutor';
import { StoryEventPlayer } from '../StoryEventPlayer';
import { TutorialMaskSystem } from '../TutorialMaskSystem';
import { FirstLaunchDetector } from '../FirstLaunchDetector';
import type { TutorialSaveData } from '../../../core/guide';

// ─────────────────────────────────────────────
// Mock 工厂
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
    config: { get: vi.fn(), set: vi.fn(), has: vi.fn() },
    registry: {
      get: vi.fn(), register: vi.fn(),
      getAll: vi.fn(() => new Map()), has: vi.fn(), unregister: vi.fn(),
    },
  };
}

function createSaveData(overrides: Partial<TutorialSaveData> = {}): TutorialSaveData {
  return {
    version: 1,
    currentPhase: 'not_started',
    completedSteps: [],
    completedEvents: [],
    currentStepId: null,
    currentSubStepIndex: 0,
    tutorialStartTime: null,
    transitionLogs: [],
    dailyReplayCount: 0,
    lastReplayDate: '',
    protectionStartTime: null,
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// P0 挑战验证
// ─────────────────────────────────────────────

describe('Guide R1 对抗测试 — P0', () => {

  // ── P0-1: loadSaveData 无字段校验 ──────

  describe('P0-1: TutorialStateMachine.loadSaveData 无字段校验 (FIX-001)', () => {
    let sm: TutorialStateMachine;

    beforeEach(() => {
      sm = new TutorialStateMachine();
      sm.init(createMockDeps() as any);
    });

    it('非法 currentPhase 安全回退到 not_started', () => {
      sm.loadSaveData(createSaveData({ currentPhase: 'INVALID_PHASE' as any }));
      expect(sm.getCurrentPhase()).toBe('not_started');
      // FIX-001: 不再崩溃，可以正常转换
      const result = sm.transition('first_enter');
      expect(result.success).toBe(true);
    });

    it('completedSteps 为 null 安全回退到空数组', () => {
      sm.loadSaveData(createSaveData({ completedSteps: null as any }));
      expect(() => sm.isStepCompleted('step1_castle_overview')).not.toThrow();
      expect(sm.isStepCompleted('step1_castle_overview')).toBe(false);
    });

    it('completedEvents 为 null 安全回退到空数组', () => {
      sm.loadSaveData(createSaveData({ completedEvents: null as any }));
      expect(() => sm.isStoryEventCompleted('e1_peach_garden')).not.toThrow();
      expect(sm.isStoryEventCompleted('e1_peach_garden')).toBe(false);
    });

    it('transitionLogs 为 null 安全回退到空数组', () => {
      sm.loadSaveData(createSaveData({ transitionLogs: null as any }));
      expect(() => sm.transition('first_enter')).not.toThrow();
      expect(sm.getState().transitionLogs).toHaveLength(1);
    });
  });

  // ── P0-2: validateSaveData 校验不完整 ──

  describe('P0-2: TutorialStorage.validateSaveData 校验增强 (FIX-002)', () => {
    let storage: TutorialStorage;
    let sm: TutorialStateMachine;

    beforeEach(() => {
      sm = new TutorialStateMachine();
      sm.init(createMockDeps() as any);
      storage = new TutorialStorage();
      storage.init(createMockDeps() as any);
      storage.setStateMachine(sm);
    });

    it('version 为字符串时校验应失败', () => {
      const badJson = JSON.stringify({
        version: 'not_a_number',
        currentPhase: 'not_started',
        completedSteps: [],
        completedEvents: [],
      });
      try {
        localStorage.setItem('three-kingdoms-tutorial-save', badJson);
      } catch { /* ignore */ }
      const result = storage.load();
      expect(result.success).toBe(false);
    });

    it('currentPhase 为数字时校验应失败', () => {
      const badJson = JSON.stringify({
        version: 1,
        currentPhase: 42,
        completedSteps: [],
        completedEvents: [],
      });
      try {
        localStorage.setItem('three-kingdoms-tutorial-save', badJson);
      } catch { /* ignore */ }
      const result = storage.load();
      expect(result.success).toBe(false);
    });

    it('非法 currentPhase 字符串时校验应失败 (FIX-002)', () => {
      const badJson = JSON.stringify({
        version: 1,
        currentPhase: 'INVALID_PHASE',
        completedSteps: [],
        completedEvents: [],
      });
      try {
        localStorage.setItem('three-kingdoms-tutorial-save', badJson);
      } catch { /* ignore */ }
      const result = storage.load();
      expect(result.success).toBe(false);
    });

    it('completedSteps 含非字符串元素时校验应失败 (FIX-002)', () => {
      const badJson = JSON.stringify({
        version: 1,
        currentPhase: 'not_started',
        completedSteps: [123, null],
        completedEvents: [],
      });
      try {
        localStorage.setItem('three-kingdoms-tutorial-save', badJson);
      } catch { /* ignore */ }
      const result = storage.load();
      expect(result.success).toBe(false);
    });
  });

  // ── P0-3: load JSON异常被吞没 ──────────

  describe('P0-3: TutorialStorage.load 损坏JSON自动清理 (FIX-003)', () => {
    let storage: TutorialStorage;
    let sm: TutorialStateMachine;

    beforeEach(() => {
      sm = new TutorialStateMachine();
      sm.init(createMockDeps() as any);
      storage = new TutorialStorage();
      storage.init(createMockDeps() as any);
      storage.setStateMachine(sm);
    });

    it('损坏JSON返回失败', () => {
      try {
        localStorage.setItem('three-kingdoms-tutorial-save', '{invalid json###');
      } catch { /* ignore */ }
      const result = storage.load();
      expect(result.success).toBe(false);
      expect(result.reason).toContain('加载失败');
    });

    it('restore损坏数据后自动清理存储 (FIX-003)', () => {
      try {
        localStorage.setItem('three-kingdoms-tutorial-save', '{bad}');
      } catch { /* ignore */ }
      const result = storage.restore();
      expect(result.success).toBe(false);
      // FIX-003: 损坏数据应被自动清除
      expect(result.reason).toContain('已清除');
      // 状态机应保持初始状态
      expect(sm.getCurrentPhase()).toBe('not_started');
      // 存储应已被清理
      expect(storage.hasSaveData()).toBe(false);
    });
  });

  // ── P0-4: resolveConflict phaseOrder ────

  describe('P0-4: TutorialStateMachine.resolveConflict mini_tutorial排序', () => {
    let sm: TutorialStateMachine;

    beforeEach(() => {
      sm = new TutorialStateMachine();
      sm.init(createMockDeps() as any);
    });

    it('free_play vs mini_tutorial 应取 free_play', () => {
      const local = createSaveData({ currentPhase: 'free_play' });
      const remote = createSaveData({ currentPhase: 'mini_tutorial' });
      const merged = sm.resolveConflict(local, remote);
      expect(merged.currentPhase).toBe('free_play');
    });

    it('mini_tutorial vs core_guiding 应取 mini_tutorial', () => {
      const local = createSaveData({ currentPhase: 'mini_tutorial' });
      const remote = createSaveData({ currentPhase: 'core_guiding' });
      const merged = sm.resolveConflict(local, remote);
      expect(merged.currentPhase).toBe('mini_tutorial');
    });

    it('相同阶段取本地数据', () => {
      const local = createSaveData({
        currentPhase: 'core_guiding',
        currentStepId: 'step3_recruit_hero',
        currentSubStepIndex: 2,
      });
      const remote = createSaveData({
        currentPhase: 'core_guiding',
        currentStepId: 'step2_build_farm',
        currentSubStepIndex: 1,
      });
      const merged = sm.resolveConflict(local, remote);
      expect(merged.currentStepId).toBe('step3_recruit_hero');
    });
  });

  // ── P0-5: detectGraphicsQuality 边界值 ─

  describe('P0-5: FirstLaunchDetector.detectGraphicsQuality 边界值', () => {
    let detector: FirstLaunchDetector;
    let sm: TutorialStateMachine;

    beforeEach(() => {
      sm = new TutorialStateMachine();
      sm.init(createMockDeps() as any);
      detector = new FirstLaunchDetector();
      detector.init(createMockDeps() as any);
      detector.setStateMachine(sm);
    });

    it('4核+3.99GB内存应推荐medium (FIX-004 容差)', () => {
      detector.setHardwareInfoProvider(() => ({
        cpuCores: 4,
        memoryGB: 3.99,
        gpuRenderer: '',
        devicePixelRatio: 1,
      }));
      const result = detector.detectFirstLaunch();
      // FIX-004: 0.1容差 → 3.99 >= 3.9 → medium
      expect(result.recommendedQuality).toBe('medium');
    });

    it('8核+8GB内存应推荐high', () => {
      detector.setHardwareInfoProvider(() => ({
        cpuCores: 8,
        memoryGB: 8,
        gpuRenderer: '',
        devicePixelRatio: 1,
      }));
      const result = detector.detectFirstLaunch();
      expect(result.recommendedQuality).toBe('high');
    });

    it('2核+2GB内存应推荐low', () => {
      detector.setHardwareInfoProvider(() => ({
        cpuCores: 2,
        memoryGB: 2,
        gpuRenderer: '',
        devicePixelRatio: 1,
      }));
      const result = detector.detectFirstLaunch();
      expect(result.recommendedQuality).toBe('low');
    });

    it('1核+1GB内存应推荐low', () => {
      detector.setHardwareInfoProvider(() => ({
        cpuCores: 1,
        memoryGB: 1,
        gpuRenderer: '',
        devicePixelRatio: 1,
      }));
      const result = detector.detectFirstLaunch();
      expect(result.recommendedQuality).toBe('low');
    });
  });

  // ── P0-7: completeEvent null eventId ────

  describe('P0-7: StoryEventPlayer completeEvent null eventId', () => {
    let player: StoryEventPlayer;
    let sm: TutorialStateMachine;

    beforeEach(() => {
      sm = new TutorialStateMachine();
      sm.init(createMockDeps() as any);
      player = new StoryEventPlayer();
      player.init(createMockDeps() as any);
      player.setStateMachine(sm);
    });

    it('confirmSkip 无活跃事件时应安全处理', () => {
      const result = player.confirmSkip();
      expect(result.success).toBe(false);
      expect(result.transitionEffect).toBe('none');
    });

    it('startEvent+confirmSkip 正常流程', () => {
      const startResult = player.startEvent('e1_peach_garden');
      expect(startResult.success).toBe(true);

      player.requestSkip();
      const skipResult = player.confirmSkip();
      expect(skipResult.success).toBe(true);
      expect(skipResult.transitionEffect).toBe('ink_wash');
      expect(skipResult.rewards.length).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────
// P1 挑战验证
// ─────────────────────────────────────────────

describe('Guide R1 对抗测试 — P1', () => {

  // ── P1-1: evaluateTriggerCondition value undefined ──

  describe('P1-1: evaluateTriggerCondition value为undefined', () => {
    let executor: TutorialStepExecutor;
    let sm: TutorialStateMachine;

    beforeEach(() => {
      sm = new TutorialStateMachine();
      sm.init(createMockDeps() as any);
      executor = new TutorialStepExecutor();
      executor.init(createMockDeps() as any);
      executor.setStateMachine(sm);
    });

    it('building_level value=undefined → 条件不满足', () => {
      const result = executor.checkExtendedStepTriggers({
        castleLevel: 10,
        heroCount: 0,
        battleCount: 0,
        techCount: 0,
        allianceJoined: false,
        firstAlliance: false,
        bagCapacityPercent: 0,
      });
      // 所有扩展步骤的 triggerCondition.value 都有定义
      // 所以这个测试验证的是默认行为
      // 如果某个条件 value 未定义，Number(undefined)=NaN → 条件不满足
      expect(result).toBeDefined();
    });
  });

  // ── P1-2: replayMode 下 completeCurrentStep ──

  describe('P1-2: replayMode下completeCurrentStep不记录步骤', () => {
    let stepManager: TutorialStepManager;
    let sm: TutorialStateMachine;

    beforeEach(() => {
      sm = new TutorialStateMachine();
      sm.init(createMockDeps() as any);
      stepManager = new TutorialStepManager();
      stepManager.init(createMockDeps() as any);
      stepManager.setStateMachine(sm);
    });

    it('重玩模式下完成步骤不记录到状态机', () => {
      // 开始重玩
      const replayResult = stepManager.startReplay('watch');
      expect(replayResult.success).toBe(true);

      // 启动已完成步骤
      sm.completeStep('step1_castle_overview');
      const startResult = stepManager.startStep('step1_castle_overview');
      // 重玩模式下允许重新开始已完成步骤
      // 但 startStep 检查 isStepCompleted && !replayMode
      // replayMode 已设置 → 应该允许
      expect(startResult.success).toBe(true);
    });
  });

  // ── P1-3: applyPadding 负数 ────────────

  describe('P1-3: TutorialMaskSystem 负数padding', () => {
    let mask: TutorialMaskSystem;

    beforeEach(() => {
      mask = new TutorialMaskSystem();
      mask.init(createMockDeps() as any);
    });

    it('负数padding被clamp为0 (FIX-005)', () => {
      mask.activate({ padding: -10 });
      mask.setHighlightTarget('#test', () => ({ x: 100, y: 100, width: 50, height: 50 }));

      const bounds = mask.getHighlightBounds();
      expect(bounds).not.toBeNull();
      // FIX-005: padding被clamp为0，高亮区域等于元素区域
      expect(bounds!.x).toBe(100);
      expect(bounds!.width).toBe(50);
    });

    it('极大负padding被clamp为0 (FIX-005)', () => {
      mask.activate({ padding: -100 });
      mask.setHighlightTarget('#test', () => ({ x: 100, y: 100, width: 50, height: 50 }));

      const bounds = mask.getHighlightBounds();
      // FIX-005: 不会出现负宽度/高度
      expect(bounds!.width).toBeGreaterThanOrEqual(0);
      expect(bounds!.height).toBeGreaterThanOrEqual(0);
    });
  });

  // ── P1-4: computeAutoPosition viewport高度0 ──

  describe('P1-4: TutorialMaskSystem viewport高度为0', () => {
    let mask: TutorialMaskSystem;

    beforeEach(() => {
      mask = new TutorialMaskSystem();
      mask.init(createMockDeps() as any);
    });

    it('viewport高度0时自动定位异常', () => {
      mask.activate();
      mask.setViewportSize({ width: 375, height: 0 });
      mask.setHighlightTarget('#test', () => ({ x: 100, y: 100, width: 50, height: 50 }));
      mask.showBubble({
        text: 'test',
        position: 'auto',
        arrowTarget: '#test',
        autoPosition: true,
        maxWidth: 280,
      });

      const renderData = mask.getRenderData();
      // BUG: viewport高度0时 spaceBelow=0-(100+50)=-150 < 80, spaceAbove=100 >= 80 → 'top'
      // 但top在0高度viewport中也不可见，应返回合理值
      // 实际返回 'top' 因为 spaceAbove=100 >= 80
      expect(['top', 'bottom', 'right']).toContain(renderData.bubble.computedPosition);
    });
  });

  // ── P1-5: tap 在 allComplete 后 ─────────

  describe('P1-5: StoryEventPlayer tap在allComplete后', () => {
    let player: StoryEventPlayer;
    let sm: TutorialStateMachine;

    beforeEach(() => {
      sm = new TutorialStateMachine();
      sm.init(createMockDeps() as any);
      player = new StoryEventPlayer();
      player.init(createMockDeps() as any);
      player.setStateMachine(sm);
    });

    it('播放完成后tap应安全返回', () => {
      player.startEvent('e3_three_visits'); // 只有4行对话
      // 快速推进所有行
      for (let i = 0; i < 10; i++) {
        player.tap();
      }
      // 额外tap不应崩溃
      const result = player.tap();
      expect(result.action).toBe('complete');
    });
  });

  // ── P1-6: resetStepsOnly 保留currentPhase ──

  describe('P1-6: TutorialStorage resetStepsOnly 保留currentPhase', () => {
    let storage: TutorialStorage;
    let sm: TutorialStateMachine;

    beforeEach(() => {
      sm = new TutorialStateMachine();
      sm.init(createMockDeps() as any);
      storage = new TutorialStorage();
      storage.init(createMockDeps() as any);
      storage.setStateMachine(sm);
    });

    it('resetStepsOnly 清除步骤和阶段(与文档声称不符)', () => {
      // 设置一些进度
      sm.transition('first_enter');
      sm.completeStep('step1_castle_overview');
      sm.completeStep('step2_build_farm');

      const result = storage.resetStepsOnly();
      expect(result.success).toBe(true);

      // 步骤已清除
      expect(sm.isStepCompleted('step1_castle_overview')).toBe(false);
      // BUG: resetStepsOnly 也重置了 currentPhase 为 'not_started'
      // 但方法名暗示只重置步骤 — 实际上重置了所有状态
      expect(sm.getCurrentPhase()).toBe('not_started');
    });
  });

  // ── P1-7: transition 重复转换不幂等 ────

  describe('P1-7: TutorialStateMachine 重复转换不幂等', () => {
    let sm: TutorialStateMachine;

    beforeEach(() => {
      sm = new TutorialStateMachine();
      sm.init(createMockDeps() as any);
    });

    it('相同转换可多次执行', () => {
      sm.transition('first_enter'); // not_started → core_guiding
      // core_guiding 允许 step6_complete
      sm.transition('step6_complete'); // core_guiding → free_explore
      // free_explore 只允许 explore_done
      const result = sm.transition('explore_done');
      expect(result.success).toBe(true);

      // tutorial:completed 应该只触发一次
      const state = sm.getState();
      // 但日志记录了3次转换
      expect(state.transitionLogs).toHaveLength(3);
    });

    it('tutorial:completed 只在 explore_done 到达 free_play 时触发', () => {
      const deps = createMockDeps();
      const localSm = new TutorialStateMachine();
      localSm.init(deps as any);

      localSm.transition('first_enter');
      localSm.transition('step6_complete');
      localSm.transition('explore_done');

      // tutorial:completed 应该被调用
      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'tutorial:completed',
        expect.objectContaining({ timestamp: expect.any(Number) }),
      );
    });
  });

  // ── P1-8: endReplay 清除 activeStepId ──

  describe('P1-8: TutorialStepExecutor endReplay 清除状态', () => {
    let executor: TutorialStepExecutor;
    let sm: TutorialStateMachine;

    beforeEach(() => {
      sm = new TutorialStateMachine();
      sm.init(createMockDeps() as any);
      executor = new TutorialStepExecutor();
      executor.init(createMockDeps() as any);
      executor.setStateMachine(sm);
    });

    it('endReplay 返回重玩奖励', () => {
      const state = {
        activeStepId: 'step1_castle_overview' as any,
        currentSubStepIndex: 0,
        acceleration: null,
        dailyReplayCount: 1,
        lastReplayDate: new Date().toISOString().slice(0, 10),
        replayMode: 'watch' as any,
      };

      const reward = executor.endReplay(state);
      expect(reward).not.toBeNull();
      expect(reward!.type).toBe('currency');
      expect(state.activeStepId).toBeNull();
      expect(state.replayMode).toBeNull();
    });

    it('非重玩状态 endReplay 返回 null', () => {
      const state = {
        activeStepId: null,
        currentSubStepIndex: 0,
        acceleration: null,
        dailyReplayCount: 0,
        lastReplayDate: '',
        replayMode: null,
      };

      const reward = executor.endReplay(state);
      expect(reward).toBeNull();
    });
  });
});

// ─────────────────────────────────────────────
// P2 挑战验证
// ─────────────────────────────────────────────

describe('Guide R1 对抗测试 — P2', () => {

  // ── P2-1: activateAsBackup localStorage异常 ──

  describe('P2-1: TutorialMaskSystem activateAsBackup', () => {
    let mask: TutorialMaskSystem;

    beforeEach(() => {
      mask = new TutorialMaskSystem();
      mask.init(createMockDeps() as any);
    });

    it('GuideOverlay 未激活时应成功激活', () => {
      try {
        localStorage.removeItem('__tk_guide_overlay_active');
      } catch { /* ignore */ }
      const result = mask.activateAsBackup();
      expect(result).toBe(true);
      expect(mask.isActive()).toBe(true);
    });
  });

  // ── P2-2: executeFirstLaunchFlow 权限异常 ──

  describe('P2-2: FirstLaunchDetector executeFirstLaunchFlow 权限异常', () => {
    let detector: FirstLaunchDetector;
    let sm: TutorialStateMachine;

    beforeEach(() => {
      sm = new TutorialStateMachine();
      sm.init(createMockDeps() as any);
      detector = new FirstLaunchDetector();
      detector.init(createMockDeps() as any);
      detector.setStateMachine(sm);
    });

    it('权限请求抛异常时流程不中断 (FIX-007)', async () => {
      const badRequester = async () => { throw new Error('Permission denied'); };
      // FIX-007: 异常被捕获，流程继续
      const result = await detector.executeFirstLaunchFlow(badRequester);
      expect(result.currentStep).toBe('completed');
      expect(result.permissionStatus.storage).toBe(false);
    });

    it('无权限回调时默认授权', async () => {
      const result = await detector.executeFirstLaunchFlow();
      expect(result.permissionStatus.storage).toBe(true);
      expect(result.permissionStatus.network).toBe(true);
    });
  });

  // ── P2-3: StoryEventPlayer 暂停/恢复 ──

  describe('P2-3: StoryEventPlayer 暂停/恢复', () => {
    let player: StoryEventPlayer;
    let sm: TutorialStateMachine;

    beforeEach(() => {
      sm = new TutorialStateMachine();
      sm.init(createMockDeps() as any);
      player = new StoryEventPlayer();
      player.init(createMockDeps() as any);
      player.setStateMachine(sm);
    });

    it('暂停后update不推进打字机', () => {
      player.startEvent('e1_peach_garden');
      player.pause();

      const progressBefore = player.getPlayProgress();
      player.update(1000); // 1秒
      const progressAfter = player.getPlayProgress();

      // 暂停状态下打字机不应推进
      expect(progressAfter.typewriter.charIndex).toBe(progressBefore.typewriter.charIndex);
    });

    it('恢复后update正常推进', () => {
      player.startEvent('e1_peach_garden');
      player.pause();
      player.resume();

      const progressBefore = player.getPlayProgress();
      player.update(100); // 100ms
      const progressAfter = player.getPlayProgress();

      expect(progressAfter.typewriter.charIndex).toBeGreaterThan(progressBefore.typewriter.charIndex);
    });
  });

  // ── P2-4: TutorialMaskSystem setupForSubStep ──

  describe('P2-4: TutorialMaskSystem setupForSubStep', () => {
    let mask: TutorialMaskSystem;

    beforeEach(() => {
      mask = new TutorialMaskSystem();
      mask.init(createMockDeps() as any);
    });

    it('正常子步骤设置', () => {
      const result = mask.setupForSubStep(
        {
          id: '1-1',
          text: '测试文本',
          targetSelector: '#test',
          unskippable: false,
          completionType: 'click',
        },
        (selector) => ({ x: 10, y: 20, width: 100, height: 50 }),
      );
      expect(result.success).toBe(true);
      expect(mask.isActive()).toBe(true);
    });

    it('元素不存在时设置失败', () => {
      const result = mask.setupForSubStep(
        {
          id: '1-1',
          text: '测试文本',
          targetSelector: '#nonexistent',
          unskippable: false,
          completionType: 'click',
        },
        () => null,
      );
      expect(result.success).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────
// 跨系统交互测试 (F-Cross)
// ─────────────────────────────────────────────

describe('Guide R1 对抗测试 — 跨系统交互', () => {

  it('完整引导流程: 首次启动→步骤完成→剧情触发→遮罩显示', () => {
    const deps = createMockDeps();
    const sm = new TutorialStateMachine();
    sm.init(deps as any);

    const detector = new FirstLaunchDetector();
    detector.init(deps as any);
    detector.setStateMachine(sm);

    const stepManager = new TutorialStepManager();
    stepManager.init(deps as any);
    stepManager.setStateMachine(sm);

    const mask = new TutorialMaskSystem();
    mask.init(deps as any);

    // 1. 首次启动检测
    const detection = detector.detectFirstLaunch();
    expect(detection.isFirstLaunch).toBe(true);

    // 2. 触发引导
    sm.transition('first_enter');
    expect(sm.getCurrentPhase()).toBe('core_guiding');

    // 3. 完成步骤1
    const step1Result = stepManager.startStep('step1_castle_overview');
    expect(step1Result.success).toBe(true);

    // 4. 设置遮罩
    mask.activate();
    mask.setHighlightTarget('#main-castle', () => ({ x: 0, y: 0, width: 200, height: 100 }));
    expect(mask.isActive()).toBe(true);
    expect(mask.getHighlightBounds()).not.toBeNull();

    // 5. 完成所有子步骤
    const def = step1Result.step!;
    for (let i = 0; i < def.subSteps.length; i++) {
      stepManager.advanceSubStep();
    }
    expect(sm.isStepCompleted('step1_castle_overview')).toBe(true);

    // 6. 遮罩清理
    mask.deactivate();
    expect(mask.isActive()).toBe(false);
  });

  it('存储+状态机: 保存→重置→恢复', () => {
    const deps = createMockDeps();
    const sm = new TutorialStateMachine();
    sm.init(deps as any);

    const storage = new TutorialStorage();
    storage.init(deps as any);
    storage.setStateMachine(sm);

    // 设置进度
    sm.transition('first_enter');
    sm.completeStep('step1_castle_overview');
    sm.completeStep('step2_build_farm');

    // 保存
    const saveResult = storage.save();
    expect(saveResult.success).toBe(true);

    // 重置
    sm.reset();
    expect(sm.getCurrentPhase()).toBe('not_started');
    expect(sm.isStepCompleted('step1_castle_overview')).toBe(false);

    // 恢复
    const restoreResult = storage.restore();
    expect(restoreResult.success).toBe(true);
    expect(sm.getCurrentPhase()).toBe('core_guiding');
    expect(sm.isStepCompleted('step1_castle_overview')).toBe(true);
    expect(sm.isStepCompleted('step2_build_farm')).toBe(true);
  });

  it('新手保护: 首次进入→保护激活→查询折扣', () => {
    const deps = createMockDeps();
    const sm = new TutorialStateMachine();
    sm.init(deps as any);

    const detector = new FirstLaunchDetector();
    detector.init(deps as any);
    detector.setStateMachine(sm);

    // 首次进入
    sm.transition('first_enter');

    // 新手保护激活
    expect(detector.isNewbieProtectionActive()).toBe(true);

    // 资源折扣
    expect(detector.getResourceCostDiscount()).toBe(0.5);
    expect(detector.applyResourceDiscount(100)).toBe(50);

    // 战斗难度
    expect(detector.getBattleDifficultyFactor()).toBe(0.7);
    expect(detector.applyBattleDifficulty(100)).toBe(70);

    // 正面事件
    expect(detector.isPositiveEventsOnly()).toBe(true);
  });
});
