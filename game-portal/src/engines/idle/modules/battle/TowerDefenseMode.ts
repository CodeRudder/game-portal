/**
 * TowerDefenseMode — 塔防战斗模式
 *
 * 参考 Kingdom Rush / 植物大战僵尸的经典塔防玩法：
 * - 敌方单位沿预设路径行进（线性插值移动）
 * - 攻击方单位（塔）固定在路径旁的防御位上
 * - 每波敌人越来越强
 * - 塔有攻击范围，自动攻击范围内最近的敌人
 * - 塔可以升级（增加攻击力/范围/攻速）
 * - 生命值系统：敌人到达终点扣减生命值
 * - 金币系统：击杀敌人获得金币，用于建塔/升级
 *
 * 设计原则：
 * - 零外部依赖，纯 TypeScript 实现
 * - 坐标系统使用像素坐标
 * - 敌人移动使用路径节点间的线性插值
 * - 塔攻击找最近的敌人
 *
 * @module engines/idle/modules/battle/TowerDefenseMode
 */

import type {
  IBattleMode,
  BattleModeContext,
  BattleResult,
} from './BattleMode';

// ============================================================
// 类型定义
// ============================================================

/** 路径节点 */
export interface PathNode {
  x: number;
  y: number;
}

/** 防御塔定义 */
export interface TowerDef {
  /** 塔定义 ID */
  id: string;
  /** 塔名称 */
  name: string;
  /** 基础攻击力 */
  attack: number;
  /** 攻击范围（像素） */
  range: number;
  /** 每秒攻击次数 */
  attackSpeed: number;
  /** 建造费用 */
  cost: number;
  /** 升级费用（可选，不提供则不可升级） */
  upgradeCost?: number;
  /** 升级后攻击力（可选） */
  upgradeAttack?: number;
  /** 升级后范围（可选） */
  upgradeRange?: number;
  /** 溅射范围（0 = 单体） */
  splashRadius?: number;
  /** 减速因子（0~1，0 = 无减速，1 = 完全停止） */
  slowFactor?: number;
}

/** 防御塔运行时 */
export interface Tower {
  /** 塔定义 ID */
  defId: string;
  /** 塔实例 ID */
  instanceId: string;
  /** 塔位置（固定在防御位上） */
  position: { x: number; y: number };
  /** 当前等级（1 = 基础，2 = 已升级） */
  level: number;
  /** 当前攻击力 */
  currentAttack: number;
  /** 当前攻击范围 */
  currentRange: number;
  /** 当前攻速（每秒攻击次数） */
  currentAttackSpeed: number;
  /** 当前攻击冷却（毫秒） */
  attackCooldown: number;
  /** 当前攻击目标 ID */
  targetId: string | null;
}

/** 敌人运行时单位 */
export interface EnemyUnit {
  /** 敌人实例 ID */
  id: string;
  /** 敌人定义 ID */
  defId: string;
  /** 当前位置 X */
  x: number;
  /** 当前位置 Y */
  y: number;
  /** 当前生命值 */
  hp: number;
  /** 最大生命值 */
  maxHp: number;
  /** 移动速度（像素/秒） */
  speed: number;
  /** 当前减速因子（0 = 正常，1 = 完全停止） */
  slowFactor: number;
  /** 减速剩余时间（毫秒） */
  slowRemainingMs: number;
  /** 当前路径段索引 */
  segmentIndex: number;
  /** 当前段内进度（0~1） */
  segmentProgress: number;
  /** 是否存活 */
  isAlive: boolean;
  /** 是否到达终点 */
  reachedEnd: boolean;
  /** 击杀奖励金币 */
  bounty: number;
}

/** 敌人波次定义 */
export interface EnemyWave {
  /** 波次索引（从 0 开始） */
  waveIndex: number;
  /** 该波次的敌人组 */
  enemies: { defId: string; count: number; intervalMs: number }[];
  /** 波次开始延迟（毫秒） */
  startDelayMs: number;
}

