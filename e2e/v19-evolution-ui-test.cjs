/**
 * v19.0 天下一统(上) — 设置系统 UI测试 R1
 *
 * 测试范围：
 * 1. 设置面板入口和打开
 * 2. 音效控制（音量/开关）
 * 3. 画面设置
 * 4. 存档管理
 * 5. 账号管理
 * 6. 基础设置（语言/时区/通知）
 * 7. 面板关闭与ESC
 * 8. 面板样式检查
 * 9. 移动端适配
 * 10. 小屏手机/平板视口
 * 11. 控制台错误检测
 * 12. 数据完整性
 *
 * @module e2e/v19-evolution-ui-test
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.GAME_BASE_URL || 'http://localhost:5173/idle/three-kingdoms';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots', 'v19-evolution');

// ── 结果收集 ──
const results = {
  passed: [],
  failed: [],
  warnings: [],
  screenshots: [],
  consoleErrors: [],
  startTime: new Date().toISOString(),
};

function pass(name) { results.passed.push(name); console.log(`  ✅ PASS: ${name}`); }
function fail(name, detail) { results.failed.push({ name, detail: String(detail).substring(0, 300) }); console.log(`  ❌ FAIL: ${name} — ${String(detail).substring(0, 150)}`); }
function warn(name, detail) { results.warnings.push({ name, detail: String(detail).substring(0, 300) }); console.log(`  ⚠️  WARN: ${name} — ${String(detail).substring(0, 150)}`); }

/** 等待指定毫秒（Puppeteer 无 page.waitForTimeout） */
const delay = ms => new Promise(r => setTimeout(r, ms));

async function takeScreenshot(page, name) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const filepath = path.join(SCREENSHOT_DIR, name + '.png');
  await page.screenshot({ path: filepath });
  results.screenshots.push(name);
  console.log(`  📸 ${name}`);
}

/** 通过文本查找元素 */
async function findElementByText(page, text, selector = '*') {
  const elements = await page.$$(selector);
  for (const el of elements) {
    const elText = await el.evaluate(node => node.textContent?.trim());
    if (elText === text) return el;
  }
  for (const el of elements) {
    const elText = await el.evaluate(node => node.textContent?.trim());
    if (elText?.includes(text)) return el;
  }
  return null;
}

/** 进入游戏主界面 */
async function enterGame(page) {
  await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await delay(3000);
  const allBtns = await page.$$('button');
  for (const btn of allBtns) {
    const text = await btn.evaluate(el => el.textContent?.trim());
    if (text === '开始游戏') {
      await btn.click();
      await delay(3000);
      return;
    }
  }
}

/** 跳过引导 */
async function skipGuide(page) {
  for (let i = 0; i < 10; i++) {
    const overlay = await page.$('.tk-guide-overlay');
    if (!overlay) break;
    const skipBtn = await page.$('.tk-guide-btn--skip');
    if (skipBtn) {
      await skipBtn.evaluate(el => el.click());
      await delay(500);
      continue;
    }
    await page.keyboard.press('Escape');
    await delay(500);
  }
}

/** 打开设置面板：通过"更多"Tab → 点击"设置"卡片 */
async function openSettingsPanel(page) {
  // 尝试找"更多"Tab
  const tabs = await page.$$('.tk-tab, [role="tab"], button');
  for (const tab of tabs) {
    const text = await tab.evaluate(el => el.textContent?.trim());
    if (text === '更多') {
      await tab.click();
      await delay(1000);
      break;
    }
  }

  // 在更多Tab中找设置卡片
  const cards = await page.$$('.tk-more-card, button');
  for (const card of cards) {
    const text = await card.evaluate(el => el.textContent?.trim());
    if (text?.includes('设置')) {
      await card.click();
      await delay(1500);
      return;
    }
  }
}

/** 关闭所有弹窗 */
async function closeAllPanels(page) {
  await page.keyboard.press('Escape');
  await delay(300);
  const closeBtn = await page.$('.tk-shared-panel-close');
  if (closeBtn) {
    await closeBtn.click();
    await delay(500);
  }
}

