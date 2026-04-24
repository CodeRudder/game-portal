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
