const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('CONSOLE ERROR: ' + msg.text().substring(0, 200));
  });

  await page.goto('http://localhost:5173/idle/three-kingdoms', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  const startBtn = await page.$('button:has-text("开始游戏")');
  if (startBtn) { await startBtn.click(); await page.waitForTimeout(3000); }

  // 切换到武将Tab
  const heroTab = await page.$('button:has-text("武将")');
  if (heroTab) { await heroTab.click(); await page.waitForTimeout(2000); }

  console.log('=== v2.0 R1-补充: 武将详情+深度验证 ===');

  // 1. 找到武将卡片的实际class
  console.log('\n--- 武将Tab DOM分析 ---');
  const heroPanel = await page.$('[class*="hero-panel"], [class*="HeroPanel"], [class*="hero"]');
  if (heroPanel) {
    // 获取面板内所有可点击元素
    const clickables = await heroPanel.$$('[class*="card"], [class*="item"], [class*="portrait"], [role="button"], [style*="cursor"]');
    console.log('可点击元素数量: ' + clickables.length);
    for (let i = 0; i < Math.min(clickables.length, 15); i++) {
      const cls = await clickables[i].getAttribute('class');
      const tag = await clickables[i].evaluate(el => el.tagName);
      const text = await clickables[i].textContent();
      console.log('  [' + i + '] <' + tag + '> class="' + (cls ? cls.substring(0, 60) : 'null') + '" text="' + (text ? text.trim().substring(0, 40) : '空') + '"');
    }
  }

  // 2. 获取武将Tab完整HTML结构（前2000字符）
  console.log('\n--- 武将Tab HTML结构 ---');
  const heroHTML = await page.evaluate(() => {
    const heroSection = document.querySelector('[class*="hero-panel"], [class*="HeroPanel"]');
    if (heroSection) return heroSection.innerHTML.substring(0, 2000);
    // fallback: 找scene区域
    const scene = document.querySelector('[class*="scene"], [class*="Scene"]');
    if (scene) return scene.innerHTML.substring(0, 2000);
    return 'NOT_FOUND';
  });
  console.log(heroHTML);

  // 3. 尝试点击武将打开详情
  console.log('\n--- 尝试点击武将 ---');
  // 尝试多种选择器
  const selectors = [
    '[class*="hero-portrait"]',
    '[class*="hero-avatar"]',
    '[class*="hero-card"]',
    '[class*="hero-item"]',
    '[class*="tk-hero"]',
    '[class*="hero"] > div',
    '[class*="hero"] > *',
  ];
  for (const sel of selectors) {
    const els = await page.$$(sel);
    if (els.length > 0) {
      console.log(sel + ': 找到' + els.length + '个');
      // 点击第一个
      try {
        await els[0].click();
        await page.waitForTimeout(1500);
        const modal = await page.$('[class*="shared-panel"], [class*="modal"], [class*="detail"], [class*="Detail"]');
        if (modal) {
          const modalText = await modal.textContent();
          console.log('✅ 弹窗出现！内容: ' + modalText.substring(0, 200));
          await page.screenshot({ path: 'screenshots/v2-r1-hero-detail.png' });
          
          // 检查详情内容
          const hasLevel = modalText.includes('Lv') || modalText.includes('等级');
          const hasAttr = modalText.includes('攻击') || modalText.includes('防御') || modalText.includes('生命') || modalText.includes('ATK');
          const hasPower = modalText.includes('战力') || modalText.includes('power');
          console.log('等级显示: ' + hasLevel);
          console.log('属性显示: ' + hasAttr);
          console.log('战力显示: ' + hasPower);
          
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);
          break;
        } else {
          console.log(sel + ': 点击后无弹窗');
        }
      } catch (e) {
        console.log(sel + ': 点击失败 - ' + e.message.substring(0, 100));
      }
    }
  }

  // 4. 武将升级测试
  console.log('\n--- 武将升级测试 ---');
  // 先找升级按钮
  const allBtns = await page.$$('button');
  for (const btn of allBtns) {
    const text = await btn.textContent();
    if (text && (text.includes('升级') || text.includes('强化') || text.includes('level'))) {
      console.log('找到升级按钮: ' + text.trim());
    }
  }

  await browser.close();
})().catch(e => { console.error('失败:', e.message); process.exit(1); });
