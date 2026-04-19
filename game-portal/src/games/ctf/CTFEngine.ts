import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  FIELD_LEFT, FIELD_RIGHT, FIELD_TOP, FIELD_BOTTOM,
  CENTER_X,
  BASE_WIDTH, BASE_HEIGHT,
  RED_BASE_X, RED_BASE_Y,
  BLUE_BASE_X, BLUE_BASE_Y,
  RED_FLAG_HOME_X, RED_FLAG_HOME_Y,
  BLUE_FLAG_HOME_X, BLUE_FLAG_HOME_Y,
  PLAYER_SIZE, PLAYER_SPEED,
  RED_START_X, RED_START_Y,
  BLUE_START_X, BLUE_START_Y,
  FLAG_SIZE,
  WIN_SCORE,
  AI_SPEED, AI_THINK_INTERVAL,
  OBSTACLES,
  BG_COLOR, FIELD_COLOR,
  RED_BASE_COLOR, BLUE_BASE_COLOR,
  OBSTACLE_COLOR,
  RED_FLAG_COLOR, BLUE_FLAG_COLOR,
  SCORE_COLOR, CENTER_LINE_COLOR,
  PLAYER_COLOR_RED, PLAYER_COLOR_BLUE,
  FLAG_POLE_HEIGHT,
} from './constants';
import type { Obstacle } from './constants';

// ========== 数据结构 ==========

interface Position {
  x: number;
  y: number;
}

interface FlagState {
  x: number;
  y: number;
  carrier: 'red' | 'blue' | null; // 谁持有这面旗帜
  atHome: boolean;
}

interface PlayerState {
  x: number;
  y: number;
  hasFlag: boolean; // 是否持有对方旗帜
}

// ========== CTF 引擎 ==========

export class CTFEngine extends GameEngine {
  // 玩家（红队）
  private _redPlayer: PlayerState = {
    x: RED_START_X,
    y: RED_START_Y,
    hasFlag: false,
  };

  // AI（蓝队）
  private _bluePlayer: PlayerState = {
    x: BLUE_START_X,
    y: BLUE_START_Y,
    hasFlag: false,
  };

  // 旗帜
  private _redFlag: FlagState = {
    x: RED_FLAG_HOME_X,
    y: RED_FLAG_HOME_Y,
    carrier: null,
    atHome: true,
  };

  private _blueFlag: FlagState = {
    x: BLUE_FLAG_HOME_X,
    y: BLUE_FLAG_HOME_Y,
    carrier: null,
    atHome: true,
  };

  // 分数
  private _redScore: number = 0;
  private _blueScore: number = 0;

  // 输入状态
  private _upPressed: boolean = false;
  private _downPressed: boolean = false;
  private _leftPressed: boolean = false;
  private _rightPressed: boolean = false;

  // AI 状态
  private _aiTimer: number = 0;
  private _aiTarget: Position = { x: BLUE_START_X, y: BLUE_START_Y };

  // 胜利
  private _isWin: boolean = false;

  // ========== Public Getters ==========

  get redScore(): number { return this._redScore; }
  get blueScore(): number { return this._blueScore; }
  get isWin(): boolean { return this._isWin; }

  get redPlayerX(): number { return this._redPlayer.x; }
  get redPlayerY(): number { return this._redPlayer.y; }
  get redPlayerHasFlag(): boolean { return this._redPlayer.hasFlag; }

  get bluePlayerX(): number { return this._bluePlayer.x; }
  get bluePlayerY(): number { return this._bluePlayer.y; }
  get bluePlayerHasFlag(): boolean { return this._bluePlayer.hasFlag; }

  get redFlagX(): number { return this._redFlag.x; }
  get redFlagY(): number { return this._redFlag.y; }
  get redFlagAtHome(): boolean { return this._redFlag.atHome; }
  get redFlagCarrier(): 'red' | 'blue' | null { return this._redFlag.carrier; }

  get blueFlagX(): number { return this._blueFlag.x; }
  get blueFlagY(): number { return this._blueFlag.y; }
  get blueFlagAtHome(): boolean { return this._blueFlag.atHome; }
  get blueFlagCarrier(): 'red' | 'blue' | null { return this._blueFlag.carrier; }

  get aiTargetX(): number { return this._aiTarget.x; }
  get aiTargetY(): number { return this._aiTarget.y; }

  // ========== GameEngine 抽象方法实现 ==========

  protected onInit(): void {
    this.resetPositions();
  }

