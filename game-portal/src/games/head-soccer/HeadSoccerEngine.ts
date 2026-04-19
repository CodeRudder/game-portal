import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  GROUND_Y, GROUND_THICKNESS,
  GOAL_WIDTH, GOAL_HEIGHT, GOAL_DEPTH, GOAL_LEFT_X, GOAL_RIGHT_X,
  PLAYER_WIDTH, PLAYER_HEIGHT, HEAD_RADIUS,
  PLAYER_SPEED, JUMP_FORCE, GRAVITY, KICK_FORCE,
  BALL_RADIUS, BALL_GRAVITY, BALL_BOUNCE, BALL_FRICTION, BALL_MAX_SPEED,
  PLAYER_BALL_BOUNCE, HEAD_BALL_BOUNCE,
  WIN_SCORE,
  AI_REACTION_SPEED, AI_JUMP_CHANCE, AI_KICK_RANGE,
  P1_START_X, P2_START_X, PLAYER_START_Y,
  BALL_START_X, BALL_START_Y,
  SERVE_DELAY,
  BG_COLOR, GROUND_COLOR, GOAL_COLOR, GOAL_NET_COLOR,
  BALL_COLOR, BALL_OUTLINE,
  P1_COLOR, P1_HEAD_COLOR, P2_COLOR, P2_HEAD_COLOR,
  SCORE_COLOR, FIELD_LINE_COLOR,
} from './constants';

// ========== 数据结构 ==========

interface BallState {
  x: number;
  y: number;
  dx: number;
  dy: number;
}

interface PlayerState {
  x: number;
  y: number;
  dx: number;
  dy: number;
  onGround: boolean;
  facingRight: boolean;
  kicking: boolean;
  kickTimer: number;
}

// ========== Head Soccer 引擎 ==========

export class HeadSoccerEngine extends GameEngine {
  // 球
  private _ball: BallState = { x: BALL_START_X, y: BALL_START_Y, dx: 0, dy: 0 };

  // 两个角色
  private _p1: PlayerState = this.createPlayer(P1_START_X);
  private _p2: PlayerState = this.createPlayer(P2_START_X);

  // 分数
  private _p1Score: number = 0;
  private _p2Score: number = 0;

  // 输入状态
  private _keys: Set<string> = new Set();

  // AI 模式
  private _aiMode: boolean = true;
  private _aiTargetX: number = P2_START_X;
  private _aiTargetJump: boolean = false;
  private _aiTargetKick: boolean = false;

  // 发球
  private _serving: boolean = false;
  private _serveTimer: number = 0;
  private _lastScorer: number = 0; // 0=nobody, 1=p1 scored (serve to p2 side), 2=p2 scored

  // 胜利
  public isWin: boolean = false;
  private _winner: number = 0; // 0=none, 1=p1, 2=p2

  // ========== 构造函数 ==========

  constructor(aiMode: boolean = true) {
    super();
    this._aiMode = aiMode;
  }

  // ========== Public Getters ==========

  get p1Score(): number { return this._p1Score; }
  get p2Score(): number { return this._p2Score; }
  get winner(): number { return this._winner; }
  get aiMode(): boolean { return this._aiMode; }
  get serving(): boolean { return this._serving; }
  get ball(): BallState { return { ...this._ball }; }
  get p1(): PlayerState { return { ...this._p1 }; }
  get p2(): PlayerState { return { ...this._p2 }; }

  // ========== 辅助方法 ==========

  private createPlayer(x: number): PlayerState {
    return {
      x,
      y: PLAYER_START_Y,
      dx: 0,
      dy: 0,
      onGround: true,
      facingRight: x > CANVAS_WIDTH / 2 ? false : true,
      kicking: false,
      kickTimer: 0,
    };
  }

  private resetBall(serveDir: number = 0): void {
    this._ball.x = BALL_START_X;
    this._ball.y = BALL_START_Y;
    this._ball.dx = serveDir * 3;
    this._ball.dy = -2;
  }

  private resetPlayers(): void {
    this._p1 = this.createPlayer(P1_START_X);
    this._p2 = this.createPlayer(P2_START_X);
  }

  // ========== 生命周期实现 ==========

  protected onInit(): void {
    // 初始化时什么都不做
  }

  protected onStart(): void {
    this._p1Score = 0;
    this._p2Score = 0;
    this._winner = 0;
    this.isWin = false;
    this._serving = true;
    this._serveTimer = 0;
    this._lastScorer = 0;
    this._keys.clear();
    this.resetPlayers();
    this._ball = { x: BALL_START_X, y: BALL_START_Y, dx: 0, dy: 0 };
  }