/** 塔防配置 */
export interface TowerDefenseConfig {
  /** 敌人行进路径节点 */
  path: PathNode[];
  /** 可放置防御塔的位置 */
  towerSlots: { x: number; y: number }[];
  /** 可用防御塔定义列表 */
  availableTowers: TowerDef[];
  /** 敌人波次定义 */
  waves: EnemyWave[];
  /** 初始生命值 */
  lives: number;
  /** 初始金币 */
  startingGold: number;
}

/** 塔防内部状态 */
export interface TowerDefenseState {
  /** 当前阶段 */
  phase: 'preparing' | 'wave_active' | 'between_waves' | 'finished';
  /** 当前波次索引 */
  currentWave: number;
  /** 剩余生命值 */
  lives: number;
  /** 当前金币 */
  gold: number;
  /** 已放置的防御塔列表 */
  towers: Tower[];
  /** 场上敌人列表 */
  enemies: EnemyUnit[];
  /** 累计分数 */
  score: number;
  /** 已过时间（毫秒） */
  elapsedMs: number;
}

// ============================================================
// 常量
// ============================================================

/** 默认击杀金币奖励 */
const DEFAULT_BOUNTY = 10;

/** 默认敌人移动速度（像素/秒） */
const DEFAULT_ENEMY_SPEED = 60;

/** 默认敌人生命值 */
const DEFAULT_ENEMY_HP = 50;

/** 卖塔返还金币比例 */
const SELL_REFUND_RATIO = 0.6;

/** 实例 ID 计数器 */
let towerInstanceCounter = 0;

/** 生成唯一塔实例 ID */
function genTowerInstanceId(defId: string): string {
  return `tower_${defId}_${Date.now()}_${++towerInstanceCounter}`;
}

// ============================================================
// TowerDefenseMode 实现
// ============================================================

/**
 * 塔防战斗模式
 *
 * 核心循环：
 * 1. 准备阶段（preparing）：玩家建塔布局
 * 2. 调用 startWave() 开始第一波
 * 3. 波次进行中（wave_active）：敌人沿路径移动，塔自动攻击
 * 4. 波次清除后进入 between_waves，玩家可继续建塔/升级
 * 5. 调用 startWave() 开始下一波
 * 6. 所有波次清除 → 胜利；生命值归零 → 失败
 *
 * @example
 * ```typescript
 * const config: TowerDefenseConfig = {
 *   path: [{ x: 0, y: 300 }, { x: 800, y: 300 }],
 *   towerSlots: [{ x: 200, y: 200 }, { x: 400, y: 400 }],
 *   availableTowers: [{ id: 'archer', name: '箭塔', attack: 10, range: 120, attackSpeed: 1, cost: 50 }],
 *   waves: [{ waveIndex: 0, enemies: [{ defId: 'goblin', count: 5, intervalMs: 1000 }], startDelayMs: 0 }],
 *   lives: 20,
 *   startingGold: 100,
 * };
 * const mode = new TowerDefenseMode(config);
 * mode.init(ctx);
 * mode.buildTower(0, 'archer');
 * mode.startWave();
 * mode.update(ctx, dt);
 * ```
 */
export class TowerDefenseMode implements IBattleMode {
  readonly type = 'tower-defense';

  /** 塔防配置 */
  private readonly config: TowerDefenseConfig;

  /** 内部状态 */
  private state: TowerDefenseState;

  /** 波次生成器状态 */
  private waveSpawnIndex: number;
  private waveGroupIndex: number;
  private waveSpawnCount: number;
  private waveSpawnTimer: number;
  private waveDelayTimer: number;

  /** 塔位占用映射 */
  private slotOccupancy: Map<number, string>;

  // ============================================================
  // 构造函数
  // ============================================================

  /**
   * 创建塔防战斗模式
   *
   * @param config - 塔防配置
   */
  constructor(config: TowerDefenseConfig) {
    this.config = config;
    this.state = this.createInitialState();
    this.waveSpawnIndex = -1;
    this.waveGroupIndex = 0;
    this.waveSpawnCount = 0;
    this.waveSpawnTimer = 0;
    this.waveDelayTimer = 0;
    this.slotOccupancy = new Map();
  }

