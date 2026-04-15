/**
 * NavalMode — 海战/空战模式（实时舰船战斗）
 *
 * 参考大航海时代、全面战争海战的实时战斗体验：
 * - 实时战斗，类似 FreeRoamMode
 * - 单位是舰船（有速度、转向速度、火炮射程）
 * - 船有左右两侧火炮（侧面攻击）
 * - 风向影响移动速度
 * - 撞击伤害（高速碰撞）
 * - 船可以沉没（HP 归零）
 *
 * 设计原则：
 * - 零外部依赖，纯 TypeScript 实现
 * - 坐标系统使用像素坐标，单位位置为 {x, y} 浮点数
 * - 移动速度单位是像素/秒
 * - 角度使用度数（0-360）
 * - 火炮冷却单位是毫秒
 *
 * @module engines/idle/modules/battle/NavalMode
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

/** 船只定义 */
export interface ShipDef {
  /** 船只定义 ID */
  id: string;
  /** 船只名称 */
  name: string;
  /** 生命值 */
  hp: number;
  /** 最大速度（像素/秒） */
  speed: number;
  /** 转向速度（度/秒） */
  turnSpeed: number;
  /** 火炮单发伤害 */
  cannonDamage: number;
  /** 火炮射程（像素） */
  cannonRange: number;
  /** 火炮冷却（毫秒） */
  cannonCooldown: number;
  /** 侧舷火炮数量（每次齐射发射数量） */
  broadsideCount: number;
  /** 撞击伤害 */
  ramDamage: number;
  /** 碰撞体积 */
  size: { width: number; height: number };
}

/** 风向 */
export interface Wind {
  /** 风向角度（0-360 度，0=东，90=南，180=西，270=北） */
  direction: number;
  /** 风速倍率（0-2，1=正常） */
  speed: number;
}

/** 船只运行时状态 */
export interface ShipUnit {
  /** 船只定义 ID */
  defId: string;
  /** 运行时实例 ID */
  instanceId: string;
  /** 阵营 */
  side: 'attacker' | 'defender';
  /** 船只名称 */
  name: string;
  /** 当前 HP */
  currentHp: number;
  /** 最大 HP */
  maxHp: number;
  /** 当前位置 */
  position: { x: number; y: number };
  /** 朝向角度（度，0=东，顺时针增加） */
  rotation: number;
  /** 当前速度（像素/秒） */
  currentSpeed: number;
  /** 火炮冷却剩余时间（毫秒） */
  cannonCooldownLeft: number;
  /** 是否存活 */
  isAlive: boolean;
}

/** 海战配置 */
export interface NavalConfig {
  /** 地图宽度（像素） */
  mapWidth: number;
  /** 地图高度（像素） */
  mapHeight: number;
  /** 风向设置 */
  wind: Wind;
  /** 攻方船只定义列表 */
  attackerShips: ShipDef[];
  /** 守方船只定义列表 */
  defenderShips: ShipDef[];
  /** 时间限制（毫秒） */
  timeLimitMs: number;
}

/** 海战内部状态 */
export interface NavalState {
  /** 当前阶段 */
  phase: 'running' | 'finished';
  /** 所有船只运行时状态 */
  ships: ShipUnit[];
  /** 风向 */
  wind: Wind;
  /** 已过时间（毫秒） */
  elapsedMs: number;
  /** 时间限制（毫秒） */
  timeLimitMs: number;
}

// ============================================================
// 常量
// ============================================================

/** 默认时间限制：3 分钟 */
const DEFAULT_TIME_LIMIT_MS = 180_000;

/** 默认地图宽度 */
const DEFAULT_MAP_WIDTH = 1200;

/** 默认地图高度 */
const DEFAULT_MAP_HEIGHT = 800;

/** 火炮攻击角度范围：侧面 ±90 度内可开火 */
const BROADSIDE_ARC_DEGREES = 90;

/** 撞击速度阈值：速度超过此值才会产生撞击伤害 */
const RAM_SPEED_THRESHOLD = 20;

/** 撞击冷却（毫秒），防止同一对船只连续撞击 */
const RAM_COOLDOWN_MS = 1000;

/** AI 决策间隔（毫秒） */
const AI_DECISION_INTERVAL_MS = 100;

/** 角度标准化范围 [0, 360) */
const ANGLE_FULL = 360;

/** 攻方初始 X 范围（地图左侧） */
const ATTACKER_SPAWN_X_MIN = 80;
const ATTACKER_SPAWN_X_MAX = 200;

/** 守方初始 X 范围（地图右侧） */
const DEFENDER_SPAWN_X_MIN = 1000;
const DEFENDER_SPAWN_X_MAX = 1120;

/** 实例 ID 计数器 */
let navalInstanceCounter = 0;

// ============================================================
// NavalMode 实现
// ============================================================

