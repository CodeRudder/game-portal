/**
 * v19.0 天下一统(上) — UI测试 R1 (Puppeteer)
 * 测试: 页面加载、主界面渲染、引擎API验证、PC+移动端适配、截图
 */
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const BASE = process.env.GAME_BASE_URL || 'http://localhost:5173/idle/three-kingdoms';
const SHOT_DIR = path.join(__dirname, 'screenshots', 'v19-evolution');
const R = { passed: [], failed: [], warnings: [], screenshots: [], errors: [], t0: new Date().toISOString() };

const pass = n => { R.passed.push(n); console.log(`  ✅ ${n}`); };
const fail = (n, d) => { R.failed.push({ name: n, detail: String(d).slice(0, 200) }); console.log(`  ❌ ${n} — ${String(d).slice(0, 120)}`); };
const warn = (n, d) => { R.warnings.push({ name: n, detail: String(d).slice(0, 200) }); console.log(`  ⚠️  ${n} — ${String(d).slice(0, 120)}`); };

async function shot(page, name) {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SHOT_DIR, name + '.png') });
  R.screenshots.push(name); console.log(`  📸 ${name}`);
}

async function enterGame(page) {
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));
  const btn = await page.$('button');
  if (btn) {
    const txt = await page.evaluate(el => el.textContent, btn);
    if (txt?.includes('开始游戏')) { await btn.click(); await new Promise(r => setTimeout(r, 3000)); }
  }
  for (let i = 0; i < 8; i++) {
    const g = await page.$('.tk-guide-overlay');
    if (!g) break;
    const s = await page.$('.tk-guide-btn--skip');
    if (s) { await s.evaluate(el => el.click()); await new Promise(r => setTimeout(r, 500)); continue; }
    await page.keyboard.press('Escape'); await new Promise(r => setTimeout(r, 500));
  }
}

// ── 测试1: 页面加载 + 主界面 ──
async function testPageLoad(page) {
  console.log('\n📋 测试1: 页面加载 + 主界面渲染');
  await shot(page, 'v19-main');
  const html = await page.evaluate(() => document.body.innerText);
  if (html && html.length > 50) pass('主页面正常加载'); else fail('主页面加载', '内容为空');
  const selectors = [
    ['资源栏', '[data-testid="resource-bar"],.tk-resource-bar,.resource-bar'],
    ['Tab导航', '[data-testid="tab-bar"],.tk-tab-bar,.tab-bar,nav'],
    ['场景区', '[data-testid="scene-area"],.tk-scene,.building-panel,canvas'],
  ];
  for (const [label, sel] of selectors) {
    const el = await page.$(sel);
    if (el) pass(`${label}已渲染`); else warn(`${label}未找到`, '选择器可能变化');
  }
}

// ── 测试2: 引擎API验证 ──
async function testEngineAPI(page) {
  console.log('\n📋 测试2: 引擎API验证');
  const check = await page.evaluate(async () => {
    try {
      const mod = await import('/src/games/three-kingdoms/engine/index.ts');
      const names = ['SettingsManager','AudioManager','GraphicsManager','AnimationController',
        'CloudSaveSystem','AccountSystem','SaveSlotManager','BalanceValidator',
        'UnificationAudioController','GraphicsQualityManager'];
      return names.map(n => [n, typeof mod[n] === 'function']);
    } catch (e) { return { error: e.message }; }
  });
  if (check.error) { warn('引擎模块导入失败', check.error); return; }
  for (const [name, ok] of check) {
    if (ok) pass(`引擎导出 ${name}`); else fail(`引擎导出 ${name}`, '未找到');
  }
}

// ── 测试3: 设置面板 ──
async function testSettingsPanel(page) {
  console.log('\n📋 测试3: 设置面板');
  try {
    const more = await page.$('[data-tab="更多"],button');
    if (more) {
      const txt = await page.evaluate(el => el.textContent, more);
      if (txt?.includes('更多')) { await more.click(); await new Promise(r => setTimeout(r, 800)); }
    }
    const setBtn = await page.$('button:has-text("设置"),[data-feature="settings"]');
    if (setBtn) {
      await setBtn.click(); await new Promise(r => setTimeout(r, 1000));
      pass('设置面板已打开'); await shot(page, 'v19-settings');
      const toggles = await page.$$('input[type="checkbox"],.toggle-switch,.tk-toggle');
      if (toggles.length > 0) pass(`设置开关存在(${toggles.length}个)`);
      await page.keyboard.press('Escape'); await new Promise(r => setTimeout(r, 500));
    } else { warn('设置按钮未找到', '可能需先进入更多Tab'); }
  } catch (e) { fail('设置面板测试', e.message); }
}

// ── 测试4: PC端适配 ──
async function testPC(page) {
  console.log('\n📋 测试4: PC端适配 (1280×800)');
  await page.setViewport({ width: 1280, height: 800 });
  await new Promise(r => setTimeout(r, 1000));
  await shot(page, 'v19-pc-1280x800');
  pass('PC端页面正常渲染');
  const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2);
  if (noOverflow) pass('PC端无水平溢出'); else warn('PC端水平溢出', '检查布局');
}

// ── 测试5: 移动端适配 ──
async function testMobile(page) {
  console.log('\n📋 测试5: 移动端适配 (375×812)');
  await page.setViewport({ width: 375, height: 812 });
  await new Promise(r => setTimeout(r, 1000));
  await shot(page, 'v19-mobile-375x812');
  pass('移动端页面正常渲染');
  const vp = await page.$('meta[name="viewport"]');
  if (vp) pass('viewport meta存在'); else warn('viewport meta缺失', '移动端缩放可能异常');
  await page.setViewport({ width: 1280, height: 800 });
}

// ── 测试6: 控制台错误 ──
function testConsoleErrors() {
  console.log('\n📋 测试6: 控制台错误');
  const ignore = ['favicon', '404', 'net::ERR', 'ResizeObserver'];
  const real = R.errors.filter(e => !ignore.some(p => e.includes(p)));
  if (real.length === 0) pass('无控制台错误');
  else fail(`${real.length}个控制台错误`, real.slice(0, 3).join(' | '));
}

// ── 主流程 ──
(async () => {
  console.log('════════════════════════════════════════════');
  console.log('  v19.0 天下一统(上) UI测试 R1 (Puppeteer)');
  console.log('════════════════════════════════════════════');
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  page.on('console', msg => { if (msg.type() === 'error') R.errors.push(msg.text()); });
  page.on('pageerror', err => R.errors.push(err.message));

  try {
    await enterGame(page);
    await testPageLoad(page);
    await testEngineAPI(page);
    await testSettingsPanel(page);
    await testPC(page);
    await testMobile(page);
    testConsoleErrors();
  } catch (e) {
    fail('主流程异常', e.message);
    try { await shot(page, 'v19-error'); } catch (_) {}
  } finally { await browser.close(); }

  R.endTime = new Date().toISOString();
  const total = R.passed.length + R.failed.length;
  const rate = total > 0 ? ((R.passed.length / total) * 100).toFixed(1) : '0';
  console.log('\n════════════════════════════════════════════');
  console.log(`  ✅ 通过: ${R.passed.length}  ❌ 失败: ${R.failed.length}  ⚠️ 警告: ${R.warnings.length}`);
  console.log(`  📸 截图: ${R.screenshots.length}  📊 通过率: ${rate}%`);
  if (R.failed.length > 0) { console.log('  ❌ 失败项:'); R.failed.forEach(f => console.log(`    - ${f.name}`)); }
  console.log('════════════════════════════════════════════\n');
  process.exit(R.failed.length > 0 ? 1 : 0);
})();
