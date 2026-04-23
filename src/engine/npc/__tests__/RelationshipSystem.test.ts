import { vi } from 'vitest';
/**
 * RelationshipSystem 单元测试
 *
 * 覆盖：好感度等级、好感度变动、交易折扣、NPC 间关系、
 * 对话解锁、变动日志、序列化/反序列化。
 *
 * @module engine/npc/__tests__/RelationshipSystem.test
 */

import { NPCEventBus } from '../NPCEventBus';
import {
  RelationshipSystem,
  RelationshipLevel,
  NPCRelationType,
} from '../RelationshipSystem';
import type { RelationshipChangeConfig } from '../RelationshipSystem';

// ---------------------------------------------------------------------------
// 测试
// ---------------------------------------------------------------------------

describe('RelationshipSystem', () => {
  let eventBus: NPCEventBus;
  let system: RelationshipSystem;

  beforeEach(() => {
    eventBus = new NPCEventBus();
    system = new RelationshipSystem(eventBus);
  });

  // -----------------------------------------------------------------------
  // 好感度等级
  // -----------------------------------------------------------------------

  describe('好感度等级', () => {
    it('初始好感度应为 STRANGER', () => {
      expect(system.getLevel('npc_1')).toBe(RelationshipLevel.STRANGER);
    });

    it('初始好感度点数应为 0', () => {
      expect(system.getPoints('npc_1')).toBe(0);
    });

    it('getOrCreate 应返回默认好感度数据', () => {
      const rel = system.getOrCreate('npc_1');
      expect(rel.npcId).toBe('npc_1');
      expect(rel.points).toBe(0);
      expect(rel.level).toBe(RelationshipLevel.STRANGER);
      expect(rel.interactionCount).toBe(0);
      expect(rel.unlockedDialogues).toEqual([]);
      expect(rel.changeLog).toEqual([]);
    });

    it('重复 getOrCreate 应返回同一对象', () => {
      const rel1 = system.getOrCreate('npc_1');
      const rel2 = system.getOrCreate('npc_1');
      expect(rel1).toBe(rel2);
    });
  });

  // -----------------------------------------------------------------------
  // 好感度变动
  // -----------------------------------------------------------------------

  describe('changeRelationship', () => {
    it('对话应增加好感度', () => {
      system.changeRelationship('npc_1', 'dialogue');
      expect(system.getPoints('npc_1')).toBe(2); // 默认 +2
    });

    it('送礼应增加较多好感度', () => {
      system.changeRelationship('npc_1', 'gift');
      expect(system.getPoints('npc_1')).toBe(10); // 默认 +10
    });

    it('完成任务应增加好感度', () => {
      system.changeRelationship('npc_1', 'quest_complete');
      expect(system.getPoints('npc_1')).toBe(15); // 默认 +15
    });

    it('交易应增加少量好感度', () => {
      system.changeRelationship('npc_1', 'trade');
      expect(system.getPoints('npc_1')).toBe(3);
    });

    it('帮助应增加好感度', () => {
      system.changeRelationship('npc_1', 'help');
      expect(system.getPoints('npc_1')).toBe(8);
    });

    it('攻击应降低好感度', () => {
      system.changeRelationship('npc_1', 'attack');
      expect(system.getPoints('npc_1')).toBe(0); // 最低为 0
    });

    it('先增加再攻击应降低', () => {
      system.changeRelationship('npc_1', 'gift'); // +10
      system.changeRelationship('npc_1', 'attack'); // -30
      expect(system.getPoints('npc_1')).toBe(0); // 10 - 30 = -20 → 0
    });

    it('侮辱应降低好感度', () => {
      system.setPoints('npc_1', 50);
      system.changeRelationship('npc_1', 'insult');
      expect(system.getPoints('npc_1')).toBe(35); // 50 - 15
    });

    it('任务失败应降低好感度', () => {
      system.setPoints('npc_1', 50);
      system.changeRelationship('npc_1', 'quest_fail');
      expect(system.getPoints('npc_1')).toBe(40); // 50 - 10
    });

    it('应支持自定义变动值', () => {
      system.changeRelationship('npc_1', 'dialogue', 50);
      expect(system.getPoints('npc_1')).toBe(50);
    });

    it('好感度上限应为 100', () => {
      system.changeRelationship('npc_1', 'dialogue', 200);
      expect(system.getPoints('npc_1')).toBe(100);
    });

    it('好感度下限应为 0', () => {
      system.changeRelationship('npc_1', 'attack');
      expect(system.getPoints('npc_1')).toBe(0);
    });

    it('应增加交互计数', () => {
      system.changeRelationship('npc_1', 'dialogue');
      system.changeRelationship('npc_1', 'dialogue');
      const rel = system.getOrCreate('npc_1');
      expect(rel.interactionCount).toBe(2);
    });

    it('应更新最后交互时间', () => {
      const before = Date.now();
      system.changeRelationship('npc_1', 'dialogue');
      const rel = system.getOrCreate('npc_1');
      expect(rel.lastInteractionTime).toBeGreaterThanOrEqual(before);
    });
  });

  // -----------------------------------------------------------------------
  // 等级变化
  // -----------------------------------------------------------------------

  describe('等级变化', () => {
    it('0-19 应为 STRANGER', () => {
      system.setPoints('npc_1', 0);
      expect(system.getLevel('npc_1')).toBe(RelationshipLevel.STRANGER);
      system.setPoints('npc_1', 19);
      expect(system.getLevel('npc_1')).toBe(RelationshipLevel.STRANGER);
    });

    it('20-39 应为 ACQUAINTANCE', () => {
      system.setPoints('npc_1', 20);
      expect(system.getLevel('npc_1')).toBe(RelationshipLevel.ACQUAINTANCE);
      system.setPoints('npc_1', 39);
      expect(system.getLevel('npc_1')).toBe(RelationshipLevel.ACQUAINTANCE);
    });

    it('40-59 应为 FRIEND', () => {
      system.setPoints('npc_1', 40);
      expect(system.getLevel('npc_1')).toBe(RelationshipLevel.FRIEND);
      system.setPoints('npc_1', 59);
      expect(system.getLevel('npc_1')).toBe(RelationshipLevel.FRIEND);
    });

    it('60-79 应为 CLOSE_FRIEND', () => {
      system.setPoints('npc_1', 60);
      expect(system.getLevel('npc_1')).toBe(RelationshipLevel.CLOSE_FRIEND);
      system.setPoints('npc_1', 79);
      expect(system.getLevel('npc_1')).toBe(RelationshipLevel.CLOSE_FRIEND);
    });

    it('80-100 应为 CONFIDANT', () => {
      system.setPoints('npc_1', 80);
      expect(system.getLevel('npc_1')).toBe(RelationshipLevel.CONFIDANT);
      system.setPoints('npc_1', 100);
      expect(system.getLevel('npc_1')).toBe(RelationshipLevel.CONFIDANT);
    });

    it('等级变化应触发事件', () => {
      const listener = vi.fn();
      eventBus.on('relationshipLevelChanged', listener);

      system.changeRelationship('npc_1', 'gift', 20); // 0 → 20, STRANGER → ACQUAINTANCE
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          npcId: 'npc_1',
          oldLevel: RelationshipLevel.STRANGER,
          newLevel: RelationshipLevel.ACQUAINTANCE,
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // 事件触发
  // -----------------------------------------------------------------------

  describe('事件触发', () => {
    it('好感度变动应触发 relationshipChanged 事件', () => {
      const listener = vi.fn();
      eventBus.on('relationshipChanged', listener);

      system.changeRelationship('npc_1', 'dialogue');

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          npcId: 'npc_1',
          reason: 'dialogue',
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // 交易折扣
  // -----------------------------------------------------------------------

  describe('getTradeDiscount', () => {
    it('STRANGER 无折扣', () => {
      expect(system.getTradeDiscount('npc_1')).toBe(1.0);
    });

    it('ACQUAINTANCE 打 9 折', () => {
      system.setPoints('npc_1', 20);
      expect(system.getTradeDiscount('npc_1')).toBe(0.9);
    });

    it('FRIEND 打 85 折', () => {
      system.setPoints('npc_1', 40);
      expect(system.getTradeDiscount('npc_1')).toBe(0.85);
    });

    it('CLOSE_FRIEND 打 8 折', () => {
      system.setPoints('npc_1', 60);
      expect(system.getTradeDiscount('npc_1')).toBe(0.8);
    });

    it('CONFIDANT 打 7 折', () => {
      system.setPoints('npc_1', 80);
      expect(system.getTradeDiscount('npc_1')).toBe(0.7);
    });
  });

  describe('getDiscountedPrice', () => {
    it('应正确计算折后价格', () => {
      system.setPoints('npc_1', 40); // FRIEND → 0.85
      expect(system.getDiscountedPrice('npc_1', 100)).toBe(85);
    });

    it('无折扣时原价', () => {
      expect(system.getDiscountedPrice('npc_1', 100)).toBe(100);
    });

    it('结果应向上取整', () => {
      system.setPoints('npc_1', 60); // CLOSE_FRIEND → 0.8
      expect(system.getDiscountedPrice('npc_1', 99)).toBe(80); // 99 * 0.8 = 79.2 → 80
    });
  });

  // -----------------------------------------------------------------------
  // 对话解锁
  // -----------------------------------------------------------------------

  describe('unlockDialogue', () => {
    it('应能解锁对话', () => {
      system.unlockDialogue('npc_1', 'special_dlg_1');
      expect(system.isDialogueUnlocked('npc_1', 'special_dlg_1')).toBe(true);
    });

    it('未解锁的对话应返回 false', () => {
      expect(system.isDialogueUnlocked('npc_1', 'special_dlg_1')).toBe(false);
    });

    it('不应重复解锁', () => {
      system.unlockDialogue('npc_1', 'special_dlg_1');
      system.unlockDialogue('npc_1', 'special_dlg_1');

      const rel = system.getOrCreate('npc_1');
      expect(rel.unlockedDialogues).toEqual(['special_dlg_1']);
    });

    it('解锁应触发 dialogueUnlocked 事件', () => {
      const listener = vi.fn();
      eventBus.on('dialogueUnlocked', listener);

      system.unlockDialogue('npc_1', 'special_dlg_1');
      expect(listener).toHaveBeenCalledWith({
        npcId: 'npc_1',
        dialogueId: 'special_dlg_1',
      });
    });
  });

  // -----------------------------------------------------------------------
  // NPC 间关系
  // -----------------------------------------------------------------------

  describe('NPC 间关系', () => {
    it('应能设置 NPC 间关系', () => {
      system.setNPCRelationship('npc_1', 'npc_2', NPCRelationType.ALLY, 80);
      const rel = system.getNPCRelationship('npc_1', 'npc_2');
      expect(rel).not.toBeNull();
      expect(rel!.relationType).toBe(NPCRelationType.ALLY);
      expect(rel!.affinity).toBe(80);
    });

    it('NPC 间关系应是对称的', () => {
      system.setNPCRelationship('npc_1', 'npc_2', NPCRelationType.ALLY);
      const rel = system.getNPCRelationship('npc_2', 'npc_1');
      expect(rel).not.toBeNull();
      expect(rel!.relationType).toBe(NPCRelationType.ALLY);
    });

    it('无关系应返回 null', () => {
      expect(system.getNPCRelationship('npc_1', 'npc_2')).toBeNull();
    });

    it('应能获取盟友列表', () => {
      system.setNPCRelationship('npc_1', 'npc_2', NPCRelationType.ALLY);
      system.setNPCRelationship('npc_1', 'npc_3', NPCRelationType.ALLY);
      system.setNPCRelationship('npc_1', 'npc_4', NPCRelationType.RIVAL);

      const allies = system.getAllies('npc_1');
      expect(allies).toHaveLength(2);
      expect(allies).toContain('npc_2');
      expect(allies).toContain('npc_3');
    });

    it('应能获取对手列表', () => {
      system.setNPCRelationship('npc_1', 'npc_2', NPCRelationType.RIVAL);
      system.setNPCRelationship('npc_1', 'npc_3', NPCRelationType.ALLY);

      const rivals = system.getRivals('npc_1');
      expect(rivals).toHaveLength(1);
      expect(rivals).toContain('npc_2');
    });

    it('应能获取所有关系', () => {
      system.setNPCRelationship('npc_1', 'npc_2', NPCRelationType.ALLY);
      system.setNPCRelationship('npc_1', 'npc_3', NPCRelationType.RIVAL);

      const rels = system.getNPCAllRelationships('npc_1');
      expect(rels).toHaveLength(2);
    });

    it('好感度应限制在 0-100', () => {
      system.setNPCRelationship('npc_1', 'npc_2', NPCRelationType.ALLY, 150);
      const rel = system.getNPCRelationship('npc_1', 'npc_2');
      expect(rel!.affinity).toBe(100);
    });

    it('师徒关系', () => {
      system.setNPCRelationship('npc_1', 'npc_2', NPCRelationType.MENTOR);
      const rel = system.getNPCRelationship('npc_1', 'npc_2');
      expect(rel!.relationType).toBe(NPCRelationType.MENTOR);
    });
  });

  // -----------------------------------------------------------------------
  // 查询
  // -----------------------------------------------------------------------

  describe('查询', () => {
    it('应能获取所有好感度数据', () => {
      system.getOrCreate('npc_1');
      system.getOrCreate('npc_2');
      expect(system.getAllPlayerRelationships()).toHaveLength(2);
    });

    it('应能按等级筛选 NPC', () => {
      system.setPoints('npc_1', 40);
      system.setPoints('npc_2', 40);
      system.setPoints('npc_3', 10);

      const friends = system.getNPCsByLevel(RelationshipLevel.FRIEND);
      expect(friends).toHaveLength(2);
      expect(friends).toContain('npc_1');
      expect(friends).toContain('npc_2');
    });

    it('应能获取变动日志', () => {
      system.changeRelationship('npc_1', 'dialogue');
      system.changeRelationship('npc_1', 'gift');

      const log = system.getChangeLog('npc_1');
      expect(log).toHaveLength(2);
      expect(log[0].reason).toBe('dialogue');
      expect(log[1].reason).toBe('gift');
    });

    it('无日志应返回空数组', () => {
      expect(system.getChangeLog('nonexistent')).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // 自定义配置
  // -----------------------------------------------------------------------

  describe('自定义配置', () => {
    it('应能使用自定义好感度变动值', () => {
      const customSystem = new RelationshipSystem(eventBus, {
        dialogue: 5,
        gift: 20,
      });

      customSystem.changeRelationship('npc_1', 'dialogue');
      expect(customSystem.getPoints('npc_1')).toBe(5);

      customSystem.changeRelationship('npc_1', 'gift');
      expect(customSystem.getPoints('npc_1')).toBe(25);
    });
  });

  // -----------------------------------------------------------------------
  // 序列化
  // -----------------------------------------------------------------------

  describe('serialize / deserialize', () => {
    it('应能序列化和反序列化好感度数据', () => {
      system.changeRelationship('npc_1', 'gift');
      system.changeRelationship('npc_1', 'dialogue');
      system.unlockDialogue('npc_1', 'special_dlg');
      system.setNPCRelationship('npc_1', 'npc_2', NPCRelationType.ALLY, 80);

      const data = system.serialize();

      const newSystem = new RelationshipSystem(eventBus);
      newSystem.deserialize(data as Record<string, unknown>);

      expect(newSystem.getPoints('npc_1')).toBe(12); // 10 + 2
      expect(newSystem.getLevel('npc_1')).toBe(RelationshipLevel.STRANGER);
      expect(newSystem.isDialogueUnlocked('npc_1', 'special_dlg')).toBe(true);

      const npcRel = newSystem.getNPCRelationship('npc_1', 'npc_2');
      expect(npcRel).not.toBeNull();
      expect(npcRel!.relationType).toBe(NPCRelationType.ALLY);
    });

    it('反序列化后应能继续操作', () => {
      system.setPoints('npc_1', 50);
      const data = system.serialize();

      const newSystem = new RelationshipSystem(eventBus);
      newSystem.deserialize(data as Record<string, unknown>);

      newSystem.changeRelationship('npc_1', 'dialogue');
      expect(newSystem.getPoints('npc_1')).toBe(52);
    });
  });
});
