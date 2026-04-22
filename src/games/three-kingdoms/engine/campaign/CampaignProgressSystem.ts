/**
 * 关卡系统 — 关卡进度管理
 *
 * 管理玩家的关卡进度、星级评定、解锁状态。
 * 实现 ISubsystem 接口，可注册到引擎子系统注册表中。
 *
 * 核心职责：
 * - 初始化/重置进度（第1章第1关解锁）
 * - 查询关卡状态（locked/available/cleared/threeStar）
 * - 通关处理（更新星级、解锁下一关）
 * - 序列化/反序列化（存档支持）
 *
 * @module engine/campaign/CampaignProgressSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  CampaignProgress,
  CampaignSaveData,
  Chapter,
  ICampaignDataProvider,
  Stage,
  StageState,
  StageStatus,
  StarRating,
} from './campaign.types';
import { MAX_STARS } from './campaign.types';
import { serializeProgress, deserializeProgress } from './CampaignSerializer';

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

/** 创建初始关卡状态（未通关） */
function createInitialStageState(stageId: string): StageState {
  return {
    stageId,
    stars: 0 as StarRating,
    firstCleared: false,
    clearCount: 0,
  };
}

/** 创建初始进度（第1章第1关解锁） */
function createInitialProgress(dataProvider: ICampaignDataProvider): CampaignProgress {
  const chapters = dataProvider.getChapters();
  const firstChapter = chapters.length > 0 ? chapters[0] : null;
  const stageStates: Record<string, StageState> = {};

  // 初始化所有关卡状态
  for (const chapter of chapters) {
    for (const stage of chapter.stages) {
      stageStates[stage.id] = createInitialStageState(stage.id);
    }
  }

  return {
    currentChapterId: firstChapter?.id ?? '',
    stageStates,
    lastClearTime: 0,
  };
}

// ─────────────────────────────────────────────
// CampaignProgressSystem
// ─────────────────────────────────────────────

/**
 * 关卡进度管理系统
 *
 * 管理玩家在战役模式中的关卡进度，包括：
 * - 关卡解锁/锁定状态
 * - 星级评定记录
 * - 通关次数统计
 * - 章节进度追踪
 *
 * @example
 * ```ts
 * const progress = new CampaignProgressSystem(configDataProvider);
 * progress.initProgress();
 *
 * // 检查是否可挑战
 * if (progress.canChallenge('chapter1_stage2')) {
 *   // 执行战斗...
 *   progress.completeStage('chapter1_stage2', 3);
 * }
 * ```
 */
export class CampaignProgressSystem implements ISubsystem {
  // ── ISubsystem 接口 ──
  readonly name = 'campaignProgress' as const;
  private deps: ISystemDeps | null = null;

  /** 关卡数据提供者 */
  private readonly dataProvider: ICampaignDataProvider;
  /** 当前关卡进度 */
  private progress: CampaignProgress;

  constructor(dataProvider: ICampaignDataProvider) {
    this.dataProvider = dataProvider;
    this.progress = createInitialProgress(dataProvider);
  }

  // ── ISubsystem 适配层 ──

  /** 注入依赖 */
  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  /** ISubsystem.update — 关卡进度系统不需要每帧更新 */
  update(_dt: number): void {
    // 关卡进度系统是事件驱动的，不需要每帧更新
  }

  /** ISubsystem.getState — 返回进度快照 */
  getState(): CampaignProgress {
    return this.getProgress();
  }

  /** ISubsystem.reset — 重置到初始状态 */
  reset(): void {
    this.progress = createInitialProgress(this.dataProvider);
  }

  // ─────────────────────────────────────────────
  // 1. 初始化
  // ─────────────────────────────────────────────

  /**
   * 初始化进度
   *
   * 将进度重置为初始状态：第1章第1关解锁，其余关卡锁定。
   * 所有关卡星级归零，通关次数归零。
   */
  initProgress(): void {
    this.progress = createInitialProgress(this.dataProvider);
  }

  // ─────────────────────────────────────────────
  // 2. 进度查询
  // ─────────────────────────────────────────────

  /**
   * 获取完整进度数据
   *
   * @returns 当前进度数据的深拷贝
   */
  getProgress(): CampaignProgress {
    // 深拷贝 stageStates，防止外部修改影响内部状态
    const stageStates: Record<string, StageState> = {};
    for (const [id, state] of Object.entries(this.progress.stageStates)) {
      stageStates[id] = { ...state };
    }
    return {
      currentChapterId: this.progress.currentChapterId,
      stageStates,
      lastClearTime: this.progress.lastClearTime,
    };
  }

  /**
   * 获取当前章节
   *
   * 返回玩家当前所在的章节配置。
   *
   * @returns 当前章节，如果不存在返回 null
   */
  getCurrentChapter(): Chapter | null {
    const chapter = this.dataProvider.getChapter(this.progress.currentChapterId);
    return chapter ?? null;
  }

