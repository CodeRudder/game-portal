const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  
  await page.goto('http://localhost:3000/idle/three-kingdoms', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(3000);
  
  // 提取DOM结构
  const domInfo = await page.evaluate(() => {
    const result = {};
    
    // 资源栏区域
    const resourceBar = document.querySelector('.tk-resource-bar');
    if (resourceBar) {
      result.resourceBarClasses = resourceBar.innerHTML.substring(0, 500);
      result.resourceBarChildren = Array.from(resourceBar.children).map(c => ({
        tag: c.tagName,
        classes: c.className,
        text: c.textContent?.substring(0, 50)
      }));
    }
    
    // 建筑面板
    const buildingPanel = document.querySelector('.tk-building-panel');
    if (buildingPanel) {
      result.buildingPanelChildren = Array.from(buildingPanel.children).slice(0, 5).map(c => ({
        tag: c.tagName,
        classes: c.className,
        text: c.textContent?.substring(0, 80)
      }));
    }
    
    // 查找所有包含"升级"的按钮
    const buttons = Array.from(document.querySelectorAll('button'));
    result.upgradeButtons = buttons
      .filter(b => b.textContent?.includes('升级'))
      .map(b => ({ classes: b.className, text: b.textContent?.substring(0, 50) }));
    result.allButtonTexts = buttons.map(b => b.textContent?.trim()).filter(t => t).slice(0, 20);
    
    // 查找资源相关元素
    const allClasses = new Set();
    document.querySelectorAll('*').forEach(el => {
      el.classList.forEach(c => { if (c.startsWith('tk-')) allClasses.add(c); });
    });
    result.tkClasses = Array.from(allClasses).sort();
    
    // localStorage
    result.saveKeys = Object.keys(localStorage).filter(k => k.includes('three') || k.includes('kingdom'));
    
    return result;
  });
  
  console.log(JSON.stringify(domInfo, null, 2));
  
  await browser.close();
})();
