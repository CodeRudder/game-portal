/**
 * 装备域 — 类型定义
 *
 * 规则：只有 interface/type/enum，零逻辑
 * 涵盖：装备部位、品质等级、属性词条、装备实例、背包管理
 *
 * 功能覆盖：
 *   #1 装备部位定义（武器/防具/饰品/坐骑）
 *   #2 装备来源（关卡掉落/炼制/商店/活动/装备箱）
 *   #5 品质等级定义（白/绿/蓝/紫/金五级）
 *
 * @module core/equipment/equipment.types
 */

// ─────────────────────────────────────────────
// 1. 装备部位（#1）
// ─────────────────────────────────────────────

/** 装备部位枚举 */
export type EquipmentSlot =
  | 'weapon'    // 武器 — 主属性：攻击力
  | 'armor'     // 防具 — 主属性：防御力
  | 'accessory' // 饰品 — 主属性：智力/统帅
  | 'mount';    // 坐骑 — 主属性：速度/生命

/** 所有装备部位只读数组 */
export const EQUIPMENT_SLOTS: readonly EquipmentSlot[] = [
  'weapon',
  'armor',
  'accessory',
  'mount',
] as const;

/** 装备部位中文名映射 */
export const SLOT_LABELS: Record<EquipmentSlot, string> = {
  weapon: '武器',
  armor: '防具',
  accessory: '饰品',
  mount: '坐骑',
};

/** 装备部位图标映射 */
export const SLOT_ICONS: Record<EquipmentSlot, string> = {
  weapon: '⚔️',
  armor: '🛡️',
  accessory: '💍',
  mount: '🐴',
};

// ─────────────────────────────────────────────
// 2. 装备品质（#5）
// ─────────────────────────────────────────────

/** 装备品质等级枚举（从低到高） */
export type EquipmentRarity =
  | 'white'   // 凡品 — 白色
  | 'green'   // 良品 — 绿色
  | 'blue'    // 上品 — 蓝色
  | 'purple'  // 精品 — 紫色
  | 'gold';   // 传说 — 金色

/** 所有品质等级只读数组（从低到高） */
export const EQUIPMENT_RARITIES: readonly EquipmentRarity[] = [
  'white',
  'green',
  'blue',
  'purple',
  'gold',
] as const;

/** 品质中文名映射 */
export const RARITY_LABELS: Record<EquipmentRarity, string> = {
  white: '凡品',
  green: '良品',
  blue: '上品',
  purple: '精品',
  gold: '传说',
};

/** 品质颜色映射（统一品质颜色） */
export const RARITY_COLORS: Record<EquipmentRarity, string> = {
  white: '#9e9e9e',
  green: '#4caf50',
  blue: '#2196f3',
  purple: '#9c27b0',
  gold: '#ff9800',
};

/** 品质渐变色映射 */
export const RARITY_GRADIENTS: Record<EquipmentRarity, string> = {
  white: 'linear-gradient(135deg, #D0D0D0, #909090)',
  green: 'linear-gradient(135deg, #7FD87F, #3A9A3A)',
  blue: 'linear-gradient(135deg, #6BB0F0, #2A70B9)',
  purple: 'linear-gradient(135deg, #C07ADB, #7B39A6)',
  gold: 'linear-gradient(135deg, #F0D080, #B08820)',
};

/** 品质排序数值（用于比较大小） */
export const RARITY_ORDER: Record<EquipmentRarity, number> = {
  white: 1,
  green: 2,
  blue: 3,
  purple: 4,
  gold: 5,
};

// ─────────────────────────────────────────────
// 3. 装备来源（#2）
// ─────────────────────────────────────────────

/** 装备获取来源 */
export type EquipmentSource =
  | 'campaign_drop'  // 关卡掉落
  | 'forge'          // 炼制
  | 'shop'           // 商店购买
  | 'event'          // 活动奖励
  | 'equipment_box'; // 装备箱

/** 装备来源中文名映射 */
export const SOURCE_LABELS: Record<EquipmentSource, string> = {
  campaign_drop: '关卡掉落',
  forge: '炼制',
  shop: '商店购买',
  event: '活动奖励',
  equipment_box: '装备箱',
};

// ─────────────────────────────────────────────
// 4. 属性类型
// ─────────────────────────────────────────────

/** 主属性类型（按部位区分） */
export type MainStatType =
  | 'attack'      // 攻击力 — 武器
  | 'defense'     // 防御力 — 防具
  | 'intelligence' // 智力 — 饰品
  | 'speed';      // 速度 — 坐骑

/** 副属性类型 */
export type SubStatType =
  // 武器副属性池
  | 'critRate'       // 暴击率
  | 'critDamage'     // 暴击伤害
  | 'hitRate'        // 命中率
  // 防具副属性池
  | 'dodgeRate'      // 闪避率
  | 'antiCritRate'   // 抗暴率
  | 'hp'             // 生命值
  // 饰品副属性池
  | 'skillDamage'    // 技能伤害
  | 'cooldownReduce' // 冷却缩减
  | 'rageRecovery'   // 怒气恢复
  // 坐骑副属性池
  | 'movement'       // 移动力
  | 'initiative'     // 先攻值
  | 'morale';        // 士气

/** 特殊词条类型 */
export type SpecialEffectType =
  // 武器特殊词条池
  | 'lifeSteal'      // 吸血
  | 'armorPen'       // 破甲
  | 'comboAttack'    // 连击
  // 防具特殊词条池
  | 'damageReflect'  // 反伤
  | 'block'          // 格挡
  | 'tenacity'       // 韧性
  // 饰品特殊词条池
  | 'skillChain'     // 技能连发
  | 'rangeIncrease'  // 范围增大
  | 'controlEnhance' // 控制增强
  // 坐骑特殊词条池
  | 'pursuit'        // 追击
  | 'retreat'        // 撤退
  | 'charge';        // 冲锋加成

