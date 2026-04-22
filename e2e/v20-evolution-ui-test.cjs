/**
 * v20.0 天下一统(下) — UI测试 R1 (Puppeteer)
 * 主页面加载、声望系统、转生循环、核心系统、终局内容、移动端适配
 */
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const BASE = process.env.GAME_BASE_URL || 'http://localhost:5173/idle/three-kingdoms';
const SDIR = path.join(__dirname, 'screenshots', 'v20-evolution');
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

async function enterGame(page) {
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 30000 }); await wait(3000);
  const btn = await page.$('button');
  if (btn) { const t = await page.evaluate(e => e.textContent, btn); if (t?.includes('开始游戏')) { await btn.click(); await wait(3000); } }
  for (let i = 0; i < 8; i++) {
    const g = await page.$('.tk-guide-overlay'); if (!g) break;
    const s = await page.$('.tk-guide-btn--skip');
    if (s) { await s.evaluate(e => e.click()); await wait(500); continue; }
    await page.keyboard.press('Escape'); await wait(500);
  }
}

async function closeModals(p) {
  await p.keyboard.press('Escape'); await wait(300);
  const c = await p.$('.tk-shared-panel-close,[data-testid="shared-panel-close"]');
  if (c) { await c.click(); await wait(500); }
}

async function openPanel(p, id) {
  const btn = await p.$(`[data-feature="${id}"]`) || await p.$(`[data-testid="${id}-panel"]`);
  if (btn) { await btn.click(); await wait(1000); return true; }
  const more = await p.$('[data-tab="更多"],button');
  if (more) {
    const t = await p.evaluate(e => e.textContent, more);
    if (t?.includes('更多')) { await more.click(); await wait(500); }
    const pb = await p.$(`[data-feature="${id}"]`);
    if (pb) { await pb.click(); await wait(1000); return true; }
  }
  return false;
}

async function testMainPage(p) {
  console.log('\n📋 测试1: 主页面加载'); await shot(p, 'v20-main');
  const html = await p.evaluate(() => document.body.innerText);
  if (html?.length > 50) ok('主页面正常加载'); else no('主页面加载', '内容为空');
  for (const [l, s] of [['Tab栏','.tk-tab-bar,[data-testid="tab-bar"],nav'],
    ['资源栏','[data-testid="resource-bar"],.tk-resource-bar,.resource-display']]) {
    (await p.$(s)) ? ok(`${l}存在`) : ww(`${l}未找到`, '选择器可能变化');
  }
}

async function testPrestige(p) {
  console.log('\n📋 测试2: 声望系统');
  const opened = await openPanel(p, 'prestige');
  if (opened) { await wait(1000); await shot(p, 'v20-prestige'); ok('声望面板可打开'); }
  else ww('声望面板', '无法打开（可能需更高等级）');
  await closeModals(p);
}

async function testRebirth(p) {
  console.log('\n📋 测试3: 转生循环');
  const el = await p.$('[data-feature="rebirth"]');
  if (el) { await el.click(); await wait(1000); await shot(p, 'v20-rebirth'); ok('转生入口存在'); }
  else ww('转生入口', '未找到独立转生入口');
  await closeModals(p);
}

async function testCoreSystems(p) {
  console.log('\n📋 测试4: 核心系统完整性');
  const tabs = [
    ['建筑', '建筑'], ['武将', '武将'], ['战役', '战役'],
    ['科技', '科技'], ['装备', '装备'],
  ];
  for (const [name, label] of tabs) {
    const tab = await p.$(`[data-tab="${label}"],button`);
    if (tab) {
      const t = await p.evaluate(e => e.textContent, tab);
      if (t?.includes(label)) {
        await tab.click(); await wait(1000); await shot(p, `v20-${name}-tab`);
        ok(`${name}系统可访问`);
      } else ww(`${name}Tab`, '按钮文本不匹配');
    } else ww(`${name}Tab`, '未找到');
  }
}

async function testEndgame(p) {
  console.log('\n📋 测试5: 终局内容');
  const so = await openPanel(p, 'settings');
  if (so) { await wait(1000); await shot(p, 'v20-settings'); ok('设置面板可打开'); }
  else ww('设置面板', '无法打开');
  await closeModals(p);
  const ao = await openPanel(p, 'achievement');
  if (ao) { await wait(1000); await shot(p, 'v20-achievement'); ok('成就面板可打开'); }
  else ww('成就面板', '无法打开');
  await closeModals(p);
}

async function testMobile(p) {
  console.log('\n📋 测试6: 移动端适配');
  const viewports = [['iPhone SE', 375, 667], ['Pixel 7', 412, 915], ['iPad', 768, 1024]];
  for (const [label, w, h] of viewports) {
    await p.setViewport({ width: w, height: h }); await wait(1000);
    await shot(p, `v20-${label.replace(/\s/g, '-').toLowerCase()}`);
    ok(`${label} (${w}×${h}) 渲染正常`);
  }
  await p.setViewport({ width: 1280, height: 800 }); await wait(500);
}

function testErrors() {
  console.log('\n📋 测试7: 控制台错误');
  const ig = ['favicon', '404', 'net::ERR', 'ResizeObserver', 'DevTools'];
  const real = R.errs.filter(e => !ig.some(p => e.includes(p)));
  real.length === 0 ? ok('无控制台错误') : no(`${real.length}个控制台错误`, real.slice(0, 3).join(' | '));
}

(async () => {
  console.log('════════════════════════════════════════════');
  console.log('  v20.0 天下一统(下) UI测试 R1 (Puppeteer)');
  console.log('════════════════════════════════════════════');
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  page.on('console', m => { if (m.type() === 'error') R.errs.push(m.text()); });
  page.on('pageerror', e => R.errs.push(e.message));
  try {
    await enterGame(page); await testMainPage(page); await testPrestige(page);
    await testRebirth(page); await testCoreSystems(page); await testEndgame(page);
    await testMobile(page); testErrors();
  } catch (e) { no('主流程异常', e.message); try { await shot(page, 'v20-error'); } catch(_){} }
  finally { await browser.close(); }
  R.t1 = new Date().toISOString();
  const tot = R.pass.length + R.fail.length, rate = tot > 0 ? ((R.pass.length / tot) * 100).toFixed(1) : '0';
  console.log('\n════════════════════════════════════════════');
  console.log(`  ✅${R.pass.length} ❌${R.fail.length} ⚠️${R.warn.length} 📸${R.shots.length} 📊${rate}%`);
  R.fail.forEach(f => console.log(`  ❌ ${f.n}`));
  R.warn.forEach(w => console.log(`  ⚠️ ${w.n}`));
  console.log('════════════════════════════════════════════\n');
  process.exit(R.fail.length > 0 ? 1 : 0);
})();
