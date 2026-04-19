/**
 * NPC 渲染器
 *
 * 在 PixiJS Canvas 上渲染 NPC 实例。无纹理时使用 Graphics
 * 绘制各职业的标志性图形。支持对话气泡、NPC 间对话线、
 * 状态图标等可视化效果。
 *
 * 渲染规则（无纹理时用 Graphics）：
 * - 农民:  绿色圆形 + 顶部草帽三角 + 农具线条
 * - 士兵:  红色方形 + 头盔三角 + 剑线条
 * - 商人:  黄色圆形 + 帽子 + 背包方形
 * - 武将:  金色菱形 + 头盔 + 武器
 * - 工匠:  棕色方形 + 围裙 + 锤子
 * - 书生:  蓝色圆形 + 书生帽 + 书本
 * - 村民:  灰色圆形
 *
 * @module engine/npc/NPCRenderer
 */

import { Container, Graphics, Text } from 'pixi.js';
import type { NPCInstance, NPCState } from './types';
import { NPCProfession } from './types';

/** 职业对应的主色调 */
const PROFESSION_COLORS: Record<string, number> = {
  [NPCProfession.FARMER]: 0x4caf50,
  [NPCProfession.SOLDIER]: 0xf44336,
  [NPCProfession.MERCHANT]: 0xffc107,
  [NPCProfession.GENERAL]: 0xffd700,
  [NPCProfession.CRAFTSMAN]: 0x795548,
  [NPCProfession.SCHOLAR]: 0x2196f3,
  [NPCProfession.VILLAGER]: 0x9e9e9e,
};

/** 状态对应图标文本 */
const STATE_ICONS: Record<string, string> = {
  idle: '💤',
  working: '⚒️',
  patrolling: '🛡️',
  fighting: '⚔️',
  trading: '💰',
  talking: '💬',
  resting: '😴',
  gathering: '🌿',
};

/** 对话气泡样式 */
const BUBBLE_STYLE = {
  fontSize: 10,
  fill: 0x333333,
  maxWidth: 120,
  padding: 4,
  bgAlpha: 0.85,
  bgColor: 0xffffff,
  borderColor: 0x666666,
};

export class NPCRenderer {
  /** 所有 NPC 精灵的父容器 */
  private container: Container;
  /** NPC ID → 精灵容器 映射 */
  private npcSprites: Map<string, Container> = new Map();
  /** 对话气泡映射 */
  private dialogueBubbles: Map<string, Container> = new Map();
  /** NPC 间对话线映射 */
  private chatLines: Map<string, Graphics> = new Map();
  /** 高亮效果映射 */
  private highlights: Map<string, Graphics> = new Map();

  constructor(parent: Container) {
    this.container = new Container();
    this.container.label = 'npc-layer';
    parent.addChild(this.container);
  }

  /**
   * 渲染/更新所有 NPC
   * @param npcs - NPC 实例列表
   * @param tileSize - 瓦片像素大小
   */
  render(npcs: NPCInstance[], tileSize: number): void {
    const activeIds = new Set<string>();

    for (const npc of npcs) {
      activeIds.add(npc.id);

      if (this.npcSprites.has(npc.id)) {
        // 更新已有精灵位置
        this.updatePosition(npc.id, npc.x, npc.y, tileSize);
      } else {
        // 创建新精灵
        const sprite = this.renderNPC(npc, tileSize);
        this.npcSprites.set(npc.id, sprite);
      }
    }

    // 移除不再存在的 NPC
    for (const [id] of this.npcSprites) {
      if (!activeIds.has(id)) {
        this.removeNPCSprite(id);
      }
    }
  }

  /**
   * 渲染单个 NPC
   * @param npc - NPC 实例
   * @param tileSize - 瓦片像素大小
   * @returns 精灵容器
   */
  private renderNPC(npc: NPCInstance, tileSize: number): Container {
    const wrapper = new Container();
    wrapper.label = `npc-${npc.id}`;
    wrapper.x = npc.x * tileSize + tileSize / 2;
    wrapper.y = npc.y * tileSize + tileSize / 2;

    const size = tileSize * 0.7;
    const halfSize = size / 2;
    const color = PROFESSION_COLORS[npc.profession] ?? 0x9e9e9e;

    const body = new Graphics();
    this.drawProfessionBody(body, npc.profession, color, halfSize);
    wrapper.addChild(body);

    // 名称标签
    const nameText = new Text({
      text: npc.name,
      style: { fontSize: 9, fill: 0xffffff },
    });
    nameText.anchor.set(0.5, 1);
    nameText.y = -halfSize - 6;
    wrapper.addChild(nameText);

    this.container.addChild(wrapper);
    return wrapper;
  }

