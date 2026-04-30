/**
 * 集成测试：战斗核心机制（§3.2 ~ §3.6）
 *
 * 覆盖 Play v3.0 攻城略地(上) 中的 5 个流程：
 *   §3.2 观察自动战斗：BattleEngine 自动执行回合
 *   §3.3 伤害计算验证：DamageCalculator 公式正确
 *   §3.4 技能释放观察：技能按 CD 和条件释放
 *   §3.5 兵种克制验证：克制关系影响伤害倍率
 *   §3.6 状态效果观察：buff/debuff 正确应用和移除
 *
 * 测试策略：使用 BattleEngine + DamageCalculator 引擎 API，
 * 通过 mock 数据构造战斗场景，验证完整战斗流程。
 */

import { BattleEngine } from '../../../battle/BattleEngine';
import { DamageCalculator } from '../../../battle/DamageCalculator';
import {
  BattlePhase,
  BattleOutcome,
  StarRating,
  TroopType,
  BuffType,
} from '../../../battle/battle.types';
import type {
  BattleUnit,
  BattleTeam,
  BattleState,
  BattleAction,
  BattleSkill,
  BuffEffect,
} from '../../../battle/battle.types';
import { BATTLE_CONFIG } from '../../../battle/battle-config';

// ─────────────────────────────────────────────
// Mock 数据工厂
// ─────────────────────────────────────────────

/** 创建一个标准普攻技能 */
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

/** 创建一个主动技能（大招） */
function createActiveSkill(
  id = 'skill_fire',
  name = '烈焰斩',
  multiplier = 1.8,
  rageCost = 100,
  cooldown = 2,
  buffs?: BuffEffect[],
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
    buffs,
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
    buffs: BuffEffect[];
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
    maxRage: 100,
    normalAttack: createNormalAttack(),
    skills: opts.skills ?? [createActiveSkill()],
    buffs: opts.buffs ?? [],
  };
}

/** 创建队伍（保持引用，修改 unit.side 而非拷贝） */
function createTeam(side: 'ally' | 'enemy', units: BattleUnit[]): BattleTeam {
  for (const u of units) {
    u.side = side;
  }
  return { units, side };
}

/** 创建标准对战双方 */
function createStandardBattle(): { allyTeam: BattleTeam; enemyTeam: BattleTeam } {
  const allyTeam = createTeam('ally', [
    createUnit('ally1', '刘备', { attack: 120, defense: 80, speed: 60, troopType: TroopType.INFANTRY }),
    createUnit('ally2', '关羽', { attack: 150, defense: 70, speed: 65, troopType: TroopType.CAVALRY }),
    createUnit('ally3', '张飞', { attack: 140, defense: 90, speed: 55, troopType: TroopType.SPEARMAN }),
  ]);

  const enemyTeam = createTeam('enemy', [
    createUnit('enemy1', '黄巾贼A', { attack: 80, defense: 40, speed: 40, maxHp: 500, troopType: TroopType.INFANTRY }),
    createUnit('enemy2', '黄巾贼B', { attack: 70, defense: 35, speed: 35, maxHp: 400, troopType: TroopType.INFANTRY }),
    createUnit('enemy3', '黄巾贼C', { attack: 60, defense: 30, speed: 30, maxHp: 300, troopType: TroopType.INFANTRY }),
  ]);

  return { allyTeam, enemyTeam };
}

// ═══════════════════════════════════════════════
// §3.2 观察自动战斗
// ═══════════════════════════════════════════════

