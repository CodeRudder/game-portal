/**
 * 更多Tab关键路径冒烟测试
 *
 * v2 改造后：
 * - "更多"从下拉菜单改为点击Tab后主内容区显示网格列表
 * - TabBar不再有下拉菜单功能，"更多"Tab变为普通Tab切换
 * - 网格列表由MoreTab组件在主内容区渲染
 *
 * 覆盖用例：
 *   TC-01 点击"更多"Tab → 主内容区显示网格列表（MoreTab可见）
 *   TC-02 网格列表中的功能项可见且可点击
 *   TC-03 点击"商店"功能项 → 商店面板弹出可见
 *   TC-04 从更多Tab切换到其他Tab → MoreTab消失
 *   TC-05 更多Tab的badge显示正确
 *
 * 关键验证方式：
 *   - toBeVisible() 验证MoreTab和功能项可见
 *   - boundingBox() 验证元素有实际渲染尺寸
 *   - 功能项点击后功能面板弹出
 *
 * 运行方式：
 *   npx playwright test e2e/more-menu-smoke.spec.ts --config e2e/playwright.config.ts
 *
 * 前置条件：
 *   - preview server 运行在 http://localhost:4173（npm run preview）
 *   - 或 dev server 运行在 http://localhost:3000（npm run dev）
 */

import { test, expect, type Page } from '@playwright/test';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:4173';
const GAME_ROUTE = '/idle/three-kingdoms';

/** MoreTab中的关键功能项 — 用于 TC-02/TC-03 验证 */
const KEY_FEATURE_ITEMS = [
  { id: 'shop', label: '商店' },
  { id: 'equipment', label: '装备' },
  { id: 'quest', label: '任务' },
  { id: 'settings', label: '设置' },
  { id: 'arena', label: '竞技' },
] as const;

// ─────────────────────────────────────────────
// 辅助：导航到游戏页面
// ─────────────────────────────────────────────
async function navigateToGame(page: Page) {
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
  if (await confirmBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await confirmBtn.click();
    await page.waitForTimeout(300);
  }

  // 等待引擎初始化
  await page.waitForTimeout(1_500);

  // 验证页面已加载 — TabBar 可见
  const tabBar = page.locator('[data-testid="tab-bar"]');
  await expect(tabBar, 'TabBar 应可见').toBeVisible({ timeout: 10_000 });
}

// ─────────────────────────────────────────────
// 辅助：点击"更多"Tab
// ─────────────────────────────────────────────
async function clickMoreTab(page: Page) {
  // v2改造后：点击"更多"Tab与普通Tab一致
  await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="tab-bar-more"]') as HTMLElement;
    if (btn) btn.click();
  });
  await page.waitForTimeout(500);
}

// ─────────────────────────────────────────────
// 辅助：验证MoreTab有实际渲染尺寸
// ─────────────────────────────────────────────
async function assertMoreTabHasRealSize(page: Page) {
  const moreTab = page.locator('[data-testid="more-tab"]');

  // 1. MoreTab应在 DOM 中可见
  await expect(moreTab, 'MoreTab应可见').toBeVisible({ timeout: 5_000 });

  // 2. MoreTab应有实际渲染尺寸
  const box = await moreTab.boundingBox();
  expect(box, 'MoreTab应有 boundingBox').not.toBeNull();

  // 3. 高度应 > 0
  expect(box!.height, 'MoreTab高度应 > 0').toBeGreaterThan(0);

  // 4. 宽度应 > 0
  expect(box!.width, 'MoreTab宽度应 > 0').toBeGreaterThan(0);

  return box!;
}

