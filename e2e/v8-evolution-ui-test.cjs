/**
 * v8.0 商贸繁荣 — 进化迭代 UI测试 R1
 *
 * 测试范围：
 * 1. 商店面板 — 商品分类、购买流程、库存显示、折扣标记
 * 2. 贸易路线 — 贸易地图、商路状态、商队管理
 * 3. 货币体系 — 货币显示栏、余额查询
 * 4. 移动端适配
 *
 * @module e2e/v8-evolution-ui-test
 */

const { chromium, devices } = require('playwright');
const path = require('path');
const fs = require('fs');

// ─────────────────────────────────────────────
// 配置
// ─────────────────────────────────────────────
const BASE_URL = process.env.GAME_BASE_URL || 'http://localhost:3000/idle/three-kingdoms';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots', 'v8-evolution');

// ─────────────────────────────────────────────
// 测试结果收集器
// ─────────────────────────────────────────────
const results = {
  passed: [],
  failed: [],
  warnings: [],
  screenshots: [],
  consoleErrors: [],
  startTime: new Date().toISOString(),
};

function pass(name) {
  results.passed.push(name);
  console.log(`  ✅ PASS: ${name}`);
}

function fail(name, detail) {
  results.failed.push({ name, detail: String(detail).substring(0, 300) });
  console.log(`  ❌ FAIL: ${name} — ${String(detail).substring(0, 150)}`);
}

function warn(name, detail) {
  results.warnings.push({ name, detail: String(detail).substring(0, 300) });
  console.log(`  ⚠️  WARN: ${name} — ${String(detail).substring(0, 150)}`);
}

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────
async function takeScreenshot(page, name) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const filepath = path.join(SCREENSHOT_DIR, name + '.png');
  await page.screenshot({ path: filepath, fullPage: false });
  console.log(`  📸 ${name}`);
}

async function enterGame(page) {
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  const startBtn = await page.$('button:has-text("开始游戏")');
  if (startBtn) {
    await startBtn.click();
    await page.waitForTimeout(3000);
  }
  await dismissGuide(page);
}

async function dismissGuide(page) {
  for (let i = 0; i < 5; i++) {
    const guideOverlay = await page.$('.tk-guide-overlay');
    if (!guideOverlay) break;
    const skipBtn = await page.$('.tk-guide-btn--skip');
    if (skipBtn) {
      await skipBtn.evaluate(el => el.click());
      await page.waitForTimeout(500);
      continue;
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }
}

async function switchTab(page, tabId) {
  await dismissGuide(page);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  let tab = await page.$(`[data-testid="tab-${tabId}"]`);
  if (!tab) {
    const labelMap = {
      building: '建筑', hero: '武将', tech: '科技', campaign: '关卡',
      equipment: '装备', map: '天下', npc: '名士', arena: '竞技',
      expedition: '远征', army: '军队', more: '更多',
    };
    const label = labelMap[tabId] || tabId;
    tab = await page.$(`button:has-text("${label}")`);
  }
  if (!tab) throw new Error(`Tab未找到: ${tabId}`);
  await tab.click();
  await page.waitForTimeout(2000);
}

async function closeAllModals(page) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const closeBtn = await page.$('.tk-shared-panel-close') ||
    await page.$('[data-testid="shared-panel-close"]');
  if (closeBtn) {
    await closeBtn.click();
    await page.waitForTimeout(500);
  }
}

async function checkDataIntegrity(page) {
  const text = await page.textContent('body');
  const issues = [];
  if (text.includes('NaN')) issues.push('页面显示NaN');
  if (text.includes('undefined')) issues.push('页面显示undefined');
  return { hasNaN: text.includes('NaN'), hasUndefined: text.includes('undefined'), issues };
}

// ─────────────────────────────────────────────
// 测试用例
// ─────────────────────────────────────────────

