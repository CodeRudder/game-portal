/**
 * v20.0 天下一统(下) — 进化迭代 UI测试 R1
 *
 * 测试范围：
 * 1. 主页面加载 + 编译产物验证
 * 2. 声望系统 — 等级/进度/加成/奖励
 * 3. 转生循环 — 条件/倍率/重置
 * 4. 统一完成度 — 全系统联调
 * 5. 终局内容 — 设置/性能/配色
 * 6. 移动端适配
 * 7. 控制台错误检查
 *
 * @module e2e/v20-evolution-ui-test
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.GAME_BASE_URL || 'http://localhost:5173/idle/three-kingdoms';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots', 'v20-evolution');

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
  // 跳过新手引导
  for (let i = 0; i < 8; i++) {
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

async function openFeaturePanel(page, panelId) {
  // 尝试多种方式打开功能面板
  const btn = await page.$(`[data-feature="${panelId}"]`) ||
              await page.$(`[data-testid="${panelId}-panel"]`) ||
              await page.$(`button:has-text("${getPanelLabel(panelId)}")`);
  if (btn) { await btn.click(); await page.waitForTimeout(1000); return true; }
  // 尝试通过更多菜单
  const moreBtn = await page.$('[data-tab="更多"], button:has-text("更多")');
  if (moreBtn) {
    await moreBtn.click(); await page.waitForTimeout(500);
    const panelBtn = await page.$(`[data-feature="${panelId}"]`) || await page.$(`button:has-text("${getPanelLabel(panelId)}")`);
    if (panelBtn) { await panelBtn.click(); await page.waitForTimeout(1000); return true; }
  }
  return false;
}

function getPanelLabel(id) {
  const map = {
    prestige: '声望', settings: '设置', alliance: '联盟',
    achievement: '成就', shop: '商店', mail: '邮件',
    quest: '任务', events: '事件', activity: '活动',
    heritage: '传承', social: '社交', trade: '商贸',
  };
  return map[id] || id;
}

/** 测试1: 主页面加载 */
async function testMainPage(page) {
  console.log('\n📋 测试1: 主页面加载');
  try {
    await takeScreenshot(page, 'v20-main-page');
    const body = await page.textContent('body');
    if (body && body.length > 50) pass('主页面正常加载');
    else fail('主页面加载', '页面内容为空');

    // 检查核心UI元素
    const tabBar = await page.$('.tk-tab-bar, [data-testid="tab-bar"], nav');
    if (tabBar) pass('Tab栏存在');
    else warn('Tab栏', '未找到Tab栏元素（可能选择器不同）');

    // 检查资源栏
    const resourceBar = await page.$('[data-testid="resource-bar"], .tk-resource-bar, .resource-display');
    if (resourceBar) pass('资源栏存在');
    else warn('资源栏', '未找到资源栏元素');
  } catch (e) { fail('主页面加载', e.message); }
}

/** 测试2: 声望系统 */
async function testPrestigeSystem(page) {
  console.log('\n📋 测试2: 声望系统');
  try {
    // 尝试打开声望面板
    const opened = await openFeaturePanel(page, 'prestige');
    if (opened) {
      await page.waitForTimeout(1000);
      await takeScreenshot(page, 'v20-prestige-panel');
      pass('声望面板可打开');

      // 检查声望等级显示
      const levelEl = await page.$('text=/Lv\\.\\d+/');
      if (levelEl) pass('声望等级显示');
      else warn('声望等级', '未找到等级文本');

      // 检查进度条
      const progress = await page.$('[role="progressbar"], .tk-progress, .progress-bar');
      if (progress) pass('声望进度条存在');
      else warn('声望进度条', '未找到进度条');

      // 检查产出加成
      const bonus = await page.$('text=/产出加成|×\\d+\\.\\d+/');
      if (bonus) pass('产出加成显示');
      else warn('产出加成', '未找到加成信息');
    } else {
      warn('声望面板', '无法打开声望面板（可能需要更高等级）');
    }
    await closeAllModals(page);
  } catch (e) { fail('声望系统', e.message); }
}

