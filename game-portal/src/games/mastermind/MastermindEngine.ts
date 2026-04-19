import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  DEFAULT_CODE_LENGTH, COLOR_COUNT, MAX_GUESSES,
  Difficulty, DIFFICULTY_CONFIG,
  PEG_COLORS, PEG_BORDER_COLORS,
  FEEDBACK_A_COLOR, FEEDBACK_B_COLOR,
  PEG_RADIUS, PEG_SPACING, FEEDBACK_RADIUS,
  ROW_HEIGHT, ROW_SPACING,
  INPUT_ROW_Y, GUESS_START_Y, HUD_HEIGHT,
  BASE_SCORE, GUESS_PENALTY, PERFECT_BONUS,
  COLOR_NAMES,
  BG_COLOR, BOARD_COLOR, TEXT_COLOR, HIGHLIGHT_COLOR,
  EMPTY_PEG_COLOR, EMPTY_PEG_BORDER, CURSOR_COLOR,
} from './constants';

// ========== 内部类型 ==========

/** 单次猜测记录 */
interface GuessRecord {
  /** 玩家猜测的颜色索引数组 */
  guess: number[];
  /** A 数量（位置和颜色都正确） */
  a: number;
  /** B 数量（颜色正确但位置错误） */
  b: number;
}

// ========== 辅助函数 ==========

/** 生成指定长度的随机密码 */
function generateSecret(length: number): number[] {
  const secret: number[] = [];
  for (let i = 0; i < length; i++) {
    secret.push(Math.floor(Math.random() * COLOR_COUNT));
  }
  return secret;
}

/** 计算猜测与密码的 A/B 反馈 */
function evaluateGuess(guess: number[], secret: number[]): { a: number; b: number } {
  let a = 0;
  let b = 0;
  const secretRemaining: number[] = [];
  const guessRemaining: number[] = [];

  // 第一遍：计算 A（位置和颜色都正确）
  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === secret[i]) {
      a++;
    } else {
      secretRemaining.push(secret[i]);
      guessRemaining.push(guess[i]);
    }
  }

  // 第二遍：计算 B（颜色正确但位置错误）
  for (const g of guessRemaining) {
    const idx = secretRemaining.indexOf(g);
    if (idx !== -1) {
      b++;
      secretRemaining.splice(idx, 1);
    }
  }

  return { a, b };
}

export class MastermindEngine extends GameEngine {
  // ========== 游戏状态 ==========

  /** 当前难度 */
  private _difficulty: Difficulty = 'normal';

  /** 密码位数 */
  private _codeLength: number = DEFAULT_CODE_LENGTH;

  /** 秘密密码 */
  private _secret: number[] = [];

  /** 所有猜测记录 */
  private _guesses: GuessRecord[] = [];

  /** 当前输入（正在编辑的颜色索引） */
  private _currentInput: number[] = [];

  /** 当前编辑光标位置 */
  private _cursorPos: number = 0;

  /** 是否已获胜 */
  private _won: boolean = false;

  // ========== Public Getters ==========

  get difficulty(): Difficulty { return this._difficulty; }
  get codeLength(): number { return this._codeLength; }
  get secret(): number[] { return this._secret; }
  get guesses(): GuessRecord[] { return this._guesses; }
  get currentInput(): number[] { return this._currentInput; }
  get cursorPos(): number { return this._cursorPos; }
  get won(): boolean { return this._won; }

  /** 剩余猜测次数 */
  get remainingGuesses(): number {
    return MAX_GUESSES - this._guesses.length;
  }

  /** 当前猜测轮次（1-based） */
  get currentRound(): number {
    return this._guesses.length + 1;
  }

  // ========== GameEngine 抽象方法实现 ==========

  protected onInit(): void {
    this._difficulty = 'normal';
    this._codeLength = DIFFICULTY_CONFIG[this._difficulty].codeLength;
    this._secret = [];
    this._guesses = [];
    this._currentInput = new Array(this._codeLength).fill(-1);
    this._cursorPos = 0;
    this._won = false;
  }

  protected onStart(): void {
    this._codeLength = DIFFICULTY_CONFIG[this._difficulty].codeLength;
    this._secret = generateSecret(this._codeLength);
    this._guesses = [];
    this._currentInput = new Array(this._codeLength).fill(-1);
    this._cursorPos = 0;
    this._won = false;
  }

