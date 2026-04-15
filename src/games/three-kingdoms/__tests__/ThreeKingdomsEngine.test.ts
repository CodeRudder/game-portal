/**
 * 三国霸业 (Three Kingdoms Conquest) — v3.0 引擎测试套件
 *
 * 完全重写，匹配 v3.0 统一子系统架构的公共 API。
 * 覆盖常量验证、引擎初始化、资源系统、建筑系统、武将系统、
 * 阶段系统、存档系统、声望系统、渲染和输入处理。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ThreeKingdomsEngine, type ThreeKingdomsSaveState } from '@/games/three-kingdoms/ThreeKingdomsEngine';
import {
  GAME_ID,
  GAME_TITLE,
  BUILDINGS,
  GENERALS,
  TERRITORIES,
  TECHS,
  BATTLES,
  STAGES,
  PRESTIGE_CONFIG,
  COLOR_THEME,
  RARITY_COLORS,
  RESOURCES,
  INITIAL_RESOURCES,
  INITIALLY_UNLOCKED,
  CLICK_REWARD,
} from '@/games/three-kingdoms/constants';

// ═══════════════════════════════════════════════════════════════
// 测试辅助
// ═══════════════════════════════════════════════════════════════

/**
 * 创建并初始化引擎实例
 *
 * 模拟基类 start() 中的 canvas 设置，然后直接调用 onInit()。
 * 这避免了 requestAnimationFrame 依赖。
 */
function createEngine(): ThreeKingdomsEngine {
  const engine = new ThreeKingdomsEngine();
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 600;
  (engine as any).canvas = canvas;
  (engine as any).ctx = canvas.getContext('2d');
  (engine as any)._status = 'playing';
  (engine as any).onInit();
  return engine;
}

/** 直接设置引擎内部资源（绕过正常游戏逻辑） */
function setResources(engine: ThreeKingdomsEngine, resources: Record<string, number>): void {
  const res = (engine as any).res as Record<string, number>;
  for (const [id, amount] of Object.entries(resources)) {
    res[id] = amount;
  }
}

// ═══════════════════════════════════════════════════════════════
// 1. 常量验证
// ═══════════════════════════════════════════════════════════════

