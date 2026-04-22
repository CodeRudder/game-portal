/**
 * v10.0 兵强马壮 — E2E UI 测试 (R2)
 *
 * 测试范围：
 *   A. 页面加载 + 装备Tab导航
 *   B. 装备面板渲染（背包/锻造/强化子Tab）
 *   C. 装备背包展示（容量、筛选、装备卡片）
 *   D. 锻造面板（基础/高级锻造按钮）
 *   E. 强化面板（强化操作、保护符）
 *   F. 装备详情弹窗
 *   G. 引擎API验证（EquipmentSystem/Forge/Enhance/Set/Recommend）
 *   H. 数据完整性 + 移动端适配
 *
 * 依赖：puppeteer
 * 运行：node e2e/v10-evolution-ui-test.cjs
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5173/idle/three-kingdoms';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots', 'v10-evolution');
const VISITED_KEY = 'tk-has-visited';
const SAVE_KEY = 'three-kingdoms-save';

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const results = {
  version: 'v10.0',
  timestamp: new Date().toISOString(),
  tests: [],
  summary: { total: 0, passed: 0, failed: 0, skipped: 0 },
};

function addTest(name, status, details = '') {
  results.tests.push({ name, status, details });
  results.summary.total++;
  if (status === 'PASS') results.summary.passed++;
  else if (status === 'FAIL') results.summary.failed++;
  else results.summary.skipped++;
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
  console.log(`  ${icon} ${name}${details ? ' — ' + details : ''}`);
}

async function screenshot(page, name) {
  const file = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  📸 ${name}.png`);
}

/** 通过 React fiber 树获取引擎实例 */
async function getEngine(page) {
  return page.evaluate(() => {
    const rootEl = document.querySelector('#__next') || document.querySelector('#root') || document.querySelector('[class*="three-kingdoms"]');
    if (!rootEl) return null;
    const fiberKey = Object.keys(rootEl).find(k => k.startsWith('__reactFiber$'));
    if (!fiberKey) return null;
    let engine = null;
    const visited = new Set();
    function find(f, depth) {
      if (!f || depth > 40 || visited.has(f) || engine) return;
      visited.add(f);
      const props = f.memoizedProps || f.pendingProps;
      if (props && props.engine && typeof props.engine.getEquipmentSystem === 'function') {
        engine = props.engine;
        return;
      }
      find(f.child, depth + 1);
      find(f.return, depth + 1);
      find(f.sibling, depth + 1);
    }
    find(rootEl[fiberKey], 0);
    return engine;
  });
}