  protected onReset(): void {
    this._p1Score = 0;
    this._p2Score = 0;
    this._winner = 0;
    this.isWin = false;
    this._serving = false;
    this._serveTimer = 0;
    this._lastScorer = 0;
    this._keys.clear();
    this.resetPlayers();
    this._ball = { x: BALL_START_X, y: BALL_START_Y, dx: 0, dy: 0 };
  }

  protected onGameOver(): void {
    // 游戏结束回调
  }

  // ========== 主更新 ==========

  protected update(deltaTime: number): void {
    // 限制 deltaTime 防止跳帧
    const dt = Math.min(deltaTime, 33) / 16.67;

    // 发球延迟
    if (this._serving) {
      this._serveTimer += deltaTime;
      if (this._serveTimer >= SERVE_DELAY) {
        this._serving = false;
        const serveDir = this._lastScorer === 1 ? -1 : this._lastScorer === 2 ? 1 : 0;
        this.resetBall(serveDir);
      }
      return;
    }

    // 处理输入
    this.handleP1Input(dt);
    if (this._aiMode) {
      this.updateAI(dt);
    } else {
      this.handleP2Input(dt);
    }

    // 更新角色物理
    this.updatePlayer(this._p1, dt);
    this.updatePlayer(this._p2, dt);

    // 更新球物理
    this.updateBall(dt);

    // 碰撞检测
    this.checkPlayerBallCollision(this._p1);
    this.checkPlayerBallCollision(this._p2);

    // 检查进球
    this.checkGoal();

    // 踢球计时器
    this.updateKickTimer(this._p1, dt);
    this.updateKickTimer(this._p2, dt);
  }

  // ========== 角色更新 ==========

  private updatePlayer(player: PlayerState, dt: number): void {
    // 重力
    player.dy += GRAVITY * dt;

    // 更新位置
    player.x += player.dx * dt;
    player.y += player.dy * dt;

    // 地面碰撞
    if (player.y + PLAYER_HEIGHT >= GROUND_Y) {
      player.y = GROUND_Y - PLAYER_HEIGHT;
      player.dy = 0;
      player.onGround = true;
    }

    // 天花板
    if (player.y < 0) {
      player.y = 0;
      player.dy = 0;
    }

    // 左右边界
    if (player.x < 0) {
      player.x = 0;
      player.dx = 0;
    }
    if (player.x + PLAYER_WIDTH > CANVAS_WIDTH) {
      player.x = CANVAS_WIDTH - PLAYER_WIDTH;
      player.dx = 0;
    }

    // 摩擦力
    if (player.onGround) {
      player.dx *= 0.85;
    }
  }

  // ========== 球更新 ==========

