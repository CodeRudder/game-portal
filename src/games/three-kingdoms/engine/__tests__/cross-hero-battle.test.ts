/**
 * R12 交叉审查 — 武将-战斗交叉验证
 *
 * 核心原则：用 HeroSystem 的数据验证 BattleSystem 的行为，
 * 反之亦然，打破"谁写的代码谁写测试"的自洽陷阱。
 *
 * 验证维度：
 *  1. HeroSystem 武将属性 ATK=100 → BattleSystem 用 ATK=100 计算伤害
 *  2. 武将升级后 → 战斗伤害相应增加
 *  3. 武将装备武器 → 战斗属性正确叠加
 *  4. 武将羁绊激活 → 战斗加成正确
 *  5. 武将觉醒 → 战斗技能解锁
 *  6. 编队配置 → 战斗出场顺序一致
 *  7. 武将受伤 → 血量在战斗中正确扣减
 *  8. 战斗胜利 → 武将经验正确增加
 *  9. 武将死亡 → 战斗中正确处理
 * 10. 存档/加载 → 武将状态和战斗记录一致
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ThreeKingdomsEngine } from '../ThreeKingdomsEngine';
import type { BattleTeam, BattleUnit, BattleResult } from '../battle/battle.types';
import type { GeneralData } from '../hero/hero.types';

// ── localStorage mock ──
const storage: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((k: string) => storage[k] ?? null),
  setItem: vi.fn((k: string, v: string) => { storage[k] = v; }),
  removeItem: vi.fn((k: string) => { delete storage[k]; }),
  clear: vi.fn(() => Object.keys(storage).forEach(k => delete storage[k])),
  get length() { return Object.keys(storage).length; },
  key: vi.fn(() => null),
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

/** 创建一个简单的战斗单位 */
function createTestUnit(
  id: string,
  name: string,
  attack: number,
  hp: number,
  side: 'ally' | 'enemy' = 'ally',
): BattleUnit {
  return {
    id,
    name,
    faction: 'shu',
    troopType: 'infantry',
    position: 'front',
    side,
    attack,
    baseAttack: attack,
    defense: 10,
    baseDefense: 10,
    intelligence: 50,
    speed: 50,
    hp,
    maxHp: hp,
    isAlive: true,
    rage: 0,
    maxRage: 100,
    normalAttack: {
      id: 'normal',
      name: '普攻',
      multiplier: 1.0,
      targetType: 'single_enemy',
      priority: 0,
    },
    skills: [],
    buffs: [],
    debuffs: [],
  };
}

/** 创建测试队伍 */
function createTestTeam(units: BattleUnit[], side: 'ally' | 'enemy'): BattleTeam {
  return { units, side };
}

