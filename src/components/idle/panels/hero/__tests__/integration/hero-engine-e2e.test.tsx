/**
 * 武将面板 — 引擎端到端测试
 *
 * 使用真实 ThreeKingdomsEngine 实例（非 mock），验证：
 *   1. 战力计算一致性（6 个测试）
 *   2. 羁绊激活准确性（6 个测试）
 *   3. 编队操作约束（6 个测试）
 *   4. 引导动作执行（6 个测试）
 *
 * @module hero-engine-e2e
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ThreeKingdomsEngine } from '../../../../../../games/three-kingdoms/engine/ThreeKingdomsEngine';

// ─────────────────────────────────────────────
// localStorage mock（引擎 SaveManager 依赖）
// ─────────────────────────────────────────────
const storage: Record<string, string> = {};
beforeEach(() => {
  Object.keys(storage).forEach((k) => delete storage[k]);
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (k: string) => storage[k] ?? null,
      setItem: (k: string, v: string) => { storage[k] = v; },
      removeItem: (k: string) => { delete storage[k]; },
      clear: () => Object.keys(storage).forEach((k) => delete storage[k]),
      get length() { return Object.keys(storage).length; },
      key: () => null,
    },
    writable: true,
    configurable: true,
  });
});

// ─────────────────────────────────────────────
// 引擎工厂函数
// ─────────────────────────────────────────────

/**
 * 创建并初始化一个真实 ThreeKingdomsEngine 实例
 *
 * 构造函数无参数；init() 完成子系统依赖注入和同步。
 */
function createEngine(): ThreeKingdomsEngine {
  const engine = new ThreeKingdomsEngine();
  engine.init();
  return engine;
}

/**
 * 添加武将并返回其数据
 */
function addHero(engine: ThreeKingdomsEngine, heroId: string) {
  const result = engine.hero.addGeneral(heroId);
  expect(result).not.toBeNull();
  return result!;
}

/**
 * 获取蜀国武将 IDs（用于编队测试）
 */
const SHU_HERO_IDS = ['liubei', 'guanyu', 'zhangfei', 'zhugeliang', 'zhaoyun', 'minbingduizhang'];
const WEI_HERO_IDS = ['caocao', 'dianwei', 'simayi', 'junshou'];
const WU_HERO_IDS = ['zhouyu', 'lushu', 'huanggai', 'xiangyongtoumu'];
const QUN_HERO_IDS = ['lvbu', 'xiaowei'];

// ═══════════════════════════════════════════════
// 1. 战力计算一致性
// ═══════════════════════════════════════════════
describe('战力计算一致性', () => {
  let engine: ThreeKingdomsEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  afterEach(() => {
    engine.reset();
  });

  it('单武将战力 > 0', () => {
    const hero = addHero(engine, 'guanyu');
    const power = engine.hero.calculatePower(hero);
    expect(power).toBeGreaterThan(0);
  });

  it('相同武将多次计算结果一致', () => {
    const hero = addHero(engine, 'liubei');
    const power1 = engine.hero.calculatePower(hero);
    const power2 = engine.hero.calculatePower(hero);
    expect(power1).toBe(power2);
  });

  it('高品阶武将战力高于低品阶武将（同等级）', () => {
    const guanyu = addHero(engine, 'guanyu');   // LEGENDARY
    const liubei = addHero(engine, 'liubei');   // EPIC
    const minbing = addHero(engine, 'minbingduizhang'); // COMMON

    const powerLegendary = engine.hero.calculatePower(guanyu);
    const powerEpic = engine.hero.calculatePower(liubei);
    const powerCommon = engine.hero.calculatePower(minbing);

    expect(powerLegendary).toBeGreaterThan(powerEpic);
    expect(powerEpic).toBeGreaterThan(powerCommon);
  });

  it('升级后战力严格增长', () => {
    const hero = addHero(engine, 'zhangfei');
    const powerBefore = engine.hero.calculatePower(hero);

    // 给经验升级
    engine.hero.addExp(hero.id, 500);
    const updated = engine.hero.getGeneral(hero.id)!;
    const powerAfter = engine.hero.calculatePower(updated);

    expect(powerAfter).toBeGreaterThan(powerBefore);
  });

  it('全体总战力等于各武将战力之和', () => {
    const ids = ['liubei', 'guanyu', 'zhangfei'];
    ids.forEach((id) => addHero(engine, id));

    const generals = engine.hero.getAllGenerals();
    const sumByIndividual = generals.reduce(
      (sum, g) => sum + engine.hero.calculatePower(g), 0,
    );
    const totalPower = engine.hero.calculateTotalPower();

    expect(totalPower).toBe(sumByIndividual);
  });

  it('不同武将战力互不干扰', () => {
    const hero1 = addHero(engine, 'guanyu');
    const hero2 = addHero(engine, 'caocao');

    const power1Before = engine.hero.calculatePower(hero1);
    // 给 hero2 升级，不应影响 hero1
    engine.hero.addExp(hero2.id, 1000);

    const hero1After = engine.hero.getGeneral(hero1.id)!;
    const power1After = engine.hero.calculatePower(hero1After);

    expect(power1After).toBe(power1Before);
  });
});

