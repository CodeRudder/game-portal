/**
 * 引导模块对抗式测试
 *
 * 覆盖子系统：
 *   S1: TutorialStateMachine（状态机5阶段转换/进度管理/序列化/冲突解决）
 *   S2: TutorialStepManager（步骤执行/子步骤推进/奖励发放/超时降级）
 *   S3: TutorialStepExecutor（加速机制/不可跳过检测/重玩/触发条件评估）
 *   S4: FirstLaunchDetector（首次启动检测/画质检测/新手保护）
 *   S5: StoryTriggerEvaluator（剧情触发条件评估）
 *
 * 5维度：F-Normal / F-Error / F-Boundary / F-Cross / F-Lifecycle
 * @module tests/adversarial/guide-adversarial
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TutorialStateMachine } from '../../engine/guide/TutorialStateMachine';
import { TutorialStepManager } from '../../engine/guide/TutorialStepManager';
import { TutorialStepExecutor } from '../../engine/guide/TutorialStepExecutor';
import { FirstLaunchDetector } from '../../engine/guide/FirstLaunchDetector';
import { StoryTriggerEvaluator } from '../../engine/guide/StoryTriggerEvaluator';
import {
  STEP_DEFINITION_MAP, TUTORIAL_PHASE_REWARDS,
  GUIDE_REPLAY_DAILY_LIMIT, GUIDE_REPLAY_REWARD,
  UNSKIPPABLE_STEPS, TUTORIAL_SAVE_VERSION,
} from '../../core/guide';
import type {
  TutorialStepId, TutorialPhase, TutorialSaveData, TutorialGameState,
} from '../../core/guide';
import type { ISystemDeps } from '../../core/types';

// ── 测试辅助 ──────────────────────────────────

const mockDeps = (): ISystemDeps => {
  const ls = new Map<string, Function[]>();
  return {
    eventBus: {
      on: vi.fn((e: string, h: Function) => { (ls.has(e) ? ls : ls.set(e, [])).get(e)!.push(h); return vi.fn(); }),
      once: vi.fn((e: string, h: Function) => { (ls.has(e) ? ls : ls.set(e, [])).get(e)!.push(h); return vi.fn(); }),
      emit: vi.fn((e: string, p?: unknown) => { ls.get(e)?.forEach(h => h(p)); }),
      off: vi.fn(), removeAllListeners: vi.fn(),
    },
    config: { get: vi.fn(), set: vi.fn() },
    registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(), has: vi.fn(), unregister: vi.fn() },
  } as unknown as ISystemDeps;
};

const saveData = (o: Partial<TutorialSaveData> = {}): TutorialSaveData => ({
  version: TUTORIAL_SAVE_VERSION, currentPhase: 'not_started', completedSteps: [],
  completedEvents: [], currentStepId: null, currentSubStepIndex: 0,
  tutorialStartTime: null, transitionLogs: [], dailyReplayCount: 0,
  lastReplayDate: '', protectionStartTime: null, ...o,
});

const createEnv = () => {
  const deps = mockDeps();
  const sm = new TutorialStateMachine(); sm.init(deps);
  const mgr = new TutorialStepManager(); mgr.init(deps); mgr.setStateMachine(sm);
  return { deps, sm, mgr };
};

const gameState = (o: Partial<TutorialGameState> = {}): TutorialGameState => ({
  castleLevel: 1, heroCount: 0, battleCount: 0, techCount: 0,
  allianceJoined: false, firstAlliance: false, bagCapacityPercent: 0, ...o,
});

/** 完成当前活跃步骤的所有子步骤 */
const finishStep = (mgr: TutorialStepManager) => {
  const id = mgr.getState().activeStepId;
  if (!id) return;
  const def = STEP_DEFINITION_MAP[id];
  if (!def) return;
  for (let i = 0; i < def.subSteps.length; i++) mgr.advanceSubStep();
};

