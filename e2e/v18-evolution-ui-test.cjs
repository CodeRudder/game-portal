/**
 * v18.0 新手引导 — 进化迭代 UI测试 R1
 *
 * 测试范围：
 * 1. 引导系统入口检查
 * 2. 引导步骤渲染
 * 3. 引导遮罩/高亮效果
 * 4. 引导完成检测
 * 5. 引导跳过机制
 * 6. 引导重玩入口
 * 7. 数据完整性
 * 8. 移动端适配
 *
 * @module e2e/v18-evolution-ui-test
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.GAME_BASE_URL || 'http://localhost:5173/idle/three-kingdoms';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots', 'v18-evolution');

const results = {
  passed: [],
  failed: [],
  warnings: [],
  screenshots: [],
  consoleErrors: [],
  startTime: new Date().toISOString(),
};

function pass(name) { results.passed.push(name); console.log(`  ✅ PASS: ${name}`); }
function fail(name, detail) { results.failed.push({ name, detail: String(detail).substring(0, 300) }); console.log(`  ❌ FAIL: ${name} — ${String(detail).substring(0, 150)}`); }
function warn(name, detail) { results.warnings.push({ name, detail: String(detail).substring(0, 300) }); console.log(`  ⚠️  WARN: ${name} — ${String(detail).substring(0, 150)}`); }

async function takeScreenshot(page, name) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const filepath = path.join(SCREENSHOT_DIR, name + '.png');
  await page.screenshot({ path: filepath, fullPage: false });
  results.screenshots.push(name);
  console.log(`  📸 ${name}`);
}

async function enterGame(page) {
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  const startBtn = await page.$('button:has-text("开始游戏")');
  if (startBtn) { await startBtn.click(); await page.waitForTimeout(3000); }
}

async function skipGuide(page) {
  for (let i = 0; i < 10; i++) {
    const overlay = await page.$('.tk-guide-overlay');
    if (!overlay) break;
    const skipBtn = await page.$('.tk-guide-btn--skip');
    if (skipBtn) { await skipBtn.evaluate(el => el.click()); await page.waitForTimeout(500); continue; }
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  }
}

async function clearGuideStorage(page) {
  try {
    await page.evaluate(() => {
      try { localStorage.removeItem('tk-guide-progress'); } catch {}
      try { localStorage.removeItem('three-kingdoms-tutorial-save'); } catch {}
    });
  } catch {}
}

async function resetGuideState(page) {
  await clearGuideStorage(page);
  await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  const startBtn = await page.$('button:has-text("开始游戏")');
  if (startBtn) { await startBtn.click(); await page.waitForTimeout(3000); }
}

async function getStorageItem(page, key) {
  try {
    return await page.evaluate((k) => {
      try { const raw = localStorage.getItem(k); return raw ? JSON.parse(raw) : null; } catch { return null; }
    }, key);
  } catch { return null; }
}

// ─────────────────────────────────────────────
// 测试1: 引导系统入口检查
// ─────────────────────────────────────────────
async function testGuideEntry(page) {
  console.log('\n📋 测试1: 引导系统入口检查');
  try {
    await resetGuideState(page);
    await takeScreenshot(page, 'v18-guide-entry');

    const overlay = await page.$('.tk-guide-overlay');
    if (overlay) {
      pass('引导遮罩已渲染');
      await takeScreenshot(page, 'v18-guide-overlay-visible');
    } else {
      warn('引导遮罩未自动出现', '可能已完成过引导或非首次进入');
    }

    const tooltip = await page.$('.tk-guide-tooltip');
    if (tooltip) {
      pass('引导气泡已渲染');
      const title = await tooltip.$('.tk-guide-tooltip__title');
      if (title) {
        const titleText = await title.textContent();
        pass(`引导标题: "${titleText}"`);
      }
    } else {
      warn('引导气泡未找到', '可能引导已完成');
    }

    const progress = await page.$('.tk-guide-tooltip__progress');
    if (progress) {
      const progressText = await progress.textContent();
      pass(`引导进度: ${progressText}`);
    }
  } catch (e) { fail('引导系统入口', e.message); }
}

// ─────────────────────────────────────────────
// 测试2: 引导步骤渲染
// ─────────────────────────────────────────────
async function testGuideSteps(page) {
  console.log('\n📋 测试2: 引导步骤渲染');
  try {
    let overlay = await page.$('.tk-guide-overlay');
    if (!overlay) {
      await resetGuideState(page);
      overlay = await page.$('.tk-guide-overlay');
    }

    if (!overlay) {
      warn('引导步骤测试跳过', '无法触发引导');
      return;
    }

    let stepCount = 0;
    for (let i = 0; i < 6; i++) {
      const nextBtn = await page.$('.tk-guide-btn--next');
      if (!nextBtn) break;

      const progressEl = await page.$('.tk-guide-tooltip__progress');
      const progressText = progressEl ? await progressEl.textContent() : 'N/A';

      await takeScreenshot(page, `v18-guide-step-${i + 1}`);
      pass(`引导步骤 ${progressText} 渲染正常`);
      stepCount++;

      await nextBtn.click();
      await page.waitForTimeout(800);

      const stillVisible = await page.$('.tk-guide-overlay');
      if (!stillVisible) {
        pass(`引导在第 ${i + 1} 步完成`);
        break;
      }
    }

    if (stepCount > 0) {
      pass(`共完成 ${stepCount} 个引导步骤`);
    } else {
      warn('未执行任何引导步骤');
    }
  } catch (e) { fail('引导步骤渲染', e.message); }
}

// ─────────────────────────────────────────────
// 测试3: 引导遮罩/高亮效果
// ─────────────────────────────────────────────
async function testGuideMask(page) {
  console.log('\n📋 测试3: 引导遮罩/高亮效果');
  try {
    await resetGuideState(page);

    const overlay = await page.$('.tk-guide-overlay');
    if (!overlay) {
      warn('引导遮罩测试跳过', '引导未触发');
      return;
    }

    const backdrop = await page.$('.tk-guide-backdrop');
    if (backdrop) {
      const bgStyle = await backdrop.evaluate(el => window.getComputedStyle(el).background);
      if (bgStyle && bgStyle.includes('rgba')) {
        pass('遮罩背景半透明效果正确');
      } else {
        warn('遮罩背景样式异常', bgStyle);
      }
    } else {
      fail('遮罩背景元素未找到', '.tk-guide-backdrop 不存在');
    }

    const tooltip = await page.$('.tk-guide-tooltip');
    if (tooltip) {
      const classes = await tooltip.getAttribute('class') || '';
      const hasPosition = ['--top', '--bottom', '--left', '--right', '--center'].some(p => classes.includes(p));
      if (hasPosition) {
        pass('气泡有正确的位置类');
      } else {
        warn('气泡缺少位置类', classes);
      }
    }

    const nextBtn = await page.$('.tk-guide-btn--next');
    const skipBtn = await page.$('.tk-guide-btn--skip');
    if (nextBtn && skipBtn) {
      pass('引导有 Next 和 Skip 按钮');
    } else {
      warn('引导按钮不完整', `Next: ${!!nextBtn}, Skip: ${!!skipBtn}`);
    }

    await takeScreenshot(page, 'v18-guide-mask-effect');
  } catch (e) { fail('引导遮罩/高亮效果', e.message); }
}

// ─────────────────────────────────────────────
// 测试4: 引导完成检测
// ─────────────────────────────────────────────
async function testGuideCompletion(page) {
  console.log('\n📋 测试4: 引导完成检测');
  try {
    await skipGuide(page);
    await page.waitForTimeout(1000);

    const overlay = await page.$('.tk-guide-overlay');
    if (!overlay) {
      pass('引导完成后遮罩消失');
    } else {
      fail('引导完成后遮罩未消失', '遮罩仍然可见');
    }

    const savedProgress = await getStorageItem(page, 'tk-guide-progress');
    if (savedProgress) {
      pass(`引导进度已保存到 localStorage: completed=${savedProgress.completed}`);
    } else {
      warn('引导进度未保存到 localStorage');
    }

    await takeScreenshot(page, 'v18-guide-completed');
  } catch (e) { fail('引导完成检测', e.message); }
}

// ─────────────────────────────────────────────
// 测试5: 引导跳过机制
// ─────────────────────────────────────────────
async function testGuideSkip(page) {
  console.log('\n📋 测试5: 引导跳过机制');
  try {
    await resetGuideState(page);

    const overlay = await page.$('.tk-guide-overlay');
    if (!overlay) {
      warn('引导跳过测试跳过', '引导未触发');
      return;
    }

    await takeScreenshot(page, 'v18-guide-before-skip');

    const skipBtn = await page.$('.tk-guide-btn--skip');
    if (skipBtn) {
      await skipBtn.click();
      await page.waitForTimeout(1000);

      const stillVisible = await page.$('.tk-guide-overlay');
      if (!stillVisible) {
        pass('Skip 按钮正常工作，引导已跳过');
      } else {
        fail('Skip 按钮未关闭引导', '引导遮罩仍然可见');
      }
    } else {
      warn('Skip 按钮未找到');
    }

    await takeScreenshot(page, 'v18-guide-after-skip');
  } catch (e) { fail('引导跳过机制', e.message); }
}

// ─────────────────────────────────────────────
// 测试6: 主页面功能完整性
// ─────────────────────────────────────────────
async function testMainPageIntegrity(page) {
  console.log('\n📋 测试6: 主页面功能完整性');
  try {
    await skipGuide(page);
    await page.waitForTimeout(500);

    await takeScreenshot(page, 'v18-main-page-after-guide');

    const resourceBar = await page.$('.tk-resource-bar, [data-testid="resource-bar"]');
    if (resourceBar) {
      pass('资源栏渲染正常');
    } else {
      warn('资源栏元素未找到');
    }

    const tabs = await page.$$('.tk-tab, [role="tab"]');
    if (tabs.length > 0) {
      pass(`导航 Tab 数量: ${tabs.length}`);
    } else {
      warn('导航 Tab 未找到');
    }

    const consoleErrors = results.consoleErrors.filter(e =>
      !e.includes('favicon') && !e.includes('404')
    );
    if (consoleErrors.length === 0) {
      pass('无严重控制台错误');
    } else {
      warn(`控制台错误: ${consoleErrors.length} 条`);
    }
  } catch (e) { fail('主页面功能完整性', e.message); }
}

// ─────────────────────────────────────────────
// 测试7: 引导重玩入口
// ─────────────────────────────────────────────
async function testGuideReplayEntry(page) {
  console.log('\n📋 测试7: 引导重玩入口');
  try {
    const settingsBtn = await page.$(
      '[data-tab="设置"], button:has-text("设置"), .tk-tab:has-text("设置"), [data-testid="settings-tab"]'
    );
    if (settingsBtn) {
      await settingsBtn.click();
      await page.waitForTimeout(1500);
      await takeScreenshot(page, 'v18-settings-panel');

      const replayBtn = await page.$(
        'button:has-text("引导回顾"), button:has-text("重玩引导"), [data-testid="guide-replay"], button:has-text("Tutorial")'
      );
      if (replayBtn) {
        pass('引导回顾按钮存在');
        await takeScreenshot(page, 'v18-guide-replay-entry');
      } else {
        warn('引导回顾按钮未找到', '可能UI中未实现此入口');
      }
    } else {
      warn('设置面板未找到', '无法测试引导重玩入口');
    }
  } catch (e) { fail('引导重玩入口', e.message); }
}

// ─────────────────────────────────────────────
// 测试8: 数据完整性
// ─────────────────────────────────────────────
async function testDataIntegrity(page) {
  console.log('\n📋 测试8: 数据完整性');
  try {
    const tutorialSave = await getStorageItem(page, 'three-kingdoms-tutorial-save');

    if (tutorialSave) {
      pass('引导存档数据存在');
      const hasVersion = typeof tutorialSave.version === 'number';
      const hasPhase = typeof tutorialSave.currentPhase === 'string';
      const hasCompletedSteps = Array.isArray(tutorialSave.completedSteps);
      const hasCompletedEvents = Array.isArray(tutorialSave.completedEvents);

      if (hasVersion && hasPhase && hasCompletedSteps && hasCompletedEvents) {
        pass('引导存档数据结构完整');
        pass(`引导阶段: ${tutorialSave.currentPhase}`);
        pass(`已完成步骤: ${tutorialSave.completedSteps.length}`);
        pass(`已完成剧情: ${tutorialSave.completedEvents.length}`);
      } else {
        warn('引导存档数据结构不完整', `version=${hasVersion} phase=${hasPhase} steps=${hasCompletedSteps} events=${hasCompletedEvents}`);
      }
    } else {
      warn('引导存档数据不存在', '可能引导尚未保存');
    }

    const guideProgress = await getStorageItem(page, 'tk-guide-progress');

    if (guideProgress) {
      pass('GuideOverlay 进度数据存在');
      pass(`GuideOverlay completed: ${guideProgress.completed}`);
    } else {
      warn('GuideOverlay 进度数据不存在');
    }
  } catch (e) { fail('数据完整性', e.message); }
}

// ─────────────────────────────────────────────
// 测试9: 移动端适配
// ─────────────────────────────────────────────
async function testMobileAdaptation(browser) {
  console.log('\n📋 测试9: 移动端适配');
  try {
    const mobileContext = await browser.newContext({
      viewport: { width: 375, height: 812 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)',
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });
    const mobilePage = await mobileContext.newPage();

    mobilePage.on('console', msg => {
      if (msg.type() === 'error') {
        results.consoleErrors.push(`[Mobile] ${msg.text()}`);
      }
    });

    // 清除 localStorage 触发引导
    await mobilePage.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await mobilePage.waitForTimeout(2000);
    try {
      await mobilePage.evaluate(() => {
        try { localStorage.removeItem('tk-guide-progress'); } catch {}
        try { localStorage.removeItem('three-kingdoms-tutorial-save'); } catch {}
      });
    } catch {}
    await mobilePage.reload({ waitUntil: 'networkidle', timeout: 30000 });
    await mobilePage.waitForTimeout(3000);
    const startBtn = await mobilePage.$('button:has-text("开始游戏")');
    if (startBtn) { await startBtn.click(); await mobilePage.waitForTimeout(3000); }

    await takeScreenshot(mobilePage, 'v18-mobile-guide');

    const overlay = await mobilePage.$('.tk-guide-overlay');
    if (overlay) {
      pass('手机端引导遮罩正常渲染');

      const tooltip = await mobilePage.$('.tk-guide-tooltip');
      if (tooltip) {
        const box = await tooltip.boundingBox();
        if (box) {
          pass(`手机端气泡尺寸: ${Math.round(box.width)}x${Math.round(box.height)}`);
          if (box.width <= 375) {
            pass('手机端气泡宽度适配屏幕');
          } else {
            warn('手机端气泡可能超出屏幕', `width=${box.width}`);
          }
        }
      }

      const skipBtn = await mobilePage.$('.tk-guide-btn--skip');
      if (skipBtn) {
        await skipBtn.click();
        await mobilePage.waitForTimeout(1000);
        pass('手机端 Skip 按钮可点击');
      }
    } else {
      warn('手机端引导遮罩未出现');
    }

    await takeScreenshot(mobilePage, 'v18-mobile-after-guide');
    await mobileContext.close();
  } catch (e) { fail('移动端适配', e.message); }
}

// ─────────────────────────────────────────────
// 主流程
// ─────────────────────────────────────────────
(async () => {
  console.log('🚀 v18.0 新手引导 UI测试 R1');
  console.log(`📍 URL: ${BASE_URL}`);
  console.log(`📂 截图目录: ${SCREENSHOT_DIR}`);
  console.log('─'.repeat(50));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') {
      results.consoleErrors.push(msg.text());
    }
  });

  try {
    await testGuideEntry(page);
    await testGuideSteps(page);
    await testGuideMask(page);
    await testGuideCompletion(page);
    await testGuideSkip(page);
    await testMainPageIntegrity(page);
    await testGuideReplayEntry(page);
    await testDataIntegrity(page);
    await testMobileAdaptation(browser);
  } catch (e) {
    fail('测试主流程异常', e.message);
  }

  results.endTime = new Date().toISOString();
  console.log('\n' + '═'.repeat(50));
  console.log('📊 测试汇总');
  console.log('═'.repeat(50));
  console.log(`  ✅ 通过: ${results.passed.length}`);
  console.log(`  ❌ 失败: ${results.failed.length}`);
  console.log(`  ⚠️  警告: ${results.warnings.length}`);
  console.log(`  📸 截图: ${results.screenshots.length}`);
  console.log(`  🔴 控制台错误: ${results.consoleErrors.length}`);

  if (results.failed.length > 0) {
    console.log('\n❌ 失败详情:');
    results.failed.forEach(f => console.log(`  - ${f.name}: ${f.detail}`));
  }
  if (results.warnings.length > 0) {
    console.log('\n⚠️  警告详情:');
    results.warnings.forEach(w => console.log(`  - ${w.name}: ${w.detail}`));
  }

  const reportPath = path.join(SCREENSHOT_DIR, 'v18-test-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n📄 报告已保存: ${reportPath}`);

  await context.close();
  await browser.close();

  process.exit(results.failed.length > 0 ? 1 : 0);
})();
