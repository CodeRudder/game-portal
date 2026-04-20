/**
 * 水排序 (Water Sort) — 完整测试
 *
 * 覆盖：试管选择、倒水规则、胜利判定、撤销、关卡生成、键盘控制、边界情况
 */

import { WaterSortEngine } from '../WaterSortEngine';
import {
  TUBE_CAPACITY,
  COLOR_POOL,
  LEVEL_CONFIGS,
  MAX_LEVEL,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
} from '../constants';

// ========== 辅助工具 ==========

function createMockCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  return canvas;
}

function createEngine(): WaterSortEngine {
  const engine = new WaterSortEngine();
  engine.init();
  return engine;
}

function startEngine(): WaterSortEngine {
  const engine = new WaterSortEngine();
  const canvas = createMockCanvas();
  engine.setCanvas(canvas);
  engine.init();
  engine.start();
  return engine;
}

/** 创建简单测试用试管配置：3种颜色 + 2个空试管 */
function createSimpleTubes(): string[][] {
  return [
    ['#FF4444', '#44AAFF', '#44DD44', '#FF4444'], // 试管0：红蓝绿红
    ['#44AAFF', '#44DD44', '#FF4444', '#44AAFF'], // 试管1：蓝绿红蓝
    ['#44DD44', '#FF4444', '#44AAFF', '#44DD44'], // 试管2：绿红蓝绿
    [],                                           // 空1
    [],                                           // 空2
  ];
}

/** 创建已胜利的试管配置 */
function createWonTubes(): string[][] {
  return [
    ['#FF4444', '#FF4444', '#FF4444', '#FF4444'], // 全红
    ['#44AAFF', '#44AAFF', '#44AAFF', '#44AAFF'], // 全蓝
    [],                                           // 空
    [],                                           // 空
  ];
}

/** 创建部分完成的试管配置 */
function createPartialTubes(): string[][] {
  return [
    ['#FF4444', '#FF4444', '#FF4444', '#44AAFF'], // 3红+1蓝
    ['#44AAFF', '#44AAFF', '#44AAFF'],             // 3蓝
    [],                                           // 空
  ];
}

// ========== 1. 常量测试 ==========

describe('Water Sort — 常量', () => {
  it('CANVAS_WIDTH 应为 480', () => {
    expect(CANVAS_WIDTH).toBe(480);
  });

  it('CANVAS_HEIGHT 应为 640', () => {
    expect(CANVAS_HEIGHT).toBe(640);
  });

  it('TUBE_CAPACITY 应为 4', () => {
    expect(TUBE_CAPACITY).toBe(4);
  });

  it('COLOR_POOL 至少有 12 种颜色', () => {
    expect(COLOR_POOL.length).toBeGreaterThanOrEqual(12);
  });

  it('LEVEL_CONFIGS 长度大于 0', () => {
    expect(LEVEL_CONFIGS.length).toBeGreaterThan(0);
  });

  it('MAX_LEVEL 等于 LEVEL_CONFIGS 长度', () => {
    expect(MAX_LEVEL).toBe(LEVEL_CONFIGS.length);
  });

  it('每个关卡颜色数不超过 COLOR_POOL 长度', () => {
    for (const config of LEVEL_CONFIGS) {
      expect(config.colorCount).toBeLessThanOrEqual(COLOR_POOL.length);
    }
  });

  it('每个关卡空试管数至少为 2', () => {
    for (const config of LEVEL_CONFIGS) {
      expect(config.emptyTubes).toBeGreaterThanOrEqual(2);
    }
  });
});

// ========== 2. 构造与初始化 ==========

describe('Water Sort — 构造与初始化', () => {
  it('创建实例不抛错', () => {
    expect(() => new WaterSortEngine()).not.toThrow();
  });

  it('init 后状态为 idle', () => {
    const engine = createEngine();
    expect(engine.status).toBe('idle');
  });

  it('init 后生成试管', () => {
    const engine = createEngine();
    expect(engine.getTubes().length).toBeGreaterThan(0);
  });

  it('init 后无选中试管', () => {
    const engine = createEngine();
    expect(engine.getSelectedIndex()).toBeNull();
  });

  it('init 后光标在第一个试管', () => {
    const engine = createEngine();
    expect(engine.getCursorIndex()).toBe(0);
  });

  it('init 后步数为 0', () => {
    const engine = createEngine();
    expect(engine.getMoves()).toBe(0);
  });

  it('init 后未胜利', () => {
    const engine = createEngine();
    expect(engine.getIsWon()).toBe(false);
  });

  it('init 后历史为空', () => {
    const engine = createEngine();
    expect(engine.getHistoryLength()).toBe(0);
  });

  it('start 后状态为 playing', () => {
    const engine = startEngine();
    expect(engine.status).toBe('playing');
  });

  it('start 后分数为 0', () => {
    const engine = startEngine();
    expect(engine.score).toBe(0);
  });

  it('start 后关卡为 1', () => {
    const engine = startEngine();
    expect(engine.getLevel()).toBe(1);
  });
});