/**
 * 海战/空战模式 — 实时舰船战斗
 *
 * 核心机制：
 * 1. 船只在地图上实时移动，有朝向和速度
 * 2. 火炮从侧面发射（左右两侧），需在射程内且角度合适
 * 3. 风向影响船只移动速度（顺风加速、逆风减速）
 * 4. 高速碰撞产生撞击伤害
 * 5. AI 自动控制：移动接近、侧面朝敌、开火、避免碰撞
 *
 * @example
 * ```typescript
 * const mode = new NavalMode({
 *   mapWidth: 1200,
 *   mapHeight: 800,
 *   wind: { direction: 90, speed: 1.0 },
 *   attackerShips: [frigateDef],
 *   defenderShips: [galleonDef],
 *   timeLimitMs: 180000,
 * });
 * mode.init(ctx);
 * mode.update(ctx, 16);
 * ```
 */
export class NavalMode implements IBattleMode {
  readonly type = 'naval';

  /** 海战配置 */
  private readonly config: NavalConfig;

  /** 内部状态 */
  private state: NavalState;

  /** 船只定义映射（defId → ShipDef） */
  private shipDefs: Map<string, ShipDef> = new Map();

  /** 撞击冷却映射（`${idA}_${idB}` → 剩余毫秒） */
  private ramCooldowns: Map<string, number> = new Map();

  /** AI 上次决策时间 */
  private lastAiDecisionMs = 0;

  /** 累计伤害统计 */
  private totalDamageDealt = 0;
  private totalDamageTaken = 0;
  private unitsLost = 0;
  private enemiesDefeated = 0;

  // ============================================================
  // 构造函数
  // ============================================================

  /**
   * 创建海战模式
   *
   * @param config - 海战配置
   */
  constructor(config?: Partial<NavalConfig>) {
    this.config = {
      mapWidth: config?.mapWidth ?? DEFAULT_MAP_WIDTH,
      mapHeight: config?.mapHeight ?? DEFAULT_MAP_HEIGHT,
      wind: config?.wind ?? { direction: 0, speed: 1.0 },
      attackerShips: config?.attackerShips ?? [],
      defenderShips: config?.defenderShips ?? [],
      timeLimitMs: config?.timeLimitMs ?? DEFAULT_TIME_LIMIT_MS,
    };

    this.state = this.createInitialState();

    // 注册船只定义
    for (const ship of this.config.attackerShips) {
      this.shipDefs.set(ship.id, ship);
    }
    for (const ship of this.config.defenderShips) {
      this.shipDefs.set(ship.id, ship);
    }
  }

  // ============================================================
  // 生命周期（IBattleMode 接口）
  // ============================================================

  /**
   * 初始化模式 — 在地图两侧初始化船只位置
   *
   * 攻方船只朝右（0度），守方船只朝左（180度）。
   * Y 坐标按索引均匀分布在地图高度范围内。
   */
  init(ctx: BattleModeContext): void {
    this.state = this.createInitialState();
    this.ramCooldowns.clear();
    this.lastAiDecisionMs = 0;
    this.totalDamageDealt = 0;
    this.totalDamageTaken = 0;
    this.unitsLost = 0;
    this.enemiesDefeated = 0;

    // 从 BattleModeContext 的 units 中获取阵营信息，
    // 结合 NavalConfig 的船只定义创建运行时船只
    const attackerUnits = ctx.units.filter((u) => u.isAlive && u.side === 'attacker');
    const defenderUnits = ctx.units.filter((u) => u.isAlive && u.side === 'defender');

    // 初始化攻方船只
    this.initSideShips(attackerUnits, this.config.attackerShips, 'attacker');
    // 初始化守方船只
    this.initSideShips(defenderUnits, this.config.defenderShips, 'defender');

    this.state.phase = 'running';
  }

  /**
   * 每帧更新 — 实时更新：移动 → AI 决策 → 火炮攻击 → 碰撞检测 → 死亡检查
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

    // 递减火炮冷却
    this.tickCannonCooldowns(scaledDt);

    // 递减撞击冷却
    this.tickRamCooldowns(scaledDt);

    // AI 决策（每 AI_DECISION_INTERVAL_MS 一次）
    if (this.state.elapsedMs - this.lastAiDecisionMs >= AI_DECISION_INTERVAL_MS) {
      this.lastAiDecisionMs = this.state.elapsedMs;
      this.executeAiTick(ctx, scaledDt);
    }

    // 移动所有船只
    this.moveAllShips(scaledDt);

    // 碰撞检测（撞击伤害）
    this.checkRamCollisions(ctx);

    // 限制在地图边界内
    this.clampAllToMap();

    // 同步死亡状态到 ctx
    this.syncDeathToContext(ctx);

    // 清除已沉没船只的速度
    this.stopDeadShips();
  }

  /**
   * 检查胜利条件 — 所有防守方船只沉没
   *
   * 基于内部 ships 状态判断，不依赖 ctx.getAliveUnits。
   */
  checkWin(_ctx: BattleModeContext): boolean {
    return this.getAliveShips('defender').length === 0;
  }