/** 完成核心步骤1..n */
const completeCoreSteps = (mgr: TutorialStepManager, count: number) => {
  const ids: TutorialStepId[] = [
    'step1_castle_overview', 'step2_build_farm', 'step3_recruit_hero',
    'step4_first_battle', 'step5_check_resources', 'step6_tech_research',
  ];
  for (let i = 0; i < Math.min(count, ids.length); i++) {
    mgr.startStep(ids[i]);
    finishStep(mgr);
  }
};

// ═══════════════════════════════════════════════
// F-Normal: 正常流程
// ═══════════════════════════════════════════════

describe('引导模块对抗测试 — F-Normal', () => {

  describe('引导初始化', () => {
    it('状态机初始阶段为 not_started', () => {
      const sm = new TutorialStateMachine(); sm.init(mockDeps());
      expect(sm.getCurrentPhase()).toBe('not_started');
    });
    it('首次启动检测返回 isFirstLaunch=true', () => {
      const d = mockDeps(); const sm = new TutorialStateMachine(); sm.init(d);
      const det = new FirstLaunchDetector(); det.init(d); det.setStateMachine(sm);
      expect(det.detectFirstLaunch().isFirstLaunch).toBe(true);
    });
    it('first_enter: not_started → core_guiding', () => {
      const { sm } = createEnv();
      const r = sm.transition('first_enter');
      expect(r.success).toBe(true); expect(sm.getCurrentPhase()).toBe('core_guiding');
    });
    it('步骤管理器初始无活跃步骤', () => {
      const { mgr } = createEnv();
      expect(mgr.getState().activeStepId).toBeNull();
      expect(mgr.getCurrentSubStep()).toBeNull();
    });
  });

  describe('步骤触发与执行', () => {
    it('getNextStep 返回 step1_castle_overview', () => {
      const { mgr } = createEnv();
      const next = mgr.getNextStep();
      expect(next?.stepId).toBe('step1_castle_overview');
    });
    it('开始步骤1成功', () => {
      const { mgr, sm } = createEnv(); sm.transition('first_enter');
      const r = mgr.startStep('step1_castle_overview');
      expect(r.success).toBe(true); expect(r.step).toBeDefined();
      expect(mgr.getState().activeStepId).toBe('step1_castle_overview');
    });
    it('步骤1有5个子步骤', () => {
      expect(STEP_DEFINITION_MAP['step1_castle_overview'].subSteps).toHaveLength(5);
    });
    it('推进子步骤直到完成', () => {
      const { mgr, sm } = createEnv(); sm.transition('first_enter');
      mgr.startStep('step1_castle_overview');
      const def = STEP_DEFINITION_MAP['step1_castle_overview'];
      for (let i = 0; i < def.subSteps.length - 1; i++) mgr.advanceSubStep();
      const final = mgr.advanceSubStep();
      expect(final.completed).toBe(true);
    });
  });

  describe('步骤完成与奖励', () => {
    it('完成步骤1记录到状态机', () => {
      const { mgr, sm } = createEnv(); sm.transition('first_enter');
      mgr.startStep('step1_castle_overview'); finishStep(mgr);
      expect(sm.isStepCompleted('step1_castle_overview')).toBe(true);
    });
    it('完成步骤1发放奖励', () => {
      const { mgr, sm, deps } = createEnv(); sm.transition('first_enter');
      mgr.startStep('step1_castle_overview'); finishStep(mgr);
      expect(deps.eventBus.emit).toHaveBeenCalledWith('tutorial:rewardGranted',
        expect.objectContaining({ source: 'step1_castle_overview', rewards: expect.arrayContaining([expect.objectContaining({ rewardId: 'copper', amount: 200 })]) }));
    });
    it('完成步骤6触发阶段奖励「初出茅庐」', () => {
      const { mgr, sm, deps } = createEnv(); sm.transition('first_enter');
      completeCoreSteps(mgr, 6);
      expect(deps.eventBus.emit).toHaveBeenCalledWith('tutorial:rewardGranted',
        expect.objectContaining({ source: 'step6_tech_research', rewards: expect.arrayContaining([expect.objectContaining({ amount: 2000 })]) }));
    });
    it('getNextStep 返回下一个未完成步骤', () => {
      const { mgr, sm } = createEnv(); sm.transition('first_enter');
      mgr.startStep('step1_castle_overview'); finishStep(mgr);
      expect(mgr.getNextStep()?.stepId).toBe('step2_build_farm');
    });
  });

  describe('条件检查', () => {
    it('前置步骤未完成时无法开始', () => {
      const { mgr, sm } = createEnv(); sm.transition('first_enter');
      expect(mgr.startStep('step2_build_farm').success).toBe(false);
    });
    it('扩展引导 building_level>=3 触发 step7', () => {
      const d = mockDeps(); const sm = new TutorialStateMachine(); sm.init(d);
      const ex = new TutorialStepExecutor(); ex.init(d); ex.setStateMachine(sm);
      expect(ex.checkExtendedStepTriggers(gameState({ castleLevel: 3 }))?.stepId).toBe('step7_advisor_suggest');
    });
    it('扩展引导 battle_count>=3 触发 step8', () => {
      const d = mockDeps(); const sm = new TutorialStateMachine(); sm.init(d);
      const ex = new TutorialStepExecutor(); ex.init(d); ex.setStateMachine(sm);
      sm.completeStep('step7_advisor_suggest');
      expect(ex.checkExtendedStepTriggers(gameState({ battleCount: 3 }))?.stepId).toBe('step8_semi_auto_battle');
    });
    it('条件不满足不触发', () => {
      const d = mockDeps(); const sm = new TutorialStateMachine(); sm.init(d);
      const ex = new TutorialStepExecutor(); ex.init(d); ex.setStateMachine(sm);
      expect(ex.checkExtendedStepTriggers(gameState({ castleLevel: 1 }))).toBeNull();
    });
  });

  describe('剧情触发评估', () => {
    it('first_recruit 条件满足触发 e3', () => {
      const ev = new StoryTriggerEvaluator();
      const ck = { isStoryEventCompleted: vi.fn().mockReturnValue(false) };
      expect(ev.checkTriggerConditions(ck, { firstRecruit: true, castleLevel: 1, battleCount: 0, allianceJoined: false, techCount: 0 })?.eventId).toBe('e3_three_visits');
    });
    it('条件不满足返回 null', () => {
      const ev = new StoryTriggerEvaluator();
      const ck = { isStoryEventCompleted: vi.fn().mockReturnValue(false) };
      expect(ev.checkTriggerConditions(ck, { firstRecruit: false, castleLevel: 1, battleCount: 0, allianceJoined: false, techCount: 0 })).toBeNull();
    });
  });
});