describe('§3.2 观察自动战斗', () => {
  let engine: BattleEngine;

  beforeEach(() => {
    engine = new BattleEngine();
  });

  it('§3.2 initBattle 创建正确的初始战斗状态', () => {
    const { allyTeam, enemyTeam } = createStandardBattle();
    const state = engine.initBattle(allyTeam, enemyTeam);

    expect(state.id).toBeTruthy();
    expect(state.phase).toBe(BattlePhase.IN_PROGRESS);
    expect(state.currentTurn).toBe(1);
    expect(state.maxTurns).toBe(BATTLE_CONFIG.MAX_TURNS);
    expect(state.allyTeam.units).toHaveLength(3);
    expect(state.enemyTeam.units).toHaveLength(3);
    expect(state.turnOrder.length).toBeGreaterThan(0);
    expect(state.actionLog).toHaveLength(0);
  });

  it('§3.2 executeTurn 返回行动记录', () => {
    const { allyTeam, enemyTeam } = createStandardBattle();
    const state = engine.initBattle(allyTeam, enemyTeam);
    const actions = engine.executeTurn(state);

    expect(actions.length).toBeGreaterThan(0);
    // 每个行动应有完整字段
    for (const action of actions) {
      expect(action.actorId).toBeTruthy();
      expect(action.actorName).toBeTruthy();
      expect(typeof action.turn).toBe('number');
    }
  });

  it('§3.2 runFullBattle 自动执行到结束', () => {
    const { allyTeam, enemyTeam } = createStandardBattle();
    const result = engine.runFullBattle(allyTeam, enemyTeam);

    expect([BattleOutcome.VICTORY, BattleOutcome.DEFEAT, BattleOutcome.DRAW]).toContain(
      result.outcome,
    );
    expect(result.totalTurns).toBeGreaterThan(0);
    expect(result.totalTurns).toBeLessThanOrEqual(BATTLE_CONFIG.MAX_TURNS);
  });

  it('§3.2 强方应战胜弱方', () => {
    // 极强我方 vs 极弱敌方
    const allyTeam = createTeam('ally', [
      createUnit('ally1', '吕布', { attack: 500, defense: 200, speed: 100, maxHp: 5000 }),
    ]);
    const enemyTeam = createTeam('enemy', [
      createUnit('enemy1', '小兵', { attack: 10, defense: 5, speed: 10, maxHp: 100 }),
    ]);

    const result = engine.runFullBattle(allyTeam, enemyTeam);
    expect(result.outcome).toBe(BattleOutcome.VICTORY);
  });

  it('§3.2 战斗结束后 phase 为 FINISHED', () => {
    const { allyTeam, enemyTeam } = createStandardBattle();
    const state = engine.initBattle(allyTeam, enemyTeam);
    engine.runFullBattle(allyTeam, enemyTeam);
    // state 由 runFullBattle 内部管理
    // 重新验证：quickBattle 路径
    const state2 = engine.initBattle(allyTeam, enemyTeam);
    while (state2.phase === BattlePhase.IN_PROGRESS && state2.currentTurn <= state2.maxTurns) {
      engine.executeTurn(state2);
      if (engine.isBattleOver(state2)) break;
      state2.currentTurn++;
    }
    expect(state2.phase).toBe(BattlePhase.FINISHED);
  });

  it('§3.2 isBattleOver 在一方全灭时返回 true', () => {
    const allyTeam = createTeam('ally', [
      createUnit('ally1', '张飞', { attack: 200, maxHp: 2000 }),
    ]);
    const enemyTeam = createTeam('enemy', [
      createUnit('enemy1', '小兵', { attack: 10, maxHp: 50 }),
    ]);
    const state = engine.initBattle(allyTeam, enemyTeam);

    // 模拟敌方全灭
    enemyTeam.units[0].hp = 0;
    enemyTeam.units[0].isAlive = false;
    expect(engine.isBattleOver(state)).toBe(true);
  });

  it('§3.2 行动顺序按速度降序排列', () => {
    const allyTeam = createTeam('ally', [
      createUnit('fast', '快', { speed: 100 }),
      createUnit('slow', '慢', { speed: 10 }),
    ]);
    const enemyTeam = createTeam('enemy', [
      createUnit('medium', '中', { speed: 50 }),
    ]);

    const state = engine.initBattle(allyTeam, enemyTeam);
    // turnOrder 第一个应为速度最高的单位
    expect(state.turnOrder[0]).toBe('fast');
  });

  it('§3.2 quickBattle 等价于 initBattle + skipBattle', () => {
    const { allyTeam, enemyTeam } = createStandardBattle();
    const result = engine.quickBattle(allyTeam, enemyTeam);
    expect(result.outcome).toBeDefined();
    expect(typeof result.totalTurns).toBe('number');
  });
});

// ═══════════════════════════════════════════════
// §3.3 伤害计算验证
// ═══════════════════════════════════════════════

