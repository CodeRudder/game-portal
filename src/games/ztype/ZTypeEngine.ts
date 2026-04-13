import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  PADDING_TOP, PADDING_BOTTOM, PADDING_SIDE,
  WORD_FONT_SIZE, WORD_FONT_FAMILY,
  WORD_HIGHLIGHT_COLOR, WORD_NORMAL_COLOR, WORD_TYPED_COLOR,
  WORD_DESTROY_COLOR,
  INITIAL_LIVES, MAX_LIVES,
  BASE_SCORE_PER_LETTER, COMBO_MULTIPLIER_BONUS, MAX_COMBO_MULTIPLIER,
  INITIAL_FALL_SPEED, SPEED_INCREMENT_PER_LEVEL,
  INITIAL_SPAWN_INTERVAL, MIN_SPAWN_INTERVAL, SPAWN_INTERVAL_DECREASE,
  WORDS_PER_LEVEL, MAX_LEVEL,
  COMBO_TIMEOUT,
  HUD_HEIGHT, HUD_BG_COLOR, HUD_TEXT_COLOR,
  HUD_SCORE_COLOR, HUD_LIVES_COLOR, HUD_COMBO_COLOR, HUD_WPM_COLOR, HUD_LEVEL_COLOR,
  INPUT_DISPLAY_Y, INPUT_DISPLAY_COLOR, INPUT_CURSOR_COLOR,
  EXPLOSION_DURATION, EXPLOSION_PARTICLES,
  STAR_COUNT, STAR_MIN_SPEED, STAR_MAX_SPEED,
  WORD_LIST, WORD_TIERS,
  FallingWord, Particle, Star, ZTypeState,
} from './constants';

// ========== 辅助函数 ==========

/** 根据等级获取可用词库 */
export function getWordsForLevel(level: number): string[] {
  let maxLen = 4;
  for (const tier of WORD_TIERS) {
    if (level >= tier.minLevel) {
      maxLen = tier.maxLength;
    }
  }
  return WORD_LIST.filter(w => w.length <= maxLen);
}

/** 根据等级获取下落速度 */
export function getFallSpeed(level: number): number {
  return INITIAL_FALL_SPEED + (level - 1) * SPEED_INCREMENT_PER_LEVEL;
}

/** 根据等级获取生成间隔 */
export function getSpawnInterval(level: number): number {
  const interval = INITIAL_SPAWN_INTERVAL - (level - 1) * SPAWN_INTERVAL_DECREASE;
  return Math.max(MIN_SPAWN_INTERVAL, interval);
}

/** 计算连击倍率 */
export function calculateComboMultiplier(combo: number): number {
  if (combo <= 1) return 1.0;
  return Math.min(1.0 + (combo - 1) * COMBO_MULTIPLIER_BONUS, MAX_COMBO_MULTIPLIER);
}

/** 计算消灭单词得分 */
export function calculateWordScore(wordLength: number, combo: number): number {
  const base = wordLength * BASE_SCORE_PER_LETTER;
  const multiplier = calculateComboMultiplier(combo);
  return Math.round(base * multiplier);
}

/** 计算 WPM */
export function calculateWPM(totalTypedLetters: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  const minutes = elapsedMs / 60000;
  // 标准WPM: 每5个字符算一个"单词"
  const words = totalTypedLetters / 5;
  return Math.round(words / minutes);
}

/** 随机选取一个单词（排除已有单词） */
export function pickRandomWord(existingTexts: string[], level: number): string {
  const pool = getWordsForLevel(level);
  // 过滤掉屏幕上已有的单词，避免重复
  const available = pool.filter(w => !existingTexts.includes(w));
  const source = available.length > 0 ? available : pool;
  return source[Math.floor(Math.random() * source.length)];
}

/** 生成背景星星 */
export function createStars(): Star[] {
  const stars: Star[] = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    stars.push({
      x: Math.random() * CANVAS_WIDTH,
      y: Math.random() * CANVAS_HEIGHT,
      speed: STAR_MIN_SPEED + Math.random() * (STAR_MAX_SPEED - STAR_MIN_SPEED),
      size: 1 + Math.random() * 2,
      brightness: 0.3 + Math.random() * 0.7,
    });
  }
  return stars;
}

/** 生成爆炸粒子 */
export function createExplosionParticles(x: number, y: number, color: string): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < EXPLOSION_PARTICLES; i++) {
    const angle = (Math.PI * 2 * i) / EXPLOSION_PARTICLES + Math.random() * 0.5;
    const speed = 50 + Math.random() * 100;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1.0,
      maxLife: 1.0,
      color,
      size: 2 + Math.random() * 3,
    });
  }
  return particles;
}

// ========== ZType 游戏引擎 ==========

let nextWordId = 1;

