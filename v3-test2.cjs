const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  
  try {
    await page.goto('http://localhost:5173/idle/three-kingdoms', { timeout: 15000 });
    await page.waitForTimeout(3000);
    
    // Dismiss modal if present
    await page.evaluate(() => {
      const el = document.querySelector('.tk-modal-overlay--visible');
      if (el) el.remove();
    });
    await page.waitForTimeout(500);
    
    // 点击关卡Tab
    const tabs = await page.$$('button, [role="tab"], .tab-item');
    for (const tab of tabs) {
      const text = await tab.textContent();
      if (text && (text.includes('关卡') || text.includes('Campaign'))) {
        await tab.click({ force: true }).catch(() => {});
        break;
      }
    }
    await page.waitForTimeout(2000);
    
    // 查找可点击的关卡/章节
    const allClickable = await page.$$eval('[class*="stage"], [class*="chapter"], [class*="campaign"], [class*="level"]', els => 
      els.map(e => ({ tag: e.tagName, class: e.className, text: e.textContent?.substring(0, 50) }))
    );
    console.log('可点击元素:', JSON.stringify(allClickable.slice(0, 10), null, 2));
    
    // 尝试点击第一个关卡
    const stageEl = await page.$('[class*="stage"]:first-child, [class*="level"]:first-child');
    if (stageEl) {
      await stageEl.click({ force: true }).catch(() => {});
      await page.waitForTimeout(1500);
      await page.screenshot({ path: '/mnt/user-data/workspace/game-portal/screenshots/v3-ui-stage-click.png' });
      console.log('关卡元素已点击并截图');
    } else {
      console.log('未找到可点击的关卡元素');
    }
    
    // 移动端测试
    const mobilePage = await browser.newPage({ viewport: { width: 375, height: 667 } });
    await mobilePage.goto('http://localhost:5173/idle/three-kingdoms', { timeout: 15000 });
    await mobilePage.waitForTimeout(3000);
    
    // Dismiss modal on mobile
    await mobilePage.evaluate(() => {
      const el = document.querySelector('.tk-modal-overlay--visible');
      if (el) el.remove();
    });
    await mobilePage.waitForTimeout(500);
    
    const mTabs = await mobilePage.$$('button, [role="tab"]');
    for (const tab of mTabs) {
      const text = await tab.textContent();
      if (text && (text.includes('关卡') || text.includes('Campaign'))) {
        await tab.click({ force: true }).catch(() => {});
        break;
      }
    }
    await mobilePage.waitForTimeout(2000);
    await mobilePage.screenshot({ path: '/mnt/user-data/workspace/game-portal/screenshots/v3-ui-campaign-mobile.png' });
    console.log('移动端截图完成');
    
  } catch (err) {
    console.log('错误:', err.message);
  }
  
  await browser.close();
})();
