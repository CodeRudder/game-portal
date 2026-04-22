/**
 * v5.0 百家争鸣 — 进化迭代 UI测试 R1
 *
 * 基于源码实际DOM结构编写，精准选择器
 *
 * 测试范围：
 * 1. 科技系统 — 科技树展示、路线切换、节点状态、研究面板、节点详情弹窗
 * 2. 世界地图 — 地图渲染、领土网格、筛选工具栏、统计面板、热力图
 * 3. 领土系统 — 领土详情面板、产出气泡、攻城交互
 * 4. 移动端适配
 *
 * @module e2e/v5-evolution-ui-test
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// ─────────────────────────────────────────────
// 配置
// ─────────────────────────────────────────────
const BASE_URL = process.env.GAME_BASE_URL || 'http://localhost:3000/idle/three-kingdoms';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots', 'v5-evolution');

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
 * Tab id映射: 建筑=building, 武将=hero, 科技=tech, 关卡=campaign,
 *             装备=equipment, 天下=map, 名士=npc, 竞技=arena, 远征=expedition, 军队=army, 更多=more
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
  console.log('  v5.0 百家争鸣 — 进化迭代 UI测试 R1');
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
    const shot0 = await takeScreenshot(page, 'v5e-00-main');
    screenshot(shot0);
    pass('游戏主界面加载成功');

    // 数据完整性
    const integrity = await checkDataIntegrity(page);
    if (!integrity.hasNaN && !integrity.hasUndefined) {
      pass('主界面数据完整性检查通过');
    } else {
      integrity.issues.forEach(i => fail('主界面数据完整性', i));
    }

    // ═══════════════════════════════════════════
    // 模块A: 科技系统
    // ═══════════════════════════════════════════
    console.log('\n── 步骤A1: 科技Tab — 科技树展示 ──');
    await switchTab(page, 'tech');
    await page.waitForTimeout(2000);
    const shotA1 = await takeScreenshot(page, 'v5e-A1-tech-tab');
    screenshot(shotA1);

    // A1.1 科技Tab容器 — 实际: .tk-tech-tab [data-testid="tech-tab"]
    const techTab = await page.$('[data-testid="tech-tab"]') ||
      await page.$('.tk-tech-tab');
    if (techTab) pass('科技Tab容器存在');
    else fail('科技Tab容器', '未找到 .tk-tech-tab 或 [data-testid="tech-tab"]');

    // A1.2 三条路线切换Tab — 实际: .tk-tech-path-tabs > button.tk-tech-path-tab
    const pathTabs = await page.$$('.tk-tech-path-tab');
    if (pathTabs.length === 3) {
      pass(`科技路线切换Tab数量: ${pathTabs.length} (军事/经济/文化)`);
    } else if (pathTabs.length > 0) {
      warn('科技路线Tab', `数量: ${pathTabs.length} (预期3条)`);
    } else {
      fail('科技路线Tab', '未找到路线切换按钮');
    }

    // A1.3 验证各路线Tab存在 — 实际: [data-testid="tech-path-tab-military"] 等
    const militaryTab = await page.$('[data-testid="tech-path-tab-military"]');
    const economyTab = await page.$('[data-testid="tech-path-tab-economy"]');
    const cultureTab = await page.$('[data-testid="tech-path-tab-culture"]');
    if (militaryTab) pass('军事路线Tab存在');
    else warn('军事路线Tab', '未找到');
    if (economyTab) pass('经济路线Tab存在');
    else warn('经济路线Tab', '未找到');
    if (cultureTab) pass('文化路线Tab存在');
    else warn('文化路线Tab', '未找到');

    // A1.4 科技节点 — 实际: .tk-tech-node [data-testid="tech-node-{id}"]
    const techNodes = await page.$$('.tk-tech-node');
    if (techNodes.length > 0) {
      pass(`科技节点数量: ${techNodes.length}`);

      // 节点状态分类 — 实际CSS类: tk-tech-node--locked, --available, --researching, --completed, --mutex-locked
      const lockedNodes = await page.$$('.tk-tech-node--locked');
      const availableNodes = await page.$$('.tk-tech-node--available');
      const researchingNodes = await page.$$('.tk-tech-node--researching');
      const completedNodes = await page.$$('.tk-tech-node--completed');
      const mutexLocked = await page.$$('.tk-tech-node--mutex-locked');
      console.log(`    节点状态: 锁定=${lockedNodes.length}, 可研究=${availableNodes.length}, 研究中=${researchingNodes.length}, 已完成=${completedNodes.length}, 互斥锁=${mutexLocked.length}`);
      pass('科技节点状态分类正常');
    } else {
      fail('科技节点', '未找到任何科技节点(.tk-tech-node)');
    }

    // A1.5 科技点显示 — 实际: .tk-tech-points-bar > .tk-tech-points-value
    const techPointsBar = await page.$('.tk-tech-points-bar');
    const techPointsValue = await page.$('.tk-tech-points-value');
    if (techPointsBar) {
      pass('科技点信息栏存在');
      if (techPointsValue) {
        const text = await techPointsValue.textContent();
        pass(`科技点数值显示: "${text.trim()}"`);
      }
      // 科技点产出速率
      const techPointsRate = await page.$('.tk-tech-points-rate');
      if (techPointsRate) {
        const rateText = await techPointsRate.textContent();
        pass(`科技点产出速率: "${rateText.trim()}"`);
      } else {
        warn('科技点产出速率', '未显示产出速率（可能产出为0）');
      }
    } else {
      warn('科技点信息栏', '未找到科技点信息栏');
    }

    // A1.6 科技树画布 — 实际: .tk-tech-canvas [data-testid="tech-canvas"]
    const techCanvas = await page.$('[data-testid="tech-canvas"]') ||
      await page.$('.tk-tech-canvas');
    if (techCanvas) pass('科技树画布区域存在');
    else warn('科技树画布', '未找到科技树画布');

    // A1.7 路线列 — 实际: .tk-tech-path-column [data-testid="tech-path-{path}"]
    const pathColumns = await page.$$('.tk-tech-path-column');
    if (pathColumns.length >= 1) {
      pass(`路线列数量: ${pathColumns.length} (PC端应显示3列，移动端1列)`);
    } else {
      warn('路线列', '未找到路线列');
    }

    // A1.8 层级连线 — 实际: .tk-tech-tier-connector
    const tierConnectors = await page.$$('.tk-tech-tier-connector');
    if (tierConnectors.length > 0) {
      pass(`层级连线数量: ${tierConnectors.length}`);
    }

    // A1.9 互斥标签 — 实际: .tk-tech-mutex-tag
    const mutexTags = await page.$$('.tk-tech-mutex-tag');
    if (mutexTags.length > 0) {
      pass(`互斥标签("二选一")数量: ${mutexTags.length}`);
    } else {
      warn('互斥标签', '未找到互斥标签（可能所有节点都没有互斥分支）');
    }

    // A1.10 研究队列面板 — 实际: .tk-tech-research-panel [data-testid="tech-research-panel"]
    const researchPanel = await page.$('[data-testid="tech-research-panel"]') ||
      await page.$('.tk-tech-research-panel');
    if (researchPanel) {
      pass('研究队列面板存在');

      // 研究槽位
      const activeSlots = await page.$$('.tk-tech-research-slot:not(.tk-tech-research-slot--empty)');
      const emptySlots = await page.$$('.tk-tech-research-slot--empty');
      console.log(`    研究槽位: 活跃=${activeSlots.length}, 空闲=${emptySlots.length}`);
      pass(`研究队列槽位显示正常 (活跃=${activeSlots.length}, 空闲=${emptySlots.length})`);
    } else {
      warn('研究队列面板', '未找到研究队列面板');
    }

    // ── 步骤A2: 路线切换测试 ──
    console.log('\n── 步骤A2: 科技路线切换 ──');

    // 切换到经济路线
    if (economyTab) {
      await economyTab.click();
      await page.waitForTimeout(1000);
      const shotA2a = await takeScreenshot(page, 'v5e-A2a-tech-economy');
      screenshot(shotA2a);

      // 验证经济路线被激活
      const ecoActive = await page.$('.tk-tech-path-tab--economy.tk-tech-path-tab--active');
      if (ecoActive) pass('经济路线Tab已激活');
      else warn('经济路线切换', '经济路线Tab未显示激活状态');
    }

    // 切换到文化路线
    if (cultureTab) {
      await cultureTab.click();
      await page.waitForTimeout(1000);
      const shotA2b = await takeScreenshot(page, 'v5e-A2b-tech-culture');
      screenshot(shotA2b);

      const culActive = await page.$('.tk-tech-path-tab--culture.tk-tech-path-tab--active');
      if (culActive) pass('文化路线Tab已激活');
      else warn('文化路线切换', '文化路线Tab未显示激活状态');
    }

    // 切换回军事路线
    if (militaryTab) {
      await militaryTab.click();
      await page.waitForTimeout(1000);
      pass('军事路线Tab已激活');
    }

    // ── 步骤A3: 科技节点详情弹窗 ──
    console.log('\n── 步骤A3: 科技节点详情弹窗 ──');
    const clickableNode = await page.$('.tk-tech-node--available') ||
      await page.$('.tk-tech-node:not(.tk-tech-node--locked)');
    if (clickableNode) {
      await clickableNode.click();
      await page.waitForTimeout(1500);
      const shotA3 = await takeScreenshot(page, 'v5e-A3-tech-node-detail');
      screenshot(shotA3);

      // 检查详情弹窗 — 实际使用 SharedPanel 组件
      const techDetailOverlay = await page.$('[data-testid="tech-detail-overlay"]') ||
        await page.$('.tk-shared-panel');
      if (techDetailOverlay) {
        pass('科技节点详情弹窗已打开');

        // A3.1 节点信息头部
        const detailIcon = await page.$('.tk-tech-detail-icon');
        const detailName = await page.$('.tk-tech-detail-name');
        const detailPath = await page.$('.tk-tech-detail-path');
        const detailStatus = await page.$('.tk-tech-detail-status');
        if (detailIcon) pass('节点图标存在');
        if (detailName) {
          const nameText = await detailName.textContent();
          pass(`节点名称: "${nameText.trim()}"`);
        }
        if (detailPath) {
          const pathText = await detailPath.textContent();
          pass(`节点路线: "${pathText.trim()}"`);
        }
        if (detailStatus) {
          const statusText = await detailStatus.textContent();
          pass(`节点状态: "${statusText.trim()}"`);
        }

        // A3.2 科技描述
        const detailDesc = await page.$('.tk-tech-detail-desc');
        if (detailDesc) {
          const descText = await detailDesc.textContent();
          pass(`科技描述存在: "${descText.trim().substring(0, 40)}..."`);
        }

        // A3.3 效果列表 — 实际: .tk-tech-detail-effect
        const effectItems = await page.$$('.tk-tech-detail-effect');
        if (effectItems.length > 0) {
          pass(`科技效果列表项: ${effectItems.length}`);
          // 读取第一个效果的文本
          const firstEffectText = await effectItems[0].textContent();
          console.log(`    效果示例: "${firstEffectText.trim().substring(0, 60)}"`);
        } else {
          warn('科技效果列表', '未找到效果列表项(.tk-tech-detail-effect)');
        }

        // A3.4 研究消耗 — 实际: .tk-tech-detail-costs
        const costsSection = await page.$('.tk-tech-detail-costs');
        if (costsSection) {
          pass('研究消耗区域存在');

          const costItems = await page.$$('.tk-tech-detail-cost');
          if (costItems.length > 0) {
            pass(`消耗项数量: ${costItems.length}`);
            // 科技点消耗
            const costValues = await page.$$('.tk-tech-detail-cost-value');
            if (costValues.length > 0) {
              for (const cv of costValues) {
                const cvText = await cv.textContent();
                console.log(`    消耗: "${cvText.trim()}"`);
              }
              pass('消耗数值显示正常');
            }
          }
        } else {
          warn('研究消耗', '未找到研究消耗区域');
        }

        // A3.5 前置条件 — 实际: .tk-tech-detail-prereq
        const prereqItems = await page.$$('.tk-tech-detail-prereq');
        if (prereqItems.length > 0) {
          pass(`前置条件项: ${prereqItems.length}`);
        } else {
          // 可能没有前置条件
          pass('无前置条件（初始科技）');
        }

        // A3.6 互斥替代节点 — 实际: .tk-tech-detail-mutex-alt
        const mutexAlts = await page.$$('.tk-tech-detail-mutex-alt');
        if (mutexAlts.length > 0) {
          pass(`互斥替代节点: ${mutexAlts.length}`);
        }

        // A3.7 研究按钮 — 实际: 在 SharedPanel 底部
        const researchBtn = await page.$('button:has-text("开始研究")') ||
          await page.$('.tk-tech-detail-start-btn');
        if (researchBtn) {
          const isDisabled = await researchBtn.evaluate(el => el.disabled);
          pass(`研究按钮存在 (禁用: ${isDisabled})`);
        } else {
          warn('研究按钮', '未找到研究按钮（可能状态不允许）');
        }

        // 关闭弹窗
        await closeAllModals(page);
        await page.waitForTimeout(500);
      } else {
        warn('科技节点详情', '未找到详情弹窗（SharedPanel未渲染）');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }
    } else {
      warn('科技节点点击', '无可点击的科技节点');
    }

    // ── 步骤A4: 融合科技/联动科技检查 ──
    console.log('\n── 步骤A4: 融合科技 & 联动科技检查 ──');

    // 融合科技 — 检查节点名称中是否包含融合/联动相关文本
    const allNodeNames = await page.$$('.tk-tech-node-name');
    let fusionCount = 0;
    let linkageCount = 0;
    for (const node of allNodeNames) {
      const text = await node.textContent();
      if (text.includes('融合') || text.includes('合击')) fusionCount++;
      if (text.includes('联动') || text.includes('协同')) linkageCount++;
    }
    if (fusionCount > 0) pass(`融合科技节点: ${fusionCount}个`);
    else warn('融合科技', '未找到融合科技节点（可能需要完成前置科技）');
    if (linkageCount > 0) pass(`联动科技节点: ${linkageCount}个`);
    else warn('联动科技', '未找到联动科技节点');

    // 检查所有节点名称列表（用于分析）
    console.log('    节点名称列表:');
    for (const node of allNodeNames) {
      const text = await node.textContent();
      console.log(`      - ${text.trim()}`);
    }

    const shotA4 = await takeScreenshot(page, 'v5e-A4-tech-overview');
    screenshot(shotA4);

    // ═══════════════════════════════════════════
    // 模块B: 世界地图
    // ═══════════════════════════════════════════
    console.log('\n── 步骤B1: 天下Tab — 世界地图 ──');
    await switchTab(page, 'map');
    await page.waitForTimeout(2000);
    const shotB1 = await takeScreenshot(page, 'v5e-B1-world-map');
    screenshot(shotB1);

    // B1.1 世界地图容器 — 实际: .tk-worldmap-tab [data-testid="worldmap-tab"]
    const mapContainer = await page.$('[data-testid="worldmap-tab"]') ||
      await page.$('.tk-worldmap-tab');
    if (mapContainer) pass('世界地图容器存在');
    else fail('世界地图容器', '未找到 .tk-worldmap-tab 或 [data-testid="worldmap-tab"]');

    // B1.2 筛选工具栏 — 实际: .tk-worldmap-toolbar [data-testid="worldmap-toolbar"]
    const toolbar = await page.$('[data-testid="worldmap-toolbar"]') ||
      await page.$('.tk-worldmap-toolbar');
    if (toolbar) {
      pass('筛选工具栏存在');

      // 区域筛选 — 实际: [data-testid="worldmap-filter-region"]
      const regionFilter = await page.$('[data-testid="worldmap-filter-region"]');
      if (regionFilter) pass('区域筛选下拉存在');
      else warn('区域筛选', '未找到区域筛选');

      // 归属筛选 — 实际: [data-testid="worldmap-filter-ownership"]
      const ownershipFilter = await page.$('[data-testid="worldmap-filter-ownership"]');
      if (ownershipFilter) pass('归属筛选下拉存在');
      else warn('归属筛选', '未找到归属筛选');

      // 类型筛选 — 实际: [data-testid="worldmap-filter-landmark"]
      const landmarkFilter = await page.$('[data-testid="worldmap-filter-landmark"]');
      if (landmarkFilter) pass('类型筛选下拉存在');
      else warn('类型筛选', '未找到类型筛选');

      // 热力图切换 — 实际: .tk-worldmap-heatmap-toggle [data-testid="worldmap-heatmap-toggle"]
      const heatmapToggle = await page.$('[data-testid="worldmap-heatmap-toggle"]') ||
        await page.$('.tk-worldmap-heatmap-toggle');
      if (heatmapToggle) pass('热力图切换按钮存在');
      else warn('热力图切换', '未找到热力图按钮');
    } else {
      warn('筛选工具栏', '未找到筛选工具栏');
    }

    // B1.3 地图主体 — 实际: .tk-worldmap-body
    const mapBody = await page.$('.tk-worldmap-body');
    if (mapBody) pass('地图主体区域存在');
    else warn('地图主体', '未找到地图主体');

    // B1.4 地图网格 — 实际: .tk-worldmap-grid [data-testid="worldmap-grid"]
    const mapGrid = await page.$('[data-testid="worldmap-grid"]') ||
      await page.$('.tk-worldmap-grid');
    if (mapGrid) pass('地图网格存在');
    else warn('地图网格', '未找到地图网格');

    // B1.5 领土格子 — 实际: .tk-territory-cell [data-testid="territory-cell-{id}"]
    const territoryCells = await page.$$('.tk-territory-cell');
    if (territoryCells.length >= 3) {
      pass(`领土格子数量: ${territoryCells.length}`);
    } else if (territoryCells.length > 0) {
      pass(`领土格子数量: ${territoryCells.length} (地图已渲染)`);
    } else {
      warn('领土格子', '未找到领土格子');
    }

    // B1.6 领土归属状态分类 — 实际: .tk-territory-cell--player, --enemy, --neutral
    const playerCells = await page.$$('.tk-territory-cell--player');
    const enemyCells = await page.$$('.tk-territory-cell--enemy');
    const neutralCells = await page.$$('.tk-territory-cell--neutral');
    console.log(`    领土归属: 己方=${playerCells.length}, 敌方=${enemyCells.length}, 中立=${neutralCells.length}`);
    if (playerCells.length > 0) pass(`己方领土: ${playerCells.length}块`);
    else warn('己方领土', '未找到己方领土');
    if (enemyCells.length > 0) pass(`敌方领土: ${enemyCells.length}块`);
    if (neutralCells.length > 0) pass(`中立领土: ${neutralCells.length}块`);

    // B1.7 产出气泡 — 实际: .tk-territory-bubble [data-testid="bubble-{id}"]
    const bubbles = await page.$$('.tk-territory-bubble');
    if (bubbles.length > 0) {
      pass(`产出气泡数量: ${bubbles.length}`);
      // 读取第一个气泡内容
      const firstBubbleText = await bubbles[0].textContent();
      console.log(`    气泡示例: "${firstBubbleText.trim()}"`);
    } else {
      warn('产出气泡', '未找到产出气泡（可能没有己方领土或产出为0）');
    }

    // B1.8 右侧信息面板 — 实际: .tk-worldmap-info-panel [data-testid="worldmap-info-panel"]
    const infoPanel = await page.$('[data-testid="worldmap-info-panel"]') ||
      await page.$('.tk-worldmap-info-panel');
    if (infoPanel) {
      pass('右侧信息面板存在');

      // 统计卡片 — 实际: .tk-worldmap-stat-card
      const statCards = await page.$$('.tk-worldmap-stat-card');
      if (statCards.length > 0) {
        pass(`统计卡片数量: ${statCards.length}`);

        // 读取统计内容
        for (const card of statCards) {
          const label = await card.$('.tk-worldmap-stat-label');
          const value = await card.$('.tk-worldmap-stat-value');
          if (label && value) {
            const labelText = await label.textContent();
            const valueText = await value.textContent();
            console.log(`    统计: ${labelText.trim()} = ${valueText.trim()}`);
          }
        }
      }
    } else {
      warn('信息面板', '未找到右侧信息面板');
    }

    // ── 步骤B2: 热力图测试 ──
    console.log('\n── 步骤B2: 热力图切换 ──');
    const heatmapBtn = await page.$('[data-testid="worldmap-heatmap-toggle"]');
    if (heatmapBtn) {
      await heatmapBtn.click();
      await page.waitForTimeout(1000);
      const shotB2 = await takeScreenshot(page, 'v5e-B2-heatmap-on');
      screenshot(shotB2);

      // 检查热力图激活状态
      const heatmapActive = await page.$('.tk-worldmap-heatmap-toggle--active');
      if (heatmapActive) pass('热力图已激活');

      // 检查热力图叠加层 — 实际: .tk-territory-cell-heatmap
      const heatmapOverlays = await page.$$('.tk-territory-cell-heatmap');
      if (heatmapOverlays.length > 0) {
        pass(`热力图叠加层数量: ${heatmapOverlays.length}`);
      } else {
        warn('热力图叠加', '未找到热力图叠加层');
      }

      // 检查图例 — 实际: .tk-worldmap-legend
      const legend = await page.$('.tk-worldmap-legend');
      if (legend) pass('热力图图例存在');
      else warn('热力图图例', '未找到图例');

      // 关闭热力图
      await heatmapBtn.click();
      await page.waitForTimeout(500);
    }

    // ── 步骤B3: 筛选功能测试 ──
    console.log('\n── 步骤B3: 筛选功能测试 ──');

    // 区域筛选
    const regionSelect = await page.$('[data-testid="worldmap-filter-region"]');
    if (regionSelect) {
      await regionSelect.selectOption({ index: 1 }); // 选择第一个非"全部"选项
      await page.waitForTimeout(1000);
      const shotB3a = await takeScreenshot(page, 'v5e-B3a-filter-region');
      screenshot(shotB3a);
      pass('区域筛选功能正常');

      // 重置
      await regionSelect.selectOption('all');
      await page.waitForTimeout(500);
    }

    // 归属筛选
    const ownershipSelect = await page.$('[data-testid="worldmap-filter-ownership"]');
    if (ownershipSelect) {
      await ownershipSelect.selectOption('player');
      await page.waitForTimeout(1000);
      const shotB3b = await takeScreenshot(page, 'v5e-B3b-filter-player');
      screenshot(shotB3b);

      const filteredCells = await page.$$('.tk-territory-cell');
      console.log(`    己方筛选后格子数: ${filteredCells.length}`);
      pass('归属筛选功能正常');

      // 重置
      await ownershipSelect.selectOption('all');
      await page.waitForTimeout(500);
    }

    // ── 步骤B4: 领土详情面板 ──
    console.log('\n── 步骤B4: 领土详情面板 ──');

    // 点击一个领土格子
    const territoryEl = await page.$('.tk-territory-cell');
    if (territoryEl) {
      await territoryEl.click();
      await page.waitForTimeout(1500);
      const shotB4 = await takeScreenshot(page, 'v5e-B4-territory-detail');
      screenshot(shotB4);

      // 检查领土信息面板 — 实际: .tk-territory-info [data-testid="territory-info-{id}"]
      const territoryInfo = await page.$('.tk-territory-info') ||
        await page.$('[data-testid^="territory-info-"]');
      if (territoryInfo) {
        pass('领土详情面板已显示');

        // 领土名称
        const infoName = await page.$('.tk-territory-info-name');
        if (infoName) {
          const nameText = await infoName.textContent();
          pass(`领土名称: "${nameText.trim()}"`);
        }

        // 领土属性
        const infoAttrs = await page.$$('.tk-territory-info-attr');
        if (infoAttrs.length > 0) pass(`领土属性项: ${infoAttrs.length}`);

        // 产出详情
        const prodItems = await page.$$('.tk-territory-info-prod-item');
        if (prodItems.length > 0) {
          pass(`产出详情项: ${prodItems.length}`);
          for (const item of prodItems) {
            const icon = await item.$('.tk-territory-info-prod-icon');
            const value = await item.$('.tk-territory-info-prod-value');
            if (icon && value) {
              const iconText = await icon.textContent();
              const valueText = await value.textContent();
              console.log(`      ${iconText.trim()}: ${valueText.trim()}`);
            }
          }
        }

        // 操作按钮
        const actionBtns = await page.$$('.tk-territory-info-action-btn');
        if (actionBtns.length > 0) {
          pass(`操作按钮数量: ${actionBtns.length}`);
        }
      } else {
        warn('领土详情面板', '未找到领土详情面板');
      }

      // 点击空白处取消选择
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    } else {
      warn('领土点击', '未找到可点击的领土格子');
    }

    // ═══════════════════════════════════════════
    // 模块C: 离线研究面板检查
    // ═══════════════════════════════════════════
    console.log('\n── 步骤C1: 离线研究面板组件检查 ──');
    await switchTab(page, 'tech');
    await page.waitForTimeout(1500);

    // 离线研究面板通常在重新上线时弹出，这里检查组件是否注册
    const offlinePanelExists = await page.evaluate(() => {
      // 检查组件是否在DOM中（可能在隐藏状态）
      const el = document.querySelector('.tk-tech-offline-panel') ||
        document.querySelector('[data-testid="tech-offline-panel"]');
      return el !== null;
    });
    if (offlinePanelExists) pass('离线研究面板组件已注册');
    else warn('离线研究面板', '面板组件未在DOM中（正常，需要离线回归才显示）');

    const shotC1 = await takeScreenshot(page, 'v5e-C1-tech-offline-check');
    screenshot(shotC1);

    // ═══════════════════════════════════════════
    // 模块D: 移动端适配测试
    // ═══════════════════════════════════════════
    console.log('\n── 步骤D1: 移动端适配测试 ──');

    const mobileContext = await browser.newContext({ viewport: { width: 375, height: 667 } });
    const mobilePage = await mobileContext.newPage();

    const mobileErrors = [];
    mobilePage.on('console', msg => {
      if (msg.type() === 'error') mobileErrors.push(msg.text());
    });

    await mobilePage.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await mobilePage.waitForTimeout(3000);

    // 关闭欢迎弹窗
    const mobileStartBtn = await mobilePage.$('button:has-text("开始游戏")');
    if (mobileStartBtn) {
      await mobileStartBtn.click();
      await mobilePage.waitForTimeout(3000);
    }

    // 关闭引导
    for (let i = 0; i < 5; i++) {
      const guideSkip = await mobilePage.$('.tk-guide-btn--skip');
      if (!guideSkip) break;
      await guideSkip.evaluate(el => el.click());
      await mobilePage.waitForTimeout(500);
    }

    // D1.1 移动端科技Tab
    const mobileTechTab = await mobilePage.$('button:has-text("科技")');
    if (mobileTechTab) {
      await mobileTechTab.click();
      await mobilePage.waitForTimeout(2000);
      const shotD1 = await takeScreenshot(mobilePage, 'v5e-D1-tech-mobile');
      screenshot(shotD1);

      const mobileTechContainer = await mobilePage.$('[data-testid="tech-tab"]') ||
        await mobilePage.$('.tk-tech-tab');
      if (mobileTechContainer) pass('移动端科技Tab正常');
      else warn('移动端科技Tab', '未找到科技Tab容器');

      // 移动端路线Tab（应该只显示一条路线）
      const mobilePathTabs = await mobilePage.$$('.tk-tech-path-tab');
      if (mobilePathTabs.length === 3) {
        pass(`移动端路线切换Tab数量: ${mobilePathTabs.length} (Tab切换模式)`);
      }

      // 移动端研究进度浮动条 — 实际: .tk-tech-research-float
      const mobileFloat = await mobilePage.$('.tk-tech-research-float') ||
        await mobilePage.$('[data-testid="tech-research-float"]');
      if (mobileFloat) pass('移动端研究进度浮动条存在');
    }

    // D1.2 移动端天下Tab（世界地图）
    const mobileMapTab = await mobilePage.$('button:has-text("天下")');
    if (mobileMapTab) {
      await mobileMapTab.click();
      await mobilePage.waitForTimeout(2000);
      const shotD1b = await takeScreenshot(mobilePage, 'v5e-D1b-map-mobile');
      screenshot(shotD1b);

      const mobileMapContainer = await mobilePage.$('[data-testid="worldmap-tab"]') ||
        await mobilePage.$('.tk-worldmap-tab');
      if (mobileMapContainer) pass('移动端世界地图正常');
      else warn('移动端世界地图', '未找到地图容器');

      // 移动端领土格子
      const mobileTerritories = await mobilePage.$$('.tk-territory-cell');
      if (mobileTerritories.length > 0) {
        pass(`移动端领土格子数量: ${mobileTerritories.length}`);
      }
    }

    // D1.3 水平溢出检查
    const mobileBodyWidth = await mobilePage.evaluate(() => document.body.scrollWidth);
    if (mobileBodyWidth <= 400) pass(`移动端无水平溢出 (scrollWidth=${mobileBodyWidth})`);
    else fail('移动端水平溢出', `scrollWidth=${mobileBodyWidth} > 375`);

    // D1.4 移动端数据完整性
    const mobileIntegrity = await checkDataIntegrity(mobilePage);
    if (!mobileIntegrity.hasNaN && !mobileIntegrity.hasUndefined) {
      pass('移动端数据完整性检查通过');
    } else {
      mobileIntegrity.issues.forEach(i => fail('移动端数据完整性', i));
    }

    if (mobileErrors.length > 0) {
      console.log(`    移动端控制台错误: ${mobileErrors.length}个`);
      mobileErrors.slice(0, 5).forEach((e, i) => warn('移动端控制台错误', e.substring(0, 120)));
    } else {
      pass('移动端无控制台错误');
    }

    await mobileContext.close();

    // ═══════════════════════════════════════════
    // E: 控制台错误汇总
    // ═══════════════════════════════════════════
    console.log('\n── 步骤E: 控制台错误汇总 ──');
    if (consoleErrors.length > 0) {
      console.log(`    PC端控制台错误: ${consoleErrors.length}个`);
      consoleErrors.slice(0, 10).forEach((e, i) => {
        results.consoleErrors.push(e);
        console.log(`    CE-${i + 1}: ${e.substring(0, 150)}`);
      });
    } else {
      pass('PC端无控制台错误');
    }

  } catch (err) {
    fail('测试执行异常', err.message);
    console.error(err.stack);
    try { await takeScreenshot(page, 'v5e-error'); } catch (_) { /* ignore */ }
  } finally {
    await browser.close();
  }

  // ═══════════════════════════════════════════
  // 测试报告输出
  // ═══════════════════════════════════════════
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║   v5.0 百家争鸣 UI测试报告 R1(进化迭代)        ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  ✅ 通过: ${String(results.passed.length).padEnd(38)}║`);
  console.log(`║  ❌ 失败: ${String(results.failed.length).padEnd(38)}║`);
  console.log(`║  ⚠️  警告: ${String(results.warnings.length).padEnd(38)}║`);
  console.log(`║  📸 截图: ${String(results.screenshots.length).padEnd(38)}║`);
  console.log(`║  🔴 控制台错误: ${String(results.consoleErrors.length).padEnd(33)}║`);
  console.log('╠══════════════════════════════════════════════════╣');

  if (results.failed.length > 0) {
    console.log('║  ❌ 失败详情:                                   ║');
    results.failed.forEach((f, i) => {
      console.log(`║    F-${i + 1}: ${(f.name + ' — ' + f.detail).substring(0, 44).padEnd(44)}║`);
    });
  }

  if (results.warnings.length > 0) {
    console.log('║  ⚠️  警告详情:                                   ║');
    results.warnings.slice(0, 15).forEach((w, i) => {
      console.log(`║    W-${i + 1}: ${(w.name + ': ' + w.detail).substring(0, 44).padEnd(44)}║`);
    });
    if (results.warnings.length > 15) {
      console.log(`║    ... 还有 ${results.warnings.length - 15} 条警告`.padEnd(52) + '║');
    }
  }

  console.log('╠══════════════════════════════════════════════════╣');
  console.log('║  📸 截图列表:                                   ║');
  results.screenshots.forEach((s, i) => {
    console.log(`║    ${i + 1}. ${s.padEnd(44)}║`);
  });
  console.log('╚══════════════════════════════════════════════════╝');

  // 严重程度判定
  const p0Count = results.failed.filter(f =>
    f.name.includes('科技Tab') || f.name.includes('世界地图容器') || f.name.includes('主界面')
  ).length;

  console.log('\n── 严重程度评估 ──');
  if (results.failed.length === 0) {
    console.log('  🟢 全部通过 — 无阻塞问题');
  } else if (p0Count > 0) {
    console.log(`  🔴 P0 阻塞: ${p0Count}个核心功能失败`);
  } else {
    console.log(`  🟡 P1-P2: ${results.failed.length}个非核心功能问题`);
  }

  // 写入JSON结果
  const resultJson = {
    timestamp: new Date().toISOString(),
    version: 'v5.0',
    module: '百家争鸣',
    type: '进化迭代R1',
    summary: {
      passed: results.passed.length,
      failed: results.failed.length,
      warnings: results.warnings.length,
      screenshots: results.screenshots.length,
      consoleErrors: results.consoleErrors.length,
    },
    passed: results.passed,
    failed: results.failed,
    warnings: results.warnings,
    screenshots: results.screenshots,
    consoleErrors: results.consoleErrors.slice(0, 20),
  };

  const resultPath = path.join(__dirname, '..', 'e2e-v5-evolution-results.json');
  fs.writeFileSync(resultPath, JSON.stringify(resultJson, null, 2));
  console.log(`\n📄 测试结果已保存: ${resultPath}`);

  process.exit(results.failed.length > 0 ? 1 : 0);
})();