export class ZTypeEngine extends GameEngine {
  // 游戏状态
  private words: FallingWord[] = [];
  private input: string = '';
  private lives: number = INITIAL_LIVES;
  private combo: number = 0;
  private maxCombo: number = 0;
  private comboMultiplier: number = 1.0;
  private wpm: number = 0;
  private totalTypedLetters: number = 0;
  private wordsDestroyed: number = 0;
  private lastSpawnTime: number = 0;
  private lastComboTime: number = 0;
  private gameStartTime: number = 0;
  private particles: Particle[] = [];
  private stars: Star[] = [];

  // ========== 属性访问器 ==========

  get currentInput(): string { return this.input; }
  get currentLives(): number { return this.lives; }
  get currentCombo(): number { return this.combo; }
  get currentMaxCombo(): number { return this.maxCombo; }
  get currentMultiplier(): number { return this.comboMultiplier; }
  get currentWpm(): number { return this.wpm; }
  get currentWordsDestroyed(): number { return this.wordsDestroyed; }
  get currentWords(): FallingWord[] { return [...this.words]; }
  get activeWord(): FallingWord | undefined {
    return this.words.find(w => w.active && !w.destroying);
  }

  // ========== 生命周期实现 ==========

  protected onInit(): void {
    this.stars = createStars();
  }

  protected onStart(): void {
    this.words = [];
    this.input = '';
    this.lives = INITIAL_LIVES;
    this.combo = 0;
    this.maxCombo = 0;
    this.comboMultiplier = 1.0;
    this.wpm = 0;
    this.totalTypedLetters = 0;
    this.wordsDestroyed = 0;
    this.lastSpawnTime = 0;
    this.lastComboTime = 0;
    this.particles = [];
    this.gameStartTime = Date.now();
    nextWordId = 1;
    // 立即生成第一个单词
    this.spawnWord();
  }

  protected update(deltaTime: number): void {
    const dt = deltaTime / 1000; // 转为秒
    const now = Date.now();

    // 更新 WPM
    const elapsed = now - this.gameStartTime;
    if (elapsed > 0) {
      this.wpm = calculateWPM(this.totalTypedLetters, elapsed);
    }

    // 连击超时检查
    if (this.combo > 0 && now - this.lastComboTime > COMBO_TIMEOUT) {
      this.combo = 0;
      this.comboMultiplier = 1.0;
    }

    // 生成新单词
    if (now - this.lastSpawnTime >= getSpawnInterval(this._level)) {
      this.spawnWord();
    }

    // 更新单词位置
    for (const word of this.words) {
      if (word.destroying) continue;
      word.y += word.speed * dt;

      // 单词到达底部
      if (word.y >= CANVAS_HEIGHT - PADDING_BOTTOM) {
        this.wordReachedBottom(word);
      }
    }

    // 更新粒子
    this.updateParticles(dt);

    // 清理已销毁的单词
    this.words = this.words.filter(w => {
      if (w.destroying) {
        return now - w.destroyTime < EXPLOSION_DURATION;
      }
      return w.y < CANVAS_HEIGHT + 50; // 超出屏幕的也清理
    });

    // 更新背景星星
    this.updateStars(dt);

    // 检查是否需要升级
    this.checkLevelUp();

    // 检查游戏结束
    if (this.lives <= 0) {
      this.gameOver();
    }
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, w, h);

    // 背景星星
    this.renderStars(ctx);

    // 单词
    this.renderWords(ctx);

    // 粒子
    this.renderParticles(ctx);

    // HUD
    this.renderHUD(ctx, w);

