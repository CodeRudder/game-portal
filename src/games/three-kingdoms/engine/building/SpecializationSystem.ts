/**
 * 建筑域 — 建筑特化系统
 *
 * 职责：管理建筑达到Lv10后的特化选择（每建筑2个方向）
 * 独立系统，通过 serialize/deserialize 持久化选择
 *
 * @module engine/building/SpecializationSystem
 */

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 特化选项 */
export interface SpecializationOption {
  /** 特化方向ID */
  id: string;
  /** 中文标签 */
  label: string;
  /** 加成效果 */
  bonus: Record<string, number | boolean>;
}

/** 特化系统序列化数据 */
export interface SpecializationSaveData {
  /** 版本号 */
  version: number;
  /** 各建筑的特化选择 { buildingType: specId } */
  choices: Record<string, string>;
}

/** 特化选择结果 */
export interface ChooseResult {
  /** 是否成功 */
  success: boolean;
  /** 失败原因 */
  reason?: string;
}

// ─────────────────────────────────────────────
// 常量：7建筑×2方向=14种特化
// ─────────────────────────────────────────────

/** 特化解锁等级 */
const SPECIALIZATION_MIN_LEVEL = 10;

/** 所有建筑的特化选项 */
export const SPECIALIZATIONS: Record<string, SpecializationOption[]> = {
  farmland: [
    { id: 'quantity', label: '丰产', bonus: { productionMultiplier: 0.15 } },
    { id: 'quality', label: '精耕', bonus: { productionMultiplier: 0.10, unlockEliteResource: true } },
  ],
  market: [
    { id: 'volume', label: '大批', bonus: { tradeCapacity: 0.20 } },
    { id: 'luxury', label: '奢侈品', bonus: { rareItemChance: 0.15 } },
  ],
  barracks: [
    { id: 'assault', label: '猛攻', bonus: { troopAttack: 0.15 } },
    { id: 'defense', label: '铁壁', bonus: { troopDefense: 0.15 } },
  ],
  mine: [
    { id: 'efficiency', label: '高效', bonus: { productionMultiplier: 0.15 } },
    { id: 'deep', label: '深掘', bonus: { rareOreChance: 0.10 } },
  ],
  academy: [
    { id: 'research', label: '钻研', bonus: { researchSpeed: 0.20 } },
    { id: 'wisdom', label: '博学', bonus: { techPointBonus: 0.15 } },
  ],
  clinic: [
    { id: 'speed', label: '速愈', bonus: { healSpeed: 0.20 } },
    { id: 'prevention', label: '防疫', bonus: { casualtyReduction: 0.10 } },
  ],
  workshop: [
    { id: 'forge', label: '锻造', bonus: { forgeEfficiency: 0.15 } },
    { id: 'enchant', label: '附魔', bonus: { enchantSuccess: 0.10 } },
  ],
};

/** 可特化的建筑类型列表 */
export const SPECIALIZABLE_BUILDINGS = Object.keys(SPECIALIZATIONS);

// ─────────────────────────────────────────────
// 特化系统类
// ─────────────────────────────────────────────

/**
 * 建筑特化系统
 *
 * 当建筑达到Lv10后，可选择一个特化方向，获得对应加成。
 * 每个建筑只能选择一个方向，重置需要道具。
 */
export class SpecializationSystem {
  /** 建筑等级回调（用于判断是否可特化） */
  private getBuildingLevel: ((type: string) => number) | null = null;
  /** 各建筑的特化选择 { buildingType: specId } */
  private choices: Map<string, string> = new Map();

  // ─────────────────────────────────────────
  // 初始化
  // ─────────────────────────────────────────

  /**
   * 初始化特化系统
   * @param getBuildingLevel 获取建筑等级的回调函数（可选）
   */
  init(getBuildingLevel?: (type: string) => number): void {
    this.getBuildingLevel = getBuildingLevel ?? null;
    this.choices = new Map();
  }

  // ─────────────────────────────────────────
  // 查询
  // ─────────────────────────────────────────

