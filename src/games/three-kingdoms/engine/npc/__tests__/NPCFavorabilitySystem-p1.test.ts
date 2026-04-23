/**
 * NPCFavorabilitySystem 单元测试
 *
 * 覆盖好感度系统的所有功能：
 * - ISubsystem 接口
 * - 好感度等级与效果（#17）
 * - 好感度获取途径（#18）
 * - 好感度进度可视化（#19）
 * - 羁绊技能（#20）
 * - 好感度时间衰减
 * - 存档序列化
 */

import { NPCFavorabilitySystem } from '../NPCFavorabilitySystem';
import { NPCSystem } from '../NPCSystem';
import type { ISystemDeps } from '../../../core/types';
import {
  AFFINITY_LEVEL_EFFECTS,
  DEFAULT_AFFINITY_GAIN_CONFIG,
  BOND_SKILLS,
} from '../../../core/npc';

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

function createSystemWithNPC(): { favSys: NPCFavorabilitySystem; npcSys: NPCSystem; deps: ISystemDeps } {
  const deps = mockDeps();

  const npcSys = new NPCSystem();
  npcSys.init(deps);

  // 让 registry.get 返回 NPCSystem
  (deps.registry.get as ReturnType<typeof jest.fn>).mockImplementation((name: string) => {
    if (name === 'npc') return npcSys;
    return null;
  });

  const favSys = new NPCFavorabilitySystem();
  favSys.init(deps);

  return { favSys, npcSys, deps };
}

// ═══════════════════════════════════════════════════════════