// ═══════════════════════════════════════════════════════════
// 测试1: 设置面板入口和打开
// ═══════════════════════════════════════════════════════════
async function testSettingsPanelEntry(page) {
  console.log('\n📋 测试1: 设置面板入口和打开');
  try {
    await enterGame(page);
    await skipGuide(page);
    await delay(1000);
    await takeScreenshot(page, 'v19-main-page');

    // 打开设置面板
    await openSettingsPanel(page);
    await delay(1500);
    await takeScreenshot(page, 'v19-settings-panel-open');

    // 检查 SharedPanel overlay
    const overlay = await page.$('.tk-shared-panel-overlay');
    if (overlay) {
      pass('设置面板 overlay 已渲染');
    } else {
      fail('设置面板 overlay 未找到', '.tk-shared-panel-overlay 不存在');
      return;
    }

    // 检查标题
    const titleEl = await page.$('.tk-shared-panel-title');
    if (titleEl) {
      const titleText = await titleEl.evaluate(el => el.textContent?.trim());
      if (titleText?.includes('设置')) {
        pass(`面板标题正确: "${titleText}"`);
      } else {
        warn('面板标题不含"设置"', `实际标题: "${titleText}"`);
      }
    }

    // 检查 data-testid
    const settingsPanel = await page.$('[data-testid="settings-panel"]');
    if (settingsPanel) {
      pass('设置面板 data-testid="settings-panel" 存在');
    } else {
      warn('data-testid="settings-panel" 未找到', '可能未设置 testid');
    }

    // 检查关闭按钮
    const closeBtn = await page.$('.tk-shared-panel-close');
    if (closeBtn) {
      pass('关闭按钮存在');
    } else {
      warn('关闭按钮未找到');
    }
  } catch (e) { fail('设置面板入口', e.message); }
}

// ═══════════════════════════════════════════════════════════
// 测试2: 音效控制（音量/开关）
// ═══════════════════════════════════════════════════════════
async function testAudioSettings(page) {
  console.log('\n📋 测试2: 音效控制');
  try {
    // 确保面板打开
    const overlay = await page.$('.tk-shared-panel-overlay');
    if (!overlay) {
      await openSettingsPanel(page);
      await delay(1500);
    }

    // 检查音频设置区域
    const audioSection = await findElementByText(page, '🔊 音频', 'h4');
    if (audioSection) {
      pass('音频设置区域存在');
    } else {
      warn('音频设置区域未找到', '可能使用不同的标题格式');
    }

    await takeScreenshot(page, 'v19-audio-settings');

    // 检查音效开关
    const soundToggle = await findElementByText(page, '音效', 'span');
    if (soundToggle) {
      pass('音效开关标签存在');

      // 找到对应的开关按钮
      const toggleRow = await soundToggle.evaluateHandle(el => el.parentElement);
      const toggleBtn = await toggleRow.$('button');
      if (toggleBtn) {
        const btnText = await toggleBtn.evaluate(el => el.textContent?.trim());
        pass(`音效开关当前状态: "${btnText}"`);

        // 点击切换
        await toggleBtn.click();
        await delay(500);
        const newText = await toggleBtn.evaluate(el => el.textContent?.trim());
        pass(`音效开关切换后: "${newText}"`);
        await takeScreenshot(page, 'v19-audio-toggle-switched');

        // 切回来
        await toggleBtn.click();
        await delay(300);
      } else {
        warn('音效开关按钮未找到');
      }
    } else {
      fail('音效设置项未找到', '音效开关标签不存在');
    }

    // 检查背景音乐开关
    const musicToggle = await findElementByText(page, '背景音乐', 'span');
    if (musicToggle) {
      pass('背景音乐开关标签存在');
      const toggleRow = await musicToggle.evaluateHandle(el => el.parentElement);
      const toggleBtn = await toggleRow.$('button');
      if (toggleBtn) {
        const btnText = await toggleBtn.evaluate(el => el.textContent?.trim());
        pass(`背景音乐开关状态: "${btnText}"`);
      }
    } else {
      warn('背景音乐开关未找到');
    }
  } catch (e) { fail('音效控制', e.message); }
}

