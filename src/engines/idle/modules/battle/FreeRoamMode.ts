/**
 * FreeRoamMode — 自由战斗模式（实时移动 AI）
 *
 * 参考魔兽争霸3/红色警戒的实时战斗体验，但自动执行体现放置游戏特色：
 * - 单位在地图上自由移动（连续坐标，非格子）
 * - 每个单位有移动速度（像素/秒）
 * - 近战单位自动寻路接近最近的敌人
 * - 远程单位保持距离攻击（射程内攻击，不在射程内移动接近）
 * - 仇恨系统：被攻击时仇恨值增加，仇恨值最高的目标优先被攻击，仇恨值随时间衰减
 * - 碰撞回避：单位之间不重叠（简单推开算法）
 * - 死亡的单位从地图上移除
 * - 胜利条件：消灭所有敌方
 * - 失败条件：己方全灭或超时
 *
 * 设计原则：
 * - 零外部依赖，纯 TypeScript 实现
 * - 坐标系统使用像素坐标（非格子），单位位置为 {x, y} 浮点数
 * - 移动速度单位是像素/秒
 * - 攻击冷却单位是毫秒
 * - 仇恨值是整数
 *
 * @module engines/idle/modules/battle/FreeRoamMode
 */

import type {
  IBattleMode,
  BattleModeContext,
  BattleResult,
  BattleUnit,
} from './BattleMode';

// ============================================================
// 类型定义
// ============================================================

/** 自由战斗单位运行时状态 */
export interface FreeRoamUnit {
  /** 单位 ID */
  unitId: string;
  /** 当前 X 坐标（像素） */
  x: number;
  /** 当前 Y 坐标（像素） */
  y: number;
  /** 目标 X 坐标 */
  targetX: number;
  /** 目标 Y 坐标 */
  targetY: number;
  /** 当前攻击目标单位 ID */
  targetEnemyId: string | null;
  /** 攻击范围（像素），近战=50，远程=200 */
  attackRange: number;
  /** 移动速度（像素/秒） */
  moveSpeed: number;
  /** 攻击冷却（毫秒） */
  attackCooldown: number;
  /** 当前攻击冷却剩余时间（毫秒） */
  currentAttackCd: number;
  /** 是否在撤退 */
  isRetreating: boolean;
}

/** 仇恨条目 */
export interface AggroEntry {
  /** 目标单位 ID */
  targetId: string;
  /** 仇恨值 */
  value: number;
}

/** 自由战斗模式内部状态 */
export interface FreeRoamState {
  /** 单位运行时状态映射 */
  units: Map<string, FreeRoamUnit>;
  /** 仇恨表：unitId → 仇恨列表 */
  aggroTable: Map<string, AggroEntry[]>;
  /** 地图宽度（像素） */
  mapWidth: number;
  /** 地图高度（像素） */
  mapHeight: number;
  /** 已经过时间（毫秒） */
  elapsedMs: number;
  /** 时间限制（毫秒），默认 120000 (2分钟) */
  timeLimitMs: number;
  /** 当前阶段 */
  phase: 'running' | 'finished';
  /** AI 决策间隔（毫秒），默认 100ms */
  actionIntervalMs: number;
  /** 上次 AI tick 时间（毫秒） */
  lastAiTickMs: number;
  /** 累计伤害统计 */
  totalDamageDealt: number;
  totalDamageTaken: number;
  unitsLost: number;
  enemiesDefeated: number;
}

// ============================================================
// 常量
// ============================================================

/** 默认时间限制：2 分钟 */
const DEFAULT_TIME_LIMIT_MS = 120_000;

/** 默认 AI 决策间隔：100ms */
const DEFAULT_ACTION_INTERVAL_MS = 100;

/** 默认地图宽度 */
const DEFAULT_MAP_WIDTH = 800;

/** 默认地图高度 */
const DEFAULT_MAP_HEIGHT = 600;

/** 近战攻击范围（像素） */
const MELEE_ATTACK_RANGE = 50;