  protected onStart(): void {
    this._redScore = 0;
    this._blueScore = 0;
    this._upPressed = false;
    this._downPressed = false;
    this._leftPressed = false;
    this._rightPressed = false;
    this._isWin = false;
    this._aiTimer = 0;
    this._aiTarget = { x: BLUE_START_X, y: BLUE_START_Y };
    this.resetPositions();
  }

  protected update(deltaTime: number): void {
    // 移动红队玩家
    this.moveRedPlayer();

    // 移动蓝队 AI
    this.updateAI(deltaTime);
    this.moveBluePlayer();

    // 更新旗帜位置（跟随携带者）
    this.updateFlagPositions();

    // 检查抢旗
    this.checkGrabFlag();

    // 检查归还旗帜（得分）
    this.checkReturnFlag();

    // 检查碰撞对抗（夺回旗帜）
    this.checkConfrontation();

    // 检查胜利
    this.checkWin();
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // 场地
    ctx.fillStyle = FIELD_COLOR;
    ctx.fillRect(FIELD_LEFT, FIELD_TOP, FIELD_RIGHT - FIELD_LEFT, FIELD_BOTTOM - FIELD_TOP);

    // 中线
    ctx.strokeStyle = CENTER_LINE_COLOR;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(CENTER_X, FIELD_TOP);
    ctx.lineTo(CENTER_X, FIELD_BOTTOM);
    ctx.stroke();
    ctx.setLineDash([]);

    // 红队基地
    ctx.fillStyle = RED_BASE_COLOR;
    ctx.fillRect(RED_BASE_X, RED_BASE_Y, BASE_WIDTH, BASE_HEIGHT);
    ctx.strokeStyle = 'rgba(239, 83, 80, 0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(RED_BASE_X, RED_BASE_Y, BASE_WIDTH, BASE_HEIGHT);

    // 蓝队基地
    ctx.fillStyle = BLUE_BASE_COLOR;
    ctx.fillRect(BLUE_BASE_X, BLUE_BASE_Y, BASE_WIDTH, BASE_HEIGHT);
    ctx.strokeStyle = 'rgba(66, 165, 245, 0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(BLUE_BASE_X, BLUE_BASE_Y, BASE_WIDTH, BASE_HEIGHT);

    // 障碍物
    ctx.fillStyle = OBSTACLE_COLOR;
    for (const obs of OBSTACLES) {
      ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
    }

    // 旗帜
    this.renderFlag(ctx, this._redFlag, RED_FLAG_COLOR);
    this.renderFlag(ctx, this._blueFlag, BLUE_FLAG_COLOR);

    // 红队玩家
    this.renderPlayer(ctx, this._redPlayer, PLAYER_COLOR_RED, 'R');

    // 蓝队玩家
    this.renderPlayer(ctx, this._bluePlayer, PLAYER_COLOR_BLUE, 'B');

    // 分数显示
    ctx.fillStyle = SCORE_COLOR;
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`RED ${this._redScore} : ${this._blueScore} BLUE`, w / 2, 30);

    // 操作提示（仅 idle 状态）
    if (this._status === 'idle') {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = SCORE_COLOR;
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('🚩 抢旗大战', w / 2, h / 2 - 30);
      ctx.font = '16px monospace';
      ctx.fillText('方向键移动 · 空格抢旗/释放', w / 2, h / 2 + 10);
      ctx.fillText(`先得 ${WIN_SCORE} 分获胜`, w / 2, h / 2 + 35);
      ctx.textAlign = 'left';
    }

