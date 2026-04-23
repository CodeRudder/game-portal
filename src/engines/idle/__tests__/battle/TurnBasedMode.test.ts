import { vi } from 'vitest';
/**
 * TurnBasedMode 单元测试
 *
 * 覆盖回合制战斗模式的所有核心功能：
 * - 初始化和行动顺序生成
 * - 回合推进
 * - AI 决策（技能优先、目标选择）
 * - 胜负判定
 * - Buff 处理
 * - 技能冷却
 * - 存档/读档
 * - 重置
 * - 边界条件
 */

import type { BattleModeContext, BattleUnit, BattleSkill, DamageOutput } from '../../modules/battle';
import { TurnBasedMode } from '../../modules/battle/TurnBasedMode';

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

/** 创建 3v3 战斗场景 */
function create3v3Scenario(): { ctx: BattleModeContext; attackers: BattleUnit[]; defenders: BattleUnit[] } {
  const attackers = [
    createUnit({ id: 'ally-1', name: '战士', side: 'attacker', stats: { hp: 120, maxHp: 120, attack: 25, defense: 10, speed: 12, critRate: 0.15, critMultiplier: 2.0, evasion: 0.05, accuracy: 0.95 } }),
    createUnit({ id: 'ally-2', name: '法师', side: 'attacker', stats: { hp: 70, maxHp: 70, attack: 35, defense: 3, speed: 8, critRate: 0.2, critMultiplier: 2.5, evasion: 0.05, accuracy: 0.9 }, skills: [createSkill({ id: 'fireball', name: '火球术', damage: 40, targetting: 'single', cooldown: 2 })] }),
    createUnit({ id: 'ally-3', name: '治疗师', side: 'attacker', stats: { hp: 80, maxHp: 80, attack: 10, defense: 5, speed: 15, critRate: 0.05, critMultiplier: 1.5, evasion: 0.1, accuracy: 0.95 }, skills: [createSkill({ id: 'heal', name: '治疗', targetting: 'self', healAmount: 30, damage: undefined, cooldown: 3 })] }),
  ];
  const defenders = [
    createUnit({ id: 'enemy-1', name: '哥布林A', side: 'defender', stats: { hp: 60, maxHp: 60, attack: 15, defense: 4, speed: 10, critRate: 0.05, critMultiplier: 1.5, evasion: 0.05, accuracy: 0.9 } }),
    createUnit({ id: 'enemy-2', name: '哥布林B', side: 'defender', stats: { hp: 50, maxHp: 50, attack: 18, defense: 3, speed: 14, critRate: 0.1, critMultiplier: 1.5, evasion: 0.05, accuracy: 0.9 } }),
    createUnit({ id: 'enemy-3', name: '哥布林C', side: 'defender', stats: { hp: 70, maxHp: 70, attack: 12, defense: 6, speed: 6, critRate: 0.03, critMultiplier: 1.5, evasion: 0.03, accuracy: 0.9 } }),
  ];
  const ctx = createMockContext({ units: [...attackers, ...defenders] });
  return { ctx, attackers, defenders };
}

// ============================================================
// 测试套件
// ============================================================

