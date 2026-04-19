import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  CARD_COUNT, MIN_CARD_VALUE, MAX_CARD_VALUE, TARGET_RESULT,
  OPERATORS, Operator,
  Difficulty, DIFFICULTY_CONFIG,
  BASE_SCORE, TIME_BONUS_FACTOR, HINT_PENALTY, SKIP_PENALTY, STREAK_BONUS,
  CARD_WIDTH, CARD_HEIGHT, CARD_SPACING, CARD_ROW_Y, CARD_BORDER_RADIUS,
  EXPRESSION_Y, EXPRESSION_HEIGHT, EXPRESSION_PADDING,
  HUD_HEIGHT, MESSAGE_Y, BUTTON_ROW_Y,
  BG_COLOR, BOARD_COLOR, TEXT_COLOR, HIGHLIGHT_COLOR,
  CARD_BG_COLOR, CARD_BORDER_COLOR, CARD_SELECTED_COLOR, CARD_USED_COLOR,
  CARD_TEXT_COLOR, CARD_SUIT_RED, CARD_SUIT_BLACK,
  OPERATOR_BG, OPERATOR_TEXT, PAREN_BG, PAREN_TEXT,
  SUBMIT_BG, SUBMIT_TEXT, HINT_BG, HINT_TEXT, CLEAR_BG, CLEAR_TEXT,
  SUCCESS_COLOR, ERROR_COLOR, TIMER_COLOR, TIMER_WARNING_COLOR, TIMER_CRITICAL_COLOR,
  CURSOR_COLOR, EXPRESSION_BG, EXPRESSION_BORDER,
  SUITS, RED_SUITS, VALUE_DISPLAY, SUIT_SYMBOLS,
} from './constants';

// ========== 内部类型 ==========

/** 花色类型 */
export type SuitName = typeof SUITS[number];

/** 一张牌 */
export interface Card {
  value: number;       // 1-13
  suit: SuitName;      // 花色
  used: boolean;       // 是否已被选入表达式
}

/** 表达式中的 token */
export type Token =
  | { type: 'number'; value: number; cardIndex: number }
  | { type: 'operator'; value: Operator }
  | { type: 'paren'; value: '(' | ')' };

/** 游戏消息 */
export interface GameMessage {
  text: string;
  color: string;
  timer: number; // 剩余显示毫秒
}

/** 求解提示结果 */
export interface HintResult {
  expression: string;
  steps: string[];
}

// ========== 辅助函数 ==========

/** 生成随机整数 [min, max] */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** 生成一组随机牌 */
function generateCards(maxValue: number = MAX_CARD_VALUE): Card[] {
  const cards: Card[] = [];
  for (let i = 0; i < CARD_COUNT; i++) {
    cards.push({
      value: randomInt(MIN_CARD_VALUE, maxValue),
      suit: SUITS[i % SUITS.length],
      used: false,
    });
  }
  return cards;
}

// ========== 求解器 ==========

/**
 * 判断一组数字是否能通过 +, -, *, / 和括号组合得到目标值。
 * 使用递归缩减法：每次从数组中选两个数，用四种运算合并，递归处理剩余数。
 */
export function canMakeTarget(numbers: number[], target: number = TARGET_RESULT): boolean {
  if (numbers.length === 0) return false;
  if (numbers.length === 1) return Math.abs(numbers[0] - target) < 1e-9;
  const n = numbers.length;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const rest = numbers.filter((_, k) => k !== i && k !== j);
      const a = numbers[i];
      const b = numbers[j];
      if (canMakeTarget([...rest, a + b], target)) return true;
      if (canMakeTarget([...rest, a - b], target)) return true;
      if (canMakeTarget([...rest, a * b], target)) return true;
      if (Math.abs(b) > 1e-9 && canMakeTarget([...rest, a / b], target)) return true;
    }
  }
  return false;
}

/**
 * 求出一种能凑出目标值的表达式（字符串形式）。
 * 返回 null 表示无解。
 */
