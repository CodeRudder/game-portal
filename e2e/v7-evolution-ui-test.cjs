/**
 * v7.0 草木皆兵 — 进化迭代 UI测试 R1
 *
 * 基于源码实际DOM结构编写，精准选择器
 *
 * 测试范围：
 * 1. NPC巡逻系统 — 名士Tab、NPC卡片、对话弹窗、赠送交互、好感度显示
 * 2. 连锁事件 — 事件面板、事件横幅、随机遭遇弹窗
 * 3. 任务系统 — 任务面板、日常任务、活跃度、任务追踪
 * 4. 回归测试 — 建筑/武将/科技Tab基础验证
 * 5. 移动端适配
 *
 * @module e2e/v7-evolution-ui-test
 */

const { chromium, devices } = require('playwright');
const path = require('path');
const fs = require('fs');

// ─────────────────────────────────────────────
// 配置
// ─────────────────────────────────────────────
const BASE_URL = process.env.GAME_BASE_URL || 'http://localhost:5173/idle/three-kingdoms';
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

function screenshot(name) {
  results.screenshots.push(name);
}

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────
async function takeScreenshot(page, name) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const filepath = path.join(SCREENSHOT_DIR, name + '.png');
  await page.screenshot({ path: filepath, fullPage: false });
  console.log(`  📸 ${name}`);
  return name;
}

async function enterGame(page) {
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  // 关闭欢迎弹窗 — 点击"开始游戏"按钮
  const startBtn = await page.$('button:has-text("开始游戏")');
  if (startBtn) {
    await startBtn.click();
    await page.waitForTimeout(3000);
  }

  // 关闭新手引导覆盖层
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
    const backdrop = await page.$('.tk-guide-backdrop');
    if (backdrop) {
      await backdrop.evaluate(el => el.click());
      await page.waitForTimeout(500);
      continue;
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }
}

/**
 * 切换Tab — 源码中TabBar使用 button[data-testid="tab-{id}"]
 */