  /**
   * 检查失败条件 — 所有攻击方船只沉没
   *
   * 基于内部 ships 状态判断，不依赖 ctx.getAliveUnits。
   */
  checkLose(_ctx: BattleModeContext): boolean {
    return this.getAliveShips('attacker').length === 0;
  }

  /**
   * 结算战斗结果
   */
  settle(ctx: BattleModeContext, durationMs: number): BattleResult {
    const won = this.checkWin(ctx);

    // 计算 MVP：存活船只中 HP 最高的
    const alive = this.state.ships.filter((s) => s.isAlive && (won ? s.side === 'attacker' : s.side === 'defender'));
    const mvp = alive.length > 0
      ? alive.reduce((best, s) => s.currentHp > best.currentHp ? s : best, alive[0])
      : null;

    return {
      won,
      rewards: {},
      drops: {},
      mvp: mvp?.instanceId ?? null,
      durationMs,
      stats: {
        totalDamageDealt: this.totalDamageDealt,
        totalDamageTaken: this.totalDamageTaken,
        unitsLost: this.unitsLost,
        enemiesDefeated: this.enemiesDefeated,
      },
    };
  }

  /**
   * 获取模式状态（用于存档）
   */
  getState(): Record<string, unknown> {
    return {
      phase: this.state.phase,
      ships: this.state.ships.map((s) => ({ ...s, position: { ...s.position } })),
      wind: { ...this.state.wind },
      elapsedMs: this.state.elapsedMs,
      timeLimitMs: this.state.timeLimitMs,
      totalDamageDealt: this.totalDamageDealt,
      totalDamageTaken: this.totalDamageTaken,
      unitsLost: this.unitsLost,
      enemiesDefeated: this.enemiesDefeated,
      ramCooldowns: Object.fromEntries(this.ramCooldowns),
      lastAiDecisionMs: this.lastAiDecisionMs,
    };
  }

  /**
   * 恢复模式状态
   */
  loadState(data: Record<string, unknown>): void {
    if (!data || typeof data !== 'object') return;

    this.state = {
      phase: data.phase === 'finished' ? 'finished' : 'running',
      ships: Array.isArray(data.ships)
        ? (data.ships as unknown[]).filter((s): s is Record<string, unknown> => typeof s === 'object' && s !== null)
          .map((s) => this.deserializeShip(s))
        : [],
      wind: typeof data.wind === 'object' && data.wind !== null
        ? {
          direction: typeof (data.wind as Record<string, unknown>).direction === 'number'
            ? ((data.wind as Record<string, unknown>).direction as number) : 0,
          speed: typeof (data.wind as Record<string, unknown>).speed === 'number'
            ? ((data.wind as Record<string, unknown>).speed as number) : 1.0,
        }
        : { direction: 0, speed: 1.0 },
      elapsedMs: typeof data.elapsedMs === 'number' ? Math.max(0, data.elapsedMs) : 0,
      timeLimitMs: typeof data.timeLimitMs === 'number' ? Math.max(0, data.timeLimitMs) : DEFAULT_TIME_LIMIT_MS,
    };

    this.totalDamageDealt = typeof data.totalDamageDealt === 'number' ? Math.max(0, data.totalDamageDealt) : 0;
    this.totalDamageTaken = typeof data.totalDamageTaken === 'number' ? Math.max(0, data.totalDamageTaken) : 0;
    this.unitsLost = typeof data.unitsLost === 'number' ? Math.max(0, data.unitsLost) : 0;
    this.enemiesDefeated = typeof data.enemiesDefeated === 'number' ? Math.max(0, data.enemiesDefeated) : 0;
    this.lastAiDecisionMs = typeof data.lastAiDecisionMs === 'number' ? Math.max(0, data.lastAiDecisionMs) : 0;

    // 恢复撞击冷却
    this.ramCooldowns.clear();
    if (typeof data.ramCooldowns === 'object' && data.ramCooldowns !== null) {
      const rc = data.ramCooldowns as Record<string, unknown>;
      for (const [key, val] of Object.entries(rc)) {
        if (typeof val === 'number') {
          this.ramCooldowns.set(key, Math.max(0, val));
        }
      }
    }
  }

  /**
   * 重置模式到初始状态
   */
  reset(): void {
    this.state = this.createInitialState();
    this.ramCooldowns.clear();
    this.lastAiDecisionMs = 0;
    this.totalDamageDealt = 0;
    this.totalDamageTaken = 0;
    this.unitsLost = 0;
    this.enemiesDefeated = 0;
  }

  // ============================================================
  // 公开访问器
  // ============================================================

  /** 获取风向 */
  getWind(): Wind {
    return { ...this.state.wind };
  }

  /** 获取所有船只（副本） */
  getShips(): ShipUnit[] {
    return this.state.ships.map((s) => ({ ...s, position: { ...s.position } }));
  }

  /** 获取所有船只（内部引用，用于测试） */
  getShipsRef(): ShipUnit[] {
    return this.state.ships;
  }

