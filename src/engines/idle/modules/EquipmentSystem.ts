/**
 * EquipmentSystem — 放置游戏装备系统核心模块
 *
 * 提供装备定义注册、穿戴/卸下、强化、套装加成计算、
 * 背包管理、丢弃等完整功能。
 * 使用泛型 `EquipmentSystem<Def>` 允许游戏自定义扩展 EquipDef。
 *
 * 设计原则：
 * - 零外部依赖，纯 TypeScript 实现
 * - 泛型设计，支持游戏自定义装备定义
 * - 事件驱动，支持 UI 层监听装备事件
 * - 完整的存档/读档支持
 *
 * @module engines/idle/modules/EquipmentSystem
 */

// ============================================================
// 类型定义
// ============================================================

/** 装备槽位类型 */
export type EquipSlot =
  | 'weapon'
  | 'helmet'
  | 'armor'
  | 'boots'
  | 'ring'
  | 'amulet'
  | 'accessory1'
  | 'accessory2';

/** 装备定义（基础接口） */
export interface EquipDef {
  /** 装备唯一标识 */
  id: string;
  /** 显示名称 */
  name: string;
  /** 稀有度 */
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  /** 装备槽位 */
  slot: EquipSlot;
  /** 基础属性加成：属性名 → 加成值 */
  bonus: Record<string, number>;
  /** 特效标识列表 */
  effects: string[];
  /** 需求等级 */
  levelRequired: number;
  /** 套装 ID（可选） */
  setId?: string;
  /** 装备描述 */
  description: string;
  /** 图标标识 */
  icon: string;
}

/** 装备实例 */
export interface EquipInstance {
  /** 实例唯一标识 */
  instanceId: string;
  /** 关联的装备定义 ID */
  defId: string;
  /** 强化等级 */
  enhanceLevel: number;
  /** 额外加成（强化/附魔等附加属性） */
  extraBonus: Record<string, number>;
}

/** 装备系统状态 */
export interface EquipState {
  /** 已装备映射：槽位 → 实例 ID */
  equipped: Partial<Record<EquipSlot, string>>;
  /** 背包中的装备实例列表 */
  inventory: EquipInstance[];
  /** 激活的套装及其件数 */
  activeSets: Record<string, number>;
}

/** 装备事件 */
export interface EquipEvent {
  type:
    | 'equipped'
    | 'unequipped'
    | 'enhanced'
    | 'set_bonus_activated'
    | 'obtained'
    | 'discarded';
  data?: Record<string, unknown>;
}

// ============================================================
// 常量
// ============================================================

/** 强化等级每级提供的属性加成倍率 */
const ENHANCE_BONUS_PER_LEVEL = 0.1;

/** 套装激活所需的最小件数阈值 */
const SET_MINIMUM_PIECES = 2;

/** 实例 ID 前缀 */
const INSTANCE_ID_PREFIX = 'eq_';

// ============================================================
// EquipmentSystem 实现
// ============================================================

/**
 * 装备系统 — 管理装备穿戴、卸下、强化、套装加成、背包
 *
 * 核心数据模型：
 * - 所有装备实例存储在 `allInstances` Map 中（instanceId → EquipInstance）
 * - `equipped` 映射记录槽位 → instanceId
 * - `inventoryIds` 数组记录背包中的 instanceId 列表
 * - 穿戴时从 inventoryIds 移除，记录到 equipped
 * - 卸下时从 equipped 移除，加回 inventoryIds
 *
 * @typeParam Def - 装备定义类型，必须继承 EquipDef
 *
 * @example
 * ```typescript
 * const system = new EquipmentSystem([
 *   {
 *     id: 'flame-sword',
 *     name: '烈焰之剑',
 *     rarity: 'epic',
 *     slot: 'weapon',
 *     bonus: { attack: 50, critRate: 5 },
 *     effects: ['burn'],
 *     levelRequired: 10,
 *     setId: 'flame',
 *     description: '燃烧一切的利剑',
 *     icon: 'sword_fire',
 *   },
 * ]);
 *
 * const instance = system.addToInventory('flame-sword');
 * system.equip(instance.instanceId);
 * console.log(system.getBonus()); // { attack: 50, critRate: 5 }
 * ```
 */
export class EquipmentSystem<Def extends EquipDef = EquipDef> {
  // ========== 内部数据 ==========

  /** 装备定义注册表：defId → Def */
  private readonly defs: Map<string, Def> = new Map();

  /**
   * 所有装备实例的统一存储：instanceId → EquipInstance
   *
   * 无论是背包中还是已穿戴的装备，实例数据都存在此 Map 中。
   * `equipped` 和 `inventoryIds` 仅记录 instanceId 的引用关系。
   */
  private readonly allInstances: Map<string, EquipInstance> = new Map();

