/**
 * NPC 系统单元测试
 *
 * 覆盖：NPC 生成、状态转换、日程系统、NPC 间交谈、
 * 组队系统、对话系统、序列化/反序列化。
 *
 * @module engine/npc/__tests__/NPC.test
 */

import {
  NPCManager,
  NPCProfession,
  NPCState,
  NPCEventBus,
} from '../index';
import type { NPCDef, NPCInstance, NPCTask } from '../types';

// ---------------------------------------------------------------------------
// 测试用 NPC 定义
// ---------------------------------------------------------------------------

function createFarmerDef(): NPCDef {
  return {
    id: 'farmer_01',
    profession: NPCProfession.FARMER,
    name: '农夫张三',
    color: '#4caf50',
    iconEmoji: '👨‍🌾',
    speed: 1.5,
    workCycleMinutes: 10,
    dialogues: [
      {
        id: 'dlg_farmer_greet',
        trigger: 'click',
        lines: [
          {
            speaker: 'npc',
            text: '你好，欢迎来到我的农田！',
            choices: [
              { text: '你好，最近收成如何？', nextLineIndex: 1 },
              { text: '再见！' },
            ],
          },
          {
            speaker: 'npc',
            text: '今年收成不错，感谢关心！',
          },
        ],
      },
      {
        id: 'dlg_farmer_proximity',
        trigger: 'proximity',
        lines: [
          { speaker: 'npc', text: '路过的朋友，歇歇脚吧！' },
        ],
      },
    ],
    schedule: [
      { hour: 6, state: NPCState.WORKING, targetX: 5, targetY: 5 },
      { hour: 12, state: NPCState.RESTING, targetX: 10, targetY: 10 },
      { hour: 14, state: NPCState.WORKING, targetX: 5, targetY: 5 },
      { hour: 18, state: NPCState.RESTING, targetX: 10, targetY: 10 },
      { hour: 22, state: NPCState.RESTING, targetX: 10, targetY: 10 },
    ],
  };
}

function createSoldierDef(): NPCDef {
  return {
    id: 'soldier_01',
    profession: NPCProfession.SOLDIER,
    name: '士兵李四',
    color: '#f44336',
    iconEmoji: '💂',
    speed: 2.0,
    workCycleMinutes: 8,
    dialogues: [],
    schedule: [
      { hour: 6, state: NPCState.PATROLLING, targetX: 20, targetY: 0 },
      { hour: 12, state: NPCState.RESTING, targetX: 15, targetY: 15 },
      { hour: 14, state: NPCState.PATROLLING, targetX: 0, targetY: 20 },
      { hour: 20, state: NPCState.RESTING, targetX: 15, targetY: 15 },
    ],
  };
}

function createVillagerDef(): NPCDef {
  return {
    id: 'villager_01',
    profession: NPCProfession.VILLAGER,
    name: '村民王五',
    color: '#9e9e9e',
    iconEmoji: '🧑',
    speed: 1.0,
    workCycleMinutes: 15,
    dialogues: [
      {
        id: 'dlg_villager_click',
        trigger: 'click',
        lines: [
          { speaker: 'npc', text: '你好呀，今天天气不错！' },
        ],
      },
    ],
    schedule: [
      { hour: 8, state: NPCState.IDLE },
      { hour: 22, state: NPCState.RESTING },
    ],
  };
}

// ---------------------------------------------------------------------------
// 测试
// ---------------------------------------------------------------------------

