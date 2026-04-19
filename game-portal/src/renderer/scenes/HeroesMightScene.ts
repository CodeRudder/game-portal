/**
 * renderer/scenes/HeroesMightScene.ts — 英雄无敌专属场景
 *
 * 奇幻主题（紫金配色），冒险地图，英雄队伍，技能面板。
 * 所有 UI 元素使用 PixiJS Graphics 程序化绘制。
 *
 * 布局结构：
 * ┌────────────────────────────────────────────────────────┐
 * │            资源栏（金币/宝石/魔法水晶）                  │
 * ├──────────────────────────────────┬─────────────────────┤
 * │                                  │                     │
 * │          冒险地图区域            │   英雄队伍面板      │
 * │    （奇幻地形+探索节点）         │   （英雄列表）      │
 * │                                  │                     │
 * ├──────────────────────────────────┼─────────────────────┤
 * │          建筑升级面板            │    技能面板         │
 * └──────────────────────────────────┴─────────────────────┘
 *
 * @module renderer/scenes/HeroesMightScene
 */

import { Container, Graphics, Text } from 'pixi.js';
import type { RenderStrategy, IdleGameRenderState } from '../types';

// ═══════════════════════════════════════════════════════════════
// 事件类型
// ═══════════════════════════════════════════════════════════════

export interface HeroesMightSceneEventMap {
  upgradeClick: [upgradeId: string];
  heroClick: [heroId: string];
  spellCast: [spellId: string];
  heroEvolve: [heroId: string];
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
// HeroesMightScene
// ═══════════════════════════════════════════════════════════════

/**
 * 英雄无敌专属场景
 *
 * 奇幻主题，包含冒险地图、英雄队伍和技能面板。
 */
export class HeroesMightScene {
  // ─── PixiJS 对象 ────────────────────────────────────────

  private container: Container;
  private resourceBar: Container;
  private resourceBarBg: Graphics;
  private resourceTexts: Text[] = [];

  private adventureMap: Container;
  private adventureMapBg: Graphics;
  private mapNodes: Container[] = [];

  private heroPanel: Container;
  private heroPanelBg: Graphics;
  private heroCards: Container[] = [];

  private buildingPanel: Container;
  private buildingPanelBg: Graphics;
  private buildingButtons: Container[] = [];

  private spellPanel: Container;
  private spellPanelBg: Graphics;
  private spellButtons: Container[] = [];

  private titleText: Text;
  private magicAura: Graphics;

  // ─── 配置 ───────────────────────────────────────────────

  private strategy: RenderStrategy;

  // ─── 状态 ───────────────────────────────────────────────

  private active: boolean = false;
  private currentState: IdleGameRenderState | null = null;
  private canvasWidth: number = 800;
  private canvasHeight: number = 600;

  // ─── 事件 ───────────────────────────────────────────────

  private listeners: Map<string, Set<SceneEventCallback>> = new Map();

  // ─── 动画 ───────────────────────────────────────────────

  private animTimer: number = 0;

  // ═══════════════════════════════════════════════════════════
  // 构造函数
  // ═══════════════════════════════════════════════════════════

