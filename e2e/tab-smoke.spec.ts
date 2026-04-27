/**
 * SM-主Tab冒烟测试 — 7个主Tab切换与内容验证
 *
 * 覆盖范围：
 *   SM-01 天下Tab — 显示资源栏和世界地图
 *   SM-02 出征Tab — 显示关卡和章节选择器
 *   SM-03 武将Tab — 显示武将列表/网格
 *   SM-04 科技Tab — 显示科技树
 *   SM-05 建筑Tab — 显示建筑列表（默认首页）
 *   SM-06 声望Tab — 显示声望信息
 *   SM-07 更多Tab — 显示功能菜单/设置
 *
 * 验证策略：
 *   1. Tab 能正常切换（不崩溃）
 *   2. 关键数据显示正确（非 undefined/null）
 *   3. Console 无 ReferenceError
 *   4. 内容区域非空
 *
 * 运行方式：
 *   npx playwright test e2e/tab-smoke.spec.ts --config e2e/playwright.config.ts
 *
 * 前置条件：
 *   - preview server 运行在 http://localhost:4173（npm run preview）
 *   - 或 dev server 运行在 http://localhost:3000（npm run dev）
 */

import { test, expect, type Page, type ConsoleMessage } from '@playwright/test';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:4173';
const GAME_ROUTE = '/idle/three-kingdoms';

/** 7个主Tab — 与 TabBar.tsx TABS 配置对齐 */
const PRIMARY_TABS = [
  { id: 'map',      label: '天下',  icon: '🗺️', testId: 'worldmap-tab' },
  { id: 'campaign', label: '出征',  icon: '⚔️', testId: 'campaign-tab' },
  { id: 'hero',     label: '武将',  icon: '🦸', testId: 'hero-tab' },
  { id: 'tech',     label: '科技',  icon: '📜', testId: 'tech-tab' },
  { id: 'building', label: '建筑',  icon: '🏰', testId: 'building-panel' },
  { id: 'prestige', label: '声望',  icon: '👑', testId: 'prestige-panel' },
  { id: 'more',     label: '更多▼', icon: '📋', testId: 'more-tab' },
] as const;

// ─────────────────────────────────────────────
// 辅助：Console 错误收集器
// ─────────────────────────────────────────────
class ConsoleErrorCollector {
  private errors: Array<{ type: string; text: string }> = [];

  attach(page: Page) {
    this.errors = [];
    page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() === 'error') {
        this.errors.push({ type: 'console.error', text: msg.text() });
      }
    });
    page.on('pageerror', (err: Error) => {
      this.errors.push({
        type: 'pageerror',
        text: `${err.name}: ${err.message}`,
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

  /** 报告当前错误，返回是否有 ReferenceError */
  report(section: string): boolean {
    const refErrors = this.getReferenceErrors();
    const otherErrors = this.errors.filter(
      (e) => !e.text.includes('ReferenceError') && !e.text.includes('is not defined')
    );

    if (otherErrors.length > 0) {
      console.log(`  ⚠️ [${section}] ${otherErrors.length} 个非致命错误`);
    }
    if (refErrors.length > 0) {
      console.log(`  🔴 [${section}] ${refErrors.length} 个 ReferenceError:`);
      refErrors.forEach((e, i) => console.log(`    #${i + 1}: ${e.text.slice(0, 150)}`));
    }
    return refErrors.length > 0;
  }
}

// ─────────────────────────────────────────────
// 辅助：导航到游戏页面
// ─────────────────────────────────────────────
async function navigateToGame(page: Page, collector: ConsoleErrorCollector) {
  // 先访问根路径设置 localStorage（标记已访问，跳过欢迎弹窗）
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('tk-has-visited', 'true');
  });

  // 导航到游戏页面
  await page.goto(`${BASE_URL}${GAME_ROUTE}`, {
    waitUntil: 'networkidle',
    timeout: 30_000,
  });

  // 关闭可能的 WelcomeModal
  const confirmBtn = page.locator('button:has-text("开始游戏")');
  if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await confirmBtn.click();
    await page.waitForTimeout(300);
  }

  // 等待引擎初始化
  await page.waitForTimeout(1500);

  // 验证页面已加载 — TabBar 可见
  const tabBar = page.locator('[data-testid="tab-bar"]');
  await expect(tabBar, 'TabBar 应可见').toBeVisible({ timeout: 10_000 });
}