/** 副属性中文名映射 */
export const SUB_STAT_LABELS: Record<SubStatType, string> = {
  critRate: '暴击率',
  critDamage: '暴击伤害',
  hitRate: '命中率',
  dodgeRate: '闪避率',
  antiCritRate: '抗暴率',
  hp: '生命值',
  skillDamage: '技能伤害',
  cooldownReduce: '冷却缩减',
  rageRecovery: '怒气恢复',
  movement: '移动力',
  initiative: '先攻值',
  morale: '士气',
};

/** 特殊词条中文名映射 */
export const SPECIAL_EFFECT_LABELS: Record<SpecialEffectType, string> = {
  lifeSteal: '吸血',
  armorPen: '破甲',
  comboAttack: '连击',
  damageReflect: '反伤',
  block: '格挡',
  tenacity: '韧性',
  skillChain: '技能连发',
  rangeIncrease: '范围增大',
  controlEnhance: '控制增强',
  pursuit: '追击',
  retreat: '撤退',
  charge: '冲锋加成',
};

// ─────────────────────────────────────────────
// 5. 属性数据结构
// ─────────────────────────────────────────────

/** 主属性数据 */
export interface MainStat {
  /** 属性类型 */
  type: MainStatType;
  /** 基础值（配置表定义） */
  baseValue: number;
  /** 最终值（经过品质倍率 × 强化系数计算） */
  value: number;
}

/** 副属性数据 */
export interface SubStat {
  /** 属性类型 */
  type: SubStatType;
  /** 基础值（随机抽取范围） */
  baseValue: number;
  /** 最终值（经过品质倍率 × 强化系数计算） */
  value: number;
}

/** 特殊词条数据 */
export interface SpecialEffect {
  /** 词条类型 */
  type: SpecialEffectType;
  /** 效果数值（百分比或固定值） */
  value: number;
  /** 效果描述 */
  description: string;
}

// ─────────────────────────────────────────────
// 6. 装备实例
// ─────────────────────────────────────────────

/** 装备实例（运行时） */
export interface EquipmentInstance {
  /** 装备唯一ID */
  uid: string;
  /** 装备模板ID（对应配置表） */
  templateId: string;
  /** 装备名称 */
  name: string;
  /** 装备部位 */
  slot: EquipmentSlot;
  /** 装备品质 */
  rarity: EquipmentRarity;
  /** 强化等级 */
  enhanceLevel: number;
  /** 主属性 */
  mainStat: MainStat;
  /** 副属性列表 */
  subStats: SubStat[];
  /** 特殊词条（可选） */
  specialEffect: SpecialEffect | null;
  /** 装备来源 */
  source: EquipmentSource;
  /** 获取时间戳 */
  acquiredAt: number;
  /** 是否已穿戴 */
  isEquipped: boolean;
  /** 穿戴武将ID（null=未穿戴） */
  equippedHeroId: string | null;
  /** 随机种子（用于复现副属性） */
  seed: number;
}

// ─────────────────────────────────────────────
// 7. 背包管理（#3）
// ─────────────────────────────────────────────

/** 背包排序方式 */
export type BagSortMode =
  | 'rarity_desc'  // 品质降序（金→白）
  | 'rarity_asc'   // 品质升序（白→金）
  | 'level_desc'   // 强化等级降序
  | 'level_asc'    // 强化等级升序
  | 'slot_type'    // 按部位分组
  | 'acquired_time'; // 获取时间

/** 背包筛选条件 */
export interface BagFilter {
  /** 部位筛选（null=全部） */
  slot: EquipmentSlot | null;
  /** 品质筛选（null=全部） */
  rarity: EquipmentRarity | null;
  /** 是否只看未穿戴 */
  unequippedOnly: boolean;
  /** 是否只看套装 */
  setOnly: boolean;
}

/** 背包操作结果 */
export interface BagOperationResult {
  /** 是否成功 */
  success: boolean;
  /** 错误原因 */
  reason?: string;
}

// ─────────────────────────────────────────────
// 8. 装备分解（#4）
// ─────────────────────────────────────────────

/** 分解产出 */
export interface DecomposeResult {
  /** 产出铜钱数量 */
  copper: number;
  /** 产出强化石数量 */
  enhanceStone: number;
}

/** 批量分解结果 */
export interface BatchDecomposeResult {
  /** 总产出 */
  total: DecomposeResult;
  /** 成功分解的装备UID列表 */
  decomposedUids: string[];
  /** 跳过的装备UID列表（已穿戴等） */
  skippedUids: string[];
}

// ─────────────────────────────────────────────
// 9. 掉落配置（#2）
// ─────────────────────────────────────────────

/** 关卡类型 */
export type CampaignType = 'normal' | 'elite' | 'boss';

/** 品质掉落权重 */
export interface RarityDropWeights {
  white: number;
  green: number;
  blue: number;
  purple: number;
  gold: number;
}

// ─────────────────────────────────────────────
// 10. 装备系统存档
// ─────────────────────────────────────────────

/** 装备系统存档数据 */
export interface EquipmentSaveData {
  /** 存档版本号 */
  version: number;
  /** 背包中的装备列表 */
  equipments: EquipmentInstance[];
  /** 背包容量 */
  bagCapacity: number;
}
