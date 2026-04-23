/**
 * 回合执行器 — 单元测试 (P2)
 * 覆盖：目标选择(续)、怒气系统、Buff/Debuff、endTurn、DOT、控制状态、技能冷却、行动记录、伤害交互、构造函数
 * @module engine/battle/__tests__/BattleTurnExecutor-p2.test
 */
import { BattleTurnExecutor } from '../BattleTurnExecutor';
import type { BattleState, BattleUnit, BattleSkill, IDamageCalculator } from '../battle.types';
import { BattlePhase, BuffType, TroopType, SkillTargetType } from '../battle.types';
import { BATTLE_CONFIG } from '../battle-config';

// ─────────────────────────────────────────────
// 测试工具
// ─────────────────────────────────────────────

const NORMAL_ATTACK: BattleSkill = {
  id: 'normal', name: '普攻', type: 'active', level: 1,
  description: '普通攻击', multiplier: 1.0, targetType: SkillTargetType.SINGLE_ENEMY,
  rageCost: 0, cooldown: 0, currentCooldown: 0,
};

const ULTIMATE_SKILL: BattleSkill = {
  id: 'ultimate', name: '大招', type: 'active', level: 1,
  description: '强力技能', multiplier: 2.0, targetType: SkillTargetType.ALL_ENEMY,
  rageCost: 100, cooldown: 3, currentCooldown: 0,
};

const SINGLE_TARGET_SKILL: BattleSkill = {
  id: 'single_skill', name: '单体技能', type: 'active', level: 1,
  description: '单体攻击', multiplier: 1.8, targetType: SkillTargetType.SINGLE_ENEMY,
  rageCost: 100, cooldown: 2, currentCooldown: 0,
};

function createUnit(overrides: Partial<BattleUnit> = {}): BattleUnit {
  return {
    id: `unit_${Math.random().toString(36).slice(2, 6)}`,
    name: '测试武将', faction: 'shu', troopType: TroopType.CAVALRY,
    position: 'front', side: 'ally', attack: 100, baseAttack: 100,
    defense: 50, baseDefense: 50, intelligence: 60, speed: 80,
    hp: 1000, maxHp: 1000, isAlive: true, rage: 0, maxRage: 100,
    normalAttack: { ...NORMAL_ATTACK }, skills: [], buffs: [],
    ...overrides,
  };
}

function createState(overrides: Partial<BattleState> = {}): BattleState {
  const allyUnit = createUnit({ id: 'ally1', side: 'ally', name: '我方武将' });
  const enemyUnit = createUnit({ id: 'enemy1', side: 'enemy', name: '敌方武将' });
  return {
    id: 'test_battle', phase: BattlePhase.IN_PROGRESS, currentTurn: 1,
    maxTurns: BATTLE_CONFIG.MAX_TURNS,
    allyTeam: { units: [allyUnit], side: 'ally' },
    enemyTeam: { units: [enemyUnit], side: 'enemy' },
    turnOrder: [], currentActorIndex: 0, actionLog: [], result: null,
    ...overrides,
  };
}

function createMockCalculator(overrides: Partial<IDamageCalculator> = {}): IDamageCalculator {
  return {
    calculateDamage: jest.fn((_a, _d, m) => ({
      damage: 100, baseDamage: 100, skillMultiplier: m, isCritical: false,
      criticalMultiplier: 1.0, restraintMultiplier: 1.0, randomFactor: 1.0, isMinDamage: false,
    })),
    applyDamage: jest.fn((d, dmg) => {
      const actual = Math.min(dmg, d.hp);
      d.hp -= actual;
      if (d.hp <= 0) { d.hp = 0; d.isAlive = false; }
      return actual;
    }),
    calculateDotDamage: jest.fn(() => 0),
    isControlled: jest.fn(() => false),
    ...overrides,
  };
}

