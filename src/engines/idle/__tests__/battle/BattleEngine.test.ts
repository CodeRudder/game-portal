import { vi } from 'vitest';
/**
 * BattleEngine 单元测试
 *
 * 覆盖战斗引擎框架的所有核心功能：
 * - 构造函数和初始状态
 * - init() 配置解析和单位创建
 * - update() 基本流程
 * - pause/resume
 * - 快速结算 quickSettle()
 * - 存档/读档
 * - 事件发射
 * - 单位查询
 * - 统计数据
 * - reset()
 * - 边界条件
 */

import {
  BattleEngine,
  type BattleConfig,
  type BattleUnitDef,
  type BattleEngineEvent,
  type BattleEngineState,
} from '../../modules/battle/BattleEngine';

// ============================================================
// 测试数据工厂
// ============================================================

/** 创建基础战斗单位定义 */
function createUnitDef(overrides: Partial<BattleUnitDef> = {}): BattleUnitDef {
  return {
    id: 'hero',
    name: '勇者',
    side: 'attacker',
    hp: 100,
    maxHp: 100,
    attack: 30,
    defense: 10,
    speed: 15,
    critRate: 0.1,
    critMultiplier: 1.5,
    evasion: 0.05,
    ...overrides,
  };
}

/** 创建防御方单位定义 */
function createDefenderDef(overrides: Partial<BattleUnitDef> = {}): BattleUnitDef {
  return createUnitDef({
    id: 'goblin',
    name: '哥布林',
    side: 'defender',
    hp: 50,
    maxHp: 50,
    attack: 15,
    defense: 5,
    speed: 10,
    critRate: 0.05,
    critMultiplier: 1.5,
    evasion: 0.02,
    ...overrides,
  });
}

/** 创建基础战斗配置 */
function createBattleConfig(overrides: Partial<BattleConfig> = {}): BattleConfig {
  return {
    mode: 'turn-based',
    attackerUnits: [createUnitDef()],
    defenderUnits: [createDefenderDef()],
    rewards: { gold: 100, exp: 50 },
    maxTurns: 30,
    ...overrides,
  };
}

/** 创建强力的攻击方单位 */
function createStrongAttacker(): BattleUnitDef {
  return createUnitDef({
    id: 'warrior',
    name: '战士',
    attack: 100,
    defense: 50,
    hp: 500,
    maxHp: 500,
    speed: 20,
  });
}

/** 创建弱小的防御方单位 */
function createWeakDefender(): BattleUnitDef {
  return createDefenderDef({
    id: 'slime',
    name: '史莱姆',
    hp: 10,
    maxHp: 10,
    attack: 2,
    defense: 1,
    speed: 1,
  });
}

// ============================================================
// 测试套件
// ============================================================

