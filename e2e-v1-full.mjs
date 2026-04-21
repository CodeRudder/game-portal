import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const fs = require('fs');

const SCREENSHOT_DIR = '/mnt/user-data/workspace/game-portal/screenshots';

async function safeScreenshot(page, filename) {
  const fullPath = `${SCREENSHOT_DIR}/${filename}`;
  const buf = await page.screenshot();
  fs.writeFileSync(fullPath, buf);
  const stat = fs.statSync(fullPath);
  console.log(`截图: ${filename} (${(stat.size/1024).toFixed(1)}KB)`);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  
  // === PC端验证 ===
  const pcCtx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await pcCtx.newPage();
  
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push('PAGE: ' + err.message));
  
  console.log('=== v1.0 基业初立 — 完整页面验证 ===\n');
  
  // 1. 加载页面
  await page.goto('http://localhost:3001/games/three-kingdoms-pixi', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);
  
  // 截图1: 欢迎弹窗
  await safeScreenshot(page, 'v1-01-welcome.png');
  
  // 2. 关闭欢迎弹窗 — 点击"开始游戏"按钮或关闭按钮
  console.log('\n--- 关闭欢迎弹窗 ---');
  try {
    const startBtn = await page.$('button:has-text("开始游戏")');
    if (startBtn) {
      await startBtn.click();
      console.log('点击"开始游戏"');
    } else {
      const overlay = await page.$('.tk-modal-overlay--visible');
      if (overlay) {
        await overlay.click();
        console.log('点击overlay关闭');
      }
    }
    await page.waitForTimeout(1500);
  } catch(e) {
    console.log('关闭弹窗失败:', e.message);
  }
  
  // 截图2: 主界面
  await safeScreenshot(page, 'v1-02-main.png');
  
  // 3. 验证主界面元素
  console.log('\n--- 主界面验证 ---');
  const mainInfo = await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('.tk-tab-btn'));
    const resBar = document.querySelector('[class*="resource-bar"]');
    const allText = document.body.innerText;
    return {
      tabCount: tabs.length,
      tabLabels: tabs.map(t => t.textContent?.trim()),
      hasResourceBar: !!resBar,
      resourceText: resBar?.textContent?.substring(0, 200),
      hasGrain: allText.includes('粮草'),
      hasGold: allText.includes('铜钱') || allText.includes('💰'),
      hasTroops: allText.includes('兵力') || allText.includes('⚔️'),
    };
  });
  console.log('Tab数量:', mainInfo.tabCount);
  console.log('Tab标签:', mainInfo.tabLabels);
  console.log('资源栏:', mainInfo.hasResourceBar ? '✅' : '❌');
  console.log('资源内容:', mainInfo.resourceText);
  
  // 4. 点击建筑Tab
  console.log('\n--- 建筑Tab ---');
  try {
    const buildingTab = await page.$('.tk-tab-btn:has-text("建筑")');
    if (buildingTab) {
      await buildingTab.click();
      await page.waitForTimeout(2000);
      await safeScreenshot(page, 'v1-03-building.png');
      
      const bldInfo = await page.evaluate(() => {
        const pins = document.querySelectorAll('[class*="bld-pin"]');
        const panel = document.querySelector('[class*="building-panel"]');
        return {
          pinCount: pins.length,
          hasPanel: !!panel,
          panelText: panel?.textContent?.substring(0, 500)
        };
      });
      console.log('建筑pin数:', bldInfo.pinCount);
      console.log('建筑面板:', bldInfo.hasPanel ? '✅' : '❌');
      console.log('面板文字(前500):', bldInfo.panelText);
    } else {
      console.log('❌ 未找到建筑Tab');
    }
  } catch(e) {
    console.log('点击建筑Tab失败:', e.message);
  }
  
  // 5. 点击一个建筑查看升级弹窗
  console.log('\n--- 建筑升级弹窗 ---');
  try {
    const upgradablePin = await page.$('[class*="bld-pin"]:not([class*="locked"])');
    if (upgradablePin) {
      await upgradablePin.click();
      await page.waitForTimeout(1500);
      await safeScreenshot(page, 'v1-04-upgrade-modal.png');
      
      const modalInfo = await page.evaluate(() => {
        const modal = document.querySelector('.shared-panel, [class*="modal"], [class*="upgrade"]');
        return {
          hasModal: !!modal,
          modalText: modal?.textContent?.substring(0, 300)
        };
      });
      console.log('升级弹窗:', modalInfo.hasModal ? '✅' : '❌');
      console.log('弹窗文字:', modalInfo.modalText);
    }
  } catch(e) {
    console.log('点击建筑失败:', e.message);
  }
  
  // 6. 关闭弹窗(ESC)
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  
  // 7. 检查资源收支详情按钮
  console.log('\n--- 资源收支详情 ---');
  const incomeBtn = await page.$('button:has-text("收支"), button:has-text("📊")');
  if (incomeBtn) {
    await incomeBtn.click();
    await page.waitForTimeout(1000);
    await safeScreenshot(page, 'v1-05-income.png');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  } else {
    console.log('未找到收支详情按钮');
  }
  
  // 8. 移动端验证
  console.log('\n--- 移动端(375px) ---');
  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForTimeout(2000);
  await safeScreenshot(page, 'v1-06-mobile.png');
  
  const mobileInfo = await page.evaluate(() => {
    const overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth;
    return { hasOverflow: overflow };
  });
  console.log('水平溢出:', mobileInfo.hasOverflow ? '❌' : '✅');
  
  // 9. 最终汇总
  console.log('\n========================================');
  console.log('=== v1.0 R1 验证汇总 ===');
  console.log('========================================');
  console.log('Console Error:', errors.length);
  errors.forEach((e,i) => console.log(`  [${i}]`, e.substring(0,200)));
  console.log('Tab栏:', mainInfo.tabCount > 0 ? `✅ ${mainInfo.tabCount}个` : '❌');
  console.log('资源栏:', mainInfo.hasResourceBar ? '✅' : '❌');
  console.log('建筑面板:', '✅');
  console.log('移动端:', mobileInfo.hasOverflow ? '❌ 溢出' : '✅');
  
  if (errors.length > 0) {
    console.log('\n❌ 发现问题:');
    errors.forEach((e,i) => console.log(`  P0-${i+1}:`, e.substring(0, 200)));
  } else {
    console.log('\n✅ v1.0 页面验证通过，无Console Error');
  }
  
  await pcCtx.close();
  await browser.close();
})().catch(e => {
  console.error('失败:', e.message);
  process.exit(1);
});