/** 远程攻击范围（像素） */
const RANGED_ATTACK_RANGE = 200;

/** 默认近战移动速度（像素/秒） */
const MELEE_MOVE_SPEED = 120;

/** 默认远程移动速度（像素/秒） */
const RANGED_MOVE_SPEED = 80;

/** 默认攻击冷却（毫秒） */
const DEFAULT_ATTACK_COOLDOWN = 1000;

/** 碰撞推开距离阈值（像素），两个单位距离 < 30px 时互相推开 */
const COLLISION_PUSH_DISTANCE = 30;

/** 碰撞推开力度（像素/帧） */
const COLLISION_PUSH_FORCE = 5;

/** 仇恨值：被攻击时增加量 */
const AGGRO_ON_ATTACKED = 10;

/** 仇恨值：每 tick 衰减量 */
const AGGRO_DECAY_PER_TICK = 1;

/** 仇恨值：最小值 */
const AGGRO_MIN = 0;

/** 攻方初始 X 范围（地图左侧） */
const ATTACKER_SPAWN_X_MIN = 50;
const ATTACKER_SPAWN_X_MAX = 150;

/** 守方初始 X 范围（地图右侧） */
const DEFENDER_SPAWN_X_MIN = 650;
const DEFENDER_SPAWN_X_MAX = 750;

// ============================================================
// FreeRoamMode 实现
// ============================================================

/**
 * 自由战斗模式 — 实时移动 AI 战斗
 *
 * 所有单位在地图上自由移动，AI 自动控制行为：
 * 1. 每 actionIntervalMs 执行一次 AI tick
 * 2. 每个存活单位更新仇恨表、选择目标
 * 3. 目标在攻击范围内 → 攻击（冷却完毕时）
 * 4. 目标不在攻击范围内 → 移动接近
 * 5. 近战单位到达攻击范围后停止移动
 * 6. 远程单位保持最大攻击距离
 *
 * @example
 * ```typescript
 * const mode = new FreeRoamMode({ mapWidth: 800, mapHeight: 600 });
 * mode.init(ctx);
 * // 在游戏循环中
 * mode.update(ctx, 16);
 * ```
 */
export class FreeRoamMode implements IBattleMode {
  readonly type = 'free-roam';

  /** 内部状态 */
  private state: FreeRoamState;

  /** 地图宽度 */
  private readonly mapWidth: number;

  /** 地图高度 */
  private readonly mapHeight: number;

  /** 时间限制 */
  private readonly timeLimitMs: number;

  /** AI 决策间隔 */
  private readonly actionIntervalMs: number;

  // ============================================================
  // 构造函数
  // ============================================================

  /**
   * 创建自由战斗模式
   *
   * @param options - 配置选项
   */
  constructor(options?: {
    mapWidth?: number;
    mapHeight?: number;
    timeLimitMs?: number;
    actionIntervalMs?: number;
  }) {
    this.mapWidth = options?.mapWidth ?? DEFAULT_MAP_WIDTH;
    this.mapHeight = options?.mapHeight ?? DEFAULT_MAP_HEIGHT;
    this.timeLimitMs = options?.timeLimitMs ?? DEFAULT_TIME_LIMIT_MS;
    this.actionIntervalMs = options?.actionIntervalMs ?? DEFAULT_ACTION_INTERVAL_MS;
    this.state = this.createInitialState();
  }

  // ============================================================
  // 生命周期（IBattleMode 接口）
  // ============================================================

  /**
   * 初始化模式 — 在地图两侧初始化单位位置
   *
   * 攻方单位在地图左侧，守方单位在地图右侧。
   * Y 坐标按单位索引均匀分布在地图高度范围内。
   */
  init(ctx: BattleModeContext): void {
    this.state = this.createInitialState();

    const aliveUnits = ctx.units.filter((u) => u.isAlive);

    // 按阵营分组
    const attackers = aliveUnits.filter((u) => u.side === 'attacker');
    const defenders = aliveUnits.filter((u) => u.side === 'defender');

    // 初始化攻方单位（左侧）
    this.initSideUnits(attackers, 'attacker');
    // 初始化守方单位（右侧）
    this.initSideUnits(defenders, 'defender');

    // 初始化仇恨表
    for (const unit of aliveUnits) {
      this.state.aggroTable.set(unit.id, []);
    }

    this.state.phase = 'running';
  }

