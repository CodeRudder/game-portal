/**
 * renderer/scenes/CombatScene.ts — 战斗场景
 *
 * 显示回合/即时战斗画面，包含：
 * - 战斗角色精灵（玩家方/敌方）
 * - HP 条
 * - 技能特效
 * - 伤害数字飘字
 * - 战斗状态指示
 *
 * @module renderer/scenes/CombatScene
 */

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type {
  SceneType,
  CombatRenderData,
  CombatUnitRenderData,
  DamageNumberData,
  SkillEffectData,
  GameRenderState,
} from '../types';
import { BaseScene, type SceneEventBridge } from './BaseScene';
import type { AssetManager } from '../managers/AssetManager';
import type { AnimationManager } from '../managers/AnimationManager';

// ═══════════════════════════════════════════════════════════════
// 常量
// ═══════════════════════════════════════════════════════════════

/** 角色精灵尺寸 */
const UNIT_SIZE = 60;

/** HP 条宽度 */
const HP_BAR_WIDTH = 50;

/** HP 条高度 */
const HP_BAR_HEIGHT = 6;

/** HP 条背景色 */
const HP_BAR_BG = 0x333333;

/** HP 条前景色（玩家） */
const HP_BAR_PLAYER = 0x4ecdc4;

/** HP 条前景色（敌方） */
const HP_BAR_ENEMY = 0xe74c3c;

/** 飘字持续时间（毫秒） */
const DAMAGE_TEXT_DURATION = 1000;

/** 飘字上升距离 */
const DAMAGE_TEXT_RISE = 60;

// ═══════════════════════════════════════════════════════════════
// 内部渲染对象接口
// ═══════════════════════════════════════════════════════════════

/** 战斗角色渲染对象 */
interface CombatUnitDisplay {
  id: string;
  container: Container;
  sprite: Container;     // 角色精灵容器（后续替换为 AnimatedSprite）
  hpBar: Graphics;       // HP 条
  hpFill: Graphics;      // HP 填充
  nameLabel: Text;       // 名称
  data: CombatUnitRenderData | null;
}

/** 飘字渲染对象 */
interface FloatingDamageText {
  id: string;
  text: Text;
  elapsed: number;
  duration: number;
}

// ═══════════════════════════════════════════════════════════════
// CombatScene
// ═══════════════════════════════════════════════════════════════

/**
 * 战斗场景
 *
 * 左右对排列阵，玩家方在左，敌方在右。
 * 支持技能特效、伤害飘字、HP 条动画。
 */
export class CombatScene extends BaseScene {
  readonly type: SceneType = 'combat';

  // ─── 子容器 ───────────────────────────────────────────────

  /** 背景层 */
  private bgLayer: Container;
  /** 玩家方容器 */
  private playerLayer: Container;
  /** 敌方容器 */
  private enemyLayer: Container;
  /** 特效层 */
  private effectLayer: Container;
  /** 飘字层 */
  private damageTextLayer: Container;
  /** UI 层（波次信息等） */
  private uiLayer: Container;

  // ─── 渲染对象缓存 ─────────────────────────────────────────

  /** 角色显示对象映射 */
  private unitDisplays: Map<string, CombatUnitDisplay> = new Map();
  /** 活跃的飘字 */
  private floatingTexts: FloatingDamageText[] = [];

  // ─── UI 元素 ──────────────────────────────────────────────

  /** 波次信息文本 */
  private waveText: Text | null = null;
  /** 战斗状态文本 */
  private statusText: Text | null = null;

  // ═══════════════════════════════════════════════════════════
  // 构造函数
  // ═══════════════════════════════════════════════════════════