async function run() {
  console.log('\n═══════════════════════════════════════');
  console.log('  v10.0 兵强马壮 — E2E UI 测试 R2');
  console.log('═══════════════════════════════════════\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  const consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push('PAGEERROR: ' + err.message));

  try {
    // ═══ A. 页面加载 ═══
    console.log('── A. 页面加载 ──');
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));

    // 关闭欢迎弹窗
    const startBtn = await page.$('button');
    if (startBtn) {
      const text = await page.evaluate(el => el.textContent, startBtn);
      if (text?.includes('开始')) {
        await startBtn.click();
        await new Promise(r => setTimeout(r, 2500));
      }
    }
    // 跳过引导
    for (let i = 0; i < 5; i++) {
      const guide = await page.$('.tk-guide-overlay, [class*="guide"]');
      if (!guide) break;
      await page.keyboard.press('Escape');
      await new Promise(r => setTimeout(r, 400));
    }
    await screenshot(page, 'v10-A1-main-page');
    addTest('A1: 页面加载', true, `title: ${await page.title()}`);

    // ═══ B. 装备Tab ═══
    console.log('\n── B. 装备Tab ──');
    const equipTabClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, [role="tab"]'));
      const eq = btns.find(b => b.textContent?.includes('装备'));
      if (eq) { eq.click(); return true; }
      return false;
    });
    await new Promise(r => setTimeout(r, 1500));
    await screenshot(page, 'v10-B1-equipment-tab');
    addTest('B1: 装备Tab可点击', equipTabClicked, equipTabClicked ? '' : '未找到装备Tab按钮');

    if (equipTabClicked) {
      // 检查子Tab
      const subTabs = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        return ['背包', '锻造', '强化'].filter(label =>
          btns.some(b => b.textContent?.includes(label))
        );
      });
      addTest('B2: 子Tab显示', subTabs.length >= 2, `找到: ${subTabs.join(', ')}`);

      // ═══ C. 装备背包 ═══
      console.log('\n── C. 装备背包 ──');
      const bagClicked = await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('背包'));
        if (btn) { btn.click(); return true; }
        return false;
      });
      await new Promise(r => setTimeout(r, 1000));
      await screenshot(page, 'v10-C1-bag');

      const bagInfo = await page.evaluate(() => {
        const text = document.body.innerText;
        const hasCapacity = text.match(/\d+\s*\/\s*\d+/) !== null;
        const hasSlotFilter = text.includes('全部') || text.includes('武器') || text.includes('防具');
        return { hasCapacity, hasSlotFilter, snippet: text.substring(0, 300) };
      });
      addTest('C1: 背包容量显示', bagInfo.hasCapacity);
      addTest('C2: 部位筛选按钮', bagInfo.hasSlotFilter);

      // ═══ D. 锻造面板 ═══
      console.log('\n── D. 锻造面板 ──');
      const forgeClicked = await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('锻造'));
        if (btn) { btn.click(); return true; }
        return false;
      });
      await new Promise(r => setTimeout(r, 1000));
      await screenshot(page, 'v10-D1-forge');

      const forgeInfo = await page.evaluate(() => {
        const text = document.body.innerText;
        const hasBasic = text.includes('基础') || text.includes('普通锻造');
        const hasAdvanced = text.includes('高级');
        return { hasBasic, hasAdvanced };
      });
      addTest('D1: 锻造面板显示', forgeClicked);
      addTest('D2: 基础锻造按钮', forgeInfo.hasBasic);
      addTest('D3: 高级锻造按钮', forgeInfo.hasAdvanced);

      // ═══ E. 强化面板 ═══
      console.log('\n── E. 强化面板 ──');
      const enhanceClicked = await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('强化'));
        if (btn) { btn.click(); return true; }
        return false;
      });
      await new Promise(r => setTimeout(r, 1000));
      await screenshot(page, 'v10-E1-enhance');
      addTest('E1: 强化面板显示', enhanceClicked);

      // ═══ F. 装备详情弹窗 ═══
      console.log('\n── F. 装备详情弹窗 ──');
      // 先回到背包看看有没有装备卡片
      const backToBag = await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('背包'));
        if (btn) { btn.click(); return true; }
        return false;
      });
      await new Promise(r => setTimeout(r, 800));

      const equipCards = await page.evaluate(() => {
        const cards = document.querySelectorAll('[class*="equip"][class*="card"], [class*="item-card"], [class*="bag"] [class*="card"]');
        return cards.length;
      });
      addTest('F1: 装备卡片数量', equipCards > 0, `找到 ${equipCards} 个卡片`);

      if (equipCards > 0) {
        await page.evaluate(() => {
          const card = document.querySelector('[class*="equip"][class*="card"], [class*="item-card"], [class*="bag"] [class*="card"]');
          if (card) card.click();
        });
        await new Promise(r => setTimeout(r, 1000));
        await screenshot(page, 'v10-F2-detail-modal');
        const detailText = await page.evaluate(() => document.body.innerText);
        addTest('F2: 装备详情弹窗', detailText.includes('属性') || detailText.includes('品质'));
        await page.keyboard.press('Escape');
        await new Promise(r => setTimeout(r, 500));
      }
    }

    // ═══ G. 引擎API验证 ═══
    console.log('\n── G. 引擎API验证 ──');
    const engine = await getEngine(page);
    const apiCheck = await page.evaluate((eng) => {
      if (!eng) return { hasEngine: false };
      const apis = {};
      const methods = [
        'getEquipmentSystem', 'getEquipmentForgeSystem', 'getEquipmentEnhanceSystem',
        'getEquipmentSetSystem', 'getEquipmentRecommendSystem',
      ];
      methods.forEach(m => { apis[m] = typeof eng[m] === 'function'; });

      // 尝试获取装备系统并检查方法
      let eqInfo = {};
      try {
        const eq = eng.getEquipmentSystem?.();
        if (eq) {
          eqInfo.hasGetAll = typeof eq.getAllEquipments === 'function';
          eqInfo.hasGetCapacity = typeof eq.getBagCapacity === 'function';
          eqInfo.bagCount = eq.getAllEquipments?.()?.length ?? -1;
          eqInfo.capacity = eq.getBagCapacity?.() ?? -1;
        }
      } catch (e) { eqInfo.error = e.message; }

      // 套装系统
      let setInfo = {};
      try {
        const ss = eng.getEquipmentSetSystem?.();
        if (ss) {
          setInfo.available = true;
          setInfo.hasGetSets = typeof ss.getSetDefinitions === 'function';
        }
      } catch (e) { setInfo.error = e.message; }

      // 推荐系统
      let recInfo = {};
      try {
        const rs = eng.getEquipmentRecommendSystem?.();
        if (rs) {
          recInfo.available = true;
          recInfo.hasRecommend = typeof rs.recommend === 'function';
        }
      } catch (e) { recInfo.error = e.message; }

      return { hasEngine: true, apis, eqInfo, setInfo, recInfo };
    }, engine);

    addTest('G1: 引擎实例获取', apiCheck.hasEngine);
    if (apiCheck.hasEngine) {
      const m = apiCheck.apis;
      addTest('G2: getEquipmentSystem', m.getEquipmentSystem);
      addTest('G3: getEquipmentForgeSystem', m.getEquipmentForgeSystem);
      addTest('G4: getEquipmentEnhanceSystem', m.getEquipmentEnhanceSystem);
      addTest('G5: getEquipmentSetSystem', m.getEquipmentSetSystem);
      addTest('G6: getEquipmentRecommendSystem', m.getEquipmentRecommendSystem);
      if (apiCheck.eqInfo.hasGetAll) {
        addTest('G7: 背包数据', true, `${apiCheck.eqInfo.bagCount}/${apiCheck.eqInfo.capacity}`);
      }
      addTest('G8: 套装系统', apiCheck.setInfo.available ?? false);
      addTest('G9: 推荐系统', apiCheck.recInfo.available ?? false);
    }

    // ═══ H. 数据完整性 + 移动端 ═══
    console.log('\n── H. 数据完整性 + 移动端 ──');
    const bodyText = await page.evaluate(() => document.body.innerText);
    addTest('H1: 无NaN显示', !bodyText.includes('NaN'));
    addTest('H2: 无undefined显示', !bodyText.includes('undefined'));

    // 移动端
    await page.setViewport({ width: 375, height: 667 });
    await new Promise(r => setTimeout(r, 1500));
    await screenshot(page, 'v10-H3-mobile');
    const mobileOk = await page.evaluate(() => document.body.innerText.length > 50);
    addTest('H3: 移动端渲染', mobileOk);

    // 控制台错误
    const severeErrors = consoleErrors.filter(e =>
      !e.includes('favicon') && !e.includes('404') && !e.includes('Warning:')
    );
    addTest('H4: 无严重控制台错误', severeErrors.length === 0,
      severeErrors.length > 0 ? `${severeErrors.length}个错误` : '');

  } catch (e) {
    addTest('运行异常', 'FAIL', e.message);
  } finally {
    await browser.close();
  }

  // 保存结果
  const resultFile = path.join(__dirname, 'v10-evolution-ui-results.json');
  fs.writeFileSync(resultFile, JSON.stringify(results, null, 2));
  const { passed, failed, skipped, total } = results.summary;
  console.log(`\n═══ 结果: ${passed}/${total} 通过, ${failed} 失败, ${skipped} 跳过 ═══\n`);
  if (failed > 0) process.exitCode = 1;
}

run().catch(e => { console.error(e); process.exitCode = 1; });
