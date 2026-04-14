/**
 * CharacterLevelSystem — 放置游戏角色等级系统核心模块 (P2)
 *
 * 提供经验获取、等级提升（支持连续升级）、属性点分配、
 * 技能解锁、称号获取、存档/读档等完整功能。
 *
 * 设计原则：
 * - 零外部依赖，纯 TypeScript 实现
 * - 使用简单回调数组代替 EventBus
 * - 事件驱动，支持 UI 层监听等级事件
 * - 完整的存档/读档支持（serialize / deserialize）
 *
 * @module engines/idle/modules/CharacterLevelSystem
 */

// ============================================================
// 类型定义
// ============================================================

/** 等级表条目 — 定义每个等级的属性、技能和称号 */
export interface LevelTable {
  /** 等级编号（从 1 开始） */
  level: number;
  /** 达到此等级所需累计经验值 */
  expRequired: number;
  /** 升级时获得的属性加成 { statId: bonus } */
  statBonus: Record<string, number>;
  /** 升级时解锁的技能 ID 列表 */
  unlockSkills: string[];
  /** 当前等级称号 */
  title: string;
}

/** 角色等级状态快照 */
export interface CharacterLevelState {
  /** 当前等级 */
  level: number;
  /** 当前等级内已积累的经验值（相对于当前等级起点） */
  currentExp: number;
  /** 累计获得的总经验值 */
  totalExp: number;
  /** 可分配属性点数 */
  availablePoints: number;
  /** 手动分配的属性点 { statId: allocatedPoints } */
  allocatedStats: Record<string, number>;
  /** 已解锁的技能 ID 集合 */
  unlockedSkills: Set<string>;
}

/** 角色等级事件 */
export interface CharacterLevelEvent {
  /** 事件类型 */
  type: 'exp_gained' | 'level_up' | 'skill_unlocked' | 'stat_allocated';
  /** 附加数据 */
  data?: Record<string, unknown>;
  /** @deprecated 使用 data.level 代替。升级/技能事件关联的等级 */
  level?: number;
  /** @deprecated 使用 data.skillId 代替。技能解锁事件的技能 ID */
  skill?: string;
  /** @deprecated 使用 data.statId 代替。属性分配事件的属性 ID */
  stat?: string;
}

/** addExp 返回结果 */
export interface AddExpResult {
  /** 是否发生了升级 */
  leveledUp: boolean;
  /** 升级后的新等级 */
  newLevel: number;
  /** 本次连升的等级数 */
  levelsGained: number;
}

// ============================================================
// CharacterLevelSystem 实现
// ============================================================

/**
 * 角色等级系统 — 管理经验获取、等级提升、属性点分配与技能解锁
 *
 * 核心机制：
 * - 等级由经验值驱动，经验达到阈值自动升级
 * - 支持一次获得大量经验连续跨越多个等级
 * - 每次升级获得固定数量的可分配属性点
 * - 等级表定义了每个等级的属性加成、解锁技能和称号
 * - 属性总值为等级表基础加成 + 手动分配点数
 *
 * @example
 * ```typescript
 * const table: LevelTable[] = [
 *   { level: 1, expRequired: 0,   statBonus: { atk: 5 },  unlockSkills: [],              title: '新手' },
 *   { level: 2, expRequired: 100, statBonus: { atk: 8 },  unlockSkills: ['power_slash'], title: '学徒' },
 *   { level: 3, expRequired: 300, statBonus: { atk: 12 }, unlockSkills: ['shield'],      title: '战士' },
 * ];
 * const cls = new CharacterLevelSystem(table);
 * cls.addExp(150); // 升到 2 级，解锁 power_slash
 * cls.allocateStat('def', 2);
 * cls.getTitle(); // "学徒"
 * ```
 */
export class CharacterLevelSystem {

  // ========== 内部数据 ==========

  /** 等级表，按等级升序排列（构造时排序，运行时只读） */
  private readonly sortedTable: LevelTable[];

  /** 每次升级获得的属性点数 */
  private readonly pointsPerLevel: number;

  /** 当前角色状态 */
  private state: {
    level: number;
    currentExp: number;
    totalExp: number;
    availablePoints: number;
    allocatedStats: Record<string, number>;
    unlockedSkills: Set<string>;
  };