  constructor(
    assetManager: AssetManager,
    animationManager: AnimationManager,
    bridgeEvent: SceneEventBridge,
  ) {
    super(assetManager, animationManager, bridgeEvent);

    this.bgLayer = new Container({ label: 'bg' });
    this.playerLayer = new Container({ label: 'player-units' });
    this.enemyLayer = new Container({ label: 'enemy-units' });
    this.effectLayer = new Container({ label: 'effects' });
    this.damageTextLayer = new Container({ label: 'damage-texts' });
    this.uiLayer = new Container({ label: 'ui' });

    this.container.addChild(
      this.bgLayer,
      this.playerLayer,
      this.enemyLayer,
      this.effectLayer,
      this.damageTextLayer,
      this.uiLayer,
    );
  }

  // ═══════════════════════════════════════════════════════════
  // 生命周期
  // ═══════════════════════════════════════════════════════════

  protected async onCreate(): Promise<void> {
    // 创建背景
    this.createBackground();

    // 创建 UI 元素
    this.createUI();

    // 设置交互
    this.container.eventMode = 'static';
  }

  protected async onEnter(_params?: Record<string, unknown>): Promise<void> {
    // TODO: 加载战斗资源包
    // await this.assetManager.loadBundle('combat');
  }

  protected async onExit(): Promise<void> {
    // 清理战斗状态
    this.clearAllUnits();
    this.clearAllFloatingTexts();
  }

  protected onUpdate(deltaTime: number): void {
    // 更新飘字动画
    this.updateFloatingTexts(deltaTime);
  }

  protected onSetData(data: unknown): void {
    const state = data as GameRenderState;
    if (!state.combat) return;

    this.renderCombat(state.combat);
  }

  protected onDestroy(): void {
    this.unitDisplays.clear();
    this.floatingTexts = [];
  }

  // ═══════════════════════════════════════════════════════════
  // 渲染
  // ═══════════════════════════════════════════════════════════

  /**
   * 渲染完整战斗场景
   */
  private renderCombat(data: CombatRenderData): void {
    // 更新波次信息
    this.updateWaveText(data.currentWave, data.totalWaves);

    // 更新战斗状态
    this.updateStatusText(data.state);

    // 更新角色
    this.renderUnits(data.playerUnits, 'player');
    this.renderUnits(data.enemyUnits, 'enemy');

    // 创建伤害飘字
    for (const dmg of data.damageNumbers) {
      this.createDamageText(dmg);
    }

    // 创建技能特效
    for (const effect of data.skillEffects) {
      this.createSkillEffect(effect);
    }
  }

  /**
   * 创建战斗背景
   */
  private createBackground(): void {
    const bg = new Graphics();
    // 战场背景 — 左右分区
    bg.rect(0, 0, 1920, 1080)
      .fill({ color: 0x1a1a2e, alpha: 0.9 });
    // 中线
    bg.moveTo(960, 0)
      .lineTo(960, 1080)
      .stroke({ width: 1, color: 0x333355, alpha: 0.5 });
    this.bgLayer.addChild(bg);
  }

  /**
   * 创建 UI 元素
   */
  private createUI(): void {
    // 波次信息
    this.waveText = new Text({
      text: '第 1/1 波',
      style: new TextStyle({
        fontSize: 24,
        fill: '#ffd700',
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontWeight: 'bold',
        align: 'center',
      }),
    });
    this.waveText.anchor.set(0.5, 0);
    this.waveText.position.set(960, 20);
    this.uiLayer.addChild(this.waveText);

    // 战斗状态
    this.statusText = new Text({
      text: '',
      style: new TextStyle({
        fontSize: 36,
        fill: '#ffffff',
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontWeight: 'bold',
        align: 'center',
        stroke: { color: '#000000', width: 3 },
      }),
    });
    this.statusText.anchor.set(0.5, 0.5);
    this.statusText.position.set(960, 540);
    this.statusText.visible = false;
    this.uiLayer.addChild(this.statusText);
  }

