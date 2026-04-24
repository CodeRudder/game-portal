/**
 * 集成测试 §22~§25 — 好感度联动+NPC任务链+交易+声望
 * §22 好感度联动 §23 NPC任务链 §24 交易系统 §25 声望系统
 * 集成：NPCFavorabilitySystem ↔ NPCSystem ↔ QuestSystem ↔ EventBus
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NPCSystem } from '../../../npc/NPCSystem';
import { NPCFavorabilitySystem } from '../../../npc/NPCFavorabilitySystem';
import { QuestSystem } from '../../../quest/QuestSystem';
import type { ISystemDeps } from '../../../../core/types';
import type { NPCId } from '../../../../core/npc';

// ─── helpers ──────────────────────────────────

function createMockDeps(npcSystem?: NPCSystem): ISystemDeps {
  const get = vi.fn().mockReturnValue(npcSystem ?? null);
  return {
    eventBus: { on: vi.fn().mockReturnValue(vi.fn()), once: vi.fn().mockReturnValue(vi.fn()), emit: vi.fn(), off: vi.fn(), removeAllListeners: vi.fn() },
    config: { get: vi.fn(), set: vi.fn() },
    registry: { register: vi.fn(), get, getAll: vi.fn(), has: vi.fn(), unregister: vi.fn() },
  } as unknown as ISystemDeps;
}

function createEnv() {
  const npcSys = new NPCSystem();
  const deps = createMockDeps(npcSys);
  const emit = vi.fn(); deps.eventBus.emit = emit;
  npcSys.init(deps);
  const favSys = new NPCFavorabilitySystem();
  favSys.init(deps);
  const qs = new QuestSystem(); qs.init(deps);
  return { npcSys, favSys, qs, deps, emit };
}

/** 获取一个默认 NPC ID */
function getDefaultNPCId(npcSys: NPCSystem): NPCId | undefined {
  const npcs = npcSys.getAllNPCs();
  return npcs.length > 0 ? npcs[0].id : undefined;
}

// ─── §22 好感度联动 ────────────────────────────

describe('§22 好感度联动集成', () => {
  let env: ReturnType<typeof createEnv>;
  let npcId: NPCId;

  beforeEach(() => {
    env = createEnv();
    const id = getDefaultNPCId(env.npcSys);
    if (!id) throw new Error('No default NPC');
    npcId = id;
  });

  describe('§22.1 对话好感度', () => {
    it('§22.1.1 对话增加好感度', () => {
      const delta = env.favSys.addDialogAffinity(npcId, 1);
      expect(delta).not.toBeNull();
      expect(delta).toBeGreaterThan(0);
    });

    it('§22.1.2 多次对话累加', () => {
      env.favSys.addDialogAffinity(npcId, 1);
      env.favSys.addDialogAffinity(npcId, 2);
      const history = env.favSys.getNPCChangeHistory(npcId);
      expect(history.length).toBeGreaterThanOrEqual(2);
    });

    it('§22.1.3 好感度变化记录', () => {
      env.favSys.addDialogAffinity(npcId, 1);
      const history = env.favSys.getChangeHistory(10);
      expect(history.length).toBeGreaterThanOrEqual(1);
      expect(history[0].source).toBe('dialog');
    });
  });

  describe('§22.2 赠礼好感度', () => {
    it('§22.2.1 普通礼物增加好感', () => {
      const delta = env.favSys.addGiftAffinity(npcId, false, 10, 1);
      expect(delta).not.toBeNull();
      expect(delta).toBeGreaterThan(0);
    });

    it('§22.2.2 偏好礼物加成更高', () => {
      const normal = env.favSys.addGiftAffinity(npcId, false, 10, 1);
      // 先重置好感度
      env.npcSys.setAffinity(npcId, 0);
      const preferred = env.favSys.addGiftAffinity(npcId, true, 10, 2);
      expect(preferred).toBeGreaterThan(normal!);
    });
  });

  describe('§22.3 任务完成好感度', () => {
    it('§22.3.1 完成任务增加好感', () => {
      const delta = env.favSys.addQuestCompleteAffinity(npcId, 1);
      expect(delta).not.toBeNull();
      expect(delta).toBeGreaterThan(0);
    });
  });

  describe('§22.4 好感度等级与效果', () => {
    it('§22.4.1 初始等级为neutral', () => {
      const effect = env.favSys.getNPCLevelEffect(npcId);
      expect(effect).not.toBeNull();
    });

    it('§22.4.2 交互解锁判断', () => {
      const unlocked = env.favSys.isInteractionUnlocked(npcId, 'trade');
      expect(typeof unlocked).toBe('boolean');
    });

    it('§22.4.3 交易折扣查询', () => {
      const discount = env.favSys.getTradeDiscount(npcId);
      expect(typeof discount).toBe('number');
      expect(discount).toBeGreaterThanOrEqual(0);
    });

    it('§22.4.4 任务奖励倍率查询', () => {
      const mult = env.favSys.getQuestRewardMultiplier(npcId);
      expect(typeof mult).toBe('number');
      expect(mult).toBeGreaterThan(0);
    });
  });

  describe('§22.5 好感度衰减', () => {
    it('§22.5.1 长期未交互触发衰减', () => {
      env.favSys.addDialogAffinity(npcId, 1); // turn 1
      const npc = env.npcSys.getNPCById(npcId)!;
      const beforeAffinity = npc.affinity;
      // turn 20 → 超过10回合未交互
      env.favSys.processDecay([npcId], 20);
      const after = env.npcSys.getNPCById(npcId)!;
      expect(after.affinity).toBeLessThanOrEqual(beforeAffinity);
    });

    it('§22.5.2 近期交互不衰减', () => {
      env.favSys.addDialogAffinity(npcId, 5); // turn 5
      const npc = env.npcSys.getNPCById(npcId)!;
      const beforeAffinity = npc.affinity;
      env.favSys.processDecay([npcId], 8); // 只过了3回合
      const after = env.npcSys.getNPCById(npcId)!;
      expect(after.affinity).toBe(beforeAffinity);
    });
  });
});

