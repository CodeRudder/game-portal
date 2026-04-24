/**
 * 集成测试 — NPC好感度全链路 (v6.0 天下大势)
 *
 * 覆盖 Play 文档流程：
 *   §5.1 好感度等级与效果：等级划分、效果解锁
 *   §5.2 好感度获取途径：赠送/切磋/任务
 *   §5.3 好感度进度可视化：进度数据（引擎层）
 *   §5.4 NPC专属羁绊技能：好感度解锁技能
 *
 * @module engine/calendar/__tests__/integration/npc-favorability
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NPCSystem } from '../../../npc/NPCSystem';
import { NPCFavorabilitySystem } from '../../../npc/NPCFavorabilitySystem';
import { NPCAffinitySystem } from '../../../npc/NPCAffinitySystem';
import type { ISystemDeps } from '../../../../core/types';
import type { ISubsystemRegistry } from '../../../../core/types/subsystem';
import type { NPCId, NPCData, AffinityLevel } from '../../../../core/npc';
import {
  getAffinityLevel,
  getAffinityProgress,
  AFFINITY_THRESHOLDS,
  AFFINITY_LEVEL_EFFECTS,
  BOND_SKILLS,
} from '../../../../core/npc';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

function createDeps(): ISystemDeps {
  const npc = new NPCSystem();
  const favorability = new NPCFavorabilitySystem();
  const affinity = new NPCAffinitySystem();

  const registry = new Map<string, unknown>();
  registry.set('npc', npc);
  registry.set('npcFavorability', favorability);
  registry.set('npcAffinity', affinity);

  const deps: ISystemDeps = {
    eventBus: {
      on: () => () => {},
      once: () => () => {},
      emit: () => {},
      off: () => {},
      removeAllListeners: () => {},
    },
    config: { get: () => undefined, set: () => {} },
    registry: {
      register: () => {},
      get: (name: string) => registry.get(name) ?? null,
      getAll: () => new Map(),
      has: (name: string) => registry.has(name),
      unregister: () => {},
    } as unknown as ISubsystemRegistry,
  };

  npc.init(deps);
  favorability.init(deps);
  affinity.init(deps);

  return deps;
}

function getSys(deps: ISystemDeps) {
  return {
    npc: deps.registry!.get<NPCSystem>('npc')!,
    fav: deps.registry!.get<NPCFavorabilitySystem>('npcFavorability')!,
    affinity: deps.registry!.get<NPCAffinitySystem>('npcAffinity')!,
  };
}

/** 获取一个有效的NPC ID */
function getValidNPCId(sys: ReturnType<typeof getSys>): NPCId | null {
  const npcs = sys.npc.getAllNPCs();
  return npcs.length > 0 ? npcs[0].id : null;
}

/** 获取指定职业的NPC */
function getNPCByProfession(sys: ReturnType<typeof getSys>, profession: string): NPCData | null {
  const npcs = sys.npc.getAllNPCs();
  return npcs.find(n => n.profession === profession) ?? null;
}

// ═════════════════════════════════════════════
// §5.1 好感度等级与效果
// ═════════════════════════════════════════════

