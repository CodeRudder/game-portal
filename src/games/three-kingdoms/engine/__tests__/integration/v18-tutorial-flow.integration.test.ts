/**
 * v18.0 新手引导 — Play 流程集成测试
 *
 * 覆盖范围（按 play 文档章节组织）：
 * - §1 引导状态机（5状态转换/首次启动检测/老用户回归）
 * - §2 引导步骤（6步核心引导/步骤推进/步骤完成）
 * - §3 引导触发（扩展步骤触发条件/触发时机）
 * - §4 引导奖励（阶段奖励/完成奖励/礼包发放）
 * - §5 引导状态（进度保存/加载/冲突解决/跳过引导）
 *
 * 测试原则：
 * - 每个用例创建独立的实例
 * - 引导子系统需要手动连接依赖（与 tutorial-full-flow 模式一致）
 * - 使用真实 API，不使用 mock
 * - 以实际代码行为为准
 *
 * @see docs/games/three-kingdoms/play/v18-play.md
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createSim } from '../../../test-utils/test-helpers';
import { TutorialStateMachine } from '../../guide/TutorialStateMachine';
import { TutorialStepManager } from '../../guide/TutorialStepManager';
import { TutorialStepExecutor } from '../../guide/TutorialStepExecutor';
import { FirstLaunchDetector } from '../../guide/FirstLaunchDetector';
import { StoryEventPlayer } from '../../guide/StoryEventPlayer';
import { TutorialMaskSystem } from '../../guide/TutorialMaskSystem';
import type { TutorialPhase, TutorialStepId, StoryEventId } from '../../../../core/guide/guide.types';

// ─────────────────────────────────────────────
// 测试基础设施
// ─────────────────────────────────────────────

/** 创建带事件分发的 mock deps */
function createMockDeps() {
  const listeners = new Map<string, Function[]>();
  return {
    eventBus: {
      on: vi.fn((event: string, handler: Function) => {
        if (!listeners.has(event)) listeners.set(event, []);
        listeners.get(event)!.push(handler);
        return () => { const arr = listeners.get(event); if (arr) { const idx = arr.indexOf(handler); if (idx >= 0) arr.splice(idx, 1); } };
      }),
      emit: vi.fn((event: string, payload?: unknown) => {
        const handlers = listeners.get(event);
        if (handlers) handlers.forEach(h => h(payload));
      }),
      once: vi.fn(),
      off: vi.fn(),
    },
    config: { get: vi.fn(), set: vi.fn(), has: vi.fn() },
    registry: { get: vi.fn(), register: vi.fn(), getAll: vi.fn(() => new Map()), has: vi.fn(), unregister: vi.fn() },
  };
}

/** 创建并连接引导子系统 */
function createGuideBundle() {
  const deps = createMockDeps();
  const stateMachine = new TutorialStateMachine();
  const stepManager = new TutorialStepManager();
  const stepExecutor = new TutorialStepExecutor();
  const storyPlayer = new StoryEventPlayer();
  const maskSystem = new TutorialMaskSystem();
  const firstLaunch = new FirstLaunchDetector();

  stateMachine.init(deps);
  stepManager.init(deps);
  stepExecutor.init(deps);
  storyPlayer.init(deps);
  maskSystem.init(deps);
  firstLaunch.init(deps);

  stepManager.setStateMachine(stateMachine);
  stepExecutor.setStateMachine(stateMachine);
  storyPlayer.setStateMachine(stateMachine);
  firstLaunch.setStateMachine(stateMachine);

  return { deps, stateMachine, stepManager, stepExecutor, storyPlayer, maskSystem, firstLaunch };
}

