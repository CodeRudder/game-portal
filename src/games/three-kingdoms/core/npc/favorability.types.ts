/**
 * 核心层 — NPC 好感度系统类型定义
 *
 * 定义 v6.0 NPC 好感度系统的类型：
 *   - 好感度等级与效果
 *   - 好感度获取途径
 *   - 羁绊技能
 *   - 好感度进度可视化
 *
 * @module core/npc/favorability.types
 */

import type { NPCId, NPCProfession, AffinityLevel } from './npc.types';

// ─────────────────────────────────────────────
// 1. 好感度等级与效果（#17）
// ─────────────────────────────────────────────

/** 好感度等级效果定义 */
export interface AffinityLevelEffect {
  /** 等级 */
  level: AffinityLevel;
  /** 等级序号 (1-5) */
  levelNumber: number;
  /** 中文名 */
  label: string;
  /** 交易折扣（0-1，如0.9表示9折） */
  tradeDiscount: number;
  /** 情报准确度（0-1） */
  intelAccuracy: number;
  /** 任务奖励倍率 */
  questRewardMultiplier: number;
  /** 可解锁的交互类型 */
  unlockedInteractions: string[];
  /** 描述 */
  description: string;
}

/** 好感度等级效果表 */
export const AFFINITY_LEVEL_EFFECTS: Record<AffinityLevel, AffinityLevelEffect> = {
  hostile: {
    level: 'hostile',
    levelNumber: 1,
    label: '敌意',
    tradeDiscount: 1.0,
    intelAccuracy: 0.3,
    questRewardMultiplier: 0.5,
    unlockedInteractions: ['talk'],
    description: 'NPC对你充满敌意，仅能进行基本对话',
  },
  neutral: {
    level: 'neutral',
    levelNumber: 2,
    label: '中立',
    tradeDiscount: 0.95,
    intelAccuracy: 0.5,
    questRewardMultiplier: 0.8,
    unlockedInteractions: ['talk', 'trade'],
    description: 'NPC对你态度中立，可进行基本交易',
  },
  friendly: {
    level: 'friendly',
    levelNumber: 3,
    label: '友善',
    tradeDiscount: 0.85,
    intelAccuracy: 0.7,
    questRewardMultiplier: 1.0,
    unlockedInteractions: ['talk', 'trade', 'gift', 'intel'],
    description: 'NPC对你友善，可赠送礼物和获取情报',
  },
  trusted: {
    level: 'trusted',
    levelNumber: 4,
    label: '信赖',
    tradeDiscount: 0.75,
    intelAccuracy: 0.85,
    questRewardMultiplier: 1.3,
    unlockedInteractions: ['talk', 'trade', 'gift', 'intel', 'quest', 'craft'],
    description: 'NPC对你信赖有加，开放更多交互选项',
  },
  bonded: {
    level: 'bonded',
    levelNumber: 5,
    label: '羁绊',
    tradeDiscount: 0.6,
    intelAccuracy: 0.95,
    questRewardMultiplier: 1.5,
    unlockedInteractions: ['talk', 'trade', 'gift', 'intel', 'quest', 'craft', 'bond_skill'],
    description: 'NPC与你建立深厚羁绊，解锁专属羁绊技能',
  },
} as const;

// ─────────────────────────────────────────────
// 2. 好感度获取途径（#18）
// ─────────────────────────────────────────────

/** 好感度变化来源 */
export type AffinitySource =
  | 'dialog'          // 对话
  | 'gift'            // 赠送礼物
  | 'quest_complete'  // 完成任务
  | 'trade'           // 交易
  | 'battle_assist'   // 战斗协助
  | 'time_decay';     // 时间衰减

/** 好感度变化记录 */
export interface AffinityChangeRecord {
  /** NPC ID */
  npcId: NPCId;
  /** 变化来源 */
  source: AffinitySource;
  /** 变化量 */
  delta: number;
  /** 变化前好感度 */
  previousAffinity: number;
  /** 变化后好感度 */
  newAffinity: number;
  /** 来源描述 */
  description: string;
  /** 发生时间（回合数） */
  turn: number;
}

/** 好感度获取配置 */
export interface AffinityGainConfig {
  /** 对话基础好感度 */
  dialogBase: number;
  /** 赠送偏好物品倍率 */
  giftPreferredMultiplier: number;
  /** 赠送普通物品倍率 */
  giftNormalMultiplier: number;
  /** 完成任务好感度 */
  questComplete: number;
  /** 交易好感度 */
  tradeBase: number;
  /** 战斗协助好感度 */
  battleAssist: number;
  /** 每回合衰减量 */
  decayPerTurn: number;
}

/** 默认好感度获取配置 */
export const DEFAULT_AFFINITY_GAIN_CONFIG: AffinityGainConfig = {
  dialogBase: 3,
  giftPreferredMultiplier: 2.0,
  giftNormalMultiplier: 1.0,
  questComplete: 15,
  tradeBase: 2,
  battleAssist: 8,
  decayPerTurn: 0.5,
} as const;

// ─────────────────────────────────────────────
// 3. NPC 专属羁绊技能（#20）
// ─────────────────────────────────────────────

/** 羁绊技能ID */
export type BondSkillId = string;

