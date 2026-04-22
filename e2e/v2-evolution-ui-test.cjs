/**
 * v2.0 招贤纳士 — UI测试脚本 R1
 * 覆盖22个功能点的逐项验证
 *
 * 测试模块：
 * 1. HER-A 武将属性（4项）— 属性显示、品质标识、战力数值
 * 2. HER-B 武将招募（4项）— 招募按钮、弹窗、普通/高级招募、保底信息
 * 3. HER-C 武将升级（5项）— 升级按钮、一键强化、批量升级
 * 4. HER-D 武将列表与详情（5项）— 列表布局、详情面板、画像渲染
 * 5. HER-E 武将技能（4项）— 技能列表、编队功能
 *
 * 使用: node e2e/v2-evolution-ui-test.cjs
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// ── 配置 ──
const BASE_URL = process.env.GAME_BASE_URL || 'http://localhost:3000/idle/three-kingdoms';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots', 'v2-evolution');
const RESULTS_FILE = path.join(__dirname, '..', 'e2e-v2-evolution-results.json');

// 确保截图目录存在
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

// ── 测试结果收集 ──
const results = [];
const issues = [];

function check(id, name, pass, detail = '') {
  results.push({ id, name, pass: !!pass, detail });
  const icon = pass ? '✅' : '❌';
  console.log(`  ${icon} ${id}: ${name}${detail ? ' — ' + detail : ''}`);
  if (!pass) {
    issues.push({
      id,
      desc: name + (detail ? ' — ' + detail : ''),
      severity: detail.includes('P0') ? 'P0' : detail.includes('P1') ? 'P1' : 'P2'
    });
  }
}

// ── 截图工具 ──
async function screenshot(page, name) {
  const filepath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: filepath, fullPage: false });
  console.log(`  📸 截图: ${name}.png`);
  return filepath;
}

// ── 关闭弹窗工具 ──
async function closeAllModals(page) {
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const overlay = await page.$('[class*="overlay"][class*="open"], [class*="modal"][class*="open"], [class*="shared-panel"][class*="open"]');
    if (!overlay) break;
    // 尝试点击关闭按钮
    const closeBtn = await page.$('[class*="close"], button[aria-label="关闭"]');
    if (closeBtn) {
      await closeBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(400);
    }
  }
}

// ── 关闭新手引导 ──
async function dismissGuide(page) {
  for (let i = 0; i < 8; i++) {
    const skipBtn = await page.$('button:has-text("跳过"), button:has-text("Skip")');
    if (skipBtn) {
      await skipBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(400);
      continue;
    }
    const nextBtn = await page.$('button:has-text("下一步"), button:has-text("Next")');
    if (nextBtn) {
      await nextBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(400);
      continue;
    }
    // 移除引导覆盖层
    const removed = await page.evaluate(() => {
      let count = 0;
      document.querySelectorAll('[class*="guide-overlay"], [class*="tk-guide"], [class*="GuideOverlay"]').forEach(el => {
        el.remove();
        count++;
      });
      return count;
    });
    if (removed > 0) {
      await page.waitForTimeout(300);
      continue;
    }
    const stillVisible = await page.evaluate(() => {
      const el = document.querySelector('[class*="guide-overlay"], [class*="tk-guide"]');
      return el ? window.getComputedStyle(el).display !== 'none' : false;
    });
    if (!stillVisible) break;
  }
}

// ── 主测试流程 ──
(async () => {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  v2.0 招贤纳士 — UI测试 R1 (22项)          ║');
  console.log('╚══════════════════════════════════════════════╝\n');
  console.log(`URL: ${BASE_URL}`);
  console.log(`截图目录: ${SCREENSHOT_DIR}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  // 收集控制台错误
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push('PAGEERROR: ' + err.message));

  try {
    // ════════════════════════════════════════════════
    // Phase 0: 进入游戏
    // ════════════════════════════════════════════════
    console.log('═══ Phase 0: 加载游戏 ═══');
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    // 关闭欢迎弹窗
    const startBtn = await page.$('button:has-text("开始游戏")');
    if (startBtn) {
      await startBtn.click();
      await page.waitForTimeout(3000);
      console.log('  ✅ 欢迎弹窗已关闭');
    }

    // 关闭引导
    await dismissGuide(page);
    await page.waitForTimeout(1000);

    // 关闭离线奖励等弹窗
    const claimBtn = await page.$('button:has-text("领取"), button:has-text("确定")');
    if (claimBtn) {
      const isVisible = await claimBtn.isVisible().catch(() => false);
      if (isVisible) {
        await claimBtn.click();
        await page.waitForTimeout(1000);
      }
    }
    await closeAllModals(page);
    await page.waitForTimeout(1000);

    // 数据完整性检查
    const bodyText = await page.textContent('body');
    check('DATA-01', '页面无NaN显示', !bodyText.includes('NaN'));
    check('DATA-02', '页面无undefined显示', !bodyText.includes('undefined'));

    await screenshot(page, '00-main-page');

    // ════════════════════════════════════════════════
    // Phase 1: 切换到武将Tab
    // ════════════════════════════════════════════════
    console.log('\n═══ Phase 1: 切换武将Tab ═══');
    await closeAllModals(page);

    // 尝试"武将"或"名士"Tab
    let heroTabBtn = await page.$('button:has-text("武将")');
    if (!heroTabBtn) heroTabBtn = await page.$('button:has-text("名士")');
    if (heroTabBtn) {
      await heroTabBtn.click();
      await page.waitForTimeout(2000);
      await dismissGuide(page);
      console.log('  ✅ 武将Tab切换成功');
    } else {
      check('HER-TAB', '武将Tab按钮', false, '未找到武将/名士Tab按钮 P0');
    }

    await screenshot(page, '01-hero-tab-empty');

    // ════════════════════════════════════════════════
    // Phase 2: 招募武将（先获取武将以测试后续功能）
    // ════════════════════════════════════════════════
    console.log('\n═══ Phase 2: 招募武将 ═══');

    // 检查是否有空状态
    const emptyState = await page.$('.tk-hero-empty');
    if (emptyState) {
      console.log('  ℹ️ 初始无武将，开始招募...');

      // 点击招募按钮
      const recruitBtn = await page.$('.tk-hero-recruit-btn');
      if (recruitBtn) {
        await recruitBtn.click();
        await page.waitForTimeout(1500);
        await dismissGuide(page);
      }

      // 在招募弹窗中单抽
      const singleBtn = await page.$('button:has-text("单次招募"), button:has-text("单抽")');
      if (singleBtn) {
        await singleBtn.click({ force: true });
        await page.waitForTimeout(2000);
        console.log('  ✅ 单次招募完成');
      }

      // 关闭招募结果
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);

      // 关闭招募弹窗
      const closeRecruit = await page.$('.tk-recruit-close');
      if (closeRecruit) {
        await closeRecruit.click({ force: true });
      } else {
        await page.keyboard.press('Escape');
      }
      await page.waitForTimeout(800);

      // 清理残留overlay
      await page.evaluate(() => {
        document.querySelectorAll('.tk-recruit-overlay').forEach(el => el.remove());
      });
      await page.waitForTimeout(300);

      // 切回武将Tab
      heroTabBtn = await page.$('button:has-text("武将")');
      if (!heroTabBtn) heroTabBtn = await page.$('button:has-text("名士")');
      if (heroTabBtn) {
        await heroTabBtn.click({ force: true });
        await page.waitForTimeout(1500);
        await dismissGuide(page);
      }
    }

    await screenshot(page, '02-hero-tab-with-heroes');

    // ════════════════════════════════════════════════
    // 模块A: HER-A 武将属性（4项）
    // ════════════════════════════════════════════════
    console.log('\n═══ 模块A: HER-A 武将属性（4项） ═══');

    let heroCards = await page.$$('.tk-hero-card');

    // HER-A-1: 武将属性显示
    if (heroCards.length > 0) {
      const firstCard = heroCards[0];
      const cardText = await firstCard.textContent();

      // 检查属性：名字
      const nameEl = await firstCard.$('.tk-hero-card-name');
      if (nameEl) {
        const name = await nameEl.textContent();
        check('HER-A-1', '武将属性-名字显示', true, `名字: ${name}`);
      } else {
        check('HER-A-1', '武将属性-名字显示', false, '名字元素未找到 P1');
      }

      // HER-A-2: 品质标识
      const qualityEl = await firstCard.$('.tk-hero-card-quality');
      if (qualityEl) {
        const qualityText = await qualityEl.textContent();
        const qualityStyle = await qualityEl.getAttribute('style');
        const hasBgColor = qualityStyle && qualityStyle.includes('background');
        check('HER-A-2', '武将属性-品质标识', true, `品质: ${qualityText}, 背景色: ${hasBgColor ? '已设置' : '未设置'}`);
      } else {
        check('HER-A-2', '武将属性-品质标识', false, '品质标签未找到 P1');
      }

      // HER-A-3: 战力数值
      const powerEl = await firstCard.$('.tk-hero-card-power');
      if (powerEl) {
        const powerText = await powerEl.textContent();
        const hasNumber = /\d+/.test(powerText);
        check('HER-A-3', '武将属性-战力数值', hasNumber, `战力: ${powerText}`);
      } else {
        check('HER-A-3', '武将属性-战力数值', false, '战力元素未找到 P1');
      }

      // HER-A-4: 等级与阵营
      const levelEl = await firstCard.$('.tk-hero-card-level');
      const factionEl = await firstCard.$('.tk-hero-card-faction');
      const levelText = levelEl ? await levelEl.textContent() : '';
      const factionText = factionEl ? await factionEl.textContent() : '';
      check('HER-A-4', '武将属性-等级与阵营',
        !!levelText && !!factionText,
        `等级: ${levelText || '未找到'}, 阵营: ${factionText || '未找到'}`);

      await screenshot(page, '03-hero-cards-attributes');

    } else {
      check('HER-A-1', '武将属性-名字显示', false, '无武将卡片 P0');
      check('HER-A-2', '武将属性-品质标识', false, '无武将卡片 P0');
      check('HER-A-3', '武将属性-战力数值', false, '无武将卡片 P0');
      check('HER-A-4', '武将属性-等级与阵营', false, '无武将卡片 P0');
    }

    // ════════════════════════════════════════════════
    // 模块B: HER-B 武将招募（4项）
    // ════════════════════════════════════════════════
    console.log('\n═══ 模块B: HER-B 武将招募（4项） ═══');

    await closeAllModals(page);
    await page.waitForTimeout(500);

    // HER-B-1: 招募按钮
    const recruitBtnMain = await page.$('.tk-hero-recruit-btn');
    if (recruitBtnMain) {
      await recruitBtnMain.click();
      await page.waitForTimeout(1500);
      await dismissGuide(page);
      check('HER-B-1', '招募按钮', true, '招募按钮可点击');
    } else {
      // 文本匹配兜底
      const allBtns = await page.$$('button');
      let found = false;
      for (const btn of allBtns) {
        const text = await btn.textContent();
        if (text && text.includes('招募')) {
          await btn.click({ force: true });
          await page.waitForTimeout(1500);
          await dismissGuide(page);
          found = true;
          break;
        }
      }
      check('HER-B-1', '招募按钮', found, found ? '文本匹配找到' : '招募按钮未找到 P0');
    }

    // HER-B-2: 招募弹窗 & 普通/高级选项
    const recruitOverlay = await page.$('.tk-recruit-overlay');
    if (recruitOverlay) {
      check('HER-B-2', '招募弹窗', true, '招募弹窗已打开');

      // 检查招募类型按钮
      const typeBtns = await page.$$('.tk-recruit-type-btn');
      const typeLabels = [];
      for (const btn of typeBtns) {
        const label = await btn.$('.tk-recruit-type-label');
        if (label) {
          const text = await label.textContent();
          typeLabels.push(text);
        }
      }
      check('HER-B-2-types', '普通/高级招募选项', typeLabels.length >= 2,
        `招募类型: ${typeLabels.join(', ')} ${typeLabels.length < 2 ? 'P1' : ''}`);

      // HER-B-3: 单抽/十连按钮及消耗
      let singleRecruitBtn = null;
      let tenRecruitBtn = null;
      const recruitBtns = await page.$$('.tk-recruit-btn');
      for (const btn of recruitBtns) {
        const text = await btn.textContent();
        if (text && (text.includes('单次') || text.includes('单抽'))) singleRecruitBtn = btn;
        if (text && (text.includes('十连') || text.includes('10连'))) tenRecruitBtn = btn;
      }

      const hasSingle = !!singleRecruitBtn;
      const hasTen = !!tenRecruitBtn;
      check('HER-B-3', '单抽/十连招募按钮', hasSingle && hasTen,
        `单抽: ${hasSingle ? '存在' : '未找到'}, 十连: ${hasTen ? '存在' : '未找到'} ${(!hasSingle || !hasTen) ? 'P1' : ''}`);

      // 消耗显示
      const costEls = await page.$$('.tk-recruit-cost');
      const costTexts = [];
      for (const el of costEls) {
        const t = await el.textContent();
        costTexts.push(t);
      }
      check('HER-B-3-cost', '招募消耗显示', costTexts.length >= 1,
        `消耗: ${costTexts.join(', ')}`);

      // HER-B-4: 保底信息
      const pitySection = await page.$('.tk-recruit-pity');
      if (pitySection) {
        const pityItems = await page.$$('.tk-recruit-pity-item');
        const pityBars = await page.$$('.tk-recruit-pity-bar');
        const pityCounts = await page.$$('.tk-recruit-pity-count');
        const pityLabels = [];
        for (const item of pityItems) {
          const label = await item.$('.tk-recruit-pity-label');
          if (label) {
            const t = await label.textContent();
            pityLabels.push(t);
          }
        }
        check('HER-B-4', '保底信息显示', pityItems.length >= 2 && pityBars.length >= 2,
          `保底项: ${pityLabels.join(', ')}, 进度条: ${pityBars.length}条, 计数: ${pityCounts.length}个`);
      } else {
        check('HER-B-4', '保底信息显示', false, '保底区域未找到 P1');
      }

      await screenshot(page, '04-recruit-modal');

      // 尝试切换高级招募
      const allTypeBtns = await page.$$('.tk-recruit-type-btn');
      for (const btn of allTypeBtns) {
        const isActive = await btn.evaluate(el => el.classList.contains('tk-recruit-type-btn--active'));
        if (!isActive) {
          await btn.click();
          await page.waitForTimeout(800);
          break;
        }
      }
      await screenshot(page, '05-recruit-advanced');

      // 关闭招募弹窗
      await page.keyboard.press('Escape');
      await page.waitForTimeout(800);

    } else {
      check('HER-B-2', '招募弹窗', false, '招募弹窗未打开 P0');
      check('HER-B-2-types', '普通/高级招募选项', false, '依赖弹窗 P0');
      check('HER-B-3', '单抽/十连招募按钮', false, '依赖弹窗 P0');
      check('HER-B-3-cost', '招募消耗显示', false, '依赖弹窗 P0');
      check('HER-B-4', '保底信息显示', false, '依赖弹窗 P0');
    }

    // ════════════════════════════════════════════════
    // 模块C: HER-C 武将升级（5项）
    // ════════════════════════════════════════════════
    console.log('\n═══ 模块C: HER-C 武将升级（5项） ═══');

    await closeAllModals(page);
    await page.waitForTimeout(500);

    // 清理残留overlay
    await page.evaluate(() => {
      document.querySelectorAll('.tk-recruit-overlay').forEach(el => el.remove());
    });
    await page.waitForTimeout(300);

    // 切回武将Tab
    heroTabBtn = await page.$('button:has-text("武将")');
    if (!heroTabBtn) heroTabBtn = await page.$('button:has-text("名士")');
    if (heroTabBtn) {
      await heroTabBtn.click({ force: true });
      await page.waitForTimeout(1500);
      await dismissGuide(page);
    }

    heroCards = await page.$$('.tk-hero-card');

    if (heroCards.length > 0) {
      // 点击第一个武将卡片打开详情
      await heroCards[0].click();
      await page.waitForTimeout(1500);
      await dismissGuide(page);

      const detailOverlay = await page.$('.tk-hero-detail-overlay');
      const detailModal = await page.$('.tk-hero-detail-modal');

      if (detailOverlay || detailModal) {
        await screenshot(page, '06-hero-detail-opened');

        // HER-C-1: 升级按钮
        const enhanceBtn = await page.$('.tk-hero-detail-enhance-btn');
        if (enhanceBtn) {
          const btnText = await enhanceBtn.textContent();
          check('HER-C-1', '升级按钮', true, `按钮文本: ${btnText}`);
        } else {
          check('HER-C-1', '升级按钮', false, '升级按钮未找到 P1');
        }

        // HER-C-2: 一键强化（+5级按钮）
        const maxBtn = await page.$('.tk-hero-detail-enhance-max-btn');
        if (maxBtn) {
          const maxText = await maxBtn.textContent();
          check('HER-C-2', '一键强化(+5级)', true, `按钮文本: ${maxText}`);
        } else {
          check('HER-C-2', '一键强化(+5级)', false, '+5级按钮未找到 P2');
        }

        // HER-C-3: 升级消耗显示
        const costEl = await page.$('.tk-hero-detail-enhance-cost');
        if (costEl) {
          const costText = await costEl.textContent();
          check('HER-C-3', '升级消耗显示', true, `消耗: ${costText}`);
        } else {
          check('HER-C-3', '升级消耗显示', false, '消耗显示未找到 P2');
        }

        // HER-C-4: 战力预览
        const powerDiff = await page.$('.tk-hero-detail-enhance-power-diff');
        if (powerDiff) {
          const diffText = await powerDiff.textContent();
          check('HER-C-4', '战力预览', true, `预览: ${diffText.trim()}`);
        } else {
          check('HER-C-4', '战力预览', false, '战力预览未找到 P2');
        }

        // HER-C-5: 批量升级/资源充足状态
        const affordable = await page.$('.tk-hero-detail-enhance-affordable');
        if (affordable) {
          const affordText = await affordable.textContent();
          check('HER-C-5', '资源状态提示', true, `状态: ${affordText}`);
        } else {
          // 检查升级区域是否存在
          const enhanceSection = await page.$('.tk-hero-detail-enhance');
          check('HER-C-5', '资源状态提示', !!enhanceSection,
            enhanceSection ? '升级区域存在但无资源状态文字 P2' : '升级区域未找到 P1');
        }

        await screenshot(page, '07-hero-upgrade-section');

      } else {
        check('HER-C-1', '升级按钮', false, '武将详情弹窗未打开 P0');
        check('HER-C-2', '一键强化(+5级)', false, '依赖详情弹窗 P0');
        check('HER-C-3', '升级消耗显示', false, '依赖详情弹窗 P0');
        check('HER-C-4', '战力预览', false, '依赖详情弹窗 P0');
        check('HER-C-5', '资源状态提示', false, '依赖详情弹窗 P0');
      }
    } else {
      check('HER-C-1', '升级按钮', false, '无武将卡片 P0');
      check('HER-C-2', '一键强化(+5级)', false, '无武将卡片 P0');
      check('HER-C-3', '升级消耗显示', false, '无武将卡片 P0');
      check('HER-C-4', '战力预览', false, '无武将卡片 P0');
      check('HER-C-5', '资源状态提示', false, '无武将卡片 P0');
    }

    // ════════════════════════════════════════════════
    // 模块D: HER-D 武将列表与详情（5项）
    // ════════════════════════════════════════════════
    console.log('\n═══ 模块D: HER-D 武将列表与详情（5项） ═══');

    // 如果详情弹窗已打开，继续检查；否则打开
    const detailOpen = await page.$('.tk-hero-detail-overlay');
    if (!detailOpen) {
      await closeAllModals(page);
      await page.waitForTimeout(500);
      heroCards = await page.$$('.tk-hero-card');
      if (heroCards.length > 0) {
        await heroCards[0].click();
        await page.waitForTimeout(1500);
        await dismissGuide(page);
      }
    }

    // HER-D-1: 武将列表布局
    const heroGrid = await page.$('.tk-hero-grid');
    const heroTab = await page.$('.tk-hero-tab');
    const heroToolbar = await page.$('.tk-hero-toolbar');
    check('HER-D-1', '武将列表布局',
      !!(heroGrid || heroTab),
      `网格: ${heroGrid ? '存在' : '未找到'}, Tab面板: ${heroTab ? '存在' : '未找到'}, 工具栏: ${heroToolbar ? '存在' : '未找到'}`);

    // HER-D-2: 详情面板
    const detailModal2 = await page.$('.tk-hero-detail-modal');
    if (detailModal2) {
      const detailText = await detailModal2.textContent();
      const hasHeader = !!(await page.$('.tk-hero-detail-header'));
      const hasBody = !!(await page.$('.tk-hero-detail-body'));
      check('HER-D-2', '详情面板', hasHeader && hasBody,
        `头部: ${hasHeader ? '存在' : '未找到'}, 主体: ${hasBody ? '存在' : '未找到'}, 内容长度: ${detailText.length}`);
    } else {
      check('HER-D-2', '详情面板', false, '详情面板未找到 P0');
    }

    // HER-D-3: 画像渲染
    const portrait = await page.$('.tk-hero-detail-portrait');
    if (portrait) {
      const portraitStyle = await portrait.getAttribute('style');
      const portraitChar = await page.$('.tk-hero-detail-portrait-char');
      const charText = portraitChar ? await portraitChar.textContent() : '';
      check('HER-D-3', '画像渲染', true,
        `头像存在, 品质背景: ${portraitStyle && portraitStyle.includes('gradient') ? '已设置' : '未设置'}, 字符: ${charText}`);
    } else {
      check('HER-D-3', '画像渲染', false, '头像元素未找到 P1');
    }

    // HER-D-4: 总战力显示
    // 需要关闭详情弹窗回到列表
    await page.keyboard.press('Escape');
    await page.waitForTimeout(800);
    await closeAllModals(page);
    await page.waitForTimeout(500);

    const totalPower = await page.$('.tk-hero-total-power');
    if (totalPower) {
      const powerText = await totalPower.textContent();
      check('HER-D-4', '总战力显示', true, `显示: ${powerText.trim()}`);
    } else {
      check('HER-D-4', '总战力显示', false, '总战力元素未找到 P2');
    }

    // HER-D-5: 筛选/排序功能
    const filterBtns = await page.$$('.tk-hero-filter-btn');
    const selectEls = await page.$$('.tk-hero-select');
    check('HER-D-5', '筛选/排序功能',
      filterBtns.length > 0 || selectEls.length > 0,
      `筛选按钮: ${filterBtns.length}个, 下拉选择: ${selectEls.length}个`);

    await screenshot(page, '08-hero-list-layout');

    // ════════════════════════════════════════════════
    // 模块E: HER-E 武将技能（4项）
    // ════════════════════════════════════════════════
    console.log('\n═══ 模块E: HER-E 武将技能（4项） ═══');

    // 重新打开武将详情
    heroCards = await page.$$('.tk-hero-card');
    if (heroCards.length > 0) {
      await heroCards[0].click();
      await page.waitForTimeout(1500);
      await dismissGuide(page);
    }

    // HER-E-1: 技能列表
    const skillItems = await page.$$('.tk-hero-detail-skill-item');
    const skillEmpty = await page.$('.tk-hero-detail-skill-empty');
    if (skillItems.length > 0) {
      const skillNames = [];
      for (const item of skillItems) {
        const nameEl = await item.$('.tk-hero-detail-skill-name');
        if (nameEl) {
          const name = await nameEl.textContent();
          skillNames.push(name);
        }
      }
      check('HER-E-1', '技能列表', true, `技能数量: ${skillItems.length}, 名称: ${skillNames.join(', ')}`);
    } else if (skillEmpty) {
      check('HER-E-1', '技能列表', true, '技能区域存在（暂无技能提示）');
    } else {
      check('HER-E-1', '技能列表', false, '技能区域未找到 P2');
    }

    // HER-E-2: 技能详情（描述、等级、类型）
    if (skillItems.length > 0) {
      const firstSkill = skillItems[0];
      const skillDesc = await firstSkill.$('.tk-hero-detail-skill-desc');
      const skillLevel = await firstSkill.$('.tk-hero-detail-skill-level');
      const skillType = await firstSkill.$('.tk-hero-detail-skill-type');
      const descText = skillDesc ? await skillDesc.textContent() : '';
      const levelText = skillLevel ? await skillLevel.textContent() : '';
      const typeText = skillType ? await skillType.textContent() : '';
      check('HER-E-2', '技能详情', true,
        `描述: ${descText ? '有' : '无'}, 等级: ${levelText || '无'}, 类型: ${typeText || '无'}`);
    } else {
      check('HER-E-2', '技能详情', false, '无技能项可检查 P2');
    }

    // HER-E-3: 编队功能Tab
    await closeAllModals(page);
    await page.waitForTimeout(500);

    const formationTab = await page.$('.tk-hero-sub-tab');
    const formationTabBtns = await page.$$('.tk-hero-sub-tab');
    let hasFormationTab = false;
    for (const btn of formationTabBtns) {
      const text = await btn.textContent();
      if (text && text.includes('编队')) {
        hasFormationTab = true;
        break;
      }
    }
    check('HER-E-3', '编队功能Tab', hasFormationTab,
      hasFormationTab ? '编队子Tab存在' : '编队子Tab未找到 P2');

    // 点击编队Tab
    if (hasFormationTab) {
      for (const btn of formationTabBtns) {
        const text = await btn.textContent();
        if (text && text.includes('编队')) {
          await btn.click();
          await page.waitForTimeout(1500);
          break;
        }
      }
    }

    // HER-E-4: 编队面板内容
    const formationPanel = await page.$('[class*="formation"], [class*="Formation"]');
    const formationContent = await page.evaluate(() => {
      const body = document.body.textContent || '';
      return {
        hasFormationText: body.includes('编队') || body.includes('阵容'),
        hasSlotText: body.includes('空位') || body.includes('槽位') || body.includes('位置'),
        hasAutoBtn: body.includes('自动') || body.includes('一键'),
      };
    });
    check('HER-E-4', '编队面板内容',
      formationPanel != null || formationContent.hasFormationText,
      `面板元素: ${formationPanel ? '存在' : '未找到'}, 编队文字: ${formationContent.hasFormationText}, 空位: ${formationContent.hasSlotText}`);

    await screenshot(page, '09-formation-panel');

    // ════════════════════════════════════════════════
    // 附加检查: SVG雷达图 & 品质显示
    // ════════════════════════════════════════════════
    console.log('\n═══ 附加检查 ═══');

    // 先切回列表子Tab
    const listTabBtns = await page.$$('.tk-hero-sub-tab');
    for (const btn of listTabBtns) {
      const text = await btn.textContent();
      if (text && (text.includes('列表') || text.includes('武将'))) {
        await btn.click();
        await page.waitForTimeout(1500);
        break;
      }
    }
    await dismissGuide(page);

    // 如果详情弹窗已关闭，重新打开
    const detailStillOpen = await page.$('.tk-hero-detail-overlay');
    if (!detailStillOpen) {
      heroCards = await page.$$('.tk-hero-card');
      if (heroCards.length > 0) {
        await heroCards[0].click();
        await page.waitForTimeout(2000);
        await dismissGuide(page);
      }
    }

    // SVG雷达图
    const radarSvg = await page.$('.tk-hero-radar');
    if (radarSvg) {
      const svgContent = await radarSvg.innerHTML();
      const hasPolygons = svgContent.includes('<polygon');
      const hasTexts = svgContent.includes('<text');
      check('BONUS-RADAR', 'SVG雷达图', hasPolygons && hasTexts,
        `多边形: ${hasPolygons}, 文字: ${hasTexts}`);
    } else {
      check('BONUS-RADAR', 'SVG雷达图', false, '雷达图未找到 P2');
    }

    // 品质边框
    const headerBorder = await page.$('.tk-hero-detail-header');
    if (headerBorder) {
      const borderStyle = await headerBorder.getAttribute('style');
      check('BONUS-QUALITY', '品质边框颜色', !!(borderStyle && borderStyle.includes('border')),
        `边框样式: ${borderStyle ? '已设置' : '未设置'}`);
    }

    // 属性条
    const statRows = await page.$$('.tk-hero-detail-stat-row');
    check('BONUS-STATS', '四维属性条', statRows.length >= 4,
      `属性条数量: ${statRows.length}`);

    // 碎片区域
    const fragSection = await page.$('.tk-hero-detail-fragments');
    if (fragSection) {
      const fragHeader = await page.$('.tk-hero-detail-fragments-header');
      const synthBtn = await page.$('.tk-hero-detail-synthesize-btn');
      const fragText = fragHeader ? await fragHeader.textContent() : '';
      check('BONUS-FRAG', '碎片合成', true,
        `碎片: ${fragText}, 合成按钮: ${synthBtn ? '存在' : '未找到'}`);
    } else {
      check('BONUS-FRAG', '碎片合成', false, '碎片区域未找到 P2');
    }

    // 经验条
    const expSection = await page.$('.tk-hero-detail-exp-section');
    check('BONUS-EXP', '经验条', !!expSection,
      expSection ? '经验条存在' : '经验条未找到');

    // 升星按钮
    const starUpBtns = await page.$$('.tk-hero-detail-compare-btn');
    let hasStarUp = false;
    for (const btn of starUpBtns) {
      const t = await btn.textContent();
      if (t && t.includes('升星')) { hasStarUp = true; break; }
    }
    check('BONUS-STARUP', '升星按钮', hasStarUp,
      hasStarUp ? '升星按钮存在' : '升星按钮未找到');

    await screenshot(page, '10-hero-detail-full');

    // ════════════════════════════════════════════════
    // 移动端测试
    // ════════════════════════════════════════════════
    console.log('\n═══ 移动端测试 (375×667) ═══');
    await closeAllModals(page);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(2000);
    await dismissGuide(page);

    // 切到武将Tab
    const mobileHeroTab = await page.$('button:has-text("武将")');
    if (!mobileHeroTab) {
      const alt = await page.$('button:has-text("名士")');
      if (alt) await alt.click();
    } else {
      await mobileHeroTab.click();
    }
    await page.waitForTimeout(1500);
    await dismissGuide(page);
    await screenshot(page, '11-mobile-hero-tab');

    const mobileCards = await page.$$('.tk-hero-card');
    check('MOBILE-01', '移动端武将卡片', mobileCards.length > 0, `数量: ${mobileCards.length}`);

    // 移动端详情
    if (mobileCards.length > 0) {
      await mobileCards[0].click({ force: true });
      await page.waitForTimeout(1500);
      await dismissGuide(page);
      await screenshot(page, '12-mobile-hero-detail');
      await closeAllModals(page);
      await page.waitForTimeout(500);
    }

    // 移动端招募
    const mobileRecruitBtn = await page.$('.tk-hero-recruit-btn');
    if (mobileRecruitBtn) {
      await mobileRecruitBtn.click();
      await page.waitForTimeout(1500);
      await dismissGuide(page);
      await screenshot(page, '13-mobile-recruit');
      await closeAllModals(page);
      await page.waitForTimeout(500);
    }

    // ════════════════════════════════════════════════
    // 控制台错误检查
    // ════════════════════════════════════════════════
    console.log('\n═══ 控制台错误检查 ═══');
    const realErrors = consoleErrors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('DevTools') &&
      !e.includes('Download the React DevTools')
    );
    check('CONSOLE', '控制台无JS错误', realErrors.length === 0,
      realErrors.length > 0 ? `${realErrors.length}个错误: ${realErrors.slice(0, 3).join('; ')}` : '无错误');

    // ════════════════════════════════════════════════
    // 生成测试报告
    // ════════════════════════════════════════════════
    console.log('\n══════════════════════════════════════════════');
    console.log('  测试结果汇总');
    console.log('══════════════════════════════════════════════');

    const passed = results.filter(r => r.pass).length;
    const failed = results.filter(r => !r.pass).length;
    console.log(`  通过: ${passed}/${results.length}`);
    console.log(`  失败: ${failed}/${results.length}`);

    if (issues.length > 0) {
      console.log('\n  发现的问题:');
      issues.forEach(i => console.log(`    [${i.severity}] ${i.id}: ${i.desc}`));
    }

    // 保存结果到JSON
    const report = {
      version: 'v2.0',
      testRound: 'R1',
      date: new Date().toISOString(),
      gameUrl: BASE_URL,
      browser: 'Chromium',
      viewport: { pc: '1280x720', mobile: '375x667' },
      total: results.length,
      passed,
      failed,
      issues,
      results
    };
    fs.writeFileSync(RESULTS_FILE, JSON.stringify(report, null, 2));
    console.log(`\n  测试结果已保存到: ${RESULTS_FILE}`);

  } catch (error) {
    console.error('\n❌ 测试执行出错:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
    console.log('\n测试完成，浏览器已关闭。');
  }
})();
