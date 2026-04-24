/**
 * 白屏检测冒烟测试 (White-Screen Smoke Test)
 *
 * 检测项：
 * 1. 首页白屏检测 — 页面有内容、不是空白
 * 2. Console / JS 错误捕获 — 特别关注 ReferenceError
 * 3. 关键 DOM 元素存在性检测
 * 4. 所有游戏路由白屏遍历
 * 5. 三国霸业专项检测
 */

import { test, expect, type Page, type ConsoleMessage } from '@playwright/test';

// ═══════════════════════════════════════════════════════════════
//  工具函数
// ═══════════════════════════════════════════════════════════════

/** 错误收集器 — 在 beforeAll / beforeEach 中挂载，afterEach 中断言 */
interface ErrorCollector {
  consoleErrors: ConsoleMessage[];
  pageErrors: Error[];
}

function attachErrorCollector(page: Page): ErrorCollector {
  const collector: ErrorCollector = { consoleErrors: [], pageErrors: [] };

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      collector.consoleErrors.push(msg);
    }
  });

  page.on('pageerror', (err) => {
    collector.pageErrors.push(err);
  });

  return collector;
}

/** 格式化错误信息，方便报告 */
function formatConsoleErrors(errors: ConsoleMessage[]): string {
  if (errors.length === 0) return '  (无)';
  return errors
    .map((e, i) => `  [${i + 1}] ${e.text()}`)
    .join('\n');
}

function formatPageErrors(errors: Error[]): string {
  if (errors.length === 0) return '  (无)';
  return errors
    .map((e, i) => `  [${i + 1}] ${e.name}: ${e.message}`)
    .join('\n');
}

/**
 * 白屏检测核心逻辑：
 * - #root 不为空
 * - body 有可见文本或子元素
 * - 页面宽高 > 0
 */
async function assertNotWhiteScreen(page: Page, label: string) {
  // 1. #root 存在且不为空
  const rootHTML = await page.locator('#root').innerHTML();
  expect(rootHTML.trim().length, `[${label}] #root 内容为空，疑似白屏`).toBeGreaterThan(0);

  // 2. body 有实际可见内容（文本或元素）
  const bodyText = await page.locator('body').innerText();
  const hasText = bodyText.trim().length > 0;

  const hasChildElements = await page.locator('body *').count();

  expect(
    hasText || hasChildElements > 0,
    `[${label}] 页面既无文本也无子元素，疑似白屏`,
  ).toBeTruthy();

  // 3. 页面尺寸不为零
  const { width, height } = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight,
  }));
  expect(width, `[${label}] 页面宽度为 0`).toBeGreaterThan(0);
  expect(height, `[${label}] 页面高度为 0`).toBeGreaterThan(0);
}

// ═══════════════════════════════════════════════════════════════
//  路由表 — 从 App.tsx / IdleGameZone.tsx 提取
// ═══════════════════════════════════════════════════════════════

/** 经典游戏路由 (/game/:gameType) */
const CLASSIC_GAME_ROUTES = [
  '/game/tetris',
  '/game/snake',
  '/game/sokoban',
  '/game/flappy-bird',
  '/game/g2048',
  '/game/memory-match',
  '/game/tic-tac-toe',
  '/game/game-of-life',
  '/game/minesweeper',
  '/game/gomoku',
  '/game/dino-runner',
  '/game/tron',
  '/game/pipe-mania',
  '/game/breakout',
  '/game/pacman',
  '/game/space-invaders',
  '/game/othello',
  '/game/checkers',
  '/game/pinball',
  '/game/mahjong-connect',
  '/game/match-3',
  '/game/sudoku',
  '/game/tetris-battle',
  '/game/frogger',
  '/game/pong',
  '/game/connect-four',
  '/game/lights-out',
  '/game/whack-a-mole',
];

/** PixiJS 策略游戏路由 (/games/:name) */
const PIXI_GAME_ROUTES = [
  '/games/three-kingdoms-pixi',
  '/games/civ-china-pixi',
  '/games/civ-egypt-pixi',
  '/games/civ-babylon-pixi',
  '/games/civ-india-pixi',
  '/games/total-war-pixi',
  '/games/heroes-might-pixi',
  '/games/age-of-empires-pixi',
];

