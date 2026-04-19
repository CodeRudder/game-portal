const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  await page.goto('http://localhost:3001/games/three-kingdoms-pixi', { 
    waitUntil: 'networkidle', 
    timeout: 30000 
  });
  await page.waitForTimeout(3000);
  
  // Screenshot 1: With guide overlay
  await page.screenshot({ path: 'screenshots-v1/guide.png' });
  console.log('Screenshot 1: guide overlay');
  
  // Skip the guide
  const skipBtn = await page.$('.tk-guide-btn-skip');
  if (skipBtn) {
    await skipBtn.click();
    await page.waitForTimeout(500);
  }
  
  // Screenshot 2: Building tab (default)
  await page.screenshot({ path: 'screenshots-v1/building.png' });
  console.log('Screenshot 2: building tab');
  
  // Get layout info
  const info = await page.evaluate(() => {
    const container = document.querySelector('.tk-container');
    const cards = document.querySelectorAll('.tk-building-card');
    const grid = document.querySelector('.tk-building-grid');
    const resourceBar = document.querySelector('.tk-resource-bar');
    const navBar = document.querySelector('.tk-nav-bar');
    return {
      container: container ? { w: container.offsetWidth, h: container.offsetHeight } : null,
      resourceBar: resourceBar ? { w: resourceBar.offsetWidth, h: resourceBar.offsetHeight } : null,
      navBar: navBar ? { w: navBar.offsetWidth, h: navBar.offsetHeight } : null,
      grid: grid ? { w: grid.offsetWidth, h: grid.offsetHeight } : null,
      cardCount: cards.length,
      firstCard: cards[0] ? { w: cards[0].offsetWidth, h: cards[0].offsetHeight } : null,
    };
  });
  console.log('Layout info:', JSON.stringify(info, null, 2));
  
  // Try clicking an upgrade button on farm
  const upgradeBtns = await page.$$('.tk-upgrade-btn:not([disabled])');
  if (upgradeBtns.length > 0) {
    await upgradeBtns[0].click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'screenshots-v1/upgrade-modal.png' });
    console.log('Screenshot 3: upgrade modal');
    
    // Close modal
    const closeBtn = await page.$('.tk-modal-close');
    if (closeBtn) await closeBtn.click();
    await page.waitForTimeout(300);
  }
  
  // Click other tabs
  const tabs = ['天下', '出征', '武将', '科技', '声望'];
  for (const tabName of tabs) {
    const btn = await page.$(`.tk-nav-tab:text("${tabName}")`);
    if (btn) {
      await btn.click();
      await page.waitForTimeout(500);
    }
  }
  
  // Back to building tab
  const buildingTab = await page.$('.tk-nav-tab:text("建筑")');
  if (buildingTab) {
    await buildingTab.click();
    await page.waitForTimeout(500);
  }
  
  await browser.close();
  console.log('All screenshots done!');
})();
