/**
 * 集成测试 — §10.4 传承→转生→加速重建 全链路
 *
 * 验证：声望积累→传承点→转生→初始赠送→一键重建
 *       HeritageSystem + RebirthSystem + PrestigeSystem 交互。
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HeritageSystem } from '../../HeritageSystem';
import { RebirthSystem } from '../../../prestige/RebirthSystem';
import { PrestigeSystem, calcRequiredPoints } from '../../../prestige/PrestigeSystem';
import type { ISystemDeps } from '../../../../core/types/subsystem';
import {
  REBIRTH_CONDITIONS,
  REBIRTH_ACCELERATION,
  REBIRTH_KEEP_RULES,
  REBIRTH_RESET_RULES,
} from '../../../../core/prestige';
import {
  DAILY_HERITAGE_LIMIT,
  REBIRTH_INITIAL_GIFT,
  INSTANT_UPGRADE_COUNT_PER_REBIRTH,
} from '../../../../core/heritage';

// ─────────────────────────────────────────────
// Mock 基础设施
// ─────────────────────────────────────────────

function createMockEventBus() {
  const listeners: Record<string, Function[]> = {};
  return {
    on: (event: string, cb: Function) => { (listeners[event] ??= []).push(cb); },
    emit: vi.fn((event: string, payload?: unknown) => {
      (listeners[event] ?? []).forEach(cb => cb(payload));
    }),
    off: vi.fn(),
    once: vi.fn(),
    removeAllListeners: vi.fn(),
  };
}

function createMockDeps(): ISystemDeps {
  return {
    eventBus: createMockEventBus() as unknown as ISystemDeps['eventBus'],
    config: { get: vi.fn() } as unknown as ISystemDeps['config'],
    registry: { get: vi.fn() } as unknown as ISystemDeps['registry'],
  };
}

// ─────────────────────────────────────────────
// 共享数据
// ─────────────────────────────────────────────

interface MockHero {
  id: string; level: number; exp: number; quality: number;
  faction: 'shu' | 'wei' | 'wu' | 'qun'; skillLevels: number[]; favorability: number;
}

interface MockEquip {
  uid: string; slot: string; rarity: number; enhanceLevel: number;
}

function createFullEnv() {
  const heroes: Record<string, MockHero> = {};
  const equips: Record<string, MockEquip> = {};
  const resources: Record<string, number> = { copper: 500000, grain: 0, enhanceStone: 0 };
  const upgradedBuildings: string[] = [];
  const resetRules: string[] = [];
  let castleLevel = 15;
  let heroCount = 8;
  let totalPower = 50000;
  let rebirthCount = 0;

  let prestigeLevel = 1;

  const eventBus = createMockEventBus();
  const deps = {
    eventBus: eventBus as unknown as ISystemDeps['eventBus'],
    config: { get: vi.fn() } as unknown as ISystemDeps['config'],
    registry: { get: vi.fn() } as unknown as ISystemDeps['registry'],
  };

  // PrestigeSystem
  const prestige = new PrestigeSystem();
  prestige.init(deps);

  // RebirthSystem
  const rebirth = new RebirthSystem();
  rebirth.init(deps);
  rebirth.setCallbacks({
    castleLevel: () => castleLevel,
    heroCount: () => heroCount,
    totalPower: () => totalPower,
    prestigeLevel: () => prestigeLevel,
    onReset: (rules) => { resetRules.push(...rules); },
  });

  // HeritageSystem
  const heritage = new HeritageSystem();
  heritage.init(deps);
  heritage.setCallbacks({
    getHero: (id) => heroes[id] ?? null,
    getEquip: (uid) => equips[uid] ?? null,
    updateHero: (id, u) => { if (heroes[id]) Object.assign(heroes[id], u); },
    removeEquip: (uid) => { delete equips[uid]; },
    updateEquip: (uid, u) => { if (equips[uid]) Object.assign(equips[uid], u); },
    addResources: (r) => { for (const [k, v] of Object.entries(r)) resources[k] = (resources[k] ?? 0) + v; },
    upgradeBuilding: (id) => { upgradedBuildings.push(id); return true; },
    getRebirthCount: () => rebirthCount,
  });

  return {
    prestige, rebirth, heritage, heroes, equips, resources,
    upgradedBuildings, resetRules, eventBus, deps,
    setCastleLevel: (v: number) => { castleLevel = v; },
    setHeroCount: (v: number) => { heroCount = v; },
    setTotalPower: (v: number) => { totalPower = v; },
    incrementRebirth: () => { rebirthCount++; },
    getRebirthCount: () => rebirthCount,
    /** 增加声望并同步到转生系统 */
    addPrestigeAndSync: (points: number, source: string = 'main_quest') => {
      prestige.addPrestigePoints(source as unknown as Record<string, unknown>, points);
      prestigeLevel = prestige.getCurrentLevelInfo().level;
      rebirth.updatePrestigeLevel(prestigeLevel);
    },
  };
}

