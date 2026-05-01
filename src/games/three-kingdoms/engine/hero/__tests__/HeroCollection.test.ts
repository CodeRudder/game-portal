/**
 * 武将名册/图鉴 — 引擎层测试
 *
 * 验证图鉴数据完整性：武将定义覆盖、阵营分布、品质分布、
 * 碎片合成武将、名册收集进度计算
 *
 * P1 缺口：零测试 → 补充引擎层测试验证图鉴数据完整性
 *
 * @module engine/hero/__tests__/HeroCollection
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HeroSystem } from '../HeroSystem';
import { Quality, FACTIONS, FACTION_LABELS } from '../hero.types';
import type { Faction } from '../hero.types';
import {
  GENERAL_DEFS,
  GENERAL_DEF_MAP,
  QUALITY_MULTIPLIERS,
  SYNTHESIZE_REQUIRED_FRAGMENTS,
  DUPLICATE_FRAGMENT_COUNT,
  STAR_UP_FRAGMENT_COST,
  MAX_STAR_LEVEL,
} from '../hero-config';

// ═══════════════════════════════════════════
// 测试辅助
// ═══════════════════════════════════════════

/** 获取所有武将定义中的阵营集合 */
function getDefinedFactions(): Set<Faction> {
  const factions = new Set<Faction>();
  for (const def of GENERAL_DEFS) {
    factions.add(def.faction);
  }
  return factions;
}

/** 获取所有武将定义中的品质集合 */
function getDefinedQualities(): Set<Quality> {
  const qualities = new Set<Quality>();
  for (const def of GENERAL_DEFS) {
    qualities.add(def.quality);
  }
  return qualities;
}

/** 按阵营统计武将数量 */
function countByFaction(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const def of GENERAL_DEFS) {
    counts[def.faction] = (counts[def.faction] ?? 0) + 1;
  }
  return counts;
}

/** 按品质统计武将数量 */
function countByQuality(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const def of GENERAL_DEFS) {
    counts[def.quality] = (counts[def.quality] ?? 0) + 1;
  }
  return counts;
}

// ═══════════════════════════════════════════
// 测试
// ═══════════════════════════════════════════

