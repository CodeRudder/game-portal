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
    document.querySelectorAll('[class*="modal"], [class*="overlay"], [class*="welcome"]').forEach(el => el.click());
  });
  await page.waitForTimeout(500);
  
  // Click hero tab
  const heroTab = await page.$('[class*="tab"]:has-text("武将")');
  if (heroTab) await heroTab.click();
  await page.waitForTimeout(1000);
  
  // Debug: dump all buttons
  const buttons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).map(b => ({
      text: b.textContent?.trim().substring(0, 40),
      className: b.className?.substring(0, 60),
      visible: b.offsetParent !== null,
    }));
  });
  console.log('=== BUTTONS ===');
  buttons.forEach(b => console.log(JSON.stringify(b)));
  
  // Debug: dump elements with recruit in class
  const recruitEls = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[class*="recruit"], [class*="Recruit"]')).map(e => ({
      tag: e.tagName,
      className: e.className?.substring(0, 80),
      text: e.textContent?.trim().substring(0, 40),
    }));
  });
  console.log('\n=== RECRUIT ELEMENTS ===');
  recruitEls.forEach(e => console.log(JSON.stringify(e)));
  
  // Debug: dump elements with hero in class
  const heroEls = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[class*="tk-hero"]')).map(e => ({
      tag: e.tagName,
      className: e.className?.substring(0, 80),
      text: e.textContent?.trim().substring(0, 40),
    }));
  });
  console.log('\n=== TK-HERO ELEMENTS ===');
  heroEls.forEach(e => console.log(JSON.stringify(e)));
  
  await browser.close();
})();