  private updateBall(dt: number): void {
    // 重力
    this._ball.dy += BALL_GRAVITY * dt;

    // 更新位置
    this._ball.x += this._ball.dx * dt;
    this._ball.y += this._ball.dy * dt;

    // 速度限制
    const speed = Math.sqrt(this._ball.dx * this._ball.dx + this._ball.dy * this._ball.dy);
    if (speed > BALL_MAX_SPEED) {
      this._ball.dx = (this._ball.dx / speed) * BALL_MAX_SPEED;
      this._ball.dy = (this._ball.dy / speed) * BALL_MAX_SPEED;
    }

    // 摩擦力
    this._ball.dx *= BALL_FRICTION;
    this._ball.dy *= BALL_FRICTION;

    // 地面弹跳
    if (this._ball.y + BALL_RADIUS >= GROUND_Y) {
      this._ball.y = GROUND_Y - BALL_RADIUS;
      this._ball.dy = -Math.abs(this._ball.dy) * BALL_BOUNCE;
      if (Math.abs(this._ball.dy) < 1) this._ball.dy = 0;
    }

    // 天花板
    if (this._ball.y - BALL_RADIUS < 0) {
      this._ball.y = BALL_RADIUS;
      this._ball.dy = Math.abs(this._ball.dy) * BALL_BOUNCE;
    }

    // 左右墙壁（非球门区域）
    const ballTop = this._ball.y - BALL_RADIUS;
    const goalTopY = GROUND_Y - GOAL_HEIGHT;

    // 左墙
    if (this._ball.x - BALL_RADIUS < 0) {
      // 球门区域（球可以进入）
      if (ballTop < goalTopY) {
        // 在球门上方，正常反弹
        this._ball.x = BALL_RADIUS;
        this._ball.dx = Math.abs(this._ball.dx) * BALL_BOUNCE;
      } else if (ballTop >= goalTopY && this._ball.y + BALL_RADIUS <= GROUND_Y) {
        // 在球门范围内，不反弹（让球进门）
      } else {
        this._ball.x = BALL_RADIUS;
        this._ball.dx = Math.abs(this._ball.dx) * BALL_BOUNCE;
      }
    }

    // 右墙
    if (this._ball.x + BALL_RADIUS > CANVAS_WIDTH) {
      if (ballTop < goalTopY) {
        this._ball.x = CANVAS_WIDTH - BALL_RADIUS;
        this._ball.dx = -Math.abs(this._ball.dx) * BALL_BOUNCE;
      } else if (ballTop >= goalTopY && this._ball.y + BALL_RADIUS <= GROUND_Y) {
        // 在球门范围内
      } else {
        this._ball.x = CANVAS_WIDTH - BALL_RADIUS;
        this._ball.dx = -Math.abs(this._ball.dx) * BALL_BOUNCE;
      }
    }

    // 球门横梁碰撞
    // 左球门横梁
    if (this._ball.x - BALL_RADIUS < GOAL_WIDTH && this._ball.y - BALL_RADIUS < goalTopY
      && this._ball.y + BALL_RADIUS > goalTopY && this._ball.dx < 0) {
      this._ball.y = goalTopY - BALL_RADIUS;
      this._ball.dy = -Math.abs(this._ball.dy) * BALL_BOUNCE;
    }
    // 右球门横梁
    if (this._ball.x + BALL_RADIUS > CANVAS_WIDTH - GOAL_WIDTH && this._ball.y - BALL_RADIUS < goalTopY
      && this._ball.y + BALL_RADIUS > goalTopY && this._ball.dx > 0) {
      this._ball.y = goalTopY - BALL_RADIUS;
      this._ball.dy = -Math.abs(this._ball.dy) * BALL_BOUNCE;
    }

    // 球门柱碰撞（左右球门的内侧柱子）
    // 左球门右柱
    if (this._ball.x - BALL_RADIUS < GOAL_WIDTH && this._ball.x + BALL_RADIUS > GOAL_WIDTH
      && this._ball.y > goalTopY) {
      if (this._ball.dx < 0 && this._ball.x > GOAL_WIDTH - BALL_RADIUS) {
        // 从右侧碰到柱子
        this._ball.x = GOAL_WIDTH + BALL_RADIUS;
        this._ball.dx = Math.abs(this._ball.dx) * BALL_BOUNCE;
      }
    }
    // 右球门左柱
    if (this._ball.x + BALL_RADIUS > CANVAS_WIDTH - GOAL_WIDTH && this._ball.x - BALL_RADIUS < CANVAS_WIDTH - GOAL_WIDTH
      && this._ball.y > goalTopY) {
      if (this._ball.dx > 0 && this._ball.x < CANVAS_WIDTH - GOAL_WIDTH + BALL_RADIUS) {
        this._ball.x = CANVAS_WIDTH - GOAL_WIDTH - BALL_RADIUS;
        this._ball.dx = -Math.abs(this._ball.dx) * BALL_BOUNCE;
      }
    }
  }

  // ========== 碰撞检测 ==========