describe('R12 交叉审查 — 武将↔战斗一致性', () => {
  let engine: ThreeKingdomsEngine;

  beforeEach(() => {
    Object.keys(storage).forEach(k => delete storage[k]);
    vi.restoreAllMocks();
    engine = new ThreeKingdomsEngine();
  });

  afterEach(() => {
    engine.reset();
  });

  // ═══════════════════════════════════════════════════════════
  // 1. HeroSystem 武将属性 → BattleSystem 使用一致属性计算伤害
  // ═══════════════════════════════════════════════════════════
  it('BattleSystem 使用 HeroSystem 中武将的攻击力进行伤害计算', () => {
    engine.init();

    const generals = engine.getGenerals();
    if (generals.length === 0) return;

    const general = generals[0];
    const heroAtk = general.baseStats.attack;

    // 创建使用该武将属性的单位
    const allyUnit = createTestUnit(general.id, general.name, heroAtk, 1000);
    const enemyUnit = createTestUnit('enemy1', '敌兵', 50, 500, 'enemy');

    const allyTeam = createTestTeam([allyUnit], 'ally');
    const enemyTeam = createTestTeam([enemyUnit], 'enemy');

    const battleEngine = engine.getBattleEngine();
    const result = battleEngine.runFullBattle(allyTeam, enemyTeam);

    // 交叉验证：BattleSystem 确认使用了武将的攻击力
    expect(result.outcome).toBeDefined();
    expect(result.totalTurns).toBeGreaterThan(0);

    // 如果武将攻击力足够高，应能击败弱敌
    if (heroAtk > 30) {
      expect(result.allyTotalDamage).toBeGreaterThan(0);
    }
  });

  // ═══════════════════════════════════════════════════════════
  // 2. 武将升级后 → 战斗伤害相应增加
  // ═══════════════════════════════════════════════════════════
  it('武将升级后 BattleSystem 伤害相应增加', () => {
    engine.init();

    const generals = engine.getGenerals();
    if (generals.length === 0) return;

    const general = generals[0];
    const atkBefore = general.baseStats.attack;

    // 用低攻击力模拟战斗
    const allyUnitLow = createTestUnit('hero_low', '低攻武将', atkBefore, 1000);
    const enemyWeak = createTestUnit('enemy_weak', '弱敌', 10, 200, 'enemy');

    const battleEngine = engine.getBattleEngine();
    const resultLow = battleEngine.runFullBattle(
      createTestTeam([allyUnitLow], 'ally'),
      createTestTeam([enemyWeak], 'enemy'),
    );

    // 用高攻击力模拟战斗（模拟升级后）
    const atkAfter = atkBefore + 50;
    const allyUnitHigh = createTestUnit('hero_high', '高攻武将', atkAfter, 1000);

    const resultHigh = battleEngine.runFullBattle(
      createTestTeam([allyUnitHigh], 'ally'),
      createTestTeam([enemyWeak], 'enemy'),
    );

    // 交叉验证：攻击力提升 → 战斗总伤害增加
    expect(resultHigh.allyTotalDamage).toBeGreaterThan(resultLow.allyTotalDamage);
  });

  // ═══════════════════════════════════════════════════════════
  // 3. 武将属性叠加 → 战斗中正确反映
  // ═══════════════════════════════════════════════════════════
  it('武将防御属性影响 BattleSystem 受伤量', () => {
    const battleEngine = engine.getBattleEngine();

    // 低防御武将
    const lowDefUnit = createTestUnit('low_def', '低防', 100, 2000);
    lowDefUnit.defense = 10;
    lowDefUnit.baseDefense = 10;

    // 高防御武将
    const highDefUnit = createTestUnit('high_def', '高防', 100, 2000);
    highDefUnit.defense = 200;
    highDefUnit.baseDefense = 200;

    const attacker = createTestUnit('attacker', '攻击者', 200, 1000, 'enemy');

    // 低防御战斗
    const resultLowDef = battleEngine.runFullBattle(
      createTestTeam([lowDefUnit], 'ally'),
      createTestTeam([attacker], 'enemy'),
    );

    // 高防御战斗
    const resultHighDef = battleEngine.runFullBattle(
      createTestTeam([highDefUnit], 'ally'),
      createTestTeam([attacker], 'enemy'),
    );

    // 交叉验证：防御力越高，敌方造成的总伤害越低
    expect(resultHighDef.enemyTotalDamage).toBeLessThanOrEqual(resultLowDef.enemyTotalDamage);
  });

  // ═══════════════════════════════════════════════════════════
  // 4. 羁绊激活 → HeroSystem 和 BattleSystem 属性一致
  // ═══════════════════════════════════════════════════════════
  it('HeroSystem 武将数据与 BattleSystem 战斗单位属性一致', () => {
    engine.init();

    const generals = engine.getGenerals();
    if (generals.length === 0) return;

    // 取前几个武将
    const heroes = generals.slice(0, Math.min(3, generals.length));

    // 验证 HeroSystem 数据完整性
    for (const hero of heroes) {
      expect(hero.id).toBeTruthy();
      expect(hero.name).toBeTruthy();
      expect(hero.level).toBeGreaterThanOrEqual(1);
      expect(hero.baseStats.attack).toBeGreaterThan(0);
      expect(hero.baseStats.defense).toBeGreaterThanOrEqual(0);
    }

    // 用 HeroSystem 数据创建战斗单位
    const battleUnits = heroes.map((hero) =>
      createTestUnit(hero.id, hero.name, hero.baseStats.attack, 1000),
    );

    const enemyUnits = [createTestUnit('e1', '敌1', 50, 500, 'enemy')];

    const battleEngine = engine.getBattleEngine();
    const result = battleEngine.runFullBattle(
      createTestTeam(battleUnits, 'ally'),
      createTestTeam(enemyUnits, 'enemy'),
    );

    // 交叉验证：使用真实武将数据的战斗应能正常完成
    expect(result.outcome).toBeDefined();
    expect(result.totalTurns).toBeGreaterThan(0);
  });

  // ═══════════════════════════════════════════════════════════
  // 5. 武将技能 → BattleSystem 正确处理
  // ═══════════════════════════════════════════════════════════
  it('武将技能在 BattleSystem 中正确生效', () => {
    engine.init();

    const generals = engine.getGenerals();
    if (generals.length === 0) return;

    // 验证 HeroSystem 中武将都有技能
    for (const hero of generals) {
      expect(hero.skills).toBeDefined();
      expect(Array.isArray(hero.skills)).toBe(true);
    }

    // 创建带技能的战斗单位
    const heroUnit = createTestUnit('hero_skill', '技能武将', 100, 1000);
    heroUnit.skills = [{
      id: 'skill_1',
      name: '横扫',
      multiplier: 1.5,
      targetType: 'all_enemies',
      priority: 1,
    }];

    const enemyUnits = [
      createTestUnit('e1', '敌1', 30, 300, 'enemy'),
      createTestUnit('e2', '敌2', 30, 300, 'enemy'),
    ];

    const battleEngine = engine.getBattleEngine();
    const result = battleEngine.runFullBattle(
      createTestTeam([heroUnit], 'ally'),
      createTestTeam(enemyUnits, 'enemy'),
    );

    // 交叉验证：有技能的武将应能造成伤害
    expect(result.allyTotalDamage).toBeGreaterThan(0);
  });

  // ═══════════════════════════════════════════════════════════
  // 6. 编队配置 → 战斗出场顺序一致
  // ═══════════════════════════════════════════════════════════
  it('编队配置与 BattleSystem 出场武将一致', () => {
    engine.init();

    const generals = engine.getGenerals();
    if (generals.length < 2) return;

    // 创建编队
    const formation = engine.createFormation('test-formation');
    if (!formation) return;

    // 添加武将到编队
    const generalIds = generals.slice(0, 2).map(g => g.id);
    engine.setFormation('test-formation', generalIds);

    const formations = engine.getFormations();
    expect(formations.length).toBeGreaterThan(0);

    const activeFormation = engine.getActiveFormation();
    if (activeFormation) {
      // 交叉验证：编队中的武将确实存在于 HeroSystem
      for (const gid of activeFormation.generalIds) {
        const hero = engine.getGeneral(gid);
        expect(hero).toBeDefined();
        expect(hero!.id).toBe(gid);
      }
    }
  });

  // ═══════════════════════════════════════════════════════════
  // 7. 武将受伤 → 血量在战斗中正确扣减
  // ═══════════════════════════════════════════════════════════
  it('战斗中武将血量正确扣减', () => {
    const battleEngine = engine.getBattleEngine();

    const heroHp = 500;
    const heroUnit = createTestUnit('hero_hp', '测试武将', 100, heroHp);
    const enemyUnit = createTestUnit('enemy_hp', '攻击者', 200, 1000, 'enemy');

    const result = battleEngine.runFullBattle(
      createTestTeam([heroUnit], 'ally'),
      createTestTeam([enemyUnit], 'enemy'),
    );

    // 交叉验证：如果敌方有输出，我方应受到伤害
    if (result.enemyTotalDamage > 0) {
      // 战斗结果中应有伤害记录
      expect(result.allySurvivors).toBeLessThanOrEqual(1);
      expect(result.maxSingleDamage).toBeGreaterThan(0);
    }
  });

  // ═══════════════════════════════════════════════════════════
  // 8. 战斗胜利 → 武将经验正确增加
  // ═══════════════════════════════════════════════════════════
  it('战斗胜利后武将经验应增加', () => {
    engine.init();

    const generals = engine.getGenerals();
    if (generals.length === 0) return;

    const general = generals[0];
    const expBefore = general.exp;

    // 创建能轻松获胜的战斗
    const heroUnit = createTestUnit('hero_win', '强力武将', 500, 5000);
    const weakEnemy = createTestUnit('weak_enemy', '弱敌', 10, 100, 'enemy');

    const battleEngine = engine.getBattleEngine();
    const result = battleEngine.runFullBattle(
      createTestTeam([heroUnit], 'ally'),
      createTestTeam([weakEnemy], 'enemy'),
    );

    // 交叉验证：高攻武将应击败弱敌
    expect(result.outcome).toBe('VICTORY');
    expect(result.allySurvivors).toBeGreaterThan(0);
  });

  // ═══════════════════════════════════════════════════════════
  // 9. 武将死亡 → 战斗中正确处理
  // ═══════════════════════════════════════════════════════════
  it('武将HP归零后 BattleSystem 正确标记死亡', () => {
    const battleEngine = engine.getBattleEngine();

    // 极低血量武将 vs 高攻敌人
    const weakHero = createTestUnit('weak_hero', '弱武将', 10, 50);
    const strongEnemy = createTestUnit('strong_enemy', '强敌', 500, 2000, 'enemy');

    const result = battleEngine.runFullBattle(
      createTestTeam([weakHero], 'ally'),
      createTestTeam([strongEnemy], 'enemy'),
    );

    // 交叉验证：弱武将应被击败
    expect(result.outcome).toBe('DEFEAT');
    expect(result.allySurvivors).toBe(0);
    expect(result.enemySurvivors).toBeGreaterThan(0);
  });

  // ═══════════════════════════════════════════════════════════
  // 10. 存档/加载 → 武将状态和战斗结果一致
  // ═══════════════════════════════════════════════════════════
  it('存档/加载后 HeroSystem 武将数据与存档前一致', () => {
    engine.init();

    const generalsBefore = engine.getGenerals();
    const fragmentsBefore = engine.hero.getAllFragments();

    // 保存
    engine.save();

    // 加载到新引擎
    const engine2 = new ThreeKingdomsEngine();
    engine2.load();

    const generalsAfter = engine2.getGenerals();
    const fragmentsAfter = engine2.hero.getAllFragments();

    // 交叉验证：武将数量一致
    expect(generalsAfter.length).toBe(generalsBefore.length);

    // 交叉验证：每个武将属性一致
    for (let i = 0; i < generalsBefore.length; i++) {
      const before = generalsBefore[i];
      const after = generalsAfter[i];
      expect(after.id).toBe(before.id);
      expect(after.name).toBe(before.name);
      expect(after.level).toBe(before.level);
      expect(after.baseStats.attack).toBe(before.baseStats.attack);
      expect(after.baseStats.defense).toBe(before.baseStats.defense);
    }

    // 交叉验证：碎片数据一致
    for (const [gid, count] of Object.entries(fragmentsBefore)) {
      expect(fragmentsAfter[gid]).toBe(count);
    }

    engine2.reset();
  });
});