// ─────────────────────────────────────────────
// 辅助：切换到指定 Tab 并等待渲染
//
// 注意：Tab 按钮在移动端视口下可能因 CSS flex 布局
//       导致相邻 Tab 的子元素（tk-tab-icon-wrap）覆盖在目标 Tab 上方，
//       拦截 pointer events。因此使用 JavaScript dispatchEvent 直接触发点击，
//       绕过 CSS 层叠问题。
// ─────────────────────────────────────────────
async function switchToTab(page: Page, tabId: string) {
  const tabBtn = page.locator(`[data-testid="tab-bar-${tabId}"]`);
  await expect(tabBtn, `Tab [${tabId}] 按钮应可见`).toBeVisible({ timeout: 3_000 });

  // 使用 JavaScript 直接触发 click 事件，绕过 CSS 层叠导致的 pointer events 拦截
  await page.evaluate((tid) => {
    const btn = document.querySelector(`[data-testid="tab-bar-${tid}"]`) as HTMLElement;
    if (btn) btn.click();
  }, tabId);

  await page.waitForTimeout(800);
}

// ─────────────────────────────────────────────
// 测试套件
// ─────────────────────────────────────────────
test.describe('SM-主Tab冒烟测试', () => {
  test.setTimeout(120_000);

  // ═══════════════════════════════════════════
  // SM-01 天下Tab — 显示资源栏和世界地图
  // ═══════════════════════════════════════════
  test('SM-01 天下Tab - 显示资源栏和世界地图', async ({ page }) => {
    const collector = new ConsoleErrorCollector();
    collector.attach(page);

    await navigateToGame(page, collector);

    // 切换到天下Tab
    await switchToTab(page, 'map');

    // 验证选中状态
    const mapTabBtn = page.locator('[data-testid="tab-bar-map"]');
    await expect(mapTabBtn).toHaveAttribute('aria-selected', 'true');

    // 验证世界地图组件渲染
    const worldMap = page.locator('[data-testid="worldmap-tab"]');
    await expect(worldMap, '世界地图组件应可见').toBeVisible({ timeout: 5_000 });

    // 验证游戏根容器存在（资源栏在根容器内）
    const gameRoot = page.locator('[data-testid="tk-three-kingdoms-game"]');
    await expect(gameRoot, '游戏根容器应存在').toBeVisible();

    // 验证内容非空
    const sceneRouter = page.locator('[data-testid="tk-scene-router"]');
    const content = await sceneRouter.innerHTML();
    expect(content.length, '天下Tab 内容区域不应为空').toBeGreaterThan(10);

    // 验证无 ReferenceError
    const hasRef = collector.report('SM-01 天下Tab');
    expect(hasRef, '天下Tab 不应有 ReferenceError').toBe(false);

    // 截图
    await page.screenshot({
      path: 'e2e/screenshots/SM-01-map-tab.png',
      fullPage: false,
    });
  });

  // ═══════════════════════════════════════════
  // SM-02 出征Tab - 显示地图和关卡
  // ═══════════════════════════════════════════
  test('SM-02 出征Tab - 显示地图和关卡', async ({ page }) => {
    const collector = new ConsoleErrorCollector();
    collector.attach(page);

    await navigateToGame(page, collector);

    // 切换到出征Tab
    await switchToTab(page, 'campaign');

    // 验证选中状态
    const campaignTabBtn = page.locator('[data-testid="tab-bar-campaign"]');
    await expect(campaignTabBtn).toHaveAttribute('aria-selected', 'true');

    // 验证出征面板渲染
    const campaignTab = page.locator('[data-testid="campaign-tab"]');
    await expect(campaignTab, '出征面板应可见').toBeVisible({ timeout: 5_000 });

    // 验证章节选择器存在
    const chapterSelector = page.locator('[data-testid="chapter-selector"]');
    await expect(chapterSelector, '章节选择器应可见').toBeVisible({ timeout: 5_000 });

    // 验证内容非空
    const sceneRouter = page.locator('[data-testid="tk-scene-router"]');
    const content = await sceneRouter.innerHTML();
    expect(content.length, '出征Tab 内容区域不应为空').toBeGreaterThan(10);

    // 验证无 ReferenceError
    const hasRef = collector.report('SM-02 出征Tab');
    expect(hasRef, '出征Tab 不应有 ReferenceError').toBe(false);

    // 截图
    await page.screenshot({
      path: 'e2e/screenshots/SM-02-campaign-tab.png',
      fullPage: false,
    });
  });

  // ═══════════════════════════════════════════
  // SM-03 武将Tab - 显示武将列表
  // ═══════════════════════════════════════════
  test('SM-03 武将Tab - 显示武将列表', async ({ page }) => {
    const collector = new ConsoleErrorCollector();
    collector.attach(page);

    await navigateToGame(page, collector);

    // 切换到武将Tab
    await switchToTab(page, 'hero');

    // 验证选中状态
    const heroTabBtn = page.locator('[data-testid="tab-bar-hero"]');
    await expect(heroTabBtn).toHaveAttribute('aria-selected', 'true');

    // 验证武将面板渲染
    const heroTab = page.locator('[data-testid="hero-tab"]');
    await expect(heroTab, '武将面板应可见').toBeVisible({ timeout: 5_000 });

    // 验证武将子Tab存在（列表/编队）
    const subtabList = page.locator('[data-testid="hero-tab-subtab-list"]');
    await expect(subtabList, '武将列表子Tab应可见').toBeVisible({ timeout: 3_000 });

    // 验证招募按钮存在
    const recruitBtn = page.locator('[data-testid="hero-tab-recruit-btn"]');
    await expect(recruitBtn, '招募按钮应可见').toBeVisible({ timeout: 3_000 });

    // 验证内容非空
    const sceneRouter = page.locator('[data-testid="tk-scene-router"]');
    const content = await sceneRouter.innerHTML();
    expect(content.length, '武将Tab 内容区域不应为空').toBeGreaterThan(10);

    // 验证无 ReferenceError
    const hasRef = collector.report('SM-03 武将Tab');
    expect(hasRef, '武将Tab 不应有 ReferenceError').toBe(false);

    // 截图
    await page.screenshot({
      path: 'e2e/screenshots/SM-03-hero-tab.png',
      fullPage: false,
    });
  });

  // ═══════════════════════════════════════════
  // SM-04 科技Tab - 显示科技树
  // ═══════════════════════════════════════════
  test('SM-04 科技Tab - 显示科技树', async ({ page }) => {
    const collector = new ConsoleErrorCollector();
    collector.attach(page);

    await navigateToGame(page, collector);

    // 切换到科技Tab
    await switchToTab(page, 'tech');

    // 验证选中状态
    const techTabBtn = page.locator('[data-testid="tab-bar-tech"]');
    await expect(techTabBtn).toHaveAttribute('aria-selected', 'true');

    // 验证科技面板渲染
    const techTab = page.locator('[data-testid="tech-tab"]');
    await expect(techTab, '科技面板应可见').toBeVisible({ timeout: 5_000 });

    // 验证科技画布区域
    const techCanvas = page.locator('[data-testid="tech-canvas"]');
    await expect(techCanvas, '科技画布应可见').toBeVisible({ timeout: 3_000 });

    // 验证内容非空
    const sceneRouter = page.locator('[data-testid="tk-scene-router"]');
    const content = await sceneRouter.innerHTML();
    expect(content.length, '科技Tab 内容区域不应为空').toBeGreaterThan(10);

    // 验证无 ReferenceError
    const hasRef = collector.report('SM-04 科技Tab');
    expect(hasRef, '科技Tab 不应有 ReferenceError').toBe(false);

    // 截图
    await page.screenshot({
      path: 'e2e/screenshots/SM-04-tech-tab.png',
      fullPage: false,
    });
  });

  // ═══════════════════════════════════════════
  // SM-05 建筑Tab - 显示建筑列表
  // ═══════════════════════════════════════════
  test('SM-05 建筑Tab - 显示建筑列表', async ({ page }) => {
    const collector = new ConsoleErrorCollector();
    collector.attach(page);

    await navigateToGame(page, collector);

    // 建筑是默认Tab，验证默认选中
    const buildingTabBtn = page.locator('[data-testid="tab-bar-building"]');
    await expect(buildingTabBtn, '建筑Tab按钮应可见').toBeVisible({ timeout: 3_000 });
    await expect(buildingTabBtn).toHaveAttribute('aria-selected', 'true');

    // 验证建筑面板渲染
    const buildingPanel = page.locator('[data-testid="building-panel"]');
    await expect(buildingPanel, '建筑面板应可见').toBeVisible({ timeout: 5_000 });

    // 验证建筑列表区域
    const buildingList = page.locator('[data-testid="building-panel-list"]');
    await expect(buildingList, '建筑列表应可见').toBeVisible({ timeout: 3_000 });

    // 验证内容非空
    const sceneRouter = page.locator('[data-testid="tk-scene-router"]');
    const content = await sceneRouter.innerHTML();
    expect(content.length, '建筑Tab 内容区域不应为空').toBeGreaterThan(10);

    // 验证无 ReferenceError
    const hasRef = collector.report('SM-05 建筑Tab');
    expect(hasRef, '建筑Tab 不应有 ReferenceError').toBe(false);

    // 截图
    await page.screenshot({
      path: 'e2e/screenshots/SM-05-building-tab.png',
      fullPage: false,
    });
  });

  // ═══════════════════════════════════════════
  // SM-06 声望Tab - 显示声望信息
  // ═══════════════════════════════════════════
  test('SM-06 声望Tab - 显示声望信息', async ({ page }) => {
    const collector = new ConsoleErrorCollector();
    collector.attach(page);

    await navigateToGame(page, collector);

    // 切换到声望Tab
    await switchToTab(page, 'prestige');

    // 验证选中状态
    const prestigeTabBtn = page.locator('[data-testid="tab-bar-prestige"]');
    await expect(prestigeTabBtn).toHaveAttribute('aria-selected', 'true');

    // 验证声望面板渲染
    const prestigePanel = page.locator('[data-testid="prestige-panel"]');
    await expect(prestigePanel, '声望面板应可见').toBeVisible({ timeout: 5_000 });

    // 验证声望等级卡片
    const levelCard = page.locator('[data-testid="prestige-panel-level-card"]');
    await expect(levelCard, '声望等级卡片应可见').toBeVisible({ timeout: 3_000 });

    // 验证等级卡片中有实际内容（等级数字）
    const levelText = await levelCard.textContent();
    expect(levelText, '声望等级卡片应有文本内容').toBeTruthy();
    expect(levelText!.length, '声望等级卡片文本不应为空').toBeGreaterThan(0);

    // 验证内容非空
    const sceneRouter = page.locator('[data-testid="tk-scene-router"]');
    const content = await sceneRouter.innerHTML();
    expect(content.length, '声望Tab 内容区域不应为空').toBeGreaterThan(10);

    // 验证无 ReferenceError
    const hasRef = collector.report('SM-06 声望Tab');
    expect(hasRef, '声望Tab 不应有 ReferenceError').toBe(false);

    // 截图
    await page.screenshot({
      path: 'e2e/screenshots/SM-06-prestige-tab.png',
      fullPage: false,
    });
  });

  // ═══════════════════════════════════════════
  // SM-07 更多Tab - 显示设置菜单
  //
  // 注意：「更多▼」Tab 的行为与普通 Tab 不同：
  //   - 点击后 activeTab 切换为 'more'，SceneRouter 渲染 MoreTab 组件
  //   - 同时 moreMenuOpen 状态切换，控制下拉菜单显示
  //   - 验证时需要检查 SceneRouter 中的 MoreTab 或下拉菜单
  // ═══════════════════════════════════════════
  test('SM-07 更多Tab - 显示设置菜单', async ({ page }) => {
    const collector = new ConsoleErrorCollector();
    collector.attach(page);

    await navigateToGame(page, collector);

    // 点击更多Tab按钮
    await switchToTab(page, 'more');

    // 验证更多Tab被激活（aria-selected=true 或 aria-expanded=true）
    const moreTabBtn = page.locator('[data-testid="tab-bar-more"]');
    const isSelected = await moreTabBtn.getAttribute('aria-selected');
    const isExpanded = await moreTabBtn.getAttribute('aria-expanded');
    expect(
      isSelected === 'true' || isExpanded === 'true',
      '更多Tab 应处于激活或展开状态'
    ).toBe(true);

    // 检查两种可能的渲染结果：
    // 1. MoreTab 组件在 SceneRouter 中渲染
    // 2. 下拉功能菜单面板在 TabBar 中渲染
    const moreTab = page.locator('[data-testid="more-tab"]');
    const featureMenu = page.locator('[data-testid="feature-menu-dropdown"]');
    const moreTabVisible = await moreTab.isVisible().catch(() => false);
    const featureMenuVisible = await featureMenu.isVisible().catch(() => false);

    expect(
      moreTabVisible || featureMenuVisible,
      '更多Tab 应显示 MoreTab 组件或功能菜单下拉面板'
    ).toBe(true);

    // 如果 MoreTab 可见，验证功能卡片
    if (moreTabVisible) {
      const cards = page.locator('.tk-more-card');
      const cardCount = await cards.count();
      expect(cardCount, 'MoreTab应显示多个功能卡片').toBeGreaterThanOrEqual(5);

      // 验证设置卡片存在
      const settingsCard = page.locator('.tk-more-card:has-text("设置")');
      await expect(settingsCard, '设置功能卡片应可见').toBeVisible({ timeout: 3_000 });
    }

    // 如果下拉菜单可见，验证菜单项
    if (featureMenuVisible) {
      const menuItems = page.locator('[data-testid="feature-menu-dropdown"] button[role="menuitem"]');
      const itemCount = await menuItems.count();
      expect(itemCount, '功能菜单应有多个菜单项').toBeGreaterThanOrEqual(5);
    }

    // 验证无 ReferenceError
    const hasRef = collector.report('SM-07 更多Tab');
    expect(hasRef, '更多Tab 不应有 ReferenceError').toBe(false);

    // 截图
    await page.screenshot({
      path: 'e2e/screenshots/SM-07-more-tab.png',
      fullPage: false,
    });
  });

  // ═══════════════════════════════════════════
  // SM-08 全Tab遍历 — 无ReferenceError回归
  // ═══════════════════════════════════════════
  test('SM-08 全Tab遍历 - 无崩溃无ReferenceError', async ({ page }) => {
    const collector = new ConsoleErrorCollector();
    collector.attach(page);

    await navigateToGame(page, collector);

    const results: Array<{
      tab: string;
      passed: boolean;
      contentLen: number;
      hasRef: boolean;
    }> = [];

    for (const tab of PRIMARY_TABS) {
      collector.clear();

      // 切换到目标Tab
      await switchToTab(page, tab.id);

      // 验证场景内容非空
      const sceneRouter = page.locator('[data-testid="tk-scene-router"]');
      const content = await sceneRouter.innerHTML();
      expect(content.length, `[${tab.label}] 内容区域不应为空`).toBeGreaterThan(10);

      // 检查 ReferenceError
      const hasRef = collector.report(`Tab-${tab.label}`);

      results.push({
        tab: tab.label,
        passed: content.length > 10 && !hasRef,
        contentLen: content.length,
        hasRef,
      });
    }

    // 汇总报告
    console.log('\n📊 SM-08 全Tab遍历汇总:');
    for (const r of results) {
      const status = r.hasRef ? '🔴' : r.passed ? '✅' : '⚠️';
      console.log(
        `  ${status} ${r.tab}: 内容长度=${r.contentLen}, ReferenceError=${r.hasRef}`,
      );
    }

    const failedTabs = results.filter((r) => r.hasRef);
    expect(
      failedTabs.length,
      '不应有任何Tab产生ReferenceError',
    ).toBe(0);

    console.log('✅ SM-08 全Tab遍历测试通过');
  });
});
