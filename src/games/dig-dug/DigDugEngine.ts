import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  COLS, ROWS, CELL_SIZE,
  PLAYER_SPEED, INITIAL_LIVES,
  PUMP_RANGE, PUMP_EXTEND_SPEED, PUMP_RETRACT_SPEED,
  INFLATE_TO_POP, PUMP_INFLATE_PER_PUMP,
  MONSTER_SPEED, MONSTER_SPEED_PER_LEVEL,
  MONSTER_GHOST_SPEED, GHOST_CHANCE_BASE, GHOST_CHANCE_PER_LEVEL,
  GHOST_DURATION_MIN, GHOST_DURATION_MAX,
  POOKA_COLOR, POOKA_SCORE_SHALLOW, POOKA_SCORE_MEDIUM, POOKA_SCORE_DEEP, POOKA_SCORE_VERY_DEEP,
  FYGAR_COLOR, FYGAR_SCORE_SHALLOW, FYGAR_SCORE_MEDIUM, FYGAR_SCORE_DEEP, FYGAR_SCORE_VERY_DEEP,
  FYGAR_FIRE_RANGE, FYGAR_FIRE_DURATION, FYGAR_FIRE_COOLDOWN, FYGAR_FIRE_CHANCE,
  ROCK_FALL_DELAY, ROCK_FALL_SPEED, ROCK_SCORE, ROCKS_PER_LEVEL,
  POOKA_BASE_COUNT, FYGAR_BASE_COUNT, POOKA_PER_LEVEL, FYGAR_PER_LEVEL, MONSTERS_PER_LEVEL_MAX,
  BG_COLOR, DIRT_COLORS, TUNNEL_COLOR, ROCK_COLOR,
  HUD_COLOR, SCORE_COLOR, PUMP_COLOR, FIRE_COLOR,
  DIR_UP, DIR_DOWN, DIR_LEFT, DIR_RIGHT,
  DEPTH_SHALLOW_END, DEPTH_MEDIUM_END, DEPTH_DEEP_END,
} from './constants';

// ========== 内部类型 ==========

/** 网格格子状态 */
type CellState = 'dirt' | 'tunnel';

/** 方向类型 */
type Direction = 'up' | 'down' | 'left' | 'right';

/** 玩家状态 */
interface Player {
  col: number;
  row: number;
  dir: Direction;
  alive: boolean;
  invincibleTimer: number; // 无敌时间（秒）
}

/** 充气泵状态 */
interface Pump {
  active: boolean;
  extending: boolean;
  retracting: boolean;
  dir: Direction;
  length: number; // 当前长度（格数）
  targetLength: number; // 目标长度
  targetMonster: number | null; // 绑定怪物索引
}

/** 怪物类型 */
type MonsterType = 'pooka' | 'fygar';

/** 怪物状态 */
type MonsterState = 'normal' | 'ghost' | 'inflating' | 'popping';

/** 怪物 */
interface Monster {
  type: MonsterType;
  col: number;
  row: number;
  dir: Direction;
  state: MonsterState;
  inflateLevel: number; // 0-4，4=爆炸
  ghostTimer: number; // 穿墙模式剩余时间
  moveTimer: number; // 移动计时器
  fireTimer: number; // Fygar 喷火冷却
  firing: boolean; // Fygar 是否正在喷火
  fireRemaining: number; // 喷火剩余时间
  fireDir: Direction; // 喷火方向
  alive: boolean;
  crushed: boolean; // 被岩石砸死
}

/** 岩石 */
interface Rock {
  col: number;
  row: number;
  falling: boolean;
  fallTimer: number; // 掉落延迟计时器
  waitingToFall: boolean; // 等待掉落
  fallY: number; // 精确 Y 坐标（用于平滑掉落）
  settled: boolean; // 已落地
  destroyed: boolean; // 已销毁
}

/** 火焰 */
interface Fire {
  col: number;
  row: number;
  dir: Direction;
  remaining: number; // 剩余时间
  range: number; // 当前范围
}

// ========== 工具函数 ==========

