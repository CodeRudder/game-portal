const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto('http://localhost:5173/idle/three-kingdoms', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  const startBtn = await page.$('button:has-text("开始游戏")');
  if (startBtn) { await startBtn.click(); await page.waitForTimeout(3000); }
  
  const layoutInfo = await page.evaluate(() => {
    const result = {
      bodyHeight: document.body.scrollHeight,
      viewportHeight: window.innerHeight,
    };
    
    const resourceEls = document.querySelectorAll('[class*="resource"], [class*="ResourceBar"], [class*="top-bar"], [class*="topbar"]');
    result.resourceElements = [];
    resourceEls.forEach(el => {
      const rect = el.getBoundingClientRect();
      result.resourceElements.push({
        class: el.className.substring(0, 80),
        y: rect.y,
        height: rect.height,
        position: window.getComputedStyle(el).position
      });
    });
    
    const tabBar = document.querySelector('[class*="tk-tab-bar"], [class*="tab-bar"], [class*="TabBar"]');
    if (tabBar) {
      const rect = tabBar.getBoundingClientRect();
      result.tabBarContainer = {
        class: tabBar.className.substring(0, 80),
        y: rect.y,
        height: rect.height,
        position: window.getComputedStyle(tabBar).position
      };
    }
    
    const tabBtns = document.querySelectorAll('[class*="tk-tab-btn"]');
    if (tabBtns.length > 0) {
      const rect = tabBtns[0].getBoundingClientRect();
      result.firstTab = { y: rect.y, height: rect.height, text: tabBtns[0].textContent.trim() };
    }
    
    const allText = document.body.innerText;
    const lines = allText.split('\n').filter(l => l.trim());
    result.firstLines = lines.slice(0, 20);
    
    return result;
  });
  
  console.log(JSON.stringify(layoutInfo, null, 2));
  await browser.close();
})().catch(e => console.error(e.message));