  /** 获取存活船只，可按阵营过滤 */
  getAliveShips(side?: 'attacker' | 'defender'): ShipUnit[] {
    return this.state.ships.filter(
      (s) => s.isAlive && (side === undefined || s.side === side),
    );
  }

  /** 获取内部状态 */
  getStateData(): NavalState {
    return {
      ...this.state,
      ships: this.state.ships.map((s) => ({ ...s, position: { ...s.position } })),
      wind: { ...this.state.wind },
    };
  }

  /** 获取已过时间 */
  get elapsedMs(): number {
    return this.state.elapsedMs;
  }

  /** 获取当前阶段 */
  get phase(): string {
    return this.state.phase;
  }

  // ============================================================
  // 私有方法 — 初始化
  // ============================================================

  /**
   * 创建初始状态
   */
  private createInitialState(): NavalState {
    return {
      phase: 'running',
      ships: [],
      wind: { ...this.config.wind },
      elapsedMs: 0,
      timeLimitMs: this.config.timeLimitMs,
    };
  }

  /**
   * 初始化一方船只的位置和运行时状态
   *
   * 攻方在左侧朝右（0度），守方在右侧朝左（180度）。
   * Y 坐标按索引均匀分布。
   *
   * @param ctxUnits - 上下文中的单位列表
   * @param shipDefs - 船只定义列表
   * @param side - 阵营
   */
  private initSideShips(
    ctxUnits: BattleUnit[],
    shipDefs: ShipDef[],
    side: 'attacker' | 'defender',
  ): void {
    if (ctxUnits.length === 0) return;

    const isAttacker = side === 'attacker';
    const xMin = isAttacker ? ATTACKER_SPAWN_X_MIN : DEFENDER_SPAWN_X_MIN;
    const xMax = isAttacker ? ATTACKER_SPAWN_X_MAX : DEFENDER_SPAWN_X_MAX;
    const defaultRotation = isAttacker ? 0 : 180;

    for (let i = 0; i < ctxUnits.length; i++) {
      const ctxUnit = ctxUnits[i];
      // 查找匹配的船只定义，若没有则用第一个或默认值
      const shipDef = shipDefs[i] ?? shipDefs[0] ?? this.createDefaultShipDef(ctxUnit.id, ctxUnit.name);

      // 确保 shipDefs 已注册
      if (!this.shipDefs.has(shipDef.id)) {
        this.shipDefs.set(shipDef.id, shipDef);
      }

      // X 坐标在范围内均匀分布
      const xSpacing = (xMax - xMin) / (ctxUnits.length + 1);
      const x = xMin + xSpacing * (i + 1);

      // Y 坐标均匀分布在地图高度范围内
      const ySpacing = this.config.mapHeight / (ctxUnits.length + 1);
      const y = ySpacing * (i + 1);

      const ship: ShipUnit = {
        defId: shipDef.id,
        instanceId: ctxUnit.id,
        side,
        name: ctxUnit.name,
        currentHp: ctxUnit.stats.hp,
        maxHp: ctxUnit.stats.maxHp,
        position: { x, y },
        rotation: defaultRotation,
        currentSpeed: 0,
        cannonCooldownLeft: 0,
        isAlive: true,
      };

      this.state.ships.push(ship);
    }
  }

  /**
   * 创建默认船只定义（当没有提供 ShipDef 时使用）
   */
  private createDefaultShipDef(id: string, name: string): ShipDef {
    return {
      id,
      name,
      hp: 100,
      speed: 80,
      turnSpeed: 45,
      cannonDamage: 15,
      cannonRange: 200,
      cannonCooldown: 2000,
      broadsideCount: 3,
      ramDamage: 30,
      size: { width: 40, height: 15 },
    };
  }

  // ============================================================
  // 私有方法 — AI 决策
  // ============================================================

  /**
   * 执行一次 AI tick
   *
   * 对每个存活船只：
   * 1. 寻找最近的敌方船只
   * 2. 如果在火炮射程内且侧面朝向敌人 → 开火
   * 3. 如果不在射程内 → 向敌人移动
   * 4. 如果在射程内但角度不对 → 调整朝向
   */
  private executeAiTick(ctx: BattleModeContext, dt: number): void {
    const aliveShips = this.state.ships.filter((s) => s.isAlive);

    for (const ship of aliveShips) {
      const shipDef = this.shipDefs.get(ship.defId);
      if (!shipDef) continue;

      const enemySide: 'attacker' | 'defender' = ship.side === 'attacker' ? 'defender' : 'attacker';
      const enemies = this.state.ships.filter((s) => s.isAlive && s.side === enemySide);

      if (enemies.length === 0) {
        ship.currentSpeed = 0;
        continue;
      }

      // 寻找最近的敌人
      const nearestEnemy = this.findNearestShip(ship, enemies);
      if (!nearestEnemy) {
        ship.currentSpeed = 0;
        continue;
      }

      const distance = this.getDistance(ship.position, nearestEnemy.position);
      const angleToEnemy = this.getAngleTo(ship.position, nearestEnemy.position);
      const angleDiff = this.getAngleDifference(ship.rotation, angleToEnemy);

      // 判断是否在火炮射程内
      if (distance <= shipDef.cannonRange) {
        // 在射程内，尝试侧面朝敌并开火
        const broadsideAngle = this.getBroadsideAngle(ship.rotation, angleToEnemy);

        if (broadsideAngle && ship.cannonCooldownLeft <= 0) {
          // 侧面朝向敌人且冷却完毕 → 开火
          this.fireBroadside(ship, nearestEnemy, shipDef, ctx);
          // 开火后减速（齐射后减速模拟后坐力）
          ship.currentSpeed = Math.max(0, ship.currentSpeed * 0.5);
        } else if (!broadsideAngle) {
          // 角度不对，转向使侧面朝向敌人
          this.turnToBroadside(ship, angleToEnemy, shipDef, dt);
        } else {
          // 冷却中，保持适当距离
          this.maintainCannonRange(ship, nearestEnemy, shipDef, dt);
        }
      } else {
        // 不在射程内，向敌人移动
        this.moveTowardEnemy(ship, nearestEnemy, shipDef, dt);
      }
    }
  }

