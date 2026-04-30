/**
 * 武将升星 + 突破 — 类型定义
 *
 * 规则：只有 interface/type/enum，零逻辑
 * 覆盖功能点：#11 碎片获取、#12 升星消耗与效果、#13 碎片进度可视化、#14 突破系统
 *
 * @module engine/hero/star-up.types
 */

import type { Quality, GeneralStats } from './hero.types';

// ─────────────────────────────────────────────
// 1. 星级
// ─────────────────────────────────────────────

/** 武将星级数据（扩展 GeneralData 的运行时状态） */
export interface StarData {
  /** 武将ID */
  generalId: string;
  /** 当前星级（1~6） */
  star: number;
}

// ─────────────────────────────────────────────
// 2. 碎片来源
// ─────────────────────────────────────────────

/** 碎片获取途径枚举 */
export enum FragmentSource {
  /** 招募重复武将转化 */
  DUPLICATE = 'DUPLICATE',
  /** 关卡掉落 */
  STAGE_DROP = 'STAGE_DROP',
  /** 商店兑换 */
  SHOP_EXCHANGE = 'SHOP_EXCHANGE',
  /** 活动获取 */
  ACTIVITY = 'ACTIVITY',
  /** 远征获取 */
  EXPEDITION = 'EXPEDITION',
}

/** 碎片获取记录 */
export interface FragmentGainRecord {
  /** 武将ID */
  generalId: string;
  /** 获取数量 */
  count: number;
  /** 来源 */
  source: FragmentSource;
}

// ─────────────────────────────────────────────
// 3. 升星
// ─────────────────────────────────────────────

/** 升星消耗配置 */
export interface StarUpCost {
  /** 碎片消耗数量 */
  fragments: number;
  /** 铜钱消耗数量 */
  gold: number;
}

/** 升星结果 */
export interface StarUpResult {
  /** 是否成功 */
  success: boolean;
  /** 武将ID */
  generalId: string;
  /** 升星前星级 */
  previousStar: number;
  /** 升星后星级 */
  currentStar: number;
  /** 消耗碎片数量 */
  fragmentsSpent: number;
  /** 消耗铜钱数量 */
  goldSpent: number;
  /** 升星前属性 */
  statsBefore: GeneralStats;
  /** 升星后属性 */
  statsAfter: GeneralStats;
}

/** 升星预览（不执行实际操作） */
export interface StarUpPreview {
  /** 武将ID */
  generalId: string;
  /** 当前星级 */
  currentStar: number;
  /** 目标星级 */
  targetStar: number;
  /** 碎片消耗 */
  fragmentCost: number;
  /** 铜钱消耗 */
  goldCost: number;
  /** 当前碎片持有 */
  fragmentOwned: number;
  /** 碎片是否充足 */
  fragmentSufficient: boolean;
  /** 属性变化预览 */
  statsDiff: {
    before: GeneralStats;
    after: GeneralStats;
  };
}

// ─────────────────────────────────────────────
// 4. 碎片进度
// ─────────────────────────────────────────────

/** 碎片进度信息（功能点 #13） */
export interface FragmentProgress {
  /** 武将ID */
  generalId: string;
  /** 武将名称 */
  generalName: string;
  /** 当前碎片数量 */
  currentFragments: number;
  /** 升星所需碎片数量 */
  requiredFragments: number;
  /** 进度百分比 (0~100) */
  percentage: number;
  /** 当前星级 */
  currentStar: number;
  /** 是否可升星 */
  canStarUp: boolean;
}

// ─────────────────────────────────────────────
// 5. 突破
// ─────────────────────────────────────────────

/** 突破阶段配置 */
export interface BreakthroughTier {
  /** 突破阶段名称 */
  name: string;
  /** 突破前等级上限 */
  levelCapBefore: number;
  /** 突破后等级上限 */
  levelCapAfter: number;
  /** 所需碎片数量 */
  fragmentCost: number;
  /** 所需铜钱数量 */
  goldCost: number;
  /** 所需突破石数量 */
  breakthroughStoneCost: number;
}

/** 突破结果 */
export interface BreakthroughResult {
  /** 是否成功 */
  success: boolean;
  /** 武将ID */
  generalId: string;
  /** 突破前等级上限 */
  previousLevelCap: number;
  /** 突破后等级上限 */
  newLevelCap: number;
  /** 突破阶段 */
  breakthroughStage: number;
  /** 消耗碎片数量 */
  fragmentsSpent: number;
  /** 消耗铜钱数量 */
  goldSpent: number;
  /** 消耗突破石数量 */
  breakthroughStonesSpent: number;
}

/** 突破预览 */
export interface BreakthroughPreview {
  /** 武将ID */
  generalId: string;
  /** 当前等级 */
  currentLevel: number;
  /** 当前等级上限 */
  currentLevelCap: number;
  /** 突破后等级上限 */
  nextLevelCap: number;
  /** 下一突破阶段 */
  nextBreakthroughStage: number;
  /** 碎片消耗 */
  fragmentCost: number;
  /** 铜钱消耗 */
  goldCost: number;
  /** 突破石消耗 */
  breakthroughStoneCost: number;
  /** 是否满足突破条件（等级达到上限） */
  levelReady: boolean;
  /** 资源是否充足 */
  resourceSufficient: boolean;
  /** 是否可以突破 */
  canBreakthrough: boolean;
}

// ─────────────────────────────────────────────
// 6. 升星系统状态
// ─────────────────────────────────────────────

/** 升星系统运行时状态 */
export interface StarSystemState {
  /** 武将星级 Map<generalId, starLevel> */
  stars: Record<string, number>;
  /** 武将突破阶段 Map<generalId, breakthroughStage> */
  breakthroughStages: Record<string, number>;
  /** 商店碎片每日已兑换次数 Map<generalId, dailyExchangeCount> */
  dailyExchangeCount: Record<string, number>;
}

/** 升星系统存档数据 */
export interface StarSystemSaveData {
  /** 存档版本号 */
  version: number;
  /** 升星系统状态 */
  state: StarSystemState;
}

// ─────────────────────────────────────────────
// 7. 升星系统依赖
// ─────────────────────────────────────────────

/** 资源消耗回调 */
export type StarResourceSpendFn = (resourceType: string, amount: number) => boolean;
/** 资源检查回调 */
export type StarResourceCheckFn = (resourceType: string, amount: number) => boolean;
/** 资源查询回调 */
export type StarResourceGetFn = (resourceType: string) => number;

/** 升星系统业务依赖 */
export interface StarSystemDeps {
  /** 碎片消耗回调 */
  spendFragments: (generalId: string, count: number) => boolean;
  /** 碎片数量查询 */
  getFragments: (generalId: string) => number;
  /** 资源消耗回调（铜钱、突破石） */
  spendResource: StarResourceSpendFn;
  /** 资源检查回调 */
  canAffordResource: StarResourceCheckFn;
  /** 资源数量查询 */
  getResourceAmount: StarResourceGetFn;
  /** R2-FIX-P03: 资源添加回调（用于碎片溢出补偿铜钱），可选 */
  addResource?: (type: string, amount: number) => void;
}
