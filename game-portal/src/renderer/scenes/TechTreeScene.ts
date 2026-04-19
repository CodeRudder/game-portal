/**
 * renderer/scenes/TechTreeScene.ts — 科技树场景
 *
 * 展示三条科技路线（农业/军事/治国），包含：
 * - 三列竖排科技节点
 * - 已研究（绿）/ 可研究（黄）/ 锁定（灰）状态
 * - 节点间连接线
 * - 点击节点显示详情 tooltip
 * - 顶部标题"科技树"
 *
 * @module renderer/scenes/TechTreeScene
 */

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { SceneType } from '../types';
import { BaseScene, type SceneEventBridge } from './BaseScene';
import type { AssetManager } from '../managers/AssetManager';
import type { AnimationManager } from '../managers/AnimationManager';

// ═══════════════════════════════════════════════════════════════
// 常量
// ═══════════════════════════════════════════════════════════════

const BG_COLOR = 0x1a1a2e;
const TEXT_COLOR = 0xe0e0e0;
const ACCENT_COLOR = 0xe94560;
const NODE_RESEARCHED = 0x2ecc71;
const NODE_AVAILABLE = 0xf1c40f;
const NODE_LOCKED = 0x636e72;
const NODE_WIDTH = 120;
const NODE_HEIGHT = 40;
const NODE_RADIUS = 8;
const LINE_COLOR = 0x555577;
const LINE_WIDTH = 2;
const TITLE_FONT_SIZE = 28;
const NODE_FONT_SIZE = 14;
const TOOLTIP_FONT_SIZE = 13;

/** 科技路线定义 */
const BRANCHES = [
  { key: 'agriculture' as const, label: '🌾 农业', names: ['屯田', '水利', '农具', '轮作', '丰年'] },
  { key: 'military' as const, label: '⚔️ 军事', names: ['练兵', '阵法', '兵器', '骑兵', '精锐'] },
  { key: 'governance' as const, label: '📜 治国', names: ['科举', '律法', '税收', '外交', '帝王'] },
];

// ═══════════════════════════════════════════════════════════════
// 接口
// ═══════════════════════════════════════════════════════════════

export interface TechNode {
  id: string;
  name: string;
  branch: 'agriculture' | 'military' | 'governance';
  level: number;
  isResearched: boolean;
  isAvailable: boolean;
  cost: { gold: number; food: number };
  effect: string;
}

// ═══════════════════════════════════════════════════════════════
// 内部渲染对象
// ═══════════════════════════════════════════════════════════════

interface TechNodeView {
  id: string;
  container: Container;
  bg: Graphics;
  label: Text;
  data: TechNode | null;
}

interface TooltipView {
  container: Container;
  background: Graphics;
  texts: Text[];
}

// ═══════════════════════════════════════════════════════════════
// TechTreeScene
// ═══════════════════════════════════════════════════════════════

export class TechTreeScene extends BaseScene {
  readonly type: SceneType = 'tech-tree';

  // ─── 子容器 ───────────────────────────────────────────────

  private bgLayer: Container;
  private connectionLayer: Container;
  private nodeLayer: Container;
  private tooltipLayer: Container;

  // ─── 渲染对象缓存 ─────────────────────────────────────────

  private techNodes: TechNode[] = [];
  private nodeViews: Map<string, TechNodeView> = new Map();
  private tooltipView: TooltipView | null = null;
  private hoveredNodeId: string | null = null;

  // ─── 尺寸 ─────────────────────────────────────────────────

  private width = 960;
  private height = 640;

  // ═══════════════════════════════════════════════════════════
  // 构造函数
  // ═══════════════════════════════════════════════════════════

  constructor(
    assetManager: AssetManager,
    animationManager: AnimationManager,
    bridgeEvent: SceneEventBridge,
  ) {
    super(assetManager, animationManager, bridgeEvent);

    this.bgLayer = new Container({ label: 'tech-bg' });
    this.connectionLayer = new Container({ label: 'tech-connections' });
    this.nodeLayer = new Container({ label: 'tech-nodes' });
    this.tooltipLayer = new Container({ label: 'tech-tooltip' });

    this.container.addChild(
      this.bgLayer,
      this.connectionLayer,
      this.nodeLayer,
      this.tooltipLayer,
    );
  }

  // ═══════════════════════════════════════════════════════════
  // 生命周期
  // ═══════════════════════════════════════════════════════════

