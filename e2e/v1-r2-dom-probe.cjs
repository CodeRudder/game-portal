/**
 * v1.0 Round 2 — DOM探针：深入检查资源栏和建筑面板
 */
const { chromium } = require('playwright');
const path = require('path');

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  await page.goto('http://localhost:3000/idle/three-kingdoms');
  await sleep(3000);

  // Close modals
  for (let i = 0; i < 5; i++) {
    const closeBtn = await page.$('.tk-modal-close, button:has-text("关闭"), button:has-text("确定"), button:has-text("领取"), button:has-text("开始游戏")');
    if (closeBtn) { await closeBtn.click(); await sleep(500); }
    else break;
  }
  await page.keyboard.press('Escape');
  await sleep(500);

  // Probe resource bar
  console.log('=== Resource Bar DOM ===');
  const resourceBarHTML = await page.evaluate(() => {
    const bar = document.querySelector('.tk-resource-bar, .resource-bar');
    if (!bar) return 'No resource bar found';
    return bar.innerHTML.substring(0, 2000);
  });
  console.log(resourceBarHTML);

  console.log('\n=== Resource Bar Children ===');
  const resourceChildren = await page.evaluate(() => {
    const bar = document.querySelector('.tk-resource-bar, .resource-bar');
    if (!bar) return [];
    return Array.from(bar.children).map(c => ({
      tag: c.tagName,
      class: c.className,
      text: c.textContent.substring(0, 100),
      width: c.getBoundingClientRect().width,
      visible: c.getBoundingClientRect().width > 0
    }));
  });
  console.log(JSON.stringify(resourceChildren, null, 2));

  console.log('\n=== Building Panel DOM ===');
  const buildingHTML = await page.evaluate(() => {
    const panel = document.querySelector('.tk-building-panel, .building-panel, .tk-scene-area');
    if (!panel) return 'No building panel found';
    return panel.innerHTML.substring(0, 2000);
  });
  console.log(buildingHTML);

  console.log('\n=== Building Cards ===');
  const buildingCards = await page.evaluate(() => {
    const cards = document.querySelectorAll('[class*="building-card"], [class*="tk-building"]');
    return Array.from(cards).map(c => ({
      class: c.className,
      text: c.textContent.substring(0, 80),
      clickable: c.onclick !== null || c.style.cursor === 'pointer'
    }));
  });
  console.log(JSON.stringify(buildingCards, null, 2));

  console.log('\n=== Full Body Text (first 1000 chars) ===');
  const bodyText = await page.evaluate(() => document.body.textContent.substring(0, 1000));
  console.log(bodyText);

  await browser.close();
}

main().catch(console.error);