  /**
   * 获取关卡状态
   *
   * 根据关卡进度和前置关卡通关情况，计算关卡状态：
   * - locked: 前置关卡未通关
   * - available: 前置关卡已通关，可挑战
   * - cleared: 已通关（1-2星）
   * - threeStar: 三星通关
   *
   * @param stageId - 关卡ID
   * @returns 关卡状态
   */
  getStageStatus(stageId: string): StageStatus {
    const state = this.progress.stageStates[stageId];
    if (!state) return 'locked';

    // 三星通关
    if (state.stars >= MAX_STARS) return 'threeStar';

    // 已通关（1-2星）
    if (state.firstCleared) return 'cleared';

    // 检查前置关卡是否通关
    if (this.isPredecessorCleared(stageId)) return 'available';

    return 'locked';
  }

  /**
   * 检查是否可以挑战指定关卡
   *
   * 关卡可挑战条件：状态为 available 或已通关（可重复挑战）。
   *
   * @param stageId - 关卡ID
   * @returns 是否可挑战
   */
  canChallenge(stageId: string): boolean {
    const status = this.getStageStatus(stageId);
    return status === 'available' || status === 'cleared' || status === 'threeStar';
  }

  /**
   * 获取关卡星级
   *
   * @param stageId - 关卡ID
   * @returns 星级（0-3），关卡不存在返回0
   */
  getStageStars(stageId: string): number {
    const state = this.progress.stageStates[stageId];
    return state?.stars ?? 0;
  }

  /**
   * 获取总星数
   *
   * 统计所有已通关关卡的星级之和。
   *
   * @returns 总星数
   */
  getTotalStars(): number {
    let total = 0;
    for (const state of Object.values(this.progress.stageStates)) {
      total += state.stars;
    }
    return total;
  }

  /**
   * 获取指定关卡的通关次数
   *
   * @param stageId - 关卡ID
   * @returns 通关次数，关卡不存在返回0
   */
  getClearCount(stageId: string): number {
    const state = this.progress.stageStates[stageId];
    return state?.clearCount ?? 0;
  }

  /**
   * 检查指定关卡是否已首通
   *
   * @param stageId - 关卡ID
   * @returns 是否已首通
   */
  isFirstCleared(stageId: string): boolean {
    const state = this.progress.stageStates[stageId];
    return state?.firstCleared ?? false;
  }

  // ─────────────────────────────────────────────
  // 3. 通关处理
  // ─────────────────────────────────────────────

  /**
   * 通关处理
   *
   * 更新关卡星级（取历史最高），增加通关次数，
   * 标记首通状态，并解锁下一关卡。
   *
   * @param stageId - 关卡ID
   * @param stars - 本次通关星级（0-3）
   * @throws {Error} 关卡不存在时抛出异常
   */
  completeStage(stageId: string, stars: number): void {
    const stage = this.dataProvider.getStage(stageId);
    if (!stage) {
      throw new Error(`[CampaignProgress] 关卡不存在: ${stageId}`);
    }

    // 确保关卡状态存在
    if (!this.progress.stageStates[stageId]) {
      this.progress.stageStates[stageId] = createInitialStageState(stageId);
    }

    const state = this.progress.stageStates[stageId];

    // 更新星级（取历史最高）
    const clampedStars = Math.max(0, Math.min(MAX_STARS, Math.floor(stars))) as StarRating;
    if (clampedStars > state.stars) {
      state.stars = clampedStars;
    }

    // 标记首通
    if (!state.firstCleared) {
      state.firstCleared = true;
    }

    // 增加通关次数
    state.clearCount++;

    // 更新最后通关时间
    this.progress.lastClearTime = Date.now();

    // 更新当前章节
    this.updateCurrentChapter(stage);

    // 解锁下一关卡（在章节内按 order 顺序）
    this.unlockNextStage(stage);
  }

  // ─────────────────────────────────────────────
  // 4. 序列化
  // ─────────────────────────────────────────────

  /**
   * 序列化为存档数据
   *
   * @returns 存档数据
   */
  serialize(): CampaignSaveData {
    return {
      version: SAVE_VERSION,
      progress: {
        currentChapterId: this.progress.currentChapterId,
        stageStates: Object.fromEntries(
          Object.entries(this.progress.stageStates).map(([id, s]) => [id, { ...s }]),
        ),
        lastClearTime: this.progress.lastClearTime,
      },
    };
  }

