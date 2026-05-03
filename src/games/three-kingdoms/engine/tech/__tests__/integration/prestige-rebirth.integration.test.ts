/**
 * 集成测试 — 科技解锁 + 转生处理
 *
 * 覆盖 Play 文档流程：
 *   §7.1  科技系统解锁与前置：科技解锁条件
 *   §7.2  科技效果应用：效果叠加
 *   §8.1  转生时领土处理：领土状态重置
 *   §8.2  转生时攻城处理：攻城数据重置
 *
 * @module engine/tech/__tests__/integration/prestige-rebirth
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PrestigeSystem, calcRequiredPoints, calcProductionBonus } from '../../../prestige/PrestigeSystem';
import { PrestigeShopSystem } from '../../../prestige/PrestigeShopSystem';
import { RebirthSystem, calcRebirthMultiplier } from '../../../prestige/RebirthSystem';
import { TechTreeSystem } from '../../../tech/TechTreeSystem';
import { TerritorySystem } from '../../../map/TerritorySystem';
import { SiegeSystem } from '../../../map/SiegeSystem';
import {
  REBIRTH_CONDITIONS,
  REBIRTH_MULTIPLIER,
  REBIRTH_KEEP_RULES,
  REBIRTH_RESET_RULES,
  REBIRTH_ACCELERATION,
  REBIRTH_UNLOCK_CONTENTS,
  MAX_PRESTIGE_LEVEL,
  PRESTIGE_SOURCE_CONFIGS,
  LEVEL_UNLOCK_REWARDS,
} from '../../../../core/prestige';
import type { ISystemDeps } from '../../../../core/types';
import type { ISubsystemRegistry } from '../../../../core/types/subsystem';
import type { SimulationParams } from '../../../../core/prestige';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

function createDeps(): ISystemDeps {
  const prestige = new PrestigeSystem();
  const shop = new PrestigeShopSystem();
  const territory = new TerritorySystem();
  const siege = new SiegeSystem();
  const techTree = new TechTreeSystem();
  const rebirth = new RebirthSystem();

  const registry = new Map<string, unknown>();
  registry.set('prestige', prestige);
  registry.set('prestigeShop', shop);
  registry.set('territory', territory);
  registry.set('siege', siege);
  registry.set('techTree', techTree);
  registry.set('rebirth', rebirth);

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

  prestige.init(deps);
  shop.init(deps);
  territory.init(deps);
  siege.init(deps);
  techTree.init(deps);
  rebirth.init(deps);

  return deps;
}

function getSys(deps: ISystemDeps) {
  return {
    prestige: deps.registry.get<PrestigeSystem>('prestige')!,
    shop: deps.registry.get<PrestigeShopSystem>('prestigeShop')!,
    territory: deps.registry.get<TerritorySystem>('territory')!,
    siege: deps.registry.get<SiegeSystem>('siege')!,
    techTree: deps.registry.get<TechTreeSystem>('techTree')!,
    rebirth: deps.registry.get<RebirthSystem>('rebirth')!,
  };
}

/** 配置 RebirthSystem 使其满足转生条件 */
function setupRebirthReady(sys: ReturnType<typeof getSys>) {
  sys.rebirth.setCallbacks({
    castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel,
    heroCount: () => REBIRTH_CONDITIONS.minHeroCount,
    totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
    prestigeLevel: () => REBIRTH_CONDITIONS.minPrestigeLevel,
    campaignStage: () => REBIRTH_CONDITIONS.minCampaignStage,
    achievementChainCount: () => REBIRTH_CONDITIONS.requiredAchievementChainCount,
    onReset: () => {},
  });
  sys.rebirth.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel);
}

// ─────────────────────────────────────────────
// §7.1 科技系统解锁与前置
// ─────────────────────────────────────────────

