import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  COLS, ROWS, CELL_SIZE,
  PLAYER_ZONE_START_ROW,
  PLAYER_SIZE, PLAYER_SPEED, PLAYER_COLOR, INITIAL_LIVES,
  BULLET_WIDTH, BULLET_HEIGHT, BULLET_SPEED, BULLET_COLOR, MAX_BULLETS,
  CENTIPEDE_INITIAL_LENGTH, CENTIPEDE_SPEED_BASE, CENTIPEDE_SPEED_PER_LEVEL,
  CENTIPEDE_SEGMENT_SIZE, CENTIPEDE_HEAD_COLOR, CENTIPEDE_BODY_COLOR,
  CENTIPEDE_SCORE_HEAD, CENTIPEDE_SCORE_BODY,
  MUSHROOM_SIZE, MUSHROOM_COLOR, MUSHROOM_DAMAGED_COLOR, MUSHROOM_HEALTH,
  MUSHROOM_SCORE, INITIAL_MUSHROOM_COUNT,
  MUSHROOM_ZONE_START_ROW, MUSHROOM_ZONE_END_ROW,
  SPIDER_WIDTH, SPIDER_HEIGHT, SPIDER_SPEED_BASE, SPIDER_SPEED_PER_LEVEL,
  SPIDER_COLOR, SPIDER_SCORE, SPIDER_SPAWN_CHANCE, SPIDER_MIN_SPAWN_INTERVAL,
  SPIDER_VERTICAL_RANGE,
  CENTIPEDE_LENGTH_PER_LEVEL, CENTIPEDE_MAX_LENGTH,
  BG_COLOR, GRID_COLOR, HUD_COLOR, SCORE_COLOR,
  DIR_LEFT, DIR_RIGHT,
} from './constants';

// ========== 内部类型 ==========

/** 蘑菇 */
interface Mushroom {
  col: number;
  row: number;
  health: number;
}

/** 蜈蚣节段 */
interface Segment {
  col: number;
  row: number;
  prevCol: number;
  prevRow: number;
}

/** 蜈蚣实体 */
interface Centipede {
  segments: Segment[];
  dirX: number; // 水平方向: DIR_LEFT 或 DIR_RIGHT
  isHead: boolean; // 是否为原始头部（用于分数计算）
  moveTimer: number; // 移动计时器
}

/** 子弹 */
interface Bullet {
  x: number;
  y: number;
  alive: boolean;
}

/** 蜘蛛 */
interface Spider {
  x: number;
  y: number;
  dx: number;
  dy: number;
  baseY: number;
  alive: boolean;
}

// ========== 蘑菇网格辅助 ==========

/** 用二维布尔数组表示蘑菇位置，加速碰撞检测 */
function mushroomKey(col: number, row: number): string {
  return `${col},${row}`;
}

export class CentipedeEngine extends GameEngine {
  // ========== 游戏状态 ==========

  // 玩家
  private _playerX: number = 0;
  private _playerY: number = 0;
  private _lives: number = INITIAL_LIVES;

  // 输入
  private _keys: Set<string> = new Set();
  private _shootPressed: boolean = false;

  // 子弹
  private _bullets: Bullet[] = [];

  // 蘑菇
  private _mushrooms: Map<string, Mushroom> = new Map();

  // 蜈蚣列表（可能分裂为多条）
  private _centipedes: Centipede[] = [];

  // 蜘蛛
  private _spiders: Spider[] = [];
  private _spiderSpawnTimer: number = 0;

  // 波次
  private _wave: number = 1;

  // 移动间隔（基于速度计算）
  private _centipedeMoveInterval: number = 0;

  // ========== Public Getters ==========

  get playerX(): number { return this._playerX; }
  get playerY(): number { return this._playerY; }
  get lives(): number { return this._lives; }
  get mushrooms(): Map<string, Mushroom> { return this._mushrooms; }
  get centipedes(): Centipede[] { return this._centipedes; }
  get spiders(): Spider[] { return this._spiders; }
  get bullets(): Bullet[] { return this._bullets; }
  get wave(): number { return this._wave; }