/** 放置游戏路由 (/idle/:gameId) */
const IDLE_GAME_ROUTES = [
  '/idle/cookie-clicker',
  '/idle/doggo-home',
  '/idle/kittens-kingdom',
  '/idle/penguin-empire',
  '/idle/ant-kingdom',
  '/idle/dino-ranch',
  '/idle/xianxia',
  '/idle/sect-rise',
  '/idle/alchemy-master',
  '/idle/civ-babylon',
  '/idle/civ-china',
  '/idle/civ-egypt',
  '/idle/civ-india',
  '/idle/three-kingdoms',
  '/idle/clan-saga',
  '/idle/doomsday',
  '/idle/dungeon-explore',
  '/idle/island-drift',
  '/idle/modern-city',
  '/idle/space-drift',
  '/idle/tribulation',
  '/idle/wild-survival',
  '/idle/age-of-empires',
  '/idle/baldurs-gate',
  '/idle/egypt-myth',
  '/idle/final-fantasy',
  '/idle/greek-gods',
  '/idle/heroes-might',
  '/idle/norse-valkyrie',
  '/idle/red-alert',
  '/idle/total-war',
  '/idle/yokai-night',
];

/** 其他页面路由 */
const OTHER_ROUTES = [
  '/idle',
  '/poc/pixi',
  '/poc/sprite-demo',
];

/** 所有路由汇总 */
const ALL_ROUTES = [
  ...CLASSIC_GAME_ROUTES,
  ...PIXI_GAME_ROUTES,
  ...IDLE_GAME_ROUTES,
  ...OTHER_ROUTES,
];

// ═══════════════════════════════════════════════════════════════
//  测试 1: 首页白屏检测
// ═══════════════════════════════════════════════════════════════

