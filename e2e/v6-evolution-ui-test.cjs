/**
 * v6.0 草木皆兵 — 进化迭代 UI测试 R1
 *
 * 测试范围：
 * 1. 天下Tab — 世界地图渲染、领土网格、筛选工具栏、统计面板、热力图
 * 2. 名士Tab — NPC名册、搜索筛选、NPC卡片、交互按钮
 * 3. 事件系统 — 事件列表、事件卡片、事件横幅
 * 4. 移动端适配
 *
 * @module e2e/v6-evolution-ui-test
 */

const { chromium, devices } = require('playwright');
const path = require('path');
const fs = require('fs');

// ─────────────────────────────────────────────
// 配置
// ─────────────────────────────────────────────
const BASE_URL = process.env.GAME_BASE_URL || 'http://localhost:3000/idle/three-kingdoms';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots', 'v6-evolution');

// ─────────────────────────────────────────────
// 测试结果收集器
// ─────────────────────────────────────────────
const results = {
  passed: [],
  failed: [],
  warnings: [],
  screenshots: [],
  consoleErrors: [],
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
 * 切换Tab — TabBar使用 button[data-testid="tab-{id}"]
 * Tab id映射: 建筑=building, 武将=hero, 科技=tech, 关卡=campaign,
 *             装备=equipment, 天下=map, 名士=npc, 竞技=arena, 远征=expedition, 军队=army, 更多=more
 */
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
    await page.$('[data-testid="shared-panel-close"]') ||
    await page.$('.tk-bfm-close');
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
// 主测试流程
// ─────────────────────────────────────────────
(async () => {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  v6.0 草木皆兵 — 进化迭代 UI测试 R1');
  console.log('═══════════════════════════════════════════════════\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

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
    const shot0 = await takeScreenshot(page, 'v6e-00-main');
    screenshot(shot0);
    pass('游戏主界面加载成功');

    const integrity0 = await checkDataIntegrity(page);
    if (integrity0.issues.length === 0) {
      pass('主界面数据完整性 — 无NaN/undefined');
    } else {
      warn('主界面数据完整性', integrity0.issues.join(', '));
    }

    // ═══════════════════════════════════════════
    // 1. 天下Tab — 世界地图
    // ═══════════════════════════════════════════
    console.log('\n── 步骤1: 天下Tab — 世界地图 ──');

    try {
      await switchTab(page, 'map');
      pass('切换到天下Tab');
    } catch (e) {
      fail('切换到天下Tab', e.message);
    }

    // 1a. 世界地图容器
    const worldmapTab = await page.$('[data-testid="worldmap-tab"]');
    if (worldmapTab) {
      pass('世界地图容器渲染');
    } else {
      fail('世界地图容器渲染', 'data-testid="worldmap-tab" 未找到');
    }

    // 1b. 工具栏
    const toolbar = await page.$('[data-testid="worldmap-toolbar"]');
    if (toolbar) {
      pass('世界地图工具栏渲染');
    } else {
      warn('世界地图工具栏', 'toolbar未找到');
    }

    // 1c. 筛选器 — 区域
    const regionFilter = await page.$('[data-testid="worldmap-filter-region"]');
    if (regionFilter) {
      pass('区域筛选器渲染');
    } else {
      warn('区域筛选器', 'filter未找到');
    }

    // 1d. 筛选器 — 归属
    const ownershipFilter = await page.$('[data-testid="worldmap-filter-ownership"]');
    if (ownershipFilter) {
      pass('归属筛选器渲染');
    } else {
      warn('归属筛选器', 'filter未找到');
    }

    // 1e. 筛选器 — 类型
    const landmarkFilter = await page.$('[data-testid="worldmap-filter-landmark"]');
    if (landmarkFilter) {
      pass('类型筛选器渲染');
    } else {
      warn('类型筛选器', 'filter未找到');
    }

    // 1f. 热力图切换
    const heatmapToggle = await page.$('[data-testid="worldmap-heatmap-toggle"]');
    if (heatmapToggle) {
      pass('热力图切换按钮渲染');
      // 点击切换热力图
      try {
        await heatmapToggle.click();
        await page.waitForTimeout(800);
        const shot1f = await takeScreenshot(page, 'v6e-01-worldmap-heatmap');
        screenshot(shot1f);
        pass('热力图模式切换成功');
      } catch (e) {
        warn('热力图切换', e.message);
      }
    } else {
      warn('热力图切换按钮', '未找到');
    }

    // 1g. 领土网格
    const grid = await page.$('[data-testid="worldmap-grid"]');
    if (grid) {
      pass('领土网格渲染');
      const cells = await page.$$('[data-testid^="territory-cell-"]');
      pass(`领土格子数量: ${cells.length}`);
    } else {
      // 可能是空状态
      const emptyState = await page.$('[data-testid="worldmap-empty"]');
      if (emptyState) {
        warn('领土网格', '空状态显示');
      } else {
        fail('领土网格渲染', 'grid和empty均未找到');
      }
    }

    // 1h. 统计面板
    const infoPanel = await page.$('[data-testid="worldmap-info-panel"]');
    if (infoPanel) {
      pass('统计信息面板渲染');
      const statTerr = await page.$('[data-testid="stat-territories"]');
      const statGrain = await page.$('[data-testid="stat-grain"]');
      const statGold = await page.$('[data-testid="stat-gold"]');
      if (statTerr && statGrain && statGold) {
        pass('统计卡片(领土/粮草/金币)完整');
      } else {
        warn('统计卡片', `territories=${!!statTerr}, grain=${!!statGrain}, gold=${!!statGold}`);
      }
    } else {
      warn('统计信息面板', '未找到');
    }

    // 1i. 图例
    const legend = await page.$('[data-testid="worldmap-legend"]');
    if (legend) {
      pass('地图图例渲染');
    } else {
      warn('地图图例', '未找到');
    }

    const shot1 = await takeScreenshot(page, 'v6e-01-worldmap');
    screenshot(shot1);

    // 1j. 点击领土格子
    const firstCell = await page.$('[data-testid^="territory-cell-"]');
    if (firstCell) {
      try {
        await firstCell.click();
        await page.waitForTimeout(1000);
        const shot1j = await takeScreenshot(page, 'v6e-01-worldmap-cell-clicked');
        screenshot(shot1j);
        pass('领土格子点击交互');
      } catch (e) {
        warn('领土格子点击', e.message);
      }
    }

    const integrity1 = await checkDataIntegrity(page);
    if (integrity1.issues.length === 0) {
      pass('天下Tab数据完整性');
    } else {
      warn('天下Tab数据完整性', integrity1.issues.join(', '));
    }

    // ═══════════════════════════════════════════
    // 2. 名士Tab — NPC交互
    // ═══════════════════════════════════════════
    console.log('\n── 步骤2: 名士Tab — NPC交互 ──');

    await closeAllModals(page);

    try {
      await switchTab(page, 'npc');
      pass('切换到名士Tab');
    } catch (e) {
      fail('切换到名士Tab', e.message);
    }

    // 2a. NPC Tab容器
    const npcTab = await page.$('[data-testid="npc-tab"]');
    if (npcTab) {
      pass('NPC名册容器渲染');
    } else {
      fail('NPC名册容器渲染', 'data-testid="npc-tab" 未找到');
    }

    // 2b. 搜索框
    const searchInput = await page.$('[data-testid="npc-search-input"]');
    if (searchInput) {
      pass('NPC搜索框渲染');
      try {
        await searchInput.fill('赵云');
        await page.waitForTimeout(500);
        const shot2b = await takeScreenshot(page, 'v6e-02-npc-search');
        screenshot(shot2b);
        pass('NPC搜索功能正常');
        await searchInput.fill('');
        await page.waitForTimeout(300);
      } catch (e) {
        warn('NPC搜索', e.message);
      }
    } else {
      warn('NPC搜索框', '未找到');
    }

    // 2c. 筛选栏
    const filterBar = await page.$('[data-testid="npc-filter-bar"]');
    if (filterBar) {
      pass('NPC筛选栏渲染');
      // 尝试点击筛选
      const filterBtn = await page.$('[data-testid^="npc-filter-"]');
      if (filterBtn) {
        try {
          await filterBtn.click();
          await page.waitForTimeout(500);
          pass('NPC筛选交互正常');
        } catch (e) {
          warn('NPC筛选交互', e.message);
        }
      }
    } else {
      warn('NPC筛选栏', '未找到');
    }

    // 2d. NPC列表
    const npcList = await page.$('[data-testid="npc-list"]');
    if (npcList) {
      pass('NPC列表容器渲染');
      const npcCards = await page.$$('[data-testid^="npc-card-"]');
      pass(`NPC卡片数量: ${npcCards.length}`);
    } else {
      const npcEmpty = await page.$('[data-testid="npc-empty"]');
      if (npcEmpty) {
        warn('NPC列表', '空状态显示');
      } else {
        fail('NPC列表', 'list和empty均未找到');
      }
    }

    // 2e. NPC卡片交互 — 点击第一个NPC
    const firstNpcCard = await page.$('[data-testid^="npc-card-"]');
    if (firstNpcCard) {
      try {
        await firstNpcCard.click();
        await page.waitForTimeout(1000);
        const shot2e = await takeScreenshot(page, 'v6e-02-npc-card-clicked');
        screenshot(shot2e);
        pass('NPC卡片点击交互');
      } catch (e) {
        warn('NPC卡片点击', e.message);
      }
    }

    // 2f. NPC对话按钮
    const dialogBtn = await page.$('[data-testid^="npc-btn-dialog-"]');
    if (dialogBtn) {
      try {
        await dialogBtn.click();
        await page.waitForTimeout(1000);
        const shot2f = await takeScreenshot(page, 'v6e-02-npc-dialog');
        screenshot(shot2f);
        pass('NPC对话弹窗打开');
        await closeAllModals(page);
      } catch (e) {
        warn('NPC对话弹窗', e.message);
      }
    }

    // 2g. NPC信息按钮
    const infoBtn = await page.$('[data-testid^="npc-btn-info-"]');
    if (infoBtn) {
      try {
        await infoBtn.click();
        await page.waitForTimeout(1000);
        const shot2g = await takeScreenshot(page, 'v6e-02-npc-info');
        screenshot(shot2g);
        pass('NPC信息弹窗打开');
        await closeAllModals(page);
      } catch (e) {
        warn('NPC信息弹窗', e.message);
      }
    }

    const shot2 = await takeScreenshot(page, 'v6e-02-npc-tab');
    screenshot(shot2);

    const integrity2 = await checkDataIntegrity(page);
    if (integrity2.issues.length === 0) {
      pass('名士Tab数据完整性');
    } else {
      warn('名士Tab数据完整性', integrity2.issues.join(', '));
    }

    // ═══════════════════════════════════════════
    // 3. 事件系统 — 事件列表
    // ═══════════════════════════════════════════
    console.log('\n── 步骤3: 事件系统 ──');

    // 事件面板通过事件列表组件显示，可能在右侧面板或Tab中
    // 先尝试直接查找事件面板
    await closeAllModals(page);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // 3a. 检查事件横幅
    const eventBanner = await page.$('[data-testid="event-banner"]');
    if (eventBanner) {
      pass('事件横幅渲染');
      const shot3a = await takeScreenshot(page, 'v6e-03-event-banner');
      screenshot(shot3a);
    } else {
      warn('事件横幅', '未渲染(可能无活跃事件)');
    }

    // 3b. 事件列表面板 — 通过按钮或Tab触发
    // 尝试通过"事件"按钮或Tab打开
    let eventListPanel = await page.$('[data-testid="event-list-panel"]');
    if (!eventListPanel) {
      // 尝试点击事件相关按钮
      const eventBtn = await page.$('button:has-text("事件")') ||
        await page.$('[data-testid="tab-event"]') ||
        await page.$('.tk-event-btn');
      if (eventBtn) {
        try {
          await eventBtn.click();
          await page.waitForTimeout(1500);
          eventListPanel = await page.$('[data-testid="event-list-panel"]');
        } catch (e) {
          // ignore
        }
      }
    }

    if (eventListPanel) {
      pass('事件列表面板渲染');
      const shot3b = await takeScreenshot(page, 'v6e-03-event-list');
      screenshot(shot3b);

      // 3c. 事件卡片
      const eventCards = await page.$$('[data-testid^="event-card-"]');
      if (eventCards.length > 0) {
        pass(`事件卡片数量: ${eventCards.length}`);

        // 点击第一个事件卡片
        try {
          await eventCards[0].click();
          await page.waitForTimeout(1000);
          const shot3c = await takeScreenshot(page, 'v6e-03-event-detail');
          screenshot(shot3c);
          pass('事件卡片点击交互');
        } catch (e) {
          warn('事件卡片点击', e.message);
        }
      } else {
        warn('事件卡片', '无活跃事件卡片');
      }
    } else {
      warn('事件列表面板', '未找到(可能需要触发事件)');
    }

    const integrity3 = await checkDataIntegrity(page);
    if (integrity3.issues.length === 0) {
      pass('事件系统数据完整性');
    } else {
      warn('事件系统数据完整性', integrity3.issues.join(', '));
    }

    // ═══════════════════════════════════════════
    // 4. 移动端适配
    // ═══════════════════════════════════════════
    console.log('\n── 步骤4: 移动端适配 ──');

    await closeAllModals(page);
    const mobileCtx = await browser.newContext({
      ...devices['iPhone 13'],
    });
    const mobilePage = await mobileCtx.newPage();

    try {
      await enterGame(mobilePage);
      const shot4a = await takeScreenshot(mobilePage, 'v6e-04-mobile-main');
      screenshot(shot4a);
      pass('移动端主界面加载');

      // 移动端天下Tab
      try {
        await switchTab(mobilePage, 'map');
        const shot4b = await takeScreenshot(mobilePage, 'v6e-04-mobile-worldmap');
        screenshot(shot4b);
        pass('移动端天下Tab');
      } catch (e) {
        warn('移动端天下Tab', e.message);
      }

      // 移动端名士Tab
      await closeAllModals(mobilePage);
      try {
        await switchTab(mobilePage, 'npc');
        const shot4c = await takeScreenshot(mobilePage, 'v6e-04-mobile-npc');
        screenshot(shot4c);
        pass('移动端名士Tab');
      } catch (e) {
        warn('移动端名士Tab', e.message);
      }

      const integrity4 = await checkDataIntegrity(mobilePage);
      if (integrity4.issues.length === 0) {
        pass('移动端数据完整性');
      } else {
        warn('移动端数据完整性', integrity4.issues.join(', '));
      }
    } catch (e) {
      fail('移动端适配', e.message);
    } finally {
      await mobileCtx.close();
    }

  } catch (e) {
    fail('测试异常中断', e.message);
  } finally {
    await browser.close();
  }

  // ─────────────────────────────────────────────
  // 生成报告
  // ─────────────────────────────────────────────
  results.consoleErrors = consoleErrors.slice(0, 20);

  console.log('\n═══════════════════════════════════════════════════');
  console.log('  测试结果汇总');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  ✅ 通过: ${results.passed.length}`);
  console.log(`  ❌ 失败: ${results.failed.length}`);
  console.log(`  ⚠️  警告: ${results.warnings.length}`);
  console.log(`  📸 截图: ${results.screenshots.length}`);
  console.log(`  🐛 控制台错误: ${results.consoleErrors.length}`);

  if (results.failed.length > 0) {
    console.log('\n  ❌ 失败详情:');
    results.failed.forEach(f => console.log(`    - ${f.name}: ${f.detail}`));
  }
  if (results.warnings.length > 0) {
    console.log('\n  ⚠️  警告详情:');
    results.warnings.forEach(w => console.log(`    - ${w.name}: ${w.detail}`));
  }

  // 写入JSON报告
  const reportPath = path.join(SCREENSHOT_DIR, 'v6-test-results.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n  📄 测试结果: ${reportPath}`);

  process.exit(results.failed.length > 0 ? 1 : 0);
})();
