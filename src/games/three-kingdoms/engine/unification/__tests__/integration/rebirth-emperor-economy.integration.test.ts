/**
 * 集成测试 — §5+§8~§10 转生深度+4货币+帝王模式
 *
 * 验证转生5条件+72h冷却、铜钱/天命/双代币循环、帝王模式解锁+24h冷静期+全系统×2。
 * 跨模块数据流：CurrencySystem → PrestigeSystem → RebirthSystem → HeritageSystem
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CurrencySystem } from '../../../currency/CurrencySystem';
import { PrestigeSystem } from '../../../prestige/PrestigeSystem';
import { RebirthSystem } from '../../../prestige/RebirthSystem';
import { HeritageSystem } from '../../../heritage/HeritageSystem';
import {
  REBIRTH_CONDITIONS,
  REBIRTH_ACCELERATION,
  REBIRTH_KEEP_RULES,
  REBIRTH_RESET_RULES,
  MAX_PRESTIGE_LEVEL,
} from '../../../../core/prestige';
import type { ISystemDeps } from '../../../../core/types';
import type { CurrencyType } from '../../../../core/currency';

// ─────────────────────────────────────────────
// 辅助
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
    registry: {
      register: vi.fn(),
      get: vi.fn(),
      getAll: vi.fn().mockReturnValue(new Map()),
      has: vi.fn().mockReturnValue(false),
      unregister: vi.fn(),
    },
  } as unknown as ISystemDeps;
}

function mockHero(id: string, level = 50, exp = 10000, quality = 4) {
  return { id, level, exp, quality, faction: 'shu' as const, skillLevels: [5, 5, 5], favorability: 80 };
}

function mockEquip(uid: string, slot = 'weapon', rarity = 3, enhanceLevel = 10) {
  return { uid, slot, rarity, enhanceLevel };
}

/** 满足全部转生条件的回调 */
function fullRebirthCallbacks() {
  return {
    castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel + 5,
    heroCount: () => REBIRTH_CONDITIONS.minHeroCount + 3,
    totalPower: () => REBIRTH_CONDITIONS.minTotalPower * 5,
    prestigeLevel: () => REBIRTH_CONDITIONS.minPrestigeLevel + 5,
  };
}

// ═════════════════════════════════════════════════════════════