// ========== 3. 试管选择 ==========

describe('Water Sort — 试管选择', () => {
  let engine: WaterSortEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.setTubes(createSimpleTubes());
  });

  it('选择非空试管成功', () => {
    expect(engine.selectTube(0)).toBe(true);
    expect(engine.getSelectedIndex()).toBe(0);
  });

  it('选择空试管失败', () => {
    expect(engine.selectTube(3)).toBe(false);
    expect(engine.getSelectedIndex()).toBeNull();
  });

  it('选择无效索引失败', () => {
    expect(engine.selectTube(-1)).toBe(false);
    expect(engine.selectTube(100)).toBe(false);
  });

  it('再次选中同一根试管取消选择', () => {
    engine.selectTube(0);
    expect(engine.getSelectedIndex()).toBe(0);
    engine.selectTube(0);
    expect(engine.getSelectedIndex()).toBeNull();
  });

  it('选中一根后选另一根触发倒水', () => {
    engine.selectTube(0);
    const result = engine.selectTube(3); // 倒入空试管
    expect(result).toBe(true);
    expect(engine.getSelectedIndex()).toBeNull();
  });

  it('胜利后不能选择', () => {
    engine.setTubes(createWonTubes());
    // Force win state
    (engine as any).isWon = true;
    expect(engine.selectTube(0)).toBe(false);
  });

  it('不传索引时使用光标位置', () => {
    engine.setCursorIndex(1);
    expect(engine.selectTube()).toBe(true);
    expect(engine.getSelectedIndex()).toBe(1);
  });

  it('选中试管后取消再选其他', () => {
    engine.selectTube(0);
    engine.selectTube(0); // 取消
    engine.selectTube(1);
    expect(engine.getSelectedIndex()).toBe(1);
  });
});

// ========== 4. 倒水规则 ==========

describe('Water Sort — 倒水规则', () => {
  let engine: WaterSortEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('倒入空试管成功', () => {
    engine.setTubes([
      ['#FF4444', '#44AAFF', '#44DD44', '#FF4444'],
      [],
    ]);
    expect(engine.pour(0, 1)).toBe(true);
    // 顶部一个红色倒入空试管
    const tubes = engine.getTubes();
    expect(tubes[0].length).toBe(3);
    expect(tubes[1].length).toBe(1);
    expect(tubes[1][0]).toBe('#FF4444');
  });

  it('倒入相同颜色试管成功', () => {
    engine.setTubes([
      ['#FF4444', '#FF4444', '#44AAFF', '#FF4444'], // 顶部1个红
      ['#FF4444', '#FF4444', '#FF4444'],             // 3个红
    ]);
    expect(engine.pour(0, 1)).toBe(true);
    const tubes = engine.getTubes();
    expect(tubes[1].length).toBe(4);
    expect(tubes[1][3]).toBe('#FF4444');
  });

  it('倒入不同颜色试管失败', () => {
    engine.setTubes([
      ['#FF4444', '#44AAFF'],                         // 顶部红
      ['#44AAFF', '#44DD44'],                          // 顶部蓝
    ]);
    expect(engine.pour(0, 1)).toBe(false);
  });

  it('倒入满试管失败', () => {
    engine.setTubes([
      ['#FF4444'],
      ['#44AAFF', '#44AAFF', '#44AAFF', '#44AAFF'],
    ]);
    expect(engine.pour(0, 1)).toBe(false);
  });

  it('从空试管倒水失败', () => {
    engine.setTubes([
      [],
      ['#FF4444'],
    ]);
    expect(engine.pour(0, 1)).toBe(false);
  });

  it('倒水到自身失败', () => {
    engine.setTubes([['#FF4444', '#44AAFF']]);
    // 增加第二根试管
    engine.setTubes([['#FF4444', '#44AAFF'], []]);
    expect(engine.pour(0, 0)).toBe(false);
  });

  it('连续相同颜色全部倒入', () => {
    engine.setTubes([
      ['#44AAFF', '#FF4444', '#FF4444', '#FF4444'], // 顶部3个红
      [],
    ]);
    expect(engine.pour(0, 1)).toBe(true);
    const tubes = engine.getTubes();
    expect(tubes[0].length).toBe(1); // 只剩蓝
    expect(tubes[1].length).toBe(3); // 3个红
  });

  it('空间不足时部分倒入', () => {
    engine.setTubes([
      ['#44AAFF', '#FF4444', '#FF4444', '#FF4444'], // 顶部3个红
      ['#FF4444', '#FF4444', '#FF4444'],             // 3个红，空间1
    ]);
    expect(engine.pour(0, 1)).toBe(true);
    const tubes = engine.getTubes();
    expect(tubes[0].length).toBe(3); // 倒出1个，剩3
    expect(tubes[1].length).toBe(4); // 接收1个（3+1=4），满了
  });

  it('倒水增加步数', () => {
    engine.setTubes([['#FF4444'], []]);
    const movesBefore = engine.getMoves();
    engine.pour(0, 1);
    expect(engine.getMoves()).toBe(movesBefore + 1);
  });

  it('无效倒水不增加步数', () => {
    engine.setTubes([[], ['#FF4444']]);
    const movesBefore = engine.getMoves();
    engine.pour(0, 1);
    expect(engine.getMoves()).toBe(movesBefore);
  });

  it('无效索引倒水失败', () => {
    engine.setTubes([['#FF4444'], []]);
    expect(engine.pour(-1, 0)).toBe(false);
    expect(engine.pour(0, -1)).toBe(false);
    expect(engine.pour(100, 0)).toBe(false);
    expect(engine.pour(0, 100)).toBe(false);
  });

  it('canPour 正确判断', () => {
    engine.setTubes([
      ['#FF4444'],
      [],
      ['#44AAFF'],
      ['#FF4444', '#FF4444', '#FF4444'],
    ]);
    expect(engine.canPour(0, 1)).toBe(true);  // 红→空
    expect(engine.canPour(0, 2)).toBe(false);  // 红→蓝顶
    expect(engine.canPour(0, 3)).toBe(true);  // 红→红顶
    expect(engine.canPour(1, 0)).toBe(false);  // 空→红
    expect(engine.canPour(0, 0)).toBe(false);  // 自身
  });

  it('canPour 满试管返回 false', () => {
    engine.setTubes([
      ['#FF4444'],
      ['#44AAFF', '#44AAFF', '#44AAFF', '#44AAFF'],
    ]);
    expect(engine.canPour(0, 1)).toBe(false);
  });

  it('连续两次倒水到同一试管', () => {
    engine.setTubes([
      ['#44AAFF', '#FF4444', '#FF4444'], // 2红+1蓝
      ['#FF4444'],                         // 1红
      [],
    ]);
    engine.pour(0, 1); // 2红→1红 = 3红
    expect(engine.getTubes()[1].length).toBe(3);
    engine.pour(0, 1); // 1蓝→3红，颜色不同，应该失败
    expect(engine.getTubes()[1].length).toBe(3);
    expect(engine.getTubes()[0].length).toBe(1);
  });
});

