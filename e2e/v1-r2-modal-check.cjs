const { chromium } = require('playwright');
async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('http://localhost:3000/idle/three-kingdoms');
  await new Promise(r => setTimeout(r, 3000));
  
  // Close modals
  for (let i = 0; i < 5; i++) {
    const btn = await page.$('.tk-modal-close, button:has-text("关闭"), button:has-text("确定"), button:has-text("领取"), button:has-text("开始游戏")');
    if (btn) { await btn.click(); await new Promise(r => setTimeout(r, 500)); }
    else break;
  }
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 500));
  
  // Click main city pin
  const pin = await page.$('.tk-bld-pin[aria-label*="主城"]');
  if (pin) {
    await pin.click();
    await new Promise(r => setTimeout(r, 1000));
    
    // Check for shared panel overlay
    const overlay = await page.$('.tk-shared-panel-overlay, .tk-shared-panel');
    const panelTitle = await page.$('.tk-shared-panel-title');
    const titleText = panelTitle ? await panelTitle.textContent() : 'No title';
    
    console.log('Overlay found:', !!overlay);
    console.log('Panel title:', titleText);
    
    // Get all overlay-like elements
    const overlays = await page.$$('[class*="overlay"], [class*="panel-overlay"], [class*="modal"], [class*="shared-panel"]');
    for (const o of overlays) {
      const cls = await o.evaluate(el => el.className);
      const vis = await o.evaluate(el => el.getBoundingClientRect().width > 0);
      console.log('Element:', cls.substring(0, 80), 'visible:', vis);
    }
    
    await page.screenshot({ path: 'e2e/screenshots/v1-r2/bld-04-upgrade-panel.png' });
  } else {
    console.log('Main city pin not found');
  }
  
  await browser.close();
}
main().catch(console.error);