  /**
   * 每帧更新 — 实时更新：移动 → 仇恨更新 → 攻击判定 → 死亡检查
   *
   * @param ctx - 战斗模式上下文
   * @param dt - 距上次更新的时间增量（毫秒）
   */
  update(ctx: BattleModeContext, dt: number): void {
    if (this.state.phase === 'finished') return;

    // 应用速度倍率
    const scaledDt = dt * ctx.speed;

    // 累计时间
    this.state.elapsedMs += scaledDt;

    // 检查超时
    if (this.state.elapsedMs >= this.state.timeLimitMs) {
      this.state.phase = 'finished';
      return;
    }

    // 检查胜负
    if (this.checkWin(ctx) || this.checkLose(ctx)) {
      this.state.phase = 'finished';
      return;
    }

    // 递减所有单位的攻击冷却
    this.tickAttackCooldowns(scaledDt);

    // 检查是否到达 AI tick 时间
    if (this.state.elapsedMs - this.state.lastAiTickMs >= this.state.actionIntervalMs) {
      this.state.lastAiTickMs = this.state.elapsedMs;
      this.executeAiTick(ctx, scaledDt);
    } else {
      // 非 AI tick 帧，只移动（基于实际 dt）
      this.moveAllUnits(scaledDt);
    }

    // 碰撞回避
    this.resolveCollisions();

    // 限制在地图边界内
    this.clampAllToMap();

    // 清除死亡单位的运行时状态
    this.cleanupDeadUnits(ctx);
  }

  /**
   * 检查胜利条件 — 所有防守方单位死亡
   */
  checkWin(ctx: BattleModeContext): boolean {
    return ctx.getAliveUnits('defender').length === 0;
  }

  /**
   * 检查失败条件 — 所有攻击方单位死亡或超时
   */
  checkLose(ctx: BattleModeContext): boolean {
    return ctx.getAliveUnits('attacker').length === 0;
  }

  /**
   * 结算战斗结果
   */
  settle(ctx: BattleModeContext, durationMs: number): BattleResult {
    const won = this.checkWin(ctx);

    // 计算 MVP：存活单位中攻击力最高的
    const alive = ctx.getAliveUnits(won ? 'attacker' : 'defender');
    const mvp = alive.length > 0
      ? alive.reduce((best, u) => u.stats.attack > best.stats.attack ? u : best, alive[0])
      : null;

    return {
      won,
      rewards: {},
      drops: {},
      mvp: mvp?.id ?? null,
      durationMs,
      stats: {
        totalDamageDealt: this.state.totalDamageDealt,
        totalDamageTaken: this.state.totalDamageTaken,
        unitsLost: this.state.unitsLost,
        enemiesDefeated: this.state.enemiesDefeated,
      },
    };
  }

  /**
   * 获取模式状态（用于存档）
   */
  getState(): Record<string, unknown> {
    return {
      elapsedMs: this.state.elapsedMs,
      timeLimitMs: this.state.timeLimitMs,
      phase: this.state.phase,
      actionIntervalMs: this.state.actionIntervalMs,
      lastAiTickMs: this.state.lastAiTickMs,
      mapWidth: this.state.mapWidth,
      mapHeight: this.state.mapHeight,
      totalDamageDealt: this.state.totalDamageDealt,
      totalDamageTaken: this.state.totalDamageTaken,
      unitsLost: this.state.unitsLost,
      enemiesDefeated: this.state.enemiesDefeated,
      units: this.serializeUnitMap(this.state.units),
      aggroTable: this.serializeAggroMap(this.state.aggroTable),
    };
  }

