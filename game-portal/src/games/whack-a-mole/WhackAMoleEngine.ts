import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  GRID_ROWS, GRID_COLS, TOTAL_HOLES,
  MOLE_APPEAR_DURATION, MOLE_STAY_DURATION_BASE, MOLE_STAY_DURATION_DECREASE_PER_LEVEL,
  MOLE_STAY_DURATION_MIN, MOLE_HIDE_DURATION,
  SPAWN_INTERVAL_BASE, SPAWN_INTERVAL_DECREASE_PER_LEVEL, SPAWN_INTERVAL_MIN,
  MAX_ACTIVE_MOLES_BASE, MAX_ACTIVE_MOLES_LEVEL_STEP, MAX_ACTIVE_MOLES_MAX,
  HIT_SCORE_BASE, HIT_SCORE_PER_LEVEL, COMBO_BONUS,
  GAME_DURATION, LEVEL_UP_SCORE, MAX_LEVEL,
  MoleState,
  BG_COLOR, HOLE_COLOR, HOLE_RIM_COLOR, MOLE_COLOR, MOLE_FACE_COLOR,
  MOLE_WHACKED_COLOR, HUD_COLOR, HUD_BG_COLOR, CURSOR_COLOR, SCORE_POPUP_COLOR, GRASS_COLOR,
  HUD_HEIGHT, GRID_PADDING_X, GRID_PADDING_Y, HOLE_RADIUS, MOLE_RADIUS, CURSOR_RADIUS,
  KEY_HOLE_MAP, DIRECTION_KEYS,
} from './constants';

// ========== 地鼠数据结构 ==========
export interface MoleData {
  /** 洞位索引 0-8 */
  index: number;
  /** 当前状态 */
  state: MoleState;
  /** 当前状态已持续时间（毫秒） */
  stateTimer: number;
  /** 该地鼠是否已被击中（防止重复击中） */
  whacked: boolean;
}

// ========== 得分弹出 ==========
interface ScorePopup {
  x: number;
  y: number;
  text: string;
  timer: number;
  duration: number;
}

// ========== 洞位坐标 ==========
interface HolePosition {
  x: number;
  y: number;
}

export class WhackAMoleEngine extends GameEngine {
  // ========== 地鼠状态 ==========
  private _holes: MoleData[] = [];
  private _holePositions: HolePosition[] = [];

  // ========== 光标 ==========
  private _cursorIndex: number = 4; // 默认在中心

  // ========== 生成控制 ==========
  private _spawnTimer: number = 0;
  private _gameTimer: number = 0; // 剩余时间（毫秒）

  // ========== 连击 ==========
  private _combo: number = 0;
  private _maxCombo: number = 0;
  private _totalHits: number = 0;
  private _totalMisses: number = 0;
  private _totalMolesSpawned: number = 0;

  // ========== 得分弹出 ==========
  private _scorePopups: ScorePopup[] = [];

  // ========== 输入状态 ==========
  private _directionPressed: Set<string> = new Set();

  // ========== Public Getters ==========

  get cursorIndex(): number { return this._cursorIndex; }
  get combo(): number { return this._combo; }
  get maxCombo(): number { return this._maxCombo; }
  get totalHits(): number { return this._totalHits; }
  get totalMisses(): number { return this._totalMisses; }
  get totalMolesSpawned(): number { return this._totalMolesSpawned; }
  get remainingTime(): number { return Math.max(0, this._gameTimer / 1000); }
  get holes(): ReadonlyArray<MoleData> { return this._holes; }

  // ========== GameEngine Abstract Methods ==========

  protected onInit(): void {
    this._initHolePositions();
    this._initHoles();
  }

  protected onStart(): void {
    this._initHoles();
    this._cursorIndex = 4;
    this._spawnTimer = 0;
    this._gameTimer = GAME_DURATION * 1000;
    this._combo = 0;
    this._maxCombo = 0;
    this._totalHits = 0;
    this._totalMisses = 0;
    this._totalMolesSpawned = 0;
    this._scorePopups = [];
    this._directionPressed.clear();
  }

