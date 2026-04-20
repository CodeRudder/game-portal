/**
 * DailyScheduleSystem 单元测试
 *
 * 覆盖：日程注册、时间段匹配、跨天日程、职业模板、
 * 可交互性判断、日程更新、序列化/反序列化。
 *
 * @module engine/npc/__tests__/DailyScheduleSystem.test
 */

import { NPCEventBus } from '../NPCEventBus';
import {
  DailyScheduleSystem,
  createProfessionSchedule,
} from '../DailyScheduleSystem';
import type { ScheduleSegment } from '../DailyScheduleSystem';
import { NPCProfession, NPCState } from '../types';
import type { NPCInstance } from '../types';

// ---------------------------------------------------------------------------
// 辅助函数
// ---------------------------------------------------------------------------

function createNPCInstance(id: string, state: NPCState = NPCState.IDLE): NPCInstance {
  return {
    id,
    defId: 'test_def',
    name: id,
    x: 5,
    y: 5,
    state,
    direction: 'down',
    profession: NPCProfession.FARMER,
    level: 1,
    health: 100,
    maxHealth: 100,
    currentTask: null,
    path: [],
    pathIndex: 0,
    targetId: null,
    friends: [],
    teamId: null,
    activeDialogueId: null,
    dialogueCooldown: 0,
    animFrame: 0,
    animTimer: 0,
  };
}

// ---------------------------------------------------------------------------
// 测试
// ---------------------------------------------------------------------------

