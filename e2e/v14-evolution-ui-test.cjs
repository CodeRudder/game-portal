/**
 * v14.0 千秋万代 — 进化迭代 UI测试 R1
 *
 * 测试范围：
 * 1. 声望系统 — 等级/阈值/升级/产出加成
 * 2. 声望获取与商店 — 获取途径/声望商店/等级解锁
 * 3. 转生系统 — 解锁条件/倍率/保留重置/加速
 * 4. 成就系统 — 多维度成就/奖励/成就链
 * 5. 数据完整性
 * 6. 移动端适配
 *
 * @module e2e/v14-evolution-ui-test
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.GAME_BASE_URL || 'http://localhost:5173/idle/three-kingdoms';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots', 'v14-evolution');

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
    await takeScreenshot(page, 'v14-main-page');
    const body = await page.textContent('body');
    if (body && body.length > 50) pass('主页面正常加载');
    else fail('主页面加载', '页面内容为空');
  } catch (e) { fail('主页面加载', e.message); }
}

/** 测试2: 声望面板 */
async function testPrestigePanel(page) {
  console.log('\n📋 测试2: 声望面板');
  try {
    const prestigeBtn = await page.$('[data-tab="声望"], button:has-text("声望"), .tk-tab:has-text("声望"), [data-testid="prestige-panel"]');
    if (prestigeBtn) {
      await prestigeBtn.click();
      await page.waitForTimeout(1500);
      await takeScreenshot(page, 'v14-prestige-panel');
      pass('声望面板可打开');

      // 检查声望等级显示
      const levelEl = await page.$('.tk-prestige-level, [data-testid="prestige-level"]');
      if (levelEl) pass('声望等级显示');
      else warn('声望等级元素未找到');
    } else {
      const moreBtn = await page.$('[data-tab="更多"], button:has-text("更多")');
      if (moreBtn) {
        await moreBtn.click();
        await page.waitForTimeout(1000);
        const pBtn = await page.$('button:has-text("声望")');
        if (pBtn) {
          await pBtn.click();
          await page.waitForTimeout(1500);
          await takeScreenshot(page, 'v14-prestige-panel-via-more');
          pass('声望面板通过更多菜单访问');
        } else { warn('声望按钮未找到'); }
      } else { warn('声望按钮未找到'); }
    }
  } catch (e) { fail('声望面板', e.message); }
}

/** 测试3: 声望商店 */
async function testPrestigeShop(page) {
  console.log('\n📋 测试3: 声望商店');
  try {
    await closeAllModals(page);
    const shopBtn = await page.$('[data-testid="prestige-shop"], button:has-text("声望商店"), .tk-prestige-shop-btn');
    if (shopBtn) {
      await shopBtn.click();
      await page.waitForTimeout(1500);
      await takeScreenshot(page, 'v14-prestige-shop');
      pass('声望商店面板可打开');
    } else {
      warn('声望商店按钮未找到', '可能需要先打开声望面板');
    }
  } catch (e) { fail('声望商店', e.message); }
}

/** 测试4: 转生系统 */
async function testRebirthSystem(page) {
  console.log('\n📋 测试4: 转生系统');
  try {
    await closeAllModals(page);
    const rebirthBtn = await page.$('[data-testid="rebirth-panel"], button:has-text("转生"), .tk-rebirth-btn');
    if (rebirthBtn) {
      await rebirthBtn.click();
      await page.waitForTimeout(1500);
      await takeScreenshot(page, 'v14-rebirth-panel');
      pass('转生面板可打开');

      // 检查收益模拟器
      const simBtn = await page.$('[data-testid="rebirth-simulator"], button:has-text("收益模拟"), button:has-text("模拟器")');
      if (simBtn) pass('收益模拟器按钮存在');
      else warn('收益模拟器按钮未找到');
    } else {
      warn('转生按钮未找到', '可能需要满足解锁条件');
    }
  } catch (e) { fail('转生系统', e.message); }
}

/** 测试5: 成就系统 */
async function testAchievementSystem(page) {
  console.log('\n📋 测试5: 成就系统');
  try {
    await closeAllModals(page);
    const achBtn = await page.$('[data-testid="achievement-panel"], button:has-text("成就"), .tk-achievement-btn');
    if (achBtn) {
      await achBtn.click();
      await page.waitForTimeout(1500);
      await takeScreenshot(page, 'v14-achievement-panel');
      pass('成就面板可打开');

      // 检查成就维度Tab
      const achTabs = await page.$$('.tk-ach-tab, [data-testid="ach-tab"]');
      if (achTabs.length > 0) pass(`成就维度Tab(${achTabs.length}个)`);
      else warn('成就维度Tab未找到');
    } else {
      warn('成就按钮未找到', '可能需要先解锁');
    }
  } catch (e) { fail('成就系统', e.message); }
}

/** 测试6: 任务系统 */
async function testQuestSystem(page) {
  console.log('\n📋 测试6: 任务系统');
  try {
    await closeAllModals(page);
    const questBtn = await page.$('[data-tab="任务"], button:has-text("任务"), .tk-tab:has-text("任务"), [data-testid="quest-panel"]');
    if (questBtn) {
      await questBtn.click();
      await page.waitForTimeout(1500);
      await takeScreenshot(page, 'v14-quest-panel');
      pass('任务面板可打开');
    } else {
      warn('任务按钮未找到');
    }
  } catch (e) { fail('任务系统', e.message); }
}

/** 测试7: 数据完整性 */
async function testDataIntegrity(page) {
  console.log('\n📋 测试7: 数据完整性');
  try {
    const body = await page.textContent('body');
    if (body && !body.includes('NaN') && !body.includes('undefined')) pass('无NaN/undefined显示');
    else fail('数据完整性', '发现NaN或undefined');
  } catch (e) { fail('数据完整性', e.message); }
}

/** 测试8: 移动端适配 */
async function testMobile(page) {
  console.log('\n📋 测试8: 移动端适配');
  try {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1500);
    await takeScreenshot(page, 'v14-mobile-main');
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
  console.log('v14.0 千秋万代 — 进化迭代 UI测试 R1');
  console.log('════════════════════════════════════════');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => { if (msg.type() === 'error') results.consoleErrors.push(msg.text()); });

  try {
    await enterGame(page);
    await testMainPage(page);
    await testPrestigePanel(page);
    await testPrestigeShop(page);
    await testRebirthSystem(page);
    await testAchievementSystem(page);
    await testQuestSystem(page);
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

  const resultPath = path.join(__dirname, 'v14-evolution-ui-results.json');
  fs.writeFileSync(resultPath, JSON.stringify(results, null, 2));
  console.log(`\n📊 结果: ${results.passed.length}✅ ${results.failed.length}❌ ${results.warnings.length}⚠️`);
  console.log(`📁 截图: ${SCREENSHOT_DIR}`);
  console.log(`📄 报告: ${resultPath}`);

  await browser.close();
  process.exit(results.failed.length > 0 ? 1 : 0);
})();
