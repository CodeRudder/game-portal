/**
 * SiegeSystem — 攻城战城墙/城门/士气系统
 *
 * 管理攻城战中的城墙段（城墙、城门、箭塔）、城门状态和双方士气。
 * 提供城墙伤害/修复、城门破坏/开启、士气增减和溃逃判定等功能。
 *
 * 参考设计：三国志攻城战、全面战争攻城战
 *
 * 士气规则：
 * - 城墙被破坏 → 防守方士气 -5/次
 * - 城门被破坏 → 防守方士气 -15
 * - 单位阵亡 → 己方士气 -3
 * - 击杀敌方 → 己方士气 +3
 * - 士气低于阈值（默认 20）→ 溃逃（该方所有单位防御 -30%）
 *
 * @module engines/idle/modules/battle/SiegeSystem
 */

// ============================================================
// 类型定义
// ============================================================

/** 城墙段 */
export interface WallSegment {
  /** 唯一标识 */
  id: string;
  /** 在战场上的位置 */
  position: { x: number; y: number };
  /** 最大生命值 */
  maxHp: number;
  /** 当前生命值 */
  currentHp: number;
  /** 城墙防御值（减伤比例） */
  defense: number;
  /** 是否已被摧毁 */
  isDestroyed: boolean;
  /** 城墙类型：城墙/城门/箭塔 */
  type: 'wall' | 'gate' | 'tower';
}

/** 城门状态 */
export interface GateState {
  /** 城门是否开启 */
  isOpen: boolean;
  /** 城门是否被破坏 */
  isDestroyed: boolean;
  /** 城门当前生命值 */
  currentHp: number;
  /** 城门最大生命值 */
  maxHp: number;
}

/** 士气修饰器 */
export interface MoraleModifier {
  /** 来源描述 */
  source: string;
  /** 士气变化值（正=加士气，负=减士气） */
  value: number;
  /** 持续回合数 */
  durationTurns: number;
}

/** 士气状态 */
export interface MoraleState {
  /** 攻击方士气（0-100） */
  attackerMorale: number;
  /** 防守方士气（0-100） */
  defenderMorale: number;
  /** 攻击方士气修饰器 */
  attackerModifiers: MoraleModifier[];
  /** 防守方士气修饰器 */
  defenderModifiers: MoraleModifier[];
}

/** 攻城配置 */
export interface SiegeConfig {
  /** 城墙段配置列表 */
  walls: Omit<WallSegment, 'currentHp' | 'isDestroyed'>[];
  /** 城门配置 */
  gate: { maxHp: number; defense: number };
  /** 初始士气 */
  initialMorale: { attacker: number; defender: number };
  /** 士气溃逃阈值，默认 20 */
  moraleThreshold: number;
  /** 箭塔每回合伤害，默认 15 */
  towerDamage: number;
  /** 箭塔攻击范围，默认 3 */
  towerRange: number;
}

/** 攻城事件 */
export type SiegeEvent =
  | { type: 'wall_damaged'; data: { wallId: string; damage: number; hpRemaining: number } }
  | { type: 'wall_destroyed'; data: { wallId: string; wallType: string } }
  | { type: 'gate_opened'; data: Record<string, never> }
  | { type: 'gate_destroyed'; data: Record<string, never> }
  | { type: 'morale_changed'; data: { side: 'attacker' | 'defender'; newValue: number; delta: number } }
  | { type: 'morale_rout'; data: { side: 'attacker' | 'defender' } }
  | { type: 'tower_attacked'; data: { targetId: string; damage: number } };

// ============================================================
// 战斗单位最小化接口（用于箭塔攻击计算）
// ============================================================

/** 箭塔攻击计算所需的单位信息 */
export interface SiegeUnitLike {
  /** 单位 ID */
  id: string;
  /** 单位阵营 */
  side: 'attacker' | 'defender';
  /** 是否存活 */
  isAlive: boolean;
  /** 单位位置 */
  position: { x: number; y: number };
}

// ============================================================
// SiegeSystem 实现
// ============================================================