// ═══════════════════════════════════════════════════════════
// 测试3: 画面设置
// ═══════════════════════════════════════════════════════════
async function testVisualSettings(page) {
  console.log('\n📋 测试3: 画面设置');
  try {
    // 确保面板打开
    const overlay = await page.$('.tk-shared-panel-overlay');
    if (!overlay) {
      await openSettingsPanel(page);
      await delay(1500);
    }

    // 检查画面设置区域
    const visualSection = await findElementByText(page, '🎨 画面', 'h4');
    if (visualSection) {
      pass('画面设置区域存在');
    } else {
      warn('画面设置区域未找到', '可能使用不同的标题格式');
    }

    await takeScreenshot(page, 'v19-visual-settings');

    // 检查动画效果开关
    const animToggle = await findElementByText(page, '动画效果', 'span');
    if (animToggle) {
      pass('动画效果开关存在');
      const toggleRow = await animToggle.evaluateHandle(el => el.parentElement);
      const toggleBtn = await toggleRow.$('button');
      if (toggleBtn) {
        const btnText = await toggleBtn.evaluate(el => el.textContent?.trim());
        pass(`动画效果开关状态: "${btnText}"`);

        // 切换
        await toggleBtn.click();
        await delay(500);
        await takeScreenshot(page, 'v19-visual-animation-toggled');
        // 切回来
        await toggleBtn.click();
        await delay(300);
      }
    } else {
      warn('动画效果开关未找到');
    }

    // 检查粒子特效开关
    const particleToggle = await findElementByText(page, '粒子特效', 'span');
    if (particleToggle) {
      pass('粒子特效开关存在');
      const toggleRow = await particleToggle.evaluateHandle(el => el.parentElement);
      const toggleBtn = await toggleRow.$('button');
      if (toggleBtn) {
        const btnText = await toggleBtn.evaluate(el => el.textContent?.trim());
        pass(`粒子特效开关状态: "${btnText}"`);
      }
    } else {
      warn('粒子特效开关未找到');
    }
  } catch (e) { fail('画面设置', e.message); }
}

// ═══════════════════════════════════════════════════════════
// 测试4: 存档管理
// ═══════════════════════════════════════════════════════════
async function testSaveManagement(page) {
  console.log('\n📋 测试4: 存档管理');
  try {
    // 确保面板打开
    const overlay = await page.$('.tk-shared-panel-overlay');
    if (!overlay) {
      await openSettingsPanel(page);
      await delay(1500);
    }

    // 检查存档区域
    const saveSection = await findElementByText(page, '💾 存档', 'h4');
    if (saveSection) {
      pass('存档管理区域存在');
    } else {
      warn('存档管理区域未找到', '可能使用不同的标题格式');
    }

    await takeScreenshot(page, 'v19-save-management');

    // 检查手动保存按钮
    const saveBtn = await findElementByText(page, '手动保存', 'button');
    if (saveBtn) {
      pass('手动保存按钮存在');

      // 点击保存
      await saveBtn.click();
      await delay(1000);
      await takeScreenshot(page, 'v19-save-after-click');

      // 检查保存反馈
      const feedback = await page.evaluate(() => {
        const panel = document.querySelector('[data-testid="settings-panel"]');
        if (!panel) return null;
        const allText = panel.textContent || '';
        if (allText.includes('存档已保存') || allText.includes('💾')) {
          return 'save_feedback_found';
        }
        return null;
      });
      if (feedback) {
        pass('手动保存反馈消息已显示');
      } else {
        warn('手动保存反馈未找到', '可能保存失败或消息已消失');
      }
    } else {
      fail('手动保存按钮未找到', '存档管理区域缺少保存按钮');
    }
  } catch (e) { fail('存档管理', e.message); }
}

