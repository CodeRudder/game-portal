import { BattleEngine } from '../BattleEngine';
import type {
import {

      engine.executeTurn(state);

      // 攻击者怒气应增加（普攻+25，可能受击+15）
      expect(ally.units[0].rage).toBeGreaterThanOrEqual(BATTLE_CONFIG.RAGE_GAIN_ATTACK);
    });

    it('受击后应增加怒气', () => {
      const ally = createTeam('ally', 1, { attack: 500, defense: 0, troopType: TroopType.ARCHER });
      const enemy = createTeam('enemy', 1, { attack: 500, defense: 0, hp: 10000, maxHp: 10000, troopType: TroopType.ARCHER });

      const state = engine.initBattle(ally, enemy);
      engine.executeTurn(state);

      // 被击者怒气应增加
      expect(enemy.units[0].rage).toBeGreaterThanOrEqual(BATTLE_CONFIG.RAGE_GAIN_HIT);
    });

    it('怒气不应超过上限', () => {
      const ally = createTeam('ally', 1, { attack: 500, defense: 0, troopType: TroopType.ARCHER, rage: 90 });
      const enemy = createTeam('enemy', 1, { attack: 0, defense: 0, hp: 10000, maxHp: 10000, troopType: TroopType.ARCHER });

      const state = engine.initBattle(ally, enemy);
      engine.executeTurn(state);

      expect(ally.units[0].rage).toBeLessThanOrEqual(BATTLE_CONFIG.MAX_RAGE);
    });
  });

  // ── 胜负判定 ──

  describe('isBattleOver', () => {
    it('我方全灭时应结束', () => {
      const ally = createTeam('ally', 1);
      const enemy = createTeam('enemy', 1);

      ally.units[0].isAlive = false;

      const state = engine.initBattle(ally, enemy);
      expect(engine.isBattleOver(state)).toBe(true);
    });

    it('敌方全灭时应结束', () => {
      const ally = createTeam('ally', 1);
      const enemy = createTeam('enemy', 1);

      enemy.units[0].isAlive = false;

      const state = engine.initBattle(ally, enemy);
      expect(engine.isBattleOver(state)).toBe(true);
    });

    it('双方都有存活单位时应继续', () => {
      const ally = createTeam('ally', 1);
      const enemy = createTeam('enemy', 1);

      const state = engine.initBattle(ally, enemy);
      expect(engine.isBattleOver(state)).toBe(false);
    });
  });

  // ── 星级评定 ──

  describe('星级评定', () => {
    it('胜利 + 存活≥4 + 回合≤6 → 三星', () => {
      const ally = createTeam('ally', 6, { attack: 99999, defense: 0, troopType: TroopType.ARCHER });
      const enemy = createTeam('enemy', 1, { attack: 0, defense: 0, hp: 1, maxHp: 1, troopType: TroopType.ARCHER });

      const result = engine.runFullBattle(ally, enemy);

      expect(result.outcome).toBe(BattleOutcome.VICTORY);
      expect(result.stars).toBe(StarRating.THREE);
    });

    it('胜利 + 存活≥4 + 回合>6 → 二星', () => {
      // 使用确定性伤害计算器，每次攻击固定造成50伤害
      const deterministicCalc = {
        calculateDamage: () => ({
          damage: 50,
          baseDamage: 50,
          skillMultiplier: 1.0,
          isCritical: false,
          criticalMultiplier: 1.0,
          restraintMultiplier: 1.0,
          randomFactor: 1.0,
          isMinDamage: false,
        }),
        applyDamage: (_defender: BattleUnit, damage: number) => {
          const actual = Math.min(damage, _defender.hp);
          _defender.hp -= actual;
          if (_defender.hp <= 0) {
            _defender.hp = 0;
            _defender.isAlive = false;
          }
          return actual;
        },
        calculateDotDamage: () => 0,
        isControlled: () => false,
      };

      const customEngine = new BattleEngine(deterministicCalc as unknown as Record<string, unknown>);

      // 6个盟友，每次攻击50伤害，每回合300伤害
      // HP=1800：6回合=1800刚好不够（需要>1800），7回合=2100够了
      const ally = createTeam('ally', 6, { attack: 50, defense: 99999, hp: 99999, maxHp: 99999, speed: 0, troopType: TroopType.ARCHER });
      const enemy = createTeam('enemy', 1, { attack: 0, defense: 0, hp: 1801, maxHp: 1801, troopType: TroopType.ARCHER });

      const result = customEngine.runFullBattle(ally, enemy);

      expect(result.outcome).toBe(BattleOutcome.VICTORY);
      expect(result.totalTurns).toBe(7); // 确定性地需要7回合
      expect(result.stars).toBe(StarRating.TWO);
    });

    it('胜利 + 存活<4 → 一星', () => {
      const ally = createTeam('ally', 2, { attack: 99999, defense: 0, troopType: TroopType.ARCHER });
      const enemy = createTeam('enemy', 1, { attack: 0, defense: 0, hp: 1, maxHp: 1, troopType: TroopType.ARCHER });

      const result = engine.runFullBattle(ally, enemy);

      expect(result.outcome).toBe(BattleOutcome.VICTORY);
      expect(result.stars).toBe(StarRating.ONE);
    });

    it('失败 → 无星级', () => {
      const ally = createTeam('ally', 1, { attack: 0, defense: 0, hp: 1, maxHp: 1, troopType: TroopType.ARCHER });
      const enemy = createTeam('enemy', 1, { attack: 99999, defense: 99999, hp: 99999, maxHp: 99999, troopType: TroopType.ARCHER });

      const result = engine.runFullBattle(ally, enemy);

      expect(result.outcome).toBe(BattleOutcome.DEFEAT);
      expect(result.stars).toBe(StarRating.NONE);
    });
  });

  // ── 完整战斗 ──

  describe('runFullBattle', () => {
    it('应运行完整战斗并返回结果', () => {
      const ally = createTeam('ally', 3, { attack: 200, defense: 50, troopType: TroopType.ARCHER });
      const enemy = createTeam('enemy', 3, { attack: 100, defense: 30, troopType: TroopType.ARCHER });

      const result = engine.runFullBattle(ally, enemy);

      expect(result.outcome).toBeDefined();
      expect(result.totalTurns).toBeGreaterThanOrEqual(1);
      expect(result.totalTurns).toBeLessThanOrEqual(BATTLE_CONFIG.MAX_TURNS);
      expect(result.allyTotalDamage).toBeGreaterThan(0);
      expect(result.summary).toBeTruthy();
    });

    it('强队应击败弱队', () => {
      const ally = createTeam('ally', 6, { attack: 500, defense: 200, hp: 5000, maxHp: 5000, troopType: TroopType.ARCHER });
      const enemy = createTeam('enemy', 3, { attack: 50, defense: 20, hp: 500, maxHp: 500, troopType: TroopType.ARCHER });

      const result = engine.runFullBattle(ally, enemy);

      expect(result.outcome).toBe(BattleOutcome.VICTORY);
    });

    it('回合耗尽应为平局', () => {
      // 双方防御极高，攻击极低，无法击杀
      const ally = createTeam('ally', 1, { attack: 1, defense: 99999, hp: 99999, maxHp: 99999, troopType: TroopType.ARCHER });
      const enemy = createTeam('enemy', 1, { attack: 1, defense: 99999, hp: 99999, maxHp: 99999, troopType: TroopType.ARCHER });

      const result = engine.runFullBattle(ally, enemy);

      expect(result.outcome).toBe(BattleOutcome.DRAW);
    });

    it('战斗结果应包含统计信息', () => {
      const ally = createTeam('ally', 3, { attack: 200, defense: 50, troopType: TroopType.ARCHER });
      const enemy = createTeam('enemy', 3, { attack: 100, defense: 30, troopType: TroopType.ARCHER });

      const result = engine.runFullBattle(ally, enemy);

      expect(result.allyTotalDamage).toBeGreaterThan(0);
      expect(result.enemyTotalDamage).toBeGreaterThan(0);
      expect(result.maxSingleDamage).toBeGreaterThan(0);
      expect(typeof result.maxCombo).toBe('number');
    });
  });

  // ── 控制效果 ──

  describe('控制效果', () => {
    it('眩晕时单位无法行动', () => {
      const ally = createTeam('ally', 1, {
        attack: 200,
        defense: 0,
        troopType: TroopType.ARCHER,
        buffs: [{ type: BuffType.STUN, remainingTurns: 1, value: 0, sourceId: 's' }],
      });
      const enemy = createTeam('enemy', 1, { attack: 0, defense: 0, hp: 10000, maxHp: 10000, troopType: TroopType.ARCHER });

      const state = engine.initBattle(ally, enemy);
      const actions = engine.executeTurn(state);

      const stunAction = actions.find((a) => a.actorId === ally.units[0].id);
      expect(stunAction).toBeDefined();
      expect(stunAction!.skill).toBeNull(); // 被控制，无技能
      expect(stunAction!.description).toContain('被控制');
    });
  });

  // ── Buff持续时间 ──

  describe('Buff持续时间', () => {
    it('回合结束后应减少Buff持续时间', () => {
      const ally = createTeam('ally', 1, {
        attack: 99999,
        defense: 0,
        troopType: TroopType.ARCHER,
        buffs: [{ type: BuffType.ATK_UP, remainingTurns: 2, value: 0.2, sourceId: 's' }],
      });
      const enemy = createTeam('enemy', 1, { attack: 0, defense: 0, hp: 1, maxHp: 1, troopType: TroopType.ARCHER });

      const state = engine.initBattle(ally, enemy);
      engine.executeTurn(state);

      // Buff剩余回合应减少
      expect(ally.units[0].buffs[0].remainingTurns).toBe(1);
    });
  });

  // ── 依赖注入 ──

  describe('依赖注入', () => {
    it('应支持注入自定义伤害计算器', () => {
      const customCalculator = {
        calculateDamage: jest.fn().mockReturnValue({
          damage: 999,
          baseDamage: 999,
          skillMultiplier: 1.0,
          isCritical: false,
          criticalMultiplier: 1.0,
          restraintMultiplier: 1.0,
          randomFactor: 1.0,
          isMinDamage: false,
        }),
        applyDamage: jest.fn().mockReturnValue(999),
        calculateDotDamage: jest.fn().mockReturnValue(0),
        isControlled: jest.fn().mockReturnValue(false),
      };

      const customEngine = new BattleEngine(customCalculator);
      const ally = createTeam('ally', 1, { troopType: TroopType.ARCHER });
      const enemy = createTeam('enemy', 1, { troopType: TroopType.ARCHER });

      customEngine.runFullBattle(ally, enemy);

      expect(customCalculator.calculateDamage).toHaveBeenCalled();
    });
  });

  // ── 技能冷却 ──

  describe('技能冷却', () => {
    it('释放大招后应进入冷却', () => {
      const ally = createTeam('ally', 1, {
        attack: 500,
        defense: 0,
        troopType: TroopType.ARCHER,
        rage: BATTLE_CONFIG.MAX_RAGE,
      });
      const enemy = createTeam('enemy', 1, {
        attack: 0,
        defense: 0,
        hp: 10000,
        maxHp: 10000,
        troopType: TroopType.ARCHER,
      });

      const state = engine.initBattle(ally, enemy);
      engine.executeTurn(state);

      // 大招冷却设为3，回合结束减1 → 2
      expect(ally.units[0].skills[0].currentCooldown).toBe(2);
    });

    it('冷却中应每回合减少', () => {
      const ally = createTeam('ally', 1, {
        attack: 500,
        defense: 0,
        troopType: TroopType.ARCHER,
        rage: BATTLE_CONFIG.MAX_RAGE,
      });
      const enemy = createTeam('enemy', 1, {
        attack: 0,
        defense: 0,
        hp: 100000,
        maxHp: 100000,
        troopType: TroopType.ARCHER,
      });

      const state = engine.initBattle(ally, enemy);
      engine.executeTurn(state); // 释放大招，冷却=3，回合结束减1→2

      expect(ally.units[0].skills[0].currentCooldown).toBe(2);

      // 第二回合冷却再减1
      state.currentTurn++;
      engine.executeTurn(state);
      expect(ally.units[0].skills[0].currentCooldown).toBe(1);
    });
  });
});
