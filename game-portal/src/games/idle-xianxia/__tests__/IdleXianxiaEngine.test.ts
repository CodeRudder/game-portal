/**
 * 修仙放置 (Idle Xianxia) — v3.0 引擎测试套件
 *
 * 匹配 v3.0 统一子系统架构的公共 API。
 * 覆盖常量验证、引擎初始化、建筑系统、阶段系统(境界)、
 * 仙友系统、科技系统(功法)、声望系统(飞升转生)、
 * 资源系统、序列化、渲染和输入处理。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IdleXianxiaEngine, type IdleXianxiaSaveState } from '@/games/idle-xianxia/IdleXianxiaEngine';
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
} from '@/games/idle-xianxia/constants';

// ═══════════════════════════════════════════════════════════════
// 测试辅助
// ═══════════════════════════════════════════════════════════════

function createCanvas(): HTMLCanvasElement {
  return document.createElement('canvas');
}

function createEngine(): IdleXianxiaEngine {
  const engine = new IdleXianxiaEngine();
  const canvas = createCanvas();
  canvas.width = 480;
  canvas.height = 640;
  (engine as any).canvas = canvas;
  (engine as any).ctx = canvas.getContext('2d');
  (engine as any)._status = 'playing';
  (engine as any).onInit();
  return engine;
}

function createStartedEngine(): IdleXianxiaEngine {
  const engine = createEngine();
  engine.start();
  return engine;
}

/** 直接设置引擎内部资源（绕过正常游戏逻辑） */
function setResources(engine: IdleXianxiaEngine, resources: Record<string, number>): void {
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

  it('DYNASTIES 有 6 个境界', () => {
    expect(DYNASTIES).toHaveLength(6);
  });

  it('HEROES 有 8 个仙友', () => {
    expect(HEROES).toHaveLength(8);
  });

  it('INVENTIONS 有 9 项功法', () => {
    expect(INVENTIONS).toHaveLength(9);
  });

  it('RESOURCES 有 4 种资源', () => {
    expect(RESOURCES).toHaveLength(4);
    const ids = RESOURCES.map(r => r.id);
    expect(ids).toContain('qi');
    expect(ids).toContain('herb');
    expect(ids).toContain('pill');
    expect(ids).toContain('stone');
  });

  it('GAME_ID 是 "idle-xianxia"', () => {
    expect(GAME_ID).toBe('idle-xianxia');
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
    expect((engine as any)._gameId).toBe('idle-xianxia');
  });

  it('start 后状态为 playing', () => {
    const engine = createStartedEngine();
    expect(engine.status).toBe('playing');
  });

  it('pause 后状态为 paused', () => {
    const engine = createStartedEngine();
    engine.pause();
    expect(engine.status).toBe('paused');
  });

  it('初始资源为 qi=50, herb=0, pill=0, stone=0', () => {
    const engine = createEngine();
    const res = engine.getResources();
    expect(res.qi).toBe(50);
    expect(res.herb).toBe(0);
    expect(res.pill).toBe(0);
    expect(res.stone).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 3. 建筑系统 (8 tests)
// ═══════════════════════════════════════════════════════════════

describe('建筑系统', () => {
  let engine: IdleXianxiaEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('初始解锁 qi_pool', () => {
    const bldg = (engine as any).bldg;
    expect(bldg.isUnlocked('qi_pool')).toBe(true);
  });

  it('购买建筑成功（资源充足时）', () => {
    setResources(engine, { qi: 100 });
    (engine as any).buyBuilding(); // selIdx=0 → qi_pool, cost 10 qi
    const bldg = (engine as any).bldg;
    expect(bldg.getLevel('qi_pool')).toBe(1);
  });

  it('资源不足时购买失败', () => {
    setResources(engine, { qi: 0 });
    (engine as any).buyBuilding();
    const bldg = (engine as any).bldg;
    expect(bldg.getLevel('qi_pool')).toBe(0);
  });

  it('建筑升级后费用增加', () => {
    const bldg = (engine as any).bldg;
    setResources(engine, { qi: 100000 });
    // Get cost at Lv.0
    const cost0 = bldg.getCost('qi_pool');
    // Upgrade qi_pool several times (costMultiplier = 1.07)
    for (let i = 0; i < 5; i++) {
      bldg.purchase('qi_pool', () => true, () => {});
    }
    const cost5 = bldg.getCost('qi_pool');
    // After 5 upgrades, cost should be noticeably higher
    // 10 * 1.07^5 ≈ 14.03 → floor = 14 > 10
    expect(cost5.qi).toBeGreaterThan(cost0.qi);
  });

  it('建筑产出资源（qi_pool Lv.1 产出 qi）', () => {
    const bldg = (engine as any).bldg;
    setResources(engine, { qi: 10000 });
    bldg.purchase('qi_pool', () => true, () => {}); // qi_pool → Lv.1
    const before = engine.getResources().qi;
    (engine as any).onUpdate(10000); // 10 seconds
    const after = engine.getResources().qi;
    expect(after).toBeGreaterThan(before);
  });

  it('建筑解锁条件（qi_pool Lv.1 解锁 herb_garden）', () => {
    const bldg = (engine as any).bldg;
    expect(bldg.isUnlocked('herb_garden')).toBe(false);
    // Upgrade qi_pool 1 time
    bldg.purchase('qi_pool', () => true, () => {});
    (engine as any).checkUnlocks();
    expect(bldg.isUnlocked('herb_garden')).toBe(true);
  });

  it('获取建筑列表（初始解锁 1 个）', () => {
    const bldg = (engine as any).bldg;
    const unlocked = bldg.getUnlockedBuildings();
    expect(unlocked.length).toBeGreaterThanOrEqual(1);
    const ids = unlocked.map((b: any) => b.id);
    expect(ids).toContain('qi_pool');
  });

  it('建筑等级初始为 0，购买后增加', () => {
    const bldg = (engine as any).bldg;
    expect(bldg.getLevel('qi_pool')).toBe(0);
    setResources(engine, { qi: 10000 });
    bldg.purchase('qi_pool', () => true, () => {});
    expect(bldg.getLevel('qi_pool')).toBe(1);
    bldg.purchase('qi_pool', () => true, () => {});
    expect(bldg.getLevel('qi_pool')).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════
// 4. 阶段系统(境界) (5 tests)
// ═══════════════════════════════════════════════════════════════

describe('阶段系统', () => {
  let engine: IdleXianxiaEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('初始境界为炼气（qi_refining）', () => {
    const stage = engine.getStageInfo();
    expect(stage).toBeDefined();
    expect(stage!.id).toBe('qi_refining');
    expect(stage!.name).toBe('炼气');
  });

  it('满足条件后境界升级（foundation 需要 qi >= 500, herb >= 200）', () => {
    setResources(engine, { qi: 1000, herb: 500 });
    (engine as any).checkStage();
    const stage = engine.getStageInfo();
    expect(stage).toBeDefined();
    expect(stage!.id).toBe('foundation');
  });

  it('境界倍率影响产出（qi_refining = 1.0，foundation = 1.3）', () => {
    const stages = (engine as any).stages;
    // qi_refining multiplier = 1.0
    expect(stages.getMultiplier('production')).toBe(1.0);

    // Advance to foundation
    setResources(engine, { qi: 1000, herb: 500 });
    (engine as any).checkStage();
    expect(stages.getMultiplier('production')).toBe(1.3);
  });

  it('最终境界为飞升（ascension）', () => {
    const last = DYNASTIES[DYNASTIES.length - 1];
    expect(last.id).toBe('ascension');
    expect(last.name).toBe('飞升');
    expect(last.productionMultiplier).toBe(3.0);
  });

  it('资源不足时不会升级境界', () => {
    setResources(engine, { qi: 100 });
    (engine as any).checkStage();
    const stage = engine.getStageInfo();
    expect(stage!.id).toBe('qi_refining');
  });
});

// ═══════════════════════════════════════════════════════════════
// 5. 仙友系统 (5 tests)
// ═══════════════════════════════════════════════════════════════

describe('仙友系统', () => {
  it('仙友列表可获取（8 个仙友）', () => {
    expect(HEROES).toHaveLength(8);
    for (const h of HEROES) {
      expect(h.id).toBeTruthy();
      expect(h.name).toBeTruthy();
    }
  });

  it('招募仙友需要资源（recruitCost 存在且非零）', () => {
    for (const h of HEROES) {
      expect(h.recruitCost).toBeDefined();
      const costs = Object.values(h.recruitCost);
      expect(costs.some(c => c > 0)).toBe(true);
    }
  });

  it('仙友稀有度包含 rare/epic/legendary/mythic', () => {
    const validRarities = ['rare', 'epic', 'legendary', 'mythic'];
    for (const h of HEROES) {
      expect(validRarities).toContain(h.rarity);
    }
    // Verify at least one of each rarity exists
    const rarities = new Set(HEROES.map(h => h.rarity));
    expect(rarities.has('rare')).toBe(true);
    expect(rarities.has('epic')).toBe(true);
    expect(rarities.has('legendary')).toBe(true);
    expect(rarities.has('mythic')).toBe(true);
  });

  it('仙友属性（baseStats 包含 administration/military/culture）', () => {
    for (const h of HEROES) {
      expect(h.baseStats).toBeDefined();
      expect(typeof h.baseStats.administration).toBe('number');
      expect(typeof h.baseStats.military).toBe('number');
      expect(typeof h.baseStats.culture).toBe('number');
      expect(h.baseStats.administration).toBeGreaterThan(0);
      expect(h.baseStats.culture).toBeGreaterThan(0);
    }
  });

  it('仙友加成描述（bonus 字段非空）', () => {
    for (const h of HEROES) {
      expect(h.bonus).toBeTruthy();
      expect(typeof h.bonus).toBe('string');
      expect(h.bonus.length).toBeGreaterThan(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 6. 科技系统(功法) (5 tests)
// ═══════════════════════════════════════════════════════════════

describe('科技系统', () => {
  let engine: IdleXianxiaEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('科技列表（9 项功法，3 个分支）', () => {
    expect(INVENTIONS).toHaveLength(9);
    const branches = new Set(INVENTIONS.map(t => t.branch));
    expect(branches.size).toBe(3);
    expect(branches.has('cultivation')).toBe(true);
    expect(branches.has('alchemy')).toBe(true);
    expect(branches.has('formation')).toBe(true);
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

  it('科技分支（cultivation/alchemy/formation 各 3 级）', () => {
    const cult = INVENTIONS.filter(t => t.branch === 'cultivation');
    const alch = INVENTIONS.filter(t => t.branch === 'alchemy');
    const form = INVENTIONS.filter(t => t.branch === 'formation');
    expect(cult).toHaveLength(3);
    expect(alch).toHaveLength(3);
    expect(form).toHaveLength(3);
    // Each branch has tier 1, 2, 3
    for (const branch of [cult, alch, form]) {
      const tiers = branch.map(t => t.tier).sort();
      expect(tiers).toEqual([1, 2, 3]);
    }
  });

  it('科技系统可查询已研究状态', () => {
    const techs = (engine as any).techs;
    expect(techs.isResearched('qi_gathering')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// 7. 声望转生系统 (5 tests)
// ═══════════════════════════════════════════════════════════════

describe('声望转生系统', () => {
  let engine: IdleXianxiaEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('声望转生（资源不足时不可转生）', () => {
    setResources(engine, { qi: 100 });
    engine.doPrestige();
    expect(engine.getPrestigeState().count).toBe(0);
  });

  it('资源保留（转生后保留 8% 资源）', () => {
    setResources(engine, { qi: 200000, herb: 0, pill: 0, stone: 0 });
    engine.doPrestige();
    const res = engine.getResources();
    // retention = 0.08, so qi should be > 0 but < 200000
    expect(res.qi).toBeGreaterThan(0);
    expect(res.qi).toBeLessThan(200000);
  });

  it('声望货币（转生后获得道果）', () => {
    setResources(engine, { qi: 200000, herb: 0, pill: 0, stone: 0 });
    engine.doPrestige();
    const ps = engine.getPrestigeState();
    expect(ps.count).toBe(1);
    expect(ps.currency).toBeGreaterThan(0);
  });

  it('声望倍率（转生后 multiplier > 1）', () => {
    setResources(engine, { qi: 200000, herb: 0, pill: 0, stone: 0 });
    engine.doPrestige();
    const ps = engine.getPrestigeState();
    expect(ps.multiplier).toBeGreaterThan(1);
  });

  it('转生后重置建筑等级和境界', () => {
    setResources(engine, { qi: 200000, herb: 0, pill: 0, stone: 0 });
    engine.doPrestige();
    const stage = engine.getStageInfo();
    expect(stage!.id).toBe('qi_refining');
    const bldg = (engine as any).bldg;
    // After reset, only initially unlocked buildings remain
    expect(bldg.isUnlocked('qi_pool')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// 8. 资源系统 (5 tests)
// ═══════════════════════════════════════════════════════════════

describe('资源系统', () => {
  let engine: IdleXianxiaEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('资源自动增长（建筑产出）', () => {
    const bldg = (engine as any).bldg;
    setResources(engine, { qi: 10000 });
    bldg.purchase('qi_pool', () => true, () => {}); // qi_pool → Lv.1
    const before = engine.getResources().qi;
    (engine as any).onUpdate(10000); // 10 seconds
    expect(engine.getResources().qi).toBeGreaterThan(before);
  });

  it('点击产出资源（Space 键增加 qi）', () => {
    const before = engine.getResources().qi;
    engine.handleKeyDown(' ');
    expect(engine.getResources().qi).toBe(before + CLICK_REWARD.qi);
  });

  it('资源消耗（购买建筑扣除 qi）', () => {
    setResources(engine, { qi: 100 });
    const before = engine.getResources().qi;
    (engine as any).buyBuilding(); // buy qi_pool, cost 10 qi
    expect(engine.getResources().qi).toBeLessThan(before);
  });

  it('多种资源独立（herb_garden 产出 herb，qi_pool 产出 qi）', () => {
    const bldg = (engine as any).bldg;
    setResources(engine, { qi: 10000 });
    bldg.purchase('qi_pool', () => true, () => {});
    // herb_garden requires qi_pool Lv.1 → unlock it
    bldg.forceUnlock('herb_garden');
    bldg.purchase('herb_garden', () => true, () => {});
    (engine as any).onUpdate(10000);
    const res = engine.getResources();
    expect(res.qi).toBeGreaterThan(0);
    expect(res.herb).toBeGreaterThan(0);
  });

  it('资源格式化（formatNumber 处理大数）', () => {
    expect(engine.formatNumber(1000, 1)).toMatch(/K/);
    expect(engine.formatNumber(1000000, 1)).toMatch(/M/);
    expect(engine.formatNumber(1000000000, 1)).toMatch(/B/);
    expect(engine.formatNumber(1000000000000, 1)).toMatch(/T/);
  });
});

// ═══════════════════════════════════════════════════════════════
// 9. 序列化 (4 tests)
// ═══════════════════════════════════════════════════════════════

describe('序列化', () => {
  let engine: IdleXianxiaEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('serialize 返回有效状态', () => {
    const state = engine.serialize();
    expect(state).toBeDefined();
    expect(typeof state).toBe('object');
    expect(state.resources).toBeDefined();
    expect(state.buildings).toBeDefined();
    expect(state.currentStage).toBe('qi_refining');
    expect(state.prestigeState).toBeDefined();
    expect(state.prestigeState.currency).toBe(0);
    expect(state.prestigeState.count).toBe(0);
  });

  it('deserialize 恢复状态', () => {
    setResources(engine, { qi: 9999, herb: 8888, pill: 7777 });
    const bldg = (engine as any).bldg;
    bldg.purchase('qi_pool', () => true, () => {});

    const state = engine.serialize();
    const engine2 = createEngine();
    engine2.deserialize(state);

    const res = engine2.getResources();
    expect(res.qi).toBe(9999);
    expect(res.herb).toBe(8888);
    expect(res.pill).toBe(7777);
  });

  it('循环一致性（serialize → deserialize → serialize 一致）', () => {
    setResources(engine, { qi: 5555, herb: 3333, pill: 1111 });
    const state = engine.serialize();

    const engine2 = createEngine();
    engine2.deserialize(state);
    const state2 = engine2.serialize();

    expect(state2.resources.qi).toBe(state.resources.qi);
    expect(state2.resources.herb).toBe(state.resources.herb);
    expect(state2.resources.pill).toBe(state.resources.pill);
    expect(state2.currentStage).toBe(state.currentStage);
  });

  it('序列化包含仙友和科技数据', () => {
    const state = engine.serialize();
    expect(state.heroes).toBeDefined();
    expect(state.researchedTechs).toBeDefined();
    expect(Array.isArray(state.researchedTechs)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// 10. 渲染 (4 tests)
// ═══════════════════════════════════════════════════════════════

describe('渲染', () => {
  let engine: IdleXianxiaEngine;

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

  it('update + render 组合不报错', () => {
    const canvas = (engine as any).canvas as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    expect(() => {
      (engine as any).onUpdate(1000);
      (engine as any).onRender(ctx, canvas.width, canvas.height);
    }).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════
// 11. 输入处理 (6 tests)
// ═══════════════════════════════════════════════════════════════

describe('输入处理', () => {
  let engine: IdleXianxiaEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('handleKeyDown 不报错', () => {
    expect(() => engine.handleKeyDown('ArrowDown')).not.toThrow();
    expect(() => engine.handleKeyDown('ArrowUp')).not.toThrow();
    expect(() => engine.handleKeyDown('Enter')).not.toThrow();
    expect(() => engine.handleKeyDown('Escape')).not.toThrow();
  });

  it('Space 键触发点击（增加 qi）', () => {
    const before = engine.getResources().qi;
    engine.handleKeyDown(' ');
    expect(engine.getResources().qi).toBe(before + CLICK_REWARD.qi);
  });

  it('T 键切换功法面板', () => {
    engine.handleKeyDown('t');
    expect(engine.getActivePanel()).toBe('tech');
    engine.handleKeyDown('t');
    expect(engine.getActivePanel()).toBe('none');
  });

  it('U 键切换仙友面板', () => {
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
    setResources(engine, { qi: 10000 });
    bldg.purchase('qi_pool', () => true, () => {});
    // Unlock herb_garden so there are 2 buildings in the list
    bldg.forceUnlock('herb_garden');
    bldg.purchase('herb_garden', () => true, () => {});
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
  let engine: IdleXianxiaEngine;

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
      setResources(engine, { qi: 200000, herb: 0, pill: 0, stone: 0 });
      engine.doPrestige();
    }
    expect(engine.getPrestigeState().count).toBe(3);
  });

  it('getResources 返回副本，修改不影响引擎内部', () => {
    const res = engine.getResources();
    res.qi = 9999;
    expect(engine.getResources().qi).toBe(50);
  });

  it('资源不会变为负数', () => {
    setResources(engine, { qi: 5 });
    (engine as any).buyBuilding(); // qi_pool costs 10, but only 5 qi
    expect(engine.getResources().qi).toBeGreaterThanOrEqual(0);
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
    expect(RARITY_COLORS).toHaveProperty('rare');
    expect(RARITY_COLORS).toHaveProperty('epic');
    expect(RARITY_COLORS).toHaveProperty('legendary');
    expect(RARITY_COLORS).toHaveProperty('mythic');
  });

  it('PRESTIGE_CONFIG 参数正确', () => {
    expect(PRESTIGE_CONFIG.currencyName).toBe('道果');
    expect(PRESTIGE_CONFIG.base).toBe(10);
    expect(PRESTIGE_CONFIG.threshold).toBe(15000);
    expect(PRESTIGE_CONFIG.bonusMultiplier).toBe(0.15);
    expect(PRESTIGE_CONFIG.retention).toBe(0.08);
  });

  it('INITIALLY_UNLOCKED 包含 qi_pool', () => {
    expect(INITIALLY_UNLOCKED).toEqual(['qi_pool']);
  });

  it('CLICK_REWARD 为 { qi: 1 }', () => {
    expect(CLICK_REWARD).toEqual({ qi: 1 });
  });
});

// ═══════════════════════════════════════════════════════════════
// 14. 资源类型验证 (4 tests)
// ═══════════════════════════════════════════════════════════════

describe('资源类型验证', () => {
  it('RESOURCES 包含 qi（灵气）', () => {
    const qi = RESOURCES.find(r => r.id === 'qi');
    expect(qi).toBeDefined();
    expect(qi!.name).toBe('灵气');
  });

  it('RESOURCES 包含 herb（仙草）', () => {
    const herb = RESOURCES.find(r => r.id === 'herb');
    expect(herb).toBeDefined();
    expect(herb!.name).toBe('仙草');
  });

  it('RESOURCES 包含 pill（丹药）', () => {
    const pill = RESOURCES.find(r => r.id === 'pill');
    expect(pill).toBeDefined();
    expect(pill!.name).toBe('丹药');
  });

  it('RESOURCES 包含 stone（灵石）', () => {
    const stone = RESOURCES.find(r => r.id === 'stone');
    expect(stone).toBeDefined();
    expect(stone!.name).toBe('灵石');
  });
});