export function solveMake24(numbers: number[], target: number = TARGET_RESULT): string | null {
  type Node = { val: number; expr: string };
  const nums: Node[] = numbers.map((n) => ({ val: n, expr: String(n) }));

  function solve(nodes: Node[]): string | null {
    if (nodes.length === 1) {
      return Math.abs(nodes[0].val - target) < 1e-9 ? nodes[0].expr : null;
    }
    for (let i = 0; i < nodes.length; i++) {
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const rest = nodes.filter((_, k) => k !== i && k !== j);
        const a = nodes[i];
        const b = nodes[j];
        const pairs: Node[] = [
          { val: a.val + b.val, expr: `(${a.expr}+${b.expr})` },
          { val: a.val - b.val, expr: `(${a.expr}-${b.expr})` },
          { val: a.val * b.val, expr: `(${a.expr}*${b.expr})` },
        ];
        if (Math.abs(b.val) > 1e-9) {
          pairs.push({ val: a.val / b.val, expr: `(${a.expr}/${b.expr})` });
        }
        for (const p of pairs) {
          const result = solve([...rest, p]);
          if (result !== null) return result;
        }
      }
    }
    return null;
  }

  return solve(nums);
}

// ========== 表达式验证器 ==========

export interface ValidationResult {
  valid: boolean;
  error?: string;
  result?: number;
}

/**
 * 安全地计算一个数学表达式字符串。
 * 只允许数字、+、-、*、/、(、)、空格。
 */
export function safeEval(expr: string): number {
  const sanitized = expr.replace(/\s/g, '');
  if (!/^[\d+\-*/().]+$/.test(sanitized)) {
    throw new Error('表达式包含非法字符');
  }
  try {
    const fn = new Function(`"use strict"; return (${sanitized});`);
    const result = fn();
    if (typeof result !== 'number' || !isFinite(result)) {
      throw new Error('计算结果无效');
    }
    return result;
  } catch {
    throw new Error('表达式格式错误');
  }
}

/**
 * 验证玩家输入的表达式：
 * 1. 必须恰好使用给定的 4 个数字各一次
 * 2. 只允许 +, -, *, /, (, )
 * 3. 结果必须等于目标值
 */
export function validateExpression(
  expression: string,
  cards: Card[],
  target: number = TARGET_RESULT
): ValidationResult {
  const trimmed = expression.trim();
  if (!trimmed) {
    return { valid: false, error: '请输入表达式' };
  }

  // 提取表达式中的所有数字
  const numMatches = trimmed.match(/\d+/g);
  if (!numMatches) {
    return { valid: false, error: '表达式中没有数字' };
  }

  const usedNumbers = numMatches.map(Number);

  // 检查数字数量
  if (usedNumbers.length !== cards.length) {
    return {
      valid: false,
      error: `必须恰好使用 ${cards.length} 个数字，当前使用了 ${usedNumbers.length} 个`,
    };
  }

  // 检查数字是否匹配（排序后比较）
  const expectedNumbers = cards.map((c) => c.value).sort((a, b) => a - b);
  const actualNumbers = [...usedNumbers].sort((a, b) => a - b);

  for (let i = 0; i < expectedNumbers.length; i++) {
    if (expectedNumbers[i] !== actualNumbers[i]) {
      return { valid: false, error: '使用的数字与牌面不匹配' };
    }
  }

  // 检查非法字符
  if (!/^[\d+\-*/() .]+$/.test(trimmed)) {
    return { valid: false, error: '表达式包含非法字符，只能使用数字和 + - * / ( )' };
  }

  // 计算结果
  try {
    const result = safeEval(trimmed);
    if (Math.abs(result - target) < 1e-9) {
      return { valid: true, result };
    } else {
      return {
        valid: false,
        error: `结果为 ${Number.isInteger(result) ? result : result.toFixed(2)}，不等于 ${target}`,
        result,
      };
    }
  } catch (e) {
    return { valid: false, error: (e as Error).message };
  }
}

// ========== 游戏引擎 ==========

export class Make24Engine extends GameEngine {
  // ========== 游戏状态 ==========

  private _cards: Card[] = [];
  private _expression: Token[] = [];
  private _timeRemaining: number = 0;
  private _hintsUsed: number = 0;
  private _maxHints: number = 3;
  private _message: GameMessage | null = null;
  private _roundsSolved: number = 0;
  private _streak: number = 0;
  private _difficulty: Difficulty = 'normal';
  private _timerInterval: ReturnType<typeof setInterval> | null = null;
  private _cursorVisible: boolean = true;
  private _cursorTimer: number = 0;

  // ========== Public Getters ==========

  get cards(): Card[] { return this._cards; }
  get expression(): Token[] { return this._expression; }
  get timeRemaining(): number { return this._timeRemaining; }
  get hintsUsed(): number { return this._hintsUsed; }
  get maxHints(): number { return this._maxHints; }
  get roundsSolved(): number { return this._roundsSolved; }
  get streak(): number { return this._streak; }
  get message(): GameMessage | null { return this._message; }
  get difficulty(): Difficulty { return this._difficulty; }

