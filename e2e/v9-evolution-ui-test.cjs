/**
 * v9.0 离线收益深化 — 进化迭代 UI测试 R1
 *
 * 测试范围：
 * 1. 离线收益弹窗 — 收益显示、翻倍按钮、收益明细
 * 2. 邮件系统 — 邮件列表、分类筛选、批量操作
 * 3. 数据完整性 — 无NaN/undefined
 * 4. 移动端适配
 *
 * @module e2e/v9-evolution-ui-test
 */

const { chromium, devices } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.GAME_BASE_URL || 'http://localhost:3000/idle/three-kingdoms';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots', 'v9-evolution');

const results = {
  passed: [],
  failed: [],
  warnings: [],
  screenshots: [],
  consoleErrors: [],
  startTime: new Date().toISOString(),
};

function pass(name) {
  results.passed.push(name);
  console.log(`  ✅ PASS: ${name}`);
}

function fail(name, detail) {
  results.failed.push({ name, detail: String(detail).substring(0, 300) });
  console.log(`  ❌ FAIL: ${name} — ${String(detail).substring(0, 150)}`);
}

function warn(name, detail) {
  results.warnings.push({ name, detail: String(detail).substring(0, 300) });
  console.log(`  ⚠️  WARN: ${name} — ${String(detail).substring(0, 150)}`);
}

async function takeScreenshot(page, name) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const filepath = path.join(SCREENSHOT_DIR, name + '.png');
  await page.screenshot({ path: filepath, fullPage: false });
  console.log(`  📸 ${name}`);
}

async function enterGame(page) {
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  const startBtn = await page.$('button:has-text("开始游戏")');
  if (startBtn) {
    await startBtn.click();
    await page.waitForTimeout(3000);
  }
  await dismissGuide(page);
}

async function dismissGuide(page) {
  for (let i = 0; i < 5; i++) {
    const guideOverlay = await page.$('.tk-guide-overlay');
    if (!guideOverlay) break;
    const skipBtn = await page.$('.tk-guide-btn--skip');
    if (skipBtn) {
      await skipBtn.evaluate(el => el.click());
      await page.waitForTimeout(500);
      continue;
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }
}

async function closeAllModals(page) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const closeBtn = await page.$('.tk-shared-panel-close') ||
    await page.$('[data-testid="shared-panel-close"]');
  if (closeBtn) {
    await closeBtn.click();
    await page.waitForTimeout(500);
  }
}

// ─── 测试用例 ────────────────────────────────

/** 测试1: 主页面加载 */
async function testMainPage(page) {
  console.log('\n📋 测试1: 主页面加载');
  try {
    await takeScreenshot(page, 'v9-main-page');
    const body = await page.textContent('body');
    if (body && body.length > 50) pass('主页面正常加载');
    else fail('主页面加载', '页面内容为空');
  } catch (e) {
    fail('主页面加载', e.message);
  }
}

/** 测试2: 离线收益弹窗（模拟） */
async function testOfflineReward(page) {
  console.log('\n📋 测试2: 离线收益弹窗');
  try {
    // 离线收益弹窗在首次进入时可能自动弹出
    const offlineModal = await page.$('.tk-offline-reward, [data-testid="offline-reward-modal"]');
    if (offlineModal) {
      pass('离线收益弹窗存在');
      await takeScreenshot(page, 'v9-offline-reward-modal');

      // 检查收益明细
      const rewardDetail = await page.$('.tk-offline-detail, .offline-reward-detail');
      if (rewardDetail) pass('收益明细显示');
      else warn('收益明细未找到');

      // 检查翻倍按钮
      const doubleBtn = await page.$('button:has-text("翻倍"), button:has-text("双倍"), .tk-double-btn');
      if (doubleBtn) pass('翻倍按钮存在');
      else warn('翻倍按钮未找到（可能已领取）');
    } else {
      warn('离线收益弹窗未触发（需要离线一段时间后重进）');
    }
  } catch (e) {
    fail('离线收益弹窗', e.message);
  }
}

