/**
 * 集成测试 — §10.1 羁绊→装备→传承 核心循环
 *
 * 验证：羁绊效果影响装备收益、传承保留规则、
 *       BondSystem + HeritageSystem 交互链路。
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BondSystem } from '../../../bond/BondSystem';
import { HeritageSystem } from '../../HeritageSystem';
import type { ISystemDeps } from '../../../../core/types/subsystem';
import type {
  HeroHeritageRequest,
  EquipmentHeritageRequest,
  ExperienceHeritageRequest,
} from '../../../../core/heritage';
import type { GeneralData, Faction } from '../../../hero/hero.types';
import { Quality } from '../../../hero/hero.types';
import {
  HERO_HERITAGE_RULE,
  EQUIPMENT_HERITAGE_RULE,
  EXPERIENCE_HERITAGE_RULE,
  RARITY_DIFF_EFFICIENCY,
  DAILY_HERITAGE_LIMIT,
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
  faction: Faction; skillLevels: number[]; favorability: number;
}

interface MockEquip {
  uid: string; slot: string; rarity: number; enhanceLevel: number;
}

function createIntegrationEnv() {
  const heroes: Record<string, MockHero> = {};
  const equips: Record<string, MockEquip> = {};
  const resources: Record<string, number> = { copper: 100000 };
  const upgradedBuildings: string[] = [];
  const eventBus = createMockEventBus();
  const deps = {
    eventBus: eventBus as unknown as ISystemDeps['eventBus'],
    config: { get: vi.fn() } as unknown as ISystemDeps['config'],
    registry: { get: vi.fn() } as unknown as ISystemDeps['registry'],
  };

  const bond = new BondSystem();
  bond.init(deps);

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
    getRebirthCount: () => 0,
  });

  return { bond, heritage, heroes, equips, resources, eventBus, deps };
}

function mockHero(o: Partial<MockHero> & { id: string }): MockHero {
  return { level: 30, exp: 10000, quality: 4, faction: 'shu', skillLevels: [5, 3, 2], favorability: 80, ...o };
}

function mockEquip(o: Partial<MockEquip> & { uid: string }): MockEquip {
  return { slot: 'weapon', rarity: 4, enhanceLevel: 10, ...o };
}

function makeGeneralData(h: MockHero): GeneralData {
  return {
    id: h.id, name: h.id, quality: Quality.RARE, level: h.level, exp: h.exp,
    faction: h.faction, baseStats: { attack: 100, defense: 80, intelligence: 60, speed: 50 }, skills: [],
  };
}

// ═══════════════════════════════════════════════════════════════════════

describe('§10.1 羁绊→装备→传承 集成测试', () => {

  // ═══════════════════════════════════════════════════════════════════
  // §10.1.1 羁绊检测 → 装备收益影响
  // ═══════════════════════════════════════════════════════════════════

  describe('§10.1.1 羁绊检测 → 装备收益影响', () => {
    it('同阵营2人激活"同乡之谊"羁绊', () => {
      const { bond } = createIntegrationEnv();
      const heroes = [
        makeGeneralData(mockHero({ id: 'liubei', faction: 'shu' })),
        makeGeneralData(mockHero({ id: 'guanyu', faction: 'shu' })),
      ];
      const bonds = bond.detectActiveBonds(heroes);
      expect(bonds).toHaveLength(1);
      expect(bonds[0].type).toBe('faction_2');
      expect(bonds[0].faction).toBe('shu');
    });

    it('3同阵营激活"同仇敌忾"羁绊', () => {
      const { bond } = createIntegrationEnv();
      const heroes = ['liubei', 'guanyu', 'zhangfei'].map(id =>
        makeGeneralData(mockHero({ id, faction: 'shu' }))
      );
      const bonds = bond.detectActiveBonds(heroes);
      expect(bonds.some(b => b.type === 'faction_3')).toBe(true);
    });

    it('羁绊加成计算：attack加成正确叠加', () => {
      const { bond } = createIntegrationEnv();
      const heroes = ['liubei', 'guanyu', 'zhangfei'].map(id =>
        makeGeneralData(mockHero({ id, faction: 'shu' }))
      );
      const bonds = bond.detectActiveBonds(heroes);
      const bonuses = bond.calculateTotalBondBonuses(bonds);
      expect(bonuses.attack).toBeGreaterThan(0);
    });

    it('编队预览包含羁绊分布信息', () => {
      const { bond } = createIntegrationEnv();
      const heroes = [
        makeGeneralData(mockHero({ id: 'liubei', faction: 'shu' })),
        makeGeneralData(mockHero({ id: 'caocao', faction: 'wei' })),
      ];
      const preview = bond.getFormationPreview('form-1', heroes);
      expect(preview.factionDistribution.shu).toBe(1);
      expect(preview.factionDistribution.wei).toBe(1);
      expect(preview.activeBonds).toHaveLength(0);
    });

    it('混搭3+3激活"混搭协作"羁绊', () => {
      const { bond } = createIntegrationEnv();
      const heroes = [
        ...['liubei', 'guanyu', 'zhangfei'].map(id => makeGeneralData(mockHero({ id, faction: 'shu' }))),
        ...['caocao', 'xuchu', 'simayi'].map(id => makeGeneralData(mockHero({ id, faction: 'wei' }))),
      ];
      const bonds = bond.detectActiveBonds(heroes);
      expect(bonds.some(b => b.type === 'mixed_3_3')).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // §10.1.2 装备传承核心规则
  // ═══════════════════════════════════════════════════════════════════

  describe('§10.1.2 装备传承核心规则', () => {
    it('同品质装备传承：效率100%，等级-1', () => {
      const { heritage, equips } = createIntegrationEnv();
      equips.src = mockEquip({ uid: 'src', slot: 'weapon', rarity: 4, enhanceLevel: 10 });
      equips.tgt = mockEquip({ uid: 'tgt', slot: 'weapon', rarity: 4, enhanceLevel: 3 });

      const result = heritage.executeEquipmentHeritage({
        sourceUid: 'src', targetUid: 'tgt', options: { transferEnhanceLevel: true },
      });

      expect(result.success).toBe(true);
      expect(result.efficiency).toBe(RARITY_DIFF_EFFICIENCY['same']);
      expect(equips.tgt.enhanceLevel).toBe(9); // (10-1)*1.0
    });

    it('目标品质高2级：效率75%', () => {
      const { heritage, equips } = createIntegrationEnv();
      equips.src = mockEquip({ uid: 'src', slot: 'weapon', rarity: 2, enhanceLevel: 10 });
      equips.tgt = mockEquip({ uid: 'tgt', slot: 'weapon', rarity: 4, enhanceLevel: 3 });

      const result = heritage.executeEquipmentHeritage({
        sourceUid: 'src', targetUid: 'tgt', options: { transferEnhanceLevel: true },
      });

      expect(result.success).toBe(true);
      expect(result.efficiency).toBe(RARITY_DIFF_EFFICIENCY['higher_2']);
      expect(equips.tgt.enhanceLevel).toBe(Math.floor((10 - 1) * 0.75));
    });

    it('不同部位装备传承被拒绝', () => {
      const { heritage, equips } = createIntegrationEnv();
      equips.src = mockEquip({ uid: 'src', slot: 'weapon', rarity: 4, enhanceLevel: 10 });
      equips.tgt = mockEquip({ uid: 'tgt', slot: 'armor', rarity: 4, enhanceLevel: 3 });

      const result = heritage.executeEquipmentHeritage({
        sourceUid: 'src', targetUid: 'tgt', options: { transferEnhanceLevel: true },
      });

      expect(result.success).toBe(false);
      expect(result.reason).toContain('同部位');
    });

    it('源装备传承后被消耗', () => {
      const { heritage, equips } = createIntegrationEnv();
      equips.src = mockEquip({ uid: 'src', slot: 'weapon', rarity: 4, enhanceLevel: 10 });
      equips.tgt = mockEquip({ uid: 'tgt', slot: 'weapon', rarity: 4, enhanceLevel: 3 });

      heritage.executeEquipmentHeritage({
        sourceUid: 'src', targetUid: 'tgt', options: { transferEnhanceLevel: true },
      });

      expect(equips.src).toBeUndefined();
    });

    it('装备传承扣除铜钱', () => {
      const { heritage, equips, resources } = createIntegrationEnv();
      const beforeCopper = resources.copper;
      equips.src = mockEquip({ uid: 'src', slot: 'weapon', rarity: 4, enhanceLevel: 10 });
      equips.tgt = mockEquip({ uid: 'tgt', slot: 'weapon', rarity: 4, enhanceLevel: 3 });

      const result = heritage.executeEquipmentHeritage({
        sourceUid: 'src', targetUid: 'tgt', options: { transferEnhanceLevel: true },
      });

      expect(result.success).toBe(true);
      expect(result.copperCost).toBe(10 * EQUIPMENT_HERITAGE_RULE.copperCostFactor);
      expect(resources.copper).toBe(beforeCopper - result.copperCost);
    });

    it('自我传承被拒绝', () => {
      const { heritage, equips } = createIntegrationEnv();
      equips.e1 = mockEquip({ uid: 'e1', slot: 'weapon', rarity: 4, enhanceLevel: 10 });

      const result = heritage.executeEquipmentHeritage({
        sourceUid: 'e1', targetUid: 'e1', options: { transferEnhanceLevel: true },
      });

      expect(result.success).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // §10.1.3 武将传承 + 羁绊联动
  // ═══════════════════════════════════════════════════════════════════

  describe('§10.1.3 武将传承 + 羁绊联动', () => {
    it('同阵营武将传承获得额外10%效率加成', () => {
      const { heritage, heroes } = createIntegrationEnv();
      heroes.src = mockHero({ id: 'src', faction: 'shu', quality: 4, exp: 10000 });
      heroes.tgt = mockHero({ id: 'tgt', faction: 'shu', quality: 4, exp: 0 });

      const result = heritage.executeHeroHeritage({
        sourceHeroId: 'src', targetHeroId: 'tgt', options: { expEfficiency: 1.0 },
      });

      expect(result.success).toBe(true);
      // 同阵营 +10% 加成应体现在效率中
      expect(result.efficiency).toBeGreaterThan(0.65);
    });

    it('不同阵营武将传承效率降低', () => {
      const { heritage, heroes } = createIntegrationEnv();
      heroes.src = mockHero({ id: 'src', faction: 'shu', quality: 4, exp: 10000 });
      heroes.tgt = mockHero({ id: 'tgt', faction: 'wei', quality: 4, exp: 0 });

      const result = heritage.executeHeroHeritage({
        sourceHeroId: 'src', targetHeroId: 'tgt', options: { expEfficiency: 1.0 },
      });

      expect(result.success).toBe(true);
      expect(result.efficiency).toBeLessThan(0.65);
    });

    it('武将传承后源武将等级重置为1', () => {
      const { heritage, heroes } = createIntegrationEnv();
      heroes.src = mockHero({ id: 'src', quality: 4, level: 50, exp: 50000 });
      heroes.tgt = mockHero({ id: 'tgt', quality: 4, exp: 0 });

      heritage.executeHeroHeritage({
        sourceHeroId: 'src', targetHeroId: 'tgt', options: { expEfficiency: 1.0 },
      });

      expect(heroes.src.level).toBe(1);
      expect(heroes.src.exp).toBe(0);
    });

    it('武将传承可选转移技能等级', () => {
      const { heritage, heroes } = createIntegrationEnv();
      heroes.src = mockHero({ id: 'src', quality: 4, skillLevels: [8, 6, 4] });
      heroes.tgt = mockHero({ id: 'tgt', quality: 4, skillLevels: [1, 1, 1] });

      heritage.executeHeroHeritage({
        sourceHeroId: 'src', targetHeroId: 'tgt',
        options: { expEfficiency: 1.0, transferSkillLevels: true },
      });

      expect(heroes.tgt.skillLevels).toEqual([8, 6, 4]);
    });

    it('品质不足的源武将传承被拒绝', () => {
      const { heritage, heroes } = createIntegrationEnv();
      heroes.src = mockHero({ id: 'src', quality: 1 });
      heroes.tgt = mockHero({ id: 'tgt', quality: 4 });

      const result = heritage.executeHeroHeritage({
        sourceHeroId: 'src', targetHeroId: 'tgt', options: { expEfficiency: 1.0 },
      });

      expect(result.success).toBe(false);
      expect(result.reason).toContain('品质');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // §10.1.4 经验传承 + 每日限制
  // ═══════════════════════════════════════════════════════════════════

  describe('§10.1.4 经验传承 + 每日限制', () => {
    it('经验传承正确转移部分经验', () => {
      const { heritage, heroes } = createIntegrationEnv();
      heroes.src = mockHero({ id: 'src', level: 30, exp: 10000 });
      heroes.tgt = mockHero({ id: 'tgt', exp: 0 });

      const result = heritage.executeExperienceHeritage({
        sourceHeroId: 'src', targetHeroId: 'tgt', expRatio: 0.5,
      });

      expect(result.success).toBe(true);
      expect(heroes.tgt.exp).toBeGreaterThan(0);
      expect(heroes.src.exp).toBeLessThan(10000);
    });

    it('经验传承效率为70%', () => {
      const { heritage, heroes } = createIntegrationEnv();
      heroes.src = mockHero({ id: 'src', level: 30, exp: 10000 });
      heroes.tgt = mockHero({ id: 'tgt', exp: 0 });

      const result = heritage.executeExperienceHeritage({
        sourceHeroId: 'src', targetHeroId: 'tgt', expRatio: 1.0,
      });

      expect(result.efficiency).toBe(EXPERIENCE_HERITAGE_RULE.efficiency);
    });

    it('源武将等级不足10级时经验传承被拒绝', () => {
      const { heritage, heroes } = createIntegrationEnv();
      heroes.src = mockHero({ id: 'src', level: 5, exp: 1000 });
      heroes.tgt = mockHero({ id: 'tgt', exp: 0 });

      const result = heritage.executeExperienceHeritage({
        sourceHeroId: 'src', targetHeroId: 'tgt', expRatio: 0.5,
      });

      expect(result.success).toBe(false);
      expect(result.reason).toContain('等级不足');
    });

    it('每日传承次数达上限后拒绝', () => {
      const env = createIntegrationEnv();
      const { heritage, heroes } = env;

      for (let i = 0; i < DAILY_HERITAGE_LIMIT; i++) {
        heroes[`src${i}`] = mockHero({ id: `src${i}`, quality: 4, exp: 5000 });
        heroes[`tgt${i}`] = mockHero({ id: `tgt${i}`, quality: 4, exp: 0 });
        heritage.executeExperienceHeritage({
          sourceHeroId: `src${i}`, targetHeroId: `tgt${i}`, expRatio: 0.5,
        });
      }

      heroes.srcLast = mockHero({ id: 'srcLast', quality: 4, exp: 5000 });
      heroes.tgtLast = mockHero({ id: 'tgtLast', quality: 4, exp: 0 });
      const result = heritage.executeExperienceHeritage({
        sourceHeroId: 'srcLast', targetHeroId: 'tgtLast', expRatio: 0.5,
      });

      expect(result.success).toBe(false);
      expect(result.reason).toContain('上限');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // §10.1.5 羁绊→装备→传承 全链路
  // ═══════════════════════════════════════════════════════════════════

  describe('§10.1.5 羁绊→装备→传承 全链路', () => {
    it('完整流程：羁绊编队→装备传承→武将传承→验证状态', () => {
      const env = createIntegrationEnv();

      // Step 1: 编队羁绊
      const formationHeroes = [
        makeGeneralData(mockHero({ id: 'liubei', faction: 'shu' })),
        makeGeneralData(mockHero({ id: 'guanyu', faction: 'shu' })),
        makeGeneralData(mockHero({ id: 'zhangfei', faction: 'shu' })),
      ];
      const bonds = env.bond.detectActiveBonds(formationHeroes);
      expect(bonds.length).toBeGreaterThan(0);

      // Step 2: 装备传承
      env.equips.oldWeapon = mockEquip({ uid: 'oldWeapon', slot: 'weapon', rarity: 4, enhanceLevel: 15 });
      env.equips.newWeapon = mockEquip({ uid: 'newWeapon', slot: 'weapon', rarity: 5, enhanceLevel: 0 });
      const equipResult = env.heritage.executeEquipmentHeritage({
        sourceUid: 'oldWeapon', targetUid: 'newWeapon', options: { transferEnhanceLevel: true },
      });
      expect(equipResult.success).toBe(true);
      expect(env.equips.newWeapon.enhanceLevel).toBeGreaterThan(0);

      // Step 3: 武将传承
      env.heroes.veteran = mockHero({ id: 'veteran', faction: 'shu', quality: 5, exp: 80000, skillLevels: [10, 8, 6] });
      env.heroes.rookie = mockHero({ id: 'rookie', faction: 'shu', quality: 4, exp: 100, skillLevels: [1, 1, 1] });
      const heroResult = env.heritage.executeHeroHeritage({
        sourceHeroId: 'veteran', targetHeroId: 'rookie',
        options: { expEfficiency: 1.0, transferSkillLevels: true, transferFavorability: true },
      });
      expect(heroResult.success).toBe(true);
      expect(env.heroes.rookie.exp).toBeGreaterThan(100);
      expect(env.heroes.rookie.skillLevels).toEqual([10, 8, 6]);

      // Step 4: 验证传承记录
      const state = env.heritage.getState();
      expect(state.heritageHistory).toHaveLength(2);
      expect(state.equipmentHeritageCount).toBe(1);
      expect(state.heroHeritageCount).toBe(1);
    });

    it('传承事件正确触发 heritage:completed', () => {
      const { heritage, heroes, eventBus } = createIntegrationEnv();
      heroes.src = mockHero({ id: 'src', quality: 4, exp: 10000 });
      heroes.tgt = mockHero({ id: 'tgt', quality: 4, exp: 0 });

      heritage.executeHeroHeritage({
        sourceHeroId: 'src', targetHeroId: 'tgt', options: { expEfficiency: 1.0 },
      });

      expect(eventBus.emit).toHaveBeenCalledWith(
        'heritage:completed',
        expect.objectContaining({ type: 'hero', sourceId: 'src', targetId: 'tgt' }),
      );
    });

    it('存档/读档保持传承状态一致', () => {
      const env = createIntegrationEnv();
      env.heroes.src = mockHero({ id: 'src', quality: 4, exp: 10000 });
      env.heroes.tgt = mockHero({ id: 'tgt', quality: 4, exp: 0 });

      env.heritage.executeHeroHeritage({
        sourceHeroId: 'src', targetHeroId: 'tgt', options: { expEfficiency: 1.0 },
      });

      const save = env.heritage.getSaveData();
      expect(save.state.heroHeritageCount).toBe(1);

      // 新系统加载存档
      const env2 = createIntegrationEnv();
      env2.heritage.loadSaveData(save);
      expect(env2.heritage.getState().heroHeritageCount).toBe(1);
    });
  });
});
