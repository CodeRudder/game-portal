/**
 * 战斗模块对抗式测试
 *
 * 覆盖子系统：S1:BattleEngine S2:DamageCalculator S3:BattleTargetSelector
 * S4:battle-helpers S5:autoFormation S6:BattleFragmentRewards S7:BattleStatistics
 *
 * 5维度：F-Normal / F-Error / F-Boundary / F-Cross / F-Lifecycle
 * @module tests/adversarial/battle-adversarial
 */

import { describe, it, expect, vi } from 'vitest';
import { BattleEngine } from '../../engine/battle/BattleEngine';
import { DamageCalculator, getRestraintMultiplier, getCriticalRate, getAttackBonus, getDefenseBonus } from '../../engine/battle/DamageCalculator';
import { selectTargets, selectSingleTarget, selectFrontRowTargets, selectBackRowTargets } from '../../engine/battle/BattleTargetSelector';
import { autoFormation } from '../../engine/battle/autoFormation';
import { calculateFragmentRewards, simpleHash } from '../../engine/battle/BattleFragmentRewards';
import { calculateBattleStats, generateSummary } from '../../engine/battle/BattleStatistics';
import { BattleEffectApplier } from '../../engine/battle/BattleEffectApplier';
import { BattlePhase, BattleOutcome, StarRating, TroopType, BuffType, SkillTargetType, BattleMode, BattleSpeed } from '../../engine/battle/battle.types';
import { BATTLE_CONFIG } from '../../engine/battle/battle-config';
import { getAliveUnits, getAliveFrontUnits, getAliveBackUnits, sortBySpeed, getEnemyTeam, getAllyTeam, findUnitInTeam, findUnit } from '../../engine/battle/battle-helpers';
import type { BattleTeam, BattleUnit, BattleSkill, BattleState, BattleSide, DamageResult, IDamageCalculator } from '../../engine/battle/battle.types';
import type { ISystemDeps } from '../../core/types/subsystem';

// ── 测试辅助 ──────────────────────────────────
const mockDeps = (): ISystemDeps => ({
  eventBus: { on: vi.fn().mockReturnValue(vi.fn()), once: vi.fn().mockReturnValue(vi.fn()), emit: vi.fn(), off: vi.fn(), removeAllListeners: vi.fn() },
  config: { get: vi.fn(), set: vi.fn() },
  registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(), has: vi.fn(), unregister: vi.fn() },
} as unknown as ISystemDeps);

const normalAtk = (): BattleSkill => ({
  id: 'normal', name: '普通攻击', type: 'active', level: 1, description: '普攻',
  multiplier: 1.0, targetType: SkillTargetType.SINGLE_ENEMY, rageCost: 0, cooldown: 0, currentCooldown: 0,
});

const activeSkill = (o: Partial<BattleSkill> = {}): BattleSkill => ({
  id: 'skill_1', name: '烈焰斩', type: 'active', level: 1, description: '火焰攻击',
  multiplier: 1.8, targetType: SkillTargetType.ALL_ENEMY, rageCost: 100, cooldown: 2, currentCooldown: 0,
  buffs: [{ type: BuffType.BURN, remainingTurns: 2, value: 0.05, sourceId: '' }], ...o,
});

const unit = (o: Partial<BattleUnit> = {}): BattleUnit => ({
  id: 'unit_1', name: '赵云', faction: 'shu', troopType: TroopType.CAVALRY,
  position: 'front', side: 'ally', attack: 500, baseAttack: 500, defense: 300, baseDefense: 300,
  intelligence: 200, speed: 150, hp: 3000, maxHp: 3000, isAlive: true, rage: 0, maxRage: 100,
  normalAttack: normalAtk(), skills: [activeSkill()], buffs: [], ...o,
});

const team = (side: BattleSide, n: number, o: Partial<BattleUnit> = {}): BattleTeam => ({
  units: Array.from({ length: n }, (_, i) => unit({
    id: `${side}_${i + 1}`, name: `${side === 'ally' ? '友方' : '敌方'}${i + 1}`,
    side, position: i < 3 ? 'front' : 'back', ...o,
  })), side,
});