describe('BattleTurnExecutor 目标选择（续）', () => {
  let executor: BattleTurnExecutor;
  beforeEach(() => { executor = new BattleTurnExecutor(createMockCalculator()); });

  it('BACK_ROW → falls back to front when back dead', () => {
    const sk: BattleSkill = { id: 'bs', name: '后排', type: 'active', level: 1, description: '', multiplier: 1.5, targetType: SkillTargetType.BACK_ROW, rageCost: 100, cooldown: 2, currentCooldown: 0 };
    const actor = createUnit({ id: 'a', side: 'ally', rage: 100, skills: [sk] });
    const s = createState({ allyTeam: { units: [actor], side: 'ally' }, enemyTeam: { units: [createUnit({ id: 'f1', side: 'enemy', position: 'front' }), createUnit({ id: 'b1', side: 'enemy', position: 'back', isAlive: false, hp: 0 })], side: 'enemy' } });
    expect(executor.executeUnitAction(s, actor)!.targetIds).toContain('f1');
  });

  it('SELF on dead actor → null', () => {
    const sk: BattleSkill = { id: 'sb', name: '自我', type: 'active', level: 1, description: '', multiplier: 0, targetType: SkillTargetType.SELF, rageCost: 50, cooldown: 2, currentCooldown: 0 };
    const actor = createUnit({ id: 'a', side: 'ally', rage: 100, skills: [sk], isAlive: false, hp: 0 });
    const s = createState({ allyTeam: { units: [actor], side: 'ally' }, enemyTeam: { units: [createUnit({ id: 'e', side: 'enemy' })], side: 'enemy' } });
    expect(executor.executeUnitAction(s, actor)).toBeNull();
  });

  it('ALL_ALLY excludes dead allies', () => {
    const sk: BattleSkill = { id: 'tb', name: '团队', type: 'active', level: 1, description: '', multiplier: 0, targetType: SkillTargetType.ALL_ALLY, rageCost: 100, cooldown: 3, currentCooldown: 0 };
    const actor = createUnit({ id: 'a', side: 'ally', rage: 100, skills: [sk] });
    const dead = createUnit({ id: 'da', side: 'ally', isAlive: false, hp: 0 });
    const alive = createUnit({ id: 'aa', side: 'ally' });
    const s = createState({ allyTeam: { units: [actor, dead, alive], side: 'ally' }, enemyTeam: { units: [createUnit({ id: 'e', side: 'enemy' })], side: 'enemy' } });
    const t = executor.executeUnitAction(s, actor)!.targetIds;
    expect(t).toHaveLength(2); expect(t).not.toContain('da');
  });

  it('ALL_ENEMY excludes dead enemies', () => {
    const actor = createUnit({ id: 'a', side: 'ally', rage: 100, skills: [{ ...ULTIMATE_SKILL }] });
    const s = createState({ allyTeam: { units: [actor], side: 'ally' }, enemyTeam: { units: [createUnit({ id: 'al', side: 'enemy' }), createUnit({ id: 'dd', side: 'enemy', isAlive: false, hp: 0 })], side: 'enemy' } });
    const t = executor.executeUnitAction(s, actor)!.targetIds;
    expect(t).toHaveLength(1); expect(t).toContain('al');
  });
});

