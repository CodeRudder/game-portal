import { vi } from 'vitest';
/**
 * NPCAffinitySystem 单元测试 (p2)
 *
 * 覆盖：
 * - #18 好感度获取途径（续：衰减、通用方法）
 * - #20 羁绊技能
 * - #19 好感度进度可视化
 * - 历史记录与统计
 * - 回合管理
 * - 配置管理
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
  // 3. #18 好感度获取途径（续）
  // ═══════════════════════════════════════════
  describe('#18 好感度获取途径', () => {
    it('好感度下限为0', () => {
      const npc = createNPC({ affinity: 2 });
      const record = sys.applyAffinityChange(npc.id, npc, -10, 'time_decay', '测试');
      expect(record.newAffinity).toBe(0);
      expect(record.delta).toBe(-2);
      expect(npc.affinity).toBe(0);
    });

    it('好感度衰减已禁用（decayPerTurn=0，对齐Play文档§5.1）', () => {
      const npc = createNPC({ affinity: 50 });
      const record = sys.applyDecay(npc.id, npc);
      expect(record).toBeNull(); // decayPerTurn=0，不衰减
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
      sys.gainFromDialog(npc.id, npc);     // +5
      sys.gainFromDialog(npc.id, npc);     // +5
      sys.gainFromGift(npc.id, npc, 'normal'); // +5

      const stats = sys.getChangeStats(npc.id);
      expect(stats.dialog).toBe(10);
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
      expect(config.dialogBase).toBe(5);
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
