const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  
  console.log('=== 截图采集 ===\n');
  
  // 导航到游戏页面
  await page.goto('http://localhost:3000/idle/three-kingdoms', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);
  
  // 截图1: 欢迎弹窗
  const shotDir = path.resolve(__dirname, 'screenshots');
  console.log('截图保存目录:', shotDir);
  console.log('目录存在:', fs.existsSync(shotDir));
  
  const p1 = path.join(shotDir, 'v1-r2-welcome-modal.png');
  await page.screenshot({ path: p1, fullPage: false });
  console.log('截图1(欢迎弹窗):', p1, '大小:', fs.existsSync(p1) ? fs.statSync(p1).size : '不存在');
  
  // 关闭弹窗
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1000);
  
  // 截图2: 建筑面板(PC)
  const p2 = path.join(shotDir, 'v1-r2-building-pc.png');
  await page.screenshot({ path: p2, fullPage: false });
  console.log('截图2(建筑PC):', p2, '大小:', fs.statSync(p2).size);
  
  // 点击武将Tab
  const allBtns = await page.$$('button');
  for (const btn of allBtns) {
    const text = await btn.textContent();
    if (text && text.includes('武将')) {
      await btn.click({ force: true });
      break;
    }
  }
  await page.waitForTimeout(2000);
  
  const p3 = path.join(shotDir, 'v1-r2-hero-pc.png');
  await page.screenshot({ path: p3, fullPage: false });
  console.log('截图3(武将PC):', p3, '大小:', fs.statSync(p3).size);
  
  // 点击关卡Tab
  for (const btn of allBtns) {
    const text = await btn.textContent();
    if (text && text.includes('关卡')) {
      await btn.click({ force: true });
      break;
    }
  }
  await page.waitForTimeout(2000);
  
  const p4 = path.join(shotDir, 'v1-r2-stage-pc.png');
  await page.screenshot({ path: p4, fullPage: false });
  console.log('截图4(关卡PC):', p4, '大小:', fs.statSync(p4).size);
  
  // 移动端
  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForTimeout(2000);
  
  const p5 = path.join(shotDir, 'v1-r2-mobile.png');
  await page.screenshot({ path: p5, fullPage: false });
  console.log('截图5(移动端):', p5, '大小:', fs.statSync(p5).size);
  
  // 列出截图目录
  console.log('\n截图目录内容:');
  fs.readdirSync(shotDir).forEach(f => {
    const stat = fs.statSync(path.join(shotDir, f));
    console.log(`  ${f}: ${(stat.size / 1024).toFixed(1)}KB`);
  });
  
  console.log('\nConsole Errors:', consoleErrors.length);
  
  await browser.close();
})().catch(e => {
  console.error('执行失败:', e.message);
  process.exit(1);
});