  /**
   * 判断建筑是否可以特化
   * 条件：建筑达到Lv10且尚未选择特化
   * @param buildingType 建筑类型
   */
  canSpecialize(buildingType: string): boolean {
    // 必须是可特化的建筑
    if (!SPECIALIZATIONS[buildingType]) return false;
    // 已经特化过的不能再选
    if (this.choices.has(buildingType)) return false;
    // 等级检查
    if (!this.getBuildingLevel) return false;
    return this.getBuildingLevel(buildingType) >= SPECIALIZATION_MIN_LEVEL;
  }

  /**
   * 获取建筑的特化选项列表
   * @param buildingType 建筑类型
   * @returns 特化选项数组，如果建筑不支持特化则返回空数组
   */
  getSpecializationOptions(buildingType: string): SpecializationOption[] {
    return SPECIALIZATIONS[buildingType] ?? [];
  }

  /**
   * 获取建筑当前选择的特化
   * @param buildingType 建筑类型
   * @returns 特化选项，未选择则返回 null
   */
  getSpecialization(buildingType: string): SpecializationOption | null {
    const specId = this.choices.get(buildingType);
    if (!specId) return null;
    const options = SPECIALIZATIONS[buildingType];
    if (!options) return null;
    return options.find(opt => opt.id === specId) ?? null;
  }

  /**
   * 获取建筑的特化加成
   * @param buildingType 建筑类型
   * @returns 加成字典，未特化则返回空对象
   */
  getSpecializationBonus(buildingType: string): Record<string, number | boolean> {
    const spec = this.getSpecialization(buildingType);
    if (!spec) return {};
    return { ...spec.bonus };
  }

  // ─────────────────────────────────────────
  // 操作
  // ─────────────────────────────────────────

  /**
   * 选择特化方向
   * @param buildingType 建筑类型
   * @param specId 特化方向ID
   * @returns 选择结果
   */
  chooseSpecialization(buildingType: string, specId: string): ChooseResult {
    // 检查建筑是否可特化
    if (!SPECIALIZATIONS[buildingType]) {
      return { success: false, reason: '该建筑不支持特化' };
    }

    // 检查是否已经特化
    if (this.choices.has(buildingType)) {
      return { success: false, reason: '该建筑已选择特化方向' };
    }

    // 检查特化ID是否有效
    const options = SPECIALIZATIONS[buildingType];
    const target = options.find(opt => opt.id === specId);
    if (!target) {
      return { success: false, reason: '无效的特化方向' };
    }

    // 检查等级（如果有回调）
    if (this.getBuildingLevel) {
      const level = this.getBuildingLevel(buildingType);
      if (level < SPECIALIZATION_MIN_LEVEL) {
        return { success: false, reason: `建筑等级不足，需要Lv${SPECIALIZATION_MIN_LEVEL}` };
      }
    }

    // 执行选择
    this.choices.set(buildingType, specId);
    return { success: true };
  }

  /**
   * 重置建筑的特化选择
   * @param buildingType 建筑类型
   * @param hasResetItem 是否拥有重置道具
   * @returns 是否重置成功
   */
  resetSpecialization(buildingType: string, hasResetItem: boolean): boolean {
    if (!hasResetItem) return false;
    if (!this.choices.has(buildingType)) return false;
    this.choices.delete(buildingType);
    return true;
  }

  // ─────────────────────────────────────────
  // 序列化 / 反序列化
  // ─────────────────────────────────────────

  /**
   * 序列化为可存储的数据
   */
  serialize(): SpecializationSaveData {
    const choicesObj: Record<string, string> = {};
    this.choices.forEach((specId, buildingType) => {
      choicesObj[buildingType] = specId;
    });
    return {
      version: 1,
      choices: choicesObj,
    };
  }

  /**
   * 从序列化数据恢复
   * @param data 序列化数据
   */
  deserialize(data: SpecializationSaveData): void {
    this.choices = new Map();
    if (data.choices) {
      for (const [buildingType, specId] of Object.entries(data.choices)) {
        this.choices.set(buildingType, specId);
      }
    }
  }

  /**
   * 重置为初始状态
   */
  reset(): void {
    this.getBuildingLevel = null;
    this.choices = new Map();
  }
}
