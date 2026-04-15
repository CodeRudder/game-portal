/**
 * renderer/scenes/HeroDetailScene.ts — 武将详情场景
 *
 * 展示单个武将的完整信息，包含：
 * - 左侧：武将头像（圆形 + 稀有度边框 + 名字）
 * - 右侧：属性面板（攻击/防御/智力/统帅/忠诚度 进度条）
 * - 底部：技能列表（2-3 个技能卡片）
 * - 背景色根据势力变化（魏蓝/蜀绿/吴红）
 *
 * @module renderer/scenes/HeroDetailScene
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
const BAR_BG_COLOR = 0x333344;
const BAR_WIDTH = 180;
const BAR_HEIGHT = 16;
const BAR_RADIUS = 4;
const AVATAR_RADIUS = 60;
const TITLE_FONT_SIZE = 24;
const LABEL_FONT_SIZE = 14;
const SKILL_CARD_WIDTH = 200;
const SKILL_CARD_HEIGHT = 80;
const SKILL_CARD_RADIUS = 8;

/** 势力背景色 */
const FACTION_BG: Record<string, number> = {
  wei: 0x1a2a4e,
  shu: 0x1a3e2a,
  wu: 0x3e1a1a,
  neutral: 0x2a2a2a,
};

/** 稀有度边框色 */
const RARITY_COLORS: Record<string, number> = {
  common: 0x95a5a6,
  uncommon: 0x2ecc71,
  rare: 0x3498db,
  epic: 0x9b59b6,
  legendary: 0xf39c12,
};

/** 稀有度中文 */
const RARITY_LABELS: Record<string, string> = {
  common: '普通',
  uncommon: '精良',
  rare: '稀有',
  epic: '史诗',
  legendary: '传说',
};

/** 属性条颜色 */
const STAT_COLORS: Record<string, number> = {
  attack: 0xe74c3c,
  defense: 0x3498db,
  intelligence: 0x9b59b6,
  leadership: 0xf39c12,
  loyalty: 0x2ecc71,
};

/** 属性中文 */
const STAT_LABELS: Record<string, string> = {
  attack: '攻击',
  defense: '防御',
  intelligence: '智力',
  leadership: '统帅',
  loyalty: '忠诚',
};

// ═══════════════════════════════════════════════════════════════
// 接口
// ═══════════════════════════════════════════════════════════════

export interface HeroDetail {
  id: string;
  name: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  faction: 'wei' | 'shu' | 'wu' | 'neutral';
  level: number;
  exp: number;
  maxExp: number;
  stats: { attack: number; defense: number; intelligence: number; leadership: number; loyalty: number };
  skills: { id: string; name: string; description: string; cooldown: number }[];
}

// ═══════════════════════════════════════════════════════════════
// HeroDetailScene
// ═══════════════════════════════════════════════════════════════

export class HeroDetailScene extends BaseScene {
  readonly type: SceneType = 'hero-detail';

  // ─── 子容器 ───────────────────────────────────────────────

  private bgLayer: Container;
  private avatarLayer: Container;
  private statsLayer: Container;
  private skillsLayer: Container;

  // ─── 数据 ─────────────────────────────────────────────────

  private hero: HeroDetail | null = null;
  private skillContainers: Container[] = [];

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

    this.bgLayer = new Container({ label: 'hero-bg' });
    this.avatarLayer = new Container({ label: 'hero-avatar' });
    this.statsLayer = new Container({ label: 'hero-stats' });
    this.skillsLayer = new Container({ label: 'hero-skills' });

