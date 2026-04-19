/**
 * StorySystem 剧情系统 — 单元测试
 *
 * 覆盖范围：
 * - 章节注册与查询
 * - 触发条件检查与自动解锁
 * - 开始章节 / 推进对话 / 分支选择
 * - 章节完成与下一章解锁
 * - 章节回放
 * - 序列化（saveState）与反序列化（loadState）
 * - 事件监听
 * - 边界情况与重置
 *
 * @module engines/idle/modules/__tests__/StorySystem.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  StorySystem,
  type ChapterDef,
  type DialogueCharacter,
  type StoryEvent,
  type StoryTrigger,
} from '../StorySystem';

// ============================================================
// 测试数据工厂
// ============================================================

function makeCharacters(): DialogueCharacter[] {
  return [
    { id: 'narrator', name: '旁白' },
    { id: 'hero', name: '勇者', avatar: 'hero.png' },
    { id: 'villain', name: '魔王', avatar: 'villain.png' },
  ];
}

/** 构建一个包含分支选择的 3 章节剧情 */
function makeChapters(): ChapterDef[] {
  return [
    {
      id: 'ch1',
      title: '序章：觉醒',
      order: 1,
      triggers: [{ type: 'reach_stage', targetId: 'stage_1', value: 1 }],
      dialogues: [
        { id: 'ch1_d1', characterId: 'narrator', text: '在遥远的古代……' },
        { id: 'ch1_d2', characterId: 'hero', text: '我是谁？' },
        { id: 'ch1_d3', characterId: 'narrator', text: '你缓缓睁开了双眼。' },
      ],
      rewards: { gold: 100 },
      nextChapterId: 'ch2',
    },
    {
      id: 'ch2',
      title: '第一章：抉择',
      order: 2,
      triggers: [{ type: 'defeat', targetId: 'goblin', value: 10 }],
      dialogues: [
        { id: 'ch2_d1', characterId: 'narrator', text: '你面前出现了两条路。' },
        {
          id: 'ch2_d2',
          characterId: 'hero',
          text: '该走哪条？',
          choices: [
            { optionId: 'left', text: '走左边', nextDialogueId: 'ch2_d3a' },
            { optionId: 'right', text: '走右边', nextDialogueId: 'ch2_d3b' },
          ],
        },
        { id: 'ch2_d3a', characterId: 'narrator', text: '你走上了光明之路。' },
        { id: 'ch2_d3b', characterId: 'narrator', text: '你踏入了黑暗深渊。' },
      ],
      rewards: { gold: 200, exp: 50 },
      nextChapterId: 'ch3',
    },
    {
      id: 'ch3',
      title: '第二章：决战',
      order: 3,
      triggers: [{ type: 'collect', targetId: 'sword', value: 1 }],
      dialogues: [
        { id: 'ch3_d1', characterId: 'villain', text: '你终于来了。' },
        { id: 'ch3_d2', characterId: 'hero', text: '一切到此为止！' },
      ],
      rewards: { exp: 500 },
    },
  ];
}

/** 创建一个已注册角色和章节的 StorySystem 实例 */
function createSystem(): StorySystem {
  const sys = new StorySystem();
  sys.registerCharacters(makeCharacters());
  sys.registerChapters(makeChapters());
  return sys;
}

// ============================================================
// 测试套件
// ============================================================

