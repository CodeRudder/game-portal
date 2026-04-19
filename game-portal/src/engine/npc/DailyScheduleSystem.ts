/**
 * NPC 日程系统
 *
 * 管理所有 NPC 的每日活动日程。根据游戏内时间自动切换 NPC 状态，
 * 不同职业有不同的日程模板。日程状态影响 NPC 的可交互性。
 *
 * 核心概念：
 * - DailySchedule：一个 NPC 的完整日程，包含多个时间段
 * - ScheduleSegment：日程中的单个时间段，定义起止时间、状态、位置
 * - 日程优先级高于 AI 自主决策
 *
 * @module engine/npc/DailyScheduleSystem
 */

import type { NPCInstance, NPCState, ScheduleItem } from './types';
import { NPCState as NPCStateEnum } from './types';
import { NPCProfession } from './types';
import type { NPCEventBus } from './NPCEventBus';

// ---------------------------------------------------------------------------
// 日程段定义
// ---------------------------------------------------------------------------

/** 日程时间段 */
export interface ScheduleSegment {
  /** 起始小时 (0-23) */
  startHour: number;
  /** 结束小时 (0-23)，如果 < startHour 表示跨天 */
  endHour: number;
  /** 该时间段的状态 */
  state: NPCState;
  /** 目标位置 X */
  targetX?: number;
  /** 目标位置 Y */
  targetY?: number;
  /** 目标建筑 ID */
  targetBuildingId?: string;
  /** 该时间段的描述 */
  label: string;
  /** 是否可交互 */
  interactable: boolean;
}

/** NPC 完整日程 */
export interface DailySchedule {
  /** 关联的 NPC 实例 ID */
  npcId: string;
  /** 日程段列表（按 startHour 排序） */
  segments: ScheduleSegment[];
}

// ---------------------------------------------------------------------------
// 各职业默认日程模板
// ---------------------------------------------------------------------------

