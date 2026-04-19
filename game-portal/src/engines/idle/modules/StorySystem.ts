/**
 * StorySystem — 放置游戏剧情系统核心模块
 *
 * 提供章节制剧情管理、对话系统、剧情触发条件判定、
 * 分支选择、剧情回放等完整功能。
 *
 * @module engines/idle/modules/StorySystem
 */

// ============================================================
// 类型定义
// ============================================================

/** 对话角色 */
export interface DialogueCharacter {
  id: string;
  name: string;
  avatar?: string;
}

/** 对话行 */
export interface DialogueLine {
  /** 唯一标识 */
  id: string;
  /** 说话角色 ID（空字符串表示旁白） */
  characterId: string;
  /** 对话内容 */
  text: string;
  /** 分支选项（存在时触发选择） */
  choices?: DialogueChoice[];
}

/** 对话分支选项 */
export interface DialogueChoice {
  /** 选项 ID */
  optionId: string;
  /** 选项文本 */
  text: string;
  /** 选择后跳转到的对话行 ID */
  nextDialogueId: string;
}

/** 剧情触发条件 */
export interface StoryTrigger {
  /** 条件类型 */
  type: 'reach_stage' | 'build' | 'defeat' | 'collect' | 'custom';
  /** 目标 ID */
  targetId: string;
  /** 目标值 */
  value: number;
}

/** 章节定义 */
export interface ChapterDef {
  /** 章节唯一标识 */
  id: string;
  /** 章节标题 */
  title: string;
  /** 章节序号（用于排序） */
  order: number;
  /** 触发条件列表（全部满足自动触发） */
  triggers: StoryTrigger[];
  /** 对话行列表 */
  dialogues: DialogueLine[];
  /** 完成奖励 */
  rewards?: Record<string, number>;
  /** 下一章节 ID */
  nextChapterId?: string;
}

/** 章节运行时状态 */
export interface ChapterState {
  defId: string;
  /** 是否已解锁 */
  unlocked: boolean;
  /** 是否已完成 */
  completed: boolean;
  /** 是否正在播放 */
  active: boolean;
  /** 当前对话行索引 */
  currentDialogueIndex: number;
  /** 已做出的选择记录 */
  choicesMade: Record<string, string>;
  /** 完成时间戳 */
  completedAt: number;
}

/** 剧情系统事件 */
export type StoryEvent =
  | { type: 'chapter_unlocked'; chapterId: string }
  | { type: 'story_triggered'; chapterId: string }
  | { type: 'dialogue_advanced'; chapterId: string; lineId: string }
  | { type: 'choice_made'; chapterId: string; optionId: string }
  | { type: 'chapter_completed'; chapterId: string };

/** 事件监听器类型 */
export type StoryEventListener = (event: StoryEvent) => void;

// ============================================================
// StorySystem 实现
// ============================================================

/**
 * 剧情系统 — 管理章节制剧情、对话、分支选择
 *
 * @example
 * ```typescript
 * const story = new StorySystem();
 * story.registerChapters([
 *   {
 *     id: 'ch1',
 *     title: '序章：觉醒',
 *     order: 1,
 *     triggers: [{ type: 'reach_stage', targetId: 'stage_1', value: 1 }],
 *     dialogues: [
 *       { id: 'd1', characterId: '', text: '在遥远的古代...' },
 *       { id: 'd2', characterId: 'hero', text: '我是谁？' },
 *     ],
 *   },
 * ]);
 * story.triggerStory({ type: 'reach_stage', targetId: 'stage_1', value: 1 });
 * ```
 */
export class StorySystem {

  // ========== 内部数据 ==========

  /** 章节定义注册表 */
  private readonly chapterDefs: Map<string, ChapterDef> = new Map();

  /** 章节运行时状态 */
  private readonly chapterStates: Map<string, ChapterState> = new Map();

  /** 角色注册表 */
  private readonly characters: Map<string, DialogueCharacter> = new Map();

  /** 当前激活的章节 ID */
  private activeChapterId: string | null = null;

  /** 事件监听器 */
  private readonly listeners: StoryEventListener[] = [];

  // ============================================================
  // 初始化
  // ============================================================

  /**
   * 注册角色列表
   */
  registerCharacters(chars: DialogueCharacter[]): void {
    for (const c of chars) this.characters.set(c.id, c);
  }