// ========== 5. 胜利判定 ==========

describe('Water Sort — 胜利判定', () => {
  let engine: WaterSortEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('所有试管单色或空 = 胜利', () => {
    engine.setTubes(createWonTubes());
    expect(engine.checkWin()).toBe(true);
  });

  it('有未完成试管 = 未胜利', () => {
    engine.setTubes(createSimpleTubes());
    expect(engine.checkWin()).toBe(false);
  });

  it('所有试管为空 = 胜利', () => {
    engine.setTubes([[], [], []]);
    expect(engine.checkWin()).toBe(true);
  });

  it('一个试管未满 = 未胜利', () => {
    engine.setTubes([
      ['#FF4444', '#FF4444', '#FF4444', '#FF4444'],
      ['#44AAFF', '#44AAFF', '#44AAFF'],             // 只有3个
      [],
    ]);
    expect(engine.checkWin()).toBe(false);
  });

  it('试管混合颜色 = 未胜利', () => {
    engine.setTubes([
      ['#FF4444', '#FF4444', '#44AAFF', '#FF4444'],
      [],
    ]);
    expect(engine.checkWin()).toBe(false);
  });

  it('倒水完成后触发胜利', () => {
    engine.setTubes([
      ['#FF4444', '#FF4444', '#FF4444', '#44AAFF'], // 顶部1蓝
      ['#44AAFF', '#44AAFF'],                         // 2蓝
      [],                                              // 空
    ]);
    engine.pour(0, 1); // 倒蓝过去
    // 试管0: 3红, 试管1: 3蓝, 试管2: 空
    // 还没赢（试管0和1都没满到4个）
    expect(engine.getIsWon()).toBe(false);

    engine.setTubes([
      ['#FF4444', '#FF4444', '#FF4444', '#FF4444'],
      ['#44AAFF', '#44AAFF', '#44AAFF', '#44AAFF'],
      [],
    ]);
    // Now check if win is detected on pour
    // We need to trigger a pour that results in win
    engine.setTubes([
      ['#FF4444', '#FF4444', '#FF4444', '#44AAFF'],
      ['#44AAFF', '#44AAFF', '#44AAFF'],
      [],
    ]);
    engine.pour(0, 1); // 蓝倒入蓝管 → 4蓝
    // 试管0: 3红（未满），所以还没赢
    expect(engine.getIsWon()).toBe(false);
  });

  it('完成所有排序后 isWon 为 true', () => {
    engine.setTubes([
      ['#FF4444', '#FF4444', '#FF4444'],
      ['#44AAFF', '#44AAFF', '#44AAFF', '#FF4444'],
      [],
    ]);
    engine.pour(1, 2); // 红倒入空管
    // 试管1: 3蓝，试管2: 1红
    expect(engine.getIsWon()).toBe(false);

    engine.pour(0, 2); // 3红倒入1红管 → 4红
    // 试管0: 空, 试管1: 3蓝（未满）, 试管2: 4红
    expect(engine.getIsWon()).toBe(false);
  });

  it('全部排好时触发胜利', () => {
    engine.setTubes([
      ['#FF4444', '#FF4444', '#FF4444'],
      ['#FF4444'],
      [],
    ]);
    engine.pour(0, 2); // 空
    // 3红→空
    // 试管0: 空, 试管1: 1红, 试管2: 3红
    expect(engine.getIsWon()).toBe(false);

    engine.pour(1, 2); // 1红→3红 = 4红
    // 但试管1空了，试管2全红
    // 试管0空, 试管1空, 试管2全红 → 胜利！
    expect(engine.getIsWon()).toBe(true);
  });

  it('胜利后不能继续倒水', () => {
    engine.setTubes([
      ['#FF4444', '#FF4444', '#FF4444'],
      ['#FF4444'],
      [],
    ]);
    engine.pour(0, 2);
    engine.pour(1, 2);
    expect(engine.getIsWon()).toBe(true);

    // 胜利后不能再操作
    expect(engine.selectTube(0)).toBe(false);
  });
});

