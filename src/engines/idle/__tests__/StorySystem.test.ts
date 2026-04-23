import { vi } from 'vitest';
/**
 * StorySystem 单元测试
 */

import {
  StorySystem,
  type ChapterDef,
  type DialogueCharacter,
  type StoryEvent,
} from '../modules/StorySystem';

function createChapter(overrides: Partial<ChapterDef> = {}): ChapterDef {
  return {
    id: 'ch1',
    title: '序章',
    order: 1,
    triggers: [{ type: 'reach_stage', targetId: 'stage_1', value: 1 }],
    dialogues: [
      { id: 'd1', characterId: '', text: '很久以前...' },
      { id: 'd2', characterId: 'hero', text: '我是谁？' },
      { id: 'd3', characterId: '', text: '冒险开始了。' },
    ],
    nextChapterId: 'ch2',
    ...overrides,
  };
}

function createChoiceChapter(): ChapterDef {
  return {
    id: 'ch_choice',
    title: '抉择',
    order: 1,
    triggers: [],
    dialogues: [
      { id: 'cd1', characterId: 'hero', text: '我该怎么做？', choices: [
        { optionId: 'fight', text: '战斗', nextDialogueId: 'cd_fight' },
        { optionId: 'flee', text: '逃跑', nextDialogueId: 'cd_flee' },
      ]},
      { id: 'cd_fight', characterId: '', text: '你选择了战斗！' },
      { id: 'cd_flee', characterId: '', text: '你选择了逃跑。' },
    ],
  };
}

describe('StorySystem', () => {
  let system: StorySystem;

  beforeEach(() => {
    system = new StorySystem();
    system.registerCharacters([
      { id: 'hero', name: '勇者' },
      { id: 'npc', name: '村长' },
    ]);
  });

  it('应正确注册章节', () => {
    system.registerChapters([createChapter()]);
    expect(system.chapters).toHaveLength(1);
  });

  it('第一章应默认解锁', () => {
    system.registerChapters([createChapter()]);
    expect(system.getChapterState('ch1')?.unlocked).toBe(true);
  });

  it('triggerStory 应根据条件解锁章节', () => {
    system.registerChapters([createChapter({ order: 2, id: 'ch_late', triggers: [{ type: 'reach_stage', targetId: 'stage_5', value: 5 }] })]);
    const result = system.triggerStory({ type: 'reach_stage', targetId: 'stage_5', value: 5 });
    expect(result).toBe('ch_late');
  });

  it('条件不满足时不应触发', () => {
    system.registerChapters([createChapter({ order: 2, id: 'ch_late', triggers: [{ type: 'reach_stage', targetId: 'stage_5', value: 5 }] })]);
    const result = system.triggerStory({ type: 'reach_stage', targetId: 'stage_5', value: 3 });
    expect(result).toBeNull();
  });

  it('startChapter 应开始已解锁的章节', () => {
    system.registerChapters([createChapter()]);
    expect(system.startChapter('ch1')).toBe(true);
    expect(system.currentChapter?.id).toBe('ch1');
  });

  it('advanceDialogue 应推进对话', () => {
    system.registerChapters([createChapter()]);
    system.startChapter('ch1');
    const line = system.advanceDialogue();
    expect(line?.id).toBe('d2');
  });

  it('最后一行后 advanceDialogue 应完成章节', () => {
    system.registerChapters([createChapter()]);
    system.startChapter('ch1');
    system.advanceDialogue(); // d2
    system.advanceDialogue(); // d3
    const result = system.advanceDialogue(); // end
    expect(result).toBeNull();
    expect(system.getChapterState('ch1')?.completed).toBe(true);
  });

  it('makeChoice 应正确处理分支选择', () => {
    system.registerChapters([createChoiceChapter()]);
    system.startChapter('ch_choice');
    const result = system.makeChoice('fight');
    expect(result?.id).toBe('cd_fight');
  });

  it('无效选择应返回 null', () => {
    system.registerChapters([createChoiceChapter()]);
    system.startChapter('ch_choice');
    const result = system.makeChoice('invalid');
    expect(result).toBeNull();
  });

  it('选择应记录在 choicesMade 中', () => {
    system.registerChapters([createChoiceChapter()]);
    system.startChapter('ch_choice');
    system.makeChoice('fight');
    const state = system.getChapterState('ch_choice');
    expect(state?.choicesMade['cd1']).toBe('fight');
  });

  it('完成章节应解锁下一章', () => {
    system.registerChapters([
      createChapter(),
      createChapter({ id: 'ch2', order: 2, triggers: [] }),
    ]);
    system.startChapter('ch1');
    system.advanceDialogue();
    system.advanceDialogue();
    system.advanceDialogue();
    expect(system.getChapterState('ch2')?.unlocked).toBe(true);
  });

  it('replayChapter 应允许重放已完成章节', () => {
    system.registerChapters([createChapter()]);
    system.startChapter('ch1');
    system.advanceDialogue();
    system.advanceDialogue();
    system.advanceDialogue();
    expect(system.replayChapter('ch1')).toBe(true);
    expect(system.getChapterState('ch1')?.currentDialogueIndex).toBe(0);
  });

  it('未完成章节不能重放', () => {
    system.registerChapters([createChapter()]);
    expect(system.replayChapter('ch1')).toBe(false);
  });

  it('getCurrentDialogue 应返回当前对话行', () => {
    system.registerChapters([createChapter()]);
    system.startChapter('ch1');
    expect(system.getCurrentDialogue()?.id).toBe('d1');
  });

  it('getCharacter 应返回角色信息', () => {
    expect(system.getCharacter('hero')?.name).toBe('勇者');
  });

  it('有分支选项时 advanceDialogue 不应自动推进', () => {
    system.registerChapters([createChoiceChapter()]);
    system.startChapter('ch_choice');
    const result = system.advanceDialogue();
    expect(result).toBeNull();
  });

  it('应正确触发事件', () => {
    system.registerChapters([createChapter()]);
    const handler = vi.fn();
    system.onEvent(handler);
    system.startChapter('ch1');
    system.advanceDialogue();
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ type: 'dialogue_advanced' }));
  });

  it('saveState/loadState 应正确工作', () => {
    system.registerChapters([createChapter()]);
    system.startChapter('ch1');
    system.advanceDialogue();
    const saved = system.saveState();

    const newSystem = new StorySystem();
    newSystem.registerChapters([createChapter()]);
    newSystem.loadState(saved);
    expect(newSystem.getChapterState('ch1')?.currentDialogueIndex).toBe(1);
  });

  it('reset 应重置所有状态', () => {
    system.registerChapters([createChapter()]);
    system.startChapter('ch1');
    system.advanceDialogue();
    system.reset();
    expect(system.getChapterState('ch1')?.currentDialogueIndex).toBe(0);
    expect(system.isStoryActive()).toBe(false);
  });
});