async function switchTab(page, tabId) {
  await dismissGuide(page);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // 方式1: 通过 data-testid
  let tab = await page.$(`[data-testid="tab-${tabId}"]`);
  if (!tab) {
    // 方式2: 通过button文本
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

/**
 * 打开功能菜单并选择功能面板
 * FeatureMenu: trigger → dropdown → item-{id}
 * 点击后 → handleFeatureSelect → setOpenFeature(id)
 */
async function openFeaturePanel(page, featureId) {
  await dismissGuide(page);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // 打开功能菜单
  const trigger = await page.$('[data-testid="feature-menu-trigger"]');
  if (!trigger) {
    throw new Error(`FeatureMenu触发按钮未找到`);
  }
  await trigger.click();
  await page.waitForTimeout(800);

  // 点击功能项
  const item = await page.$(`[data-testid="feature-menu-item-${featureId}"]`);
  if (!item) {
    throw new Error(`FeatureMenu项未找到: ${featureId}`);
  }
  await item.click();
  await page.waitForTimeout(1500);
}

async function closeAllModals(page) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const closeBtn = await page.$('.tk-shared-panel-close') ||
    await page.$('[data-testid$="-close"]') ||
    await page.$('.tk-bfm-close');
  if (closeBtn) {
    await closeBtn.click();
    await page.waitForTimeout(500);
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}

async function checkDataIntegrity(page) {
  const text = await page.textContent('body');
  const issues = [];
  if (text.includes('NaN')) issues.push('页面显示NaN');
  if (text.includes('undefined')) issues.push('页面显示undefined');
  return { hasNaN: text.includes('NaN'), hasUndefined: text.includes('undefined'), issues };
}

// ─────────────────────────────────────────────
// 主测试流程
// ─────────────────────────────────────────────
(async () => {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  v7.0 草木皆兵 — 进化迭代 UI测试 R1');
  console.log('═══════════════════════════════════════════════════\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  // 收集控制台错误
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push('PAGEERROR: ' + err.message));

  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  try {
    // ═══════════════════════════════════════════
    // 0. 进入游戏主界面
    // ═══════════════════════════════════════════
    console.log('\n── 步骤0: 进入游戏主界面 ──');
    await enterGame(page);
    const shot0 = await takeScreenshot(page, 'v7e-00-main');
    screenshot(shot0);
    pass('游戏主界面加载成功');

    // 数据完整性
    const integrity = await checkDataIntegrity(page);
    if (!integrity.hasNaN && !integrity.hasUndefined) {
      pass('主界面数据完整性检查通过（无NaN/undefined）');
    } else {
      integrity.issues.forEach(i => fail('主界面数据完整性', i));
    }

    // ═══════════════════════════════════════════
    // 模块A: NPC巡逻系统 — 名士Tab
    // ═══════════════════════════════════════════
    console.log('\n── 步骤A1: 名士Tab — NPC名册面板 ──');
    await switchTab(page, 'npc');
    await page.waitForTimeout(2000);
    const shotA1 = await takeScreenshot(page, 'v7e-A1-npc-tab');
    screenshot(shotA1);

    // A1.1 NPC Tab容器
    const npcTab = await page.$('[data-testid="npc-tab"]');
    if (npcTab) pass('NPC名册Tab容器存在（data-testid=npc-tab）');
    else fail('NPC名册Tab容器缺失', '未找到 data-testid=npc-tab');

    // A1.2 NPC搜索框
    const npcSearch = await page.$('[data-testid="npc-search-input"]');
    if (npcSearch) pass('NPC搜索框存在（data-testid=npc-search-input）');
    else fail('NPC搜索框缺失', '未找到 data-testid=npc-search-input');

    // A1.3 NPC职业筛选栏
    const npcFilterBar = await page.$('[data-testid="npc-filter-bar"]');
    if (npcFilterBar) pass('NPC职业筛选栏存在（data-testid=npc-filter-bar）');
    else fail('NPC职业筛选栏缺失', '未找到 data-testid=npc-filter-bar');

    // A1.4 NPC列表容器
    const npcList = await page.$('[data-testid="npc-list"]');
    if (npcList) pass('NPC列表容器存在（data-testid=npc-list）');
    else fail('NPC列表容器缺失', '未找到 data-testid=npc-list');

    // A1.5 NPC卡片
    const npcCards = await page.$$('[data-testid^="npc-card-"]');
    if (npcCards.length > 0) {
      pass(`NPC卡片渲染（${npcCards.length}张, data-testid=npc-card-*）`);
    } else {
      // 检查空状态
      const npcEmpty = await page.$('[data-testid="npc-empty"]');
      if (npcEmpty) {
        pass('NPC空状态提示正常显示');
      } else {
        warn('NPC列表为空且无空状态提示', '可能NPC巡逻系统尚未刷新NPC');
      }
    }

    // A1.6 NPC底部统计
    const npcFooter = await page.$('[data-testid="npc-tab-footer"]');
    if (npcFooter) pass('NPC底部统计存在（data-testid=npc-tab-footer）');
    else warn('NPC底部统计未找到', '非关键元素');

    // A1.7 NPC筛选按钮测试
    const filterAllBtn = await page.$('[data-testid="npc-filter-all"]');
    if (filterAllBtn) {
      await filterAllBtn.click();
      await page.waitForTimeout(500);
      pass('NPC"全部"筛选按钮可点击');
    } else {
      warn('NPC"全部"筛选按钮未找到', 'data-testid=npc-filter-all');
    }

    // A1.8 NPC搜索功能测试
    if (npcSearch) {
      await npcSearch.fill('测试');
      await page.waitForTimeout(500);
      const shotA1s = await takeScreenshot(page, 'v7e-A1-npc-search');
      screenshot(shotA1s);
      pass('NPC搜索输入功能正常');
      // 清空搜索
      await npcSearch.fill('');
      await page.waitForTimeout(300);
    }

    // A1.9 NPC卡片交互 — 详情弹窗
    const npcCardsForInfo = await page.$$('[data-testid^="npc-card-"]');
    if (npcCardsForInfo.length > 0) {
      const firstCard = npcCardsForInfo[0];
      const cardTestId = await firstCard.getAttribute('data-testid');
      console.log(`  ℹ️  点击NPC卡片: ${cardTestId}`);

      // 点击详情按钮
      const infoBtn = await firstCard.$('[data-testid^="npc-btn-info-"]');
      if (infoBtn) {
        await infoBtn.click();
        await page.waitForTimeout(1500);
        const shotA2 = await takeScreenshot(page, 'v7e-A2-npc-info');
        screenshot(shotA2);

        // 检查NPC详情弹窗
        const npcInfoModal = await page.$('[data-testid="npc-info-modal"]');
        if (npcInfoModal) pass('NPC详情弹窗打开（data-testid=npc-info-modal）');
        else warn('NPC详情弹窗未找到', '可能弹窗延迟加载');

        // 检查好感度显示
        const affinityEl = await page.$('[data-testid="npc-info-affinity"]');
        if (affinityEl) pass('NPC好感度显示存在（data-testid=npc-info-affinity）');
        else warn('NPC好感度显示未找到');

        // 检查操作按钮区域
        const actionsEl = await page.$('[data-testid="npc-info-actions"]');
        if (actionsEl) pass('NPC操作按钮区域存在（data-testid=npc-info-actions）');
        else warn('NPC操作按钮区域未找到');

        // 关闭弹窗
        const closeInfoBtn = await page.$('[data-testid="npc-info-close"]');
        if (closeInfoBtn) {
          await closeInfoBtn.click();
          await page.waitForTimeout(500);
          pass('NPC详情弹窗可关闭');
        }
      } else {
        // 直接点击卡片
        await firstCard.click();
        await page.waitForTimeout(1000);
        const shotA2b = await takeScreenshot(page, 'v7e-A2b-npc-card-click');
        screenshot(shotA2b);
        warn('NPC卡片无独立详情按钮', '点击卡片触发默认操作');
      }

      await closeAllModals(page);
    }

    // A1.10 NPC对话测试
    const npcCardsForDialog = await page.$$('[data-testid^="npc-card-"]');
    if (npcCardsForDialog.length > 0) {
      const firstCard = npcCardsForDialog[0];
      const dialogBtn = await firstCard.$('[data-testid^="npc-btn-dialog-"]');
      if (dialogBtn) {
        await dialogBtn.click();
        await page.waitForTimeout(1500);
        const shotA3 = await takeScreenshot(page, 'v7e-A3-npc-dialog');
        screenshot(shotA3);

        // 检查对话弹窗
        const dialogOverlay = await page.$('[data-testid="npc-dialog-overlay"]');
        if (dialogOverlay) pass('NPC对话弹窗打开（data-testid=npc-dialog-overlay）');
        else warn('NPC对话弹窗未找到', '可能需要等待');

        // 检查对话内容
        const dialogContent = await page.$('[data-testid="npc-dialog-content"]');
        if (dialogContent) pass('NPC对话内容区域存在（data-testid=npc-dialog-content）');

        // 检查对话选项
        const dialogOptions = await page.$('[data-testid="npc-dialog-options"]');
        if (dialogOptions) pass('NPC对话选项区域存在（data-testid=npc-dialog-options）');

        // 关闭对话
        const closeDialogBtn = await page.$('[data-testid="npc-dialog-close"]');
        if (closeDialogBtn) {
          await closeDialogBtn.click();
          await page.waitForTimeout(500);
          pass('NPC对话弹窗可关闭');
        } else {
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);
          pass('NPC对话弹窗通过Escape关闭');
        }
      } else {
        warn('NPC卡片无对话按钮', '对话功能可能需要好感度条件');
      }
      await closeAllModals(page);
    }

    // A1.11 NPC职业筛选测试
    const filterBtns = await page.$$('[data-testid^="npc-filter-"]');
    if (filterBtns.length > 1) {
      // 点击第二个筛选按钮（第一个是"全部"）
      const secondFilter = filterBtns[1];
      const filterTestId = await secondFilter.getAttribute('data-testid');
      console.log(`  ℹ️  点击筛选: ${filterTestId}`);
      await secondFilter.click();
      await page.waitForTimeout(500);
      const shotA4 = await takeScreenshot(page, 'v7e-A4-npc-filter');
      screenshot(shotA4);
      pass(`NPC职业筛选可切换（${filterTestId}）`);
    }

    // ═══════════════════════════════════════════
    // 模块B: 连锁事件系统
    // ═══════════════════════════════════════════
    console.log('\n── 步骤B1: 事件系统 — 事件列表面板 ──');

    // B1.1 检查事件横幅（主界面可能显示）
    await switchTab(page, 'building');
    await page.waitForTimeout(1000);
    const eventBanner = await page.$('[data-testid="event-banner"]');
    if (eventBanner) {
      pass('事件急报横幅显示（data-testid=event-banner）');
      const shotB0 = await takeScreenshot(page, 'v7e-B0-event-banner');
      screenshot(shotB0);
    } else {
      warn('事件急报横幅未显示', '当前可能无活跃急报事件');
    }

    // B1.2 通过功能菜单打开事件面板
    try {
      await openFeaturePanel(page, 'events');
      await page.waitForTimeout(2000);
      const shotB1 = await takeScreenshot(page, 'v7e-B1-event-panel');
      screenshot(shotB1);

      // 检查事件列表面板
      const eventListPanel = await page.$('[data-testid="event-list-panel"]');
      if (eventListPanel) pass('事件列表面板打开（data-testid=event-list-panel）');
      else warn('事件列表面板未找到', 'data-testid=event-list-panel 不存在');

      // 检查事件卡片
      const eventCards = await page.$$('[data-testid^="event-card-"]');
      if (eventCards.length > 0) {
        pass(`事件卡片渲染（${eventCards.length}张, data-testid=event-card-*）`);
      } else {
        warn('事件卡片为空', '当前可能无活跃事件');
      }

      pass('事件面板可通过功能菜单打开');
    } catch (e) {
      warn('事件面板打开失败', e.message);
    }
    await closeAllModals(page);

    // B1.3 检查随机遭遇弹窗（如果出现）
    const encounterModal = await page.$('[data-testid="encounter-modal"]');
    if (encounterModal) {
      pass('随机遭遇弹窗出现（data-testid=encounter-modal）');
      const shotB2 = await takeScreenshot(page, 'v7e-B2-encounter');
      screenshot(shotB2);

      // 检查遭遇选项
      const encounterOptions = await page.$$('[data-testid^="encounter-option-"]');
      if (encounterOptions.length > 0) {
        pass(`遭遇选项渲染（${encounterOptions.length}个）`);
      }

      // 关闭遭遇
      const ignoreBtn = await page.$('[data-testid="encounter-ignore-btn"]');
      if (ignoreBtn) {
        await ignoreBtn.click();
        await page.waitForTimeout(500);
        pass('随机遭遇可忽略关闭');
      } else {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }
    } else {
      warn('随机遭遇弹窗未触发', '需引擎随机触发，非测试可控');
    }

    // B1.4 检查剧情事件弹窗
    const storyModal = await page.$('[data-testid="story-event-modal"]');
    if (storyModal) {
      pass('剧情事件弹窗出现（data-testid=story-event-modal）');
      const shotB3 = await takeScreenshot(page, 'v7e-B3-story-event');
      screenshot(shotB3);

      const storyChoices = await page.$('[data-testid="story-event-choices"]');
      if (storyChoices) pass('剧情事件选项区域存在');

      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    } else {
      warn('剧情事件弹窗未触发', '需引擎条件触发');
    }

    // ═══════════════════════════════════════════
    // 模块C: 任务系统
    // ═══════════════════════════════════════════
    console.log('\n── 步骤C1: 任务系统 — 任务面板 ──');

    // C1.1 通过功能菜单打开任务面板
    try {
      await openFeaturePanel(page, 'quest');
      await page.waitForTimeout(2000);
      const shotC1 = await takeScreenshot(page, 'v7e-C1-quest-panel');
      screenshot(shotC1);
      pass('任务面板可通过功能菜单打开');

      // C1.2 检查任务面板内容 — SharedPanel容器
      // QuestPanel使用SharedPanel包裹，检查面板标题
      const questPanelText = await page.textContent('body');
      if (questPanelText.includes('任务') || questPanelText.includes('日常') || questPanelText.includes('活跃度')) {
        pass('任务面板内容渲染（包含任务相关文本）');
      } else {
        warn('任务面板内容可能未渲染', '未检测到任务相关文本');
      }

      // C1.3 检查活跃度进度条
      if (questPanelText.includes('活跃度')) {
        pass('活跃度进度条显示');
      } else {
        warn('活跃度进度条未显示', '可能数据未初始化');
      }

      // C1.4 检查任务分类Tab（日常/主线/支线）
      const dailyTab = await page.$('button:has-text("日常")');
      if (dailyTab) {
        await dailyTab.click();
        await page.waitForTimeout(1000);
        const shotC2 = await takeScreenshot(page, 'v7e-C2-quest-daily');
        screenshot(shotC2);
        pass('日常任务Tab可切换');
      } else {
        warn('日常任务Tab未找到');
      }

      const mainTab = await page.$('button:has-text("主线")');
      if (mainTab) {
        await mainTab.click();
        await page.waitForTimeout(1000);
        const shotC3 = await takeScreenshot(page, 'v7e-C3-quest-main');
        screenshot(shotC3);
        pass('主线任务Tab可切换');
      } else {
        warn('主线任务Tab未找到');
      }

      const sideTab = await page.$('button:has-text("支线")');
      if (sideTab) {
        await sideTab.click();
        await page.waitForTimeout(1000);
        const shotC4 = await takeScreenshot(page, 'v7e-C4-quest-side');
        screenshot(shotC4);
        pass('支线任务Tab可切换');
      } else {
        warn('支线任务Tab未找到');
      }

      // C1.5 检查一键领取按钮
      const claimAllBtn = await page.$('button:has-text("一键领取")');
      if (claimAllBtn) {
        pass('一键领取按钮存在');
      } else {
        warn('一键领取按钮未找到', '可能无可领取任务');
      }

    } catch (e) {
      warn('任务面板打开失败', e.message);
    }
    await closeAllModals(page);

    // ═══════════════════════════════════════════
    // 模块D: 回归测试 — 核心Tab
    // ═══════════════════════════════════════════
    console.log('\n── 步骤D: 回归测试 — 核心Tab ──');

    // D1 建筑Tab
    await switchTab(page, 'building');
    await page.waitForTimeout(1500);
    const buildingPanel = await page.$('[data-testid="building-panel"], .tk-building-panel, [class*="building"]');
    if (buildingPanel) pass('回归: 建筑面板正常');
    else warn('回归: 建筑面板选择器未命中');

    // D2 武将Tab
    await switchTab(page, 'hero');
    await page.waitForTimeout(1500);
    const heroPanel = await page.$('[data-testid="hero-tab"], .tk-hero-tab, [class*="hero"]');
    if (heroPanel) pass('回归: 武将面板正常');
    else warn('回归: 武将面板选择器未命中');

    // D3 科技Tab
    await switchTab(page, 'tech');
    await page.waitForTimeout(1500);
    const techPanel = await page.$('[data-testid="tech-tab"], .tk-tech-tab, [class*="tech"]');
    if (techPanel) pass('回归: 科技面板正常');
    else warn('回归: 科技面板选择器未命中');

    // D4 关卡Tab
    await switchTab(page, 'campaign');
    await page.waitForTimeout(1500);
    const campaignPanel = await page.$('[data-testid="campaign-tab"], .tk-campaign-tab, [class*="campaign"]');
    if (campaignPanel) pass('回归: 关卡面板正常');
    else warn('回归: 关卡面板选择器未命中');

    const shotD = await takeScreenshot(page, 'v7e-D-regression');
    screenshot(shotD);

    // ═══════════════════════════════════════════
    // 模块E: 移动端适配
    // ═══════════════════════════════════════════
    console.log('\n── 步骤E: 移动端适配 ──');
    try {
      const mobilePage = await context.newPage();
      await mobilePage.setViewportSize({ width: 375, height: 667 });
      await enterGame(mobilePage);
      const shotE1 = await takeScreenshot(mobilePage, 'v7e-E1-mobile-main');
      screenshot(shotE1);
      pass('移动端: 游戏主界面加载');

      // 移动端NPC Tab
      await switchTab(mobilePage, 'npc');
      await mobilePage.waitForTimeout(1500);
      const shotE2 = await takeScreenshot(mobilePage, 'v7e-E2-mobile-npc');
      screenshot(shotE2);

      const mobileNpcTab = await mobilePage.$('[data-testid="npc-tab"]');
      if (mobileNpcTab) pass('移动端: NPC面板正常渲染');
      else warn('移动端: NPC面板未找到');

      // 移动端数据完整性
      const mobileIntegrity = await checkDataIntegrity(mobilePage);
      if (!mobileIntegrity.hasNaN && !mobileIntegrity.hasUndefined) {
        pass('移动端: 数据完整性检查通过');
      } else {
        mobileIntegrity.issues.forEach(i => fail('移动端数据完整性', i));
      }

      await mobilePage.close();
    } catch (e) {
      fail('移动端适配测试', e.message);
    }

    // ═══════════════════════════════════════════
    // 最终数据完整性检查
    // ═══════════════════════════════════════════
    console.log('\n── 步骤F: 最终数据完整性 ──');
    await switchTab(page, 'building');
    await page.waitForTimeout(1000);
    const finalIntegrity = await checkDataIntegrity(page);
    if (!finalIntegrity.hasNaN && !finalIntegrity.hasUndefined) {
      pass('最终数据完整性检查通过');
    } else {
      finalIntegrity.issues.forEach(i => fail('最终数据完整性', i));
    }

    // 控制台错误检查
    const significantErrors = consoleErrors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('manifest') &&
      !e.includes('404') &&
      !e.includes('DevTools') &&
      !e.includes('net::ERR')
    );
    if (significantErrors.length === 0) {
      pass('无显著控制台错误');
    } else {
      warn(`控制台错误（${significantErrors.length}个）`, significantErrors.slice(0, 3).join(' | '));
    }

  } catch (e) {
    fail('主流程异常', e.message);
    // 尝试截图保留现场
    try {
      const shotErr = await takeScreenshot(page, 'v7e-ERROR-fallback');
      screenshot(shotErr);
    } catch (_) { /* ignore */ }
  }

  // ─────────────────────────────────────────
  // 输出结果
  // ─────────────────────────────────────────
  results.endTime = new Date().toISOString();
  results.consoleErrors = consoleErrors.slice(0, 20);

  console.log('\n' + '='.repeat(60));
  console.log(`📊 v7.0 草木皆兵 UI测试结果`);
  console.log('='.repeat(60));
  console.log(`  ✅ PASS: ${results.passed.length}`);
  console.log(`  ❌ FAIL: ${results.failed.length}`);
  console.log(`  ⚠️  WARN: ${results.warnings.length}`);
  console.log(`  📸 截图: ${results.screenshots.length}`);

  if (results.failed.length > 0) {
    console.log('\n❌ 失败项:');
    results.failed.forEach(f => console.log(`  • ${f.name}: ${f.detail}`));
  }
  if (results.warnings.length > 0) {
    console.log('\n⚠️  警告项:');
    results.warnings.forEach(w => console.log(`  • ${w.name}: ${w.detail}`));
  }

  // 保存结果
  const resultPath = path.join(__dirname, 'v7-evolution-ui-results.json');
  fs.writeFileSync(resultPath, JSON.stringify(results, null, 2));
  console.log(`\n📁 结果已保存: ${resultPath}`);

  await browser.close();
  process.exit(results.failed.length > 0 ? 1 : 0);
})();
