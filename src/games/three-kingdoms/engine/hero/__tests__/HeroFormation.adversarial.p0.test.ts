/**
 * R2 Adversarial Test — P0级别修复验证
 *
 * 覆盖R1 Arbiter确认的3个P0遗漏：
 * 1. setFormation绕过互斥检查
 * 2. setFormation混合值过滤边界
 * 3. deserialize activeFormationId悬空
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HeroFormation } from '../HeroFormation';
import { MAX_SLOTS_PER_FORMATION } from '../formation-types';
import type { FormationSaveData } from '../formation-types';

describe('HeroFormation — R2 Adversarial P0 Fixes', () => {
  let formation: HeroFormation;

  beforeEach(() => {
    formation = new HeroFormation();
  });

  // ═══════════════════════════════════════════
  // P0-1: setFormation绕过互斥检查
  // ═══════════════════════════════════════════
  describe('P0-1: setFormation bypasses mutual exclusion', () => {
    it('should allow same hero in multiple formations via setFormation (BUG)', () => {
      formation.createFormation('1');
      formation.addToFormation('1', 'hero1');

      formation.createFormation('2');
      const result = formation.setFormation('2', ['hero1']);

      expect(result).not.toBeNull();
      expect(result!.slots[0]).toBe('hero1');

      const f1 = formation.getFormation('1')!;
      const f2 = formation.getFormation('2')!;
      expect(f1.slots).toContain('hero1');
      expect(f2.slots).toContain('hero1');

      const containing = formation.getFormationsContainingGeneral('hero1');
      expect(containing).toHaveLength(2);
    });

    it('should detect cross-formation duplication after setFormation', () => {
      formation.createFormation('1');
      formation.createFormation('2');

      formation.setFormation('1', ['heroA', 'heroB']);
      formation.setFormation('2', ['heroB', 'heroC']);

      const heroBFormations = formation.getFormationsContainingGeneral('heroB');
      expect(heroBFormations.length).toBeGreaterThan(1);
    });
  });

  // ═══════════════════════════════════════════
  // P0-2: setFormation混合值过滤边界
  // ═══════════════════════════════════════════
  describe('P0-2: setFormation mixed value filtering boundary', () => {
    it('should filter null/undefined/empty and truncate to MAX_SLOTS', () => {
      formation.createFormation('1');

      const mixed = [null, 'a', undefined, '', 'b', 'c', 'd', 'e', 'f', 'g'] as unknown as string[];
      const result = formation.setFormation('1', mixed);

      expect(result).not.toBeNull();
      expect(result!.slots[0]).toBe('a');
      expect(result!.slots[1]).toBe('b');
      expect(result!.slots[2]).toBe('c');
      expect(result!.slots[3]).toBe('d');
      expect(result!.slots[4]).toBe('e');
      expect(result!.slots[5]).toBe('f');
      expect(result!.slots).toHaveLength(MAX_SLOTS_PER_FORMATION);
    });

    it('should result in empty formation when all values are null/undefined/empty', () => {
      formation.createFormation('1');

      const allInvalid = [null, undefined, '', null, undefined, ''] as unknown as string[];
      const result = formation.setFormation('1', allInvalid);

      expect(result).not.toBeNull();
      expect(result!.slots.every(s => s === '')).toBe(true);
    });

    it('should handle sparse valid values among invalid ones', () => {
      formation.createFormation('1');

      const sparse = ['a', null, 'b', undefined, 'c'] as unknown as string[];
      const result = formation.setFormation('1', sparse);

      expect(result).not.toBeNull();
      expect(result!.slots[0]).toBe('a');
      expect(result!.slots[1]).toBe('b');
      expect(result!.slots[2]).toBe('c');
      expect(result!.slots[3]).toBe('');
    });

    it('should handle exactly MAX_SLOTS valid values', () => {
      formation.createFormation('1');

      const exact = Array.from({ length: MAX_SLOTS_PER_FORMATION }, (_, i) => `hero${i}`);
      const result = formation.setFormation('1', exact);

      expect(result).not.toBeNull();
      expect(result!.slots.filter(s => s !== '')).toHaveLength(MAX_SLOTS_PER_FORMATION);
    });
  });

  // ═══════════════════════════════════════════
  // P0-3: deserialize activeFormationId悬空
  // ═══════════════════════════════════════════
  describe('P0-3: deserialize with dangling activeFormationId', () => {
    it('should handle activeFormationId pointing to non-existent formation', () => {
      const maliciousData: FormationSaveData = {
        version: 1,
        state: {
          formations: {
            '1': { id: '1', name: '第一队', slots: ['', '', '', '', '', ''] },
          },
          activeFormationId: '99',
        },
      };

      formation.deserialize(maliciousData);

      expect(formation.getActiveFormationId()).toBe('99');
      expect(formation.getActiveFormation()).toBeNull();
    });

    it('should handle activeFormationId as null in deserialized data', () => {
      const data: FormationSaveData = {
        version: 1,
        state: {
          formations: {
            '1': { id: '1', name: '第一队', slots: ['hero1', '', '', '', '', ''] },
          },
          activeFormationId: null,
        },
      };

      formation.deserialize(data);
      expect(formation.getActiveFormationId()).toBeNull();
      expect(formation.getActiveFormation()).toBeNull();
      expect(formation.getFormation('1')).not.toBeNull();
    });

    it('should handle empty formations with non-null activeFormationId', () => {
      const data: FormationSaveData = {
        version: 1,
        state: {
          formations: {},
          activeFormationId: '1',
        },
      };

      formation.deserialize(data);
      expect(formation.getActiveFormationId()).toBe('1');
      expect(formation.getActiveFormation()).toBeNull();
      expect(formation.getFormationCount()).toBe(0);
    });
  });
});
