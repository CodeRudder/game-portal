const puppeteer = require("puppeteer");
(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto("http://localhost:5173/idle/three-kingdoms", { waitUntil: "networkidle2", timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));
  const btns = await page.$$("button");
  for (const b of btns) {
    const t = await b.evaluate(el => el.textContent?.trim());
    if (t === "开始游戏") { await b.click(); break; }
  }
  await new Promise(r => setTimeout(r, 3000));
  for (let i = 0; i < 10; i++) {
    const o = await page.$(".tk-guide-overlay");
    if (!o) break;
    const s = await page.$(".tk-guide-btn--skip");
    if (s) { await s.evaluate(e => e.click()); await new Promise(r => setTimeout(r, 500)); continue; }
    await page.keyboard.press("Escape");
    await new Promise(r => setTimeout(r, 500));
  }
  await new Promise(r => setTimeout(r, 1000));

  // Find the more tab
  const allTabs = await page.$$(".tk-tab-btn");
  for (const tab of allTabs) {
    const text = await tab.evaluate(el => el.textContent?.trim());
    if (text && text.includes("更多")) {
      console.log("Found tab:", JSON.stringify(text));
      await tab.click();
      await new Promise(r => setTimeout(r, 1500));
      break;
    }
  }
  
  // List more panel buttons
  const moreBtns = await page.$$(".tk-more-card, .tk-more-grid button");
  console.log("More panel buttons:", moreBtns.length);
  for (const b of moreBtns) {
    const t = await b.evaluate(el => el.textContent?.trim());
    console.log("  btn:", JSON.stringify(t?.substring(0, 40)));
  }
  
  // Click settings card
  for (const b of moreBtns) {
    const t = await b.evaluate(el => el.textContent?.trim());
    if (t && t.includes("设置")) {
      console.log("Clicking settings...");
      await b.click();
      await new Promise(r => setTimeout(r, 2000));
      break;
    }
  }
  
  const overlay = await page.$(".tk-shared-panel-overlay");
  console.log("Overlay found:", !!overlay);
  
  const panelBody = await page.$(".tk-shared-panel-body");
  if (panelBody) {
    const text = await panelBody.evaluate(el => el.textContent?.trim());
    console.log("Panel body (first 600):", text?.substring(0, 600));
  }
  
  await browser.close();
})();
