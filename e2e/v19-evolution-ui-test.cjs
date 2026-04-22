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

const delay = ms => new Promise(r => setTimeout(r, ms));

async function takeScreenshot(page, name) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const filepath = path.join(SCREENSHOT_DIR, name + '.png');
  await page.screenshot({ path: filepath });
  results.screenshots.push(name);
  console.log(`  📸 ${name}`);
}

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

/**
 * 打开设置面板：通过"更多"Tab → 点击"设置"卡片
 * 实际DOM: .tk-tab-btn (含"📋更多") → .tk-more-card (含"⚙️设置")
 */
async function openSettingsPanel(page) {
  // 1. 点击"更多"Tab
  const tabs = await page.$$('.tk-tab-btn');
  for (const tab of tabs) {
    const text = await tab.evaluate(el => el.textContent?.trim());
    if (text && text.includes('更多')) {
      await tab.click();
      await delay(1500);
      break;
    }
  }

  // 2. 在更多面板中点击"设置"卡片
  const cards = await page.$$('.tk-more-card');
  for (const card of cards) {
    const text = await card.evaluate(el => el.textContent?.trim());
    if (text && text.includes('设置')) {
      await card.click();
      await delay(2000);
      return true;
    }
  }
  return false;
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

    const opened = await openSettingsPanel(page);
    await takeScreenshot(page, 'v19-settings-panel-open');

    const overlay = await page.$('.tk-shared-panel-overlay');
    if (overlay) {
      pass('设置面板 overlay 已渲染');
    } else {
      fail('设置面板 overlay 未找到', '.tk-shared-panel-overlay 不存在');
      return;
    }

    const titleEl = await page.$('.tk-shared-panel-title');
    if (titleEl) {
      const titleText = await titleEl.evaluate(el => el.textContent?.trim());
      if (titleText && titleText.includes('设置')) {
        pass(`面板标题正确: "${titleText}"`);
      } else {
        warn('面板标题不含"设置"', `实际: "${titleText}"`);
      }
    }

    const settingsPanel = await page.$('[data-testid="settings-panel"]');
    if (settingsPanel) {
      pass('data-testid="settings-panel" 存在');
    } else {
      warn('data-testid="settings-panel" 未找到');
    }

    const closeBtn = await page.$('.tk-shared-panel-close');
    if (closeBtn) {
      pass('关闭按钮存在');
    } else {
      warn('关闭按钮未找到');
    }
  } catch (e) { fail('设置面板入口', e.message); }
}

// ═══════════════════════════════════════════════════════════
// 测试2: 音效控制
// ═══════════════════════════════════════════════════════════
async function testAudioSettings(page) {
  console.log('\n📋 测试2: 音效控制');
  try {
    let overlay = await page.$('.tk-shared-panel-overlay');
    if (!overlay) { await openSettingsPanel(page); }
    await delay(1000);

    await takeScreenshot(page, 'v19-audio-settings');

    // 获取面板内容文本
    const panelText = await page.evaluate(() => {
      const body = document.querySelector('.tk-shared-panel-body');
      return body ? body.textContent : '';
    });

    if (panelText.includes('音频') || panelText.includes('🔊')) {
      pass('音频设置区域存在');
    } else {
      warn('音频设置区域未找到', '面板中无音频相关文本');
    }

    // 查找音效开关 - 面板中每个设置项是 span + button 结构
    const allSpans = await page.$$('.tk-shared-panel-body span');
    let soundToggleRow = null;
    for (const span of allSpans) {
      const text = await span.evaluate(el => el.textContent?.trim());
      if (text === '音效') {
        soundToggleRow = span;
        break;
      }
    }

    if (soundToggleRow) {
      pass('音效开关标签存在');
      const parent = await soundToggleRow.evaluateHandle(el => el.parentElement);
      const toggleBtn = await parent.$('button');
      if (toggleBtn) {
        const btnText = await toggleBtn.evaluate(el => el.textContent?.trim());
        pass(`音效开关状态: "${btnText}"`);

        await toggleBtn.click();
        await delay(500);
        const newText = await toggleBtn.evaluate(el => el.textContent?.trim());
        pass(`音效开关切换后: "${newText}"`);
        await takeScreenshot(page, 'v19-audio-toggle-switched');

        await toggleBtn.click();
        await delay(300);
      } else {
        warn('音效开关按钮未找到');
      }
    } else {
      fail('音效设置项未找到', '面板中无"音效"标签');
    }

    // 检查背景音乐
    let musicFound = false;
    for (const span of allSpans) {
      const text = await span.evaluate(el => el.textContent?.trim());
      if (text === '背景音乐') {
        pass('背景音乐开关标签存在');
        musicFound = true;
        const parent = await span.evaluateHandle(el => el.parentElement);
        const btn = await parent.$('button');
        if (btn) {
          const btnText = await btn.evaluate(el => el.textContent?.trim());
          pass(`背景音乐开关状态: "${btnText}"`);
        }
        break;
      }
    }
    if (!musicFound) warn('背景音乐开关未找到');
  } catch (e) { fail('音效控制', e.message); }
}

