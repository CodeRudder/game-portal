/**
 * 三国霸业 — 全子系统冒烟测试
 *
 * 验证范围：
 * 1. 首页加载检测（无白屏、无致命错误）
 * 2. 7个一级Tab切换（建筑/天下/出征/武将/科技/声望/更多）
 * 3. "更多▼"菜单中的16个功能面板
 * 4. 全程Console错误捕获（特别关注ReferenceError）
 * 5. 声望面板专项验证
 */

import { test, expect, type Page, type ConsoleMessage } from '@playwright/test';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────
const BASE_URL = 'http://localhost:4173';
const GAME_ROUTE = '/idle/three-kingdoms';

/** 7个一级Tab — 与 TabBar.tsx TABS 配置对齐 */
const PRIMARY_TABS = [
  { id: 'map',       label: '天下',   icon: '🗺️' },
  { id: 'campaign',  label: '出征',   icon: '⚔️' },
  { id: 'hero',      label: '武将',   icon: '🦸' },
  { id: 'tech',      label: '科技',   icon: '📜' },
  { id: 'building',  label: '建筑',   icon: '🏰' },
  { id: 'prestige',  label: '声望',   icon: '👑' },
  { id: 'more',      label: '更多▼', icon: '📋' },
] as const;

/** "更多▼"菜单中的16个功能面板 — 与 TabBar.tsx FEATURE_ITEMS 对齐 */
const FEATURE_PANELS = [
  { id: 'quest',       label: '任务' },
  { id: 'activity',    label: '活动' },
  { id: 'mail',        label: '邮件' },
  { id: 'shop',        label: '商店' },
  { id: 'social',      label: '好友' },
  { id: 'alliance',    label: '公会' },
  { id: 'achievement', label: '排行榜' },
  { id: 'expedition',  label: '远征' },
  { id: 'equipment',   label: '装备' },
  { id: 'npc',         label: '名士' },
  { id: 'arena',       label: '竞技' },
  { id: 'army',        label: '军队' },
  { id: 'events',      label: '事件' },
  { id: 'heritage',    label: '传承' },
  { id: 'trade',       label: '交易' },
  { id: 'settings',    label: '设置' },
] as const;

// ─────────────────────────────────────────────
// 辅助：Console 错误收集器
// ─────────────────────────────────────────────
class ConsoleErrorCollector {
  private errors: Array<{ type: string; text: string; location?: string }> = [];

  attach(page: Page) {
    page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() === 'error') {
        this.errors.push({
          type: 'console.error',
          text: msg.text(),
          location: msg.location()?.url,
        });
      }
    });
    page.on('pageerror', (err: Error) => {
      this.errors.push({
        type: 'pageerror',
        text: `${err.name}: ${err.message}\n${err.stack?.slice(0, 300) ?? ''}`,
      });
    });
  }

  getErrors() {
    return this.errors;
  }

  getReferenceErrors() {
    return this.errors.filter(
      (e) => e.text.includes('ReferenceError') || e.text.includes('is not defined')
    );
  }

  clear() {
    this.errors = [];
  }

  /** 报告当前错误，返回是否有ReferenceError */
  report(section: string): boolean {
    const errors = this.getErrors();
    const refErrors = this.getReferenceErrors();
    if (errors.length > 0) {
      console.log(`  ⚠️ [${section}] ${errors.length} 个错误:`);
      errors.forEach((e, i) => {
        const prefix = e.text.includes('ReferenceError') ? '🔴 REF' : '🟡 ERR';
        console.log(`    ${prefix} #${i + 1}: ${e.text.slice(0, 150)}`);
      });
    }
    return refErrors.length > 0;
  }
}

// ─────────────────────────────────────────────
// 辅助：导航到游戏页面（只加载一次）
// ─────────────────────────────────────────────
async function navigateToGame(page: Page, collector: ConsoleErrorCollector) {
  // 先访问根路径设置 localStorage
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('tk-has-visited', 'true');
  });

  // 导航到游戏页面
  await page.goto(`${BASE_URL}${GAME_ROUTE}`, { waitUntil: 'networkidle', timeout: 30_000 });

  // 关闭可能的 WelcomeModal
  const confirmBtn = page.locator('button:has-text("开始游戏")');
  if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await confirmBtn.click();
    await page.waitForTimeout(300);
  }

  // 等待引擎初始化
  await page.waitForTimeout(1500);

  // 验证页面已加载
  const tabBar = page.locator('[data-testid="tab-bar"]');
  await expect(tabBar, 'TabBar应可见').toBeVisible({ timeout: 10_000 });
}

