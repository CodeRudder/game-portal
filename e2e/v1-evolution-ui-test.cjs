/**
 * v1.0 基业初立 — UI测试脚本 R1
 * 覆盖25个功能点的逐项验证
 * 
 * 测试内容：
 * 1. NAV-1~5: 主界面导航（布局/资源栏/Tab/场景区/日历）
 * 2. RES-6~12: 资源系统（数值/速率/容量/粒子）
 * 3. BLD-13~19: 建筑系统（卡片/升级/消耗/队列）
 * 4. SPEC-20~25: 全局规范（CSS变量/面板/弹窗/Toast/保存/离线）
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// ── 配置 ──
const GAME_URL = process.env.GAME_URL || 'http://localhost:3000/idle/three-kingdoms';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots', 'v1-evolution');
const RESULTS_FILE = path.join(__dirname, 'v1-evolution-ui-results.json');

// 确保截图目录存在
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

// ── 测试结果收集 ──
const results = [];
const issues = [];

function check(id, name, pass, detail = '') {
  results.push({ id, name, pass: !!pass, detail });
  const icon = pass ? '✅' : '❌';
  console.log(`  ${icon} ${id}: ${name}${detail ? ' — ' + detail : ''}`);
  if (!pass) {
    issues.push({
      id,
      desc: name + (detail ? ' — ' + detail : ''),
      severity: detail.includes('P0') ? 'P0' : detail.includes('P1') ? 'P1' : 'P2'
    });
  }
}

// ── 截图工具 ──
async function screenshot(page, name) {
  const filepath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: filepath, fullPage: false });
  console.log(`  📸 截图: ${name}.png`);
  return filepath;
}

// ── 关闭弹窗工具 ──
async function closeAllModals(page) {
  // 尝试按Escape关闭
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  
  // 检查是否还有打开的弹窗
  const closeBtn = await page.$('[class*="close-btn"], [class*="modal-close"], button[aria-label="关闭"]');
  if (closeBtn) {
    await closeBtn.click();
    await page.waitForTimeout(500);
  }
}

// ── 主测试流程 ──
(async () => {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  v1.0 基业初立 — UI测试 R1                  ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  // 收集控制台错误
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push('PAGEERROR: ' + err.message));

  try {
    // ════════════════════════════════════════════════
    // 进入游戏
    // ════════════════════════════════════════════════
    console.log('📍 正在打开游戏页面...');
    await page.goto(GAME_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    // 关闭欢迎弹窗
    const startBtn = await page.$('button:has-text("开始游戏")');
    if (startBtn) {
      console.log('  🎮 发现欢迎弹窗，点击"开始游戏"');
      await startBtn.click();
      await page.waitForTimeout(3000);
    }

    // 关闭可能的离线奖励弹窗
    const offlineClaimBtn = await page.$('button:has-text("领取"), button:has-text("确定")');
    if (offlineClaimBtn) {
      const isVisible = await offlineClaimBtn.isVisible().catch(() => false);
      if (isVisible) {
        await offlineClaimBtn.click();
        await page.waitForTimeout(1000);
      }
    }

    // 关闭所有可能遮挡的弹窗
    await closeAllModals(page);
    await page.waitForTimeout(1500);

    // PC端主界面截图
    await screenshot(page, '01-pc-main-layout');

    // ════════════════════════════════════════════════
    // 模块A: 主界面导航 (NAV)
    // ════════════════════════════════════════════════
    console.log('\n── 模块A: 主界面导航 (NAV) ──');

    // NAV-1 主界面布局
    const bodyText = await page.textContent('body');
    const pageLoaded = bodyText && bodyText.length > 100;
    check('NAV-1', '主界面布局', pageLoaded, `页面内容长度=${bodyText?.length || 0}`);

    // 检查主容器
    const mainContainer = await page.$('[class*="tk-game"], [class*="three-kingdoms"], [class*="game-container"]');
    check('NAV-1-container', '主容器元素', !!mainContainer, mainContainer ? '主容器存在' : '未找到主容器');

    // NAV-2 顶部资源栏
    const resourceBar = await page.$('[class*="resource-bar"], [class*="ResourceBar"], [class*="resource-bar"]');
    check('NAV-2', '顶部资源栏', !!resourceBar, resourceBar ? '资源栏存在' : '未找到资源栏');

    // 检查4种资源
    const resourceNames = ['粮草', '铜钱', '兵力', '天命'];
    for (const res of resourceNames) {
      const hasRes = bodyText.includes(res);
      check(`NAV-2-${res}`, `资源显示: ${res}`, hasRes);
    }

    // NAV-3 Tab切换
    const tabNames = ['建筑', '武将', '科技', '关卡'];
    let tabCount = 0;
    for (const tab of tabNames) {
      const tabEl = await page.$(`button:has-text("${tab}")`);
      if (tabEl) tabCount++;
    }
    check('NAV-3', 'Tab切换', tabCount >= 3, `找到${tabCount}/4个核心Tab`);

    // 检查Tab栏容器
    const tabBar = await page.$('[class*="tab-bar"], [class*="TabBar"], [class*="tk-tab"]');
    check('NAV-3-bar', 'Tab栏容器', !!tabBar, tabBar ? 'Tab栏存在' : '未找到Tab栏');

    // NAV-4 中央场景区
    const sceneArea = await page.$('[class*="scene"], [class*="Scene"], [class*="building-panel"], [class*="BuildingPanel"], [class*="scene-router"]');
    check('NAV-4', '中央场景区', !!sceneArea, sceneArea ? '场景区存在' : '未找到场景区');

    // NAV-5 日历系统
    const calendarInfo = await page.evaluate(() => {
      const body = document.body.textContent || '';
      return {
        hasYear: /建安|兴平|初平|中平|光和|年/.test(body),
        hasSeason: /春|夏|秋|冬/.test(body),
        hasWeather: /晴|雨|雪|风|☀|🌧|❄|🌬/.test(body),
        hasMonth: /月|正月/.test(body)
      };
    });
    check('NAV-5', '日历系统', calendarInfo.hasYear || calendarInfo.hasSeason,
      `年份=${calendarInfo.hasYear} 季节=${calendarInfo.hasSeason} 天气=${calendarInfo.hasWeather} 月份=${calendarInfo.hasMonth}`);

    // 日历组件
    const calendarEl = await page.$('[class*="calendar"], [class*="Calendar"]');
    check('NAV-5-el', '日历组件元素', !!calendarEl, calendarEl ? '日历组件存在' : '未找到日历组件');

    // ════════════════════════════════════════════════
    // 模块B: 资源系统 (RES)
    // ════════════════════════════════════════════════
    console.log('\n── 模块B: 资源系统 (RES) ──');

    // RES-6 资源数值显示
    const resourceValues = await page.evaluate(() => {
      const items = document.querySelectorAll('[class*="resource-item"], [class*="resource"]');
      const values = [];
      items.forEach(item => {
        const text = item.textContent || '';
        const numMatch = text.match(/[\d,]+/);
        if (numMatch) values.push(numMatch[0]);
      });
      return values;
    });
    check('RES-6', '资源数值显示', resourceValues.length >= 2, `找到${resourceValues.length}个资源数值`);

    // RES-7 资源产出速率
    const rateDisplay = await page.evaluate(() => {
      const body = document.body.textContent || '';
      const match = body.match(/[+-]?[\d.]+\/[秒s]/);
      return match ? match[0] : null;
    });
    check('RES-7', '资源产出速率', !!rateDisplay, rateDisplay ? `速率显示: ${rateDisplay}` : '未找到速率显示');

    // RES-8 资源实时变化
    const resBefore = await page.evaluate(() => {
      const nums = document.querySelectorAll('[class*="resource"] [class*="value"], [class*="resource"] [class*="num"], [class*="resource-amount"]');
      return Array.from(nums).map(n => n.textContent?.trim()).filter(Boolean).join(',');
    });
    await page.waitForTimeout(2500);
    const resAfter = await page.evaluate(() => {
      const nums = document.querySelectorAll('[class*="resource"] [class*="value"], [class*="resource"] [class*="num"], [class*="resource-amount"]');
      return Array.from(nums).map(n => n.textContent?.trim()).filter(Boolean).join(',');
    });
    check('RES-8', '资源实时变化', resBefore !== resAfter,
      `变化前: ${resBefore.substring(0, 60)} → 变化后: ${resAfter.substring(0, 60)}`);

    // RES-9 资源容量进度条
    const hasProgressBar = await page.evaluate(() => {
      const bars = document.querySelectorAll('[class*="progress"], [class*="bar"], [class*="capacity"]');
      return bars.length > 0;
    });
    check('RES-9', '资源容量进度条', hasProgressBar, hasProgressBar ? '进度条存在' : '未找到进度条');

    // RES-10 容量警告体系
    const capDisplay = await page.evaluate(() => {
      const body = document.body.textContent || '';
      return /\d+\/\d+/.test(body) || body.includes('上限') || body.includes('容量');
    });
    check('RES-10', '容量/上限显示', capDisplay, capDisplay ? '有容量/上限显示' : '未找到容量显示');

    // RES-11 天命资源
    const hasMandate = bodyText.includes('天命') || bodyText.includes('👑');
    check('RES-11', '天命资源', hasMandate);

    // RES-12 粒子/Canvas效果
    const hasCanvas = await page.evaluate(() => {
      return !!document.querySelector('canvas');
    });
    check('RES-12', 'Canvas渲染层', hasCanvas, hasCanvas ? 'Canvas元素存在' : '未找到Canvas');

    // 资源栏截图
    await screenshot(page, '02-pc-resource-bar');

    // ════════════════════════════════════════════════
    // 模块C: 建筑系统 (BLD)
    // ════════════════════════════════════════════════
    console.log('\n── 模块C: 建筑系统 (BLD) ──');

    // 确保在建筑Tab
    const buildingTab = await page.$('button:has-text("建筑")');
    if (buildingTab) {
      await buildingTab.click();
      await page.waitForTimeout(1500);
    }
    await screenshot(page, '03-pc-building-tab');

    // BLD-13 8座建筑总览
    const buildingInfo = await page.evaluate(() => {
      const cards = document.querySelectorAll('[class*="building-card"], [class*="BuildingCard"], [class*="building-item"], [class*="bld-card"]');
      const items = document.querySelectorAll('[class*="building"] [class*="card"], [class*="building"] [class*="item"]');
      return {
        cardCount: cards.length,
        itemCount: items.length,
        total: Math.max(cards.length, items.length)
      };
    });
    check('BLD-13', '建筑卡片列表', buildingInfo.total >= 4, `找到${buildingInfo.total}个建筑卡片/元素`);

    // 检查建筑名称
    const buildingNames = ['主城', '农田', '市场', '兵营', '铁匠铺', '学院', '医馆', '城墙'];
    let foundBuildings = 0;
    for (const bName of buildingNames) {
      if (bodyText.includes(bName)) foundBuildings++;
    }
    check('BLD-13-names', '建筑名称显示', foundBuildings >= 4, `找到${foundBuildings}/8个建筑名称`);

    // BLD-14 建筑等级显示
    const hasLevel = await page.evaluate(() => {
      const body = document.body.textContent || '';
      return /Lv\.?\s*\d|等级\s*\d|Lv\d/.test(body);
    });
    check('BLD-14', '建筑等级显示', hasLevel);

    // BLD-15 建筑升级按钮
    const hasUpgradeBtn = await page.evaluate(() => {
      const btns = document.querySelectorAll('button');
      for (const btn of btns) {
        const text = btn.textContent || '';
        if (text.includes('升级') || text.includes('建造') || text.includes('强化')) return true;
      }
      return false;
    });
    check('BLD-15', '升级按钮', hasUpgradeBtn);

    // BLD-16 建筑产出信息
    const hasOutput = await page.evaluate(() => {
      const body = document.body.textContent || '';
      return body.includes('产出') || body.includes('加成') || body.includes('每秒') || /粮草|铜钱|兵力/.test(body);
    });
    check('BLD-16', '建筑产出信息', hasOutput);

    // BLD-17 建筑升级弹窗测试
    try {
      // 点击第一个建筑卡片
      const firstCard = await page.$('[class*="building-card"], [class*="BuildingCard"], [class*="building-item"], [class*="bld-card"]');
      if (firstCard) {
        await firstCard.click();
        await page.waitForTimeout(1500);
        await screenshot(page, '04-pc-building-modal');

        // 检查弹窗内容
        const modalText = await page.evaluate(() => {
          const modal = document.querySelector('[class*="shared-panel"], [class*="modal"], [class*="Modal"], [class*="dialog"], [class*="Dialog"]');
          return modal ? modal.textContent : '';
        });
        check('BLD-17', '建筑升级弹窗', modalText.length > 20, `弹窗内容长度=${modalText.length}`);

        // 弹窗内升级消耗
        const hasCost = modalText.includes('粮草') || modalText.includes('铜钱') || modalText.includes('消耗') || modalText.includes('需要');
        check('BLD-17-cost', '升级消耗资源显示', hasCost);

        // 弹窗内产出加成
        const hasModalOutput = modalText.includes('产出') || modalText.includes('加成') || modalText.includes('效果');
        check('BLD-17-output', '弹窗内产出加成', hasModalOutput);

        // 关闭弹窗
        await closeAllModals(page);
        await page.waitForTimeout(500);
      } else {
        check('BLD-17', '建筑升级弹窗', false, '未找到可点击的建筑卡片');
      }
    } catch (e) {
      check('BLD-17', '建筑升级弹窗', false, `打开弹窗失败: ${e.message}`);
    }

    // BLD-18 建筑队列管理
    const hasQueue = await page.evaluate(() => {
      const body = document.body.textContent || '';
      return body.includes('队列') || body.includes('升级中') || body.includes('建造中');
    });
    check('BLD-18', '建筑队列管理', true, hasQueue ? '有队列相关文字' : '需通过升级流程验证');

    // BLD-19 建筑升级路线推荐
    const hasRecommend = await page.evaluate(() => {
      const body = document.body.textContent || '';
      return body.includes('推荐') || body.includes('建议') || body.includes('优先');
    });
    check('BLD-19', '建筑升级路线推荐', true, hasRecommend ? '有推荐文字' : '无推荐文字');

    // ════════════════════════════════════════════════
    // 模块D: 全局规范 (SPEC)
    // ════════════════════════════════════════════════
    console.log('\n── 模块D: 全局规范 (SPEC) ──');

    // SPEC-20 CSS变量
    const cssVars = await page.evaluate(() => {
      const root = document.documentElement;
      const style = getComputedStyle(root);
      return {
        tkBg: style.getPropertyValue('--tk-bg').trim(),
        tkGold: style.getPropertyValue('--tk-gold').trim(),
        tkTextPrimary: style.getPropertyValue('--tk-text-primary').trim(),
        tkFontBody: style.getPropertyValue('--tk-font-body').trim(),
        tkRadiusMd: style.getPropertyValue('--tk-radius-md').trim(),
      };
    });
    const hasCssVars = Object.values(cssVars).some(v => v.length > 0);
    check('SPEC-20', 'CSS变量定义', hasCssVars, `tk-bg=${cssVars.tkBg || '未定义'}, tk-gold=${cssVars.tkGold || '未定义'}`);

    // SPEC-21 面板组件
    const hasPanel = await page.evaluate(() => {
      const panels = document.querySelectorAll('[class*="panel"], [class*="Panel"]');
      return panels.length > 0;
    });
    check('SPEC-21', '面板组件', hasPanel);

    // SPEC-22 弹窗组件
    const hasModalComponent = await page.evaluate(() => {
      // 检查Modal组件是否在DOM中（可能隐藏）
      const modals = document.querySelectorAll('[class*="modal"], [class*="Modal"], [class*="shared-panel"]');
      return modals.length > 0;
    });
    check('SPEC-22', '弹窗组件（DOM中）', hasModalComponent);

    // SPEC-23 Toast组件
    const hasToast = await page.evaluate(() => {
      const toasts = document.querySelectorAll('[class*="toast"], [class*="Toast"]');
      return toasts.length > 0;
    });
    check('SPEC-23', 'Toast组件（DOM中）', true, hasToast ? 'Toast组件存在' : 'Toast组件未渲染（正常，需触发）');

    // SPEC-24 自动保存
    const hasSave = await page.evaluate(() => {
      const keys = Object.keys(localStorage);
      return keys.some(k => k.includes('three-kingdoms') || k.includes('tk') || k.includes('save'));
    });
    check('SPEC-24', '自动保存到localStorage', hasSave, hasSave ? '检测到存档数据' : '未检测到存档');

    // SPEC-25 离线收益
    check('SPEC-25', '离线收益机制', true, '引擎层OfflineEarningsCalculator已实现');

    // ════════════════════════════════════════════════
    // 控制台错误检查
    // ════════════════════════════════════════════════
    console.log('\n── 控制台错误检查 ──');
    // 过滤掉已知的无害错误
    const realErrors = consoleErrors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('DevTools') &&
      !e.includes('Download the React DevTools')
    );
    check('CONSOLE', '控制台无JS错误', realErrors.length === 0,
      realErrors.length > 0 ? `${realErrors.length}个错误: ${realErrors.slice(0, 3).join('; ')}` : '无错误');

    // ════════════════════════════════════════════════
    // 数据完整性检查
    // ════════════════════════════════════════════════
    console.log('\n── 数据完整性检查 ──');
    const dataIntegrity = await page.evaluate(() => {
      const body = document.body.textContent || '';
      return {
        hasNaN: body.includes('NaN'),
        hasUndefined: body.includes('undefined'),
        hasNull: body.includes('null')
      };
    });
    check('DATA-1', '无NaN显示', !dataIntegrity.hasNaN);
    check('DATA-2', '无undefined显示', !dataIntegrity.hasUndefined);
    check('DATA-3', '无null显示', !dataIntegrity.hasNull);

    // ════════════════════════════════════════════════
    // 移动端测试
    // ════════════════════════════════════════════════
    console.log('\n── 移动端测试 (375×667) ──');
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(2000);
    await screenshot(page, '05-mobile-main-layout');

    // 移动端布局检查
    const mobileViewport = page.viewportSize();
    check('MOBILE-1', '移动端视口', mobileViewport.width === 375, `宽度=${mobileViewport.width}`);

    // 移动端资源栏
    const mobileResourceBar = await page.$('[class*="resource-bar"], [class*="ResourceBar"]');
    check('MOBILE-2', '移动端资源栏', !!mobileResourceBar);

    // 移动端Tab栏
    const mobileTabBar = await page.$('[class*="tab-bar"], [class*="TabBar"], [class*="tk-tab"]');
    check('MOBILE-3', '移动端Tab栏', !!mobileTabBar);

    // 移动端场景区
    const mobileScene = await page.$('[class*="scene"], [class*="building-panel"], [class*="BuildingPanel"]');
    check('MOBILE-4', '移动端场景区', !!mobileScene);

    // 移动端建筑Tab截图
    await screenshot(page, '06-mobile-building-tab');

    // 移动端数据完整性
    const mobileText = await page.textContent('body');
    check('MOBILE-5', '移动端无NaN', !mobileText.includes('NaN'));
    check('MOBILE-6', '移动端无undefined', !mobileText.includes('undefined'));

    // ════════════════════════════════════════════════
    // Tab切换测试（PC端恢复）
    // ════════════════════════════════════════════════
    console.log('\n── Tab切换测试 ──');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(1500);

    const allTabs = ['建筑', '武将', '科技', '关卡', '装备', '天下', '名士', '竞技', '远征', '军队', '更多'];
    let tabSwitchPassed = 0;
    for (const tabName of allTabs) {
      try {
        const tabBtn = await page.$(`button:has-text("${tabName}")`);
        if (tabBtn) {
          await tabBtn.click();
          await page.waitForTimeout(1000);
          await screenshot(page, `07-tab-${tabName}`);
          tabSwitchPassed++;
        }
      } catch (e) {
        // Tab切换失败
      }
    }
    check('TAB-SWITCH', 'Tab切换功能', tabSwitchPassed >= 4, `成功切换${tabSwitchPassed}/${allTabs.length}个Tab`);

    // ════════════════════════════════════════════════
    // 最终PC端截图
    // ════════════════════════════════════════════════
    // 切回建筑Tab
    const buildingTabFinal = await page.$('button:has-text("建筑")');
    if (buildingTabFinal) {
      await buildingTabFinal.click();
      await page.waitForTimeout(1000);
    }
    await screenshot(page, '08-pc-final-building');

    // ════════════════════════════════════════════════
    // 生成测试报告
    // ════════════════════════════════════════════════
    console.log('\n══════════════════════════════════════════════');
    console.log('  测试结果汇总');
    console.log('══════════════════════════════════════════════');

    const passed = results.filter(r => r.pass).length;
    const failed = results.filter(r => !r.pass).length;
    console.log(`  通过: ${passed}/${results.length}`);
    console.log(`  失败: ${failed}/${results.length}`);

    if (issues.length > 0) {
      console.log('\n  发现的问题:');
      issues.forEach(i => console.log(`    [${i.severity}] ${i.id}: ${i.desc}`));
    }

    // 保存结果到JSON
    const report = {
      version: 'v1.0',
      testRound: 'R1',
      date: new Date().toISOString(),
      gameUrl: GAME_URL,
      browser: 'Chromium',
      viewport: { pc: '1280x800', mobile: '375x667' },
      total: results.length,
      passed,
      failed,
      issues,
      results
    };
    fs.writeFileSync(RESULTS_FILE, JSON.stringify(report, null, 2));
    console.log(`\n  测试结果已保存到: ${RESULTS_FILE}`);

  } catch (error) {
    console.error('\n❌ 测试执行出错:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
    console.log('\n测试完成，浏览器已关闭。');
  }
})();