  /**
   * 注册章节定义列表
   */
  registerChapters(chapters: ChapterDef[]): void {
    for (const ch of chapters) {
      this.chapterDefs.set(ch.id, ch);
      if (!this.chapterStates.has(ch.id)) {
        this.chapterStates.set(ch.id, {
          defId: ch.id,
          unlocked: ch.order === 1, // 第一章默认解锁
          completed: false,
          active: false,
          currentDialogueIndex: 0,
          choicesMade: {},
          completedAt: 0,
        });
      }
    }
  }

  /**
   * 从存档恢复状态
   */
  loadState(data: {
    chapterStates: Record<string, Partial<ChapterState>>;
    activeChapterId?: string | null;
  }): void {
    for (const [id, saved] of Object.entries(data.chapterStates)) {
      if (!this.chapterDefs.has(id)) continue;
      const existing = this.chapterStates.get(id);
      if (existing) {
        Object.assign(existing, saved);
      }
    }
    this.activeChapterId = data.activeChapterId ?? null;
  }

  /**
   * 导出当前状态
   */
  saveState(): {
    chapterStates: Record<string, ChapterState>;
    activeChapterId: string | null;
  } {
    const chapterStates: Record<string, ChapterState> = {};
    for (const [id, state] of this.chapterStates) {
      chapterStates[id] = { ...state, choicesMade: { ...state.choicesMade } };
    }
    return { chapterStates, activeChapterId: this.activeChapterId };
  }

  // ============================================================
  // 查询
  // ============================================================

  /** 获取所有章节定义（按 order 排序） */
  get chapters(): ChapterDef[] {
    return Array.from(this.chapterDefs.values()).sort((a, b) => a.order - b.order);
  }

  /** 获取当前章节 */
  get currentChapter(): ChapterDef | null {
    if (!this.activeChapterId) return null;
    return this.chapterDefs.get(this.activeChapterId) ?? null;
  }

  /** 获取当前对话行 */
  get dialogues(): DialogueLine[] {
    if (!this.activeChapterId) return [];
    return this.chapterDefs.get(this.activeChapterId)?.dialogues ?? [];
  }

  /**
   * 获取当前对话行
   */
  getCurrentDialogue(): DialogueLine | null {
    const state = this.activeChapterId ? this.chapterStates.get(this.activeChapterId) : null;
    if (!state) return null;
    const chapter = this.chapterDefs.get(state.defId);
    if (!chapter) return null;
    return chapter.dialogues[state.currentDialogueIndex] ?? null;
  }

  /**
   * 获取角色信息
   */
  getCharacter(id: string): DialogueCharacter | undefined {
    return this.characters.get(id);
  }

  /**
   * 获取章节状态
   */
  getChapterState(id: string): ChapterState | undefined {
    return this.chapterStates.get(id);
  }

  /**
   * 是否有激活的剧情
   */
  isStoryActive(): boolean {
    return this.activeChapterId !== null;
  }

  // ============================================================
  // 操作
  // ============================================================

  /**
   * 触发剧情
   *
   * 检查所有未解锁章节的触发条件，满足则解锁并开始播放。
   * 也可以传入指定章节 ID 直接触发。
   *
   * @param event - 触发事件
   * @returns 被触发的章节 ID，无匹配返回 null
   */
  triggerStory(event: StoryTrigger): string | null {
    for (const [id, def] of this.chapterDefs) {
      const state = this.chapterStates.get(id);
      if (!state || state.unlocked || state.completed) continue;

      const allMet = def.triggers.every((t) =>
        t.type === event.type && t.targetId === event.targetId && t.value <= event.value,
      );

      if (allMet) {
        state.unlocked = true;
        this.startChapter(id);
        this.emitEvent({ type: 'chapter_unlocked', chapterId: id });
        this.emitEvent({ type: 'story_triggered', chapterId: id });
        return id;
      }
    }
    return null;
  }

  /**
   * 手动开始一个已解锁的章节
   */
  startChapter(chapterId: string): boolean {
    const state = this.chapterStates.get(chapterId);
    if (!state || !state.unlocked || state.completed) return false;

    // 如果有正在播放的章节，先暂停
    if (this.activeChapterId && this.activeChapterId !== chapterId) {
      const activeState = this.chapterStates.get(this.activeChapterId);
      if (activeState) activeState.active = false;
    }

    state.active = true;
    state.currentDialogueIndex = 0;
    this.activeChapterId = chapterId;
    return true;
  }