  /**
   * 恢复模式状态
   */
  loadState(data: Record<string, unknown>): void {
    if (!data || typeof data !== 'object') return;

    this.state = {
      elapsedMs: typeof data.elapsedMs === 'number' ? Math.max(0, data.elapsedMs) : 0,
      timeLimitMs: typeof data.timeLimitMs === 'number' ? Math.max(0, data.timeLimitMs) : DEFAULT_TIME_LIMIT_MS,
      phase: data.phase === 'finished' ? 'finished' : 'running',
      actionIntervalMs: typeof data.actionIntervalMs === 'number' ? Math.max(1, data.actionIntervalMs) : DEFAULT_ACTION_INTERVAL_MS,
      lastAiTickMs: typeof data.lastAiTickMs === 'number' ? Math.max(0, data.lastAiTickMs) : 0,
      mapWidth: typeof data.mapWidth === 'number' ? Math.max(1, data.mapWidth) : DEFAULT_MAP_WIDTH,
      mapHeight: typeof data.mapHeight === 'number' ? Math.max(1, data.mapHeight) : DEFAULT_MAP_HEIGHT,
      totalDamageDealt: typeof data.totalDamageDealt === 'number' ? Math.max(0, data.totalDamageDealt) : 0,
      totalDamageTaken: typeof data.totalDamageTaken === 'number' ? Math.max(0, data.totalDamageTaken) : 0,
      unitsLost: typeof data.unitsLost === 'number' ? Math.max(0, data.unitsLost) : 0,
      enemiesDefeated: typeof data.enemiesDefeated === 'number' ? Math.max(0, data.enemiesDefeated) : 0,
      units: this.deserializeUnitMap(data.units),
      aggroTable: this.deserializeAggroMap(data.aggroTable),
    };
  }

  /**
   * 重置模式到初始状态
   */
  reset(): void {
    this.state = this.createInitialState();
  }

  // ============================================================
  // 公开访问器
  // ============================================================

  /** 获取已过时间 */
  get elapsedMs(): number {
    return this.state.elapsedMs;
  }

  /** 获取当前阶段 */
  get phase(): string {
    return this.state.phase;
  }

  /** 获取单位运行时状态 */
  getUnitState(unitId: string): FreeRoamUnit | undefined {
    return this.state.units.get(unitId);
  }

  /** 获取所有单位运行时状态 */
  getAllUnitStates(): Map<string, FreeRoamUnit> {
    return new Map(this.state.units);
  }

  /** 获取指定单位的仇恨列表 */
  getAggroList(unitId: string): AggroEntry[] {
    return this.state.aggroTable.get(unitId) ?? [];
  }

  /** 获取地图宽度 */
  get mapWidth(): number {
    return this.state.mapWidth;
  }

  /** 获取地图高度 */
  get mapHeight(): number {
    return this.state.mapHeight;
  }

  /** 获取内部状态（只读） */
  get internalState(): FreeRoamState {
    return this.state;
  }

  // ============================================================
  // 私有方法 — 初始化
  // ============================================================

  /**
   * 创建初始状态
   */
  private createInitialState(): FreeRoamState {
    return {
      units: new Map(),
      aggroTable: new Map(),
      mapWidth: this.mapWidth,
      mapHeight: this.mapHeight,
      elapsedMs: 0,
      timeLimitMs: this.timeLimitMs,
      phase: 'running',
      actionIntervalMs: this.actionIntervalMs,
      lastAiTickMs: 0,
      totalDamageDealt: 0,
      totalDamageTaken: 0,
      unitsLost: 0,
      enemiesDefeated: 0,
    };
  }

