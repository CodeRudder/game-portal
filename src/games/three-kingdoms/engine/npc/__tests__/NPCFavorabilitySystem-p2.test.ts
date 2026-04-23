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
  // 3. 好感度获取途径（续：历史记录）
  // ═══════════════════════════════════════════
  describe('好感度获取途径（#18）', () => {
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
        'npc:bondSkillActivated',
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

    it('tickBondEffects 冷却到期后效果过期', () => {
      npcSys.setAffinity('npc-merchant-01', 90);
      favSys.activateBondSkill('npc-merchant-01', 1);

      // merchant cooldownTurns=10, cooldownEnd=11
      const expired1 = favSys.tickBondEffects(10);
      expect(expired1.length).toBe(0); // 10 < 11, 未过期

      const expired2 = favSys.tickBondEffects(11);
      expect(expired2.length).toBe(1); // 11 >= 11, 过期
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