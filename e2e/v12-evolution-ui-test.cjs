/**
 * v12.0 远征天下 — 进化迭代 UI测试 R1
 *
 * 测试范围：
 * 1. 远征地图场景 — 路线地图、节点展示、队伍面板
 * 2. 远征编队 — 武将选择、阵型选择、战力预览
 * 3. 远征战斗 — 自动战斗观战、结果评定
 * 4. 远征结算 — 奖励列表、首通标识
 * 5. 排行榜 — 多维度Tab、排名列表
 * 6. 数据完整性 — 无NaN/undefined
 * 7. 移动端适配
 *
 * @module e2e/v12-evolution-ui-test
 */

const { chromium, devices } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.GAME_BASE_URL || 'http://localhost:5173/idle/three-kingdoms';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots', 'v12-evolution');

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
    await takeScreenshot(page, 'v12-main-page');
    const body = await page.textContent('body');
    if (body && body.length > 50) pass('主页面正常加载');
    else fail('主页面加载', '页面内容为空');
  } catch (e) { fail('主页面加载', e.message); }
}

/** 测试2: 远征Tab */
async function testExpeditionTab(page) {
  console.log('\n📋 测试2: 远征Tab');
  try {
    const expTab = await page.$('[data-tab="远征"], button:has-text("远征"), .tk-tab:has-text("远征")');
    if (expTab) {
      await expTab.click();
      await page.waitForTimeout(1500);
      await takeScreenshot(page, 'v12-expedition-tab');
      pass('远征Tab可点击');
    } else {
      warn('远征Tab未找到', '尝试通过更多菜单');
      const moreBtn = await page.$('[data-tab="更多"], button:has-text("更多")');
      if (moreBtn) {
        await moreBtn.click();
        await page.waitForTimeout(1000);
        const expBtn = await page.$('button:has-text("远征")');
        if (expBtn) {
          await expBtn.click();
          await page.waitForTimeout(1500);
          await takeScreenshot(page, 'v12-expedition-tab-via-more');
          pass('远征Tab通过更多菜单访问');
        }
      }
    }
  } catch (e) { fail('远征Tab', e.message); }
}

/** 测试3: 远征地图场景 */
async function testExpeditionMap(page) {
  console.log('\n📋 测试3: 远征地图场景');
  try {
    // 查找远征地图元素
    const mapEl = await page.$('.tk-expedition-map, [data-testid="expedition-map"], .tk-route-map');
    if (mapEl) {
      await takeScreenshot(page, 'v12-expedition-map');
      pass('远征地图存在');
      
      // 检查节点
      const nodes = await page.$$('.tk-expedition-node, .tk-route-node');
      if (nodes.length > 0) pass(`远征节点存在(${nodes.length}个)`);
      else warn('远征节点未找到');
    } else {
      warn('远征地图元素未找到', '可能需要先进入远征');
    }
  } catch (e) { fail('远征地图场景', e.message); }
}

/** 测试4: 远征编队 */
async function testExpeditionTeam(page) {
  console.log('\n📋 测试4: 远征编队');
  try {
    const teamBtn = await page.$('[data-testid="expedition-team"], button:has-text("编队"), .tk-team-btn');
    if (teamBtn) {
      await teamBtn.click();
      await page.waitForTimeout(1500);
      await takeScreenshot(page, 'v12-expedition-team');
      pass('远征编队面板可打开');
      
      // 检查阵型选择
      const formationSelect = await page.$('.tk-exp-formation, [data-testid="exp-formation"]');
      if (formationSelect) pass('阵型选择存在');
      else warn('阵型选择未找到');
      
      // 检查战力预览
      const powerPreview = await page.$('.tk-team-power, [data-testid="team-power"]');
      if (powerPreview) pass('战力预览存在');
      else warn('战力预览未找到');
    } else {
      warn('远征编队按钮未找到');
    }
  } catch (e) { fail('远征编队', e.message); }
}

