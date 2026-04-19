/**
 * MiniGameSystem — 放置游戏小游戏系统核心模块
 *
 * 提供转盘、抽奖、答题、拼图等小游戏管理，
 * 每日免费次数控制、小游戏奖励发放等功能。
 *
 * @module engines/idle/modules/MiniGameSystem
 */

// ============================================================
// 类型定义
// ============================================================

/** 小游戏类型 */
export type MiniGameType = 'wheel' | 'draw' | 'quiz' | 'puzzle' | 'slots';

/** 小游戏定义 */
export interface MiniGameDef {
  id: string;
  name: string;
  type: MiniGameType;
  description: string;
  icon: string;
  dailyFreePlays: number;
  costPerPlay: number;
  costResource: string;
}

/** 转盘奖品 */
export interface WheelPrize {
  id: string;
  name: string;
  weight: number;
  rewardType: string;
  rewardId: string;
  rewardAmount: number;
  icon: string;
}

/** 抽奖奖品 */
export interface DrawPrize {
  id: string;
  name: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  weight: number;
  rewardType: string;
  rewardId: string;
  rewardAmount: number;
  icon: string;
}

/** 答题题目 */
export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  rewardAmount: number;
}

/** 小游戏运行时状态 */
export interface MiniGameState {
  defId: string;
  playsToday: number;
  totalPlays: number;
  lastPlayDate: string;
}

/** 小游戏结果 */
export interface MiniGameResult {
  success: boolean;
  rewards: { type: string; id: string; amount: number; name: string }[];
  message: string;
}

/** 小游戏系统事件 */
export type MiniGameEvent =
  | { type: 'game_played'; gameId: string; result: MiniGameResult }
  | { type: 'daily_plays_reset'; count: number };

/** 事件监听器类型 */
export type MiniGameEventListener = (event: MiniGameEvent) => void;

// ============================================================
// 辅助函数
// ============================================================

/** 加权随机选择 */
function weightedRandom<T extends { weight: number }>(items: T[]): T {
  const totalWeight = items.reduce((sum, i) => sum + i.weight, 0);
  let random = Math.random() * totalWeight;
  for (const item of items) {
    random -= item.weight;
    if (random <= 0) return item;
  }
  return items[items.length - 1];
}

// ============================================================
// MiniGameSystem 实现
// ////////////////////////////////////////////////////////////

/**
 * 小游戏系统 — 管理转盘、抽奖、答题等小游戏
 *
 * @example
 * ```typescript
 * const miniGame = new MiniGameSystem();
 * miniGame.register([{
 *   id: 'lucky_wheel',
 *   name: '幸运转盘',
 *   type: 'wheel',
 *   dailyFreePlays: 3,
 *   costPerPlay: 10,
 *   costResource: 'gem',
 * }]);
 * miniGame.setWheelPrizes('lucky_wheel', [...]);
 * const result = miniGame.spinWheel('lucky_wheel');
 * ```
 */
export class MiniGameSystem {

  // ========== 内部数据 ==========

  /** 小游戏定义 */
  private readonly defs: Map<string, MiniGameDef> = new Map();

  /** 小游戏状态 */
  private readonly states: Map<string, MiniGameState> = new Map();

  /** 转盘奖品配置 */
  private readonly wheelPrizes: Map<string, WheelPrize[]> = new Map();

  /** 抽奖奖品配置 */
  private readonly drawPrizes: Map<string, DrawPrize[]> = new Map();

  /** 答题题库 */
  private readonly quizQuestions: Map<string, QuizQuestion[]> = new Map();

  /** 事件监听器 */
  private readonly listeners: MiniGameEventListener[] = [];

  // ============================================================
  // 初始化
  // ============================================================

  /**
   * 注册小游戏
   */
  register(games: MiniGameDef[]): void {
    for (const def of games) {
      this.defs.set(def.id, def);
      if (!this.states.has(def.id)) {
        this.states.set(def.id, {
          defId: def.id,
          playsToday: 0,
          totalPlays: 0,
          lastPlayDate: '',
        });
      }
    }
  }

  /**
   * 设置转盘奖品
   */
  setWheelPrizes(gameId: string, prizes: WheelPrize[]): void {
    this.wheelPrizes.set(gameId, prizes);
  }

  /**
   * 设置抽奖奖品
   */
  setDrawPrizes(gameId: string, prizes: DrawPrize[]): void {
    this.drawPrizes.set(gameId, prizes);
  }

  /**
   * 设置答题题库
   */
  setQuizQuestions(gameId: string, questions: QuizQuestion[]): void {
    this.quizQuestions.set(gameId, questions);
  }

  loadState(data: Record<string, Partial<MiniGameState>>): void {
    for (const [id, saved] of Object.entries(data)) {
      const existing = this.states.get(id);
      if (existing) Object.assign(existing, saved);
    }
  }

  saveState(): Record<string, MiniGameState> {
    const result: Record<string, MiniGameState> = {};
    for (const [id, state] of this.states) {
      result[id] = { ...state };
    }
    return result;
  }

  // ============================================================
  // 查询
  // ============================================================

  /** 获取所有小游戏定义 */
  get miniGames(): MiniGameDef[] {
    return Array.from(this.defs.values());
  }

