import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  WORD_LENGTH, MAX_GUESSES, ALPHABET,
  COLOR_ABSENT, COLOR_PRESENT, COLOR_CORRECT,
  COLOR_EMPTY, COLOR_BORDER, COLOR_BORDER_ACTIVE,
  COLOR_TEXT, COLOR_BG, COLOR_KEY_BG, COLOR_KEY_TEXT,
  KEYBOARD_ROWS,
  TILE_SIZE, TILE_GAP, GRID_PADDING_X, GRID_TOP,
  KEY_HEIGHT, KEY_GAP, KEYBOARD_TOP, KEYBOARD_PADDING_X,
  BASE_SCORE, GUESS_PENALTY, WIN_BONUS,
  WORD_LIST,
  LetterStatus,
  GuessResult,
  WordleStats,
} from './constants';

// ========== 辅助函数 ==========

/** 计算猜测反馈（核心算法） */
export function calculateFeedback(guess: string, answer: string): LetterStatus[] {
  const feedback: LetterStatus[] = new Array(WORD_LENGTH).fill(LetterStatus.ABSENT);
  const answerChars = answer.split('');
  const guessChars = guess.split('');
  const answerUsed = new Array(WORD_LENGTH).fill(false);
  const guessUsed = new Array(WORD_LENGTH).fill(false);

  // 第一遍：标记绿色（位置和字母都正确）
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guessChars[i] === answerChars[i]) {
      feedback[i] = LetterStatus.CORRECT;
      answerUsed[i] = true;
      guessUsed[i] = true;
    }
  }

  // 第二遍：标记黄色（字母存在但位置不对）
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guessUsed[i]) continue;
    for (let j = 0; j < WORD_LENGTH; j++) {
      if (answerUsed[j]) continue;
      if (guessChars[i] === answerChars[j]) {
        feedback[i] = LetterStatus.PRESENT;
        answerUsed[j] = true;
        break;
      }
    }
  }

  return feedback;
}

/** 验证单词是否在词库中 */
export function isValidWord(word: string): boolean {
  return WORD_LIST.includes(word.toUpperCase());
}

/** 从词库随机选择一个答案 */
export function getRandomAnswer(): string {
  const index = Math.floor(Math.random() * WORD_LIST.length);
  return WORD_LIST[index];
}

/** 默认统计 */
function defaultStats(): WordleStats {
  return {
    totalGames: 0,
    wins: 0,
    currentStreak: 0,
    maxStreak: 0,
    guessDistribution: [0, 0, 0, 0, 0, 0],
  };
}

// ========== WordleEngine ==========

export class WordleEngine extends GameEngine {
  // ========== 游戏状态 ==========

  /** 秘密答案 */
  private _answer: string = '';

  /** 所有猜测记录 */
  private _guesses: GuessResult[] = [];

  /** 当前输入的字母 */
  private _currentInput: string[] = [];

  /** 键盘上每个字母的状态 */
  private _keyStates: Map<string, LetterStatus> = new Map();

  /** 是否已获胜 */
  private _isWin: boolean = false;

  /** 游戏统计 */
  private _stats: WordleStats = defaultStats();

  /** 上一次猜测的错误消息 */
  private _errorMessage: string = '';

  /** 错误消息显示时间 */
  private _errorTime: number = 0;

  /** 是否显示揭示动画 */
  private _revealRow: number = -1;

  /** 揭示动画开始时间 */
  private _revealStartTime: number = 0;

  // ========== Public Getters ==========

  get answer(): string { return this._answer; }
  get guesses(): GuessResult[] { return this._guesses; }
  get currentInput(): string[] { return this._currentInput; }
  get keyStates(): Map<string, LetterStatus> { return this._keyStates; }
  get isWin(): boolean { return this._isWin; }
  get stats(): WordleStats { return this._stats; }
  get errorMessage(): string { return this._errorMessage; }

  /** 当前猜测轮次（1-based） */
  get currentRound(): number {
    return this._guesses.length + 1;
  }