describe('§3.3 伤害计算验证', () => {
  let calculator: DamageCalculator;

  beforeEach(() => {
    calculator = new DamageCalculator();
  });

  it('§3.3 基础伤害 = 攻击力 - 防御力（无buff时）', () => {
    const attacker = createUnit('atk', '攻击方', { attack: 200, defense: 50 });
    const defender = createUnit('def', '防御方', { attack: 50, defense: 80 });

    // 固定随机因子为1.0（通过多次采样取非暴击结果）
    const result = calculator.calculateDamage(attacker, defender, 1.0);
    // baseDamage = max(1, 200 - 80) = 120
    expect(result.baseDamage).toBe(120);
  });

  it('§3.3 技能倍率正确应用', () => {
    const attacker = createUnit('atk', '攻击方', { attack: 200, defense: 50, speed: 0 });
    const defender = createUnit('def', '防御方', { attack: 50, defense: 50 });

    const result1 = calculator.calculateDamage(attacker, defender, 1.0);
    const result2 = calculator.calculateDamage(attacker, defender, 2.0);

    // 倍率2.0的伤害应约为倍率1.0的2倍（忽略暴击和随机波动差异）
    expect(result2.skillMultiplier).toBe(2.0);
    expect(result2.baseDamage).toBe(result1.baseDamage);
  });

  it('§3.3 最低伤害保底 = 攻击力 × 10%', () => {
    // 极高防御 vs 低攻击
    const attacker = createUnit('atk', '弱攻', { attack: 50, defense: 10, speed: 0 });
    const defender = createUnit('def', '铁壁', { attack: 10, defense: 500 });

    const result = calculator.calculateDamage(attacker, defender, 1.0);
    // effectiveAttack = 50, minDamage = 50 * 0.1 = 5
    expect(result.isMinDamage).toBe(true);
    expect(result.damage).toBeGreaterThanOrEqual(Math.floor(50 * 0.1));
  });

  it('§3.3 applyDamage 正确扣除HP', () => {
    const defender = createUnit('def', '靶子', { maxHp: 1000 });
    defender.hp = 1000;

    const actual = calculator.applyDamage(defender, 300);
    expect(actual).toBe(300);
    expect(defender.hp).toBe(700);
  });

  it('§3.3 applyDamage HP不会低于0', () => {
    const defender = createUnit('def', '靶子', { maxHp: 100 });
    defender.hp = 50;

    const actual = calculator.applyDamage(defender, 200);
    expect(actual).toBe(50);
    expect(defender.hp).toBe(0);
    expect(defender.isAlive).toBe(false);
  });

  it('§3.3 applyDamage 对已死亡单位返回0', () => {
    const defender = createUnit('def', '已死', { maxHp: 100 });
    defender.hp = 0;
    defender.isAlive = false;

    const actual = calculator.applyDamage(defender, 100);
    expect(actual).toBe(0);
  });

  it('§3.3 护盾优先吸收伤害', () => {
    const defender = createUnit('def', '有盾', { maxHp: 1000 });
    defender.hp = 1000;
    defender.buffs = [
      { type: BuffType.SHIELD, remainingTurns: 2, value: 200, sourceId: 'healer' },
    ];

    calculator.applyDamage(defender, 150);
    // 护盾吸收150，HP不变
    expect(defender.hp).toBe(1000);
    // 护盾剩余50
    const shieldBuff = defender.buffs.find((b) => b.type === BuffType.SHIELD);
    expect(shieldBuff!.value).toBe(50);
  });

  it('§3.3 暴击倍率为1.5', () => {
    expect(BATTLE_CONFIG.CRITICAL_MULTIPLIER).toBe(1.5);
  });

  it('§3.3 伤害随机波动范围 0.9~1.1', () => {
    expect(BATTLE_CONFIG.RANDOM_FACTOR_MIN).toBe(0.9);
    expect(BATTLE_CONFIG.RANDOM_FACTOR_MAX).toBe(1.1);
  });
});

// ═══════════════════════════════════════════════
// §3.4 技能释放观察
// ═══════════════════════════════════════════════