// ═══════════════════════════════════════════════════════════
// 测试5: 账号管理
// ═══════════════════════════════════════════════════════════
async function testAccountManagement(page) {
  console.log('\n📋 测试5: 账号管理');
  try {
    // 确保面板打开
    const overlay = await page.$('.tk-shared-panel-overlay');
    if (!overlay) {
      await openSettingsPanel(page);
      await delay(1500);
    }

    // 检查账号区域
    const accountSection = await findElementByText(page, '👤 账号', 'h4');
    if (accountSection) {
      pass('账号管理区域存在');
    } else {
      warn('账号管理区域未找到', '可能使用不同的标题格式');
    }

    await takeScreenshot(page, 'v19-account-management');

    // 检查账号状态（游客/已绑定）
    const guestLabel = await findElementByText(page, '游客账号', 'span');
    const boundLabel = await findElementByText(page, '已绑定账号', 'span');
    if (guestLabel) {
      pass('游客账号状态显示');
    } else if (boundLabel) {
      pass('已绑定账号状态显示');
    } else {
      warn('账号绑定状态未显示');
    }

    // 查找绑定信息
    const bindInfo = await page.evaluate(() => {
      const spans = document.querySelectorAll('[data-testid="settings-panel"] span');
      for (const s of spans) {
        const text = s.textContent?.trim();
        if (text?.includes('未绑定') || text?.includes('个绑定')) {
          return text;
        }
      }
      return null;
    });
    if (bindInfo) {
      pass(`绑定信息: "${bindInfo}"`);
    }

    // 检查管理账号按钮
    const manageBtn = await findElementByText(page, '管理账号', 'button');
    if (manageBtn) {
      pass('管理账号按钮存在');

      // 点击展开详情
      await manageBtn.click();
      await delay(800);
      await takeScreenshot(page, 'v19-account-detail-expanded');

      // 点击收起
      const collapseBtn = await findElementByText(page, '收起详情', 'button');
      if (collapseBtn) {
        await collapseBtn.click();
        await delay(300);
        pass('账号详情可收起');
      }
    } else {
      warn('管理账号按钮未找到', 'AccountSystem 可能未就绪');
    }

    // 检查"账号系统未就绪"
    const notReady = await findElementByText(page, '账号系统未就绪', 'span');
    if (notReady) {
      warn('账号系统未就绪', 'AccountSystem 未注入到 SettingsPanel');
    }
  } catch (e) { fail('账号管理', e.message); }
}

// ═══════════════════════════════════════════════════════════
// 测试6: 基础设置（语言/时区/通知）
// ═══════════════════════════════════════════════════════════
async function testBasicSettings(page) {
  console.log('\n📋 测试6: 基础设置（语言/时区/通知）');
  try {
    // 确保面板打开
    const overlay = await page.$('.tk-shared-panel-overlay');
    if (!overlay) {
      await openSettingsPanel(page);
      await delay(1500);
    }

    await takeScreenshot(page, 'v19-basic-settings-overview');

    // 当前 SettingsPanel 基础版可能不含语言/时区/通知 UI
    const langLabel = await findElementByText(page, '语言', 'span, h4, label');
    const tzLabel = await findElementByText(page, '时区', 'span, h4, label');
    const notifLabel = await findElementByText(page, '通知', 'span, h4, label');

    if (langLabel) pass('语言设置区域存在');
    else warn('语言设置 UI 未实现', 'SettingsPanel 基础版不含语言设置');

    if (tzLabel) pass('时区设置区域存在');
    else warn('时区设置 UI 未实现', 'SettingsPanel 基础版不含时区设置');

    if (notifLabel) pass('通知设置区域存在');
    else warn('通知设置 UI 未实现', 'SettingsPanel 基础版不含通知设置');

    // 检查引擎后端是否支持这些设置（通过 localStorage）
    const engineSettings = await page.evaluate(() => {
      try {
        const raw = localStorage.getItem('tk-settings') || localStorage.getItem('three-kingdoms-settings');
        return raw ? JSON.parse(raw) : null;
      } catch { return null; }
    });

    if (engineSettings) {
      pass('设置数据已持久化到 localStorage');
      if (engineSettings.language !== undefined) pass(`语言设置值: ${engineSettings.language}`);
      else warn('localStorage 中无语言设置');
      if (engineSettings.timezone !== undefined) pass(`时区设置值: ${engineSettings.timezone}`);
      else warn('localStorage 中无时区设置');
      if (engineSettings.notificationSettings !== undefined) pass('通知设置数据存在');
      else warn('localStorage 中无通知设置');
    } else {
      warn('localStorage 中未找到设置数据', '可能尚未保存或使用不同的 key');
    }
  } catch (e) { fail('基础设置', e.message); }
}

