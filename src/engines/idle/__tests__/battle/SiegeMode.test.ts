/**
 * SiegeMode 单元测试
 *
 * 覆盖攻城战战斗模式的所有核心功能：
 * - 构造函数与初始化
 * - 行动顺序和回合推进
 * - 攻击方攻城行为（攻击城墙/城门/敌方）
 * - 箭塔攻击
 * - 士气溃逃胜负
 * - 胜负判定
 * - 结算
 * - 存档/读档
 * - 重置
 * - 边界条件
 */

import type { BattleModeContext, BattleUnit, BattleSkill, DamageOutput } from '../../modules/battle';
import { SiegeMode, type SiegeModeOptions } from '../../modules/battle/SiegeMode';
import type { SiegeConfig } from '../../modules/battle/SiegeSystem';

// ============================================================
// 测试数据工厂
// ============================================================

/** 创建默认攻城配置 */
function createDefaultSiegeConfig(overrides?: Partial<SiegeConfig>): SiegeConfig {
  return {
    walls: [
      { id: 'wall-n', position: { x: 5, y: 0 }, maxHp: 200, defense: 10, type: 'wall' },
      { id: 'tower-nw', position: { x: 0, y: 0 }, maxHp: 300, defense: 15, type: 'tower' },
    ],
    gate: { maxHp: 150, defense: 5 },
    initialMorale: { attacker: 80, defender: 90 },
    moraleThreshold: 20,
    towerDamage: 15,
    towerRange: 3,
    ...overrides,
  };
}

/** 创建战斗单位 */
function createUnit(overrides: Partial<BattleUnit> = {}): BattleUnit {
  return {
    id: 'unit-1',
    name: '测试单位',
    side: 'attacker',
    stats: {
      hp: 100,
      maxHp: 100,
      attack: 20,
      defense: 5,
      speed: 10,
      critRate: 0.1,
      critMultiplier: 2.0,
      evasion: 0.05,
      accuracy: 0.95,
    },
    skills: [],
    buffs: [],
    isAlive: true,
    ...overrides,
  };
}

/** 创建 Mock 上下文 */
function createMockContext(overrides?: {
  units?: BattleUnit[];
  speed?: number;
}): BattleModeContext {
  const units = overrides?.units ?? [];
  const dealDamageMock = jest.fn().mockReturnValue({ damage: 20, isCrit: false, isMiss: false });
  const healMock = jest.fn();
  const addBuffMock = jest.fn();
  const removeBuffMock = jest.fn();
  const emitMock = jest.fn();

  return {
    units,
    getUnit: jest.fn((id: string) => units.find((u) => u.id === id)),
    dealDamage: dealDamageMock,
    heal: healMock,
    addBuff: addBuffMock,
    removeBuff: removeBuffMock,
    getAliveUnits: jest.fn((side?: 'attacker' | 'defender') => {
      if (side) return units.filter((u) => u.isAlive && u.side === side);
      return units.filter((u) => u.isAlive);
    }),
    emit: emitMock,
    speed: overrides?.speed ?? 1,
  };
}

/** 创建攻城模式 */
function createSiegeMode(overrides?: Partial<SiegeModeOptions>): SiegeMode {
  return new SiegeMode({
    maxTurns: overrides?.maxTurns ?? 40,
    actionDelayMs: overrides?.actionDelayMs ?? 0,
    siegeConfig: overrides?.siegeConfig ?? createDefaultSiegeConfig(),
  });
}

/** 创建 1v1 攻城场景 */
function create1v1Scenario(options?: {
  attackerSpeed?: number;
  defenderSpeed?: number;
  siegeConfig?: Partial<SiegeConfig>;
}): { mode: SiegeMode; ctx: BattleModeContext; attacker: BattleUnit; defender: BattleUnit } {
  const attacker = createUnit({
    id: 'ally-1',
    name: '攻城兵',
    side: 'attacker',
    stats: {
      hp: 100,
      maxHp: 100,
      attack: 20,
      defense: 5,
      speed: options?.attackerSpeed ?? 15,
      critRate: 0.1,
      critMultiplier: 2.0,
      evasion: 0.05,
      accuracy: 0.95,
    },
  });
  const defender = createUnit({
    id: 'enemy-1',
    name: '守城兵',
    side: 'defender',
    stats: {
      hp: 80,
      maxHp: 80,
      attack: 12,
      defense: 3,
      speed: options?.defenderSpeed ?? 8,
      critRate: 0.05,
      critMultiplier: 1.5,
      evasion: 0.03,
      accuracy: 0.9,
    },
  });
  const ctx = createMockContext({ units: [attacker, defender] });
  const mode = createSiegeMode({
    siegeConfig: options?.siegeConfig ?? createDefaultSiegeConfig(),
    actionDelayMs: 0,
  });
  return { mode, ctx, attacker, defender };
}

