/**
 * renderer/scenes/StageInfoScene.ts — 关卡信息场景
 *
 * 展示战斗关卡列表，包含：
 * - 左侧：关卡列表（已通过=绿勾，当前=黄箭头，锁定=灰锁）
 * - 右侧：选中关卡详情（名称/描述/难度/目标/波次数/奖励）
 * - 底部：开始挑战按钮
 *
 * @module renderer/scenes/StageInfoScene
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
const LIST_ITEM_HEIGHT = 50;
const LIST_ITEM_RADIUS = 6;
const LIST_WIDTH = 260;
const DETAIL_PADDING = 24;
const BUTTON_WIDTH = 200;
const BUTTON_HEIGHT = 50;
const BUTTON_RADIUS = 10;

/** 关卡状态颜色 */
const STATUS_COMPLETED = 0x2ecc71;
const STATUS_AVAILABLE = 0xf1c40f;
const STATUS_LOCKED = 0x636e72;

/** 难度颜色 */
const DIFFICULTY_COLORS: Record<string, number> = {
  easy: 0x2ecc71,
  normal: 0xf1c40f,
  hard: 0xe67e22,
  nightmare: 0xe74c3c,
};

/** 难度中文 */
const DIFFICULTY_LABELS: Record<string, string> = {
  easy: '简单',
  normal: '普通',
  hard: '困难',
  nightmare: '噩梦',
};

/** 星星符号（满/空） */
const STAR_FILLED = '★';
const STAR_EMPTY = '☆';

// ═══════════════════════════════════════════════════════════════
// 接口
// ═══════════════════════════════════════════════════════════════

export interface StageInfo {
  id: string;
  name: string;
  description: string;
  difficulty: 'easy' | 'normal' | 'hard' | 'nightmare';
  objective: string;
  waveCount: number;
  rewards: { food: number; gold: number; troops: number };
  isCompleted: boolean;
  isAvailable: boolean;
  stars: number;
}

// ═══════════════════════════════════════════════════════════════
// 内部渲染对象
// ═══════════════════════════════════════════════════════════════

interface StageItemView {
  id: string;
  container: Container;
  bg: Graphics;
  label: Text;
  icon: Text;
}

// ═══════════════════════════════════════════════════════════════
// StageInfoScene
// ═══════════════════════════════════════════════════════════════

export class StageInfoScene extends BaseScene {
  readonly type: SceneType = 'stage-info';

  // ─── 子容器 ───────────────────────────────────────────────

  private bgLayer: Container;
  private listLayer: Container;
  private detailLayer: Container;
  private buttonLayer: Container;

  // ─── 数据 ─────────────────────────────────────────────────

  private stages: StageInfo[] = [];
  private selectedStageId: string | null = null;
  private stageItems: StageItemView[] = [];
  private buttonContainer: Container | null = null;

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

    this.bgLayer = new Container({ label: 'stage-bg' });
    this.listLayer = new Container({ label: 'stage-list' });
    this.detailLayer = new Container({ label: 'stage-detail' });
    this.buttonLayer = new Container({ label: 'stage-button' });