// 5. 怒气系统
describe('BattleTurnExecutor 怒气系统', () => {
  let executor: BattleTurnExecutor;
  beforeEach(() => { executor = new BattleTurnExecutor(createMockCalculator()); });

  it('attacker gains RAGE_GAIN_ATTACK', () => {
    const actor = createUnit({ id: 'a', side: 'ally', rage: 0 });
    const s = createState({ allyTeam: { units: [actor], side: 'ally' }, enemyTeam: { units: [createUnit({ id: 'e', side: 'enemy' })], side: 'enemy' } });
    executor.executeUnitAction(s, actor); expect(actor.rage).toBe(BATTLE_CONFIG.RAGE_GAIN_ATTACK);
  });

  it('target gains RAGE_GAIN_HIT', () => {
    const enemy = createUnit({ id: 'e', side: 'enemy', rage: 0 });
    const s = createState({ allyTeam: { units: [createUnit({ id: 'a', side: 'ally' })], side: 'ally' }, enemyTeam: { units: [enemy], side: 'enemy' } });
    executor.executeUnitAction(s, s.allyTeam.units[0]); expect(enemy.rage).toBe(BATTLE_CONFIG.RAGE_GAIN_HIT);
  });

  it('rage capped at maxRage', () => {
    const actor = createUnit({ id: 'a', side: 'ally', rage: 90, maxRage: 100 });
    const enemy = createUnit({ id: 'e', side: 'enemy', rage: 95 });
    const s = createState({ allyTeam: { units: [actor], side: 'ally' }, enemyTeam: { units: [enemy], side: 'enemy' } });
    executor.executeUnitAction(s, actor); expect(actor.rage).toBe(100); expect(enemy.rage).toBe(100);
  });

  it('dead targets do not gain rage', () => {
    const actor = createUnit({ id: 'a', side: 'ally', rage: 100, skills: [{ ...ULTIMATE_SKILL }] });
    const dead = createUnit({ id: 'd', side: 'enemy', isAlive: false, hp: 0, rage: 0 });
    const s = createState({ allyTeam: { units: [actor], side: 'ally' }, enemyTeam: { units: [dead], side: 'enemy' } });
    executor.executeUnitAction(s, actor); expect(dead.rage).toBe(0);
  });

  it('rage accumulates over multiple attacks', () => {
    const actor = createUnit({ id: 'a', side: 'ally', rage: 0 });
    const enemy = createUnit({ id: 'e', side: 'enemy', hp: 99999, maxHp: 99999 });
    const s = createState({ allyTeam: { units: [actor], side: 'ally' }, enemyTeam: { units: [enemy], side: 'enemy' } });
    executor.executeUnitAction(s, actor); expect(actor.rage).toBe(BATTLE_CONFIG.RAGE_GAIN_ATTACK);
    executor.executeUnitAction(s, actor); expect(actor.rage).toBe(BATTLE_CONFIG.RAGE_GAIN_ATTACK * 2);
  });

  it('custom maxRage respected', () => {
    const actor = createUnit({ id: 'a', side: 'ally', rage: 190, maxRage: 200 });
    const s = createState({ allyTeam: { units: [actor], side: 'ally' }, enemyTeam: { units: [createUnit({ id: 'e', side: 'enemy' })], side: 'enemy' } });
    executor.executeUnitAction(s, actor); expect(actor.rage).toBe(200);
  });
});

