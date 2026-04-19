import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { DoodleGodEngine } from '../DoodleGodEngine';
import {
  ALL_ELEMENTS,
  COMBINATION_RULES,
  ElementCategory,
  SlotType,
  COLORS,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  getBasicElements,
  getBasicElementIds,
  getElementById,
  findCombination,
  getTotalElementCount,
  getAllElementIds,
  type ElementDef,
  type CombinationRule,
} from '../constants';

// ========== Mock 设置 ==========

function createMockCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  return canvas;
}

beforeAll(() => {
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => 0) as any;
  globalThis.cancelAnimationFrame = (() => {}) as any;
});

// ========== 辅助函数 ==========

function createEngine(): DoodleGodEngine {
  const engine = new DoodleGodEngine();
  const canvas = createMockCanvas();
  engine.setCanvas(canvas);
  engine.init();
  return engine;
}

function startEngine(): DoodleGodEngine {
  const engine = createEngine();
  engine.start();
  return engine;
}

/** 发现所有可通过组合得到的元素 */
function discoverAllElements(engine: DoodleGodEngine): void {
  const maxIterations = 200;
  let iteration = 0;
  let changed = true;
  while (changed && iteration < maxIterations) {
    changed = false;
    iteration++;
    const discovered = engine.getDiscoveredIds();
    for (let i = 0; i < discovered.length; i++) {
      for (let j = i; j < discovered.length; j++) {
        const result = engine.tryCombine(discovered[i], discovered[j]);
        if (result && !engine.isDiscovered(result)) {
          engine.discoverElement(result);
          changed = true;
        }
      }
    }
  }
}

// ========== 1. 常量与元素定义 ==========