// ─────────────────────────────────────────────
// 测试套件
// ─────────────────────────────────────────────
test.describe('三国霸业 — 全子系统冒烟测试', () => {

  test.setTimeout(180_000);

  // ─────────────────────────────────────────
  // 1) 首页加载检测
  // ─────────────────────────────────────────
  test('1-首页加载检测：页面正常渲染无白屏', async ({ page }) => {
    const collector = new ConsoleErrorCollector();
    collector.attach(page);

    await navigateToGame(page, collector);

    // 检查 #root 有内容
    const rootContent = await page.locator('#root').innerHTML();
    expect(rootContent.length, '#root 应有内容，不能是空白页面').toBeGreaterThan(100);

    // 检查 SceneRouter 存在
    const sceneRouter = page.locator('[data-testid="tk-scene-router"]');
    await expect(sceneRouter, '场景路由区域应存在').toBeVisible({ timeout: 5_000 });

    // 检查默认Tab是 building
    const buildingTab = page.locator('[data-testid="tab-bar-building"]');
    await expect(buildingTab, '默认应选中建筑Tab').toHaveAttribute('aria-selected', 'true');

    // 检查无 ReferenceError
    const hasRef = collector.report('首页加载');
    expect(hasRef, '首页不应有ReferenceError').toBe(false);

    await page.screenshot({ path: 'e2e/screenshots/01-homepage-loaded.png', fullPage: false });
    console.log('✅ 首页加载检测通过');
  });

  // ─────────────────────────────────────────
  // 2) 一级Tab切换测试 — 单次加载，顺序切换
  // ─────────────────────────────────────────
  test('2-一级Tab切换：7个Tab全部可点击并渲染内容', async ({ page }) => {
    const collector = new ConsoleErrorCollector();
    collector.attach(page);

    await navigateToGame(page, collector);

    const results: Array<{ tab: string; passed: boolean; contentLen: number; hasRef: boolean }> = [];

    for (const tab of PRIMARY_TABS) {
      collector.clear();

      // 点击目标Tab
      const tabBtn = page.locator(`[data-testid="tab-bar-${tab.id}"]`);
      await expect(tabBtn, `Tab [${tab.label}] 应可见`).toBeVisible({ timeout: 3_000 });
      await tabBtn.click();
      await page.waitForTimeout(800);

      // 验证选中状态
      const isSelected = await tabBtn.getAttribute('aria-selected');
      expect(isSelected, `[${tab.label}] 应处于选中状态`).toBe('true');

      // 验证内容不为空
      const sceneRouter = page.locator('[data-testid="tk-scene-router"]');
      const content = await sceneRouter.innerHTML();
      expect(content.length, `[${tab.label}] 内容区域不应为空`).toBeGreaterThan(10);

      // 检查错误
      const hasRef = collector.report(`Tab-${tab.label}`);

      results.push({
        tab: tab.label,
        passed: content.length > 10 && !hasRef,
        contentLen: content.length,
        hasRef,
      });

      // 截图
      await page.screenshot({ path: `e2e/screenshots/02-tab-${tab.id}.png`, fullPage: false });
    }

    // 汇总
    console.log('\n📊 一级Tab切换汇总:');
    for (const r of results) {
      const status = r.hasRef ? '🔴' : r.passed ? '✅' : '⚠️';
      console.log(`  ${status} ${r.tab}: 内容长度=${r.contentLen}, ReferenceError=${r.hasRef}`);
    }

    const failedTabs = results.filter(r => r.hasRef);
    expect(failedTabs.length, '不应有任何Tab产生ReferenceError').toBe(0);
    console.log('✅ 7个一级Tab切换测试全部通过');
  });

  // ─────────────────────────────────────────
  // 3) 功能面板测试 — 通过 MoreTab 打开
  // ─────────────────────────────────────────
  test('3-功能面板：MoreTab中11个面板可打开', async ({ page }) => {
    const collector = new ConsoleErrorCollector();
    collector.attach(page);

    await navigateToGame(page, collector);

    // 切换到"更多"Tab
    await page.locator('[data-testid="tab-bar-more"]').click();
    await page.waitForTimeout(500);

    // MoreTab中的面板（与 MoreTab.tsx MORE_ITEMS 对齐）
    const moreTabPanels = [
      { id: 'quest', label: '任务' },
      { id: 'shop', label: '商店' },
      { id: 'mail', label: '邮件' },
      { id: 'achievement', label: '成就' },
      { id: 'activity', label: '活动' },
      { id: 'alliance', label: '联盟' },
      { id: 'prestige', label: '声望' },
      { id: 'heritage', label: '传承' },
      { id: 'social', label: '社交' },
      { id: 'trade', label: '商贸' },
      { id: 'settings', label: '设置' },
    ];

    const results: Array<{ panel: string; opened: boolean; contentLen: number; hasRef: boolean }> = [];

    for (const panel of moreTabPanels) {
      collector.clear();

      const card = page.locator(`.tk-more-card:has-text("${panel.label}")`).first();
      const cardVisible = await card.isVisible({ timeout: 2000 }).catch(() => false);

      if (!cardVisible) {
        console.log(`  ⚠️ ${panel.label}: 卡片不可见`);
        results.push({ panel: panel.label, opened: false, contentLen: 0, hasRef: false });
        continue;
      }

      await card.click();
      await page.waitForTimeout(1000);

      // 检查面板内容
      const overlay = page.locator('[data-testid="feature-panel-overlay"]');
      const panelHTML = await overlay.innerHTML();
      const hasRealContent = panelHTML.length > 50;

      const hasRef = collector.report(`Panel-${panel.label}`);
      results.push({
        panel: panel.label,
        opened: hasRealContent,
        contentLen: panelHTML.length,
        hasRef,
      });

      // 关闭面板
      const closeBtn = page.locator('.shared-panel-close, .tk-feature-header button, button:has-text("✕")').first();
      if (await closeBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await closeBtn.click();
      } else {
        await page.keyboard.press('Escape');
      }
      await page.waitForTimeout(300);

      await page.screenshot({ path: `e2e/screenshots/03-panel-${panel.id}.png`, fullPage: false });
    }

    // 汇总
    console.log('\n📊 MoreTab面板测试汇总:');
    for (const r of results) {
      const status = r.hasRef ? '🔴' : r.opened ? '✅' : '⚠️';
      console.log(`  ${status} ${r.panel}: 打开=${r.opened}, 内容=${r.contentLen}, RefErr=${r.hasRef}`);
    }

    const refErrors = results.filter(r => r.hasRef);
    expect(refErrors.length, '不应有任何面板产生ReferenceError').toBe(0);
    console.log('✅ MoreTab面板测试完成');
  });

  // ─────────────────────────────────────────
  // 3b) 功能面板测试 — 通过 FeatureMenu 打开
  // ─────────────────────────────────────────
  test('3b-功能面板：FeatureMenu中5个扩展面板可打开', async ({ page }) => {
    const collector = new ConsoleErrorCollector();
    collector.attach(page);

    await navigateToGame(page, collector);

    // FeatureMenu中的面板（不在MoreTab中的）
    const featureMenuPanels = [
      { id: 'expedition', label: '远征' },
      { id: 'equipment', label: '装备' },
      { id: 'npc', label: '名士' },
      { id: 'arena', label: '竞技' },
      { id: 'army', label: '军队' },
    ];

    const results: Array<{ panel: string; opened: boolean; contentLen: number; hasRef: boolean }> = [];

    for (const panel of featureMenuPanels) {
      collector.clear();

      // 确保在building tab
      await page.locator('[data-testid="tab-bar-building"]').click();
      await page.waitForTimeout(300);

      // 打开FeatureMenu
      const menuTrigger = page.locator('[data-testid="feature-menu-trigger"]');
      const menuVisible = await menuTrigger.isVisible({ timeout: 2000 }).catch(() => false);

      if (!menuVisible) {
        console.log(`  ⚠️ ${panel.label}: FeatureMenu不可见`);
        results.push({ panel: panel.label, opened: false, contentLen: 0, hasRef: false });
        continue;
      }

      await menuTrigger.click();
      await page.waitForTimeout(500);

      const menuItem = page.locator(`[data-testid="feature-menu-item-${panel.id}"]`);
      const itemVisible = await menuItem.isVisible({ timeout: 2000 }).catch(() => false);

      if (!itemVisible) {
        console.log(`  ⚠️ ${panel.label}: 菜单项不可见`);
        results.push({ panel: panel.label, opened: false, contentLen: 0, hasRef: false });
        // 关闭菜单
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        continue;
      }

      await menuItem.click();
      await page.waitForTimeout(1000);

      // 检查面板内容
      const overlay = page.locator('[data-testid="feature-panel-overlay"]');
      const panelHTML = await overlay.innerHTML();
      const hasRealContent = panelHTML.length > 50;

      const hasRef = collector.report(`Panel-${panel.label}`);
      results.push({
        panel: panel.label,
        opened: hasRealContent,
        contentLen: panelHTML.length,
        hasRef,
      });

      // 关闭面板
      const closeBtn = page.locator('.shared-panel-close, .tk-feature-header button, button:has-text("✕")').first();
      if (await closeBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await closeBtn.click();
      } else {
        await page.keyboard.press('Escape');
      }
      await page.waitForTimeout(300);

      await page.screenshot({ path: `e2e/screenshots/03b-panel-${panel.id}.png`, fullPage: false });
    }

    // 汇总
    console.log('\n📊 FeatureMenu面板测试汇总:');
    for (const r of results) {
      const status = r.hasRef ? '🔴' : r.opened ? '✅' : '⚠️';
      console.log(`  ${status} ${r.panel}: 打开=${r.opened}, 内容=${r.contentLen}, RefErr=${r.hasRef}`);
    }

    const refErrors = results.filter(r => r.hasRef);
    expect(refErrors.length, '不应有任何面板产生ReferenceError').toBe(0);
    console.log('✅ FeatureMenu面板测试完成');
  });

  // ─────────────────────────────────────────
  // 4) Console错误汇总报告
  // ─────────────────────────────────────────
  test('4-Console错误汇总：全Tab遍历无ReferenceError', async ({ page }) => {
    const collector = new ConsoleErrorCollector();
    collector.attach(page);

    await navigateToGame(page, collector);

    const allErrors: Array<{ tab: string; errors: typeof collector.getErrors }> = [];

    for (const tab of PRIMARY_TABS) {
      collector.clear();

      const tabBtn = page.locator(`[data-testid="tab-bar-${tab.id}"]`);
      await tabBtn.click();
      await page.waitForTimeout(1000);

      const errors = collector.getErrors();
      if (errors.length > 0) {
        allErrors.push({ tab: tab.label, errors: [...errors] });
      }
    }

    // 汇总报告
    console.log('\n═══════════════════════════════════════');
    console.log('📊 Console错误汇总报告');
    console.log('═══════════════════════════════════════');

    let totalErrors = 0;
    let totalRefErrors = 0;

    for (const entry of allErrors) {
      console.log(`\n🏷️ Tab [${entry.tab}]: ${entry.errors.length} 个错误`);
      for (const err of entry.errors) {
        const isRef = err.text.includes('ReferenceError') || err.text.includes('is not defined');
        if (isRef) {
          totalRefErrors++;
          console.log(`  🔴 REF: ${err.text.slice(0, 200)}`);
        } else {
          totalErrors++;
          console.log(`  🟡 ERR: ${err.text.slice(0, 200)}`);
        }
      }
    }

    console.log(`\n📈 总计: ${totalErrors} 个普通错误, ${totalRefErrors} 个ReferenceError`);
    console.log('═══════════════════════════════════════\n');

    expect(totalRefErrors, '全Tab遍历不应产生任何ReferenceError').toBe(0);
    console.log('✅ Console错误汇总测试通过');
  });

  // ─────────────────────────────────────────
  // 5) 声望面板专项测试
  // ─────────────────────────────────────────
  test('5-声望面板专项：PrestigePanel完整渲染验证', async ({ page }) => {
    const collector = new ConsoleErrorCollector();
    collector.attach(page);

    await navigateToGame(page, collector);

    // 点击声望Tab
    await page.locator('[data-testid="tab-bar-prestige"]').click();
    await page.waitForTimeout(1500);

    // 验证声望面板渲染
    const sceneRouter = page.locator('[data-testid="tk-scene-router"]');
    const content = await sceneRouter.innerHTML();
    expect(content.length, '声望面板应有实质内容').toBeGreaterThan(50);

    // 检查声望相关文本
    const prestigeTexts = await page.locator('text=/声望|威望|爵位|品级|官职/i').count();
    console.log(`  声望面板: 找到 ${prestigeTexts} 处声望相关文本`);

    // 无ReferenceError
    const hasRef = collector.report('声望面板');
    expect(hasRef, '声望面板不应有ReferenceError').toBe(false);

    await page.screenshot({ path: 'e2e/screenshots/05-prestige-panel.png', fullPage: false });
    console.log('✅ 声望面板专项测试通过');
  });
});