  private checkPlayerBallCollision(player: PlayerState): void {
    // 角色矩形中心
    const pcx = player.x + PLAYER_WIDTH / 2;
    const pcy = player.y + PLAYER_HEIGHT / 2;

    // 头部中心（在角色顶部）
    const headCx = pcx;
    const headCy = player.y + HEAD_RADIUS;

    // 检查头部与球的碰撞
    const headDist = this.circleDistance(headCx, headCy, HEAD_RADIUS, this._ball.x, this._ball.y, BALL_RADIUS);
    if (headDist) {
      const { nx, ny, overlap } = headDist;
      // 分离
      this._ball.x += nx * overlap;
      this._ball.y += ny * overlap;
      // 反弹
      const relDx = this._ball.dx - player.dx;
      const relDy = this._ball.dy - player.dy;
      const dot = relDx * nx + relDy * ny;
      if (dot < 0) {
        this._ball.dx -= dot * nx * HEAD_BALL_BOUNCE;
        this._ball.dy -= dot * ny * HEAD_BALL_BOUNCE;
        // 加上角色的速度
        this._ball.dx += player.dx * 0.5;
        this._ball.dy += player.dy * 0.3;
      }
      return;
    }

    // 检查身体与球的碰撞（矩形 vs 圆）
    const bodyLeft = player.x;
    const bodyRight = player.x + PLAYER_WIDTH;
    const bodyTop = player.y + HEAD_RADIUS * 2;
    const bodyBottom = player.y + PLAYER_HEIGHT;

    const closestX = Math.max(bodyLeft, Math.min(this._ball.x, bodyRight));
    const closestY = Math.max(bodyTop, Math.min(this._ball.y, bodyBottom));
    const distX = this._ball.x - closestX;
    const distY = this._ball.y - closestY;
    const dist = Math.sqrt(distX * distX + distY * distY);

    if (dist < BALL_RADIUS && dist > 0) {
      const nx = distX / dist;
      const ny = distY / dist;
      const overlap = BALL_RADIUS - dist;

      this._ball.x += nx * overlap;
      this._ball.y += ny * overlap;

      const relDx = this._ball.dx - player.dx;
      const relDy = this._ball.dy - player.dy;
      const dot = relDx * nx + relDy * ny;
      if (dot < 0) {
        this._ball.dx -= dot * nx * PLAYER_BALL_BOUNCE;
        this._ball.dy -= dot * ny * PLAYER_BALL_BOUNCE;
        this._ball.dx += player.dx * 0.3;
        this._ball.dy += player.dy * 0.2;
      }
    }

    // 踢球碰撞（扩大前方区域）
    if (player.kicking) {
      const kickRange = player.facingRight ? PLAYER_WIDTH + 15 : -15;
      const kickCx = player.x + kickRange + 7;
      const kickCy = player.y + PLAYER_HEIGHT * 0.7;
      const kickR = 20;
      const kickDist = this.circleDistance(kickCx, kickCy, kickR, this._ball.x, this._ball.y, BALL_RADIUS);
      if (kickDist) {
        const { nx } = kickDist;
        this._ball.dx = nx * KICK_FORCE + (player.facingRight ? 3 : -3);
        this._ball.dy = -KICK_FORCE * 0.6;
      }
    }
  }

  private circleDistance(
    cx1: number, cy1: number, r1: number,
    cx2: number, cy2: number, r2: number
  ): { nx: number; ny: number; overlap: number } | null {
    const dx = cx2 - cx1;
    const dy = cy2 - cy1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const minDist = r1 + r2;
    if (dist < minDist && dist > 0) {
      return {
        nx: dx / dist,
        ny: dy / dist,
        overlap: minDist - dist,
      };
    }
    return null;
  }

  // ========== 进球检测 ==========

  private checkGoal(): void {
    const goalTopY = GROUND_Y - GOAL_HEIGHT;

    // P2 进球（球进入左侧球门）
    if (this._ball.x - BALL_RADIUS <= 0 && this._ball.y > goalTopY && this._ball.y < GROUND_Y) {
      this._p2Score++;
      this._lastScorer = 2;
      this.onScore();
      return;
    }

    // P1 进球（球进入右侧球门）
    if (this._ball.x + BALL_RADIUS >= CANVAS_WIDTH && this._ball.y > goalTopY && this._ball.y < GROUND_Y) {
      this._p1Score++;
      this._lastScorer = 1;
      this.onScore();
      return;
    }
  }

  private onScore(): void {
    this.addScore(1);

    // 检查胜利
    if (this._p1Score >= WIN_SCORE) {
      this._winner = 1;
      this.isWin = this._aiMode;
      this.gameOver();
      return;
    }
    if (this._p2Score >= WIN_SCORE) {
      this._winner = 2;
      this.isWin = !this._aiMode; // 双人模式下 P2 赢也算赢
      this.gameOver();
      return;
    }

    // 重新发球
    this._serving = true;
    this._serveTimer = 0;
    this.resetPlayers();
    this._ball = { x: BALL_START_X, y: BALL_START_Y, dx: 0, dy: 0 };
  }

  // ========== 输入处理 ==========

  private handleP1Input(dt: number): void {
    const p = this._p1;
    if (this._keys.has('a') || this._keys.has('A')) {
      p.dx = -PLAYER_SPEED;
      p.facingRight = false;
    }
    if (this._keys.has('d') || this._keys.has('D')) {
      p.dx = PLAYER_SPEED;
      p.facingRight = true;
    }
    if ((this._keys.has('w') || this._keys.has('W')) && p.onGround) {
      p.dy = JUMP_FORCE;
      p.onGround = false;
    }
    if (this._keys.has('s') || this._keys.has('S')) {
      if (!p.kicking) {
        p.kicking = true;
        p.kickTimer = 10;
      }
    }
  }

