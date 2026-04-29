/**
 * NPCTrainingSystem 单元测试
 *
 * 覆盖：training、canTraining、getTrainingCooldown、getTrainingRecords、getTrainingStats、
 *       formAlliance、isAllied、getAlliance、getAllAlliances、breakAlliance、getAllAllianceBonuses、
 *       calculateOfflineActions、getOfflineSummary、recordDialogue、getDialogueHistory、
 *       serialize/deserialize
 */
import { describe, it, expect, vi } from 'vitest';
import { NPCTrainingSystem } from '../NPCTrainingSystem';
import type { ISystemDeps } from '../../../core/types';
import {
  TRAINING_COOLDOWN,
  ALLIANCE_REQUIRED_AFFINITY,
  MAX_DIALOGUE_HISTORY,
  DIALOGUE_TRIM_TO,
} from '../NPCTrainingTypes';

function mockDeps(): ISystemDeps {
  return {
    eventBus: {
      on: vi.fn().mockReturnValue(vi.fn()),
      once: vi.fn().mockReturnValue(vi.fn()),
      emit: vi.fn(),
      off: vi.fn(),
      removeAllListeners: vi.fn(),
    },
    config: { get: vi.fn(), set: vi.fn() },
    registry: {
      register: vi.fn(),
      get: vi.fn().mockReturnValue(null),
      getAll: vi.fn().mockReturnValue(new Map()),
      has: vi.fn().mockReturnValue(false),
      unregister: vi.fn(),
    },
  } as unknown as ISystemDeps;
}

