/**
 * v2.0 招贤纳士 — 进化迭代R1 UI测试
 *
 * 测试覆盖：
 * 1. 武将Tab — 切换、列表显示
 * 2. 武将卡片 — 名字、品质、等级、战力
 * 3. 武将详情弹窗 — 属性、技能、升级、碎片
 * 4. 招募弹窗 — 单抽/十连、消耗、保底进度
 * 5. SVG雷达图 — 详情弹窗内
 * 6. 保底进度 — 十连保底+硬保底
 * 7. 武将升级 — 升级按钮、经验/铜钱消耗
 * 8. 碎片合成 — 碎片UI、合成按钮
 * 9. 品质显示 — 品质颜色/光效
 *
 * 使用: node e2e/v2-evolution-ui-test.cjs
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.GAME_BASE_URL || 'http://localhost:3000/idle/three-kingdoms';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots', 'v2-evolution');

// Test results collector
const results = {
  passed: [],
  failed: [],
  warnings: [],
  consoleErrors: [],
  screenshots: [],
};

function pass(id, desc) {
  results.passed.push({ id, desc });
  console.log(`  ✅ ${id}: ${desc}`);
}

function fail(id, desc, severity = 'P1') {
  results.failed.push({ id, desc, severity });
  console.log(`  ❌ ${id}: ${desc} [${severity}]`);
}

function warn(id, desc) {
  results.warnings.push({ id, desc });
  console.log(`  ⚠️ ${id}: ${desc}`);
}

async function screenshot(page, name) {
  const filepath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: filepath, fullPage: false });
  results.screenshots.push(name);
  console.log(`  📸 ${name}.png`);
  return filepath;
}

(async () => {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  v2.0 招贤纳士 — 进化迭代R1 UI测试         ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`URL: ${BASE_URL}`);
  console.log(`截图目录: ${SCREENSHOT_DIR}`);
  console.log('');

  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  // Collect console errors
  page.on('console', msg => {
    if (msg.type() === 'error') results.consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => results.consoleErrors.push('PAGEERROR: ' + err.message));

  // ─────────────────────────────────────────
  // Helper: dismiss guide/tutorial overlays
  // ─────────────────────────────────────────
  async function dismissGuide() {
    for (let i = 0; i < 8; i++) {
      // Try clicking Skip/跳过
      const skipBtn = await page.$('button:has-text("跳过"), button:has-text("Skip")');
      if (skipBtn) {
        await skipBtn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(400);
        continue;
      }
      // Try clicking Next/下一步
      const nextBtn = await page.$('button:has-text("下一步"), button:has-text("Next")');
      if (nextBtn) {
        await nextBtn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(400);
        continue;
      }
      // Try removing guide overlays via DOM
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
      // Check if any guide still visible
      const stillVisible = await page.evaluate(() => {
        const el = document.querySelector('[class*="guide-overlay"], [class*="tk-guide"]');
        return el ? window.getComputedStyle(el).display !== 'none' : false;
      });
      if (!stillVisible) break;
    }
  }

  // ─────────────────────────────────────────
  // Helper: close all modals
  // ─────────────────────────────────────────
  async function closeAllModals() {
    for (let i = 0; i < 5; i++) {
      const overlay = await page.$('[class*="overlay"][class*="open"], [class*="modal"][class*="open"], [class*="shared-panel"][class*="open"]');
      if (!overlay) break;
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    }
  }

  // ═══════════════════════════════════════════
  // Phase 0: Load game
  // ═══════════════════════════════════════════
  console.log('\n═══ Phase 0: 加载游戏 ═══');

  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  // Close welcome modal
  const startBtn = await page.$('button:has-text("开始游戏")');
  if (startBtn) {
    await startBtn.click();
    await page.waitForTimeout(3000);
    pass('LOAD-01', '开始游戏按钮点击成功');
  } else {
    warn('LOAD-01', '未找到开始游戏按钮（可能已进入游戏）');
  }

  await dismissGuide();
  await page.waitForTimeout(1000);
  await screenshot(page, '00-main-page');

  // Data integrity check
  const bodyText = await page.textContent('body');
  if (bodyText.includes('NaN')) fail('DATA-01', '页面显示NaN', 'P0');
  else pass('DATA-01', '页面无NaN');
  if (bodyText.includes('undefined')) fail('DATA-02', '页面显示undefined', 'P0');
  else pass('DATA-02', '页面无undefined');

  // ═══════════════════════════════════════════
  // Phase 1: 武将Tab
  // ═══════════════════════════════════════════
  console.log('\n═══ Phase 1: 武将Tab ═══');

  await closeAllModals();
  const heroTabBtn = await page.$('button:has-text("武将")');
  if (heroTabBtn) {
    await heroTabBtn.click();
    await page.waitForTimeout(2000);
    await dismissGuide();
    pass('TAB-01', '武将Tab切换成功');
  } else {
    fail('TAB-01', '武将Tab按钮未找到', 'P0');
  }

  await screenshot(page, '01-hero-tab');

  // Check hero list container
  const heroGrid = await page.$('.tk-hero-grid');
  if (heroGrid) pass('TAB-02', '武将列表网格(.tk-hero-grid)存在');
  else warn('TAB-02', '武将列表网格(.tk-hero-grid)未找到');

  // Check toolbar
  const toolbar = await page.$('.tk-hero-toolbar');
  if (toolbar) pass('TAB-03', '武将工具栏(.tk-hero-toolbar)存在');
  else warn('TAB-03', '武将工具栏未找到');

  // Check total power display
  const totalPower = await page.$('.tk-hero-total-power');
  if (totalPower) {
    const powerText = await totalPower.textContent();
    pass('TAB-04', `总战力显示: ${powerText.trim()}`);
  } else {
    warn('TAB-04', '总战力显示未找到');
  }

  // Check recruit button
  const recruitBtn = await page.$('.tk-hero-recruit-btn');
  if (recruitBtn) pass('TAB-05', '招募按钮(.tk-hero-recruit-btn)存在');
  else fail('TAB-05', '招募按钮未找到', 'P1');

  // ═══════════════════════════════════════════
  // Phase 2: 武将卡片
  // ═══════════════════════════════════════════
  console.log('\n═══ Phase 2: 武将卡片 ═══');

  let heroCards = await page.$$('.tk-hero-card');

  if (heroCards.length === 0) {
    console.log('  ⚠️ 无武将卡片，需要先招募武将...');
    // Check empty state
    const emptyState = await page.$('.tk-hero-empty');
    if (emptyState) pass('CARD-00', '空状态提示(.tk-hero-empty)正确显示');

    // Go recruit to get some heroes
    const goRecruitBtn = await page.$('.tk-hero-empty-btn');
    if (goRecruitBtn) {
      await goRecruitBtn.click({ force: true });
      await page.waitForTimeout(1500);
      await dismissGuide();

      // Try single recruit
      const singleBtn = await page.$('button:has-text("单次招募"), button:has-text("单抽")');
      if (singleBtn) {
        await singleBtn.click({ force: true });
        await page.waitForTimeout(2000);
        pass('CARD-00-RECRUIT', '通过空状态按钮招募了武将');
      }

      // Close recruit modal via Escape or close button
      const closeBtn = await page.$('.tk-recruit-close');
      if (closeBtn) {
        await closeBtn.click({ force: true });
      } else {
        await page.keyboard.press('Escape');
      }
      await page.waitForTimeout(1000);

      // Dismiss any result overlays
      const resultClose = await page.$('.tk-recruit-results-close');
      if (resultClose) {
        await resultClose.click({ force: true });
        await page.waitForTimeout(500);
      }

      // Close recruit overlay completely
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);

      // Verify overlay is gone
      const overlayStill = await page.$('.tk-recruit-overlay');
      if (overlayStill) {
        await page.evaluate(() => {
          const overlay = document.querySelector('.tk-recruit-overlay');
          if (overlay) overlay.remove();
        });
        await page.waitForTimeout(300);
      }

      // Switch back to hero tab
      const heroTabBtn2 = await page.$('button:has-text("武将")');
      if (heroTabBtn2) {
        await heroTabBtn2.click({ force: true });
        await page.waitForTimeout(1500);
        await dismissGuide();
      }

      heroCards = await page.$$('.tk-hero-card');
    }
  }

  if (heroCards.length > 0) {
    pass('CARD-01', `武将卡片数量: ${heroCards.length}`);

    // Check first card details
    const firstCard = heroCards[0];
    const cardText = await firstCard.textContent();

    // Name
    const nameEl = await firstCard.$('.tk-hero-card-name');
    if (nameEl) {
      const name = await nameEl.textContent();
      pass('CARD-02', `武将名字: ${name}`);
    } else {
      fail('CARD-02', '武将名字(.tk-hero-card-name)未找到', 'P1');
    }

    // Quality badge
    const qualityEl = await firstCard.$('.tk-hero-card-quality');
    if (qualityEl) {
      const qualityText = await qualityEl.textContent();
      pass('CARD-03', `品质标签: ${qualityText}`);
    } else {
      fail('CARD-03', '品质标签(.tk-hero-card-quality)未找到', 'P2');
    }

    // Level
    const levelEl = await firstCard.$('.tk-hero-card-level');
    if (levelEl) {
      const levelText = await levelEl.textContent();
      pass('CARD-04', `等级显示: ${levelText}`);
    } else {
      warn('CARD-04', '等级(.tk-hero-card-level)未找到');
    }

    // Power
    const powerEl = await firstCard.$('.tk-hero-card-power');
    if (powerEl) {
      const powerText = await powerEl.textContent();
      pass('CARD-05', `战力显示: ${powerText}`);
    } else {
      warn('CARD-05', '战力(.tk-hero-card-power)未找到');
    }

    // Faction
    const factionEl = await firstCard.$('.tk-hero-card-faction');
    if (factionEl) {
      const factionText = await factionEl.textContent();
      pass('CARD-06', `阵营显示: ${factionText}`);
    } else {
      warn('CARD-06', '阵营(.tk-hero-card-faction)未找到');
    }

    // Portrait
    const portraitEl = await firstCard.$('.tk-hero-card-portrait');
    if (portraitEl) pass('CARD-07', '头像区域(.tk-hero-card-portrait)存在');
    else warn('CARD-07', '头像区域未找到');

    // Quality border color (check style attribute)
    const cardStyle = await firstCard.getAttribute('style');
    if (cardStyle && cardStyle.includes('borderColor')) {
      pass('CARD-08', '品质边框颜色已设置');
    } else if (cardStyle && cardStyle.includes('border-color')) {
      pass('CARD-08', '品质边框颜色已设置(border-color)');
    } else {
      warn('CARD-08', '品质边框颜色未通过style设置');
    }

    await screenshot(page, '02-hero-cards');

    // ═══════════════════════════════════════════
    // Phase 3: 武将详情弹窗
    // ═══════════════════════════════════════════
    console.log('\n═══ Phase 3: 武将详情弹窗 ═══');

    await firstCard.click();
    await page.waitForTimeout(1500);
    await dismissGuide();

    const detailOverlay = await page.$('.tk-hero-detail-overlay');
    if (detailOverlay) {
      pass('DETAIL-01', '武将详情弹窗(.tk-hero-detail-overlay)已打开');
    } else {
      fail('DETAIL-01', '武将详情弹窗未打开', 'P0');
    }

    const detailModal = await page.$('.tk-hero-detail-modal');
    if (detailModal) {
      const detailText = await detailModal.textContent();

      // Header
      const headerName = await page.$('.tk-hero-detail-title-name');
      if (headerName) {
        const name = await headerName.textContent();
        pass('DETAIL-02', `详情标题-名字: ${name}`);
      } else {
        fail('DETAIL-02', '详情标题名字未找到', 'P1');
      }

      // Quality label in header
      const headerQuality = await page.$('.tk-hero-detail-title-quality');
      if (headerQuality) {
        const qualityText = await headerQuality.textContent();
        const qualityStyle = await headerQuality.getAttribute('style');
        pass('DETAIL-03', `详情-品质: ${qualityText} (颜色: ${qualityStyle ? '已设置' : '未设置'})`);
      } else {
        warn('DETAIL-03', '详情品质标签未找到');
      }

      // Faction
      const headerFaction = await page.$('.tk-hero-detail-title-faction');
      if (headerFaction) {
        const factionText = await headerFaction.textContent();
        pass('DETAIL-04', `详情-阵营: ${factionText}`);
      } else {
        warn('DETAIL-04', '详情阵营未找到');
      }

      // Level badge
      const levelBadge = await page.$('.tk-hero-detail-level-badge');
      if (levelBadge) {
        const levelText = await levelBadge.textContent();
        pass('DETAIL-05', `详情-等级: ${levelText}`);
      } else {
        fail('DETAIL-05', '详情等级徽章未找到', 'P1');
      }

      // Power
      const powerSection = await page.$('.tk-hero-detail-power');
      if (powerSection) {
        const powerText = await powerSection.textContent();
        pass('DETAIL-06', `详情-战力: ${powerText.trim()}`);
      } else {
        fail('DETAIL-06', '详情战力未找到', 'P1');
      }

      // Portrait
      const portrait = await page.$('.tk-hero-detail-portrait');
      if (portrait) {
        const portraitStyle = await portrait.getAttribute('style');
        pass('DETAIL-07', `详情-头像存在 (品质背景: ${portraitStyle ? '已设置' : '未设置'})`);
      } else {
        warn('DETAIL-07', '详情头像未找到');
      }

      // ═══════════════════════════════════════
      // Phase 5: SVG雷达图
      // ═══════════════════════════════════════
      console.log('\n═══ Phase 5: SVG雷达图 ═══');

      const radarSvg = await page.$('.tk-hero-radar');
      if (radarSvg) {
        pass('RADAR-01', 'SVG雷达图(.tk-hero-radar)存在');

        // Check SVG structure
        const svgContent = await radarSvg.innerHTML();
        const hasPolygons = svgContent.includes('<polygon');
        const hasCircles = svgContent.includes('<circle');
        const hasTexts = svgContent.includes('<text');
        const hasLines = svgContent.includes('<line');

        pass('RADAR-02', `雷达图结构: polygons=${hasPolygons}, circles=${hasCircles}, texts=${hasTexts}, lines=${hasLines}`);

        // Check radar section wrapper
        const radarSection = await page.$('.tk-hero-detail-radar-section');
        if (radarSection) pass('RADAR-03', '雷达图区域(.tk-hero-detail-radar-section)存在');
        else warn('RADAR-03', '雷达图区域包裹未找到');

        // Check radar data polygon
        const dataPolygon = await page.$('.tk-hero-radar-data');
        if (dataPolygon) pass('RADAR-04', '雷达图数据多边形(.tk-hero-radar-data)存在');
        else warn('RADAR-04', '雷达图数据多边形未找到');

      } else {
        fail('RADAR-01', 'SVG雷达图(.tk-hero-radar)未找到', 'P1');
      }

      // ═══════════════════════════════════════
      // Phase 7: 武将升级
      // ═══════════════════════════════════════
      console.log('\n═══ Phase 7: 武将升级 ═══');

      const enhanceSection = await page.$('.tk-hero-detail-enhance');
      if (enhanceSection) {
        pass('UPGRADE-01', '升级区域(.tk-hero-detail-enhance)存在');

        // Upgrade button
        const enhanceBtn = await page.$('.tk-hero-detail-enhance-btn');
        if (enhanceBtn) {
          const btnText = await enhanceBtn.textContent();
          pass('UPGRADE-02', `升级按钮: ${btnText}`);
        } else {
          fail('UPGRADE-02', '升级按钮(.tk-hero-detail-enhance-btn)未找到', 'P1');
        }

        // +5 level button
        const maxBtn = await page.$('.tk-hero-detail-enhance-max-btn');
        if (maxBtn) pass('UPGRADE-03', '+5级按钮(.tk-hero-detail-enhance-max-btn)存在');
        else warn('UPGRADE-03', '+5级按钮未找到');

        // Cost display
        const costEl = await page.$('.tk-hero-detail-enhance-cost');
        if (costEl) {
          const costText = await costEl.textContent();
          pass('UPGRADE-04', `升级消耗: ${costText}`);
        } else {
          warn('UPGRADE-04', '升级消耗显示未找到');
        }

        // Power preview
        const powerDiff = await page.$('.tk-hero-detail-enhance-power-diff');
        if (powerDiff) {
          const diffText = await powerDiff.textContent();
          pass('UPGRADE-05', `战力预览: ${diffText.trim()}`);
        } else {
          warn('UPGRADE-05', '战力预览未显示');
        }

        // Affordable indicator
        const affordable = await page.$('.tk-hero-detail-enhance-affordable');
        if (affordable) {
          const affordText = await affordable.textContent();
          pass('UPGRADE-06', `资源状态: ${affordText}`);
        } else {
          warn('UPGRADE-06', '资源充足/不足提示未找到');
        }

      } else {
        fail('UPGRADE-01', '升级区域(.tk-hero-detail-enhance)未找到', 'P1');
      }

      // ═══════════════════════════════════════
      // Phase 8: 碎片合成
      // ═══════════════════════════════════════
      console.log('\n═══ Phase 8: 碎片合成 ═══');

      const fragmentSection = await page.$('.tk-hero-detail-fragments');
      if (fragmentSection) {
        pass('FRAG-01', '碎片区域(.tk-hero-detail-fragments)存在');

        // Fragment count
        const fragHeader = await page.$('.tk-hero-detail-fragments-header');
        if (fragHeader) {
          const fragText = await fragHeader.textContent();
          pass('FRAG-02', `碎片数量: ${fragText}`);
        } else {
          warn('FRAG-02', '碎片数量显示未找到');
        }

        // Fragment progress bar
        const fragBar = await page.$('.tk-hero-detail-fragments-bar');
        if (fragBar) pass('FRAG-03', '碎片进度条(.tk-hero-detail-fragments-bar)存在');
        else warn('FRAG-03', '碎片进度条未找到');

        // Synthesize button
        const synthBtn = await page.$('.tk-hero-detail-synthesize-btn');
        if (synthBtn) {
          const synthText = await synthBtn.textContent();
          pass('FRAG-04', `合成按钮: ${synthText}`);
        } else {
          fail('FRAG-04', '碎片合成按钮未找到', 'P2');
        }

      } else {
        warn('FRAG-01', '碎片区域(.tk-hero-detail-fragments)未找到');
      }

      // ═══════════════════════════════════════
      // Phase 9: 品质显示
      // ═══════════════════════════════════════
      console.log('\n═══ Phase 9: 品质显示 ═══');

      // Check quality border color on detail header
      const headerBorder = await page.$('.tk-hero-detail-header');
      if (headerBorder) {
        const headerBorderStyle = await headerBorder.getAttribute('style');
        if (headerBorderStyle && headerBorderStyle.includes('border')) {
          pass('QUALITY-01', `详情头部品质边框颜色已设置`);
        } else {
          warn('QUALITY-01', '详情头部品质边框颜色未设置');
        }
      }

      // Check quality background on portrait
      if (portrait) {
        const portraitStyle = await portrait.getAttribute('style');
        if (portraitStyle && portraitStyle.includes('linear-gradient')) {
          pass('QUALITY-02', '头像品质渐变背景已设置');
        } else {
          warn('QUALITY-02', '头像品质渐变背景未设置');
        }
      }

      // Check quality badge style
      if (headerQuality) {
        const qStyle = await headerQuality.getAttribute('style');
        if (qStyle && qStyle.includes('background')) {
          pass('QUALITY-03', '品质标签背景色已设置');
        } else {
          warn('QUALITY-03', '品质标签背景色未设置');
        }
      }

      // Check level badge border
      if (levelBadge) {
        const lbStyle = await levelBadge.getAttribute('style');
        if (lbStyle && lbStyle.includes('border')) {
          pass('QUALITY-04', '等级徽章品质边框已设置');
        } else {
          warn('QUALITY-04', '等级徽章品质边框未设置');
        }
      }

      // Check stat bars
      const statRows = await page.$$('.tk-hero-detail-stat-row');
      if (statRows.length > 0) {
        pass('STATS-01', `属性条数量: ${statRows.length}`);
        // Check first stat bar has fill
        const firstFill = await statRows[0].$('.tk-hero-detail-stat-fill');
        if (firstFill) {
          const fillStyle = await firstFill.getAttribute('style');
          pass('STATS-02', `属性条填充: ${fillStyle ? '有样式' : '无样式'}`);
        }
      } else {
        warn('STATS-01', '属性条(.tk-hero-detail-stat-row)未找到');
      }

      // Check skills
      const skillItems = await page.$$('.tk-hero-detail-skill-item');
      const skillEmpty = await page.$('.tk-hero-detail-skill-empty');
      if (skillItems.length > 0) {
        pass('SKILL-01', `技能数量: ${skillItems.length}`);
      } else if (skillEmpty) {
        pass('SKILL-01', '技能区域存在（暂无技能提示）');
      } else {
        warn('SKILL-01', '技能区域未找到');
      }

      // Check compare button
      const compareBtn = await page.$('.tk-hero-detail-compare-btn');
      if (compareBtn) pass('DETAIL-08', '对比按钮(.tk-hero-detail-compare-btn)存在');
      else warn('DETAIL-08', '对比按钮未找到');

      // Check star-up button
      const starUpBtns = await page.$$('.tk-hero-detail-compare-btn');
      let hasStarUp = false;
      for (const btn of starUpBtns) {
        const t = await btn.textContent();
        if (t && t.includes('升星')) { hasStarUp = true; break; }
      }
      if (hasStarUp) pass('DETAIL-09', '升星按钮存在');
      else warn('DETAIL-09', '升星按钮未找到');

      // Check experience bar
      const expSection = await page.$('.tk-hero-detail-exp-section');
      if (expSection) {
        pass('DETAIL-10', '经验条(.tk-hero-detail-exp-section)存在');
      } else {
        warn('DETAIL-10', '经验条未显示（可能已满级或无经验数据）');
      }

      await screenshot(page, '03-hero-detail');

      // Close detail modal
      await page.keyboard.press('Escape');
      await page.waitForTimeout(800);

    } else {
      fail('DETAIL-01', '武将详情弹窗(.tk-hero-detail-modal)未找到', 'P0');
    }

  } else {
    fail('CARD-01', '武将卡片不存在（即使招募后）', 'P0');
  }

  // ═══════════════════════════════════════════
  // Phase 4: 招募弹窗
  // ═══════════════════════════════════════════
  console.log('\n═══ Phase 4: 招募弹窗 ═══');

  await closeAllModals();
  await page.waitForTimeout(500);

  // Click recruit button
  const recruitBtnEl = await page.$('.tk-hero-recruit-btn');
  if (recruitBtnEl) {
    await recruitBtnEl.click();
    await page.waitForTimeout(1500);
    await dismissGuide();
    pass('RECRUIT-01', '招募按钮点击成功');
  } else {
    // Fallback: find by text
    const allBtns = await page.$$('button');
    let found = false;
    for (const btn of allBtns) {
      const text = await btn.textContent();
      if (text && text.includes('招募')) {
        await btn.click({ force: true });
        await page.waitForTimeout(1500);
        await dismissGuide();
        found = true;
        break;
      }
    }
    if (found) pass('RECRUIT-01', '招募按钮点击成功(文本匹配)');
    else fail('RECRUIT-01', '招募按钮未找到', 'P0');
  }

  const recruitOverlay = await page.$('.tk-recruit-overlay');
  if (recruitOverlay) {
    pass('RECRUIT-02', '招募弹窗(.tk-recruit-overlay)已打开');

    const recruitModal = await page.$('.tk-recruit-modal');
    if (recruitModal) {
      // Title
      const recruitTitle = await page.$('.tk-recruit-title');
      if (recruitTitle) {
        const titleText = await recruitTitle.textContent();
        pass('RECRUIT-03', `招募标题: ${titleText}`);
      } else {
        warn('RECRUIT-03', '招募标题未找到');
      }

      // Recruit type buttons
      const typeBtns = await page.$$('.tk-recruit-type-btn');
      if (typeBtns.length >= 2) {
        pass('RECRUIT-04', `招募类型按钮数量: ${typeBtns.length}`);
        for (let i = 0; i < typeBtns.length; i++) {
          const label = await typeBtns[i].$('.tk-recruit-type-label');
          if (label) {
            const labelText = await label.textContent();
            pass(`RECRUIT-04-${i}`, `招募类型: ${labelText}`);
          }
        }
      } else {
        fail('RECRUIT-04', `招募类型按钮数量不足: ${typeBtns.length}`, 'P1');
      }

      // ═══════════════════════════════════════
      // Phase 6: 保底进度
      // ═══════════════════════════════════════
      console.log('\n═══ Phase 6: 保底进度 ═══');

      const pitySection = await page.$('.tk-recruit-pity');
      if (pitySection) {
        pass('PITY-01', '保底区域(.tk-recruit-pity)存在');

        // Ten-pull pity
        const pityItems = await page.$$('.tk-recruit-pity-item');
        if (pityItems.length >= 2) {
          pass('PITY-02', `保底进度项数量: ${pityItems.length}`);

          // Check ten-pull pity
          const tenPityLabel = await pityItems[0].$('.tk-recruit-pity-label');
          if (tenPityLabel) {
            const labelText = await tenPityLabel.textContent();
            pass('PITY-03', `十连保底标签: ${labelText}`);
          }

          // Check hard pity
          const hardPityLabel = await pityItems[1].$('.tk-recruit-pity-label');
          if (hardPityLabel) {
            const labelText = await hardPityLabel.textContent();
            pass('PITY-04', `硬保底标签: ${labelText}`);
          }

          // Check pity bars
          const pityBars = await page.$$('.tk-recruit-pity-bar');
          if (pityBars.length >= 2) {
            pass('PITY-05', `保底进度条数量: ${pityBars.length}`);
          }

          // Check pity fill widths
          const pityFills = await page.$$('.tk-recruit-pity-fill');
          if (pityFills.length >= 2) {
            for (let i = 0; i < pityFills.length; i++) {
              const fillStyle = await pityFills[i].getAttribute('style');
              pass(`PITY-06-${i}`, `保底填充${i}: ${fillStyle}`);
            }
          }

          // Check pity counts
          const pityCounts = await page.$$('.tk-recruit-pity-count');
          if (pityCounts.length >= 2) {
            for (let i = 0; i < pityCounts.length; i++) {
              const countText = await pityCounts[i].textContent();
              pass(`PITY-07-${i}`, `保底计数${i}: ${countText}`);
            }
          }

        } else {
          fail('PITY-02', `保底进度项不足: ${pityItems.length}`, 'P1');
        }
      } else {
        fail('PITY-01', '保底区域(.tk-recruit-pity)未找到', 'P1');
      }

      // Single recruit button
      const singleBtns = await page.$$('.tk-recruit-btn');
      let singleRecruitBtn = null;
      let tenRecruitBtn = null;
      for (const btn of singleBtns) {
        const text = await btn.textContent();
        if (text && (text.includes('单次') || text.includes('单抽'))) singleRecruitBtn = btn;
        if (text && (text.includes('十连') || text.includes('10连'))) tenRecruitBtn = btn;
      }

      if (singleRecruitBtn) {
        pass('RECRUIT-05', '单次招募按钮存在');
      } else {
        fail('RECRUIT-05', '单次招募按钮未找到', 'P1');
      }

      if (tenRecruitBtn) {
        pass('RECRUIT-06', '十连招募按钮存在');
      } else {
        fail('RECRUIT-06', '十连招募按钮未找到', 'P1');
      }

      // Cost display
      const costEls = await page.$$('.tk-recruit-cost');
      if (costEls.length >= 1) {
        for (let i = 0; i < costEls.length; i++) {
          const costText = await costEls[i].textContent();
          pass(`RECRUIT-07-${i}`, `消耗显示: ${costText}`);
        }
      } else {
        fail('RECRUIT-07', '消耗显示未找到', 'P1');
      }

      // History section
      const historyToggle = await page.$('.tk-recruit-history-toggle');
      if (historyToggle) {
        pass('RECRUIT-08', '招募记录按钮(.tk-recruit-history-toggle)存在');
      } else {
        warn('RECRUIT-08', '招募记录按钮未找到');
      }

      await screenshot(page, '04-recruit-modal');

      // Try switching to advanced recruit
      const advBtn = await page.$('.tk-recruit-type-btn--active + .tk-recruit-type-btn, .tk-recruit-type-btn:last-child');
      if (advBtn) {
        // Find the non-active type button
        const allTypeBtns = await page.$$('.tk-recruit-type-btn');
        for (const btn of allTypeBtns) {
          const isActive = await btn.evaluate(el => el.classList.contains('tk-recruit-type-btn--active'));
          if (!isActive) {
            await btn.click();
            await page.waitForTimeout(800);
            pass('RECRUIT-09', '切换到高级招募');
            break;
          }
        }
        await screenshot(page, '05-recruit-advanced');
      }

      // Close recruit modal
      await page.keyboard.press('Escape');
      await page.waitForTimeout(800);

    } else {
      fail('RECRUIT-02', '招募弹窗(.tk-recruit-modal)内部未找到', 'P0');
    }
  } else {
    fail('RECRUIT-02', '招募弹窗(.tk-recruit-overlay)未打开', 'P0');
  }

  // ═══════════════════════════════════════════
  // Phase 10: Mobile view
  // ═══════════════════════════════════════════
  console.log('\n═══ Phase 10: 移动端适配 ═══');

  await closeAllModals();
  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForTimeout(2000);
  await dismissGuide();

  // Switch to hero tab on mobile
  const mobileHeroTab = await page.$('button:has-text("武将")');
  if (mobileHeroTab) {
    await mobileHeroTab.click();
    await page.waitForTimeout(1500);
    await dismissGuide();
  }
  await screenshot(page, '06-mobile-hero-tab');

  // Check hero cards on mobile
  const mobileCards = await page.$$('.tk-hero-card');
  pass('MOBILE-01', `移动端武将卡片: ${mobileCards.length}`);

  // Check recruit button on mobile
  const mobileRecruitBtn = await page.$('.tk-hero-recruit-btn');
  if (mobileRecruitBtn) pass('MOBILE-02', '移动端招募按钮存在');
  else warn('MOBILE-02', '移动端招募按钮未找到');

  // Open recruit on mobile
  if (mobileRecruitBtn) {
    await mobileRecruitBtn.click();
    await page.waitForTimeout(1500);
    await dismissGuide();
    await screenshot(page, '07-mobile-recruit');
    await closeAllModals();
    await page.waitForTimeout(500);
  }

  // Close recruit modal first
  const mobileCloseBtn = await page.$('.tk-recruit-close');
  if (mobileCloseBtn) {
    await mobileCloseBtn.click({ force: true });
  } else {
    await page.keyboard.press('Escape');
  }
  await page.waitForTimeout(800);

  // Remove any lingering overlays
  await page.evaluate(() => {
    document.querySelectorAll('.tk-recruit-overlay').forEach(el => el.remove());
  });
  await page.waitForTimeout(300);

  // Open detail on mobile
  if (mobileCards.length > 0) {
    await mobileCards[0].click({ force: true });
    await page.waitForTimeout(1500);
    await dismissGuide();
    await screenshot(page, '08-mobile-hero-detail');
    await closeAllModals();
    await page.waitForTimeout(500);
  }

  // ═══════════════════════════════════════════
  // Phase 11: Console errors & final checks
  // ═══════════════════════════════════════════
  console.log('\n═══ Phase 11: 最终检查 ═══');

  if (results.consoleErrors.length === 0) {
    pass('CONSOLE-01', '无控制台错误');
  } else {
    fail('CONSOLE-01', `${results.consoleErrors.length}个控制台错误`, 'P0');
    results.consoleErrors.forEach((e, i) => {
      console.log(`    E[${i}]: ${e.substring(0, 200)}`);
    });
  }

  // ═══════════════════════════════════════════
  // Summary
  // ═══════════════════════════════════════════
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  测试结果汇总                                ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`  ✅ 通过: ${results.passed.length}`);
  console.log(`  ❌ 失败: ${results.failed.length}`);
  console.log(`  ⚠️ 警告: ${results.warnings.length}`);
  console.log(`  📸 截图: ${results.screenshots.length}`);

  if (results.failed.length > 0) {
    console.log('\n  ❌ 失败详情:');
    results.failed.forEach(f => console.log(`    [${f.severity}] ${f.id}: ${f.desc}`));
  }

  if (results.warnings.length > 0) {
    console.log('\n  ⚠️ 警告详情:');
    results.warnings.forEach(w => console.log(`    ${w.id}: ${w.desc}`));
  }

  // Save results JSON
  const resultsPath = path.join(__dirname, '..', 'e2e-v2-evolution-results.json');
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  console.log(`\n  结果已保存: ${resultsPath}`);

  await browser.close();

  // Exit code
  const hasP0 = results.failed.some(f => f.severity === 'P0');
  if (hasP0) {
    console.log('\n🚨 存在P0级别问题，测试未通过！');
    process.exit(1);
  } else if (results.failed.length > 0) {
    console.log('\n⚠️ 存在失败项，但无P0阻断问题。');
    process.exit(0);
  } else {
    console.log('\n🎉 v2.0 招贤纳士 UI测试全部通过！');
    process.exit(0);
  }

})().catch(e => {
  console.error('测试执行失败:', e.message);
  process.exit(1);
});
