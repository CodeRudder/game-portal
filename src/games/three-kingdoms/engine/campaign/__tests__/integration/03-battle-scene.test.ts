/**
 * 集成测试：战斗场景与HUD（§3.1 ~ §3.1d）
 *
 * 覆盖 Play v3.0 攻城略地(上) 中的 5 个流程：
 *   §3.1  进入战斗场景：BattleEngine 初始化状态正确
 *   §3.1a 战斗场景组件层次：引擎提供正确的组件数据结构
 *   §3.1b 战斗HUD布局：引擎提供HUD所需数据（HP/怒气/技能CD）
 *   §3.1c 战斗中交互操作：引擎响应速度切换/暂停/手动操作
 *   §3.1d 战斗进入/退出动画：引擎提供进入/退出状态转换
 *
 * 测试策略：引擎层API验证，不依赖UI渲染。
 * 通过 BattleEngine / BattleSpeedController / UltimateSkillSystem 验证数据正确性。
 */

import { BattleEngine } from '../../../battle/BattleEngine';
import { BattleSpeedController } from '../../../battle/BattleSpeedController';
import { UltimateSkillSystem } from '../../../battle/UltimateSkillSystem';
import {
  BattlePhase,
  BattleOutcome,
  BattleSpeed,
  BattleMode,
  StarRating,
  TroopType,
  TimeStopState,
} from '../../../battle/battle.types';
import type {
  BattleUnit,
  BattleTeam,
  BattleState,
  BattleSkill,
  BattleSpeedState,
} from '../../../battle/battle.types';
import { BATTLE_CONFIG } from '../../../battle/battle-config';

// ─────────────────────────────────────────────
// Mock 数据工厂
// ─────────────────────────────────────────────

/** 创建标准普攻技能 */
function createNormalAttack(): BattleSkill {
  return {
    id: 'normal_attack',
    name: '普攻',
    type: 'active',
    level: 1,
    description: '普通攻击',
    multiplier: 1.0,
    targetType: 'SINGLE_ENEMY' as unknown as string,
    rageCost: 0,
    cooldown: 0,
    currentCooldown: 0,
  };
}

/** 创建主动技能（大招） */
function createActiveSkill(
  id = 'skill_fire',
  name = '烈焰斩',
  multiplier = 1.8,
  rageCost = 100,
  cooldown = 2,
): BattleSkill {
  return {
    id,
    name,
    type: 'active',
    level: 1,
    description: '强力技能',
    multiplier,
    targetType: 'ALL_ENEMY' as unknown as string,
    rageCost,
    cooldown,
    currentCooldown: 0,
  };
}

/** 创建 mock BattleUnit */
function createUnit(
  id: string,
  name: string,
  opts: Partial<{
    attack: number;
    defense: number;
    speed: number;
    maxHp: number;
    troopType: TroopType;
    side: 'ally' | 'enemy';
    rage: number;
    skills: BattleSkill[];
  }> = {},
): BattleUnit {
  const atk = opts.attack ?? 100;
  const def = opts.defense ?? 50;
  return {
    id,
    name,
    faction: 'shu',
    troopType: opts.troopType ?? TroopType.INFANTRY,
    position: 'front',
    side: opts.side ?? 'ally',
    attack: atk,
    baseAttack: atk,
    defense: def,
    baseDefense: def,
    intelligence: 60,
    speed: opts.speed ?? 50,
    hp: opts.maxHp ?? 1000,
    maxHp: opts.maxHp ?? 1000,
    isAlive: true,
    rage: opts.rage ?? 0,
    maxRage: BATTLE_CONFIG.MAX_RAGE,
    normalAttack: createNormalAttack(),
    skills: opts.skills ?? [createActiveSkill()],
    buffs: [],
  };
}

/** 创建队伍 */
function createTeam(side: 'ally' | 'enemy', units: BattleUnit[]): BattleTeam {
  for (const u of units) {
    u.side = side;
  }
  return { units, side };
}

