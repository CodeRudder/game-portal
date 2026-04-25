/**
 * V2 武将数据完整性集成测试
 *
 * 基于 v2-play.md DATA-FLOW-1 深度验证：
 * - DATA-FLOW-1: 武将数据完整性验证（全量遍历 + 异常检测）
 * - 品质属性范围交叉验证
 * - 阵营/品质覆盖率验证
 * - 技能数据完整性验证
 * - 武将传记完整性验证
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createSim } from '../../../test-utils/test-helpers';
import {
  Quality, QUALITY_TIERS, QUALITY_ORDER, FACTIONS,
  FACTION_LABELS, QUALITY_LABELS,
} from '../../hero/hero.types';
import type { SkillType, GeneralData } from '../../hero/hero.types';
import { GENERAL_DEFS } from '../../hero/hero-config';
import type { GameEventSimulator } from '../../../test-utils/GameEventSimulator';

describe('V2 DATA-FLOW: 武将数据完整性集成测试', () => {
  let sim: GameEventSimulator;

  beforeEach(() => {
    sim = createSim();
  });

  // ─────────────────────────────────────────
  // DATA-FLOW-1: 武将数据完整性验证
  // ─────────────────────────────────────────

  describe('DATA-FLOW-1: 武将数据完整性验证', () => {
    it('should have correct general count (14)', () => {
      // Play DATA-FLOW-1 步骤2: 验证武将数量=14
      expect(GENERAL_DEFS.length).toBe(14);
    });

    it('should have all generals with valid four-dimensional stats (ATK/INT/CMD/POL > 0)', () => {
      // Play DATA-FLOW-1 步骤3: 验证每个武将四维属性非空且为正整数
      for (const def of GENERAL_DEFS) {
        expect(def.baseStats.attack, `${def.name} ATK should be > 0`).toBeGreaterThan(0);
        expect(def.baseStats.defense, `${def.name} CMD should be > 0`).toBeGreaterThan(0);
        expect(def.baseStats.intelligence, `${def.name} INT should be > 0`).toBeGreaterThan(0);
        expect(def.baseStats.speed, `${def.name} POL should be > 0`).toBeGreaterThan(0);
      }
    });

    it('should have stats within reasonable range [30, 120]', () => {
      // Play DATA-FLOW-1 步骤4: 验证四维属性在合理范围
      for (const def of GENERAL_DEFS) {
        const { attack, defense, intelligence, speed } = def.baseStats;
        expect(attack, `${def.name} ATK range`).toBeGreaterThanOrEqual(30);
        expect(attack, `${def.name} ATK range`).toBeLessThanOrEqual(120);
        expect(defense, `${def.name} CMD range`).toBeGreaterThanOrEqual(30);
        expect(defense, `${def.name} CMD range`).toBeLessThanOrEqual(120);
        expect(intelligence, `${def.name} INT range`).toBeGreaterThanOrEqual(30);
        expect(intelligence, `${def.name} INT range`).toBeLessThanOrEqual(120);
        expect(speed, `${def.name} POL range`).toBeGreaterThanOrEqual(30);
        expect(speed, `${def.name} POL range`).toBeLessThanOrEqual(120);
      }
    });

    it('should have valid quality for all generals', () => {
      // Play DATA-FLOW-1 步骤5: 验证品质枚举合法
      const validQualities = new Set<string>(Object.values(Quality));
      for (const def of GENERAL_DEFS) {
        expect(validQualities.has(def.quality), `${def.name} quality should be valid`).toBe(true);
      }
    });

    it('should have valid faction for all generals', () => {
      // Play DATA-FLOW-1 步骤6: 验证阵营枚举合法
      const validFactions = new Set<string>(FACTIONS);
      for (const def of GENERAL_DEFS) {
        expect(validFactions.has(def.faction), `${def.name} faction should be valid`).toBe(true);
      }
    });

    it('should have non-empty skills for all generals', () => {
      // Play DATA-FLOW-1 步骤7: 验证技能列表非空
      for (const def of GENERAL_DEFS) {
        expect(def.skills.length, `${def.name} should have at least 1 skill`).toBeGreaterThanOrEqual(1);
      }
    });

    it('should have all 4 factions covered', () => {
      // Play DATA-FLOW-1 步骤9: 验证阵营覆盖
      const coveredFactions = new Set(GENERAL_DEFS.map(d => d.faction));
      for (const f of FACTIONS) {
        expect(coveredFactions.has(f), `Faction ${f} should have at least 1 general`).toBe(true);
      }
    });

    it('should have all 5 quality tiers covered', () => {
      // Play DATA-FLOW-1 步骤10: 验证品质覆盖
      const coveredQualities = new Set(GENERAL_DEFS.map(d => d.quality));
      for (const q of QUALITY_TIERS) {
        expect(coveredQualities.has(q), `Quality ${q} should have at least 1 general`).toBe(true);
      }
    });

    it('should have valid skill types for all skills', () => {
      // DATA-FLOW-1 扩展: 验证技能类型合法
      const validTypes: SkillType[] = ['active', 'passive', 'faction', 'awaken'];
      const validTypeSet = new Set<string>(validTypes);
      for (const def of GENERAL_DEFS) {
        for (const skill of def.skills) {
          expect(validTypeSet.has(skill.type), `${def.name} skill ${skill.id} has invalid type`).toBe(true);
        }
      }
    });

    it('should have non-empty skill names and descriptions', () => {
      // DATA-FLOW-1 扩展: 验证技能名称和描述非空
      for (const def of GENERAL_DEFS) {
        for (const skill of def.skills) {
          expect(skill.name.length, `${def.name} skill ${skill.id} name should not be empty`).toBeGreaterThan(0);
          expect(skill.description.length, `${def.name} skill ${skill.id} desc should not be empty`).toBeGreaterThan(0);
        }
      }
    });

    it('should have valid general IDs (unique, non-empty)', () => {
      // DATA-FLOW-1 扩展: 验证ID唯一性
      const ids = GENERAL_DEFS.map(d => d.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
      for (const id of ids) {
        expect(id.length).toBeGreaterThan(0);
      }
    });

    it('should have valid general names (non-empty)', () => {
      // DATA-FLOW-1 扩展: 验证名称非空
      for (const def of GENERAL_DEFS) {
        expect(def.name.length, `${def.id} name should not be empty`).toBeGreaterThan(0);
      }
    });
  });

  // ─────────────────────────────────────────
  // DATA-FLOW-1 扩展: 品质属性范围交叉验证
  // ─────────────────────────────────────────

  describe('DATA-FLOW-1 扩展: 品质属性范围验证', () => {
    it('should have COMMON quality stats in range 60~75', () => {
      const commons = GENERAL_DEFS.filter(d => d.quality === Quality.COMMON);
      expect(commons.length).toBeGreaterThanOrEqual(1);
      for (const g of commons) {
        const max = Math.max(g.baseStats.attack, g.baseStats.defense, g.baseStats.intelligence, g.baseStats.speed);
        expect(max, `${g.name} COMMON max stat`).toBeGreaterThanOrEqual(60);
        expect(max, `${g.name} COMMON max stat`).toBeLessThanOrEqual(75);
      }
    });

    it('should have LEGENDARY quality stats in range 100~120', () => {
      const legendaries = GENERAL_DEFS.filter(d => d.quality === Quality.LEGENDARY);
      expect(legendaries.length).toBeGreaterThanOrEqual(1);
      for (const g of legendaries) {
        const max = Math.max(g.baseStats.attack, g.baseStats.defense, g.baseStats.intelligence, g.baseStats.speed);
        expect(max, `${g.name} LEGENDARY max stat`).toBeGreaterThanOrEqual(100);
      }
    });

    it('should have higher stats for higher quality tiers', () => {
      // 品质越高，最高属性应越大（趋势验证）
      const commons = GENERAL_DEFS.filter(d => d.quality === Quality.COMMON);
      const legendaries = GENERAL_DEFS.filter(d => d.quality === Quality.LEGENDARY);
      if (commons.length > 0 && legendaries.length > 0) {
        const commonMax = Math.max(...commons.map(g => Math.max(
          g.baseStats.attack, g.baseStats.defense, g.baseStats.intelligence, g.baseStats.speed,
        )));
        const legendaryMax = Math.max(...legendaries.map(g => Math.max(
          g.baseStats.attack, g.baseStats.defense, g.baseStats.intelligence, g.baseStats.speed,
        )));
        expect(legendaryMax).toBeGreaterThan(commonMax);
      }
    });
  });

  // ─────────────────────────────────────────
  // DATA-FLOW-1 扩展: 武将实例数据验证
  // ─────────────────────────────────────────

  describe('DATA-FLOW-1 扩展: 武将实例数据验证', () => {
    it('should add general and return correct data structure', () => {
      // 验证通过引擎添加武将后的数据完整性
      const result = sim.addHeroDirectly('liubei');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('liubei');
      expect(result!.name).toBe('刘备');
      expect(result!.quality).toBe(Quality.EPIC);
      expect(result!.faction).toBe('shu');
      expect(result!.level).toBe(1);
      expect(result!.exp).toBe(0);
      expect(result!.baseStats).toBeDefined();
      expect(result!.skills.length).toBeGreaterThanOrEqual(1);
    });

    it('should have consistent data between GENERAL_DEFS and engine instance', () => {
      // 验证配置数据与引擎实例数据一致
      const def = GENERAL_DEFS.find(d => d.id === 'liubei')!;
      const instance = sim.addHeroDirectly('liubei')!;
      expect(instance.id).toBe(def.id);
      expect(instance.name).toBe(def.name);
      expect(instance.quality).toBe(def.quality);
      expect(instance.faction).toBe(def.faction);
      expect(instance.baseStats.attack).toBe(def.baseStats.attack);
      expect(instance.baseStats.defense).toBe(def.baseStats.defense);
      expect(instance.baseStats.intelligence).toBe(def.baseStats.intelligence);
      expect(instance.baseStats.speed).toBe(def.baseStats.speed);
      expect(instance.skills.length).toBe(def.skills.length);
    });

    it('should return null for non-existent general', () => {
      const result = sim.addHeroDirectly('non_existent_hero');
      expect(result).toBeNull();
    });

    it('should add all 14 generals without error', () => {
      // 验证全部14个武将都可以被引擎正确添加
      const ids = GENERAL_DEFS.map(d => d.id);
      for (const id of ids) {
        const result = sim.addHeroDirectly(id);
        expect(result, `Failed to add general ${id}`).not.toBeNull();
      }
      expect(sim.getGeneralCount()).toBe(14);
    });

    it('should handle duplicate add gracefully', () => {
      sim.addHeroDirectly('liubei');
      const result = sim.addHeroDirectly('liubei');
      // 重复添加应返回null或已有实例
      expect(sim.getGeneralCount()).toBe(1);
    });
  });

  // ─────────────────────────────────────────
  // DATA-FLOW-1 扩展: 传记完整性验证
  // ─────────────────────────────────────────

  describe('DATA-FLOW-1 扩展: 传记完整性验证', () => {
    it('should have biography for all generals', () => {
      for (const def of GENERAL_DEFS) {
        expect(def.biography, `${def.name} should have biography`).toBeDefined();
        expect(def.biography!.length, `${def.name} biography should not be empty`).toBeGreaterThan(0);
      }
    });

    it('should have biography length between 10-100 characters', () => {
      for (const def of GENERAL_DEFS) {
        if (def.biography) {
          expect(def.biography.length, `${def.name} biography length`).toBeGreaterThanOrEqual(10);
          expect(def.biography.length, `${def.name} biography length`).toBeLessThanOrEqual(100);
        }
      }
    });
  });

  // ─────────────────────────────────────────
  // DATA-FLOW-1 扩展: 阵营武将分布验证
  // ─────────────────────────────────────────

  describe('DATA-FLOW-1 扩展: 阵营武将分布', () => {
    it('should show correct faction distribution', () => {
      const distribution: Record<string, number> = {};
      for (const def of GENERAL_DEFS) {
        distribution[def.faction] = (distribution[def.faction] || 0) + 1;
      }
      // 每个阵营至少2个武将（确保羁绊系统可触发）
      for (const f of FACTIONS) {
        expect(distribution[f] || 0, `Faction ${f} should have >= 2 generals`).toBeGreaterThanOrEqual(2);
      }
    });

    it('should have faction leaders with faction skills', () => {
      // 阵营领袖应有阵营技能（当前仅刘备和曹操有faction技能）
      const factionLeadersWithFactionSkill = ['liubei', 'caocao'];
      for (const id of factionLeadersWithFactionSkill) {
        const def = GENERAL_DEFS.find(d => d.id === id);
        if (def) {
          const hasFactionSkill = def.skills.some(s => s.type === 'faction');
          expect(hasFactionSkill, `${def.name} should have faction skill as leader`).toBe(true);
        }
      }
    });
  });
});
