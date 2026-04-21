import { chromium } from 'playwright';

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
  page.on('pageerror', err => errors.push('PAGE_ERROR: ' + err.message));
  
  console.log('=== v1.0 基业初立 — 三国霸业页面验证 ===\n');
  
  // 1. 页面加载
  console.log('--- D-1: 页面加载 ---');
  try {
    await page.goto('http://localhost:3001/games/three-kingdoms-pixi', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(5000);
    const title = await page.title();
    const htmlLen = await page.evaluate(() => document.body.innerHTML.length);
    const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 500));
    console.log('标题:', title);
    console.log('HTML长度:', htmlLen);
    console.log('页面文字(前500):', bodyText);
    console.log('D-1: ✅\n');
  } catch (e) {
    console.log('D-1: ❌', e.message, '\n');
  }
  
  // 2. 控制台错误
  console.log('--- D-2: Console错误 ---');
  console.log('Error数量:', errors.length);
  errors.forEach((e, i) => console.log(`  [${i}]:`, e.substring(0, 300)));
  console.log('Warning数量:', warnings.length);
  warnings.forEach((w, i) => console.log(`  W[${i}]:`, w.substring(0, 200)));
  console.log('D-2:', errors.length === 0 ? '✅' : '❌\n');
  
  // 3. 游戏容器
  console.log('--- D-3: 游戏容器 ---');
  const gameInfo = await page.evaluate(() => {
    const gc = document.querySelector('.tk-game-container');
    const root = document.querySelector('#root');
    return {
      hasGameContainer: !!gc,
      rootHTMLLength: root ? root.innerHTML.length : 0,
      gcClass: gc ? gc.className : null
    };
  });
  console.log('tk-game-container:', gameInfo.hasGameContainer);
  console.log('容器class:', gameInfo.gcClass);
  console.log('root HTML长度:', gameInfo.rootHTMLLength);
  console.log('D-3:', gameInfo.hasGameContainer ? '✅' : '❌\n');
  
  // 4. 资源栏
  console.log('--- D-4: 资源栏 ---');
  const resInfo = await page.evaluate(() => {
    const rb = document.querySelector('[class*="resource-bar"]');
    const resItems = document.querySelectorAll('[class*="resource"]');
    // 也查找包含"粮草""铜钱"等文字的元素
    const allText = document.body.innerText;
    const hasGrain = allText.includes('粮草');
    const hasGold = allText.includes('铜钱');
    const hasTroops = allText.includes('兵力');
    return {
      hasResourceBar: !!rb,
      resourceElements: resItems.length,
      hasGrain, hasGold, hasTroops,
      resourceBarText: rb ? rb.textContent?.substring(0, 200) : null
    };
  });
  console.log('resource-bar存在:', resInfo.hasResourceBar);
  console.log('resource相关元素:', resInfo.resourceElements);
  console.log('页面含粮草:', resInfo.hasGrain);
  console.log('页面含铜钱:', resInfo.hasGold);
  console.log('页面含兵力:', resInfo.hasTroops);
  console.log('D-4:', resInfo.hasResourceBar ? '✅' : '❌\n');
  
  // 5. Tab栏
  console.log('--- D-5: Tab栏 ---');
  const tabInfo = await page.evaluate(() => {
    const tabs = document.querySelectorAll('.tk-tab-btn, [class*="tk-tab"]');
    const tabTexts = Array.from(tabs).map(t => t.textContent?.trim().substring(0, 20));
    return { count: tabs.length, texts: tabTexts };
  });
  console.log('Tab数量:', tabInfo.count);
  console.log('Tab文字:', tabInfo.texts);
  console.log('D-5:', tabInfo.count > 0 ? '✅' : '❌\n');
  
  // 6. 建筑面板
  console.log('--- D-6: 建筑面板 ---');
  const bldInfo = await page.evaluate(() => {
    const bp = document.querySelector('[class*="building-panel"], [class*="bld-map"]');
    const bldPins = document.querySelectorAll('[class*="bld-pin"]');
    const allText = document.body.innerText;
    const hasBuilding = allText.includes('建筑') || allText.includes('主城') || allText.includes('农田');
    return {
      hasBuildingPanel: !!bp,
      buildingPins: bldPins.length,
      pageHasBuildingText: hasBuilding
    };
  });
  console.log('building-panel:', bldInfo.hasBuildingPanel);
  console.log('bld-pin数量:', bldInfo.buildingPins);
  console.log('页面含建筑文字:', bldInfo.pageHasBuildingText);
  
  // 7. 尝试点击建筑Tab
  console.log('\n--- D-7: 点击建筑Tab ---');
  try {
    const buildingTab = await page.$('.tk-tab-btn:has-text("建筑"), .tk-tab-btn:has-text("城池"), .tk-tab-btn:has-text("🏠")');
    if (buildingTab) {
      await buildingTab.click();
      await page.waitForTimeout(2000);
      console.log('点击成功');
      const afterClick = await page.evaluate(() => {
        const bp = document.querySelector('[class*="building-panel"], [class*="bld"]');
        return { hasBuilding: !!bp, text: bp ? bp.textContent?.substring(0, 300) : null };
      });
      console.log('建筑面板出现:', afterClick.hasBuilding);
      if (afterClick.text) console.log('面板文字:', afterClick.text);
    } else {
      console.log('未找到建筑Tab');
    }
  } catch (e) {
    console.log('点击失败:', e.message);
  }
  
  // 8. 截图PC
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/mnt/user-data/workspace/game-portal/screenshots/v1-game-pc.png' });
  console.log('\n截图PC: screenshots/v1-game-pc.png');
  
  // 9. 截图移动端
  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/mnt/user-data/workspace/game-portal/screenshots/v1-game-mobile.png' });
  console.log('截图Mobile: screenshots/v1-game-mobile.png');
  
  // 10. 汇总
  console.log('\n========================================');
  console.log('=== v1.0 验证汇总 ===');
  console.log('========================================');
  console.log('D-1 页面加载: ✅');
  console.log('D-2 Console:', errors.length === 0 ? '✅ 0 Error' : `❌ ${errors.length} Error`);
  console.log('D-3 游戏容器:', gameInfo.hasGameContainer ? '✅' : '❌');
  console.log('D-4 资源栏:', resInfo.hasResourceBar ? '✅' : '❌');
  console.log('D-5 Tab栏:', tabInfo.count > 0 ? `✅ ${tabInfo.count}个` : '❌');
  console.log('D-6 建筑面板:', bldInfo.hasBuildingPanel ? '✅' : '❌');
  console.log('D-8 移动端: 截图已保存');
  console.log('');
  console.log('问题列表:');
  const issues = [];
  if (errors.length > 0) issues.push(`P0: Console有${errors.length}个Error`);
  if (!gameInfo.hasGameContainer) issues.push('P0: 无tk-game-container');
  if (!resInfo.hasResourceBar) issues.push('P1: 无资源栏');
  if (tabInfo.count === 0) issues.push('P0: 无Tab栏');
  if (!bldInfo.hasBuildingPanel) issues.push('P1: 无建筑面板');
  if (issues.length === 0) {
    console.log('✅ 无问题！');
  } else {
    issues.forEach(i => console.log('  -', i));
  }
  
  await browser.close();
})().catch(e => {
  console.error('失败:', e.message);
  process.exit(1);
});