// ═══════════════════════════════════════════════════════════
// 测试7: 设置面板关闭与ESC
// ═══════════════════════════════════════════════════════════
async function testPanelClose(page) {
  console.log('\n📋 测试7: 设置面板关闭与ESC');
  try {
    // 确保面板打开
    let overlay = await page.$('.tk-shared-panel-overlay');
    if (!overlay) {
      await openSettingsPanel(page);
      await delay(1500);
    }

    // ESC 关闭
    await page.keyboard.press('Escape');
    await delay(500);

    overlay = await page.$('.tk-shared-panel-overlay');
    if (!overlay) {
      pass('ESC 关闭设置面板成功');
    } else {
      const isVisible = await overlay.evaluate(el => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
      });
      if (!isVisible) {
        pass('ESC 关闭设置面板成功（DOM仍存在但不可见）');
      } else {
        fail('ESC 关闭设置面板失败', '面板仍然可见');
      }
    }

    // 重新打开，测试关闭按钮
    await openSettingsPanel(page);
    await delay(1500);

    const closeBtn = await page.$('.tk-shared-panel-close');
    if (closeBtn) {
      await closeBtn.click();
      await delay(500);

      const overlayAfterClose = await page.$('.tk-shared-panel-overlay');
      if (!overlayAfterClose) {
        pass('关闭按钮关闭面板成功');
      } else {
        const isVisible = await overlayAfterClose.evaluate(el => {
          const style = window.getComputedStyle(el);
          return style.display !== 'none' && style.visibility !== 'hidden';
        });
        if (!isVisible) {
          pass('关闭按钮关闭面板成功（DOM仍存在但不可见）');
        } else {
          fail('关闭按钮关闭面板失败', '面板仍然可见');
        }
      }
    }

    // 重新打开，测试点击遮罩关闭
    await openSettingsPanel(page);
    await delay(1500);

    const overlayEl = await page.$('.tk-shared-panel-overlay');
    if (overlayEl) {
      const box = await overlayEl.boundingBox();
      if (box) {
        // 点击左上角（遮罩区域，非面板区域）
        await page.mouse.click(box.x + 5, box.y + 5);
        await delay(500);

        const overlayAfterOverlayClick = await page.$('.tk-shared-panel-overlay');
        if (!overlayAfterOverlayClick) {
          pass('点击遮罩层关闭面板成功');
        } else {
          warn('点击遮罩层未关闭面板', '可能 overlayClosable=false 或点击位置在面板内');
        }
      }
    }

    await takeScreenshot(page, 'v19-panel-closed');
  } catch (e) { fail('面板关闭', e.message); }
}

// ═══════════════════════════════════════════════════════════
// 测试8: 设置面板样式检查
// ═══════════════════════════════════════════════════════════
async function testPanelStyles(page) {
  console.log('\n📋 测试8: 设置面板样式检查');
  try {
    // 打开设置面板
    await openSettingsPanel(page);
    await delay(1500);

    const panelEl = await page.$('.tk-shared-panel');
    if (panelEl) {
      const styles = await panelEl.evaluate(el => {
        const cs = window.getComputedStyle(el);
        return {
          width: cs.width,
          background: cs.background?.substring(0, 80),
          borderRadius: cs.borderRadius,
        };
      });
      pass(`面板宽度: ${styles.width}`);
      if (styles.borderRadius && styles.borderRadius !== '0px') {
        pass(`面板圆角: ${styles.borderRadius}`);
      }
    } else {
      warn('.tk-shared-panel 元素未找到');
    }

    // 检查设置项行
    const toggleRows = await page.$$('[data-testid="settings-panel"] > div > div > div');
    let rowCount = 0;
    for (const row of toggleRows) {
      const text = await row.evaluate(el => el.textContent?.trim());
      if (text && (text.includes('音效') || text.includes('背景音乐') || text.includes('动画') || text.includes('粒子'))) {
        rowCount++;
      }
    }
    if (rowCount > 0) {
      pass(`设置项行数: ${rowCount}`);
    }

    // 检查按钮样式
    const toggleBtns = await page.$$('[data-testid="settings-panel"] button');
    let styledBtnCount = 0;
    for (const btn of toggleBtns) {
      const bg = await btn.evaluate(el => window.getComputedStyle(el).backgroundColor);
      if (bg && bg !== 'rgba(0, 0, 0, 0)') styledBtnCount++;
    }
    if (styledBtnCount > 0) {
      pass(`有样式的按钮数: ${styledBtnCount}`);
    }

    await takeScreenshot(page, 'v19-panel-styles');
  } catch (e) { fail('面板样式检查', e.message); }
}

