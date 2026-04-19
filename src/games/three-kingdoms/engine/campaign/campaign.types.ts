/**
 * 关卡系统 — 类型定义
 *
 * 规则：只有 interface/type/enum/const，零运行时逻辑
 * 来源：v3.0 攻城略地(上) — CBT-1 战役长卷
 *
 * @module engine/campaign/campaign.types
 */

import type { ResourceType, Resources } from '../../shared/types';
import type { Faction } from '../hero/hero.types';
import { type StarRating, TroopType } from '../battle/battle.types';

// ─────────────────────────────────────────────
// 1. 关卡类型枚举
// ─────────────────────────────────────────────

/**
 * 关卡类型
 *
 * normal  — 普通关卡，敌方较弱，掉落基础资源
 * elite   — 精英关卡，敌方较强，掉落碎片和稀有资源
 * boss    — BOSS关卡，章节最终关，掉落大量奖励
 */
export type StageType = 'normal' | 'elite' | 'boss';

/** 关卡类型中文名映射 */
export const STAGE_TYPE_LABELS: Record<StageType, string> = {
  normal: '普通',
  elite: '精英',
  boss: 'BOSS',
} as const;

// ─────────────────────────────────────────────
// 2. 关卡状态
// ─────────────────────────────────────────────

/**
 * 关卡状态
 *
 * locked    — 未解锁（前置关卡未通关）
 * available — 可挑战（前置关卡已通关）
 * cleared   — 已通关（1-2星）
 * threeStar — 三星通关
 */
export type StageStatus = 'locked' | 'available' | 'cleared' | 'threeStar';

/** 关卡状态中文名映射 */
export const STAGE_STATUS_LABELS: Record<StageStatus, string> = {
  locked: '未解锁',
  available: '可挑战',
  cleared: '已通关',
  threeStar: '三星通关',
} as const;

// ─────────────────────────────────────────────
// 3. 星级评定
// ─────────────────────────────────────────────

/**
 * 星级评定（0-3）
 *
 * 统一使用 battle 域的 StarRating enum，消除双轨制。
 * ★☆☆：通关（任意HP > 0）
 * ★★☆：通关 + 我方存活 ≥ 4人
 * ★★★：通关 + 我方存活 ≥ 4人 + 回合数 ≤ 6
 */
export type { StarRating };

/** 最大星级 */
export const MAX_STARS = 3 as const;

// ─────────────────────────────────────────────
// 4. 敌方阵容配置
// ─────────────────────────────────────────────

/**
 * 敌方单位配置
 *
 * 描述一个敌方NPC武将/小兵的属性配置
 */
export interface EnemyUnitDef {
  /** 敌方单位ID（唯一标识） */
  id: string;
  /** 名称 */
  name: string;
  /** 阵营 */
  faction: Faction;
  /** 兵种 */
  troopType: TroopType;
  /** 等级 */
  level: number;
  /** 攻击力 */
  attack: number;
  /** 防御力 */
  defense: number;
  /** 智力 */
  intelligence: number;
  /** 速度 */
  speed: number;
  /** 最大生命值 */
  maxHp: number;
  /** 站位（前排/后排） */
  position: 'front' | 'back';
}

/**
 * 敌方阵容配置
 *
 * 一个关卡中所有敌方单位的配置
 */
export interface EnemyFormation {
  /** 阵营ID */
  id: string;
  /** 阵营名称 */
  name: string;
  /** 敌方单位列表（3-6个） */
  units: EnemyUnitDef[];
  /** 推荐战力（我方总战力建议值） */
  recommendedPower: number;
}

// ─────────────────────────────────────────────
// 5. 掉落表
// ─────────────────────────────────────────────

/**
 * 掉落物品类型
 *
 * resource — 基础资源（粮草/铜钱/兵力/天命）
 * fragment — 武将碎片
 * exp      — 经验值
 */
export type DropItemType = 'resource' | 'fragment' | 'exp';

/**
 * 掉落表条目
 *
 * 定义一个可能的掉落物品及其概率
 */
export interface DropTableEntry {
  /** 掉落类型 */
  type: DropItemType;
  /** 资源类型（type=resource时使用） */
  resourceType?: ResourceType;
  /** 武将ID（type=fragment时使用） */
  generalId?: string;
  /** 掉落数量最小值 */
  minAmount: number;
  /** 掉落数量最大值 */
  maxAmount: number;
  /** 掉落概率（0~1） */
  probability: number;
}

// ─────────────────────────────────────────────
// 6. 关卡奖励
// ─────────────────────────────────────────────

/**
 * 关卡奖励
 *
 * 包含一次通关获得的全部奖励
 */
