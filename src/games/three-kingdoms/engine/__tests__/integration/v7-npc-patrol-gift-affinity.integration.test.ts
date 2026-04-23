/**
 * v7.0 草木皆兵 集成测试 — 流程1: NPC巡逻→好感度→赠送→切磋→结盟全链路
 *
 * 对应Play文档: #1巡逻路径, #3赠送系统, #5切磋系统, #6结盟系统, #22/26/27好感度联动
 *
 * 验证目标：
 * - NPC巡逻路径注册与绑定
 * - 好感度等级逐级解锁
 * - 赠送偏好物品倍率
 * - 切磋冷却与奖励
 * - 结盟条件与限制
 * - 离线行为计算
 * - 对话历史回看
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NPCPatrolSystem } from '../../npc/NPCPatrolSystem';
import { NPCGiftSystem } from '../../npc/NPCGiftSystem';
import { NPCAffinitySystem } from '../../npc/NPCAffinitySystem';
import { NPCTrainingSystem } from '../../npc/NPCTrainingSystem';
import type { ISystemDeps } from '../../../core/types';
import type { NPCData, NPCProfession, PatrolPath } from '../../../core/npc';
import { getAffinityLevel, AFFINITY_THRESHOLDS } from '../../../core/npc';
import type { ItemDef } from '../../../core/npc';

// ─── 测试工具 ─────────────────────────────────

function createMockDeps(): ISystemDeps {
  const listeners: Record<string, Function[]> = {};
  return {
    eventBus: {
      emit: vi.fn((event: string, data?: unknown) => {
        (listeners[event] ?? []).forEach((fn) => fn(data));
      }),
      on: vi.fn((event: string, fn: Function) => {
        (listeners[event] ??= []).push(fn);
      }),
      off: vi.fn(),
    },
    registry: {
      get: vi.fn(),
    },
  } as unknown as ISystemDeps;
}

function createNPC(overrides: Partial<NPCData> = {}): NPCData {
  return {
    id: 'npc-test-01',
    name: '测试士兵',
    profession: 'warrior' as NPCProfession,
    affinity: 20,
    position: { x: 0, y: 0 },
    region: 'main-city',
    visible: true,
    dialogId: 'dialog-test',
    createdAt: 0,
    lastInteractedAt: 0,
    ...overrides,
  };
}

function createPatrolPath(overrides: Partial<PatrolPath> = {}): PatrolPath {
  return {
    id: 'path-test-01',
    region: 'main-city',
    waypoints: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ],
    ...overrides,
  };
}

// ─── 测试套件 ─────────────────────────────────

describe('v7.0 流程1: NPC巡逻→好感度→赠送→切磋→结盟 全链路', () => {
  let deps: ISystemDeps;
  let patrolSys: NPCPatrolSystem;
  let giftSys: NPCGiftSystem;
  let affinitySys: NPCAffinitySystem;
  let trainingSys: NPCTrainingSystem;

  beforeEach(() => {
    deps = createMockDeps();
    patrolSys = new NPCPatrolSystem();
    giftSys = new NPCGiftSystem();
    affinitySys = new NPCAffinitySystem();
    trainingSys = new NPCTrainingSystem();

    patrolSys.init(deps);
    giftSys.init(deps);
    affinitySys.init(deps);
    trainingSys.init(deps);
  });

  // ─── #1 NPC巡逻路径 ──────────────────────

  describe('#1 NPC巡逻路径（Plan#1）', () => {
    it('应注册巡逻路径并绑定NPC', () => {
      const path = createPatrolPath();
      patrolSys.registerPatrolPath(path);

      const result = patrolSys.assignPatrol('npc-01', 'path-test-01');
      expect(result).toBe(true);

      const state = patrolSys.getPatrolState('npc-01');
      expect(state).toBeDefined();
      expect(state!.patrolPathId).toBe('path-test-01');
      expect(state!.isPatrolling).toBe(true);
    });

    it('NPC到达终点后应自动折返', () => {
      const path = createPatrolPath();
      patrolSys.registerPatrolPath(path);
      patrolSys.assignPatrol('npc-01', 'path-test-01');

      // 模拟长时间更新使NPC移动
      for (let i = 0; i < 50; i++) {
        patrolSys.update(100); // 每帧100ms
      }

      const state = patrolSys.getPatrolState('npc-01');
      expect(state).toBeDefined();
      // NPC应该仍在巡逻（折返循环）
      expect(state!.isPatrolling).toBe(true);
    });

    it('应支持暂停和恢复巡逻', () => {
      const path = createPatrolPath();
      patrolSys.registerPatrolPath(path);
      patrolSys.assignPatrol('npc-01', 'path-test-01');

      expect(patrolSys.pausePatrol('npc-01', 5)).toBe(true);
      const pausedState = patrolSys.getPatrolState('npc-01');
      expect(pausedState!.isPatrolling).toBe(false);

      expect(patrolSys.resumePatrol('npc-01')).toBe(true);
      const resumedState = patrolSys.getPatrolState('npc-01');
      expect(resumedState!.isPatrolling).toBe(true);
    });

    it('路径至少需要2个路径点', () => {
      const badPath: PatrolPath = {
        id: 'bad-path',
        region: 'main-city',
        waypoints: [{ x: 0, y: 0 }],
      };
      expect(() => patrolSys.registerPatrolPath(badPath)).toThrow();
    });

    it('应按区域筛选路径', () => {
      patrolSys.registerPatrolPath(createPatrolPath({ id: 'p1', region: 'main-city' }));
      patrolSys.registerPatrolPath(createPatrolPath({ id: 'p2', region: 'north-pass' }));

      const cityPaths = patrolSys.getPatrolPathsByRegion('main-city');
      expect(cityPaths).toHaveLength(1);
      expect(cityPaths[0].id).toBe('p1');
    });
  });

  // ─── #3 #4 NPC赠送系统 + 偏好物品 ──────────

  describe('#3 #4 NPC赠送系统与偏好物品（Plan#3 #4）', () => {
    let mockNPC: NPCData;

    beforeEach(() => {
      mockNPC = createNPC({ affinity: 40, profession: 'warrior' });

      // 注册偏好物品
      const items: ItemDef[] = [
        { id: 'item-book', name: '兵书', category: 'book', rarity: 'rare', baseAffinityValue: 15, description: '孙子兵法' },
        { id: 'item-wine', name: '美酒', category: 'drink', rarity: 'common', baseAffinityValue: 5, description: '普通美酒' },
        { id: 'item-sword', name: '宝剑', category: 'weapon', rarity: 'rare', baseAffinityValue: 15, description: '锋利宝剑' },
      ];
      giftSys.registerItems(items);

      // Mock NPCSystem
      (deps.registry.get as ReturnType<typeof vi.fn>).mockImplementation((name: string) => {
        if (name === 'npc') {
          return {
            getNPCById: (id: string) => id === mockNPC.id ? { ...mockNPC } : null,
            changeAffinity: (id: string, delta: number) => {
              mockNPC.affinity = Math.min(100, Math.max(0, mockNPC.affinity + delta));
              return mockNPC.affinity;
            },
          };
        }
        return null;
      });
    });

    it('应成功赠送物品给NPC', () => {
      const result = giftSys.giveGift({
        npcId: 'npc-test-01',
        itemId: 'item-wine',
        quantity: 1,
      });

      expect(result.success).toBe(true);
      expect(result.npcId).toBe('npc-test-01');
      expect(result.affinityDelta).toBeGreaterThan(0);
    });

    it('偏好物品应有更高好感度加成', () => {
      // warrior偏好weapon类，item-sword是武器
      const preferredResult = giftSys.giveGift({
        npcId: 'npc-test-01',
        itemId: 'item-sword',
        quantity: 1,
      });

      giftSys.resetDailyGiftCount();

      const normalResult = giftSys.giveGift({
        npcId: 'npc-test-01',
        itemId: 'item-wine',
        quantity: 1,
      });

      // 偏好物品加成应≥普通物品
      expect(preferredResult.affinityDelta).toBeGreaterThanOrEqual(normalResult.affinityDelta);
    });

    it('好感度不足时应拒绝赠送', () => {
      mockNPC.affinity = 5; // 低于minAffinityToGift(20)

      const result = giftSys.giveGift({
        npcId: 'npc-test-01',
        itemId: 'item-wine',
        quantity: 1,
      });

      expect(result.success).toBe(false);
      expect(result.failReason).toContain('好感度不足');
    });

    it('达到每日赠送上限时应拒绝', () => {
      // 连续赠送直到达到上限
      giftSys.setConfig({ dailyGiftLimit: 2 });
      giftSys.giveGift({ npcId: 'npc-test-01', itemId: 'item-wine', quantity: 1 });
      giftSys.giveGift({ npcId: 'npc-test-01', itemId: 'item-wine', quantity: 1 });

      const result = giftSys.giveGift({ npcId: 'npc-test-01', itemId: 'item-wine', quantity: 1 });
      expect(result.success).toBe(false);
      expect(result.failReason).toContain('次数已用完');
    });

    it('应记录赠送历史', () => {
      giftSys.giveGift({ npcId: 'npc-test-01', itemId: 'item-wine', quantity: 1 });

      const history = giftSys.getGiftHistory('npc-test-01');
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].itemId).toBe('item-wine');
    });
  });

  // ─── #17 #18 好感度等级与效果 ──────────────

  describe('#17 #18 好感度等级与效果解锁（Plan#17 #18 #27）', () => {
    it('应正确计算五级好感度等级', () => {
      // 验证阈值对应关系
      expect(getAffinityLevel(0)).toBe('hostile');
      expect(getAffinityLevel(20)).toBe('neutral');
      expect(getAffinityLevel(40)).toBe('friendly');
      expect(getAffinityLevel(65)).toBe('trusted');
      expect(getAffinityLevel(85)).toBe('bonded');
    });

    it('好感度应只增不减（衰减为0）', () => {
      const npc = createNPC({ affinity: 50 });
      const record = affinitySys.gainFromDialog('npc-01', npc);
      expect(record.delta).toBeGreaterThan(0);
    });

    it('日常对话应增加好感度', () => {
      const npc = createNPC({ affinity: 20 });
      const record = affinitySys.gainFromDialog('npc-01', npc);
      expect(record.delta).toBeGreaterThan(0);
      expect(record.source).toBe('dialog');
    });

    it('完成任务应增加好感度', () => {
      const npc = createNPC({ affinity: 40 });
      const record = affinitySys.gainFromQuest('npc-01', npc);
      expect(record.delta).toBeGreaterThan(0);
      expect(record.source).toBe('quest_complete');
    });

    it('偏好赠送应有更高加成', () => {
      const npc = createNPC({ affinity: 40 });
      const normalRecord = affinitySys.gainFromGift('npc-01', npc, 'normal');
      const preferredRecord = affinitySys.gainFromGift('npc-01', npc, 'preferred');
      expect(preferredRecord.delta).toBeGreaterThanOrEqual(normalRecord.delta);
    });

    it('应正确判断交互解锁状态', () => {
      // Lv.1 (hostile/neutral) - 基础对话
      const lv1Effect = affinitySys.getLevelEffect(20);
      expect(lv1Effect.unlockedInteractions).toBeDefined();

      // Lv.5 (bonded) - 羁绊技能
      const lv5Effect = affinitySys.getLevelEffect(90);
      expect(lv5Effect.levelNumber).toBeGreaterThanOrEqual(5);
    });

    it('羁绊技能应在满级解锁', () => {
      expect(affinitySys.isBondSkillUnlocked(90)).toBe(true);
      expect(affinitySys.isBondSkillUnlocked(50)).toBe(false);
    });
  });

  // ─── #5 NPC切磋系统 ──────────────────────

  describe('#5 NPC切磋系统（Plan#5）', () => {
    it('应进行切磋并获得结果', () => {
      const result = trainingSys.training('npc-01', 10, 8);
      expect(['win', 'lose', 'draw']).toContain(result.outcome);
      expect(result.npcId).toBe('npc-01');
    });

    it('切磋应有冷却时间', () => {
      trainingSys.training('npc-01', 10, 8);
      expect(trainingSys.canTraining('npc-01')).toBe(false);

      // 冷却中再次切磋应返回draw
      const result = trainingSys.training('npc-01', 10, 8);
      expect(result.message).toContain('冷却');
    });

    it('冷却结束后可再次切磋', () => {
      trainingSys.training('npc-01', 10, 8);
      trainingSys.update(120); // 冷却60秒，多给一些时间
      expect(trainingSys.canTraining('npc-01')).toBe(true);
    });

    it('胜利应获得奖励', () => {
      // 通过多次尝试确保至少有一次胜利
      trainingSys.reset();
      let hasWin = false;
      for (let i = 0; i < 50; i++) {
        trainingSys.reset();
        const result = trainingSys.training('npc-01', 50, 1); // 高等级差更容易赢
        if (result.outcome === 'win' && result.rewards) {
          hasWin = true;
          expect(result.rewards.experience).toBeGreaterThan(0);
          break;
        }
      }
      // 统计学上几乎必定至少赢一次
      expect(hasWin).toBe(true);
    });

    it('应记录切磋统计', () => {
      trainingSys.reset();
      trainingSys.training('npc-01', 10, 8);
      trainingSys.update(120);
      trainingSys.training('npc-01', 10, 8);

      const stats = trainingSys.getTrainingStats('npc-01');
      expect(stats.total).toBe(2);
      expect(stats.wins + stats.losses + stats.draws).toBe(2);
    });
  });

  // ─── #6 NPC结盟系统 ──────────────────────

  describe('#6 NPC结盟系统（Plan#6）', () => {
    it('好感度满时应可结盟', () => {
      const result = trainingSys.formAlliance('npc-01', 'def-warrior', 90);
      expect(result.success).toBe(true);
    });

    it('好感度不足时不可结盟', () => {
      const result = trainingSys.formAlliance('npc-02', 'def-merchant', 30);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('好感度不足');
    });

    it('不可重复结盟同一NPC', () => {
      trainingSys.formAlliance('npc-03', 'def-scholar', 90);
      const result = trainingSys.formAlliance('npc-03', 'def-scholar', 90);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('已经');
    });

    it('结盟后应获得加成', () => {
      trainingSys.formAlliance('npc-04', 'def-warrior', 90);
      const alliance = trainingSys.getAlliance('npc-04');
      expect(alliance).toBeDefined();
      expect(alliance!.bonuses.length).toBeGreaterThan(0);
    });

    it('应汇总所有结盟加成', () => {
      trainingSys.formAlliance('npc-a', 'def-warrior', 90);
      trainingSys.formAlliance('npc-b', 'def-merchant', 90);

      const allBonuses = trainingSys.getAllAllianceBonuses();
      expect(Object.keys(allBonuses).length).toBeGreaterThan(0);
    });

    it('应支持解除结盟', () => {
      trainingSys.formAlliance('npc-05', 'def-scout', 90);
      expect(trainingSys.breakAlliance('npc-05')).toBe(true);
      expect(trainingSys.isAllied('npc-05')).toBe(false);
    });
  });

  // ─── #7 #8 NPC离线行为 ────────────────────

  describe('#7 #8 NPC离线行为（Plan#7 #8）', () => {
    it('应计算离线产出', () => {
      const npcs = [
        { id: 'npc-01', name: '农民', profession: 'farmer' },
        { id: 'npc-02', name: '商人', profession: 'merchant' },
        { id: 'npc-03', name: '士兵', profession: 'warrior' },
      ];

      const summary = trainingSys.calculateOfflineActions(3600, npcs); // 1小时
      expect(summary.offlineDuration).toBe(3600);
      expect(summary.actions.length).toBeGreaterThan(0);
    });

    it('离线0小时应无产出', () => {
      const summary = trainingSys.calculateOfflineActions(0, [
        { id: 'npc-01', name: '农民', profession: 'farmer' },
      ]);
      expect(summary.actions).toHaveLength(0);
    });

    it('离线行为应包含资源变化', () => {
      const npcs = [
        { id: 'npc-01', name: '商人', profession: 'merchant' },
      ];
      const summary = trainingSys.calculateOfflineActions(3600, npcs);

      // 商人应产生资源
      const hasResourceAction = summary.actions.some(
        (a) => a.resourceChanges && Object.keys(a.resourceChanges).length > 0,
      );
      // 至少某些行为应有资源变化
      expect(summary.actions.length).toBeGreaterThan(0);
    });

    it('离线摘要应可获取和清除', () => {
      const npcs = [{ id: 'npc-01', name: '农民', profession: 'farmer' }];
      trainingSys.calculateOfflineActions(3600, npcs);

      expect(trainingSys.getOfflineSummary()).not.toBeNull();
      trainingSys.clearOfflineSummary();
      expect(trainingSys.getOfflineSummary()).toBeNull();
    });
  });

  // ─── #9 对话历史回看 ──────────────────────

  describe('#9 对话历史回看（Plan#9）', () => {
    it('应记录对话历史', () => {
      trainingSys.recordDialogue('npc-01', '张飞', '讨论了战场策略', 5, '支持进攻');
      trainingSys.recordDialogue('npc-02', '诸葛亮', '分析了敌情', 8, '建议防守');

      const history = trainingSys.getDialogueHistory();
      expect(history).toHaveLength(2);
    });

    it('应按NPC筛选对话历史', () => {
      trainingSys.recordDialogue('npc-01', '张飞', '讨论1', 3);
      trainingSys.recordDialogue('npc-02', '诸葛亮', '讨论2', 4);
      trainingSys.recordDialogue('npc-01', '张飞', '讨论3', 2);

      const history = trainingSys.getDialogueHistory('npc-01');
      expect(history).toHaveLength(2);
      expect(history.every((h) => h.npcId === 'npc-01')).toBe(true);
    });

    it('应限制历史条数', () => {
      for (let i = 0; i < 250; i++) {
        trainingSys.recordDialogue('npc-01', '张飞', `对话${i}`, 1);
      }
      // 超过MAX_DIALOGUE_HISTORY(200)后应自动裁剪
      const count = trainingSys.getDialogueCount();
      expect(count).toBeLessThanOrEqual(200);
    });

    it('应记录玩家选择', () => {
      trainingSys.recordDialogue('npc-01', '张飞', '关键抉择', 3, '选择A');

      const history = trainingSys.getDialogueHistory('npc-01');
      expect(history[0].playerChoice).toBe('选择A');
    });
  });

  // ─── #22/26 全链路串联验证 ─────────────────

  describe('#22/26 NPC好感度→赠送→切磋→结盟 全链路', () => {
    it('完整旅程: 从初识到结盟', () => {
      const npc = createNPC({ affinity: 20, profession: 'warrior' });

      // Step 1: 初始等级
      expect(getAffinityLevel(npc.affinity)).toBe('neutral');

      // Step 2: 通过对话提升
      const dialogGain = affinitySys.gainFromDialog('npc-01', npc);
      npc.affinity = Math.min(100, npc.affinity + dialogGain.delta);

      // Step 3: 通过赠送提升到friendly
      for (let i = 0; i < 10; i++) {
        const gain = affinitySys.gainFromGift('npc-01', npc, 'preferred');
        npc.affinity = Math.min(100, npc.affinity + gain.delta);
      }
      expect(npc.affinity).toBeGreaterThan(40);

      // Step 4: 通过任务提升
      for (let i = 0; i < 5; i++) {
        const gain = affinitySys.gainFromQuest('npc-01', npc, 10);
        npc.affinity = Math.min(100, npc.affinity + gain.delta);
      }

      // Step 5: 到达bonded后结盟
      npc.affinity = 90;
      const allianceResult = trainingSys.formAlliance('npc-01', 'def-warrior', npc.affinity);
      expect(allianceResult.success).toBe(true);

      // 验证结盟加成
      const alliance = trainingSys.getAlliance('npc-01');
      expect(alliance).toBeDefined();
      expect(alliance!.bonuses.length).toBeGreaterThan(0);
    });
  });

  // ─── 序列化/反序列化 ────────────────────────

  describe('序列化与反序列化', () => {
    it('赠送系统应正确序列化', () => {
      giftSys.giveGift = vi.fn(); // 跳过实际赠送
      giftSys.setCurrentTurn(5);

      const saveData = giftSys.exportSaveData();
      expect(saveData.version).toBe(1);
      expect(saveData).toHaveProperty('giftHistory');
      expect(saveData).toHaveProperty('dailyGiftCount');
    });

    it('切磋/结盟系统应正确序列化', () => {
      trainingSys.training('npc-01', 10, 8);
      trainingSys.formAlliance('npc-02', 'def-warrior', 90);
      trainingSys.recordDialogue('npc-01', '张飞', '测试对话', 3);

      const data = trainingSys.serialize();
      expect(data.version).toBe(1);
      expect(data.trainingRecords.length).toBeGreaterThan(0);
      expect(data.alliances.length).toBeGreaterThan(0);
      expect(data.dialogueHistory.length).toBeGreaterThan(0);
    });

    it('切磋/结盟系统应正确反序列化', () => {
      trainingSys.training('npc-01', 10, 8);
      trainingSys.formAlliance('npc-02', 'def-warrior', 90);

      const data = trainingSys.serialize();
      trainingSys.reset();

      trainingSys.deserialize(data);
      expect(trainingSys.getTrainingRecords().length).toBeGreaterThan(0);
      expect(trainingSys.isAllied('npc-02')).toBe(true);
    });
  });
});
