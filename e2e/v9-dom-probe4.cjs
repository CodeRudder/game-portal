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
        const text = document.body.innerText;
        const hasMailPanel = text.includes('未读') && text.includes('全部已读');
        const hasTabs = text.includes('全部') && text.includes('系统') && text.includes('战斗') && text.includes('社交') && text.includes('奖励');
        const buttons = Array.from(document.querySelectorAll('button'));
        const batchReadBtn = buttons.find(b => b.textContent?.includes('全部已读'));
        const batchClaimBtn = buttons.find(b => b.textContent?.includes('一键领取'));
        const tabTexts = ['全部', '系统', '战斗', '社交', '奖励'];
        const tabButtons = tabTexts.map(t => {
          const btn = buttons.find(b => b.textContent?.trim() === t);
          return { text: t, found: !!btn };
        });
        return { hasMailPanel, hasTabs, hasBatchRead: !!batchReadBtn, hasBatchClaim: !!batchClaimBtn, tabButtons };
      });
      console.log(JSON.stringify(info, null, 2));
    }
  }
  await browser.close();
})();
