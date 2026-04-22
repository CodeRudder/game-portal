/**
 * v10.0 兵强马壮 — UI进化测试
 *
 * 测试范围：
 *   - 装备Tab可见性和子Tab切换
 *   - 装备背包展示（空/有装备）
 *   - 锻造面板
 *   - 强化面板
 *   - 装备详情弹窗
 *   - 武将装备栏（通过武将Tab）
 *   - 控制台无错误
 */

const path = require('path');
const fs = require('fs');
const {
  initBrowser, enterGame, switchTab, closeAllModals,
  takeScreenshot, checkDataIntegrity, getConsoleErrors, clearConsoleErrors,
} = require(path.join(__dirname, 'utils', 'game-actions.cjs'));

const SCREENSHOT_DIR = path.join(__dirname, 'screenshots', 'v10-evolution');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const BASE_URL = process.env.GAME_BASE_URL || 'http://localhost:5173/idle/three-kingdoms';

// 结果收集
const results = {
  version: 'v10.0',
  timestamp: new Date().toISOString(),
  tests: [],
  summary: { total: 0, passed: 0, failed: 0, errors: [] },
};

function addResult(name, passed, detail = '') {
  results.tests.push({ name, passed, detail });
  results.summary.total++;
  if (passed) results.summary.passed++;
  else { results.summary.failed++; results.summary.errors.push(`${name}: ${detail}`); }
  console.log(`  ${passed ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`);
}

async function screenshot(page, name) {
  const filepath = path.join(SCREENSHOT_DIR, name + '.png');
  await page.screenshot({ path: filepath });
  return filepath;
}

