/**
 * Cookie Clicker 放置类游戏 — 完整测试套件
 *
 * 覆盖：
 * - 初始化与生命周期
 * - 点击产生饼干
 * - 升级购买逻辑
 * - 价格递增公式
 * - 每秒产量计算
 * - 数字格式化
 * - 键盘输入处理
 * - 自动生产（update）
 * - 状态序列化/反序列化
 * - 边界情况
 */
import {
  CookieClickerEngine,
  formatNumber,
  type CookieClickerState,
} from '@/games/cookie-clicker/CookieClickerEngine';
import {
  UPGRADES,
  COOKIES_PER_CLICK,
  PRICE_MULTIPLIER,
  PRODUCTION_TICK_MS,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  NUMBER_SUFFIXES,
} from '@/games/cookie-clicker/constants';

// ========== 测试辅助 ==========

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  return canvas;
}

function createEngine(): CookieClickerEngine {
  const engine = new CookieClickerEngine();
  engine.init(createCanvas());
  return engine;
}

function startEngine(): CookieClickerEngine {
  const engine = createEngine();
  engine.start();
  return engine;
}

/** 给引擎添加饼干（直接操作内部状态） */
function addCookies(engine: CookieClickerEngine, amount: number): void {
  (engine as any)._cookies += amount;
  (engine as any)._totalCookies += amount;
}

/** 触发一次 update */
function tick(engine: CookieClickerEngine, dt: number = 16): void {
  (engine as any).update(dt);
}

// ========== 测试 ==========