  /**
   * 向敌人移动
   *
   * 船只转向目标方向，然后加速前进。
   * 风向影响移动速度。
   */
  private moveTowardEnemy(ship: ShipUnit, enemy: ShipUnit, shipDef: ShipDef, dt: number): void {
    const angleToEnemy = this.getAngleTo(ship.position, enemy.position);
    const angleDiff = this.getAngleDifference(ship.rotation, angleToEnemy);

    // 先转向
    if (Math.abs(angleDiff) > 5) {
      this.turnToward(ship, angleToEnemy, shipDef.turnSpeed, dt);
    }

    // 加速（受风向影响）
    const windMultiplier = this.getWindSpeedMultiplier(ship.rotation);
    const targetSpeed = shipDef.speed * windMultiplier;
    ship.currentSpeed = this.lerpSpeed(ship.currentSpeed, targetSpeed, dt);
  }

  /**
   * 转向使侧面朝向敌人
   *
   * 目标角度是使敌人正好在船只的左舷或右舷方向（±90度）
   */
  private turnToBroadside(ship: ShipUnit, angleToEnemy: number, shipDef: ShipDef, dt: number): void {
    // 选择最近的侧面角度（左舷 +90 或右舷 -90）
    const leftBroadside = this.normalizeAngle(angleToEnemy - 90);
    const rightBroadside = this.normalizeAngle(angleToEnemy + 90);

    const diffLeft = Math.abs(this.getAngleDifference(ship.rotation, leftBroadside));
    const diffRight = Math.abs(this.getAngleDifference(ship.rotation, rightBroadside));

    const targetAngle = diffLeft < diffRight ? leftBroadside : rightBroadside;

    this.turnToward(ship, targetAngle, shipDef.turnSpeed, dt);

    // 转向时保持低速
    ship.currentSpeed = Math.min(ship.currentSpeed, shipDef.speed * 0.3);
  }

  /**
   * 保持火炮射程距离
   *
   * 在射程内但冷却中时，保持适当距离，避免太近或太远。
   */
  private maintainCannonRange(ship: ShipUnit, enemy: ShipUnit, shipDef: ShipDef, dt: number): void {
    const distance = this.getDistance(ship.position, enemy.position);
    const optimalRange = shipDef.cannonRange * 0.8;

    if (distance < optimalRange * 0.5) {
      // 太近了，减速或后退
      ship.currentSpeed = Math.max(0, ship.currentSpeed - shipDef.speed * 0.5 * (dt / 1000));
    } else if (distance > optimalRange) {
      // 太远了，靠近一点
      const windMultiplier = this.getWindSpeedMultiplier(ship.rotation);
      ship.currentSpeed = shipDef.speed * 0.5 * windMultiplier;
    } else {
      // 合适距离，缓慢移动
      ship.currentSpeed = shipDef.speed * 0.2;
    }
  }

  // ============================================================
  // 私有方法 — 火炮攻击
  // ============================================================

