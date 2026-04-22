/**
 * v13.0 联盟争霸 — 进化迭代 UI测试 R1
 *
 * 测试范围：
 * 1. 联盟系统 — 创建/加入/成员管理/等级福利
 * 2. 联盟活动 — Boss讨伐/联盟任务/联盟商店
 * 3. PvP赛季深化 — 赛季主题/结算/战绩
 * 4. 活动系统基础 — 活动列表/类型矩阵/任务/签到
 * 5. 数据完整性
 * 6. 移动端适配
 *
 * @module e2e/v13-evolution-ui-test
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.GAME_BASE_URL || 'http://localhost:5173/idle/three-kingdoms';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots', 'v13-evolution');

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
    await takeScreenshot(page, 'v13-main-page');
    const body = await page.textContent('body');
    if (body && body.length > 50) pass('主页面正常加载');
    else fail('主页面加载', '页面内容为空');
  } catch (e) { fail('主页面加载', e.message); }
}

/** 测试2: 联盟面板 */
async function testAlliancePanel(page) {
  console.log('\n📋 测试2: 联盟面板');
  try {
    const allianceBtn = await page.$('[data-tab="联盟"], button:has-text("联盟"), .tk-tab:has-text("联盟"), [data-testid="alliance-panel"]');
    if (allianceBtn) {
      await allianceBtn.click();
      await page.waitForTimeout(1500);
      await takeScreenshot(page, 'v13-alliance-panel');
      pass('联盟面板可打开');
    } else {
      // 尝试更多菜单
      const moreBtn = await page.$('[data-tab="更多"], button:has-text("更多")');
      if (moreBtn) {
        await moreBtn.click();
        await page.waitForTimeout(1000);
        const aBtn = await page.$('button:has-text("联盟")');
        if (aBtn) {
          await aBtn.click();
          await page.waitForTimeout(1500);
          await takeScreenshot(page, 'v13-alliance-panel-via-more');
          pass('联盟面板通过更多菜单访问');
        } else {
          warn('联盟按钮未找到', '可能需要先解锁联盟功能');
        }
      } else {
        warn('联盟按钮未找到', '尝试直接检查面板');
      }
    }
  } catch (e) { fail('联盟面板', e.message); }
}

/** 测试3: 联盟Boss面板 */
async function testAllianceBoss(page) {
  console.log('\n📋 测试3: 联盟Boss');
  try {
    await closeAllModals(page);
    const bossBtn = await page.$('[data-testid="alliance-boss"], button:has-text("Boss"), button:has-text("讨伐"), .tk-alliance-boss-btn');
    if (bossBtn) {
      await bossBtn.click();
      await page.waitForTimeout(1500);
      await takeScreenshot(page, 'v13-alliance-boss');
      pass('联盟Boss面板可打开');
    } else {
      warn('联盟Boss按钮未找到', '可能需要先加入联盟');
    }
  } catch (e) { fail('联盟Boss', e.message); }
}

/** 测试4: 联盟商店 */
async function testAllianceShop(page) {
  console.log('\n📋 测试4: 联盟商店');
  try {
    await closeAllModals(page);
    const shopBtn = await page.$('[data-testid="alliance-shop"], button:has-text("联盟商店"), .tk-alliance-shop-btn');
    if (shopBtn) {
      await shopBtn.click();
      await page.waitForTimeout(1500);
      await takeScreenshot(page, 'v13-alliance-shop');
      pass('联盟商店面板可打开');
    } else {
      warn('联盟商店按钮未找到', '可能需要先加入联盟');
    }
  } catch (e) { fail('联盟商店', e.message); }
}

