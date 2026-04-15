/**
 * TacticalMode — 战棋类战斗模式
 *
 * 参考英雄无敌的战棋规则，在方格地图上移动和战斗。
 * 每回合每个单位可移动 + 攻击（先移后攻），
 * AI 自动控制所有单位的移动和攻击决策。
 *
 * 规则：
 * - 方格地图上移动单位
 * - 每回合每个单位可移动 + 攻击（先移后攻）
 * - 移动范围由单位配置的 movePower 决定
 * - 攻击范围：由单位配置的 minAttackRange / maxAttackRange 决定
 * - AI 自动移动和攻击
 * - 胜利条件：消灭所有敌方单位
 * - 失败条件：己方全灭或回合上限
 *
 * @module engines/idle/modules/battle/TacticalMode
 */

import type {
  IBattleMode,
  BattleModeContext,
  BattleResult,
  BattleStats,
  StrategyPreset,
} from './BattleMode';
import { DEFAULT_STRATEGY_PRESET } from './BattleMode';
import { BattleMap } from './BattleMap';
import type { MapDef, Point } from './BattleMap';

// ============================================================
// 类型定义
// ============================================================

/** 战棋单位配置 */
export interface TacticalUnitConfig {
  /** 单位 ID */
  unitId: string;
  /** 移动力（最大移动格数） */
  movePower: number;
  /** 最小攻击范围 */
  minAttackRange: number;
  /** 最大攻击范围 */
  maxAttackRange: number;
}

/** 战棋模式配置 */
export interface TacticalConfig {
  /** 地图宽度 */
  mapWidth?: number;
  /** 地图高度 */
  mapHeight?: number;
  /** 回合上限 */
  maxTurns?: number;
  /** 行动间隔（毫秒） */
  actionDelayMs?: number;
  /** 策略预设 */
  preset?: StrategyPreset;
  /** 单位战棋配置 */
  unitConfigs?: TacticalUnitConfig[];
  /** 初始位置（unitId → {x, y}） */
  initialPositions?: Record<string, { x: number; y: number }>;
}

/** 战棋单位运行时状态 */
interface TacticalUnit {
  /** 单位 ID */
  id: string;
  /** 单位名称 */
  name: string;
  /** 阵营 */
  side: 'attacker' | 'defender';
  /** 当前血量 */
  hp: number;
  /** 最大血量 */
  maxHp: number;
  /** 攻击力 */
  attack: number;
  /** 防御力 */
  defense: number;
  /** 速度 */
  speed: number;
  /** 暴击率 */
  critRate: number;
  /** 暴击倍率 */
  critMultiplier: number;
  /** 闪避率 */
  evasion: number;
  /** 是否存活 */
  isAlive: boolean;
  /** 地图坐标 x */
  x: number;
  /** 地图坐标 y */
  y: number;
  /** 攻击类型 */
  attackType: 'melee' | 'ranged';
  /** 本回合是否已行动 */
  hasActed: boolean;
}

/** 战棋模式内部状态 */
interface TacticalState {
  /** 行动顺序 */
  turnOrder: string[];
  /** 当前行动单位索引 */
  currentTurnIndex: number;
  /** 当前回合数 */
  turnCount: number;
  /** 回合上限 */
  maxTurns: number;
  /** 当前阶段 */
  phase: 'select_unit' | 'moving' | 'attacking' | 'finished';
  /** 当前正在行动的单位 ID */
  currentMovingUnit: string | null;
  /** 行动间隔 */
  actionDelayMs: number;
  /** 自上次行动以来的累计时间 */
  elapsedSinceLastAction: number;
  /** 累计统计 */
  stats: BattleStats;
  /** 本回合已移动的单位 */
  movedThisTurn: string[];
  /** 本回合已行动（攻击）的单位 */
  actedThisTurn: string[];
}

// ============================================================
// TacticalMode 实现
// ============================================================

/**
 * 战棋类战斗模式
 */
export class TacticalMode implements IBattleMode {
  readonly type = 'tactical';

  /** 策略预设 */
  private preset: StrategyPreset;

  /** 战斗地图（null 表示未初始化） */
  private map: BattleMap | null = null;

  /** 战棋单位映射表 */
  private units: Map<string, TacticalUnit> = new Map();

  /** 内部状态 */
  private state: TacticalState;

  /** 配置 */
  private config: TacticalConfig;

  /** 单位配置映射 */
  private unitConfigMap: Map<string, TacticalUnitConfig> = new Map();