/** 职业日程模板工厂 */
export function createProfessionSchedule(profession: NPCProfession): ScheduleSegment[] {
  switch (profession) {
    case NPCProfession.FARMER:
      return [
        { startHour: 6, endHour: 7, state: NPCStateEnum.WALKING, targetBuildingId: 'farm', label: '前往农田', interactable: true },
        { startHour: 7, endHour: 12, state: NPCStateEnum.WORKING, targetX: 5, targetY: 5, label: '在农田劳作', interactable: false },
        { startHour: 12, endHour: 14, state: NPCStateEnum.RESTING, targetX: 10, targetY: 10, label: '午间休息', interactable: true },
        { startHour: 14, endHour: 18, state: NPCStateEnum.WORKING, targetX: 5, targetY: 5, label: '下午劳作', interactable: false },
        { startHour: 18, endHour: 19, state: NPCStateEnum.WALKING, targetX: 10, targetY: 10, label: '回家', interactable: true },
        { startHour: 19, endHour: 6, state: NPCStateEnum.RESTING, targetX: 10, targetY: 10, label: '夜间休息', interactable: false },
      ];

    case NPCProfession.SOLDIER:
      return [
        { startHour: 5, endHour: 8, state: NPCStateEnum.WORKING, targetBuildingId: 'barracks', label: '晨练', interactable: false },
        { startHour: 8, endHour: 12, state: NPCStateEnum.PATROLLING, targetX: 20, targetY: 0, label: '上午巡逻', interactable: false },
        { startHour: 12, endHour: 14, state: NPCStateEnum.RESTING, targetX: 15, targetY: 15, label: '午间休息', interactable: true },
        { startHour: 14, endHour: 18, state: NPCStateEnum.PATROLLING, targetX: 0, targetY: 20, label: '下午巡逻', interactable: false },
        { startHour: 18, endHour: 20, state: NPCStateEnum.WORKING, targetBuildingId: 'barracks', label: '训练', interactable: false },
        { startHour: 20, endHour: 5, state: NPCStateEnum.RESTING, targetX: 15, targetY: 15, label: '夜间休息', interactable: false },
      ];

    case NPCProfession.MERCHANT:
      return [
        { startHour: 7, endHour: 8, state: NPCStateEnum.WALKING, targetBuildingId: 'market', label: '前往市场', interactable: true },
        { startHour: 8, endHour: 12, state: NPCStateEnum.TRADING, targetBuildingId: 'market', label: '上午营业', interactable: true },
        { startHour: 12, endHour: 14, state: NPCStateEnum.RESTING, targetX: 10, targetY: 8, label: '午间休息', interactable: true },
        { startHour: 14, endHour: 18, state: NPCStateEnum.TRADING, targetBuildingId: 'market', label: '下午营业', interactable: true },
        { startHour: 18, endHour: 19, state: NPCStateEnum.WALKING, targetX: 10, targetY: 8, label: '收摊回家', interactable: true },
        { startHour: 19, endHour: 7, state: NPCStateEnum.RESTING, targetX: 10, targetY: 8, label: '夜间休息', interactable: false },
      ];

    case NPCProfession.GENERAL:
      return [
        { startHour: 6, endHour: 9, state: NPCStateEnum.WORKING, targetBuildingId: 'headquarters', label: '处理军务', interactable: false },
        { startHour: 9, endHour: 12, state: NPCStateEnum.PATROLLING, label: '巡视领地', interactable: false },
        { startHour: 12, endHour: 14, state: NPCStateEnum.RESTING, label: '午间休息', interactable: true },
        { startHour: 14, endHour: 18, state: NPCStateEnum.WORKING, targetBuildingId: 'training_ground', label: '训练士兵', interactable: false },
        { startHour: 18, endHour: 20, state: NPCStateEnum.WALKING, targetBuildingId: 'headquarters', label: '返回指挥部', interactable: true },
        { startHour: 20, endHour: 6, state: NPCStateEnum.RESTING, label: '夜间休息', interactable: false },
      ];

    case NPCProfession.CRAFTSMAN:
      return [
        { startHour: 7, endHour: 8, state: NPCStateEnum.WALKING, targetBuildingId: 'workshop', label: '前往工坊', interactable: true },
        { startHour: 8, endHour: 12, state: NPCStateEnum.WORKING, targetBuildingId: 'workshop', label: '锻造中', interactable: false },
        { startHour: 12, endHour: 14, state: NPCStateEnum.RESTING, targetX: 8, targetY: 6, label: '午间休息', interactable: true },
        { startHour: 14, endHour: 18, state: NPCStateEnum.WORKING, targetBuildingId: 'workshop', label: '下午锻造', interactable: false },
        { startHour: 18, endHour: 19, state: NPCStateEnum.WALKING, targetX: 8, targetY: 6, label: '收工回家', interactable: true },
        { startHour: 19, endHour: 7, state: NPCStateEnum.RESTING, targetX: 8, targetY: 6, label: '夜间休息', interactable: false },
      ];

    case NPCProfession.SCHOLAR:
      return [
        { startHour: 8, endHour: 9, state: NPCStateEnum.WALKING, targetBuildingId: 'academy', label: '前往书院', interactable: true },
        { startHour: 9, endHour: 12, state: NPCStateEnum.WORKING, targetBuildingId: 'academy', label: '研读典籍', interactable: false },
        { startHour: 12, endHour: 14, state: NPCStateEnum.RESTING, targetX: 15, targetY: 10, label: '午间休息', interactable: true },
        { startHour: 14, endHour: 17, state: NPCStateEnum.WORKING, targetBuildingId: 'academy', label: '下午研读', interactable: false },
        { startHour: 17, endHour: 19, state: NPCStateEnum.WALKING, targetX: 15, targetY: 10, label: '散步', interactable: true },
        { startHour: 19, endHour: 8, state: NPCStateEnum.RESTING, targetX: 15, targetY: 10, label: '夜间休息', interactable: false },
      ];

    case NPCProfession.VILLAGER:
    default:
      return [
        { startHour: 7, endHour: 8, state: NPCStateEnum.WALKING, targetX: 12, targetY: 8, label: '出门', interactable: true },
        { startHour: 8, endHour: 10, state: NPCStateEnum.IDLE, targetX: 12, targetY: 8, label: '闲逛', interactable: true },
        { startHour: 10, endHour: 12, state: NPCStateEnum.WORKING, targetBuildingId: 'village_center', label: '做家务', interactable: false },
        { startHour: 12, endHour: 14, state: NPCStateEnum.RESTING, label: '午间休息', interactable: true },
        { startHour: 14, endHour: 16, state: NPCStateEnum.WALKING, targetX: 8, targetY: 12, label: '散步', interactable: true },
        { startHour: 16, endHour: 19, state: NPCStateEnum.IDLE, label: '闲逛', interactable: true },
        { startHour: 19, endHour: 7, state: NPCStateEnum.RESTING, label: '夜间休息', interactable: false },
      ];
  }
}