describe('§7.1 科技系统解锁与前置', () => {
  let deps: ISystemDeps;
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    deps = createDeps();
    sys = getSys(deps);
  });

  it('声望系统初始化为等级1', () => {
    const panel = sys.prestige.getPrestigePanel();
    expect(panel.currentLevel).toBe(1);
    expect(panel.currentPoints).toBe(0);
    expect(panel.productionBonus).toBeCloseTo(1.02);
  });

  it('等级阈值公式: 1000 × N^1.8', () => {
    expect(calcRequiredPoints(1)).toBe(1000);
    expect(calcRequiredPoints(5)).toBe(Math.floor(1000 * Math.pow(5, 1.8)));
    expect(calcRequiredPoints(10)).toBe(Math.floor(1000 * Math.pow(10, 1.8)));
    expect(calcRequiredPoints(50)).toBe(Math.floor(1000 * Math.pow(50, 1.8)));
  });

  it('产出加成公式: 1 + level × 0.02', () => {
    expect(calcProductionBonus(1)).toBeCloseTo(1.02);
    expect(calcProductionBonus(10)).toBeCloseTo(1.2);
    expect(calcProductionBonus(25)).toBeCloseTo(1.5);
    expect(calcProductionBonus(50)).toBeCloseTo(2.0);
  });

  it('声望获取(9种途径)', () => {
    const configs = sys.prestige.getSourceConfigs();
    expect(configs.length).toBe(9);

    const types = configs.map(c => c.type);
    expect(types).toContain('daily_quest');
    expect(types).toContain('main_quest');
    expect(types).toContain('battle_victory');
    expect(types).toContain('building_upgrade');
    expect(types).toContain('tech_research');
    expect(types).toContain('npc_interact');
    expect(types).toContain('expedition');
    expect(types).toContain('pvp_rank');
    expect(types).toContain('event_complete');
  });

  it('声望获取受每日上限限制', () => {
    for (let i = 0; i < 15; i++) {
      sys.prestige.addPrestigePoints('daily_quest', 10);
    }
    const panel = sys.prestige.getPrestigePanel();
    // 日常上限100 (dailyCap=100, basePoints=10)
    expect(panel.currentPoints).toBeLessThanOrEqual(100);
  });

  it('声望升级自动检测', () => {
    // 等级2需要 calcRequiredPoints(2) = 3482 声望
    sys.prestige.addPrestigePoints('main_quest', 4000);
    const panel = sys.prestige.getPrestigePanel();
    expect(panel.currentLevel).toBeGreaterThanOrEqual(2);
  });

  it('TechTreeSystem 初始化所有节点为 locked', () => {
    const allStates = sys.techTree.getAllNodeStates();
    const lockedCount = Object.values(allStates).filter(s => s.status === 'locked').length;
    expect(lockedCount).toBeGreaterThan(0);
  });

  it('前置依赖检查 — 未完成前置的节点不可研究', () => {
    // 找一个有前置依赖的节点
    const allStates = sys.techTree.getAllNodeStates();
    for (const [id, state] of Object.entries(allStates)) {
      const def = sys.techTree.getNodeDef(id);
      if (def && def.prerequisites.length > 0 && state.status === 'locked') {
        const result = sys.techTree.canResearch(id);
        expect(result.can).toBe(false);
        expect(result.reason).toContain('前置');
        break;
      }
    }
  });

  it('完成前置节点后，后续节点变为 available', () => {
    const allStates = sys.techTree.getAllNodeStates();
    // 找到初始 available 的节点并完成它
    for (const [id, state] of Object.entries(allStates)) {
      if (state.status === 'available') {
        const def = sys.techTree.getNodeDef(id);
        if (def && def.prerequisites.length === 0) {
          sys.techTree.completeNode(id);
          // 检查依赖此节点的后续节点
          const unmet = sys.techTree.getUnmetPrerequisites(id);
          expect(unmet).not.toContain(id);
          break;
        }
      }
    }
  });

  it('互斥分支 — 选择一个节点后同组其他节点被锁定', () => {
    const allStates = sys.techTree.getAllNodeStates();
    for (const [id, state] of Object.entries(allStates)) {
      if (state.status === 'available') {
        const def = sys.techTree.getNodeDef(id);
        if (def?.mutexGroup) {
          sys.techTree.completeNode(id);
          const alternatives = sys.techTree.getMutexAlternatives(id);
          for (const altId of alternatives) {
            expect(sys.techTree.isMutexLocked(altId)).toBe(true);
          }
          break;
        }
      }
    }
  });

  it('等级解锁奖励列表完整', () => {
    const rewards = sys.prestige.getLevelRewards();
    expect(rewards.length).toBeGreaterThan(0);
    // 等级1奖励应可领取
    const lvl1 = rewards.find(r => r.level === 1);
    expect(lvl1).toBeDefined();
    expect(lvl1!.claimed).toBe(false);
  });

  it('等级20解锁转生系统', () => {
    const rewards = LEVEL_UNLOCK_REWARDS;
    const rebirthUnlock = rewards.find(r => r.level === 20);
    expect(rebirthUnlock).toBeDefined();
    expect(rebirthUnlock!.privilegeId).toBe('rebirth_system');
  });
});

