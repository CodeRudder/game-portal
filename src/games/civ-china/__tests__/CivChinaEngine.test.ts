/**
 * 四大文明·华夏 (Civ China) — v3.0 引擎测试套件
 *
 * 完全重写，匹配 v3.0 统一子系统架构的公共 API。
 * 覆盖常量验证、引擎初始化、建筑系统、官员系统、资源系统、
 * 朝代系统、科技系统、声望系统、存档系统、渲染和输入处理。
 */
import { CivChinaEngine, type CivChinaSaveState } from '@/games/civ-china/CivChinaEngine';
import {
  GAME_ID,
  GAME_TITLE,
  BUILDINGS,
  DYNASTIES,
  OFFICIALS,
  INVENTIONS,
  PRESTIGE_CONFIG,
  COLOR_THEME,
  RARITY_COLORS,
  RESOURCES,
  INITIAL_RESOURCES,
  INITIALLY_UNLOCKED,
  CLICK_REWARD,
} from '@/games/civ-china/constants';

// ═══════════════════════════════════════════════════════════════
// 测试辅助
// ═══════════════════════════════════════════════════════════════

function createCanvas(): HTMLCanvasElement {
  return document.createElement('canvas');
}

function createEngine(): CivChinaEngine {
  const engine = new CivChinaEngine();
  const canvas = createCanvas();
  canvas.width = 480;
  canvas.height = 640;
  (engine as any).canvas = canvas;
  (engine as any).ctx = canvas.getContext('2d');
  (engine as any)._status = 'playing';
  (engine as any).onInit();
  return engine;
}

function createStartedEngine(): CivChinaEngine {
  const engine = createEngine();
  engine.start();
  return engine;
}

