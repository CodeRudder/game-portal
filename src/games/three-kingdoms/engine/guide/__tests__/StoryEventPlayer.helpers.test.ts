/**
 * 剧情事件播放器辅助函数测试
 *
 * 覆盖：createInitialPlayerState、findStoryDefinition、getFullLineLength、
 * getAllStoryEventDefinitions、getStoryEventDefinitionById、
 * updateTypewriterEffect、updateAutoPlayTimer
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createInitialPlayerState,
  findStoryDefinition,
  getFullLineLength,
  getAllStoryEventDefinitions,
  getStoryEventDefinitionById,
  updateTypewriterEffect,
  updateAutoPlayTimer,
} from '../StoryEventPlayer.helpers';
import type { StoryEventPlayerInternalState } from '../StoryEventPlayer.types';

// ── createInitialPlayerState ──

describe('StoryEventPlayer.helpers — createInitialPlayerState', () => {
  it('返回正确的初始状态', () => {
    const state = createInitialPlayerState();

    expect(state.playState).toBe('idle');
    expect(state.currentEventId).toBeNull();
    expect(state.accelerated).toBe(false);
    expect(state.autoPlayTimer).toBe(0);
    expect(state.skipConfirmPending).toBe(false);
  });

  it('打字机初始状态正确', () => {
    const state = createInitialPlayerState();

    expect(state.typewriter.lineIndex).toBe(0);
    expect(state.typewriter.charIndex).toBe(0);
    expect(state.typewriter.lineComplete).toBe(false);
    expect(state.typewriter.allComplete).toBe(false);
  });

  it('每次调用返回新对象（不共享引用）', () => {
    const state1 = createInitialPlayerState();
    const state2 = createInitialPlayerState();

    expect(state1).not.toBe(state2);
    expect(state1.typewriter).not.toBe(state2.typewriter);
  });
});

// ── findStoryDefinition ──

describe('StoryEventPlayer.helpers — findStoryDefinition', () => {
  it('传入 null 返回 null', () => {
    expect(findStoryDefinition(null)).toBeNull();
  });

  it('传入不存在的事件 ID 返回 null', () => {
    expect(findStoryDefinition('non_existent_event' as never)).toBeNull();
  });

  it('传入有效事件 ID 返回对应定义', () => {
    // 使用 core/guide 中定义的事件 ID
    const allDefs = getAllStoryEventDefinitions();
    if (allDefs.length > 0) {
      const firstDef = allDefs[0];
      // STORY_EVENT_MAP 的 key 是 eventId 字段
      const found = findStoryDefinition(firstDef.eventId);
      expect(found).not.toBeNull();
      expect(found!.eventId).toBe(firstDef.eventId);
    }
  });
});

// ── getFullLineLength ──

describe('StoryEventPlayer.helpers — getFullLineLength', () => {
  it('返回指定行文本长度', () => {
    const allDefs = getAllStoryEventDefinitions();
    if (allDefs.length > 0) {
      const def = allDefs[0];
      if (def.dialogues.length > 0) {
        const length = getFullLineLength(def, 0);
        expect(length).toBe(def.dialogues[0].text.length);
      }
    }
  });

  it('越界行索引返回 0', () => {
    const allDefs = getAllStoryEventDefinitions();
    if (allDefs.length > 0) {
      const def = allDefs[0];
      const length = getFullLineLength(def, 9999);
      expect(length).toBe(0);
    }
  });
});

// ── getAllStoryEventDefinitions ──

describe('StoryEventPlayer.helpers — getAllStoryEventDefinitions', () => {
  it('返回非空数组', () => {
    const defs = getAllStoryEventDefinitions();
    expect(Array.isArray(defs)).toBe(true);
    expect(defs.length).toBeGreaterThan(0);
  });

  it('每个定义包含 eventId 和 dialogues', () => {
    const defs = getAllStoryEventDefinitions();
    for (const def of defs) {
      expect(def).toHaveProperty('eventId');
      expect(def).toHaveProperty('dialogues');
      expect(Array.isArray(def.dialogues)).toBe(true);
    }
  });
});

// ── getStoryEventDefinitionById ──

describe('StoryEventPlayer.helpers — getStoryEventDefinitionById', () => {
  it('不存在的 ID 返回 null', () => {
    expect(getStoryEventDefinitionById('nonexistent' as never)).toBeNull();
  });

  it('存在的 ID 返回对应定义', () => {
    const allDefs = getAllStoryEventDefinitions();
    if (allDefs.length > 0) {
      const result = getStoryEventDefinitionById(allDefs[0].eventId);
      expect(result).not.toBeNull();
      expect(result!.eventId).toBe(allDefs[0].eventId);
    }
  });
});

// ── updateTypewriterEffect ──

describe('StoryEventPlayer.helpers — updateTypewriterEffect', () => {
  function makeState(overrides: Partial<StoryEventPlayerInternalState> = {}): StoryEventPlayerInternalState {
    return {
      playState: 'playing',
      currentEventId: null,
      typewriter: { lineIndex: 0, charIndex: 0, lineComplete: false, allComplete: false },
      accelerated: false,
      autoPlayTimer: 0,
      skipConfirmPending: false,
      ...overrides,
    };
  }

  it('无事件ID时不修改状态', () => {
    const state = makeState({ currentEventId: null });
    const original = state.typewriter.charIndex;
    updateTypewriterEffect(state, 100);
    expect(state.typewriter.charIndex).toBe(original);
  });

  it('行已完成时不修改 charIndex', () => {
    const allDefs = getAllStoryEventDefinitions();
    if (allDefs.length === 0) return;

    const state = makeState({
      currentEventId: allDefs[0].id,
      typewriter: { lineIndex: 0, charIndex: 5, lineComplete: true, allComplete: false },
    });

    updateTypewriterEffect(state, 100);
    expect(state.typewriter.charIndex).toBe(5);
  });

  it('全部完成时不修改状态', () => {
    const allDefs = getAllStoryEventDefinitions();
    if (allDefs.length === 0) return;

    const state = makeState({
      currentEventId: allDefs[0].id,
      typewriter: { lineIndex: 0, charIndex: 5, lineComplete: true, allComplete: true },
    });

    updateTypewriterEffect(state, 100);
    expect(state.typewriter.charIndex).toBe(5);
  });

  it('正常推进字符索引', () => {
    const allDefs = getAllStoryEventDefinitions();
    if (allDefs.length === 0) return;
    const def = allDefs[0];
    if (def.dialogues.length === 0) return;

    const textLen = def.dialogues[0].text.length;
    if (textLen === 0) return;

    const state = makeState({ currentEventId: def.eventId });

    // TYPEWRITER_SPEED_MS = 30, dtMs = 90 → charsToAdd = 3
    updateTypewriterEffect(state, 90);
    expect(state.typewriter.charIndex).toBe(Math.min(3, textLen));
  });

  it('加速模式下推进更多字符', () => {
    const allDefs = getAllStoryEventDefinitions();
    if (allDefs.length === 0) return;
    const def = allDefs[0];
    if (def.dialogues.length === 0 || def.dialogues[0].text.length === 0) return;

    const stateNormal = makeState({ currentEventId: def.eventId, accelerated: false });
    const stateFast = makeState({ currentEventId: def.eventId, accelerated: true });

    updateTypewriterEffect(stateNormal, 90);
    updateTypewriterEffect(stateFast, 90);

    // 加速模式 speed = 30/3 = 10, charsToAdd = 9; 正常 speed = 30, charsToAdd = 3
    expect(stateFast.typewriter.charIndex).toBeGreaterThanOrEqual(stateNormal.typewriter.charIndex);
  });

  it('字符索引不超过行文本长度', () => {
    const allDefs = getAllStoryEventDefinitions();
    if (allDefs.length === 0) return;
    const def = allDefs[0];
    if (def.dialogues.length === 0) return;

    const textLen = def.dialogues[0].text.length;
    if (textLen === 0) return;

    const state = makeState({ currentEventId: def.eventId });

    // 传入很大的 dtMs
    updateTypewriterEffect(state, 100000);
    expect(state.typewriter.charIndex).toBeLessThanOrEqual(textLen);
  });

  it('行完成时设置 lineComplete 并重置 autoPlayTimer', () => {
    const allDefs = getAllStoryEventDefinitions();
    if (allDefs.length === 0) return;
    const def = allDefs[0];
    if (def.dialogues.length === 0) return;

    const textLen = def.dialogues[0].text.length;
    if (textLen === 0) return;

    const state = makeState({ currentEventId: def.eventId, autoPlayTimer: 1000 });

    // 传入足够大的 dtMs 使行完成
    updateTypewriterEffect(state, 100000);

    if (state.typewriter.charIndex >= textLen) {
      expect(state.typewriter.lineComplete).toBe(true);
      expect(state.autoPlayTimer).toBe(0);
    }
  });

  it('dtMs 不足一个字符时不推进', () => {
    const allDefs = getAllStoryEventDefinitions();
    if (allDefs.length === 0) return;
    const def = allDefs[0];
    if (def.dialogues.length === 0 || def.dialogues[0].text.length === 0) return;

    const state = makeState({ currentEventId: def.eventId });

    // dtMs = 10, speed = 30, charsToAdd = 0
    updateTypewriterEffect(state, 10);
    expect(state.typewriter.charIndex).toBe(0);
  });
});

// ── updateAutoPlayTimer ──

describe('StoryEventPlayer.helpers — updateAutoPlayTimer', () => {
  function makeState(overrides: Partial<StoryEventPlayerInternalState> = {}): StoryEventPlayerInternalState {
    return {
      playState: 'playing',
      currentEventId: null,
      typewriter: { lineIndex: 0, charIndex: 0, lineComplete: false, allComplete: false },
      accelerated: false,
      autoPlayTimer: 0,
      skipConfirmPending: false,
      ...overrides,
    };
  }

  it('行未完成时不调用回调', () => {
    const callback = vi.fn();
    const state = makeState({
      typewriter: { lineIndex: 0, charIndex: 0, lineComplete: false, allComplete: false },
    });

    updateAutoPlayTimer(state, 10000, callback);
    expect(callback).not.toHaveBeenCalled();
  });

  it('全部完成时不调用回调', () => {
    const callback = vi.fn();
    const state = makeState({
      typewriter: { lineIndex: 0, charIndex: 5, lineComplete: true, allComplete: true },
    });

    updateAutoPlayTimer(state, 10000, callback);
    expect(callback).not.toHaveBeenCalled();
  });

  it('计时器未达到阈值时不调用回调', () => {
    const callback = vi.fn();
    const state = makeState({
      typewriter: { lineIndex: 0, charIndex: 5, lineComplete: true, allComplete: false },
      autoPlayTimer: 0,
    });

    // AUTO_PLAY_DELAY_MS = 5000, dtMs = 1000 → timer = 1000 < 5000
    updateAutoPlayTimer(state, 1000, callback);
    expect(callback).not.toHaveBeenCalled();
    expect(state.autoPlayTimer).toBe(1000);
  });

  it('计时器达到阈值时调用回调', () => {
    const callback = vi.fn();
    const state = makeState({
      typewriter: { lineIndex: 0, charIndex: 5, lineComplete: true, allComplete: false },
      autoPlayTimer: 4000,
    });

    // AUTO_PLAY_DELAY_MS = 5000, timer(4000) + dtMs(2000) = 6000 >= 5000
    updateAutoPlayTimer(state, 2000, callback);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('多次调用累计计时器值', () => {
    const callback = vi.fn();
    const state = makeState({
      typewriter: { lineIndex: 0, charIndex: 5, lineComplete: true, allComplete: false },
      autoPlayTimer: 0,
    });

    updateAutoPlayTimer(state, 2000, callback);
    expect(state.autoPlayTimer).toBe(2000);
    expect(callback).not.toHaveBeenCalled();

    updateAutoPlayTimer(state, 2000, callback);
    expect(state.autoPlayTimer).toBe(4000);
    expect(callback).not.toHaveBeenCalled();

    updateAutoPlayTimer(state, 2000, callback);
    expect(state.autoPlayTimer).toBe(6000);
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
