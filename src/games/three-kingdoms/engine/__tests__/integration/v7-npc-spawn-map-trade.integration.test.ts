/**
 * v7.0 草木皆兵 集成测试 — 流程3: NPC刷新→地图聚合→交易→好感度效果全链路
 *
 * 对应Play文档: #2刷新规则, #1.3地图聚合, #9.5交易系统, #25好感度声望
 *
 * 验证目标：
 * - NPC刷新规则（基于NPCSpawnRule）
 * - NPC地图放置与聚合
 * - NPC交易折扣（越低越优惠）
 * - 好感度声望奖励
 * - 好感度等级效果完整性
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NPCSpawnSystem } from '../../npc/NPCSpawnSystem';
import { NPCMapPlacer } from '../../npc/NPCMapPlacer';
import { NPCAffinitySystem } from '../../npc/NPCAffinitySystem';
import type { ISystemDeps } from '../../../core/types';
import type { NPCData, NPCProfession } from '../../../core/npc';
import { getAffinityLevel } from '../../../core/npc';

// ─── 测试工具 ─────────────────────────────────

function createMockDeps(): ISystemDeps {
  return {
    eventBus: {
      emit: vi.fn(),
      on: vi.fn(),
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
    name: '测试NPC',
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

// ─── 测试套件 ─────────────────────────────────

describe('v7.0 流程3: NPC刷新→地图聚合→交易→好感度效果全链路', () => {
  let deps: ISystemDeps;

  beforeEach(() => {
    deps = createMockDeps();
  });

  // ─── #2 NPC刷新规则 ───────────────────────

  describe('#2 NPC刷新规则（Plan#2）', () => {
    let spawnSys: NPCSpawnSystem;

    beforeEach(() => {
      spawnSys = new NPCSpawnSystem();
      spawnSys.init(deps);
    });

    it('应注册刷新规则', () => {
      spawnSys.registerRule({
        id: 'rule-farmer',
        defId: 'def-farmer',
        name: '农民',
        enabled: true,
        maxCount: 2,
        spawnX: 100,
        spawnY: 100,
        conditions: [{ type: 'turn', params: { minTurn: 5 } }],
      });

      const ruleIds = spawnSys.getRuleIds();
      expect(ruleIds).toContain('rule-farmer');
    });

    it('应通过回调执行刷新', () => {
      const spawnedIds: string[] = [];
      spawnSys.setSpawnCallback((defId, x, y, name) => {
        const id = `${defId}-${Date.now()}`;
        spawnedIds.push(id);
        return id;
      });

      spawnSys.registerRule({
        id: 'rule-soldier',
        defId: 'def-soldier',
        name: '士兵',
        enabled: true,
        maxCount: 3,
        spawnX: 50,
        spawnY: 50,
      });

      const result = spawnSys.forceSpawn('rule-soldier');
      expect(result.success).toBe(true);
      expect(result.npcId).toBeDefined();
    });

    it('条件不满足时不应刷新', () => {
      spawnSys.setSpawnCallback(() => 'npc-fake');

      spawnSys.registerRule({
        id: 'rule-late',
        defId: 'def-scholar',
        name: '学者',
        enabled: true,
        maxCount: 1,
        spawnX: 0,
        spawnY: 0,
        conditions: [{ type: 'turn', params: { minTurn: 100 } }],
      });

      const results = spawnSys.checkSpawnConditions({ currentTurn: 5, events: [] });
      expect(results).toHaveLength(0);
    });

    it('达到最大数量时不应再刷新', () => {
      spawnSys.setSpawnCallback(() => `npc-${Math.random()}`);

      spawnSys.registerRule({
        id: 'rule-max',
        defId: 'def-merchant',
        name: '商人',
        enabled: true,
        maxCount: 1,
        spawnX: 0,
        spawnY: 0,
      });

      spawnSys.forceSpawn('rule-max');
      const result = spawnSys.forceSpawn('rule-max');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('最大数量');
    });

    it('应支持定时消失', () => {
      spawnSys.setSpawnCallback(() => 'npc-temp');
      let despawned = false;
      spawnSys.setDespawnCallback(() => { despawned = true; });

      spawnSys.registerRule({
        id: 'rule-rare',
        defId: 'def-traveler',
        name: '旅行商人',
        enabled: true,
        maxCount: 1,
        spawnX: 0,
        spawnY: 0,
        despawnAfter: 60, // 60秒后消失
      });

      spawnSys.forceSpawn('rule-rare');
      expect(spawnSys.getActiveNPCCount()).toBe(1);

      // 模拟时间流逝超过消失时间
      spawnSys.update(70);
      expect(despawned).toBe(true);
      expect(spawnSys.getActiveNPCCount()).toBe(0);
    });

    it('应正确序列化和反序列化', () => {
      spawnSys.setSpawnCallback(() => 'npc-1');
      spawnSys.registerRule({
        id: 'rule-test',
        defId: 'def-test',
        name: '测试',
        enabled: true,
        maxCount: 5,
        spawnX: 0,
        spawnY: 0,
      });
      spawnSys.forceSpawn('rule-test');

      const data = spawnSys.serialize();
      expect(data.version).toBeDefined();
      expect(data.spawnedRecords.length).toBeGreaterThan(0);

      spawnSys.reset();
      spawnSys.deserialize(data);
      // 反序列化恢复spawnedRecords，但规则已清空所以getRuleIdForNPC依赖ruleActiveNPCs
      // 反序列化会重建ruleActiveNPCs，所以npc-1应该仍可找到ruleId
      expect(spawnSys.getRuleIdForNPC('npc-1')).toBe('rule-test');
    });
  });

  // ─── #1.3 NPC地图放置与聚合 ─────────────────

  describe('#1.3 NPC地图放置与聚合（Plan#1）', () => {
    let mapPlacer: NPCMapPlacer;
    let npcs: NPCData[];

    beforeEach(() => {
      mapPlacer = new NPCMapPlacer();
      mapPlacer.init(deps);
      npcs = [
        createNPC({ id: 'npc-01', position: { x: 10, y: 10 }, affinity: 20 }),
        createNPC({ id: 'npc-02', position: { x: 20, y: 20 }, affinity: 50 }),
        createNPC({ id: 'npc-03', position: { x: 30, y: 30 }, affinity: 80 }),
      ];
    });

    it('应设置placer依赖并计算展示', () => {
      mapPlacer.setPlacerDeps({
        getAllNPCs: () => npcs,
        getVisibleNPCs: () => npcs.filter((n) => n.visible),
      });

      const displays = mapPlacer.computeMapDisplays();
      expect(displays).toBeDefined();
      expect(Array.isArray(displays)).toBe(true);
    });

    it('应获取区域展示', () => {
      mapPlacer.setPlacerDeps({
        getAllNPCs: () => npcs,
        getVisibleNPCs: () => npcs,
      });

      const regionDisplays = mapPlacer.getRegionDisplays('main-city');
      expect(regionDisplays).toBeDefined();
    });

    it('应获取视口内NPC', () => {
      mapPlacer.setPlacerDeps({
        getAllNPCs: () => npcs,
        getVisibleNPCs: () => npcs,
      });

      const inViewport = mapPlacer.getNPCsInViewport(0, 0, 500, 500, 1.0);
      expect(inViewport).toBeDefined();
      expect(Array.isArray(inViewport)).toBe(true);
    });
  });

  // ─── #9.5 NPC交易折扣 ──────────────────────

  describe('#9.5 NPC交易折扣（Plan#24）', () => {
    let affinitySys: NPCAffinitySystem;

    beforeEach(() => {
      affinitySys = new NPCAffinitySystem();
      affinitySys.init(deps);
    });

    it('好感度越高折扣越大（tradeDiscount越低越优惠）', () => {
      const hostileDiscount = affinitySys.getTradeDiscount(10);
      const neutralDiscount = affinitySys.getTradeDiscount(25);
      const friendlyDiscount = affinitySys.getTradeDiscount(50);
      const trustedDiscount = affinitySys.getTradeDiscount(75);
      const bondedDiscount = affinitySys.getTradeDiscount(90);

      // tradeDiscount是价格乘数，越低越好
      // hostile=1.0, neutral=0.95, friendly=0.85, trusted=0.75, bonded=0.6
      expect(hostileDiscount).toBe(1.0);
      expect(neutralDiscount).toBe(0.95);
      expect(friendlyDiscount).toBe(0.85);
      expect(trustedDiscount).toBe(0.75);
      expect(bondedDiscount).toBe(0.6);

      // 验证递减趋势（越低折扣越大）
      expect(hostileDiscount).toBeGreaterThan(neutralDiscount);
      expect(neutralDiscount).toBeGreaterThan(friendlyDiscount);
      expect(friendlyDiscount).toBeGreaterThan(trustedDiscount);
      expect(trustedDiscount).toBeGreaterThan(bondedDiscount);
    });
  });

  // ─── #31 好感度声望奖励 ────────────────────

  describe('#31 好感度声望奖励（Plan#25）', () => {
    let affinitySys: NPCAffinitySystem;

    beforeEach(() => {
      affinitySys = new NPCAffinitySystem();
      affinitySys.init(deps);
    });

    it('好感度变化应记录来源', () => {
      const npc = createNPC({ affinity: 50 });

      affinitySys.gainFromDialog('npc-01', npc);
      affinitySys.gainFromGift('npc-01', npc, 'normal');
      affinitySys.gainFromQuest('npc-01', npc);
      affinitySys.gainFromTrade('npc-01', npc);

      const history = affinitySys.getState().changeHistory;
      const sources = history.map((h) => h.source);
      expect(sources).toContain('dialog');
      expect(sources).toContain('gift');
      expect(sources).toContain('quest_complete');
      expect(sources).toContain('trade');
    });

    it('不同好感度来源应正确标记', () => {
      const npc = createNPC({ affinity: 20 });

      const dialogRecord = affinitySys.gainFromDialog('npc-01', npc);
      expect(dialogRecord.source).toBe('dialog');

      const giftRecord = affinitySys.gainFromGift('npc-01', npc, 'preferred');
      expect(giftRecord.source).toBe('gift');

      const questRecord = affinitySys.gainFromQuest('npc-01', npc);
      expect(questRecord.source).toBe('quest_complete');
    });
  });

  // ─── 好感度等级效果完整性 ─────────────────────

  describe('好感度等级效果完整性验证', () => {
    let affinitySys: NPCAffinitySystem;

    beforeEach(() => {
      affinitySys = new NPCAffinitySystem();
      affinitySys.init(deps);
    });

    it('五个等级应各有对应效果', () => {
      const levels = [
        { affinity: 10, expected: 'hostile' },
        { affinity: 25, expected: 'neutral' },
        { affinity: 50, expected: 'friendly' },
        { affinity: 75, expected: 'trusted' },
        { affinity: 90, expected: 'bonded' },
      ];

      for (const { affinity, expected } of levels) {
        const level = getAffinityLevel(affinity);
        expect(level).toBe(expected);

        const effect = affinitySys.getLevelEffect(affinity);
        expect(effect).toBeDefined();
        expect(effect.levelNumber).toBeGreaterThan(0);
        expect(effect.unlockedInteractions).toBeDefined();
        expect(effect.unlockedInteractions.length).toBeGreaterThan(0);
      }
    });

    it('好感度应支持多种获取途径并验证倍率', () => {
      const npc = createNPC({ affinity: 50 });

      const dialogGain = affinitySys.gainFromDialog('npc-01', npc);
      expect(dialogGain.delta).toBeGreaterThan(0);

      const normalGift = affinitySys.gainFromGift('npc-01', npc, 'normal');
      expect(normalGift.delta).toBeGreaterThan(0);

      const prefGift = affinitySys.gainFromGift('npc-01', npc, 'preferred');
      expect(prefGift.delta).toBeGreaterThan(0);

      const rareGift = affinitySys.gainFromGift('npc-01', npc, 'rare');
      expect(rareGift.delta).toBeGreaterThan(0);

      // 倍率关系: preferred >= normal, rare >= normal
      expect(prefGift.delta).toBeGreaterThanOrEqual(normalGift.delta);
      expect(rareGift.delta).toBeGreaterThanOrEqual(normalGift.delta);
    });

    it('羁绊技能仅满级解锁', () => {
      expect(affinitySys.isBondSkillUnlocked(50)).toBe(false);
      expect(affinitySys.isBondSkillUnlocked(75)).toBe(false);
      expect(affinitySys.isBondSkillUnlocked(90)).toBe(true);
    });

    it('情报准确度应随好感度提升', () => {
      const lowAccuracy = affinitySys.getIntelAccuracy(20);
      const highAccuracy = affinitySys.getIntelAccuracy(90);
      expect(highAccuracy).toBeGreaterThan(lowAccuracy);
    });

    it('任务奖励倍率应随好感度提升', () => {
      const lowMultiplier = affinitySys.getQuestRewardMultiplier(20);
      const highMultiplier = affinitySys.getQuestRewardMultiplier(90);
      expect(highMultiplier).toBeGreaterThan(lowMultiplier);
    });
  });
});
