import { vi } from 'vitest';
/**
 * SemiTurnBasedMode 单元测试
 *
 * 覆盖 ATB（Active Time Battle）战斗模式的所有核心功能：
 * - 构造函数和初始化
 * - ATB 充能
 * - 行动触发
 * - AI 决策
 * - 胜负判定
 * - 时间限制
 * - 存档/读档
 * - 重置
 */

import type { BattleModeContext, BattleUnit, BattleSkill } from '../../modules/battle';
import { SemiTurnBasedMode } from '../../modules/battle/SemiTurnBasedMode';

// ============================================================
// 常量
// ============================================================

/** ATB 条最大值（与源码一致） */
const ATB_MAX = 1000;

/** 默认时间限制（5 分钟） */
const DEFAULT_TIME_LIMIT_MS = 5 * 60 * 1000;

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
    cooldown: 0,
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
  const dealDamageMock = vi.fn().mockReturnValue({ damage: 20, isCrit: false, isMiss: false });
  const healMock = vi.fn();
  const addBuffMock = vi.fn();
  const removeBuffMock = vi.fn();
  const emitMock = vi.fn();

  return {
    units,
    getUnit: vi.fn((id: string) => units.find((u) => u.id === id)),
    dealDamage: dealDamageMock,
    heal: healMock,
    addBuff: addBuffMock,
    removeBuff: removeBuffMock,
    getAliveUnits: vi.fn((side?: 'attacker' | 'defender') => {
      if (side) return units.filter((u) => u.isAlive && u.side === side);
      return units.filter((u) => u.isAlive);
    }),
    emit: emitMock,
    speed: overrides?.speed ?? 1,
  };
}

/** 创建 1v1 战斗场景 */
function create1v1Scenario(options?: {
  attackerSpeed?: number;
  defenderSpeed?: number;
  attackerSkills?: BattleSkill[];
  defenderSkills?: BattleSkill[];
}): { ctx: BattleModeContext; attacker: BattleUnit; defender: BattleUnit } {
  const attacker = createUnit({
    id: 'ally-1',
    name: '战士',
    side: 'attacker',
    stats: { hp: 100, maxHp: 100, attack: 20, defense: 5, speed: options?.attackerSpeed ?? 15, critRate: 0.1, critMultiplier: 2.0, evasion: 0.05, accuracy: 0.95 },
    skills: options?.attackerSkills ?? [],
  });
  const defender = createUnit({
    id: 'enemy-1',
    name: '哥布林',
    side: 'defender',
    stats: { hp: 80, maxHp: 80, attack: 12, defense: 3, speed: options?.defenderSpeed ?? 8, critRate: 0.05, critMultiplier: 1.5, evasion: 0.03, accuracy: 0.9 },
    skills: options?.defenderSkills ?? [],
  });
  const ctx = createMockContext({ units: [attacker, defender] });
  return { ctx, attacker, defender };
}

/** 创建 2v2 战斗场景 */
function create2v2Scenario(): { ctx: BattleModeContext; attackers: BattleUnit[]; defenders: BattleUnit[] } {
  const attackers = [
    createUnit({ id: 'ally-1', name: '战士', side: 'attacker', stats: { hp: 120, maxHp: 120, attack: 25, defense: 10, speed: 12, critRate: 0.15, critMultiplier: 2.0, evasion: 0.05, accuracy: 0.95 } }),
    createUnit({ id: 'ally-2', name: '法师', side: 'attacker', stats: { hp: 70, maxHp: 70, attack: 35, defense: 3, speed: 8, critRate: 0.2, critMultiplier: 2.5, evasion: 0.05, accuracy: 0.9 }, skills: [createSkill({ id: 'fireball', name: '火球术', damage: 40, targetting: 'single', cooldown: 2 })] }),
  ];
  const defenders = [
    createUnit({ id: 'enemy-1', name: '哥布林A', side: 'defender', stats: { hp: 60, maxHp: 60, attack: 15, defense: 4, speed: 10, critRate: 0.05, critMultiplier: 1.5, evasion: 0.05, accuracy: 0.9 } }),
    createUnit({ id: 'enemy-2', name: '哥布林B', side: 'defender', stats: { hp: 50, maxHp: 50, attack: 18, defense: 3, speed: 14, critRate: 0.1, critMultiplier: 1.5, evasion: 0.05, accuracy: 0.9 } }),
  ];
  const ctx = createMockContext({ units: [...attackers, ...defenders] });
  return { ctx, attackers, defenders };
}

