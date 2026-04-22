/**
 * 三国霸业游戏 — 可复用UI测试操作库
 * 
 * 使用方式：
 *   const { initBrowser, enterGame, switchTab, openBuildingModal, closeAllModals, takeScreenshot } = require('./utils/game-actions');
 *   const { page, browser, context } = await initBrowser({ headless: true });
 *   await enterGame(page);
 *   await switchTab(page, '建筑');
 *   // ... 操作
 *   await browser.close();
 */

const { chromium } = require('playwright');
const path = require('path');

// TOOL-01: BASE_URL 支持环境变量配置，默认5173端口
const BASE_URL = process.env.GAME_BASE_URL || 'http://localhost:5173/idle/three-kingdoms';
const SCREENSHOT_DIR = path.join(__dirname, '../../screenshots');

/**
 * 初始化浏览器实例
 * @param {Object} opts
 * @param {boolean} opts.headless - 是否无头模式（默认true）
 * @param {number} opts.width - 视口宽度（默认1280）
 * @param {number} opts.height - 视口高度（默认720）
 * @returns {Promise<{page, browser, context}>}
 */
async function initBrowser(opts = {}) {
  const { headless = true, width = 1280, height = 720 } = opts;
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  
  // 收集控制台错误
  page._errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') page._errors.push(msg.text());
  });
  page.on('pageerror', err => page._errors.push('PAGEERROR: ' + err.message));
  
  return { page, browser, context };
}

/**
 * 进入游戏主界面（打开页面 → 关闭欢迎弹窗 → 显示主界面）
 * @param {import('playwright').Page} page
 */
async function enterGame(page) {
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  // 关闭欢迎弹窗/点击开始游戏
  const startBtn = await page.$('button:has-text("开始游戏")');
  if (startBtn) {
    await startBtn.click();
    await page.waitForTimeout(3000);
  }
}

/**
 * 切换Tab
 * TOOL-03: 切换前先关闭所有弹窗，避免遮挡导致点击失败
 * @param {import('playwright').Page} page
 * @param {string} tabName - Tab名称（如"建筑"、"武将"等）
 */
async function switchTab(page, tabName) {
  // 先关闭可能遮挡的弹窗
  await closeAllModals(page);
  
  const tab = await page.$('button:has-text("' + tabName + '")');
  if (!tab) throw new Error('Tab未找到: ' + tabName);
  await tab.click();
  await page.waitForTimeout(1500);
}

/**
 * 打开建筑升级弹窗
 * TOOL-02: 更新选择器匹配实际DOM（tk-bld-pin / tk-bld-list-item）
 * @param {import('playwright').Page} page
 * @param {number} index - 建筑索引（默认0=主城）
 */
async function openBuildingModal(page, index = 0) {
  // PC端地图模式选择器
  let bldPins = await page.$$('[class*="tk-bld-pin"]:not([class*="tk-bld-pin--locked"])');
  // 手机端列表模式兜底
  if (bldPins.length === 0) {
    bldPins = await page.$$('[class*="tk-bld-list-item"]:not([class*="tk-bld-list-item--locked"])');
  }
  if (!bldPins[index]) throw new Error('建筑索引' + index + '不存在（共' + bldPins.length + '个可点击建筑）');
  await bldPins[index].click();
  await page.waitForTimeout(1000);
}

/**
 * 关闭所有弹窗
 * @param {import('playwright').Page} page
 */
async function closeAllModals(page) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  // 检查是否还有弹窗
  const modal = await page.$('[class*="shared-panel"][class*="open"], [class*="modal"][class*="open"]');
  if (modal) {
    const closeBtn = await page.$('[class*="shared-panel"] [class*="close"], [class*="modal"] [class*="close"]');
    if (closeBtn) await closeBtn.click();
    await page.waitForTimeout(500);
  }
}

/**
 * 截图
 * @param {import('playwright').Page} page
 * @param {string} name - 截图名称
 */
async function takeScreenshot(page, name) {
  const fs = require('fs');
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const filepath = path.join(SCREENSHOT_DIR, name + '.png');
  await page.screenshot({ path: filepath });
  return filepath;
}

/**
 * 检查页面数据完整性（无NaN/undefined/null）
 * @param {import('playwright').Page} page
 * @returns {{hasNaN: boolean, hasUndefined: boolean, issues: string[]}}
 */
async function checkDataIntegrity(page) {
  const text = await page.textContent('body');
  const issues = [];
  if (text.includes('NaN')) issues.push('页面显示NaN');
  if (text.includes('undefined')) issues.push('页面显示undefined');
  return { hasNaN: text.includes('NaN'), hasUndefined: text.includes('undefined'), issues };
}

/**
 * 检查布局位置
 * TOOL-04: 安全获取 viewportSize，处理 null 返回
 * @param {import('playwright').Page} page
 * @returns {{resourceBarY: number, tabBarBottom: number, viewportHeight: number}}
 */
async function checkLayout(page) {
  const resourceBar = await page.$('[class*="resource"], [class*="ResourceBar"]');
  const tabBar = await page.$('[class*="tk-tab-bar"], [class*="tab-bar"]');
  const vp = page.viewportSize() || { width: 1280, height: 720 };
  
  const result = { resourceBarY: -1, tabBarBottom: -1, viewportHeight: vp.height };
  if (resourceBar) {
    const box = await resourceBar.boundingBox();
    if (box) result.resourceBarY = box.y;
  }
  if (tabBar) {
    const box = await tabBar.boundingBox();
    if (box) result.tabBarBottom = box.y + box.height;
  }
  return result;
}

/**
 * 切换到移动端视口
 * @param {import('playwright').Page} page
 */
async function switchToMobile(page) {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForTimeout(2000);
}

/**
 * 切换到PC端视口
 * @param {import('playwright').Page} page
 */
async function switchToPC(page) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(2000);
}

/**
 * 获取控制台错误列表
 * @param {import('playwright').Page} page
 * @returns {string[]}
 */
function getConsoleErrors(page) {
  return page._errors || [];
}

/**
 * 清空控制台错误列表
 * @param {import('playwright').Page} page
 */
function clearConsoleErrors(page) {
  if (page._errors) page._errors.length = 0;
}

// TOOL-05: 实际的 localStorage 保存key（与 src/games/three-kingdoms/shared/constants.ts 保持一致）
const SAVE_KEY = 'three-kingdoms-save';

/**
 * 检查存档数据是否存在
 * @param {import('playwright').Page} page
 * @returns {Promise<{exists: boolean, data: object|null, raw: string|null}>}
 */
async function checkSaveData(page) {
  const raw = await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY);
  if (!raw) return { exists: false, data: null, raw: null };
  try {
    return { exists: true, data: JSON.parse(raw), raw };
  } catch {
    return { exists: true, data: null, raw };
  }
}

module.exports = {
  initBrowser, enterGame, switchTab, openBuildingModal, closeAllModals,
  takeScreenshot, checkDataIntegrity, checkLayout, switchToMobile, switchToPC,
  getConsoleErrors, clearConsoleErrors, checkSaveData,
  BASE_URL, SCREENSHOT_DIR, SAVE_KEY
};