  constructor(config?: TacticalConfig) {
    this.config = config ?? {};
    this.preset = config?.preset ?? { ...DEFAULT_STRATEGY_PRESET };

    // 构建单位配置映射
    if (config?.unitConfigs) {
      for (const uc of config.unitConfigs) {
        this.unitConfigMap.set(uc.unitId, uc);
      }
    }

    this.state = this.createInitialState(config?.maxTurns, config?.actionDelayMs);
  }

  // ============================================================
  // 生命周期
  // ============================================================

  /** 初始化模式 */
  init(ctx: BattleModeContext): void {
    this.state = this.createInitialState(
      this.config.maxTurns ?? this.state.maxTurns,
      this.config.actionDelayMs ?? this.state.actionDelayMs,
    );
    this.units.clear();

    // 创建地图
    const w = this.config.mapWidth ?? 10;
    const h = this.config.mapHeight ?? 8;
    this.map = BattleMap.createGrid(w, h);

    // 从上下文创建战棋单位
    for (const unit of ctx.units) {
      const tacticalUnit: TacticalUnit = {
        id: unit.id,
        name: unit.name,
        side: unit.side,
        hp: unit.stats.hp,
        maxHp: unit.stats.maxHp,
        attack: unit.stats.attack,
        defense: unit.stats.defense,
        speed: unit.stats.speed,
        critRate: unit.stats.critRate,
        critMultiplier: unit.stats.critMultiplier,
        evasion: unit.stats.evasion,
        isAlive: unit.isAlive,
        x: 0,
        y: 0,
        attackType: this.determineAttackType(unit.id),
        hasActed: false,
      };

      // 使用初始位置或自动分配
      if (this.config.initialPositions?.[unit.id]) {
        const pos = this.config.initialPositions[unit.id];
        tacticalUnit.x = pos.x;
        tacticalUnit.y = pos.y;
        this.map!.setUnitPosition(unit.id, pos.x, pos.y);
      } else {
        this.assignInitialPosition(tacticalUnit);
      }

      this.units.set(unit.id, tacticalUnit);
    }

    // 生成行动顺序（按速度降序）
    const alive = Array.from(this.units.values()).filter((u) => u.isAlive);
    alive.sort((a, b) => b.speed - a.speed);
    this.state.turnOrder = alive.map((u) => u.id);
    this.state.currentTurnIndex = 0;
    this.state.phase = 'select_unit';
    this.state.turnCount = 1;

    // 设置第一个行动单位
    if (this.state.turnOrder.length > 0) {
      this.state.currentMovingUnit = this.state.turnOrder[0];
      const firstUnit = this.units.get(this.state.currentMovingUnit);
      if (firstUnit) {
        ctx.emit({
          type: 'turn_started',
          data: {
            turn: this.state.turnCount,
            unitId: firstUnit.id,
            unitName: firstUnit.name,
          },
        });
      }
    }
  }

  /** 每帧更新 */
  update(ctx: BattleModeContext, dt: number): void {
    if (this.state.phase === 'finished') return;

    // 检查胜负
    if (this.checkWin(ctx) || this.checkLose(ctx)) {
      this.state.phase = 'finished';
      return;
    }

    // 累计时间
    this.state.elapsedSinceLastAction += dt * ctx.speed;

    // 未到行动间隔
    if (this.state.elapsedSinceLastAction < this.state.actionDelayMs) return;

    this.state.elapsedSinceLastAction = 0;

    // 获取当前行动单位
    const unitId = this.state.turnOrder[this.state.currentTurnIndex];
    if (!unitId) {
      this.advanceTurn(ctx);
      return;
    }

    const unit = this.units.get(unitId);
    if (!unit || !unit.isAlive) {
      this.advanceTurn(ctx);
      return;
    }

    // 执行行动：移动 + 攻击
    this.executeAction(ctx, unit);
  }

  /** 检查胜利条件 */
  checkWin(ctx: BattleModeContext): boolean {
    return ctx.getAliveUnits('defender').length === 0;
  }

  /** 检查失败条件 */
  checkLose(ctx: BattleModeContext): boolean {
    return ctx.getAliveUnits('attacker').length === 0;
  }

  /** 结算战斗结果 */
  settle(ctx: BattleModeContext, durationMs: number): BattleResult {
    const won = this.checkWin(ctx);
    const alive = Array.from(this.units.values()).filter(
      (u) => u.isAlive && u.side === (won ? 'attacker' : 'defender'),
    );
    const mvpUnit =
      alive.length > 0
        ? alive.reduce((best, u) => (u.attack > best.attack ? u : best), alive[0])
        : null;

    return {
      won,
      rewards: {},
      drops: {},
      mvp: mvpUnit?.id ?? null,
      durationMs,
      stats: { ...this.state.stats },
    };
  }