  // ========== GameEngine 抽象方法实现 ==========

  protected onInit(): void {
    this._playerX = (CANVAS_WIDTH - PLAYER_SIZE) / 2;
    this._playerY = (PLAYER_ZONE_START_ROW + 2) * CELL_SIZE;
    this._lives = INITIAL_LIVES;
    this._keys.clear();
    this._shootPressed = false;
    this._bullets = [];
    this._mushrooms = new Map();
    this._centipedes = [];
    this._spiders = [];
    this._spiderSpawnTimer = 0;
    this._wave = 1;
    this._centipedeMoveInterval = CELL_SIZE / (CENTIPEDE_SPEED_BASE) * 1000;
  }

  protected onStart(): void {
    this.onInit();
    this.generateMushrooms(INITIAL_MUSHROOM_COUNT);
    this.spawnCentipede();
  }

  protected update(deltaTime: number): void {
    const dt = deltaTime / 1000;

    // 1. 玩家移动
    this.updatePlayer(dt);

    // 2. 射击
    this.updateShooting(dt);

    // 3. 子弹移动
    this.updateBullets(dt);

    // 4. 蜈蚣移动
    this.updateCentipedes(deltaTime);

    // 5. 蜘蛛
    this.updateSpiders(dt, deltaTime);

    // 6. 碰撞检测
    this.checkBulletMushroomCollisions();
    this.checkBulletCentipedeCollisions();
    this.checkBulletSpiderCollisions();
    this.checkSpiderPlayerCollision();
    this.checkCentipedePlayerCollision();

    // 7. 清理
    this.cleanup();

    // 8. 检查波次完成
    this.checkWaveComplete();
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // 网格线（微弱）
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 0.5;
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * CELL_SIZE, 0);
      ctx.lineTo(c * CELL_SIZE, CANVAS_HEIGHT);
      ctx.stroke();
    }
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * CELL_SIZE);
      ctx.lineTo(CANVAS_WIDTH, r * CELL_SIZE);
      ctx.stroke();
    }

    // 蘑菇
    this._mushrooms.forEach((m) => {
      const x = m.col * CELL_SIZE;
      const y = m.row * CELL_SIZE;
      // 根据生命值改变颜色
      const ratio = m.health / MUSHROOM_HEALTH;
      if (ratio > 0.5) {
        ctx.fillStyle = MUSHROOM_COLOR;
      } else {
        ctx.fillStyle = MUSHROOM_DAMAGED_COLOR;
      }
      ctx.fillRect(x + 1, y + 1, MUSHROOM_SIZE - 2, MUSHROOM_SIZE - 2);
      // 蘑菇顶部圆弧
      ctx.beginPath();
      ctx.arc(x + MUSHROOM_SIZE / 2, y + MUSHROOM_SIZE / 2, MUSHROOM_SIZE / 2 - 1, 0, Math.PI * 2);
      ctx.fill();
    });

    // 蜈蚣
    for (const centipede of this._centipedes) {
      for (let i = 0; i < centipede.segments.length; i++) {
        const seg = centipede.segments[i];
        const x = seg.col * CELL_SIZE;
        const y = seg.row * CELL_SIZE;
        ctx.fillStyle = (i === 0 && centipede.isHead) ? CENTIPEDE_HEAD_COLOR : CENTIPEDE_BODY_COLOR;
        ctx.fillRect(x + 1, y + 1, CENTIPEDE_SEGMENT_SIZE - 2, CENTIPEDE_SEGMENT_SIZE - 2);
      }
    }

    // 蜘蛛
    for (const spider of this._spiders) {
      if (!spider.alive) continue;
      ctx.fillStyle = SPIDER_COLOR;
      ctx.fillRect(spider.x, spider.y, SPIDER_WIDTH, SPIDER_HEIGHT);
    }

    // 子弹
    ctx.fillStyle = BULLET_COLOR;
    for (const bullet of this._bullets) {
      if (!bullet.alive) continue;
      ctx.fillRect(bullet.x, bullet.y, BULLET_WIDTH, BULLET_HEIGHT);
    }

    // 玩家
    ctx.fillStyle = PLAYER_COLOR;
    ctx.fillRect(this._playerX, this._playerY, PLAYER_SIZE, PLAYER_SIZE);

    // HUD
    ctx.fillStyle = SCORE_COLOR;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${this._score}`, 8, 16);
    ctx.fillStyle = HUD_COLOR;
    ctx.fillText(`Wave: ${this._wave}`, 180, 16);
    ctx.fillText(`Lives: ${this._lives}`, 360, 16);

    // 游戏结束
    if (this._status === 'gameover') {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ff1744';
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', w / 2, h / 2 - 20);
      ctx.fillStyle = HUD_COLOR;
      ctx.font = '18px monospace';
      ctx.fillText(`Score: ${this._score}  Wave: ${this._wave}`, w / 2, h / 2 + 20);
      ctx.font = '14px monospace';
      ctx.fillText('Press SPACE to restart', w / 2, h / 2 + 50);
      ctx.textAlign = 'left';
    }
  }

  protected onReset(): void {
    this.onInit();
  }

  protected onGameOver(): void {
    // 清理所有活动实体
    this._centipedes = [];
    this._spiders = [];
    this._bullets = [];
  }

  handleKeyDown(key: string): void {
    this._keys.add(key);
    if (key === ' ') {
      this._shootPressed = true;
      if (this._status === 'idle') {
        this.start();
      } else if (this._status === 'gameover') {
        this.reset();
        this.start();
      }
    }
  }

  handleKeyUp(key: string): void {
    this._keys.delete(key);
    if (key === ' ') {
      this._shootPressed = false;
    }
  }

  getState(): Record<string, unknown> {
    return {
      score: this._score,
      level: this._level,
      lives: this._lives,
      wave: this._wave,
      playerX: this._playerX,
      playerY: this._playerY,
      centipedeCount: this._centipedes.length,
      totalSegments: this._centipedes.reduce((sum, c) => sum + c.segments.length, 0),
      mushroomCount: this._mushrooms.size,
      spiderCount: this._spiders.filter(s => s.alive).length,
    };
  }

  // ========== 玩家逻辑 ==========

  private updatePlayer(dt: number): void {
    const speed = PLAYER_SPEED * dt;
    if (this._keys.has('ArrowLeft') || this._keys.has('a')) {
      this._playerX = Math.max(0, this._playerX - speed);
    }
    if (this._keys.has('ArrowRight') || this._keys.has('d')) {
      this._playerX = Math.min(CANVAS_WIDTH - PLAYER_SIZE, this._playerX + speed);
    }
    if (this._keys.has('ArrowUp') || this._keys.has('w')) {
      const minY = PLAYER_ZONE_START_ROW * CELL_SIZE;
      this._playerY = Math.max(minY, this._playerY - speed);
    }
    if (this._keys.has('ArrowDown') || this._keys.has('s')) {
      const maxY = (ROWS - 1) * CELL_SIZE;
      this._playerY = Math.min(maxY, this._playerY + speed);
    }
  }

  // ========== 射击逻辑 ==========

  private updateShooting(_dt: number): void {
    if (this._shootPressed) {
      const activeBullets = this._bullets.filter(b => b.alive);
      if (activeBullets.length < MAX_BULLETS) {
        this._bullets.push({
          x: this._playerX + PLAYER_SIZE / 2 - BULLET_WIDTH / 2,
          y: this._playerY - BULLET_HEIGHT,
          alive: true,
        });
        this._shootPressed = false; // 单次触发
      }
    }
  }

  // ========== 子弹逻辑 ==========

  private updateBullets(dt: number): void {
    for (const bullet of this._bullets) {
      if (!bullet.alive) continue;
      bullet.y -= BULLET_SPEED * dt;
      if (bullet.y < 0) {
        bullet.alive = false;
      }
    }
  }

  // ========== 蘑菇逻辑 ==========

  /** 生成随机蘑菇 */
  private generateMushrooms(count: number): void {
    let placed = 0;
    let attempts = 0;
    const maxAttempts = count * 10;
    while (placed < count && attempts < maxAttempts) {
      attempts++;
      const col = Math.floor(Math.random() * COLS);
      const row = MUSHROOM_ZONE_START_ROW + Math.floor(Math.random() * (MUSHROOM_ZONE_END_ROW - MUSHROOM_ZONE_START_ROW));
      const key = mushroomKey(col, row);
      if (!this._mushrooms.has(key)) {
        this._mushrooms.set(key, { col, row, health: MUSHROOM_HEALTH });
        placed++;
      }
    }
  }

  /** 在指定位置放置蘑菇 */
  private placeMushroom(col: number, row: number): void {
    const key = mushroomKey(col, row);
    if (!this._mushrooms.has(key)) {
      this._mushrooms.set(key, { col, row, health: MUSHROOM_HEALTH });
    }
  }

  // ========== 蜈蚣逻辑 ==========

  /** 生成一条蜈蚣 */
  private spawnCentipede(): void {
    const length = Math.min(
      CENTIPEDE_INITIAL_LENGTH + (this._wave - 1) * CENTIPEDE_LENGTH_PER_LEVEL,
      CENTIPEDE_MAX_LENGTH
    );
    const segments: Segment[] = [];
    for (let i = 0; i < length; i++) {
      segments.push({
        col: Math.floor(COLS / 2) + i, // 从中间开始，身体在右侧
        row: 0,
        prevCol: Math.floor(COLS / 2) + i,
        prevRow: 0,
      });
    }
    const speed = CENTIPEDE_SPEED_BASE + (this._wave - 1) * CENTIPEDE_SPEED_PER_LEVEL;
    this._centipedeMoveInterval = CELL_SIZE / speed * 1000;

    this._centipedes.push({
      segments,
      dirX: DIR_LEFT,
      isHead: true,
      moveTimer: 0,
    });
  }

  /** 更新所有蜈蚣 */
  private updateCentipedes(deltaTime: number): void {
    for (const centipede of this._centipedes) {
      centipede.moveTimer += deltaTime;
      if (centipede.moveTimer >= this._centipedeMoveInterval) {
        centipede.moveTimer -= this._centipedeMoveInterval;
        this.moveCentipede(centipede);
      }
    }
  }

  /** 移动单条蜈蚣一格 */
  private moveCentipede(centipede: Centipede): void {
    const head = centipede.segments[0];

    // 保存所有节段的前一位置
    for (const seg of centipede.segments) {
      seg.prevCol = seg.col;
      seg.prevRow = seg.row;
    }

    // 计算头部下一个位置
    let nextCol = head.col + centipede.dirX;
    let nextRow = head.row;
    let shouldDrop = false;

    // 检查是否碰到边界或蘑菇
    if (nextCol < 0 || nextCol >= COLS || this._mushrooms.has(mushroomKey(nextCol, nextRow))) {
      shouldDrop = true;
    }

    if (shouldDrop) {
      // 下移一行，反向
      nextCol = head.col; // 保持当前列
      nextRow = head.row + 1;

      // 如果到达底部，回到顶部
      if (nextRow >= ROWS) {
        nextRow = 0;
      }

      // 反向
      centipede.dirX = centipede.dirX === DIR_LEFT ? DIR_RIGHT : DIR_LEFT;

      // 下移后如果该位置有蘑菇，再反向尝试水平移动
      // （经典行为：下移后继续反方向移动）
    }

    // 移动头部
    head.col = nextCol;
    head.row = nextRow;

    // 身体跟随：每段移动到前一段的 prev 位置
    for (let i = 1; i < centipede.segments.length; i++) {
      centipede.segments[i].col = centipede.segments[i - 1].prevCol;
      centipede.segments[i].row = centipede.segments[i - 1].prevRow;
    }
  }

  // ========== 蜘蛛逻辑 ==========

  private updateSpiders(dt: number, deltaTime: number): void {
    // 生成蜘蛛
    this._spiderSpawnTimer += deltaTime;
    if (this._spiderSpawnTimer >= SPIDER_MIN_SPAWN_INTERVAL) {
      if (Math.random() < SPIDER_SPAWN_CHANCE * (deltaTime / 16)) {
        this.spawnSpider();
        this._spiderSpawnTimer = 0;
      }
    }

    // 移动蜘蛛
    const speed = (SPIDER_SPEED_BASE + (this._wave - 1) * SPIDER_SPEED_PER_LEVEL) * dt;
    for (const spider of this._spiders) {
      if (!spider.alive) continue;
      spider.x += spider.dx * speed;
      spider.y += spider.dy * speed * 0.5;

      // 垂直弹跳
      if (spider.y < spider.baseY - SPIDER_VERTICAL_RANGE || spider.y > spider.baseY + SPIDER_VERTICAL_RANGE) {
        spider.dy = -spider.dy;
      }

      // 出界移除
      if (spider.x < -SPIDER_WIDTH * 2 || spider.x > CANVAS_WIDTH + SPIDER_WIDTH * 2) {
        spider.alive = false;
      }
    }
  }

  private spawnSpider(): void {
    const fromLeft = Math.random() < 0.5;
    const x = fromLeft ? -SPIDER_WIDTH : CANVAS_WIDTH;
    const row = PLAYER_ZONE_START_ROW - 2 + Math.floor(Math.random() * 4);
    const y = row * CELL_SIZE;
    this._spiders.push({
      x,
      y,
      dx: fromLeft ? 1 : -1,
      dy: (Math.random() - 0.5) * 2,
      baseY: y,
      alive: true,
    });
  }

  // ========== 碰撞检测 ==========

  /** 子弹 vs 蘑菇 */
  private checkBulletMushroomCollisions(): void {
    for (const bullet of this._bullets) {
      if (!bullet.alive) continue;
      const bCol = Math.floor((bullet.x + BULLET_WIDTH / 2) / CELL_SIZE);
      const bRow = Math.floor((bullet.y + BULLET_HEIGHT / 2) / CELL_SIZE);
      const key = mushroomKey(bCol, bRow);
      const mushroom = this._mushrooms.get(key);
      if (mushroom) {
        bullet.alive = false;
        mushroom.health--;
        if (mushroom.health <= 0) {
          this._mushrooms.delete(key);
          this.addScore(MUSHROOM_SCORE);
        }
      }
    }
  }

  /** 子弹 vs 蜈蚣 */
  private checkBulletCentipedeCollisions(): void {
    for (const bullet of this._bullets) {
      if (!bullet.alive) continue;
      const bCol = Math.floor((bullet.x + BULLET_WIDTH / 2) / CELL_SIZE);
      const bRow = Math.floor((bullet.y + BULLET_HEIGHT / 2) / CELL_SIZE);

      for (let ci = this._centipedes.length - 1; ci >= 0; ci--) {
        const centipede = this._centipedes[ci];
        for (let si = 0; si < centipede.segments.length; si++) {
          const seg = centipede.segments[si];
          if (seg.col === bCol && seg.row === bRow) {
            // 命中！
            bullet.alive = false;

            // 计分
            const isHeadSegment = si === 0 && centipede.isHead;
            this.addScore(isHeadSegment ? CENTIPEDE_SCORE_HEAD : CENTIPEDE_SCORE_BODY);

            // 被击中的节段变成蘑菇
            this.placeMushroom(seg.col, seg.row);

            // 分裂蜈蚣
            this.splitCentipede(ci, si);
            return; // 一颗子弹只能命中一个节段
          }
        }
      }
    }
  }

  /** 分裂蜈蚣 */
  private splitCentipede(centipedeIndex: number, segmentIndex: number): void {
    const centipede = this._centipedes[centipedeIndex];
    const before = centipede.segments.slice(0, segmentIndex);
    const after = centipede.segments.slice(segmentIndex + 1);

    // 移除原蜈蚣
    this._centipedes.splice(centipedeIndex, 1);

    // 前半段（保留原方向和 isHead）
    if (before.length > 0) {
      this._centipedes.push({
        segments: before,
        dirX: centipede.dirX,
        isHead: centipede.isHead,
        moveTimer: 0,
      });
    }

    // 后半段（新头部，反向）
    if (after.length > 0) {
      this._centipedes.push({
        segments: after,
        dirX: centipede.dirX === DIR_LEFT ? DIR_RIGHT : DIR_LEFT,
        isHead: false,
        moveTimer: 0,
      });
    }
  }

  /** 子弹 vs 蜘蛛 */
  private checkBulletSpiderCollisions(): void {
    for (const bullet of this._bullets) {
      if (!bullet.alive) continue;
      for (const spider of this._spiders) {
        if (!spider.alive) continue;
        if (this.rectCollision(
          bullet.x, bullet.y, BULLET_WIDTH, BULLET_HEIGHT,
          spider.x, spider.y, SPIDER_WIDTH, SPIDER_HEIGHT
        )) {
          bullet.alive = false;
          spider.alive = false;
          this.addScore(SPIDER_SCORE);
          break;
        }
      }
    }
  }

  /** 蜘蛛 vs 玩家 */
  private checkSpiderPlayerCollision(): void {
    for (const spider of this._spiders) {
      if (!spider.alive) continue;
      if (this.rectCollision(
        spider.x, spider.y, SPIDER_WIDTH, SPIDER_HEIGHT,
        this._playerX, this._playerY, PLAYER_SIZE, PLAYER_SIZE
      )) {
        this.playerHit();
        return;
      }
    }
  }

  /** 蜈蚣 vs 玩家 */
  private checkCentipedePlayerCollision(): void {
    const pCol = Math.floor((this._playerX + PLAYER_SIZE / 2) / CELL_SIZE);
    const pRow = Math.floor((this._playerY + PLAYER_SIZE / 2) / CELL_SIZE);

    for (const centipede of this._centipedes) {
      for (const seg of centipede.segments) {
        if (seg.col === pCol && seg.row === pRow) {
          this.playerHit();
          return;
        }
      }
    }
  }

  /** 玩家被击中 */
  private playerHit(): void {
    this._lives--;
    this.emit('loseLife', this._lives);
    if (this._lives <= 0) {
      this.gameOver();
    } else {
      // 重置玩家位置
      this._playerX = (CANVAS_WIDTH - PLAYER_SIZE) / 2;
      this._playerY = (PLAYER_ZONE_START_ROW + 2) * CELL_SIZE;
      // 清除子弹
      this._bullets = [];
    }
  }

  // ========== 清理 ==========

  private cleanup(): void {
    this._bullets = this._bullets.filter(b => b.alive);
    this._spiders = this._spiders.filter(s => s.alive);
  }

  // ========== 波次检查 ==========

  private checkWaveComplete(): void {
    // 所有蜈蚣节段都被消灭
    const totalSegments = this._centipedes.reduce((sum, c) => sum + c.segments.length, 0);
    if (totalSegments === 0 && this._centipedes.length === 0) {
      this.nextWave();
    }
  }

  private nextWave(): void {
    this._wave++;
    this._level = this._wave;
    this.setLevel(this._level);
    this._spiders = [];
    this._bullets = [];
    this._spiderSpawnTimer = 0;

    // 补充蘑菇
    this.generateMushrooms(Math.floor(INITIAL_MUSHROOM_COUNT * 0.5));

    // 生成新蜈蚣
    this.spawnCentipede();

    this.emit('waveChange', this._wave);
  }

  // ========== 工具方法 ==========

  private rectCollision(
    x1: number, y1: number, w1: number, h1: number,
    x2: number, y2: number, w2: number, h2: number
  ): boolean {
    return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
  }
}
