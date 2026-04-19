import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  TABLE_LEFT, TABLE_RIGHT, TABLE_TOP, TABLE_BOTTOM,
  CENTER_Y,
  GOAL_WIDTH, GOAL_LEFT, GOAL_RIGHT, GOAL_DEPTH,
  MALLET_RADIUS, MALLET_SPEED, MALLET_COLOR_PLAYER, MALLET_COLOR_AI,
  PLAYER_MIN_Y, PLAYER_MAX_Y, AI_MIN_Y, AI_MAX_Y,
  MALLET_MIN_X, MALLET_MAX_X,
  PUCK_RADIUS, PUCK_INITIAL_SPEED, PUCK_MAX_SPEED, PUCK_FRICTION,
  WIN_SCORE,
  AI_BASE_SPEED, AI_SPEED_PER_LEVEL, AI_TRACKING_ERROR, AI_REACTION_DELAY,
  SERVE_DELAY,
  BG_COLOR, TABLE_COLOR, LINE_COLOR, GOAL_COLOR, SCORE_COLOR,
  WALL_BOUNCE, MALLET_BOUNCE,
  PUCK_START_X, PUCK_START_Y,
} from './constants';

// ========== 数据结构 ==========

interface PuckState {
  x: number;
  y: number;
  dx: number;
  dy: number;
  speed: number;
}

interface MalletState {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
}

// ========== Air Hockey 引擎 ==========

export class AirHockeyEngine extends GameEngine {
  // 冰球
  private _puck: PuckState | null = null;

  // 推板
  private _player: MalletState = {
    x: CANVAS_WIDTH / 2,
    y: PLAYER_MAX_Y - 40,
    prevX: CANVAS_WIDTH / 2,
    prevY: PLAYER_MAX_Y - 40,
  };

  private _ai: MalletState = {
    x: CANVAS_WIDTH / 2,
    y: AI_MIN_Y + 40,
    prevX: CANVAS_WIDTH / 2,
    prevY: AI_MIN_Y + 40,
  };

  // 分数
  private _playerScore: number = 0;
  private _aiScore: number = 0;

  // 输入状态
  private _upPressed: boolean = false;
  private _downPressed: boolean = false;
  private _leftPressed: boolean = false;
  private _rightPressed: boolean = false;

  // AI
  private _aiTargetX: number = CANVAS_WIDTH / 2;
  private _aiTargetY: number = AI_MIN_Y + 40;
  private _aiReactionTimer: number = 0;

  // 发球
  private _serving: boolean = true;
  private _serveTimer: number = 0;
  private _serveToPlayer: boolean = true; // true = 向玩家半场发球

  // 胜利
  private _isWin: boolean = false;

  // ========== Public Getters ==========

  get playerScore(): number { return this._playerScore; }
  get aiScore(): number { return this._aiScore; }
  get isWin(): boolean { return this._isWin; }
  get serving(): boolean { return this._serving; }

  get puckX(): number { return this._puck?.x ?? 0; }
  get puckY(): number { return this._puck?.y ?? 0; }
  get puckDx(): number { return this._puck?.dx ?? 0; }
  get puckDy(): number { return this._puck?.dy ?? 0; }
  get puckSpeed(): number { return this._puck?.speed ?? 0; }

  get playerX(): number { return this._player.x; }
  get playerY(): number { return this._player.y; }
  get aiX(): number { return this._ai.x; }
  get aiY(): number { return this._ai.y; }

  get serveToPlayer(): boolean { return this._serveToPlayer; }

  // ========== GameEngine 抽象方法实现 ==========

  protected onInit(): void {
    this._player = {
      x: CANVAS_WIDTH / 2,
      y: PLAYER_MAX_Y - 40,
      prevX: CANVAS_WIDTH / 2,
      prevY: PLAYER_MAX_Y - 40,
    };
    this._ai = {
      x: CANVAS_WIDTH / 2,
      y: AI_MIN_Y + 40,
      prevX: CANVAS_WIDTH / 2,
      prevY: AI_MIN_Y + 40,
    };
    this._puck = null;
    this._serving = false;
    this._playerScore = 0;
    this._aiScore = 0;
    this._isWin = false;
    this._serveToPlayer = true;
  }