describe('NPC 系统', () => {
  let manager: NPCManager;

  beforeEach(() => {
    manager = new NPCManager();
    manager.registerDef(createFarmerDef());
    manager.registerDef(createSoldierDef());
    manager.registerDef(createVillagerDef());
    // general 定义（组队系统测试需要）
    manager.registerDef({
      id: 'general',
      profession: NPCProfession.GENERAL,
      name: '将军王五',
      color: '#ffd700',
      iconEmoji: '⚔️',
      speed: 2.0,
      workCycleMinutes: 10,
      dialogues: [],
      schedule: [
        { hour: 6, state: NPCState.PATROLLING, targetX: 5, targetY: 5 },
        { hour: 18, state: NPCState.RESTING, targetX: 10, targetY: 10 },
      ],
    });
  });

  // -----------------------------------------------------------------------
  // NPC 生成
  // -----------------------------------------------------------------------

  describe('NPC 生成', () => {
    it('应能生成单个 NPC 实例', () => {
      const npc = manager.spawnNPC('farmer_01', 5, 5);

      expect(npc).toBeDefined();
      expect(npc.defId).toBe('farmer_01');
      expect(npc.name).toBe('农夫张三');
      expect(npc.x).toBe(5);
      expect(npc.y).toBe(5);
      expect(npc.state).toBe(NPCState.IDLE);
      expect(npc.profession).toBe(NPCProfession.FARMER);
      expect(npc.level).toBe(1);
      expect(npc.health).toBe(100);
      expect(npc.maxHealth).toBe(100);
      expect(npc.friends).toEqual([]);
      expect(npc.teamId).toBeNull();
    });

    it('应能使用自定义名称生成 NPC', () => {
      const npc = manager.spawnNPC('farmer_01', 0, 0, '老张');
      expect(npc.name).toBe('老张');
    });

    it('应能批量生成 NPC', () => {
      const npcs = manager.spawnNPCs([
        { defId: 'farmer_01', x: 1, y: 1 },
        { defId: 'soldier_01', x: 2, y: 2 },
        { defId: 'villager_01', x: 3, y: 3 },
      ]);

      expect(npcs).toHaveLength(3);
      expect(npcs[0].profession).toBe(NPCProfession.FARMER);
      expect(npcs[1].profession).toBe(NPCProfession.SOLDIER);
      expect(npcs[2].profession).toBe(NPCProfession.VILLAGER);
    });

    it('使用不存在的定义 ID 应抛出错误', () => {
      expect(() => manager.spawnNPC('nonexistent', 0, 0)).toThrow(
        'NPC definition not found: nonexistent',
      );
    });

    it('应能通过 getNPC 获取 NPC', () => {
      const npc = manager.spawnNPC('farmer_01', 5, 5);
      const found = manager.getNPC(npc.id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(npc.id);
    });

    it('应能通过 getAllNPCs 获取所有 NPC', () => {
      manager.spawnNPC('farmer_01', 0, 0);
      manager.spawnNPC('soldier_01', 1, 1);
      const all = manager.getAllNPCs();
      expect(all).toHaveLength(2);
    });
  });

  // -----------------------------------------------------------------------
  // 状态转换
  // -----------------------------------------------------------------------

  describe('状态转换', () => {
    it('NPC 初始状态应为 IDLE', () => {
      const npc = manager.spawnNPC('farmer_01', 5, 5);
      expect(npc.state).toBe(NPCState.IDLE);
    });

    it('状态变更应触发 npcStateChange 事件', () => {
      const npc = manager.spawnNPC('farmer_01', 5, 5);
      const listener = jest.fn();
      manager.on('npcStateChange', listener);

      // 模拟更新，让日程触发状态变更
      manager.update(0.016, 6); // 游戏时间 6:00 — 应该开始工作

      expect(listener).toHaveBeenCalled();
    });

    it('应能通过 removeNPC 移除 NPC', () => {
      const npc = manager.spawnNPC('farmer_01', 5, 5);
      const removed = manager.removeNPC(npc.id);
      expect(removed).toBe(true);
      expect(manager.getNPC(npc.id)).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // 日程系统
  // -----------------------------------------------------------------------

  describe('日程系统', () => {
    it('游戏时间 6:00 时农民应切换到 WORKING', () => {
      const npc = manager.spawnNPC('farmer_01', 5, 5);

      // 初始 IDLE，更新到 6:00
      manager.update(0.016, 6);
      expect(npc.state).toBe(NPCState.WORKING);
    });

    it('游戏时间 12:00 时农民应切换到 RESTING', () => {
      const npc = manager.spawnNPC('farmer_01', 5, 5);

      manager.update(0.016, 12);
      expect(npc.state).toBe(NPCState.RESTING);
    });

    it('游戏时间 6:00 时士兵应切换到 PATROLLING', () => {
      const npc = manager.spawnNPC('soldier_01', 10, 10);

      manager.update(0.016, 6);
      expect(npc.state).toBe(NPCState.PATROLLING);
    });
  });

  // -----------------------------------------------------------------------
  // NPC 间交互
  // -----------------------------------------------------------------------

  describe('NPC 间交互', () => {
    it('应能获取附近 NPC', () => {
      const npc1 = manager.spawnNPC('farmer_01', 5, 5);
      manager.spawnNPC('villager_01', 6, 6); // 距离 ~1.4，在 range=3 内
      manager.spawnNPC('soldier_01', 20, 20); // 距离远，不在范围内

      const nearby = manager.getNearbyNPCs(5, 5, 3);
      expect(nearby.length).toBe(2); // npc1 + villager
    });

    it('NPC 间交谈应触发 npcChat 事件', () => {
      manager.spawnNPC('farmer_01', 5, 5);
      manager.spawnNPC('villager_01', 5, 6);

      const chatListener = jest.fn();
      manager.on('npcChat', chatListener);

      // 多次更新增加触发概率
      for (let i = 0; i < 200; i++) {
        manager.update(0.016, 8);
      }

      // 至少触发过一次交谈
      expect(chatListener).toHaveBeenCalled();
      const call = chatListener.mock.calls[0];
      expect(call[2]).toBeDefined(); // topic
    });
  });

  // -----------------------------------------------------------------------
  // 组队系统
  // -----------------------------------------------------------------------

  describe('组队系统', () => {
    it('应能组建团队', () => {
      const leader = manager.spawnNPC('general', 5, 5) ?? manager.spawnNPC('soldier_01', 5, 5);
      const member1 = manager.spawnNPC('soldier_01', 6, 5);
      const member2 = manager.spawnNPC('soldier_01', 7, 5);

      // 重新用 soldier_01 定义
      const leaderNpc = manager.spawnNPC('soldier_01', 5, 5);

      const task: NPCTask = {
        id: 'task_1',
        type: 'patrol',
        targetX: 10,
        targetY: 10,
        progress: 0,
        duration: 60,
      };

      const team = manager.formTeam(leaderNpc.id, [member1.id, member2.id], task);

      expect(team).toBeDefined();
      expect(team.leaderId).toBe(leaderNpc.id);
      expect(team.memberIds).toHaveLength(3);
      expect(team.formed).toBe(true);

      // 检查成员的 teamId 已设置
      expect(leaderNpc.teamId).toBe(team.id);
      expect(member1.teamId).toBe(team.id);
      expect(member2.teamId).toBe(team.id);
    });

    it('应能解散团队', () => {
      const npc1 = manager.spawnNPC('soldier_01', 5, 5);
      const npc2 = manager.spawnNPC('soldier_01', 6, 5);

      const task: NPCTask = {
        id: 'task_2',
        type: 'patrol',
        progress: 0,
        duration: 30,
      };

      const team = manager.formTeam(npc1.id, [npc2.id], task);
      manager.disbandTeam(team.id);

      expect(npc1.teamId).toBeNull();
      expect(npc2.teamId).toBeNull();
    });

    it('组队应触发 npcCollaborate 事件', () => {
      const npc1 = manager.spawnNPC('soldier_01', 5, 5);
      const npc2 = manager.spawnNPC('soldier_01', 6, 5);

      const listener = jest.fn();
      manager.on('npcCollaborate', listener);

      const task: NPCTask = {
        id: 'task_3',
        type: 'patrol',
        progress: 0,
        duration: 30,
      };

      manager.formTeam(npc1.id, [npc2.id], task);
      expect(listener).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // 对话系统
  // -----------------------------------------------------------------------

  describe('对话系统', () => {
    it('应能通过点击触发对话', () => {
      const npc = manager.spawnNPC('farmer_01', 5, 5);

      const dialogue = manager.startDialogue(npc.id, 'click');

      expect(dialogue).toBeDefined();
      expect(dialogue!.id).toBe('dlg_farmer_greet');
      expect(dialogue!.lines).toHaveLength(2);
      expect(dialogue!.lines[0].text).toBe('你好，欢迎来到我的农田！');
    });

    it('应能通过接近触发对话', () => {
      const npc = manager.spawnNPC('farmer_01', 5, 5);

      const dialogue = manager.startDialogue(npc.id, 'proximity');
      expect(dialogue).toBeDefined();
      expect(dialogue!.id).toBe('dlg_farmer_proximity');
    });

    it('对话期间 NPC 应为 TALKING 状态', () => {
      const npc = manager.spawnNPC('farmer_01', 5, 5);
      manager.startDialogue(npc.id, 'click');
      expect(npc.state).toBe(NPCState.TALKING);
    });

    it('应能选择对话选项', () => {
      const npc = manager.spawnNPC('farmer_01', 5, 5);
      manager.startDialogue(npc.id, 'click');

      // 选择第一个选项："你好，最近收成如何？"
      const nextLine = manager.makeDialogueChoice(npc.id, 0);
      expect(nextLine).toBeDefined();
      expect(nextLine!.text).toBe('今年收成不错，感谢关心！');
    });

    it('选择最后一个选项应结束对话', () => {
      const npc = manager.spawnNPC('farmer_01', 5, 5);
      manager.startDialogue(npc.id, 'click');

      // 选择第二个选项："再见！"（无 nextLineIndex，结束对话）
      const result = manager.makeDialogueChoice(npc.id, 1);
      expect(result).toBeNull();
      expect(npc.activeDialogueId).toBeNull();
      expect(npc.state).toBe(NPCState.IDLE);
    });

    it('对话冷却期间不能再次对话', () => {
      const npc = manager.spawnNPC('farmer_01', 5, 5);
      manager.startDialogue(npc.id, 'click');
      manager.makeDialogueChoice(npc.id, 1); // 结束对话

      // 冷却中
      const result = manager.startDialogue(npc.id, 'click');
      expect(result).toBeNull();
    });

    it('不存在的 NPC 对话应返回 null', () => {
      const result = manager.startDialogue('nonexistent', 'click');
      expect(result).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // 序列化 / 反序列化
  // -----------------------------------------------------------------------

  describe('序列化 / 反序列化', () => {
    it('应能序列化和反序列化 NPC 状态', () => {
      const npc = manager.spawnNPC('farmer_01', 5, 5, '老张');
      manager.update(0.016, 6); // 切换到 WORKING

      const data = manager.serialize();

      // 创建新 manager 并恢复
      const newManager = new NPCManager();
      newManager.registerDef(createFarmerDef());
      newManager.deserialize(data as Record<string, unknown>);

      const restored = newManager.getNPC(npc.id);
      expect(restored).toBeDefined();
      expect(restored!.name).toBe('老张');
      expect(restored!.x).toBe(5);
      expect(restored!.y).toBe(5);
      expect(restored!.defId).toBe('farmer_01');
    });

    it('反序列化后应能继续更新', () => {
      const npc = manager.spawnNPC('farmer_01', 5, 5);
      const data = manager.serialize();

      const newManager = new NPCManager();
      newManager.registerDef(createFarmerDef());
      newManager.deserialize(data as Record<string, unknown>);

      // 应该不报错
      expect(() => newManager.update(0.016, 6)).not.toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // 事件总线
  // -----------------------------------------------------------------------

  describe('NPCEventBus', () => {
    it('应能注册和触发事件', () => {
      const bus = new NPCEventBus();
      const listener = jest.fn();
      bus.on('test', listener);
      bus.emit('test', 'arg1', 'arg2');

      expect(listener).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('应能注销事件', () => {
      const bus = new NPCEventBus();
      const listener = jest.fn();
      bus.on('test', listener);
      bus.off('test', listener);
      bus.emit('test');

      expect(listener).not.toHaveBeenCalled();
    });

    it('应能清除所有监听器', () => {
      const bus = new NPCEventBus();
      const listener = jest.fn();
      bus.on('test', listener);
      bus.clear();
      bus.emit('test');

      expect(listener).not.toHaveBeenCalled();
    });

    it('监听器错误不应影响其他监听器', () => {
      const bus = new NPCEventBus();
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const goodListener = jest.fn();

      bus.on('test', () => { throw new Error('test error'); });
      bus.on('test', goodListener);
      bus.emit('test');

      expect(goodListener).toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });
});