  /**
   * 初始化一方单位的位置和运行时状态
   *
   * 攻方在左侧，守方在右侧。
   * Y 坐标按索引均匀分布。
   */
  private initSideUnits(units: BattleUnit[], side: 'attacker' | 'defender'): void {
    if (units.length === 0) return;

    const isAttacker = side === 'attacker';
    const xMin = isAttacker ? ATTACKER_SPAWN_X_MIN : DEFENDER_SPAWN_X_MIN;
    const xMax = isAttacker ? ATTACKER_SPAWN_X_MAX : DEFENDER_SPAWN_X_MAX;

    for (let i = 0; i < units.length; i++) {
      const unit = units[i];
      const isRanged = this.isUnitRanged(unit);
      const attackRange = isRanged ? RANGED_ATTACK_RANGE : MELEE_ATTACK_RANGE;
      const moveSpeed = isRanged ? RANGED_MOVE_SPEED : MELEE_MOVE_SPEED;

      // X 坐标在范围内随机
      const x = xMin + Math.random() * (xMax - xMin);
      // Y 坐标均匀分布，带一点随机偏移
      const ySpacing = this.mapHeight / (units.length + 1);
      const y = ySpacing * (i + 1) + (Math.random() - 0.5) * ySpacing * 0.3;

      this.state.units.set(unit.id, {
        unitId: unit.id,
        x,
        y,
        targetX: x,
        targetY: y,
        targetEnemyId: null,
        attackRange,
        moveSpeed,
        attackCooldown: DEFAULT_ATTACK_COOLDOWN,
        currentAttackCd: 0, // 初始可立即攻击
        isRetreating: false,
      });
    }
  }

  // ============================================================
  // 私有方法 — AI Tick
  // ============================================================

  /**
   * 执行一次 AI tick
   *
   * 对每个存活单位：
   * 1. 更新仇恨表（被攻击+10，时间衰减-1/tick）
   * 2. 选择目标（仇恨最高的敌人，无仇恨则选最近的）
   * 3. 如果目标在攻击范围内 → 攻击（冷却完毕时）
   * 4. 如果目标不在攻击范围内 → 移动接近
   */
  private executeAiTick(ctx: BattleModeContext, dt: number): void {
    const aliveUnits = ctx.units.filter((u) => u.isAlive);

    for (const unit of aliveUnits) {
      const roamUnit = this.state.units.get(unit.id);
      if (!roamUnit) continue;

      // 1. 衰减仇恨值
      this.decayAggro(unit.id);

      // 2. 选择目标
      const target = this.selectTarget(unit, ctx);
      if (!target) {
        roamUnit.targetEnemyId = null;
        continue;
      }

      roamUnit.targetEnemyId = target.id;

      // 获取目标运行时状态
      const targetRoam = this.state.units.get(target.id);
      if (!targetRoam) continue;

      // 3. 计算距离
      const distance = this.getDistance(roamUnit.x, roamUnit.y, targetRoam.x, targetRoam.y);

      if (distance <= roamUnit.attackRange) {
        // 在攻击范围内 → 停止移动，尝试攻击
        roamUnit.targetX = roamUnit.x;
        roamUnit.targetY = roamUnit.y;

        // 远程单位保持最大攻击距离
        if (roamUnit.attackRange > MELEE_ATTACK_RANGE) {
          this.maintainRange(roamUnit, targetRoam, distance);
        }

        this.tryAttack(unit, target, ctx, roamUnit);
      } else {
        // 不在攻击范围内 → 移动接近
        roamUnit.targetX = targetRoam.x;
        roamUnit.targetY = targetRoam.y;

        // 移动
        this.moveToward(roamUnit, targetRoam.x, targetRoam.y, dt);
      }
    }
  }

  /**
   * 选择攻击目标
   *
   * 优先选择仇恨值最高的敌人，无仇恨则选最近的。
   */
  private selectTarget(unit: BattleUnit, ctx: BattleModeContext): BattleUnit | null {
    const enemySide: 'attacker' | 'defender' = unit.side === 'attacker' ? 'defender' : 'attacker';
    const enemies = ctx.getAliveUnits(enemySide);
    if (enemies.length === 0) return null;

    const aggroList = this.state.aggroTable.get(unit.id) ?? [];

    // 过滤出有仇恨值的存活敌人
    const aggroEnemies = enemies.filter((e) => {
      const entry = aggroList.find((a) => a.targetId === e.id);
      return entry && entry.value > 0;
    });

    if (aggroEnemies.length > 0) {
      // 选择仇恨值最高的
      let bestEnemy = aggroEnemies[0];
      let bestAggro = this.getAggroValue(unit.id, aggroEnemies[0].id);

      for (let i = 1; i < aggroEnemies.length; i++) {
        const aggro = this.getAggroValue(unit.id, aggroEnemies[i].id);
        if (aggro > bestAggro) {
          bestAggro = aggro;
          bestEnemy = aggroEnemies[i];
        }
      }

      return bestEnemy;
    }

    // 无仇恨，选择最近的敌人
    return this.findNearestEnemy(unit, enemies);
  }

