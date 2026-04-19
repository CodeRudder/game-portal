import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  TILE_SIZE, MAP_COLS, MAP_ROWS,
  TERRAIN_EMPTY, TERRAIN_BRICK, TERRAIN_STEEL,
  TANK_SIZE, TANK_SPEED, TANK_COLOR_P1, TANK_COLOR_P2,
  BULLET_SIZE, BULLET_SPEED, BULLET_COLOR_P1, BULLET_COLOR_P2,
  MAX_BULLETS_PER_TANK, SHOOT_COOLDOWN,
  DIR_UP, DIR_RIGHT, DIR_DOWN, DIR_LEFT, DIR_VECTORS,
  WINS_NEEDED, ROUND_RESET_DELAY,
  P1_SPAWN, P2_SPAWN,
  BG_COLOR, BRICK_COLOR, STEEL_COLOR, GRID_COLOR, HUD_COLOR, SCORE_COLOR,
  AI_THINK_INTERVAL, AI_SHOOT_CHANCE, AI_DIRECTION_CHANGE_INTERVAL,
  DEFAULT_MAP,
} from './constants';

// ========== 内部类型 ==========

/** 子弹 */
interface Bullet {
  x: number;
  y: number;
  dir: number;
  speed: number;
  alive: boolean;
  owner: 1 | 2; // P1 或 P2
}

/** 坦克 */
interface Tank {
  x: number;
  y: number;
  dir: number;
  alive: boolean;
  shootCooldown: number;
}

/** 游戏阶段 */
type RoundPhase = 'playing' | 'roundEnd' | 'matchEnd';

// ========== 工具方法 ==========

/** 矩形碰撞检测 */
function rectsOverlap(
  x1: number, y1: number, w1: number, h1: number,
  x2: number, y2: number, w2: number, h2: number,
): boolean {
  return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
}

/** 深拷贝地图 */
function cloneMap(map: number[][]): number[][] {
  return map.map(row => [...row]);
}

// ========== TankDuelEngine ==========

export class TankDuelEngine extends GameEngine {
  // ========== 游戏状态 ==========

  /** 当前地图 */
  private _map: number[][] = [];

  /** 玩家1 坦克 */
  private _p1: Tank = this.createTank(P1_SPAWN.x, P1_SPAWN.y, DIR_UP);

  /** 玩家2 坦克 */
  private _p2: Tank = this.createTank(P2_SPAWN.x, P2_SPAWN.y, DIR_DOWN);

  /** 子弹列表 */
  private _bullets: Bullet[] = [];

  /** P1 胜场 */
  private _p1Wins: number = 0;

  /** P2 胜场 */
  private _p2Wins: number = 0;

  /** 当前回合阶段 */
  private _roundPhase: RoundPhase = 'playing';

  /** 回合结束计时器 */
  private _roundEndTimer: number = 0;

  /** 回合胜者 */
  private _roundWinner: 0 | 1 | 2 = 0;

  /** 比赛胜者 */
  private _matchWinner: 0 | 1 | 2 = 0;

  /** 是否 AI 模式（P2 由 AI 控制） */
  private _aiMode: boolean = false;

  /** AI 思考计时 */
  private _aiThinkTimer: number = 0;

  /** AI 方向变化计时 */
  private _aiDirTimer: number = 0;

  /** AI 当前目标方向 */
  private _aiTargetDir: number = DIR_DOWN;

  /** AI 是否想射击 */
  private _aiWantShoot: boolean = false;

  /** 输入状态 */
  private _keys: Set<string> = new Set();

  /** 是否为胜利方（用于 GameContainer） */
  public isWin: boolean = false;

  // ========== Public Getters ==========

  get p1(): Tank { return this._p1; }
  get p2(): Tank { return this._p2; }
  get bullets(): Bullet[] { return this._bullets; }
  get map(): number[][] { return this._map; }
  get p1Wins(): number { return this._p1Wins; }
  get p2Wins(): number { return this._p2Wins; }
  get roundPhase(): RoundPhase { return this._roundPhase; }
  get roundWinner(): 0 | 1 | 2 { return this._roundWinner; }
  get matchWinner(): 0 | 1 | 2 { return this._matchWinner; }
  get aiMode(): boolean { return this._aiMode; }

  // ========== 创建坦克 ==========

  private createTank(x: number, y: number, dir: number): Tank {
    return {
      x,
      y,
      dir,
      alive: true,
      shootCooldown: 0,
    };
  }