describe('StorySystem', () => {
  let system: StorySystem;

  beforeEach(() => {
    system = createSystem();
  });

  // ----------------------------------------------------------
  // 章节注册与查询
  // ----------------------------------------------------------
  describe('章节注册与查询', () => {
    it('应正确注册章节并按 order 排序', () => {
      const chs = system.chapters;
      expect(chs).toHaveLength(3);
      expect(chs[0].id).toBe('ch1');
      expect(chs[1].id).toBe('ch2');
      expect(chs[2].id).toBe('ch3');
    });

    it('第一章默认解锁，其余章节锁定', () => {
      expect(system.getChapterState('ch1')?.unlocked).toBe(true);
      expect(system.getChapterState('ch2')?.unlocked).toBe(false);
      expect(system.getChapterState('ch3')?.unlocked).toBe(false);
    });

    it('应正确返回角色信息', () => {
      const hero = system.getCharacter('hero');
      expect(hero).toBeDefined();
      expect(hero!.name).toBe('勇者');
      expect(hero!.avatar).toBe('hero.png');
    });

    it('初始状态没有激活剧情', () => {
      expect(system.isStoryActive()).toBe(false);
      expect(system.currentChapter).toBeNull();
      expect(system.getCurrentDialogue()).toBeNull();
    });
  });

  // ----------------------------------------------------------
  // 触发条件检查
  // ----------------------------------------------------------
  describe('触发条件检查', () => {
    it('满足触发条件时解锁并开始章节', () => {
      // ch2 初始锁定，触发条件为 defeat goblin × 10
      const result = system.triggerStory({
        type: 'defeat',
        targetId: 'goblin',
        value: 10,
      });
      expect(result).toBe('ch2');
      expect(system.isStoryActive()).toBe(true);
      expect(system.currentChapter?.id).toBe('ch2');
    });

    it('触发条件值不足时不解锁', () => {
      const result = system.triggerStory({
        type: 'defeat',
        targetId: 'goblin',
        value: 5,
      });
      expect(result).toBeNull();
    });

    it('触发条件类型不匹配时不解锁', () => {
      const result = system.triggerStory({
        type: 'build',
        targetId: 'goblin',
        value: 10,
      });
      expect(result).toBeNull();
    });

    it('已解锁章节不会被重复触发', () => {
      system.triggerStory({ type: 'defeat', targetId: 'goblin', value: 10 });
      // ch2 已解锁，再次触发不应返回任何结果
      const result = system.triggerStory({ type: 'defeat', targetId: 'goblin', value: 10 });
      expect(result).toBeNull();
    });
  });

  // ----------------------------------------------------------
  // 开始章节
  // ----------------------------------------------------------
  describe('开始章节', () => {
    it('可以手动开始已解锁章节', () => {
      expect(system.startChapter('ch1')).toBe(true);
      expect(system.currentChapter?.id).toBe('ch1');
    });

    it('不能开始未解锁章节', () => {
      expect(system.startChapter('ch2')).toBe(false);
    });

    it('不能开始不存在的章节', () => {
      expect(system.startChapter('nonexistent')).toBe(false);
    });

    it('开始新章节时暂停旧章节', () => {
      system.startChapter('ch1');
      // 手动解锁 ch2 以测试切换
      const ch2State = system.getChapterState('ch2')!;
      ch2State.unlocked = true;
      system.startChapter('ch2');
      expect(system.currentChapter?.id).toBe('ch2');
      expect(system.getChapterState('ch1')?.active).toBe(false);
    });
  });

  // ----------------------------------------------------------
  // 推进对话
  // ----------------------------------------------------------
  describe('推进对话', () => {
    beforeEach(() => {
      system.startChapter('ch1');
    });

    it('应按顺序推进对话', () => {
      const d1 = system.getCurrentDialogue();
      expect(d1?.id).toBe('ch1_d1');

      const d2 = system.advanceDialogue();
      expect(d2?.id).toBe('ch1_d2');

      const d3 = system.advanceDialogue();
      expect(d3?.id).toBe('ch1_d3');
    });

    it('最后一行对话后推进应完成章节', () => {
      system.advanceDialogue(); // → ch1_d2
      system.advanceDialogue(); // → ch1_d3
      const result = system.advanceDialogue(); // 章节结束
      expect(result).toBeNull();
      expect(system.getChapterState('ch1')?.completed).toBe(true);
      expect(system.isStoryActive()).toBe(false);
    });

    it('当前对话有分支选项时不能自动推进', () => {
      // 切换到 ch2 测试分支
      const ch2State = system.getChapterState('ch2')!;
      ch2State.unlocked = true;
      system.startChapter('ch2');
      system.advanceDialogue(); // → ch2_d2（有 choices）
      const result = system.advanceDialogue(); // 应被阻止
      expect(result).toBeNull();
    });
  });

  // ----------------------------------------------------------
  // 分支选择
  // ----------------------------------------------------------
  describe('分支选择', () => {
    beforeEach(() => {
      // 解锁并开始 ch2
      const ch2State = system.getChapterState('ch2')!;
      ch2State.unlocked = true;
      system.startChapter('ch2');
      system.advanceDialogue(); // → ch2_d2（有 choices）
    });

    it('选择左边的路应跳转到 ch2_d3a', () => {
      const next = system.makeChoice('left');
      expect(next?.id).toBe('ch2_d3a');
      expect(next?.text).toBe('你走上了光明之路。');
    });

    it('选择右边的路应跳转到 ch2_d3b', () => {
      const next = system.makeChoice('right');
      expect(next?.id).toBe('ch2_d3b');
      expect(next?.text).toBe('你踏入了黑暗深渊。');
    });

    it('无效选项 ID 应返回 null', () => {
      const next = system.makeChoice('invalid');
      expect(next).toBeNull();
    });

    it('选择应被记录到 choicesMade', () => {
      system.makeChoice('left');
      const state = system.getChapterState('ch2');
      expect(state?.choicesMade['ch2_d2']).toBe('left');
    });
  });

  // ----------------------------------------------------------
  // 章节完成与下一章解锁
  // ----------------------------------------------------------
  describe('章节完成与下一章解锁', () => {
    it('完成 ch1 后自动解锁 ch2', () => {
      system.startChapter('ch1');
      system.advanceDialogue();
      system.advanceDialogue();
      system.advanceDialogue(); // 完成 ch1

      expect(system.getChapterState('ch1')?.completed).toBe(true);
      expect(system.getChapterState('ch2')?.unlocked).toBe(true);
    });

    it('完成 ch1 后 ch2 可以手动开始', () => {
      system.startChapter('ch1');
      system.advanceDialogue();
      system.advanceDialogue();
      system.advanceDialogue();

      expect(system.startChapter('ch2')).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // 章节回放
  // ----------------------------------------------------------
  describe('章节回放', () => {
    it('已完成的章节可以回放', () => {
      // 先完成 ch1
      system.startChapter('ch1');
      system.advanceDialogue();
      system.advanceDialogue();
      system.advanceDialogue();

      expect(system.replayChapter('ch1')).toBe(true);
      expect(system.currentChapter?.id).toBe('ch1');
      expect(system.getCurrentDialogue()?.id).toBe('ch1_d1');
    });

    it('未完成的章节不能回放', () => {
      expect(system.replayChapter('ch1')).toBe(false);
    });

    it('回放时清除之前的选择记录', () => {
      // 完成 ch2（含选择）
      const ch2State = system.getChapterState('ch2')!;
      ch2State.unlocked = true;
      system.startChapter('ch2');
      system.advanceDialogue(); // → ch2_d2（有 choices）
      system.makeChoice('left'); // → ch2_d3a
      system.advanceDialogue(); // → ch2_d3b
      system.advanceDialogue(); // 完成 ch2

      expect(system.getChapterState('ch2')?.completed).toBe(true);
      system.replayChapter('ch2');
      const state = system.getChapterState('ch2');
      expect(state?.choicesMade).toEqual({});
    });
  });

  // ----------------------------------------------------------
  // 序列化与反序列化
  // ----------------------------------------------------------
  describe('序列化与反序列化', () => {
    it('saveState 应正确导出状态', () => {
      system.startChapter('ch1');
      system.advanceDialogue();

      const saved = system.saveState();
      expect(saved.activeChapterId).toBe('ch1');
      expect(saved.chapterStates['ch1'].currentDialogueIndex).toBe(1);
      expect(saved.chapterStates['ch1'].active).toBe(true);
    });

    it('loadState 应正确恢复状态', () => {
      system.startChapter('ch1');
      system.advanceDialogue();
      const saved = system.saveState();

      // 新实例恢复
      const sys2 = createSystem();
      sys2.loadState(saved);

      expect(sys2.isStoryActive()).toBe(true);
      expect(sys2.currentChapter?.id).toBe('ch1');
      expect(sys2.getCurrentDialogue()?.id).toBe('ch1_d2');
    });

    it('loadState 忽略未注册的章节', () => {
      const sys2 = createSystem();
      sys2.loadState({
        chapterStates: {
          nonexistent: { completed: true },
        },
      });
      expect(sys2.getChapterState('nonexistent')).toBeUndefined();
    });

    it('序列化后的状态是深拷贝，互不影响', () => {
      system.startChapter('ch1');
      const saved = system.saveState();

      // 修改原始系统
      system.advanceDialogue();
      expect(saved.chapterStates['ch1'].currentDialogueIndex).toBe(0);
    });
  });

  // ----------------------------------------------------------
  // 事件监听
  // ----------------------------------------------------------
  describe('事件监听', () => {
    it('应触发 chapter_unlocked 和 story_triggered 事件', () => {
      const events: StoryEvent[] = [];
      system.onEvent((e) => events.push(e));

      // ch2 初始锁定，满足触发条件时会解锁并触发事件
      system.triggerStory({ type: 'defeat', targetId: 'goblin', value: 10 });

      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('chapter_unlocked');
      expect(events[1].type).toBe('story_triggered');
    });

    it('应触发 dialogue_advanced 事件', () => {
      const events: StoryEvent[] = [];
      system.onEvent((e) => events.push(e));
      system.startChapter('ch1');

      system.advanceDialogue();

      expect(events.some((e) => e.type === 'dialogue_advanced')).toBe(true);
    });

    it('应触发 choice_made 事件', () => {
      const events: StoryEvent[] = [];
      system.onEvent((e) => events.push(e));

      const ch2State = system.getChapterState('ch2')!;
      ch2State.unlocked = true;
      system.startChapter('ch2');
      system.advanceDialogue();
      system.makeChoice('left');

      const choiceEvent = events.find((e) => e.type === 'choice_made');
      expect(choiceEvent).toBeDefined();
      if (choiceEvent?.type === 'choice_made') {
        expect(choiceEvent.optionId).toBe('left');
      }
    });

    it('应触发 chapter_completed 事件', () => {
      const events: StoryEvent[] = [];
      system.onEvent((e) => events.push(e));
      system.startChapter('ch1');

      system.advanceDialogue();
      system.advanceDialogue();
      system.advanceDialogue(); // 完成

      const completedEvent = events.find((e) => e.type === 'chapter_completed');
      expect(completedEvent).toBeDefined();
    });

    it('offEvent 应移除监听器', () => {
      const events: StoryEvent[] = [];
      const listener = (e: StoryEvent) => events.push(e);
      system.onEvent(listener);
      system.offEvent(listener);

      system.startChapter('ch1');
      system.advanceDialogue();

      expect(events).toHaveLength(0);
    });

    it('监听器抛异常不应中断流程', () => {
      system.onEvent(() => {
        throw new Error('listener error');
      });

      // 不应抛出异常
      expect(() => system.startChapter('ch1')).not.toThrow();
      expect(system.isStoryActive()).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // 重置
  // ----------------------------------------------------------
  describe('重置', () => {
    it('reset 应恢复到初始状态', () => {
      system.startChapter('ch1');
      system.advanceDialogue();
      system.advanceDialogue();
      system.advanceDialogue(); // 完成 ch1

      system.reset();

      expect(system.isStoryActive()).toBe(false);
      expect(system.getChapterState('ch1')?.completed).toBe(false);
      expect(system.getChapterState('ch1')?.unlocked).toBe(true); // 第一章仍解锁
      expect(system.getChapterState('ch2')?.unlocked).toBe(false);
    });
  });
});