  /** 获取表达式的字符串形式 */
  get expressionString(): string {
    return this._expression
      .map((t) => {
        if (t.type === 'number') return String(t.value);
        if (t.type === 'operator') return t.value;
        return t.value;
      })
      .join(' ');
  }

  // ========== 配置 ==========

  /** 设置难度 */
  setDifficulty(difficulty: Difficulty): void {
    this._difficulty = difficulty;
  }

  // ========== GameEngine 抽象方法实现 ==========

  protected onInit(): void {
    this._cards = [];
    this._expression = [];
    this._timeRemaining = DIFFICULTY_CONFIG[this._difficulty].timeLimit;
    this._hintsUsed = 0;
    this._message = null;
    this._roundsSolved = 0;
    this._streak = 0;
    this._cursorVisible = true;
    this._cursorTimer = 0;
    this.clearTimerInterval();
  }

  protected onStart(): void {
    this._timeRemaining = DIFFICULTY_CONFIG[this._difficulty].timeLimit;
    this._hintsUsed = 0;
    this._roundsSolved = 0;
    this._streak = 0;
    this._message = null;
    this._expression = [];
    this.dealCards();
    if (this._timeRemaining > 0) {
      this.startTimer();
    }
  }

  protected update(deltaTime: number): void {
    // 光标闪烁
    this._cursorTimer += deltaTime;
    if (this._cursorTimer >= 500) {
      this._cursorTimer -= 500;
      this._cursorVisible = !this._cursorVisible;
    }

    // 消息倒计时
    if (this._message) {
      this._message.timer -= deltaTime;
      if (this._message.timer <= 0) {
        this._message = null;
      }
    }
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // HUD
    this.renderHUD(ctx, w);

    // 牌
    this.renderCards(ctx, w);

    // 表达式栏
    this.renderExpression(ctx, w);

    // 操作按钮
    this.renderButtons(ctx, w);

    // 计时器（仅限时模式）
    if (this._timeRemaining > 0 || DIFFICULTY_CONFIG[this._difficulty].timeLimit > 0) {
      this.renderTimer(ctx, w);
    }

    // 消息
    this.renderMessage(ctx, w);

    // 游戏结束覆盖层
    if (this._status === 'gameover') {
      this.renderGameOver(ctx, w, h);
    }
  }

  protected onPause(): void {
    this.clearTimerInterval();
  }

  protected onResume(): void {
    if (this._timeRemaining > 0) {
      this.startTimer();
    }
  }

  protected onReset(): void {
    this.clearTimerInterval();
    this._cards = [];
    this._expression = [];
    this._timeRemaining = DIFFICULTY_CONFIG[this._difficulty].timeLimit;
    this._hintsUsed = 0;
    this._message = null;
    this._roundsSolved = 0;
    this._streak = 0;
  }

  protected onDestroy(): void {
    this.clearTimerInterval();
  }

  protected onGameOver(): void {
    this.clearTimerInterval();
  }

  handleKeyDown(key: string): void {
    if (this._status === 'idle') {
      if (key === ' ' || key === 'Enter') {
        this.start();
      }
      return;
    }
    if (this._status === 'gameover') {
      if (key === ' ' || key === 'Enter') {
        this.reset();
        this.start();
      }
      return;
    }
    if (this._status !== 'playing') return;

    switch (key) {
      case '1': case '2': case '3': case '4':
        this.selectCard(Number(key) - 1);
        break;
      case '+': this.addOperator('+'); break;
      case '-': this.addOperator('-'); break;
      case '*': this.addOperator('*'); break;
      case '/': this.addOperator('/'); break;
      case '(': this.addParen('('); break;
      case ')': this.addParen(')'); break;
      case 'Backspace': this.removeLastToken(); break;
      case 'Enter': this.submitExpression(); break;
      case 'h': case 'H': this.useHint(); break;
      case 'n': case 'N': this.skipRound(); break;
      case 'Escape': this.clearExpression(); break;
    }
  }

  handleKeyUp(_key: string): void {
    // 无需处理
  }

