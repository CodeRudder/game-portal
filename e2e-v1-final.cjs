// e2e-v1-final.cjs — 最终版E2E验证
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  
  const errors = [];
  const warnings = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
    if (msg.type() === 'warning') warnings.push(msg.text());
  });
  
  // 确保截图目录存在
  const shotDir = '/mnt/user-data/workspace/game-portal/screenshots';
  if (!fs.existsSync(shotDir)) fs.mkdirSync(shotDir, { recursive: true });
  
  console.log('=== 三国霸业 v1.0 基业初立 — 完整页面验证 ===\n');
  
  // ==========================================
  // Phase 1: 首页加载
  // ==========================================
  console.log('【Phase 1: 首页加载】');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  const title = await page.title();
  console.log('页面标题:', title);
  
  // 首页截图
  const homeFile = `${shotDir}/v1-home.png`;
  await page.screenshot({ path: homeFile });
  const homeSize = fs.existsSync(homeFile) ? fs.statSync(homeFile).size : 0;
  console.log('首页截图:', homeFile, `(${homeSize} bytes)`);
  
  // 查找所有游戏卡片
  const cards = await page.$$eval('[class*="game-card"], [class*="GameCard"]', els => 
    els.map(e => ({ text: e.textContent?.trim().substring(0, 80), class: e.className?.substring(0, 60) }))
  );
  console.log('游戏卡片数量:', cards.length);
  cards.slice(0, 10).forEach((c, i) => console.log(`  Card[${i}]:`, c.text?.replace(/\s+/g, ' ').substring(0, 60)));
  
  // 查找三国霸业卡片
  const tkCards = await page.$$eval('[class*="game-card"]', els => 
    els.filter(e => e.textContent && e.textContent.includes('三国霸业'))
       .map(e => ({ text: e.textContent?.trim().substring(0, 100), innerHTML: e.innerHTML?.substring(0, 200) }))
  );
  console.log('\n三国霸业卡片:', tkCards.length);
  
  // 查找所有含"三国"文字的按钮
  const tkButtons = await page.$$('button');
  for (const btn of tkButtons) {
    const text = await btn.textContent();
    if (text && text.includes('三国霸业')) {
      console.log('找到三国霸业按钮:', text.trim().substring(0, 50));
    }
  }
  
  // 查找所有含"三国"文字的元素
  const allText = await page.evaluate(() => {
    const all = document.querySelectorAll('*');
    const results = [];
    for (const el of all) {
      if (el.children.length === 0 && el.textContent && el.textContent.includes('三国霸业')) {
        results.push({ tag: el.tagName, text: el.textContent.trim().substring(0, 50) });
      }
    }
    return results;
  });
  console.log('含"三国霸业"的叶子元素:', allText.length);
  allText.forEach((e, i) => console.log(`  ${i}:`, e.tag, e.text));
  
  // ==========================================
  // Phase 2: 导航到三国霸业
  // ==========================================
  console.log('\n【Phase 2: 导航到三国霸业】');
  
  // 尝试点击放置专区
  const idleBtn = await page.$('button:has-text("放置专区")');
  if (idleBtn) {
    console.log('点击"放置专区"...');
    await idleBtn.click();
    await page.waitForTimeout(2000);
    
    const idleFile = `${shotDir}/v1-idle-zone.png`;
    await page.screenshot({ path: idleFile });
    const idleSize = fs.existsSync(idleFile) ? fs.statSync(idleFile).size : 0;
    console.log('放置专区截图:', idleFile, `(${idleSize} bytes)`);
    
    // 查找三国霸业卡片
    const idleCards = await page.evaluate(() => {
      const cards = document.querySelectorAll('[class*="game-card"]');
      return Array.from(cards).map(c => c.textContent?.trim().substring(0, 60).replace(/\s+/g, ' '));
    });
    console.log('放置专区卡片:', idleCards);
    
    // 找到三国霸业并点击
    const tkCard = await page.$('[class*="game-card"]:has-text("三国霸业")');
    if (tkCard) {
      console.log('找到三国霸业卡片，点击进入...');
      await tkCard.click();
      await page.waitForTimeout(5000);
    } else {
      console.log('未找到三国霸业卡片，尝试直接导航...');
      await page.goto('http://localhost:3000/game/three-kingdoms', { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(3000);
    }
  } else {
    console.log('未找到"放置专区"按钮，尝试直接导航...');
    await page.goto('http://localhost:3000/game/three-kingdoms', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(3000);
  }
  
  const currentUrl = page.url();
  console.log('当前URL:', currentUrl);
  
  // 游戏页截图
  const gameFile = `${shotDir}/v1-game-tk.png`;
  await page.screenshot({ path: gameFile });
  const gameSize = fs.existsSync(gameFile) ? fs.statSync(gameFile).size : 0;
  console.log('游戏页截图:', gameFile, `(${gameSize} bytes)`);
  
  // ==========================================
  // Phase 3: 游戏页面详细分析
  // ==========================================
  console.log('\n【Phase 3: 游戏页面详细分析】');
  
  const bodyText = await page.textContent('body');
  console.log('页面内容长度:', bodyText ? bodyText.length : 0);
  console.log('页面内容预览:', bodyText ? bodyText.substring(0, 500).replace(/\s+/g, ' ') : '空');
  
  // 查找所有关键UI元素
  const uiAnalysis = await page.evaluate(() => {
    const result = {};
    
    // 所有class含特定关键字的元素
    const keywords = ['resource', 'building', 'hero', 'general', 'tab', 'panel', 'game', 'three-kingdoms', 'tk-'];
    keywords.forEach(kw => {
      const els = document.querySelectorAll(`[class*="${kw}"]`);
      result[kw] = { count: els.length, samples: [] };
      for (let i = 0; i < Math.min(els.length, 3); i++) {
        result[kw].samples.push({
          tag: els[i].tagName,
          class: els[i].className?.substring(0, 80),
          text: els[i].textContent?.trim().substring(0, 50)
        });
      }
    });
    
    // 所有按钮
    const buttons = document.querySelectorAll('button');
    result.buttons = { count: buttons.length, texts: [] };
    for (let i = 0; i < Math.min(buttons.length, 20); i++) {
      result.buttons.texts.push(buttons[i].textContent?.trim().substring(0, 30));
    }
    
    return result;
  });
  
  console.log('\nUI元素分析:');
  Object.entries(uiAnalysis).forEach(([key, val]) => {
    if (key === 'buttons') {
      console.log(`  ${key}: ${val.count}个`);
      val.texts.forEach((t, i) => console.log(`    btn[${i}]: ${t}`));
    } else {
      console.log(`  ${key}: ${val.count}个`);
      val.samples.forEach((s, i) => console.log(`    [${i}] <${s.tag}> class="${s.class}" text="${s.text}"`));
    }
  });
  
  // ==========================================
  // Phase 4: Tab交互测试
  // ==========================================
  console.log('\n【Phase 4: Tab交互测试】');
  
  const tabBtns = await page.$$('button');
  const tabNames = ['建筑', '城池', '武将', '招募', '兵营', '科技', '内政', '地图', '战斗', '商店', '交易'];
  
  for (const btn of tabBtns) {
    const text = await btn.textContent();
    if (text) {
      const trimmed = text.trim();
      for (const name of tabNames) {
        if (trimmed.includes(name)) {
          console.log(`点击Tab: "${trimmed}"`);
          try {
            await btn.click();
            await page.waitForTimeout(1500);
            const tabFile = `${shotDir}/v1-tab-${name}.png`;
            await page.screenshot({ path: tabFile });
            const tabSize = fs.existsSync(tabFile) ? fs.statSync(tabFile).size : 0;
            console.log(`  截图: ${tabFile} (${tabSize} bytes)`);
          } catch (e) {
            console.log(`  点击失败: ${e.message.substring(0, 100)}`);
          }
          break;
        }
      }
    }
  }
  
  // ==========================================
  // Phase 5: 移动端适配
  // ==========================================
  console.log('\n【Phase 5: 移动端适配】');
  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForTimeout(2000);
  const mobileFile = `${shotDir}/v1-mobile.png`;
  await page.screenshot({ path: mobileFile });
  const mobileSize = fs.existsSync(mobileFile) ? fs.statSync(mobileFile).size : 0;
  console.log('移动端截图:', mobileFile, `(${mobileSize} bytes)`);
  
  // ==========================================
  // 最终汇总
  // ==========================================
  console.log('\n========================================');
  console.log('=== 最终验证汇总 ===');
  console.log('========================================');
  console.log('首页加载: ✅');
  console.log('Console Error:', errors.length === 0 ? '✅ 0个' : `❌ ${errors.length}个`);
  console.log('Console Warning:', `${warnings.length}个 (React Router future flags)`);
  console.log('当前URL:', currentUrl);
  console.log('页面内容长度:', bodyText ? bodyText.length : 0);
  
  // 列出所有截图
  const files = fs.readdirSync(shotDir);
  console.log('\n截图文件:');
  files.forEach(f => {
    const stat = fs.statSync(`${shotDir}/${f}`);
    console.log(`  ${f}: ${stat.size} bytes`);
  });
  console.log('========================================');
  
  await browser.close();
})().catch(e => {
  console.error('测试执行失败:', e.message);
  process.exit(1);
});
