/**
 * core/map/territory-config 单元测试
 *
 * 测试领土产出计算、升级消耗、相邻关系、领土数据生成。
 */

import {
  getBaseProduction,
  calculateProduction,
  calculateUpgradeCost,
  getAdjacentIds,
  areAdjacent,
  generateTerritoryData,
  TERRITORY_SAVE_VERSION,
} from '../territory-config';
import type { LandmarkLevel } from '../world-map.types';
import { DEFAULT_LANDMARKS } from '../map-config';

// ═══════════════════════════════════════════════════════════

describe('territory-config', () => {
  // ═══════════════════════════════════════════
  // 1. 基础产出
  // ═══════════════════════════════════════════
  describe('getBaseProduction', () => {
    it('城池有产出', () => {
      const prod = getBaseProduction('city');
      expect(prod.grain).toBeGreaterThan(0);
      expect(prod.gold).toBeGreaterThan(0);
      expect(prod.troops).toBeGreaterThan(0);
      expect(prod.mandate).toBeGreaterThanOrEqual(0);
    });

    it('关卡有防御产出', () => {
      const prod = getBaseProduction('pass');
      expect(prod.troops).toBeGreaterThan(0);
    });

    it('粮食资源点主要产粮食', () => {
      const prod = getBaseProduction('resource', 'grain');
      expect(prod.grain).toBeGreaterThan(prod.gold);
      expect(prod.grain).toBeGreaterThan(prod.troops);
    });

    it('金币资源点主要产金币', () => {
      const prod = getBaseProduction('resource', 'gold');
      expect(prod.gold).toBeGreaterThan(prod.grain);
    });

    it('兵力资源点主要产兵力', () => {
      const prod = getBaseProduction('resource', 'troops');
      expect(prod.troops).toBeGreaterThan(prod.grain);
    });

    it('天命资源点主要产天命', () => {
      const prod = getBaseProduction('resource', 'mandate');
      expect(prod.mandate).toBeGreaterThan(prod.grain);
    });

    it('未知类型返回城池默认产出', () => {
      const prod = getBaseProduction('unknown');
      const cityProd = getBaseProduction('city');
      expect(prod).toEqual(cityProd);
    });
  });

  // ═══════════════════════════════════════════
  // 2. 等级加成产出
  // ═══════════════════════════════════════════
  describe('calculateProduction', () => {
    it('等级1无加成（×1.0）', () => {
      const base = { grain: 10, gold: 5, troops: 3, mandate: 1 };
      const result = calculateProduction(base, 1);
      expect(result.grain).toBe(10);
      expect(result.gold).toBe(5);
    });

    it('等级2有加成（×1.3）', () => {
      const base = { grain: 10, gold: 5, troops: 3, mandate: 1 };
      const result = calculateProduction(base, 2);
      expect(result.grain).toBe(13);
      expect(result.gold).toBe(6.5);
    });

    it('等级5加成最高（×2.5）', () => {
      const base = { grain: 10, gold: 5, troops: 3, mandate: 1 };
      const result = calculateProduction(base, 5);
      expect(result.grain).toBe(25);
      expect(result.gold).toBe(12.5);
    });

    it('高等级产出 > 低等级', () => {
      const base = { grain: 10, gold: 5, troops: 3, mandate: 1 };
      const prod1 = calculateProduction(base, 1);
      const prod3 = calculateProduction(base, 3);
      const prod5 = calculateProduction(base, 5);
      expect(prod3.grain).toBeGreaterThan(prod1.grain);
      expect(prod5.grain).toBeGreaterThan(prod3.grain);
    });

    it('产出保留两位小数', () => {
      const base = { grain: 7, gold: 3, troops: 2, mandate: 1 };
      const result = calculateProduction(base, 3);
      // 7 × 1.6 = 11.2
      expect(result.grain).toBe(11.2);
    });
  });

  // ═══════════════════════════════════════════
  // 3. 升级消耗
  // ═══════════════════════════════════════════
  describe('calculateUpgradeCost', () => {
    it('等级1可升级', () => {
      const cost = calculateUpgradeCost(1);
      expect(cost).not.toBeNull();
      expect(cost!.grain).toBeGreaterThan(0);
      expect(cost!.gold).toBeGreaterThan(0);
    });

    it('等级4可升级到5', () => {
      const cost = calculateUpgradeCost(4);
      expect(cost).not.toBeNull();
    });

    it('等级5不可升级', () => {
      const cost = calculateUpgradeCost(5);
      expect(cost).toBeNull();
    });

    it('高等级消耗 > 低等级', () => {
      const cost1 = calculateUpgradeCost(1)!;
      const cost3 = calculateUpgradeCost(3)!;
      expect(cost3.grain).toBeGreaterThan(cost1.grain);
      expect(cost3.gold).toBeGreaterThan(cost1.gold);
    });

    it('消耗公式：base × level²', () => {
      // level 1 → next level 2: cost = base × 4
      const cost1 = calculateUpgradeCost(1)!;
      expect(cost1.grain).toBe(100 * 4); // 400
      expect(cost1.gold).toBe(50 * 4);   // 200
    });
  });

  // ═══════════════════════════════════════════
  // 4. 相邻关系
  // ═══════════════════════════════════════════
  describe('相邻关系', () => {
    it('洛阳有相邻领土', () => {
      const adj = getAdjacentIds('city-luoyang');
      expect(adj.length).toBeGreaterThan(0);
    });

    it('洛阳与许昌相邻', () => {
      expect(areAdjacent('city-luoyang', 'city-xuchang')).toBe(true);
    });

    it('许昌与洛阳相邻（双向）', () => {
      expect(areAdjacent('city-xuchang', 'city-luoyang')).toBe(true);
    });

    it('洛阳与建业不相邻', () => {
      expect(areAdjacent('city-luoyang', 'city-jianye')).toBe(false);
    });

    it('不存在的ID返回空数组', () => {
      expect(getAdjacentIds('non-existent')).toEqual([]);
    });

    it('不相邻的两个ID', () => {
      expect(areAdjacent('city-ye', 'city-jianye')).toBe(false);
    });

    it('每个领土至少有一个相邻', () => {
      const data = generateTerritoryData();
      for (const t of data) {
        expect(t.adjacentIds.length).toBeGreaterThan(0);
      }
    });

    it('相邻关系是对称的', () => {
      const data = generateTerritoryData();
      for (const t of data) {
        for (const adjId of t.adjacentIds) {
          expect(areAdjacent(adjId, t.id)).toBe(true);
        }
      }
    });
  });

  // ═══════════════════════════════════════════
  // 5. 领土数据生成
  // ═══════════════════════════════════════════
  describe('generateTerritoryData', () => {
    it('生成与地标数量一致的领土', () => {
      const data = generateTerritoryData();
      expect(data.length).toBe(DEFAULT_LANDMARKS.length);
    });

    it('每个领土数据完整', () => {
      const data = generateTerritoryData();
      for (const t of data) {
        expect(t.id).toBeTruthy();
        expect(t.name).toBeTruthy();
        expect(t.position).toBeDefined();
        expect(t.position.x).toBeGreaterThanOrEqual(0);
        expect(t.position.y).toBeGreaterThanOrEqual(0);
        expect(['central_plains', 'jiangnan', 'western_shu']).toContain(t.region);
        expect(['player', 'enemy', 'neutral']).toContain(t.ownership);
        expect([1, 2, 3, 4, 5]).toContain(t.level);
        expect(t.baseProduction).toBeDefined();
        expect(t.currentProduction).toBeDefined();
        expect(t.defenseValue).toBeGreaterThanOrEqual(0);
        expect(t.adjacentIds).toBeInstanceOf(Array);
      }
    });

    it('初始所有领土为 neutral', () => {
      const data = generateTerritoryData();
      for (const t of data) {
        expect(t.ownership).toBe('neutral');
      }
    });

    it('产出与等级对应', () => {
      const data = generateTerritoryData();
      for (const t of data) {
        // 等级1产出 = 基础产出
        if (t.level === 1) {
          expect(t.currentProduction.grain).toBe(t.baseProduction.grain);
        }
        // 等级>1产出 > 基础产出
        if (t.level > 1) {
          expect(t.currentProduction.grain).toBeGreaterThanOrEqual(t.baseProduction.grain);
        }
      }
    });

    it('多次调用结果一致', () => {
      const d1 = generateTerritoryData();
      const d2 = generateTerritoryData();
      expect(d1.length).toBe(d2.length);
      for (let i = 0; i < d1.length; i++) {
        expect(d1[i].id).toBe(d2[i].id);
        expect(d1[i].ownership).toBe(d2[i].ownership);
      }
    });
  });

  // ═══════════════════════════════════════════
  // 6. 存档版本
  // ═══════════════════════════════════════════
  describe('存档版本', () => {
    it('TERRITORY_SAVE_VERSION 为正整数', () => {
      expect(TERRITORY_SAVE_VERSION).toBeGreaterThan(0);
    });
  });
});