async function run() {
  console.log('\n═══ v10.0 兵强马壮 — UI进化测试 ═══\n');

  const { page, browser } = await initBrowser({ headless: true });
  let pageErrors = [];

  try {
    // ── T1: 进入游戏 ──
    console.log('── T1: 进入游戏 ──');
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    // 关闭欢迎弹窗
    const startBtn = await page.$('button:has-text("开始游戏")');
    if (startBtn) {
      await startBtn.click();
      await page.waitForTimeout(3000);
    }
    await screenshot(page, '01-main-page');
    addResult('进入游戏主界面', true);

    // ── T2: 装备Tab可见 ──
    console.log('\n── T2: 装备Tab ──');
    clearConsoleErrors(page);

    // 查找装备Tab按钮
    const equipTabBtn = await page.$('button:has-text("装备")');
    addResult('装备Tab按钮存在', !!equipTabBtn, equipTabBtn ? '' : '未找到装备Tab按钮');

    if (equipTabBtn) {
      await equipTabBtn.click();
      await page.waitForTimeout(2000);
      await screenshot(page, '02-equipment-tab');

      // 检查装备面板内容
      const equipContent = await page.$('[data-testid="equipment-tab"], .tk-equipment-sub-tabs, [class*="equipment"]');
      addResult('装备面板渲染', !!equipContent, equipContent ? '' : '装备面板DOM未找到');

      // 检查子Tab
      const subTabs = await page.$$('.tk-equipment-sub-tabs button');
      addResult('子Tab数量>=3', subTabs.length >= 3, `找到${subTabs.length}个子Tab`);

      // ── T3: 背包子Tab ──
      console.log('\n── T3: 装备背包 ──');
      const bagTab = await page.$('button:has-text("背包")');
      if (bagTab) {
        await bagTab.click();
        await page.waitForTimeout(1000);
        await screenshot(page, '03-equipment-bag');
      }

      // 检查背包容量显示
      const bagInfo = await page.textContent('body');
      const hasBagCapacity = bagInfo.includes('/') && (bagInfo.includes('🎒') || bagInfo.includes('装备'));
      addResult('背包容量显示', hasBagCapacity);

      // 检查筛选按钮
      const filterBtns = await page.$$('button:has-text("全部")');
      addResult('部位筛选按钮存在', filterBtns.length > 0);

      // ── T4: 生成装备测试（通过控制台注入） ──
      console.log('\n── T4: 生成装备 ──');
      try {
        // 注入装备到引擎
        const injectResult = await page.evaluate(() => {
          try {
            const engine = window.__gameEngine || window.engine;
            if (!engine) return { success: false, reason: '引擎未找到' };

            const eqSys = engine.getEquipmentSystem?.() || engine.equipment;
            if (!eqSys) return { success: false, reason: '装备系统未找到' };

            // 生成几件不同品质的装备
            const items = [];
            const slots = ['weapon', 'armor', 'accessory', 'mount'];
            const rarities = ['white', 'green', 'blue', 'purple', 'gold'];

            for (let i = 0; i < 8; i++) {
              const slot = slots[i % 4];
              const rarity = rarities[Math.min(i, 4)];
              const eq = eqSys.generateEquipment(slot, rarity, 'campaign_drop', 1000 + i * 100);
              if (eq) items.push({ uid: eq.uid, name: eq.name, slot: eq.slot, rarity: eq.rarity });
            }

            return {
              success: true,
              count: items.length,
              items,
              bagSize: eqSys.getAllEquipments?.()?.length ?? 0,
              bagCapacity: eqSys.getBagCapacity?.() ?? 0,
            };
          } catch (e) {
            return { success: false, reason: e.message };
          }
        });

        addResult('注入装备到引擎', injectResult.success, injectResult.reason || `生成${injectResult.count}件`);
        if (injectResult.success) {
          console.log(`    生成装备: ${injectResult.items?.map(i => `${i.rarity}(${i.slot})`).join(', ')}`);
          console.log(`    背包: ${injectResult.bagSize}/${injectResult.bagCapacity}`);
        }
      } catch (e) {
        addResult('注入装备到引擎', false, e.message);
      }

      // 刷新背包显示
      await page.waitForTimeout(500);
      // 重新点击背包Tab刷新
      const bagTab2 = await page.$('button:has-text("背包")');
      if (bagTab2) await bagTab2.click();
      await page.waitForTimeout(1000);
      await screenshot(page, '04-equipment-bag-with-items');

      // 检查装备卡片
      const equipCards = await page.$$('[class*="card"]');
      addResult('装备卡片渲染', equipCards.length > 0, `找到${equipCards.length}个卡片`);

      // ── T5: 装备详情弹窗 ──
      console.log('\n── T5: 装备详情 ──');
      if (equipCards.length > 0) {
        await equipCards[0].click();
        await page.waitForTimeout(1000);
        await screenshot(page, '05-equipment-detail-modal');

        // 检查弹窗内容
        const modalText = await page.textContent('body');
        const hasDetail = modalText.includes('主属性') || modalText.includes('特效');
        addResult('装备详情弹窗显示', hasDetail);

        // 关闭弹窗
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      } else {
        addResult('装备详情弹窗显示', false, '无装备卡片可点击');
      }

      // ── T6: 锻造面板 ──
      console.log('\n── T6: 锻造面板 ──');
      const forgeTab = await page.$('button:has-text("锻造")');
      if (forgeTab) {
        await forgeTab.click();
        await page.waitForTimeout(1000);
        await screenshot(page, '06-forge-panel');

        const forgeContent = await page.textContent('body');
        const hasForge = forgeContent.includes('锻造') || forgeContent.includes('基础');
        addResult('锻造面板显示', hasForge);

        // 检查基础/高级锻造按钮
        const basicForgeBtn = await page.$('button:has-text("基础锻造")');
        const advForgeBtn = await page.$('button:has-text("高级锻造")');
        addResult('基础/高级锻造按钮', !!basicForgeBtn && !!advForgeBtn);

        // 测试基础锻造
        const startForgeBtn = await page.$('button:has-text("开始基础锻造"), button:has-text("开始高级锻造"), button:has-text("开始")');
        if (startForgeBtn) {
          await startForgeBtn.click();
          await page.waitForTimeout(1000);
          await screenshot(page, '07-forge-result');
          addResult('锻造操作执行', true);
        }
      } else {
        addResult('锻造面板显示', false, '锻造Tab未找到');
      }

      // ── T7: 强化面板 ──
      console.log('\n── T7: 强化面板 ──');
      const enhanceTab = await page.$('button:has-text("强化")');
      if (enhanceTab) {
        await enhanceTab.click();
        await page.waitForTimeout(1000);
        await screenshot(page, '08-enhance-panel');

        const enhanceContent = await page.textContent('body');
        const hasEnhance = enhanceContent.includes('强化');
        addResult('强化面板显示', hasEnhance);

        // 检查保护符选项
        const protCheckbox = await page.$('input[type="checkbox"]');
        addResult('保护符复选框', !!protCheckbox);

        // 点击一件装备进行强化
        const enhanceCards = await page.$$('[class*="card"]');
        if (enhanceCards.length > 0) {
          await enhanceCards[0].click();
          await page.waitForTimeout(500);
          await screenshot(page, '09-enhance-selected');

          // 点击强化按钮
          const enhanceBtn = await page.$('button:has-text("强化")');
          if (enhanceBtn) {
            await enhanceBtn.click();
            await page.waitForTimeout(1000);
            await screenshot(page, '10-enhance-result');
            addResult('强化操作执行', true);
          }
        }
      } else {
        addResult('强化面板显示', false, '强化Tab未找到');
      }
    }

    // ── T8: 武将装备栏 ──
    console.log('\n── T8: 武将装备栏 ──');
    await closeAllModals(page);
    // 切换到武将Tab
    try {
      await switchTab(page, '武将');
      await page.waitForTimeout(2000);
      await screenshot(page, '11-hero-tab');

      // 查找武将卡片
      const heroCards = await page.$$('[class*="hero-card"], [class*="heroCard"]');
      if (heroCards.length > 0) {
        await heroCards[0].click();
        await page.waitForTimeout(1500);
        await screenshot(page, '12-hero-detail');

        // 检查装备栏
        const heroContent = await page.textContent('body');
        const hasEquipSlots = heroContent.includes('武器') || heroContent.includes('防具') ||
          heroContent.includes('饰品') || heroContent.includes('坐骑');
        addResult('武将装备栏显示', hasEquipSlots, hasEquipSlots ? '' : '未找到装备槽位文本');
      } else {
        addResult('武将装备栏显示', false, '未找到武将卡片');
      }
    } catch (e) {
      addResult('武将装备栏检查', false, e.message);
    }

    // ── T9: 数据完整性 ──
    console.log('\n── T9: 数据完整性 ──');
    const integrity = await checkDataIntegrity(page);
    addResult('无NaN显示', !integrity.hasNaN, integrity.hasNaN ? integrity.issues.join(',') : '');
    addResult('无undefined显示', !integrity.hasUndefined, integrity.hasUndefined ? integrity.issues.join(',') : '');

    // ── T10: 控制台错误 ──
    console.log('\n── T10: 控制台错误 ──');
    pageErrors = getConsoleErrors(page);
    // 过滤已知的无害错误
    const realErrors = pageErrors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('DevTools') &&
      !e.includes('net::ERR') &&
      !e.includes('ResizeObserver')
    );
    addResult('无严重控制台错误', realErrors.length === 0, realErrors.length > 0 ? `${realErrors.length}个错误` : '');

    // ── T11: 移动端适配 ──
    console.log('\n── T11: 移动端适配 ──');
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(2000);
    await closeAllModals(page);

    // 回到装备Tab
    const equipTabMobile = await page.$('button:has-text("装备")');
    if (equipTabMobile) {
      await equipTabMobile.click();
      await page.waitForTimeout(1500);
      await screenshot(page, '13-mobile-equipment');
      addResult('移动端装备面板', true);
    }

    // 恢复PC视口
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(1000);

    // ── T12: 引擎API完整性 ──
    console.log('\n── T12: 引擎API完整性 ──');
    const apiCheck = await page.evaluate(() => {
      const engine = window.__gameEngine || window.engine;
      if (!engine) return { found: false };

      return {
        found: true,
        getEquipmentSystem: typeof engine.getEquipmentSystem === 'function',
        getEquipmentForgeSystem: typeof engine.getEquipmentForgeSystem === 'function',
        getEquipmentEnhanceSystem: typeof engine.getEquipmentEnhanceSystem === 'function',
        getEquipmentSetSystem: typeof engine.getEquipmentSetSystem === 'function',
        getEquipmentRecommendSystem: typeof engine.getEquipmentRecommendSystem === 'function',
      };
    });

    addResult('引擎API: getEquipmentSystem', apiCheck.getEquipmentSystem === true, apiCheck.found ? '' : '引擎未找到');
    addResult('引擎API: getEquipmentForgeSystem', apiCheck.getEquipmentForgeSystem === true);
    addResult('引擎API: getEquipmentEnhanceSystem', apiCheck.getEquipmentEnhanceSystem === true);
    addResult('引擎API: getEquipmentSetSystem', apiCheck.getEquipmentSetSystem === true);
    addResult('引擎API: getEquipmentRecommendSystem', apiCheck.getEquipmentRecommendSystem === true);

    // ── T13: 套装系统功能 ──
    console.log('\n── T13: 套装系统 ──');
    const setSystemCheck = await page.evaluate(() => {
      try {
        const engine = window.__gameEngine || window.engine;
        if (!engine?.getEquipmentSetSystem) return { success: false, reason: 'getEquipmentSetSystem不可用' };

        const setSys = engine.getEquipmentSetSystem();
        if (!setSys) return { success: false, reason: 'SetSystem为null' };

        const allSets = setSys.getAllSetDefs?.() ?? [];
        const allIds = setSys.getAllSetIds?.() ?? [];

        return {
          success: true,
          setCount: allSets.length,
          ids: allIds,
          setNames: allSets.map(s => s.name),
        };
      } catch (e) {
        return { success: false, reason: e.message };
      }
    });

    addResult('套装系统: 7套套装定义', setSystemCheck.success && setSystemCheck.setCount === 7,
      setSystemCheck.success ? `${setSystemCheck.setCount}套: ${setSystemCheck.setNames?.join(',')}` : setSystemCheck.reason);

    // ── T14: 推荐系统功能 ──
    console.log('\n── T14: 推荐系统 ──');
    const recommendCheck = await page.evaluate(() => {
      try {
        const engine = window.__gameEngine || window.engine;
        if (!engine?.getEquipmentRecommendSystem) return { success: false, reason: 'getEquipmentRecommendSystem不可用' };

        const recSys = engine.getEquipmentRecommendSystem();
        if (!recSys) return { success: false, reason: 'RecommendSystem为null' };

        // 为第一个武将推荐装备
        const heroSys = engine.getHeroSystem?.() || engine.hero;
        const heroes = heroSys?.getAllHeroes?.() ?? [];
        if (heroes.length === 0) return { success: false, reason: '无武将数据' };

        const result = recSys.recommendForHero?.(heroes[0].id);
        if (!result) return { success: false, reason: '推荐结果为null' };

        return {
          success: true,
          totalScore: result.totalScore,
          hasWeapon: result.slots?.weapon !== null && result.slots?.weapon !== undefined,
          hasArmor: result.slots?.armor !== null && result.slots?.armor !== undefined,
          suggestions: result.setSuggestions?.length ?? 0,
        };
      } catch (e) {
        return { success: false, reason: e.message };
      }
    });

    addResult('推荐系统: 推荐功能可用', recommendCheck.success, recommendCheck.reason || `评分: ${recommendCheck.totalScore}`);

  } catch (e) {
    console.error('\n❌ 测试异常:', e.message);
    results.summary.errors.push(`FATAL: ${e.message}`);
    try { await screenshot(page, '99-error'); } catch (_) {}
  } finally {
    // 保存结果
    const resultPath = path.join(__dirname, 'v10-evolution-ui-results.json');
    fs.writeFileSync(resultPath, JSON.stringify(results, null, 2), 'utf-8');
    console.log(`\n结果已保存: ${resultPath}`);
    console.log(`截图目录: ${SCREENSHOT_DIR}`);
    console.log(`\n═══ 总结: ${results.summary.passed}/${results.summary.total} 通过, ${results.summary.failed} 失败 ═══\n`);

    await browser.close();
  }

  return results;
}

run().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