// ═══════════════════════════════════════════════
// 2. 羁绊激活准确性
// ═══════════════════════════════════════════════
describe('羁绊激活准确性', () => {
  let engine: ThreeKingdomsEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  afterEach(() => {
    engine.reset();
  });

  it('2名同阵营武将激活 faction_2 羁绊', () => {
    const heroes = [
      addHero(engine, 'liubei'),
      addHero(engine, 'guanyu'),
    ];

    const bonds = engine.bondSystem.detectActiveBonds(heroes);
    const faction2 = bonds.find((b) => b.type === 'faction_2' && b.faction === 'shu');

    expect(faction2).toBeDefined();
    expect(faction2!.heroCount).toBeGreaterThanOrEqual(2);
  });

  it('3名同阵营武将激活 faction_3 羁绊', () => {
    const heroes = [
      addHero(engine, 'liubei'),
      addHero(engine, 'guanyu'),
      addHero(engine, 'zhangfei'),
    ];

    const bonds = engine.bondSystem.detectActiveBonds(heroes);
    const faction3 = bonds.find((b) => b.type === 'faction_3' && b.faction === 'shu');

    expect(faction3).toBeDefined();
    expect(faction3!.heroCount).toBeGreaterThanOrEqual(3);
  });

  it('6名同阵营武将激活 faction_6 羁绊', () => {
    const heroes = SHU_HERO_IDS.map((id) => addHero(engine, id));

    const bonds = engine.bondSystem.detectActiveBonds(heroes);
    const faction6 = bonds.find((b) => b.type === 'faction_6' && b.faction === 'shu');

    expect(faction6).toBeDefined();
    expect(faction6!.heroCount).toBeGreaterThanOrEqual(6);
  });

  it('3+3不同阵营激活 mixed_3_3 羁绊', () => {
    // 3蜀 + 3魏
    const shuHeroes = ['liubei', 'guanyu', 'zhangfei'].map((id) => addHero(engine, id));
    const weiHeroes = ['caocao', 'dianwei', 'simayi'].map((id) => addHero(engine, id));
    const allHeroes = [...shuHeroes, ...weiHeroes];

    const bonds = engine.bondSystem.detectActiveBonds(allHeroes);
    const mixed = bonds.find((b) => b.type === 'mixed_3_3');

    expect(mixed).toBeDefined();
  });

  it('无同阵营武将不激活羁绊', () => {
    // 每个阵营1人
    const heroes = [
      addHero(engine, 'liubei'),  // shu
      addHero(engine, 'caocao'),  // wei
    ];

    const bonds = engine.bondSystem.detectActiveBonds(heroes);
    expect(bonds).toHaveLength(0);
  });

  it('羁绊加成按配置正确累加', () => {
    const heroes = SHU_HERO_IDS.map((id) => addHero(engine, id));

    const bonds = engine.bondSystem.detectActiveBonds(heroes);
    const bonuses = engine.bondSystem.calculateTotalBondBonuses(bonds);

    // faction_6 提供 attack: 0.25, defense: 0.15
    expect(bonuses.attack).toBeDefined();
    expect(bonuses.attack!).toBeGreaterThan(0);
    expect(bonuses.defense).toBeDefined();
    expect(bonuses.defense!).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════
// 3. 编队操作约束
// ═══════════════════════════════════════════════
describe('编队操作约束', () => {
  let engine: ThreeKingdomsEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  afterEach(() => {
    engine.reset();
  });

  it('创建编队后可获取编队数据', () => {
    const formation = engine.heroFormation.createFormation('1');
    expect(formation).not.toBeNull();
    expect(formation!.id).toBe('1');
    expect(formation!.slots).toHaveLength(6);
    expect(formation!.slots.every((s) => s === '')).toBe(true);
  });

  it('添加武将到编队成功', () => {
    addHero(engine, 'guanyu');
    engine.heroFormation.createFormation('1');

    const result = engine.heroFormation.addToFormation('1', 'guanyu');
    expect(result).not.toBeNull();
    expect(result!.slots).toContain('guanyu');
  });

  it('同一武将不可加入多个编队', () => {
    addHero(engine, 'guanyu');
    engine.heroFormation.createFormation('1');
    engine.heroFormation.createFormation('2');

    const r1 = engine.heroFormation.addToFormation('1', 'guanyu');
    expect(r1).not.toBeNull();

    const r2 = engine.heroFormation.addToFormation('2', 'guanyu');
    expect(r2).toBeNull();
  });

  it('编队满6人后不可再添加', () => {
    SHU_HERO_IDS.forEach((id) => addHero(engine, id));
    engine.heroFormation.createFormation('1');

    // 填满6个
    SHU_HERO_IDS.forEach((id) => {
      engine.heroFormation.addToFormation('1', id);
    });

    // 添加第7人
    addHero(engine, 'caocao');
    const result = engine.heroFormation.addToFormation('1', 'caocao');
    expect(result).toBeNull();
  });

  it('从编队移除武将成功', () => {
    addHero(engine, 'liubei');
    engine.heroFormation.createFormation('1');
    engine.heroFormation.addToFormation('1', 'liubei');

    const result = engine.heroFormation.removeFromFormation('1', 'liubei');
    expect(result).not.toBeNull();
    expect(result!.slots.every((s) => s === '')).toBe(true);
  });

  it('自动分配ID时编队最多创建3个', () => {
    const f1 = engine.heroFormation.createFormation();
    const f2 = engine.heroFormation.createFormation();
    const f3 = engine.heroFormation.createFormation();
    const f4 = engine.heroFormation.createFormation(); // 超过上限

    expect(f1).not.toBeNull();
    expect(f2).not.toBeNull();
    expect(f3).not.toBeNull();
    expect(f4).toBeNull();
  });
});

// ═══════════════════════════════════════════════
// 4. 引导动作执行
// ═══════════════════════════════════════════════
describe('引导动作执行', () => {
  let engine: ThreeKingdomsEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  afterEach(() => {
    engine.reset();
  });

  it('初始状态第一步为领取新手礼包', () => {
    const step = engine.tutorialGuide.getCurrentStep();
    expect(step).not.toBeNull();
    expect(step!.id).toBe('claim_newbie_pack');
    expect(step!.order).toBe(1);
  });

  it('按顺序完成步骤可逐步推进', () => {
    // 步骤1：领取新手礼包
    const r1 = engine.tutorialGuide.completeCurrentStep('claim_newbie_pack');
    expect(r1.success).toBe(true);
    expect(r1.rewards.length).toBeGreaterThan(0);

    // 步骤2应解锁
    const step2 = engine.tutorialGuide.getCurrentStep();
    expect(step2).not.toBeNull();
    expect(step2!.id).toBe('first_recruit');
  });

  it('错误动作不能完成当前步骤', () => {
    const result = engine.tutorialGuide.completeCurrentStep('wrong_action');
    expect(result.success).toBe(false);
    expect(result.reason).toContain('当前步骤需要');

    // 步骤未推进
    const step = engine.tutorialGuide.getCurrentStep();
    expect(step!.id).toBe('claim_newbie_pack');
  });

  it('跳过引导后不可再完成步骤', () => {
    engine.tutorialGuide.skipTutorial();

    const result = engine.tutorialGuide.completeCurrentStep('claim_newbie_pack');
    expect(result.success).toBe(false);
    expect(result.reason).toContain('已跳过');

    expect(engine.tutorialGuide.isSkipped()).toBe(true);
    expect(engine.tutorialGuide.getCurrentStep()).toBeNull();
  });

  it('完成全部4步后引导结束', () => {
    const actions = [
      'claim_newbie_pack',
      'first_recruit',
      'view_hero',
      'add_to_formation',
    ];

    for (const action of actions) {
      const r = engine.tutorialGuide.completeCurrentStep(action);
      expect(r.success).toBe(true);
    }

    expect(engine.tutorialGuide.isTutorialComplete()).toBe(true);
    expect(engine.tutorialGuide.getCurrentStep()).toBeNull();
    expect(engine.tutorialGuide.getProgress().percentage).toBe(100);
  });

  it('获取所有步骤状态反映完成进度', () => {
    const stepsBefore = engine.tutorialGuide.getAllSteps();
    expect(stepsBefore.every((s) => !s.isCompleted)).toBe(true);

    engine.tutorialGuide.completeCurrentStep('claim_newbie_pack');

    const stepsAfter = engine.tutorialGuide.getAllSteps();
    expect(stepsAfter[0].isCompleted).toBe(true);
    expect(stepsAfter[1].isCompleted).toBe(false);
    expect(stepsAfter[2].isCompleted).toBe(false);
    expect(stepsAfter[3].isCompleted).toBe(false);
  });
});
