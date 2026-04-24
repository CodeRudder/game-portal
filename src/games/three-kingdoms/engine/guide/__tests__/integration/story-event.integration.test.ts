/**
 * 集成测试 — §2 剧情事件
 *
 * 覆盖：E1桃园结义、E2~E8剧情排队、触发时序、完成条件
 * 验证：StoryEventPlayer + TutorialStateMachine + TutorialStepManager 联动
 *
 * @module engine/guide/__tests__/integration/story-event
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TutorialStateMachine } from '../../TutorialStateMachine';
import { TutorialStepManager } from '../../TutorialStepManager';
import { StoryEventPlayer } from '../../StoryEventPlayer';
import { CORE_STEP_DEFINITIONS, STORY_EVENT_DEFINITIONS } from '../../../../core/guide/guide-config';
import type { StoryGameState } from '../../StoryEventPlayer.types';

// ─────────────────────────────────────────────
// 测试基础设施
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
      get: vi.fn(),
      register: vi.fn(),
      getAll: vi.fn(() => new Map()),
      has: vi.fn(),
      unregister: vi.fn(),
    },
  };
}

function createSystemBundle() {
  const deps = createMockDeps();
  const stateMachine = new TutorialStateMachine();
  const stepManager = new TutorialStepManager();
  const storyPlayer = new StoryEventPlayer();

  stateMachine.init(deps);
  stepManager.init(deps);
  storyPlayer.init(deps);

  stepManager.setStateMachine(stateMachine);
  storyPlayer.setStateMachine(stateMachine);

  return { deps, stateMachine, stepManager, storyPlayer };
}

function completeStep(stepManager: TutorialStepManager, stepId: string) {
  const result = stepManager.startStep(stepId as any);
  if (!result.success) return result;
  const definition = result.step!;
  for (let i = 0; i < definition.subSteps.length; i++) {
    stepManager.advanceSubStep();
  }
  return result;
}

/** 快速播放完所有对话行 */
function playAllDialogues(storyPlayer: StoryEventPlayer) {
  const progress = storyPlayer.getPlayProgress();
  const definition = storyPlayer.getStoryEventDefinition(progress.eventId!);
  if (!definition) return;
  for (let i = 0; i < definition.dialogues.length; i++) {
    storyPlayer.tap(); // reveal line
    if (i < definition.dialogues.length - 1) {
      storyPlayer.tap(); // next line
    }
  }
}

// ─────────────────────────────────────────────
// §2 剧情事件集成测试
// ─────────────────────────────────────────────