  /** 获取模式状态 */
  getState(): Record<string, unknown> {
    const unitsData: Record<string, unknown> = {};
    for (const [id, u] of this.units) {
      unitsData[id] = { ...u };
    }

    return {
      turnOrder: [...this.state.turnOrder],
      currentTurnIndex: this.state.currentTurnIndex,
      turnCount: this.state.turnCount,
      maxTurns: this.state.maxTurns,
      phase: this.state.phase,
      currentMovingUnit: this.state.currentMovingUnit,
      actionDelayMs: this.state.actionDelayMs,
      elapsedSinceLastAction: this.state.elapsedSinceLastAction,
      stats: { ...this.state.stats },
      units: unitsData,
      movedThisTurn: [...this.state.movedThisTurn],
      actedThisTurn: [...this.state.actedThisTurn],
      mapState: this.map ? this.serializeMapState() : null,
      config: { ...this.config },
    };
  }

  /** 恢复模式状态 */
  loadState(data: Record<string, unknown>): void {
    if (!data || typeof data !== 'object') return;

    this.state = {
      turnOrder: Array.isArray(data.turnOrder)
        ? data.turnOrder.filter((v): v is string => typeof v === 'string')
        : [],
      currentTurnIndex:
        typeof data.currentTurnIndex === 'number'
          ? Math.max(0, Math.floor(data.currentTurnIndex))
          : 0,
      turnCount:
        typeof data.turnCount === 'number'
          ? Math.max(1, Math.floor(data.turnCount))
          : 1,
      maxTurns:
        typeof data.maxTurns === 'number'
          ? Math.max(1, Math.floor(data.maxTurns))
          : 30,
      phase: this.parsePhase(data.phase),
      currentMovingUnit:
        typeof data.currentMovingUnit === 'string' ? data.currentMovingUnit : null,
      actionDelayMs:
        typeof data.actionDelayMs === 'number'
          ? Math.max(0, data.actionDelayMs)
          : 500,
      elapsedSinceLastAction:
        typeof data.elapsedSinceLastAction === 'number'
          ? Math.max(0, data.elapsedSinceLastAction)
          : 0,
      stats:
        typeof data.stats === 'object' && data.stats !== null
          ? this.parseStats(data.stats as Record<string, unknown>)
          : { totalDamageDealt: 0, totalDamageTaken: 0, unitsLost: 0, enemiesDefeated: 0 },
      movedThisTurn: Array.isArray(data.movedThisTurn)
        ? data.movedThisTurn.filter((v): v is string => typeof v === 'string')
        : [],
      actedThisTurn: Array.isArray(data.actedThisTurn)
        ? data.actedThisTurn.filter((v): v is string => typeof v === 'string')
        : [],
    };

    // 恢复单位
    this.units.clear();
    if (typeof data.units === 'object' && data.units !== null) {
      const unitsMap = data.units as Record<string, unknown>;
      for (const [id, uData] of Object.entries(unitsMap)) {
        if (typeof uData === 'object' && uData !== null) {
          this.units.set(id, uData as TacticalUnit);
        }
      }
    }

    // 恢复地图状态
    if (data.mapState && typeof data.mapState === 'object') {
      const w = this.config.mapWidth ?? 10;
      const h = this.config.mapHeight ?? 8;
      this.map = BattleMap.createGrid(w, h);
      this.restoreMapState(data.mapState as Record<string, unknown>);
    }

    // 恢复配置
    if (data.config && typeof data.config === 'object') {
      this.config = data.config as TacticalConfig;
    }
  }

  /** 重置模式 */
  reset(): void {
    this.state = this.createInitialState(
      this.config.maxTurns ?? this.state.maxTurns,
      this.config.actionDelayMs ?? this.state.actionDelayMs,
    );
    this.units.clear();
    this.map = null;
  }

  // ============================================================
  // 公开访问器
  // ============================================================

  /** 获取战斗地图 */
  getMap(): BattleMap | null {
    return this.map;
  }

  /** 获取行动顺序 */
  get turnOrder(): string[] {
    return [...this.state.turnOrder];
  }

  /** 获取当前回合数 */
  get turnCount(): number {
    return this.state.turnCount;
  }