  // ============================================================
  // 生命周期（IBattleMode 接口）
  // ============================================================

  /**
   * 初始化模式 — 重置所有状态，进入准备阶段
   */
  init(_ctx: BattleModeContext): void {
    this.state = this.createInitialState();
    this.waveSpawnIndex = -1;
    this.waveGroupIndex = 0;
    this.waveSpawnCount = 0;
    this.waveSpawnTimer = 0;
    this.waveDelayTimer = 0;
    this.slotOccupancy = new Map();
    this.state.phase = 'preparing';
  }

  /**
   * 每帧更新
   *
   * 更新顺序：生成敌人 → 移动敌人 → 塔攻击 → 检查终点 → 清除死亡 → 波次完成 → 胜负
   */
  update(ctx: BattleModeContext, dt: number): void {
    if (this.state.phase === 'finished' || this.state.phase === 'preparing') return;

    const scaledDt = dt * ctx.speed;
    this.state.elapsedMs += scaledDt;

    // 1. 更新波次延迟
    if (this.waveDelayTimer > 0) {
      this.waveDelayTimer -= scaledDt;
      if (this.waveDelayTimer < 0) this.waveDelayTimer = 0;
    }

    // 2. 生成敌人
    if (this.waveDelayTimer <= 0) {
      this.spawnEnemies(ctx, scaledDt);
    }

    // 3. 移动敌人
    this.moveEnemies(scaledDt);

    // 4. 塔攻击
    this.updateTowerAttacks(ctx, scaledDt);

    // 5. 检查敌人到达终点
    this.checkEnemiesReachedEnd();

    // 6. 清除死亡敌人
    this.cleanupDeadEnemies();

    // 7. 检查波次完成
    this.checkWaveCompletion();

    // 8. 检查失败
    if (this.checkLose(ctx)) {
      this.state.phase = 'finished';
    }
  }

  /**
   * 检查胜利条件 — 所有波次已清除
   */
  checkWin(_ctx: BattleModeContext): boolean {
    if (this.state.lives <= 0) return false;
    const allWavesSpawned = this.waveSpawnIndex >= this.config.waves.length - 1
      && this.waveSpawnCount === 0
      && this.waveDelayTimer <= 0;
    return allWavesSpawned && this.state.enemies.length === 0;
  }

  /**
   * 检查失败条件 — 生命值归零
   */
  checkLose(_ctx: BattleModeContext): boolean {
    return this.state.lives <= 0;
  }

  /**
   * 结算战斗结果
   */
  settle(ctx: BattleModeContext, durationMs: number): BattleResult {
    const won = this.checkWin(ctx);
    const enemiesDefeated = this.state.score;
    const mvp = this.state.towers.length > 0
      ? this.state.towers.reduce((best, t) =>
          t.currentAttack > best.currentAttack ? t : best, this.state.towers[0]).instanceId
      : null;

    return {
      won,
      rewards: won ? { gold: this.state.gold, score: this.state.score } : {},
      drops: {},
      mvp,
      durationMs,
      stats: {
        totalDamageDealt: 0,
        totalDamageTaken: 0,
        unitsLost: 0,
        enemiesDefeated,
      },
    };
  }

  /**
   * 获取模式状态（用于存档）
   */
  getState(): Record<string, unknown> {
    return {
      phase: this.state.phase,
      currentWave: this.state.currentWave,
      lives: this.state.lives,
      gold: this.state.gold,
      towers: this.state.towers.map((t) => ({ ...t })),
      enemies: this.state.enemies.map((e) => ({ ...e })),
      score: this.state.score,
      elapsedMs: this.state.elapsedMs,
      waveSpawnIndex: this.waveSpawnIndex,
      waveGroupIndex: this.waveGroupIndex,
      waveSpawnCount: this.waveSpawnCount,
      waveSpawnTimer: this.waveSpawnTimer,
      waveDelayTimer: this.waveDelayTimer,
      slotOccupancy: Object.fromEntries(this.slotOccupancy),
    };
  }

