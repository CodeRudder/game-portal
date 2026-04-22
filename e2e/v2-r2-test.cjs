/**
 * v2.0 招贤纳士 — Round 2 UI测试
 * 测试内容: 武将Tab可见性、招募按钮、武将列表、编队面板、招募弹窗
 * 截图保存: e2e/screenshots/v2-r2/
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const GAME_PATH = '/idle/three-kingdoms';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots', 'v2-r2');

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const results = { passed: [], failed: [], warnings: [], screenshots: [] };
  const consoleErrors = [];

  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push('PAGEERROR: ' + err.message));

  // 辅助函数：关闭所有弹窗和引导
  async function dismissAllOverlays() {
    // 1. 关闭引导遮罩（Skip按钮）
    for (let i = 0; i < 5; i++) {
      const skipBtn = await page.$('.tk-guide-btn--skip');
      if (skipBtn) {
        await skipBtn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(300);
      } else break;
    }
    // 2. 移除引导DOM
    await page.evaluate(() => {
      document.querySelectorAll('.tk-guide-overlay, .tk-guide-backdrop, .tk-guide-tooltip').forEach(el => el.remove());
    });
    await page.waitForTimeout(200);
    // 3. Escape关闭弹窗
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    // 4. 关闭欢迎/离线弹窗
    await page.evaluate(() => {
      document.querySelectorAll('[class*="modal"][class*="visible"], [class*="welcome"][class*="visible"]').forEach(el => {
        el.click();
      });
    });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }

  async function screenshot(name) {
    const filepath = path.join(SCREENSHOT_DIR, `${name}.png`);
    await page.screenshot({ path: filepath, fullPage: false });
    results.screenshots.push(filepath);
    console.log(`  📸 ${name}.png`);
  }

  function assert(name, condition, detail) {
    if (condition) {
      results.passed.push({ name, detail: detail || 'OK' });
      console.log(`  ✅ ${name}`);
    } else {
      results.failed.push({ name, detail });
      console.log(`  ❌ ${name} — ${detail}`);
    }
  }

  function warn(name, detail) {
    results.warnings.push({ name, detail });
    console.log(`  ⚠️ ${name} — ${detail}`);
  }

  try {
    // ========== 1. 页面加载 ==========
    console.log('\n=== 1. 页面加载 ===');
    await page.goto(BASE_URL + GAME_PATH, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    await dismissAllOverlays();
    await page.waitForTimeout(500);
    
    await screenshot('01-page-loaded');
    assert('页面加载无白屏', 
      await page.evaluate(() => document.body.innerText.length > 50),
      '页面内容正常');

    // ========== 2. 武将Tab可见且可点击 ==========
    console.log('\n=== 2. 武将Tab ===');
    
    const heroTab = await page.$('.tk-tab-btn:has-text("武将")');
    assert('武将Tab可见', !!heroTab, '未找到武将Tab元素');
    
    if (heroTab) {
      await heroTab.click();
      await page.waitForTimeout(1000);
      await dismissAllOverlays();
      await page.waitForTimeout(500);
      
      const activeTab = await page.evaluate(() => {
        const el = document.querySelector('.tk-tab-btn--active');
        return el ? el.textContent?.trim() : '';
      });
      assert('武将Tab可点击并激活', activeTab.includes('武将'), `当前活跃Tab: ${activeTab}`);
    }
    await screenshot('02-hero-tab');

    // ========== 3. 招募按钮存在 ==========
    console.log('\n=== 3. 招募按钮 ===');
    
    const recruitBtn = await page.$('.tk-hero-recruit-btn');
    assert('招募按钮存在', !!recruitBtn, '未找到.tk-hero-recruit-btn');
    
    if (recruitBtn) {
      const recruitText = await recruitBtn.textContent();
      console.log(`  招募按钮文本: "${recruitText?.trim()}"`);
    }

    // ========== 4. 招募弹窗可打开 ==========
    console.log('\n=== 4. 招募弹窗 ===');
    
    if (recruitBtn) {
      await recruitBtn.click({ force: true });
      await page.waitForTimeout(1000);
      
      const recruitModalVisible = await page.evaluate(() => {
        const modals = document.querySelectorAll('[class*="recruit"], [class*="Recruit"]');
        for (const m of modals) {
          const rect = m.getBoundingClientRect();
          if (rect.width > 100 && rect.height > 100) return true;
        }
        return false;
      });
      
      assert('招募弹窗可打开', recruitModalVisible, '招募弹窗未显示');
      await screenshot('03-recruit-modal');
      
      if (recruitModalVisible) {
        // 检查双池切换
        const poolTabs = await page.evaluate(() => {
          const tabs = document.querySelectorAll('[class*="pool"], [class*="Pool"]');
          return tabs.length;
        });
        warn('双池切换', poolTabs > 0 ? `发现${poolTabs}个池子相关元素` : '未找到池子切换元素');
        
        // 检查单抽/十连按钮
        const pullBtns = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          return btns.filter(b => {
            const t = b.textContent || '';
            return t.includes('单抽') || t.includes('十连');
          }).length;
        });
        warn('单抽/十连按钮', pullBtns > 0 ? `发现${pullBtns}个抽取按钮` : '未找到单抽/十连按钮');
      }
      
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    // ========== 5. 武将列表渲染 ==========
    console.log('\n=== 5. 武将列表 ===');
    
    const heroCardCount = await page.evaluate(() => {
      return document.querySelectorAll('[class*="hero-card"], [class*="HeroCard"]').length;
    });
    
    if (heroCardCount > 0) {
      assert('武将列表渲染', true, `发现 ${heroCardCount} 个武将卡片`);
    } else {
      // 检查空状态
      const emptyVisible = await page.evaluate(() => {
        const empty = document.querySelector('.tk-hero-empty');
        return empty ? empty.getBoundingClientRect().height > 0 : false;
      });
      if (emptyVisible) {
        warn('武将列表为空', '显示空状态引导（正常：需先招募）');
        assert('空状态引导可见', true, '显示"前往招募"引导');
      } else {
        assert('武将列表渲染', false, '未找到武将卡片或空状态');
      }
    }
    
    // 检查筛选功能
    const filterBtns = await page.evaluate(() => {
      return document.querySelectorAll('.tk-hero-filter-btn').length;
    });
    assert('阵营筛选按钮存在', filterBtns >= 4, `发现${filterBtns}个筛选按钮（蜀魏吴群+全部）`);
    
    // 检查排序下拉
    const sortSelect = await page.$('.tk-hero-select');
    assert('排序下拉框存在', !!sortSelect, '未找到排序选择器');
    
    await screenshot('04-hero-list');

    // ========== 6. 编队面板 ==========
    console.log('\n=== 6. 编队面板 ===');
    
    const formationTab = await page.$('.tk-hero-sub-tab:has-text("编队")');
    assert('编队子Tab存在', !!formationTab, '未找到编队子Tab');
    
    if (formationTab) {
      await formationTab.click({ force: true });
      await page.waitForTimeout(800);
      
      const formationPanelVisible = await page.evaluate(() => {
        const panels = document.querySelectorAll('[class*="formation"], [class*="Formation"]');
        for (const p of panels) {
          const rect = p.getBoundingClientRect();
          if (rect.width > 100 && rect.height > 100) return true;
        }
        return false;
      });
      
      assert('编队面板可见', formationPanelVisible, '编队面板未显示');
      await screenshot('05-formation-panel');
      
      // 检查编队槽位
      const slots = await page.evaluate(() => {
        const slotEls = document.querySelectorAll('[class*="slot"], [class*="Slot"]');
        let visibleSlots = 0;
        slotEls.forEach(s => {
          const r = s.getBoundingClientRect();
          if (r.width > 20 && r.height > 20) visibleSlots++;
        });
        return visibleSlots;
      });
      warn('编队槽位', slots > 0 ? `发现${slots}个可见槽位` : '未找到编队槽位');
      
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    // ========== 7. 总战力显示 ==========
    console.log('\n=== 7. 总战力 ===');
    
    const totalPower = await page.evaluate(() => {
      const el = document.querySelector('.tk-hero-total-power');
      return el ? el.textContent?.trim() : null;
    });
    assert('总战力显示', !!totalPower, totalPower || '未找到总战力');

    // ========== 8. 控制台错误检查 ==========
    console.log('\n=== 8. 控制台错误 ===');
    
    const filteredErrors = consoleErrors.filter(e => 
      !e.includes('favicon') && 
      !e.includes('manifest') &&
      !e.includes('404')
    );
    
    assert('无控制台错误', filteredErrors.length === 0, 
      filteredErrors.length > 0 ? `${filteredErrors.length}个错误: ${filteredErrors[0]?.substring(0, 80)}` : '无错误');

    await screenshot('07-final-state');

  } catch (error) {
    results.failed.push({ name: '测试执行异常', detail: error.message });
    console.log(`\n💥 测试异常: ${error.message}`);
    try { await screenshot('error-final'); } catch(e) {}
  } finally {
    await browser.close();
  }

  // ========== 输出结果 ==========
  console.log('\n' + '='.repeat(60));
  console.log('v2.0 招贤纳士 — Round 2 UI测试结果');
  console.log('='.repeat(60));
  console.log(`✅ 通过: ${results.passed.length}`);
  console.log(`❌ 失败: ${results.failed.length}`);
  console.log(`⚠️ 警告: ${results.warnings.length}`);
  console.log(`📸 截图: ${results.screenshots.length}`);
  
  if (results.passed.length > 0) {
    console.log('\n通过项:');
    results.passed.forEach(r => console.log(`  ✅ ${r.name} — ${r.detail}`));
  }
  if (results.failed.length > 0) {
    console.log('\n失败项:');
    results.failed.forEach(r => console.log(`  ❌ ${r.name} — ${r.detail}`));
  }
  if (results.warnings.length > 0) {
    console.log('\n警告项:');
    results.warnings.forEach(r => console.log(`  ⚠️ ${r.name} — ${r.detail}`));
  }

  const resultPath = path.join(__dirname, 'e2e-v2-r2-results.json');
  fs.writeFileSync(resultPath, JSON.stringify(results, null, 2));
  console.log(`\n结果已保存: ${resultPath}`);

  process.exit(results.failed.length > 0 ? 1 : 0);
})();