  /** 已装备映射：槽位 → 实例 ID */
  private equipped: Partial<Record<EquipSlot, string>> = {};

  /** 背包中的实例 ID 列表（有序） */
  private inventoryIds: string[] = [];

  /** 激活的套装及其件数 */
  private activeSets: Record<string, number> = {};

  /** 实例 ID 计数器（用于生成唯一 ID） */
  private instanceCounter: number = 0;

  /** 事件回调列表（简单数组代替外部 EventBus） */
  private readonly listeners: Array<(event: EquipEvent) => void> = [];

  // ========== 构造函数 ==========

  /**
   * 创建装备系统实例
   *
   * @param defs - 装备定义数组
   */
  constructor(defs: Def[]) {
    for (const def of defs) {
      this.defs.set(def.id, def);
    }
  }

  // ========== 核心方法 ==========

  /**
   * 穿戴装备到对应槽位
   *
   * 如果目标槽位已有装备，自动卸下旧装备放回背包。
   * 穿戴后自动重新计算套装加成。
   *
   * @param instanceId - 装备实例 ID
   * @returns 是否穿戴成功（实例不存在或不在背包中则失败）
   */
  equip(instanceId: string): boolean {
    // 检查实例是否在背包中
    const invIndex = this.inventoryIds.indexOf(instanceId);
    if (invIndex === -1) {
      return false;
    }

    const instance = this.allInstances.get(instanceId);
    if (!instance) {
      return false;
    }

    const def = this.defs.get(instance.defId);
    if (!def) {
      return false;
    }

    const slot = def.slot;

    // 如果目标槽位已有装备，先卸下旧装备放回背包
    const currentEquippedId = this.equipped[slot];
    if (currentEquippedId) {
      // 旧装备从 equipped 移除，加入背包
      this.inventoryIds.push(currentEquippedId);
      delete this.equipped[slot];
    }

    // 从背包移除该实例 ID
    this.inventoryIds.splice(invIndex, 1);

    // 穿戴到槽位
    this.equipped[slot] = instanceId;

    // 重新计算套装加成
    this.recalculateSets();

    // 发送事件
    this.emit({
      type: 'equipped',
      data: {
        instanceId,
        defId: def.id,
        slot,
        name: def.name,
      },
    });

    return true;
  }

  /**
   * 卸下指定槽位的装备
   *
   * 卸下后装备放回背包，并重新计算套装加成。
   *
   * @param slot - 要卸下的装备槽位
   * @returns 被卸下的装备实例，槽位为空则返回 null
   */
  unequip(slot: EquipSlot): EquipInstance | null {
    const instanceId = this.equipped[slot];
    if (!instanceId) {
      return null;
    }

    const instance = this.allInstances.get(instanceId);
    if (!instance) {
      delete this.equipped[slot];
      return null;
    }

    // 从 equipped 映射移除
    delete this.equipped[slot];

    // 放回背包
    this.inventoryIds.push(instanceId);

    // 重新计算套装加成
    this.recalculateSets();

    const def = this.defs.get(instance.defId);

    // 发送事件
    this.emit({
      type: 'unequipped',
      data: {
        instanceId,
        defId: instance.defId,
        slot,
        name: def?.name ?? '',
      },
    });

    return instance;
  }

  /**
   * 获取所有已装备装备的总加成
   *
   * 汇总所有已装备装备的基础加成、强化加成和额外加成。
   * 强化加成 = 基础加成 × enhanceLevel × ENHANCE_BONUS_PER_LEVEL
   *
   * @returns 属性名 → 总加成值的映射
   */
  getBonus(): Record<string, number> {
    const total: Record<string, number> = {};

    // 遍历所有已装备槽位
    const slots = Object.keys(this.equipped) as EquipSlot[];
    for (const slot of slots) {
      const instanceId = this.equipped[slot];
      if (!instanceId) continue;

      const instance = this.allInstances.get(instanceId);
      if (!instance) continue;

      const def = this.defs.get(instance.defId);
      if (!def) continue;

      // 累加基础加成
      for (const [key, value] of Object.entries(def.bonus)) {
        total[key] = (total[key] ?? 0) + value;
      }

      // 累加强化加成：基础加成 × 强化等级 × 每级倍率
      if (instance.enhanceLevel > 0) {
        for (const [key, value] of Object.entries(def.bonus)) {
          total[key] =
            (total[key] ?? 0) +
            value * instance.enhanceLevel * ENHANCE_BONUS_PER_LEVEL;
        }
      }

      // 累加额外加成
      for (const [key, value] of Object.entries(instance.extraBonus)) {
        total[key] = (total[key] ?? 0) + value;
      }
    }

    return total;
  }