  /**
   * 恢复模式状态
   */
  loadState(data: Record<string, unknown>): void {
    if (!data || typeof data !== 'object') return;

    const validPhases: TowerDefenseState['phase'][] = ['preparing', 'wave_active', 'between_waves', 'finished'];
    this.state.phase = validPhases.includes(data.phase as TowerDefenseState['phase'])
      ? (data.phase as TowerDefenseState['phase'])
      : 'preparing';

    this.state.currentWave = typeof data.currentWave === 'number' ? Math.max(0, Math.floor(data.currentWave)) : 0;
    this.state.lives = typeof data.lives === 'number' ? Math.max(0, Math.floor(data.lives)) : this.config.lives;
    this.state.gold = typeof data.gold === 'number' ? Math.max(0, Math.floor(data.gold)) : this.config.startingGold;
    this.state.score = typeof data.score === 'number' ? Math.max(0, Math.floor(data.score)) : 0;
    this.state.elapsedMs = typeof data.elapsedMs === 'number' ? Math.max(0, data.elapsedMs) : 0;

    this.state.towers = Array.isArray(data.towers)
      ? (data.towers as unknown[]).filter((t): t is Record<string, unknown> => typeof t === 'object' && t !== null)
        .map((t) => this.deserializeTower(t))
      : [];

    this.state.enemies = Array.isArray(data.enemies)
      ? (data.enemies as unknown[]).filter((e): e is Record<string, unknown> => typeof e === 'object' && e !== null)
        .map((e) => this.deserializeEnemy(e))
      : [];

    this.waveSpawnIndex = typeof data.waveSpawnIndex === 'number' ? Math.max(-1, Math.floor(data.waveSpawnIndex)) : -1;
    this.waveGroupIndex = typeof data.waveGroupIndex === 'number' ? Math.max(0, Math.floor(data.waveGroupIndex)) : 0;
    this.waveSpawnCount = typeof data.waveSpawnCount === 'number' ? Math.max(0, Math.floor(data.waveSpawnCount)) : 0;
    this.waveSpawnTimer = typeof data.waveSpawnTimer === 'number' ? Math.max(0, data.waveSpawnTimer) : 0;
    this.waveDelayTimer = typeof data.waveDelayTimer === 'number' ? Math.max(0, data.waveDelayTimer) : 0;

    this.slotOccupancy = new Map();
    if (typeof data.slotOccupancy === 'object' && data.slotOccupancy !== null) {
      const entries = Object.entries(data.slotOccupancy as Record<string, unknown>);
      for (const [key, val] of entries) {
        if (typeof val === 'string') {
          this.slotOccupancy.set(Number(key), val);
        }
      }
    }
  }

  /**
   * 重置模式到初始状态
   */
  reset(): void {
    this.state = this.createInitialState();
    this.waveSpawnIndex = -1;
    this.waveGroupIndex = 0;
    this.waveSpawnCount = 0;
    this.waveSpawnTimer = 0;
    this.waveDelayTimer = 0;
    this.slotOccupancy = new Map();
  }

  // ============================================================
  // 公开方法 — 塔操作
  // ============================================================

  /**
   * 在指定防御位建造防御塔
   *
   * @param slotIndex  - 防御位索引
   * @param towerDefId - 塔定义 ID
   * @returns 是否建造成功
   */
  buildTower(slotIndex: number, towerDefId: string): boolean {
    if (slotIndex < 0 || slotIndex >= this.config.towerSlots.length) return false;
    if (this.slotOccupancy.has(slotIndex)) return false;

    const towerDef = this.config.availableTowers.find((t) => t.id === towerDefId);
    if (!towerDef) return false;

    if (this.state.gold < towerDef.cost) return false;
    if (this.state.phase !== 'preparing' && this.state.phase !== 'between_waves') return false;

    this.state.gold -= towerDef.cost;

    const slot = this.config.towerSlots[slotIndex];
    const instanceId = genTowerInstanceId(towerDefId);
    const tower: Tower = {
      defId: towerDefId,
      instanceId,
      position: { x: slot.x, y: slot.y },
      level: 1,
      currentAttack: towerDef.attack,
      currentRange: towerDef.range,
      currentAttackSpeed: towerDef.attackSpeed,
      attackCooldown: 0,
      targetId: null,
    };

    this.state.towers.push(tower);
    this.slotOccupancy.set(slotIndex, instanceId);
    return true;
  }

