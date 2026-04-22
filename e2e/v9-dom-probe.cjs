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
      
      const domInfo = await page.evaluate(() => {
        const allTestIds = Array.from(document.querySelectorAll("[data-testid]")).map(el => ({
          testid: el.getAttribute("data-testid"),
          visible: el.offsetParent !== null,
        }));
        
        const sharedPanel = document.querySelector("[class*='shared-panel']");
        let sharedHTML = sharedPanel ? sharedPanel.innerHTML.substring(0, 500) : "not found";
        
        const mailPanel = document.querySelector('[data-testid="mail-panel"]');
        let mailInfo = mailPanel ? {
          visible: mailPanel.offsetParent !== null,
          display: getComputedStyle(mailPanel).display,
        } : "not found";
        
        const bodyText = document.body.innerText;
        const mailIdx = bodyText.indexOf("未读");
        const snippet = mailIdx >= 0 ? bodyText.substring(Math.max(0, mailIdx - 50), mailIdx + 200) : "未读 not found";
        
        return { allTestIds, sharedHTML, mailInfo, snippet };
      });
      console.log("All testIds:", JSON.stringify(domInfo.allTestIds, null, 2));
      console.log("\nMail info:", JSON.stringify(domInfo.mailInfo, null, 2));
      console.log("\nSnippet:", domInfo.snippet);
      console.log("\nShared panel HTML (first 500):", domInfo.sharedHTML);
    }
  }
  
  await browser.close();
})();