  /**
   * 发射侧舷齐射
   *
   * 检查角度是否在侧面范围内，计算伤害。
   * 伤害 = cannonDamage × broadsideCount × 距离衰减
   */
  private fireBroadside(
    ship: ShipUnit,
    target: ShipUnit,
    shipDef: ShipDef,
    ctx: BattleModeContext,
  ): void {
    if (ship.cannonCooldownLeft > 0) return;

    // 计算距离衰减（射程内线性衰减，远距离伤害降低）
    const distance = this.getDistance(ship.position, target.position);
    const rangeRatio = Math.max(0.3, 1 - (distance / shipDef.cannonRange) * 0.5);

    // 计算总伤害
    const totalDamage = Math.floor(shipDef.cannonDamage * shipDef.broadsideCount * rangeRatio);

    // 设置冷却
    ship.cannonCooldownLeft = shipDef.cannonCooldown;

    // 对目标造成伤害
    target.currentHp = Math.max(0, target.currentHp - totalDamage);

    // 统计
    if (ship.side === 'attacker') {
      this.totalDamageDealt += totalDamage;
    } else {
      this.totalDamageTaken += totalDamage;
    }

    // 通过 ctx 造成伤害（同步到 BattleUnit）
    const ctxTarget = ctx.getUnit(target.instanceId);
    if (ctxTarget && ctxTarget.isAlive) {
      // 使用 dealDamage 同步伤害
      const dmgOutput = ctx.dealDamage(ship.instanceId, target.instanceId, totalDamage);
      // 用实际伤害覆盖（因为 NavalMode 有自己的伤害计算）
      // 但我们仍然需要同步 HP
      target.currentHp = ctxTarget.currentHp <= 0 ? 0 : target.currentHp;
    }

    // 发射事件
    ctx.emit({
      type: 'unit_damaged',
      data: {
        targetId: target.instanceId,
        damage: totalDamage,
        isCrit: false,
        isMiss: false,
      },
    });

    ctx.emit({
      type: 'action_executed',
      data: {
        unitId: ship.instanceId,
        action: 'broadside',
        targetIds: [target.instanceId],
      },
    });

    // 检查目标是否沉没
    if (target.currentHp <= 0) {
      target.isAlive = false;
      target.currentSpeed = 0;

      ctx.emit({
        type: 'unit_died',
        data: { unitId: target.instanceId, unitName: target.name, side: target.side },
      });

      if (target.side === 'attacker') {
        this.unitsLost++;
      } else {
        this.enemiesDefeated++;
      }
    }
  }

  /**
   * 判断侧面角度是否可以开火
   *
   * 侧面火炮的射击弧度：排除正前方和正后方的盲区。
   * - 正前方盲区：船首方向 ±30 度
   * - 正后方盲区：船尾方向 ±30 度
   * - 其余角度均可开火（左舷或右舷）
   *
   * @returns 可以开火的侧面（左舷或右舷），或 null
   */
  private getBroadsideAngle(shipRotation: number, angleToEnemy: number): 'left' | 'right' | null {
    // 计算敌人相对于船首方向的角度差（-180 到 180）
    const relativeAngle = this.getAngleDifference(shipRotation, angleToEnemy);

    // 正前方盲区：±30 度
    const deadZoneFront = 30;
    // 正后方盲区：±30 度（即 |relativeAngle| > 150 度）
    const deadZoneRear = 30;

    const absAngle = Math.abs(relativeAngle);

    if (absAngle <= deadZoneFront) return null; // 正前方盲区
    if (absAngle >= 180 - deadZoneRear) return null; // 正后方盲区

    // 判断是左舷还是右舷
    // relativeAngle > 0 表示敌人在右舷方向
    // relativeAngle < 0 表示敌人在左舷方向
    return relativeAngle > 0 ? 'right' : 'left';
  }

  // ============================================================
  // 私有方法 — 碰撞/撞击
  // ============================================================

  /**
   * 检查撞击碰撞
   *
   * 两艘船距离小于碰撞半径且速度超过阈值时产生撞击伤害。
   */
  private checkRamCollisions(ctx: BattleModeContext): void {
    const aliveShips = this.state.ships.filter((s) => s.isAlive);

    for (let i = 0; i < aliveShips.length; i++) {
      for (let j = i + 1; j < aliveShips.length; j++) {
        const shipA = aliveShips[i];
        const shipB = aliveShips[j];

        const defA = this.shipDefs.get(shipA.defId);
        const defB = this.shipDefs.get(shipB.defId);
        if (!defA || !defB) continue;

        const distance = this.getDistance(shipA.position, shipB.position);
        const collisionRadius = (defA.size.width + defB.size.width) / 2;

        if (distance < collisionRadius) {
          // 碰撞！检查撞击冷却
          const pairKey = this.getRamPairKey(shipA.instanceId, shipB.instanceId);
          if (this.ramCooldowns.has(pairKey)) continue;

          // 计算撞击伤害（基于速度）
          const speedA = shipA.currentSpeed;
          const speedB = shipB.currentSpeed;

          // 至少一艘船的速度超过阈值
          if (speedA > RAM_SPEED_THRESHOLD || speedB > RAM_SPEED_THRESHOLD) {
            // A 撞 B：A 的速度越高，B 受到的伤害越大
            if (speedA > RAM_SPEED_THRESHOLD) {
              const ramDmg = Math.floor(defA.ramDamage * (speedA / 80));
              this.applyRamDamage(shipA, shipB, ramDmg, ctx);
            }

            // B 撞 A：B 的速度越高，A 受到的伤害越大
            if (speedB > RAM_SPEED_THRESHOLD) {
              const ramDmg = Math.floor(defB.ramDamage * (speedB / 80));
              this.applyRamDamage(shipB, shipA, ramDmg, ctx);
            }

            // 设置撞击冷却
            this.ramCooldowns.set(pairKey, RAM_COOLDOWN_MS);

            // 推开船只
            this.pushApart(shipA, shipB, collisionRadius - distance);
          }
        }
      }
    }
  }

