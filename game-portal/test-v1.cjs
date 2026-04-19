const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  await page.goto('http://localhost:3001/games/three-kingdoms-pixi', { 
    waitUntil: 'networkidle', 
    timeout: 30000 
  });
  await page.waitForTimeout(3000);
  
  // Skip guide
  const skipBtn = await page.$('.tk-guide-btn-skip');
  if (skipBtn) await skipBtn.click();
  await page.waitForTimeout(500);
  
  // Get initial resource values
  const initialResources = await page.evaluate(() => {
    const values = document.querySelectorAll('.tk-resource-value');
    return Array.from(values).map(v => v.textContent.trim());
  });
  console.log('Initial resources:', initialResources);
  
  // Find and click the first upgrade button (farm)
  const upgradeBtns = await page.$$('.tk-upgrade-btn:not([disabled])');
  console.log('Available upgrade buttons:', upgradeBtns.length);
  
  if (upgradeBtns.length > 0) {
    // Click first upgrade button
    await upgradeBtns[0].click();
    await page.waitForTimeout(500);
    
    // Check if modal appeared
    const modal = await page.$('.tk-upgrade-modal');
    console.log('Modal visible:', !!modal);
    
    // Click confirm upgrade
    const confirmBtn = await page.$('.tk-modal-btn-confirm:not([disabled])');
    if (confirmBtn) {
      await confirmBtn.click();
      await page.waitForTimeout(500);
      
      // Check toast
      const toast = await page.$('.tk-toast');
      console.log('Toast visible:', !!toast);
      if (toast) {
        const toastText = await toast.textContent();
        console.log('Toast text:', toastText);
      }
      
      await page.screenshot({ path: 'screenshots-v1/after-upgrade.png' });
    }
  }
  
  // Check building levels after upgrade
  const levels = await page.evaluate(() => {
    const badges = document.querySelectorAll('.tk-level-badge');
    return Array.from(badges).map(b => b.textContent.trim());
  });
  console.log('Building levels:', levels);
  
  // Test tab switching
  const tabs = await page.$$('.tk-nav-tab');
  for (const tab of tabs) {
    const text = await tab.textContent();
    await tab.click();
    await page.waitForTimeout(300);
    const isActive = await tab.evaluate(el => el.classList.contains('active'));
    console.log(`Tab "${text.trim()}": active=${isActive}`);
  }
  
  // Back to building tab
  const buildingTab = await page.$('.tk-nav-tab:text("建筑")');
  if (buildingTab) {
    await buildingTab.click();
    await page.waitForTimeout(300);
  }
  
  // Test filter
  const filterBtns = await page.$$('.tk-filter-btn');
  for (const btn of filterBtns) {
    const text = await btn.textContent();
    await btn.click();
    await page.waitForTimeout(200);
    const cardCount = await page.evaluate(() => document.querySelectorAll('.tk-building-card').length);
    console.log(`Filter "${text.trim()}": ${cardCount} cards`);
  }
  
  await browser.close();
  console.log('Test complete!');
})();
