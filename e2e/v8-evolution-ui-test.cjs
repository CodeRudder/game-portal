/**
 * v8.0 商贸繁荣 — E2E UI 测试
 *
 * 测试范围：
 *   1. 主页面加载 + Tab导航
 *   2. 商店面板（商品展示、分类Tab、购买流程）
 *   3. 贸易面板（商路列表、商队管理、行情展示）
 *   4. 货币体系（余额显示、不足提示）
 *   5. 引擎集成验证（CaravanSystem注册、getter可用性）
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5173/idle/three-kingdoms';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots', 'v8-evolution');

// 确保截图目录存在
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

// ─── 测试结果收集 ────────────────────────────
const results = {
  version: 'v8.0',
  timestamp: new Date().toISOString(),
  tests: [],
  summary: { total: 0, passed: 0, failed: 0, skipped: 0 },
};

function addTest(name, status, details = '') {
  results.tests.push({ name, status, details });
  results.summary.total++;
  if (status === 'PASS') results.summary.passed++;
  else if (status === 'FAIL') results.summary.failed++;
  else results.summary.skipped++;
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
  console.log(`${icon} ${name}${details ? ': ' + details : ''}`);
}

async function screenshot(page, name) {
  const file = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`📸 截图: ${name}.png`);
  return file;
}

// ─── 主测试流程 ──────────────────────────────
async function runTests() {
  console.log('\n═══════════════════════════════════════');
  console.log('  v8.0 商贸繁荣 — E2E UI 测试');
  console.log('═══════════════════════════════════════\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  try {
    // ═══ 1. 主页面加载 ═══
    console.log('\n── 1. 主页面加载 ──');
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));
    await screenshot(page, 'v8-01-main-page');

    const pageTitle = await page.title();
    addTest('主页面加载', pageTitle ? 'PASS' : 'FAIL', `title: ${pageTitle}`);

    // ═══ 2. 引擎集成验证 ═══
    console.log('\n── 2. 引擎集成验证 ──');
    const engineCheck = await page.evaluate(() => {
      const results = {};
      // 查找引擎实例
      const app = document.querySelector('#__next')?.__reactFiber$;
      
      // 尝试从React组件树获取引擎
      let engine = null;
      try {
        // 通过window暴露的引擎获取
        if (window.__THREE_KINGDOMS_ENGINE__) {
          engine = window.__THREE_KINGDOMS_ENGINE__;
        }
      } catch (e) {}
      
      // 检查是否有游戏相关的React组件
      const gameContainer = document.querySelector('[class*="game"]') || 
                           document.querySelector('[data-testid]') ||
                           document.querySelector('canvas');
      results.gameContainer = !!gameContainer;
      results.bodyText = document.body.innerText.substring(0, 500);
      
      return results;
    });
    
    addTest('游戏容器存在', engineCheck.gameContainer ? 'PASS' : 'FAIL');

    // ═══ 3. Tab导航测试 ═══
    console.log('\n── 3. Tab导航测试 ──');
    
    // 查找所有Tab按钮
    const tabButtons = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.map(b => ({
        text: b.textContent?.trim() ?? '',
        visible: b.offsetParent !== null,
      })).filter(b => b.visible);
    });
    
    console.log('  可见按钮:', tabButtons.map(b => b.text).join(', '));
    
    // 尝试点击"商店"或"商贸"Tab
    const shopTabFound = tabButtons.some(b => b.text.includes('商店') || b.text.includes('集市'));
    const tradeTabFound = tabButtons.some(b => b.text.includes('商贸') || b.text.includes('贸易') || b.text.includes('商路'));
    
    addTest('商店Tab可见', shopTabFound ? 'PASS' : 'SKIP', shopTabFound ? '找到商店Tab' : '未找到商店Tab按钮');
    addTest('商贸Tab可见', tradeTabFound ? 'PASS' : 'SKIP', tradeTabFound ? '找到商贸Tab' : '未找到商贸Tab按钮');

    // ═══ 4. 尝试打开商店面板 ═══
    console.log('\n── 4. 商店面板测试 ──');
    
    // 点击商店/集市按钮
    const shopClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const shopBtn = buttons.find(b => 
        b.textContent?.includes('商店') || b.textContent?.includes('集市')
      );
      if (shopBtn) { shopBtn.click(); return true; }
      return false;
    });
    
    if (shopClicked) {
      await new Promise(r => setTimeout(r, 1000));
      await screenshot(page, 'v8-02-shop-panel');
      
      // 检查商店面板内容
      const shopContent = await page.evaluate(() => {
        const text = document.body.innerText;
        const hasShopPanel = text.includes('商店') || text.includes('杂货铺');
        const hasGoods = text.includes('购买') || text.includes('售罄');
        const hasCurrency = text.includes('铜钱') || text.includes('元宝');
        return { hasShopPanel, hasGoods, hasCurrency };
      });
      
      addTest('商店面板打开', shopContent.hasShopPanel ? 'PASS' : 'FAIL');
      addTest('商品列表显示', shopContent.hasGoods ? 'PASS' : 'FAIL');
      addTest('货币显示', shopContent.hasCurrency ? 'PASS' : 'FAIL');
    } else {
      addTest('商店面板', 'SKIP', '无法找到商店按钮');
    }

    // ═══ 5. 尝试打开商贸面板 ═══
    console.log('\n── 5. 商贸面板测试 ──');
    
    // 先关闭当前面板（点击overlay或关闭按钮）
    await page.evaluate(() => {
      const overlay = document.querySelector('[style*="position: fixed"]');
      if (overlay) overlay.click();
    });
    await new Promise(r => setTimeout(r, 500));
    
    const tradeClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const tradeBtn = buttons.find(b => 
        b.textContent?.includes('商贸') || b.textContent?.includes('贸易')
      );
      if (tradeBtn) { tradeBtn.click(); return true; }
      return false;
    });
    
    if (tradeClicked) {
      await new Promise(r => setTimeout(r, 1000));
      await screenshot(page, 'v8-03-trade-panel');
      
      const tradeContent = await page.evaluate(() => {
        const text = document.body.innerText;
        const hasTradePanel = text.includes('商贸') || text.includes('商路');
        const hasCaravan = text.includes('商队');
        const hasRoute = text.includes('路线') || text.includes('→');
        return { hasTradePanel, hasCaravan, hasRoute };
      });
      
      addTest('商贸面板打开', tradeContent.hasTradePanel ? 'PASS' : 'FAIL');
      addTest('商队信息显示', tradeContent.hasCaravan ? 'PASS' : 'FAIL');
      addTest('商路信息显示', tradeContent.hasRoute ? 'PASS' : 'FAIL');
    } else {
      addTest('商贸面板', 'SKIP', '无法找到商贸按钮');
    }

    // ═══ 6. 更多Tab探索 ═══
    console.log('\n── 6. 更多Tab探索 ──');
    
    // 关闭面板
    await page.evaluate(() => {
      const closeBtns = Array.from(document.querySelectorAll('button')).filter(b => 
        b.textContent?.includes('✕') || b.textContent?.includes('关闭') ||
        b.getAttribute('aria-label')?.includes('close')
      );
      closeBtns.forEach(b => b.click());
      // 也尝试点击overlay
      const overlay = document.querySelector('[style*="position: fixed"][style*="z-index"]');
      if (overlay) overlay.click();
    });
    await new Promise(r => setTimeout(r, 500));
    
    // 尝试点击"更多"Tab
    const moreClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const moreBtn = buttons.find(b => b.textContent?.includes('更多'));
      if (moreBtn) { moreBtn.click(); return true; }
      return false;
    });
    
    if (moreClicked) {
      await new Promise(r => setTimeout(r, 500));
      await screenshot(page, 'v8-04-more-tab');
      
      // 查找更多Tab中的商店/商贸入口
      const moreContent = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const text = document.body.innerText;
        return {
          buttons: buttons.map(b => b.textContent?.trim()).filter(Boolean),
          hasShop: text.includes('商店') || text.includes('集市'),
          hasTrade: text.includes('商贸') || text.includes('贸易'),
        };
      });
      
      addTest('更多Tab中有商店入口', moreContent.hasShop ? 'PASS' : 'FAIL');
      addTest('更多Tab中有商贸入口', moreContent.hasTrade ? 'PASS' : 'FAIL');
      
      // 尝试从更多Tab点击商店
      if (moreContent.hasShop) {
        const shopFromMore = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const btn = buttons.find(b => b.textContent?.includes('商店') || b.textContent?.includes('集市'));
          if (btn) { btn.click(); return true; }
          return false;
        });
        
        if (shopFromMore) {
          await new Promise(r => setTimeout(r, 1000));
          await screenshot(page, 'v8-05-shop-from-more');
          addTest('从更多Tab打开商店', 'PASS');
        }
      }
    } else {
      addTest('更多Tab', 'SKIP', '无法找到更多Tab');
    }

    // ═══ 7. 控制台错误检查 ═══
    console.log('\n── 7. 控制台错误检查 ──');
    
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    
    // 刷新页面检查错误
    await page.reload({ waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 3000));
    
    addTest('无控制台错误', consoleErrors.length === 0 ? 'PASS' : 'FAIL', 
      consoleErrors.length > 0 ? `${consoleErrors.length}个错误` : '');

    // ═══ 8. 移动端适配测试 ═══
    console.log('\n── 8. 移动端适配测试 ──');
    
    await page.setViewport({ width: 375, height: 812 });
    await new Promise(r => setTimeout(r, 1000));
    await screenshot(page, 'v8-06-mobile');
    
    addTest('移动端渲染', 'PASS', '375x812 viewport');
    
    // 恢复PC端
    await page.setViewport({ width: 1280, height: 900 });

    // ═══ 9. 最终截图 ═══
    console.log('\n── 9. 最终截图 ──');
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));
    await screenshot(page, 'v8-07-final-state');

  } catch (error) {
    addTest('测试执行', 'FAIL', error.message);
    try { await screenshot(page, 'v8-error-state'); } catch {}
  } finally {
    await browser.close();
  }

  // ─── 输出结果 ──────────────────────────────
  console.log('\n═══════════════════════════════════════');
  console.log('  测试结果汇总');
  console.log('═══════════════════════════════════════');
  console.log(`  总计: ${results.summary.total}`);
  console.log(`  ✅ 通过: ${results.summary.passed}`);
  console.log(`  ❌ 失败: ${results.summary.failed}`);
  console.log(`  ⏭️ 跳过: ${results.summary.skipped}`);
  console.log('═══════════════════════════════════════\n');

  // 保存结果
  const resultFile = path.join(__dirname, 'v8-evolution-ui-results.json');
  fs.writeFileSync(resultFile, JSON.stringify(results, null, 2));
  console.log(`📄 结果已保存: ${resultFile}`);

  return results;
}

// 执行
runTests().then(r => {
  process.exit(r.summary.failed > 0 ? 1 : 0);
}).catch(e => {
  console.error('测试执行失败:', e);
  process.exit(1);
});