/** 测试1: 商店面板 */
async function testShopPanel(page) {
  console.log('\n📋 测试1: 商店面板');
  try {
    await dismissGuide(page);
    const shopBtn = await page.$('[data-testid="feature-shop"], button:has-text("集市"), button:has-text("商店")');
    if (shopBtn) {
      await shopBtn.click();
      await page.waitForTimeout(2000);
      await takeScreenshot(page, 'v8-shop-panel');
      pass('商店面板可打开');

      // 检查商品分类Tab
      const categoryTabs = await page.$$('.tk-shop-category, .shop-tab, [data-testid="shop-category"]');
      if (categoryTabs.length > 0) {
        pass(`商品分类Tab数量: ${categoryTabs.length}`);
      } else {
        warn('商品分类Tab未找到');
      }

      // 检查商品卡片
      const goodsCards = await page.$$('.tk-goods-card, .goods-item, [data-testid="goods-card"]');
      if (goodsCards.length > 0) {
        pass(`商品卡片数量: ${goodsCards.length}`);
      } else {
        warn('商品卡片为空');
      }

      // 检查折扣标记
      const discountBadge = await page.$('.tk-discount-badge, .discount-tag');
      if (discountBadge) pass('折扣标记存在');
      else warn('折扣标记未找到（可能无折扣商品）');
    } else {
      warn('商店按钮未找到');
    }
    await closeAllModals(page);
  } catch (e) {
    fail('商店面板', e.message);
  }
}

/** 测试2: 商品购买流程 */
async function testShopBuyFlow(page) {
  console.log('\n📋 测试2: 商品购买流程');
  try {
    await dismissGuide(page);
    const shopBtn = await page.$('[data-testid="feature-shop"], button:has-text("集市"), button:has-text("商店")');
    if (shopBtn) {
      await shopBtn.click();
      await page.waitForTimeout(2000);

      // 点击第一个商品
      const goodsCards = await page.$$('.tk-goods-card, .goods-item, [data-testid="goods-card"]');
      if (goodsCards.length > 0) {
        await goodsCards[0].click();
        await page.waitForTimeout(1000);
        await takeScreenshot(page, 'v8-shop-buy-modal');

        // 检查购买确认弹窗
        const buyBtn = await page.$('button:has-text("购买"), button:has-text("确认"), .tk-buy-confirm');
        if (buyBtn) pass('购买确认按钮存在');
        else warn('购买确认按钮未找到');

        // 检查价格显示
        const priceDisplay = await page.$('.tk-price, .goods-price, [data-testid="goods-price"]');
        if (priceDisplay) pass('价格显示存在');
        else warn('价格显示未找到');
      } else {
        warn('无商品可测试购买');
      }
    }
    await closeAllModals(page);
  } catch (e) {
    fail('商品购买流程', e.message);
  }
}

/** 测试3: 货币显示栏 */
async function testCurrencyBar(page) {
  console.log('\n📋 测试3: 货币显示栏');
  try {
    // 货币栏通常在底部或顶部
    const currencyBar = await page.$('.tk-currency-bar, .currency-display, [data-testid="currency-bar"]');
    if (currencyBar) {
      pass('货币显示栏存在');
      await takeScreenshot(page, 'v8-currency-bar');
    } else {
      // 尝试在商店面板中查找
      const shopBtn = await page.$('[data-testid="feature-shop"], button:has-text("集市"), button:has-text("商店")');
      if (shopBtn) {
        await shopBtn.click();
        await page.waitForTimeout(2000);
        const currencyInShop = await page.$('.tk-currency-bar, .currency-display, [data-testid="currency-bar"]');
        if (currencyInShop) {
          pass('货币栏在商店面板中显示');
          await takeScreenshot(page, 'v8-currency-in-shop');
        } else {
          warn('货币栏未找到');
        }
      }
    }

    // 检查铜钱显示
    const copperCoin = await page.$('text=铜钱, [data-testid="currency-copper"]');
    if (copperCoin) pass('铜钱显示存在');
    else warn('铜钱显示未找到');

    await closeAllModals(page);
  } catch (e) {
    fail('货币显示栏', e.message);
  }
}

/** 测试4: 贸易路线面板 */
async function testTradePanel(page) {
  console.log('\n📋 测试4: 贸易路线面板');
  try {
    await dismissGuide(page);
    const tradeBtn = await page.$('[data-testid="feature-trade"], button:has-text("贸易"), button:has-text("商路")');
    if (tradeBtn) {
      await tradeBtn.click();
      await page.waitForTimeout(2000);
      await takeScreenshot(page, 'v8-trade-panel');
      pass('贸易面板可打开');

      // 检查贸易地图
      const tradeMap = await page.$('.tk-trade-map, .trade-route-map, [data-testid="trade-map"]');
      if (tradeMap) pass('贸易地图存在');
      else warn('贸易地图未找到');

      // 检查商路节点
      const routeNodes = await page.$$('.tk-route-node, .trade-city, [data-testid="trade-city"]');
      if (routeNodes.length > 0) pass(`商路节点数量: ${routeNodes.length}`);
      else warn('商路节点未找到');

      // 检查商队管理
      const caravanSection = await page.$('.tk-caravan, .caravan-list, [data-testid="caravan-list"]');
      if (caravanSection) pass('商队管理区域存在');
      else warn('商队管理区域未找到');
    } else {
      warn('贸易按钮未找到');
    }
    await closeAllModals(page);
  } catch (e) {
    fail('贸易路线面板', e.message);
  }
}

