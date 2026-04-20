/**
 * 核心层 — v20.0 全系统联调类型定义
 *
 * 涵盖全系统联调验证的所有类型：
 *   - 核心循环端到端验证 (#1)
 *   - 跨系统数据流验证 (#2)
 *   - 转生循环验证 (#3)
 *   - 离线全系统验证 (#4)
 *
 * @module core/unification/integration.types
 */

// ─────────────────────────────────────────────
// 1. 通用类型
// ─────────────────────────────────────────────

/** 验证结果等级 */
export type IntegrationLevel = 'pass' | 'warning' | 'fail';

/** 联调验证维度 */
export type IntegrationDimension =
  | 'core_loop'           // 核心循环
  | 'cross_system_flow'   // 跨系统数据流
  | 'rebirth_cycle'       // 转生循环
  | 'offline_full';       // 离线全系统

/** 联调检查步骤 */
export interface IntegrationStep {
  /** 步骤 ID */
  stepId: string;
  /** 步骤描述 */
  description: string;
  /** 是否通过 */
  passed: boolean;
  /** 错误信息 */
  error?: string;
  /** 耗时 (ms) */
  durationMs: number;
}

// ─────────────────────────────────────────────
// 2. 核心循环端到端 (#1)
// ─────────────────────────────────────────────

/** 核心循环阶段 */
export type CoreLoopPhase =
  | 'idle_production'     // 挂机产出
  | 'building_upgrade'    // 建筑升级
  | 'hero_recruit'        // 武将招募
  | 'battle_push'         // 战斗推图
  | 'tech_research'       // 科技研究
  | 'resource_boost';     // 资源加速

/** 核心循环验证结果 */
export interface CoreLoopResult {
  /** 各阶段结果 */
  phases: Record<CoreLoopPhase, IntegrationStep>;
  /** 是否完整通过 */
  allPassed: boolean;
  /** 总耗时 (ms) */
  totalDurationMs: number;
}

// ─────────────────────────────────────────────
// 3. 跨系统数据流 (#2)
// ─────────────────────────────────────────────

/** 数据流路径 */
export type DataFlowPath =
  | 'resource_to_building'     // 资源→建筑
  | 'building_to_hero'        // 建筑→武将
  | 'hero_to_battle'          // 武将→战斗
  | 'battle_to_equipment'     // 战斗→装备
  | 'equipment_to_hero'       // 装备→武将
  | 'hero_to_tech'            // 武将→科技
  | 'all_to_reputation';      // 全系统→声望

/** 数据流检查结果 */
export interface DataFlowCheckResult {
  /** 流路径 */
  path: DataFlowPath;
  /** 源数据 */
  sourceValue: number;
  /** 目标数据 */
  targetValue: number;
  /** 是否一致 */
  consistent: boolean;
  /** 偏差 */
  deviation: number;
}

/** 跨系统数据流验证结果 */
export interface CrossSystemFlowResult {
  /** 各路径检查结果 */
  checks: DataFlowCheckResult[];
  /** 是否全部通过 */
  allPassed: boolean;
}

// ─────────────────────────────────────────────
// 4. 转生循环验证 (#3)
// ─────────────────────────────────────────────

/** 转生循环阶段 */
export type RebirthCyclePhase =
  | 'condition_check'       // 条件检查
  | 'data_reset'            // 数据重置
  | 'multiplier_apply'      // 倍率生效
  | 'accelerated_rebuild'   // 加速重建
  | 're_push';              // 再次推图

/** 转生循环验证结果 */
export interface RebirthCycleResult {
  /** 各阶段结果 */
  phases: Record<RebirthCyclePhase, IntegrationStep>;
  /** 重置前数据快照 */
  preRebirthSnapshot: Record<string, number>;
  /** 重置后数据快照 */
  postRebirthSnapshot: Record<string, number>;
  /** 倍率验证 */
  multiplierVerified: boolean;
  /** 是否完整通过 */
  allPassed: boolean;
}

// ─────────────────────────────────────────────
// 5. 离线全系统验证 (#4)
// ─────────────────────────────────────────────

/** 离线子系统 */
export type OfflineSubsystem =
  | 'offline_reward'       // 离线收益
  | 'offline_event'        // 离线事件
  | 'offline_activity'     // 离线活动
  | 'offline_expedition'   // 离线远征
  | 'offline_trade';       // 离线贸易

/** 离线子系统验证结果 */
export interface OfflineSubsystemResult {
  /** 子系统 */
  subsystem: OfflineSubsystem;
  /** 模拟离线时长 (秒) */
  simulatedOfflineSeconds: number;
  /** 预期产出 */
  expectedOutput: number;
  /** 实际产出 */
  actualOutput: number;
  /** 是否正确 */
  correct: boolean;
  /** 偏差百分比 */
  deviationPercent: number;
}

/** 离线全系统验证结果 */
export interface OfflineFullResult {
  /** 各子系统结果 */
  subsystems: OfflineSubsystemResult[];
  /** 是否全部通过 */
  allPassed: boolean;
}

// ─────────────────────────────────────────────
// 6. 综合联调报告
// ─────────────────────────────────────────────

/** 全系统联调报告 */
export interface IntegrationReport {
  /** 报告 ID */
  id: string;
  /** 时间戳 */
  timestamp: number;
  /** 核心循环结果 */
  coreLoop: CoreLoopResult;
  /** 跨系统数据流结果 */
  crossSystemFlow: CrossSystemFlowResult;
  /** 转生循环结果 */
  rebirthCycle: RebirthCycleResult;
  /** 离线全系统结果 */
  offlineFull: OfflineFullResult;
  /** 总体是否通过 */
  overallPassed: boolean;
}
