/**
 * 引擎层 — 巡逻路径计算器
 *
 * 从 NPCPatrolSystem 拆分出的巡逻路径移动计算逻辑：
 *   - 单个 NPC 巡逻移动更新
 *   - 路径点到达检测与折返
 *   - 插值移动计算
 *
 * @module engine/npc/PatrolPathCalculator
 */

import type { NPCId, RegionId, GridPosition } from '../../core/npc';
import type { PatrolPathId, PatrolPath } from '../../core/npc';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 到达路径点的距离阈值（格） */
const ARRIVAL_THRESHOLD = 0.1;

/** 折返时暂停时间（秒） */
const TURN_PAUSE_DURATION = 1.0;

// ─────────────────────────────────────────────
// 内部巡逻状态
// ─────────────────────────────────────────────

/** 运行时巡逻状态 */
export interface RuntimePatrolState {
  npcId: NPCId;
  patrolPathId: PatrolPathId;
  currentWaypointIndex: number;
  direction: 1 | -1;
  exactPosition: { x: number; y: number };
  isPatrolling: boolean;
  pauseTimer: number;
}

/** 移动回调类型 */
export type MoveCallback = (npcId: string, x: number, y: number) => void;

/** 事件发射回调类型 */
export type EventEmitCallback = (event: string, data: unknown) => void;

// ─────────────────────────────────────────────
// 巡逻路径计算器
// ─────────────────────────────────────────────

/**
 * 巡逻路径计算器
 *
 * 负责计算 NPC 沿巡逻路径的移动，包括：
 * - 暂停/恢复状态管理
 * - 路径点到达检测
 * - 折返逻辑
 * - 插值移动
 */
export class PatrolPathCalculator {
  /**
   * 更新单个 NPC 的巡逻
   *
   * 移动逻辑：
   * 1. 如果暂停中，倒计时恢复
   * 2. 如果已在当前路径点上，前进到下一个
   * 3. 向目标路径点移动（插值）
   * 4. 到达后不立即前进，下一帧再前进
   *
   * @param npcId - NPC ID
   * @param state - 运行时巡逻状态（会被就地修改）
   * @param path - 巡逻路径
   * @param dt - 帧间隔时间（秒）
   * @param moveCallback - NPC 位置更新回调
   * @param emitEvent - 事件发射回调
   */
  updateSinglePatrol(
    npcId: NPCId,
    state: RuntimePatrolState,
    path: PatrolPath,
    dt: number,
    moveCallback?: MoveCallback,
    emitEvent?: EventEmitCallback,
  ): void {
    // 阶段1: 暂停状态
    if (!state.isPatrolling) {
      if (state.pauseTimer > 0) {
        state.pauseTimer -= dt;
        if (state.pauseTimer <= 0) {
          state.pauseTimer = 0;
          state.isPatrolling = true;
        }
      }
      return;
    }

    let remainingDt = dt;

    // 循环处理：一帧内可能到达多个路径点
    for (let iter = 0; iter < 100 && remainingDt > 0 && state.isPatrolling; iter++) {
      // 计算下一个目标路径点
      const nextIdx = state.currentWaypointIndex + state.direction;

      // 已在端点，折返并暂停
      if (nextIdx >= path.waypoints.length || nextIdx < 0) {
        state.direction = (state.direction === 1 ? -1 : 1) as 1 | -1;
        state.isPatrolling = false;
        state.pauseTimer = TURN_PAUSE_DURATION;
        emitEvent?.('npc:patrol_turned', {
          npcId: state.npcId,
          direction: state.direction,
          waypointIndex: state.currentWaypointIndex,
        });
        return;
      }

      const targetWp = path.waypoints[nextIdx];
      const dx = targetWp.x - state.exactPosition.x;
      const dy = targetWp.y - state.exactPosition.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // 已在目标路径点上
      if (distance <= ARRIVAL_THRESHOLD) {
        state.exactPosition.x = targetWp.x;
        state.exactPosition.y = targetWp.y;
        state.currentWaypointIndex = nextIdx;
        moveCallback?.(npcId, targetWp.x, targetWp.y);
        emitEvent?.('npc:patrol_waypoint_reached', {
          npcId: state.npcId,
          waypointIndex: nextIdx,
          pathId: state.patrolPathId,
        });
        continue;
      }

      // 计算移动距离
      const moveDistance = path.speed * remainingDt;

      // 本帧能到达目标路径点
      if (moveDistance >= distance) {
        state.exactPosition.x = targetWp.x;
        state.exactPosition.y = targetWp.y;
        state.currentWaypointIndex = nextIdx;
        moveCallback?.(npcId, targetWp.x, targetWp.y);
        emitEvent?.('npc:patrol_waypoint_reached', {
          npcId: state.npcId,
          waypointIndex: nextIdx,
          pathId: state.patrolPathId,
        });
        // 消耗掉移动到该路径点所用的时间
        remainingDt -= distance / path.speed;
        continue;
      }

      // 正常插值移动（未到达路径点）
      const ratio = moveDistance / distance;
      state.exactPosition.x += dx * ratio;
      state.exactPosition.y += dy * ratio;
      moveCallback?.(npcId, state.exactPosition.x, state.exactPosition.y);
      break;
    }
  }

  /**
   * 更新所有巡逻 NPC
   *
   * @param patrolStates - 所有 NPC 的巡逻状态
   * @param paths - 所有注册的巡逻路径
   * @param dt - 帧间隔时间（秒）
   * @param moveCallback - NPC 位置更新回调
   * @param emitEvent - 事件发射回调
   */
  updateAllPatrols(
    patrolStates: Map<NPCId, RuntimePatrolState>,
    paths: Map<PatrolPathId, PatrolPath>,
    dt: number,
    moveCallback?: MoveCallback,
    emitEvent?: EventEmitCallback,
  ): void {
    for (const [npcId, state] of patrolStates) {
      const path = paths.get(state.patrolPathId);
      if (!path) continue;
      this.updateSinglePatrol(npcId, state, path, dt, moveCallback, emitEvent);
    }
  }
}