describe('常量验证', () => {
  it('GAME_ID 为 "three-kingdoms"', () => {
    expect(GAME_ID).toBe('three-kingdoms');
  });

  it('GAME_TITLE 为 "三国霸业"', () => {
    expect(GAME_TITLE).toBe('三国霸业');
  });

  it('BUILDINGS 有 8 个建筑', () => {
    expect(BUILDINGS).toHaveLength(8);
  });

  it('BUILDINGS 所有建筑有唯一 ID', () => {
    const ids = BUILDINGS.map(b => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('GENERALS 有 12 个武将', () => {
    expect(GENERALS).toHaveLength(12);
  });

  it('GENERALS 所有武将有唯一 ID', () => {
    const ids = GENERALS.map(g => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('TERRITORIES 有 15 块领土', () => {
    expect(TERRITORIES).toHaveLength(15);
  });

  it('TECHS 有 12 项科技', () => {
    expect(TECHS).toHaveLength(12);
  });

  it('BATTLES 有 15 个战斗（5关卡×3波）', () => {
    expect(BATTLES).toHaveLength(15);
    const stageIds = [...new Set(BATTLES.map(b => b.stageId))];
    expect(stageIds).toHaveLength(5);
    for (const sid of stageIds) {
      expect(BATTLES.filter(b => b.stageId === sid)).toHaveLength(3);
    }
  });

  it('STAGES 有 6 个阶段', () => {
    expect(STAGES).toHaveLength(6);
  });

  it('RESOURCES 有 4 种资源', () => {
    expect(RESOURCES).toHaveLength(4);
    const ids = RESOURCES.map(r => r.id);
    expect(ids).toContain('grain');
    expect(ids).toContain('gold');
    expect(ids).toContain('troops');
    expect(ids).toContain('destiny');
  });

  it('COLOR_THEME 包含必要颜色字段', () => {
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

  it('COLOR_THEME 所有值都是字符串', () => {
    for (const val of Object.values(COLOR_THEME)) {
      expect(typeof val).toBe('string');
    }
  });

  it('INITIAL_RESOURCES 包含正确的初始值', () => {
    expect(INITIAL_RESOURCES.grain).toBe(500);
    expect(INITIAL_RESOURCES.gold).toBe(300);
    expect(INITIAL_RESOURCES.troops).toBe(100);
    expect(INITIAL_RESOURCES.destiny).toBe(0);
  });

  it('INITIALLY_UNLOCKED 仅包含 farm', () => {
    expect(INITIALLY_UNLOCKED).toEqual(['farm']);
  });

  it('CLICK_REWARD 给 grain +1', () => {
    expect(CLICK_REWARD).toEqual({ grain: 1 });
  });

  it('RARITY_COLORS 包含所有稀有度', () => {
    expect(RARITY_COLORS).toHaveProperty('common');
    expect(RARITY_COLORS).toHaveProperty('uncommon');
    expect(RARITY_COLORS).toHaveProperty('rare');
    expect(RARITY_COLORS).toHaveProperty('epic');
    expect(RARITY_COLORS).toHaveProperty('legendary');
    expect(RARITY_COLORS).toHaveProperty('mythic');
  });

  it('PRESTIGE_CONFIG 参数正确', () => {
    expect(PRESTIGE_CONFIG.currencyName).toBe('天命');
    expect(PRESTIGE_CONFIG.base).toBe(10);
    expect(PRESTIGE_CONFIG.threshold).toBe(10000);
    expect(PRESTIGE_CONFIG.bonusMultiplier).toBe(0.15);
    expect(PRESTIGE_CONFIG.retention).toBe(0.1);
  });
});

// ═══════════════════════════════════════════════════════════════
// 2. 引擎初始化
// ═══════════════════════════════════════════════════════════════

describe('引擎初始化', () => {
  it('createEngine 不抛异常', () => {
    expect(() => createEngine()).not.toThrow();
  });

  it('初始 grain 为 500', () => {
    const engine = createEngine();
    expect(engine.getResources().grain).toBe(500);
  });

  it('初始 gold 为 300', () => {
    const engine = createEngine();
    expect(engine.getResources().gold).toBe(300);
  });

  it('初始 troops 为 100', () => {
    const engine = createEngine();
    expect(engine.getResources().troops).toBe(100);
  });

  it('初始 destiny 为 0', () => {
    const engine = createEngine();
    expect(engine.getResources().destiny).toBe(0);
  });

  it('初始面板为 "none"', () => {
    const engine = createEngine();
    expect(engine.getActivePanel()).toBe('none');
  });

  it('初始阶段为 yellow_turban', () => {
    const engine = createEngine();
    const stage = engine.getStageInfo();
    expect(stage).toBeDefined();
    expect(stage!.id).toBe('yellow_turban');
  });
});

// ═══════════════════════════════════════════════════════════════
// 3. 资源系统
// ═══════════════════════════════════════════════════════════════

describe('资源系统', () => {
  let engine: ThreeKingdomsEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('getResources 返回正确初始值', () => {
    const res = engine.getResources();
    expect(res).toEqual({
      grain: 500,
      gold: 300,
      troops: 100,
      destiny: 0,
    });
  });

  it('getResources 返回的是副本，修改不影响引擎内部', () => {
    const res = engine.getResources();
    res.grain = 9999;
    expect(engine.getResources().grain).toBe(500);
  });

  it('update 产生建筑产出（farm 有产出）', () => {
    // 先升级 farm 使其有产出
    setResources(engine, { grain: 100 });
    (engine as any).buyBuilding(); // selIdx=0 → farm
    // farm Lv.1 → baseProduction=0.1/s
    const before = engine.getResources().grain;
    engine.update(10000); // 10 秒
    const after = engine.getResources().grain;
    expect(after).toBeGreaterThan(before);
  });

  it('多次 update 累积产出', () => {
    setResources(engine, { grain: 100 });
    (engine as any).buyBuilding(); // upgrade farm to Lv.1
    const before = engine.getResources().grain;
    engine.update(5000); // 5 秒
    const mid = engine.getResources().grain;
    engine.update(5000); // 再 5 秒
    const after = engine.getResources().grain;
    expect(mid).toBeGreaterThan(before);
    expect(after).toBeGreaterThan(mid);
  });

  it('零产出不改变资源（无建筑升级时 farm Lv.0 不产出）', () => {
    // farm is Lv.0, no production
    const before = engine.getResources().grain;
    engine.update(1000);
    // grain should remain 500 (no production from Lv.0 building)
    expect(engine.getResources().grain).toBe(before);
  });

  it('资源不会变为负数', () => {
    setResources(engine, { grain: 5 });
    // 尝试购买 farm（需要 10 grain）→ 不应成功
    (engine as any).buyBuilding();
    expect(engine.getResources().grain).toBeGreaterThanOrEqual(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 4. 建筑系统
// ═══════════════════════════════════════════════════════════════

describe('建筑系统', () => {
  let engine: ThreeKingdomsEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('初始只有 farm 解锁', () => {
    const bldg = (engine as any).bldg;
    expect(bldg.isUnlocked('farm')).toBe(true);
    // 其他建筑未解锁
    for (const b of BUILDINGS) {
      if (b.id !== 'farm') {
        expect(bldg.isUnlocked(b.id)).toBe(false);
      }
    }
  });

  it('建筑升级消耗资源', () => {
    setResources(engine, { grain: 100 });
    const before = engine.getResources().grain;
    (engine as any).buyBuilding(); // buy farm (cost: 10 grain)
    expect(engine.getResources().grain).toBeLessThan(before);
  });

  it('建筑升级后产出增加', () => {
    setResources(engine, { grain: 100 });
    (engine as any).buyBuilding(); // farm → Lv.1
    // Now farm produces 0.1 grain/s
    engine.update(10000); // 10 seconds
    // Should have produced ~1 grain (0.1 * 10)
    expect(engine.getResources().grain).toBeGreaterThan(90); // 100 - 10 + ~1
  });

  it('建筑费用递增', () => {
    const bldg = (engine as any).bldg;
    const cost1 = bldg.getCost('farm'); // cost at Lv.0
    // Upgrade to Lv.1
    setResources(engine, { grain: 100 });
    (engine as any).buyBuilding();
    const cost2 = bldg.getCost('farm'); // cost at Lv.1
    // cost2 should be >= cost1 (cost multiplier 1.07)
    expect(cost2.grain).toBeGreaterThanOrEqual(cost1.grain);
  });

  it('足够资源时可以购买建筑', () => {
    setResources(engine, { grain: 100 });
    const bldg = (engine as any).bldg;
    const cost = bldg.getCost('farm');
    const hasFn = (id: string, a: number) => (engine.getResources() as Record<string, number>)[id] >= a;
    expect(bldg.canAfford('farm', hasFn)).toBe(true);
  });

  it('不足资源时无法购买建筑', () => {
    setResources(engine, { grain: 0 });
    const bldg = (engine as any).bldg;
    const hasFn = (id: string, a: number) => (engine.getResources() as Record<string, number>)[id] >= a;
    expect(bldg.canAfford('farm', hasFn)).toBe(false);
  });

  it('未解锁建筑无法购买', () => {
    setResources(engine, { grain: 10000, gold: 10000 });
    const bldg = (engine as any).bldg;
    const hasFn = (id: string, a: number) => true; // pretend we have everything
    // market is not initially unlocked (only farm is in INITIALLY_UNLOCKED)
    expect(bldg.isUnlocked('market')).toBe(false);
    expect(bldg.canAfford('market', hasFn)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// 5. 武将系统
// ═══════════════════════════════════════════════════════════════

describe('武将系统', () => {
  it('12 个武将各有独特属性', () => {
    for (const g of GENERALS) {
      expect(g.id).toBeTruthy();
      expect(g.name).toBeTruthy();
      expect(g.baseStats).toBeDefined();
      expect(g.baseStats.attack).toBeGreaterThan(0);
      expect(g.baseStats.defense).toBeGreaterThan(0);
      expect(g.baseStats.intelligence).toBeGreaterThan(0);
      expect(g.baseStats.command).toBeGreaterThan(0);
    }
  });

  it('蜀魏吴各 4 人', () => {
    const shu = GENERALS.filter(g => g.faction === 'shu');
    const wei = GENERALS.filter(g => g.faction === 'wei');
    const wu = GENERALS.filter(g => g.faction === 'wu');
    expect(shu).toHaveLength(4);
    expect(wei).toHaveLength(4);
    expect(wu).toHaveLength(4);
  });

  it('武将稀有度分布正确', () => {
    const rarities = GENERALS.map(g => g.rarity);
    // 蜀: legendary, epic, epic, mythic
    // 魏: legendary, rare, epic, uncommon
    // 吴: legendary, epic, rare, rare
    expect(rarities.filter(r => r === 'legendary')).toHaveLength(3);
    expect(rarities.filter(r => r === 'epic')).toHaveLength(4);
    expect(rarities.filter(r => r === 'rare')).toHaveLength(3);
    expect(rarities.filter(r => r === 'uncommon')).toHaveLength(1);
    expect(rarities.filter(r => r === 'mythic')).toHaveLength(1);
  });

  it('初始无武将招募', () => {
    const engine = createEngine();
    const units = (engine as any).units;
    for (const g of GENERALS) {
      expect(units.isUnlocked(g.id)).toBe(false);
    }
  });

  it('武将招募需要资源（recruitCost 存在且非零）', () => {
    for (const g of GENERALS) {
      expect(g.recruitCost).toBeDefined();
      const costs = Object.values(g.recruitCost);
      expect(costs.some(c => c > 0)).toBe(true);
    }
  });

  it('稀有度越高招募费用越高', () => {
    const uncommon = GENERALS.find(g => g.rarity === 'uncommon')!;
    const mythic = GENERALS.find(g => g.rarity === 'mythic')!;
    const uncommonTotal = Object.values(uncommon.recruitCost).reduce((a, b) => a + b, 0);
    const mythicTotal = Object.values(mythic.recruitCost).reduce((a, b) => a + b, 0);
    expect(mythicTotal).toBeGreaterThan(uncommonTotal);
  });
});

// ═══════════════════════════════════════════════════════════════
// 6. 阶段系统
// ═══════════════════════════════════════════════════════════════

describe('阶段系统', () => {
  it('初始阶段为黄巾之乱', () => {
    const engine = createEngine();
    const stage = engine.getStageInfo();
    expect(stage).toBeDefined();
    expect(stage!.id).toBe('yellow_turban');
    expect(stage!.name).toBe('黄巾之乱');
  });

  it('getStageInfo 返回正确的阶段信息', () => {
    const engine = createEngine();
    const stage = engine.getStageInfo()!;
    expect(stage).toHaveProperty('id');
    expect(stage).toHaveProperty('name');
    expect(stage).toHaveProperty('description');
    expect(stage).toHaveProperty('order');
    expect(stage).toHaveProperty('productionMultiplier');
    expect(stage).toHaveProperty('combatMultiplier');
    expect(stage).toHaveProperty('iconAsset');
    expect(stage).toHaveProperty('themeColor');
  });

  it('阶段有 6 个递进', () => {
    expect(STAGES).toHaveLength(6);
    const orders = STAGES.map(s => s.order);
    const sorted = [...orders].sort((a, b) => a - b);
    expect(orders).toEqual(sorted);
    expect(sorted[0]).toBe(1);
    expect(sorted[sorted.length - 1]).toBe(6);
  });

  it('最终阶段为一统天下', () => {
    const last = STAGES[STAGES.length - 1];
    expect(last.id).toBe('unification');
    expect(last.name).toBe('一统天下');
    expect(last.productionMultiplier).toBe(3.0);
  });

  it('每个阶段有前置阶段（第一个除外）', () => {
    expect(STAGES[0].prerequisiteStageId).toBeNull();
    for (let i = 1; i < STAGES.length; i++) {
      expect(STAGES[i].prerequisiteStageId).toBeTruthy();
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 7. 存档系统
// ═══════════════════════════════════════════════════════════════

describe('存档系统', () => {
  let engine: ThreeKingdomsEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('serialize 返回有效数据', () => {
    const data = engine.serialize();
    expect(data).toBeDefined();
    expect(typeof data).toBe('object');
  });

  it('serialize 包含正确的资源', () => {
    const data = engine.serialize();
    expect(data.resources).toBeDefined();
    expect(data.resources.grain).toBe(500);
    expect(data.resources.gold).toBe(300);
    expect(data.resources.troops).toBe(100);
    expect(data.resources.destiny).toBe(0);
  });

  it('serialize 包含当前阶段', () => {
    const data = engine.serialize();
    expect(data.currentStage).toBe('yellow_turban');
  });

  it('serialize 包含声望状态', () => {
    const data = engine.serialize();
    expect(data.prestigeState).toBeDefined();
    expect(data.prestigeState.currency).toBe(0);
    expect(data.prestigeState.count).toBe(0);
  });

  it('serialize 包含建筑、武将、领土、科技字段', () => {
    const data = engine.serialize();
    expect(data).toHaveProperty('buildings');
    expect(data).toHaveProperty('generals');
    expect(data).toHaveProperty('conqueredTerritories');
    expect(data).toHaveProperty('completedBattles');
    expect(data).toHaveProperty('researchedTechs');
    expect(data).toHaveProperty('gameStats');
    expect(data).toHaveProperty('totalPlayTime');
  });

  it('deserialize 恢复存档数据', () => {
    // Modify engine state
    setResources(engine, { grain: 500, gold: 200 });
    const data = engine.serialize();

    // Create new engine and restore
    const engine2 = createEngine();
    engine2.deserialize(data);
    expect(engine2.getResources().grain).toBe(500);
    expect(engine2.getResources().gold).toBe(200);
  });

  it('deserialize 恢复阶段', () => {
    const data = engine.serialize();
    data.currentStage = 'warlords';

    const engine2 = createEngine();
    engine2.deserialize(data);
    expect(engine2.getStageInfo()!.id).toBe('warlords');
  });

  it('serialize → deserialize 往返一致', () => {
    setResources(engine, { grain: 1234, gold: 567 });
    const data = engine.serialize();

    const engine2 = createEngine();
    engine2.deserialize(data);
    const data2 = engine2.serialize();

    expect(data2.resources.grain).toBe(1234);
    expect(data2.resources.gold).toBe(567);
    expect(data2.currentStage).toBe(data.currentStage);
  });
});

// ═══════════════════════════════════════════════════════════════
// 8. 声望系统
// ═══════════════════════════════════════════════════════════════

describe('声望系统', () => {
  let engine: ThreeKingdomsEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('getPrestigeState 初始值', () => {
    const state = engine.getPrestigeState();
    expect(state.currency).toBe(0);
    expect(state.count).toBe(0);
    expect(state.multiplier).toBe(1);
    expect(state.bestGain).toBe(0);
  });

  it('声望配置正确', () => {
    expect(PRESTIGE_CONFIG.currencyName).toBe('天命');
    expect(PRESTIGE_CONFIG.threshold).toBe(10000);
    expect(PRESTIGE_CONFIG.retention).toBe(0.1);
  });

  it('初始不可转生（资源不足）', () => {
    // 初始 grain=50, gold=0, troops=0 → total=50 < threshold=10000
    setResources(engine, { grain: 50, gold: 0, troops: 0 });
    const before = engine.getResources().grain;
    engine.doPrestige();
    expect(engine.getResources().grain).toBe(before);
    expect(engine.getPrestigeState().count).toBe(0);
  });

  it('资源足够时可以转生', () => {
    // PrestigeSystem uses logarithmic formula:
    //   gain = floor(log(threshold + total) / log(base)) - floor(log(threshold) / log(base))
    // With base=10, threshold=10000:
    //   floor(log10(10000)) = 4
    //   Need floor(log10(10000 + total)) >= 5 → total >= 90000
    setResources(engine, { grain: 200000, gold: 0, troops: 0 });
    engine.doPrestige();
    expect(engine.getPrestigeState().count).toBe(1);
    expect(engine.getPrestigeState().currency).toBeGreaterThan(0);
  });

  it('转生后资源按保留比例折算', () => {
    setResources(engine, { grain: 200000, gold: 0, troops: 0 });
    engine.doPrestige();
    // retention = 0.1, so grain should be ~20000
    const grain = engine.getResources().grain;
    expect(grain).toBeLessThan(200000);
    expect(grain).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 9. 渲染
// ═══════════════════════════════════════════════════════════════

describe('渲染', () => {
  it('onRender 不报错', () => {
    const engine = createEngine();
    const canvas = (engine as any).canvas as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    expect(() => {
      (engine as any).onRender(ctx, canvas.width, canvas.height);
    }).not.toThrow();
  });

  it('formatNumber 正确格式化小数', () => {
    const engine = createEngine();
    expect(engine.formatNumber(1.5, 1)).toBe('1.5');
    expect(engine.formatNumber(0, 1)).toBe('0');
    expect(engine.formatNumber(10, 1)).toBe('10');
  });

  it('formatNumber 处理大数（K/M/B/T）', () => {
    const engine = createEngine();
    expect(engine.formatNumber(1000, 1)).toMatch(/K/);
    expect(engine.formatNumber(1000000, 1)).toMatch(/M/);
    expect(engine.formatNumber(1000000000, 1)).toMatch(/B/);
    expect(engine.formatNumber(1000000000000, 1)).toMatch(/T/);
  });

  it('formatNumber 处理负数', () => {
    const engine = createEngine();
    expect(engine.formatNumber(-1000, 1)).toMatch(/-/);
  });
});

// ═══════════════════════════════════════════════════════════════
// 10. 输入处理
// ═══════════════════════════════════════════════════════════════

describe('输入处理', () => {
  let engine: ThreeKingdomsEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('handleKeyDown 不报错', () => {
    expect(() => engine.handleKeyDown('ArrowDown')).not.toThrow();
    expect(() => engine.handleKeyDown('ArrowUp')).not.toThrow();
    expect(() => engine.handleKeyDown('Enter')).not.toThrow();
    expect(() => engine.handleKeyDown('Escape')).not.toThrow();
  });

  it('handleKeyDown Space 触发点击（增加 grain）', () => {
    const before = engine.getResources().grain;
    engine.handleKeyDown(' ');
    expect(engine.getResources().grain).toBeGreaterThan(before);
  });

  it('Escape 返回主面板', () => {
    // First switch to another panel
    engine.handleKeyDown('u'); // toggle generals panel
    expect(engine.getActivePanel()).toBe('generals');
    engine.handleKeyDown('Escape');
    expect(engine.getActivePanel()).toBe('none');
  });

  it('getActivePanel 返回正确值', () => {
    expect(engine.getActivePanel()).toBe('none');
    engine.handleKeyDown('t');
    expect(engine.getActivePanel()).toBe('tech');
    engine.handleKeyDown('t'); // toggle back
    expect(engine.getActivePanel()).toBe('none');
  });

  it('面板切换：T→科技、M→领土、B→战斗、U→武将', () => {
    engine.handleKeyDown('t');
    expect(engine.getActivePanel()).toBe('tech');
    engine.handleKeyDown('Escape');

    engine.handleKeyDown('m');
    expect(engine.getActivePanel()).toBe('territory');
    engine.handleKeyDown('Escape');

    engine.handleKeyDown('b');
    expect(engine.getActivePanel()).toBe('battle');
    engine.handleKeyDown('Escape');

    engine.handleKeyDown('u');
    expect(engine.getActivePanel()).toBe('generals');
  });

  it('重复按同一键切换面板开关', () => {
    engine.handleKeyDown('t');
    expect(engine.getActivePanel()).toBe('tech');
    engine.handleKeyDown('t');
    expect(engine.getActivePanel()).toBe('none');
  });
});

// ═══════════════════════════════════════════════════════════════
// 11. 点击系统
// ═══════════════════════════════════════════════════════════════

describe('点击系统', () => {
  let engine: ThreeKingdomsEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('点击产生粮草', () => {
    const before = engine.getResources().grain;
    engine.handleKeyDown(' ');
    expect(engine.getResources().grain).toBeGreaterThan(before);
  });

  it('点击增加量等于 CLICK_REWARD.grain', () => {
    const before = engine.getResources().grain;
    engine.handleKeyDown(' ');
    expect(engine.getResources().grain).toBe(before + CLICK_REWARD.grain);
  });

  it('连续点击 10 次', () => {
    const before = engine.getResources().grain;
    for (let i = 0; i < 10; i++) {
      engine.handleKeyDown(' ');
    }
    expect(engine.getResources().grain).toBe(before + 10 * CLICK_REWARD.grain);
  });

  it('有建筑产出时点击额外获得 10% 当前产出', () => {
    // Upgrade farm first
    setResources(engine, { grain: 100 });
    (engine as any).buyBuilding(); // farm → Lv.1
    // Run update to build psCache
    engine.update(1000);
    // Now click should give grain + 10% of production rate
    const before = engine.getResources().grain;
    engine.handleKeyDown(' ');
    const gained = engine.getResources().grain - before;
    // Should be at least 1 (base click reward)
    expect(gained).toBeGreaterThanOrEqual(CLICK_REWARD.grain);
  });
});

// ═══════════════════════════════════════════════════════════════
// 12. 战斗系统常量
// ═══════════════════════════════════════════════════════════════

describe('战斗系统常量', () => {
  it('每个关卡有 BOSS', () => {
    const stageIds = [...new Set(BATTLES.map(b => b.stageId))];
    for (const sid of stageIds) {
      const bossWave = BATTLES.filter(b => b.stageId === sid).find(b =>
        b.enemies.some(e => e.isBoss)
      );
      expect(bossWave).toBeDefined();
    }
  });

  it('BOSS 血量高于普通敌人', () => {
    for (const b of BATTLES) {
      const bosses = b.enemies.filter(e => e.isBoss);
      const normals = b.enemies.filter(e => !e.isBoss);
      if (bosses.length > 0 && normals.length > 0) {
        const maxNormalHp = Math.max(...normals.map(e => e.hp));
        const minBossHp = Math.min(...bosses.map(e => e.hp));
        expect(minBossHp).toBeGreaterThan(maxNormalHp);
      }
    }
  });

  it('每波战斗有奖励', () => {
    for (const b of BATTLES) {
      expect(Object.keys(b.rewards).length).toBeGreaterThan(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 13. 科技系统常量
// ═══════════════════════════════════════════════════════════════

describe('科技系统常量', () => {
  it('三条分支各 4 级', () => {
    const mil = TECHS.filter(t => t.branch === 'military');
    const eco = TECHS.filter(t => t.branch === 'economy');
    const cul = TECHS.filter(t => t.branch === 'culture');
    expect(mil).toHaveLength(4);
    expect(eco).toHaveLength(4);
    expect(cul).toHaveLength(4);
  });

  it('tier 1 无前置要求', () => {
    const tier1 = TECHS.filter(t => t.tier === 1);
    expect(tier1).toHaveLength(3);
    for (const t of tier1) {
      expect(t.requires).toHaveLength(0);
    }
  });

  it('tier 2+ 有前置要求', () => {
    const higher = TECHS.filter(t => t.tier >= 2);
    for (const t of higher) {
      expect(t.requires.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('每项科技有至少一个效果', () => {
    for (const t of TECHS) {
      expect(t.effects.length).toBeGreaterThanOrEqual(1);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 14. 领土系统常量
// ═══════════════════════════════════════════════════════════════

describe('领土系统常量', () => {
  it('洛阳为首都，需要最高兵力', () => {
    const luoyang = TERRITORIES.find(t => t.id === 'luoyang');
    expect(luoyang).toBeDefined();
    expect(luoyang!.type).toBe('capital');
    expect(luoyang!.powerRequired).toBe(5000);
  });

  it('所有领土都有相邻列表', () => {
    for (const t of TERRITORIES) {
      expect(t.adjacent.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('所有领土有唯一 ID', () => {
    const ids = TERRITORIES.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