describe('§5.1 好感度等级与效果', () => {
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    sys = getSys(createDeps());
  });

  // --- 等级划分 ---

  it('5个好感度等级：hostile/neutral/friendly/trusted/bonded', () => {
    const levels: AffinityLevel[] = ['hostile', 'neutral', 'friendly', 'trusted', 'bonded'];
    expect(AFFINITY_THRESHOLDS).toHaveProperty('hostile');
    expect(AFFINITY_THRESHOLDS).toHaveProperty('neutral');
    expect(AFFINITY_THRESHOLDS).toHaveProperty('friendly');
    expect(AFFINITY_THRESHOLDS).toHaveProperty('trusted');
    expect(AFFINITY_THRESHOLDS).toHaveProperty('bonded');
    expect(levels.length).toBe(5);
  });

  it('getAffinityLevel(0) → hostile', () => {
    expect(getAffinityLevel(0)).toBe('hostile');
  });

  it('getAffinityLevel(20) → neutral', () => {
    expect(getAffinityLevel(20)).toBe('neutral');
  });

  it('getAffinityLevel(40) → friendly', () => {
    expect(getAffinityLevel(40)).toBe('friendly');
  });

  it('getAffinityLevel(65) → trusted', () => {
    expect(getAffinityLevel(65)).toBe('trusted');
  });

  it('getAffinityLevel(85) → bonded', () => {
    expect(getAffinityLevel(85)).toBe('bonded');
  });

  it('getAffinityLevel(100) → bonded', () => {
    expect(getAffinityLevel(100)).toBe('bonded');
  });

  // --- 效果解锁 ---

  it('AFFINITY_LEVEL_EFFECTS 包含5个等级的效果定义', () => {
    expect(Object.keys(AFFINITY_LEVEL_EFFECTS).length).toBe(5);
  });

  it('每个等级效果包含 tradeDiscount/intelAccuracy/questRewardMultiplier', () => {
    for (const level of Object.values(AFFINITY_LEVEL_EFFECTS)) {
      expect(level).toHaveProperty('tradeDiscount');
      expect(level).toHaveProperty('intelAccuracy');
      expect(level).toHaveProperty('questRewardMultiplier');
      expect(level).toHaveProperty('unlockedInteractions');
    }
  });

  it('bonded等级交易折扣最大（0.6）', () => {
    expect(AFFINITY_LEVEL_EFFECTS.bonded.tradeDiscount).toBe(0.6);
  });

  it('hostile等级不可交易（unlockedInteractions 不含 trade）', () => {
    expect(AFFINITY_LEVEL_EFFECTS.hostile.unlockedInteractions).not.toContain('trade');
  });

  it('getLevelEffect 返回正确等级效果', () => {
    const effect = sys.fav.getLevelEffect('bonded');
    expect(effect.level).toBe('bonded');
    expect(effect.levelNumber).toBe(5);
  });

  it('getNPCLevelEffect 根据NPC当前好感度返回效果', () => {
    const npcId = getValidNPCId(sys);
    if (!npcId) return;
    const npc = sys.npc.getNPCById(npcId)!;
    const effect = sys.fav.getNPCLevelEffect(npcId);
    expect(effect).not.toBeNull();
    expect(effect!.level).toBe(getAffinityLevel(npc.affinity));
  });

  it('isInteractionUnlocked 正确判断交互解锁', () => {
    const npcId = getValidNPCId(sys);
    if (!npcId) return;
    // 初始好感度通常为0（hostile），仅能对话
    const canTalk = sys.fav.isInteractionUnlocked(npcId, 'talk');
    const canTrade = sys.fav.isInteractionUnlocked(npcId, 'trade');
    expect(canTalk).toBe(true); // hostile 可以 talk
    // trade 需要 neutral 及以上
    const npc = sys.npc.getNPCById(npcId)!;
    if (getAffinityLevel(npc.affinity) === 'hostile') {
      expect(canTrade).toBe(false);
    }
  });

  it('getTradeDiscount 随等级递增折扣', () => {
    const discount0 = sys.fav.getTradeDiscount('nonexistent-npc');
    expect(discount0).toBe(0); // NPC不存在返回0

    const npcId = getValidNPCId(sys);
    if (!npcId) return;
    // 设置好感度到bonded
    sys.npc.setAffinity(npcId, 90);
    const discount = sys.fav.getTradeDiscount(npcId);
    expect(discount).toBe(0.6); // bonded折扣
  });

  it('getQuestRewardMultiplier bonded时为1.5', () => {
    const npcId = getValidNPCId(sys);
    if (!npcId) return;
    sys.npc.setAffinity(npcId, 90);
    const mult = sys.fav.getQuestRewardMultiplier(npcId);
    expect(mult).toBe(1.5);
  });
});

// ═════════════════════════════════════════════
// §5.2 好感度获取途径
// ═════════════════════════════════════════════