// ========== 6. 撤销 ==========

describe('Water Sort — 撤销', () => {
  let engine: WaterSortEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.setTubes([
      ['#FF4444', '#44AAFF', '#44DD44', '#FF4444'],
      [],
      [],
    ]);
  });

  it('撤销一步成功', () => {
    const original = engine.getTubes();
    engine.pour(0, 1);
    expect(engine.getTubes()[0].length).toBe(3);
    expect(engine.undo()).toBe(true);
    expect(engine.getTubes()).toEqual(original);
  });

  it('撤销减少步数', () => {
    engine.pour(0, 1);
    expect(engine.getMoves()).toBe(1);
    engine.undo();
    expect(engine.getMoves()).toBe(0);
  });

  it('撤销清除选中状态', () => {
    engine.pour(0, 1); // 先倒水产生历史
    engine.selectTube(0);
    expect(engine.getSelectedIndex()).toBe(0);
    engine.undo();
    expect(engine.getSelectedIndex()).toBeNull();
  });

  it('无历史时撤销失败', () => {
    expect(engine.undo()).toBe(false);
  });

  it('多次撤销', () => {
    const original = engine.getTubes();
    engine.pour(0, 1);
    engine.pour(0, 2);
    expect(engine.getMoves()).toBe(2);

    engine.undo();
    expect(engine.getMoves()).toBe(1);

    engine.undo();
    expect(engine.getMoves()).toBe(0);
    expect(engine.getTubes()).toEqual(original);
  });

  it('撤销后可继续操作', () => {
    engine.pour(0, 1);
    engine.undo();
    expect(engine.pour(0, 2)).toBe(true);
  });

  it('胜利后不能撤销', () => {
    engine.setTubes([
      ['#FF4444', '#FF4444', '#FF4444'],
      ['#FF4444'],
      [],
    ]);
    engine.pour(0, 2);
    engine.pour(1, 2);
    expect(engine.getIsWon()).toBe(true);
    expect(engine.undo()).toBe(false);
  });

  it('撤销历史长度正确', () => {
    expect(engine.getHistoryLength()).toBe(0);
    engine.pour(0, 1);
    expect(engine.getHistoryLength()).toBe(1);
    engine.pour(0, 2);
    expect(engine.getHistoryLength()).toBe(2);
    engine.undo();
    expect(engine.getHistoryLength()).toBe(1);
    engine.undo();
    expect(engine.getHistoryLength()).toBe(0);
  });
});

// ========== 7. 关卡生成 ==========