/** 创建 2v2 攻城场景 */
function create2v2Scenario(): {
  mode: SiegeMode;
  ctx: BattleModeContext;
  attackers: BattleUnit[];
  defenders: BattleUnit[];
} {
  const attackers = [
    createUnit({
      id: 'ally-1',
      name: '攻城兵A',
      side: 'attacker',
      stats: { hp: 120, maxHp: 120, attack: 25, defense: 10, speed: 12, critRate: 0.15, critMultiplier: 2.0, evasion: 0.05, accuracy: 0.95 },
    }),
    createUnit({
      id: 'ally-2',
      name: '攻城兵B',
      side: 'attacker',
      stats: { hp: 80, maxHp: 80, attack: 18, defense: 5, speed: 8, critRate: 0.1, critMultiplier: 1.5, evasion: 0.05, accuracy: 0.9 },
    }),
  ];
  const defenders = [
    createUnit({
      id: 'enemy-1',
      name: '守城兵A',
      side: 'defender',
      stats: { hp: 100, maxHp: 100, attack: 15, defense: 8, speed: 10, critRate: 0.05, critMultiplier: 1.5, evasion: 0.05, accuracy: 0.9 },
    }),
    createUnit({
      id: 'enemy-2',
      name: '守城兵B',
      side: 'defender',
      stats: { hp: 90, maxHp: 90, attack: 20, defense: 6, speed: 14, critRate: 0.1, critMultiplier: 1.5, evasion: 0.05, accuracy: 0.9 },
    }),
  ];
  const ctx = createMockContext({ units: [...attackers, ...defenders] });
  const mode = createSiegeMode({ actionDelayMs: 0 });
  return { mode, ctx, attackers, defenders };
}

// ============================================================
// 测试套件
// ============================================================

