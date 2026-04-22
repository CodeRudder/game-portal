/**
 * v1.0 Round 2 — 补充UI测试：建筑升级流程
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

  const results = { tests: [] };

  // ═══════════════════════════════════════
  // Test 1: Click building pin to open upgrade modal
  // ═══════════════════════════════════════
  console.log('--- BLD-2: 建筑升级操作 (补充) ---');
  
  // Click the main city pin (upgradable)
  const mainCityPin = await page.$('.tk-bld-pin[aria-label*="主城"]');
  if (mainCityPin) {
    await mainCityPin.click();
    await sleep(1000);
    
    // Check for upgrade modal
    const modal = await page.$('.tk-modal, .tk-upgrade-modal, [class*="upgrade-modal"], [class*="modal"]');
    const upgradeBtn = await page.$('button:has-text("升级"), button:has-text("Upgrade")');
    
    // Get modal content
    const modalText = modal ? await modal.textContent() : 'No modal';
    
    await page.screenshot({ path: path.join(__dirname, 'screenshots', 'v1-r2', 'bld-02-upgrade-modal-v2.png'), fullPage: false });
    
    const t1 = {
      id: 'BLD-2',
      name: '建筑升级操作',
      checks: {
        pinClickable: true,
        modalAppears: !!modal,
        upgradeButton: !!upgradeBtn,
        modalContent: modalText.substring(0, 200)
      },
      passed: !!modal
    };
    results.tests.push(t1);
    console.log(`  Pin可点击: ✅`);
    console.log(`  弹窗出现: ${!!modal ? '✅' : '❌'}`);
    console.log(`  升级按钮: ${!!upgradeBtn ? '✅' : '❌'}`);
    console.log(`  弹窗内容: ${modalText.substring(0, 100)}`);
    console.log(`  Result: ${t1.passed ? 'PASS' : 'FAIL'}\n`);
    
    // Try clicking upgrade button
    if (upgradeBtn) {
      await upgradeBtn.click();
      await sleep(1000);
      await page.screenshot({ path: path.join(__dirname, 'screenshots', 'v1-r2', 'bld-03-after-upgrade.png'), fullPage: false });
      
      // Check for success toast or resource change
      const toast = await page.$('.toast, .tk-toast, [class*="toast"]');
      console.log(`  Toast after upgrade: ${!!toast ? '✅' : '⚠️'}`);
    }
  } else {
    console.log('  Main city pin not found ❌');
    results.tests.push({ id: 'BLD-2', name: '建筑升级操作', passed: false, checks: { pinClickable: false } });
  }

  // ═══════════════════════════════════════
  // Test 2: Resource growth over time
  // ═══════════════════════════════════════
  console.log('--- RES-1: 资源自动增长 (补充) ---');
  
  // Get grain value from title attribute
  const getGrainValue = async () => {
    const grainItem = await page.$('.tk-res-item[title*="粮草"]');
    if (grainItem) {
      const title = await grainItem.getAttribute('title');
      const match = title && title.match(/粮草\s+([\d,]+)/);
      return match ? parseInt(match[1].replace(/,/g, '')) : 0;
    }
    // Fallback: get from value span
    const items = await page.$$('.tk-res-item');
    if (items.length > 0) {
      const valSpan = await items[0].$('.tk-res-value');
      if (valSpan) {
        const text = await valSpan.textContent();
        return parseInt(text.replace(/,/g, '')) || 0;
      }
    }
    return 0;
  };
  
  const v1 = await getGrainValue();
  console.log(`  初始粮草: ${v1}`);
  await sleep(3000);
  const v2 = await getGrainValue();
  console.log(`  3秒后粮草: ${v2}`);
  const growing = v2 > v1;
  console.log(`  增长: ${growing ? '✅' : '❌'} (差值: ${v2 - v1})`);
  results.tests.push({ id: 'RES-1', name: '资源自动增长', passed: growing, checks: { v1, v2, growing } });

  // ═══════════════════════════════════════
  // Test 3: Capacity progress bar
  // ═══════════════════════════════════════
  console.log('\n--- RES-4: 容量进度条 ---');
  const capBars = await page.$$('.tk-res-cap-bar');
  const capFills = await page.$$('.tk-res-cap-bar-fill');
  const capTexts = await page.$$('.tk-res-cap');
  
  const t3 = {
    id: 'RES-4', name: '容量进度条',
    checks: {
      capBars: capBars.length,
      capFills: capFills.length,
      capTexts: capTexts.length
    },
    passed: capBars.length >= 1 && capFills.length >= 1
  };
  results.tests.push(t3);
  console.log(`  进度条数: ${capBars.length}`);
  console.log(`  填充条数: ${capFills.length}`);
  console.log(`  容量文字: ${capTexts.length}`);
  console.log(`  Result: ${t3.passed ? 'PASS' : 'FAIL'}`);

  // Summary
  const passed = results.tests.filter(t => t.passed).length;
  const total = results.tests.length;
  console.log(`\n=== SUMMARY: ${passed}/${total} passed ===`);

  await browser.close();
  
  const fs = require('fs');
  fs.writeFileSync(path.join(__dirname, 'screenshots', 'v1-r2', 'v1-r2-supplement-results.json'), JSON.stringify(results, null, 2));
}

main().catch(console.error);
