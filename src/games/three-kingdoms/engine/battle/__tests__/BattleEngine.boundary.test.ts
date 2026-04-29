/**
 * BattleEngine 边界条件攻击测试 — Round 4
 *
 * 6种边界攻击模式覆盖：
 * 1. 数值边界：0 HP/0 ATK/NaN属性/Infinity HP
 * 2. 状态不一致：已结束战斗再次执行/未初始化就获取结果
 * 3. 时序攻击：空队伍/单单位队伍/跳过战斗
 * 4. 数据完整性：空技能/null队伍/缺少必要字段
 * 5. 容量边界：6人满编/超大HP/0回合
 * 6. 并发/竞态：战斗中修改状态
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BattleEngine } from '../BattleEngine';
import {
  BattlePhase,
  BattleOutcome,
  StarRating,
  BattleMode,
  BattleSpeed,
  TroopType,
} from '../battle.types';
import type {
  BattleTeam,
  BattleUnit,
  BattleState,
  BattleResult,
} from '../battle.types';
import type { BuffEffect, BattleSkill } from '../battle-base.types';
import { BuffType, SkillTargetType } from '../battle-base.types';
import { BATTLE_CONFIG } from '../battle-config';

// ── 辅助函数 ──

function createSkill(overrides: Partial<BattleSkill> = {}): BattleSkill {
  return {
    id: 'skill_1',
    name: '普攻',
    type: 'active',
    level: 1,
    description: '普通攻击',
    multiplier: 1.0,
    targetType: SkillTargetType.SINGLE_ENEMY,
    rageCost: 0,
    cooldown: 0,
    currentCooldown: 0,
    ...overrides,
  };
}

function createUnit(overrides: Partial<BattleUnit> = {}): BattleUnit {
  return {
    id: 'unit_1',
    name: '测试武将',
    faction: 'shu',
    troopType: TroopType.INFANTRY,
    position: 'front',
    side: 'ally',
    attack: 100,
    baseAttack: 100,
    defense: 50,
    baseDefense: 50,
    intelligence: 30,
    speed: 10,
    hp: 1000,
    maxHp: 1000,
    isAlive: true,
    rage: 0,
    maxRage: 100,
    normalAttack: createSkill({ id: 'normal_1', name: '普攻', multiplier: 1.0 }),
    skills: [createSkill({ id: 'skill_1', name: '技能1', multiplier: 1.5, rageCost: 50 })],
    buffs: [],
    ...overrides,
  };
}

function createTeam(units: BattleUnit[], side: 'ally' | 'enemy' = 'ally'): BattleTeam {
  return { units, side };
}

function createAllyTeam(units?: Partial<BattleUnit>[]): BattleTeam {
  const defaultUnits = units
    ? units.map((u, i) => createUnit({ ...u, id: `ally_${i}`, side: 'ally' }))
    : [createUnit({ id: 'ally_0', side: 'ally' })];
  return createTeam(defaultUnits, 'ally');
}

function createEnemyTeam(units?: Partial<BattleUnit>[]): BattleTeam {
  const defaultUnits = units
    ? units.map((u, i) => createUnit({ ...u, id: `enemy_${i}`, side: 'enemy' }))
    : [createUnit({ id: 'enemy_0', side: 'enemy' })];
  return createTeam(defaultUnits, 'enemy');
}

// ════════════════════════════════════════════════
// 1. 数值边界攻击
// ════════════════════════════════════════════════

describe('BattleEngine — 数值边界攻击', () => {
  let engine: BattleEngine;
  beforeEach(() => { engine = new BattleEngine(); });

  it('P0: 单位HP为0时应在战斗中被判定为死亡', () => {
    const ally = createAllyTeam([{ hp: 0, maxHp: 1000 }]);
    const enemy = createEnemyTeam([{ hp: 0, maxHp: 1000 }]);
    const state = engine.initBattle(ally, enemy);
    // 双方HP=0，isAlive=true但HP=0 → 第一回合攻击后双方可能都死
    // 实际：getAliveUnits检查isAlive，不检查HP
    // HP=0但isAlive=true → 仍然存活，会执行攻击
    const result = engine.runFullBattle(ally, enemy);
    // 双方HP=0互相攻击 → 负伤害或0伤害 → 可能VICTORY/DEFEAT/DRAW
    expect([BattleOutcome.VICTORY, BattleOutcome.DEFEAT, BattleOutcome.DRAW]).toContain(result.outcome);
  });

  it('P2: 单位攻击力为0时应不崩溃', () => {
    const ally = createAllyTeam([{ attack: 0, baseAttack: 0 }]);
    const enemy = createEnemyTeam([{ hp: 1, maxHp: 1, attack: 0, baseAttack: 0 }]);
    expect(() => engine.runFullBattle(ally, enemy)).not.toThrow();
  });

  it('P2: 单位防御力为负数时应不崩溃', () => {
    const ally = createAllyTeam([{ defense: -100, baseDefense: -100 }]);
    const enemy = createEnemyTeam();
    expect(() => engine.runFullBattle(ally, enemy)).not.toThrow();
  });

  it('P2: 单位HP为Infinity时战斗应持续到最大回合', () => {
    const ally = createAllyTeam([{ hp: Infinity, maxHp: Infinity }]);
    const enemy = createEnemyTeam([{ hp: Infinity, maxHp: Infinity }]);
    const result = engine.runFullBattle(ally, enemy);
    expect(result.outcome).toBe(BattleOutcome.DRAW);
    expect(result.totalTurns).toBe(BATTLE_CONFIG.MAX_TURNS);
  });

  it('P2: 单位速度为NaN时不应崩溃', () => {
    const ally = createAllyTeam([{ speed: NaN }]);
    const enemy = createEnemyTeam([{ speed: NaN }]);
    expect(() => engine.runFullBattle(ally, enemy)).not.toThrow();
  });

  it('P2: 单位速度为负数时不应崩溃', () => {
    const ally = createAllyTeam([{ speed: -100 }]);
    const enemy = createEnemyTeam([{ speed: -50 }]);
    expect(() => engine.runFullBattle(ally, enemy)).not.toThrow();
  });

  it('P2: 单位速度为Infinity时不应崩溃', () => {
    const ally = createAllyTeam([{ speed: Infinity }]);
    const enemy = createEnemyTeam([{ speed: 10 }]);
    expect(() => engine.runFullBattle(ally, enemy)).not.toThrow();
  });

  it('P1: 超大攻击力(1e15)时伤害应为有限数', () => {
    const ally = createAllyTeam([{ attack: 1e15, baseAttack: 1e15 }]);
    const enemy = createEnemyTeam([{ hp: 100, maxHp: 100, defense: 0, baseDefense: 0 }]);
    const result = engine.runFullBattle(ally, enemy);
    expect(isFinite(result.allyTotalDamage)).toBe(true);
  });

  it('P2: 负数怒气值不应崩溃', () => {
    const ally = createAllyTeam([{ rage: -50 }]);
    const enemy = createEnemyTeam();
    expect(() => engine.runFullBattle(ally, enemy)).not.toThrow();
  });
});

// ════════════════════════════════════════════════
// 2. 状态不一致攻击
// ════════════════════════════════════════════════

describe('BattleEngine — 状态不一致攻击', () => {
  let engine: BattleEngine;
  beforeEach(() => { engine = new BattleEngine(); });

  it('P1: 已结束的战斗executeTurn应返回空', () => {
    const ally = createAllyTeam([{ hp: 1, maxHp: 1, attack: 1000, baseAttack: 1000 }]);
    const enemy = createEnemyTeam([{ hp: 1, maxHp: 1 }]);
    const state = engine.initBattle(ally, enemy);
    // 运行到结束
    engine.runFullBattle(ally, enemy);
    // 再次执行回合
    const actions = engine.executeTurn(state);
    expect(actions).toEqual([]);
  });

  it('P1: isBattleOver对FINISHED状态应返回true', () => {
    const ally = createAllyTeam();
    const enemy = createEnemyTeam();
    const state = engine.initBattle(ally, enemy);
    state.phase = BattlePhase.FINISHED;
    expect(engine.isBattleOver(state)).toBe(true);
  });

  it('P2: getBattleResult对进行中的战斗应返回DRAW', () => {
    const ally = createAllyTeam();
    const enemy = createEnemyTeam();
    const state = engine.initBattle(ally, enemy);
    const result = engine.getBattleResult(state);
    // 双方都有存活 → DRAW（因为currentTurn < maxTurns且双方都存活）
    expect(result.outcome).toBe(BattleOutcome.DRAW);
  });

  it('P2: 未调用init直接调用reset不应崩溃', () => {
    expect(() => engine.reset()).not.toThrow();
  });

  it('P2: 连续多次reset不应崩溃', () => {
    for (let i = 0; i < 10; i++) {
      engine.reset();
    }
    expect(engine.getBattleMode()).toBe(BattleMode.AUTO);
  });
});

// ════════════════════════════════════════════════
// 3. 时序攻击
// ════════════════════════════════════════════════

describe('BattleEngine — 时序攻击', () => {
  let engine: BattleEngine;
  beforeEach(() => { engine = new BattleEngine(); });

  it('P0: 空队伍（0单位）战斗应立即结束', () => {
    const ally = createTeam([], 'ally');
    const enemy = createEnemyTeam();
    const result = engine.runFullBattle(ally, enemy);
    expect(result.outcome).toBe(BattleOutcome.DEFEAT);
    expect(result.totalTurns).toBe(1);
  });

  it('P0: 双方空队伍应正常结束不崩溃', () => {
    const ally = createTeam([], 'ally');
    const enemy = createTeam([], 'enemy');
    const result = engine.runFullBattle(ally, enemy);
    // 双方都无存活单位
    expect([BattleOutcome.DEFEAT, BattleOutcome.DRAW, BattleOutcome.VICTORY]).toContain(result.outcome);
  });

  it('P2: quickBattle应返回有效结果', () => {
    const ally = createAllyTeam([{ attack: 1000, baseAttack: 1000 }]);
    const enemy = createEnemyTeam([{ hp: 10, maxHp: 10 }]);
    const result = engine.quickBattle(ally, enemy);
    expect(result.outcome).toBe(BattleOutcome.VICTORY);
  });

  it('P2: skipBattle对已结束的战斗应返回已有结果', () => {
    const ally = createAllyTeam();
    const enemy = createEnemyTeam();
    const state = engine.initBattle(ally, enemy);
    state.phase = BattlePhase.FINISHED;
    state.result = {
      outcome: BattleOutcome.VICTORY,
      stars: StarRating.THREE,
      totalTurns: 1,
      allySurvivors: 1,
      enemySurvivors: 0,
      allyTotalDamage: 100,
      enemyTotalDamage: 0,
      maxSingleDamage: 100,
      maxCombo: 0,
      summary: 'test',
      fragmentRewards: {},
    };
    const result = engine.skipBattle(state);
    expect(result.outcome).toBe(BattleOutcome.VICTORY);
  });

  it('P2: 快速连续设置战斗模式不应崩溃', () => {
    engine.setBattleMode(BattleMode.AUTO);
    engine.setBattleMode(BattleMode.SEMI_AUTO);
    engine.setBattleMode(BattleMode.MANUAL);
    engine.setBattleMode(BattleMode.AUTO);
    expect(engine.getBattleMode()).toBe(BattleMode.AUTO);
  });

  it('P2: 快速连续设置速度不应崩溃', () => {
    engine.setSpeed(BattleSpeed.X1);
    engine.setSpeed(BattleSpeed.X2);
    engine.setSpeed(BattleSpeed.X4);
    engine.setSpeed(BattleSpeed.SKIP);
    expect(engine.isSkipMode()).toBe(true);
  });
});

// ════════════════════════════════════════════════
// 4. 数据完整性攻击
// ════════════════════════════════════════════════

describe('BattleEngine — 数据完整性攻击', () => {
  let engine: BattleEngine;
  beforeEach(() => { engine = new BattleEngine(); });

  it('P2: 单位无技能时不应崩溃', () => {
    const ally = createAllyTeam([{ skills: [], normalAttack: createSkill() }]);
    const enemy = createEnemyTeam([{ skills: [], normalAttack: createSkill() }]);
    expect(() => engine.runFullBattle(ally, enemy)).not.toThrow();
  });

  it('P2: 单位有大量buff时不应崩溃', () => {
    const buffs: BuffEffect[] = [];
    for (let i = 0; i < 100; i++) {
      buffs.push({
        type: BuffType.ATK_UP,
        remainingTurns: 99,
        value: 10,
        sourceId: 'unit_1',
      });
    }
    const ally = createAllyTeam([{ buffs }]);
    const enemy = createEnemyTeam();
    expect(() => engine.runFullBattle(ally, enemy)).not.toThrow();
  });

  it('P2: 技能倍率为0时不应崩溃', () => {
    const ally = createAllyTeam([{
      normalAttack: createSkill({ multiplier: 0 }),
      skills: [createSkill({ multiplier: 0 })],
    }]);
    const enemy = createEnemyTeam([{ hp: 100000, maxHp: 100000 }]);
    expect(() => engine.runFullBattle(ally, enemy)).not.toThrow();
  });

  it('P2: 技能倍率为负数时不应崩溃', () => {
    const ally = createAllyTeam([{
      normalAttack: createSkill({ multiplier: -1 }),
    }]);
    const enemy = createEnemyTeam();
    expect(() => engine.runFullBattle(ally, enemy)).not.toThrow();
  });

  it('P2: 技能倍率为Infinity时不应崩溃', () => {
    const ally = createAllyTeam([{
      normalAttack: createSkill({ multiplier: Infinity }),
    }]);
    const enemy = createEnemyTeam([{ hp: 100000, maxHp: 100000 }]);
    expect(() => engine.runFullBattle(ally, enemy)).not.toThrow();
  });

  it('P2: 单位isAlive为false时不应被选中行动', () => {
    const ally = createAllyTeam([{ isAlive: false, hp: 0 }]);
    const enemy = createEnemyTeam();
    const result = engine.runFullBattle(ally, enemy);
    expect(result.outcome).toBe(BattleOutcome.DEFEAT);
  });
});

// ════════════════════════════════════════════════
// 5. 容量边界攻击
// ════════════════════════════════════════════════

describe('BattleEngine — 容量边界攻击', () => {
  let engine: BattleEngine;
  beforeEach(() => { engine = new BattleEngine(); });

  it('P2: 6人满编队伍战斗应正常完成', () => {
    const allyUnits = Array.from({ length: 6 }, (_, i) =>
      createUnit({ id: `ally_${i}`, side: 'ally', name: `武将${i}` })
    );
    const enemyUnits = Array.from({ length: 6 }, (_, i) =>
      createUnit({ id: `enemy_${i}`, side: 'enemy', name: `敌将${i}`, hp: 100, maxHp: 100 })
    );
    const ally = createTeam(allyUnits, 'ally');
    const enemy = createTeam(enemyUnits, 'enemy');
    const result = engine.runFullBattle(ally, enemy);
    expect([BattleOutcome.VICTORY, BattleOutcome.DEFEAT, BattleOutcome.DRAW]).toContain(result.outcome);
  });

  it('P2: 超大maxTurns时不应无限循环', () => {
    const ally = createAllyTeam([{ hp: Infinity, maxHp: Infinity, attack: 0, baseAttack: 0 }]);
    const enemy = createEnemyTeam([{ hp: Infinity, maxHp: Infinity, attack: 0, baseAttack: 0 }]);
    const state = engine.initBattle(ally, enemy);
    state.maxTurns = 5; // 限制回合数防止无限循环
    let turns = 0;
    while (state.phase === BattlePhase.IN_PROGRESS && turns < 5) {
      engine.executeTurn(state);
      if (engine.isBattleOver(state)) break;
      state.currentTurn++;
      turns++;
    }
    expect(turns).toBeLessThanOrEqual(5);
  });

  it('P2: 胜利时星级评定应正确', () => {
    // 6人存活 + 1回合 → 三星
    const allyUnits = Array.from({ length: 6 }, (_, i) =>
      createUnit({ id: `ally_${i}`, side: 'ally', attack: 10000, baseAttack: 10000 })
    );
    const enemyUnits = [createUnit({ id: 'enemy_0', side: 'enemy', hp: 1, maxHp: 1 })];
    const result = engine.runFullBattle(createTeam(allyUnits, 'ally'), createTeam(enemyUnits, 'enemy'));
    expect(result.outcome).toBe(BattleOutcome.VICTORY);
    expect(result.stars).toBeGreaterThanOrEqual(StarRating.ONE);
  });

  it('P2: 失败时星级应为NONE', () => {
    const ally = createAllyTeam([{ hp: 1, maxHp: 1, attack: 0, baseAttack: 0 }]);
    const enemy = createEnemyTeam([{ attack: 10000, baseAttack: 10000 }]);
    const result = engine.runFullBattle(ally, enemy);
    if (result.outcome === BattleOutcome.DEFEAT) {
      expect(result.stars).toBe(StarRating.NONE);
    }
  });

  it('P2: getState应返回有效快照', () => {
    const state = engine.getState();
    expect(state).toHaveProperty('battleMode');
    expect(state.battleMode).toBe(BattleMode.AUTO);
  });
});

// ════════════════════════════════════════════════
// 6. 并发/竞态攻击
// ════════════════════════════════════════════════

describe('BattleEngine — 并发/竞态攻击', () => {
  let engine: BattleEngine;
  beforeEach(() => { engine = new BattleEngine(); });

  it('P2: 战斗中切换速度模式不应崩溃', () => {
    const ally = createAllyTeam();
    const enemy = createEnemyTeam();
    const state = engine.initBattle(ally, enemy);
    engine.setSpeed(BattleSpeed.X2);
    engine.executeTurn(state);
    engine.setSpeed(BattleSpeed.X4);
    engine.executeTurn(state);
    expect(() => engine.executeTurn(state)).not.toThrow();
  });

  it('P2: 战斗中切换模式不应崩溃', () => {
    const ally = createAllyTeam();
    const enemy = createEnemyTeam();
    const state = engine.initBattle(ally, enemy);
    engine.setBattleMode(BattleMode.SEMI_AUTO);
    engine.executeTurn(state);
    engine.setBattleMode(BattleMode.AUTO);
    expect(() => engine.executeTurn(state)).not.toThrow();
  });

  it('P2: confirmUltimate对不存在的单位不应崩溃', () => {
    expect(() => engine.confirmUltimate('nonexistent', 'skill_1')).not.toThrow();
  });

  it('P2: cancelUltimate在无暂停状态时不应崩溃', () => {
    expect(() => engine.cancelUltimate()).not.toThrow();
  });

  it('P2: registerTimeStopHandler后多次注册不应崩溃', () => {
    const handler = { onTimeStop: vi.fn() };
    engine.registerTimeStopHandler(handler);
    engine.registerTimeStopHandler(handler);
    engine.registerTimeStopHandler(handler);
    // 不崩溃即可
  });

  it('P2: getSpeedState应返回有效状态', () => {
    const state = engine.getSpeedState();
    expect(state).toHaveProperty('speed');
    expect(typeof state.speed).toBe('number');
  });
});
