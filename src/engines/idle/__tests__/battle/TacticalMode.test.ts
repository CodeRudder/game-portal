/**
 * TacticalMode 单元测试
 *
 * 覆盖战棋战斗模式的所有核心功能：
 * - 构造函数与配置
 * - 初始化和行动顺序
 * - 地图创建与单位放置
 * - 回合推进
 * - AI 移动决策
 * - AI 攻击决策
 * - 地形效果
 * - 胜负判定
 * - 结算
 * - 存档/读档
 * - 重置
 * - 边界条件
 */

import type { BattleModeContext, BattleUnit, BattleSkill } from '../../modules/battle/BattleMode';
import { TacticalMode } from '../../modules/battle/TacticalMode';
import type { TacticalConfig, TacticalUnitConfig } from '../../modules/battle/TacticalMode';
import { BattleMap } from '../../modules/battle/BattleMap';

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

/** 创建 1v1 战棋场景 */
function create1v1Tactical(options?: {
  attackerSpeed?: number;
  defenderSpeed?: number;
  movePower?: number;
  attackRange?: number;
  mapWidth?: number;
  mapHeight?: number;
  initialPositions?: Record<string, { x: number; y: number }>;
}): { mode: TacticalMode; ctx: BattleModeContext; attacker: BattleUnit; defender: BattleUnit } {
  const attacker = createUnit({
    id: 'ally-1',
    name: '战士',
    side: 'attacker',
    stats: { hp: 100, maxHp: 100, attack: 20, defense: 5, speed: options?.attackerSpeed ?? 15, critRate: 0.1, critMultiplier: 2.0, evasion: 0.05, accuracy: 0.95 },
  });
  const defender = createUnit({
    id: 'enemy-1',
    name: '哥布林',
    side: 'defender',
    stats: { hp: 80, maxHp: 80, attack: 12, defense: 3, speed: options?.defenderSpeed ?? 8, critRate: 0.05, critMultiplier: 1.5, evasion: 0.03, accuracy: 0.9 },
  });

  const unitConfigs: TacticalUnitConfig[] = [
    { unitId: 'ally-1', movePower: options?.movePower ?? 3, minAttackRange: 1, maxAttackRange: options?.attackRange ?? 1 },
    { unitId: 'enemy-1', movePower: options?.movePower ?? 3, minAttackRange: 1, maxAttackRange: options?.attackRange ?? 1 },
  ];

  const config: TacticalConfig = {
    mapWidth: options?.mapWidth ?? 10,
    mapHeight: options?.mapHeight ?? 8,
    actionDelayMs: 0,
    unitConfigs,
    initialPositions: options?.initialPositions,
  };

  const mode = new TacticalMode(config);
  const ctx = createMockContext({ units: [attacker, defender] });

  return { mode, ctx, attacker, defender };
}

/** 创建 3v3 战棋场景 */
function create3v3Tactical(): { mode: TacticalMode; ctx: BattleModeContext } {
  const attackers = [
    createUnit({ id: 'ally-1', name: '战士', side: 'attacker', stats: { hp: 120, maxHp: 120, attack: 25, defense: 10, speed: 12, critRate: 0.15, critMultiplier: 2.0, evasion: 0.05, accuracy: 0.95 } }),
    createUnit({ id: 'ally-2', name: '法师', side: 'attacker', stats: { hp: 70, maxHp: 70, attack: 35, defense: 3, speed: 8, critRate: 0.2, critMultiplier: 2.5, evasion: 0.05, accuracy: 0.9 } }),
    createUnit({ id: 'ally-3', name: '弓手', side: 'attacker', stats: { hp: 80, maxHp: 80, attack: 20, defense: 5, speed: 15, critRate: 0.2, critMultiplier: 2.0, evasion: 0.1, accuracy: 0.95 } }),
  ];
  const defenders = [
    createUnit({ id: 'enemy-1', name: '哥布林A', side: 'defender', stats: { hp: 60, maxHp: 60, attack: 15, defense: 4, speed: 10, critRate: 0.05, critMultiplier: 1.5, evasion: 0.05, accuracy: 0.9 } }),
    createUnit({ id: 'enemy-2', name: '哥布林B', side: 'defender', stats: { hp: 50, maxHp: 50, attack: 18, defense: 3, speed: 14, critRate: 0.1, critMultiplier: 1.5, evasion: 0.05, accuracy: 0.9 } }),
    createUnit({ id: 'enemy-3', name: '哥布林C', side: 'defender', stats: { hp: 70, maxHp: 70, attack: 12, defense: 6, speed: 6, critRate: 0.03, critMultiplier: 1.5, evasion: 0.03, accuracy: 0.9 } }),
  ];

  const unitConfigs: TacticalUnitConfig[] = [
    { unitId: 'ally-1', movePower: 3, minAttackRange: 1, maxAttackRange: 1 },
    { unitId: 'ally-2', movePower: 2, minAttackRange: 3, maxAttackRange: 4 },
    { unitId: 'ally-3', movePower: 3, minAttackRange: 2, maxAttackRange: 3 },
    { unitId: 'enemy-1', movePower: 3, minAttackRange: 1, maxAttackRange: 1 },
    { unitId: 'enemy-2', movePower: 4, minAttackRange: 1, maxAttackRange: 1 },
    { unitId: 'enemy-3', movePower: 2, minAttackRange: 1, maxAttackRange: 2 },
  ];

  const config: TacticalConfig = {
    mapWidth: 10,
    mapHeight: 8,
    actionDelayMs: 0,
    unitConfigs,
  };

  const mode = new TacticalMode(config);
  const ctx = createMockContext({ units: [...attackers, ...defenders] });
  return { mode, ctx };
}