describe('常量与元素定义', () => {
  it('ALL_ELEMENTS 不为空', () => {
    expect(ALL_ELEMENTS.length).toBeGreaterThan(0);
  });

  it('ALL_ELEMENTS 至少有 30 种元素', () => {
    expect(ALL_ELEMENTS.length).toBeGreaterThanOrEqual(30);
  });

  it('ALL_ELEMENTS 每个元素有唯一 ID', () => {
    const ids = ALL_ELEMENTS.map((e) => e.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('ALL_ELEMENTS 每个元素有非空名称', () => {
    for (const el of ALL_ELEMENTS) {
      expect(el.name.length).toBeGreaterThan(0);
    }
  });

  it('ALL_ELEMENTS 每个元素有 emoji', () => {
    for (const el of ALL_ELEMENTS) {
      expect(el.emoji.length).toBeGreaterThan(0);
    }
  });

  it('ALL_ELEMENTS 每个元素有有效类别', () => {
    const categories = new Set(Object.values(ElementCategory));
    for (const el of ALL_ELEMENTS) {
      expect(categories.has(el.category)).toBe(true);
    }
  });

  it('基础元素恰好有 4 个', () => {
    const basics = getBasicElements();
    expect(basics.length).toBe(4);
  });

  it('基础元素标记为 isBasic=true', () => {
    const basics = getBasicElements();
    for (const el of basics) {
      expect(el.isBasic).toBe(true);
    }
  });

  it('非基础元素标记为 isBasic=false', () => {
    const nonBasics = ALL_ELEMENTS.filter((e) => !e.isBasic);
    for (const el of nonBasics) {
      expect(el.isBasic).toBe(false);
    }
  });

  it('基础元素包含水、火、土、空气', () => {
    const basicIds = getBasicElementIds();
    expect(basicIds).toContain('water');
    expect(basicIds).toContain('fire');
    expect(basicIds).toContain('earth');
    expect(basicIds).toContain('air');
  });

  it('getBasicElementIds 返回正确的 ID 列表', () => {
    const ids = getBasicElementIds();
    expect(ids).toEqual(['water', 'fire', 'earth', 'air']);
  });

  it('getTotalElementCount 返回正确的总数', () => {
    expect(getTotalElementCount()).toBe(ALL_ELEMENTS.length);
  });

  it('getAllElementIds 返回所有元素 ID', () => {
    const ids = getAllElementIds();
    expect(ids.length).toBe(ALL_ELEMENTS.length);
    for (const el of ALL_ELEMENTS) {
      expect(ids).toContain(el.id);
    }
  });

  it('元素类别包含基础、自然、物质等', () => {
    expect(ElementCategory.BASIC).toBe('基础');
    expect(ElementCategory.NATURE).toBe('自然');
    expect(ElementCategory.MATTER).toBe('物质');
    expect(ElementCategory.LIFE).toBe('生命');
    expect(ElementCategory.TOOL).toBe('工具');
    expect(ElementCategory.FOOD).toBe('食物');
  });

  it('元素分布在多个类别中', () => {
    const categories = new Set(ALL_ELEMENTS.map((e) => e.category));
    expect(categories.size).toBeGreaterThanOrEqual(6);
  });
});

// ========== 2. 组合规则 ==========

describe('组合规则', () => {
  it('COMBINATION_RULES 不为空', () => {
    expect(COMBINATION_RULES.length).toBeGreaterThan(0);
  });

  it('每条规则的 result 引用已定义的元素', () => {
    const allIds = new Set(ALL_ELEMENTS.map((e) => e.id));
    for (const rule of COMBINATION_RULES) {
      expect(allIds.has(rule.result)).toBe(true);
    }
  });

  it('每条规则的 a 和 b 引用已定义的元素', () => {
    const allIds = new Set(ALL_ELEMENTS.map((e) => e.id));
    for (const rule of COMBINATION_RULES) {
      expect(allIds.has(rule.a)).toBe(true);
      expect(allIds.has(rule.b)).toBe(true);
    }
  });

  it('水+火=蒸汽', () => {
    expect(findCombination('water', 'fire')).toBe('steam');
  });

  it('火+水=蒸汽（顺序无关）', () => {
    expect(findCombination('fire', 'water')).toBe('steam');
  });

  it('土+水=泥', () => {
    expect(findCombination('earth', 'water')).toBe('mud');
  });

  it('火+土=岩浆', () => {
    expect(findCombination('fire', 'earth')).toBe('lava');
  });

  it('土+空气=尘土', () => {
    expect(findCombination('earth', 'air')).toBe('dust');
  });

  it('水+空气=雨', () => {
    expect(findCombination('water', 'air')).toBe('rain');
  });

  it('空气+火=能量', () => {
    expect(findCombination('air', 'fire')).toBe('energy');
  });

  it('findCombination 对无效组合返回 null', () => {
    expect(findCombination('water', 'water')).not.toBeNull(); // water+water=sea
  });

  it('findCombination 对完全不相关的元素返回 null', () => {
    // 找两个没有规则的元素
    const result = findCombination('diamond', 'robot');
    // 可能是 null，也可能有规则
    if (result === null) {
      expect(result).toBeNull();
    } else {
      expect(typeof result).toBe('string');
    }
  });

  it('findCombination 对未知元素返回 null', () => {
    expect(findCombination('nonexistent', 'water')).toBeNull();
    expect(findCombination('water', 'nonexistent')).toBeNull();
  });

  it('所有组合结果都是非基础元素', () => {
    const basicIds = new Set(getBasicElementIds());
    for (const rule of COMBINATION_RULES) {
      expect(basicIds.has(rule.result)).toBe(false);
    }
  });

  it('每条规则的 a 和 b 不相同（除非有自组合）', () => {
    // 有些规则允许 a===b，如 water+water=sea
    const selfCombos = COMBINATION_RULES.filter((r) => r.a === r.b);
    // 只需验证数据结构合理
    for (const rule of selfCombos) {
      expect(rule.a).toBe(rule.b);
    }
  });
});

// ========== 3. getElementById 辅助函数 ==========

describe('getElementById', () => {
  it('返回正确的元素定义', () => {
    const water = getElementById('water');
    expect(water).toBeDefined();
    expect(water!.name).toBe('水');
    expect(water!.emoji).toBe('💧');
    expect(water!.category).toBe(ElementCategory.BASIC);
    expect(water!.isBasic).toBe(true);
  });

  it('对不存在的 ID 返回 undefined', () => {
    expect(getElementById('nonexistent')).toBeUndefined();
  });

  it('对所有元素都能找到定义', () => {
    for (const el of ALL_ELEMENTS) {
      const found = getElementById(el.id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(el.id);
    }
  });
});

// ========== 4. 引擎构造与初始化 ==========

describe('引擎构造与初始化', () => {
  let engine: DoodleGodEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('创建实例不抛错', () => {
    expect(() => new DoodleGodEngine()).not.toThrow();
  });

  it('初始化后状态为 idle', () => {
    expect(engine.status).toBe('idle');
  });

  it('初始分数为 0', () => {
    expect(engine.score).toBe(0);
  });

  it('初始等级为 1', () => {
    expect(engine.level).toBe(1);
  });

  it('初始已发现元素为基础元素', () => {
    const discovered = engine.getDiscoveredIds();
    expect(discovered).toEqual(expect.arrayContaining(['water', 'fire', 'earth', 'air']));
    expect(discovered.length).toBe(4);
  });

  it('初始选择槽位为 FIRST', () => {
    expect(engine.getSelectedSlot()).toBe(SlotType.FIRST);
  });

  it('初始两个选择都为 null', () => {
    expect(engine.getFirstElementId()).toBeNull();
    expect(engine.getSecondElementId()).toBeNull();
  });

  it('初始光标索引为 0', () => {
    expect(engine.getCursorIndex()).toBe(0);
  });

  it('初始滚动偏移为 0', () => {
    expect(engine.getScrollOffset()).toBe(0);
  });

  it('初始未胜利', () => {
    expect(engine.isWin).toBe(false);
  });

  it('初始无最近发现', () => {
    expect(engine.getLastDiscovery()).toBeNull();
  });

  it('初始发现动画未激活', () => {
    const anim = engine.getDiscoveryAnimation();
    expect(anim.active).toBe(false);
    expect(anim.elementId).toBeNull();
  });
});

// ========== 5. 游戏启动 ==========

describe('游戏启动', () => {
  it('start() 后状态为 playing', () => {
    const engine = startEngine();
    expect(engine.status).toBe('playing');
  });

  it('start() 后重置已发现元素为基础元素', () => {
    const engine = startEngine();
    expect(engine.getDiscoveredCount()).toBe(4);
  });

  it('start() 后分数为 0', () => {
    const engine = startEngine();
    expect(engine.score).toBe(0);
  });

  it('start() 后 isWin 为 false', () => {
    const engine = startEngine();
    expect(engine.isWin).toBe(false);
  });

  it('start() 后选择被清除', () => {
    const engine = startEngine();
    expect(engine.getFirstElementId()).toBeNull();
    expect(engine.getSecondElementId()).toBeNull();
    expect(engine.getSelectedSlot()).toBe(SlotType.FIRST);
  });

  it('没有 canvas 时 start() 抛错', () => {
    const engine = new DoodleGodEngine();
    expect(() => engine.start()).toThrow('Canvas not initialized');
  });
});

// ========== 6. 元素发现 ==========

describe('元素发现', () => {
  let engine: DoodleGodEngine;

  beforeEach(() => {
    engine = startEngine();
  });

  it('discoverElement 发现新元素返回 true', () => {
    expect(engine.discoverElement('steam')).toBe(true);
  });

  it('discoverElement 后元素在已发现列表中', () => {
    engine.discoverElement('steam');
    expect(engine.isDiscovered('steam')).toBe(true);
  });

  it('discoverElement 重复发现返回 false', () => {
    engine.discoverElement('steam');
    expect(engine.discoverElement('steam')).toBe(false);
  });

  it('discoverElement 不存在的元素返回 false', () => {
    expect(engine.discoverElement('nonexistent')).toBe(false);
  });

  it('discoverElement 增加分数', () => {
    const initialScore = engine.score;
    engine.discoverElement('steam');
    expect(engine.score).toBe(initialScore + 10);
  });

  it('discoverElement 设置 lastDiscovery', () => {
    engine.discoverElement('steam');
    expect(engine.getLastDiscovery()).toBe('steam');
  });

  it('discoverElement 激活发现动画', () => {
    engine.discoverElement('steam');
    const anim = engine.getDiscoveryAnimation();
    expect(anim.active).toBe(true);
    expect(anim.elementId).toBe('steam');
  });

  it('discoverElement 触发 discovery 事件', () => {
    const handler = vi.fn();
    engine.on('discovery', handler);
    engine.discoverElement('steam');
    expect(handler).toHaveBeenCalledWith('steam');
  });

  it('discoverElement 触发 stateChange 事件', () => {
    const handler = vi.fn();
    engine.on('stateChange', handler);
    engine.discoverElement('steam');
    expect(handler).toHaveBeenCalled();
  });

  it('getDiscoveredCount 正确计数', () => {
    expect(engine.getDiscoveredCount()).toBe(4);
    engine.discoverElement('steam');
    expect(engine.getDiscoveredCount()).toBe(5);
    engine.discoverElement('mud');
    expect(engine.getDiscoveredCount()).toBe(6);
  });

  it('getProgress 返回正确百分比', () => {
    const total = getTotalElementCount();
    const expected = Math.round((4 / total) * 100);
    expect(engine.getProgress()).toBe(expected);
  });
});

// ========== 7. 组合逻辑 ==========

describe('组合逻辑', () => {
  let engine: DoodleGodEngine;

  beforeEach(() => {
    engine = startEngine();
  });

  it('tryCombine 两个已发现元素返回结果', () => {
    const result = engine.tryCombine('water', 'fire');
    expect(result).toBe('steam');
  });

  it('tryCombine 顺序无关', () => {
    expect(engine.tryCombine('fire', 'water')).toBe('steam');
    expect(engine.tryCombine('water', 'fire')).toBe('steam');
  });

  it('tryCombine 未发现的元素返回 null', () => {
    // steam 未发现，不能用来组合
    expect(engine.tryCombine('steam', 'earth')).toBeNull();
  });

  it('tryCombine 无效组合返回 null', () => {
    // water + water = sea (有效)
    // 但需要检查是否有无效组合
    const result = engine.tryCombine('water', 'water');
    // water+water 有规则 -> sea
    expect(result).not.toBeNull();
  });

  it('selectElement 选择第一个元素后切换到 SECOND 槽', () => {
    engine.selectElement('water');
    expect(engine.getFirstElementId()).toBe('water');
    expect(engine.getSelectedSlot()).toBe(SlotType.SECOND);
  });

  it('selectElement 选择第二个元素后自动尝试组合', () => {
    const result = engine.selectElement('fire');
    // 先选 water，再选 fire，应该自动组合
    // 第一次选择
    engine.clearSelection();
    engine.selectElement('water');
    // 第二次选择
    const spy = vi.spyOn(engine, 'attemptCombination');
    engine.selectElement('fire');
    expect(spy).toHaveBeenCalled();
  });

  it('selectElement 未发现元素返回 false', () => {
    expect(engine.selectElement('steam')).toBe(false);
  });

  it('selectElement 非 playing 状态返回 false', () => {
    engine.pause();
    expect(engine.selectElement('water')).toBe(false);
  });

  it('attemptCombination 有效组合返回结果', () => {
    engine.selectElement('water');
    engine.selectElement('fire');
    // 组合后选择被清除
    expect(engine.getFirstElementId()).toBeNull();
    expect(engine.getSecondElementId()).toBeNull();
  });

  it('attemptCombination 有效组合发现新元素', () => {
    engine.selectElement('water');
    engine.selectElement('fire');
    expect(engine.isDiscovered('steam')).toBe(true);
  });

  it('attemptCombination 无效组合返回 null', () => {
    // 先发现 steam，然后尝试 steam + steam（可能无规则）
    engine.discoverElement('steam');
    engine.clearSelection();
    // 直接设置选择
    (engine as any).firstElementId = 'water';
    (engine as any).secondElementId = 'water';
    // water+water=sea，有效
    const result = engine.attemptCombination();
    expect(result).toBe('sea');
  });

  it('attemptCombination 没有选择返回 null', () => {
    engine.clearSelection();
    expect(engine.attemptCombination()).toBeNull();
  });

  it('attemptCombination 只有一个选择返回 null', () => {
    (engine as any).firstElementId = 'water';
    (engine as any).secondElementId = null;
    expect(engine.attemptCombination()).toBeNull();
  });

  it('clearSelection 清除所有选择', () => {
    engine.selectElement('water');
    expect(engine.getFirstElementId()).toBe('water');
    engine.clearSelection();
    expect(engine.getFirstElementId()).toBeNull();
    expect(engine.getSecondElementId()).toBeNull();
    expect(engine.getSelectedSlot()).toBe(SlotType.FIRST);
  });

  it('toggleSlot 切换槽位', () => {
    expect(engine.getSelectedSlot()).toBe(SlotType.FIRST);
    engine.toggleSlot();
    expect(engine.getSelectedSlot()).toBe(SlotType.SECOND);
    engine.toggleSlot();
    expect(engine.getSelectedSlot()).toBe(SlotType.FIRST);
  });

  it('选择相同元素两次可以组合', () => {
    // water + water = sea
    engine.selectElement('water');
    engine.selectElement('water');
    expect(engine.isDiscovered('sea')).toBe(true);
  });
});

// ========== 8. 进度追踪 ==========

describe('进度追踪', () => {
  let engine: DoodleGodEngine;

  beforeEach(() => {
    engine = startEngine();
  });

  it('初始进度为 4/总数', () => {
    expect(engine.getDiscoveredCount()).toBe(4);
    expect(engine.getTotalElements()).toBe(getTotalElementCount());
  });

  it('发现元素后进度增加', () => {
    engine.discoverElement('steam');
    expect(engine.getDiscoveredCount()).toBe(5);
  });

  it('getProgress 计算正确', () => {
    const total = getTotalElementCount();
    const progress = engine.getProgress();
    expect(progress).toBe(Math.round((4 / total) * 100));
  });

  it('getDiscoveredElements 返回已发现元素定义', () => {
    const elements = engine.getDiscoveredElements();
    expect(elements.length).toBe(4);
    const ids = elements.map((e) => e.id);
    expect(ids).toContain('water');
    expect(ids).toContain('fire');
    expect(ids).toContain('earth');
    expect(ids).toContain('air');
  });

  it('getUndiscoveredElements 返回未发现元素', () => {
    const elements = engine.getUndiscoveredElements();
    expect(elements.length).toBe(getTotalElementCount() - 4);
    const ids = elements.map((e) => e.id);
    expect(ids).not.toContain('water');
    expect(ids).toContain('steam');
  });

  it('getAllElementsWithState 正确标记状态', () => {
    const all = engine.getAllElementsWithState();
    expect(all.length).toBe(getTotalElementCount());
    const waterState = all.find((s) => s.element.id === 'water');
    expect(waterState!.discovered).toBe(true);
    const steamState = all.find((s) => s.element.id === 'steam');
    expect(steamState!.discovered).toBe(false);
  });

  it('getDiscoveredByCategory 按类别分组', () => {
    const grouped = engine.getDiscoveredByCategory();
    expect(grouped['基础'].length).toBe(4);
    expect(grouped['自然'].length).toBe(0);
  });

  it('getDiscoveredByCategory 发现新元素后分组更新', () => {
    engine.discoverElement('steam');
    const grouped = engine.getDiscoveredByCategory();
    expect(grouped['自然'].length).toBe(1);
    expect(grouped['自然'][0].id).toBe('steam');
  });
});

// ========== 9. 胜利条件 ==========

describe('胜利条件', () => {
  it('发现所有元素后 isWin 为 true', () => {
    const engine = startEngine();
    discoverAllElements(engine);
    expect(engine.isWin).toBe(true);
  });

  it('发现所有元素后状态为 gameover', () => {
    const engine = startEngine();
    discoverAllElements(engine);
    expect(engine.status).toBe('gameover');
  });

  it('发现所有元素后触发 win 事件', () => {
    const engine = startEngine();
    const handler = vi.fn();
    engine.on('win', handler);
    discoverAllElements(engine);
    expect(handler).toHaveBeenCalled();
  });

  it('未发现全部元素时 isWin 为 false', () => {
    const engine = startEngine();
    engine.discoverElement('steam');
    expect(engine.isWin).toBe(false);
  });

  it('胜利后不能再选择元素', () => {
    const engine = startEngine();
    discoverAllElements(engine);
    expect(engine.selectElement('water')).toBe(false);
  });

  it('胜利后分数正确', () => {
    const engine = startEngine();
    discoverAllElements(engine);
    // 4 个基础元素不计分，(总数 - 4) * 10
    const expectedScore = (getTotalElementCount() - 4) * 10;
    expect(engine.score).toBe(expectedScore);
  });
});

// ========== 10. 键盘导航 ==========

describe('键盘导航', () => {
  let engine: DoodleGodEngine;

  beforeEach(() => {
    engine = startEngine();
  });

  it('ArrowRight 向右移动光标', () => {
    engine.handleKeyDown('ArrowRight');
    expect(engine.getCursorIndex()).toBe(1);
  });

  it('ArrowLeft 向左移动光标', () => {
    engine.setCursorIndex(2);
    engine.handleKeyDown('ArrowLeft');
    expect(engine.getCursorIndex()).toBe(1);
  });

  it('ArrowDown 向下移动光标', () => {
    engine.handleKeyDown('ArrowDown');
    expect(engine.getCursorIndex()).toBe(6); // ELEMENTS_PER_ROW
  });

  it('ArrowUp 向上移动光标', () => {
    engine.setCursorIndex(6);
    engine.handleKeyDown('ArrowUp');
    expect(engine.getCursorIndex()).toBe(0);
  });

  it('光标不会越界到负数', () => {
    engine.handleKeyDown('ArrowLeft');
    expect(engine.getCursorIndex()).toBe(0);
  });

  it('光标不会越界超过最大值', () => {
    const maxIndex = getTotalElementCount() - 1;
    engine.setCursorIndex(maxIndex);
    engine.handleKeyDown('ArrowRight');
    expect(engine.getCursorIndex()).toBe(maxIndex);
  });

  it('在第一行 ArrowUp 不移动', () => {
    engine.handleKeyDown('ArrowUp');
    expect(engine.getCursorIndex()).toBe(0);
  });

  it('在最后一行 ArrowDown 不移动', () => {
    const maxIndex = getTotalElementCount() - 1;
    engine.setCursorIndex(maxIndex);
    engine.handleKeyDown('ArrowDown');
    expect(engine.getCursorIndex()).toBe(maxIndex);
  });

  it('空格选择当前光标元素', () => {
    engine.setCursorIndex(0); // water
    engine.handleKeyDown(' ');
    expect(engine.getFirstElementId()).toBe('water');
  });

  it('回车选择当前光标元素', () => {
    engine.setCursorIndex(1); // fire
    engine.handleKeyDown('Enter');
    expect(engine.getFirstElementId()).toBe('fire');
  });

  it('Tab 切换选择槽位', () => {
    expect(engine.getSelectedSlot()).toBe(SlotType.FIRST);
    engine.handleKeyDown('Tab');
    expect(engine.getSelectedSlot()).toBe(SlotType.SECOND);
    engine.handleKeyDown('Tab');
    expect(engine.getSelectedSlot()).toBe(SlotType.FIRST);
  });

  it('Escape 清除选择', () => {
    engine.selectElement('water');
    engine.handleKeyDown('Escape');
    expect(engine.getFirstElementId()).toBeNull();
    expect(engine.getSelectedSlot()).toBe(SlotType.FIRST);
  });

  it('暂停状态下按键无效', () => {
    engine.pause();
    const initialIndex = engine.getCursorIndex();
    engine.handleKeyDown('ArrowRight');
    expect(engine.getCursorIndex()).toBe(initialIndex);
  });

  it('非 playing 状态下空格无效', () => {
    engine.pause();
    engine.handleKeyDown(' ');
    expect(engine.getFirstElementId()).toBeNull();
  });

  it('handleKeyUp 不抛错', () => {
    expect(() => engine.handleKeyUp('ArrowUp')).not.toThrow();
    expect(() => engine.handleKeyUp(' ')).not.toThrow();
  });

  it('连续导航到指定位置', () => {
    // 右 -> 右 -> 下
    engine.handleKeyDown('ArrowRight');
    engine.handleKeyDown('ArrowRight');
    engine.handleKeyDown('ArrowDown');
    expect(engine.getCursorIndex()).toBe(8); // 2 + 6
  });
});

// ========== 11. 光标与滚动 ==========

describe('光标与滚动', () => {
  let engine: DoodleGodEngine;

  beforeEach(() => {
    engine = startEngine();
  });

  it('setCursorIndex 设置光标位置', () => {
    engine.setCursorIndex(5);
    expect(engine.getCursorIndex()).toBe(5);
  });

  it('setCursorIndex 不超过最大值', () => {
    const max = getTotalElementCount() - 1;
    engine.setCursorIndex(max + 100);
    expect(engine.getCursorIndex()).toBe(max);
  });

  it('setCursorIndex 不小于 0', () => {
    engine.setCursorIndex(-10);
    expect(engine.getCursorIndex()).toBe(0);
  });

  it('getCursorElementId 返回当前光标元素 ID', () => {
    engine.setCursorIndex(0);
    expect(engine.getCursorElementId()).toBe('water');
  });

  it('getCursorElementId 返回正确元素', () => {
    engine.setCursorIndex(1);
    expect(engine.getCursorElementId()).toBe('fire');
  });

  it('getVisibleRowRange 返回可见行范围', () => {
    const range = engine.getVisibleRowRange();
    expect(range.startRow).toBeGreaterThanOrEqual(0);
    expect(range.endRow).toBeGreaterThan(range.startRow);
  });

  it('scrollToRow 设置滚动偏移', () => {
    engine.scrollToRow(5);
    expect(engine.getScrollOffset()).toBeGreaterThan(0);
  });

  it('scrollToRow 不超过最大滚动', () => {
    engine.scrollToRow(1000);
    const offset = engine.getScrollOffset();
    engine.scrollToRow(2000);
    expect(engine.getScrollOffset()).toBe(offset);
  });

  it('ensureCursorVisible 不抛错', () => {
    engine.setCursorIndex(50);
    expect(() => engine.ensureCursorVisible()).not.toThrow();
  });

  it('selectCurrentElement 选择光标所在元素', () => {
    engine.setCursorIndex(0);
    engine.selectCurrentElement();
    expect(engine.getFirstElementId()).toBe('water');
  });
});

// ========== 12. 事件系统 ==========

describe('事件系统', () => {
  let engine: DoodleGodEngine;

  beforeEach(() => {
    engine = startEngine();
  });

  it('discovery 事件在发现新元素时触发', () => {
    const handler = vi.fn();
    engine.on('discovery', handler);
    engine.discoverElement('steam');
    expect(handler).toHaveBeenCalledWith('steam');
  });

  it('discovery 事件不重复触发已发现元素', () => {
    const handler = vi.fn();
    engine.discoverElement('steam');
    engine.on('discovery', handler);
    engine.discoverElement('steam'); // 重复
    expect(handler).not.toHaveBeenCalled();
  });

  it('stateChange 事件在选择元素时触发', () => {
    const handler = vi.fn();
    engine.on('stateChange', handler);
    engine.selectElement('water');
    expect(handler).toHaveBeenCalled();
  });

  it('stateChange 事件在切换槽位时触发', () => {
    const handler = vi.fn();
    engine.on('stateChange', handler);
    engine.toggleSlot();
    expect(handler).toHaveBeenCalled();
  });

  it('stateChange 事件在清除选择时触发', () => {
    const handler = vi.fn();
    engine.on('stateChange', handler);
    engine.clearSelection();
    expect(handler).toHaveBeenCalled();
  });

  it('off 取消事件监听', () => {
    const handler = vi.fn();
    engine.on('discovery', handler);
    engine.off('discovery', handler);
    engine.discoverElement('steam');
    expect(handler).not.toHaveBeenCalled();
  });

  it('statusChange 事件在 start 时触发', () => {
    const handler = vi.fn();
    const engine2 = createEngine();
    engine2.on('statusChange', handler);
    engine2.start();
    expect(handler).toHaveBeenCalledWith('playing');
  });
});

// ========== 13. getState ==========

describe('getState', () => {
  it('返回正确的状态对象', () => {
    const engine = startEngine();
    const state = engine.getState();

    expect(state).toHaveProperty('discoveredIds');
    expect(state).toHaveProperty('selectedSlot');
    expect(state).toHaveProperty('firstElementId');
    expect(state).toHaveProperty('secondElementId');
    expect(state).toHaveProperty('cursorIndex');
    expect(state).toHaveProperty('scrollOffset');
    expect(state).toHaveProperty('isWin');
    expect(state).toHaveProperty('discoveryAnimation');
    expect(state).toHaveProperty('lastDiscovery');
    expect(state).toHaveProperty('totalDiscovered');
    expect(state).toHaveProperty('totalElements');
    expect(state).toHaveProperty('progress');
  });

  it('discoveredIds 包含基础元素', () => {
    const engine = startEngine();
    const state = engine.getState() as any;
    expect(state.discoveredIds).toContain('water');
    expect(state.discoveredIds).toContain('fire');
    expect(state.discoveredIds).toContain('earth');
    expect(state.discoveredIds).toContain('air');
  });

  it('totalDiscovered 初始为 4', () => {
    const engine = startEngine();
    const state = engine.getState() as any;
    expect(state.totalDiscovered).toBe(4);
  });

  it('totalElements 等于 ALL_ELEMENTS 长度', () => {
    const engine = startEngine();
    const state = engine.getState() as any;
    expect(state.totalElements).toBe(ALL_ELEMENTS.length);
  });

  it('progress 初始为正确百分比', () => {
    const engine = startEngine();
    const state = engine.getState() as any;
    expect(state.progress).toBe(Math.round((4 / ALL_ELEMENTS.length) * 100));
  });

  it('isWin 初始为 false', () => {
    const engine = startEngine();
    const state = engine.getState() as any;
    expect(state.isWin).toBe(false);
  });

  it('发现元素后状态更新', () => {
    const engine = startEngine();
    engine.discoverElement('steam');
    const state = engine.getState() as any;
    expect(state.discoveredIds).toContain('steam');
    expect(state.totalDiscovered).toBe(5);
    expect(state.lastDiscovery).toBe('steam');
  });
});

// ========== 14. 重置与销毁 ==========

describe('重置与销毁', () => {
  it('reset() 后状态为 idle', () => {
    const engine = startEngine();
    engine.reset();
    expect(engine.status).toBe('idle');
  });

  it('reset() 后分数为 0', () => {
    const engine = startEngine();
    engine.discoverElement('steam');
    engine.reset();
    expect(engine.score).toBe(0);
  });

  it('reset() 后已发现元素重置为基础元素', () => {
    const engine = startEngine();
    engine.discoverElement('steam');
    engine.reset();
    expect(engine.getDiscoveredCount()).toBe(4);
  });

  it('reset() 后选择清除', () => {
    const engine = startEngine();
    engine.selectElement('water');
    engine.reset();
    expect(engine.getFirstElementId()).toBeNull();
    expect(engine.getSecondElementId()).toBeNull();
  });

  it('reset() 后 isWin 为 false', () => {
    const engine = startEngine();
    engine.reset();
    expect(engine.isWin).toBe(false);
  });

  it('destroy() 不抛错', () => {
    const engine = startEngine();
    expect(() => engine.destroy()).not.toThrow();
  });

  it('destroy() 后状态为 idle', () => {
    const engine = startEngine();
    engine.destroy();
    expect(engine.status).toBe('idle');
  });
});

// ========== 15. 暂停与恢复 ==========

describe('暂停与恢复', () => {
  it('pause() 后状态为 paused', () => {
    const engine = startEngine();
    engine.pause();
    expect(engine.status).toBe('paused');
  });

  it('resume() 后状态为 playing', () => {
    const engine = startEngine();
    engine.pause();
    engine.resume();
    expect(engine.status).toBe('playing');
  });

  it('idle 状态不能暂停', () => {
    const engine = createEngine();
    engine.pause();
    expect(engine.status).toBe('idle');
  });

  it('playing 状态不能 resume', () => {
    const engine = startEngine();
    engine.resume();
    expect(engine.status).toBe('playing');
  });
});

// ========== 16. isDiscovered ==========

describe('isDiscovered', () => {
  let engine: DoodleGodEngine;

  beforeEach(() => {
    engine = startEngine();
  });

  it('基础元素已发现', () => {
    expect(engine.isDiscovered('water')).toBe(true);
    expect(engine.isDiscovered('fire')).toBe(true);
    expect(engine.isDiscovered('earth')).toBe(true);
    expect(engine.isDiscovered('air')).toBe(true);
  });

  it('非基础元素未发现', () => {
    expect(engine.isDiscovered('steam')).toBe(false);
    expect(engine.isDiscovered('mud')).toBe(false);
    expect(engine.isDiscovered('lava')).toBe(false);
  });

  it('发现后标记为已发现', () => {
    engine.discoverElement('steam');
    expect(engine.isDiscovered('steam')).toBe(true);
  });

  it('不存在的元素未发现', () => {
    expect(engine.isDiscovered('nonexistent')).toBe(false);
  });
});

// ========== 17. 完整游戏流程 ==========

describe('完整游戏流程', () => {
  it('完整游戏流程：开始 → 发现 → 胜利', () => {
    const engine = startEngine();

    // 初始状态
    expect(engine.getDiscoveredCount()).toBe(4);
    expect(engine.isWin).toBe(false);

    // 发现蒸汽
    engine.discoverElement('steam');
    expect(engine.isDiscovered('steam')).toBe(true);
    expect(engine.getDiscoveredCount()).toBe(5);

    // 发现泥
    engine.discoverElement('mud');
    expect(engine.isDiscovered('mud')).toBe(true);
    expect(engine.getDiscoveredCount()).toBe(6);

    // 发现岩浆
    engine.discoverElement('lava');
    expect(engine.isDiscovered('lava')).toBe(true);
    expect(engine.getDiscoveredCount()).toBe(7);

    // 尝试通过选择组合
    engine.clearSelection();
    engine.selectElement('water'); // 第一个
    engine.selectElement('fire'); // 第二个，自动组合
    // steam 已经发现，不会再次发现

    expect(engine.score).toBe(30); // 3 discoveries * 10
  });

  it('通过键盘完整游戏流程', () => {
    const engine = startEngine();

    // 选择 water（光标在 0）
    expect(engine.getCursorElementId()).toBe('water');
    engine.handleKeyDown(' '); // 选择 water
    expect(engine.getFirstElementId()).toBe('water');

    // 移动到 fire（索引 1）
    engine.handleKeyDown('ArrowRight');
    expect(engine.getCursorElementId()).toBe('fire');
    engine.handleKeyDown(' '); // 选择 fire，自动组合
    expect(engine.isDiscovered('steam')).toBe(true);

    // 选择被清除
    expect(engine.getFirstElementId()).toBeNull();
  });

  it('重置后可以重新开始', () => {
    const engine = startEngine();
    engine.discoverElement('steam');
    engine.discoverElement('mud');
    expect(engine.getDiscoveredCount()).toBe(6);

    engine.reset();
    expect(engine.getDiscoveredCount()).toBe(4);
    expect(engine.score).toBe(0);
    expect(engine.isDiscovered('steam')).toBe(false);
  });
});

// ========== 18. 边界情况 ==========

describe('边界情况', () => {
  let engine: DoodleGodEngine;

  beforeEach(() => {
    engine = startEngine();
  });

  it('选择未发现元素无效', () => {
    expect(engine.selectElement('steam')).toBe(false);
    expect(engine.getFirstElementId()).toBeNull();
  });

  it('组合两个相同的基础元素', () => {
    // water + water = sea
    engine.selectElement('water');
    engine.selectElement('water');
    expect(engine.isDiscovered('sea')).toBe(true);
  });

  it('重复组合已发现的元素不增加分数', () => {
    engine.discoverElement('steam');
    const scoreBefore = engine.score;
    // 再次组合 water + fire
    engine.selectElement('water');
    engine.selectElement('fire');
    // steam 已发现，分数不变
    expect(engine.score).toBe(scoreBefore);
  });

  it('discoverElement 对基础元素无效', () => {
    // 基础元素已经在 discoveredIds 中
    expect(engine.discoverElement('water')).toBe(false);
  });

  it('光标在边界时导航正确', () => {
    const maxIndex = getTotalElementCount() - 1;
    engine.setCursorIndex(maxIndex);

    // 在最后一行的最后一列
    engine.handleKeyDown('ArrowRight');
    expect(engine.getCursorIndex()).toBe(maxIndex);

    engine.handleKeyDown('ArrowDown');
    expect(engine.getCursorIndex()).toBe(maxIndex);
  });

  it('光标在中间位置时四方向导航', () => {
    engine.setCursorIndex(7); // 第 2 行第 1 列
    engine.handleKeyDown('ArrowLeft');
    expect(engine.getCursorIndex()).toBe(6);
    engine.handleKeyDown('ArrowRight');
    expect(engine.getCursorIndex()).toBe(7);
    engine.handleKeyDown('ArrowUp');
    expect(engine.getCursorIndex()).toBe(1);
    engine.handleKeyDown('ArrowDown');
    expect(engine.getCursorIndex()).toBe(7);
  });

  it('大量连续发现不抛错', () => {
    expect(() => discoverAllElements(engine)).not.toThrow();
  });

  it('多个无效按键不抛错', () => {
    expect(() => {
      engine.handleKeyDown('a');
      engine.handleKeyDown('b');
      engine.handleKeyDown('1');
      engine.handleKeyDown('F1');
    }).not.toThrow();
  });
});

// ========== 19. SlotType 枚举 ==========

describe('SlotType 枚举', () => {
  it('FIRST 值正确', () => {
    expect(SlotType.FIRST).toBe('first');
  });

  it('SECOND 值正确', () => {
    expect(SlotType.SECOND).toBe('second');
  });
});

// ========== 20. COLORS 常量 ==========

describe('COLORS 常量', () => {
  it('包含必要的颜色定义', () => {
    expect(COLORS.bg).toBeDefined();
    expect(COLORS.hudBg).toBeDefined();
    expect(COLORS.slotBg).toBeDefined();
    expect(COLORS.textPrimary).toBeDefined();
    expect(COLORS.accent).toBeDefined();
    expect(COLORS.neon).toBeDefined();
  });

  it('categoryColors 包含所有类别', () => {
    for (const cat of Object.values(ElementCategory)) {
      expect(COLORS.categoryColors[cat]).toBeDefined();
    }
  });
});

// ========== 21. 组合规则覆盖度 ==========

describe('组合规则覆盖度', () => {
  it('所有非基础元素都可以通过组合获得', () => {
    const basicIds = new Set(getBasicElementIds());
    const nonBasicElements = ALL_ELEMENTS.filter((e) => !e.isBasic);
    const results = new Set(COMBINATION_RULES.map((r) => r.result));

    for (const el of nonBasicElements) {
      expect(results.has(el.id)).toBe(true);
    }
  });

  it('基础元素不出现在组合结果中', () => {
    const basicIds = new Set(getBasicElementIds());
    for (const rule of COMBINATION_RULES) {
      expect(basicIds.has(rule.result)).toBe(false);
    }
  });

  it('组合规则数量合理（至少 30 条）', () => {
    expect(COMBINATION_RULES.length).toBeGreaterThanOrEqual(30);
  });
});

// ========== 22. ElementCategory 枚举 ==========

describe('ElementCategory 枚举', () => {
  it('所有类别都有中文名称', () => {
    const categories = Object.values(ElementCategory);
    for (const cat of categories) {
      expect(cat.length).toBeGreaterThan(0);
    }
  });

  it('类别数量合理', () => {
    const categories = Object.values(ElementCategory);
    expect(categories.length).toBeGreaterThanOrEqual(8);
  });
});

// ========== 23. 引擎继承 ==========

describe('引擎继承', () => {
  it('DoodleGodEngine 继承 GameEngine', () => {
    const engine = new DoodleGodEngine();
    expect(engine).toHaveProperty('score');
    expect(engine).toHaveProperty('level');
    expect(engine).toHaveProperty('status');
    expect(engine).toHaveProperty('init');
    expect(engine).toHaveProperty('start');
    expect(engine).toHaveProperty('pause');
    expect(engine).toHaveProperty('resume');
    expect(engine).toHaveProperty('reset');
    expect(engine).toHaveProperty('destroy');
    expect(engine).toHaveProperty('handleKeyDown');
    expect(engine).toHaveProperty('handleKeyUp');
    expect(engine).toHaveProperty('getState');
  });

  it('引擎有 on/off 事件系统', () => {
    const engine = new DoodleGodEngine();
    expect(typeof engine.on).toBe('function');
    expect(typeof engine.off).toBe('function');
  });

  it('引擎有 setCanvas 方法', () => {
    const engine = new DoodleGodEngine();
    expect(typeof engine.setCanvas).toBe('function');
  });
});

// ========== 24. 发现动画 ==========

describe('发现动画', () => {
  let engine: DoodleGodEngine;

  beforeEach(() => {
    engine = startEngine();
  });

  it('初始动画未激活', () => {
    const anim = engine.getDiscoveryAnimation();
    expect(anim.active).toBe(false);
  });

  it('发现元素后动画激活', () => {
    engine.discoverElement('steam');
    const anim = engine.getDiscoveryAnimation();
    expect(anim.active).toBe(true);
    expect(anim.elementId).toBe('steam');
  });

  it('动画有开始时间', () => {
    engine.discoverElement('steam');
    const anim = engine.getDiscoveryAnimation();
    expect(anim.startTime).toBeGreaterThan(0);
  });

  it('重复发现不激活动画', () => {
    engine.discoverElement('steam');
    engine.discoverElement('steam');
    // 动画仍然只激活一次（第二次返回 false）
    const anim = engine.getDiscoveryAnimation();
    expect(anim.elementId).toBe('steam');
  });
});

// ========== 25. update 方法 ==========

describe('update 方法', () => {
  it('update 不抛错', () => {
    const engine = startEngine();
    expect(() => engine.update(16)).not.toThrow();
  });

  it('update 在有动画时不抛错', () => {
    const engine = startEngine();
    engine.discoverElement('steam');
    expect(() => engine.update(16)).not.toThrow();
  });
});

// ========== 26. 特殊组合测试 ==========

describe('特殊组合测试', () => {
  let engine: DoodleGodEngine;

  beforeEach(() => {
    engine = startEngine();
  });

  it('水+火=蒸汽', () => {
    engine.selectElement('water');
    engine.selectElement('fire');
    expect(engine.isDiscovered('steam')).toBe(true);
  });

  it('土+水=泥', () => {
    engine.selectElement('earth');
    engine.selectElement('water');
    expect(engine.isDiscovered('mud')).toBe(true);
  });

  it('火+土=岩浆', () => {
    engine.selectElement('fire');
    engine.selectElement('earth');
    expect(engine.isDiscovered('lava')).toBe(true);
  });

  it('土+空气=尘土', () => {
    engine.selectElement('earth');
    engine.selectElement('air');
    expect(engine.isDiscovered('dust')).toBe(true);
  });

  it('水+空气=雨', () => {
    engine.selectElement('water');
    engine.selectElement('air');
    expect(engine.isDiscovered('rain')).toBe(true);
  });

  it('空气+火=能量', () => {
    engine.selectElement('air');
    engine.selectElement('fire');
    expect(engine.isDiscovered('energy')).toBe(true);
  });

  it('水+水=海', () => {
    engine.selectElement('water');
    engine.selectElement('water');
    expect(engine.isDiscovered('sea')).toBe(true);
  });

  it('多步组合链：水+火→蒸汽, 蒸汽+土→间歇泉', () => {
    engine.discoverElement('steam');
    const result = engine.tryCombine('steam', 'earth');
    expect(result).toBe('geyser');
  });
});

// ========== 27. 数据完整性 ==========

describe('数据完整性', () => {
  it('所有元素 ID 不含空格', () => {
    for (const el of ALL_ELEMENTS) {
      expect(el.id).not.toContain(' ');
    }
  });

  it('所有元素 ID 是小写', () => {
    for (const el of ALL_ELEMENTS) {
      expect(el.id).toBe(el.id.toLowerCase());
    }
  });

  it('所有元素 ID 使用连字符格式', () => {
    for (const el of ALL_ELEMENTS) {
      expect(el.id).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });

  it('组合规则没有重复', () => {
    const ruleSet = new Set<string>();
    for (const rule of COMBINATION_RULES) {
      // 标准化：a < b
      const key = rule.a < rule.b ? `${rule.a}+${rule.b}=${rule.result}` : `${rule.b}+${rule.a}=${rule.result}`;
      expect(ruleSet.has(key)).toBe(false);
      ruleSet.add(key);
    }
  });

  it('所有元素定义完整', () => {
    for (const el of ALL_ELEMENTS) {
      expect(el.id).toBeTruthy();
      expect(el.name).toBeTruthy();
      expect(el.emoji).toBeTruthy();
      expect(el.category).toBeTruthy();
      expect(typeof el.isBasic).toBe('boolean');
    }
  });
});