describe('BattleEngine', () => {
  let engine: BattleEngine;

  beforeEach(() => {
    engine = new BattleEngine();
  });

  // ============================================================
  // 构造函数和初始状态
  // ============================================================

  describe('构造函数和初始状态', () => {
    it('应创建引擎实例', () => {
      expect(engine).toBeInstanceOf(BattleEngine);
    });

    it('初始状态应为 idle', () => {
      expect(engine.getState()).toBe('idle');
    });

    it('初始单位列表应为空', () => {
      expect(engine.getUnits()).toEqual([]);
    });

    it('初始存活单位应为空', () => {
      expect(engine.getAliveUnits()).toEqual([]);
    });

    it('初始结果应为 null', () => {
      expect(engine.getResult()).toBeNull();
    });

    it('初始统计应为全零', () => {
      const stats = engine.getStats();
      expect(stats.totalDamageDealt).toBe(0);
      expect(stats.totalDamageTaken).toBe(0);
      expect(stats.turnsElapsed).toBe(0);
      expect(stats.unitsLost).toBe(0);
      expect(stats.unitsRemaining).toBe(0);
      expect(stats.critCount).toBe(0);
      expect(stats.missCount).toBe(0);
    });
  });

  // ============================================================
  // init() 配置解析和单位创建
  // ============================================================

  describe('init()', () => {
    it('应将状态切换为 running', () => {
      engine.init(createBattleConfig());
      expect(engine.getState()).toBe('running');
    });

    it('应创建正确数量的单位', () => {
      engine.init(createBattleConfig({
        attackerUnits: [createUnitDef(), createUnitDef({ id: 'mage', name: '法师' })],
        defenderUnits: [createDefenderDef()],
      }));
      expect(engine.getUnits().length).toBe(3);
    });

    it('应正确解析单位属性', () => {
      engine.init(createBattleConfig());
      const hero = engine.getUnit('hero');
      expect(hero).toBeDefined();
      expect(hero!.name).toBe('勇者');
      expect(hero!.side).toBe('attacker');
      expect(hero!.currentHp).toBe(100);
      expect(hero!.maxHp).toBe(100);
      expect(hero!.attack).toBe(30);
      expect(hero!.defense).toBe(10);
      expect(hero!.speed).toBe(15);
      expect(hero!.isAlive).toBe(true);
    });

    it('应为每个单位生成唯一 instanceId', () => {
      engine.init(createBattleConfig({
        attackerUnits: [createUnitDef(), createUnitDef({ id: 'hero2' })],
        defenderUnits: [createDefenderDef()],
      }));
      const units = engine.getUnits();
      const ids = units.map((u) => u.instanceId);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('应解析 rewards 配置', () => {
      engine.init(createBattleConfig({ rewards: { gold: 200 } }));
      // rewards 在 quickSettle 中使用 — mock random 确保胜利 (won = random < winRate)
      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
      const result = engine.quickSettle();
      randomSpy.mockRestore();
      expect(result.rewards).toEqual({ gold: 200 });
    });

    it('应解析 maxTurns 配置', () => {
      engine.init(createBattleConfig({ maxTurns: 5 }));
      // maxTurns 在 update 中使用
      expect(engine.getState()).toBe('running');
    });

    it('应触发 battle_started 事件', () => {
      const handler = vi.fn();
      engine.on(handler);
      engine.init(createBattleConfig());
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'battle_started',
          data: expect.objectContaining({
            mode: 'turn-based',
            attackerCount: 1,
            defenderCount: 1,
          }),
        }),
      );
    });

    it('应解析元素属性', () => {
      engine.init(createBattleConfig({
        attackerUnits: [createUnitDef({ element: 'fire' })],
        defenderUnits: [createDefenderDef({ element: 'ice' })],
      }));
      const hero = engine.getUnit('hero');
      expect(hero!.element).toBe('fire');
    });

    it('应解析技能', () => {
      engine.init(createBattleConfig({
        attackerUnits: [createUnitDef({
          skills: [{
            id: 'fireball',
            name: '火球术',
            damage: 50,
            targetMode: 'single',
            element: 'fire',
            cooldown: 3,
            currentCooldown: 0,
            effects: [{ type: 'debuff', stat: 'defense', value: 5, durationMs: 3000 }],
          }],
        })],
        defenderUnits: [createDefenderDef()],
      }));
      const hero = engine.getUnit('hero');
      expect(hero!.skills.length).toBe(1);
      expect(hero!.skills[0].name).toBe('火球术');
      expect(hero!.skills[0].damage).toBe(50);
    });

    it('应解析位置信息', () => {
      engine.init(createBattleConfig({
        attackerUnits: [createUnitDef({ position: { x: 3, y: 5 } })],
        defenderUnits: [createDefenderDef()],
      }));
      const hero = engine.getUnit('hero');
      expect(hero!.position).toEqual({ x: 3, y: 5 });
    });

    it('默认位置应为 {x:0, y:0}', () => {
      engine.init(createBattleConfig());
      const hero = engine.getUnit('hero');
      expect(hero!.position).toEqual({ x: 0, y: 0 });
    });
  });

  // ============================================================
  // update() 基本流程
  // ============================================================

  describe('update()', () => {
    it('idle 状态下 update 应安全无操作', () => {
      expect(() => engine.update(100)).not.toThrow();
    });

    it('running 状态下应推进回合', () => {
      engine.init(createBattleConfig({
        attackerUnits: [createStrongAttacker()],
        defenderUnits: [createWeakDefender()],
      }));
      const handler = vi.fn();
      engine.on(handler);
      // 推进 1000ms（一个回合间隔）
      engine.update(1000);
      // 应触发 turn_started 事件
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'turn_started' }),
      );
    });

    it('应推进 Buff 倒计时', () => {
      engine.init(createBattleConfig());
      const units = (engine as any).units as any[];
      units[0].buffs = [{ id: 'b1', type: 'buff', stat: 'attack', value: 5, remainingMs: 500, sourceUnitId: '' }];
      engine.update(300);
      expect(units[0].buffs[0].remainingMs).toBe(200);
    });

    it('应移除过期 Buff', () => {
      engine.init(createBattleConfig());
      const handler = vi.fn();
      engine.on(handler);
      const units = (engine as any).units as any[];
      units[0].buffs = [{ id: 'b1', type: 'buff', stat: 'attack', value: 5, remainingMs: 100, sourceUnitId: '' }];
      engine.update(200);
      expect(units[0].buffs.length).toBe(0);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'buff_expired' }),
      );
    });

    it('战斗结束时应触发 battle_finished', () => {
      engine.init(createBattleConfig({
        attackerUnits: [createStrongAttacker()],
        defenderUnits: [createWeakDefender()],
      }));
      const handler = vi.fn();
      engine.on(handler);
      // 多次推进直到战斗结束
      for (let i = 0; i < 100; i++) {
        engine.update(1000);
        if (engine.getState() === 'finished') break;
      }
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'battle_finished' }),
      );
    });

    it('paused 状态下 update 应无操作', () => {
      engine.init(createBattleConfig());
      engine.pause();
      const handler = vi.fn();
      engine.on(handler);
      engine.update(1000);
      // 不应触发 turn_started
      expect(handler).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'turn_started' }),
      );
    });

    it('时间限制到达应结束战斗', () => {
      engine.init(createBattleConfig({ timeLimitMs: 500 }));
      engine.update(600);
      expect(engine.getState()).toBe('finished');
    });
  });

  // ============================================================
  // pause / resume
  // ============================================================

  describe('pause / resume', () => {
    it('pause 应将状态切换为 paused', () => {
      engine.init(createBattleConfig());
      engine.pause();
      expect(engine.getState()).toBe('paused');
    });

    it('pause 应触发 battle_paused 事件', () => {
      engine.init(createBattleConfig());
      const handler = vi.fn();
      engine.on(handler);
      engine.pause();
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'battle_paused' }),
      );
    });

    it('resume 应将状态恢复为 running', () => {
      engine.init(createBattleConfig());
      engine.pause();
      engine.resume();
      expect(engine.getState()).toBe('running');
    });

    it('resume 应触发 battle_resumed 事件', () => {
      engine.init(createBattleConfig());
      engine.pause();
      const handler = vi.fn();
      engine.on(handler);
      engine.resume();
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'battle_resumed' }),
      );
    });

    it('idle 状态下 pause 应无操作', () => {
      engine.pause();
      expect(engine.getState()).toBe('idle');
    });

    it('idle 状态下 resume 应无操作', () => {
      engine.resume();
      expect(engine.getState()).toBe('idle');
    });

    it('finished 状态下 resume 应无操作', () => {
      engine.init(createBattleConfig({ timeLimitMs: 1 }));
      engine.update(10);
      expect(engine.getState()).toBe('finished');
      engine.resume();
      expect(engine.getState()).toBe('finished');
    });
  });

  // ============================================================
  // quickSettle()
  // ============================================================

  describe('quickSettle()', () => {
    it('idle 状态应返回失败结果', () => {
      const result = engine.quickSettle();
      expect(result.won).toBe(false);
      expect(result.rewards).toEqual({});
      expect(result.duration).toBe(0);
    });

    it('已初始化应返回有效结果', () => {
      engine.init(createBattleConfig());
      const result = engine.quickSettle();
      expect(result).toHaveProperty('won');
      expect(result).toHaveProperty('rewards');
      expect(result).toHaveProperty('drops');
      expect(result).toHaveProperty('mvp');
      expect(result).toHaveProperty('duration');
      expect(result).toHaveProperty('stats');
    });

    it('胜利时应返回奖励', () => {
      // 使用极端强攻方确保胜利
      const strongAttacker: BattleUnitDef = {
        id: 'dragon', name: '巨龙', side: 'attacker',
        hp: 99999, maxHp: 99999, attack: 99999, defense: 99999,
        speed: 99999, critRate: 1, critMultiplier: 10, evasion: 0,
      };
      const weakDefender: BattleUnitDef = {
        id: 'ant', name: '蚂蚁', side: 'defender',
        hp: 1, maxHp: 1, attack: 1, defense: 0,
        speed: 1, critRate: 0, critMultiplier: 1, evasion: 0,
      };
      engine.init(createBattleConfig({
        attackerUnits: [strongAttacker],
        defenderUnits: [weakDefender],
        rewards: { gold: 500 },
      }));
      const result = engine.quickSettle();
      expect(result.won).toBe(true);
      expect(Object.keys(result.rewards).length).toBeGreaterThan(0);
    });

    it('失败时奖励应为空', () => {
      // 使用极端弱攻方 vs 极端强防方，确保失败
      const weakAttacker: BattleUnitDef = {
        id: 'ant', name: '蚂蚁', side: 'attacker',
        hp: 1, maxHp: 1, attack: 1, defense: 0,
        speed: 1, critRate: 0, critMultiplier: 1, evasion: 0,
      };
      const strongDefender: BattleUnitDef = {
        id: 'dragon', name: '巨龙', side: 'defender',
        hp: 99999, maxHp: 99999, attack: 99999, defense: 99999,
        speed: 99999, critRate: 1, critMultiplier: 10, evasion: 0,
      };
      engine.init(createBattleConfig({
        attackerUnits: [weakAttacker],
        defenderUnits: [strongDefender],
      }));
      const result = engine.quickSettle();
      expect(result.won).toBe(false);
      expect(result.rewards).toEqual({});
    });

    it('应将状态切换为 finished', () => {
      engine.init(createBattleConfig());
      engine.quickSettle();
      expect(engine.getState()).toBe('finished');
    });

    it('应触发 battle_finished 事件', () => {
      engine.init(createBattleConfig());
      const handler = vi.fn();
      engine.on(handler);
      engine.quickSettle();
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'battle_finished' }),
      );
    });

    it('重复调用应返回相同结果', () => {
      engine.init(createBattleConfig());
      const result1 = engine.quickSettle();
      const result2 = engine.quickSettle();
      expect(result1).toEqual(result2);
    });

    it('统计应包含有效数值', () => {
      engine.init(createBattleConfig());
      const result = engine.quickSettle();
      expect(result.stats.turnsElapsed).toBeGreaterThanOrEqual(1);
      expect(typeof result.stats.critCount).toBe('number');
      expect(typeof result.stats.missCount).toBe('number');
    });
  });

  // ============================================================
  // 存档 / 读档
  // ============================================================

  describe('saveState / loadState', () => {
    it('idle 状态存档应返回默认值', () => {
      const data = engine.saveState();
      expect(data.state).toBe('idle');
      expect(data.units).toEqual([]);
    });

    it('序列化后反序列化应恢复状态', () => {
      engine.init(createBattleConfig());
      const saved = engine.saveState();

      const newEngine = new BattleEngine();
      newEngine.loadState(saved);

      expect(newEngine.getState()).toBe('running');
      expect(newEngine.getUnits().length).toBe(2);
    });

    it('应正确保存和恢复单位 HP', () => {
      engine.init(createBattleConfig());
      // 模拟一些伤害
      const units = (engine as any).units as any[];
      units[0].currentHp = 75;
      const saved = engine.saveState();

      const newEngine = new BattleEngine();
      newEngine.loadState(saved);

      const restoredUnits = newEngine.getUnits();
      const hero = restoredUnits.find((u) => u.defId === 'hero');
      expect(hero!.currentHp).toBe(75);
    });

    it('应正确保存和恢复统计', () => {
      engine.init(createBattleConfig());
      (engine as any).stats = {
        totalDamageDealt: 500,
        totalDamageTaken: 200,
        turnsElapsed: 10,
        unitsLost: 1,
        unitsRemaining: 2,
        critCount: 3,
        missCount: 1,
      };
      const saved = engine.saveState();

      const newEngine = new BattleEngine();
      newEngine.loadState(saved);

      const stats = newEngine.getStats();
      expect(stats.totalDamageDealt).toBe(500);
      expect(stats.totalDamageTaken).toBe(200);
      expect(stats.turnsElapsed).toBe(10);
    });

    it('应正确保存和恢复 paused 状态', () => {
      engine.init(createBattleConfig());
      engine.pause();
      const saved = engine.saveState();

      const newEngine = new BattleEngine();
      newEngine.loadState(saved);
      expect(newEngine.getState()).toBe('paused');
    });

    it('应正确保存和恢复 rewards', () => {
      engine.init(createBattleConfig({ rewards: { gold: 300, exp: 100 } }));
      const saved = engine.saveState();

      const newEngine = new BattleEngine();
      newEngine.loadState(saved);
      expect((newEngine as any).rewards).toEqual({ gold: 300, exp: 100 });
    });

    it('loadState 空数据应安全处理', () => {
      expect(() => engine.loadState({})).not.toThrow();
    });

    it('loadState null 数据应安全处理', () => {
      expect(() => engine.loadState(null as any)).not.toThrow();
    });

    it('loadState 应校验非法 state 值', () => {
      engine.loadState({ state: 'invalid_state' });
      expect(engine.getState()).toBe('idle');
    });

    it('loadState 应校验非法 mode 值', () => {
      engine.loadState({ mode: 'invalid_mode' });
      expect((engine as any).mode).toBe('turn-based');
    });
  });

  // ============================================================
  // 事件发射
  // ============================================================

  describe('事件发射', () => {
    it('on 应注册事件监听器', () => {
      const handler = vi.fn();
      engine.on(handler);
      engine.init(createBattleConfig());
      expect(handler).toHaveBeenCalled();
    });

    it('off 应注销事件监听器', () => {
      const handler = vi.fn();
      engine.on(handler);
      engine.off(handler);
      engine.init(createBattleConfig());
      expect(handler).not.toHaveBeenCalled();
    });

    it('注销未注册的监听器应安全无操作', () => {
      const handler = vi.fn();
      expect(() => engine.off(handler)).not.toThrow();
    });

    it('应支持多个监听器', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      engine.on(handler1);
      engine.on(handler2);
      engine.init(createBattleConfig());
      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it('战斗过程中应发射 unit_died 事件', () => {
      engine.init(createBattleConfig({
        attackerUnits: [createStrongAttacker()],
        defenderUnits: [createWeakDefender()],
      }));
      const handler = vi.fn();
      engine.on(handler);
      for (let i = 0; i < 100; i++) {
        engine.update(1000);
        if (engine.getState() === 'finished') break;
      }
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'unit_died' }),
      );
    });
  });

  // ============================================================
  // 单位查询
  // ============================================================

  describe('单位查询', () => {
    beforeEach(() => {
      engine.init(createBattleConfig({
        attackerUnits: [
          createUnitDef(),
          createUnitDef({ id: 'mage', name: '法师', side: 'attacker' }),
        ],
        defenderUnits: [
          createDefenderDef(),
          createDefenderDef({ id: 'skeleton', name: '骷髅兵' }),
        ],
      }));
    });

    it('getUnits 应返回所有单位', () => {
      expect(engine.getUnits().length).toBe(4);
    });

    it('getAliveUnits 应返回所有存活单位', () => {
      expect(engine.getAliveUnits().length).toBe(4);
    });

    it('getAliveUnits(side) 应按阵营过滤', () => {
      expect(engine.getAliveUnits('attacker').length).toBe(2);
      expect(engine.getAliveUnits('defender').length).toBe(2);
    });

    it('getUnit(instanceId) 应返回指定单位', () => {
      const units = engine.getUnits();
      const first = units[0];
      const found = engine.getUnit(first.instanceId);
      expect(found).toBeDefined();
      expect(found!.instanceId).toBe(first.instanceId);
    });

    it('getUnit(defId) 应通过 defId 查找', () => {
      const hero = engine.getUnit('hero');
      expect(hero).toBeDefined();
      expect(hero!.defId).toBe('hero');
    });

    it('getUnit 不存在的 ID 应返回 undefined', () => {
      expect(engine.getUnit('nonexistent')).toBeUndefined();
    });

    it('getUnits 返回的应是副本', () => {
      const units1 = engine.getUnits();
      const units2 = engine.getUnits();
      expect(units1).not.toBe(units2);
    });
  });

  // ============================================================
  // 统计数据
  // ============================================================

  describe('统计数据', () => {
    it('战斗过程中统计应递增', () => {
      engine.init(createBattleConfig({
        attackerUnits: [createStrongAttacker()],
        defenderUnits: [createWeakDefender()],
      }));
      // 推进一些回合
      for (let i = 0; i < 5; i++) {
        engine.update(1000);
      }
      const stats = engine.getStats();
      expect(stats.turnsElapsed).toBeGreaterThan(0);
    });

    it('getStats 返回的应是副本', () => {
      engine.init(createBattleConfig());
      const stats1 = engine.getStats();
      const stats2 = engine.getStats();
      expect(stats1).not.toBe(stats2);
    });
  });

  // ============================================================
  // reset()
  // ============================================================

  describe('reset()', () => {
    it('应将状态重置为 idle', () => {
      engine.init(createBattleConfig());
      engine.reset();
      expect(engine.getState()).toBe('idle');
    });

    it('应清空单位列表', () => {
      engine.init(createBattleConfig());
      engine.reset();
      expect(engine.getUnits()).toEqual([]);
    });

    it('应清空结果', () => {
      engine.init(createBattleConfig());
      engine.quickSettle();
      engine.reset();
      expect(engine.getResult()).toBeNull();
    });

    it('应重置统计', () => {
      engine.init(createBattleConfig());
      engine.quickSettle();
      engine.reset();
      const stats = engine.getStats();
      expect(stats.totalDamageDealt).toBe(0);
      expect(stats.totalDamageTaken).toBe(0);
    });

    it('重置后应能重新 init', () => {
      engine.init(createBattleConfig());
      engine.reset();
      engine.init(createBattleConfig());
      expect(engine.getState()).toBe('running');
      expect(engine.getUnits().length).toBe(2);
    });
  });

  // ============================================================
  // 边界条件
  // ============================================================

  describe('边界条件', () => {
    it('空攻击方队伍应直接失败', () => {
      engine.init(createBattleConfig({
        attackerUnits: [],
        defenderUnits: [createDefenderDef()],
      }));
      // 没有攻击方，update 中会立即判定失败
      engine.update(1000);
      expect(engine.getState()).toBe('finished');
    });

    it('空防御方队伍应直接胜利', () => {
      engine.init(createBattleConfig({
        attackerUnits: [createUnitDef()],
        defenderUnits: [],
      }));
      engine.update(1000);
      expect(engine.getState()).toBe('finished');
      expect(engine.getResult()!.won).toBe(true);
    });

    it('0 血量单位应标记为死亡', () => {
      engine.init(createBattleConfig({
        attackerUnits: [createUnitDef({ hp: 0, maxHp: 100 })],
        defenderUnits: [createDefenderDef()],
      }));
      const hero = engine.getUnit('hero');
      expect(hero!.isAlive).toBe(false);
    });

    it('超大队伍应正常工作', () => {
      const manyAttackers = Array.from({ length: 50 }, (_, i) =>
        createUnitDef({ id: `unit-a-${i}`, name: `攻击方${i}` }),
      );
      const manyDefenders = Array.from({ length: 50 }, (_, i) =>
        createDefenderDef({ id: `unit-d-${i}`, name: `防御方${i}` }),
      );
      engine.init(createBattleConfig({
        attackerUnits: manyAttackers,
        defenderUnits: manyDefenders,
      }));
      expect(engine.getUnits().length).toBe(100);
      expect(engine.getState()).toBe('running');
    });

    it('init 多次调用应重置之前的战斗', () => {
      engine.init(createBattleConfig());
      engine.quickSettle();
      expect(engine.getState()).toBe('finished');

      engine.init(createBattleConfig());
      expect(engine.getState()).toBe('running');
      expect(engine.getResult()).toBeNull();
    });

    it('所有模式类型都应被接受', () => {
      const modes: BattleConfig['mode'][] = [
        'turn-based', 'semi-turn-based', 'free-roam', 'siege',
        'tactical', 'tower-defense', 'naval', 'fighting',
      ];
      for (const mode of modes) {
        engine.reset();
        engine.init(createBattleConfig({ mode }));
        expect(engine.getState()).toBe('running');
      }
    });

    it('无 rewards 配置应正常工作', () => {
      engine.init({
        mode: 'turn-based',
        attackerUnits: [createUnitDef()],
        defenderUnits: [createDefenderDef()],
      });
      expect(engine.getState()).toBe('running');
    });

    it('update(dt=0) 应安全处理', () => {
      engine.init(createBattleConfig());
      expect(() => engine.update(0)).not.toThrow();
    });

    it('update(dt 负数) 应安全处理', () => {
      engine.init(createBattleConfig());
      expect(() => engine.update(-100)).not.toThrow();
    });
  });
});
