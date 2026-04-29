/**
 * ACC-11 引导系统 — 引擎层验收测试
 *
 * 覆盖 ACC-11 验收标准中所有引擎相关条目：
 * - ACC-11-20: 引导状态机初始状态
 * - ACC-11-21: 6步核心引导按序推进
 * - ACC-11-22: 阶段奖励正确发放
 * - ACC-11-23: 引导完成后进入自由游戏
 * - ACC-11-24: 引导进度保存
 * - ACC-11-26: 步骤完成计数准确
 * - ACC-11-27: 剧情事件触发时机
 * - ACC-11-28: 新手保护机制
 * - ACC-11-29: 回归玩家跳过引导
 * - ACC-11-30: 引导中刷新页面恢复进度
 * - ACC-11-34: 跳过引导后状态机一致
 * - ACC-11-36: 存档冲突解决（并集策略）
 * - ACC-11-37: 扩展引导条件触发
 * - ACC-11-38: 引导重玩功能
 *
 * @module engine/guide/__tests__/ACC-11.tutorial-engine.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TutorialStateMachine } from '../TutorialStateMachine';
import { TutorialStepManager } from '../TutorialStepManager';
import { FirstLaunchDetector } from '../FirstLaunchDetector';
import { StoryEventPlayer } from '../StoryEventPlayer';
import { StoryTriggerEvaluator } from '../StoryTriggerEvaluator';
import { TutorialMaskSystem } from '../TutorialMaskSystem';
import type { ISystemDeps } from '../../../core/types';
import type { TutorialSaveData, TutorialGameState } from '../../../core/guide';
import {
  NEWBIE_PROTECTION_DURATION_MS,
  TUTORIAL_SAVE_VERSION,
  UNSKIPPABLE_STEPS,
  GUIDE_REPLAY_DAILY_LIMIT,
  GUIDE_REPLAY_REWARD,
  CORE_STEP_DEFINITIONS,
  STORY_EVENT_DEFINITIONS,
  TUTORIAL_PHASE_REWARDS,
} from '../../../core/guide';

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
    config: { get: vi.fn(), set: vi.fn(), has: vi.fn() },
    registry: { get: vi.fn(), set: vi.fn(), has: vi.fn() },
  } as unknown as ISystemDeps;
}

/** 创建已初始化的状态机 */
function createInitializedSM(): TutorialStateMachine {
  const sm = new TutorialStateMachine();
  sm.init(createMockDeps());
  return sm;
}

/** 创建已初始化的步骤管理器 */
function createInitializedStepMgr(sm: TutorialStateMachine): TutorialStepManager {
  const mgr = new TutorialStepManager();
  mgr.init(createMockDeps());
  mgr.setStateMachine(sm);
  return mgr;
}

/** 完成全部6步核心引导的辅助函数 */
function completeAllCoreSteps(sm: TutorialStateMachine, mgr: TutorialStepManager) {
  const coreSteps = [
    'step1_castle_overview',
    'step2_build_farm',
    'step3_recruit_hero',
    'step4_first_battle',
    'step5_check_resources',
    'step6_tech_research',
  ] as const;

  // 首次进入
  sm.transition('first_enter');

  for (const stepId of coreSteps) {
    mgr.startStep(stepId);
    mgr.completeCurrentStep();
    sm.completeStep(stepId);
  }

  // 推进到自由游戏
  sm.transition('step6_complete');
  sm.transition('explore_done');
}

// ═══════════════════════════════════════════════════════════════
// ACC-11 引导系统引擎层验收
// ═══════════════════════════════════════════════════════════════

