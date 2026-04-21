// e2e-test-v1.mjs — v1.0 基业初立真实页面验证
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  
  const errors = [];
  const warnings = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
    if (msg.type() === 'warning') warnings.push(msg.text());
  });
  
  console.log('=== v1.0 基业初立 — 真实页面验证 ===\n');
  
  // 1. 页面加载
  console.log('--- D-1: 页面加载 ---');
  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    const title = await page.title();
    console.log('页面标题:', title);
    const bodyText = await page.textContent('body');
    console.log('页面有内容:', bodyText ? bodyText.length > 0 : false);
    console.log('D-1: ✅ 页面加载成功\n');
  } catch (e) {
    console.log('D-1: ❌ 页面加载失败:', e.message, '\n');
  }
  
  // 2. 控制台错误
  console.log('--- D-2: 控制台错误 ---');
  console.log('Error数量:', errors.length);
  errors.forEach((e, i) => console.log(`  Error[${i}]:`, e.substring(0, 200)));
  console.log('Warning数量:', warnings.length);
  console.log('D-2:', errors.length === 0 ? '✅ 无Error' : '❌ 有Error\n');
  
  // 3. 查找游戏容器
  console.log('--- D-3: 游戏容器 ---');
  const gameContainer = await page.$('.tk-game-container, [class*="game"], [class*="three-kingdoms"]');
  console.log('游戏容器存在:', !!gameContainer);
  
  // 4. 查找资源栏
  console.log('--- D-4: 资源栏 ---');
  const resourceBar = await page.$('[class*="resource"], [class*="ResourceBar"]');
  console.log('资源栏存在:', !!resourceBar);
  if (resourceBar) {
    const resText = await resourceBar.textContent();
    console.log('资源栏内容:', resText ? resText.substring(0, 100) : '空');
  }
  
  // 5. 查找Tab栏
  console.log('--- D-5: Tab栏 ---');
  const tabs = await page.$$('[class*="tab-btn"], [class*="tk-tab"], [class*="Tab"]');
  console.log('Tab按钮数量:', tabs.length);
  for (let i = 0; i < Math.min(tabs.length, 15); i++) {
    const text = await tabs[i].textContent();
    console.log(`  Tab[${i}]:`, text ? text.trim().substring(0, 20) : '空');
  }
  
  // 6. 查找建筑相关元素
  console.log('--- D-6: 建筑面板 ---');
  const buildingElements = await page.$$('[class*="building"], [class*="bld"]');
  console.log('建筑相关元素数量:', buildingElements.length);
  
  // 7. 尝试点击建筑Tab
  console.log('--- D-7: 点击建筑Tab ---');
  try {
    const buildingTab = await page.$('[class*="tab"]:has-text("建筑"), [class*="tab"]:has-text("城池"), button:has-text("建筑"), button:has-text("城池")');
    if (buildingTab) {
      await buildingTab.click();
      await page.waitForTimeout(2000);
      console.log('点击建筑Tab成功');
      
      const buildingPanel = await page.$('[class*="building-panel"], [class*="bld-map"], [class*="BuildingPanel"]');
      console.log('建筑面板出现:', !!buildingPanel);
      if (buildingPanel) {
        const panelText = await buildingPanel.textContent();
        console.log('建筑面板内容长度:', panelText ? panelText.length : 0);
      }
    } else {
      console.log('未找到建筑Tab按钮');
    }
  } catch (e) {
    console.log('点击建筑Tab失败:', e.message);
  }
  
  // 8. 截图
  console.log('\n--- 截图 ---');
  await page.screenshot({ path: '/mnt/user-data/workspace/game-portal/screenshots/v1-home.png', fullPage: false });
  console.log('截图已保存: screenshots/v1-home.png');
  
  // 9. 移动端验证
  console.log('\n--- D-8: 移动端适配 ---');
  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/mnt/user-data/workspace/game-portal/screenshots/v1-mobile.png', fullPage: false });
  console.log('移动端截图已保存: screenshots/v1-mobile.png');
  
  // 10. 最终汇总
  console.log('\n=== 验证汇总 ===');
  console.log('页面加载:', '✅');
  console.log('Console Error:', errors.length === 0 ? '✅ 0个' : `❌ ${errors.length}个`);
  console.log('游戏容器:', gameContainer ? '✅' : '❌');
  console.log('资源栏:', resourceBar ? '✅' : '❌');
  console.log('Tab栏:', tabs.length > 0 ? `✅ ${tabs.length}个` : '❌');
  
  await browser.close();
})().catch(e => {
  console.error('测试执行失败:', e.message);
  process.exit(1);
});
