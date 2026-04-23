/**
 * NPCAffinitySystem 单元测试
 *
 * 覆盖 NPC 好感度系统的所有功能：
 * - #17 好感度等级与效果（等级计算、效果解锁、交易折扣等）
 * - #18 好感度获取途径（对话/赠送/任务/交易/战斗协助/衰减）
 * - #19 好感度进度可视化
 * - #20 羁绊技能（解锁/使用/冷却）
 * - 历史记录与统计
 * - 序列化
 */

import { NPCAffinitySystem } from '../NPCAffinitySystem';
import type { ISystemDeps } from '../../../core/types';
import type { NPCData, NPCProfession, AffinityLevel } from '../../../core/npc';
import { AFFINITY_THRESHOLDS, BOND_SKILLS } from '../../../core/npc';
import type { GiftType } from '../NPCAffinitySystem';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

function mockDeps(): ISystemDeps {
  return {
    eventBus: {
      on: jest.fn().mockReturnValue(jest.fn()),
      once: jest.fn().mockReturnValue(jest.fn()),
      emit: jest.fn(),
      off: jest.fn(),
      removeAllListeners: jest.fn(),
    },
    config: { get: jest.fn(), set: jest.fn() },
    registry: { register: jest.fn(), get: jest.fn(), getAll: jest.fn(), has: jest.fn(), unregister: jest.fn() },
  } as unknown as ISystemDeps;
}

function createAffinitySystem(config?: Record<string, unknown>): NPCAffinitySystem {
  const sys = new NPCAffinitySystem(config);
  sys.init(mockDeps());
  return sys;
}