describe('DailyScheduleSystem', () => {
  let eventBus: NPCEventBus;
  let system: DailyScheduleSystem;

  beforeEach(() => {
    eventBus = new NPCEventBus();
    system = new DailyScheduleSystem(eventBus);
  });

  // -----------------------------------------------------------------------
  // 日程注册
  // -----------------------------------------------------------------------

  describe('registerSchedule', () => {
    it('应能注册自定义日程', () => {
      const segments: ScheduleSegment[] = [
        { startHour: 6, endHour: 12, state: NPCState.WORKING, label: '工作', interactable: false },
        { startHour: 12, endHour: 14, state: NPCState.RESTING, label: '休息', interactable: true },
      ];
      system.registerSchedule('npc_1', segments);

      const schedule = system.getSchedule('npc_1');
      expect(schedule).toBeDefined();
      expect(schedule!.segments).toHaveLength(2);
    });

    it('注册后应按 startHour 排序', () => {
      const segments: ScheduleSegment[] = [
        { startHour: 14, endHour: 18, state: NPCState.WORKING, label: '下午', interactable: false },
        { startHour: 6, endHour: 12, state: NPCState.WORKING, label: '上午', interactable: false },
      ];
      system.registerSchedule('npc_1', segments);

      const schedule = system.getSchedule('npc_1');
      expect(schedule!.segments[0].startHour).toBe(6);
      expect(schedule!.segments[1].startHour).toBe(14);
    });
  });

  describe('registerProfessionSchedule', () => {
    it('应能为农民注册默认日程', () => {
      system.registerProfessionSchedule('npc_1', NPCProfession.FARMER);
      const schedule = system.getSchedule('npc_1');
      expect(schedule).toBeDefined();
      expect(schedule!.segments.length).toBeGreaterThan(0);
    });

    it('应能为所有职业注册日程', () => {
      const professions = Object.values(NPCProfession);
      for (const prof of professions) {
        system.registerProfessionSchedule(`npc_${prof}`, prof);
        const schedule = system.getSchedule(`npc_${prof}`);
        expect(schedule).toBeDefined();
        expect(schedule!.segments.length).toBeGreaterThan(0);
      }
    });
  });

  describe('unregisterSchedule', () => {
    it('应能移除日程', () => {
      system.registerProfessionSchedule('npc_1', NPCProfession.FARMER);
      expect(system.unregisterSchedule('npc_1')).toBe(true);
      expect(system.getSchedule('npc_1')).toBeUndefined();
    });

    it('移除不存在的日程应返回 false', () => {
      expect(system.unregisterSchedule('nonexistent')).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // 时间段匹配
  // -----------------------------------------------------------------------

  describe('getCurrentSegment', () => {
    beforeEach(() => {
      system.registerSchedule('npc_1', [
        { startHour: 6, endHour: 12, state: NPCState.WORKING, label: '上午工作', interactable: false },
        { startHour: 12, endHour: 14, state: NPCState.RESTING, label: '午休', interactable: true },
        { startHour: 14, endHour: 18, state: NPCState.WORKING, label: '下午工作', interactable: false },
        { startHour: 18, endHour: 6, state: NPCState.RESTING, label: '夜间休息', interactable: false },
      ]);
    });

    it('6:00 应匹配上午工作', () => {
      const seg = system.getCurrentSegment('npc_1', 6);
      expect(seg).not.toBeNull();
      expect(seg!.label).toBe('上午工作');
      expect(seg!.state).toBe(NPCState.WORKING);
    });

    it('10:00 应匹配上午工作', () => {
      const seg = system.getCurrentSegment('npc_1', 10);
      expect(seg!.label).toBe('上午工作');
    });

    it('12:00 应匹配午休', () => {
      const seg = system.getCurrentSegment('npc_1', 12);
      expect(seg!.label).toBe('午休');
      expect(seg!.state).toBe(NPCState.RESTING);
    });

    it('13:00 应匹配午休', () => {
      const seg = system.getCurrentSegment('npc_1', 13);
      expect(seg!.label).toBe('午休');
    });

    it('14:00 应匹配下午工作', () => {
      const seg = system.getCurrentSegment('npc_1', 14);
      expect(seg!.label).toBe('下午工作');
    });

    it('18:00 应匹配夜间休息（跨天）', () => {
      const seg = system.getCurrentSegment('npc_1', 18);
      expect(seg!.label).toBe('夜间休息');
    });

    it('22:00 应匹配夜间休息（跨天）', () => {
      const seg = system.getCurrentSegment('npc_1', 22);
      expect(seg!.label).toBe('夜间休息');
    });

    it('3:00 应匹配夜间休息（跨天）', () => {
      const seg = system.getCurrentSegment('npc_1', 3);
      expect(seg!.label).toBe('夜间休息');
    });

    it('不存在的 NPC 应返回 null', () => {
      const seg = system.getCurrentSegment('nonexistent', 10);
      expect(seg).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // 可交互性
  // -----------------------------------------------------------------------

  describe('isInteractable', () => {
    beforeEach(() => {
      system.registerSchedule('npc_1', [
        { startHour: 6, endHour: 12, state: NPCState.WORKING, label: '工作', interactable: false },
        { startHour: 12, endHour: 14, state: NPCState.RESTING, label: '休息', interactable: true },
      ]);
    });

    it('工作时应不可交互', () => {
      expect(system.isInteractable('npc_1', 8)).toBe(false);
    });

    it('休息时应可交互', () => {
      expect(system.isInteractable('npc_1', 13)).toBe(true);
    });

    it('无日程的 NPC 默认可交互', () => {
      expect(system.isInteractable('nonexistent', 10)).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // 日程描述
  // -----------------------------------------------------------------------

  describe('getActivityLabel', () => {
    it('应返回当前日程描述', () => {
      system.registerSchedule('npc_1', [
        { startHour: 6, endHour: 12, state: NPCState.WORKING, label: '锻造中', interactable: false },
      ]);
      expect(system.getActivityLabel('npc_1', 8)).toBe('锻造中');
    });

    it('无日程应返回"空闲"', () => {
      expect(system.getActivityLabel('nonexistent', 8)).toBe('空闲');
    });
  });

  // -----------------------------------------------------------------------
  // 下一个日程段
  // -----------------------------------------------------------------------

  describe('getNextSegment', () => {
    beforeEach(() => {
      system.registerSchedule('npc_1', [
        { startHour: 6, endHour: 12, state: NPCState.WORKING, label: '上午', interactable: false },
        { startHour: 12, endHour: 14, state: NPCState.RESTING, label: '午休', interactable: true },
        { startHour: 14, endHour: 18, state: NPCState.WORKING, label: '下午', interactable: false },
      ]);
    });

    it('10:00 的下一个应是午休', () => {
      const next = system.getNextSegment('npc_1', 10);
      expect(next).not.toBeNull();
      expect(next!.label).toBe('午休');
    });

    it('13:00 的下一个应是下午工作', () => {
      const next = system.getNextSegment('npc_1', 13);
      expect(next).not.toBeNull();
      expect(next!.label).toBe('下午');
    });

    it('无日程应返回 null', () => {
      expect(system.getNextSegment('nonexistent', 10)).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // 整日日程
  // -----------------------------------------------------------------------

  describe('getFullSchedule', () => {
    it('应返回所有日程段', () => {
      system.registerProfessionSchedule('npc_1', NPCProfession.FARMER);
      const full = system.getFullSchedule('npc_1');
      expect(full.length).toBeGreaterThan(0);
    });

    it('无日程应返回空数组', () => {
      expect(system.getFullSchedule('nonexistent')).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // 更新循环
  // -----------------------------------------------------------------------

  describe('update', () => {
    it('应根据日程更新 NPC 状态', () => {
      const npc = createNPCInstance('npc_1', NPCState.IDLE);
      system.registerSchedule('npc_1', [
        { startHour: 6, endHour: 12, state: NPCState.WORKING, label: '工作', interactable: false },
      ]);

      system.update([npc], 8);
      expect(npc.state).toBe(NPCState.WORKING);
    });

    it('状态未变时不应触发事件', () => {
      const npc = createNPCInstance('npc_1', NPCState.WORKING);
      system.registerSchedule('npc_1', [
        { startHour: 6, endHour: 12, state: NPCState.WORKING, label: '工作', interactable: false },
      ]);

      const listener = jest.fn();
      eventBus.on('scheduleStateChange', listener);

      system.update([npc], 8);
      expect(listener).not.toHaveBeenCalled();
    });

    it('状态变化时应触发事件', () => {
      const npc = createNPCInstance('npc_1', NPCState.IDLE);
      system.registerSchedule('npc_1', [
        { startHour: 6, endHour: 12, state: NPCState.WORKING, label: '工作', interactable: false },
      ]);

      const listener = jest.fn();
      eventBus.on('scheduleStateChange', listener);

      system.update([npc], 8);
      expect(listener).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // 职业模板
  // -----------------------------------------------------------------------

  describe('createProfessionSchedule', () => {
    it('农民日程应包含工作和休息', () => {
      const segments = createProfessionSchedule(NPCProfession.FARMER);
      const hasWork = segments.some((s) => s.state === NPCState.WORKING);
      const hasRest = segments.some((s) => s.state === NPCState.RESTING);
      expect(hasWork).toBe(true);
      expect(hasRest).toBe(true);
    });

    it('士兵日程应包含巡逻', () => {
      const segments = createProfessionSchedule(NPCProfession.SOLDIER);
      const hasPatrol = segments.some((s) => s.state === NPCState.PATROLLING);
      expect(hasPatrol).toBe(true);
    });

    it('商人日程应包含交易', () => {
      const segments = createProfessionSchedule(NPCProfession.MERCHANT);
      const hasTrade = segments.some((s) => s.state === NPCState.TRADING);
      expect(hasTrade).toBe(true);
    });

    it('所有职业日程应覆盖 24 小时', () => {
      for (const prof of Object.values(NPCProfession)) {
        const segments = createProfessionSchedule(prof);
        // 每个日程段都应有标签
        for (const seg of segments) {
          expect(seg.label).toBeTruthy();
          expect(seg.startHour).toBeGreaterThanOrEqual(0);
          expect(seg.startHour).toBeLessThan(24);
        }
      }
    });
  });

  // -----------------------------------------------------------------------
  // 序列化
  // -----------------------------------------------------------------------

  describe('serialize / deserialize', () => {
    it('应能序列化和反序列化日程数据', () => {
      system.registerProfessionSchedule('npc_1', NPCProfession.FARMER);
      system.registerProfessionSchedule('npc_2', NPCProfession.SOLDIER);

      const data = system.serialize();

      const newSystem = new DailyScheduleSystem(eventBus);
      newSystem.deserialize(data as Record<string, unknown>);

      expect(newSystem.getSchedule('npc_1')).toBeDefined();
      expect(newSystem.getSchedule('npc_2')).toBeDefined();
      expect(newSystem.getSchedule('npc_1')!.segments.length).toBeGreaterThan(0);
    });

    it('反序列化后应能正确查询', () => {
      system.registerSchedule('npc_1', [
        { startHour: 6, endHour: 12, state: NPCState.WORKING, label: '工作', interactable: false },
      ]);

      const data = system.serialize();
      const newSystem = new DailyScheduleSystem(eventBus);
      newSystem.deserialize(data as Record<string, unknown>);

      const seg = newSystem.getCurrentSegment('npc_1', 8);
      expect(seg).not.toBeNull();
      expect(seg!.label).toBe('工作');
    });
  });
});