describe('§3.4 技能释放观察', () => {
  let engine: BattleEngine;

  beforeEach(() => {
    engine = new BattleEngine();
  });

  it('§3.4 怒气满时释放大招而非普攻', () => {
    const skill = createActiveSkill('ultimate', '大招', 2.5, 100, 3);
    const attacker = createUnit('ally1', '诸葛亮', {
      attack: 150,
      speed: 90,
      rage: 100, // 怒气满
      skills: [skill],
    });
    const defender = createUnit('enemy1', '靶子', { maxHp: 5000, defense: 10 });

    const allyTeam = createTeam('ally', [attacker]);
    const enemyTeam = createTeam('enemy', [defender]);
    const state = engine.initBattle(allyTeam, enemyTeam);
    const actions = engine.executeTurn(state);

    // 应释放了大招
    const ultimateAction = actions.find((a) => a.actorId === 'ally1' && !a.isNormalAttack);
    expect(ultimateAction).toBeDefined();
    expect(ultimateAction!.skill!.multiplier).toBe(2.5);
  });

  it('§3.4 怒气未满时使用普攻', () => {
    const attacker = createUnit('ally1', '张飞', {
      attack: 150,
      rage: 50, // 怒气未满
      skills: [createActiveSkill()],
    });
    const defender = createUnit('enemy1', '靶子', { maxHp: 5000, defense: 10 });

    const allyTeam = createTeam('ally', [attacker]);
    const enemyTeam = createTeam('enemy', [defender]);
    const state = engine.initBattle(allyTeam, enemyTeam);
    const actions = engine.executeTurn(state);

    const normalAction = actions.find((a) => a.actorId === 'ally1');
    expect(normalAction).toBeDefined();
    expect(normalAction!.isNormalAttack).toBe(true);
  });

  it('§3.4 释放大招消耗怒气', () => {
    const skill = createActiveSkill('ulti', '大招', 2.0, 100, 2);
    const attacker = createUnit('ally1', '赵云', {
      attack: 150,
      rage: 100,
      skills: [skill],
    });
    const defender = createUnit('enemy1', '靶子', { maxHp: 5000, defense: 10 });

    const allyTeam = createTeam('ally', [attacker]);
    const enemyTeam = createTeam('enemy', [defender]);
    const state = engine.initBattle(allyTeam, enemyTeam);
    engine.executeTurn(state);

    // 怒气应被消耗
    expect(attacker.rage).toBeLessThan(100);
  });

  it('§3.4 技能冷却正确递减', () => {
    const skill = createActiveSkill('cd_skill', '冷却技', 1.5, 100, 3);
    skill.currentCooldown = 2; // 还在冷却中

    const attacker = createUnit('ally1', '关羽', {
      attack: 150,
      rage: 100,
      skills: [skill],
    });
    const defender = createUnit('enemy1', '靶子', { maxHp: 5000, defense: 10 });

    const allyTeam = createTeam('ally', [attacker]);
    const enemyTeam = createTeam('enemy', [defender]);
    const state = engine.initBattle(allyTeam, enemyTeam);

    // 冷却中的技能不应被释放
    const actions = engine.executeTurn(state);
    const skillAction = actions.find((a) => a.actorId === 'ally1');
    expect(skillAction!.isNormalAttack).toBe(true); // 冷却中只能普攻

    // 回合结束后冷却递减
    expect(skill.currentCooldown).toBe(1);
  });

  it('§3.4 攻击获得怒气', () => {
    const attacker = createUnit('ally1', '刘备', { attack: 150, rage: 0 });
    const defender = createUnit('enemy1', '靶子', { maxHp: 5000, defense: 10 });

    const allyTeam = createTeam('ally', [attacker]);
    const enemyTeam = createTeam('enemy', [defender]);
    const state = engine.initBattle(allyTeam, enemyTeam);
    engine.executeTurn(state);

    // 普攻获得25怒气
    expect(attacker.rage).toBeGreaterThanOrEqual(BATTLE_CONFIG.RAGE_GAIN_ATTACK);
  });

  it('§3.4 受击获得怒气', () => {
    const attacker = createUnit('ally1', '攻击方', { attack: 200, speed: 100 });
    const defender = createUnit('enemy1', '受击方', { maxHp: 5000, defense: 10, rage: 0, speed: 10 });

    const allyTeam = createTeam('ally', [attacker]);
    const enemyTeam = createTeam('enemy', [defender]);
    const state = engine.initBattle(allyTeam, enemyTeam);
    engine.executeTurn(state);

    // 受击获得15怒气
    expect(defender.rage).toBeGreaterThanOrEqual(BATTLE_CONFIG.RAGE_GAIN_HIT);
  });
});