  /** 获取当前阶段 */
  get phase(): string {
    return this.state.phase;
  }

  /** 获取当前行动单位 ID */
  get currentMovingUnit(): string | null {
    return this.state.currentMovingUnit;
  }

  /** 获取当前行动索引 */
  get currentTurnIndex(): number {
    return this.state.currentTurnIndex;
  }

  /** 获取本回合已移动的单位 */
  get movedThisTurn(): string[] {
    return [...this.state.movedThisTurn];
  }

  /** 获取本回合已行动的单位 */
  get actedThisTurn(): string[] {
    return [...this.state.actedThisTurn];
  }

  /** 获取单位战棋配置 */
  getUnitConfig(unitId: string): TacticalUnitConfig | undefined {
    return this.unitConfigMap.get(unitId);
  }

  /** 获取战棋单位 */
  getTacticalUnit(id: string): TacticalUnit | undefined {
    return this.units.get(id);
  }

  /** 获取所有战棋单位 */
  getAllTacticalUnits(): TacticalUnit[] {
    return Array.from(this.units.values());
  }

  // ============================================================
  // 私有方法 — 行动执行
  // ============================================================

  /**
   * 执行一个单位的完整行动（移动 + 攻击）
   */
  private executeAction(ctx: BattleModeContext, unit: TacticalUnit): void {
    const unitConfig = this.unitConfigMap.get(unit.id);
    const movePower = unitConfig?.movePower ?? Math.max(1, Math.floor(unit.speed / 10));
    const maxAttackRange = unitConfig?.maxAttackRange ?? (unit.attackType === 'ranged' ? 3 : 1);
    const minAttackRange = unitConfig?.minAttackRange ?? 1;

    // === 移动阶段 ===
    // 检查是否已在攻击范围内
    const closestEnemy = this.findClosestEnemy(unit);
    let didMove = false;

    if (closestEnemy && this.map) {
      const distToEnemy = this.map.getDistance(unit.x, unit.y, closestEnemy.x, closestEnemy.y);

      if (distToEnemy > maxAttackRange) {
        // 需要移动：向最近的敌人靠近
        const moveRange = this.map.getMovementRange(unit.x, unit.y, movePower);
        if (moveRange.length > 0) {
          const bestPos = this.findBestMovePosition(unit, moveRange, closestEnemy, maxAttackRange);
          if (bestPos) {
            this.map.removeUnit(unit.id);
            unit.x = bestPos.x;
            unit.y = bestPos.y;
            this.map.setUnitPosition(unit.id, bestPos.x, bestPos.y);
            this.state.movedThisTurn.push(unit.id);
            didMove = true;

            ctx.emit({
              type: 'action_executed',
              data: { unitId: unit.id, action: 'move', targetIds: [] },
            });
          }
        }
      }
    }

    // === 攻击阶段 ===
    if (this.map) {
      const attackCells = this.map.getAttackRange(unit.x, unit.y, maxAttackRange);
      const enemiesInRange: TacticalUnit[] = [];

      for (const pos of attackCells) {
        const dist = this.map.getDistance(unit.x, unit.y, pos.x, pos.y);
        if (dist < minAttackRange) continue;

        const occupantId = this.map.getOccupant(pos.x, pos.y);
        if (occupantId) {
          const enemy = this.units.get(occupantId);
          if (enemy && enemy.isAlive && enemy.side !== unit.side) {
            enemiesInRange.push(enemy);
          }
        }
      }

      if (enemiesInRange.length > 0) {
        const target = this.selectTarget(enemiesInRange);

        ctx.dealDamage(unit.id, target.id);

        // 同步血量
        const ctxTarget = ctx.getUnit(target.id);
        if (ctxTarget) {
          const oldHp = target.hp;
          target.hp = ctxTarget.stats.hp;
          const damageDealt = oldHp - target.hp;

          if (damageDealt > 0) {
            if (unit.side === 'attacker') {
              this.state.stats.totalDamageDealt += damageDealt;
            } else {
              this.state.stats.totalDamageTaken += damageDealt;
            }
          }

          if (ctxTarget.stats.hp <= 0 || !ctxTarget.isAlive) {
            target.isAlive = false;
            if (this.map) {
              this.map.removeUnit(target.id);
            }
            if (target.side === 'attacker') {
              this.state.stats.unitsLost++;
            } else {
              this.state.stats.enemiesDefeated++;
            }
            ctx.emit({
              type: 'unit_died',
              data: { unitId: target.id, unitName: target.name, side: target.side },
            });
          }
        }

        this.state.actedThisTurn.push(unit.id);

        ctx.emit({
          type: 'action_executed',
          data: { unitId: unit.id, action: 'tactical_attack', targetIds: [target.id] },
        });
      }
    }

    // 标记已行动，前进到下一个单位
    unit.hasActed = true;
    this.advanceTurn(ctx);
  }

