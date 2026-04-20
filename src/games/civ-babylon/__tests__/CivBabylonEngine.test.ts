/**
 * 四大文明·巴比伦 (Civ Babylon) — v3.0 引擎测试套件
 *
 * 完全重写，匹配 v3.0 统一子系统架构的公共 API。
 * 覆盖常量验证、引擎初始化、建筑系统、英雄系统、资源系统、
 * 时代系统、科技系统、声望系统、存档系统、渲染和输入处理。
 */
import { CivBabylonEngine, type CivBabylonSaveState } from '@/games/civ-babylon/CivBabylonEngine';
import {
  GAME_ID,
  GAME_TITLE,
  BUILDINGS,
  DYNASTIES,
  HEROES,
  INVENTIONS,
  PRESTIGE_CONFIG,
  COLOR_THEME,
  RARITY_COLORS,
  RESOURCES,
  INITIAL_RESOURCES,
  INITIALLY_UNLOCKED,
  CLICK_REWARD,
} from '@/games/civ-babylon/constants';

// ═══════════════════════════════════════════════════════════════
// 测试辅助
// ═══════════════════════════════════════════════════════════════

function createCanvas(): HTMLCanvasElement {
  return document.createElement('canvas');
}

function createEngine(): CivBabylonEngine {
  const engine = new CivBabylonEngine();
  const canvas = createCanvas();
  canvas.width = 480;
  canvas.height = 640;
  (engine as any).canvas = canvas;
  (engine as any).ctx = canvas.getContext('2d');
  (engine as any)._status = 'playing';
  (engine as any).onInit();
  return engine;
}

function createStartedEngine(): CivBabylonEngine {
  const engine = createEngine();
  engine.start();
  return engine;
}

/** 直接设置引擎内部资源（绕过正常游戏逻辑） */
function setResources(engine: CivBabylonEngine, resources: Record<string, number>): void {
  const res = (engine as any).res as Record<string, number>;
  for (const [id, amount] of Object.entries(resources)) {
    res[id] = amount;
  }
}

// ═══════════════════════════════════════════════════════════════
// 1. 常量验证 (6 tests)
// ═══════════════════════════════════════════════════════════════

describe('常量验证', () => {
  it('BUILDINGS 有 8 个建筑', () => {
    expect(BUILDINGS).toHaveLength(8);
  });

  it('DYNASTIES 有 6 个时代', () => {
    expect(DYNASTIES).toHaveLength(6);
  });

  it('HEROES 有 8 个英雄', () => {
    expect(HEROES).toHaveLength(8);
  });

  it('INVENTIONS 有 9 项发明', () => {
    expect(INVENTIONS).toHaveLength(9);
  });

  it('RESOURCES 有 4 种资源', () => {
    expect(RESOURCES).toHaveLength(4);
    const ids = RESOURCES.map(r => r.id);
    expect(ids).toContain('grain');
    expect(ids).toContain('clay');
    expect(ids).toContain('copper');
    expect(ids).toContain('silver');
  });

  it('GAME_ID 是 "civ-babylon"', () => {
    expect(GAME_ID).toBe('civ-babylon');
  });
});

// ═══════════════════════════════════════════════════════════════
// 2. 引擎初始化 (5 tests)
// ═══════════════════════════════════════════════════════════════

