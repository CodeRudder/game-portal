const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const issues = [];
  const consoleErrors = [];
  const consoleWarnings = [];

  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
    if (msg.type() === 'warning') consoleWarnings.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push('PAGEERROR: ' + err.message));

  console.log('=== v1.0 R1: 页面加载+控制台+DOM检查 ===');

  // 1. 加载页面
  try {
    await page.goto('http://localhost:5173/idle/three-kingdoms', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(5000);
    const bodyText = await page.textContent('body');
    console.log('页面文本长度:', bodyText ? bodyText.trim().length : 0);
    console.log('白屏:', bodyText ? bodyText.trim().length < 10 : true);
    await page.screenshot({ path: 'screenshots/v1-r1-pc.png' });
    console.log('PC截图已保存');
  } catch (e) {
    console.log('加载失败:', e.message);
    issues.push({ id: 'LOAD-01', desc: '页面加载失败', severity: 'P0' });
  }

  // 2. 控制台错误
  console.log('\n--- 控制台 ---');
  console.log('Errors:', consoleErrors.length);
  consoleErrors.forEach((e, i) => {
    console.log('  E[' + i + ']: ' + e.substring(0, 300));
    if (i < 10) issues.push({ id: 'CONSOLE-E' + i, desc: e.substring(0, 200), severity: 'P0' });
  });
  console.log('Warnings:', consoleWarnings.length);
  consoleWarnings.forEach((w, i) => console.log('  W[' + i + ']: ' + w.substring(0, 200)));

  // 3. DOM元素
  console.log('\n--- DOM元素 ---');
  const selectors = [
    ['资源栏', '[class*="resource"],[class*="ResourceBar"],[class*="tk-resource"]'],
    ['Tab栏', '[class*="tk-tab"],[class*="tab-bar"],[class*="TabBar"],[class*="tab-btn"]'],
    ['游戏容器', '[class*="game-container"],[class*="tk-game"],[class*="idle-game"]'],
    ['建筑相关', '[class*="building"],[class*="bld"]'],
    ['弹窗', '[class*="shared-panel"],[class*="modal"],[class*="SharedPanel"]'],
  ];
  for (const [name, sel] of selectors) {
    const els = await page.$$(sel);
    console.log(name + ': ' + (els.length > 0 ? '找到' + els.length + '个' : '未找到'));
  }

  // 4. 所有按钮
  console.log('\n--- 按钮 ---');
  const buttons = await page.$$('button');
  console.log('按钮总数:', buttons.length);
  for (let i = 0; i < Math.min(buttons.length, 30); i++) {
    const text = await buttons[i].textContent();
    const vis = await buttons[i].isVisible();
    console.log('  btn[' + i + ']: "' + (text ? text.trim().substring(0, 30) : '空') + '" vis=' + vis);
  }

  // 5. 移动端
  console.log('\n--- 移动端 ---');
  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'screenshots/v1-r1-mobile.png' });
  console.log('移动端截图已保存');

  // 汇总
  console.log('\n=== 汇总 ===');
  console.log('Issues:', issues.length);
  issues.forEach(i => console.log('  [' + i.severity + '] ' + i.id + ': ' + i.desc));

  fs.writeFileSync('e2e-v1-r1-results.json', JSON.stringify({ issues, errors: consoleErrors.length, warnings: consoleWarnings.length }, null, 2));

  await browser.close();
})().catch(e => { console.error('失败:', e.message); process.exit(1); });
