/**
 * NavalMode 海战模式单元测试
 *
 * 覆盖：
 * - 构造函数和初始化
 * - 船只生成和位置
 * - 风向系统
 * - AI 决策和船只移动
 * - 火炮攻击（侧面攻击、射程、冷却）
 * - 碰撞撞击
 * - 胜负判定
 * - 时间限制
 * - 结算
 * - 状态保存/恢复
 * - 重置
 * - 边界条件
 */

import type { BattleModeContext, BattleUnit } from '../../modules/battle/BattleMode';
import {
  NavalMode,
  type NavalConfig,
  type ShipDef,
  type Wind,
} from '../../modules/battle/NavalMode';

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
      attack: 15,
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
  const dealDamageMock = jest.fn().mockReturnValue({ damage: 15, isCrit: false, isMiss: false });
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

/** 基础船只定义 */
const FRIGATE: ShipDef = {
  id: 'frigate',
  name: '护卫舰',
  hp: 100,
  speed: 80,
  turnSpeed: 45,
  cannonDamage: 15,
  cannonRange: 200,
  cannonCooldown: 2000,
  broadsideCount: 3,
  ramDamage: 30,
  size: { width: 40, height: 15 },
};

const GALLEON: ShipDef = {
  id: 'galleon',
  name: '盖伦帆船',
  hp: 150,
  speed: 50,
  turnSpeed: 30,
  cannonDamage: 25,
  cannonRange: 250,
  cannonCooldown: 3000,
  broadsideCount: 5,
  ramDamage: 50,
  size: { width: 60, height: 20 },
};

/** 创建 1v1 场景 */
function create1v1Scenario(options?: {
  wind?: Wind;
  timeLimitMs?: number;
}): { mode: NavalMode; ctx: BattleModeContext; attacker: BattleUnit; defender: BattleUnit } {
  const attacker = createUnit({
    id: 'ally-1',
    name: '护卫舰A',
    side: 'attacker',
    stats: { hp: 100, maxHp: 100, attack: 15, defense: 5, speed: 10, critRate: 0.1, critMultiplier: 2, evasion: 0.05, accuracy: 0.95 },
  });
  const defender = createUnit({
    id: 'enemy-1',
    name: '盖伦帆船D',
    side: 'defender',
    stats: { hp: 150, maxHp: 150, attack: 25, defense: 8, speed: 8, critRate: 0.05, critMultiplier: 1.5, evasion: 0.03, accuracy: 0.9 },
  });
  const ctx = createMockContext({ units: [attacker, defender] });
  const mode = new NavalMode({
    mapWidth: 1200,
    mapHeight: 800,
    wind: options?.wind ?? { direction: 90, speed: 1.0 },
    attackerShips: [FRIGATE],
    defenderShips: [GALLEON],
    timeLimitMs: options?.timeLimitMs ?? 180_000,
  });
  return { mode, ctx, attacker, defender };
}

/** 创建 2v2 场景 */
function create2v2Scenario(): { mode: NavalMode; ctx: BattleModeContext; attackers: BattleUnit[]; defenders: BattleUnit[] } {
  const attackers = [
    createUnit({ id: 'ally-1', name: '护卫舰A', side: 'attacker', stats: { hp: 100, maxHp: 100, attack: 15, defense: 5, speed: 10, critRate: 0.1, critMultiplier: 2, evasion: 0.05, accuracy: 0.95 } }),
    createUnit({ id: 'ally-2', name: '护卫舰B', side: 'attacker', stats: { hp: 90, maxHp: 90, attack: 12, defense: 4, speed: 12, critRate: 0.1, critMultiplier: 1.5, evasion: 0.05, accuracy: 0.9 } }),
  ];
  const defenders = [
    createUnit({ id: 'enemy-1', name: '盖伦帆船A', side: 'defender', stats: { hp: 150, maxHp: 150, attack: 25, defense: 8, speed: 8, critRate: 0.05, critMultiplier: 1.5, evasion: 0.03, accuracy: 0.9 } }),
    createUnit({ id: 'enemy-2', name: '盖伦帆船B', side: 'defender', stats: { hp: 120, maxHp: 120, attack: 20, defense: 6, speed: 10, critRate: 0.1, critMultiplier: 1.5, evasion: 0.05, accuracy: 0.9 } }),
  ];
  const ctx = createMockContext({ units: [...attackers, ...defenders] });
  const mode = new NavalMode({
    mapWidth: 1200,
    mapHeight: 800,
    wind: { direction: 90, speed: 1.0 },
    attackerShips: [FRIGATE, FRIGATE],
    defenderShips: [GALLEON, GALLEON],
    timeLimitMs: 180_000,
  });
  return { mode, ctx, attackers, defenders };
}

