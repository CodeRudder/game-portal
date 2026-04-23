import { test, expect } from '@playwright/test';

test.describe('白屏防护', () => {
  test('三国霸业主页面非白屏', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    const pageErrors: string[] = [];
    page.on('pageerror', e => pageErrors.push(e.message));

    await page.goto('http://localhost:5173/games/three-kingdoms-pixi', { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(3000);

    // 检查root非空
    const rootContent = await page.evaluate(() => {
      const root = document.getElementById('root');
      return {
        hasChildren: (root?.children?.length ?? 0) > 0,
        textLength: root?.innerText?.length ?? 0,
        htmlLength: root?.innerHTML?.length ?? 0,
      };
    });
    expect(rootContent.hasChildren || rootContent.textLength > 0).toBeTruthy();
    
    // 检查无致命页面错误
    expect(pageErrors.length).toBe(0);
    
    // 检查DOM元素存在
    const buttons = await page.locator('button').count();
    expect(buttons).toBeGreaterThan(0);
  });

  test('首页非白屏', async ({ page }) => {
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 20000 });
    const rootText = await page.evaluate(() => document.getElementById('root')?.innerText?.length ?? 0);
    expect(rootText).toBeGreaterThan(0);
  });

  test('放置游戏专区非白屏', async ({ page }) => {
    await page.goto('http://localhost:5173/idle', { waitUntil: 'networkidle', timeout: 20000 });
    const rootText = await page.evaluate(() => document.getElementById('root')?.innerText?.length ?? 0);
    expect(rootText).toBeGreaterThan(0);
  });
});