// ---------------------------------------------------------------------------
// DailyScheduleSystem
// ---------------------------------------------------------------------------

/**
 * NPC 日程系统
 *
 * 为每个注册的 NPC 维护一份日程表，根据游戏内时间自动
 * 判断当前应处于哪个日程段，并更新 NPC 状态。
 */
export class DailyScheduleSystem {
  /** NPC ID → 日程 */
  private schedules: Map<string, DailySchedule> = new Map();

  /** 事件总线 */
  private eventBus: NPCEventBus;

  constructor(eventBus: NPCEventBus) {
    this.eventBus = eventBus;
  }

  // -----------------------------------------------------------------------
  // 日程管理
  // -----------------------------------------------------------------------

  /**
   * 为 NPC 注册日程
   * @param npcId - NPC 实例 ID
   * @param segments - 日程段列表
   */
  registerSchedule(npcId: string, segments: ScheduleSegment[]): void {
    this.schedules.set(npcId, {
      npcId,
      segments: [...segments].sort((a, b) => a.startHour - b.startHour),
    });
  }

  /**
   * 为 NPC 注册基于职业的默认日程
   * @param npcId - NPC 实例 ID
   * @param profession - NPC 职业
   */
  registerProfessionSchedule(npcId: string, profession: NPCProfession): void {
    const segments = createProfessionSchedule(profession);
    this.registerSchedule(npcId, segments);
  }

  /**
   * 移除 NPC 日程
   * @param npcId - NPC 实例 ID
   */
  unregisterSchedule(npcId: string): boolean {
    return this.schedules.delete(npcId);
  }

  /**
   * 获取 NPC 日程
   * @param npcId - NPC 实例 ID
   */
  getSchedule(npcId: string): DailySchedule | undefined {
    return this.schedules.get(npcId);
  }

  // -----------------------------------------------------------------------
  // 日程查询
  // -----------------------------------------------------------------------

  /**
   * 获取指定时间的日程段
   * @param npcId - NPC 实例 ID
   * @param hour - 游戏内小时 (0-23 浮点数)
   * @returns 当前日程段，若无日程则返回 null
   */
  getCurrentSegment(npcId: string, hour: number): ScheduleSegment | null {
    const schedule = this.schedules.get(npcId);
    if (!schedule) return null;
    return this.findSegment(schedule.segments, hour);
  }

  /**
   * 判断 NPC 当前是否可交互
   * @param npcId - NPC 实例 ID
   * @param hour - 游戏内小时
   * @returns 是否可交互
   */
  isInteractable(npcId: string, hour: number): boolean {
    const segment = this.getCurrentSegment(npcId, hour);
    if (!segment) return true; // 无日程默认可交互
    return segment.interactable;
  }