  /** 根据职业绘制 NPC 主体 */
  private drawProfessionBody(g: Graphics, profession: NPCProfession, color: number, halfSize: number): void {
    g.clear();

    switch (profession) {
      case NPCProfession.FARMER:
        // 绿色圆形身体
        g.circle(0, 0, halfSize);
        g.fill(color);
        // 草帽三角
        g.moveTo(-halfSize * 0.8, -halfSize * 0.3);
        g.lineTo(0, -halfSize * 1.5);
        g.lineTo(halfSize * 0.8, -halfSize * 0.3);
        g.closePath();
        g.fill(0xdec68a);
        // 农具线条
        g.moveTo(halfSize, -halfSize * 0.5);
        g.lineTo(halfSize * 1.3, halfSize * 0.8);
        g.stroke({ width: 2, color: 0x8d6e63 });
        break;

      case NPCProfession.SOLDIER:
        // 红色方形身体
        g.rect(-halfSize, -halfSize, halfSize * 2, halfSize * 2);
        g.fill(color);
        // 头盔三角
        g.moveTo(-halfSize * 0.7, -halfSize);
        g.lineTo(0, -halfSize * 1.6);
        g.lineTo(halfSize * 0.7, -halfSize);
        g.closePath();
        g.fill(0x607d8b);
        // 剑线条
        g.moveTo(halfSize, 0);
        g.lineTo(halfSize * 1.5, -halfSize);
        g.stroke({ width: 2, color: 0xbdbdbd });
        break;

      case NPCProfession.MERCHANT:
        // 黄色圆形身体
        g.circle(0, 0, halfSize);
        g.fill(color);
        // 帽子
        g.ellipse(0, -halfSize * 0.8, halfSize * 0.6, halfSize * 0.3);
        g.fill(0xff8f00);
        // 背包方形
        g.rect(halfSize * 0.3, -halfSize * 0.4, halfSize * 0.6, halfSize * 0.8);
        g.fill(0x6d4c41);
        break;

      case NPCProfession.GENERAL:
        // 金色菱形身体
        g.moveTo(0, -halfSize);
        g.lineTo(halfSize, 0);
        g.lineTo(0, halfSize);
        g.lineTo(-halfSize, 0);
        g.closePath();
        g.fill(color);
        // 头盔
        g.moveTo(-halfSize * 0.6, -halfSize * 0.5);
        g.lineTo(0, -halfSize * 1.5);
        g.lineTo(halfSize * 0.6, -halfSize * 0.5);
        g.closePath();
        g.fill(0xb71c1c);
        // 武器
        g.moveTo(-halfSize * 1.2, halfSize * 0.5);
        g.lineTo(-halfSize * 0.3, -halfSize * 0.8);
        g.stroke({ width: 3, color: 0xffd700 });
        break;

      case NPCProfession.CRAFTSMAN:
        // 棕色方形身体
        g.rect(-halfSize, -halfSize, halfSize * 2, halfSize * 2);
        g.fill(color);
        // 围裙
        g.rect(-halfSize * 0.6, 0, halfSize * 1.2, halfSize);
        g.fill(0xd7ccc8);
        // 锤子
        g.moveTo(halfSize * 0.5, -halfSize * 0.5);
        g.lineTo(halfSize * 1.3, -halfSize * 1.2);
        g.stroke({ width: 2, color: 0x5d4037 });
        g.circle(halfSize * 1.3, -halfSize * 1.2, halfSize * 0.25);
        g.fill(0x78909c);
        break;

      case NPCProfession.SCHOLAR:
        // 蓝色圆形身体
        g.circle(0, 0, halfSize);
        g.fill(color);
        // 书生帽
        g.rect(-halfSize * 0.8, -halfSize * 1.2, halfSize * 1.6, halfSize * 0.4);
        g.fill(0x1a237e);
        g.rect(-halfSize * 0.4, -halfSize * 1.6, halfSize * 0.8, halfSize * 0.5);
        g.fill(0x1a237e);
        // 书本
        g.rect(halfSize * 0.5, -halfSize * 0.3, halfSize * 0.5, halfSize * 0.7);
        g.fill(0xfff8e1);
        g.stroke({ width: 1, color: 0x795548 });
        break;

      case NPCProfession.VILLAGER:
      default:
        // 灰色圆形
        g.circle(0, 0, halfSize);
        g.fill(color);
        break;
    }
  }

  /**
   * 更新 NPC 位置（平滑移动）
   * @param npcId - NPC ID
   * @param x - 新 X 坐标（tile）
   * @param y - 新 Y 坐标（tile）
   * @param tileSize - 瓦片像素大小
   */
  updatePosition(npcId: string, x: number, y: number, tileSize: number): void {
    const sprite = this.npcSprites.get(npcId);
    if (!sprite) return;
    sprite.x = x * tileSize + tileSize / 2;
    sprite.y = y * tileSize + tileSize / 2;
  }