describe('引擎初始化', () => {
  it('创建引擎不报错', () => {
    expect(() => createEngine()).not.toThrow();
  });

  it('init 后状态正常（_gameId 正确）', () => {
    const engine = createEngine();
    expect((engine as any)._gameId).toBe('civ-babylon');
  });

  it('start 后状态为 playing', () => {
    const engine = createStartedEngine();
    expect(engine.status).toBe('playing');
  });

  it('stop（pause）后状态为 paused', () => {
    const engine = createStartedEngine();
    engine.pause();
    expect(engine.status).toBe('paused');
  });

  it('初始资源为 grain=50, clay=0, copper=0, silver=0', () => {
    const engine = createEngine();
    const res = engine.getResources();
    expect(res.grain).toBe(50);
    expect(res.clay).toBe(0);
    expect(res.copper).toBe(0);
    expect(res.silver).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 3. 建筑系统 (8 tests)
// ═══════════════════════════════════════════════════════════════

describe('建筑系统', () => {
  let engine: CivBabylonEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('初始解锁 farm', () => {
    const bldg = (engine as any).bldg;
    expect(bldg.isUnlocked('farm')).toBe(true);
  });

  it('购买建筑成功（资源充足时）', () => {
    setResources(engine, { grain: 100 });
    (engine as any).buyBuilding(); // selIdx=0 → farm, cost 10 grain
    const bldg = (engine as any).bldg;
    expect(bldg.getLevel('farm')).toBe(1);
  });

  it('资源不足时购买失败', () => {
    setResources(engine, { grain: 0 });
    (engine as any).buyBuilding();
    const bldg = (engine as any).bldg;
    expect(bldg.getLevel('farm')).toBe(0);
  });

  it('建筑升级后费用增加', () => {
    const bldg = (engine as any).bldg;
    setResources(engine, { grain: 100000 });
    // Get cost at Lv.0
    const cost0 = bldg.getCost('farm');
    // Upgrade farm several times (costMultiplier = 1.07)
    for (let i = 0; i < 5; i++) {
      bldg.purchase('farm', () => true, () => {});
    }
    const cost5 = bldg.getCost('farm');
    // After 5 upgrades, cost should be noticeably higher
    // 10 * 1.07^5 ≈ 14.03 → floor = 14 > 10
    expect(cost5.grain).toBeGreaterThan(cost0.grain);
  });

  it('建筑产出资源（farm Lv.1 产出 grain）', () => {
    const bldg = (engine as any).bldg;
    setResources(engine, { grain: 10000 });
    bldg.purchase('farm', () => true, () => {}); // farm → Lv.1
    const before = engine.getResources().grain;
    (engine as any).onUpdate(10000); // 10 seconds
    const after = engine.getResources().grain;
    expect(after).toBeGreaterThan(before);
  });

  it('建筑解锁条件（farm Lv.1 解锁 brick_kiln）', () => {
    const bldg = (engine as any).bldg;
    expect(bldg.isUnlocked('brick_kiln')).toBe(false);
    // Upgrade farm once
    bldg.purchase('farm', () => true, () => {});
    (engine as any).checkUnlocks();
    expect(bldg.isUnlocked('brick_kiln')).toBe(true);
  });

  it('获取建筑列表（初始解锁 1 个：farm）', () => {
    const bldg = (engine as any).bldg;
    const unlocked = bldg.getUnlockedBuildings();
    expect(unlocked.length).toBeGreaterThanOrEqual(1);
    const ids = unlocked.map((b: any) => b.id);
    expect(ids).toContain('farm');
  });

  it('建筑等级初始为 0，购买后增加', () => {
    const bldg = (engine as any).bldg;
    expect(bldg.getLevel('farm')).toBe(0);
    setResources(engine, { grain: 10000 });
    bldg.purchase('farm', () => true, () => {});
    expect(bldg.getLevel('farm')).toBe(1);
    bldg.purchase('farm', () => true, () => {});
    expect(bldg.getLevel('farm')).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════
// 4. 英雄系统 (5 tests)
// ═══════════════════════════════════════════════════════════════

describe('英雄系统', () => {
  it('英雄列表可获取（8 个英雄）', () => {
    expect(HEROES).toHaveLength(8);
    for (const h of HEROES) {
      expect(h.id).toBeTruthy();
      expect(h.name).toBeTruthy();
    }
  });

  it('招募英雄需要资源（recruitCost 存在且非零）', () => {
    for (const h of HEROES) {
      expect(h.recruitCost).toBeDefined();
      const costs = Object.values(h.recruitCost);
      expect(costs.some(c => c > 0)).toBe(true);
    }
  });

  it('英雄稀有度包含 uncommon/rare/epic/legendary', () => {
    const validRarities = ['uncommon', 'rare', 'epic', 'legendary'];
    for (const h of HEROES) {
      expect(validRarities).toContain(h.rarity);
    }
    // Verify at least one of each rarity exists
    const rarities = new Set(HEROES.map(h => h.rarity));
    expect(rarities.has('uncommon')).toBe(true);
    expect(rarities.has('rare')).toBe(true);
    expect(rarities.has('epic')).toBe(true);
    expect(rarities.has('legendary')).toBe(true);
  });

  it('英雄属性（baseStats 包含 administration/military/culture）', () => {
    for (const h of HEROES) {
      expect(h.baseStats).toBeDefined();
      expect(typeof h.baseStats.administration).toBe('number');
      expect(typeof h.baseStats.military).toBe('number');
      expect(typeof h.baseStats.culture).toBe('number');
      expect(h.baseStats.administration).toBeGreaterThan(0);
      expect(h.baseStats.military).toBeGreaterThan(0);
      expect(h.baseStats.culture).toBeGreaterThan(0);
    }
  });

  it('英雄加成描述（bonus 字段非空）', () => {
    for (const h of HEROES) {
      expect(h.bonus).toBeTruthy();
      expect(typeof h.bonus).toBe('string');
      expect(h.bonus.length).toBeGreaterThan(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 5. 资源系统 (5 tests)
// ═══════════════════════════════════════════════════════════════

describe('资源系统', () => {
  let engine: CivBabylonEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('资源自动增长（建筑产出）', () => {
    const bldg = (engine as any).bldg;
    setResources(engine, { grain: 10000 });
    bldg.purchase('farm', () => true, () => {}); // farm → Lv.1
    const before = engine.getResources().grain;
    (engine as any).onUpdate(10000); // 10 seconds
    expect(engine.getResources().grain).toBeGreaterThan(before);
  });

  it('点击产出资源（Space 键增加 grain）', () => {
    const before = engine.getResources().grain;
    engine.handleKeyDown(' ');
    expect(engine.getResources().grain).toBe(before + CLICK_REWARD.grain);
  });

  it('资源消耗（购买建筑扣除 grain）', () => {
    setResources(engine, { grain: 100 });
    const before = engine.getResources().grain;
    (engine as any).buyBuilding(); // buy farm, cost 10 grain
    expect(engine.getResources().grain).toBeLessThan(before);
  });

  it('多种资源独立（farm 产出 grain，brick_kiln 产出 clay）', () => {
    const bldg = (engine as any).bldg;
    setResources(engine, { grain: 100000 });
    bldg.purchase('farm', () => true, () => {}); // farm → Lv.1
    // Unlock and purchase brick_kiln
    bldg.forceUnlock('brick_kiln');
    bldg.purchase('brick_kiln', () => true, () => {}); // brick_kiln → Lv.1
    (engine as any).onUpdate(10000);
    const res = engine.getResources();
    expect(res.grain).toBeGreaterThan(0);
    expect(res.clay).toBeGreaterThan(0);
  });

  it('资源格式化（formatNumber 处理大数）', () => {
    expect(engine.formatNumber(1000, 1)).toMatch(/K/);
    expect(engine.formatNumber(1000000, 1)).toMatch(/M/);
    expect(engine.formatNumber(1000000000, 1)).toMatch(/B/);
    expect(engine.formatNumber(1000000000000, 1)).toMatch(/T/);
  });
});

// ═══════════════════════════════════════════════════════════════
// 6. 时代系统 (4 tests)
// ═══════════════════════════════════════════════════════════════

describe('时代系统', () => {
  let engine: CivBabylonEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('初始时代为苏美尔（sumer）', () => {
    const stage = engine.getStageInfo();
    expect(stage).toBeDefined();
    expect(stage!.id).toBe('sumer');
    expect(stage!.name).toBe('苏美尔');
  });

  it('满足条件后时代升级（akkadian 需要 grain>=500, clay>=200）', () => {
    setResources(engine, { grain: 1000, clay: 500 });
    (engine as any).checkStage();
    const stage = engine.getStageInfo();
    expect(stage).toBeDefined();
    expect(stage!.id).toBe('akkadian');
  });

  it('时代倍率影响产出（sumer = 1.0，akkadian = 1.3）', () => {
    const stages = (engine as any).stages;
    // sumer multiplier = 1.0
    expect(stages.getMultiplier('production')).toBe(1.0);

    // Advance to akkadian
    setResources(engine, { grain: 1000, clay: 500 });
    (engine as any).checkStage();
    expect(stages.getMultiplier('production')).toBe(1.3);
  });

  it('最终时代为波斯（persian）', () => {
    const last = DYNASTIES[DYNASTIES.length - 1];
    expect(last.id).toBe('persian');
    expect(last.name).toBe('波斯');
    expect(last.productionMultiplier).toBe(3.0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 7. 科技系统 (4 tests)
// ═══════════════════════════════════════════════════════════════

describe('科技系统', () => {
  let engine: CivBabylonEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('科技列表（9 项发明，3 个分支）', () => {
    expect(INVENTIONS).toHaveLength(9);
    const branches = new Set(INVENTIONS.map(t => t.branch));
    expect(branches.size).toBe(3);
    expect(branches.has('building')).toBe(true);
    expect(branches.has('agriculture')).toBe(true);
    expect(branches.has('culture')).toBe(true);
  });

  it('科技前置条件（tier 1 无前置，tier 2+ 有前置）', () => {
    const tier1 = INVENTIONS.filter(t => t.tier === 1);
    expect(tier1).toHaveLength(3);
    for (const t of tier1) {
      expect(t.requires).toHaveLength(0);
    }
    const higher = INVENTIONS.filter(t => t.tier >= 2);
    for (const t of higher) {
      expect(t.requires.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('科技效果（每项科技有至少一个 effect）', () => {
    for (const t of INVENTIONS) {
      expect(t.effects.length).toBeGreaterThanOrEqual(1);
      for (const e of t.effects) {
        expect(e.type).toBeDefined();
        expect(Math.abs(e.value)).toBeGreaterThan(0);
      }
    }
  });

  it('科技分支（building/agriculture/culture 各 3 级）', () => {
    const building = INVENTIONS.filter(t => t.branch === 'building');
    const agriculture = INVENTIONS.filter(t => t.branch === 'agriculture');
    const culture = INVENTIONS.filter(t => t.branch === 'culture');
    expect(building).toHaveLength(3);
    expect(agriculture).toHaveLength(3);
    expect(culture).toHaveLength(3);
    // Each branch has tier 1, 2, 3
    for (const branch of [building, agriculture, culture]) {
      const tiers = branch.map(t => t.tier).sort();
      expect(tiers).toEqual([1, 2, 3]);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 8. 声望系统 (4 tests)
// ═══════════════════════════════════════════════════════════════

describe('声望系统', () => {
  let engine: CivBabylonEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('声望转生（资源不足时不可转生）', () => {
    setResources(engine, { grain: 100 });
    engine.doPrestige();
    expect(engine.getPrestigeState().count).toBe(0);
  });

  it('资源保留（转生后保留 10% 资源）', () => {
    setResources(engine, { grain: 200000, clay: 0, copper: 0, silver: 0 });
    engine.doPrestige();
    const res = engine.getResources();
    // retention = 0.1, so grain should be ~20000
    expect(res.grain).toBeGreaterThan(0);
    expect(res.grain).toBeLessThan(200000);
  });

  it('声望货币（转生后获得神眷）', () => {
    setResources(engine, { grain: 200000, clay: 0, copper: 0, silver: 0 });
    engine.doPrestige();
    const ps = engine.getPrestigeState();
    expect(ps.count).toBe(1);
    expect(ps.currency).toBeGreaterThan(0);
  });

  it('声望倍率（转生后 multiplier > 1）', () => {
    setResources(engine, { grain: 200000, clay: 0, copper: 0, silver: 0 });
    engine.doPrestige();
    const ps = engine.getPrestigeState();
    expect(ps.multiplier).toBeGreaterThan(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// 9. 序列化 (3 tests)
// ═══════════════════════════════════════════════════════════════

describe('序列化', () => {
  let engine: CivBabylonEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('serialize 返回有效状态', () => {
    const state = engine.serialize();
    expect(state).toBeDefined();
    expect(typeof state).toBe('object');
    expect(state.resources).toBeDefined();
    expect(state.buildings).toBeDefined();
    expect(state.currentStage).toBe('sumer');
    expect(state.prestigeState).toBeDefined();
    expect(state.prestigeState.currency).toBe(0);
    expect(state.prestigeState.count).toBe(0);
  });

  it('deserialize 恢复状态', () => {
    setResources(engine, { grain: 9999, clay: 8888, copper: 7777 });
    const bldg = (engine as any).bldg;
    bldg.purchase('farm', () => true, () => {});

    const state = engine.serialize();
    const engine2 = createEngine();
    engine2.deserialize(state);

    const res = engine2.getResources();
    expect(res.grain).toBe(9999);
    expect(res.clay).toBe(8888);
    expect(res.copper).toBe(7777);
  });

  it('循环一致性（serialize → deserialize → serialize 一致）', () => {
    setResources(engine, { grain: 5555, clay: 3333, copper: 1111 });
    const state = engine.serialize();

    const engine2 = createEngine();
    engine2.deserialize(state);
    const state2 = engine2.serialize();

    expect(state2.resources.grain).toBe(state.resources.grain);
    expect(state2.resources.clay).toBe(state.resources.clay);
    expect(state2.resources.copper).toBe(state.resources.copper);
    expect(state2.currentStage).toBe(state.currentStage);
  });
});

// ═══════════════════════════════════════════════════════════════
// 10. 渲染 (3 tests)
// ═══════════════════════════════════════════════════════════════

describe('渲染', () => {
  let engine: CivBabylonEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('render 不报错（主面板）', () => {
    const canvas = (engine as any).canvas as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    expect(() => {
      (engine as any).onRender(ctx, canvas.width, canvas.height);
    }).not.toThrow();
  });

  it('render 调用 Canvas API（fillRect 被调用）', () => {
    const canvas = (engine as any).canvas as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    const fillRectSpy = jest.spyOn(ctx, 'fillRect');
    (engine as any).onRender(ctx, canvas.width, canvas.height);
    expect(fillRectSpy).toHaveBeenCalled();
    fillRectSpy.mockRestore();
  });

  it('不同面板渲染（tech/heroes/prestige 均不报错）', () => {
    const canvas = (engine as any).canvas as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;

    const panels: Array<'tech' | 'heroes' | 'prestige'> = ['tech', 'heroes', 'prestige'];
    for (const panel of panels) {
      (engine as any).panel = panel;
      expect(() => {
        (engine as any).onRender(ctx, canvas.width, canvas.height);
      }).not.toThrow();
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 11. 输入处理 (3 tests)
// ═══════════════════════════════════════════════════════════════

describe('输入处理', () => {
  let engine: CivBabylonEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('Space 键触发点击（增加 grain）', () => {
    const before = engine.getResources().grain;
    engine.handleKeyDown(' ');
    expect(engine.getResources().grain).toBe(before + CLICK_REWARD.grain);
  });

  it('T 键切换科技面板', () => {
    engine.handleKeyDown('t');
    expect(engine.getActivePanel()).toBe('tech');
    engine.handleKeyDown('t');
    expect(engine.getActivePanel()).toBe('none');
  });

  it('H 键切换英雄面板', () => {
    engine.handleKeyDown('h');
    expect(engine.getActivePanel()).toBe('heroes');
    engine.handleKeyDown('h');
    expect(engine.getActivePanel()).toBe('none');
  });

  it('Escape 返回主面板', () => {
    engine.handleKeyDown('t');
    expect(engine.getActivePanel()).toBe('tech');
    engine.handleKeyDown('Escape');
    expect(engine.getActivePanel()).toBe('none');
  });
});

// ═══════════════════════════════════════════════════════════════
// 12. 边界情况
// ═══════════════════════════════════════════════════════════════

describe('边界情况', () => {
  let engine: CivBabylonEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('零 dt 更新不报错', () => {
    expect(() => (engine as any).onUpdate(0)).not.toThrow();
  });

  it('极大 dt 更新不报错', () => {
    expect(() => (engine as any).onUpdate(3600000)).not.toThrow();
  });

  it('多次声望转生', () => {
    for (let i = 0; i < 3; i++) {
      setResources(engine, { grain: 200000, clay: 0, copper: 0, silver: 0 });
      engine.doPrestige();
    }
    expect(engine.getPrestigeState().count).toBe(3);
  });

  it('getResources 返回副本，修改不影响引擎内部', () => {
    const res = engine.getResources();
    res.grain = 9999;
    expect(engine.getResources().grain).toBe(50);
  });

  it('资源不会变为负数', () => {
    setResources(engine, { grain: 5 });
    (engine as any).buyBuilding(); // farm costs 10, but only 5 grain
    expect(engine.getResources().grain).toBeGreaterThanOrEqual(0);
  });

  it('快速面板切换不报错', () => {
    expect(() => {
      engine.handleKeyDown('t');
      engine.handleKeyDown('h');
      engine.handleKeyDown('t');
      engine.handleKeyDown('Escape');
    }).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════
// 13. 常量详细验证
// ═══════════════════════════════════════════════════════════════

describe('常量详细验证', () => {
  it('BUILDINGS 所有建筑有唯一 ID', () => {
    const ids = BUILDINGS.map(b => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('DYNASTIES 按顺序排列', () => {
    for (let i = 0; i < DYNASTIES.length; i++) {
      expect(DYNASTIES[i].order).toBe(i + 1);
    }
    // First dynasty has no prerequisite
    expect(DYNASTIES[0].prerequisiteStageId).toBeNull();
    // Others have prerequisite
    for (let i = 1; i < DYNASTIES.length; i++) {
      expect(DYNASTIES[i].prerequisiteStageId).toBeTruthy();
    }
  });

  it('COLOR_THEME 包含所有必要字段', () => {
    expect(COLOR_THEME).toHaveProperty('bgGradient1');
    expect(COLOR_THEME).toHaveProperty('bgGradient2');
    expect(COLOR_THEME).toHaveProperty('textPrimary');
    expect(COLOR_THEME).toHaveProperty('textSecondary');
    expect(COLOR_THEME).toHaveProperty('textDim');
    expect(COLOR_THEME).toHaveProperty('accentGold');
    expect(COLOR_THEME).toHaveProperty('accentGreen');
    expect(COLOR_THEME).toHaveProperty('panelBg');
    expect(COLOR_THEME).toHaveProperty('selectedBg');
    expect(COLOR_THEME).toHaveProperty('selectedBorder');
    expect(COLOR_THEME).toHaveProperty('affordable');
    expect(COLOR_THEME).toHaveProperty('unaffordable');
  });

  it('RARITY_COLORS 包含所有稀有度', () => {
    expect(RARITY_COLORS).toHaveProperty('uncommon');
    expect(RARITY_COLORS).toHaveProperty('rare');
    expect(RARITY_COLORS).toHaveProperty('epic');
    expect(RARITY_COLORS).toHaveProperty('legendary');
  });

  it('PRESTIGE_CONFIG 参数正确', () => {
    expect(PRESTIGE_CONFIG.currencyName).toBe('神眷');
    expect(PRESTIGE_CONFIG.base).toBe(10);
    expect(PRESTIGE_CONFIG.threshold).toBe(12000);
    expect(PRESTIGE_CONFIG.bonusMultiplier).toBe(0.12);
    expect(PRESTIGE_CONFIG.retention).toBe(0.1);
  });

  it('INITIALLY_UNLOCKED 包含 farm', () => {
    expect(INITIALLY_UNLOCKED).toEqual(['farm']);
  });

  it('CLICK_REWARD 为 { grain: 1 }', () => {
    expect(CLICK_REWARD).toEqual({ grain: 1 });
  });
});