// 6. Buff/Debuff
describe('BattleTurnExecutor Buff/Debuff', () => {
  let executor: BattleTurnExecutor;
  beforeEach(() => { executor = new BattleTurnExecutor(createMockCalculator()); });

  it('applies skill buffs to targets', () => {
    const sk: BattleSkill = { id: 'bs', name: '减益', type: 'active', level: 1, description: '', multiplier: 1.5, targetType: SkillTargetType.SINGLE_ENEMY, rageCost: 100, cooldown: 2, currentCooldown: 0, buffs: [{ type: BuffType.ATK_DOWN, remainingTurns: 2, value: 0.2, sourceId: '' }] };
    const actor = createUnit({ id: 'a', side: 'ally', rage: 100, skills: [sk] });
    const enemy = createUnit({ id: 'e', side: 'enemy', buffs: [] });
    const s = createState({ allyTeam: { units: [actor], side: 'ally' }, enemyTeam: { units: [enemy], side: 'enemy' } });
    executor.executeUnitAction(s, actor); expect(enemy.buffs).toHaveLength(1); expect(enemy.buffs[0].sourceId).toBe('a');
  });

  it('does not apply buffs to dead targets', () => {
    const sk: BattleSkill = { id: 'bs', name: '减益', type: 'active', level: 1, description: '', multiplier: 1.5, targetType: SkillTargetType.ALL_ENEMY, rageCost: 100, cooldown: 2, currentCooldown: 0, buffs: [{ type: BuffType.BURN, remainingTurns: 2, value: 0.05, sourceId: '' }] };
    const actor = createUnit({ id: 'a', side: 'ally', rage: 100, skills: [sk] });
    const alive = createUnit({ id: 'ae', side: 'enemy', buffs: [] });
    const dead = createUnit({ id: 'de', side: 'enemy', isAlive: false, hp: 0, buffs: [] });
    const s = createState({ allyTeam: { units: [actor], side: 'ally' }, enemyTeam: { units: [alive, dead], side: 'enemy' } });
    executor.executeUnitAction(s, actor); expect(alive.buffs).toHaveLength(1); expect(dead.buffs).toHaveLength(0);
  });

  it('applies multiple buffs from single skill', () => {
    const sk: BattleSkill = { id: 'mb', name: '多重', type: 'active', level: 1, description: '', multiplier: 1.5, targetType: SkillTargetType.SINGLE_ENEMY, rageCost: 100, cooldown: 2, currentCooldown: 0, buffs: [{ type: BuffType.BURN, remainingTurns: 2, value: 0.05, sourceId: '' }, { type: BuffType.ATK_DOWN, remainingTurns: 3, value: 0.2, sourceId: '' }] };
    const actor = createUnit({ id: 'a', side: 'ally', rage: 100, skills: [sk] });
    const enemy = createUnit({ id: 'e', side: 'enemy', buffs: [] });
    const s = createState({ allyTeam: { units: [actor], side: 'ally' }, enemyTeam: { units: [enemy], side: 'enemy' } });
    executor.executeUnitAction(s, actor); expect(enemy.buffs).toHaveLength(2);
  });

  it('applies buffs to all alive targets for ALL_ENEMY', () => {
    const sk: BattleSkill = { id: 'ab', name: '群体', type: 'active', level: 1, description: '', multiplier: 1.5, targetType: SkillTargetType.ALL_ENEMY, rageCost: 100, cooldown: 2, currentCooldown: 0, buffs: [{ type: BuffType.DEF_DOWN, remainingTurns: 2, value: 0.3, sourceId: '' }] };
    const actor = createUnit({ id: 'a', side: 'ally', rage: 100, skills: [sk] });
    const e1 = createUnit({ id: 'e1', side: 'enemy', buffs: [] }); const e2 = createUnit({ id: 'e2', side: 'enemy', buffs: [] });
    const s = createState({ allyTeam: { units: [actor], side: 'ally' }, enemyTeam: { units: [e1, e2], side: 'enemy' } });
    executor.executeUnitAction(s, actor); expect(e1.buffs).toHaveLength(1); expect(e2.buffs).toHaveLength(1);
  });
});