describe('§5.2 好感度获取途径', () => {
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    sys = getSys(createDeps());
  });

  // --- NPCFavorabilitySystem 途径 ---

  it('addDialogAffinity 增加对话好感度', () => {
    const npcId = getValidNPCId(sys);
    if (!npcId) return;
    const npc = sys.npc.getNPCById(npcId)!;
    const before = npc.affinity;
    const delta = sys.fav.addDialogAffinity(npcId, 1);
    expect(delta).not.toBeNull();
    expect(delta).toBeGreaterThan(0);
    const after = sys.npc.getNPCById(npcId)!;
    expect(after.affinity).toBeGreaterThan(before);
  });

  it('addGiftAffinity 偏好物品好感度 > 普通物品', () => {
    const npcId = getValidNPCId(sys);
    if (!npcId) return;

    // 先重置好感度
    sys.npc.setAffinity(npcId, 10);

    const deltaNormal = sys.fav.addGiftAffinity(npcId, false, 10, 1);
    sys.npc.setAffinity(npcId, 10); // 重置
    const deltaPreferred = sys.fav.addGiftAffinity(npcId, true, 10, 1);

    if (deltaNormal !== null && deltaPreferred !== null) {
      expect(deltaPreferred).toBeGreaterThanOrEqual(deltaNormal);
    }
  });

  it('addQuestCompleteAffinity 增加任务好感度', () => {
    const npcId = getValidNPCId(sys);
    if (!npcId) return;
    sys.npc.setAffinity(npcId, 10);
    const delta = sys.fav.addQuestCompleteAffinity(npcId, 1);
    expect(delta).not.toBeNull();
    expect(delta).toBeGreaterThan(0);
  });

  it('addTradeAffinity 增加交易好感度', () => {
    const npcId = getValidNPCId(sys);
    if (!npcId) return;
    sys.npc.setAffinity(npcId, 10);
    const delta = sys.fav.addTradeAffinity(npcId, 1);
    expect(delta).not.toBeNull();
    expect(delta).toBeGreaterThan(0);
  });

  it('addBattleAssistAffinity 增加战斗协助好感度', () => {
    const npcId = getValidNPCId(sys);
    if (!npcId) return;
    sys.npc.setAffinity(npcId, 10);
    const delta = sys.fav.addBattleAssistAffinity(npcId, 1);
    expect(delta).not.toBeNull();
    expect(delta).toBeGreaterThan(0);
  });

  it('好感度上限为100，不可超过', () => {
    const npcId = getValidNPCId(sys);
    if (!npcId) return;
    sys.npc.setAffinity(npcId, 99);
    sys.fav.addQuestCompleteAffinity(npcId, 1);
    const npc = sys.npc.getNPCById(npcId)!;
    expect(npc.affinity).toBeLessThanOrEqual(100);
  });

  it('好感度下限为0，不可低于', () => {
    const npcId = getValidNPCId(sys);
    if (!npcId) return;
    sys.npc.setAffinity(npcId, 0);
    // processDecay不应使好感度低于0
    sys.fav.processDecay([npcId], 100);
    const npc = sys.npc.getNPCById(npcId)!;
    expect(npc.affinity).toBeGreaterThanOrEqual(0);
  });

  it('不存在的NPC返回null', () => {
    const delta = sys.fav.addDialogAffinity('nonexistent-npc', 1);
    expect(delta).toBeNull();
  });

  // --- NPCAffinitySystem 途径 ---

  it('gainFromDialog 通过AffinitySystem增加好感度', () => {
    const npcId = getValidNPCId(sys);
    if (!npcId) return;
    const npc = sys.npc.getNPCById(npcId)!;
    sys.npc.setAffinity(npcId, 10);
    const freshNpc = sys.npc.getNPCById(npcId)!;
    const record = sys.affinity.gainFromDialog(npcId, freshNpc);
    expect(record.delta).toBeGreaterThan(0);
    expect(record.source).toBe('dialog');
  });

  it('gainFromGift 不同礼物类型好感度不同', () => {
    const npcId = getValidNPCId(sys);
    if (!npcId) return;

    sys.npc.setAffinity(npcId, 10);
    let npc = sys.npc.getNPCById(npcId)!;
    const normalRecord = sys.affinity.gainFromGift(npcId, npc, 'normal');

    sys.npc.setAffinity(npcId, 10);
    npc = sys.npc.getNPCById(npcId)!;
    const rareRecord = sys.affinity.gainFromGift(npcId, npc, 'rare');

    expect(rareRecord.delta).toBeGreaterThan(normalRecord.delta);
  });

  it('gainFromQuest 增加任务好感度', () => {
    const npcId = getValidNPCId(sys);
    if (!npcId) return;
    sys.npc.setAffinity(npcId, 10);
    const npc = sys.npc.getNPCById(npcId)!;
    const record = sys.affinity.gainFromQuest(npcId, npc);
    expect(record.delta).toBeGreaterThan(0);
    expect(record.source).toBe('quest_complete');
  });

  // --- 历史记录 ---

  it('好感度变化记录在 changeHistory 中', () => {
    const npcId = getValidNPCId(sys);
    if (!npcId) return;
    sys.npc.setAffinity(npcId, 10);
    sys.fav.addDialogAffinity(npcId, 1);
    const history = sys.fav.getChangeHistory();
    expect(history.length).toBeGreaterThan(0);
    const last = history[history.length - 1];
    expect(last.npcId).toBe(npcId);
    expect(last.source).toBe('dialog');
  });

  it('getNPCChangeHistory 按NPC过滤历史', () => {
    const npcId = getValidNPCId(sys);
    if (!npcId) return;
    sys.npc.setAffinity(npcId, 10);
    sys.fav.addDialogAffinity(npcId, 1);
    const history = sys.fav.getNPCChangeHistory(npcId);
    expect(history.length).toBeGreaterThan(0);
    for (const r of history) {
      expect(r.npcId).toBe(npcId);
    }
  });
});

