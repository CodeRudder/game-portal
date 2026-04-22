/**
 * v11.0 群雄逐鹿 — E2E UI 测试 (R2)
 *
 * 测试范围：
 *   A. 页面加载 + 竞技场Tab导航
 *   B. 竞技场面板（段位、对手、挑战按钮、刷新）
 *   C. 排行榜面板（通过竞技场子Tab或更多菜单）
 *   D. 社交面板（好友列表、聊天、排行榜）
 *   E. 防守阵容面板
 *   F. 引擎API验证（ArenaSystem/RankingSystem/PvPBattle/Friend/Chat/Leaderboard）
 *   G. 数据完整性 + 移动端适配
 *
 * 依赖：puppeteer
 * 运行：node e2e/v11-evolution-ui-test.cjs
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5173/idle/three-kingdoms';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots', 'v11-evolution');
const VISITED_KEY = 'tk-has-visited';

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const results = {
  version: 'v11.0',
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
      if (props && props.engine && typeof props.engine.getArenaSystem === 'function') {
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
  console.log('  v11.0 群雄逐鹿 — E2E UI 测试 R2');
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
    for (let i = 0; i < 5; i++) {
      const guide = await page.$('.tk-guide-overlay, [class*="guide"]');
      if (!guide) break;
      await page.keyboard.press('Escape');
      await new Promise(r => setTimeout(r, 400));
    }
    await screenshot(page, 'v11-A1-main-page');
    addTest('A1: 页面加载', true, `title: ${await page.title()}`);

    // ═══ B. 竞技场Tab ═══
    console.log('\n── B. 竞技场Tab ──');
    const arenaTabClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, [role="tab"]'));
      const arena = btns.find(b => b.textContent?.includes('竞技'));
      if (arena) { arena.click(); return true; }
      return false;
    });
    await new Promise(r => setTimeout(r, 1500));
    await screenshot(page, 'v11-B1-arena-tab');
    addTest('B1: 竞技Tab可点击', arenaTabClicked);

    if (arenaTabClicked) {
      const arenaInfo = await page.evaluate(() => {
        const text = document.body.innerText;
        const hasRank = text.includes('青铜') || text.includes('白银') || text.includes('黄金') ||
                        text.includes('铂金') || text.includes('钻石') || text.includes('大师') || text.includes('王者');
        const hasScore = text.includes('积分') || text.includes('排名');
        const hasChallenge = text.includes('挑战');
        const hasRefresh = text.includes('刷新');
        const hasOpponent = text.includes('对手') || text.includes('玩家');
        return { hasRank, hasScore, hasChallenge, hasRefresh, hasOpponent };
      });
      addTest('B2: 段位信息显示', arenaInfo.hasRank);
      addTest('B3: 积分/排名显示', arenaInfo.hasScore);
      addTest('B4: 挑战按钮存在', arenaInfo.hasChallenge);
      addTest('B5: 刷新按钮存在', arenaInfo.hasRefresh);
      addTest('B6: 对手信息显示', arenaInfo.hasOpponent);

      // ═══ C. 排行榜子Tab ═══
      console.log('\n── C. 排行榜 ──');
      const rankClicked = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const rank = btns.find(b => b.textContent?.includes('排行') || b.textContent?.includes('榜单'));
        if (rank) { rank.click(); return true; }
        return false;
      });
      await new Promise(r => setTimeout(r, 1000));
      await screenshot(page, 'v11-C1-ranking');
      addTest('C1: 排行榜按钮', rankClicked, rankClicked ? '已点击' : '未找到排行按钮');

      if (rankClicked) {
        const rankInfo = await page.evaluate(() => {
          const text = document.body.innerText;
          const hasRankList = text.includes('#') || text.includes('名');
          const hasNames = text.includes('玩家') || text.includes('战力');
          return { hasRankList, hasNames };
        });
        addTest('C2: 排行列表显示', rankInfo.hasRankList);
      }

      // ═══ D. 防守阵容 ═══
      console.log('\n── D. 防守阵容 ──');
      // 先关闭排行榜回到主竞技面板
      await page.keyboard.press('Escape');
      await new Promise(r => setTimeout(r, 500));

      const defenseClicked = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const def = btns.find(b => b.textContent?.includes('防守') || b.textContent?.includes('阵容'));
        if (def) { def.click(); return true; }
        return false;
      });
      await new Promise(r => setTimeout(r, 1000));
      await screenshot(page, 'v11-D1-defense');
      addTest('D1: 防守阵容按钮', defenseClicked);

      if (defenseClicked) {
        const defenseInfo = await page.evaluate(() => {
          const text = document.body.innerText;
          const hasSlots = text.includes('阵位') || text.includes('武将');
          const hasFormation = text.includes('阵型') || text.includes('策略');
          return { hasSlots, hasFormation };
        });
        addTest('D2: 阵位信息', defenseInfo.hasSlots);
        addTest('D3: 阵型/策略选择', defenseInfo.hasFormation);
      }
    }

    // ═══ E. 社交面板（通过更多菜单） ═══
    console.log('\n── E. 社交面板 ──');
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 500));

    // 尝试通过"更多"菜单打开社交面板
    const socialOpened = await page.evaluate(() => {
      // 先找"更多"按钮
      const btns = Array.from(document.querySelectorAll('button'));
      const more = btns.find(b => b.textContent?.includes('更多'));
      if (more) more.click();
      return !!more;
    });
    await new Promise(r => setTimeout(r, 1000));

    if (socialOpened) {
      // 在更多菜单中找社交按钮
      const socialClicked = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button, [class*="menu"] [class*="item"], [class*="feature"] [class*="item"]'));
        const social = btns.find(b => b.textContent?.includes('社交'));
        if (social) { social.click(); return true; }
        return false;
      });
      await new Promise(r => setTimeout(r, 1500));
      await screenshot(page, 'v11-E1-social');

      if (socialClicked) {
        addTest('E1: 社交面板打开', true);
        const socialInfo = await page.evaluate(() => {
          const text = document.body.innerText;
          return {
            hasFriends: text.includes('好友'),
            hasChat: text.includes('聊天'),
            hasRank: text.includes('排行'),
          };
        });
        addTest('E2: 好友Tab显示', socialInfo.hasFriends);
        addTest('E3: 聊天Tab显示', socialInfo.hasChat);
        addTest('E4: 排行Tab显示', socialInfo.hasRank);

        // 尝试点击好友Tab
        const friendClicked = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const f = btns.find(b => b.textContent?.includes('好友'));
          if (f) { f.click(); return true; }
          return false;
        });
        await new Promise(r => setTimeout(r, 800));
        if (friendClicked) await screenshot(page, 'v11-E2-friends');
        addTest('E5: 好友列表可切换', friendClicked);
      } else {
        addTest('E1: 社交面板', 'SKIP', '更多菜单中未找到社交按钮');
      }
    } else {
      addTest('E1: 社交面板', 'SKIP', '未找到更多菜单按钮');
    }

    // ═══ F. 引擎API验证 ═══
    console.log('\n── F. 引擎API验证 ──');
    const engine = await getEngine(page);
    const apiCheck = await page.evaluate((eng) => {
      if (!eng) return { hasEngine: false };
      const apis = {};
      const methods = [
        'getArenaSystem', 'getRankingSystem', 'getPvPBattleSystem',
        'getDefenseFormationSystem', 'getArenaShopSystem',
        'getFriendSystem', 'getChatSystem',
      ];
      methods.forEach(m => { apis[m] = typeof eng[m] === 'function'; });

      // ArenaSystem 详细检查
      let arenaInfo = {};
      try {
        const arena = eng.getArenaSystem?.();
        if (arena) {
          arenaInfo.available = true;
          arenaInfo.hasGetPlayerState = typeof arena.getPlayerState === 'function';
          arenaInfo.hasCanChallenge = typeof arena.canChallenge === 'function';
          const ps = arena.getPlayerState?.();
          if (ps) {
            arenaInfo.rankId = ps.rankId;
            arenaInfo.score = ps.score;
            arenaInfo.challengesLeft = ps.challengesLeft;
          }
        }
      } catch (e) { arenaInfo.error = e.message; }

      // FriendSystem
      let friendInfo = {};
      try {
        const fs = eng.getFriendSystem?.();
        if (fs) {
          friendInfo.available = true;
          friendInfo.hasGetFriends = typeof fs.getFriends === 'function';
        }
      } catch (e) { friendInfo.error = e.message; }

      // ChatSystem
      let chatInfo = {};
      try {
        const cs = eng.getChatSystem?.();
        if (cs) {
          chatInfo.available = true;
          chatInfo.hasSendMessage = typeof cs.sendMessage === 'function';
        }
      } catch (e) { chatInfo.error = e.message; }

      return { hasEngine: true, apis, arenaInfo, friendInfo, chatInfo };
    }, engine);

    addTest('F1: 引擎实例获取', apiCheck.hasEngine);
    if (apiCheck.hasEngine) {
      const m = apiCheck.apis;
      addTest('F2: getArenaSystem', m.getArenaSystem);
      addTest('F3: getRankingSystem', m.getRankingSystem);
      addTest('F4: getPvPBattleSystem', m.getPvPBattleSystem);
      addTest('F5: getDefenseFormationSystem', m.getDefenseFormationSystem);
      addTest('F6: getArenaShopSystem', m.getArenaShopSystem);
      addTest('F7: getFriendSystem', m.getFriendSystem);
      addTest('F8: getChatSystem', m.getChatSystem);

      if (apiCheck.arenaInfo.available) {
        addTest('F9: 竞技场玩家状态', true,
          `rank=${apiCheck.arenaInfo.rankId}, score=${apiCheck.arenaInfo.score}`);
      }
      addTest('F10: 好友系统可用', apiCheck.friendInfo.available ?? false);
      addTest('F11: 聊天系统可用', apiCheck.chatInfo.available ?? false);
    }

    // ═══ G. 数据完整性 + 移动端 ═══
    console.log('\n── G. 数据完整性 + 移动端 ──');
    const bodyText = await page.evaluate(() => document.body.innerText);
    addTest('G1: 无NaN显示', !bodyText.includes('NaN'));
    addTest('G2: 无undefined显示', !bodyText.includes('undefined'));

    await page.setViewport({ width: 375, height: 667 });
    await new Promise(r => setTimeout(r, 1500));
    await screenshot(page, 'v11-G3-mobile');
    const mobileOk = await page.evaluate(() => document.body.innerText.length > 50);
    addTest('G3: 移动端渲染', mobileOk);

    const severeErrors = consoleErrors.filter(e =>
      !e.includes('favicon') && !e.includes('404') && !e.includes('Warning:')
    );
    addTest('G4: 无严重控制台错误', severeErrors.length === 0,
      severeErrors.length > 0 ? `${severeErrors.length}个错误` : '');

  } catch (e) {
    addTest('运行异常', 'FAIL', e.message);
  } finally {
    await browser.close();
  }

  const resultFile = path.join(__dirname, 'v11-evolution-ui-results.json');
  fs.writeFileSync(resultFile, JSON.stringify(results, null, 2));
  const { passed, failed, skipped, total } = results.summary;
  console.log(`\n═══ 结果: ${passed}/${total} 通过, ${failed} 失败, ${skipped} 跳过 ═══\n`);
  if (failed > 0) process.exitCode = 1;
}

run().catch(e => { console.error(e); process.exitCode = 1; });
