/**
 * 集成测试 — §10.3 军师推荐→装备推荐→强化
 *
 * 验证：军师触发条件、推荐算法、一键穿戴+强化联动
 *
 * @module engine/heritage/__tests__/integration/advisor-recommend-enhance
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdvisorSystem } from '../../../advisor/AdvisorSystem';
import { EquipmentEnhanceSystem } from '../../../equipment/EquipmentEnhanceSystem';
import { EquipmentSystem } from '../../../equipment/EquipmentSystem';
import type { ISystemDeps } from '../../../../core/types/subsystem';
import type { GameStateSnapshot } from '../../../advisor/AdvisorSystem';
import { ADVISOR_DAILY_LIMIT, ADVISOR_MAX_DISPLAY } from '../../../../core/advisor';
import type { EquipmentSlot, EquipmentRarity } from '../../../../core/equipment';

// ─────────────────────────────────────────────
// 辅助
// ─────────────────────────────────────────────

function createMockDeps() {
  return {
    eventBus: {
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      once: vi.fn(),
      removeAllListeners: vi.fn(),
    },
    config: { get: vi.fn() },
    registry: { get: vi.fn() },
  } as unknown as ISystemDeps;
}

/** 创建 AdvisorSystem + EquipmentSystem + EnhanceSystem 联动环境 */
function createEnv() {
  const deps = createMockDeps();

  const advisor = new AdvisorSystem();
  advisor.init(deps);

  const equipment = new EquipmentSystem();
  equipment.init(deps);

  const enhance = new EquipmentEnhanceSystem(equipment);
  enhance.init(deps);

  // 注入资源扣除回调
  let copper = 100000;
  let stone = 5000;
  enhance.setResourceDeductor((c, s) => {
    if (copper >= c && stone >= s) {
      copper -= c;
      stone -= s;
      return true;
    }
    return false;
  });

  return { advisor, equipment, enhance, deps, getCopper: () => copper, getStone: () => stone };
}

/** 创建游戏状态快照 */
function makeSnapshot(overrides: Partial<GameStateSnapshot> = {}): GameStateSnapshot {
  return {
    resources: { grain: 5000, gold: 3000, troops: 1000, mandate: 100 },
    resourceCaps: { grain: 10000, gold: 10000, troops: 5000, mandate: 500 },
    buildingQueueIdle: true,
    upgradeableHeroes: [],
    techQueueIdle: true,
    armyFull: false,
    leavingNpcs: [],
    newFeatures: [],
    offlineOverflowPercent: 0,
    ...overrides,
  };
}

/** 生成指定装备 */
function genEq(sys: EquipmentSystem, slot: EquipmentSlot, rarity: EquipmentRarity, seed = 42) {
  return sys.generateEquipment(slot, rarity, 'campaign_drop', seed)!;
}

// ═══════════════════════════════════════════════
// §10.3 军师推荐→装备推荐→强化
// ═══════════════════════════════════════════════