  // ========== GameEngine 抽象方法实现 ==========

  protected onInit(): void {
    this._map = cloneMap(DEFAULT_MAP);
    this._p1 = this.createTank(P1_SPAWN.x, P1_SPAWN.y, DIR_UP);
    this._p2 = this.createTank(P2_SPAWN.x, P2_SPAWN.y, DIR_DOWN);
    this._bullets = [];
    this._p1Wins = 0;
    this._p2Wins = 0;
    this._roundPhase = 'playing';
    this._roundEndTimer = 0;
    this._roundWinner = 0;
    this._matchWinner = 0;
    this._aiMode = false;
    this._aiThinkTimer = 0;
    this._aiDirTimer = 0;
    this._aiTargetDir = DIR_DOWN;
    this._aiWantShoot = false;
    this._keys.clear();
    this.isWin = false;
  }

  protected onStart(): void {
    this.resetRound();
    this._p1Wins = 0;
    this._p2Wins = 0;
    this._matchWinner = 0;
    this.isWin = false;
  }

  protected update(deltaTime: number): void {
    if (this._roundPhase === 'roundEnd') {
      this._roundEndTimer -= deltaTime;
      if (this._roundEndTimer <= 0) {
        this.startNextRound();
      }
      return;
    }

    if (this._roundPhase === 'matchEnd') {
      return;
    }

    // 1. 更新射击冷却
    this.updateCooldowns(deltaTime);

    // 2. P1 输入移动
    this.updateP1Input(deltaTime);

    // 3. P2 输入移动（或 AI）
    if (this._aiMode) {
      this.updateAI(deltaTime);
    } else {
      this.updateP2Input(deltaTime);
    }

    // 4. 更新子弹
    this.updateBullets(deltaTime);

    // 5. 碰撞检测
    this.checkBulletTerrainCollisions();
    this.checkBulletTankCollisions();

    // 6. 清理死亡子弹
    this.cleanup();

    // 7. 检查回合结束
    this.checkRoundEnd();
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // 网格线
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 0.5;
    for (let col = 0; col <= MAP_COLS; col++) {
      ctx.beginPath();
      ctx.moveTo(col * TILE_SIZE, 0);
      ctx.lineTo(col * TILE_SIZE, h);
      ctx.stroke();
    }
    for (let row = 0; row <= MAP_ROWS; row++) {
      ctx.beginPath();
      ctx.moveTo(0, row * TILE_SIZE);
      ctx.lineTo(w, row * TILE_SIZE);
      ctx.stroke();
    }

    // 地形
    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        const terrain = this._map[row]?.[col] ?? TERRAIN_EMPTY;
        const x = col * TILE_SIZE;
        const y = row * TILE_SIZE;
        if (terrain === TERRAIN_BRICK) {
          ctx.fillStyle = BRICK_COLOR;
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          // 砖块纹理
          ctx.strokeStyle = 'rgba(0,0,0,0.3)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
          ctx.beginPath();
          ctx.moveTo(x, y + TILE_SIZE / 2);
          ctx.lineTo(x + TILE_SIZE, y + TILE_SIZE / 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x + TILE_SIZE / 2, y);
          ctx.lineTo(x + TILE_SIZE / 2, y + TILE_SIZE / 2);
          ctx.stroke();
        } else if (terrain === TERRAIN_STEEL) {
          ctx.fillStyle = STEEL_COLOR;
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          // 钢墙纹理
          ctx.strokeStyle = 'rgba(255,255,255,0.2)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
          ctx.strokeRect(x + 6, y + 6, TILE_SIZE - 12, TILE_SIZE - 12);
        }
      }
    }

    // 坦克 P1
    if (this._p1.alive) {
      this.drawTank(ctx, this._p1, TANK_COLOR_P1);
    }

    // 坦克 P2
    if (this._p2.alive) {
      this.drawTank(ctx, this._p2, TANK_COLOR_P2);
    }

    // 子弹
    for (const bullet of this._bullets) {
      if (!bullet.alive) continue;
      ctx.fillStyle = bullet.owner === 1 ? BULLET_COLOR_P1 : BULLET_COLOR_P2;
      ctx.beginPath();
      ctx.arc(bullet.x + BULLET_SIZE / 2, bullet.y + BULLET_SIZE / 2, BULLET_SIZE / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // HUD - 回合分数
    ctx.fillStyle = HUD_COLOR;
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`P1: ${this._p1Wins}  -  P2: ${this._p2Wins}`, w / 2, 20);

    // AI 模式标识
    if (this._aiMode) {
      ctx.fillStyle = '#aaa';
      ctx.font = '10px monospace';
      ctx.fillText('AI', w / 2, 34);
    }

    ctx.textAlign = 'left';

    // 回合/比赛结束叠加层
    if (this._roundPhase === 'roundEnd') {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = SCORE_COLOR;
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      const winnerText = this._roundWinner === 1 ? 'P1 胜!' : 'P2 胜!';
      ctx.fillText(winnerText, w / 2, h / 2);
      ctx.fillStyle = HUD_COLOR;
      ctx.font = '16px monospace';
      ctx.fillText(`${this._p1Wins} - ${this._p2Wins}`, w / 2, h / 2 + 30);
      ctx.textAlign = 'left';
    }

    if (this._roundPhase === 'matchEnd') {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = SCORE_COLOR;
      ctx.font = 'bold 32px monospace';
      ctx.textAlign = 'center';
      const winnerText = this._matchWinner === 1 ? '🏆 P1 获胜!' : '🏆 P2 获胜!';
      ctx.fillText(winnerText, w / 2, h / 2 - 20);
      ctx.fillStyle = HUD_COLOR;
      ctx.font = '18px monospace';
      ctx.fillText(`最终比分: ${this._p1Wins} - ${this._p2Wins}`, w / 2, h / 2 + 20);
      ctx.font = '14px monospace';
      ctx.fillText('按空格键重新开始', w / 2, h / 2 + 50);
      ctx.textAlign = 'left';
    }
  }

  /** 绘制坦克 */
  private drawTank(ctx: CanvasRenderingContext2D, tank: Tank, color: string): void {
    const x = tank.x;
    const y = tank.y;

    // 坦克主体
    ctx.fillStyle = color;
    ctx.fillRect(x + 2, y + 2, TANK_SIZE - 4, TANK_SIZE - 4);

    // 坦克边框
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 2, y + 2, TANK_SIZE - 4, TANK_SIZE - 4);

    // 炮管
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    const cx = x + TANK_SIZE / 2;
    const cy = y + TANK_SIZE / 2;
    const gunW = 4;
    const gunLen = TANK_SIZE / 2 + 2;
    switch (tank.dir) {
      case DIR_UP:
        ctx.fillRect(cx - gunW / 2, y - 2, gunW, gunLen);
        break;
      case DIR_DOWN:
        ctx.fillRect(cx - gunW / 2, cy, gunW, gunLen);
        break;
      case DIR_LEFT:
        ctx.fillRect(x - 2, cy - gunW / 2, gunLen, gunW);
        break;
      case DIR_RIGHT:
        ctx.fillRect(cx, cy - gunW / 2, gunLen, gunW);
        break;
    }
  }

  protected onReset(): void {
    this.onInit();
  }

  protected onGameOver(): void {
    // 比赛结束时不做额外操作
  }

  handleKeyDown(key: string): void {
    this._keys.add(key);

    // 空格键：P1 射击 / 开始 / 重新开始
    if (key === ' ') {
      if (this._status === 'idle') {
        this.start();
      } else if (this._status === 'gameover') {
        this.reset();
        this.start();
      } else if (this._roundPhase === 'playing') {
        this.shoot(this._p1, 1);
      }
    }

    // Enter 键：P2 射击
    if (key === 'Enter' && this._status === 'playing' && this._roundPhase === 'playing') {
      if (!this._aiMode) {
        this.shoot(this._p2, 2);
      }
    }

    // T 键：切换 AI 模式
    if (key === 't' || key === 'T') {
      if (this._status === 'idle') {
        this._aiMode = !this._aiMode;
      }
    }
  }

  handleKeyUp(key: string): void {
    this._keys.delete(key);
  }

  getState(): Record<string, unknown> {
    return {
      score: this._score,
      level: this._level,
      p1Wins: this._p1Wins,
      p2Wins: this._p2Wins,
      p1Alive: this._p1.alive,
      p2Alive: this._p2.alive,
      p1X: this._p1.x,
      p1Y: this._p1.y,
      p1Dir: this._p1.dir,
      p2X: this._p2.x,
      p2Y: this._p2.y,
      p2Dir: this._p2.dir,
      roundPhase: this._roundPhase,
      roundWinner: this._roundWinner,
      matchWinner: this._matchWinner,
      aiMode: this._aiMode,
      bulletCount: this._bullets.filter(b => b.alive).length,
      mapBricks: this._map.flat().filter(t => t === TERRAIN_BRICK).length,
      mapSteels: this._map.flat().filter(t => t === TERRAIN_STEEL).length,
    };
  }

  // ========== 回合管理 ==========

  /** 重置回合（保留比分） */
  private resetRound(): void {
    this._map = cloneMap(DEFAULT_MAP);
    this._p1 = this.createTank(P1_SPAWN.x, P1_SPAWN.y, DIR_UP);
    this._p2 = this.createTank(P2_SPAWN.x, P2_SPAWN.y, DIR_DOWN);
    this._bullets = [];
    this._roundPhase = 'playing';
    this._roundEndTimer = 0;
    this._roundWinner = 0;
    this._aiThinkTimer = 0;
    this._aiDirTimer = 0;
    this._aiTargetDir = DIR_DOWN;
    this._aiWantShoot = false;
  }

  /** 回合结束后开始下一回合 */
  private startNextRound(): void {
    if (this._matchWinner !== 0) {
      this._roundPhase = 'matchEnd';
      return;
    }
    this.resetRound();
  }

  /** 检查回合结束 */
  private checkRoundEnd(): void {
    if (this._roundPhase !== 'playing') return;

    if (!this._p1.alive) {
      this.endRound(2);
    } else if (!this._p2.alive) {
      this.endRound(1);
    }
  }

  /** 结束回合 */
  private endRound(winner: 1 | 2): void {
    this._roundWinner = winner;
    this._roundPhase = 'roundEnd';
    this._roundEndTimer = ROUND_RESET_DELAY;

    if (winner === 1) {
      this._p1Wins++;
      this.addScore(100);
    } else {
      this._p2Wins++;
    }

    // 检查是否赢得比赛
    if (this._p1Wins >= WINS_NEEDED) {
      this._matchWinner = 1;
      this.isWin = true;
      this._score = this._p1Wins * 100;
      this.gameOver();
    } else if (this._p2Wins >= WINS_NEEDED) {
      this._matchWinner = 2;
      this.isWin = false;
      this._score = this._p1Wins * 100;
      this.gameOver();
    }
  }

  // ========== 冷却 ==========

  private updateCooldowns(deltaTime: number): void {
    if (this._p1.shootCooldown > 0) {
      this._p1.shootCooldown = Math.max(0, this._p1.shootCooldown - deltaTime);
    }
    if (this._p2.shootCooldown > 0) {
      this._p2.shootCooldown = Math.max(0, this._p2.shootCooldown - deltaTime);
    }
  }

  // ========== P1 输入 ==========

  private updateP1Input(deltaTime: number): void {
    if (!this._p1.alive) return;

    const dt = deltaTime / 1000;
    let newDir = this._p1.dir;
    let moving = false;

    if (this._keys.has('w')) {
      newDir = DIR_UP; moving = true;
    } else if (this._keys.has('s')) {
      newDir = DIR_DOWN; moving = true;
    } else if (this._keys.has('a')) {
      newDir = DIR_LEFT; moving = true;
    } else if (this._keys.has('d')) {
      newDir = DIR_RIGHT; moving = true;
    }

    this._p1.dir = newDir;

    if (moving) {
      const vec = DIR_VECTORS[newDir];
      const newX = this._p1.x + vec.dx * TANK_SPEED * dt;
      const newY = this._p1.y + vec.dy * TANK_SPEED * dt;
      if (this.canTankMove(this._p1, newX, newY)) {
        this._p1.x = newX;
        this._p1.y = newY;
      }
    }
  }

  // ========== P2 输入 ==========

  private updateP2Input(deltaTime: number): void {
    if (!this._p2.alive) return;

    const dt = deltaTime / 1000;
    let newDir = this._p2.dir;
    let moving = false;

    if (this._keys.has('ArrowUp')) {
      newDir = DIR_UP; moving = true;
    } else if (this._keys.has('ArrowDown')) {
      newDir = DIR_DOWN; moving = true;
    } else if (this._keys.has('ArrowLeft')) {
      newDir = DIR_LEFT; moving = true;
    } else if (this._keys.has('ArrowRight')) {
      newDir = DIR_RIGHT; moving = true;
    }

    this._p2.dir = newDir;

    if (moving) {
      const vec = DIR_VECTORS[newDir];
      const newX = this._p2.x + vec.dx * TANK_SPEED * dt;
      const newY = this._p2.y + vec.dy * TANK_SPEED * dt;
      if (this.canTankMove(this._p2, newX, newY)) {
        this._p2.x = newX;
        this._p2.y = newY;
      }
    }
  }

  // ========== AI ==========

  /** 设置 AI 模式 */
  public setAIMode(enabled: boolean): void {
    this._aiMode = enabled;
  }

  private updateAI(deltaTime: number): void {
    if (!this._p2.alive) return;

    const dt = deltaTime / 1000;

    // AI 思考
    this._aiThinkTimer += deltaTime;
    this._aiDirTimer += deltaTime;

    if (this._aiThinkTimer >= AI_THINK_INTERVAL) {
      this._aiThinkTimer = 0;
      this.aiThink();
    }

    // 方向变化
    if (this._aiDirTimer >= AI_DIRECTION_CHANGE_INTERVAL) {
      this._aiDirTimer = 0;
      this.aiPickDirection();
    }

    // 移动
    const vec = DIR_VECTORS[this._aiTargetDir];
    const newX = this._p2.x + vec.dx * TANK_SPEED * dt;
    const newY = this._p2.y + vec.dy * TANK_SPEED * dt;

    this._p2.dir = this._aiTargetDir;
    if (this.canTankMove(this._p2, newX, newY)) {
      this._p2.x = newX;
      this._p2.y = newY;
    } else {
      // 碰墙换方向
      this.aiPickDirection();
    }

    // AI 射击
    if (this._aiWantShoot) {
      this.shoot(this._p2, 2);
      this._aiWantShoot = false;
    }
  }

  private aiThink(): void {
    if (!this._p1.alive) return;

    // 判断是否面向 P1
    const dx = this._p1.x - this._p2.x;
    const dy = this._p1.y - this._p2.y;
    let facingP1 = false;

    if (this._p2.dir === DIR_UP && dy < 0 && Math.abs(dx) < TANK_SIZE) facingP1 = true;
    if (this._p2.dir === DIR_DOWN && dy > 0 && Math.abs(dx) < TANK_SIZE) facingP1 = true;
    if (this._p2.dir === DIR_LEFT && dx < 0 && Math.abs(dy) < TANK_SIZE) facingP1 = true;
    if (this._p2.dir === DIR_RIGHT && dx > 0 && Math.abs(dy) < TANK_SIZE) facingP1 = true;

    if (facingP1 && Math.random() < AI_SHOOT_CHANCE) {
      this._aiWantShoot = true;
    }

    // 有概率朝向 P1
    if (Math.random() < 0.4) {
      this.aiPickDirection();
    }
  }

  private aiPickDirection(): void {
    if (!this._p1.alive) {
      this._aiTargetDir = Math.floor(Math.random() * 4);
      return;
    }

    const dx = this._p1.x - this._p2.x;
    const dy = this._p1.y - this._p2.y;

    // 70% 概率朝向 P1，30% 随机
    if (Math.random() < 0.7) {
      if (Math.abs(dx) > Math.abs(dy)) {
        this._aiTargetDir = dx > 0 ? DIR_RIGHT : DIR_LEFT;
      } else {
        this._aiTargetDir = dy > 0 ? DIR_DOWN : DIR_UP;
      }
    } else {
      this._aiTargetDir = Math.floor(Math.random() * 4);
    }
  }

  // ========== 移动碰撞检测 ==========

  /** 检查坦克是否可以移动到指定位置 */
  private canTankMove(tank: Tank, newX: number, newY: number): boolean {
    // 边界检测
    if (newX < 0 || newY < 0 ||
        newX + TANK_SIZE > CANVAS_WIDTH || newY + TANK_SIZE > CANVAS_HEIGHT) {
      return false;
    }

    // 地形碰撞（砖墙和钢墙阻挡）
    const startCol = Math.floor(newX / TILE_SIZE);
    const endCol = Math.floor((newX + TANK_SIZE - 1) / TILE_SIZE);
    const startRow = Math.floor(newY / TILE_SIZE);
    const endRow = Math.floor((newY + TANK_SIZE - 1) / TILE_SIZE);

    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        if (row < 0 || row >= MAP_ROWS || col < 0 || col >= MAP_COLS) return false;
        const terrain = this._map[row][col];
        if (terrain === TERRAIN_BRICK || terrain === TERRAIN_STEEL) {
          return false;
        }
      }
    }

    // 对方坦克碰撞
    const other = tank === this._p1 ? this._p2 : this._p1;
    if (other.alive && rectsOverlap(newX, newY, TANK_SIZE, TANK_SIZE, other.x, other.y, TANK_SIZE, TANK_SIZE)) {
      return false;
    }

    return true;
  }

  // ========== 射击 ==========

  /** 射击 */
  private shoot(tank: Tank, owner: 1 | 2): void {
    if (!tank.alive) return;
    if (tank.shootCooldown > 0) return;

    const ownBullets = this._bullets.filter(b => b.alive && b.owner === owner);
    if (ownBullets.length >= MAX_BULLETS_PER_TANK) return;

    const vec = DIR_VECTORS[tank.dir];
    this._bullets.push({
      x: tank.x + TANK_SIZE / 2 - BULLET_SIZE / 2 + vec.dx * (TANK_SIZE / 2),
      y: tank.y + TANK_SIZE / 2 - BULLET_SIZE / 2 + vec.dy * (TANK_SIZE / 2),
      dir: tank.dir,
      speed: BULLET_SPEED,
      alive: true,
      owner,
    });

    tank.shootCooldown = SHOOT_COOLDOWN;
  }

  // ========== 子弹更新 ==========

  private updateBullets(deltaTime: number): void {
    const dt = deltaTime / 1000;
    for (const bullet of this._bullets) {
      if (!bullet.alive) continue;
      const vec = DIR_VECTORS[bullet.dir];
      bullet.x += vec.dx * bullet.speed * dt;
      bullet.y += vec.dy * bullet.speed * dt;

      // 出界
      if (bullet.x < -BULLET_SIZE || bullet.y < -BULLET_SIZE ||
          bullet.x > CANVAS_WIDTH + BULLET_SIZE || bullet.y > CANVAS_HEIGHT + BULLET_SIZE) {
        bullet.alive = false;
      }
    }
  }

  // ========== 碰撞检测 ==========

  /** 子弹 vs 地形 */
  private checkBulletTerrainCollisions(): void {
    for (const bullet of this._bullets) {
      if (!bullet.alive) continue;

      const startCol = Math.floor(bullet.x / TILE_SIZE);
      const endCol = Math.floor((bullet.x + BULLET_SIZE - 1) / TILE_SIZE);
      const startRow = Math.floor(bullet.y / TILE_SIZE);
      const endRow = Math.floor((bullet.y + BULLET_SIZE - 1) / TILE_SIZE);

      let hit = false;
      for (let row = startRow; row <= endRow && !hit; row++) {
        for (let col = startCol; col <= endCol && !hit; col++) {
          if (row < 0 || row >= MAP_ROWS || col < 0 || col >= MAP_COLS) continue;
          const terrain = this._map[row][col];
          if (terrain === TERRAIN_BRICK) {
            this._map[row][col] = TERRAIN_EMPTY;
            hit = true;
          } else if (terrain === TERRAIN_STEEL) {
            // 钢墙不可破坏，子弹消失
            hit = true;
          }
        }
      }
      if (hit) {
        bullet.alive = false;
      }
    }
  }

  /** 子弹 vs 坦克 */
  private checkBulletTankCollisions(): void {
    for (const bullet of this._bullets) {
      if (!bullet.alive) continue;

      // P1 子弹 vs P2
      if (bullet.owner === 1 && this._p2.alive) {
        if (rectsOverlap(bullet.x, bullet.y, BULLET_SIZE, BULLET_SIZE,
          this._p2.x, this._p2.y, TANK_SIZE, TANK_SIZE)) {
          bullet.alive = false;
          this._p2.alive = false;
        }
      }

      // P2 子弹 vs P1
      if (bullet.owner === 2 && this._p1.alive) {
        if (rectsOverlap(bullet.x, bullet.y, BULLET_SIZE, BULLET_SIZE,
          this._p1.x, this._p1.y, TANK_SIZE, TANK_SIZE)) {
          bullet.alive = false;
          this._p1.alive = false;
        }
      }
    }

    // 子弹 vs 子弹（互相抵消）
    for (let i = 0; i < this._bullets.length; i++) {
      const a = this._bullets[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < this._bullets.length; j++) {
        const b = this._bullets[j];
        if (!b.alive) continue;
        if (a.owner !== b.owner) {
          if (rectsOverlap(a.x, a.y, BULLET_SIZE, BULLET_SIZE, b.x, b.y, BULLET_SIZE, BULLET_SIZE)) {
            a.alive = false;
            b.alive = false;
          }
        }
      }
    }
  }

  // ========== 清理 ==========

  private cleanup(): void {
    this._bullets = this._bullets.filter(b => b.alive);
  }
}