  /** 剩余猜测次数 */
  get remainingGuesses(): number {
    return MAX_GUESSES - this._guesses.length;
  }

  // ========== GameEngine 抽象方法实现 ==========

  protected onInit(): void {
    this._answer = '';
    this._guesses = [];
    this._currentInput = [];
    this._keyStates = new Map();
    this._isWin = false;
    this._errorMessage = '';
    this._errorTime = 0;
    this._revealRow = -1;
    this._revealStartTime = 0;
    this.loadStats();
  }

  protected onStart(): void {
    this._answer = getRandomAnswer();
    this._guesses = [];
    this._currentInput = [];
    this._keyStates = new Map();
    this._isWin = false;
    this._errorMessage = '';
    this._errorTime = 0;
    this._revealRow = -1;
    this._revealStartTime = 0;
    this._score = BASE_SCORE;
    this.emit('scoreChange', this._score);
  }

  protected update(deltaTime: number): void {
    // Wordle 是回合制游戏，不需要帧级更新
    // 但用于清除错误消息
    if (this._errorMessage && Date.now() - this._errorTime > 2000) {
      this._errorMessage = '';
    }
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = COLOR_BG;
    ctx.fillRect(0, 0, w, h);

    // 标题栏
    this.renderHeader(ctx, w);

    // 猜测网格
    this.renderGrid(ctx, w);

    // 错误消息
    this.renderError(ctx, w);

    // 虚拟键盘
    this.renderKeyboard(ctx, w);

    // 游戏结束覆盖层
    if (this._status === 'gameover') {
      this.renderOverlay(ctx, w, h);
    }
  }

  protected onReset(): void {
    this._answer = '';
    this._guesses = [];
    this._currentInput = [];
    this._keyStates = new Map();
    this._isWin = false;
    this._errorMessage = '';
    this._errorTime = 0;
    this._revealRow = -1;
    this._revealStartTime = 0;
  }

  protected onGameOver(): void {
    // 更新统计
    this.updateStats();
  }

  handleKeyDown(key: string): void {
    if (this._status === 'idle') {
      if (key === 'Enter' || key === ' ') {
        this.start();
        return;
      }
    }

    if (this._status === 'gameover') {
      if (key === 'n' || key === 'N') {
        this.reset();
        this.start();
        return;
      }
      if (key === 'Enter' || key === ' ') {
        this.reset();
        this.start();
        return;
      }
      return;
    }

    if (this._status !== 'playing') return;

    // N 键新游戏
    if (key === 'n' || key === 'N') {
      this.reset();
      this.start();
      return;
    }

    // 字母键 A-Z
    const upperKey = key.toUpperCase();
    if (upperKey.length === 1 && ALPHABET.includes(upperKey)) {
      this.inputLetter(upperKey);
      return;
    }

    // Enter 提交猜测
    if (key === 'Enter') {
      this.submitGuess();
      return;
    }

    // Backspace 删除最后一个字母
    if (key === 'Backspace') {
      this.deleteLetter();
      return;
    }
  }

  handleKeyUp(_key: string): void {
    // Wordle 不需要持续按键处理
  }

  getState(): Record<string, unknown> {
    return {
      score: this._score,
      level: this._level,
      status: this._status,
      answer: this._answer,
      guesses: this._guesses.map(g => ({ word: g.word, feedback: [...g.feedback] })),
      currentInput: [...this._currentInput],
      keyStates: Object.fromEntries(this._keyStates),
      isWin: this._isWin,
      currentRound: this.currentRound,
      remainingGuesses: this.remainingGuesses,
      stats: { ...this._stats, guessDistribution: [...this._stats.guessDistribution] },
    };
  }

  // ========== 公开方法（供测试和外部调用）==========

  /** 输入一个字母 */
  inputLetter(letter: string): boolean {
    if (this._currentInput.length >= WORD_LENGTH) return false;
    if (!ALPHABET.includes(letter)) return false;
    this._currentInput.push(letter);
    this.emit('inputChange', [...this._currentInput]);
    return true;
  }