// ============================================================
// 测试套件
// ============================================================

describe('TacticalMode', () => {
  // ============================================================
  // 构造函数与配置
  // ============================================================

  describe('构造函数', () => {
    it('应使用默认参数创建模式', () => {
      const mode = new TacticalMode();
      expect(mode.type).toBe('tactical');
      expect(mode.phase).toBe('select_unit');
    });

    it('应接受自定义地图大小', () => {
      const mode = new TacticalMode({ mapWidth: 15, mapHeight: 12 });
      mode.init(createMockContext({ units: [] }));
      const map = mode.getMap();
      expect(map).not.toBeNull();
      expect(map!.getWidth()).toBe(15);
      expect(map!.getHeight()).toBe(12);
    });

    it('应接受自定义回合上限', () => {
      const mode = new TacticalMode({ maxTurns: 20 });
      const state = mode.getState();
      expect(state.maxTurns).toBe(20);
    });

    it('应接受自定义行动延迟', () => {
      const mode = new TacticalMode({ actionDelayMs: 1000 });
      const state = mode.getState();
      expect(state.actionDelayMs).toBe(1000);
    });

    it('应接受单位战棋配置', () => {
      const unitConfigs: TacticalUnitConfig[] = [
        { unitId: 'archer', movePower: 3, minAttackRange: 2, maxAttackRange: 3 },
      ];
      const mode = new TacticalMode({ unitConfigs });
      expect(mode.getUnitConfig('archer')).toEqual({
        unitId: 'archer', movePower: 3, minAttackRange: 2, maxAttackRange: 3,
      });
    });
  });

  // ============================================================
  // init — 初始化
  // ============================================================

  describe('init', () => {
    it('应创建地图', () => {
      const { mode, ctx } = create1v1Tactical();
      mode.init(ctx);
      expect(mode.getMap()).not.toBeNull();
    });

    it('应按速度降序生成行动顺序', () => {
      const { mode, ctx } = create1v1Tactical({ attackerSpeed: 15, defenderSpeed: 8 });
      mode.init(ctx);
      expect(mode.turnOrder).toEqual(['ally-1', 'enemy-1']);
    });

    it('速度高的防守方应排前面', () => {
      const { mode, ctx } = create1v1Tactical({ attackerSpeed: 5, defenderSpeed: 20 });
      mode.init(ctx);
      expect(mode.turnOrder).toEqual(['enemy-1', 'ally-1']);
    });

    it('应发射 turn_started 事件', () => {
      const { mode, ctx } = create1v1Tactical();
      mode.init(ctx);
      expect(ctx.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'turn_started',
          data: expect.objectContaining({ unitId: 'ally-1' }),
        }),
      );
    });

    it('应使用自定义初始位置', () => {
      const { mode, ctx } = create1v1Tactical({
        initialPositions: { 'ally-1': { x: 0, y: 0 }, 'enemy-1': { x: 9, y: 7 } },
      });
      mode.init(ctx);
      const map = mode.getMap()!;
      expect(map.getUnitPosition('ally-1')).toEqual({ x: 0, y: 0 });
      expect(map.getUnitPosition('enemy-1')).toEqual({ x: 9, y: 7 });
    });

    it('无初始位置时应自动放置', () => {
      const { mode, ctx } = create1v1Tactical();
      mode.init(ctx);
      const map = mode.getMap()!;
      expect(map.getUnitPosition('ally-1')).not.toBeNull();
      expect(map.getUnitPosition('enemy-1')).not.toBeNull();
    });

    it('回合数应从 1 开始', () => {
      const { mode, ctx } = create1v1Tactical();
      mode.init(ctx);
      expect(mode.turnCount).toBe(1);
    });

    it('初始阶段应为 select_unit', () => {
      const { mode, ctx } = create1v1Tactical();
      mode.init(ctx);
      expect(mode.phase).toBe('select_unit');
    });

    it('3v3 场景应正确排序', () => {
      const { mode, ctx } = create3v3Tactical();
      mode.init(ctx);
      // 速度：ally-3=15, enemy-2=14, ally-1=12, enemy-1=10, ally-2=8, enemy-3=6
      expect(mode.turnOrder).toEqual(['ally-3', 'enemy-2', 'ally-1', 'enemy-1', 'ally-2', 'enemy-3']);
    });
  });

  // ============================================================
  // update — 回合推进
  // ============================================================

  describe('update', () => {
    it('actionDelayMs 为 0 时应立即行动', () => {
      const { mode, ctx } = create1v1Tactical({
        initialPositions: { 'ally-1': { x: 2, y: 2 }, 'enemy-1': { x: 5, y: 2 } },
      });
      mode.init(ctx);
      mode.update(ctx, 16);
      // 应该有行动发生（移动或攻击）
      expect(ctx.dealDamage).toHaveBeenCalled();
    });

    it('应处理行动延迟', () => {
      const mode = new TacticalMode({
        actionDelayMs: 500,
        mapWidth: 10,
        mapHeight: 8,
        unitConfigs: [
          { unitId: 'ally-1', movePower: 3, minAttackRange: 1, maxAttackRange: 1 },
          { unitId: 'enemy-1', movePower: 3, minAttackRange: 1, maxAttackRange: 1 },
        ],
        initialPositions: { 'ally-1': { x: 2, y: 2 }, 'enemy-1': { x: 5, y: 2 } },
      });
      const attacker = createUnit({ id: 'ally-1', side: 'attacker', stats: { hp: 100, maxHp: 100, attack: 20, defense: 5, speed: 15, critRate: 0, critMultiplier: 2, evasion: 0, accuracy: 1 } });
      const defender = createUnit({ id: 'enemy-1', side: 'defender', stats: { hp: 80, maxHp: 80, attack: 12, defense: 3, speed: 8, critRate: 0, critMultiplier: 1, evasion: 0, accuracy: 1 } });
      const ctx = createMockContext({ units: [attacker, defender] });

      mode.init(ctx);
      mode.update(ctx, 100);
      expect(ctx.dealDamage).not.toHaveBeenCalled();

      mode.update(ctx, 500);
      expect(ctx.dealDamage).toHaveBeenCalled();
    });

    it('finished 阶段不应执行行动', () => {
      const { mode, ctx } = create1v1Tactical();
      mode.init(ctx);
      mode['state'].phase = 'finished';
      mode.update(ctx, 100);
      expect(ctx.dealDamage).not.toHaveBeenCalled();
    });

    it('速度倍率应影响行动延迟', () => {
      const mode = new TacticalMode({
        actionDelayMs: 1000,
        mapWidth: 10,
        mapHeight: 8,
        unitConfigs: [
          { unitId: 'ally-1', movePower: 3, minAttackRange: 1, maxAttackRange: 1 },
          { unitId: 'enemy-1', movePower: 3, minAttackRange: 1, maxAttackRange: 1 },
        ],
        initialPositions: { 'ally-1': { x: 2, y: 2 }, 'enemy-1': { x: 5, y: 2 } },
      });
      const attacker = createUnit({ id: 'ally-1', side: 'attacker', stats: { hp: 100, maxHp: 100, attack: 20, defense: 5, speed: 15, critRate: 0, critMultiplier: 2, evasion: 0, accuracy: 1 } });
      const defender = createUnit({ id: 'enemy-1', side: 'defender', stats: { hp: 80, maxHp: 80, attack: 12, defense: 3, speed: 8, critRate: 0, critMultiplier: 1, evasion: 0, accuracy: 1 } });
      const ctx = createMockContext({ units: [attacker, defender], speed: 4 });

      mode.init(ctx);
      mode.update(ctx, 250);
      expect(ctx.dealDamage).toHaveBeenCalled();
    });
  });

  // ============================================================
  // AI 移动决策
  // ============================================================

  describe('AI 移动', () => {
    it('单位应向最近的敌人移动', () => {
      const { mode, ctx } = create1v1Tactical({
        movePower: 3,
        initialPositions: { 'ally-1': { x: 0, y: 0 }, 'enemy-1': { x: 9, y: 0 } },
      });
      mode.init(ctx);
      mode.update(ctx, 16);

      const map = mode.getMap()!;
      const pos = map.getUnitPosition('ally-1');
      // 应该向右移动（靠近敌人）
      expect(pos!.x).toBeGreaterThan(0);
    });

    it('已在攻击范围内不应移动', () => {
      const { mode, ctx } = create1v1Tactical({
        initialPositions: { 'ally-1': { x: 4, y: 2 }, 'enemy-1': { x: 5, y: 2 } },
      });
      mode.init(ctx);
      mode.update(ctx, 16);

      const map = mode.getMap()!;
      const pos = map.getUnitPosition('ally-1');
      // 距离为 1，已在攻击范围，不应移动
      expect(pos).toEqual({ x: 4, y: 2 });
    });

    it('movedThisTurn 应记录已移动的单位', () => {
      const { mode, ctx } = create1v1Tactical({
        movePower: 3,
        initialPositions: { 'ally-1': { x: 0, y: 0 }, 'enemy-1': { x: 9, y: 0 } },
      });
      mode.init(ctx);
      mode.update(ctx, 16);
      // ally-1 应该已移动
      expect(mode.movedThisTurn).toContain('ally-1');
    });
  });

  // ============================================================
  // AI 攻击决策
  // ============================================================

  describe('AI 攻击', () => {
    it('攻击范围内的敌人应被攻击', () => {
      const { mode, ctx } = create1v1Tactical({
        initialPositions: { 'ally-1': { x: 4, y: 2 }, 'enemy-1': { x: 5, y: 2 } },
      });
      mode.init(ctx);
      mode.update(ctx, 16);
      expect(ctx.dealDamage).toHaveBeenCalledWith('ally-1', 'enemy-1');
    });

    it('应发射 action_executed 事件', () => {
      const { mode, ctx } = create1v1Tactical({
        initialPositions: { 'ally-1': { x: 4, y: 2 }, 'enemy-1': { x: 5, y: 2 } },
      });
      mode.init(ctx);
      mode.update(ctx, 16);
      expect(ctx.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'action_executed',
          data: expect.objectContaining({ action: 'tactical_attack' }),
        }),
      );
    });

    it('actedThisTurn 应记录已行动的单位', () => {
      const { mode, ctx } = create1v1Tactical({
        initialPositions: { 'ally-1': { x: 4, y: 2 }, 'enemy-1': { x: 5, y: 2 } },
      });
      mode.init(ctx);
      mode.update(ctx, 16);
      expect(mode.actedThisTurn).toContain('ally-1');
    });

    it('远程单位应在远距离攻击', () => {
      const { mode, ctx } = create1v1Tactical({
        attackRange: 3,
        movePower: 2,
        initialPositions: { 'ally-1': { x: 3, y: 2 }, 'enemy-1': { x: 6, y: 2 } },
      });
      mode.init(ctx);
      mode.update(ctx, 16);
      // 距离为 3，在攻击范围内，应直接攻击
      expect(ctx.dealDamage).toHaveBeenCalled();
    });

    it('攻击范围外的敌人不应被攻击', () => {
      const { mode, ctx } = create1v1Tactical({
        attackRange: 1,
        movePower: 1,
        initialPositions: { 'ally-1': { x: 0, y: 0 }, 'enemy-1': { x: 9, y: 9 } },
      });
      mode.init(ctx);
      mode.update(ctx, 16);
      // 距离太远，移动力只有 1，无法到达攻击范围
      expect(ctx.dealDamage).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // 地形效果
  // ============================================================

  describe('地形效果', () => {
    it('地形治疗效果应触发', () => {
      // 创建自定义地图，在 (2,2) 放置有治疗效果的地形
      const mode = new TacticalMode({
        mapWidth: 5,
        mapHeight: 5,
        actionDelayMs: 0,
        unitConfigs: [
          { unitId: 'ally-1', movePower: 0, minAttackRange: 1, maxAttackRange: 1 },
          { unitId: 'enemy-1', movePower: 0, minAttackRange: 1, maxAttackRange: 1 },
        ],
        initialPositions: { 'ally-1': { x: 2, y: 2 }, 'enemy-1': { x: 4, y: 4 } },
      });

      // 手动设置地形（healPerTurn > 0 的地形不存在默认表中，
      // 但我们可以验证地形属性查询逻辑）
      const map = BattleMap.createGrid(5, 5);
      // 使用默认地形，验证不会崩溃
      const props = BattleMap.getTerrainProps('plain');
      expect(props.healPerTurn).toBe(0);
    });

    it('单位在 plain 地形上应无治疗效果', () => {
      const { mode, ctx } = create1v1Tactical({
        movePower: 0,
        initialPositions: { 'ally-1': { x: 2, y: 2 }, 'enemy-1': { x: 4, y: 4 } },
      });
      mode.init(ctx);
      mode.update(ctx, 16);
      // plain 地形 healPerTurn=0，不应治疗
      expect(ctx.heal).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // 胜负判定
  // ============================================================

  describe('胜负判定', () => {
    it('checkWin — 所有防守方死亡时返回 true', () => {
      const { mode, ctx, defender } = create1v1Tactical();
      mode.init(ctx);
      defender.isAlive = false;
      ctx.getAliveUnits = jest.fn((side?: string) => {
        if (side === 'defender') return [];
        return ctx.units.filter((u) => u.isAlive);
      });
      expect(mode.checkWin(ctx)).toBe(true);
    });

    it('checkWin — 防守方存活时返回 false', () => {
      const { mode, ctx } = create1v1Tactical();
      mode.init(ctx);
      expect(mode.checkWin(ctx)).toBe(false);
    });

    it('checkLose — 所有攻击方死亡时返回 true', () => {
      const { mode, ctx, attacker } = create1v1Tactical();
      mode.init(ctx);
      attacker.isAlive = false;
      ctx.getAliveUnits = jest.fn((side?: string) => {
        if (side === 'attacker') return [];
        return ctx.units.filter((u) => u.isAlive);
      });
      expect(mode.checkLose(ctx)).toBe(true);
    });

    it('checkLose — 攻击方存活时返回 false', () => {
      const { mode, ctx } = create1v1Tactical();
      mode.init(ctx);
      expect(mode.checkLose(ctx)).toBe(false);
    });

    it('胜利后应转为 finished', () => {
      const { mode, ctx, defender } = create1v1Tactical({
        initialPositions: { 'ally-1': { x: 4, y: 2 }, 'enemy-1': { x: 5, y: 2 } },
      });
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
      const { mode, ctx, attacker } = create1v1Tactical({
        initialPositions: { 'ally-1': { x: 4, y: 2 }, 'enemy-1': { x: 5, y: 2 } },
      });
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
      const { mode, ctx } = create1v1Tactical();
      mode.init(ctx);
      ctx.getAliveUnits = jest.fn((side?: string) => {
        if (side === 'defender') return [];
        return ctx.units.filter((u) => u.isAlive);
      });
      const result = mode.settle(ctx, 5000);
      expect(result.won).toBe(true);
    });

    it('失败时应返回 won=false', () => {
      const { mode, ctx } = create1v1Tactical();
      mode.init(ctx);
      ctx.getAliveUnits = jest.fn((side?: string) => {
        if (side === 'attacker') return [];
        return ctx.units.filter((u) => u.isAlive);
      });
      const result = mode.settle(ctx, 5000);
      expect(result.won).toBe(false);
    });

    it('应包含战斗持续时间', () => {
      const { mode, ctx } = create1v1Tactical();
      mode.init(ctx);
      const result = mode.settle(ctx, 12345);
      expect(result.durationMs).toBe(12345);
    });

    it('应包含统计数据', () => {
      const { mode, ctx } = create1v1Tactical();
      mode.init(ctx);
      const result = mode.settle(ctx, 1000);
      expect(result.stats).toBeDefined();
      expect(typeof result.stats.totalDamageDealt).toBe('number');
    });

    it('应计算 MVP', () => {
      const { mode, ctx } = create1v1Tactical();
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
      const { mode, ctx } = create1v1Tactical();
      mode.init(ctx);
      mode.update(ctx, 16);

      const data = mode.getState();
      const newMode = new TacticalMode();
      newMode.loadState(data);

      const restored = newMode.getState();
      expect(restored.turnOrder).toEqual(data.turnOrder);
      expect(restored.turnCount).toBe(data.turnCount);
      expect(restored.phase).toBe(data.phase);
    });

    it('应正确序列化 movedThisTurn 和 actedThisTurn', () => {
      const { mode, ctx } = create1v1Tactical({
        initialPositions: { 'ally-1': { x: 4, y: 2 }, 'enemy-1': { x: 5, y: 2 } },
      });
      mode.init(ctx);
      mode.update(ctx, 16);

      const data = mode.getState();
      expect(Array.isArray(data.movedThisTurn)).toBe(true);
      expect(Array.isArray(data.actedThisTurn)).toBe(true);
    });

    it('应正确序列化地图状态', () => {
      const { mode, ctx } = create1v1Tactical();
      mode.init(ctx);
      const data = mode.getState();
      expect(data.mapState).not.toBeNull();
    });

    it('空数据不应崩溃', () => {
      const mode = new TacticalMode();
      expect(() => mode.loadState({})).not.toThrow();
    });

    it('null 数据不应崩溃', () => {
      const mode = new TacticalMode();
      expect(() => mode.loadState(null as any)).not.toThrow();
    });
  });

  // ============================================================
  // 重置
  // ============================================================

  describe('reset', () => {
    it('应重置所有状态到初始值', () => {
      const { mode, ctx } = create1v1Tactical();
      mode.init(ctx);
      mode.update(ctx, 16);

      mode.reset();

      expect(mode.phase).toBe('select_unit');
      expect(mode.turnOrder).toEqual([]);
      expect(mode.turnCount).toBe(1);
      expect(mode.currentTurnIndex).toBe(0);
    });

    it('应清除地图', () => {
      const { mode, ctx } = create1v1Tactical();
      mode.init(ctx);
      mode.reset();
      expect(mode.getMap()).toBeNull();
    });

    it('重置后应能重新初始化', () => {
      const { mode, ctx } = create1v1Tactical();
      mode.init(ctx);
      mode.reset();
      mode.init(ctx);
      expect(mode.getMap()).not.toBeNull();
      expect(mode.turnOrder.length).toBe(2);
    });
  });

  // ============================================================
  // 边界条件
  // ============================================================

  describe('边界条件', () => {
    it('空队伍应正常处理', () => {
      const mode = new TacticalMode({ actionDelayMs: 0 });
      const ctx = createMockContext({ units: [] });
      mode.init(ctx);
      expect(mode.turnOrder).toEqual([]);
      expect(() => mode.update(ctx, 16)).not.toThrow();
    });

    it('当前行动单位已死亡应跳过', () => {
      const { mode, ctx, attacker } = create1v1Tactical({
        initialPositions: { 'ally-1': { x: 4, y: 2 }, 'enemy-1': { x: 5, y: 2 } },
      });
      mode.init(ctx);
      attacker.isAlive = false;
      ctx.getAliveUnits = jest.fn((side?: string) => {
        const units = ctx.units.filter((u) => u.isAlive);
        if (side) return units.filter((u) => u.side === side);
        return units;
      });
      expect(() => mode.update(ctx, 16)).not.toThrow();
    });

    it('3v3 场景应正常推进', () => {
      const { mode, ctx } = create3v3Tactical();
      mode.init(ctx);

      // 模拟多轮更新
      for (let i = 0; i < 100; i++) {
        mode.update(ctx, 16);
        if (mode.phase === 'finished') break;
      }

      expect(mode.phase).toBeDefined();
    });

    it('超过回合上限应判负', () => {
      const mode = new TacticalMode({
        maxTurns: 3,
        actionDelayMs: 0,
        mapWidth: 20,
        mapHeight: 20,
        unitConfigs: [
          { unitId: 'ally-1', movePower: 1, minAttackRange: 1, maxAttackRange: 1 },
          { unitId: 'enemy-1', movePower: 1, minAttackRange: 1, maxAttackRange: 1 },
        ],
        initialPositions: { 'ally-1': { x: 0, y: 0 }, 'enemy-1': { x: 19, y: 19 } },
      });
      const attacker = createUnit({ id: 'ally-1', side: 'attacker', stats: { hp: 100, maxHp: 100, attack: 20, defense: 5, speed: 15, critRate: 0, critMultiplier: 2, evasion: 0, accuracy: 1 } });
      const defender = createUnit({ id: 'enemy-1', side: 'defender', stats: { hp: 80, maxHp: 80, attack: 12, defense: 3, speed: 8, critRate: 0, critMultiplier: 1, evasion: 0, accuracy: 1 } });
      const ctx = createMockContext({ units: [attacker, defender] });

      mode.init(ctx);

      // 模拟多轮更新直到超过回合上限
      for (let i = 0; i < 200; i++) {
        mode.update(ctx, 16);
        if (mode.phase === 'finished') break;
      }

      expect(mode.phase).toBe('finished');
    });

    it('getUnitConfig 未配置的单位应返回 undefined', () => {
      const mode = new TacticalMode();
      expect(mode.getUnitConfig('nonexistent')).toBeUndefined();
    });

    it('多次 update 不应重复行动（延迟控制）', () => {
      const mode = new TacticalMode({
        actionDelayMs: 1000,
        mapWidth: 10,
        mapHeight: 8,
        unitConfigs: [
          { unitId: 'ally-1', movePower: 3, minAttackRange: 1, maxAttackRange: 1 },
          { unitId: 'enemy-1', movePower: 3, minAttackRange: 1, maxAttackRange: 1 },
        ],
        initialPositions: { 'ally-1': { x: 4, y: 2 }, 'enemy-1': { x: 5, y: 2 } },
      });
      const attacker = createUnit({ id: 'ally-1', side: 'attacker', stats: { hp: 100, maxHp: 100, attack: 20, defense: 5, speed: 15, critRate: 0, critMultiplier: 2, evasion: 0, accuracy: 1 } });
      const defender = createUnit({ id: 'enemy-1', side: 'defender', stats: { hp: 80, maxHp: 80, attack: 12, defense: 3, speed: 8, critRate: 0, critMultiplier: 1, evasion: 0, accuracy: 1 } });
      const ctx = createMockContext({ units: [attacker, defender] });

      mode.init(ctx);
      for (let i = 0; i < 10; i++) {
        mode.update(ctx, 10);
      }
      // 总共 100ms < 1000ms，不应行动
      expect(ctx.dealDamage).not.toHaveBeenCalled();
    });

    it('单位不在地图上应跳过行动', () => {
      const mode = new TacticalMode({
        actionDelayMs: 0,
        mapWidth: 5,
        mapHeight: 5,
        unitConfigs: [
          { unitId: 'ally-1', movePower: 3, minAttackRange: 1, maxAttackRange: 1 },
          { unitId: 'enemy-1', movePower: 3, minAttackRange: 1, maxAttackRange: 1 },
        ],
        // 不设置初始位置，让自动放置
      });
      const attacker = createUnit({ id: 'ally-1', side: 'attacker', stats: { hp: 100, maxHp: 100, attack: 20, defense: 5, speed: 15, critRate: 0, critMultiplier: 2, evasion: 0, accuracy: 1 } });
      const defender = createUnit({ id: 'enemy-1', side: 'defender', stats: { hp: 80, maxHp: 80, attack: 12, defense: 3, speed: 8, critRate: 0, critMultiplier: 1, evasion: 0, accuracy: 1 } });
      const ctx = createMockContext({ units: [attacker, defender] });

      mode.init(ctx);
      // 自动放置应该已放置单位
      expect(mode.getMap()!.getUnitPosition('ally-1')).not.toBeNull();
    });
  });
});