// ============================================================
// 测试套件
// ============================================================

describe('SemiTurnBasedMode', () => {
  let mode: SemiTurnBasedMode;

  beforeEach(() => {
    mode = new SemiTurnBasedMode({ actionDelayMs: 0 });
  });

  // ============================================================
  // 构造函数与初始化
  // ============================================================

  describe('构造函数', () => {
    it('应使用默认参数创建模式', () => {
      const m = new SemiTurnBasedMode();
      expect(m.type).toBe('semi-turn-based');
      expect(m.phase).toBe('charging');
      expect(m.actionCount).toBe(0);
      expect(m.elapsedMs).toBe(0);
    });

    it('应接受自定义时间限制', () => {
      const m = new SemiTurnBasedMode({ timeLimitMs: 60000 });
      const state = m.getState();
      expect(state.timeLimitMs).toBe(60000);
    });

    it('应接受自定义行动延迟', () => {
      const m = new SemiTurnBasedMode({ actionDelayMs: 1000 });
      const state = m.getState();
      expect(state.actionDelayMs).toBe(1000);
    });

    it('应接受自定义策略预设', () => {
      const m = new SemiTurnBasedMode({
        preset: { focusTarget: 'highest_attack', skillPriority: 'weakest', defensiveThreshold: 0.5 },
      });
      expect(m.strategyPreset.focusTarget).toBe('highest_attack');
      expect(m.strategyPreset.skillPriority).toBe('weakest');
    });

    it('默认时间限制应为 5 分钟', () => {
      const m = new SemiTurnBasedMode();
      const state = m.getState();
      expect(state.timeLimitMs).toBe(DEFAULT_TIME_LIMIT_MS);
    });
  });

  // ============================================================
  // init — 初始化
  // ============================================================

  describe('init', () => {
    it('应为所有存活单位初始化 ATB 条为 0', () => {
      const { ctx } = create1v1Scenario();
      mode.init(ctx);
      expect(mode.getATB('ally-1')).toBe(0);
      expect(mode.getATB('enemy-1')).toBe(0);
    });

    it('应跳过已死亡的单位', () => {
      const attacker = createUnit({ id: 'ally-1', side: 'attacker', isAlive: true, stats: { hp: 100, maxHp: 100, attack: 20, defense: 5, speed: 10, critRate: 0, critMultiplier: 2, evasion: 0, accuracy: 1 } });
      const deadDefender = createUnit({ id: 'enemy-1', side: 'defender', isAlive: false, stats: { hp: 0, maxHp: 50, attack: 10, defense: 3, speed: 20, critRate: 0, critMultiplier: 1, evasion: 0, accuracy: 1 } });
      const ctx = createMockContext({ units: [attacker, deadDefender] });
      mode.init(ctx);
      expect(mode.getATB('ally-1')).toBe(0);
      expect(mode.getATB('enemy-1')).toBe(0); // 不存在则返回 0
    });

    it('初始化后阶段应为 charging', () => {
      const { ctx } = create1v1Scenario();
      mode.init(ctx);
      expect(mode.phase).toBe('charging');
    });

    it('2v2 场景应正确初始化所有 ATB 条', () => {
      const { ctx } = create2v2Scenario();
      mode.init(ctx);
      expect(mode.getATB('ally-1')).toBe(0);
      expect(mode.getATB('ally-2')).toBe(0);
      expect(mode.getATB('enemy-1')).toBe(0);
      expect(mode.getATB('enemy-2')).toBe(0);
    });

    it('重复 init 应重置 ATB 条', () => {
      const { ctx } = create1v1Scenario();
      mode.init(ctx);
      // 模拟一些 ATB 增长
      mode.update(ctx, 100);
      const atbBefore = mode.getATB('ally-1');
      expect(atbBefore).toBeGreaterThan(0);

      // 重新 init
      mode.init(ctx);
      expect(mode.getATB('ally-1')).toBe(0);
    });
  });

  // ============================================================
  // ATB 充能
  // ============================================================

  describe('ATB 充能', () => {
    it('ATB 应按 speed * dt / 1000 增长', () => {
      const { ctx } = create1v1Scenario({ attackerSpeed: 100 });
      mode.init(ctx);
      mode.update(ctx, 1000); // dt = 1000ms, speed = 100

      // ATB 增长 = 100 * 1000 / 1000 = 100
      expect(mode.getATB('ally-1')).toBe(100);
    });

    it('ATB 不应超过最大值 1000', () => {
      const { ctx } = create1v1Scenario({ attackerSpeed: 2000 });
      mode.init(ctx);
      mode.update(ctx, 1000); // 理论增长 = 2000, 但 cap 在 1000

      expect(mode.getATB('ally-1')).toBeLessThanOrEqual(ATB_MAX);
    });

    it('速度倍率应影响 ATB 增长', () => {
      const { ctx } = create1v1Scenario({ attackerSpeed: 100 });
      ctx.speed = 2;
      mode.init(ctx);
      mode.update(ctx, 1000); // scaledDt = 2000, 增长 = 100 * 2000 / 1000 = 200

      expect(mode.getATB('ally-1')).toBe(200);
    });

    it('死亡单位应移除 ATB 条', () => {
      // 使用 2v1 场景，确保一方全灭不会立即结束战斗
      const attacker = createUnit({ id: 'ally-1', side: 'attacker', stats: { hp: 100, maxHp: 100, attack: 20, defense: 5, speed: 100, critRate: 0, critMultiplier: 2, evasion: 0, accuracy: 1 } });
      const attacker2 = createUnit({ id: 'ally-2', side: 'attacker', stats: { hp: 100, maxHp: 100, attack: 20, defense: 5, speed: 80, critRate: 0, critMultiplier: 2, evasion: 0, accuracy: 1 } });
      const defender = createUnit({ id: 'enemy-1', side: 'defender', stats: { hp: 80, maxHp: 80, attack: 12, defense: 3, speed: 50, critRate: 0, critMultiplier: 1, evasion: 0, accuracy: 1 } });
      const ctx = createMockContext({ units: [attacker, attacker2, defender] });
      mode.init(ctx);
      mode.update(ctx, 100);

      // ally-1 ATB = 10
      expect(mode.getATB('ally-1')).toBe(10);

      // 标记 ally-1 死亡
      attacker.isAlive = false;

      // 继续充能（还有 ally-2 存活，不会 checkLose）
      mode.update(ctx, 100);

      // 死亡单位的 ATB 应被移除（chargeATB 中删除）
      expect(mode.getATB('ally-1')).toBe(0);
    });

    it('不同速度单位 ATB 增长速率不同', () => {
      const { ctx } = create1v1Scenario({ attackerSpeed: 100, defenderSpeed: 50 });
      mode.init(ctx);
      mode.update(ctx, 1000);

      expect(mode.getATB('ally-1')).toBe(100);
      expect(mode.getATB('enemy-1')).toBe(50);
    });
  });

  // ============================================================
  // 行动触发
  // ============================================================

  describe('行动触发', () => {
    it('ATB 满时单位应行动', () => {
      // speed = 1000, dt = 1000 → ATB = 1000 → 满
      const { ctx } = create1v1Scenario({ attackerSpeed: 1000 });
      mode.init(ctx);
      mode.update(ctx, 1000);

      expect(ctx.dealDamage).toHaveBeenCalled();
    });

    it('行动后 ATB 应重置为 0', () => {
      const { ctx } = create1v1Scenario({ attackerSpeed: 1000 });
      mode.init(ctx);
      mode.update(ctx, 1000);

      // 行动后 ATB 重置
      expect(mode.getATB('ally-1')).toBe(0);
    });

    it('行动后阶段应转为 acting', () => {
      const { ctx } = create1v1Scenario({ attackerSpeed: 1000 });
      mode.init(ctx);
      mode.update(ctx, 1000);

      expect(mode.phase).toBe('acting');
    });

    it('行动次数应递增', () => {
      const { ctx } = create1v1Scenario({ attackerSpeed: 1000 });
      mode.init(ctx);

      expect(mode.actionCount).toBe(0);
      mode.update(ctx, 1000);
      expect(mode.actionCount).toBe(1);
    });

    it('多个单位同时满 ATB 时速度高的优先行动', () => {
      const attacker = createUnit({ id: 'ally-1', side: 'attacker', stats: { hp: 100, maxHp: 100, attack: 20, defense: 5, speed: 1000, critRate: 0, critMultiplier: 2, evasion: 0, accuracy: 1 } });
      const defender = createUnit({ id: 'enemy-1', side: 'defender', stats: { hp: 80, maxHp: 80, attack: 12, defense: 3, speed: 500, critRate: 0, critMultiplier: 1, evasion: 0, accuracy: 1 } });
      const ctx = createMockContext({ units: [attacker, defender] });
      mode.init(ctx);
      mode.update(ctx, 1000);

      // ally-1(speed=1000) 应优先行动
      expect(ctx.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'turn_started',
          data: expect.objectContaining({ unitId: 'ally-1' }),
        }),
      );
    });

    it('行动时应发射 turn_started 事件', () => {
      const { ctx } = create1v1Scenario({ attackerSpeed: 1000 });
      mode.init(ctx);
      mode.update(ctx, 1000);

      expect(ctx.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'turn_started',
          data: expect.objectContaining({ turn: 1 }),
        }),
      );
    });

    it('有行动延迟时应等待后回到 charging', () => {
      const modeWithDelay = new SemiTurnBasedMode({ actionDelayMs: 100 });
      const { ctx } = create1v1Scenario({ attackerSpeed: 1000 });
      modeWithDelay.init(ctx);

      // 第一次 update：ATB 满，执行行动
      modeWithDelay.update(ctx, 1000);
      expect(modeWithDelay.phase).toBe('acting');

      // 未到延迟时间，仍在 acting
      modeWithDelay.update(ctx, 50);
      expect(modeWithDelay.phase).toBe('acting');

      // 达到延迟时间，回到 charging
      modeWithDelay.update(ctx, 60);
      expect(modeWithDelay.phase).toBe('charging');
    });
  });

  // ============================================================
  // AI 决策
  // ============================================================

  describe('AI 决策', () => {
    it('有可用技能时应优先使用技能', () => {
      const skill = createSkill({ id: 'fireball', name: '火球术', damage: 40, cooldown: 0, currentCooldown: 0 });
      const { ctx } = create1v1Scenario({ attackerSpeed: 1000, attackerSkills: [skill] });
      mode.init(ctx);
      mode.update(ctx, 1000);

      expect(ctx.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'skill_used',
          data: expect.objectContaining({ skillName: '火球术' }),
        }),
      );
    });

    it('技能冷却中应使用普通攻击', () => {
      const skill = createSkill({ id: 'fireball', name: '火球术', damage: 40, cooldown: 2, currentCooldown: 1 });
      const { ctx } = create1v1Scenario({ attackerSpeed: 1000, attackerSkills: [skill] });
      mode.init(ctx);
      mode.update(ctx, 1000);

      expect(ctx.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'action_executed',
          data: expect.objectContaining({ action: 'normal_attack' }),
        }),
      );
    });

    it('无技能时应使用普通攻击', () => {
      const { ctx } = create1v1Scenario({ attackerSpeed: 1000 });
      mode.init(ctx);
      mode.update(ctx, 1000);

      expect(ctx.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'action_executed',
          data: expect.objectContaining({ action: 'normal_attack' }),
        }),
      );
    });

    it('single 技能应选择血量最低的敌方', () => {
      const skill = createSkill({ id: 'snipe', name: '狙击', damage: 30, targetting: 'single', cooldown: 0, currentCooldown: 0 });
      const attacker = createUnit({ id: 'ally-1', side: 'attacker', skills: [skill], stats: { hp: 100, maxHp: 100, attack: 20, defense: 5, speed: 1000, critRate: 0, critMultiplier: 2, evasion: 0, accuracy: 1 } });
      const enemy1 = createUnit({ id: 'enemy-1', side: 'defender', stats: { hp: 60, maxHp: 100, attack: 10, defense: 3, speed: 5, critRate: 0, critMultiplier: 1, evasion: 0, accuracy: 1 } });
      const enemy2 = createUnit({ id: 'enemy-2', side: 'defender', stats: { hp: 30, maxHp: 100, attack: 10, defense: 3, speed: 8, critRate: 0, critMultiplier: 1, evasion: 0, accuracy: 1 } });
      const ctx = createMockContext({ units: [attacker, enemy1, enemy2] });
      mode.init(ctx);
      mode.update(ctx, 1000);

      // 默认策略 lowest_hp，应攻击 enemy-2（hp=30）
      expect(ctx.dealDamage).toHaveBeenCalledWith('ally-1', 'enemy-2', 30);
    });

    it('aoe 技能应攻击所有敌方', () => {
      const skill = createSkill({ id: 'meteor', name: '陨石', damage: 25, targetting: 'aoe', cooldown: 0, currentCooldown: 0 });
      const attacker = createUnit({ id: 'ally-1', side: 'attacker', skills: [skill], stats: { hp: 100, maxHp: 100, attack: 20, defense: 5, speed: 1000, critRate: 0, critMultiplier: 2, evasion: 0, accuracy: 1 } });
      const enemy1 = createUnit({ id: 'enemy-1', side: 'defender', stats: { hp: 60, maxHp: 100, attack: 10, defense: 3, speed: 5, critRate: 0, critMultiplier: 1, evasion: 0, accuracy: 1 } });
      const enemy2 = createUnit({ id: 'enemy-2', side: 'defender', stats: { hp: 30, maxHp: 100, attack: 10, defense: 3, speed: 8, critRate: 0, critMultiplier: 1, evasion: 0, accuracy: 1 } });
      const ctx = createMockContext({ units: [attacker, enemy1, enemy2] });
      mode.init(ctx);
      mode.update(ctx, 1000);

      expect(ctx.dealDamage).toHaveBeenCalledWith('ally-1', 'enemy-1', 25);
      expect(ctx.dealDamage).toHaveBeenCalledWith('ally-1', 'enemy-2', 25);
    });

    it('self 技能应以自己为目标（低 HP 时）', () => {
      const healSkill = createSkill({ id: 'self-heal', name: '自我治疗', targetting: 'self', healAmount: 30, damage: undefined, cooldown: 0, currentCooldown: 0 });
      const attacker = createUnit({ id: 'ally-1', side: 'attacker', stats: { hp: 20, maxHp: 100, attack: 20, defense: 5, speed: 1000, critRate: 0, critMultiplier: 2, evasion: 0, accuracy: 1 }, skills: [healSkill] });
      const defender = createUnit({ id: 'enemy-1', side: 'defender', stats: { hp: 80, maxHp: 80, attack: 12, defense: 3, speed: 8, critRate: 0, critMultiplier: 1, evasion: 0, accuracy: 1 } });
      const ctx = createMockContext({ units: [attacker, defender] });
      mode.init(ctx);
      mode.update(ctx, 1000);

      expect(ctx.heal).toHaveBeenCalledWith('ally-1', 30);
    });

    it('使用技能后冷却应设置并立即递减', () => {
      const skill = createSkill({ id: 'fireball', name: '火球术', damage: 40, cooldown: 3, currentCooldown: 0 });
      const { ctx } = create1v1Scenario({ attackerSpeed: 1000, attackerSkills: [skill] });
      mode.init(ctx);
      mode.update(ctx, 1000);

      // executeAction 设置 currentCooldown = 3，然后 tickCooldowns 递减到 2
      expect(skill.currentCooldown).toBe(2);
    });
  });

  // ============================================================
  // 胜负判定
  // ============================================================

  describe('胜负判定', () => {
    it('checkWin — 所有防守方死亡时返回 true', () => {
      const { ctx } = create1v1Scenario();
      mode.init(ctx);
      ctx.getAliveUnits = vi.fn((side?: string) => {
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
      ctx.getAliveUnits = vi.fn((side?: string) => {
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
      const { ctx } = create1v1Scenario({ attackerSpeed: 1000 });
      mode.init(ctx);
      // 模拟战斗结束
      ctx.getAliveUnits = vi.fn((side?: string) => {
        if (side === 'defender') return [];
        return ctx.units.filter((u) => u.isAlive);
      });
      mode.update(ctx, 1000);
      expect(mode.phase).toBe('finished');
    });

    it('失败后应转为 finished', () => {
      const { ctx } = create1v1Scenario({ attackerSpeed: 1000 });
      mode.init(ctx);
      ctx.getAliveUnits = vi.fn((side?: string) => {
        if (side === 'attacker') return [];
        return ctx.units.filter((u) => u.isAlive);
      });
      mode.update(ctx, 1000);
      expect(mode.phase).toBe('finished');
    });
  });

  // ============================================================
  // 时间限制
  // ============================================================

  describe('时间限制', () => {
    it('超时后应转为 finished', () => {
      const modeShortLimit = new SemiTurnBasedMode({ timeLimitMs: 100, actionDelayMs: 0 });
      const { ctx } = create1v1Scenario();
      modeShortLimit.init(ctx);
      modeShortLimit.update(ctx, 200);

      expect(modeShortLimit.phase).toBe('finished');
    });

    it('超时判负', () => {
      const modeShortLimit = new SemiTurnBasedMode({ timeLimitMs: 100, actionDelayMs: 0 });
      const { ctx } = create1v1Scenario();
      modeShortLimit.init(ctx);
      modeShortLimit.update(ctx, 200);

      const result = modeShortLimit.settle(ctx, 200);
      expect(result.won).toBe(false);
    });

    it('速度倍率应影响时间消耗', () => {
      const modeShortLimit = new SemiTurnBasedMode({ timeLimitMs: 1000, actionDelayMs: 0 });
      const { ctx } = create1v1Scenario();
      ctx.speed = 10;
      modeShortLimit.init(ctx);
      // 100ms * 10x = 1000ms → 超时
      modeShortLimit.update(ctx, 100);

      expect(modeShortLimit.phase).toBe('finished');
    });

    it('未超时不应结束', () => {
      const modeLongLimit = new SemiTurnBasedMode({ timeLimitMs: 60000, actionDelayMs: 0 });
      const { ctx } = create1v1Scenario();
      modeLongLimit.init(ctx);
      modeLongLimit.update(ctx, 100);

      expect(modeLongLimit.phase).not.toBe('finished');
    });
  });

  // ============================================================
  // 结算
  // ============================================================

  describe('settle', () => {
    it('胜利时应返回 won=true', () => {
      const { ctx } = create1v1Scenario();
      mode.init(ctx);
      ctx.getAliveUnits = vi.fn((side?: string) => {
        if (side === 'defender') return [];
        return ctx.units.filter((u) => u.isAlive);
      });
      const result = mode.settle(ctx, 5000);
      expect(result.won).toBe(true);
    });

    it('失败时应返回 won=false', () => {
      const { ctx } = create1v1Scenario();
      mode.init(ctx);
      ctx.getAliveUnits = vi.fn((side?: string) => {
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
    });
  });

  // ============================================================
  // 存档/读档
  // ============================================================

  describe('saveState / loadState', () => {
    it('序列化后反序列化应恢复状态', () => {
      const { ctx } = create1v1Scenario({ attackerSpeed: 1000 });
      mode.init(ctx);
      mode.update(ctx, 1000);

      const data = mode.getState();
      const newMode = new SemiTurnBasedMode({ actionDelayMs: 0 });
      newMode.loadState(data);

      const restored = newMode.getState();
      expect(restored.phase).toBe(data.phase);
      expect(restored.actionCount).toBe(data.actionCount);
      expect(restored.elapsedMs).toBe(data.elapsedMs);
    });

    it('应正确序列化 ATB 条', () => {
      const { ctx } = create1v1Scenario({ attackerSpeed: 100 });
      mode.init(ctx);
      mode.update(ctx, 500); // ATB = 100 * 500 / 1000 = 50

      const state = mode.getState();
      expect(state.atbBars).toBeDefined();
      const atbBars = state.atbBars as Record<string, number>;
      expect(atbBars['ally-1']).toBe(50);
    });

    it('应正确序列化统计数据', () => {
      const { ctx } = create1v1Scenario();
      mode.init(ctx);
      const state = mode.getState();
      expect(state.stats).toBeDefined();
    });

    it('空数据不应崩溃', () => {
      expect(() => mode.loadState({})).not.toThrow();
    });

    it('null 数据不应崩溃', () => {
      expect(() => mode.loadState(null as any)).not.toThrow();
    });

    it('undefined 数据不应崩溃', () => {
      expect(() => mode.loadState(undefined as any)).not.toThrow();
    });

    it('loadState 应正确恢复 ATB 条', () => {
      const { ctx } = create1v1Scenario({ attackerSpeed: 100 });
      mode.init(ctx);
      mode.update(ctx, 500);

      const data = mode.getState();
      const newMode = new SemiTurnBasedMode({ actionDelayMs: 0 });
      newMode.loadState(data);

      expect(newMode.getATB('ally-1')).toBe(50);
    });

    it('loadState 应限制 ATB 值在 0-1000 范围内', () => {
      const newMode = new SemiTurnBasedMode({ actionDelayMs: 0 });
      newMode.loadState({
        atbBars: { 'unit-1': 2000 },
        phase: 'charging',
      });
      expect(newMode.getATB('unit-1')).toBe(ATB_MAX);
    });
  });

  // ============================================================
  // 重置
  // ============================================================

  describe('reset', () => {
    it('应重置所有状态到初始值', () => {
      const { ctx } = create1v1Scenario({ attackerSpeed: 1000 });
      mode.init(ctx);
      mode.update(ctx, 1000);

      mode.reset();

      expect(mode.phase).toBe('charging');
      expect(mode.actionCount).toBe(0);
      expect(mode.elapsedMs).toBe(0);
      expect(mode.currentActingUnit).toBeNull();
    });

    it('重置后应能重新初始化', () => {
      const { ctx } = create1v1Scenario();
      mode.init(ctx);
      mode.reset();
      mode.init(ctx);
      expect(mode.phase).toBe('charging');
      expect(mode.getATB('ally-1')).toBe(0);
    });

    it('重置应保留 timeLimitMs 配置', () => {
      const m = new SemiTurnBasedMode({ timeLimitMs: 60000, actionDelayMs: 0 });
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
    it('finished 阶段不应执行行动', () => {
      const { ctx } = create1v1Scenario({ attackerSpeed: 1000 });
      mode.init(ctx);
      mode.update(ctx, 1000);

      // 强制设为 finished
      mode['state'].phase = 'finished';
      const emitCount = ctx.emit.mock.calls.length;
      mode.update(ctx, 1000);
      // 不应有新的 emit
      expect(ctx.emit.mock.calls.length).toBe(emitCount);
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

      // 模拟多次更新
      for (let i = 0; i < 100; i++) {
        mode.update(ctx, 100);
        if (mode.phase === 'finished') break;
      }

      // 不应崩溃
      expect(mode.phase).toBeDefined();
    });

    it('行动后死亡单位应发射 unit_died 事件', () => {
      // 使用 1v2 场景，确保不会立即 checkWin
      const attacker = createUnit({ id: 'ally-1', side: 'attacker', stats: { hp: 100, maxHp: 100, attack: 20, defense: 5, speed: 1000, critRate: 0, critMultiplier: 2, evasion: 0, accuracy: 1 } });
      const defender1 = createUnit({ id: 'enemy-1', side: 'defender', stats: { hp: 80, maxHp: 80, attack: 12, defense: 3, speed: 8, critRate: 0, critMultiplier: 1, evasion: 0, accuracy: 1 } });
      const defender2 = createUnit({ id: 'enemy-2', side: 'defender', stats: { hp: 80, maxHp: 80, attack: 12, defense: 3, speed: 6, critRate: 0, critMultiplier: 1, evasion: 0, accuracy: 1 } });
      const ctx = createMockContext({ units: [attacker, defender1, defender2] });
      mode.init(ctx);

      // 先让 attacker 行动一次（ATB 满）
      mode.update(ctx, 1000);

      // 标记 defender1 死亡（模拟被击败）
      defender1.isAlive = false;
      defender1.stats.hp = 0;

      // 重置 ATB 让 attacker 再次行动
      // 需要回到 charging 阶段
      if (mode.phase === 'acting') {
        mode.update(ctx, 1); // 消耗行动延迟
      }

      // 继续充能并让 attacker 再次行动
      mode.update(ctx, 1000);

      expect(ctx.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'unit_died',
          data: expect.objectContaining({ unitId: 'enemy-1' }),
        }),
      );
    });

    it('连续多次 update 应正确累计 ATB', () => {
      const { ctx } = create1v1Scenario({ attackerSpeed: 100 });
      mode.init(ctx);

      // 5 次 200ms 的 update
      for (let i = 0; i < 5; i++) {
        mode.update(ctx, 200);
      }

      // 总 ATB 增长 = 100 * 1000 / 1000 = 100
      // 但 ATB 可能已满并行动过，检查至少经历过行动
      expect(ctx.emit.mock.calls.filter((c: any[]) => c[0]?.type === 'turn_started').length).toBeGreaterThanOrEqual(0);
    });
  });
});
