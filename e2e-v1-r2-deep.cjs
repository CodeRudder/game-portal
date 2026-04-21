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

  console.log('=== v1.0 R2: 全Tab深度验证 ===');

  await page.goto('http://localhost:5173/idle/three-kingdoms', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  // 进入游戏
  const startBtn = await page.$('button:has-text("开始游戏")');
  if (startBtn) { await startBtn.click(); await page.waitForTimeout(3000); }
  await page.screenshot({ path: 'screenshots/v1-r2-main.png' });

  // 布局验证
  console.log('\n--- 布局验证 ---');
  const resourceBar = await page.$('[class*="resource"], [class*="ResourceBar"]');
  if (resourceBar) {
    const box = await resourceBar.boundingBox();
    console.log('资源栏: y=' + box.y + ' h=' + box.height + ' ' + (box.y === 0 ? '✅' : '❌'));
  }
  const tabBar = await page.$('[class*="tk-tab-bar"], [class*="tab-bar"]');
  if (tabBar) {
    const box = await tabBar.boundingBox();
    const bottom = box.y + box.height;
    console.log('Tab栏: y=' + box.y + ' h=' + box.height + ' bottom=' + bottom + ' ' + (bottom >= 700 ? '✅' : '❌'));
  }

  // 逐Tab验证
  const tabs = ['🏰建筑', '🦸武将', '📜科技', '⚔️关卡', '🛡️装备', '🗺️天下', '👤名士', '🏟️竞技', '🧭远征', '💪军队', '📋更多'];
  const tabResults = {};

  for (const tabName of tabs) {
    console.log('\n--- Tab: ' + tabName + ' ---');
    try {
      const tab = await page.$('button:has-text("' + tabName + '")');
      if (!tab) {
        console.log('  ❌ 未找到');
        issues.push({ id: 'TAB-' + tabName, desc: tabName + ' 未找到', severity: 'P1' });
        continue;
      }
      await tab.click();
      await page.waitForTimeout(1500);
      
      const safeName = tabName.replace(/[🏰🦸📜⚔️🛡️🗺️👤🏟️🧭💪📋]/g, '');
      await page.screenshot({ path: 'screenshots/v1-r2-tab-' + safeName + '.png' });
      
      // 检查面板内容
      const bodyText = await page.textContent('body');
      const hasNaN = bodyText.includes('NaN');
      const hasUndef = bodyText.includes('undefined');
      
      tabResults[tabName] = {
        contentLen: bodyText.trim().length,
        hasNaN: hasNaN,
        hasUndef: hasUndef,
        errors: consoleErrors.length
      };
      
      console.log('  内容: ' + bodyText.trim().length + '字 NaN:' + hasNaN + ' undef:' + hasUndef + ' err:' + consoleErrors.length);
      if (hasNaN) issues.push({ id: 'DATA-' + tabName, desc: tabName + ' 显示NaN', severity: 'P0' });
      if (hasUndef) issues.push({ id: 'DATA-' + tabName, desc: tabName + ' 显示undefined', severity: 'P0' });
    } catch (e) {
      console.log('  ❌ ' + e.message);
    }
  }

  // 弹窗测试
  console.log('\n--- 弹窗测试 ---');
  const buildingTab = await page.$('button:has-text("建筑")');
  if (buildingTab) {
    await buildingTab.click();
    await page.waitForTimeout(1500);
    const bldPin = await page.$('[class*="bld-pin"]:not([class*="locked"])');
    if (bldPin) {
      await bldPin.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'screenshots/v1-r2-upgrade-modal.png' });
      console.log('升级弹窗截图已保存');
      
      // 检查弹窗内容
      const modal = await page.$('[class*="shared-panel"], [class*="SharedPanel"]');
      if (modal) {
        const modalText = await modal.textContent();
        console.log('弹窗内容: ' + modalText.substring(0, 150));
        
        // 尝试升级
        const upgradeBtn = await page.$('button:has-text("升级")');
        if (upgradeBtn) {
          await upgradeBtn.click();
          await page.waitForTimeout(2000);
          await page.screenshot({ path: 'screenshots/v1-r2-upgrading.png' });
          console.log('升级后截图已保存');
        }
      }
      
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  }

  // 移动端验证
  console.log('\n--- 移动端 ---');
  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'screenshots/v1-r2-mobile-full.png' });
  
  // 移动端Tab测试
  for (const tabName of ['建筑', '武将', '关卡']) {
    const tab = await page.$('button:has-text("' + tabName + '")');
    if (tab) {
      await tab.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'screenshots/v1-r2-mobile-' + tabName + '.png' });
      console.log('移动端' + tabName + '截图已保存');
    }
  }

  // 汇总
  console.log('\n=== R2 汇总 ===');
  console.log('控制台错误: ' + consoleErrors.length);
  console.log('Issues: ' + issues.length);
  issues.forEach(i => console.log('  [' + i.severity + '] ' + i.id + ': ' + i.desc));
  
  console.log('\nTab结果:');
  Object.entries(tabResults).forEach(([name, r]) => {
    console.log('  ' + name + ': ' + r.contentLen + '字 NaN=' + r.hasNaN + ' err=' + r.errors);
  });

  fs.writeFileSync('e2e-v1-r2-results.json', JSON.stringify({ issues, tabResults, totalErrors: consoleErrors.length }, null, 2));
  await browser.close();
})().catch(e => { console.error('失败:', e.message); process.exit(1); });
