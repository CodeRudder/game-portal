import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  SKIER_WIDTH, SKIER_HEIGHT,
  SKIER_SPEED_BASE, SKIER_SPEED_MIN, SKIER_SPEED_MAX,
  SKIER_SPEED_ACCEL, SKIER_SPEED_BRAKE, SKIER_SPEED_FRICTION,
  SKIER_TURN_RATE,
  SKIER_COLOR, SKIER_COLOR_CRASHED,
  TREE_WIDTH, TREE_HEIGHT, TREE_COLOR, TREE_TRUNK_COLOR,
  ROCK_WIDTH, ROCK_HEIGHT, ROCK_COLOR,
  SNOW_PILE_WIDTH, SNOW_PILE_HEIGHT, SNOW_PILE_COLOR,
  RAMP_WIDTH, RAMP_HEIGHT, RAMP_COLOR, RAMP_SCORE,
  JUMP_DURATION, JUMP_TRICK_SCORE,
  YETI_WIDTH, YETI_HEIGHT, YETI_COLOR, YETI_SPEED,
  YETI_APPEAR_DISTANCE, YETI_CATCH_DISTANCE,
  TERRAIN_SPAWN_INTERVAL, TERRAIN_MIN_GAP,
  OBSTACLE_DENSITY, RAMP_CHANCE, TREE_CHANCE, ROCK_CHANCE,
  SNOW_PILE_CHANCE,
  SNOWFLAKE_COUNT, SNOWFLAKE_SPEED_MIN, SNOWFLAKE_SPEED_MAX,
  SNOWFLAKE_SIZE_MIN, SNOWFLAKE_SIZE_MAX,
  DISTANCE_SCORE_RATE, SPEED_BONUS_MULTIPLIER,
  BG_COLOR, SNOW_TRAIL_COLOR, HUD_COLOR, HUD_BG_COLOR, SCORE_COLOR,
  COLLISION_TOLERANCE,
  OBSTACLE_TREE, OBSTACLE_ROCK, OBSTACLE_SNOW_PILE, OBSTACLE_RAMP,
  DIFFICULTY_INCREASE_RATE, MAX_OBSTACLE_DENSITY,
  ObstacleType,
} from './constants';

// ========== 内部类型 ==========

/** 障碍物 */
interface Obstacle {
  x: number;
  y: number;
  type: ObstacleType;
  width: number;
  height: number;
}

/** 雪花粒子 */
interface Snowflake {
  x: number;
  y: number;
  speed: number;
  size: number;
}

/** 滑雪轨迹点 */
interface TrailPoint {
  x: number;
  y: number;
}

// ========== 工具函数 ==========

function getObstacleDimensions(type: ObstacleType): { width: number; height: number } {
  switch (type) {
    case OBSTACLE_TREE: return { width: TREE_WIDTH, height: TREE_HEIGHT };
    case OBSTACLE_ROCK: return { width: ROCK_WIDTH, height: ROCK_HEIGHT };
    case OBSTACLE_SNOW_PILE: return { width: SNOW_PILE_WIDTH, height: SNOW_PILE_HEIGHT };
    case OBSTACLE_RAMP: return { width: RAMP_WIDTH, height: RAMP_HEIGHT };
  }
}

export class SkiFreeEngine extends GameEngine {
  // ========== 游戏状态 ==========

  // 滑雪者
  private _skierX: number = 0;
  private _skierY: number = 0;
  private _skierAngle: number = 0;          // 当前转向角度
  private _skierSpeed: number = SKIER_SPEED_BASE;
  private _isCrashed: boolean = false;
  private _crashTimer: number = 0;

  // 跳跃
  private _isJumping: boolean = false;
  private _jumpTimer: number = 0;
  private _jumpTricks: number = 0;          // 本次跳跃特技数

  // 距离与计分
  private _distance: number = 0;
  private _distanceScore: number = 0;

  // 输入
  private _keys: Set<string> = new Set();

  // 障碍物
  private _obstacles: Obstacle[] = [];
  private _terrainTimer: number = 0;

  // 雪怪
  private _yetiActive: boolean = false;
  private _yetiX: number = 0;
  private _yetiY: number = 0;
  private _yetiEating: boolean = false;
  private _yetiEatTimer: number = 0;

  // 雪花
  private _snowflakes: Snowflake[] = [];

