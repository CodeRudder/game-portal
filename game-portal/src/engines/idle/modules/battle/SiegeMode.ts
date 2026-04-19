/**
 * SiegeMode — 攻城战战斗模式
 *
 * 基于回合制的攻城战模式，攻击方需要突破城墙/城门进入城内。
 * 内部组合 SiegeSystem 实例管理城墙、城门和士气。
 *
 * 攻城战规则：
 * - 基于回合制，所有单位按速度降序排列
 * - 攻击方需要突破城墙/城门进入城内
 * - 防守方占据城墙位置有防御加成
 * - 箭塔每回合自动攻击范围内攻方单位
 * - 城墙/城门被破坏后攻方单位可进入
 * - 胜利条件：攻方消灭所有守方 或 守方士气溃逃
 * - 失败条件：攻方全灭 或 超过回合上限
 *
 * @module engines/idle/modules/battle/SiegeMode
 */

import type {
  IBattleMode,
  BattleModeContext,
  BattleResult,
  BattleUnit,
} from './BattleMode';
import {
  SiegeSystem,
  type SiegeConfig,
  type SiegeEvent,
} from './SiegeSystem';
import { executeAction, tickCooldowns, tickBuffs } from './BattleAI';

// ============================================================
// 攻城模式状态
// ============================================================

/** 攻城模式内部状态 */
interface SiegeModeState {
  /** 行动顺序（单位 ID 数组，按速度降序） */
  turnOrder: string[];
  /** 当前行动单位在 turnOrder 中的索引 */
  currentTurnIndex: number;
  /** 当前回合数 */
  turnCount: number;
  /** 回合上限 */
  maxTurns: number;
  /** 当前阶段 */
  phase: 'waiting' | 'acting' | 'finished';
  /** 行动间隔（毫秒），用于动画延迟 */
  actionDelayMs: number;
  /** 自上次行动以来的累计时间 */
  elapsedSinceLastAction: number;
  /** 累计伤害统计 */
  stats: {
    totalDamageDealt: number;
    totalDamageTaken: number;
    unitsLost: number;
    enemiesDefeated: number;
  };
}

/** 攻城模式配置选项 */
export interface SiegeModeOptions {
  /** 回合上限，默认 40（攻城战较长） */
  maxTurns?: number;
  /** 行动延迟（毫秒），默认 500 */
  actionDelayMs?: number;
  /** 攻城系统配置 */
  siegeConfig: SiegeConfig;
}

// ============================================================
// SiegeMode 实现
// ============================================================

/**
 * 攻城战战斗模式
 *
 * @example
 * ```typescript
 * const siegeMode = new SiegeMode({
 *   maxTurns: 40,
 *   siegeConfig: {
 *     walls: [
 *       { id: 'wall-n', position: { x: 5, y: 0 }, maxHp: 200, defense: 10, type: 'wall' },
 *       { id: 'tower-nw', position: { x: 0, y: 0 }, maxHp: 300, defense: 15, type: 'tower' },
 *     ],
 *     gate: { maxHp: 150, defense: 5 },
 *     initialMorale: { attacker: 80, defender: 90 },
 *     moraleThreshold: 20,
 *     towerDamage: 15,
 *     towerRange: 3,
 *   },
 * });
 *
 * siegeMode.init(ctx);
 * // 在游戏循环中调用
 * siegeMode.update(ctx, dt);
 * ```
 */
export class SiegeMode implements IBattleMode {
  readonly type = 'siege';

  /** 攻城系统实例 */
  private siegeSystem: SiegeSystem;

  /** 内部状态 */
  private state: SiegeModeState;

  /** 攻城事件监听器（转发 SiegeSystem 事件） */
  private siegeEventHandlers: ((event: SiegeEvent) => void)[] = [];

  /** 攻城模式事件监听器 */
  private readonly modeListeners: ((event: SiegeEvent) => void)[] = [];

  constructor(options: SiegeModeOptions) {
    this.siegeSystem = new SiegeSystem(options.siegeConfig);
    this.state = this.createInitialState(options.maxTurns, options.actionDelayMs);
  }

