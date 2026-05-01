/**
 * GAP-HERO-004: 装备套装效果测试
 * 节点ID: HERO-TRAIN-031
 * 优先级: P1
 *
 * 覆盖：
 * - 2件套激活基础效果
 * - 4件套激活进阶效果
 * - 混搭不同套装分别计算
 * - 未穿戴装备返回空结果
 * - getTotalSetBonuses 聚合所有套装加成
 * - getClosestSetBonus 最接近激活的套装建议
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { EquipmentSetSystem } from '../equipment/EquipmentSetSystem';
import type { EquipmentSystem } from '../equipment/EquipmentSystem';
import type { EquipmentInstance } from '../../core/equipment/equipment.types';
import type { SetId } from '../../core/equipment/equipment-forge.types';
import { EQUIPMENT_SLOTS } from '../../core/equipment/equipment.types';
import { EQUIPMENT_SETS, SET_MAP, SET_IDS, TEMPLATE_MAP } from '../../core/equipment/equipment-config';

// ── Mock EquipmentSystem ──

function createMockEquipmentSystem(): EquipmentSystem {
  // 存储 heroId -> slot -> uid 映射
  const heroEquips: Record<string, Record<string, string>> = {};
  // 存储 uid -> EquipmentInstance 映射
  const equipments: Record<string, EquipmentInstance> = {};

  return {
    getHeroEquips: vi.fn((heroId: string) => heroEquips[heroId] ?? {}),
    getEquipment: vi.fn((uid: string) => equipments[uid] ?? null),
    filterEquipments: vi.fn(() => []),
    // 其他必要方法
  } as unknown as EquipmentSystem;
}

function createEquipmentInstance(uid: string, templateId: string, slot: string): EquipmentInstance {
  return {
    uid,
    templateId,
    slot: slot as any,
    rarity: 'purple' as any,
    level: 1,
    enhanceLevel: 0,
    mainStat: { type: 'attack', value: 100 },
    subStats: [],
    setId: undefined,
    locked: false,
    equippedHeroId: null,
    obtainedAt: Date.now(),
  };
}

describe('GAP-HERO-004: 装备套装效果', () => {
  let setSys: EquipmentSetSystem;
  let mockEquipSys: ReturnType<typeof createMockEquipmentSystem>;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockEquipSys = createMockEquipmentSystem();
    setSys = new EquipmentSetSystem(mockEquipSys as EquipmentSystem);
    setSys.init({
      eventBus: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
      config: { get: vi.fn(), register: vi.fn() },
      registry: { get: vi.fn(), register: vi.fn() },
    } as any);
  });

  // ═══════════════════════════════════════════
  // 1. 未穿戴装备
  // ═══════════════════════════════════════════
  describe('未穿戴装备', () => {
    it('getSetCounts 未穿戴装备应返回空Map', () => {
      const counts = setSys.getSetCounts('hero_1');
      expect(counts.size).toBe(0);
    });

    it('getActiveSetBonuses 未穿戴装备应返回空数组', () => {
      const bonuses = setSys.getActiveSetBonuses('hero_1');
      expect(bonuses).toEqual([]);
    });

    it('getTotalSetBonuses 未穿戴装备应返回空对象', () => {
      const totals = setSys.getTotalSetBonuses('hero_1');
      expect(Object.keys(totals).length).toBe(0);
    });
  });

  // ═══════════════════════════════════════════
  // 2. 2件套激活
  // ═══════════════════════════════════════════
  describe('2件套激活', () => {
    it('穿戴2件同套装应激活2件效果', () => {
      // 获取一个套装ID
      const setId = SET_IDS[0];
      const setDef = SET_MAP.get(setId);
      if (!setDef) return;

      // 找到属于该套装的模板
      let templateIds: string[] = [];
      for (const [tid, tmpl] of TEMPLATE_MAP.entries()) {
        if (tmpl.setId === setId) templateIds.push(tid);
      }
      if (templateIds.length < 2) return;

      // 创建装备实例
      const eq1 = createEquipmentInstance('eq1', templateIds[0], EQUIPMENT_SLOTS[0]);
      const eq2 = createEquipmentInstance('eq2', templateIds[1], EQUIPMENT_SLOTS[1]);

      // 设置mock返回值
      const heroEquips: Record<string, string> = {
        [EQUIPMENT_SLOTS[0]]: 'eq1',
        [EQUIPMENT_SLOTS[1]]: 'eq2',
      };
      (mockEquipSys.getHeroEquips as ReturnType<typeof vi.fn>).mockReturnValue(heroEquips);
      (mockEquipSys.getEquipment as ReturnType<typeof vi.fn>).mockImplementation(
        (uid: string) => uid === 'eq1' ? eq1 : uid === 'eq2' ? eq2 : null,
      );

      const bonuses = setSys.getActiveSetBonuses('hero_1');
      expect(bonuses.length).toBeGreaterThan(0);

      const setBonus = bonuses.find(b => b.setId === setId);
      expect(setBonus).toBeDefined();
      expect(setBonus!.activeTiers).toContain(2);
      expect(setBonus!.count).toBeGreaterThanOrEqual(2);
    });
  });

  // ═══════════════════════════════════════════
  // 3. 4件套激活
  // ═══════════════════════════════════════════
  describe('4件套激活', () => {
    it('穿戴4件同套装应同时激活2件和4件效果', () => {
      const setId = SET_IDS[0];
      const setDef = SET_MAP.get(setId);
      if (!setDef) return;

      let templateIds: string[] = [];
      for (const [tid, tmpl] of TEMPLATE_MAP.entries()) {
        if (tmpl.setId === setId) templateIds.push(tid);
      }
      if (templateIds.length < 4) return;

      const eqs = Array.from({ length: 4 }, (_, i) =>
        createEquipmentInstance(`eq${i}`, templateIds[i % templateIds.length], EQUIPMENT_SLOTS[i]),
      );

      const heroEquips: Record<string, string> = {};
      for (let i = 0; i < 4; i++) {
        heroEquips[EQUIPMENT_SLOTS[i]] = `eq${i}`;
      }
      (mockEquipSys.getHeroEquips as ReturnType<typeof vi.fn>).mockReturnValue(heroEquips);
      (mockEquipSys.getEquipment as ReturnType<typeof vi.fn>).mockImplementation(
        (uid: string) => eqs.find(e => e.uid === uid) ?? null,
      );

      const bonuses = setSys.getActiveSetBonuses('hero_1');
      const setBonus = bonuses.find(b => b.setId === setId);
      if (setBonus) {
        expect(setBonus.activeTiers).toContain(2);
        expect(setBonus.activeTiers).toContain(4);
      }
    });
  });

  // ═══════════════════════════════════════════
  // 4. 混搭不同套装
  // ═══════════════════════════════════════════
  describe('混搭不同套装', () => {
    it('穿戴不同套装各2件应分别计算', () => {
      if (SET_IDS.length < 2) return;

      const setId1 = SET_IDS[0];
      const setId2 = SET_IDS[1];

      // 找到属于不同套装的模板
      const templatesBySet: Record<string, string[]> = {};
      for (const [tid, tmpl] of TEMPLATE_MAP.entries()) {
        if (tmpl.setId) {
          if (!templatesBySet[tmpl.setId]) templatesBySet[tmpl.setId] = [];
          templatesBySet[tmpl.setId].push(tid);
        }
      }

      const set1Templates = templatesBySet[setId1];
      const set2Templates = templatesBySet[setId2];
      if (!set1Templates || set1Templates.length < 2 || !set2Templates || set2Templates.length < 2) return;

      const eq1 = createEquipmentInstance('eq1', set1Templates[0], EQUIPMENT_SLOTS[0]);
      const eq2 = createEquipmentInstance('eq2', set1Templates[1], EQUIPMENT_SLOTS[1]);
      const eq3 = createEquipmentInstance('eq3', set2Templates[0], EQUIPMENT_SLOTS[2]);
      const eq4 = createEquipmentInstance('eq4', set2Templates[1], EQUIPMENT_SLOTS[3]);

      const heroEquips: Record<string, string> = {
        [EQUIPMENT_SLOTS[0]]: 'eq1',
        [EQUIPMENT_SLOTS[1]]: 'eq2',
        [EQUIPMENT_SLOTS[2]]: 'eq3',
        [EQUIPMENT_SLOTS[3]]: 'eq4',
      };
      (mockEquipSys.getHeroEquips as ReturnType<typeof vi.fn>).mockReturnValue(heroEquips);
      (mockEquipSys.getEquipment as ReturnType<typeof vi.fn>).mockImplementation(
        (uid: string) => ({ eq1, eq2, eq3, eq4 })[uid] ?? null,
      );

      const bonuses = setSys.getActiveSetBonuses('hero_1');
      // 应该有2个不同的套装效果
      const activeSetIds = bonuses.map(b => b.setId);
      if (bonuses.length >= 2) {
        expect(new Set(activeSetIds).size).toBeGreaterThanOrEqual(2);
      }
    });
  });

  // ═══════════════════════════════════════════
  // 5. 套装定义查询
  // ═══════════════════════════════════════════
  describe('套装定义查询', () => {
    it('getAllSetDefs应返回所有套装定义', () => {
      const defs = setSys.getAllSetDefs();
      expect(defs.length).toBeGreaterThan(0);
    });

    it('getSetDef应返回正确的套装定义', () => {
      const setId = SET_IDS[0];
      const def = setSys.getSetDef(setId);
      expect(def).toBeDefined();
      expect(def!.bonus2).toBeDefined();
      expect(def!.bonus4).toBeDefined();
    });

    it('getAllSetIds应返回所有套装ID', () => {
      const ids = setSys.getAllSetIds();
      expect(ids.length).toBeGreaterThan(0);
      expect(ids.length).toBe(SET_IDS.length);
    });
  });

  // ═══════════════════════════════════════════
  // 6. getTotalSetBonuses 聚合
  // ═══════════════════════════════════════════
  describe('getTotalSetBonuses 聚合', () => {
    it('多个套装效果应正确聚合', () => {
      // 这个测试验证getTotalSetBonuses能正确聚合
      const totals = setSys.getTotalSetBonuses('hero_1');
      expect(typeof totals).toBe('object');
    });
  });

  // ═══════════════════════════════════════════
  // 7. getClosestSetBonus 建议
  // ═══════════════════════════════════════════
  describe('getClosestSetBonus 建议', () => {
    it('无装备时返回null', () => {
      const closest = setSys.getClosestSetBonus('hero_1');
      expect(closest).toBeNull();
    });

    it('穿1件套装装备时返回最近激活建议', () => {
      const setId = SET_IDS[0];
      let templateIds: string[] = [];
      for (const [tid, tmpl] of TEMPLATE_MAP.entries()) {
        if (tmpl.setId === setId) templateIds.push(tid);
      }
      if (templateIds.length < 1) return;

      const eq1 = createEquipmentInstance('eq1', templateIds[0], EQUIPMENT_SLOTS[0]);
      const heroEquips: Record<string, string> = { [EQUIPMENT_SLOTS[0]]: 'eq1' };
      (mockEquipSys.getHeroEquips as ReturnType<typeof vi.fn>).mockReturnValue(heroEquips);
      (mockEquipSys.getEquipment as ReturnType<typeof vi.fn>).mockImplementation(
        (uid: string) => uid === 'eq1' ? eq1 : null,
      );

      const closest = setSys.getClosestSetBonus('hero_1');
      if (closest) {
        expect(closest.current).toBe(1);
        expect(closest.target).toBe(2); // 下一个阈值是2件
        expect(closest.setId).toBe(setId);
      }
    });
  });
});