  getState(): Record<string, unknown> {
    return {
      score: this._score,
      level: this._level,
      status: this._status,
      cards: this._cards.map((c) => ({ value: c.value, suit: c.suit, used: c.used })),
      expression: this.expressionString,
      timeRemaining: this._timeRemaining,
      hintsUsed: this._hintsUsed,
      roundsSolved: this._roundsSolved,
      streak: this._streak,
      difficulty: this._difficulty,
      message: this._message,
    };
  }

  // ========== 游戏逻辑 ==========

  /** 发牌：生成 4 张牌 */
  dealCards(): void {
    const config = DIFFICULTY_CONFIG[this._difficulty];
    let attempts = 0;
    do {
      this._cards = generateCards(config.maxValue);
      attempts++;
    } while (config.guaranteedSolvable && !canMakeTarget(this._cards.map((c) => c.value)) && attempts < 1000);
    this._expression = [];
    this.emit('cardsDealt', this._cards.map((c) => c.value));
  }

  /** 选择一张牌（通过索引） */
  selectCard(index: number): void {
    if (this._status !== 'playing') return;
    if (index < 0 || index >= this._cards.length) return;
    if (this._cards[index].used) return;

    this._cards[index].used = true;
    this._expression.push({
      type: 'number',
      value: this._cards[index].value,
      cardIndex: index,
    });
    this.emit('expressionChange', this.expressionString);
  }

  /** 添加运算符 */
  addOperator(op: Operator): void {
    if (this._status !== 'playing') return;
    this._expression.push({ type: 'operator', value: op });
    this.emit('expressionChange', this.expressionString);
  }

  /** 添加括号 */
  addParen(p: '(' | ')'): void {
    if (this._status !== 'playing') return;
    this._expression.push({ type: 'paren', value: p });
    this.emit('expressionChange', this.expressionString);
  }

  /** 删除最后一个 token */
  removeLastToken(): void {
    if (this._status !== 'playing') return;
    if (this._expression.length === 0) return;

    const last = this._expression.pop()!;
    if (last.type === 'number') {
      this._cards[last.cardIndex].used = false;
    }
    this.emit('expressionChange', this.expressionString);
  }

  /** 清空表达式 */
  clearExpression(): void {
    if (this._status !== 'playing') return;
    this._expression = [];
    this._cards.forEach((c) => (c.used = false));
    this.emit('expressionChange', '');
  }

  /** 提交表达式验证 */
  submitExpression(): ValidationResult {
    if (this._status !== 'playing') {
      return { valid: false, error: '游戏未在运行中' };
    }

    const exprStr = this.expressionString;
    const result = validateExpression(exprStr, this._cards);

    if (result.valid) {
      // 成功！
      this._streak++;
      const streakBonus = this._streak > 1 ? STREAK_BONUS * (this._streak - 1) : 0;
      const totalScore = BASE_SCORE + streakBonus;
      this.addScore(totalScore);
      this._roundsSolved++;

      // 时间奖励
      if (this._timeRemaining > 0) {
        this._timeRemaining += TIME_BONUS_FACTOR;
      }

      this._message = {
        text: `✓ 正确！+${totalScore} 分${streakBonus > 0 ? ` (连胜 x${this._streak})` : ''}`,
        color: SUCCESS_COLOR,
        timer: 2000,
      };
      this.emit('solveSuccess', { expression: exprStr, result: result.result });
      this.emit('roundsChange', this._roundsSolved);

      // 发新牌
      this.dealCards();
    } else {
      this._streak = 0;
      this._message = {
        text: `✗ ${result.error}`,
        color: ERROR_COLOR,
        timer: 2000,
      };
      this.emit('solveFail', result.error);
    }

    return result;
  }

  /** 使用提示 */
  useHint(): HintResult | null {
    if (this._status !== 'playing') return null;
    if (this._hintsUsed >= this._maxHints) {
      this._message = {
        text: '没有更多提示了',
        color: ERROR_COLOR,
        timer: 2000,
      };
      return null;
    }

    const values = this._cards.map((c) => c.value);
    const solution = solveMake24(values);
    if (solution === null) {
      this._message = {
        text: '这组牌无解，自动换牌',
        color: TIMER_WARNING_COLOR,
        timer: 2000,
      };
      this.addScore(-HINT_PENALTY);
      this._hintsUsed++;
      this.dealCards();
      return null;
    }

    this._hintsUsed++;
    this.addScore(-HINT_PENALTY);
    this._message = {
      text: `提示：${solution}（-${HINT_PENALTY} 分）`,
      color: TIMER_WARNING_COLOR,
      timer: 4000,
    };
    this.emit('hintUsed', { solution, hintsLeft: this._maxHints - this._hintsUsed });
    return { expression: solution, steps: [solution] };
  }