  protected async onCreate(): Promise<void> {
    this.container.eventMode = 'static';
    this.container.on('pointermove', this.onPointerMove);
  }

  protected async onEnter(): Promise<void> {
    this.renderBackground();
    this.renderConnections();
    this.renderNodes();
  }

  protected async onExit(): Promise<void> {
    this.hideTooltip();
  }

  protected onUpdate(_deltaTime: number): void {
    // 预留：可添加节点脉冲动画
  }

  protected onSetData(data: unknown): void {
    const state = data as { techNodes?: TechNode[] };
    if (state.techNodes) {
      this.techNodes = state.techNodes;
      this.renderNodes();
    }
  }

  protected onDestroy(): void {
    this.nodeViews.clear();
    this.hideTooltip();
  }

  // ═══════════════════════════════════════════════════════════
  // 公共方法
  // ═══════════════════════════════════════════════════════════

  /** 设置科技数据 */
  setTechData(nodes: TechNode[]): void {
    this.techNodes = nodes;
    this.renderNodes();
  }

  /** 处理点击，返回点击的科技节点或 null */
  handleClick(x: number, y: number): TechNode | null {
    for (const [id, view] of this.nodeViews) {
      const bounds = view.container.getBounds();
      if (bounds.containsPoint(x, y)) {
        const node = this.techNodes.find((n) => n.id === id);
        if (node) {
          this.bridgeEvent('techClick', id);
          return node;
        }
      }
    }
    return null;
  }