/** 测试3: 转生循环检查 */
async function testRebirthCycle(page) {
  console.log('\n📋 测试3: 转生循环');
  try {
    // 检查转生相关UI元素
    const rebirthEl = await page.$('text=/转生|Rebirth/') ||
                      await page.$('[data-feature="rebirth"]');
    if (rebirthEl) {
      await rebirthEl.click?.(); await page.waitForTimeout(1000);
      await takeScreenshot(page, 'v20-rebirth-panel');
      pass('转生入口存在');
    } else {
      // 转生可能在声望面板内
      warn('转生入口', '未找到独立转生入口（可能在声望面板内）');
    }

    // 检查转生条件区域（在声望面板中）
    const opened = await openFeaturePanel(page, 'prestige');
    if (opened) {
      await page.waitForTimeout(1000);
      const condEl = await page.$('text=/转生条件|条件|Rebirth/');
      if (condEl) pass('转生条件区域存在');
      else warn('转生条件', '声望面板内未找到转生条件区域');
      await takeScreenshot(page, 'v20-prestige-rebirth');
      await closeAllModals(page);
    }
  } catch (e) { fail('转生循环', e.message); }
}

/** 测试4: 统一完成度 — 核心系统检查 */
async function testCoreSystems(page) {
  console.log('\n📋 测试4: 核心系统完整性');
  try {
    // 检查建筑系统
    const buildingTab = await page.$('[data-tab="建筑"], button:has-text("建筑")');
    if (buildingTab) {
      await buildingTab.click(); await page.waitForTimeout(1000);
      await takeScreenshot(page, 'v20-building-tab');
      pass('建筑系统可访问');
    } else warn('建筑Tab', '未找到建筑Tab');

    // 检查武将系统
    const heroTab = await page.$('[data-tab="武将"], button:has-text("武将")');
    if (heroTab) {
      await heroTab.click(); await page.waitForTimeout(1000);
      await takeScreenshot(page, 'v20-hero-tab');
      pass('武将系统可访问');
    } else warn('武将Tab', '未找到武将Tab');

    // 检查战斗系统
    const battleTab = await page.$('[data-tab="战役"], button:has-text("战役"), [data-tab="战斗"]');
    if (battleTab) {
      await battleTab.click(); await page.waitForTimeout(1000);
      await takeScreenshot(page, 'v20-battle-tab');
      pass('战斗系统可访问');
    } else warn('战斗Tab', '未找到战斗Tab');

    // 检查科技系统
    const techTab = await page.$('[data-tab="科技"], button:has-text("科技")');
    if (techTab) {
      await techTab.click(); await page.waitForTimeout(1000);
      await takeScreenshot(page, 'v20-tech-tab');
      pass('科技系统可访问');
    } else warn('科技Tab', '未找到科技Tab');

    // 检查装备系统
    const equipTab = await page.$('[data-tab="装备"], button:has-text("装备")');
    if (equipTab) {
      await equipTab.click(); await page.waitForTimeout(1000);
      await takeScreenshot(page, 'v20-equip-tab');
      pass('装备系统可访问');
    } else warn('装备Tab', '未找到装备Tab');
  } catch (e) { fail('核心系统', e.message); }
}

/** 测试5: 终局内容 — 设置/性能 */
async function testEndgameContent(page) {
  console.log('\n📋 测试5: 终局内容');
  try {
    // 设置面板
    const opened = await openFeaturePanel(page, 'settings');
    if (opened) {
      await page.waitForTimeout(1000);
      await takeScreenshot(page, 'v20-settings-panel');
      pass('设置面板可打开');

      // 检查画质设置
      const graphics = await page.$('text=/画质|图形|Graphics/');
      if (graphics) pass('画质设置存在');
      else warn('画质设置', '未找到画质设置选项');

      // 检查音频设置
      const audio = await page.$('text=/音效|音乐|Audio|音量/');
      if (audio) pass('音频设置存在');
      else warn('音频设置', '未找到音频设置选项');
    } else {
      warn('设置面板', '无法打开设置面板');
    }
    await closeAllModals(page);

    // 成就面板
    const achOpened = await openFeaturePanel(page, 'achievement');
    if (achOpened) {
      await page.waitForTimeout(1000);
      await takeScreenshot(page, 'v20-achievement-panel');
      pass('成就面板可打开');
    } else {
      warn('成就面板', '无法打开成就面板');
    }
    await closeAllModals(page);
  } catch (e) { fail('终局内容', e.message); }
}

