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

  console.log('=== v1.0 R1-深度Tab+面板测试 ===');

  // 加载并进入游戏
  await page.goto('http://localhost:5173/idle/three-kingdoms', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  // 点击"开始游戏"
  const startBtn = await page.$('button:has-text("开始游戏")');
  if (startBtn) {
    await startBtn.click();
    await page.waitForTimeout(3000);
    console.log('点击开始游戏成功');
    await page.screenshot({ path: 'screenshots/v1-r1-after-start.png' });
  } else {
    console.log('未找到开始游戏按钮');
  }

  // 检查主界面元素
  console.log('\n--- 主界面元素 ---');
  const bodyText = await page.textContent('body');
  console.log('页面文本长度:', bodyText.trim().length);

  // 逐Tab测试
  const tabs = ['🏰建筑', '🦸武将', '📜科技', '⚔️关卡', '🛡️装备', '🗺️天下', '👤名士', '🏟️竞技', '🧭远征', '💪军队', '📋更多'];
  
  for (const tabName of tabs) {
    console.log('\n--- Tab: ' + tabName + ' ---');
    try {
      const tab = await page.$('button:has-text("' + tabName + '")');
      if (!tab) {
        console.log('  ❌ Tab按钮未找到');
        issues.push({ id: 'TAB-' + tabName, desc: tabName + ' Tab按钮未找到', severity: 'P1' });
        continue;
      }
      const vis = await tab.isVisible();
      if (!vis) {
        console.log('  ❌ Tab不可见');
        continue;
      }
      await tab.click();
      await page.waitForTimeout(1500);
      
      // 截图
      const safeName = tabName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '');
      await page.screenshot({ path: 'screenshots/v1-r1-tab-' + safeName + '.png' });
      console.log('  截图已保存: v1-r1-tab-' + safeName + '.png');
      
      // 检查面板内容
      const panelText = await page.textContent('body');
      const hasContent = panelText.trim().length > 100;
      console.log('  面板内容长度: ' + panelText.trim().length + (hasContent ? ' ✅' : ' ⚠️'));
      
      // 检查是否有错误
      if (consoleErrors.length > 0) {
        console.log('  ⚠️ 新增控制台错误: ' + consoleErrors.length);
      }
    } catch (e) {
      console.log('  ❌ 操作失败: ' + e.message);
      issues.push({ id: 'TAB-ERR-' + tabName, desc: tabName + ' 操作失败: ' + e.message, severity: 'P1' });
    }
  }

  // 测试弹窗交互 - 回到建筑Tab，点击建筑打开升级弹窗
  console.log('\n--- 弹窗交互测试 ---');
  try {
    const buildingTab = await page.$('button:has-text("🏰建筑")');
    if (buildingTab) {
      await buildingTab.click();
      await page.waitForTimeout(1500);
      
      // 找可点击的建筑元素
      const bldElements = await page.$$('[class*="bld-pin"]:not([class*="locked"]), [class*="building-item"]:not([class*="locked"])');
      console.log('可点击建筑元素: ' + bldElements.length);
      if (bldElements.length > 0) {
        await bldElements[0].click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'screenshots/v1-r1-building-modal.png' });
        console.log('建筑弹窗截图已保存');
        
        // 检查弹窗内容
        const modalText = await page.textContent('[class*="shared-panel"], [class*="modal"], [class*="SharedPanel"]');
        console.log('弹窗内容长度: ' + (modalText ? modalText.length : 0));
        
        // 测试ESC关闭
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
        const modalAfter = await page.$('[class*="shared-panel"], [class*="modal"], [class*="SharedPanel"]');
        console.log('ESC关闭弹窗: ' + (modalAfter ? '❌ 未关闭' : '✅ 已关闭'));
        if (modalAfter) {
          issues.push({ id: 'MODAL-ESC', desc: 'ESC无法关闭弹窗', severity: 'P2' });
        }
      }
    }
  } catch (e) {
    console.log('弹窗测试失败: ' + e.message);
  }

  // 控制台错误汇总
  console.log('\n--- 控制台错误汇总 ---');
  console.log('总错误数: ' + consoleErrors.length);
  consoleErrors.forEach((e, i) => console.log('  E[' + i + ']: ' + e.substring(0, 300)));

  // 最终汇总
  console.log('\n=== 最终汇总 ===');
  console.log('Issues: ' + issues.length);
  issues.forEach(i => console.log('  [' + i.severity + '] ' + i.id + ': ' + i.desc));

  fs.writeFileSync('e2e-v1-r1-deep-results.json', JSON.stringify({ issues, totalErrors: consoleErrors.length }, null, 2));
  await browser.close();
})().catch(e => { console.error('失败:', e.message); process.exit(1); });