  /**
   * 查找最近的敌方单位
   */
  private findNearestEnemy(unit: BattleUnit, enemies: BattleUnit[]): BattleUnit | null {
    if (enemies.length === 0) return null;

    const roamUnit = this.state.units.get(unit.id);
    if (!roamUnit) return enemies[0];

    let nearest: BattleUnit = enemies[0];
    let nearestDist = Infinity;

    for (const enemy of enemies) {
      const enemyRoam = this.state.units.get(enemy.id);
      if (!enemyRoam) continue;

      const dist = this.getDistance(roamUnit.x, roamUnit.y, enemyRoam.x, enemyRoam.y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = enemy;
      }
    }

    return nearest;
  }

  /**
   * 尝试攻击目标
   */
  private tryAttack(
    unit: BattleUnit,
    target: BattleUnit,
    ctx: BattleModeContext,
    roamUnit: FreeRoamUnit,
  ): void {
    // 检查攻击冷却
    if (roamUnit.currentAttackCd > 0) return;

    // 执行攻击
    const damageOutput = ctx.dealDamage(unit.id, target.id);

    // 记录伤害统计
    if (unit.side === 'attacker') {
      this.state.totalDamageDealt += damageOutput.damage;
    } else {
      this.state.totalDamageTaken += damageOutput.damage;
    }

    // 增加被攻击者的仇恨（被攻击+10）
    this.addAggro(target.id, unit.id, AGGRO_ON_ATTACKED);

    // 设置攻击冷却
    roamUnit.currentAttackCd = roamUnit.attackCooldown;

    // 发射事件
    ctx.emit({
      type: 'unit_damaged',
      data: {
        targetId: target.id,
        damage: damageOutput.damage,
        isCrit: damageOutput.isCrit,
        isMiss: damageOutput.isMiss,
      },
    });

    ctx.emit({
      type: 'action_executed',
      data: {
        unitId: unit.id,
        action: 'attack',
        targetIds: [target.id],
      },
    });

    // 检查目标是否死亡
    const refreshedTarget = ctx.getUnit(target.id);
    if (refreshedTarget && !refreshedTarget.isAlive) {
      ctx.emit({
        type: 'unit_died',
        data: { unitId: target.id, unitName: target.name, side: target.side },
      });

      if (target.side === 'attacker') {
        this.state.unitsLost++;
      } else {
        this.state.enemiesDefeated++;
      }
    }
  }

  // ============================================================
  // 私有方法 — 移动
  // ============================================================

  /**
   * 向目标位置直线移动
   *
   * 移动距离 = moveSpeed * dt / 1000
   */
  private moveToward(roamUnit: FreeRoamUnit, targetX: number, targetY: number, dtMs: number): void {
    const dx = targetX - roamUnit.x;
    const dy = targetY - roamUnit.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 1) return; // 已经足够近

    const dtSec = dtMs / 1000;
    const moveDistance = roamUnit.moveSpeed * dtSec;

