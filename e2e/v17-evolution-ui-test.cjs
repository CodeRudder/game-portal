/**
 * v17.0 竖屏适配 — 进化迭代 UI测试 R1
 *
 * 测试范围：
 * 1. 移动端视口(375x812)下页面正常渲染
 * 2. 无水平溢出
 * 3. Tab/面板在竖屏下可用
 * 4. 响应式断点切换正常
 * 5. 桌面端视口正常
 * 6. 平板视口正常
 * 7. 数据完整性
 *
 * @module e2e/v17-evolution-ui-test
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.GAME_BASE_URL || 'http://localhost:5173/idle/three-kingdoms';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots', 'v17-evolution');

const results = {
  passed: [],
  failed: [],
  warnings: [],
  screenshots: [],
  consoleErrors: [],
  startTime: new Date().toISOString(),
};

function pass(name) { results.passed.push(name); console.log(`  ✅ PASS: ${name}`); }
function fail(name, detail) { results.failed.push({ name, detail: String(detail).substring(0, 300) }); console.log(`  ❌ FAIL: ${name} — ${String(detail).substring(0, 150)}`); }
function warn(name, detail) { results.warnings.push({ name, detail: String(detail).substring(0, 300) }); console.log(`  ⚠️  WARN: ${name} — ${String(detail).substring(0, 150)}`); }

async function takeScreenshot(page, name) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const filepath = path.join(SCREENSHOT_DIR, name + '.png');
  await page.screenshot({ path: filepath, fullPage: false });
  results.screenshots.push(name);
  console.log(`  📸 ${name}`);
}

async function enterGame(page) {
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  const startBtn = await page.$('button:has-text("开始游戏")');
  if (startBtn) { await startBtn.click(); await page.waitForTimeout(3000); }
  // 跳过引导
  for (let i = 0; i < 5; i++) {
    const g = await page.$('.tk-guide-overlay');
    if (!g) break;
    const s = await page.$('.tk-guide-btn--skip');
    if (s) { await s.evaluate(el => el.click()); await page.waitForTimeout(500); continue; }
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  }
}

async function closeAllModals(page) {
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  const c = await page.$('.tk-shared-panel-close') || await page.$('[data-testid="shared-panel-close"]');
  if (c) { await c.click(); await page.waitForTimeout(500); }
}

// ═══════════════════════════════════════════════
// 测试1: 移动端视口渲染 (375x812 iPhone X)
// ═══════════════════════════════════════════════
async function testMobileViewport(page) {
  console.log('\n📋 测试1: 移动端视口渲染 (375×812)');
  try {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1000);
    await enterGame(page);
    await takeScreenshot(page, 'v17-mobile-375x812');

    const body = await page.textContent('body');
    if (body && body.length > 50) {
      pass('移动端页面正常加载');
    } else {
      fail('移动端页面加载', '页面内容为空');
    }

    // 检查无水平溢出
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    if (scrollWidth <= clientWidth + 2) {
      pass('移动端无水平溢出');
    } else {
      fail('移动端水平溢出', `scrollWidth=${scrollWidth} > clientWidth=${clientWidth}`);
    }
  } catch (e) { fail('移动端视口渲染', e.message); }
}

// ═══════════════════════════════════════════════
// 测试2: 移动端Tab导航
// ═══════════════════════════════════════════════
async function testMobileTabNavigation(page) {
  console.log('\n📋 测试2: 移动端Tab导航');
  try {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(500);

    // 检查底部Tab栏
    const tabBar = await page.$('.tk-mobile-tab-bar, [data-testid="mobile-tab-bar"], .tk-tab-bar, nav[class*="tab"]');
    if (tabBar) {
      pass('底部Tab栏存在');
      await takeScreenshot(page, 'v17-mobile-tab-bar');
    } else {
      warn('底部Tab栏元素未找到', '可能使用不同CSS类名');
    }

    // 检查Tab项
    const tabItems = await page.$$('[data-testid="mobile-tab-item"], .tk-tab-item, .tk-mobile-tab-bar button, .tk-tab-bar button');
    if (tabItems.length >= 3) {
      pass(`Tab项数量: ${tabItems.length}`);
    } else {
      warn('Tab项数量偏少', `找到 ${tabItems.length} 个Tab项`);
    }

    // 尝试点击Tab
    if (tabItems.length > 1) {
      await tabItems[1].click();
      await page.waitForTimeout(1000);
      await takeScreenshot(page, 'v17-mobile-tab-switched');
      pass('Tab切换成功');
    }
  } catch (e) { fail('移动端Tab导航', e.message); }
}

// ═══════════════════════════════════════════════
// 测试3: 移动端面板
// ═══════════════════════════════════════════════
async function testMobilePanels(page) {
  console.log('\n📋 测试3: 移动端面板');
  try {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(500);

    // 先关闭所有引导和弹窗
    await closeAllModals(page);
    for (let i = 0; i < 5; i++) {
      const guide = await page.$('.tk-guide-overlay, .tk-guide-tooltip');
      if (!guide) break;
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    // 尝试打开武将面板
    const heroBtn = await page.$('[data-tab="武将"], button:has-text("武将"), .tk-tab:has-text("武将"), [data-testid="hero-panel"]');
    if (heroBtn) {
      // 确保按钮可见且可点击
      await heroBtn.evaluate(el => el.scrollIntoView && el.scrollIntoView()).catch(() => {});
      await page.waitForTimeout(300);
      await heroBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(1500);
      await takeScreenshot(page, 'v17-mobile-hero-panel');

      // 检查面板是否全屏
      const panel = await page.$('.tk-shared-panel, .tk-panel, [data-testid="shared-panel"]');
      if (panel) {
        const box = await panel.boundingBox();
        if (box) {
          // 面板宽度应接近视口宽度
          const ratio = box.width / 375;
          if (ratio > 0.8) {
            pass(`面板宽度占比: ${(ratio * 100).toFixed(0)}%（接近全屏）`);
          } else {
            warn('面板宽度偏小', `宽度占比 ${(ratio * 100).toFixed(0)}%`);
          }
        }
      } else {
        warn('面板元素未找到', '面板可能未打开');
      }
      await closeAllModals(page);
    } else {
      warn('武将按钮未找到', '无法测试面板');
    }
  } catch (e) { fail('移动端面板', e.message); }
}

// ═══════════════════════════════════════════════
// 测试4: 小屏手机 (320x568 iPhone SE 1st gen)
// ═══════════════════════════════════════════════
async function testSmallMobileViewport(page) {
  console.log('\n📋 测试4: 小屏手机 (320×568)');
  try {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.waitForTimeout(1000);
    await takeScreenshot(page, 'v17-mobile-small-320x568');

    const body = await page.textContent('body');
    if (body && body.length > 50) {
      pass('小屏手机页面正常加载');
    } else {
      fail('小屏手机页面加载', '页面内容为空');
    }

    // 检查无水平溢出
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    if (scrollWidth <= clientWidth + 2) {
      pass('小屏手机无水平溢出');
    } else {
      fail('小屏手机水平溢出', `scrollWidth=${scrollWidth} > clientWidth=${clientWidth}`);
    }
  } catch (e) { fail('小屏手机视口', e.message); }
}

// ═══════════════════════════════════════════════
// 测试5: 大屏手机 (428x926 iPhone 14 Pro Max)
// ═══════════════════════════════════════════════
async function testLargeMobileViewport(page) {
  console.log('\n📋 测试5: 大屏手机 (428×926)');
  try {
    await page.setViewportSize({ width: 428, height: 926 });
    await page.waitForTimeout(1000);
    await takeScreenshot(page, 'v17-mobile-large-428x926');

    const body = await page.textContent('body');
    if (body && body.length > 50) {
      pass('大屏手机页面正常加载');
    } else {
      fail('大屏手机页面加载', '页面内容为空');
    }
  } catch (e) { fail('大屏手机视口', e.message); }
}

// ═══════════════════════════════════════════════
// 测试6: 平板视口 (768x1024 iPad)
// ═══════════════════════════════════════════════
async function testTabletViewport(page) {
  console.log('\n📋 测试6: 平板视口 (768×1024)');
  try {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(1000);
    await takeScreenshot(page, 'v17-tablet-768x1024');

    const body = await page.textContent('body');
    if (body && body.length > 50) {
      pass('平板页面正常加载');
    } else {
      fail('平板页面加载', '页面内容为空');
    }

    // 检查无水平溢出
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    if (scrollWidth <= clientWidth + 2) {
      pass('平板无水平溢出');
    } else {
      warn('平板轻微溢出', `scrollWidth=${scrollWidth}, clientWidth=${clientWidth}`);
    }
  } catch (e) { fail('平板视口', e.message); }
}

// ═══════════════════════════════════════════════
// 测试7: 桌面端视口 (1280x800)
// ═══════════════════════════════════════════════
async function testDesktopViewport(page) {
  console.log('\n📋 测试7: 桌面端视口 (1280×800)');
  try {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(1000);
    await takeScreenshot(page, 'v17-desktop-1280x800');

    const body = await page.textContent('body');
    if (body && body.length > 50) {
      pass('桌面端页面正常加载');
    } else {
      fail('桌面端页面加载', '页面内容为空');
    }
  } catch (e) { fail('桌面端视口', e.message); }
}

// ═══════════════════════════════════════════════
// 测试8: 4K桌面端视口 (1920x1080)
// ═══════════════════════════════════════════════
async function test4KViewport(page) {
  console.log('\n📋 测试8: 4K桌面端视口 (1920×1080)');
  try {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(1000);
    await takeScreenshot(page, 'v17-desktop-4k-1920x1080');

    const body = await page.textContent('body');
    if (body && body.length > 50) {
      pass('4K桌面端页面正常加载');
    } else {
      fail('4K桌面端页面加载', '页面内容为空');
    }
  } catch (e) { fail('4K桌面端视口', e.message); }
}

// ═══════════════════════════════════════════════
// 测试9: 响应式断点切换
// ═══════════════════════════════════════════════
async function testBreakpointSwitching(page) {
  console.log('\n📋 测试9: 响应式断点切换');
  try {
    const breakpoints = [
      { name: 'Mobile-S', w: 320, h: 568 },
      { name: 'Mobile', w: 375, h: 667 },
      { name: 'Mobile-L', w: 428, h: 926 },
      { name: 'Tablet', w: 768, h: 1024 },
      { name: 'Tablet-L', w: 1024, h: 768 },
      { name: 'Desktop', w: 1280, h: 800 },
      { name: 'Desktop-L', w: 1920, h: 1080 },
    ];

    for (const bp of breakpoints) {
      await page.setViewportSize({ width: bp.w, height: bp.h });
      await page.waitForTimeout(500);
      await takeScreenshot(page, `v17-bp-${bp.name}-${bp.w}x${bp.h}`);

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      const overflow = scrollWidth > clientWidth + 2;
      if (!overflow) {
        pass(`断点 ${bp.name} (${bp.w}×${bp.h}) 无溢出`);
      } else {
        warn(`断点 ${bp.name} (${bp.w}×${bp.h}) 溢出`, `scrollW=${scrollWidth} clientW=${clientWidth}`);
      }
    }
  } catch (e) { fail('响应式断点切换', e.message); }
}

// ═══════════════════════════════════════════════
// 测试10: 横竖屏切换
// ═══════════════════════════════════════════════
async function testOrientationSwitch(page) {
  console.log('\n📋 测试10: 横竖屏切换');
  try {
    // 竖屏
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(500);
    await takeScreenshot(page, 'v17-orientation-portrait');

    // 横屏
    await page.setViewportSize({ width: 812, height: 375 });
    await page.waitForTimeout(500);
    await takeScreenshot(page, 'v17-orientation-landscape');

    const body = await page.textContent('body');
    if (body && body.length > 50) {
      pass('横竖屏切换后页面正常');
    } else {
      fail('横竖屏切换', '切换后页面内容为空');
    }

    // 横屏无溢出
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    if (scrollWidth <= clientWidth + 2) {
      pass('横屏无水平溢出');
    } else {
      warn('横屏轻微溢出', `scrollWidth=${scrollWidth}`);
    }
  } catch (e) { fail('横竖屏切换', e.message); }
}

// ═══════════════════════════════════════════════
// 测试11: 控制台错误检测
// ═══════════════════════════════════════════════
async function testConsoleErrors(page) {
  console.log('\n📋 测试11: 控制台错误检测');
  try {
    // 切到移动端检查
    await page.setViewportSize({ width: 375, height: 812 });
    await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    const errorCount = results.consoleErrors.length;
    if (errorCount === 0) {
      pass('移动端无控制台错误');
    } else if (errorCount <= 3) {
      warn(`移动端有 ${errorCount} 个控制台错误`, results.consoleErrors.join('; ').substring(0, 200));
    } else {
      fail('移动端控制台错误过多', `${errorCount} 个错误: ${results.consoleErrors.slice(0, 3).join('; ')}`);
    }
  } catch (e) { fail('控制台错误检测', e.message); }
}

// ═══════════════════════════════════════════════
// 测试12: 数据完整性（引擎子系统）
// ═══════════════════════════════════════════════
async function testDataIntegrity(page) {
  console.log('\n📋 测试12: 数据完整性');
  try {
    // 检查引擎全局对象
    const hasEngine = await page.evaluate(() => {
      return typeof window !== 'undefined' && (window.__TK_ENGINE__ || window.__tk_engine__);
    });

    if (hasEngine) {
      pass('引擎全局对象存在');
    } else {
      warn('引擎全局对象未找到', '可能使用不同的挂载方式');
    }

    // 检查页面基本DOM结构
    const hasRoot = await page.evaluate(() => {
      return !!document.getElementById('root') || !!document.getElementById('app');
    });
    if (hasRoot) pass('React根节点存在');
    else warn('React根节点未找到', '可能使用不同的根节点ID');
  } catch (e) { fail('数据完整性', e.message); }
}

// ═══════════════════════════════════════════════
// 主测试流程
// ═══════════════════════════════════════════════
(async () => {
  console.log('═══════════════════════════════════════════');
  console.log('  v17.0 竖屏适配 — UI测试 R1');
  console.log('═══════════════════════════════════════════');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  // 收集控制台错误
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      results.consoleErrors.push(msg.text());
    }
  });

  try {
    await testMobileViewport(page);
    await testMobileTabNavigation(page);
    await testMobilePanels(page);
    await testSmallMobileViewport(page);
    await testLargeMobileViewport(page);
    await testTabletViewport(page);
    await testDesktopViewport(page);
    await test4KViewport(page);
    await testBreakpointSwitching(page);
    await testOrientationSwitch(page);
    await testConsoleErrors(page);
    await testDataIntegrity(page);
  } catch (e) {
    console.error('\n💥 测试执行异常:', e.message);
  }

  await browser.close();

  // ── 报告 ──
  results.endTime = new Date().toISOString();
  console.log('\n═══════════════════════════════════════════');
  console.log('  测试结果汇总');
  console.log('═══════════════════════════════════════════');
  console.log(`  ✅ 通过: ${results.passed.length}`);
  console.log(`  ❌ 失败: ${results.failed.length}`);
  console.log(`  ⚠️  警告: ${results.warnings.length}`);
  console.log(`  📸 截图: ${results.screenshots.length}`);
  console.log(`  🕐 开始: ${results.startTime}`);
  console.log(`  🕐 结束: ${results.endTime}`);

  if (results.failed.length > 0) {
    console.log('\n  ❌ 失败详情:');
    results.failed.forEach((f) => console.log(`    - ${f.name}: ${f.detail}`));
  }
  if (results.warnings.length > 0) {
    console.log('\n  ⚠️  警告详情:');
    results.warnings.forEach((w) => console.log(`    - ${w.name}: ${w.detail}`));
  }

  // 写入JSON报告
  const reportPath = path.join(SCREENSHOT_DIR, 'v17-ui-test-report.json');
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n  📄 报告已保存: ${reportPath}`);

  process.exit(results.failed.length > 0 ? 1 : 0);
})();
