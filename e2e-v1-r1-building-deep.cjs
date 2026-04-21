const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:5173/idle/three-kingdoms', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  const startBtn = await page.$('button:has-text("开始游戏")');
  if (startBtn) { await startBtn.click(); await page.waitForTimeout(3000); }

  const tab = await page.$('button:has-text("建筑")');
  if (tab) { await tab.click(); await page.waitForTimeout(2000); }

  // Broader search for level displays
  console.log('=== Broader Level Search ===');
  const lvTexts = await page.$$('text=Lv.');
  console.log('Lv. text matches:', lvTexts.length);
  for (let i = 0; i < Math.min(lvTexts.length, 10); i++) {
    const t = await lvTexts[i].textContent();
    console.log('  Lv[' + i + ']:', t.trim().substring(0, 40));
  }

  // Search for level in any element class
  const allElements = await page.$$('div, span, p');
  let levelCount = 0;
  for (const el of allElements) {
    const cls = await el.getAttribute('class') || '';
    if (cls.includes('level') || cls.includes('Level') || cls.includes('lv')) {
      const txt = await el.textContent();
      console.log('  level-class:', cls.substring(0, 50), '->', txt.trim().substring(0, 30));
      levelCount++;
      if (levelCount > 10) break;
    }
  }
  console.log('Total elements with level in class:', levelCount);

  // Click first building
  const firstBld = await page.$('[class*="bld-pin"]:not([class*="locked"])');
  if (firstBld) { await firstBld.click(); await page.waitForTimeout(1500); }

  // Progress bars in modal
  console.log('\n=== Progress Bar Search in Modal ===');
  const progressAll = await page.$$('[class*="progress"], [class*="Progress"], [role="progressbar"], [class*="bar"]');
  console.log('Progress elements:', progressAll.length);
  for (let i = 0; i < Math.min(progressAll.length, 10); i++) {
    const cls = await progressAll[i].getAttribute('class') || '';
    const txt = await progressAll[i].textContent();
    console.log('  progress[' + i + ']:', cls.substring(0, 60), '->', txt.trim().substring(0, 30));
  }

  // Bonus in modal
  console.log('\n=== Bonus/Output Search ===');
  const bonusAll = await page.$$('[class*="bonus"], [class*="output"], [class*="produce"], [class*="yield"], [class*="buff"], [class*="effect"]');
  console.log('Bonus elements:', bonusAll.length);
  for (let i = 0; i < Math.min(bonusAll.length, 10); i++) {
    const cls = await bonusAll[i].getAttribute('class') || '';
    const txt = await bonusAll[i].textContent();
    console.log('  bonus[' + i + ']:', cls.substring(0, 60), '->', txt.trim().substring(0, 40));
  }

  // Full modal class analysis
  console.log('\n=== Full Modal Content ===');
  const modal = await page.$('[class*="shared-panel"], [class*="modal"], [class*="SharedPanel"]');
  if (modal) {
    const html = await modal.innerHTML();
    console.log('Modal HTML length:', html.length);
    const classMatches = html.match(/class="[^"]+"/g) || [];
    const uniqueClasses = [...new Set(classMatches.map(c => c.replace('class="', '').replace('"', '')))];
    console.log('Unique class names in modal:', uniqueClasses.length);
    uniqueClasses.forEach(c => console.log('  .' + c.substring(0, 80)));
  }

  await browser.close();
})().catch(e => console.error(e.message));