  /**
   * 推进对话到下一行
   *
   * @returns 下一行对话，已是最后一行返回 null
   */
  advanceDialogue(): DialogueLine | null {
    if (!this.activeChapterId) return null;

    const state = this.chapterStates.get(this.activeChapterId);
    const chapter = this.chapterDefs.get(this.activeChapterId);
    if (!state || !chapter) return null;

    // 当前对话有分支选项时，不能自动推进（需 makeChoice）
    const currentLine = chapter.dialogues[state.currentDialogueIndex];
    if (currentLine?.choices && currentLine.choices.length > 0) return null;

    state.currentDialogueIndex++;

    if (state.currentDialogueIndex >= chapter.dialogues.length) {
      // 对话结束，完成章节
      this.completeChapter(this.activeChapterId);
      return null;
    }

    const nextLine = chapter.dialogues[state.currentDialogueIndex];
    this.emitEvent({ type: 'dialogue_advanced', chapterId: this.activeChapterId, lineId: nextLine.id });
    return nextLine;
  }

  /**
   * 在分支对话中做出选择
   *
   * @param optionId - 选择的选项 ID
   * @returns 选择后的下一行对话，无效选择返回 null
   */
  makeChoice(optionId: string): DialogueLine | null {
    if (!this.activeChapterId) return null;

    const state = this.chapterStates.get(this.activeChapterId);
    const chapter = this.chapterDefs.get(this.activeChapterId);
    if (!state || !chapter) return null;

    const currentLine = chapter.dialogues[state.currentDialogueIndex];
    if (!currentLine?.choices) return null;

    const choice = currentLine.choices.find((c) => c.optionId === optionId);
    if (!choice) return null;

    // 记录选择
    state.choicesMade[currentLine.id] = optionId;
    this.emitEvent({ type: 'choice_made', chapterId: this.activeChapterId, optionId });

    // 跳转到指定对话行
    const nextIndex = chapter.dialogues.findIndex((d) => d.id === choice.nextDialogueId);
    if (nextIndex === -1) return null;

    state.currentDialogueIndex = nextIndex;
    const nextLine = chapter.dialogues[nextIndex];
    this.emitEvent({ type: 'dialogue_advanced', chapterId: this.activeChapterId, lineId: nextLine.id });
    return nextLine;
  }

  /**
   * 重放指定章节
   *
   * @param id - 章节 ID
   * @returns 是否成功开始重放
   */
  replayChapter(id: string): boolean {
    const state = this.chapterStates.get(id);
    if (!state || !state.completed) return false;

    state.currentDialogueIndex = 0;
    state.active = true;
    state.choicesMade = {};
    this.activeChapterId = id;
    return true;
  }

  // ============================================================
  // 事件
  // ============================================================

  onEvent(listener: StoryEventListener): void {
    this.listeners.push(listener);
  }

  offEvent(listener: StoryEventListener): void {
    const idx = this.listeners.indexOf(listener);
    if (idx !== -1) this.listeners.splice(idx, 1);
  }

  // ============================================================
  // 重置
  // ============================================================

  reset(): void {
    this.activeChapterId = null;
    for (const [id, state] of this.chapterStates) {
      const def = this.chapterDefs.get(id);
      state.unlocked = def?.order === 1;
      state.completed = false;
      state.active = false;
      state.currentDialogueIndex = 0;
      state.choicesMade = {};
      state.completedAt = 0;
    }
  }

  // ============================================================
  // 内部工具
  // ============================================================

  private completeChapter(chapterId: string): void {
    const state = this.chapterStates.get(chapterId);
    if (!state) return;

    state.completed = true;
    state.active = false;
    state.completedAt = Date.now();
    this.activeChapterId = null;

    // 解锁下一章
    const def = this.chapterDefs.get(chapterId);
    if (def?.nextChapterId) {
      const nextState = this.chapterStates.get(def.nextChapterId);
      if (nextState && !nextState.unlocked) {
        nextState.unlocked = true;
        this.emitEvent({ type: 'chapter_unlocked', chapterId: def.nextChapterId });
      }
    }

    this.emitEvent({ type: 'chapter_completed', chapterId });
  }

  private emitEvent(event: StoryEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (_error) {
        // 监听器异常不中断流程
      }
    }
  }
}