/**
 * 攻城战系统 — 管理城墙、城门、士气
 *
 * @example
 * ```typescript
 * const siege = new SiegeSystem({
 *   walls: [
 *     { id: 'wall-n', position: { x: 5, y: 0 }, maxHp: 200, defense: 10, type: 'wall' },
 *     { id: 'tower-nw', position: { x: 0, y: 0 }, maxHp: 300, defense: 15, type: 'tower' },
 *   ],
 *   gate: { maxHp: 150, defense: 5 },
 *   initialMorale: { attacker: 80, defender: 90 },
 *   moraleThreshold: 20,
 *   towerDamage: 15,
 *   towerRange: 3,
 * });
 *
 * siege.on((event) => console.log(event));
 * siege.damageWall('wall-n', 50);
 * siege.updateMorale();
 * ```
 */
export class SiegeSystem {
  /** 城墙段列表 */
  private walls: WallSegment[] = [];
  /** 城门状态 */
  private gate: GateState;
  /** 士气状态 */
  private morale: MoraleState;
  /** 攻城配置 */
  private config: SiegeConfig;
  /** 事件监听器 */
  private readonly listeners: ((event: SiegeEvent) => void)[] = [];
  /** 是否已经触发过攻击方溃逃 */
  private attackerRouted = false;
  /** 是否已经触发过防守方溃逃 */
  private defenderRouted = false;

  /**
   * 初始化攻城系统
   *
   * @param config - 攻城配置
   */
  constructor(config: SiegeConfig) {
    this.config = config;

    // 初始化城墙段
    this.walls = config.walls.map((w) => ({
      ...w,
      currentHp: w.maxHp,
      isDestroyed: false,
    }));

    // 初始化城门
    this.gate = {
      isOpen: false,
      isDestroyed: false,
      currentHp: config.gate.maxHp,
      maxHp: config.gate.maxHp,
    };

    // 初始化士气
    this.morale = {
      attackerMorale: config.initialMorale.attacker,
      defenderMorale: config.initialMorale.defender,
      attackerModifiers: [],
      defenderModifiers: [],
    };
  }

  // ============================================================
  // 城墙操作
  // ============================================================

  /**
   * 获取所有城墙段
   *
   * @returns 城墙段数组（浅拷贝）
   */
  getWalls(): WallSegment[] {
    return this.walls.map((w) => ({ ...w }));
  }

  /**
   * 获取指定城墙段
   *
   * @param id - 城墙段 ID
   * @returns 城墙段或 undefined
   */
  getWall(id: string): WallSegment | undefined {
    const wall = this.walls.find((w) => w.id === id);
    return wall ? { ...wall } : undefined;
  }

  /**
   * 对城墙段造成伤害
   *
   * 如果城墙被摧毁，自动触发防守方士气 -5。
   *
   * @param wallId - 城墙段 ID
   * @param damage - 伤害值
   * @returns 更新后的城墙段
   * @throws Error 如果城墙段不存在
   */
  damageWall(wallId: string, damage: number): WallSegment {
    const wall = this.walls.find((w) => w.id === wallId);
    if (!wall) {
      throw new Error(`城墙段不存在: ${wallId}`);
    }

    if (wall.isDestroyed) {
      return { ...wall };
    }

    // 扣除城墙防御减伤后的实际伤害
    const actualDamage = Math.max(1, damage - wall.defense);
    wall.currentHp = Math.max(0, wall.currentHp - actualDamage);

    this.emit({
      type: 'wall_damaged',
      data: { wallId, damage: actualDamage, hpRemaining: wall.currentHp },
    });

    // 城墙被摧毁
    if (wall.currentHp <= 0) {
      wall.isDestroyed = true;
      this.emit({
        type: 'wall_destroyed',
        data: { wallId, wallType: wall.type },
      });

      // 城墙被破坏 → 防守方士气 -5
      this.modifyMorale('defender', -5, '城墙被破坏');
    }

    return { ...wall };
  }