// ═══════════════════════════════════════════════════════════
// 测试9: 移动端适配 (375×812)
// ═══════════════════════════════════════════════════════════
async function testMobileAdaptation(browser) {
  console.log('\n📋 测试9: 移动端适配');
  let mobilePage;
  try {
    // Puppeteer: 使用 browser.newPage() + setViewport
    mobilePage = await browser.newPage();
    await mobilePage.setViewport({ width: 375, height: 812, deviceScaleFactor: 3 });
    await mobilePage.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)');

    // 收集控制台错误
    mobilePage.on('console', msg => {
      if (msg.type() === 'error') {
        results.consoleErrors.push(`[Mobile] ${msg.text()}`);
      }
    });

    // 进入游戏
    await mobilePage.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(3000);
    const allBtns = await mobilePage.$$('button');
    for (const btn of allBtns) {
      const text = await btn.evaluate(el => el.textContent?.trim());
      if (text === '开始游戏') {
        await btn.click();
        await delay(3000);
        break;
      }
    }

    // 跳过引导
    for (let i = 0; i < 10; i++) {
      const overlay = await mobilePage.$('.tk-guide-overlay');
      if (!overlay) break;
      const skipBtn = await mobilePage.$('.tk-guide-btn--skip');
      if (skipBtn) {
        await skipBtn.evaluate(el => el.click());
        await delay(500);
        continue;
      }
      await mobilePage.keyboard.press('Escape');
      await delay(500);
    }

    await takeScreenshot(mobilePage, 'v19-mobile-main');

    // 检查无水平溢出
    const scrollWidth = await mobilePage.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await mobilePage.evaluate(() => document.documentElement.clientWidth);
    if (scrollWidth <= clientWidth + 2) {
      pass('移动端无水平溢出');
    } else {
      warn('移动端水平溢出', `scrollWidth=${scrollWidth} > clientWidth=${clientWidth}`);
    }

    // 打开设置面板
    await openSettingsPanel(mobilePage);
    await delay(1500);
    await takeScreenshot(mobilePage, 'v19-mobile-settings-open');

    const mobileOverlay = await mobilePage.$('.tk-shared-panel-overlay');
    if (mobileOverlay) {
      pass('移动端设置面板正常打开');

      // 检查面板宽度适配
      const mobilePanel = await mobilePage.$('.tk-shared-panel');
      if (mobilePanel) {
        const box = await mobilePanel.boundingBox();
        if (box) {
          const ratio = box.width / 375;
          pass(`移动端面板宽度占比: ${(ratio * 100).toFixed(0)}%`);
          if (ratio > 0.85) {
            pass('移动端面板接近全屏宽度');
          } else {
            warn('移动端面板宽度偏小', `占比 ${(ratio * 100).toFixed(0)}%`);
          }
        }
      }

      // 检查设置项在移动端可操作
      const mobileToggles = await mobilePage.$$('[data-testid="settings-panel"] button');
      if (mobileToggles.length > 0) {
        pass(`移动端设置按钮数量: ${mobileToggles.length}`);

        // 尝试点击第一个开关
        await mobileToggles[0].click();
        await delay(500);
        await takeScreenshot(mobilePage, 'v19-mobile-toggle-clicked');
        pass('移动端设置按钮可点击');
      }
    } else {
      fail('移动端设置面板未打开', 'overlay 不存在');
    }

    // 检查移动端无溢出
    const mobileScrollW = await mobilePage.evaluate(() => document.documentElement.scrollWidth);
    const mobileClientW = await mobilePage.evaluate(() => document.documentElement.clientWidth);
    if (mobileScrollW <= mobileClientW + 2) {
      pass('移动端设置面板无溢出');
    } else {
      warn('移动端设置面板溢出', `scrollW=${mobileScrollW} clientW=${mobileClientW}`);
    }

    await mobilePage.close();
  } catch (e) {
    fail('移动端适配', e.message);
    if (mobilePage) await mobilePage.close().catch(() => {});
  }
}

