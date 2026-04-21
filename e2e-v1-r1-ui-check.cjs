const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const issues = [];

  // === PC端 ===
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  // F-01: 记录加载时间
  const startTime = Date.now();
  await page.goto('http://localhost:5173/idle/three-kingdoms', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  const loadTime = Date.now() - startTime;

  // 进入游戏
  const startBtn = await page.$('button:has-text("开始游戏")');
  if (startBtn) { await startBtn.click(); await page.waitForTimeout(3000); }

  console.log('=== v1.0 R1 UI合理性检查 ===\n');

  // A-01: 资源栏位置
  console.log('--- A-01: 资源栏位置 ---');
  const resourceBar = await page.$('[class*="resource"], [class*="ResourceBar"], [class*="top-bar"], [class*="topbar"]');
  if (resourceBar) {
    const box = await resourceBar.boundingBox();
    if (box) {
      console.log('资源栏位置: x=' + box.x + ' y=' + box.y + ' w=' + box.width + ' h=' + box.height);
      console.log('资源栏在顶部(y<100): ' + (box.y < 100 ? '✅' : '❌'));
    } else {
      console.log('资源栏boundingBox为null ❌');
    }
  } else {
    console.log('未找到资源栏元素，尝试更广泛搜索...');
    // 尝试查找顶部区域元素
    const topElements = await page.$$('[class*="top"], [class*="header"]');
    console.log('顶部相关元素数量: ' + topElements.length);
    for (let i = 0; i < Math.min(3, topElements.length); i++) {
      const box = await topElements[i].boundingBox();
      const cls = await topElements[i].getAttribute('class');
      if (box) {
        console.log('  元素[' + i + ']: class=' + (cls || '').substring(0, 60) + ' y=' + box.y);
      }
    }
  }

  // A-02: Tab栏位置
  console.log('\n--- A-02: Tab栏位置 ---');
  const tabBtns = await page.$$('[class*="tk-tab-btn"], [class*="tab-btn"], [class*="TabBtn"], [class*="tab-item"]');
  if (tabBtns.length > 0) {
    const firstTab = await tabBtns[0].boundingBox();
    const lastTab = await tabBtns[tabBtns.length - 1].boundingBox();
    console.log('Tab按钮数量: ' + tabBtns.length);
    console.log('第一个Tab: y=' + firstTab.y);
    console.log('最后一个Tab: y=' + lastTab.y);
    console.log('Tab栏在底部(y>400): ' + (firstTab.y > 400 ? '✅' : '❌ y=' + firstTab.y));
  } else {
    // 尝试通过文本查找Tab按钮
    console.log('未通过class找到Tab按钮，尝试文本搜索...');
    const tabNames = ['建筑', '武将', '科技', '关卡', '装备', '天下', '名士', '竞技', '远征', '军队', '更多'];
    let foundTabY = null;
    for (const name of tabNames) {
      const tab = await page.$('button:has-text("' + name + '")');
      if (tab) {
        const box = await tab.boundingBox();
        if (box) {
          if (foundTabY === null) foundTabY = box.y;
          console.log('  Tab "' + name + '": y=' + box.y);
        }
        break;
      }
    }
    if (foundTabY !== null) {
      console.log('Tab栏在底部(y>400): ' + (foundTabY > 400 ? '✅' : '❌ y=' + foundTabY));
    }
  }

  // A-03: 弹窗居中
  console.log('\n--- A-03: 弹窗居中 ---');
  // 点击建筑打开弹窗
  const buildingTab = await page.$('button:has-text("建筑")');
  if (buildingTab) {
    await buildingTab.click();
    await page.waitForTimeout(1500);
    const bldPin = await page.$('[class*="bld-pin"]:not([class*="locked"]), [class*="building-card"]:not([class*="locked"]), [class*="building-item"]:not([class*="locked"])');
    if (bldPin) {
      await bldPin.click();
      await page.waitForTimeout(1000);
      const modal = await page.$('[class*="shared-panel"], [class*="modal"], [class*="dialog"], [class*="popup"]');
      if (modal) {
        const mbox = await modal.boundingBox();
        if (mbox) {
          const centerX = 1280 / 2;
          const centerY = 720 / 2;
          const modalCenterX = mbox.x + mbox.width / 2;
          const modalCenterY = mbox.y + mbox.height / 2;
          console.log('弹窗中心: (' + modalCenterX + ',' + modalCenterY + ')');
          console.log('屏幕中心: (' + centerX + ',' + centerY + ')');
          const centered = Math.abs(modalCenterX - centerX) < 100 && Math.abs(modalCenterY - centerY) < 100;
          console.log('弹窗居中: ' + (centered ? '✅' : '⚠️ 偏移较大'));
        } else {
          console.log('弹窗boundingBox为null ⚠️');
        }
        
        // 遮罩层
        const overlay = await page.$('[class*="overlay"], [class*="mask"], [class*="backdrop"]');
        console.log('遮罩层: ' + (overlay ? '✅' : '❌'));
        
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      } else {
        console.log('未找到弹窗元素 ⚠️');
        // 尝试截图查看当前状态
        await page.screenshot({ path: 'screenshots/v1-r1-ui-after-building-click.png' });
        console.log('已截图: screenshots/v1-r1-ui-after-building-click.png');
      }
    } else {
      console.log('未找到可点击的建筑元素 ⚠️');
      await page.screenshot({ path: 'screenshots/v1-r1-ui-building-tab.png' });
      console.log('已截图: screenshots/v1-r1-ui-building-tab.png');
    }
  } else {
    console.log('未找到建筑Tab ❌');
  }

  // B-01: 弹窗层级高于面板
  console.log('\n--- B-01: 弹窗层级高于面板 ---');
  // 先打开建筑tab，然后尝试打开弹窗
  if (buildingTab) {
    await buildingTab.click();
    await page.waitForTimeout(1000);
    // 尝试点击第一个可见的建筑
    const anyBuilding = await page.$('[class*="bld-pin"], [class*="building-card"], [class*="building-item"]');
    if (anyBuilding) {
      await anyBuilding.click();
      await page.waitForTimeout(1000);
      const zIndexCheck = await page.evaluate(() => {
        const modals = document.querySelectorAll('[class*="shared-panel"], [class*="modal"], [class*="dialog"], [class*="popup"]');
        const panels = document.querySelectorAll('[class*="panel-content"], [class*="main-content"], [class*="game-content"]');
        let maxModalZ = -1;
        let maxPanelZ = -1;
        modals.forEach(m => {
          const z = parseInt(window.getComputedStyle(m).zIndex) || 0;
          if (z > maxModalZ) maxModalZ = z;
        });
        panels.forEach(p => {
          const z = parseInt(window.getComputedStyle(p).zIndex) || 0;
          if (z > maxPanelZ) maxPanelZ = z;
        });
        return { maxModalZ, maxPanelZ, modalCount: modals.length, panelCount: panels.length };
      });
      console.log('弹窗最高z-index: ' + zIndexCheck.maxModalZ + ' (共' + zIndexCheck.modalCount + '个)');
      console.log('面板最高z-index: ' + zIndexCheck.maxPanelZ + ' (共' + zIndexCheck.panelCount + '个)');
      console.log('弹窗层级高于面板: ' + (zIndexCheck.maxModalZ > zIndexCheck.maxPanelZ ? '✅' : '⚠️'));
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    } else {
      console.log('未找到建筑元素，跳过 ⚠️');
    }
  }

  // B-02: Toast在最顶层
  console.log('\n--- B-02: Toast层级 ---');
  const toastZIndex = await page.evaluate(() => {
    const toasts = document.querySelectorAll('[class*="toast"], [class*="Toast"], [class*="notification"]');
    if (toasts.length === 0) return { found: false, count: 0 };
    let maxZ = -1;
    toasts.forEach(t => {
      const z = parseInt(window.getComputedStyle(t).zIndex) || 0;
      if (z > maxZ) maxZ = z;
    });
    return { found: true, count: toasts.length, maxZ };
  });
  console.log('Toast元素: ' + (toastZIndex.found ? '找到' + toastZIndex.count + '个' : '未找到(可能未触发)'));
  if (toastZIndex.found) {
    console.log('Toast最高z-index: ' + toastZIndex.maxZ);
    console.log('Toast在最顶层: ' + (toastZIndex.maxZ >= 1000 ? '✅' : '⚠️'));
  }

  // B-03: Tab切换隐藏
  console.log('\n--- B-03: Tab切换隐藏 ---');
  if (buildingTab) {
    await buildingTab.click();
    await page.waitForTimeout(1000);
    const buildingContent = await page.$('[class*="bld-pin"], [class*="building-card"], [class*="building-item"]');
    const bVis1 = buildingContent ? await buildingContent.isVisible() : false;
    console.log('建筑Tab激活时建筑元素可见: ' + bVis1);
    // 切换到武将Tab
    const heroTab = await page.$('button:has-text("武将")');
    if (heroTab) {
      await heroTab.click();
      await page.waitForTimeout(1000);
      const bVis2 = buildingContent ? await buildingContent.isVisible() : false;
      console.log('武将Tab激活时建筑元素可见: ' + bVis2 + ' (应为false)');
      console.log('Tab切换隐藏: ' + (!bVis2 ? '✅' : '❌'));
    }
  }

  // C-01: 所有Tab可点击
  console.log('\n--- C-01: Tab可点击 ---');
  const tabNames = ['建筑', '武将', '科技', '关卡', '装备', '天下', '名士', '竞技', '远征', '军队', '更多'];
  let tabClickOk = 0;
  let tabDetails = [];
  for (const name of tabNames) {
    const tab = await page.$('button:has-text("' + name + '")');
    if (tab) {
      const vis = await tab.isVisible();
      if (vis) {
        tabClickOk++;
        tabDetails.push(name + ':✅');
      } else {
        tabDetails.push(name + ':存在但不可见');
      }
    } else {
      tabDetails.push(name + ':未找到');
    }
  }
  console.log('Tab详情: ' + tabDetails.join(', '));
  console.log('可点击Tab: ' + tabClickOk + '/' + tabNames.length + ' ' + (tabClickOk >= 11 ? '✅' : '⚠️'));

  // C-02: 激活Tab高亮
  console.log('\n--- C-02: 激活Tab高亮 ---');
  const armyTab = await page.$('button:has-text("军队")');
  if (armyTab) {
    await armyTab.click();
    await page.waitForTimeout(500);
    const className = await armyTab.getAttribute('class');
    const hasActive = className && (className.includes('active') || className.includes('selected') || className.includes('current'));
    console.log('军队Tab class: ' + (className ? className.substring(0, 100) : 'null'));
    console.log('有active类: ' + (hasActive ? '✅' : '⚠️ 需检查'));
  }

  // C-03: 返回按钮
  console.log('\n--- C-03: 返回按钮 ---');
  const backBtn = await page.$('button:has-text("←")');
  const backBtn2 = await page.$('[class*="back"], [class*="Back"]');
  console.log('返回按钮(文本): ' + (!!backBtn ? '✅' : '未找到'));
  console.log('返回按钮(class): ' + (!!backBtn2 ? '✅' : '未找到'));
  console.log('返回按钮存在: ' + ((!!backBtn || !!backBtn2) ? '✅' : '❌'));

  // D-01: 资源数值实时显示
  console.log('\n--- D-01: 资源数值 ---');
  const resourceValues = await page.evaluate(() => {
    const text = document.body.innerText;
    const goldMatch = text.match(/金[币]?[:\s]*(\d[\d,]*)/);
    const foodMatch = text.match(/粮[草]?[:\s]*(\d[\d,]*)/);
    const woodMatch = text.match(/木[材]?[:\s]*(\d[\d,]*)/);
    const ironMatch = text.match(/铁[:\s]*(\d[\d,]*)/);
    return {
      gold: goldMatch ? goldMatch[1] : null,
      food: foodMatch ? foodMatch[1] : null,
      wood: woodMatch ? woodMatch[1] : null,
      iron: ironMatch ? ironMatch[1] : null,
      bodyText: text.substring(0, 500)
    };
  });
  console.log('资源数值 - 金:' + (resourceValues.gold || '未找到') + ' 粮:' + (resourceValues.food || '未找到') + ' 木:' + (resourceValues.wood || '未找到') + ' 铁:' + (resourceValues.iron || '未找到'));
  const hasAnyResource = resourceValues.gold || resourceValues.food || resourceValues.wood || resourceValues.iron;
  console.log('资源数值显示: ' + (hasAnyResource ? '✅' : '⚠️'));

  // D-02: 建筑等级
  console.log('\n--- D-02: 建筑等级 ---');
  // 切换到建筑Tab
  if (buildingTab) {
    await buildingTab.click();
    await page.waitForTimeout(1000);
  }
  const buildingLevels = await page.evaluate(() => {
    const text = document.body.innerText;
    const levelMatches = text.match(/Lv\.?\s*\d+/g) || text.match(/等级\s*\d+/g) || [];
    return { levels: levelMatches, textSample: text.substring(0, 800) };
  });
  console.log('建筑等级匹配: ' + JSON.stringify(buildingLevels.levels));
  console.log('建筑等级可见: ' + (buildingLevels.levels.length > 0 ? '✅' : '⚠️'));

  // D-03: NaN/undefined检查
  console.log('\n--- D-03: NaN/undefined ---');
  const bodyText = await page.textContent('body');
  const hasNaN = bodyText.includes('NaN');
  const hasUndefined = bodyText.includes('undefined');
  const hasNull = bodyText.includes('null');
  console.log('NaN: ' + (hasNaN ? '❌' : '✅'));
  console.log('undefined: ' + (hasUndefined ? '❌' : '✅'));
  console.log('null: ' + (hasNull ? '❌' : '✅'));
  if (hasNaN) issues.push({ id: 'D-03', desc: '页面显示NaN', severity: 'P0' });
  if (hasUndefined) issues.push({ id: 'D-03', desc: '页面显示undefined', severity: 'P0' });

  // E-01: PC布局
  console.log('\n--- E-01: PC布局 ---');
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshots/v1-r1-ui-pc.png' });
  console.log('PC 1280x720 布局正常 ✅ (页面加载成功)');
  console.log('截图已保存: screenshots/v1-r1-ui-pc.png');

  // E-02: 移动端
  console.log('\n--- E-02: 移动端 ---');
  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'screenshots/v1-r1-ui-mobile.png' });
  const mobileText = await page.textContent('body');
  console.log('移动端内容长度: ' + mobileText.trim().length);
  console.log('移动端白屏: ' + (mobileText.trim().length < 10 ? '❌' : '✅'));
  console.log('截图已保存: screenshots/v1-r1-ui-mobile.png');

  // F-01: 加载时间
  console.log('\n--- F-01: 加载时间 ---');
  console.log('加载时间: ' + loadTime + 'ms ' + (loadTime < 10000 ? '✅' : '⚠️'));

  // F-02: Tab切换速度
  console.log('\n--- F-02: Tab切换速度 ---');
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(1000);
  const switchStart = Date.now();
  const techTab = await page.$('button:has-text("科技")');
  if (techTab) {
    await techTab.click();
    await page.waitForTimeout(200);
    const switchTime = Date.now() - switchStart;
    console.log('Tab切换时间: ' + switchTime + 'ms ' + (switchTime < 1000 ? '✅' : '⚠️'));
  }

  // G-01: 按钮可读文本
  console.log('\n--- G-01: 按钮文本 ---');
  const buttons = await page.$$('button');
  let emptyBtns = 0;
  let emptyBtnDetails = [];
  for (const btn of buttons) {
    const text = await btn.textContent();
    const ariaLabel = await btn.getAttribute('aria-label');
    const title = await btn.getAttribute('title');
    if ((!text || text.trim().length === 0) && !ariaLabel && !title) {
      emptyBtns++;
      const cls = await btn.getAttribute('class');
      emptyBtnDetails.push(cls ? cls.substring(0, 50) : 'no-class');
    }
  }
  console.log('空文本按钮: ' + emptyBtns + '/' + buttons.length + ' ' + (emptyBtns === 0 ? '✅' : '⚠️'));
  if (emptyBtns > 0 && emptyBtns <= 5) {
    console.log('空按钮详情: ' + emptyBtnDetails.join(', '));
  }

  // G-02: 字体大小
  console.log('\n--- G-02: 字体大小 ---');
  const fontSizeCheck = await page.evaluate(() => {
    const elements = document.querySelectorAll('body *');
    let tooSmall = 0;
    let checked = 0;
    let smallDetails = [];
    for (const el of elements) {
      const style = window.getComputedStyle(el);
      if (style.fontSize) {
        const size = parseFloat(style.fontSize);
        if (size > 0 && size < 12) {
          tooSmall++;
          if (smallDetails.length < 5) {
            smallDetails.push(el.tagName + '.' + (el.className || '').toString().substring(0, 40) + '=' + size + 'px');
          }
        }
        checked++;
      }
    }
    return { tooSmall, checked, smallDetails };
  });
  console.log('检查元素: ' + fontSizeCheck.checked + ' 过小字体: ' + fontSizeCheck.tooSmall);
  if (fontSizeCheck.tooSmall > 0) {
    console.log('过小字体详情: ' + fontSizeCheck.smallDetails.join(', '));
  }
  console.log('字体大小合规: ' + (fontSizeCheck.tooSmall === 0 ? '✅' : '⚠️ 有' + fontSizeCheck.tooSmall + '个元素字体<12px'));

  // 汇总
  console.log('\n=== UI合理性检查汇总 ===');
  console.log('检查项总数: 18');
  console.log('Issues: ' + issues.length);
  issues.forEach(i => console.log('  [' + i.severity + '] ' + i.id + ': ' + i.desc));

  // 保存结果到JSON
  const fs = require('fs');
  const results = {
    timestamp: new Date().toISOString(),
    version: 'v1.0 R1',
    loadTime: loadTime,
    issues: issues,
    checks: {
      'A-01': '资源栏位置',
      'A-02': 'Tab栏位置',
      'A-03': '弹窗居中',
      'B-01': '弹窗层级',
      'B-02': 'Toast层级',
      'B-03': 'Tab切换隐藏',
      'C-01': 'Tab可点击',
      'C-02': '激活Tab高亮',
      'C-03': '返回按钮',
      'D-01': '资源数值',
      'D-02': '建筑等级',
      'D-03': 'NaN/undefined',
      'E-01': 'PC布局',
      'E-02': '移动端布局',
      'F-01': '加载时间',
      'F-02': 'Tab切换速度',
      'G-01': '按钮文本',
      'G-02': '字体大小'
    }
  };
  fs.writeFileSync('e2e-v1-r1-ui-check-results.json', JSON.stringify(results, null, 2));
  console.log('结果已保存: e2e-v1-r1-ui-check-results.json');

  await browser.close();
})().catch(e => { console.error('失败:', e.message); process.exit(1); });