  /**
   * 渲染角色列表
   */
  private renderUnits(units: CombatUnitRenderData[], faction: 'player' | 'enemy'): void {
    const layer = faction === 'player' ? this.playerLayer : this.enemyLayer;
    const activeIds = new Set<string>();

    // 基础 X 偏移：玩家在左侧，敌方在右侧
    const baseX = faction === 'player' ? 200 : 1200;
    const spacing = 120;

    for (let i = 0; i < units.length; i++) {
      const unit = units[i];
      activeIds.add(unit.id);

      let display = this.unitDisplays.get(unit.id);
      if (!display) {
        display = this.createUnitDisplay(unit, baseX + i * spacing, 400 + (i % 2) * 80, faction);
        this.unitDisplays.set(unit.id, display);
        layer.addChild(display.container);
      } else {
        this.updateUnitDisplay(display, unit);
      }
    }

    // 移除不再存在的角色
    for (const [id, display] of this.unitDisplays) {
      if (!activeIds.has(id)) {
        const parentLayer = display.container.parent;
        if (parentLayer) parentLayer.removeChild(display.container);
        display.container.destroy({ children: true });
        this.unitDisplays.delete(id);
      }
    }
  }

  /**
   * 创建角色显示对象
   */
  private createUnitDisplay(
    data: CombatUnitRenderData,
    x: number,
    y: number,
    faction: 'player' | 'enemy',
  ): CombatUnitDisplay {
    const container = new Container({ label: `unit-${data.id}` });
    container.position.set(x, y);
    container.eventMode = 'static';
    container.cursor = 'pointer';

    // 角色精灵（占位 — 使用彩色方块 + 名字）
    const sprite = new Container();
    const body = new Graphics();
    const bodyColor = faction === 'player' ? 0x4ecdc4 : 0xe74c3c;
    body.roundRect(-UNIT_SIZE / 2, -UNIT_SIZE / 2, UNIT_SIZE, UNIT_SIZE, 8)
      .fill({ color: bodyColor });
    sprite.addChild(body);
    container.addChild(sprite);

    // 名称
    const nameLabel = new Text({
      text: data.name,
      style: new TextStyle({
        fontSize: 11,
        fill: '#ffffff',
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontWeight: 'bold',
        align: 'center',
      }),
    });
    nameLabel.anchor.set(0.5, 0);
    nameLabel.position.set(0, UNIT_SIZE / 2 + 4);
    container.addChild(nameLabel);

    // HP 条
    const hpBar = new Graphics();
    hpBar.position.set(-HP_BAR_WIDTH / 2, -UNIT_SIZE / 2 - 12);
    container.addChild(hpBar);

    const hpFill = new Graphics();
    hpFill.position.set(-HP_BAR_WIDTH / 2, -UNIT_SIZE / 2 - 12);
    container.addChild(hpFill);

    // 初始绘制
    this.drawHpBar(hpBar, hpFill, data.currentHp, data.maxHp, faction);

    // 交互
    container.on('pointerdown', () => {
      this.bridgeEvent('combatAction', 'selectTarget', data.id);
    });

    return { id: data.id, container, sprite, hpBar, hpFill, nameLabel, data };
  }

  /**
   * 更新角色显示对象
   */
  private updateUnitDisplay(display: CombatUnitDisplay, data: CombatUnitRenderData): void {
    display.data = data;

    // 更新名称
    display.nameLabel.text = data.name;

    // 更新 HP 条
    const faction = data.faction;
    this.drawHpBar(display.hpBar, display.hpFill, data.currentHp, data.maxHp, faction);

    // 更新存活状态
    display.container.alpha = data.alive ? 1 : 0.4;

    // TODO: 根据 animState 播放对应动画
    // idle / attack / hurt / die / skill
  }

