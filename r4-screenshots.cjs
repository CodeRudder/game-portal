const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto('http://localhost:5180/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  
  // Skip guide
  const skipBtn = await page.$('button:has-text("跳过")');
  if (skipBtn) { await skipBtn.click(); await page.waitForTimeout(500); }
  
  // Click building tab
  const buildingTab = await page.$('button:has-text("建筑")');
  if (buildingTab) { await buildingTab.click(); await page.waitForTimeout(500); }
  
  const s1buf = await page.screenshot({ type: 'png' });
  const outDir = path.resolve(__dirname);
  fs.writeFileSync(path.join(outDir, 'r4-s1.png'), s1buf);
  console.log('Screenshot 1 saved');
  
  // Click building card to open modal
  const card = await page.$('.tk-building-card:not(.tk-building-locked)');
  if (card) { await card.click(); await page.waitForTimeout(800); }
  
  const s2buf = await page.screenshot({ type: 'png' });
  fs.writeFileSync(path.join(outDir, 'r4-s2.png'), s2buf);
  console.log('Screenshot 2 saved');
  
  await browser.close();
  console.log('Done');
})();