  protected update(deltaTime: number): void {
    // 更新游戏计时器
    this._gameTimer -= deltaTime;
    if (this._gameTimer <= 0) {
      this._gameTimer = 0;
      this.gameOver();
      return;
    }

    // 更新地鼠状态
    this._updateMoles(deltaTime);

    // 生成新地鼠
    this._spawnTimer -= deltaTime;
    if (this._spawnTimer <= 0) {
      this._trySpawnMole();
      this._spawnTimer = this._getSpawnInterval();
    }

    // 更新得分弹出
    this._updateScorePopups(deltaTime);

    // 检查等级
    this._checkLevelUp();
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // 草地纹理
    ctx.fillStyle = GRASS_COLOR;
    ctx.fillRect(0, HUD_HEIGHT, w, h - HUD_HEIGHT);

    // HUD
    this._renderHUD(ctx, w);

    // 洞和地鼠
    this._renderHoles(ctx);

    // 光标
    this._renderCursor(ctx);

    // 得分弹出
    this._renderScorePopups(ctx);

    // 游戏结束画面
    if (this._status === 'gameover') {
      this._renderGameOver(ctx, w, h);
    }
  }

  protected onReset(): void {
    this._initHoles();
    this._cursorIndex = 4;
    this._spawnTimer = 0;
    this._gameTimer = GAME_DURATION * 1000;
    this._combo = 0;
    this._maxCombo = 0;
    this._totalHits = 0;
    this._totalMisses = 0;
    this._totalMolesSpawned = 0;
    this._scorePopups = [];
    this._directionPressed.clear();
  }

  protected onGameOver(): void {
    // 游戏结束时的处理
  }

  handleKeyDown(key: string): void {
    // 空格/回车在 idle/gameover 状态下启动/重启游戏
    if (key === ' ' || key === 'Space' || key === 'Enter') {
      if (this._status === 'idle') {
        this.start();
        return;
      }
      if (this._status === 'gameover') {
        this.reset();
        this.start();
        return;
      }
    }

    // 游戏中的操作
    if (this._status !== 'playing') return;

    // 数字键 1-9 直接敲击对应洞位
    if (key in KEY_HOLE_MAP) {
      const holeIndex = KEY_HOLE_MAP[key];
      this._cursorIndex = holeIndex;
      this._whack(holeIndex);
      return;
    }

    // 方向键移动光标
    if (DIRECTION_KEYS.UP.includes(key)) {
      this._moveCursor(-GRID_COLS);
      this._directionPressed.add('up');
    } else if (DIRECTION_KEYS.DOWN.includes(key)) {
      this._moveCursor(GRID_COLS);
      this._directionPressed.add('down');
    } else if (DIRECTION_KEYS.LEFT.includes(key)) {
      this._moveCursor(-1);
      this._directionPressed.add('left');
    } else if (DIRECTION_KEYS.RIGHT.includes(key)) {
      this._moveCursor(1);
      this._directionPressed.add('right');
    }

    // 空格/回车在 playing 状态下敲击当前位置
    if (key === ' ' || key === 'Space' || key === 'Enter') {
      this._whack(this._cursorIndex);
    }
  }

  handleKeyUp(key: string): void {
    if (DIRECTION_KEYS.UP.includes(key)) this._directionPressed.delete('up');
    else if (DIRECTION_KEYS.DOWN.includes(key)) this._directionPressed.delete('down');
    else if (DIRECTION_KEYS.LEFT.includes(key)) this._directionPressed.delete('left');
    else if (DIRECTION_KEYS.RIGHT.includes(key)) this._directionPressed.delete('right');
  }

  getState(): Record<string, unknown> {
    return {
      score: this._score,
      level: this._level,
      status: this._status,
      cursorIndex: this._cursorIndex,
      combo: this._combo,
      maxCombo: this._maxCombo,
      totalHits: this._totalHits,
      totalMisses: this._totalMisses,
      totalMolesSpawned: this._totalMolesSpawned,
      remainingTime: this.remainingTime,
      holes: this._holes.map(h => ({ ...h })),
    };
  }

  // ========== Private Methods ==========

