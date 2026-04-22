const { initBrowser, enterGame, switchTab, takeScreenshot, checkDataIntegrity, checkLayout, switchToMobile, getConsoleErrors, clearConsoleErrors } = require('./utils/game-actions.cjs');

(async () => {
  const issues = [];
  const { page, browser } = await initBrowser({ headless: true });

  console.log('=== v3.0 UI测试 ===');

  // 进入游戏
  await enterGame(page);
  await takeScreenshot(page, 'v3-ui-main');
  console.log('✅ 进入游戏');

  // 布局+数据检查
  const layout = await checkLayout(page);
  console.log('布局: 资源栏y=' + layout.resourceBarY + ' Tab栏bottom=' + layout.tabBarBottom);
  const data = await checkDataIntegrity(page);
  console.log('数据: ' + (data.issues.length === 0 ? '✅' : '❌ ' + data.issues.join(',')));

  // === 关卡Tab ===
  console.log('\n=== 关卡Tab ===');
  await switchTab(page, '关卡');
  await page.waitForTimeout(1500);
  await takeScreenshot(page, 'v3-ui-campaign-tab');
  
  const campaignText = await page.textContent('body');
  console.log('关卡Tab内容长度: ' + campaignText.trim().length);
  
  // 检查关卡节点
  const stageNodes = await page.$$('[class*="stage"], [class*="node"], [class*="campaign"]');
  console.log('关卡相关元素: ' + stageNodes.length);
  
  // 检查章节信息
  const hasChapter = campaignText.includes('章') || campaignText.includes('第');
  console.log('章节信息: ' + hasChapter);
  if (!hasChapter) issues.push({ id: 'V3-CHAPTER', desc: '关卡Tab缺少章节信息', severity: 'P1' });

  // 检查关卡状态
  const hasLock = campaignText.includes('锁') || campaignText.includes('🔒');
  const hasStar = campaignText.includes('星') || campaignText.includes('★');
  console.log('锁定状态: ' + hasLock + ' 星级: ' + hasStar);

  // 尝试点击关卡
  clearConsoleErrors(page);
  const clickableNodes = await page.$$('[class*="stage"][role="button"], [class*="node"][role="button"], [class*="campaign"] button, [class*="stage"] button');
  if (clickableNodes.length > 0) {
    console.log('可点击关卡: ' + clickableNodes.length);
    try {
      await clickableNodes[0].click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(1500);
      await takeScreenshot(page, 'v3-ui-stage-detail');
      const detailText = await page.textContent('body');
      console.log('关卡详情内容: ' + detailText.substring(0, 150));
      
      // 检查战斗按钮
      const battleBtn = await page.$('button:has-text("战斗"), button:has-text("出征"), button:has-text("挑战")');
      console.log('战斗按钮: ' + (!!battleBtn ? '✅' : '⚠️'));
      
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    } catch (e) {
      console.log('点击关卡失败: ' + e.message.substring(0, 80));
    }
  } else {
    console.log('⚠️ 未找到可点击的关卡节点');
    issues.push({ id: 'V3-STAGE', desc: '未找到可点击的关卡节点', severity: 'P1' });
  }

  // === 移动端 ===
  console.log('\n=== 移动端 ===');
  await switchToMobile(page);
  await switchTab(page, '关卡');
  await page.waitForTimeout(1000);
  await takeScreenshot(page, 'v3-ui-mobile-campaign');
  const mobileText = await page.textContent('body');
  console.log('移动端关卡: ' + (mobileText.trim().length > 50 ? '✅' : '❌'));

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
  if (issues.length === 0) console.log('🎉 v3.0 UI测试全部通过！');

  await browser.close();
})().catch(e => { console.error('失败:', e.message); process.exit(1); });