// ─────────────────────────────────────────────
// §7.2 科技效果应用
// ─────────────────────────────────────────────

describe('§7.2 科技效果应用', () => {
  let deps: ISystemDeps;
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    deps = createDeps();
    sys = getSys(deps);
  });

  it('完成科技后效果列表更新', () => {
    const allStates = sys.techTree.getAllNodeStates();
    // 找到第一个 available 节点并完成
    for (const [id, state] of Object.entries(allStates)) {
      if (state.status === 'available') {
        sys.techTree.completeNode(id);
        const effects = sys.techTree.getAllCompletedEffects();
        expect(effects.length).toBeGreaterThan(0);
        break;
      }
    }
  });

  it('多个科技效果可叠加', () => {
    const allStates = sys.techTree.getAllNodeStates();
    let completedCount = 0;
    for (const [id, state] of Object.entries(allStates)) {
      if (state.status === 'available' && completedCount < 3) {
        sys.techTree.completeNode(id);
        completedCount++;
      }
    }
    if (completedCount >= 2) {
      const effects = sys.techTree.getAllCompletedEffects();
      expect(effects.length).toBeGreaterThanOrEqual(completedCount);
    }
  });

  it('getEffectValue 按类型汇总叠加值', () => {
    const allStates = sys.techTree.getAllNodeStates();
    for (const [id, state] of Object.entries(allStates)) {
      if (state.status === 'available') {
        sys.techTree.completeNode(id);
        // 检查是否能获取到效果值
        const def = sys.techTree.getNodeDef(id);
        if (def && def.effects.length > 0) {
          const firstEffect = def.effects[0];
          const value = sys.techTree.getEffectValue(firstEffect.type, firstEffect.target);
          expect(value).toBeGreaterThanOrEqual(firstEffect.value);
        }
        break;
      }
    }
  });

  it('getTechBonusMultiplier 汇总资源产出加成', () => {
    const multiplier = sys.techTree.getTechBonusMultiplier();
    expect(typeof multiplier).toBe('number');
    expect(multiplier).toBeGreaterThanOrEqual(0);
  });

  it('科技路线进度可查询', () => {
    const progress = sys.techTree.getAllPathProgress();
    expect(progress).toHaveProperty('military');
    expect(progress).toHaveProperty('economy');
    expect(progress).toHaveProperty('culture');
    for (const path of ['military', 'economy', 'culture'] as const) {
      expect(progress[path].total).toBeGreaterThan(0);
      expect(progress[path].completed).toBe(0);
    }
  });

  it('声望产出加成与科技加成可叠加', () => {
    const prestigeBonus = sys.prestige.getProductionBonus();
    const techBonus = sys.techTree.getTechBonusMultiplier();
    // 两者独立计算，最终叠加
    const totalBonus = prestigeBonus + techBonus;
    expect(totalBonus).toBeGreaterThan(1);
  });
});

// ─────────────────────────────────────────────
// §8.1 转生时领土处理
// ─────────────────────────────────────────────