describe('§2 剧情事件集成测试', () => {
  let bundle: ReturnType<typeof createSystemBundle>;

  beforeEach(() => {
    bundle = createSystemBundle();
  });

  // ─── §2.1 E1桃园结义播放 ─────────────────

  describe('§2.1 E1桃园结义播放', () => {
    beforeEach(() => {
      bundle.stateMachine.transition('first_enter');
    });

    it('应能成功启动E1桃园结义', () => {
      const result = bundle.storyPlayer.startEvent('e1_peach_garden');
      expect(result.success).toBe(true);
      const progress = bundle.storyPlayer.getPlayProgress();
      expect(progress.state).toBe('playing');
      expect(progress.eventId).toBe('e1_peach_garden');
    });

    it('E1启动应发射storyTriggered事件', () => {
      bundle.storyPlayer.startEvent('e1_peach_garden');
      expect(bundle.deps.eventBus.emit).toHaveBeenCalledWith(
        'tutorial:storyTriggered',
        expect.objectContaining({ eventId: 'e1_peach_garden' }),
      );
    });

    it('E1对话应包含6行（旁白+刘备+关羽+张飞+旁白+旁白）', () => {
      const def = bundle.storyPlayer.getStoryEventDefinition('e1_peach_garden');
      expect(def).not.toBeNull();
      expect(def!.dialogues.length).toBe(6);
    });

    it('E1点击推进应逐步揭示对话', () => {
      bundle.storyPlayer.startEvent('e1_peach_garden');
      // 第一次点击：揭示第一行完整文本
      const tap1 = bundle.storyPlayer.tap();
      expect(tap1.action).toBe('reveal_line');
      // 第二次点击：推进到第二行（刘备）
      const tap2 = bundle.storyPlayer.tap();
      expect(tap2.action).toBe('next_line');
      expect(tap2.line?.speaker).toBe('刘备');
    });

    it('E1全部对话完成后tap返回complete', () => {
      bundle.storyPlayer.startEvent('e1_peach_garden');
      playAllDialogues(bundle.storyPlayer);
      const finalTap = bundle.storyPlayer.tap();
      expect(finalTap.action).toBe('complete');
    });

    it('E1剧情应包含奖励（铜钱500）', () => {
      const def = bundle.storyPlayer.getStoryEventDefinition('e1_peach_garden');
      expect(def!.rewards).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ rewardId: 'copper', amount: 500 }),
        ]),
      );
    });
  });

  // ─── §2.2 E2~E8剧情排队与触发 ─────────────

  describe('§2.2 E2~E8剧情排队与触发', () => {
    it('8段剧情事件应全部有定义', () => {
      const events = bundle.storyPlayer.getAllStoryEvents();
      expect(events.length).toBe(8);
      const ids = events.map(e => e.eventId);
      expect(ids).toContain('e1_peach_garden');
      expect(ids).toContain('e2_yellow_turban');
      expect(ids).toContain('e3_three_visits');
      expect(ids).toContain('e4_borrow_arrows');
      expect(ids).toContain('e5_red_cliff');
      expect(ids).toContain('e6_single_sword');
      expect(ids).toContain('e7_seven_captures');
      expect(ids).toContain('e8_unification');
    });

    it('播放中不能启动新剧情（排队机制）', () => {
      bundle.stateMachine.transition('first_enter');
      bundle.storyPlayer.startEvent('e1_peach_garden');
      const result = bundle.storyPlayer.startEvent('e2_yellow_turban');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('已有剧情正在播放');
    });

    it('E2黄巾之乱应在step3完成后触发', () => {
      bundle.stateMachine.transition('first_enter');
      const trigger = bundle.storyPlayer.checkStepTrigger('step3_recruit_hero');
      expect(trigger).not.toBeNull();
      expect(trigger!.eventId).toBe('e2_yellow_turban');
    });

    it('E4草船借箭应在step5完成后触发', () => {
      bundle.stateMachine.transition('first_enter');
      const trigger = bundle.storyPlayer.checkStepTrigger('step5_check_resources');
      expect(trigger).not.toBeNull();
      expect(trigger!.eventId).toBe('e4_borrow_arrows');
    });

    it('E3三顾茅庐应在first_recruit条件下触发', () => {
      bundle.stateMachine.transition('first_enter');
      const gameState: StoryGameState = {
        castleLevel: 1,
        battleCount: 0,
        techCount: 0,
        allianceJoined: false,
        firstRecruit: true,
      };
      const trigger = bundle.storyPlayer.checkTriggerConditions(gameState);
      expect(trigger).not.toBeNull();
      expect(trigger!.eventId).toBe('e3_three_visits');
    });

    it('E5赤壁之战应在castle_level>=5时触发', () => {
      bundle.stateMachine.transition('first_enter');
      const gameState: StoryGameState = {
        castleLevel: 5,
        battleCount: 0,
        techCount: 0,
        allianceJoined: false,
        firstRecruit: false,
      };
      const trigger = bundle.storyPlayer.checkTriggerConditions(gameState);
      expect(trigger).not.toBeNull();
      expect(trigger!.eventId).toBe('e5_red_cliff');
    });

    it('E6单刀赴会应在加入联盟后触发', () => {
      bundle.stateMachine.transition('first_enter');
      const gameState: StoryGameState = {
        castleLevel: 1,
        battleCount: 0,
        techCount: 0,
        allianceJoined: true,
        firstRecruit: false,
      };
      const trigger = bundle.storyPlayer.checkTriggerConditions(gameState);
      expect(trigger).not.toBeNull();
      expect(trigger!.eventId).toBe('e6_single_sword');
    });

    it('E7七擒孟获应在tech_count>=4时触发', () => {
      bundle.stateMachine.transition('first_enter');
      const gameState: StoryGameState = {
        castleLevel: 1,
        battleCount: 0,
        techCount: 4,
        allianceJoined: false,
        firstRecruit: false,
      };
      const trigger = bundle.storyPlayer.checkTriggerConditions(gameState);
      expect(trigger).not.toBeNull();
      expect(trigger!.eventId).toBe('e7_seven_captures');
    });

    it('已完成剧情不应重复触发', () => {
      bundle.stateMachine.transition('first_enter');
      bundle.stateMachine.completeStoryEvent('e3_three_visits');
      const gameState: StoryGameState = {
        castleLevel: 1,
        battleCount: 0,
        techCount: 0,
        allianceJoined: false,
        firstRecruit: true,
      };
      const trigger = bundle.storyPlayer.checkTriggerConditions(gameState);
      // E3已完成，应跳过它返回null或下一个未完成事件
      if (trigger) {
        expect(trigger.eventId).not.toBe('e3_three_visits');
      }
    });
  });

  // ─── §2.3 触发时序验证 ─────────────────

  describe('§2.3 触发时序验证', () => {
    it('剧情触发优先级应按定义顺序', () => {
      bundle.stateMachine.transition('first_enter');
      // 同时满足多个条件时，应返回定义靠前的未完成事件
      const gameState: StoryGameState = {
        castleLevel: 5,
        battleCount: 10,
        techCount: 5,
        allianceJoined: true,
        firstRecruit: true,
      };
      const trigger = bundle.storyPlayer.checkTriggerConditions(gameState);
      // E3 first_recruit靠前，应优先返回
      expect(trigger).not.toBeNull();
      expect(trigger!.eventId).toBe('e3_three_visits');
    });

    it('无剧情满足条件时应返回null', () => {
      bundle.stateMachine.transition('first_enter');
      // 完成所有剧情
      for (const event of STORY_EVENT_DEFINITIONS) {
        bundle.stateMachine.completeStoryEvent(event.eventId);
      }
      const gameState: StoryGameState = {
        castleLevel: 10,
        battleCount: 100,
        techCount: 20,
        allianceJoined: true,
        firstRecruit: true,
      };
      const trigger = bundle.storyPlayer.checkTriggerConditions(gameState);
      expect(trigger).toBeNull();
    });

    it('不存在的剧情事件ID应返回null', () => {
      const def = bundle.storyPlayer.getStoryEventDefinition('e99_nonexistent' as any);
      expect(def).toBeNull();
    });
  });

  // ─── §2.4 完成条件与奖励 ─────────────────

  describe('§2.4 完成条件与奖励', () => {
    beforeEach(() => {
      bundle.stateMachine.transition('first_enter');
    });

    it('剧情跳过后仍应发放奖励', () => {
      bundle.storyPlayer.startEvent('e1_peach_garden');
      bundle.storyPlayer.requestSkip();
      const result = bundle.storyPlayer.confirmSkip();
      expect(result.success).toBe(true);
      expect(result.rewards.length).toBeGreaterThan(0);
      expect(result.transitionEffect).toBe('ink_wash');
    });

    it('剧情完成后应记录到状态机completedEvents', () => {
      bundle.storyPlayer.startEvent('e1_peach_garden');
      bundle.storyPlayer.requestSkip();
      bundle.storyPlayer.confirmSkip();
      // confirmSkip内部调用completeEvent → stateMachine.completeStoryEvent
      expect(bundle.stateMachine.isStoryEventCompleted('e1_peach_garden')).toBe(true);
    });

    it('剧情完成后应发射storyCompleted事件', () => {
      bundle.storyPlayer.startEvent('e1_peach_garden');
      bundle.storyPlayer.requestSkip();
      bundle.storyPlayer.confirmSkip();
      expect(bundle.deps.eventBus.emit).toHaveBeenCalledWith(
        'tutorial:storyCompleted',
        expect.objectContaining({ eventId: 'e1_peach_garden', skipped: true }),
      );
    });

    it('E8三国归一应包含多个奖励', () => {
      const def = bundle.storyPlayer.getStoryEventDefinition('e8_unification');
      expect(def!.rewards.length).toBeGreaterThanOrEqual(2);
    });

    it('暂停与恢复应正确切换播放状态', () => {
      bundle.storyPlayer.startEvent('e1_peach_garden');
      expect(bundle.storyPlayer.getPlayProgress().state).toBe('playing');
      bundle.storyPlayer.pause();
      expect(bundle.storyPlayer.getPlayProgress().state).toBe('paused');
      bundle.storyPlayer.resume();
      expect(bundle.storyPlayer.getPlayProgress().state).toBe('playing');
    });

    it('打字机加速应正确设置accelerated标志', () => {
      bundle.storyPlayer.startEvent('e1_peach_garden');
      bundle.storyPlayer.setAccelerated(true);
      expect(bundle.storyPlayer.getPlayProgress().accelerated).toBe(true);
      bundle.storyPlayer.setAccelerated(false);
      expect(bundle.storyPlayer.getPlayProgress().accelerated).toBe(false);
    });
  });

  // ─── §2.5 剧情与步骤联动 ─────────────────

  describe('§2.5 剧情与步骤联动', () => {
    it('完成步骤3后应能触发E2剧情', () => {
      bundle.stateMachine.transition('first_enter');
      completeStep(bundle.stepManager, 'step1_castle_overview');
      completeStep(bundle.stepManager, 'step2_build_farm');
      completeStep(bundle.stepManager, 'step3_recruit_hero');
      // 检查E2是否可以触发
      const trigger = bundle.storyPlayer.checkStepTrigger('step3_recruit_hero');
      expect(trigger).not.toBeNull();
      expect(trigger!.eventId).toBe('e2_yellow_turban');
      // 可以播放E2
      const result = bundle.storyPlayer.startEvent('e2_yellow_turban');
      expect(result.success).toBe(true);
    });

    it('剧情完成后继续执行后续步骤', () => {
      bundle.stateMachine.transition('first_enter');
      completeStep(bundle.stepManager, 'step1_castle_overview');
      // 播放并完成E1
      bundle.storyPlayer.startEvent('e1_peach_garden');
      bundle.storyPlayer.requestSkip();
      bundle.storyPlayer.confirmSkip();
      // 继续步骤2
      const result = bundle.stepManager.startStep('step2_build_farm');
      expect(result.success).toBe(true);
    });
  });
});
