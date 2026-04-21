/**
 * 科技域 — 类型定义
 *
 * 规则：只有 interface/type/const，零逻辑
 * 三条科技路线：军事红 / 经济黄 / 文化紫
 *
 * @module engine/tech/tech.types
 */

// ─────────────────────────────────────────────
// 1. 科技路线枚举
// ─────────────────────────────────────────────

/** 科技路线（三条分支） */
export type TechPath = 'military' | 'economy' | 'culture';

/** 科技路线中文名 */
export const TECH_PATH_LABELS: Record<TechPath, string> = {
  military: '军事',
  economy: '经济',
  culture: '文化',
};

/** 科技路线颜色（用于 UI 展示） */
export const TECH_PATH_COLORS: Record<TechPath, string> = {
  military: '#DC2626', // 红
  economy: '#D97706', // 黄
  culture: '#7C3AED', // 紫
};

/** 科技路线图标 */
export const TECH_PATH_ICONS: Record<TechPath, string> = {
  military: '⚔️',
  economy: '💰',
  culture: '📜',
};

/** 所有科技路线只读数组 */
export const TECH_PATHS: readonly TechPath[] = ['military', 'economy', 'culture'] as const;

// ─────────────────────────────────────────────
// 2. 科技节点状态
// ─────────────────────────────────────────────

/** 科技节点状态 */
export type TechNodeStatus = 'locked' | 'available' | 'researching' | 'completed';

// ─────────────────────────────────────────────
// 3. 科技节点定义（静态配置）
// ─────────────────────────────────────────────

/** 科技节点定义 */
export interface TechNodeDef {
  /** 节点唯一 ID */
  id: string;
  /** 节点名称 */
  name: string;
  /** 节点描述 */
  description: string;
  /** 所属科技路线 */
  path: TechPath;
  /** 层级（1-based，每层可能有多个互斥分支） */
  tier: number;
  /** 前置依赖节点 ID 列表（需全部完成） */
  prerequisites: string[];
  /** 互斥组 ID（同组内只能选一个，空字符串表示不互斥） */
  mutexGroup: string;
  /** 研究消耗科技点 */
  costPoints: number;
  /** 研究耗时（秒） */
  researchTime: number;
  /** 科技效果 */
  effects: TechEffect[];
  /** 节点图标 */
  icon: string;
}

/** 科技效果 */
export interface TechEffect {
  /** 效果类型 */
  type: TechEffectType;
  /** 效果目标（如资源类型、兵种类型等） */
  target: string;
  /** 效果值（百分比增量的分子，如 10 表示 +10%） */
  value: number;
}

/** 科技效果类型 */
export type TechEffectType =
  | 'resource_production'   // 资源产出加成
  | 'troop_attack'          // 兵种攻击加成
  | 'troop_defense'         // 兵种防御加成
  | 'troop_hp'              // 兵种生命加成
  | 'building_production'   // 建筑产出加成
  | 'hero_exp'              // 武将经验加成
  | 'research_speed'        // 研究速度加成
  | 'march_speed'           // 行军速度加成
  | 'resource_cap'          // 资源上限加成
  | 'recruit_discount';     // 招募折扣

// ─────────────────────────────────────────────
// 4. 科技节点运行时状态
// ─────────────────────────────────────────────

/** 单个科技节点运行时状态 */
export interface TechNodeState {
  /** 节点 ID */
  id: string;
  /** 节点状态 */
  status: TechNodeStatus;
  /** 研究开始时间戳（ms），仅 researching 状态有值 */
  researchStartTime: number | null;
  /** 研究完成时间戳（ms），仅 researching 状态有值 */
  researchEndTime: number | null;
}

// ─────────────────────────────────────────────
// 5. 研究队列
// ─────────────────────────────────────────────

/** 研究队列槽位 */
export interface ResearchSlot {
  /** 科技节点 ID */
  techId: string;
  /** 开始时间戳（ms） */
  startTime: number;
  /** 预计完成时间戳（ms） */
  endTime: number;
}

// ─────────────────────────────────────────────
// 6. 科技点
// ─────────────────────────────────────────────

/** 科技点状态 */
export interface TechPointState {
  /** 当前科技点数 */
  current: number;
  /** 累计获得的科技点 */
  totalEarned: number;
  /** 累计消耗的科技点 */
  totalSpent: number;
}

// ─────────────────────────────────────────────
// 7. 研究加速
// ─────────────────────────────────────────────

/** 加速方式 */
export type SpeedUpMethod = 'mandate' | 'ingot';

/** 加速结果 */
export interface SpeedUpResult {
  /** 是否成功 */
  success: boolean;
  /** 消耗的天命/元宝数量 */
  cost: number;
  /** 加速的时间（秒） */
  timeReduced: number;
  /** 研究是否已完成 */
  completed: boolean;
  /** 失败原因（success=false 时有值） */
  reason?: string;
}

// ─────────────────────────────────────────────
// 8. 研究操作结果
// ─────────────────────────────────────────────

/** 开始研究的结果 */
export interface StartResearchResult {
  /** 是否成功 */
  success: boolean;
  /** 失败原因 */
  reason?: string;
}

// ─────────────────────────────────────────────
// 9. 科技树整体状态
// ─────────────────────────────────────────────

/** 科技系统完整状态 */
export interface TechState {
  /** 所有节点状态 */
  nodes: Record<string, TechNodeState>;
  /** 研究队列 */
  researchQueue: ResearchSlot[];
  /** 科技点状态 */
  techPoints: TechPointState;
  /** 已选择的互斥节点 ID 集合 */
  chosenMutexNodes: Record<string, string>;
}

// ─────────────────────────────────────────────
// 10. 序列化
// ─────────────────────────────────────────────

/** 科技系统存档数据 */
export interface TechSaveData {
  /** 存档版本 */
  version: number;
  /** 已完成的科技 ID 列表 */
  completedTechIds: string[];
  /** 正在研究的科技（兼容旧存档，仅队列首项） */
  activeResearch: ResearchSlot | null;
  /** 完整研究队列（v5.0+） */
  researchQueue?: ResearchSlot[];
  /** 科技点 */
  techPoints: TechPointState;
  /** 已选择的互斥节点映射 */
  chosenMutexNodes: Record<string, string>;
}

// ─────────────────────────────────────────────
// 11. 连线定义（用于 UI 渲染）
// ─────────────────────────────────────────────

/** 科技树连线 */
export interface TechEdge {
  /** 源节点 ID */
  from: string;
  /** 目标节点 ID */
  to: string;
  /** 连线类型 */
  type: 'prerequisite' | 'mutex';
}