  /**
   * 绘制 HP 条
   */
  private drawHpBar(
    bg: Graphics,
    fill: Graphics,
    current: number,
    max: number,
    faction: 'player' | 'enemy',
  ): void {
    const ratio = Math.max(0, Math.min(1, current / max));

    bg.clear();
    bg.roundRect(0, 0, HP_BAR_WIDTH, HP_BAR_HEIGHT, 2)
      .fill({ color: HP_BAR_BG });

    fill.clear();
    if (ratio > 0) {
      const fillColor = faction === 'player' ? HP_BAR_PLAYER : HP_BAR_ENEMY;
      fill.roundRect(0, 0, HP_BAR_WIDTH * ratio, HP_BAR_HEIGHT, 2)
        .fill({ color: fillColor });
    }
  }

  /**
   * 创建伤害飘字
   */
  private createDamageText(data: DamageNumberData): void {
    // 避免重复创建
    const existing = this.floatingTexts.find((ft) => ft.id === data.id);
    if (existing) return;

    const colorMap: Record<string, string> = {
      normal: '#ffffff',
      critical: '#ffd700',
      heal: '#4ecdc4',
      miss: '#888888',
    };

    const text = new Text({
      text: data.type === 'miss' ? 'MISS' : `${data.value}`,
      style: new TextStyle({
        fontSize: data.type === 'critical' ? 28 : 20,
        fill: data.color ?? colorMap[data.type] ?? '#ffffff',
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontWeight: 'bold',
        stroke: { color: '#000000', width: 2 },
      }),
    });
    text.anchor.set(0.5, 0.5);
    text.position.set(data.position.x, data.position.y);
    this.damageTextLayer.addChild(text);

    this.floatingTexts.push({
      id: data.id,
      text,
      elapsed: 0,
      duration: DAMAGE_TEXT_DURATION,
    });
  }

  /**
   * 更新飘字动画
   */
  private updateFloatingTexts(deltaTime: number): void {
    const toRemove: number[] = [];

    for (let i = 0; i < this.floatingTexts.length; i++) {
      const ft = this.floatingTexts[i];
      ft.elapsed += deltaTime;

      const progress = ft.elapsed / ft.duration;
      if (progress >= 1) {
        toRemove.push(i);
        continue;
      }

      // 上升 + 淡出
      ft.text.y -= (DAMAGE_TEXT_RISE * deltaTime) / ft.duration;
      ft.text.alpha = 1 - progress;
    }

    // 移除完成的飘字
    for (let i = toRemove.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[toRemove[i]];
      this.damageTextLayer.removeChild(ft.text);
      ft.text.destroy();
      this.floatingTexts.splice(toRemove[i], 1);
    }
  }

  /**
   * 创建技能特效
   */
  private createSkillEffect(_data: SkillEffectData): void {
    // TODO: 实现技能特效
    // 1. 根据 type 选择特效模板
    // 2. 在 effectLayer 创建粒子/图形
    // 3. 使用 GSAP 编排动画
    // 4. 动画完成后自动清理
  }

  // ═══════════════════════════════════════════════════════════
  // UI 更新
  // ═══════════════════════════════════════════════════════════

  private updateWaveText(current: number, total: number): void {
    if (this.waveText) {
      this.waveText.text = `第 ${current}/${total} 波`;
    }
  }

  private updateStatusText(state: CombatRenderData['state']): void {
    if (!this.statusText) return;

    const stateTextMap: Record<string, string> = {
      preparing: '准备战斗...',
      fighting: '',
      victory: '🎉 战斗胜利！',
      defeat: '💀 战败...',
    };

    this.statusText.text = stateTextMap[state] ?? '';
    this.statusText.visible = state === 'victory' || state === 'defeat';
  }

  // ═══════════════════════════════════════════════════════════
  // 清理
  // ═══════════════════════════════════════════════════════════

  private clearAllUnits(): void {
    for (const display of this.unitDisplays.values()) {
      display.container.destroy({ children: true });
    }
    this.unitDisplays.clear();
  }

  private clearAllFloatingTexts(): void {
    for (const ft of this.floatingTexts) {
      ft.text.destroy();
    }
    this.floatingTexts = [];
  }
}
