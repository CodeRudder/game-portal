import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  LANE_COUNT,
  LANE_WIDTH,
  LANE_KEYS,
  LANE_COLORS,
  NOTE_HEIGHT,
  NOTE_WIDTH,
  JUDGE_LINE_Y,
  NOTE_FALL_SPEED,
  JUDGE_PERFECT_MS,
  JUDGE_GREAT_MS,
  JUDGE_GOOD_MS,
  SCORE_PERFECT,
  SCORE_GREAT,
  SCORE_GOOD,
  SCORE_MISS,
  JUDGE_COLORS,
  JUDGE_TEXT,
  COMBO_MULTIPLIERS,
  INITIAL_HEALTH,
  MISS_HEALTH_PENALTY,
  GOOD_HEALTH_RECOVER,
  GREAT_HEALTH_RECOVER,
  PERFECT_HEALTH_RECOVER,
  MAX_HEALTH,
  JUDGE_FEEDBACK_DURATION,
  BEATMAPS,
  NOTE_TRAVEL_TIME,
  type Beatmap,
  type ActiveNote,
  type JudgeFeedback,
  type JudgeResult,
  type RhythmGameState,
} from './constants';

export class RhythmEngine extends GameEngine {
  // ========== 游戏状态 ==========
  private _combo: number = 0;
  private _maxCombo: number = 0;
  private _health: number = INITIAL_HEALTH;
  private _judgeCounts: Record<JudgeResult, number> = {
    perfect: 0,
    great: 0,
    good: 0,
    miss: 0,
  };
  private _activeNotes: ActiveNote[] = [];
  private _feedbacks: JudgeFeedback[] = [];
  private _beatmap: Beatmap;
  private _beatmapIndex: number = 0;
  private _nextNoteId: number = 0;
  private _gameTime: number = 0;
  private _isFinished: boolean = false;
  private _isWin: boolean = false;
  private _keysPressed: Set<string> = new Set();
  private _laneFlash: number[] = [0, 0, 0, 0]; // 轨道按下闪光计时

  // ========== 公开属性 ==========
  get combo(): number { return this._combo; }
  get maxCombo(): number { return this._maxCombo; }
  get health(): number { return this._health; }
  get judgeCounts(): Record<JudgeResult, number> { return { ...this._judgeCounts }; }
  get isFinished(): boolean { return this._isFinished; }
  get isWin(): boolean { return this._isWin; }
  get activeNotes(): ActiveNote[] { return this._activeNotes; }
  get feedbacks(): JudgeFeedback[] { return this._feedbacks; }
  get beatmap(): Beatmap { return this._beatmap; }
  get gameTime(): number { return this._gameTime; }

  constructor(beatmap?: Beatmap) {
    super();
    this._beatmap = beatmap ?? BEATMAPS[0];
  }

  // ========== 生命周期 ==========

  protected onInit(): void {
    // 初始化状态
    this.resetState();
  }

  protected onStart(): void {
    this.resetState();
    this._gameTime = 0;
    this._beatmapIndex = 0;
    this._nextNoteId = 0;
  }

  protected onReset(): void {
    this.resetState();
  }

  protected onGameOver(): void {
    // 游戏结束处理
  }

  protected update(deltaTime: number): void {
    if (this._status !== 'playing' || this._isFinished) return;

    // 累加游戏时间
    this._gameTime += deltaTime;

    // 生成新音符
    this.spawnNotes();

    // 更新音符位置
    this.updateNotes(deltaTime);

    // 检测 Miss（音符超过判定线太远）
    this.checkMisses();

    // 更新判定反馈
    this.updateFeedbacks();

    // 更新轨道闪光
    this.updateLaneFlash(deltaTime);

    // 检查游戏结束
    if (this._health <= 0) {
      this._health = 0;
      this._isFinished = true;
      this._isWin = false;
      this.gameOver();
      return;
    }

    // 检查是否所有音符都已处理完毕
    this.checkFinish();
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, w, h);

