const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  
  await page.goto('http://localhost:3000/games/three-kingdoms-pixi', { 
    waitUntil: 'networkidle', 
    timeout: 30000 
  });
  await page.waitForTimeout(3000);
  
  // Screenshot 1: Main page (default tab)
  await page.screenshot({ path: '/mnt/user-data/workspace/v16-main.png' });
  console.log('Screenshot 1: main');
  
  const tabs = [
    { name: '地图', file: 'v16-map.png' },
    { name: '建筑', file: 'v16-building.png' },
    { name: '武将', file: 'v16-general.png' },
    { name: '关卡', file: 'v16-campaign.png' },
    { name: '科技', file: 'v16-tech.png' },
  ];
  
  for (const tab of tabs) {
    // Try multiple selectors
    let btn = await page.$(`button:has-text("${tab.name}")`);
    if (!btn) btn = await page.$(`text=${tab.name}`);
    if (!btn) btn = await page.$(`[data-tab="${tab.name}"]`);
    if (!btn) btn = await page.$(`:text("${tab.name}")`);
    if (!btn) {
      // Try finding any element containing the text
      btn = await page.$(`xpath=//*[contains(text(), '${tab.name}')]`);
    }
    
    if (btn) {
      console.log(`Found tab: ${tab.name}, clicking...`);
      await btn.click();
      await page.waitForTimeout(2000);
    } else {
      console.log(`Tab not found: ${tab.name}, taking screenshot anyway`);
    }
    
    await page.screenshot({ path: `/mnt/user-data/workspace/${tab.file}` });
    console.log(`Screenshot: ${tab.name}`);
  }
  
  await browser.close();
  console.log('All screenshots done!');
})();