  /** 初始化洞位坐标 */
  private _initHolePositions(): void {
    this._holePositions = [];
    const gridWidth = CANVAS_WIDTH - GRID_PADDING_X * 2;
    const gridHeight = CANVAS_HEIGHT - HUD_HEIGHT - GRID_PADDING_Y * 2;
    const cellWidth = gridWidth / GRID_COLS;
    const cellHeight = gridHeight / GRID_ROWS;

    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        this._holePositions.push({
          x: GRID_PADDING_X + col * cellWidth + cellWidth / 2,
          y: HUD_HEIGHT + GRID_PADDING_Y + row * cellHeight + cellHeight / 2,
        });
      }
    }
  }

  /** 初始化所有洞位 */
  private _initHoles(): void {
    this._holes = [];
    for (let i = 0; i < TOTAL_HOLES; i++) {
      this._holes.push({
        index: i,
        state: MoleState.HIDDEN,
        stateTimer: 0,
        whacked: false,
      });
    }
  }

  /** 获取当前等级的地鼠停留时长 */
  private _getStayDuration(): number {
    return Math.max(
      MOLE_STAY_DURATION_MIN,
      MOLE_STAY_DURATION_BASE - (this._level - 1) * MOLE_STAY_DURATION_DECREASE_PER_LEVEL
    );
  }

  /** 获取当前等级的生成间隔 */
  private _getSpawnInterval(): number {
    return Math.max(
      SPAWN_INTERVAL_MIN,
      SPAWN_INTERVAL_BASE - (this._level - 1) * SPAWN_INTERVAL_DECREASE_PER_LEVEL
    );
  }

  /** 获取当前等级最大同时出现地鼠数 */
  private _getMaxActiveMoles(): number {
    const extra = Math.floor((this._level - 1) / MAX_ACTIVE_MOLES_LEVEL_STEP);
    return Math.min(MAX_ACTIVE_MOLES_MAX, MAX_ACTIVE_MOLES_BASE + extra);
  }

  /** 获取当前等级的击中分数 */
  private _getHitScore(): number {
    return HIT_SCORE_BASE + (this._level - 1) * HIT_SCORE_PER_LEVEL;
  }

  /** 更新所有地鼠状态 */
  private _updateMoles(deltaTime: number): void {
    const stayDuration = this._getStayDuration();

    for (const mole of this._holes) {
      if (mole.state === MoleState.HIDDEN) continue;

      mole.stateTimer += deltaTime;

      switch (mole.state) {
        case MoleState.APPEARING:
          if (mole.stateTimer >= MOLE_APPEAR_DURATION) {
            mole.state = MoleState.VISIBLE;
            mole.stateTimer = 0;
          }
          break;

        case MoleState.VISIBLE:
          if (mole.stateTimer >= stayDuration) {
            mole.state = MoleState.HIDING;
            mole.stateTimer = 0;
            // 地鼠逃跑，重置连击
            this._combo = 0;
          }
          break;

        case MoleState.HIDING:
          if (mole.stateTimer >= MOLE_HIDE_DURATION) {
            this._resetMole(mole);
          }
          break;

        case MoleState.WHACKED:
          if (mole.stateTimer >= MOLE_HIDE_DURATION) {
            this._resetMole(mole);
          }
          break;
      }
    }
  }

  /** 尝试生成新地鼠 */
  private _trySpawnMole(): void {
    const activeMoles = this._holes.filter(
      m => m.state !== MoleState.HIDDEN
    ).length;

    if (activeMoles >= this._getMaxActiveMoles()) return;

    // 收集可用洞位
    const availableHoles = this._holes.filter(m => m.state === MoleState.HIDDEN);
    if (availableHoles.length === 0) return;

    // 随机选一个
    const randomIndex = Math.floor(Math.random() * availableHoles.length);
    const mole = availableHoles[randomIndex];
    mole.state = MoleState.APPEARING;
    mole.stateTimer = 0;
    mole.whacked = false;
    this._totalMolesSpawned++;
  }

  /** 敲击指定洞位 */
  private _whack(holeIndex: number): void {
    if (holeIndex < 0 || holeIndex >= TOTAL_HOLES) return;

    const mole = this._holes[holeIndex];

    // 只有出现中或可见状态的地鼠才能被击中
    if (
      mole.state === MoleState.APPEARING ||
      mole.state === MoleState.VISIBLE
    ) {
      // 命中！
      mole.state = MoleState.WHACKED;
      mole.stateTimer = 0;
      mole.whacked = true;

      // 计算得分
      this._combo++;
      if (this._combo > this._maxCombo) {
        this._maxCombo = this._combo;
      }
      this._totalHits++;

      const baseScore = this._getHitScore();
      const comboBonus = Math.max(0, (this._combo - 1)) * COMBO_BONUS;
      const totalPoints = baseScore + comboBonus;
      this.addScore(totalPoints);

      // 添加得分弹出
      const pos = this._holePositions[holeIndex];
      this._scorePopups.push({
        x: pos.x,
        y: pos.y - 20,
        text: `+${totalPoints}${comboBonus > 0 ? ` x${this._combo}` : ''}`,
        timer: 0,
        duration: 800,
      });

      this.emit('hit', { holeIndex, combo: this._combo, score: totalPoints });
    } else {
      // Miss
      this._totalMisses++;
      this._combo = 0;
      this.emit('miss', { holeIndex });
    }
  }

  /** 移动光标 */
  private _moveCursor(delta: number): void {
    const newIndex = this._cursorIndex + delta;

    // 计算当前行列
    const currentRow = Math.floor(this._cursorIndex / GRID_COLS);
    const currentCol = this._cursorIndex % GRID_COLS;

    let targetRow = currentRow;
    let targetCol = currentCol;

    if (delta === -GRID_COLS) {
      // 上移
      targetRow = currentRow - 1;
    } else if (delta === GRID_COLS) {
      // 下移
      targetRow = currentRow + 1;
    } else if (delta === -1) {
      // 左移
      targetCol = currentCol - 1;
    } else if (delta === 1) {
      // 右移
      targetCol = currentCol + 1;
    }

    // 边界检查
    if (targetRow >= 0 && targetRow < GRID_ROWS && targetCol >= 0 && targetCol < GRID_COLS) {
      this._cursorIndex = targetRow * GRID_COLS + targetCol;
    }
  }

  /** 重置单个地鼠 */
  private _resetMole(mole: MoleData): void {
    mole.state = MoleState.HIDDEN;
    mole.stateTimer = 0;
    mole.whacked = false;
  }

  /** 更新得分弹出 */
  private _updateScorePopups(deltaTime: number): void {
    for (let i = this._scorePopups.length - 1; i >= 0; i--) {
      const popup = this._scorePopups[i];
      popup.timer += deltaTime;
      popup.y -= deltaTime * 0.03; // 向上飘
      if (popup.timer >= popup.duration) {
        this._scorePopups.splice(i, 1);
      }
    }
  }

  /** 检查是否升级 */
  private _checkLevelUp(): void {
    const newLevel = Math.min(MAX_LEVEL, Math.floor(this._score / LEVEL_UP_SCORE) + 1);
    if (newLevel > this._level) {
      this.setLevel(newLevel);
      this.emit('levelUp', newLevel);
    }
  }

  // ========== 渲染方法 ==========

  private _renderHUD(ctx: CanvasRenderingContext2D, w: number): void {
    // HUD 背景
    ctx.fillStyle = HUD_BG_COLOR;
    ctx.fillRect(0, 0, w, HUD_HEIGHT);

    // 分数
    ctx.fillStyle = HUD_COLOR;
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${this._score}`, 10, 25);

    // 等级
    ctx.textAlign = 'center';
    ctx.fillText(`Lv.${this._level}`, w / 2, 25);

    // 时间
    ctx.textAlign = 'right';
    const timeStr = Math.ceil(this.remainingTime).toString();
    ctx.fillText(`${timeStr}s`, w - 10, 25);

    // 连击
    if (this._combo > 1) {
      ctx.fillStyle = SCORE_POPUP_COLOR;
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`Combo x${this._combo}`, w / 2, 48);
    }

    ctx.textAlign = 'left';
  }

  private _renderHoles(ctx: CanvasRenderingContext2D): void {
    for (let i = 0; i < TOTAL_HOLES; i++) {
      const pos = this._holePositions[i];
      const mole = this._holes[i];

      // 洞（椭圆）
      ctx.fillStyle = HOLE_COLOR;
      ctx.beginPath();
      ctx.ellipse(pos.x, pos.y, HOLE_RADIUS, HOLE_RADIUS * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();

      // 洞边缘
      ctx.strokeStyle = HOLE_RIM_COLOR;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(pos.x, pos.y, HOLE_RADIUS, HOLE_RADIUS * 0.6, 0, 0, Math.PI * 2);
      ctx.stroke();

      // 地鼠
      if (mole.state !== MoleState.HIDDEN) {
        this._renderMole(ctx, pos, mole);
      }
    }
  }

  private _renderMole(ctx: CanvasRenderingContext2D, pos: HolePosition, mole: MoleData): void {
    // 计算地鼠偏移（出现/隐藏动画）
    let offsetY = 0;
    let scale = 1;

    switch (mole.state) {
      case MoleState.APPEARING: {
        const progress = Math.min(1, mole.stateTimer / MOLE_APPEAR_DURATION);
        offsetY = (1 - progress) * MOLE_RADIUS * 2;
        scale = 0.5 + progress * 0.5;
        break;
      }
      case MoleState.VISIBLE:
        offsetY = 0;
        scale = 1;
        break;
      case MoleState.HIDING: {
        const progress = Math.min(1, mole.stateTimer / MOLE_HIDE_DURATION);
        offsetY = progress * MOLE_RADIUS * 2;
        scale = 1 - progress * 0.5;
        break;
      }
      case MoleState.WHACKED: {
        const progress = Math.min(1, mole.stateTimer / MOLE_HIDE_DURATION);
        offsetY = progress * MOLE_RADIUS * 2;
        scale = 1 - progress * 0.3;
        break;
      }
    }

    const moleY = pos.y - MOLE_RADIUS + offsetY;

    ctx.save();
    ctx.translate(pos.x, moleY);
    ctx.scale(scale, scale);

    // 身体
    ctx.fillStyle = mole.state === MoleState.WHACKED ? MOLE_WHACKED_COLOR : MOLE_COLOR;
    ctx.beginPath();
    ctx.arc(0, 0, MOLE_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // 脸
    ctx.fillStyle = MOLE_FACE_COLOR;
    ctx.beginPath();
    ctx.arc(0, 2, MOLE_RADIUS * 0.7, 0, Math.PI * 2);
    ctx.fill();

    // 眼睛
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(-8, -5, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(8, -5, 4, 0, Math.PI * 2);
    ctx.fill();

    // 被击中时画 X 眼
    if (mole.state === MoleState.WHACKED) {
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      // 左眼 X
      ctx.beginPath();
      ctx.moveTo(-11, -8); ctx.lineTo(-5, -2);
      ctx.moveTo(-5, -8); ctx.lineTo(-11, -2);
      ctx.stroke();
      // 右眼 X
      ctx.beginPath();
      ctx.moveTo(5, -8); ctx.lineTo(11, -2);
      ctx.moveTo(11, -8); ctx.lineTo(5, -2);
      ctx.stroke();
    } else {
      // 眼睛高光
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(-6, -7, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(10, -7, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // 鼻子
    ctx.fillStyle = '#FF69B4';
    ctx.beginPath();
    ctx.arc(0, 2, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private _renderCursor(ctx: CanvasRenderingContext2D): void {
    if (this._status !== 'playing') return;

    const pos = this._holePositions[this._cursorIndex];
    if (!pos) return;

    ctx.strokeStyle = CURSOR_COLOR;
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, CURSOR_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 锤子图标（简化为十字准星）
    ctx.strokeStyle = CURSOR_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pos.x - 10, pos.y);
    ctx.lineTo(pos.x + 10, pos.y);
    ctx.moveTo(pos.x, pos.y - 10);
    ctx.lineTo(pos.x, pos.y + 10);
    ctx.stroke();
  }

  private _renderScorePopups(ctx: CanvasRenderingContext2D): void {
    for (const popup of this._scorePopups) {
      const alpha = 1 - popup.timer / popup.duration;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = SCORE_POPUP_COLOR;
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(popup.text, popup.x, popup.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  private _renderGameOver(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 半透明遮罩
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, w, h);

    // Game Over 文字
    ctx.fillStyle = '#FF6347';
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('TIME UP!', w / 2, h / 2 - 60);

    ctx.fillStyle = HUD_COLOR;
    ctx.font = 'bold 24px monospace';
    ctx.fillText(`Score: ${this._score}`, w / 2, h / 2 - 10);
    ctx.fillText(`Level: ${this._level}`, w / 2, h / 2 + 25);
    ctx.fillText(`Hits: ${this._totalHits}`, w / 2, h / 2 + 60);
    ctx.fillText(`Max Combo: ${this._maxCombo}`, w / 2, h / 2 + 95);

    ctx.font = '16px monospace';
    ctx.fillStyle = '#aaa';
    ctx.fillText('Press SPACE to restart', w / 2, h / 2 + 140);

    ctx.textAlign = 'left';
  }
}
