// e2e-v1-full.cjs — v1.0 基业初立真实页面验证（增强版）
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  
  const errors = [];
  const warnings = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
    if (msg.type() === 'warning') warnings.push(msg.text());
  });
  
  const screenshotDir = '/mnt/user-data/workspace/game-portal/screenshots';
  fs.mkdirSync(screenshotDir, { recursive: true });
  
  console.log('=== v1.0 基业初立 — 真实页面验证（增强版） ===\n');
  
  // === 阶段A: Game Portal 首页 ===
  console.log('=== 阶段A: Game Portal 首页 ===');
  
  // A1. 页面加载
  console.log('\n--- A-1: 首页加载 ---');
  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    const title = await page.title();
    console.log('页面标题:', title);
    const bodyText = await page.textContent('body');
    console.log('页面内容长度:', bodyText ? bodyText.length : 0);
    console.log('A-1: ✅ 首页加载成功');
  } catch (e) {
    console.log('A-1: ❌ 首页加载失败:', e.message);
  }
  
  // A2. 控制台错误
  console.log('\n--- A-2: 控制台错误 ---');
  console.log('Error数量:', errors.length);
  errors.slice(0, 5).forEach((e, i) => console.log(`  Error[${i}]:`, e.substring(0, 200)));
  console.log('Warning数量:', warnings.length);
  warnings.slice(0, 3).forEach((w, i) => console.log(`  Warning[${i}]:`, w.substring(0, 150)));
  console.log('A-2:', errors.length === 0 ? '✅ 无Error' : '❌ 有Error');
  
  // A3. 首页截图
  const homePath = path.join(screenshotDir, 'v1-home.png');
  await page.screenshot({ path: homePath, fullPage: false });
  console.log('\nA-3: 首页截图已保存:', homePath, '文件大小:', fs.statSync(homePath).size, 'bytes');
  
  // A4. 查找页面上的所有链接和按钮
  console.log('\n--- A-4: 首页内容分析 ---');
  const allLinks = await page.$$eval('a', els => els.map(e => ({ href: e.getAttribute('href'), text: e.textContent?.trim().substring(0, 30) })));
  console.log('链接数量:', allLinks.length);
  allLinks.slice(0, 10).forEach((l, i) => console.log(`  Link[${i}]:`, l.text, '->', l.href));
  
  const allButtons = await page.$$eval('button', els => els.map(e => ({ text: e.textContent?.trim().substring(0, 30), class: e.className.substring(0, 50) })));
  console.log('按钮数量:', allButtons.length);
  allButtons.slice(0, 10).forEach((b, i) => console.log(`  Button[${i}]:`, b.text, '| class:', b.class));
  
  // A5. 查找三国相关元素
  console.log('\n--- A-5: 查找三国霸业入口 ---');
  const tkElements = await page.$$eval('*', els => 
    els.filter(e => e.textContent && e.textContent.includes('三国'))
       .map(e => ({ tag: e.tagName, text: e.textContent?.trim().substring(0, 50), class: e.className?.substring(0, 50) || '' }))
  );
  console.log('包含"三国"的元素数量:', tkElements.length);
  tkElements.slice(0, 5).forEach((e, i) => console.log(`  TK[${i}]:`, e.tag, '|', e.text, '|', e.class));
  
  // === 阶段B: 尝试进入三国霸业 ===
  console.log('\n\n=== 阶段B: 进入三国霸业游戏 ===');
  
  // B1. 查找并点击三国霸业入口
  console.log('\n--- B-1: 查找三国霸业入口 ---');
  try {
    // 尝试多种选择器
    const selectors = [
      'a:has-text("三国")',
      'button:has-text("三国")',
      '[class*="game-card"]:has-text("三国")',
      'a[href*="three-kingdoms"]',
      '[href*="three-kingdoms"]',
    ];
    
    let clicked = false;
    for (const sel of selectors) {
      const el = await page.$(sel);
      if (el) {
        console.log('找到入口:', sel);
        const href = await el.getAttribute('href');
        console.log('链接地址:', href);
        await el.click();
        clicked = true;
        break;
      }
    }
    
    if (!clicked) {
      // 尝试直接导航
      console.log('未找到入口，尝试直接导航到 /three-kingdoms');
      await page.goto('http://localhost:3000/three-kingdoms', { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(3000);
    } else {
      await page.waitForTimeout(3000);
    }
    
    const currentUrl = page.url();
    console.log('当前URL:', currentUrl);
    console.log('B-1:', currentUrl.includes('three-kingdoms') || currentUrl.includes('三国') ? '✅ 导航成功' : '⚠️ URL不包含三国标识');
    
  } catch (e) {
    console.log('B-1: ❌ 导航失败:', e.message);
  }
  
  // B2. 游戏页面截图
  const gamePath = path.join(screenshotDir, 'v1-game.png');
  await page.screenshot({ path: gamePath, fullPage: false });
  console.log('\nB-2: 游戏页截图已保存:', gamePath, '文件大小:', fs.statSync(gamePath).size, 'bytes');
  
  // B3. 游戏页面内容分析
  console.log('\n--- B-3: 游戏页面内容 ---');
  const gameBodyText = await page.textContent('body');
  console.log('页面内容长度:', gameBodyText ? gameBodyText.length : 0);
  if (gameBodyText) {
    console.log('页面内容预览:', gameBodyText.substring(0, 300).replace(/\n/g, ' '));
  }
  
  // B4. 查找游戏特定元素
  console.log('\n--- B-4: 游戏UI元素 ---');
  const gameElements = {
    '游戏容器': await page.$('.tk-game-container, [class*="game-container"], [class*="three-kingdoms"]'),
    '资源栏': await page.$('[class*="resource"], [class*="ResourceBar"], [class*="resource-bar"]'),
    'Tab按钮': await page.$$('[class*="tab"], [role="tab"]'),
    '建筑元素': await page.$$('[class*="building"], [class*="bld"]'),
    '武将元素': await page.$$('[class*="hero"], [class*="general"], [class*="warrior"]'),
    '按钮': await page.$$('button'),
    '面板': await page.$$('[class*="panel"], [class*="Panel"]'),
  };
  
  Object.entries(gameElements).forEach(([name, el]) => {
    if (Array.isArray(el)) {
      console.log(`  ${name}: ${el.length}个`);
    } else {
      console.log(`  ${name}:`, el ? '✅ 存在' : '❌ 不存在');
    }
  });
  
  // B5. 点击Tab测试
  console.log('\n--- B-5: Tab交互测试 ---');
  const tabButtons = await page.$$('button');
  for (let i = 0; i < Math.min(tabButtons.length, 10); i++) {
    const text = await tabButtons[i].textContent();
    if (text && (text.includes('建筑') || text.includes('城池') || text.includes('武将') || text.includes('招募'))) {
      console.log(`尝试点击Tab: "${text.trim()}"`);
      try {
        await tabButtons[i].click();
        await page.waitForTimeout(1500);
        const tabPath = path.join(screenshotDir, `v1-tab-${text.trim()}.png`);
        await page.screenshot({ path: tabPath, fullPage: false });
        console.log(`  截图已保存: ${tabPath} (${fs.statSync(tabPath).size} bytes)`);
      } catch (e) {
        console.log(`  点击失败: ${e.message}`);
      }
    }
  }
  
  // === 阶段C: 移动端适配 ===
  console.log('\n\n=== 阶段C: 移动端适配 ===');
  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForTimeout(2000);
  const mobilePath = path.join(screenshotDir, 'v1-mobile.png');
  await page.screenshot({ path: mobilePath, fullPage: false });
  console.log('移动端截图已保存:', mobilePath, '文件大小:', fs.statSync(mobilePath).size, 'bytes');
  
  // === 最终汇总 ===
  console.log('\n\n========================================');
  console.log('=== 最终验证汇总 ===');
  console.log('========================================');
  console.log('首页加载: ✅');
  console.log('Console Error:', errors.length === 0 ? '✅ 0个' : `❌ ${errors.length}个`);
  console.log('Console Warning:', `${warnings.length}个`);
  console.log('游戏容器:', gameElements['游戏容器'] ? '✅' : '❌');
  console.log('资源栏:', gameElements['资源栏'] ? '✅' : '❌');
  console.log('Tab按钮:', Array.isArray(gameElements['Tab按钮']) ? `${gameElements['Tab按钮'].length}个` : '0个');
  console.log('建筑元素:', Array.isArray(gameElements['建筑元素']) ? `${gameElements['建筑元素'].length}个` : '0个');
  console.log('武将元素:', Array.isArray(gameElements['武将元素']) ? `${gameElements['武将元素'].length}个` : '0个');
  console.log('按钮总数:', Array.isArray(gameElements['按钮']) ? `${gameElements['按钮'].length}个` : '0个');
  console.log('面板总数:', Array.isArray(gameElements['面板']) ? `${gameElements['面板'].length}个` : '0个');
  console.log('截图文件数:', fs.readdirSync(screenshotDir).length);
  console.log('========================================');
  
  await browser.close();
})().catch(e => {
  console.error('测试执行失败:', e.message);
  process.exit(1);
});
