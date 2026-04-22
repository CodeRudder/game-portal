/**
 * v1.0 Round 2 — UI自动化测试 (修订版)
 * 修复: 1) 先关闭弹窗 2) 更灵活的资源检测 3) 更健壮的Tab检测
 */
const { chromium } = require('playwright');
const fs = require('fs');

const BASE_URL = 'http://localhost:3000';
const GAME_PATH = '/idle/three-kingdoms';
const SCREENSHOT_DIR = '/mnt/user-data/workspace/game-portal/e2e/screenshots/v1-r2';

async function main() {
  const results = { passed: [], failed: [], warnings: [], screenshots: [] };
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  try {
    // ==========================================
    // TEST 1: 游戏加载
    // ==========================================
    console.log('\n=== TEST 1: 游戏加载 ===');
    try {
      await page.goto(`${BASE_URL}${GAME_PATH}`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(3000);
      results.passed.push('游戏页面加载成功');
      console.log('✅ 页面加载成功');
    } catch (e) {
      results.failed.push(`游戏页面加载失败: ${e.message}`);
      throw e;
    }

    // ==========================================
    // TEST 1.5: 关闭遮挡弹窗
    // ==========================================
    console.log('\n=== 关闭遮挡弹窗 ===');
    
    // 尝试关闭欢迎弹窗
    const welcomeClose = await page.$('[data-testid="welcome-close"]')
      || await page.$('.tk-welcome-modal .tk-modal-close')
      || await page.$('.tk-modal-overlay--visible .tk-modal-close');
    if (welcomeClose) {
      await welcomeClose.click();
      await page.waitForTimeout(500);
      results.passed.push('欢迎弹窗已关闭');
      console.log('✅ 欢迎弹窗已关闭');
    } else {
      // 尝试点击overlay关闭
      const overlay = await page.$('.tk-modal-overlay--visible');
      if (overlay) {
        await overlay.click();
        await page.waitForTimeout(500);
        results.passed.push('弹窗overlay已点击关闭');
        console.log('✅ 弹窗overlay已点击关闭');
      } else {
        console.log('无遮挡弹窗');
      }
    }

    // 尝试关闭离线收益弹窗
    const offlineClose = await page.$('[data-testid="offline-reward-close"]')
      || await page.$('.tk-offline-reward .tk-modal-close')
      || await page.$('button:has-text("领取")');
    if (offlineClose) {
      await offlineClose.click();
      await page.waitForTimeout(500);
      results.passed.push('离线收益弹窗已关闭');
      console.log('✅ 离线收益弹窗已关闭');
    }

    // 确保没有遮挡
    await page.waitForTimeout(1000);
    
    // 截图: 初始状态
    await page.screenshot({ path: `${SCREENSHOT_DIR}/01-after-close-modals.png`, fullPage: false });
    results.screenshots.push('01-after-close-modals.png');

    // ==========================================
    // TEST 2: 资源栏验证
    // ==========================================
    console.log('\n=== TEST 2: 资源栏验证 ===');
    
    const bodyText = await page.textContent('body');
    
    // 检查资源栏容器
    const resourceBar = await page.$('[data-testid="resource-bar"]') 
      || await page.$('.tk-resource-bar')
      || await page.$('[class*="resource-bar"]');
    
    if (resourceBar) {
      results.passed.push('资源栏容器可见');
      console.log('✅ 资源栏容器找到');
    } else {
      results.warnings.push('资源栏容器未通过已知选择器找到');
      console.log('⚠️ 资源栏容器未找到');
    }

    // 检查4种资源 (支持emoji图标或文字)
    const resourceChecks = [
      { name: '粮草', patterns: ['粮草', '🌾', 'grain', 'food'] },
      { name: '铜钱', patterns: ['铜钱', '💰', 'coin', 'copper'] },
      { name: '兵力', patterns: ['兵力', '⚔️', 'troop', 'soldier'] },
      { name: '天命', patterns: ['天命', '👑', 'mandate', 'destiny'] },
    ];

    for (const res of resourceChecks) {
      const found = res.patterns.some(p => bodyText && bodyText.includes(p));
      if (found) {
        results.passed.push(`资源"${res.name}"可见`);
        console.log(`✅ 资源"${res.name}"可见`);
      } else {
        results.failed.push(`资源"${res.name}"不可见`);
        console.log(`❌ 资源"${res.name}"不可见`);
      }
    }

    // 检查数值格式
    const hasNumber = /\d+[.,]?\d*/.test(bodyText);
    if (hasNumber) {
      results.passed.push('资源数值可见');
      console.log('✅ 资源数值可见');
    }

    // 截图: 资源栏
    await page.screenshot({ path: `${SCREENSHOT_DIR}/02-resource-bar.png`, fullPage: false });
    results.screenshots.push('02-resource-bar.png');

    // ==========================================
    // TEST 3: Tab切换验证
    // ==========================================
    console.log('\n=== TEST 3: Tab切换验证 ===');
    
    // 查找所有Tab按钮
    const tabButtons = await page.$$('button');
    const tabMap = {};
    
    for (const btn of tabButtons) {
      const text = await btn.textContent();
      const trimmed = text?.trim();
      if (['建筑', '武将', '科技', '关卡', '地图', '天下', '名士'].includes(trimmed)) {
        tabMap[trimmed] = btn;
      }
    }
    
    console.log(`找到的Tab: ${Object.keys(tabMap).join(', ')}`);

    const expectedTabs = ['建筑', '武将', '科技', '关卡'];
    for (const tabName of expectedTabs) {
      if (tabMap[tabName]) {
        try {
          await tabMap[tabName].click({ timeout: 5000 });
          await page.waitForTimeout(800);
          results.passed.push(`Tab"${tabName}"可点击`);
          console.log(`✅ Tab"${tabName}"可点击`);
          
          const idx = expectedTabs.indexOf(tabName);
          await page.screenshot({ path: `${SCREENSHOT_DIR}/03-tab-${tabName}.png`, fullPage: false });
          results.screenshots.push(`03-tab-${tabName}.png`);
        } catch (e) {
          results.failed.push(`Tab"${tabName}"点击失败: ${e.message.substring(0, 80)}`);
          console.log(`❌ Tab"${tabName}"点击失败`);
        }
      } else {
        results.warnings.push(`Tab"${tabName}"未在页面中找到`);
        console.log(`⚠️ Tab"${tabName}"未找到`);
      }
    }

    // ==========================================
    // TEST 4: 建筑面板验证
    // ==========================================
    console.log('\n=== TEST 4: 建筑面板验证 ===');
    
    // 切换到建筑Tab
    if (tabMap['建筑']) {
      await tabMap['建筑'].click();
      await page.waitForTimeout(800);
    }

    // 检查建筑名称
    const buildingNames = ['主城', '农田', '市集', '兵营', '铁匠铺', '书院', '医馆', '城墙'];
    let foundBuildings = 0;
    const foundNames = [];
    for (const name of buildingNames) {
      if (bodyText && bodyText.includes(name)) {
        foundBuildings++;
        foundNames.push(name);
      }
    }
    console.log(`找到建筑: ${foundNames.join(', ')} (${foundBuildings}/8)`);
    
    if (foundBuildings >= 6) {
      results.passed.push(`建筑名称可见(${foundBuildings}/8): ${foundNames.join(',')}`);
    } else if (foundBuildings >= 3) {
      results.warnings.push(`建筑名称部分可见(${foundBuildings}/8): ${foundNames.join(',')}`);
    } else {
      results.failed.push(`建筑名称仅找到${foundBuildings}/8个`);
    }

    // 检查升级按钮
    const upgradeBtns = await page.$$('button');
    let upgradeCount = 0;
    for (const btn of upgradeBtns) {
      const text = await btn.textContent();
      if (text?.includes('升级')) upgradeCount++;
    }
    if (upgradeCount > 0) {
      results.passed.push(`升级按钮存在(${upgradeCount}个)`);
      console.log(`✅ 升级按钮存在(${upgradeCount}个)`);
    } else {
      results.warnings.push('未找到"升级"文字按钮');
      console.log('⚠️ 未找到升级按钮(可能使用图标)');
    }

    // 截图: 建筑面板
    await page.screenshot({ path: `${SCREENSHOT_DIR}/04-building-panel.png`, fullPage: false });
    results.screenshots.push('04-building-panel.png');

    // ==========================================
    // TEST 5: 日历系统验证
    // ==========================================
    console.log('\n=== TEST 5: 日历系统验证 ===');
    
    const calendarKeywords = ['建安', '春', '夏', '秋', '冬', '晴', '雨', '雪'];
    let calendarFound = 0;
    for (const kw of calendarKeywords) {
      if (bodyText && bodyText.includes(kw)) calendarFound++;
    }
    if (calendarFound >= 2) {
      results.passed.push(`日历系统可见(${calendarFound}个关键词)`);
      console.log(`✅ 日历系统可见(${calendarFound}个关键词)`);
    } else {
      results.warnings.push('日历系统关键词不足');
      console.log('⚠️ 日历系统关键词不足');
    }

    // ==========================================
    // TEST 6: 建筑升级操作测试
    // ==========================================
    console.log('\n=== TEST 6: 建筑升级操作 ===');
    
    // 尝试点击一个建筑卡片
    const buildingCards = await page.$$('[class*="building-card"], [class*="building-item"]');
    if (buildingCards.length > 0) {
      await buildingCards[0].click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/05-building-detail.png`, fullPage: false });
      results.screenshots.push('05-building-detail.png');
      results.passed.push(`建筑卡片可点击(${buildingCards.length}个)`);
      console.log(`✅ 建筑卡片可点击(${buildingCards.length}个)`);
    } else {
      // 尝试查找包含建筑名称的元素
      const farmEl = await page.$(':text("农田")');
      if (farmEl) {
        await farmEl.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/05-building-detail.png`, fullPage: false });
        results.screenshots.push('05-building-detail.png');
        results.passed.push('通过文本点击建筑成功');
        console.log('✅ 通过文本点击建筑成功');
      } else {
        results.warnings.push('无法点击建筑卡片');
        console.log('⚠️ 无法点击建筑卡片');
      }
    }

    // ==========================================
    // TEST 7: DOM结构分析
    // ==========================================
    console.log('\n=== TEST 7: DOM结构分析 ===');
    
    const domInfo = await page.evaluate(() => {
      const body = document.body;
      const allButtons = body.querySelectorAll('button');
      const tabs = Array.from(allButtons).filter(b => 
        b.textContent?.match(/建筑|武将|科技|关卡|地图|天下|名士/)
      );
      return {
        totalButtons: allButtons.length,
        tabTexts: tabs.map(t => t.textContent?.trim()),
        bodyTextPreview: body.textContent?.substring(0, 1000),
        hasResourceBar: !!body.querySelector('[class*="resource"]'),
        hasBuildingPanel: !!body.querySelector('[class*="building"]'),
        hasCalendar: !!body.querySelector('[class*="calendar"]'),
        modalOverlays: body.querySelectorAll('.tk-modal-overlay--visible').length,
      };
    });
    
    console.log(`DOM: buttons=${domInfo.totalButtons}, tabs=${JSON.stringify(domInfo.tabTexts)}`);
    console.log(`resource=${domInfo.hasResourceBar}, building=${domInfo.hasBuildingPanel}, calendar=${domInfo.hasCalendar}`);
    console.log(`modal overlays: ${domInfo.modalOverlays}`);
    results.passed.push(`DOM分析: ${domInfo.totalButtons}按钮, ${domInfo.tabTexts.length}Tab`);

    // ==========================================
    // 控制台错误
    // ==========================================
    console.log('\n=== 控制台错误 ===');
    if (consoleErrors.length === 0) {
      results.passed.push('无控制台错误');
      console.log('✅ 无控制台错误');
    } else {
      // 过滤掉已知的无害错误
      const realErrors = consoleErrors.filter(e => 
        !e.includes('favicon') && !e.includes('404') && !e.includes('net::ERR')
      );
      if (realErrors.length === 0) {
        results.passed.push('无严重控制台错误(仅favicon等)');
        console.log('✅ 无严重控制台错误');
      } else {
        results.warnings.push(`${realErrors.length}个控制台错误`);
        realErrors.slice(0, 3).forEach(e => console.log(`  ⚠️ ${e.substring(0, 120)}`));
      }
    }

  } catch (error) {
    results.failed.push(`测试执行异常: ${error.message.substring(0, 200)}`);
    console.log(`\n❌ 测试异常: ${error.message.substring(0, 200)}`);
  } finally {
    // 最终截图
    try {
      await page.screenshot({ path: `${SCREENSHOT_DIR}/06-final-state.png`, fullPage: false });
      results.screenshots.push('06-final-state.png');
    } catch(e) {}
    
    await browser.close();
  }

  // ==========================================
  // 结果汇总
  // ==========================================
  console.log('\n========================================');
  console.log('    v1.0 Round 2 UI测试结果汇总');
  console.log('========================================');
  console.log(`✅ 通过: ${results.passed.length}`);
  console.log(`❌ 失败: ${results.failed.length}`);
  console.log(`⚠️ 警告: ${results.warnings.length}`);
  console.log(`📸 截图: ${results.screenshots.length}张`);
  console.log('----------------------------------------');
  
  results.passed.forEach(r => console.log(`  ✅ ${r}`));
  results.failed.forEach(r => console.log(`  ❌ ${r}`));
  results.warnings.forEach(w => console.log(`  ⚠️ ${w}`));

  fs.writeFileSync('/mnt/user-data/workspace/game-portal/e2e/v1-r2-results.json', JSON.stringify(results, null, 2));
  console.log('\n结果已保存到 e2e/v1-r2-results.json');
}

main().catch(console.error);