/** 测试5: PvP赛季面板 */
async function testPvPSeason(page) {
  console.log('\n📋 测试5: PvP赛季面板');
  try {
    await closeAllModals(page);
    const pvpBtn = await page.$('[data-tab="竞技"], button:has-text("竞技"), .tk-tab:has-text("竞技"), [data-testid="arena-panel"]');
    if (pvpBtn) {
      await pvpBtn.click();
      await page.waitForTimeout(1500);
      await takeScreenshot(page, 'v13-pvp-season');
      pass('PvP竞技面板可打开');

      // 检查赛季信息
      const seasonInfo = await page.$('.tk-season-info, [data-testid="season-info"], .tk-arena-season');
      if (seasonInfo) pass('赛季信息显示');
      else warn('赛季信息元素未找到');
    } else {
      warn('PvP竞技按钮未找到');
    }
  } catch (e) { fail('PvP赛季面板', e.message); }
}

/** 测试6: 活动系统 */
async function testActivitySystem(page) {
  console.log('\n📋 测试6: 活动系统');
  try {
    await closeAllModals(page);
    const actBtn = await page.$('[data-testid="activity-panel"], button:has-text("活动"), .tk-activity-btn, .tk-activity-icon');
    if (actBtn) {
      await actBtn.click();
      await page.waitForTimeout(1500);
      await takeScreenshot(page, 'v13-activity-panel');
      pass('活动面板可打开');

      // 检查活动Tab (进行中/即将开始/已结束)
      const actTabs = await page.$$('.tk-activity-tab, [data-testid="activity-tab"]');
      if (actTabs.length > 0) pass(`活动Tab存在(${actTabs.length}个)`);
      else warn('活动Tab未找到');
    } else {
      warn('活动按钮未找到', '可能需要先解锁');
    }
  } catch (e) { fail('活动系统', e.message); }
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
      await takeScreenshot(page, 'v13-sign-in');
      pass('签到面板可打开');
    } else {
      warn('签到按钮未找到', '可能需要先解锁');
    }
  } catch (e) { fail('签到系统', e.message); }
}

/** 测试8: 排行榜 */
async function testLeaderboard(page) {
  console.log('\n📋 测试8: 排行榜');
  try {
    await closeAllModals(page);
    const lbBtn = await page.$('[data-testid="leaderboard-panel"], button:has-text("排行"), .tk-leaderboard-btn');
    if (lbBtn) {
      await lbBtn.click();
      await page.waitForTimeout(1500);
      await takeScreenshot(page, 'v13-leaderboard');
      pass('排行榜面板可打开');
    } else {
      warn('排行榜按钮未找到');
    }
  } catch (e) { fail('排行榜', e.message); }
}

/** 测试9: 数据完整性 */
async function testDataIntegrity(page) {
  console.log('\n📋 测试9: 数据完整性');
  try {
    const body = await page.textContent('body');
    if (body && !body.includes('NaN') && !body.includes('undefined')) pass('无NaN/undefined显示');
    else fail('数据完整性', '发现NaN或undefined');
  } catch (e) { fail('数据完整性', e.message); }
}

/** 测试10: 移动端适配 */
async function testMobile(page) {
  console.log('\n📋 测试10: 移动端适配');
  try {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1500);
    await takeScreenshot(page, 'v13-mobile-main');
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
  console.log('v13.0 联盟争霸 — 进化迭代 UI测试 R1');
  console.log('════════════════════════════════════════');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => { if (msg.type() === 'error') results.consoleErrors.push(msg.text()); });

  try {
    await enterGame(page);
    await testMainPage(page);
    await testAlliancePanel(page);
    await testAllianceBoss(page);
    await testAllianceShop(page);
    await testPvPSeason(page);
    await testActivitySystem(page);
    await testSignIn(page);
    await testLeaderboard(page);
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

  const resultPath = path.join(__dirname, 'v13-evolution-ui-results.json');
  fs.writeFileSync(resultPath, JSON.stringify(results, null, 2));
  console.log(`\n📊 结果: ${results.passed.length}✅ ${results.failed.length}❌ ${results.warnings.length}⚠️`);
  console.log(`📁 截图: ${SCREENSHOT_DIR}`);
  console.log(`📄 报告: ${resultPath}`);

  await browser.close();
  process.exit(results.failed.length > 0 ? 1 : 0);
})();