// ═══════════════════════════════════════════════
// §3.5 兵种克制验证
// ═══════════════════════════════════════════════

describe('§3.5 兵种克制验证', () => {
  let calculator: DamageCalculator;

  beforeEach(() => {
    calculator = new DamageCalculator();
  });

  it('§3.5 骑兵克制步兵（×1.5）', () => {
    const attacker = createUnit('cavalry', '骑兵', { troopType: TroopType.CAVALRY, speed: 0 });
    const defender = createUnit('infantry', '步兵', { troopType: TroopType.INFANTRY });

    const result = calculator.calculateDamage(attacker, defender, 1.0);
    expect(result.restraintMultiplier).toBe(1.5);
  });

  it('§3.5 步兵克制枪兵（×1.5）', () => {
    const attacker = createUnit('infantry', '步兵', { troopType: TroopType.INFANTRY, speed: 0 });
    const defender = createUnit('spearman', '枪兵', { troopType: TroopType.SPEARMAN });

    const result = calculator.calculateDamage(attacker, defender, 1.0);
    expect(result.restraintMultiplier).toBe(1.5);
  });

  it('§3.5 枪兵克制骑兵（×1.5）', () => {
    const attacker = createUnit('spearman', '枪兵', { troopType: TroopType.SPEARMAN, speed: 0 });
    const defender = createUnit('cavalry', '骑兵', { troopType: TroopType.CAVALRY });

    const result = calculator.calculateDamage(attacker, defender, 1.0);
    expect(result.restraintMultiplier).toBe(1.5);
  });

  it('§3.5 被克制时伤害降低（×0.7）', () => {
    const attacker = createUnit('infantry', '步兵', { troopType: TroopType.INFANTRY, speed: 0 });
    const defender = createUnit('cavalry', '骑兵', { troopType: TroopType.CAVALRY });

    const result = calculator.calculateDamage(attacker, defender, 1.0);
    expect(result.restraintMultiplier).toBe(0.7);
  });

  it('§3.5 弓兵无克制关系（×1.0）', () => {
    const attacker = createUnit('archer', '弓兵', { troopType: TroopType.ARCHER, speed: 0 });
    const defender = createUnit('infantry', '步兵', { troopType: TroopType.INFANTRY });

    const result = calculator.calculateDamage(attacker, defender, 1.0);
    expect(result.restraintMultiplier).toBe(1.0);
  });

  it('§3.5 谋士无克制关系（×1.0）', () => {
    const attacker = createUnit('strategist', '谋士', { troopType: TroopType.STRATEGIST, speed: 0 });
    const defender = createUnit('cavalry', '骑兵', { troopType: TroopType.CAVALRY });

    const result = calculator.calculateDamage(attacker, defender, 1.0);
    expect(result.restraintMultiplier).toBe(1.0);
  });

  it('§3.5 克制关系在战斗中影响实际伤害', () => {
    // 骑兵 vs 步兵（克制）
    const cavalryUnit = createUnit('c1', '骑兵', { attack: 200, defense: 50, troopType: TroopType.CAVALRY, speed: 0 });
    const infantryUnit = createUnit('i1', '步兵', { attack: 50, defense: 50, troopType: TroopType.INFANTRY });

    // 步兵 vs 骑兵（被克制）
    const infantryAttacker = createUnit('i2', '步兵', { attack: 200, defense: 50, troopType: TroopType.INFANTRY, speed: 0 });
    const cavalryDefender = createUnit('c2', '骑兵', { attack: 50, defense: 50, troopType: TroopType.CAVALRY });

    const advantageResult = calculator.calculateDamage(cavalryUnit, infantryUnit, 1.0);
    const disadvantageResult = calculator.calculateDamage(infantryAttacker, cavalryDefender, 1.0);

    // 克制方伤害应高于被克制方（基础伤害相同，仅克制系数不同）
    expect(advantageResult.restraintMultiplier).toBeGreaterThan(
      disadvantageResult.restraintMultiplier,
    );
  });
});

// ═══════════════════════════════════════════════
// §3.6 状态效果观察
// ═══════════════════════════════════════════════