  /**
   * 应用撞击伤害
   */
  private applyRamDamage(
    attacker: ShipUnit,
    target: ShipUnit,
    damage: number,
    ctx: BattleModeContext,
  ): void {
    target.currentHp = Math.max(0, target.currentHp - damage);

    if (attacker.side === 'attacker') {
      this.totalDamageDealt += damage;
    } else {
      this.totalDamageTaken += damage;
    }

    ctx.emit({
      type: 'unit_damaged',
      data: {
        targetId: target.instanceId,
        damage,
        isCrit: false,
        isMiss: false,
      },
    });

    // 检查是否沉没
    if (target.currentHp <= 0) {
      target.isAlive = false;
      target.currentSpeed = 0;

      ctx.emit({
        type: 'unit_died',
        data: { unitId: target.instanceId, unitName: target.name, side: target.side },
      });

      if (target.side === 'attacker') {
        this.unitsLost++;
      } else {
        this.enemiesDefeated++;
      }
    }
  }

  /**
   * 推开两艘碰撞的船只
   */
  private pushApart(shipA: ShipUnit, shipB: ShipUnit, overlap: number): void {
    const dx = shipB.position.x - shipA.position.x;
    const dy = shipB.position.y - shipA.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance === 0) {
      // 完全重叠，随机方向推开
      shipA.position.x -= overlap / 2;
      shipB.position.x += overlap / 2;
      return;
    }

    const pushX = (dx / distance) * overlap / 2;
    const pushY = (dy / distance) * overlap / 2;

    shipA.position.x -= pushX;
    shipA.position.y -= pushY;
    shipB.position.x += pushX;
    shipB.position.y += pushY;

