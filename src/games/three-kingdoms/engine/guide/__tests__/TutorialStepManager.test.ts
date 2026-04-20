/**
 * TutorialStepManager 单元测试
 * 覆盖：#2 核心引导、#3 扩展引导、#4 阶段奖励
 */

import type { ISystemDeps } from '../../../core/types';
import { TutorialStepManager } from '../TutorialStepManager';
import { TutorialStateMachine } from '../TutorialStateMachine';

function mockDeps(): ISystemDeps {
  return {
    eventBus: {
      on: jest.fn().mockReturnValue(jest.fn()),
      once: jest.fn().mockReturnValue(jest.fn()),
      emit: jest.fn(),
      off: jest.fn(),
      removeAllListeners: jest.fn(),
    },
    config: { get: jest.fn(), set: jest.fn() },
    registry: { register: jest.fn(), get: jest.fn(), getAll: jest.fn(), has: jest.fn(), unregister: jest.fn() },
  } as unknown as ISystemDeps;
}

describe('TutorialStepManager', () => {
  let stepMgr: TutorialStepManager;
  let sm: TutorialStateMachine;
  let deps: ISystemDeps;

  beforeEach(() => {
    jest.restoreAllMocks();
    stepMgr = new TutorialStepManager();
    sm = new TutorialStateMachine();
    deps = mockDeps();

    sm.init(deps);
    stepMgr.init(deps);
    stepMgr.setStateMachine(sm);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ═══════════════════════════════════════════
  // 1. 步骤定义 (#2, #3)
  // ═══════════════════════════════════════════
  describe('步骤定义', () => {
    it('核心步骤共6步', () => {
      const coreSteps = stepMgr.getCoreStepDefinitions();
      expect(coreSteps).toHaveLength(6);
    });

    it('扩展步骤共6步', () => {
      const extSteps = stepMgr.getExtendedStepDefinitions();
      expect(extSteps).toHaveLength(6);
    });

    it('所有步骤共12步', () => {
      const allSteps = stepMgr.getAllStepDefinitions();
      expect(allSteps).toHaveLength(12);
    });

    it('核心步骤按顺序排列', () => {
      const steps = stepMgr.getCoreStepDefinitions();
      const ids = steps.map(s => s.stepId);
      expect(ids).toEqual([
        'step1_castle_overview',
        'step2_build_farm',
        'step3_recruit_hero',
        'step4_first_battle',
        'step5_check_resources',
        'step6_tech_research',
      ]);
    });

    it('每个核心步骤有正确的子步骤数', () => {
      const steps = stepMgr.getCoreStepDefinitions();
      // step1=5, step2=5, step3=5, step4=5, step5=4, step6=5
      expect(steps[0].subSteps).toHaveLength(5);
      expect(steps[1].subSteps).toHaveLength(5);
      expect(steps[2].subSteps).toHaveLength(5);
      expect(steps[3].subSteps).toHaveLength(5);
      expect(steps[4].subSteps).toHaveLength(4);
      expect(steps[5].subSteps).toHaveLength(5);
    });
  });

  // ═══════════════════════════════════════════
  // 2. 步骤执行 (#2)
  // ═══════════════════════════════════════════
  describe('步骤执行', () => {
    it('获取下一个未完成步骤', () => {
      const next = stepMgr.getNextStep();
      expect(next).not.toBeNull();
      expect(next!.stepId).toBe('step1_castle_overview');
    });

    it('获取下一个核心步骤', () => {
      const next = stepMgr.getNextCoreStep();
      expect(next).not.toBeNull();
      expect(next!.stepId).toBe('step1_castle_overview');
    });

    it('开始执行步骤', () => {
      const result = stepMgr.startStep('step1_castle_overview');
      expect(result.success).toBe(true);
      expect(result.step).toBeDefined();
    });

    it('开始不存在的步骤返回失败', () => {
      const result = stepMgr.startStep('step99_nonexistent' as never);
      expect(result.success).toBe(false);
    });

    it('前置步骤未完成不能开始', () => {
      const result = stepMgr.startStep('step2_build_farm');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('前置');
    });

    it('已完成步骤不能重复开始', () => {
      sm.completeStep('step1_castle_overview');
      const result = stepMgr.startStep('step1_castle_overview');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('已完成');
    });

    it('推进子步骤', () => {
      stepMgr.startStep('step1_castle_overview');
      const result = stepMgr.advanceSubStep();
      expect(result.completed).toBe(false);
      expect(result.subStepIndex).toBe(1);
    });

    it('完成所有子步骤后标记步骤完成', () => {
      stepMgr.startStep('step1_castle_overview');
      // step1有5个子步骤，需要推进5次
      for (let i = 0; i < 5; i++) {
        stepMgr.advanceSubStep();
      }
      expect(sm.isStepCompleted('step1_castle_overview')).toBe(true);
    });

    it('步骤完成发放奖励', () => {
      stepMgr.startStep('step1_castle_overview');
      for (let i = 0; i < 5; i++) {
        const result = stepMgr.advanceSubStep();
        if (result.completed) {
          expect(result.rewards.length).toBeGreaterThan(0);
        }
      }
    });
  });

  // ═══════════════════════════════════════════
  // 3. 核心引导完整流程 (#2)
  // ═══════════════════════════════════════════
  describe('核心引导完整流程', () => {
    it('6步核心引导顺序执行', () => {
      const stepIds = [
        'step1_castle_overview',
        'step2_build_farm',
        'step3_recruit_hero',
        'step4_first_battle',
        'step5_check_resources',
        'step6_tech_research',
      ];

      for (const stepId of stepIds) {
        const next = stepMgr.getNextStep();
        expect(next).not.toBeNull();
        expect(next!.stepId).toBe(stepId);

        const startResult = stepMgr.startStep(stepId);
        expect(startResult.success).toBe(true);

        const def = stepMgr.getStepDefinition(stepId)!;
        for (let i = 0; i < def.subSteps.length; i++) {
          stepMgr.advanceSubStep();
        }
      }

      // 全部完成
      expect(sm.getCompletedCoreStepCount()).toBe(6);
    });
  });

  // ═══════════════════════════════════════════
  // 4. 阶段奖励 (#4)
  // ═══════════════════════════════════════════
  describe('阶段奖励', () => {
    it('步骤6完成发放「初出茅庐」礼包', () => {
      // 完成前置步骤
      for (const sid of ['step1_castle_overview', 'step2_build_farm', 'step3_recruit_hero',
        'step4_first_battle', 'step5_check_resources'] as const) {
        sm.completeStep(sid);
      }

      stepMgr.startStep('step6_tech_research');
      const def = stepMgr.getStepDefinition('step6_tech_research')!;
      for (let i = 0; i < def.subSteps.length; i++) {
        stepMgr.advanceSubStep();
      }

      // 步骤6完成应发放阶段奖励
      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'tutorial:rewardGranted',
        expect.objectContaining({
          rewards: expect.arrayContaining([
            expect.objectContaining({ rewardId: 'copper', amount: 2000 }),
          ]),
        }),
      );
    });

    it('获取阶段奖励配置', () => {
      const rewards = stepMgr.getPhaseRewards();
      expect(rewards).toHaveLength(2);
      expect(rewards[0].title).toBe('初出茅庐');
      expect(rewards[1].title).toBe('新手毕业');
    });
  });

  // ═══════════════════════════════════════════
  // 5. 扩展引导 (#3)
  // ═══════════════════════════════════════════
  describe('扩展引导', () => {
    it('扩展步骤有触发条件', () => {
      const extSteps = stepMgr.getExtendedStepDefinitions();
      for (const step of extSteps) {
        expect(step.triggerCondition).toBeDefined();
      }
    });

    it('checkExtendedStepTriggers 根据游戏状态触发', () => {
      const gameState = {
        castleLevel: 3,
        heroCount: 0,
        battleCount: 0,
        techCount: 0,
        allianceJoined: false,
      };
      const triggered = stepMgr.checkExtendedStepTriggers(gameState);
      expect(triggered).not.toBeNull();
      expect(triggered!.stepId).toBe('step7_advisor_suggest');
    });

    it('已完成扩展步骤不触发', () => {
      sm.completeStep('step7_advisor_suggest');
      const gameState = {
        castleLevel: 3,
        heroCount: 0,
        battleCount: 0,
        techCount: 0,
        allianceJoined: false,
      };
      const triggered = stepMgr.checkExtendedStepTriggers(gameState);
      expect(triggered).toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // 6. 查询 API
  // ═══════════════════════════════════════════
  describe('查询 API', () => {
    it('获取步骤定义', () => {
      const def = stepMgr.getStepDefinition('step1_castle_overview');
      expect(def).not.toBeNull();
      expect(def!.title).toBe('初入乱世，立足根基');
    });

    it('获取不存在的步骤定义返回 null', () => {
      const def = stepMgr.getStepDefinition('step99_nonexistent' as never);
      expect(def).toBeNull();
    });

    it('获取当前子步骤', () => {
      stepMgr.startStep('step1_castle_overview');
      const subStep = stepMgr.getCurrentSubStep();
      expect(subStep).not.toBeNull();
      expect(subStep!.id).toBe('1-1');
    });

    it('未开始步骤时 getCurrentSubStep 返回 null', () => {
      const subStep = stepMgr.getCurrentSubStep();
      expect(subStep).toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // 7. 重置
  // ═══════════════════════════════════════════
  describe('重置', () => {
    it('reset 恢复初始状态', () => {
      stepMgr.startStep('step1_castle_overview');
      stepMgr.reset();
      const state = stepMgr.getState();
      expect(state.activeStepId).toBeNull();
    });
  });
});
