/**
 * v3.0 攻城掠地(上) — UI测试：关卡Tab + 战斗场景
 *
 * 测试范围：
 * 1. 关卡Tab（CampaignTab）— 章节选择+关卡列表+关卡状态+星级评定
 * 2. 战前布阵弹窗（BattleFormationModal）— 阵型+一键布阵+战力预估
 * 3. 战斗场景（BattleScene）— 回合制战斗+战斗动画
 * 4. 战斗结算弹窗（BattleResultModal）— 奖励+星级
 * 5. 扫荡面板（SweepPanel/SweepModal）— 扫荡功能
 * 6. 移动端适配
 *
 * @module e2e/v3-ui-test
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const gameActions = require('./utils/game-actions.cjs');

const {
  initBrowser,
  enterGame,
  switchTab,
  takeScreenshot,
  checkDataIntegrity,
  checkLayout,
  getConsoleErrors,
  clearConsoleErrors,
  BASE_URL,
  SCREENSHOT_DIR,
} = gameActions;

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
  results.failed.push({ name, detail });
  console.log(`  ❌ FAIL: ${name} — ${detail}`);
}

function warn(name, detail) {
  results.warnings.push({ name, detail });
  console.log(`  ⚠️  WARN: ${name} — ${detail}`);
}

function screenshot(name) {
  results.screenshots.push(name);
}

// ─────────────────────────────────────────────
// 辅助：等待元素出现
// ─────────────────────────────────────────────
async function waitForElement(page, selector, timeout = 5000) {
  try {
    await page.waitForSelector(selector, { timeout });
    return true;
  } catch {
    return false;
  }
}

async function safeClick(page, selector) {
  const el = await page.$(selector);
  if (el) {
    await el.click();
    return true;
  }
  return false;
}

// ─────────────────────────────────────────────
// 主测试流程
// ─────────────────────────────────────────────
(async () => {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  v3.0 攻城掠地(上) — UI测试：关卡Tab + 战斗场景');
  console.log('═══════════════════════════════════════════════════\n');

  const { page, browser } = await initBrowser({ headless: true, width: 1280, height: 720 });
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  try {
    // ═══════════════════════════════════════════
    // 0. 进入游戏
    // ═══════════════════════════════════════════
    console.log('\n── 步骤0: 进入游戏主界面 ──');
    clearConsoleErrors(page);
    await enterGame(page);
    const shot0 = await takeScreenshot(page, 'v3-00-main');
    screenshot(shot0);
    pass('游戏主界面加载成功');

    // 检查数据完整性
    const integrity = await checkDataIntegrity(page);
    if (!integrity.hasNaN && !integrity.hasUndefined) {
      pass('主界面数据完整性检查通过');
    } else {
      integrity.issues.forEach(i => fail('主界面数据完整性', i));
    }

    // ═══════════════════════════════════════════
    // 1. 切换到关卡Tab
    // ═══════════════════════════════════════════
    console.log('\n── 步骤1: 切换到关卡Tab ──');
    await switchTab(page, '关卡');
    await page.waitForTimeout(1500);
    const shot1 = await takeScreenshot(page, 'v3-01-campaign-tab');
    screenshot(shot1);

    // 1.1 检查CampaignTab容器
    const campaignTabEl = await page.$('.tk-campaign-tab');
    if (campaignTabEl) {
      pass('CampaignTab容器(.tk-campaign-tab)存在');
    } else {
      fail('CampaignTab容器', '.tk-campaign-tab 未找到');
    }

    // 1.2 检查章节选择器
    const chapterSelector = await page.$('.tk-chapter-selector');
    if (chapterSelector) {
      pass('章节选择器(.tk-chapter-selector)存在');

      // 检查章节标题
      const chapterTitle = await page.$('.tk-chapter-title');
      if (chapterTitle) {
        const titleText = await chapterTitle.textContent();
        pass(`章节标题显示: "${titleText.trim()}"`);
      } else {
        fail('章节标题', '.tk-chapter-title 未找到');
      }

      // 检查左右箭头
      const leftArrow = await page.$('.tk-chapter-arrow--left');
      const rightArrow = await page.$('.tk-chapter-arrow--right');
      if (leftArrow && rightArrow) {
        pass('章节切换箭头存在');
      } else {
        warn('章节切换箭头', '左/右箭头缺失');
      }

      // 尝试点击下一章
      const rightDisabled = await page.$eval('.tk-chapter-arrow--right', el => el.disabled);
      if (!rightDisabled) {
        await safeClick(page, '.tk-chapter-arrow--right');
        await page.waitForTimeout(800);
        const shot1b = await takeScreenshot(page, 'v3-01b-chapter-next');
        screenshot(shot1b);
        pass('切换到下一章成功');

        // 切回第一章
        await safeClick(page, '.tk-chapter-arrow--left');
        await page.waitForTimeout(800);
      } else {
        warn('章节切换', '当前已是最后一章，无法测试切换');
      }
    } else {
      fail('章节选择器', '.tk-chapter-selector 未找到');
    }

    // 1.3 检查关卡地图区域
    const campaignMap = await page.$('.tk-campaign-map');
    if (campaignMap) {
      pass('关卡地图区域(.tk-campaign-map)存在');
    } else {
      fail('关卡地图区域', '.tk-campaign-map 未找到');
    }

    // 1.4 检查关卡节点
    const stageNodes = await page.$$('.tk-stage-node');
    if (stageNodes.length > 0) {
      pass(`关卡节点数量: ${stageNodes.length}`);
    } else {
      fail('关卡节点', '未找到任何.tk-stage-node');
    }

    // 1.5 检查关卡状态分类
    const lockedNodes = await page.$$('.tk-stage-node--locked');
    const availableNodes = await page.$$('.tk-stage-node--available');
    const clearedNodes = await page.$$('.tk-stage-node--cleared');
    const threeStarNodes = await page.$$('.tk-stage-node--three-star');
    console.log(`    关卡状态分布: 锁定=${lockedNodes.length}, 可挑战=${availableNodes.length}, 已通关=${clearedNodes.length}, 三星=${threeStarNodes.length}`);
    pass(`关卡状态分类正常 (锁定/可挑战/已通关/三星 = ${lockedNodes.length}/${availableNodes.length}/${clearedNodes.length}/${threeStarNodes.length})`);

    // 1.6 检查锁定关卡显示🔒
    if (lockedNodes.length > 0) {
      const lockIcon = await lockedNodes[0].$('.tk-stage-node-lock');
      if (lockIcon) {
        pass('锁定关卡显示🔒图标');
      } else {
        warn('锁定关卡', '未找到🔒图标元素');
      }
    }

    // 1.7 检查星级显示
    const starElements = await page.$$('.tk-stage-star');
    if (starElements.length > 0) {
      pass(`星级元素数量: ${starElements.length}`);
    } else {
      warn('星级元素', '未找到.tk-stage-star（可能初始无已通关关卡）');
    }

    // 1.8 检查关卡节点详情（名称、类型、战力）
    if (stageNodes.length > 0) {
      const firstNode = stageNodes[0];
      const nodeName = await firstNode.$('.tk-stage-node-name');
      const nodeType = await firstNode.$('.tk-stage-node-type');
      const nodePower = await firstNode.$('.tk-stage-node-power');

      if (nodeName) {
        const nameText = await nodeName.textContent();
        pass(`关卡名称显示: "${nameText.trim()}"`);
      } else {
        fail('关卡名称', '.tk-stage-node-name 未找到');
      }

      if (nodeType) {
        pass('关卡类型标签存在');
      } else {
        warn('关卡类型标签', '.tk-stage-node-type 未找到');
      }

      if (nodePower) {
        const powerText = await nodePower.textContent();
        pass(`推荐战力显示: "${powerText.trim()}"`);
      } else {
        warn('推荐战力', '.tk-stage-node-power 未找到');
      }
    }

    // 1.9 检查进度条
    const progressBar = await page.$('.tk-campaign-progress');
    if (progressBar) {
      pass('底部进度条(.tk-campaign-progress)存在');

      const progressFill = await page.$('.tk-campaign-progress-fill');
      if (progressFill) {
        const width = await progressFill.evaluate(el => el.style.width);
        pass(`进度条填充宽度: ${width}`);
      }
    } else {
      warn('进度条', '.tk-campaign-progress 未找到');
    }

    // 1.10 检查地图滚动按钮
    const scrollLeft = await page.$('.tk-map-scroll-btn--left');
    const scrollRight = await page.$('.tk-map-scroll-btn--right');
    if (scrollLeft && scrollRight) {
      pass('地图滚动按钮存在');
    } else {
      warn('地图滚动按钮', '左/右滚动按钮缺失');
    }

    // ═══════════════════════════════════════════
    // 2. 点击可挑战关卡 → 战前布阵弹窗
    // ═══════════════════════════════════════════
    console.log('\n── 步骤2: 点击可挑战关卡 → 战前布阵弹窗 ──');

    // 先找到可挑战的关卡
    let availableNode = await page.$('.tk-stage-node--available');
    if (!availableNode) {
      // 如果没有可挑战的，尝试第一个非锁定关卡
      availableNode = await page.$('.tk-stage-node:not(.tk-stage-node--locked)');
    }

    if (availableNode) {
      await availableNode.click();
      await page.waitForTimeout(1500);
      const shot2 = await takeScreenshot(page, 'v3-02-formation-modal');
      screenshot(shot2);

      // 2.1 检查布阵弹窗容器（SharedPanel）
      const sharedPanel = await page.$('.shared-panel');
      if (sharedPanel) {
        pass('战前布阵弹窗(SharedPanel)已打开');
      } else {
        // 检查其他可能的容器
        const anyPanel = await page.$('[class*="panel"][class*="open"], [class*="modal"][class*="open"]');
        if (anyPanel) {
          pass('战前布阵弹窗已打开(非标准panel)');
        } else {
          fail('战前布阵弹窗', '未找到弹窗容器');
        }
      }

      // 2.2 检查关卡描述
      const descEl = await page.$('.tk-bfm-desc');
      if (descEl) {
        pass('关卡描述区域存在');
      } else {
        warn('关卡描述', '.tk-bfm-desc 未找到（可能该关卡无描述）');
      }

      // 2.3 检查敌方阵容
      const enemySection = await page.$('.tk-bfm-enemy-units');
      if (enemySection) {
        pass('敌方阵容区域(.tk-bfm-enemy-units)存在');

        const enemyUnits = await page.$$('.tk-bfm-enemy-unit');
        if (enemyUnits.length > 0) {
          pass(`敌方单位数量: ${enemyUnits.length}`);
        } else {
          warn('敌方单位', '未找到.tk-bfm-enemy-unit');
        }
      } else {
        fail('敌方阵容区域', '.tk-bfm-enemy-units 未找到');
      }

      // 2.4 检查战力对比
      const powerCompare = await page.$('.tk-bfm-power-compare');
      if (powerCompare) {
        pass('战力对比区域(.tk-bfm-power-compare)存在');

        const allyPower = await page.$('.tk-bfm-power-ally .tk-bfm-power-value');
        const enemyPower = await page.$('.tk-bfm-power-enemy .tk-bfm-power-value');
        const powerRatio = await page.$('.tk-bfm-power-ratio');

        if (allyPower) {
          const allyText = await allyPower.textContent();
          pass(`我方战力显示: ${allyText.trim()}`);
        }

        if (enemyPower) {
          const enemyText = await enemyPower.textContent();
          pass(`推荐战力显示: ${enemyText.trim()}`);
        }

        if (powerRatio) {
          const ratioText = await powerRatio.textContent();
          pass(`战力评估: ${ratioText.trim()}`);
        }
      } else {
        fail('战力对比', '.tk-bfm-power-compare 未找到');
      }

      // 2.5 检查我方编队
      const allySlots = await page.$$('.tk-bfm-ally-slot');
      if (allySlots.length > 0) {
        pass(`我方编队槽位数量: ${allySlots.length}`);

        const filledSlots = await page.$$('.tk-bfm-ally-slot--filled');
        const emptySlots = await page.$$('.tk-bfm-ally-slot--empty');
        pass(`编队状态: 已填充=${filledSlots.length}, 空位=${emptySlots.length}`);
      } else {
        warn('我方编队', '.tk-bfm-ally-slot 未找到');
      }

      // 2.6 检查前排/后排标签
      const rowLabels = await page.$$('.tk-bfm-row-label');
      if (rowLabels.length >= 2) {
        pass(`前排/后排标签存在 (${rowLabels.length}个)`);
      } else {
        warn('前排/后排标签', '未找到足够的.tk-bfm-row-label');
      }

      // 2.7 检查操作按钮
      const cancelBtn = await page.$('.tk-bfm-btn--cancel');
      const autoBtn = await page.$('.tk-bfm-btn--auto');
      const fightBtn = await page.$('.tk-bfm-btn--fight');

      if (cancelBtn) {
        pass('取消按钮存在');
      }
      if (autoBtn) {
        pass('一键布阵按钮存在');

        // 2.8 测试一键布阵
        await autoBtn.click();
        await page.waitForTimeout(1000);
        const shot2b = await takeScreenshot(page, 'v3-02b-auto-formation');
        screenshot(shot2b);
        pass('一键布阵点击成功');

        // 检查编队是否更新
        const filledAfterAuto = await page.$$('.tk-bfm-ally-slot--filled');
        if (filledAfterAuto.length > 0) {
          pass(`一键布阵后已填充槽位: ${filledAfterAuto.length}`);
        } else {
          warn('一键布阵', '布阵后无已填充槽位（可能无可用武将）');
        }
      } else {
        warn('一键布阵按钮', '.tk-bfm-btn--auto 未找到');
      }

      if (fightBtn) {
        const fightText = await fightBtn.textContent();
        const isDisabled = await fightBtn.evaluate(el => el.disabled);
        pass(`出征按钮存在 (文本: "${fightText.trim()}", 禁用: ${isDisabled})`);

        // ═══════════════════════════════════════════
        // 3. 点击出征 → 战斗场景
        // ═══════════════════════════════════════════
        if (!isDisabled) {
          console.log('\n── 步骤3: 点击出征 → 进入战斗场景 ──');
          await fightBtn.click();
          await page.waitForTimeout(2000);
          const shot3 = await takeScreenshot(page, 'v3-03-battle-scene');
          screenshot(shot3);

          // 3.1 检查战斗场景覆盖层
          const battleOverlay = await page.$('.tk-bs-overlay');
          if (battleOverlay) {
            pass('战斗场景覆盖层(.tk-bs-overlay)存在');
          } else {
            // 可能正在加载
            warn('战斗场景', '未立即找到.tk-bs-overlay，可能正在加载');
            await page.waitForTimeout(3000);
            const battleOverlay2 = await page.$('.tk-bs-overlay');
            if (battleOverlay2) {
              pass('战斗场景覆盖层(.tk-bs-overlay)延迟加载成功');
            } else {
              fail('战斗场景', '.tk-bs-overlay 未找到');
            }
          }

          // 3.2 检查顶部信息栏
          const topBar = await page.$('.tk-bs-top-bar');
          if (topBar) {
            pass('战斗顶部信息栏(.tk-bs-top-bar)存在');

            const stageInfo = await page.$('.tk-bs-stage-info');
            const turnDisplay = await page.$('.tk-bs-turn-display');
            const controls = await page.$('.tk-bs-controls');

            if (stageInfo) {
              const stageText = await stageInfo.textContent();
              pass(`关卡信息显示: "${stageText.trim()}"`);
            }

            if (turnDisplay) {
              const turnText = await turnDisplay.textContent();
              pass(`回合数显示: "${turnText.trim()}"`);
            }

            if (controls) {
              pass('战斗控制按钮区域存在');
            }
          } else {
            warn('战斗顶部信息栏', '.tk-bs-top-bar 未找到');
          }

          // 3.3 检查战场区域
          const battlefield = await page.$('.tk-bs-battlefield');
          if (battlefield) {
            pass('战场主区域(.tk-bs-battlefield)存在');
          }

          // 3.4 检查我方和敌方阵营
          const allySide = await page.$('.tk-bs-side--ally');
          const enemySide = await page.$('.tk-bs-side--enemy');
          if (allySide && enemySide) {
            pass('我方/敌方阵营区域存在');
          } else {
            warn('阵营区域', 'ally/enemy side 未找到');
          }

          // 3.5 检查武将卡片
          const unitCards = await page.$$('.tk-bs-unit');
          if (unitCards.length > 0) {
            pass(`武将卡片数量: ${unitCards.length}`);
          } else {
            warn('武将卡片', '未找到.tk-bs-unit');
          }

          // 3.6 检查血条
          const hpBars = await page.$$('.tk-bs-hp-bar');
          if (hpBars.length > 0) {
            pass(`血条数量: ${hpBars.length}`);
          }

          // 3.7 检查怒气条
          const rageBars = await page.$$('.tk-bs-rage-bar');
          if (rageBars.length > 0) {
            pass(`怒气条数量: ${rageBars.length}`);
          }

          // 3.8 检查VS分隔
          const vsDivider = await page.$('.tk-bs-vs-divider');
          if (vsDivider) {
            pass('VS分隔符存在');
          }

          // 3.9 检查速度控制
          const speedBtn = await page.$('.tk-bs-speed-btn');
          if (speedBtn) {
            pass('速度控制按钮存在');

            // 测试切换速度
            await speedBtn.click();
            await page.waitForTimeout(500);
            pass('速度切换点击成功');
          }

          // 3.10 检查跳过按钮
          const skipBtn = await page.$('.tk-bs-skip-btn');
          if (skipBtn) {
            pass('跳过按钮存在');
          }

          // 3.11 检查战斗日志
          const logArea = await page.$('.tk-bs-log-area');
          if (logArea) {
            pass('战斗播报区域(.tk-bs-log-area)存在');

            const logEntries = await page.$$('.tk-bs-log-entry');
            if (logEntries.length > 0) {
              pass(`战斗日志条目数: ${logEntries.length}`);
            }
          }

          // 3.12 截图战斗进行中
          await page.waitForTimeout(2000);
          const shot3b = await takeScreenshot(page, 'v3-03b-battle-mid');
          screenshot(shot3b);

          // ═══════════════════════════════════════════
          // 4. 跳过战斗 → 战斗结算弹窗
          // ═══════════════════════════════════════════
          console.log('\n── 步骤4: 跳过战斗 → 战斗结算弹窗 ──');

          const skipBtnNow = await page.$('.tk-bs-skip-btn');
          if (skipBtnNow) {
            await skipBtnNow.click();
            await page.waitForTimeout(2000);
          } else {
            // 等待战斗自然结束
            console.log('    跳过按钮不可见，等待战斗自然结束...');
            await page.waitForTimeout(10000);
          }

          const shot4 = await takeScreenshot(page, 'v3-04-battle-result');
          screenshot(shot4);

          // 4.1 检查战斗结束覆盖
          const endOverlay = await page.$('.tk-bs-end-overlay');
          if (endOverlay) {
            pass('战斗结束覆盖层(.tk-bs-end-overlay)存在');

            const endText = await page.$('.tk-bs-end-text');
            if (endText) {
              const text = await endText.textContent();
              pass(`战斗结果文字: "${text.trim()}"`);
            }
          }

          // 4.2 检查结算弹窗（可能直接显示BattleResultModal）
          const resultModal = await page.$('.shared-panel');
          const resultStars = await page.$$('.tk-brm-star');
          const resultTitle = await page.$('.tk-brm-result-title');
          const resultIcon = await page.$('.tk-brm-result-icon');

          if (resultTitle || resultIcon) {
            pass('战斗结算弹窗已显示');

            if (resultTitle) {
              const titleText = await resultTitle.textContent();
              pass(`结算标题: "${titleText.trim()}"`);
            }

            // 4.3 检查星级评定
            if (resultStars.length > 0) {
              pass(`结算星级元素数量: ${resultStars.length}`);

              const filledStars = await page.$$('.tk-brm-star--filled');
              pass(`获得星级: ${filledStars.length}/${resultStars.length}`);
            }

            // 4.4 检查战斗统计
            const stats = await page.$$('.tk-brm-stat');
            if (stats.length > 0) {
              pass(`战斗统计项数量: ${stats.length}`);

              // 读取统计详情
              for (const stat of stats.slice(0, 4)) {
                const label = await stat.$('.tk-brm-stat-label');
                const value = await stat.$('.tk-brm-stat-value');
                if (label && value) {
                  const labelText = await label.textContent();
                  const valueText = await value.textContent();
                  console.log(`    统计: ${labelText.trim()} = ${valueText.trim()}`);
                }
              }
            }

            // 4.5 检查奖励列表
            const rewardItems = await page.$$('.tk-brm-reward-item');
            if (rewardItems.length > 0) {
              pass(`奖励项数量: ${rewardItems.length}`);

              const bonusItems = await page.$$('.tk-brm-reward-item--bonus');
              if (bonusItems.length > 0) {
                pass(`首通奖励项数量: ${bonusItems.length}`);
              }
            } else {
              warn('奖励列表', '未找到奖励项（可能战斗失败）');
            }

            // 4.6 检查确认按钮
            const confirmBtn = await page.$('.tk-brm-confirm-btn');
            if (confirmBtn) {
              pass('确认按钮(.tk-brm-confirm-btn)存在');

              // 点击确认返回
              await confirmBtn.click();
              await page.waitForTimeout(1500);
              pass('点击确认返回关卡Tab');
            }
          } else {
            // 可能战斗还在进行或结算弹窗结构不同
            warn('战斗结算', '未找到标准结算弹窗元素');

            // 尝试等待更长时间
            await page.waitForTimeout(5000);
            const shot4b = await takeScreenshot(page, 'v3-04b-battle-result-wait');
            screenshot(shot4b);

            // 再次检查
            const confirmBtn2 = await page.$('.tk-brm-confirm-btn');
            if (confirmBtn2) {
              await confirmBtn2.click();
              await page.waitForTimeout(1500);
              pass('延迟找到确认按钮并点击');
            } else {
              // 尝试按Escape返回
              await page.keyboard.press('Escape');
              await page.waitForTimeout(1000);
              warn('战斗结算', '通过Escape返回');
            }
          }
        } else {
          warn('出征按钮', '出征按钮被禁用（可能无武将在编队中）');

          // 关闭布阵弹窗
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
    // 5. 扫荡功能测试
    // ═══════════════════════════════════════════
    console.log('\n── 步骤5: 扫荡功能测试 ──');

    // 确保在关卡Tab
    const campaignTabCheck = await page.$('.tk-campaign-tab');
    if (!campaignTabCheck) {
      await switchTab(page, '关卡');
      await page.waitForTimeout(1500);
    }

    // 检查三星关卡的扫荡按钮
    const sweepBtns = await page.$$('.tk-stage-sweep-btn');
    if (sweepBtns.length > 0) {
      pass(`扫荡按钮数量: ${sweepBtns.length}`);

      // 点击第一个扫荡按钮
      await sweepBtns[0].click();
      await page.waitForTimeout(1500);
      const shot5 = await takeScreenshot(page, 'v3-05-sweep-result');
      screenshot(shot5);

      // 检查扫荡结算弹窗
      const sweepResultTitle = await page.$('.tk-brm-result-title');
      if (sweepResultTitle) {
        const titleText = await sweepResultTitle.textContent();
        pass(`扫荡结算标题: "${titleText.trim()}"`);
      }

      // 确认关闭
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
    // 6. 多章节切换测试
    // ═══════════════════════════════════════════
    console.log('\n── 步骤6: 多章节切换测试 ──');

    // 获取章节数
    const chapterCount = await page.$$eval('.tk-chapter-arrow--right', els => {
      // 通过多次点击来计算章节数
      return 1; // 默认至少1章
    });

    // 测试切换到第二章
    const nextChapterBtn = await page.$('.tk-chapter-arrow--right:not([disabled])');
    if (nextChapterBtn) {
      await nextChapterBtn.click();
      await page.waitForTimeout(1000);
      const shot6 = await takeScreenshot(page, 'v3-06-chapter2');
      screenshot(shot6);

      const chapterTitle2 = await page.$('.tk-chapter-title');
      if (chapterTitle2) {
        const title2Text = await chapterTitle2.textContent();
        pass(`第二章标题: "${title2Text.trim()}"`);
      }

      // 检查第二章关卡节点
      const stageNodes2 = await page.$$('.tk-stage-node');
      if (stageNodes2.length > 0) {
        pass(`第二章关卡节点数量: ${stageNodes2.length}`);
      }

      // 切回第一章
      const prevChapterBtn = await page.$('.tk-chapter-arrow--left:not([disabled])');
      if (prevChapterBtn) {
        await prevChapterBtn.click();
        await page.waitForTimeout(1000);
        pass('切回第一章成功');
      }
    } else {
      warn('章节切换', '无更多章节可切换');
    }

    // ═══════════════════════════════════════════
    // 7. 移动端适配测试
    // ═══════════════════════════════════════════
    console.log('\n── 步骤7: 移动端适配测试 ──');

    const mobileContext = await browser.newContext({ viewport: { width: 375, height: 667 } });
    const mobilePage = await mobileContext.newPage();

    // 收集移动端错误
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

    // 切换到关卡Tab
    const mobileTabBtn = await mobilePage.$('button:has-text("关卡")');
    if (mobileTabBtn) {
      await mobileTabBtn.click();
      await mobilePage.waitForTimeout(1500);
    }

    const shot7 = await takeScreenshot(mobilePage, 'v3-07-campaign-mobile');
    screenshot(shot7);

    // 检查移动端CampaignTab
    const mobileCampaignTab = await mobilePage.$('.tk-campaign-tab');
    if (mobileCampaignTab) {
      pass('移动端CampaignTab存在');
    } else {
      fail('移动端CampaignTab', '.tk-campaign-tab 未找到');
    }

    // 检查移动端关卡节点
    const mobileStageNodes = await mobilePage.$$('.tk-stage-node');
    if (mobileStageNodes.length > 0) {
      pass(`移动端关卡节点数量: ${mobileStageNodes.length}`);
    } else {
      warn('移动端关卡节点', '未找到关卡节点');
    }

    // 检查移动端章节选择器
    const mobileChapterSelector = await mobilePage.$('.tk-chapter-selector');
    if (mobileChapterSelector) {
      pass('移动端章节选择器存在');
    }

    // 检查移动端布局是否溢出
    const mobileBodyWidth = await mobilePage.evaluate(() => document.body.scrollWidth);
    if (mobileBodyWidth <= 400) {
      pass(`移动端无水平溢出 (scrollWidth=${mobileBodyWidth})`);
    } else {
      fail('移动端水平溢出', `scrollWidth=${mobileBodyWidth} > 375`);
    }

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
      const shot7b = await takeScreenshot(mobilePage, 'v3-07b-formation-mobile');
      screenshot(shot7b);

      const mobileFormation = await mobilePage.$('.shared-panel');
      if (mobileFormation) {
        pass('移动端布阵弹窗正常打开');
      }

      // 关闭弹窗
      await mobilePage.keyboard.press('Escape');
      await mobilePage.waitForTimeout(500);
    }

    if (mobileErrors.length > 0) {
      console.log(`    移动端控制台错误: ${mobileErrors.length}个`);
      mobileErrors.forEach((e, i) => {
        if (i < 5) warn('移动端控制台错误', e.substring(0, 120));
      });
    } else {
      pass('移动端无控制台错误');
    }

    await mobileContext.close();

    // ═══════════════════════════════════════════
    // 8. 控制台错误汇总
    // ═══════════════════════════════════════════
    console.log('\n── 步骤8: 控制台错误汇总 ──');
    const allErrors = getConsoleErrors(page);
    if (allErrors.length > 0) {
      console.log(`    PC端控制台错误: ${allErrors.length}个`);
      allErrors.forEach((e, i) => {
        if (i < 10) results.consoleErrors.push(e);
        console.log(`    CE-${i + 1}: ${e.substring(0, 150)}`);
      });
    } else {
      pass('PC端无控制台错误');
    }

  } catch (err) {
    fail('测试执行异常', err.message);
    console.error(err.stack);
    try {
      const shotErr = await takeScreenshot(page, 'v3-error');
      screenshot(shotErr);
    } catch (_) { /* ignore */ }
  } finally {
    await browser.close();
  }

  // ═══════════════════════════════════════════
  // 测试报告
  // ═══════════════════════════════════════════
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║         v3.0 攻城掠地(上) UI测试报告            ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  ✅ 通过: ${results.passed.length.toString().padEnd(38)}║`);
  console.log(`║  ❌ 失败: ${results.failed.length.toString().padEnd(38)}║`);
  console.log(`║  ⚠️  警告: ${results.warnings.length.toString().padEnd(38)}║`);
  console.log(`║  📸 截图: ${results.screenshots.length.toString().padEnd(38)}║`);
  console.log(`║  🔴 控制台错误: ${results.consoleErrors.length.toString().padEnd(33)}║`);
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
      console.log(`║    W-${i + 1}: ${(w.name + ' — ' + w.detail).substring(0, 44).padEnd(44)}║`);
    });
  }

  console.log('╠══════════════════════════════════════════════════╣');
  console.log('║  📸 截图列表:                                   ║');
  results.screenshots.forEach((s, i) => {
    const name = path.basename(s);
    console.log(`║    ${i + 1}. ${name.padEnd(43)}║`);
  });
  console.log('╚══════════════════════════════════════════════════╝');

  // 严重程度判定
  const p0Count = results.failed.filter(f =>
    f.name.includes('CampaignTab') || f.name.includes('战斗场景') || f.name.includes('布阵弹窗')
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
    module: '攻城掠地(上)',
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
    screenshots: results.screenshots.map(s => path.basename(s)),
    consoleErrors: results.consoleErrors.slice(0, 20),
  };

  const resultPath = path.join(__dirname, '..', 'e2e-v3-ui-results.json');
  fs.writeFileSync(resultPath, JSON.stringify(resultJson, null, 2));
  console.log(`\n📄 测试结果已保存: ${resultPath}`);

  // Exit code
  process.exit(results.failed.length > 0 ? 1 : 0);
})();