    this.container.addChild(
      this.bgLayer,
      this.listLayer,
      this.detailLayer,
      this.buttonLayer,
    );
  }

  // ═══════════════════════════════════════════════════════════
  // 生命周期
  // ═══════════════════════════════════════════════════════════

  protected async onCreate(): Promise<void> {
    this.container.eventMode = 'static';
  }

  protected async onEnter(): Promise<void> {
    this.renderBackground();
    this.renderList();
    this.renderDetail();
    this.renderButton();
  }

  protected async onExit(): Promise<void> {
    // 清理
  }

  protected onUpdate(_deltaTime: number): void {
    // 预留：可添加选中关卡脉冲动画
  }

  protected onSetData(data: unknown): void {
    const state = data as { stages?: StageInfo[] };
    if (state.stages) {
      this.stages = state.stages;
      // 默认选中第一个可用关卡
      if (!this.selectedStageId) {
        const available = this.stages.find((s) => s.isAvailable);
        if (available) this.selectedStageId = available.id;
      }
      this.renderList();
      this.renderDetail();
    }
  }

  protected onDestroy(): void {
    this.stages = [];
    this.stageItems = [];
    this.buttonContainer = null;
  }

  // ═══════════════════════════════════════════════════════════
  // 公共方法
  // ═══════════════════════════════════════════════════════════

  /** 设置关卡数据 */
  setStagesData(stages: StageInfo[]): void {
    this.stages = stages;
    if (!this.selectedStageId) {
      const available = this.stages.find((s) => s.isAvailable);
      if (available) this.selectedStageId = available.id;
    }
    this.renderList();
    this.renderDetail();
    this.renderButton();
  }

  /** 处理点击 */
  handleClick(x: number, y: number): { type: 'stage_select' | 'start_battle'; id: string } | null {
    // 检查关卡列表点击
    for (const item of this.stageItems) {
      const bounds = item.container.getBounds();
      if (bounds.containsPoint(x, y)) {
        this.selectedStageId = item.id;
        this.renderList();
        this.renderDetail();
        this.renderButton();
        this.bridgeEvent('combatAction', 'stageSelect', item.id);
        return { type: 'stage_select', id: item.id };
      }
    }

    // 检查开始挑战按钮点击
    if (this.buttonContainer) {
      const bounds = this.buttonContainer.getBounds();
      if (bounds.containsPoint(x, y) && this.selectedStageId) {
        this.bridgeEvent('combatAction', 'startBattle', this.selectedStageId);
        return { type: 'start_battle', id: this.selectedStageId };
      }
    }

    return null;
  }

  /** 调整尺寸 */
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.renderBackground();
    this.renderList();
    this.renderDetail();
    this.renderButton();
  }

  // ═══════════════════════════════════════════════════════════
  // 渲染
  // ═══════════════════════════════════════════════════════════

  /** 绘制背景 */
  private renderBackground(): void {
    this.bgLayer.removeChildren();

    const bg = new Graphics();
    bg.rect(0, 0, this.width, this.height).fill({ color: BG_COLOR });
    this.bgLayer.addChild(bg);

    // 左侧面板背景
    const listBg = new Graphics();
    listBg.rect(0, 0, LIST_WIDTH, this.height)
      .fill({ color: 0x16162a });
    this.bgLayer.addChild(listBg);

    // 分隔线
    const divider = new Graphics();
    divider
      .moveTo(LIST_WIDTH, 0)
      .lineTo(LIST_WIDTH, this.height)
      .stroke({ width: 2, color: 0x333355 });
    this.bgLayer.addChild(divider);

    // 标题
    const title = new Text({
      text: '⚔️ 关卡列表',
      style: new TextStyle({
        fontSize: 18,
        fill: ACCENT_COLOR,
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontWeight: 'bold',
      }),
    });
    title.position.set(16, 16);
    this.bgLayer.addChild(title);
  }

  /** 渲染左侧关卡列表 */
  private renderList(): void {
    this.listLayer.removeChildren();
    this.stageItems = [];

    const startY = 56;
    const padding = 8;

    for (let i = 0; i < this.stages.length; i++) {
      const stage = this.stages[i];
      const y = startY + i * (LIST_ITEM_HEIGHT + padding);
      const isSelected = stage.id === this.selectedStageId;

      const container = new Container({ label: `stage-item-${stage.id}` });
      container.position.set(12, y);
      container.eventMode = 'static';
      container.cursor = stage.isAvailable || stage.isCompleted ? 'pointer' : 'default';

      // 条目背景
      const bgColor = isSelected ? 0x2a2a4e : 0x1e1e38;
      const bg = new Graphics();
      bg.roundRect(0, 0, LIST_WIDTH - 24, LIST_ITEM_HEIGHT, LIST_ITEM_RADIUS)
        .fill({ color: bgColor });
      if (isSelected) {
        bg.roundRect(0, 0, LIST_WIDTH - 24, LIST_ITEM_HEIGHT, LIST_ITEM_RADIUS)
          .stroke({ color: ACCENT_COLOR, width: 2 });
      }
      container.addChild(bg);

      // 状态图标
      const statusIcon = stage.isCompleted ? '✅' : stage.isAvailable ? '➤' : '🔒';
      const iconColor = stage.isCompleted ? STATUS_COMPLETED
        : stage.isAvailable ? STATUS_AVAILABLE : STATUS_LOCKED;

      const icon = new Text({
        text: statusIcon,
        style: new TextStyle({ fontSize: 16, fill: iconColor, fontFamily: 'Arial, "Microsoft YaHei", sans-serif' }),
      });
      icon.position.set(10, LIST_ITEM_HEIGHT / 2);
      icon.anchor.set(0, 0.5);
      container.addChild(icon);

      // 关卡名
      const label = new Text({
        text: stage.name,
        style: new TextStyle({
          fontSize: 14,
          fill: stage.isAvailable || stage.isCompleted ? TEXT_COLOR : 0x666666,
          fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
          fontWeight: isSelected ? 'bold' : 'normal',
        }),
      });
      label.position.set(36, LIST_ITEM_HEIGHT / 2);
      label.anchor.set(0, 0.5);
      container.addChild(label);

      // 星级
      const starsText = new Text({
        text: this.getStarsString(stage.stars),
        style: new TextStyle({ fontSize: 12, fill: 0xf39c12, fontFamily: 'Arial, "Microsoft YaHei", sans-serif' }),
      });
      starsText.anchor.set(1, 0.5);
      starsText.position.set(LIST_WIDTH - 36, LIST_ITEM_HEIGHT / 2);
      container.addChild(starsText);

      // 点击事件
      container.on('pointerdown', () => {
        if (!stage.isAvailable && !stage.isCompleted) return;
        this.selectedStageId = stage.id;
        this.renderList();
        this.renderDetail();
        this.renderButton();
        this.bridgeEvent('combatAction', 'stageSelect', stage.id);
      });

      this.listLayer.addChild(container);
      this.stageItems.push({ id: stage.id, container, bg, label, icon });
    }
  }

  /** 渲染右侧关卡详情 */
  private renderDetail(): void {
    this.detailLayer.removeChildren();

    const stage = this.stages.find((s) => s.id === this.selectedStageId);
    if (!stage) {
      const hint = new Text({
        text: '请选择一个关卡',
        style: new TextStyle({
          fontSize: 18,
          fill: 0x666666,
          fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        }),
      });
      hint.anchor.set(0.5, 0.5);
      hint.position.set(LIST_WIDTH + (this.width - LIST_WIDTH) / 2, this.height / 2);
      this.detailLayer.addChild(hint);
      return;
    }

    const dx = LIST_WIDTH + DETAIL_PADDING;
    let dy = 30;

    // 关卡名称
    const nameText = new Text({
      text: stage.name,
      style: new TextStyle({
        fontSize: 26,
        fill: TEXT_COLOR,
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontWeight: 'bold',
      }),
    });
    nameText.position.set(dx, dy);
    this.detailLayer.addChild(nameText);
    dy += 40;

    // 难度标签
    const diffColor = DIFFICULTY_COLORS[stage.difficulty] ?? 0xffffff;
    const diffLabel = DIFFICULTY_LABELS[stage.difficulty] ?? stage.difficulty;
    const diffBg = new Graphics();
    diffBg.roundRect(dx, dy, 80, 24, 12)
      .fill({ color: diffColor, alpha: 0.2 });
    diffBg.roundRect(dx, dy, 80, 24, 12)
      .stroke({ color: diffColor, width: 1 });
    this.detailLayer.addChild(diffBg);

    const diffText = new Text({
      text: diffLabel,
      style: new TextStyle({ fontSize: 13, fill: diffColor, fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontWeight: 'bold' }),
    });
    diffText.anchor.set(0.5, 0.5);
    diffText.position.set(dx + 40, dy + 12);
    this.detailLayer.addChild(diffText);

    // 星级
    const starsText = new Text({
      text: this.getStarsString(stage.stars),
      style: new TextStyle({ fontSize: 20, fill: 0xf39c12, fontFamily: 'Arial, "Microsoft YaHei", sans-serif' }),
    });
    starsText.position.set(dx + 100, dy);
    this.detailLayer.addChild(starsText);
    dy += 40;

    // 描述
    const descLabel = new Text({
      text: '描述',
      style: new TextStyle({ fontSize: 14, fill: ACCENT_COLOR, fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontWeight: 'bold' }),
    });
    descLabel.position.set(dx, dy);
    this.detailLayer.addChild(descLabel);
    dy += 22;

    const descText = new Text({
      text: stage.description,
      style: new TextStyle({
        fontSize: 14, fill: 0xbdc3c7, fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        wordWrap: true, wordWrapWidth: this.width - LIST_WIDTH - DETAIL_PADDING * 2,
      }),
    });
    descText.position.set(dx, dy);
    this.detailLayer.addChild(descText);
    dy += descText.height + 16;

    // 目标
    const objLabel = new Text({
      text: '🎯 目标',
      style: new TextStyle({ fontSize: 14, fill: ACCENT_COLOR, fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontWeight: 'bold' }),
    });
    objLabel.position.set(dx, dy);
    this.detailLayer.addChild(objLabel);
    dy += 22;

    const objText = new Text({
      text: stage.objective,
      style: new TextStyle({ fontSize: 14, fill: TEXT_COLOR, fontFamily: 'Arial, "Microsoft YaHei", sans-serif' }),
    });
    objText.position.set(dx, dy);
    this.detailLayer.addChild(objText);
    dy += 30;

    // 波次
    const waveText = new Text({
      text: `🌊 波次: ${stage.waveCount}`,
      style: new TextStyle({ fontSize: 14, fill: TEXT_COLOR, fontFamily: 'Arial, "Microsoft YaHei", sans-serif' }),
    });
    waveText.position.set(dx, dy);
    this.detailLayer.addChild(waveText);
    dy += 30;

    // 奖励
    const rewardLabel = new Text({
      text: '🎁 奖励',
      style: new TextStyle({ fontSize: 14, fill: ACCENT_COLOR, fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontWeight: 'bold' }),
    });
    rewardLabel.position.set(dx, dy);
    this.detailLayer.addChild(rewardLabel);
    dy += 22;

    const rewards = stage.rewards;
    const rewardStr = `💰 ${rewards.gold}  🌾 ${rewards.food}  ⚔️ ${rewards.troops}`;
    const rewardText = new Text({
      text: rewardStr,
      style: new TextStyle({ fontSize: 14, fill: 0xf1c40f, fontFamily: 'Arial, "Microsoft YaHei", sans-serif' }),
    });
    rewardText.position.set(dx, dy);
    this.detailLayer.addChild(rewardText);
  }

  /** 渲染底部开始挑战按钮 */
  private renderButton(): void {
    this.buttonLayer.removeChildren();
    this.buttonContainer = null;

    const stage = this.stages.find((s) => s.id === this.selectedStageId);
    const canStart = stage?.isAvailable && !stage.isCompleted;

    const btnX = LIST_WIDTH + (this.width - LIST_WIDTH) / 2 - BUTTON_WIDTH / 2;
    const btnY = this.height - BUTTON_HEIGHT - 30;

    const container = new Container({ label: 'start-battle-btn' });
    container.position.set(btnX, btnY);
    container.eventMode = canStart ? 'static' : 'none';
    container.cursor = canStart ? 'pointer' : 'default';

    const btnColor = canStart ? ACCENT_COLOR : STATUS_LOCKED;
    const bg = new Graphics();
    bg.roundRect(0, 0, BUTTON_WIDTH, BUTTON_HEIGHT, BUTTON_RADIUS)
      .fill({ color: btnColor, alpha: canStart ? 1 : 0.5 });
    container.addChild(bg);

    const btnLabel = new Text({
      text: stage?.isCompleted ? '✅ 已通关' : '⚔️ 开始挑战',
      style: new TextStyle({
        fontSize: 18,
        fill: TEXT_COLOR,
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontWeight: 'bold',
      }),
    });
    btnLabel.anchor.set(0.5, 0.5);
    btnLabel.position.set(BUTTON_WIDTH / 2, BUTTON_HEIGHT / 2);
    container.addChild(btnLabel);

    if (canStart) {
      container.on('pointerdown', () => {
        this.bridgeEvent('combatAction', 'startBattle', this.selectedStageId!);
      });
    }

    this.buttonLayer.addChild(container);
    this.buttonContainer = container;
  }

  // ═══════════════════════════════════════════════════════════
  // 工具方法
  // ═══════════════════════════════════════════════════════════

  /** 生成星级字符串 */
  private getStarsString(stars: number): string {
    return STAR_FILLED.repeat(Math.min(stars, 3)) + STAR_EMPTY.repeat(Math.max(3 - stars, 0));
  }
}
