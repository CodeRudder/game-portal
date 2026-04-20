/**
 * 引擎层 — 历史剧情事件系统
 *
 * 管理三国历史剧情事件的触发和进度：
 *   - 剧情事件注册与查询
 *   - 按游戏进度触发剧情（黄巾之乱→董卓进京→官渡之战等）
 *   - 剧情进度追踪（多幕推进）
 *   - 序列化/反序列化
 *
 * 功能覆盖：#11 历史剧情事件（P0）
 *
 * @module engine/event/StoryEventSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type { EventId, EventCondition } from '../../core/event';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

export type StoryEventId = string;
export type StoryActId = string;
export type StoryUrgency = 'low' | 'medium' | 'high' | 'critical';

/** 剧情行 */
export interface StoryLine {
  speaker: string;
  text: string;
  choices?: StoryChoice[];
}

/** 剧情选项 */
export interface StoryChoice {
  id: string;
  text: string;
  consequence: string;
  resourceChanges?: Record<string, number>;
  triggerEventId?: EventId;
}

/** 剧情幕定义 */
export interface StoryActDef {
  id: StoryActId;
  title: string;
  storyLines: StoryLine[];
  backgroundImage?: string;
  characterPortraits?: string[];
  isFinal?: boolean;
}

/** 剧情事件定义 */
export interface StoryEventDef {
  id: StoryEventId;
  title: string;
  description: string;
  acts: StoryActDef[];
  triggerConditions: EventCondition[];
  prerequisiteStoryIds?: StoryEventId[];
  era: string;
  order: number;
  backgroundImage?: string;
  isKeyStory: boolean;
}

/** 剧情进度 */
export interface StoryProgress {
  storyId: StoryEventId;
  currentActId: StoryActId | null;
  completedActIds: Set<StoryActId>;
  triggered: boolean;
  completed: boolean;
  triggeredAt: number | null;
  completedAt: number | null;
}

/** 剧情推进结果 */
export interface StoryAdvanceResult {
  success: boolean;
  previousActId: StoryActId | null;
  currentAct: StoryActDef | null;
  storyCompleted: boolean;
  reason?: string;
}

/** 剧情系统存档 */
export interface StoryEventSaveData {
  version: number;
  storyProgresses: Array<{
    storyId: StoryEventId;
    currentActId: StoryActId | null;
    completedActIds: StoryActId[];
    triggered: boolean;
    completed: boolean;
    triggeredAt: number | null;
    completedAt: number | null;
  }>;
}

// ─────────────────────────────────────────────
// 预定义历史剧情（精简版）
// ─────────────────────────────────────────────

const DEFAULT_STORY_EVENTS: StoryEventDef[] = [
  {
    id: 'story-yellow-turban', title: '黄巾之乱',
    description: '张角率黄巾军起事，天下大乱。',
    era: 'yellow_turban', order: 1, isKeyStory: true,
    triggerConditions: [{ type: 'turn_range', params: { minTurn: 1 } }],
    acts: [
      {
        id: 'yt-act-1', title: '苍天已死',
        storyLines: [
          { speaker: '旁白', text: '中平元年，巨鹿人张角以「苍天已死，黄天当立」号召百姓。' },
          { speaker: '张角', text: '天命在我，尔等速速归降！' },
        ],
        backgroundImage: 'yellow_turban_bg', characterPortraits: ['zhang_jiao'],
      },
      {
        id: 'yt-act-2', title: '平定黄巾', isFinal: true,
        storyLines: [
          { speaker: '旁白', text: '各路英雄纷纷起兵平乱。' },
          { speaker: '玩家', text: '我当如何应对？', choices: [
            { id: 'fight', text: '出兵平乱', consequence: '获得战功', resourceChanges: { troops: -100, gold: 500 } },
            { id: 'defend', text: '坚守城池', consequence: '保全实力', resourceChanges: { grain: -50 } },
          ] },
        ],
      },
    ],
  },
  {
    id: 'story-dong-zhuo', title: '董卓进京',
    description: '董卓率西凉军入洛阳，把持朝政。',
    era: 'dong_zhuo', order: 2, isKeyStory: true,
    triggerConditions: [{ type: 'event_completed', params: { eventId: 'story-yellow-turban' } }],
    prerequisiteStoryIds: ['story-yellow-turban'],
    acts: [
      {
        id: 'dz-act-1', title: '虎牢关前',
        storyLines: [
          { speaker: '旁白', text: '董卓废少帝，立献帝，天下诸侯联合讨伐。' },
          { speaker: '董卓', text: '谁敢来战！' },
        ],
        backgroundImage: 'hu_lao_pass_bg', characterPortraits: ['dong_zhuo', 'lv_bu'],
      },
      {
        id: 'dz-act-2', title: '火烧洛阳', isFinal: true,
        storyLines: [
          { speaker: '旁白', text: '董卓败退，火烧洛阳，迁都长安。' },
          { speaker: '玩家', text: '追击还是休整？', choices: [
            { id: 'pursue', text: '乘胜追击', consequence: '大量战利品', resourceChanges: { gold: 1000, troops: -200 } },
            { id: 'rest', text: '休养生息', consequence: '恢复兵力', resourceChanges: { troops: 300, grain: -100 } },
          ] },
        ],
      },
    ],
  },
  {
    id: 'story-guan-du', title: '官渡之战',
    description: '曹操与袁绍在官渡展开决战。',
    era: 'guan_du', order: 3, isKeyStory: true,
    triggerConditions: [{ type: 'event_completed', params: { eventId: 'story-dong-zhuo' } }],
    prerequisiteStoryIds: ['story-dong-zhuo'],
    acts: [
      {
        id: 'gd-act-1', title: '兵临官渡',
        storyLines: [
          { speaker: '旁白', text: '建安五年，袁绍率十万大军南下。' },
          { speaker: '曹操', text: '兵不在多，在于精也！' },
        ],
        backgroundImage: 'guan_du_bg', characterPortraits: ['cao_cao', 'yuan_shao'],
      },
      {
        id: 'gd-act-2', title: '火烧乌巢', isFinal: true,
        storyLines: [
          { speaker: '旁白', text: '曹操奇袭乌巢，烧毁袁绍粮草。' },
          { speaker: '玩家', text: '如何抉择？', choices: [
            { id: 'ambush', text: '配合奇袭', consequence: '大破袁军', resourceChanges: { gold: 2000, troops: -150 } },
            { id: 'hold', text: '坚守阵地', consequence: '稳扎稳打', resourceChanges: { gold: 500 } },
          ] },
        ],
      },
    ],
  },
];

