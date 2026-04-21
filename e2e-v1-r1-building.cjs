const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const issues = [];

  await page.goto('http://localhost:5173/idle/three-kingdoms', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  // 进入游戏
  const startBtn = await page.$('button:has-text("开始游戏")');
  if (startBtn) { await startBtn.click(); await page.waitForTimeout(3000); }

  // === 1.0.15 建筑Tab入口 ===
  console.log('=== 1.0.15 建筑Tab入口 ===');
  const buildingTab = await page.$('button:has-text("建筑")');
  console.log('建筑Tab存在:', !!buildingTab);
  if (buildingTab) {
    const vis = await buildingTab.isVisible();
    console.log('建筑Tab可见:', vis);
    await buildingTab.click();
    await page.waitForTimeout(2000);
  } else {
    issues.push({ id: '1.0.15', desc: '建筑Tab入口未找到', severity: 'P0' });
  }

  // === 1.0.8 建筑面板展示所有建筑 ===
  console.log('\n=== 1.0.8 建筑面板 ===');
  const bldPins = await page.$$('[class*="bld-pin"]');
  const bldItems = await page.$$('[class*="building-item"]');
  const bldCards = await page.$$('[class*="bld-card"]');
  console.log('bld-pin数量:', bldPins.length);
  console.log('building-item数量:', bldItems.length);
  console.log('bld-card数量:', bldCards.length);
  
  // 获取建筑名称列表
  const allBldElements = [...bldPins, ...bldItems, ...bldCards];
  console.log('总建筑元素:', allBldElements.length);
  for (let i = 0; i < Math.min(allBldElements.length, 30); i++) {
    const text = await allBldElements[i].textContent();
    console.log('  建筑[' + i + ']: ' + text.trim().substring(0, 60));
  }

  // === 1.0.13 建筑等级显示 ===
  console.log('\n=== 1.0.13 建筑等级 ===');
  const levelElements = await page.$$('[class*="level"], [class*="Lv"], [class*="bld-level"]');
  console.log('等级元素数量:', levelElements.length);
  for (let i = 0; i < Math.min(levelElements.length, 10); i++) {
    const text = await levelElements[i].textContent();
    console.log('  等级[' + i + ']: ' + text.trim().substring(0, 30));
  }

  // === 1.0.9 建筑升级弹窗 ===
  console.log('\n=== 1.0.9 升级弹窗 ===');
  // 点击第一个可点击的建筑
  const clickableBld = await page.$('[class*="bld-pin"]:not([class*="locked"])');
  if (clickableBld) {
    await clickableBld.click();
    await page.waitForTimeout(1500);
    
    // 检查弹窗
    const modal = await page.$('[class*="shared-panel"], [class*="modal"], [class*="SharedPanel"]');
    console.log('弹窗出现:', !!modal);
    if (modal) {
      const modalText = await modal.textContent();
      console.log('弹窗内容:', modalText.substring(0, 200));
      await page.screenshot({ path: 'screenshots/v1-r1-building-upgrade-modal.png' });

      // === 1.0.10 升级消耗资源 ===
      console.log('\n=== 1.0.10 升级消耗 ===');
      const costElements = await page.$$('[class*="cost"], [class*="consume"], [class*="price"]');
      console.log('消耗元素:', costElements.length);
      costElements.forEach(async (el, i) => {
        const text = await el.textContent();
        console.log('  消耗[' + i + ']: ' + text.trim().substring(0, 50));
      });

      // === 1.0.11 升级倒计时 ===
      console.log('\n=== 1.0.11 升级倒计时 ===');
      const progressBars = await page.$$('[class*="progress"], [class*="countdown"], [class*="timer"]');
      console.log('进度/倒计时元素:', progressBars.length);

      // === 1.0.14 建筑产出加成 ===
      console.log('\n=== 1.0.14 产出加成 ===');
      const bonusElements = await page.$$('[class*="bonus"], [class*="output"], [class*="produce"], [class*="yield"]');
      console.log('产出加成元素:', bonusElements.length);
      for (let i = 0; i < Math.min(bonusElements.length, 10); i++) {
        const text = await bonusElements[i].textContent();
        console.log('  加成[' + i + ']: ' + text.trim().substring(0, 50));
      }

      // 关闭弹窗
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    } else {
      issues.push({ id: '1.0.9', desc: '点击建筑后弹窗未出现', severity: 'P1' });
    }
  }

  // 截图
  await page.screenshot({ path: 'screenshots/v1-r1-building-check.png' });

  // 汇总
  console.log('\n=== 建筑系统检查汇总 ===');
  console.log('Issues:', issues.length);
  issues.forEach(i => console.log('  [' + i.severity + '] ' + i.id + ': ' + i.desc));

  await browser.close();
})().catch(e => { console.error('失败:', e.message); process.exit(1); });