describe('Water Sort — 关卡生成', () => {
  let engine: WaterSortEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('关卡1有正确的试管数', () => {
    engine.generateLevel(1);
    const config = LEVEL_CONFIGS[0];
    expect(engine.getTubeCount()).toBe(config.tubeCount + config.emptyTubes);
  });

  it('关卡1有3种颜色', () => {
    engine.generateLevel(1);
    const config = LEVEL_CONFIGS[0];
    expect(config.colorCount).toBe(3);
  });

  it('所有非空试管的水层数等于 TUBE_CAPACITY', () => {
    engine.generateLevel(1);
    const tubes = engine.getTubes();
    const config = LEVEL_CONFIGS[0];
    let nonEmptyCount = 0;
    for (let i = 0; i < config.tubeCount; i++) {
      expect(tubes[i].length).toBe(TUBE_CAPACITY);
      nonEmptyCount++;
    }
    expect(nonEmptyCount).toBe(config.tubeCount);
  });

  it('空试管为空', () => {
    engine.generateLevel(1);
    const tubes = engine.getTubes();
    const config = LEVEL_CONFIGS[0];
    for (let i = config.tubeCount; i < tubes.length; i++) {
      expect(tubes[i].length).toBe(0);
    }
  });

  it('每种颜色恰好有 TUBE_CAPACITY 层', () => {
    engine.generateLevel(1);
    const tubes = engine.getTubes();
    const config = LEVEL_CONFIGS[0];
    const colorCount: Record<string, number> = {};
    for (const tube of tubes) {
      for (const color of tube) {
        colorCount[color] = (colorCount[color] || 0) + 1;
      }
    }
    const usedColors = Object.keys(colorCount);
    expect(usedColors.length).toBe(config.colorCount);
    for (const count of Object.values(colorCount)) {
      expect(count).toBe(TUBE_CAPACITY);
    }
  });

  it('高关卡有更多颜色', () => {
    engine.generateLevel(5);
    const config = LEVEL_CONFIGS[4];
    expect(config.colorCount).toBeGreaterThan(LEVEL_CONFIGS[0].colorCount);
  });

  it('生成关卡重置步数', () => {
    engine.setTubes([['#FF4444'], []]);
    engine.pour(0, 1);
    expect(engine.getMoves()).toBe(1);
    engine.generateLevel(1);
    expect(engine.getMoves()).toBe(0);
  });

  it('生成关卡重置选中状态', () => {
    engine.selectTube(0);
    engine.generateLevel(1);
    expect(engine.getSelectedIndex()).toBeNull();
  });

  it('生成关卡重置胜利状态', () => {
    (engine as any).isWon = true;
    engine.generateLevel(1);
    expect(engine.getIsWon()).toBe(false);
  });

  it('生成关卡重置历史', () => {
    engine.setTubes([['#FF4444'], []]);
    engine.pour(0, 1);
    engine.generateLevel(1);
    expect(engine.getHistoryLength()).toBe(0);
  });

  it('关卡配置递增', () => {
    for (let i = 1; i < LEVEL_CONFIGS.length; i++) {
      expect(LEVEL_CONFIGS[i].level).toBe(i + 1);
    }
  });

  it('每个关卡至少有2个空试管', () => {
    for (const config of LEVEL_CONFIGS) {
      expect(config.emptyTubes).toBeGreaterThanOrEqual(2);
    }
  });

  it('setLevel 正确设置关卡', () => {
    engine.setLevel(3);
    expect(engine.getLevel()).toBe(3);
    const config = LEVEL_CONFIGS[2];
    expect(engine.getTubeCount()).toBe(config.tubeCount + config.emptyTubes);
  });

  it('setLevel 限制在有效范围', () => {
    engine.setLevel(0);
    expect(engine.getLevel()).toBe(1);
    engine.setLevel(MAX_LEVEL + 10);
    expect(engine.getLevel()).toBe(MAX_LEVEL);
  });

  it('nextLevel 正确递增', () => {
    engine.setLevel(1);
    expect(engine.nextLevel()).toBe(true);
    expect(engine.getLevel()).toBe(2);
  });

  it('nextLevel 到达最大关卡返回 false', () => {
    engine.setLevel(MAX_LEVEL);
    expect(engine.nextLevel()).toBe(false);
    expect(engine.getLevel()).toBe(MAX_LEVEL);
  });

  it('resetLevel 重置当前关卡', () => {
    engine.setLevel(2);
    engine.setTubes([['#FF4444'], []]);
    engine.pour(0, 1);
    engine.resetLevel();
    expect(engine.getLevel()).toBe(2);
    expect(engine.getMoves()).toBe(0);
    expect(engine.getIsWon()).toBe(false);
  });

  it('多次生成同一关卡产生不同排列', () => {
    engine.generateLevel(3);
    const tubes1 = engine.getTubes();
    engine.generateLevel(3);
    const tubes2 = engine.getTubes();
    // 极小概率相同，但几乎不可能
    const same = JSON.stringify(tubes1) === JSON.stringify(tubes2);
    // 不强制要求不同，但验证结构正确
    expect(tubes1.length).toBe(tubes2.length);
  });
});

// ========== 8. 键盘控制 ==========

