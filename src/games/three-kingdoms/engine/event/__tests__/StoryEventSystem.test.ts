/**
 * StoryEventSystem 单元测试
 *
 * 覆盖历史剧情事件系统的所有功能：
 * - ISubsystem 接口
 * - 剧情注册
 * - 剧情触发（条件检查、前置剧情）
 * - 剧情推进（多幕）
 * - 进度追踪
 * - 默认三国剧情
 * - 序列化/反序列化
 */

import { StoryEventSystem } from '../StoryEventSystem';
import type { StoryEventDef, StoryActDef } from '../StoryEventSystem';
import type { ISystemDeps } from '../../../core/types';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

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

function createSystem(): StoryEventSystem {
  const sys = new StoryEventSystem();
  sys.init(mockDeps());
  return sys;
}

/** 创建测试剧情 */
function createTestStory(overrides?: Partial<StoryEventDef>): StoryEventDef {
  return {
    id: 'story-test-01',
    title: '测试剧情',
    description: '测试用剧情事件',
    era: 'test',
    order: 1,
    isKeyStory: true,
    triggerConditions: [
      { type: 'turn_range', params: { minTurn: 1 } },
    ],
    acts: [
      {
        id: 'act-1',
        title: '第一幕',
        storyLines: [
          { speaker: '旁白', text: '测试文本' },
        ],
      },
      {
        id: 'act-2',
        title: '第二幕',
        storyLines: [
          { speaker: '角色', text: '测试对话' },
        ],
      },
      {
        id: 'act-3',
        title: '第三幕',
        storyLines: [
          { speaker: '旁白', text: '结局' },
        ],
        isFinal: true,
      },
    ],
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('StoryEventSystem', () => {
  let system: StoryEventSystem;

  beforeEach(() => {
    system = createSystem();
  });

  // ─── ISubsystem 接口 ────────────────────────

  describe('ISubsystem 接口', () => {
    it('应该有正确的 name 属性', () => {
      expect(system.name).toBe('storyEvent');
    });

    it('init 应加载默认剧情', () => {
      const stories = system.getAllStories();
      expect(stories.length).toBeGreaterThan(0);
    });

    it('reset 应清空进度但保留剧情定义', () => {
      system.triggerStory('story-yellow-turban');
      system.reset();
      expect(system.getAllStories().length).toBeGreaterThan(0);
      expect(system.isStoryTriggered('story-yellow-turban')).toBe(false);
    });

    it('update 不应抛出异常', () => {
      expect(() => system.update(16)).not.toThrow();
    });
  });

  // ─── 剧情注册 ──────────────────────────────

  describe('剧情注册', () => {
    it('应该能注册自定义剧情', () => {
      const story = createTestStory();
      system.registerStory(story);
      expect(system.getStory('story-test-01')).toBeDefined();
    });

    it('应该能批量注册剧情', () => {
      const stories = [
        createTestStory({ id: 's1' }),
        createTestStory({ id: 's2' }),
      ];
      system.registerStories(stories);
      expect(system.getStory('s1')).toBeDefined();
      expect(system.getStory('s2')).toBeDefined();
    });

    it('按时期查询应返回正确结果', () => {
      const stories = system.getStoriesByEra('yellow_turban');
      expect(stories.length).toBeGreaterThan(0);
      expect(stories.every((s) => s.era === 'yellow_turban')).toBe(true);
    });
  });

  // ─── 默认三国剧情 ──────────────────────────

  describe('默认三国剧情', () => {
    it('应包含黄巾之乱', () => {
      const story = system.getStory('story-yellow-turban');
      expect(story).toBeDefined();
      expect(story!.title).toBe('黄巾之乱');
      expect(story!.era).toBe('yellow_turban');
      expect(story!.order).toBe(1);
    });

    it('应包含董卓进京', () => {
      const story = system.getStory('story-dong-zhuo');
      expect(story).toBeDefined();
      expect(story!.title).toBe('董卓进京');
      expect(story!.prerequisiteStoryIds).toContain('story-yellow-turban');
    });

    it('应包含官渡之战', () => {
      const story = system.getStory('story-guan-du');
      expect(story).toBeDefined();
      expect(story!.title).toBe('官渡之战');
      expect(story!.prerequisiteStoryIds).toContain('story-dong-zhuo');
    });

    it('剧情应按 order 排序', () => {
      const available = system.getAvailableStories(1);
      if (available.length >= 2) {
        expect(available[0].order).toBeLessThanOrEqual(available[1].order);
      }
    });
  });

  // ─── 剧情触发 ──────────────────────────────

  describe('剧情触发', () => {
    it('满足条件时应能触发', () => {
      const canTrigger = system.canTriggerStory('story-yellow-turban', 1);
      expect(canTrigger).toBe(true);
    });

    it('回合不足时不应触发', () => {
      const canTrigger = system.canTriggerStory('story-yellow-turban', 0);
      expect(canTrigger).toBe(false);
    });

    it('未完成前置剧情时不应触发后续', () => {
      const canTrigger = system.canTriggerStory('story-dong-zhuo', 10);
      expect(canTrigger).toBe(false);
    });

    it('完成前置后应能触发后续', () => {
      // 触发并完成黄巾之乱
      system.triggerStory('story-yellow-turban');
      const progress = system.getProgress('story-yellow-turban');
      if (progress) {
        progress.completed = true;
      }

      const canTrigger = system.canTriggerStory('story-dong-zhuo', 10);
      expect(canTrigger).toBe(true);
    });

    it('已触发的剧情不应重复触发', () => {
      system.triggerStory('story-yellow-turban');
      const canTrigger = system.canTriggerStory('story-yellow-turban', 1);
      expect(canTrigger).toBe(false);
    });

    it('触发剧情应返回定义', () => {
      const story = system.triggerStory('story-yellow-turban');
      expect(story).not.toBeNull();
      expect(story!.id).toBe('story-yellow-turban');
    });

    it('触发不存在的剧情应返回 null', () => {
      expect(system.triggerStory('nonexistent')).toBeNull();
    });

    it('触发应发出 story:triggered 事件', () => {
      const deps = mockDeps();
      system.init(deps);
      system.triggerStory('story-yellow-turban');

      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'story:triggered',
        expect.objectContaining({
          storyId: 'story-yellow-turban',
          title: '黄巾之乱',
        }),
      );
    });

    it('getAvailableStories 应返回当前可触发的剧情', () => {
      const available = system.getAvailableStories(1);
      expect(available.length).toBeGreaterThan(0);
      expect(available[0].id).toBe('story-yellow-turban');
    });
  });

  // ─── 剧情推进 ──────────────────────────────

  describe('剧情推进', () => {
    it('推进应移到下一幕', () => {
      system.triggerStory('story-yellow-turban');
      const result = system.advanceStory('story-yellow-turban');

      expect(result.success).toBe(true);
      expect(result.currentAct).not.toBeNull();
      expect(result.currentAct!.id).toBe('yt-act-2');
      expect(result.storyCompleted).toBe(false);
    });

    it('最后一幕推进后应完成剧情', () => {
      system.triggerStory('story-yellow-turban');
      system.advanceStory('story-yellow-turban'); // act-1 → act-2
      const result = system.advanceStory('story-yellow-turban'); // act-2 → end

      expect(result.success).toBe(true);
      expect(result.storyCompleted).toBe(true);
      expect(result.currentAct).toBeNull();
    });

    it('已完成的剧情不应再推进', () => {
      system.triggerStory('story-yellow-turban');
      system.advanceStory('story-yellow-turban');
      system.advanceStory('story-yellow-turban');

      const result = system.advanceStory('story-yellow-turban');
      expect(result.success).toBe(false);
      expect(result.storyCompleted).toBe(true);
    });

    it('推进不存在的剧情应失败', () => {
      const result = system.advanceStory('nonexistent');
      expect(result.success).toBe(false);
    });

    it('推进应发出事件', () => {
      const deps = mockDeps();
      system.init(deps);
      system.triggerStory('story-yellow-turban');
      system.advanceStory('story-yellow-turban');

      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'story:actAdvanced',
        expect.objectContaining({
          storyId: 'story-yellow-turban',
          fromActId: 'yt-act-1',
          toActId: 'yt-act-2',
        }),
      );
    });

    it('完成应发出 story:completed 事件', () => {
      const deps = mockDeps();
      system.init(deps);
      system.triggerStory('story-yellow-turban');
      system.advanceStory('story-yellow-turban');
      system.advanceStory('story-yellow-turban');

      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'story:completed',
        expect.objectContaining({
          storyId: 'story-yellow-turban',
          title: '黄巾之乱',
        }),
      );
    });
  });

  // ─── 进度追踪 ──────────────────────────────

  describe('进度追踪', () => {
    it('getCurrentAct 应返回当前幕', () => {
      system.triggerStory('story-yellow-turban');
      const act = system.getCurrentAct('story-yellow-turban');
      expect(act).not.toBeNull();
      expect(act!.id).toBe('yt-act-1');
    });

    it('getProgressStats 应返回正确统计', () => {
      system.triggerStory('story-yellow-turban');
      const stats = system.getProgressStats('story-yellow-turban');
      expect(stats.completed).toBe(0);
      expect(stats.total).toBe(2);
      expect(stats.percentage).toBe(0);
    });

    it('推进后统计应更新', () => {
      system.triggerStory('story-yellow-turban');
      system.advanceStory('story-yellow-turban');
      const stats = system.getProgressStats('story-yellow-turban');
      expect(stats.completed).toBe(1);
      expect(stats.percentage).toBe(50);
    });

    it('isStoryTriggered 应正确反映状态', () => {
      expect(system.isStoryTriggered('story-yellow-turban')).toBe(false);
      system.triggerStory('story-yellow-turban');
      expect(system.isStoryTriggered('story-yellow-turban')).toBe(true);
    });

    it('isStoryCompleted 应正确反映状态', () => {
      expect(system.isStoryCompleted('story-yellow-turban')).toBe(false);
      system.triggerStory('story-yellow-turban');
      system.advanceStory('story-yellow-turban');
      system.advanceStory('story-yellow-turban');
      expect(system.isStoryCompleted('story-yellow-turban')).toBe(true);
    });

    it('getActiveStories 应返回进行中的剧情', () => {
      system.triggerStory('story-yellow-turban');
      const active = system.getActiveStories();
      expect(active.some((s) => s.id === 'story-yellow-turban')).toBe(true);
    });

    it('getCompletedStories 应返回已完成的剧情', () => {
      system.triggerStory('story-yellow-turban');
      system.advanceStory('story-yellow-turban');
      system.advanceStory('story-yellow-turban');

      const completed = system.getCompletedStories();
      expect(completed.some((s) => s.id === 'story-yellow-turban')).toBe(true);
    });
  });

  // ─── 序列化 ────────────────────────────────

  describe('序列化', () => {
    it('导出后导入应保持一致', () => {
      system.triggerStory('story-yellow-turban');
      system.advanceStory('story-yellow-turban');

      const data = system.exportSaveData();

      const newSystem = createSystem();
      newSystem.importSaveData(data);

      expect(newSystem.isStoryTriggered('story-yellow-turban')).toBe(true);
      expect(newSystem.isStoryCompleted('story-yellow-turban')).toBe(false);

      const progress = newSystem.getProgress('story-yellow-turban');
      expect(progress!.completedActIds.has('yt-act-1')).toBe(true);
    });

    it('空系统导出导入不应出错', () => {
      const data = system.exportSaveData();
      expect(data.storyProgresses).toHaveLength(0);

      const newSystem = createSystem();
      expect(() => newSystem.importSaveData(data)).not.toThrow();
    });
  });
});