    // 胜利/失败提示
    if (this._status === 'gameover') {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = this._isWin ? '#66bb6a' : '#ef5350';
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(this._isWin ? 'YOU WIN!' : 'YOU LOSE', w / 2, h / 2 - 10);
      ctx.font = '20px monospace';
      ctx.fillStyle = SCORE_COLOR;
      ctx.fillText(`${this._redScore} : ${this._blueScore}`, w / 2, h / 2 + 30);
      ctx.font = '14px monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText('Press Space to restart', w / 2, h / 2 + 60);
      ctx.textAlign = 'left';
    }
  }

  protected onReset(): void {
    this._redScore = 0;
    this._blueScore = 0;
    this._upPressed = false;
    this._downPressed = false;
    this._leftPressed = false;
    this._rightPressed = false;
    this._isWin = false;
    this._aiTimer = 0;
    this._aiTarget = { x: BLUE_START_X, y: BLUE_START_Y };
    this.resetPositions();
  }

  protected onGameOver(): void {}

  handleKeyDown(key: string): void {
    if (key === 'ArrowUp' || key === 'w' || key === 'W') this._upPressed = true;
    if (key === 'ArrowDown' || key === 's' || key === 'S') this._downPressed = true;
    if (key === 'ArrowLeft' || key === 'a' || key === 'A') this._leftPressed = true;
    if (key === 'ArrowRight' || key === 'd' || key === 'D') this._rightPressed = true;

    if (key === ' ' || key === 'Space') {
      if (this._status === 'idle') {
        this.start();
      } else if (this._status === 'gameover') {
        this.reset();
        this.start();
      } else if (this._status === 'playing') {
        this.handleAction();
      }
    }
  }

  handleKeyUp(key: string): void {
    if (key === 'ArrowUp' || key === 'w' || key === 'W') this._upPressed = false;
    if (key === 'ArrowDown' || key === 's' || key === 'S') this._downPressed = false;
    if (key === 'ArrowLeft' || key === 'a' || key === 'A') this._leftPressed = false;
    if (key === 'ArrowRight' || key === 'd' || key === 'D') this._rightPressed = false;
  }

  getState(): Record<string, unknown> {
    return {
      score: this._score,
      level: this._level,
      redScore: this._redScore,
      blueScore: this._blueScore,
      redPlayer: { ...this._redPlayer },
      bluePlayer: { ...this._bluePlayer },
      redFlag: { ...this._redFlag },
      blueFlag: { ...this._blueFlag },
      isWin: this._isWin,
    };
  }

  // ========== 公开辅助方法（供测试和外部调用） ==========

  /** 重置位置（不重置分数） */
  resetPositions(): void {
    this._redPlayer = { x: RED_START_X, y: RED_START_Y, hasFlag: false };
    this._bluePlayer = { x: BLUE_START_X, y: BLUE_START_Y, hasFlag: false };
    this._redFlag = { x: RED_FLAG_HOME_X, y: RED_FLAG_HOME_Y, carrier: null, atHome: true };
    this._blueFlag = { x: BLUE_FLAG_HOME_X, y: BLUE_FLAG_HOME_Y, carrier: null, atHome: true };
  }

  /** 处理空格键动作：抢旗或释放旗帜 */
  handleAction(): void {
    // 红队玩家尝试抢旗
    if (!this._redPlayer.hasFlag) {
      // 尝试抢蓝旗
      if (this._blueFlag.atHome && this.isNearBlueFlag(this._redPlayer)) {
        this._blueFlag.carrier = 'red';
        this._blueFlag.atHome = false;
        this._redPlayer.hasFlag = true;
      }
    } else {
      // 红队玩家已持有蓝旗，尝试释放（放回蓝旗原位附近）
      this._blueFlag.carrier = null;
      this._blueFlag.x = this._redPlayer.x;
      this._blueFlag.y = this._redPlayer.y;
      this._redPlayer.hasFlag = false;
    }
  }

  // ========== 私有方法 ==========

  /** 移动红队玩家 */
  private moveRedPlayer(): void {
    let newX = this._redPlayer.x;
    let newY = this._redPlayer.y;

    if (this._upPressed) newY -= PLAYER_SPEED;
    if (this._downPressed) newY += PLAYER_SPEED;
    if (this._leftPressed) newX -= PLAYER_SPEED;
    if (this._rightPressed) newX += PLAYER_SPEED;

    // 边界限制
    newX = Math.max(FIELD_LEFT + PLAYER_SIZE / 2, Math.min(FIELD_RIGHT - PLAYER_SIZE / 2, newX));
    newY = Math.max(FIELD_TOP + PLAYER_SIZE / 2, Math.min(FIELD_BOTTOM - PLAYER_SIZE / 2, newY));

    // 障碍物碰撞
    if (!this.collidesWithObstacle(newX, newY)) {
      this._redPlayer.x = newX;
      this._redPlayer.y = newY;
    } else if (!this.collidesWithObstacle(newX, this._redPlayer.y)) {
      this._redPlayer.x = newX;
    } else if (!this.collidesWithObstacle(this._redPlayer.x, newY)) {
      this._redPlayer.y = newY;
    }
  }

  /** 移动蓝队 AI */
  private moveBluePlayer(): void {
    let newX = this._bluePlayer.x;
    let newY = this._bluePlayer.y;

    const dx = this._aiTarget.x - newX;
    const dy = this._aiTarget.y - newY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 2) {
      newX += (dx / dist) * AI_SPEED;
      newY += (dy / dist) * AI_SPEED;
    }

    // 边界限制
    newX = Math.max(FIELD_LEFT + PLAYER_SIZE / 2, Math.min(FIELD_RIGHT - PLAYER_SIZE / 2, newX));
    newY = Math.max(FIELD_TOP + PLAYER_SIZE / 2, Math.min(FIELD_BOTTOM - PLAYER_SIZE / 2, newY));

    // 障碍物碰撞
    if (!this.collidesWithObstacle(newX, newY)) {
      this._bluePlayer.x = newX;
      this._bluePlayer.y = newY;
    } else if (!this.collidesWithObstacle(newX, this._bluePlayer.y)) {
      this._bluePlayer.x = newX;
    } else if (!this.collidesWithObstacle(this._bluePlayer.x, newY)) {
      this._bluePlayer.y = newY;
    }
  }

  /** AI 决策 */
  private updateAI(deltaTime: number): void {
    this._aiTimer += deltaTime;

    if (this._aiTimer < AI_THINK_INTERVAL) return;
    this._aiTimer = 0;

    const blue = this._bluePlayer;

    if (blue.hasFlag) {
      // 持有红旗 → 回蓝队基地
      this._aiTarget = {
        x: BLUE_BASE_X + BASE_WIDTH / 2,
        y: BLUE_BASE_Y + BASE_HEIGHT / 2,
      };
    } else if (!this._redFlag.atHome && this._redFlag.carrier === null) {
      // 红旗被丢弃 → 去捡红旗（带回自己的基地也是得分，但优先去抢）
      // 实际上红旗是己方旗帜，应该去保护/回收
      // 策略：去捡起红旗
      this._aiTarget = { x: this._redFlag.x, y: this._redFlag.y };
    } else if (this._redFlag.atHome) {
      // 红旗在原位 → 去抢红旗
      this._aiTarget = { x: RED_FLAG_HOME_X, y: RED_FLAG_HOME_Y };
    } else {
      // 红旗被红队持有 → 追击红队
      this._aiTarget = { x: this._redPlayer.x, y: this._redPlayer.y };
    }
  }

  /** 更新旗帜位置（跟随携带者） */
  private updateFlagPositions(): void {
    // 蓝旗跟随红队
    if (this._blueFlag.carrier === 'red') {
      this._blueFlag.x = this._redPlayer.x;
      this._blueFlag.y = this._redPlayer.y;
    }
    // 红旗跟随蓝队
    if (this._redFlag.carrier === 'blue') {
      this._redFlag.x = this._bluePlayer.x;
      this._redFlag.y = this._bluePlayer.y;
    }
  }

  /** 检查 AI 抢旗 */
  private checkGrabFlag(): void {
    // 蓝队 AI 尝试抢红旗
    if (!this._bluePlayer.hasFlag && this._redFlag.atHome) {
      const dist = this.distance(this._bluePlayer, this._redFlag);
      if (dist < PLAYER_SIZE + FLAG_SIZE) {
        this._redFlag.carrier = 'blue';
        this._redFlag.atHome = false;
        this._bluePlayer.hasFlag = true;
      }
    }

    // 蓝队 AI 捡起被丢弃的红旗（红旗不在原位且无人持有）
    if (!this._bluePlayer.hasFlag && !this._redFlag.atHome && this._redFlag.carrier === null) {
      const dist = this.distance(this._bluePlayer, this._redFlag);
      if (dist < PLAYER_SIZE + FLAG_SIZE) {
        this._redFlag.carrier = 'blue';
        this._bluePlayer.hasFlag = true;
      }
    }
  }

  /** 检查归还旗帜得分 */
  private checkReturnFlag(): void {
    // 红队玩家持有蓝旗 → 回红队基地得分
    if (this._redPlayer.hasFlag && this.isInRedBase(this._redPlayer)) {
      this._redScore++;
      this.addScore(1);
      this._redPlayer.hasFlag = false;
      // 蓝旗归位
      this._blueFlag.carrier = null;
      this._blueFlag.atHome = true;
      this._blueFlag.x = BLUE_FLAG_HOME_X;
      this._blueFlag.y = BLUE_FLAG_HOME_Y;
    }

    // 蓝队 AI 持有红旗 → 回蓝队基地得分
    if (this._bluePlayer.hasFlag && this.isInBlueBase(this._bluePlayer)) {
      this._blueScore++;
      this._bluePlayer.hasFlag = false;
      // 红旗归位
      this._redFlag.carrier = null;
      this._redFlag.atHome = true;
      this._redFlag.x = RED_FLAG_HOME_X;
      this._redFlag.y = RED_FLAG_HOME_Y;
    }
  }

  /** 检查碰撞对抗（碰到持旗对手可夺回旗帜） */
  private checkConfrontation(): void {
    const dist = this.distance(this._redPlayer, this._bluePlayer);
    if (dist < PLAYER_SIZE) {
      // 红队碰到蓝队
      // 如果蓝队持有红旗 → 红旗掉落在当前位置
      if (this._bluePlayer.hasFlag) {
        this._redFlag.carrier = null;
        this._redFlag.x = this._bluePlayer.x;
        this._redFlag.y = this._bluePlayer.y;
        this._bluePlayer.hasFlag = false;
      }
      // 如果红队持有蓝旗 → 蓝旗掉落在当前位置
      if (this._redPlayer.hasFlag) {
        this._blueFlag.carrier = null;
        this._blueFlag.x = this._redPlayer.x;
        this._blueFlag.y = this._redPlayer.y;
        this._redPlayer.hasFlag = false;
      }
    }
  }

  /** 检查胜利条件 */
  private checkWin(): void {
    if (this._redScore >= WIN_SCORE) {
      this._isWin = true;
      this.addScore(this._redScore * 10);
      this.gameOver();
    } else if (this._blueScore >= WIN_SCORE) {
      this._isWin = false;
      this.addScore(this._redScore * 10);
      this.gameOver();
    }
  }

  // ========== 碰撞检测辅助 ==========

  /** 检查位置是否与障碍物碰撞 */
  private collidesWithObstacle(px: number, py: number): boolean {
    const half = PLAYER_SIZE / 2;
    for (const obs of OBSTACLES) {
      if (
        px + half > obs.x &&
        px - half < obs.x + obs.w &&
        py + half > obs.y &&
        py - half < obs.y + obs.h
      ) {
        return true;
      }
    }
    return false;
  }

  /** 两点距离 */
  private distance(a: Position, b: Position): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /** 红队玩家是否在蓝旗附近 */
  private isNearBlueFlag(player: Position): boolean {
    return this.distance(player, { x: BLUE_FLAG_HOME_X, y: BLUE_FLAG_HOME_Y }) < PLAYER_SIZE + FLAG_SIZE;
  }

  /** 位置是否在红队基地内 */
  private isInRedBase(pos: Position): boolean {
    return (
      pos.x >= RED_BASE_X &&
      pos.x <= RED_BASE_X + BASE_WIDTH &&
      pos.y >= RED_BASE_Y &&
      pos.y <= RED_BASE_Y + BASE_HEIGHT
    );
  }

  /** 位置是否在蓝队基地内 */
  private isInBlueBase(pos: Position): boolean {
    return (
      pos.x >= BLUE_BASE_X &&
      pos.x <= BLUE_BASE_X + BASE_WIDTH &&
      pos.y >= BLUE_BASE_Y &&
      pos.y <= BLUE_BASE_Y + BASE_HEIGHT
    );
  }

  // ========== 渲染辅助 ==========

  private renderFlag(ctx: CanvasRenderingContext2D, flag: FlagState, color: string): void {
    // 旗杆
    ctx.strokeStyle = '#aaaaaa';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(flag.x, flag.y + FLAG_POLE_HEIGHT / 2);
    ctx.lineTo(flag.x, flag.y - FLAG_POLE_HEIGHT / 2);
    ctx.stroke();

    // 旗帜（三角形）
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(flag.x, flag.y - FLAG_POLE_HEIGHT / 2);
    ctx.lineTo(flag.x + FLAG_SIZE, flag.y - FLAG_POLE_HEIGHT / 2 + FLAG_SIZE / 2);
    ctx.lineTo(flag.x, flag.y - FLAG_POLE_HEIGHT / 2 + FLAG_SIZE);
    ctx.closePath();
    ctx.fill();
  }

  private renderPlayer(ctx: CanvasRenderingContext2D, player: PlayerState, color: string, label: string): void {
    const half = PLAYER_SIZE / 2;

    // 玩家方块
    ctx.fillStyle = color;
    ctx.fillRect(player.x - half, player.y - half, PLAYER_SIZE, PLAYER_SIZE);

    // 边框
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(player.x - half, player.y - half, PLAYER_SIZE, PLAYER_SIZE);

    // 标签
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, player.x, player.y);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // 如果持有旗帜，显示旗帜指示
    if (player.hasFlag) {
      ctx.fillStyle = color === PLAYER_COLOR_RED ? BLUE_FLAG_COLOR : RED_FLAG_COLOR;
      ctx.beginPath();
      ctx.arc(player.x, player.y - half - 6, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