describe('NPCTrainingSystem', () => {
  function createSystem(): NPCTrainingSystem {
    const sys = new NPCTrainingSystem();
    sys.init(mockDeps());
    return sys;
  }

  // ─── 切磋系统 ──────────────────────────────

  describe('切磋系统', () => {
    it('切磋返回有效结果', () => {
      const sys = createSystem();
      const result = sys.training('npc-1', 10, 10);

      expect(result.npcId).toBe('npc-1');
      expect(['win', 'lose', 'draw']).toContain(result.outcome);
      expect(result.message).toBeDefined();
    });

    it('切磋冷却中不能再次切磋', () => {
      const sys = createSystem();
      sys.training('npc-1', 10, 10);

      expect(sys.canTraining('npc-1')).toBe(false);
      const result = sys.training('npc-1', 10, 10);
      expect(result.outcome).toBe('draw');
      expect(result.message).toContain('冷却');
    });

    it('切磋冷却倒计时', () => {
      const sys = createSystem();
      sys.training('npc-1', 10, 10);

      expect(sys.getTrainingCooldown('npc-1')).toBe(TRAINING_COOLDOWN);

      sys.update(TRAINING_COOLDOWN);
      expect(sys.canTraining('npc-1')).toBe(true);
      expect(sys.getTrainingCooldown('npc-1')).toBe(0);
    });

    it('无冷却时 canTraining 为 true', () => {
      const sys = createSystem();
      expect(sys.canTraining('npc-1')).toBe(true);
    });

    it('获取切磋记录', () => {
      const sys = createSystem();
      sys.training('npc-1', 10, 10);

      const records = sys.getTrainingRecords('npc-1');
      expect(records).toHaveLength(1);
      expect(records[0].npcId).toBe('npc-1');
    });

    it('获取全部切磋记录', () => {
      const sys = createSystem();
      sys.training('npc-1', 10, 10);
      sys.update(TRAINING_COOLDOWN);
      sys.training('npc-2', 10, 10);

      const records = sys.getTrainingRecords();
      expect(records).toHaveLength(2);
    });

    it('切磋统计', () => {
      const sys = createSystem();
      // 多次切磋以获得统计
      for (let i = 0; i < 5; i++) {
        sys.training('npc-1', 10, 10);
        sys.update(TRAINING_COOLDOWN);
      }

      const stats = sys.getTrainingStats('npc-1');
      expect(stats.total).toBe(5);
      expect(stats.wins + stats.losses + stats.draws).toBe(5);
    });
  });

  // ─── 结盟系统 ──────────────────────────────

  describe('结盟系统', () => {
    it('成功结盟', () => {
      const sys = createSystem();
      const result = sys.formAlliance('npc-1', 'def-1', ALLIANCE_REQUIRED_AFFINITY);

      expect(result.success).toBe(true);
      expect(sys.isAllied('npc-1')).toBe(true);
    });

    it('好感度不足不能结盟', () => {
      const sys = createSystem();
      const result = sys.formAlliance('npc-1', 'def-1', 50);

      expect(result.success).toBe(false);
      expect(result.reason).toContain('好感度不足');
    });

    it('已结盟不能重复结盟', () => {
      const sys = createSystem();
      sys.formAlliance('npc-1', 'def-1', ALLIANCE_REQUIRED_AFFINITY);

      const result = sys.formAlliance('npc-1', 'def-1', ALLIANCE_REQUIRED_AFFINITY);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('已经');
    });

    it('获取结盟数据', () => {
      const sys = createSystem();
      sys.formAlliance('npc-1', 'def-1', ALLIANCE_REQUIRED_AFFINITY);

      const alliance = sys.getAlliance('npc-1');
      expect(alliance).toBeDefined();
      expect(alliance!.npcId).toBe('npc-1');
      expect(alliance!.defId).toBe('def-1');
      expect(alliance!.bonuses.length).toBeGreaterThan(0);
    });

    it('获取所有结盟', () => {
      const sys = createSystem();
      sys.formAlliance('npc-1', 'def-1', ALLIANCE_REQUIRED_AFFINITY);
      sys.formAlliance('npc-2', 'def-2', ALLIANCE_REQUIRED_AFFINITY);

      expect(sys.getAllAlliances()).toHaveLength(2);
      expect(sys.getAllianceCount()).toBe(2);
    });

    it('结盟加成汇总', () => {
      const sys = createSystem();
      sys.formAlliance('npc-1', 'def-1', ALLIANCE_REQUIRED_AFFINITY);

      const bonuses = sys.getAllAllianceBonuses();
      expect(typeof bonuses).toBe('object');
      // 至少有一个加成类型
      const total = Object.values(bonuses).reduce((sum, v) => sum + v, 0);
      expect(total).toBeGreaterThan(0);
    });

    it('解除结盟', () => {
      const sys = createSystem();
      sys.formAlliance('npc-1', 'def-1', ALLIANCE_REQUIRED_AFFINITY);

      expect(sys.breakAlliance('npc-1')).toBe(true);
      expect(sys.isAllied('npc-1')).toBe(false);
    });

    it('解除不存在的结盟返回 false', () => {
      const sys = createSystem();
      expect(sys.breakAlliance('not-exist')).toBe(false);
    });

    it('结盟发出事件', () => {
      const deps = mockDeps();
      const sys = new NPCTrainingSystem();
      sys.init(deps);

      sys.formAlliance('npc-1', 'def-1', ALLIANCE_REQUIRED_AFFINITY);
      expect(deps.eventBus.emit).toHaveBeenCalledWith('npc:allianceFormed', expect.objectContaining({
        npcId: 'npc-1',
      }));
    });

    it('解除结盟发出事件', () => {
      const deps = mockDeps();
      const sys = new NPCTrainingSystem();
      sys.init(deps);

      sys.formAlliance('npc-1', 'def-1', ALLIANCE_REQUIRED_AFFINITY);
      sys.breakAlliance('npc-1');
      expect(deps.eventBus.emit).toHaveBeenCalledWith('npc:allianceBroken', expect.objectContaining({
        npcId: 'npc-1',
      }));
    });
  });

  // ─── 离线行为 ──────────────────────────────

  describe('离线行为', () => {
    it('计算离线行为', () => {
      const sys = createSystem();
      const npcs = [
        { id: 'npc-1', name: '张三', profession: 'merchant' },
        { id: 'npc-2', name: '李四', profession: 'warrior' },
      ];

      const summary = sys.calculateOfflineActions(600, npcs);

      expect(summary.offlineDuration).toBe(600);
      expect(summary.actions.length).toBeGreaterThan(0);
      expect(summary.totalResourceChanges).toBeDefined();
      expect(summary.totalAffinityChanges).toBeDefined();
    });

    it('空NPC列表无行为', () => {
      const sys = createSystem();
      const summary = sys.calculateOfflineActions(600, []);

      expect(summary.actions).toHaveLength(0);
    });

    it('离线时长为0无行为', () => {
      const sys = createSystem();
      const npcs = [{ id: 'npc-1', name: '张三', profession: 'merchant' }];
      const summary = sys.calculateOfflineActions(0, npcs);

      expect(summary.actions).toHaveLength(0);
    });

    it('获取离线摘要', () => {
      const sys = createSystem();
      expect(sys.getOfflineSummary()).toBeNull();

      const npcs = [{ id: 'npc-1', name: '张三', profession: 'merchant' }];
      sys.calculateOfflineActions(600, npcs);
      expect(sys.getOfflineSummary()).not.toBeNull();
    });

    it('清除离线摘要', () => {
      const sys = createSystem();
      const npcs = [{ id: 'npc-1', name: '张三', profession: 'merchant' }];
      sys.calculateOfflineActions(600, npcs);

      sys.clearOfflineSummary();
      expect(sys.getOfflineSummary()).toBeNull();
    });

    it('资源变化回调', () => {
      const sys = createSystem();
      const resourceCb = vi.fn();
      sys.setResourceCallback(resourceCb);

      const npcs = [{ id: 'npc-1', name: '张三', profession: 'merchant' }];
      sys.calculateOfflineActions(600, npcs);

      // 如果有资源变化，回调应被调用
      const summary = sys.getOfflineSummary();
      if (summary && Object.keys(summary.totalResourceChanges).length > 0) {
        expect(resourceCb).toHaveBeenCalled();
      }
    });
  });

  // ─── 对话历史 ──────────────────────────────

  describe('对话历史', () => {
    it('记录对话', () => {
      const sys = createSystem();
      sys.recordDialogue('npc-1', '张三', '讨论了战略', 5, '选项A');

      const history = sys.getDialogueHistory('npc-1');
      expect(history).toHaveLength(1);
      expect(history[0].summary).toBe('讨论了战略');
      expect(history[0].playerChoice).toBe('选项A');
    });

    it('获取全部对话历史', () => {
      const sys = createSystem();
      sys.recordDialogue('npc-1', '张三', '对话1', 3);
      sys.recordDialogue('npc-2', '李四', '对话2', 5);

      const history = sys.getDialogueHistory();
      expect(history).toHaveLength(2);
    });

    it('限制返回数量', () => {
      const sys = createSystem();
      for (let i = 0; i < 20; i++) {
        sys.recordDialogue('npc-1', '张三', `对话${i}`, 1);
      }

      const history = sys.getDialogueHistory('npc-1', 5);
      expect(history).toHaveLength(5);
    });

    it('获取最近对话', () => {
      const sys = createSystem();
      for (let i = 0; i < 20; i++) {
        sys.recordDialogue('npc-1', '张三', `对话${i}`, 1);
      }

      const recent = sys.getRecentDialogues(5);
      expect(recent).toHaveLength(5);
    });

    it('对话计数', () => {
      const sys = createSystem();
      sys.recordDialogue('npc-1', '张三', '对话1', 1);
      sys.recordDialogue('npc-1', '张三', '对话2', 1);
      sys.recordDialogue('npc-2', '李四', '对话3', 1);

      expect(sys.getDialogueCount('npc-1')).toBe(2);
      expect(sys.getDialogueCount()).toBe(3);
    });

    it('清除对话历史', () => {
      const sys = createSystem();
      sys.recordDialogue('npc-1', '张三', '对话1', 1);
      sys.recordDialogue('npc-2', '李四', '对话2', 1);

      sys.clearDialogueHistory('npc-1');
      expect(sys.getDialogueCount('npc-1')).toBe(0);
      expect(sys.getDialogueCount('npc-2')).toBe(1);

      sys.clearDialogueHistory();
      expect(sys.getDialogueCount()).toBe(0);
    });

    it('对话历史自动裁剪（超过 MAX 时触发）', () => {
      const sys = createSystem();
      // 记录到刚好超过 MAX_DIALOGUE_HISTORY
      for (let i = 0; i < MAX_DIALOGUE_HISTORY + 1; i++) {
        sys.recordDialogue('npc-1', '张三', `对话${i}`, 1);
      }
      // 第 201 条触发裁剪到 DIALOGUE_TRIM_TO
      expect(sys.getDialogueCount()).toBe(DIALOGUE_TRIM_TO);
    });
  });

  // ─── 序列化 ────────────────────────────────

  describe('序列化', () => {
    it('serialize/deserialize 往返一致', () => {
      const sys = createSystem();
      sys.training('npc-1', 10, 10);
      sys.formAlliance('npc-2', 'def-2', ALLIANCE_REQUIRED_AFFINITY);
      sys.recordDialogue('npc-1', '张三', '对话', 5);

      const data = sys.serialize();
      expect(data.version).toBeDefined();
      expect(data.trainingRecords.length).toBeGreaterThan(0);
      expect(data.alliances.length).toBeGreaterThan(0);
      expect(data.dialogueHistory.length).toBeGreaterThan(0);

      const sys2 = createSystem();
      sys2.deserialize(data);

      expect(sys2.getTrainingRecords()).toHaveLength(1);
      expect(sys2.isAllied('npc-2')).toBe(true);
      expect(sys2.getDialogueCount()).toBe(1);
    });

    it('deserialize 空数据', () => {
      const sys = createSystem();
      sys.deserialize({ version: 1 });

      expect(sys.getTrainingRecords()).toHaveLength(0);
      expect(sys.getAllianceCount()).toBe(0);
    });

    it('reset 清空所有状态', () => {
      const sys = createSystem();
      sys.training('npc-1', 10, 10);
      sys.formAlliance('npc-2', 'def-2', ALLIANCE_REQUIRED_AFFINITY);
      sys.recordDialogue('npc-1', '张三', '对话', 5);

      sys.reset();

      expect(sys.getTrainingRecords()).toHaveLength(0);
      expect(sys.getAllianceCount()).toBe(0);
      expect(sys.getDialogueCount()).toBe(0);
      expect(sys.getOfflineSummary()).toBeNull();
    });
  });
});