export interface StageReward {
  /** 基础资源奖励 */
  resources: Partial<Resources>;
  /** 经验奖励 */
  exp: number;
  /** 武将碎片奖励 Map<generalId, count> */
  fragments: Record<string, number>;
  /** 是否为首通奖励 */
  isFirstClear: boolean;
  /** 星级加成倍率（1.0 / 1.0 / 1.5 / 2.0） */
  starMultiplier: number;
}

// ─────────────────────────────────────────────
// 7. 关卡定义
// ─────────────────────────────────────────────

/**
 * 关卡定义（静态配置）
 *
 * 一个关卡的完整配置数据
 */
export interface Stage {
  /** 关卡唯一ID（格式：chapter{N}_stage{M}） */
  id: string;
  /** 关卡名称 */
  name: string;
  /** 关卡类型 */
  type: StageType;
  /** 所属章节ID */
  chapterId: string;
  /** 关卡序号（在章节内的顺序，从1开始） */
  order: number;
  /** 敌方阵容 */
  enemyFormation: EnemyFormation;
  /** 基础资源奖励 */
  baseRewards: Partial<Resources>;
  /** 基础经验奖励 */
  baseExp: number;
  /** 首通额外奖励 */
  firstClearRewards: Partial<Resources>;
  /** 首通额外经验 */
  firstClearExp: number;
  /** 三星额外奖励倍率 */
  threeStarBonusMultiplier: number;
  /** 掉落表 */
  dropTable: DropTableEntry[];
  /** 推荐战力 */
  recommendedPower: number;
  /** 关卡描述（简短） */
  description: string;
}

// ─────────────────────────────────────────────
// 8. 章节
// ─────────────────────────────────────────────

/**
 * 章节定义
 *
 * 包含章节信息和关卡列表
 */
export interface Chapter {
  /** 章节唯一ID（格式：chapter{N}） */
  id: string;
  /** 章节名称 */
  name: string;
  /** 章节副标题 */
  subtitle: string;
  /** 章节序号（从1开始） */
  order: number;
  /** 关卡列表 */
  stages: Stage[];
  /** 解锁所需前置章节ID（null表示初始解锁） */
  prerequisiteChapterId: string | null;
  /** 章节描述 */
  description: string;
}

// ─────────────────────────────────────────────
// 9. 关卡运行时状态
// ─────────────────────────────────────────────

/**
 * 单个关卡的运行时状态
 *
 * 记录玩家的通关进度和星级
 */
export interface StageState {
  /** 关卡ID */
  stageId: string;
  /** 当前星级（0-3） */
  stars: StarRating;
  /** 是否已首通 */
  firstCleared: boolean;
  /** 通关次数 */
  clearCount: number;
}

/**
 * 关卡进度
 *
 * 玩家的完整关卡进度数据
 */
export interface CampaignProgress {
  /** 当前所在章节ID */
  currentChapterId: string;
  /** 各关卡状态 Map<stageId, StageState> */
  stageStates: Record<string, StageState>;
  /** 最后通关时间戳（ms） */
  lastClearTime: number;
}

// ─────────────────────────────────────────────
// 10. 序列化
// ─────────────────────────────────────────────

/**
 * 关卡系统存档数据
 */
export interface CampaignSaveData {
  /** 存档版本号 */
  version: number;
  /** 关卡进度 */
  progress: CampaignProgress;
}

// ─────────────────────────────────────────────
// 11. 奖励分发回调
// ─────────────────────────────────────────────

/**
 * 资源增加回调
 *
 * 通过回调解耦资源系统，不直接依赖 ResourceSystem
 */
export type AddResourceCallback = (type: ResourceType, amount: number) => number;

/**
 * 碎片增加回调
 *
 * 通过回调解耦武将系统
 */
export type AddFragmentCallback = (generalId: string, count: number) => void;

/**
 * 经验增加回调
 *
 * 通过回调解耦武将系统
 */
export type AddExpCallback = (exp: number) => void;

/**
 * 奖励分发依赖
 *
 * 通过回调集合解耦各子系统
 */
export interface RewardDistributorDeps {
  /** 增加资源回调 */
  addResource: AddResourceCallback;
  /** 增加碎片回调 */
  addFragment?: AddFragmentCallback;
  /** 增加经验回调 */
  addExp?: AddExpCallback;
}

// ─────────────────────────────────────────────
// 12. 关卡进度系统依赖
// ─────────────────────────────────────────────

/**
 * 关卡进度系统依赖接口
 *
 * 通过接口解耦配置数据源
 */
export interface ICampaignDataProvider {
  /** 获取所有章节 */
  getChapters(): Chapter[];
  /** 获取指定章节 */
  getChapter(chapterId: string): Chapter | undefined;
  /** 获取指定关卡 */
  getStage(stageId: string): Stage | undefined;
  /** 获取章节内的关卡列表 */
  getStagesByChapter(chapterId: string): Stage[];
}
