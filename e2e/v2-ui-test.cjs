const { initBrowser, enterGame, switchTab, takeScreenshot, checkDataIntegrity, checkLayout, switchToMobile, getConsoleErrors, clearConsoleErrors } = require('./utils/game-actions.cjs');

(async () => {
  const issues = [];
  const { page, browser } = await initBrowser({ headless: true });

  console.log('=== v2.0 UI测试 ===');

  // 进入游戏
  await enterGame(page);

  // 关闭可能存在的教程/引导弹窗
  async function dismissTutorial() {
    for (let i = 0; i < 8; i++) {
      const overlay = await page.$('[class*="guide-overlay"], [class*="tk-guide"], [role="dialog"]');
      if (!overlay) break;
      // 尝试各种关闭按钮
      const closeBtn = await page.$([
        '[class*="guide"] button:has-text("确")',
        '[class*="guide"] button:has-text("知")',
        '[class*="guide"] button:has-text("好")',
        '[class*="guide"] button:has-text("OK")',
        '[class*="guide"] button:has-text("×")',
        '[class*="guide"] button:has-text("跳")',
        '[class*="guide"] button:has-text("关")',
        '[class*="guide"] button:has-text("下一")',
        '[class*="guide"] button:has-text("继续")',
        '[class*="guide"] [class*="close"]',
        '[role="dialog"] button:has-text("确")',
        '[role="dialog"] button:has-text("好")',
        '[role="dialog"] button:has-text("×")',
        '[role="dialog"] button:has-text("跳")',
        '[role="dialog"] button:has-text("关")',
        '[role="dialog"] button:has-text("下一")',
        '[role="dialog"] button:has-text("继续")',
        '[role="dialog"] [class*="close"]',
      ].join(','));
      if (closeBtn) {
        await closeBtn.click();
        await page.waitForTimeout(600);
      } else {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(600);
      }
    }
  }
  await dismissTutorial();

  await takeScreenshot(page, 'v2-ui-main');
  console.log('✅ 进入游戏');

  // 布局+数据检查
  const layout = await checkLayout(page);
  console.log('布局: 资源栏y=' + layout.resourceBarY + ' Tab栏bottom=' + layout.tabBarBottom);
  const data = await checkDataIntegrity(page);
  console.log('数据: ' + (data.issues.length === 0 ? '✅' : '❌ ' + data.issues.join(',')));

  // === 2.1 武将Tab ===
  console.log('\n=== 武将Tab ===');
  await switchTab(page, '武将');
  await dismissTutorial();
  await takeScreenshot(page, 'v2-ui-hero-tab');
  
  const heroText = await page.textContent('body');
  console.log('武将Tab内容长度: ' + heroText.trim().length);
  
  // 检查武将卡片
  const heroCards = await page.$$('[class*="hero-card"], [class*="tk-hero-card"]');
  console.log('武将卡片: ' + heroCards.length);
  
  // 检查招募按钮
  const recruitBtn = await page.$('button:has-text("招募")');
  console.log('招募按钮: ' + (!!recruitBtn ? '✅' : '❌'));
  if (!recruitBtn) issues.push({ id: 'V2-RECRUIT', desc: '招募按钮未找到', severity: 'P1' });

  // === 2.2 武将详情弹窗 ===
  console.log('\n=== 武将详情 ===');
  // 尝试点击武将卡片
  const selectors = ['[class*="hero-card"]', '[class*="tk-hero-card"]', '[class*="hero"] [role="button"]', '[class*="hero"] > div[style]'];
  let detailOpened = false;
  for (const sel of selectors) {
    const els = await page.$$(sel);
    if (els.length > 0) {
      console.log('尝试选择器: ' + sel + ' (' + els.length + '个)');
      try {
        await els[0].click();
        await page.waitForTimeout(1500);
        await dismissTutorial();
        const modal = await page.$('[class*="detail"], [class*="Detail"], [class*="shared-panel"]');
        if (modal) {
          const modalText = await modal.textContent();
          console.log('✅ 详情弹窗出现');
          console.log('详情内容: ' + modalText.substring(0, 150));
          
          // 检查关键元素
          const hasLevel = modalText.includes('Lv') || modalText.includes('等级');
          const hasAttr = modalText.includes('武力') || modalText.includes('智力') || modalText.includes('统率');
          const hasPower = modalText.includes('战力');
          console.log('等级: ' + hasLevel + ' 属性: ' + hasAttr + ' 战力: ' + hasPower);
          
          await takeScreenshot(page, 'v2-ui-hero-detail');
          detailOpened = true;
          
          // 检查升级按钮
          const upgradeBtn = await page.$('button:has-text("升级"), button:has-text("强化"), button:has-text("▲")');
          console.log('升级按钮: ' + (!!upgradeBtn ? '✅' : '⚠️'));
          
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);
          break;
        }
      } catch (e) {
        console.log('点击失败: ' + e.message.substring(0, 80));
      }
    }
  }
  if (!detailOpened) {
    console.log('⚠️ 武将详情弹窗未能打开');
    issues.push({ id: 'V2-DETAIL', desc: '武将详情弹窗未能打开', severity: 'P1' });
  }

  // === 2.3 招募系统 ===
  console.log('\n=== 招募系统 ===');
  await switchTab(page, '武将');
  await dismissTutorial();
  clearConsoleErrors(page);
  
  // 使用 force click 来避免被引导弹窗阻挡
  const recruitBtns = await page.$$('button');
  for (const btn of recruitBtns) {
    const text = await btn.textContent();
    if (text && text.includes('招募')) {
      try {
        await btn.click({ force: true });
        await page.waitForTimeout(1500);
        console.log('点击招募按钮: ' + text.trim());
      } catch (e) {
        console.log('点击招募按钮失败(尝试force): ' + e.message.substring(0, 80));
      }
      break;
    }
  }
  
  await dismissTutorial();
  await takeScreenshot(page, 'v2-ui-recruit');
  const recruitText = await page.textContent('body');
  console.log('招募页面内容: ' + recruitText.substring(0, 150));
  
  // 检查保底信息
  const pityElements = await page.$$('[class*="pity"], [class*="guarantee"]');
  console.log('保底元素: ' + pityElements.length);
  
  // 检查单抽/十连
  const singleBtn = await page.$('button:has-text("单抽"), button:has-text("单次")');
  const tenBtn = await page.$('button:has-text("十连"), button:has-text("10连")');
  console.log('单抽按钮: ' + (!!singleBtn ? '✅' : '❌'));
  console.log('十连按钮: ' + (!!tenBtn ? '✅' : '❌'));
  if (!singleBtn && !tenBtn) {
    issues.push({ id: 'V2-PULL', desc: '单抽/十连按钮未找到', severity: 'P1' });
  }
  
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // === 2.4 移动端 ===
  console.log('\n=== 移动端 ===');
  await switchToMobile(page);
  await takeScreenshot(page, 'v2-ui-mobile');
  const mobileText = await page.textContent('body');
  console.log('移动端: ' + (mobileText.trim().length > 50 ? '✅' : '❌'));

  // === 控制台错误 ===
  const errors = getConsoleErrors(page);
  console.log('\n控制台错误: ' + errors.length);
  if (errors.length > 0) {
    errors.forEach(e => console.log('  ' + e.substring(0, 200)));
    issues.push({ id: 'CONSOLE', desc: errors.length + '个控制台错误', severity: 'P0' });
  }

  // 汇总
  console.log('\n=== 汇总 ===');
  console.log('Issues: ' + issues.length);
  issues.forEach(i => console.log('  [' + i.severity + '] ' + i.id + ': ' + i.desc));
  if (issues.length === 0) console.log('🎉 v2.0 UI测试全部通过！');

  await browser.close();
})().catch(e => { console.error('失败:', e.message); process.exit(1); });
