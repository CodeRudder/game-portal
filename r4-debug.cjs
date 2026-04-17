const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto('http://localhost:5180/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  // Check what's on the page
  const title = await page.title();
  console.log('Page title:', title);
  
  const containerExists = await page.$('.tk-container');
  console.log('tk-container exists:', !!containerExists);
  
  const guideOverlay = await page.$('.tk-guide-overlay');
  console.log('Guide overlay exists:', !!guideOverlay);
  
  // Skip guide
  const skipBtn = await page.$('button.tk-guide-skip');
  if (skipBtn) {
    console.log('Found skip button, clicking...');
    await skipBtn.click();
    await page.waitForTimeout(1000);
  } else {
    console.log('No skip button found, trying text selector...');
    const skipBtn2 = await page.$('button:has-text("跳过")');
    if (skipBtn2) {
      await skipBtn2.click();
      await page.waitForTimeout(1000);
      console.log('Clicked skip via text selector');
    } else {
      console.log('No skip button at all');
    }
  }
  
  // Check building tab
  const tabs = await page.$$('.tk-tab');
  console.log('Number of tabs:', tabs.length);
  for (const tab of tabs) {
    const text = await tab.textContent();
    console.log('Tab text:', text);
  }
  
  // Click building tab
  const buildingTab = await page.$('.tk-tab:has-text("建筑")');
  if (buildingTab) {
    await buildingTab.click();
    await page.waitForTimeout(500);
    console.log('Clicked building tab');
  }
  
  // Check building cards
  const cards = await page.$$('.tk-building-card');
  console.log('Number of building cards:', cards.length);
  
  const unlockedCards = await page.$$('.tk-building-card:not(.tk-building-locked)');
  console.log('Number of unlocked cards:', unlockedCards.length);
  
  // Screenshot 1: Main interface
  const outDir = path.resolve(__dirname);
  const s1buf = await page.screenshot({ type: 'png' });
  fs.writeFileSync(path.join(outDir, 'r4-s1.png'), s1buf);
  console.log('Screenshot 1 saved, size:', s1buf.length);
  
  // Click first unlocked building card to open modal
  if (unlockedCards.length > 0) {
    console.log('Clicking first unlocked card...');
    await unlockedCards[0].click();
    await page.waitForTimeout(1000);
    
    // Check if modal appeared
    const modal = await page.$('.tk-modal');
    console.log('Modal appeared:', !!modal);
  } else {
    console.log('No unlocked cards to click');
    // Try clicking any card
    if (cards.length > 0) {
      console.log('Trying first card...');
      await cards[0].click();
      await page.waitForTimeout(1000);
    }
  }
  
  const s2buf = await page.screenshot({ type: 'png' });
  fs.writeFileSync(path.join(outDir, 'r4-s2.png'), s2buf);
  console.log('Screenshot 2 saved, size:', s2buf.length);
  
  await browser.close();
  console.log('Done');
})();
