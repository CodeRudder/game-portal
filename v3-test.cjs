const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text().substring(0, 120)); });
  
  try {
    await page.goto('http://localhost:5173/idle/three-kingdoms', { timeout: 15000 });
    await page.waitForTimeout(3000);
    
    // Dismiss any modal overlay first
    const overlay = await page.$('.tk-modal-overlay--visible');
    if (overlay) {
      console.log('发现模态框，尝试关闭...');
      const closeBtn = await page.$('.tk-modal-close, .tk-modal-overlay .close-btn, [class*="close"], button[aria-label="Close"]');
      if (closeBtn) {
        await closeBtn.click();
      } else {
        await page.keyboard.press('Escape');
      }
      await page.waitForTimeout(1000);
    }
    
    // Check if overlay still exists
    const overlay2 = await page.$('.tk-modal-overlay--visible');
    if (overlay2) {
      console.log('模态框仍然存在，尝试JS移除...');
      await page.evaluate(() => {
        const el = document.querySelector('.tk-modal-overlay--visible');
        if (el) el.remove();
      });
      await page.waitForTimeout(500);
    }
    
    await page.screenshot({ path: '/mnt/user-data/workspace/game-portal/screenshots/v3-ui-main.png' });
    
    // 找到关卡Tab并点击
    const tabs = await page.$$('button, [role="tab"], .tab-item');
    console.log('找到Tab数量:', tabs.length);
    let clicked = false;
    for (const tab of tabs) {
      const text = await tab.textContent();
      if (text && (text.includes('关卡') || text.includes('Campaign'))) {
        console.log('找到关卡Tab:', text.trim().substring(0, 30));
        await tab.click({ force: true }).catch(() => {});
        clicked = true;
        break;
      }
    }
    
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/mnt/user-data/workspace/game-portal/screenshots/v3-ui-campaign-tab.png' });
    
    // 获取DOM结构
    const bodyHTML = await page.evaluate(() => {
      return document.body.innerHTML.substring(0, 3000);
    });
    
    console.log('=== 测试结果 ===');
    console.log('关卡Tab点击:', clicked ? '成功' : '未找到');
    console.log('控制台错误:', errors.length);
    errors.forEach((e, i) => console.log(`  E${i+1}: ${e}`));
    console.log('DOM片段:', bodyHTML.substring(0, 800));
    
  } catch (err) {
    console.log('错误:', err.message);
  }
  
  await browser.close();
})();