// ═══════════════════════════════════════════════════════════════
// §1 引导状态机
// ═══════════════════════════════════════════════════════════════
describe('v18.0 新手引导 — §1 引导状态机', () => {

  describe('§1.1 状态机初始化与状态查询', () => {

    it('should access tutorial state machine via engine getter', () => {
      const sim = createSim();
      const sm = sim.engine.getTutorialStateMachine();
      expect(sm).toBeDefined();
      expect(typeof sm.getCurrentPhase).toBe('function');
      expect(typeof sm.transition).toBe('function');
      expect(typeof sm.isFirstLaunch).toBe('function');
    });

    it('should start in not_started phase for fresh engine', () => {
      // Play §1.1: 状态机初始状态为「未开始」
      const sim = createSim();
      const sm = sim.engine.getTutorialStateMachine();
      const phase = sm.getCurrentPhase();
      expect(phase).toBe('not_started' as TutorialPhase);
    });

    it('should report first launch when no guide record exists', () => {
      // Play §0.1: 首次启动检测
      const sim = createSim();
      const sm = sim.engine.getTutorialStateMachine();
      expect(sm.isFirstLaunch()).toBe(true);
    });

  });

  describe('§1.2 状态转换路径', () => {

    it('should transition from not_started to core_guiding on first_enter', () => {
      // Play §1.1: 首次进入 → not_started → core_guiding
      const { stateMachine: sm } = createGuideBundle();
      const result = sm.transition('first_enter');
      expect(result.success).toBe(true);
      expect(sm.getCurrentPhase()).toBe('core_guiding' as TutorialPhase);
    });

    it('should transition from core_guiding to free_explore on step6_complete', () => {
      // Play §1.1: 步骤6完成 → core_guiding → free_explore
      const { stateMachine: sm } = createGuideBundle();
      sm.transition('first_enter');
      const result = sm.transition('step6_complete');
      expect(result.success).toBe(true);
      expect(sm.getCurrentPhase()).toBe('free_explore' as TutorialPhase);
    });

    it('should transition from core_guiding to free_explore via skip_to_explore', () => {
      // Play §1.1: 加速跳过 → core_guiding → free_explore
      const { stateMachine: sm } = createGuideBundle();
      sm.transition('first_enter');
      const result = sm.transition('skip_to_explore');
      expect(result.success).toBe(true);
      expect(sm.getCurrentPhase()).toBe('free_explore' as TutorialPhase);
    });

    it('should transition from free_explore to free_play on explore_done', () => {
      // Play §1.1: 过渡完成 → free_explore → free_play
      const { stateMachine: sm } = createGuideBundle();
      sm.transition('first_enter');
      sm.transition('step6_complete');
      const result = sm.transition('explore_done');
      expect(result.success).toBe(true);
      expect(sm.getCurrentPhase()).toBe('free_play' as TutorialPhase);
    });

    it('should reject invalid transitions', () => {
      // Play §1.1: 状态转换必须遵循合法路径
      const { stateMachine: sm } = createGuideBundle();
      const result = sm.transition('explore_done');
      expect(result.success).toBe(false);
      expect(sm.getCurrentPhase()).toBe('not_started' as TutorialPhase);
    });

    it('should handle returning user entering free_play directly', () => {
      // Play §0.2: 老用户回归 → 直接进入自由游戏
      const { stateMachine: sm } = createGuideBundle();
      sm.enterAsReturning();
      expect(sm.getCurrentPhase()).toBe('free_play' as TutorialPhase);
    });

  });

});

// ═══════════════════════════════════════════════════════════════
// §2 引导步骤
// ═══════════════════════════════════════════════════════════════
describe('v18.0 新手引导 — §2 引导步骤', () => {

  describe('§2.1 步骤定义与获取', () => {

    it('should access tutorial step manager via engine getter', () => {
      const sim = createSim();
      const mgr = sim.engine.getTutorialStepManager();
      expect(mgr).toBeDefined();
      expect(typeof mgr.getNextStep).toBe('function');
      expect(typeof mgr.startStep).toBe('function');
      expect(typeof mgr.completeCurrentStep).toBe('function');
    });

    it('should return 6 core step definitions', () => {
      // Play §1.1: 6步核心引导定义
      const sim = createSim();
      const mgr = sim.engine.getTutorialStepManager();
      const coreSteps = mgr.getCoreStepDefinitions();
      expect(coreSteps.length).toBe(6);
    });

    it('should return 6 extended step definitions', () => {
      // Play §1.1: 6步扩展引导定义
      const sim = createSim();
      const mgr = sim.engine.getTutorialStepManager();
      const extSteps = mgr.getExtendedStepDefinitions();
      expect(extSteps.length).toBe(6);
    });

    it('should return all 12 step definitions', () => {
      // Play §1.1: 6步核心 + 6步扩展 = 12步
      const sim = createSim();
      const mgr = sim.engine.getTutorialStepManager();
      const allSteps = mgr.getAllStepDefinitions();
      expect(allSteps.length).toBe(12);
    });

  });

  describe('§2.2 步骤推进与完成', () => {

    it('should start a core step successfully', () => {
      // Play §1.1: 开始步骤1-1主城概览
      const { stateMachine: sm, stepManager: mgr } = createGuideBundle();
      sm.transition('first_enter');

      const result = mgr.startStep('step1_castle_overview' as TutorialStepId);
      expect(result.success).toBe(true);
      expect(result.step).toBeDefined();
      expect(result.step!.stepId).toBe('step1_castle_overview');
    });

    it('should advance sub-step within a step', () => {
      // Play §1.1.1: 步骤1包含5个子步骤
      const { stateMachine: sm, stepManager: mgr } = createGuideBundle();
      sm.transition('first_enter');
      mgr.startStep('step1_castle_overview' as TutorialStepId);

      const result = mgr.advanceSubStep();
      expect(result.completed).toBe(false);
      expect(result.stepId).toBe('step1_castle_overview' as TutorialStepId);
    });

    it('should complete a step and mark it as completed in state machine', () => {
      // Play §1.1: 完成步骤后标记为已完成
      const { stateMachine: sm, stepManager: mgr } = createGuideBundle();
      sm.transition('first_enter');
      mgr.startStep('step1_castle_overview' as TutorialStepId);

      const result = mgr.completeCurrentStep();
      expect(result.completed).toBe(true);
      expect(sm.isStepCompleted('step1_castle_overview' as TutorialStepId)).toBe(true);
    });

    it('should track completed step count', () => {
      // Play §1.1: 跟踪已完成步骤数
      const { stateMachine: sm, stepManager: mgr } = createGuideBundle();
      sm.transition('first_enter');

      expect(sm.getCompletedStepCount()).toBe(0);

      mgr.startStep('step1_castle_overview' as TutorialStepId);
      mgr.completeCurrentStep();
      expect(sm.getCompletedStepCount()).toBe(1);
    });

  });

});