  // ============================================================
  // 私有方法 — AI 辅助
  // ============================================================

  /**
   * 找到最近的敌方单位
   */
  private findClosestEnemy(unit: TacticalUnit): TacticalUnit | null {
    let closest: TacticalUnit | null = null;
    let minDist = Infinity;

    for (const [, other] of this.units) {
      if (!other.isAlive || other.side === unit.side) continue;
      if (!this.map) continue;
      const dist = this.map.getDistance(unit.x, unit.y, other.x, other.y);
      if (dist < minDist) {
        minDist = dist;
        closest = other;
      }
    }

    return closest;
  }

  /**
   * 找到最佳移动位置（靠近目标且在攻击范围内优先）
   */
  private findBestMovePosition(
    unit: TacticalUnit,
    moveRange: Point[],
    target: TacticalUnit,
    maxAttackRange: number,
  ): Point | null {
    let bestPos: Point | null = null;
    let bestScore = -Infinity;

    for (const pos of moveRange) {
      if (!this.map) continue;
      const distToTarget = this.map.getDistance(pos.x, pos.y, target.x, target.y);
      const defenseBonus = this.map.getDefenseBonus(pos.x, pos.y);

      // 优先选择能在攻击范围内的位置
      let score = -distToTarget * 10 + defenseBonus * 100;
      if (distToTarget <= maxAttackRange) {
        score += 1000; // 大幅加分：能攻击到的位置
      }

      if (score > bestScore) {
        bestScore = score;
        bestPos = pos;
      }
    }

    return bestPos;
  }

  /**
   * 按策略选择攻击目标
   */
  private selectTarget(enemies: TacticalUnit[]): TacticalUnit {
    switch (this.preset.focusTarget) {
      case 'lowest_hp':
        return enemies.reduce((min, e) => (e.hp < min.hp ? e : min), enemies[0]);
      case 'highest_attack':
        return enemies.reduce((max, e) => (e.attack > max.attack ? e : max), enemies[0]);
      case 'fastest':
        return enemies.reduce((max, e) => (e.speed > max.speed ? e : max), enemies[0]);
      default:
        return enemies[0];
    }
  }

  /**
   * 前进到下一个行动单位
   */
  private advanceTurn(ctx: BattleModeContext): void {
    this.state.currentTurnIndex++;

    // 一轮结束
    if (this.state.currentTurnIndex >= this.state.turnOrder.length) {
      this.state.currentTurnIndex = 0;
      this.state.turnCount++;
      this.state.movedThisTurn = [];
      this.state.actedThisTurn = [];

      // 重置所有单位的 hasActed
      for (const [, u] of this.units) {
        u.hasActed = false;
      }

      // 重建行动顺序（移除已死亡的单位）
      const alive = Array.from(this.units.values()).filter((u) => u.isAlive);
      alive.sort((a, b) => b.speed - a.speed);
      this.state.turnOrder = alive.map((u) => u.id);
    }

    // 跳过已死亡或已行动的单位
    let attempts = 0;
    while (attempts < this.state.turnOrder.length) {
      const nextId = this.state.turnOrder[this.state.currentTurnIndex];
      if (!nextId) break;

      const nextUnit = this.units.get(nextId);
      if (nextUnit && nextUnit.isAlive && !nextUnit.hasActed) {
        break;
      }

      this.state.currentTurnIndex++;
      if (this.state.currentTurnIndex >= this.state.turnOrder.length) {
        this.state.currentTurnIndex = 0;
        this.state.turnCount++;
        this.state.movedThisTurn = [];
        this.state.actedThisTurn = [];

        for (const [, u] of this.units) {
          u.hasActed = false;
        }
        const alive = Array.from(this.units.values()).filter((u) => u.isAlive);
        alive.sort((a, b) => b.speed - a.speed);
        this.state.turnOrder = alive.map((u) => u.id);
      }
      attempts++;
    }

    // 检查回合上限
    if (this.state.turnCount > this.state.maxTurns) {
      this.state.phase = 'finished';
      return;
    }

    // 检查胜负
    if (this.checkWin(ctx) || this.checkLose(ctx)) {
      this.state.phase = 'finished';
      return;
    }

    // 设置下一个行动单位
    const nextId = this.state.turnOrder[this.state.currentTurnIndex];
    this.state.currentMovingUnit = nextId ?? null;

    if (nextId) {
      const nextUnit = this.units.get(nextId);
      if (nextUnit) {
        ctx.emit({
          type: 'turn_started',
          data: {
            turn: this.state.turnCount,
            unitId: nextUnit.id,
            unitName: nextUnit.name,
          },
        });
      }
    }
  }

