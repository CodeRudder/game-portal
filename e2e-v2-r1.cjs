const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const issues = [];
  const consoleErrors = [];

  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push('PAGEERROR: ' + err.message));

  // 辅助函数：强制清除所有引导遮罩
  async function dismissGuide() {
    for (let i = 0; i < 5; i++) {
      const removed = await page.evaluate(() => {
        let count = 0;
        // 移除所有可能的引导相关元素
        document.querySelectorAll('div, [role]').forEach(el => {
          if (el.className && typeof el.className === 'string' && 
              (el.className.includes('guide') || el.getAttribute('aria-label') === 'Tutorial')) {
            el.remove();
            count++;
          }
        });
        return count;
      });
      if (removed > 0) console.log('  [guide] 移除 ' + removed + ' 个引导元素');
      await page.waitForTimeout(300);
      const still = await page.evaluate(() => {
        const el = document.querySelector('.tk-guide-overlay, .tk-guide-backdrop, [aria-label="Tutorial"]');
        return !!el;
      });
      if (!still) return;
    }
  }

  // 辅助函数：安全点击（先清除引导再点击）
  async function safeClick(selector) {
    await dismissGuide();
    const el = await page.$(selector);
    if (el) {
      await el.click().catch(() => {});
      await page.waitForTimeout(500);
      await dismissGuide();
      return true;
    }
    return false;
  }

  console.log('=== v2.0 招贤纳士 R1 评测 ===');

  // 加载并进入游戏
  await page.goto('http://localhost:5173/idle/three-kingdoms', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  const startBtn = await page.$('button:has-text("开始游戏")');
  if (startBtn) { await startBtn.click(); await page.waitForTimeout(3000); }
  await dismissGuide();

  // === Phase 1: 静态检查 ===
  console.log('\n=== Phase 1: 静态检查 ===');
  console.log('控制台错误: ' + consoleErrors.length);
  const bodyText = await page.textContent('body');
  console.log('NaN: ' + (bodyText.includes('NaN') ? '❌' : '✅'));
  console.log('undefined: ' + (bodyText.includes('undefined') ? '❌' : '✅'));

  // === Phase 2: v2.0功能验证 ===
  console.log('\n=== Phase 2: v2.0功能验证 ===');

  // 2.1 武将Tab
  console.log('\n--- 2.1 武将Tab ---');
  await safeClick('button:has-text("武将")');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'screenshots/v2-r1-hero-tab.png' });

  const heroText = await page.textContent('body');
  console.log('武将Tab内容长度: ' + heroText.trim().length);

  // 检查武将列表
  const heroCards = await page.$$('[class*="hero-card"], [class*="hero-item"], [class*="tk-hero"]');
  console.log('武将卡片数量: ' + heroCards.length);

  // 检查招募按钮
  const recruitBtn = await page.$('button:has-text("招募"), button:has-text("求贤")');
  console.log('招募按钮: ' + (!!recruitBtn ? '✅' : '❌'));
  if (!recruitBtn) {
    issues.push({ id: 'V2-RECRUIT', desc: '招募按钮未找到', severity: 'P1' });
  }

  // 检查武将数量显示
  const countEl = await page.$('[class*="hero-count"], [class*="count"]');
  console.log('武将数量元素: ' + (!!countEl ? '✅' : '⚠️'));

  // 2.2 武将详情弹窗
  console.log('\n--- 2.2 武将详情 ---');
  const heroCard = await page.$('[class*="hero-card"], [class*="hero-item"]');
  if (heroCard) {
    await heroCard.click();
    await page.waitForTimeout(500);
    await dismissGuide();
    await page.waitForTimeout(1000);
    const detailModal = await page.$('[class*="shared-panel"], [class*="modal"], [class*="detail"]');
    console.log('武将详情弹窗: ' + (!!detailModal ? '✅' : '❌'));
    if (detailModal) {
      const detailText = await detailModal.textContent();
      console.log('详情内容: ' + detailText.substring(0, 200));
      await page.screenshot({ path: 'screenshots/v2-r1-hero-detail.png' });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  } else {
    console.log('无可点击的武将卡片（可能选择器不匹配）');
    // 尝试通过文本查找
    const allItems = await page.$$('[class*="card"], [class*="item"]');
    console.log('所有card/item元素: ' + allItems.length);
  }

  // 2.3 招募系统
  console.log('\n--- 2.3 招募系统 ---');
  await safeClick('button:has-text("武将")');
  await page.waitForTimeout(1500);
  await dismissGuide();

  // 寻找招募入口 - 遍历所有按钮
  const allBtns = await page.$$('button');
  let recruitFound = false;
  for (const btn of allBtns) {
    const text = await btn.textContent();
    if (text && (text.includes('招募') || text.includes('求贤') || text.includes('抽将'))) {
      console.log('找到招募按钮: ' + text.trim());
      await dismissGuide();
      await btn.click().catch(() => {});
      await page.waitForTimeout(500);
      await dismissGuide();
      await page.waitForTimeout(1000);
      recruitFound = true;
      break;
    }
  }

  if (recruitFound) {
    await page.screenshot({ path: 'screenshots/v2-r1-recruit.png' });
    const recruitText = await page.textContent('body');
    console.log('招募页面内容长度: ' + recruitText.trim().length);

    // 检查招募池
    const poolElements = await page.$$('[class*="pool"], [class*="banner"]');
    console.log('招募池元素: ' + poolElements.length);

    // 检查保底信息
    const pityInfo = await page.$$('[class*="pity"], [class*="guarantee"]');
    const pityText = recruitText.includes('保底');
    console.log('保底信息: ' + (pityText ? '✅' : '⚠️') + ' (元素:' + pityInfo.length + ')');

    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  } else {
    console.log('⚠️ 招募按钮未找到');
    issues.push({ id: 'V2-RECRUIT-BTN', desc: '招募按钮未找到', severity: 'P1' });
  }

  // 2.4 资源栏检查（v1.0修复验证）
  console.log('\n--- 2.4 v1.0回归 ---');
  await safeClick('button:has-text("建筑")');
  await page.waitForTimeout(1500);
  
  const resourceBar = await page.$('[class*="resource"], [class*="ResourceBar"]');
  if (resourceBar) {
    const box = await resourceBar.boundingBox();
    if (box) {
      console.log('资源栏: y=' + box.y + ' ' + (box.y < 10 ? '✅' : '❌'));
    } else {
      console.log('资源栏: ⚠️ 无法获取位置');
    }
  } else {
    console.log('资源栏: ⚠️ 未找到');
  }
  
  const tabBar = await page.$('[class*="tk-tab-bar"]');
  if (tabBar) {
    const box = await tabBar.boundingBox();
    if (box) {
      console.log('Tab栏: bottom=' + (box.y + box.height) + ' ' + (box.y + box.height > 700 ? '✅' : '❌'));
    }
  }

  // 2.5 移动端
  console.log('\n--- 2.5 移动端 ---');
  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForTimeout(2000);
  await dismissGuide();
  await safeClick('button:has-text("武将")');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'screenshots/v2-r1-mobile.png' });
  const mobileText = await page.textContent('body');
  console.log('移动端内容: ' + mobileText.trim().length + '字符 ' + (mobileText.trim().length > 50 ? '✅' : '❌'));

  // 汇总
  console.log('\n=== v2.0 R1 汇总 ===');
  console.log('Console Errors: ' + consoleErrors.length);
  console.log('Issues: ' + issues.length);
  issues.forEach(i => console.log('  [' + i.severity + '] ' + i.id + ': ' + i.desc));
  if (consoleErrors.length > 0) {
    console.log('\n控制台错误详情:');
    consoleErrors.forEach((e, i) => console.log('  E[' + i + ']: ' + e.substring(0, 200)));
  }

  fs.writeFileSync('e2e-v2-r1-results.json', JSON.stringify({ issues, errors: consoleErrors.length }, null, 2));
  await browser.close();
})().catch(e => { console.error('失败:', e.message); process.exit(1); });