// 数据正确性验证测试套件
test.describe('三国霸业 — 数据正确性验证', () => {
  test.setTimeout(180_000);

  // SM-06 资源栏数据验证
  test('SM-06 资源栏数据验证：资源类型和数值正确', async ({ page }) => {
    const collector = new ConsoleErrorCollector();
    collector.attach(page);
    try {
      await navigateToGame(page, collector);
      await page.locator('[data-testid="tab-bar-building"]').click();
      await page.waitForTimeout(1000);

      const resourceBar = page.locator('[data-testid="tk-resource-bar"]');
      await expect(resourceBar, '资源栏应可见').toBeVisible({ timeout: 5_000 });

      // 验证4种资源类型显示
      const expectedResources = [
        { key: 'grain', label: '粮草', icon: '🌾' },
        { key: 'gold', label: '铜钱', icon: '💰' },
        { key: 'troops', label: '兵力', icon: '⚔️' },
        { key: 'mandate', label: '天命', icon: '👑' },
      ];

      for (const res of expectedResources) {
        const iconEl = resourceBar.locator(`.resource-item.${res.key} .resource-icon`);
        await expect(iconEl, `[${res.label}] 图标应存在`).toBeVisible({ timeout: 3_000 });

        const valueEl = resourceBar.locator(`.resource-item.${res.key} .resource-value`);
        await expect(valueEl, `[${res.label}] 数值元素应存在`).toBeVisible({ timeout: 3_000 });
        const valueText = await valueEl.textContent();
        expect(valueText, `[${res.label}] 数值不应为空`).toBeTruthy();
        expect(valueText, `[${res.label}] 数值不应包含 NaN`).not.toContain('NaN');
        expect(valueText, `[${res.label}] 数值不应包含 undefined`).not.toContain('undefined');

        // 通过JS二次验证资源数值
        const rawValue = await page.evaluate((resKey) => {
          const el = document.querySelector(
            `[data-testid="tk-resource-bar"] .resource-item.${resKey} .resource-value`
          );
          return el?.textContent ?? '';
        }, res.key);
        expect(rawValue, `[${res.label}] 原始值不应为空`).toBeTruthy();
      }

      // 验证资源产出率显示（至少一个为正数）
      const rateElements = resourceBar.locator('.resource-rate.positive');
      const positiveRateCount = await rateElements.count();
      expect(positiveRateCount, '至少应有一个资源的产出率为正').toBeGreaterThan(0);

      for (let i = 0; i < positiveRateCount; i++) {
        const rateText = await rateElements.nth(i).textContent();
        expect(rateText, `产出率 #${i + 1} 应包含 "+"`).toContain('+');
        expect(rateText, `产出率 #${i + 1} 应包含 "/秒"`).toContain('/秒');
      }

      const hasRef = collector.report('SM-06资源栏');
      expect(hasRef, '资源栏验证不应产生ReferenceError').toBe(false);
      await page.screenshot({ path: 'e2e/screenshots/SM-06-resource-bar.png', fullPage: false });
      console.log('✅ SM-06 资源栏数据验证通过');
    } catch (err) {
      await page.screenshot({ path: 'e2e/screenshots/SM-06-resource-bar-FAIL.png', fullPage: false }).catch(() => {});
      throw err;
    }
  });

  // SM-07 建筑面板数据验证
  test('SM-07 建筑面板数据验证：建筑名称、等级、升级按钮', async ({ page }) => {
    const collector = new ConsoleErrorCollector();
    collector.attach(page);
    try {
      await navigateToGame(page, collector);
      await page.locator('[data-testid="tab-bar-building"]').click();
      await page.waitForTimeout(1000);

      const buildingPanel = page.locator('[data-testid="building-panel"]');
      await expect(buildingPanel, '建筑面板应可见').toBeVisible({ timeout: 5_000 });

      const mapEl = page.locator('[data-testid="building-panel-map"]');
      await expect(mapEl, '建筑地图区域应存在').toBeVisible({ timeout: 3_000 });

      const listEl = page.locator('[data-testid="building-panel-list"]');
      const listVisible = await listEl.isVisible({ timeout: 2_000 }).catch(() => false);

      // 验证核心建筑名称和等级
      const coreBuildings = [
        { type: 'castle', label: '主城' },
        { type: 'farmland', label: '农田' },
        { type: 'market', label: '市集' },
        { type: 'barracks', label: '兵营' },
      ];

      for (const bld of coreBuildings) {
        const mapItem = page.locator(`[data-testid="building-panel-item-${bld.type}"]`);
        const mapItemVisible = await mapItem.isVisible({ timeout: 2_000 }).catch(() => false);
        if (mapItemVisible) {
          const nameEl = mapItem.locator('.tk-bld-pin-name');
          await expect(nameEl, `[${bld.label}] 名称应可见`).toBeVisible({ timeout: 2_000 });
          const nameText = await nameEl.textContent();
          expect(nameText, `[${bld.label}] 名称应包含"${bld.label}"`).toContain(bld.label);

          // 验证等级显示（Lv.X 格式）
          const badgeEl = mapItem.locator('.tk-bld-pin-badge');
          const badgeVisible = await badgeEl.isVisible({ timeout: 1_000 }).catch(() => false);
          if (badgeVisible) {
            const badgeText = await badgeEl.textContent();
            expect(badgeText, `[${bld.label}] 等级应为 Lv.X 格式`).toMatch(/Lv\.\d+/);
          }

          // 核心建筑初始不应锁定
          const isLocked = await mapItem.evaluate((el) =>
            el.classList.contains('tk-bld-pin--locked')
          );
          expect(isLocked, `[${bld.label}] 核心建筑初始不应锁定`).toBe(false);
        }

        // 验证列表中的建筑项（如果列表可见）
        if (listVisible) {
          const listItem = page.locator(`[data-testid="building-panel-list-item-${bld.type}"]`);
          const listItemVisible = await listItem.isVisible({ timeout: 2_000 }).catch(() => false);
          if (listItemVisible) {
            const itemText = await listItem.textContent();
            expect(itemText, `[${bld.label}] 列表项应包含名称`).toContain(bld.label);
            expect(itemText, `[${bld.label}] 列表项应包含等级`).toMatch(/Lv\.\d+/);
          }
        }
      }

      // 验证升级按钮存在
      if (listVisible) {
        const allUpgradeBtns = page.locator('.tk-bld-list-btn');
        const totalBtnCount = await allUpgradeBtns.count();
        expect(totalBtnCount, '应存在升级按钮').toBeGreaterThan(0);
      }

      // 验证收支详情按钮
      const incomeBtn = page.locator('[data-testid="building-panel-income-btn"]');
      const incomeBtnVisible = await incomeBtn.isVisible({ timeout: 2_000 }).catch(() => false);
      if (incomeBtnVisible) {
        const btnText = await incomeBtn.textContent();
        expect(btnText, '收支详情按钮文本正确').toContain('收支详情');
      }

      const hasRef = collector.report('SM-07建筑面板');
      expect(hasRef, '建筑面板验证不应产生ReferenceError').toBe(false);
      await page.screenshot({ path: 'e2e/screenshots/SM-07-building-panel.png', fullPage: false });
      console.log('✅ SM-07 建筑面板数据验证通过');
    } catch (err) {
      await page.screenshot({ path: 'e2e/screenshots/SM-07-building-panel-FAIL.png', fullPage: false }).catch(() => {});
      throw err;
    }
  });

  // SM-08 武将面板数据验证
  test('SM-08 武将面板数据验证：武将列表/空状态、属性', async ({ page }) => {
    const collector = new ConsoleErrorCollector();
    collector.attach(page);
    try {
      await navigateToGame(page, collector);
      await page.locator('[data-testid="tab-bar-hero"]').click();
      await page.waitForTimeout(1500);

      const heroTab = page.locator('[data-testid="hero-tab"]');
      await expect(heroTab, '武将Tab应可见').toBeVisible({ timeout: 5_000 });

      // 验证工具栏和招募按钮
      const toolbar = heroTab.locator('.tk-hero-toolbar');
      await expect(toolbar, '武将工具栏应可见').toBeVisible({ timeout: 3_000 });

      const listSubTab = page.locator('[data-testid="hero-tab-subtab-list"]');
      await expect(listSubTab, '武将子Tab应可见').toBeVisible({ timeout: 3_000 });

      const recruitBtn = page.locator('[data-testid="hero-tab-recruit-btn"]');
      await expect(recruitBtn, '招募按钮应可见').toBeVisible({ timeout: 3_000 });
      const recruitText = await recruitBtn.textContent();
      expect(recruitText, '招募按钮应包含"招募"文本').toContain('招募');

      // 判断是空状态还是有武将
      const emptyState = page.locator('[data-testid="hero-tab-empty"]');
      const hasEmptyState = await emptyState.isVisible({ timeout: 2_000 }).catch(() => false);

      if (hasEmptyState) {
        console.log('  SM-08: 武将列表为空，验证空状态引导');
        const emptyText = await emptyState.textContent();
        expect(emptyText, '空状态应包含引导文本').toBeTruthy();
        expect(emptyText!.length, '空状态文本不应为空').toBeGreaterThan(0);

        const emptyRecruitBtn = page.locator('[data-testid="hero-tab-empty-recruit-btn"]');
        const emptyRecruitVisible = await emptyRecruitBtn.isVisible({ timeout: 2_000 }).catch(() => false);
        if (emptyRecruitVisible) {
          const btnText = await emptyRecruitBtn.textContent();
          expect(btnText, '空状态招募按钮文本正确').toContain('招募');
        }
      } else {
        console.log('  SM-08: 武将列表非空，验证武将卡片数据');
        const heroGrid = page.locator('[data-testid="hero-tab-grid"]');
        const gridVisible = await heroGrid.isVisible({ timeout: 3_000 }).catch(() => false);

        if (gridVisible) {
          const heroCards = heroGrid.locator('[data-testid^="hero-card-"]');
          const cardCount = await heroCards.count();
          expect(cardCount, '应至少有一张武将卡片').toBeGreaterThan(0);
          console.log(`  SM-08: 找到 ${cardCount} 张武将卡片`);

          const firstCard = heroCards.first();

          // 验证武将名称
          const nameEl = firstCard.locator('.tk-hero-card-name');
          const nameVisible = await nameEl.isVisible({ timeout: 2_000 }).catch(() => false);
          if (nameVisible) {
            const nameText = await nameEl.textContent();
            expect(nameText, '武将名称不应为空').toBeTruthy();
            expect(nameText!.length, '武将名称长度应 > 0').toBeGreaterThan(0);
          }

          // 验证等级（Lv.X）
          const levelEl = firstCard.locator('.tk-hero-card-level');
          const levelVisible = await levelEl.isVisible({ timeout: 2_000 }).catch(() => false);
          if (levelVisible) {
            const levelText = await levelEl.textContent();
            expect(levelText, '武将等级应为 Lv.X 格式').toMatch(/Lv\.\d+/);
          }

          // 验证战力
          const powerEl = firstCard.locator('.tk-hero-card-power');
          const powerVisible = await powerEl.isVisible({ timeout: 2_000 }).catch(() => false);
          if (powerVisible) {
            const powerText = await powerEl.textContent();
            expect(powerText, '战力文本不应为空').toBeTruthy();
            expect(powerText, '战力不应包含 NaN').not.toContain('NaN');
          }

          // 验证总战力
          const totalPower = page.locator('[data-testid="hero-tab-total-power"]');
          const totalPowerVisible = await totalPower.isVisible({ timeout: 2_000 }).catch(() => false);
          if (totalPowerVisible) {
            const totalPowerText = await totalPower.textContent();
            expect(totalPowerText, '总战力文本应包含数值').toMatch(/\d+/);
          }

          // 验证武将总数
          const countEl = page.locator('[data-testid="hero-tab-count"]');
          const countVisible = await countEl.isVisible({ timeout: 2_000 }).catch(() => false);
          if (countVisible) {
            const countText = await countEl.textContent();
            expect(countText, '武将总数应包含数字').toMatch(/\d+/);
          }
        }
      }

      const hasRef = collector.report('SM-08武将面板');
      expect(hasRef, '武将面板验证不应产生ReferenceError').toBe(false);
      await page.screenshot({ path: 'e2e/screenshots/SM-08-hero-panel.png', fullPage: false });
      console.log('✅ SM-08 武将面板数据验证通过');
    } catch (err) {
      await page.screenshot({ path: 'e2e/screenshots/SM-08-hero-panel-FAIL.png', fullPage: false }).catch(() => {});
      throw err;
    }
  });

  // SM-09 商店面板数据验证
  test('SM-09 商店面板数据验证：商品列表、价格、货币', async ({ page }) => {
    const collector = new ConsoleErrorCollector();
    collector.attach(page);
    try {
      await navigateToGame(page, collector);

      // 通过"更多"Tab打开商店面板
      await page.locator('[data-testid="tab-bar-more"]').click();
      await page.waitForTimeout(500);
      const shopCard = page.locator('.tk-more-card:has-text("商店")').first();
      await expect(shopCard, '商店卡片应可见').toBeVisible({ timeout: 3_000 });
      await shopCard.click();
      await page.waitForTimeout(1500);

      const shopPanel = page.locator('[data-testid="shop-panel"]');
      await expect(shopPanel, '商店面板应可见').toBeVisible({ timeout: 5_000 });

      // 验证商店Tab栏
      const shopTabs = page.locator('[data-testid="shop-panel-tabs"]');
      await expect(shopTabs, '商店Tab栏应可见').toBeVisible({ timeout: 3_000 });

      const expectedShopTabs = ['normal', 'black_market', 'limited_time', 'vip'];
      for (const tabId of expectedShopTabs) {
        const tabBtn = page.locator(`[data-testid="shop-panel-tab-${tabId}"]`);
        const tabVisible = await tabBtn.isVisible({ timeout: 2_000 }).catch(() => false);
        if (tabVisible) {
          const tabText = await tabBtn.textContent();
          expect(tabText, `商店Tab [${tabId}] 应有文本`).toBeTruthy();
        }
      }

      // 验证刷新按钮
      const refreshBtn = page.locator('[data-testid="shop-panel-refresh"]');
      const refreshVisible = await refreshBtn.isVisible({ timeout: 2_000 }).catch(() => false);
      if (refreshVisible) {
        const refreshText = await refreshBtn.textContent();
        expect(refreshText, '刷新按钮应包含刷新信息').toMatch(/\d+\/\d+/);
      }

      // 等待骨架屏消失
      await page.waitForTimeout(500);

      // 检查是否有空状态或商品
      const emptyState = shopPanel.locator('.tk-shop-empty');
      const hasEmptyState = await emptyState.isVisible({ timeout: 2_000 }).catch(() => false);

      if (!hasEmptyState) {
        const goodsCards = shopPanel.locator('[data-testid^="shop-panel-goods-"]');
        const goodsCount = await goodsCards.count();
        console.log(`  SM-09: 找到 ${goodsCount} 个商品`);

        if (goodsCount > 0) {
          const firstGoods = goodsCards.first();

          // 验证商品名称
          const goodsName = firstGoods.locator('.tk-shop-goods-name');
          const nameVisible = await goodsName.isVisible({ timeout: 2_000 }).catch(() => false);
          if (nameVisible) {
            const nameText = await goodsName.textContent();
            expect(nameText, '商品名称不应为空').toBeTruthy();
          }

          // 验证商品价格
          const priceEl = firstGoods.locator('.tk-shop-price');
          const priceVisible = await priceEl.isVisible({ timeout: 2_000 }).catch(() => false);
          if (priceVisible) {
            const priceText = await priceEl.textContent();
            expect(priceText, '商品价格不应为空').toBeTruthy();
            expect(priceText, '商品价格不应为 NaN').not.toContain('NaN');
          }

          // 验证购买按钮
          const buyBtn = firstGoods.locator('[data-testid^="shop-panel-buy-"]');
          const buyBtnVisible = await buyBtn.isVisible({ timeout: 2_000 }).catch(() => false);
          if (buyBtnVisible) {
            const buyText = await buyBtn.textContent();
            expect(buyText, '购买按钮文本应为"购买"或"售罄"').toMatch(/购买|售罄/);
          }
        }
      } else {
        console.log('  SM-09: 商店为空状态');
        const emptyText = await emptyState.textContent();
        expect(emptyText, '空状态应包含提示文本').toBeTruthy();
      }

      // 验证货币余额显示
      const currencyBar = shopPanel.locator('.tk-shop-currency-bar');
      const currencyVisible = await currencyBar.isVisible({ timeout: 2_000 }).catch(() => false);
      if (currencyVisible) {
        const currencyItems = currencyBar.locator('.tk-shop-currency-item');
        const currencyCount = await currencyItems.count();
        expect(currencyCount, '应至少显示一种货币').toBeGreaterThan(0);
        console.log(`  SM-09: 显示 ${currencyCount} 种货币`);

        for (let i = 0; i < currencyCount; i++) {
          const curText = await currencyItems.nth(i).textContent();
          expect(curText, `货币 #${i + 1} 应包含数值`).toMatch(/\d+/);
          expect(curText, `货币 #${i + 1} 不应包含 NaN`).not.toContain('NaN');
        }
      }

      const hasRef = collector.report('SM-09商店面板');
      expect(hasRef, '商店面板验证不应产生ReferenceError').toBe(false);
      await page.screenshot({ path: 'e2e/screenshots/SM-09-shop-panel.png', fullPage: false });
      console.log('✅ SM-09 商店面板数据验证通过');
    } catch (err) {
      await page.screenshot({ path: 'e2e/screenshots/SM-09-shop-panel-FAIL.png', fullPage: false }).catch(() => {});
      throw err;
    }
  });

  // SM-10 科技面板数据验证
  test('SM-10 科技面板数据验证：科技树、名称、等级', async ({ page }) => {
    const collector = new ConsoleErrorCollector();
    collector.attach(page);
    try {
      await navigateToGame(page, collector);
      await page.locator('[data-testid="tab-bar-tech"]').click();
      await page.waitForTimeout(1500);

      const techTab = page.locator('[data-testid="tech-tab"]');
      await expect(techTab, '科技Tab应可见').toBeVisible({ timeout: 5_000 });

      // 验证路线切换Tab
      const expectedPaths = ['military', 'economy', 'culture'];
      const pathLabels: Record<string, string> = { military: '军事', economy: '经济', culture: '文化' };

      for (const pathId of expectedPaths) {
        const pathTab = page.locator(`[data-testid="tech-path-tab-${pathId}"]`);
        const pathTabVisible = await pathTab.isVisible({ timeout: 2_000 }).catch(() => false);
        if (pathTabVisible) {
          const tabText = await pathTab.textContent();
          expect(tabText, `[${pathId}] 路线Tab应包含路线名称`).toContain(pathLabels[pathId]);
        }
      }

      // 验证科技点信息栏
      const pointsBar = techTab.locator('.tk-tech-points-bar');
      const pointsBarVisible = await pointsBar.isVisible({ timeout: 3_000 }).catch(() => false);
      if (pointsBarVisible) {
        const pointsValue = pointsBar.locator('.tk-tech-points-value');
        const pointsVisible = await pointsValue.isVisible({ timeout: 2_000 }).catch(() => false);
        if (pointsVisible) {
          const pointsText = await pointsValue.textContent();
          expect(pointsText, '科技点数值不应为空').toBeTruthy();
          expect(pointsText, '科技点不应为 NaN').not.toContain('NaN');
          const pointsNum = parseInt(pointsText!, 10);
          expect(isNaN(pointsNum), '科技点应为有效数字').toBe(false);
          expect(pointsNum, '科技点应 >= 0').toBeGreaterThanOrEqual(0);
        }
      }

      // 验证科技树画布
      const techCanvas = page.locator('[data-testid="tech-canvas"]');
      await expect(techCanvas, '科技树画布应可见').toBeVisible({ timeout: 3_000 });

      // 验证科技节点存在
      const techNodes = techCanvas.locator('[data-testid^="tech-node-"]');
      const nodeCount = await techNodes.count();
      expect(nodeCount, '科技树应至少有一个节点').toBeGreaterThan(0);
      console.log(`  SM-10: 找到 ${nodeCount} 个科技节点`);

      // 验证科技节点有名称
      let nodesWithNames = 0;
      for (let i = 0; i < Math.min(nodeCount, 10); i++) {
        const nameEl = techNodes.nth(i).locator('.tk-tech-node-name');
        const nameVisible = await nameEl.isVisible({ timeout: 1_000 }).catch(() => false);
        if (nameVisible) {
          const nameText = await nameEl.textContent();
          if (nameText && nameText.trim().length > 0) nodesWithNames++;
        }
      }
      expect(nodesWithNames, '至少应有一个科技节点显示名称').toBeGreaterThan(0);

      // 验证科技节点状态角标
      const techBadges = techCanvas.locator('[data-testid^="tech-badge-"]');
      const badgeCount = await techBadges.count();
      expect(badgeCount, '科技节点应有状态角标').toBeGreaterThan(0);

      // 验证路线进度显示（如 "0/5" 格式）
      const progressEls = techTab.locator('.tk-tech-path-progress');
      const progressCount = await progressEls.count();
      for (let i = 0; i < progressCount; i++) {
        const progressText = await progressEls.nth(i).textContent();
        expect(progressText, `路线进度 #${i + 1} 应为 X/Y 格式`).toMatch(/\d+\/\d+/);
      }

      // 依次切换路线，验证每条路线都有节点
      for (const pathId of expectedPaths) {
        const pathTab = page.locator(`[data-testid="tech-path-tab-${pathId}"]`);
        const pathTabVisible = await pathTab.isVisible({ timeout: 2_000 }).catch(() => false);
        if (pathTabVisible) {
          await pathTab.click();
          await page.waitForTimeout(500);

          const pathColumn = page.locator(`[data-testid="tech-path-${pathId}"]`);
          const pathVisible = await pathColumn.isVisible({ timeout: 2_000 }).catch(() => false);
          if (pathVisible) {
            const pathNodes = pathColumn.locator('[data-testid^="tech-node-"]');
            const pathNodeCount = await pathNodes.count();
            console.log(`  SM-10: ${pathLabels[pathId]}路线有 ${pathNodeCount} 个节点`);
            expect(pathNodeCount, `${pathLabels[pathId]}路线应至少有一个科技节点`).toBeGreaterThan(0);
          }
        }
      }

      const hasRef = collector.report('SM-10科技面板');
      expect(hasRef, '科技面板验证不应产生ReferenceError').toBe(false);
      await page.screenshot({ path: 'e2e/screenshots/SM-10-tech-panel.png', fullPage: false });
      console.log('✅ SM-10 科技面板数据验证通过');
    } catch (err) {
      await page.screenshot({ path: 'e2e/screenshots/SM-10-tech-panel-FAIL.png', fullPage: false }).catch(() => {});
      throw err;
    }
  });
});