  // 滑雪轨迹
  private _trail: TrailPoint[] = [];
  private _trailTimer: number = 0;

  // 难度
  private _currentDensity: number = OBSTACLE_DENSITY;

  // ========== Public Getters ==========

  get skierX(): number { return this._skierX; }
  get skierY(): number { return this._skierY; }
  get skierAngle(): number { return this._skierAngle; }
  get skierSpeed(): number { return this._skierSpeed; }
  get isCrashed(): boolean { return this._isCrashed; }
  get isJumping(): boolean { return this._isJumping; }
  get distance(): number { return this._distance; }
  get obstacles(): Obstacle[] { return this._obstacles; }
  get yetiActive(): boolean { return this._yetiActive; }
  get yetiX(): number { return this._yetiX; }
  get yetiY(): number { return this._yetiY; }
  get yetiEating(): boolean { return this._yetiEating; }
  get jumpTricks(): number { return this._jumpTricks; }
  get currentDensity(): number { return this._currentDensity; }
  get trail(): TrailPoint[] { return this._trail; }
  get snowflakes(): Snowflake[] { return this._snowflakes; }
  get distanceScore(): number { return this._distanceScore; }

  // ========== GameEngine 抽象方法实现 ==========

  protected onInit(): void {
    this._skierX = CANVAS_WIDTH / 2 - SKIER_WIDTH / 2;
    this._skierY = CANVAS_HEIGHT * 0.7;
    this._skierAngle = 0;
    this._skierSpeed = SKIER_SPEED_BASE;
    this._isCrashed = false;
    this._crashTimer = 0;
    this._isJumping = false;
    this._jumpTimer = 0;
    this._jumpTricks = 0;
    this._distance = 0;
    this._distanceScore = 0;
    this._keys.clear();
    this._obstacles = [];
    this._terrainTimer = 0;
    this._yetiActive = false;
    this._yetiX = 0;
    this._yetiY = 0;
    this._yetiEating = false;
    this._yetiEatTimer = 0;
    this._snowflakes = [];
    this._trail = [];
    this._trailTimer = 0;
    this._currentDensity = OBSTACLE_DENSITY;
  }

  protected onStart(): void {
    this.onInit();
    this.generateInitialObstacles();
    this.generateSnowflakes();
  }

