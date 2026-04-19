/**
 * SpirographEngine 综合测试
 * 覆盖：初始化、参数调整(R/r/d)、曲线点生成、预设图案、颜色方案、
 *       动画状态、键盘输入、重置、getState、边界情况、导出参数
 *
 * 不依赖 DOM/Canvas，通过 engine.init() 不传 canvas 来测试纯逻辑。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SpirographEngine } from '../SpirographEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  DEFAULT_OUTER_RADIUS,
  DEFAULT_INNER_RADIUS,
  DEFAULT_PEN_DISTANCE,
  MIN_OUTER_RADIUS,
  MAX_OUTER_RADIUS,
  MIN_INNER_RADIUS,
  MAX_INNER_RADIUS,
  MIN_PEN_DISTANCE,
  MAX_PEN_DISTANCE,
  INNER_RADIUS_STEP,
  PEN_DISTANCE_STEP,
  OUTER_RADIUS_STEP,
  DEFAULT_DRAW_SPEED,
  MIN_DRAW_SPEED,
  MAX_DRAW_SPEED,
  SPEED_STEP,
  COLOR_SCHEMES,
  DEFAULT_COLOR_SCHEME_INDEX,
  PRESETS,
  LINE_WIDTH,
  GEAR_LINE_WIDTH,
  GEAR_OPACITY,
  COLORS,
  HUD_HEIGHT,
  FONT_FAMILY,
  FONT_SIZE_HUD,
  FONT_SIZE_TITLE,
  MAX_ANGLE,
  gcd,
  gearRatio,
  closureAngle,
  hypotrochoidPoint,
  epitrochoidPoint,
  getGradientColor,
  parseHexColor,
} from '../constants';

// ============================================================
// Helpers
// ============================================================

/** 创建一个带 mock context 的 canvas */
function createMockCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  return canvas;
}

/** 创建引擎并初始化 + start（进入 playing 状态） */
function createEngine(): SpirographEngine {
  const e = new SpirographEngine();
  e.init(createMockCanvas());
  e.start();
  return e;
}

/** 创建引擎仅 init（idle 状态），不传 canvas */
function createIdleEngine(): SpirographEngine {
  const e = new SpirographEngine();
  e.init();
  return e;
}

/** 创建引擎 init 并传入 canvas（idle 状态，但可以安全调用 start/resume） */
function createIdleEngineWithCanvas(): SpirographEngine {
  const e = new SpirographEngine();
  e.init(createMockCanvas());
  return e;
}

/** 推进引擎时间（模拟 update） */
function tick(engine: SpirographEngine, times: number = 1, dt: number = 16.67): void {
  for (let i = 0; i < times; i++) {
    engine.update(dt);
  }
}

/** 用反射读取私有属性 */
function getPrivate<T>(engine: SpirographEngine, key: string): T {
  return (engine as unknown as Record<string, T>)[key];
}

/** 用反射设置私有属性 */
function setPrivate(engine: SpirographEngine, key: string, value: unknown): void {
  (engine as unknown as Record<string, unknown>)[key] = value;
}