/** 获取深度得分 */
function getDepthScore(row: number, type: MonsterType): number {
  if (type === 'pooka') {
    if (row < DEPTH_SHALLOW_END) return POOKA_SCORE_SHALLOW;
    if (row < DEPTH_MEDIUM_END) return POOKA_SCORE_MEDIUM;
    if (row < DEPTH_DEEP_END) return POOKA_SCORE_DEEP;
    return POOKA_SCORE_VERY_DEEP;
  } else {
    if (row < DEPTH_SHALLOW_END) return FYGAR_SCORE_SHALLOW;
    if (row < DEPTH_MEDIUM_END) return FYGAR_SCORE_MEDIUM;
    if (row < DEPTH_DEEP_END) return FYGAR_SCORE_DEEP;
    return FYGAR_SCORE_VERY_DEEP;
  }
}

/** 方向偏移 */
function dirOffset(dir: Direction): [number, number] {
  switch (dir) {
    case DIR_UP: return [0, -1];
    case DIR_DOWN: return [0, 1];
    case DIR_LEFT: return [-1, 0];
    case DIR_RIGHT: return [1, 0];
  }
}

/** 反方向 */
function oppositeDir(dir: Direction): Direction {
  switch (dir) {
    case DIR_UP: return DIR_DOWN;
    case DIR_DOWN: return DIR_UP;
    case DIR_LEFT: return DIR_RIGHT;
    case DIR_RIGHT: return DIR_LEFT;
  }
}

/** 随机方向 */
function randomDirection(): Direction {
  const dirs: Direction[] = [DIR_UP, DIR_DOWN, DIR_LEFT, DIR_RIGHT];
  return dirs[Math.floor(Math.random() * dirs.length)];
}