  /**
   * 强化装备
   *
   * 消耗指定资源来提升装备的强化等级。
   * 强化等级每提升 1 级，基础加成额外增加 10%。
   *
   * @param instanceId - 要强化的装备实例 ID
   * @param cost - 消耗的资源：资源名 → 可用数量（值 > 0 表示充足）
   * @returns 是否强化成功（实例不存在或资源不足则失败）
   */
  enhance(
    instanceId: string,
    cost: Record<string, number>,
  ): boolean {
    const instance = this.allInstances.get(instanceId);
    if (!instance) {
      return false;
    }

    // 检查资源是否充足：cost 的每个值必须 > 0
    for (const [, available] of Object.entries(cost)) {
      if (available <= 0) {
        return false;
      }
    }

    // 提升强化等级
    instance.enhanceLevel += 1;

    const def = this.defs.get(instance.defId);

    // 发送事件
    this.emit({
      type: 'enhanced',
      data: {
        instanceId,
        defId: instance.defId,
        newLevel: instance.enhanceLevel,
        name: def?.name ?? '',
      },
    });

    return true;
  }

  /**
   * 添加装备到背包
   *
   * 根据装备定义创建一个新的装备实例并加入背包。
   *
   * @param defId - 装备定义 ID
   * @param extraBonus - 额外加成（可选）
   * @returns 新创建的装备实例
   * @throws 装备定义不存在时抛出错误
   */
  addToInventory(
    defId: string,
    extraBonus?: Record<string, number>,
  ): EquipInstance {
    const def = this.defs.get(defId);
    if (!def) {
      throw new Error(`Equipment definition not found: ${defId}`);
    }

    const instance: EquipInstance = {
      instanceId: this.generateInstanceId(),
      defId,
      enhanceLevel: 0,
      extraBonus: extraBonus ? { ...extraBonus } : {},
    };

    // 存入统一实例存储
    this.allInstances.set(instance.instanceId, instance);
    // 加入背包 ID 列表
    this.inventoryIds.push(instance.instanceId);

    // 发送事件
    this.emit({
      type: 'obtained',
      data: {
        instanceId: instance.instanceId,
        defId,
        name: def.name,
        rarity: def.rarity,
      },
    });

    return instance;
  }

  /**
   * 丢弃背包中的装备
   *
   * 已穿戴的装备不能丢弃，需先卸下。
   *
   * @param instanceId - 要丢弃的装备实例 ID
   * @returns 是否丢弃成功（实例不存在或已穿戴则失败）
   */
  discard(instanceId: string): boolean {
    // 检查是否已穿戴
    const slots = Object.keys(this.equipped) as EquipSlot[];
    for (const slot of slots) {
      if (this.equipped[slot] === instanceId) {
        return false; // 已穿戴的装备不能丢弃
      }
    }

    // 在背包中查找
    const invIndex = this.inventoryIds.indexOf(instanceId);
    if (invIndex === -1) {
      return false;
    }

    const instance = this.allInstances.get(instanceId);
    const def = instance ? this.defs.get(instance.defId) : undefined;

    // 从背包移除
    this.inventoryIds.splice(invIndex, 1);
    // 从统一存储移除
    this.allInstances.delete(instanceId);

    // 发送事件
    this.emit({
      type: 'discarded',
      data: {
        instanceId,
        defId: instance?.defId ?? '',
        name: def?.name ?? '',
      },
    });

    return true;
  }

  /**
   * 获取背包中所有装备实例（只读）
   *
   * @returns 装备实例数组的只读副本
   */
  getInventory(): readonly EquipInstance[] {
    const result: EquipInstance[] = [];
    for (const id of this.inventoryIds) {
      const instance = this.allInstances.get(id);
      if (instance) {
        result.push(instance);
      }
    }
    return result;
  }

  /**
   * 获取当前已装备映射（只读）
   *
   * @returns 槽位 → 实例 ID 的映射副本
   */
  getEquipped(): Partial<Record<EquipSlot, string>> {
    return { ...this.equipped };
  }

  // ========== 套装系统 ==========