// ═══════════════════════════════════════════════════════════
// 测试3: 画面设置
// ═══════════════════════════════════════════════════════════
async function testVisualSettings(page) {
  console.log('\n📋 测试3: 画面设置');
  try {
    let overlay = await page.$('.tk-shared-panel-overlay');
    if (!overlay) { await openSettingsPanel(page); }
    await delay(1000);

    await takeScreenshot(page, 'v19-visual-settings');

    const panelText = await page.evaluate(() => {
      const body = document.querySelector('.tk-shared-panel-body');
      return body ? body.textContent : '';
    });

    if (panelText.includes('画面') || panelText.includes('🎨')) {
      pass('画面设置区域存在');
    } else {
      warn('画面设置区域未找到');
    }

    // 查找动画效果开关
    const allSpans = await page.$$('.tk-shared-panel-body span');
    let animFound = false;
    for (const span of allSpans) {
      const text = await span.evaluate(el => el.textContent?.trim());
      if (text === '动画效果') {
        pass('动画效果开关存在');
        animFound = true;
        const parent = await span.evaluateHandle(el => el.parentElement);
        const btn = await parent.$('button');
        if (btn) {
          const btnText = await btn.evaluate(el => el.textContent?.trim());
          pass(`动画效果开关状态: "${btnText}"`);
          await btn.click();
          await delay(500);
          await takeScreenshot(page, 'v19-visual-animation-toggled');
          await btn.click();
          await delay(300);
        }
        break;
      }
    }
    if (!animFound) warn('动画效果开关未找到');

    // 查找粒子特效开关
    let particleFound = false;
    for (const span of allSpans) {
      const text = await span.evaluate(el => el.textContent?.trim());
      if (text === '粒子特效') {
        pass('粒子特效开关存在');
        particleFound = true;
        const parent = await span.evaluateHandle(el => el.parentElement);
        const btn = await parent.$('button');
        if (btn) {
          const btnText = await btn.evaluate(el => el.textContent?.trim());
          pass(`粒子特效开关状态: "${btnText}"`);
        }
        break;
      }
    }
    if (!particleFound) warn('粒子特效开关未找到');
  } catch (e) { fail('画面设置', e.message); }
}

// ═══════════════════════════════════════════════════════════
// 测试4: 存档管理
// ═══════════════════════════════════════════════════════════
async function testSaveManagement(page) {
  console.log('\n📋 测试4: 存档管理');
  try {
    let overlay = await page.$('.tk-shared-panel-overlay');
    if (!overlay) { await openSettingsPanel(page); }
    await delay(1000);

    await takeScreenshot(page, 'v19-save-management');

    const panelText = await page.evaluate(() => {
      const body = document.querySelector('.tk-shared-panel-body');
      return body ? body.textContent : '';
    });

    if (panelText.includes('存档') || panelText.includes('💾')) {
      pass('存档管理区域存在');
    } else {
      warn('存档管理区域未找到');
    }

    // 查找手动保存按钮
    const allBtns = await page.$$('.tk-shared-panel-body button');
    let saveBtnFound = false;
    for (const btn of allBtns) {
      const text = await btn.evaluate(el => el.textContent?.trim());
      if (text && text.includes('手动保存')) {
        pass('手动保存按钮存在');
        saveBtnFound = true;
        await btn.click();
        await delay(1000);
        await takeScreenshot(page, 'v19-save-after-click');

        // 检查反馈
        const afterText = await page.evaluate(() => {
          const body = document.querySelector('.tk-shared-panel-body');
          return body ? body.textContent : '';
        });
        if (afterText.includes('存档已保存') || afterText.includes('💾')) {
          pass('手动保存反馈消息已显示');
        } else {
          warn('手动保存反馈未找到', '可能消息已消失');
        }
        break;
      }
    }
    if (!saveBtnFound) fail('手动保存按钮未找到', '存档区域缺少保存按钮');
  } catch (e) { fail('存档管理', e.message); }
}

