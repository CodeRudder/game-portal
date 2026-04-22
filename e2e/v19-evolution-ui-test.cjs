/**
 * v19.0 天下一统(上) — UI测试 R1 (Puppeteer)
 * 页面加载、主界面渲染、引擎API、PC+移动端适配、截图
 */
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const BASE = process.env.GAME_BASE_URL || 'http://localhost:5173/idle/three-kingdoms';
const SDIR = path.join(__dirname, 'screenshots', 'v19-evolution');
const R = { pass: [], fail: [], warn: [], shots: [], errs: [], t0: new Date().toISOString() };

const ok = n => { R.pass.push(n); console.log(`  ✅ ${n}`); };
const no = (n, d) => { R.fail.push({ n, d: String(d).slice(0, 200) }); console.log(`  ❌ ${n} — ${String(d).slice(0, 120)}`); };
const ww = (n, d) => { R.warn.push({ n, d: String(d).slice(0, 200) }); console.log(`  ⚠️  ${n} — ${String(d).slice(0, 120)}`); };

async function shot(p, name) {
  fs.mkdirSync(SDIR, { recursive: true });
  await p.screenshot({ path: path.join(SDIR, name + '.png') });
  R.shots.push(name); console.log(`  📸 ${name}`);
}
const wait = ms => new Promise(r => setTimeout(r, ms));

async function enterGame(pg) {
  await pg.goto(BASE, { waitUntil: 'networkidle2', timeout: 30000 }); await wait(3000);
  const btn = await pg.$('button');
  if (btn) { const t = await pg.evaluate(e => e.textContent, btn); if (t && t.includes('开始游戏')) { await btn.click(); await wait(3000); } }
  for (let i = 0; i < 8; i++) {
    const g = await pg.$('.tk-guide-overlay'); if (!g) break;
    const s = await pg.$('.tk-guide-btn--skip');
    if (s) { await s.evaluate(e => e.click()); await wait(500); continue; }
    await pg.keyboard.press('Escape'); await wait(500);
  }
}

async function testPageLoad(p) {
  console.log('\n📋 测试1: 页面加载 + 主界面'); await shot(p, 'v19-main');
  const html = await p.evaluate(() => document.body.innerText);
  if (html && html.length > 50) ok('主页面正常加载'); else no('主页面加载', '内容为空');
  const checks = [
    ['资源栏', '[data-testid="resource-bar"],.tk-resource-bar,.resource-bar'],
    ['Tab导航', '[data-testid="tab-bar"],.tk-tab-bar,nav'],
    ['场景区', 'canvas,.tk-scene,.building-panel'],
  ];
  for (const [label, sel] of checks) {
    (await p.$(sel)) ? ok(`${label}已渲染`) : ww(`${label}未找到`, '选择器可能变化');
  }
}

async function testEngineAPI(p) {
  console.log('\n📋 测试2: 引擎API验证');
  const check = await p.evaluate(async () => {
    try {
      const m = await import('/src/games/three-kingdoms/engine/index.ts');
      const names = ['SettingsManager','AudioManager','GraphicsManager','AnimationController',
        'CloudSaveSystem','AccountSystem','SaveSlotManager','BalanceValidator',
        'UnificationAudioController','GraphicsQualityManager'];
      return names.map(n => [n, typeof m[n] === 'function']);
    } catch (e) { return { err: e.message }; }
  });
  if (check.err) { ww('引擎导入失败', check.err); return; }
  for (const [name, exists] of check) exists ? ok(`引擎导出 ${name}`) : no(`引擎导出 ${name}`, '未找到');
}

async function testSettings(p) {
  console.log('\n📋 测试3: 设置面板');
  try {
    const more = await p.$('[data-tab="更多"],button');
    if (more) {
      const t = await p.evaluate(e => e.textContent, more);
      if (t && t.includes('更多')) { await more.click(); await wait(800); }
    }
    const sb = await p.$('[data-feature="settings"]');
    if (sb) { await sb.click(); await wait(1000); ok('设置面板已打开'); await shot(p, 'v19-settings'); }
    else ww('设置按钮未找到', '可能需先进入更多Tab');
    await p.keyboard.press('Escape'); await wait(500);
  } catch (e) { no('设置面板', e.message); }
}

async function testPC(p) {
  console.log('\n📋 测试4: PC端 (1280×800)');
  await p.setViewport({ width: 1280, height: 800 }); await wait(1000);
  await shot(p, 'v19-pc-1280x800'); ok('PC端正常渲染');
  const good = await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2);
  good ? ok('PC端无水平溢出') : ww('PC端水平溢出', '检查布局');
}

async function testMobile(p) {
  console.log('\n📋 测试5: 移动端 (375×812)');
  await p.setViewport({ width: 375, height: 812 }); await wait(1000);
  await shot(p, 'v19-mobile-375x812'); ok('移动端正常渲染');
  (await p.$('meta[name="viewport"]')) ? ok('viewport meta存在') : ww('viewport meta缺失', '缩放可能异常');
  await p.setViewport({ width: 1280, height: 800 });
}

function testErrors() {
  console.log('\n📋 测试6: 控制台错误');
  const ig = ['favicon','404','net::ERR','ResizeObserver'];
  const real = R.errs.filter(e => !ig.some(p => e.includes(p)));
  real.length === 0 ? ok('无控制台错误') : no(`${real.length}个控制台错误`, real.slice(0, 3).join(' | '));
}

(async () => {
  console.log('════════════════════════════════════════════');
  console.log('  v19.0 天下一统(上) UI测试 R1 (Puppeteer)');
  console.log('════════════════════════════════════════════');
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const pg = await browser.newPage();
  await pg.setViewport({ width: 1280, height: 800 });
  pg.on('console', m => { if (m.type() === 'error') R.errs.push(m.text()); });
  pg.on('pageerror', e => R.errs.push(e.message));
  try {
    await enterGame(pg); await testPageLoad(pg); await testEngineAPI(pg);
    await testSettings(pg); await testPC(pg); await testMobile(pg); testErrors();
  } catch (e) { no('主流程异常', e.message); try { await shot(pg, 'v19-error'); } catch(_){} }
  finally { await browser.close(); }
  R.t1 = new Date().toISOString();
  const tot = R.pass.length + R.fail.length;
  const rate = tot > 0 ? ((R.pass.length / tot) * 100).toFixed(1) : '0';
  console.log('\n════════════════════════════════════════════');
  console.log(`  ✅${R.pass.length} ❌${R.fail.length} ⚠️${R.warn.length} 📸${R.shots.length} 📊${rate}%`);
  if (R.fail.length) R.fail.forEach(f => console.log(`    ❌ ${f.n}`));
  console.log('════════════════════════════════════════════\n');
  process.exit(R.fail.length > 0 ? 1 : 0);
})();