  /**
   * 修复城墙段
   *
   * @param wallId - 城墙段 ID
   * @param amount - 修复量
   * @returns 更新后的城墙段
   * @throws Error 如果城墙段不存在
   */
  repairWall(wallId: string, amount: number): WallSegment {
    const wall = this.walls.find((w) => w.id === wallId);
    if (!wall) {
      throw new Error(`城墙段不存在: ${wallId}`);
    }

    if (wall.currentHp >= wall.maxHp) {
      return { ...wall };
    }

    wall.currentHp = Math.min(wall.maxHp, wall.currentHp + amount);

    // 如果修复后 HP > 0，取消摧毁状态
    if (wall.currentHp > 0) {
      wall.isDestroyed = false;
    }

    return { ...wall };
  }

  // ============================================================
  // 城门操作
  // ============================================================

  /**
   * 获取城门状态
   *
   * @returns 城门状态的拷贝
   */
  getGate(): GateState {
    return { ...this.gate };
  }

  /**
   * 对城门造成伤害
   *
   * 如果城门被摧毁，自动触发防守方士气 -15。
   *
   * @param damage - 伤害值
   * @returns 更新后的城门状态
   */
  damageGate(damage: number): GateState {
    if (this.gate.isDestroyed) {
      return { ...this.gate };
    }

    const actualDamage = Math.max(1, damage - this.config.gate.defense);
    this.gate.currentHp = Math.max(0, this.gate.currentHp - actualDamage);

    if (this.gate.currentHp <= 0) {
      this.gate.isDestroyed = true;
      this.gate.isOpen = true; // 城门被破坏后视为打开
      this.emit({ type: 'gate_destroyed', data: {} });

      // 城门被破坏 → 防守方士气 -15
      this.modifyMorale('defender', -15, '城门被破坏');
    }

    return { ...this.gate };
  }

  /**
   * 开启城门（仅防守方可操作）
   *
   * @returns 是否成功开启
   */
  openGate(): boolean {
    if (this.gate.isDestroyed) {
      return false; // 已被破坏，无法操作
    }
    if (this.gate.isOpen) {
      return false; // 已经打开
    }

    this.gate.isOpen = true;
    this.emit({ type: 'gate_opened', data: {} });
    return true;
  }

  // ============================================================
  // 士气操作
  // ============================================================

  /**
   * 获取当前士气状态
   *
   * @returns 士气状态的深拷贝
   */
  getMorale(): MoraleState {
    return {
      attackerMorale: this.morale.attackerMorale,
      defenderMorale: this.morale.defenderMorale,
      attackerModifiers: this.morale.attackerModifiers.map((m) => ({ ...m })),
      defenderModifiers: this.morale.defenderModifiers.map((m) => ({ ...m })),
    };
  }

  /**
   * 修改士气值
   *
   * @param side - 阵营
   * @param delta - 士气变化量（正=加士气，负=减士气）
   * @param source - 来源描述
   * @param durationTurns - 持续回合数（默认 0，即永久）
   */
  modifyMorale(
    side: 'attacker' | 'defender',
    delta: number,
    source: string,
    durationTurns: number = 0,
  ): void {
    if (side === 'attacker') {
      this.morale.attackerMorale = this.clampMorale(this.morale.attackerMorale + delta);
      this.morale.attackerModifiers.push({ source, value: delta, durationTurns });
    } else {
      this.morale.defenderMorale = this.clampMorale(this.morale.defenderMorale + delta);
      this.morale.defenderModifiers.push({ source, value: delta, durationTurns });
    }

    const newValue = side === 'attacker'
      ? this.morale.attackerMorale
      : this.morale.defenderMorale;

    this.emit({
      type: 'morale_changed',
      data: { side, newValue, delta },
    });
  }