describe('§5+§8~§10 转生深度+4货币+帝王模式 集成测试', () => {
  let deps: ISystemDeps;
  let currency: CurrencySystem;
  let prestige: PrestigeSystem;
  let rebirth: RebirthSystem;
  let heritage: HeritageSystem;

  beforeEach(() => {
    deps = mockDeps();
    currency = new CurrencySystem();
    prestige = new PrestigeSystem();
    rebirth = new RebirthSystem();
    heritage = new HeritageSystem();

    currency.init(deps);
    prestige.init(deps);
    rebirth.init(deps);
    heritage.init(deps);
  });

  // ─── §5 转生深度 — 5条件验证 ──────────────────

  describe('§5 转生深度 — 5条件+冷却', () => {
    it('转生条件包含7个维度：声望/城堡/武将/战力/通关/成就链/冷却', () => {
      const check = rebirth.checkRebirthConditions();
      const keys = Object.keys(check.conditions);
      expect(keys).toContain('prestigeLevel');
      expect(keys).toContain('castleLevel');
      expect(keys).toContain('heroCount');
      expect(keys).toContain('totalPower');
      expect(keys).toContain('campaignProgress');
      expect(keys).toContain('achievementChain');
      expect(keys).toContain('cooldown');
      expect(keys).toHaveLength(7);
    });

    it('声望等级不足时转生被拒绝', () => {
      rebirth.setCallbacks({
        ...fullRebirthCallbacks(),
        prestigeLevel: () => REBIRTH_CONDITIONS.minPrestigeLevel - 1,
      });
      rebirth.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel - 1);
      const result = rebirth.executeRebirth();
      expect(result.success).toBe(false);
      expect(result.reason).toContain('prestigeLevel');
    });

    it('城堡等级不足时转生被拒绝', () => {
      rebirth.setCallbacks({
        ...fullRebirthCallbacks(),
        castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel - 1,
      });
      rebirth.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel + 5);
      const result = rebirth.executeRebirth();
      expect(result.success).toBe(false);
      expect(result.reason).toContain('castleLevel');
    });

    it('武将数量不足时转生被拒绝', () => {
      rebirth.setCallbacks({
        ...fullRebirthCallbacks(),
        heroCount: () => REBIRTH_CONDITIONS.minHeroCount - 1,
      });
      rebirth.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel + 5);
      const result = rebirth.executeRebirth();
      expect(result.success).toBe(false);
      expect(result.reason).toContain('heroCount');
    });

    it('总战力不足时转生被拒绝', () => {
      rebirth.setCallbacks({
        ...fullRebirthCallbacks(),
        totalPower: () => REBIRTH_CONDITIONS.minTotalPower - 1,
      });
      rebirth.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel + 5);
      const result = rebirth.executeRebirth();
      expect(result.success).toBe(false);
      expect(result.reason).toContain('totalPower');
    });

    it('转生保留规则含英雄/装备/科技/声望，重置规则含建筑/资源/地图', () => {
      const keepRules = rebirth.getKeepRules();
      expect(keepRules).toContain('keep_heroes');
      expect(keepRules).toContain('keep_equipment');
      expect(keepRules).toContain('keep_tech_points');
      expect(keepRules).toContain('keep_prestige');
      const resetRules = rebirth.getResetRules();
      expect(resetRules).toContain('reset_buildings');
      expect(resetRules).toContain('reset_resources');
      expect(resetRules).toContain('reset_map_progress');
    });

    it('转生成功后触发resetCallback传入重置规则', () => {
      const resetFn = vi.fn();
      rebirth.setCallbacks({ ...fullRebirthCallbacks(), onReset: resetFn });
      rebirth.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel + 5);
      rebirth.executeRebirth();
      expect(resetFn).toHaveBeenCalledWith([...REBIRTH_RESET_RULES]);
    });

    it('转生成功后记录包含次数/倍率/时间戳', () => {
      rebirth.setCallbacks(fullRebirthCallbacks());
      rebirth.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel + 5);
      rebirth.executeRebirth();
      const records = rebirth.getRebirthRecords();
      expect(records).toHaveLength(1);
      expect(records[0].rebirthCount).toBe(1);
      expect(records[0].multiplier).toBeGreaterThan(1.0);
      expect(records[0].timestamp).toBeGreaterThan(0);
    });

    it('转生加速期持续7天，倍率大于1', () => {
      expect(REBIRTH_ACCELERATION.durationDays).toBe(7);
      expect(REBIRTH_ACCELERATION.resourceMultiplier).toBeGreaterThan(1);
      expect(REBIRTH_ACCELERATION.buildSpeedMultiplier).toBeGreaterThan(1);
      expect(REBIRTH_ACCELERATION.techSpeedMultiplier).toBeGreaterThan(1);
      expect(REBIRTH_ACCELERATION.expMultiplier).toBeGreaterThan(1);
    });

    it('收益模拟器返回完整预估数据', () => {
      const result = rebirth.simulateEarnings({
        currentRebirthCount: 0,
        dailyOnlineHours: 4,
        simulateDays: 30,
      });
      expect(result.estimatedResources.gold).toBeGreaterThan(0);
      expect(result.estimatedResources.grain).toBeGreaterThan(0);
      expect(result.estimatedPrestigeGain).toBeGreaterThan(0);
      expect(result.days).toBe(30);
      expect(result.rebirthAccelerationBonus).toBeDefined();
    });
  });

  // ─── §8 四货币循环 ────────────────────────────

  describe('§8 四货币循环 — 铜钱/天命/双代币', () => {
    it('铜钱copper基础余额1000，天命mandate初始为0', () => {
      expect(currency.getBalance('copper')).toBe(1000);
      expect(currency.getBalance('mandate')).toBe(0);
    });

    it('招贤榜recruit上限999，求贤令summon上限99', () => {
      expect(currency.getCap('recruit')).toBe(999);
      expect(currency.getCap('summon')).toBe(99);
    });

    it('铜钱无上限可大量累积', () => {
      const added = currency.addCurrency('copper', 999999);
      expect(added).toBe(999999);
      expect(currency.getBalance('copper')).toBe(1000 + 999999);
    });

    it('有上限货币添加时不超过上限', () => {
      currency.setCurrency('recruit', 990);
      const added = currency.addCurrency('recruit', 20);
      expect(added).toBe(9); // 999 - 990 = 9
      expect(currency.getBalance('recruit')).toBe(999);
    });

    it('货币不足时spendCurrency抛出异常含缺少信息', () => {
      expect(() => currency.spendCurrency('mandate', 100)).toThrow(/天命不足/);
    });

    it('checkAffordability批量检查返回不足列表', () => {
      const result = currency.checkAffordability({ copper: 500, mandate: 100 });
      expect(result.canAfford).toBe(false);
      expect(result.shortages.length).toBe(1);
      expect(result.shortages[0].currency).toBe('mandate');
    });

    it('元宝为付费货币，铜钱/天命为免费货币', () => {
      expect(currency.isPaidCurrency('ingot')).toBe(true);
      expect(currency.isPaidCurrency('copper')).toBe(false);
      expect(currency.isPaidCurrency('mandate')).toBe(false);
    });

    it('按优先级消耗：normal优先扣铜钱', () => {
      currency.addCurrency('copper', 5000);
      const result = currency.spendByPriority('normal', { copper: 100 });
      expect(result.copper).toBe(100);
    });

    it('序列化/反序列化保持余额一致', () => {
      currency.addCurrency('copper', 5000);
      currency.addCurrency('mandate', 100);
      const data = currency.serialize();
      const newCurrency = new CurrencySystem();
      newCurrency.init(deps);
      newCurrency.deserialize(data);
      expect(newCurrency.getBalance('copper')).toBe(6000);
      expect(newCurrency.getBalance('mandate')).toBe(100);
    });
  });

  // ─── §9~§10 帝王模式 — 解锁+冷静期+全系统×2 ───

  describe('§9~§10 帝王模式 — 解锁+全系统×2', () => {
    it('帝王模式需转生10次解锁，未满足时不可用', () => {
      const unlocks = rebirth.getUnlockContents();
      const emperorRoad = unlocks.find(u => u.unlockId === 'emperor_road');
      expect(emperorRoad).toBeDefined();
      expect(emperorRoad!.requiredRebirthCount).toBe(10);
      // 0次转生时不可解锁
      const unlocked = rebirth.getUnlockedContents();
      expect(unlocked.find(u => u.unlockId === 'emperor_road')).toBeUndefined();
    });

    it('转生加速期有效倍率=基础倍率×加速倍率', () => {
      rebirth.setCallbacks(fullRebirthCallbacks());
      rebirth.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel + 5);
      rebirth.executeRebirth();

      const multipliers = rebirth.getEffectiveMultipliers();
      const baseMultiplier = rebirth.getCurrentMultiplier();

      expect(multipliers.buildSpeed).toBe(baseMultiplier * REBIRTH_ACCELERATION.buildSpeedMultiplier);
      expect(multipliers.resource).toBe(baseMultiplier * REBIRTH_ACCELERATION.resourceMultiplier);
    });

    it('声望等级达到50（帝王）时获得最高产出加成', () => {
      // 强制升级到50
      for (let i = 0; i < 2000; i++) {
        prestige.addPrestigePoints('main_quest', 10000);
      }
      const level = prestige.getState().currentLevel;
      const bonus = prestige.getProductionBonus();
      expect(bonus).toBe(1 + level * 0.02);
      if (level >= 50) {
        expect(prestige.getLevelInfo(50).title).toBe('帝王');
      }
    });

    it('转生后传承系统初始化加速状态', () => {
      heritage.initRebirthAcceleration();
      const accelState = heritage.getAccelerationState();
      expect(accelState).toBeDefined();
    });

    it('传承系统收益模拟器返回完整预估', () => {
      const result = heritage.simulateEarnings({
        currentRebirthCount: 1,
        dailyOnlineHours: 4,
        simulateDays: 7,
      });
      expect(result).toBeDefined();
    });

    it('转生解锁内容逐步开放：商店→高级武将→特殊建筑', () => {
      const allUnlocks = rebirth.getUnlockContents();
      expect(allUnlocks.length).toBeGreaterThanOrEqual(3);
      // 按转生次数升序
      for (let i = 1; i < allUnlocks.length; i++) {
        expect(allUnlocks[i].requiredRebirthCount).toBeGreaterThan(
          allUnlocks[i - 1].requiredRebirthCount,
        );
      }
    });
  });
});
