/**
 * renderer/scenes/AgeOfEmpiresScene.ts — 帝国时代专属场景
 *
 * 帝国主题（棕金配色），城镇地图，资源采集，科技升级树。
 * 所有 UI 元素使用 PixiJS Graphics 程序化绘制。
 *
 * 布局结构：
 * ┌────────────────────────────────────────────────────────┐
 * │          资源栏（食物/木材/石头）+ 时代指示器           │
 * ├──────────────────────────────────┬─────────────────────┤
 * │                                  │                     │
 * │          城镇地图区域            │   科技升级树        │
 * │    （建筑布局+资源采集点）       │   （科技节点）      │
 * │                                  │                     │
 * ├──────────────────────────────────┴─────────────────────┤
 * │               建筑升级面板（底部）                       │
 * └────────────────────────────────────────────────────────┘
 *
 * @module renderer/scenes/AgeOfEmpiresScene
 */

import { Container, Graphics, Text } from 'pixi.js';
import type { RenderStrategy, IdleGameRenderState } from '../types';

// ═══════════════════════════════════════════════════════════════
// 事件类型
// ═══════════════════════════════════════════════════════════════

export interface AgeOfEmpiresSceneEventMap {
  upgradeClick: [upgradeId: string];
  techClick: [techId: string];
  ageAdvance: [];
}

type SceneEventCallback = (...args: any[]) => void;

// ═══════════════════════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════════════════════

function formatNumber(n: number): string {
  if (n >= 1e15) return (n / 1e15).toFixed(1) + 'Qa';
  if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  if (n < 10) return n.toFixed(1);
  return Math.floor(n).toString();
}