const stdTeams = () => ({
  ally: team('ally', 6, { attack: 500, defense: 300, speed: 150, hp: 3000, maxHp: 3000 }),
  enemy: team('enemy', 6, { attack: 400, defense: 250, speed: 120, hp: 2500, maxHp: 2500 }),
});

const battleState = (o: Partial<BattleState> = {}): BattleState => {
  const { ally, enemy } = stdTeams();
  return { id: 'test_battle', phase: BattlePhase.IN_PROGRESS, currentTurn: 1,
    maxTurns: BATTLE_CONFIG.MAX_TURNS, allyTeam: ally, enemyTeam: enemy,
    turnOrder: [], currentActorIndex: 0, actionLog: [], result: null, ...o };
};

const mockCalc = (dmg: number): IDamageCalculator => ({
  calculateDamage: (_a: BattleUnit, _d: BattleUnit, sm: number) => ({
    damage: dmg, baseDamage: dmg, skillMultiplier: sm, isCritical: false,
    criticalMultiplier: 1.0, restraintMultiplier: 1.0, randomFactor: 1.0, isMinDamage: false,
  }),
  applyDamage: (def: BattleUnit, d: number) => {
    if (!def.isAlive || d <= 0) return 0;
    const actual = Math.min(d, def.hp); def.hp -= actual;
    if (def.hp <= 0) { def.hp = 0; def.isAlive = false; } return actual;
  },
  calculateDotDamage: () => 0, isControlled: () => false,
});

const OUTCOMES = [BattleOutcome.VICTORY, BattleOutcome.DEFEAT, BattleOutcome.DRAW];

// ═══════════════════════════════════════════════
// F-Normal: 正向流程
// ═══════════════════════════════════════════════

describe('F-Normal: 战斗初始化', () => {
  it('initBattle 生成有效状态', () => {
    const s = new BattleEngine().initBattle(...Object.values(stdTeams()) as [BattleTeam, BattleTeam]);
    expect(s.id).toMatch(/^battle_/);
    expect(s.phase).toBe(BattlePhase.IN_PROGRESS);
    expect(s.currentTurn).toBe(1);
    expect(s.allyTeam.units).toHaveLength(6);
    expect(s.turnOrder.length).toBeGreaterThan(0);
  });
  it('行动顺序按速度降序', () => {
    const s = new BattleEngine().initBattle(team('ally', 2, { speed: 200 }), team('enemy', 2, { speed: 100 }));
    expect(s.turnOrder[0]).toMatch(/^ally_/);
  });
});

describe('F-Normal: 回合流程', () => {
  it('executeTurn 返回行动记录', () => {
    const e = new BattleEngine(mockCalc(50)); const { ally, enemy } = stdTeams();
    const actions = e.executeTurn(e.initBattle(ally, enemy));
    expect(actions.length).toBeGreaterThan(0);
    for (const a of actions) { expect(a.turn).toBe(1); expect(a.actorId).toBeTruthy(); }
  });
  it('runFullBattle 返回有效结果', () => {
    const r = new BattleEngine(mockCalc(9999)).runFullBattle(...Object.values(stdTeams()) as [BattleTeam, BattleTeam]);
    expect(OUTCOMES).toContain(r.outcome);
    expect(r.totalTurns).toBeGreaterThanOrEqual(1);
    expect(r.summary).toBeTruthy();
  });
});

describe('F-Normal: 伤害计算', () => {
  it('calculateDamage 完整结果', () => {
    const r = new DamageCalculator().calculateDamage(unit({ attack: 500, speed: 150 }), unit({ defense: 300 }), 1.5);
    expect(r.damage).toBeGreaterThan(0);
    expect(r.skillMultiplier).toBe(1.5);
    expect([1.0, BATTLE_CONFIG.CRITICAL_MULTIPLIER]).toContain(r.criticalMultiplier);
  });
  it('applyDamage 扣HP致死', () => {
    const c = new DamageCalculator(); const u = unit({ hp: 100, maxHp: 100 });
    expect(c.applyDamage(u, 60)).toBe(60); expect(u.hp).toBe(40);
    c.applyDamage(u, 50); expect(u.hp).toBe(0); expect(u.isAlive).toBe(false);
  });
  it('护盾吸收伤害', () => {
    const c = new DamageCalculator();
    const u = unit({ hp: 100, maxHp: 100, buffs: [{ type: BuffType.SHIELD, remainingTurns: 3, value: 50, sourceId: '' }] });
    expect(c.applyDamage(u, 80)).toBe(30); // 80-50护盾=30实际扣HP
    expect(u.hp).toBe(70);
  });
});