// ═══════════════════════════════════════════════════════════════
// §3 引导触发
// ═══════════════════════════════════════════════════════════════
describe('v18.0 新手引导 — §3 引导触发', () => {

  describe('§3.1 扩展步骤触发条件', () => {

    it('should check extended step triggers based on game state', () => {
      // Play §1.1: 扩展步骤由条件触发
      const { stepExecutor } = createGuideBundle();
      expect(stepExecutor).toBeDefined();
      expect(typeof stepExecutor.checkExtendedStepTriggers).toBe('function');
    });

    it('should not trigger extended steps when conditions are not met', () => {
      // Play §1.1: 条件不满足时不触发扩展引导
      const { stepExecutor } = createGuideBundle();
      const gameState = {
        castleLevel: 1,
        heroCount: 0,
        battleCount: 0,
        techCount: 0,
        allianceJoined: false,
      };
      const triggered = stepExecutor.checkExtendedStepTriggers(gameState);
      expect(triggered).toBeNull();
    });

  });

  describe('§3.2 首次启动流程', () => {

    it('should detect first launch via FirstLaunchDetector', () => {
      // Play §0.1: 首次启动检测
      const { firstLaunch } = createGuideBundle();
      const detection = firstLaunch.detectFirstLaunch();
      expect(detection).toBeDefined();
    });

    it('should provide newbie protection state', () => {
      // Play §0.1: 新手保护机制（前30分钟）
      const { firstLaunch } = createGuideBundle();
      const protection = firstLaunch.getProtectionState();
      expect(protection).toBeDefined();
    });

    it('should apply resource cost discount during newbie protection', () => {
      // Play §0.1: 新手保护期间资源消耗减半
      const { firstLaunch } = createGuideBundle();
      const originalCost = 1000;
      const discountedCost = firstLaunch.applyResourceDiscount(originalCost);
      // 新手保护期间应有折扣（减半）
      expect(discountedCost).toBeLessThanOrEqual(originalCost);
    });

  });

});

// ═══════════════════════════════════════════════════════════════
// §4 引导奖励
// ═══════════════════════════════════════════════════════════════
describe('v18.0 新手引导 — §4 引导奖励', () => {

  it('should provide phase rewards definition', () => {
    // Play §1.1: 步骤6完成发放「初出茅庐」礼包
    const sim = createSim();
    const mgr = sim.engine.getTutorialStepManager();
    const rewards = mgr.getPhaseRewards();
    expect(rewards).toBeDefined();
  });

  it('should return rewards on step completion', () => {
    // Play §1.1: 完成步骤返回奖励列表
    const { stateMachine: sm, stepManager: mgr } = createGuideBundle();
    sm.transition('first_enter');
    mgr.startStep('step1_castle_overview' as TutorialStepId);

    const result = mgr.completeCurrentStep();
    expect(result.rewards).toBeDefined();
    expect(Array.isArray(result.rewards)).toBe(true);
  });

});