// 7. endTurn
describe('BattleTurnExecutor endTurn', () => {
  let executor: BattleTurnExecutor;
  beforeEach(() => { executor = new BattleTurnExecutor(createMockCalculator()); });

  it('decrements buff remainingTurns', () => {
    const u = createUnit({ id: 'u', side: 'ally', buffs: [{ type: BuffType.ATK_UP, remainingTurns: 3, value: 0.2, sourceId: 's' }, { type: BuffType.DEF_UP, remainingTurns: 1, value: 0.15, sourceId: 's' }] });
    const s = createState({ allyTeam: { units: [u], side: 'ally' }, currentTurn: 1 });
    executor.endTurn(s); expect(u.buffs[0].remainingTurns).toBe(2); expect(u.buffs).toHaveLength(1);
  });

  it('removes expired buffs', () => {
    const u = createUnit({ id: 'u', side: 'ally', buffs: [{ type: BuffType.ATK_UP, remainingTurns: 1, value: 0.2, sourceId: 's' }, { type: BuffType.DEF_UP, remainingTurns: 2, value: 0.15, sourceId: 's' }] });
    const s = createState({ allyTeam: { units: [u], side: 'ally' }, currentTurn: 1 });
    executor.endTurn(s); expect(u.buffs).toHaveLength(1); expect(u.buffs[0].type).toBe(BuffType.DEF_UP);
  });

  it('decrements skill cooldowns', () => {
    const u = createUnit({ id: 'u', side: 'ally', skills: [{ ...ULTIMATE_SKILL, currentCooldown: 3 }, { ...SINGLE_TARGET_SKILL, currentCooldown: 1 }] });
    const s = createState({ allyTeam: { units: [u], side: 'ally' }, currentTurn: 1 });
    executor.endTurn(s); expect(u.skills[0].currentCooldown).toBe(2); expect(u.skills[1].currentCooldown).toBe(0);
  });

  it('cooldown does not go below 0', () => {
    const u = createUnit({ id: 'u', side: 'ally', skills: [{ ...ULTIMATE_SKILL, currentCooldown: 0 }] });
    const s = createState({ allyTeam: { units: [u], side: 'ally' }, currentTurn: 1 });
    executor.endTurn(s); expect(u.skills[0].currentCooldown).toBe(0);
  });

  it('sets FINISHED at max turns', () => {
    const s = createState({ currentTurn: BATTLE_CONFIG.MAX_TURNS }); executor.endTurn(s); expect(s.phase).toBe(BattlePhase.FINISHED);
  });

  it('stays IN_PROGRESS when turns remain', () => {
    const s = createState({ currentTurn: 1 }); executor.endTurn(s); expect(s.phase).toBe(BattlePhase.IN_PROGRESS);
  });

  it('handles empty buffs/skills', () => {
    const u = createUnit({ id: 'u', side: 'ally', buffs: [], skills: [] });
    const s = createState({ allyTeam: { units: [u], side: 'ally' }, currentTurn: 1 });
    expect(() => executor.endTurn(s)).not.toThrow();
  });

  it('processes both ally and enemy buffs', () => {
    const ally = createUnit({ id: 'al', side: 'ally', buffs: [{ type: BuffType.ATK_UP, remainingTurns: 2, value: 0.1, sourceId: 's' }] });
    const enemy = createUnit({ id: 'en', side: 'enemy', buffs: [{ type: BuffType.DEF_DOWN, remainingTurns: 1, value: 0.2, sourceId: 's' }] });
    const s = createState({ allyTeam: { units: [ally], side: 'ally' }, enemyTeam: { units: [enemy], side: 'enemy' }, currentTurn: 1 });
    executor.endTurn(s); expect(ally.buffs[0].remainingTurns).toBe(1); expect(enemy.buffs).toHaveLength(0);
  });

  it('processes both ally and enemy cooldowns', () => {
    const ally = createUnit({ id: 'al', side: 'ally', skills: [{ ...ULTIMATE_SKILL, currentCooldown: 2 }] });
    const enemy = createUnit({ id: 'en', side: 'enemy', skills: [{ ...ULTIMATE_SKILL, currentCooldown: 1 }] });
    const s = createState({ allyTeam: { units: [ally], side: 'ally' }, enemyTeam: { units: [enemy], side: 'enemy' }, currentTurn: 1 });
    executor.endTurn(s); expect(ally.skills[0].currentCooldown).toBe(1); expect(enemy.skills[0].currentCooldown).toBe(0);
  });
});

// 8. DOT伤害
describe('BattleTurnExecutor DOT', () => {
  let executor: BattleTurnExecutor;
  beforeEach(() => {
    executor = new BattleTurnExecutor(createMockCalculator({
      calculateDotDamage: jest.fn((u) => u.buffs.some(b => b.type === BuffType.BURN) ? Math.floor(u.maxHp * 0.05) : 0),
    }));
  });

  it('applies DOT before acting', () => {
    const actor = createUnit({ id: 'a', side: 'ally', hp: 200, maxHp: 1000, buffs: [{ type: BuffType.BURN, remainingTurns: 2, value: 0.05, sourceId: 's' }] });
    const s = createState({ allyTeam: { units: [actor], side: 'ally' }, enemyTeam: { units: [createUnit({ id: 'e', side: 'enemy' })], side: 'enemy' } });
    executor.executeUnitAction(s, actor); expect(actor.hp).toBe(150);
  });

  it('DOT kills unit → death action', () => {
    const actor = createUnit({ id: 'a', side: 'ally', hp: 30, maxHp: 1000, buffs: [{ type: BuffType.BURN, remainingTurns: 2, value: 0.05, sourceId: 's' }] });
    const s = createState({ allyTeam: { units: [actor], side: 'ally' }, enemyTeam: { units: [createUnit({ id: 'e', side: 'enemy' })], side: 'enemy' } });
    const action = executor.executeUnitAction(s, actor);
    expect(action!.description).toContain('阵亡'); expect(actor.isAlive).toBe(false);
  });
});