describe('F-Normal: 技能释放与怒气', () => {
  it('怒气满时释放大招', () => {
    const e = new BattleEngine(mockCalc(50));
    const s = e.initBattle(team('ally', 1, { rage: 100, maxRage: 100 }), team('enemy', 1, { hp: 5000, maxHp: 5000 }));
    const actions = e.executeTurn(s);
    expect(actions.length).toBeGreaterThan(0);
    if (!actions[0].isNormalAttack) expect(findUnit(s, actions[0].actorId)!.rage).toBeLessThan(100);
  });
  it('普攻获得怒气', () => {
    const e = new BattleEngine(mockCalc(50));
    const s = e.initBattle(team('ally', 1, { rage: 0 }), team('enemy', 1, { hp: 5000, maxHp: 5000 }));
    e.executeTurn(s);
    expect(s.allyTeam.units[0].rage).toBeGreaterThanOrEqual(BATTLE_CONFIG.RAGE_GAIN_ATTACK);
  });
});

describe('F-Normal: 胜负判定与星级', () => {
  it('敌方全灭 → VICTORY', () => {
    const { ally, enemy } = stdTeams();
    expect(new BattleEngine(mockCalc(99999)).runFullBattle(ally, enemy).outcome).toBe(BattleOutcome.VICTORY);
  });
  it('我方全灭 → DEFEAT', () => {
    const r = new BattleEngine(mockCalc(99999)).runFullBattle(
      team('ally', 1, { attack: 1, defense: 1, hp: 10, maxHp: 10 }),
      team('enemy', 6, { attack: 999, hp: 99999, maxHp: 99999 }));
    expect(r.outcome).toBe(BattleOutcome.DEFEAT); expect(r.stars).toBe(StarRating.NONE);
  });
  it('三星：胜利+存活≥4+回合≤6', () => {
    const r = new BattleEngine(mockCalc(99999)).runFullBattle(
      team('ally', 6, { attack: 2000, defense: 500, hp: 5000, maxHp: 5000 }),
      team('enemy', 1, { hp: 100, maxHp: 100 }));
    expect(r.outcome).toBe(BattleOutcome.VICTORY);
    if (r.allySurvivors >= BATTLE_CONFIG.STAR2_MIN_SURVIVORS && r.totalTurns <= BATTLE_CONFIG.STAR3_MAX_TURNS)
      expect(r.stars).toBe(StarRating.THREE);
  });
  it('平局：回合耗尽', () => {
    const r = new BattleEngine(mockCalc(1)).runFullBattle(
      team('ally', 6, { attack: 1, defense: 9999, hp: 99999, maxHp: 99999 }),
      team('enemy', 6, { attack: 1, defense: 9999, hp: 99999, maxHp: 99999 }));
    expect(r.outcome).toBe(BattleOutcome.DRAW);
  });
});

describe('F-Normal: 布阵/阵型/碎片/统计', () => {
  it('autoFormation 按防御分配前排', () => {
    const r = autoFormation([unit({ id: 'u1', defense: 100, maxHp: 1000 }), unit({ id: 'u2', defense: 500, maxHp: 2000 }),
      unit({ id: 'u3', defense: 300, maxHp: 1500 }), unit({ id: 'u4', defense: 200, maxHp: 800 })]);
    expect(r.frontLine).toContain('u2'); expect(r.score).toBeGreaterThanOrEqual(0);
  });
  it('autoFormation 空队伍', () => {
    const r = autoFormation([]); expect(r.team.units).toHaveLength(0); expect(r.score).toBe(0);
  });
  it('前排/后排目标选择', () => {
    const s = battleState();
    expect(getAliveFrontUnits(s.enemyTeam)).toHaveLength(3);
    expect(selectFrontRowTargets(s.enemyTeam).every(t => t.position === 'front')).toBe(true);
  });
  it('碎片奖励：首通必掉/失败无', () => {
    const e = team('enemy', 3);
    const r1 = calculateFragmentRewards(BattleOutcome.VICTORY, e, 3, true);
    expect(Object.keys(r1).length).toBe(3);
    expect(Object.keys(calculateFragmentRewards(BattleOutcome.DEFEAT, e, 0))).toHaveLength(0);
  });
  it('战斗统计与摘要', () => {
    const s = battleState();
    s.actionLog = [{ turn: 1, actorId: 'ally_1', actorName: '赵云', actorSide: 'ally',
      skill: normalAtk(), targetIds: ['enemy_1'], damageResults: { enemy_1: { damage: 200, isCritical: true } as DamageResult },
      description: '攻击', isNormalAttack: true }];
    expect(calculateBattleStats(s).allyTotalDamage).toBe(200);
    expect(generateSummary(BattleOutcome.VICTORY, StarRating.THREE, 3, 5)).toContain('战斗胜利');
    expect(generateSummary(BattleOutcome.DEFEAT, StarRating.NONE, 5, 0)).toContain('战斗失败');
    expect(generateSummary(BattleOutcome.DRAW, StarRating.NONE, 8, 3)).toContain('战斗平局');
  });
});