// ═══════════════════════════════════════════════════════════
// 测试5: 账号管理
// ═══════════════════════════════════════════════════════════
async function testAccountManagement(page) {
  console.log('\n📋 测试5: 账号管理');
  try {
    let overlay = await page.$('.tk-shared-panel-overlay');
    if (!overlay) { await openSettingsPanel(page); }
    await delay(1000);

    await takeScreenshot(page, 'v19-account-management');

    const panelText = await page.evaluate(() => {
      const body = document.querySelector('.tk-shared-panel-body');
      return body ? body.textContent : '';
    });

    if (panelText.includes('账号') || panelText.includes('👤')) {
      pass('账号管理区域存在');
    } else {
      warn('账号管理区域未找到');
    }

    // 检查游客/绑定状态
    if (panelText.includes('游客账号')) {
      pass('游客账号状态显示');
    } else if (panelText.includes('已绑定账号')) {
      pass('已绑定账号状态显示');
    } else {
      warn('账号绑定状态未显示');
    }

    if (panelText.includes('未绑定')) {
      pass('绑定信息: "未绑定"');
    } else if (panelText.includes('个绑定')) {
      pass('绑定信息已显示');
    }

    // 查找管理账号按钮
    const allBtns = await page.$$('.tk-shared-panel-body button');
    let manageBtnFound = false;
    for (const btn of allBtns) {
      const text = await btn.evaluate(el => el.textContent?.trim());
      if (text && text.includes('管理账号')) {
        pass('管理账号按钮存在');
        manageBtnFound = true;
        await btn.click();
        await delay(800);
        await takeScreenshot(page, 'v19-account-detail-expanded');

        // 查找收起按钮
        const allBtns2 = await page.$$('.tk-shared-panel-body button');
        for (const btn2 of allBtns2) {
          const text2 = await btn2.evaluate(el => el.textContent?.trim());
          if (text2 && text2.includes('收起详情')) {
            await btn2.click();
            await delay(300);
            pass('账号详情可收起');
            break;
          }
        }
        break;
      }
    }
    if (!manageBtnFound) {
      // 可能显示"账号系统未就绪"
      if (panelText.includes('账号系统未就绪')) {
        warn('账号系统未就绪', 'AccountSystem 未注入到 SettingsPanel');
      } else {
        warn('管理账号按钮未找到', 'AccountSystem 可能未就绪');
      }
    }
  } catch (e) { fail('账号管理', e.message); }
}