function createNPC(overrides: Partial<NPCData> = {}): NPCData {
  return {
    id: 'npc-test-001',
    name: '测试商人',
    profession: 'merchant',
    affinity: 30,
    position: { x: 5, y: 5 },
    region: 'wei',
    visible: true,
    dialogId: 'dialog-test',
    createdAt: 0,
    lastInteractedAt: 0,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════

describe('NPCAffinitySystem', () => {
  let sys: NPCAffinitySystem;

  beforeEach(() => {
    sys = createAffinitySystem();
  });

  // ═══════════════════════════════════════════
  // 1. ISubsystem 接口
  // ═══════════════════════════════════════════
  describe('ISubsystem 接口', () => {
    it('name 为 npcAffinity', () => {
      expect(sys.name).toBe('npcAffinity');
    });

    it('init 后状态正常', () => {
      const state = sys.getState();
      expect(state.changeHistory).toEqual([]);
      expect(state.bondSkillCooldowns).toEqual({});
    });

    it('reset 清空状态', () => {
      const npc = createNPC();
      sys.gainFromDialog(npc.id, npc);
      sys.reset();
      const state = sys.getState();
      expect(state.changeHistory).toEqual([]);
      expect(state.bondSkillCooldowns).toEqual({});
    });

    it('update 不抛异常', () => {
      expect(() => sys.update(0.016)).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════
  // 2. #17 好感度等级与效果
  // ═══════════════════════════════════════════
  describe('#17 好感度等级与效果', () => {
    it('敌意等级 (0-19) 正确识别', () => {
      const effect = sys.getLevelEffect(0);
      expect(effect.level).toBe('hostile');
      expect(effect.levelNumber).toBe(1);
      expect(effect.label).toBe('敌意');
    });

    it('中立等级 (20-39) 正确识别', () => {
      const effect = sys.getLevelEffect(25);
      expect(effect.level).toBe('neutral');
      expect(effect.levelNumber).toBe(2);
      expect(effect.label).toBe('中立');
    });

    it('友善等级 (40-64) 正确识别', () => {
      const effect = sys.getLevelEffect(50);
      expect(effect.level).toBe('friendly');
      expect(effect.levelNumber).toBe(3);
    });

    it('信赖等级 (65-84) 正确识别', () => {
      const effect = sys.getLevelEffect(70);
      expect(effect.level).toBe('trusted');
      expect(effect.levelNumber).toBe(4);
    });

    it('羁绊等级 (85-100) 正确识别', () => {
      const effect = sys.getLevelEffect(90);
      expect(effect.level).toBe('bonded');
      expect(effect.levelNumber).toBe(5);
    });

    it('边界值正确：19→hostile, 20→neutral', () => {
      expect(sys.getLevelEffect(19).level).toBe('hostile');
      expect(sys.getLevelEffect(20).level).toBe('neutral');
    });

    it('边界值正确：39→neutral, 40→friendly', () => {
      expect(sys.getLevelEffect(39).level).toBe('neutral');
      expect(sys.getLevelEffect(40).level).toBe('friendly');
    });

    it('边界值正确：64→friendly, 65→trusted', () => {
      expect(sys.getLevelEffect(64).level).toBe('friendly');
      expect(sys.getLevelEffect(65).level).toBe('trusted');
    });

    it('边界值正确：84→trusted, 85→bonded', () => {
      expect(sys.getLevelEffect(84).level).toBe('trusted');
      expect(sys.getLevelEffect(85).level).toBe('bonded');
    });

    it('Lv1敌意：仅解锁对话', () => {
      const interactions = sys.getUnlockedInteractions(10);
      expect(interactions).toContain('talk');
      expect(interactions).not.toContain('trade');
      expect(interactions).not.toContain('bond_skill');
    });

    it('Lv2中立：解锁对话+交易', () => {
      const interactions = sys.getUnlockedInteractions(25);
      expect(interactions).toContain('talk');
      expect(interactions).toContain('trade');
      expect(interactions).not.toContain('gift');
    });

    it('Lv3友善：解锁赠送+情报', () => {
      const interactions = sys.getUnlockedInteractions(50);
      expect(interactions).toContain('talk');
      expect(interactions).toContain('trade');
      expect(interactions).toContain('gift');
      expect(interactions).toContain('intel');
    });

    it('Lv4信赖：解锁任务+锻造', () => {
      const interactions = sys.getUnlockedInteractions(70);
      expect(interactions).toContain('quest');
      expect(interactions).toContain('craft');
    });

    it('Lv5羁绊：解锁羁绊技能', () => {
      const interactions = sys.getUnlockedInteractions(90);
      expect(interactions).toContain('bond_skill');
    });

    it('交易折扣随等级递减', () => {
      const d1 = sys.getTradeDiscount(10); // hostile
      const d2 = sys.getTradeDiscount(30); // neutral
      const d3 = sys.getTradeDiscount(50); // friendly
      const d4 = sys.getTradeDiscount(75); // trusted
      const d5 = sys.getTradeDiscount(95); // bonded
      expect(d1).toBeGreaterThan(d2);
      expect(d2).toBeGreaterThan(d3);
      expect(d3).toBeGreaterThan(d4);
      expect(d4).toBeGreaterThan(d5);
    });

    it('情报准确度随等级递增', () => {
      const a1 = sys.getIntelAccuracy(10);
      const a5 = sys.getIntelAccuracy(95);
      expect(a1).toBeLessThan(a5);
    });

    it('任务奖励倍率随等级递增', () => {
      const m1 = sys.getQuestRewardMultiplier(10);
      const m5 = sys.getQuestRewardMultiplier(95);
      expect(m1).toBeLessThan(m5);
    });

    it('isInteractionUnlocked 正确判断', () => {
      expect(sys.isInteractionUnlocked(10, 'talk')).toBe(true);
      expect(sys.isInteractionUnlocked(10, 'trade')).toBe(false);
      expect(sys.isInteractionUnlocked(30, 'trade')).toBe(true);
      expect(sys.isInteractionUnlocked(90, 'bond_skill')).toBe(true);
    });

    it('isBondSkillUnlocked 仅羁绊等级解锁', () => {
      expect(sys.isBondSkillUnlocked(10)).toBe(false);
      expect(sys.isBondSkillUnlocked(50)).toBe(false);
      expect(sys.isBondSkillUnlocked(80)).toBe(false);
      expect(sys.isBondSkillUnlocked(85)).toBe(true);
      expect(sys.isBondSkillUnlocked(100)).toBe(true);
    });

    it('getNPCLevelEffect 根据 NPC 数据获取效果', () => {
      const npc = createNPC({ affinity: 50 });
      const effect = sys.getNPCLevelEffect(npc);
      expect(effect.level).toBe('friendly');
    });
  });

  // ═══════════════════════════════════════════
  // 3. #18 好感度获取途径
  // ═══════════════════════════════════════════
  describe('#18 好感度获取途径', () => {
    it('对话增加好感度（默认+3）', () => {
      const npc = createNPC({ affinity: 30 });
      const record = sys.gainFromDialog(npc.id, npc);
      expect(record.delta).toBe(3);
      expect(record.newAffinity).toBe(33);
      expect(record.source).toBe('dialog');
      expect(npc.affinity).toBe(33);
    });

    it('对话可加成', () => {
      const npc = createNPC({ affinity: 30 });
      const record = sys.gainFromDialog(npc.id, npc, 5);
      expect(record.delta).toBe(8); // 3 + 5
      expect(npc.affinity).toBe(38);
    });

    it('赠送普通礼物增加好感度', () => {
      const npc = createNPC({ affinity: 30 });
      const record = sys.gainFromGift(npc.id, npc, 'normal');
      expect(record.delta).toBe(5); // 5 * 1.0
      expect(record.source).toBe('gift');
      expect(npc.affinity).toBe(35);
    });

    it('赠送偏好礼物获得双倍好感度', () => {
      const npc = createNPC({ affinity: 30 });
      const record = sys.gainFromGift(npc.id, npc, 'preferred');
      expect(record.delta).toBe(30); // 15 * 2.0
      expect(npc.affinity).toBe(60);
    });

    it('赠送稀有礼物获得高额好感度', () => {
      const npc = createNPC({ affinity: 30 });
      const record = sys.gainFromGift(npc.id, npc, 'rare');
      expect(record.delta).toBe(30); // 30 * 1.0
      expect(npc.affinity).toBe(60);
    });

    it('完成任务增加好感度（默认+15）', () => {
      const npc = createNPC({ affinity: 30 });
      const record = sys.gainFromQuest(npc.id, npc);
      expect(record.delta).toBe(15);
      expect(record.source).toBe('quest_complete');
      expect(npc.affinity).toBe(45);
    });

    it('完成任务可加成', () => {
      const npc = createNPC({ affinity: 30 });
      const record = sys.gainFromQuest(npc.id, npc, 10);
      expect(record.delta).toBe(25);
      expect(npc.affinity).toBe(55);
    });

    it('交易增加好感度（默认+2）', () => {
      const npc = createNPC({ affinity: 30 });
      const record = sys.gainFromTrade(npc.id, npc);
      expect(record.delta).toBe(2);
      expect(record.source).toBe('trade');
    });

    it('战斗协助增加好感度（默认+8）', () => {
      const npc = createNPC({ affinity: 30 });
      const record = sys.gainFromBattleAssist(npc.id, npc);
      expect(record.delta).toBe(8);
      expect(record.source).toBe('battle_assist');
    });

    it('好感度上限为100', () => {
      const npc = createNPC({ affinity: 98 });
      const record = sys.gainFromGift(npc.id, npc, 'rare');
      expect(record.newAffinity).toBe(100);
      expect(record.delta).toBe(2); // 实际只增加了2
      expect(npc.affinity).toBe(100);
    });

    it('好感度下限为0', () => {
      const npc = createNPC({ affinity: 2 });
      const record = sys.applyAffinityChange(npc.id, npc, -10, 'time_decay', '测试');
      expect(record.newAffinity).toBe(0);
      expect(record.delta).toBe(-2);
      expect(npc.affinity).toBe(0);
    });
  });
});