/** 测试5: 商队派遣 */
async function testCaravanDispatch(page) {
  console.log('\n📋 测试5: 商队派遣');
  try {
    await dismissGuide(page);
    const tradeBtn = await page.$('[data-testid="feature-trade"], button:has-text("贸易"), button:has-text("商路")');
    if (tradeBtn) {
      await tradeBtn.click();
      await page.waitForTimeout(2000);

      // 查找派遣按钮
      const dispatchBtn = await page.$('button:has-text("派遣"), button:has-text("出发"), .tk-caravan-dispatch');
      if (dispatchBtn) {
        await dispatchBtn.click();
        await page.waitForTimeout(1000);
        await takeScreenshot(page, 'v8-caravan-dispatch');
        pass('商队派遣弹窗可打开');
      } else {
        warn('商队派遣按钮未找到');
      }
    }
    await closeAllModals(page);
  } catch (e) {
    fail('商队派遣', e.message);
  }
}

/** 测试6: 数据完整性检查 */
async function testDataIntegrity(page) {
  console.log('\n📋 测试6: 数据完整性检查');
  try {
    const check = await checkDataIntegrity(page);
    if (check.issues.length === 0) {
      pass('页面无NaN/undefined显示');
    } else {
      for (const issue of check.issues) {
        fail('数据完整性', issue);
      }
    }
  } catch (e) {
    fail('数据完整性检查', e.message);
  }
}

/** 测试7: 移动端适配 */
async function testMobile(page, context) {
  console.log('\n📋 测试7: 移动端适配');
  try {
    const mobilePage = await context.newPage();
    await mobilePage.setViewportSize({ width: 375, height: 667 });
    await enterGame(mobilePage);
    await takeScreenshot(mobilePage, 'v8-mobile-main');

    // 商店面板移动端
    await dismissGuide(mobilePage);
    const shopBtn = await mobilePage.$('[data-testid="feature-shop"], button:has-text("集市"), button:has-text("商店")');
    if (shopBtn) {
      await shopBtn.click();
      await mobilePage.waitForTimeout(2000);
      await takeScreenshot(mobilePage, 'v8-mobile-shop');
    }

    // 贸易面板移动端
    await closeAllModals(mobilePage);
    await dismissGuide(mobilePage);
    const tradeBtn = await mobilePage.$('[data-testid="feature-trade"], button:has-text("贸易"), button:has-text("商路")');
    if (tradeBtn) {
      await tradeBtn.click();
      await mobilePage.waitForTimeout(2000);
      await takeScreenshot(mobilePage, 'v8-mobile-trade');
    }

    pass('移动端适配测试完成');
    await mobilePage.close();
  } catch (e) {
    fail('移动端适配', e.message);
  }
}

// ─────────────────────────────────────────────
// 主流程
// ─────────────────────────────────────────────
(async () => {
  console.log('🚀 v8.0 商贸繁荣 UI测试开始\n');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') {
      results.consoleErrors.push(msg.text().substring(0, 200));
    }
  });

  try {
    await enterGame(page);
    await takeScreenshot(page, 'v8-main-page');

    await testShopPanel(page);
    await testShopBuyFlow(page);
    await testCurrencyBar(page);
    await testTradePanel(page);
    await testCaravanDispatch(page);
    await testDataIntegrity(page);
    await testMobile(page, context);
  } catch (e) {
    fail('主流程', e.message);
  }

  results.endTime = new Date().toISOString();
  console.log('\n' + '='.repeat(50));
  console.log(`📊 v8.0 UI测试结果: ✅${results.passed.length} ❌${results.failed.length} ⚠️${results.warnings.length}`);
  if (results.failed.length > 0) {
    console.log('\n失败项:');
    results.failed.forEach(f => console.log(`  ❌ ${f.name}: ${f.detail}`));
  }

  const resultPath = path.join(__dirname, 'v8-evolution-ui-results.json');
  fs.writeFileSync(resultPath, JSON.stringify(results, null, 2));

  await browser.close();
  process.exit(results.failed.length > 0 ? 1 : 0);
})();