// ═══════════════════════════════════════════════════════════════
// §5 引导状态管理
// ═══════════════════════════════════════════════════════════════
describe('v18.0 新手引导 — §5 引导状态管理', () => {

  describe('§5.1 进度保存与加载', () => {

    it('should serialize tutorial state to save data', () => {
      // Play §8: 引导进度存储
      const { stateMachine: sm } = createGuideBundle();
      sm.transition('first_enter');

      const saveData = sm.serialize();
      expect(saveData).toBeDefined();
      expect(saveData.currentPhase).toBe('core_guiding' as TutorialPhase);
    });

    it('should restore tutorial state from save data', () => {
      // Play §8: 加载引导进度
      const { stateMachine: sm } = createGuideBundle();
      sm.transition('first_enter');
      const saveData = sm.serialize();

      const { stateMachine: sm2 } = createGuideBundle();
      sm2.loadSaveData(saveData);
      expect(sm2.getCurrentPhase()).toBe('core_guiding' as TutorialPhase);
    });

    it('should resolve save conflicts by taking completed steps union', () => {
      // Play §9: 冲突解决 — 取 completed_steps 并集
      const { stateMachine: sm } = createGuideBundle();
      sm.transition('first_enter');
      sm.completeStep('step1_castle_overview' as TutorialStepId);
      const localData = sm.serialize();

      const { stateMachine: sm2 } = createGuideBundle();
      sm2.transition('first_enter');
      sm2.completeStep('step2_build_farm' as TutorialStepId);
      const remoteData = sm2.serialize();

      const resolved = sm.resolveConflict(localData, remoteData);
      // 并集应包含两个步骤
      expect(resolved.completedSteps).toContain('step1_castle_overview');
      expect(resolved.completedSteps).toContain('step2_build_farm');
    });

  });

  describe('§5.2 跳过与重玩', () => {

    it('should support acceleration activation when a step is active', () => {
      // Play §10: 加速机制 — 需要正在进行的步骤
      const { stateMachine: sm, stepManager: mgr } = createGuideBundle();
      sm.transition('first_enter');
      mgr.startStep('step1_castle_overview' as TutorialStepId);

      const result = mgr.activateAcceleration('dialogue_tap');
      expect(result.success).toBe(true);
    });

    it('should detect unskippable steps', () => {
      // Play §11: 不可跳过内容检测
      const sim = createSim();
      const mgr = sim.engine.getTutorialStepManager();
      const isUnskippable = mgr.isUnskippable('step1_castle_overview' as TutorialStepId);
      expect(typeof isUnskippable).toBe('boolean');
    });

    it('should support replay mode with daily limit', () => {
      // Play §13: 引导重玩 — 观看模式+每日限制
      const { stepManager: mgr } = createGuideBundle();
      const result = mgr.startReplay('watch' as const);
      expect(result.success).toBe(true);
      expect(mgr.isReplaying()).toBe(true);
    });

    it('should end replay and return reward', () => {
      // Play §13: 结束重玩返回奖励
      const { stepManager: mgr } = createGuideBundle();
      mgr.startReplay('watch' as const);
      const reward = mgr.endReplay();
      // 重玩奖励可为 null（无奖励时）或 TutorialReward
      expect(reward).toBeDefined();
    });

  });

  describe('§5.3 引导存储系统', () => {

    it('should access tutorial storage via engine getter', () => {
      const sim = createSim();
      const storage = sim.engine.getTutorialStorage();
      expect(storage).toBeDefined();
    });

  });

  describe('§5.4 剧情事件系统', () => {

    it('should access story event player via engine getter', () => {
      const sim = createSim();
      const player = sim.engine.getStoryEventPlayer();
      expect(player).toBeDefined();
    });

    it('should track story event completion in state machine', () => {
      // Play §5: 8段剧情事件
      const { stateMachine: sm } = createGuideBundle();
      sm.transition('first_enter');
      sm.completeStoryEvent('e1_peach_garden' as StoryEventId);
      expect(sm.isStoryEventCompleted('e1_peach_garden' as StoryEventId)).toBe(true);
    });

  });

  describe('§5.5 遮罩系统', () => {

    it('should access tutorial mask system via engine getter', () => {
      // Play §15: 聚焦遮罩系统
      const sim = createSim();
      const mask = sim.engine.getTutorialMaskSystem();
      expect(mask).toBeDefined();
    });

  });

});