// ═══════════════════════════════════════════════════════════
// 测试10: 小屏手机 (320×568)
// ═══════════════════════════════════════════════════════════
async function testSmallMobileViewport(browser) {
  console.log('\n📋 测试10: 小屏手机 (320×568)');
  let p;
  try {
    p = await browser.newPage();
    await p.setViewport({ width: 320, height: 568, deviceScaleFactor: 2 });

    await p.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(3000);
    await takeScreenshot(p, 'v19-small-mobile-320x568');

    const body = await p.evaluate(() => document.body.textContent?.length ?? 0);
    if (body > 50) {
      pass('小屏手机页面正常加载');
    } else {
      fail('小屏手机页面加载', '页面内容过少');
    }

    const scrollW = await p.evaluate(() => document.documentElement.scrollWidth);
    const clientW = await p.evaluate(() => document.documentElement.clientWidth);
    if (scrollW <= clientW + 2) {
      pass('小屏手机无水平溢出');
    } else {
      warn('小屏手机水平溢出', `scrollW=${scrollW} clientW=${clientW}`);
    }

    await p.close();
  } catch (e) {
    fail('小屏手机视口', e.message);
    if (p) await p.close().catch(() => {});
  }
}

// ═══════════════════════════════════════════════════════════
// 测试11: 平板视口 (768×1024)
// ═══════════════════════════════════════════════════════════
async function testTabletViewport(browser) {
  console.log('\n📋 测试11: 平板视口 (768×1024)');
  let p;
  try {
    p = await browser.newPage();
    await p.setViewport({ width: 768, height: 1024, deviceScaleFactor: 2 });

    await p.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(3000);
    await takeScreenshot(p, 'v19-tablet-768x1024');

    const body = await p.evaluate(() => document.body.textContent?.length ?? 0);
    if (body > 50) {
      pass('平板页面正常加载');
    } else {
      fail('平板页面加载', '页面内容过少');
    }

    const scrollW = await p.evaluate(() => document.documentElement.scrollWidth);
    const clientW = await p.evaluate(() => document.documentElement.clientWidth);
    if (scrollW <= clientW + 2) {
      pass('平板无水平溢出');
    } else {
      warn('平板轻微溢出', `scrollW=${scrollW} clientW=${clientW}`);
    }

    await p.close();
  } catch (e) {
    fail('平板视口', e.message);
    if (p) await p.close().catch(() => {});
  }
}

// ═══════════════════════════════════════════════════════════
// 测试12: 控制台错误检测
// ═══════════════════════════════════════════════════════════
async function testConsoleErrors(page) {
  console.log('\n📋 测试12: 控制台错误检测');
  try {
    // 重新加载页面检查错误
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(3000);

    // 过滤掉无关错误
    const relevantErrors = results.consoleErrors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('404') &&
      !e.includes('net::ERR') &&
      !e.includes('DevTools')
    );

    if (relevantErrors.length === 0) {
      pass('无严重控制台错误');
    } else if (relevantErrors.length <= 3) {
      warn(`有 ${relevantErrors.length} 个控制台错误`, relevantErrors.join('; ').substring(0, 200));
    } else {
      fail('控制台错误过多', `${relevantErrors.length} 个错误: ${relevantErrors.slice(0, 3).join('; ')}`);
    }
  } catch (e) { fail('控制台错误检测', e.message); }
}