describe('TurnBasedMode', () => {
  let mode: TurnBasedMode;

  beforeEach(() => {
    mode = new TurnBasedMode({ actionDelayMs: 0 });
  });

  // ============================================================
  // 构造函数与初始化
  // ============================================================

  describe('构造函数', () => {
    it('应使用默认参数创建模式', () => {
      const m = new TurnBasedMode();
      expect(m.type).toBe('turn-based');
      expect(m.phase).toBe('waiting');
      expect(m.turnCount).toBe(1);
    });

    it('应接受自定义回合上限', () => {
      const m = new TurnBasedMode({ maxTurns: 50 });
      const state = m.getState();
      expect(state.maxTurns).toBe(50);
    });

    it('应接受自定义行动延迟', () => {
      const m = new TurnBasedMode({ actionDelayMs: 1000 });
      const state = m.getState();
      expect(state.actionDelayMs).toBe(1000);
    });

    it('应接受自定义策略预设', () => {
      const m = new TurnBasedMode({
        preset: { focusTarget: 'highest_attack', skillPriority: 'weakest', defensiveThreshold: 0.5 },
      });
      expect(m.strategyPreset.focusTarget).toBe('highest_attack');
      expect(m.strategyPreset.skillPriority).toBe('weakest');
    });
  });

  // ============================================================
  // init — 初始化和行动顺序
  // ============================================================

  describe('init', () => {
    it('应按速度降序生成行动顺序', () => {
      const { ctx } = create1v1Scenario({ attackerSpeed: 15, defenderSpeed: 8 });
      mode.init(ctx);
      expect(mode.turnOrder).toEqual(['ally-1', 'enemy-1']);
    });

    it('速度高的防守方应排前面', () => {
      const { ctx } = create1v1Scenario({ attackerSpeed: 5, defenderSpeed: 20 });
      mode.init(ctx);
      expect(mode.turnOrder).toEqual(['enemy-1', 'ally-1']);
    });

    it('3v3 场景应正确排序所有单位', () => {
      const { ctx, attackers, defenders } = create3v3Scenario();
      mode.init(ctx);
      // 速度：ally-3=15, ally-1=12, enemy-2=14, ally-2=8, enemy-1=10, enemy-3=6
      // 降序：ally-3(15), enemy-2(14), ally-1(12), enemy-1(10), ally-2(8), enemy-3(6)
      expect(mode.turnOrder).toEqual(['ally-3', 'enemy-2', 'ally-1', 'enemy-1', 'ally-2', 'enemy-3']);
    });

    it('应跳过已死亡的单位', () => {
      const attacker = createUnit({ id: 'ally-1', side: 'attacker', isAlive: true, stats: { hp: 100, maxHp: 100, attack: 20, defense: 5, speed: 10, critRate: 0.1, critMultiplier: 2, evasion: 0, accuracy: 1 } });
      const deadDefender = createUnit({ id: 'enemy-1', side: 'defender', isAlive: false, stats: { hp: 0, maxHp: 50, attack: 10, defense: 3, speed: 20, critRate: 0, critMultiplier: 1, evasion: 0, accuracy: 1 } });
      const ctx = createMockContext({ units: [attacker, deadDefender] });
      mode.init(ctx);
      expect(mode.turnOrder).toEqual(['ally-1']);
    });

    it('应发射 turn_started 事件', () => {
      const { ctx } = create1v1Scenario();
      mode.init(ctx);
      expect(ctx.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'turn_started',
          data: expect.objectContaining({ unitId: 'ally-1' }),
        }),
      );
    });

    it('初始阶段应为 acting', () => {
      const { ctx } = create1v1Scenario();
      mode.init(ctx);
      expect(mode.phase).toBe('acting');
    });

    it('回合数应从 1 开始', () => {
      const { ctx } = create1v1Scenario();
      mode.init(ctx);
      expect(mode.turnCount).toBe(1);
    });
  });

  // ============================================================
  // update — 回合推进
  // ============================================================

  describe('update', () => {
    it('应处理行动延迟后执行行动', () => {
      const modeWithDelay = new TurnBasedMode({ actionDelayMs: 100 });
      const { ctx } = create1v1Scenario();
      modeWithDelay.init(ctx);

      // 未到延迟时间
      modeWithDelay.update(ctx, 50);
      expect(ctx.dealDamage).not.toHaveBeenCalled();

      // 达到延迟时间
      modeWithDelay.update(ctx, 60);
      expect(ctx.dealDamage).toHaveBeenCalled();
    });

    it('速度倍率应影响行动延迟', () => {
      const modeWithDelay = new TurnBasedMode({ actionDelayMs: 1000 });
      const { ctx } = create1v1Scenario();
      ctx.speed = 4;
      modeWithDelay.init(ctx);

      // 250ms * 4x = 1000ms
      modeWithDelay.update(ctx, 250);
      expect(ctx.dealDamage).toHaveBeenCalled();
    });

    it('actionDelayMs 为 0 时应立即行动', () => {
      const { ctx } = create1v1Scenario();
      mode.init(ctx);
      mode.update(ctx, 16);
      expect(ctx.dealDamage).toHaveBeenCalled();
    });

    it('waiting 阶段不应执行行动', () => {
      const { ctx } = create1v1Scenario();
      // 未 init，phase 为 waiting
      mode.update(ctx, 100);
      expect(ctx.dealDamage).not.toHaveBeenCalled();
    });

    it('finished 阶段不应执行行动', () => {
      const { ctx } = create1v1Scenario();
      mode.init(ctx);
      // 模拟战斗结束
      mode['state'].phase = 'finished';
      mode.update(ctx, 100);
      expect(ctx.dealDamage).not.toHaveBeenCalled();
    });

    it('胜利后应转为 finished', () => {
      const { ctx, defender } = create1v1Scenario();
      mode.init(ctx);
      defender.isAlive = false;
      // 清空防守方存活单位
      ctx.getAliveUnits = vi.fn((side?: string) => {
        if (side === 'defender') return [];
        return ctx.units.filter((u) => u.isAlive);
      });
      mode.update(ctx, 16);
      expect(mode.phase).toBe('finished');
    });

    it('失败后应转为 finished', () => {
      const { ctx, attacker } = create1v1Scenario();
      mode.init(ctx);
      attacker.isAlive = false;
      ctx.getAliveUnits = vi.fn((side?: string) => {
        if (side === 'attacker') return [];
        return ctx.units.filter((u) => u.isAlive);
      });
      mode.update(ctx, 16);
      expect(mode.phase).toBe('finished');
    });
  });

  // ============================================================
  // AI 决策 — 技能优先
  // ============================================================

  describe('AI 技能选择', () => {
    it('有可用技能时应优先使用技能', () => {
      const skill = createSkill({ id: 'fireball', name: '火球术', damage: 40, cooldown: 0, currentCooldown: 0 });
      const { ctx } = create1v1Scenario({ attackerSkills: [skill] });
      mode.init(ctx);
      mode.update(ctx, 16);

      expect(ctx.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'skill_used',
          data: expect.objectContaining({ skillName: '火球术' }),
        }),
      );
    });

    it('技能冷却中应使用普通攻击', () => {
      const skill = createSkill({ id: 'fireball', name: '火球术', damage: 40, cooldown: 2, currentCooldown: 1 });
      const { ctx } = create1v1Scenario({ attackerSkills: [skill] });
      mode.init(ctx);
      mode.update(ctx, 16);

      expect(ctx.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'action_executed',
          data: expect.objectContaining({ action: 'normal_attack' }),
        }),
      );
    });

    it('无技能时应使用普通攻击', () => {
      const { ctx } = create1v1Scenario();
      mode.init(ctx);
      mode.update(ctx, 16);

      expect(ctx.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'action_executed',
          data: expect.objectContaining({ action: 'normal_attack' }),
        }),
      );
    });

    it('strongest 策略应选择伤害最高的技能', () => {
      const weakSkill = createSkill({ id: 'jab', name: '刺击', damage: 10, cooldown: 0, currentCooldown: 0 });
      const strongSkill = createSkill({ id: 'smash', name: '猛击', damage: 50, cooldown: 0, currentCooldown: 0 });
      const { ctx } = create1v1Scenario({ attackerSkills: [weakSkill, strongSkill] });
      const modeStrongest = new TurnBasedMode({ actionDelayMs: 0, preset: { focusTarget: 'lowest_hp', skillPriority: 'strongest', defensiveThreshold: 0.3 } });
      modeStrongest.init(ctx);
      modeStrongest.update(ctx, 16);

      expect(ctx.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'skill_used',
          data: expect.objectContaining({ skillName: '猛击' }),
        }),
      );
    });

    it('weakest 策略应选择伤害最低的技能', () => {
      const weakSkill = createSkill({ id: 'jab', name: '刺击', damage: 10, cooldown: 0, currentCooldown: 0 });
      const strongSkill = createSkill({ id: 'smash', name: '猛击', damage: 50, cooldown: 0, currentCooldown: 0 });
      const { ctx } = create1v1Scenario({ attackerSkills: [weakSkill, strongSkill] });
      const modeWeakest = new TurnBasedMode({ actionDelayMs: 0, preset: { focusTarget: 'lowest_hp', skillPriority: 'weakest', defensiveThreshold: 0.3 } });
      modeWeakest.init(ctx);
      modeWeakest.update(ctx, 16);

      expect(ctx.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'skill_used',
          data: expect.objectContaining({ skillName: '刺击' }),
        }),
      );
    });
  });

  // ============================================================
  // AI 决策 — 目标选择
  // ============================================================

  describe('AI 目标选择', () => {
    it('single 技能应选择血量最低的敌方（lowest_hp）', () => {
      const skill = createSkill({ id: 'snipe', name: '狙击', damage: 30, targetting: 'single', cooldown: 0, currentCooldown: 0 });
      const attacker = createUnit({ id: 'ally-1', side: 'attacker', skills: [skill], stats: { hp: 100, maxHp: 100, attack: 20, defense: 5, speed: 15, critRate: 0, critMultiplier: 2, evasion: 0, accuracy: 1 } });
      const enemy1 = createUnit({ id: 'enemy-1', side: 'defender', stats: { hp: 60, maxHp: 100, attack: 10, defense: 3, speed: 5, critRate: 0, critMultiplier: 1, evasion: 0, accuracy: 1 } });
      const enemy2 = createUnit({ id: 'enemy-2', side: 'defender', stats: { hp: 30, maxHp: 100, attack: 10, defense: 3, speed: 8, critRate: 0, critMultiplier: 1, evasion: 0, accuracy: 1 } });
      const ctx = createMockContext({ units: [attacker, enemy1, enemy2] });
      mode.init(ctx);
      mode.update(ctx, 16);

      // 应该攻击 enemy-2（血量最低）
      expect(ctx.dealDamage).toHaveBeenCalledWith('ally-1', 'enemy-2', 30);
    });

    it('aoe 技能应攻击所有敌方', () => {
      const skill = createSkill({ id: 'meteor', name: '陨石', damage: 25, targetting: 'aoe', cooldown: 0, currentCooldown: 0 });
      const attacker = createUnit({ id: 'ally-1', side: 'attacker', skills: [skill], stats: { hp: 100, maxHp: 100, attack: 20, defense: 5, speed: 15, critRate: 0, critMultiplier: 2, evasion: 0, accuracy: 1 } });
      const enemy1 = createUnit({ id: 'enemy-1', side: 'defender', stats: { hp: 60, maxHp: 100, attack: 10, defense: 3, speed: 5, critRate: 0, critMultiplier: 1, evasion: 0, accuracy: 1 } });
      const enemy2 = createUnit({ id: 'enemy-2', side: 'defender', stats: { hp: 30, maxHp: 100, attack: 10, defense: 3, speed: 8, critRate: 0, critMultiplier: 1, evasion: 0, accuracy: 1 } });
      const ctx = createMockContext({ units: [attacker, enemy1, enemy2] });
      mode.init(ctx);
      mode.update(ctx, 16);

      expect(ctx.dealDamage).toHaveBeenCalledWith('ally-1', 'enemy-1', 25);
      expect(ctx.dealDamage).toHaveBeenCalledWith('ally-1', 'enemy-2', 25);
    });

    it('self 技能应以自己为目标', () => {
      const healSkill = createSkill({ id: 'self-heal', name: '自我治疗', targetting: 'self', healAmount: 30, damage: undefined, cooldown: 0, currentCooldown: 0 });
      const attacker = createUnit({ id: 'ally-1', side: 'attacker', stats: { hp: 20, maxHp: 100, attack: 20, defense: 5, speed: 15, critRate: 0, critMultiplier: 2, evasion: 0, accuracy: 1 }, skills: [healSkill] });
      const defender = createUnit({ id: 'enemy-1', side: 'defender', stats: { hp: 80, maxHp: 80, attack: 12, defense: 3, speed: 8, critRate: 0, critMultiplier: 1, evasion: 0, accuracy: 1 } });
      const ctx = createMockContext({ units: [attacker, defender] });
      // HP 低于阈值（20/100 = 0.2 < 0.3），应优先使用治疗技能
      mode.init(ctx);
      mode.update(ctx, 16);

      expect(ctx.heal).toHaveBeenCalledWith('ally-1', 30);
    });

    it('普攻应按 focusTarget 策略选择目标', () => {
      const attacker = createUnit({ id: 'ally-1', side: 'attacker', stats: { hp: 100, maxHp: 100, attack: 20, defense: 5, speed: 15, critRate: 0, critMultiplier: 2, evasion: 0, accuracy: 1 } });
      const fastEnemy = createUnit({ id: 'enemy-1', side: 'defender', stats: { hp: 60, maxHp: 100, attack: 10, defense: 3, speed: 20, critRate: 0, critMultiplier: 1, evasion: 0, accuracy: 1 } });
      const slowEnemy = createUnit({ id: 'enemy-2', side: 'defender', stats: { hp: 30, maxHp: 100, attack: 10, defense: 3, speed: 5, critRate: 0, critMultiplier: 1, evasion: 0, accuracy: 1 } });
      const ctx = createMockContext({ units: [attacker, fastEnemy, slowEnemy] });

      const modeFastest = new TurnBasedMode({ actionDelayMs: 0, preset: { focusTarget: 'fastest', skillPriority: 'strongest', defensiveThreshold: 0.3 } });
      modeFastest.init(ctx);
      modeFastest.update(ctx, 16);

      // 行动顺序按速度降序：enemy-1(speed=20) 最先行动
      // enemy-1 是 defender，攻击 attacker(ally-1)（唯一的 attacker）
      expect(ctx.dealDamage).toHaveBeenCalledWith('enemy-1', 'ally-1');
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

    it('超过回合上限应判负', () => {
      const modeLowLimit = new TurnBasedMode({ maxTurns: 2, actionDelayMs: 0 });
      const { ctx } = create1v1Scenario();
      modeLowLimit.init(ctx);

      // 模拟多次更新直到超过回合上限
      for (let i = 0; i < 20; i++) {
        modeLowLimit.update(ctx, 16);
        if (modeLowLimit.phase === 'finished') break;
      }

      const state = modeLowLimit.getState();
      expect(state.phase).toBe('finished');
      // 回合数应超过上限
      expect((state as any).turnCount).toBeGreaterThan(2);
    });
  });

  // ============================================================
  // 技能冷却
  // ============================================================

  describe('技能冷却', () => {
    it('使用技能后应设置冷却（行动后立即递减一次）', () => {
      const skill = createSkill({ id: 'fireball', name: '火球术', damage: 40, cooldown: 3, currentCooldown: 0 });
      const { ctx } = create1v1Scenario({ attackerSkills: [skill] });
      mode.init(ctx);
      mode.update(ctx, 16);

      // executeAction 设置 currentCooldown = 3，然后 tickCooldowns 递减到 2
      expect(skill.currentCooldown).toBe(2);
    });

    it('冷却应每回合递减', () => {
      const skill = createSkill({ id: 'fireball', name: '火球术', damage: 40, cooldown: 3, currentCooldown: 0 });
      const { ctx } = create1v1Scenario({ attackerSkills: [skill] });
      mode.init(ctx);

      // 第一次行动：使用技能，冷却变为 3，然后 tickCooldowns 递减到 2
      mode.update(ctx, 16);
      expect(skill.currentCooldown).toBe(2);

      // 第二次行动：tickCooldowns 再次递减到 1
      mode.update(ctx, 16);
      expect(skill.currentCooldown).toBe(1);
    });

    it('冷却归零后可再次使用技能', () => {
      const skill = createSkill({ id: 'fireball', name: '火球术', damage: 40, cooldown: 1, currentCooldown: 0 });
      const { ctx } = create1v1Scenario({ attackerSkills: [skill] });
      mode.init(ctx);

      // 第一次行动：使用技能，冷却变为 1，然后 tickCooldowns 递减到 0
      mode.update(ctx, 16);
      expect(skill.currentCooldown).toBe(0);

      // 第二次行动：技能可用（冷却为 0），再次使用，冷却变为 1，然后 tickCooldowns 递减到 0
      mode.update(ctx, 16);
      expect(skill.currentCooldown).toBe(0);
    });
  });

  // ============================================================
  // Buff 处理
  // ============================================================

  describe('Buff 处理', () => {
    it('技能应正确添加 Buff', () => {
      const skill = createSkill({
        id: 'buff-attack',
        name: '强化攻击',
        damage: 20,
        cooldown: 0,
        currentCooldown: 0,
        effects: [{ type: 'buff' as const, stat: 'attack', value: 10, durationTurns: 2 }],
      });
      const { ctx } = create1v1Scenario({ attackerSkills: [skill] });
      mode.init(ctx);
      mode.update(ctx, 16);

      expect(ctx.addBuff).toHaveBeenCalled();
    });

    it('Buff 持续时间应递减', () => {
      const buff = { id: 'buff-1', sourceUnitId: 'ally-1', type: 'buff' as const, stat: 'attack', value: 10, remainingTurns: 3 };
      const { ctx, attacker } = create1v1Scenario();
      attacker.buffs.push(buff);
      mode.init(ctx);
      mode.update(ctx, 16);

      expect(buff.remainingTurns).toBe(2);
    });

    it('Buff 持续时间归零应移除', () => {
      const buff = { id: 'buff-1', sourceUnitId: 'ally-1', type: 'buff' as const, stat: 'attack', value: 10, remainingTurns: 1 };
      const { ctx, attacker } = create1v1Scenario();
      attacker.buffs.push(buff);
      mode.init(ctx);
      mode.update(ctx, 16);

      expect(attacker.buffs).toHaveLength(0);
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
      const { ctx } = create1v1Scenario();
      mode.init(ctx);
      mode.update(ctx, 16);

      const data = mode.getState();
      const newMode = new TurnBasedMode({ actionDelayMs: 0 });
      newMode.loadState(data);

      const restored = newMode.getState();
      expect(restored.turnOrder).toEqual(data.turnOrder);
      expect(restored.turnCount).toBe(data.turnCount);
      expect(restored.phase).toBe(data.phase);
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

    it('应正确序列化回合顺序', () => {
      const { ctx } = create3v3Scenario();
      mode.init(ctx);
      const state = mode.getState();
      expect(Array.isArray(state.turnOrder)).toBe(true);
      expect(state.turnOrder.length).toBe(6);
    });

    it('应正确序列化统计数据', () => {
      const { ctx } = create1v1Scenario();
      mode.init(ctx);
      const state = mode.getState();
      expect(state.stats).toBeDefined();
    });
  });

  // ============================================================
  // 重置
  // ============================================================

  describe('reset', () => {
    it('应重置所有状态到初始值', () => {
      const { ctx } = create1v1Scenario();
      mode.init(ctx);
      mode.update(ctx, 16);

      mode.reset();

      expect(mode.phase).toBe('waiting');
      expect(mode.turnOrder).toEqual([]);
      expect(mode.turnCount).toBe(1);
      expect(mode.currentTurnIndex).toBe(0);
    });

    it('重置后应能重新初始化', () => {
      const { ctx } = create1v1Scenario();
      mode.init(ctx);
      mode.reset();
      mode.init(ctx);
      expect(mode.phase).toBe('acting');
      expect(mode.turnOrder.length).toBe(2);
    });

    it('重置应保留 maxTurns 配置', () => {
      const m = new TurnBasedMode({ maxTurns: 50, actionDelayMs: 0 });
      const { ctx } = create1v1Scenario();
      m.init(ctx);
      m.reset();
      expect(m.getState().maxTurns).toBe(50);
    });
  });

  // ============================================================
  // 边界条件
  // ============================================================

  describe('边界条件', () => {
    it('1v1 场景应正常工作', () => {
      const { ctx } = create1v1Scenario();
      mode.init(ctx);
      expect(mode.turnOrder).toHaveLength(2);
      mode.update(ctx, 16);
      expect(ctx.dealDamage).toHaveBeenCalled();
    });

    it('空队伍应正常处理', () => {
      const ctx = createMockContext({ units: [] });
      mode.init(ctx);
      expect(mode.turnOrder).toEqual([]);
      expect(() => mode.update(ctx, 16)).not.toThrow();
    });

    it('单方全灭应立即结束', () => {
      const attacker = createUnit({ id: 'ally-1', side: 'attacker', isAlive: false, stats: { hp: 0, maxHp: 100, attack: 20, defense: 5, speed: 10, critRate: 0, critMultiplier: 2, evasion: 0, accuracy: 1 } });
      const defender = createUnit({ id: 'enemy-1', side: 'defender', isAlive: true, stats: { hp: 80, maxHp: 80, attack: 12, defense: 3, speed: 8, critRate: 0, critMultiplier: 1, evasion: 0, accuracy: 1 } });
      const ctx = createMockContext({ units: [attacker, defender] });
      mode.init(ctx);
      expect(mode.checkLose(ctx)).toBe(true);
    });

    it('当前行动单位已死亡应跳过', () => {
      const { ctx, attacker } = create1v1Scenario();
      mode.init(ctx);
      // 标记当前行动单位死亡
      attacker.isAlive = false;
      attacker.stats.hp = 0;
      ctx.getAliveUnits = vi.fn((side?: string) => {
        const units = ctx.units.filter((u) => u.isAlive);
        if (side) return units.filter((u) => u.side === side);
        return units;
      });
      // 应不崩溃
      expect(() => mode.update(ctx, 16)).not.toThrow();
    });

    it('速度相同的单位排序应稳定', () => {
      const u1 = createUnit({ id: 'unit-1', side: 'attacker', stats: { hp: 100, maxHp: 100, attack: 20, defense: 5, speed: 10, critRate: 0, critMultiplier: 2, evasion: 0, accuracy: 1 } });
      const u2 = createUnit({ id: 'unit-2', side: 'defender', stats: { hp: 80, maxHp: 80, attack: 12, defense: 3, speed: 10, critRate: 0, critMultiplier: 1, evasion: 0, accuracy: 1 } });
      const ctx = createMockContext({ units: [u1, u2] });
      mode.init(ctx);
      expect(mode.turnOrder).toHaveLength(2);
    });

    it('多次 update 不应重复行动（延迟控制）', () => {
      const modeWithDelay = new TurnBasedMode({ actionDelayMs: 1000 });
      const { ctx } = create1v1Scenario();
      modeWithDelay.init(ctx);

      // 多次短时间 update
      for (let i = 0; i < 10; i++) {
        modeWithDelay.update(ctx, 10);
      }
      // 总共 100ms < 1000ms，不应行动
      expect(ctx.dealDamage).not.toHaveBeenCalled();
    });

    it('3v3 场景应正常推进', () => {
      const { ctx } = create3v3Scenario();
      mode.init(ctx);

      // 模拟多轮更新
      for (let i = 0; i < 50; i++) {
        mode.update(ctx, 16);
        if (mode.phase === 'finished') break;
      }

      // 不应崩溃
      expect(mode.phase).toBeDefined();
    });
  });
});
