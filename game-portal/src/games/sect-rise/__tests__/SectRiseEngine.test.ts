/**
 * 门派崛起 (Sect Rise) — v3.0 引擎测试套件
 *
 * 完全重写，匹配 v3.0 统一子系统架构的公共 API。
 * 覆盖常量验证、引擎初始化、建筑系统、弟子系统、资源系统、
 * 阶段系统(门派阶段)、科技系统(武学)、声望系统、存档系统、渲染和输入处理。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SectRiseEngine, type SectRiseSaveState } from '@/games/sect-rise/SectRiseEngine';
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
} from '@/games/sect-rise/constants';

// ═══════════════════════════════════════════════════════════════
// 测试辅助
// ═══════════════════════════════════════════════════════════════

function createCanvas(): HTMLCanvasElement {
  return document.createElement('canvas');
}

function createEngine(): SectRiseEngine {
  const engine = new SectRiseEngine();
  const canvas = createCanvas();
  canvas.width = 480;
  canvas.height = 640;
  (engine as any).canvas = canvas;
  (engine as any).ctx = canvas.getContext('2d');
  (engine as any)._status = 'playing';
  (engine as any).onInit();
  return engine;
}

function createStartedEngine(): SectRiseEngine {
  const engine = createEngine();
  engine.start();
  return engine;
}

/** 直接设置引擎内部资源（绕过正常游戏逻辑） */
function setResources(engine: SectRiseEngine, resources: Record<string, number>): void {
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

  it('DYNASTIES 有 6 个门派阶段', () => {
    expect(DYNASTIES).toHaveLength(6);
  });

  it('HEROES 有 8 个弟子', () => {
    expect(HEROES).toHaveLength(8);
  });

  it('INVENTIONS 有 9 项武学', () => {
    expect(INVENTIONS).toHaveLength(9);
  });

  it('RESOURCES 有 3 种基础资源（+声望）', () => {
    expect(RESOURCES).toHaveLength(4);
    const ids = RESOURCES.map(r => r.id);
    expect(ids).toContain('wood');
    expect(ids).toContain('iron');
    expect(ids).toContain('stone');
    expect(ids).toContain('reputation');
  });

  it('GAME_ID 是 "sect-rise"', () => {
    expect(GAME_ID).toBe('sect-rise');
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
    expect((engine as any)._gameId).toBe('sect-rise');
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

  it('初始资源为 wood=50, iron=0, stone=0', () => {
    const engine = createEngine();
    const res = engine.getResources();
    expect(res.wood).toBe(50);
    expect(res.iron).toBe(0);
    expect(res.stone).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 3. 建筑系统 (8 tests)
// ═══════════════════════════════════════════════════════════════

describe('建筑系统', () => {
  let engine: SectRiseEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('初始解锁 lumber（灵木场）', () => {
    const bldg = (engine as any).bldg;
    expect(bldg.isUnlocked('lumber')).toBe(true);
  });

  it('购买建筑成功（资源充足时）', () => {
    setResources(engine, { wood: 100 });
    (engine as any).buyBuilding(); // selIdx=0 → lumber, cost 10 wood
    const bldg = (engine as any).bldg;
    expect(bldg.getLevel('lumber')).toBe(1);
  });

  it('资源不足时购买失败', () => {
    setResources(engine, { wood: 0 });
    (engine as any).buyBuilding();
    const bldg = (engine as any).bldg;
    expect(bldg.getLevel('lumber')).toBe(0);
  });

  it('建筑升级后费用增加', () => {
    const bldg = (engine as any).bldg;
    setResources(engine, { wood: 100000 });
    const cost0 = bldg.getCost('lumber');
    for (let i = 0; i < 5; i++) {
      bldg.purchase('lumber', () => true, () => {});
    }
    const cost5 = bldg.getCost('lumber');
    // 10 * 1.07^5 ≈ 14.03 → floor = 14 > 10
    expect(cost5.wood).toBeGreaterThan(cost0.wood);
  });

  it('建筑产出资源（lumber Lv.1 产出 wood）', () => {
    const bldg = (engine as any).bldg;
    setResources(engine, { wood: 10000 });
    bldg.purchase('lumber', () => true, () => {});
    const before = engine.getResources().wood;
    (engine as any).onUpdate(10000); // 10 seconds
    const after = engine.getResources().wood;
    expect(after).toBeGreaterThan(before);
  });

  it('建筑解锁条件（lumber Lv.1 解锁 mine）', () => {
    const bldg = (engine as any).bldg;
    expect(bldg.isUnlocked('mine')).toBe(false);
    bldg.purchase('lumber', () => true, () => {});
    (engine as any).checkUnlocks();
    expect(bldg.isUnlocked('mine')).toBe(true);
  });

  it('获取建筑列表（初始解锁 1 个）', () => {
    const bldg = (engine as any).bldg;
    const unlocked = bldg.getUnlockedBuildings();
    expect(unlocked.length).toBeGreaterThanOrEqual(1);
    const ids = unlocked.map((b: any) => b.id);
    expect(ids).toContain('lumber');
  });

  it('建筑等级初始为 0，购买后增加', () => {
    const bldg = (engine as any).bldg;
    expect(bldg.getLevel('lumber')).toBe(0);
    setResources(engine, { wood: 10000 });
    bldg.purchase('lumber', () => true, () => {});
    expect(bldg.getLevel('lumber')).toBe(1);
    bldg.purchase('lumber', () => true, () => {});
    expect(bldg.getLevel('lumber')).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════
// 4. 弟子系统 (6 tests)
// ═══════════════════════════════════════════════════════════════

describe('弟子系统', () => {
  it('弟子列表可获取（8 个弟子）', () => {
    expect(HEROES).toHaveLength(8);
    for (const h of HEROES) {
      expect(h.id).toBeTruthy();
      expect(h.name).toBeTruthy();
    }
  });

  it('招募费用（recruitCost 存在且非零）', () => {
    for (const h of HEROES) {
      expect(h.recruitCost).toBeDefined();
      const costs = Object.values(h.recruitCost);
      expect(costs.some(c => c > 0)).toBe(true);
    }
  });

  it('稀有度包含 uncommon/rare/epic/legendary', () => {
    const validRarities = ['uncommon', 'rare', 'epic', 'legendary'];
    for (const h of HEROES) {
      expect(validRarities).toContain(h.rarity);
    }
    const rarities = new Set(HEROES.map(h => h.rarity));
    expect(rarities.has('uncommon')).toBe(true);
    expect(rarities.has('rare')).toBe(true);
    expect(rarities.has('epic')).toBe(true);
    expect(rarities.has('legendary')).toBe(true);
  });

  it('弟子属性（baseStats 包含 martial/internal/charisma）', () => {
    for (const h of HEROES) {
      expect(h.baseStats).toBeDefined();
      expect(typeof h.baseStats.martial).toBe('number');
      expect(typeof h.baseStats.internal).toBe('number');
      expect(typeof h.baseStats.charisma).toBe('number');
      expect(h.baseStats.martial).toBeGreaterThan(0);
      expect(h.baseStats.internal).toBeGreaterThan(0);
      expect(h.baseStats.charisma).toBeGreaterThan(0);
    }
  });

  it('弟子加成描述（bonus 字段非空）', () => {
    for (const h of HEROES) {
      expect(h.bonus).toBeTruthy();
      expect(typeof h.bonus).toBe('string');
      expect(h.bonus.length).toBeGreaterThan(0);
    }
  });

  it('弟子成长率（growthRates 与稀有度相关）', () => {
    for (const h of HEROES) {
      expect(h.growthRates).toBeDefined();
      expect(typeof h.growthRates.martial).toBe('number');
      expect(typeof h.growthRates.internal).toBe('number');
      expect(typeof h.growthRates.charisma).toBe('number');
      expect(h.growthRates.martial).toBeGreaterThan(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 5. 阶段系统 (4 tests)
// ═══════════════════════════════════════════════════════════════

describe('阶段系统', () => {
  let engine: SectRiseEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('初始阶段为 small_sect（小门派）', () => {
    const stage = engine.getStageInfo();
    expect(stage).toBeDefined();
    expect(stage!.id).toBe('small_sect');
    expect(stage!.name).toBe('小门派');
  });

  it('满足条件后阶段升级（growing 需要 wood>=500, iron>=200）', () => {
    setResources(engine, { wood: 1000, iron: 500 });
    (engine as any).checkStage();
    const stage = engine.getStageInfo();
    expect(stage).toBeDefined();
    expect(stage!.id).toBe('growing');
  });

  it('阶段倍率影响产出（small_sect = 1.0，growing = 1.3）', () => {
    const stages = (engine as any).stages;
    expect(stages.getMultiplier('production')).toBe(1.0);

    setResources(engine, { wood: 1000, iron: 500 });
    (engine as any).checkStage();
    expect(stages.getMultiplier('production')).toBe(1.3);
  });

  it('最终阶段为 founder（开宗立派）', () => {
    const last = DYNASTIES[DYNASTIES.length - 1];
    expect(last.id).toBe('founder');
    expect(last.name).toBe('开宗立派');
    expect(last.productionMultiplier).toBe(3.0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 6. 科技系统 (4 tests)
// ═══════════════════════════════════════════════════════════════

describe('科技系统', () => {
  let engine: SectRiseEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('科技列表（9 项武学，3 个分支）', () => {
    expect(INVENTIONS).toHaveLength(9);
    const branches = new Set(INVENTIONS.map(t => t.branch));
    expect(branches.size).toBe(3);
    expect(branches.has('martial')).toBe(true);
    expect(branches.has('crafting')).toBe(true);
    expect(branches.has('management')).toBe(true);
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

  it('科技分支（martial/crafting/management 各 3 级）', () => {
    const martial = INVENTIONS.filter(t => t.branch === 'martial');
    const crafting = INVENTIONS.filter(t => t.branch === 'crafting');
    const management = INVENTIONS.filter(t => t.branch === 'management');
    expect(martial).toHaveLength(3);
    expect(crafting).toHaveLength(3);
    expect(management).toHaveLength(3);
    for (const branch of [martial, crafting, management]) {
      const tiers = branch.map(t => t.tier).sort();
      expect(tiers).toEqual([1, 2, 3]);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 7. 声望系统 (4 tests)
// ═══════════════════════════════════════════════════════════════

describe('声望系统', () => {
  let engine: SectRiseEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('声望转生（资源不足时不可转生）', () => {
    setResources(engine, { wood: 100 });
    engine.doPrestige();
    expect(engine.getPrestigeState().count).toBe(0);
  });

  it('资源保留（转生后保留 10% 资源）', () => {
    setResources(engine, { wood: 200000, iron: 0, stone: 0 });
    engine.doPrestige();
    const res = engine.getResources();
    // retention = 0.1, so wood should be ~20000
    expect(res.wood).toBeGreaterThan(0);
    expect(res.wood).toBeLessThan(200000);
  });

  it('声望货币（转生后获得声望）', () => {
    setResources(engine, { wood: 200000, iron: 0, stone: 0 });
    engine.doPrestige();
    const ps = engine.getPrestigeState();
    expect(ps.count).toBe(1);
    expect(ps.currency).toBeGreaterThan(0);
  });

  it('声望倍率（转生后 multiplier > 1）', () => {
    setResources(engine, { wood: 200000, iron: 0, stone: 0 });
    engine.doPrestige();
    const ps = engine.getPrestigeState();
    expect(ps.multiplier).toBeGreaterThan(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// 8. 资源系统 (5 tests)
// ═══════════════════════════════════════════════════════════════

describe('资源系统', () => {
  let engine: SectRiseEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('资源自动增长（建筑产出）', () => {
    const bldg = (engine as any).bldg;
    setResources(engine, { wood: 10000 });
    bldg.purchase('lumber', () => true, () => {}); // lumber → Lv.1
    const before = engine.getResources().wood;
    (engine as any).onUpdate(10000); // 10 seconds
    expect(engine.getResources().wood).toBeGreaterThan(before);
  });

  it('点击产出资源（Space 键增加 wood）', () => {
    const before = engine.getResources().wood;
    engine.handleKeyDown(' ');
    expect(engine.getResources().wood).toBe(before + CLICK_REWARD.wood);
  });

  it('资源消耗（购买建筑扣除 wood）', () => {
    setResources(engine, { wood: 100 });
    const before = engine.getResources().wood;
    (engine as any).buyBuilding(); // buy lumber, cost 10 wood
    expect(engine.getResources().wood).toBeLessThan(before);
  });

  it('多种资源独立（不同建筑产出不同资源）', () => {
    const bldg = (engine as any).bldg;
    setResources(engine, { wood: 100000, iron: 100000 });
    bldg.purchase('lumber', () => true, () => {}); // wood
    bldg.purchase('mine', () => true, () => {});   // iron
    (engine as any).onUpdate(10000);
    const res = engine.getResources();
    expect(res.wood).toBeGreaterThan(0);
    expect(res.iron).toBeGreaterThan(0);
  });

  it('资源格式化（formatNumber 处理大数）', () => {
    expect(engine.formatNumber(1000, 1)).toMatch(/K/);
    expect(engine.formatNumber(1000000, 1)).toMatch(/M/);
    expect(engine.formatNumber(1000000000, 1)).toMatch(/B/);
    expect(engine.formatNumber(1000000000000, 1)).toMatch(/T/);
  });
});

// ═══════════════════════════════════════════════════════════════
// 9. 序列化 (3 tests)
// ═══════════════════════════════════════════════════════════════

describe('序列化', () => {
  let engine: SectRiseEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('serialize 返回有效状态', () => {
    const state = engine.serialize();
    expect(state).toBeDefined();
    expect(typeof state).toBe('object');
    expect(state.resources).toBeDefined();
    expect(state.buildings).toBeDefined();
    expect(state.currentStage).toBe('small_sect');
    expect(state.prestigeState).toBeDefined();
    expect(state.prestigeState.currency).toBe(0);
    expect(state.prestigeState.count).toBe(0);
  });

  it('deserialize 恢复状态', () => {
    setResources(engine, { wood: 9999, iron: 8888, stone: 7777 });
    const bldg = (engine as any).bldg;
    bldg.purchase('lumber', () => true, () => {});

    const state = engine.serialize();
    const engine2 = createEngine();
    engine2.deserialize(state);

    const res = engine2.getResources();
    expect(res.wood).toBe(9999);
    expect(res.iron).toBe(8888);
    expect(res.stone).toBe(7777);
  });

  it('循环一致性（serialize → deserialize → serialize 一致）', () => {
    setResources(engine, { wood: 5555, iron: 3333, stone: 1111 });
    const state = engine.serialize();

    const engine2 = createEngine();
    engine2.deserialize(state);
    const state2 = engine2.serialize();

    expect(state2.resources.wood).toBe(state.resources.wood);
    expect(state2.resources.iron).toBe(state.resources.iron);
    expect(state2.resources.stone).toBe(state.resources.stone);
    expect(state2.currentStage).toBe(state.currentStage);
  });
});

// ═══════════════════════════════════════════════════════════════
// 10. 渲染 (3 tests)
// ═══════════════════════════════════════════════════════════════

describe('渲染', () => {
  let engine: SectRiseEngine;

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
    const fillRectSpy = vi.spyOn(ctx, 'fillRect');
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
// 11. 输入处理 (6 tests)
// ═══════════════════════════════════════════════════════════════

describe('输入处理', () => {
  let engine: SectRiseEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('handleKeyDown 不报错', () => {
    expect(() => engine.handleKeyDown('ArrowDown')).not.toThrow();
    expect(() => engine.handleKeyDown('ArrowUp')).not.toThrow();
    expect(() => engine.handleKeyDown('Enter')).not.toThrow();
    expect(() => engine.handleKeyDown('Escape')).not.toThrow();
  });

  it('Space 键触发点击（增加 wood）', () => {
    const before = engine.getResources().wood;
    engine.handleKeyDown(' ');
    expect(engine.getResources().wood).toBe(before + CLICK_REWARD.wood);
  });

  it('T 键切换武学面板', () => {
    engine.handleKeyDown('t');
    expect(engine.getActivePanel()).toBe('tech');
    engine.handleKeyDown('t');
    expect(engine.getActivePanel()).toBe('none');
  });

  it('U 键切换弟子面板', () => {
    engine.handleKeyDown('u');
    expect(engine.getActivePanel()).toBe('heroes');
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
    setResources(engine, { wood: 10000 });
    bldg.purchase('lumber', () => true, () => {});
    // Unlock mine so we have 2 buildings
    (engine as any).checkUnlocks();
    engine.handleKeyDown('ArrowDown');
    expect((engine as any).selIdx).toBe(1);
    engine.handleKeyDown('ArrowUp');
    expect((engine as any).selIdx).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 12. 边界情况 (6 tests)
// ═══════════════════════════════════════════════════════════════

describe('边界情况', () => {
  let engine: SectRiseEngine;

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
      setResources(engine, { wood: 200000, iron: 0, stone: 0 });
      engine.doPrestige();
    }
    expect(engine.getPrestigeState().count).toBe(3);
  });

  it('getResources 返回副本，修改不影响引擎内部', () => {
    const res = engine.getResources();
    res.wood = 9999;
    expect(engine.getResources().wood).toBe(50);
  });

  it('资源不会变为负数', () => {
    setResources(engine, { wood: 5 });
    (engine as any).buyBuilding(); // lumber costs 10, but only 5 wood
    expect(engine.getResources().wood).toBeGreaterThanOrEqual(0);
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
// 13. 常量详细验证 (7 tests)
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
    expect(DYNASTIES[0].prerequisiteStageId).toBeNull();
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
    expect(PRESTIGE_CONFIG.currencyName).toBe('声望');
    expect(PRESTIGE_CONFIG.base).toBe(10);
    expect(PRESTIGE_CONFIG.threshold).toBe(12000);
    expect(PRESTIGE_CONFIG.bonusMultiplier).toBe(0.12);
    expect(PRESTIGE_CONFIG.retention).toBe(0.1);
  });

  it('INITIALLY_UNLOCKED 包含 lumber', () => {
    expect(INITIALLY_UNLOCKED).toEqual(['lumber']);
  });

  it('CLICK_REWARD 为 { wood: 1 }', () => {
    expect(CLICK_REWARD).toEqual({ wood: 1 });
  });
});
