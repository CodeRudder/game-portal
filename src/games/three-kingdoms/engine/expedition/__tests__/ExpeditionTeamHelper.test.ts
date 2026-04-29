/**
 * ExpeditionTeamHelper 单元测试
 *
 * 覆盖：
 * 1. validateTeam — 编队校验
 * 2. checkFactionBond — 阵营羁绊
 * 3. calculateTeamPower — 战力计算
 * 4. autoComposeTeam — 智能编队
 * 5. calculateTroopCost — 兵力消耗
 */

import { ExpeditionTeamHelper } from '../ExpeditionTeamHelper';

import type { HeroBrief, TeamValidationResult } from '../ExpeditionTeamHelper';

import type { ExpeditionTeam, FormationType } from '../../../core/expedition/expedition.types';

describe('ExpeditionTeamHelper', () => {
  const heroes: Record<string, HeroBrief> = {
    hero_1: { id: 'hero_1', faction: 'wei', power: 1000 },
    hero_2: { id: 'hero_2', faction: 'wei', power: 2000 },
    hero_3: { id: 'hero_3', faction: 'shu', power: 1500 },
    hero_4: { id: 'hero_4', faction: 'wu', power: 1800 },
  };

  // ─── validateTeam ─────────────────────────

  describe('validateTeam', () => {
    it('合法编队应通过校验', () => {
      const result = ExpeditionTeamHelper.validateTeam(
        ['hero_1', 'hero_2'], 'fish_scale', heroes, [],
      );
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('空队伍应报错', () => {
      const result = ExpeditionTeamHelper.validateTeam(
        [], 'fish_scale', heroes, [],
      );
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('不存在的武将应报错', () => {
      const result = ExpeditionTeamHelper.validateTeam(
        ['nonexistent'], 'fish_scale', heroes, [],
      );
      expect(result.valid).toBe(false);
    });

    it('已在其他队伍的武将应报错', () => {
      const activeTeams: ExpeditionTeam[] = [{
        id: 'team_1',
        heroIds: ['hero_1'],
        formation: 'fish_scale' as FormationType,
        troopCost: 100,
        status: 'active',
      }];
      const result = ExpeditionTeamHelper.validateTeam(
        ['hero_1'], 'fish_scale', heroes, activeTeams,
      );
      expect(result.valid).toBe(false);
    });

    it('同阵营应触发羁绊', () => {
      const result = ExpeditionTeamHelper.validateTeam(
        ['hero_1', 'hero_2', 'hero_3'], 'fish_scale', heroes, [],
      );
      // hero_1, hero_2 都是 wei
      expect(result.factionBond).toBe(true);
    });

    it('应计算总战力', () => {
      const result = ExpeditionTeamHelper.validateTeam(
        ['hero_1', 'hero_3'], 'fish_scale', heroes, [],
      );
      expect(result.totalPower).toBeGreaterThan(0);
    });
  });

  // ─── checkFactionBond ─────────────────────

  describe('checkFactionBond', () => {
    it('3个同阵营应触发羁绊', () => {
      const heroes3wei: Record<string, HeroBrief> = {
        h1: { id: 'h1', faction: 'wei', power: 1000 },
        h2: { id: 'h2', faction: 'wei', power: 1000 },
        h3: { id: 'h3', faction: 'wei', power: 1000 },
      };
      expect(ExpeditionTeamHelper.checkFactionBond(['h1', 'h2', 'h3'], heroes3wei)).toBe(true);
    });

    it('不同阵营不应触发', () => {
      expect(ExpeditionTeamHelper.checkFactionBond(['hero_1', 'hero_3', 'hero_4'], heroes)).toBe(false);
    });
  });

  // ─── calculateTeamPower ───────────────────

  describe('calculateTeamPower', () => {
    it('应正确计算总战力', () => {
      const power = ExpeditionTeamHelper.calculateTeamPower(
        ['hero_1', 'hero_3'], heroes, 'fish_scale',
      );
      expect(power).toBeGreaterThan(0);
    });
  });

  // ─── autoComposeTeam ──────────────────────

  describe('autoComposeTeam', () => {
    it('应返回武将ID列表', () => {
      const available: HeroBrief[] = Object.values(heroes);
      const result = ExpeditionTeamHelper.autoComposeTeam(
        available, new Set(), 'fish_scale',
      );
      expect(result.length).toBeGreaterThan(0);
      result.forEach(id => expect(typeof id).toBe('string'));
    });

    it('应排除已在队伍的武将', () => {
      const available: HeroBrief[] = Object.values(heroes);
      const activeIds = new Set(['hero_1', 'hero_2']);
      const result = ExpeditionTeamHelper.autoComposeTeam(
        available, activeIds, 'fish_scale',
      );
      expect(result).not.toContain('hero_1');
      expect(result).not.toContain('hero_2');
    });

    it('空可用列表应返回空', () => {
      const result = ExpeditionTeamHelper.autoComposeTeam(
        [], new Set(), 'fish_scale',
      );
      expect(result).toEqual([]);
    });
  });

  // ─── calculateTroopCost ───────────────────

  describe('calculateTroopCost', () => {
    it('应按武将数量计算消耗', () => {
      const cost = ExpeditionTeamHelper.calculateTroopCost(3);
      expect(cost).toBeGreaterThan(0);
    });

    it('0个武将应返回0消耗', () => {
      expect(ExpeditionTeamHelper.calculateTroopCost(0)).toBe(0);
    });
  });
});
