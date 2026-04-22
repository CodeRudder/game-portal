/**
 * HeroFormation 单元测试
 *
 * 覆盖：
 * - CRUD操作（创建/获取/设置/删除/重命名）
 * - 编队激活/切换
 * - 添加/移除武将
 * - 战力计算
 * - 序列化/反序列化
 * - 边界情况（最大编队数、最大武将数、重复武将）
 */

import { HeroFormation, MAX_FORMATIONS, MAX_SLOTS_PER_FORMATION } from '../HeroFormation';
import type { FormationData } from '../HeroFormation';
import type { GeneralData } from '../hero.types';
import { Quality } from '../hero.types';

// ── 辅助：创建 mock GeneralData ──
function makeGeneral(id: string, power: number = 100): GeneralData {
  return {
    id,
    name: id,
    faction: 'shu',
    quality: Quality.EPIC,
    level: 1,
    exp: 0,
    baseStats: { attack: power, defense: power, intelligence: power, speed: power },
    skills: [],
    isUnlocked: true,
    unlockTime: Date.now(),
  };
}

// ── 辅助：战力计算函数 ──
function calcPower(g: GeneralData): number {
  return g.baseStats.attack + g.baseStats.defense;
}

// ── 辅助：武将查找函数 ──
function makeGetGeneral(map: Record<string, GeneralData>) {
  return (id: string) => map[id];
}