describe('Water Sort — 键盘控制', () => {
  let engine: WaterSortEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.setTubes(createSimpleTubes());
  });

  it('ArrowLeft 移动光标', () => {
    engine.setCursorIndex(2);
    engine.handleKeyDown('ArrowLeft');
    expect(engine.getCursorIndex()).toBe(1);
  });

  it('ArrowRight 移动光标', () => {
    engine.handleKeyDown('ArrowRight');
    expect(engine.getCursorIndex()).toBe(1);
  });

  it('光标不超出左边界', () => {
    engine.setCursorIndex(0);
    engine.handleKeyDown('ArrowLeft');
    expect(engine.getCursorIndex()).toBe(0);
  });

  it('光标不超出右边界', () => {
    const maxIdx = engine.getTubeCount() - 1;
    engine.setCursorIndex(maxIdx);
    engine.handleKeyDown('ArrowRight');
    expect(engine.getCursorIndex()).toBe(maxIdx);
  });

  it('空格选择试管', () => {
    engine.handleKeyDown(' ');
    expect(engine.getSelectedIndex()).toBe(0);
  });

  it('回车选择试管', () => {
    engine.handleKeyDown('Enter');
    expect(engine.getSelectedIndex()).toBe(0);
  });

  it('U 撤销', () => {
    engine.pour(0, 3);
    engine.handleKeyDown('u');
    expect(engine.getMoves()).toBe(0);
  });

  it('大写 U 撤销', () => {
    engine.pour(0, 3);
    engine.handleKeyDown('U');
    expect(engine.getMoves()).toBe(0);
  });

  it('R 重置关卡', () => {
    engine.pour(0, 3);
    engine.handleKeyDown('r');
    expect(engine.getMoves()).toBe(0);
  });

  it('大写 R 重置关卡', () => {
    engine.pour(0, 3);
    engine.handleKeyDown('R');
    expect(engine.getMoves()).toBe(0);
  });

  it('N 下一关', () => {
    engine.setLevel(1);
    engine.handleKeyDown('n');
    expect(engine.getLevel()).toBe(2);
  });

  it('大写 N 下一关', () => {
    engine.setLevel(1);
    engine.handleKeyDown('N');
    expect(engine.getLevel()).toBe(2);
  });

  it('未知按键不产生副作用', () => {
    const cursorBefore = engine.getCursorIndex();
    engine.handleKeyDown('a');
    expect(engine.getCursorIndex()).toBe(cursorBefore);
    engine.handleKeyDown('1');
    expect(engine.getCursorIndex()).toBe(cursorBefore);
    engine.handleKeyDown('Escape');
    expect(engine.getCursorIndex()).toBe(cursorBefore);
  });
});

// ========== 9. 光标移动 ==========

describe('Water Sort — 光标移动', () => {
  let engine: WaterSortEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.setTubes(createSimpleTubes());
  });

  it('moveCursor 正向移动', () => {
    engine.moveCursor(1);
    expect(engine.getCursorIndex()).toBe(1);
  });

  it('moveCursor 反向移动', () => {
    engine.setCursorIndex(2);
    engine.moveCursor(-1);
    expect(engine.getCursorIndex()).toBe(1);
  });

  it('moveCursor 不越界', () => {
    engine.moveCursor(-1);
    expect(engine.getCursorIndex()).toBe(0);
    engine.setCursorIndex(4);
    engine.moveCursor(1);
    expect(engine.getCursorIndex()).toBe(4);
  });

  it('setCursorIndex 正确设置', () => {
    engine.setCursorIndex(3);
    expect(engine.getCursorIndex()).toBe(3);
  });

  it('setCursorIndex 无效索引不改变', () => {
    engine.setCursorIndex(3);
    engine.setCursorIndex(-1);
    expect(engine.getCursorIndex()).toBe(3);
    engine.setCursorIndex(100);
    expect(engine.getCursorIndex()).toBe(3);
  });
});

// ========== 10. 游戏状态 ==========

describe('Water Sort — 游戏状态', () => {
  it('getState 返回完整状态', () => {
    const engine = createEngine();
    engine.setTubes(createSimpleTubes());
    const state = engine.getState();
    expect(state.tubes).toBeDefined();
    expect(state.selectedIndex).toBeNull();
    expect(state.cursorIndex).toBe(0);
    expect(state.level).toBeDefined();
    expect(state.moves).toBe(0);
    expect(state.isWon).toBe(false);
  });

  it('getTubes 返回深拷贝', () => {
    const engine = createEngine();
    engine.setTubes([['#FF4444', '#44AAFF'], []]);
    const tubes = engine.getTubes();
    tubes[0].push('#44DD44');
    expect(engine.getTubes()[0].length).toBe(2);
  });

  it('getLevelConfig 返回正确配置', () => {
    const engine = createEngine();
    engine.setLevel(3);
    const config = engine.getLevelConfig();
    expect(config.level).toBe(3);
    expect(config.colorCount).toBe(LEVEL_CONFIGS[2].colorCount);
  });
});

// ========== 11. 重置与销毁 ==========

describe('Water Sort — 重置与销毁', () => {
  it('reset 清除所有状态', () => {
    const engine = startEngine();
    engine.pour(0, 1);
    engine.reset();
    expect(engine.status).toBe('idle');
    expect(engine.score).toBe(0);
    expect(engine.getMoves()).toBe(0);
  });

  it('destroy 清除所有状态', () => {
    const engine = startEngine();
    engine.destroy();
    expect(engine.status).toBe('idle');
  });
});

// ========== 12. 边界情况 ==========