  constructor(strategy: RenderStrategy) {
    this.strategy = strategy;

    this.container = new Container({ label: 'heroes-might-scene' });

    // 资源栏
    this.resourceBar = new Container({ label: 'hm-resource-bar' });
    this.resourceBarBg = new Graphics();
    this.resourceBar.addChild(this.resourceBarBg);

    // 冒险地图
    this.adventureMap = new Container({ label: 'hm-adventure-map' });
    this.adventureMapBg = new Graphics();
    this.adventureMap.addChild(this.adventureMapBg);

    // 英雄面板
    this.heroPanel = new Container({ label: 'hm-hero-panel' });
    this.heroPanelBg = new Graphics();
    this.heroPanel.addChild(this.heroPanelBg);

    // 建筑面板
    this.buildingPanel = new Container({ label: 'hm-building-panel' });
    this.buildingPanelBg = new Graphics();
    this.buildingPanel.addChild(this.buildingPanelBg);

    // 技能面板
    this.spellPanel = new Container({ label: 'hm-spell-panel' });
    this.spellPanelBg = new Graphics();
    this.spellPanel.addChild(this.spellPanelBg);

    // 标题
    this.titleText = new Text({
      text: '',
      style: { fontSize: 16, fill: hexToNum(strategy.theme.accent), fontWeight: 'bold' },
    });
    this.titleText.visible = false;

    // 魔法光环
    this.magicAura = new Graphics();

    // 组装
    this.container.addChild(this.resourceBar);
    this.container.addChild(this.adventureMap);
    this.container.addChild(this.heroPanel);
    this.container.addChild(this.buildingPanel);
    this.container.addChild(this.spellPanel);
    this.container.addChild(this.titleText);
    this.container.addChild(this.magicAura);
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
    this.animTimer += deltaTime;
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
    this.renderAdventureMap(state);
    this.renderHeroPanel(state);
    this.renderBuildingPanel(state);
    this.renderSpellPanel(state);
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
  getAnimTimer(): number { return this.animTimer; }

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

    // ── 冒险地图（左中）───────────────────────────────────
    const mapW = w * 0.55;
    const mapH = h * 0.5;
    const mapY = rbH;
    this.adventureMap.position.set(0, mapY);
    this.adventureMapBg.clear();
    this.adventureMapBg.roundRect(0, 0, mapW, mapH, 0);
    this.adventureMapBg.fill(hexToNum(theme.background));

    // ── 英雄面板（右中）───────────────────────────────────
    const hpW = w * 0.25;
    const hpH = h * 0.5;
    this.heroPanel.position.set(mapW, mapY);
    this.heroPanelBg.clear();
    this.heroPanelBg.roundRect(0, 0, hpW, hpH, br);
    this.heroPanelBg.fill(hexToNum(theme.panelBackground));

    // ── 建筑面板（左下）───────────────────────────────────
    const bpW = w * 0.55;
    const bpH = h * 0.38;
    const bpY = rbH + mapH;
    this.buildingPanel.position.set(0, bpY);
    this.buildingPanelBg.clear();
    this.buildingPanelBg.roundRect(0, 0, bpW, bpH, br);
    this.buildingPanelBg.fill(hexToNum(theme.panelBackground));

    // ── 技能面板（右下）───────────────────────────────────
    const spW = w * 0.25;
    const spH = h * 0.38;
    this.spellPanel.position.set(bpW, bpY);
    this.spellPanelBg.clear();
    this.spellPanelBg.roundRect(0, 0, spW, spH, br);
    this.spellPanelBg.fill(hexToNum(theme.panelBackground));

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

    const icons: Record<string, string> = { gold: '🪙', gem: '💎', crystal: '🔮' };

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

  private renderAdventureMap(state: IdleGameRenderState): void {
    const { theme, layout } = this.strategy;

    for (const node of this.mapNodes) node.destroy();
    this.mapNodes = [];

    const mapW = this.canvasWidth * 0.55;
    const mapH = this.canvasHeight * 0.5;
    const p = layout.padding;

    // 标题
    const title = new Text({
      text: '🗺️ 冒险地图',
      style: { fontSize: 13, fill: hexToNum(theme.accent), fontWeight: 'bold' },
    });
    title.position.set(p, p);
    this.adventureMap.addChild(title);
    this.mapNodes.push(title);

    // 奇幻地形节点（城堡、森林、山脉、矿洞、神殿、沼泽）
    const locations = [
      { name: '城堡', icon: '🏰', x: 0.5, y: 0.2 },
      { name: '森林', icon: '🌲', x: 0.2, y: 0.4 },
      { name: '山脉', icon: '⛰️', x: 0.8, y: 0.35 },
      { name: '矿洞', icon: '⛏️', x: 0.3, y: 0.7 },
      { name: '神殿', icon: '🏛️', x: 0.7, y: 0.65 },
      { name: '沼泽', icon: '🌿', x: 0.5, y: 0.85 },
    ];

    for (const loc of locations) {
      const x = p + (mapW - p * 2) * loc.x;
      const y = 30 + (mapH - 50) * loc.y;

      const nodeContainer = new Container({ label: `map-${loc.name}` });
      nodeContainer.position.set(x, y);

      // 节点背景（菱形）
      const bg = new Graphics();
      bg.moveTo(0, -16);
      bg.lineTo(16, 0);
      bg.lineTo(0, 16);
      bg.lineTo(-16, 0);
      bg.closePath();
      bg.fill(hexToNum(theme.panelBackground));
      bg.stroke({ color: hexToNum(theme.accent), width: 1.5 });
      nodeContainer.addChild(bg);

      // 图标
      const iconText = new Text({
        text: loc.icon,
        style: { fontSize: 12 },
      });
      iconText.anchor.set(0.5);
      nodeContainer.addChild(iconText);

      this.adventureMap.addChild(nodeContainer);
      this.mapNodes.push(nodeContainer);
    }
  }

  private renderHeroPanel(state: IdleGameRenderState): void {
    const { theme, layout } = this.strategy;
    const p = layout.padding;

    for (const card of this.heroCards) card.destroy();
    this.heroCards = [];

    let y = p;

    // 标题
    const title = new Text({
      text: '🦸 英雄队伍',
      style: { fontSize: 13, fill: hexToNum(theme.accent), fontWeight: 'bold' },
    });
    title.position.set(p, y);
    this.heroPanel.addChild(title);
    this.heroCards.push(title);
    y += 22;

    // 英雄列表（6种）
    const heroNames = ['骑士', '法师', '游侠', '牧师', '龙骑', '暗影'];
    const heroIcons = ['🗡️', '🔮', '🏹', '✝️', '🐉', '🌑'];
    const rarities = ['★', '★★', '★★', '★★★', '★★★', '★★★★'];

    for (let i = 0; i < heroNames.length; i++) {
      const cardContainer = new Container({ label: `hero-${i}` });
      cardContainer.position.set(p, y);

      // 卡片背景
      const bg = new Graphics();
      bg.roundRect(0, 0, this.canvasWidth * 0.25 - p * 2, 30, 4);
      bg.fill(hexToNum(theme.panelBackground));
      bg.stroke({ color: hexToNum(theme.accent), width: 1 });
      cardContainer.addChild(bg);

      // 英雄信息
      const heroText = new Text({
        text: `${heroIcons[i]} ${heroNames[i]} ${rarities[i]}`,
        style: { fontSize: 11, fill: hexToNum(theme.textPrimary) },
      });
      heroText.position.set(4, 4);
      cardContainer.addChild(heroText);

      // 进化等级
      const evoText = new Text({
        text: `Evo.0`,
        style: { fontSize: 9, fill: hexToNum(theme.success) },
      });
      evoText.position.set(4, 18);
      cardContainer.addChild(evoText);

      cardContainer.eventMode = 'static';
      cardContainer.cursor = 'pointer';
      cardContainer.on('pointertap', () => {
        this.emit('heroClick', `hero-${i}`);
      });

      this.heroPanel.addChild(cardContainer);
      this.heroCards.push(cardContainer);
      y += 35;
    }

    // 声望
    y += 8;
    const prestigeTitle = new Text({
      text: '👑 荣耀勋章',
      style: { fontSize: 12, fill: hexToNum(theme.accent), fontWeight: 'bold' },
    });
    prestigeTitle.position.set(p, y);
    this.heroPanel.addChild(prestigeTitle);
    this.heroCards.push(prestigeTitle);
    y += 18;

    const prestigeText = new Text({
      text: `勋章: ${formatNumber(state.prestige.currency)}`,
      style: { fontSize: 11, fill: hexToNum(theme.textPrimary) },
    });
    prestigeText.position.set(p, y);
    this.heroPanel.addChild(prestigeText);
    this.heroCards.push(prestigeText);
    y += 16;

    const countText = new Text({
      text: `转生: ${state.prestige.count}次`,
      style: { fontSize: 11, fill: hexToNum(theme.textSecondary) },
    });
    countText.position.set(p, y);
    this.heroPanel.addChild(countText);
    this.heroCards.push(countText);
  }

  private renderBuildingPanel(state: IdleGameRenderState): void {
    const { theme, layout } = this.strategy;
    const p = layout.padding;
    const gap = layout.gridGap;
    const cols = 4;

    for (const btn of this.buildingButtons) btn.destroy();
    this.buildingButtons = [];

    const title = new Text({
      text: '🏗️ 城堡建筑',
      style: { fontSize: 13, fill: hexToNum(theme.accent), fontWeight: 'bold' },
    });
    title.position.set(p, p);
    this.buildingPanel.addChild(title);
    this.buildingButtons.push(title);

    const btnW = Math.max(60, (this.canvasWidth * 0.55 - p * 2 - gap * (cols - 1)) / cols);
    const btnH = 55;

    for (let i = 0; i < state.upgrades.length; i++) {
      const upgrade = state.upgrades[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = p + col * (btnW + gap);
      const y = p + 22 + row * (btnH + gap);

      const btnContainer = new Container({ label: `hm-upgrade-${upgrade.id}` });
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

  private renderSpellPanel(state: IdleGameRenderState): void {
    const { theme, layout } = this.strategy;
    const p = layout.padding;

    for (const btn of this.spellButtons) btn.destroy();
    this.spellButtons = [];

    let y = p;

    // 标题
    const title = new Text({
      text: '✨ 技能面板',
      style: { fontSize: 13, fill: hexToNum(theme.accent), fontWeight: 'bold' },
    });
    title.position.set(p, y);
    this.spellPanel.addChild(title);
    this.spellButtons.push(title);
    y += 22;

    // 魔法列表
    const spells = [
      { name: '火球术', icon: '🔥', cost: '🔮50' },
      { name: '治疗术', icon: '💚', cost: '🔮30' },
      { name: '加速术', icon: '⚡', cost: '🔮80' },
      { name: '护盾术', icon: '🛡️', cost: '🔮60' },
    ];

    for (const spell of spells) {
      const btnContainer = new Container({ label: `spell-${spell.name}` });
      btnContainer.position.set(p, y);
      btnContainer.eventMode = 'static';
      btnContainer.cursor = 'pointer';

      const bg = new Graphics();
      bg.roundRect(0, 0, this.canvasWidth * 0.25 - p * 2, 35, layout.borderRadius);
      bg.fill(hexToNum(theme.buttonBg));
      bg.stroke({ color: hexToNum(theme.accent), width: 1 });
      btnContainer.addChild(bg);

      const spellText = new Text({
        text: `${spell.icon} ${spell.name}`,
        style: { fontSize: 11, fill: hexToNum(theme.textPrimary), fontWeight: 'bold' },
      });
      spellText.position.set(6, 4);
      btnContainer.addChild(spellText);

      const costText = new Text({
        text: spell.cost,
        style: { fontSize: 9, fill: hexToNum(theme.warning) },
      });
      costText.position.set(6, 20);
      btnContainer.addChild(costText);

      btnContainer.on('pointertap', () => {
        this.emit('spellCast', spell.name);
      });

      this.spellPanel.addChild(btnContainer);
      this.spellButtons.push(btnContainer);
      y += 40;
    }

    // 统计
    y += 8;
    const statsTitle = new Text({
      text: '📊 统计',
      style: { fontSize: 12, fill: hexToNum(theme.accent), fontWeight: 'bold' },
    });
    statsTitle.position.set(p, y);
    this.spellPanel.addChild(statsTitle);
    this.spellButtons.push(statsTitle);
    y += 18;

    const entries = Object.entries(state.statistics).slice(0, 5);
    for (const [key, value] of entries) {
      const text = new Text({
        text: `${key}: ${formatNumber(value)}`,
        style: { fontSize: 10, fill: hexToNum(theme.textSecondary) },
      });
      text.position.set(p, y);
      this.spellPanel.addChild(text);
      this.spellButtons.push(text);
      y += 15;
    }
  }

  private renderTitle(state: IdleGameRenderState): void {
    this.titleText.text = `🏰 ${state.gameId}`;
    this.titleText.visible = true;
  }

  private emit(event: string, ...args: any[]): void {
    this.listeners.get(event)?.forEach((cb) => {
      try { cb(...args); } catch (err) { console.error(`[HeroesMightScene] Error in event "${event}":`, err); }
    });
  }
}
