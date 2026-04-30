/**
 * 集成测试 — §2+§5+§8 剧情+遮罩+保护期
 *
 * 验证8段剧情E1~E8播放流程、遮罩聚焦/高亮/穿透、保护期30分钟参数。
 * 覆盖功能点：
 *   #5  8段剧情事件 — E1桃园结义/E2黄巾之乱/.../E8三国归一
 *   #6  剧情交互规则 — 点击推进+打字机30ms/字+跳过按钮+5秒自动播放
 *   #7  剧情触发时机 — 条件触发检测
 *   #12 剧情跳过规则 — 二次确认+水墨晕染过渡+不影响奖励
 *   #15 聚焦遮罩 — 半透明黑色遮罩+目标元素高亮裁切
 *   #16 引导气泡 — 目标元素旁气泡提示
 *   #18 新手保护机制 — 30分钟保护
 *   #8  引导进度存储 — 实时保存
 *
 * @module engine/guide/__tests__/integration/tutorial-story-mask-protection
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TutorialStateMachine } from '../../TutorialStateMachine';
import { TutorialStepManager } from '../../TutorialStepManager';
import { StoryEventPlayer } from '../../StoryEventPlayer';
import { TutorialMaskSystem } from '../../TutorialMaskSystem';
import { StoryTriggerEvaluator } from '../../StoryTriggerEvaluator';
import { TutorialStorage } from '../../TutorialStorage';
import {
  STORY_EVENT_DEFINITIONS,
  CORE_STEP_DEFINITIONS,
  EXTENDED_STEP_DEFINITIONS,
} from '../../../../core/guide/guide-config';
import {
  NEWBIE_PROTECTION_DURATION_MS,
  TYPEWRITER_SPEED_MS,
  AUTO_PLAY_DELAY_MS,
} from '../../../../core/guide/guide.types';
import type { StoryEventId, StoryGameState, TutorialSaveData } from '../../../../core/guide/guide.types';
import type { HighlightBounds } from '../../tutorial-mask-types';

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
  const maskSystem = new TutorialMaskSystem();
  const storage = new TutorialStorage();
  const triggerEvaluator = new StoryTriggerEvaluator();

  stateMachine.init(deps);
  stepManager.init(deps);
  storyPlayer.init(deps);
  maskSystem.init(deps);
  storage.init(deps);

  stepManager.setStateMachine(stateMachine);
  storyPlayer.setStateMachine(stateMachine);
  storage.setStateMachine(stateMachine);

  return { deps, stateMachine, stepManager, storyPlayer, maskSystem, storage, triggerEvaluator };
}

/** 完成指定步骤（含所有子步骤） */
function completeStep(stepManager: TutorialStepManager, stepId: string) {
  const result = stepManager.startStep(stepId as unknown as Record<string, unknown>);
  if (!result.success) return result;
  const definition = result.step!;
  for (let i = 0; i < definition.subSteps.length; i++) {
    stepManager.advanceSubStep();
  }
  return result;
}

/** 完整播放一个剧情事件（逐行点击） */
function playFullStory(storyPlayer: StoryEventPlayer, eventId: StoryEventId) {
  const result = storyPlayer.startEvent(eventId);
  if (!result.success) return result;
  const definition = storyPlayer.getStoryEventDefinition(eventId)!;
  for (let i = 0; i < definition.dialogues.length; i++) {
    storyPlayer.tap(); // reveal
    if (i < definition.dialogues.length - 1) {
      storyPlayer.tap(); // next_line
    }
  }
  storyPlayer.tap(); // complete
  return result;
}

/** 模拟元素位置查询 */
const mockBoundsProvider = (selector: string): HighlightBounds | null => {
  const map: Record<string, HighlightBounds> = {
    '#castle-overview': { x: 10, y: 20, width: 300, height: 200 },
    '#build-farm': { x: 50, y: 100, width: 200, height: 150 },
    '#recruit-hero': { x: 100, y: 50, width: 250, height: 180 },
    '#first-battle': { x: 0, y: 0, width: 400, height: 300 },
    '#resource-panel': { x: 20, y: 30, width: 350, height: 120 },
    '#tech-research': { x: 80, y: 90, width: 280, height: 160 },
  };
  return map[selector] ?? { x: 100, y: 200, width: 300, height: 150 };
};