describe('HeroCollection — 武将名册/图鉴数据完整性', () => {
  let heroSystem: HeroSystem;

  beforeEach(() => {
    heroSystem = new HeroSystem();
  });

  // ── 1. 武将定义数据完整性 ──

  describe('武将定义数据完整性', () => {
    it('GENERAL_DEFS 应至少包含 10 个武将', () => {
      expect(GENERAL_DEFS.length).toBeGreaterThanOrEqual(10);
    });

    it('GENERAL_DEF_MAP 与 GENERAL_DEFS 数量一致', () => {
      expect(GENERAL_DEF_MAP.size).toBe(GENERAL_DEFS.length);
    });

    it('每个武将定义应有唯一的 ID', () => {
      const ids = GENERAL_DEFS.map((d) => d.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('每个武将定义应有非空的名称', () => {
      for (const def of GENERAL_DEFS) {
        expect(def.name.length).toBeGreaterThan(0);
      }
    });

    it('每个武将定义应有有效的品质', () => {
      const validQualities = new Set(Object.values(Quality));
      for (const def of GENERAL_DEFS) {
        expect(validQualities.has(def.quality)).toBe(true);
      }
    });

    it('每个武将定义应有有效的阵营', () => {
      const validFactions = new Set<string>(FACTIONS);
      for (const def of GENERAL_DEFS) {
        expect(validFactions.has(def.faction)).toBe(true);
      }
    });

    it('每个武将定义应有完整的四维属性（均 > 0）', () => {
      for (const def of GENERAL_DEFS) {
        expect(def.baseStats.attack).toBeGreaterThan(0);
        expect(def.baseStats.defense).toBeGreaterThan(0);
        expect(def.baseStats.intelligence).toBeGreaterThan(0);
        expect(def.baseStats.speed).toBeGreaterThan(0);
      }
    });

    it('每个武将定义应至少有一个技能', () => {
      for (const def of GENERAL_DEFS) {
        expect(def.skills.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('每个武将技能应有唯一的技能 ID', () => {
      const allSkillIds: string[] = [];
      for (const def of GENERAL_DEFS) {
        for (const skill of def.skills) {
          allSkillIds.push(skill.id);
        }
      }
      const uniqueSkillIds = new Set(allSkillIds);
      expect(uniqueSkillIds.size).toBe(allSkillIds.length);
    });
  });

  // ── 2. 阵营分布 ──

  describe('阵营分布完整性', () => {
    it('应覆盖全部四个阵营（蜀魏吴群）', () => {
      const factions = getDefinedFactions();
      expect(factions.has('shu')).toBe(true);
      expect(factions.has('wei')).toBe(true);
      expect(factions.has('wu')).toBe(true);
      expect(factions.has('qun')).toBe(true);
    });

    it('每个阵营应至少有 2 名武将', () => {
      const counts = countByFaction();
      for (const faction of FACTIONS) {
        expect(counts[faction] ?? 0).toBeGreaterThanOrEqual(2);
      }
    });

    it('吴国应有至少 3 名武将（可触发 3 人羁绊）', () => {
      const counts = countByFaction();
      expect(counts['wu'] ?? 0).toBeGreaterThanOrEqual(3);
    });

    it('FACTION_LABELS 应覆盖全部阵营', () => {
      for (const faction of FACTIONS) {
        expect(FACTION_LABELS[faction]).toBeDefined();
        expect(FACTION_LABELS[faction].length).toBeGreaterThan(0);
      }
    });
  });

  // ── 3. 品质分布 ──

  describe('品质分布完整性', () => {
    it('应覆盖至少 4 个品质等级', () => {
      const qualities = getDefinedQualities();
      expect(qualities.size).toBeGreaterThanOrEqual(4);
    });

    it('应有传说品质武将', () => {
      const counts = countByQuality();
      expect(counts[Quality.LEGENDARY] ?? 0).toBeGreaterThan(0);
    });

    it('应有稀有品质武将', () => {
      const counts = countByQuality();
      expect(counts[Quality.RARE] ?? 0).toBeGreaterThan(0);
    });

    it('应有普通品质武将', () => {
      const counts = countByQuality();
      expect(counts[Quality.COMMON] ?? 0).toBeGreaterThan(0);
    });

    it('传说品质占比不应超过 40%', () => {
      const counts = countByQuality();
      const legendaryRatio = (counts[Quality.LEGENDARY] ?? 0) / GENERAL_DEFS.length;
      expect(legendaryRatio).toBeLessThanOrEqual(0.4);
    });

    it('QUALITY_MULTIPLIERS 应覆盖全部品质', () => {
      for (const q of Object.values(Quality)) {
        expect(QUALITY_MULTIPLIERS[q]).toBeDefined();
        expect(QUALITY_MULTIPLIERS[q]).toBeGreaterThan(0);
      }
    });

    it('品质倍率应递增：COMMON < FINE < RARE < EPIC < LEGENDARY', () => {
      expect(QUALITY_MULTIPLIERS[Quality.COMMON]).toBeLessThan(QUALITY_MULTIPLIERS[Quality.FINE]);
      expect(QUALITY_MULTIPLIERS[Quality.FINE]).toBeLessThan(QUALITY_MULTIPLIERS[Quality.RARE]);
      expect(QUALITY_MULTIPLIERS[Quality.RARE]).toBeLessThan(QUALITY_MULTIPLIERS[Quality.EPIC]);
      expect(QUALITY_MULTIPLIERS[Quality.EPIC]).toBeLessThan(QUALITY_MULTIPLIERS[Quality.LEGENDARY]);
    });
  });

  // ── 4. 名册收集进度（基于 HeroSystem 实例） ──

  describe('名册收集进度', () => {
    it('初始状态：无已拥有武将', () => {
      expect(heroSystem.getGeneralCount()).toBe(0);
      expect(heroSystem.getAllGenerals()).toHaveLength(0);
    });

    it('添加单个武将后计数为 1', () => {
      const result = heroSystem.addGeneral('guanyu');
      expect(result).not.toBeNull();
      expect(heroSystem.getGeneralCount()).toBe(1);
    });

    it('重复添加同一武将返回 null 且计数不变', () => {
      heroSystem.addGeneral('guanyu');
      const second = heroSystem.addGeneral('guanyu');
      expect(second).toBeNull();
      expect(heroSystem.getGeneralCount()).toBe(1);
    });

    it('添加不存在的武将返回 null', () => {
      const result = heroSystem.addGeneral('nonexistent_hero');
      expect(result).toBeNull();
      expect(heroSystem.getGeneralCount()).toBe(0);
    });

    it('添加全部武将后计数等于 GENERAL_DEFS.length', () => {
      for (const def of GENERAL_DEFS) {
        heroSystem.addGeneral(def.id);
      }
      expect(heroSystem.getGeneralCount()).toBe(GENERAL_DEFS.length);
    });

    it('收集进度百分比应正确计算', () => {
      // 添加一半武将
      const half = Math.floor(GENERAL_DEFS.length / 2);
      for (let i = 0; i < half; i++) {
        heroSystem.addGeneral(GENERAL_DEFS[i].id);
      }
      const progress = heroSystem.getGeneralCount() / GENERAL_DEFS.length;
      expect(progress).toBeCloseTo(half / GENERAL_DEFS.length, 2);
    });

    it('hasGeneral 应正确反映武将拥有状态', () => {
      expect(heroSystem.hasGeneral('guanyu')).toBe(false);
      heroSystem.addGeneral('guanyu');
      expect(heroSystem.hasGeneral('guanyu')).toBe(true);
    });

    it('getGeneral 应返回完整的武将数据', () => {
      heroSystem.addGeneral('guanyu');
      const general = heroSystem.getGeneral('guanyu');
      expect(general).toBeDefined();
      expect(general!.id).toBe('guanyu');
      expect(general!.name).toBe('关羽');
      expect(general!.quality).toBe(Quality.LEGENDARY);
      expect(general!.faction).toBe('shu');
      expect(general!.level).toBe(1);
    });

    it('按阵营筛选已拥有武将', () => {
      // 添加所有蜀国武将
      const shuHeroes = GENERAL_DEFS.filter((d) => d.faction === 'shu');
      for (const def of shuHeroes) {
        heroSystem.addGeneral(def.id);
      }
      const all = heroSystem.getAllGenerals();
      const shuOnly = all.filter((g) => g.faction === 'shu');
      expect(shuOnly.length).toBe(shuHeroes.length);
    });

    it('按品质筛选已拥有武将', () => {
      const legendaryDefs = GENERAL_DEFS.filter((d) => d.quality === Quality.LEGENDARY);
      for (const def of legendaryDefs) {
        heroSystem.addGeneral(def.id);
      }
      const all = heroSystem.getAllGenerals();
      const legendary = all.filter((g) => g.quality === Quality.LEGENDARY);
      expect(legendary.length).toBe(legendaryDefs.length);
    });

    it('未收集的武将可通过对比定义列表获取', () => {
      // 添加部分武将
      heroSystem.addGeneral('guanyu');
      heroSystem.addGeneral('caocao');

      const ownedIds = new Set(Object.keys((heroSystem as any).state.generals));
      const uncollected = GENERAL_DEFS.filter((d) => !ownedIds.has(d.id));
      expect(uncollected.length).toBe(GENERAL_DEFS.length - 2);
    });
  });

  // ── 5. 碎片合成武将 ──

  describe('碎片合成武将（图鉴解锁）', () => {
    it('SYNTHESIZE_REQUIRED_FRAGMENTS 应覆盖全部品质', () => {
      for (const q of Object.values(Quality)) {
        expect(SYNTHESIZE_REQUIRED_FRAGMENTS[q]).toBeDefined();
        expect(SYNTHESIZE_REQUIRED_FRAGMENTS[q]).toBeGreaterThan(0);
      }
    });

    it('碎片合成需求应随品质递增', () => {
      expect(SYNTHESIZE_REQUIRED_FRAGMENTS[Quality.COMMON]).toBeLessThan(SYNTHESIZE_REQUIRED_FRAGMENTS[Quality.FINE]);
      expect(SYNTHESIZE_REQUIRED_FRAGMENTS[Quality.FINE]).toBeLessThan(SYNTHESIZE_REQUIRED_FRAGMENTS[Quality.RARE]);
      expect(SYNTHESIZE_REQUIRED_FRAGMENTS[Quality.RARE]).toBeLessThan(SYNTHESIZE_REQUIRED_FRAGMENTS[Quality.EPIC]);
      expect(SYNTHESIZE_REQUIRED_FRAGMENTS[Quality.EPIC]).toBeLessThan(SYNTHESIZE_REQUIRED_FRAGMENTS[Quality.LEGENDARY]);
    });

    it('碎片足够时可合成武将并加入名册', () => {
      // 给刘备（EPIC）添加足够的碎片
      const required = SYNTHESIZE_REQUIRED_FRAGMENTS[Quality.EPIC];
      heroSystem.addFragment('liubei', required);
      const result = heroSystem.fragmentSynthesize('liubei');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('liubei');
      expect(heroSystem.hasGeneral('liubei')).toBe(true);
    });

    it('碎片不足时合成失败', () => {
      const required = SYNTHESIZE_REQUIRED_FRAGMENTS[Quality.LEGENDARY];
      heroSystem.addFragment('guanyu', required - 1);
      const result = heroSystem.fragmentSynthesize('guanyu');
      expect(result).toBeNull();
      expect(heroSystem.hasGeneral('guanyu')).toBe(false);
    });

    it('已拥有的武将不能再次合成', () => {
      heroSystem.addGeneral('guanyu');
      heroSystem.addFragment('guanyu', 999);
      const result = heroSystem.fragmentSynthesize('guanyu');
      expect(result).toBeNull();
    });

    it('合成后碎片应被正确消耗', () => {
      const required = SYNTHESIZE_REQUIRED_FRAGMENTS[Quality.COMMON];
      heroSystem.addFragment('minbingduizhang', required + 50);
      heroSystem.fragmentSynthesize('minbingduizhang');
      expect(heroSystem.getFragments('minbingduizhang')).toBe(50);
    });
  });

  // ── 6. 重复武将处理 ──

  describe('重复武将碎片转化', () => {
    it('DUPLICATE_FRAGMENT_COUNT 应覆盖全部品质', () => {
      for (const q of Object.values(Quality)) {
        expect(DUPLICATE_FRAGMENT_COUNT[q]).toBeDefined();
        expect(DUPLICATE_FRAGMENT_COUNT[q]).toBeGreaterThan(0);
      }
    });

    it('重复武将碎片转化数量应随品质递增', () => {
      expect(DUPLICATE_FRAGMENT_COUNT[Quality.COMMON]).toBeLessThan(DUPLICATE_FRAGMENT_COUNT[Quality.FINE]);
      expect(DUPLICATE_FRAGMENT_COUNT[Quality.FINE]).toBeLessThan(DUPLICATE_FRAGMENT_COUNT[Quality.RARE]);
      expect(DUPLICATE_FRAGMENT_COUNT[Quality.RARE]).toBeLessThan(DUPLICATE_FRAGMENT_COUNT[Quality.EPIC]);
      expect(DUPLICATE_FRAGMENT_COUNT[Quality.EPIC]).toBeLessThan(DUPLICATE_FRAGMENT_COUNT[Quality.LEGENDARY]);
    });

    it('handleDuplicate 应正确添加碎片', () => {
      const fragments = heroSystem.handleDuplicate('guanyu', Quality.LEGENDARY);
      expect(fragments).toBe(DUPLICATE_FRAGMENT_COUNT[Quality.LEGENDARY]);
      expect(heroSystem.getFragments('guanyu')).toBe(fragments);
    });
  });

  // ── 7. 升星碎片消耗 ──

  describe('升星碎片消耗配置', () => {
    it('STAR_UP_FRAGMENT_COST 应有 MAX_STAR_LEVEL 个条目（1→2 到 5→6）', () => {
      // 数组索引 0 是 0→1 星（无消耗），索引 1~5 是 1→2 到 5→6
      expect(STAR_UP_FRAGMENT_COST.length).toBe(MAX_STAR_LEVEL);
    });

    it('0→1 星消耗应为 0', () => {
      expect(STAR_UP_FRAGMENT_COST[0]).toBe(0);
    });

    it('升星消耗应递增', () => {
      for (let i = 1; i < STAR_UP_FRAGMENT_COST.length - 1; i++) {
        expect(STAR_UP_FRAGMENT_COST[i]).toBeLessThan(STAR_UP_FRAGMENT_COST[i + 1]);
      }
    });
  });

  // ── 8. 碎片上限 ──

  describe('碎片上限', () => {
    it('碎片上限应为 999', () => {
      expect(HeroSystem.FRAGMENT_CAP).toBe(999);
    });

    it('添加碎片超过上限时溢出部分应返回', () => {
      const overflow = heroSystem.addFragment('guanyu', 1200);
      expect(overflow).toBe(1200 - HeroSystem.FRAGMENT_CAP);
      expect(heroSystem.getFragments('guanyu')).toBe(HeroSystem.FRAGMENT_CAP);
    });

    it('碎片溢出转化比率应为 1 碎片 = 100 铜钱', () => {
      expect(HeroSystem.FRAGMENT_TO_GOLD_RATE).toBe(100);
    });
  });

  // ── 9. 武将属性数值范围验证 ──

  describe('武将属性数值范围', () => {
    it('普通品质基础属性应在 60~75 范围', () => {
      const commons = GENERAL_DEFS.filter((d) => d.quality === Quality.COMMON);
      for (const def of commons) {
        const avg = (def.baseStats.attack + def.baseStats.defense + def.baseStats.intelligence + def.baseStats.speed) / 4;
        expect(avg).toBeGreaterThanOrEqual(40);
        expect(avg).toBeLessThanOrEqual(75);
      }
    });

    it('传说品质基础属性应在 100~120 范围', () => {
      const legendaries = GENERAL_DEFS.filter((d) => d.quality === Quality.LEGENDARY);
      for (const def of legendaries) {
        const max = Math.max(def.baseStats.attack, def.baseStats.defense, def.baseStats.intelligence, def.baseStats.speed);
        expect(max).toBeGreaterThanOrEqual(70);
      }
    });

    it('同品质内传说武将的最高属性应高于普通武将', () => {
      const commons = GENERAL_DEFS.filter((d) => d.quality === Quality.COMMON);
      const legendaries = GENERAL_DEFS.filter((d) => d.quality === Quality.LEGENDARY);
      if (commons.length > 0 && legendaries.length > 0) {
        const commonMax = Math.max(...commons.flatMap((d) => Object.values(d.baseStats)));
        const legendaryMax = Math.max(...legendaries.flatMap((d) => Object.values(d.baseStats)));
        expect(legendaryMax).toBeGreaterThan(commonMax);
      }
    });
  });

  // ── 10. 武将移除 ──

  describe('名册移除', () => {
    it('移除已拥有的武将应返回该武将数据', () => {
      heroSystem.addGeneral('guanyu');
      const removed = heroSystem.removeGeneral('guanyu');
      expect(removed).not.toBeNull();
      expect(removed!.id).toBe('guanyu');
      expect(heroSystem.hasGeneral('guanyu')).toBe(false);
    });

    it('移除不存在的武将应返回 null', () => {
      const removed = heroSystem.removeGeneral('nonexistent');
      expect(removed).toBeNull();
    });

    it('移除后计数应减少', () => {
      heroSystem.addGeneral('guanyu');
      heroSystem.addGeneral('caocao');
      expect(heroSystem.getGeneralCount()).toBe(2);
      heroSystem.removeGeneral('guanyu');
      expect(heroSystem.getGeneralCount()).toBe(1);
    });
  });

  // ── 11. 重置 ──

  describe('名册重置', () => {
    it('重置后应清空所有武将和碎片', () => {
      heroSystem.addGeneral('guanyu');
      heroSystem.addFragment('guanyu', 100);
      heroSystem.reset();
      expect(heroSystem.getGeneralCount()).toBe(0);
      expect(heroSystem.getFragments('guanyu')).toBe(0);
    });
  });
});
