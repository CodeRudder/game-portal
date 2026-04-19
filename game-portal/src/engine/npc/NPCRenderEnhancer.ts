/**
 * NPC 渲染增强系统
 *
 * 在现有 NPCRenderer 基础上添加名称标签、好感度指示器、
 * 交互提示气泡、动作动画等视觉效果。
 *
 * 使用 PixiJS v8 Graphics API 程序化绘制，不需要真实图片资源。
 *
 * 渲染层次（从下到上）：
 * 1. 底部阴影
 * 2. NPC 主体（职业图形）
 * 3. 名称标签（名字 + 职业图标）
 * 4. 好感度心形指示器
 * 5. 交互提示气泡（"!" 或 "?"）
 * 6. 动作动画叠加层
 *
 * @module engine/npc/NPCRenderEnhancer
 */

import { Container, Graphics, Text } from 'pixi.js';
import type { NPCInstance, NPCState } from './types';
import { NPCProfession } from './types';
import { RelationshipLevel } from './RelationshipSystem';

// ---------------------------------------------------------------------------
// 渲染配置
// ---------------------------------------------------------------------------

/** 职业图标文本 */
const PROFESSION_ICONS: Record<string, string> = {
  [NPCProfession.FARMER]: '🌾',
  [NPCProfession.SOLDIER]: '🗡️',
  [NPCProfession.MERCHANT]: '💰',
  [NPCProfession.GENERAL]: '⚔️',
  [NPCProfession.CRAFTSMAN]: '🔨',
  [NPCProfession.SCHOLAR]: '📚',
  [NPCProfession.VILLAGER]: '🏠',
};

/** 好感度等级对应心形数量 */
const HEARTS_BY_LEVEL: Record<string, number> = {
  [RelationshipLevel.STRANGER]: 0,
  [RelationshipLevel.ACQUAINTANCE]: 1,
  [RelationshipLevel.FRIEND]: 2,
  [RelationshipLevel.CLOSE_FRIEND]: 3,
  [RelationshipLevel.CONFIDANT]: 5,
};

/** 动画配置 */
const ANIM_CONFIG = {
  /** 工作动画振幅 */
  workAmplitude: 2,
  /** 工作动画频率 */
  workFrequency: 3,
  /** 待机呼吸幅度 */
  idleAmplitude: 1,
  /** 待机呼吸频率 */
  idleFrequency: 1,
  /** 行走摆动幅度 */
  walkAmplitude: 3,
  /** 行走摆动频率 */
  walkFrequency: 5,
};

// ---------------------------------------------------------------------------
// NPCRenderEnhancer
// ---------------------------------------------------------------------------

/**
 * NPC 渲染增强器
 *
 * 为现有 NPC 精灵添加名称标签、好感度指示器、交互提示等视觉元素。
 * 设计为叠加在 NPCRenderer 之上使用。
 */
export class NPCRenderEnhancer {
  /** NPC ID → 增强元素容器 */
  private enhancements: Map<string, Container> = new Map();

  /** NPC ID → 好感度等级 */
  private relationshipLevels: Map<string, RelationshipLevel> = new Map();

  /** NPC ID → 交互提示类型 */
  private interactionHints: Map<string, 'quest' | 'dialogue' | 'trade' | null> = new Map();

  /** NPC ID → 当前动画状态 */
  private animStates: Map<string, { type: string; time: number }> = new Map();

  /** 父容器 */
  private parentContainer: Container;

  constructor(parentContainer: Container) {
    this.parentContainer = parentContainer;
  }

  // -----------------------------------------------------------------------
  // 增强元素管理
  // -----------------------------------------------------------------------

  /**
   * 为 NPC 添加增强渲染元素
   * @param npc - NPC 实例
   * @param tileSize - 瓦片像素大小
   * @returns 增强容器
   */
  addEnhancement(npc: NPCInstance, tileSize: number): Container {
    // 移除旧的
    this.removeEnhancement(npc.id);

    const wrapper = new Container();
    wrapper.label = `enhance-${npc.id}`;
    wrapper.x = npc.x * tileSize + tileSize / 2;
    wrapper.y = npc.y * tileSize + tileSize / 2;

    // 1. 名称标签
    this.drawNameLabel(wrapper, npc);

    // 2. 好感度指示器（默认不显示）
    this.drawRelationshipHearts(wrapper, npc.id, tileSize);

    // 3. 交互提示（默认不显示）
    this.drawInteractionHint(wrapper, npc.id, tileSize);

    this.parentContainer.addChild(wrapper);
    this.enhancements.set(npc.id, wrapper);
    this.animStates.set(npc.id, { type: 'idle', time: 0 });

    return wrapper;
  }

