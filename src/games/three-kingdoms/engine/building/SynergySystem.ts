/**
 * 建筑域 — 建筑协同系统
 *
 * 职责：管理建筑间协同组合的激活检测和加成计算
 * 通过回调获取建筑等级，不直接依赖 BuildingSystem
 *
 * @module engine/building/SynergySystem
 */

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 协同组合定义 */
export interface SynergyCombo {
  /** 唯一标识 */
  id: string;
  /** 参与的建筑类型列表 */
  buildings: string[];
  /** 最低等级要求 */
  minLevel: number;
  /** 加成比例（如 0.05 = 5%） */
  bonus: number;
  /** 中文标签 */
  label: string;
}

/** 协同状态 */
export interface SynergyStatus {
  /** 协同组合ID */
  comboId: string;
  /** 是否激活 */
  active: boolean;
  /** 加成比例 */
  bonus: number;
  /** 中文标签 */
  label: string;
}

/** 协同系统序列化数据 */
export interface SynergySaveData {
  /** 版本号 */
  version: number;
  /** 当前激活的协同ID列表 */
  activeSynergies: string[];
}

/** 获取建筑等级的回调类型 */
export type GetBuildingLevel = (type: string) => number;

// ─────────────────────────────────────────────
// 常量：6组协同组合
// ─────────────────────────────────────────────

export const SYNERGY_COMBOS: readonly SynergyCombo[] = [
  { id: 'mine_workshop', buildings: ['mine', 'workshop'], minLevel: 5, bonus: 0.05, label: '矿工协作' },
  { id: 'market_port', buildings: ['market', 'port'], minLevel: 5, bonus: 0.05, label: '商路互通' },
  { id: 'tavern_barracks', buildings: ['tavern', 'barracks'], minLevel: 5, bonus: 0.05, label: '军心凝聚' },
  { id: 'academy_tavern', buildings: ['academy', 'tavern'], minLevel: 5, bonus: 0.05, label: '文武双全' },
  { id: 'farmland_port', buildings: ['farmland', 'port'], minLevel: 5, bonus: 0.05, label: '粮商互济' },
  { id: 'clinic_barracks', buildings: ['clinic', 'barracks'], minLevel: 5, bonus: 0.05, label: '军医联动' },
] as const;

// ─────────────────────────────────────────────
// 协同系统类
// ─────────────────────────────────────────────

/**
 * 建筑协同系统
 *
 * 检测建筑间协同组合是否满足激活条件（所有参与建筑达到最低等级），
 * 计算各建筑的协同加成以及总协同加成。
 */
export class SynergySystem {
  private getBuildingLevel: GetBuildingLevel | null = null;
  private activeSynergies: Set<string> = new Set();

  // ─────────────────────────────────────────
  // 初始化
  // ─────────────────────────────────────────

  /**
   * 初始化协同系统
   * @param getBuildingLevel 获取建筑等级的回调函数
   */
  init(getBuildingLevel: GetBuildingLevel): void {
    this.getBuildingLevel = getBuildingLevel;
    this.activeSynergies = new Set();
    // 初始化时立即检查所有协同
    this.checkAllSynergies();
  }

  // ─────────────────────────────────────────
  // 协同检测
  // ─────────────────────────────────────────

  /**
   * 检查所有协同组合的激活状态
   * @returns 所有协同的状态列表
   */
  checkAllSynergies(): SynergyStatus[] {
    if (!this.getBuildingLevel) {
      return SYNERGY_COMBOS.map(combo => ({
        comboId: combo.id,
        active: false,
        bonus: combo.bonus,
        label: combo.label,
      }));
    }

    const results: SynergyStatus[] = [];
    for (const combo of SYNERGY_COMBOS) {
      const active = this.isComboActive(combo);
      if (active) {
        this.activeSynergies.add(combo.id);
      } else {
        this.activeSynergies.delete(combo.id);
      }
      results.push({
        comboId: combo.id,
        active,
        bonus: combo.bonus,
        label: combo.label,
      });
    }
    return results;
  }

  /**
   * 判断某个协同组合是否激活
   * @param comboId 协同组合ID
   */
  isSynergyActive(comboId: string): boolean {
    return this.activeSynergies.has(comboId);
  }

  /**
   * 获取某建筑的协同加成
   * 遍历所有激活的协同组合，累加包含该建筑的协同加成
   * @param buildingType 建筑类型
   * @returns 加成比例（如 0.05 = 5%）
   */
  getSynergyBonus(buildingType: string): number {
    let totalBonus = 0;
    for (const combo of SYNERGY_COMBOS) {
      if (this.activeSynergies.has(combo.id) && combo.buildings.includes(buildingType)) {
        totalBonus += combo.bonus;
      }
    }
    return totalBonus;
  }

  /**
   * 获取总协同加成
   * 所有激活协同的加成之和
   */
  getTotalSynergyBonus(): number {
    let total = 0;
    for (const combo of SYNERGY_COMBOS) {
      if (this.activeSynergies.has(combo.id)) {
        total += combo.bonus;
      }
    }
    return total;
  }

  // ─────────────────────────────────────────
  // 事件响应
  // ─────────────────────────────────────────

  /**
   * 建筑等级变化时重新检查相关协同
   * @param buildingType 发生变化的建筑类型
   * @param newLevel 新等级
   * @returns 受影响的协同状态列表
   */
  onLevelChange(buildingType: string, newLevel: number): SynergyStatus[] {
    if (!this.getBuildingLevel) return [];

    // 找到包含该建筑的协同组合
    const affectedCombos = SYNERGY_COMBOS.filter(
      combo => combo.buildings.includes(buildingType)
    );

    const results: SynergyStatus[] = [];
    for (const combo of affectedCombos) {
      // 临时用新等级检查
      const originalFn = this.getBuildingLevel;
      const active = combo.buildings.every(bt => {
        const level = bt === buildingType ? newLevel : originalFn(bt);
        return level >= combo.minLevel;
      });

      if (active) {
        this.activeSynergies.add(combo.id);
      } else {
        this.activeSynergies.delete(combo.id);
      }

      results.push({
        comboId: combo.id,
        active,
        bonus: combo.bonus,
        label: combo.label,
      });
    }
    return results;
  }

  // ─────────────────────────────────────────
  // 内部方法
  // ─────────────────────────────────────────

  /**
   * 检查单个协同组合是否满足激活条件
   */
  private isComboActive(combo: SynergyCombo): boolean {
    if (!this.getBuildingLevel) return false;
    return combo.buildings.every(bt => this.getBuildingLevel!(bt) >= combo.minLevel);
  }

  // ─────────────────────────────────────────
  // 序列化 / 反序列化
  // ─────────────────────────────────────────

  /**
   * 序列化为可存储的数据
   */
  serialize(): SynergySaveData {
    return {
      version: 1,
      activeSynergies: Array.from(this.activeSynergies),
    };
  }

  /**
   * 从序列化数据恢复
   * 注意：恢复后仍需调用 init() 设置回调，然后调用 checkAllSynergies() 刷新状态
   * @param data 序列化数据
   */
  deserialize(data: SynergySaveData): void {
    this.activeSynergies = new Set(data.activeSynergies ?? []);
  }

  /**
   * 重置为初始状态
   */
  reset(): void {
    this.getBuildingLevel = null;
    this.activeSynergies = new Set();
  }
}
