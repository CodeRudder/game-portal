/**
 * R2 Adversarial Test — P1级别补充验证
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HeroFormation } from '../HeroFormation';
import { MAX_FORMATIONS, MAX_SLOTS_PER_FORMATION } from '../formation-types';
import type { GeneralData } from '../hero.types';

function makeGeneral(id: string, power: number = 100): GeneralData {
  return {
    id, name: id, faction: 'shu', quality: 'EPIC' as const,
    level: 1, exp: 0,
    baseStats: { attack: power, defense: power, intelligence: power, speed: power },
    skills: [], isUnlocked: true, unlockTime: Date.now(),
  };
}

describe('HeroFormation — R2 Adversarial P1', () => {
  let formation: HeroFormation;

  beforeEach(() => {
    formation = new HeroFormation();
  });

  // P1-1: autoFormationByIds空候选副作用
  describe('P1-1: autoFormationByIds empty candidate side effect', () => {
    it('should create formation as side effect even with empty candidates', () => {
      const beforeCount = formation.getFormationCount();

      const result = formation.autoFormationByIds(
        [],
        (id) => undefined,
        (g) => g.baseStats.attack,
        '1',
      );

      expect(result).toBeNull();
      expect(formation.getFormationCount()).toBe(beforeCount + 1);
      expect(formation.getFormation('1')).not.toBeNull();
    });

    it('should create formation even when all candidates are invalid', () => {
      const result = formation.autoFormationByIds(
        ['nonexistent1', 'nonexistent2'],
        (id) => undefined,
        (g) => 0,
        '1',
      );

      expect(result).toBeNull();
      expect(formation.getFormation('1')).not.toBeNull();
    });
  });

  // P1-2: deleteFormation后互斥释放
  describe('P1-2: mutual exclusion release after deleteFormation', () => {
    it('should allow hero to join another formation after its formation is deleted', () => {
      formation.createFormation('1');
      formation.addToFormation('1', 'hero1');
      formation.createFormation('2');

      expect(formation.addToFormation('2', 'hero1')).toBeNull();
      formation.deleteFormation('1');

      const result = formation.addToFormation('2', 'hero1');
      expect(result).not.toBeNull();
      expect(result!.slots[0]).toBe('hero1');
    });

    it('should release all heroes when formation is deleted', () => {
      formation.createFormation('1');
      formation.createFormation('2');
      formation.addToFormation('1', 'hero1');
      formation.addToFormation('1', 'hero2');
      formation.addToFormation('1', 'hero3');

      formation.deleteFormation('1');

      expect(formation.addToFormation('2', 'hero1')).not.toBeNull();
      expect(formation.addToFormation('2', 'hero2')).not.toBeNull();
      expect(formation.addToFormation('2', 'hero3')).not.toBeNull();
    });
  });

  // P1-3: renameFormation空字符串
  describe('P1-3: renameFormation with empty string', () => {
    it('should accept empty string as name', () => {
      formation.createFormation('1');
      const result = formation.renameFormation('1', '');
      expect(result).not.toBeNull();
      expect(result!.name).toBe('');
    });

    it('should accept whitespace-only name', () => {
      formation.createFormation('1');
      const result = formation.renameFormation('1', '   ');
      expect(result).not.toBeNull();
      expect(result!.name).toBe('   ');
    });
  });

  // P1-4: setMaxFormations边界
  describe('P1-4: setMaxFormations boundary values', () => {
    it('should clamp 0 to MAX_FORMATIONS(3)', () => {
      formation.setMaxFormations(0);
      expect(formation.getMaxFormations()).toBe(MAX_FORMATIONS);
    });

    it('should clamp negative to MAX_FORMATIONS(3)', () => {
      formation.setMaxFormations(-1);
      expect(formation.getMaxFormations()).toBe(MAX_FORMATIONS);
    });

    it('should keep MAX_FORMATIONS(3) unchanged', () => {
      formation.setMaxFormations(3);
      expect(formation.getMaxFormations()).toBe(3);
    });

    it('should allow expansion to 4', () => {
      formation.setMaxFormations(4);
      expect(formation.getMaxFormations()).toBe(4);
    });

    it('should allow expansion to 5', () => {
      formation.setMaxFormations(5);
      expect(formation.getMaxFormations()).toBe(5);
    });

    it('should clamp 6 to 5', () => {
      formation.setMaxFormations(6);
      expect(formation.getMaxFormations()).toBe(5);
    });

    it('should clamp 100 to 5', () => {
      formation.setMaxFormations(100);
      expect(formation.getMaxFormations()).toBe(5);
    });

    it('should allow creating 4th formation after setMaxFormations(4)', () => {
      formation.setMaxFormations(4);
      formation.createFormation();
      formation.createFormation();
      formation.createFormation();
      const f4 = formation.createFormation();
      expect(f4).not.toBeNull();
      expect(f4!.id).toBe('4');
    });

    it('should allow creating 5 formations with setMaxFormations(5)', () => {
      formation.setMaxFormations(5);
      for (let i = 0; i < 5; i++) {
        expect(formation.createFormation()).not.toBeNull();
      }
      expect(formation.createFormation()).toBeNull();
    });
  });

  // P1-5: calcPower异常值传播
  describe('P1-5: calcPower abnormal value propagation', () => {
    it('should propagate NaN from calcPower', () => {
      formation.createFormation('1');
      formation.addToFormation('1', 'hero1');

      const f = formation.getFormation('1')!;
      const power = formation.calculateFormationPower(
        f,
        (id) => id === 'hero1' ? makeGeneral('hero1', 100) : undefined,
        () => NaN,
      );

      expect(power).toBeNaN();
    });

    it('should propagate Infinity from calcPower', () => {
      formation.createFormation('1');
      formation.addToFormation('1', 'hero1');

      const f = formation.getFormation('1')!;
      const power = formation.calculateFormationPower(
        f,
        (id) => id === 'hero1' ? makeGeneral('hero1', 100) : undefined,
        () => Infinity,
      );

      expect(power).toBe(Infinity);
    });

    it('should handle mixed NaN and normal values', () => {
      formation.createFormation('1');
      formation.addToFormation('1', 'hero1');
      formation.addToFormation('1', 'hero2');

      let callCount = 0;
      const f = formation.getFormation('1')!;
      const power = formation.calculateFormationPower(
        f,
        (id) => id === 'hero1' || id === 'hero2' ? makeGeneral(id, 100) : undefined,
        () => callCount++ === 0 ? NaN : 200,
      );

      expect(power).toBeNaN();
    });
  });

  // P1-6: 序列化数据独立性
  describe('P1-6: serialization data independence', () => {
    it('should not affect internal state when modifying serialized data', () => {
      formation.createFormation('1');
      formation.addToFormation('1', 'hero1');

      const serialized = formation.serialize();
      serialized.state.formations['1'].slots[0] = 'HACKED';
      serialized.state.formations['1'].name = 'HACKED';

      const f = formation.getFormation('1')!;
      expect(f.slots[0]).toBe('hero1');
      expect(f.name).toBe('第一队');
    });

    it('should not affect deserialized data when modifying source', () => {
      formation.createFormation('1');
      formation.addToFormation('1', 'hero1');

      const serialized = formation.serialize();
      const other = new HeroFormation();
      other.deserialize(serialized);

      serialized.state.formations['1'].slots[0] = 'HACKED';

      const f = other.getFormation('1')!;
      expect(f.slots[0]).toBe('hero1');
    });
  });
});