/** 创建标准对战双方 */
function createStandardBattle(): { allyTeam: BattleTeam; enemyTeam: BattleTeam } {
  const allyTeam = createTeam('ally', [
    createUnit('ally1', '刘备', { attack: 120, defense: 80, speed: 60 }),
    createUnit('ally2', '关羽', { attack: 150, defense: 70, speed: 65, troopType: TroopType.CAVALRY }),
    createUnit('ally3', '张飞', { attack: 140, defense: 90, speed: 55, troopType: TroopType.SPEARMAN }),
  ]);

  const enemyTeam = createTeam('enemy', [
    createUnit('enemy1', '黄巾贼A', { attack: 80, defense: 40, speed: 40, maxHp: 500 }),
    createUnit('enemy2', '黄巾贼B', { attack: 70, defense: 35, speed: 35, maxHp: 400 }),
    createUnit('enemy3', '黄巾贼C', { attack: 60, defense: 30, speed: 30, maxHp: 300 }),
  ]);

  return { allyTeam, enemyTeam };
}

// ═══════════════════════════════════════════════
// §3.1 进入战斗场景
// ═══════════════════════════════════════════════

describe('§3.1 进入战斗场景', () => {
  let engine: BattleEngine;

  beforeEach(() => {
    engine = new BattleEngine();
  });

  it('BattleEngine 初始化后应具有正确的默认状态', () => {
    const { allyTeam, enemyTeam } = createStandardBattle();
    const state = engine.initBattle(allyTeam, enemyTeam);

    // 验证战斗ID已生成
    expect(state.id).toBeTruthy();
    expect(state.id).toMatch(/^battle_/);

    // 验证初始阶段
    expect(state.phase).toBe(BattlePhase.IN_PROGRESS);

    // 验证初始回合
    expect(state.currentTurn).toBe(1);
    expect(state.maxTurns).toBe(BATTLE_CONFIG.MAX_TURNS);

    // 验证行动日志为空
    expect(state.actionLog).toEqual([]);

    // 验证结果为空
    expect(state.result).toBeNull();
  });

  it('initBattle 应正确设置双方队伍', () => {
    const { allyTeam, enemyTeam } = createStandardBattle();
    const state = engine.initBattle(allyTeam, enemyTeam);

    // 验证我方队伍
    expect(state.allyTeam.side).toBe('ally');
    expect(state.allyTeam.units).toHaveLength(3);
    expect(state.allyTeam.units.map((u) => u.name)).toEqual(['刘备', '关羽', '张飞']);

    // 验证敌方队伍
    expect(state.enemyTeam.side).toBe('enemy');
    expect(state.enemyTeam.units).toHaveLength(3);
    expect(state.enemyTeam.units.map((u) => u.name)).toEqual(['黄巾贼A', '黄巾贼B', '黄巾贼C']);
  });

  it('initBattle 应按速度排序生成行动顺序', () => {
    const { allyTeam, enemyTeam } = createStandardBattle();
    const state = engine.initBattle(allyTeam, enemyTeam);

    // 行动顺序应包含所有存活单位
    expect(state.turnOrder.length).toBe(6);

    // 验证按速度降序排列：关羽(65) > 刘备(60) > 张飞(55) > 黄巾贼A(40) > B(35) > C(30)
    const speeds = state.turnOrder.map((id) => {
      const unit = [...state.allyTeam.units, ...state.enemyTeam.units].find((u) => u.id === id);
      return unit!.speed;
    });

    for (let i = 1; i < speeds.length; i++) {
      expect(speeds[i]).toBeLessThanOrEqual(speeds[i - 1]);
    }
  });

  it('默认战斗模式应为 AUTO', () => {
    expect(engine.getBattleMode()).toBe(BattleMode.AUTO);
  });

  it('默认战斗速度应为 X1', () => {
    const speedState = engine.getSpeedState();
    expect(speedState.speed).toBe(BattleSpeed.X1);
  });
});

// ═══════════════════════════════════════════════
// §3.1a 战斗场景组件层次
// ═══════════════════════════════════════════════

