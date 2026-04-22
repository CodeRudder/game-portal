/**
 * v7.0 草木皆兵 — 进化迭代 UI测试 R1
 *
 * 测试范围：
 * 1. NPC名册面板 — NPC列表、对话弹窗、赠送交互、好感度显示
 * 2. 事件系统 — 事件列表面板、连锁事件、历史剧情、事件日志
 * 3. 任务系统 — 任务面板、日常任务、活跃度、任务追踪
 * 4. 移动端适配
 *
 * @module e2e/v7-evolution-ui-test
 */

const { chromium, devices } = require('playwright');
const path = require('path');
const fs = require('fs');

// ─────────────────────────────────────────────
// 配置
// ─────────────────────────────────────────────
const BASE_URL = process.env.GAME_BASE_URL || 'http://localhost:3000/idle/three-kingdoms';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots', 'v7-evolution');

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

async function openFeaturePanel(page, panelLabel) {
  await dismissGuide(page);
  const btn = await page.$(`button:has-text("${panelLabel}")`);
  if (btn) {
    await btn.click();
    await page.waitForTimeout(1500);
    return true;
  }
  return false;
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

/** 测试1: NPC名册面板 */
async function testNPCTab(page) {
  console.log('\n📋 测试1: NPC名册面板');
  try {
    await switchTab(page, 'npc');
    await takeScreenshot(page, 'v7-npc-tab');

    // 检查NPC列表渲染
    const npcList = await page.$('.tk-npc-list, .npc-list, [data-testid="npc-list"]');
    if (npcList) {
      pass('NPC列表容器存在');
    } else {
      warn('NPC列表容器未找到（可能无NPC数据）');
    }

    // 检查NPC卡片
    const npcCards = await page.$$('.tk-npc-card, .npc-card');
    if (npcCards.length > 0) {
      pass(`NPC卡片数量: ${npcCards.length}`);
      // 点击第一个NPC查看详情
      await npcCards[0].click();
      await page.waitForTimeout(1000);
      await takeScreenshot(page, 'v7-npc-detail');

      // 检查好感度显示
      const affinity = await page.$('.tk-affinity, .affinity-bar, [data-testid="affinity"]');
      if (affinity) pass('好感度显示存在');
      else warn('好感度显示未找到');
    } else {
      warn('无NPC卡片（可能需要先刷新NPC）');
    }

    await closeAllModals(page);
  } catch (e) {
    fail('NPC名册面板', e.message);
  }
}

/** 测试2: NPC对话弹窗 */
async function testNPCDialog(page) {
  console.log('\n📋 测试2: NPC对话弹窗');
  try {
    await switchTab(page, 'npc');
    const npcCards = await page.$$('.tk-npc-card, .npc-card');
    if (npcCards.length > 0) {
      await npcCards[0].click();
      await page.waitForTimeout(1000);

      // 查找对话按钮
      const dialogBtn = await page.$('button:has-text("对话"), button:has-text("交谈"), .tk-npc-dialog-btn');
      if (dialogBtn) {
        await dialogBtn.click();
        await page.waitForTimeout(1000);
        await takeScreenshot(page, 'v7-npc-dialog');

        // 检查对话内容
        const dialogContent = await page.$('.tk-dialog-content, .dialog-text, [data-testid="dialog-content"]');
        if (dialogContent) pass('NPC对话内容渲染');
        else warn('对话内容未找到');
      } else {
        warn('对话按钮未找到');
      }
    } else {
      warn('无NPC可测试对话');
    }
    await closeAllModals(page);
  } catch (e) {
    fail('NPC对话弹窗', e.message);
  }
}

/** 测试3: NPC赠送交互 */
async function testNPCGift(page) {
  console.log('\n📋 测试3: NPC赠送交互');
  try {
    await switchTab(page, 'npc');
    const npcCards = await page.$$('.tk-npc-card, .npc-card');
    if (npcCards.length > 0) {
      await npcCards[0].click();
      await page.waitForTimeout(1000);

      const giftBtn = await page.$('button:has-text("赠送"), .tk-gift-btn, [data-testid="gift-btn"]');
      if (giftBtn) {
        await giftBtn.click();
        await page.waitForTimeout(1000);
        await takeScreenshot(page, 'v7-npc-gift');

        // 检查物品选择
        const giftItems = await page.$$('.tk-gift-item, .gift-item');
        if (giftItems.length > 0) pass(`赠送物品列表: ${giftItems.length}个`);
        else warn('赠送物品列表为空');
      } else {
        warn('赠送按钮未找到');
      }
    }
    await closeAllModals(page);
  } catch (e) {
    fail('NPC赠送交互', e.message);
  }
}

/** 测试4: 事件列表面板 */
async function testEventPanel(page) {
  console.log('\n📋 测试4: 事件列表面板');
  try {
    await closeAllModals(page);
    await dismissGuide(page);
    const opened = await openFeaturePanel(page, '事件');
    if (opened) {
      await takeScreenshot(page, 'v7-event-panel');
      pass('事件面板可打开');
    } else {
      warn('事件面板按钮未找到');
    }

    // 检查事件横幅
    const eventBanner = await page.$('.tk-event-banner, .event-banner');
    if (eventBanner) pass('事件横幅存在');
    else warn('事件横幅未显示（可能无活跃事件）');

    await closeAllModals(page);
  } catch (e) {
    fail('事件列表面板', e.message);
  }
}

/** 测试5: 任务面板 */
async function testQuestPanel(page) {
  console.log('\n📋 测试5: 任务面板');
  try {
    await closeAllModals(page);
    await dismissGuide(page);
    const opened = await openFeaturePanel(page, '任务');
    if (opened) {
      await page.waitForTimeout(1500);
      await takeScreenshot(page, 'v7-quest-panel');
      pass('任务面板可打开');

      // 检查任务分类Tab
      const questTabs = await page.$$('.tk-quest-tab, .quest-category-tab, [class*="quest"] [class*="tab"]');
      if (questTabs.length > 0) pass(`任务分类Tab数量: ${questTabs.length}`);
      else warn('任务分类Tab未找到');

      // 检查日常任务
      const dailyTab = await page.$('button:has-text("日常"), [data-testid="quest-tab-daily"]');
      if (dailyTab) {
        await dailyTab.click();
        await page.waitForTimeout(1000);
        await takeScreenshot(page, 'v7-quest-daily');
        pass('日常任务Tab可切换');
      }

      // 检查活跃度
      const activityBar = await page.$('.tk-activity-bar, .activity-progress, [data-testid="activity-bar"], [class*="activity"]');
      if (activityBar) pass('活跃度进度条存在');
      else warn('活跃度进度条未找到');
    } else {
      warn('任务面板按钮未找到');
    }
    await closeAllModals(page);
  } catch (e) {
    fail('任务面板', e.message);
  }
}

/** 测试6: 任务追踪面板 */
async function testQuestTracker(page) {
  console.log('\n📋 测试6: 任务追踪面板');
  try {
    // 任务追踪应在主界面常驻显示
    const tracker = await page.$('.tk-quest-tracker, .quest-tracker, [data-testid="quest-tracker"]');
    if (tracker) {
      pass('任务追踪面板在主界面显示');
      await takeScreenshot(page, 'v7-quest-tracker');
    } else {
      warn('任务追踪面板未显示（可能无进行中任务）');
    }
  } catch (e) {
    fail('任务追踪面板', e.message);
  }
}

/** 测试7: 数据完整性检查 */
async function testDataIntegrity(page) {
  console.log('\n📋 测试7: 数据完整性检查');
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

/** 测试8: 移动端适配 */
async function testMobile(page, context) {
  console.log('\n📋 测试8: 移动端适配');
  try {
    const mobilePage = await context.newPage();
    await mobilePage.setViewportSize({ width: 375, height: 667 });
    await enterGame(mobilePage);
    await takeScreenshot(mobilePage, 'v7-mobile-main');

    // NPC面板移动端
    await switchTab(mobilePage, 'npc');
    await takeScreenshot(mobilePage, 'v7-mobile-npc');

    // 任务面板移动端
    await closeAllModals(mobilePage);
    await dismissGuide(mobilePage);
    const questBtn = await mobilePage.$('button:has-text("任务")');
    if (questBtn) {
      await questBtn.click();
      await mobilePage.waitForTimeout(1500);
      await takeScreenshot(mobilePage, 'v7-mobile-quest');
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
  console.log('🚀 v7.0 草木皆兵 UI测试开始\n');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  // 收集控制台错误
  page.on('console', msg => {
    if (msg.type() === 'error') {
      results.consoleErrors.push(msg.text().substring(0, 200));
    }
  });

  try {
    await enterGame(page);
    await takeScreenshot(page, 'v7-main-page');

    await testNPCTab(page);
    await testNPCDialog(page);
    await testNPCGift(page);
    await testEventPanel(page);
    await testQuestPanel(page);
    await testQuestTracker(page);
    await testDataIntegrity(page);
    await testMobile(page, context);
  } catch (e) {
    fail('主流程', e.message);
  }

  // 输出结果
  results.endTime = new Date().toISOString();
  console.log('\n' + '='.repeat(50));
  console.log(`📊 v7.0 UI测试结果: ✅${results.passed.length} ❌${results.failed.length} ⚠️${results.warnings.length}`);
  if (results.failed.length > 0) {
    console.log('\n失败项:');
    results.failed.forEach(f => console.log(`  ❌ ${f.name}: ${f.detail}`));
  }

  // 保存结果
  const resultPath = path.join(__dirname, 'v7-evolution-ui-results.json');
  fs.writeFileSync(resultPath, JSON.stringify(results, null, 2));

  await browser.close();
  process.exit(results.failed.length > 0 ? 1 : 0);
})();