  /** 调整尺寸 */
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.renderBackground();
    this.renderConnections();
    this.renderNodes();
  }

  // ═══════════════════════════════════════════════════════════
  // 渲染
  // ═══════════════════════════════════════════════════════════

  /** 绘制背景和标题 */
  private renderBackground(): void {
    this.bgLayer.removeChildren();
    const bg = new Graphics();
    bg.rect(0, 0, this.width, this.height).fill({ color: BG_COLOR });
    this.bgLayer.addChild(bg);

    // 标题
    const title = new Text({
      text: '科技树',
      style: new TextStyle({
        fontSize: TITLE_FONT_SIZE,
        fill: ACCENT_COLOR,
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontWeight: 'bold',
      }),
    });
    title.anchor.set(0.5, 0);
    title.position.set(this.width / 2, 20);
    this.bgLayer.addChild(title);
  }

  /** 计算节点位置 */
  private getNodePosition(branchIndex: number, level: number): { x: number; y: number } {
    const colWidth = this.width / (BRANCHES.length + 1);
    const x = colWidth * (branchIndex + 1);
    const startY = 100;
    const spacingY = (this.height - startY - 60) / 4; // 5 levels → 4 gaps
    const y = startY + level * spacingY;
    return { x, y };
  }

  /** 绘制节点间连接线 */
  private renderConnections(): void {
    this.connectionLayer.removeChildren();
    const line = new Graphics();

    for (let bi = 0; bi < BRANCHES.length; bi++) {
      for (let lv = 0; lv < 4; lv++) {
        const from = this.getNodePosition(bi, lv);
        const to = this.getNodePosition(bi, lv + 1);
        line
          .moveTo(from.x, from.y + NODE_HEIGHT / 2)
          .lineTo(to.x, to.y - NODE_HEIGHT / 2)
          .stroke({ width: LINE_WIDTH, color: LINE_COLOR });
      }
    }
    this.connectionLayer.addChild(line);
  }

  /** 渲染所有科技节点 */
  private renderNodes(): void {
    this.nodeLayer.removeChildren();
    this.nodeViews.clear();

    for (let bi = 0; bi < BRANCHES.length; bi++) {
      const branch = BRANCHES[bi];

      // 分支标题
      const branchTitle = new Text({
        text: branch.label,
        style: new TextStyle({
          fontSize: 16,
          fill: TEXT_COLOR,
          fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
          fontWeight: 'bold',
        }),
      });
      const branchPos = this.getNodePosition(bi, 0);
      branchTitle.anchor.set(0.5, 1);
      branchTitle.position.set(branchPos.x, branchPos.y - NODE_HEIGHT / 2 - 12);
      this.nodeLayer.addChild(branchTitle);

      // 节点
      for (let lv = 0; lv < branch.names.length; lv++) {
        const nodeId = `${branch.key}-${lv}`;
        const nodeData = this.techNodes.find((n) => n.id === nodeId);
        const pos = this.getNodePosition(bi, lv);

        const container = new Container({ label: `tech-${nodeId}` });
        container.position.set(pos.x, pos.y);
        container.eventMode = 'static';
        container.cursor = 'pointer';

        // 确定状态颜色
        const color = nodeData
          ? nodeData.isResearched
            ? NODE_RESEARCHED
            : nodeData.isAvailable
              ? NODE_AVAILABLE
              : NODE_LOCKED
          : NODE_LOCKED;

        const bg = new Graphics();
        bg.roundRect(-NODE_WIDTH / 2, -NODE_HEIGHT / 2, NODE_WIDTH, NODE_HEIGHT, NODE_RADIUS)
          .fill({ color, alpha: 0.85 });
        bg.roundRect(-NODE_WIDTH / 2, -NODE_HEIGHT / 2, NODE_WIDTH, NODE_HEIGHT, NODE_RADIUS)
          .stroke({ color: 0xffffff, width: 1, alpha: 0.3 });
        container.addChild(bg);

        const label = new Text({
          text: nodeData?.name ?? branch.names[lv],
          style: new TextStyle({
            fontSize: NODE_FONT_SIZE,
            fill: TEXT_COLOR,
            fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
            fontWeight: 'bold',
          }),
        });
        label.anchor.set(0.5, 0.5);
        container.addChild(label);

        // 交互事件
        container.on('pointerover', () => {
          this.hoveredNodeId = nodeId;
          this.showTooltip(nodeId);
        });
        container.on('pointerout', () => {
          this.hoveredNodeId = null;
          this.hideTooltip();
        });
        container.on('pointerdown', () => {
          this.bridgeEvent('techClick', nodeId);
        });

        this.nodeLayer.addChild(container);
        this.nodeViews.set(nodeId, { id: nodeId, container, bg, label, data: nodeData ?? null });
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Tooltip
  // ═══════════════════════════════════════════════════════════

  private showTooltip(nodeId: string): void {
    const view = this.nodeViews.get(nodeId);
    if (!view?.data) return;

    this.hideTooltip();

    const data = view.data;
    const lines = [
      `📖 ${data.name}`,
      `效果: ${data.effect}`,
      `费用: 💰${data.cost.gold} 🌾${data.cost.food}`,
      `状态: ${data.isResearched ? '✅ 已研究' : data.isAvailable ? '🔓 可研究' : '🔒 锁定'}`,
    ];

    const textStyle = new TextStyle({
      fontSize: TOOLTIP_FONT_SIZE,
      fill: TEXT_COLOR,
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
      lineHeight: 20,
    });

    const tooltipContainer = new Container({ label: 'tech-tooltip' });
    tooltipContainer.eventMode = 'none';

    const texts: Text[] = [];
    let maxWidth = 0;
    const padding = 12;

    for (let i = 0; i < lines.length; i++) {
      const t = new Text({ text: lines[i], style: textStyle });
      t.x = padding;
      t.y = padding + i * 20;
      texts.push(t);
      tooltipContainer.addChild(t);
      if (t.width > maxWidth) maxWidth = t.width;
    }

    const bgWidth = maxWidth + padding * 2;
    const bgHeight = texts.length * 20 + padding * 2;
    const background = new Graphics();
    background.roundRect(0, 0, bgWidth, bgHeight, 8)
      .fill({ color: BG_COLOR, alpha: 0.92 });
    background.roundRect(0, 0, bgWidth, bgHeight, 8)
      .stroke({ color: ACCENT_COLOR, width: 1 });
    tooltipContainer.addChildAt(background, 0);

    // 定位在节点下方
    const nodePos = view.container.position;
    tooltipContainer.position.set(nodePos.x - bgWidth / 2, nodePos.y + NODE_HEIGHT / 2 + 10);

    this.tooltipView = { container: tooltipContainer, background, texts };
    this.tooltipLayer.addChild(tooltipContainer);
  }

  private hideTooltip(): void {
    if (this.tooltipView) {
      this.tooltipLayer.removeChild(this.tooltipView.container);
      this.tooltipView.container.destroy({ children: true });
      this.tooltipView = null;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 事件
  // ═══════════════════════════════════════════════════════════

  private onPointerMove = (): void => {
    // 预留：可在此更新 tooltip 跟随位置
  };
}