  /**
   * 每回合更新士气
   *
   * - 递减临时修饰器的持续回合数
   * - 移除过期的临时修饰器
   * - 检查溃逃条件
   */
  updateMorale(): void {
    // 更新攻击方修饰器
    this.morale.attackerModifiers = this.morale.attackerModifiers.filter((m) => {
      if (m.durationTurns > 0) {
        m.durationTurns--;
        return m.durationTurns > 0;
      }
      return true; // 永久修饰器（durationTurns === 0）不递减
    });

    // 更新防守方修饰器
    this.morale.defenderModifiers = this.morale.defenderModifiers.filter((m) => {
      if (m.durationTurns > 0) {
        m.durationTurns--;
        return m.durationTurns > 0;
      }
      return true;
    });

    // 检查攻击方溃逃
    if (
      this.morale.attackerMorale < this.config.moraleThreshold &&
      !this.attackerRouted
    ) {
      this.attackerRouted = true;
      this.emit({ type: 'morale_rout', data: { side: 'attacker' } });
    } else if (this.morale.attackerMorale >= this.config.moraleThreshold) {
      this.attackerRouted = false;
    }

    // 检查防守方溃逃
    if (
      this.morale.defenderMorale < this.config.moraleThreshold &&
      !this.defenderRouted
    ) {
      this.defenderRouted = true;
      this.emit({ type: 'morale_rout', data: { side: 'defender' } });
    } else if (this.morale.defenderMorale >= this.config.moraleThreshold) {
      this.defenderRouted = false;
    }
  }

  /**
   * 检查指定阵营是否溃逃
   *
   * 士气低于阈值时触发溃逃，溃逃方所有单位防御 -30%。
   *
   * @param side - 阵营
   * @returns 是否溃逃
   */
  isRouted(side: 'attacker' | 'defender'): boolean {
    if (side === 'attacker') {
      return this.attackerRouted;
    }
    return this.defenderRouted;
  }

  // ============================================================
  // 箭塔攻击
  // ============================================================

  /**
   * 计算箭塔攻击
   *
   * 遍历所有未被摧毁的箭塔，对范围内（基于距离）的攻方单位发动攻击。
   *
   * @param units - 所有战斗单位
   * @returns 箭塔攻击列表
   */
  getTowerAttacks(units: SiegeUnitLike[]): { towerId: string; targetId: string; damage: number }[] {
    const attacks: { towerId: string; targetId: string; damage: number }[] = [];

    const towers = this.walls.filter((w) => w.type === 'tower' && !w.isDestroyed);
    const attackers = units.filter((u) => u.side === 'attacker' && u.isAlive);

    for (const tower of towers) {
      for (const attacker of attackers) {
        const distance = this.calculateDistance(tower.position, attacker.position);
        if (distance <= this.config.towerRange) {
          attacks.push({
            towerId: tower.id,
            targetId: attacker.id,
            damage: this.config.towerDamage,
          });
        }
      }
    }

    return attacks;
  }

  // ============================================================
  // 序列化
  // ============================================================

  /**
   * 序列化攻城系统状态
   *
   * @returns 可序列化的状态数据
   */
  getState(): Record<string, unknown> {
    return {
      walls: this.walls.map((w) => ({ ...w })),
      gate: { ...this.gate },
      morale: {
        attackerMorale: this.morale.attackerMorale,
        defenderMorale: this.morale.defenderMorale,
        attackerModifiers: this.morale.attackerModifiers.map((m) => ({ ...m })),
        defenderModifiers: this.morale.defenderModifiers.map((m) => ({ ...m })),
      },
      config: { ...this.config },
      attackerRouted: this.attackerRouted,
      defenderRouted: this.defenderRouted,
    };
  }

