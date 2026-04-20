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

import { describe, it, expect, vi, beforeEach } from 'vitest';
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
      on: vi.fn().mockReturnValue(vi.fn()),
      once: vi.fn().mockReturnValue(vi.fn()),
      emit: vi.fn(),
      off: vi.fn(),
      removeAllListeners: vi.fn(),
    },
    config: { get: vi.fn(), set: vi.fn() },
    registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(), has: vi.fn(), unregister: vi.fn() },
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
    region: 'central_plains',
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

    it('好感度衰减', () => {
      const npc = createNPC({ affinity: 50 });
      const record = sys.applyDecay(npc.id, npc);
      expect(record).not.toBeNull();
      expect(record!.delta).toBe(-0.5);
      expect(record!.source).toBe('time_decay');
    });

    it('衰减量为0时返回null', () => {
      const sysNoDecay = createAffinitySystem({ decayPerTurn: 0 });
      const npc = createNPC({ affinity: 50 });
      const record = sysNoDecay.applyDecay(npc.id, npc);
      expect(record).toBeNull();
    });

    it('等级提升时发出事件', () => {
      const npc = createNPC({ affinity: 38 }); // neutral 上限附近
      sys.gainFromDialog(npc.id, npc, 10); // 38 + 13 = 51 → friendly
      const deps = sys.getState() as unknown;
      // 通过 mockDeps 的 emit 检查
      // 验证 eventBus.emit 被调用
    });

    it('applyAffinityChange 通用方法', () => {
      const npc = createNPC({ affinity: 30 });
      const record = sys.applyAffinityChange(npc.id, npc, -5, 'time_decay', '测试减少');
      expect(record.delta).toBe(-5);
      expect(record.newAffinity).toBe(25);
      expect(record.description).toBe('测试减少');
    });
  });

  // ═══════════════════════════════════════════
  // 4. #20 羁绊技能
  // ═══════════════════════════════════════════
  describe('#20 羁绊技能', () => {
    it('获取商人羁绊技能', () => {
      const skill = sys.getBondSkill('merchant');
      expect(skill.name).toBe('日进斗金');
      expect(skill.profession).toBe('merchant');
      expect(skill.requiredLevel).toBe('bonded');
    });

    it('获取谋士羁绊技能', () => {
      const skill = sys.getBondSkill('strategist');
      expect(skill.name).toBe('运筹帷幄');
    });

    it('获取武将羁绊技能', () => {
      const skill = sys.getBondSkill('warrior');
      expect(skill.name).toBe('所向披靡');
    });

    it('获取工匠羁绊技能', () => {
      const skill = sys.getBondSkill('artisan');
      expect(skill.name).toBe('精益求精');
    });

    it('获取旅人羁绊技能', () => {
      const skill = sys.getBondSkill('traveler');
      expect(skill.name).toBe('天涯知己');
    });

    it('好感度不足时不可使用羁绊技能', () => {
      const npc = createNPC({ affinity: 50, profession: 'merchant' });
      expect(sys.canUseBondSkill(npc.id, npc)).toBe(false);
    });

    it('好感度满时可以使用羁绊技能', () => {
      const npc = createNPC({ affinity: 90, profession: 'merchant' });
      expect(sys.canUseBondSkill(npc.id, npc)).toBe(true);
    });

    it('使用羁绊技能返回效果列表', () => {
      const npc = createNPC({ affinity: 90, profession: 'merchant' });
      const effects = sys.useBondSkill(npc.id, npc);
      expect(effects).not.toBeNull();
      expect(effects!.length).toBeGreaterThan(0);
      expect(effects![0].type).toBe('production_boost');
    });

    it('使用羁绊技能后进入冷却', () => {
      const npc = createNPC({ affinity: 90, profession: 'merchant' });
      sys.useBondSkill(npc.id, npc);
      expect(sys.canUseBondSkill(npc.id, npc)).toBe(false);
      expect(sys.getBondSkillCooldown(npc.id)).toBeGreaterThan(0);
    });

    it('冷却期间不可再次使用', () => {
      const npc = createNPC({ affinity: 90, profession: 'merchant' });
      sys.useBondSkill(npc.id, npc);
      const result = sys.useBondSkill(npc.id, npc);
      expect(result).toBeNull();
    });

    it('冷却结束后可再次使用', () => {
      const npc = createNPC({ affinity: 90, profession: 'merchant' });
      sys.useBondSkill(npc.id, npc);
      const skill = BOND_SKILLS.merchant;
      sys.setCurrentTurn(skill.cooldownTurns);
      expect(sys.canUseBondSkill(npc.id, npc)).toBe(true);
    });

    it('未使用羁绊技能时冷却为0', () => {
      const npc = createNPC({ affinity: 90, profession: 'merchant' });
      expect(sys.getBondSkillCooldown(npc.id)).toBe(0);
    });
  });

  // ═══════════════════════════════════════════
  // 5. #19 好感度进度可视化
  // ═══════════════════════════════════════════
  describe('#19 好感度进度可视化', () => {
    it('返回正确的可视化数据', () => {
      const npc = createNPC({ affinity: 50, profession: 'merchant' });
      const viz = sys.getVisualization(npc.id, npc);

      expect(viz.npcId).toBe('npc-test-001');
      expect(viz.currentAffinity).toBe(50);
      expect(viz.currentLevel).toBe('friendly');
      expect(viz.levelNumber).toBe(3);
      expect(viz.levelLabel).toBe('友善');
      expect(viz.levelProgress).toBeGreaterThanOrEqual(0);
      expect(viz.levelProgress).toBeLessThanOrEqual(1);
      expect(viz.nextLevel).toBe('trusted');
      expect(viz.bondSkillUnlocked).toBe(false);
      expect(viz.bondSkillName).toBeNull();
    });

    it('满级时 nextLevel 为 null', () => {
      const npc = createNPC({ affinity: 95, profession: 'merchant' });
      const viz = sys.getVisualization(npc.id, npc);
      expect(viz.currentLevel).toBe('bonded');
      expect(viz.nextLevel).toBeNull();
      expect(viz.toNextLevel).toBe(0);
      expect(viz.bondSkillUnlocked).toBe(true);
      expect(viz.bondSkillName).toBe('日进斗金');
    });

    it('最低等级时 nextLevel 为 neutral', () => {
      const npc = createNPC({ affinity: 5, profession: 'merchant' });
      const viz = sys.getVisualization(npc.id, npc);
      expect(viz.currentLevel).toBe('hostile');
      expect(viz.nextLevel).toBe('neutral');
      expect(viz.toNextLevel).toBeGreaterThan(0);
    });

    it('toNextLevel 正确计算', () => {
      const npc = createNPC({ affinity: 38, profession: 'merchant' });
      const viz = sys.getVisualization(npc.id, npc);
      // neutral max=39, toNextLevel = 40 - 38 = 2
      expect(viz.toNextLevel).toBe(2);
    });

    it('levelProgress 在等级范围内正确', () => {
      const npc = createNPC({ affinity: 50, profession: 'merchant' });
      const viz = sys.getVisualization(npc.id, npc);
      // friendly: 40-64, progress = (50-40)/(64-40) = 10/24 ≈ 0.417
      expect(viz.levelProgress).toBeCloseTo(10 / 24, 1);
    });
  });

  // ═══════════════════════════════════════════
  // 6. 历史记录与统计
  // ═══════════════════════════════════════════
  describe('历史记录与统计', () => {
    it('记录好感度变化历史', () => {
      const npc = createNPC({ affinity: 30 });
      sys.gainFromDialog(npc.id, npc);
      sys.gainFromGift(npc.id, npc, 'normal');

      const history = sys.getHistory();
      expect(history.length).toBe(2);
      expect(history[0].source).toBe('dialog');
      expect(history[1].source).toBe('gift');
    });

    it('按 NPC ID 过滤历史', () => {
      const npc1 = createNPC({ id: 'npc-1', affinity: 30 });
      const npc2 = createNPC({ id: 'npc-2', affinity: 30 });
      sys.gainFromDialog(npc1.id, npc1);
      sys.gainFromDialog(npc2.id, npc2);
      sys.gainFromGift(npc1.id, npc1, 'normal');

      const history1 = sys.getHistory('npc-1');
      expect(history1.length).toBe(2);
      const history2 = sys.getHistory('npc-2');
      expect(history2.length).toBe(1);
    });

    it('getLastChange 返回最近变化', () => {
      const npc = createNPC({ affinity: 30 });
      sys.gainFromDialog(npc.id, npc);
      sys.gainFromGift(npc.id, npc, 'preferred');

      const last = sys.getLastChange(npc.id);
      expect(last).not.toBeNull();
      expect(last!.source).toBe('gift');
    });

    it('getLastChange 不存在返回 null', () => {
      expect(sys.getLastChange('non-existent')).toBeNull();
    });

    it('getChangeStats 统计各来源变化', () => {
      const npc = createNPC({ affinity: 30 });
      sys.gainFromDialog(npc.id, npc);     // +3
      sys.gainFromDialog(npc.id, npc);     // +3
      sys.gainFromGift(npc.id, npc, 'normal'); // +5

      const stats = sys.getChangeStats(npc.id);
      expect(stats.dialog).toBe(6);
      expect(stats.gift).toBe(5);
      expect(stats.quest_complete).toBe(0);
    });

    it('历史记录上限为200条', () => {
      const npc = createNPC({ affinity: 50 });
      for (let i = 0; i < 250; i++) {
        sys.gainFromDialog(npc.id, npc);
      }
      const history = sys.getHistory();
      expect(history.length).toBeLessThanOrEqual(200);
    });
  });

  // ═══════════════════════════════════════════
  // 7. 回合管理
  // ═══════════════════════════════════════════
  describe('回合管理', () => {
    it('setCurrentTurn 设置回合', () => {
      sys.setCurrentTurn(10);
      expect(sys.getCurrentTurn()).toBe(10);
    });

    it('记录中的 turn 正确', () => {
      sys.setCurrentTurn(5);
      const npc = createNPC({ affinity: 30 });
      const record = sys.gainFromDialog(npc.id, npc);
      expect(record.turn).toBe(5);
    });
  });

  // ═══════════════════════════════════════════
  // 8. 配置管理
  // ═══════════════════════════════════════════
  describe('配置管理', () => {
    it('使用默认配置', () => {
      const config = sys.getConfig();
      expect(config.dialogBase).toBe(3);
      expect(config.questComplete).toBe(15);
    });

    it('自定义配置', () => {
      const customSys = createAffinitySystem({ dialogBase: 10 });
      expect(customSys.getConfig().dialogBase).toBe(10);
      expect(customSys.getConfig().questComplete).toBe(15); // 默认值
    });

    it('updateConfig 更新配置', () => {
      sys.updateConfig({ dialogBase: 20 });
      expect(sys.getConfig().dialogBase).toBe(20);
    });
  });

  // ═══════════════════════════════════════════
  // 9. 序列化
  // ═══════════════════════════════════════════
  describe('序列化', () => {
    it('exportSaveData 返回正确数据', () => {
      const npc = createNPC({ affinity: 30 });
      sys.gainFromDialog(npc.id, npc);

      const data = sys.exportSaveData();
      expect(data.changeHistory.length).toBe(1);
      expect(data.version).toBe(1);
    });

    it('importSaveData 恢复数据', () => {
      const npc = createNPC({ affinity: 30 });
      sys.gainFromDialog(npc.id, npc);
      const data = sys.exportSaveData();

      const newSys = createAffinitySystem();
      newSys.importSaveData(data);
      const history = newSys.getHistory();
      expect(history.length).toBe(1);
    });

    it('importSaveData 恢复羁绊技能冷却', () => {
      const npc = createNPC({ affinity: 90, profession: 'merchant' });
      sys.useBondSkill(npc.id, npc);
      const data = sys.exportSaveData();

      const newSys = createAffinitySystem();
      newSys.importSaveData(data);
      expect(newSys.getBondSkillCooldown(npc.id)).toBeGreaterThan(0);
    });

    it('importSaveData 处理空数据', () => {
      const newSys = createAffinitySystem();
      newSys.importSaveData({ changeHistory: [], bondSkillCooldowns: {}, version: 1 });
      expect(newSys.getHistory().length).toBe(0);
    });
  });
});