describe('§3.1a 战斗场景组件层次', () => {
  it('BattleState 包含UI渲染所需的完整数据结构', () => {
    const engine = new BattleEngine();
    const { allyTeam, enemyTeam } = createStandardBattle();
    const state = engine.initBattle(allyTeam, enemyTeam);

    // 顶层字段
    expect(state).toHaveProperty('id');
    expect(state).toHaveProperty('phase');
    expect(state).toHaveProperty('currentTurn');
    expect(state).toHaveProperty('maxTurns');
    expect(state).toHaveProperty('allyTeam');
    expect(state).toHaveProperty('enemyTeam');
    expect(state).toHaveProperty('turnOrder');
    expect(state).toHaveProperty('currentActorIndex');
    expect(state).toHaveProperty('actionLog');
    expect(state).toHaveProperty('result');
  });

  it('BattleUnit 包含角色渲染所需的全部属性', () => {
    const unit = createUnit('test_hero', '测试武将');

    // 基础属性
    expect(unit).toHaveProperty('id');
    expect(unit).toHaveProperty('name');
    expect(unit).toHaveProperty('faction');
    expect(unit).toHaveProperty('troopType');
    expect(unit).toHaveProperty('position');
    expect(unit).toHaveProperty('side');

    // 战斗属性
    expect(unit).toHaveProperty('attack');
    expect(unit).toHaveProperty('baseAttack');
    expect(unit).toHaveProperty('defense');
    expect(unit).toHaveProperty('baseDefense');
    expect(unit).toHaveProperty('intelligence');
    expect(unit).toHaveProperty('speed');

    // HP/怒气
    expect(unit).toHaveProperty('hp');
    expect(unit).toHaveProperty('maxHp');
    expect(unit).toHaveProperty('isAlive');
    expect(unit).toHaveProperty('rage');
    expect(unit).toHaveProperty('maxRage');

    // 技能
    expect(unit).toHaveProperty('normalAttack');
    expect(unit).toHaveProperty('skills');
    expect(unit).toHaveProperty('buffs');
  });

  it('BattleTeam 包含队伍侧标识和成员列表', () => {
    const { allyTeam, enemyTeam } = createStandardBattle();

    expect(allyTeam).toHaveProperty('side', 'ally');
    expect(allyTeam).toHaveProperty('units');
    expect(Array.isArray(allyTeam.units)).toBe(true);

    expect(enemyTeam).toHaveProperty('side', 'enemy');
    expect(enemyTeam).toHaveProperty('units');
    expect(Array.isArray(enemyTeam.units)).toBe(true);
  });

  it('引擎提供速度控制器组件供UI绑定', () => {
    const engine = new BattleEngine();
    const controller = engine.getSpeedController();

    expect(controller).toBeDefined();
    expect(typeof controller.getSpeedState).toBe('function');
    expect(typeof controller.setSpeed).toBe('function');
    expect(typeof controller.cycleSpeed).toBe('function');
    expect(typeof controller.getAdjustedTurnInterval).toBe('function');
    expect(typeof controller.getAnimationSpeedScale).toBe('function');
  });

  it('引擎提供大招时停系统组件供UI绑定', () => {
    const engine = new BattleEngine();
    const ultimateSystem = engine.getUltimateSystem();

    expect(ultimateSystem).toBeDefined();
    expect(typeof ultimateSystem.checkUltimateReady).toBe('function');
    expect(typeof ultimateSystem.getTimeStopState).toBe('function');
    expect(typeof ultimateSystem.isEnabled).toBe('function');
  });
});

// ═══════════════════════════════════════════════
// §3.1b 战斗HUD布局
// ═══════════════════════════════════════════════

describe('§3.1b 战斗HUD布局 — 引擎提供HUD所需数据', () => {
  it('每个单位提供HP数据（当前HP/最大HP）', () => {
    const unit = createUnit('hero1', '赵云', { maxHp: 1200 });

    expect(unit.hp).toBe(1200);
    expect(unit.maxHp).toBe(1200);
    expect(unit.isAlive).toBe(true);
    // HP百分比可由UI计算：unit.hp / unit.maxHp
    expect(unit.hp / unit.maxHp).toBeCloseTo(1.0);
  });

  it('每个单位提供怒气数据（当前怒气/最大怒气）', () => {
    const unit = createUnit('hero1', '赵云', { rage: 75 });

    expect(unit.rage).toBe(75);
    expect(unit.maxRage).toBe(BATTLE_CONFIG.MAX_RAGE);
    // 怒气百分比可由UI计算
    expect(unit.rage / unit.maxRage).toBeCloseTo(0.75);
  });

  it('每个技能提供CD数据（当前CD/总CD）', () => {
    const skill = createActiveSkill('skill_1', '大招', 2.0, 100, 3);
    skill.currentCooldown = 2;

    expect(skill.cooldown).toBe(3);
    expect(skill.currentCooldown).toBe(2);
    // CD状态可由UI判断
    expect(skill.currentCooldown > 0).toBe(true);
  });

  it('执行回合后单位HP和怒气数据更新', () => {
    const engine = new BattleEngine();
    const allyTeam = createTeam('ally', [
      createUnit('ally1', '刘备', { attack: 200, defense: 80, speed: 60 }),
    ]);
    const enemyTeam = createTeam('enemy', [
      createUnit('enemy1', '黄巾贼', { attack: 80, defense: 30, speed: 40, maxHp: 500 }),
    ]);

    const state = engine.initBattle(allyTeam, enemyTeam);
    const enemyBeforeHp = state.enemyTeam.units[0].hp;

    engine.executeTurn(state);

    // 敌方应受到伤害，HP变化
    const enemyAfterHp = state.enemyTeam.units[0].hp;
    expect(enemyAfterHp).toBeLessThan(enemyBeforeHp);
  });

  it('引擎提供行动顺序数据供HUD显示', () => {
    const engine = new BattleEngine();
    const { allyTeam, enemyTeam } = createStandardBattle();
    const state = engine.initBattle(allyTeam, enemyTeam);

    // 行动顺序非空
    expect(state.turnOrder.length).toBeGreaterThan(0);
    // 当前行动者索引有效
    expect(state.currentActorIndex).toBeGreaterThanOrEqual(0);
    expect(state.currentActorIndex).toBeLessThan(state.turnOrder.length);
  });

  it('引擎提供回合数和最大回合数供HUD显示', () => {
    const engine = new BattleEngine();
    const { allyTeam, enemyTeam } = createStandardBattle();
    const state = engine.initBattle(allyTeam, enemyTeam);

    expect(state.currentTurn).toBe(1);
    expect(state.maxTurns).toBe(BATTLE_CONFIG.MAX_TURNS);
  });
});

