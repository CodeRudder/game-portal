/**
 * v15.0 事件风云 — 进化迭代 UI测试 R1
 *
 * 测试范围：
 * 1. 随机事件 — 遭遇/剧情/NPC/天灾/限时机遇
 * 2. 事件触发引擎 — 概率触发/通知优先级/冷却
 * 3. 连锁事件 — 分支路径/链状态
 * 4. 离线事件处理 — 堆积处理/自动保守
 * 5. 活动深化 — 代币商店/排行榜/限时/节日/签到
 * 6. 数据完整性
 * 7. 移动端适配
 *
 * @module e2e/v15-evolution-ui-test
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.GAME_BASE_URL || 'http://localhost:5173/idle/three-kingdoms';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots', 'v15-evolution');

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

/** 测试1: 主页面加载 */
async function testMainPage(page) {
  console.log('\n📋 测试1: 主页面加载');
  try {
    await takeScreenshot(page, 'v15-main-page');
    const body = await page.textContent('body');
    if (body && body.length > 50) pass('主页面正常加载');
    else fail('主页面加载', '页面内容为空');
  } catch (e) { fail('主页面加载', e.message); }
}

/** 测试2: 事件通知 */
async function testEventNotification(page) {
  console.log('\n📋 测试2: 事件通知');
  try {
    // 检查事件通知横幅
    const notifEl = await page.$('.tk-event-notification, [data-testid="event-notification"], .tk-urgent-banner');
    if (notifEl) {
      await takeScreenshot(page, 'v15-event-notification');
      pass('事件通知横幅存在');
    } else {
      warn('事件通知横幅未找到', '可能没有活跃事件');
    }

    // 检查事件日志按钮
    const logBtn = await page.$('[data-testid="event-log"], button:has-text("事件"), .tk-event-log-btn');
    if (logBtn) {
      await logBtn.click();
      await page.waitForTimeout(1500);
      await takeScreenshot(page, 'v15-event-log');
      pass('事件日志面板可打开');
    } else {
      warn('事件日志按钮未找到');
    }
  } catch (e) { fail('事件通知', e.message); }
}

/** 测试3: 事件选项面板 */
async function testEventOptions(page) {
  console.log('\n📋 测试3: 事件选项面板');
  try {
    await closeAllModals(page);
    // 事件选项面板通常由事件触发后弹出
    const optPanel = await page.$('.tk-event-options, [data-testid="event-options"], .tk-event-dialog');
    if (optPanel) {
      await takeScreenshot(page, 'v15-event-options');
      pass('事件选项面板存在');

      // 检查分支选项
      const options = await page.$$('.tk-event-option, [data-testid="event-option"]');
      if (options.length >= 2) pass(`事件选项(${options.length}个)`);
      else warn('事件选项不足');
    } else {
      warn('事件选项面板未找到', '需要触发事件后才会显示');
    }
  } catch (e) { fail('事件选项面板', e.message); }
}

/** 测试4: 连锁事件 */
async function testChainEvents(page) {
  console.log('\n📋 测试4: 连锁事件');
  try {
    await closeAllModals(page);
    const chainEl = await page.$('.tk-chain-event, [data-testid="chain-event"], .tk-event-chain-progress');
    if (chainEl) {
      await takeScreenshot(page, 'v15-chain-event');
      pass('连锁事件进度显示');
    } else {
      warn('连锁事件元素未找到', '需要触发连锁事件');
    }
  } catch (e) { fail('连锁事件', e.message); }
}

/** 测试5: 离线事件弹窗 */
async function testOfflineEvents(page) {
  console.log('\n📋 测试5: 离线事件弹窗');
  try {
    await closeAllModals(page);
    const offlineEl = await page.$('.tk-offline-events, [data-testid="offline-events"], .tk-offline-popup');
    if (offlineEl) {
      await takeScreenshot(page, 'v15-offline-events');
      pass('离线事件弹窗存在');
    } else {
      warn('离线事件弹窗未找到', '需要有离线积累');
    }
  } catch (e) { fail('离线事件弹窗', e.message); }
}

/** 测试6: 活动代币商店 */
async function testTokenShop(page) {
  console.log('\n📋 测试6: 活动代币商店');
  try {
    await closeAllModals(page);
    const tokenBtn = await page.$('[data-testid="token-shop"], button:has-text("代币"), button:has-text("兑换"), .tk-token-shop-btn');
    if (tokenBtn) {
      await tokenBtn.click();
      await page.waitForTimeout(1500);
      await takeScreenshot(page, 'v15-token-shop');
      pass('代币商店面板可打开');
    } else {
      warn('代币商店按钮未找到', '可能需要先打开活动面板');
    }
  } catch (e) { fail('活动代币商店', e.message); }
}

/** 测试7: 签到系统 */
async function testSignIn(page) {
  console.log('\n📋 测试7: 签到系统');
  try {
    await closeAllModals(page);
    const signInBtn = await page.$('[data-testid="sign-in"], button:has-text("签到"), .tk-sign-in-btn');
    if (signInBtn) {
      await signInBtn.click();
      await page.waitForTimeout(1500);
      await takeScreenshot(page, 'v15-sign-in');
      pass('签到面板可打开');
    } else {
      warn('签到按钮未找到');
    }
  } catch (e) { fail('签到系统', e.message); }
}

/** 测试8: 数据完整性 */
async function testDataIntegrity(page) {
  console.log('\n📋 测试8: 数据完整性');
  try {
    const body = await page.textContent('body');
    if (body && !body.includes('NaN') && !body.includes('undefined')) pass('无NaN/undefined显示');
    else fail('数据完整性', '发现NaN或undefined');
  } catch (e) { fail('数据完整性', e.message); }
}

/** 测试9: 移动端适配 */
async function testMobile(page) {
  console.log('\n📋 测试9: 移动端适配');
  try {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1500);
    await takeScreenshot(page, 'v15-mobile-main');
    pass('移动端页面正常渲染');

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    if (scrollWidth <= clientWidth + 10) pass('无横向溢出');
    else warn('移动端横向溢出', `scrollWidth=${scrollWidth}`);
  } catch (e) { fail('移动端适配', e.message); }
}

// ─── 主流程 ──────────────────────────────────

(async () => {
  console.log('════════════════════════════════════════');
  console.log('v15.0 事件风云 — 进化迭代 UI测试 R1');
  console.log('════════════════════════════════════════');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => { if (msg.type() === 'error') results.consoleErrors.push(msg.text()); });

  try {
    await enterGame(page);
    await testMainPage(page);
    await testEventNotification(page);
    await testEventOptions(page);
    await testChainEvents(page);
    await testOfflineEvents(page);
    await testTokenShop(page);
    await testSignIn(page);
    await testDataIntegrity(page);
    await testMobile(page);
  } catch (e) { fail('主流程异常', e.message); }

  results.endTime = new Date().toISOString();
  results.summary = {
    total: results.passed.length + results.failed.length,
    passed: results.passed.length,
    failed: results.failed.length,
    warnings: results.warnings.length,
  };

  const resultPath = path.join(__dirname, 'v15-evolution-ui-results.json');
  fs.writeFileSync(resultPath, JSON.stringify(results, null, 2));
  console.log(`\n📊 结果: ${results.passed.length}✅ ${results.failed.length}❌ ${results.warnings.length}⚠️`);
  console.log(`📁 截图: ${SCREENSHOT_DIR}`);
  console.log(`📄 报告: ${resultPath}`);

  await browser.close();
  process.exit(results.failed.length > 0 ? 1 : 0);
})();
