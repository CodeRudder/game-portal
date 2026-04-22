const puppeteer = require("puppeteer");
(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const p = await browser.newPage();
  await p.setViewport({ width: 375, height: 812, deviceScaleFactor: 3 });
  await p.setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)");
  await p.goto("http://localhost:5173/idle/three-kingdoms", { waitUntil: "networkidle2", timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));
  
  // Click start
  const btns = await p.$$("button");
  for (const b of btns) {
    const t = await b.evaluate(el => el.textContent?.trim());
    if (t === "开始游戏") { console.log("Clicking start"); await b.click(); break; }
  }
  await new Promise(r => setTimeout(r, 3000));
  
  // Skip guide
  for (let i = 0; i < 10; i++) {
    const o = await p.$(".tk-guide-overlay");
    if (!o) { console.log("No guide overlay at step", i); break; }
    const s = await p.$(".tk-guide-btn--skip");
    if (s) { console.log("Skipping guide step", i); await s.evaluate(e => e.click()); await new Promise(r => setTimeout(r, 500)); continue; }
    await p.keyboard.press("Escape");
    await new Promise(r => setTimeout(r, 500));
  }
  await new Promise(r => setTimeout(r, 1000));
  
  // Check what tabs exist on mobile
  const tabs = await p.$$(".tk-tab-btn");
  console.log("Mobile tabs:", tabs.length);
  for (const tab of tabs) {
    const text = await tab.evaluate(el => el.textContent?.trim());
    console.log("  tab:", JSON.stringify(text));
  }
  
  // Try clicking more
  let moreClicked = false;
  for (const tab of tabs) {
    const text = await tab.evaluate(el => el.textContent?.trim());
    if (text && text.includes("更多")) {
      console.log("Clicking more tab...");
      await tab.click();
      await new Promise(r => setTimeout(r, 1500));
      moreClicked = true;
      break;
    }
  }
  console.log("More clicked:", moreClicked);
  
  // Check more cards
  const cards = await p.$$(".tk-more-card");
  console.log("More cards:", cards.length);
  for (const c of cards) {
    const t = await c.evaluate(el => el.textContent?.trim());
    console.log("  card:", JSON.stringify(t?.substring(0, 30)));
  }
  
  // Click settings
  for (const c of cards) {
    const t = await c.evaluate(el => el.textContent?.trim());
    if (t && t.includes("设置")) {
      console.log("Clicking settings...");
      await c.click();
      await new Promise(r => setTimeout(r, 2000));
      break;
    }
  }
  
  const overlay = await p.$(".tk-shared-panel-overlay");
  console.log("Overlay found:", !!overlay);
  
  await p.screenshot({ path: "/mnt/user-data/workspace/game-portal/e2e/screenshots/v19-evolution/debug-mobile-settings.png" });
  await browser.close();
})();
