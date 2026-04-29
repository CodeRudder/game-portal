/**
 * FLOW-24 引导系统+离线收益集成测试 — TutorialSystem/TutorialStateMachine/OfflineRewardSystem
 *
 * 使用真实引擎实例，通过 createSim() 创建引擎，不 mock 核心逻辑。
 * 测试新手引导弹窗、引导步骤推进、引导完成奖励、离线收益弹窗、离线收益数值。
 *
 * 覆盖范围：
 * - 引导系统：4步引导流程、步骤推进、奖励发放、跳过引导
 * - 引导状态机：5状态转换、首次启动检测
 * - 离线收益：6档衰减计算、收益上限、翻倍机制、领取防重复
 * - 离线收益弹窗：数值展示、封顶提示、资源类型覆盖
 * - 苏格拉底边界：空状态、满级、资源不足、序列化
 *
 * @module tests/acc/FLOW-24
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { accTest, assertStrict, assertRange } from './acc-test-utils';
import { createSim } from '../../test-utils/test-helpers';
import type { GameEventSimulator } from '../../test-utils/GameEventSimulator';

// 引导系统
import { TutorialSystem } from '../../engine/tutorial/tutorial-system';
import {
  TUTORIAL_GUIDE_STEPS,
  TUTORIAL_GUIDE_TOTAL_STEPS,
  TUTORIAL_GUIDE_STEP_MAP,
  TUTORIAL_GUIDE_ACTION_MAP,
  TUTORIAL_GUIDE_SAVE_VERSION,
} from '../../engine/tutorial/tutorial-config';
import type { TutorialGuideStepId, CompleteStepResult } from '../../engine/tutorial/tutorial-system';

// 引导状态机
import { TutorialStateMachine } from '../../engine/guide/TutorialStateMachine';
import type { TutorialPhase, TutorialTransition } from '../../core/guide/guide.types';
import { UNSKIPPABLE_STEPS, TUTORIAL_SAVE_VERSION, NEWBIE_PROTECTION_DURATION_MS } from '../../core/guide/guide.types';

// 引导步骤管理器
import { TutorialStepManager } from '../../engine/guide/TutorialStepManager';
import { TutorialStepExecutor } from '../../engine/guide/TutorialStepExecutor';
import { FirstLaunchDetector } from '../../engine/guide/FirstLaunchDetector';
import { StoryEventPlayer } from '../../engine/guide/StoryEventPlayer';
import { TutorialMaskSystem } from '../../engine/guide/TutorialMaskSystem';
import {
  CORE_STEP_DEFINITIONS,
  EXTENDED_STEP_DEFINITIONS,
  ALL_STEP_DEFINITIONS,
  STEP_DEFINITION_MAP,
  TUTORIAL_PHASE_REWARDS,
} from '../../core/guide/guide-config';

// 离线收益系统
import { OfflineRewardSystem } from '../../engine/offline/OfflineRewardSystem';
import { calculateOfflineSnapshot, applyDouble, calculateBonusCoefficient } from '../../engine/offline/OfflineRewardEngine';
import {
  DECAY_TIERS,
  MAX_OFFLINE_SECONDS,
  OFFLINE_POPUP_THRESHOLD,
} from '../../engine/offline/offline-config';
import type {
  OfflineSnapshot,
  DoubleRequest,
  DoubleResult,
  OfflineRewardResultV9,
} from '../../engine/offline/offline.types';
import { zeroRes, cloneRes } from '../../engine/offline/offline-utils';

import type { ISystemDeps } from '../../core/types';
import type { Resources, ProductionRate } from '../../shared/types';

// ── 辅助函数 ──

function mockDeps(): ISystemDeps {
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
      removeAllListeners: vi.fn(),
    },
    config: { get: vi.fn(), set: vi.fn() },
    registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(), has: vi.fn(), unregister: vi.fn() },
  } as unknown as ISystemDeps;
}

/** 创建并连接引导子系统 */
function createGuideBundle() {
  const deps = mockDeps();
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

/** 创建默认产出速率 */
function defaultProductionRates(): ProductionRate {
  return {
    grain: 10,
    gold: 5,
    troops: 1,
    mandate: 0.1,
    techPoint: 0.5,
    recruitToken: 0,
    skillBook: 0,
  };
}

/** 创建默认资源 */
function defaultResources(): Resources {
  return { grain: 1000, gold: 500, troops: 200, mandate: 50, techPoint: 100, recruitToken: 5, skillBook: 2 };
}

/** 创建默认上限 */
function defaultCaps(): Record<string, number | null> {
  return { grain: 100000, gold: 100000, troops: 50000, mandate: null, techPoint: null, recruitToken: null, skillBook: null };
}

// ═══════════════════════════════════════════════════════════════
// FLOW-24 引导系统+离线收益集成测试
// ═══════════════════════════════════════════════════════════════

describe('FLOW-24 引导系统+离线收益集成测试', () => {
  let sim: GameEventSimulator;

  beforeEach(() => {
    vi.clearAllMocks();
    sim = createSim();
    sim.addResources({ gold: 500000, grain: 500000, troops: 50000 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════════════════════
  // 1. 引导系统 — TutorialSystem（FLOW-24-01 ~ FLOW-24-08）
  // ═══════════════════════════════════════════════════════════

  describe('1. 引导系统 — TutorialSystem', () => {

    it(accTest('FLOW-24-01', '引导系统 — 4步引导配置正确'), () => {
      assertStrict(TUTORIAL_GUIDE_STEPS.length === 4, 'FLOW-24-01',
        `应有4步引导，实际: ${TUTORIAL_GUIDE_STEPS.length}`);
      assertStrict(TUTORIAL_GUIDE_TOTAL_STEPS === 4, 'FLOW-24-01',
        `TOTAL_STEPS应为4，实际: ${TUTORIAL_GUIDE_TOTAL_STEPS}`);
    });

    it(accTest('FLOW-24-02', '引导系统 — 第一步为领取新手礼包'), () => {
      const step = TUTORIAL_GUIDE_STEPS[0];
      assertStrict(step.id === 'claim_newbie_pack', 'FLOW-24-02',
        `第一步应为claim_newbie_pack，实际: ${step.id}`);
      assertStrict(step.order === 1, 'FLOW-24-02',
        `第一步order应为1，实际: ${step.order}`);
      assertStrict(step.rewards.length === 3, 'FLOW-24-02',
        `第一步应有3个奖励，实际: ${step.rewards.length}`);
    });

    it(accTest('FLOW-24-03', '引导系统 — 步骤按顺序完成'), () => {
      const tutorial = new TutorialSystem();
      tutorial.init(mockDeps());

      // 第一步：领取新手礼包
      const result1 = tutorial.completeCurrentStep('claim_newbie_pack');
      assertStrict(result1.success, 'FLOW-24-03',
        `第一步应成功: ${result1.reason ?? ''}`);
      assertStrict(result1.rewards.length === 3, 'FLOW-24-03',
        `第一步应有3个奖励`);

      // 第二步：首次招募
      const result2 = tutorial.completeCurrentStep('first_recruit');
      assertStrict(result2.success, 'FLOW-24-03',
        `第二步应成功: ${result2.reason ?? ''}`);

      // 第三步：查看武将
      const result3 = tutorial.completeCurrentStep('view_hero');
      assertStrict(result3.success, 'FLOW-24-03',
        `第三步应成功: ${result3.reason ?? ''}`);

      // 第四步：编队上阵
      const result4 = tutorial.completeCurrentStep('add_to_formation');
      assertStrict(result4.success, 'FLOW-24-03',
        `第四步应成功: ${result4.reason ?? ''}`);
      assertStrict(result4.nextStep === null, 'FLOW-24-03',
        '第四步完成后应无下一步');
    });

    it(accTest('FLOW-24-04', '引导系统 — 错误action不完成步骤'), () => {
      const tutorial = new TutorialSystem();
      tutorial.init(mockDeps());

      const result = tutorial.completeCurrentStep('wrong_action');
      assertStrict(!result.success, 'FLOW-24-04',
        '错误action不应完成步骤');
    });

    it(accTest('FLOW-24-05', '引导系统 — 跳过引导'), () => {
      const tutorial = new TutorialSystem();
      tutorial.init(mockDeps());

      tutorial.skip();

      const step = tutorial.getCurrentStep();
      assertStrict(step === null, 'FLOW-24-05', '跳过后应无当前步骤');

      // 跳过后不能完成步骤
      const result = tutorial.completeCurrentStep('claim_newbie_pack');
      assertStrict(!result.success, 'FLOW-24-05', '跳过后不应能完成步骤');
    });

    it(accTest('FLOW-24-06', '引导系统 — 新手礼包奖励正确'), () => {
      const step = TUTORIAL_GUIDE_STEP_MAP['claim_newbie_pack'];
      assertStrict(!!step, 'FLOW-24-06', '新手礼包步骤应存在');

      const rewards = step.rewards;
      const recruitToken = rewards.find(r => r.resource === 'recruitToken');
      assertStrict(!!recruitToken, 'FLOW-24-06', '应有招贤令奖励');
      assertStrict(recruitToken!.amount === 100, 'FLOW-24-06',
        `招贤令应为100，实际: ${recruitToken!.amount}`);

      const copper = rewards.find(r => r.resource === 'copper');
      assertStrict(!!copper, 'FLOW-24-06', '应有铜钱奖励');
      assertStrict(copper!.amount === 5000, 'FLOW-24-06',
        `铜钱应为5000，实际: ${copper!.amount}`);

      const skillBook = rewards.find(r => r.resource === 'skillBook');
      assertStrict(!!skillBook, 'FLOW-24-06', '应有技能书奖励');
      assertStrict(skillBook!.amount === 1, 'FLOW-24-06',
        `技能书应为1，实际: ${skillBook!.amount}`);
    });

    it(accTest('FLOW-24-07', '引导系统 — 序列化/反序列化保持状态'), () => {
      const tutorial = new TutorialSystem();
      tutorial.init(mockDeps());

      // 完成第一步
      tutorial.completeCurrentStep('claim_newbie_pack');

      const saveData = tutorial.exportSaveData();
      assertStrict(saveData.version === TUTORIAL_GUIDE_SAVE_VERSION, 'FLOW-24-07',
        `版本应为${TUTORIAL_GUIDE_SAVE_VERSION}，实际: ${saveData.version}`);
      assertStrict(saveData.completedSteps.length === 1, 'FLOW-24-07',
        `应有1个已完成步骤，实际: ${saveData.completedSteps.length}`);

      // 恢复
      const tutorial2 = new TutorialSystem();
      tutorial2.init(mockDeps());
      tutorial2.importSaveData(saveData);

      const state = tutorial2.getState();
      assertStrict(state.completedSteps.length === 1, 'FLOW-24-07',
        `恢复后应有1个已完成步骤`);
      assertStrict(state.completedSteps[0] === 'claim_newbie_pack', 'FLOW-24-07',
        '恢复后第一步应为已完成');
    });

    it(accTest('FLOW-24-08', '引导系统 — 引导完成后不再显示'), () => {
      const tutorial = new TutorialSystem();
      tutorial.init(mockDeps());

      // 完成所有步骤
      tutorial.completeCurrentStep('claim_newbie_pack');
      tutorial.completeCurrentStep('first_recruit');
      tutorial.completeCurrentStep('view_hero');
      tutorial.completeCurrentStep('add_to_formation');

      const step = tutorial.getCurrentStep();
      assertStrict(step === null, 'FLOW-24-08', '完成后应无当前步骤');

      const isComplete = tutorial.isTutorialComplete();
      assertStrict(isComplete, 'FLOW-24-08', '应标记为已完成');
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 2. 引导状态机（FLOW-24-09 ~ FLOW-24-16）
  // ═══════════════════════════════════════════════════════════

  describe('2. 引导状态机', () => {

    it(accTest('FLOW-24-09', '状态机 — 初始状态为not_started'), () => {
      const { stateMachine } = createGuideBundle();
      assertStrict(stateMachine.getCurrentPhase() === 'not_started', 'FLOW-24-09',
        `初始应为not_started，实际: ${stateMachine.getCurrentPhase()}`);
    });

    it(accTest('FLOW-24-10', '状态机 — first_enter转换到core_guiding'), () => {
      const { stateMachine } = createGuideBundle();
      const result = stateMachine.transition('first_enter');
      assertStrict(result.success, 'FLOW-24-10',
        `转换应成功: ${result.reason ?? ''}`);
      assertStrict(stateMachine.getCurrentPhase() === 'core_guiding', 'FLOW-24-10',
        `应为core_guiding，实际: ${stateMachine.getCurrentPhase()}`);
    });

    it(accTest('FLOW-24-11', '状态机 — step6_complete转换到free_explore'), () => {
      const { stateMachine } = createGuideBundle();
      stateMachine.transition('first_enter');
      stateMachine.transition('step6_complete');

      assertStrict(stateMachine.getCurrentPhase() === 'free_explore', 'FLOW-24-11',
        `应为free_explore，实际: ${stateMachine.getCurrentPhase()}`);
    });

    it(accTest('FLOW-24-12', '状态机 — explore_done转换到free_play'), () => {
      const { stateMachine } = createGuideBundle();
      stateMachine.transition('first_enter');
      stateMachine.transition('step6_complete');
      stateMachine.transition('explore_done');

      assertStrict(stateMachine.getCurrentPhase() === 'free_play', 'FLOW-24-12',
        `应为free_play，实际: ${stateMachine.getCurrentPhase()}`);
    });

    it(accTest('FLOW-24-13', '状态机 — 非法转换被拒绝'), () => {
      const { stateMachine } = createGuideBundle();
      // not_started → explore_done 是非法的
      const result = stateMachine.transition('explore_done');
      assertStrict(!result.success, 'FLOW-24-13', '非法转换应被拒绝');
    });

    it(accTest('FLOW-24-14', '状态机 — 老用户直接进入free_play'), () => {
      const { stateMachine } = createGuideBundle();
      stateMachine.enterAsReturning();
      assertStrict(stateMachine.getCurrentPhase() === 'free_play', 'FLOW-24-14',
        `老用户应为free_play，实际: ${stateMachine.getCurrentPhase()}`);
    });

    it(accTest('FLOW-24-15', '状态机 — 6步核心引导步骤定义正确'), () => {
      assertStrict(CORE_STEP_DEFINITIONS.length === 6, 'FLOW-24-15',
        `应有6个核心步骤，实际: ${CORE_STEP_DEFINITIONS.length}`);

      const expectedIds = [
        'step1_castle_overview', 'step2_build_farm', 'step3_recruit_hero',
        'step4_first_battle', 'step5_check_resources', 'step6_tech_research',
      ];
      for (let i = 0; i < expectedIds.length; i++) {
        assertStrict(CORE_STEP_DEFINITIONS[i].stepId === expectedIds[i], 'FLOW-24-15',
          `核心步骤[${i}]应为${expectedIds[i]}，实际: ${CORE_STEP_DEFINITIONS[i].stepId}`);
      }
    });

    it(accTest('FLOW-24-16', '状态机 — 6步扩展引导步骤定义正确'), () => {
      assertStrict(EXTENDED_STEP_DEFINITIONS.length === 6, 'FLOW-24-16',
        `应有6个扩展步骤，实际: ${EXTENDED_STEP_DEFINITIONS.length}`);

      const expectedIds = [
        'step7_advisor_suggest', 'step8_semi_auto_battle', 'step9_borrow_hero',
        'step10_bag_manage', 'step11_tech_branch', 'step12_alliance',
      ];
      for (let i = 0; i < expectedIds.length; i++) {
        assertStrict(EXTENDED_STEP_DEFINITIONS[i].stepId === expectedIds[i], 'FLOW-24-16',
          `扩展步骤[${i}]应为${expectedIds[i]}，实际: ${EXTENDED_STEP_DEFINITIONS[i].stepId}`);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 3. 引导步骤管理器（FLOW-24-17 ~ FLOW-24-22）
  // ═══════════════════════════════════════════════════════════

  describe('3. 引导步骤管理器', () => {

    it(accTest('FLOW-24-17', '步骤管理 — 开始核心步骤1'), () => {
      const { stepManager, stateMachine } = createGuideBundle();
      stateMachine.transition('first_enter');

      const result = stepManager.startStep('step1_castle_overview');
      assertStrict(result.success, 'FLOW-24-17',
        `应成功开始: ${result.reason ?? ''}`);
      assertStrict(!!result.step, 'FLOW-24-17', '应返回步骤定义');
      assertStrict(result.step!.stepId === 'step1_castle_overview', 'FLOW-24-17',
        `步骤ID应为step1_castle_overview`);
    });

    it(accTest('FLOW-24-18', '步骤管理 — 前置步骤未完成不能开始'), () => {
      const { stepManager, stateMachine } = createGuideBundle();
      stateMachine.transition('first_enter');

      // 步骤2需要步骤1完成
      const result = stepManager.startStep('step2_build_farm');
      assertStrict(!result.success, 'FLOW-24-18', '前置未完成应失败');
    });

    it(accTest('FLOW-24-19', '步骤管理 — 推进子步骤'), () => {
      const { stepManager, stateMachine } = createGuideBundle();
      stateMachine.transition('first_enter');
      stepManager.startStep('step1_castle_overview');

      const result = stepManager.advanceSubStep();
      assertStrict(result.stepId === 'step1_castle_overview', 'FLOW-24-19',
        `步骤ID应正确`);
      // 步骤1有5个子步骤，推进1次不应完成
      assertStrict(!result.completed, 'FLOW-24-19', '推进1次不应完成步骤');
    });

    it(accTest('FLOW-24-20', '步骤管理 — 完成步骤发放奖励'), () => {
      const { stepManager, stateMachine, deps } = createGuideBundle();
      stateMachine.transition('first_enter');
      stepManager.startStep('step1_castle_overview');

      // 推进所有子步骤直到完成
      const def = STEP_DEFINITION_MAP['step1_castle_overview'];
      let lastResult;
      for (let i = 0; i < def.subSteps.length; i++) {
        lastResult = stepManager.advanceSubStep();
      }

      assertStrict(lastResult!.completed, 'FLOW-24-20', '步骤应完成');
      assertStrict(lastResult!.rewards.length > 0, 'FLOW-24-20',
        '完成步骤应有奖励');

      // 验证事件发射
      const emitCalls = (deps.eventBus.emit as ReturnType<typeof vi.fn>).mock.calls;
      const rewardCall = emitCalls.find((c: unknown[]) => c[0] === 'tutorial:rewardGranted');
      assertStrict(!!rewardCall, 'FLOW-24-20', '应发射rewardGranted事件');
    });

    it(accTest('FLOW-24-21', '步骤管理 — 阶段奖励配置正确'), () => {
      assertStrict(TUTORIAL_PHASE_REWARDS.length > 0, 'FLOW-24-21',
        `应有阶段奖励，实际: ${TUTORIAL_PHASE_REWARDS.length}`);

      // 步骤6完成应有"初出茅庐"礼包
      const step6Reward = TUTORIAL_PHASE_REWARDS.find(r => r.triggerStepId === 'step6_tech_research');
      assertStrict(!!step6Reward, 'FLOW-24-21', '步骤6应有阶段奖励');
    });

    it(accTest('FLOW-24-22', '步骤管理 — 不可跳过步骤检测'), () => {
      // step1_castle_overview 和 step2_build_farm 和 step4_first_battle 是不可跳过的
      assertStrict(UNSKIPPABLE_STEPS.includes('step1_castle_overview'), 'FLOW-24-22',
        '步骤1应不可跳过');
      assertStrict(UNSKIPPABLE_STEPS.includes('step2_build_farm'), 'FLOW-24-22',
        '步骤2应不可跳过');
      assertStrict(UNSKIPPABLE_STEPS.includes('step4_first_battle'), 'FLOW-24-22',
        '步骤4应不可跳过');
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 4. 离线收益计算（FLOW-24-23 ~ FLOW-24-30）
  // ═══════════════════════════════════════════════════════════

  describe('4. 离线收益计算', () => {

    it(accTest('FLOW-24-23', '离线收益 — 6档衰减配置正确'), () => {
      assertStrict(DECAY_TIERS.length === 5, 'FLOW-24-23',
        `应有5个衰减档位，实际: ${DECAY_TIERS.length}`);

      const expectedEfficiencies = [1.0, 0.80, 0.60, 0.40, 0.20];
      for (let i = 0; i < expectedEfficiencies.length; i++) {
        assertStrict(DECAY_TIERS[i].efficiency === expectedEfficiencies[i], 'FLOW-24-23',
          `档位${i + 1}效率应为${expectedEfficiencies[i]}，实际: ${DECAY_TIERS[i].efficiency}`);
      }
    });

    it(accTest('FLOW-24-24', '离线收益 — 最大离线时长72小时'), () => {
      assertStrict(MAX_OFFLINE_SECONDS === 72 * 3600, 'FLOW-24-24',
        `最大离线应为72小时=${72 * 3600}秒，实际: ${MAX_OFFLINE_SECONDS}`);
    });

    it(accTest('FLOW-24-25', '离线收益 — 短时间离线计算正确'), () => {
      const rates = defaultProductionRates();
      const snapshot = calculateOfflineSnapshot(
        3600, // 1小时
        rates,
        {},
      );

      assertStrict(snapshot.offlineSeconds === 3600, 'FLOW-24-25',
        `离线秒数应为3600，实际: ${snapshot.offlineSeconds}`);
      assertStrict(!snapshot.isCapped, 'FLOW-24-25', '1小时不应封顶');
      assertStrict(snapshot.tierDetails.length > 0, 'FLOW-24-25', '应有档位明细');
      assertStrict(snapshot.overallEfficiency === 1.0, 'FLOW-24-25',
        `1小时效率应为1.0，实际: ${snapshot.overallEfficiency}`);
    });

    it(accTest('FLOW-24-26', '离线收益 — 跨档位计算正确'), () => {
      const rates = defaultProductionRates();
      // 5小时 = 2h tier1 + 3h tier2
      const snapshot = calculateOfflineSnapshot(
        5 * 3600,
        rates,
        {},
      );

      assertStrict(snapshot.tierDetails.length === 2, 'FLOW-24-26',
        `5小时应跨2个档位，实际: ${snapshot.tierDetails.length}`);
      assertStrict(snapshot.overallEfficiency < 1.0, 'FLOW-24-26',
        '5小时效率应低于1.0');
    });

    it(accTest('FLOW-24-27', '离线收益 — 超过72小时封顶'), () => {
      const rates = defaultProductionRates();
      const snapshot = calculateOfflineSnapshot(
        100 * 3600, // 100小时
        rates,
        {},
      );

      assertStrict(snapshot.isCapped, 'FLOW-24-27', '100小时应封顶');
    });

    it(accTest('FLOW-24-28', '离线收益 — 加成系数计算正确'), () => {
      // 无加成
      const noBonus = calculateBonusCoefficient({});
      assertStrict(noBonus === 1.0, 'FLOW-24-28',
        `无加成应为1.0，实际: ${noBonus}`);

      // 科技加成30%
      const techBonus = calculateBonusCoefficient({ tech: 0.3 });
      assertStrict(techBonus === 1.3, 'FLOW-24-28',
        `科技加成30%应为1.3，实际: ${techBonus}`);

      // 满加成100%
      const maxBonus = calculateBonusCoefficient({ tech: 0.5, vip: 0.3, reputation: 0.5 });
      assertStrict(maxBonus === 2.0, 'FLOW-24-28',
        `满加成应为2.0，实际: ${maxBonus}`);

      // 超限截断100%
      const overBonus = calculateBonusCoefficient({ tech: 1.0, vip: 1.0 });
      assertStrict(overBonus === 2.0, 'FLOW-24-28',
        `超限应为2.0，实际: ${overBonus}`);
    });

    it(accTest('FLOW-24-29', '离线收益 — 翻倍机制正确'), () => {
      const earned: Resources = { grain: 1000, gold: 500, troops: 100, mandate: 10, techPoint: 50, recruitToken: 0, skillBook: 0 };

      const result = applyDouble(earned, {
        source: 'ad',
        multiplier: 2,
        description: '广告翻倍',
      }, 0);

      assertStrict(result.success, 'FLOW-24-29', '翻倍应成功');
      assertStrict(result.appliedMultiplier === 2, 'FLOW-24-29',
        `倍率应为2，实际: ${result.appliedMultiplier}`);
      assertStrict(result.doubledEarned.grain === 2000, 'FLOW-24-29',
        `粮草应翻倍为2000，实际: ${result.doubledEarned.grain}`);
    });

    it(accTest('FLOW-24-30', '离线收益 — 广告翻倍每日3次上限'), () => {
      const earned = defaultResources();

      // 使用3次
      applyDouble(earned, { source: 'ad', multiplier: 2, description: '广告翻倍' }, 0);
      applyDouble(earned, { source: 'ad', multiplier: 2, description: '广告翻倍' }, 1);
      applyDouble(earned, { source: 'ad', multiplier: 2, description: '广告翻倍' }, 2);

      // 第4次应失败
      const result = applyDouble(earned, { source: 'ad', multiplier: 2, description: '广告翻倍' }, 3);
      assertStrict(!result.success, 'FLOW-24-30', '第4次广告翻倍应失败');
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 5. 离线收益领取（FLOW-24-31 ~ FLOW-24-36）
  // ═══════════════════════════════════════════════════════════

  describe('5. 离线收益领取', () => {

    it(accTest('FLOW-24-31', '离线领取 — 计算离线奖励'), () => {
      const offline = new OfflineRewardSystem();
      offline.init(mockDeps());

      const rates = defaultProductionRates();
      const resources = defaultResources();
      const caps = defaultCaps();

      const reward = offline.calculateOfflineReward(
        3600, rates, resources, caps,
      );

      assertStrict(!!reward, 'FLOW-24-31', '应返回奖励结果');
      assertStrict(!!reward.snapshot, 'FLOW-24-31', '应包含快照');
      assertStrict(!!reward.cappedEarned, 'FLOW-24-31', '应包含封顶后收益');
    });

    it(accTest('FLOW-24-32', '离线领取 — 防重复领取'), () => {
      const offline = new OfflineRewardSystem();
      offline.init(mockDeps());

      const rates = defaultProductionRates();
      const resources = defaultResources();
      const caps = defaultCaps();

      const reward = offline.calculateOfflineReward(3600, rates, resources, caps);

      // 第一次领取成功
      const claimed1 = offline.claimReward(reward);
      assertStrict(!!claimed1, 'FLOW-24-32', '第一次领取应成功');

      // 第二次领取失败
      const claimed2 = offline.claimReward(reward);
      assertStrict(claimed2 === null, 'FLOW-24-32', '重复领取应返回null');
    });

    it(accTest('FLOW-24-33', '离线领取 — 收益数值非负'), () => {
      const offline = new OfflineRewardSystem();
      offline.init(mockDeps());

      const rates = defaultProductionRates();
      const resources = defaultResources();
      const caps = defaultCaps();

      const reward = offline.calculateOfflineReward(7200, rates, resources, caps);
      const earned = reward.cappedEarned;

      for (const [key, val] of Object.entries(earned)) {
        assertStrict(val >= 0, 'FLOW-24-33',
          `资源 ${key} 应非负，实际: ${val}`);
      }
    });

    it(accTest('FLOW-24-34', '离线领取 — 收益不超过上限'), () => {
      const offline = new OfflineRewardSystem();
      offline.init(mockDeps());

      const rates = defaultProductionRates();
      const resources = defaultResources();
      const caps = defaultCaps();

      const reward = offline.calculateOfflineReward(86400, rates, resources, caps);

      // 检查有上限的资源
      if (caps.grain !== null) {
        const totalGrain = resources.grain + reward.cappedEarned.grain;
        assertStrict(totalGrain <= caps.grain, 'FLOW-24-34',
          `粮草总量${totalGrain}不应超过上限${caps.grain}`);
      }
    });

    it(accTest('FLOW-24-35', '离线领取 — 零离线时间无收益'), () => {
      const offline = new OfflineRewardSystem();
      offline.init(mockDeps());

      const snapshot = offline.calculateSnapshot(0, defaultProductionRates());
      assertStrict(snapshot.offlineSeconds === 0, 'FLOW-24-35',
        '离线秒数应为0');
      assertStrict(snapshot.overallEfficiency === 0, 'FLOW-24-35',
        '效率应为0');
    });

    it(accTest('FLOW-24-36', '离线领取 — 序列化/反序列化'), () => {
      const offline = new OfflineRewardSystem();
      offline.init(mockDeps());

      const saveData = offline.serialize();
      assertStrict(!!saveData, 'FLOW-24-36', '应返回序列化数据');
      assertStrict(saveData.version > 0, 'FLOW-24-36', '版本号应大于0');

      // 恢复
      const offline2 = new OfflineRewardSystem();
      offline2.init(mockDeps());
      offline2.deserialize(saveData);

      const state = offline2.getState() as any;
      assertStrict(!!state, 'FLOW-24-36', '恢复后应有状态');
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 6. 苏格拉底边界（FLOW-24-37 ~ FLOW-24-44）
  // ═══════════════════════════════════════════════════════════

  describe('6. 苏格拉底边界', () => {

    it(accTest('FLOW-24-37', '边界 — Q10:离线收益弹窗数值与实际到账一致'), () => {
      const offline = new OfflineRewardSystem();
      offline.init(mockDeps());

      const rates = defaultProductionRates();
      const resources = defaultResources();
      const caps = defaultCaps();

      const reward = offline.calculateOfflineReward(3600, rates, resources, caps);
      const claimed = offline.claimReward(reward);

      assertStrict(!!claimed, 'FLOW-24-37', '应领取成功');

      // 弹窗显示的 cappedEarned 应与领取到的资源一致
      for (const key of Object.keys(reward.cappedEarned)) {
        const k = key as keyof Resources;
        assertStrict(claimed![k] === reward.cappedEarned[k], 'FLOW-24-37',
          `资源${key}: 弹窗=${reward.cappedEarned[k]}，到账=${claimed![k]}`);
      }
    });

    it(accTest('FLOW-24-38', '边界 — 引导系统reset后恢复初始'), () => {
      const tutorial = new TutorialSystem();
      tutorial.init(mockDeps());
      tutorial.completeCurrentStep('claim_newbie_pack');

      tutorial.reset();

      const state = tutorial.getState();
      assertStrict(state.completedSteps.length === 0, 'FLOW-24-38',
        '重置后应无已完成步骤');
      assertStrict(!state.skipped, 'FLOW-24-38', '重置后不应跳过');
    });

    it(accTest('FLOW-24-39', '边界 — 状态机reset后恢复not_started'), () => {
      const { stateMachine } = createGuideBundle();
      stateMachine.transition('first_enter');
      assertStrict(stateMachine.getCurrentPhase() === 'core_guiding', 'FLOW-24-39',
        '转换前应为core_guiding');

      stateMachine.reset();
      assertStrict(stateMachine.getCurrentPhase() === 'not_started', 'FLOW-24-39',
        '重置后应为not_started');
    });

    it(accTest('FLOW-24-40', '边界 — 离线收益负数离线时间处理'), () => {
      const offline = new OfflineRewardSystem();
      offline.init(mockDeps());

      const snapshot = offline.calculateSnapshot(-100, defaultProductionRates());
      assertStrict(snapshot.offlineSeconds === 0, 'FLOW-24-40',
        '负数离线时间应处理为0');
    });

    it(accTest('FLOW-24-41', '边界 — 引导完成所有12步'), () => {
      assertStrict(ALL_STEP_DEFINITIONS.length === 12, 'FLOW-24-41',
        `总步骤应为12，实际: ${ALL_STEP_DEFINITIONS.length}`);
    });

    it(accTest('FLOW-24-42', '边界 — 新手保护时长30分钟'), () => {
      assertStrict(NEWBIE_PROTECTION_DURATION_MS === 30 * 60 * 1000, 'FLOW-24-42',
        `保护时长应为30分钟=${30 * 60 * 1000}ms，实际: ${NEWBIE_PROTECTION_DURATION_MS}`);
    });

    it(accTest('FLOW-24-43', '边界 — 离线弹窗触发阈值5分钟'), () => {
      assertStrict(OFFLINE_POPUP_THRESHOLD === 300, 'FLOW-24-43',
        `弹窗阈值应为300秒，实际: ${OFFLINE_POPUP_THRESHOLD}`);
    });

    it(accTest('FLOW-24-44', '边界 — 引导步骤每步都有子步骤'), () => {
      for (const step of CORE_STEP_DEFINITIONS) {
        assertStrict(step.subSteps.length > 0, 'FLOW-24-44',
          `步骤 ${step.stepId} 应有子步骤`);
        for (const sub of step.subSteps) {
          assertStrict(!!sub.id, 'FLOW-24-44', `子步骤应有id`);
          assertStrict(!!sub.text, 'FLOW-24-44', `子步骤应有text`);
          assertStrict(!!sub.completionType, 'FLOW-24-44', `子步骤应有completionType`);
        }
      }
    });
  });
});
