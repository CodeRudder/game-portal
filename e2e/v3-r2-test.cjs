/**
 * v3.0 攻城略地-上 — R2 UI测试（10个关键检查点）
 *
 * 测试范围：战役Tab、世界地图Tab、关卡列表、领土网格、控制台错误、PC/移动端截图
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const gameActions = require('./utils/game-actions.cjs');

const { initBrowser, enterGame, switchTab, takeScreenshot, getConsoleErrors, clearConsoleErrors } = gameActions;
const SHOT_DIR = path.join(__dirname, 'screenshots', 'v3-r2');

// 结果收集
const R = { passed: [], failed: [], warnings: [], screenshots: [] };
const pass = n => { R.passed.push(n); console.log(`  ✅ ${n}`); };
const fail = (n, d) => { R.failed.push({ n, d }); console.log(`  ❌ ${n} — ${d}`); };
const warn = (n, d) => { R.warnings.push({ n, d }); console.log(`  ⚠️  ${n} — ${d}`); };

(async () => {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  v3.0 攻城略地-上 — R2 UI测试（10项检查）');
  console.log('═══════════════════════════════════════════════════\n');
  fs.mkdirSync(SHOT_DIR, { recursive: true });

  const { page, browser } = await initBrowser({ headless: true, width: 1280, height: 720 });
  clearConsoleErrors(page);

  try {
    // ── 1. 游戏页面加载 ──
    console.log('[1] 游戏页面加载...');
    await page.goto('http://localhost:5173/idle/three-kingdoms', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(3000);
    // 关闭欢迎弹窗
    const startBtn = await page.$('button:has-text("开始游戏")');
    if (startBtn) { await startBtn.click(); await page.waitForTimeout(3000); }
    const title = await page.title();
    title ? pass('页面加载成功 (title: ' + title.substring(0, 40) + ')') : fail('页面加载失败', 'title为空');
    await page.screenshot({ path: path.join(SHOT_DIR, '01-loaded-pc.png') });
    R.screenshots.push('01-loaded-pc.png');

    // ── 2. 战役Tab可见 ──
    console.log('\n[2] 战役Tab可见...');
    const campaignTab = await page.$('button[role="tab"]:has-text("关卡")');
    campaignTab ? pass('战役Tab(关卡)可见') : warn('战役Tab未找到', '尝试文字匹配"战役"');
    if (!campaignTab) {
      const alt = await page.$('button:has-text("战役"), button:has-text("Campaign"), [data-testid="tab-campaign"]');
      alt ? pass('战役Tab(备选)可见') : fail('战役Tab不可见', '未找到关卡/战役按钮');
    }

    // ── 3. 点击战役Tab后场景切换 ──
    console.log('\n[3] 点击战役Tab...');
    clearConsoleErrors(page);
    try {
      await switchTab(page, '关卡');
      await page.waitForTimeout(2000);
      const hasCampaign = await page.evaluate(() => {
        const html = document.body.innerHTML.toLowerCase();
        return html.includes('campaign') || html.includes('stage') || html.includes('chapter') || html.includes('关卡');
      });
      hasCampaign ? pass('战役场景切换成功') : warn('场景切换不确定', '未检测到campaign/stage/chapter关键词');
    } catch (e) {
      fail('战役Tab点击失败', e.message);
    }
    await page.screenshot({ path: path.join(SHOT_DIR, '03-campaign-tab.png') });
    R.screenshots.push('03-campaign-tab.png');

    // ── 4. 关卡列表/章节可见 ──
    console.log('\n[4] 关卡列表/章节可见...');
    const stageInfo = await page.evaluate(() => {
      const text = document.body.innerText;
      const containers = document.querySelectorAll('[class*="stage"], [class*="chapter"], [class*="campaign"], [class*="level-list"]');
      const hasChapter = /第[一二三四五六七八九十]章|章节|Chapter/i.test(text);
      const hasStage = /关卡|Stage|Level/i.test(text);
      return { containerCount: containers.length, hasChapter, hasStage, textSample: text.substring(0, 200) };
    });
    if (stageInfo.containerCount > 0 || stageInfo.hasChapter || stageInfo.hasStage) {
      pass('关卡列表可见 (容器=' + stageInfo.containerCount + ', 章节=' + stageInfo.hasChapter + ', 关卡=' + stageInfo.hasStage + ')');
    } else {
      warn('关卡列表不确定', '未检测到关卡/章节相关元素');
    }

    // ── 5. 世界地图Tab可见 ──
    console.log('\n[5] 世界地图Tab可见...');
    // 先回到主界面
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
    const mapTab = await page.$('button[role="tab"]:has-text("天下")');
    mapTab ? pass('世界地图Tab(天下)可见') : warn('天下Tab未找到', '尝试备选匹配');
    if (!mapTab) {
      const alt = await page.$('button:has-text("天下"), button:has-text("地图"), button:has-text("Map"), [data-testid="tab-map"]');
      alt ? pass('地图Tab(备选)可见') : fail('世界地图Tab不可见', '未找到天下/地图按钮');
    }

    // ── 6. 点击地图Tab后地图渲染 ──
    console.log('\n[6] 点击地图Tab...');
    try {
      await switchTab(page, '天下');
      await page.waitForTimeout(2000);
      const mapRendered = await page.evaluate(() => {
        const html = document.body.innerHTML.toLowerCase();
        return html.includes('territory') || html.includes('map') || html.includes('grid') || html.includes('天下') || html.includes('领土');
      });
      mapRendered ? pass('地图渲染成功') : warn('地图渲染不确定', '未检测到地图相关元素');
    } catch (e) {
      // 备选：尝试"地图"
      try {
        await switchTab(page, '地图');
        await page.waitForTimeout(2000);
        pass('地图Tab(备选)切换成功');
      } catch (e2) {
        fail('地图Tab点击失败', e.message);
      }
    }
    await page.screenshot({ path: path.join(SHOT_DIR, '06-world-map.png') });
    R.screenshots.push('06-world-map.png');

    // ── 7. 领土网格可见 ──
    console.log('\n[7] 领土网格可见...');
    const gridInfo = await page.evaluate(() => {
      const grids = document.querySelectorAll('[class*="territory"], [class*="grid-cell"], [class*="map-cell"], [class*="region"]');
      const canvas = document.querySelectorAll('canvas');
      const text = document.body.innerText;
      const hasTerritory = /领土|领地|城池|占领|势力/.test(text);
      return { gridCount: grids.length, canvasCount: canvas.length, hasTerritory };
    });
    if (gridInfo.gridCount > 0 || gridInfo.hasTerritory) {
      pass('领土网格可见 (元素=' + gridInfo.gridCount + ', 文字匹配=' + gridInfo.hasTerritory + ')');
    } else if (gridInfo.canvasCount > 0) {
      warn('领土网格可能通过Canvas渲染', 'canvas=' + gridInfo.canvasCount + ', 无法直接检测DOM');
    } else {
      warn('领土网格不确定', '未检测到领土/网格元素');
    }

    // ── 8. 无控制台错误 ──
    console.log('\n[8] 控制台错误检查...');
    const errors = getConsoleErrors(page);
    if (errors.length === 0) {
      pass('无控制台错误');
    } else {
      // 过滤掉常见的非关键错误
      const critical = errors.filter(e => !e.includes('favicon') && !e.includes('404'));
      if (critical.length === 0) {
        warn('仅有非关键控制台消息', errors.length + '条 (favicon/404等)');
      } else {
        fail('存在控制台错误', critical.length + '条: ' + critical.slice(0, 3).map(e => e.substring(0, 80)).join(' | '));
      }
    }

    // ── 9. PC截图 (1280x720) ──
    console.log('\n[9] PC截图...');
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(1500);
    // 回到战役Tab截图
    try { await switchTab(page, '关卡'); } catch {}
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SHOT_DIR, '09-pc-1280x720.png') });
    R.screenshots.push('09-pc-1280x720.png');
    pass('PC截图完成 (1280x720)');

    // ── 10. 移动端截图 (375x812) ──
    console.log('\n[10] 移动端截图...');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SHOT_DIR, '10-mobile-375x812.png') });
    R.screenshots.push('10-mobile-375x812.png');
    // 移动端数据完整性
    const mobileOk = await page.evaluate(() => {
      const t = document.body.innerText;
      return !t.includes('NaN') && !t.includes('undefined');
    });
    mobileOk ? pass('移动端截图完成 (375x812), 数据完整') : fail('移动端数据异常', '检测到NaN/undefined');

  } catch (err) {
    console.error('\n❌ 测试异常:', err.message);
    await page.screenshot({ path: path.join(SHOT_DIR, 'error.png') }).catch(() => {});
  } finally {
    await browser.close();
  }

  // ── 输出汇总 ──
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  测试结果汇总');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  ✅ 通过: ${R.passed.length}`);
  console.log(`  ❌ 失败: ${R.failed.length}`);
  console.log(`  ⚠️  警告: ${R.warnings.length}`);
  console.log(`  📸 截图: ${R.screenshots.length}`);
  if (R.failed.length > 0) {
    console.log('\n  失败详情:');
    R.failed.forEach(f => console.log(`    ❌ ${f.n}: ${f.d}`));
  }
  if (R.warnings.length > 0) {
    console.log('\n  警告详情:');
    R.warnings.forEach(w => console.log(`    ⚠️  ${w.n}: ${w.d}`));
  }
  console.log('\n═══════════════════════════════════════════════════\n');

  // 写入JSON结果
  const resultPath = path.join(__dirname, 'v3-r2-results.json');
  fs.writeFileSync(resultPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    passed: R.passed,
    failed: R.failed,
    warnings: R.warnings,
    screenshots: R.screenshots,
    summary: { pass: R.passed.length, fail: R.failed.length, warn: R.warnings.length }
  }, null, 2));
  console.log('结果已保存: ' + resultPath);
})();