  private handleP2Input(dt: number): void {
    const p = this._p2;
    if (this._keys.has('ArrowLeft')) {
      p.dx = -PLAYER_SPEED;
      p.facingRight = false;
    }
    if (this._keys.has('ArrowRight')) {
      p.dx = PLAYER_SPEED;
      p.facingRight = true;
    }
    if (this._keys.has('ArrowUp') && p.onGround) {
      p.dy = JUMP_FORCE;
      p.onGround = false;
    }
    if (this._keys.has('ArrowDown')) {
      if (!p.kicking) {
        p.kicking = true;
        p.kickTimer = 10;
      }
    }
  }

  // ========== AI ==========

  private updateAI(dt: number): void {
    const p = this._p2;
    const ball = this._ball;

    // AI 目标位置：追踪球，但偏向右侧防守
    let targetX: number;
    const ballInRightHalf = ball.x > CANVAS_WIDTH / 2;

    if (ballInRightHalf) {
      // 球在右半场，积极追踪
      targetX = ball.x - PLAYER_WIDTH;
    } else {
      // 球在左半场，回到防守位置
      targetX = P2_START_X + 30;
    }

    // 平滑移动到目标位置
    const diff = targetX - p.x;
    p.dx += diff * AI_REACTION_SPEED * dt;
    p.dx = Math.max(-PLAYER_SPEED, Math.min(PLAYER_SPEED, p.dx));
    p.facingRight = diff < 0 ? false : true;

    // 跳跃逻辑
    const distToBall = Math.abs(ball.x - (p.x + PLAYER_WIDTH / 2));
    if (ballInRightHalf && distToBall < AI_KICK_RANGE && p.onGround) {
      if (Math.random() < AI_JUMP_CHANCE * dt || (ball.y < GROUND_Y - 150 && distToBall < 80)) {
        p.dy = JUMP_FORCE;
        p.onGround = false;
      }
    }

    // 踢球逻辑
    if (ballInRightHalf && distToBall < AI_KICK_RANGE * 0.6) {
      if (!p.kicking) {
        p.kicking = true;
        p.kickTimer = 10;
      }
    }
  }

  // ========== 踢球计时器 ==========

  private updateKickTimer(player: PlayerState, dt: number): void {
    if (player.kicking) {
      player.kickTimer -= dt;
      if (player.kickTimer <= 0) {
        player.kicking = false;
        player.kickTimer = 0;
      }
    }
  }

  // ========== 键盘处理 ==========

  handleKeyDown(key: string): void {
    this._keys.add(key);
  }

  handleKeyUp(key: string): void {
    this._keys.delete(key);
  }