  /**
   * 获取 NPC 当前日程描述
   * @param npcId - NPC 实例 ID
   * @param hour - 游戏内小时
   * @returns 日程描述文本
   */
  getActivityLabel(npcId: string, hour: number): string {
    const segment = this.getCurrentSegment(npcId, hour);
    return segment?.label ?? '空闲';
  }

  /**
   * 获取下一个日程段
   * @param npcId - NPC 实例 ID
   * @param hour - 当前游戏内小时
   * @returns 下一个日程段
   */
  getNextSegment(npcId: string, hour: number): ScheduleSegment | null {
    const schedule = this.schedules.get(npcId);
    if (!schedule || schedule.segments.length === 0) return null;

    // 找到当前段之后最近的段
    let nextSegment: ScheduleSegment | null = null;
    let minDiff = Infinity;

    for (const seg of schedule.segments) {
      let diff = seg.startHour - hour;
      if (diff <= 0) diff += 24; // 跨天
      if (diff > 0 && diff < minDiff) {
        minDiff = diff;
        nextSegment = seg;
      }
    }

    return nextSegment;
  }

  /**
   * 获取指定 NPC 整日日程
   * @param npcId - NPC 实例 ID
   * @returns 所有日程段
   */
  getFullSchedule(npcId: string): ScheduleSegment[] {
    const schedule = this.schedules.get(npcId);
    return schedule?.segments ?? [];
  }

  // -----------------------------------------------------------------------
  // 更新循环
  // -----------------------------------------------------------------------

  /**
   * 每帧更新，检查所有 NPC 日程并触发状态变更
   * @param npcs - 所有 NPC 实例
   * @param gameTime - 游戏内时间（小时 0~24）
   */
  update(npcs: NPCInstance[], gameTime: number): void {
    const hour = gameTime % 24;

    for (const npc of npcs) {
      const segment = this.getCurrentSegment(npc.id, hour);
      if (!segment) continue;

      // 只有状态不同时才切换
      if (npc.state !== segment.state) {
        const oldState = npc.state;
        npc.state = segment.state;

        this.eventBus.emit('scheduleStateChange', {
          npcId: npc.id,
          oldState,
          newState: segment.state,
          segment,
          hour,
        });
      }
    }
  }

  // -----------------------------------------------------------------------
  // 序列化
  // -----------------------------------------------------------------------

  /** 序列化所有日程数据 */
  serialize(): object {
    const data: Record<string, DailySchedule> = {};
    for (const [npcId, schedule] of this.schedules) {
      data[npcId] = { ...schedule, segments: schedule.segments.map((s) => ({ ...s })) };
    }
    return data;
  }

  /** 反序列化恢复日程数据 */
  deserialize(data: Record<string, unknown>): void {
    this.schedules.clear();
    const d = data as Record<string, DailySchedule>;
    for (const [npcId, schedule] of Object.entries(d)) {
      this.schedules.set(npcId, {
        npcId,
        segments: schedule.segments.map((s) => ({ ...s })),
      });
    }
  }

  // -----------------------------------------------------------------------
  // 内部辅助
  // -----------------------------------------------------------------------

  /**
   * 在日程段列表中查找包含指定小时的段
   */
  private findSegment(segments: ScheduleSegment[], hour: number): ScheduleSegment | null {
    for (const seg of segments) {
      if (this.hourInRange(hour, seg.startHour, seg.endHour)) {
        return seg;
      }
    }
    // 如果没找到（可能有间隙），返回最后一个段
    return segments[segments.length - 1] ?? null;
  }

  /**
   * 判断小时是否在 [start, end) 范围内（支持跨天）
   */
  private hourInRange(hour: number, start: number, end: number): boolean {
    if (start <= end) {
      return hour >= start && hour < end;
    }
    // 跨天，如 22:00 - 06:00
    return hour >= start || hour < end;
  }
}