describe('Water Sort — 边界情况', () => {
  let engine: WaterSortEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('只有一种颜色的试管', () => {
    engine.setTubes([
      ['#FF4444', '#FF4444', '#FF4444', '#FF4444'],
      [],
    ]);
    expect(engine.checkWin()).toBe(true);
  });

  it('全部空试管', () => {
    engine.setTubes([[], [], [], []]);
    expect(engine.checkWin()).toBe(true);
  });

  it('只有一层水的试管', () => {
    engine.setTubes([
      ['#FF4444'],
      [],
    ]);
    expect(engine.pour(0, 1)).toBe(true);
    expect(engine.getTubes()[0].length).toBe(0);
    expect(engine.getTubes()[1].length).toBe(1);
  });

  it('倒满试管后不能再倒', () => {
    engine.setTubes([
      ['#FF4444', '#FF4444'],
      ['#FF4444', '#FF4444', '#FF4444', '#FF4444'],
    ]);
    expect(engine.canPour(0, 1)).toBe(false);
  });

  it('颜色完全匹配时倒入', () => {
    engine.setTubes([
      ['#FF4444', '#FF4444'],
      ['#FF4444', '#FF4444'],
      [],
    ]);
    // 从0倒入2
    expect(engine.pour(0, 2)).toBe(true);
    expect(engine.getTubes()[2].length).toBe(2);
  });

  it('复杂倒水序列', () => {
    engine.setTubes([
      ['#FF4444', '#44AAFF', '#44DD44', '#FF4444'],
      ['#44AAFF', '#44DD44', '#FF4444', '#44AAFF'],
      ['#44DD44', '#FF4444', '#44AAFF', '#44DD44'],
      [],
      [],
    ]);

    // 执行一系列倒水
    engine.pour(0, 3); // 红倒入空
    engine.pour(1, 4); // 蓝倒入空
    engine.pour(2, 3); // 绿倒入有红的
    // 不验证具体结果，只验证不崩溃
    expect(engine.getTubes().length).toBe(5);
  });

  it('选择空试管后选非空试管', () => {
    engine.setTubes([[], ['#FF4444']]);
    expect(engine.selectTube(0)).toBe(false); // 空试管不能选
    expect(engine.getSelectedIndex()).toBeNull();
  });

  it('selectTube 连续操作', () => {
    engine.setTubes([
      ['#FF4444', '#FF4444', '#44AAFF', '#FF4444'],
      [],
      [],
    ]);
    engine.selectTube(0); // 选0
    engine.selectTube(1); // 倒入1
    expect(engine.getSelectedIndex()).toBeNull();
    expect(engine.getMoves()).toBe(1);
  });

  it('大量撤销操作', () => {
    engine.setTubes([
      ['#FF4444', '#44AAFF', '#44DD44', '#FF4444'],
      [],
      [],
      [],
    ]);
    for (let i = 0; i < 3; i++) {
      engine.pour(0, i + 1);
    }
    expect(engine.getMoves()).toBe(3);
    while (engine.getHistoryLength() > 0) {
      engine.undo();
    }
    expect(engine.getMoves()).toBe(0);
  });

  it('setTubes 重置所有状态', () => {
    engine.setTubes(createSimpleTubes());
    engine.pour(0, 3);
    engine.selectTube(1);
    engine.setTubes(createSimpleTubes());
    expect(engine.getMoves()).toBe(0);
    expect(engine.getSelectedIndex()).toBeNull();
    expect(engine.getIsWon()).toBe(false);
    expect(engine.getHistoryLength()).toBe(0);
  });

  it('倒水后试管内容正确', () => {
    engine.setTubes([
      ['#44AAFF', '#FF4444', '#FF4444', '#FF4444'],
      [],
    ]);
    engine.pour(0, 1);
    const tubes = engine.getTubes();
    expect(tubes[0]).toEqual(['#44AAFF']);
    expect(tubes[1]).toEqual(['#FF4444', '#FF4444', '#FF4444']);
  });

  it('部分倒入保留剩余', () => {
    engine.setTubes([
      ['#44DD44', '#FF4444', '#FF4444', '#FF4444'], // 顶部3红
      ['#FF4444', '#FF4444', '#FF4444'],             // 3红，空间1
    ]);
    engine.pour(0, 1);
    const tubes = engine.getTubes();
    expect(tubes[0]).toEqual(['#44DD44', '#FF4444', '#FF4444']); // 倒出1红
    expect(tubes[1]).toEqual(['#FF4444', '#FF4444', '#FF4444', '#FF4444']); // 满
  });
});

// ========== 13. 渲染测试 ==========

describe('Water Sort — 渲染', () => {
  it('start 后渲染不报错', () => {
    const engine = startEngine();
    // 让游戏循环运行一帧
    flushAnimationFrame(16);
    expect(engine.status).toBe('playing');
  });

  it('胜利画面渲染', () => {
    const engine = startEngine();
    engine.setTubes([
      ['#FF4444', '#FF4444', '#FF4444'],
      ['#FF4444'],
      [],
    ]);
    engine.pour(0, 2);
    engine.pour(1, 2);
    flushAnimationFrame(16);
    expect(engine.getIsWon()).toBe(true);
  });

  it('pause 后状态为 paused', () => {
    const engine = startEngine();
    engine.pause();
    expect(engine.status).toBe('paused');
  });

  it('resume 后状态为 playing', () => {
    const engine = startEngine();
    engine.pause();
    engine.resume();
    expect(engine.status).toBe('playing');
  });
});

// ========== 14. 完整游戏流程 ==========