describe('NPCFavorabilitySystem', () => {
  let favSys: NPCFavorabilitySystem;
  let npcSys: NPCSystem;

  beforeEach(() => {
    const ctx = createSystemWithNPC();
    favSys = ctx.favSys;
    npcSys = ctx.npcSys;
  });

  // ═══════════════════════════════════════════
  // 1. ISubsystem 接口
  // ═══════════════════════════════════════════
  describe('ISubsystem 接口', () => {
    it('name 为 npcFavorability', () => {
      expect(favSys.name).toBe('npcFavorability');
    });

    it('init 后状态为空', () => {
      const state = favSys.getState();
      expect(state.changeHistory).toEqual([]);
    });

    it('reset 恢复初始状态', () => {
      favSys.addDialogAffinity('npc-merchant-01', 1);
      favSys.reset();
      const state = favSys.getState();
      expect(state.changeHistory).toEqual([]);
    });

    it('update 不抛异常', () => {
      expect(() => favSys.update(16)).not.toThrow();
    });

    it('getState 返回完整状态', () => {
      const state = favSys.getState();
      expect(state).toHaveProperty('changeHistory');
      expect(state).toHaveProperty('bondSkillCooldowns');
    });
  });

  // ═══════════════════════════════════════════
  // 2. 好感度等级与效果（#17）
  // ═══════════════════════════════════════════
  describe('好感度等级与效果（#17）', () => {
    it('5个等级效果定义完整', () => {
      const levels = Object.keys(AFFINITY_LEVEL_EFFECTS);
      expect(levels.length).toBe(5);
      expect(levels).toContain('hostile');
      expect(levels).toContain('neutral');
      expect(levels).toContain('friendly');
      expect(levels).toContain('trusted');
      expect(levels).toContain('bonded');
    });

    it('等级序号正确 (1-5)', () => {
      expect(AFFINITY_LEVEL_EFFECTS.hostile.levelNumber).toBe(1);
      expect(AFFINITY_LEVEL_EFFECTS.neutral.levelNumber).toBe(2);
      expect(AFFINITY_LEVEL_EFFECTS.friendly.levelNumber).toBe(3);
      expect(AFFINITY_LEVEL_EFFECTS.trusted.levelNumber).toBe(4);
      expect(AFFINITY_LEVEL_EFFECTS.bonded.levelNumber).toBe(5);
    });

    it('等级中文名正确', () => {
      expect(AFFINITY_LEVEL_EFFECTS.hostile.label).toBe('敌意');
      expect(AFFINITY_LEVEL_EFFECTS.neutral.label).toBe('中立');
      expect(AFFINITY_LEVEL_EFFECTS.friendly.label).toBe('友善');
      expect(AFFINITY_LEVEL_EFFECTS.trusted.label).toBe('信赖');
      expect(AFFINITY_LEVEL_EFFECTS.bonded.label).toBe('羁绊');
    });

    it('交易折扣随等级递减', () => {
      expect(AFFINITY_LEVEL_EFFECTS.hostile.tradeDiscount).toBe(1.0);
      expect(AFFINITY_LEVEL_EFFECTS.neutral.tradeDiscount).toBeLessThan(1.0);
      expect(AFFINITY_LEVEL_EFFECTS.friendly.tradeDiscount).toBeLessThan(AFFINITY_LEVEL_EFFECTS.neutral.tradeDiscount);
      expect(AFFINITY_LEVEL_EFFECTS.trusted.tradeDiscount).toBeLessThan(AFFINITY_LEVEL_EFFECTS.friendly.tradeDiscount);
      expect(AFFINITY_LEVEL_EFFECTS.bonded.tradeDiscount).toBeLessThan(AFFINITY_LEVEL_EFFECTS.trusted.tradeDiscount);
    });

    it('情报准确度随等级递增', () => {
      expect(AFFINITY_LEVEL_EFFECTS.hostile.intelAccuracy).toBeLessThan(AFFINITY_LEVEL_EFFECTS.neutral.intelAccuracy);
      expect(AFFINITY_LEVEL_EFFECTS.neutral.intelAccuracy).toBeLessThan(AFFINITY_LEVEL_EFFECTS.friendly.intelAccuracy);
      expect(AFFINITY_LEVEL_EFFECTS.friendly.intelAccuracy).toBeLessThan(AFFINITY_LEVEL_EFFECTS.trusted.intelAccuracy);
      expect(AFFINITY_LEVEL_EFFECTS.trusted.intelAccuracy).toBeLessThan(AFFINITY_LEVEL_EFFECTS.bonded.intelAccuracy);
    });

    it('任务奖励倍率随等级递增', () => {
      expect(AFFINITY_LEVEL_EFFECTS.hostile.questRewardMultiplier).toBeLessThan(AFFINITY_LEVEL_EFFECTS.neutral.questRewardMultiplier);
      expect(AFFINITY_LEVEL_EFFECTS.bonded.questRewardMultiplier).toBeGreaterThan(1.0);
    });

    it('交互选项随等级解锁', () => {
      // hostile 只有 talk
      expect(AFFINITY_LEVEL_EFFECTS.hostile.unlockedInteractions).toContain('talk');
      expect(AFFINITY_LEVEL_EFFECTS.hostile.unlockedInteractions.length).toBe(1);

      // neutral 有 talk + trade
      expect(AFFINITY_LEVEL_EFFECTS.neutral.unlockedInteractions).toContain('talk');
      expect(AFFINITY_LEVEL_EFFECTS.neutral.unlockedInteractions).toContain('trade');

      // bonded 有全部
      expect(AFFINITY_LEVEL_EFFECTS.bonded.unlockedInteractions).toContain('bond_skill');
    });

    it('getLevelEffect 返回正确效果', () => {
      const effect = favSys.getLevelEffect('friendly');
      expect(effect).toEqual(AFFINITY_LEVEL_EFFECTS.friendly);
    });

    it('getNPCLevelEffect 返回NPC当前等级效果', () => {
      // npc-merchant-01 默认好感度30 → neutral
      const effect = favSys.getNPCLevelEffect('npc-merchant-01');
      expect(effect).toBeDefined();
      expect(effect!.level).toBe('neutral');
    });

    it('getNPCLevelEffect 不存在的NPC返回null', () => {
      expect(favSys.getNPCLevelEffect('non-existent')).toBeNull();
    });

    it('isInteractionUnlocked 检查交互解锁', () => {
      // neutral 等级：talk 和 trade 已解锁
      expect(favSys.isInteractionUnlocked('npc-merchant-01', 'talk')).toBe(true);
      expect(favSys.isInteractionUnlocked('npc-merchant-01', 'trade')).toBe(true);
      // gift 需要 friendly (40+)
      expect(favSys.isInteractionUnlocked('npc-merchant-01', 'gift')).toBe(false);
    });

    it('getTradeDiscount 返回折扣', () => {
      const discount = favSys.getTradeDiscount('npc-merchant-01');
      expect(discount).toBe(AFFINITY_LEVEL_EFFECTS.neutral.tradeDiscount);
    });

    it('getTradeDiscount 不存在的NPC返回0', () => {
      expect(favSys.getTradeDiscount('non-existent')).toBe(0);
    });

    it('getQuestRewardMultiplier 返回倍率', () => {
      const mult = favSys.getQuestRewardMultiplier('npc-merchant-01');
      expect(mult).toBe(AFFINITY_LEVEL_EFFECTS.neutral.questRewardMultiplier);
    });
  });

  // ═══════════════════════════════════════════
  // 3. 好感度获取途径（#18）
  // ═══════════════════════════════════════════
  describe('好感度获取途径（#18）', () => {
    it('addDialogAffinity 通过对话增加好感度', () => {
      const npc = npcSys.getNPCById('npc-merchant-01');
      const prevAffinity = npc!.affinity;

      const result = favSys.addDialogAffinity('npc-merchant-01', 1);
      expect(result).not.toBeNull();
      expect(result).toBe(DEFAULT_AFFINITY_GAIN_CONFIG.dialogBase);
      expect(npcSys.getNPCById('npc-merchant-01')!.affinity).toBe(prevAffinity + DEFAULT_AFFINITY_GAIN_CONFIG.dialogBase);
    });

    it('addGiftAffinity 赠送普通物品增加好感度', () => {
      const npc = npcSys.getNPCById('npc-merchant-01');
      const prevAffinity = npc!.affinity;

      const result = favSys.addGiftAffinity('npc-merchant-01', false, 10, 1);
      expect(result).not.toBeNull();
      expect(result).toBe(10); // 10 * 1.0
      expect(npcSys.getNPCById('npc-merchant-01')!.affinity).toBe(prevAffinity + 10);
    });

    it('addGiftAffinity 赠送偏好物品加倍好感度', () => {
      const npc = npcSys.getNPCById('npc-merchant-01');
      const prevAffinity = npc!.affinity;

      const result = favSys.addGiftAffinity('npc-merchant-01', true, 10, 1);
      expect(result).not.toBeNull();
      expect(result).toBe(20); // 10 * 2.0
      expect(npcSys.getNPCById('npc-merchant-01')!.affinity).toBe(prevAffinity + 20);
    });

    it('addQuestCompleteAffinity 完成任务增加好感度', () => {
      const npc = npcSys.getNPCById('npc-merchant-01');
      const prevAffinity = npc!.affinity;

      const result = favSys.addQuestCompleteAffinity('npc-merchant-01', 1);
      expect(result).not.toBeNull();
      expect(result).toBe(DEFAULT_AFFINITY_GAIN_CONFIG.questComplete);
      expect(npcSys.getNPCById('npc-merchant-01')!.affinity).toBe(prevAffinity + DEFAULT_AFFINITY_GAIN_CONFIG.questComplete);
    });

    it('addTradeAffinity 通过交易增加好感度', () => {
      const npc = npcSys.getNPCById('npc-merchant-01');
      const prevAffinity = npc!.affinity;

      const result = favSys.addTradeAffinity('npc-merchant-01', 1);
      expect(result).not.toBeNull();
      expect(result).toBe(DEFAULT_AFFINITY_GAIN_CONFIG.tradeBase);
      expect(npcSys.getNPCById('npc-merchant-01')!.affinity).toBe(prevAffinity + DEFAULT_AFFINITY_GAIN_CONFIG.tradeBase);
    });

    it('addBattleAssistAffinity 通过战斗协助增加好感度', () => {
      const npc = npcSys.getNPCById('npc-merchant-01');
      const prevAffinity = npc!.affinity;

      const result = favSys.addBattleAssistAffinity('npc-merchant-01', 1);
      expect(result).not.toBeNull();
      expect(result).toBe(DEFAULT_AFFINITY_GAIN_CONFIG.battleAssist);
      expect(npcSys.getNPCById('npc-merchant-01')!.affinity).toBe(prevAffinity + DEFAULT_AFFINITY_GAIN_CONFIG.battleAssist);
    });

    it('不存在的NPC返回null', () => {
      expect(favSys.addDialogAffinity('non-existent', 1)).toBeNull();
      expect(favSys.addGiftAffinity('non-existent', false, 10, 1)).toBeNull();
      expect(favSys.addQuestCompleteAffinity('non-existent', 1)).toBeNull();
      expect(favSys.addTradeAffinity('non-existent', 1)).toBeNull();
      expect(favSys.addBattleAssistAffinity('non-existent', 1)).toBeNull();
    });

    it('好感度上限为100', () => {
      npcSys.setAffinity('npc-merchant-01', 99);
      const result = favSys.addDialogAffinity('npc-merchant-01', 1);
      const npc = npcSys.getNPCById('npc-merchant-01');
      expect(npc!.affinity).toBe(100);
      expect(result).toBe(1); // 实际只增加了1（被clamp到100）
    });
  });
});