// ═══════════════════════════════════════════════
// F-Error: 错误路径
// ═══════════════════════════════════════════════

describe('引导模块对抗测试 — F-Error', () => {

  describe('非法状态转换', () => {
    it('not_started 不允许 explore_done', () => {
      const sm = new TutorialStateMachine(); sm.init(mockDeps());
      expect(sm.transition('explore_done').success).toBe(false);
    });
    it('not_started 不允许 condition_trigger', () => {
      const sm = new TutorialStateMachine(); sm.init(mockDeps());
      expect(sm.transition('condition_trigger').success).toBe(false);
    });
    it('core_guiding 不允许 explore_done', () => {
      const sm = new TutorialStateMachine(); sm.init(mockDeps());
      sm.transition('first_enter');
      expect(sm.transition('explore_done').success).toBe(false);
    });
  });

  describe('步骤执行错误', () => {
    it('无活跃步骤时 advanceSubStep 返回空结果', () => {
      const { mgr } = createEnv();
      const r = mgr.advanceSubStep();
      expect(r.completed).toBe(false); expect(r.rewards).toHaveLength(0);
    });
    it('不存在的步骤ID无法开始', () => {
      const { mgr, sm } = createEnv(); sm.transition('first_enter');
      const r = mgr.startStep('step_nonexistent' as TutorialStepId);
      expect(r.success).toBe(false); expect(r.reason).toContain('不存在');
    });
    it('已完成步骤不能再次开始（非重玩模式）', () => {
      const { mgr, sm } = createEnv(); sm.transition('first_enter');
      mgr.startStep('step1_castle_overview'); finishStep(mgr);
      expect(mgr.startStep('step1_castle_overview').success).toBe(false);
    });
    it('无状态机时 startStep 失败', () => {
      const mgr = new TutorialStepManager(); mgr.init(mockDeps());
      expect(mgr.startStep('step1_castle_overview').success).toBe(false);
    });
    it('无状态机时 getNextStep 返回 null', () => {
      const mgr = new TutorialStepManager(); mgr.init(mockDeps());
      expect(mgr.getNextStep()).toBeNull();
      expect(mgr.getNextCoreStep()).toBeNull();
    });
  });

  describe('加速机制错误', () => {
    it('无活跃步骤时不能加速', () => {
      const { mgr } = createEnv();
      expect(mgr.activateAcceleration('dialogue_tap').success).toBe(false);
    });
    it('不可跳过步骤禁止 story_skip', () => {
      const { mgr, sm } = createEnv(); sm.transition('first_enter');
      mgr.startStep('step1_castle_overview');
      expect(mgr.activateAcceleration('story_skip').reason).toContain('不可跳过');
    });
    it('不可跳过步骤禁止 quick_complete', () => {
      const { mgr, sm } = createEnv(); sm.transition('first_enter');
      mgr.startStep('step1_castle_overview');
      expect(mgr.activateAcceleration('quick_complete').success).toBe(false);
    });
  });

  describe('重玩错误', () => {
    it('超过每日重玩上限时失败', () => {
      const { mgr } = createEnv();
      for (let i = 0; i < GUIDE_REPLAY_DAILY_LIMIT; i++) { mgr.startReplay('watch'); mgr.endReplay(); }
      expect(mgr.startReplay('watch').reason).toContain('上限');
    });
  });
});

