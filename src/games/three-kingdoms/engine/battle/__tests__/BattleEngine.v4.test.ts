/**
 * BattleEngine v4.0 集成测试 — 大招时停 + 战斗加速
 *
 * 覆盖：
 * - 战斗模式切换（AUTO/SEMI_AUTO/MANUAL）
 * - 半自动模式下大招时停集成
 * - 战斗加速集成（速度影响引擎输出）
 * - 引擎API扩展（setSpeed/getSpeedState/setBattleMode等）
 * - 不破坏v3.0原有功能
 *
 * @module engine/battle/__tests__/BattleEngine.v4.test
 */

import { BattleEngine } from '../BattleEngine';
import type {
  BattleTeam,
  BattleUnit,
  BattleSkill,
  IUltimateTimeStopHandler,
} from '../battle.types';
import {
  BATTLE_CONFIG,
  BattleMode,
  BattleOutcome,
  BattlePhase,
  BattleSpeed,
  StarRating,
  TimeStopState,
  TroopType,
} from '../battle.types';

// ─────────────────────────────────────────────
// 测试工具
// ─────────────────────────────────────────────

const NORMAL_ATTACK: BattleSkill = {
  id: 'normal',
  name: '普攻',
  type: 'active',
  level: 1,
  description: '普通攻击',
  multiplier: 1.0,
  targetType: 'SINGLE_ENEMY',
  rageCost: 0,
  cooldown: 0,
  currentCooldown: 0,
};

const ULTIMATE_SKILL: BattleSkill = {
  id: 'ultimate',
  name: '大招',
  type: 'active',
  level: 1,
  description: '强力技能',
  multiplier: 2.0,
  targetType: 'ALL_ENEMY',
  rageCost: 100,
  cooldown: 3,
  currentCooldown: 0,
};

/** 创建测试用战斗单位 */
function createUnit(overrides: Partial<BattleUnit> = {}): BattleUnit {
  return {
    id: `unit_${Math.random().toString(36).slice(2, 6)}`,
    name: '测试武将',
    faction: 'shu',
    troopType: TroopType.CAVALRY,
    position: 'front',
    side: 'ally',
    attack: 100,
    baseAttack: 100,
    defense: 50,
    baseDefense: 50,
    intelligence: 60,
    speed: 80,
    hp: 1000,
    maxHp: 1000,
    isAlive: true,
    rage: 0,
    maxRage: 100,
    normalAttack: { ...NORMAL_ATTACK },
    skills: [{ ...ULTIMATE_SKILL }],
    buffs: [],
    ...overrides,
  };
}

/** 创建测试队伍 */
function createTeam(
  side: 'ally' | 'enemy',
  count: number,
  overrides: Partial<BattleUnit> = {},
): BattleTeam {
  const units: BattleUnit[] = [];
  for (let i = 0; i < count; i++) {
    const position = i < 3 ? 'front' as const : 'back' as const;
    units.push(
      createUnit({
        id: `${side}_${i}`,
        name: `${side === 'ally' ? '我方' : '敌方'}${i + 1}`,
        side,
        position,
        ...overrides,
      }),
    );
  }
  return { units, side };
}