    this.container.addChild(
      this.bgLayer,
      this.avatarLayer,
      this.statsLayer,
      this.skillsLayer,
    );
  }

  // ═══════════════════════════════════════════════════════════
  // 生命周期
  // ═══════════════════════════════════════════════════════════

  protected async onCreate(): Promise<void> {
    this.container.eventMode = 'static';
  }

  protected async onEnter(): Promise<void> {
    this.renderAll();
  }

  protected async onExit(): Promise<void> {
    // 清理
  }

  protected onUpdate(_deltaTime: number): void {
    // 预留：可添加经验条动画
  }

  protected onSetData(data: unknown): void {
    const state = data as { hero?: HeroDetail };
    if (state.hero) {
      this.hero = state.hero;
      this.renderAll();
    }
  }

  protected onDestroy(): void {
    this.hero = null;
    this.skillContainers = [];
  }

  // ═══════════════════════════════════════════════════════════
  // 公共方法
  // ═══════════════════════════════════════════════════════════

  /** 设置武将数据 */
  setHeroData(hero: HeroDetail): void {
    this.hero = hero;
    this.renderAll();
  }

  /** 处理点击，返回点击的技能 ID 或 null */
  handleClick(x: number, y: number): string | null {
    for (const sc of this.skillContainers) {
      const bounds = sc.getBounds();
      if (bounds.containsPoint(x, y)) {
        const skillId = sc.label.replace('skill-', '');
        this.bridgeEvent('heroClick', skillId);
        return skillId;
      }
    }
    return null;
  }

  /** 调整尺寸 */
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.renderAll();
  }

  // ═══════════════════════════════════════════════════════════
  // 渲染
  // ═══════════════════════════════════════════════════════════

  /** 全量渲染 */
  private renderAll(): void {
    this.renderBackground();
    this.renderAvatar();
    this.renderStats();
    this.renderSkills();
  }

  /** 绘制背景（根据势力变色） */
  private renderBackground(): void {
    this.bgLayer.removeChildren();
    const faction = this.hero?.faction ?? 'neutral';
    const bgColor = FACTION_BG[faction] ?? BG_COLOR;

    const bg = new Graphics();
    bg.rect(0, 0, this.width, this.height).fill({ color: bgColor });
    this.bgLayer.addChild(bg);
  }

  /** 绘制左侧头像区域 */
  private renderAvatar(): void {
    this.avatarLayer.removeChildren();
    if (!this.hero) return;

    const hero = this.hero;
    const cx = 160;
    const cy = 180;

    // 稀有度边框圆环
    const rarityColor = RARITY_COLORS[hero.rarity] ?? RARITY_COLORS.common;
    const borderRing = new Graphics();
    borderRing.circle(cx, cy, AVATAR_RADIUS + 6).fill({ color: rarityColor });
    this.avatarLayer.addChild(borderRing);

    // 头像圆形背景
    const avatarBg = new Graphics();
    avatarBg.circle(cx, cy, AVATAR_RADIUS).fill({ color: 0x2c3e50 });
    this.avatarLayer.addChild(avatarBg);

    // 头像文字（名字首字）
    const avatarChar = new Text({
      text: hero.name.charAt(0),
      style: new TextStyle({
        fontSize: 40,
        fill: TEXT_COLOR,
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontWeight: 'bold',
      }),
    });
    avatarChar.anchor.set(0.5, 0.5);
    avatarChar.position.set(cx, cy);
    this.avatarLayer.addChild(avatarChar);

    // 名字
    const nameText = new Text({
      text: hero.name,
      style: new TextStyle({
        fontSize: 20,
        fill: TEXT_COLOR,
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontWeight: 'bold',
      }),
    });
    nameText.anchor.set(0.5, 0);
    nameText.position.set(cx, cy + AVATAR_RADIUS + 16);
    this.avatarLayer.addChild(nameText);

    // 等级 & 稀有度
    const infoText = new Text({
      text: `Lv.${hero.level} · ${RARITY_LABELS[hero.rarity] ?? hero.rarity}`,
      style: new TextStyle({
        fontSize: LABEL_FONT_SIZE,
        fill: 0xbdc3c7,
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
      }),
    });
    infoText.anchor.set(0.5, 0);
    infoText.position.set(cx, cy + AVATAR_RADIUS + 44);
    this.avatarLayer.addChild(infoText);

    // 经验条
    const expBarY = cy + AVATAR_RADIUS + 70;
    const expBarWidth = 140;
    const expRatio = hero.maxExp > 0 ? hero.exp / hero.maxExp : 0;

    const expBg = new Graphics();
    expBg.roundRect(cx - expBarWidth / 2, expBarY, expBarWidth, 10, 5)
      .fill({ color: BAR_BG_COLOR });
    this.avatarLayer.addChild(expBg);

    if (expRatio > 0) {
      const expFill = new Graphics();
      expFill.roundRect(cx - expBarWidth / 2, expBarY, expBarWidth * expRatio, 10, 5)
        .fill({ color: 0x3498db });
      this.avatarLayer.addChild(expFill);
    }

    const expLabel = new Text({
      text: `EXP ${hero.exp}/${hero.maxExp}`,
      style: new TextStyle({ fontSize: 11, fill: 0xbdc3c7, fontFamily: 'Arial, "Microsoft YaHei", sans-serif' }),
    });
    expLabel.anchor.set(0.5, 0);
    expLabel.position.set(cx, expBarY + 14);
    this.avatarLayer.addChild(expLabel);
  }

  /** 绘制右侧属性面板 */
  private renderStats(): void {
    this.statsLayer.removeChildren();
    if (!this.hero) return;

    const stats = this.hero.stats;
    const statKeys = ['attack', 'defense', 'intelligence', 'leadership', 'loyalty'] as const;
    const startX = 340;
    const startY = 100;
    const spacing = 50;
    const maxStat = 100; // 满值

    // 面板标题
    const title = new Text({
      text: '属性',
      style: new TextStyle({
        fontSize: 18,
        fill: ACCENT_COLOR,
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontWeight: 'bold',
      }),
    });
    title.position.set(startX, startY - 36);
    this.statsLayer.addChild(title);

    for (let i = 0; i < statKeys.length; i++) {
      const key = statKeys[i];
      const value = stats[key] ?? 0;
      const y = startY + i * spacing;
      const ratio = Math.min(value / maxStat, 1);

      // 属性名
      const label = new Text({
        text: STAT_LABELS[key] ?? key,
        style: new TextStyle({
          fontSize: LABEL_FONT_SIZE,
          fill: TEXT_COLOR,
          fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        }),
      });
      label.position.set(startX, y);
      this.statsLayer.addChild(label);

      // 进度条背景
      const barX = startX + 60;
      const barBg = new Graphics();
      barBg.roundRect(barX, y + 2, BAR_WIDTH, BAR_HEIGHT, BAR_RADIUS)
        .fill({ color: BAR_BG_COLOR });
      this.statsLayer.addChild(barBg);

      // 进度条填充
      if (ratio > 0) {
        const barFill = new Graphics();
        barFill.roundRect(barX, y + 2, BAR_WIDTH * ratio, BAR_HEIGHT, BAR_RADIUS)
          .fill({ color: STAT_COLORS[key] ?? ACCENT_COLOR });
        this.statsLayer.addChild(barFill);
      }

      // 数值
      const valueText = new Text({
        text: `${value}`,
        style: new TextStyle({
          fontSize: LABEL_FONT_SIZE,
          fill: TEXT_COLOR,
          fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
          fontWeight: 'bold',
        }),
      });
      valueText.position.set(barX + BAR_WIDTH + 10, y);
      this.statsLayer.addChild(valueText);
    }
  }

  /** 绘制底部技能列表 */
  private renderSkills(): void {
    this.skillsLayer.removeChildren();
    this.skillContainers = [];
    if (!this.hero) return;

    const skills = this.hero.skills;
    if (skills.length === 0) return;

    // 技能区域标题
    const title = new Text({
      text: '技能',
      style: new TextStyle({
        fontSize: 18,
        fill: ACCENT_COLOR,
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontWeight: 'bold',
      }),
    });
    title.position.set(40, this.height - 160);
    this.skillsLayer.addChild(title);

    // 技能卡片
    const cardStartX = 40;
    const cardY = this.height - 130;
    const cardSpacing = SKILL_CARD_WIDTH + 20;

    for (let i = 0; i < skills.length; i++) {
      const skill = skills[i];
      const cardX = cardStartX + i * cardSpacing;

      const card = new Container({ label: `skill-${skill.id}` });
      card.position.set(cardX, cardY);
      card.eventMode = 'static';
      card.cursor = 'pointer';

      // 卡片背景
      const cardBg = new Graphics();
      cardBg.roundRect(0, 0, SKILL_CARD_WIDTH, SKILL_CARD_HEIGHT, SKILL_CARD_RADIUS)
        .fill({ color: 0x2c3e50, alpha: 0.9 });
      cardBg.roundRect(0, 0, SKILL_CARD_WIDTH, SKILL_CARD_HEIGHT, SKILL_CARD_RADIUS)
        .stroke({ color: ACCENT_COLOR, width: 1, alpha: 0.5 });
      card.addChild(cardBg);

      // 技能名
      const skillName = new Text({
        text: skill.name,
        style: new TextStyle({
          fontSize: 15,
          fill: TEXT_COLOR,
          fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
          fontWeight: 'bold',
        }),
      });
      skillName.position.set(12, 10);
      card.addChild(skillName);

      // 技能描述
      const skillDesc = new Text({
        text: skill.description,
        style: new TextStyle({
          fontSize: 12,
          fill: 0xbdc3c7,
          fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
          wordWrap: true,
          wordWrapWidth: SKILL_CARD_WIDTH - 24,
        }),
      });
      skillDesc.position.set(12, 32);
      card.addChild(skillDesc);

      // 冷却时间
      const cooldownText = new Text({
        text: `CD: ${skill.cooldown}回合`,
        style: new TextStyle({
          fontSize: 11,
          fill: 0xf39c12,
          fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        }),
      });
      cooldownText.position.set(12, SKILL_CARD_HEIGHT - 22);
      card.addChild(cooldownText);

      // 点击事件
      card.on('pointerdown', () => {
        this.bridgeEvent('heroClick', skill.id);
      });

      this.skillsLayer.addChild(card);
      this.skillContainers.push(card);
    }
  }
}
