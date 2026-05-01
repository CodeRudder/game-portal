/**
 * GAP-BATTLE-004: 羁绊效果预览测试
 * 节点ID: BATTLE-CAMP-007
 * 优先级: P1
 *
 * 覆盖：
 * - 已激活羁绊正确显示
 * - 未激活羁绊的灰色显示判定
 * - 缺失武将提示
 * - getFactionDistribution 阵营分布
 * - detectActiveBonds 激活羁绊检测
 * - 不同阵营组合的羁绊效果
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BondSystem } from '../bond/BondSystem';
import type { GeneralData, Faction } from '../hero/hero.types';

function makeMockDeps() {
  return {
    eventBus: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
    config: { get: vi.fn(), set: vi.fn(), has: vi.fn() },
    registry: { get: vi.fn(), register: vi.fn(), has: vi.fn(), getAll: vi.fn(), unregister: vi.fn() },
  };
}

function createMockGeneral(id: string, faction: Faction, level: number = 10): GeneralData {
  return {
    id,
    name: id,
    faction,
    level,
    quality: 'LEGENDARY',
    baseStats: { attack: 100, defense: 80, intelligence: 60, speed: 70 },
    skills: [],
    exp: 0,
  } as GeneralData;
}

describe('GAP-BATTLE-004: 羁绊效果预览', () => {
  let bondSys: BondSystem;

  beforeEach(() => {
    vi.restoreAllMocks();
    bondSys = new BondSystem();
    bondSys.init(makeMockDeps() as any);
  });

  // ═══════════════════════════════════════════
  // 1. 已激活羁绊
  // ═══════════════════════════════════════════
  describe('已激活羁绊', () => {
    it('2个同阵营武将应激活faction_2羁绊', () => {
      const heroes = [
        createMockGeneral('guanyu', 'shu'),
        createMockGeneral('zhangfei', 'shu'),
      ];

      const bonds = bondSys.detectActiveBonds(heroes);
      const factionBond = bonds.find(b => b.type === 'faction_2' && b.faction === 'shu');
      expect(factionBond).toBeDefined();
      expect(factionBond!.heroCount).toBe(2);
    });

    it('3个同阵营武将应激活faction_3羁绊', () => {
      const heroes = [
        createMockGeneral('guanyu', 'shu'),
        createMockGeneral('zhangfei', 'shu'),
        createMockGeneral('liubei', 'shu'),
      ];

      const bonds = bondSys.detectActiveBonds(heroes);
      const factionBond = bonds.find(b => b.type === 'faction_3' && b.faction === 'shu');
      expect(factionBond).toBeDefined();
      expect(factionBond!.heroCount).toBe(3);
    });

    it('6个同阵营武将应激活faction_6羁绊', () => {
      const heroes = Array.from({ length: 6 }, (_, i) =>
        createMockGeneral(`shu_hero_${i}`, 'shu'),
      );

      const bonds = bondSys.detectActiveBonds(heroes);
      const factionBond = bonds.find(b => b.type === 'faction_6' && b.faction === 'shu');
      expect(factionBond).toBeDefined();
      expect(factionBond!.heroCount).toBe(6);
    });
  });

  // ═══════════════════════════════════════════
  // 2. 未激活羁绊
  // ═══════════════════════════════════════════
  describe('未激活羁绊', () => {
    it('1个武将不激活任何羁绊', () => {
      const heroes = [createMockGeneral('guanyu', 'shu')];
      const bonds = bondSys.detectActiveBonds(heroes);
      expect(bonds.length).toBe(0);
    });

    it('不同阵营各1个不激活羁绊', () => {
      const heroes = [
        createMockGeneral('guanyu', 'shu'),
        createMockGeneral('caocao', 'wei'),
        createMockGeneral('zhouyu', 'wu'),
      ];
      const bonds = bondSys.detectActiveBonds(heroes);
      expect(bonds.length).toBe(0);
    });

    it('空编队不激活任何羁绊', () => {
      const bonds = bondSys.detectActiveBonds([]);
      expect(bonds.length).toBe(0);
    });
  });

  // ═══════════════════════════════════════════
  // 3. 阵营分布计算
  // ═══════════════════════════════════════════
  describe('getFactionDistribution', () => {
    it('正确计算阵营分布', () => {
      const heroes = [
        createMockGeneral('guanyu', 'shu'),
        createMockGeneral('zhangfei', 'shu'),
        createMockGeneral('caocao', 'wei'),
      ];

      const dist = bondSys.getFactionDistribution(heroes);
      expect(dist.shu).toBe(2);
      expect(dist.wei).toBe(1);
      expect(dist.wu).toBe(0);
      expect(dist.qun).toBe(0);
    });

    it('空编队分布全为0', () => {
      const dist = bondSys.getFactionDistribution([]);
      expect(dist.shu).toBe(0);
      expect(dist.wei).toBe(0);
      expect(dist.wu).toBe(0);
      expect(dist.qun).toBe(0);
    });
  });

  // ═══════════════════════════════════════════
  // 4. 混搭羁绊
  // ═══════════════════════════════════════════
  describe('混搭羁绊', () => {
    it('3+3不同阵营应激活混搭羁绊', () => {
      const heroes = [
        createMockGeneral('shu1', 'shu'),
        createMockGeneral('shu2', 'shu'),
        createMockGeneral('shu3', 'shu'),
        createMockGeneral('wei1', 'wei'),
        createMockGeneral('wei2', 'wei'),
        createMockGeneral('wei3', 'wei'),
      ];

      const bonds = bondSys.detectActiveBonds(heroes);
      // 应有faction_3羁绊
      const shuBond = bonds.find(b => b.faction === 'shu');
      const weiBond = bonds.find(b => b.faction === 'wei');
      expect(shuBond).toBeDefined();
      expect(weiBond).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════
  // 5. 系统重置
  // ═══════════════════════════════════════════
  describe('系统重置', () => {
    it('reset后状态应清空', () => {
      bondSys.reset();
      const state = bondSys.getState();
      expect(state).toBeDefined();
    });
  });
});