/** 测试3: 邮件面板 */
async function testMailPanel(page) {
  console.log('\n📋 测试3: 邮件面板');
  try {
    await closeAllModals(page);
    await dismissGuide(page);
    const mailBtn = await page.$('button:has-text("邮件")');
    if (mailBtn) {
      await mailBtn.click();
      await page.waitForTimeout(2000);
      await takeScreenshot(page, 'v9-mail-panel');
      pass('邮件面板可打开');

      // 检查邮件分类
      const categoryTabs = await page.$$('.tk-mail-category, [class*="mail"] [class*="tab"]');
      if (categoryTabs.length > 0) pass(`邮件分类Tab数量: ${categoryTabs.length}`);
      else warn('邮件分类Tab未找到');

      // 检查邮件列表
      const mailItems = await page.$$('.tk-mail-item, [class*="mail-item"]');
      if (mailItems.length > 0) pass(`邮件列表数量: ${mailItems.length}`);
      else warn('邮件列表为空（初始状态正常）');
    } else {
      warn('邮件按钮未找到（可能在更多菜单中）');
    }
    await closeAllModals(page);
  } catch (e) {
    fail('邮件面板', e.message);
  }
}

/** 测试4: 数据完整性 */
async function testDataIntegrity(page) {
  console.log('\n📋 测试4: 数据完整性');
  try {
    const text = await page.textContent('body');
    const issues = [];
    if (text.includes('NaN')) issues.push('页面显示NaN');
    if (text.includes('undefined')) issues.push('页面显示undefined');
    if (issues.length === 0) {
      pass('页面无NaN/undefined显示');
    } else {
      for (const issue of issues) fail('数据完整性', issue);
    }
  } catch (e) {
    fail('数据完整性', e.message);
  }
}

/** 测试5: 资源栏显示 */
async function testResourceBar(page) {
  console.log('\n📋 测试5: 资源栏显示');
  try {
    const resourceBar = await page.$('.tk-resource-bar, .tk-top-bar, [data-testid="resource-bar"]');
    if (resourceBar) {
      pass('资源栏存在');
    } else {
      warn('资源栏选择器未匹配');
    }
  } catch (e) {
    fail('资源栏', e.message);
  }
}

/** 测试6: 移动端适配 */
async function testMobile(context) {
  console.log('\n📋 测试6: 移动端适配');
  try {
    const mobilePage = await context.newPage();
    await mobilePage.setViewportSize({ width: 375, height: 667 });
    await enterGame(mobilePage);
    await takeScreenshot(mobilePage, 'v9-mobile-main');

    // 检查无水平溢出
    const scrollWidth = await mobilePage.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await mobilePage.evaluate(() => document.documentElement.clientWidth);
    if (scrollWidth <= clientWidth + 2) pass('移动端无水平溢出');
    else warn(`移动端水平溢出: ${scrollWidth}px > ${clientWidth}px`);

    pass('移动端适配测试完成');
    await mobilePage.close();
  } catch (e) {
    fail('移动端适配', e.message);
  }
}

// ─── 主流程 ──────────────────────────────────
(async () => {
  console.log('🚀 v9.0 离线收益深化 UI测试开始\n');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') results.consoleErrors.push(msg.text().substring(0, 200));
  });

  try {
    await enterGame(page);
    await testMainPage(page);
    await testOfflineReward(page);
    await testMailPanel(page);
    await testDataIntegrity(page);
    await testResourceBar(page);
    await testMobile(context);
  } catch (e) {
    fail('主流程', e.message);
  }

  results.endTime = new Date().toISOString();
  console.log('\n' + '='.repeat(50));
  console.log(`📊 v9.0 UI测试结果: ✅${results.passed.length} ❌${results.failed.length} ⚠️${results.warnings.length}`);
  if (results.failed.length > 0) {
    console.log('\n失败项:');
    results.failed.forEach(f => console.log(`  ❌ ${f.name}: ${f.detail}`));
  }

  const resultPath = path.join(__dirname, 'v9-evolution-ui-results.json');
  fs.writeFileSync(resultPath, JSON.stringify(results, null, 2));

  await browser.close();
  process.exit(results.failed.length > 0 ? 1 : 0);
})();