// ═════════════════════════════════════════════
// §5.3 好感度进度可视化
// ═════════════════════════════════════════════

describe('§5.3 好感度进度可视化', () => {
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    sys = getSys(createDeps());
  });

  it('getVisualization 返回完整结构', () => {
    const npcId = getValidNPCId(sys);
    if (!npcId) return;
    const viz = sys.fav.getVisualization(npcId);
    expect(viz).not.toBeNull();
    expect(viz).toHaveProperty('npcId');
    expect(viz).toHaveProperty('currentAffinity');
    expect(viz).toHaveProperty('currentLevel');
    expect(viz).toHaveProperty('levelNumber');
    expect(viz).toHaveProperty('levelLabel');
    expect(viz).toHaveProperty('levelProgress');
    expect(viz).toHaveProperty('toNextLevel');
    expect(viz).toHaveProperty('nextLevel');
    expect(viz).toHaveProperty('bondSkillUnlocked');
  });

  it('levelProgress 在 [0, 1] 区间', () => {
    const npcId = getValidNPCId(sys);
    if (!npcId) return;
    const viz = sys.fav.getVisualization(npcId)!;
    expect(viz.levelProgress).toBeGreaterThanOrEqual(0);
    expect(viz.levelProgress).toBeLessThanOrEqual(1);
  });

  it('bonded等级 toNextLevel=0', () => {
    const npcId = getValidNPCId(sys);
    if (!npcId) return;
    sys.npc.setAffinity(npcId, 95);
    const viz = sys.fav.getVisualization(npcId)!;
    expect(viz.currentLevel).toBe('bonded');
    expect(viz.toNextLevel).toBe(0);
    expect(viz.nextLevel).toBeNull();
  });

  it('非bonded等级 nextLevel 不为null', () => {
    const npcId = getValidNPCId(sys);
    if (!npcId) return;
    sys.npc.setAffinity(npcId, 10);
    const viz = sys.fav.getVisualization(npcId)!;
    if (viz.currentLevel !== 'bonded') {
      expect(viz.nextLevel).not.toBeNull();
    }
  });

  it('bonded等级 bondSkillUnlocked=true', () => {
    const npcId = getValidNPCId(sys);
    if (!npcId) return;
    sys.npc.setAffinity(npcId, 90);
    const viz = sys.fav.getVisualization(npcId)!;
    expect(viz.bondSkillUnlocked).toBe(true);
    expect(viz.bondSkillName).not.toBeNull();
  });

  it('非bonded等级 bondSkillUnlocked=false', () => {
    const npcId = getValidNPCId(sys);
    if (!npcId) return;
    sys.npc.setAffinity(npcId, 10);
    const viz = sys.fav.getVisualization(npcId)!;
    expect(viz.bondSkillUnlocked).toBe(false);
    expect(viz.bondSkillName).toBeNull();
  });

  it('不存在的NPC → getVisualization 返回 null', () => {
    const viz = sys.fav.getVisualization('nonexistent-npc');
    expect(viz).toBeNull();
  });

  it('getVisualizations 批量获取可视化数据', () => {
    const npcs = sys.npc.getAllNPCs();
    const ids = npcs.slice(0, 3).map(n => n.id);
    const vizList = sys.fav.getVisualizations(ids);
    expect(vizList.length).toBe(ids.length);
  });

  // --- AffinitySystem 可视化 ---

  it('AffinitySystem.getVisualization 返回完整结构', () => {
    const npcId = getValidNPCId(sys);
    if (!npcId) return;
    const npc = sys.npc.getNPCById(npcId)!;
    const viz = sys.affinity.getVisualization(npcId, npc);
    expect(viz).toHaveProperty('currentAffinity');
    expect(viz).toHaveProperty('currentLevel');
    expect(viz).toHaveProperty('levelProgress');
    expect(viz.npcId).toBe(npcId);
  });

  it('好感度变化后可视化数据实时更新', () => {
    const npcId = getValidNPCId(sys);
    if (!npcId) return;
    sys.npc.setAffinity(npcId, 0);
    const viz1 = sys.fav.getVisualization(npcId)!;
    expect(viz1.currentLevel).toBe('hostile');

    sys.npc.setAffinity(npcId, 50);
    const viz2 = sys.fav.getVisualization(npcId)!;
    expect(viz2.currentLevel).toBe('friendly');
    expect(viz2.currentAffinity).toBe(50);
  });
});