describe('§3.6 状态效果观察', () => {
  let calculator: DamageCalculator;

  beforeEach(() => {
    calculator = new DamageCalculator();
  });

  it('§3.6 ATK_UP buff 增加攻击力', () => {
    const attacker = createUnit('atk', '攻击方', { attack: 100, defense: 50, speed: 0 });
    attacker.buffs = [
      { type: BuffType.ATK_UP, remainingTurns: 2, value: 0.3, sourceId: 'buffer' }, // +30%攻击
    ];
    const defender = createUnit('def', '防御方', { attack: 50, defense: 50 });

    const result = calculator.calculateDamage(attacker, defender, 1.0);
    // effectiveAttack = 100 * (1 + 0.3) = 130
    // baseDamage = max(1, 130 - 50) = 80
    expect(result.baseDamage).toBe(80);
  });

  it('§3.6 DEF_UP buff 增加防御力', () => {
    const attacker = createUnit('atk', '攻击方', { attack: 100, defense: 50, speed: 0 });
    const defender = createUnit('def', '防御方', { attack: 50, defense: 50 });
    defender.buffs = [
      { type: BuffType.DEF_UP, remainingTurns: 2, value: 0.5, sourceId: 'buffer' }, // +50%防御
    ];

    const result = calculator.calculateDamage(attacker, defender, 1.0);
    // effectiveDefense = 50 * (1 + 0.5) = 75
    // baseDamage = max(1, 100 - 75) = 25
    expect(result.baseDamage).toBe(25);
  });

  it('§3.6 ATK_DOWN debuff 降低攻击力', () => {
    const attacker = createUnit('atk', '被削弱', { attack: 100, defense: 50, speed: 0 });
    attacker.buffs = [
      { type: BuffType.ATK_DOWN, remainingTurns: 2, value: 0.2, sourceId: 'debuffer' }, // -20%攻击
    ];
    const defender = createUnit('def', '防御方', { attack: 50, defense: 50 });

    const result = calculator.calculateDamage(attacker, defender, 1.0);
    // effectiveAttack = 100 * (1 - 0.2) = 80
    // baseDamage = max(1, 80 - 50) = 30
    expect(result.baseDamage).toBe(30);
  });

  it('§3.6 灼烧 DOT 伤害 = 最大HP × 5%', () => {
    const unit = createUnit('burn', '灼烧目标', { maxHp: 2000 });
    unit.buffs = [
      { type: BuffType.BURN, remainingTurns: 2, value: 0, sourceId: 'fire_user' },
    ];

    const dot = calculator.calculateDotDamage(unit);
    expect(dot).toBe(Math.floor(2000 * BATTLE_CONFIG.BURN_DAMAGE_RATIO)); // 100
  });

  it('§3.6 中毒 DOT 伤害 = 最大HP × 3%', () => {
    const unit = createUnit('poison', '中毒目标', { maxHp: 2000 });
    unit.buffs = [
      { type: BuffType.POISON, remainingTurns: 3, value: 0, sourceId: 'poison_user' },
    ];

    const dot = calculator.calculateDotDamage(unit);
    expect(dot).toBe(Math.floor(2000 * BATTLE_CONFIG.POISON_DAMAGE_RATIO)); // 60
  });

  it('§3.6 流血 DOT 伤害 = 攻击力 × 10%', () => {
    const unit = createUnit('bleed', '流血目标', { attack: 300 });
    unit.buffs = [
      { type: BuffType.BLEED, remainingTurns: 2, value: 0, sourceId: 'bleed_user' },
    ];

    const dot = calculator.calculateDotDamage(unit);
    expect(dot).toBe(Math.floor(300 * BATTLE_CONFIG.BLEED_DAMAGE_RATIO)); // 30
  });

  it('§3.6 眩晕导致无法行动', () => {
    const unit = createUnit('stunned', '被眩晕');
    unit.buffs = [
      { type: BuffType.STUN, remainingTurns: 1, value: 0, sourceId: 'stunner' },
    ];

    expect(calculator.isControlled(unit)).toBe(true);
  });

  it('§3.6 冰冻导致无法行动', () => {
    const unit = createUnit('frozen', '被冰冻');
    unit.buffs = [
      { type: BuffType.FREEZE, remainingTurns: 1, value: 0, sourceId: 'freezer' },
    ];

    expect(calculator.isControlled(unit)).toBe(true);
  });

  it('§3.6 无控制buff时可以行动', () => {
    const unit = createUnit('free', '自由');
    unit.buffs = [
      { type: BuffType.ATK_UP, remainingTurns: 2, value: 0.2, sourceId: 'buffer' },
    ];

    expect(calculator.isControlled(unit)).toBe(false);
  });

  it('§3.6 技能附带buff正确应用到目标', () => {
    const burnBuff: BuffEffect = {
      type: BuffType.BURN,
      remainingTurns: 2,
      value: 0,
      sourceId: '',
    };
    const skill = createActiveSkill('fire_skill', '火攻', 1.5, 100, 2, [burnBuff]);

    const attacker = createUnit('ally1', '火法师', { attack: 150, rage: 100, skills: [skill] });
    const defender = createUnit('enemy1', '靶子', { maxHp: 5000, defense: 10 });

    const allyTeam = createTeam('ally', [attacker]);
    const enemyTeam = createTeam('enemy', [defender]);

    const engine = new BattleEngine();
    const state = engine.initBattle(allyTeam, enemyTeam);
    engine.executeTurn(state);

    // 靶子身上应有灼烧buff（回合结束会tick减1）
    const burnOnTarget = defender.buffs.find((b) => b.type === BuffType.BURN);
    expect(burnOnTarget).toBeDefined();
    expect(burnOnTarget!.remainingTurns).toBeGreaterThanOrEqual(1);
  });

  it('§3.6 buff 回合结束后持续时间递减', () => {
    const unit = createUnit('ally1', '刘备', { attack: 200, speed: 100 });
    const enemy = createUnit('enemy1', '靶子', { maxHp: 5000, defense: 10, speed: 10 });

    // 给 unit 加一个 buff
    unit.buffs = [
      { type: BuffType.ATK_UP, remainingTurns: 3, value: 0.2, sourceId: 'buffer' },
    ];

    const allyTeam = createTeam('ally', [unit]);
    const enemyTeam = createTeam('enemy', [enemy]);

    const engine = new BattleEngine();
    const state = engine.initBattle(allyTeam, enemyTeam);
    engine.executeTurn(state);

    // 回合结束后 buff 持续时间应减少
    const atkBuff = unit.buffs.find((b) => b.type === BuffType.ATK_UP);
    expect(atkBuff).toBeDefined();
    expect(atkBuff!.remainingTurns).toBe(2); // 3 - 1 = 2
  });

  it('§3.6 buff 持续时间归零后自动移除', () => {
    const unit = createUnit('ally1', '刘备', { attack: 200, speed: 100 });
    const enemy = createUnit('enemy1', '靶子', { maxHp: 5000, defense: 10, speed: 10 });

    // 给 unit 加一个只剩1回合的 buff
    unit.buffs = [
      { type: BuffType.ATK_UP, remainingTurns: 1, value: 0.2, sourceId: 'buffer' },
    ];

    const allyTeam = createTeam('ally', [unit]);
    const enemyTeam = createTeam('enemy', [enemy]);

    const engine = new BattleEngine();
    const state = engine.initBattle(allyTeam, enemyTeam);
    engine.executeTurn(state);

    // buff 应已被移除
    const atkBuff = unit.buffs.find((b) => b.type === BuffType.ATK_UP);
    expect(atkBuff).toBeUndefined();
  });

  it('§3.6 多个DOT叠加计算总伤害', () => {
    const unit = createUnit('multi_dot', '多重DOT', { attack: 200, maxHp: 2000 });
    unit.buffs = [
      { type: BuffType.BURN, remainingTurns: 2, value: 0, sourceId: 'a' },
      { type: BuffType.POISON, remainingTurns: 3, value: 0, sourceId: 'b' },
      { type: BuffType.BLEED, remainingTurns: 2, value: 0, sourceId: 'c' },
    ];

    const dot = calculator.calculateDotDamage(unit);
    const expected =
      Math.floor(2000 * 0.05) + // 灼烧 100
      Math.floor(2000 * 0.03) + // 中毒 60
      Math.floor(200 * 0.10);   // 流血 20
    expect(dot).toBe(expected); // 180
  });
});