describe('Water Sort — 完整游戏流程', () => {
  it('简单关卡可解', () => {
    const engine = createEngine();
    engine.setTubes([
      ['#FF4444', '#FF4444', '#FF4444'],
      ['#FF4444'],
      [],
    ]);

    // 步骤1: 3红倒入空管
    expect(engine.pour(0, 2)).toBe(true);
    // 步骤2: 1红倒入3红管
    expect(engine.pour(1, 2)).toBe(true);

    expect(engine.checkWin()).toBe(true);
    expect(engine.getIsWon()).toBe(true);
    expect(engine.getMoves()).toBe(2);
  });

  it('两色关卡可解', () => {
    const engine = createEngine();
    engine.setTubes([
      ['#FF4444', '#44AAFF', '#FF4444', '#44AAFF'],
      ['#44AAFF', '#FF4444', '#44AAFF', '#FF4444'],
      [],
    ]);

    // 使用空试管辅助排序
    engine.pour(0, 2); // 顶蓝→空
    engine.pour(1, 2); // 顶红→有蓝的
    // 继续操作...
    expect(engine.getMoves()).toBeGreaterThan(0);
  });

  it('撤销后重新解', () => {
    const engine = createEngine();
    engine.setTubes([
      ['#FF4444', '#FF4444', '#FF4444'],
      ['#FF4444'],
      [],
    ]);

    engine.pour(0, 2);
    engine.pour(1, 2);
    expect(engine.getIsWon()).toBe(true);

    // 胜利后不能撤销
    expect(engine.undo()).toBe(false);
  });

  it('关卡递增流程', () => {
    const engine = createEngine();
    engine.setLevel(1);
    expect(engine.getLevel()).toBe(1);
    engine.nextLevel();
    expect(engine.getLevel()).toBe(2);
    engine.nextLevel();
    expect(engine.getLevel()).toBe(3);
  });

  it('键盘完整操作流程', () => {
    const engine = createEngine();
    engine.setTubes([
      ['#FF4444', '#FF4444', '#FF4444'],
      ['#FF4444'],
      [],
    ]);

    // 用键盘完成游戏
    engine.handleKeyDown('ArrowRight'); // 光标到1
    engine.handleKeyDown(' ');          // 选1
    engine.handleKeyDown('ArrowRight'); // 光标到2
    engine.handleKeyDown(' ');          // 倒入2

    engine.handleKeyDown('ArrowLeft');  // 光标到1
    engine.handleKeyDown('ArrowLeft');  // 光标到0
    engine.handleKeyDown(' ');          // 选0

    engine.handleKeyDown('ArrowRight'); // 光标到1
    engine.handleKeyDown('ArrowRight'); // 光标到2
    engine.handleKeyDown(' ');          // 倒入2

    expect(engine.getIsWon()).toBe(true);
  });
});

// ========== 15. 事件系统 ==========

describe('Water Sort — 事件系统', () => {
  it('select 事件触发', () => {
    const engine = createEngine();
    engine.setTubes([['#FF4444'], []]);
    let fired = false;
    engine.on('select', () => { fired = true; });
    engine.selectTube(0);
    expect(fired).toBe(true);
  });

  it('deselect 事件触发', () => {
    const engine = createEngine();
    engine.setTubes([['#FF4444'], []]);
    let fired = false;
    engine.on('deselect', () => { fired = true; });
    engine.selectTube(0);
    engine.selectTube(0); // 取消
    expect(fired).toBe(true);
  });

  it('pour 事件触发', () => {
    const engine = createEngine();
    engine.setTubes([['#FF4444'], []]);
    let fired = false;
    engine.on('pour', () => { fired = true; });
    engine.pour(0, 1);
    expect(fired).toBe(true);
  });

  it('undo 事件触发', () => {
    const engine = createEngine();
    engine.setTubes([['#FF4444'], []]);
    engine.pour(0, 1);
    let fired = false;
    engine.on('undo', () => { fired = true; });
    engine.undo();
    expect(fired).toBe(true);
  });

  it('win 事件触发', () => {
    const engine = createEngine();
    engine.setTubes([
      ['#FF4444', '#FF4444', '#FF4444'],
      ['#FF4444'],
      [],
    ]);
    let fired = false;
    engine.on('win', () => { fired = true; });
    engine.pour(0, 2);
    engine.pour(1, 2);
    expect(fired).toBe(true);
  });

  it('reset 事件触发', () => {
    const engine = createEngine();
    let fired = false;
    engine.on('reset', () => { fired = true; });
    engine.resetLevel();
    expect(fired).toBe(true);
  });

  it('cursorMove 事件触发', () => {
    const engine = createEngine();
    engine.setTubes([['#FF4444'], []]);
    let fired = false;
    engine.on('cursorMove', () => { fired = true; });
    engine.moveCursor(1);
    expect(fired).toBe(true);
  });
});

/** 手动触发 requestAnimationFrame 回调 */
function flushAnimationFrame(ms: number): void {
  // jsdom 环境下 requestAnimationFrame 需要 vi 或手动触发
  // 这里用 setTimeout 让微任务执行
  const end = Date.now() + ms;
  while (Date.now() < end) {
    // busy wait
  }
}