// ═══════════════════════════════════════════════
// F-Boundary: 边界条件
// ═══════════════════════════════════════════════

describe('引导模块对抗测试 — F-Boundary', () => {

  describe('NaN 与无效值', () => {
    it('loadSaveData: NaN currentSubStepIndex 通过 typeof 检查（已知行为）', () => {
      const sm = new TutorialStateMachine(); sm.init(mockDeps());
      sm.loadSaveData(saveData({ currentSubStepIndex: NaN }));
      // typeof NaN === 'number' → 直接通过校验，这是已知行为
      expect(sm.getState().currentSubStepIndex).toBeNaN();
    });
    it('loadSaveData: undefined currentStepId 回退为 null', () => {
      const sm = new TutorialStateMachine(); sm.init(mockDeps());
      sm.loadSaveData(saveData({ currentStepId: undefined as any }));
      expect(sm.getState().currentStepId).toBeNull();
    });
    it('applyResourceDiscount(0) 在保护期内返回 0', () => {
      const d = mockDeps(); const sm = new TutorialStateMachine(); sm.init(d);
      const det = new FirstLaunchDetector(); det.init(d); det.setStateMachine(sm);
      sm.transition('first_enter');
      expect(det.applyResourceDiscount(0)).toBe(0);
    });
    it('applyBattleDifficulty(0) 返回 0', () => {
      const d = mockDeps(); const sm = new TutorialStateMachine(); sm.init(d);
      const det = new FirstLaunchDetector(); det.init(d); det.setStateMachine(sm);
      sm.transition('first_enter');
      expect(det.applyBattleDifficulty(0)).toBe(0);
    });
  });

  describe('空ID与重复数据', () => {
    it('completeStep 重复调用不重复记录', () => {
      const sm = new TutorialStateMachine(); sm.init(mockDeps());
      sm.completeStep('step1_castle_overview');
      sm.completeStep('step1_castle_overview');
      expect(sm.getCompletedStepCount()).toBe(1);
    });
    it('completeStoryEvent 重复调用不重复记录', () => {
      const sm = new TutorialStateMachine(); sm.init(mockDeps());
      sm.completeStoryEvent('e1_peach_garden');
      sm.completeStoryEvent('e1_peach_garden');
      expect(sm.getState().completedEvents).toHaveLength(1);
    });
    it('serialize 空状态机返回完整结构', () => {
      const sm = new TutorialStateMachine(); sm.init(mockDeps());
      const d = sm.serialize();
      expect(d.version).toBe(TUTORIAL_SAVE_VERSION);
      expect(d.completedSteps).toEqual([]);
      expect(d.currentPhase).toBe('not_started');
    });
  });

  describe('边界数值与查询', () => {
    it('getStepDefinition 正确/不存在', () => {
      const { mgr } = createEnv();
      expect(mgr.getStepDefinition('step1_castle_overview')?.category).toBe('core');
      expect(mgr.getStepDefinition('nonexistent' as TutorialStepId)).toBeNull();
    });
    it('步骤定义数量正确', () => {
      const { mgr } = createEnv();
      expect(mgr.getAllStepDefinitions()).toHaveLength(12);
      expect(mgr.getCoreStepDefinitions()).toHaveLength(6);
      expect(mgr.getExtendedStepDefinitions()).toHaveLength(6);
      expect(mgr.getPhaseRewards()).toHaveLength(2);
    });
    it('getRemainingReplayCount 初始为上限', () => {
      const { mgr } = createEnv();
      expect(mgr.getRemainingReplayCount()).toBe(GUIDE_REPLAY_DAILY_LIMIT);
    });
  });

  describe('画质检测边界', () => {
    const qualityCase = (cores: number, mem: number, expected: string) => {
      const d = mockDeps(); const sm = new TutorialStateMachine(); sm.init(d);
      const det = new FirstLaunchDetector(); det.init(d); det.setStateMachine(sm);
      det.setHardwareInfoProvider(() => ({ cpuCores: cores, memoryGB: mem, gpuRenderer: '', devicePixelRatio: 1 }));
      expect(det.detectFirstLaunch().recommendedQuality).toBe(expected);
    };
    it('4核+3.99GB → medium (0.1容差)', () => qualityCase(4, 3.99, 'medium'));
    it('8核+8GB → high', () => qualityCase(8, 8, 'high'));
    it('1核+1GB → low', () => qualityCase(1, 1, 'low'));
  });
});