  /** 事件回调列表（简单数组代替 EventBus） */
  private readonly listeners: Array<(event: CharacterLevelEvent) => void> = [];

  // ============================================================
  // 构造函数
  // ============================================================

  /**
   * 创建角色等级系统实例
   *
   * @param levelTable - 等级表定义数组，至少包含 1 级
   * @param initialPoints - 每次升级获得的属性点数，默认 3
   * @throws levelTable 为空或未定义时抛出错误
   */
  constructor(levelTable: LevelTable[], initialPoints: number = 3) {
    if (!levelTable || levelTable.length === 0) {
      throw new Error('[CharacterLevelSystem] levelTable must not be empty');
    }

    // 按等级升序排列，确保查找逻辑正确
    this.sortedTable = [...levelTable].sort((a, b) => a.level - b.level);
    this.pointsPerLevel = initialPoints;

    // 从等级表第一项初始化状态
    const first = this.sortedTable[0];
    this.state = {
      level: first.level,
      currentExp: 0,
      totalExp: 0,
      availablePoints: 0,
      allocatedStats: {},
      unlockedSkills: new Set<string>(first.unlockSkills ?? []),
    };
  }

  // ============================================================
  // 核心操作：经验与升级
  // ============================================================

  /**
   * 增加经验值，可能触发连续升级
   *
   * 经验值会累加到 currentExp 和 totalExp，然后循环检查是否满足
   * 下一级的经验阈值。如果满足则自动升级，每次升级：
   * - 等级 +1
   * - 获得属性点（pointsPerLevel）
   * - 解锁该等级对应的技能
   * - 发射 level_up 事件
   *
   * @param amount - 经验值增量（必须 > 0）
   * @returns 升级结果，包含是否升级、新等级和连升级数
   */
  addExp(amount: number): AddExpResult {
    // 无效输入直接返回
    if (amount <= 0) {
      return { leveledUp: false, newLevel: this.state.level, levelsGained: 0 };
    }

    // 累加经验值
    this.state.totalExp += amount;
    this.state.currentExp += amount;

    // 发射经验获取事件
    this.emitEvent({
      type: 'exp_gained',
      data: { amount, totalExp: this.state.totalExp },
    });

    // 连续升级循环
    let levelsGained = 0;
    while (this.canLevelUp()) {
      // 等级提升
      this.state.level++;
      levelsGained++;

      // 获得属性点
      this.state.availablePoints += this.pointsPerLevel;

      // 查找当前等级定义，解锁技能并重算 currentExp
      const curDef = this.findLevelDef(this.state.level);
      if (curDef) {
        // 重算当前等级内经验
        this.state.currentExp = this.state.totalExp - curDef.expRequired;

        // 解锁该等级的技能
        for (const skillId of curDef.unlockSkills) {
          if (!this.state.unlockedSkills.has(skillId)) {
            this.state.unlockedSkills.add(skillId);
            this.emitEvent({
              type: 'skill_unlocked',
              level: this.state.level,
              skill: skillId,
              data: { skillId, level: this.state.level },
            });
          }
        }
      }

      // 发射升级事件
      this.emitEvent({
        type: 'level_up',
        level: this.state.level,
        data: { level: this.state.level, levelsGained },
      });
    }

    return {
      leveledUp: levelsGained > 0,
      newLevel: this.state.level,
      levelsGained,
    };
  }

  // ============================================================
  // 查询方法
  // ============================================================

  /**
   * 获取当前等级
   *
   * @returns 当前等级编号
   */
  getLevel(): number {
    return this.state.level;
  }

  /**
   * 获取当前等级进度（0~1）
   *
   * 计算公式：currentExp / expToNextLevel
   * 满级时返回 1。
   *
   * @returns 0 到 1 之间的进度值
   */
  getLevelProgress(): number {
    const needed = this.getExpToNextLevel();
    if (needed === 0) return 1; // 已满级
    return Math.min(this.state.currentExp / needed, 1);
  }

  /**
   * 获取升到下一级所需经验值（当前等级内的经验差值）
   *
   * 计算公式：nextLevel.expRequired - currentLevel.expRequired
   * 满级时返回 0。
   *
   * @returns 升级所需经验值
   */
  getExpToNextLevel(): number {
    const next = this.findLevelDef(this.state.level + 1);
    if (!next) return 0; // 已达最高级
    const cur = this.findLevelDef(this.state.level);
    return next.expRequired - (cur?.expRequired ?? 0);
  }

