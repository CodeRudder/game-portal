import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  ReactionPhase,
  WAIT_MIN_MS, WAIT_MAX_MS,
  DEFAULT_ROUNDS, MAX_ROUNDS, MIN_ROUNDS,
  RATING_LABELS, RATING_LEGENDARY, RATING_EXCELLENT, RATING_GOOD,
  RATING_AVERAGE, RATING_SLOW,
  COLOR_BG_WAITING, COLOR_BG_READY, COLOR_BG_TOO_EARLY, COLOR_BG_RESULT,
  COLOR_TEXT_PRIMARY, COLOR_TEXT_SECONDARY, COLOR_TEXT_ACCENT,
  COLOR_TEXT_HIGHLIGHT, COLOR_TEXT_DANGER, COLOR_TEXT_SUCCESS,
  COLOR_PROGRESS_BG, COLOR_PROGRESS_FILL,
  COLOR_BAR_BG, COLOR_BAR_FILL,
  HUD_HEIGHT, CONTENT_CENTER_Y,
  PROGRESS_BAR_HEIGHT, PROGRESS_BAR_MARGIN,
  FONT_FAMILY, FONT_SIZE_TITLE, FONT_SIZE_SUBTITLE,
  FONT_SIZE_TIME, FONT_SIZE_HINT, FONT_SIZE_ROUND,
  STORAGE_KEY_BEST, STORAGE_KEY_HISTORY,
  PULSE_ANIMATION_SPEED,
} from './constants';

// ========== 单轮结果 ==========
export interface RoundResult {
  /** 反应时间（毫秒），-1 表示过早按键 */
  reactionTime: number;
  /** 是否过早按键 */
  isTooEarly: boolean;
}

// ========== 游戏状态（对外暴露） ==========
export interface ReactionTestState {
  phase: ReactionPhase;
  currentRound: number;
  totalRounds: number;
  roundResults: RoundResult[];
  lastReactionTime: number | null;
  averageTime: number | null;
  bestTime: number | null;
  allTimeBest: number | null;
  isWin: boolean;
}

export class ReactionTestEngine extends GameEngine {
  // ========== 游戏阶段 ==========
  private _phase: ReactionPhase = ReactionPhase.WAITING;

  // ========== 多轮测试 ==========
  private _currentRound: number = 0;
  private _totalRounds: number = DEFAULT_ROUNDS;
  private _roundResults: RoundResult[] = [];

  // ========== 计时 ==========
  private _waitStartTime: number = 0;
  private _readyStartTime: number = 0;
  private _randomDelay: number = 0;
  private _lastReactionTime: number | null = null;

  // ========== 最佳成绩 ==========
  private _bestTime: number | null = null;
  private _allTimeBest: number | null = null;

  // ========== 动画 ==========
  private _animTime: number = 0;
  private _pulsePhase: number = 0;

  // ========== 是否已完成所有轮次 ==========
  private _isComplete: boolean = false;

  // ========== 公开属性 ==========

  get phase(): ReactionPhase { return this._phase; }
  get currentRound(): number { return this._currentRound; }
  get totalRounds(): number { return this._totalRounds; }
  get roundResults(): ReadonlyArray<RoundResult> { return this._roundResults; }
  get lastReactionTime(): number | null { return this._lastReactionTime; }
  get bestTime(): number | null { return this._bestTime; }
  get allTimeBest(): number | null { return this._allTimeBest; }
  get isWin(): boolean { return this._isComplete; }

  /** 有效轮次的平均反应时间 */
  get averageTime(): number | null {
    const valid = this._roundResults.filter(r => !r.isTooEarly);
    if (valid.length === 0) return null;
    return Math.round(valid.reduce((sum, r) => sum + r.reactionTime, 0) / valid.length);
  }

  /** 有效轮次数 */
  get validRoundsCount(): number {
    return this._roundResults.filter(r => !r.isTooEarly).length;
  }

  /** 过早按键轮次数 */
  get tooEarlyCount(): number {
    return this._roundResults.filter(r => r.isTooEarly).length;
  }

  // ========== 生命周期实现 ==========

  protected onInit(): void {
    this._loadAllTimeBest();
    this._phase = ReactionPhase.WAITING;
  }

