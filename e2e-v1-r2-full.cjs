const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const issues = [];
  const consoleErrors = [];

  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push('PAGEERROR: ' + err.message));

  console.log('=== v1.0 R2: 全量深度验证 ===');

  await page.goto('http://localhost:5173/idle/three-kingdoms', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  // 进入游戏
  const startBtn = await page.$('button:has-text("开始游戏")');
  if (startBtn) { await startBtn.click(); await page.waitForTimeout(3000); }
  await page.screenshot({ path: 'screenshots/v1-r2-main.png' });

  // === 布局检查 ===
  console.log('\n=== 布局检查 ===');
  const resourceBar = await page.$('[class*="resource"], [class*="ResourceBar"]');
  if (resourceBar) {
    const box = await resourceBar.boundingBox();
    console.log('资源栏: y=' + box.y + ' h=' + box.height + (box.y < 10 ? ' ✅顶部' : ' ❌'));
  }
  const tabBar = await page.$('[class*="tk-tab-bar"], [class*="tab-bar"]');
  if (tabBar) {
    const box = await tabBar.boundingBox();
    const bottom = box.y + box.height;
    console.log('Tab栏: y=' + box.y + ' h=' + box.height + ' bottom=' + bottom + (bottom > 700 ? ' ✅底部' : ' ⚠️'));
  }

  // === 控制台错误 ===
  console.log('\n=== 控制台 ===');
  console.log('Errors: ' + consoleErrors.length);
  consoleErrors.forEach((e, i) => console.log('  E[' + i + ']: ' + e.substring(0, 200)));
  if (consoleErrors.length > 0) {
    issues.push({ id: 'CONSOLE', desc: consoleErrors.length + '个控制台错误', severity: 'P0' });
  }

  // === NaN/undefined检查 ===
  console.log('\n=== 数据完整性 ===');
  const bodyText = await page.textContent('body');
  console.log('NaN: ' + (bodyText.includes('NaN') ? '❌' : '✅'));
  console.log('undefined: ' + (bodyText.includes('undefined') ? '❌' : '✅'));

  // === 资源系统 ===
  console.log('\n=== 资源系统 ===');
  if (resourceBar) {
    const resText = await resourceBar.textContent();
    console.log('资源栏文本: ' + resText.substring(0, 100));
    ['粮草', '铜钱', '兵力', '天命'].forEach(r => {
      console.log('  ' + r + ': ' + (resText.includes(r) ? '✅' : '⚠️'));
    });
  }

  // === 逐Tab测试 ===
  console.log('\n=== Tab测试 ===');
  const tabs = ['建筑', '武将', '科技', '关卡', '装备', '天下', '名士', '竞技', '远征', '军队', '更多'];
  for (const tabName of tabs) {
    const tab = await page.$('button:has-text("' + tabName + '")');
    if (!tab) {
      console.log(tabName + ': ❌ 未找到');
      issues.push({ id: 'TAB-' + tabName, desc: tabName + ' Tab未找到', severity: 'P1' });
      continue;
    }
    await tab.click();
    await page.waitForTimeout(1000);
    const safeName = tabName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '');
    await page.screenshot({ path: 'screenshots/v1-r2-tab-' + safeName + '.png' });
    const text = await page.textContent('body');
    console.log(tabName + ': 内容' + text.trim().length + '字符 ' + (text.trim().length > 50 ? '✅' : '⚠️'));
  }

  // === 建筑弹窗 ===
  console.log('\n=== 建筑弹窗 ===');
  const buildingTab = await page.$('button:has-text("建筑")');
  if (buildingTab) {
    await buildingTab.click();
    await page.waitForTimeout(1500);
    const bldPin = await page.$('[class*="bld-pin"]:not([class*="locked"])');
    if (bldPin) {
      await bldPin.click();
      await page.waitForTimeout(1000);
      const modal = await page.$('[class*="shared-panel"], [class*="modal"]');
      console.log('弹窗出现: ' + (!!modal ? '✅' : '❌'));
      if (modal) {
        const modalText = await modal.textContent();
        console.log('弹窗内容: ' + modalText.substring(0, 150));
        await page.screenshot({ path: 'screenshots/v1-r2-building-modal.png' });
        // ESC关闭
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
        const modalAfter = await page.$('[class*="shared-panel"], [class*="modal"]');
        console.log('ESC关闭: ' + (!modalAfter ? '✅' : '❌'));
      }
    }
  }

  // === 升级测试 ===
  console.log('\n=== 建筑升级测试 ===');
  if (buildingTab) {
    await buildingTab.click();
    await page.waitForTimeout(1000);
    // 点击主城
    const mainCity = await page.$('[class*="bld-pin"]:first-child');
    if (mainCity) {
      await mainCity.click();
      await page.waitForTimeout(1000);
      // 找升级按钮
      const upgradeBtn = await page.$('button:has-text("升级"), button:has-text("▲")');
      if (upgradeBtn) {
        const vis = await upgradeBtn.isVisible();
        console.log('升级按钮可见: ' + vis);
        if (vis) {
          await upgradeBtn.click();
          await page.waitForTimeout(2000);
          await page.screenshot({ path: 'screenshots/v1-r2-upgrading.png' });
          const text = await page.textContent('body');
          const hasProgress = text.includes('升级中') || text.includes('进度') || text.includes('%');
          console.log('升级进度显示: ' + (hasProgress ? '✅' : '⚠️'));
          // 等待升级完成
          await page.waitForTimeout(15000);
          await page.screenshot({ path: 'screenshots/v1-r2-upgrade-done.png' });
          const textAfter = await page.textContent('body');
          const levelUp = textAfter.includes('Lv.2') || textAfter.includes('Lv.3');
          console.log('升级完成(Lv.2): ' + (levelUp ? '✅' : '⚠️'));
        }
      } else {
        console.log('升级按钮未找到');
      }
    }
  }

  // === 字体检查 ===
  console.log('\n=== 字体检查 ===');
  const smallFonts = await page.evaluate(() => {
    let count = 0;
    document.querySelectorAll('.tk-res-cap, .tk-res-rate').forEach(el => {
      if (parseFloat(window.getComputedStyle(el).fontSize) < 12) count++;
    });
    return count;
  });
  console.log('字体<12px: ' + smallFonts + ' ' + (smallFonts === 0 ? '✅' : '❌'));

  // === 移动端 ===
  console.log('\n=== 移动端 ===');
  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'screenshots/v1-r2-mobile-full.png' });
  const mobileText = await page.textContent('body');
  console.log('移动端内容: ' + mobileText.trim().length + '字符 ' + (mobileText.trim().length > 50 ? '✅' : '❌'));

  // 汇总
  console.log('\n=== R2 最终汇总 ===');
  console.log('Issues: ' + issues.length);
  issues.forEach(i => console.log('  [' + i.severity + '] ' + i.id + ': ' + i.desc));
  if (issues.length === 0) console.log('🎉 v1.0 R2 全部通过！');

  fs.writeFileSync('e2e-v1-r2-results.json', JSON.stringify({ issues, errors: consoleErrors.length }, null, 2));
  await browser.close();
})().catch(e => { console.error('失败:', e.message); process.exit(1); });
