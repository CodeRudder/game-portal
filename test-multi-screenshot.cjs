const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto('http://localhost:3001/games/three-kingdoms-pixi', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  const dir = '/mnt/user-data/workspace/game-portal/screenshots';

  const buf1 = await page.screenshot();
  fs.writeFileSync(path.join(dir, 'v1-02-main.png'), buf1);

  const startBtn = await page.$('button:has-text("开始游戏")');
  if (startBtn) await startBtn.click();
  await page.waitForTimeout(1500);

  const buf2 = await page.screenshot();
  fs.writeFileSync(path.join(dir, 'v1-03-after.png'), buf2);

  console.log('Files:', fs.readdirSync(dir).filter(f => f.startsWith('v1-')));
  await browser.close();
})();
