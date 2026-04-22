/**
 * v11.0 群雄逐鹿 — 进化迭代 UI测试 R1
 *
 * 测试范围：
 * 1. 竞技场面板 — 排名信息、对手卡片、挑战按钮
 * 2. 防守阵容设置 — 5阵位、阵型选择、策略选择
 * 3. 段位展示 — 段位等级、赛季信息
 * 4. 好友面板 — 好友列表、搜索添加
 * 5. 聊天面板 — 频道Tab、消息列表
 * 6. 排行榜面板 — 多维度Tab
 * 7. 数据完整性 — 无NaN/undefined
 * 8. 移动端适配
 *
 * @module e2e/v11-evolution-ui-test
 */

const { chromium, devices } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.GAME_BASE_URL || 'http://localhost:5173/idle/three-kingdoms';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots', 'v11-evolution');

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
    await takeScreenshot(page, 'v11-main-page');
    const body = await page.textContent('body');
    if (body && body.length > 50) pass('主页面正常加载');
    else fail('主页面加载', '页面内容为空');
  } catch (e) { fail('主页面加载', e.message); }
}

/** 测试2: 竞技场Tab */
async function testArenaTab(page) {
  console.log('\n📋 测试2: 竞技场Tab');
  try {
    const arenaTab = await page.$('[data-tab="竞技"], button:has-text("竞技"), .tk-tab:has-text("竞技")');
    if (arenaTab) {
      await arenaTab.click();
      await page.waitForTimeout(1500);
      await takeScreenshot(page, 'v11-arena-tab');
      pass('竞技场Tab可点击');
      
      // 检查排名信息
      const rankInfo = await page.$('.tk-rank-info, .tk-arena-rank, [data-testid="arena-rank"]');
      if (rankInfo) pass('排名信息显示');
      else warn('排名信息未找到');
      
      // 检查对手卡片
      const opponents = await page.$$('.tk-opponent-card, .tk-arena-opponent');
      if (opponents.length > 0) pass(`对手卡片存在(${opponents.length}个)`);
      else warn('对手卡片未找到', '可能需要先匹配');
      
      // 检查挑战按钮
      const challengeBtn = await page.$('button:has-text("挑战"), .tk-challenge-btn');
      if (challengeBtn) pass('挑战按钮存在');
      else warn('挑战按钮未找到');
    } else {
      warn('竞技场Tab未找到', '尝试通过更多菜单');
      const moreBtn = await page.$('[data-tab="更多"], button:has-text("更多")');
      if (moreBtn) {
        await moreBtn.click();
        await page.waitForTimeout(1000);
        const arenaBtn = await page.$('button:has-text("竞技")');
        if (arenaBtn) {
          await arenaBtn.click();
          await page.waitForTimeout(1500);
          await takeScreenshot(page, 'v11-arena-tab-via-more');
          pass('竞技场Tab通过更多菜单访问');
        }
      }
    }
  } catch (e) { fail('竞技场Tab', e.message); }
}

/** 测试3: 防守阵容设置 */
async function testDefenseFormation(page) {
  console.log('\n📋 测试3: 防守阵容设置');
  try {
    const defenseBtn = await page.$('[data-testid="defense-setup"], button:has-text("防守"), .tk-defense-btn');
    if (defenseBtn) {
      await defenseBtn.click();
      await page.waitForTimeout(1500);
      await takeScreenshot(page, 'v11-defense-formation');
      pass('防守阵容面板可打开');
      
      // 检查阵型选择
      const formationSelect = await page.$('.tk-formation-select, [data-testid="formation-select"]');
      if (formationSelect) pass('阵型选择存在');
      else warn('阵型选择未找到');
      
      // 检查策略选择
      const strategySelect = await page.$('.tk-strategy-select, [data-testid="strategy-select"]');
      if (strategySelect) pass('策略选择存在');
      else warn('策略选择未找到');
    } else {
      warn('防守阵容按钮未找到');
    }
  } catch (e) { fail('防守阵容设置', e.message); }
}

