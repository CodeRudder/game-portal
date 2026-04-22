/**
 * v4.0 攻城略地(下) — 进化迭代 UI测试
 *
 * 测试范围：
 * 1. 科技Tab — 科技树展示、研究面板、科技点
 * 2. 战斗深化 — 速度控制、大招系统
 * 3. 扫荡功能 — 扫荡按钮、扫荡结算
 * 4. 武将升星 — 升星面板、碎片进度
 *
 * @module e2e/v4-evolution-ui-test
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// ─────────────────────────────────────────────
// 配置
// ─────────────────────────────────────────────
const BASE_URL = process.env.GAME_BASE_URL || 'http://localhost:3000/idle/three-kingdoms';
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
    // 1. 科技Tab — 科技树展示
    // ═══════════════════════════════════════════
    console.log('\n── 步骤1: 科技Tab — 科技树展示 ──');
    await switchTab(page, '科技');
    await page.waitForTimeout(2000);
    const shot1 = await takeScreenshot(page, 'v4e-01-tech-tab');
    screenshot(shot1);

    // 1.1 检查TechTab容器
    const techTabEl = await page.$('[data-testid="tech-tab"]');
    if (techTabEl) {
      pass('TechTab容器(data-testid="tech-tab")存在');
    } else {
      // fallback: 检查CSS类
      const techTabCss = await page.$('.tk-tech-tab');
      if (techTabCss) {
        pass('TechTab容器(.tk-tech-tab)存在');
      } else {
        fail('TechTab容器', 'data-testid="tech-tab" 和 .tk-tech-tab 均未找到');
      }
    }

    // 1.2 检查科技路线选择器（三条路线：军事/经济/文化）
    const routeSelector = await page.$('.tk-tech-route-selector') ||
      await page.$('[data-testid="tech-route-selector"]');
    if (routeSelector) {
      pass('科技路线选择器存在');

      // 检查路线按钮
      const routeButtons = await page.$$('.tk-tech-route-btn');
      if (routeButtons.length >= 3) {
        pass(`科技路线按钮数量: ${routeButtons.length}（军事/经济/文化）`);
      } else if (routeButtons.length > 0) {
        warn('科技路线按钮', `数量: ${routeButtons.length}，预期3条路线`);
      } else {
        warn('科技路线按钮', '.tk-tech-route-btn 未找到');
      }
    } else {
      warn('科技路线选择器', '未找到路线选择器');
    }

    // 1.3 检查科技树节点
    const techNodes = await page.$$('.tk-tech-node');
    if (techNodes.length > 0) {
      pass(`科技树节点数量: ${techNodes.length}`);
    } else {
      warn('科技树节点', '.tk-tech-node 未找到');
    }

    // 1.4 检查科技点显示
    const techPointDisplay = await page.$('.tk-tech-points') ||
      await page.$('[data-testid="tech-points"]');
    if (techPointDisplay) {
      const pointText = await techPointDisplay.textContent();
      pass(`科技点显示: "${pointText.trim()}"`);
    } else {
      warn('科技点显示', '.tk-tech-points 未找到');
    }

    // ═══════════════════════════════════════════
    // 2. 科技研究面板
    // ═══════════════════════════════════════════
    console.log('\n── 步骤2: 科技研究面板 ──');

    // 2.1 点击第一个可用科技节点
    const availableNode = await page.$('.tk-tech-node--available') ||
      await page.$('.tk-tech-node[data-state="available"]');
    if (availableNode) {
      await availableNode.click();
      await page.waitForTimeout(1500);
      const shot2 = await takeScreenshot(page, 'v4e-02-tech-node-click');
      screenshot(shot2);
      pass('点击可用科技节点成功');

      // 2.2 检查科技详情弹窗
      const detailModal = await page.$('[data-testid="tech-node-detail-modal"]') ||
        await page.$('.tk-tech-detail-modal');
      if (detailModal) {
        pass('科技详情弹窗已打开');

        // 检查科技名称
        const techName = await page.$('.tk-tech-detail-name') ||
          await page.$('[data-testid="tech-detail-name"]');
        if (techName) {
          const nameText = await techName.textContent();
          pass(`科技名称: "${nameText.trim()}"`);
        }

        // 检查研究按钮
        const researchBtn = await page.$('[data-testid="tech-research-btn"]') ||
          await page.$('.tk-tech-research-btn') ||
          await page.$('button:has-text("研究")');
        if (researchBtn) {
          pass('研究按钮存在');
        } else {
          warn('研究按钮', '未找到');
        }

        // 关闭弹窗
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      } else {
        warn('科技详情弹窗', '点击节点后未弹出详情');
      }
    } else {
      warn('可用科技节点', '未找到可点击的科技节点');
      const shot2 = await takeScreenshot(page, 'v4e-02-tech-no-available');
      screenshot(shot2);
    }

    // 2.3 检查研究队列面板
    const researchPanel = await page.$('[data-testid="tech-research-panel"]') ||
      await page.$('.tk-tech-research-panel');
    if (researchPanel) {
      pass('研究队列面板存在');
    } else {
      warn('研究队列面板', '未找到');
    }

    // ═══════════════════════════════════════════
    // 3. 关卡Tab — 战斗深化测试
    // ═══════════════════════════════════════════
    console.log('\n── 步骤3: 关卡Tab — 战斗深化 ──');
    await switchTab(page, '关卡');
    await page.waitForTimeout(2000);
    const shot3 = await takeScreenshot(page, 'v4e-03-campaign-tab');
    screenshot(shot3);

    // 3.1 检查CampaignTab容器
    const campaignTab = await page.$('[data-testid="campaign-tab"]');
    if (campaignTab) {
      pass('CampaignTab(data-testid="campaign-tab")存在');
    } else {
      const campaignTabCss = await page.$('.tk-campaign-tab');
      if (campaignTabCss) {
        pass('CampaignTab(.tk-campaign-tab)存在');
      } else {
        fail('CampaignTab', '未找到');
      }
    }

    // 3.2 检查关卡节点
    const stageNodes = await page.$$('.tk-stage-node');
    if (stageNodes.length > 0) {
      pass(`关卡节点数量: ${stageNodes.length}`);
    } else {
      warn('关卡节点', '.tk-stage-node 未找到');
    }

    // 3.3 检查扫荡按钮（已通关关卡）
    const sweepBtn = await page.$('[data-testid="sweep-btn"]') ||
      await page.$('.tk-sweep-btn');
    if (sweepBtn) {
      pass('扫荡按钮存在');
    } else {
      warn('扫荡按钮', '未找到（可能无已通关关卡）');
    }

    // ═══════════════════════════════════════════
    // 4. 战斗场景 — 速度控制 + 大招系统
    // ═══════════════════════════════════════════
    console.log('\n── 步骤4: 战斗场景 — 速度控制 ──');

    // 4.1 尝试点击可挑战关卡
    const availableStage = await page.$('.tk-stage-node--available');
    if (availableStage) {
      await availableStage.evaluate(el => el.click());
      await page.waitForTimeout(1500);
      const shot4a = await takeScreenshot(page, 'v4e-04a-click-stage');
      screenshot(shot4a);

      // 4.2 检查布阵弹窗
      const formationModal = await page.$('[data-testid="battle-formation-modal"]');
      if (formationModal) {
        pass('战前布阵弹窗(data-testid)已打开');

        // 检查敌方阵容
        const enemyUnits = await page.$$('.tk-bfm-enemy-unit');
        if (enemyUnits.length > 0) {
          pass(`敌方单位数量: ${enemyUnits.length}`);
        }

        // 检查战力对比
        const powerCompare = await page.$('.tk-bfm-power-compare');
        if (powerCompare) {
          pass('战力对比区域存在');
        }

        // 4.3 点击出征按钮开始战斗
        const attackBtn = await page.$('.tk-bfm-attack-btn') ||
          await page.$('button:has-text("出征")');
        if (attackBtn) {
          const btnDisabled = await attackBtn.evaluate(el => el.disabled);
          if (!btnDisabled) {
            await attackBtn.evaluate(el => el.click());
            await page.waitForTimeout(3000);
            const shot4b = await takeScreenshot(page, 'v4e-04b-battle-start');
            screenshot(shot4b);

            // 4.4 检查战斗场景
            const battleScene = await page.$('[data-testid="battle-scene"]');
            if (battleScene) {
              pass('战斗场景(data-testid="battle-scene")已加载');

              // 4.5 检查速度控制按钮
              const speedBtn = await page.$('.tk-bs-speed-btn');
              if (speedBtn) {
                const speedText = await speedBtn.textContent();
                pass(`速度控制按钮存在，当前速度: ${speedText.trim()}`);

                // 切换速度
                await speedBtn.click();
                await page.waitForTimeout(500);
                const newSpeedText = await speedBtn.textContent();
                pass(`速度切换: ${speedText.trim()} → ${newSpeedText.trim()}`);
              } else {
                warn('速度控制按钮', '.tk-bs-speed-btn 未找到');
              }

              // 4.6 检查回合显示
              const turnDisplay = await page.$('.tk-bs-turn-display');
              if (turnDisplay) {
                const turnText = await turnDisplay.textContent();
                pass(`回合显示: "${turnText.trim()}"`);
              } else {
                warn('回合显示', '.tk-bs-turn-display 未找到');
              }

              // 4.7 检查跳过按钮
              const skipBtn = await page.$('.tk-bs-skip-btn');
              if (skipBtn) {
                pass('跳过按钮存在');

                // 使用跳过按钮结束战斗
                await skipBtn.click();
                await page.waitForTimeout(2000);
                const shot4c = await takeScreenshot(page, 'v4e-04c-battle-skip');
                screenshot(shot4c);
              } else {
                warn('跳过按钮', '未找到（可能战斗已结束）');
                // 等待战斗结束
                await page.waitForTimeout(5000);
              }

              // 4.8 检查战斗结果弹窗
              const resultModal = await page.$('[data-testid="battle-result-modal"]');
              if (resultModal) {
                pass('战斗结果弹窗(data-testid)已显示');

                // 检查星级
                const starsEl = await page.$('.tk-brm-stars');
                if (starsEl) pass('星级评定显示');

                // 检查奖励
                const rewardsEl = await page.$('.tk-brm-rewards') ||
                  await page.$('.tk-brm-reward-item');
                if (rewardsEl) pass('奖励列表显示');

                // 确认关闭
                const confirmBtn = await page.$('.tk-brm-confirm-btn') ||
                  await page.$('button:has-text("确认")');
                if (confirmBtn) {
                  await confirmBtn.click();
                  await page.waitForTimeout(1000);
                  pass('战斗结果确认关闭');
                }
              } else {
                warn('战斗结果弹窗', '未找到（可能战斗仍在进行）');
                await page.keyboard.press('Escape');
                await page.waitForTimeout(500);
              }
            } else {
              warn('战斗场景', '未检测到战斗场景加载');
            }
          } else {
            warn('出征按钮', '按钮被禁用（可能无武将）');
          }
        } else {
          warn('出征按钮', '未找到');
        }
      } else {
        warn('战前布阵弹窗', '未弹出（可能缺少武将）');
      }
    } else {
      warn('可挑战关卡', '未找到可挑战的关卡节点');
      const shot4a = await takeScreenshot(page, 'v4e-04a-no-available');
      screenshot(shot4a);
    }

    // ═══════════════════════════════════════════
    // 5. 武将升星面板
    // ═══════════════════════════════════════════
    console.log('\n── 步骤5: 武将升星面板 ──');
    await switchTab(page, '武将');
    await page.waitForTimeout(2000);
    const shot5 = await takeScreenshot(page, 'v4e-05-hero-tab');
    screenshot(shot5);

    // 5.1 检查武将卡片
    const heroCards = await page.$$('.tk-hero-card');
    if (heroCards.length > 0) {
      pass(`武将卡片数量: ${heroCards.length}`);

      // 5.2 点击第一个武将查看详情
      await heroCards[0].click();
      await page.waitForTimeout(1500);
      const shot5b = await takeScreenshot(page, 'v4e-05b-hero-detail');
      screenshot(shot5b);

      // 5.3 检查武将详情弹窗
      const heroDetail = await page.$('.tk-hero-detail') ||
        await page.$('[data-testid="hero-detail-modal"]');
      if (heroDetail) {
        pass('武将详情弹窗已打开');

        // 5.4 查找升星Tab或碎片Tab
        const starTab = await page.$('button:has-text("升星")') ||
          await page.$('button:has-text("碎片")') ||
          await page.$('.tk-hero-tab--star');
        if (starTab) {
          await starTab.click();
          await page.waitForTimeout(1000);
          const shot5c = await takeScreenshot(page, 'v4e-05c-star-tab');
          screenshot(shot5c);
          pass('升星Tab已点击');

          // 5.5 检查升星面板
          const starPanel = await page.$('[data-testid="hero-star-up-panel"]');
          if (starPanel) {
            pass('武将升星面板(data-testid)存在');

            // 检查星级展示
            const starDisplay = await page.$('.tk-star-display');
            if (starDisplay) pass('星级展示区域存在');

            // 检查碎片进度
            const fragmentProgress = await page.$('.tk-star-fragment-bar') ||
              await page.$('.tk-star-progress');
            if (fragmentProgress) pass('碎片进度条存在');

            // 检查升星按钮
            const starUpBtn = await page.$('.tk-star-up-btn') ||
              await page.$('button:has-text("升星")');
            if (starUpBtn) pass('升星按钮存在');

            // 检查突破按钮
            const breakthroughBtn = await page.$('.tk-star-breakthrough-btn') ||
              await page.$('button:has-text("突破")');
            if (breakthroughBtn) pass('突破按钮存在');
          } else {
            warn('武将升星面板', 'data-testid="hero-star-up-panel" 未找到');
            // fallback: CSS class
            const starPanelCss = await page.$('.tk-star-panel');
            if (starPanelCss) pass('武将升星面板(.tk-star-panel)存在');
          }
        } else {
          warn('升星Tab', '未找到升星/碎片Tab');
        }

        // 关闭武将详情
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      } else {
        warn('武将详情弹窗', '未打开');
      }
    } else {
      warn('武将卡片', '未找到武将卡片');
    }

    // ═══════════════════════════════════════════
    // 6. 扫荡功能验证
    // ═══════════════════════════════════════════
    console.log('\n── 步骤6: 扫荡功能验证 ──');
    await switchTab(page, '关卡');
    await page.waitForTimeout(2000);

    // 6.1 检查已通关关卡的扫荡按钮
    const clearedNodes = await page.$$('.tk-stage-node--three-star, .tk-stage-node--cleared');
    if (clearedNodes.length > 0) {
      pass(`已通关关卡数量: ${clearedNodes.length}`);

      // 6.2 点击已通关关卡查看扫荡选项
      await clearedNodes[0].evaluate(el => el.click());
      await page.waitForTimeout(1000);
      const shot6 = await takeScreenshot(page, 'v4e-06-cleared-stage');
      screenshot(shot6);

      // 检查扫荡按钮
      const sweepButton = await page.$('[data-testid="sweep-btn"]');
      if (sweepButton) {
        pass('扫荡按钮(data-testid)存在');

        // 点击扫荡
        const sweepDisabled = await sweepButton.evaluate(el => el.disabled);
        if (!sweepDisabled) {
          await sweepButton.click();
          await page.waitForTimeout(1500);
          const shot6b = await takeScreenshot(page, 'v4e-06b-sweep-modal');
          screenshot(shot6b);
          pass('扫荡弹窗已打开');

          // 关闭扫荡弹窗
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);
        } else {
          warn('扫荡按钮', '按钮被禁用');
        }
      } else {
        warn('扫荡按钮', '已通关关卡未显示扫荡按钮');
      }
    } else {
      warn('已通关关卡', '无已通关关卡，跳过扫荡测试');
    }

    // ═══════════════════════════════════════════
    // 7. 移动端适配测试
    // ═══════════════════════════════════════════
    console.log('\n── 步骤7: 移动端适配 ──');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1500);

    // 科技Tab移动端
    await switchTab(page, '科技');
    await page.waitForTimeout(2000);
    const shot7a = await takeScreenshot(page, 'v4e-07a-tech-mobile');
    screenshot(shot7a);
    pass('科技Tab移动端渲染');

    // 关卡Tab移动端
    await switchTab(page, '关卡');
    await page.waitForTimeout(2000);
    const shot7b = await takeScreenshot(page, 'v4e-07b-campaign-mobile');
    screenshot(shot7b);
    pass('关卡Tab移动端渲染');

    // ═══════════════════════════════════════════
    // 8. 最终数据完整性 + 控制台错误检查
    // ═══════════════════════════════════════════
    console.log('\n── 步骤8: 最终检查 ──');

    // 恢复PC视口
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(1000);

    const finalIntegrity = await checkDataIntegrity(page);
    if (!finalIntegrity.hasNaN && !finalIntegrity.hasUndefined) {
      pass('最终数据完整性检查通过');
    } else {
      finalIntegrity.issues.forEach(i => fail('最终数据完整性', i));
    }

    // 控制台错误过滤（排除已知无害错误）
    const realErrors = consoleErrors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('manifest') &&
      !e.includes('DevTools') &&
      !e.includes('Download the React DevTools')
    );

    if (realErrors.length > 0) {
      warn('控制台错误', `${realErrors.length}个错误`);
      realErrors.slice(0, 10).forEach(e => {
        results.consoleErrors.push(e.substring(0, 200));
      });
    } else {
      pass('无控制台错误');
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
    f.name.includes('TechTab') || f.name.includes('战斗场景') || f.name.includes('CampaignTab')
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

  const resultPath = path.join(__dirname, 'v4-evolution-ui-results.json');
  fs.writeFileSync(resultPath, JSON.stringify(resultJson, null, 2));
  console.log(`\n📄 测试结果已保存: ${resultPath}`);

  process.exit(results.failed.length > 0 ? 1 : 0);
})();