  /** 获取今日各游戏剩余免费次数 */
  get dailyPlays(): { gameId: string; remaining: number; total: number }[] {
    const today = new Date().toISOString().slice(0, 10);
    return Array.from(this.defs.values()).map((def) => {
      const state = this.states.get(def.id);
      const playsToday = state?.lastPlayDate === today ? (state.playsToday ?? 0) : 0;
      return { gameId: def.id, remaining: Math.max(0, def.dailyFreePlays - playsToday), total: def.dailyFreePlays };
    });
  }

  /**
   * 获取剩余免费次数
   */
  getRemainingPlays(gameId: string): number {
    const def = this.defs.get(gameId);
    const state = this.states.get(gameId);
    if (!def || !state) return 0;

    const today = new Date().toISOString().slice(0, 10);
    if (state.lastPlayDate !== today) return def.dailyFreePlays;
    return Math.max(0, def.dailyFreePlays - state.playsToday);
  }

  /**
   * 获取游戏定义
   */
  getDef(id: string): MiniGameDef | undefined {
    return this.defs.get(id);
  }

  // ============================================================
  // 操作
  // ============================================================

  /**
   * 玩小游戏（通用入口）
   */
  playGame(id: string, hasResource?: (id: string, amount: number) => boolean, spendResource?: (id: string, amount: number) => void): MiniGameResult {
    const def = this.defs.get(id);
    if (!def) return { success: false, rewards: [], message: '游戏不存在' };

    const state = this.states.get(id)!;
    const today = new Date().toISOString().slice(0, 10);

    // 检查日期重置
    if (state.lastPlayDate !== today) {
      state.playsToday = 0;
      state.lastPlayDate = today;
    }

    // 检查免费次数
    const isFree = state.playsToday < def.dailyFreePlays;
    if (!isFree) {
      // 需要付费
      if (!hasResource || !hasResource(def.costResource, def.costPerPlay)) {
        return { success: false, rewards: [], message: '资源不足' };
      }
      spendResource?.(def.costResource, def.costPerPlay);
    }

    // 根据类型执行
    let result: MiniGameResult;
    switch (def.type) {
      case 'wheel':
        result = this.executeWheel(id);
        break;
      case 'draw':
        result = this.executeDraw(id);
        break;
      default:
        result = { success: true, rewards: [], message: '游戏已开始' };
    }

    state.playsToday++;
    state.totalPlays++;
    this.emitEvent({ type: 'game_played', gameId: id, result });
    return result;
  }

  /**
   * 转盘抽奖
   */
  spinWheel(gameId: string): MiniGameResult {
    return this.executeWheel(gameId);
  }

  /**
   * 幸运抽奖
   */
  luckyDraw(gameId: string): MiniGameResult {
    return this.executeDraw(gameId);
  }

  /**
   * 答题
   */
  quiz(gameId: string, questionId: string, answerIndex: number): MiniGameResult {
    const questions = this.quizQuestions.get(gameId);
    if (!questions) return { success: false, rewards: [], message: '题库为空' };

    const question = questions.find((q) => q.id === questionId);
    if (!question) return { success: false, rewards: [], message: '题目不存在' };

    if (answerIndex === question.correctIndex) {
      return {
        success: true,
        rewards: [{ type: 'resource', id: 'exp', amount: question.rewardAmount, name: '经验' }],
        message: '回答正确！',
      };
    }
    return { success: false, rewards: [], message: '回答错误' };
  }

  /**
   * 重置每日免费次数
   */
  resetDailyPlays(): number {
    const today = new Date().toISOString().slice(0, 10);
    let count = 0;
    for (const [id, state] of this.states) {
      if (state.lastPlayDate !== today) {
        state.playsToday = 0;
        state.lastPlayDate = today;
        count++;
      }
    }
    if (count > 0) this.emitEvent({ type: 'daily_plays_reset', count });
    return count;
  }

  // ============================================================
  // 事件
  // ============================================================

  onEvent(listener: MiniGameEventListener): void {
    this.listeners.push(listener);
  }

  offEvent(listener: MiniGameEventListener): void {
    const idx = this.listeners.indexOf(listener);
    if (idx !== -1) this.listeners.splice(idx, 1);
  }

  // ============================================================
  // 重置
  // ============================================================

  reset(): void {
    for (const state of this.states.values()) {
      state.playsToday = 0;
      state.totalPlays = 0;
      state.lastPlayDate = '';
    }
  }

  // ============================================================
  // 内部工具
  // ============================================================

  private executeWheel(gameId: string): MiniGameResult {
    const prizes = this.wheelPrizes.get(gameId);
    if (!prizes || prizes.length === 0) {
      return { success: true, rewards: [], message: '转盘无奖品' };
    }

    const prize = weightedRandom(prizes);
    return {
      success: true,
      rewards: [{ type: prize.rewardType, id: prize.rewardId, amount: prize.rewardAmount, name: prize.name }],
      message: `恭喜获得 ${prize.name}！`,
    };
  }

  private executeDraw(gameId: string): MiniGameResult {
    const prizes = this.drawPrizes.get(gameId);
    if (!prizes || prizes.length === 0) {
      return { success: true, rewards: [], message: '奖池为空' };
    }

    const prize = weightedRandom(prizes);
    return {
      success: true,
      rewards: [{ type: prize.rewardType, id: prize.rewardId, amount: prize.rewardAmount, name: prize.name }],
      message: `抽到了 ${prize.name}（${prize.rarity}）！`,
    };
  }

  private emitEvent(event: MiniGameEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (_error) {
        // 忽略
      }
    }
  }
}
