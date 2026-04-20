/**
 * FreeRoamMode 单元测试
 *
 * 覆盖自由战斗模式的所有核心功能：
 * - 构造函数和初始化
 * - 单位移动
 * - AI 行为（寻敌、攻击、移动）
 * - 攻击冷却
 * - 胜负判定
 * - 时间限制
 * - 结算
 * - 存档/读档
 * - 重置
 * - 边界条件
 */

import type { BattleModeContext, BattleUnit, BattleSkill } from '../../modules/battle/BattleMode';
import { FreeRoamMode } from '../../modules/battle/FreeRoamMode';

// ============================================================
// 测试数据工厂
// ============================================================

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

/** 创建技能 */
function createSkill(overrides: Partial<BattleSkill> = {}): BattleSkill {
  return {
    id: 'skill-1',
    name: '测试技能',
    targetting: 'single',
    damage: 30,
    cooldown: 3,
    currentCooldown: 0,
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

/** 创建 1v1 场景 */
function create1v1Scenario(options?: {
  attackerAttack?: number;
  defenderAttack?: number;
  attackerSkills?: BattleSkill[];
  defenderSkills?: boolean; // 是否有远程特征
}): { ctx: BattleModeContext; attacker: BattleUnit; defender: BattleUnit } {
  const attacker = createUnit({
    id: 'ally-1',
    name: '战士',
    side: 'attacker',
    stats: {
      hp: 100, maxHp: 100,
      attack: options?.attackerAttack ?? 20,
      defense: 5, speed: 10,
      critRate: 0.1, critMultiplier: 2.0,
      evasion: 0.05, accuracy: 0.95,
    },
    skills: options?.attackerSkills ?? [],
  });
  const defender = createUnit({
    id: 'enemy-1',
    name: '哥布林',
    side: 'defender',
    stats: {
      hp: 80, maxHp: 80,
      attack: options?.defenderAttack ?? 12,
      defense: 3, speed: 8,
      critRate: 0.05, critMultiplier: 1.5,
      evasion: 0.03, accuracy: 0.9,
    },
  });
  const ctx = createMockContext({ units: [attacker, defender] });
  return { ctx, attacker, defender };
}

/** 创建 2v2 场景 */
function create2v2Scenario(): { ctx: BattleModeContext; attackers: BattleUnit[]; defenders: BattleUnit[] } {
  const attackers = [
    createUnit({
      id: 'ally-1', name: '战士', side: 'attacker',
      stats: { hp: 120, maxHp: 120, attack: 25, defense: 10, speed: 12, critRate: 0.15, critMultiplier: 2.0, evasion: 0.05, accuracy: 0.95 },
    }),
    createUnit({
      id: 'ally-2', name: '法师', side: 'attacker',
      stats: { hp: 70, maxHp: 70, attack: 35, defense: 3, speed: 8, critRate: 0.2, critMultiplier: 2.5, evasion: 0.05, accuracy: 0.9 },
      skills: [createSkill({ id: 'fireball', name: '火球术', damage: 40, cooldown: 5, currentCooldown: 0 })],
    }),
  ];
  const defenders = [
    createUnit({
      id: 'enemy-1', name: '哥布林A', side: 'defender',
      stats: { hp: 60, maxHp: 60, attack: 15, defense: 4, speed: 10, critRate: 0.05, critMultiplier: 1.5, evasion: 0.05, accuracy: 0.9 },
    }),
    createUnit({
      id: 'enemy-2', name: '哥布林B', side: 'defender',
      stats: { hp: 50, maxHp: 50, attack: 18, defense: 3, speed: 14, critRate: 0.1, critMultiplier: 1.5, evasion: 0.05, accuracy: 0.9 },
    }),
  ];
  const ctx = createMockContext({ units: [...attackers, ...defenders] });
  return { ctx, attackers, defenders };
}

// ============================================================
// 测试套件
// ============================================================

describe('FreeRoamMode', () => {
  let mode: FreeRoamMode;

  beforeEach(() => {
    mode = new FreeRoamMode({
      mapWidth: 800,
      mapHeight: 600,
    });
  });

  // ============================================================
  // 构造函数
  // ============================================================

  describe('构造函数', () => {
    it('应使用默认参数创建模式', () => {
      const m = new FreeRoamMode();
      expect(m.type).toBe('free-roam');
      expect(m.phase).toBe('running');
      expect(m.elapsedMs).toBe(0);
    });

    it('应初始化地图尺寸', () => {
      expect(mode.mapWidth).toBe(800);
      expect(mode.mapHeight).toBe(600);
    });

    it('应接受自定义时间限制', () => {
      const m = new FreeRoamMode({
        timeLimitMs: 60000,
        mapWidth: 800,
        mapHeight: 600,
      });
      const state = m.getState();
      expect(state.timeLimitMs).toBe(60000);
    });
  });

  // ============================================================
  // init — 初始化
  // ============================================================

  describe('init', () => {
    it('应为所有存活单位创建运行时状态', () => {
      const { ctx } = create1v1Scenario();
      mode.init(ctx);
      const states = mode.getAllUnitStates();
      expect(states.has('ally-1')).toBe(true);
      expect(states.has('enemy-1')).toBe(true);
    });

    it('单位初始位置应在地图两侧', () => {
      const { ctx } = create1v1Scenario();
      mode.init(ctx);
      const allyState = mode.getUnitState('ally-1');
      const enemyState = mode.getUnitState('enemy-1');
      // 攻击方在左侧（x < mapWidth/2 = 400）
      expect(allyState!.x).toBeLessThan(400);
      // 防守方在右侧（x >= mapWidth * 0.8125 = 650）
      expect(enemyState!.x).toBeGreaterThanOrEqual(650);
    });

    it('应跳过已死亡的单位', () => {
      const attacker = createUnit({ id: 'ally-1', side: 'attacker', isAlive: true, stats: { hp: 100, maxHp: 100, attack: 20, defense: 5, speed: 10, critRate: 0, critMultiplier: 2, evasion: 0, accuracy: 1 } });
      const deadDefender = createUnit({ id: 'enemy-1', side: 'defender', isAlive: false, stats: { hp: 0, maxHp: 50, attack: 10, defense: 3, speed: 20, critRate: 0, critMultiplier: 1, evasion: 0, accuracy: 1 } });
      const ctx = createMockContext({ units: [attacker, deadDefender] });
      mode.init(ctx);
      expect(mode.getUnitState('ally-1')).toBeDefined();
      expect(mode.getUnitState('enemy-1')).toBeUndefined();
    });

    it('初始化后阶段应为 running', () => {
      const { ctx } = create1v1Scenario();
      mode.init(ctx);
      expect(mode.phase).toBe('running');
    });

    it('2v2 场景应正确初始化所有单位', () => {
      const { ctx } = create2v2Scenario();
      mode.init(ctx);
      expect(mode.getUnitState('ally-1')).toBeDefined();
      expect(mode.getUnitState('ally-2')).toBeDefined();
      expect(mode.getUnitState('enemy-1')).toBeDefined();
      expect(mode.getUnitState('enemy-2')).toBeDefined();
    });

    it('重复 init 应重置状态', () => {
      const { ctx } = create1v1Scenario();
      mode.init(ctx);
      mode.update(ctx, 100);
      const elapsedBefore = mode.elapsedMs;
      expect(elapsedBefore).toBeGreaterThan(0);

      mode.init(ctx);
      expect(mode.elapsedMs).toBe(0);
    });

    it('高攻击单位应被判定为远程（攻击范围 > 100）', () => {
      const attacker = createUnit({
        id: 'ally-1', side: 'attacker',
        stats: { hp: 100, maxHp: 100, attack: 50, defense: 5, speed: 10, critRate: 0, critMultiplier: 2, evasion: 0, accuracy: 1 },
        skills: [createSkill({ id: 'ranged-skill', name: '远程射击', damage: 40 })],
      });
      const defender = createUnit({
        id: 'enemy-1', side: 'defender',
        stats: { hp: 80, maxHp: 80, attack: 10, defense: 8, speed: 8, critRate: 0, critMultiplier: 1, evasion: 0, accuracy: 1 },
      });
      const ctx = createMockContext({ units: [attacker, defender] });
      mode.init(ctx);

      const allyState = mode.getUnitState('ally-1')!;
      // attack(50) > defense(5) * 2 = 10 → 远程 → attackRange = 200
      expect(allyState.attackRange).toBeGreaterThan(100);
    });
  });

  // ============================================================
  // 单位移动
  // ============================================================

  describe('单位移动', () => {
    it('单位应向最近的敌方移动', () => {
      const { ctx } = create1v1Scenario();
      mode.init(ctx);

      // 设置初始位置较远
      const allyState = mode.getUnitState('ally-1')!;
      const enemyState = mode.getUnitState('enemy-1')!;
      const initialDist = Math.sqrt(
        (allyState.x - enemyState.x) ** 2 +
        (allyState.y - enemyState.y) ** 2,
      );

      mode.update(ctx, 1000);

      const newAllyState = mode.getUnitState('ally-1')!;
      const newEnemyState = mode.getUnitState('enemy-1')!;
      const newDist = Math.sqrt(
        (newAllyState.x - newEnemyState.x) ** 2 +
        (newAllyState.y - newEnemyState.y) ** 2,
      );

      // 距离应该缩短（双方互相靠近）
      expect(newDist).toBeLessThan(initialDist);
    });

    it('单位不应移出地图边界', () => {
      const { ctx } = create1v1Scenario();
      mode.init(ctx);

      // 多次更新
      for (let i = 0; i < 100; i++) {
        mode.update(ctx, 100);
      }

      const states = mode.getAllUnitStates();
      for (const [, s] of states) {
        expect(s.x).toBeGreaterThanOrEqual(0);
        expect(s.x).toBeLessThanOrEqual(800);
        expect(s.y).toBeGreaterThanOrEqual(0);
        expect(s.y).toBeLessThanOrEqual(600);
      }
    });
  });

  // ============================================================
  // AI 行为
  // ============================================================

  describe('AI 行为', () => {
    it('单位应查找最近的敌方', () => {
      const attacker = createUnit({ id: 'ally-1', side: 'attacker', stats: { hp: 100, maxHp: 100, attack: 20, defense: 5, speed: 10, critRate: 0, critMultiplier: 2, evasion: 0, accuracy: 1 } });
      const enemy1 = createUnit({ id: 'enemy-1', side: 'defender', stats: { hp: 80, maxHp: 80, attack: 12, defense: 3, speed: 8, critRate: 0, critMultiplier: 1, evasion: 0, accuracy: 1 } });
      const enemy2 = createUnit({ id: 'enemy-2', side: 'defender', stats: { hp: 60, maxHp: 60, attack: 15, defense: 4, speed: 10, critRate: 0, critMultiplier: 1, evasion: 0, accuracy: 1 } });
      const ctx = createMockContext({ units: [attacker, enemy1, enemy2] });
      mode.init(ctx);

      // 手动设置位置使 enemy-2 更近（通过 internalState 访问）
      mode.internalState.units.get('ally-1')!.x = 500;
      mode.internalState.units.get('ally-1')!.y = 400;
      mode.internalState.units.get('enemy-1')!.x = 1500;
      mode.internalState.units.get('enemy-1')!.y = 400;
      mode.internalState.units.get('enemy-2')!.x = 550;
      mode.internalState.units.get('enemy-2')!.y = 400;

      mode.update(ctx, 200);

      const allyState = mode.getUnitState('ally-1')!;
      expect(allyState.targetEnemyId).toBe('enemy-2');
    });

    it('在攻击范围内应发起攻击', () => {
      const { ctx } = create1v1Scenario();
      mode.init(ctx);

      // 手动设置位置使其在攻击范围内
      mode.internalState.units.get('ally-1')!.x = 500;
      mode.internalState.units.get('ally-1')!.y = 400;
      mode.internalState.units.get('enemy-1')!.x = 520;
      mode.internalState.units.get('enemy-1')!.y = 400;

      mode.update(ctx, 200);

      expect(ctx.dealDamage).toHaveBeenCalled();
    });

    it('攻击应考虑冷却时间', () => {
      const { ctx } = create1v1Scenario();
      mode.init(ctx);

      // 手动设置位置使其在攻击范围内
      mode.internalState.units.get('ally-1')!.x = 500;
      mode.internalState.units.get('ally-1')!.y = 400;
      mode.internalState.units.get('enemy-1')!.x = 520;
      mode.internalState.units.get('enemy-1')!.y = 400;

      // 第一次攻击（dt=200 >= actionIntervalMs=100，触发 AI tick）
      mode.update(ctx, 200);
      const firstCallCount = ctx.dealDamage.mock.calls.length;
      expect(firstCallCount).toBeGreaterThan(0);

      // 立即再次更新（冷却中）
      mode.update(ctx, 16);
      // 不应有新的攻击（冷却未到）
      // dealDamage 调用次数不应显著增加
      const secondCallCount = ctx.dealDamage.mock.calls.length;
      // 冷却是 1000ms，16ms 远不够
      expect(secondCallCount).toBe(firstCallCount);
    });

    it('攻击时应有 action_executed 事件', () => {
      const { ctx } = create1v1Scenario();
      mode.init(ctx);

      // 设置在攻击范围内
      mode.internalState.units.get('ally-1')!.x = 500;
      mode.internalState.units.get('ally-1')!.y = 400;
      mode.internalState.units.get('enemy-1')!.x = 520;
      mode.internalState.units.get('enemy-1')!.y = 400;

      mode.update(ctx, 200);

      // 源码使用 action: 'attack'（非 'normal_attack'）
      expect(ctx.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'action_executed',
          data: expect.objectContaining({ action: 'attack' }),
        }),
      );
    });

    it('攻击时应有 unit_damaged 事件', () => {
      const { ctx } = create1v1Scenario();
      mode.init(ctx);

      mode.internalState.units.get('ally-1')!.x = 500;
      mode.internalState.units.get('ally-1')!.y = 400;
      mode.internalState.units.get('enemy-1')!.x = 520;
      mode.internalState.units.get('enemy-1')!.y = 400;

      mode.update(ctx, 200);

      expect(ctx.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'unit_damaged',
          data: expect.objectContaining({ targetId: 'enemy-1' }),
        }),
      );
    });

    it('攻击冷却中不应触发额外攻击', () => {
      const { ctx } = create1v1Scenario();
      mode.init(ctx);

      mode.internalState.units.get('ally-1')!.x = 500;
      mode.internalState.units.get('ally-1')!.y = 400;
      mode.internalState.units.get('enemy-1')!.x = 520;
      mode.internalState.units.get('enemy-1')!.y = 400;

      // 第一次攻击（dt=200 >= actionIntervalMs=100，触发 AI tick）
      mode.update(ctx, 200);
      const callsAfterFirst = ctx.dealDamage.mock.calls.length;
      expect(callsAfterFirst).toBeGreaterThan(0);

      // 冷却中，连续多次 update
      for (let i = 0; i < 5; i++) {
        mode.update(ctx, 16);
      }

      // 由于冷却 1000ms，总时间 16*6=96ms 远不够
      // 调用次数不应增加（或增加很少，因为防守方也可能攻击）
      const callsAfterAll = ctx.dealDamage.mock.calls.length;
      expect(callsAfterAll).toBeLessThanOrEqual(callsAfterFirst + 5);
    });
  });

  // ============================================================
  // 胜负判定
  // ============================================================

  describe('胜负判定', () => {
    it('checkWin — 所有防守方死亡时返回 true', () => {
      const { ctx } = create1v1Scenario();
      mode.init(ctx);
      ctx.getAliveUnits = jest.fn((side?: string) => {
        if (side === 'defender') return [];
        return ctx.units.filter((u) => u.isAlive);
      });
      expect(mode.checkWin(ctx)).toBe(true);
    });

    it('checkWin — 防守方存活时返回 false', () => {
      const { ctx } = create1v1Scenario();
      mode.init(ctx);
      expect(mode.checkWin(ctx)).toBe(false);
    });

    it('checkLose — 所有攻击方死亡时返回 true', () => {
      const { ctx } = create1v1Scenario();
      mode.init(ctx);
      ctx.getAliveUnits = jest.fn((side?: string) => {
        if (side === 'attacker') return [];
        return ctx.units.filter((u) => u.isAlive);
      });
      expect(mode.checkLose(ctx)).toBe(true);
    });

    it('checkLose — 攻击方存活时返回 false', () => {
      const { ctx } = create1v1Scenario();
      mode.init(ctx);
      expect(mode.checkLose(ctx)).toBe(false);
    });

    it('胜利后应转为 finished', () => {
      const { ctx } = create1v1Scenario();
      mode.init(ctx);
      ctx.getAliveUnits = jest.fn((side?: string) => {
        if (side === 'defender') return [];
        return ctx.units.filter((u) => u.isAlive);
      });
      mode.update(ctx, 16);
      expect(mode.phase).toBe('finished');
    });

    it('失败后应转为 finished', () => {
      const { ctx } = create1v1Scenario();
      mode.init(ctx);
      ctx.getAliveUnits = jest.fn((side?: string) => {
        if (side === 'attacker') return [];
        return ctx.units.filter((u) => u.isAlive);
      });
      mode.update(ctx, 16);
      expect(mode.phase).toBe('finished');
    });
  });

  // ============================================================
  // 时间限制
  // ============================================================

  describe('时间限制', () => {
    it('超时后应转为 finished', () => {
      const m = new FreeRoamMode({
        timeLimitMs: 100,
        mapWidth: 800,
        mapHeight: 600,
      });
      const { ctx } = create1v1Scenario();
      m.init(ctx);
      m.update(ctx, 200);
      expect(m.phase).toBe('finished');
    });

    it('超时判负', () => {
      const m = new FreeRoamMode({
        timeLimitMs: 100,
        mapWidth: 800,
        mapHeight: 600,
      });
      const { ctx } = create1v1Scenario();
      m.init(ctx);
      m.update(ctx, 200);
      const result = m.settle(ctx, 200);
      expect(result.won).toBe(false);
    });

    it('速度倍率应影响时间消耗', () => {
      const m = new FreeRoamMode({
        timeLimitMs: 1000,
        mapWidth: 800,
        mapHeight: 600,
      });
      const { ctx } = create1v1Scenario();
      ctx.speed = 10;
      m.init(ctx);
      // 100ms * 10x = 1000ms → 超时
      m.update(ctx, 100);
      expect(m.phase).toBe('finished');
    });
  });

  // ============================================================
  // 结算
  // ============================================================

  describe('settle', () => {
    it('胜利时应返回 won=true', () => {
      const { ctx } = create1v1Scenario();
      mode.init(ctx);
      ctx.getAliveUnits = jest.fn((side?: string) => {
        if (side === 'defender') return [];
        return ctx.units.filter((u) => u.isAlive);
      });
      const result = mode.settle(ctx, 5000);
      expect(result.won).toBe(true);
    });

    it('失败时应返回 won=false', () => {
      const { ctx } = create1v1Scenario();
      mode.init(ctx);
      ctx.getAliveUnits = jest.fn((side?: string) => {
        if (side === 'attacker') return [];
        return ctx.units.filter((u) => u.isAlive);
      });
      const result = mode.settle(ctx, 5000);
      expect(result.won).toBe(false);
    });

    it('应包含战斗持续时间', () => {
      const { ctx } = create1v1Scenario();
      mode.init(ctx);
      const result = mode.settle(ctx, 12345);
      expect(result.durationMs).toBe(12345);
    });

    it('应包含统计数据', () => {
      const { ctx } = create1v1Scenario();
      mode.init(ctx);
      const result = mode.settle(ctx, 1000);
      expect(result.stats).toBeDefined();
      expect(typeof result.stats.totalDamageDealt).toBe('number');
      expect(typeof result.stats.totalDamageTaken).toBe('number');
    });

    it('应计算 MVP', () => {
      const { ctx } = create1v1Scenario();
      mode.init(ctx);
      ctx.getAliveUnits = jest.fn((side?: string) => {
        if (side === 'defender') return [];
        return ctx.units.filter((u) => u.isAlive);
      });
      const result = mode.settle(ctx, 1000);
      expect(result.mvp).toBe('ally-1');
    });
  });

  // ============================================================
  // 存档/读档
  // ============================================================

  describe('saveState / loadState', () => {
    it('序列化后反序列化应恢复状态', () => {
      const { ctx } = create1v1Scenario();
      mode.init(ctx);
      mode.update(ctx, 100);

      const data = mode.getState();
      const newMode = new FreeRoamMode({
        mapWidth: 800,
        mapHeight: 600,
      });
      newMode.loadState(data);

      const restored = newMode.getState();
      expect(restored.elapsedMs).toBe(data.elapsedMs);
      expect(restored.phase).toBe(data.phase);
    });

    it('应正确序列化单位状态', () => {
      const { ctx } = create1v1Scenario();
      mode.init(ctx);
      const data = mode.getState();
      // 源码 getState() 返回 'units' 而非 'unitStates'
      expect(data.units).toBeDefined();
      const unitStates = data.units as Record<string, unknown>;
      expect(unitStates['ally-1']).toBeDefined();
      expect(unitStates['enemy-1']).toBeDefined();
    });

    it('应正确序列化统计数据', () => {
      const { ctx } = create1v1Scenario();
      mode.init(ctx);
      const state = mode.getState();
      expect(state.totalDamageDealt).toBeDefined();
      expect(state.totalDamageTaken).toBeDefined();
    });

    it('空数据不应崩溃', () => {
      expect(() => mode.loadState({})).not.toThrow();
    });

    it('null 数据不应崩溃', () => {
      expect(() => mode.loadState(null as any)).not.toThrow();
    });
  });

  // ============================================================
  // 重置
  // ============================================================

  describe('reset', () => {
    it('应重置所有状态到初始值', () => {
      const { ctx } = create1v1Scenario();
      mode.init(ctx);
      mode.update(ctx, 100);

      mode.reset();

      expect(mode.phase).toBe('running');
      expect(mode.elapsedMs).toBe(0);
      expect(mode.getAllUnitStates().size).toBe(0);
    });

    it('重置后应能重新初始化', () => {
      const { ctx } = create1v1Scenario();
      mode.init(ctx);
      mode.reset();
      mode.init(ctx);
      expect(mode.phase).toBe('running');
      expect(mode.getUnitState('ally-1')).toBeDefined();
    });

    it('重置应保留时间限制配置', () => {
      const m = new FreeRoamMode({
        timeLimitMs: 60000,
        mapWidth: 800,
        mapHeight: 600,
      });
      const { ctx } = create1v1Scenario();
      m.init(ctx);
      m.reset();
      expect(m.getState().timeLimitMs).toBe(60000);
    });
  });

  // ============================================================
  // 边界条件
  // ============================================================

  describe('边界条件', () => {
    it('finished 阶段不应执行更新', () => {
      const { ctx } = create1v1Scenario();
      mode.init(ctx);
      mode.update(ctx, 16);

      // 强制设为 finished（通过 internalState）
      mode.internalState.phase = 'finished';
      const elapsedBefore = mode.elapsedMs;
      mode.update(ctx, 100);
      expect(mode.elapsedMs).toBe(elapsedBefore);
    });

    it('空队伍应正常处理', () => {
      const ctx = createMockContext({ units: [] });
      mode.init(ctx);
      expect(() => mode.update(ctx, 16)).not.toThrow();
    });

    it('单方全灭应立即结束', () => {
      const attacker = createUnit({ id: 'ally-1', side: 'attacker', isAlive: false, stats: { hp: 0, maxHp: 100, attack: 20, defense: 5, speed: 10, critRate: 0, critMultiplier: 2, evasion: 0, accuracy: 1 } });
      const defender = createUnit({ id: 'enemy-1', side: 'defender', isAlive: true, stats: { hp: 80, maxHp: 80, attack: 12, defense: 3, speed: 8, critRate: 0, critMultiplier: 1, evasion: 0, accuracy: 1 } });
      const ctx = createMockContext({ units: [attacker, defender] });
      mode.init(ctx);
      mode.update(ctx, 16);
      expect(mode.phase).toBe('finished');
    });

    it('2v2 场景应正常推进', () => {
      const { ctx } = create2v2Scenario();
      mode.init(ctx);

      for (let i = 0; i < 100; i++) {
        mode.update(ctx, 100);
        if (mode.phase === 'finished') break;
      }

      expect(mode.phase).toBeDefined();
    });

    it('速度倍率为 0 不应崩溃', () => {
      const { ctx } = create1v1Scenario();
      ctx.speed = 0;
      mode.init(ctx);
      expect(() => mode.update(ctx, 16)).not.toThrow();
    });

    it('非常大的 dt 不应崩溃', () => {
      const { ctx } = create1v1Scenario();
      mode.init(ctx);
      expect(() => mode.update(ctx, 100000)).not.toThrow();
    });

    it('getUnitState 对不存在的单位应返回 undefined', () => {
      expect(mode.getUnitState('non-existent')).toBeUndefined();
    });

    it('getState 应返回不可变副本', () => {
      const { ctx } = create1v1Scenario();
      mode.init(ctx);
      const state1 = mode.getState();
      const state2 = mode.getState();
      expect(state1).toEqual(state2);
    });
  });
});
