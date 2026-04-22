/**
 * v3.0 攻城略地(上) — 进化迭代 UI测试
 *
 * 测试范围：
 * 1. 关卡Tab — 点击关卡Tab，检查关卡地图是否显示
 * 2. 章节选择 — 检查章节选择UI
 * 3. 关卡列表 — 检查关卡列表/节点
 * 4. 战斗功能 — 点击关卡开始战斗，检查战斗场景
 * 5. 战斗结果 — 检查战斗结算界面（星级、奖励）
 * 6. 扫荡功能 — 检查扫荡按钮和扫荡弹窗
 * 7. 关卡进度 — 检查当前进度显示
 * 8. 移动端适配
 *
 * @module e2e/v3-evolution-ui-test
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// ─────────────────────────────────────────────
// 配置
// ─────────────────────────────────────────────
const BASE_URL = process.env.GAME_BASE_URL || 'http://localhost:3000/idle/three-kingdoms';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots', 'v3-evolution');

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

  // 如果有新手引导覆盖层，点击跳过
  const guideSkip = await page.$('.tk-guide-btn--skip');
  if (guideSkip) {
    await guideSkip.click();
    await page.waitForTimeout(1000);
  }

  // 如果仍有引导遮罩，用 Escape 关闭
  const guideOverlay = await page.$('.tk-guide-overlay');
  if (guideOverlay) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }
}

async function switchTab(page, tabName) {
  // 先关闭可能遮挡的弹窗
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  const tab = await page.$(`button:has-text("${tabName}")`);
  if (!tab) throw new Error(`Tab未找到: ${tabName}`);
  await tab.click();
  await page.waitForTimeout(1500);
}

async function closeAllModals(page) {
  // 尝试 Escape 关闭弹窗
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // 检查关闭按钮
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
  console.log('  v3.0 攻城略地(上) — 进化迭代 UI测试 R1');
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
    const shot0 = await takeScreenshot(page, 'v3e-00-main');
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
    // 0.5 预备：招募武将（确保有武将可以布阵出战）
    // ═══════════════════════════════════════════
    console.log('\n── 步骤0.5: 预备 — 招募武将 ──');
    await switchTab(page, '武将');
    await page.waitForTimeout(1500);

    let heroCards = await page.$$('.tk-hero-card');
    console.log(`    当前武将数量: ${heroCards.length}`);

    if (heroCards.length === 0) {
      // 尝试招募
      const recruitBtn = await page.$('.tk-hero-recruit-btn') ||
        await page.$('.tk-hero-empty-btn') ||
        await page.$('button:has-text("招募")');
      if (recruitBtn) {
        await recruitBtn.click();
        await page.waitForTimeout(1500);

        // 在招募弹窗中点击单次招募
        const recruitOnceBtn = await page.$('.tk-recruit-btn:not(.tk-recruit-btn--ten)') ||
          await page.$('button:has-text("招募一次")');
        if (recruitOnceBtn) {
          const btnDisabled = await recruitOnceBtn.evaluate(el => el.disabled);
          if (!btnDisabled) {
            await recruitOnceBtn.click();
            await page.waitForTimeout(2500);
            const shotRecruit = await takeScreenshot(page, 'v3e-00b-recruit');
            screenshot(shotRecruit);
            pass('单次招募点击成功');

            // 关闭招募结果
            await page.waitForTimeout(2000);
            const resultsCloseBtn = await page.$('.tk-recruit-results-close') ||
              await page.$('button:has-text("确认")');
            if (resultsCloseBtn) {
              await resultsCloseBtn.click();
              await page.waitForTimeout(1000);
            }
          } else {
            warn('招募按钮', '招募按钮被禁用（可能资源不足）');
          }
        }

        // 关闭招募弹窗
        const recruitCloseBtn = await page.$('.tk-recruit-close') ||
          await page.$('button:has-text("关闭")');
        if (recruitCloseBtn) {
          await recruitCloseBtn.click();
          await page.waitForTimeout(1000);
        }
      } else {
        warn('招募按钮', '未找到招募入口');
      }
    } else {
      pass(`已有${heroCards.length}名武将，无需招募`);
    }

    // ═══════════════════════════════════════════
    // 1. 关卡Tab — 点击关卡Tab，检查关卡地图是否显示
    // ═══════════════════════════════════════════
    console.log('\n── 步骤1: 关卡Tab — 检查关卡地图 ──');
    await switchTab(page, '关卡');
    await page.waitForTimeout(2000);
    const shot1 = await takeScreenshot(page, 'v3e-01-campaign-tab');
    screenshot(shot1);

    // 1.1 检查CampaignTab容器
    const campaignTabEl = await page.$('.tk-campaign-tab');
    if (campaignTabEl) {
      pass('CampaignTab容器(.tk-campaign-tab)存在');
    } else {
      fail('CampaignTab容器', '.tk-campaign-tab 未找到');
    }

    // 1.2 检查关卡地图区域
    const campaignMap = await page.$('.tk-campaign-map');
    if (campaignMap) {
      pass('关卡地图区域(.tk-campaign-map)存在');

      // 检查地图轨道（滚动容器）
      const mapTrack = await page.$('.tk-campaign-map-track');
      if (mapTrack) pass('关卡地图轨道(.tk-campaign-map-track)存在');
      else warn('关卡地图轨道', '.tk-campaign-map-track 未找到');

      // 检查地图包装器
      const mapWrapper = await page.$('.tk-campaign-map-wrapper');
      if (mapWrapper) pass('关卡地图包装器(.tk-campaign-map-wrapper)存在');
    } else {
      fail('关卡地图区域', '.tk-campaign-map 未找到');
    }

    // ═══════════════════════════════════════════
    // 2. 章节选择 — 检查章节选择UI
    // ═══════════════════════════════════════════
    console.log('\n── 步骤2: 章节选择UI ──');

    // 2.1 章节选择器
    const chapterSelector = await page.$('.tk-chapter-selector');
    if (chapterSelector) {
      pass('章节选择器(.tk-chapter-selector)存在');

      // 2.2 章节标题
      const chapterTitle = await page.$('.tk-chapter-title');
      if (chapterTitle) {
        const titleText = await chapterTitle.textContent();
        pass(`章节标题显示: "${titleText.trim()}"`);
      } else {
        fail('章节标题', '.tk-chapter-title 未找到');
      }

      // 2.3 章节副标题
      const chapterSubtitle = await page.$('.tk-chapter-subtitle');
      if (chapterSubtitle) {
        const subText = await chapterSubtitle.textContent();
        pass(`章节副标题: "${subText.trim()}"`);
      } else {
        warn('章节副标题', '.tk-chapter-subtitle 未找到');
      }

      // 2.4 章节信息
      const chapterInfo = await page.$('.tk-chapter-info');
      if (chapterInfo) pass('章节信息(.tk-chapter-info)存在');

      // 2.5 章节切换箭头
      const leftArrow = await page.$('.tk-chapter-arrow--left');
      const rightArrow = await page.$('.tk-chapter-arrow--right');
      if (leftArrow && rightArrow) {
        pass('章节切换箭头(左/右)存在');

        // 2.6 尝试点击下一章
        const rightDisabled = await page.$eval('.tk-chapter-arrow--right', el => el.disabled).catch(() => true);
        if (!rightDisabled) {
          await page.$eval('.tk-chapter-arrow--right', el => el.click());
          await page.waitForTimeout(800);
          const shot2b = await takeScreenshot(page, 'v3e-02b-chapter-next');
          screenshot(shot2b);
          pass('切换到下一章成功');

          // 切回第一章
          const leftDisabled = await page.$eval('.tk-chapter-arrow--left', el => el.disabled).catch(() => true);
          if (!leftDisabled) {
            await page.$eval('.tk-chapter-arrow--left', el => el.click());
            await page.waitForTimeout(800);
            pass('切回第一章成功');
          }
        } else {
          warn('章节切换', '当前已是最后一章或无下一章可用');
        }
      } else {
        warn('章节切换箭头', '左/右箭头缺失');
      }
    } else {
      fail('章节选择器', '.tk-chapter-selector 未找到');
    }

    // ═══════════════════════════════════════════
    // 3. 关卡列表 — 检查关卡列表/节点
    // ═══════════════════════════════════════════
    console.log('\n── 步骤3: 关卡列表/节点 ──');

    // 3.1 关卡节点
    const stageNodes = await page.$$('.tk-stage-node');
    if (stageNodes.length > 0) {
      pass(`关卡节点数量: ${stageNodes.length}`);
    } else {
      fail('关卡节点', '未找到任何.tk-stage-node');
    }

    // 3.2 关卡状态分类
    const lockedNodes = await page.$$('.tk-stage-node--locked');
    const availableNodes = await page.$$('.tk-stage-node--available');
    const clearedNodes = await page.$$('.tk-stage-node--cleared');
    const threeStarNodes = await page.$$('.tk-stage-node--three-star');
    console.log(`    关卡状态: 锁定=${lockedNodes.length}, 可挑战=${availableNodes.length}, 已通关=${clearedNodes.length}, 三星=${threeStarNodes.length}`);
    pass(`关卡状态分类正常 (锁定/可挑战/已通关/三星)`);

    // 3.3 锁定关卡🔒
    if (lockedNodes.length > 0) {
      const lockIcon = await lockedNodes[0].$('.tk-stage-node-lock');
      if (lockIcon) pass('锁定关卡显示🔒图标(.tk-stage-node-lock)');
      else warn('锁定关卡', '未找到.tk-stage-node-lock图标');
    }

    // 3.4 关卡节点详情
    if (stageNodes.length > 0) {
      const firstNode = stageNodes[0];
      const nodeName = await firstNode.$('.tk-stage-node-name');
      const nodeType = await firstNode.$('.tk-stage-node-type');
      const nodePower = await firstNode.$('.tk-stage-node-power');
      const nodeOrder = await firstNode.$('.tk-stage-node-order');
      const nodeIcon = await firstNode.$('.tk-stage-node-icon');
      const nodeCircle = await firstNode.$('.tk-stage-node-circle');

      if (nodeName) {
        const nameText = await nodeName.textContent();
        pass(`关卡名称: "${nameText.trim()}"`);
      } else {
        fail('关卡名称', '.tk-stage-node-name 未找到');
      }

      if (nodeType) {
        const typeText = await nodeType.textContent();
        pass(`关卡类型: "${typeText.trim()}"`);
      } else {
        warn('关卡类型', '.tk-stage-node-type 未找到');
      }

      if (nodePower) {
        const powerText = await nodePower.textContent();
        pass(`推荐战力: "${powerText.trim()}"`);
      }

      if (nodeOrder) pass('关卡序号(.tk-stage-node-order)存在');
      if (nodeIcon) pass('关卡图标(.tk-stage-node-icon)存在');
      if (nodeCircle) pass('关卡圆圈(.tk-stage-node-circle)存在');
    }

    // 3.5 星级显示
    const starElements = await page.$$('.tk-stage-star');
    if (starElements.length > 0) {
      const filledStars = await page.$$('.tk-stage-star--filled');
      const emptyStars = await page.$$('.tk-stage-star--empty');
      pass(`关卡星级元素: ${starElements.length} (填充=${filledStars.length}, 空=${emptyStars.length})`);
    } else {
      warn('星级元素', '未找到.tk-stage-star（可能初始无已通关关卡）');
    }

    // 3.6 关卡连接线
    const connectors = await page.$$('.tk-stage-connector');
    if (connectors.length > 0) pass(`关卡连接线数量: ${connectors.length}`);
    else warn('关卡连接线', '未找到.tk-stage-connector');

    // 3.7 关卡节点星级区域
    const nodeStars = await page.$$('.tk-stage-node-stars');
    if (nodeStars.length > 0) pass(`关卡节点星级区域: ${nodeStars.length}个`);

    const shot3 = await takeScreenshot(page, 'v3e-03-stage-nodes');
    screenshot(shot3);

    // ═══════════════════════════════════════════
    // 4. 战斗功能 — 点击关卡开始战斗
    // ═══════════════════════════════════════════
    console.log('\n── 步骤4: 战斗功能 — 点击关卡开始战斗 ──');

    let availableNode = await page.$('.tk-stage-node--available');
    if (!availableNode) {
      availableNode = await page.$('.tk-stage-node:not(.tk-stage-node--locked)');
    }

    if (availableNode) {
      await availableNode.click();
      await page.waitForTimeout(1500);
      const shot4 = await takeScreenshot(page, 'v3e-04-formation-modal');
      screenshot(shot4);

      // 4.1 检查布阵弹窗
      const bfmModal = await page.$('.tk-bfm-modal');
      const bfmOverlay = await page.$('.tk-bfm-overlay');
      if (bfmModal || bfmOverlay) {
        pass('战前布阵弹窗已打开(tk-bfm-modal/overlay)');
      } else {
        fail('战前布阵弹窗', '未找到.tk-bfm-modal或.tk-bfm-overlay');
      }

      // 4.2 弹窗头部
      const bfmHeader = await page.$('.tk-bfm-header');
      if (bfmHeader) pass('布阵弹窗头部(.tk-bfm-header)存在');

      // 4.3 关卡描述
      const descEl = await page.$('.tk-bfm-desc');
      if (descEl) {
        const descText = await descEl.textContent();
        pass(`关卡描述: "${descText.trim().substring(0, 50)}"`);
      } else {
        warn('关卡描述', '.tk-bfm-desc 未找到');
      }

      // 4.4 敌方阵容
      const enemySection = await page.$('.tk-bfm-enemy-units');
      if (enemySection) {
        pass('敌方阵容区域(.tk-bfm-enemy-units)存在');
        const enemyUnits = await page.$$('.tk-bfm-enemy-unit');
        if (enemyUnits.length > 0) {
          pass(`敌方单位数量: ${enemyUnits.length}`);
          // 检查第一个敌方单位详情
          const firstEnemy = enemyUnits[0];
          const enemyAvatar = await firstEnemy.$('.tk-bfm-enemy-avatar');
          const enemyName = await firstEnemy.$('.tk-bfm-enemy-name');
          const enemyLevel = await firstEnemy.$('.tk-bfm-enemy-level');
          const enemyPos = await firstEnemy.$('.tk-bfm-enemy-pos');
          const enemyInfo = await firstEnemy.$('.tk-bfm-enemy-info');
          if (enemyAvatar) pass('敌方头像(.tk-bfm-enemy-avatar)存在');
          if (enemyName) {
            const t = await enemyName.textContent();
            pass(`敌方名称: "${t.trim()}"`);
          }
          if (enemyLevel) pass('敌方等级(.tk-bfm-enemy-level)存在');
          if (enemyPos) pass('敌方位置(.tk-bfm-enemy-pos)存在');
        } else {
          warn('敌方单位', '未找到.tk-bfm-enemy-unit');
        }
      } else {
        fail('敌方阵容区域', '.tk-bfm-enemy-units 未找到');
      }

      // 4.5 战力对比
      const powerCompare = await page.$('.tk-bfm-power-compare');
      if (powerCompare) {
        pass('战力对比区域(.tk-bfm-power-compare)存在');

        const allyPower = await page.$('.tk-bfm-power-ally .tk-bfm-power-value');
        const enemyPower = await page.$('.tk-bfm-power-enemy .tk-bfm-power-value');
        const powerRatio = await page.$('.tk-bfm-power-ratio');
        const powerVs = await page.$('.tk-bfm-power-vs');

        if (allyPower) {
          const t = await allyPower.textContent();
          pass(`我方战力: ${t.trim()}`);
        }
        if (enemyPower) {
          const t = await enemyPower.textContent();
          pass(`推荐战力: ${t.trim()}`);
        }
        if (powerRatio) {
          const t = await powerRatio.textContent();
          pass(`战力评估: ${t.trim()}`);
        }
        if (powerVs) pass('VS标识(.tk-bfm-power-vs)存在');

        // 战力状态标签
        const powerDanger = await page.$('.tk-bfm-power--danger');
        const powerEven = await page.$('.tk-bfm-power--even');
        const powerAdvantage = await page.$('.tk-bfm-power--advantage');
        const powerCrush = await page.$('.tk-bfm-power--crush');
        if (powerDanger) pass('战力状态: 危险');
        else if (powerEven) pass('战力状态: 势均力敌');
        else if (powerAdvantage) pass('战力状态: 占优');
        else if (powerCrush) pass('战力状态: 碾压');
        else warn('战力状态', '未找到战力状态标签');
      } else {
        fail('战力对比', '.tk-bfm-power-compare 未找到');
      }

      // 4.6 我方编队
      const allySlots = await page.$$('.tk-bfm-ally-slot');
      if (allySlots.length > 0) {
        pass(`我方编队槽位: ${allySlots.length}`);
        const filledSlots = await page.$$('.tk-bfm-ally-slot--filled');
        const emptySlots = await page.$$('.tk-bfm-ally-slot--empty');
        pass(`编队状态: 已填充=${filledSlots.length}, 空位=${emptySlots.length}`);

        // 检查已填充槽位详情
        if (filledSlots.length > 0) {
          const firstFilled = filledSlots[0];
          const allyAvatar = await firstFilled.$('.tk-bfm-ally-avatar');
          const allyName = await firstFilled.$('.tk-bfm-ally-name');
          const allyPower = await firstFilled.$('.tk-bfm-ally-power');
          const allyQuality = await firstFilled.$('.tk-bfm-ally-quality');
          if (allyAvatar) pass('我方武将头像(.tk-bfm-ally-avatar)存在');
          if (allyName) {
            const t = await allyName.textContent();
            pass(`我方武将名称: "${t.trim()}"`);
          }
          if (allyPower) pass('我方武将战力(.tk-bfm-ally-power)存在');
          if (allyQuality) pass('我方武将品质(.tk-bfm-ally-quality)存在');
        }

        // 检查空槽位
        if (emptySlots.length > 0) {
          const placeholder = await emptySlots[0].$('.tk-bfm-ally-placeholder');
          if (placeholder) pass('空槽位占位符(.tk-bfm-ally-placeholder)存在');
        }
      } else {
        warn('我方编队', '.tk-bfm-ally-slot 未找到');
      }

      // 4.7 编队行标签
      const allyRows = await page.$$('.tk-bfm-ally-row');
      if (allyRows.length >= 2) pass(`编队行: ${allyRows.length}行`);

      // 4.8 编队计数
      const formationCount = await page.$('.tk-bfm-formation-count');
      if (formationCount) {
        const t = await formationCount.textContent();
        pass(`编队计数: "${t.trim()}"`);
      }

      // 4.9 操作按钮
      const cancelBtn = await page.$('.tk-bfm-btn--cancel');
      const autoBtn = await page.$('.tk-bfm-btn--auto');
      const fightBtn = await page.$('.tk-bfm-btn--fight');

      if (cancelBtn) pass('取消按钮(.tk-bfm-btn--cancel)存在');

      if (autoBtn) {
        pass('一键布阵按钮(.tk-bfm-btn--auto)存在');

        // 4.10 测试一键布阵
        await autoBtn.click();
        await page.waitForTimeout(1000);
        const shot4b = await takeScreenshot(page, 'v3e-04b-auto-formation');
        screenshot(shot4b);
        pass('一键布阵点击成功');

        const filledAfterAuto = await page.$$('.tk-bfm-ally-slot--filled');
        if (filledAfterAuto.length > 0) {
          pass(`一键布阵后已填充: ${filledAfterAuto.length}`);
        } else {
          warn('一键布阵', '布阵后无已填充槽位（可能无可用武将）');
        }
      } else {
        warn('一键布阵按钮', '.tk-bfm-btn--auto 未找到');
      }

      if (fightBtn) {
        const fightText = await fightBtn.textContent();
        const isDisabled = await fightBtn.evaluate(el => el.disabled);
        pass(`出征按钮 (文本: "${fightText.trim()}", 禁用: ${isDisabled})`);

        // ═══════════════════════════════════════════
        // 4.11 点击出征 → 进入战斗场景
        // ═══════════════════════════════════════════
        if (!isDisabled) {
          console.log('\n  ── 步骤4.11: 点击出征 → 进入战斗场景 ──');
          await fightBtn.click();
          await page.waitForTimeout(3000);
          const shot4c = await takeScreenshot(page, 'v3e-04c-battle-scene');
          screenshot(shot4c);

          // 检查战斗场景覆盖层
          let battleOverlay = await page.$('.tk-bs-overlay');
          if (!battleOverlay) {
            await page.waitForTimeout(3000);
            battleOverlay = await page.$('.tk-bs-overlay');
          }
          if (battleOverlay) {
            pass('战斗场景覆盖层(.tk-bs-overlay)存在');
          } else {
            fail('战斗场景', '.tk-bs-overlay 未找到');
          }

          // 4.12 顶部信息栏
          const topBar = await page.$('.tk-bs-top-bar');
          if (topBar) {
            pass('战斗顶部信息栏(.tk-bs-top-bar)存在');

            const stageInfo = await page.$('.tk-bs-stage-info');
            const stageName = await page.$('.tk-bs-stage-name');
            const stageType = await page.$('.tk-bs-stage-type');
            const turnDisplay = await page.$('.tk-bs-turn-display');
            const controls = await page.$('.tk-bs-controls');

            if (stageInfo) {
              const t = await stageInfo.textContent();
              pass(`关卡信息: "${t.trim()}"`);
            }
            if (stageName) {
              const t = await stageName.textContent();
              pass(`关卡名称: "${t.trim()}"`);
            }
            if (stageType) {
              const t = await stageType.textContent();
              pass(`关卡类型: "${t.trim()}"`);
            }
            if (turnDisplay) {
              const t = await turnDisplay.textContent();
              pass(`回合数: "${t.trim()}"`);
            }
            if (controls) pass('战斗控制按钮区域存在');
          } else {
            warn('战斗顶部信息栏', '.tk-bs-top-bar 未找到');
          }

          // 4.13 战场区域
          const battlefield = await page.$('.tk-bs-battlefield');
          if (battlefield) pass('战场主区域(.tk-bs-battlefield)存在');

          // 4.14 阵营
          const allySide = await page.$('.tk-bs-side--ally');
          const enemySide = await page.$('.tk-bs-side--enemy');
          if (allySide && enemySide) pass('我方/敌方阵营区域存在');
          else warn('阵营区域', 'ally/enemy side 未找到');

          // 4.15 武将卡片
          const unitCards = await page.$$('.tk-bs-unit');
          if (unitCards.length > 0) {
            pass(`武将卡片数量: ${unitCards.length}`);
            // 检查武将卡片详情
            const firstUnit = unitCards[0];
            const unitAvatar = await firstUnit.$('.tk-bs-unit-avatar');
            const unitName = await firstUnit.$('.tk-bs-unit-name');
            if (unitAvatar) pass('武将头像(.tk-bs-unit-avatar)存在');
            if (unitName) {
              const t = await unitName.textContent();
              pass(`武将名称: "${t.trim()}"`);
            }
          } else {
            warn('武将卡片', '未找到.tk-bs-unit');
          }

          // 4.16 行标签
          const rowLabels = await page.$$('.tk-bs-row-label');
          if (rowLabels.length >= 2) pass(`战斗行标签: ${rowLabels.length}个`);

          // 4.17 单位行
          const unitsRows = await page.$$('.tk-bs-units-row');
          if (unitsRows.length > 0) pass(`单位行: ${unitsRows.length}行`);

          // 4.18 血条/怒气条
          const hpBars = await page.$$('.tk-bs-hp-bar');
          const hpFills = await page.$$('.tk-bs-hp-fill');
          const hpTexts = await page.$$('.tk-bs-hp-text');
          const rageBars = await page.$$('.tk-bs-rage-bar');
          const rageFills = await page.$$('.tk-bs-rage-fill');
          if (hpBars.length > 0) pass(`血条数量: ${hpBars.length}`);
          if (hpFills.length > 0) pass(`血条填充数量: ${hpFills.length}`);
          if (hpTexts.length > 0) pass(`血条文字数量: ${hpTexts.length}`);
          if (rageBars.length > 0) pass(`怒气条数量: ${rageBars.length}`);
          if (rageFills.length > 0) pass(`怒气填充数量: ${rageFills.length}`);

          // 4.19 VS分隔
          const vsDivider = await page.$('.tk-bs-vs-divider');
          if (vsDivider) pass('VS分隔符存在');

          // 4.20 速度控制
          const speedBtn = await page.$('.tk-bs-speed-btn');
          if (speedBtn) {
            pass('速度控制按钮(.tk-bs-speed-btn)存在');
            const speedActive = await page.$('.tk-bs-speed-btn--active');
            if (speedActive) pass('速度按钮激活状态(.tk-bs-speed-btn--active)存在');
            await speedBtn.click();
            await page.waitForTimeout(500);
            pass('速度切换点击成功');
          }

          // 4.21 跳过按钮
          const skipBtn = await page.$('.tk-bs-skip-btn');
          if (skipBtn) pass('跳过按钮(.tk-bs-skip-btn)存在');

          // 4.22 战斗日志
          const logArea = await page.$('.tk-bs-log-area');
          if (logArea) {
            pass('战斗播报区域(.tk-bs-log-area)存在');
            const logHeader = await page.$('.tk-bs-log-header');
            const logContent = await page.$('.tk-bs-log-content');
            const logToggle = await page.$('.tk-bs-log-toggle');
            if (logHeader) pass('战斗日志头部(.tk-bs-log-header)存在');
            if (logContent) pass('战斗日志内容(.tk-bs-log-content)存在');
            if (logToggle) pass('战斗日志展开按钮(.tk-bs-log-toggle)存在');

            const logEntries = await page.$$('.tk-bs-log-entry');
            if (logEntries.length > 0) {
              pass(`战斗日志条目: ${logEntries.length}`);
              // 检查日志类型
              const allyLogs = await page.$$('.tk-bs-log-entry--ally');
              const enemyLogs = await page.$$('.tk-bs-log-entry--enemy');
              const turnLogs = await page.$$('.tk-bs-log-entry--turn');
              const critLogs = await page.$$('.tk-bs-log-entry--critical');
              console.log(`    日志分类: 我方=${allyLogs.length}, 敌方=${enemyLogs.length}, 回合=${turnLogs.length}, 暴击=${critLogs.length}`);
            }

            // 日志子元素
            const logActors = await page.$$('.tk-bs-log-actor');
            const logDamages = await page.$$('.tk-bs-log-damage');
            const logSkills = await page.$$('.tk-bs-log-skill');
            const logCrits = await page.$$('.tk-bs-log-crit');
            if (logActors.length > 0) pass(`日志攻击者: ${logActors.length}`);
            if (logDamages.length > 0) pass(`日志伤害值: ${logDamages.length}`);
            if (logSkills.length > 0) pass(`日志技能名: ${logSkills.length}`);
          }

          // 4.23 战斗中截图
          await page.waitForTimeout(2000);
          const shot4d = await takeScreenshot(page, 'v3e-04d-battle-mid');
          screenshot(shot4d);

          // ═══════════════════════════════════════════
          // 5. 战斗结果 — 跳过战斗 → 结算界面
          // ═══════════════════════════════════════════
          console.log('\n  ── 步骤5: 跳过战斗 → 战斗结算界面 ──');

          const skipBtnNow = await page.$('.tk-bs-skip-btn');
          if (skipBtnNow) {
            await skipBtnNow.click();
            await page.waitForTimeout(3000);
          } else {
            console.log('    跳过按钮不可见，等待战斗自然结束...');
            await page.waitForTimeout(15000);
          }

          const shot5 = await takeScreenshot(page, 'v3e-05-battle-result');
          screenshot(shot5);

          // 5.1 检查结算弹窗
          const resultModal = await page.$('.tk-brm-modal');
          const resultOverlay = await page.$('.tk-brm-overlay');
          if (resultModal || resultOverlay) {
            pass('战斗结算弹窗已显示(tk-brm-modal)');

            // 5.2 结果标题
            const resultTitle = await page.$('.tk-brm-result-title');
            const resultTitleVictory = await page.$('.tk-brm-result-title--victory');
            const resultTitleDefeat = await page.$('.tk-brm-result-title--defeat');
            if (resultTitle) {
              const t = await resultTitle.textContent();
              pass(`结算标题: "${t.trim()}"`);
            }
            if (resultTitleVictory) pass('胜利标题样式(.tk-brm-result-title--victory)');
            if (resultTitleDefeat) pass('失败标题样式(.tk-brm-result-title--defeat)');

            // 5.3 结果图标
            const resultIcon = await page.$('.tk-brm-result-icon');
            if (resultIcon) pass('结算图标(.tk-brm-result-icon)存在');

            // 5.4 结果头部
            const resultHeader = await page.$('.tk-brm-result-header');
            if (resultHeader) pass('结算头部(.tk-brm-result-header)存在');

            // 5.5 关卡信息
            const resultStage = await page.$('.tk-brm-result-stage');
            if (resultStage) {
              const t = await resultStage.textContent();
              pass(`结算关卡: "${t.trim()}"`);
            }

            // 5.6 星级评定
            const starsSection = await page.$('.tk-brm-stars-section');
            const starsLabel = await page.$('.tk-brm-stars-label');
            const starsContainer = await page.$('.tk-brm-stars');
            const resultStars = await page.$$('.tk-brm-star');
            const filledStars = await page.$$('.tk-brm-star--filled');
            const emptyStars = await page.$$('.tk-brm-star--empty');

            if (starsSection) pass('星级评定区域(.tk-brm-stars-section)存在');
            if (starsLabel) {
              const t = await starsLabel.textContent();
              pass(`星级标签: "${t.trim()}"`);
            }
            if (resultStars.length > 0) {
              pass(`结算星级元素: ${resultStars.length}`);
              pass(`获得星级: ${filledStars.length}/${resultStars.length}`);
            }

            // 5.7 战斗统计
            const statsContainer = await page.$('.tk-brm-stats');
            const stats = await page.$$('.tk-brm-stat');
            if (statsContainer) pass('战斗统计容器(.tk-brm-stats)存在');
            if (stats.length > 0) {
              pass(`战斗统计项: ${stats.length}`);
              for (const stat of stats.slice(0, 6)) {
                const label = await stat.$('.tk-brm-stat-label');
                const value = await stat.$('.tk-brm-stat-value');
                if (label && value) {
                  const lt = await label.textContent();
                  const vt = await value.textContent();
                  console.log(`    统计: ${lt.trim()} = ${vt.trim()}`);
                }
              }
            }

            // 5.8 奖励列表
            const rewardsSection = await page.$('.tk-brm-rewards-section');
            const rewardsTitle = await page.$('.tk-brm-rewards-title');
            const rewardsList = await page.$('.tk-brm-rewards-list');
            const rewardItems = await page.$$('.tk-brm-reward-item');
            const bonusItems = await page.$$('.tk-brm-reward-item--bonus');

            if (rewardsSection) pass('奖励区域(.tk-brm-rewards-section)存在');
            if (rewardsTitle) {
              const t = await rewardsTitle.textContent();
              pass(`奖励标题: "${t.trim()}"`);
            }
            if (rewardItems.length > 0) {
              pass(`奖励项: ${rewardItems.length}`);
              // 检查奖励详情
              for (const item of rewardItems.slice(0, 3)) {
                const rLabel = await item.$('.tk-brm-reward-label');
                const rValue = await item.$('.tk-brm-reward-value');
                if (rLabel && rValue) {
                  const lt = await rLabel.textContent();
                  const vt = await rValue.textContent();
                  console.log(`    奖励: ${lt.trim()} = ${vt.trim()}`);
                }
              }
              if (bonusItems.length > 0) pass(`首通奖励项: ${bonusItems.length}`);
            } else {
              warn('奖励列表', '未找到奖励项（可能战斗失败）');
            }

            // 5.9 失败相关元素
            const defeatSection = await page.$('.tk-brm-defeat-section');
            if (defeatSection) {
              pass('失败建议区域(.tk-brm-defeat-section)存在');
              const defeatStats = await page.$('.tk-brm-defeat-stats');
              const defeatSummary = await page.$('.tk-brm-defeat-summary');
              const defeatSuggestions = await page.$('.tk-brm-defeat-suggestions');
              if (defeatStats) pass('失败统计(.tk-brm-defeat-stats)存在');
              if (defeatSummary) pass('失败摘要(.tk-brm-defeat-summary)存在');
              if (defeatSuggestions) {
                pass('失败建议(.tk-brm-defeat-suggestions)存在');
                const suggestionsList = await page.$('.tk-brm-defeat-suggestions-list');
                const suggestionsTitle = await page.$('.tk-brm-defeat-suggestions-title');
                if (suggestionsTitle) {
                  const t = await suggestionsTitle.textContent();
                  pass(`建议标题: "${t.trim()}"`);
                }
              }
            }

            // 5.10 操作按钮
            const actionsContainer = await page.$('.tk-brm-actions');
            const confirmBtn = await page.$('.tk-brm-confirm-btn');
            const confirmVictory = await page.$('.tk-brm-confirm-btn--victory');
            const confirmDefeat = await page.$('.tk-brm-confirm-btn--defeat');

            if (actionsContainer) pass('操作按钮区域(.tk-brm-actions)存在');
            if (confirmBtn) {
              const btnText = await confirmBtn.textContent();
              pass(`确认按钮: "${btnText.trim()}"`);
              if (confirmVictory) pass('胜利确认按钮样式');
              if (confirmDefeat) pass('失败确认按钮样式');

              await confirmBtn.click();
              await page.waitForTimeout(1500);
              pass('点击确认返回关卡Tab');
            }
          } else {
            warn('战斗结算', '未找到标准结算弹窗元素');
            await page.waitForTimeout(5000);
            const shot5b = await takeScreenshot(page, 'v3e-05b-battle-result-wait');
            screenshot(shot5b);

            const confirmBtn2 = await page.$('.tk-brm-confirm-btn');
            if (confirmBtn2) {
              await confirmBtn2.click();
              await page.waitForTimeout(1500);
              pass('延迟找到确认按钮并点击');
            } else {
              await page.keyboard.press('Escape');
              await page.waitForTimeout(1000);
              warn('战斗结算', '通过Escape返回');
            }
          }
        } else {
          warn('出征按钮', '出征按钮被禁用（可能无武将在编队中）');
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
    // 6. 扫荡功能 — 检查扫荡按钮和扫荡弹窗
    // ═══════════════════════════════════════════
    console.log('\n── 步骤6: 扫荡功能 ──');

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
      const shot6 = await takeScreenshot(page, 'v3e-06-sweep-modal');
      screenshot(shot6);

      // 检查扫荡结算
      const sweepResultTitle = await page.$('.tk-brm-result-title');
      if (sweepResultTitle) {
        const t = await sweepResultTitle.textContent();
        pass(`扫荡结算标题: "${t.trim()}"`);
      }

      // 扫荡奖励
      const sweepRewardItems = await page.$$('.tk-brm-reward-item');
      if (sweepRewardItems.length > 0) {
        pass(`扫荡奖励项: ${sweepRewardItems.length}`);
      }

      const sweepConfirmBtn = await page.$('.tk-brm-confirm-btn');
      if (sweepConfirmBtn) {
        await sweepConfirmBtn.click();
        await page.waitForTimeout(1000);
        pass('扫荡结算确认成功');
      }
    } else {
      warn('扫荡按钮', '未找到扫荡按钮(.tk-stage-sweep-btn)（可能没有三星通关关卡）');
    }

    // ═══════════════════════════════════════════
    // 7. 关卡进度 — 检查当前进度显示
    // ═══════════════════════════════════════════
    console.log('\n── 步骤7: 关卡进度显示 ──');

    // 7.1 进度条
    const progressBar = await page.$('.tk-campaign-progress');
    if (progressBar) {
      pass('底部进度条(.tk-campaign-progress)存在');

      const progressFill = await page.$('.tk-campaign-progress-fill');
      if (progressFill) {
        const width = await progressFill.evaluate(el => el.style.width || el.className);
        pass(`进度条填充: ${width}`);
      } else {
        warn('进度条填充', '.tk-campaign-progress-fill 未找到');
      }

      const progressText = await page.$('.tk-campaign-progress-text');
      if (progressText) {
        const t = await progressText.textContent();
        pass(`进度文字: "${t.trim()}"`);
      }

      const progressStars = await page.$('.tk-campaign-progress-stars');
      if (progressStars) pass('进度星级(.tk-campaign-progress-stars)存在');

      const progressBarEl = await page.$('.tk-campaign-progress-bar');
      if (progressBarEl) pass('进度条容器(.tk-campaign-progress-bar)存在');
    } else {
      warn('进度条', '.tk-campaign-progress 未找到');
    }

    // 7.2 地图滚动按钮
    const scrollLeft = await page.$('.tk-map-scroll-btn--left');
    const scrollRight = await page.$('.tk-map-scroll-btn--right');
    if (scrollLeft && scrollRight) {
      pass('地图滚动按钮(左/右)存在');
      // 测试滚动
      await scrollRight.click();
      await page.waitForTimeout(500);
      const shot7 = await takeScreenshot(page, 'v3e-07-scrolled-right');
      screenshot(shot7);
      pass('向右滚动成功');
      await scrollLeft.click();
      await page.waitForTimeout(500);
      pass('向左滚动成功');
    } else {
      warn('地图滚动按钮', '左/右滚动按钮缺失');
    }

    const shot7b = await takeScreenshot(page, 'v3e-07b-progress-final');
    screenshot(shot7b);

    // ═══════════════════════════════════════════
    // 8. 移动端适配测试
    // ═══════════════════════════════════════════
    console.log('\n── 步骤8: 移动端适配测试 ──');

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
    const mobileGuideSkip = await mobilePage.$('.tk-guide-btn--skip');
    if (mobileGuideSkip) {
      await mobileGuideSkip.click();
      await mobilePage.waitForTimeout(1000);
    }

    // 切换到关卡Tab
    const mobileTabBtn = await mobilePage.$('button:has-text("关卡")');
    if (mobileTabBtn) {
      await mobileTabBtn.click();
      await mobilePage.waitForTimeout(1500);
    }

    const shot8 = await takeScreenshot(mobilePage, 'v3e-08-campaign-mobile');
    screenshot(shot8);

    const mobileCampaignTab = await mobilePage.$('.tk-campaign-tab');
    if (mobileCampaignTab) pass('移动端CampaignTab存在');
    else fail('移动端CampaignTab', '.tk-campaign-tab 未找到');

    const mobileStageNodes = await mobilePage.$$('.tk-stage-node');
    if (mobileStageNodes.length > 0) pass(`移动端关卡节点: ${mobileStageNodes.length}`);
    else warn('移动端关卡节点', '未找到关卡节点');

    const mobileChapterSelector = await mobilePage.$('.tk-chapter-selector');
    if (mobileChapterSelector) pass('移动端章节选择器存在');

    const mobileCampaignMap = await mobilePage.$('.tk-campaign-map');
    if (mobileCampaignMap) pass('移动端关卡地图存在');

    const mobileProgressBar = await mobilePage.$('.tk-campaign-progress');
    if (mobileProgressBar) pass('移动端进度条存在');

    // 移动端水平溢出检查
    const mobileBodyWidth = await mobilePage.evaluate(() => document.body.scrollWidth);
    if (mobileBodyWidth <= 400) pass(`移动端无水平溢出 (scrollWidth=${mobileBodyWidth})`);
    else fail('移动端水平溢出', `scrollWidth=${mobileBodyWidth} > 375`);

    // 移动端数据完整性
    const mobileIntegrity = await checkDataIntegrity(mobilePage);
    if (!mobileIntegrity.hasNaN && !mobileIntegrity.hasUndefined) {
      pass('移动端数据完整性检查通过');
    } else {
      mobileIntegrity.issues.forEach(i => fail('移动端数据完整性', i));
    }

    // 移动端点击关卡测试
    const mobileAvailableNode = await mobilePage.$('.tk-stage-node--available') ||
      await mobilePage.$('.tk-stage-node:not(.tk-stage-node--locked)');
    if (mobileAvailableNode) {
      await mobileAvailableNode.click();
      await mobilePage.waitForTimeout(1500);
      const shot8b = await takeScreenshot(mobilePage, 'v3e-08b-formation-mobile');
      screenshot(shot8b);

      const mobileFormation = await mobilePage.$('.tk-bfm-modal') || await mobilePage.$('.tk-bfm-overlay');
      if (mobileFormation) pass('移动端布阵弹窗正常打开');
      else warn('移动端布阵弹窗', '未找到布阵弹窗元素');

      await mobilePage.keyboard.press('Escape');
      await mobilePage.waitForTimeout(500);
    }

    if (mobileErrors.length > 0) {
      console.log(`    移动端控制台错误: ${mobileErrors.length}个`);
      mobileErrors.slice(0, 5).forEach((e, i) => warn('移动端控制台错误', e.substring(0, 120)));
    } else {
      pass('移动端无控制台错误');
    }

    await mobileContext.close();

    // ═══════════════════════════════════════════
    // 9. 控制台错误汇总
    // ═══════════════════════════════════════════
    console.log('\n── 步骤9: 控制台错误汇总 ──');
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
    try { await takeScreenshot(page, 'v3e-error'); } catch (_) { /* ignore */ }
  } finally {
    await browser.close();
  }

  // ═══════════════════════════════════════════
  // 测试报告输出
  // ═══════════════════════════════════════════
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║     v3.0 攻城略地(上) UI测试报告 R1(进化迭代)   ║');
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
    f.name.includes('CampaignTab') || f.name.includes('战斗场景') || f.name.includes('布阵弹窗') || f.name.includes('关卡地图')
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
    version: 'v3.0',
    module: '攻城略地(上)',
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

  const resultPath = path.join(__dirname, '..', 'e2e-v3-evolution-results.json');
  fs.writeFileSync(resultPath, JSON.stringify(resultJson, null, 2));
  console.log(`\n📄 测试结果已保存: ${resultPath}`);

  process.exit(results.failed.length > 0 ? 1 : 0);
})();