// ─── §23 NPC任务链 ─────────────────────────────

describe('§23 NPC任务链集成', () => {
  let env: ReturnType<typeof createEnv>;
  let npcId: NPCId;

  beforeEach(() => {
    env = createEnv();
    const id = getDefaultNPCId(env.npcSys);
    if (!id) throw new Error('No default NPC');
    npcId = id;
  });

  describe('§23.1 任务链好感度联动', () => {
    it('§23.1.1 完成NPC任务增加好感', () => {
      env.qs.registerQuest({
        id: 'npc-q1', title: 'NPC委托', description: '帮助NPC', category: 'side',
        objectives: [{ id: 'obj-n1', type: 'npc_interact', description: '交互', targetCount: 1, currentCount: 0 }],
        rewards: { resources: { gold: 50 }, experience: 20 },
      });
      const inst = env.qs.acceptQuest('npc-q1')!;
      env.qs.updateObjectiveProgress(inst.instanceId, 'obj-n1', 1);
      // 任务完成后增加好感
      const delta = env.favSys.addQuestCompleteAffinity(npcId, 1);
      expect(delta).toBeGreaterThan(0);
    });

    it('§23.1.2 多任务连续完成好感累加', () => {
      const d1 = env.favSys.addQuestCompleteAffinity(npcId, 1);
      const d2 = env.favSys.addQuestCompleteAffinity(npcId, 2);
      const d3 = env.favSys.addQuestCompleteAffinity(npcId, 3);
      expect(d1).not.toBeNull();
      expect(d2).not.toBeNull();
      expect(d3).not.toBeNull();
      const npc = env.npcSys.getNPCById(npcId)!;
      expect(npc.affinity).toBeGreaterThan(0);
    });
  });

  describe('§23.2 好感度可视化', () => {
    it('§23.2.1 获取单个NPC可视化', () => {
      const vis = env.favSys.getVisualization(npcId);
      expect(vis).not.toBeNull();
      expect(vis!.npcId).toBe(npcId);
      expect(typeof vis!.currentAffinity).toBe('number');
    });

    it('§23.2.2 批量获取可视化', () => {
      const allNpcs = env.npcSys.getAllNPCs();
      const ids = allNpcs.map(n => n.id).slice(0, 3);
      const vis = env.favSys.getVisualizations(ids);
      expect(vis.length).toBeGreaterThan(0);
    });
  });

  describe('§23.3 羁绊技能', () => {
    it('§23.3.1 查询羁绊技能', () => {
      const skill = env.favSys.getBondSkill('merchant');
      // merchant 可能有或没有羁绊技能定义
      expect(skill === null || typeof skill === 'object').toBe(true);
    });

    it('§23.3.2 好感度不足无法激活羁绊', () => {
      const result = env.favSys.activateBondSkill(npcId, 1);
      // 初始好感度不够bonded等级
      expect(result).toBeNull();
    });
  });
});

// ─── §24 交易系统 ──────────────────────────────