  /**
   * 获取最高等级
   *
   * @returns 等级表中定义的最高等级编号
   */
  getMaxLevel(): number {
    return this.sortedTable[this.sortedTable.length - 1].level;
  }

  /**
   * 获取当前等级称号
   *
   * @returns 称号字符串，未定义时返回空字符串
   */
  getTitle(): string {
    return this.findLevelDef(this.state.level)?.title ?? '';
  }

  /**
   * 检查指定技能是否已解锁
   *
   * @param skillId - 技能 ID
   * @returns 是否已解锁
   */
  isSkillUnlocked(skillId: string): boolean {
    return this.state.unlockedSkills.has(skillId);
  }

  /**
   * 获取总属性值（等级基础加成 + 手动分配）
   *
   * 遍历当前等级及以下所有等级的 statBonus 进行累加，
   * 再加上手动分配的属性点。
   *
   * @returns 属性映射 { statId: totalValue }
   */
  getTotalStats(): Record<string, number> {
    const total: Record<string, number> = {};

    // 累加等级表基础加成（当前等级及以下）
    for (const entry of this.sortedTable) {
      if (entry.level > this.state.level) break;
      for (const [stat, bonus] of Object.entries(entry.statBonus)) {
        total[stat] = (total[stat] ?? 0) + bonus;
      }
    }

    // 累加手动分配的属性点
    for (const [stat, pts] of Object.entries(this.state.allocatedStats)) {
      total[stat] = (total[stat] ?? 0) + pts;
    }

    return total;
  }

  // ============================================================
  // 属性点分配
  // ============================================================

  /**
   * 分配属性点
   *
   * 从 availablePoints 中扣除指定数量的点数，分配到目标属性。
   * 分配后属性不可回收（除非 reset）。
   *
   * @param statId - 目标属性 ID（不能为空字符串）
   * @param points - 分配点数（必须 > 0 且 <= availablePoints）
   * @returns 是否分配成功
   */
  allocateStat(statId: string, points: number): boolean {
    // 参数校验
    if (!statId || points <= 0 || points > this.state.availablePoints) {
      return false;
    }

    // 扣减可用点数
    this.state.availablePoints -= points;

    // 累加到目标属性
    this.state.allocatedStats[statId] =
      (this.state.allocatedStats[statId] ?? 0) + points;

    // 发射属性分配事件
    this.emitEvent({
      type: 'stat_allocated',
      stat: statId,
      data: { statId, points, total: this.state.allocatedStats[statId] },
    });

    return true;
  }

  // ============================================================
  // 状态管理
  // ============================================================

  /**
   * 获取当前状态快照（深拷贝）
   *
   * 注意：unlockedSkills 返回的是 Set 的拷贝，修改不影响内部状态。
   *
   * @returns 角色等级状态快照
   */
  getState(): CharacterLevelState {
    return {
      level: this.state.level,
      currentExp: this.state.currentExp,
      totalExp: this.state.totalExp,
      availablePoints: this.state.availablePoints,
      allocatedStats: { ...this.state.allocatedStats },
      unlockedSkills: new Set(this.state.unlockedSkills),
    };
  }

  /**
   * 序列化状态为可存储的 JSON 对象
   *
   * Set 会被转换为数组以便 JSON 序列化。
   *
   * @returns 可 JSON.stringify 的纯对象
   */
  serialize(): Record<string, unknown> {
    return {
      level: this.state.level,
      currentExp: this.state.currentExp,
      totalExp: this.state.totalExp,
      availablePoints: this.state.availablePoints,
      allocatedStats: { ...this.state.allocatedStats },
      unlockedSkills: Array.from(this.state.unlockedSkills),
    };
  }

  /**
   * 从序列化数据恢复状态
   *
   * 支持从 serialize() 的输出恢复。对每个字段进行类型校验，
   * 非法值会被替换为安全默认值。
   *
   * @param data - serialize() 输出的数据对象
   */
  deserialize(data: Record<string, unknown>): void {
    this.state = {
      level: typeof data.level === 'number' ? data.level : 1,
      currentExp: typeof data.currentExp === 'number' ? data.currentExp : 0,
      totalExp: typeof data.totalExp === 'number' ? data.totalExp : 0,
      availablePoints: typeof data.availablePoints === 'number' ? data.availablePoints : 0,
      allocatedStats: parseStringNumberMap(data.allocatedStats),
      unlockedSkills: parseStringSet(data.unlockedSkills),
    };
  }