  protected update(deltaTime: number): void {
    if (this._isCrashed) {
      this._crashTimer -= deltaTime;
      if (this._crashTimer <= 0) {
        this.gameOver();
      }
      return;
    }

    const dt = deltaTime / 1000;

    // 1. 处理输入
    this.handleInput(dt);

    // 2. 更新距离
    this._distance += this._skierSpeed * dt;

    // 3. 更新计分
    this._distanceScore = Math.floor(this._distance * DISTANCE_SCORE_RATE);
    const speedBonus = Math.floor(Math.max(0, this._skierSpeed - SKIER_SPEED_BASE) * SPEED_BONUS_MULTIPLIER * dt);
    if (speedBonus > 0) {
      this.addScore(speedBonus);
    }
    // 同步距离分数到总分
    this.syncDistanceScore();

    // 4. 滑雪者左右移动
    this._skierX += Math.sin(this._skierAngle) * this._skierSpeed * dt;
    this._skierX = Math.max(0, Math.min(CANVAS_WIDTH - SKIER_WIDTH, this._skierX));

    // 5. 自然减速
    if (!this._keys.has('ArrowUp') && !this._keys.has('ArrowDown')) {
      this._skierSpeed = Math.max(SKIER_SPEED_MIN, this._skierSpeed - SKIER_SPEED_FRICTION * dt);
    }

    // 6. 跳跃更新
    if (this._isJumping) {
      this._jumpTimer -= deltaTime;
      if (this._jumpTimer <= 0) {
        this._isJumping = false;
        this._jumpTimer = 0;
        // 跳跃结束加分
        if (this._jumpTricks > 0) {
          this.addScore(this._jumpTricks * JUMP_TRICK_SCORE);
          this.emit('trickLanded', this._jumpTricks);
        }
        this._jumpTricks = 0;
      }
    }

    // 7. 地形滚动与障碍物生成
    this.updateTerrain(deltaTime);

    // 8. 障碍物滚动
    this.scrollObstacles(this._skierSpeed * dt);

    // 9. 雪怪逻辑
    this.updateYeti(dt);

    // 10. 碰撞检测（跳跃时跳过障碍物碰撞）
    if (!this._isJumping) {
      this.checkCollisions();
    }

    // 11. 跳跃时检测特技
    if (this._isJumping) {
      this.checkTricks();
    }

    // 12. 雪怪碰撞
    this.checkYetiCollision();

    // 13. 更新雪花
    this.updateSnowflakes(dt);

    // 14. 更新轨迹
    this.updateTrail(deltaTime);

    // 15. 更新难度
    this._currentDensity = Math.min(
      MAX_OBSTACLE_DENSITY,
      OBSTACLE_DENSITY + this._distance * DIFFICULTY_INCREASE_RATE
    );

    // 16. 雪怪出现
    if (!this._yetiActive && this._distance >= YETI_APPEAR_DISTANCE) {
      this.spawnYeti();
    }
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // 滑雪轨迹
    ctx.strokeStyle = SNOW_TRAIL_COLOR;
    ctx.lineWidth = 2;
    for (let i = 1; i < this._trail.length; i++) {
      const prev = this._trail[i - 1];
      const curr = this._trail[i];
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(curr.x, curr.y);
      ctx.stroke();
    }

    // 障碍物
    for (const obs of this._obstacles) {
      this.renderObstacle(ctx, obs);
    }

    // 跳台高亮
    for (const obs of this._obstacles) {
      if (obs.type === OBSTACLE_RAMP) {
        ctx.fillStyle = RAMP_COLOR;
        ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
        // 跳台标记
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('⬆', obs.x + obs.width / 2, obs.y + obs.height / 2 + 3);
      }
    }

    // 雪怪
    if (this._yetiActive) {
      ctx.fillStyle = YETI_COLOR;
      ctx.fillRect(this._yetiX, this._yetiY, YETI_WIDTH, YETI_HEIGHT);
      // 眼睛
      ctx.fillStyle = '#ff1744';
      ctx.fillRect(this._yetiX + 8, this._yetiY + 8, 5, 5);
      ctx.fillRect(this._yetiX + 19, this._yetiY + 8, 5, 5);
    }

    // 滑雪者
    const skierColor = this._isCrashed ? SKIER_COLOR_CRASHED : SKIER_COLOR;
    ctx.fillStyle = skierColor;

    // 跳跃时上移
    let renderY = this._skierY;
    if (this._isJumping) {
      const progress = 1 - this._jumpTimer / JUMP_DURATION;
      const jumpArc = Math.sin(progress * Math.PI);
      renderY -= jumpArc * 40;
    }

    ctx.save();
    ctx.translate(this._skierX + SKIER_WIDTH / 2, renderY + SKIER_HEIGHT / 2);
    ctx.rotate(this._skierAngle);
    ctx.fillRect(-SKIER_WIDTH / 2, -SKIER_HEIGHT / 2, SKIER_WIDTH, SKIER_HEIGHT);
    // 滑雪板
    ctx.fillStyle = '#1565c0';
    ctx.fillRect(-SKIER_WIDTH / 2 - 2, SKIER_HEIGHT / 2 - 3, SKIER_WIDTH + 4, 3);
    ctx.restore();

    // 雪花
    ctx.fillStyle = '#ffffff';
    for (const sf of this._snowflakes) {
      ctx.fillRect(sf.x, sf.y, sf.size, sf.size);
    }

    // HUD
    ctx.fillStyle = HUD_BG_COLOR;
    ctx.fillRect(0, 0, w, 36);
    ctx.fillStyle = HUD_COLOR;
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`距离: ${Math.floor(this._distance)}m`, 8, 24);
    ctx.fillText(`速度: ${Math.floor(this._skierSpeed)}`, 160, 24);
    ctx.fillStyle = SCORE_COLOR;
    ctx.fillText(`分数: ${this._score}`, 310, 24);