// 9. 控制状态
describe('BattleTurnExecutor 控制状态', () => {
  let executor: BattleTurnExecutor;
  beforeEach(() => {
    executor = new BattleTurnExecutor(createMockCalculator({
      isControlled: jest.fn((u) => u.buffs.some(b => b.type === BuffType.STUN || b.type === BuffType.FREEZE)),
    }));
  });

  it('stunned → skip action', () => {
    const actor = createUnit({ id: 'a', side: 'ally', buffs: [{ type: BuffType.STUN, remainingTurns: 1, value: 0, sourceId: 's' }] });
    const s = createState({ allyTeam: { units: [actor], side: 'ally' }, enemyTeam: { units: [createUnit({ id: 'e', side: 'enemy' })], side: 'enemy' } });
    const action = executor.executeUnitAction(s, actor);
    expect(action!.skill).toBeNull(); expect(action!.description).toContain('被控制');
  });

  it('frozen → skip action', () => {
    const actor = createUnit({ id: 'a', side: 'ally', buffs: [{ type: BuffType.FREEZE, remainingTurns: 1, value: 0, sourceId: 's' }] });
    const s = createState({ allyTeam: { units: [actor], side: 'ally' }, enemyTeam: { units: [createUnit({ id: 'e', side: 'enemy' })], side: 'enemy' } });
    expect(executor.executeUnitAction(s, actor)!.description).toContain('被控制');
  });

  it('DOT + control: DOT first then control', () => {
    const calc = createMockCalculator({ calculateDotDamage: jest.fn(() => 10), isControlled: jest.fn(() => true) });
    const exec = new BattleTurnExecutor(calc);
    const actor = createUnit({ id: 'a', side: 'ally', hp: 100, buffs: [{ type: BuffType.BURN, remainingTurns: 2, value: 0.05, sourceId: 's' }] });
    const s = createState({ allyTeam: { units: [actor], side: 'ally' }, enemyTeam: { units: [createUnit({ id: 'e', side: 'enemy' })], side: 'enemy' } });
    const action = exec.executeUnitAction(s, actor);
    expect(actor.hp).toBe(90); expect(action!.description).toContain('被控制');
  });

  it('DOT kills before control check', () => {
    const calc = createMockCalculator({ calculateDotDamage: jest.fn(() => 200), isControlled: jest.fn(() => true) });
    const exec = new BattleTurnExecutor(calc);
    const actor = createUnit({ id: 'a', side: 'ally', hp: 50, buffs: [{ type: BuffType.BURN, remainingTurns: 2, value: 0.05, sourceId: 's' }] });
    const s = createState({ allyTeam: { units: [actor], side: 'ally' }, enemyTeam: { units: [createUnit({ id: 'e', side: 'enemy' })], side: 'enemy' } });
    const action = exec.executeUnitAction(s, actor);
    expect(actor.isAlive).toBe(false); expect(action!.description).toContain('阵亡');
  });
});

// 10. 技能冷却
describe('BattleTurnExecutor 技能冷却', () => {
  let executor: BattleTurnExecutor;
  beforeEach(() => { executor = new BattleTurnExecutor(createMockCalculator()); });

  it('sets cooldown after using ultimate', () => {
    const sk = { ...ULTIMATE_SKILL, currentCooldown: 0 };
    const actor = createUnit({ id: 'a', side: 'ally', rage: 100, skills: [sk] });
    const s = createState({ allyTeam: { units: [actor], side: 'ally' }, enemyTeam: { units: [createUnit({ id: 'e', side: 'enemy' })], side: 'enemy' } });
    executor.executeUnitAction(s, actor); expect(sk.currentCooldown).toBe(ULTIMATE_SKILL.cooldown);
  });

  it('no cooldown for normal attacks', () => {
    const actor = createUnit({ id: 'a', side: 'ally', rage: 0, skills: [] });
    const s = createState({ allyTeam: { units: [actor], side: 'ally' }, enemyTeam: { units: [createUnit({ id: 'e', side: 'enemy' })], side: 'enemy' } });
    executor.executeUnitAction(s, actor); expect(actor.normalAttack.currentCooldown).toBe(0);
  });
});