  /**
   * 反序列化攻城系统状态（含校验）
   *
   * @param data - 存档数据
   */
  loadState(data: Record<string, unknown>): void {
    if (!data || typeof data !== 'object') return;

    // 校验并恢复城墙
    if (Array.isArray(data.walls)) {
      this.walls = (data.walls as unknown[])
        .filter((w): w is Record<string, unknown> => typeof w === 'object' && w !== null)
        .map((w) => ({
          id: typeof w.id === 'string' ? w.id : '',
          position: this.parsePosition(w.position),
          maxHp: typeof w.maxHp === 'number' ? Math.max(1, w.maxHp) : 1,
          currentHp: typeof w.currentHp === 'number' ? Math.max(0, w.currentHp) : 0,
          defense: typeof w.defense === 'number' ? Math.max(0, w.defense) : 0,
          isDestroyed: typeof w.isDestroyed === 'boolean' ? w.isDestroyed : false,
          type: this.parseWallType(w.type),
        }));
    }

    // 校验并恢复城门
    if (typeof data.gate === 'object' && data.gate !== null) {
      const g = data.gate as Record<string, unknown>;
      this.gate = {
        isOpen: typeof g.isOpen === 'boolean' ? g.isOpen : false,
        isDestroyed: typeof g.isDestroyed === 'boolean' ? g.isDestroyed : false,
        currentHp: typeof g.currentHp === 'number' ? Math.max(0, g.currentHp) : 0,
        maxHp: typeof g.maxHp === 'number' ? Math.max(1, g.maxHp) : 1,
      };
    }

    // 校验并恢复士气
    if (typeof data.morale === 'object' && data.morale !== null) {
      const m = data.morale as Record<string, unknown>;
      this.morale = {
        attackerMorale: typeof m.attackerMorale === 'number'
          ? this.clampMorale(m.attackerMorale) : 50,
        defenderMorale: typeof m.defenderMorale === 'number'
          ? this.clampMorale(m.defenderMorale) : 50,
        attackerModifiers: this.parseModifiers(m.attackerModifiers),
        defenderModifiers: this.parseModifiers(m.defenderModifiers),
      };
    }

    // 恢复溃逃状态
    if (typeof data.attackerRouted === 'boolean') {
      this.attackerRouted = data.attackerRouted;
    }
    if (typeof data.defenderRouted === 'boolean') {
      this.defenderRouted = data.defenderRouted;
    }
  }

  /**
   * 重置攻城系统到初始状态
   */
  reset(): void {
    this.walls = this.config.walls.map((w) => ({
      ...w,
      currentHp: w.maxHp,
      isDestroyed: false,
    }));

    this.gate = {
      isOpen: false,
      isDestroyed: false,
      currentHp: this.config.gate.maxHp,
      maxHp: this.config.gate.maxHp,
    };

    this.morale = {
      attackerMorale: this.config.initialMorale.attacker,
      defenderMorale: this.config.initialMorale.defender,
      attackerModifiers: [],
      defenderModifiers: [],
    };

    this.attackerRouted = false;
    this.defenderRouted = false;
  }

  // ============================================================
  // 事件系统
  // ============================================================

  /**
   * 注册事件监听器
   *
   * @param handler - 事件处理回调
   */
  on(handler: (event: SiegeEvent) => void): void {
    this.listeners.push(handler);
  }

  /**
   * 注销事件监听器
   *
   * @param handler - 要移除的事件处理回调
   */
  off(handler: (event: SiegeEvent) => void): void {
    const idx = this.listeners.indexOf(handler);
    if (idx !== -1) {
      this.listeners.splice(idx, 1);
    }
  }

  // ============================================================
  // 私有方法
  // ============================================================

  /** 将士气值限制在 0-100 范围内 */
  private clampMorale(value: number): number {
    return Math.max(0, Math.min(100, value));
  }

  /** 计算两点之间的欧几里得距离 */
  private calculateDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /** 解析位置对象 */
  private parsePosition(value: unknown): { x: number; y: number } {
    if (typeof value === 'object' && value !== null) {
      const p = value as Record<string, unknown>;
      return {
        x: typeof p.x === 'number' ? p.x : 0,
        y: typeof p.y === 'number' ? p.y : 0,
      };
    }
    return { x: 0, y: 0 };
  }

  /** 解析城墙类型 */
  private parseWallType(value: unknown): 'wall' | 'gate' | 'tower' {
    if (value === 'wall' || value === 'gate' || value === 'tower') {
      return value;
    }
    return 'wall';
  }

  /** 解析士气修饰器数组 */
  private parseModifiers(value: unknown): MoraleModifier[] {
    if (!Array.isArray(value)) return [];
    return (value as unknown[])
      .filter((m): m is Record<string, unknown> => typeof m === 'object' && m !== null)
      .map((m) => ({
        source: typeof m.source === 'string' ? m.source : '',
        value: typeof m.value === 'number' ? m.value : 0,
        durationTurns: typeof m.durationTurns === 'number' ? Math.max(0, m.durationTurns) : 0,
      }));
  }

  /** 内部事件发射 */
  private emit(event: SiegeEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
