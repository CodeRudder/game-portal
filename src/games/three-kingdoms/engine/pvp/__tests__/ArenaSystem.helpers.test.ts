/**
 * ArenaSystem.helpers 单元测试
 *
 * 覆盖：
 * 1. createDefaultDefenseFormation — 默认防守阵容
 * 2. createDefaultArenaPlayerState — 默认玩家状态
 * 3. selectByFactionBalance — 阵营平衡选择
 * 4. calculatePower — 战力计算
 * 5. 常量验证
 */

import {
  createDefaultDefenseFormation,
  createDefaultArenaPlayerState,
  selectByFactionBalance,
  calculatePower,
  DEFAULT_MATCH_CONFIG,
  DEFAULT_CHALLENGE_CONFIG,
  ARENA_SAVE_VERSION,
} from '../ArenaSystem.helpers';

import { FormationType, AIDefenseStrategy } from '../../../core/pvp/pvp.types';

import type { ArenaOpponent, ArenaPlayerState } from '../../../core/pvp/pvp.types';

describe('ArenaSystem.helpers', () => {
  // ─── createDefaultDefenseFormation ────────

  describe('createDefaultDefenseFormation', () => {
    it('应返回5个空槽位', () => {
      const formation = createDefaultDefenseFormation();
      expect(formation.slots.length).toBe(5);
      expect(formation.slots.every(s => s === '')).toBe(true);
    });

    it('默认阵型应为鱼鳞阵', () => {
      const formation = createDefaultDefenseFormation();
      expect(formation.formation).toBe(FormationType.FISH_SCALE);
    });

    it('默认策略应为均衡', () => {
      const formation = createDefaultDefenseFormation();
      expect(formation.strategy).toBe(AIDefenseStrategy.BALANCED);
    });
  });

  // ─── createDefaultArenaPlayerState ────────

  describe('createDefaultArenaPlayerState', () => {
    it('应创建默认玩家状态', () => {
      const state = createDefaultArenaPlayerState('player_1');
      expect(state.playerId).toBe('player_1');
      expect(state.score).toBe(0);
      expect(state.rankId).toBe('BRONZE_V');
      expect(state.dailyChallengesLeft).toBe(DEFAULT_CHALLENGE_CONFIG.dailyFreeChallenges);
    });

    it('无参数时 playerId 应为空', () => {
      const state = createDefaultArenaPlayerState();
      expect(state.playerId).toBe('');
    });

    it('应有默认防守阵容', () => {
      const state = createDefaultArenaPlayerState();
      expect(state.defenseFormation).toBeDefined();
      expect(state.defenseFormation.slots.length).toBe(5);
    });
  });

  // ─── selectByFactionBalance ───────────────

  describe('selectByFactionBalance', () => {
    const candidates: ArenaOpponent[] = [
      { playerId: 'p1', name: 'A', faction: 'wei', score: 100, rankId: 'GOLD_I', ranking: 1 },
      { playerId: 'p2', name: 'B', faction: 'shu', score: 90, rankId: 'GOLD_II', ranking: 2 },
      { playerId: 'p3', name: 'C', faction: 'wu', score: 80, rankId: 'SILVER_I', ranking: 3 },
      { playerId: 'p4', name: 'D', faction: 'wei', score: 70, rankId: 'SILVER_II', ranking: 4 },
    ];

    it('候选数不足时返回全部', () => {
      const result = selectByFactionBalance(candidates.slice(0, 2), 5);
      expect(result.length).toBe(2);
    });

    it('应从不同阵营选取', () => {
      const result = selectByFactionBalance(candidates, 3);
      const factions = result.map(r => r.faction);
      const uniqueFactions = new Set(factions);
      expect(uniqueFactions.size).toBe(3);
    });

    it('空列表应返回空', () => {
      expect(selectByFactionBalance([], 3)).toEqual([]);
    });

    it('count为0应返回空', () => {
      expect(selectByFactionBalance(candidates, 0)).toEqual([]);
    });
  });

  // ─── calculatePower ───────────────────────

  describe('calculatePower', () => {
    it('应正确计算战力', () => {
      const state = createDefaultArenaPlayerState();
      state.score = 100;
      const power = calculatePower(state);
      // 基础5000 + 积分×10 + 武将数×1000
      expect(power).toBe(5000 + 100 * 10); // 0个武将
    });

    it('有武将应增加战力', () => {
      const state = createDefaultArenaPlayerState();
      state.score = 100;
      state.defenseFormation.slots[0] = 'hero_1';
      const power = calculatePower(state);
      expect(power).toBe(5000 + 100 * 10 + 1 * 1000);
    });
  });

  // ─── 常量 ─────────────────────────────────

  describe('常量', () => {
    it('DEFAULT_MATCH_CONFIG 应有合理值', () => {
      expect(DEFAULT_MATCH_CONFIG.candidateCount).toBeGreaterThan(0);
      expect(DEFAULT_MATCH_CONFIG.powerMinRatio).toBeLessThan(1);
      expect(DEFAULT_MATCH_CONFIG.powerMaxRatio).toBeGreaterThan(1);
    });

    it('ARENA_SAVE_VERSION 应为正数', () => {
      expect(ARENA_SAVE_VERSION).toBeGreaterThan(0);
    });
  });
});