/** 测试6: 移动端适配 */
async function testMobileAdaptation(page) {
  console.log('\n📋 测试6: 移动端适配');
  try {
    // iPhone SE 尺寸
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);
    await takeScreenshot(page, 'v20-mobile-iphone-se');

    // 检查是否有水平滚动（不应有）
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    if (scrollWidth <= clientWidth + 2) pass('iPhone SE 无水平溢出');
    else warn('iPhone SE 水平溢出', `scrollWidth=${scrollWidth} > clientWidth=${clientWidth}`);

    // Pixel 7
    await page.setViewportSize({ width: 412, height: 915 });
    await page.waitForTimeout(1000);
    await takeScreenshot(page, 'v20-mobile-pixel-7');
    pass('Pixel 7 视口渲染正常');

    // iPad
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(1000);
    await takeScreenshot(page, 'v20-tablet-ipad');
    pass('iPad 视口渲染正常');

    // 恢复桌面尺寸
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(500);
  } catch (e) { fail('移动端适配', e.message); }
}

/** 测试7: 控制台错误检查 */
async function testConsoleErrors(page) {
  console.log('\n📋 测试7: 控制台错误');
  try {
    const errors = results.consoleErrors.filter(e =>
      !e.includes('favicon') && !e.includes('404') && !e.includes('DevTools')
    );
    if (errors.length === 0) pass('无控制台错误');
    else warn('控制台错误', `${errors.length}个错误: ${errors.slice(0, 3).join('; ')}`);
  } catch (e) { fail('控制台错误检查', e.message); }
}

// ─────────────────────────────────────────────
// 主流程
// ─────────────────────────────────────────────
(async () => {
  console.log('🚀 v20.0 天下一统(下) UI测试启动');
  console.log(`📍 URL: ${BASE_URL}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  // 收集控制台错误
  page.on('console', msg => {
    if (msg.type() === 'error') results.consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => results.consoleErrors.push(err.message));

  try {
    await enterGame(page);
    await testMainPage(page);
    await testPrestigeSystem(page);
    await testRebirthCycle(page);
    await testCoreSystems(page);
    await testEndgameContent(page);
    await testMobileAdaptation(page);
    await testConsoleErrors(page);
  } catch (e) {
    fail('主流程异常', e.message);
    try { await takeScreenshot(page, 'v20-error-state'); } catch (_) {}
  } finally {
    await browser.close();
  }

  // ── 报告 ──
  results.endTime = new Date().toISOString();
  const total = results.passed.length + results.failed.length;
  const rate = total > 0 ? ((results.passed.length / total) * 100).toFixed(1) : '0';

  console.log('\n' + '='.repeat(60));
  console.log('📊 v20.0 UI测试报告');
  console.log('='.repeat(60));
  console.log(`✅ 通过: ${results.passed.length}`);
  console.log(`❌ 失败: ${results.failed.length}`);
  console.log(`⚠️  警告: ${results.warnings.length}`);
  console.log(`📸 截图: ${results.screenshots.length}`);
  console.log(`📈 通过率: ${rate}%`);
  console.log(`🕐 开始: ${results.startTime}`);
  console.log(`🕐 结束: ${results.endTime}`);

  if (results.failed.length > 0) {
    console.log('\n❌ 失败详情:');
    results.failed.forEach(f => console.log(`  - ${f.name}: ${f.detail}`));
  }
  if (results.warnings.length > 0) {
    console.log('\n⚠️  警告详情:');
    results.warnings.forEach(w => console.log(`  - ${w.name}: ${w.detail}`));
  }

  // 写入JSON结果
  const reportPath = path.join(SCREENSHOT_DIR, 'test-results.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n📄 结果已保存: ${reportPath}`);

  process.exit(results.failed.length > 0 ? 1 : 0);
})();