// ═════════════════════════════════════════════
// §5.4 NPC专属羁绊技能
// ═════════════════════════════════════════════

describe('§5.4 NPC专属羁绊技能', () => {
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    sys = getSys(createDeps());
  });

  it('BOND_SKILLS 包含5种职业技能', () => {
    expect(BOND_SKILLS).toHaveProperty('merchant');
    expect(BOND_SKILLS).toHaveProperty('strategist');
    expect(BOND_SKILLS).toHaveProperty('warrior');
    expect(BOND_SKILLS).toHaveProperty('artisan');
    expect(BOND_SKILLS).toHaveProperty('traveler');
  });

  it('每个羁绊技能包含 id/name/effects/cooldownTurns', () => {
    for (const skill of Object.values(BOND_SKILLS)) {
      expect(skill).toHaveProperty('id');
      expect(skill).toHaveProperty('name');
      expect(skill).toHaveProperty('effects');
      expect(skill).toHaveProperty('cooldownTurns');
      expect(skill.effects.length).toBeGreaterThan(0);
      expect(skill.requiredLevel).toBe('bonded');
    }
  });

  it('getBondSkill 按职业获取羁绊技能', () => {
    const skill = sys.fav.getBondSkill('merchant');
    expect(skill).not.toBeNull();
    expect(skill!.profession).toBe('merchant');
    expect(skill!.name).toBe('日进斗金');
  });

  it('getBondSkill 不存在的职业返回 null', () => {
    const skill = sys.fav.getBondSkill('nonexistent');
    expect(skill).toBeNull();
  });

  // --- 激活羁绊技能（NPCFavorabilitySystem） ---

  it('activateBondSkill 需要bonded等级', () => {
    const npcId = getValidNPCId(sys);
    if (!npcId) return;
    // 低好感度不能激活
    sys.npc.setAffinity(npcId, 10);
    const result = sys.fav.activateBondSkill(npcId, 1);
    expect(result).toBeNull();
  });

  it('activateBondSkill bonded等级可激活', () => {
    const npcId = getValidNPCId(sys);
    if (!npcId) return;
    sys.npc.setAffinity(npcId, 90);
    const result = sys.fav.activateBondSkill(npcId, 1);
    expect(result).not.toBeNull();
    expect(result!.id).toBeTruthy();
  });

  it('羁绊技能有冷却时间', () => {
    const npcId = getValidNPCId(sys);
    if (!npcId) return;
    sys.npc.setAffinity(npcId, 90);
    const skill = sys.fav.activateBondSkill(npcId, 1);
    expect(skill).not.toBeNull();

    // 立即再次使用应失败（冷却中）
    const again = sys.fav.activateBondSkill(npcId, 2);
    // 冷却回合内不可再用（取决于cooldownTurns）
    const cooldown = sys.fav.getBondSkillCooldown(npcId, 2);
    expect(cooldown).toBeGreaterThan(0);
  });

  it('getBondSkillCooldown 冷却结束后为0', () => {
    const npcId = getValidNPCId(sys);
    if (!npcId) return;
    sys.npc.setAffinity(npcId, 90);
    sys.fav.activateBondSkill(npcId, 1);
    // 模拟很多回合后
    const npc = sys.npc.getNPCById(npcId)!;
    const skill = sys.fav.getBondSkill(npc.profession);
    const cooldown = sys.fav.getBondSkillCooldown(npcId, 1 + skill.cooldownTurns + 1);
    expect(cooldown).toBe(0);
  });

  // --- AffinitySystem 羁绊技能 ---

  it('AffinitySystem.canUseBondSkill 需要bonded等级', () => {
    const npcId = getValidNPCId(sys);
    if (!npcId) return;
    sys.npc.setAffinity(npcId, 10);
    const npc = sys.npc.getNPCById(npcId)!;
    expect(sys.affinity.canUseBondSkill(npcId, npc)).toBe(false);
  });

  it('AffinitySystem.useBondSkill 返回技能效果列表', () => {
    const npcId = getValidNPCId(sys);
    if (!npcId) return;
    sys.npc.setAffinity(npcId, 90);
    const npc = sys.npc.getNPCById(npcId)!;
    const effects = sys.affinity.useBondSkill(npcId, npc);
    expect(effects).not.toBeNull();
    expect(effects!.length).toBeGreaterThan(0);
    expect(effects![0]).toHaveProperty('type');
    expect(effects![0]).toHaveProperty('value');
    expect(effects![0]).toHaveProperty('duration');
  });

  it('不同职业羁绊技能效果类型不同', () => {
    const merchant = getNPCByProfession(sys, 'merchant');
    const warrior = getNPCByProfession(sys, 'warrior');
    if (!merchant || !warrior) return;

    const merchantSkill = sys.affinity.getBondSkill(merchant.profession);
    const warriorSkill = sys.affinity.getBondSkill(warrior.profession);

    expect(merchantSkill.effects[0].type).not.toBe(warriorSkill.effects[0].type);
  });

  // --- 序列化 ---

  it('serialize/deserialize 保持历史记录一致', () => {
    const npcId = getValidNPCId(sys);
    if (!npcId) return;
    sys.npc.setAffinity(npcId, 10);
    sys.fav.addDialogAffinity(npcId, 1);
    sys.fav.addGiftAffinity(npcId, true, 10, 2);

    const saved = sys.fav.serialize();
    expect(saved.changeHistory.length).toBeGreaterThan(0);

    const newFav = new NPCFavorabilitySystem();
    const deps2 = createDeps();
    newFav.init(deps2);
    newFav.deserialize(saved);
    expect(newFav.getChangeHistory().length).toBe(saved.changeHistory.length);
  });

  it('AffinitySystem exportSaveData/importSaveData 保持一致', () => {
    const npcId = getValidNPCId(sys);
    if (!npcId) return;
    sys.npc.setAffinity(npcId, 90);
    const npc = sys.npc.getNPCById(npcId)!;
    sys.affinity.useBondSkill(npcId, npc);

    const saved = sys.affinity.exportSaveData();
    expect(saved.bondSkillCooldowns).toBeDefined();

    const newSys = new NPCAffinitySystem();
    const deps2 = createDeps();
    newSys.init(deps2);
    newSys.importSaveData(saved);
    expect(newSys.getHistory().length).toBe(saved.changeHistory.length);
  });
});