    // 碰撞后减速
    shipA.currentSpeed *= 0.3;
    shipB.currentSpeed *= 0.3;
  }

  // ============================================================
  // 私有方法 — 移动
  // ============================================================

  /**
   * 移动所有船只
   *
   * 根据当前速度和朝向更新位置。
   * 风向影响实际移动速度。
   */
  private moveAllShips(dt: number): void {
    const dtSec = dt / 1000;

    for (const ship of this.state.ships) {
      if (!ship.isAlive) continue;

      // 应用风向影响
      const windMultiplier = this.getWindSpeedMultiplier(ship.rotation);
      const effectiveSpeed = ship.currentSpeed * windMultiplier;

      // 根据朝向计算移动向量
      const rad = (ship.rotation * Math.PI) / 180;
      const dx = Math.cos(rad) * effectiveSpeed * dtSec;
      const dy = Math.sin(rad) * effectiveSpeed * dtSec;

      ship.position.x += dx;
      ship.position.y += dy;
    }
  }

  /**
   * 转向目标角度
   *
   * 以不超过 turnSpeed 的速率转向。
   */
  private turnToward(ship: ShipUnit, targetAngle: number, turnSpeed: number, dt: number): void {
    const diff = this.getAngleDifference(ship.rotation, targetAngle);
    const maxTurn = turnSpeed * (dt / 1000);

    if (Math.abs(diff) <= maxTurn) {
      ship.rotation = targetAngle;
    } else {
      ship.rotation = this.normalizeAngle(ship.rotation + Math.sign(diff) * maxTurn);
    }
  }

  // ============================================================
  // 私有方法 — 风向
  // ============================================================

  /**
   * 计算风向对船只速度的影响倍率
   *
   * 顺风（船朝向与风向一致）：速度 × (1 + wind.speed × 0.3)
   * 逆风（船朝向与风向相反）：速度 × (1 - wind.speed × 0.3)
   * 侧风：影响较小
   */
  private getWindSpeedMultiplier(shipRotation: number): number {
    const wind = this.state.wind;
    if (wind.speed <= 0) return 1.0;

    // 计算船朝向与风向的角度差
    const angleDiff = Math.abs(this.getAngleDifference(shipRotation, wind.direction));
    // angleDiff = 0 表示顺风，angleDiff = 180 表示逆风

    // 使用余弦函数平滑过渡
    // 顺风加成：+30%，逆风减速：-30%
    const maxBonus = 0.3 * wind.speed;
    const multiplier = 1 + maxBonus * Math.cos((angleDiff * Math.PI) / 180);

    return Math.max(0.2, Math.min(2.0, multiplier));
  }

  // ============================================================
  // 私有方法 — 冷却和清理
  // ============================================================

  /**
   * 递减所有船只的火炮冷却
   */
  private tickCannonCooldowns(dt: number): void {
    for (const ship of this.state.ships) {
      if (ship.cannonCooldownLeft > 0) {
        ship.cannonCooldownLeft = Math.max(0, ship.cannonCooldownLeft - dt);
      }
    }
  }

  /**
   * 递减撞击冷却
   */
  private tickRamCooldowns(dt: number): void {
    for (const [key, remaining] of this.ramCooldowns) {
      const newRemaining = remaining - dt;
      if (newRemaining <= 0) {
        this.ramCooldowns.delete(key);
      } else {
        this.ramCooldowns.set(key, newRemaining);
      }
    }
  }

  /**
   * 限制所有船只位置在地图边界内
   */
  private clampAllToMap(): void {
    for (const ship of this.state.ships) {
      ship.position.x = Math.max(0, Math.min(this.config.mapWidth, ship.position.x));
      ship.position.y = Math.max(0, Math.min(this.config.mapHeight, ship.position.y));
    }
  }

  /**
   * 同步沉没状态到 BattleModeContext
   */
  private syncDeathToContext(ctx: BattleModeContext): void {
    for (const ship of this.state.ships) {
      if (!ship.isAlive) {
        const ctxUnit = ctx.getUnit(ship.instanceId);
        if (ctxUnit && ctxUnit.isAlive) {
          // 通过 dealDamage 同步死亡
          ctx.dealDamage(ship.instanceId, ship.instanceId, ctxUnit.stats.hp + 9999);
        }
      }
    }
  }

  /**
   * 停止已沉没船只
   */
  private stopDeadShips(): void {
    for (const ship of this.state.ships) {
      if (!ship.isAlive) {
        ship.currentSpeed = 0;
      }
    }
  }

  // ============================================================
  // 私有方法 — 辅助
  // ============================================================

  /**
   * 计算两点之间的距离
   */
  private getDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * 计算从 a 到 b 的角度（度，0=东，顺时针增加）
   */
  private getAngleTo(a: { x: number; y: number }, b: { x: number; y: number }): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    return this.normalizeAngle(angle);
  }

  /**
   * 计算两个角度之间的最小差值（带符号）
   *
   * 正值表示需要顺时针旋转，负值表示需要逆时针旋转。
   */
  private getAngleDifference(from: number, to: number): number {
    let diff = to - from;
    while (diff > 180) diff -= ANGLE_FULL;
    while (diff < -180) diff += ANGLE_FULL;
    return diff;
  }

  /**
   * 标准化角度到 [0, 360) 范围
   */
  private normalizeAngle(angle: number): number {
    angle = angle % ANGLE_FULL;
    if (angle < 0) angle += ANGLE_FULL;
    return angle;
  }

  /**
   * 平滑过渡速度
   */
  private lerpSpeed(current: number, target: number, dt: number): number {
    const acceleration = 40; // 加速度（像素/秒²）
    const dtSec = dt / 1000;

    if (current < target) {
      return Math.min(target, current + acceleration * dtSec);
    } else {
      return Math.max(target, current - acceleration * dtSec);
    }
  }

  /**
   * 寻找最近的敌方船只
   */
  private findNearestShip(ship: ShipUnit, enemies: ShipUnit[]): ShipUnit | null {
    if (enemies.length === 0) return null;

    let nearest = enemies[0];
    let nearestDist = this.getDistance(ship.position, nearest.position);

    for (let i = 1; i < enemies.length; i++) {
      const dist = this.getDistance(ship.position, enemies[i].position);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = enemies[i];
      }
    }

    return nearest;
  }

  /**
   * 生成撞击对 ID（保证顺序一致）
   */
  private getRamPairKey(idA: string, idB: string): string {
    return idA < idB ? `${idA}_${idB}` : `${idB}_${idA}`;
  }

  /**
   * 反序列化船只
   */
  private deserializeShip(s: Record<string, unknown>): ShipUnit {
    return {
      defId: typeof s.defId === 'string' ? s.defId : '',
      instanceId: typeof s.instanceId === 'string' ? s.instanceId : '',
      side: s.side === 'attacker' || s.side === 'defender' ? s.side : 'attacker',
      name: typeof s.name === 'string' ? s.name : '',
      currentHp: typeof s.currentHp === 'number' ? Math.max(0, s.currentHp) : 0,
      maxHp: typeof s.maxHp === 'number' ? Math.max(1, s.maxHp) : 1,
      position: typeof s.position === 'object' && s.position !== null
        ? {
          x: typeof (s.position as Record<string, unknown>).x === 'number'
            ? ((s.position as Record<string, unknown>).x as number) : 0,
          y: typeof (s.position as Record<string, unknown>).y === 'number'
            ? ((s.position as Record<string, unknown>).y as number) : 0,
        }
        : { x: 0, y: 0 },
      rotation: typeof s.rotation === 'number' ? this.normalizeAngle(s.rotation) : 0,
      currentSpeed: typeof s.currentSpeed === 'number' ? Math.max(0, s.currentSpeed) : 0,
      cannonCooldownLeft: typeof s.cannonCooldownLeft === 'number' ? Math.max(0, s.cannonCooldownLeft) : 0,
      isAlive: typeof s.isAlive === 'boolean' ? s.isAlive : true,
    };
  }
}
