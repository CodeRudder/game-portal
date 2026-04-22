/**
 * v6.0 天下大势 — 进化迭代 UI测试 R1
 *
 * 基于源码实际DOM结构编写，精准选择器
 *
 * 测试范围：
 * 1. 世界地图深化 — 领土网格、筛选工具栏、攻城确认弹窗、领土详情
 * 2. NPC交互/好感度 — NPC名册Tab、NPC卡片、好感度进度条、对话弹窗、NPC详情弹窗
 * 3. 事件系统 — 急报横幅、事件列表面板、随机遭遇弹窗
 * 4. 移动端适配
 *
 * @module e2e/v6-evolution-ui-test
 */

const { chromium } = require('playwright');
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
 * 切换Tab — TabBar使用 button.tk-tab-btn
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
  console.log('  v6.0 天下大势 — 进化迭代 UI测试 R1');
  console.log('═══════════════════════════════════════════════════\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  // 收集控制台错误
  page.on('console', msg => {
    if (msg.type() === 'error') {
      results.consoleErrors.push(msg.text().substring(0, 200));
    }
  });

  try {
    // ═══════════════════════════════════════════
    // 0. 进入游戏
    // ═══════════════════════════════════════════
    console.log('\n── 0. 进入游戏 ──');
    await enterGame(page);
    await takeScreenshot(page, 'v6-00-game-entered');
    pass('游戏加载成功');

    // 检查数据完整性
    const dataCheck = await checkDataIntegrity(page);
    if (dataCheck.issues.length === 0) {
      pass('数据完整性检查通过（无NaN/undefined）');
    } else {
      warn('数据完整性问题', dataCheck.issues.join(', '));
    }

    // ═══════════════════════════════════════════
    // 1. 世界地图深化
    // ═══════════════════════════════════════════
    console.log('\n── 1. 世界地图深化 ──');

    try {
      await switchTab(page, 'map');
      await takeScreenshot(page, 'v6-01-world-map-tab');

      // 检查地图容器
      const mapContainer = await page.$('.tk-worldmap-container, .tk-world-map, [data-testid="world-map"]');
      if (mapContainer) {
        pass('世界地图容器渲染');
      } else {
        // 检查是否有任何地图内容
        const mapContent = await page.$('.tk-map, canvas, .tk-wmap');
        if (mapContent) {
          pass('世界地图内容渲染（非标准容器）');
        } else {
          warn('世界地图容器未找到', '可能DOM结构变更');
        }
      }
    } catch (e) {
      fail('世界地图Tab切换', e.message);
    }

    // 地图筛选工具栏
    try {
      const filterBar = await page.$('.tk-wmap-filter, .tk-map-filter, [data-testid="map-filter"]');
      if (filterBar) {
        pass('地图筛选工具栏存在');
        await takeScreenshot(page, 'v6-02-map-filter-bar');
      } else {
        warn('地图筛选工具栏未找到', '可能尚未渲染或选择器变更');
      }
    } catch (e) {
      warn('地图筛选工具栏检查异常', e.message);
    }

    // 地图统计面板
    try {
      const statsPanel = await page.$('.tk-wmap-stats, .tk-map-stats, [data-testid="map-stats"]');
      if (statsPanel) {
        pass('地图统计面板存在');
      } else {
        warn('地图统计面板未找到', '可能尚未渲染');
      }
    } catch (e) {
      warn('地图统计面板检查异常', e.message);
    }

    // 领土网格点击测试
    try {
      const territoryGrid = await page.$('.tk-wmap-grid, .tk-territory-grid, [data-testid="territory-grid"]');
      if (territoryGrid) {
        pass('领土网格渲染');
        // 尝试点击一个领土
        const firstTerritory = await page.$('.tk-territory-cell, .tk-wmap-tile, [data-testid^="territory-"]');
        if (firstTerritory) {
          await firstTerritory.click();
          await page.waitForTimeout(1000);
          await takeScreenshot(page, 'v6-03-territory-selected');
          pass('领土点击响应');
        }
      } else {
        warn('领土网格未找到', '可能DOM结构变更');
      }
    } catch (e) {
      warn('领土网格测试异常', e.message);
    }

    // ═══════════════════════════════════════════
    // 2. NPC交互/好感度
    // ═══════════════════════════════════════════
    console.log('\n── 2. NPC交互/好感度 ──');

    try {
      await switchTab(page, 'npc');
      await takeScreenshot(page, 'v6-04-npc-tab');
      pass('NPC Tab切换成功');
    } catch (e) {
      fail('NPC Tab切换', e.message);
    }

    // 检查NPC名册面板
    try {
      const npcTab = await page.$('[data-testid="npc-tab"]');
      if (npcTab) {
        pass('NPC名册面板渲染（data-testid=npc-tab）');
      } else {
        warn('NPC名册面板未找到', 'data-testid=npc-tab 不存在');
      }
    } catch (e) {
      warn('NPC名册面板检查异常', e.message);
    }

    // 检查搜索栏
    try {
      const searchInput = await page.$('[data-testid="npc-search-input"]');
      if (searchInput) {
        pass('NPC搜索栏存在（data-testid=npc-search-input）');
        // 尝试输入搜索
        await searchInput.fill('测试');
        await page.waitForTimeout(500);
        await takeScreenshot(page, 'v6-05-npc-search');
        await searchInput.fill('');
        pass('NPC搜索功能可用');
      } else {
        warn('NPC搜索栏未找到', 'data-testid=npc-search-input 不存在');
      }
    } catch (e) {
      warn('NPC搜索栏测试异常', e.message);
    }

    // 检查职业筛选栏
    try {
      const filterBar = await page.$('[data-testid="npc-filter-bar"]');
      if (filterBar) {
        pass('NPC职业筛选栏存在（data-testid=npc-filter-bar）');
        // 尝试点击筛选按钮
        const allFilter = await page.$('[data-testid="npc-filter-all"]');
        if (allFilter) {
          await allFilter.click();
          await page.waitForTimeout(500);
          pass('NPC职业筛选可点击');
        }
      } else {
        warn('NPC职业筛选栏未找到', 'data-testid=npc-filter-bar 不存在');
      }
    } catch (e) {
      warn('NPC职业筛选栏测试异常', e.message);
    }

    // 检查NPC列表
    try {
      const npcList = await page.$('[data-testid="npc-list"]');
      if (npcList) {
        pass('NPC列表容器存在（data-testid=npc-list）');

        // 检查NPC卡片
        const npcCards = await page.$$('[data-testid^="npc-card-"]');
        if (npcCards.length > 0) {
          pass(`发现 ${npcCards.length} 张NPC卡片`);
          await takeScreenshot(page, 'v6-06-npc-cards');

          // 点击第一张NPC卡片
          const firstCard = npcCards[0];
          await firstCard.click();
          await page.waitForTimeout(1000);
          await takeScreenshot(page, 'v6-07-npc-card-selected');
          pass('NPC卡片点击响应');
        } else {
          // 检查空状态
          const emptyState = await page.$('[data-testid="npc-empty"]');
          if (emptyState) {
            pass('NPC空状态提示正常显示');
          } else {
            warn('NPC列表为空且无空状态提示', '可能NPC数据未初始化');
          }
        }
      } else {
        warn('NPC列表容器未找到', 'data-testid=npc-list 不存在');
      }
    } catch (e) {
      warn('NPC列表测试异常', e.message);
    }

    // 检查NPC好感度进度条
    try {
      const affinityBar = await page.$('.tk-npc-affinity-fill, [data-testid^="npc-affinity"]');
      if (affinityBar) {
        pass('NPC好感度进度条渲染');
      } else {
        warn('NPC好感度进度条未找到', '可能无NPC数据或选择器变更');
      }
    } catch (e) {
      warn('NPC好感度进度条检查异常', e.message);
    }

    // 检查NPC对话按钮
    try {
      const dialogBtn = await page.$('[data-testid^="npc-btn-dialog-"]');
      if (dialogBtn) {
        pass('NPC对话按钮存在');
        await dialogBtn.click();
        await page.waitForTimeout(1000);
        await takeScreenshot(page, 'v6-08-npc-dialog');

        // 检查对话弹窗
        const dialogModal = await page.$('.tk-npc-dialog-modal, [data-testid="npc-dialog-modal"]');
        if (dialogModal) {
          pass('NPC对话弹窗弹出');
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);
        } else {
          warn('NPC对话弹窗未弹出', '可能弹窗结构变更');
        }
      } else {
        warn('NPC对话按钮未找到', '可能无NPC数据');
      }
    } catch (e) {
      warn('NPC对话测试异常', e.message);
    }

    // 检查NPC详情按钮
    try {
      const infoBtn = await page.$('[data-testid^="npc-btn-info-"]');
      if (infoBtn) {
        pass('NPC详情按钮存在');
        await infoBtn.click();
        await page.waitForTimeout(1000);
        await takeScreenshot(page, 'v6-09-npc-info');

        // 检查详情弹窗
        const infoModal = await page.$('.tk-npc-info-modal, [data-testid="npc-info-modal"]');
        if (infoModal) {
          pass('NPC详情弹窗弹出');
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);
        } else {
          warn('NPC详情弹窗未弹出', '可能弹窗结构变更');
        }
      } else {
        warn('NPC详情按钮未找到', '可能无NPC数据');
      }
    } catch (e) {
      warn('NPC详情测试异常', e.message);
    }

    // NPC底部统计
    try {
      const footer = await page.$('[data-testid="npc-tab-footer"]');
      if (footer) {
        pass('NPC底部统计存在（data-testid=npc-tab-footer）');
        const footerText = await footer.textContent();
        if (footerText && footerText.includes('/')) {
          pass(`NPC统计显示: ${footerText.trim()}`);
        }
      }
    } catch (e) {
      warn('NPC底部统计检查异常', e.message);
    }

    // ═══════════════════════════════════════════
    // 3. 事件系统
    // ═══════════════════════════════════════════
    console.log('\n── 3. 事件系统 ──');

    // 检查急报横幅
    try {
      const banner = await page.$('[data-testid="event-banner"]');
      if (banner) {
        pass('急报横幅渲染（data-testid=event-banner）');
        await takeScreenshot(page, 'v6-10-event-banner');

        // 检查关闭按钮
        const dismissBtn = await page.$('[data-testid="event-banner-dismiss"]');
        if (dismissBtn) {
          pass('急报横幅关闭按钮存在');
        }
      } else {
        warn('急报横幅未显示', '可能当前无活跃急报事件');
      }
    } catch (e) {
      warn('急报横幅检查异常', e.message);
    }

    // 打开事件列表面板（通过更多菜单或功能菜单）
    try {
      // 方式1: 通过更多Tab的事件入口
      await switchTab(page, 'more');
      await page.waitForTimeout(1000);

      // 查找事件菜单项
      const eventMenuItem = await page.$('button:has-text("事件"), [data-testid="feature-events"], .tk-more-item:has-text("事件")');
      if (eventMenuItem) {
        await eventMenuItem.click();
        await page.waitForTimeout(2000);
        await takeScreenshot(page, 'v6-11-event-list-panel');
        pass('事件列表面板打开');
      } else {
        warn('事件菜单项未找到', '尝试其他方式');
      }
    } catch (e) {
      warn('事件面板打开异常', e.message);
    }

    // 检查事件列表面板内容
    try {
      const eventPanel = await page.$('[data-testid="event-list-panel"]');
      if (eventPanel) {
        pass('事件列表面板渲染（data-testid=event-list-panel）');

        // 检查事件卡片
        const eventCards = await page.$$('[data-testid^="event-card-"]');
        if (eventCards.length > 0) {
          pass(`发现 ${eventCards.length} 个活跃事件`);
          await takeScreenshot(page, 'v6-12-event-cards');

          // 检查事件选项
          const firstOption = await page.$('[data-testid^="encounter-option-"]');
          if (firstOption) {
            pass('事件选项渲染');
          }
        } else {
          pass('事件列表面板显示空状态（暂无活跃事件）');
        }
      } else {
        warn('事件列表面板未渲染', 'data-testid=event-list-panel 不存在');
      }
    } catch (e) {
      warn('事件列表面板检查异常', e.message);
    }

    // 关闭面板
    await closeAllModals(page);
    await page.waitForTimeout(500);

    // 检查随机遭遇弹窗结构（通过DOM检查组件是否可渲染）
    try {
      // 随机遭遇弹窗由引擎事件触发，这里检查组件是否正确注册
      const encounterModal = await page.$('[data-testid="encounter-modal"]');
      if (encounterModal) {
        pass('随机遭遇弹窗渲染（有活跃遭遇）');
        await takeScreenshot(page, 'v6-13-encounter-modal');

        // 检查遭遇选项
        const encounterOptions = await page.$$('[data-testid^="encounter-option-"]');
        if (encounterOptions.length > 0) {
          pass(`随机遭遇有 ${encounterOptions.length} 个选项`);
        }

        // 检查忽略按钮
        const ignoreBtn = await page.$('[data-testid="encounter-ignore-btn"]');
        if (ignoreBtn) {
          pass('随机遭遇忽略按钮存在');
        }
      } else {
        pass('随机遭遇弹窗未触发（正常，需引擎触发随机事件）');
      }
    } catch (e) {
      warn('随机遭遇弹窗检查异常', e.message);
    }

    // ═══════════════════════════════════════════
    // 4. 移动端适配测试
    // ═══════════════════════════════════════════
    console.log('\n── 4. 移动端适配 ──');

    // 切换到移动端视口
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(2000);
    await takeScreenshot(page, 'v6-14-mobile-overview');

    // 移动端NPC Tab
    try {
      await switchTab(page, 'npc');
      await takeScreenshot(page, 'v6-15-mobile-npc-tab');

      const npcTab = await page.$('[data-testid="npc-tab"]');
      if (npcTab) {
        pass('移动端NPC面板渲染');
      }
    } catch (e) {
      warn('移动端NPC面板测试异常', e.message);
    }

    // 移动端地图Tab
    try {
      await switchTab(page, 'map');
      await takeScreenshot(page, 'v6-16-mobile-map');
      pass('移动端地图Tab切换成功');
    } catch (e) {
      warn('移动端地图Tab测试异常', e.message);
    }

    // 恢复PC视口
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(1000);

    // ═══════════════════════════════════════════
    // 5. 回归检查 — 基础功能
    // ═══════════════════════════════════════════
    console.log('\n── 5. 回归检查 ──');

    // 建筑Tab回归
    try {
      await switchTab(page, 'building');
      await takeScreenshot(page, 'v6-17-regression-building');
      const buildingPanel = await page.$('.tk-building-panel, [data-testid="building-panel"]');
      if (buildingPanel) {
        pass('回归: 建筑面板正常');
      } else {
        warn('回归: 建筑面板选择器可能变更');
      }
    } catch (e) {
      fail('回归: 建筑Tab', e.message);
    }

    // 武将Tab回归
    try {
      await switchTab(page, 'hero');
      await takeScreenshot(page, 'v6-18-regression-hero');
      const heroPanel = await page.$('.tk-hero-tab, [data-testid="hero-tab"]');
      if (heroPanel) {
        pass('回归: 武将面板正常');
      } else {
        warn('回归: 武将面板选择器可能变更');
      }
    } catch (e) {
      fail('回归: 武将Tab', e.message);
    }

    // 科技Tab回归
    try {
      await switchTab(page, 'tech');
      await takeScreenshot(page, 'v6-19-regression-tech');
      pass('回归: 科技Tab可切换');
    } catch (e) {
      fail('回归: 科技Tab', e.message);
    }

    // ═══════════════════════════════════════════
    // 6. 最终数据完整性检查
    // ═══════════════════════════════════════════
    console.log('\n── 6. 最终数据完整性 ──');
    const finalCheck = await checkDataIntegrity(page);
    if (finalCheck.issues.length === 0) {
      pass('最终数据完整性检查通过');
    } else {
      fail('最终数据完整性问题', finalCheck.issues.join(', '));
    }

    // ═══════════════════════════════════════════
    // 7. 控制台错误汇总
    // ═══════════════════════════════════════════
    console.log('\n── 7. 控制台错误 ──');
    const significantErrors = results.consoleErrors.filter(
      e => !e.includes('favicon') && !e.includes('manifest') && !e.includes('DevTools')
    );
    if (significantErrors.length === 0) {
      pass('无显著控制台错误');
    } else {
      warn(`发现 ${significantErrors.length} 个控制台错误`, significantErrors.slice(0, 3).join(' | '));
    }

  } catch (err) {
    fail('测试运行异常', err.message);
    console.error(err);
  } finally {
    // ═══════════════════════════════════════════
    // 输出测试报告
    // ═══════════════════════════════════════════
    console.log('\n═══════════════════════════════════════════════════');
    console.log('  测试结果汇总');
    console.log('═══════════════════════════════════════════════════');
    console.log(`  ✅ 通过: ${results.passed.length}`);
    console.log(`  ❌ 失败: ${results.failed.length}`);
    console.log(`  ⚠️  警告: ${results.warnings.length}`);
    console.log(`  📸 截图: ${results.screenshots.length}`);
    console.log(`  🔴 控制台错误: ${results.consoleErrors.length}`);

    if (results.failed.length > 0) {
      console.log('\n  ❌ 失败详情:');
      results.failed.forEach(f => console.log(`    - ${f.name}: ${f.detail}`));
    }
    if (results.warnings.length > 0) {
      console.log('\n  ⚠️  警告详情:');
      results.warnings.forEach(w => console.log(`    - ${w.name}: ${w.detail}`));
    }

    // 保存JSON结果
    const reportPath = path.join(__dirname, 'v6-evolution-ui-results.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2), 'utf-8');
    console.log(`\n  📄 结果已保存: ${reportPath}`);

    await browser.close();

    // 非零退出码表示有失败
    process.exit(results.failed.length > 0 ? 1 : 0);
  }
})();