  /** 删除最后一个字母 */
  deleteLetter(): boolean {
    if (this._currentInput.length === 0) return false;
    this._currentInput.pop();
    this.emit('inputChange', [...this._currentInput]);
    return true;
  }

  /** 提交当前猜测 */
  submitGuess(): boolean {
    // 检查输入长度
    if (this._currentInput.length !== WORD_LENGTH) {
      this.showError('Not enough letters');
      return false;
    }

    const word = this._currentInput.join('');

    // 检查是否在词库中
    if (!isValidWord(word)) {
      this.showError('Not in word list');
      return false;
    }

    // 检查是否还有猜测机会
    if (this._guesses.length >= MAX_GUESSES) {
      return false;
    }

    // 计算反馈
    const feedback = calculateFeedback(word, this._answer);
    const result: GuessResult = { word, feedback };
    this._guesses.push(result);

    // 更新键盘状态
    this.updateKeyStates(word, feedback);

    // 扣分
    this._score = Math.max(0, this._score - GUESS_PENALTY);
    this.emit('scoreChange', this._score);

    // 检查是否获胜
    if (feedback.every(f => f === LetterStatus.CORRECT)) {
      this._isWin = true;
      this._score += WIN_BONUS;
      this.emit('scoreChange', this._score);
      this.emit('win', { guesses: this._guesses.length, score: this._score });
      this.gameOver();
      return true;
    }

    // 检查是否用完所有机会
    if (this._guesses.length >= MAX_GUESSES) {
      this._isWin = false;
      this.emit('lose', { answer: this._answer });
      this.gameOver();
      return true;
    }

    // 重置输入
    this._currentInput = [];
    this.emit('guessSubmitted', { word, feedback, round: this._guesses.length });
    return true;
  }

  /** 设置答案（用于测试） */
  setAnswer(answer: string): void {
    if (answer.length === WORD_LENGTH && ALPHABET.split('').every(c => true) || answer.length === WORD_LENGTH) {
      this._answer = answer.toUpperCase();
    }
  }

  /** 获取指定字母的键盘状态 */
  getKeyState(letter: string): LetterStatus {
    return this._keyStates.get(letter.toUpperCase()) ?? LetterStatus.UNUSED;
  }

  /** 加载统计（从 localStorage） */
  loadStats(): void {
    try {
      const stored = localStorage.getItem('wordle_stats');
      if (stored) {
        const parsed = JSON.parse(stored);
        this._stats = {
          totalGames: parsed.totalGames ?? 0,
          wins: parsed.wins ?? 0,
          currentStreak: parsed.currentStreak ?? 0,
          maxStreak: parsed.maxStreak ?? 0,
          guessDistribution: parsed.guessDistribution ?? [0, 0, 0, 0, 0, 0],
        };
      } else {
        this._stats = defaultStats();
      }
    } catch {
      this._stats = defaultStats();
    }
  }

  /** 保存统计到 localStorage */
  saveStats(): void {
    try {
      localStorage.setItem('wordle_stats', JSON.stringify(this._stats));
    } catch {
      // 忽略存储错误
    }
  }

  /** 重置统计 */
  resetStats(): void {
    this._stats = defaultStats();
    this.saveStats();
  }

  // ========== 内部方法 ==========

  /** 显示错误消息 */
  private showError(msg: string): void {
    this._errorMessage = msg;
    this._errorTime = Date.now();
    this.emit('error', msg);
  }

  /** 更新键盘上字母的状态 */
  private updateKeyStates(word: string, feedback: LetterStatus[]): void {
    for (let i = 0; i < word.length; i++) {
      const letter = word[i];
      const newStatus = feedback[i];
      const currentStatus = this._keyStates.get(letter);

      // 优先级：CORRECT > PRESENT > ABSENT
      if (!currentStatus) {
        this._keyStates.set(letter, newStatus);
      } else if (currentStatus === LetterStatus.PRESENT && newStatus === LetterStatus.CORRECT) {
        this._keyStates.set(letter, newStatus);
      } else if (currentStatus === LetterStatus.ABSENT && newStatus !== LetterStatus.ABSENT) {
        this._keyStates.set(letter, newStatus);
      }
    }
  }