/** 羁绊技能定义 */
export interface BondSkillDef {
  /** 技能ID */
  id: BondSkillId;
  /** 技能名称 */
  name: string;
  /** 关联NPC职业 */
  profession: NPCProfession;
  /** 技能描述 */
  description: string;
  /** 效果 */
  effects: BondSkillEffect[];
  /** 所需好感度等级 */
  requiredLevel: AffinityLevel;
  /** 冷却回合数 */
  cooldownTurns: number;
}

/** 羁绊技能效果 */
export interface BondSkillEffect {
  /** 效果类型 */
  type: 'production_boost' | 'combat_boost' | 'discount' | 'intel_bonus' | 'craft_bonus';
  /** 目标 */
  target: string;
  /** 效果值 */
  value: number;
  /** 持续回合数 */
  duration: number;
}

/** 商人羁绊技能 — 日进斗金 */
export const BOND_SKILL_MERCHANT: BondSkillDef = {
  id: 'bond-merchant-goldrush',
  name: '日进斗金',
  profession: 'merchant',
  description: '商人全力协助，所有贸易收入翻倍，持续3回合',
  effects: [
    { type: 'production_boost', target: 'gold', value: 1.0, duration: 3 },
  ],
  requiredLevel: 'bonded',
  cooldownTurns: 10,
};

/** 谋士羁绊技能 — 运筹帷幄 */
export const BOND_SKILL_STRATEGIST: BondSkillDef = {
  id: 'bond-strategist-mastermind',
  name: '运筹帷幄',
  profession: 'strategist',
  description: '谋士献上妙计，战斗胜率提升20%，持续2回合',
  effects: [
    { type: 'combat_boost', target: 'win_rate', value: 0.2, duration: 2 },
  ],
  requiredLevel: 'bonded',
  cooldownTurns: 8,
};

/** 武将羁绊技能 — 所向披靡 */
export const BOND_SKILL_WARRIOR: BondSkillDef = {
  id: 'bond-warrior-unstoppable',
  name: '所向披靡',
  profession: 'warrior',
  description: '武将全力出击，攻击力提升30%，持续2回合',
  effects: [
    { type: 'combat_boost', target: 'attack', value: 0.3, duration: 2 },
  ],
  requiredLevel: 'bonded',
  cooldownTurns: 8,
};

/** 工匠羁绊技能 — 精益求精 */
export const BOND_SKILL_ARTISAN: BondSkillDef = {
  id: 'bond-artisan-perfection',
  name: '精益求精',
  profession: 'artisan',
  description: '工匠精心打造，锻造成功率提升25%，持续3回合',
  effects: [
    { type: 'craft_bonus', target: 'success_rate', value: 0.25, duration: 3 },
  ],
  requiredLevel: 'bonded',
  cooldownTurns: 10,
};

/** 旅人羁绊技能 — 天涯知己 */
export const BOND_SKILL_TRAVELER: BondSkillDef = {
  id: 'bond-traveler-kindred',
  name: '天涯知己',
  profession: 'traveler',
  description: '旅人分享珍贵情报，所有资源产出提升15%，持续3回合',
  effects: [
    { type: 'production_boost', target: 'all', value: 0.15, duration: 3 },
  ],
  requiredLevel: 'bonded',
  cooldownTurns: 12,
};

/** 所有羁绊技能映射 */
export const BOND_SKILLS: Record<NPCProfession, BondSkillDef> = {
  merchant: BOND_SKILL_MERCHANT,
  strategist: BOND_SKILL_STRATEGIST,
  warrior: BOND_SKILL_WARRIOR,
  artisan: BOND_SKILL_ARTISAN,
  traveler: BOND_SKILL_TRAVELER,
} as const;

// ─────────────────────────────────────────────
// 4. 好感度进度可视化（#19）
// ─────────────────────────────────────────────

/** 好感度可视化数据 */
export interface AffinityVisualization {
  /** NPC ID */
  npcId: NPCId;
  /** 当前好感度值 (0-100) */
  currentAffinity: number;
  /** 当前等级 */
  currentLevel: AffinityLevel;
  /** 当前等级序号 (1-5) */
  levelNumber: number;
  /** 等级中文名 */
  levelLabel: string;
  /** 当前等级内进度 (0-1) */
  levelProgress: number;
  /** 距下一等级所需好感度 */
  toNextLevel: number;
  /** 下一等级名称（null表示已满级） */
  nextLevel: AffinityLevel | null;
  /** 羁绊技能是否已解锁 */
  bondSkillUnlocked: boolean;
  /** 羁绊技能名称 */
  bondSkillName: string | null;
}

/** 好感度系统状态 */
export interface FavorabilityState {
  /** 好感度变化历史 */
  changeHistory: AffinityChangeRecord[];
  /** 活跃羁绊技能冷却 */
  bondSkillCooldowns: Record<NPCId, number>;
}

/** 好感度系统存档数据 */
export interface FavorabilitySaveData {
  /** 好感度变化历史（最近N条） */
  changeHistory: AffinityChangeRecord[];
  /** 羁绊技能冷却 */
  bondSkillCooldowns: Record<NPCId, number>;
  /** 版本号 */
  version: number;
}
