// ========== 放置游戏类型定义 ==========

/** 资源定义 */
export interface Resource {
  id: string;
  name: string;
  amount: number;
  perSecond: number;
  maxAmount: number;
  unlocked: boolean;
}

/** 升级效果 */
export interface UpgradeEffect {
  type: string; // 'multiply_production' | 'add_production' | 'unlock' | 'reduce_cost' | etc.
  target: string; // resource id or upgrade id
  value: number;
}

/** 升级定义 */
export interface Upgrade {
  id: string;
  name: string;
  description: string;
  baseCost: Record<string, number>;
  costMultiplier: number;
  level: number;
  maxLevel: number;
  effect: UpgradeEffect;
  unlocked: boolean;
  requires?: string[];
  icon?: string;
}

/** 声望数据 */
export interface PrestigeData {
  currency: number;
  count: number;
}

/** 存档数据 */
export interface SaveData {
  version: string;
  gameId: string;
  timestamp: number;
  resources: Record<string, { amount: number; unlocked: boolean }>;
  upgrades: Record<string, number>; // upgrade id -> level
  prestige: PrestigeData;
  statistics: Record<string, number>;
  settings: Record<string, unknown>;
}

/** 离线收益报告 */
export interface OfflineReport {
  offlineMs: number;
  earnedResources: Record<string, number>;
  timestamp: number;
}

/** 放置游戏元信息 */
export interface IdleGameMeta {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  gradient: string;
  series?: string;
  tags?: string[];
}

/** 排行榜条目（本地） */
export interface IdleLeaderboardEntry {
  rank: number;
  gameId: string;
  dimension: string;
  value: number;
  label: string;
  date: string;
}

/** 攻略阶段 */
export interface StrategyPhase {
  id: string;
  title: string;
  description: string;
  tips: string[];
  unlockCondition?: string; // 描述性条件
  unlocked: boolean;
}

/** 存档槽位 */
export interface SaveSlot {
  slot: number;
  data: SaveData | null;
  savedAt: number | null;
  preview: string | null;
}
