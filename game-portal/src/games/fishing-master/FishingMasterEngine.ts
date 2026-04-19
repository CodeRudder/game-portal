import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  WATER_SURFACE_Y,
  BOAT_Y,
  BOAT_WIDTH,
  BOAT_HEIGHT,
  BOAT_SPEED,
  BOAT_MIN_X,
  BOAT_MAX_X,
  HOOK_WIDTH,
  HOOK_HEIGHT,
  HOOK_SINK_SPEED,
  HOOK_REEL_SPEED,
  HOOK_MAX_DEPTH,
  HOOK_LINE_WIDTH,
  HookState,
  FishType,
  FISH_CONFIGS,
  TOTAL_SPAWN_WEIGHT,
  MAX_FISH_COUNT,
  FISH_SPAWN_INTERVAL,
  FISH_MIN_Y,
  FISH_MAX_Y,
  GAME_DURATION,
  COMBO_WINDOW,
  COMBO_MULTIPLIER_STEP,
  MAX_COMBO_MULTIPLIER,
  COMBO_BASE_MULTIPLIER,
  SKY_COLOR,
  WATER_TOP_COLOR,
  WATER_BOTTOM_COLOR,
  BOAT_COLOR,
  BOAT_DARK_COLOR,
  HOOK_COLOR,
  LINE_COLOR,
  BOAT_SAIL_COLOR,
  SCORE_POPUP_DURATION,
} from './constants';
import type { FishConfig } from './constants';

// ========== 类型定义 ==========

interface Fish {
  x: number;
  y: number;
  type: FishType;
  width: number;
  height: number;
  speed: number;
  score: number;
  color: string;
  direction: 1 | -1;
  alive: boolean;
  tailPhase: number; // 尾巴摆动动画
}

interface Hook {
  x: number;
  y: number;
  state: HookState;
  caughtFish: Fish | null;
}

interface ScorePopup {
  x: number;
  y: number;
  score: number;
  timer: number;
  color: string;
}

interface Boat {
  x: number;
  y: number;
}

// ========== 捕鱼达人引擎 ==========

export class FishingMasterEngine extends GameEngine {
  // 船
  private boat: Boat = { x: CANVAS_WIDTH / 2, y: BOAT_Y };

  // 鱼钩
  private hook: Hook = {
    x: CANVAS_WIDTH / 2,
    y: BOAT_Y + BOAT_HEIGHT,
    state: HookState.IDLE,
    caughtFish: null,
  };

  // 鱼群
  private fishes: Fish[] = [];

  // 分数弹出动画
  private scorePopups: ScorePopup[] = [];

  // 计时器
  private fishSpawnTimer: number = 0;
  private tailAnimTimer: number = 0;

  // 连击系统
  private comboCount: number = 0;
  private lastCatchTime: number = 0;
  private comboMultiplier: number = COMBO_BASE_MULTIPLIER;

  // 游戏时间追踪
  private gameStartTime: number = 0;
  private remainingTime: number = GAME_DURATION;
  private manualTimeControl: boolean = false; // 手动时间控制标志（测试用）

  // 输入状态
  private keysPressed: Set<string> = new Set();

  // ========== 生命周期 ==========

  protected onInit(): void {
    // 初始化完成
  }

  protected onStart(): void {
    this.boat = { x: CANVAS_WIDTH / 2, y: BOAT_Y };
    this.hook = {
      x: CANVAS_WIDTH / 2,
      y: BOAT_Y + BOAT_HEIGHT,
      state: HookState.IDLE,
      caughtFish: null,
    };
    this.fishes = [];
    this.scorePopups = [];
    this.fishSpawnTimer = 0;
    this.tailAnimTimer = 0;
    this.comboCount = 0;
    this.lastCatchTime = 0;
    this.comboMultiplier = COMBO_BASE_MULTIPLIER;
    this.remainingTime = GAME_DURATION;
    this.gameStartTime = Date.now();
    this.keysPressed.clear();
  }

  protected onReset(): void {
    this.boat = { x: CANVAS_WIDTH / 2, y: BOAT_Y };
    this.hook = {
      x: CANVAS_WIDTH / 2,
      y: BOAT_Y + BOAT_HEIGHT,
      state: HookState.IDLE,
      caughtFish: null,
    };
    this.fishes = [];
    this.scorePopups = [];
    this.fishSpawnTimer = 0;
    this.tailAnimTimer = 0;
    this.comboCount = 0;
    this.lastCatchTime = 0;
    this.comboMultiplier = COMBO_BASE_MULTIPLIER;
    this.remainingTime = GAME_DURATION;
    this.keysPressed.clear();
  }

