/**
 * R2 Adversarial Test — 防守阵容系统补充
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DefenseFormationSystem, MAX_DEFENSE_LOGS } from '../../pvp/DefenseFormationSystem';
import { FormationType, AIDefenseStrategy } from '../../../core/pvp/pvp.types';

describe('DefenseFormationSystem — R2 Adversarial', () => {
  let system: DefenseFormationSystem;

  beforeEach(() => {
    system = new DefenseFormationSystem();
  });

  describe('异常消息验证', () => {
    it('should throw error when no heroes in defense formation', () => {
      const default_ = system.createDefaultFormation();
      expect(() =>
        system.setFormation(default_, ['', '', '', '', ''])
      ).toThrow('防守阵容至少需要1名武将');
    });
  });

  describe('日志老化', () => {
    it('should discard oldest log when exceeding MAX_DEFENSE_LOGS', () => {
      let logs: any[] = [];

      for (let i = 0; i < MAX_DEFENSE_LOGS + 1; i++) {
        logs = system.addDefenseLog(logs, {
          attackerId: `attacker_${i}`,
          defenderWon: true,
          timestamp: Date.now() + i,
        });
      }

      expect(logs.length).toBe(MAX_DEFENSE_LOGS);
      expect(logs[0].attackerId).toBe(`attacker_${MAX_DEFENSE_LOGS}`);
      expect(logs.find((l: any) => l.attackerId === 'attacker_0')).toBeUndefined();
    });
  });

  describe('阵容验证', () => {
    it('should detect duplicate heroes in defense formation', () => {
      const default_ = system.createDefaultFormation();
      const dup = system.setFormation(default_, ['hero1', 'hero1', '', '', '']);
      const validation = system.validateFormation(dup);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('武将不能重复');
    });

    it('should validate formation type', () => {
      const default_ = system.createDefaultFormation();
      const modified = { ...default_, formation: 'INVALID' as FormationType };
      const validation = system.validateFormation(modified);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('无效的阵型');
    });
  });

  describe('序列化/反序列化', () => {
    it('should serialize and deserialize defense data', () => {
      const default_ = system.createDefaultFormation();
      const formation = system.setFormation(default_, ['h1', 'h2', '', '', '']);

      const playerState = {
        defenseFormation: formation,
        defenseLogs: [],
      } as any;

      const serialized = system.serialize(playerState);
      const deserialized = system.deserialize(serialized);

      expect(deserialized.defenseFormation).toBeDefined();
      expect(deserialized.defenseFormation!.slots[0]).toBe('h1');
    });

    it('should create default formation when deserializing null data', () => {
      const result = system.deserialize({
        defenseFormation: null as any,
        defenseLogs: null as any,
      });
      expect(result.defenseFormation).toBeDefined();
      expect(result.defenseFormation!.formation).toBe(FormationType.FISH_SCALE);
    });
  });
});