    // 输入显示
    this.renderInput(ctx, w);
  }

  handleKeyDown(key: string): void {
    if (this._status !== 'playing') return;

    if (key === 'Escape') {
      this.cancelInput();
      return;
    }

    if (key === 'Backspace') {
      this.deleteLetter();
      return;
    }

    // 只处理字母键
    if (/^[a-zA-Z]$/.test(key)) {
      this.typeLetter(key.toLowerCase());
    }
  }

  handleKeyUp(_key: string): void {
    // ZType 不需要 keyUp 处理
  }

  getState(): ZTypeState {
    return {
      words: [...this.words],
      input: this.input,
      score: this._score,
      lives: this.lives,
      level: this._level,
      combo: this.combo,
      maxCombo: this.maxCombo,
      comboMultiplier: this.comboMultiplier,
      wpm: this.wpm,
      totalTypedLetters: this.totalTypedLetters,
      wordsDestroyed: this.wordsDestroyed,
      gameStatus: this._status,
      lastSpawnTime: this.lastSpawnTime,
      lastComboTime: this.lastComboTime,
      startTime: this.gameStartTime,
      particles: [...this.particles],
      stars: [...this.stars],
    };
  }

  // ========== 核心逻辑 ==========

  /** 生成一个新单词 */
  private spawnWord(): void {
    const existingTexts = this.words.filter(w => !w.destroying).map(w => w.text);
    const text = pickRandomWord(existingTexts, this._level);
    const speed = getFallSpeed(this._level);

    // 随机 x 位置，确保单词不超出屏幕
    const textWidth = text.length * WORD_FONT_SIZE * 0.6;
    const minX = PADDING_SIDE + textWidth / 2;
    const maxX = CANVAS_WIDTH - PADDING_SIDE - textWidth / 2;
    const x = minX + Math.random() * (maxX - minX);

    const word: FallingWord = {
      id: nextWordId++,
      text,
      x,
      y: -WORD_FONT_SIZE, // 从屏幕上方开始
      speed,
      typed: 0,
      active: false,
      destroying: false,
      destroyTime: 0,
    };

    this.words.push(word);
    this.lastSpawnTime = Date.now();
  }

  /** 输入一个字母 */
  private typeLetter(letter: string): void {
    const newInput = this.input + letter;

    // 查找匹配的单词
    const matchingWord = this.findMatchingWord(newInput);

    if (matchingWord) {
      this.input = newInput;
      matchingWord.typed = newInput.length;
      matchingWord.active = true;

      // 取消其他单词的 active 状态
      for (const w of this.words) {
        if (w.id !== matchingWord.id) {
          w.active = false;
          w.typed = 0;
        }
      }

      // 检查是否完成整个单词
      if (newInput === matchingWord.text) {
        this.destroyWord(matchingWord);
      }

      this.totalTypedLetters++;
    }
    // 如果没有匹配的单词，输入被忽略
  }

  /** 删除一个字母 */
  private deleteLetter(): void {
    if (this.input.length === 0) return;

    this.input = this.input.slice(0, -1);

    // 更新当前活跃单词的匹配状态
    const active = this.activeWord;
    if (active) {
      active.typed = this.input.length;
      if (this.input.length === 0) {
        active.active = false;
      }
    }
  }

  /** 取消当前输入 */
  private cancelInput(): void {
    this.input = '';
    for (const w of this.words) {
      w.active = false;
      w.typed = 0;
    }
  }

  /** 查找匹配当前输入的单词 */
  private findMatchingWord(newInput: string): FallingWord | undefined {
    // 优先匹配已激活的单词
    const active = this.words.find(w => w.active && !w.destroying);
    if (active && active.text.startsWith(newInput)) {
      return active;
    }

    // 在所有未销毁的单词中查找匹配
    const candidates = this.words
      .filter(w => !w.destroying && w.text.startsWith(newInput))
      .sort((a, b) => a.y - b.y); // 优先匹配最靠近底部的（最危险的）

    return candidates[0] || undefined;
  }

  /** 消灭一个单词 */
  private destroyWord(word: FallingWord): void {
    word.destroying = true;
    word.destroyTime = Date.now();

    // 更新连击
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.comboMultiplier = calculateComboMultiplier(this.combo);
    this.lastComboTime = Date.now();

    // 计算得分
    const score = calculateWordScore(word.text.length, this.combo);
    this.addScore(score);

    // 统计
    this.wordsDestroyed++;

    // 生成爆炸粒子
    this.particles.push(...createExplosionParticles(word.x, word.y, WORD_HIGHLIGHT_COLOR));

    // 重置输入
    this.input = '';
  }

  /** 单词到达底部 */
  private wordReachedBottom(word: FallingWord): void {
    if (word.destroying) return;

    word.destroying = true;
    word.destroyTime = Date.now();

    // 失去一条命
    this.lives--;

    // 如果当前活跃单词被消灭，重置输入
    if (word.active) {
      this.input = '';
    }

    // 重置连击
    this.combo = 0;
    this.comboMultiplier = 1.0;

    // 红色爆炸粒子
    this.particles.push(...createExplosionParticles(word.x, word.y, WORD_DESTROY_COLOR));

    this.emit('stateChange');
  }

  /** 检查升级 */
  private checkLevelUp(): void {
    const newLevel = Math.min(Math.floor(this.wordsDestroyed / WORDS_PER_LEVEL) + 1, MAX_LEVEL);
    if (newLevel > this._level) {
      this.setLevel(newLevel);
    }
  }

  /** 更新粒子 */
  private updateParticles(dt: number): void {
    const now = Date.now();
    this.particles = this.particles.filter(p => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 100 * dt; // 重力
      p.life -= dt / (EXPLOSION_DURATION / 1000);
      return p.life > 0;
    });
  }

  /** 更新星星 */
  private updateStars(dt: number): void {
    for (const star of this.stars) {
      star.y += star.speed * dt;
      if (star.y > CANVAS_HEIGHT) {
        star.y = 0;
        star.x = Math.random() * CANVAS_WIDTH;
      }
    }
  }

  // ========== 渲染方法 ==========

  private renderStars(ctx: CanvasRenderingContext2D): void {
    for (const star of this.stars) {
      ctx.fillStyle = `rgba(255, 255, 255, ${star.brightness})`;
      ctx.fillRect(star.x, star.y, star.size, star.size);
    }
  }

  private renderWords(ctx: CanvasRenderingContext2D): void {
    ctx.font = `bold ${WORD_FONT_SIZE}px ${WORD_FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const word of this.words) {
      if (word.destroying) continue;

      const text = word.text.toUpperCase();
      const halfText = text.length / 2;
      const startX = word.x - halfText * (WORD_FONT_SIZE * 0.6);

      for (let i = 0; i < text.length; i++) {
        const charX = startX + i * (WORD_FONT_SIZE * 0.6);

        if (word.active && i < word.typed) {
          // 已输入的字母 - 黄色
          ctx.fillStyle = WORD_TYPED_COLOR;
        } else if (word.active) {
          // 活跃单词未输入部分 - 高亮绿色
          ctx.fillStyle = WORD_HIGHLIGHT_COLOR;
        } else {
          // 普通单词 - 白色
          ctx.fillStyle = WORD_NORMAL_COLOR;
        }

        ctx.fillText(text[i], charX, word.y);
      }

      // 活跃单词下划线
      if (word.active) {
        ctx.strokeStyle = WORD_HIGHLIGHT_COLOR;
        ctx.lineWidth = 2;
        const underlineY = word.y + WORD_FONT_SIZE / 2 + 2;
        ctx.beginPath();
        ctx.moveTo(startX - 5, underlineY);
        ctx.lineTo(startX + text.length * (WORD_FONT_SIZE * 0.6) - 5, underlineY);
        ctx.stroke();
      }
    }
  }

  private renderParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  private renderHUD(ctx: CanvasRenderingContext2D, w: number): void {
    // HUD 背景
    ctx.fillStyle = HUD_BG_COLOR;
    ctx.fillRect(0, 0, w, HUD_HEIGHT);

    // 分数
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = HUD_TEXT_COLOR;
    ctx.fillText('分数', 10, 18);
    ctx.fillStyle = HUD_SCORE_COLOR;
    ctx.fillText(String(this._score), 10, 38);

    // 等级
    ctx.fillStyle = HUD_TEXT_COLOR;
    ctx.fillText('等级', 100, 18);
    ctx.fillStyle = HUD_LEVEL_COLOR;
    ctx.fillText(String(this._level), 100, 38);

    // 生命
    ctx.fillStyle = HUD_TEXT_COLOR;
    ctx.fillText('生命', 180, 18);
    ctx.fillStyle = HUD_LIVES_COLOR;
    const livesText = '❤'.repeat(this.lives) + '♡'.repeat(MAX_LIVES - this.lives);
    ctx.fillText(livesText, 180, 38);

    // 连击
    if (this.combo > 0) {
      ctx.fillStyle = HUD_TEXT_COLOR;
      ctx.fillText('连击', 310, 18);
      ctx.fillStyle = HUD_COMBO_COLOR;
      ctx.fillText(`${this.combo}x${this.comboMultiplier.toFixed(1)}`, 310, 38);
    }

    // WPM
    ctx.fillStyle = HUD_TEXT_COLOR;
    ctx.textAlign = 'right';
    ctx.fillText('WPM', w - 10, 18);
    ctx.fillStyle = HUD_WPM_COLOR;
    ctx.fillText(String(this.wpm), w - 10, 38);
  }

  private renderInput(ctx: CanvasRenderingContext2D, w: number): void {
    if (this.input.length === 0) return;

    ctx.font = `bold 24px ${WORD_FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const text = this.input.toUpperCase();
    const textWidth = text.length * 24 * 0.6;
    const startX = w / 2 - textWidth / 2;

    for (let i = 0; i < text.length; i++) {
      const charX = startX + i * (24 * 0.6);
      ctx.fillStyle = INPUT_DISPLAY_COLOR;
      ctx.fillText(text[i], charX, INPUT_DISPLAY_Y);
    }

    // 光标
    ctx.fillStyle = INPUT_CURSOR_COLOR;
    const cursorX = startX + text.length * (24 * 0.6) + 2;
    ctx.fillRect(cursorX, INPUT_DISPLAY_Y - 10, 2, 20);
  }

  protected onReset(): void {
    this.words = [];
    this.input = '';
    this.lives = INITIAL_LIVES;
    this.combo = 0;
    this.maxCombo = 0;
    this.comboMultiplier = 1.0;
    this.wpm = 0;
    this.totalTypedLetters = 0;
    this.wordsDestroyed = 0;
    this.particles = [];
    this.lastSpawnTime = 0;
    this.lastComboTime = 0;
    this.gameStartTime = 0;
  }

  protected onGameOver(): void {
    // 游戏结束处理
  }
}