// ─────────────────────────────────────────────
// §7.3 剧情+遮罩+保护期 集成测试
// ─────────────────────────────────────────────

describe('§7.3 剧情+遮罩+保护期 集成测试', () => {
  let bundle: ReturnType<typeof createSystemBundle>;

  beforeEach(() => {
    bundle = createSystemBundle();
    localStorage.clear();
  });

  // ─── §7.3.1 8段剧情E1~E8播放 ─────────

  describe('§7.3.1 8段剧情E1~E8播放', () => {
    const allEventIds: StoryEventId[] = [
      'e1_peach_garden',
      'e2_yellow_turban',
      'e3_three_visits',
      'e4_borrow_arrows',
      'e5_red_cliff',
      'e6_single_sword',
      'e7_seven_captures',
      'e8_unification',
    ];

    it('E1~E8应全部有定义且eventId唯一', () => {
      const ids = STORY_EVENT_DEFINITIONS.map(e => e.eventId);
      expect(ids).toHaveLength(8);
      expect(new Set(ids).size).toBe(8);
      expect(ids).toEqual(allEventIds);
    });

    it('E1桃园结义 — 首次进入触发，播放后标记完成', () => {
      bundle.stateMachine.transition('first_enter');
      const result = bundle.storyPlayer.startEvent('e1_peach_garden');
      expect(result.success).toBe(true);
      playFullStory(bundle.storyPlayer, 'e1_peach_garden');
      bundle.stateMachine.completeStoryEvent('e1_peach_garden');
      expect(bundle.stateMachine.isStoryEventCompleted('e1_peach_garden')).toBe(true);
    });

    it('E2黄巾之乱 — step3完成后触发', () => {
      bundle.stateMachine.transition('first_enter');
      const triggerResult = bundle.storyPlayer.checkStepTrigger('step3_recruit_hero');
      expect(triggerResult).not.toBeNull();
      expect(triggerResult!.eventId).toBe('e2_yellow_turban');
    });

    it('E3三顾茅庐 — 首次招募条件触发', () => {
      const gameState: StoryGameState = {
        castleLevel: 1,
        battleCount: 0,
        techCount: 0,
        allianceJoined: false,
        firstRecruit: true,
      };
      const result = bundle.triggerEvaluator.evaluateStoryTrigger(
        { type: 'first_recruit' },
        gameState,
      );
      expect(result).toBe(true);
    });

    it('E4草船借箭 — step5完成后触发', () => {
      const triggerResult = bundle.storyPlayer.checkStepTrigger('step5_check_resources');
      expect(triggerResult).not.toBeNull();
      expect(triggerResult!.eventId).toBe('e4_borrow_arrows');
    });

    it('E5赤壁之战 — 主城等级5触发', () => {
      const gameState: StoryGameState = {
        castleLevel: 5,
        battleCount: 0,
        techCount: 0,
        allianceJoined: false,
        firstRecruit: false,
      };
      const result = bundle.triggerEvaluator.evaluateStoryTrigger(
        { type: 'castle_level', value: 5 },
        gameState,
      );
      expect(result).toBe(true);
    });

    it('E6单刀赴会 — 首次加入联盟触发', () => {
      const gameState: StoryGameState = {
        castleLevel: 1,
        battleCount: 0,
        techCount: 0,
        allianceJoined: true,
        firstRecruit: false,
      };
      const result = bundle.triggerEvaluator.evaluateStoryTrigger(
        { type: 'first_alliance' },
        gameState,
      );
      expect(result).toBe(true);
    });

    it('E7七擒孟获 — 科技数4触发', () => {
      const gameState: StoryGameState = {
        castleLevel: 1,
        battleCount: 0,
        techCount: 4,
        allianceJoined: false,
        firstRecruit: false,
      };
      const result = bundle.triggerEvaluator.evaluateStoryTrigger(
        { type: 'tech_count', value: 4 },
        gameState,
      );
      expect(result).toBe(true);
    });

    it('E8三国归一 — 每段剧情有对话和奖励', () => {
      const e8 = STORY_EVENT_DEFINITIONS.find(e => e.eventId === 'e8_unification')!;
      expect(e8.title).toBe('三国归一');
      expect(e8.dialogues.length).toBeGreaterThan(0);
      expect(e8.rewards.length).toBeGreaterThan(0);
      expect(e8.triggerCondition.type).toBe('all_steps_complete');
    });

    it('E1~E8每段剧情应能独立播放并标记完成', () => {
      bundle.stateMachine.transition('first_enter');
      let completedCount = 0;
      for (const eventId of allEventIds) {
        // 每个剧情使用新的 storyPlayer 以避免 playState 残留
        const freshPlayer = new StoryEventPlayer();
        freshPlayer.init(bundle.deps);
        freshPlayer.setStateMachine(bundle.stateMachine);

        const result = freshPlayer.startEvent(eventId);
        expect(result.success).toBe(true);
        const definition = freshPlayer.getStoryEventDefinition(eventId)!;
        for (let i = 0; i < definition.dialogues.length; i++) {
          freshPlayer.tap(); // reveal
          if (i < definition.dialogues.length - 1) {
            freshPlayer.tap(); // next_line
          }
        }
        freshPlayer.tap(); // complete
        bundle.stateMachine.completeStoryEvent(eventId);
        expect(bundle.stateMachine.isStoryEventCompleted(eventId)).toBe(true);
        completedCount++;
      }
      expect(completedCount).toBe(8);
      expect(bundle.stateMachine.getState().completedEvents).toHaveLength(8);
    });

    it('播放中不能同时启动另一个剧情', () => {
      bundle.stateMachine.transition('first_enter');
      bundle.storyPlayer.startEvent('e1_peach_garden');
      const result = bundle.storyPlayer.startEvent('e2_yellow_turban');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('已有剧情正在播放');
    });
  });

  // ─── §7.3.2 剧情交互规则 ─────────────

  describe('§7.3.2 剧情交互规则 (#6)', () => {
    beforeEach(() => {
      bundle.stateMachine.transition('first_enter');
    });

    it('点击推进 — 第一次tap应揭示当前行完整文本', () => {
      bundle.storyPlayer.startEvent('e1_peach_garden');
      const tap1 = bundle.storyPlayer.tap();
      expect(tap1.action).toBe('reveal_line');
    });

    it('点击推进 — 行完成后tap应推进到下一行', () => {
      bundle.storyPlayer.startEvent('e1_peach_garden');
      bundle.storyPlayer.tap(); // reveal line 0
      const tap2 = bundle.storyPlayer.tap(); // next_line
      expect(tap2.action).toBe('next_line');
      expect(tap2.line?.speaker).toBe('刘备');
    });

    it('打字机速度参数应为30ms/字', () => {
      expect(TYPEWRITER_SPEED_MS).toBe(30);
    });

    it('自动播放延迟参数应为5秒', () => {
      expect(AUTO_PLAY_DELAY_MS).toBe(5000);
    });

    it('暂停和恢复应正确切换播放状态', () => {
      bundle.storyPlayer.startEvent('e1_peach_garden');
      expect(bundle.storyPlayer.getPlayProgress().state).toBe('playing');
      bundle.storyPlayer.pause();
      expect(bundle.storyPlayer.getPlayProgress().state).toBe('paused');
      bundle.storyPlayer.resume();
      expect(bundle.storyPlayer.getPlayProgress().state).toBe('playing');
    });
  });

  // ─── §7.3.3 剧情跳过规则 (#12) ───────

  describe('§7.3.3 剧情跳过规则 (#12)', () => {
    beforeEach(() => {
      bundle.stateMachine.transition('first_enter');
    });

    it('请求跳过应要求二次确认', () => {
      bundle.storyPlayer.startEvent('e1_peach_garden');
      const result = bundle.storyPlayer.requestSkip();
      expect(result.requireConfirm).toBe(true);
    });

    it('确认跳过应返回水墨晕染过渡效果', () => {
      bundle.storyPlayer.startEvent('e1_peach_garden');
      bundle.storyPlayer.requestSkip();
      const result = bundle.storyPlayer.confirmSkip();
      expect(result.success).toBe(true);
      expect(result.transitionEffect).toBe('ink_wash');
    });

    it('跳过剧情不应影响奖励发放', () => {
      bundle.storyPlayer.startEvent('e1_peach_garden');
      bundle.storyPlayer.requestSkip();
      const result = bundle.storyPlayer.confirmSkip();
      expect(result.rewards.length).toBeGreaterThan(0);
    });

    it('取消跳过应恢复播放状态', () => {
      bundle.storyPlayer.startEvent('e1_peach_garden');
      bundle.storyPlayer.requestSkip();
      bundle.storyPlayer.cancelSkip();
      const progress = bundle.storyPlayer.getPlayProgress();
      expect(progress.state).toBe('playing');
    });

    it('未请求跳过时直接确认应失败', () => {
      bundle.storyPlayer.startEvent('e1_peach_garden');
      const result = bundle.storyPlayer.confirmSkip();
      expect(result.success).toBe(false);
    });
  });

  // ─── §7.3.4 遮罩聚焦与高亮 (#15) ────

  describe('§7.3.4 遮罩聚焦与高亮 (#15)', () => {
    it('激活遮罩后应处于active状态', () => {
      bundle.maskSystem.activate();
      expect(bundle.maskSystem.isActive()).toBe(true);
    });

    it('设置高亮目标应成功并记录selector和bounds', () => {
      bundle.maskSystem.activate();
      const result = bundle.maskSystem.setHighlightTarget('#castle-overview', mockBoundsProvider);
      expect(result.success).toBe(true);
      expect(bundle.maskSystem.getTargetSelector()).toBe('#castle-overview');
      const bounds = bundle.maskSystem.getHighlightBounds();
      expect(bounds).not.toBeNull();
      expect(bounds!.width).toBeGreaterThan(0);
    });

    it('遮罩未激活时设置高亮目标应失败', () => {
      const result = bundle.maskSystem.setHighlightTarget('#castle-overview', mockBoundsProvider);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('遮罩未激活');
    });

    it('高亮区域应包含内边距', () => {
      bundle.maskSystem.activate({ padding: 8 });
      bundle.maskSystem.setHighlightTarget('#castle-overview', mockBoundsProvider);
      const bounds = bundle.maskSystem.getHighlightBounds()!;
      // 原始宽度300 + padding*2 = 316
      expect(bounds.width).toBe(316);
      expect(bounds.height).toBe(216);
    });

    it('停用遮罩应清除所有高亮和气泡数据', () => {
      bundle.maskSystem.activate();
      bundle.maskSystem.setHighlightTarget('#castle-overview', mockBoundsProvider);
      bundle.maskSystem.deactivate();
      expect(bundle.maskSystem.isActive()).toBe(false);
      expect(bundle.maskSystem.getTargetSelector()).toBeNull();
      expect(bundle.maskSystem.getHighlightBounds()).toBeNull();
    });

    it('渲染数据中blockNonTargetClicks应为true（阻止非目标点击穿透）', () => {
      bundle.maskSystem.activate();
      const renderData = bundle.maskSystem.getMaskRenderData();
      expect(renderData.blockNonTargetClicks).toBe(true);
    });

    it('简化模式下blockNonTargetClicks应为false（允许穿透）', () => {
      bundle.maskSystem.activate();
      bundle.maskSystem.setSimplifiedMode(true);
      const renderData = bundle.maskSystem.getMaskRenderData();
      expect(renderData.blockNonTargetClicks).toBe(false);
      expect(renderData.opacity).toBe(0.5);
    });

    it('自定义遮罩配置应生效（透明度、圆角）', () => {
      bundle.maskSystem.activate({ opacity: 0.7, borderRadius: 16 });
      const state = bundle.maskSystem.getState();
      expect(state.maskConfig.opacity).toBe(0.7);
      expect(state.maskConfig.borderRadius).toBe(16);
    });
  });

  // ─── §7.3.5 引导气泡 (#16) ───────────

  describe('§7.3.5 引导气泡 (#16)', () => {
    it('setupForSubStep应同时激活遮罩和高亮并显示气泡', () => {
      const subStep = CORE_STEP_DEFINITIONS[0].subSteps[0];
      const result = bundle.maskSystem.setupForSubStep(subStep, mockBoundsProvider);
      expect(result.success).toBe(true);
      expect(bundle.maskSystem.isActive()).toBe(true);
      const bubble = bundle.maskSystem.getBubbleRenderData();
      expect(bubble.visible).toBe(true);
      expect(bubble.text).toBe(subStep.text);
    });

    it('气泡应自动定位到目标元素旁', () => {
      const subStep = CORE_STEP_DEFINITIONS[0].subSteps[0];
      bundle.maskSystem.setupForSubStep(subStep, mockBoundsProvider);
      const bubble = bundle.maskSystem.getBubbleRenderData();
      expect(bubble.position).toBeDefined();
      expect(bubble.maxWidth).toBe(280);
    });

    it('hideBubble应隐藏气泡但保留遮罩', () => {
      bundle.maskSystem.activate();
      bundle.maskSystem.showBubble({
        text: '测试气泡',
        position: 'auto',
        arrowTarget: '#test',
        autoPosition: true,
        maxWidth: 280,
      });
      bundle.maskSystem.hideBubble();
      const bubble = bundle.maskSystem.getBubbleRenderData();
      expect(bubble.visible).toBe(false);
      expect(bundle.maskSystem.isActive()).toBe(true);
    });

    it('遮罩未激活时气泡应不可见', () => {
      bundle.maskSystem.showBubble({
        text: '测试',
        position: 'auto',
        arrowTarget: '#test',
        autoPosition: true,
        maxWidth: 280,
      });
      const bubble = bundle.maskSystem.getBubbleRenderData();
      expect(bubble.visible).toBe(false);
    });
  });

  // ─── §7.3.6 新手保护期 (#18) ─────────

  describe('§7.3.6 新手保护期 (#18)', () => {
    it('保护期时长应为30分钟（1800000ms）', () => {
      expect(NEWBIE_PROTECTION_DURATION_MS).toBe(30 * 60 * 1000);
      expect(NEWBIE_PROTECTION_DURATION_MS).toBe(1800000);
    });

    it('首次进入后应自动开启新手保护', () => {
      bundle.stateMachine.transition('first_enter');
      expect(bundle.stateMachine.isNewbieProtectionActive()).toBe(true);
    });

    it('保护期内getProtectionRemainingMs应返回正数', () => {
      bundle.stateMachine.transition('first_enter');
      const remaining = bundle.stateMachine.getProtectionRemainingMs();
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(NEWBIE_PROTECTION_DURATION_MS);
    });

    it('未进入引导时保护应为未激活', () => {
      expect(bundle.stateMachine.isNewbieProtectionActive()).toBe(false);
      expect(bundle.stateMachine.getProtectionRemainingMs()).toBe(0);
    });

    it('序列化应包含protectionStartTime', () => {
      bundle.stateMachine.transition('first_enter');
      const saved = bundle.stateMachine.serialize();
      expect(saved.protectionStartTime).toBeGreaterThan(0);
    });

    it('反序列化应恢复保护期状态', () => {
      bundle.stateMachine.transition('first_enter');
      const saved = bundle.stateMachine.serialize();
      const bundle2 = createSystemBundle();
      bundle2.stateMachine.loadSaveData(saved);
      expect(bundle2.stateMachine.isNewbieProtectionActive()).toBe(true);
    });

    it('保护期过期后保护应不激活', () => {
      bundle.stateMachine.transition('first_enter');
      // 模拟保护期过期：设置 protectionStartTime 为 31 分钟前
      const state = bundle.stateMachine.getState();
      const expiredTime = Date.now() - (31 * 60 * 1000);
      // 通过序列化-修改-反序列化模拟过期
      const saved = bundle.stateMachine.serialize();
      saved.protectionStartTime = expiredTime;
      const bundle2 = createSystemBundle();
      bundle2.stateMachine.loadSaveData(saved);
      expect(bundle2.stateMachine.isNewbieProtectionActive()).toBe(false);
    });
  });
});
