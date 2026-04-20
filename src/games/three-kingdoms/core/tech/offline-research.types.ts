/**
 * 科技域 — 离线研究类型定义
 *
 * 定义离线研究系统的所有类型接口，零逻辑。
 * 包含效率衰减配置、离线进度计算结果、回归面板数据等。
 *
 * 衰减规则（与离线收益一致的分段模型）：
 *   0 ~ 2h   → 100% 效率
 *   2 ~ 8h   →  70% 效率
 *   8 ~ 24h  →  40% 效率
 *  > 24h     →  20% 效率
 *
 * @module core/tech/offline-research.types
 */

// ─────────────────────────────────────────────
// 1. 效率衰减分段
// ─────────────────────────────────────────────

/** 效率衰减分段定义 */
export interface EfficiencyTier {
  /** 该分段结束的累计秒数 */
  endSeconds: number;
  /** 该分段内的效率百分比（0~1） */
  efficiency: number;
}

/**
 * 离线研究效率衰减分段表
 *
 * 按累计时长升序排列，每段定义该时间范围内的研究效率。
 * 与离线资源收益的分段模型一致但独立配置。
 */
export const OFFLINE_RESEARCH_DECAY_TIERS: readonly EfficiencyTier[] = [
  { endSeconds: 2 * 3600, efficiency: 1.0 },   // 0~2h:   100%
  { endSeconds: 8 * 3600, efficiency: 0.7 },   // 2~8h:    70%
  { endSeconds: 24 * 3600, efficiency: 0.4 },  // 8~24h:   40%
  { endSeconds: 72 * 3600, efficiency: 0.2 },  // 24~72h:  20%
] as const;

/** 最大离线研究时长（秒）：72 小时 */
export const MAX_OFFLINE_RESEARCH_SECONDS = 72 * 3600;

// ─────────────────────────────────────────────
// 2. 离线进度计算结果
// ─────────────────────────────────────────────

/** 单个科技的离线进度增量 */
export interface OfflineTechProgress {
  /** 科技节点 ID */
  techId: string;
  /** 科技名称 */
  techName: string;
  /** 离线前的进度（0~1） */
  progressBefore: number;
  /** 离线后的进度（0~1，若完成则为 1） */
  progressAfter: number;
  /** 进度增量（0~1） */
  progressDelta: number;
  /** 研究是否在离线期间完成 */
  completed: boolean;
  /** 剩余研究时间（秒），未完成为正数，完成为 0 */
  remainingSeconds: number;
}

// ─────────────────────────────────────────────
// 3. 效率曲线数据点
// ─────────────────────────────────────────────

/** 效率曲线采样点（用于回归面板图表） */
export interface EfficiencyCurvePoint {
  /** 离线第 N 秒 */
  seconds: number;
  /** 该时刻的效率（0~1） */
  efficiency: number;
}

// ─────────────────────────────────────────────
// 4. 回归面板数据
// ─────────────────────────────────────────────

/** 离线研究回归面板数据 */
export interface OfflineResearchPanel {
  /** 离线时长（秒） */
  offlineSeconds: number;
  /** 格式化的离线时长文本 */
  offlineTimeText: string;
  /** 综合效率（0~1），用于 UI 显示 */
  overallEfficiency: number;
  /** 各科技的离线进度 */
  techProgressList: OfflineTechProgress[];
  /** 离线期间完成的科技 ID 列表 */
  completedTechIds: string[];
  /** 效率曲线采样点（用于图表渲染） */
  efficiencyCurve: EfficiencyCurvePoint[];
}

// ─────────────────────────────────────────────
// 5. 离线研究存档数据
// ─────────────────────────────────────────────

/** 离线研究存档数据（嵌入 TechSaveData） */
export interface OfflineResearchSaveData {
  /** 离线开始时间戳（ms），null 表示在线 */
  offlineStartTime: number | null;
  /** 离线开始时的研究队列快照 */
  researchSnapshot: ResearchSnapshotItem[];
}

/** 研究队列快照项 */
export interface ResearchSnapshotItem {
  /** 科技节点 ID */
  techId: string;
  /** 快照时的开始时间戳（ms） */
  startTime: number;
  /** 快照时的预计完成时间戳（ms） */
  endTime: number;
}

// ─────────────────────────────────────────────
// 6. 离线研究系统状态
// ─────────────────────────────────────────────

/** 离线研究系统运行时状态 */
export interface OfflineResearchState {
  /** 是否处于离线状态 */
  isOffline: boolean;
  /** 离线开始时间戳（ms） */
  offlineStartTime: number | null;
  /** 研究队列快照 */
  researchSnapshot: ResearchSnapshotItem[];
  /** 上次回归面板数据（null 表示未生成） */
  lastPanelData: OfflineResearchPanel | null;
}