    if (this._isJumping) {
      ctx.fillStyle = '#ff6f00';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`跳跃! +${this._jumpTricks} 特技`, w / 2, 60);
    }

    if (this._yetiActive && !this._yetiEating) {
      ctx.fillStyle = '#ff1744';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('⚠ 雪怪来了!', w / 2, h - 20);
    }

    // 游戏结束
    if (this._status === 'gameover') {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ff1744';
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', w / 2, h / 2 - 40);
      ctx.fillStyle = '#ffffff';
      ctx.font = '18px monospace';
      ctx.fillText(`距离: ${Math.floor(this._distance)}m`, w / 2, h / 2);
      ctx.fillText(`分数: ${this._score}`, w / 2, h / 2 + 30);
      ctx.font = '14px monospace';
      ctx.fillText('按 SPACE 重新开始', w / 2, h / 2 + 70);
      ctx.textAlign = 'left';
    }
  }

  protected onReset(): void {
    this.onInit();
  }

  protected onGameOver(): void {
    this._isCrashed = true;
  }

  handleKeyDown(key: string): void {
    this._keys.add(key);
    if (key === ' ') {
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
  }

  getState(): Record<string, unknown> {
    return {
      score: this._score,
      level: this._level,
      distance: this._distance,
      skierX: this._skierX,
      skierY: this._skierY,
      skierSpeed: this._skierSpeed,
      skierAngle: this._skierAngle,
      isCrashed: this._isCrashed,
      isJumping: this._isJumping,
      jumpTricks: this._jumpTricks,
      obstacleCount: this._obstacles.length,
      yetiActive: this._yetiActive,
      yetiEating: this._yetiEating,
      distanceScore: this._distanceScore,
      currentDensity: this._currentDensity,
    };
  }

  // ========== 输入处理 ==========

  private handleInput(dt: number): void {
    // 转向
    if (this._keys.has('ArrowLeft') || this._keys.has('a')) {
      this._skierAngle = Math.max(-1.0, this._skierAngle - SKIER_TURN_RATE * dt);
    } else if (this._keys.has('ArrowRight') || this._keys.has('d')) {
      this._skierAngle = Math.min(1.0, this._skierAngle + SKIER_TURN_RATE * dt);
    } else {
      // 自然回正
      if (this._skierAngle > 0) {
        this._skierAngle = Math.max(0, this._skierAngle - SKIER_TURN_RATE * dt * 0.5);
      } else if (this._skierAngle < 0) {
        this._skierAngle = Math.min(0, this._skierAngle + SKIER_TURN_RATE * dt * 0.5);
      }
    }

    // 加速 / 减速
    if (this._keys.has('ArrowUp') || this._keys.has('w')) {
      this._skierSpeed = Math.min(SKIER_SPEED_MAX, this._skierSpeed + SKIER_SPEED_ACCEL * dt);
    }
    if (this._keys.has('ArrowDown') || this._keys.has('s')) {
      this._skierSpeed = Math.max(SKIER_SPEED_MIN, this._skierSpeed - SKIER_SPEED_BRAKE * dt);
    }
  }

  // ========== 地形生成 ==========

  /** 生成初始障碍物（在屏幕上铺满） */
  private generateInitialObstacles(): void {
    for (let y = -CANVAS_HEIGHT; y < CANVAS_HEIGHT; y += 60) {
      this.generateObstacleRow(y);
    }
  }

  /** 生成一行障碍物 */
  private generateObstacleRow(y: number): void {
    const numObstacles = Math.floor(Math.random() * 3) + 1;
    for (let i = 0; i < numObstacles; i++) {
      if (Math.random() > this._currentDensity) continue;

      const type = this.randomObstacleType();
      const dims = getObstacleDimensions(type);
      const x = Math.random() * (CANVAS_WIDTH - dims.width);

      // 检查与已有障碍物的最小间距
      const tooClose = this._obstacles.some(obs =>
        Math.abs(obs.x - x) < TERRAIN_MIN_GAP && Math.abs(obs.y - y) < TERRAIN_MIN_GAP
      );
      if (tooClose) continue;

      this._obstacles.push({ x, y, type, width: dims.width, height: dims.height });
    }
  }

  /** 随机选择障碍物类型 */
  private randomObstacleType(): ObstacleType {
    // 先检查是否生成跳台
    if (Math.random() < RAMP_CHANCE) return OBSTACLE_RAMP;

    const roll = Math.random();
    if (roll < TREE_CHANCE) return OBSTACLE_TREE;
    if (roll < TREE_CHANCE + ROCK_CHANCE) return OBSTACLE_ROCK;
    return OBSTACLE_SNOW_PILE;
  }

  /** 地形更新：定时生成新行 */
  private updateTerrain(deltaTime: number): void {
    this._terrainTimer += deltaTime;
    if (this._terrainTimer >= TERRAIN_SPAWN_INTERVAL) {
      this._terrainTimer -= TERRAIN_SPAWN_INTERVAL;
      this.generateObstacleRow(-40); // 在屏幕上方生成
    }
  }

  /** 滚动所有障碍物 */
  private scrollObstacles(scrollAmount: number): void {
    for (const obs of this._obstacles) {
      obs.y += scrollAmount;
    }
    // 移除屏幕外的障碍物
    this._obstacles = this._obstacles.filter(obs => obs.y < CANVAS_HEIGHT + 50);
  }

  // ========== 碰撞检测 ==========

  private checkCollisions(): void {
    const sx = this._skierX;
    const sy = this._skierY;

    for (const obs of this._obstacles) {
      // 跳台不造成碰撞，而是触发跳跃
      if (obs.type === OBSTACLE_RAMP) {
        if (this.rectOverlap(
          sx + COLLISION_TOLERANCE, sy + COLLISION_TOLERANCE,
          SKIER_WIDTH - COLLISION_TOLERANCE * 2, SKIER_HEIGHT - COLLISION_TOLERANCE * 2,
          obs.x, obs.y, obs.width, obs.height
        )) {
          this.startJump();
          return;
        }
        continue;
      }

      // 其他障碍物碰撞
      if (this.rectOverlap(
        sx + COLLISION_TOLERANCE, sy + COLLISION_TOLERANCE,
        SKIER_WIDTH - COLLISION_TOLERANCE * 2, SKIER_HEIGHT - COLLISION_TOLERANCE * 2,
        obs.x, obs.y, obs.width, obs.height
      )) {
        this.crash();
        return;
      }
    }
  }

  private checkTricks(): void {
    // 跳跃时按左/右键做特技
    if (this._keys.has('ArrowLeft') || this._keys.has('ArrowRight') ||
        this._keys.has('a') || this._keys.has('d')) {
      // 每帧都有小概率增加特技（模拟翻转）
      if (Math.random() < 0.05) {
        this._jumpTricks++;
      }
    }
  }

  private startJump(): void {
    if (this._isJumping) return;
    this._isJumping = true;
    this._jumpTimer = JUMP_DURATION;
    this._jumpTricks = 0;
    this.addScore(RAMP_SCORE);
    this.emit('jumpStart', RAMP_SCORE);
  }

  private crash(): void {
    this._isCrashed = true;
    this._crashTimer = 1500; // 1.5秒后游戏结束
    this._skierSpeed = 0;
    this.emit('crash');
  }

  // ========== 雪怪逻辑 ==========

  private spawnYeti(): void {
    this._yetiActive = true;
    this._yetiX = Math.random() < 0.5 ? -YETI_WIDTH : CANVAS_WIDTH;
    this._yetiY = this._skierY - CANVAS_HEIGHT * 0.3;
    this._yetiEating = false;
    this._yetiEatTimer = 0;
    this.emit('yetiAppear');
  }

  private updateYeti(dt: number): void {
    if (!this._yetiActive) return;

    if (this._yetiEating) {
      this._yetiEatTimer -= dt * 1000;
      if (this._yetiEatTimer <= 0) {
        this.gameOver();
      }
      return;
    }

    // 向滑雪者移动
    const dx = this._skierX + SKIER_WIDTH / 2 - (this._yetiX + YETI_WIDTH / 2);
    const dy = this._skierY + SKIER_HEIGHT / 2 - (this._yetiY + YETI_HEIGHT / 2);
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 0) {
      this._yetiX += (dx / dist) * YETI_SPEED * dt;
      this._yetiY += (dy / dist) * YETI_SPEED * dt;
    }

    // 同时跟随地形滚动
    this._yetiY += this._skierSpeed * dt * 0.3;
  }

  private checkYetiCollision(): void {
    if (!this._yetiActive || this._yetiEating) return;

    const dx = (this._skierX + SKIER_WIDTH / 2) - (this._yetiX + YETI_WIDTH / 2);
    const dy = (this._skierY + SKIER_HEIGHT / 2) - (this._yetiY + YETI_HEIGHT / 2);
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < YETI_CATCH_DISTANCE) {
      this._yetiEating = true;
      this._yetiEatTimer = 2000; // 2秒吃掉动画后结束
      this._skierSpeed = 0;
      this.emit('yetiCatch');
    }
  }

  // ========== 雪花 ==========

  private generateSnowflakes(): void {
    this._snowflakes = [];
    for (let i = 0; i < SNOWFLAKE_COUNT; i++) {
      this._snowflakes.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT,
        speed: SNOWFLAKE_SPEED_MIN + Math.random() * (SNOWFLAKE_SPEED_MAX - SNOWFLAKE_SPEED_MIN),
        size: SNOWFLAKE_SIZE_MIN + Math.random() * (SNOWFLAKE_SIZE_MAX - SNOWFLAKE_SIZE_MIN),
      });
    }
  }

  private updateSnowflakes(dt: number): void {
    for (const sf of this._snowflakes) {
      sf.y += (sf.speed + this._skierSpeed * 0.3) * dt;
      sf.x += Math.sin(sf.y * 0.01) * 0.5;

      if (sf.y > CANVAS_HEIGHT) {
        sf.y = -5;
        sf.x = Math.random() * CANVAS_WIDTH;
      }
      if (sf.x < 0) sf.x = CANVAS_WIDTH;
      if (sf.x > CANVAS_WIDTH) sf.x = 0;
    }
  }

  // ========== 轨迹 ==========

  private updateTrail(deltaTime: number): void {
    this._trailTimer += deltaTime;
    if (this._trailTimer >= 50) { // 每50ms记录一个点
      this._trailTimer = 0;
      this._trail.push({
        x: this._skierX + SKIER_WIDTH / 2,
        y: this._skierY + SKIER_HEIGHT,
      });
      // 轨迹跟随地形滚动
      for (const pt of this._trail) {
        pt.y += this._skierSpeed * (50 / 1000);
      }
      // 移除屏幕外的轨迹点
      this._trail = this._trail.filter(pt => pt.y < CANVAS_HEIGHT + 10);
      // 限制轨迹长度
      if (this._trail.length > 200) {
        this._trail = this._trail.slice(-200);
      }
    }
  }

  // ========== 计分同步 ==========

  private _lastSyncedDistanceScore: number = 0;

  private syncDistanceScore(): void {
    const diff = this._distanceScore - this._lastSyncedDistanceScore;
    if (diff > 0) {
      this.addScore(diff);
      this._lastSyncedDistanceScore = this._distanceScore;
    }
  }

  // ========== 渲染辅助 ==========

  private renderObstacle(ctx: CanvasRenderingContext2D, obs: Obstacle): void {
    switch (obs.type) {
      case OBSTACLE_TREE:
        // 树干
        ctx.fillStyle = TREE_TRUNK_COLOR;
        ctx.fillRect(obs.x + obs.width / 2 - 3, obs.y + obs.height * 0.6, 6, obs.height * 0.4);
        // 树冠
        ctx.fillStyle = TREE_COLOR;
        ctx.beginPath();
        ctx.moveTo(obs.x + obs.width / 2, obs.y);
        ctx.lineTo(obs.x + obs.width, obs.y + obs.height * 0.7);
        ctx.lineTo(obs.x, obs.y + obs.height * 0.7);
        ctx.closePath();
        ctx.fill();
        break;

      case OBSTACLE_ROCK:
        ctx.fillStyle = ROCK_COLOR;
        ctx.beginPath();
        ctx.ellipse(obs.x + obs.width / 2, obs.y + obs.height / 2, obs.width / 2, obs.height / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        break;

      case OBSTACLE_SNOW_PILE:
        ctx.fillStyle = SNOW_PILE_COLOR;
        ctx.beginPath();
        ctx.ellipse(obs.x + obs.width / 2, obs.y + obs.height / 2, obs.width / 2, obs.height / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        break;

      case OBSTACLE_RAMP:
        ctx.fillStyle = RAMP_COLOR;
        ctx.beginPath();
        ctx.moveTo(obs.x, obs.y + obs.height);
        ctx.lineTo(obs.x + obs.width / 2, obs.y);
        ctx.lineTo(obs.x + obs.width, obs.y + obs.height);
        ctx.closePath();
        ctx.fill();
        break;
    }
  }

  // ========== 工具方法 ==========

  private rectOverlap(
    x1: number, y1: number, w1: number, h1: number,
    x2: number, y2: number, w2: number, h2: number
  ): boolean {
    return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
  }
}