  /**
   * 从存档数据反序列化
   *
   * @param data - 存档数据
   * @throws {Error} 版本不兼容时抛出异常
   */
  deserialize(data: CampaignSaveData): void {
    if (data.version !== SAVE_VERSION) {
      throw new Error(
        `[CampaignProgress] 存档版本不兼容: 期望 ${SAVE_VERSION}, 实际 ${data.version}`,
      );
    }

    // 确保所有关卡状态都存在（兼容新增关卡）
    const allStages = this.getAllStageIds();
    const stageStates: Record<string, StageState> = {};

    for (const stageId of allStages) {
      if (data.progress.stageStates[stageId]) {
        stageStates[stageId] = { ...data.progress.stageStates[stageId] };
      } else {
        stageStates[stageId] = createInitialStageState(stageId);
      }
    }

    this.progress = {
      currentChapterId: data.progress.currentChapterId,
      stageStates,
      lastClearTime: data.progress.lastClearTime,
    };
  }

  // ─────────────────────────────────────────────
  // 5. 内部方法
  // ─────────────────────────────────────────────

  /**
   * 检查前置关卡是否已通关
   *
   * 规则：
   * - 章节内第一关：前置为上一章的BOSS关（如果存在）
   * - 章节内其他关：前置为同章节内上一关
   * - 第1章第1关：默认解锁
   */
  private isPredecessorCleared(stageId: string): boolean {
    const stage = this.dataProvider.getStage(stageId);
    if (!stage) return false;

    // 第1章第1关默认解锁
    if (stage.chapterId === 'chapter1' && stage.order === 1) return true;

    // 同章节内，前置为上一关
    if (stage.order > 1) {
      const prevOrder = stage.order - 1;
      const stages = this.dataProvider.getStagesByChapter(stage.chapterId);
      const prevStage = stages.find((s) => s.order === prevOrder);
      if (prevStage) {
        const prevState = this.progress.stageStates[prevStage.id];
        return prevState?.firstCleared ?? false;
      }
    }

    // 章节第一关，检查上一章BOSS关是否通关
    if (stage.order === 1) {
      const chapter = this.dataProvider.getChapter(stage.chapterId);
      if (chapter?.prerequisiteChapterId) {
        const prevChapter = this.dataProvider.getChapter(chapter.prerequisiteChapterId);
        if (prevChapter) {
          // 找到上一章的最后一个关卡（BOSS关）
          const lastStage = prevChapter.stages[prevChapter.stages.length - 1];
          const lastState = this.progress.stageStates[lastStage.id];
          return lastState?.firstCleared ?? false;
        }
      }
    }

    return false;
  }

  /**
   * 解锁下一关卡
   *
   * 通关后自动解锁下一关。如果当前关是章节最后一关，
   * 则解锁下一章的第一关。
   */
  private unlockNextStage(stage: Stage): void {
    const stages = this.dataProvider.getStagesByChapter(stage.chapterId);

    // 同章节内下一关
    if (stage.order < stages.length) {
      const nextStage = stages.find((s) => s.order === stage.order + 1);
      if (nextStage && !this.progress.stageStates[nextStage.id]) {
        this.progress.stageStates[nextStage.id] = createInitialStageState(nextStage.id);
      }
    }

    // 章节最后一关通关，解锁下一章
    if (stage.order === stages.length) {
      const chapter = this.dataProvider.getChapter(stage.chapterId);
      if (chapter) {
        // 查找以当前章节为前置的下一章
        const allChapters = this.dataProvider.getChapters();
        const nextChapter = allChapters.find(
          (ch) => ch.prerequisiteChapterId === chapter.id,
        );
        if (nextChapter && nextChapter.stages.length > 0) {
          const firstStage = nextChapter.stages[0];
          if (!this.progress.stageStates[firstStage.id]) {
            this.progress.stageStates[firstStage.id] = createInitialStageState(firstStage.id);
          }
        }
      }
    }
  }

  /**
   * 更新当前章节
   *
   * 通关后检查是否需要更新当前所在章节。
   */
  private updateCurrentChapter(stage: Stage): void {
    // 如果通关的是当前章节的关卡，检查是否应该推进到下一章
    if (stage.chapterId === this.progress.currentChapterId) {
      const stages = this.dataProvider.getStagesByChapter(stage.chapterId);
      const lastStage = stages[stages.length - 1];

      // 通关了章节最后一关，推进到下一章
      if (stage.id === lastStage.id) {
        const allChapters = this.dataProvider.getChapters();
        const nextChapter = allChapters.find(
          (ch) => ch.prerequisiteChapterId === stage.chapterId,
        );
        if (nextChapter) {
          this.progress.currentChapterId = nextChapter.id;
        }
      }
    }
  }

  /**
   * 获取所有关卡ID
   */
  private getAllStageIds(): string[] {
    const ids: string[] = [];
    for (const chapter of this.dataProvider.getChapters()) {
      for (const stage of chapter.stages) {
        ids.push(stage.id);
      }
    }
    return ids;
  }
}
