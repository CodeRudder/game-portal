/**
 * renderer/scenes/TotalWarScene.ts — 全面战争专属场景
 *
 * 军事主题（钢铁灰+血红色），战场地图，军队编制面板，战斗日志。
 * 所有 UI 元素使用 PixiJS Graphics 程序化绘制。
 *
 * 布局结构：
 * ┌────────────────────────────────────────────────────────┐
 * │              资源栏（金币/铁矿/兵力）                    │
 * ├──────────────────────────────────┬─────────────────────┤
 * │                                  │                     │
 * │          战场地图区域            │   军队编制面板      │
 * │     （领土节点+连接线）          │   （兵种列表）      │
 * │                                  │                     │
 * ├──────────────────────────────────┼─────────────────────┤
 * │          建筑升级面板            │    战斗日志         │
 * └──────────────────────────────────┴─────────────────────┘
 *
 * @module renderer/scenes/TotalWarScene
 */

import { Container, Graphics, Text } from 'pixi.js';
import type { RenderStrategy, IdleGameRenderState } from '../types';

// ═══════════════════════════════════════════════════════════════
// 事件类型
// ═══════════════════════════════════════════════════════════════

export interface TotalWarSceneEventMap {
  upgradeClick: [upgradeId: string];
  territoryClick: [territoryId: string];
  troopTrain: [troopId: string];
  troopUpgrade: [troopId: string];
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
// TotalWarScene
// ═══════════════════════════════════════════════════════════════

/**
 * 全面战争专属场景
 *
 * 军事主题，包含战场地图、军队编制面板和战斗日志。
 */
export class TotalWarScene {
  // ─── PixiJS 对象 ────────────────────────────────────────

  private container: Container;
  private resourceBar: Container;
  private resourceBarBg: Graphics;
  private resourceTexts: Text[] = [];

  private battlefieldArea: Container;
  private battlefieldBg: Graphics;
  private territoryNodes: Container[] = [];
  private territoryConnections: Graphics[] = [];

  private armyPanel: Container;
  private armyPanelBg: Graphics;
  private armyTexts: Text[] = [];

  private buildingPanel: Container;
  private buildingPanelBg: Graphics;
  private buildingButtons: Container[] = [];

  private battleLog: Container;
  private battleLogBg: Graphics;
  private battleLogTexts: Text[] = [];

  private titleText: Text;
  private powerText: Text;

  // ─── 配置 ───────────────────────────────────────────────

  private strategy: RenderStrategy;

  // ─── 状态 ───────────────────────────────────────────────

  private active: boolean = false;
  private currentState: IdleGameRenderState | null = null;
  private canvasWidth: number = 800;
  private canvasHeight: number = 600;

  // ─── 事件 ───────────────────────────────────────────────

  private listeners: Map<string, Set<SceneEventCallback>> = new Map();

  // ─── 战斗日志 ───────────────────────────────────────────

  private logEntries: string[] = [];

  // ═══════════════════════════════════════════════════════════
  // 构造函数
  // ═══════════════════════════════════════════════════════════

  constructor(strategy: RenderStrategy) {
    this.strategy = strategy;

    this.container = new Container({ label: 'total-war-scene' });

    // 资源栏
    this.resourceBar = new Container({ label: 'tw-resource-bar' });
    this.resourceBarBg = new Graphics();
    this.resourceBar.addChild(this.resourceBarBg);

    // 战场区域
    this.battlefieldArea = new Container({ label: 'tw-battlefield' });
    this.battlefieldBg = new Graphics();
    this.battlefieldArea.addChild(this.battlefieldBg);

    // 军队编制面板
    this.armyPanel = new Container({ label: 'tw-army-panel' });
    this.armyPanelBg = new Graphics();
    this.armyPanel.addChild(this.armyPanelBg);

    // 建筑升级面板
    this.buildingPanel = new Container({ label: 'tw-building-panel' });
    this.buildingPanelBg = new Graphics();
    this.buildingPanel.addChild(this.buildingPanelBg);

    // 战斗日志
    this.battleLog = new Container({ label: 'tw-battle-log' });
    this.battleLogBg = new Graphics();
    this.battleLog.addChild(this.battleLogBg);

    // 标题和战力
    this.titleText = new Text({
      text: '',
      style: { fontSize: 16, fill: hexToNum(strategy.theme.accent), fontWeight: 'bold' },
    });
    this.titleText.visible = false;

    this.powerText = new Text({
      text: '',
      style: { fontSize: 13, fill: hexToNum(strategy.theme.success), fontWeight: 'bold' },
    });
    this.powerText.visible = false;

    // 组装
    this.container.addChild(this.resourceBar);
    this.container.addChild(this.battlefieldArea);
    this.container.addChild(this.armyPanel);
    this.container.addChild(this.buildingPanel);
    this.container.addChild(this.battleLog);
    this.container.addChild(this.titleText);
    this.container.addChild(this.powerText);
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
    this.renderBattlefield(state);
    this.renderArmyPanel(state);
    this.renderBuildingPanel(state);
    this.renderBattleLog(state);
    this.renderTitle(state);
  }