  protected onStart(): void {
    this._currentRound = 0;
    this._roundResults = [];
    this._bestTime = null;
    this._lastReactionTime = null;
    this._isComplete = false;
    this._startWaiting();
  }

  protected update(deltaTime: number): void {
    this._animTime += deltaTime;
    this._pulsePhase += deltaTime * 0.001 * PULSE_ANIMATION_SPEED;

    if (this._phase === ReactionPhase.WAITING) {
      const elapsed = performance.now() - this._waitStartTime;
      if (elapsed >= this._randomDelay) {
        this._transitionToReady();
      }
    }
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 根据阶段渲染不同背景
    switch (this._phase) {
      case ReactionPhase.WAITING:
        this._renderWaiting(ctx, w, h);
        break;
      case ReactionPhase.READY:
        this._renderReady(ctx, w, h);
        break;
      case ReactionPhase.REACTING:
        this._renderResult(ctx, w, h);
        break;
      case ReactionPhase.RESULT:
        this._renderResult(ctx, w, h);
        break;
      case ReactionPhase.TOO_EARLY:
        this._renderTooEarly(ctx, w, h);
        break;
    }
  }

  protected onReset(): void {
    this._phase = ReactionPhase.WAITING;
    this._currentRound = 0;
    this._roundResults = [];
    this._lastReactionTime = null;
    this._bestTime = null;
    this._isComplete = false;
    this._animTime = 0;
    this._pulsePhase = 0;
  }

  protected onDestroy(): void {
    this._roundResults = [];
  }

  // ========== 输入处理 ==========

  handleKeyDown(key: string): void {
    if (this._status !== 'playing') return;

    // 空格、Enter 或任意字母/数字键触发反应
    const isActionKey = key === ' ' || key === 'Enter' || /^[a-zA-Z0-9]$/.test(key);

    if (isActionKey) {
      this._handleAction();
    }
  }

  handleKeyUp(_key: string): void {
    // 反应力测试不需要 keyup
  }

  /** 处理点击事件（供 GameContainer 调用） */
  handleClick(): void {
    if (this._status !== 'playing') return;
    this._handleAction();
  }

  /** 设置轮次数 */
  setRounds(rounds: number): void {
    this._totalRounds = Math.max(MIN_ROUNDS, Math.min(MAX_ROUNDS, rounds));
  }

  // ========== 核心逻辑 ==========

  private _handleAction(): void {
    switch (this._phase) {
      case ReactionPhase.WAITING:
        this._handleTooEarly();
        break;
      case ReactionPhase.READY:
        this._handleReaction();
        break;
      case ReactionPhase.REACTING:
      case ReactionPhase.RESULT:
      case ReactionPhase.TOO_EARLY:
        // 这些状态下按键无效（结果阶段由 _advanceRound 控制）
        break;
    }
  }

  /** 开始等待阶段 */
  private _startWaiting(): void {
    this._phase = ReactionPhase.WAITING;
    this._randomDelay = WAIT_MIN_MS + Math.random() * (WAIT_MAX_MS - WAIT_MIN_MS);
    this._waitStartTime = performance.now();
    this._emitStateChange();
  }

  /** 从 waiting 转换到 ready */
  private _transitionToReady(): void {
    this._phase = ReactionPhase.READY;
    this._readyStartTime = performance.now();
    this._emitStateChange();
  }

  /** 处理过早按键 */
  private _handleTooEarly(): void {
    this._phase = ReactionPhase.TOO_EARLY;
    this._roundResults.push({
      reactionTime: -1,
      isTooEarly: true,
    });
    this._currentRound++;
    this._emitStateChange();

    // 1.5秒后自动进入下一轮或结束
    setTimeout(() => {
      if (this._status !== 'playing') return;
      this._advanceRound();
    }, 1500);
  }