  protected onStart(): void {
    this._playerScore = 0;
    this._aiScore = 0;
    this._upPressed = false;
    this._downPressed = false;
    this._leftPressed = false;
    this._rightPressed = false;
    this._isWin = false;
    this._serveToPlayer = true;

    this._player = {
      x: CANVAS_WIDTH / 2,
      y: PLAYER_MAX_Y - 40,
      prevX: CANVAS_WIDTH / 2,
      prevY: PLAYER_MAX_Y - 40,
    };
    this._ai = {
      x: CANVAS_WIDTH / 2,
      y: AI_MIN_Y + 40,
      prevX: CANVAS_WIDTH / 2,
      prevY: AI_MIN_Y + 40,
    };

    this._aiTargetX = CANVAS_WIDTH / 2;
    this._aiTargetY = AI_MIN_Y + 40;
    this._aiReactionTimer = 0;

    this.resetServe();
  }

  protected update(deltaTime: number): void {
    const dt = deltaTime / 1000; // 转秒

    if (this._serving) {
      this._serveTimer -= deltaTime;
      if (this._serveTimer <= 0) {
        this._serving = false;
        this.launchPuck();
      }
      // 发球期间也允许推板移动
      this.movePlayerMallet();
      this.moveAIMallet(dt);
      return;
    }

    if (!this._puck) return;

    // 保存推板上一帧位置
    this._player.prevX = this._player.x;
    this._player.prevY = this._player.y;
    this._ai.prevX = this._ai.x;
    this._ai.prevY = this._ai.y;

    // 移动推板
    this.movePlayerMallet();
    this.moveAIMallet(dt);

    // 移动冰球
    this.movePuck();

    // 碰撞检测
    this.checkWallCollision();
    this.checkMalletCollision(this._player);
    this.checkMalletCollision(this._ai);
    this.checkGoal();

    // 摩擦力
    this.applyFriction();
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // 桌面
    ctx.fillStyle = TABLE_COLOR;
    ctx.fillRect(TABLE_LEFT, TABLE_TOP, TABLE_RIGHT - TABLE_LEFT, TABLE_BOTTOM - TABLE_TOP);

    // 中线
    ctx.strokeStyle = LINE_COLOR;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(TABLE_LEFT, CENTER_Y);
    ctx.lineTo(TABLE_RIGHT, CENTER_Y);
    ctx.stroke();
    ctx.setLineDash([]);

    // 中心圆
    ctx.strokeStyle = LINE_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(w / 2, CENTER_Y, 50, 0, Math.PI * 2);
    ctx.stroke();

    // 球门区域
    ctx.fillStyle = GOAL_COLOR;
    // 上球门（AI 端）
    ctx.fillRect(GOAL_LEFT, TABLE_TOP - GOAL_DEPTH, GOAL_WIDTH, GOAL_DEPTH + 2);
    // 下球门（玩家端）
    ctx.fillRect(GOAL_LEFT, TABLE_BOTTOM - 2, GOAL_WIDTH, GOAL_DEPTH + 2);

    // 球门边框
    ctx.strokeStyle = GOAL_COLOR;
    ctx.lineWidth = 3;
    // 上球门边框
    ctx.beginPath();
    ctx.moveTo(GOAL_LEFT, TABLE_TOP);
    ctx.lineTo(GOAL_LEFT, TABLE_TOP - GOAL_DEPTH);
    ctx.lineTo(GOAL_RIGHT, TABLE_TOP - GOAL_DEPTH);
    ctx.lineTo(GOAL_RIGHT, TABLE_TOP);
    ctx.stroke();
    // 下球门边框
    ctx.beginPath();
    ctx.moveTo(GOAL_LEFT, TABLE_BOTTOM);
    ctx.lineTo(GOAL_LEFT, TABLE_BOTTOM + GOAL_DEPTH);
    ctx.lineTo(GOAL_RIGHT, TABLE_BOTTOM + GOAL_DEPTH);
    ctx.lineTo(GOAL_RIGHT, TABLE_BOTTOM);
    ctx.stroke();

    // 分数
    ctx.fillStyle = SCORE_COLOR;
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${this._aiScore}`, w / 2, CENTER_Y - 20);
    ctx.fillText(`${this._playerScore}`, w / 2, CENTER_Y + 35);

    // AI 推板
    ctx.fillStyle = MALLET_COLOR_AI;
    ctx.beginPath();
    ctx.arc(this._ai.x, this._ai.y, MALLET_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    // AI 推板内圈
    ctx.fillStyle = '#c62828';
    ctx.beginPath();
    ctx.arc(this._ai.x, this._ai.y, MALLET_RADIUS * 0.45, 0, Math.PI * 2);
    ctx.fill();

    // 玩家推板
    ctx.fillStyle = MALLET_COLOR_PLAYER;
    ctx.beginPath();
    ctx.arc(this._player.x, this._player.y, MALLET_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    // 玩家推板内圈
    ctx.fillStyle = '#0277bd';
    ctx.beginPath();
    ctx.arc(this._player.x, this._player.y, MALLET_RADIUS * 0.45, 0, Math.PI * 2);
    ctx.fill();

    // 冰球
    if (this._puck) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(this._puck.x, this._puck.y, PUCK_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      // 冰球内圈
      ctx.fillStyle = '#e0e0e0';
      ctx.beginPath();
      ctx.arc(this._puck.x, this._puck.y, PUCK_RADIUS * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 发球提示
    if (this._serving && this._status === 'playing') {
      ctx.fillStyle = SCORE_COLOR;
      ctx.font = '16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Ready...', w / 2, CENTER_Y + 70);
      ctx.textAlign = 'left';
    }

    // 胜利/失败提示
    if (this._status === 'gameover') {
      // 半透明遮罩
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = this._isWin ? '#66bb6a' : '#ef5350';
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(this._isWin ? 'YOU WIN!' : 'YOU LOSE', w / 2, h / 2 - 10);
      ctx.font = '20px monospace';
      ctx.fillStyle = SCORE_COLOR;
      ctx.fillText(`${this._playerScore} : ${this._aiScore}`, w / 2, h / 2 + 30);
      ctx.font = '14px monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText('Press Space to restart', w / 2, h / 2 + 60);
      ctx.textAlign = 'left';
    }
  }

  protected onReset(): void {
    this._playerScore = 0;
    this._aiScore = 0;
    this._upPressed = false;
    this._downPressed = false;
    this._leftPressed = false;
    this._rightPressed = false;
    this._isWin = false;
    this._serving = true;
    this._serveTimer = 0;
    this._serveToPlayer = true;
    this._puck = null;

    this._player = {
      x: CANVAS_WIDTH / 2,
      y: PLAYER_MAX_Y - 40,
      prevX: CANVAS_WIDTH / 2,
      prevY: PLAYER_MAX_Y - 40,
    };
    this._ai = {
      x: CANVAS_WIDTH / 2,
      y: AI_MIN_Y + 40,
      prevX: CANVAS_WIDTH / 2,
      prevY: AI_MIN_Y + 40,
    };
    this._aiTargetX = CANVAS_WIDTH / 2;
    this._aiTargetY = AI_MIN_Y + 40;
    this._aiReactionTimer = 0;
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
      playerScore: this._playerScore,
      aiScore: this._aiScore,
      puckX: this.puckX,
      puckY: this.puckY,
      puckDx: this.puckDx,
      puckDy: this.puckDy,
      playerX: this._player.x,
      playerY: this._player.y,
      aiX: this._ai.x,
      aiY: this._ai.y,
      serving: this._serving,
      isWin: this._isWin,
    };
  }

  // ========== 私有方法 ==========

  private resetServe(): void {
    this._serving = true;
    this._serveTimer = SERVE_DELAY;
    this._puck = {
      x: PUCK_START_X,
      y: PUCK_START_Y,
      dx: 0,
      dy: 0,
      speed: PUCK_INITIAL_SPEED + (this._level - 1) * 0.3,
    };
  }

  private launchPuck(): void {
    if (!this._puck) return;
    // 向得分方半场发球（被进球的一方获得发球权）
    const angle = (Math.random() - 0.5) * Math.PI * 0.4;
    const direction = this._serveToPlayer ? 1 : -1; // 1 = 向下（玩家端），-1 = 向上（AI端）
    this._puck.dx = this._puck.speed * Math.sin(angle);
    this._puck.dy = direction * this._puck.speed * Math.cos(angle);
  }

  private movePlayerMallet(): void {
    // 保存上一帧位置
    this._player.prevX = this._player.x;
    this._player.prevY = this._player.y;

    if (this._upPressed) {
      this._player.y = Math.max(PLAYER_MIN_Y, this._player.y - MALLET_SPEED);
    }
    if (this._downPressed) {
      this._player.y = Math.min(PLAYER_MAX_Y, this._player.y + MALLET_SPEED);
    }
    if (this._leftPressed) {
      this._player.x = Math.max(MALLET_MIN_X, this._player.x - MALLET_SPEED);
    }
    if (this._rightPressed) {
      this._player.x = Math.min(MALLET_MAX_X, this._player.x + MALLET_SPEED);
    }
  }

  private moveAIMallet(dt: number): void {
    // 保存上一帧位置
    this._ai.prevX = this._ai.x;
    this._ai.prevY = this._ai.y;

    if (!this._puck) return;

    // AI 反应延迟
    this._aiReactionTimer += dt;
    const reactionDelay = Math.max(0.04, AI_REACTION_DELAY - this._level * 0.015);
    if (this._aiReactionTimer >= reactionDelay) {
      this._aiReactionTimer = 0;

      const errorRange = Math.max(0, AI_TRACKING_ERROR - this._level * 5);

      if (this._puck.dy < 0 && this._puck.y < CENTER_Y) {
        // 冰球向 AI 方向移动 → 积极拦截
        this._aiTargetX = this._puck.x + (Math.random() - 0.5) * errorRange;
        this._aiTargetY = Math.max(AI_MIN_Y, this._puck.y - 30 + (Math.random() - 0.5) * errorRange);
      } else {
        // 冰球远离 → 回到防守位置
        this._aiTargetX = CANVAS_WIDTH / 2 + (Math.random() - 0.5) * errorRange;
        this._aiTargetY = AI_MIN_Y + 40 + (Math.random() - 0.5) * errorRange * 0.5;
      }
    }

    // AI 移动速度
    const aiSpeed = AI_BASE_SPEED + this._level * AI_SPEED_PER_LEVEL;

    // X 方向移动
    const diffX = this._aiTargetX - this._ai.x;
    if (Math.abs(diffX) > 1) {
      this._ai.x += Math.sign(diffX) * Math.min(aiSpeed, Math.abs(diffX));
    }
    this._ai.x = Math.max(MALLET_MIN_X, Math.min(MALLET_MAX_X, this._ai.x));

    // Y 方向移动
    const diffY = this._aiTargetY - this._ai.y;
    if (Math.abs(diffY) > 1) {
      this._ai.y += Math.sign(diffY) * Math.min(aiSpeed, Math.abs(diffY));
    }
    this._ai.y = Math.max(AI_MIN_Y, Math.min(AI_MAX_Y, this._ai.y));
  }

  private movePuck(): void {
    if (!this._puck) return;
    // 移动前限速
    this.clampPuckSpeed();
    this._puck.x += this._puck.dx;
    this._puck.y += this._puck.dy;
  }

  private checkWallCollision(): void {
    if (!this._puck) return;
    const puck = this._puck;

    // 左墙
    if (puck.x - PUCK_RADIUS <= TABLE_LEFT) {
      puck.x = TABLE_LEFT + PUCK_RADIUS;
      puck.dx = Math.abs(puck.dx) * WALL_BOUNCE;
    }

    // 右墙
    if (puck.x + PUCK_RADIUS >= TABLE_RIGHT) {
      puck.x = TABLE_RIGHT - PUCK_RADIUS;
      puck.dx = -Math.abs(puck.dx) * WALL_BOUNCE;
    }

    // 上墙（注意球门区域）
    if (puck.y - PUCK_RADIUS <= TABLE_TOP) {
      // 不在球门范围内 → 反弹
      if (puck.x < GOAL_LEFT || puck.x > GOAL_RIGHT) {
        puck.y = TABLE_TOP + PUCK_RADIUS;
        puck.dy = Math.abs(puck.dy) * WALL_BOUNCE;
      }
    }

    // 下墙（注意球门区域）
    if (puck.y + PUCK_RADIUS >= TABLE_BOTTOM) {
      // 不在球门范围内 → 反弹
      if (puck.x < GOAL_LEFT || puck.x > GOAL_RIGHT) {
        puck.y = TABLE_BOTTOM - PUCK_RADIUS;
        puck.dy = -Math.abs(puck.dy) * WALL_BOUNCE;
      }
    }
  }

  private checkMalletCollision(mallet: MalletState): void {
    if (!this._puck) return;
    const puck = this._puck;

    // 圆形碰撞检测
    const dx = puck.x - mallet.x;
    const dy = puck.y - mallet.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const minDist = PUCK_RADIUS + MALLET_RADIUS;

    if (dist < minDist && dist > 0) {
      // 法线方向
      const nx = dx / dist;
      const ny = dy / dist;

      // 将冰球推出重叠区域
      puck.x = mallet.x + nx * minDist;
      puck.y = mallet.y + ny * minDist;

      // 推板速度（基于帧间位移）
      const malletVx = mallet.x - mallet.prevX;
      const malletVy = mallet.y - mallet.prevY;

      // 相对速度
      const relVx = puck.dx - malletVx;
      const relVy = puck.dy - malletVy;

      // 法线方向的相对速度
      const relVn = relVx * nx + relVy * ny;

      // 只在冰球朝推板移动时处理碰撞
      if (relVn < 0) {
        // 弹性碰撞
        puck.dx -= relVn * nx * MALLET_BOUNCE;
        puck.dy -= relVn * ny * MALLET_BOUNCE;

        // 加上推板速度的影响
        puck.dx += malletVx * 0.5;
        puck.dy += malletVy * 0.5;
      }

      // 限速
      this.clampPuckSpeed();
    }
  }

  private clampPuckSpeed(): void {
    if (!this._puck) return;
    const speed = Math.sqrt(this._puck.dx * this._puck.dx + this._puck.dy * this._puck.dy);
    if (speed > PUCK_MAX_SPEED) {
      const scale = PUCK_MAX_SPEED / speed;
      this._puck.dx *= scale;
      this._puck.dy *= scale;
    }
    this._puck.speed = Math.sqrt(this._puck.dx * this._puck.dx + this._puck.dy * this._puck.dy);
  }

  private applyFriction(): void {
    if (!this._puck) return;
    this._puck.dx *= PUCK_FRICTION;
    this._puck.dy *= PUCK_FRICTION;
    this._puck.speed = Math.sqrt(this._puck.dx * this._puck.dx + this._puck.dy * this._puck.dy);
  }

  private checkGoal(): void {
    if (!this._puck) return;
    const puck = this._puck;

    // 冰球进入上方球门（玩家得分）
    if (puck.y - PUCK_RADIUS <= TABLE_TOP - GOAL_DEPTH && puck.x >= GOAL_LEFT && puck.x <= GOAL_RIGHT) {
      this._playerScore++;
      this.addScore(1);
      if (this._playerScore >= WIN_SCORE) {
        this._isWin = true;
        this.addScore(this._playerScore);
        this.gameOver();
      } else {
        this._serveToPlayer = false; // 向 AI 半场发球
        this.resetServe();
      }
      return;
    }

    // 冰球进入下方球门（AI 得分）
    if (puck.y + PUCK_RADIUS >= TABLE_BOTTOM + GOAL_DEPTH && puck.x >= GOAL_LEFT && puck.x <= GOAL_RIGHT) {
      this._aiScore++;
      if (this._aiScore >= WIN_SCORE) {
        this._isWin = false;
        this.addScore(this._playerScore);
        this.gameOver();
      } else {
        this._serveToPlayer = true; // 向玩家半场发球
        this.resetServe();
      }
    }
  }
}