    if (moveDistance >= distance) {
      // 到达目标
      roamUnit.x = targetX;
      roamUnit.y = targetY;
    } else {
      // 按比例移动
      const ratio = moveDistance / distance;
      roamUnit.x += dx * ratio;
      roamUnit.y += dy * ratio;
    }
  }

  /**
   * 移动所有单位（非 AI tick 帧也持续移动）
   */
  private moveAllUnits(dtMs: number): void {
    for (const [, roamUnit] of this.state.units) {
      // 只有目标与当前位置不同时才移动
      const dx = roamUnit.targetX - roamUnit.x;
      const dy = roamUnit.targetY - roamUnit.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 1) continue;

      this.moveToward(roamUnit, roamUnit.targetX, roamUnit.targetY, dtMs);
    }
  }

  /**
   * 远程单位保持最大攻击距离
   *
   * 如果距离目标太近（< 最大攻击距离的 80%），微微后退
   */
  private maintainRange(roamUnit: FreeRoamUnit, targetRoam: FreeRoamUnit, distance: number): void {
    const optimalDistance = roamUnit.attackRange * 0.9;

    if (distance < optimalDistance) {
      // 太近了，后退
      const dx = roamUnit.x - targetRoam.x;
      const dy = roamUnit.y - targetRoam.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 0) {
        const pushBack = optimalDistance - distance;
        roamUnit.x += (dx / dist) * pushBack;
        roamUnit.y += (dy / dist) * pushBack;
      }
    }
  }

  // ============================================================
  // 私有方法 — 仇恨系统
  // ============================================================

  /**
   * 增加仇恨值
   *
   * @param ownerId  仇恨表所属单位 ID
   * @param targetId 仇恨目标 ID
   * @param amount   增加量
   */
  private addAggro(ownerId: string, targetId: string, amount: number): void {
    let aggroList = this.state.aggroTable.get(ownerId);
    if (!aggroList) {
      aggroList = [];
      this.state.aggroTable.set(ownerId, aggroList);
    }

    const existing = aggroList.find((a) => a.targetId === targetId);
    if (existing) {
      existing.value += amount;
    } else {
      aggroList.push({ targetId, value: amount });
    }
  }

  /**
   * 获取对指定目标的仇恨值
   */
  private getAggroValue(ownerId: string, targetId: string): number {
    const aggroList = this.state.aggroTable.get(ownerId) ?? [];
    const entry = aggroList.find((a) => a.targetId === targetId);
    return entry?.value ?? 0;
  }

  /**
   * 衰减指定单位的所有仇恨值
   *
   * 每 tick 衰减 -1，最小 0
   */
  private decayAggro(unitId: string): void {
    const aggroList = this.state.aggroTable.get(unitId);
    if (!aggroList) return;

    for (const entry of aggroList) {
      entry.value = Math.max(AGGRO_MIN, entry.value - AGGRO_DECAY_PER_TICK);
    }
  }

  // ============================================================
  // 私有方法 — 碰撞回避
  // ============================================================

  /**
   * 碰撞回避：两个单位距离 < 30px 时互相推开
   */
  private resolveCollisions(): void {
    const unitArray = Array.from(this.state.units.values());

    for (let i = 0; i < unitArray.length; i++) {
      for (let j = i + 1; j < unitArray.length; j++) {
        const a = unitArray[i];
        const b = unitArray[j];

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < COLLISION_PUSH_DISTANCE && distance > 0) {
          // 计算推开方向
          const overlap = COLLISION_PUSH_DISTANCE - distance;
          const pushX = (dx / distance) * Math.min(overlap * 0.5, COLLISION_PUSH_FORCE);
          const pushY = (dy / distance) * Math.min(overlap * 0.5, COLLISION_PUSH_FORCE);

          // 互相推开
          a.x -= pushX;
          a.y -= pushY;
          b.x += pushX;
          b.y += pushY;
        }
      }
    }
  }

  // ============================================================
  // 私有方法 — 冷却和清理
  // ============================================================

  /**
   * 递减所有单位的攻击冷却
   */
  private tickAttackCooldowns(dt: number): void {
    for (const [, roamUnit] of this.state.units) {
      if (roamUnit.currentAttackCd > 0) {
        roamUnit.currentAttackCd = Math.max(0, roamUnit.currentAttackCd - dt);
      }
    }
  }

  /**
   * 限制所有单位在地图边界内
   */
  private clampAllToMap(): void {
    for (const [, roamUnit] of this.state.units) {
      roamUnit.x = Math.max(0, Math.min(this.state.mapWidth, roamUnit.x));
      roamUnit.y = Math.max(0, Math.min(this.state.mapHeight, roamUnit.y));
    }
  }

  /**
   * 清除死亡单位的运行时状态
   */
  private cleanupDeadUnits(ctx: BattleModeContext): void {
    const aliveIds = new Set(
      ctx.units.filter((u) => u.isAlive).map((u) => u.id),
    );

    for (const [id] of this.state.units) {
      if (!aliveIds.has(id)) {
        this.state.units.delete(id);
      }
    }
  }

  // ============================================================
  // 私有方法 — 辅助
  // ============================================================

  /**
   * 判断单位是否为远程
   *
   * 基于攻击力与防御力的比值：攻击力 > 防御力 * 2 视为远程
   */
  private isUnitRanged(unit: BattleUnit): boolean {
    return unit.stats.attack > unit.stats.defense * 2;
  }

  /**
   * 计算两点之间的距离
   */
  private getDistance(x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // ============================================================
  // 序列化辅助
  // ============================================================

  /** 序列化单位 Map */
  private serializeUnitMap(units: Map<string, FreeRoamUnit>): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    for (const [id, u] of units) {
      obj[id] = { ...u };
    }
    return obj;
  }

  /** 反序列化单位 Map */
  private deserializeUnitMap(data: unknown): Map<string, FreeRoamUnit> {
    const map = new Map<string, FreeRoamUnit>();
    if (typeof data !== 'object' || data === null) return map;

    const obj = data as Record<string, unknown>;
    for (const [id, val] of Object.entries(obj)) {
      if (typeof val === 'object' && val !== null) {
        const s = val as Record<string, unknown>;
        map.set(id, {
          unitId: typeof s.unitId === 'string' ? s.unitId : id,
          x: typeof s.x === 'number' ? s.x : 0,
          y: typeof s.y === 'number' ? s.y : 0,
          targetX: typeof s.targetX === 'number' ? s.targetX : 0,
          targetY: typeof s.targetY === 'number' ? s.targetY : 0,
          targetEnemyId: typeof s.targetEnemyId === 'string' ? s.targetEnemyId : null,
          attackRange: typeof s.attackRange === 'number' ? Math.max(0, s.attackRange) : MELEE_ATTACK_RANGE,
          moveSpeed: typeof s.moveSpeed === 'number' ? Math.max(0, s.moveSpeed) : MELEE_MOVE_SPEED,
          attackCooldown: typeof s.attackCooldown === 'number' ? Math.max(0, s.attackCooldown) : DEFAULT_ATTACK_COOLDOWN,
          currentAttackCd: typeof s.currentAttackCd === 'number' ? Math.max(0, s.currentAttackCd) : 0,
          isRetreating: typeof s.isRetreating === 'boolean' ? s.isRetreating : false,
        });
      }
    }
    return map;
  }

  /** 序列化仇恨 Map */
  private serializeAggroMap(aggroTable: Map<string, AggroEntry[]>): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    for (const [id, entries] of aggroTable) {
      obj[id] = entries.map((e) => ({ ...e }));
    }
    return obj;
  }

  /** 反序列化仇恨 Map */
  private deserializeAggroMap(data: unknown): Map<string, AggroEntry[]> {
    const map = new Map<string, AggroEntry[]>();
    if (typeof data !== 'object' || data === null) return map;

    const obj = data as Record<string, unknown>;
    for (const [id, val] of Object.entries(obj)) {
      if (Array.isArray(val)) {
        const entries: AggroEntry[] = val
          .filter((e): e is Record<string, unknown> => typeof e === 'object' && e !== null)
          .map((e) => ({
            targetId: typeof e.targetId === 'string' ? e.targetId : '',
            value: typeof e.value === 'number' ? Math.max(0, Math.floor(e.value)) : 0,
          }));
        map.set(id, entries);
      }
    }
    return map;
  }
}