test.describe('首页白屏检测', () => {
  let collector: ErrorCollector;

  test.beforeEach(async ({ page }) => {
    collector = attachErrorCollector(page);
    await page.goto('/', { waitUntil: 'networkidle' });
  });

  test('首页不应白屏 — #root 有内容', async ({ page }) => {
    await assertNotWhiteScreen(page, '首页');
  });

  test('首页关键 DOM 元素存在', async ({ page }) => {
    // 检查 #root 存在
    await expect(page.locator('#root')).toBeAttached();

    // 检查有标题或游戏卡片等内容
    const hasContent = await page.evaluate(() => {
      const root = document.getElementById('root');
      if (!root) return false;
      // 至少有一些文本内容
      return root.textContent!.trim().length > 10;
    });
    expect(hasContent, '首页 #root 内文本内容少于 10 字符').toBeTruthy();
  });

  test('首页无 Console Error', async () => {
    // 给一个简要报告
    const report = [
      '── Console Errors ──',
      formatConsoleErrors(collector.consoleErrors),
      '── Page JS Errors ──',
      formatPageErrors(collector.pageErrors),
    ].join('\n');

    // 不直接 fail，但如果有 ReferenceError 就 fail
    const referenceErrors = collector.pageErrors.filter(
      (e) => e.name === 'ReferenceError',
    );
    const consoleReferenceErrors = collector.consoleErrors.filter(
      (e) => e.text().includes('ReferenceError'),
    );

    expect(
      referenceErrors.length,
      `首页发现 ReferenceError:\n${report}`,
    ).toBe(0);
    expect(
      consoleReferenceErrors.length,
      `首页 Console 发现 ReferenceError:\n${report}`,
    ).toBe(0);

    // 打印报告供调试
    if (collector.consoleErrors.length > 0 || collector.pageErrors.length > 0) {
      console.log(`[首页错误报告]\n${report}`);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
//  测试 2: 所有经典游戏路由白屏检测
// ═══════════════════════════════════════════════════════════════

test.describe('经典游戏路由白屏检测', () => {
  for (const route of CLASSIC_GAME_ROUTES) {
    test(`${route} 不应白屏`, async ({ page }) => {
      const collector = attachErrorCollector(page);
      await page.goto(route, { waitUntil: 'networkidle', timeout: 15000 });

      await assertNotWhiteScreen(page, route);

      // 检查 ReferenceError
      const refErrors = collector.pageErrors.filter(
        (e) => e.name === 'ReferenceError',
      );
      expect(
        refErrors.length,
        `${route} 发现 ReferenceError: ${refErrors.map((e) => e.message).join('; ')}`,
      ).toBe(0);
    });
  }
});

// ═══════════════════════════════════════════════════════════════
//  测试 3: PixiJS 策略游戏路由白屏检测
// ═══════════════════════════════════════════════════════════════

test.describe('PixiJS 策略游戏路由白屏检测', () => {
  for (const route of PIXI_GAME_ROUTES) {
    test(`${route} 不应白屏`, async ({ page }) => {
      const collector = attachErrorCollector(page);
      await page.goto(route, { waitUntil: 'networkidle', timeout: 20000 });

      // PixiJS 游戏可能需要更长时间加载 canvas
      await page.waitForTimeout(2000);

      await assertNotWhiteScreen(page, route);

      // 检查 ReferenceError
      const refErrors = collector.pageErrors.filter(
        (e) => e.name === 'ReferenceError',
      );
      expect(
        refErrors.length,
        `${route} 发现 ReferenceError: ${refErrors.map((e) => e.message).join('; ')}`,
      ).toBe(0);
    });
  }
});

// ═══════════════════════════════════════════════════════════════
//  测试 4: 放置游戏路由白屏检测
// ═══════════════════════════════════════════════════════════════

test.describe('放置游戏路由白屏检测', () => {
  for (const route of IDLE_GAME_ROUTES) {
    test(`${route} 不应白屏`, async ({ page }) => {
      const collector = attachErrorCollector(page);
      await page.goto(route, { waitUntil: 'networkidle', timeout: 15000 });

      await assertNotWhiteScreen(page, route);

      // 检查 ReferenceError
      const refErrors = collector.pageErrors.filter(
        (e) => e.name === 'ReferenceError',
      );
      expect(
        refErrors.length,
        `${route} 发现 ReferenceError: ${refErrors.map((e) => e.message).join('; ')}`,
      ).toBe(0);
    });
  }
});

// ═══════════════════════════════════════════════════════════════
//  测试 5: 其他页面路由白屏检测
// ═══════════════════════════════════════════════════════════════

test.describe('其他页面路由白屏检测', () => {
  for (const route of OTHER_ROUTES) {
    test(`${route} 不应白屏`, async ({ page }) => {
      const collector = attachErrorCollector(page);
      await page.goto(route, { waitUntil: 'networkidle', timeout: 15000 });

      await assertNotWhiteScreen(page, route);

      const refErrors = collector.pageErrors.filter(
        (e) => e.name === 'ReferenceError',
      );
      expect(
        refErrors.length,
        `${route} 发现 ReferenceError: ${refErrors.map((e) => e.message).join('; ')}`,
      ).toBe(0);
    });
  }
});

// ═══════════════════════════════════════════════════════════════
//  测试 6: 三国霸业专项检测
// ═══════════════════════════════════════════════════════════════

test.describe('三国霸业专项检测', () => {
  test('三国霸业 PixiJS 版 (/games/three-kingdoms-pixi) 无白屏无 ReferenceError', async ({ page }) => {
    const collector = attachErrorCollector(page);

    await page.goto('/games/three-kingdoms-pixi', { waitUntil: 'networkidle', timeout: 20000 });
    // 等待 PixiJS canvas 初始化
    await page.waitForTimeout(3000);

    // 1. 不白屏
    await assertNotWhiteScreen(page, '三国霸业-PixiJS');

    // 2. 专项检查：Cannot access 'he' before initialization
    const heInitErrors = collector.pageErrors.filter(
      (e) => e.message.includes("Cannot access 'he' before initialization"),
    );
    const consoleHeInitErrors = collector.consoleErrors.filter(
      (e) => e.text().includes("Cannot access 'he' before initialization"),
    );

    expect(
      heInitErrors.length,
      `三国霸业发现 'he' 初始化错误:\n${heInitErrors.map((e) => e.stack).join('\n')}`,
    ).toBe(0);
    expect(
      consoleHeInitErrors.length,
      `三国霸业 Console 发现 'he' 初始化错误:\n${consoleHeInitErrors.map((e) => e.text()).join('\n')}`,
    ).toBe(0);

    // 3. 检查是否有 canvas 元素（PixiJS 游戏应有 canvas）
    const canvasCount = await page.locator('canvas').count();
    console.log(`[三国霸业] canvas 元素数量: ${canvasCount}`);

    // 4. 打印完整错误报告
    const report = [
      '── 三国霸业错误报告 ──',
      `Console Errors (${collector.consoleErrors.length}):`,
      formatConsoleErrors(collector.consoleErrors),
      `Page JS Errors (${collector.pageErrors.length}):`,
      formatPageErrors(collector.pageErrors),
    ].join('\n');
    console.log(report);
  });

  test('三国霸业放置版 (/idle/three-kingdoms) 无白屏无 ReferenceError', async ({ page }) => {
    const collector = attachErrorCollector(page);

    await page.goto('/idle/three-kingdoms', { waitUntil: 'networkidle', timeout: 15000 });

    // 不白屏
    await assertNotWhiteScreen(page, '三国霸业-放置版');

    // 检查 ReferenceError
    const refErrors = collector.pageErrors.filter(
      (e) => e.name === 'ReferenceError',
    );
    expect(
      refErrors.length,
      `三国霸业放置版发现 ReferenceError:\n${refErrors.map((e) => e.message).join('\n')}`,
    ).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
//  测试 7: 全局错误汇总报告
// ═══════════════════════════════════════════════════════════════

test.describe('全局错误汇总', () => {
  test('遍历所有路由，汇总白屏和 JS 错误', async ({ page }) => {
    const results: {
      route: string;
      whiteScreen: boolean;
      consoleErrors: string[];
      pageErrors: string[];
    }[] = [];

    for (const route of ALL_ROUTES) {
      const collector = attachErrorCollector(page);

      try {
        await page.goto(route, { waitUntil: 'networkidle', timeout: 15000 });
      } catch {
        // 导航超时仍继续检测
      }

      // 白屏检测
      let whiteScreen = false;
      try {
        const rootHTML = await page.locator('#root').innerHTML();
        if (rootHTML.trim().length === 0) {
          whiteScreen = true;
        }
      } catch {
        whiteScreen = true;
      }

      results.push({
        route,
        whiteScreen,
        consoleErrors: collector.consoleErrors.map((e) => e.text()),
        pageErrors: collector.pageErrors.map((e) => `${e.name}: ${e.message}`),
      });
    }

    // ── 生成报告 ──
    const whiteScreenPages = results.filter((r) => r.whiteScreen);
    const pagesWithErrors = results.filter(
      (r) => r.pageErrors.length > 0 || r.consoleErrors.length > 0,
    );
    const refErrorPages = results.filter(
      (r) =>
        r.pageErrors.some((e) => e.includes('ReferenceError')) ||
        r.consoleErrors.some((e) => e.includes('ReferenceError')),
    );
    const heInitPages = results.filter(
      (r) =>
        r.pageErrors.some((e) => e.includes("Cannot access 'he'")) ||
        r.consoleErrors.some((e) => e.includes("Cannot access 'he'")),
    );

    console.log('\n');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║              白屏检测冒烟测试 — 汇总报告                ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log(`总检测路由数: ${results.length}`);
    console.log(`白屏页面数:   ${whiteScreenPages.length}`);
    console.log(`有错误页面数: ${pagesWithErrors.length}`);
    console.log(`ReferenceError 页面: ${refErrorPages.length}`);
    console.log(`'he' 初始化错误页面: ${heInitPages.length}`);
    console.log('');

    if (whiteScreenPages.length > 0) {
      console.log('── 白屏页面列表 ──');
      whiteScreenPages.forEach((r) => console.log(`  ❌ ${r.route}`));
      console.log('');
    }

    if (refErrorPages.length > 0) {
      console.log('── ReferenceError 页面 ──');
      refErrorPages.forEach((r) => {
        console.log(`  ⚠️  ${r.route}`);
        r.pageErrors.forEach((e) => console.log(`      → ${e}`));
        r.consoleErrors.forEach((e) => console.log(`      → [console] ${e}`));
      });
      console.log('');
    }

    if (heInitPages.length > 0) {
      console.log('── "Cannot access he" 专项 ──');
      heInitPages.forEach((r) => {
        console.log(`  🐛 ${r.route}`);
        r.pageErrors
          .filter((e) => e.includes("'he'"))
          .forEach((e) => console.log(`      → ${e}`));
        r.consoleErrors
          .filter((e) => e.includes("'he'"))
          .forEach((e) => console.log(`      → [console] ${e}`));
      });
      console.log('');
    }

    if (pagesWithErrors.length > 0 && refErrorPages.length === 0) {
      console.log('── 其他有错误的页面 ──');
      pagesWithErrors.forEach((r) => {
        console.log(`  ⚠️  ${r.route}`);
        r.pageErrors.slice(0, 3).forEach((e) => console.log(`      → ${e}`));
        r.consoleErrors.slice(0, 3).forEach((e) => console.log(`      → [console] ${e}`));
      });
    }

    // 断言：不允许白屏
    expect(
      whiteScreenPages.length,
      `以下页面白屏: ${whiteScreenPages.map((r) => r.route).join(', ')}`,
    ).toBe(0);

    // 断言：不允许 ReferenceError
    expect(
      refErrorPages.length,
      `以下页面有 ReferenceError: ${refErrorPages.map((r) => r.route).join(', ')}`,
    ).toBe(0);
  });
});