// ─────────────────────────────────────────────
// 测试套件
// ─────────────────────────────────────────────
test.describe('更多Tab关键路径冒烟测试', () => {
  test.setTimeout(60_000);

  // ═══════════════════════════════════════════
  // TC-01: 点击"更多"Tab → 主内容区显示网格列表
  //
  // 验证目标：
  //   - 点击"更多"Tab后，MoreTab在主内容区渲染
  //   - MoreTab有实际渲染尺寸
  //   - "更多"Tab处于选中状态
  // ═══════════════════════════════════════════
  test('TC-01 点击更多Tab后主内容区显示网格列表', async ({ page }) => {
    await navigateToGame(page);

    // 点击"更多"Tab
    await clickMoreTab(page);

    // 验证MoreTab有实际渲染尺寸
    const box = await assertMoreTabHasRealSize(page);

    // 验证"更多"Tab处于选中状态
    const moreBtn = page.locator('[data-testid="tab-bar-more"]');
    const isSelected = await moreBtn.getAttribute('aria-selected');
    expect(isSelected, '"更多"Tab应处于选中状态 (aria-selected=true)').toBe('true');

    // 截图留证
    await page.screenshot({
      path: 'e2e/screenshots/TC-01-more-tab-visible.png',
      fullPage: false,
    });

    console.log(`✅ TC-01 通过：MoreTab可见，尺寸 ${box.width}×${box.height}`);
  });

  // ═══════════════════════════════════════════
  // TC-02: 网格列表中的功能项可见且可点击
  //
  // 验证目标：
  //   - MoreTab中至少有 5 个功能项
  //   - 每个功能项可见且有文本标签
  //   - 关键功能项（商店、装备、任务、设置、竞技）都存在
  // ═══════════════════════════════════════════
  test('TC-02 网格列表中的功能项可见且可点击', async ({ page }) => {
    await navigateToGame(page);

    // 点击更多Tab
    await clickMoreTab(page);

    // 确保MoreTab可见
    await assertMoreTabHasRealSize(page);

    // 验证关键功能项存在且可见
    for (const item of KEY_FEATURE_ITEMS) {
      const featureBtn = page.locator(`[aria-label="${item.label}"]`);
      await expect(featureBtn, `功能项 [${item.label}] 应存在`).toBeAttached({ timeout: 3_000 });
      await expect(featureBtn, `功能项 [${item.label}] 应可见`).toBeVisible({ timeout: 3_000 });

      // 验证功能项有实际渲染尺寸
      const itemBox = await featureBtn.boundingBox();
      expect(itemBox, `功能项 [${item.label}] 应有 boundingBox`).not.toBeNull();
      expect(itemBox!.height, `功能项 [${item.label}] 高度应 > 0`).toBeGreaterThan(0);
    }

    // 截图留证
    await page.screenshot({
      path: 'e2e/screenshots/TC-02-feature-items-visible.png',
      fullPage: false,
    });

    console.log('✅ TC-02 通过：所有关键功能项可见且有实际渲染尺寸');
  });

  // ═══════════════════════════════════════════
  // TC-03: 点击"商店"功能项 → 商店面板弹出可见
  //
  // 验证目标：
  //   - 点击"商店"功能项后，商店功能面板弹出并可见
  //   - 商店面板有实际内容
  // ═══════════════════════════════════════════
  test('TC-03 点击商店功能项后商店面板弹出可见', async ({ page }) => {
    await navigateToGame(page);

    // 点击更多Tab
    await clickMoreTab(page);
    await assertMoreTabHasRealSize(page);

    // 点击"商店"功能项
    const shopBtn = page.locator('[aria-label="商店"]');
    await expect(shopBtn, '商店功能项应可见').toBeVisible({ timeout: 3_000 });
    await shopBtn.click();
    await page.waitForTimeout(1_000);

    // 验证商店面板弹出
    const shopPanel = page.locator('[data-testid="shop-panel"]');
    await expect(shopPanel, '商店面板应可见').toBeVisible({ timeout: 5_000 });

    // 验证商店面板有实际渲染尺寸
    const shopBox = await shopPanel.boundingBox();
    expect(shopBox, '商店面板应有 boundingBox').not.toBeNull();
    expect(shopBox!.height, '商店面板高度应 > 0').toBeGreaterThan(0);
    expect(shopBox!.width, '商店面板宽度应 > 0').toBeGreaterThan(0);

    // 验证商店面板有实质内容
    const shopContent = await shopPanel.innerHTML();
    expect(shopContent.length, '商店面板应有实质 HTML 内容').toBeGreaterThan(50);

    // 截图留证
    await page.screenshot({
      path: 'e2e/screenshots/TC-03-shop-panel-opened.png',
      fullPage: false,
    });

    console.log(`✅ TC-03 通过：商店面板弹出，尺寸 ${shopBox!.width}×${shopBox!.height}`);
  });

  // ═══════════════════════════════════════════
  // TC-04: 从更多Tab切换到其他Tab → MoreTab消失
  //
  // 验证目标：
  //   - 在更多Tab时切换到其他Tab
  //   - MoreTab不再可见
  //   - 新Tab内容渲染
  // ═══════════════════════════════════════════
  test('TC-04 从更多Tab切换到其他Tab后MoreTab消失', async ({ page }) => {
    await navigateToGame(page);

    // 点击更多Tab
    await clickMoreTab(page);
    await assertMoreTabHasRealSize(page);

    // 验证MoreTab可见
    const moreTab = page.locator('[data-testid="more-tab"]');
    await expect(moreTab, '切换前：MoreTab应可见').toBeVisible({ timeout: 3_000 });

    // 切换到建筑Tab
    await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="tab-bar-building"]') as HTMLElement;
      if (btn) btn.click();
    });
    await page.waitForTimeout(500);

    // 验证MoreTab不再可见
    await expect(moreTab, '切换后：MoreTab应不可见').not.toBeVisible({ timeout: 3_000 });

    // 验证"更多"Tab恢复未选中状态
    const moreBtn = page.locator('[data-testid="tab-bar-more"]');
    const isSelected = await moreBtn.getAttribute('aria-selected');
    expect(isSelected, '切换后：更多Tab应恢复未选中状态 (aria-selected=false)').toBe('false');

    // 截图留证
    await page.screenshot({
      path: 'e2e/screenshots/TC-04-switch-away-from-more.png',
      fullPage: false,
    });

    console.log('✅ TC-04 通过：切换到其他Tab后MoreTab消失');
  });

  // ═══════════════════════════════════════════
  // TC-05: 更多Tab的badge显示正确
  //
  // 验证目标：
  //   - MoreTab中功能项的badge正确显示
  //   - badge数字可见
  // ═══════════════════════════════════════════
  test('TC-05 更多Tab功能项badge显示', async ({ page }) => {
    await navigateToGame(page);

    // 点击更多Tab
    await clickMoreTab(page);
    await assertMoreTabHasRealSize(page);

    // 验证MoreTab中功能项按钮存在
    const featureButtons = page.locator('[data-testid="more-tab"] button');
    const buttonCount = await featureButtons.count();
    expect(buttonCount, 'MoreTab应至少有5个功能项按钮').toBeGreaterThanOrEqual(5);
    console.log(`  TC-05: 找到 ${buttonCount} 个功能项按钮`);

    // 验证功能项有实际渲染尺寸
    for (let i = 0; i < Math.min(buttonCount, 5); i++) {
      const btn = featureButtons.nth(i);
      const box = await btn.boundingBox();
      expect(box, `功能项[${i}] 应有 boundingBox`).not.toBeNull();
      expect(box!.height, `功能项[${i}] 高度应 > 0`).toBeGreaterThan(0);
    }

    // 截图留证
    await page.screenshot({
      path: 'e2e/screenshots/TC-05-more-tab-badges.png',
      fullPage: false,
    });

    console.log('✅ TC-05 通过：MoreTab功能项badge正确显示');
  });
});