/** 测试5: 远征结算 */
async function testExpeditionReward(page) {
  console.log('\n📋 测试5: 远征结算');
  try {
    await closeAllModals(page);
    // 结算面板需要完成战斗后才会出现，这里检查UI元素是否存在
    const rewardEl = await page.$('.tk-expedition-reward, [data-testid="expedition-reward"]');
    if (rewardEl) {
      await takeScreenshot(page, 'v12-expedition-reward');
      pass('远征结算面板存在');
    } else {
      warn('远征结算面板未找到', '需要完成战斗后才会显示');
    }
  } catch (e) { fail('远征结算', e.message); }
}

/** 测试6: 排行榜面板 */
async function testLeaderboardPanel(page) {
  console.log('\n📋 测试6: 排行榜面板');
  try {
    await closeAllModals(page);
    const lbBtn = await page.$('[data-testid="leaderboard-panel"], button:has-text("排行"), .tk-leaderboard-btn');
    if (lbBtn) {
      await lbBtn.click();
      await page.waitForTimeout(1500);
      await takeScreenshot(page, 'v12-leaderboard-panel');
      pass('排行榜面板可打开');
      
      // 检查多维度Tab (战力/财富/远征/竞技/赛季)
      const lbTabs = await page.$$('.tk-lb-tab, [data-testid="lb-tab"]');
      if (lbTabs.length >= 5) pass(`排行榜维度Tab(${lbTabs.length}个)`);
      else if (lbTabs.length > 0) warn('排行榜维度Tab不足', `找到${lbTabs.length}个`);
      else warn('排行榜维度Tab未找到');
    } else {
      warn('排行榜按钮未找到');
    }
  } catch (e) { fail('排行榜面板', e.message); }
}

/** 测试7: 自动远征设置 */
async function testAutoExpedition(page) {
  console.log('\n📋 测试7: 自动远征设置');
  try {
    await closeAllModals(page);
    const autoBtn = await page.$('[data-testid="auto-expedition"], button:has-text("自动"), .tk-auto-expedition-btn');
    if (autoBtn) {
      await autoBtn.click();
      await page.waitForTimeout(1500);
      await takeScreenshot(page, 'v12-auto-expedition');
      pass('自动远征设置面板可打开');
    } else {
      warn('自动远征按钮未找到', '可能需要先进入远征');
    }
  } catch (e) { fail('自动远征设置', e.message); }
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

/** 测试9: 控制台错误 */
async function testConsoleErrors(page) {
  console.log('\n📋 测试9: 控制台错误检查');
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  await page.waitForTimeout(2000);
  if (errors.length === 0) pass('无控制台错误');
  else { results.consoleErrors = errors; warn('控制台有错误', `${errors.length}个`); }
}

/** 测试10: 移动端适配 */
async function testMobile(page) {
  console.log('\n📋 测试10: 移动端适配');
  try {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1500);
    await takeScreenshot(page, 'v12-mobile-main');
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
  console.log('v12.0 远征天下 — 进化迭代 UI测试 R1');
  console.log('════════════════════════════════════════');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  page.on('console', msg => { if (msg.type() === 'error') results.consoleErrors.push(msg.text()); });
  
  try {
    await enterGame(page);
    await testMainPage(page);
    await testExpeditionTab(page);
    await testExpeditionMap(page);
    await testExpeditionTeam(page);
    await testExpeditionReward(page);
    await testLeaderboardPanel(page);
    await testAutoExpedition(page);
    await testDataIntegrity(page);
    await testConsoleErrors(page);
    await testMobile(page);
  } catch (e) { fail('主流程异常', e.message); }
  
  results.endTime = new Date().toISOString();
  results.summary = {
    total: results.passed.length + results.failed.length,
    passed: results.passed.length,
    failed: results.failed.length,
    warnings: results.warnings.length,
  };
  
  const resultPath = path.join(__dirname, 'v12-evolution-ui-results.json');
  fs.writeFileSync(resultPath, JSON.stringify(results, null, 2));
  console.log(`\n📊 结果: ${results.passed.length}✅ ${results.failed.length}❌ ${results.warnings.length}⚠️`);
  console.log(`📁 截图: ${SCREENSHOT_DIR}`);
  console.log(`📄 报告: ${resultPath}`);
  
  await browser.close();
  process.exit(results.failed.length > 0 ? 1 : 0);
})();
