const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto('http://localhost:3000/idle/three-kingdoms', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(2000);
  
  // Close modals
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    document.querySelectorAll('[class*="modal"], [class*="overlay"], [class*="welcome"]').forEach(el => {
      if (el.className && el.className.includes('visible')) el.click();
    });
  });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  
  // Click hero tab explicitly
  const heroTab = await page.$('.tk-tab-btn:has-text("武将")');
  console.log('Hero tab found:', !!heroTab);
  if (heroTab) {
    await heroTab.click();
    await page.waitForTimeout(1500);
    console.log('Hero tab clicked');
  }
  
  // Check active tab
  const activeTab = await page.evaluate(() => {
    const active = document.querySelector('.tk-tab-btn--active');
    return active ? active.textContent : 'none';
  });
  console.log('Active tab:', activeTab);
  
  // Now dump buttons again
  const buttons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).map(b => ({
      text: b.textContent?.trim().substring(0, 50),
      className: b.className?.substring(0, 60),
      visible: b.offsetParent !== null,
    }));
  });
  console.log('\n=== BUTTONS AFTER HERO TAB ===');
  buttons.forEach(b => console.log(JSON.stringify(b)));
  
  // Check for tk-hero elements
  const heroEls = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[class*="tk-hero"]')).map(e => ({
      tag: e.tagName,
      className: e.className?.substring(0, 80),
      text: e.textContent?.trim().substring(0, 60),
    }));
  });
  console.log('\n=== TK-HERO ELEMENTS ===');
  heroEls.forEach(e => console.log(JSON.stringify(e)));
  
  // Check for guide overlay blocking
  const guideEl = await page.evaluate(() => {
    const guides = document.querySelectorAll('[class*="guide"], [class*="Guide"]');
    return Array.from(guides).map(g => ({
      className: g.className?.substring(0, 80),
      visible: g.offsetParent !== null,
      zIndex: getComputedStyle(g).zIndex,
    }));
  });
  console.log('\n=== GUIDE ELEMENTS ===');
  guideEl.forEach(e => console.log(JSON.stringify(e)));
  
  await page.screenshot({ path: 'e2e/screenshots/v2-r2/debug-hero-tab.png' });
  
  await browser.close();
})();