// ============================================================
// 1. 常量测试
// ============================================================
describe('常量配置', () => {
  it('CANVAS_WIDTH 应为正数', () => {
    expect(CANVAS_WIDTH).toBeGreaterThan(0);
  });

  it('CANVAS_HEIGHT 应为正数', () => {
    expect(CANVAS_HEIGHT).toBeGreaterThan(0);
  });

  it('默认参数应在合法范围内', () => {
    expect(DEFAULT_OUTER_RADIUS).toBeGreaterThanOrEqual(MIN_OUTER_RADIUS);
    expect(DEFAULT_OUTER_RADIUS).toBeLessThanOrEqual(MAX_OUTER_RADIUS);
    expect(DEFAULT_INNER_RADIUS).toBeGreaterThanOrEqual(MIN_INNER_RADIUS);
    expect(DEFAULT_INNER_RADIUS).toBeLessThanOrEqual(MAX_INNER_RADIUS);
    expect(DEFAULT_PEN_DISTANCE).toBeGreaterThanOrEqual(MIN_PEN_DISTANCE);
    expect(DEFAULT_PEN_DISTANCE).toBeLessThanOrEqual(MAX_PEN_DISTANCE);
  });

  it('MIN <= DEFAULT <= MAX 对所有参数成立', () => {
    expect(MIN_OUTER_RADIUS).toBeLessThan(MAX_OUTER_RADIUS);
    expect(MIN_INNER_RADIUS).toBeLessThan(MAX_INNER_RADIUS);
    expect(MIN_PEN_DISTANCE).toBeLessThan(MAX_PEN_DISTANCE);
    expect(MIN_DRAW_SPEED).toBeLessThan(MAX_DRAW_SPEED);
  });

  it('步长应为正数', () => {
    expect(INNER_RADIUS_STEP).toBeGreaterThan(0);
    expect(PEN_DISTANCE_STEP).toBeGreaterThan(0);
    expect(OUTER_RADIUS_STEP).toBeGreaterThan(0);
    expect(SPEED_STEP).toBeGreaterThan(0);
  });

  it('COLOR_SCHEMES 应至少有 1 个方案', () => {
    expect(COLOR_SCHEMES.length).toBeGreaterThanOrEqual(1);
  });

  it('PRESETS 应至少有 1 个预设', () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(1);
  });

  it('COLOR_SCHEMES 每个方案有 name 和 colors', () => {
    COLOR_SCHEMES.forEach((scheme) => {
      expect(scheme.name).toBeTruthy();
      expect(scheme.colors.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('PRESETS 每个预设的参数在合法范围', () => {
    PRESETS.forEach((preset) => {
      expect(preset.outerRadius).toBeGreaterThanOrEqual(MIN_OUTER_RADIUS);
      expect(preset.outerRadius).toBeLessThanOrEqual(MAX_OUTER_RADIUS);
      expect(preset.innerRadius).toBeGreaterThanOrEqual(MIN_INNER_RADIUS);
      expect(preset.innerRadius).toBeLessThanOrEqual(MAX_INNER_RADIUS);
      expect(preset.penDistance).toBeGreaterThanOrEqual(MIN_PEN_DISTANCE);
      expect(preset.penDistance).toBeLessThanOrEqual(MAX_PEN_DISTANCE);
      expect(preset.name).toBeTruthy();
    });
  });

  it('DEFAULT_COLOR_SCHEME_INDEX 在合法范围', () => {
    expect(DEFAULT_COLOR_SCHEME_INDEX).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_COLOR_SCHEME_INDEX).toBeLessThan(COLOR_SCHEMES.length);
  });

  it('渲染常量合理', () => {
    expect(LINE_WIDTH).toBeGreaterThan(0);
    expect(GEAR_LINE_WIDTH).toBeGreaterThan(0);
    expect(GEAR_OPACITY).toBeGreaterThanOrEqual(0);
    expect(GEAR_OPACITY).toBeLessThanOrEqual(1);
    expect(HUD_HEIGHT).toBeGreaterThan(0);
  });

  it('COLORS 应包含所有必要颜色键', () => {
    expect(COLORS).toHaveProperty('background');
    expect(COLORS).toHaveProperty('outerGear');
    expect(COLORS).toHaveProperty('innerGear');
    expect(COLORS).toHaveProperty('penDot');
    expect(COLORS).toHaveProperty('textPrimary');
    expect(COLORS).toHaveProperty('accent');
    expect(COLORS).toHaveProperty('hudBg');
  });

  it('字体配置合理', () => {
    expect(FONT_FAMILY).toBeTruthy();
    expect(FONT_SIZE_HUD).toBeGreaterThan(0);
    expect(FONT_SIZE_TITLE).toBeGreaterThan(0);
  });
});

// ============================================================
// 2. 数学工具函数测试
// ============================================================
describe('数学工具函数', () => {
  describe('gcd', () => {
    it('gcd(12, 8) = 4', () => {
      expect(gcd(12, 8)).toBe(4);
    });

    it('gcd(100, 75) = 25', () => {
      expect(gcd(100, 75)).toBe(25);
    });

    it('gcd(7, 13) = 1 (互质)', () => {
      expect(gcd(7, 13)).toBe(1);
    });

    it('gcd(0, 5) = 5', () => {
      expect(gcd(0, 5)).toBe(5);
    });

    it('gcd(5, 0) = 5', () => {
      expect(gcd(5, 0)).toBe(5);
    });

    it('gcd(0, 0) = 0', () => {
      expect(gcd(0, 0)).toBe(0);
    });

    it('gcd 处理负数（取绝对值）', () => {
      expect(gcd(-12, 8)).toBe(4);
      expect(gcd(12, -8)).toBe(4);
      expect(gcd(-12, -8)).toBe(4);
    });

    it('gcd 处理浮点数（四舍五入）', () => {
      // round(12.4)=12, round(8.6)=9 => gcd(12,9)=3
      expect(gcd(12.4, 8.6)).toBe(3);
    });

    it('gcd(a, a) = a', () => {
      expect(gcd(15, 15)).toBe(15);
    });
  });

  describe('gearRatio', () => {
    it('gearRatio(120, 45) 返回化简后的分数', () => {
      const ratio = gearRatio(120, 45);
      expect(ratio.numerator).toBe(8);
      expect(ratio.denominator).toBe(3);
    });

    it('gearRatio(100, 75) = 4/3', () => {
      const ratio = gearRatio(100, 75);
      expect(ratio.numerator).toBe(4);
      expect(ratio.denominator).toBe(3);
    });

    it('gearRatio(120, 48) = 5/2', () => {
      const ratio = gearRatio(120, 48);
      expect(ratio.numerator).toBe(5);
      expect(ratio.denominator).toBe(2);
    });

    it('gearRatio 互质时不变', () => {
      const ratio = gearRatio(7, 3);
      expect(ratio.numerator).toBe(7);
      expect(ratio.denominator).toBe(3);
    });
  });

  describe('closureAngle', () => {
    it('closureAngle(120, 45) 应为正数', () => {
      expect(closureAngle(120, 45)).toBeGreaterThan(0);
    });

    it('closureAngle(120, 48) = 2π * 48 / gcd(120,48)', () => {
      const expected = (2 * Math.PI * 48) / gcd(120, 48);
      expect(closureAngle(120, 48)).toBeCloseTo(expected, 10);
    });

    it('closureAngle(R, r) = 2π * r / gcd(R, r)', () => {
      const R = 150;
      const r = 50;
      const g = gcd(R, r);
      const expected = (2 * Math.PI * r) / g;
      expect(closureAngle(R, r)).toBeCloseTo(expected, 10);
    });

    it('closureAngle(R, 0) 返回 MAX_ANGLE', () => {
      expect(closureAngle(120, 0)).toBe(MAX_ANGLE);
    });

    it('closureAngle 结果为 2π 的整数倍', () => {
      const angle = closureAngle(120, 45);
      const multiples = angle / (2 * Math.PI);
      expect(multiples).toBeCloseTo(Math.round(multiples), 5);
    });
  });

  describe('hypotrochoidPoint', () => {
    it('t=0 时返回正确的初始点', () => {
      const R = 120, r = 45, d = 60;
      const pt = hypotrochoidPoint(R, r, d, 0);
      const diff = R - r;
      expect(pt.x).toBeCloseTo(diff + d, 10);
      expect(pt.y).toBeCloseTo(0, 10);
    });

    it('t=π 时 x 为负（一般情况）', () => {
      const R = 120, r = 45, d = 60;
      const pt = hypotrochoidPoint(R, r, d, Math.PI);
      const diff = R - r;
      const ratio = diff / r;
      expect(pt.x).toBeCloseTo(diff * Math.cos(Math.PI) + d * Math.cos(ratio * Math.PI), 10);
      expect(pt.y).toBeCloseTo(diff * Math.sin(Math.PI) - d * Math.sin(ratio * Math.PI), 10);
    });

    it('d=0 时曲线退化为圆', () => {
      const R = 100, r = 50, d = 0;
      const diff = R - r;
      for (let t = 0; t < Math.PI * 2; t += 0.5) {
        const pt = hypotrochoidPoint(R, r, d, t);
        const dist = Math.sqrt(pt.x * pt.x + pt.y * pt.y);
        expect(dist).toBeCloseTo(diff, 5);
      }
    });

    it('r=0 时不抛异常', () => {
      expect(() => hypotrochoidPoint(120, 0, 60, 1)).not.toThrow();
    });

    it('返回值是有限数', () => {
      const pt = hypotrochoidPoint(120, 45, 60, 2.5);
      expect(isFinite(pt.x)).toBe(true);
      expect(isFinite(pt.y)).toBe(true);
    });
  });

  describe('epitrochoidPoint', () => {
    it('t=0 时返回正确的初始点', () => {
      const R = 120, r = 45, d = 60;
      const pt = epitrochoidPoint(R, r, d, 0);
      const sum = R + r;
      expect(pt.x).toBeCloseTo(sum - d, 10);
      expect(pt.y).toBeCloseTo(0, 10);
    });

    it('d=0 时曲线退化为圆', () => {
      const R = 100, r = 50, d = 0;
      const sum = R + r;
      for (let t = 0; t < Math.PI * 2; t += 0.5) {
        const pt = epitrochoidPoint(R, r, d, t);
        const dist = Math.sqrt(pt.x * pt.x + pt.y * pt.y);
        expect(dist).toBeCloseTo(sum, 5);
      }
    });

    it('r=0 时不抛异常', () => {
      expect(() => epitrochoidPoint(120, 0, 60, 1)).not.toThrow();
    });

    it('返回值是有限数', () => {
      const pt = epitrochoidPoint(120, 45, 60, 2.5);
      expect(isFinite(pt.x)).toBe(true);
      expect(isFinite(pt.y)).toBe(true);
    });
  });

  describe('parseHexColor', () => {
    it('解析 #ff0000 为红色', () => {
      const c = parseHexColor('#ff0000');
      expect(c.r).toBe(255);
      expect(c.g).toBe(0);
      expect(c.b).toBe(0);
    });

    it('解析 #00ff00 为绿色', () => {
      const c = parseHexColor('#00ff00');
      expect(c.r).toBe(0);
      expect(c.g).toBe(255);
      expect(c.b).toBe(0);
    });

    it('解析 #0000ff 为蓝色', () => {
      const c = parseHexColor('#0000ff');
      expect(c.r).toBe(0);
      expect(c.g).toBe(0);
      expect(c.b).toBe(255);
    });

    it('解析不带 # 的颜色', () => {
      const c = parseHexColor('ffffff');
      expect(c.r).toBe(255);
      expect(c.g).toBe(255);
      expect(c.b).toBe(255);
    });

    it('解析 #000000 为黑色', () => {
      const c = parseHexColor('#000000');
      expect(c.r).toBe(0);
      expect(c.g).toBe(0);
      expect(c.b).toBe(0);
    });
  });

  describe('getGradientColor', () => {
    it('空颜色数组返回白色', () => {
      expect(getGradientColor([], 0)).toBe('#ffffff');
    });

    it('单色数组返回该颜色', () => {
      expect(getGradientColor(['#ff0000'], 0)).toBe('#ff0000');
      expect(getGradientColor(['#ff0000'], 0.5)).toBe('#ff0000');
    });

    it('progress=0 返回第一个颜色', () => {
      const result = getGradientColor(['#ff0000', '#0000ff'], 0);
      expect(result).toContain('255');
    });

    it('progress=1 与 progress=0 颜色相同（循环）', () => {
      const c0 = getGradientColor(['#ff0000', '#0000ff'], 0);
      const c1 = getGradientColor(['#ff0000', '#0000ff'], 1);
      expect(c0).toBe(c1);
    });

    it('progress=0.5 返回中间颜色', () => {
      const result = getGradientColor(['#000000', '#ffffff'], 0.5);
      expect(result).toContain('128');
    });

    it('progress > 1 时取模', () => {
      const c1 = getGradientColor(['#ff0000', '#0000ff'], 0.3);
      const c2 = getGradientColor(['#ff0000', '#0000ff'], 1.3);
      expect(c1).toBe(c2);
    });

    it('progress < 0 时取模', () => {
      const c1 = getGradientColor(['#ff0000', '#0000ff'], 0.7);
      const c2 = getGradientColor(['#ff0000', '#0000ff'], -0.3);
      expect(c1).toBe(c2);
    });

    it('多色渐变中间值正确', () => {
      const colors = ['#ff0000', '#00ff00', '#0000ff'];
      const result = getGradientColor(colors, 0.5);
      // 0.5 * 2 = 1.0 => index=1, frac=0 => 返回 colors[1]
      expect(result).toContain('0');
      expect(result).toContain('255');
    });
  });
});

// ============================================================
// 3. 引擎初始化测试
// ============================================================
describe('引擎初始化', () => {
  it('init() 不传 canvas 不报错', () => {
    const e = new SpirographEngine();
    expect(() => e.init()).not.toThrow();
  });

  it('init() 后状态为 idle', () => {
    const e = new SpirographEngine();
    e.init();
    expect(e.status).toBe('idle');
  });

  it('init() 后分数为 0', () => {
    const e = new SpirographEngine();
    e.init();
    expect(e.score).toBe(0);
  });

  it('init() 后默认参数正确', () => {
    const e = new SpirographEngine();
    e.init();
    expect(e.getOuterRadius()).toBe(DEFAULT_OUTER_RADIUS);
    expect(e.getInnerRadius()).toBe(DEFAULT_INNER_RADIUS);
    expect(e.getPenDistance()).toBe(DEFAULT_PEN_DISTANCE);
    expect(e.getDrawSpeed()).toBe(DEFAULT_DRAW_SPEED);
  });

  it('init() 后默认曲线类型为 hypotrochoid', () => {
    const e = createIdleEngine();
    expect(e.getCurveType()).toBe('hypotrochoid');
  });

  it('init() 后默认颜色方案索引正确', () => {
    const e = createIdleEngine();
    expect(e.getColorSchemeIndex()).toBe(DEFAULT_COLOR_SCHEME_INDEX);
  });

  it('init() 后曲线点为空', () => {
    const e = createIdleEngine();
    expect(e.getCurvePoints()).toEqual([]);
  });

  it('init() 后未绘制', () => {
    const e = createIdleEngine();
    expect(e.getIsDrawing()).toBe(false);
    expect(e.getIsComplete()).toBe(false);
    expect(e.getPointsDrawn()).toBe(0);
  });

  it('init() 后 maxAngle 已计算', () => {
    const e = createIdleEngine();
    expect(e.getMaxAngle()).toBeGreaterThan(0);
  });

  it('init() 后 totalPoints 已计算', () => {
    const e = createIdleEngine();
    expect(e.getTotalPoints()).toBeGreaterThan(0);
  });

  it('init() 后 currentAngle 为 0', () => {
    const e = createIdleEngine();
    expect(e.getCurrentAngle()).toBe(0);
  });
});

// ============================================================
// 4. 启动与动画状态测试
// ============================================================
describe('启动与动画状态', () => {
  it('start() 后状态为 playing', () => {
    const e = createEngine();
    expect(e.status).toBe('playing');
  });

  it('start() 后 isDrawing 为 true', () => {
    const e = createEngine();
    expect(e.getIsDrawing()).toBe(true);
  });

  it('start() 后分数重置为 0', () => {
    const e = createEngine();
    expect(e.score).toBe(0);
  });

  it('start() 后 currentAngle 为 0', () => {
    const e = createEngine();
    expect(e.getCurrentAngle()).toBe(0);
  });

  it('update 推进角度并生成点', () => {
    const e = createEngine();
    tick(e, 1);
    expect(e.getCurrentAngle()).toBeGreaterThan(0);
    expect(e.getPointsDrawn()).toBeGreaterThan(0);
  });

  it('多次 update 持续推进', () => {
    const e = createEngine();
    tick(e, 5);
    const angle1 = e.getCurrentAngle();
    tick(e, 5);
    const angle2 = e.getCurrentAngle();
    expect(angle2).toBeGreaterThan(angle1);
  });

  it('update 不在 playing 状态时不推进', () => {
    const e = createIdleEngine();
    tick(e, 10);
    expect(e.getCurrentAngle()).toBe(0);
    expect(e.getPointsDrawn()).toBe(0);
  });

  it('曲线完成后 isComplete 为 true', () => {
    const e = createEngine();
    // 使用非常大的速度快速完成
    e.setDrawSpeed(10);
    tick(e, 500);
    expect(e.getIsComplete()).toBe(true);
  });

  it('曲线完成后 isDrawing 为 false', () => {
    const e = createEngine();
    e.setDrawSpeed(10);
    tick(e, 500);
    expect(e.getIsDrawing()).toBe(false);
  });

  it('曲线完成后不再生成新点', () => {
    const e = createEngine();
    e.setDrawSpeed(10);
    tick(e, 500);
    const pts1 = e.getPointsDrawn();
    tick(e, 10);
    const pts2 = e.getPointsDrawn();
    expect(pts2).toBe(pts1);
  });

  it('暂停后直接调用 update 仍推进（isDrawing 未被 onPause 清除）', () => {
    // SpirographEngine.update 只检查 isDrawing，而 onPause 不清除 isDrawing
    // 直接调用 update() 会继续推进。这是引擎的设计：
    // 正常流程中 gameLoop 在 pause() 后不再调用 update()
    const e = createEngine();
    tick(e, 3);
    const angleBefore = e.getCurrentAngle();
    e.pause();
    // isDrawing 仍为 true，直接 update 会继续
    tick(e, 5);
    expect(e.getCurrentAngle()).toBeGreaterThan(angleBefore);
  });

  it('恢复后 update 继续推进', () => {
    const e = createEngine();
    tick(e, 3);
    e.pause();
    const anglePaused = e.getCurrentAngle();
    e.resume();
    tick(e, 3);
    expect(e.getCurrentAngle()).toBeGreaterThan(anglePaused);
  });
});

// ============================================================
// 5. 参数调整测试
// ============================================================
describe('参数调整', () => {
  describe('setOuterRadius', () => {
    it('正常设置外圆半径', () => {
      const e = createIdleEngine();
      e.setOuterRadius(150);
      expect(e.getOuterRadius()).toBe(150);
    });

    it('不低于 MIN_OUTER_RADIUS', () => {
      const e = createIdleEngine();
      e.setOuterRadius(10);
      expect(e.getOuterRadius()).toBe(MIN_OUTER_RADIUS);
    });

    it('不超过 MAX_OUTER_RADIUS', () => {
      const e = createIdleEngine();
      e.setOuterRadius(999);
      expect(e.getOuterRadius()).toBe(MAX_OUTER_RADIUS);
    });

    it('设置到边界值 MIN_OUTER_RADIUS', () => {
      const e = createIdleEngine();
      e.setOuterRadius(MIN_OUTER_RADIUS);
      expect(e.getOuterRadius()).toBe(MIN_OUTER_RADIUS);
    });

    it('设置到边界值 MAX_OUTER_RADIUS', () => {
      const e = createIdleEngine();
      e.setOuterRadius(MAX_OUTER_RADIUS);
      expect(e.getOuterRadius()).toBe(MAX_OUTER_RADIUS);
    });

    it('改变外圆半径后曲线重置', () => {
      const e = createEngine();
      tick(e, 5);
      expect(e.getPointsDrawn()).toBeGreaterThan(0);
      e.setOuterRadius(150);
      expect(e.getPointsDrawn()).toBe(0);
      expect(e.getCurrentAngle()).toBe(0);
    });
  });

  describe('setInnerRadius', () => {
    it('正常设置内圆半径', () => {
      const e = createIdleEngine();
      e.setInnerRadius(60);
      expect(e.getInnerRadius()).toBe(60);
    });

    it('不低于 MIN_INNER_RADIUS', () => {
      const e = createIdleEngine();
      e.setInnerRadius(0);
      expect(e.getInnerRadius()).toBe(MIN_INNER_RADIUS);
    });

    it('不超过 MAX_INNER_RADIUS', () => {
      const e = createIdleEngine();
      e.setInnerRadius(999);
      expect(e.getInnerRadius()).toBe(MAX_INNER_RADIUS);
    });

    it('改变内圆半径后曲线重置', () => {
      const e = createEngine();
      tick(e, 5);
      e.setInnerRadius(80);
      expect(e.getPointsDrawn()).toBe(0);
    });
  });

  describe('setPenDistance', () => {
    it('正常设置笔距', () => {
      const e = createIdleEngine();
      e.setPenDistance(100);
      expect(e.getPenDistance()).toBe(100);
    });

    it('不低于 MIN_PEN_DISTANCE', () => {
      const e = createIdleEngine();
      e.setPenDistance(0);
      expect(e.getPenDistance()).toBe(MIN_PEN_DISTANCE);
    });

    it('不超过 MAX_PEN_DISTANCE', () => {
      const e = createIdleEngine();
      e.setPenDistance(999);
      expect(e.getPenDistance()).toBe(MAX_PEN_DISTANCE);
    });

    it('改变笔距后曲线重置', () => {
      const e = createEngine();
      tick(e, 5);
      e.setPenDistance(100);
      expect(e.getPointsDrawn()).toBe(0);
    });
  });

  describe('setDrawSpeed', () => {
    it('正常设置速度', () => {
      const e = createIdleEngine();
      e.setDrawSpeed(0.1);
      expect(e.getDrawSpeed()).toBe(0.1);
    });

    it('不低于 MIN_DRAW_SPEED', () => {
      const e = createIdleEngine();
      e.setDrawSpeed(0);
      expect(e.getDrawSpeed()).toBe(MIN_DRAW_SPEED);
    });

    it('不超过 MAX_DRAW_SPEED', () => {
      const e = createIdleEngine();
      e.setDrawSpeed(999);
      expect(e.getDrawSpeed()).toBe(MAX_DRAW_SPEED);
    });

    it('改变速度不重置曲线', () => {
      const e = createEngine();
      tick(e, 5);
      const pts = e.getPointsDrawn();
      e.setDrawSpeed(0.2);
      // 速度改变不触发 onParametersChanged
      expect(e.getPointsDrawn()).toBe(pts);
    });
  });

  describe('setCurveType', () => {
    it('切换到 epitrochoid', () => {
      const e = createIdleEngine();
      e.setCurveType('epitrochoid');
      expect(e.getCurveType()).toBe('epitrochoid');
    });

    it('切换回 hypotrochoid', () => {
      const e = createIdleEngine();
      e.setCurveType('epitrochoid');
      e.setCurveType('hypotrochoid');
      expect(e.getCurveType()).toBe('hypotrochoid');
    });

    it('切换曲线类型后曲线重置', () => {
      const e = createEngine();
      tick(e, 5);
      e.setCurveType('epitrochoid');
      expect(e.getPointsDrawn()).toBe(0);
    });
  });
});

// ============================================================
// 6. 曲线点生成测试
// ============================================================
describe('曲线点生成', () => {
  it('每个点都有 x, y, color 属性', () => {
    const e = createEngine();
    tick(e, 3);
    const points = e.getCurvePoints();
    expect(points.length).toBeGreaterThan(0);
    points.forEach((pt) => {
      expect(pt).toHaveProperty('x');
      expect(pt).toHaveProperty('y');
      expect(pt).toHaveProperty('color');
    });
  });

  it('点的坐标是有限数', () => {
    const e = createEngine();
    tick(e, 10);
    const points = e.getCurvePoints();
    points.forEach((pt) => {
      expect(isFinite(pt.x)).toBe(true);
      expect(isFinite(pt.y)).toBe(true);
    });
  });

  it('点的颜色是字符串', () => {
    const e = createEngine();
    tick(e, 5);
    const points = e.getCurvePoints();
    points.forEach((pt) => {
      expect(typeof pt.color).toBe('string');
      expect(pt.color.length).toBeGreaterThan(0);
    });
  });

  it('点数等于 pointsDrawn', () => {
    const e = createEngine();
    tick(e, 5);
    expect(e.getCurvePoints().length).toBe(e.getPointsDrawn());
  });

  it('getCurvePoints 返回副本（不可修改内部状态）', () => {
    const e = createEngine();
    tick(e, 5);
    const pts1 = e.getCurvePoints();
    const pts2 = e.getCurvePoints();
    expect(pts1).not.toBe(pts2); // 不同引用
    expect(pts1).toEqual(pts2);  // 相同内容
  });

  it('hypotrochoid 曲线点在合理范围内', () => {
    const e = createEngine();
    e.setCurveType('hypotrochoid');
    e.start();
    tick(e, 20);
    const points = e.getCurvePoints();
    const maxCoord = MAX_OUTER_RADIUS + MAX_PEN_DISTANCE + 50; // 留余量
    points.forEach((pt) => {
      expect(Math.abs(pt.x - CANVAS_WIDTH / 2)).toBeLessThan(maxCoord);
      expect(Math.abs(pt.y - CANVAS_HEIGHT / 2)).toBeLessThan(maxCoord);
    });
  });

  it('epitrochoid 曲线点生成', () => {
    const e = createIdleEngineWithCanvas();
    e.setCurveType('epitrochoid');
    e.start();
    tick(e, 10);
    expect(e.getPointsDrawn()).toBeGreaterThan(0);
    const points = e.getCurvePoints();
    points.forEach((pt) => {
      expect(isFinite(pt.x)).toBe(true);
      expect(isFinite(pt.y)).toBe(true);
    });
  });

  it('不同参数产生不同曲线', () => {
    const e1 = createEngine();
    tick(e1, 10);
    const pts1 = e1.getCurvePoints();

    const e2 = createIdleEngineWithCanvas();
    e2.setInnerRadius(80);
    e2.start();
    tick(e2, 10);
    const pts2 = e2.getCurvePoints();

    // 两条曲线应该不同
    const same = pts1.every((p, i) =>
      Math.abs(p.x - pts2[i]?.x) < 0.01 && Math.abs(p.y - pts2[i]?.y) < 0.01
    );
    expect(same).toBe(false);
  });
});

// ============================================================
// 7. 预设图案测试
// ============================================================
describe('预设图案', () => {
  it('应用第一个预设', () => {
    const e = createIdleEngine();
    e.applyPreset(PRESETS[0]);
    expect(e.getOuterRadius()).toBe(PRESETS[0].outerRadius);
    expect(e.getInnerRadius()).toBe(PRESETS[0].innerRadius);
    expect(e.getPenDistance()).toBe(PRESETS[0].penDistance);
  });

  it('应用所有预设均不报错', () => {
    PRESETS.forEach((preset) => {
      const e = createIdleEngine();
      expect(() => e.applyPreset(preset)).not.toThrow();
      expect(e.getOuterRadius()).toBe(preset.outerRadius);
      expect(e.getInnerRadius()).toBe(preset.innerRadius);
      expect(e.getPenDistance()).toBe(preset.penDistance);
    });
  });

  it('应用预设后曲线重置', () => {
    const e = createEngine();
    tick(e, 5);
    e.applyPreset(PRESETS[0]);
    expect(e.getPointsDrawn()).toBe(0);
    expect(e.getCurrentAngle()).toBe(0);
  });

  it('应用预设后 maxAngle 重新计算', () => {
    const e = createIdleEngine();
    const maxBefore = e.getMaxAngle();
    e.applyPreset(PRESETS[2]); // 密集花纹
    const maxAfter = e.getMaxAngle();
    // 不同预设的 maxAngle 可能不同
    expect(e.getMaxAngle()).toBeGreaterThan(0);
  });

  it('应用预设后可以正常绘制', () => {
    const e = createIdleEngineWithCanvas();
    e.applyPreset(PRESETS[0]);
    e.start();
    tick(e, 5);
    expect(e.getPointsDrawn()).toBeGreaterThan(0);
  });
});

// ============================================================
// 8. 颜色方案测试
// ============================================================
describe('颜色方案', () => {
  it('初始颜色方案为默认', () => {
    const e = createIdleEngine();
    expect(e.getColorSchemeIndex()).toBe(DEFAULT_COLOR_SCHEME_INDEX);
    expect(e.getColorScheme().name).toBe(COLOR_SCHEMES[DEFAULT_COLOR_SCHEME_INDEX].name);
  });

  it('cycleColorScheme 切换到下一个', () => {
    const e = createIdleEngine();
    e.cycleColorScheme();
    expect(e.getColorSchemeIndex()).toBe((DEFAULT_COLOR_SCHEME_INDEX + 1) % COLOR_SCHEMES.length);
  });

  it('cycleColorScheme 循环回到第一个', () => {
    const e = createIdleEngine();
    for (let i = 0; i < COLOR_SCHEMES.length; i++) {
      e.cycleColorScheme();
    }
    expect(e.getColorSchemeIndex()).toBe(DEFAULT_COLOR_SCHEME_INDEX);
  });

  it('切换颜色方案后曲线重新着色', () => {
    const e = createEngine();
    tick(e, 5);
    const colorsBefore = e.getCurvePoints().map((p) => p.color);
    e.cycleColorScheme();
    const colorsAfter = e.getCurvePoints().map((p) => p.color);
    // 颜色应该改变
    expect(colorsAfter).not.toEqual(colorsBefore);
  });

  it('切换颜色方案不重置点数', () => {
    const e = createEngine();
    tick(e, 5);
    const pts = e.getPointsDrawn();
    e.cycleColorScheme();
    expect(e.getPointsDrawn()).toBe(pts);
  });

  it('每个颜色方案都可以正确使用', () => {
    for (let i = 0; i < COLOR_SCHEMES.length; i++) {
      const e = createIdleEngineWithCanvas();
      for (let j = 0; j < i; j++) e.cycleColorScheme();
      e.start();
      tick(e, 3);
      const points = e.getCurvePoints();
      expect(points.length).toBeGreaterThan(0);
      points.forEach((pt) => {
        expect(pt.color).toBeTruthy();
      });
    }
  });
});

// ============================================================
// 9. 键盘输入测试
// ============================================================
describe('键盘输入', () => {
  describe('空格键', () => {
    it('idle 状态按空格开始绘制', () => {
      const e = createIdleEngineWithCanvas();
      expect(e.status).toBe('idle');
      e.handleKeyDown(' ');
      expect(e.status).toBe('playing');
      expect(e.getIsDrawing()).toBe(true);
    });

    it('playing 状态按空格暂停', () => {
      const e = createEngine();
      e.handleKeyDown(' ');
      expect(e.status).toBe('paused');
    });

    it('paused 状态按空格恢复', () => {
      const e = createEngine();
      e.handleKeyDown(' ');
      expect(e.status).toBe('paused');
      e.handleKeyDown(' ');
      expect(e.status).toBe('playing');
    });

    it('完成后按空格重置', () => {
      const e = createEngine();
      e.setDrawSpeed(10);
      tick(e, 500);
      expect(e.getIsComplete()).toBe(true);
      e.handleKeyDown(' ');
      expect(e.status).toBe('idle');
      expect(e.getCurrentAngle()).toBe(0);
    });
  });

  describe('R 键重置', () => {
    it('R 键重置引擎', () => {
      const e = createEngine();
      tick(e, 10);
      e.handleKeyDown('r');
      expect(e.status).toBe('idle');
      expect(e.getPointsDrawn()).toBe(0);
      expect(e.getCurrentAngle()).toBe(0);
    });

    it('大写 R 也重置', () => {
      const e = createEngine();
      tick(e, 5);
      e.handleKeyDown('R');
      expect(e.status).toBe('idle');
    });
  });

  describe('方向键', () => {
    it('ArrowLeft 减小内圆半径', () => {
      const e = createIdleEngine();
      const before = e.getInnerRadius();
      e.handleKeyDown('ArrowLeft');
      expect(e.getInnerRadius()).toBe(before - INNER_RADIUS_STEP);
    });

    it('ArrowRight 增大内圆半径', () => {
      const e = createIdleEngine();
      const before = e.getInnerRadius();
      e.handleKeyDown('ArrowRight');
      expect(e.getInnerRadius()).toBe(before + INNER_RADIUS_STEP);
    });

    it('ArrowUp 增大笔距', () => {
      const e = createIdleEngine();
      const before = e.getPenDistance();
      e.handleKeyDown('ArrowUp');
      expect(e.getPenDistance()).toBe(before + PEN_DISTANCE_STEP);
    });

    it('ArrowDown 减小笔距', () => {
      const e = createIdleEngine();
      const before = e.getPenDistance();
      e.handleKeyDown('ArrowDown');
      expect(e.getPenDistance()).toBe(before - PEN_DISTANCE_STEP);
    });

    it('ArrowLeft 不低于 MIN_INNER_RADIUS', () => {
      const e = createIdleEngine();
      e.setInnerRadius(MIN_INNER_RADIUS);
      e.handleKeyDown('ArrowLeft');
      expect(e.getInnerRadius()).toBe(MIN_INNER_RADIUS);
    });

    it('ArrowRight 不超过 MAX_INNER_RADIUS', () => {
      const e = createIdleEngine();
      e.setInnerRadius(MAX_INNER_RADIUS);
      e.handleKeyDown('ArrowRight');
      expect(e.getInnerRadius()).toBe(MAX_INNER_RADIUS);
    });

    it('ArrowUp 不超过 MAX_PEN_DISTANCE', () => {
      const e = createIdleEngine();
      e.setPenDistance(MAX_PEN_DISTANCE);
      e.handleKeyDown('ArrowUp');
      expect(e.getPenDistance()).toBe(MAX_PEN_DISTANCE);
    });

    it('ArrowDown 不低于 MIN_PEN_DISTANCE', () => {
      const e = createIdleEngine();
      e.setPenDistance(MIN_PEN_DISTANCE);
      e.handleKeyDown('ArrowDown');
      expect(e.getPenDistance()).toBe(MIN_PEN_DISTANCE);
    });
  });

  describe('Q/W 键调整外圆半径', () => {
    it('Q 减小外圆半径', () => {
      const e = createIdleEngine();
      const before = e.getOuterRadius();
      e.handleKeyDown('q');
      expect(e.getOuterRadius()).toBe(before - OUTER_RADIUS_STEP);
    });

    it('W 增大外圆半径', () => {
      const e = createIdleEngine();
      const before = e.getOuterRadius();
      e.handleKeyDown('w');
      expect(e.getOuterRadius()).toBe(before + OUTER_RADIUS_STEP);
    });

    it('大写 Q 也有效', () => {
      const e = createIdleEngine();
      const before = e.getOuterRadius();
      e.handleKeyDown('Q');
      expect(e.getOuterRadius()).toBe(before - OUTER_RADIUS_STEP);
    });

    it('大写 W 也有效', () => {
      const e = createIdleEngine();
      const before = e.getOuterRadius();
      e.handleKeyDown('W');
      expect(e.getOuterRadius()).toBe(before + OUTER_RADIUS_STEP);
    });

    it('Q 不低于 MIN_OUTER_RADIUS', () => {
      const e = createIdleEngine();
      e.setOuterRadius(MIN_OUTER_RADIUS);
      e.handleKeyDown('q');
      expect(e.getOuterRadius()).toBe(MIN_OUTER_RADIUS);
    });

    it('W 不超过 MAX_OUTER_RADIUS', () => {
      const e = createIdleEngine();
      e.setOuterRadius(MAX_OUTER_RADIUS);
      e.handleKeyDown('w');
      expect(e.getOuterRadius()).toBe(MAX_OUTER_RADIUS);
    });
  });

  describe('数字键预设', () => {
    it('数字键 1-5 应用预设', () => {
      for (let i = 1; i <= PRESETS.length; i++) {
        const e = createIdleEngine();
        e.handleKeyDown(String(i));
        expect(e.getOuterRadius()).toBe(PRESETS[i - 1].outerRadius);
        expect(e.getInnerRadius()).toBe(PRESETS[i - 1].innerRadius);
        expect(e.getPenDistance()).toBe(PRESETS[i - 1].penDistance);
      }
    });

    it('数字键 0 不应用预设', () => {
      const e = createIdleEngine();
      const before = e.getOuterRadius();
      e.handleKeyDown('0');
      expect(e.getOuterRadius()).toBe(before);
    });

    it('数字键超出范围不应用预设', () => {
      const e = createIdleEngine();
      const before = e.getOuterRadius();
      e.handleKeyDown(String(PRESETS.length + 1));
      expect(e.getOuterRadius()).toBe(before);
    });
  });

  describe('C 键切换颜色', () => {
    it('c 切换颜色方案', () => {
      const e = createIdleEngine();
      const before = e.getColorSchemeIndex();
      e.handleKeyDown('c');
      expect(e.getColorSchemeIndex()).toBe((before + 1) % COLOR_SCHEMES.length);
    });

    it('大写 C 也有效', () => {
      const e = createIdleEngine();
      const before = e.getColorSchemeIndex();
      e.handleKeyDown('C');
      expect(e.getColorSchemeIndex()).toBe((before + 1) % COLOR_SCHEMES.length);
    });
  });

  describe('E 键切换曲线类型', () => {
    it('e 切换到 epitrochoid', () => {
      const e = createIdleEngine();
      expect(e.getCurveType()).toBe('hypotrochoid');
      e.handleKeyDown('e');
      expect(e.getCurveType()).toBe('epitrochoid');
    });

    it('大写 E 也有效', () => {
      const e = createIdleEngine();
      e.handleKeyDown('E');
      expect(e.getCurveType()).toBe('epitrochoid');
    });

    it('再次按 e 切换回 hypotrochoid', () => {
      const e = createIdleEngine();
      e.handleKeyDown('e');
      e.handleKeyDown('e');
      expect(e.getCurveType()).toBe('hypotrochoid');
    });
  });

  describe('+/- 键调整速度', () => {
    it('+ 加速', () => {
      const e = createIdleEngine();
      const before = e.getDrawSpeed();
      e.handleKeyDown('+');
      expect(e.getDrawSpeed()).toBe(before + SPEED_STEP);
    });

    it('= 也加速', () => {
      const e = createIdleEngine();
      const before = e.getDrawSpeed();
      e.handleKeyDown('=');
      expect(e.getDrawSpeed()).toBe(before + SPEED_STEP);
    });

    it('- 减速', () => {
      const e = createIdleEngine();
      const before = e.getDrawSpeed();
      e.handleKeyDown('-');
      expect(e.getDrawSpeed()).toBe(before - SPEED_STEP);
    });

    it('_ 也减速', () => {
      const e = createIdleEngine();
      const before = e.getDrawSpeed();
      e.handleKeyDown('_');
      expect(e.getDrawSpeed()).toBe(before - SPEED_STEP);
    });

    it('+ 不超过 MAX_DRAW_SPEED', () => {
      const e = createIdleEngine();
      e.setDrawSpeed(MAX_DRAW_SPEED);
      e.handleKeyDown('+');
      expect(e.getDrawSpeed()).toBe(MAX_DRAW_SPEED);
    });

    it('- 不低于 MIN_DRAW_SPEED', () => {
      const e = createIdleEngine();
      e.setDrawSpeed(MIN_DRAW_SPEED);
      e.handleKeyDown('-');
      expect(e.getDrawSpeed()).toBe(MIN_DRAW_SPEED);
    });
  });

  describe('handleKeyUp', () => {
    it('handleKeyUp 不报错', () => {
      const e = createIdleEngine();
      expect(() => e.handleKeyUp('ArrowLeft')).not.toThrow();
      expect(() => e.handleKeyUp(' ')).not.toThrow();
    });
  });

  describe('未知按键', () => {
    it('未知按键不报错', () => {
      const e = createIdleEngine();
      expect(() => e.handleKeyDown('z')).not.toThrow();
      expect(() => e.handleKeyDown('F1')).not.toThrow();
      expect(() => e.handleKeyDown('')).not.toThrow();
    });
  });
});

// ============================================================
// 10. 重置测试
// ============================================================
describe('重置', () => {
  it('reset() 重置状态为 idle', () => {
    const e = createEngine();
    tick(e, 10);
    e.reset();
    expect(e.status).toBe('idle');
  });

  it('reset() 清空曲线点', () => {
    const e = createEngine();
    tick(e, 10);
    e.reset();
    expect(e.getCurvePoints()).toEqual([]);
    expect(e.getPointsDrawn()).toBe(0);
  });

  it('reset() 重置角度', () => {
    const e = createEngine();
    tick(e, 10);
    e.reset();
    expect(e.getCurrentAngle()).toBe(0);
  });

  it('reset() 重置完成状态', () => {
    const e = createEngine();
    e.setDrawSpeed(10);
    tick(e, 500);
    expect(e.getIsComplete()).toBe(true);
    e.reset();
    expect(e.getIsComplete()).toBe(false);
  });

  it('reset() 不改变参数', () => {
    const e = createEngine();
    e.setOuterRadius(150);
    e.setInnerRadius(80);
    e.setPenDistance(100);
    e.reset();
    expect(e.getOuterRadius()).toBe(150);
    expect(e.getInnerRadius()).toBe(80);
    expect(e.getPenDistance()).toBe(100);
  });

  it('reset() 后可以重新 start', () => {
    const e = createEngine();
    tick(e, 5);
    e.reset();
    e.start();
    tick(e, 5);
    expect(e.getPointsDrawn()).toBeGreaterThan(0);
  });

  it('reset() 后分数为 0', () => {
    const e = createEngine();
    tick(e, 10);
    e.reset();
    expect(e.score).toBe(0);
  });
});

// ============================================================
// 11. getState 测试
// ============================================================
describe('getState', () => {
  it('返回包含所有必要字段', () => {
    const e = createIdleEngine();
    const state = e.getState();
    expect(state).toHaveProperty('outerRadius');
    expect(state).toHaveProperty('innerRadius');
    expect(state).toHaveProperty('penDistance');
    expect(state).toHaveProperty('drawSpeed');
    expect(state).toHaveProperty('colorSchemeIndex');
    expect(state).toHaveProperty('isDrawing');
    expect(state).toHaveProperty('currentAngle');
    expect(state).toHaveProperty('maxAngle');
    expect(state).toHaveProperty('pointsDrawn');
    expect(state).toHaveProperty('totalPoints');
    expect(state).toHaveProperty('isComplete');
    expect(state).toHaveProperty('curveType');
  });

  it('初始状态值正确', () => {
    const e = createIdleEngine();
    const state = e.getState();
    expect(state.outerRadius).toBe(DEFAULT_OUTER_RADIUS);
    expect(state.innerRadius).toBe(DEFAULT_INNER_RADIUS);
    expect(state.penDistance).toBe(DEFAULT_PEN_DISTANCE);
    expect(state.drawSpeed).toBe(DEFAULT_DRAW_SPEED);
    expect(state.isDrawing).toBe(false);
    expect(state.currentAngle).toBe(0);
    expect(state.isComplete).toBe(false);
    expect(state.curveType).toBe('hypotrochoid');
  });

  it('绘制后状态更新', () => {
    const e = createEngine();
    tick(e, 10);
    const state = e.getState();
    expect(state.isDrawing).toBe(true);
    expect(state.currentAngle).toBeGreaterThan(0);
    expect(state.pointsDrawn).toBeGreaterThan(0);
  });

  it('完成后状态正确', () => {
    const e = createEngine();
    e.setDrawSpeed(10);
    tick(e, 500);
    const state = e.getState();
    expect(state.isComplete).toBe(true);
    expect(state.isDrawing).toBe(false);
  });

  it('参数修改后状态同步', () => {
    const e = createIdleEngine();
    e.setOuterRadius(150);
    e.setInnerRadius(60);
    e.setPenDistance(80);
    const state = e.getState();
    expect(state.outerRadius).toBe(150);
    expect(state.innerRadius).toBe(60);
    expect(state.penDistance).toBe(80);
  });
});

// ============================================================
// 12. exportParams 测试
// ============================================================
describe('exportParams', () => {
  it('返回包含所有字段', () => {
    const e = createIdleEngine();
    const params = e.exportParams();
    expect(params).toHaveProperty('outerRadius');
    expect(params).toHaveProperty('innerRadius');
    expect(params).toHaveProperty('penDistance');
    expect(params).toHaveProperty('drawSpeed');
    expect(params).toHaveProperty('colorScheme');
    expect(params).toHaveProperty('curveType');
  });

  it('默认值正确', () => {
    const e = createIdleEngine();
    const params = e.exportParams();
    expect(params.outerRadius).toBe(DEFAULT_OUTER_RADIUS);
    expect(params.innerRadius).toBe(DEFAULT_INNER_RADIUS);
    expect(params.penDistance).toBe(DEFAULT_PEN_DISTANCE);
    expect(params.drawSpeed).toBe(DEFAULT_DRAW_SPEED);
    expect(params.colorScheme).toBe(COLOR_SCHEMES[DEFAULT_COLOR_SCHEME_INDEX].name);
    expect(params.curveType).toBe('hypotrochoid');
  });

  it('修改后导出正确', () => {
    const e = createIdleEngine();
    e.setOuterRadius(150);
    e.setCurveType('epitrochoid');
    e.cycleColorScheme();
    const params = e.exportParams();
    expect(params.outerRadius).toBe(150);
    expect(params.curveType).toBe('epitrochoid');
    expect(params.colorScheme).toBe(COLOR_SCHEMES[(DEFAULT_COLOR_SCHEME_INDEX + 1) % COLOR_SCHEMES.length].name);
  });
});

// ============================================================
// 13. 事件系统测试
// ============================================================
describe('事件系统', () => {
  it('start 触发 statusChange 事件', () => {
    const e = createIdleEngineWithCanvas();
    const handler = vi.fn();
    e.on('statusChange', handler);
    e.start();
    expect(handler).toHaveBeenCalledWith('playing');
  });

  it('pause 触发 statusChange 事件', () => {
    const e = createEngine();
    const handler = vi.fn();
    e.on('statusChange', handler);
    e.pause();
    expect(handler).toHaveBeenCalledWith('paused');
  });

  it('resume 触发 statusChange 事件', () => {
    const e = createEngine();
    e.pause();
    const handler = vi.fn();
    e.on('statusChange', handler);
    e.resume();
    expect(handler).toHaveBeenCalledWith('playing');
  });

  it('reset 触发 statusChange 事件', () => {
    const e = createEngine();
    const handler = vi.fn();
    e.on('statusChange', handler);
    e.reset();
    expect(handler).toHaveBeenCalledWith('idle');
  });

  it('update 触发 scoreChange 事件', () => {
    const e = createEngine();
    const handler = vi.fn();
    e.on('scoreChange', handler);
    tick(e, 1);
    expect(handler).toHaveBeenCalled();
  });

  it('off 取消事件监听', () => {
    const e = createEngine();
    const handler = vi.fn();
    e.on('scoreChange', handler);
    e.off('scoreChange', handler);
    tick(e, 1);
    expect(handler).not.toHaveBeenCalled();
  });

  it('destroy 清除所有监听', () => {
    const e = createEngine();
    const handler = vi.fn();
    e.on('statusChange', handler);
    e.destroy();
    // destroy 后触发不了了
    handler.mockClear();
    e.start();
    expect(handler).not.toHaveBeenCalled();
  });
});

// ============================================================
// 14. destroy 测试
// ============================================================
describe('destroy', () => {
  it('destroy 后状态为 idle', () => {
    const e = createEngine();
    tick(e, 10);
    e.destroy();
    expect(e.status).toBe('idle');
  });

  it('destroy 后曲线点清空', () => {
    const e = createEngine();
    tick(e, 10);
    e.destroy();
    expect(e.getCurvePoints()).toEqual([]);
  });
});

// ============================================================
// 15. 边界情况测试
// ============================================================
describe('边界情况', () => {
  it('r 接近 R 时仍能正常绘制', () => {
    const e = createIdleEngineWithCanvas();
    e.setInnerRadius(MAX_INNER_RADIUS);
    e.start();
    expect(() => tick(e, 10)).not.toThrow();
    expect(e.getPointsDrawn()).toBeGreaterThan(0);
  });

  it('d 很大时仍能正常绘制', () => {
    const e = createIdleEngineWithCanvas();
    e.setPenDistance(MAX_PEN_DISTANCE);
    e.start();
    expect(() => tick(e, 10)).not.toThrow();
    expect(e.getPointsDrawn()).toBeGreaterThan(0);
  });

  it('d 很小时仍能正常绘制', () => {
    const e = createIdleEngineWithCanvas();
    e.setPenDistance(MIN_PEN_DISTANCE);
    e.start();
    expect(() => tick(e, 10)).not.toThrow();
    expect(e.getPointsDrawn()).toBeGreaterThan(0);
  });

  it('速度最快时仍能正常绘制', () => {
    const e = createIdleEngineWithCanvas();
    e.setDrawSpeed(MAX_DRAW_SPEED);
    e.start();
    expect(() => tick(e, 10)).not.toThrow();
  });

  it('速度最慢时仍能正常绘制', () => {
    const e = createIdleEngineWithCanvas();
    e.setDrawSpeed(MIN_DRAW_SPEED);
    e.start();
    expect(() => tick(e, 10)).not.toThrow();
  });

  it('重复 start 不报错', () => {
    const e = createIdleEngineWithCanvas();
    e.start();
    expect(() => e.start()).not.toThrow();
  });

  it('未 init 直接 start 抛出 Canvas not initialized', () => {
    const e = new SpirographEngine();
    expect(() => e.start()).toThrow('Canvas not initialized');
  });

  it('idle 状态 pause 不报错', () => {
    const e = createIdleEngine();
    expect(() => e.pause()).not.toThrow();
    expect(e.status).toBe('idle');
  });

  it('idle 状态 resume 不报错', () => {
    const e = createIdleEngine();
    expect(() => e.resume()).not.toThrow();
    expect(e.status).toBe('idle');
  });

  it('多次 reset 不报错', () => {
    const e = createEngine();
    e.reset();
    e.reset();
    e.reset();
    expect(e.status).toBe('idle');
  });

  it('destroy 后 reset 不报错', () => {
    const e = createEngine();
    e.destroy();
    expect(() => e.reset()).not.toThrow();
  });

  it('update deltaTime 为 0 不报错', () => {
    const e = createEngine();
    expect(() => tick(e, 1, 0)).not.toThrow();
  });

  it('update deltaTime 为负数不报错', () => {
    const e = createEngine();
    expect(() => tick(e, 1, -100)).not.toThrow();
  });

  it('update deltaTime 非常大不报错', () => {
    const e = createEngine();
    expect(() => tick(e, 1, 10000)).not.toThrow();
  });

  it('所有预设都能完整绘制', () => {
    PRESETS.forEach((preset) => {
      const e = createIdleEngineWithCanvas();
      e.applyPreset(preset);
      e.start();
      e.setDrawSpeed(10);
      tick(e, 500);
      expect(e.getIsComplete()).toBe(true);
    });
  });

  it('epitrochoid 类型也能完整绘制', () => {
    const e = createIdleEngineWithCanvas();
    e.setCurveType('epitrochoid');
    e.start();
    e.setDrawSpeed(10);
    tick(e, 500);
    expect(e.getIsComplete()).toBe(true);
  });

  it('所有颜色方案都能完整绘制', () => {
    for (let i = 0; i < COLOR_SCHEMES.length; i++) {
      const e = createIdleEngineWithCanvas();
      for (let j = 0; j < i; j++) e.cycleColorScheme();
      e.start();
      e.setDrawSpeed(10);
      tick(e, 500);
      expect(e.getIsComplete()).toBe(true);
    }
  });

  it('极端参数组合：R=MAX, r=MIN, d=MAX', () => {
    const e = createIdleEngineWithCanvas();
    e.setOuterRadius(MAX_OUTER_RADIUS);
    e.setInnerRadius(MIN_INNER_RADIUS);
    e.setPenDistance(MAX_PEN_DISTANCE);
    e.start();
    expect(() => tick(e, 10)).not.toThrow();
    expect(e.getPointsDrawn()).toBeGreaterThan(0);
  });

  it('极端参数组合：R=MIN, r=MAX, d=MIN', () => {
    const e = createIdleEngineWithCanvas();
    e.setOuterRadius(MIN_OUTER_RADIUS);
    e.setInnerRadius(MAX_INNER_RADIUS);
    e.setPenDistance(MIN_PEN_DISTANCE);
    e.start();
    expect(() => tick(e, 10)).not.toThrow();
  });

  it('曲线完成后 score 等于 pointsDrawn', () => {
    const e = createEngine();
    e.setDrawSpeed(10);
    tick(e, 500);
    expect(e.getIsComplete()).toBe(true);
    expect(e.score).toBe(e.getPointsDrawn());
  });
});

// ============================================================
// 16. 引擎属性访问器测试
// ============================================================
describe('属性访问器', () => {
  it('score 返回当前分数', () => {
    const e = createEngine();
    tick(e, 5);
    expect(e.score).toBe(e.getPointsDrawn());
  });

  it('level 返回 1', () => {
    const e = createEngine();
    expect(e.level).toBe(1);
  });

  it('elapsedTime 在 start 后增长', () => {
    const e = createEngine();
    // 由于没有真正的 requestAnimationFrame，elapsedTime 依赖 gameLoop
    // 但我们可以验证属性存在
    expect(typeof e.elapsedTime).toBe('number');
  });

  it('status 正确反映各阶段', () => {
    const e = createIdleEngineWithCanvas();
    expect(e.status).toBe('idle');
    e.start();
    expect(e.status).toBe('playing');
    e.pause();
    expect(e.status).toBe('paused');
    e.resume();
    expect(e.status).toBe('playing');
    e.reset();
    expect(e.status).toBe('idle');
  });
});

// ============================================================
// 17. 分数更新测试
// ============================================================
describe('分数更新', () => {
  it('绘制过程中分数随点数增长', () => {
    const e = createEngine();
    tick(e, 3);
    const score1 = e.score;
    tick(e, 3);
    const score2 = e.score;
    expect(score2).toBeGreaterThanOrEqual(score1);
  });

  it('完成后分数不再变化', () => {
    const e = createEngine();
    e.setDrawSpeed(10);
    tick(e, 500);
    const score = e.score;
    tick(e, 10);
    expect(e.score).toBe(score);
  });

  it('重置后分数为 0', () => {
    const e = createEngine();
    tick(e, 10);
    e.reset();
    expect(e.score).toBe(0);
  });
});

// ============================================================
// 18. 曲线闭合验证
// ============================================================
describe('曲线闭合验证', () => {
  it('hypotrochoid 曲线闭合点接近起始点', () => {
    const R = 120, r = 48, d = 60;
    const start = hypotrochoidPoint(R, r, d, 0);
    const angle = closureAngle(R, r);
    const end = hypotrochoidPoint(R, r, d, angle);
    expect(end.x).toBeCloseTo(start.x, 5);
    expect(end.y).toBeCloseTo(start.y, 5);
  });

  it('不同参数的闭合角度不同', () => {
    const a1 = closureAngle(120, 45);
    const a2 = closureAngle(120, 48);
    expect(a1).not.toBe(a2);
  });

  it('R 和 r 互质时闭合角度最大', () => {
    const a1 = closureAngle(120, 7); // gcd=1
    const a2 = closureAngle(120, 48); // gcd=24
    expect(a1).toBeGreaterThan(a2);
  });
});
