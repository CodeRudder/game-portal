const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const GAME_URL = 'http://localhost:5173/idle/three-kingdoms';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

// 简化的工具函数（避免依赖外部模块可能的问题）
async function takeScreenshot(page, name) {
  const filepath = path.join(SCREENSHOT_DIR, name);
  await page.screenshot({ path: filepath, fullPage: false });
  console.log(`  📸 ${name}`);
  return filepath;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const errors = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  
  try {
    console.log('=== v3.0 关卡系统 UI 测试 ===\n');
    
    // 进入游戏
    console.log('[1] 加载游戏页面...');
    await page.goto(GAME_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    await takeScreenshot(page, 'v3-game-loaded.png');
    console.log('  ✅ 页面加载完成');
    
    // 切换到关卡Tab
    console.log('[2] 切换到关卡Tab...');
    const tabClicked = await page.evaluate(() => {
      const tabs = document.querySelectorAll('[class*="tab"], [role="tab"], button');
      for (const tab of tabs) {
        if (tab.textContent?.includes('关卡') || tab.textContent?.includes('战役') || tab.textContent?.includes('Campaign')) {
          tab.click();
          return tab.textContent.trim();
        }
      }
      return null;
    });
    await page.waitForTimeout(2000);
    await takeScreenshot(page, 'v3-campaign-tab.png');
    console.log(`  ${tabClicked ? '✅ 点击了Tab: ' + tabClicked : '⚠️ 未找到关卡Tab'}`);
    
    // 检查关卡相关DOM
    console.log('[3] 检查关卡DOM...');
    const domInfo = await page.evaluate(() => {
      const all = document.body.innerHTML;
      const stageCount = (all.match(/stage/gi) || []).length;
      const chapterCount = (all.match(/chapter/gi) || []).length;
      const battleCount = (all.match(/battle/gi) || []).length;
      const campaignCount = (all.match(/campaign/gi) || []).length;
      
      // 检查是否有地图/关卡容器
      const containers = document.querySelectorAll('[class*="campaign"], [class*="stage"], [class*="chapter"], [class*="map"], [class*="battle"]');
      const containerClasses = Array.from(containers).slice(0, 10).map(e => e.className);
      
      // 检查文本内容
      const bodyText = document.body.innerText;
      const hasChapter = /第[一二三四五六]章|章节/.test(bodyText);
      const hasStage = /关卡|stage|level/i.test(bodyText);
      const hasBattle = /战斗|出战|开战|布阵/.test(bodyText);
      
      return { stageCount, chapterCount, battleCount, campaignCount, containerClasses, hasChapter, hasStage, hasBattle };
    });
    console.log(`  关键词: stage=${domInfo.stageCount}, chapter=${domInfo.chapterCount}, battle=${domInfo.battleCount}, campaign=${domInfo.campaignCount}`);
    console.log(`  文本: 章节=${domInfo.hasChapter}, 关卡=${domInfo.hasStage}, 战斗=${domInfo.hasBattle}`);
    if (domInfo.containerClasses.length > 0) {
      console.log(`  容器: ${JSON.stringify(domInfo.containerClasses.slice(0, 5))}`);
    }
    
    // 尝试点击关卡节点
    console.log('[4] 尝试点击关卡节点...');
    const clicked = await page.evaluate(() => {
      // 尝试多种选择器
      const selectors = [
        '[class*="stage-node"]', '[class*="stage"][class*="active"]', '[class*="node"][class*="current"]',
        '[class*="level"][class*="unlock"]', '[class*="point"][class*="current"]', '[class*="stage"]:not([class*="locked"])'
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) { el.click(); return sel; }
      }
      // fallback: 点击任何可见的关卡相关元素
      const all = document.querySelectorAll('[class*="stage"], [class*="level"]');
      for (const el of all) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) { el.click(); return 'fallback: ' + el.className; }
      }
      return null;
    });
    await page.waitForTimeout(1500);
    await takeScreenshot(page, 'v3-stage-clicked.png');
    console.log(`  ${clicked ? '✅ 点击了: ' + clicked : '⚠️ 未找到可点击的关卡'}`);
    
    // 数据完整性
    console.log('[5] 数据完整性检查...');
    const dataOk = await page.evaluate(() => {
      const text = document.body.innerText;
      const hasNaN = text.includes('NaN');
      const hasUndefined = text.includes('undefined');
      const hasNull = text.includes('null');
      return { hasNaN, hasUndefined, hasNull, ok: !hasNaN && !hasUndefined && !hasNull };
    });
    console.log(`  ${dataOk.ok ? '✅' : '❌'} NaN=${dataOk.hasNaN}, undefined=${dataOk.hasUndefined}, null=${dataOk.hasNull}`);
    
    // 移动端
    console.log('[6] 移动端适配...');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(2000);
    await takeScreenshot(page, 'v3-campaign-mobile.png');
    console.log('  ✅ 移动端截图完成');
    
    // 移动端数据完整性
    const mobileOk = await page.evaluate(() => {
      const text = document.body.innerText;
      return !text.includes('NaN') && !text.includes('undefined');
    });
    console.log(`  ${mobileOk ? '✅' : '❌'} 移动端数据完整性`);
    
    // 控制台错误
    console.log('[7] 控制台错误...');
    console.log(`  ${errors.length === 0 ? '✅' : '❌'} 控制台错误: ${errors.length}个`);
    errors.slice(0, 5).forEach(e => console.log(`    - ${e.substring(0, 100)}`));
    
    console.log('\n=== v3.0 UI 测试完成 ===');
    
  } catch (err) {
    console.error('❌ 测试出错:', err.message);
    await takeScreenshot(page, 'v3-error.png');
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