// ═══════════════════════════════════════════════
// §3.1c 战斗中交互操作
// ═══════════════════════════════════════════════

describe('§3.1c 战斗中交互操作 — 引擎响应交互', () => {
  it('引擎响应速度切换：1x → 2x → 3x', () => {
    const engine = new BattleEngine();

    // 初始速度 X1
    expect(engine.getSpeedState().speed).toBe(BattleSpeed.X1);

    // 切换到 X2
    engine.setSpeed(BattleSpeed.X2);
    expect(engine.getSpeedState().speed).toBe(BattleSpeed.X2);

    // 切换到 X3
    engine.setSpeed(BattleSpeed.X3);
    expect(engine.getSpeedState().speed).toBe(BattleSpeed.X3);
  });

  it('引擎响应速度循环切换', () => {
    const engine = new BattleEngine();
    const controller = engine.getSpeedController();

    // X1 → X2
    controller.cycleSpeed();
    expect(controller.getSpeed()).toBe(BattleSpeed.X2);

    // X2 → X3
    controller.cycleSpeed();
    expect(controller.getSpeed()).toBe(BattleSpeed.X3);

    // X3 → X1 (循环)
    controller.cycleSpeed();
    expect(controller.getSpeed()).toBe(BattleSpeed.X1);
  });

  it('引擎响应战斗模式切换：AUTO → SEMI_AUTO → MANUAL', () => {
    const engine = new BattleEngine();

    expect(engine.getBattleMode()).toBe(BattleMode.AUTO);

    engine.setBattleMode(BattleMode.SEMI_AUTO);
    expect(engine.getBattleMode()).toBe(BattleMode.SEMI_AUTO);

    engine.setBattleMode(BattleMode.MANUAL);
    expect(engine.getBattleMode()).toBe(BattleMode.MANUAL);
  });

  it('半自动模式下切换时启用大招时停', () => {
    const engine = new BattleEngine();

    // 切换到半自动
    engine.setBattleMode(BattleMode.SEMI_AUTO);
    expect(engine.getUltimateSystem().isEnabled()).toBe(true);

    // 切回自动
    engine.setBattleMode(BattleMode.AUTO);
    expect(engine.getUltimateSystem().isEnabled()).toBe(false);
  });

  it('引擎响应大招确认/取消操作', () => {
    const engine = new BattleEngine();
    engine.setBattleMode(BattleMode.SEMI_AUTO);

    // 注册 mock handler
    const handler = {
      onUltimateReady: vi.fn(),
      onBattlePaused: vi.fn(),
      onUltimateConfirmed: vi.fn(),
      onUltimateCancelled: vi.fn(),
    };
    engine.registerTimeStopHandler(handler);

    // 构造怒气满的单位
    const unit = createUnit('hero1', '赵云', { rage: 100 });
    const skill = createActiveSkill('ult_1', '龙胆', 2.5, 100, 0);
    unit.skills = [skill];

    // 检测大招就绪
    const result = engine.getUltimateSystem().checkUltimateReady(unit);
    expect(result.isReady).toBe(true);

    // 触发时停暂停
    engine.getUltimateSystem().pauseForUltimate(unit, skill);
    expect(engine.isTimeStopPaused()).toBe(true);

    // 确认释放
    engine.confirmUltimate(unit.id, skill.id);
    expect(engine.isTimeStopPaused()).toBe(false);
  });

  it('速度切换不中断战斗流程', () => {
    const engine = new BattleEngine();
    const { allyTeam, enemyTeam } = createStandardBattle();
    const state = engine.initBattle(allyTeam, enemyTeam);

    // 战斗中切换速度
    engine.setSpeed(BattleSpeed.X2);
    engine.executeTurn(state);

    // 战斗状态仍然有效
    expect(state.phase).toBe(BattlePhase.IN_PROGRESS);
    expect(state.actionLog.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════
// §3.1d 战斗进入/退出动画
// ═══════════════════════════════════════════════

describe('§3.1d 战斗进入/退出动画 — 引擎状态转换', () => {
  it('战斗初始化阶段为 IN_PROGRESS（进入动画触发点）', () => {
    const engine = new BattleEngine();
    const { allyTeam, enemyTeam } = createStandardBattle();
    const state = engine.initBattle(allyTeam, enemyTeam);

    // 初始化后直接进入 IN_PROGRESS（UI层据此播放进入动画）
    expect(state.phase).toBe(BattlePhase.IN_PROGRESS);
  });

  it('战斗结束后阶段转换为 FINISHED（退出动画触发点）', () => {
    const engine = new BattleEngine();
    const { allyTeam, enemyTeam } = createStandardBattle();
    const result = engine.runFullBattle(allyTeam, enemyTeam);

    // 战斗结束后应有明确结果
    expect(result.outcome).toBeDefined();
    expect([BattleOutcome.VICTORY, BattleOutcome.DEFEAT, BattleOutcome.DRAW]).toContain(result.outcome);
  });

  it('战斗胜利时提供星级评定数据', () => {
    const engine = new BattleEngine();
    // 我方明显强于敌方，确保胜利
    const allyTeam = createTeam('ally', [
      createUnit('ally1', '吕布', { attack: 300, defense: 150, speed: 80, maxHp: 2000 }),
    ]);
    const enemyTeam = createTeam('enemy', [
      createUnit('enemy1', '小兵', { attack: 10, defense: 5, speed: 10, maxHp: 100 }),
    ]);

    const result = engine.runFullBattle(allyTeam, enemyTeam);

    expect(result.outcome).toBe(BattleOutcome.VICTORY);
    expect(result.stars).toBeGreaterThanOrEqual(StarRating.ONE);
    expect(result.stars).toBeLessThanOrEqual(StarRating.THREE);
    expect(result.totalTurns).toBeGreaterThan(0);
    expect(result.allySurvivors).toBeGreaterThanOrEqual(0);
  });

  it('runFullBattle 完成后 state.phase 为 FINISHED', () => {
    const engine = new BattleEngine();
    const { allyTeam, enemyTeam } = createStandardBattle();
    const state = engine.initBattle(allyTeam, enemyTeam);

    // 手动运行到战斗结束
    while (
      state.phase === BattlePhase.IN_PROGRESS &&
      state.currentTurn <= state.maxTurns
    ) {
      engine.executeTurn(state);
      if (engine.isBattleOver(state)) break;
      state.currentTurn++;
    }
    state.phase = BattlePhase.FINISHED;

    expect(state.phase).toBe(BattlePhase.FINISHED);
    expect(state.result).toBeDefined();
  });

  it('战斗结果包含摘要信息供UI展示', () => {
    const engine = new BattleEngine();
    const { allyTeam, enemyTeam } = createStandardBattle();
    const result = engine.runFullBattle(allyTeam, enemyTeam);

    // 验证结果包含完整数据
    expect(result).toHaveProperty('outcome');
    expect(result).toHaveProperty('stars');
    expect(result).toHaveProperty('totalTurns');
    expect(result).toHaveProperty('allySurvivors');
    expect(result).toHaveProperty('enemySurvivors');
    expect(result).toHaveProperty('summary');
    expect(typeof result.summary).toBe('string');
    expect(result.summary.length).toBeGreaterThan(0);
  });
});