  /**
   * 重新计算激活的套装
   *
   * 遍历所有已装备的装备，统计同一套装的件数。
   * 件数 >= SET_MINIMUM_PIECES 时视为激活。
   *
   * 当新套装被激活时发送 set_bonus_activated 事件。
   */
  private recalculateSets(): void {
    const setCounts: Record<string, number> = {};
    const previousSets = { ...this.activeSets };

    // 统计每个套装的件数
    const slots = Object.keys(this.equipped) as EquipSlot[];
    for (const slot of slots) {
      const instanceId = this.equipped[slot];
      if (!instanceId) continue;

      const instance = this.allInstances.get(instanceId);
      if (!instance) continue;

      const def = this.defs.get(instance.defId);
      if (!def || !def.setId) continue;

      setCounts[def.setId] = (setCounts[def.setId] ?? 0) + 1;
    }

    // 更新激活套装（仅保留达到阈值的）
    this.activeSets = {};
    for (const [setId, count] of Object.entries(setCounts)) {
      if (count >= SET_MINIMUM_PIECES) {
        this.activeSets[setId] = count;

        // 检查是否是新激活的套装（之前未激活或件数不足）
        if (
          !previousSets[setId] ||
          previousSets[setId] < SET_MINIMUM_PIECES
        ) {
          this.emit({
            type: 'set_bonus_activated',
            data: {
              setId,
              pieceCount: count,
            },
          });
        }
      }
    }
  }

  // ========== 辅助方法 ==========

  /**
   * 生成唯一的装备实例 ID
   */
  private generateInstanceId(): string {
    this.instanceCounter += 1;
    return `${INSTANCE_ID_PREFIX}${this.instanceCounter}`;
  }

  /**
   * 发布事件，通知所有监听器
   *
   * @param event - 要发布的事件对象
   */
  private emit(event: EquipEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  // ========== 重置 ==========

  /**
   * 重置装备系统到初始状态
   *
   * 清空所有已装备槽位、背包、套装加成和计数器。
   * 装备定义保留不变。
   */
  reset(): void {
    this.equipped = {};
    this.inventoryIds = [];
    this.activeSets = {};
    this.allInstances.clear();
    this.instanceCounter = 0;
  }

  // ========== 序列化 / 反序列化 ==========

  /**
   * 将装备系统状态序列化为可存储的 JSON 对象
   *
   * @returns 包含完整状态的 JSON 兼容对象
   */
  serialize(): Record<string, unknown> {
    // 序列化所有实例
    const allInstancesData: Record<string, unknown> = {};
    for (const [id, inst] of this.allInstances) {
      allInstancesData[id] = {
        instanceId: inst.instanceId,
        defId: inst.defId,
        enhanceLevel: inst.enhanceLevel,
        extraBonus: { ...inst.extraBonus },
      };
    }

    return {
      equipped: { ...this.equipped },
      inventoryIds: [...this.inventoryIds],
      allInstances: allInstancesData,
      activeSets: { ...this.activeSets },
      instanceCounter: this.instanceCounter,
    };
  }

  /**
   * 从序列化数据恢复装备系统状态
   *
   * @param data - 之前 serialize() 输出的数据
   */
  deserialize(data: Record<string, unknown>): void {
    this.reset();

    // 恢复所有实例
    const allInstancesData = data.allInstances as
      | Record<string, EquipInstance>
      | undefined;
    if (allInstancesData && typeof allInstancesData === 'object') {
      for (const [id, inst] of Object.entries(allInstancesData)) {
        const instance = inst as EquipInstance;
        this.allInstances.set(id, {
          instanceId: instance.instanceId,
          defId: instance.defId,
          enhanceLevel: instance.enhanceLevel,
          extraBonus: { ...instance.extraBonus },
        });
      }
    }

    // 恢复已装备映射
    const equipped = data.equipped as
      | Partial<Record<EquipSlot, string>>
      | undefined;
    if (equipped) {
      this.equipped = { ...equipped };
    }

    // 恢复背包 ID 列表
    const inventoryIds = data.inventoryIds as string[] | undefined;
    if (Array.isArray(inventoryIds)) {
      this.inventoryIds = [...inventoryIds];
    }

    // 恢复套装加成
    const activeSets = data.activeSets as
      | Record<string, number>
      | undefined;
    if (activeSets) {
      this.activeSets = { ...activeSets };
    }

    // 恢复计数器
    const instanceCounter = data.instanceCounter as number | undefined;
    if (typeof instanceCounter === 'number') {
      this.instanceCounter = instanceCounter;
    }
  }

  // ========== 事件系统 ==========

  /**
   * 注册装备事件监听器
   *
   * @param callback - 事件回调函数
   * @returns 取消监听的函数
   *
   * @example
   * ```typescript
   * const unsubscribe = system.onEvent((event) => {
   *   console.log(event.type, event.data);
   * });
   * // 取消监听
   * unsubscribe();
   * ```
   */
  onEvent(callback: (event: EquipEvent) => void): () => void {
    this.listeners.push(callback);
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index !== -1) {
        this.listeners.splice(index, 1);
      }
    };
  }
}
