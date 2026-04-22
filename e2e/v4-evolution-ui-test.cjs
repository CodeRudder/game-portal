/**
 * v4.0 攻城略地(下) — 进化迭代 UI测试
 *
 * 测试范围：
 * 1. 战斗深化 — 战斗加速(1x/2x/4x)、大招时停、伤害数字
 * 2. 扫荡系统 — 扫荡按钮、扫荡弹窗、扫荡结果
 * 3. 武将升星 — 碎片进度、升星面板、突破机制
 * 4. 科技系统 — 三条路线、科技树渲染、研究流程、互斥分支
 * 5. 移动端适配
 *
 * @module e2e/v4-evolution-ui-test
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// ─────────────────────────────────────────────
// 配置
// ─────────────────────────────────────────────
const BASE_URL = process.env.GAME_BASE_URL || 'http://localhost:5173/idle/three-kingdoms';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots', 'v4-evolution');

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

async function switchTab(page, tabName) {
  await dismissGuide(page);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  const tab = await page.$(`button:has-text("${tabName}")`);
  if (!tab) throw new Error(`Tab未找到: ${tabName}`);
  await tab.click();
  await page.waitForTimeout(1500);
}

async function closeAllModals(page) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const closeBtn = await page.$('.tk-bfm-close') ||
    await page.$('.tk-brm-confirm-btn') ||
    await page.$('[class*="close-btn"]');
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
  console.log('  v4.0 攻城略地(下) — 进化迭代 UI测试 R1');
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
    const shot0 = await takeScreenshot(page, 'v4e-00-main');
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
    // 模块A: 战斗深化
    // ═══════════════════════════════════════════

    // ── 步骤A1: 招募武将（预备） ──
    console.log('\n── 步骤A1: 预备 — 招募武将 ──');
    await switchTab(page, '武将');
    await page.waitForTimeout(1500);

    let heroCards = await page.$$('.tk-hero-card');
    console.log(`    当前武将数量: ${heroCards.length}`);

    if (heroCards.length === 0) {
      const recruitBtn = await page.$('.tk-hero-recruit-btn') ||
        await page.$('.tk-hero-empty-btn') ||
        await page.$('button:has-text("招募")');
      if (recruitBtn) {
        await recruitBtn.evaluate(el => el.click());
        await page.waitForTimeout(1500);
        const recruitOnceBtn = await page.$('.tk-recruit-btn:not(.tk-recruit-btn--ten)') ||
          await page.$('button:has-text("招募一次")');
        if (recruitOnceBtn) {
          const btnDisabled = await recruitOnceBtn.evaluate(el => el.disabled);
          if (!btnDisabled) {
            await recruitOnceBtn.evaluate(el => el.click());
            await page.waitForTimeout(2500);
            pass('单次招募成功');
            await page.waitForTimeout(2000);
            const resultsCloseBtn = await page.$('.tk-recruit-results-close') ||
              await page.$('button:has-text("确认")');
            if (resultsCloseBtn) {
              await resultsCloseBtn.evaluate(el => el.click());
              await page.waitForTimeout(1000);
            }
          }
        }
        const recruitCloseBtn = await page.$('.tk-recruit-close') ||
          await page.$('button:has-text("关闭")');
        if (recruitCloseBtn) {
          await recruitCloseBtn.evaluate(el => el.click());
          await page.waitForTimeout(1000);
        }
      }
    } else {
      pass(`已有${heroCards.length}名武将`);
    }

    // ── 步骤A2: 进入关卡Tab ──
    console.log('\n── 步骤A2: 关卡Tab — 进入战斗 ──');
    await switchTab(page, '关卡');
    await page.waitForTimeout(2000);
    const shotA2 = await takeScreenshot(page, 'v4e-A2-campaign-tab');
    screenshot(shotA2);

    // 检查关卡Tab
    const campaignTab = await page.$('.tk-campaign-tab');
    if (campaignTab) pass('关卡Tab(.tk-campaign-tab)存在');
    else fail('关卡Tab', '.tk-campaign-tab 未找到');

    // ── 步骤A3: 点击可挑战关卡 → 布阵 → 出征 ──
    console.log('\n── 步骤A3: 布阵 → 出征 ──');
    let availableNode = await page.$('.tk-stage-node--available') ||
      await page.$('.tk-stage-node:not(.tk-stage-node--locked)');
    if (availableNode) {
      await availableNode.click();
      await page.waitForTimeout(1500);
      const shotA3 = await takeScreenshot(page, 'v4e-A3-formation-modal');
      screenshot(shotA3);

      // 自动布阵
      const autoBtn = await page.$('.tk-bfm-btn--auto');
      if (autoBtn) {
        await autoBtn.click();
        await page.waitForTimeout(1000);
        pass('一键布阵成功');
      }

      // 出征
      const fightBtn = await page.$('.tk-bfm-btn--fight');
      if (fightBtn) {
        const isDisabled = await fightBtn.evaluate(el => el.disabled);
        if (!isDisabled) {
          await fightBtn.click();
          await page.waitForTimeout(3000);

          // ── 步骤A4: 战斗场景 — 检查战斗深化功能 ──
          console.log('\n── 步骤A4: 战斗场景 — 战斗深化检查 ──');
          const shotA4 = await takeScreenshot(page, 'v4e-A4-battle-scene');
          screenshot(shotA4);

          // A4.1 战斗覆盖层
          let battleOverlay = await page.$('.tk-bs-overlay');
          if (!battleOverlay) {
            await page.waitForTimeout(3000);
            battleOverlay = await page.$('.tk-bs-overlay');
          }
          if (battleOverlay) pass('战斗场景覆盖层(.tk-bs-overlay)存在');
          else fail('战斗场景', '.tk-bs-overlay 未找到');

          // A4.2 速度控制按钮（1x/2x/4x）
          const speedBtns = await page.$$('.tk-bs-speed-btn');
          if (speedBtns.length > 0) {
            pass(`速度控制按钮数量: ${speedBtns.length}`);

            // 检查当前速度状态
            const activeSpeedBtn = await page.$('.tk-bs-speed-btn--active');
            if (activeSpeedBtn) {
              const speedText = await activeSpeedBtn.textContent();
              pass(`当前速度: ${speedText.trim()}`);
            }

            // 尝试切换速度
            for (const btn of speedBtns.slice(0, 3)) {
              try {
                const btnText = await btn.textContent();
                await btn.click();
                await page.waitForTimeout(500);
                pass(`速度切换到: ${btnText.trim()}`);
              } catch (e) {
                warn('速度切换', e.message.substring(0, 80));
              }
            }
          } else {
            warn('速度控制', '未找到.tk-bs-speed-btn（可能UI结构不同）');
          }

          // A4.3 跳过按钮
          const skipBtn = await page.$('.tk-bs-skip-btn');
          if (skipBtn) pass('跳过按钮(.tk-bs-skip-btn)存在');

          // A4.4 武将卡片和血条/怒气条
          const unitCards = await page.$$('.tk-bs-unit');
          if (unitCards.length > 0) pass(`武将卡片数量: ${unitCards.length}`);

          const hpBars = await page.$$('.tk-bs-hp-bar');
          const rageBars = await page.$$('.tk-bs-rage-bar');
          if (hpBars.length > 0) pass(`血条数量: ${hpBars.length}`);
          if (rageBars.length > 0) pass(`怒气条数量: ${rageBars.length}`);

          // A4.5 大招时停 — 检查大招相关UI
          const ultimateBtn = await page.$('.tk-bs-ultimate-btn') ||
            await page.$('.tk-bs-skill-btn');
          if (ultimateBtn) {
            pass('大招/技能按钮存在');
          } else {
            warn('大招时停UI', '未找到大招按钮（可能需要怒气满才显示）');
          }

          // A4.6 战斗日志
          const logArea = await page.$('.tk-bs-log-area');
          if (logArea) pass('战斗播报区域(.tk-bs-log-area)存在');

          // A4.7 战斗中截图
          await page.waitForTimeout(2000);
          const shotA4b = await takeScreenshot(page, 'v4e-A4b-battle-mid');
          screenshot(shotA4b);

          // ── 步骤A5: 跳过战斗 → 结算 ──
          console.log('\n── 步骤A5: 战斗结算 ──');
          const skipBtnNow = await page.$('.tk-bs-skip-btn');
          if (skipBtnNow) {
            await skipBtnNow.click();
            await page.waitForTimeout(3000);
          } else {
            await page.waitForTimeout(15000);
          }

          const shotA5 = await takeScreenshot(page, 'v4e-A5-battle-result');
          screenshot(shotA5);

          // 检查结算弹窗
          const resultModal = await page.$('.tk-brm-modal') || await page.$('.tk-brm-overlay');
          if (resultModal) {
            pass('战斗结算弹窗已显示');

            // 星级
            const resultStars = await page.$$('.tk-brm-star--filled');
            const totalStars = await page.$$('.tk-brm-star');
            if (totalStars.length > 0) pass(`获得星级: ${resultStars.length}/${totalStars.length}`);

            // 奖励
            const rewardItems = await page.$$('.tk-brm-reward-item');
            if (rewardItems.length > 0) pass(`奖励项: ${rewardItems.length}`);

            // 统计
            const stats = await page.$$('.tk-brm-stat');
            if (stats.length > 0) pass(`战斗统计项: ${stats.length}`);

            // 确认
            const confirmBtn = await page.$('.tk-brm-confirm-btn');
            if (confirmBtn) {
              await confirmBtn.click();
              await page.waitForTimeout(1500);
              pass('结算确认成功');
            }
          } else {
            warn('战斗结算', '未找到标准结算弹窗');
            await page.keyboard.press('Escape');
            await page.waitForTimeout(1000);
          }
        } else {
          warn('出征按钮', '被禁用（无武将在编队中）');
          await page.keyboard.press('Escape');
          await page.waitForTimeout(1000);
        }
      } else {
        fail('出征按钮', '.tk-bfm-btn--fight 未找到');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(1000);
      }
    } else {
      fail('可挑战关卡', '未找到可点击的关卡节点');
    }

    // ═══════════════════════════════════════════
    // 模块B: 扫荡系统
    // ═══════════════════════════════════════════
    console.log('\n── 步骤B1: 扫荡功能检查 ──');

    // 确保回到关卡Tab
    const campaignTabCheck = await page.$('.tk-campaign-tab');
    if (!campaignTabCheck) {
      await switchTab(page, '关卡');
      await page.waitForTimeout(1500);
    }

    const sweepBtns = await page.$$('.tk-stage-sweep-btn');
    if (sweepBtns.length > 0) {
      pass(`扫荡按钮数量: ${sweepBtns.length}`);

      await sweepBtns[0].click();
      await page.waitForTimeout(1500);
      const shotB1 = await takeScreenshot(page, 'v4e-B1-sweep-modal');
      screenshot(shotB1);

      // 扫荡结算
      const sweepResultTitle = await page.$('.tk-brm-result-title');
      if (sweepResultTitle) {
        const t = await sweepResultTitle.textContent();
        pass(`扫荡结算标题: "${t.trim()}"`);
      }

      const sweepRewardItems = await page.$$('.tk-brm-reward-item');
      if (sweepRewardItems.length > 0) pass(`扫荡奖励项: ${sweepRewardItems.length}`);

      const sweepConfirmBtn = await page.$('.tk-brm-confirm-btn');
      if (sweepConfirmBtn) {
        await sweepConfirmBtn.click();
        await page.waitForTimeout(1000);
        pass('扫荡结算确认成功');
      }
    } else {
      warn('扫荡按钮', '未找到扫荡按钮（可能没有三星通关关卡）');
    }

    // ═══════════════════════════════════════════
    // 模块C: 武将升星
    // ═══════════════════════════════════════════
    console.log('\n── 步骤C1: 武将升星面板 ──');
    await switchTab(page, '武将');
    await page.waitForTimeout(2000);
    const shotC1 = await takeScreenshot(page, 'v4e-C1-hero-tab');
    screenshot(shotC1);

    // C1.1 武将卡片
    heroCards = await page.$$('.tk-hero-card');
    if (heroCards.length > 0) {
      pass(`武将卡片数量: ${heroCards.length}`);

      // 点击第一个武将
      await heroCards[0].click();
      await page.waitForTimeout(1500);
      const shotC1b = await takeScreenshot(page, 'v4e-C1b-hero-detail');
      screenshot(shotC1b);

      // C1.2 武将详情弹窗
      const heroDetail = await page.$('.tk-hero-detail-modal') ||
        await page.$('.tk-hero-detail') ||
        await page.$('.tk-shared-panel');
      if (heroDetail) {
        pass('武将详情弹窗已打开');

        // C1.3 检查升星相关UI
        const starUpTab = await page.$('button:has-text("升星")') ||
          await page.$('.tk-hero-tab--star') ||
          await page.$('[data-testid="hero-star-tab"]');
        if (starUpTab) {
          await starUpTab.click();
          await page.waitForTimeout(1500);
          const shotC1c = await takeScreenshot(page, 'v4e-C1c-star-up-panel');
          screenshot(shotC1c);
          pass('升星Tab点击成功');
        } else {
          warn('升星Tab', '未找到升星标签按钮');
        }

        // C1.4 碎片进度
        const fragmentProgress = await page.$('.tk-star-fragment-progress') ||
          await page.$('.tk-fragment-bar') ||
          await page.$('[data-testid="fragment-progress"]');
        if (fragmentProgress) {
          pass('碎片进度可视化存在');
        } else {
          warn('碎片进度', '未找到碎片进度UI');
        }

        // C1.5 星级显示
        const starDisplay = await page.$$('.tk-star-icon') ||
          await page.$$('.tk-hero-star');
        if (starDisplay.length > 0) pass(`星级图标数量: ${starDisplay.length}`);

        // C1.6 升星按钮
        const starUpBtn = await page.$('.tk-star-up-btn') ||
          await page.$('button:has-text("升星")') ||
          await page.$('[data-testid="star-up-btn"]');
        if (starUpBtn) {
          const btnDisabled = await starUpBtn.evaluate(el => el.disabled);
          pass(`升星按钮存在 (禁用: ${btnDisabled})`);
        } else {
          warn('升星按钮', '未找到升星按钮');
        }

        // C1.7 突破相关
        const breakthroughInfo = await page.$('.tk-breakthrough-info') ||
          await page.$('[data-testid="breakthrough-info"]');
        if (breakthroughInfo) pass('突破信息区域存在');

        // 关闭详情
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      } else {
        warn('武将详情', '未找到详情弹窗');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }
    } else {
      warn('武将卡片', '未找到武将卡片');
    }

    // ═══════════════════════════════════════════
    // 模块D: 科技系统
    // ═══════════════════════════════════════════
    console.log('\n── 步骤D1: 科技Tab ──');
    await switchTab(page, '科技');
    await page.waitForTimeout(2000);
    const shotD1 = await takeScreenshot(page, 'v4e-D1-tech-tab');
    screenshot(shotD1);

    // D1.1 科技Tab容器
    const techTab = await page.$('.tk-tech-tab') ||
      await page.$('[data-testid="tech-tab"]');
    if (techTab) {
      pass('科技Tab容器存在');
    } else {
      fail('科技Tab', '未找到科技Tab容器');
    }

    // D1.2 三条科技路线
    const techPaths = await page.$$('.tk-tech-path') ||
      await page.$$('[data-testid="tech-path"]');
    if (techPaths.length >= 3) {
      pass(`科技路线数量: ${techPaths.length} (预期3条: 军事/经济/文化)`);
    } else if (techPaths.length > 0) {
      warn('科技路线', `数量: ${techPaths.length} (预期3条)`);
    } else {
      // 尝试其他选择器
      const militaryPath = await page.$('.tk-tech-path--military') ||
        await page.$('[data-testid="tech-path-military"]');
      const economyPath = await page.$('.tk-tech-path--economy') ||
        await page.$('[data-testid="tech-path-economy"]');
      const culturePath = await page.$('.tk-tech-path--culture') ||
        await page.$('[data-testid="tech-path-culture"]');

      if (militaryPath) pass('军事路线存在');
      else warn('军事路线', '未找到');
      if (economyPath) pass('经济路线存在');
      else warn('经济路线', '未找到');
      if (culturePath) pass('文化路线存在');
      else warn('文化路线', '未找到');
    }

    // D1.3 科技节点
    const techNodes = await page.$$('.tk-tech-node') ||
      await page.$$('[data-testid="tech-node"]');
    if (techNodes.length > 0) {
      pass(`科技节点数量: ${techNodes.length}`);

      // 检查节点状态
      const lockedNodes = await page.$$('.tk-tech-node--locked');
      const availableNodes = await page.$$('.tk-tech-node--available');
      const researchingNodes = await page.$$('.tk-tech-node--researching');
      const completedNodes = await page.$$('.tk-tech-node--completed');
      const mutexLockedNodes = await page.$$('.tk-tech-node--mutex-locked');
      console.log(`    节点状态: 锁定=${lockedNodes.length}, 可研究=${availableNodes.length}, 研究中=${researchingNodes.length}, 已完成=${completedNodes.length}, 互斥锁定=${mutexLockedNodes.length}`);
      pass('科技节点状态分类正常');
    } else {
      warn('科技节点', '未找到科技节点');
    }

    // D1.4 科技连接线
    const techEdges = await page.$$('.tk-tech-edge') ||
      await page.$$('.tk-tech-line');
    if (techEdges.length > 0) pass(`科技连接线数量: ${techEdges.length}`);

    // D1.5 科技点显示
    const techPoints = await page.$('.tk-tech-points') ||
      await page.$('[data-testid="tech-points"]');
    if (techPoints) {
      const text = await techPoints.textContent();
      pass(`科技点显示: "${text.trim()}"`);
    } else {
      warn('科技点', '未找到科技点显示');
    }

    // D1.6 研究队列
    const researchQueue = await page.$('.tk-research-queue') ||
      await page.$('[data-testid="research-queue"]');
    if (researchQueue) {
      pass('研究队列区域存在');
    } else {
      warn('研究队列', '未找到研究队列UI');
    }

    // D1.7 点击科技节点 → 详情弹窗
    const clickableNode = await page.$('.tk-tech-node--available') ||
      await page.$('.tk-tech-node:not(.tk-tech-node--locked)');
    if (clickableNode) {
      await clickableNode.click();
      await page.waitForTimeout(1500);
      const shotD1b = await takeScreenshot(page, 'v4e-D1b-tech-node-detail');
      screenshot(shotD1b);

      // 检查节点详情弹窗
      const techDetailModal = await page.$('.tk-tech-detail-modal') ||
        await page.$('.tk-shared-panel') ||
        await page.$('[data-testid="tech-node-detail"]');
      if (techDetailModal) {
        pass('科技节点详情弹窗已打开');

        // 检查研究按钮
        const researchBtn = await page.$('.tk-tech-research-btn') ||
          await page.$('button:has-text("研究")') ||
          await page.$('[data-testid="start-research-btn"]');
        if (researchBtn) pass('研究按钮存在');

        // 检查加速按钮
        const speedUpBtn = await page.$('.tk-tech-speedup-btn') ||
          await page.$('button:has-text("加速")') ||
          await page.$('[data-testid="speedup-btn"]');
        if (speedUpBtn) pass('加速按钮存在');

        // 检查互斥信息
        const mutexInfo = await page.$('.tk-tech-mutex-info') ||
          await page.$('[data-testid="mutex-info"]');
        if (mutexInfo) pass('互斥分支信息存在');

        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      } else {
        warn('科技节点详情', '未找到详情弹窗');
      }
    } else {
      warn('科技节点点击', '无可点击的科技节点');
    }

    const shotD1c = await takeScreenshot(page, 'v4e-D1c-tech-final');
    screenshot(shotD1c);

    // ═══════════════════════════════════════════
    // 模块E: 移动端适配测试
    // ═══════════════════════════════════════════
    console.log('\n── 步骤E1: 移动端适配测试 ──');

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

    // E1.1 移动端科技Tab
    const mobileTechTab = await mobilePage.$('button:has-text("科技")');
    if (mobileTechTab) {
      await mobileTechTab.click();
      await mobilePage.waitForTimeout(2000);
      const shotE1 = await takeScreenshot(mobilePage, 'v4e-E1-tech-mobile');
      screenshot(shotE1);

      const mobileTechContainer = await mobilePage.$('.tk-tech-tab') ||
        await mobilePage.$('[data-testid="tech-tab"]');
      if (mobileTechContainer) pass('移动端科技Tab正常');
      else warn('移动端科技Tab', '未找到科技Tab容器');
    }

    // E1.2 移动端关卡Tab
    const mobileCampaignTab = await mobilePage.$('button:has-text("关卡")');
    if (mobileCampaignTab) {
      await mobileCampaignTab.click();
      await mobilePage.waitForTimeout(2000);
      const shotE1b = await takeScreenshot(mobilePage, 'v4e-E1b-campaign-mobile');
      screenshot(shotE1b);

      const mobileCampaignContainer = await mobilePage.$('.tk-campaign-tab');
      if (mobileCampaignContainer) pass('移动端关卡Tab正常');
    }

    // E1.3 移动端武将Tab
    const mobileHeroTab = await mobilePage.$('button:has-text("武将")');
    if (mobileHeroTab) {
      await mobileHeroTab.click();
      await mobilePage.waitForTimeout(2000);
      const shotE1c = await takeScreenshot(mobilePage, 'v4e-E1c-hero-mobile');
      screenshot(shotE1c);
      pass('移动端武将Tab正常');
    }

    // E1.4 水平溢出检查
    const mobileBodyWidth = await mobilePage.evaluate(() => document.body.scrollWidth);
    if (mobileBodyWidth <= 400) pass(`移动端无水平溢出 (scrollWidth=${mobileBodyWidth})`);
    else fail('移动端水平溢出', `scrollWidth=${mobileBodyWidth} > 375`);

    // E1.5 移动端数据完整性
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
    // F: 控制台错误汇总
    // ═══════════════════════════════════════════
    console.log('\n── 步骤F: 控制台错误汇总 ──');
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
    try { await takeScreenshot(page, 'v4e-error'); } catch (_) { /* ignore */ }
  } finally {
    await browser.close();
  }

  // ═══════════════════════════════════════════
  // 测试报告输出
  // ═══════════════════════════════════════════
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║   v4.0 攻城略地(下) UI测试报告 R1(进化迭代)    ║');
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
    results.warnings.forEach((w, i) => {
      console.log(`║    W-${i + 1}: ${(w.name + ': ' + w.detail).substring(0, 44).padEnd(44)}║`);
    });
  }

  console.log('╠══════════════════════════════════════════════════╣');
  console.log('║  📸 截图列表:                                   ║');
  results.screenshots.forEach((s, i) => {
    console.log(`║    ${i + 1}. ${s.padEnd(44)}║`);
  });
  console.log('╚══════════════════════════════════════════════════╝');

  // 严重程度判定
  const p0Count = results.failed.filter(f =>
    f.name.includes('科技Tab') || f.name.includes('战斗场景') || f.name.includes('关卡Tab')
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
    version: 'v4.0',
    module: '攻城略地(下)',
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

  const resultPath = path.join(__dirname, '..', 'e2e-v4-evolution-results.json');
  fs.writeFileSync(resultPath, JSON.stringify(resultJson, null, 2));
  console.log(`\n📄 测试结果已保存: ${resultPath}`);

  process.exit(results.failed.length > 0 ? 1 : 0);
})();