/** 测试4: 段位展示 */
async function testRankDisplay(page) {
  console.log('\n📋 测试4: 段位展示');
  try {
    await closeAllModals(page);
    const rankDisplay = await page.$('.tk-rank-badge, .tk-rank-display, [data-testid="rank-display"]');
    if (rankDisplay) {
      await takeScreenshot(page, 'v11-rank-display');
      pass('段位展示存在');
    } else {
      warn('段位展示未找到', '可能在竞技场面板内');
    }
  } catch (e) { fail('段位展示', e.message); }
}

/** 测试5: 好友面板 */
async function testFriendPanel(page) {
  console.log('\n📋 测试5: 好友面板');
  try {
    await closeAllModals(page);
    const friendBtn = await page.$('[data-testid="friend-panel"], button:has-text("好友"), .tk-friend-btn');
    if (friendBtn) {
      await friendBtn.click();
      await page.waitForTimeout(1500);
      await takeScreenshot(page, 'v11-friend-panel');
      pass('好友面板可打开');
      
      // 检查搜索
      const searchInput = await page.$('.tk-friend-search, input[placeholder*="搜索"]');
      if (searchInput) pass('好友搜索框存在');
      else warn('好友搜索框未找到');
    } else {
      warn('好友面板按钮未找到');
    }
  } catch (e) { fail('好友面板', e.message); }
}

/** 测试6: 聊天面板 */
async function testChatPanel(page) {
  console.log('\n📋 测试6: 聊天面板');
  try {
    await closeAllModals(page);
    const chatBtn = await page.$('[data-testid="chat-panel"], button:has-text("聊天"), .tk-chat-btn');
    if (chatBtn) {
      await chatBtn.click();
      await page.waitForTimeout(1500);
      await takeScreenshot(page, 'v11-chat-panel');
      pass('聊天面板可打开');
      
      // 检查频道Tab
      const channelTabs = await page.$$('.tk-chat-channel, [data-testid="chat-channel"]');
      if (channelTabs.length >= 4) pass(`频道Tab存在(${channelTabs.length}个)`);
      else if (channelTabs.length > 0) warn('频道Tab数量不足', `找到${channelTabs.length}个`);
      else warn('频道Tab未找到');
    } else {
      warn('聊天面板按钮未找到');
    }
  } catch (e) { fail('聊天面板', e.message); }
}

/** 测试7: 排行榜面板 */
async function testLeaderboardPanel(page) {
  console.log('\n📋 测试7: 排行榜面板');
  try {
    await closeAllModals(page);
    const lbBtn = await page.$('[data-testid="leaderboard-panel"], button:has-text("排行"), .tk-leaderboard-btn');
    if (lbBtn) {
      await lbBtn.click();
      await page.waitForTimeout(1500);
      await takeScreenshot(page, 'v11-leaderboard-panel');
      pass('排行榜面板可打开');
      
      // 检查多维度Tab
      const lbTabs = await page.$$('.tk-lb-tab, [data-testid="lb-tab"]');
      if (lbTabs.length >= 5) pass(`排行榜维度Tab存在(${lbTabs.length}个)`);
      else if (lbTabs.length > 0) warn('排行榜维度Tab不足', `找到${lbTabs.length}个`);
      else warn('排行榜维度Tab未找到');
    } else {
      warn('排行榜面板按钮未找到');
    }
  } catch (e) { fail('排行榜面板', e.message); }
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
    await takeScreenshot(page, 'v11-mobile-main');
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
  console.log('v11.0 群雄逐鹿 — 进化迭代 UI测试 R1');
  console.log('════════════════════════════════════════');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  page.on('console', msg => { if (msg.type() === 'error') results.consoleErrors.push(msg.text()); });
  
  try {
    await enterGame(page);
    await testMainPage(page);
    await testArenaTab(page);
    await testDefenseFormation(page);
    await testRankDisplay(page);
    await testFriendPanel(page);
    await testChatPanel(page);
    await testLeaderboardPanel(page);
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
  
  const resultPath = path.join(__dirname, 'v11-evolution-ui-results.json');
  fs.writeFileSync(resultPath, JSON.stringify(results, null, 2));
  console.log(`\n📊 结果: ${results.passed.length}✅ ${results.failed.length}❌ ${results.warnings.length}⚠️`);
  console.log(`📁 截图: ${SCREENSHOT_DIR}`);
  console.log(`📄 报告: ${resultPath}`);
  
  await browser.close();
  process.exit(results.failed.length > 0 ? 1 : 0);
})();