  protected update(_deltaTime: number): void {
    // Mastermind 是回合制游戏，不需要帧级更新
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // HUD 区域
    this.renderHUD(ctx, w);

    // 猜测历史
    this.renderGuessHistory(ctx, w);

    // 输入区域
    this.renderInputArea(ctx, w);

    // 游戏结束覆盖层
    if (this._status === 'gameover' || this._won) {
      this.renderOverlay(ctx, w, h);
    }
  }

  protected onReset(): void {
    this._secret = [];
    this._guesses = [];
    this._currentInput = new Array(this._codeLength).fill(-1);
    this._cursorPos = 0;
    this._won = false;
  }

  protected onGameOver(): void {
    // 回合制游戏，无需额外清理
  }

  handleKeyDown(key: string): void {
    if (this._status === 'idle') {
      if (key === 'Enter' || key === ' ') {
        this.start();
        return;
      }
    }

    if (this._status === 'gameover' || this._won) {
      if (key === 'Enter' || key === ' ') {
        this.reset();
        this.start();
        return;
      }
      return;
    }

    if (this._status !== 'playing') return;

    // 数字键 1-6 选择颜色
    if (key >= '1' && key <= String(COLOR_COUNT)) {
      this.selectColor(parseInt(key) - 1);
      return;
    }

    // Enter 提交猜测
    if (key === 'Enter') {
      this.submitGuess();
      return;
    }

    // Backspace 删除当前位置颜色
    if (key === 'Backspace') {
      this.deleteAtCursor();
      return;
    }

    // 左右箭头移动光标
    if (key === 'ArrowLeft') {
      this.moveCursor(-1);
      return;
    }
    if (key === 'ArrowRight') {
      this.moveCursor(1);
      return;
    }
  }

  handleKeyUp(_key: string): void {
    // Mastermind 不需要持续按键处理
  }

  getState(): Record<string, unknown> {
    return {
      score: this._score,
      level: this._level,
      status: this._status,
      difficulty: this._difficulty,
      codeLength: this._codeLength,
      currentRound: this.currentRound,
      remainingGuesses: this.remainingGuesses,
      guessCount: this._guesses.length,
      won: this._won,
      currentInput: [...this._currentInput],
      cursorPos: this._cursorPos,
    };
  }

  // ========== 公开方法（供测试和外部调用）==========

  /** 设置难度（仅在 idle 状态有效） */
  setDifficulty(difficulty: Difficulty): void {
    if (this._status !== 'idle') return;
    this._difficulty = difficulty;
    this._codeLength = DIFFICULTY_CONFIG[difficulty].codeLength;
    this._currentInput = new Array(this._codeLength).fill(-1);
    this._cursorPos = 0;
    this.emit('difficultyChange', difficulty);
  }

  /** 选择颜色到当前光标位置 */
  selectColor(colorIndex: number): void {
    if (colorIndex < 0 || colorIndex >= COLOR_COUNT) return;
    if (this._cursorPos < 0 || this._cursorPos >= this._codeLength) return;
    this._currentInput[this._cursorPos] = colorIndex;
    // 自动前进光标
    if (this._cursorPos < this._codeLength - 1) {
      this._cursorPos++;
    }
    this.emit('inputChange', [...this._currentInput]);
  }

  /** 提交当前猜测 */
  submitGuess(): boolean {
    // 检查是否所有位置都已填写
    if (this._currentInput.some(c => c === -1)) {
      this.emit('error', '请填写所有位置的颜色');
      return false;
    }

    // 检查是否还有猜测机会
    if (this._guesses.length >= MAX_GUESSES) {
      this.emit('error', '已达到最大猜测次数');
      return false;
    }

    const guess = [...this._currentInput];
    const { a, b } = evaluateGuess(guess, this._secret);

    this._guesses.push({ guess, a, b });

    // 计分：每次猜测扣分
    this.addScore(-GUESS_PENALTY);

    // 检查是否猜对
    if (a === this._codeLength) {
      this._won = true;
      // 额外奖励
      if (this._guesses.length === 1) {
        this.addScore(PERFECT_BONUS);
      }
      this.emit('win', { guesses: this._guesses.length, score: this._score });
      this.gameOver();
      return true;
    }

    // 检查是否用完所有机会
    if (this._guesses.length >= MAX_GUESSES) {
      this.emit('lose', { secret: this._secret });
      this.gameOver();
      return true;
    }

    // 重置输入
    this._currentInput = new Array(this._codeLength).fill(-1);
    this._cursorPos = 0;
    this.emit('guessSubmitted', { guess, a, b, round: this._guesses.length });

    return true;
  }