  /**
   * 显示对话气泡
   * @param npcId - NPC ID
   * @param text - 对话文本
   */
  showDialogueBubble(npcId: string, text: string): void {
    const sprite = this.npcSprites.get(npcId);
    if (!sprite) return;

    this.hideDialogueBubble(npcId);

    const bubble = new Container();
    bubble.label = `bubble-${npcId}`;

    const bg = new Graphics();
    const textObj = new Text({
      text,
      style: { fontSize: BUBBLE_STYLE.fontSize, fill: BUBBLE_STYLE.fill, wordWrap: true, wordWrapWidth: BUBBLE_STYLE.maxWidth },
    });

    const tw = textObj.width + BUBBLE_STYLE.padding * 2;
    const th = textObj.height + BUBBLE_STYLE.padding * 2;

    bg.roundRect(-tw / 2, -th - 15, tw, th, 4);
    bg.fill({ color: BUBBLE_STYLE.bgColor, alpha: BUBBLE_STYLE.bgAlpha });
    bg.stroke({ width: 1, color: BUBBLE_STYLE.borderColor });

    // 小三角指向 NPC
    bg.moveTo(-4, -15);
    bg.lineTo(0, -8);
    bg.lineTo(4, -15);
    bg.closePath();
    bg.fill({ color: BUBBLE_STYLE.bgColor, alpha: BUBBLE_STYLE.bgAlpha });

    textObj.anchor.set(0.5, 0);
    textObj.x = 0;
    textObj.y = -th - 15 + BUBBLE_STYLE.padding;

    bubble.addChild(bg);
    bubble.addChild(textObj);

    sprite.addChild(bubble);
    this.dialogueBubbles.set(npcId, bubble);
  }

  /**
   * 隐藏对话气泡
   * @param npcId - NPC ID
   */
  hideDialogueBubble(npcId: string): void {
    const bubble = this.dialogueBubbles.get(npcId);
    if (bubble) {
      bubble.destroy();
      this.dialogueBubbles.delete(npcId);
    }
  }

  /**
   * 显示 NPC 间对话线
   * @param npc1Id - NPC 1 ID
   * @param npc2Id - NPC 2 ID
   */
  showChatLine(npc1Id: string, npc2Id: string): void {
    const sprite1 = this.npcSprites.get(npc1Id);
    const sprite2 = this.npcSprites.get(npc2Id);
    if (!sprite1 || !sprite2) return;

    const key = `${npc1Id}-${npc2Id}`;
    this.hideChatLine(npc1Id, npc2Id);

    const line = new Graphics();
    line.moveTo(sprite1.x, sprite1.y);
    line.lineTo(sprite2.x, sprite2.y);
    line.stroke({ width: 1, color: 0xffff00, alpha: 0.6 });

    this.container.addChildAt(line, 0); // 放在底层
    this.chatLines.set(key, line);
  }

  /**
   * 隐藏 NPC 间对话线
   * @param npc1Id - NPC 1 ID
   * @param npc2Id - NPC 2 ID
   */
  hideChatLine(npc1Id: string, npc2Id: string): void {
    const key = `${npc1Id}-${npc2Id}`;
    const line = this.chatLines.get(key);
    if (line) {
      line.destroy();
      this.chatLines.delete(key);
    }
  }

  /**
   * 高亮可点击 NPC
   * @param npcId - NPC ID
   */
  highlightNPC(npcId: string): void {
    const sprite = this.npcSprites.get(npcId);
    if (!sprite) return;

    this.unhighlightNPC(npcId);

    const hl = new Graphics();
    hl.circle(0, 0, 20);
    hl.fill({ color: 0xffffff, alpha: 0.2 });
    hl.stroke({ width: 2, color: 0xffffff, alpha: 0.6 });

    sprite.addChildAt(hl, 0);
    this.highlights.set(npcId, hl);
  }

  /** 取消高亮 */
  private unhighlightNPC(npcId: string): void {
    const hl = this.highlights.get(npcId);
    if (hl) {
      hl.destroy();
      this.highlights.delete(npcId);
    }
  }

  /**
   * 显示 NPC 状态图标
   * @param npcId - NPC ID
   * @param state - 当前状态
   */
  showStateIcon(npcId: string, state: NPCState): void {
    const sprite = this.npcSprites.get(npcId);
    if (!sprite) return;

    const icon = STATE_ICONS[state];
    if (!icon) return;

    // 移除旧状态图标
    const existing = sprite.getChildByLabel('state-icon');
    if (existing) existing.destroy();

    const iconText = new Text({
      text: icon,
      style: { fontSize: 12 },
    });
    iconText.label = 'state-icon';
    iconText.anchor.set(0.5, 1);
    iconText.x = 12;
    iconText.y = -8;
    sprite.addChild(iconText);
  }

  /** 移除 NPC 精灵 */
  private removeNPCSprite(id: string): void {
    const sprite = this.npcSprites.get(id);
    if (sprite) {
      sprite.destroy();
      this.npcSprites.delete(id);
    }
    this.hideDialogueBubble(id);
    this.highlights.delete(id);
  }

  /** 销毁渲染器，释放所有资源 */
  destroy(): void {
    for (const [, sprite] of this.npcSprites) {
      sprite.destroy();
    }
    for (const [, line] of this.chatLines) {
      line.destroy();
    }
    this.npcSprites.clear();
    this.dialogueBubbles.clear();
    this.chatLines.clear();
    this.highlights.clear();
    this.container.destroy();
  }
}
