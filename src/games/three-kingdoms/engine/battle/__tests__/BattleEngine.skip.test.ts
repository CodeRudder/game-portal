/**
 * BattleEngine — 跳过战斗功能测试（Plan #49）
 *
 * 覆盖：
 * - skipBattle：对进行中的战斗直接计算结果
 * - quickBattle：初始化 + 跳过，一步完成
 * - SKIP 速度档位：BattleSpeed.SKIP = 0
 * - SKIP 模式下的速度状态属性
 * - SKIP 不参与 cycleSpeed 循环
 * - skipBattle 对已结束战斗的处理
 * - isSkipMode 检测
 * - reset 清除 SKIP 状态
 *
 * @module engine/battle/__tests__/BattleEngine.skip
 */

import { BattleEngine } from '../BattleEngine';
import type {
  BattleTeam,
  BattleUnit,
  BattleSkill,
  BattleState,
} from '../battle.types';
import {
  BATTLE_CONFIG,
  BattleMode,
  BattleOutcome,
  BattlePhase,
  BattleSpeed,
  StarRating,
  TroopType,
} from '../battle.types';
import { BattleSpeedController } from '../BattleSpeedController';

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

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('BattleEngine — 跳过战斗 (Plan #49)', () => {
  let engine: BattleEngine;

  beforeEach(() => {
    engine = new BattleEngine();
  });

  // ── skipBattle 基础功能 ──

  describe('skipBattle', () => {
    it('应直接完成战斗并返回结果', () => {
      const ally = createTeam('ally', 3, {
        attack: 500,
        defense: 0,
        troopType: TroopType.ARCHER,
      });
      const enemy = createTeam('enemy', 3, {
        attack: 0,
        defense: 0,
        hp: 500,
        maxHp: 500,
        troopType: TroopType.ARCHER,
      });

      const state = engine.initBattle(ally, enemy);
      const result = engine.skipBattle(state);

      expect(result).toBeDefined();
      expect(result.outcome).toBe(BattleOutcome.VICTORY);
      expect(state.phase).toBe(BattlePhase.FINISHED);
    });

    it('战斗结束后状态应正确', () => {
      const ally = createTeam('ally', 6, {
        attack: 99999,
        defense: 0,
        troopType: TroopType.ARCHER,
      });
      const enemy = createTeam('enemy', 1, {
        attack: 0,
        defense: 0,
        hp: 1,
        maxHp: 1,
        troopType: TroopType.ARCHER,
      });

      const state = engine.initBattle(ally, enemy);
      const result = engine.skipBattle(state);

      expect(state.phase).toBe(BattlePhase.FINISHED);
      expect(state.result).toBe(result);
      expect(state.currentTurn).toBeGreaterThanOrEqual(1);
    });

    it('对已结束的战斗应直接返回结果', () => {
      const ally = createTeam('ally', 1, {
        attack: 99999,
        defense: 0,
        troopType: TroopType.ARCHER,
      });
      const enemy = createTeam('enemy', 1, {
        attack: 0,
        defense: 0,
        hp: 1,
        maxHp: 1,
        troopType: TroopType.ARCHER,
      });

      // 先正常完成战斗
      const result1 = engine.runFullBattle(ally, enemy);

      // 用相同队伍再打一次，模拟已结束状态
      const state = engine.initBattle(ally, enemy);
      // 手动标记为已结束
      state.phase = BattlePhase.FINISHED;
      state.result = result1;

      const result2 = engine.skipBattle(state);
      expect(result2.outcome).toBe(result1.outcome);
    });

    it('skipBattle 后速度应为 SKIP', () => {
      const ally = createTeam('ally', 1, {
        attack: 99999,
        defense: 0,
        troopType: TroopType.ARCHER,
      });
      const enemy = createTeam('enemy', 1, {
        attack: 0,
        defense: 0,
        hp: 1,
        maxHp: 1,
        troopType: TroopType.ARCHER,
      });

      const state = engine.initBattle(ally, enemy);
      engine.skipBattle(state);

      expect(engine.getSpeedState().speed).toBe(BattleSpeed.SKIP);
    });

    it('skipBattle 应产生完整的行动日志', () => {
      const ally = createTeam('ally', 2, {
        attack: 200,
        defense: 0,
        troopType: TroopType.ARCHER,
      });
      const enemy = createTeam('enemy', 2, {
        attack: 100,
        defense: 0,
        hp: 500,
        maxHp: 500,
        troopType: TroopType.ARCHER,
      });

      const state = engine.initBattle(ally, enemy);
      engine.skipBattle(state);

      // 应有行动记录
      expect(state.actionLog.length).toBeGreaterThan(0);
    });

    it('skipBattle 结果应与 runFullBattle 一致（相同胜负）', () => {
      // 使用确定性数据，确保逻辑结果一致
      const ally = createTeam('ally', 6, {
        attack: 500,
        defense: 200,
        hp: 5000,
        maxHp: 5000,
        troopType: TroopType.ARCHER,
      });
      const enemy = createTeam('enemy', 3, {
        attack: 50,
        defense: 20,
        hp: 500,
        maxHp: 500,
        troopType: TroopType.ARCHER,
      });

      // 正常战斗
      const normalEngine = new BattleEngine();
      const normalResult = normalEngine.runFullBattle(
        { units: ally.units.map(u => ({ ...u })) , side: 'ally' },
        { units: enemy.units.map(u => ({ ...u })) , side: 'enemy' },
      );

      // 跳过战斗
      const skipResult = engine.skipBattle(
        engine.initBattle(
          { units: ally.units.map(u => ({ ...u })) , side: 'ally' },
          { units: enemy.units.map(u => ({ ...u })) , side: 'enemy' },
        ),
      );

      // 胜负应一致
      expect(skipResult.outcome).toBe(normalResult.outcome);
    });
  });

  // ── quickBattle 便捷方法 ──

  describe('quickBattle', () => {
    it('应一步完成战斗', () => {
      const ally = createTeam('ally', 3, {
        attack: 500,
        defense: 0,
        troopType: TroopType.ARCHER,
      });
      const enemy = createTeam('enemy', 3, {
        attack: 0,
        defense: 0,
        hp: 500,
        maxHp: 500,
        troopType: TroopType.ARCHER,
      });

      const result = engine.quickBattle(ally, enemy);

      expect(result).toBeDefined();
      expect(result.outcome).toBe(BattleOutcome.VICTORY);
      expect(result.totalTurns).toBeGreaterThanOrEqual(1);
    });

    it('quickBattle 应设置 SKIP 速度', () => {
      const ally = createTeam('ally', 1, {
        attack: 99999,
        defense: 0,
        troopType: TroopType.ARCHER,
      });
      const enemy = createTeam('enemy', 1, {
        attack: 0,
        defense: 0,
        hp: 1,
        maxHp: 1,
        troopType: TroopType.ARCHER,
      });

      engine.quickBattle(ally, enemy);
      expect(engine.getSpeedState().speed).toBe(BattleSpeed.SKIP);
    });

    it('quickBattle 星级评定应正常', () => {
      const ally = createTeam('ally', 6, {
        attack: 99999,
        defense: 0,
        troopType: TroopType.ARCHER,
      });
      const enemy = createTeam('enemy', 1, {
        attack: 0,
        defense: 0,
        hp: 1,
        maxHp: 1,
        troopType: TroopType.ARCHER,
      });

      const result = engine.quickBattle(ally, enemy);

      expect(result.outcome).toBe(BattleOutcome.VICTORY);
      expect(result.stars).toBe(StarRating.THREE);
    });
  });

  // ── isSkipMode ──

  describe('isSkipMode', () => {
    it('默认不应在 SKIP 模式', () => {
      expect(engine.isSkipMode()).toBe(false);
    });

    it('设置 SKIP 速度后应在 SKIP 模式', () => {
      engine.setSpeed(BattleSpeed.SKIP);
      expect(engine.isSkipMode()).toBe(true);
    });

    it('skipBattle 后应在 SKIP 模式', () => {
      const ally = createTeam('ally', 1, {
        attack: 99999,
        defense: 0,
        troopType: TroopType.ARCHER,
      });
      const enemy = createTeam('enemy', 1, {
        attack: 0,
        defense: 0,
        hp: 1,
        maxHp: 1,
        troopType: TroopType.ARCHER,
      });

      const state = engine.initBattle(ally, enemy);
      engine.skipBattle(state);

      expect(engine.isSkipMode()).toBe(true);
    });

    it('reset 后应退出 SKIP 模式', () => {
      engine.setSpeed(BattleSpeed.SKIP);
      expect(engine.isSkipMode()).toBe(true);

      engine.reset();
      expect(engine.isSkipMode()).toBe(false);
      expect(engine.getSpeedState().speed).toBe(BattleSpeed.X1);
    });
  });

  // ── BattleSpeed.SKIP 枚举值 ──

  describe('BattleSpeed.SKIP', () => {
    it('SKIP 值应为 0', () => {
      expect(BattleSpeed.SKIP).toBe(0);
    });

    it('SKIP 应是有效的速度档位', () => {
      expect(BattleSpeedController.isValidSpeed(BattleSpeed.SKIP)).toBe(true);
    });

    it('应能通过 setSpeed 设置 SKIP', () => {
      engine.setSpeed(BattleSpeed.SKIP);
      expect(engine.getSpeedState().speed).toBe(BattleSpeed.SKIP);
    });
  });

  // ── SKIP 速度状态属性 ──

  describe('SKIP 速度状态属性', () => {
    let controller: BattleSpeedController;

    beforeEach(() => {
      controller = new BattleSpeedController();
    });

    it('SKIP 模式回合间隔应为 0', () => {
      controller.setSpeed(BattleSpeed.SKIP);
      expect(controller.getAdjustedTurnInterval()).toBe(0);
    });

    it('SKIP 模式动画速度应为 Infinity', () => {
      controller.setSpeed(BattleSpeed.SKIP);
      expect(controller.getAnimationSpeedScale()).toBe(Infinity);
    });

    it('SKIP 模式应强制简化特效', () => {
      controller.setSpeed(BattleSpeed.SKIP);
      expect(controller.shouldSimplifyEffects()).toBe(true);
    });

    it('SKIP 模式间隔缩放系数应为 0', () => {
      controller.setSpeed(BattleSpeed.SKIP);
      expect(controller.getTurnIntervalScale()).toBe(0);
    });

    it('SKIP 模式应正确序列化', () => {
      controller.setSpeed(BattleSpeed.SKIP);
      const serialized = controller.serialize();

      expect(serialized.speed).toBe(BattleSpeed.SKIP);
      expect(serialized.turnIntervalScale).toBe(0);
      expect(serialized.animationSpeedScale).toBe(Infinity);
      expect(serialized.simplifiedEffects).toBe(true);
    });

    it('SKIP 模式应正确反序列化', () => {
      controller.setSpeed(BattleSpeed.SKIP);
      const serialized = controller.serialize();

      const newController = new BattleSpeedController();
      newController.deserialize(serialized);

      expect(newController.getSpeed()).toBe(BattleSpeed.SKIP);
      expect(newController.getAdjustedTurnInterval()).toBe(0);
      expect(newController.shouldSimplifyEffects()).toBe(true);
    });
  });

  // ── SKIP 与 cycleSpeed ──

  describe('SKIP 与 cycleSpeed', () => {
    it('SKIP 不参与 cycleSpeed 循环', () => {
      const controller = new BattleSpeedController();
      controller.setSpeed(BattleSpeed.SKIP);

      // 从 SKIP 循环应回到 X1
      const next = controller.cycleSpeed();
      expect(next).toBe(BattleSpeed.X1);
    });

    it('正常循环不应包含 SKIP', () => {
      const controller = new BattleSpeedController();

      // 循环 1x → 2x → 4x → 1x，不应出现 SKIP
      const speeds: BattleSpeed[] = [];
      for (let i = 0; i < 4; i++) {
        speeds.push(controller.cycleSpeed());
      }

      expect(speeds).toEqual([
        BattleSpeed.X2,
        BattleSpeed.X4,
        BattleSpeed.X1,
        BattleSpeed.X2,
      ]);
    });
  });

  // ── SKIP 监听器 ──

  describe('SKIP 监听器', () => {
    it('切换到 SKIP 应触发监听器', () => {
      const controller = new BattleSpeedController();
      const listener = { onSpeedChange: vi.fn() };
      controller.addListener(listener);

      controller.setSpeed(BattleSpeed.SKIP);

      expect(listener.onSpeedChange).toHaveBeenCalledTimes(1);
    });

    it('SKIP 变更事件应正确', () => {
      const controller = new BattleSpeedController();
      const listener = { onSpeedChange: vi.fn() };
      controller.addListener(listener);

      controller.setSpeed(BattleSpeed.SKIP);

      const event = listener.onSpeedChange.mock.calls[0][0];
      expect(event.previousSpeed).toBe(BattleSpeed.X1);
      expect(event.newSpeed).toBe(BattleSpeed.SKIP);
    });
  });

  // ── 中途跳过 ──

  describe('中途跳过战斗', () => {
    it('执行几回合后跳过应正常完成', () => {
      const ally = createTeam('ally', 3, {
        attack: 300,
        defense: 50,
        hp: 3000,
        maxHp: 3000,
        troopType: TroopType.ARCHER,
      });
      const enemy = createTeam('enemy', 3, {
        attack: 100,
        defense: 30,
        hp: 1000,
        maxHp: 1000,
        troopType: TroopType.ARCHER,
      });

      const state = engine.initBattle(ally, enemy);

      // 执行2个回合
      engine.executeTurn(state);
      state.currentTurn++;
      engine.executeTurn(state);
      state.currentTurn++;

      expect(state.phase).toBe(BattlePhase.IN_PROGRESS);
      const turnBeforeSkip = state.currentTurn;

      // 跳过剩余战斗
      const result = engine.skipBattle(state);

      expect(state.phase).toBe(BattlePhase.FINISHED);
      expect(result.totalTurns).toBeGreaterThanOrEqual(turnBeforeSkip);
      expect(result).toBeDefined();
    });
  });

  // ── reset 清理 ──

  describe('reset 清理 SKIP 状态', () => {
    it('reset 后速度应回到 X1', () => {
      engine.setSpeed(BattleSpeed.SKIP);
      expect(engine.isSkipMode()).toBe(true);

      engine.reset();

      expect(engine.isSkipMode()).toBe(false);
      expect(engine.getSpeedState().speed).toBe(BattleSpeed.X1);
      expect(engine.getAdjustedTurnInterval()).toBe(1000);
    });
  });
});