function mockHero(o: Partial<MockHero> & { id: string }): MockHero {
  return { level: 30, exp: 10000, quality: 4, faction: 'shu', skillLevels: [5, 3, 2], favorability: 80, ...o };
}

// ═══════════════════════════════════════════════════════════════════════

describe('§10.4 传承→转生→加速重建 集成测试', () => {

  // ═══════════════════════════════════════════════════════════════════
  // §10.4.1 声望积累 → 转生条件
  // ═══════════════════════════════════════════════════════════════════

  describe('§10.4.1 声望积累 → 转生条件', () => {
    it('声望等级不足时转生条件检查不通过', () => {
      const { rebirth } = createFullEnv();
      const check = rebirth.checkRebirthConditions();
      expect(check.canRebirth).toBe(false);
      expect(check.conditions.prestigeLevel.met).toBe(false);
    });

    it('声望等级满足但其他条件不足时仍不能转生', () => {
      const env = createFullEnv();
      // 升级声望到20级以上（一次性给大量声望）
      env.addPrestigeAndSync(calcRequiredPoints(25), 'main_quest');
      env.setCastleLevel(3); // 城堡等级不足
      const check = env.rebirth.checkRebirthConditions();
      expect(check.canRebirth).toBe(false);
      expect(check.conditions.castleLevel.met).toBe(false);
    });

    it('全部条件满足后可以转生', () => {
      const env = createFullEnv();
      env.addPrestigeAndSync(calcRequiredPoints(25), 'main_quest');
      env.setCastleLevel(15);
      env.setHeroCount(8);
      env.setTotalPower(50000);
      const check = env.rebirth.checkRebirthConditions();
      expect(check.canRebirth).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // §10.4.2 转生执行 → 倍率与保留规则
  // ═══════════════════════════════════════════════════════════════════

  describe('§10.4.2 转生执行 → 倍率与保留规则', () => {
    it('执行转生后倍率正确递增', () => {
      const env = createFullEnv();
      env.addPrestigeAndSync(calcRequiredPoints(25), 'main_quest');

      const beforeMultiplier = env.rebirth.getCurrentMultiplier();
      const result = env.rebirth.executeRebirth();

      expect(result.success).toBe(true);
      expect(result.newCount).toBe(1);
      expect(result.multiplier).toBeGreaterThan(beforeMultiplier);
    });

    it('转生后保留规则正确执行', () => {
      const env = createFullEnv();
      env.addPrestigeAndSync(calcRequiredPoints(25), 'main_quest');

      env.rebirth.executeRebirth();
      expect(env.resetRules).toEqual([...REBIRTH_RESET_RULES]);
    });

    it('转生后保留英雄、装备、声望', () => {
      const rules = REBIRTH_KEEP_RULES;
      expect(rules).toContain('keep_heroes');
      expect(rules).toContain('keep_equipment');
      expect(rules).toContain('keep_prestige');
    });

    it('转生事件 rebirth:completed 正确触发', () => {
      const env = createFullEnv();
      env.addPrestigeAndSync(calcRequiredPoints(25), 'main_quest');

      env.rebirth.executeRebirth();
      expect(env.eventBus.emit).toHaveBeenCalledWith(
        'rebirth:completed',
        expect.objectContaining({ count: 1 }),
      );
    });

    it('转生后加速期天数正确设置', () => {
      const env = createFullEnv();
      env.addPrestigeAndSync(calcRequiredPoints(25), 'main_quest');

      env.rebirth.executeRebirth();
      const accel = env.rebirth.getAcceleration();
      expect(accel.active).toBe(true);
      expect(accel.daysLeft).toBe(REBIRTH_ACCELERATION.durationDays);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // §10.4.3 转生后初始赠送
  // ═══════════════════════════════════════════════════════════════════

  describe('§10.4.3 转生后初始赠送', () => {
    it('领取初始赠送获得资源', () => {
      const env = createFullEnv();
      env.heritage.initRebirthAcceleration();

      const result = env.heritage.claimInitialGift();
      expect(result.success).toBe(true);
      expect(result.resources.grain).toBe(REBIRTH_INITIAL_GIFT.grain);
      expect(result.resources.copper).toBe(REBIRTH_INITIAL_GIFT.copper);
      expect(result.resources.enhanceStone).toBe(REBIRTH_INITIAL_GIFT.enhanceStone);
    });

    it('初始赠送只能领取一次', () => {
      const env = createFullEnv();
      env.heritage.initRebirthAcceleration();

      env.heritage.claimInitialGift();
      const result = env.heritage.claimInitialGift();
      expect(result.success).toBe(false);
      expect(result.reason).toContain('已领取');
    });

    it('初始赠送资源正确写入资源池', () => {
      const env = createFullEnv();
      env.heritage.initRebirthAcceleration();

      const grainBefore = env.resources.grain;
      env.heritage.claimInitialGift();
      expect(env.resources.grain).toBe(grainBefore + REBIRTH_INITIAL_GIFT.grain);
    });

    it('初始赠送触发 heritage:initialGiftClaimed 事件', () => {
      const env = createFullEnv();
      env.heritage.initRebirthAcceleration();

      env.heritage.claimInitialGift();
      expect(env.eventBus.emit).toHaveBeenCalledWith(
        'heritage:initialGiftClaimed',
        expect.objectContaining({ grain: REBIRTH_INITIAL_GIFT.grain }),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // §10.4.4 一键重建
  // ═══════════════════════════════════════════════════════════════════

  describe('§10.4.4 一键重建', () => {
    it('一键重建按优先级升级建筑', () => {
      const env = createFullEnv();
      env.heritage.initRebirthAcceleration();

      const result = env.heritage.executeRebuild();
      expect(result.success).toBe(true);
      expect(result.upgradedBuildings.length).toBeGreaterThan(0);
      expect(env.upgradedBuildings).toContain('castle');
    });

    it('一键重建只能执行一次', () => {
      const env = createFullEnv();
      env.heritage.initRebirthAcceleration();

      env.heritage.executeRebuild();
      const result = env.heritage.executeRebuild();
      expect(result.success).toBe(false);
      expect(result.reason).toContain('已执行');
    });

    it('一键重建触发 heritage:rebuildCompleted 事件', () => {
      const env = createFullEnv();
      env.heritage.initRebirthAcceleration();

      env.heritage.executeRebuild();
      expect(env.eventBus.emit).toHaveBeenCalledWith(
        'heritage:rebuildCompleted',
        expect.objectContaining({ upgradedBuildings: expect.any(Array) }),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // §10.4.5 瞬间升级
  // ═══════════════════════════════════════════════════════════════════

  describe('§10.4.5 瞬间升级', () => {
    it('转生后可瞬间升级建筑', () => {
      const env = createFullEnv();
      env.incrementRebirth(); // 1次转生
      env.heritage.initRebirthAcceleration();

      const result = env.heritage.instantUpgrade('farm');
      expect(result.success).toBe(true);
      expect(env.upgradedBuildings).toContain('farm');
    });

    it('瞬间升级次数基于转生次数', () => {
      const env = createFullEnv();
      env.incrementRebirth(); // 1次转生 = 5次瞬间升级
      env.heritage.initRebirthAcceleration();

      const maxUpgrades = 1 * INSTANT_UPGRADE_COUNT_PER_REBIRTH;
      for (let i = 0; i < maxUpgrades; i++) {
        const r = env.heritage.instantUpgrade(`building_${i}`);
        expect(r.success).toBe(true);
      }
      // 第6次应失败
      const overflow = env.heritage.instantUpgrade('overflow');
      expect(overflow.success).toBe(false);
    });

    it('同一建筑不能重复瞬间升级', () => {
      const env = createFullEnv();
      env.incrementRebirth();
      env.heritage.initRebirthAcceleration();

      env.heritage.instantUpgrade('farm');
      const result = env.heritage.instantUpgrade('farm');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('已瞬间升级');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // §10.4.6 转生次数解锁
  // ═══════════════════════════════════════════════════════════════════

  describe('§10.4.6 转生次数解锁', () => {
    it('1次转生解锁天命系统', () => {
      const env = createFullEnv();
      env.incrementRebirth();
      const unlocks = env.heritage.getRebirthUnlocks();
      const mandate = unlocks.find(u => u.unlockId === 'mandate_system');
      expect(mandate?.unlocked).toBe(true);
    });

    it('3次转生解锁神话武将招募池', () => {
      const env = createFullEnv();
      for (let i = 0; i < 3; i++) env.incrementRebirth();
      expect(env.heritage.isUnlocked('mythic_hero_pool')).toBe(true);
    });

    it('0次转生所有内容未解锁', () => {
      const env = createFullEnv();
      const unlocks = env.heritage.getRebirthUnlocks();
      expect(unlocks.every(u => !u.unlocked)).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // §10.4.7 收益模拟器
  // ═══════════════════════════════════════════════════════════════════

  describe('§10.4.7 收益模拟器', () => {
    it('模拟器返回立即转生和等待转生的收益对比', () => {
      const env = createFullEnv();
      const result = env.heritage.simulateEarnings({
        currentRebirthCount: 0,
        dailyOnlineHours: 4,
        waitHours: 12,
      });
      expect(result.immediateMultiplier).toBeGreaterThan(0);
      expect(result.immediateEarnings).toBeDefined();
      expect(result.waitEarnings).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('转生收益模拟器：在线时长影响置信度', () => {
      const env = createFullEnv();
      const short = env.heritage.simulateEarnings({ currentRebirthCount: 0, dailyOnlineHours: 2, waitHours: 0 });
      const long = env.heritage.simulateEarnings({ currentRebirthCount: 0, dailyOnlineHours: 8, waitHours: 0 });
      expect(long.confidence).toBeGreaterThan(short.confidence);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // §10.4.8 全链路端到端
  // ═══════════════════════════════════════════════════════════════════

  describe('§10.4.8 全链路端到端', () => {
    it('完整流程：声望→转生→赠送→重建→传承', () => {
      const env = createFullEnv();

      // 1. 积累声望到20级以上
      env.addPrestigeAndSync(calcRequiredPoints(25), 'main_quest');
      expect(env.prestige.getCurrentLevelInfo().level).toBeGreaterThanOrEqual(REBIRTH_CONDITIONS.minPrestigeLevel);

      // 2. 转生
      const rebirthResult = env.rebirth.executeRebirth();
      expect(rebirthResult.success).toBe(true);
      env.incrementRebirth();

      // 3. 初始化加速状态
      env.heritage.initRebirthAcceleration();

      // 4. 领取初始赠送
      const gift = env.heritage.claimInitialGift();
      expect(gift.success).toBe(true);
      expect(env.resources.grain).toBe(REBIRTH_INITIAL_GIFT.grain);

      // 5. 一键重建
      const rebuild = env.heritage.executeRebuild();
      expect(rebuild.success).toBe(true);
      expect(rebuild.upgradedBuildings.length).toBeGreaterThan(0);

      // 6. 传承武将经验到新阵容
      env.heroes.veteran = mockHero({ id: 'veteran', quality: 5, exp: 50000, skillLevels: [10, 8, 6] });
      env.heroes.newHero = mockHero({ id: 'newHero', quality: 4, exp: 0, skillLevels: [1, 1, 1] });
      const heritageResult = env.heritage.executeHeroHeritage({
        sourceHeroId: 'veteran', targetHeroId: 'newHero',
        options: { expEfficiency: 1.0, transferSkillLevels: true },
      });
      expect(heritageResult.success).toBe(true);
      expect(env.heroes.newHero.exp).toBeGreaterThan(0);

      // 7. 验证整体状态
      const heritageState = env.heritage.getState();
      expect(heritageState.heroHeritageCount).toBe(1);
    });
  });
});