  /** 处理正常反应 */
  private _handleReaction(): void {
    const reactionTime = Math.round(performance.now() - this._readyStartTime);
    this._lastReactionTime = reactionTime;
    this._phase = ReactionPhase.REACTING;

    // 更新最佳成绩
    if (this._bestTime === null || reactionTime < this._bestTime) {
      this._bestTime = reactionTime;
    }

    // 更新历史最佳
    if (this._allTimeBest === null || reactionTime < this._allTimeBest) {
      this._allTimeBest = reactionTime;
      this._saveAllTimeBest(reactionTime);
    }

    // 记录结果
    this._roundResults.push({
      reactionTime,
      isTooEarly: false,
    });
    this._currentRound++;

    // 更新分数（反应时间越短分数越高）
    this.addScore(Math.max(0, 1000 - reactionTime));

    this._emitStateChange();

    // 1.5秒后自动进入下一轮或结束
    setTimeout(() => {
      if (this._status !== 'playing') return;
      this._advanceRound();
    }, 1500);
  }

  /** 推进到下一轮 */
  private _advanceRound(): void {
    if (this._currentRound >= this._totalRounds) {
      this._completeGame();
    } else {
      this._startWaiting();
    }
  }

  /** 完成所有轮次 */
  private _completeGame(): void {
    this._isComplete = true;
    this._phase = ReactionPhase.RESULT;
    this._emitStateChange();

    // 保存历史记录
    this._saveHistory();

    // 触发游戏结束
    this.gameOver();
  }

  /** 手动重试（在结果或过早按键状态按空格） */
  retry(): void {
    if (this._phase === ReactionPhase.TOO_EARLY) {
      // 过早按键后重试当前轮
      this._roundResults.pop();
      this._currentRound--;
      this._startWaiting();
    }
  }

  // ========== 存储 ==========