  /**
   * 移除 NPC 增强元素
   * @param npcId - NPC 实例 ID
   */
  removeEnhancement(npcId: string): void {
    const wrapper = this.enhancements.get(npcId);
    if (wrapper) {
      wrapper.destroy();
      this.enhancements.delete(npcId);
    }
    this.relationshipLevels.delete(npcId);
    this.interactionHints.delete(npcId);
    this.animStates.delete(npcId);
  }

  // -----------------------------------------------------------------------
  // 更新
  // -----------------------------------------------------------------------

  /**
   * 更新所有增强元素
   * @param npcs - NPC 实例列表
   * @param tileSize - 瓦片像素大小
   * @param deltaTime - 帧间隔
   */
  update(npcs: NPCInstance[], tileSize: number, deltaTime: number): void {
    const activeIds = new Set<string>();

    for (const npc of npcs) {
      activeIds.add(npc.id);

      if (!this.enhancements.has(npc.id)) {
        this.addEnhancement(npc, tileSize);
      }

      const wrapper = this.enhancements.get(npc.id);
      if (wrapper) {
        // 更新位置
        wrapper.x = npc.x * tileSize + tileSize / 2;
        wrapper.y = npc.y * tileSize + tileSize / 2;

        // 更新动画
        this.updateAnimation(npc, deltaTime);
      }
    }

    // 移除不存在的
    for (const [id] of this.enhancements) {
      if (!activeIds.has(id)) {
        this.removeEnhancement(id);
      }
    }
  }

  // -----------------------------------------------------------------------
  // 名称标签
  // -----------------------------------------------------------------------

  /**
   * 绘制名称标签
   * @param container - 父容器
   * @param npc - NPC 实例
   */
  private drawNameLabel(container: Container, npc: NPCInstance): void {
    const icon = PROFESSION_ICONS[npc.profession] ?? '';
    const label = new Container();
    label.label = 'name-label';

    // 名称文本
    const nameText = new Text({
      text: `${icon}${npc.name}`,
      style: {
        fontSize: 10,
        fill: 0xffffff,
        fontWeight: 'bold',
        stroke: { color: 0x000000, width: 2 },
      },
    });
    nameText.anchor.set(0.5, 1);
    nameText.y = -22;
    nameText.label = 'name-text';

    label.addChild(nameText);
    container.addChild(label);
  }

  // -----------------------------------------------------------------------
  // 好感度指示器
  // ---------------------------------------------------------------------------

  /**
   * 设置好感度等级并更新显示
   * @param npcId - NPC 实例 ID
   * @param level - 好感度等级
   */
  setRelationshipLevel(npcId: string, level: RelationshipLevel): void {
    this.relationshipLevels.set(npcId, level);
    this.updateHeartsDisplay(npcId);
  }

  /**
   * 绘制好感度心形
   */
  private drawRelationshipHearts(container: Container, npcId: string, tileSize: number): void {
    const heartsContainer = new Container();
    heartsContainer.label = 'hearts';
    heartsContainer.y = -32;
    heartsContainer.visible = false; // 默认隐藏

    container.addChild(heartsContainer);
  }

  /**
   * 更新心形显示
   */
  private updateHeartsDisplay(npcId: string): void {
    const wrapper = this.enhancements.get(npcId);
    if (!wrapper) return;

    let heartsContainer = wrapper.getChildByLabel('hearts') as Container;
    if (!heartsContainer) return;

    // 清除旧心形
    heartsContainer.removeChildren();

    const level = this.relationshipLevels.get(npcId) ?? RelationshipLevel.STRANGER;
    const count = HEARTS_BY_LEVEL[level] ?? 0;

    if (count === 0) {
      heartsContainer.visible = false;
      return;
    }

    heartsContainer.visible = true;

    // 绘制心形
    const spacing = 8;
    const startX = -(count - 1) * spacing / 2;

    for (let i = 0; i < count; i++) {
      const heart = new Graphics();
      this.drawHeart(heart, 0, 0, 4, 0xff4444);
      heart.x = startX + i * spacing;
      heartsContainer.addChild(heart);
    }
  }

  /**
   * 绘制心形图形
   */
  private drawHeart(g: Graphics, x: number, y: number, size: number, color: number): void {
    g.clear();
    // 简化心形：两个圆 + 一个三角
    const r = size * 0.4;
    g.circle(x - r, y - r * 0.5, r);
    g.fill(color);
    g.circle(x + r, y - r * 0.5, r);
    g.fill(color);
    g.moveTo(x - size * 0.7, y);
    g.lineTo(x, y + size * 0.7);
    g.lineTo(x + size * 0.7, y);
    g.closePath();
    g.fill(color);
  }