  /** 更新游戏统计 */
  private updateStats(): void {
    this._stats.totalGames++;
    if (this._isWin) {
      this._stats.wins++;
      this._stats.currentStreak++;
      if (this._stats.currentStreak > this._stats.maxStreak) {
        this._stats.maxStreak = this._stats.currentStreak;
      }
      // 猜测次数分布（index 0 = 1次猜中）
      const idx = this._guesses.length - 1;
      if (idx >= 0 && idx < 6) {
        this._stats.guessDistribution[idx]++;
      }
    } else {
      this._stats.currentStreak = 0;
    }
    this.saveStats();
  }

  // ========== 渲染方法 ==========

  private renderHeader(ctx: CanvasRenderingContext2D, w: number): void {
    // 标题栏背景
    ctx.fillStyle = COLOR_BG;
    ctx.fillRect(0, 0, w, 60);

    // 分隔线
    ctx.strokeStyle = COLOR_BORDER;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 60);
    ctx.lineTo(w, 60);
    ctx.stroke();

    // 标题
    ctx.fillStyle = COLOR_TEXT;
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('W O R D L E', w / 2, 30);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // 轮次信息
    ctx.fillStyle = '#8787a0';
    ctx.font = '12px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${this._guesses.length}/${MAX_GUESSES}`, w - 16, 50);
    ctx.textAlign = 'left';
  }

  private renderGrid(ctx: CanvasRenderingContext2D, _w: number): void {
    const gridWidth = WORD_LENGTH * TILE_SIZE + (WORD_LENGTH - 1) * TILE_GAP;
    const startX = (CANVAS_WIDTH - gridWidth) / 2;

    for (let row = 0; row < MAX_GUESSES; row++) {
      const y = GRID_TOP + row * (TILE_SIZE + TILE_GAP);
      const isActiveRow = row === this._guesses.length && this._status === 'playing';

      for (let col = 0; col < WORD_LENGTH; col++) {
        const x = startX + col * (TILE_SIZE + TILE_GAP);

        if (row < this._guesses.length) {
          // 已提交的猜测
          const guess = this._guesses[row];
          const letter = guess.word[col];
          const status = guess.feedback[col];
          const bgColor = this.getStatusColor(status);

          // 背景
          ctx.fillStyle = bgColor;
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

          // 字母
          ctx.fillStyle = COLOR_TEXT;
          ctx.font = 'bold 28px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(letter, x + TILE_SIZE / 2, y + TILE_SIZE / 2 + 1);
          ctx.textAlign = 'left';
          ctx.textBaseline = 'alphabetic';
        } else if (row === this._guesses.length && col < this._currentInput.length) {
          // 当前输入
          const letter = this._currentInput[col];

          // 空格子边框
          ctx.strokeStyle = isActiveRow ? COLOR_BORDER_ACTIVE : COLOR_BORDER;
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);

          // 字母
          ctx.fillStyle = COLOR_TEXT;
          ctx.font = 'bold 28px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(letter, x + TILE_SIZE / 2, y + TILE_SIZE / 2 + 1);
          ctx.textAlign = 'left';
          ctx.textBaseline = 'alphabetic';
        } else {
          // 空格子
          ctx.strokeStyle = isActiveRow ? COLOR_BORDER_ACTIVE : COLOR_BORDER;
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
        }
      }
    }
  }

  private renderError(ctx: CanvasRenderingContext2D, w: number): void {
    if (!this._errorMessage) return;

    ctx.fillStyle = COLOR_TEXT;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const y = GRID_TOP + MAX_GUESSES * (TILE_SIZE + TILE_GAP) + 10;

    // 背景
    const metrics = ctx.measureText(this._errorMessage);
    const padding = 12;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(
      w / 2 - metrics.width / 2 - padding,
      y - 12,
      metrics.width + padding * 2,
      24
    );

    ctx.fillStyle = '#121213';
    ctx.fillText(this._errorMessage, w / 2, y);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  private renderKeyboard(ctx: CanvasRenderingContext2D, _w: number): void {
    for (let rowIdx = 0; rowIdx < KEYBOARD_ROWS.length; rowIdx++) {
      const row = KEYBOARD_ROWS[rowIdx];
      const rowWidth = this.calculateRowWidth(row);
      const startX = (CANVAS_WIDTH - rowWidth) / 2;
      const y = KEYBOARD_TOP + rowIdx * (KEY_HEIGHT + KEY_GAP);
      let x = startX;

      for (const key of row) {
        const keyWidth = this.getKeyWidth(key);
        const letter = key.length === 1 ? key : '';
        const status = letter ? (this._keyStates.get(letter) ?? LetterStatus.UNUSED) : LetterStatus.UNUSED;
        const bgColor = letter ? this.getStatusColor(status) : COLOR_KEY_BG;

        // 按键背景
        ctx.fillStyle = bgColor;
        this.roundRect(ctx, x, y, keyWidth, KEY_HEIGHT, 4);

        // 按键文字
        ctx.fillStyle = COLOR_KEY_TEXT;
        ctx.font = key.length > 1 ? 'bold 11px monospace' : 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(key, x + keyWidth / 2, y + KEY_HEIGHT / 2);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';

        x += keyWidth + KEY_GAP;
      }
    }
  }

  private renderOverlay(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, w, h);

    ctx.textAlign = 'center';

    if (this._isWin) {
      ctx.fillStyle = '#538d4e';
      ctx.font = 'bold 32px monospace';
      ctx.fillText('🎉 Excellent!', w / 2, h / 2 - 60);

      ctx.fillStyle = COLOR_TEXT;
      ctx.font = '16px monospace';
      ctx.fillText(`${this._guesses.length}/${MAX_GUESSES} guesses`, w / 2, h / 2 - 20);
      ctx.fillText(`Score: ${this._score}`, w / 2, h / 2 + 10);

      // 统计
      ctx.font = '14px monospace';
      ctx.fillStyle = '#8787a0';
      const winRate = this._stats.totalGames > 0
        ? Math.round((this._stats.wins / this._stats.totalGames) * 100)
        : 0;
      ctx.fillText(`Win Rate: ${winRate}% | Streak: ${this._stats.currentStreak}`, w / 2, h / 2 + 50);
    } else {
      ctx.fillStyle = '#f44336';
      ctx.font = 'bold 32px monospace';
      ctx.fillText('Game Over', w / 2, h / 2 - 60);

      ctx.fillStyle = COLOR_TEXT;
      ctx.font = '16px monospace';
      ctx.fillText(`Answer: ${this._answer}`, w / 2, h / 2 - 20);

      ctx.font = '14px monospace';
      ctx.fillStyle = '#8787a0';
      const winRate = this._stats.totalGames > 0
        ? Math.round((this._stats.wins / this._stats.totalGames) * 100)
        : 0;
      ctx.fillText(`Win Rate: ${winRate}% | Streak: ${this._stats.currentStreak}`, w / 2, h / 2 + 20);
    }

    ctx.fillStyle = '#8787a0';
    ctx.font = '14px monospace';
    ctx.fillText('Press N or Enter to play again', w / 2, h / 2 + 90);
    ctx.textAlign = 'left';
  }

  // ========== 渲染辅助 ==========

  private getStatusColor(status: LetterStatus): string {
    switch (status) {
      case LetterStatus.CORRECT: return COLOR_CORRECT;
      case LetterStatus.PRESENT: return COLOR_PRESENT;
      case LetterStatus.ABSENT: return COLOR_ABSENT;
      default: return COLOR_KEY_BG;
    }
  }

  private getKeyWidth(key: string): number {
    if (key === 'ENTER' || key === '⌫') return 58;
    return 36;
  }

  private calculateRowWidth(row: string[]): number {
    let width = 0;
    for (const key of row) {
      width += this.getKeyWidth(key);
    }
    width += (row.length - 1) * KEY_GAP;
    return width;
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
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
    ctx.fill();
  }
}