  /**
   * 升级指定防御塔
   *
   * @param towerInstanceId - 塔实例 ID
   * @returns 是否升级成功
   */
  upgradeTower(towerInstanceId: string): boolean {
    const tower = this.state.towers.find((t) => t.instanceId === towerInstanceId);
    if (!tower) return false;

    if (tower.level >= 2) return false;

    const towerDef = this.config.availableTowers.find((t) => t.id === tower.defId);
    if (!towerDef) return false;

    const upgradeCost = towerDef.upgradeCost ?? 0;
    if (upgradeCost <= 0) return false;

    if (this.state.gold < upgradeCost) return false;
    if (this.state.phase !== 'preparing' && this.state.phase !== 'between_waves') return false;

    this.state.gold -= upgradeCost;

    tower.level = 2;
    tower.currentAttack = towerDef.upgradeAttack ?? Math.floor(tower.currentAttack * 1.5);
    tower.currentRange = towerDef.upgradeRange ?? Math.floor(tower.currentRange * 1.2);
    tower.currentAttackSpeed = tower.currentAttackSpeed * 1.2;

    return true;
  }

  /**
   * 卖掉指定防御塔，返还部分金币
   *
   * @param towerInstanceId - 塔实例 ID
   * @returns 返还的金币数（0 表示失败）
   */
  sellTower(towerInstanceId: string): number {
    const towerIndex = this.state.towers.findIndex((t) => t.instanceId === towerInstanceId);
    if (towerIndex === -1) return 0;

    if (this.state.phase !== 'preparing' && this.state.phase !== 'between_waves') return 0;

    const tower = this.state.towers[towerIndex];
    const towerDef = this.config.availableTowers.find((t) => t.id === tower.defId);

    const totalInvested = (towerDef?.cost ?? 0) + (tower.level >= 2 ? (towerDef?.upgradeCost ?? 0) : 0);
    const refund = Math.floor(totalInvested * SELL_REFUND_RATIO);

    this.state.towers.splice(towerIndex, 1);

    for (const [slotIdx, instId] of this.slotOccupancy) {
      if (instId === towerInstanceId) {
        this.slotOccupancy.delete(slotIdx);
        break;
      }
    }

    this.state.gold += refund;
    return refund;
  }

  // ============================================================
  // 公开方法 — 波次控制
  // ============================================================

  /**
   * 手动开始下一波
   */
  startWave(): void {
    if (this.state.phase === 'finished') return;
    if (this.state.phase === 'wave_active') return;

    const nextWaveIndex = this.waveSpawnIndex + 1;
    if (nextWaveIndex >= this.config.waves.length) return;

    this.state.currentWave = nextWaveIndex;
    this.state.phase = 'wave_active';

    this.waveSpawnIndex = nextWaveIndex;
    this.waveGroupIndex = 0;
    this.waveSpawnCount = 0;
    this.waveSpawnTimer = 0;

    const wave = this.config.waves[nextWaveIndex];
    this.waveDelayTimer = wave.startDelayMs;
  }

  // ============================================================
  // 公开访问器
  // ============================================================

  /**
   * 获取塔防内部状态
   */
  getTowerDefenseState(): TowerDefenseState {
    return {
      ...this.state,
      towers: this.state.towers.map((t) => ({ ...t })),
      enemies: this.state.enemies.map((e) => ({ ...e })),
    };
  }

  /**
   * 获取配置
   */
  getConfig(): TowerDefenseConfig {
    return this.config;
  }

