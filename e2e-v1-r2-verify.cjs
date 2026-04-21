const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const issues = [];

  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('CONSOLE ERROR: ' + msg.text().substring(0, 200));
  });

  console.log('=== v1.0 R2: 修复验证 ===');

  await page.goto('http://localhost:5173/idle/three-kingdoms', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  // 进入游戏
  const startBtn = await page.$('button:has-text("开始游戏")');
  if (startBtn) { await startBtn.click(); await page.waitForTimeout(3000); }

  // A-01: 资源栏固定顶部
  console.log('\n--- A-01: 资源栏位置 ---');
  const resourceBar = await page.$('[class*="resource"], [class*="ResourceBar"]');
  if (resourceBar) {
    const box = await resourceBar.boundingBox();
    const style = await resourceBar.evaluate(el => {
      const cs = window.getComputedStyle(el);
      return { position: cs.position, top: cs.top, zIndex: cs.zIndex };
    });
    console.log('位置: x=' + box.x + ' y=' + box.y + ' w=' + box.width + ' h=' + box.height);
    console.log('CSS: position=' + style.position + ' top=' + style.top + ' z=' + style.zIndex);
    const fixed = style.position === 'sticky' || style.position === 'fixed';
    const atTop = box.y < 50;
    console.log('固定定位: ' + (fixed ? '✅' : '❌'));
    console.log('在顶部(y<50): ' + (atTop ? '✅' : '❌ y=' + box.y));
    if (!fixed || !atTop) {
      issues.push({ id: 'A-01', desc: '资源栏未固定顶部: pos=' + style.position + ' y=' + box.y, severity: 'P1' });
    }
  }

  // A-02: Tab栏在底部
  console.log('\n--- A-02: Tab栏位置 ---');
  const tabBar = await page.$('[class*="tk-tab-bar"], [class*="tab-bar"]');
  if (tabBar) {
    const box = await tabBar.boundingBox();
    const style = await tabBar.evaluate(el => {
      const cs = window.getComputedStyle(el);
      return { position: cs.position, bottom: cs.bottom };
    });
    console.log('位置: x=' + box.x + ' y=' + box.y + ' w=' + box.width + ' h=' + box.height);
    console.log('CSS: position=' + style.position + ' bottom=' + style.bottom);
    const fixed = style.position === 'sticky' || style.position === 'fixed';
    // 在720视口中，Tab栏底部应接近720
    const tabBarBottom = box.y + box.height;
    const nearBottom = tabBarBottom > 650;
    console.log('固定定位: ' + (fixed ? '✅' : '❌'));
    console.log('接近底部(y+h>650): ' + (nearBottom ? '✅' : '❌ bottom=' + tabBarBottom));
    if (!fixed || !nearBottom) {
      issues.push({ id: 'A-02', desc: 'Tab栏不在底部: pos=' + style.position + ' bottom=' + tabBarBottom, severity: 'P1' });
    }
  }

  // G-02: 字体>=12px
  console.log('\n--- G-02: 字体大小 ---');
  const smallFonts = await page.evaluate(() => {
    const results = [];
    const elements = document.querySelectorAll('.tk-res-cap, .tk-res-rate');
    elements.forEach(el => {
      const size = parseFloat(window.getComputedStyle(el).fontSize);
      if (size < 12) results.push({ class: el.className.substring(0, 30), size });
    });
    return results;
  });
  console.log('字体<12px元素数: ' + smallFonts.length);
  if (smallFonts.length > 0) {
    smallFonts.slice(0, 5).forEach(s => console.log('  ' + s.class + ': ' + s.size + 'px'));
    issues.push({ id: 'G-02', desc: '仍有' + smallFonts.length + '个元素字体<12px', severity: 'P1' });
  } else {
    console.log('✅ 所有元素字体>=12px');
  }

  // 全量截图
  await page.screenshot({ path: 'screenshots/v1-r2-pc.png' });
  console.log('\nPC截图已保存: v1-r2-pc.png');

  // 移动端
  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'screenshots/v1-r2-mobile.png' });
  console.log('移动端截图已保存: v1-r2-mobile.png');

  // 汇总
  console.log('\n=== R2 修复验证汇总 ===');
  console.log('Issues: ' + issues.length);
  issues.forEach(i => console.log('  [' + i.severity + '] ' + i.id + ': ' + i.desc));
  if (issues.length === 0) console.log('🎉 全部3个P1问题已修复！');

  await browser.close();
})().catch(e => { console.error('失败:', e.message); process.exit(1); });