/** 随机数范围 */
function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export class DigDugEngine extends GameEngine {
  // ========== 游戏状态 ==========

  // 网格
  private _grid: CellState[][] = [];

  // 玩家
  private _player: Player = {
    col: 0, row: 0, dir: DIR_RIGHT, alive: true, invincibleTimer: 0,
  };
  private _lives: number = INITIAL_LIVES;

  // 输入
  private _keys: Set<string> = new Set();
  private _pumpPressed: boolean = false;
  private _pumpJustPressed: boolean = false;

  // 充气泵
  private _pump: Pump = {
    active: false, extending: false, retracting: false,
    dir: DIR_RIGHT, length: 0, targetLength: 0, targetMonster: null,
  };

  // 怪物
  private _monsters: Monster[] = [];

  // 岩石
  private _rocks: Rock[] = [];

  // 火焰
  private _fires: Fire[] = [];

  // 关卡
  private _wave: number = 1;
  private _monstersSpawned: number = 0; // 本波已生成的怪物数

  // 玩家移动计时器（网格对齐移动）
  private _playerMoveTimer: number = 0;
  private _playerMoveInterval: number = 1 / PLAYER_SPEED;

  // ========== Public Getters ==========

  get playerCol(): number { return this._player.col; }
  get playerRow(): number { return this._player.row; }
  get playerDir(): Direction { return this._player.dir; }
  get lives(): number { return this._lives; }
  get monsters(): Monster[] { return this._monsters; }
  get rocks(): Rock[] { return this._rocks; }
  get pump(): Pump { return this._pump; }
  get fires(): Fire[] { return this._fires; }
  get wave(): number { return this._wave; }
  get grid(): CellState[][] { return this._grid; }
  get keys(): Set<string> { return this._keys; }

  /** 获取指定格的状态 */
  getCell(col: number, row: number): CellState {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return 'dirt';
    return this._grid[row][col];
  }

  /** 检查格子是否可通行（隧道或穿墙模式） */
  private isPassable(col: number, row: number, ghost: boolean = false): boolean {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
    return ghost || this._grid[row][col] === 'tunnel';
  }

  /** 检查格子是否有岩石占据 */
  private isRockAt(col: number, row: number): boolean {
    return this._rocks.some(r =>
      !r.destroyed && r.col === col && r.row === row
    );
  }

  // ========== GameEngine 抽象方法实现 ==========

  protected onInit(): void {
    this._grid = [];
    for (let r = 0; r < ROWS; r++) {
      this._grid[r] = [];
      for (let c = 0; c < COLS; c++) {
        this._grid[r][c] = 'dirt';
      }
    }
    // 初始隧道：顶部行挖开一行（玩家出生区域）
    for (let c = 0; c < COLS; c++) {
      this._grid[0][c] = 'tunnel';
    }

    this._player = {
      col: Math.floor(COLS / 2),
      row: 0,
      dir: DIR_RIGHT,
      alive: true,
      invincibleTimer: 0,
    };
    this._lives = INITIAL_LIVES;
    this._keys.clear();
    this._pumpPressed = false;
    this._pumpJustPressed = false;
    this._pump = {
      active: false, extending: false, retracting: false,
      dir: DIR_RIGHT, length: 0, targetLength: 0, targetMonster: null,
    };
    this._monsters = [];
    this._rocks = [];
    this._fires = [];
    this._wave = 1;
    this._monstersSpawned = 0;
    this._playerMoveTimer = 0;
    this._playerMoveInterval = 1 / PLAYER_SPEED;
  }

  protected onStart(): void {
    this.onInit();
    this.spawnLevel();
  }

  protected update(deltaTime: number): void {
    const dt = deltaTime / 1000;

    // 无敌时间递减
    if (this._player.invincibleTimer > 0) {
      this._player.invincibleTimer -= dt;
    }

    // 1. 玩家移动
    this.updatePlayer(dt);

    // 2. 充气泵
    this.updatePump(dt);

    // 3. 怪物 AI
    this.updateMonsters(dt);

    // 4. Fygar 喷火
    this.updateFires(dt);

    // 5. 岩石物理
    this.updateRocks(dt);

    // 6. 碰撞检测
    this.checkRockMonsterCollisions();
    this.checkRockPlayerCollision();
    this.checkFirePlayerCollision();
    this.checkMonsterPlayerCollision();

    // 7. 清理
    this.cleanup();

    // 8. 检查关卡完成
    this.checkWaveComplete();
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // 绘制网格
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = c * CELL_SIZE;
        const y = r * CELL_SIZE;
        if (this._grid[r][c] === 'dirt') {
          // 根据深度选择泥土颜色
          const colorIdx = Math.min(Math.floor(r / (ROWS / DIRT_COLORS.length)), DIRT_COLORS.length - 1);
          ctx.fillStyle = DIRT_COLORS[colorIdx];
          ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
        } else {
          ctx.fillStyle = TUNNEL_COLOR;
          ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
        }
      }
    }

    // 岩石
    for (const rock of this._rocks) {
      if (rock.destroyed) continue;
      const x = rock.col * CELL_SIZE;
      const y = rock.fallY;
      ctx.fillStyle = ROCK_COLOR;
      ctx.fillRect(x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4);
      // 岩石纹理
      ctx.strokeStyle = '#757575';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 6, y + CELL_SIZE / 2);
      ctx.lineTo(x + CELL_SIZE - 6, y + CELL_SIZE / 2);
      ctx.stroke();
    }

    // 火焰
    for (const fire of this._fires) {
      const [dx, dy] = dirOffset(fire.dir);
      for (let i = 1; i <= fire.range; i++) {
        const fx = (fire.col + dx * i) * CELL_SIZE;
        const fy = (fire.row + dy * i) * CELL_SIZE;
        ctx.fillStyle = FIRE_COLOR;
        ctx.globalAlpha = 0.8;
        ctx.fillRect(fx + 2, fy + 2, CELL_SIZE - 4, CELL_SIZE - 4);
      }
      ctx.globalAlpha = 1;
    }

    // 充气泵
    if (this._pump.active) {
      const startX = this._player.col * CELL_SIZE + CELL_SIZE / 2;
      const startY = this._player.row * CELL_SIZE + CELL_SIZE / 2;
      const [dx, dy] = dirOffset(this._pump.dir);
      const endX = startX + dx * this._pump.length * CELL_SIZE;
      const endY = startY + dy * this._pump.length * CELL_SIZE;
      ctx.strokeStyle = PUMP_COLOR;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }

    // 怪物
    for (const monster of this._monsters) {
      if (!monster.alive) continue;
      const x = monster.col * CELL_SIZE;
      const y = monster.row * CELL_SIZE;
      const inflateScale = 1 + monster.inflateLevel * 0.25;
      const size = CELL_SIZE * inflateScale;
      const offset = (size - CELL_SIZE) / 2;

      ctx.fillStyle = monster.type === 'pooka' ? POOKA_COLOR : FYGAR_COLOR;
      if (monster.state === 'ghost') {
        ctx.globalAlpha = 0.5;
      }
      ctx.beginPath();
      ctx.arc(x + CELL_SIZE / 2, y + CELL_SIZE / 2, size / 2 - 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // 玩家
    if (this._player.alive) {
      const px = this._player.col * CELL_SIZE;
      const py = this._player.row * CELL_SIZE;
      // 无敌闪烁
      if (this._player.invincibleTimer > 0 && Math.floor(this._player.invincibleTimer * 10) % 2 === 0) {
        ctx.globalAlpha = 0.4;
      }
      ctx.fillStyle = '#4fc3f7';
      ctx.fillRect(px + 4, py + 4, CELL_SIZE - 8, CELL_SIZE - 8);
      // 头盔
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(px + 6, py + 4, CELL_SIZE - 12, 6);
      ctx.globalAlpha = 1;
    }

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
    this._monsters = [];
    this._fires = [];
    this._rocks = [];
    this._pump.active = false;
  }

  handleKeyDown(key: string): void {
    this._keys.add(key);
    if (key === ' ') {
      this._pumpPressed = true;
      this._pumpJustPressed = true;
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
      this._pumpPressed = false;
    }
  }

  getState(): Record<string, unknown> {
    return {
      score: this._score,
      level: this._level,
      lives: this._lives,
      wave: this._wave,
      playerCol: this._player.col,
      playerRow: this._player.row,
      playerDir: this._player.dir,
      monsterCount: this._monsters.filter(m => m.alive).length,
      rockCount: this._rocks.filter(r => !r.destroyed).length,
      pumpActive: this._pump.active,
    };
  }

  // ========== 关卡生成 ==========

  private spawnLevel(): void {
    const pookaCount = Math.min(
      POOKA_BASE_COUNT + Math.floor((this._wave - 1) * POOKA_PER_LEVEL),
      MONSTERS_PER_LEVEL_MAX
    );
    const fygarCount = Math.min(
      FYGAR_BASE_COUNT + Math.floor((this._wave - 1) * FYGAR_PER_LEVEL),
      MONSTERS_PER_LEVEL_MAX - pookaCount
    );

    // 生成怪物
    this._monsters = [];
    for (let i = 0; i < pookaCount; i++) {
      this.spawnMonster('pooka');
    }
    for (let i = 0; i < fygarCount; i++) {
      this.spawnMonster('fygar');
    }
    this._monstersSpawned = this._monsters.length;

    // 生成岩石
    const rockCount = ROCKS_PER_LEVEL + Math.floor((this._wave - 1) * 0.5);
    for (let i = 0; i < rockCount; i++) {
      this.spawnRock();
    }

    // 为怪物创建初始小洞穴
    for (const monster of this._monsters) {
      this._grid[monster.row][monster.col] = 'tunnel';
    }
  }

  private spawnMonster(type: MonsterType): void {
    let col: number, row: number;
    let attempts = 0;
    const maxAttempts = 100;

    do {
      col = Math.floor(Math.random() * (COLS - 2)) + 1;
      row = Math.floor(Math.random() * (ROWS - 6)) + 4; // 不在顶部几行
      attempts++;
    } while (
      attempts < maxAttempts &&
      (this.isRockAt(col, row) ||
        (col === this._player.col && row === this._player.row) ||
        this._monsters.some(m => m.col === col && m.row === row))
    );

    this._monsters.push({
      type,
      col,
      row,
      dir: randomDirection(),
      state: 'normal',
      inflateLevel: 0,
      ghostTimer: 0,
      moveTimer: 0,
      fireTimer: FYGAR_FIRE_COOLDOWN,
      firing: false,
      fireRemaining: 0,
      fireDir: DIR_RIGHT,
      alive: true,
      crushed: false,
    });
  }

  private spawnRock(): void {
    let col: number, row: number;
    let attempts = 0;
    const maxAttempts = 100;

    do {
      col = Math.floor(Math.random() * (COLS - 2)) + 1;
      row = Math.floor(Math.random() * (ROWS - 8)) + 2;
      attempts++;
    } while (
      attempts < maxAttempts &&
      (this.isRockAt(col, row) ||
        (col === this._player.col && row === this._player.row) ||
        this._monsters.some(m => m.col === col && m.row === row) ||
        this._rocks.some(r => r.col === col && r.row === row))
    );

    this._rocks.push({
      col,
      row,
      falling: false,
      fallTimer: 0,
      waitingToFall: false,
      fallY: row * CELL_SIZE,
      settled: false,
      destroyed: false,
    });
  }

  // ========== 玩家逻辑 ==========

  private updatePlayer(dt: number): void {
    if (!this._player.alive) return;

    // 如果泵正在使用且绑定了怪物，不允许移动
    if (this._pump.active && this._pump.targetMonster !== null && !this._pump.retracting) {
      return;
    }

    // 确定方向
    let moveDir: Direction | null = null;
    if (this._keys.has('ArrowUp') || this._keys.has('w')) {
      moveDir = DIR_UP;
    } else if (this._keys.has('ArrowDown') || this._keys.has('s')) {
      moveDir = DIR_DOWN;
    } else if (this._keys.has('ArrowLeft') || this._keys.has('a')) {
      moveDir = DIR_LEFT;
    } else if (this._keys.has('ArrowRight') || this._keys.has('d')) {
      moveDir = DIR_RIGHT;
    }

    if (moveDir) {
      this._player.dir = moveDir;
      this._playerMoveTimer += dt;

      if (this._playerMoveTimer >= this._playerMoveInterval) {
        this._playerMoveTimer -= this._playerMoveInterval;
        this.movePlayer(moveDir);
      }
    } else {
      this._playerMoveTimer = 0;
    }
  }

  private movePlayer(dir: Direction): void {
    const [dx, dy] = dirOffset(dir);
    const newCol = this._player.col + dx;
    const newRow = this._player.row + dy;

    // 边界检查
    if (newCol < 0 || newCol >= COLS || newRow < 0 || newRow >= ROWS) return;

    // 岩石阻挡
    if (this.isRockAt(newCol, newRow)) return;

    // 移动并挖掘
    this._player.col = newCol;
    this._player.row = newRow;
    this._grid[newRow][newCol] = 'tunnel';

    // 检查是否有支撑的岩石（刚挖开岩石下方的泥土）
    this.checkRockSupport();
  }

  // ========== 充气泵逻辑 ==========

  private updatePump(dt: number): void {
    if (!this._pumpPressed && !this._pump.active) {
      this._pumpJustPressed = false;
      return;
    }

    // 首次按下空格：发射泵
    if (this._pumpJustPressed && !this._pump.active) {
      this.firePump();
      this._pumpJustPressed = false;
      // 继续处理延伸逻辑，不要 return
    } else {
      this._pumpJustPressed = false;
    }

    if (!this._pump.active) return;

    if (this._pump.extending) {
      // 延伸泵
      this._pump.length += PUMP_EXTEND_SPEED * dt;

      // 检查是否碰到泥土或边界
      const [dx, dy] = dirOffset(this._pump.dir);
      const tipCol = this._player.col + dx * Math.ceil(this._pump.length);
      const tipRow = this._player.row + dy * Math.ceil(this._pump.length);

      // 碰到泥土或边界：收回
      if (tipCol < 0 || tipCol >= COLS || tipRow < 0 || tipRow >= ROWS ||
          this._grid[tipRow]?.[tipCol] === 'dirt') {
        this.retractPump();
        return;
      }

      // 检查是否碰到怪物
      for (let i = 0; i < this._monsters.length; i++) {
        const m = this._monsters[i];
        if (!m.alive) continue;
        const pumpTipCol = this._player.col + dx * this._pump.length;
        const pumpTipRow = this._player.row + dy * this._pump.length;
        if (Math.floor(pumpTipCol) === m.col && Math.floor(pumpTipRow) === m.row) {
          this._pump.targetMonster = i;
          this._pump.extending = false;
          m.state = 'inflating';
          m.inflateLevel = Math.min(m.inflateLevel + PUMP_INFLATE_PER_PUMP, INFLATE_TO_POP);
          break;
        }
      }

      // 超出射程
      if (this._pump.length >= PUMP_RANGE) {
        this.retractPump();
      }
    } else if (this._pump.targetMonster !== null) {
      // 已绑定怪物：继续充气
      const monster = this._monsters[this._pump.targetMonster];
      if (!monster || !monster.alive) {
        this.retractPump();
        return;
      }

      // 持续按住空格充气
      if (this._pumpPressed) {
        monster.inflateLevel += dt * 2; // 每秒膨胀 2 级
        if (monster.inflateLevel >= INFLATE_TO_POP) {
          this.popMonster(this._pump.targetMonster);
          this.retractPump();
        }
      } else {
        // 松开空格：怪物慢慢消气
        monster.inflateLevel -= dt * 3;
        if (monster.inflateLevel <= 0) {
          monster.inflateLevel = 0;
          monster.state = 'normal';
          this.retractPump();
        }
      }
    } else if (this._pump.retracting) {
      // 收回泵
      this._pump.length -= PUMP_RETRACT_SPEED * dt;
      if (this._pump.length <= 0) {
        this._pump.active = false;
        this._pump.length = 0;
        this._pump.retracting = false;
      }
    }
  }

  private firePump(): void {
    this._pump = {
      active: true,
      extending: true,
      retracting: false,
      dir: this._player.dir,
      length: 0,
      targetLength: PUMP_RANGE,
      targetMonster: null,
    };
  }

  private retractPump(): void {
    this._pump.extending = false;
    this._pump.retracting = true;
    this._pump.targetMonster = null;
  }

  private popMonster(index: number): void {
    const monster = this._monsters[index];
    if (!monster || !monster.alive) return;

    monster.alive = false;
    monster.state = 'popping';
    this.addScore(getDepthScore(monster.row, monster.type));
    this.emit('monsterPopped', { type: monster.type, col: monster.col, row: monster.row });
  }

  // ========== 怪物 AI ==========

  private updateMonsters(dt: number): void {
    const speed = MONSTER_SPEED + (this._wave - 1) * MONSTER_SPEED_PER_LEVEL;
    const moveInterval = 1 / speed;

    for (let i = 0; i < this._monsters.length; i++) {
      const monster = this._monsters[i];
      if (!monster.alive) continue;

      // 正在充气中不移动
      if (monster.state === 'inflating') continue;

      // 穿墙模式计时
      if (monster.state === 'ghost') {
        monster.ghostTimer -= dt;
        if (monster.ghostTimer <= 0) {
          // 退出穿墙模式：如果当前位置是泥土，继续穿墙直到到达隧道
          if (this._grid[monster.row][monster.col] === 'tunnel') {
            monster.state = 'normal';
          }
          // 否则继续穿墙
        }
      } else {
        // 随机进入穿墙模式
        const ghostChance = GHOST_CHANCE_BASE + (this._wave - 1) * GHOST_CHANCE_PER_LEVEL;
        if (Math.random() < ghostChance) {
          monster.state = 'ghost';
          monster.ghostTimer = randRange(GHOST_DURATION_MIN, GHOST_DURATION_MAX);
        }
      }

      // Fygar 喷火逻辑
      if (monster.type === 'fygar' && monster.state === 'normal') {
        monster.fireTimer -= dt;
        if (monster.fireTimer <= 0 && !monster.firing) {
          // 检查是否与玩家在同一行且在射程内
          if (monster.row === this._player.row) {
            const colDiff = this._player.col - monster.col;
            if (Math.abs(colDiff) <= FYGAR_FIRE_RANGE) {
              monster.firing = true;
              monster.fireDir = colDiff > 0 ? DIR_RIGHT : DIR_LEFT;
              monster.fireRemaining = FYGAR_FIRE_DURATION;
              this._fires.push({
                col: monster.col,
                row: monster.row,
                dir: monster.fireDir,
                remaining: FYGAR_FIRE_DURATION,
                range: FYGAR_FIRE_RANGE,
              });
            }
          }
          monster.fireTimer = FYGAR_FIRE_COOLDOWN;
        }

        if (monster.firing) {
          monster.fireRemaining -= dt;
          if (monster.fireRemaining <= 0) {
            monster.firing = false;
          }
        }
      }

      // 移动
      monster.moveTimer += dt;
      if (monster.moveTimer >= moveInterval) {
        monster.moveTimer -= moveInterval;
        this.moveMonster(monster);
      }
    }
  }

  private moveMonster(monster: Monster): void {
    const isGhost = monster.state === 'ghost';

    // 尝试朝玩家方向移动（简单 AI）
    const preferredDirs = this.getPreferredDirections(monster);

    for (const dir of preferredDirs) {
      const [dx, dy] = dirOffset(dir);
      const newCol = monster.col + dx;
      const newRow = monster.row + dy;

      if (newCol < 0 || newCol >= COLS || newRow < 0 || newRow >= ROWS) continue;
      if (this.isRockAt(newCol, newRow)) continue;
      if (!this.isPassable(newCol, newRow, isGhost)) continue;

      monster.col = newCol;
      monster.row = newRow;
      monster.dir = dir;
      return;
    }

    // 无法朝玩家方向移动，随机选择可通行方向
    const dirs: Direction[] = [DIR_UP, DIR_DOWN, DIR_LEFT, DIR_RIGHT];
    // 打乱顺序
    for (let i = dirs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
    }

    for (const dir of dirs) {
      const [dx, dy] = dirOffset(dir);
      const newCol = monster.col + dx;
      const newRow = monster.row + dy;

      if (newCol < 0 || newCol >= COLS || newRow < 0 || newRow >= ROWS) continue;
      if (this.isRockAt(newCol, newRow)) continue;
      if (!this.isPassable(newCol, newRow, isGhost)) continue;

      monster.col = newCol;
      monster.row = newRow;
      monster.dir = dir;
      return;
    }
  }

  /** 获取怪物朝玩家方向的偏好方向列表 */
  private getPreferredDirections(monster: Monster): Direction[] {
    const dx = this._player.col - monster.col;
    const dy = this._player.row - monster.row;
    const dirs: Direction[] = [];

    // 水平方向优先
    if (Math.abs(dx) >= Math.abs(dy)) {
      if (dx > 0) dirs.push(DIR_RIGHT);
      else if (dx < 0) dirs.push(DIR_LEFT);
      if (dy > 0) dirs.push(DIR_DOWN);
      else if (dy < 0) dirs.push(DIR_UP);
    } else {
      if (dy > 0) dirs.push(DIR_DOWN);
      else if (dy < 0) dirs.push(DIR_UP);
      if (dx > 0) dirs.push(DIR_RIGHT);
      else if (dx < 0) dirs.push(DIR_LEFT);
    }

    // 补充其他方向
    const allDirs: Direction[] = [DIR_UP, DIR_DOWN, DIR_LEFT, DIR_RIGHT];
    for (const d of allDirs) {
      if (!dirs.includes(d)) dirs.push(d);
    }

    return dirs;
  }

  // ========== 火焰逻辑 ==========

  private updateFires(dt: number): void {
    for (let i = this._fires.length - 1; i >= 0; i--) {
      this._fires[i].remaining -= dt;
      if (this._fires[i].remaining <= 0) {
        this._fires.splice(i, 1);
      }
    }
  }

  // ========== 岩石逻辑 ==========

  private checkRockSupport(): void {
    for (const rock of this._rocks) {
      if (rock.destroyed || rock.falling || rock.waitingToFall) continue;
      const belowRow = rock.row + 1;
      // 检查下方是否有支撑（泥土或另一块已落地的岩石）
      if (belowRow >= ROWS) continue; // 底部有支撑
      if (this._grid[belowRow][rock.col] === 'tunnel' && !this.isRockAt(rock.col, belowRow)) {
        rock.waitingToFall = true;
        rock.fallTimer = ROCK_FALL_DELAY;
      }
    }
  }

  private updateRocks(dt: number): void {
    for (const rock of this._rocks) {
      if (rock.destroyed) continue;

      if (rock.waitingToFall && !rock.falling) {
        rock.fallTimer -= dt;
        if (rock.fallTimer <= 0) {
          rock.falling = true;
          rock.waitingToFall = false;
        }
      }

      if (rock.falling) {
        rock.fallY += ROCK_FALL_SPEED * CELL_SIZE * dt;
        const newRow = Math.floor(rock.fallY / CELL_SIZE);

        // 检查是否落地
        let landed = false;
        if (newRow >= ROWS - 1) {
          landed = true;
        } else if (newRow > rock.row) {
          // 检查新行是否有支撑
          if (this._grid[newRow + 1]?.[rock.col] === 'dirt' || this.isRockAt(rock.col, newRow + 1)) {
            landed = true;
          }
        }

        if (landed) {
          rock.row = Math.min(newRow, ROWS - 1);
          rock.fallY = rock.row * CELL_SIZE;
          // 落地前先检测碰撞（怪物和玩家）
          this.checkRockCollisionAt(rock);
          rock.falling = false;
          rock.settled = true;
        } else {
          rock.row = newRow;
          // 下落过程中也检测碰撞
          this.checkRockCollisionAt(rock);
        }
      }
    }
  }

  // ========== 碰撞检测 ==========

  /** 检测岩石在当前位置的碰撞（怪物和玩家） */
  private checkRockCollisionAt(rock: Rock): void {
    if (rock.destroyed) return;
    const rockRow = Math.floor(rock.fallY / CELL_SIZE);
    // 砸怪物
    for (const monster of this._monsters) {
      if (!monster.alive) continue;
      if (rock.col === monster.col && rockRow === monster.row) {
        monster.alive = false;
        monster.crushed = true;
        monster.state = 'popping';
        this.addScore(ROCK_SCORE);
        this.emit('monsterCrushed', { type: monster.type, col: monster.col, row: monster.row });
      }
    }
    // 砸玩家
    if (rock.col === this._player.col && rockRow === this._player.row) {
      this.playerHit();
    }
  }

  /** 岩石砸怪物 */
  private checkRockMonsterCollisions(): void {
    for (const rock of this._rocks) {
      if (rock.destroyed || !rock.falling) continue;
      const rockRow = Math.floor(rock.fallY / CELL_SIZE);
      for (const monster of this._monsters) {
        if (!monster.alive) continue;
        if (rock.col === monster.col && rockRow === monster.row) {
          monster.alive = false;
          monster.crushed = true;
          monster.state = 'popping';
          this.addScore(ROCK_SCORE);
          this.emit('monsterCrushed', { type: monster.type, col: monster.col, row: monster.row });
        }
      }
    }
  }

  /** 岩石砸玩家 */
  private checkRockPlayerCollision(): void {
    for (const rock of this._rocks) {
      if (rock.destroyed || !rock.falling) continue;
      const rockRow = Math.floor(rock.fallY / CELL_SIZE);
      if (rock.col === this._player.col && rockRow === this._player.row) {
        this.playerHit();
        return;
      }
    }
  }

  /** 火焰烧玩家 */
  private checkFirePlayerCollision(): void {
    for (const fire of this._fires) {
      const [dx, dy] = dirOffset(fire.dir);
      for (let i = 1; i <= fire.range; i++) {
        const fCol = fire.col + dx * i;
        const fRow = fire.row + dy * i;
        if (fCol === this._player.col && fRow === this._player.row) {
          this.playerHit();
          return;
        }
      }
    }
  }

  /** 怪物碰玩家 */
  private checkMonsterPlayerCollision(): void {
    if (this._player.invincibleTimer > 0) return;
    for (const monster of this._monsters) {
      if (!monster.alive || monster.state === 'inflating') continue;
      if (monster.col === this._player.col && monster.row === this._player.row) {
        this.playerHit();
        return;
      }
    }
  }

  /** 玩家被击中 */
  private playerHit(): void {
    if (this._player.invincibleTimer > 0) return;
    this._lives--;
    this.emit('loseLife', this._lives);
    if (this._lives <= 0) {
      this.gameOver();
    } else {
      // 重置玩家位置
      this._player.col = Math.floor(COLS / 2);
      this._player.row = 0;
      this._player.invincibleTimer = 2; // 2 秒无敌
      // 收回泵
      this.retractPump();
      this._pump.active = false;
      this._pump.length = 0;
    }
  }

  // ========== 清理 ==========

  private cleanup(): void {
    // 清理已死亡怪物（保留 popping 状态的怪物用于动画）
    this._monsters = this._monsters.filter(m => m.alive || m.state === 'popping');

    // 清理已销毁的岩石
    this._rocks = this._rocks.filter(r => !r.destroyed);

    // 清理已落地的岩石（落定后标记销毁）
    for (const rock of this._rocks) {
      if (rock.settled && !rock.falling) {
        // 岩石落地后保留（不销毁），除非需要清理
        // 实际上经典 Dig Dug 中岩石落地后碎裂消失
        rock.destroyed = true;
      }
    }
  }

  // ========== 波次检查 ==========

  private checkWaveComplete(): void {
    if (this._monstersSpawned === 0) return; // 还没生成过怪物
    const aliveMonsters = this._monsters.filter(m => m.alive);
    if (aliveMonsters.length === 0) {
      this.nextWave();
    }
  }

  private nextWave(): void {
    this._wave++;
    this._level = this._wave;
    this.setLevel(this._level);
    this._monsters = [];
    this._rocks = [];
    this._fires = [];
    this._pump.active = false;
    this._pump.length = 0;

    // 重新生成关卡（保留隧道）
    this.spawnLevel();

    this.emit('waveChange', this._wave);
  }
}