// ═══════════════════════════════════════════════
// F-Error: 异常路径
// ═══════════════════════════════════════════════

describe('F-Error: 异常路径', () => {
  it('initBattle(null) 抛异常', () => {
    const e = new BattleEngine();
    expect(() => e.initBattle(null as any, team('enemy', 1))).toThrow();
    expect(() => e.initBattle(team('ally', 1), undefined as any)).toThrow();
  });
  it('FINISHED 状态 executeTurn 返回空', () => {
    expect(new BattleEngine().executeTurn(battleState({ phase: BattlePhase.FINISHED }))).toEqual([]);
  });
  it('眩晕/冰冻被控制', () => {
    const c = new DamageCalculator();
    expect(c.isControlled(unit({ buffs: [{ type: BuffType.STUN, remainingTurns: 1, value: 0, sourceId: '' }] }))).toBe(true);
    expect(c.isControlled(unit({ buffs: [{ type: BuffType.FREEZE, remainingTurns: 1, value: 0, sourceId: '' }] }))).toBe(true);
  });
  it('死亡单位不参与', () => {
    const t = team('ally', 3); t.units[0].isAlive = false;
    expect(getAliveUnits(t)).toHaveLength(2);
    expect(new DamageCalculator().applyDamage(unit({ hp: 0, isAlive: false }), 100)).toBe(0);
  });
  it('全灭队伍无目标', () => {
    const t = team('enemy', 3); t.units.forEach(u => u.isAlive = false);
    expect(selectSingleTarget(t)).toHaveLength(0);
    expect(selectFrontRowTargets(t)).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════
// F-Boundary: 边界条件
// ═══════════════════════════════════════════════

describe('F-Boundary: NaN 防护', () => {
  const c = new DamageCalculator();
  it('NaN攻击力 → 0', () => expect(c.calculateDamage(unit({ attack: NaN, baseAttack: NaN }), unit({ defense: 100 }), 1.0).damage).toBe(0));
  it('NaN防御力不崩溃', () => expect(Number.isNaN(c.calculateDamage(unit({ attack: 500 }), unit({ defense: NaN, baseDefense: NaN }), 1.0).damage)).toBe(false));
  it('NaN倍率 → 0', () => expect(c.calculateDamage(unit({ attack: 500 }), unit({ defense: 100 }), NaN).damage).toBe(0));
  it('applyDamage(NaN) → 0', () => { const u = unit({ hp: 1000 }); expect(c.applyDamage(u, NaN)).toBe(0); expect(u.hp).toBe(1000); });
  it('NaN buff不污染攻击', () => expect(getAttackBonus(unit({ buffs: [{ type: BuffType.ATK_UP, remainingTurns: 2, value: NaN, sourceId: '' }] }))).toBe(0));
  it('NaN buff不污染防御', () => expect(getDefenseBonus(unit({ buffs: [{ type: BuffType.DEF_DOWN, remainingTurns: 2, value: NaN, sourceId: '' }] }))).toBe(0));
});

describe('F-Boundary: 极端属性', () => {
  const c = new DamageCalculator();
  it('零攻零防 ≥ 0', () => expect(c.calculateDamage(unit({ attack: 0, baseAttack: 0 }), unit({ defense: 0, baseDefense: 0 }), 1.0).damage).toBeGreaterThanOrEqual(0));
  it('负倍率 → 0', () => expect(c.calculateDamage(unit({ attack: 500 }), unit({ defense: 100 }), -1.5).damage).toBe(0));
  it('Infinity倍率 → 0', () => expect(c.calculateDamage(unit({ attack: 500 }), unit({ defense: 100 }), Infinity).damage).toBe(0));
  it('负伤害不回血', () => { const u = unit({ hp: 1000 }); expect(c.applyDamage(u, -500)).toBe(0); expect(u.hp).toBe(1000); });
  it('零伤害不扣血', () => { const u = unit({ hp: 1000 }); expect(c.applyDamage(u, 0)).toBe(0); expect(u.hp).toBe(1000); });
});

describe('F-Boundary: 空阵容与回合', () => {
  it('0v0 立即结束', () => {
    const e = new BattleEngine(); const s = e.initBattle({ units: [], side: 'ally' }, { units: [], side: 'enemy' });
    expect(e.isBattleOver(s)).toBe(true);
  });
  it('1v0 立即胜利', () => {
    const e = new BattleEngine(); const s = e.initBattle(team('ally', 1), { units: [], side: 'enemy' });
    expect(e.getBattleResult(s).outcome).toBe(BattleOutcome.VICTORY);
  });
  it('最大回合 = 8', () => expect(BATTLE_CONFIG.MAX_TURNS).toBe(8));
});

describe('F-Boundary: 暴击率', () => {
  it('速度0 → 5%', () => expect(getCriticalRate(0)).toBeCloseTo(0.05, 4));
  it('速度极高 → 100%', () => expect(getCriticalRate(99999)).toBe(1.0));
  it('速度负数 → ≥0', () => expect(getCriticalRate(-100)).toBeGreaterThanOrEqual(0));
});

describe('F-Boundary: 克制系数', () => {
  it.each([
    [TroopType.CAVALRY, TroopType.INFANTRY, 1.5], [TroopType.INFANTRY, TroopType.SPEARMAN, 1.5],
    [TroopType.SPEARMAN, TroopType.CAVALRY, 1.5], [TroopType.INFANTRY, TroopType.CAVALRY, 0.7],
    [TroopType.ARCHER, TroopType.CAVALRY, 1.0], [TroopType.STRATEGIST, TroopType.INFANTRY, 1.0],
    [TroopType.CAVALRY, TroopType.ARCHER, 1.0],
  ] as const)('%s vs %s → ×%s', (atk, def, mult) => expect(getRestraintMultiplier(atk, def)).toBe(mult));
});

describe('F-Boundary: DOT伤害', () => {
  const c = new DamageCalculator();
  it('灼烧=maxHP×5%', () => expect(c.calculateDotDamage(unit({ maxHp: 2000, buffs: [{ type: BuffType.BURN, remainingTurns: 2, value: 0.05, sourceId: '' }] }))).toBe(100));
  it('中毒=maxHP×3%', () => expect(c.calculateDotDamage(unit({ maxHp: 2000, buffs: [{ type: BuffType.POISON, remainingTurns: 3, value: 0.03, sourceId: '' }] }))).toBe(60));
  it('流血=atk×10%', () => expect(c.calculateDotDamage(unit({ attack: 500, buffs: [{ type: BuffType.BLEED, remainingTurns: 2, value: 0.1, sourceId: '' }] }))).toBe(50));
  it('无DOT → 0', () => expect(c.calculateDotDamage(unit())).toBe(0));
});

// ═══════════════════════════════════════════════
// F-Cross: 跨系统交互
// ═══════════════════════════════════════════════

describe('F-Cross: 战斗→资源/碎片', () => {
  it('首通碎片与敌方单位对应', () => {
    const e = team('enemy', 3);
    const r = calculateFragmentRewards(BattleOutcome.VICTORY, e, 3, true);
    for (const u of e.units) expect(r[u.id]).toBeGreaterThanOrEqual(1);
  });
  it('非首通掉率约10%', () => {
    const r = calculateFragmentRewards(BattleOutcome.VICTORY, team('enemy', 100), 50, false);
    expect(Object.keys(r).length).toBeGreaterThan(0);
    expect(Object.keys(r).length).toBeLessThan(50);
  });
});

describe('F-Cross: 战斗→声望→成就', () => {
  it('胜利结果可被成就系统消费', () => {
    const r = new BattleEngine(mockCalc(99999)).runFullBattle(
      team('ally', 6, { attack: 2000 }), team('enemy', 1, { hp: 100, maxHp: 100 }));
    expect(r.outcome).toBe(BattleOutcome.VICTORY);
    expect(typeof r.stars).toBe('number');
    expect(typeof r.maxSingleDamage).toBe('number');
  });
});

describe('F-Cross: 科技→战斗属性', () => {
  it('无科技时属性不变', () => {
    const a = new BattleEffectApplier(); a.init(mockDeps());
    const u = unit({ baseAttack: 500, baseDefense: 300 });
    expect(a.getEnhancedStats(u).enhancedAttack).toBe(500);
  });
  it('applyTechBonusesToUnit 无科技不变', () => {
    const a = new BattleEffectApplier(); a.init(mockDeps());
    const u = unit({ baseAttack: 500, baseDefense: 300, attack: 500, defense: 300 });
    a.applyTechBonusesToUnit(u); expect(u.attack).toBe(500);
  });
});

describe('F-Cross: Buff叠加', () => {
  it('ATK_UP+DEF_DOWN 提升伤害', () => {
    const r = new DamageCalculator().calculateDamage(
      unit({ attack: 500, baseAttack: 500, buffs: [{ type: BuffType.ATK_UP, remainingTurns: 2, value: 0.5, sourceId: '' }] }),
      unit({ defense: 300, baseDefense: 300, buffs: [{ type: BuffType.DEF_DOWN, remainingTurns: 2, value: 0.5, sourceId: '' }] }), 1.0);
    expect(r.baseDamage).toBeGreaterThanOrEqual(600);
  });
  it('护盾+HP双层吸收', () => {
    const u = unit({ hp: 200, maxHp: 200, buffs: [{ type: BuffType.SHIELD, remainingTurns: 2, value: 100, sourceId: '' }] });
    new DamageCalculator().applyDamage(u, 150); expect(u.hp).toBe(150);
  });
});

// ═══════════════════════════════════════════════
// F-Lifecycle: 数据生命周期
// ═══════════════════════════════════════════════

describe('F-Lifecycle: 序列化', () => {
  it('serialize→deserialize 一致', () => {
    const e = new BattleEngine(); e.setBattleMode(BattleMode.SEMI_AUTO);
    const { ally, enemy } = stdTeams(); const s = e.initBattle(ally, enemy);
    const restored = e.deserialize(e.serialize(s));
    expect(restored.id).toBe(s.id);
    expect(restored.allyTeam.units).toHaveLength(6);
  });
  it('反序列化无效数据抛异常', () => {
    const e = new BattleEngine();
    expect(() => e.deserialize(null)).toThrow();
    expect(() => e.deserialize({})).toThrow();
    expect(() => e.deserialize('x')).toThrow();
  });
});

describe('F-Lifecycle: reset/加速/skip', () => {
  it('reset 恢复默认模式/速度', () => {
    const e = new BattleEngine(); e.setBattleMode(BattleMode.SEMI_AUTO); e.setSpeed(BattleSpeed.X4);
    e.reset();
    expect(e.getBattleMode()).toBe(BattleMode.AUTO);
    expect(e.getSpeedState().speed).toBe(1);
  });
  it('速度影响回合间隔', () => {
    const e = new BattleEngine(); e.setSpeed(BattleSpeed.X1); const i1 = e.getAdjustedTurnInterval();
    e.setSpeed(BattleSpeed.X2); expect(e.getAdjustedTurnInterval()).toBeLessThan(i1);
  });
  it('skipBattle 跳过战斗', () => {
    const e = new BattleEngine(); const { ally, enemy } = stdTeams();
    const s = e.initBattle(ally, enemy); const r = e.skipBattle(s);
    expect(s.phase).toBe(BattlePhase.FINISHED); expect(OUTCOMES).toContain(r.outcome);
  });
  it('quickBattle 一键完成', () => {
    const { ally, enemy } = stdTeams();
    expect(OUTCOMES).toContain(new BattleEngine().quickBattle(ally, enemy).outcome);
  });
  it('skipBattle 已结束直接返回', () => {
    const e = new BattleEngine(mockCalc(99999)); const { ally, enemy } = stdTeams();
    const r1 = e.runFullBattle(ally, enemy);
    const s = e.initBattle(ally, enemy); s.phase = BattlePhase.FINISHED; s.result = r1;
    expect(e.skipBattle(s).outcome).toBe(r1.outcome);
  });
  it('skipBattle 后速度恢复X1', () => {
    const e = new BattleEngine(); const { ally, enemy } = stdTeams();
    e.skipBattle(e.initBattle(ally, enemy)); expect(e.getSpeedState().speed).toBe(1);
  });
});

// ═══════════════════════════════════════════════
// 辅助函数 / ISubsystem / 特效 / 目标全覆盖
// ═══════════════════════════════════════════════

describe('工具函数', () => {
  it('sortBySpeed 降序', () => {
    const sorted = sortBySpeed([unit({ id: 'slow', speed: 50 }), unit({ id: 'fast', speed: 200 }), unit({ id: 'mid', speed: 100 })]);
    expect(sorted.map(u => u.id)).toEqual(['fast', 'mid', 'slow']);
  });
  it('getEnemyTeam/getAllyTeam', () => {
    const s = battleState();
    expect(getEnemyTeam(s, 'ally')).toBe(s.enemyTeam);
    expect(getAllyTeam(s, 'enemy')).toBe(s.enemyTeam);
  });
  it('findUnit', () => {
    const s = battleState();
    expect(findUnit(s, 'ally_1')).toBeDefined();
    expect(findUnit(s, 'nonexistent')).toBeUndefined();
  });
  it('simpleHash 确定性', () => {
    expect(simpleHash('test')).toBe(simpleHash('test'));
    expect(simpleHash('a')).not.toBe(simpleHash('b'));
    expect(simpleHash('x')).toBeGreaterThanOrEqual(0);
  });
});

describe('ISubsystem 适配层', () => {
  it('BattleEngine', () => {
    const e = new BattleEngine(); e.init(mockDeps()); e.update(16);
    expect(e.getState()).toEqual({ battleMode: BattleMode.AUTO }); e.reset();
  });
  it('DamageCalculator', () => {
    const c = new DamageCalculator(); c.init(mockDeps()); c.update(16);
    expect(c.getState()).toEqual({ type: 'DamageCalculator' }); c.reset();
  });
});

describe('BattleEffectApplier 特效', () => {
  it('获取预设/不存在/注册/重置', () => {
    const a = new BattleEffectApplier(); a.init(mockDeps());
    expect(a.getSkillEffect('fire_slash')!.skillName).toBe('烈焰斩');
    expect(a.getSkillEffect('nope')).toBeNull();
    a.registerSkillEffect({ skillId: 'c1', skillName: 'C', element: 'fire', particleCount: 10,
      duration: 500, trigger: 'onHit', color: '#F00', scale: 1.0, screenShake: false, shakeIntensity: 0 });
    expect(a.getSkillEffect('c1')!.skillName).toBe('C');
    a.reset(); expect(a.getSkillEffect('c1')).toBeNull();
  });
});

describe('目标选择全覆盖', () => {
  it.each([
    [SkillTargetType.SELF, 1], [SkillTargetType.ALL_ALLY, 6], [SkillTargetType.ALL_ENEMY, 6],
  ] as const)('targetType=%s → %i个目标', (tt, n) => {
    const s = battleState(); const actor = s.allyTeam.units[0];
    expect(selectTargets(s, actor, { ...normalAtk(), targetType: tt })).toHaveLength(n);
  });
  it('SINGLE_ALLY → 血量最低友方', () => {
    const s = battleState(); s.allyTeam.units[0].hp = 10;
    expect(selectTargets(s, s.allyTeam.units[1], { ...normalAtk(), targetType: SkillTargetType.SINGLE_ALLY })[0].id).toBe('ally_1');
  });
  it('无前排时后排变前排目标', () => {
    const t = team('enemy', 4); t.units.filter(u => u.position === 'front').forEach(u => u.isAlive = false);
    const targets = selectFrontRowTargets(t);
    expect(targets.length).toBeGreaterThan(0);
    for (const tg of targets) expect(tg.position).toBe('back');
  });
});
