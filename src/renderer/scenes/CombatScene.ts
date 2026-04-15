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

import { Container, Graphics, Sprite, Text, TextStyle } from 'pixi.js';
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

/** 角色待机浮动幅度（像素） */
const IDLE_FLOAT_AMPLITUDE = 3;

/** 角色待机浮动周期（秒） */
const IDLE_FLOAT_DURATION = 1.5;

/** 镜头聚焦缩放级别 */
const CAMERA_FOCUS_ZOOM = 1.3;

/** 镜头聚焦持续时间（秒） */
const CAMERA_FOCUS_DURATION = 0.4;

/** 镜头回位持续时间（秒） */
const CAMERA_RESET_DURATION = 0.6;

/** 战斗日志最大条目数 */
const COMBAT_LOG_MAX = 50;

/** 行动顺序头像尺寸 */
const TURN_AVATAR_SIZE = 40;

/** 行动顺序条高度 */
const TURN_BAR_HEIGHT = 60;

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

/** 战斗日志条目 */
interface CombatLogEntry {
  text: string;
  color: string;
  container: Container;
}

/** 镜头状态 */
interface CameraState {
  x: number;
  y: number;
  zoom: number;
}

/** 技能特效参数定义 */
interface SkillEffectParams {
  /** 持续时间（秒） */
  duration: number;
  /** 扩散范围（像素半径） */
  range: number;
  /** 主颜色 */
  primaryColor: number;
  /** 副颜色 */
  secondaryColor: number;
  /** 粒子数量 */
  particleCount: number;
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
  /** 回合指示器文本 */
  private roundText: Text | null = null;
  /** 行动顺序条容器 */
  private turnOrderBar: Container | null = null;
  /** 战斗日志容器 */
  private combatLogContainer: Container | null = null;
  /** 战斗日志条目列表 */
  private combatLogEntries: CombatLogEntry[] = [];

  // ─── 镜头系统 ─────────────────────────────────────────────

  /** 镜头容器（包裹所有游戏内容以实现镜头平移/缩放） */
  private cameraContainer: Container;
  /** 当前镜头状态 */
  private cameraState: CameraState = { x: 960, y: 540, zoom: 1 };
  /** 镜头默认状态（全景） */
  private readonly cameraDefault: CameraState = { x: 960, y: 540, zoom: 1 };

  // ─── 增强特效 ─────────────────────────────────────────────

  /** 技能特效参数映射 */
  private static readonly SKILL_PARAMS: Record<string, SkillEffectParams> = {
    freeze: { duration: 0.6, range: 50, primaryColor: 0x66ccff, secondaryColor: 0xaaeeff, particleCount: 12 },
    flame: { duration: 0.5, range: 45, primaryColor: 0xff4400, secondaryColor: 0xffaa00, particleCount: 10 },
    thunder: { duration: 0.35, range: 60, primaryColor: 0xffee44, secondaryColor: 0xffffaa, particleCount: 3 },
  };

  // ═══════════════════════════════════════════════════════════
  // 构造函数
  // ═══════════════════════════════════════════════════════════