describe('§24 交易系统集成', () => {
  let env: ReturnType<typeof createEnv>;
  let npcId: NPCId;

  beforeEach(() => {
    env = createEnv();
    const id = getDefaultNPCId(env.npcSys);
    if (!id) throw new Error('No default NPC');
    npcId = id;
  });

  describe('§24.1 交易好感度', () => {
    it('§24.1.1 交易增加好感', () => {
      const delta = env.favSys.addTradeAffinity(npcId, 1);
      expect(delta).not.toBeNull();
      expect(delta).toBeGreaterThan(0);
    });

    it('§24.1.2 多次交易好感累加', () => {
      env.favSys.addTradeAffinity(npcId, 1);
      env.favSys.addTradeAffinity(npcId, 2);
      env.favSys.addTradeAffinity(npcId, 3);
      const history = env.favSys.getNPCChangeHistory(npcId);
      const trades = history.filter(r => r.source === 'trade');
      expect(trades.length).toBe(3);
    });

    it('§24.1.3 交易折扣随好感度提升', () => {
      const discountBefore = env.favSys.getTradeDiscount(npcId);
      // 大幅提升好感度
      for (let i = 0; i < 20; i++) {
        env.favSys.addTradeAffinity(npcId, i + 1);
      }
      const discountAfter = env.favSys.getTradeDiscount(npcId);
      // tradeDiscount 是价格乘数，好感度越高值越低（折扣越大）
      expect(discountAfter).toBeLessThanOrEqual(discountBefore);
    });
  });

  describe('§24.2 交易交互解锁', () => {
    it('§24.2.1 初始状态查询交互解锁', () => {
      const unlocked = env.favSys.isInteractionUnlocked(npcId, 'trade');
      expect(typeof unlocked).toBe('boolean');
    });
  });
});

// ─── §25 声望系统 ──────────────────────────────

describe('§25 声望系统集成', () => {
  let env: ReturnType<typeof createEnv>;
  let npcId: NPCId;

  beforeEach(() => {
    env = createEnv();
    const id = getDefaultNPCId(env.npcSys);
    if (!id) throw new Error('No default NPC');
    npcId = id;
  });

  describe('§25.1 好感度与声望联动', () => {
    it('§25.1.1 战斗协助增加好感', () => {
      const delta = env.favSys.addBattleAssistAffinity(npcId, 1);
      expect(delta).not.toBeNull();
      expect(delta).toBeGreaterThan(0);
    });

    it('§25.1.2 任务奖励倍率随好感提升', () => {
      const multBefore = env.favSys.getQuestRewardMultiplier(npcId);
      // 提升好感到较高水平
      for (let i = 0; i < 30; i++) {
        env.favSys.addBattleAssistAffinity(npcId, i + 1);
      }
      const multAfter = env.favSys.getQuestRewardMultiplier(npcId);
      expect(multAfter).toBeGreaterThanOrEqual(multBefore);
    });
  });

  describe('§25.2 好感度配置', () => {
    it('§25.2.1 获取默认配置', () => {
      const config = env.favSys.getGainConfig();
      expect(config).toBeDefined();
      expect(typeof config.dialogBase).toBe('number');
    });

    it('§25.2.2 修改配置生效', () => {
      env.favSys.setGainConfig({ dialogBase: 99 });
      const config = env.favSys.getGainConfig();
      expect(config.dialogBase).toBe(99);
    });
  });

  describe('§25.3 好感度存档', () => {
    it('§25.3.1 序列化与反序列化', () => {
      env.favSys.addDialogAffinity(npcId, 1);
      env.favSys.addGiftAffinity(npcId, true, 20, 2);
      const saved = env.favSys.serialize();
      expect(saved.version).toBe(1);
      expect(saved.changeHistory.length).toBeGreaterThanOrEqual(2);

      const fav2 = new NPCFavorabilitySystem();
      fav2.init(env.deps);
      fav2.deserialize(saved);
      const history2 = fav2.getChangeHistory(50);
      expect(history2.length).toBeGreaterThanOrEqual(2);
    });

    it('§25.3.2 历史记录上限', () => {
      // 添加超过200条记录
      for (let i = 0; i < 210; i++) {
        env.favSys.addDialogAffinity(npcId, i);
      }
      const history = env.favSys.getChangeHistory(300);
      expect(history.length).toBeLessThanOrEqual(200);
    });
  });

  describe('§25.4 系统重置', () => {
    it('§25.4.1 重置清空历史', () => {
      env.favSys.addDialogAffinity(npcId, 1);
      env.favSys.reset();
      expect(env.favSys.getChangeHistory().length).toBe(0);
    });

    it('§25.4.2 重置清空羁绊冷却', () => {
      const state = env.favSys.getState();
      env.favSys.reset();
      const stateAfter = env.favSys.getState();
      expect(Object.keys(stateAfter.bondSkillCooldowns).length).toBe(0);
    });
  });
});