/** 直接设置引擎内部资源（绕过正常游戏逻辑） */
function setResources(engine: CivChinaEngine, resources: Record<string, number>): void {
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

  it('DYNASTIES 有 6 个朝代', () => {
    expect(DYNASTIES).toHaveLength(6);
  });

  it('OFFICIALS 有 8 个官员', () => {
    expect(OFFICIALS).toHaveLength(8);
  });

  it('INVENTIONS 有 9 项发明', () => {
    expect(INVENTIONS).toHaveLength(9);
  });

  it('RESOURCES 有 4 种资源', () => {
    expect(RESOURCES).toHaveLength(4);
    const ids = RESOURCES.map(r => r.id);
    expect(ids).toContain('food');
    expect(ids).toContain('silk');
    expect(ids).toContain('culture');
    expect(ids).toContain('mandate');
  });

  it('GAME_ID 是 "civ-china"', () => {
    expect(GAME_ID).toBe('civ-china');
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
    expect((engine as any)._gameId).toBe('civ-china');
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

  it('初始资源为 food=50, silk=0, culture=0, mandate=0', () => {
    const engine = createEngine();
    const res = engine.getResources();
    expect(res.food).toBe(50);
    expect(res.silk).toBe(0);
    expect(res.culture).toBe(0);
    expect(res.mandate).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 3. 建筑系统 (8 tests)
// ═══════════════════════════════════════════════════════════════

describe('建筑系统', () => {
  let engine: CivChinaEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('初始解锁 farm 和 silk_workshop', () => {
    const bldg = (engine as any).bldg;
    expect(bldg.isUnlocked('farm')).toBe(true);
    expect(bldg.isUnlocked('silk_workshop')).toBe(true);
  });

  it('购买建筑成功（资源充足时）', () => {
    setResources(engine, { food: 100 });
    (engine as any).buyBuilding(); // selIdx=0 → farm, cost 10 food
    const bldg = (engine as any).bldg;
    expect(bldg.getLevel('farm')).toBe(1);
  });

  it('资源不足时购买失败', () => {
    setResources(engine, { food: 0 });
    (engine as any).buyBuilding();
    const bldg = (engine as any).bldg;
    expect(bldg.getLevel('farm')).toBe(0);
  });

  it('建筑升级后费用增加', () => {
    const bldg = (engine as any).bldg;
    setResources(engine, { food: 100000 });
    // Get cost at Lv.0
    const cost0 = bldg.getCost('farm');
    // Upgrade farm several times (costMultiplier = 1.07, floor rounding means
    // first upgrade may not show increase, but after several it will)
    for (let i = 0; i < 5; i++) {
      bldg.purchase('farm', () => true, () => {});
    }
    const cost5 = bldg.getCost('farm');
    // After 5 upgrades, cost should be noticeably higher
    // 10 * 1.07^5 ≈ 14.03 → floor = 14 > 10
    expect(cost5.food).toBeGreaterThan(cost0.food);
  });

  it('建筑产出资源（farm Lv.1 产出 food）', () => {
    const bldg = (engine as any).bldg;
    setResources(engine, { food: 10000 });
    bldg.purchase('farm', () => true, () => {}); // farm → Lv.1
    const before = engine.getResources().food;
    (engine as any).onUpdate(10000); // 10 seconds
    const after = engine.getResources().food;
    expect(after).toBeGreaterThan(before);
  });

  it('建筑解锁条件（farm Lv.5 解锁 great_wall）', () => {
    const bldg = (engine as any).bldg;
    expect(bldg.isUnlocked('great_wall')).toBe(false);
    // Upgrade farm 5 times
    for (let i = 0; i < 5; i++) {
      bldg.purchase('farm', () => true, () => {});
    }
    (engine as any).checkUnlocks();
    expect(bldg.isUnlocked('great_wall')).toBe(true);
  });

  it('获取建筑列表（初始解锁 2 个）', () => {
    const bldg = (engine as any).bldg;
    const unlocked = bldg.getUnlockedBuildings();
    expect(unlocked.length).toBeGreaterThanOrEqual(2);
    const ids = unlocked.map((b: any) => b.id);
    expect(ids).toContain('farm');
    expect(ids).toContain('silk_workshop');
  });

  it('建筑等级初始为 0，购买后增加', () => {
    const bldg = (engine as any).bldg;
    expect(bldg.getLevel('farm')).toBe(0);
    setResources(engine, { food: 10000 });
    bldg.purchase('farm', () => true, () => {});
    expect(bldg.getLevel('farm')).toBe(1);
    bldg.purchase('farm', () => true, () => {});
    expect(bldg.getLevel('farm')).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════
// 4. 官员系统 (5 tests)
// ═══════════════════════════════════════════════════════════════

describe('官员系统', () => {
  it('官员列表可获取（8 个官员）', () => {
    expect(OFFICIALS).toHaveLength(8);
    for (const o of OFFICIALS) {
      expect(o.id).toBeTruthy();
      expect(o.name).toBeTruthy();
    }
  });

  it('招募官员需要资源（recruitCost 存在且非零）', () => {
    for (const o of OFFICIALS) {
      expect(o.recruitCost).toBeDefined();
      const costs = Object.values(o.recruitCost);
      expect(costs.some(c => c > 0)).toBe(true);
    }
  });

  it('官员稀有度包含 uncommon/rare/epic/legendary', () => {
    const validRarities = ['uncommon', 'rare', 'epic', 'legendary'];
    for (const o of OFFICIALS) {
      expect(validRarities).toContain(o.rarity);
    }
    // Verify at least one of each rarity exists
    const rarities = new Set(OFFICIALS.map(o => o.rarity));
    expect(rarities.has('uncommon')).toBe(true);
    expect(rarities.has('rare')).toBe(true);
    expect(rarities.has('epic')).toBe(true);
    expect(rarities.has('legendary')).toBe(true);
  });

  it('官员属性（baseStats 包含 administration/military/culture）', () => {
    for (const o of OFFICIALS) {
      expect(o.baseStats).toBeDefined();
      expect(typeof o.baseStats.administration).toBe('number');
      expect(typeof o.baseStats.military).toBe('number');
      expect(typeof o.baseStats.culture).toBe('number');
      expect(o.baseStats.administration).toBeGreaterThan(0);
      expect(o.baseStats.culture).toBeGreaterThan(0);
    }
  });

  it('官员加成描述（bonus 字段非空）', () => {
    for (const o of OFFICIALS) {
      expect(o.bonus).toBeTruthy();
      expect(typeof o.bonus).toBe('string');
      expect(o.bonus.length).toBeGreaterThan(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 5. 资源系统 (5 tests)
// ═══════════════════════════════════════════════════════════════

describe('资源系统', () => {
  let engine: CivChinaEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('资源自动增长（建筑产出）', () => {
    const bldg = (engine as any).bldg;
    setResources(engine, { food: 10000 });
    bldg.purchase('farm', () => true, () => {}); // farm → Lv.1
    const before = engine.getResources().food;
    (engine as any).onUpdate(10000); // 10 seconds
    expect(engine.getResources().food).toBeGreaterThan(before);
  });

  it('点击产出资源（Space 键增加 food）', () => {
    const before = engine.getResources().food;
    engine.handleKeyDown(' ');
    expect(engine.getResources().food).toBe(before + CLICK_REWARD.food);
  });

  it('资源消耗（购买建筑扣除 food）', () => {
    setResources(engine, { food: 100 });
    const before = engine.getResources().food;
    (engine as any).buyBuilding(); // buy farm, cost 10 food
    expect(engine.getResources().food).toBeLessThan(before);
  });

  it('多种资源独立（silk_workshop 产出 silk，farm 产出 food）', () => {
    const bldg = (engine as any).bldg;
    setResources(engine, { food: 10000 });
    bldg.purchase('farm', () => true, () => {});
    bldg.purchase('silk_workshop', () => true, () => {});
    (engine as any).onUpdate(10000);
    const res = engine.getResources();
    expect(res.food).toBeGreaterThan(0);
    expect(res.silk).toBeGreaterThan(0);
  });

  it('资源格式化（formatNumber 处理大数）', () => {
    expect(engine.formatNumber(1000, 1)).toMatch(/K/);
    expect(engine.formatNumber(1000000, 1)).toMatch(/M/);
    expect(engine.formatNumber(1000000000, 1)).toMatch(/B/);
    expect(engine.formatNumber(1000000000000, 1)).toMatch(/T/);
  });
});

// ═══════════════════════════════════════════════════════════════
// 6. 朝代系统 (4 tests)
// ═══════════════════════════════════════════════════════════════

describe('朝代系统', () => {
  let engine: CivChinaEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('初始朝代为夏（xia）', () => {
    const stage = engine.getStageInfo();
    expect(stage).toBeDefined();
    expect(stage!.id).toBe('xia');
    expect(stage!.name).toBe('夏');
  });

  it('满足条件后朝代升级（shang 需要 food >= 500）', () => {
    setResources(engine, { food: 1000 });
    (engine as any).checkStage();
    const stage = engine.getStageInfo();
    expect(stage).toBeDefined();
    expect(stage!.id).toBe('shang');
  });

  it('朝代倍率影响产出（夏 = 1.0，商 = 1.2）', () => {
    const stages = (engine as any).stages;
    // xia multiplier = 1.0
    expect(stages.getMultiplier('production')).toBe(1.0);

    // Advance to shang
    setResources(engine, { food: 1000 });
    (engine as any).checkStage();
    expect(stages.getMultiplier('production')).toBe(1.2);
  });

  it('最终朝代为宋（song）', () => {
    const last = DYNASTIES[DYNASTIES.length - 1];
    expect(last.id).toBe('song');
    expect(last.name).toBe('宋');
    expect(last.productionMultiplier).toBe(3.0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 7. 科技系统 (4 tests)
// ═══════════════════════════════════════════════════════════════

describe('科技系统', () => {
  let engine: CivChinaEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('科技列表（9 项发明，3 个分支）', () => {
    expect(INVENTIONS).toHaveLength(9);
    const branches = new Set(INVENTIONS.map(t => t.branch));
    expect(branches.size).toBe(3);
    expect(branches.has('agriculture')).toBe(true);
    expect(branches.has('craft')).toBe(true);
    expect(branches.has('governance')).toBe(true);
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

  it('科技分支（agriculture/craft/governance 各 3 级）', () => {
    const agri = INVENTIONS.filter(t => t.branch === 'agriculture');
    const craft = INVENTIONS.filter(t => t.branch === 'craft');
    const gov = INVENTIONS.filter(t => t.branch === 'governance');
    expect(agri).toHaveLength(3);
    expect(craft).toHaveLength(3);
    expect(gov).toHaveLength(3);
    // Each branch has tier 1, 2, 3
    for (const branch of [agri, craft, gov]) {
      const tiers = branch.map(t => t.tier).sort();
      expect(tiers).toEqual([1, 2, 3]);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 8. 声望系统 (4 tests)
// ═══════════════════════════════════════════════════════════════

describe('声望系统', () => {
  let engine: CivChinaEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('声望转生（资源不足时不可转生）', () => {
    setResources(engine, { food: 100 });
    engine.doPrestige();
    expect(engine.getPrestigeState().count).toBe(0);
  });

  it('资源保留（转生后保留 10% 资源）', () => {
    setResources(engine, { food: 200000, silk: 0, culture: 0 });
    engine.doPrestige();
    const res = engine.getResources();
    // retention = 0.1, so food should be ~20000
    expect(res.food).toBeGreaterThan(0);
    expect(res.food).toBeLessThan(200000);
  });

  it('声望货币（转生后获得天命）', () => {
    setResources(engine, { food: 200000, silk: 0, culture: 0 });
    engine.doPrestige();
    const ps = engine.getPrestigeState();
    expect(ps.count).toBe(1);
    expect(ps.currency).toBeGreaterThan(0);
  });

  it('声望倍率（转生后 multiplier > 1）', () => {
    setResources(engine, { food: 200000, silk: 0, culture: 0 });
    engine.doPrestige();
    const ps = engine.getPrestigeState();
    expect(ps.multiplier).toBeGreaterThan(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// 9. 序列化 (3 tests)
// ═══════════════════════════════════════════════════════════════

describe('序列化', () => {
  let engine: CivChinaEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('serialize 返回有效状态', () => {
    const state = engine.serialize();
    expect(state).toBeDefined();
    expect(typeof state).toBe('object');
    expect(state.resources).toBeDefined();
    expect(state.buildings).toBeDefined();
    expect(state.currentStage).toBe('xia');
    expect(state.prestigeState).toBeDefined();
    expect(state.prestigeState.currency).toBe(0);
    expect(state.prestigeState.count).toBe(0);
  });

  it('deserialize 恢复状态', () => {
    setResources(engine, { food: 9999, silk: 8888, culture: 7777 });
    const bldg = (engine as any).bldg;
    bldg.purchase('farm', () => true, () => {});

    const state = engine.serialize();
    const engine2 = createEngine();
    engine2.deserialize(state);

    const res = engine2.getResources();
    expect(res.food).toBe(9999);
    expect(res.silk).toBe(8888);
    expect(res.culture).toBe(7777);
  });

  it('循环一致性（serialize → deserialize → serialize 一致）', () => {
    setResources(engine, { food: 5555, silk: 3333, culture: 1111 });
    const state = engine.serialize();

    const engine2 = createEngine();
    engine2.deserialize(state);
    const state2 = engine2.serialize();

    expect(state2.resources.food).toBe(state.resources.food);
    expect(state2.resources.silk).toBe(state.resources.silk);
    expect(state2.resources.culture).toBe(state.resources.culture);
    expect(state2.currentStage).toBe(state.currentStage);
  });
});

// ═══════════════════════════════════════════════════════════════
// 10. 渲染 (3 tests)
// ═══════════════════════════════════════════════════════════════

describe('渲染', () => {
  let engine: CivChinaEngine;

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

  it('不同面板渲染（tech/officials/prestige 均不报错）', () => {
    const canvas = (engine as any).canvas as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;

    const panels: Array<'tech' | 'officials' | 'prestige'> = ['tech', 'officials', 'prestige'];
    for (const panel of panels) {
      (engine as any).panel = panel;
      expect(() => {
        (engine as any).onRender(ctx, canvas.width, canvas.height);
      }).not.toThrow();
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 11. 输入处理
// ═══════════════════════════════════════════════════════════════

describe('输入处理', () => {
  let engine: CivChinaEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('handleKeyDown 不报错', () => {
    expect(() => engine.handleKeyDown('ArrowDown')).not.toThrow();
    expect(() => engine.handleKeyDown('ArrowUp')).not.toThrow();
    expect(() => engine.handleKeyDown('Enter')).not.toThrow();
    expect(() => engine.handleKeyDown('Escape')).not.toThrow();
  });

  it('Space 键触发点击（增加 food）', () => {
    const before = engine.getResources().food;
    engine.handleKeyDown(' ');
    expect(engine.getResources().food).toBe(before + CLICK_REWARD.food);
  });

  it('T 键切换科技面板', () => {
    engine.handleKeyDown('t');
    expect(engine.getActivePanel()).toBe('tech');
    engine.handleKeyDown('t');
    expect(engine.getActivePanel()).toBe('none');
  });

  it('U 键切换官员面板', () => {
    engine.handleKeyDown('u');
    expect(engine.getActivePanel()).toBe('officials');
    engine.handleKeyDown('u');
    expect(engine.getActivePanel()).toBe('none');
  });

  it('Escape 返回主面板', () => {
    engine.handleKeyDown('t');
    expect(engine.getActivePanel()).toBe('tech');
    engine.handleKeyDown('Escape');
    expect(engine.getActivePanel()).toBe('none');
  });

  it('ArrowDown/ArrowUp 导航建筑列表', () => {
    const bldg = (engine as any).bldg;
    setResources(engine, { food: 10000 });
    bldg.purchase('farm', () => true, () => {});
    bldg.purchase('silk_workshop', () => true, () => {});
    engine.handleKeyDown('ArrowDown');
    expect((engine as any).selIdx).toBe(1);
    engine.handleKeyDown('ArrowUp');
    expect((engine as any).selIdx).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 12. 边界情况
// ═══════════════════════════════════════════════════════════════

describe('边界情况', () => {
  let engine: CivChinaEngine;

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
      setResources(engine, { food: 200000, silk: 0, culture: 0 });
      engine.doPrestige();
    }
    expect(engine.getPrestigeState().count).toBe(3);
  });

  it('getResources 返回副本，修改不影响引擎内部', () => {
    const res = engine.getResources();
    res.food = 9999;
    expect(engine.getResources().food).toBe(50);
  });

  it('资源不会变为负数', () => {
    setResources(engine, { food: 5 });
    (engine as any).buyBuilding(); // farm costs 10, but only 5 food
    expect(engine.getResources().food).toBeGreaterThanOrEqual(0);
  });

  it('快速面板切换不报错', () => {
    expect(() => {
      engine.handleKeyDown('t');
      engine.handleKeyDown('u');
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
    expect(PRESTIGE_CONFIG.currencyName).toBe('天命');
    expect(PRESTIGE_CONFIG.base).toBe(10);
    expect(PRESTIGE_CONFIG.threshold).toBe(10000);
    expect(PRESTIGE_CONFIG.bonusMultiplier).toBe(0.15);
    expect(PRESTIGE_CONFIG.retention).toBe(0.1);
  });

  it('INITIALLY_UNLOCKED 包含 farm 和 silk_workshop', () => {
    expect(INITIALLY_UNLOCKED).toEqual(['farm', 'silk_workshop']);
  });

  it('CLICK_REWARD 为 { food: 1 }', () => {
    expect(CLICK_REWARD).toEqual({ food: 1 });
  });
});
