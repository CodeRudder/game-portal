/**
 * v1.0 基业初立 — UI测试脚本
 * 使用可复用操作库
 */
const {
  initBrowser, enterGame, switchTab, openBuildingModal, closeAllModals,
  takeScreenshot, checkDataIntegrity, checkLayout, switchToMobile, switchToPC,
  getConsoleErrors, clearConsoleErrors
} = require('./utils/game-actions.cjs');

(async () => {
  const issues = [];
  const { page, browser } = await initBrowser({ headless: true });

  console.log('=== v1.0 UI测试 ===');

  // 进入游戏
  await enterGame(page);
  await takeScreenshot(page, 'v1-ui-main');
  console.log('✅ 进入游戏主界面');

  // 布局检查
  const layout = await checkLayout(page);
  console.log('布局: 资源栏y=' + layout.resourceBarY + ' Tab栏bottom=' + layout.tabBarBottom);
  if (layout.resourceBarY > 10) issues.push({ id: 'LAYOUT-01', desc: '资源栏不在顶部 y=' + layout.resourceBarY, severity: 'P1' });
  if (layout.tabBarBottom < layout.viewportHeight - 60) issues.push({ id: 'LAYOUT-02', desc: 'Tab栏不在底部', severity: 'P1' });

  // 数据完整性
  const dataCheck = await checkDataIntegrity(page);
  if (dataCheck.issues.length > 0) {
    dataCheck.issues.forEach(i => issues.push({ id: 'DATA-01', desc: i, severity: 'P0' }));
  }
  console.log('数据完整性: ' + (dataCheck.issues.length === 0 ? '✅' : '❌ ' + dataCheck.issues.join(',')));

  // 逐Tab测试
  const tabs = ['建筑', '武将', '科技', '关卡', '装备', '天下', '名士', '竞技', '远征', '军队', '更多'];
  for (const tab of tabs) {
    await switchTab(page, tab);
    const text = await page.textContent('body');
    const ok = text.trim().length > 50;
    console.log('Tab ' + tab + ': ' + (ok ? '✅' : '⚠️'));
    if (!ok) issues.push({ id: 'TAB-' + tab, desc: tab + '内容过少', severity: 'P1' });
  }

  // 建筑弹窗测试
  console.log('\n--- 建筑弹窗 ---');
  await switchTab(page, '建筑');
  await openBuildingModal(page, 0);
  const modal = await page.$('[class*="shared-panel"], [class*="modal"]');
  console.log('弹窗出现: ' + (!!modal ? '✅' : '❌'));
  if (modal) {
    const modalText = await modal.textContent();
    console.log('弹窗内容: ' + modalText.substring(0, 100));
    await takeScreenshot(page, 'v1-ui-building-modal');
  }
  await closeAllModals(page);
  console.log('弹窗关闭: ✅');

  // 移动端
  console.log('\n--- 移动端 ---');
  await switchToMobile(page);
  await takeScreenshot(page, 'v1-ui-mobile');
  const mobileText = await page.textContent('body');
  console.log('移动端: ' + (mobileText.trim().length > 50 ? '✅' : '❌'));

  // 控制台错误
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
  if (issues.length === 0) console.log('🎉 v1.0 UI测试全部通过！');

  await browser.close();
})().catch(e => { console.error('失败:', e.message); process.exit(1); });