  /** 跳过当前轮 */
  skipRound(): void {
    if (this._status !== 'playing') return;
    this._streak = 0;
    this.addScore(-SKIP_PENALTY);
    this._message = {
      text: `已跳过（-${SKIP_PENALTY} 分），换一组新牌`,
      color: TIMER_WARNING_COLOR,
      timer: 1500,
    };
    this.emit('roundSkipped', this._cards.map((c) => c.value));
    this.dealCards();
  }

  // ========== 计时器 ==========

  private startTimer(): void {
    this.clearTimerInterval();
    this._timerInterval = setInterval(() => {
      if (this._status !== 'playing') return;
      this._timeRemaining--;
      this.emit('timeChange', this._timeRemaining);
      if (this._timeRemaining <= 0) {
        this._timeRemaining = 0;
        this.gameOver();
      }
    }, 1000);
  }

  private clearTimerInterval(): void {
    if (this._timerInterval !== null) {
      clearInterval(this._timerInterval);
      this._timerInterval = null;
    }
  }

  // ========== 渲染方法 ==========

  private renderHUD(ctx: CanvasRenderingContext2D, w: number): void {
    ctx.fillStyle = BOARD_COLOR;
    ctx.fillRect(0, 0, w, HUD_HEIGHT);

    ctx.fillStyle = TEXT_COLOR;
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${this._score}`, 16, 35);

    ctx.textAlign = 'center';
    ctx.fillText(`Round: ${this._roundsSolved + 1}`, w / 2, 35);

    ctx.textAlign = 'right';
    ctx.fillText(`Streak: ${this._streak}`, w - 16, 35);
    ctx.textAlign = 'left';
  }

  private renderCards(ctx: CanvasRenderingContext2D, _w: number): void {
    const totalWidth = CARD_COUNT * CARD_WIDTH + (CARD_COUNT - 1) * CARD_SPACING;
    const startX = (CANVAS_WIDTH - totalWidth) / 2;

    for (let i = 0; i < this._cards.length; i++) {
      const card = this._cards[i];
      const x = startX + i * (CARD_WIDTH + CARD_SPACING);
      const y = CARD_ROW_Y;

      // 卡片背景
      ctx.fillStyle = card.used ? CARD_USED_COLOR : CARD_BG_COLOR;
      ctx.beginPath();
      ctx.roundRect(x, y, CARD_WIDTH, CARD_HEIGHT, CARD_BORDER_RADIUS);
      ctx.fill();

      // 卡片边框
      ctx.strokeStyle = card.used ? HIGHLIGHT_COLOR : CARD_BORDER_COLOR;
      ctx.lineWidth = 2;
      ctx.stroke();

      // 数字
      ctx.fillStyle = card.used ? HIGHLIGHT_COLOR : CARD_TEXT_COLOR;
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(VALUE_DISPLAY[card.value] || String(card.value), x + CARD_WIDTH / 2, y + CARD_HEIGHT / 2 - 12);

      // 花色符号
      const suitSymbol = SUIT_SYMBOLS[card.suit] || '';
      const isRed = RED_SUITS.includes(card.suit);
      ctx.fillStyle = card.used ? HIGHLIGHT_COLOR : (isRed ? CARD_SUIT_RED : CARD_SUIT_BLACK);
      ctx.font = '20px serif';
      ctx.fillText(suitSymbol, x + CARD_WIDTH / 2, y + CARD_HEIGHT / 2 + 18);

      // 序号提示
      ctx.fillStyle = TEXT_COLOR;
      ctx.font = '12px monospace';
      ctx.fillText(`[${i + 1}]`, x + CARD_WIDTH / 2, y + CARD_HEIGHT - 10);
    }
    ctx.textBaseline = 'alphabetic';
  }

  private renderExpression(ctx: CanvasRenderingContext2D, w: number): void {
    const x = EXPRESSION_PADDING;
    const y = EXPRESSION_Y;
    const exprW = w - EXPRESSION_PADDING * 2;

    // 背景
    ctx.fillStyle = EXPRESSION_BG;
    ctx.beginPath();
    ctx.roundRect(x, y, exprW, EXPRESSION_HEIGHT, 6);
    ctx.fill();

    // 边框
    ctx.strokeStyle = EXPRESSION_BORDER;
    ctx.lineWidth = 1;
    ctx.stroke();

    // 表达式文字
    const text = this.expressionString;
    ctx.fillStyle = text ? TEXT_COLOR : HIGHLIGHT_COLOR;
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'left';
    const displayText = text || '点击牌和运算符构建表达式...';
    ctx.fillText(displayText, x + 12, y + EXPRESSION_HEIGHT / 2 + 7);

    // 光标
    if (this._cursorVisible && this._status === 'playing') {
      const textWidth = text ? ctx.measureText(text).width : 0;
      ctx.fillStyle = CURSOR_COLOR;
      ctx.fillRect(x + 14 + textWidth, y + 10, 2, EXPRESSION_HEIGHT - 20);
    }
  }

  private renderButtons(ctx: CanvasRenderingContext2D, _w: number): void {
    const buttons = [
      { label: '+', bg: OPERATOR_BG, text: OPERATOR_TEXT },
      { label: '-', bg: OPERATOR_BG, text: OPERATOR_TEXT },
      { label: '×', bg: OPERATOR_BG, text: OPERATOR_TEXT },
      { label: '÷', bg: OPERATOR_BG, text: OPERATOR_TEXT },
      { label: '(', bg: PAREN_BG, text: PAREN_TEXT },
      { label: ')', bg: PAREN_BG, text: PAREN_TEXT },
      { label: '提交', bg: SUBMIT_BG, text: SUBMIT_TEXT },
      { label: '提示', bg: HINT_BG, text: HINT_TEXT },
      { label: '清空', bg: CLEAR_BG, text: CLEAR_TEXT },
    ];
    const btnW = 46;
    const btnH = 36;
    const gap = 6;
    const cols = buttons.length;
    const totalW = cols * btnW + (cols - 1) * gap;
    const startX = (CANVAS_WIDTH - totalW) / 2;

    for (let i = 0; i < buttons.length; i++) {
      const x = startX + i * (btnW + gap);
      const y = BUTTON_ROW_Y;

      ctx.fillStyle = buttons[i].bg;
      ctx.beginPath();
      ctx.roundRect(x, y, btnW, btnH, 4);
      ctx.fill();

      ctx.fillStyle = buttons[i].text;
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(buttons[i].label, x + btnW / 2, y + btnH / 2 + 5);
    }
  }

  private renderTimer(ctx: CanvasRenderingContext2D, w: number): void {
    const config = DIFFICULTY_CONFIG[this._difficulty];
    if (config.timeLimit <= 0) return;

    const barX = EXPRESSION_PADDING;
    const barY = EXPRESSION_Y + EXPRESSION_HEIGHT + 16;
    const barW = w - EXPRESSION_PADDING * 2;
    const barH = 8;
    const ratio = Math.max(0, this._timeRemaining / config.timeLimit);

    ctx.fillStyle = HIGHLIGHT_COLOR;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 4);
    ctx.fill();

    const color = this._timeRemaining <= 10 ? TIMER_CRITICAL_COLOR
      : this._timeRemaining <= 30 ? TIMER_WARNING_COLOR
      : TIMER_COLOR;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW * ratio, barH, 4);
    ctx.fill();

    // 时间文字
    const minutes = Math.floor(Math.max(0, this._timeRemaining) / 60);
    const seconds = Math.max(0, this._timeRemaining) % 60;
    const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    ctx.fillStyle = color;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(timeStr, w / 2, barY + 24);
  }

  private renderMessage(ctx: CanvasRenderingContext2D, w: number): void {
    if (!this._message) return;
    ctx.fillStyle = this._message.color;
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(this._message.text, w / 2, MESSAGE_Y);
  }

  private renderGameOver(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = ERROR_COLOR;
    ctx.font = 'bold 40px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('TIME UP!', w / 2, h / 2 - 40);

    ctx.fillStyle = TEXT_COLOR;
    ctx.font = 'bold 24px monospace';
    ctx.fillText(`最终得分: ${this._score}`, w / 2, h / 2 + 10);

    ctx.font = '18px monospace';
    ctx.fillText(`完成轮数: ${this._roundsSolved}`, w / 2, h / 2 + 45);

    ctx.font = '14px monospace';
    ctx.fillStyle = HIGHLIGHT_COLOR;
    ctx.fillText('按 SPACE 或 ENTER 重新开始', w / 2, h / 2 + 80);
    ctx.textAlign = 'left';
  }
}