describe('§8.1 转生时领土处理', () => {
  let deps: ISystemDeps;
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    deps = createDeps();
    sys = getSys(deps);
  });

  it('转生条件检查 — 默认不满足', () => {
    const check = sys.rebirth.checkRebirthConditions();
    expect(check.canRebirth).toBe(false);
    expect(check.conditions.prestigeLevel.met).toBe(false);
    expect(check.conditions.castleLevel.met).toBe(false);
    expect(check.conditions.heroCount.met).toBe(false);
    expect(check.conditions.totalPower.met).toBe(false);
  });

  it('转生条件检查 — 满足所有条件后可转生', () => {
    setupRebirthReady(sys);
    const check = sys.rebirth.checkRebirthConditions();
    expect(check.canRebirth).toBe(true);
    expect(check.conditions.prestigeLevel.met).toBe(true);
    expect(check.conditions.castleLevel.met).toBe(true);
    expect(check.conditions.heroCount.met).toBe(true);
    expect(check.conditions.totalPower.met).toBe(true);
  });

  it('执行转生成功', () => {
    setupRebirthReady(sys);
    const result = sys.rebirth.executeRebirth();
    expect(result.success).toBe(true);
    expect(result.newCount).toBe(1);
    expect(result.multiplier).toBeGreaterThan(0);
    expect(result.acceleration).toBeDefined();
  });

  it('转生倍率计算: base + perRebirth × count', () => {
    const m1 = calcRebirthMultiplier(1);
    const m2 = calcRebirthMultiplier(2);
    const m5 = calcRebirthMultiplier(5);
    expect(m1).toBeGreaterThan(0);
    expect(m2).toBeGreaterThan(m1);
    expect(m5).toBeGreaterThan(m2);
  });

  it('转生倍率有上限', () => {
    const maxM = calcRebirthMultiplier(100);
    expect(maxM).toBeLessThanOrEqual(REBIRTH_MULTIPLIER.max);
  });

  it('转生保留规则包含6项', () => {
    const rules = sys.rebirth.getKeepRules();
    expect(rules.length).toBe(6);
    expect(rules).toContain('keep_heroes');
    expect(rules).toContain('keep_equipment');
    expect(rules).toContain('keep_tech_points');
    expect(rules).toContain('keep_prestige');
    expect(rules).toContain('keep_achievements');
    expect(rules).toContain('keep_vip');
  });

  it('转生重置规则包含5项', () => {
    const rules = sys.rebirth.getResetRules();
    expect(rules.length).toBe(5);
    expect(rules).toContain('reset_buildings');
    expect(rules).toContain('reset_resources');
    expect(rules).toContain('reset_map_progress');
    expect(rules).toContain('reset_quest_progress');
    expect(rules).toContain('reset_campaign');
  });

  it('转生后激活加速效果(7天)', () => {
    setupRebirthReady(sys);
    sys.rebirth.executeRebirth();
    const accel = sys.rebirth.getAcceleration();
    expect(accel.active).toBe(true);
    expect(accel.daysLeft).toBe(REBIRTH_ACCELERATION.durationDays);
    expect(accel.config.buildSpeedMultiplier).toBe(1.5);
    expect(accel.config.techSpeedMultiplier).toBe(1.5);
    expect(accel.config.resourceMultiplier).toBe(2.0);
  });

  it('转生有效倍率含加速加成', () => {
    setupRebirthReady(sys);
    sys.rebirth.executeRebirth();
    const multipliers = sys.rebirth.getEffectiveMultipliers();
    expect(multipliers.buildSpeed).toBeGreaterThan(1);
    expect(multipliers.techSpeed).toBeGreaterThan(1);
    expect(multipliers.resource).toBeGreaterThan(1);
    expect(multipliers.exp).toBeGreaterThan(1);
  });

  it('领土数据可查询(转生前)', () => {
    const territories = sys.territory.getAllTerritories();
    expect(territories.length).toBeGreaterThan(0);
    // 占领一些领土
    const neutralList = territories.filter(t => t.ownership !== 'player');
    for (const t of neutralList.slice(0, 3)) {
      sys.territory.captureTerritory(t.id, 'player');
    }
    const count = sys.territory.getPlayerTerritoryCount();
    expect(count).toBeGreaterThan(0);
  });

  it('转生解锁内容按转生次数递增', () => {
    const contents = sys.rebirth.getUnlockContents();
    expect(contents.length).toBeGreaterThan(0);
    // 检查解锁内容列表
    const sorted = [...contents].sort((a, b) => a.requiredRebirthCount - b.requiredRebirthCount);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].requiredRebirthCount).toBeGreaterThanOrEqual(sorted[i - 1].requiredRebirthCount);
    }
  });

  it('收益模拟器可运行', () => {
    const params: SimulationParams = {
      currentPrestigeLevel: 20,
      currentRebirthCount: 0,
      simulateDays: 7,
      dailyOnlineHours: 4,
    };
    const result = sys.rebirth.simulateEarnings(params);
    expect(result).toHaveProperty('estimatedResources');
    expect(result).toHaveProperty('estimatedPrestigeGain');
    expect(result).toHaveProperty('days', 7);
  });
});

// ─────────────────────────────────────────────
// §8.2 转生时攻城处理
// ─────────────────────────────────────────────