// 11. 行动记录
describe('BattleTurnExecutor 行动记录', () => {
  let executor: BattleTurnExecutor;
  beforeEach(() => { executor = new BattleTurnExecutor(createMockCalculator()); });

  it('normal attack description', () => {
    const actor = createUnit({ id: 'a', side: 'ally', name: '关羽' });
    const s = createState({ allyTeam: { units: [actor], side: 'ally' }, enemyTeam: { units: [createUnit({ id: 'e', side: 'enemy', name: '贼' })], side: 'enemy' }, currentTurn: 3 });
    const action = executor.executeUnitAction(s, actor);
    expect(action!.turn).toBe(3); expect(action!.actorName).toBe('关羽');
    expect(action!.isNormalAttack).toBe(true); expect(action!.description).toContain('普通攻击');
  });

  it('ultimate description', () => {
    const actor = createUnit({ id: 'a', side: 'ally', name: '关羽', rage: 100, skills: [{ ...ULTIMATE_SKILL }] });
    const s = createState({ allyTeam: { units: [actor], side: 'ally' }, enemyTeam: { units: [createUnit({ id: 'e', side: 'enemy', name: '贼' })], side: 'enemy' }, currentTurn: 2 });
    const action = executor.executeUnitAction(s, actor);
    expect(action!.description).toContain('释放'); expect(action!.description).toContain('大招');
  });

  it('damage results record', () => {
    const actor = createUnit({ id: 'a', side: 'ally' });
    const s = createState({ allyTeam: { units: [actor], side: 'ally' }, enemyTeam: { units: [createUnit({ id: 'e', side: 'enemy' })], side: 'enemy' } });
    const action = executor.executeUnitAction(s, actor);
    expect(action!.damageResults).toBeInstanceOf(Object); expect('e' in action!.damageResults).toBe(true);
  });
});

// 12. 伤害计算交互
describe('BattleTurnExecutor 伤害交互', () => {
  let executor: BattleTurnExecutor; let calc: IDamageCalculator;
  beforeEach(() => { calc = createMockCalculator(); executor = new BattleTurnExecutor(calc); });

  it('calls calculateDamage with correct multiplier', () => {
    const actor = createUnit({ id: 'a', side: 'ally' }); const enemy = createUnit({ id: 'e', side: 'enemy' });
    const s = createState({ allyTeam: { units: [actor], side: 'ally' }, enemyTeam: { units: [enemy], side: 'enemy' } });
    executor.executeUnitAction(s, actor); expect(calc.calculateDamage).toHaveBeenCalledWith(actor, enemy, 1.0);
  });

  it('calls calculateDamage with ultimate multiplier', () => {
    const actor = createUnit({ id: 'a', side: 'ally', rage: 100, skills: [{ ...ULTIMATE_SKILL }] }); const enemy = createUnit({ id: 'e', side: 'enemy' });
    const s = createState({ allyTeam: { units: [actor], side: 'ally' }, enemyTeam: { units: [enemy], side: 'enemy' } });
    executor.executeUnitAction(s, actor); expect(calc.calculateDamage).toHaveBeenCalledWith(actor, enemy, 2.0);
  });

  it('calls applyDamage for each target', () => {
    const actor = createUnit({ id: 'a', side: 'ally', rage: 100, skills: [{ ...ULTIMATE_SKILL }] });
    const s = createState({ allyTeam: { units: [actor], side: 'ally' }, enemyTeam: { units: [createUnit({ id: 'e1', side: 'enemy' }), createUnit({ id: 'e2', side: 'enemy' })], side: 'enemy' } });
    executor.executeUnitAction(s, actor); expect(calc.applyDamage).toHaveBeenCalledTimes(2);
  });

  it('skips dead targets in damage loop', () => {
    const actor = createUnit({ id: 'a', side: 'ally', rage: 100, skills: [{ ...ULTIMATE_SKILL }] });
    const alive = createUnit({ id: 'al', side: 'enemy' }); const dead = createUnit({ id: 'dd', side: 'enemy', isAlive: false, hp: 0 });
    const s = createState({ allyTeam: { units: [actor], side: 'ally' }, enemyTeam: { units: [alive, dead], side: 'enemy' } });
    executor.executeUnitAction(s, actor);
    const aliveCalls = (calc.applyDamage as ReturnType<typeof jest.fn>).mock.calls.filter((c: any[]) => c[0].id === 'al');
    expect(aliveCalls.length).toBe(1);
  });
});