  // ========== 渲染 ==========

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // 中线
    ctx.strokeStyle = FIELD_LINE_COLOR;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, GROUND_Y);
    ctx.stroke();
    ctx.setLineDash([]);

    // 中圈
    ctx.beginPath();
    ctx.arc(w / 2, GROUND_Y / 2, 60, 0, Math.PI * 2);
    ctx.stroke();

    // 球门
    this.renderGoal(ctx, GOAL_LEFT_X, true);
    this.renderGoal(ctx, GOAL_RIGHT_X, false);

    // 地面
    ctx.fillStyle = GROUND_COLOR;
    ctx.fillRect(0, GROUND_Y, w, GROUND_THICKNESS);

    // 球
    this.renderBall(ctx);

    // 角色
    this.renderPlayer(ctx, this._p1, P1_COLOR, P1_HEAD_COLOR);
    this.renderPlayer(ctx, this._p2, P2_COLOR, P2_HEAD_COLOR);

    // 分数
    this.renderScore(ctx);

    // 发球提示
    if (this._serving) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('准备...', w / 2, h / 2 - 40);
    }
  }

  private renderGoal(ctx: CanvasRenderingContext2D, x: number, isLeft: boolean): void {
    const goalTopY = GROUND_Y - GOAL_HEIGHT;

    // 球门框
    ctx.fillStyle = GOAL_COLOR;
    // 横梁
    ctx.fillRect(x, goalTopY, GOAL_WIDTH, 4);
    // 柱子
    if (isLeft) {
      ctx.fillRect(x, goalTopY, 4, GOAL_HEIGHT);
    } else {
      ctx.fillRect(x + GOAL_WIDTH - 4, goalTopY, 4, GOAL_HEIGHT);
    }

    // 球门网（背景）
    ctx.fillStyle = GOAL_NET_COLOR;
    ctx.globalAlpha = 0.3;
    if (isLeft) {
      ctx.fillRect(x, goalTopY, GOAL_WIDTH, GOAL_HEIGHT);
    } else {
      ctx.fillRect(x, goalTopY, GOAL_WIDTH, GOAL_HEIGHT);
    }
    ctx.globalAlpha = 1;

    // 网格线
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    for (let gy = goalTopY; gy < GROUND_Y; gy += 10) {
      ctx.beginPath();
      ctx.moveTo(x, gy);
      ctx.lineTo(x + GOAL_WIDTH, gy);
      ctx.stroke();
    }
    for (let gx = x; gx < x + GOAL_WIDTH; gx += 10) {
      ctx.beginPath();
      ctx.moveTo(gx, goalTopY);
      ctx.lineTo(gx, GROUND_Y);
      ctx.stroke();
    }
  }

  private renderBall(ctx: CanvasRenderingContext2D): void {
    ctx.beginPath();
    ctx.arc(this._ball.x, this._ball.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = BALL_COLOR;
    ctx.fill();
    ctx.strokeStyle = BALL_OUTLINE;
    ctx.lineWidth = 2;
    ctx.stroke();

    // 球的花纹
    ctx.beginPath();
    ctx.arc(this._ball.x - 3, this._ball.y - 3, 5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.fill();
  }

  private renderPlayer(ctx: CanvasRenderingContext2D, player: PlayerState, bodyColor: string, headColor: string): void {
    // 身体
    ctx.fillStyle = bodyColor;
    const bodyTop = player.y + HEAD_RADIUS * 2;
    const bodyHeight = PLAYER_HEIGHT - HEAD_RADIUS * 2;
    ctx.fillRect(player.x + 5, bodyTop, PLAYER_WIDTH - 10, bodyHeight);

    // 腿
    ctx.fillRect(player.x + 8, player.y + PLAYER_HEIGHT - 10, 10, 10);
    ctx.fillRect(player.x + PLAYER_WIDTH - 18, player.y + PLAYER_HEIGHT - 10, 10, 10);

    // 头
    const headCx = player.x + PLAYER_WIDTH / 2;
    const headCy = player.y + HEAD_RADIUS;
    ctx.beginPath();
    ctx.arc(headCx, headCy, HEAD_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = headColor;
    ctx.fill();
    ctx.strokeStyle = bodyColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // 眼睛
    const eyeOffsetX = player.facingRight ? 6 : -6;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(headCx + eyeOffsetX - 4, headCy - 3, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(headCx + eyeOffsetX + 4, headCy - 3, 4, 0, Math.PI * 2);
    ctx.fill();

    // 瞳孔
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(headCx + eyeOffsetX - 3, headCy - 3, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(headCx + eyeOffsetX + 5, headCy - 3, 2, 0, Math.PI * 2);
    ctx.fill();

    // 踢球动画
    if (player.kicking) {
      ctx.fillStyle = bodyColor;
      const kickX = player.facingRight ? player.x + PLAYER_WIDTH : player.x - 15;
      ctx.fillRect(kickX, player.y + PLAYER_HEIGHT - 20, 15, 10);
    }
  }

  private renderScore(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = SCORE_COLOR;
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(String(this._p1Score), CANVAS_WIDTH / 4, 50);
    ctx.fillText(String(this._p2Score), (CANVAS_WIDTH * 3) / 4, 50);

    // VS
    ctx.font = 'bold 18px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText('VS', CANVAS_WIDTH / 2, 45);

    // 玩家标签
    ctx.font = '12px monospace';
    ctx.fillStyle = P1_COLOR;
    ctx.fillText('P1', CANVAS_WIDTH / 4, 70);
    ctx.fillStyle = this._aiMode ? P2_COLOR : P2_COLOR;
    ctx.fillText(this._aiMode ? 'AI' : 'P2', (CANVAS_WIDTH * 3) / 4, 70);
  }

  // ========== getState ==========

  getState(): Record<string, unknown> {
    return {
      p1Score: this._p1Score,
      p2Score: this._p2Score,
      p1: { ...this._p1 },
      p2: { ...this._p2 },
      ball: { ...this._ball },
      winner: this._winner,
      aiMode: this._aiMode,
      serving: this._serving,
    };
  }
}
