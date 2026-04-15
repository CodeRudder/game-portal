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
import gsap from 'gsap';
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
   *
   * 深蓝→深紫渐变 + 地面纹理 + 阵营标记 + 虚线分隔
   */
  private createBackground(): void {
    const bg = new Graphics();

    // ─── 渐变背景（深蓝到深紫，分段模拟） ───────────────────
    const steps = 20;
    const w = 1920;
    const h = 1080;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      // 深蓝 0x0d1b2a → 深紫 0x1a0a2e
      const r = Math.round(0x0d + (0x1a - 0x0d) * t);
      const g = Math.round(0x1b + (0x0a - 0x1b) * t);
      const b = Math.round(0x2a + (0x2e - 0x2a) * t);
      const color = (r << 16) | (g << 8) | b;
      bg.rect(0, (h / steps) * i, w, h / steps + 1)
        .fill({ color });
    }

    // ─── 地面纹理（棕色横条） ──────────────────────────────
    const groundY = 700;
    bg.rect(0, groundY, w, 8)
      .fill({ color: 0x3d2b1f, alpha: 0.7 });
    bg.rect(0, groundY + 8, w, 4)
      .fill({ color: 0x2a1f14, alpha: 0.5 });
    // 地面纹理点
    for (let x = 0; x < w; x += 60) {
      bg.rect(x + Math.random() * 20, groundY - 2, 2 + Math.random() * 4, 2)
        .fill({ color: 0x5c4033, alpha: 0.3 });
    }

    // ─── 虚线分隔 ──────────────────────────────────────────
    const dashLen = 16;
    const gapLen = 12;
    for (let y = 0; y < h; y += dashLen + gapLen) {
      bg.moveTo(w / 2, y)
        .lineTo(w / 2, y + dashLen)
        .stroke({ width: 1, color: 0x555577, alpha: 0.25 });
    }

    // ─── 左右阵营标记 ──────────────────────────────────────
    const playerLabel = new Text({
      text: '⚔ 我方',
      style: new TextStyle({
        fontSize: 18,
        fill: '#4ecdc4',
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontWeight: 'bold',
      }),
    });
    playerLabel.anchor.set(0.5, 0);
    playerLabel.position.set(480, groundY + 30);
    playerLabel.alpha = 0.6;
    this.bgLayer.addChild(bg);
    this.bgLayer.addChild(playerLabel);

    const enemyLabel = new Text({
      text: '💀 敌方',
      style: new TextStyle({
        fontSize: 18,
        fill: '#e74c3c',
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontWeight: 'bold',
      }),
    });
    enemyLabel.anchor.set(0.5, 0);
    enemyLabel.position.set(1440, groundY + 30);
    enemyLabel.alpha = 0.6;
    this.bgLayer.addChild(enemyLabel);
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
   *
   * 刷新数据并根据 animState 播放 GSAP 动画。
   */
  private updateUnitDisplay(display: CombatUnitDisplay, data: CombatUnitRenderData): void {
    display.data = data;

    // 更新名称
    display.nameLabel.text = data.name;

    // 更新 HP 条
    const faction = data.faction;
    this.drawHpBar(display.hpBar, display.hpFill, data.currentHp, data.maxHp, faction);

    // 更新存活状态（死亡动画播完后变灰）
    display.container.alpha = data.alive ? 1 : 0.4;

    // ─── 根据 animState 播放角色动画 ────────────────────────
    const animState = data.animState ?? 'idle';
    if (animState === 'idle') return;

    // 清除该角色上正在进行的动画，避免冲突
    gsap.killTweensOf(display.sprite);
    gsap.killTweensOf(display.container);

    switch (animState) {
      case 'attack': {
        // 前冲：x 偏移 +20px，0.2 秒回归
        const dir = data.faction === 'player' ? 1 : -1;
        gsap.to(display.sprite, {
          x: 20 * dir,
          duration: 0.1,
          ease: 'power2.out',
          yoyo: true,
          repeat: 1,
          onComplete: () => {
            display.sprite.x = 0;
          },
        });
        break;
      }

      case 'hurt': {
        // 红色闪烁：alpha 0.3→1 循环 2 次
        const body = display.sprite.getChildAt(0) as Graphics | undefined;
        if (!body) break;
        // 先记录原始 tint（PixiJS v8 没有 tint on Graphics，改用 alpha 闪烁）
        gsap.to(display.container, {
          alpha: 0.3,
          duration: 0.08,
          yoyo: true,
          repeat: 3,
          ease: 'steps(1)',
          onComplete: () => {
            display.container.alpha = data.alive ? 1 : 0.4;
          },
        });
        break;
      }

      case 'die': {
        // 缩放到 0 + alpha 到 0，然后标记灰色
        gsap.to(display.sprite, {
          scale: 0,
          alpha: 0,
          duration: 0.5,
          ease: 'power2.in',
          onComplete: () => {
            display.container.alpha = 0.4;
            display.sprite.alpha = 0.4;
            display.sprite.scale.set(1);
            // 将角色方块变灰（重绘 body）
            const body = display.sprite.getChildAt(0) as Graphics | undefined;
            if (body) {
              body.clear();
              body.roundRect(-UNIT_SIZE / 2, -UNIT_SIZE / 2, UNIT_SIZE, UNIT_SIZE, 8)
                .fill({ color: 0x555555 });
            }
          },
        });
        break;
      }

      case 'skill': {
        // 发光效果：scale 1.2 然后回归
        gsap.to(display.sprite, {
          scale: 1.2,
          duration: 0.15,
          ease: 'power2.out',
          yoyo: true,
          repeat: 1,
          onComplete: () => {
            display.sprite.scale.set(1);
          },
        });
        break;
      }
    }
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
   *
   * 根据特效类型在 effectLayer 上创建图形，使用 GSAP 编排动画，
   * 动画完成后自动销毁并从 effectLayer 移除。
   */
  private createSkillEffect(data: SkillEffectData): void {
    const effectContainer = new Container({ label: `fx-${data.id}` });
    this.effectLayer.addChild(effectContainer);

    const tl = gsap.timeline({
      onComplete: () => {
        effectContainer.destroy({ children: true });
      },
    });

    switch (data.type) {
      // ─── 斩击：白色弧线从 from 到 to，0.3 秒消失 ────────
      case 'slash': {
        const arc = new Graphics();
        const cx = (data.from.x + data.to.x) / 2;
        const cy = (data.from.y + data.to.y) / 2;
        const radius = Math.hypot(data.to.x - data.from.x, data.to.y - data.from.y) / 2;
        const startAngle = Math.atan2(data.to.y - data.from.y, data.to.x - data.from.x) - 0.5;
        const endAngle = startAngle + 1.0;
        arc.arc(cx, cy, Math.max(radius, 30), startAngle, endAngle)
          .stroke({ width: 4, color: 0xffffff, alpha: 0.9 });
        effectContainer.addChild(arc);
        tl.to(arc, { alpha: 0, duration: 0.3, ease: 'power2.out' });
        break;
      }

      // ─── 火焰：红橙色圆形从 from 向 to 扩散移动，0.5 秒 ─
      case 'fire': {
        const fire = new Graphics();
        fire.circle(0, 0, 12)
          .fill({ color: 0xff6622, alpha: 0.85 });
        fire.circle(0, 0, 6)
          .fill({ color: 0xffaa00, alpha: 0.9 });
        fire.position.set(data.from.x, data.from.y);
        effectContainer.addChild(fire);
        tl.to(fire, {
          x: data.to.x,
          y: data.to.y,
          duration: 0.3,
          ease: 'power1.in',
        });
        tl.to(fire.scale, { x: 2.5, y: 2.5, duration: 0.2, ease: 'power2.out' }, '<');
        tl.to(fire, { alpha: 0, duration: 0.2, ease: 'power2.in' });
        break;
      }

      // ─── 冰霜：蓝色菱形在 to 位置出现并缩放消失，0.4 秒
      case 'ice': {
        const ice = new Graphics();
        const s = 20;
        ice.moveTo(0, -s)
          .lineTo(s, 0)
          .lineTo(0, s)
          .lineTo(-s, 0)
          .closePath()
          .fill({ color: 0x66ccff, alpha: 0.85 });
        ice.moveTo(0, -s * 0.5)
          .lineTo(s * 0.5, 0)
          .lineTo(0, s * 0.5)
          .lineTo(-s * 0.5, 0)
          .closePath()
          .fill({ color: 0xaaeeff, alpha: 0.9 });
        ice.position.set(data.to.x, data.to.y);
        effectContainer.addChild(ice);
        tl.from(ice.scale, { x: 0, y: 0, duration: 0.15, ease: 'back.out(2)' });
        tl.to(ice, { alpha: 0, duration: 0.25, ease: 'power2.out' });
        tl.to(ice.scale, { x: 1.5, y: 1.5, duration: 0.25, ease: 'power2.out' }, '<');
        break;
      }

      // ─── 闪电：黄色锯齿线从 from 到 to，0.2 秒闪烁 ─────
      case 'lightning': {
        const bolt = new Graphics();
        const segments = 6;
        const dx = data.to.x - data.from.x;
        const dy = data.to.y - data.from.y;
        bolt.moveTo(data.from.x, data.from.y);
        for (let i = 1; i < segments; i++) {
          const t = i / segments;
          const px = data.from.x + dx * t + (Math.random() - 0.5) * 30;
          const py = data.from.y + dy * t + (Math.random() - 0.5) * 30;
          bolt.lineTo(px, py);
        }
        bolt.lineTo(data.to.x, data.to.y);
        bolt.stroke({ width: 3, color: 0xffee44, alpha: 1 });
        // 外发光层
        bolt.stroke({ width: 8, color: 0xffee44, alpha: 0.3 });
        effectContainer.addChild(bolt);
        // 闪烁 3 次
        tl.to(bolt, { alpha: 0, duration: 0.03 });
        tl.to(bolt, { alpha: 1, duration: 0.03 });
        tl.to(bolt, { alpha: 0, duration: 0.03 });
        tl.to(bolt, { alpha: 1, duration: 0.03 });
        tl.to(bolt, { alpha: 0, duration: 0.08, ease: 'power2.out' });
        break;
      }

      // ─── 治疗：绿色十字在 to 位置旋转上升，0.6 秒 ──────
      case 'heal': {
        const cross = new Graphics();
        const arm = 14;
        const thick = 5;
        cross.rect(-thick / 2, -arm, thick, arm * 2)
          .fill({ color: 0x44ff88, alpha: 0.9 });
        cross.rect(-arm, -thick / 2, arm * 2, thick)
          .fill({ color: 0x44ff88, alpha: 0.9 });
        cross.position.set(data.to.x, data.to.y);
        effectContainer.addChild(cross);
        tl.to(cross, {
          y: data.to.y - 40,
          rotation: Math.PI * 0.5,
          duration: 0.6,
          ease: 'power1.out',
        });
        tl.to(cross, { alpha: 0, duration: 0.3, ease: 'power2.in' }, '-=0.3');
        break;
      }

      // ─── 增益：蓝色光环在 from 位置缩放消失，0.5 秒 ────
      case 'buff': {
        const ring = new Graphics();
        ring.circle(0, 0, 30)
          .stroke({ width: 3, color: 0x4488ff, alpha: 0.8 });
        ring.circle(0, 0, 20)
          .stroke({ width: 2, color: 0x88bbff, alpha: 0.6 });
        ring.position.set(data.from.x, data.from.y);
        effectContainer.addChild(ring);
        tl.from(ring.scale, { x: 0.3, y: 0.3, duration: 0.15, ease: 'back.out(1.5)' });
        tl.to(ring.scale, { x: 1.8, y: 1.8, duration: 0.35, ease: 'power2.out' });
        tl.to(ring, { alpha: 0, duration: 0.35, ease: 'power2.in' }, '<');
        break;
      }

      // ─── 减益：紫色光环在 to 位置缩放消失，0.5 秒 ──────
      case 'debuff': {
        const ring = new Graphics();
        ring.circle(0, 0, 30)
          .stroke({ width: 3, color: 0xaa44ff, alpha: 0.8 });
        ring.circle(0, 0, 20)
          .stroke({ width: 2, color: 0xcc88ff, alpha: 0.6 });
        ring.position.set(data.to.x, data.to.y);
        effectContainer.addChild(ring);
        tl.from(ring.scale, { x: 1.5, y: 1.5, duration: 0.15, ease: 'power2.out' });
        tl.to(ring.scale, { x: 0.3, y: 0.3, duration: 0.35, ease: 'power2.in' });
        tl.to(ring, { alpha: 0, duration: 0.35, ease: 'power2.in' }, '<');
        break;
      }
    }
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