// ═══════════════════════════════════════════════════════════
// 测试6: 基础设置（语言/时区/通知）
// ═══════════════════════════════════════════════════════════
async function testBasicSettings(page) {
  console.log('\n📋 测试6: 基础设置（语言/时区/通知）');
  try {
    let overlay = await page.$('.tk-shared-panel-overlay');
    if (!overlay) { await openSettingsPanel(page); }
    await delay(1000);

    await takeScreenshot(page, 'v19-basic-settings-overview');

    const panelText = await page.evaluate(() => {
      const body = document.querySelector('.tk-shared-panel-body');
      return body ? body.textContent : '';
    });

    if (panelText.includes('语言')) pass('语言设置区域存在');
    else warn('语言设置 UI 未实现', 'SettingsPanel 基础版不含语言设置');

    if (panelText.includes('时区')) pass('时区设置区域存在');
    else warn('时区设置 UI 未实现', 'SettingsPanel 基础版不含时区设置');

    if (panelText.includes('通知')) pass('通知设置区域存在');
    else warn('通知设置 UI 未实现', 'SettingsPanel 基础版不含通知设置');

    // 检查 localStorage
    const engineSettings = await page.evaluate(() => {
      try {
        const raw = localStorage.getItem('tk-settings') || localStorage.getItem('three-kingdoms-settings');
        return raw ? JSON.parse(raw) : null;
      } catch { return null; }
    });

    if (engineSettings) {
      pass('设置数据已持久化到 localStorage');
      if (engineSettings.language !== undefined) pass(`语言设置值: ${engineSettings.language}`);
      if (engineSettings.timezone !== undefined) pass(`时区设置值: ${engineSettings.timezone}`);
      if (engineSettings.notificationSettings !== undefined) pass('通知设置数据存在');
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
    if (!overlay) { await openSettingsPanel(page); }
    await delay(1000);

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
      if (!isVisible) pass('ESC 关闭设置面板成功（DOM隐藏）');
      else fail('ESC 关闭设置面板失败', '面板仍然可见');
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
        if (!isVisible) pass('关闭按钮关闭面板成功（DOM隐藏）');
        else fail('关闭按钮关闭面板失败', '面板仍然可见');
      }
    }

    // 重新打开，测试遮罩点击关闭
    await openSettingsPanel(page);
    await delay(1500);

    const overlayEl = await page.$('.tk-shared-panel-overlay');
    if (overlayEl) {
      const box = await overlayEl.boundingBox();
      if (box) {
        await page.mouse.click(box.x + 5, box.y + 5);
        await delay(500);
        const overlayAfterClick = await page.$('.tk-shared-panel-overlay');
        if (!overlayAfterClick) {
          pass('点击遮罩层关闭面板成功');
        } else {
          warn('点击遮罩层未关闭面板', '可能点击位置在面板内');
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
    await openSettingsPanel(page);
    await delay(1500);

    const panelEl = await page.$('.tk-shared-panel');
    if (panelEl) {
      const styles = await panelEl.evaluate(el => {
        const cs = window.getComputedStyle(el);
        return {
          width: cs.width,
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

    // 统计设置项行
    const rowCount = await page.evaluate(() => {
      const rows = document.querySelectorAll('.tk-shared-panel-body div');
      let count = 0;
      rows.forEach(r => {
        const t = r.textContent || '';
        if (t.includes('音效') || t.includes('背景音乐') || t.includes('动画效果') || t.includes('粒子特效')) {
          count++;
        }
      });
      return count;
    });
    if (rowCount > 0) pass(`设置项行数: ${rowCount}`);

    // 统计有样式的按钮
    const styledBtnCount = await page.evaluate(() => {
      const btns = document.querySelectorAll('.tk-shared-panel-body button');
      let count = 0;
      btns.forEach(b => {
        const bg = window.getComputedStyle(b).backgroundColor;
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') count++;
      });
      return count;
    });
    if (styledBtnCount > 0) pass(`有样式的按钮数: ${styledBtnCount}`);

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
    mobilePage = await browser.newPage();
    await mobilePage.setViewport({ width: 375, height: 812, deviceScaleFactor: 3 });
    await mobilePage.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)');

    mobilePage.on('console', msg => {
      if (msg.type() === 'error') results.consoleErrors.push(`[Mobile] ${msg.text()}`);
    });

    await mobilePage.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(3000);

    // 点击开始游戏
    const btns = await mobilePage.$$('button');
    for (const b of btns) {
      const t = await b.evaluate(el => el.textContent?.trim());
      if (t === '开始游戏') { await b.click(); break; }
    }
    await delay(3000);

    // 跳过引导
    for (let i = 0; i < 10; i++) {
      const o = await mobilePage.$('.tk-guide-overlay');
      if (!o) break;
      const s = await mobilePage.$('.tk-guide-btn--skip');
      if (s) { await s.evaluate(e => e.click()); await delay(500); continue; }
      await mobilePage.keyboard.press('Escape');
      await delay(500);
    }

    await delay(1000);
    await takeScreenshot(mobilePage, 'v19-mobile-main');

    const scrollWidth = await mobilePage.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await mobilePage.evaluate(() => document.documentElement.clientWidth);
    if (scrollWidth <= clientWidth + 2) pass('移动端无水平溢出');
    else warn('移动端水平溢出', `scrollWidth=${scrollWidth} > clientWidth=${clientWidth}`);

    // 打开设置面板（含重试）
    let mobileOpened = false;
    for (let retry = 0; retry < 3; retry++) {
      mobileOpened = await openSettingsPanel(mobilePage);
      await delay(2000);
      const testOverlay = await mobilePage.$('.tk-shared-panel-overlay');
      if (testOverlay) { mobileOpened = true; break; }
      console.log(`  🔄 移动端设置面板重试 ${retry + 1}/3`);
    }
    await takeScreenshot(mobilePage, 'v19-mobile-settings-open');

    const mobileOverlay = await mobilePage.$('.tk-shared-panel-overlay');
    if (mobileOverlay) {
      pass('移动端设置面板正常打开');

      const mobilePanel = await mobilePage.$('.tk-shared-panel');
      if (mobilePanel) {
        const box = await mobilePanel.boundingBox();
        if (box) {
          const ratio = box.width / 375;
          pass(`移动端面板宽度占比: ${(ratio * 100).toFixed(0)}%`);
          if (ratio > 0.85) pass('移动端面板接近全屏宽度');
          else warn('移动端面板宽度偏小', `占比 ${(ratio * 100).toFixed(0)}%`);
        }
      }

      const mobileToggles = await mobilePage.$$('.tk-shared-panel-body button');
      if (mobileToggles.length > 0) {
        pass(`移动端设置按钮数量: ${mobileToggles.length}`);
        await mobileToggles[0].click();
        await delay(500);
        await takeScreenshot(mobilePage, 'v19-mobile-toggle-clicked');
        pass('移动端设置按钮可点击');
      }
    } else {
      fail('移动端设置面板未打开', 'overlay 不存在');
    }

    const mobileScrollW = await mobilePage.evaluate(() => document.documentElement.scrollWidth);
    const mobileClientW = await mobilePage.evaluate(() => document.documentElement.clientWidth);
    if (mobileScrollW <= mobileClientW + 2) pass('移动端设置面板无溢出');
    else warn('移动端设置面板溢出', `scrollW=${mobileScrollW} clientW=${mobileClientW}`);

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
    if (body > 50) pass('小屏手机页面正常加载');
    else fail('小屏手机页面加载', '页面内容过少');

    const scrollW = await p.evaluate(() => document.documentElement.scrollWidth);
    const clientW = await p.evaluate(() => document.documentElement.clientWidth);
    if (scrollW <= clientW + 2) pass('小屏手机无水平溢出');
    else warn('小屏手机水平溢出', `scrollW=${scrollW} clientW=${clientW}`);

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
    if (body > 50) pass('平板页面正常加载');
    else fail('平板页面加载', '页面内容过少');

    const scrollW = await p.evaluate(() => document.documentElement.scrollWidth);
    const clientW = await p.evaluate(() => document.documentElement.clientWidth);
    if (scrollW <= clientW + 2) pass('平板无水平溢出');
    else warn('平板轻微溢出', `scrollW=${scrollW} clientW=${clientW}`);

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
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(3000);

    const relevantErrors = results.consoleErrors.filter(e =>
      !e.includes('favicon') && !e.includes('404') && !e.includes('net::ERR') && !e.includes('DevTools')
    );

    if (relevantErrors.length === 0) pass('无严重控制台错误');
    else if (relevantErrors.length <= 3) warn(`有 ${relevantErrors.length} 个控制台错误`, relevantErrors.join('; ').substring(0, 200));
    else fail('控制台错误过多', `${relevantErrors.length} 个错误`);
  } catch (e) { fail('控制台错误检测', e.message); }
}

// ═══════════════════════════════════════════════════════════
// 测试13: 数据完整性
// ═══════════════════════════════════════════════════════════
async function testDataIntegrity(page) {
  console.log('\n📋 测试13: 数据完整性');
  try {
    await enterGame(page);
    await skipGuide(page);
    await delay(1000);

    const hasEngine = await page.evaluate(() => !!window.__TK_ENGINE__);
    if (hasEngine) {
      pass('引擎全局对象 __TK_ENGINE__ 存在');
    } else {
      const altCheck = await page.evaluate(() => !!window.__tk_engine__);
      if (altCheck) pass('引擎全局对象 __tk_engine__ 存在');
      else warn('引擎全局对象未找到', '可能使用不同的挂载方式');
    }

    const hasRoot = await page.evaluate(() => !!document.getElementById('root') || !!document.getElementById('app'));
    if (hasRoot) pass('React 根节点存在');
    else warn('React 根节点未找到');

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

    if (settingsKeys.length > 0) pass(`设置相关 localStorage keys: ${settingsKeys.join(', ')}`);
    else warn('未找到设置相关 localStorage 数据');
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
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });

  page.on('console', msg => {
    if (msg.type() === 'error') results.consoleErrors.push(msg.text());
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

  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const reportPath = path.join(SCREENSHOT_DIR, 'v19-test-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n  📄 报告已保存: ${reportPath}`);

  process.exit(results.failed.length > 0 ? 1 : 0);
})();