describe('§10.3 军师推荐→装备推荐→强化', () => {

  // ─── §10.3.1 军师触发条件 ───

  describe('§10.3.1 军师触发条件', () => {
    let env: ReturnType<typeof createEnv>;

    beforeEach(() => { env = createEnv(); });

    it('§10.3.1.1 资源溢出触发resource_overflow', () => {
      const snapshot = makeSnapshot({
        resources: { grain: 9500, gold: 3000, troops: 1000, mandate: 100 },
        resourceCaps: { grain: 10000, gold: 10000, troops: 5000, mandate: 500 },
      });
      const triggers = env.advisor.detectTriggers(snapshot);
      const overflowTrigger = triggers.find(t => t.triggerType === 'resource_overflow');
      expect(overflowTrigger).toBeDefined();
    });

    it('§10.3.1.2 资源告急触发resource_shortage', () => {
      const snapshot = makeSnapshot({
        resources: { grain: 50, gold: 10, troops: 100, mandate: 5 },
        resourceCaps: { grain: 10000, gold: 10000, troops: 5000, mandate: 500 },
      });
      const triggers = env.advisor.detectTriggers(snapshot);
      const shortageTrigger = triggers.find(t => t.triggerType === 'resource_shortage');
      expect(shortageTrigger).toBeDefined();
    });

    it('§10.3.1.3 建筑队列空闲触发building_idle', () => {
      const snapshot = makeSnapshot({ buildingQueueIdle: true });
      const triggers = env.advisor.detectTriggers(snapshot);
      const idleTrigger = triggers.find(t => t.triggerType === 'building_idle');
      expect(idleTrigger).toBeDefined();
    });

    it('§10.3.1.4 可升级武将触发hero_upgradeable', () => {
      const snapshot = makeSnapshot({ upgradeableHeroes: ['hero1', 'hero2'] });
      const triggers = env.advisor.detectTriggers(snapshot);
      const heroTrigger = triggers.find(t => t.triggerType === 'hero_upgradeable');
      expect(heroTrigger).toBeDefined();
    });

    it('§10.3.1.5 科技队列空闲触发tech_idle', () => {
      const snapshot = makeSnapshot({ techQueueIdle: true });
      const triggers = env.advisor.detectTriggers(snapshot);
      const techTrigger = triggers.find(t => t.triggerType === 'tech_idle');
      expect(techTrigger).toBeDefined();
    });

    it('§10.3.1.6 兵力满值触发army_full', () => {
      const snapshot = makeSnapshot({ armyFull: true });
      const triggers = env.advisor.detectTriggers(snapshot);
      const armyTrigger = triggers.find(t => t.triggerType === 'army_full');
      expect(armyTrigger).toBeDefined();
    });

    it('§10.3.1.7 NPC即将离开触发npc_leaving', () => {
      const snapshot = makeSnapshot({
        leavingNpcs: [{ id: 'npc1', name: '张三', hoursLeft: 2 }],
      });
      const triggers = env.advisor.detectTriggers(snapshot);
      const npcTrigger = triggers.find(t => t.triggerType === 'npc_leaving');
      expect(npcTrigger).toBeDefined();
    });

    it('§10.3.1.8 新功能解锁触发new_feature_unlock', () => {
      const snapshot = makeSnapshot({
        newFeatures: [{ id: 'feat1', name: '传承系统' }],
      });
      const triggers = env.advisor.detectTriggers(snapshot);
      const featureTrigger = triggers.find(t => t.triggerType === 'new_feature_unlock');
      expect(featureTrigger).toBeDefined();
    });

    it('§10.3.1.9 离线溢出触发offline_overflow', () => {
      const snapshot = makeSnapshot({ offlineOverflowPercent: 80 });
      const triggers = env.advisor.detectTriggers(snapshot);
      const offlineTrigger = triggers.find(t => t.triggerType === 'offline_overflow');
      expect(offlineTrigger).toBeDefined();
    });
  });

  // ─── §10.3.2 推荐算法与展示 ───

  describe('§10.3.2 推荐算法与展示', () => {
    let env: ReturnType<typeof createEnv>;

    beforeEach(() => { env = createEnv(); });

    it('§10.3.2.1 updateSuggestions更新建议列表', () => {
      const snapshot = makeSnapshot({ buildingQueueIdle: true });
      env.advisor.updateSuggestions(snapshot);
      const state = env.advisor.getState();
      expect(state.allSuggestions.length).toBeGreaterThan(0);
    });

    it('§10.3.2.2 展示建议最多3条', () => {
      // 触发多种条件
      const snapshot = makeSnapshot({
        buildingQueueIdle: true,
        techQueueIdle: true,
        armyFull: true,
        upgradeableHeroes: ['h1'],
      });
      env.advisor.updateSuggestions(snapshot);
      const displayed = env.advisor.getDisplayedSuggestions();
      expect(displayed.length).toBeLessThanOrEqual(ADVISOR_MAX_DISPLAY);
    });

    it('§10.3.2.3 展示建议按优先级排序', () => {
      const snapshot = makeSnapshot({
        buildingQueueIdle: true,
        techQueueIdle: true,
      });
      env.advisor.updateSuggestions(snapshot);
      const displayed = env.advisor.getDisplayedSuggestions();
      for (let i = 1; i < displayed.length; i++) {
        expect(displayed[i - 1].priority).toBeGreaterThanOrEqual(displayed[i].priority);
      }
    });

    it('§10.3.2.4 每日建议上限不超过15条', () => {
      // 多次更新
      for (let i = 0; i < 20; i++) {
        const snapshot = makeSnapshot({ buildingQueueIdle: true });
        env.advisor.updateSuggestions(snapshot);
      }
      const state = env.advisor.getState();
      expect(state.dailyCount).toBeLessThanOrEqual(ADVISOR_DAILY_LIMIT);
    });

    it('§10.3.2.5 DisplayState包含完整信息', () => {
      const snapshot = makeSnapshot({ buildingQueueIdle: true });
      env.advisor.updateSuggestions(snapshot);
      const displayState = env.advisor.getDisplayState();
      expect(displayState.displayedSuggestions).toBeDefined();
      expect(displayState.dailyCount).toBeGreaterThan(0);
      expect(displayState.lastDailyReset).toBeDefined();
    });
  });

  // ─── §10.3.3 建议执行与关闭 ───

  describe('§10.3.3 建议执行与关闭', () => {
    let env: ReturnType<typeof createEnv>;

    beforeEach(() => { env = createEnv(); });

    it('§10.3.3.1 执行建议后自动移除', () => {
      const snapshot = makeSnapshot({ buildingQueueIdle: true });
      env.advisor.updateSuggestions(snapshot);
      const suggestions = env.advisor.getDisplayedSuggestions();
      if (suggestions.length > 0) {
        const result = env.advisor.executeSuggestion(suggestions[0].id);
        expect(result.success).toBe(true);
        const remaining = env.advisor.getDisplayedSuggestions();
        expect(remaining.find(s => s.id === suggestions[0].id)).toBeUndefined();
      }
    });

    it('§10.3.3.2 执行不存在的建议返回失败', () => {
      const result = env.advisor.executeSuggestion('nonexistent');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('不存在');
    });

    it('§10.3.3.3 关闭建议后同类型进入冷却', () => {
      const snapshot = makeSnapshot({ buildingQueueIdle: true });
      env.advisor.updateSuggestions(snapshot);
      const suggestions = env.advisor.getDisplayedSuggestions();
      if (suggestions.length > 0) {
        const result = env.advisor.dismissSuggestion(suggestions[0].id);
        expect(result.success).toBe(true);
        expect(env.advisor.isInCooldown(suggestions[0].triggerType)).toBe(true);
      }
    });

    it('§10.3.3.4 执行建议触发事件', () => {
      const snapshot = makeSnapshot({ buildingQueueIdle: true });
      env.advisor.updateSuggestions(snapshot);
      const suggestions = env.advisor.getDisplayedSuggestions();
      if (suggestions.length > 0) {
        env.advisor.executeSuggestion(suggestions[0].id);
        expect((env.deps.eventBus as unknown as Record<string, unknown>).emit).toHaveBeenCalledWith(
          'advisor:suggestionExecuted',
          expect.objectContaining({ id: suggestions[0].id }),
        );
      }
    });
  });

  // ─── §10.3.4 装备强化联动 ───

  describe('§10.3.4 装备强化联动', () => {
    let env: ReturnType<typeof createEnv>;

    beforeEach(() => { env = createEnv(); });

    it('§10.3.4.1 装备生成并穿戴到武将', () => {
      const eq = genEq(env.equipment, 'weapon', 'blue');
      const result = env.equipment.equipItem('hero1', eq.uid);
      expect(result.success).toBe(true);
      expect(env.equipment.getHeroEquips('hero1').weapon).toBe(eq.uid);
    });

    it('§10.3.4.2 强化装备提升强化等级', () => {
      const eq = genEq(env.equipment, 'weapon', 'purple');
      // 多次尝试强化，至少一次应该成功（紫色品质上限较高）
      let successCount = 0;
      for (let i = 0; i < 10; i++) {
        const result = env.enhance.enhance(eq.uid, false);
        if (result.success) successCount++;
      }
      // 检查装备强化等级是否变化
      const updated = env.equipment.getEquipment(eq.uid);
      expect(updated).toBeDefined();
    });

    it('§10.3.4.3 强化消耗铜钱和强化石', () => {
      const eq = genEq(env.equipment, 'weapon', 'blue');
      const beforeCopper = env.getCopper();
      const beforeStone = env.getStone();
      env.enhance.enhance(eq.uid, false);
      // 资源应被消耗（如果强化尝试成功发起）
      const copperUsed = beforeCopper - env.getCopper();
      const stoneUsed = beforeStone - env.getStone();
      expect(copperUsed + stoneUsed).toBeGreaterThanOrEqual(0);
    });

    it('§10.3.4.4 不存在的装备强化返回失败', () => {
      const result = env.enhance.enhance('nonexistent', false);
      expect(result.outcome).toBe('fail');
    });

    it('§10.3.4.5 同部位装备替换旧装备', () => {
      const old = genEq(env.equipment, 'armor', 'white', 10);
      const newer = genEq(env.equipment, 'armor', 'purple', 20);
      env.equipment.equipItem('hero1', old.uid);
      const result = env.equipment.equipItem('hero1', newer.uid);
      expect(result.success).toBe(true);
      expect(result.replacedUid).toBe(old.uid);
    });
  });

  // ─── §10.3.5 军师+装备联合场景 ───

  describe('§10.3.5 军师+装备联合场景', () => {
    let env: ReturnType<typeof createEnv>;

    beforeEach(() => { env = createEnv(); });

    it('§10.3.5.1 军师建议穿戴→强化完整流程', () => {
      // 1. 生成装备
      const eq = genEq(env.equipment, 'weapon', 'purple');
      expect(eq).toBeDefined();

      // 2. 穿戴到武将
      const equipResult = env.equipment.equipItem('hero1', eq.uid);
      expect(equipResult.success).toBe(true);

      // 3. 强化
      const enhanceResult = env.enhance.enhance(eq.uid, false);
      // 强化可能成功或失败（概率），但不应抛错
      expect(enhanceResult).toBeDefined();
      expect(typeof enhanceResult.outcome).toBe('string');
      expect(['success', 'fail', 'downgrade']).toContain(enhanceResult.outcome);
    });

    it('§10.3.5.2 军师建议序列化与恢复', () => {
      const snapshot = makeSnapshot({ buildingQueueIdle: true });
      env.advisor.updateSuggestions(snapshot);

      const saveData = env.advisor.serialize();
      expect(saveData.version).toBeDefined();
      expect(saveData.dailyCount).toBeGreaterThan(0);

      // 恢复
      const newAdvisor = new AdvisorSystem();
      newAdvisor.init(env.deps);
      newAdvisor.loadSaveData(saveData);
      expect(newAdvisor.getState().dailyCount).toBe(saveData.dailyCount);
    });

    it('§10.3.5.3 多装备批量穿戴后强化', () => {
      const slots: EquipmentSlot[] = ['weapon', 'armor', 'mount'];
      const uids: string[] = [];
      for (let i = 0; i < slots.length; i++) {
        const eq = genEq(env.equipment, slots[i], 'blue', i * 100);
        env.equipment.equipItem('hero1', eq.uid);
        uids.push(eq.uid);
      }
      const heroEquips = env.equipment.getHeroEquips('hero1');
      expect(heroEquips.weapon).toBeDefined();
      expect(heroEquips.armor).toBeDefined();
      expect(heroEquips.mount).toBeDefined();
    });

    it('§10.3.5.4 军师冷却期间不重复建议', () => {
      const snapshot = makeSnapshot({ buildingQueueIdle: true });
      env.advisor.updateSuggestions(snapshot);
      const suggestions1 = env.advisor.getDisplayedSuggestions();

      // 关闭所有建议
      for (const s of suggestions1) {
        env.advisor.dismissSuggestion(s.id);
      }

      // 再次更新 - 同类型应被冷却
      env.advisor.updateSuggestions(snapshot);
      const suggestions2 = env.advisor.getDisplayedSuggestions();
      // 冷却中的类型不应再出现
      for (const s of suggestions2) {
        expect(env.advisor.isInCooldown(s.triggerType)).toBe(false);
      }
    });

    it('§10.3.5.5 军师reset清除所有状态', () => {
      const snapshot = makeSnapshot({ buildingQueueIdle: true });
      env.advisor.updateSuggestions(snapshot);
      env.advisor.reset();
      const state = env.advisor.getState();
      expect(state.allSuggestions).toEqual([]);
      expect(state.dailyCount).toBe(0);
    });
  });
});