  /**
   * 获取防御位占用信息
   */
  getSlotOccupancy(): Map<number, string> {
    return new Map(this.slotOccupancy);
  }

  // ============================================================
  // 私有方法 — 初始化
  // ============================================================

  /** 创建初始状态 */
  private createInitialState(): TowerDefenseState {
    return {
      phase: 'preparing',
      currentWave: 0,
      lives: this.config.lives,
      gold: this.config.startingGold,
      towers: [],
      enemies: [],
      score: 0,
      elapsedMs: 0,
    };
  }

  // ============================================================
  // 私有方法 — 敌人生成
  // ============================================================

  /** 按波次定义生成敌人 */
  private spawnEnemies(ctx: BattleModeContext, dt: number): void {
    if (this.waveSpawnIndex < 0 || this.waveSpawnIndex >= this.config.waves.length) return;

    const wave = this.config.waves[this.waveSpawnIndex];
    if (!wave) return;

    if (this.waveGroupIndex >= wave.enemies.length) return;

    const group = wave.enemies[this.waveGroupIndex];

    if (this.waveSpawnCount >= group.count) {
      this.waveGroupIndex++;
      this.waveSpawnCount = 0;
      this.waveSpawnTimer = 0;
      return;
    }

    this.waveSpawnTimer -= dt;

    if (this.waveSpawnTimer <= 0) {
      this.spawnSingleEnemy(ctx, group.defId);
      this.waveSpawnCount++;
      this.waveSpawnTimer = group.intervalMs;
    }
  }

