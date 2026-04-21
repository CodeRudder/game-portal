const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');

function waitForServer(port, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      http.get(`http://localhost:${port}/`, (res) => {
        resolve(true);
      }).on('error', () => {
        if (Date.now() - start > timeout) {
          reject(new Error(`Server not ready after ${timeout}ms`));
        } else {
          setTimeout(check, 500);
        }
      });
    };
    check();
  });
}

(async () => {
  console.log('Starting Vite dev server...');
  const viteProc = spawn('npx', ['vite', '--host', '0.0.0.0', '--port', '5173'], {
    cwd: '/mnt/user-data/workspace/game-portal',
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false
  });

  viteProc.stderr.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg) console.log('[Vite-ERR]', msg);
  });

  try {
    await waitForServer(5173, 30000);
    console.log('Server is ready!');
  } catch (e) {
    console.error('Server failed to start:', e.message);
    viteProc.kill();
    process.exit(1);
  }

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

  console.log('\n=== v1.0 R1: 页面加载+控制台检查 ===\n');

  // 1. 页面加载 — use domcontentloaded, SPA handles routing client-side
  try {
    const resp = await page.goto('http://localhost:5173/idle/three-kingdoms', { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log('HTTP状态:', resp.status());
    // Wait for React to hydrate and render
    await page.waitForTimeout(8000);
    
    const bodyHTML = await page.innerHTML('body');
    console.log('body HTML长度:', bodyHTML.length);
    const bodyText = await page.textContent('body');
    console.log('body文本长度:', bodyText ? bodyText.trim().length : 0);
    console.log('白屏:', bodyText ? bodyText.trim().length < 10 : true);
    
    // Also dump first 500 chars of body text
    console.log('body文本前500字:', bodyText ? bodyText.trim().substring(0, 500) : '空');
    
    await page.screenshot({ path: '/mnt/user-data/workspace/game-portal/screenshots/v1-r1-pc-load.png' });
    console.log('PC截图已保存');
  } catch (e) {
    console.log('页面加载失败:', e.message);
    issues.push({ id: 'LOAD-01', desc: '页面加载失败: ' + e.message, severity: 'P0' });
  }

  // 2. 控制台错误
  console.log('\n--- 控制台错误 ---');
  console.log('Errors:', consoleErrors.length);
  consoleErrors.forEach((e, i) => {
    const short = e.substring(0, 300);
    console.log(`  E[${i}]: ${short}`);
    if (i < 10) issues.push({ id: `CONSOLE-E${i}`, desc: short, severity: 'P0' });
  });
  console.log('Warnings:', consoleWarnings.length);
  consoleWarnings.forEach((w, i) => console.log(`  W[${i}]: ${w.substring(0, 200)}`));

  // 3. 关键DOM元素检查
  console.log('\n--- 关键DOM元素 ---');
  const checks = [
    { name: '资源栏', selectors: ['[class*="resource"]', '[class*="ResourceBar"]', '[class*="tk-resource"]'] },
    { name: 'Tab栏', selectors: ['[class*="tk-tab"]', '[class*="tab-bar"]', '[class*="TabBar"]'] },
    { name: '游戏容器', selectors: ['#root', '[class*="game-container"]', '[class*="tk-game"]'] },
  ];
  for (const chk of checks) {
    let found = false;
    for (const sel of chk.selectors) {
      try {
        const el = await page.$(sel);
        if (el) {
          found = true;
          const text = await el.textContent();
          console.log(`${chk.name}: ✅ 找到 (sel=${sel}, text=${text ? text.substring(0, 80) : '空'})`);
          break;
        }
      } catch(e) {
        console.log(`${chk.name}: 查询错误 - ${e.message.substring(0, 100)}`);
      }
    }
    if (!found) {
      console.log(`${chk.name}: ❌ 未找到`);
      issues.push({ id: `DOM-${chk.name}`, desc: `${chk.name}元素未找到`, severity: 'P1' });
    }
  }

  // 4. 所有button元素
  console.log('\n--- 按钮元素 ---');
  try {
    const buttons = await page.$$('button');
    console.log('按钮总数:', buttons.length);
    for (let i = 0; i < Math.min(buttons.length, 30); i++) {
      const text = await buttons[i].textContent();
      const visible = await buttons[i].isVisible();
      console.log(`  btn[${i}]: "${text ? text.trim().substring(0, 30) : '空'}" visible=${visible}`);
    }
  } catch(e) {
    console.log('按钮查询错误:', e.message.substring(0, 200));
  }

  // 5. 移动端
  console.log('\n--- 移动端 ---');
  try {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/mnt/user-data/workspace/game-portal/screenshots/v1-r1-mobile-load.png' });
    console.log('移动端截图已保存');
  } catch(e) {
    console.log('移动端截图失败:', e.message.substring(0, 200));
  }

  // 汇总
  console.log('\n=== 汇总 ===');
  console.log('发现问题:', issues.length);
  issues.forEach(i => console.log(`  [${i.severity}] ${i.id}: ${i.desc}`));

  fs.writeFileSync('/mnt/user-data/workspace/game-portal/e2e-v1-r1-results.json', JSON.stringify({ issues, consoleErrors: consoleErrors.length, consoleWarnings: consoleWarnings.length }, null, 2));

  await browser.close();
  console.log('\n结果已保存到 e2e-v1-r1-results.json');

  viteProc.kill();
  console.log('Vite server stopped.');
})().catch(e => { console.error('失败:', e.message); process.exit(1); });