const STORY_SAVE_VERSION = 1;

// ─────────────────────────────────────────────
// 历史剧情事件系统
// ─────────────────────────────────────────────

export class StoryEventSystem implements ISubsystem {
  readonly name = 'storyEvent';

  private deps!: ISystemDeps;
  private storyDefs: Map<StoryEventId, StoryEventDef> = new Map();
  private progresses: Map<StoryEventId, StoryProgress> = new Map();

  // ─── ISubsystem 生命周期 ────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
    this.loadDefaultStories();
  }

  update(_dt: number): void { /* 由外部驱动 */ }

  getState(): { stories: StoryEventDef[]; progresses: Map<StoryEventId, StoryProgress> } {
    return { stories: Array.from(this.storyDefs.values()), progresses: new Map(this.progresses) };
  }

  reset(): void {
    this.storyDefs.clear();
    this.progresses.clear();
    this.loadDefaultStories();
  }

  // ─── 剧情注册 ──────────────────────────────

  private loadDefaultStories(): void {
    for (const story of DEFAULT_STORY_EVENTS) {
      this.storyDefs.set(story.id, story);
    }
  }

  registerStory(story: StoryEventDef): void { this.storyDefs.set(story.id, story); }
  registerStories(stories: StoryEventDef[]): void { stories.forEach((s) => this.registerStory(s)); }
  getStory(storyId: StoryEventId): StoryEventDef | undefined { return this.storyDefs.get(storyId); }
  getAllStories(): StoryEventDef[] { return Array.from(this.storyDefs.values()); }
  getStoriesByEra(era: string): StoryEventDef[] { return this.getAllStories().filter((s) => s.era === era); }

  // ─── 剧情触发 ──────────────────────────────

  canTriggerStory(storyId: StoryEventId, currentTurn?: number): boolean {
    const story = this.storyDefs.get(storyId);
    if (!story) return false;
    const progress = this.progresses.get(storyId);
    if (progress?.triggered) return false;

    // 检查前置剧情
    if (story.prerequisiteStoryIds) {
      for (const preId of story.prerequisiteStoryIds) {
        if (!(this.progresses.get(preId)?.completed ?? false)) return false;
      }
    }

    // 检查触发条件
    if (currentTurn !== undefined) {
      for (const cond of story.triggerConditions) {
        if (!this.evaluateCondition(cond, currentTurn)) return false;
      }
    }
    return true;
  }

  getAvailableStories(currentTurn: number): StoryEventDef[] {
    return this.getAllStories()
      .filter((s) => this.canTriggerStory(s.id, currentTurn))
      .sort((a, b) => a.order - b.order);
  }

  triggerStory(storyId: StoryEventId): StoryEventDef | null {
    const story = this.storyDefs.get(storyId);
    if (!story) return null;
    const existing = this.progresses.get(storyId);
    if (existing?.triggered) return null;

    const firstAct = story.acts[0];
    this.progresses.set(storyId, {
      storyId,
      currentActId: firstAct?.id ?? null,
      completedActIds: new Set(),
      triggered: true,
      completed: false,
      triggeredAt: Date.now(),
      completedAt: null,
    });

    this.deps?.eventBus.emit('story:triggered', {
      storyId, title: story.title, era: story.era, actId: firstAct?.id,
    });
    return story;
  }

  // ─── 剧情推进 ──────────────────────────────

  advanceStory(storyId: StoryEventId): StoryAdvanceResult {
    const story = this.storyDefs.get(storyId);
    const progress = this.progresses.get(storyId);
    if (!story || !progress) {
      return { success: false, previousActId: null, currentAct: null, storyCompleted: false, reason: '剧情不存在或未触发' };
    }
    if (progress.completed) {
      return { success: false, previousActId: progress.currentActId, currentAct: null, storyCompleted: true, reason: '剧情已完成' };
    }

    const previousActId = progress.currentActId;
    if (previousActId) progress.completedActIds.add(previousActId);

    const currentIdx = story.acts.findIndex((a) => a.id === previousActId);
    const nextAct = currentIdx >= 0 && currentIdx < story.acts.length - 1
      ? story.acts[currentIdx + 1] : null;

    if (nextAct) {
      progress.currentActId = nextAct.id;
      this.deps?.eventBus.emit('story:actAdvanced', {
        storyId, fromActId: previousActId, toActId: nextAct.id, actTitle: nextAct.title,
      });
      return { success: true, previousActId, currentAct: nextAct, storyCompleted: false };
    }

    // 没有下一幕，完成
    progress.currentActId = null;
    progress.completed = true;
    progress.completedAt = Date.now();
    this.deps?.eventBus.emit('story:completed', { storyId, title: story.title, era: story.era });
    return { success: true, previousActId, currentAct: null, storyCompleted: true };
  }

  getCurrentAct(storyId: StoryEventId): StoryActDef | null {
    const story = this.storyDefs.get(storyId);
    const progress = this.progresses.get(storyId);
    if (!story || !progress || !progress.currentActId) return null;
    return story.acts.find((a) => a.id === progress.currentActId) ?? null;
  }

  getProgress(storyId: StoryEventId): StoryProgress | undefined { return this.progresses.get(storyId); }

  getProgressStats(storyId: StoryEventId): { completed: number; total: number; percentage: number } {
    const story = this.storyDefs.get(storyId);
    const progress = this.progresses.get(storyId);
    if (!story) return { completed: 0, total: 0, percentage: 0 };
    const total = story.acts.length;
    const completed = progress?.completedActIds.size ?? 0;
    return { completed, total, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 };
  }

  isStoryTriggered(storyId: StoryEventId): boolean { return this.progresses.get(storyId)?.triggered ?? false; }
  isStoryCompleted(storyId: StoryEventId): boolean { return this.progresses.get(storyId)?.completed ?? false; }
  getCompletedStories(): StoryEventDef[] { return this.getAllStories().filter((s) => this.isStoryCompleted(s.id)); }
  getActiveStories(): StoryEventDef[] { return this.getAllStories().filter((s) => this.isStoryTriggered(s.id) && !this.isStoryCompleted(s.id)); }

  // ─── 内部方法 ──────────────────────────────

  private evaluateCondition(cond: EventCondition, currentTurn: number): boolean {
    switch (cond.type) {
      case 'turn_range': {
        const minTurn = (cond.params.minTurn as number) ?? 0;
        const maxTurn = cond.params.maxTurn as number | undefined;
        return currentTurn >= minTurn && (maxTurn === undefined || currentTurn <= maxTurn);
      }
      case 'event_completed': {
        const eventId = cond.params.eventId as string;
        return this.progresses.get(eventId)?.completed ?? false;
      }
      default: return true;
    }
  }

  // ─── 序列化 ────────────────────────────────

  exportSaveData(): StoryEventSaveData {
    return {
      version: STORY_SAVE_VERSION,
      storyProgresses: Array.from(this.progresses.entries()).map(([storyId, p]) => ({
        storyId, currentActId: p.currentActId, completedActIds: Array.from(p.completedActIds),
        triggered: p.triggered, completed: p.completed, triggeredAt: p.triggeredAt, completedAt: p.completedAt,
      })),
    };
  }

  importSaveData(data: StoryEventSaveData): void {
    this.progresses.clear();
    for (const sp of data.storyProgresses ?? []) {
      this.progresses.set(sp.storyId, {
        storyId: sp.storyId, currentActId: sp.currentActId,
        completedActIds: new Set(sp.completedActIds), triggered: sp.triggered,
        completed: sp.completed, triggeredAt: sp.triggeredAt, completedAt: sp.completedAt,
      });
    }
  }
}