describe('SiegeMode', () => {

  // ============================================================
  // 构造函数与类型
  // ============================================================

  describe('构造函数', () => {
    it('应正确设置 type 为 siege', () => {
      const mode = createSiegeMode();
      expect(mode.type).toBe('siege');
    });

    it('初始阶段应为 waiting', () => {
      const mode = createSiegeMode();
      expect(mode.phase).toBe('waiting');
    });

    it('应接受自定义回合上限', () => {
      const mode = createSiegeMode({ maxTurns: 50 });
      const state = mode.getState();
      expect(state.maxTurns).toBe(50);
    });

    it('应接受自定义行动延迟', () => {
      const mode = createSiegeMode({ actionDelayMs: 1000 });
      const state = mode.getState();
      expect(state.actionDelayMs).toBe(1000);
    });

    it('应创建内部 SiegeSystem 实例', () => {
      const mode = createSiegeMode();
      const siegeSystem = mode.getSiegeSystem();
      expect(siegeSystem).toBeDefined();
      expect(siegeSystem.getWalls()).toHaveLength(2);
    });
  });

  // ============================================================
  // init — 初始化
  // ============================================================

  describe('init', () => {
    it('应按速度降序生成行动顺序', () => {
      const { mode, ctx } = create1v1Scenario({ attackerSpeed: 15, defenderSpeed: 8 });
      mode.init(ctx);
      expect(mode.turnOrder).toEqual(['ally-1', 'enemy-1']);
    });

    it('速度高的防守方应排前面', () => {
      const { mode, ctx } = create1v1Scenario({ attackerSpeed: 5, defenderSpeed: 20 });
      mode.init(ctx);
      expect(mode.turnOrder).toEqual(['enemy-1', 'ally-1']);
    });

    it('初始阶段应为 acting', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      expect(mode.phase).toBe('acting');
    });

    it('回合数应从 1 开始', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      expect(mode.turnCount).toBe(1);
    });

    it('应发射 turn_started 事件', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      expect(ctx.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'turn_started',
        }),
      );
    });

    it('应重置攻城系统', () => {
      const { mode, ctx } = create1v1Scenario();
      // 先破坏城墙
      mode.init(ctx);
      mode.getSiegeSystem().damageWall('wall-n', 50);
      // 重新初始化
      mode.init(ctx);
      expect(mode.getSiegeSystem().getWall('wall-n')!.currentHp).toBe(200);
    });
  });

  // ============================================================
  // update — 回合推进
  // ============================================================

  describe('update', () => {
    it('waiting 阶段不应执行行动', () => {
      const { mode, ctx } = create1v1Scenario();
      // 不调用 init
      mode.update(ctx, 100);
      expect(ctx.dealDamage).not.toHaveBeenCalled();
    });

    it('finished 阶段不应执行行动', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      mode['state'].phase = 'finished';
      mode.update(ctx, 100);
      expect(ctx.dealDamage).not.toHaveBeenCalled();
    });

    it('actionDelayMs 为 0 时应立即行动', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      mode.update(ctx, 16);
      // 攻击方应攻击城门或城墙
      expect(ctx.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'action_executed',
        }),
      );
    });

    it('未到行动延迟时间不应行动', () => {
      const modeWithDelay = createSiegeMode({ actionDelayMs: 1000 });
      const { ctx } = create1v1Scenario();
      modeWithDelay.init(ctx);
      modeWithDelay.update(ctx, 100);
      expect(ctx.dealDamage).not.toHaveBeenCalled();
    });

    it('速度倍率应影响行动延迟', () => {
      const modeWithDelay = createSiegeMode({ actionDelayMs: 1000 });
      const { ctx } = create1v1Scenario();
      ctx.speed = 4;
      modeWithDelay.init(ctx);
      // 250ms * 4x = 1000ms
      modeWithDelay.update(ctx, 250);
      expect(ctx.dealDamage).toHaveBeenCalled();
    });
  });

  // ============================================================
  // 攻击方行为
  // ============================================================

  describe('攻击方行为', () => {
    it('攻击方初始应攻击城门', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      mode.update(ctx, 16);
      // 攻击方行动应发射 action_executed
      expect(ctx.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'action_executed',
          data: expect.objectContaining({ action: 'attack_gate' }),
        }),
      );
    });

    it('城门被破坏后攻方应直接攻击守方（城门缺口算突破口）', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      // 破坏城门
      mode.getSiegeSystem().damageGate(500);
      mode.update(ctx, 16);
      // 城门被破坏算作突破口，攻方应直接攻击守方
      expect(ctx.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'action_executed',
          data: expect.objectContaining({ action: 'normal_attack' }),
        }),
      );
    });

    it('城墙和城门都破坏后应攻击敌方', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      // 破坏城门和城墙
      mode.getSiegeSystem().damageGate(500);
      mode.getSiegeSystem().damageWall('wall-n', 500);
      mode.update(ctx, 16);
      // 攻击方应攻击敌方
      expect(ctx.dealDamage).toHaveBeenCalled();
    });

    it('攻击方有技能时应使用技能攻击敌方', () => {
      const skill: BattleSkill = {
        id: 'skill-1',
        name: '攻城锤',
        targetting: 'single',
        damage: 40,
        cooldown: 0,
        currentCooldown: 0,
      };
      const attacker = createUnit({
        id: 'ally-1',
        side: 'attacker',
        skills: [skill],
        stats: { hp: 100, maxHp: 100, attack: 20, defense: 5, speed: 15, critRate: 0, critMultiplier: 2, evasion: 0, accuracy: 1 },
      });
      const defender = createUnit({
        id: 'enemy-1',
        side: 'defender',
        stats: { hp: 80, maxHp: 80, attack: 12, defense: 3, speed: 8, critRate: 0, critMultiplier: 1.5, evasion: 0, accuracy: 1 },
      });
      const ctx = createMockContext({ units: [attacker, defender] });
      const mode = createSiegeMode({ actionDelayMs: 0 });
      mode.init(ctx);

      // 破坏城门和城墙让攻击方直接攻击敌方
      mode.getSiegeSystem().damageGate(500);
      mode.getSiegeSystem().damageWall('wall-n', 500);

      mode.update(ctx, 16);
      expect(ctx.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'skill_used',
        }),
      );
    });
  });

  // ============================================================
  // 防守方行为
  // ============================================================

  describe('防守方行为', () => {
    it('防守方应攻击攻方单位', () => {
      const { mode, ctx } = create1v1Scenario({ attackerSpeed: 5, defenderSpeed: 20 });
      mode.init(ctx);
      mode.update(ctx, 16);
      // 防守方先行动，应攻击攻方
      expect(ctx.dealDamage).toHaveBeenCalledWith('enemy-1', 'ally-1');
    });
  });

  // ============================================================
  // 胜负判定
  // ============================================================

  describe('checkWin / checkLose', () => {
    it('checkWin — 所有防守方死亡时返回 true', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      ctx.getAliveUnits = jest.fn((side?: string) => {
        if (side === 'defender') return [];
        return ctx.units.filter((u) => u.isAlive);
      });
      expect(mode.checkWin(ctx)).toBe(true);
    });

    it('checkWin — 防守方士气溃逃时返回 true', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      // 降低防守方士气到溃逃
      mode.getSiegeSystem().modifyMorale('defender', -75, '大败'); // 90 - 75 = 15 < 20
      mode.getSiegeSystem().updateMorale();
      expect(mode.checkWin(ctx)).toBe(true);
    });

    it('checkWin — 防守方存活且士气正常时返回 false', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      expect(mode.checkWin(ctx)).toBe(false);
    });

    it('checkLose — 所有攻击方死亡时返回 true', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      ctx.getAliveUnits = jest.fn((side?: string) => {
        if (side === 'attacker') return [];
        return ctx.units.filter((u) => u.isAlive);
      });
      expect(mode.checkLose(ctx)).toBe(true);
    });

    it('checkLose — 攻击方士气溃逃时返回 true', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      mode.getSiegeSystem().modifyMorale('attacker', -65, '大败'); // 80 - 65 = 15 < 20
      mode.getSiegeSystem().updateMorale();
      expect(mode.checkLose(ctx)).toBe(true);
    });

    it('超过回合上限应判负', () => {
      const modeLowLimit = createSiegeMode({ maxTurns: 2, actionDelayMs: 0 });
      const { ctx } = create1v1Scenario();
      modeLowLimit.init(ctx);

      // 模拟多次更新直到超过回合上限
      for (let i = 0; i < 20; i++) {
        modeLowLimit.update(ctx, 16);
        if (modeLowLimit.phase === 'finished') break;
      }

      expect(modeLowLimit.phase).toBe('finished');
    });

    it('胜利后应转为 finished', () => {
      const { mode, ctx, defender } = create1v1Scenario();
      mode.init(ctx);
      defender.isAlive = false;
      ctx.getAliveUnits = jest.fn((side?: string) => {
        if (side === 'defender') return [];
        return ctx.units.filter((u) => u.isAlive);
      });
      mode.update(ctx, 16);
      expect(mode.phase).toBe('finished');
    });

    it('失败后应转为 finished', () => {
      const { mode, ctx, attacker } = create1v1Scenario();
      mode.init(ctx);
      attacker.isAlive = false;
      ctx.getAliveUnits = jest.fn((side?: string) => {
        if (side === 'attacker') return [];
        return ctx.units.filter((u) => u.isAlive);
      });
      mode.update(ctx, 16);
      expect(mode.phase).toBe('finished');
    });
  });

  // ============================================================
  // 结算
  // ============================================================

  describe('settle', () => {
    it('胜利时应返回 won=true', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      ctx.getAliveUnits = jest.fn((side?: string) => {
        if (side === 'defender') return [];
        return ctx.units.filter((u) => u.isAlive);
      });
      const result = mode.settle(ctx, 5000);
      expect(result.won).toBe(true);
    });

    it('失败时应返回 won=false', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      ctx.getAliveUnits = jest.fn((side?: string) => {
        if (side === 'attacker') return [];
        return ctx.units.filter((u) => u.isAlive);
      });
      const result = mode.settle(ctx, 5000);
      expect(result.won).toBe(false);
    });

    it('应包含战斗持续时间', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      const result = mode.settle(ctx, 12345);
      expect(result.durationMs).toBe(12345);
    });

    it('应包含统计数据', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      const result = mode.settle(ctx, 1000);
      expect(result.stats).toBeDefined();
      expect(typeof result.stats.totalDamageDealt).toBe('number');
    });

    it('应计算 MVP', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      const result = mode.settle(ctx, 1000);
      expect(result.mvp).toBeDefined();
    });
  });

  // ============================================================
  // 存档/读档
  // ============================================================

  describe('getState / loadState', () => {
    it('序列化后反序列化应恢复状态', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      mode.update(ctx, 16);

      const data = mode.getState();
      const newMode = createSiegeMode({ actionDelayMs: 0 });
      newMode.loadState(data);

      const restored = newMode.getState();
      expect(restored.turnOrder).toEqual(data.turnOrder);
      expect(restored.turnCount).toBe(data.turnCount);
      expect(restored.phase).toBe(data.phase);
    });

    it('应正确序列化攻城系统状态', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      mode.getSiegeSystem().damageWall('wall-n', 50);

      const data = mode.getState();
      const siegeData = data.siegeSystem as Record<string, unknown>;
      expect(siegeData).toBeDefined();
    });

    it('空数据不应崩溃', () => {
      const mode = createSiegeMode();
      expect(() => mode.loadState({})).not.toThrow();
    });

    it('null 数据不应崩溃', () => {
      const mode = createSiegeMode();
      expect(() => mode.loadState(null as any)).not.toThrow();
    });

    it('应正确序列化回合顺序', () => {
      const { mode, ctx } = create2v2Scenario();
      mode.init(ctx);
      const state = mode.getState();
      expect(Array.isArray(state.turnOrder)).toBe(true);
      expect(state.turnOrder!.length).toBe(4);
    });

    it('恢复后攻城系统状态应一致', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      mode.getSiegeSystem().damageWall('wall-n', 50);

      const data = mode.getState();
      const newMode = createSiegeMode({ actionDelayMs: 0 });
      newMode.loadState(data);

      expect(newMode.getSiegeSystem().getWall('wall-n')!.currentHp).toBe(160); // 200 - (50-10) = 160
    });
  });

  // ============================================================
  // 重置
  // ============================================================

  describe('reset', () => {
    it('应重置所有状态到初始值', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      mode.update(ctx, 16);

      mode.reset();

      expect(mode.phase).toBe('waiting');
      expect(mode.turnOrder).toEqual([]);
      expect(mode.turnCount).toBe(1);
      expect(mode.currentTurnIndex).toBe(0);
    });

    it('应重置攻城系统', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      mode.getSiegeSystem().damageWall('wall-n', 50);
      mode.reset();
      expect(mode.getSiegeSystem().getWall('wall-n')!.currentHp).toBe(200);
    });

    it('重置后应能重新初始化', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      mode.reset();
      mode.init(ctx);
      expect(mode.phase).toBe('acting');
      expect(mode.turnOrder.length).toBe(2);
    });

    it('重置应保留 maxTurns 配置', () => {
      const mode = createSiegeMode({ maxTurns: 50, actionDelayMs: 0 });
      const { ctx } = create1v1Scenario();
      mode.init(ctx);
      mode.reset();
      expect(mode.getState().maxTurns).toBe(50);
    });
  });

  // ============================================================
  // 边界条件
  // ============================================================

  describe('边界条件', () => {
    it('2v2 场景应正常工作', () => {
      const { mode, ctx } = create2v2Scenario();
      mode.init(ctx);
      expect(mode.turnOrder).toHaveLength(4);
      mode.update(ctx, 16);
      // 不应崩溃
    });

    it('空队伍应正常处理', () => {
      const mode = createSiegeMode({ actionDelayMs: 0 });
      const ctx = createMockContext({ units: [] });
      mode.init(ctx);
      expect(mode.turnOrder).toEqual([]);
      expect(() => mode.update(ctx, 16)).not.toThrow();
    });

    it('单方全灭应立即结束', () => {
      const attacker = createUnit({ id: 'ally-1', side: 'attacker', isAlive: false, stats: { hp: 0, maxHp: 100, attack: 20, defense: 5, speed: 10, critRate: 0, critMultiplier: 2, evasion: 0, accuracy: 1 } });
      const defender = createUnit({ id: 'enemy-1', side: 'defender', isAlive: true, stats: { hp: 80, maxHp: 80, attack: 12, defense: 3, speed: 8, critRate: 0, critMultiplier: 1, evasion: 0, accuracy: 1 } });
      const ctx = createMockContext({ units: [attacker, defender] });
      const mode = createSiegeMode({ actionDelayMs: 0 });
      mode.init(ctx);
      expect(mode.checkLose(ctx)).toBe(true);
    });

    it('当前行动单位已死亡应跳过', () => {
      const { mode, ctx, attacker } = create1v1Scenario();
      mode.init(ctx);
      attacker.isAlive = false;
      attacker.stats.hp = 0;
      ctx.getAliveUnits = jest.fn((side?: string) => {
        const units = ctx.units.filter((u) => u.isAlive);
        if (side) return units.filter((u) => u.side === side);
        return units;
      });
      expect(() => mode.update(ctx, 16)).not.toThrow();
    });

    it('多次 update 不应重复行动（延迟控制）', () => {
      const modeWithDelay = createSiegeMode({ actionDelayMs: 1000 });
      const { ctx } = create1v1Scenario();
      modeWithDelay.init(ctx);

      for (let i = 0; i < 10; i++) {
        modeWithDelay.update(ctx, 10);
      }
      // 总共 100ms < 1000ms，不应行动
      expect(ctx.dealDamage).not.toHaveBeenCalled();
    });

    it('getSiegeSystem 应返回有效的 SiegeSystem', () => {
      const mode = createSiegeMode();
      const siege = mode.getSiegeSystem();
      expect(siege.getWalls()).toHaveLength(2);
      expect(siege.getMorale().attackerMorale).toBe(80);
    });
  });
});