// ============================================================
// 测试套件
// ============================================================

describe('NavalMode', () => {

  // ============================================================
  // 构造函数与类型
  // ============================================================

  describe('构造函数', () => {
    it('应正确设置 type 为 naval', () => {
      const mode = new NavalMode();
      expect(mode.type).toBe('naval');
    });

    it('应使用默认配置', () => {
      const mode = new NavalMode();
      const state = mode.getStateData();
      expect(state.timeLimitMs).toBe(180_000);
    });

    it('应接受自定义配置', () => {
      const mode = new NavalMode({ timeLimitMs: 60_000, mapWidth: 1600, mapHeight: 900 });
      const state = mode.getStateData();
      expect(state.timeLimitMs).toBe(60_000);
    });

    it('应注册船只定义', () => {
      const mode = new NavalMode({
        attackerShips: [FRIGATE],
        defenderShips: [GALLEON],
      });
      // 不崩溃即可
      expect(mode.type).toBe('naval');
    });

    it('空配置不应崩溃', () => {
      const mode = new NavalMode({});
      expect(mode.type).toBe('naval');
    });
  });

  // ============================================================
  // init — 初始化
  // ============================================================

  describe('init', () => {
    it('应创建攻方船只', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      const ships = mode.getShips();
      const attackerShips = ships.filter((s) => s.side === 'attacker');
      expect(attackerShips.length).toBe(1);
    });

    it('应创建守方船只', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      const ships = mode.getShips();
      const defenderShips = ships.filter((s) => s.side === 'defender');
      expect(defenderShips.length).toBe(1);
    });

    it('攻方船只应在地图左侧', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      const attackerShip = mode.getShips().find((s) => s.side === 'attacker')!;
      expect(attackerShip.position.x).toBeGreaterThanOrEqual(80);
      expect(attackerShip.position.x).toBeLessThanOrEqual(200);
    });

    it('守方船只应在地图右侧', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      const defenderShip = mode.getShips().find((s) => s.side === 'defender')!;
      expect(defenderShip.position.x).toBeGreaterThanOrEqual(1000);
      expect(defenderShip.position.x).toBeLessThanOrEqual(1120);
    });

    it('攻方船只朝右（0度）', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      const attackerShip = mode.getShips().find((s) => s.side === 'attacker')!;
      expect(attackerShip.rotation).toBe(0);
    });

    it('守方船只朝左（180度）', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      const defenderShip = mode.getShips().find((s) => s.side === 'defender')!;
      expect(defenderShip.rotation).toBe(180);
    });

    it('初始化后阶段应为 running', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      expect(mode.phase).toBe('running');
    });

    it('2v2 场景应创建 4 艘船', () => {
      const { mode, ctx } = create2v2Scenario();
      mode.init(ctx);
      expect(mode.getShips()).toHaveLength(4);
    });

    it('重复 init 应重置状态', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      mode.update(ctx, 1000);
      const elapsedBefore = mode.elapsedMs;
      expect(elapsedBefore).toBeGreaterThan(0);

      mode.init(ctx);
      expect(mode.elapsedMs).toBe(0);
    });

    it('无攻方单位时不应创建攻方船只', () => {
      const defender = createUnit({ id: 'enemy-1', side: 'defender', stats: { hp: 100, maxHp: 100, attack: 15, defense: 5, speed: 10, critRate: 0, critMultiplier: 2, evasion: 0, accuracy: 1 } });
      const ctx = createMockContext({ units: [defender] });
      const mode = new NavalMode({ defenderShips: [GALLEON] });
      mode.init(ctx);
      expect(mode.getAliveShips('attacker')).toHaveLength(0);
    });
  });

  // ============================================================
  // 风向系统
  // ============================================================

  describe('风向系统', () => {
    it('应返回风向', () => {
      const { mode, ctx } = create1v1Scenario({ wind: { direction: 90, speed: 1.5 } });
      mode.init(ctx);
      const wind = mode.getWind();
      expect(wind.direction).toBe(90);
      expect(wind.speed).toBe(1.5);
    });

    it('风向应为副本', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      const w1 = mode.getWind();
      const w2 = mode.getWind();
      expect(w1).toEqual(w2);
      expect(w1).not.toBe(w2);
    });
  });

  // ============================================================
  // update — AI 和移动
  // ============================================================

  describe('update', () => {
    it('finished 阶段不应更新', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      mode['state'].phase = 'finished';
      const elapsedBefore = mode.elapsedMs;
      mode.update(ctx, 100);
      expect(mode.elapsedMs).toBe(elapsedBefore);
    });

    it('应累计时间', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      mode.update(ctx, 100);
      expect(mode.elapsedMs).toBe(100);
    });

    it('速度倍率应影响时间消耗', () => {
      const { mode } = create1v1Scenario();
      const fastCtx = createMockContext({
        units: [createUnit({ id: 'ally-1', side: 'attacker' }), createUnit({ id: 'enemy-1', side: 'defender' })],
        speed: 2,
      });
      mode.init(fastCtx);
      mode.update(fastCtx, 100);
      expect(mode.elapsedMs).toBe(200);
    });

    it('AI 应驱动船只移动', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      const initialPos = { ...mode.getShips().find((s) => s.side === 'attacker')!.position };
      mode.update(ctx, 500);
      const newPos = mode.getShips().find((s) => s.side === 'attacker')!.position;
      // 位置应该有变化（AI 应驱动移动）
      const moved = initialPos.x !== newPos.x || initialPos.y !== newPos.y;
      expect(moved).toBe(true);
    });

    it('多次 update 应正常推进', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      for (let i = 0; i < 10; i++) {
        mode.update(ctx, 100);
      }
      expect(mode.elapsedMs).toBe(1000);
    });
  });

  // ============================================================
  // 火炮攻击
  // ============================================================

  describe('火炮攻击', () => {
    it('船只靠近后应发射火炮', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);

      // 手动将两艘船靠近并设置合适角度
      const attackerShip = mode.getShipsRef().find((s) => s.side === 'attacker')!;
      const defenderShip = mode.getShipsRef().find((s) => s.side === 'defender')!;

      // 攻击方在左，朝右；防守方在右，朝左
      attackerShip.position = { x: 300, y: 400 };
      attackerShip.rotation = 90; // 朝南（侧面朝右方敌人）
      defenderShip.position = { x: 350, y: 400 };
      defenderShip.rotation = 180;

      mode.update(ctx, 200);

      // 应该发射了火炮事件
      expect(ctx.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'action_executed',
          data: expect.objectContaining({ action: 'broadside' }),
        }),
      );
    });

    it('火炮命中应发射 unit_damaged 事件', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);

      const attackerShip = mode.getShipsRef().find((s) => s.side === 'attacker')!;
      const defenderShip = mode.getShipsRef().find((s) => s.side === 'defender')!;

      attackerShip.position = { x: 300, y: 400 };
      attackerShip.rotation = 90;
      defenderShip.position = { x: 350, y: 400 };

      mode.update(ctx, 200);

      expect(ctx.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'unit_damaged',
        }),
      );
    });
  });

  // ============================================================
  // 碰撞撞击
  // ============================================================

  describe('碰撞撞击', () => {
    it('高速碰撞应产生撞击伤害', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);

      const attackerShip = mode.getShipsRef().find((s) => s.side === 'attacker')!;
      const defenderShip = mode.getShipsRef().find((s) => s.side === 'defender')!;

      // 设置两船重叠且高速
      attackerShip.position = { x: 300, y: 400 };
      attackerShip.currentSpeed = 80;
      defenderShip.position = { x: 310, y: 400 };
      defenderShip.currentSpeed = 60;

      mode.update(ctx, 16);

      // 应该产生撞击事件
      expect(ctx.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'unit_damaged',
        }),
      );
    });
  });

  // ============================================================
  // 胜负判定
  // ============================================================

  describe('checkWin / checkLose', () => {
    it('checkWin — 所有防守方沉没时返回 true', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      // 手动击沉所有防守方
      for (const ship of mode.getShipsRef()) {
        if (ship.side === 'defender') {
          ship.isAlive = false;
          ship.currentHp = 0;
        }
      }
      expect(mode.checkWin(ctx)).toBe(true);
    });

    it('checkWin — 防守方存活时返回 false', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      expect(mode.checkWin(ctx)).toBe(false);
    });

    it('checkLose — 所有攻击方沉没时返回 true', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      for (const ship of mode.getShipsRef()) {
        if (ship.side === 'attacker') {
          ship.isAlive = false;
          ship.currentHp = 0;
        }
      }
      expect(mode.checkLose(ctx)).toBe(true);
    });

    it('checkLose — 攻击方存活时返回 false', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      expect(mode.checkLose(ctx)).toBe(false);
    });

    it('胜利后应转为 finished', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      for (const ship of mode.getShipsRef()) {
        if (ship.side === 'defender') {
          ship.isAlive = false;
          ship.currentHp = 0;
        }
      }
      mode.update(ctx, 16);
      expect(mode.phase).toBe('finished');
    });

    it('失败后应转为 finished', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      for (const ship of mode.getShipsRef()) {
        if (ship.side === 'attacker') {
          ship.isAlive = false;
          ship.currentHp = 0;
        }
      }
      mode.update(ctx, 16);
      expect(mode.phase).toBe('finished');
    });
  });

  // ============================================================
  // 时间限制
  // ============================================================

  describe('时间限制', () => {
    it('超时后应转为 finished', () => {
      const { mode, ctx } = create1v1Scenario({ timeLimitMs: 100 });
      mode.init(ctx);
      mode.update(ctx, 200);
      expect(mode.phase).toBe('finished');
    });

    it('超时判负', () => {
      const { mode, ctx } = create1v1Scenario({ timeLimitMs: 100 });
      mode.init(ctx);
      mode.update(ctx, 200);
      const result = mode.settle(ctx, 200);
      expect(result.won).toBe(false);
    });
  });

  // ============================================================
  // 结算
  // ============================================================

  describe('settle', () => {
    it('胜利时应返回 won=true', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      for (const ship of mode.getShipsRef()) {
        if (ship.side === 'defender') {
          ship.isAlive = false;
          ship.currentHp = 0;
        }
      }
      const result = mode.settle(ctx, 5000);
      expect(result.won).toBe(true);
    });

    it('失败时应返回 won=false', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      for (const ship of mode.getShipsRef()) {
        if (ship.side === 'attacker') {
          ship.isAlive = false;
          ship.currentHp = 0;
        }
      }
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
      expect(typeof result.stats.totalDamageTaken).toBe('number');
    });

    it('应计算 MVP', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      for (const ship of mode.getShipsRef()) {
        if (ship.side === 'defender') {
          ship.isAlive = false;
          ship.currentHp = 0;
        }
      }
      const result = mode.settle(ctx, 1000);
      expect(result.mvp).toBeDefined();
    });

    it('无存活船只时 MVP 应为 null', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      for (const ship of mode.getShipsRef()) {
        ship.isAlive = false;
        ship.currentHp = 0;
      }
      const result = mode.settle(ctx, 1000);
      expect(result.mvp).toBeNull();
    });
  });

  // ============================================================
  // 存档/读档
  // ============================================================

  describe('getState / loadState', () => {
    it('序列化后反序列化应恢复状态', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      mode.update(ctx, 500);

      const data = mode.getState();
      const newMode = new NavalMode({
        attackerShips: [FRIGATE],
        defenderShips: [GALLEON],
      });
      newMode.loadState(data);

      const restored = newMode.getState();
      expect(restored.elapsedMs).toBe(data.elapsedMs);
      expect(restored.phase).toBe(data.phase);
    });

    it('应正确序列化船只状态', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      const data = mode.getState();
      const ships = data.ships as unknown[];
      expect(Array.isArray(ships)).toBe(true);
      expect(ships.length).toBe(2);
    });

    it('应正确序列化风向', () => {
      const { mode, ctx } = create1v1Scenario({ wind: { direction: 180, speed: 1.5 } });
      mode.init(ctx);
      const data = mode.getState();
      expect(data.wind).toBeDefined();
      const wind = data.wind as { direction: number; speed: number };
      expect(wind.direction).toBe(180);
      expect(wind.speed).toBe(1.5);
    });

    it('应正确序列化统计数据', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      const state = mode.getState();
      expect(state.totalDamageDealt).toBeDefined();
      expect(state.totalDamageTaken).toBeDefined();
    });

    it('空数据不应崩溃', () => {
      const mode = new NavalMode();
      expect(() => mode.loadState({})).not.toThrow();
    });

    it('null 数据不应崩溃', () => {
      const mode = new NavalMode();
      expect(() => mode.loadState(null as any)).not.toThrow();
    });

    it('应正确恢复撞击冷却', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      const data = mode.getState();
      const newMode = new NavalMode();
      newMode.loadState(data);
      const restored = newMode.getState();
      expect(restored.ramCooldowns).toBeDefined();
    });
  });

  // ============================================================
  // 重置
  // ============================================================

  describe('reset', () => {
    it('应重置所有状态到初始值', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      mode.update(ctx, 500);

      mode.reset();

      expect(mode.elapsedMs).toBe(0);
      expect(mode.phase).toBe('running');
      expect(mode.getShips()).toHaveLength(0);
    });

    it('重置后应能重新初始化', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      mode.reset();
      mode.init(ctx);
      expect(mode.phase).toBe('running');
      expect(mode.getShips()).toHaveLength(2);
    });

    it('重置应清空统计数据', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      mode.reset();
      const state = mode.getState();
      expect(state.totalDamageDealt).toBe(0);
      expect(state.totalDamageTaken).toBe(0);
    });
  });

  // ============================================================
  // 公开访问器
  // ============================================================

  describe('公开访问器', () => {
    it('getAliveShips 应返回存活船只', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      expect(mode.getAliveShips().length).toBe(2);
      expect(mode.getAliveShips('attacker').length).toBe(1);
      expect(mode.getAliveShips('defender').length).toBe(1);
    });

    it('getShips 应返回副本', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      const s1 = mode.getShips();
      const s2 = mode.getShips();
      expect(s1).toEqual(s2);
      expect(s1).not.toBe(s2);
    });

    it('getStateData 应返回状态副本', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      const s1 = mode.getStateData();
      const s2 = mode.getStateData();
      expect(s1).toEqual(s2);
    });

    it('elapsedMs 应返回已过时间', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      expect(mode.elapsedMs).toBe(0);
      mode.update(ctx, 500);
      expect(mode.elapsedMs).toBe(500);
    });
  });

  // ============================================================
  // 边界条件
  // ============================================================

  describe('边界条件', () => {
    it('空队伍应正常处理', () => {
      const mode = new NavalMode();
      const ctx = createMockContext({ units: [] });
      mode.init(ctx);
      expect(() => mode.update(ctx, 16)).not.toThrow();
    });

    it('非常大的 dt 不应崩溃', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      expect(() => mode.update(ctx, 100000)).not.toThrow();
    });

    it('速度倍率为 0 不应崩溃', () => {
      const { mode } = create1v1Scenario();
      const zeroCtx = createMockContext({
        units: [createUnit({ id: 'ally-1', side: 'attacker' }), createUnit({ id: 'enemy-1', side: 'defender' })],
        speed: 0,
      });
      mode.init(zeroCtx);
      expect(() => mode.update(zeroCtx, 16)).not.toThrow();
    });

    it('2v2 场景应正常推进', () => {
      const { mode, ctx } = create2v2Scenario();
      mode.init(ctx);
      for (let i = 0; i < 100; i++) {
        mode.update(ctx, 100);
        if (mode.phase === 'finished') break;
      }
      expect(mode.phase).toBeDefined();
    });

    it('无船只定义时应使用默认值', () => {
      const attacker = createUnit({ id: 'ally-1', side: 'attacker', stats: { hp: 100, maxHp: 100, attack: 15, defense: 5, speed: 10, critRate: 0, critMultiplier: 2, evasion: 0, accuracy: 1 } });
      const defender = createUnit({ id: 'enemy-1', side: 'defender', stats: { hp: 100, maxHp: 100, attack: 15, defense: 5, speed: 10, critRate: 0, critMultiplier: 2, evasion: 0, accuracy: 1 } });
      const ctx = createMockContext({ units: [attacker, defender] });
      const mode = new NavalMode(); // 无船只定义
      mode.init(ctx);
      expect(mode.getShips()).toHaveLength(2);
    });

    it('船只不应超出地图边界', () => {
      const { mode, ctx } = create1v1Scenario();
      mode.init(ctx);
      for (let i = 0; i < 200; i++) {
        mode.update(ctx, 100);
      }
      for (const ship of mode.getShips()) {
        expect(ship.position.x).toBeGreaterThanOrEqual(0);
        expect(ship.position.x).toBeLessThanOrEqual(1200);
        expect(ship.position.y).toBeGreaterThanOrEqual(0);
        expect(ship.position.y).toBeLessThanOrEqual(800);
      }
    });
  });
});