  // ============================================================
  // 生命周期
  // ============================================================

  /** 初始化模式 — 生成行动顺序 */
  init(ctx: BattleModeContext): void {
    this.state = this.createInitialState(this.state.maxTurns, this.state.actionDelayMs);
    this.siegeSystem.reset();

    // 收集所有存活单位并按速度降序排列
    const alive = ctx.units.filter((u) => u.isAlive);
    alive.sort((a, b) => b.stats.speed - a.stats.speed);
    this.state.turnOrder = alive.map((u) => u.id);
    this.state.currentTurnIndex = 0;
    this.state.phase = 'acting';
    this.state.turnCount = 1;

    // 发射第一个回合开始事件
    if (this.state.turnOrder.length > 0) {
      const firstUnit = ctx.getUnit(this.state.turnOrder[0]);
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

  /** 每帧更新 — 处理行动延迟 */
  update(ctx: BattleModeContext, dt: number): void {
    if (this.state.phase !== 'acting') return;

    // 检查胜负
    if (this.checkWin(ctx) || this.checkLose(ctx)) {
      this.state.phase = 'finished';
      return;
    }

    // 累计时间
    this.state.elapsedSinceLastAction += dt * ctx.speed;

    // 未到行动间隔，等待
    if (this.state.elapsedSinceLastAction < this.state.actionDelayMs) return;

    this.state.elapsedSinceLastAction = 0;

    // 执行当前单位的行动
    this.executeCurrentUnitTurn(ctx);

    // 处理箭塔攻击
    this.processTowerAttacks(ctx);

    // 更新士气系统
    this.siegeSystem.updateMorale();

    // 检查士气溃逃导致的胜负
    if (this.checkWin(ctx) || this.checkLose(ctx)) {
      this.state.phase = 'finished';
      return;
    }

    // 前进到下一个单位
    this.advanceTurn(ctx);

    // 检查胜负（行动后可能已结束）
    if (this.checkWin(ctx) || this.checkLose(ctx)) {
      this.state.phase = 'finished';
      return;
    }

    // 检查回合上限
    if (this.state.turnCount > this.state.maxTurns) {
      this.state.phase = 'finished';
      return;
    }
  }

  /** 检查胜利条件 — 所有防守方死亡 或 防守方士气溃逃 */
  checkWin(ctx: BattleModeContext): boolean {
    // 所有防守方单位死亡
    if (ctx.getAliveUnits('defender').length === 0) {
      return true;
    }
    // 防守方士气溃逃
    if (this.siegeSystem.isRouted('defender')) {
      return true;
    }
    return false;
  }

  /** 检查失败条件 — 所有攻击方死亡 或 攻击方士气溃逃 */
  checkLose(ctx: BattleModeContext): boolean {
    // 所有攻击方单位死亡
    if (ctx.getAliveUnits('attacker').length === 0) {
      return true;
    }
    // 攻击方士气溃逃
    if (this.siegeSystem.isRouted('attacker')) {
      return true;
    }
    return false;
  }

  /** 结算战斗结果 */
  settle(ctx: BattleModeContext, durationMs: number): BattleResult {
    const won = this.checkWin(ctx);

    // 计算 MVP — 存活单位中攻击力最高的
    let mvp: string | null = null;
    const aliveAttackers = ctx.getAliveUnits('attacker');
    if (aliveAttackers.length > 0) {
      mvp = aliveAttackers.reduce(
        (best, u) => u.stats.attack > best.stats.attack ? u : best,
        aliveAttackers[0],
      ).id;
    }

    return {
      won,
      rewards: {},
      drops: {},
      mvp,
      durationMs,
      stats: { ...this.state.stats },
    };
  }

  /** 获取模式状态（用于存档） */
  getState(): Record<string, unknown> {
    return {
      turnOrder: [...this.state.turnOrder],
      currentTurnIndex: this.state.currentTurnIndex,
      turnCount: this.state.turnCount,
      maxTurns: this.state.maxTurns,
      phase: this.state.phase,
      actionDelayMs: this.state.actionDelayMs,
      elapsedSinceLastAction: this.state.elapsedSinceLastAction,
      stats: { ...this.state.stats },
      siegeSystem: this.siegeSystem.getState(),
    };
  }

  /** 恢复模式状态 */
  loadState(data: Record<string, unknown>): void {
    if (!data || typeof data !== 'object') return;

    this.state = {
      turnOrder: Array.isArray(data.turnOrder)
        ? data.turnOrder.filter((v): v is string => typeof v === 'string')
        : [],
      currentTurnIndex: typeof data.currentTurnIndex === 'number'
        ? Math.max(0, Math.floor(data.currentTurnIndex))
        : 0,
      turnCount: typeof data.turnCount === 'number'
        ? Math.max(1, Math.floor(data.turnCount))
        : 1,
      maxTurns: typeof data.maxTurns === 'number'
        ? Math.max(1, Math.floor(data.maxTurns))
        : 40,
      phase: this.parsePhase(data.phase),
      actionDelayMs: typeof data.actionDelayMs === 'number'
        ? Math.max(0, data.actionDelayMs)
        : 500,
      elapsedSinceLastAction: typeof data.elapsedSinceLastAction === 'number'
        ? Math.max(0, data.elapsedSinceLastAction)
        : 0,
      stats: typeof data.stats === 'object' && data.stats !== null
        ? this.parseStats(data.stats as Record<string, unknown>)
        : { totalDamageDealt: 0, totalDamageTaken: 0, unitsLost: 0, enemiesDefeated: 0 },
    };

    // 恢复攻城系统状态
    if (typeof data.siegeSystem === 'object' && data.siegeSystem !== null) {
      this.siegeSystem.loadState(data.siegeSystem as Record<string, unknown>);
    }
  }

  /** 重置模式 */
  reset(): void {
    this.state = this.createInitialState(this.state.maxTurns, this.state.actionDelayMs);
    this.siegeSystem.reset();
  }

  // ============================================================
  // 公开访问器
  // ============================================================

  /** 获取攻城系统实例 */
  getSiegeSystem(): SiegeSystem {
    return this.siegeSystem;
  }

  /** 获取当前行动顺序 */
  get turnOrder(): string[] {
    return [...this.state.turnOrder];
  }

  /** 获取当前行动索引 */
  get currentTurnIndex(): number {
    return this.state.currentTurnIndex;
  }

  /** 获取当前回合数 */
  get turnCount(): number {
    return this.state.turnCount;
  }

  /** 获取当前阶段 */
  get phase(): string {
    return this.state.phase;
  }

  // ============================================================
  // 私有方法
  // ============================================================

  /** 创建初始状态 */
  private createInitialState(maxTurns?: number, actionDelayMs?: number): SiegeModeState {
    return {
      turnOrder: [],
      currentTurnIndex: 0,
      turnCount: 1,
      maxTurns: maxTurns ?? 40,
      phase: 'waiting',
      actionDelayMs: actionDelayMs ?? 500,
      elapsedSinceLastAction: 0,
      stats: {
        totalDamageDealt: 0,
        totalDamageTaken: 0,
        unitsLost: 0,
        enemiesDefeated: 0,
      },
    };
  }

  /** 执行当前单位的行动 */
  private executeCurrentUnitTurn(ctx: BattleModeContext): void {
    const unitId = this.state.turnOrder[this.state.currentTurnIndex];
    if (!unitId) return;

    const unit = ctx.getUnit(unitId);
    if (!unit || !unit.isAlive) return;

    // 攻击方：优先攻击城墙/城门（如果有未破坏的城墙/城门）
    if (unit.side === 'attacker') {
      this.executeAttackerAction(unit, ctx);
    } else {
      // 防守方：正常 AI 决策
      this.executeDefenderAction(unit, ctx);
    }

    // 递减技能冷却
    tickCooldowns(ctx.units);

    // 递减 Buff 持续时间
    tickBuffs(ctx.units);
  }

  /** 执行攻击方行动 */
  private executeAttackerAction(unit: BattleUnit, ctx: BattleModeContext): void {
    // 检查是否有技能可用
    const availableSkills = unit.skills.filter(
      (s) => s.currentCooldown <= 0 && s.damage !== undefined,
    );

    // 优先攻击敌方单位（如果城墙/城门已经打开）
    const gate = this.siegeSystem.getGate();
    const hasBreach = gate.isDestroyed || gate.isOpen;

    // 检查是否有被破坏的城墙段
    const walls = this.siegeSystem.getWalls();
    const hasDestroyedWall = walls.some((w) => w.isDestroyed && w.type === 'wall');

    // 如果有突破口，直接攻击敌方单位
    if (hasBreach || hasDestroyedWall) {
      const enemySide: 'attacker' | 'defender' = 'defender';
      const enemies = ctx.getAliveUnits(enemySide);
      if (enemies.length > 0) {
        // 使用技能或普通攻击
        if (availableSkills.length > 0) {
          const skill = availableSkills.reduce(
            (best, s) => (s.damage ?? 0) > (best.damage ?? 0) ? s : best,
            availableSkills[0],
          );
          const target = enemies.reduce(
            (min, e) => e.stats.hp < min.stats.hp ? e : min,
            enemies[0],
          );
          ctx.dealDamage(unit.id, target.id, skill.damage);
          skill.currentCooldown = skill.cooldown;
          ctx.emit({
            type: 'skill_used',
            data: { unitId: unit.id, skillName: skill.name, targetIds: [target.id] },
          });
          return;
        }

        // 普通攻击
        const target = enemies.reduce(
          (min, e) => e.stats.hp < min.stats.hp ? e : min,
          enemies[0],
        );
        ctx.dealDamage(unit.id, target.id);
        ctx.emit({
          type: 'action_executed',
          data: { unitId: unit.id, action: 'normal_attack', targetIds: [target.id] },
        });
        return;
      }
    }

    // 否则攻击城墙或城门
    this.executeSiegeAttack(unit, ctx);
  }

  /** 执行攻城攻击（攻击城墙/城门） */
  private executeSiegeAttack(unit: BattleUnit, ctx: BattleModeContext): void {
    const gate = this.siegeSystem.getGate();

    // 优先攻击城门
    if (!gate.isDestroyed) {
      const damage = this.calculateSiegeDamage(unit);
      this.siegeSystem.damageGate(damage);
      ctx.emit({
        type: 'action_executed',
        data: { unitId: unit.id, action: 'attack_gate', targetIds: [] },
      });
      return;
    }

    // 攻击未被破坏的城墙
    const walls = this.siegeSystem.getWalls();
    const intactWalls = walls.filter((w) => !w.isDestroyed && w.type === 'wall');
    if (intactWalls.length > 0) {
      const damage = this.calculateSiegeDamage(unit);
      // 攻击第一个未破坏的城墙
      this.siegeSystem.damageWall(intactWalls[0].id, damage);
      ctx.emit({
        type: 'action_executed',
        data: { unitId: unit.id, action: 'attack_wall', targetIds: [] },
      });
      return;
    }

    // 所有城墙和城门都已破坏，攻击敌方
    const enemies = ctx.getAliveUnits('defender');
    if (enemies.length > 0) {
      const target = enemies.reduce(
        (min, e) => e.stats.hp < min.stats.hp ? e : min,
        enemies[0],
      );
      ctx.dealDamage(unit.id, target.id);
      ctx.emit({
        type: 'action_executed',
        data: { unitId: unit.id, action: 'normal_attack', targetIds: [target.id] },
      });
    }
  }

  /** 执行防守方行动 */
  private executeDefenderAction(unit: BattleUnit, ctx: BattleModeContext): void {
    // 防守方有城墙防御加成
    // 使用标准 AI 决策
    const preset = {
      focusTarget: 'lowest_hp' as const,
      skillPriority: 'strongest' as const,
      defensiveThreshold: 0.3,
    };
    executeAction(unit, ctx, preset);

    // 防守方占据城墙位置有防御加成（通过 Buff 模拟）
    // 这里不额外处理，防御加成由外部配置决定
  }

  /** 计算攻城伤害（对城墙/城门） */
  private calculateSiegeDamage(unit: BattleUnit): number {
    // 攻城伤害基于攻击力，城墙防御减伤由 SiegeSystem 处理
    return Math.max(1, unit.stats.attack);
  }

  /** 处理箭塔攻击 */
  private processTowerAttacks(ctx: BattleModeContext): void {
    // 将 BattleModeContext 的单位转换为 SiegeUnitLike 格式
    const units = ctx.units.map((u) => ({
      id: u.id,
      side: u.side,
      isAlive: u.isAlive,
      position: { x: 0, y: 0 }, // BattleMode 的单位没有 position，使用默认值
    }));

    const attacks = this.siegeSystem.getTowerAttacks(units);

    for (const attack of attacks) {
      // 对攻方单位造成箭塔伤害
      const target = ctx.getUnit(attack.targetId);
      if (target && target.isAlive) {
        // 直接扣血（箭塔伤害绕过正常伤害计算管道）
        ctx.dealDamage(attack.towerId, attack.targetId, attack.damage);
      }
    }
  }

  /** 前进到下一个行动单位 */
  private advanceTurn(ctx: BattleModeContext): void {
    this.state.currentTurnIndex++;

    // 一轮结束，回到开头
    if (this.state.currentTurnIndex >= this.state.turnOrder.length) {
      this.state.currentTurnIndex = 0;
      this.state.turnCount++;

      // 重新计算行动顺序（可能有单位死亡）
      const alive = ctx.units.filter((u) => u.isAlive);
      alive.sort((a, b) => b.stats.speed - a.stats.speed);
      this.state.turnOrder = alive.map((u) => u.id);
    }

    // 跳过已死亡的单位
    while (
      this.state.currentTurnIndex < this.state.turnOrder.length &&
      !this.isUnitAlive(ctx, this.state.turnOrder[this.state.currentTurnIndex])
    ) {
      this.state.currentTurnIndex++;
      if (this.state.currentTurnIndex >= this.state.turnOrder.length) {
        this.state.currentTurnIndex = 0;
        this.state.turnCount++;
        // 重新计算
        const alive = ctx.units.filter((u) => u.isAlive);
        alive.sort((a, b) => b.stats.speed - a.stats.speed);
        this.state.turnOrder = alive.map((u) => u.id);
        break;
      }
    }

    // 发射回合开始事件
    if (this.state.currentTurnIndex < this.state.turnOrder.length) {
      const nextUnit = ctx.getUnit(this.state.turnOrder[this.state.currentTurnIndex]);
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

  /** 检查单位是否存活 */
  private isUnitAlive(ctx: BattleModeContext, unitId: string): boolean {
    const unit = ctx.getUnit(unitId);
    return unit !== undefined && unit.isAlive;
  }

  /** 解析阶段字符串 */
  private parsePhase(value: unknown): 'waiting' | 'acting' | 'finished' {
    if (value === 'waiting' || value === 'acting' || value === 'finished') {
      return value;
    }
    return 'waiting';
  }

  /** 解析统计对象 */
  private parseStats(data: Record<string, unknown>): SiegeModeState['stats'] {
    return {
      totalDamageDealt: typeof data.totalDamageDealt === 'number'
        ? Math.max(0, data.totalDamageDealt) : 0,
      totalDamageTaken: typeof data.totalDamageTaken === 'number'
        ? Math.max(0, data.totalDamageTaken) : 0,
      unitsLost: typeof data.unitsLost === 'number'
        ? Math.max(0, data.unitsLost) : 0,
      enemiesDefeated: typeof data.enemiesDefeated === 'number'
        ? Math.max(0, data.enemiesDefeated) : 0,
    };
  }
}