/** 创建模拟时停处理器 */
function createMockHandler() {
  return {
    onUltimateReady: jest.fn(),
    onBattlePaused: jest.fn(),
    onUltimateConfirmed: jest.fn(),
    onUltimateCancelled: jest.fn(),
  } as IUltimateTimeStopHandler;
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('BattleEngine v4.0', () => {
  let engine: BattleEngine;

  beforeEach(() => {
    engine = new BattleEngine();
  });

  // ── 战斗模式 ──

  describe('战斗模式', () => {
    it('默认模式应为AUTO', () => {
      expect(engine.getBattleMode()).toBe(BattleMode.AUTO);
    });

    it('应能切换到SEMI_AUTO模式', () => {
      engine.setBattleMode(BattleMode.SEMI_AUTO);
      expect(engine.getBattleMode()).toBe(BattleMode.SEMI_AUTO);
    });

    it('应能切换到MANUAL模式', () => {
      engine.setBattleMode(BattleMode.MANUAL);
      expect(engine.getBattleMode()).toBe(BattleMode.MANUAL);
    });

    it('切换模式应不影响战斗执行', () => {
      const ally = createTeam('ally', 1, { attack: 99999, defense: 0, troopType: TroopType.ARCHER });
      const enemy = createTeam('enemy', 1, { attack: 0, defense: 0, hp: 1, maxHp: 1, troopType: TroopType.ARCHER });

      engine.setBattleMode(BattleMode.SEMI_AUTO);
      const result = engine.runFullBattle(ally, enemy);

      expect(result.outcome).toBe(BattleOutcome.VICTORY);
    });
  });

  // ── 大招时停集成 ──

  describe('大招时停集成', () => {
    it('半自动模式怒气满时应触发时停处理器', () => {
      const handler = createMockHandler();
      engine.registerTimeStopHandler(handler);
      engine.setBattleMode(BattleMode.SEMI_AUTO);

      const ally = createTeam('ally', 1, {
        attack: 500,
        defense: 0,
        rage: BATTLE_CONFIG.MAX_RAGE,
        troopType: TroopType.ARCHER,
      });
      const enemy = createTeam('enemy', 1, {
        attack: 0,
        defense: 0,
        hp: 10000,
        maxHp: 10000,
        troopType: TroopType.ARCHER,
      });

      engine.runFullBattle(ally, enemy);

      // 半自动模式下，怒气满时应触发时停
      expect(handler.onUltimateReady).toHaveBeenCalled();
    });

    it('全自动模式不应触发时停', () => {
      const handler = createMockHandler();
      engine.registerTimeStopHandler(handler);
      engine.setBattleMode(BattleMode.AUTO);

      const ally = createTeam('ally', 1, {
        attack: 500,
        defense: 0,
        rage: BATTLE_CONFIG.MAX_RAGE,
        troopType: TroopType.ARCHER,
      });
      const enemy = createTeam('enemy', 1, {
        attack: 0,
        defense: 0,
        hp: 10000,
        maxHp: 10000,
        troopType: TroopType.ARCHER,
      });

      engine.runFullBattle(ally, enemy);

      expect(handler.onUltimateReady).not.toHaveBeenCalled();
    });

    it('应能获取大招时停系统', () => {
      const ultimateSystem = engine.getUltimateSystem();
      expect(ultimateSystem).toBeDefined();
      expect(typeof ultimateSystem.checkUltimateReady).toBe('function');
    });

    it('应能检查时停暂停状态', () => {
      expect(engine.isTimeStopPaused()).toBe(false);
    });
  });

  // ── 战斗加速集成 ──

  describe('战斗加速集成', () => {
    it('默认速度应为1x', () => {
      const state = engine.getSpeedState();
      expect(state.speed).toBe(BattleSpeed.X1);
    });

    it('应能设置2x速度', () => {
      engine.setSpeed(BattleSpeed.X2);
      const state = engine.getSpeedState();
      expect(state.speed).toBe(BattleSpeed.X2);
    });

    it('应能设置4x速度', () => {
      engine.setSpeed(BattleSpeed.X4);
      const state = engine.getSpeedState();
      expect(state.speed).toBe(BattleSpeed.X4);
    });

    it('速度切换不应影响战斗结果', () => {
      // 使用确定性数据
      const runBattle = () => {
        const ally = createTeam('ally', 3, {
          attack: 200,
          defense: 50,
          troopType: TroopType.ARCHER,
        });
        const enemy = createTeam('enemy', 3, {
          attack: 100,
          defense: 30,
          troopType: TroopType.ARCHER,
        });
        return engine.runFullBattle(ally, enemy);
      };

      engine.setSpeed(BattleSpeed.X1);
      const result1 = runBattle();

      engine.setSpeed(BattleSpeed.X4);
      const result2 = runBattle();

      // 速度只影响动画和间隔，不影响逻辑结果
      expect(result1.outcome).toBe(result2.outcome);
    });

    it('应能获取调整后的回合间隔', () => {
      engine.setSpeed(BattleSpeed.X1);
      expect(engine.getAdjustedTurnInterval()).toBe(1000);

      engine.setSpeed(BattleSpeed.X2);
      expect(engine.getAdjustedTurnInterval()).toBe(500);

      engine.setSpeed(BattleSpeed.X4);
      expect(engine.getAdjustedTurnInterval()).toBe(250);
    });

    it('应能获取动画速度缩放', () => {
      engine.setSpeed(BattleSpeed.X2);
      expect(engine.getAnimationSpeedScale()).toBe(2);
    });

    it('应能获取速度控制器', () => {
      const speedController = engine.getSpeedController();
      expect(speedController).toBeDefined();
      expect(typeof speedController.cycleSpeed).toBe('function');
    });
  });

  // ── v3.0 兼容性 ──

  describe('v3.0 兼容性', () => {
    it('原有初始化应正常工作', () => {
      const ally = createTeam('ally', 3);
      const enemy = createTeam('enemy', 3);

      const state = engine.initBattle(ally, enemy);

      expect(state.phase).toBe(BattlePhase.IN_PROGRESS);
      expect(state.currentTurn).toBe(1);
    });

    it('原有回合执行应正常工作', () => {
      const ally = createTeam('ally', 1, { attack: 200, defense: 0, troopType: TroopType.ARCHER });
      const enemy = createTeam('enemy', 1, { attack: 200, defense: 0, troopType: TroopType.ARCHER });

      const state = engine.initBattle(ally, enemy);
      const actions = engine.executeTurn(state);

      expect(actions.length).toBeGreaterThanOrEqual(2);
    });

    it('原有完整战斗应正常工作', () => {
      const ally = createTeam('ally', 6, { attack: 500, defense: 200, hp: 5000, maxHp: 5000, troopType: TroopType.ARCHER });
      const enemy = createTeam('enemy', 3, { attack: 50, defense: 20, hp: 500, maxHp: 500, troopType: TroopType.ARCHER });

      const result = engine.runFullBattle(ally, enemy);

      expect(result.outcome).toBe(BattleOutcome.VICTORY);
      expect(result.stars).toBeGreaterThanOrEqual(StarRating.ONE);
    });

    it('原有胜负判定应正常工作', () => {
      const ally = createTeam('ally', 1);
      const enemy = createTeam('enemy', 1);

      ally.units[0].isAlive = false;

      const state = engine.initBattle(ally, enemy);
      expect(engine.isBattleOver(state)).toBe(true);
    });

    it('原有依赖注入应正常工作', () => {
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
        applyDamage: jest.fn().mockImplementation((_defender: BattleUnit, damage: number) => {
          const actual = Math.min(damage, _defender.hp);
          _defender.hp -= actual;
          if (_defender.hp <= 0) {
            _defender.hp = 0;
            _defender.isAlive = false;
          }
          return actual;
        }),
        calculateDotDamage: jest.fn().mockReturnValue(0),
        isControlled: jest.fn().mockReturnValue(false),
      };

      const customEngine = new BattleEngine(customCalculator as any);
      const ally = createTeam('ally', 1, { troopType: TroopType.ARCHER });
      const enemy = createTeam('enemy', 1, { troopType: TroopType.ARCHER });

      customEngine.runFullBattle(ally, enemy);
      expect(customCalculator.calculateDamage).toHaveBeenCalled();
    });

    it('原有星级评定应正常工作', () => {
      const ally = createTeam('ally', 6, { attack: 99999, defense: 0, troopType: TroopType.ARCHER });
      const enemy = createTeam('enemy', 1, { attack: 0, defense: 0, hp: 1, maxHp: 1, troopType: TroopType.ARCHER });

      const result = engine.runFullBattle(ally, enemy);

      expect(result.outcome).toBe(BattleOutcome.VICTORY);
      expect(result.stars).toBe(StarRating.THREE);
    });
  });

  // ── 模式 + 速度组合 ──

  describe('模式 + 速度组合', () => {
    it('半自动 + 4x加速应正常工作', () => {
      engine.setBattleMode(BattleMode.SEMI_AUTO);
      engine.setSpeed(BattleSpeed.X4);

      const ally = createTeam('ally', 3, { attack: 500, defense: 0, troopType: TroopType.ARCHER });
      const enemy = createTeam('enemy', 3, { attack: 0, defense: 0, hp: 500, maxHp: 500, troopType: TroopType.ARCHER });

      const result = engine.runFullBattle(ally, enemy);

      expect(result.outcome).toBe(BattleOutcome.VICTORY);
      expect(engine.getSpeedState().speed).toBe(BattleSpeed.X4);
    });

    it('全自动 + 1x应正常工作', () => {
      engine.setBattleMode(BattleMode.AUTO);
      engine.setSpeed(BattleSpeed.X1);

      const ally = createTeam('ally', 3, { attack: 500, defense: 0, troopType: TroopType.ARCHER });
      const enemy = createTeam('enemy', 3, { attack: 0, defense: 0, hp: 500, maxHp: 500, troopType: TroopType.ARCHER });

      const result = engine.runFullBattle(ally, enemy);

      expect(result.outcome).toBe(BattleOutcome.VICTORY);
    });

    it('多次切换模式和速度应正常工作', () => {
      engine.setBattleMode(BattleMode.SEMI_AUTO);
      engine.setSpeed(BattleSpeed.X4);
      engine.setBattleMode(BattleMode.AUTO);
      engine.setSpeed(BattleSpeed.X2);
      engine.setBattleMode(BattleMode.SEMI_AUTO);
      engine.setSpeed(BattleSpeed.X1);

      const ally = createTeam('ally', 1, { attack: 99999, defense: 0, troopType: TroopType.ARCHER });
      const enemy = createTeam('enemy', 1, { attack: 0, defense: 0, hp: 1, maxHp: 1, troopType: TroopType.ARCHER });

      const result = engine.runFullBattle(ally, enemy);

      expect(result.outcome).toBe(BattleOutcome.VICTORY);
      expect(engine.getBattleMode()).toBe(BattleMode.SEMI_AUTO);
      expect(engine.getSpeedState().speed).toBe(BattleSpeed.X1);
    });
  });

  // ── confirmUltimate / cancelUltimate API ──

  describe('confirmUltimate / cancelUltimate API', () => {
    it('confirmUltimate 应委托给大招系统', () => {
      // 不在暂停状态时确认应无效果
      engine.confirmUltimate('unit1', 'skill1');
      expect(engine.isTimeStopPaused()).toBe(false);
    });

    it('cancelUltimate 应委托给大招系统', () => {
      // 不在暂停状态时取消应无效果
      engine.cancelUltimate();
      expect(engine.isTimeStopPaused()).toBe(false);
    });
  });

  // ── 速度持久化 ──

  describe('速度持久化', () => {
    it('速度在多次战斗间应保持', () => {
      engine.setSpeed(BattleSpeed.X4);

      const ally = createTeam('ally', 1, { attack: 99999, defense: 0, troopType: TroopType.ARCHER });
      const enemy = createTeam('enemy', 1, { attack: 0, defense: 0, hp: 1, maxHp: 1, troopType: TroopType.ARCHER });

      engine.runFullBattle(ally, enemy);
      expect(engine.getSpeedState().speed).toBe(BattleSpeed.X4);

      // 第二场战斗
      const ally2 = createTeam('ally', 1, { attack: 99999, defense: 0, troopType: TroopType.ARCHER });
      const enemy2 = createTeam('enemy', 1, { attack: 0, defense: 0, hp: 1, maxHp: 1, troopType: TroopType.ARCHER });

      engine.runFullBattle(ally2, enemy2);
      expect(engine.getSpeedState().speed).toBe(BattleSpeed.X4);
    });
  });
});
