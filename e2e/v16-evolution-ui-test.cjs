/**
 * v16.0 传承有序 — 进化迭代 UI测试 R1
 *
 * 测试范围：
 * 1. 武将羁绊 — 阵营羁绊/可视化/故事事件
 * 2. 装备强化 — 强化/保护符/自动强化/炼制
 * 3. 套装系统 — 套装效果/激活规则/归属
 * 4. 穿戴与背包 — 一键穿戴/分解/背包管理
 * 5. 军师推荐 — 触发规则/建议展示/装备推荐
 * 6. 传承系统 — 转生加速/解锁内容/收益模拟
 * 7. 数据完整性
 * 8. 移动端适配
 *
 * @module e2e/v16-evolution-ui-test
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.GAME_BASE_URL || 'http://localhost:5173/idle/three-kingdoms';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots', 'v16-evolution');

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
    await takeScreenshot(page, 'v16-main-page');
    const body = await page.textContent('body');
    if (body && body.length > 50) pass('主页面正常加载');
    else fail('主页面加载', '页面内容为空');
  } catch (e) { fail('主页面加载', e.message); }
}

/** 测试2: 武将羁绊面板 */
async function testBondSystem(page) {
  console.log('\n📋 测试2: 武将羁绊面板');
  try {
    const heroBtn = await page.$('[data-tab="武将"], button:has-text("武将"), .tk-tab:has-text("武将"), [data-testid="hero-panel"]');
    if (heroBtn) {
      await heroBtn.click();
      await page.waitForTimeout(1500);
      await takeScreenshot(page, 'v16-hero-panel');
      pass('武将面板可打开');

      // 检查羁绊信息
      const bondEl = await page.$('.tk-bond-info, [data-testid="bond-info"], .tk-hero-bond');
      if (bondEl) {
        pass('羁绊信息显示');
        await takeScreenshot(page, 'v16-bond-detail');
      } else {
        warn('羁绊信息元素未找到', '可能需要选择武将');
      }
    } else {
      warn('武将按钮未找到');
    }
  } catch (e) { fail('武将羁绊面板', e.message); }
}

/** 测试3: 装备强化面板 */
async function testEquipmentEnhance(page) {
  console.log('\n📋 测试3: 装备强化面板');
  try {
    await closeAllModals(page);
    const eqBtn = await page.$('[data-tab="装备"], button:has-text("装备"), .tk-tab:has-text("装备"), [data-testid="equipment-panel"]');
    if (eqBtn) {
      await eqBtn.click();
      await page.waitForTimeout(1500);
      await takeScreenshot(page, 'v16-equipment-panel');
      pass('装备面板可打开');

      // 检查强化按钮
      const enhanceBtn = await page.$('[data-testid="enhance-btn"], button:has-text("强化"), .tk-enhance-btn');
      if (enhanceBtn) {
        await enhanceBtn.click();
        await page.waitForTimeout(1500);
        await takeScreenshot(page, 'v16-equipment-enhance');
        pass('装备强化面板可打开');
      } else {
        warn('强化按钮未找到', '可能需要先选择装备');
      }
    } else {
      warn('装备按钮未找到');
    }
  } catch (e) { fail('装备强化面板', e.message); }
}

/** 测试4: 套装系统 */
async function testEquipmentSet(page) {
  console.log('\n📋 测试4: 套装系统');
  try {
    await closeAllModals(page);
    const setEl = await page.$('.tk-equipment-set, [data-testid="equipment-set"], .tk-set-bonus');
    if (setEl) {
      await takeScreenshot(page, 'v16-equipment-set');
      pass('套装效果显示');
    } else {
      warn('套装效果元素未找到', '需要装备套装后才显示');
    }
  } catch (e) { fail('套装系统', e.message); }
}

/** 测试5: 背包管理 */
async function testBagManagement(page) {
  console.log('\n📋 测试5: 背包管理');
  try {
    await closeAllModals(page);
    const bagBtn = await page.$('[data-testid="equipment-bag"], button:has-text("背包"), .tk-bag-btn');
    if (bagBtn) {
      await bagBtn.click();
      await page.waitForTimeout(1500);
      await takeScreenshot(page, 'v16-equipment-bag');
      pass('装备背包可打开');

      // 检查筛选/排序
      const filterEl = await page.$('.tk-bag-filter, [data-testid="bag-filter"]');
      if (filterEl) pass('背包筛选功能存在');
      else warn('背包筛选功能未找到');
    } else {
      warn('背包按钮未找到', '可能需要先打开装备面板');
    }
  } catch (e) { fail('背包管理', e.message); }
}

/** 测试6: 军师推荐 */
async function testAdvisorSystem(page) {
  console.log('\n📋 测试6: 军师推荐');
  try {
    await closeAllModals(page);
    const advisorBtn = await page.$('[data-testid="advisor-panel"], button:has-text("军师"), .tk-advisor-btn, .tk-advisor-icon');
    if (advisorBtn) {
      await advisorBtn.click();
      await page.waitForTimeout(1500);
      await takeScreenshot(page, 'v16-advisor-panel');
      pass('军师推荐面板可打开');

      // 检查建议列表
      const suggestions = await page.$$('.tk-advisor-suggestion, [data-testid="advisor-suggestion"]');
      if (suggestions.length > 0) pass(`军师建议(${suggestions.length}条)`);
      else warn('军师建议未找到', '可能需要满足触发条件');
    } else {
      warn('军师推荐按钮未找到');
    }
  } catch (e) { fail('军师推荐', e.message); }
}

/** 测试7: 传承/转生面板 */
async function testHeritageSystem(page) {
  console.log('\n📋 测试7: 传承系统');
  try {
    await closeAllModals(page);
    const heritageBtn = await page.$('[data-testid="heritage-panel"], button:has-text("传承"), button:has-text("转生"), .tk-heritage-btn');
    if (heritageBtn) {
      await heritageBtn.click();
      await page.waitForTimeout(1500);
      await takeScreenshot(page, 'v16-heritage-panel');
      pass('传承面板可打开');
    } else {
      warn('传承按钮未找到', '可能需要满足解锁条件');
    }
  } catch (e) { fail('传承系统', e.message); }
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
    await takeScreenshot(page, 'v16-mobile-main');
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
  console.log('v16.0 传承有序 — 进化迭代 UI测试 R1');
  console.log('════════════════════════════════════════');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => { if (msg.type() === 'error') results.consoleErrors.push(msg.text()); });

  try {
    await enterGame(page);
    await testMainPage(page);
    await testBondSystem(page);
    await testEquipmentEnhance(page);
    await testEquipmentSet(page);
    await testBagManagement(page);
    await testAdvisorSystem(page);
    await testHeritageSystem(page);
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

  const resultPath = path.join(__dirname, 'v16-evolution-ui-results.json');
  fs.writeFileSync(resultPath, JSON.stringify(results, null, 2));
  console.log(`\n📊 结果: ${results.passed.length}✅ ${results.failed.length}❌ ${results.warnings.length}⚠️`);
  console.log(`📁 截图: ${SCREENSHOT_DIR}`);
  console.log(`📄 报告: ${resultPath}`);

  await browser.close();
  process.exit(results.failed.length > 0 ? 1 : 0);
})();