  protected update(deltaTime: number): void {
    const dt = deltaTime / 16.667; // 标准化到 60fps

    // 更新游戏时间
    this.updateGameTime();

    // 更新船位置
    this.updateBoat(dt);

    // 更新鱼钩
    this.updateHook(dt);

    // 更新鱼群
    this.updateFishes(dt);

    // 生成新鱼
    this.spawnFishes(deltaTime);

    // 碰撞检测（鱼钩与鱼）
    if (this.hook.state === HookState.SINKING) {
      this.checkHookFishCollision();
    }

    // 更新分数弹出动画
    this.updateScorePopups(deltaTime);

    // 更新尾巴动画
    this.tailAnimTimer += deltaTime;

    // 检查游戏结束
    if (this.remainingTime <= 0) {
      this.gameOver();
    }
  }

  // ========== 渲染 ==========

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 天空
    this.drawSky(ctx, w);

    // 水面
    this.drawWater(ctx, w, h);

    // 鱼
    this.fishes.forEach((fish) => {
      if (fish.alive) this.drawFish(ctx, fish);
    });

    // 鱼钩和线
    this.drawHookAndLine(ctx);

    // 船
    this.drawBoat(ctx);

    // 分数弹出
    this.drawScorePopups(ctx);

    // HUD
    this.drawHUD(ctx, w);
  }

  // ========== 输入处理 ==========

  handleKeyDown(key: string): void {
    this.keysPressed.add(key);

    if (key === ' ') {
      this.dropHook();
    }
  }

  handleKeyUp(key: string): void {
    this.keysPressed.delete(key);
  }

  getState(): Record<string, unknown> {
    return {
      boatX: this.boat.x,
      hookX: this.hook.x,
      hookY: this.hook.y,
      hookState: this.hook.state,
      fishCount: this.fishes.filter((f) => f.alive).length,
      comboCount: this.comboCount,
      comboMultiplier: this.comboMultiplier,
      remainingTime: this.remainingTime,
      score: this._score,
    };
  }

  // ========== 公共方法（供测试调用） ==========

  /** 放下鱼钩 */
  dropHook(): void {
    if (this._status !== 'playing') return;
    if (this.hook.state !== HookState.IDLE) return;
    this.hook.state = HookState.SINKING;
  }

  /** 获取当前船的 X 坐标 */
  getBoatX(): number {
    return this.boat.x;
  }

  /** 获取鱼钩状态 */
  getHookState(): HookState {
    return this.hook.state;
  }

  /** 获取鱼钩位置 */
  getHookPosition(): { x: number; y: number } {
    return { x: this.hook.x, y: this.hook.y };
  }

  /** 获取当前鱼群 */
  getFishes(): Fish[] {
    return [...this.fishes];
  }

  /** 获取活鱼数量 */
  getAliveFishCount(): number {
    return this.fishes.filter((f) => f.alive).length;
  }

  /** 获取连击数 */
  getComboCount(): number {
    return this.comboCount;
  }

  /** 获取连击倍率 */
  getComboMultiplier(): number {
    return this.comboMultiplier;
  }

  /** 获取剩余时间 */
  getRemainingTime(): number {
    return this.remainingTime;
  }

  /** 获取分数弹出列表 */
  getScorePopups(): ScorePopup[] {
    return [...this.scorePopups];
  }

  /** 手动添加一条鱼（供测试用） */
  addFish(fish: Fish): void {
    this.fishes.push(fish);
  }

  /** 手动设置鱼钩位置（供测试用） */
  setHookPosition(x: number, y: number): void {
    this.hook.x = x;
    this.hook.y = y;
  }

  /** 手动设置船位置（供测试用） */
  setBoatPosition(x: number): void {
    this.boat.x = Math.max(BOAT_MIN_X, Math.min(BOAT_MAX_X, x));
    if (this.hook.state === HookState.IDLE) {
      this.hook.x = this.boat.x;
    }
  }

  /** 手动设置鱼钩状态（供测试用） */
  setHookState(state: HookState): void {
    this.hook.state = state;
  }

  /** 手动设置剩余时间（供测试用） */
  setRemainingTime(time: number): void {
    this.remainingTime = Math.max(0, time);
    this.manualTimeControl = true;
  }

  /** 获取被捕获的鱼 */
  getCaughtFish(): Fish | null {
    return this.hook.caughtFish;
  }

  /** 处理捕获的鱼（供测试直接调用） */
  processCatchPublic(fish: Fish): void {
    this.processCatch(fish);
  }

  /**
   * 强制完成收回流程（供测试用）
   * 将鱼钩移到船底位置，触发 processCatch，并重置为 IDLE 状态。
   */
  forceCompleteReel(): void {
    if (this.hook.state !== HookState.REELING) return;
    this.hook.y = this.boat.y + BOAT_HEIGHT;
    if (this.hook.caughtFish) {
      this.processCatch(this.hook.caughtFish);
      this.hook.caughtFish = null;
    }
    this.hook.state = HookState.IDLE;
  }

  // ========== 私有方法 ==========

  private updateGameTime(): void {
    if (this.manualTimeControl) return; // 手动控制时间时不自动更新
    const elapsed = (Date.now() - this.gameStartTime) / 1000;
    this.remainingTime = Math.max(0, GAME_DURATION - elapsed);
  }

  private updateBoat(dt: number): void {
    if (this.keysPressed.has('ArrowLeft') || this.keysPressed.has('a') || this.keysPressed.has('A')) {
      this.boat.x = Math.max(BOAT_MIN_X, this.boat.x - BOAT_SPEED * dt);
    }
    if (this.keysPressed.has('ArrowRight') || this.keysPressed.has('d') || this.keysPressed.has('D')) {
      this.boat.x = Math.min(BOAT_MAX_X, this.boat.x + BOAT_SPEED * dt);
    }

    // 鱼钩空闲时跟随船
    if (this.hook.state === HookState.IDLE) {
      this.hook.x = this.boat.x;
    }
  }

  private updateHook(dt: number): void {
    switch (this.hook.state) {
      case HookState.SINKING:
        this.hook.y += HOOK_SINK_SPEED * dt;
        // 到达最大深度，自动收回
        if (this.hook.y >= HOOK_MAX_DEPTH) {
          this.hook.y = HOOK_MAX_DEPTH;
          this.hook.state = HookState.REELING;
        }
        break;

      case HookState.REELING:
        this.hook.y -= HOOK_REEL_SPEED * dt;
        // 带鱼时鱼跟随钩子
        if (this.hook.caughtFish) {
          this.hook.caughtFish.x = this.hook.x;
          this.hook.caughtFish.y = this.hook.y + HOOK_HEIGHT / 2;
        }
        // 收回到船的位置
        if (this.hook.y <= this.boat.y + BOAT_HEIGHT) {
          this.hook.y = this.boat.y + BOAT_HEIGHT;
          this.hook.state = HookState.IDLE;
          // 处理捕获的鱼
          if (this.hook.caughtFish) {
            this.processCatch(this.hook.caughtFish);
            this.hook.caughtFish = null;
          }
        }
        break;

      case HookState.IDLE:
        // 跟随船的 X 位置
        this.hook.x = this.boat.x;
        this.hook.y = this.boat.y + BOAT_HEIGHT;
        break;
    }
  }

  private updateFishes(dt: number): void {
    for (const fish of this.fishes) {
      if (!fish.alive) continue;

      // 移动鱼
      fish.x += fish.speed * fish.direction * dt;

      // 尾巴摆动
      fish.tailPhase += dt * 0.15;

      // 超出屏幕则标记为死亡（可被清理）
      if (fish.direction === 1 && fish.x > CANVAS_WIDTH + fish.width) {
        fish.alive = false;
      } else if (fish.direction === -1 && fish.x < -fish.width) {
        fish.alive = false;
      }
    }

    // 清理死鱼
    this.fishes = this.fishes.filter((f) => f.alive);
  }

  private spawnFishes(deltaTime: number): void {
    this.fishSpawnTimer += deltaTime;

    if (this.fishSpawnTimer >= FISH_SPAWN_INTERVAL) {
      this.fishSpawnTimer = 0;

      const aliveCount = this.fishes.filter((f) => f.alive).length;
      if (aliveCount < MAX_FISH_COUNT) {
        this.spawnOneFish();
      }
    }
  }

  /** 生成一条随机鱼 */
  spawnOneFish(): Fish {
    const config = this.getRandomFishConfig();
    const direction: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
    const y = FISH_MIN_Y + Math.random() * (FISH_MAX_Y - FISH_MIN_Y);
    const x = direction === 1 ? -config.width : CANVAS_WIDTH + config.width;

    const fish: Fish = {
      x,
      y,
      type: config.type,
      width: config.width,
      height: config.height,
      speed: config.speed,
      score: config.score,
      color: config.color,
      direction,
      alive: true,
      tailPhase: Math.random() * Math.PI * 2,
    };

    this.fishes.push(fish);
    return fish;
  }

  /** 根据权重随机选择鱼种配置 */
  private getRandomFishConfig(): Omit<FishConfig, 'direction'> {
    let rand = Math.random() * TOTAL_SPAWN_WEIGHT;
    for (const type of Object.values(FishType)) {
      const config = FISH_CONFIGS[type];
      rand -= config.spawnWeight;
      if (rand <= 0) {
        return config;
      }
    }
    // 兜底返回小鱼
    return FISH_CONFIGS[FishType.SMALL];
  }

  private checkHookFishCollision(): void {
    if (this.hook.caughtFish) return; // 已经抓到鱼了

    const hookLeft = this.hook.x - HOOK_WIDTH / 2;
    const hookRight = this.hook.x + HOOK_WIDTH / 2;
    const hookTop = this.hook.y - HOOK_HEIGHT / 2;
    const hookBottom = this.hook.y + HOOK_HEIGHT / 2;

    for (const fish of this.fishes) {
      if (!fish.alive) continue;

      const fishLeft = fish.x - fish.width / 2;
      const fishRight = fish.x + fish.width / 2;
      const fishTop = fish.y - fish.height / 2;
      const fishBottom = fish.y + fish.height / 2;

      // AABB 碰撞检测
      if (
        hookLeft <= fishRight &&
        hookRight >= fishLeft &&
        hookTop <= fishBottom &&
        hookBottom >= fishTop
      ) {
        // 命中！
        fish.alive = false;
        this.hook.caughtFish = fish;
        this.hook.state = HookState.REELING;
        break;
      }
    }
  }

  private processCatch(fish: Fish): void {
    const now = Date.now();

    // 更新连击
    if (now - this.lastCatchTime <= COMBO_WINDOW && this.lastCatchTime > 0) {
      this.comboCount++;
      this.comboMultiplier = Math.min(
        MAX_COMBO_MULTIPLIER,
        COMBO_BASE_MULTIPLIER + this.comboCount * COMBO_MULTIPLIER_STEP
      );
    } else {
      this.comboCount = 0;
      this.comboMultiplier = COMBO_BASE_MULTIPLIER;
    }
    this.lastCatchTime = now;

    // 计算得分（含连击倍率）
    const finalScore = Math.round(fish.score * this.comboMultiplier);
    this.addScore(finalScore);

    // 添加分数弹出
    const popupColor = fish.score > 0 ? '#FFD700' : '#FF4444';
    this.scorePopups.push({
      x: this.hook.x,
      y: this.boat.y + BOAT_HEIGHT,
      score: finalScore,
      timer: SCORE_POPUP_DURATION,
      color: popupColor,
    });
  }

  private updateScorePopups(deltaTime: number): void {
    for (const popup of this.scorePopups) {
      popup.timer -= deltaTime;
      popup.y -= 0.5 * (deltaTime / 16.667); // 向上飘
    }
    this.scorePopups = this.scorePopups.filter((p) => p.timer > 0);
  }

  // ========== 渲染辅助 ==========

  private drawSky(ctx: CanvasRenderingContext2D, w: number): void {
    ctx.fillStyle = SKY_COLOR;
    ctx.fillRect(0, 0, w, WATER_SURFACE_Y);
  }

  private drawWater(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const grad = ctx.createLinearGradient(0, WATER_SURFACE_Y, 0, h);
    grad.addColorStop(0, WATER_TOP_COLOR);
    grad.addColorStop(1, WATER_BOTTOM_COLOR);
    ctx.fillStyle = grad;
    ctx.fillRect(0, WATER_SURFACE_Y, w, h - WATER_SURFACE_Y);

    // 水面波浪线
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x < w; x += 2) {
      const waveY = WATER_SURFACE_Y + Math.sin((x + this.tailAnimTimer * 0.02) * 0.05) * 3;
      if (x === 0) ctx.moveTo(x, waveY);
      else ctx.lineTo(x, waveY);
    }
    ctx.stroke();
  }

  private drawBoat(ctx: CanvasRenderingContext2D): void {
    const bx = this.boat.x;
    const by = this.boat.y;

    // 船身
    ctx.fillStyle = BOAT_COLOR;
    ctx.beginPath();
    ctx.moveTo(bx - BOAT_WIDTH / 2, by);
    ctx.lineTo(bx - BOAT_WIDTH / 2 + 8, by + BOAT_HEIGHT);
    ctx.lineTo(bx + BOAT_WIDTH / 2 - 8, by + BOAT_HEIGHT);
    ctx.lineTo(bx + BOAT_WIDTH / 2, by);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = BOAT_DARK_COLOR;
    ctx.lineWidth = 2;
    ctx.stroke();

    // 船舱
    ctx.fillStyle = BOAT_DARK_COLOR;
    ctx.fillRect(bx - 10, by + 4, 20, 10);

    // 桅杆
    ctx.strokeStyle = '#5D4037';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx, by - 35);
    ctx.stroke();

    // 帆
    ctx.fillStyle = BOAT_SAIL_COLOR;
    ctx.beginPath();
    ctx.moveTo(bx, by - 35);
    ctx.lineTo(bx + 20, by - 20);
    ctx.lineTo(bx, by - 10);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#BDBDBD';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  private drawHookAndLine(ctx: CanvasRenderingContext2D): void {
    if (this.hook.state === HookState.IDLE) return;

    // 钓线
    ctx.strokeStyle = LINE_COLOR;
    ctx.lineWidth = HOOK_LINE_WIDTH;
    ctx.beginPath();
    ctx.moveTo(this.boat.x, this.boat.y + BOAT_HEIGHT);
    ctx.lineTo(this.hook.x, this.hook.y);
    ctx.stroke();

    // 鱼钩
    ctx.fillStyle = HOOK_COLOR;
    ctx.beginPath();
    ctx.arc(this.hook.x, this.hook.y, HOOK_WIDTH / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#78909C';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 钩子弯曲部分
    ctx.strokeStyle = HOOK_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.hook.x, this.hook.y + HOOK_HEIGHT / 2, HOOK_WIDTH / 2, 0, Math.PI);
    ctx.stroke();
  }

  private drawFish(ctx: CanvasRenderingContext2D, fish: Fish): void {
    ctx.save();
    ctx.translate(fish.x, fish.y);

    // 根据方向翻转
    if (fish.direction === -1) {
      ctx.scale(-1, 1);
    }

    const hw = fish.width / 2;
    const hh = fish.height / 2;
    const tailSwing = Math.sin(fish.tailPhase) * 3;

    // 尾巴
    ctx.fillStyle = fish.color;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.moveTo(-hw, 0);
    ctx.lineTo(-hw - 10, -hh + tailSwing);
    ctx.lineTo(-hw - 10, hh + tailSwing);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // 身体（椭圆）
    ctx.fillStyle = fish.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, hw, hh, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 鱼鳍
    ctx.fillStyle = fish.color;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.ellipse(0, -hh + 2, hw * 0.4, 5, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // 眼睛
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(hw * 0.5, -hh * 0.2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(hw * 0.55, -hh * 0.2, 2, 0, Math.PI * 2);
    ctx.fill();

    // 河豚特殊标记：斑点
    if (fish.type === FishType.PUFFER) {
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath();
      ctx.arc(-5, 3, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(5, -2, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(2, 5, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private drawScorePopups(ctx: CanvasRenderingContext2D): void {
    for (const popup of this.scorePopups) {
      const alpha = Math.max(0, popup.timer / SCORE_POPUP_DURATION);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = popup.color;
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'center';
      const text = popup.score > 0 ? `+${popup.score}` : `${popup.score}`;
      ctx.fillText(text, popup.x, popup.y);

      // 连击提示
      if (this.comboCount > 0 && popup.score > 0) {
        ctx.font = 'bold 12px monospace';
        ctx.fillStyle = '#FF9800';
        ctx.fillText(`x${this.comboMultiplier.toFixed(1)}`, popup.x, popup.y + 16);
      }

      ctx.globalAlpha = 1;
    }
  }

  private drawHUD(ctx: CanvasRenderingContext2D, w: number): void {
    // 时间条背景
    const barWidth = w - 40;
    const barHeight = 8;
    const barX = 20;
    const barY = 12;

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // 时间条
    const timeRatio = this.remainingTime / GAME_DURATION;
    const timeColor = timeRatio > 0.3 ? '#4CAF50' : timeRatio > 0.1 ? '#FF9800' : '#F44336';
    ctx.fillStyle = timeColor;
    ctx.fillRect(barX, barY, barWidth * timeRatio, barHeight);

    // 时间文字
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.ceil(this.remainingTime)}s`, w / 2, barY + barHeight + 16);

    // 分数
    ctx.textAlign = 'left';
    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = '#FFD700';
    ctx.fillText(`Score: ${this._score}`, 20, barY + barHeight + 34);

    // 连击
    if (this.comboCount > 0) {
      ctx.fillStyle = '#FF9800';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(`Combo x${this.comboMultiplier.toFixed(1)}`, 20, barY + barHeight + 52);
    }
  }
}