// ═══════════════════════════════════════════════
// F-Cross: 跨系统联动
// ═══════════════════════════════════════════════

describe('引导模块对抗测试 — F-Cross', () => {

  describe('完整引导流程', () => {
    it('首次启动→核心引导→自由探索→自由游戏', () => {
      const { deps, sm, mgr } = createEnv();
      sm.transition('first_enter');
      expect(sm.getCurrentPhase()).toBe('core_guiding');

      completeCoreSteps(mgr, 6);
      expect(sm.isStepCompleted('step6_tech_research')).toBe(true);

      sm.transition('step6_complete');
      expect(sm.getCurrentPhase()).toBe('free_explore');

      sm.transition('explore_done');
      expect(sm.getCurrentPhase()).toBe('free_play');
      expect(deps.eventBus.emit).toHaveBeenCalledWith('tutorial:completed', expect.objectContaining({ timestamp: expect.any(Number) }));
    });

    it('free_play → mini_tutorial → free_play', () => {
      const sm = new TutorialStateMachine(); sm.init(mockDeps());
      sm.transition('first_enter'); sm.transition('step6_complete'); sm.transition('explore_done');
      expect(sm.getCurrentPhase()).toBe('free_play');
      sm.transition('condition_trigger');
      expect(sm.getCurrentPhase()).toBe('mini_tutorial');
      sm.transition('mini_done');
      expect(sm.getCurrentPhase()).toBe('free_play');
    });

    it('非首次进入直接进入自由游戏', () => {
      const sm = new TutorialStateMachine(); sm.init(mockDeps());
      sm.enterAsReturning();
      expect(sm.getCurrentPhase()).toBe('free_play');
      expect(sm.isFirstLaunch()).toBe(false);
    });
  });

  describe('新手保护联动', () => {
    it('首次进入后保护激活', () => {
      const d = mockDeps(); const sm = new TutorialStateMachine(); sm.init(d);
      const det = new FirstLaunchDetector(); det.init(d); det.setStateMachine(sm);
      sm.transition('first_enter');
      expect(det.isNewbieProtectionActive()).toBe(true);
      expect(det.getResourceCostDiscount()).toBe(0.5);
      expect(det.getBattleDifficultyFactor()).toBe(0.7);
      expect(det.isPositiveEventsOnly()).toBe(true);
    });
    it('非首次进入无保护', () => {
      const d = mockDeps(); const sm = new TutorialStateMachine(); sm.init(d);
      const det = new FirstLaunchDetector(); det.init(d); det.setStateMachine(sm);
      sm.enterAsReturning();
      expect(det.isNewbieProtectionActive()).toBe(false);
      expect(det.getResourceCostDiscount()).toBe(1);
      expect(det.getBattleDifficultyFactor()).toBe(1);
      expect(det.isPositiveEventsOnly()).toBe(false);
    });
    it('资源折扣: 100→50, 99→49', () => {
      const d = mockDeps(); const sm = new TutorialStateMachine(); sm.init(d);
      const det = new FirstLaunchDetector(); det.init(d); det.setStateMachine(sm);
      sm.transition('first_enter');
      expect(det.applyResourceDiscount(100)).toBe(50);
      expect(det.applyResourceDiscount(99)).toBe(49);
    });
  });

  describe('步骤管理器+状态机+事件联动', () => {
    it('completeStep 触发 tutorial:stepCompleted', () => {
      const d = mockDeps(); const sm = new TutorialStateMachine(); sm.init(d);
      sm.completeStep('step1_castle_overview');
      expect(d.eventBus.emit).toHaveBeenCalledWith('tutorial:stepCompleted',
        expect.objectContaining({ stepId: 'step1_castle_overview' }));
    });
    it('transition 触发 tutorial:phaseChanged', () => {
      const d = mockDeps(); const sm = new TutorialStateMachine(); sm.init(d);
      sm.transition('first_enter');
      expect(d.eventBus.emit).toHaveBeenCalledWith('tutorial:phaseChanged',
        expect.objectContaining({ from: 'not_started', to: 'core_guiding', event: 'first_enter' }));
    });
  });

  describe('存档恢复联动', () => {
    it('序列化→反序列化保持完整状态', () => {
      const sm = new TutorialStateMachine(); sm.init(mockDeps());
      sm.transition('first_enter');
      sm.completeStep('step1_castle_overview');
      sm.completeStep('step2_build_farm');
      sm.completeStoryEvent('e1_peach_garden');
      const saved = sm.serialize();

      const sm2 = new TutorialStateMachine(); sm2.init(mockDeps());
      sm2.loadSaveData(saved);
      expect(sm2.getCurrentPhase()).toBe('core_guiding');
      expect(sm2.isStepCompleted('step1_castle_overview')).toBe(true);
      expect(sm2.isStepCompleted('step2_build_farm')).toBe(true);
      expect(sm2.isStoryEventCompleted('e1_peach_garden')).toBe(true);
    });
    it('冲突解决取并集最大进度', () => {
      const sm = new TutorialStateMachine(); sm.init(mockDeps());
      const merged = sm.resolveConflict(
        saveData({ currentPhase: 'core_guiding', completedSteps: ['step1_castle_overview', 'step2_build_farm'], completedEvents: ['e1_peach_garden'] }),
        saveData({ currentPhase: 'free_explore', completedSteps: ['step1_castle_overview', 'step3_recruit_hero'], completedEvents: ['e2_yellow_turban'] }),
      );
      expect(merged.currentPhase).toBe('free_explore');
      expect(merged.completedSteps).toHaveLength(3);
      expect(merged.completedEvents).toHaveLength(2);
    });
  });

  describe('不可跳过步骤联动', () => {
    it('UNSKIPPABLE_STEPS 包含3个步骤', () => {
      expect(UNSKIPPABLE_STEPS).toEqual(['step1_castle_overview', 'step2_build_farm', 'step4_first_battle']);
    });
    it('不可跳过步骤允许 dialogue_tap', () => {
      const { mgr, sm } = createEnv(); sm.transition('first_enter');
      mgr.startStep('step1_castle_overview');
      expect(mgr.activateAcceleration('dialogue_tap').success).toBe(true);
    });
    it('不可跳过步骤允许 animation_speed', () => {
      const { mgr, sm } = createEnv(); sm.transition('first_enter');
      mgr.startStep('step1_castle_overview');
      expect(mgr.activateAcceleration('animation_speed').success).toBe(true);
    });
    it('可跳过步骤允许 story_skip', () => {
      const { mgr, sm } = createEnv(); sm.transition('first_enter');
      completeCoreSteps(mgr, 2);
      mgr.startStep('step3_recruit_hero');
      expect(mgr.isUnskippable('step3_recruit_hero')).toBe(false);
      expect(mgr.activateAcceleration('story_skip').success).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════
// F-Lifecycle: 生命周期 / 序列化
// ═══════════════════════════════════════════════

describe('引导模块对抗测试 — F-Lifecycle', () => {

  describe('重置', () => {
    it('TutorialStateMachine.reset', () => {
      const sm = new TutorialStateMachine(); sm.init(mockDeps());
      sm.transition('first_enter'); sm.completeStep('step1_castle_overview');
      sm.reset();
      expect(sm.getCurrentPhase()).toBe('not_started');
      expect(sm.getCompletedStepCount()).toBe(0);
    });
    it('TutorialStepManager.reset', () => {
      const { mgr, sm } = createEnv(); sm.transition('first_enter');
      mgr.startStep('step1_castle_overview'); mgr.reset();
      expect(mgr.getState().activeStepId).toBeNull();
    });
    it('FirstLaunchDetector.reset', () => {
      const d = mockDeps(); const sm = new TutorialStateMachine(); sm.init(d);
      const det = new FirstLaunchDetector(); det.init(d); det.setStateMachine(sm);
      det.detectFirstLaunch(); det.reset();
      expect(det.getState().launchCompleted).toBe(false);
    });
  });

  describe('序列化完整性', () => {
    it('serialize 包含所有必要字段', () => {
      const sm = new TutorialStateMachine(); sm.init(mockDeps());
      const data = sm.serialize();
      ['version','currentPhase','completedSteps','completedEvents','currentStepId',
       'currentSubStepIndex','tutorialStartTime','transitionLogs','dailyReplayCount',
       'lastReplayDate','protectionStartTime'].forEach(f => expect(data).toHaveProperty(f));
    });
    it('loadSaveData 处理 null 数组字段', () => {
      const sm = new TutorialStateMachine(); sm.init(mockDeps());
      sm.loadSaveData(saveData({ completedSteps: null as any, completedEvents: null as any, transitionLogs: null as any }));
      expect(sm.getState().completedSteps).toEqual([]);
      expect(sm.getState().completedEvents).toEqual([]);
    });
    it('loadSaveData 处理非法 phase', () => {
      const sm = new TutorialStateMachine(); sm.init(mockDeps());
      sm.loadSaveData(saveData({ currentPhase: 'INVALID' as TutorialPhase }));
      expect(sm.getCurrentPhase()).toBe('not_started');
    });
    it('serialize→loadSaveData 往返一致', () => {
      const sm = new TutorialStateMachine(); sm.init(mockDeps());
      sm.transition('first_enter'); sm.completeStep('step1_castle_overview'); sm.completeStoryEvent('e1_peach_garden');
      const saved = sm.serialize();
      const sm2 = new TutorialStateMachine(); sm2.init(mockDeps());
      sm2.loadSaveData(saved);
      expect(sm2.getCurrentPhase()).toBe('core_guiding');
      expect(sm2.isStepCompleted('step1_castle_overview')).toBe(true);
      expect(sm2.isStoryEventCompleted('e1_peach_garden')).toBe(true);
    });
  });

  describe('重玩生命周期', () => {
    it('startReplay → endReplay 完整流程', () => {
      const { mgr } = createEnv();
      expect(mgr.startReplay('watch').success).toBe(true);
      expect(mgr.isReplaying()).toBe(true);
      const reward = mgr.endReplay();
      expect(reward?.rewardId).toBe(GUIDE_REPLAY_REWARD.rewardId);
      expect(mgr.isReplaying()).toBe(false);
    });
    it('重玩消耗次数', () => {
      const { mgr } = createEnv();
      const before = mgr.getRemainingReplayCount();
      mgr.startReplay('interactive'); mgr.endReplay();
      expect(mgr.getRemainingReplayCount()).toBe(before - 1);
    });
    it('跨日重玩次数重置', () => {
      const { mgr } = createEnv();
      for (let i = 0; i < GUIDE_REPLAY_DAILY_LIMIT; i++) { mgr.startReplay('watch'); mgr.endReplay(); }
      expect(mgr.getRemainingReplayCount()).toBe(0);
      // 直接修改内部 state（getState 返回副本不影响内部）
      (mgr as any).state.lastReplayDate = '2000-01-01';
      expect(mgr.getRemainingReplayCount()).toBe(GUIDE_REPLAY_DAILY_LIMIT);
    });
  });

  describe('加速生命周期', () => {
    const makeState = () => ({
      activeStepId: 'step3_recruit_hero' as TutorialStepId, currentSubStepIndex: 0,
      acceleration: null as any, dailyReplayCount: 0, lastReplayDate: '', replayMode: null as any,
    });
    it('animation_speed 设置 multiplier=3', () => {
      const d = mockDeps(); const sm = new TutorialStateMachine(); sm.init(d);
      const ex = new TutorialStepExecutor(); ex.init(d); ex.setStateMachine(sm);
      const s = makeState();
      ex.activateAcceleration(s, 'animation_speed');
      expect(s.acceleration.multiplier).toBe(3);
    });
    it('dialogue_tap multiplier=1', () => {
      const d = mockDeps(); const sm = new TutorialStateMachine(); sm.init(d);
      const ex = new TutorialStepExecutor(); ex.init(d); ex.setStateMachine(sm);
      const s = makeState();
      ex.activateAcceleration(s, 'dialogue_tap');
      expect(s.acceleration.multiplier).toBe(1);
    });
    it('deactivateAcceleration 清除状态', () => {
      const d = mockDeps(); const sm = new TutorialStateMachine(); sm.init(d);
      const ex = new TutorialStepExecutor(); ex.init(d); ex.setStateMachine(sm);
      const s = makeState();
      ex.activateAcceleration(s, 'dialogue_tap');
      expect(s.acceleration).not.toBeNull();
      ex.deactivateAcceleration(s);
      expect(s.acceleration).toBeNull();
    });
  });

  describe('首次启动流程生命周期', () => {
    it('executeFirstLaunchFlow 完整流程', async () => {
      const d = mockDeps(); const sm = new TutorialStateMachine(); sm.init(d);
      const det = new FirstLaunchDetector(); det.init(d); det.setStateMachine(sm);
      const r = await det.executeFirstLaunchFlow();
      expect(r.currentStep).toBe('completed');
      expect(det.isLaunchCompleted()).toBe(true);
    });
    it('handleReturningUser 跳过流程', () => {
      const d = mockDeps(); const sm = new TutorialStateMachine(); sm.init(d);
      const det = new FirstLaunchDetector(); det.init(d); det.setStateMachine(sm);
      det.handleReturningUser();
      expect(sm.getCurrentPhase()).toBe('free_play');
      expect(det.getFlowState().isFirstLaunch).toBe(false);
    });
    it('权限请求异常不中断流程', async () => {
      const d = mockDeps(); const sm = new TutorialStateMachine(); sm.init(d);
      const det = new FirstLaunchDetector(); det.init(d); det.setStateMachine(sm);
      const r = await det.executeFirstLaunchFlow(async () => { throw new Error('fail'); });
      expect(r.currentStep).toBe('completed');
      expect(r.permissionStatus.storage).toBe(false);
    });
  });
});
