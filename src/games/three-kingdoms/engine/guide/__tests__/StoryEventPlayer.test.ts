/**
 * 引擎层测试 — 剧情事件播放器 (StoryEventPlayer)
 *
 * 覆盖功能点：
 *   #5  8段剧情事件 — E1~E8
 *   #6  剧情交互规则 — 打字机+自动播放+跳过
 *   #7  剧情触发时机 — 条件触发
 *   #12 剧情跳过规则 — 二次确认+水墨晕染过渡
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StoryEventPlayer } from '../StoryEventPlayer';
import { TutorialStateMachine } from '../TutorialStateMachine';
import type { StoryEventId } from '../../../core/guide';
import type { ISystemDeps } from '../../../core/types/subsystem';
import { TYPEWRITER_SPEED_MS } from '../../../core/guide';

function createMockDeps(): ISystemDeps {
  const listeners = new Map<string, Function[]>();
  return {
    eventBus: {
      on: vi.fn((event: string, handler: Function) => {
        if (!listeners.has(event)) listeners.set(event, []);
        listeners.get(event)!.push(handler);
        return () => {
          const arr = listeners.get(event);
          if (arr) { const idx = arr.indexOf(handler); if (idx >= 0) arr.splice(idx, 1); }
        };
      }) as unknown as ISystemDeps['eventBus']['on'],
      emit: vi.fn((event: string, payload?: unknown) => {
        const handlers = listeners.get(event);
        if (handlers) handlers.forEach(h => h(payload));
      }) as unknown as ISystemDeps['eventBus']['emit'],
      once: vi.fn() as unknown as ISystemDeps['eventBus']['once'],
      off: vi.fn() as unknown as ISystemDeps['eventBus']['off'],
      removeAllListeners: vi.fn() as unknown as ISystemDeps['eventBus']['removeAllListeners'],
    },
    config: { get: vi.fn(), set: vi.fn(), has: vi.fn() } as unknown as ISystemDeps['config'],
    registry: { get: vi.fn(), register: vi.fn(), getAll: vi.fn(() => new Map()), has: vi.fn(), unregister: vi.fn() } as unknown as ISystemDeps['registry'],
  };
}

function createSystem() {
  const sm = new TutorialStateMachine();
  const player = new StoryEventPlayer();
  const deps = createMockDeps();
  sm.init(deps);
  player.init(deps);
  player.setStateMachine(sm);
  return { sm, player, deps };
}

describe('StoryEventPlayer', () => {
  let sm: TutorialStateMachine;
  let player: StoryEventPlayer;
  let deps: ReturnType<typeof createMockDeps>;

  beforeEach(() => {
    ({ sm, player, deps } = createSystem());
  });

  describe('#5 8段剧情事件', () => {
    const allIds: StoryEventId[] = [
      'e1_peach_garden', 'e2_yellow_turban', 'e3_three_visits',
      'e4_borrow_arrows', 'e5_red_cliff', 'e6_single_sword',
      'e7_seven_captures', 'e8_unification',
    ];

    it('应有8段剧情事件', () => {
      expect(player.getAllStoryEvents()).toHaveLength(8);
    });

    it('所有剧情事件ID应正确', () => {
      const ids = player.getAllStoryEvents().map(e => e.eventId);
      expect(ids).toEqual(allIds);
    });

    it('每段剧情应有标题和对话', () => {
      for (const event of player.getAllStoryEvents()) {
        expect(event.title).toBeTruthy();
        expect(event.dialogues.length).toBeGreaterThan(0);
      }
    });

    it('E1 桃园结义 — 首次进入触发', () => {
      const def = player.getStoryEventDefinition('e1_peach_garden');
      expect(def!.title).toBe('桃园结义');
      expect(def!.triggerCondition.type).toBe('first_enter');
    });

    it('E2 黄巾之乱 — step3后触发', () => {
      const def = player.getStoryEventDefinition('e2_yellow_turban');
      expect(def!.triggerCondition.type).toBe('after_step');
      expect(def!.triggerCondition.value).toBe('step3_recruit_hero');
    });

    it('E3 三顾茅庐 — 首次招募触发', () => {
      expect(player.getStoryEventDefinition('e3_three_visits')!.triggerCondition.type).toBe('first_recruit');
    });

    it('E4 草船借箭 — step5后触发', () => {
      const def = player.getStoryEventDefinition('e4_borrow_arrows');
      expect(def!.triggerCondition.type).toBe('after_step');
      expect(def!.triggerCondition.value).toBe('step5_check_resources');
    });

    it('E5 赤壁之战 — 主城Lv5触发', () => {
      const def = player.getStoryEventDefinition('e5_red_cliff');
      expect(def!.triggerCondition.type).toBe('castle_level');
      expect(def!.triggerCondition.value).toBe(5);
    });

    it('E6 单刀赴会 — 首次加入联盟', () => {
      expect(player.getStoryEventDefinition('e6_single_sword')!.triggerCondition.type).toBe('first_alliance');
    });

    it('E7 七擒孟获 — 科技数触发', () => {
      expect(player.getStoryEventDefinition('e7_seven_captures')!.triggerCondition.type).toBe('tech_count');
    });

    it('E8 三国归一 — 全部步骤完成', () => {
      expect(player.getStoryEventDefinition('e8_unification')!.triggerCondition.type).toBe('all_steps_complete');
    });

    it('每段剧情应有奖励', () => {
      for (const event of player.getAllStoryEvents()) {
        expect(event.rewards.length).toBeGreaterThan(0);
      }
    });
  });

  describe('#6 剧情交互规则 — 播放与打字机', () => {
    it('startEvent 应开始播放', () => {
      const result = player.startEvent('e1_peach_garden');
      expect(result.success).toBe(true);
      expect(player.getPlayProgress().state).toBe('playing');
      expect(player.getPlayProgress().eventId).toBe('e1_peach_garden');
    });

    it('startEvent 不存在的剧情应失败', () => {
      expect(player.startEvent('e99_nonexistent' as StoryEventId).success).toBe(false);
    });

    it('播放中不能开始另一个剧情', () => {
      player.startEvent('e1_peach_garden');
      expect(player.startEvent('e2_yellow_turban').success).toBe(false);
    });

    it('startEvent 应发射 tutorial:storyTriggered 事件', () => {
      player.startEvent('e1_peach_garden');
      expect(deps.eventBus.emit).toHaveBeenCalledWith('tutorial:storyTriggered', { eventId: 'e1_peach_garden' });
    });

    it('tap 在行未完成时应立即显示完整行', () => {
      player.startEvent('e1_peach_garden');
      const result = player.tap();
      expect(result.action).toBe('reveal_line');
      expect(result.line).toBeDefined();
    });

    it('tap 在行完成后应推进到下一行', () => {
      player.startEvent('e1_peach_garden');
      player.tap(); // reveal first line
      const result = player.tap();
      expect(result.action).toBe('next_line');
    });

    it('tap 在最后一行完成时应标记complete', () => {
      player.startEvent('e1_peach_garden');
      const totalLines = player.getStoryEventDefinition('e1_peach_garden')!.dialogues.length;
      // 每行需要2次tap: reveal_line + next_line（最后一行第2次tap返回complete）
      for (let i = 0; i < totalLines * 2 - 1; i++) player.tap();
      const result = player.tap();
      expect(result.action).toBe('complete');
      expect(player.getPlayProgress().typewriter.allComplete).toBe(true);
    });

    it('update 应推进打字机效果', () => {
      player.startEvent('e1_peach_garden');
      player.update(100);
      expect(player.getPlayProgress().typewriter.charIndex).toBeGreaterThan(0);
    });

    it('加速时打字机速度应更快', () => {
      player.startEvent('e1_peach_garden');
      player.setAccelerated(true);
      player.update(100);
      const fastChars = player.getPlayProgress().typewriter.charIndex;

      player.reset();
      player.init(createMockDeps());
      player.setStateMachine(sm);
      player.startEvent('e1_peach_garden');
      player.setAccelerated(false);
      player.update(100);
      const slowChars = player.getPlayProgress().typewriter.charIndex;

      expect(fastChars).toBeGreaterThanOrEqual(slowChars);
    });

    it('pause/resume 应正确切换状态', () => {
      player.startEvent('e1_peach_garden');
      player.pause();
      expect(player.getPlayProgress().state).toBe('paused');
      player.resume();
      expect(player.getPlayProgress().state).toBe('playing');
    });

    it('getCurrentLine 应返回当前对话', () => {
      player.startEvent('e1_peach_garden');
      expect(player.getCurrentLine()).not.toBeNull();
      expect(player.getCurrentLine()!.text).toBeTruthy();
    });

    it('getCurrentDisplayText 初始为空', () => {
      player.startEvent('e1_peach_garden');
      expect(player.getCurrentDisplayText()).toBe('');
    });

    it('打字机效果30ms/字', () => {
      player.startEvent('e1_peach_garden');
      player.update(TYPEWRITER_SPEED_MS);
      expect(player.getCurrentDisplayText().length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('#12 剧情跳过规则 — 二次确认+过渡', () => {
    it('requestSkip 应要求二次确认', () => {
      player.startEvent('e1_peach_garden');
      expect(player.requestSkip().requireConfirm).toBe(true);
    });

    it('非播放中 requestSkip 不需确认', () => {
      expect(player.requestSkip().requireConfirm).toBe(false);
    });

    it('confirmSkip 应完成事件并返回水墨晕染过渡', () => {
      player.startEvent('e1_peach_garden');
      player.requestSkip();
      const result = player.confirmSkip();
      expect(result.success).toBe(true);
      expect(result.transitionEffect).toBe('ink_wash');
      expect(result.rewards.length).toBeGreaterThan(0);
    });

    it('跳过不影响奖励', () => {
      player.startEvent('e1_peach_garden');
      player.requestSkip();
      const result = player.confirmSkip();
      const def = player.getStoryEventDefinition('e1_peach_garden')!;
      expect(result.rewards).toEqual(def.rewards);
    });

    it('未请求跳过时 confirmSkip 应失败', () => {
      player.startEvent('e1_peach_garden');
      expect(player.confirmSkip().success).toBe(false);
    });

    it('cancelSkip 应取消跳过请求', () => {
      player.startEvent('e1_peach_garden');
      player.requestSkip();
      player.cancelSkip();
      expect(player.confirmSkip().success).toBe(false);
    });

    it('跳过后应发射 rewardGranted 事件', () => {
      player.startEvent('e1_peach_garden');
      player.requestSkip();
      player.confirmSkip();
      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'tutorial:rewardGranted',
        expect.objectContaining({ source: 'story_e1_peach_garden' }),
      );
    });

    it('跳过后应标记剧情完成', () => {
      player.startEvent('e1_peach_garden');
      player.requestSkip();
      player.confirmSkip();
      expect(sm.isStoryEventCompleted('e1_peach_garden')).toBe(true);
    });
  });

  describe('#7 剧情触发时机 — 条件触发', () => {
    it('first_recruit 触发 E3', () => {
      const r = player.checkTriggerConditions({ castleLevel: 1, battleCount: 0, techCount: 0, allianceJoined: false, firstRecruit: true });
      expect(r).not.toBeNull();
      expect(r!.eventId).toBe('e3_three_visits');
    });

    it('castle_level >= 5 触发 E5', () => {
      ['e1_peach_garden', 'e2_yellow_turban', 'e3_three_visits', 'e4_borrow_arrows'].forEach(e => sm.completeStoryEvent(e as StoryEventId));
      const r = player.checkTriggerConditions({ castleLevel: 5, battleCount: 3, techCount: 0, allianceJoined: false, firstRecruit: true });
      expect(r).not.toBeNull();
      expect(r!.eventId).toBe('e5_red_cliff');
    });

    it('first_alliance 触发 E6', () => {
      ['e1_peach_garden', 'e2_yellow_turban', 'e3_three_visits', 'e4_borrow_arrows', 'e5_red_cliff'].forEach(e => sm.completeStoryEvent(e as StoryEventId));
      const r = player.checkTriggerConditions({ castleLevel: 5, battleCount: 3, techCount: 0, allianceJoined: true, firstRecruit: true });
      expect(r).not.toBeNull();
      expect(r!.eventId).toBe('e6_single_sword');
    });

    it('tech_count >= 4 触发 E7', () => {
      ['e1_peach_garden', 'e2_yellow_turban', 'e3_three_visits', 'e4_borrow_arrows', 'e5_red_cliff', 'e6_single_sword'].forEach(e => sm.completeStoryEvent(e as StoryEventId));
      const r = player.checkTriggerConditions({ castleLevel: 5, battleCount: 3, techCount: 4, allianceJoined: true, firstRecruit: true });
      expect(r).not.toBeNull();
      expect(r!.eventId).toBe('e7_seven_captures');
    });

    it('已完成的剧情不应再触发', () => {
      sm.completeStoryEvent('e3_three_visits');
      const r = player.checkTriggerConditions({ castleLevel: 1, battleCount: 0, techCount: 0, allianceJoined: false, firstRecruit: true });
      expect(r).toBeNull();
    });

    it('checkStepTrigger 应检查步骤触发', () => {
      const r = player.checkStepTrigger('step3_recruit_hero');
      expect(r).not.toBeNull();
      expect(r!.eventId).toBe('e2_yellow_turban');
    });

    it('checkStepTrigger 无匹配应返回null', () => {
      expect(player.checkStepTrigger('step1_castle_overview')).toBeNull();
    });
  });

  describe('reset', () => {
    it('reset 应恢复初始状态', () => {
      player.startEvent('e1_peach_garden');
      player.reset();
      expect(player.getPlayProgress().state).toBe('idle');
      expect(player.getPlayProgress().eventId).toBeNull();
    });
  });
});