  // ═══════════════════════════════════════════════════════════
  // 响应式布局
  // ═══════════════════════════════════════════════════════════

  resize(width: number, height: number): void {
    this.canvasWidth = width;
    this.canvasHeight = height;
    this.layout();
    if (this.currentState) {
      this.updateState(this.currentState);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 公共访问器
  // ═══════════════════════════════════════════════════════════

  getContainer(): Container { return this.container; }
  isActive(): boolean { return this.active; }
  getCurrentState(): IdleGameRenderState | null { return this.currentState; }

  /** 添加战斗日志条目 */
  addLogEntry(entry: string): void {
    this.logEntries.unshift(entry);
    if (this.logEntries.length > 20) this.logEntries.pop();
    if (this.currentState) this.renderBattleLog(this.currentState);
  }

  /** 获取战斗日志 */
  getLogEntries(): string[] {
    return [...this.logEntries];
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

    // ── 战场区域（左中）───────────────────────────────────
    const bfW = w * 0.55;
    const bfH = h * 0.5;
    const bfY = rbH;
    this.battlefieldArea.position.set(0, bfY);
    this.battlefieldBg.clear();
    this.battlefieldBg.roundRect(0, 0, bfW, bfH, 0);
    this.battlefieldBg.fill(hexToNum(theme.background));

    // ── 军队编制面板（右中）───────────────────────────────
    const apW = w * 0.25;
    const apH = h * 0.5;
    this.armyPanel.position.set(bfW, bfY);
    this.armyPanelBg.clear();
    this.armyPanelBg.roundRect(0, 0, apW, apH, br);
    this.armyPanelBg.fill(hexToNum(theme.panelBackground));

    // ── 建筑升级面板（左下）───────────────────────────────
    const bpW = w * 0.55;
    const bpH = h * 0.38;
    const bpY = rbH + bfH;
    this.buildingPanel.position.set(0, bpY);
    this.buildingPanelBg.clear();
    this.buildingPanelBg.roundRect(0, 0, bpW, bpH, br);
    this.buildingPanelBg.fill(hexToNum(theme.panelBackground));

    // ── 战斗日志（右下）───────────────────────────────────
    const blW = w * 0.25;
    const blH = h * 0.38;
    this.battleLog.position.set(bpW, bpY);
    this.battleLogBg.clear();
    this.battleLogBg.roundRect(0, 0, blW, blH, br);
    this.battleLogBg.fill(hexToNum(theme.panelBackground));

    // ── 标题和战力 ────────────────────────────────────────
    this.titleText.position.set(layout.padding, layout.padding);
    this.powerText.position.set(w - 150, layout.padding);
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

    const icons: Record<string, string> = { gold: '💰', iron: '🔩', troop: '⚔️' };

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

  private renderBattlefield(state: IdleGameRenderState): void {
    const { theme, layout } = this.strategy;

    // 清除旧节点
    for (const node of this.territoryNodes) node.destroy();
    for (const conn of this.territoryConnections) conn.destroy();
    this.territoryNodes = [];
    this.territoryConnections = [];

    const bfW = this.canvasWidth * 0.55;
    const bfH = this.canvasHeight * 0.5;
    const p = layout.padding;

    // 标题
    const titleText = new Text({
      text: '⚔️ 战场地图',
      style: { fontSize: 13, fill: hexToNum(theme.accent), fontWeight: 'bold' },
    });
    titleText.position.set(p, p);
    this.battlefieldArea.addChild(titleText);
    this.territoryNodes.push(titleText); // reuse array for cleanup

    // 绘制领土节点（8块领土）
    const territoryCount = 8;
    const cols = 4;
    const nodeRadius = 18;
    const gapX = (bfW - p * 2) / cols;
    const gapY = (bfH - 40) / 2;

    for (let i = 0; i < territoryCount; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = p + gapX * col + gapX / 2;
      const y = 30 + gapY * row + gapY / 2;

      const nodeContainer = new Container({ label: `territory-${i}` });
      nodeContainer.position.set(x, y);

      // 节点背景
      const bg = new Graphics();
      bg.circle(0, 0, nodeRadius);
      bg.fill(hexToNum(theme.panelBackground));
      bg.stroke({ color: hexToNum(theme.accent), width: 2 });
      nodeContainer.addChild(bg);

      // 领土编号
      const label = new Text({
        text: `${i + 1}`,
        style: { fontSize: 12, fill: hexToNum(theme.textPrimary), fontWeight: 'bold' },
      });
      label.anchor.set(0.5);
      nodeContainer.addChild(label);

      nodeContainer.eventMode = 'static';
      nodeContainer.cursor = 'pointer';
      nodeContainer.on('pointertap', () => {
        this.emit('territoryClick', `territory-${i}`);
      });

      this.battlefieldArea.addChild(nodeContainer);
      this.territoryNodes.push(nodeContainer);
    }

    // 绘制连接线
    for (let i = 0; i < territoryCount - 1; i++) {
      const col1 = i % cols;
      const row1 = Math.floor(i / cols);
      const col2 = (i + 1) % cols;
      const row2 = Math.floor((i + 1) / cols);

      const x1 = p + gapX * col1 + gapX / 2;
      const y1 = 30 + gapY * row1 + gapY / 2;
      const x2 = p + gapX * col2 + gapX / 2;
      const y2 = 30 + gapY * row2 + gapY / 2;

      const line = new Graphics();
      line.moveTo(x1, y1);
      line.lineTo(x2, y2);
      line.stroke({ color: hexToNum(theme.textSecondary), width: 1, alpha: 0.5 });
      this.battlefieldArea.addChild(line);
      this.territoryConnections.push(line);
    }
  }

  private renderArmyPanel(state: IdleGameRenderState): void {
    const { theme, layout } = this.strategy;
    const p = layout.padding;

    for (const t of this.armyTexts) t.destroy();
    this.armyTexts = [];

    let y = p;

    // 标题
    const title = new Text({
      text: '🛡️ 军队编制',
      style: { fontSize: 13, fill: hexToNum(theme.accent), fontWeight: 'bold' },
    });
    title.position.set(p, y);
    this.armyPanel.addChild(title);
    this.armyTexts.push(title);
    y += 22;

    // 兵种列表（6种）
    const troopNames = ['民兵', '弓箭手', '骑兵', '步兵', '攻城兵', '圣骑士'];
    const troopIcons = ['🗡️', '🏹', '🐴', '🛡️', '💣', '⚜️'];

    for (let i = 0; i < troopNames.length; i++) {
      const text = new Text({
        text: `${troopIcons[i]} ${troopNames[i]}`,
        style: { fontSize: 11, fill: hexToNum(theme.textSecondary) },
      });
      text.position.set(p, y);
      this.armyPanel.addChild(text);
      this.armyTexts.push(text);
      y += 18;
    }

    // 战力统计
    y += 8;
    const statsTitle = new Text({
      text: '📊 战力统计',
      style: { fontSize: 12, fill: hexToNum(theme.accent), fontWeight: 'bold' },
    });
    statsTitle.position.set(p, y);
    this.armyPanel.addChild(statsTitle);
    this.armyTexts.push(statsTitle);
    y += 20;

    // 声望
    const prestigeText = new Text({
      text: `荣耀: ${formatNumber(state.prestige.currency)}`,
      style: { fontSize: 11, fill: hexToNum(theme.textPrimary) },
    });
    prestigeText.position.set(p, y);
    this.armyPanel.addChild(prestigeText);
    this.armyTexts.push(prestigeText);
    y += 16;

    const countText = new Text({
      text: `转生: ${state.prestige.count}次`,
      style: { fontSize: 11, fill: hexToNum(theme.textSecondary) },
    });
    countText.position.set(p, y);
    this.armyPanel.addChild(countText);
    this.armyTexts.push(countText);
  }

  private renderBuildingPanel(state: IdleGameRenderState): void {
    const { theme, layout } = this.strategy;
    const p = layout.padding;
    const gap = layout.gridGap;
    const cols = 4;

    for (const btn of this.buildingButtons) btn.destroy();
    this.buildingButtons = [];

    // 标题
    const title = new Text({
      text: '🏰 帝国建筑',
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

      const btnContainer = new Container({ label: `tw-upgrade-${upgrade.id}` });
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

  private renderBattleLog(state: IdleGameRenderState): void {
    const { theme, layout } = this.strategy;
    const p = layout.padding;

    for (const t of this.battleLogTexts) t.destroy();
    this.battleLogTexts = [];

    let y = p;

    // 标题
    const title = new Text({
      text: '📜 战斗日志',
      style: { fontSize: 13, fill: hexToNum(theme.accent), fontWeight: 'bold' },
    });
    title.position.set(p, y);
    this.battleLog.addChild(title);
    this.battleLogTexts.push(title);
    y += 20;

    // 日志条目
    const entries = this.logEntries.length > 0 ? this.logEntries : ['暂无战斗记录'];
    for (const entry of entries.slice(0, 10)) {
      const text = new Text({
        text: entry,
        style: { fontSize: 10, fill: hexToNum(theme.textSecondary) },
      });
      text.position.set(p, y);
      this.battleLog.addChild(text);
      this.battleLogTexts.push(text);
      y += 15;
    }
  }

  private renderTitle(state: IdleGameRenderState): void {
    this.titleText.text = `⚔️ ${state.gameId}`;
    this.titleText.visible = true;
  }

  private emit(event: string, ...args: any[]): void {
    this.listeners.get(event)?.forEach((cb) => {
      try { cb(...args); } catch (err) { console.error(`[TotalWarScene] Error in event "${event}":`, err); }
    });
  }
}