describe('CookieClickerEngine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==================== 初始化 ====================

  describe('初始化', () => {
    it('应正确创建引擎实例', () => {
      const engine = new CookieClickerEngine();
      expect(engine).toBeInstanceOf(CookieClickerEngine);
    });

    it('init 不传 canvas 也不报错', () => {
      const engine = new CookieClickerEngine();
      expect(() => engine.init()).not.toThrow();
    });

    it('init 后状态应为 idle', () => {
      const engine = createEngine();
      expect(engine.status).toBe('idle');
    });

    it('init 后饼干数为 0', () => {
      const engine = createEngine();
      expect(engine.cookies).toBe(0);
    });

    it('init 后总点击数为 0', () => {
      const engine = createEngine();
      expect(engine.totalClicks).toBe(0);
    });

    it('init 后每秒产量为 0', () => {
      const engine = createEngine();
      expect(engine.cps).toBe(0);
    });

    it('init 后选中索引为 0', () => {
      const engine = createEngine();
      expect(engine.selectedIndex).toBe(0);
    });

    it('init 后升级数量数组全为 0', () => {
      const engine = createEngine();
      expect(engine.upgradeCounts).toEqual([0, 0, 0, 0, 0]);
    });

    it('init 后 score 为 0', () => {
      const engine = createEngine();
      expect(engine.score).toBe(0);
    });

    it('init 后 level 为 1', () => {
      const engine = createEngine();
      expect(engine.level).toBe(1);
    });
  });

  // ==================== 生命周期 ====================

  describe('生命周期', () => {
    it('start 后状态应为 playing', () => {
      const engine = startEngine();
      expect(engine.status).toBe('playing');
    });

    it('start 后饼干数重置为 0', () => {
      const engine = startEngine();
      expect(engine.cookies).toBe(0);
    });

    it('start 后升级数量重置', () => {
      const engine = startEngine();
      expect(engine.upgradeCounts).toEqual([0, 0, 0, 0, 0]);
    });

    it('pause 后状态应为 paused', () => {
      const engine = startEngine();
      engine.pause();
      expect(engine.status).toBe('paused');
    });

    it('resume 后状态应为 playing', () => {
      const engine = startEngine();
      engine.pause();
      engine.resume();
      expect(engine.status).toBe('playing');
    });

    it('reset 后状态应为 idle', () => {
      const engine = startEngine();
      engine.click();
      engine.reset();
      expect(engine.status).toBe('idle');
    });

    it('reset 后饼干数归零', () => {
      const engine = startEngine();
      engine.click();
      engine.reset();
      expect(engine.cookies).toBe(0);
    });

    it('reset 后升级数归零', () => {
      const engine = startEngine();
      addCookies(engine, 100);
      engine.buyUpgrade(1); // Grandma
      engine.reset();
      expect(engine.upgradeCounts).toEqual([0, 0, 0, 0, 0]);
    });

    it('destroy 后状态为 idle', () => {
      const engine = startEngine();
      engine.destroy();
      expect(engine.status).toBe('idle');
    });

    it('多次 start 不会出错', () => {
      const engine = startEngine();
      engine.click();
      engine.reset();
      engine.start();
      engine.start(); // 二次 start
      expect(engine.status).toBe('playing');
      expect(engine.cookies).toBe(0);
    });
  });

  // ==================== 点击产生饼干 ====================

  describe('点击产生饼干', () => {
    it('点击一次产生 1 个饼干', () => {
      const engine = startEngine();
      const gained = engine.click();
      expect(gained).toBe(1);
      expect(engine.cookies).toBe(1);
    });

    it('连续点击 10 次产生 10 个饼干', () => {
      const engine = startEngine();
      for (let i = 0; i < 10; i++) engine.click();
      expect(engine.cookies).toBe(10);
    });

    it('点击增加总点击计数', () => {
      const engine = startEngine();
      engine.click();
      engine.click();
      engine.click();
      expect(engine.totalClicks).toBe(3);
    });

    it('点击增加总饼干数', () => {
      const engine = startEngine();
      engine.click();
      engine.click();
      expect(engine.totalCookies).toBe(2);
    });

    it('点击增加 score', () => {
      const engine = startEngine();
      engine.click();
      expect(engine.score).toBeGreaterThanOrEqual(1);
    });

    it('idle 状态下点击无效', () => {
      const engine = createEngine();
      const gained = engine.click();
      expect(gained).toBe(0);
      expect(engine.cookies).toBe(0);
    });

    it('paused 状态下点击无效', () => {
      const engine = startEngine();
      engine.pause();
      const gained = engine.click();
      expect(gained).toBe(0);
    });

    it('点击触发 stateChange 事件', () => {
      const engine = startEngine();
      const handler = jest.fn();
      engine.on('stateChange', handler);
      engine.click();
      expect(handler).toHaveBeenCalled();
    });

    it('点击触发 scoreChange 事件', () => {
      const engine = startEngine();
      const handler = jest.fn();
      engine.on('scoreChange', handler);
      engine.click();
      expect(handler).toHaveBeenCalled();
    });

    it('大量点击（1000次）性能正常', () => {
      const engine = startEngine();
      for (let i = 0; i < 1000; i++) engine.click();
      expect(engine.cookies).toBe(1000);
      expect(engine.totalClicks).toBe(1000);
    });
  });

  // ==================== 升级购买逻辑 ====================

  describe('升级购买逻辑', () => {
    it('购买第一个光标需 15 饼干', () => {
      const engine = startEngine();
      expect(engine.getUpgradePrice(0)).toBe(15);
    });

    it('饼干不足时无法购买', () => {
      const engine = startEngine();
      addCookies(engine, 10);
      expect(engine.buyUpgrade(0)).toBe(false);
    });

    it('饼干足够时可以购买', () => {
      const engine = startEngine();
      addCookies(engine, 15);
      expect(engine.buyUpgrade(0)).toBe(true);
    });

    it('购买后饼干减少', () => {
      const engine = startEngine();
      addCookies(engine, 100);
      engine.buyUpgrade(0); // 15
      expect(engine.cookies).toBe(85);
    });

    it('购买后升级计数增加', () => {
      const engine = startEngine();
      addCookies(engine, 100);
      engine.buyUpgrade(0);
      expect(engine.upgradeCounts[0]).toBe(1);
    });

    it('购买后每秒产量增加', () => {
      const engine = startEngine();
      addCookies(engine, 15);
      engine.buyUpgrade(0); // Cursor, +0.1/s
      expect(engine.cps).toBe(0.1);
    });

    it('购买奶奶增加 1/s 产量', () => {
      const engine = startEngine();
      addCookies(engine, 100);
      engine.buyUpgrade(1); // Grandma
      expect(engine.cps).toBe(1);
    });

    it('购买农场增加 8/s 产量', () => {
      const engine = startEngine();
      addCookies(engine, 1100);
      engine.buyUpgrade(2); // Farm
      expect(engine.cps).toBe(8);
    });

    it('购买矿场增加 47/s 产量', () => {
      const engine = startEngine();
      addCookies(engine, 12000);
      engine.buyUpgrade(3); // Mine
      expect(engine.cps).toBe(47);
    });

    it('购买工厂增加 260/s 产量', () => {
      const engine = startEngine();
      addCookies(engine, 130000);
      engine.buyUpgrade(4); // Factory
      expect(engine.cps).toBe(260);
    });

    it('多个升级叠加产量', () => {
      const engine = startEngine();
      addCookies(engine, 200);
      engine.buyUpgrade(0); // +0.1
      engine.buyUpgrade(1); // +1
      expect(engine.cps).toBe(1.1);
    });

    it('同一升级购买多次', () => {
      const engine = startEngine();
      addCookies(engine, 1000);
      engine.buyUpgrade(0); // 15
      engine.buyUpgrade(0); // 17 (15*1.15)
      expect(engine.upgradeCounts[0]).toBe(2);
      expect(engine.cps).toBe(0.2);
    });

    it('idle 状态无法购买', () => {
      const engine = createEngine();
      addCookies(engine as any, 100);
      expect(engine.buyUpgrade(0)).toBe(false);
    });

    it('无效索引购买失败（负数）', () => {
      const engine = startEngine();
      expect(engine.buyUpgrade(-1)).toBe(false);
    });

    it('无效索引购买失败（超出范围）', () => {
      const engine = startEngine();
      expect(engine.buyUpgrade(UPGRADES.length)).toBe(false);
    });

    it('购买触发 stateChange 事件', () => {
      const engine = startEngine();
      const handler = jest.fn();
      engine.on('stateChange', handler);
      addCookies(engine, 100);
      engine.buyUpgrade(0);
      expect(handler).toHaveBeenCalled();
    });

    it('购买失败不触发 stateChange', () => {
      const engine = startEngine();
      const handler = jest.fn();
      engine.on('stateChange', handler);
      engine.buyUpgrade(0); // 买不起
      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ==================== 价格递增 ====================

  describe('价格递增', () => {
    it('光标基础价格 15', () => {
      const engine = startEngine();
      expect(engine.getUpgradePrice(0)).toBe(15);
    });

    it('奶奶基础价格 100', () => {
      const engine = startEngine();
      expect(engine.getUpgradePrice(1)).toBe(100);
    });

    it('农场基础价格 1100', () => {
      const engine = startEngine();
      expect(engine.getUpgradePrice(2)).toBe(1100);
    });

    it('矿场基础价格 12000', () => {
      const engine = startEngine();
      expect(engine.getUpgradePrice(3)).toBe(12000);
    });

    it('工厂基础价格 130000', () => {
      const engine = startEngine();
      expect(engine.getUpgradePrice(4)).toBe(130000);
    });

    it('购买 1 次后价格 *1.15', () => {
      const engine = startEngine();
      addCookies(engine, 1000);
      engine.buyUpgrade(0);
      expect(engine.getUpgradePrice(0)).toBe(Math.floor(15 * 1.15));
    });

    it('购买 2 次后价格 *1.15^2', () => {
      const engine = startEngine();
      addCookies(engine, 1000);
      engine.buyUpgrade(0);
      engine.buyUpgrade(0);
      expect(engine.getUpgradePrice(0)).toBe(Math.floor(15 * Math.pow(1.15, 2)));
    });

    it('购买 5 次后价格 *1.15^5', () => {
      const engine = startEngine();
      addCookies(engine, 100000);
      for (let i = 0; i < 5; i++) engine.buyUpgrade(0);
      expect(engine.getUpgradePrice(0)).toBe(Math.floor(15 * Math.pow(1.15, 5)));
    });

    it('购买 10 次后价格 *1.15^10', () => {
      const engine = startEngine();
      addCookies(engine, 1000000);
      for (let i = 0; i < 10; i++) engine.buyUpgrade(0);
      expect(engine.getUpgradePrice(0)).toBe(Math.floor(15 * Math.pow(1.15, 10)));
    });

    it('不同升级价格独立递增', () => {
      const engine = startEngine();
      addCookies(engine, 1000000);
      engine.buyUpgrade(0); // Cursor x1
      engine.buyUpgrade(1); // Grandma x1
      // Cursor: 15*1.15^1, Grandma: 100*1.15^1
      expect(engine.getUpgradePrice(0)).toBe(Math.floor(15 * 1.15));
      expect(engine.getUpgradePrice(1)).toBe(Math.floor(100 * 1.15));
    });

    it('无效索引返回 Infinity', () => {
      const engine = startEngine();
      expect(engine.getUpgradePrice(-1)).toBe(Infinity);
      expect(engine.getUpgradePrice(99)).toBe(Infinity);
    });

    it('价格递增公式验证：base * 1.15^n', () => {
      const engine = startEngine();
      addCookies(engine, 1e9);
      const n = 20;
      for (let i = 0; i < n; i++) engine.buyUpgrade(0);
      const expected = Math.floor(15 * Math.pow(PRICE_MULTIPLIER, n));
      expect(engine.getUpgradePrice(0)).toBe(expected);
    });
  });

  // ==================== 每秒产量计算 ====================

  describe('每秒产量计算', () => {
    it('初始产量为 0', () => {
      const engine = startEngine();
      expect(engine.cps).toBe(0);
    });

    it('1 个光标 = 0.1/s', () => {
      const engine = startEngine();
      addCookies(engine, 15);
      engine.buyUpgrade(0);
      expect(engine.cps).toBe(0.1);
    });

    it('10 个光标 = 1/s', () => {
      const engine = startEngine();
      addCookies(engine, 1000);
      for (let i = 0; i < 10; i++) engine.buyUpgrade(0);
      expect(engine.cps).toBe(1);
    });

    it('1 个奶奶 = 1/s', () => {
      const engine = startEngine();
      addCookies(engine, 100);
      engine.buyUpgrade(1);
      expect(engine.cps).toBe(1);
    });

    it('1 个农场 = 8/s', () => {
      const engine = startEngine();
      addCookies(engine, 1100);
      engine.buyUpgrade(2);
      expect(engine.cps).toBe(8);
    });

    it('1 个矿场 = 47/s', () => {
      const engine = startEngine();
      addCookies(engine, 12000);
      engine.buyUpgrade(3);
      expect(engine.cps).toBe(47);
    });

    it('1 个工厂 = 260/s', () => {
      const engine = startEngine();
      addCookies(engine, 130000);
      engine.buyUpgrade(4);
      expect(engine.cps).toBe(260);
    });

    it('混合升级叠加计算', () => {
      const engine = startEngine();
      addCookies(engine, 200000);
      engine.buyUpgrade(0); // +0.1
      engine.buyUpgrade(1); // +1
      engine.buyUpgrade(2); // +8
      expect(engine.cps).toBe(9.1);
    });

    it('所有升级各一个的总产量', () => {
      const engine = startEngine();
      addCookies(engine, 1e7);
      engine.buyUpgrade(0); // +0.1
      engine.buyUpgrade(1); // +1
      engine.buyUpgrade(2); // +8
      engine.buyUpgrade(3); // +47
      engine.buyUpgrade(4); // +260
      expect(engine.cps).toBe(316.1);
    });

    it('多个同种升级叠加', () => {
      const engine = startEngine();
      addCookies(engine, 1e6);
      for (let i = 0; i < 5; i++) engine.buyUpgrade(1); // 5 * 1 = 5
      expect(engine.cps).toBe(5);
    });
  });

  // ==================== 自动生产（update） ====================

  describe('自动生产', () => {
    it('无升级时 update 不增加饼干', () => {
      const engine = startEngine();
      tick(engine, PRODUCTION_TICK_MS);
      expect(engine.cookies).toBe(0);
    });

    it('1 个光标每秒生产 0.1 饼干', () => {
      const engine = startEngine();
      addCookies(engine, 15);
      engine.buyUpgrade(0);
      tick(engine, PRODUCTION_TICK_MS);
      expect(engine.cookies).toBeCloseTo(0.1, 5);
    });

    it('1 个奶奶每秒生产 1 饼干', () => {
      const engine = startEngine();
      addCookies(engine, 100);
      engine.buyUpgrade(1);
      tick(engine, PRODUCTION_TICK_MS);
      expect(engine.cookies).toBeCloseTo(1, 5);
    });

    it('2 秒后产量翻倍', () => {
      const engine = startEngine();
      addCookies(engine, 100);
      engine.buyUpgrade(1);
      tick(engine, PRODUCTION_TICK_MS * 2);
      expect(engine.cookies).toBeCloseTo(2, 5);
    });

    it('生产增加 totalCookies', () => {
      const engine = startEngine();
      addCookies(engine, 100);
      engine.buyUpgrade(1);
      tick(engine, PRODUCTION_TICK_MS);
      expect(engine.totalCookies).toBeGreaterThanOrEqual(100);
    });

    it('paused 状态不生产', () => {
      const engine = startEngine();
      addCookies(engine, 100);
      engine.buyUpgrade(1);
      engine.pause();
      tick(engine, PRODUCTION_TICK_MS);
      expect(engine.cookies).toBe(0); // 买奶奶后饼干为0，pause后不生产
    });

    it('idle 状态不生产', () => {
      const engine = createEngine();
      (engine as any)._cps = 10;
      tick(engine, PRODUCTION_TICK_MS);
      expect(engine.cookies).toBe(0);
    });

    it('不足 1 秒的累积生产', () => {
      const engine = startEngine();
      addCookies(engine, 100);
      engine.buyUpgrade(1);
      tick(engine, 500); // 半秒
      expect(engine.cookies).toBe(0); // 不足1秒不触发
      tick(engine, 500); // 再半秒，总共1秒
      expect(engine.cookies).toBeCloseTo(1, 5);
    });

    it('大 deltaTime 正确处理', () => {
      const engine = startEngine();
      addCookies(engine, 100);
      engine.buyUpgrade(1);
      tick(engine, PRODUCTION_TICK_MS * 10); // 10秒
      expect(engine.cookies).toBeCloseTo(10, 4);
    });

    it('生产触发 scoreChange', () => {
      const engine = startEngine();
      addCookies(engine, 100);
      engine.buyUpgrade(1);
      const handler = jest.fn();
      engine.on('scoreChange', handler);
      tick(engine, PRODUCTION_TICK_MS);
      expect(handler).toHaveBeenCalled();
    });
  });

  // ==================== 键盘输入 ====================

  describe('键盘输入', () => {
    it('空格键产生饼干', () => {
      const engine = startEngine();
      engine.handleKeyDown(' ');
      expect(engine.cookies).toBe(1);
    });

    it('多次空格键', () => {
      const engine = startEngine();
      for (let i = 0; i < 5; i++) engine.handleKeyDown(' ');
      expect(engine.cookies).toBe(5);
    });

    it('上键减少选中索引', () => {
      const engine = startEngine();
      (engine as any)._selectedIndex = 2;
      engine.handleKeyDown('ArrowUp');
      expect(engine.selectedIndex).toBe(1);
    });

    it('下键增加选中索引', () => {
      const engine = startEngine();
      engine.handleKeyDown('ArrowDown');
      expect(engine.selectedIndex).toBe(1);
    });

    it('上键不会低于 0', () => {
      const engine = startEngine();
      engine.handleKeyDown('ArrowUp');
      expect(engine.selectedIndex).toBe(0);
    });

    it('下键不会超过最大索引', () => {
      const engine = startEngine();
      (engine as any)._selectedIndex = UPGRADES.length - 1;
      engine.handleKeyDown('ArrowDown');
      expect(engine.selectedIndex).toBe(UPGRADES.length - 1);
    });

    it('回车购买选中的升级', () => {
      const engine = startEngine();
      addCookies(engine, 15);
      engine.handleKeyDown('Enter');
      expect(engine.upgradeCounts[0]).toBe(1);
    });

    it('回车购买第二个升级（先选中再购买）', () => {
      const engine = startEngine();
      addCookies(engine, 200);
      engine.handleKeyDown('ArrowDown'); // 选中 Grandma
      engine.handleKeyDown('Enter');
      expect(engine.upgradeCounts[1]).toBe(1);
    });

    it('idle 状态下键盘无效', () => {
      const engine = createEngine();
      engine.handleKeyDown(' ');
      expect(engine.cookies).toBe(0);
    });

    it('handleKeyUp 不报错', () => {
      const engine = startEngine();
      expect(() => engine.handleKeyUp(' ')).not.toThrow();
    });

    it('方向键导航到每个升级', () => {
      const engine = startEngine();
      for (let i = 0; i < UPGRADES.length - 1; i++) {
        engine.handleKeyDown('ArrowDown');
        expect(engine.selectedIndex).toBe(i + 1);
      }
    });

    it('方向键上下导航往返', () => {
      const engine = startEngine();
      engine.handleKeyDown('ArrowDown');
      engine.handleKeyDown('ArrowDown');
      expect(engine.selectedIndex).toBe(2);
      engine.handleKeyDown('ArrowUp');
      expect(engine.selectedIndex).toBe(1);
    });

    it('其他按键无效果', () => {
      const engine = startEngine();
      engine.handleKeyDown('a');
      engine.handleKeyDown('b');
      engine.handleKeyDown('Escape');
      expect(engine.cookies).toBe(0);
      expect(engine.selectedIndex).toBe(0);
    });
  });

  // ==================== 数字格式化 ====================

  describe('formatNumber 数字格式化', () => {
    it('0 显示为 "0"', () => {
      expect(formatNumber(0)).toBe('0');
    });

    it('1 显示为 "1"', () => {
      expect(formatNumber(1)).toBe('1');
    });

    it('999 显示为 "999"', () => {
      expect(formatNumber(999)).toBe('999');
    });

    it('1000 显示为 "1K"（整数省略小数）', () => {
      expect(formatNumber(1000)).toBe('1K');
    });

    it('1500 显示为 "1.5K"', () => {
      expect(formatNumber(1500)).toBe('1.5K');
    });

    it('10000 显示为 "10K"（整数省略小数）', () => {
      expect(formatNumber(10000)).toBe('10K');
    });

    it('999999 显示为 "1000.0K"', () => {
      expect(formatNumber(999999)).toBe('1000.0K');
    });

    it('1000000 显示为 "1M"（整数省略小数）', () => {
      expect(formatNumber(1000000)).toBe('1M');
    });

    it('2500000 显示为 "2.5M"', () => {
      expect(formatNumber(2500000)).toBe('2.5M');
    });

    it('1000000000 显示为 "1B"（整数省略小数）', () => {
      expect(formatNumber(1000000000)).toBe('1B');
    });

    it('3500000000 显示为 "3.5B"', () => {
      expect(formatNumber(3500000000)).toBe('3.5B');
    });

    it('1000000000000 显示为 "1T"（整数省略小数）', () => {
      expect(formatNumber(1000000000000)).toBe('1T');
    });

    it('7800000000000 显示为 "7.8T"', () => {
      expect(formatNumber(7800000000000)).toBe('7.8T');
    });

    it('小数保留 1 位', () => {
      expect(formatNumber(0.1)).toBe('0.1');
    });

    it('小数 0.5 显示为 "0.5"', () => {
      expect(formatNumber(0.5)).toBe('0.5');
    });

    it('负数显示负号', () => {
      expect(formatNumber(-1000)).toBe('-1K');
    });

    it('负数小数', () => {
      expect(formatNumber(-0.5)).toBe('-0.5');
    });

    it('整数 K 不显示多余小数', () => {
      // 2000 / 1000 = 2, 刚好是整数
      expect(formatNumber(2000)).toBe('2K');
    });

    it('整数 M 不显示多余小数', () => {
      expect(formatNumber(5000000)).toBe('5M');
    });

    it('整数 B 不显示多余小数', () => {
      expect(formatNumber(3000000000)).toBe('3B');
    });

    it('整数 T 不显示多余小数', () => {
      expect(formatNumber(10000000000000)).toBe('10T');
    });

    it('自定义小数位数', () => {
      expect(formatNumber(1234, 2)).toBe('1.23K');
    });

    it('自定义小数位数为 0', () => {
      expect(formatNumber(1500, 0)).toBe('2K'); // toFixed(0) = "2"
    });

    it('极大数字', () => {
      expect(formatNumber(1e15)).toBe('1000T');
    });

    it('0.1 格式化', () => {
      expect(formatNumber(0.1)).toBe('0.1');
    });

    it('1.5 格式化', () => {
      expect(formatNumber(1.5)).toBe('1.5');
    });
  });

  // ==================== 状态序列化 ====================

  describe('getState / loadState', () => {
    it('初始 getState 返回正确状态', () => {
      const engine = startEngine();
      const state = engine.getState();
      expect(state.cookies).toBe(0);
      expect(state.totalCookies).toBe(0);
      expect(state.totalClicks).toBe(0);
      expect(state.cps).toBe(0);
      expect(state.selectedIndex).toBe(0);
      expect(state.upgrades).toHaveLength(5);
      expect(state.upgrades.every((u) => u.count === 0)).toBe(true);
    });

    it('点击后 getState 反映变化', () => {
      const engine = startEngine();
      engine.click();
      engine.click();
      const state = engine.getState();
      expect(state.cookies).toBe(2);
      expect(state.totalClicks).toBe(2);
    });

    it('购买升级后 getState 反映变化', () => {
      const engine = startEngine();
      addCookies(engine, 100);
      engine.buyUpgrade(0);
      const state = engine.getState();
      expect(state.upgrades[0].count).toBe(1);
      expect(state.cps).toBe(0.1);
    });

    it('loadState 恢复饼干数', () => {
      const engine = startEngine();
      const state: CookieClickerState = {
        cookies: 500,
        totalCookies: 1000,
        totalClicks: 100,
        cps: 5,
        upgrades: UPGRADES.map((u) => ({ id: u.id, count: 0 })),
        selectedIndex: 2,
      };
      state.upgrades[1].count = 5;
      engine.loadState(state);
      expect(engine.cookies).toBe(500);
      expect(engine.totalCookies).toBe(1000);
      expect(engine.totalClicks).toBe(100);
      expect(engine.cps).toBe(5);
      expect(engine.selectedIndex).toBe(2);
      expect(engine.upgradeCounts[1]).toBe(5);
    });

    it('loadState 触发 stateChange', () => {
      const engine = startEngine();
      const handler = jest.fn();
      engine.on('stateChange', handler);
      engine.loadState({
        cookies: 100,
        totalCookies: 100,
        totalClicks: 0,
        cps: 0,
        upgrades: UPGRADES.map((u) => ({ id: u.id, count: 0 })),
        selectedIndex: 0,
      });
      expect(handler).toHaveBeenCalled();
    });

    it('getState 返回深拷贝', () => {
      const engine = startEngine();
      const state1 = engine.getState();
      state1.cookies = 999;
      const state2 = engine.getState();
      expect(state2.cookies).toBe(0);
    });

    it('upgradeCounts 返回拷贝', () => {
      const engine = startEngine();
      const counts = engine.upgradeCounts;
      counts[0] = 99;
      expect(engine.upgradeCounts[0]).toBe(0);
    });

    it('loadState 忽略未知升级 id', () => {
      const engine = startEngine();
      engine.loadState({
        cookies: 0,
        totalCookies: 0,
        totalClicks: 0,
        cps: 0,
        upgrades: [
          { id: 'cursor', count: 5 },
          { id: 'unknown', count: 10 },
        ],
        selectedIndex: 0,
      });
      expect(engine.upgradeCounts[0]).toBe(5);
    });

    it('loadState 缺少 selectedIndex 默认为 0', () => {
      const engine = startEngine();
      engine.loadState({
        cookies: 0,
        totalCookies: 0,
        totalClicks: 0,
        cps: 0,
        upgrades: UPGRADES.map((u) => ({ id: u.id, count: 0 })),
      } as any);
      expect(engine.selectedIndex).toBe(0);
    });
  });

  // ==================== 边界情况 ====================

  describe('边界情况', () => {
    it('饼干刚好等于价格可以购买', () => {
      const engine = startEngine();
      addCookies(engine, 15);
      expect(engine.buyUpgrade(0)).toBe(true);
      expect(engine.cookies).toBe(0);
    });

    it('饼干比价格少 0.1 不能购买', () => {
      const engine = startEngine();
      addCookies(engine, 14.9);
      expect(engine.buyUpgrade(0)).toBe(false);
    });

    it('大量饼干购买最贵升级', () => {
      const engine = startEngine();
      addCookies(engine, 130000);
      expect(engine.buyUpgrade(4)).toBe(true);
      expect(engine.cps).toBe(260);
    });

    it('连续购买直到买不起', () => {
      const engine = startEngine();
      addCookies(engine, 100);
      let bought = 0;
      while (engine.buyUpgrade(0)) bought++;
      expect(bought).toBeGreaterThan(0);
      expect(bought).toBeLessThan(10);
    });

    it('重置后可以重新开始', () => {
      const engine = startEngine();
      addCookies(engine, 1000);
      engine.buyUpgrade(0);
      engine.buyUpgrade(1);
      engine.reset();
      expect(engine.cookies).toBe(0);
      expect(engine.cps).toBe(0);
      expect(engine.upgradeCounts).toEqual([0, 0, 0, 0, 0]);
    });

    it('重置后可以 start', () => {
      const engine = startEngine();
      engine.click();
      engine.reset();
      engine.start();
      expect(engine.status).toBe('playing');
      expect(engine.cookies).toBe(0);
    });

    it('快速连续点击不丢失', () => {
      const engine = startEngine();
      for (let i = 0; i < 100; i++) {
        engine.click();
      }
      expect(engine.cookies).toBe(100);
      expect(engine.totalClicks).toBe(100);
    });

    it('生产累积精度', () => {
      const engine = startEngine();
      addCookies(engine, 15);
      engine.buyUpgrade(0); // 0.1/s
      // 模拟 10 秒
      for (let i = 0; i < 10; i++) {
        tick(engine, PRODUCTION_TICK_MS);
      }
      expect(engine.cookies).toBeCloseTo(1, 4);
    });

    it('update 中 deltaTime 为 0 不出错', () => {
      const engine = startEngine();
      expect(() => tick(engine, 0)).not.toThrow();
    });

    it('update 中 deltaTime 为负数不出错', () => {
      const engine = startEngine();
      expect(() => tick(engine, -100)).not.toThrow();
    });

    it('极大 deltaTime 不崩溃', () => {
      const engine = startEngine();
      addCookies(engine, 100);
      engine.buyUpgrade(1);
      expect(() => tick(engine, 1e10)).not.toThrow();
    });

    it('购买所有类型升级', () => {
      const engine = startEngine();
      addCookies(engine, 1e8);
      for (let i = 0; i < UPGRADES.length; i++) {
        expect(engine.buyUpgrade(i)).toBe(true);
      }
      expect(engine.upgradeCounts.every((c) => c === 1)).toBe(true);
    });

    it('反复 start-reset 循环', () => {
      const engine = createEngine();
      for (let i = 0; i < 5; i++) {
        engine.start();
        engine.click();
        engine.reset();
      }
      expect(engine.status).toBe('idle');
    });
  });

  // ==================== 常量验证 ====================

  describe('常量验证', () => {
    it('UPGRADES 有 5 个升级', () => {
      expect(UPGRADES).toHaveLength(5);
    });

    it('UPGRADES 按价格升序排列', () => {
      for (let i = 1; i < UPGRADES.length; i++) {
        expect(UPGRADES[i].basePrice).toBeGreaterThan(UPGRADES[i - 1].basePrice);
      }
    });

    it('UPGRADES 按产量升序排列', () => {
      for (let i = 1; i < UPGRADES.length; i++) {
        expect(UPGRADES[i].cps).toBeGreaterThan(UPGRADES[i - 1].cps);
      }
    });

    it('每个升级有 id', () => {
      UPGRADES.forEach((u) => expect(u.id).toBeTruthy());
    });

    it('每个升级有名称', () => {
      UPGRADES.forEach((u) => expect(u.name).toBeTruthy());
    });

    it('每个升级有图标', () => {
      UPGRADES.forEach((u) => expect(u.icon).toBeTruthy());
    });

    it('COOKIES_PER_CLICK 为 1', () => {
      expect(COOKIES_PER_CLICK).toBe(1);
    });

    it('PRICE_MULTIPLIER 为 1.15', () => {
      expect(PRICE_MULTIPLIER).toBe(1.15);
    });

    it('PRODUCTION_TICK_MS 为 1000', () => {
      expect(PRODUCTION_TICK_MS).toBe(1000);
    });

    it('NUMBER_SUFFIXES 包含 K M B T', () => {
      const suffixes = NUMBER_SUFFIXES.map(([, s]) => s);
      expect(suffixes).toContain('K');
      expect(suffixes).toContain('M');
      expect(suffixes).toContain('B');
      expect(suffixes).toContain('T');
    });

    it('升级 id 唯一', () => {
      const ids = UPGRADES.map((u) => u.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  // ==================== 渲染（不崩溃） ====================

  describe('渲染', () => {
    it('onRender 不崩溃（无 canvas）', () => {
      const engine = new CookieClickerEngine();
      engine.init();
      // onRender 直接使用 ctx，需要提供 mock
      const canvas = createCanvas();
      const ctx = canvas.getContext('2d')!;
      expect(() => (engine as any).onRender(ctx, 480, 640)).not.toThrow();
    });

    it('onRender 有 canvas 时不崩溃', () => {
      const engine = startEngine();
      const canvas = createCanvas();
      const ctx = canvas.getContext('2d')!;
      expect(() => (engine as any).onRender(ctx, 480, 640)).not.toThrow();
    });

    it('点击后渲染不崩溃', () => {
      const engine = startEngine();
      engine.click();
      const canvas = createCanvas();
      const ctx = canvas.getContext('2d')!;
      expect(() => (engine as any).onRender(ctx, 480, 640)).not.toThrow();
    });

    it('购买后渲染不崩溃', () => {
      const engine = startEngine();
      addCookies(engine, 100);
      engine.buyUpgrade(0);
      const canvas = createCanvas();
      const ctx = canvas.getContext('2d')!;
      expect(() => (engine as any).onRender(ctx, 480, 640)).not.toThrow();
    });

    it('大量状态渲染不崩溃', () => {
      const engine = startEngine();
      addCookies(engine, 1e9);
      for (let i = 0; i < UPGRADES.length; i++) {
        for (let j = 0; j < 10; j++) engine.buyUpgrade(i);
      }
      const canvas = createCanvas();
      const ctx = canvas.getContext('2d')!;
      expect(() => (engine as any).onRender(ctx, 480, 640)).not.toThrow();
    });
  });

  // ==================== 综合场景 ====================

  describe('综合场景', () => {
    it('从零开始的完整游戏流程', () => {
      const engine = startEngine();

      // 点击攒饼干
      for (let i = 0; i < 15; i++) engine.click();
      expect(engine.cookies).toBe(15);

      // 购买光标
      engine.buyUpgrade(0);
      expect(engine.cookies).toBe(0);
      expect(engine.cps).toBe(0.1);

      // 自动生产 10 秒
      for (let i = 0; i < 10; i++) tick(engine, PRODUCTION_TICK_MS);
      expect(engine.cookies).toBeCloseTo(1, 4);

      // 再点击攒饼干
      for (let i = 0; i < 100; i++) engine.click();
      expect(engine.cookies).toBeGreaterThan(100);
    });

    it('快速暴富路线', () => {
      const engine = startEngine();
      addCookies(engine, 1e8);

      // 买所有升级
      for (let i = 0; i < UPGRADES.length; i++) {
        engine.buyUpgrade(i);
      }
      expect(engine.cps).toBe(316.1);

      // 自动生产
      tick(engine, PRODUCTION_TICK_MS);
      expect(engine.cookies).toBeGreaterThan(0);
    });

    it('保存和恢复游戏', () => {
      const engine = startEngine();
      addCookies(engine, 1000);
      engine.buyUpgrade(0);
      engine.buyUpgrade(1);

      const savedState = engine.getState();

      // 新引擎加载状态
      const engine2 = startEngine();
      engine2.loadState(savedState);

      expect(engine2.cookies).toBe(savedState.cookies);
      expect(engine2.cps).toBe(savedState.cps);
      expect(engine2.upgradeCounts[0]).toBe(1);
      expect(engine2.upgradeCounts[1]).toBe(1);
    });

    it('暂停恢复后继续生产', () => {
      const engine = startEngine();
      addCookies(engine, 100);
      engine.buyUpgrade(1); // +1/s

      engine.pause();
      tick(engine, PRODUCTION_TICK_MS);
      expect(engine.cookies).toBe(0); // paused 不生产

      engine.resume();
      tick(engine, PRODUCTION_TICK_MS);
      expect(engine.cookies).toBeCloseTo(1, 4);
    });
  });
});