  private _loadAllTimeBest(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_BEST);
      if (stored) {
        this._allTimeBest = parseInt(stored, 10);
        if (isNaN(this._allTimeBest)) this._allTimeBest = null;
      }
    } catch {
      this._allTimeBest = null;
    }
  }

  private _saveAllTimeBest(time: number): void {
    try {
      localStorage.setItem(STORAGE_KEY_BEST, time.toString());
    } catch {
      // ignore storage errors
    }
  }

  private _saveHistory(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_HISTORY);
      const history: number[] = stored ? JSON.parse(stored) : [];
      const avg = this.averageTime;
      if (avg !== null) {
        history.push(avg);
        // 只保留最近 50 次平均
        if (history.length > 50) history.splice(0, history.length - 50);
        localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));
      }
    } catch {
      // ignore storage errors
    }
  }

  /** 获取历史平均记录 */
  getHistory(): number[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_HISTORY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  // ========== 渲染方法 ==========

  private _renderWaiting(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 深色背景
    ctx.fillStyle = COLOR_BG_WAITING;
    ctx.fillRect(0, 0, w, h);

    const cy = h / 2;

    // 脉冲圆
    const pulse = Math.sin(this._pulsePhase) * 0.3 + 0.7;
    ctx.beginPath();
    ctx.arc(w / 2, cy - 40, 60 * pulse, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.05 * pulse})`;
    ctx.fill();

    // 主文字
    ctx.fillStyle = COLOR_TEXT_PRIMARY;
    ctx.font = `bold ${FONT_SIZE_TITLE}px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('等待...', w / 2, cy - 40);

    // 提示
    ctx.fillStyle = COLOR_TEXT_SECONDARY;
    ctx.font = `${FONT_SIZE_HINT}px ${FONT_FAMILY}`;
    ctx.fillText('屏幕变绿时尽快按键或点击', w / 2, cy + 20);
    ctx.fillText('不要提前按！', w / 2, cy + 50);

    // 轮次信息
    this._renderRoundInfo(ctx, w, h);
  }

  private _renderReady(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 绿色背景
    ctx.fillStyle = COLOR_BG_READY;
    ctx.fillRect(0, 0, w, h);

    const cy = h / 2;

    // 主文字
    ctx.fillStyle = COLOR_TEXT_PRIMARY;
    ctx.font = `bold ${FONT_SIZE_TITLE}px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('点击！', w / 2, cy - 40);

    // 提示
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = `${FONT_SIZE_HINT}px ${FONT_FAMILY}`;
    ctx.fillText('尽快按下任意键或点击屏幕', w / 2, cy + 20);

    // 轮次信息
    this._renderRoundInfo(ctx, w, h);
  }

  private _renderTooEarly(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 红色背景
    ctx.fillStyle = COLOR_BG_TOO_EARLY;
    ctx.fillRect(0, 0, w, h);

    const cy = h / 2;

    // 主文字
    ctx.fillStyle = COLOR_TEXT_PRIMARY;
    ctx.font = `bold ${FONT_SIZE_TITLE}px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('太早了！', w / 2, cy - 40);

    // 提示
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = `${FONT_SIZE_HINT}px ${FONT_FAMILY}`;
    ctx.fillText('请等屏幕变绿后再按键', w / 2, cy + 20);

    // 轮次信息
    this._renderRoundInfo(ctx, w, h);
  }

  private _renderResult(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 深色背景
    ctx.fillStyle = COLOR_BG_RESULT;
    ctx.fillRect(0, 0, w, h);

    const cy = h / 2;

    if (this._phase === ReactionPhase.REACTING && this._lastReactionTime !== null) {
      // 单轮结果
      const time = this._lastReactionTime;
      const rating = this._getRating(time);

      // 反应时间
      ctx.fillStyle = rating.color;
      ctx.font = `bold ${FONT_SIZE_TIME}px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${time}ms`, w / 2, cy - 60);

      // 评级
      ctx.fillStyle = rating.color;
      ctx.font = `bold ${FONT_SIZE_SUBTITLE}px ${FONT_FAMILY}`;
      ctx.fillText(rating.label, w / 2, cy);

      // 进度
      ctx.fillStyle = COLOR_TEXT_SECONDARY;
      ctx.font = `${FONT_SIZE_HINT}px ${FONT_FAMILY}`;
      ctx.fillText(`第 ${this._currentRound} / ${this._totalRounds} 轮`, w / 2, cy + 50);

    } else if (this._phase === ReactionPhase.RESULT) {
      // 最终结果
      const avg = this.averageTime;
      const best = this._bestTime;

      // 标题
      ctx.fillStyle = COLOR_TEXT_ACCENT;
      ctx.font = `bold ${FONT_SIZE_TITLE}px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('测试完成！', w / 2, 100);

      if (avg !== null) {
        const rating = this._getRating(avg);

        // 平均时间
        ctx.fillStyle = rating.color;
        ctx.font = `bold ${FONT_SIZE_TIME}px ${FONT_FAMILY}`;
        ctx.fillText(`${avg}ms`, w / 2, cy - 60);

        // 评级
        ctx.fillStyle = rating.color;
        ctx.font = `bold ${FONT_SIZE_SUBTITLE}px ${FONT_FAMILY}`;
        ctx.fillText(rating.label, w / 2, cy - 10);
      }

      // 最佳时间
      if (best !== null) {
        ctx.fillStyle = COLOR_TEXT_HIGHLIGHT;
        ctx.font = `${FONT_SIZE_SUBTITLE}px ${FONT_FAMILY}`;
        ctx.fillText(`最佳: ${best}ms`, w / 2, cy + 40);
      }

      // 历史最佳
      if (this._allTimeBest !== null) {
        ctx.fillStyle = COLOR_TEXT_SECONDARY;
        ctx.font = `${FONT_SIZE_HINT}px ${FONT_FAMILY}`;
        ctx.fillText(`历史最佳: ${this._allTimeBest}ms`, w / 2, cy + 75);
      }

      // 统计
      ctx.fillStyle = COLOR_TEXT_SECONDARY;
      ctx.font = `${FONT_SIZE_HINT}px ${FONT_FAMILY}`;
      const validCount = this.validRoundsCount;
      const tooEarly = this.tooEarlyCount;
      ctx.fillText(`有效: ${validCount} 轮 | 过早: ${tooEarly} 次`, w / 2, cy + 110);

      // 各轮结果柱状图
      this._renderRoundBars(ctx, w, h);

      // 重试提示
      ctx.fillStyle = COLOR_TEXT_ACCENT;
      ctx.font = `${FONT_SIZE_HINT}px ${FONT_FAMILY}`;
      ctx.fillText('按空格键或点击重试', w / 2, h - 40);
    }

    // 轮次信息（非最终结果时）
    if (this._phase !== ReactionPhase.RESULT) {
      this._renderRoundInfo(ctx, w, h);
    }
  }

  /** 渲染轮次指示器 */
  private _renderRoundInfo(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const y = h - 80;
    const totalWidth = this._totalRounds * 20 + (this._totalRounds - 1) * 8;
    const startX = (w - totalWidth) / 2;

    for (let i = 0; i < this._totalRounds; i++) {
      const x = startX + i * 28;
      const result = this._roundResults[i];

      if (result) {
        if (result.isTooEarly) {
          ctx.fillStyle = COLOR_TEXT_DANGER;
        } else {
          const rating = this._getRating(result.reactionTime);
          ctx.fillStyle = rating.color;
        }
      } else if (i === this._currentRound) {
        ctx.fillStyle = COLOR_TEXT_ACCENT;
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
      }

      ctx.beginPath();
      ctx.arc(x + 10, y, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    // 轮次文字
    ctx.fillStyle = COLOR_TEXT_SECONDARY;
    ctx.font = `${FONT_SIZE_ROUND}px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.fillText(`${this._currentRound} / ${this._totalRounds}`, w / 2, y + 30);
  }

  /** 渲染各轮柱状图 */
  private _renderRoundBars(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const barAreaTop = h / 2 + 140;
    const barAreaHeight = 80;
    const barWidth = Math.min(30, (w - 80) / this._totalRounds - 4);
    const totalWidth = this._totalRounds * (barWidth + 4);
    const startX = (w - totalWidth) / 2;

    // 找到最大时间用于缩放
    const validResults = this._roundResults.filter(r => !r.isTooEarly);
    const maxTime = validResults.length > 0
      ? Math.max(...validResults.map(r => r.reactionTime), 500)
      : 500;

    for (let i = 0; i < this._roundResults.length; i++) {
      const result = this._roundResults[i];
      const x = startX + i * (barWidth + 4);

      if (result.isTooEarly) {
        // 过早按键 - 红色短柱
        ctx.fillStyle = COLOR_TEXT_DANGER;
        ctx.fillRect(x, barAreaTop + barAreaHeight - 10, barWidth, 10);
      } else {
        const barHeight = Math.max(5, (result.reactionTime / maxTime) * barAreaHeight);
        const rating = this._getRating(result.reactionTime);
        ctx.fillStyle = rating.color;
        ctx.fillRect(x, barAreaTop + barAreaHeight - barHeight, barWidth, barHeight);
      }

      // 时间标签
      if (!result.isTooEarly) {
        ctx.fillStyle = COLOR_TEXT_SECONDARY;
        ctx.font = `10px ${FONT_FAMILY}`;
        ctx.textAlign = 'center';
        ctx.fillText(`${result.reactionTime}`, x + barWidth / 2, barAreaTop + barAreaHeight + 14);
      }
    }
  }

  // ========== 辅助方法 ==========

  /** 获取评级 */
  private _getRating(time: number): { label: string; color: string } {
    for (const r of RATING_LABELS) {
      if (time <= r.max) return { label: r.label, color: r.color };
    }
    return { label: '💪 需要练习', color: '#ff7675' };
  }

  /** 触发状态变更事件 */
  private _emitStateChange(): void {
    this.emit('stateChange', this.getState());
  }

  /** 获取游戏状态 */
  getState(): Record<string, unknown> {
    return {
      phase: this._phase,
      currentRound: this._currentRound,
      totalRounds: this._totalRounds,
      roundResults: [...this._roundResults],
      lastReactionTime: this._lastReactionTime,
      averageTime: this.averageTime,
      bestTime: this._bestTime,
      allTimeBest: this._allTimeBest,
      isWin: this._isComplete,
    };
  }

  // ========== 静态工具方法（方便测试和外部使用） ==========

  /** 获取评级（静态方法） */
  static getRating(time: number): { label: string; color: string } {
    for (const r of RATING_LABELS) {
      if (time <= r.max) return { label: r.label, color: r.color };
    }
    return { label: '💪 需要练习', color: '#ff7675' };
  }

  /** 计算平均反应时间 */
  static calculateAverage(results: RoundResult[]): number | null {
    const valid = results.filter(r => !r.isTooEarly);
    if (valid.length === 0) return null;
    return Math.round(valid.reduce((sum, r) => sum + r.reactionTime, 0) / valid.length);
  }

  /** 生成随机延迟 */
  static generateRandomDelay(): number {
    return WAIT_MIN_MS + Math.random() * (WAIT_MAX_MS - WAIT_MIN_MS);
  }
}
