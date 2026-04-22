/**
 * v10.0 兵强马壮 — 进化迭代 UI测试 R1
 *
 * 测试范围：装备Tab、背包、锻造、强化面板
 * 关键检查点：12个
 */

const { chromium, devices } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.GAME_BASE_URL || 'http://localhost:5173/idle/three-kingdoms';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots', 'v10-evolution');

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
  results.screenshots.push(name + '.png');
  console.log(`  📸 ${name}`);
}

async function enterGame(page) {
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  const startBtn = await page.$('button:has-text("开始游戏")');
  if (startBtn) { await startBtn.click(); await page.waitForTimeout(3000); }
  // dismiss guide
  for (let i = 0; i < 5; i++) {
    const overlay = await page.$('.tk-guide-overlay');
    if (!overlay) break;
    const skip = await page.$('.tk-guide-btn--skip');
    if (skip) { await skip.evaluate(el => el.click()); await page.waitForTimeout(500); continue; }
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  }
}

async function closeAllModals(page) {
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  const close = await page.$('.tk-shared-panel-close') || await page.$('[data-testid="close-btn"]');
  if (close) { await close.click(); await page.waitForTimeout(300); }
}

(async () => {
  console.log('\n🧪 v10.0 兵强马壮 — UI测试 R1\n');
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  // 收集控制台错误
  page.on('console', msg => {
    if (msg.type() === 'error') results.consoleErrors.push(msg.text().substring(0, 200));
  });

  try {
    // ── 1. 主页面加载 ──
    console.log('📦 检查1: 主页面加载');
    await enterGame(page);
    const bodyText = await page.textContent('body') || '';
    if (bodyText.length > 50) { pass('主页面正常加载'); }
    else { fail('主页面加载失败', '页面内容过少'); }
    await takeScreenshot(page, 'v10-01-main');

    // ── 2. 无NaN/undefined ──
    console.log('📦 检查2: 数据完整性');
    const hasNaN = bodyText.includes('NaN');
    const hasUndef = bodyText.includes('undefined');
    if (!hasNaN && !hasUndef) { pass('无NaN/undefined显示'); }
    else { fail('存在NaN/undefined', `${hasNaN ? 'NaN ' : ''}${hasUndef ? 'undefined' : ''}`); }

    // ── 3. 资源栏 ──
    console.log('📦 检查3: 资源栏');
    const resourceBar = await page.$('[data-testid="resource-bar"]') || await page.$('.tk-resource-bar');
    if (resourceBar) { pass('资源栏存在'); }
    else { warn('资源栏未找到', '可能使用不同选择器'); }

    // ── 4. 装备Tab ──
    console.log('📦 检查4: 装备Tab');
    await closeAllModals(page);
    const equipTab = await page.$('[data-testid="tab-equipment"]') || await page.$('button:has-text("装备")') || await page.$('text=装备');
    if (equipTab) {
      await equipTab.click();
      await page.waitForTimeout(1500);
      pass('装备Tab可点击');
      await takeScreenshot(page, 'v10-02-equipment-tab');
    } else {
      fail('装备Tab未找到', 'Tab栏中无装备入口');
      await takeScreenshot(page, 'v10-02-no-equip-tab');
    }

    // ── 5. 装备背包子Tab ──
    console.log('📦 检查5: 装备背包');
    const bagTab = await page.$('[data-testid="subtab-bag"]') || await page.$('button:has-text("背包")') || await page.$('text=背包');
    if (bagTab) {
      await bagTab.click();
      await page.waitForTimeout(1000);
      pass('装备背包子Tab存在');
      await takeScreenshot(page, 'v10-03-bag');
    } else { warn('背包子Tab未找到', '可能需要滚动'); }

    // ── 6. 背包容量显示 ──
    console.log('📦 检查6: 背包容量');
    const capacityText = await page.$('text=/\\d+\\/\\d+/');
    if (capacityText) { pass('背包容量显示'); }
    else { warn('背包容量未显示', '可能无装备数据'); }

    // ── 7. 锻造子Tab ──
    console.log('📦 检查7: 锻造面板');
    const forgeTab = await page.$('[data-testid="subtab-forge"]') || await page.$('button:has-text("锻造")') || await page.$('text=锻造');
    if (forgeTab) {
      await forgeTab.click();
      await page.waitForTimeout(1000);
      pass('锻造子Tab可访问');
      await takeScreenshot(page, 'v10-04-forge');
    } else { warn('锻造子Tab未找到', ''); }

    // ── 8. 强化子Tab ──
    console.log('📦 检查8: 强化面板');
    const enhanceTab = await page.$('[data-testid="subtab-enhance"]') || await page.$('button:has-text("强化")') || await page.$('text=强化');
    if (enhanceTab) {
      await enhanceTab.click();
      await page.waitForTimeout(1000);
      pass('强化子Tab可访问');
      await takeScreenshot(page, 'v10-05-enhance');
    } else { warn('强化子Tab未找到', ''); }

    // ── 9. 品质筛选 ──
    console.log('📦 检查9: 品质筛选');
    const qualityFilter = await page.$('[data-testid="filter-rarity"]') || await page.$('select') || await page.$('text=品质');
    if (qualityFilter) { pass('品质筛选控件存在'); }
    else { warn('品质筛选未找到', ''); }

    // ── 10. 部位筛选 ──
    console.log('📦 检查10: 部位筛选');
    const slotFilter = await page.$('[data-testid="filter-slot"]') || await page.$('text=武器') || await page.$('text=防具');
    if (slotFilter) { pass('部位筛选控件存在'); }
    else { warn('部位筛选未找到', ''); }

    // ── 11. 移动端适配 ──
    console.log('📦 检查11: 移动端适配');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1000);
    const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 10);
    if (!mobileOverflow) { pass('移动端无水平溢出'); }
    else { fail('移动端水平溢出', '页面宽度超出视口'); }
    await takeScreenshot(page, 'v10-06-mobile');

    // ── 12. 控制台错误 ──
    console.log('📦 检查12: 控制台错误');
    if (results.consoleErrors.length === 0) { pass('无控制台错误'); }
    else { warn(`有${results.consoleErrors.length}个控制台错误`, results.consoleErrors.slice(0, 3).join('; ')); }

  } catch (err) {
    fail('测试异常中断', String(err).substring(0, 300));
    await takeScreenshot(page, 'v10-error');
  }

  await browser.close();

  // ── 输出报告 ──
  results.endTime = new Date().toISOString();
  console.log('\n' + '═'.repeat(50));
  console.log(`✅ 通过: ${results.passed.length}`);
  console.log(`❌ 失败: ${results.failed.length}`);
  console.log(`⚠️  警告: ${results.warnings.length}`);
  console.log(`📸 截图: ${results.screenshots.length}`);
  console.log('═'.repeat(50));

  const reportPath = path.join(__dirname, '..', 'docs', 'games', 'three-kingdoms', 'ui-reviews', 'v10.0-review-r1.md');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  const report = `# v10.0 兵强马壮 — UI测试报告 R1

> 测试时间: ${results.startTime}
> 测试脚本: e2e/v10-evolution-ui-test.cjs
> 截图目录: e2e/screenshots/v10-evolution/

## 测试结果

| 指标 | 数值 |
|------|------|
| ✅ 通过 | ${results.passed.length} |
| ❌ 失败 | ${results.failed.length} |
| ⚠️ 警告 | ${results.warnings.length} |
| 📸 截图 | ${results.screenshots.length} |

## 通过项

${results.passed.map((p, i) => `${i + 1}. ✅ ${p}`).join('\n')}

## 失败项

${results.failed.length === 0 ? '无。' : results.failed.map((f, i) => `${i + 1}. ❌ ${f.name} — ${f.detail}`).join('\n')}

## 警告项

${results.warnings.length === 0 ? '无。' : results.warnings.map((w, i) => `${i + 1}. ⚠️ ${w.name} — ${w.detail}`).join('\n')}

## 截图清单

${results.screenshots.map((s, i) => `${i + 1}. 📸 ${s}`).join('\n')}

## 控制台错误

${results.consoleErrors.length === 0 ? '无。' : results.consoleErrors.map(e => `- ${e}`).join('\n')}
`;
  fs.writeFileSync(reportPath, report);
  console.log(`\n📄 报告已生成: ${reportPath}`);
})();