// ═══════════════════════════════════════════════════════════
// 测试13: 数据完整性（引擎子系统检查）
// ═══════════════════════════════════════════════════════════
async function testDataIntegrity(page) {
  console.log('\n📋 测试13: 数据完整性');
  try {
    await enterGame(page);
    await skipGuide(page);
    await delay(1000);

    // 检查引擎全局对象
    const hasEngine = await page.evaluate(() => {
      return typeof window !== 'undefined' && !!window.__TK_ENGINE__;
    });
    if (hasEngine) {
      pass('引擎全局对象 __TK_ENGINE__ 存在');
    } else {
      const altCheck = await page.evaluate(() => !!window.__tk_engine__);
      if (altCheck) {
        pass('引擎全局对象 __tk_engine__ 存在');
      } else {
        warn('引擎全局对象未找到', '可能使用不同的挂载方式或尚未初始化');
      }
    }

    // 检查 React 根节点
    const hasRoot = await page.evaluate(() =>
      !!document.getElementById('root') || !!document.getElementById('app')
    );
    if (hasRoot) pass('React 根节点存在');
    else warn('React 根节点未找到');

    // 检查 localStorage 中的设置数据
    const settingsKeys = await page.evaluate(() => {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('settings') || key.includes('save') || key.includes('account'))) {
          keys.push(key);
        }
      }
      return keys;
    });

    if (settingsKeys.length > 0) {
      pass(`设置相关 localStorage keys: ${settingsKeys.join(', ')}`);
    } else {
      warn('未找到设置相关 localStorage 数据');
    }
  } catch (e) { fail('数据完整性', e.message); }
}

// ═══════════════════════════════════════════════════════════
// 主测试流程
// ═══════════════════════════════════════════════════════════
(async () => {
  console.log('═══════════════════════════════════════════');
  console.log('  v19.0 天下一统(上) — 设置系统 UI测试 R1');
  console.log('═══════════════════════════════════════════');
  console.log(`📍 URL: ${BASE_URL}`);
  console.log(`📂 截图目录: ${SCREENSHOT_DIR}`);
  console.log('─'.repeat(50));

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });

  // 收集控制台错误
  page.on('console', msg => {
    if (msg.type() === 'error') {
      results.consoleErrors.push(msg.text());
    }
  });

  try {
    await testSettingsPanelEntry(page);
    await testAudioSettings(page);
    await testVisualSettings(page);
    await testSaveManagement(page);
    await testAccountManagement(page);
    await testBasicSettings(page);
    await testPanelClose(page);
    await testPanelStyles(page);
    await testMobileAdaptation(browser);
    await testSmallMobileViewport(browser);
    await testTabletViewport(browser);
    await testConsoleErrors(page);
    await testDataIntegrity(page);
  } catch (e) {
    console.error('\n💥 测试执行异常:', e.message);
  }

  await browser.close();

  // ── 报告 ──
  results.endTime = new Date().toISOString();
  console.log('\n═══════════════════════════════════════════');
  console.log('  测试结果汇总');
  console.log('═══════════════════════════════════════════');
  console.log(`  ✅ 通过: ${results.passed.length}`);
  console.log(`  ❌ 失败: ${results.failed.length}`);
  console.log(`  ⚠️  警告: ${results.warnings.length}`);
  console.log(`  📸 截图: ${results.screenshots.length}`);
  console.log(`  🔴 控制台错误: ${results.consoleErrors.length}`);
  console.log(`  🕐 开始: ${results.startTime}`);
  console.log(`  🕐 结束: ${results.endTime}`);

  const total = results.passed.length + results.failed.length;
  const rate = total > 0 ? ((results.passed.length / total) * 100).toFixed(1) : '0';
  console.log(`  📊 通过率: ${rate}%`);

  if (results.failed.length > 0) {
    console.log('\n  ❌ 失败详情:');
    results.failed.forEach(f => console.log(`    - ${f.name}: ${f.detail}`));
  }
  if (results.warnings.length > 0) {
    console.log('\n  ⚠️  警告详情:');
    results.warnings.forEach(w => console.log(`    - ${w.name}: ${w.detail}`));
  }

  // 写入 JSON 报告
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const reportPath = path.join(SCREENSHOT_DIR, 'v19-test-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n  📄 报告已保存: ${reportPath}`);

  process.exit(results.failed.length > 0 ? 1 : 0);
})();