  /**
   * 保存状态（serialize 的别名，保持向后兼容）
   *
   * @deprecated 请使用 serialize() 代替
   * @returns 可 JSON.stringify 的纯对象
   */
  saveState(): Record<string, unknown> {
    return this.serialize();
  }

  /**
   * 加载状态（deserialize 的别名，保持向后兼容）
   *
   * @deprecated 请使用 deserialize() 代替
   * @param data - 序列化数据
   */
  loadState(data: Record<string, unknown>): void {
    this.deserialize(data);
  }

  /**
   * 重置到初始状态
   *
   * 等级回到等级表第一项，经验清零，属性点清零，
   * 已分配属性清空，技能仅保留初始等级的解锁技能。
   */
  reset(): void {
    const first = this.sortedTable[0];
    this.state = {
      level: first.level,
      currentExp: 0,
      totalExp: 0,
      availablePoints: 0,
      allocatedStats: {},
      unlockedSkills: new Set<string>(first.unlockSkills ?? []),
    };
  }

  // ============================================================
  // 事件系统
  // ============================================================

  /**
   * 注册事件监听器，返回取消监听函数
   *
   * 支持的事件类型：
   * - exp_gained     — 获得经验值时触发
   * - level_up       — 等级提升时触发（event.level 为新等级）
   * - skill_unlocked — 技能解锁时触发（event.skill 为技能 ID）
   * - stat_allocated — 属性点分配时触发（event.stat 为属性 ID）
   *
   * @param callback - 事件回调函数
   * @returns 取消监听函数，调用后移除该回调
   */
  onEvent(callback: (event: CharacterLevelEvent) => void): () => void {
    this.listeners.push(callback);
    return () => {
      const idx = this.listeners.indexOf(callback);
      if (idx !== -1) {
        this.listeners.splice(idx, 1);
      }
    };
  }

  // ============================================================
  // 内部辅助方法
  // ============================================================

  /**
   * 向所有监听器派发事件
   *
   * 使用 try-catch 保护单个监听器，防止异常中断其他监听器。
   *
   * @param event - 要派发的事件对象
   */
  private emitEvent(event: CharacterLevelEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (_error) {
        // 监听器异常不应中断其他监听器或系统流程
      }
    }
  }

  /**
   * 检查是否可以升到下一级
   *
   * 条件：存在下一级定义 且 累计经验 >= 下一级所需经验
   *
   * @returns 是否可以升级
   */
  private canLevelUp(): boolean {
    const next = this.findLevelDef(this.state.level + 1);
    return next !== undefined && this.state.totalExp >= next.expRequired;
  }

  /**
   * 在等级表中查找指定等级的定义
   *
   * 线性扫描已排序的等级表，遇到大于目标等级时提前终止。
   *
   * @param level - 目标等级
   * @returns 等级定义，未找到返回 undefined
   */
  private findLevelDef(level: number): LevelTable | undefined {
    for (let i = 0; i < this.sortedTable.length; i++) {
      const entry = this.sortedTable[i];
      if (entry.level === level) return entry;
      if (entry.level > level) return undefined;
    }
    return undefined;
  }
}

// ============================================================
// 模块级工具函数
// ============================================================

/**
 * 解析 { string: number } 映射
 *
 * 安全地将 unknown 类型转换为 Record<string, number>。
 * 非法条目（值不是 number）会被静默跳过。
 *
 * @param data - 待解析的数据
 * @returns 安全的 string → number 映射
 */
function parseStringNumberMap(data: unknown): Record<string, number> {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (typeof value === 'number') {
      result[key] = value;
    }
  }
  return result;
}

/**
 * 解析 string 数组为 Set
 *
 * 安全地将 unknown 类型转换为 Set<string>。
 * 非字符串元素会被过滤掉。
 *
 * @param data - 待解析的数据
 * @returns 字符串集合
 */
function parseStringSet(data: unknown): Set<string> {
  if (!Array.isArray(data)) return new Set<string>();
  const items = data.filter((x): x is string => typeof x === 'string');
  return new Set<string>(items);
}