    // 轨道分隔线
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    for (let i = 1; i < LANE_COUNT; i++) {
      const x = i * LANE_WIDTH;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    // 轨道闪光效果
    for (let i = 0; i < LANE_COUNT; i++) {
      if (this._laneFlash[i] > 0) {
        const alpha = this._laneFlash[i] / 200;
        ctx.fillStyle = `rgba(${this.hexToRgb(LANE_COLORS[i])}, ${alpha})`;
        ctx.fillRect(i * LANE_WIDTH, 0, LANE_WIDTH, h);
      }
    }

    // 判定线
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, JUDGE_LINE_Y);
    ctx.lineTo(w, JUDGE_LINE_Y);
    ctx.stroke();

    // 判定线发光
    const gradient = ctx.createLinearGradient(0, JUDGE_LINE_Y - 10, 0, JUDGE_LINE_Y + 10);
    gradient.addColorStop(0, 'rgba(255,255,255,0)');
    gradient.addColorStop(0.5, 'rgba(255,255,255,0.15)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, JUDGE_LINE_Y - 10, w, 20);

    // 音符
    for (const note of this._activeNotes) {
      if (note.judged) continue;
      const x = note.lane * LANE_WIDTH + (LANE_WIDTH - NOTE_WIDTH) / 2;
      ctx.fillStyle = LANE_COLORS[note.lane];
      ctx.shadowColor = LANE_COLORS[note.lane];
      ctx.shadowBlur = 8;
      this.roundRect(ctx, x, note.y, NOTE_WIDTH, NOTE_HEIGHT, 4);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // 判定反馈文本
    for (const fb of this._feedbacks) {
      const elapsed = this._gameTime - fb.timestamp;
      const alpha = Math.max(0, 1 - elapsed / JUDGE_FEEDBACK_DURATION);
      const offsetY = elapsed * 0.05;
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = JUDGE_COLORS[fb.result].replace(')', `, ${alpha})`).replace('rgb', 'rgba');
      // Handle hex colors
      const color = JUDGE_COLORS[fb.result];
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.fillText(
        JUDGE_TEXT[fb.result],
        fb.lane * LANE_WIDTH + LANE_WIDTH / 2,
        JUDGE_LINE_Y - 30 - offsetY
      );
      ctx.globalAlpha = 1;
    }

    // HUD - 分数
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${this._score}`, w - 20, 35);

    // HUD - 连击
    if (this._combo > 1) {
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFD700';
      ctx.fillText(`${this._combo} COMBO`, w / 2, 35);
    }

    // HUD - 健康值
    this.renderHealthBar(ctx, w);

    // HUD - 按键提示
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    for (let i = 0; i < LANE_COUNT; i++) {
      const x = i * LANE_WIDTH + LANE_WIDTH / 2;
      ctx.fillStyle = this._keysPressed.has(LANE_KEYS[i]) ? '#ffffff' : 'rgba(255,255,255,0.3)';
      ctx.fillText(LANE_KEYS[i].toUpperCase(), x, h - 20);
    }

    // 游戏结束覆盖
    if (this._isFinished) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, w, h);
      ctx.font = 'bold 32px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = this._isWin ? '#00FF88' : '#FF4757';
      ctx.fillText(this._isWin ? 'CLEAR!' : 'GAME OVER', w / 2, h / 2 - 40);
      ctx.font = '18px monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`Score: ${this._score}`, w / 2, h / 2);
      ctx.fillText(`Max Combo: ${this._maxCombo}`, w / 2, h / 2 + 30);
      ctx.font = '14px monospace';
      ctx.fillStyle = '#aaaaaa';
      ctx.fillText('Press SPACE to restart', w / 2, h / 2 + 70);
    }
  }

  // ========== 输入处理 ==========

  handleKeyDown(key: string): void {
    const lowerKey = key.toLowerCase();

    // 空格开始
    if (lowerKey === ' ') {
      if (this._status === 'idle' || this._isFinished) {
        this.start();
      }
      return;
    }

    if (this._status !== 'playing' || this._isFinished) return;

    // 轨道按键
    const laneIndex = LANE_KEYS.indexOf(lowerKey as typeof LANE_KEYS[number]);
    if (laneIndex === -1) return;

    // 防止重复触发
    if (this._keysPressed.has(lowerKey)) return;
    this._keysPressed.add(lowerKey);

    // 轨道闪光
    this._laneFlash[laneIndex] = 200;

    // 尝试判定
    this.judgeNote(laneIndex);
  }

  handleKeyUp(key: string): void {
    const lowerKey = key.toLowerCase();
    this._keysPressed.delete(lowerKey);
  }

  getState(): Record<string, unknown> {
    return {
      score: this._score,
      combo: this._combo,
      maxCombo: this._maxCombo,
      health: this._health,
      judgeCounts: { ...this._judgeCounts },
      isFinished: this._isFinished,
      isWin: this._isWin,
    };
  }

  // ========== 核心逻辑 ==========

  /** 生成新音符 */
  private spawnNotes(): void {
    const notes = this._beatmap.notes;
    while (this._beatmapIndex < notes.length) {
      const note = notes[this._beatmapIndex];
      // 提前 NOTE_TRAVEL_TIME 生成音符
      if (this._gameTime >= note.time - NOTE_TRAVEL_TIME) {
        this._activeNotes.push({
          id: this._nextNoteId++,
          lane: note.lane,
          targetTime: note.time,
          y: -NOTE_HEIGHT,
          judged: false,
        });
        this._beatmapIndex++;
      } else {
        break;
      }
    }
  }

  /** 更新音符位置 */
  private updateNotes(deltaTime: number): void {
    for (const note of this._activeNotes) {
      if (note.judged) continue;
      // 根据目标时间和当前位置计算
      // 音符应该从 y=0 (顶部) 移动到 y=JUDGE_LINE_Y (判定线)
      // 在 targetTime 时到达判定线
      const timeDiff = note.targetTime - this._gameTime;
      note.y = JUDGE_LINE_Y - timeDiff * NOTE_FALL_SPEED;
    }
  }

  /** 检测 Miss */
  private checkMisses(): void {
    for (const note of this._activeNotes) {
      if (note.judged) continue;
      // 音符超过判定线超过 GOOD 判定窗口
      const timeDiff = this._gameTime - note.targetTime;
      if (timeDiff > JUDGE_GOOD_MS) {
        note.judged = true;
        note.result = 'miss';
        this.applyJudge('miss', note.lane);
      }
    }
  }

  /** 判定音符 */
  private judgeNote(lane: number): void {
    // 找到该轨道上最近的未判定音符
    let closestNote: ActiveNote | null = null;
    let closestDiff = Infinity;

    for (const note of this._activeNotes) {
      if (note.judged || note.lane !== lane) continue;
      const diff = Math.abs(this._gameTime - note.targetTime);
      if (diff < closestDiff) {
        closestDiff = diff;
        closestNote = note;
      }
    }

    if (!closestNote) return;

    // 判定
    const timeDiff = Math.abs(this._gameTime - closestNote.targetTime);
    let result: JudgeResult;

    if (timeDiff <= JUDGE_PERFECT_MS) {
      result = 'perfect';
    } else if (timeDiff <= JUDGE_GREAT_MS) {
      result = 'great';
    } else if (timeDiff <= JUDGE_GOOD_MS) {
      result = 'good';
    } else {
      // 超出判定窗口，不判定
      return;
    }

    closestNote.judged = true;
    closestNote.result = result;
    this.applyJudge(result, lane);
  }

  /** 应用判定结果 */
  private applyJudge(result: JudgeResult, lane: number): void {
    this._judgeCounts[result]++;

    // 添加反馈
    this._feedbacks.push({
      result,
      lane,
      timestamp: this._gameTime,
    });

    if (result === 'miss') {
      // Miss：重置连击，扣血
      this._combo = 0;
      this._health = Math.max(0, this._health - MISS_HEALTH_PENALTY);
    } else {
      // 命中：增加连击，加分，回血
      this._combo++;
      if (this._combo > this._maxCombo) {
        this._maxCombo = this._combo;
      }

      const multiplier = this.getComboMultiplier();
      let baseScore: number;
      let healthRecover: number;

      switch (result) {
        case 'perfect':
          baseScore = SCORE_PERFECT;
          healthRecover = PERFECT_HEALTH_RECOVER;
          break;
        case 'great':
          baseScore = SCORE_GREAT;
          healthRecover = GREAT_HEALTH_RECOVER;
          break;
        case 'good':
          baseScore = SCORE_GOOD;
          healthRecover = GOOD_HEALTH_RECOVER;
          break;
        default:
          baseScore = 0;
          healthRecover = 0;
      }

      const points = baseScore * multiplier;
      this.addScore(points);
      this._health = Math.min(MAX_HEALTH, this._health + healthRecover);
    }
  }

  /** 获取当前连击倍率 */
  getComboMultiplier(): number {
    for (const { min, multiplier } of COMBO_MULTIPLIERS) {
      if (this._combo >= min) return multiplier;
    }
    return 1;
  }

  /** 更新判定反馈 */
  private updateFeedbacks(): void {
    this._feedbacks = this._feedbacks.filter(
      (fb) => this._gameTime - fb.timestamp < JUDGE_FEEDBACK_DURATION
    );
  }

  /** 更新轨道闪光 */
  private updateLaneFlash(deltaTime: number): void {
    for (let i = 0; i < LANE_COUNT; i++) {
      if (this._laneFlash[i] > 0) {
        this._laneFlash[i] = Math.max(0, this._laneFlash[i] - deltaTime);
      }
    }
  }

  /** 检查是否所有音符都已处理 */
  private checkFinish(): void {
    // 所有音符都已生成且都已判定
    if (this._beatmapIndex >= this._beatmap.notes.length) {
      const allJudged = this._activeNotes.every((n) => n.judged);
      if (allJudged) {
        this._isFinished = true;
        this._isWin = this._health > 0;
        this.gameOver();
      }
    }
  }

  /** 重置状态 */
  private resetState(): void {
    this._combo = 0;
    this._maxCombo = 0;
    this._health = INITIAL_HEALTH;
    this._judgeCounts = { perfect: 0, great: 0, good: 0, miss: 0 };
    this._activeNotes = [];
    this._feedbacks = [];
    this._beatmapIndex = 0;
    this._nextNoteId = 0;
    this._gameTime = 0;
    this._isFinished = false;
    this._isWin = false;
    this._keysPressed.clear();
    this._laneFlash = [0, 0, 0, 0];
  }

  // ========== 渲染辅助 ==========

  private renderHealthBar(ctx: CanvasRenderingContext2D, w: number): void {
    const barWidth = w - 40;
    const barHeight = 8;
    const x = 20;
    const y = 50;
    const ratio = this._health / MAX_HEALTH;

    // 背景
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(x, y, barWidth, barHeight);

    // 健康值
    let color: string;
    if (ratio > 0.6) color = '#2ed573';
    else if (ratio > 0.3) color = '#ffa502';
    else color = '#ff4757';

    ctx.fillStyle = color;
    ctx.fillRect(x, y, barWidth * ratio, barHeight);
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number, r: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  private hexToRgb(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r},${g},${b}`;
  }

  // ========== 测试辅助方法 ==========

  /** 设置游戏时间（仅用于测试） */
  _setGameTime(time: number): void {
    this._gameTime = time;
  }

  /** 强制生成音符（仅用于测试） */
  _forceSpawnNotes(): void {
    this.spawnNotes();
  }

  /** 强制更新音符位置（仅用于测试） */
  _forceUpdateNotes(deltaTime: number): void {
    this.updateNotes(deltaTime);
  }

  /** 强制检查 Miss（仅用于测试） */
  _forceCheckMisses(): void {
    this.checkMisses();
  }

  /** 设置 beatmap（仅用于测试） */
  _setBeatmap(beatmap: Beatmap): void {
    this._beatmap = beatmap;
  }

  /** 获取按键状态 */
  _isKeyPressed(key: string): boolean {
    return this._keysPressed.has(key);
  }

  /** 获取轨道闪光值 */
  _getLaneFlash(lane: number): number {
    return this._laneFlash[lane];
  }
}