  constructor(
    assetManager: AssetManager,
    animationManager: AnimationManager,
    bridgeEvent: SceneEventBridge,
  ) {
    super(assetManager, animationManager, bridgeEvent);

    // 镜头容器：包裹所有游戏内容，实现镜头平移/缩放
    this.cameraContainer = new Container({ label: 'camera' });
    this.cameraContainer.position.set(this.cameraDefault.x, this.cameraDefault.y);

    this.bgLayer = new Container({ label: 'bg' });
    this.playerLayer = new Container({ label: 'player-units' });
    this.enemyLayer = new Container({ label: 'enemy-units' });
    this.effectLayer = new Container({ label: 'effects' });
    this.damageTextLayer = new Container({ label: 'damage-texts' });

    // 游戏内容挂到镜头容器下（镜头移动时整体跟随）
    this.cameraContainer.addChild(
      this.bgLayer,
      this.playerLayer,
      this.enemyLayer,
      this.effectLayer,
      this.damageTextLayer,
    );

    // UI 层不跟随镜头移动
    this.uiLayer = new Container({ label: 'ui' });

    this.container.addChild(
      this.cameraContainer,
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

    // 创建回合指示器
    this.createRoundIndicator();

    // 创建行动顺序条
    this.createTurnOrderBar();

    // 创建战斗日志面板
    this.createCombatLog();

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
    // 重置镜头
    this.resetCamera();
    // 清理战斗日志
    this.clearCombatLog();
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
    this.combatLogEntries = [];
    gsap.killTweensOf(this.cameraContainer);
    gsap.killTweensOf(this.cameraContainer.scale);
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

    // 更新回合指示器
    this.updateRoundIndicator(data);

    // 更新行动顺序条
    this.updateTurnOrderBar(data);

    // 更新角色
    this.renderUnits(data.playerUnits, 'player');
    this.renderUnits(data.enemyUnits, 'enemy');

    // 创建伤害飘字
    for (const dmg of data.damageNumbers) {
      this.createDamageText(dmg);
      this.addCombatLogEntry(this.formatDamageLog(dmg));
    }

    // 创建技能特效（含镜头聚焦）
    for (const effect of data.skillEffects) {
      this.createSkillEffect(effect);
      this.triggerCameraFocus(effect);
      this.addCombatLogEntry(this.formatEffectLog(effect));
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
   *
   * 优先从 AssetManager 获取精灵纹理，fallback 到彩色方块。
   * 自动设置朝向（玩家朝右，敌方朝左）并启动待机浮动动画。
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

    // ─── 角色精灵 ──────────────────────────────────────────
    const sprite = new Container();
    const assetKey = data.spriteAsset ?? (faction === 'player' ? `hero-${data.id}` : `enemy-${data.id}`);
    const texture = this.assetManager.getTexture(assetKey);

    if (texture) {
      // 使用纹理精灵渲染
      const sp = new Sprite(texture);
      sp.width = UNIT_SIZE;
      sp.height = UNIT_SIZE;
      sp.anchor.set(0.5);
      sprite.addChild(sp);
    } else {
      // Fallback：彩色方块（带渐变效果）
      const body = new Graphics();
      const bodyColor = faction === 'player' ? 0x4ecdc4 : 0xe74c3c;
      // 外框
      body.roundRect(-UNIT_SIZE / 2, -UNIT_SIZE / 2, UNIT_SIZE, UNIT_SIZE, 8)
        .fill({ color: bodyColor });
      // 内部高光
      body.roundRect(-UNIT_SIZE / 2 + 3, -UNIT_SIZE / 2 + 3, UNIT_SIZE - 6, UNIT_SIZE / 2 - 3, 5)
        .fill({ color: 0xffffff, alpha: 0.15 });
      sprite.addChild(body);
    }

    // 设置朝向：玩家方朝右(scaleX=1)，敌方朝左(scaleX=-1)
    sprite.scale.x = faction === 'player' ? 1 : -1;
    container.addChild(sprite);

    // ─── 待机动画：微弱上下浮动（GSAP yoyo） ──────────────
    gsap.to(sprite, {
      y: -IDLE_FLOAT_AMPLITUDE,
      duration: IDLE_FLOAT_DURATION,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
      delay: Math.random() * IDLE_FLOAT_DURATION, // 随机相位错开
    });

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

      // ─── 冰冻：蓝色粒子从中心向外扩散，带冰晶效果 ───────
      case 'freeze': {
        const params = CombatScene.SKILL_PARAMS.freeze;
        const cx = data.to.x;
        const cy = data.to.y;

        // 冰晶粒子
        for (let i = 0; i < params.particleCount; i++) {
          const particle = new Graphics();
          const angle = (Math.PI * 2 / params.particleCount) * i;
          const size = 4 + Math.random() * 6;
          // 菱形冰晶
          particle.moveTo(0, -size)
            .lineTo(size * 0.6, 0)
            .lineTo(0, size)
            .lineTo(-size * 0.6, 0)
            .closePath()
            .fill({ color: i % 2 === 0 ? params.primaryColor : params.secondaryColor, alpha: 0.9 });
          particle.position.set(cx, cy);
          effectContainer.addChild(particle);

          const dist = params.range * (0.6 + Math.random() * 0.4);
          const targetX = cx + Math.cos(angle) * dist;
          const targetY = cy + Math.sin(angle) * dist;
          tl.to(particle, {
            x: targetX,
            y: targetY,
            alpha: 0,
            duration: params.duration,
            ease: 'power2.out',
          }, 0);
          tl.to(particle.scale, {
            x: 0.2,
            y: 0.2,
            duration: params.duration,
            ease: 'power2.in',
          }, 0);
        }

        // 中心冰环
        const iceRing = new Graphics();
        iceRing.circle(0, 0, 10)
          .stroke({ width: 2, color: params.primaryColor, alpha: 0.8 });
        iceRing.position.set(cx, cy);
        effectContainer.addChild(iceRing);
        tl.from(iceRing.scale, { x: 0, y: 0, duration: 0.1, ease: 'back.out(2)' }, 0);
        tl.to(iceRing.scale, { x: 3, y: 3, duration: params.duration, ease: 'power2.out' }, 0.1);
        tl.to(iceRing, { alpha: 0, duration: params.duration * 0.5 }, params.duration * 0.5);
        break;
      }

      // ─── 火焰：红橙渐变扩散，带火焰粒子上升效果 ──────────
      case 'flame': {
        const params = CombatScene.SKILL_PARAMS.flame;
        const fx = data.from.x;
        const fy = data.from.y;
        const tx = data.to.x;
        const ty = data.to.y;

        // 火焰粒子（从施法者飞向目标并扩散）
        for (let i = 0; i < params.particleCount; i++) {
          const particle = new Graphics();
          const radius = 5 + Math.random() * 8;
          particle.circle(0, 0, radius)
            .fill({
              color: i % 3 === 0 ? params.primaryColor : params.secondaryColor,
              alpha: 0.7 + Math.random() * 0.3,
            });
          particle.position.set(fx, fy);
          effectContainer.addChild(particle);

          const spread = params.range * 0.5;
          const targetX = tx + (Math.random() - 0.5) * spread;
          const targetY = ty + (Math.random() - 0.5) * spread;
          const delay = i * 0.03;

          tl.to(particle, {
            x: targetX,
            y: targetY - 15, // 火焰向上飘
            duration: params.duration * 0.6,
            ease: 'power2.in',
          }, delay);
          tl.to(particle, {
            alpha: 0,
            y: `-=${20}`,
            duration: params.duration * 0.4,
            ease: 'power1.out',
          }, params.duration * 0.5 + delay);
        }

        // 目标处爆发光环
        const burst = new Graphics();
        burst.circle(0, 0, 15)
          .fill({ color: params.secondaryColor, alpha: 0.6 });
        burst.circle(0, 0, 8)
          .fill({ color: 0xffdd44, alpha: 0.8 });
        burst.position.set(tx, ty);
        burst.scale.set(0);
        effectContainer.addChild(burst);
        tl.to(burst.scale, { x: 2.5, y: 2.5, duration: 0.2, ease: 'back.out(2)' }, params.duration * 0.5);
        tl.to(burst, { alpha: 0, duration: 0.3, ease: 'power2.in' }, params.duration * 0.6);
        break;
      }

      // ─── 雷电：锯齿线条从 from 到 to，带分支闪电 ─────────
      case 'thunder': {
        const params = CombatScene.SKILL_PARAMS.thunder;
        const segments = 8;
        const dx = data.to.x - data.from.x;
        const dy = data.to.y - data.from.y;

        // 主闪电线条
        const mainBolt = new Graphics();
        mainBolt.moveTo(data.from.x, data.from.y);
        for (let i = 1; i < segments; i++) {
          const t = i / segments;
          const px = data.from.x + dx * t + (Math.random() - 0.5) * 40;
          const py = data.from.y + dy * t + (Math.random() - 0.5) * 40;
          mainBolt.lineTo(px, py);
        }
        mainBolt.lineTo(data.to.x, data.to.y);
        // 外发光
        mainBolt.stroke({ width: 10, color: params.secondaryColor, alpha: 0.25 });
        // 内芯
        mainBolt.moveTo(data.from.x, data.from.y);
        for (let i = 1; i < segments; i++) {
          const t = i / segments;
          const px = data.from.x + dx * t + (Math.random() - 0.5) * 40;
          const py = data.from.y + dy * t + (Math.random() - 0.5) * 40;
          mainBolt.lineTo(px, py);
        }
        mainBolt.lineTo(data.to.x, data.to.y);
        mainBolt.stroke({ width: 3, color: params.primaryColor, alpha: 1 });
        effectContainer.addChild(mainBolt);

        // 分支闪电（2条）
        for (let b = 0; b < 2; b++) {
          const branch = new Graphics();
          const branchStart = Math.random();
          const bsx = data.from.x + dx * branchStart + (Math.random() - 0.5) * 20;
          const bsy = data.from.y + dy * branchStart + (Math.random() - 0.5) * 20;
          branch.moveTo(bsx, bsy);
          for (let j = 1; j <= 3; j++) {
            const bt = j / 3;
            branch.lineTo(
              bsx + (Math.random() - 0.5) * params.range * bt,
              bsy + (Math.random() - 0.5) * params.range * bt,
            );
          }
          branch.stroke({ width: 1.5, color: params.primaryColor, alpha: 0.7 });
          effectContainer.addChild(branch);

          // 分支闪一下就消失
          tl.to(branch, { alpha: 0, duration: 0.05 }, b * 0.04);
        }

        // 主闪电快速闪烁
        tl.to(mainBolt, { alpha: 0.2, duration: 0.04 });
        tl.to(mainBolt, { alpha: 1, duration: 0.04 });
        tl.to(mainBolt, { alpha: 0.1, duration: 0.04 });
        tl.to(mainBolt, { alpha: 0.8, duration: 0.04 });
        tl.to(mainBolt, { alpha: 0, duration: 0.12, ease: 'power2.out' });

        // 落点闪光
        const flash = new Graphics();
        flash.circle(0, 0, 20)
          .fill({ color: 0xffffff, alpha: 0.9 });
        flash.position.set(data.to.x, data.to.y);
        flash.scale.set(0);
        effectContainer.addChild(flash);
        tl.to(flash.scale, { x: 1.5, y: 1.5, duration: 0.08, ease: 'power2.out' }, 0.15);
        tl.to(flash, { alpha: 0, duration: 0.15 }, 0.2);
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
  // 增强功能：回合指示器 / 行动顺序 / 战斗日志 / 镜头系统
  // ═══════════════════════════════════════════════════════════

  /**
   * 创建回合指示器（顶部居中显示 "Round N"）
   */
  private createRoundIndicator(): void {
    this.roundText = new Text({
      text: 'Round 1',
      style: new TextStyle({
        fontSize: 20,
        fill: '#cccccc',
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontWeight: 'bold',
        align: 'center',
        stroke: { color: '#000000', width: 2 },
      }),
    });
    this.roundText.anchor.set(0.5, 0);
    this.roundText.position.set(960, 55);
    this.uiLayer.addChild(this.roundText);
  }

  /**
   * 更新回合指示器
   */
  private updateRoundIndicator(data: CombatRenderData): void {
    if (!this.roundText) return;
    // 用 battleId 的哈希或 wave 推算回合数（简化：用 currentWave）
    this.roundText.text = `Round ${data.currentWave}`;
  }

  /**
   * 创建行动顺序条（底部显示角色头像列表）
   */
  private createTurnOrderBar(): void {
    this.turnOrderBar = new Container({ label: 'turn-order-bar' });
    this.turnOrderBar.position.set(960, 1020);

    // 背景条
    const barBg = new Graphics();
    barBg.roundRect(-500, -TURN_BAR_HEIGHT / 2, 1000, TURN_BAR_HEIGHT, 8)
      .fill({ color: 0x000000, alpha: 0.5 });
    barBg.roundRect(-500, -TURN_BAR_HEIGHT / 2, 1000, TURN_BAR_HEIGHT, 8)
      .stroke({ width: 1, color: 0x555577, alpha: 0.4 });
    this.turnOrderBar.addChild(barBg);

    // 标签
    const label = new Text({
      text: '行动顺序',
      style: new TextStyle({
        fontSize: 11,
        fill: '#888888',
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
      }),
    });
    label.anchor.set(0.5, 0.5);
    label.position.set(-470, 0);
    this.turnOrderBar.addChild(label);

    this.uiLayer.addChild(this.turnOrderBar);
  }

  /**
   * 更新行动顺序条
   *
   * 按速度排列所有存活角色，显示小头像方块。
   */
  private updateTurnOrderBar(data: CombatRenderData): void {
    if (!this.turnOrderBar) return;

    // 移除旧的头像（保留前2个子对象：背景 + 标签）
    while (this.turnOrderBar.children.length > 2) {
      const child = this.turnOrderBar.children[this.turnOrderBar.children.length - 1];
      this.turnOrderBar.removeChild(child);
      child.destroy();
    }

    // 合并并排序所有存活角色（按攻击力简化排序）
    const allUnits = [
      ...data.playerUnits.filter((u) => u.alive),
      ...data.enemyUnits.filter((u) => u.alive),
    ].sort((a, b) => b.attack - a.attack);

    const startX = -420;
    const spacing = TURN_AVATAR_SIZE + 8;

    for (let i = 0; i < allUnits.length; i++) {
      const unit = allUnits[i];
      const avatarContainer = new Container();
      avatarContainer.position.set(startX + i * spacing, 0);

      // 头像方块
      const avatar = new Graphics();
      const color = unit.faction === 'player' ? 0x4ecdc4 : 0xe74c3c;
      avatar.roundRect(
        -TURN_AVATAR_SIZE / 2,
        -TURN_AVATAR_SIZE / 2,
        TURN_AVATAR_SIZE,
        TURN_AVATAR_SIZE,
        4,
      ).fill({ color });

      // 尝试加载纹理
      const assetKey = unit.spriteAsset ?? (unit.faction === 'player' ? `hero-${unit.id}` : `enemy-${unit.id}`);
      const texture = this.assetManager.getTexture(assetKey);
      if (texture) {
        const sp = new Sprite(texture);
        sp.width = TURN_AVATAR_SIZE - 4;
        sp.height = TURN_AVATAR_SIZE - 4;
        sp.anchor.set(0.5);
        avatarContainer.addChild(sp);
      } else {
        avatarContainer.addChild(avatar);
      }

      // 名字缩写
      const shortName = new Text({
        text: unit.name.charAt(0),
        style: new TextStyle({
          fontSize: 14,
          fill: '#ffffff',
          fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
          fontWeight: 'bold',
        }),
      });
      shortName.anchor.set(0.5, 0.5);
      avatarContainer.addChild(shortName);

      this.turnOrderBar.addChild(avatarContainer);
    }
  }

  /**
   * 创建战斗日志面板（右侧滚动文本）
   */
  private createCombatLog(): void {
    this.combatLogContainer = new Container({ label: 'combat-log' });
    this.combatLogContainer.position.set(1600, 80);

    // 面板背景
    const panelBg = new Graphics();
    panelBg.roundRect(0, 0, 280, 500, 6)
      .fill({ color: 0x000000, alpha: 0.4 });
    panelBg.roundRect(0, 0, 280, 500, 6)
      .stroke({ width: 1, color: 0x444466, alpha: 0.3 });
    this.combatLogContainer.addChild(panelBg);

    // 标题
    const title = new Text({
      text: '📜 战斗日志',
      style: new TextStyle({
        fontSize: 14,
        fill: '#aaaaaa',
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontWeight: 'bold',
      }),
    });
    title.position.set(10, 8);
    this.combatLogContainer.addChild(title);

    // 日志内容容器（用于滚动裁剪）
    const logContent = new Container({ label: 'log-content' });
    logContent.position.set(10, 35);
    this.combatLogContainer.addChild(logContent);

    this.uiLayer.addChild(this.combatLogContainer);
  }

  /**
   * 添加战斗日志条目
   */
  private addCombatLogEntry(text: string, color: string = '#cccccc'): void {
    if (!this.combatLogContainer) return;

    const logContent = this.combatLogContainer.getChildByLabel('log-content');
    if (!logContent) return;

    // 创建条目
    const entryContainer = new Container();
    const entryText = new Text({
      text,
      style: new TextStyle({
        fontSize: 11,
        fill: color,
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        wordWrap: true,
        wordWrapWidth: 255,
        lineHeight: 16,
      }),
    });
    entryContainer.addChild(entryText);
    entryContainer.alpha = 0;
    logContent.addChild(entryContainer);

    // 淡入动画
    gsap.to(entryContainer, { alpha: 1, duration: 0.3, ease: 'power1.out' });

    const entry: CombatLogEntry = { text, color, container: entryContainer };
    this.combatLogEntries.push(entry);

    // 重新排列所有条目位置
    this.relayoutCombatLog(logContent);

    // 超过最大条目数时移除最旧的
    while (this.combatLogEntries.length > COMBAT_LOG_MAX) {
      const oldest = this.combatLogEntries.shift()!;
      logContent.removeChild(oldest.container);
      oldest.container.destroy();
    }
  }

  /**
   * 重新排列战斗日志条目位置（从上到下排列）
   */
  private relayoutCombatLog(logContent: Container): void {
    let yOffset = 0;
    for (const entry of this.combatLogEntries) {
      entry.container.position.set(0, yOffset);
      const textChild = entry.container.getChildAt(0) as Text;
      yOffset += (textChild.height ?? 16) + 4;
    }

    // 如果超出面板高度，整体上移（模拟滚动）
    const maxVisibleHeight = 460;
    if (yOffset > maxVisibleHeight) {
      const offset = yOffset - maxVisibleHeight;
      gsap.to(logContent, { y: 35 - offset, duration: 0.3, ease: 'power2.out' });
    }
  }

  /**
   * 清理战斗日志
   */
  private clearCombatLog(): void {
    this.combatLogEntries = [];
    if (!this.combatLogContainer) return;
    const logContent = this.combatLogContainer.getChildByLabel('log-content');
    if (logContent) {
      logContent.removeChildren();
      logContent.position.set(10, 35);
    }
  }

  /**
   * 格式化伤害飘字为日志文本
   */
  private formatDamageLog(data: DamageNumberData): string {
    const typeLabel: Record<string, string> = {
      normal: '攻击',
      critical: '暴击',
      heal: '治疗',
      miss: '闪避',
    };
    const action = typeLabel[data.type] ?? '攻击';
    if (data.type === 'miss') return `⚔️ ${action}！`;
    if (data.type === 'heal') return `💚 ${action} +${data.value}`;
    return `⚔️ ${action} -${data.value}`;
  }

  /**
   * 格式化技能特效为日志文本
   */
  private formatEffectLog(data: SkillEffectData): string {
    const typeLabel: Record<string, string> = {
      slash: '斩击',
      fire: '火焰',
      ice: '冰霜',
      lightning: '闪电',
      heal: '治疗',
      buff: '增益',
      debuff: '减益',
      freeze: '冰冻',
      flame: '烈焰',
      thunder: '雷电',
    };
    const name = typeLabel[data.type] ?? data.type;
    return `✨ 释放技能：${name}`;
  }

  // ═══════════════════════════════════════════════════════════
  // 镜头系统
  // ═══════════════════════════════════════════════════════════

  /**
   * 技能释放时镜头聚焦到施法者
   *
   * 平移 + 缩放到施法者位置，技能结束后自动回位。
   */
  private triggerCameraFocus(effect: SkillEffectData): void {
    // 聚焦到施法者位置
    const targetX = effect.from.x;
    const targetY = effect.from.y;

    // 取消之前的镜头动画
    gsap.killTweensOf(this.cameraContainer);
    gsap.killTweensOf(this.cameraContainer.scale);

    // 计算偏移：镜头中心从 (960,540) 移向施法者方向
    const offsetX = (960 - targetX) * 0.3;
    const offsetY = (540 - targetY) * 0.3;

    // 聚焦动画
    gsap.to(this.cameraContainer, {
      x: 960 + offsetX,
      y: 540 + offsetY,
      duration: CAMERA_FOCUS_DURATION,
      ease: 'power2.out',
    });
    gsap.to(this.cameraContainer.scale, {
      x: CAMERA_FOCUS_ZOOM,
      y: CAMERA_FOCUS_ZOOM,
      duration: CAMERA_FOCUS_DURATION,
      ease: 'power2.out',
    });

    // 延迟后自动回位
    const resetDelay = CAMERA_FOCUS_DURATION + (effect.duration / 1000);
    gsap.to(this.cameraContainer, {
      x: this.cameraDefault.x,
      y: this.cameraDefault.y,
      duration: CAMERA_RESET_DURATION,
      ease: 'power2.inOut',
      delay: resetDelay,
    });
    gsap.to(this.cameraContainer.scale, {
      x: 1,
      y: 1,
      duration: CAMERA_RESET_DURATION,
      ease: 'power2.inOut',
      delay: resetDelay,
    });
  }

  /**
   * 重置镜头到默认状态
   */
  private resetCamera(): void {
    gsap.killTweensOf(this.cameraContainer);
    gsap.killTweensOf(this.cameraContainer.scale);
    this.cameraContainer.position.set(this.cameraDefault.x, this.cameraDefault.y);
    this.cameraContainer.scale.set(1);
  }

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