describe('HeroFormation', () => {
  let formation: HeroFormation;

  beforeEach(() => {
    formation = new HeroFormation();
  });

  // ═══════════════════════════════════════════
  // 1. 创建编队
  // ═══════════════════════════════════════════
  describe('创建编队', () => {
    it('should create formation with auto ID', () => {
      const f = formation.createFormation();
      expect(f).not.toBeNull();
      expect(f!.id).toBe('1');
      expect(f!.name).toBe('第一队');
      expect(f!.slots).toHaveLength(MAX_SLOTS_PER_FORMATION);
      expect(f!.slots.every((s) => s === '')).toBe(true);
    });

    it('should create formation with specified ID', () => {
      const f = formation.createFormation('2');
      expect(f).not.toBeNull();
      expect(f!.id).toBe('2');
      expect(f!.name).toBe('第二队');
    });

    it('should auto-activate first created formation', () => {
      formation.createFormation();
      expect(formation.getActiveFormationId()).toBe('1');
    });

    it('should not auto-activate subsequent formations', () => {
      formation.createFormation();
      formation.createFormation();
      expect(formation.getActiveFormationId()).toBe('1');
    });

    it('should return null when creating duplicate ID', () => {
      formation.createFormation('1');
      const dup = formation.createFormation('1');
      expect(dup).toBeNull();
    });

    it('should respect MAX_FORMATIONS limit', () => {
      for (let i = 0; i < MAX_FORMATIONS; i++) {
        const f = formation.createFormation();
        expect(f).not.toBeNull();
      }
      const overflow = formation.createFormation();
      expect(overflow).toBeNull();
    });

    it('should return correct formation count', () => {
      expect(formation.getFormationCount()).toBe(0);
      formation.createFormation();
      expect(formation.getFormationCount()).toBe(1);
      formation.createFormation();
      expect(formation.getFormationCount()).toBe(2);
    });
  });

  // ═══════════════════════════════════════════
  // 2. 获取编队
  // ═══════════════════════════════════════════
  describe('获取编队', () => {
    it('should get formation by ID', () => {
      formation.createFormation('1');
      const f = formation.getFormation('1');
      expect(f).not.toBeNull();
      expect(f!.id).toBe('1');
    });

    it('should return null for nonexistent formation', () => {
      expect(formation.getFormation('99')).toBeNull();
    });

    it('should return all formations', () => {
      formation.createFormation();
      formation.createFormation();
      const all = formation.getAllFormations();
      expect(all).toHaveLength(2);
    });

    it('should return cloned formation data (immutability)', () => {
      formation.createFormation('1');
      const f1 = formation.getFormation('1')!;
      f1.name = 'hacked';
      const f2 = formation.getFormation('1')!;
      expect(f2.name).toBe('第一队');
    });
  });

  // ═══════════════════════════════════════════
  // 3. 设置编队武将
  // ═══════════════════════════════════════════
  describe('设置编队武将', () => {
    it('should set formation slots', () => {
      formation.createFormation('1');
      const f = formation.setFormation('1', ['hero1', 'hero2']);
      expect(f).not.toBeNull();
      expect(f!.slots[0]).toBe('hero1');
      expect(f!.slots[1]).toBe('hero2');
      expect(f!.slots[2]).toBe('');
    });

    it('should trim slots exceeding MAX_SLOTS_PER_FORMATION', () => {
      formation.createFormation('1');
      const tooMany = Array(MAX_SLOTS_PER_FORMATION + 3).fill('hero');
      const f = formation.setFormation('1', tooMany);
      expect(f!.slots).toHaveLength(MAX_SLOTS_PER_FORMATION);
    });

    it('should return null for nonexistent formation', () => {
      expect(formation.setFormation('99', ['hero1'])).toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // 4. 删除编队
  // ═══════════════════════════════════════════
  describe('删除编队', () => {
    it('should delete formation', () => {
      formation.createFormation('1');
      expect(formation.deleteFormation('1')).toBe(true);
      expect(formation.getFormation('1')).toBeNull();
    });

    it('should return false for nonexistent formation', () => {
      expect(formation.deleteFormation('99')).toBe(false);
    });

    it('should switch active formation when deleting active one', () => {
      formation.createFormation('1');
      formation.createFormation('2');
      formation.setActiveFormation('1');
      formation.deleteFormation('1');
      expect(formation.getActiveFormationId()).toBe('2');
    });

    it('should set active to null when deleting last formation', () => {
      formation.createFormation('1');
      formation.deleteFormation('1');
      expect(formation.getActiveFormationId()).toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // 5. 重命名编队
  // ═══════════════════════════════════════════
  describe('重命名编队', () => {
    it('should rename formation', () => {
      formation.createFormation('1');
      const f = formation.renameFormation('1', '主力队');
      expect(f).not.toBeNull();
      expect(f!.name).toBe('主力队');
    });

    it('should truncate name to 10 characters', () => {
      formation.createFormation('1');
      const f = formation.renameFormation('1', '一二三四五六七八九十十一');
      expect(f!.name.length).toBe(10);
    });

    it('should return null for nonexistent formation', () => {
      expect(formation.renameFormation('99', 'test')).toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // 6. 激活编队
  // ═══════════════════════════════════════════
  describe('激活编队', () => {
    it('should set active formation', () => {
      formation.createFormation('1');
      formation.createFormation('2');
      expect(formation.setActiveFormation('2')).toBe(true);
      expect(formation.getActiveFormationId()).toBe('2');
    });

    it('should return false for nonexistent formation', () => {
      expect(formation.setActiveFormation('99')).toBe(false);
    });

    it('should get active formation data', () => {
      formation.createFormation('1');
      const active = formation.getActiveFormation();
      expect(active).not.toBeNull();
      expect(active!.id).toBe('1');
    });

    it('should return null active when no formations', () => {
      expect(formation.getActiveFormation()).toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // 7. 添加/移除武将
  // ═══════════════════════════════════════════
  describe('添加/移除武将', () => {
    it('should add hero to first empty slot', () => {
      formation.createFormation('1');
      const f = formation.addToFormation('1', 'hero1');
      expect(f).not.toBeNull();
      expect(f!.slots[0]).toBe('hero1');
    });

    it('should add multiple heroes sequentially', () => {
      formation.createFormation('1');
      formation.addToFormation('1', 'hero1');
      formation.addToFormation('1', 'hero2');
      const f = formation.getFormation('1')!;
      expect(f.slots[0]).toBe('hero1');
      expect(f.slots[1]).toBe('hero2');
    });

    it('should not add duplicate hero to same formation', () => {
      formation.createFormation('1');
      formation.addToFormation('1', 'hero1');
      const result = formation.addToFormation('1', 'hero1');
      expect(result).toBeNull();
    });

    it('should not add hero when formation is full', () => {
      formation.createFormation('1');
      for (let i = 0; i < MAX_SLOTS_PER_FORMATION; i++) {
        formation.addToFormation('1', `hero${i}`);
      }
      const overflow = formation.addToFormation('1', 'hero_extra');
      expect(overflow).toBeNull();
    });

    it('should return null when adding to nonexistent formation', () => {
      expect(formation.addToFormation('99', 'hero1')).toBeNull();
    });

    it('should remove hero from formation', () => {
      formation.createFormation('1');
      formation.addToFormation('1', 'hero1');
      const f = formation.removeFromFormation('1', 'hero1');
      expect(f).not.toBeNull();
      expect(f!.slots[0]).toBe('');
    });

    it('should return null when removing hero not in formation', () => {
      formation.createFormation('1');
      expect(formation.removeFromFormation('1', 'hero1')).toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // 8. 战力计算
  // ═══════════════════════════════════════════
  describe('战力计算', () => {
    it('should calculate formation power', () => {
      formation.createFormation('1');
      formation.addToFormation('1', 'h1');
      formation.addToFormation('1', 'h2');

      const generals: Record<string, GeneralData> = {
        h1: makeGeneral('h1', 100),
        h2: makeGeneral('h2', 200),
      };

      const f = formation.getFormation('1')!;
      const power = formation.calculateFormationPower(f, makeGetGeneral(generals), calcPower);
      // calcPower = attack + defense = 100+100 + 200+200 = 600
      expect(power).toBe(600);
    });

    it('should return 0 for empty formation', () => {
      formation.createFormation('1');
      const f = formation.getFormation('1')!;
      const power = formation.calculateFormationPower(f, () => undefined, calcPower);
      expect(power).toBe(0);
    });

    it('should skip missing generals in power calculation', () => {
      formation.createFormation('1');
      formation.addToFormation('1', 'h1');
      formation.addToFormation('1', 'h2');

      // Only h1 exists
      const generals: Record<string, GeneralData> = { h1: makeGeneral('h1', 100) };
      const f = formation.getFormation('1')!;
      const power = formation.calculateFormationPower(f, makeGetGeneral(generals), calcPower);
      expect(power).toBe(200); // Only h1: 100+100
    });

    it('should count formation members correctly', () => {
      formation.createFormation('1');
      expect(formation.getFormationMemberCount('1')).toBe(0);
      formation.addToFormation('1', 'h1');
      expect(formation.getFormationMemberCount('1')).toBe(1);
      formation.addToFormation('1', 'h2');
      expect(formation.getFormationMemberCount('1')).toBe(2);
    });
  });

  // ═══════════════════════════════════════════
  // 9. 查询工具
  // ═══════════════════════════════════════════
  describe('查询工具', () => {
    it('should check if general is in any formation', () => {
      formation.createFormation('1');
      formation.addToFormation('1', 'hero1');
      expect(formation.isGeneralInAnyFormation('hero1')).toBe(true);
      expect(formation.isGeneralInAnyFormation('hero2')).toBe(false);
    });

    it('should find formations containing a general', () => {
      formation.createFormation('1');
      formation.createFormation('2');
      formation.addToFormation('1', 'hero1');
      formation.addToFormation('2', 'hero2');
      const ids = formation.getFormationsContainingGeneral('hero1');
      expect(ids).toContain('1');
      expect(ids).not.toContain('2');
    });

    it('should return empty when general not in any formation', () => {
      formation.createFormation('1');
      expect(formation.getFormationsContainingGeneral('hero1')).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════
  // 10. 序列化/反序列化
  // ═══════════════════════════════════════════
  describe('序列化/反序列化', () => {
    it('should serialize and deserialize correctly', () => {
      formation.createFormation('1');
      formation.addToFormation('1', 'hero1');
      formation.createFormation('2');

      const data = formation.serialize();
      expect(data.version).toBe(1);
      expect(Object.keys(data.state.formations)).toHaveLength(2);
      expect(data.state.activeFormationId).toBe('1');

      const newFormation = new HeroFormation();
      newFormation.deserialize(data);
      expect(newFormation.getFormationCount()).toBe(2);
      expect(newFormation.getActiveFormationId()).toBe('1');

      const f1 = newFormation.getFormation('1')!;
      expect(f1.slots[0]).toBe('hero1');
    });

    it('should handle empty state serialization', () => {
      const data = formation.serialize();
      expect(data.state.formations).toEqual({});
      expect(data.state.activeFormationId).toBeNull();
    });

    it('should handle deserialization with invalid data gracefully', () => {
      // Should not throw
      expect(() => formation.deserialize({ version: 1, state: undefined as any })).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════
  // 11. 重置
  // ═══════════════════════════════════════════
  describe('重置', () => {
    it('should reset all state', () => {
      formation.createFormation('1');
      formation.addToFormation('1', 'hero1');
      formation.reset();
      expect(formation.getFormationCount()).toBe(0);
      expect(formation.getActiveFormationId()).toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // 12. 边界情况
  // ═══════════════════════════════════════════
  describe('边界情况', () => {
    it('should reject same hero in different formations', () => {
      formation.createFormation('1');
      formation.createFormation('2');
      formation.addToFormation('1', 'hero1');
      // 同一武将不允许加入其他编队
      const f = formation.addToFormation('2', 'hero1');
      expect(f).toBeNull();
    });

    it('should handle remove and re-add to same slot', () => {
      formation.createFormation('1');
      formation.addToFormation('1', 'hero1');
      formation.removeFromFormation('1', 'hero1');
      const f = formation.addToFormation('1', 'hero1');
      expect(f).not.toBeNull();
      expect(f!.slots[0]).toBe('hero1');
    });

    it('should handle formation ID auto-assignment after delete', () => {
      formation.createFormation('1');
      formation.createFormation('2');
      formation.deleteFormation('1');
      // Next available ID should be '1'
      const f = formation.createFormation();
      expect(f!.id).toBe('1');
    });

    it('should preserve formation data immutability across operations', () => {
      formation.createFormation('1');
      const original = formation.getFormation('1')!;
      formation.addToFormation('1', 'hero1');
      // Original reference should not be affected
      expect(original.slots[0]).toBe('');
    });
  });
});