  // -----------------------------------------------------------------------
  // 交互提示气泡
  // -----------------------------------------------------------------------

  /**
   * 设置交互提示类型
   * @param npcId - NPC 实例 ID
   * @param hintType - 提示类型
   */
  setInteractionHint(npcId: string, hintType: 'quest' | 'dialogue' | 'trade' | null): void {
    this.interactionHints.set(npcId, hintType);
    this.updateHintDisplay(npcId);
  }

  /**
   * 绘制交互提示气泡
   */
  private drawInteractionHint(container: Container, npcId: string, tileSize: number): void {
    const hintContainer = new Container();
    hintContainer.label = 'hint';
    hintContainer.visible = false;
    hintContainer.x = 12;
    hintContainer.y = -18;

    container.addChild(hintContainer);
  }

  /**
   * 更新提示显示
   */
  private updateHintDisplay(npcId: string): void {
    const wrapper = this.enhancements.get(npcId);
    if (!wrapper) return;

    let hintContainer = wrapper.getChildByLabel('hint') as Container;
    if (!hintContainer) return;

    hintContainer.removeChildren();

    const hintType = this.interactionHints.get(npcId);
    if (!hintType) {
      hintContainer.visible = false;
      return;
    }

    hintContainer.visible = true;

    // 绘制气泡背景
    const bg = new Graphics();
    bg.circle(0, 0, 8);
    bg.fill(0xffffff);
    bg.stroke({ width: 1, color: 0x333333 });
    hintContainer.addChild(bg);

    // 绘制图标
    const iconText = hintType === 'quest' ? '!' : hintType === 'trade' ? '💰' : '?';
    const icon = new Text({
      text: iconText,
      style: { fontSize: 10, fill: hintType === 'quest' ? 0xff6600 : 0x333333, fontWeight: 'bold' },
    });
    icon.anchor.set(0.5);
    hintContainer.addChild(icon);
  }

  // -----------------------------------------------------------------------
  // 动作动画
  // -----------------------------------------------------------------------

  /**
   * 更新动画状态
   */
  private updateAnimation(npc: NPCInstance, deltaTime: number): void {
    const state = this.animStates.get(npc.id);
    if (!state) return;

    state.time += deltaTime;

    const wrapper = this.enhancements.get(npc.id);
    if (!wrapper) return;

    // 根据状态选择动画
    switch (npc.state) {
      case 'working':
        state.type = 'working';
        // 工作动画：轻微上下抖动
        wrapper.y += Math.sin(state.time * ANIM_CONFIG.workFrequency) * ANIM_CONFIG.workAmplitude * deltaTime;
        break;

      case 'idle':
        state.type = 'idle';
        // 待机动画：轻微呼吸效果
        wrapper.scale.set(
          1 + Math.sin(state.time * ANIM_CONFIG.idleFrequency) * 0.02,
          1 + Math.sin(state.time * ANIM_CONFIG.idleFrequency) * 0.02,
        );
        break;

      case 'walking':
      case 'moving_to_target':
        state.type = 'walking';
        // 行走动画：左右摆动
        wrapper.rotation = Math.sin(state.time * ANIM_CONFIG.walkFrequency) * 0.05;
        break;

      default:
        state.type = 'idle';
        wrapper.scale.set(1, 1);
        wrapper.rotation = 0;
        break;
    }
  }

  // -----------------------------------------------------------------------
  // 工具方法
  // -----------------------------------------------------------------------

  /**
   * 获取职业图标文本
   * @param profession - NPC 职业
   */
  static getProfessionIcon(profession: NPCProfession): string {
    return PROFESSION_ICONS[profession] ?? '';
  }

  /**
   * 获取好感度对应心形数量
   * @param level - 好感度等级
   */
  static getHeartCount(level: RelationshipLevel): number {
    return HEARTS_BY_LEVEL[level] ?? 0;
  }

  /**
   * 获取动画配置
   */
  static getAnimConfig(): typeof ANIM_CONFIG {
    return { ...ANIM_CONFIG };
  }

  /**
   * 销毁所有增强元素
   */
  destroy(): void {
    for (const [, wrapper] of this.enhancements) {
      wrapper.destroy();
    }
    this.enhancements.clear();
    this.relationshipLevels.clear();
    this.interactionHints.clear();
    this.animStates.clear();
  }
}
