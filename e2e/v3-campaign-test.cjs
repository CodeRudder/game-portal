const { chromium } = require('playwright');
const path = require('path');
const {
  initBrowser, enterGame, switchTab, takeScreenshot,
  checkDataIntegrity, checkLayout, switchToMobile, switchToPC,
  getConsoleErrors, clearConsoleErrors, closeAllModals
} = require('./utils/game-actions.cjs');

const GAME_URL = 'http://localhost:5173/idle/three-kingdoms';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

async function main() {
  const { browser, page } = await initBrowser();
  
  try {
    // 清除控制台错误
    await clearConsoleErrors(page);
    
    // 进入游戏
    await enterGame(page, GAME_URL);
    await page.waitForTimeout(2000);
    
    console.log('=== v3.0 关卡系统 UI 测试 ===\n');
    
    // Test 1: 切换到关卡Tab
    console.log('[Test 1] 切换到关卡Tab...');
    await switchTab(page, '关卡');
    await page.waitForTimeout(1500);
    await takeScreenshot(page, SCREENSHOT_DIR, 'v3-campaign-tab.png');
    console.log('  ✅ 关卡Tab截图完成');
    
    // Test 2: 检查关卡地图是否渲染
    console.log('[Test 2] 检查关卡地图渲染...');
    const stageElements = await page.$$('[class*="stage"], [class*="campaign"], [class*="chapter"], [class*="level"]');
    console.log(`  找到 ${stageElements.length} 个关卡相关元素`);
    
    // Test 3: 检查章节显示
    console.log('[Test 3] 检查章节信息...');
    const chapterText = await page.evaluate(() => {
      const body = document.body.innerText;
      const chapterMatch = body.match(/第[一二三四五六]章|章[节回]/g);
      return chapterMatch || [];
    });
    console.log(`  章节文本: ${JSON.stringify(chapterText)}`);
    
    // Test 4: 点击第一个可用关卡
    console.log('[Test 4] 尝试点击关卡...');
    const firstStage = await page.$('[class*="stage"]:not([class*="locked"]), [class*="level"]:not([class*="locked"]), [class*="node"][class*="active"], [class*="point"][class*="current"]');
    if (firstStage) {
      await firstStage.click();
      await page.waitForTimeout(1500);
      await takeScreenshot(page, SCREENSHOT_DIR, 'v3-stage-detail.png');
      console.log('  ✅ 关卡详情截图完成');
      
      // 检查是否出现布阵/战斗按钮
      const battleButtons = await page.$$('[class*="battle"], [class*="fight"], [class*="attack"]');
      const textButtons = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        return btns.filter(b => /出战|开战|布阵/.test(b.innerText)).length;
      });
      console.log(`  找到 ${battleButtons.length + textButtons} 个战斗相关按钮`);
    } else {
      console.log('  ⚠️ 未找到可点击的关卡节点');
    }
    
    // Test 5: 数据完整性检查
    console.log('[Test 5] 数据完整性检查...');
    const dataIntegrity = await checkDataIntegrity(page);
    console.log(`  ${dataIntegrity ? '✅' : '❌'} 数据完整性: ${dataIntegrity}`);
    
    // Test 6: 布局检查
    console.log('[Test 6] 布局检查...');
    const layoutOk = await checkLayout(page);
    console.log(`  ${layoutOk ? '✅' : '❌'} 布局检查: ${layoutOk}`);
    
    // Test 7: 移动端适配
    console.log('[Test 7] 移动端适配...');
    await switchToMobile(page);
    await page.waitForTimeout(1500);
    await takeScreenshot(page, SCREENSHOT_DIR, 'v3-campaign-mobile.png');
    console.log('  ✅ 移动端截图完成');
    
    // Test 8: 移动端数据完整性
    const mobileDataIntegrity = await checkDataIntegrity(page);
    console.log(`  ${mobileDataIntegrity ? '✅' : '❌'} 移动端数据完整性: ${mobileDataIntegrity}`);
    
    // 切回PC端
    await switchToPC(page);
    await page.waitForTimeout(1000);
    
    // Test 9: 关闭所有弹窗回到主界面
    console.log('[Test 9] 关闭弹窗回到主界面...');
    await closeAllModals(page);
    await page.waitForTimeout(1000);
    await takeScreenshot(page, SCREENSHOT_DIR, 'v3-campaign-clean.png');
    console.log('  ✅ 主界面截图完成');
    
    // Test 10: 控制台错误检查
    console.log('[Test 10] 控制台错误检查...');
    const consoleErrors = await getConsoleErrors(page);
    console.log(`  ${consoleErrors.length === 0 ? '✅' : '❌'} 控制台错误: ${consoleErrors.length}个`);
    if (consoleErrors.length > 0) {
      consoleErrors.forEach(e => console.log(`    - ${e}`));
    }
    
    console.log('\n=== 测试完成 ===');
    
  } catch (err) {
    console.error('测试出错:', err.message);
    try {
      await takeScreenshot(page, SCREENSHOT_DIR, 'v3-error.png');
    } catch(e) { /* ignore */ }
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