  /** 生成单个敌人 */
  private spawnSingleEnemy(ctx: BattleModeContext, defId: string): void {
    const path = this.config.path;
    if (path.length === 0) return;

    const unitDef = ctx.units.find((u) => u.id === defId || u.id.includes(defId));
    const waveScale = 1 + (this.waveSpawnIndex ?? 0) * 0.2;

    const hp = unitDef ? Math.floor(unitDef.stats.maxHp * waveScale) : Math.floor(DEFAULT_ENEMY_HP * waveScale);
    const speed = unitDef ? unitDef.stats.speed : DEFAULT_ENEMY_SPEED;
    const bounty = DEFAULT_BOUNTY + Math.floor((this.waveSpawnIndex ?? 0) * 2);

    const enemyId = `enemy_${defId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const enemy: EnemyUnit = {
      id: enemyId,
      defId,
      x: path[0].x,
      y: path[0].y,
      hp,
      maxHp: hp,
      speed,
      slowFactor: 0,
      slowRemainingMs: 0,
      segmentIndex: 0,
      segmentProgress: 0,
      isAlive: true,
      reachedEnd: false,
      bounty,
    };

    this.state.enemies.push(enemy);
  }

  // ============================================================
  // 私有方法 — 敌人移动
  // ============================================================

  /** 移动所有存活敌人沿路径行进（线性插值） */
  private moveEnemies(dt: number): void {
    const path = this.config.path;
    if (path.length < 2) return;

    const dtSec = dt / 1000;

    for (const enemy of this.state.enemies) {
      if (!enemy.isAlive || enemy.reachedEnd) continue;

      // 更新减速
      if (enemy.slowRemainingMs > 0) {
        enemy.slowRemainingMs -= dt;
        if (enemy.slowRemainingMs <= 0) {
          enemy.slowFactor = 0;
          enemy.slowRemainingMs = 0;
        }
      }

      const effectiveSpeed = enemy.speed * (1 - enemy.slowFactor);
      let remaining = effectiveSpeed * dtSec;

      while (remaining > 0 && enemy.segmentIndex < path.length - 1) {
        const from = path[enemy.segmentIndex];
        const to = path[enemy.segmentIndex + 1];

        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const segmentLength = Math.sqrt(dx * dx + dy * dy);

        if (segmentLength < 0.01) {
          enemy.segmentIndex++;
          enemy.segmentProgress = 0;
          continue;
        }

        const remainingInSegment = segmentLength * (1 - enemy.segmentProgress);

        if (remaining >= remainingInSegment) {
          remaining -= remainingInSegment;
          enemy.segmentIndex++;
          enemy.segmentProgress = 0;
        } else {
          enemy.segmentProgress += remaining / segmentLength;
          remaining = 0;
        }
      }

      if (enemy.segmentIndex >= path.length - 1) {
        enemy.segmentProgress = 1;
        enemy.reachedEnd = true;
      }

      // 更新位置
      if (enemy.segmentIndex < path.length - 1) {
        const from = path[enemy.segmentIndex];
        const to = path[enemy.segmentIndex + 1];
        enemy.x = from.x + (to.x - from.x) * enemy.segmentProgress;
        enemy.y = from.y + (to.y - from.y) * enemy.segmentProgress;
      } else {
        const lastNode = path[path.length - 1];
        enemy.x = lastNode.x;
        enemy.y = lastNode.y;
      }
    }
  }

  // ============================================================
  // 私有方法 — 塔攻击
  // ============================================================

  /** 更新所有塔的攻击逻辑 */
  private updateTowerAttacks(ctx: BattleModeContext, dt: number): void {
    for (const tower of this.state.towers) {
      // 递减攻击冷却
      if (tower.attackCooldown > 0) {
        tower.attackCooldown -= dt;
        if (tower.attackCooldown < 0) tower.attackCooldown = 0;
      }

      if (tower.attackCooldown > 0) {
        tower.targetId = null;
        continue;
      }

      // 选择目标：范围内最近的存活敌人
      const target = this.findNearestEnemyInRange(tower);
      if (!target) {
        tower.targetId = null;
        continue;
      }

      tower.targetId = target.id;

      const towerDef = this.config.availableTowers.find((t) => t.id === tower.defId);
      const damage = tower.currentAttack;
      this.applyDamageToEnemy(target, damage);

      // 溅射伤害
      if (towerDef && towerDef.splashRadius && towerDef.splashRadius > 0) {
        const splashTargets = this.state.enemies.filter(
          (e) => e.isAlive && e.id !== target.id && this.getDistance(tower.position, e) <= towerDef.splashRadius!,
        );
        for (const splashTarget of splashTargets) {
          this.applyDamageToEnemy(splashTarget, Math.floor(damage * 0.5));
        }
      }

      // 减速效果
      if (towerDef && towerDef.slowFactor && towerDef.slowFactor > 0) {
        target.slowFactor = Math.min(1, towerDef.slowFactor);
        target.slowRemainingMs = 2000;
      }

      // 设置攻击冷却
      tower.attackCooldown = 1000 / tower.currentAttackSpeed;

      // 发射事件
      ctx.emit({
        type: 'unit_damaged',
        data: { targetId: target.id, damage, isCrit: false, isMiss: false },
      });

      ctx.emit({
        type: 'action_executed',
        data: { unitId: tower.instanceId, action: 'attack', targetIds: [target.id] },
      });
    }
  }

  /** 对敌人造成伤害 */
  private applyDamageToEnemy(enemy: EnemyUnit, damage: number): void {
    enemy.hp -= damage;
    if (enemy.hp <= 0 && enemy.isAlive) {
      enemy.hp = 0;
      enemy.isAlive = false;
      this.state.gold += enemy.bounty;
      this.state.score += 1;
    }
  }

  /** 查找塔攻击范围内最近的存活敌人 */
  private findNearestEnemyInRange(tower: Tower): EnemyUnit | null {
    let nearest: EnemyUnit | null = null;
    let nearestDist = Infinity;

    for (const enemy of this.state.enemies) {
      if (!enemy.isAlive) continue;
      const dist = this.getDistance(tower.position, enemy);
      if (dist <= tower.currentRange && dist < nearestDist) {
        nearestDist = dist;
        nearest = enemy;
      }
    }

    return nearest;
  }

  // ============================================================
  // 私有方法 — 终点和清理
  // ============================================================

  /** 检查到达终点的敌人，扣减生命值 */
  private checkEnemiesReachedEnd(): void {
    for (const enemy of this.state.enemies) {
      if (enemy.reachedEnd && enemy.isAlive) {
        enemy.isAlive = false;
        this.state.lives -= 1;
      }
    }
  }

  /** 清除死亡和到达终点的敌人 */
  private cleanupDeadEnemies(): void {
    this.state.enemies = this.state.enemies.filter((e) => e.isAlive && !e.reachedEnd);
  }

  /** 检查当前波次是否完成 */
  private checkWaveCompletion(): void {
    if (this.state.phase !== 'wave_active') return;
    if (this.waveSpawnIndex < 0 || this.waveSpawnIndex >= this.config.waves.length) return;

    const wave = this.config.waves[this.waveSpawnIndex];
    const allSpawned = this.waveGroupIndex >= wave.enemies.length;

    if (allSpawned && this.state.enemies.length === 0) {
      if (this.waveSpawnIndex >= this.config.waves.length - 1) {
        this.state.phase = 'finished';
      } else {
        this.state.phase = 'between_waves';
      }
    }
  }

  // ============================================================
  // 私有方法 — 辅助
  // ============================================================

  /** 计算两点之间的距离 */
  private getDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /** 反序列化塔 */
  private deserializeTower(t: Record<string, unknown>): Tower {
    return {
      defId: typeof t.defId === 'string' ? t.defId : '',
      instanceId: typeof t.instanceId === 'string' ? t.instanceId : '',
      position: typeof t.position === 'object' && t.position !== null
        ? {
            x: typeof (t.position as Record<string, unknown>).x === 'number' ? (t.position as Record<string, unknown>).x as number : 0,
            y: typeof (t.position as Record<string, unknown>).y === 'number' ? (t.position as Record<string, unknown>).y as number : 0,
          }
        : { x: 0, y: 0 },
      level: typeof t.level === 'number' ? Math.max(1, Math.floor(t.level)) : 1,
      currentAttack: typeof t.currentAttack === 'number' ? Math.max(0, t.currentAttack) : 0,
      currentRange: typeof t.currentRange === 'number' ? Math.max(0, t.currentRange) : 0,
      currentAttackSpeed: typeof t.currentAttackSpeed === 'number' ? Math.max(0, t.currentAttackSpeed) : 1,
      attackCooldown: typeof t.attackCooldown === 'number' ? Math.max(0, t.attackCooldown) : 0,
      targetId: typeof t.targetId === 'string' ? t.targetId : null,
    };
  }

  /** 反序列化敌人 */
  private deserializeEnemy(e: Record<string, unknown>): EnemyUnit {
    return {
      id: typeof e.id === 'string' ? e.id : '',
      defId: typeof e.defId === 'string' ? e.defId : '',
      x: typeof e.x === 'number' ? e.x : 0,
      y: typeof e.y === 'number' ? e.y : 0,
      hp: typeof e.hp === 'number' ? Math.max(0, e.hp) : 0,
      maxHp: typeof e.maxHp === 'number' ? Math.max(1, e.maxHp) : 1,
      speed: typeof e.speed === 'number' ? Math.max(0, e.speed) : DEFAULT_ENEMY_SPEED,
      slowFactor: typeof e.slowFactor === 'number' ? Math.min(1, Math.max(0, e.slowFactor)) : 0,
      slowRemainingMs: typeof e.slowRemainingMs === 'number' ? Math.max(0, e.slowRemainingMs) : 0,
      segmentIndex: typeof e.segmentIndex === 'number' ? Math.max(0, Math.floor(e.segmentIndex)) : 0,
      segmentProgress: typeof e.segmentProgress === 'number' ? Math.min(1, Math.max(0, e.segmentProgress)) : 0,
      isAlive: typeof e.isAlive === 'boolean' ? e.isAlive : true,
      reachedEnd: typeof e.reachedEnd === 'boolean' ? e.reachedEnd : false,
      bounty: typeof e.bounty === 'number' ? Math.max(0, e.bounty) : DEFAULT_BOUNTY,
    };
  }
}