// 13. 构造函数 & 依赖注入
describe('BattleTurnExecutor 构造函数', () => {
  it('accepts custom damage calculator', () => {
    const custom = createMockCalculator(); const exec = new BattleTurnExecutor(custom);
    const actor = createUnit({ id: 'a', side: 'ally' });
    const s = createState({ allyTeam: { units: [actor], side: 'ally' }, enemyTeam: { units: [createUnit({ id: 'e', side: 'enemy' })], side: 'enemy' } });
    exec.executeUnitAction(s, actor); expect(custom.calculateDamage).toHaveBeenCalled();
  });

  it('works with calculator returning 0 damage', () => {
    const zeroCalc = createMockCalculator({
      calculateDamage: jest.fn(() => ({ damage: 0, baseDamage: 0, skillMultiplier: 1, isCritical: false, criticalMultiplier: 1, restraintMultiplier: 1, randomFactor: 1, isMinDamage: false })),
      applyDamage: jest.fn(() => 0),
    });
    const exec = new BattleTurnExecutor(zeroCalc); const actor = createUnit({ id: 'a', side: 'ally' });
    const s = createState({ allyTeam: { units: [actor], side: 'ally' }, enemyTeam: { units: [createUnit({ id: 'e', side: 'enemy' })], side: 'enemy' } });
    const action = exec.executeUnitAction(s, actor);
    expect(action).not.toBeNull(); expect(action!.description).toContain('0 点伤害');
  });

  it('no DOT when calculateDotDamage returns 0', () => {
    const calc = createMockCalculator({ calculateDotDamage: jest.fn(() => 0) });
    const exec = new BattleTurnExecutor(calc);
    const actor = createUnit({ id: 'a', side: 'ally', hp: 100, buffs: [{ type: BuffType.BURN, remainingTurns: 2, value: 0.05, sourceId: 's' }] });
    const s = createState({ allyTeam: { units: [actor], side: 'ally' }, enemyTeam: { units: [createUnit({ id: 'e', side: 'enemy' })], side: 'enemy' } });
    exec.executeUnitAction(s, actor); expect(actor.hp).toBe(100);
  });

  it('no control when isControlled returns false', () => {
    const calc = createMockCalculator({ isControlled: jest.fn(() => false) });
    const exec = new BattleTurnExecutor(calc);
    const actor = createUnit({ id: 'a', side: 'ally', buffs: [{ type: BuffType.ATK_UP, remainingTurns: 1, value: 0.1, sourceId: 's' }] });
    const s = createState({ allyTeam: { units: [actor], side: 'ally' }, enemyTeam: { units: [createUnit({ id: 'e', side: 'enemy' })], side: 'enemy' } });
    const action = exec.executeUnitAction(s, actor); expect(action!.skill).not.toBeNull();
  });

  it('executeUnitAction returns action with correct actorSide', () => {
    const exec = new BattleTurnExecutor(createMockCalculator());
    const enemy = createUnit({ id: 'ea', side: 'enemy', name: '敌方武将' });
    const s = createState({ allyTeam: { units: [createUnit({ id: 'a', side: 'ally' })], side: 'ally' }, enemyTeam: { units: [enemy], side: 'enemy' } });
    const action = exec.executeUnitAction(s, enemy); expect(action!.actorSide).toBe('enemy');
  });
});