  /** 删除当前光标位置的颜色 */
  deleteAtCursor(): void {
    if (this._cursorPos >= 0 && this._cursorPos < this._codeLength) {
      // 如果当前位置已有颜色，删除它
      if (this._currentInput[this._cursorPos] !== -1) {
        this._currentInput[this._cursorPos] = -1;
      } else if (this._cursorPos > 0) {
        // 如果当前位置为空，回退到前一个位置并删除
        this._cursorPos--;
        this._currentInput[this._cursorPos] = -1;
      }
    }
    this.emit('inputChange', [...this._currentInput]);
  }

  /** 移动光标 */
  moveCursor(delta: number): void {
    const newPos = this._cursorPos + delta;
    if (newPos >= 0 && newPos < this._codeLength) {
      this._cursorPos = newPos;
    }
  }

  /** 设置光标位置（用于测试） */
  setCursorPos(pos: number): void {
    if (pos >= 0 && pos < this._codeLength) {
      this._cursorPos = pos;
    }
  }

  /** 获取最后一次猜测的反馈 */
  getLastFeedback(): { a: number; b: number } | null {
    if (this._guesses.length === 0) return null;
    const last = this._guesses[this._guesses.length - 1];
    return { a: last.a, b: last.b };
  }

  /** 揭示密码（游戏结束后或调试用） */
  revealSecret(): number[] {
    return [...this._secret];
  }

  // ========== 渲染方法 ==========

  private renderHUD(ctx: CanvasRenderingContext2D, _w: number): void {
    // HUD 背景
    ctx.fillStyle = BOARD_COLOR;
    ctx.fillRect(0, 0, CANVAS_WIDTH, HUD_HEIGHT);

    // 标题
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('MASTERMIND', CANVAS_WIDTH / 2, 24);

    // 信息行
    ctx.font = '14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`轮次: ${this._guesses.length}/${MAX_GUESSES}`, 16, 48);
    ctx.textAlign = 'center';
    ctx.fillText(`难度: ${DIFFICULTY_CONFIG[this._difficulty].label}`, CANVAS_WIDTH / 2, 48);
    ctx.textAlign = 'right';
    ctx.fillText(`分数: ${Math.max(0, this._score)}`, CANVAS_WIDTH - 16, 48);
    ctx.textAlign = 'left';
  }