  // ============================================================
  // 私有方法 — 辅助
  // ============================================================

  /**
   * 创建初始状态
   */
  private createInitialState(maxTurns?: number, actionDelayMs?: number): TacticalState {
    return {
      turnOrder: [],
      currentTurnIndex: 0,
      turnCount: 1,
      maxTurns: maxTurns ?? 30,
      phase: 'select_unit',
      currentMovingUnit: null,
      actionDelayMs: actionDelayMs ?? 500,
      elapsedSinceLastAction: 0,
      stats: {
        totalDamageDealt: 0,
        totalDamageTaken: 0,
        unitsLost: 0,
        enemiesDefeated: 0,
      },
      movedThisTurn: [],
      actedThisTurn: [],
    };
  }

  /**
   * 判断单位的攻击类型
   */
  private determineAttackType(unitId: string): 'melee' | 'ranged' {
    const rangedKeywords = ['archer', 'mage', 'ranger', 'caster', 'sniper'];
    const lower = unitId.toLowerCase();
    return rangedKeywords.some((kw) => lower.includes(kw)) ? 'ranged' : 'melee';
  }

  /**
   * 为单位分配初始位置
   */
  private assignInitialPosition(unit: TacticalUnit): void {
    if (!this.map) return;

    const mapWidth = this.map.getWidth();
    const mapHeight = this.map.getHeight();

    if (unit.side === 'attacker') {
      const sameSideUnits = Array.from(this.units.values()).filter(
        (u) => u.side === 'attacker',
      );
      const index = sameSideUnits.length;
      unit.x = 0;
      unit.y = Math.min(index, mapHeight - 1);
    } else {
      const sameSideUnits = Array.from(this.units.values()).filter(
        (u) => u.side === 'defender',
      );
      const index = sameSideUnits.length;
      unit.x = mapWidth - 1;
      unit.y = Math.min(index, mapHeight - 1);
    }

    this.map.setUnitPosition(unit.id, unit.x, unit.y);
  }

  /**
   * 序列化地图状态
   */
  private serializeMapState(): Record<string, unknown> {
    if (!this.map) return {};
    const occupants: Record<string, string | null> = {};
    for (const cell of this.map.getAllCells()) {
      if (cell.occupantId !== null) {
        occupants[`${cell.x},${cell.y}`] = cell.occupantId;
      }
    }
    return { width: this.map.getWidth(), height: this.map.getHeight(), occupants };
  }

  /**
   * 恢复地图状态
   */
  private restoreMapState(mapState: Record<string, unknown>): void {
    if (!this.map) return;
    const occupants = mapState.occupants as Record<string, string> | undefined;
    if (occupants) {
      for (const [key, unitId] of Object.entries(occupants)) {
        const [xStr, yStr] = key.split(',');
        const x = parseInt(xStr, 10);
        const y = parseInt(yStr, 10);
        this.map.setUnitPosition(unitId, x, y);
      }
    }
  }

  /**
   * 解析阶段字符串
   */
  private parsePhase(
    value: unknown,
  ): 'select_unit' | 'moving' | 'attacking' | 'finished' {
    if (
      value === 'select_unit' ||
      value === 'moving' ||
      value === 'attacking' ||
      value === 'finished'
    ) {
      return value;
    }
    return 'select_unit';
  }

  /**
   * 解析统计对象
   */
  private parseStats(data: Record<string, unknown>): BattleStats {
    return {
      totalDamageDealt:
        typeof data.totalDamageDealt === 'number'
          ? Math.max(0, data.totalDamageDealt)
          : 0,
      totalDamageTaken:
        typeof data.totalDamageTaken === 'number'
          ? Math.max(0, data.totalDamageTaken)
          : 0,
      unitsLost:
        typeof data.unitsLost === 'number' ? Math.max(0, data.unitsLost) : 0,
      enemiesDefeated:
        typeof data.enemiesDefeated === 'number'
          ? Math.max(0, data.enemiesDefeated)
          : 0,
    };
  }
}