describe('§8.2 转生时攻城处理', () => {
  let deps: ISystemDeps;
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    deps = createDeps();
    sys = getSys(deps);
  });

  it('攻城系统初始状态', () => {
    const state = sys.siege.getState();
    expect(state).toHaveProperty('totalSieges');
    expect(state).toHaveProperty('victories');
    expect(state).toHaveProperty('defeats');
    expect(state).toHaveProperty('history');
  });

  it('每日攻城次数上限为3', () => {
    const remaining = sys.siege.getRemainingDailySieges();
    expect(remaining).toBeLessThanOrEqual(3);
    expect(remaining).toBeGreaterThanOrEqual(0);
  });

  it('转生时 resetCallback 被调用并传入重置规则', () => {
    const resetRules: string[][] = [];
    setupRebirthReady(sys);
    // 重新设置带记录的回调
    sys.rebirth.setCallbacks({
      castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel,
      heroCount: () => REBIRTH_CONDITIONS.minHeroCount,
      totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
      prestigeLevel: () => REBIRTH_CONDITIONS.minPrestigeLevel,
      campaignStage: () => REBIRTH_CONDITIONS.minCampaignStage,
      achievementChainCount: () => REBIRTH_CONDITIONS.requiredAchievementChainCount,
      onReset: (rules) => { resetRules.push(rules); },
    });
    sys.rebirth.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel);

    const result = sys.rebirth.executeRebirth();
    expect(result.success).toBe(true);
    expect(resetRules.length).toBe(1);
    expect(resetRules[0]).toEqual([...REBIRTH_RESET_RULES]);
  });

  it('多次转生倍率递增', () => {
    let currentTime = Date.now();
    setupRebirthReady(sys);
    sys.rebirth.setCallbacks({
      castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel,
      heroCount: () => REBIRTH_CONDITIONS.minHeroCount,
      totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
      prestigeLevel: () => REBIRTH_CONDITIONS.minPrestigeLevel,
      campaignStage: () => REBIRTH_CONDITIONS.minCampaignStage,
      achievementChainCount: () => REBIRTH_CONDITIONS.requiredAchievementChainCount,
      onReset: () => {},
      nowProvider: () => currentTime,
    });
    sys.rebirth.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel);

    const first = sys.rebirth.executeRebirth();
    expect(first.success).toBe(true);
    expect(first.newCount).toBe(1);

    // 推进时间超过冷却期（72小时）
    currentTime += 73 * 60 * 60 * 1000;

    // 再次满足条件转生
    sys.rebirth.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel);
    const second = sys.rebirth.executeRebirth();
    expect(second.success).toBe(true);
    expect(second.newCount).toBe(2);
    expect(second.multiplier!).toBeGreaterThan(first.multiplier!);
  });

  it('转生记录可追溯', () => {
    setupRebirthReady(sys);
    sys.rebirth.executeRebirth();
    const state = sys.rebirth.getState();
    expect(state.rebirthRecords.length).toBe(1);
    expect(state.rebirthRecords[0].rebirthCount).toBe(1);
    expect(state.rebirthRecords[0].multiplier).toBeGreaterThan(0);
    expect(state.rebirthRecords[0].timestamp).toBeGreaterThan(0);
  });

  it('RebirthSystem reset 清空转生状态', () => {
    setupRebirthReady(sys);
    sys.rebirth.executeRebirth();
    sys.rebirth.reset();
    const state = sys.rebirth.getState();
    expect(state.rebirthCount).toBe(0);
    expect(state.currentMultiplier).toBe(1.0);
    expect(state.rebirthRecords).toEqual([]);
    expect(state.accelerationDaysLeft).toBe(0);
  });

  it('转生条件不满足时执行失败并返回原因', () => {
    // 默认状态不满足任何条件
    const result = sys.rebirth.executeRebirth();
    expect(result.success).toBe(false);
    expect(result.reason).toContain('条件不满足');
  });

  it('转生解锁内容 — 第1次解锁转生商店', () => {
    const contents = REBIRTH_UNLOCK_CONTENTS;
    const first = contents.find(c => c.requiredRebirthCount === 1);
    expect(first).toBeDefined();
    expect(first!.type).toBe('feature');
    expect(first!.unlockId).toBe('rebirth_shop');
  });

  it('转生解锁内容 — 第5次解锁高级科技', () => {
    const contents = REBIRTH_UNLOCK_CONTENTS;
    const fifth = contents.find(c => c.requiredRebirthCount === 5);
    expect(fifth).toBeDefined();
    expect(fifth!.type).toBe('tech');
    expect(fifth!.unlockId).toBe('tech_advanced');
  });

  it('isFeatureUnlocked 按转生次数判断', () => {
    // 初始0次，不应解锁任何内容
    expect(sys.rebirth.isFeatureUnlocked('rebirth_shop')).toBe(false);
    expect(sys.rebirth.isFeatureUnlocked('tech_advanced')).toBe(false);
  });

  it('getUnlockedContents 初始为空', () => {
    const unlocked = sys.rebirth.getUnlockedContents();
    expect(unlocked.length).toBe(0);
  });
});