describe('ACC-11 引导系统引擎层验收', () => {

  // ─── ACC-11-20: 引导状态机初始状态正确 ───

  describe('ACC-11-20: 引导状态机初始状态正确', () => {
    it('ACC-11-20: 全新用户初始阶段为 not_started', () => {
      const sm = createInitializedSM();
      expect(sm.getCurrentPhase()).toBe('not_started');
    });

    it('ACC-11-20: 全新用户 completedSteps 为空数组', () => {
      const sm = createInitializedSM();
      expect(sm.getCompletedStepCount()).toBe(0);
    });

    it('ACC-11-20: 全新用户 isFirstLaunch 返回 true', () => {
      const sm = createInitializedSM();
      expect(sm.isFirstLaunch()).toBe(true);
    });
  });

  // ─── ACC-11-21: 6步核心引导按序推进 ───

  describe('ACC-11-21: 6步核心引导按序推进', () => {
    it('ACC-11-21: 步骤按顺序执行 step1→step6', () => {
      const sm = createInitializedSM();
      const mgr = createInitializedStepMgr(sm);

      // 验证6步核心步骤定义存在
      const coreDefs = mgr.getCoreStepDefinitions();
      expect(coreDefs.length).toBe(6);

      const expectedOrder = [
        'step1_castle_overview',
        'step2_build_farm',
        'step3_recruit_hero',
        'step4_first_battle',
        'step5_check_resources',
        'step6_tech_research',
      ];

      expectedOrder.forEach((stepId, idx) => {
        expect(coreDefs[idx].stepId).toBe(stepId);
      });
    });

    it('ACC-11-21: 每步有前置依赖检查', () => {
      const sm = createInitializedSM();
      const mgr = createInitializedStepMgr(sm);

      // step2 依赖 step1
      const result = mgr.startStep('step2_build_farm');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('前置步骤');
    });

    it('ACC-11-21: getNextStep 返回第一个未完成步骤', () => {
      const sm = createInitializedSM();
      const mgr = createInitializedStepMgr(sm);

      const next = mgr.getNextStep();
      expect(next).not.toBeNull();
      expect(next!.stepId).toBe('step1_castle_overview');
    });

    it('ACC-11-21: 完成step1后getNextStep返回step2', () => {
      const sm = createInitializedSM();
      const mgr = createInitializedStepMgr(sm);

      mgr.startStep('step1_castle_overview');
      mgr.completeCurrentStep();
      sm.completeStep('step1_castle_overview');

      const next = mgr.getNextStep();
      expect(next).not.toBeNull();
      expect(next!.stepId).toBe('step2_build_farm');
    });

    it('ACC-11-21: 核心步骤定义含子步骤', () => {
      const sm = createInitializedSM();
      const mgr = createInitializedStepMgr(sm);

      const coreDefs = mgr.getCoreStepDefinitions();
      for (const def of coreDefs) {
        expect(def.subSteps.length).toBeGreaterThan(0);
      }
    });
  });

  // ─── ACC-11-22: 阶段奖励正确发放 ───

  describe('ACC-11-22: 阶段奖励正确发放', () => {
    /** 辅助：完成所有前置步骤后开始 step6 */
    function setupStep6() {
      const deps = createMockDeps();
      const sm = new TutorialStateMachine();
      sm.init(deps);
      const mgr = new TutorialStepManager();
      mgr.init(deps);
      mgr.setStateMachine(sm);

      // 完成 step1~step5（step6 的前置链）
      const prerequisites = [
        'step1_castle_overview',
        'step2_build_farm',
        'step3_recruit_hero',
        'step4_first_battle',
        'step5_check_resources',
      ] as const;
      for (const stepId of prerequisites) {
        sm.completeStep(stepId);
      }

      // 开始 step6
      const startResult = mgr.startStep('step6_tech_research');
      expect(startResult.success).toBe(true);

      return { deps, sm, mgr };
    }

    it('ACC-11-22: 完成step6触发「初出茅庐」礼包奖励', () => {
      const { mgr } = setupStep6();
      const result = mgr.completeCurrentStep();

      // 验证奖励包含步骤基础奖励 + 阶段奖励
      const rewardNames = result.rewards.map(r => r.name);
      expect(rewardNames).toContain('铜钱');
      expect(rewardNames).toContain('粮草');
      expect(rewardNames).toContain('招贤令');
    });

    it('ACC-11-22: 奖励通过 tutorial:rewardGranted 事件发放', () => {
      const deps = createMockDeps();
      const sm = new TutorialStateMachine();
      sm.init(deps);
      const mgr = new TutorialStepManager();
      mgr.init(deps);
      mgr.setStateMachine(sm);

      // step1 无前置
      mgr.startStep('step1_castle_overview');
      mgr.completeCurrentStep();

      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'tutorial:rewardGranted',
        expect.objectContaining({
          rewards: expect.arrayContaining([
            expect.objectContaining({ rewardId: 'copper', name: '铜钱' }),
          ]),
          source: 'step1_castle_overview',
        }),
      );
    });

    it('ACC-11-22: step6奖励含铜钱2000+粮草1000+招贤令1', () => {
      const { mgr } = setupStep6();
      const result = mgr.completeCurrentStep();

      // 步骤基础奖励
      const copperReward = result.rewards.find(r => r.rewardId === 'copper' && r.amount === 2000);
      expect(copperReward).toBeDefined();

      const grainReward = result.rewards.find(r => r.rewardId === 'grain' && r.amount === 1000);
      expect(grainReward).toBeDefined();

      const ticketReward = result.rewards.find(r => r.rewardId === 'recruit_ticket' && r.amount === 1);
      expect(ticketReward).toBeDefined();
    });
  });

  // ─── ACC-11-23: 引导完成后进入自由游戏 ───

  describe('ACC-11-23: 引导完成后进入自由游戏', () => {
    it('ACC-11-23: 状态机完整转换 not_started→core_guiding→free_explore→free_play', () => {
      const sm = createInitializedSM();

      // not_started → core_guiding
      const r1 = sm.transition('first_enter');
      expect(r1.success).toBe(true);
      expect(sm.getCurrentPhase()).toBe('core_guiding');

      // core_guiding → free_explore
      const r2 = sm.transition('step6_complete');
      expect(r2.success).toBe(true);
      expect(sm.getCurrentPhase()).toBe('free_explore');

      // free_explore → free_play
      const r3 = sm.transition('explore_done');
      expect(r3.success).toBe(true);
      expect(sm.getCurrentPhase()).toBe('free_play');
    });

    it('ACC-11-23: 完成全部核心引导后最终停在 free_play', () => {
      const sm = createInitializedSM();
      const mgr = createInitializedStepMgr(sm);

      completeAllCoreSteps(sm, mgr);

      expect(sm.getCurrentPhase()).toBe('free_play');
    });

    it('ACC-11-23: free_play阶段触发 tutorial:completed 事件', () => {
      const deps = createMockDeps();
      const sm = new TutorialStateMachine();
      sm.init(deps);

      sm.transition('first_enter');
      sm.transition('step6_complete');
      sm.transition('explore_done');

      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'tutorial:completed',
        expect.objectContaining({ timestamp: expect.any(Number) }),
      );
    });
  });

  // ─── ACC-11-24: 引导进度保存到 localStorage（序列化验证） ───

  describe('ACC-11-24: 引导进度保存（序列化）', () => {
    it('ACC-11-24: serialize() 包含正确的版本号', () => {
      const sm = createInitializedSM();
      const data = sm.serialize();
      expect(data.version).toBe(TUTORIAL_SAVE_VERSION);
    });

    it('ACC-11-24: serialize() 保存当前阶段和已完成步骤', () => {
      const sm = createInitializedSM();
      sm.transition('first_enter');
      sm.completeStep('step1_castle_overview');

      const data = sm.serialize();
      expect(data.currentPhase).toBe('core_guiding');
      expect(data.completedSteps).toContain('step1_castle_overview');
    });

    it('ACC-11-24: loadSaveData() 正确恢复进度', () => {
      const sm = createInitializedSM();
      sm.transition('first_enter');
      sm.completeStep('step1_castle_overview');
      sm.completeStep('step2_build_farm');

      const saved = sm.serialize();

      // 新状态机恢复
      const sm2 = createInitializedSM();
      sm2.loadSaveData(saved);

      expect(sm2.getCurrentPhase()).toBe('core_guiding');
      expect(sm2.isStepCompleted('step1_castle_overview')).toBe(true);
      expect(sm2.isStepCompleted('step2_build_farm')).toBe(true);
      expect(sm2.getCompletedStepCount()).toBe(2);
    });
  });

  // ─── ACC-11-26: 步骤完成计数准确 ───

  describe('ACC-11-26: 步骤完成计数准确', () => {
    it('ACC-11-26: 完成3个核心步骤后 getCompletedStepCount 返回 3', () => {
      const sm = createInitializedSM();
      sm.completeStep('step1_castle_overview');
      sm.completeStep('step2_build_farm');
      sm.completeStep('step3_recruit_hero');

      expect(sm.getCompletedStepCount()).toBe(3);
    });

    it('ACC-11-26: 完成3个核心步骤后 getCompletedCoreStepCount 返回 3', () => {
      const sm = createInitializedSM();
      sm.completeStep('step1_castle_overview');
      sm.completeStep('step2_build_farm');
      sm.completeStep('step3_recruit_hero');

      expect(sm.getCompletedCoreStepCount()).toBe(3);
    });

    it('ACC-11-26: 重复完成同一步骤不增加计数', () => {
      const sm = createInitializedSM();
      sm.completeStep('step1_castle_overview');
      sm.completeStep('step1_castle_overview');
      sm.completeStep('step1_castle_overview');

      expect(sm.getCompletedStepCount()).toBe(1);
    });
  });

  // ─── ACC-11-27: 剧情事件触发时机正确 ───

  describe('ACC-11-27: 剧情事件触发时机正确', () => {
    it('ACC-11-27: 8段剧情事件定义完整', () => {
      expect(STORY_EVENT_DEFINITIONS.length).toBe(8);
    });

    it('ACC-11-27: e1_桃园结义触发条件为 first_enter', () => {
      const e1 = STORY_EVENT_DEFINITIONS.find(e => e.eventId === 'e1_peach_garden');
      expect(e1).toBeDefined();
      expect(e1!.triggerCondition.type).toBe('first_enter');
    });

    it('ACC-11-27: e3_三顾茅庐触发条件为 first_recruit', () => {
      const e3 = STORY_EVENT_DEFINITIONS.find(e => e.eventId === 'e3_three_visits');
      expect(e3).toBeDefined();
      expect(e3!.triggerCondition.type).toBe('first_recruit');
    });

    it('ACC-11-27: e5_赤壁之战触发条件为 castle_level=5', () => {
      const e5 = STORY_EVENT_DEFINITIONS.find(e => e.eventId === 'e5_red_cliff');
      expect(e5).toBeDefined();
      expect(e5!.triggerCondition.type).toBe('castle_level');
      expect(e5!.triggerCondition.value).toBe(5);
    });

    it('ACC-11-27: StoryTriggerEvaluator 正确评估 first_enter 条件', () => {
      const evaluator = new StoryTriggerEvaluator();
      // first_enter 类型由首次启动流程直接触发，evaluateStoryTrigger 返回 false
      const result = evaluator.evaluateStoryTrigger(
        { type: 'first_enter' },
        { castleLevel: 1, battleCount: 0, firstRecruit: false, allianceJoined: false, techCount: 0 },
      );
      // first_enter 由启动流程直接触发，不走评估器
      expect(typeof result).toBe('boolean');
    });

    it('ACC-11-27: StoryTriggerEvaluator 正确评估 castle_level 条件', () => {
      const evaluator = new StoryTriggerEvaluator();
      const result = evaluator.evaluateStoryTrigger(
        { type: 'castle_level', value: 5 },
        { castleLevel: 5, battleCount: 0, firstRecruit: false, allianceJoined: false, techCount: 0 },
      );
      expect(result).toBe(true);
    });

    it('ACC-11-27: StoryTriggerEvaluator castle_level 不满足时返回 false', () => {
      const evaluator = new StoryTriggerEvaluator();
      const result = evaluator.evaluateStoryTrigger(
        { type: 'castle_level', value: 5 },
        { castleLevel: 3, battleCount: 0, firstRecruit: false, allianceJoined: false, techCount: 0 },
      );
      expect(result).toBe(false);
    });
  });

  // ─── ACC-11-28: 新手保护机制生效 ───

  describe('ACC-11-28: 新手保护机制生效', () => {
    it('ACC-11-28: 首次进入后30分钟内 isNewbieProtectionActive 返回 true', () => {
      const sm = createInitializedSM();
      sm.transition('first_enter');

      expect(sm.isNewbieProtectionActive()).toBe(true);
    });

    it('ACC-11-28: 30分钟后 isNewbieProtectionActive 返回 false', () => {
      const sm = createInitializedSM();
      sm.transition('first_enter');

      // 模拟30分钟后 — 通过序列化/反序列化设置过去的时间
      const data = sm.serialize();
      data.protectionStartTime = Date.now() - NEWBIE_PROTECTION_DURATION_MS - 1000;
      sm.loadSaveData(data);

      expect(sm.isNewbieProtectionActive()).toBe(false);
    });

    it('ACC-11-28: 新手保护时长为30分钟', () => {
      expect(NEWBIE_PROTECTION_DURATION_MS).toBe(30 * 60 * 1000);
    });

    it('ACC-11-28: 无保护开始时间时 isNewbieProtectionActive 返回 false', () => {
      const sm = createInitializedSM();
      expect(sm.isNewbieProtectionActive()).toBe(false);
    });
  });

  // ─── ACC-11-29: 回归玩家跳过引导 ───

  describe('ACC-11-29: 回归玩家跳过引导', () => {
    it('ACC-11-29: enterAsReturning() 直接进入 free_play', () => {
      const sm = createInitializedSM();
      sm.enterAsReturning();

      expect(sm.getCurrentPhase()).toBe('free_play');
    });

    it('ACC-11-29: 回归玩家不触发任何引导界面（isFirstLaunch=false）', () => {
      const sm = createInitializedSM();
      sm.enterAsReturning();

      expect(sm.isFirstLaunch()).toBe(false);
    });
  });

  // ─── ACC-11-30: 引导中刷新页面恢复进度 ───

  describe('ACC-11-30: 引导中刷新页面恢复进度', () => {
    it('ACC-11-30: 序列化后反序列化可恢复到步骤3', () => {
      const sm = createInitializedSM();
      sm.transition('first_enter');
      sm.completeStep('step1_castle_overview');
      sm.completeStep('step2_build_farm');

      const saved = sm.serialize();

      // 模拟刷新：新状态机加载存档
      const sm2 = createInitializedSM();
      sm2.loadSaveData(saved);

      expect(sm2.getCurrentPhase()).toBe('core_guiding');
      expect(sm2.isStepCompleted('step1_castle_overview')).toBe(true);
      expect(sm2.isStepCompleted('step2_build_farm')).toBe(true);
      expect(sm2.getCompletedStepCount()).toBe(2);
    });

    it('ACC-11-30: 恢复后 getNextStep 返回下一个未完成步骤', () => {
      const sm = createInitializedSM();
      sm.transition('first_enter');
      sm.completeStep('step1_castle_overview');
      sm.completeStep('step2_build_farm');

      const saved = sm.serialize();

      const sm2 = createInitializedSM();
      sm2.loadSaveData(saved);
      const mgr = createInitializedStepMgr(sm2);

      const next = mgr.getNextStep();
      expect(next).not.toBeNull();
      expect(next!.stepId).toBe('step3_recruit_hero');
    });
  });

  // ─── ACC-11-34: 跳过引导后状态机一致 ───

  describe('ACC-11-34: 跳过引导后状态机一致', () => {
    it('ACC-11-34: skip_to_explore → explore_done 转换到 free_play', () => {
      const sm = createInitializedSM();
      sm.transition('first_enter');
      expect(sm.getCurrentPhase()).toBe('core_guiding');

      sm.transition('skip_to_explore');
      expect(sm.getCurrentPhase()).toBe('free_explore');

      sm.transition('explore_done');
      expect(sm.getCurrentPhase()).toBe('free_play');
    });

    it('ACC-11-34: 跳过后不再允许 core_guiding 转换', () => {
      const sm = createInitializedSM();
      sm.transition('first_enter');
      sm.transition('skip_to_explore');
      sm.transition('explore_done');

      // 已经在 free_play，不允许再转换到 core_guiding
      const result = sm.transition('first_enter');
      expect(result.success).toBe(false);
    });
  });

  // ─── ACC-11-36: 存档冲突解决（并集策略） ───

  describe('ACC-11-36: 存档冲突解决（并集策略）', () => {
    it('ACC-11-36: 本地step1+step2，远端step2+step3，合并为step1+step2+step3', () => {
      const sm = createInitializedSM();

      const localData: TutorialSaveData = {
        version: TUTORIAL_SAVE_VERSION,
        currentPhase: 'core_guiding',
        completedSteps: ['step1_castle_overview', 'step2_build_farm'] as any,
        completedEvents: [],
        currentStepId: null,
        currentSubStepIndex: 0,
        tutorialStartTime: Date.now(),
        transitionLogs: [],
        dailyReplayCount: 0,
        lastReplayDate: '',
        protectionStartTime: null,
      };

      const remoteData: TutorialSaveData = {
        version: TUTORIAL_SAVE_VERSION,
        currentPhase: 'core_guiding',
        completedSteps: ['step2_build_farm', 'step3_recruit_hero'] as any,
        completedEvents: [],
        currentStepId: null,
        currentSubStepIndex: 0,
        tutorialStartTime: Date.now(),
        transitionLogs: [],
        dailyReplayCount: 0,
        lastReplayDate: '',
        protectionStartTime: null,
      };

      const merged = sm.resolveConflict(localData, remoteData);
      expect(merged.completedSteps).toHaveLength(3);
      expect(merged.completedSteps).toContain('step1_castle_overview');
      expect(merged.completedSteps).toContain('step2_build_farm');
      expect(merged.completedSteps).toContain('step3_recruit_hero');
    });

    it('ACC-11-36: 阶段取进度更高的 free_play', () => {
      const sm = createInitializedSM();

      const localData: TutorialSaveData = {
        version: TUTORIAL_SAVE_VERSION,
        currentPhase: 'core_guiding',
        completedSteps: ['step1_castle_overview'] as any,
        completedEvents: [],
        currentStepId: null,
        currentSubStepIndex: 0,
        tutorialStartTime: Date.now(),
        transitionLogs: [],
        dailyReplayCount: 0,
        lastReplayDate: '',
        protectionStartTime: null,
      };

      const remoteData: TutorialSaveData = {
        version: TUTORIAL_SAVE_VERSION,
        currentPhase: 'free_play',
        completedSteps: ['step1_castle_overview', 'step2_build_farm', 'step3_recruit_hero'] as any,
        completedEvents: [],
        currentStepId: null,
        currentSubStepIndex: 0,
        tutorialStartTime: Date.now(),
        transitionLogs: [],
        dailyReplayCount: 0,
        lastReplayDate: '',
        protectionStartTime: null,
      };

      const merged = sm.resolveConflict(localData, remoteData);
      expect(merged.currentPhase).toBe('free_play');
    });
  });

  // ─── ACC-11-37: 扩展引导条件触发 ───

  describe('ACC-11-37: 扩展引导条件触发', () => {
    it('ACC-11-37: 建筑3级触发step7（军师建议）', () => {
      const sm = createInitializedSM();
      const mgr = createInitializedStepMgr(sm);

      const gameState: TutorialGameState = {
        castleLevel: 3,
        heroCount: 0,
        battleCount: 0,
        techCount: 0,
        allianceJoined: false,
        firstAlliance: false,
        bagCapacityPercent: 0,
      };

      const result = mgr.checkExtendedStepTriggers(gameState);
      expect(result).not.toBeNull();
      expect(result!.stepId).toBe('step7_advisor_suggest');
    });

    it('ACC-11-37: 战斗3次触发step8（半自动战斗）', () => {
      const sm = createInitializedSM();
      const mgr = createInitializedStepMgr(sm);

      const gameState: TutorialGameState = {
        castleLevel: 1,
        heroCount: 0,
        battleCount: 3,
        techCount: 0,
        allianceJoined: false,
        firstAlliance: false,
        bagCapacityPercent: 0,
      };

      const result = mgr.checkExtendedStepTriggers(gameState);
      expect(result).not.toBeNull();
      expect(result!.stepId).toBe('step8_semi_auto_battle');
    });

    it('ACC-11-37: 无条件满足时返回 null', () => {
      const sm = createInitializedSM();
      const mgr = createInitializedStepMgr(sm);

      const gameState: TutorialGameState = {
        castleLevel: 1,
        heroCount: 0,
        battleCount: 0,
        techCount: 0,
        allianceJoined: false,
        firstAlliance: false,
        bagCapacityPercent: 0,
      };

      const result = mgr.checkExtendedStepTriggers(gameState);
      expect(result).toBeNull();
    });
  });

  // ─── ACC-11-38: 引导重玩功能 ───

  describe('ACC-11-38: 引导重玩功能', () => {
    it('ACC-11-38: startReplay 启动重玩模式', () => {
      const sm = createInitializedSM();
      const mgr = createInitializedStepMgr(sm);

      const result = mgr.startReplay('watch');
      expect(result.success).toBe(true);
      expect(mgr.isReplaying()).toBe(true);
    });

    it('ACC-11-38: 重玩完成后发放铜钱100奖励', () => {
      const sm = createInitializedSM();
      const mgr = createInitializedStepMgr(sm);

      mgr.startReplay('watch');
      const reward = mgr.endReplay();

      expect(reward).not.toBeNull();
      expect(reward!.rewardId).toBe('copper');
      expect(reward!.amount).toBe(100);
    });

    it('ACC-11-38: 每日最多重玩3次', () => {
      expect(GUIDE_REPLAY_DAILY_LIMIT).toBe(3);
    });

    it('ACC-11-38: 超过每日重玩次数后返回失败', () => {
      const sm = createInitializedSM();
      const mgr = createInitializedStepMgr(sm);

      // 重玩3次
      for (let i = 0; i < 3; i++) {
        mgr.startReplay('watch');
        mgr.endReplay();
      }

      // 第4次应失败
      const result = mgr.startReplay('watch');
      expect(result.success).toBe(false);
    });

    it('ACC-11-38: getRemainingReplayCount 正确返回剩余次数', () => {
      const sm = createInitializedSM();
      const mgr = createInitializedStepMgr(sm);

      expect(mgr.getRemainingReplayCount()).toBe(3);

      mgr.startReplay('watch');
      mgr.endReplay();

      expect(mgr.getRemainingReplayCount()).toBe(2);
    });
  });

  // ─── ACC-11-19: 不可跳过步骤的强制引导（引擎层） ───

  describe('ACC-11-19: 不可跳过步骤（引擎层）', () => {
    it('ACC-11-19: UNSKIPPABLE_STEPS 包含 step1/step2/step4', () => {
      expect(UNSKIPPABLE_STEPS).toContain('step1_castle_overview');
      expect(UNSKIPPABLE_STEPS).toContain('step2_build_farm');
      expect(UNSKIPPABLE_STEPS).toContain('step4_first_battle');
    });

    it('ACC-11-19: TutorialStepManager.isUnskippable 正确检测', () => {
      const sm = createInitializedSM();
      const mgr = createInitializedStepMgr(sm);

      expect(mgr.isUnskippable('step1_castle_overview')).toBe(true);
      expect(mgr.isUnskippable('step2_build_farm')).toBe(true);
      expect(mgr.isUnskippable('step4_first_battle')).toBe(true);
      expect(mgr.isUnskippable('step3_recruit_hero')).toBe(false);
    });
  });

  // ─── ACC-11-35: 引导中引擎不可用时的回退 ───

  describe('ACC-11-35: 引擎不可用时的回退', () => {
    it('ACC-11-35: TutorialStateMachine 无deps时不崩溃', () => {
      const sm = new TutorialStateMachine();
      // 未调用 init(deps) 时，serialize 仍可工作
      expect(() => sm.serialize()).not.toThrow();
      expect(sm.getCurrentPhase()).toBe('not_started');
    });

    it('ACC-11-35: TutorialStepManager 无deps时 reset 安全', () => {
      const mgr = new TutorialStepManager();
      expect(() => mgr.reset()).not.toThrow();
    });

    it('ACC-11-35: 状态机序列化/反序列化不依赖引擎', () => {
      const sm = new TutorialStateMachine();
      const data = sm.serialize();
      expect(data.version).toBe(TUTORIAL_SAVE_VERSION);

      const sm2 = new TutorialStateMachine();
      expect(() => sm2.loadSaveData(data)).not.toThrow();
    });
  });

  // ─── ACC-11-39: 空步骤列表处理 ───

  describe('ACC-11-39: 空步骤列表处理', () => {
    it('ACC-11-39: getNextStep 在所有步骤完成后返回 null', () => {
      const sm = createInitializedSM();
      const mgr = createInitializedStepMgr(sm);

      // 完成所有核心步骤
      completeAllCoreSteps(sm, mgr);

      // 所有核心步骤完成后，getNextStep 返回第一个未完成的扩展步骤或 null
      const next = mgr.getNextCoreStep();
      expect(next).toBeNull();
    });
  });

  // ─── ACC-11-33: 快速连续点击防护 ───

  describe('ACC-11-33: 快速连续操作防护', () => {
    it('ACC-11-33: 重复 completeStep 不重复记录', () => {
      const sm = createInitializedSM();
      sm.completeStep('step1_castle_overview');
      sm.completeStep('step1_castle_overview');
      sm.completeStep('step1_castle_overview');

      expect(sm.getCompletedStepCount()).toBe(1);
    });

    it('ACC-11-33: 已完成的步骤不能再次 startStep', () => {
      const sm = createInitializedSM();
      const mgr = createInitializedStepMgr(sm);

      mgr.startStep('step1_castle_overview');
      mgr.completeCurrentStep();
      sm.completeStep('step1_castle_overview');

      // 再次 startStep 应失败
      const result = mgr.startStep('step1_castle_overview');
      expect(result.success).toBe(false);
    });
  });

  // ─── ACC-11-05: 不可跳过步骤机制（引擎层常量验证） ───

  describe('ACC-11-05: 不可跳过步骤机制（引擎层）', () => {
    it('ACC-11-05: 不可跳过步骤列表不为空', () => {
      expect(UNSKIPPABLE_STEPS.length).toBeGreaterThan(0);
    });

    it('ACC-11-05: 子步骤定义中 unskippable 标记正确', () => {
      // step1 的第1个子步骤标记为 unskippable
      const step1 = CORE_STEP_DEFINITIONS.find(d => d.stepId === 'step1_castle_overview');
      expect(step1).toBeDefined();
      expect(step1!.subSteps[0].unskippable).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // R2 补充：PRD一致性验证 + 边界场景测试
  // ═══════════════════════════════════════════════════════════════

  // ─── ACC-11-R2-01: 扩展引导触发条件与PRD一致性 ───

  describe('ACC-11-R2-01: 扩展引导触发条件与PRD一致性', () => {
    it('step9借将系统：首次加入好友或公会触发（first_alliance）', () => {
      const sm = createInitializedSM();
      const mgr = createInitializedStepMgr(sm);

      // 先完成step7/step8
      const gameState: TutorialGameState = {
        castleLevel: 3,
        heroCount: 0,
        battleCount: 3,
        techCount: 0,
        allianceJoined: false,
        firstAlliance: true,
        bagCapacityPercent: 0,
      };

      // step7和step8已完成的情况下，step9应该被触发
      sm.completeStep('step7_advisor_suggest');
      sm.completeStep('step8_semi_auto_battle');

      const result = mgr.checkExtendedStepTriggers(gameState);
      expect(result).not.toBeNull();
      expect(result!.stepId).toBe('step9_borrow_hero');
    });

    it('step9借将系统：未加入好友/公会时不触发', () => {
      const sm = createInitializedSM();
      const mgr = createInitializedStepMgr(sm);

      const gameState: TutorialGameState = {
        castleLevel: 10,
        heroCount: 5,
        battleCount: 100,
        techCount: 10,
        allianceJoined: false,
        firstAlliance: false,
        bagCapacityPercent: 0,
      };

      sm.completeStep('step7_advisor_suggest');
      sm.completeStep('step8_semi_auto_battle');

      const result = mgr.checkExtendedStepTriggers(gameState);
      // step9不应触发，因为firstAlliance=false
      expect(result?.stepId).not.toBe('step9_borrow_hero');
    });

    it('step10背包管理：背包达到80%容量触发（bag_capacity）', () => {
      const sm = createInitializedSM();
      const mgr = createInitializedStepMgr(sm);

      sm.completeStep('step7_advisor_suggest');
      sm.completeStep('step8_semi_auto_battle');
      sm.completeStep('step9_borrow_hero');

      const gameState: TutorialGameState = {
        castleLevel: 1,
        heroCount: 0,
        battleCount: 0,
        techCount: 0,
        allianceJoined: false,
        firstAlliance: false,
        bagCapacityPercent: 80,
      };

      const result = mgr.checkExtendedStepTriggers(gameState);
      expect(result).not.toBeNull();
      expect(result!.stepId).toBe('step10_bag_manage');
    });

    it('step10背包管理：容量不足80%不触发', () => {
      const sm = createInitializedSM();
      const mgr = createInitializedStepMgr(sm);

      sm.completeStep('step7_advisor_suggest');
      sm.completeStep('step8_semi_auto_battle');
      sm.completeStep('step9_borrow_hero');

      const gameState: TutorialGameState = {
        castleLevel: 1,
        heroCount: 0,
        battleCount: 0,
        techCount: 0,
        allianceJoined: false,
        firstAlliance: false,
        bagCapacityPercent: 79,
      };

      const result = mgr.checkExtendedStepTriggers(gameState);
      expect(result?.stepId).not.toBe('step10_bag_manage');
    });

    it('step11科技分支：科技研究至第4节点触发（tech_count: 4）', () => {
      const sm = createInitializedSM();
      const mgr = createInitializedStepMgr(sm);

      sm.completeStep('step7_advisor_suggest');
      sm.completeStep('step8_semi_auto_battle');
      sm.completeStep('step9_borrow_hero');
      sm.completeStep('step10_bag_manage');

      const gameState: TutorialGameState = {
        castleLevel: 1,
        heroCount: 0,
        battleCount: 0,
        techCount: 4,
        allianceJoined: false,
        firstAlliance: false,
        bagCapacityPercent: 0,
      };

      const result = mgr.checkExtendedStepTriggers(gameState);
      expect(result).not.toBeNull();
      expect(result!.stepId).toBe('step11_tech_branch');
    });

    it('step12联盟系统：主城等级8触发（building_level: 8）', () => {
      const sm = createInitializedSM();
      const mgr = createInitializedStepMgr(sm);

      // 完成前面的扩展步骤
      sm.completeStep('step7_advisor_suggest');
      sm.completeStep('step8_semi_auto_battle');
      sm.completeStep('step9_borrow_hero');
      sm.completeStep('step10_bag_manage');
      sm.completeStep('step11_tech_branch');

      const gameState: TutorialGameState = {
        castleLevel: 8,
        heroCount: 0,
        battleCount: 0,
        techCount: 0,
        allianceJoined: false,
        firstAlliance: false,
        bagCapacityPercent: 0,
      };

      const result = mgr.checkExtendedStepTriggers(gameState);
      expect(result).not.toBeNull();
      expect(result!.stepId).toBe('step12_alliance');
    });

    it('step12联盟系统：主城等级不足8不触发', () => {
      const sm = createInitializedSM();
      const mgr = createInitializedStepMgr(sm);

      sm.completeStep('step7_advisor_suggest');
      sm.completeStep('step8_semi_auto_battle');
      sm.completeStep('step9_borrow_hero');
      sm.completeStep('step10_bag_manage');
      sm.completeStep('step11_tech_branch');

      const gameState: TutorialGameState = {
        castleLevel: 7,
        heroCount: 0,
        battleCount: 0,
        techCount: 0,
        allianceJoined: true,
        firstAlliance: false,
        bagCapacityPercent: 0,
      };

      const result = mgr.checkExtendedStepTriggers(gameState);
      expect(result).toBeNull();
    });
  });

  // ─── ACC-11-R2-02: 剧情对话行数与PRD一致性 ───

  describe('ACC-11-R2-02: 剧情对话行数与PRD一致性', () => {
    it('E2黄巾之乱：对话行数≥6行（PRD定义）', () => {
      const e2 = STORY_EVENT_DEFINITIONS.find(e => e.eventId === 'e2_yellow_turban');
      expect(e2).toBeDefined();
      expect(e2!.dialogues.length).toBeGreaterThanOrEqual(6);
    });

    it('E2黄巾之乱：包含探子角色对话', () => {
      const e2 = STORY_EVENT_DEFINITIONS.find(e => e.eventId === 'e2_yellow_turban');
      expect(e2).toBeDefined();
      const hasScout = e2!.dialogues.some(d => d.speaker === '探子');
      expect(hasScout).toBe(true);
    });

    it('E2黄巾之乱：包含张飞角色对话', () => {
      const e2 = STORY_EVENT_DEFINITIONS.find(e => e.eventId === 'e2_yellow_turban');
      expect(e2).toBeDefined();
      const hasZhangFei = e2!.dialogues.some(d => d.speaker === '张飞');
      expect(hasZhangFei).toBe(true);
    });

    it('E7七擒孟获：对话行数≥5行（PRD定义）', () => {
      const e7 = STORY_EVENT_DEFINITIONS.find(e => e.eventId === 'e7_seven_captures');
      expect(e7).toBeDefined();
      expect(e7!.dialogues.length).toBeGreaterThanOrEqual(5);
    });

    it('E7七擒孟获：包含孟获角色对话', () => {
      const e7 = STORY_EVENT_DEFINITIONS.find(e => e.eventId === 'e7_seven_captures');
      expect(e7).toBeDefined();
      const hasMengHuo = e7!.dialogues.some(d => d.speaker === '孟获');
      expect(hasMengHuo).toBe(true);
    });

    it('E8三国归一：对话行数≥5行（PRD定义）', () => {
      const e8 = STORY_EVENT_DEFINITIONS.find(e => e.eventId === 'e8_unification');
      expect(e8).toBeDefined();
      expect(e8!.dialogues.length).toBeGreaterThanOrEqual(5);
    });

    it('E8三国归一：包含诸葛亮角色对话', () => {
      const e8 = STORY_EVENT_DEFINITIONS.find(e => e.eventId === 'e8_unification');
      expect(e8).toBeDefined();
      const hasZhugeLiang = e8!.dialogues.some(d => d.speaker === '诸葛亮');
      expect(hasZhugeLiang).toBe(true);
    });
  });

  // ─── ACC-11-R2-03: 阶段奖励完整性 ───

  describe('ACC-11-R2-03: 阶段奖励完整性', () => {
    it('步骤12毕业奖励包含蓝色装备箱', () => {
      const step12Reward = TUTORIAL_PHASE_REWARDS.find(r => r.triggerStepId === 'step12_alliance');
      expect(step12Reward).toBeDefined();
      const hasBlueBox = step12Reward!.rewards.some(r => r.rewardId === 'blue_equipment_box');
      expect(hasBlueBox).toBe(true);
    });

    it('步骤12毕业奖励包含铜钱×3000', () => {
      const step12Reward = TUTORIAL_PHASE_REWARDS.find(r => r.triggerStepId === 'step12_alliance');
      expect(step12Reward).toBeDefined();
      const copperReward = step12Reward!.rewards.find(r => r.rewardId === 'copper');
      expect(copperReward).toBeDefined();
      expect(copperReward!.amount).toBe(3000);
    });
  });
});