  private renderGuessHistory(ctx: CanvasRenderingContext2D, _w: number): void {
    const startX = (CANVAS_WIDTH - (this._codeLength * PEG_SPACING)) / 2 + PEG_SPACING / 2;

    // 绘制已提交的猜测
    for (let i = 0; i < this._guesses.length; i++) {
      const record = this._guesses[i];
      const y = GUESS_START_Y + i * (ROW_HEIGHT + ROW_SPACING);

      // 行背景
      ctx.fillStyle = BOARD_COLOR;
      ctx.fillRect(20, y - ROW_HEIGHT / 2, CANVAS_WIDTH - 40, ROW_HEIGHT);

      // 轮次编号
      ctx.fillStyle = TEXT_COLOR;
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${i + 1}`, 12, y + 4);

      // 猜测颜色珠
      for (let j = 0; j < record.guess.length; j++) {
        const px = startX + j * PEG_SPACING;
        this.drawPeg(ctx, px, y, record.guess[j], false);
      }

      // 反馈指示器
      const feedbackX = startX + this._codeLength * PEG_SPACING + 10;
      this.drawFeedback(ctx, feedbackX, y, record.a, record.b);
    }
  }

  private renderInputArea(ctx: CanvasRenderingContext2D, _w: number): void {
    if (this._status !== 'playing') return;

    const y = INPUT_ROW_Y;
    const startX = (CANVAS_WIDTH - (this._codeLength * PEG_SPACING)) / 2 + PEG_SPACING / 2;

    // 输入区域背景
    ctx.fillStyle = HIGHLIGHT_COLOR;
    ctx.fillRect(20, y - ROW_HEIGHT / 2, CANVAS_WIDTH - 40, ROW_HEIGHT);

    // 当前输入
    for (let i = 0; i < this._codeLength; i++) {
      const px = startX + i * PEG_SPACING;
      const colorIdx = this._currentInput[i];

      if (colorIdx === -1) {
        // 空位
        this.drawEmptyPeg(ctx, px, y);
      } else {
        this.drawPeg(ctx, px, y, colorIdx, false);
      }

      // 光标指示
      if (i === this._cursorPos) {
        ctx.strokeStyle = CURSOR_COLOR;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(px, y, PEG_RADIUS + 4, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // 提示文字
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('数字键 1-6 选色 | ← → 移动 | Backspace 删除 | Enter 提交', CANVAS_WIDTH / 2, y + 38);
  }

  private renderOverlay(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, w, h);

    ctx.textAlign = 'center';

    if (this._won) {
      ctx.fillStyle = '#4caf50';
      ctx.font = 'bold 36px monospace';
      ctx.fillText('🎉 你赢了！', w / 2, h / 2 - 40);
      ctx.fillStyle = TEXT_COLOR;
      ctx.font = '18px monospace';
      ctx.fillText(`用了 ${this._guesses.length} 次猜测`, w / 2, h / 2);
      ctx.fillText(`最终得分: ${Math.max(0, this._score)}`, w / 2, h / 2 + 30);
    } else {
      ctx.fillStyle = '#f44336';
      ctx.font = 'bold 36px monospace';
      ctx.fillText('游戏结束', w / 2, h / 2 - 40);
      ctx.fillStyle = TEXT_COLOR;
      ctx.font = '18px monospace';
      ctx.fillText('正确答案:', w / 2, h / 2);

      // 显示正确答案
      const answerStartX = (w - this._codeLength * PEG_SPACING) / 2 + PEG_SPACING / 2;
      for (let i = 0; i < this._secret.length; i++) {
        this.drawPeg(ctx, answerStartX + i * PEG_SPACING, h / 2 + 40, this._secret[i], false);
      }
    }

    ctx.fillStyle = TEXT_COLOR;
    ctx.font = '14px monospace';
    ctx.fillText('按 Enter 或 Space 重新开始', w / 2, h / 2 + 80);
    ctx.textAlign = 'left';
  }

  // ========== 绘制辅助 ==========

  private drawPeg(ctx: CanvasRenderingContext2D, x: number, y: number, colorIndex: number, _selected: boolean): void {
    // 外圈
    ctx.fillStyle = PEG_BORDER_COLORS[colorIndex];
    ctx.beginPath();
    ctx.arc(x, y, PEG_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // 内圈
    ctx.fillStyle = PEG_COLORS[colorIndex];
    ctx.beginPath();
    ctx.arc(x, y, PEG_RADIUS - 3, 0, Math.PI * 2);
    ctx.fill();

    // 高光
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(x - 4, y - 4, PEG_RADIUS / 3, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawEmptyPeg(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.fillStyle = EMPTY_PEG_COLOR;
    ctx.beginPath();
    ctx.arc(x, y, PEG_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = EMPTY_PEG_BORDER;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, PEG_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
  }

  private drawFeedback(ctx: CanvasRenderingContext2D, x: number, y: number, a: number, b: number): void {
    const total = a + b;
    const spacing = FEEDBACK_RADIUS * 3;
    const cols = Math.ceil(Math.sqrt(total || 1));

    // A 指示器
    for (let i = 0; i < a; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const fx = x + col * spacing;
      const fy = y - FEEDBACK_RADIUS * 2 + row * spacing;
      ctx.fillStyle = FEEDBACK_A_COLOR;
      ctx.beginPath();
      ctx.arc(fx, fy, FEEDBACK_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }

    // B 指示器
    for (let i = 0; i < b; i++) {
      const col = (a + i) % cols;
      const row = Math.floor((a + i) / cols);
      const fx = x + col * spacing;
      const fy = y - FEEDBACK_RADIUS * 2 + row * spacing;
      ctx.fillStyle = FEEDBACK_B_COLOR;
      ctx.beginPath();
      ctx.arc(fx, fy, FEEDBACK_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