function hexToNum(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

// ═══════════════════════════════════════════════════════════════
// AgeOfEmpiresScene
// ═══════════════════════════════════════════════════════════════

/**
 * 帝国时代专属场景
 *
 * 帝国主题，包含城镇地图、资源采集和科技升级树。
 */
export class AgeOfEmpiresScene {
  // ─── PixiJS 对象 ────────────────────────────────────────

  private container: Container;
  private resourceBar: Container;
  private resourceBarBg: Graphics;
  private resourceTexts: Text[] = [];

  private townMap: Container;
  private townMapBg: Graphics;
  private townBuildings: Container[] = [];

  private techTree: Container;
  private techTreeBg: Graphics;
  private techNodes: Container[] = [];

  private buildingPanel: Container;
  private buildingPanelBg: Graphics;
  private buildingButtons: Container[] = [];

  private ageIndicator: Container;
  private ageIndicatorBg: Graphics;
  private ageTexts: Text[] = [];

  private titleText: Text;

  // ─── 配置 ───────────────────────────────────────────────

  private strategy: RenderStrategy;

  // ─── 状态 ───────────────────────────────────────────────

  private active: boolean = false;
  private currentState: IdleGameRenderState | null = null;
  private canvasWidth: number = 800;
  private canvasHeight: number = 600;
  private currentAge: string = 'dark_age';

  // ─── 事件 ───────────────────────────────────────────────

  private listeners: Map<string, Set<SceneEventCallback>> = new Map();

  // ═══════════════════════════════════════════════════════════
  // 构造函数
  // ═══════════════════════════════════════════════════════════

  constructor(strategy: RenderStrategy) {
    this.strategy = strategy;

    this.container = new Container({ label: 'age-of-empires-scene' });

    // 资源栏
    this.resourceBar = new Container({ label: 'aoe-resource-bar' });
    this.resourceBarBg = new Graphics();
    this.resourceBar.addChild(this.resourceBarBg);

    // 城镇地图
    this.townMap = new Container({ label: 'aoe-town-map' });
    this.townMapBg = new Graphics();
    this.townMap.addChild(this.townMapBg);

    // 科技树
    this.techTree = new Container({ label: 'aoe-tech-tree' });
    this.techTreeBg = new Graphics();
    this.techTree.addChild(this.techTreeBg);

    // 建筑面板
    this.buildingPanel = new Container({ label: 'aoe-building-panel' });
    this.buildingPanelBg = new Graphics();
    this.buildingPanel.addChild(this.buildingPanelBg);

    // 时代指示器
    this.ageIndicator = new Container({ label: 'aoe-age-indicator' });
    this.ageIndicatorBg = new Graphics();
    this.ageIndicator.addChild(this.ageIndicatorBg);

    // 标题
    this.titleText = new Text({
      text: '',
      style: { fontSize: 16, fill: hexToNum(strategy.theme.accent), fontWeight: 'bold' },
    });
    this.titleText.visible = false;

    // 组装
    this.container.addChild(this.resourceBar);
    this.container.addChild(this.townMap);
    this.container.addChild(this.techTree);
    this.container.addChild(this.buildingPanel);
    this.container.addChild(this.ageIndicator);
    this.container.addChild(this.titleText);
  }

  // ═══════════════════════════════════════════════════════════
  // 生命周期
  // ═══════════════════════════════════════════════════════════

  async enter(): Promise<void> {
    this.container.visible = true;
    this.active = true;
    this.layout();
  }

  async exit(): Promise<void> {
    this.active = false;
    this.container.visible = false;
  }

  update(deltaTime: number): void {
    if (!this.active) return;
    void deltaTime;
  }

  destroy(): void {
    this.active = false;
    this.container.destroy({ children: true });
    this.listeners.clear();
  }

  // ═══════════════════════════════════════════════════════════
  // 状态更新
  // ═══════════════════════════════════════════════════════════

  updateState(state: IdleGameRenderState): void {
    if (!this.active) return;
    this.currentState = state;
    this.renderResourceBar(state);
    this.renderTownMap(state);
    this.renderTechTree(state);
    this.renderBuildingPanel(state);
    this.renderAgeIndicator(state);
    this.renderTitle(state);
  }

  // ═══════════════════════════════════════════════════════════
  // 响应式布局
  // ═══════════════════════════════════════════════════════════

  resize(width: number, height: number): void {
    this.canvasWidth = width;
    this.canvasHeight = height;
    this.layout();
    if (this.currentState) this.updateState(this.currentState);
  }

  // ═══════════════════════════════════════════════════════════
  // 公共访问器
  // ═══════════════════════════════════════════════════════════

  getContainer(): Container { return this.container; }
  isActive(): boolean { return this.active; }
  getCurrentState(): IdleGameRenderState | null { return this.currentState; }

  /** 设置当前时代 */
  setAge(age: string): void {
    this.currentAge = age;
    if (this.currentState) this.renderAgeIndicator(this.currentState);
  }

  /** 获取当前时代 */
  getAge(): string {
    return this.currentAge;
  }

  // ═══════════════════════════════════════════════════════════
  // 事件系统
  // ═══════════════════════════════════════════════════════════

  on(event: string, callback: SceneEventCallback): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: SceneEventCallback): void {
    this.listeners.get(event)?.delete(callback);
  }

  // ═══════════════════════════════════════════════════════════
  // 内部方法 — 布局
  // ═══════════════════════════════════════════════════════════

  private layout(): void {
    const { layout, theme } = this.strategy;
    const w = this.canvasWidth;
    const h = this.canvasHeight;
    const br = layout.borderRadius;

    // ── 资源栏（顶部）─────────────────────────────────────
    const rbH = h * 0.08;
    this.resourceBar.position.set(0, 0);
    this.resourceBarBg.clear();
    this.resourceBarBg.roundRect(0, 0, w, rbH, br);
    this.resourceBarBg.fill(hexToNum(theme.resourceBarBg));

    // ── 城镇地图（左中）───────────────────────────────────
    const tmW = w * 0.55;
    const tmH = h * 0.5;
    const tmY = rbH;
    this.townMap.position.set(0, tmY);
    this.townMapBg.clear();
    this.townMapBg.roundRect(0, 0, tmW, tmH, 0);
    this.townMapBg.fill(hexToNum(theme.background));

    // ── 科技树（右中）─────────────────────────────────────
    const ttW = w * 0.25;
    const ttH = h * 0.5;
    this.techTree.position.set(tmW, tmY);
    this.techTreeBg.clear();
    this.techTreeBg.roundRect(0, 0, ttW, ttH, br);
    this.techTreeBg.fill(hexToNum(theme.panelBackground));

    // ── 建筑面板（底部）───────────────────────────────────
    const bpW = w;
    const bpH = h * 0.38;
    const bpY = rbH + tmH;
    this.buildingPanel.position.set(0, bpY);
    this.buildingPanelBg.clear();
    this.buildingPanelBg.roundRect(0, 0, bpW, bpH, br);
    this.buildingPanelBg.fill(hexToNum(theme.panelBackground));

    // ── 时代指示器（右上角）───────────────────────────────
    this.ageIndicator.position.set(w - 130, 0);
    this.ageIndicatorBg.clear();
    this.ageIndicatorBg.roundRect(0, 0, 130, 30, br);
    this.ageIndicatorBg.fill(hexToNum(theme.panelBackground));

    this.titleText.position.set(layout.padding, layout.padding);
  }

  // ═══════════════════════════════════════════════════════════
  // 内部方法 — 渲染
  // ═══════════════════════════════════════════════════════════

  private renderResourceBar(state: IdleGameRenderState): void {
    const { theme, layout } = this.strategy;
    const p = layout.padding;

    for (const t of this.resourceTexts) t.destroy();
    this.resourceTexts = [];

    let x = p;
    const y = (this.canvasHeight * 0.08) / 2;

    const icons: Record<string, string> = { food: '🍖', wood: '🪵', stone: '🪨' };

    for (const res of state.resources) {
      const icon = icons[res.id] || '📦';
      const text = new Text({
        text: `${icon} ${res.name}: ${formatNumber(res.amount)}`,
        style: { fontSize: 13, fill: hexToNum(theme.textPrimary), fontFamily: 'monospace' },
      });
      text.anchor.set(0, 0.5);
      text.position.set(x, y);
      this.resourceBar.addChild(text);
      this.resourceTexts.push(text);

      if (res.perSecond > 0) {
        const rateText = new Text({
          text: ` +${formatNumber(res.perSecond)}/s`,
          style: { fontSize: 10, fill: hexToNum(theme.success), fontFamily: 'monospace' },
        });
        rateText.anchor.set(0, 0.5);
        rateText.position.set(x + text.width + 2, y);
        this.resourceBar.addChild(rateText);
        this.resourceTexts.push(rateText);
        x += text.width + rateText.width + 20;
      } else {
        x += text.width + 20;
      }
    }
  }

  private renderTownMap(state: IdleGameRenderState): void {
    const { theme, layout } = this.strategy;

    for (const b of this.townBuildings) b.destroy();
    this.townBuildings = [];

    const tmW = this.canvasWidth * 0.55;
    const tmH = this.canvasHeight * 0.5;
    const p = layout.padding;

    // 标题
    const title = new Text({
      text: '🏘️ 城镇地图',
      style: { fontSize: 13, fill: hexToNum(theme.accent), fontWeight: 'bold' },
    });
    title.position.set(p, p);
    this.townMap.addChild(title);
    this.townBuildings.push(title);

    // 城镇建筑网格（3x3）
    const buildingIcons = ['🌾', '🏗️', '⛏️', '🏠', '🏰', '⛪', '🏪', '⚒️', '🏛️'];
    const buildingNames = ['农田', '伐木场', '采石场', '民居', '城堡', '教堂', '市场', '铁匠铺', '学院'];
    const gridCols = 3;
    const gridRows = 3;
    const cellW = (tmW - p * 2) / gridCols;
    const cellH = (tmH - 40) / gridRows;

    for (let i = 0; i < 9; i++) {
      const col = i % gridCols;
      const row = Math.floor(i / gridCols);
      const x = p + col * cellW + cellW / 2;
      const y = 30 + row * cellH + cellH / 2;

      const buildingContainer = new Container({ label: `town-building-${i}` });
      buildingContainer.position.set(x, y);

      // 建筑背景（方形）
      const bg = new Graphics();
      bg.roundRect(-22, -22, 44, 44, 6);
      bg.fill(hexToNum(theme.panelBackground));
      bg.stroke({ color: hexToNum(theme.accent), width: 1 });
      buildingContainer.addChild(bg);

      // 建筑图标
      const iconText = new Text({
        text: buildingIcons[i],
        style: { fontSize: 16 },
      });
      iconText.anchor.set(0.5, 0.3);
      buildingContainer.addChild(iconText);

      // 建筑名称
      const nameText = new Text({
        text: buildingNames[i],
        style: { fontSize: 9, fill: hexToNum(theme.textSecondary) },
      });
      nameText.anchor.set(0.5);
      nameText.position.set(0, 16);
      buildingContainer.addChild(nameText);

      this.townMap.addChild(buildingContainer);
      this.townBuildings.push(buildingContainer);
    }
  }

  private renderTechTree(state: IdleGameRenderState): void {
    const { theme, layout } = this.strategy;
    const p = layout.padding;

    for (const node of this.techNodes) node.destroy();
    this.techNodes = [];

    let y = p;

    // 标题
    const title = new Text({
      text: '🔬 科技树',
      style: { fontSize: 13, fill: hexToNum(theme.accent), fontWeight: 'bold' },
    });
    title.position.set(p, y);
    this.techTree.addChild(title);
    this.techNodes.push(title);
    y += 22;

    // 科技节点（分层显示）
    const techs = [
      { name: '农业学', tier: 1, icon: '🌾' },
      { name: '采矿业', tier: 1, icon: '⛏️' },
      { name: '建筑学', tier: 2, icon: '🏗️' },
      { name: '冶金术', tier: 2, icon: '⚒️' },
      { name: '工程学', tier: 3, icon: '⚙️' },
      { name: '天文学', tier: 3, icon: '🔭' },
    ];

    for (const tech of techs) {
      const nodeContainer = new Container({ label: `tech-${tech.name}` });
      nodeContainer.position.set(p, y);

      // 节点背景
      const bg = new Graphics();
      const nodeW = this.canvasWidth * 0.25 - p * 2;
      bg.roundRect(0, 0, nodeW, 28, 4);
      bg.fill(hexToNum(theme.panelBackground));
      bg.stroke({ color: hexToNum(theme.accent), width: 1 });
      nodeContainer.addChild(bg);

      // 科技信息
      const techText = new Text({
        text: `${tech.icon} ${tech.name} (T${tech.tier})`,
        style: { fontSize: 10, fill: hexToNum(theme.textPrimary) },
      });
      techText.position.set(4, 4);
      nodeContainer.addChild(techText);

      // 层级指示
      const tierText = new Text({
        text: '🔒',
        style: { fontSize: 10, fill: hexToNum(theme.textSecondary) },
      });
      tierText.position.set(nodeW - 20, 6);
      nodeContainer.addChild(tierText);

      nodeContainer.eventMode = 'static';
      nodeContainer.cursor = 'pointer';
      nodeContainer.on('pointertap', () => {
        this.emit('techClick', tech.name);
      });

      this.techTree.addChild(nodeContainer);
      this.techNodes.push(nodeContainer);
      y += 34;
    }

    // 声望
    y += 8;
    const prestigeTitle = new Text({
      text: '👑 帝国荣耀',
      style: { fontSize: 12, fill: hexToNum(theme.accent), fontWeight: 'bold' },
    });
    prestigeTitle.position.set(p, y);
    this.techTree.addChild(prestigeTitle);
    this.techNodes.push(prestigeTitle);
    y += 18;

    const prestigeText = new Text({
      text: `荣耀: ${formatNumber(state.prestige.currency)}`,
      style: { fontSize: 11, fill: hexToNum(theme.textPrimary) },
    });
    prestigeText.position.set(p, y);
    this.techTree.addChild(prestigeText);
    this.techNodes.push(prestigeText);
    y += 16;

    const countText = new Text({
      text: `转生: ${state.prestige.count}次`,
      style: { fontSize: 11, fill: hexToNum(theme.textSecondary) },
    });
    countText.position.set(p, y);
    this.techTree.addChild(countText);
    this.techNodes.push(countText);
  }

  private renderBuildingPanel(state: IdleGameRenderState): void {
    const { theme, layout } = this.strategy;
    const p = layout.padding;
    const gap = layout.gridGap;
    const cols = 4;

    for (const btn of this.buildingButtons) btn.destroy();
    this.buildingButtons = [];

    const title = new Text({
      text: '🏗️ 建筑升级',
      style: { fontSize: 13, fill: hexToNum(theme.accent), fontWeight: 'bold' },
    });
    title.position.set(p, p);
    this.buildingPanel.addChild(title);
    this.buildingButtons.push(title);

    const btnW = Math.max(60, (this.canvasWidth - p * 2 - gap * (cols - 1)) / cols);
    const btnH = 55;

    for (let i = 0; i < state.upgrades.length; i++) {
      const upgrade = state.upgrades[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = p + col * (btnW + gap);
      const y = p + 22 + row * (btnH + gap);

      const btnContainer = new Container({ label: `aoe-upgrade-${upgrade.id}` });
      btnContainer.position.set(x, y);
      btnContainer.eventMode = 'static';
      btnContainer.cursor = 'pointer';

      const bg = new Graphics();
      const bgColor = upgrade.canAfford ? theme.buttonBg : theme.panelBackground;
      const borderColor = upgrade.canAfford ? theme.success : theme.textSecondary;
      bg.roundRect(0, 0, btnW, btnH, layout.borderRadius);
      bg.fill(hexToNum(bgColor));
      bg.stroke({ color: hexToNum(borderColor), width: 1 });
      btnContainer.addChild(bg);

      const nameText = new Text({
        text: `${upgrade.name} Lv.${upgrade.level}`,
        style: {
          fontSize: 10,
          fill: hexToNum(upgrade.canAfford ? theme.textPrimary : theme.textSecondary),
          fontWeight: 'bold',
        },
      });
      nameText.position.set(4, 4);
      btnContainer.addChild(nameText);

      const costStr = Object.entries(upgrade.baseCost)
        .map(([k, v]) => `${v}${k}`)
        .join(' ');
      const costText = new Text({
        text: costStr,
        style: { fontSize: 9, fill: hexToNum(upgrade.canAfford ? theme.success : theme.warning) },
      });
      costText.position.set(4, 20);
      btnContainer.addChild(costText);

      btnContainer.on('pointertap', () => {
        this.emit('upgradeClick', upgrade.id);
      });

      this.buildingPanel.addChild(btnContainer);
      this.buildingButtons.push(btnContainer);
    }
  }

  private renderAgeIndicator(state: IdleGameRenderState): void {
    const { theme, layout } = this.strategy;
    const p = layout.padding;

    for (const t of this.ageTexts) t.destroy();
    this.ageTexts = [];

    // 时代名称
    const ageNames: Record<string, { name: string; icon: string }> = {
      dark_age: { name: '黑暗时代', icon: '🌑' },
      feudal_age: { name: '封建时代', icon: '🏰' },
      castle_age: { name: '城堡时代', icon: '⚔️' },
      imperial_age: { name: '帝王时代', icon: '👑' },
    };

    const ageInfo = ageNames[this.currentAge] || { name: '黑暗时代', icon: '🌑' };

    const ageText = new Text({
      text: `${ageInfo.icon} ${ageInfo.name}`,
      style: { fontSize: 12, fill: hexToNum(theme.accent), fontWeight: 'bold' },
    });
    ageText.position.set(8, 8);
    this.ageIndicator.addChild(ageText);
    this.ageTexts.push(ageText);

    // 时代进度点
    const ages = ['dark_age', 'feudal_age', 'castle_age', 'imperial_age'];
    const currentIdx = ages.indexOf(this.currentAge);
    for (let i = 0; i < ages.length; i++) {
      const dot = new Graphics();
      dot.circle(8 + i * 14, 24, 3);
      dot.fill(hexToNum(i <= currentIdx ? theme.accent : theme.textSecondary));
      this.ageIndicator.addChild(dot);
      this.ageTexts.push(dot as any);
    }
  }

  private renderTitle(state: IdleGameRenderState): void {
    this.titleText.text = `👑 ${state.gameId}`;
    this.titleText.visible = true;
  }

  private emit(event: string, ...args: any[]): void {
    this.listeners.get(event)?.forEach((cb) => {
      try { cb(...args); } catch (err) { console.error(`[AgeOfEmpiresScene] Error in event "${event}":`, err); }
    });
  }
}
