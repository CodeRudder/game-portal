const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto("http://localhost:3000/idle/three-kingdoms", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(3000);
  const startBtn = await page.$('button:has-text("开始游戏")');
  if (startBtn) { await startBtn.click(); await page.waitForTimeout(3000); }
  const moreBtn = await page.$('button:has-text("更多")');
  if (moreBtn) {
    await moreBtn.click();
    await page.waitForTimeout(1000);
    const mailBtn = await page.$('button:has-text("邮件")');
    if (mailBtn) {
      await mailBtn.click();
      await page.waitForTimeout(2000);
      const info = await page.evaluate(() => {
        const body = document.querySelector('.tk-shared-panel-body');
        if (!body) return { error: 'no body' };
        const firstDiv = body.querySelector('div');
        return {
          firstDivTestId: firstDiv?.getAttribute('data-testid'),
          firstDivStyle: firstDiv?.getAttribute('style'),
          firstDivAllAttrs: firstDiv ? Array.from(firstDiv.attributes).map(a => a.name + '=' + a.value) : [],
          bodyChildCount: body.children.length,
          bodyHTML: body.innerHTML.substring(0, 300),
        };
      });
      console.log(JSON.stringify(info, null, 2));
    }
  }
  await browser.close();
})();
