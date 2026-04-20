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

    it('getTradeDiscount 不存在的NPC返回1.0', () => {
      expect(favSys.getTradeDiscount('non-existent')).toBe(1.0);
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
      expect(result).toBe(prevAffinity + DEFAULT_AFFINITY_GAIN_CONFIG.dialogBase);
    });

    it('addGiftAffinity 赠送普通物品增加好感度', () => {
      const npc = npcSys.getNPCById('npc-merchant-01');
      const prevAffinity = npc!.affinity;

      const result = favSys.addGiftAffinity('npc-merchant-01', false, 10, 1);
      expect(result).not.toBeNull();
      expect(result).toBe(prevAffinity + 10); // 10 * 1.0
    });

    it('addGiftAffinity 赠送偏好物品加倍好感度', () => {
      const npc = npcSys.getNPCById('npc-merchant-01');
      const prevAffinity = npc!.affinity;

      const result = favSys.addGiftAffinity('npc-merchant-01', true, 10, 1);
      expect(result).not.toBeNull();
      expect(result).toBe(prevAffinity + 20); // 10 * 2.0
    });

    it('addQuestCompleteAffinity 完成任务增加好感度', () => {
      const npc = npcSys.getNPCById('npc-merchant-01');
      const prevAffinity = npc!.affinity;

      const result = favSys.addQuestCompleteAffinity('npc-merchant-01', 1);
      expect(result).not.toBeNull();
      expect(result).toBe(prevAffinity + DEFAULT_AFFINITY_GAIN_CONFIG.questComplete);
    });

    it('addTradeAffinity 通过交易增加好感度', () => {
      const npc = npcSys.getNPCById('npc-merchant-01');
      const prevAffinity = npc!.affinity;

      const result = favSys.addTradeAffinity('npc-merchant-01', 1);
      expect(result).not.toBeNull();
      expect(result).toBe(prevAffinity + DEFAULT_AFFINITY_GAIN_CONFIG.tradeBase);
    });

    it('addBattleAssistAffinity 通过战斗协助增加好感度', () => {
      const npc = npcSys.getNPCById('npc-merchant-01');
      const prevAffinity = npc!.affinity;

      const result = favSys.addBattleAssistAffinity('npc-merchant-01', 1);
      expect(result).not.toBeNull();
      expect(result).toBe(prevAffinity + DEFAULT_AFFINITY_GAIN_CONFIG.battleAssist);
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
      favSys.addDialogAffinity('npc-merchant-01', 1);
      const npc = npcSys.getNPCById('npc-merchant-01');
      expect(npc!.affinity).toBe(100);
    });

    it('好感度变化被记录', () => {
      favSys.addDialogAffinity('npc-merchant-01', 1);
      const history = favSys.getChangeHistory();
      expect(history.length).toBe(1);
      expect(history[0].source).toBe('dialog');
      expect(history[0].delta).toBe(DEFAULT_AFFINITY_GAIN_CONFIG.dialogBase);
    });

    it('getNPCChangeHistory 按NPC过滤', () => {
      favSys.addDialogAffinity('npc-merchant-01', 1);
      favSys.addDialogAffinity('npc-strategist-01', 1);

      const history = favSys.getNPCChangeHistory('npc-merchant-01');
      expect(history.length).toBe(1);
      expect(history[0].npcId).toBe('npc-merchant-01');
    });
  });

  // ═══════════════════════════════════════════
  // 4. 好感度进度可视化（#19）
  // ═══════════════════════════════════════════
  describe('好感度进度可视化（#19）', () => {
    it('getVisualization 返回可视化数据', () => {
      const vis = favSys.getVisualization('npc-merchant-01');
      expect(vis).not.toBeNull();
      expect(vis!.npcId).toBe('npc-merchant-01');
      expect(vis!.currentAffinity).toBe(30);
      expect(vis!.currentLevel).toBe('neutral');
      expect(vis!.levelNumber).toBe(2);
      expect(vis!.levelLabel).toBe('中立');
    });

    it('levelProgress 在 0-1 范围内', () => {
      const vis = favSys.getVisualization('npc-merchant-01');
      expect(vis!.levelProgress).toBeGreaterThanOrEqual(0);
      expect(vis!.levelProgress).toBeLessThanOrEqual(1);
    });

    it('toNextLevel 计算正确', () => {
      const vis = favSys.getVisualization('npc-merchant-01');
      // 30 → friendly 需要 40, 差 10
      expect(vis!.toNextLevel).toBe(10);
      expect(vis!.nextLevel).toBe('friendly');
    });

    it('满级时 toNextLevel 为 0, nextLevel 为 null', () => {
      npcSys.setAffinity('npc-merchant-01', 95);
      const vis = favSys.getVisualization('npc-merchant-01');
      expect(vis!.toNextLevel).toBe(0);
      expect(vis!.nextLevel).toBeNull();
    });

    it('羁绊等级时 bondSkillUnlocked 为 true', () => {
      npcSys.setAffinity('npc-merchant-01', 90);
      const vis = favSys.getVisualization('npc-merchant-01');
      expect(vis!.bondSkillUnlocked).toBe(true);
      expect(vis!.bondSkillName).toBe(BOND_SKILLS.merchant.name);
    });

    it('非羁绊等级时 bondSkillUnlocked 为 false', () => {
      npcSys.setAffinity('npc-merchant-01', 50);
      const vis = favSys.getVisualization('npc-merchant-01');
      expect(vis!.bondSkillUnlocked).toBe(false);
      expect(vis!.bondSkillName).toBeNull();
    });

    it('getVisualizations 批量获取', () => {
      const vis = favSys.getVisualizations(['npc-merchant-01', 'npc-strategist-01']);
      expect(vis.length).toBe(2);
    });

    it('不存在的NPC返回null', () => {
      expect(favSys.getVisualization('non-existent')).toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // 5. 羁绊技能（#20）
  // ═══════════════════════════════════════════
  describe('羁绊技能（#20）', () => {
    it('每种职业都有羁绊技能', () => {
      const professions = ['merchant', 'strategist', 'warrior', 'artisan', 'traveler'];
      for (const prof of professions) {
        const skill = favSys.getBondSkill(prof);
        expect(skill).not.toBeNull();
        expect(skill!.profession).toBe(prof);
      }
    });

    it('羁绊技能需要 bonded 等级', () => {
      // 低好感度不能激活
      npcSys.setAffinity('npc-merchant-01', 50);
      const result = favSys.activateBondSkill('npc-merchant-01', 1);
      expect(result).toBeNull();
    });

    it('羁绊等级可以激活技能', () => {
      npcSys.setAffinity('npc-merchant-01', 90);
      const result = favSys.activateBondSkill('npc-merchant-01', 1);
      expect(result).not.toBeNull();
      expect(result!.id).toBe('bond-merchant-goldrush');
    });

    it('激活后进入冷却', () => {
      npcSys.setAffinity('npc-merchant-01', 90);
      favSys.activateBondSkill('npc-merchant-01', 1);

      // 冷却中不能再激活
      const result = favSys.activateBondSkill('npc-merchant-01', 2);
      expect(result).toBeNull();
    });

    it('getBondSkillCooldown 返回冷却剩余', () => {
      npcSys.setAffinity('npc-merchant-01', 90);
      favSys.activateBondSkill('npc-merchant-01', 5);

      const cooldown = favSys.getBondSkillCooldown('npc-merchant-01', 6);
      expect(cooldown).toBeGreaterThan(0);
    });

    it('冷却结束后可以再次激活', () => {
      npcSys.setAffinity('npc-merchant-01', 90);
      favSys.activateBondSkill('npc-merchant-01', 1);

      const skill = BOND_SKILLS.merchant;
      const cooldownEnd = 1 + skill.cooldownTurns;

      // 冷却结束后
      const result = favSys.activateBondSkill('npc-merchant-01', cooldownEnd);
      expect(result).not.toBeNull();
    });

    it('激活羁绊技能发出事件', () => {
      const ctx = createSystemWithNPC();
      ctx.npcSys.setAffinity('npc-merchant-01', 90);
      ctx.favSys.activateBondSkill('npc-merchant-01', 1);

      expect(ctx.deps.eventBus.emit).toHaveBeenCalledWith(
        'npc:bond_skill_activated',
        expect.objectContaining({
          npcId: 'npc-merchant-01',
          skillId: 'bond-merchant-goldrush',
        }),
      );
    });

    it('getActiveBondEffects 返回活跃效果', () => {
      npcSys.setAffinity('npc-merchant-01', 90);
      favSys.activateBondSkill('npc-merchant-01', 1);

      const effects = favSys.getActiveBondEffects();
      expect(effects.size).toBe(1);
    });

    it('tickBondEffects 减少持续回合', () => {
      npcSys.setAffinity('npc-merchant-01', 90);
      favSys.activateBondSkill('npc-merchant-01', 1);

      // 效果持续3回合
      const expired1 = favSys.tickBondEffects(2);
      expect(expired1.length).toBe(0);

      const expired2 = favSys.tickBondEffects(3);
      expect(expired2.length).toBe(0);

      const expired3 = favSys.tickBondEffects(4);
      // 最后一次减少后 duration=0，应该过期
      expect(expired3.length).toBe(1);
    });
  });

  // ═══════════════════════════════════════════
  // 6. 好感度时间衰减
  // ═══════════════════════════════════════════
  describe('好感度时间衰减', () => {
    it('超过10回合未交互的好感度衰减', () => {
      // 设置 lastInteractedAt 为 0，当前回合 12
      npcSys.setAffinity('npc-merchant-01', 50);
      favSys.processDecay(['npc-merchant-01'], 12);

      const npc = npcSys.getNPCById('npc-merchant-01');
      expect(npc!.affinity).toBeLessThan(50);
    });

    it('10回合内不衰减', () => {
      npcSys.setAffinity('npc-merchant-01', 50);
      npcSys.updateLastInteracted('npc-merchant-01', 5);

      favSys.processDecay(['npc-merchant-01'], 10);

      const npc = npcSys.getNPCById('npc-merchant-01');
      expect(npc!.affinity).toBe(50);
    });

    it('好感度不低于0', () => {
      npcSys.setAffinity('npc-merchant-01', 1);
      favSys.processDecay(['npc-merchant-01'], 20);

      const npc = npcSys.getNPCById('npc-merchant-01');
      expect(npc!.affinity).toBeGreaterThanOrEqual(0);
    });
  });

  // ═══════════════════════════════════════════
  // 7. 配置管理
  // ═══════════════════════════════════════════
  describe('配置管理', () => {
    it('getGainConfig 返回默认配置', () => {
      const config = favSys.getGainConfig();
      expect(config.dialogBase).toBe(DEFAULT_AFFINITY_GAIN_CONFIG.dialogBase);
      expect(config.questComplete).toBe(DEFAULT_AFFINITY_GAIN_CONFIG.questComplete);
    });

    it('setGainConfig 更新配置', () => {
      favSys.setGainConfig({ dialogBase: 10 });
      expect(favSys.getGainConfig().dialogBase).toBe(10);
    });

    it('更新配置后好感度获取量变化', () => {
      favSys.setGainConfig({ dialogBase: 20 });
      const npc = npcSys.getNPCById('npc-merchant-01');
      const prev = npc!.affinity;

      favSys.addDialogAffinity('npc-merchant-01', 1);
      const updated = npcSys.getNPCById('npc-merchant-01');
      expect(updated!.affinity).toBe(prev + 20);
    });
  });

  // ═══════════════════════════════════════════
  // 8. 存档序列化
  // ═══════════════════════════════════════════
  describe('存档序列化', () => {
    it('serialize 导出完整存档', () => {
      favSys.addDialogAffinity('npc-merchant-01', 1);
      const data = favSys.serialize();
      expect(data.changeHistory.length).toBe(1);
      expect(data.version).toBe(1);
    });

    it('deserialize 恢复存档', () => {
      favSys.addDialogAffinity('npc-merchant-01', 1);
      favSys.addDialogAffinity('npc-merchant-01', 2);
      const data = favSys.serialize();

      const ctx = createSystemWithNPC();
      ctx.favSys.deserialize(data);
      const history = ctx.favSys.getChangeHistory();
      expect(history.length).toBe(2);
    });

    it('deserialize 恢复冷却数据', () => {
      npcSys.setAffinity('npc-merchant-01', 90);
      favSys.activateBondSkill('npc-merchant-01', 1);
      const data = favSys.serialize();

      const ctx = createSystemWithNPC();
      ctx.favSys.deserialize(data);
      expect(ctx.favSys.getBondSkillCooldown('npc-merchant-01', 5)).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════
  // 9. 历史记录管理
  // ═══════════════════════════════════════════
  describe('历史记录管理', () => {
    it('getChangeHistory 支持限制数量', () => {
      for (let i = 0; i < 10; i++) {
        favSys.addDialogAffinity('npc-merchant-01', i);
      }

      const history = favSys.getChangeHistory(5);
      expect(history.length).toBe(5);
    });

    it('getNPCChangeHistory 支持限制数量', () => {
      for (let i = 0; i < 5; i++) {
        favSys.addDialogAffinity('npc-merchant-01', i);
      }
      favSys.addDialogAffinity('npc-strategist-01', 1);

      const history = favSys.getNPCChangeHistory('npc-merchant-01', 3);
      expect(history.length).toBe(3);
      expect(history.every((r) => r.npcId === 'npc-merchant-01')).toBe(true);
    });
  });
});
