/**
 * 电子宠物 Virtual Pet 游戏引擎
 *
 * 核心玩法：
 * - 照顾虚拟宠物，保持饱食度、清洁度、快乐度、体力
 * - 属性随时间自然衰减
 * - 操作：喂食(1)、洗澡(2)、玩耍(3)、睡觉(4)
 * - 心情系统：根据属性组合决定心情（开心、普通、难过、生病）
 * - 成长阶段：蛋 → 幼年 → 少年 → 成年
 * - 状态异常：饥饿过度或清洁度过低会生病
 * - 动画：宠物不同状态有不同表情/动作
 */
import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  STAT_MIN,
  STAT_MAX,
  DECAY_RATES,
  ACTION_EFFECTS,
  ACTION_COOLDOWNS,
  Mood,
  MOOD_THRESHOLDS,
  SICK_THRESHOLDS,
  GrowthStage,
  GROWTH_THRESHOLDS,
  STAT_PANELS,
  ACTION_BUTTONS,
  COLORS,
  PET_DRAW,
  ANIM,
  type StatKey,
  type ActionKey,
} from './constants';

/** 游戏状态（用于 getState / 序列化） */
export interface VirtualPetState {
  stats: Record<StatKey, number>;
  mood: Mood;
  growthStage: GrowthStage;
  totalOnlineTime: number;
  isSick: boolean;
  selectedPanel: number;
  score: number;
  level: number;
}

/** 操作动画状态 */
interface ActionAnimation {
  type: ActionKey;
  startTime: number;
  duration: number;
}

export class VirtualPetEngine extends GameEngine {
  // ========== 游戏状态 ==========

  /** 属性值 */
  private _stats: Record<StatKey, number> = {
    hunger: 80,
    cleanliness: 80,
    happiness: 80,
    energy: 80,
  };

  /** 心情 */
  private _mood: Mood = Mood.HAPPY;

  /** 是否生病 */
  private _isSick: boolean = false;

  /** 成长阶段 */
  private _growthStage: GrowthStage = GrowthStage.EGG;

  /** 累计在线时间（毫秒） */
  private _totalOnlineTime: number = 0;

  /** 当前选中的属性面板索引 */
  private _selectedPanel: number = 0;

  /** 操作冷却计时器 */
  private _cooldowns: Record<ActionKey, number> = {
    feed: 0,
    bath: 0,
    play: 0,
    sleep: 0,
  };

  /** 当前操作动画 */
  private _actionAnim: ActionAnimation | null = null;

  /** 动画计时器 */
  private _animTime: number = 0;

  /** 分数（基于存活时间和操作次数） */
  private _actionCount: number = 0;

  /** 睡觉状态 */
  private _isSleeping: boolean = false;

  /** 睡觉开始时间 */
  private _sleepStartTime: number = 0;

  /** Zzz 动画粒子 */
  private _zzzParticles: Array<{ x: number; y: number; life: number; maxLife: number }> = [];

  // ========== 公开属性 ==========

  get stats(): Record<StatKey, number> {
    return { ...this._stats };
  }

  get hunger(): number {
    return this._stats.hunger;
  }

  get cleanliness(): number {
    return this._stats.cleanliness;
  }

  get happiness(): number {
    return this._stats.happiness;
  }

  get energy(): number {
    return this._stats.energy;
  }

  get mood(): Mood {
    return this._mood;
  }

  get isSick(): boolean {
    return this._isSick;
  }

  get growthStage(): GrowthStage {
    return this._growthStage;
  }

  get totalOnlineTime(): number {
    return this._totalOnlineTime;
  }

  get selectedPanel(): number {
    return this._selectedPanel;
  }

  get isSleeping(): boolean {
    return this._isSleeping;
  }

  // ========== 生命周期 ==========

  protected onInit(): void {
    this._stats = { hunger: 80, cleanliness: 80, happiness: 80, energy: 80 };
    this._mood = Mood.HAPPY;
    this._isSick = false;
    this._growthStage = GrowthStage.EGG;
    this._totalOnlineTime = 0;
    this._selectedPanel = 0;
    this._cooldowns = { feed: 0, bath: 0, play: 0, sleep: 0 };
    this._actionAnim = null;
    this._animTime = 0;
    this._actionCount = 0;
    this._isSleeping = false;
    this._sleepStartTime = 0;
    this._zzzParticles = [];
  }

  protected onStart(): void {
    this.onInit();
  }

  protected onReset(): void {
    this.onInit();
  }

  protected onPause(): void {
    // 暂停时停止睡觉状态
    this._isSleeping = false;
  }

  protected onResume(): void {
    // 恢复时重置冷却计时
  }

  // ========== 核心逻辑 ==========

  /**
   * 限制属性值在合法范围内
   */
  private clampStat(value: number): number {
    return Math.max(STAT_MIN, Math.min(STAT_MAX, value));
  }

  /**
   * 执行操作
   * @param action 操作类型
   * @returns 是否执行成功
   */
  performAction(action: ActionKey): boolean {
    if (this._status !== 'playing') return false;
    if (this._isSleeping && action !== 'sleep') return false;

    // 检查冷却
    if (this._cooldowns[action] > 0) return false;

    // 生病时只能睡觉或喂食
    if (this._isSick && action !== 'sleep' && action !== 'feed') return false;

    const effects = ACTION_EFFECTS[action];

    // 玩耍需要体力
    if (action === 'play' && this._stats.energy < 10) return false;

    // 应用效果
    for (const [key, value] of Object.entries(effects)) {
      const statKey = key as StatKey;
      this._stats[statKey] = this.clampStat(this._stats[statKey] + value);
    }

    // 设置冷却
    this._cooldowns[action] = ACTION_COOLDOWNS[action];

    // 触发操作动画
    this._actionAnim = {
      type: action,
      startTime: Date.now(),
      duration: ANIM.actionAnimDuration,
    };

    // 睡觉特殊处理
    if (action === 'sleep') {
      if (this._isSleeping) {
        // 再次按睡觉 → 醒来
        this._isSleeping = false;
      } else {
        this._isSleeping = true;
        this._sleepStartTime = Date.now();
      }
    }

    this._actionCount++;
    this.addScore(10);

    // 更新心情
    this.updateMood();

    this.emit('stateChange');
    return true;
  }

  /**
   * 喂食
   */
  feed(): boolean {
    return this.performAction('feed');
  }

  /**
   * 洗澡
   */
  bath(): boolean {
    return this.performAction('bath');
  }

  /**
   * 玩耍
   */
  play(): boolean {
    return this.performAction('play');
  }

  /**
   * 睡觉
   */
  sleep(): boolean {
    return this.performAction('sleep');
  }

  /**
   * 更新心情
   */
  updateMood(): void {
    // 先检查是否生病
    this.checkSick();

    if (this._isSick) {
      this._mood = Mood.SICK;
      return;
    }

    // 计算平均属性
    const avg = this.getAverageStats();

    if (avg >= MOOD_THRESHOLDS.happy) {
      this._mood = Mood.HAPPY;
    } else if (avg >= MOOD_THRESHOLDS.normal) {
      this._mood = Mood.NORMAL;
    } else if (avg >= MOOD_THRESHOLDS.sad) {
      this._mood = Mood.SAD;
    } else {
      this._mood = Mood.SICK;
    }
  }

  /**
   * 检查是否生病
   */
  checkSick(): void {
    this._isSick =
      this._stats.hunger < SICK_THRESHOLDS.hunger ||
      this._stats.cleanliness < SICK_THRESHOLDS.cleanliness;
  }

  /**
   * 计算平均属性值
   */
  getAverageStats(): number {
    const values = Object.values(this._stats);
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  /**
   * 更新成长阶段
   */
  updateGrowthStage(): void {
    // 从高到低检查
    for (const [stage, threshold] of GROWTH_THRESHOLDS) {
      if (this._totalOnlineTime >= threshold) {
        this._growthStage = stage;
        return;
      }
    }
    this._growthStage = GrowthStage.EGG;
  }

  /**
   * 获取操作剩余冷却时间
   */
  getCooldown(action: ActionKey): number {
    return Math.max(0, this._cooldowns[action]);
  }

  /**
   * 获取当前操作动画
   */
  getActionAnimation(): ActionAnimation | null {
    return this._actionAnim;
  }

  /**
   * 获取操作次数
   */
  getActionCount(): number {
    return this._actionCount;
  }

  // ========== 游戏循环 ==========

  update(deltaTime: number): void {
    if (this._status !== 'playing') return;

    // 累计在线时间
    this._totalOnlineTime += deltaTime;

    // 更新成长阶段
    this.updateGrowthStage();

    // 属性自然衰减（睡觉时不衰减体力，反而恢复）
    for (const [key, rate] of Object.entries(DECAY_RATES)) {
      const statKey = key as StatKey;
      let decay = rate * (deltaTime / 1000);

      // 睡觉时体力恢复而非衰减
      if (this._isSleeping && statKey === 'energy') {
        decay = -rate * 2 * (deltaTime / 1000); // 双倍恢复
      }

      // 生病时衰减加速
      if (this._isSick) {
        decay *= 1.5;
      }

      this._stats[statKey] = this.clampStat(this._stats[statKey] - decay);
    }

    // 更新冷却
    for (const key of Object.keys(this._cooldowns) as ActionKey[]) {
      if (this._cooldowns[key] > 0) {
        this._cooldowns[key] = Math.max(0, this._cooldowns[key] - deltaTime);
      }
    }

    // 更新心情
    this.updateMood();

    // 更新动画计时器
    this._animTime += deltaTime;

    // 更新操作动画
    if (this._actionAnim) {
      const elapsed = Date.now() - this._actionAnim.startTime;
      if (elapsed >= this._actionAnim.duration) {
        this._actionAnim = null;
      }
    }

    // 睡觉 Zzz 粒子
    if (this._isSleeping) {
      if (Math.random() < deltaTime / 800) {
        this._zzzParticles.push({
          x: PET_DRAW.centerX + 40 + Math.random() * 20,
          y: PET_DRAW.centerY - 30,
          life: 1500,
          maxLife: 1500,
        });
      }
    }
    this._zzzParticles = this._zzzParticles.filter((p) => {
      p.life -= deltaTime;
      p.y -= deltaTime * 0.03;
      return p.life > 0;
    });

    // 更新等级（基于成长阶段）
    const stageLevels: Record<GrowthStage, number> = {
      [GrowthStage.EGG]: 1,
      [GrowthStage.BABY]: 2,
      [GrowthStage.CHILD]: 3,
      [GrowthStage.ADULT]: 4,
    };
    this.setLevel(stageLevels[this._growthStage]);

    this.emit('stateChange');
  }

  // ========== 渲染 ==========

  onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.drawBackground(ctx, w, h);
    this.drawPet(ctx);
    this.drawStatsPanel(ctx, w);
    this.drawActionBar(ctx, w, h);
    this.drawInfoBar(ctx, w);
  }

  private drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, COLORS.bgGradient1);
    gradient.addColorStop(1, COLORS.bgGradient2);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    // 装饰性星星
    ctx.globalAlpha = 0.05;
    for (let i = 0; i < 20; i++) {
      const x = ((i * 73 + 17) % w);
      const y = ((i * 97 + 43) % h);
      ctx.beginPath();
      ctx.arc(x, y, 1 + (i % 3), 0, Math.PI * 2);
      ctx.fillStyle = COLORS.accent;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawPet(ctx: CanvasRenderingContext2D): void {
    const cx = PET_DRAW.centerX;
    const cy = PET_DRAW.centerY;

    // 呼吸动画
    const breathe = Math.sin(this._animTime * ANIM.breatheSpeed) * ANIM.breatheAmount;

    // 生病颤抖
    let shakeX = 0;
    if (this._isSick) {
      shakeX = Math.sin(this._animTime * ANIM.sickShakeSpeed) * ANIM.sickShakeAmount;
    }

    // 弹跳（开心时）
    let bounceY = 0;
    if (this._mood === Mood.HAPPY && !this._isSleeping) {
      bounceY = Math.abs(Math.sin(this._animTime * ANIM.bounceSpeed)) * ANIM.bounceAmount;
    }

    // 睡觉摇摆
    if (this._isSleeping) {
      // 略微倾斜
    }

    // 根据成长阶段调整大小
    const stageScale = this.getStageScale();
    const bodyR = PET_DRAW.bodyRadius * stageScale;

    ctx.save();
    ctx.translate(cx + shakeX, cy - bounceY + breathe);

    // 阴影
    ctx.beginPath();
    ctx.ellipse(0, bodyR + 10, bodyR * 0.8, 8, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fill();

    // 身体
    const bodyGrad = ctx.createRadialGradient(-bodyR * 0.3, -bodyR * 0.3, bodyR * 0.1, 0, 0, bodyR);
    bodyGrad.addColorStop(0, COLORS.petBodyLight);
    bodyGrad.addColorStop(0.7, COLORS.petBody);
    bodyGrad.addColorStop(1, COLORS.petBodyDark);
    ctx.beginPath();
    ctx.arc(0, 0, bodyR, 0, Math.PI * 2);
    ctx.fillStyle = bodyGrad;
    ctx.fill();
    ctx.strokeStyle = COLORS.petBodyDark;
    ctx.lineWidth = 2;
    ctx.stroke();

    // 眼睛
    this.drawEyes(ctx, bodyR);

    // 脸颊
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.arc(-PET_DRAW.cheekOffsetX * stageScale, PET_DRAW.cheekOffsetY * stageScale, PET_DRAW.cheekRadius * stageScale, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.petCheek;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(PET_DRAW.cheekOffsetX * stageScale, PET_DRAW.cheekOffsetY * stageScale, PET_DRAW.cheekRadius * stageScale, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.petCheek;
    ctx.fill();
    ctx.globalAlpha = 1;

    // 嘴巴
    this.drawMouth(ctx, bodyR);

    // 操作动画效果
    this.drawActionEffect(ctx, bodyR);

    ctx.restore();

    // Zzz 粒子
    this.drawZzzParticles(ctx);
  }

  private drawEyes(ctx: CanvasRenderingContext2D, bodyR: number): void {
    const scale = bodyR / PET_DRAW.bodyRadius;
    const offsetX = PET_DRAW.eyeOffsetX * scale;
    const offsetY = PET_DRAW.eyeOffsetY * scale;
    const eyeR = PET_DRAW.eyeRadius * scale;
    const pupilR = PET_DRAW.pupilRadius * scale;

    if (this._isSleeping) {
      // 睡觉时闭眼 — 画两条弧线
      ctx.strokeStyle = COLORS.petPupil;
      ctx.lineWidth = 2;
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(dir * offsetX, offsetY, eyeR * 0.6, 0, Math.PI);
        ctx.stroke();
      }
      return;
    }

    for (const dir of [-1, 1]) {
      // 眼白
      ctx.beginPath();
      ctx.arc(dir * offsetX, offsetY, eyeR, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.petEye;
      ctx.fill();

      // 瞳孔
      ctx.beginPath();
      ctx.arc(dir * offsetX, offsetY + 1, pupilR, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.petPupil;
      ctx.fill();

      // 生病时画旋涡眼
      if (this._isSick) {
        ctx.beginPath();
        ctx.arc(dir * offsetX, offsetY, pupilR * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ff4757';
        ctx.fill();
      }

      // 难过时画水汪汪的大眼
      if (this._mood === Mood.SAD && !this._isSick) {
        ctx.beginPath();
        ctx.arc(dir * offsetX, offsetY + 2, eyeR * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(100, 181, 246, 0.5)';
        ctx.fill();
      }
    }
  }

  private drawMouth(ctx: CanvasRenderingContext2D, bodyR: number): void {
    const scale = bodyR / PET_DRAW.bodyRadius;
    const mouthY = PET_DRAW.mouthY * scale;

    ctx.strokeStyle = COLORS.petMouth;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    if (this._isSick) {
      // 生病：波浪嘴
      ctx.beginPath();
      ctx.moveTo(-12 * scale, mouthY);
      ctx.bezierCurveTo(-6 * scale, mouthY + 4 * scale, 0, mouthY - 4 * scale, 6 * scale, mouthY + 2 * scale);
      ctx.bezierCurveTo(10 * scale, mouthY + 5 * scale, 14 * scale, mouthY - 2 * scale, 16 * scale, mouthY);
      ctx.stroke();
    } else if (this._mood === Mood.HAPPY) {
      // 开心：大笑
      ctx.beginPath();
      ctx.arc(0, mouthY - 4 * scale, 10 * scale, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();
    } else if (this._mood === Mood.NORMAL) {
      // 普通：微笑
      ctx.beginPath();
      ctx.arc(0, mouthY - 2 * scale, 6 * scale, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();
    } else if (this._mood === Mood.SAD) {
      // 难过：倒弧
      ctx.beginPath();
      ctx.arc(0, mouthY + 6 * scale, 8 * scale, 1.2 * Math.PI, 1.8 * Math.PI);
      ctx.stroke();
    }
  }

  private drawActionEffect(ctx: CanvasRenderingContext2D, bodyR: number): void {
    if (!this._actionAnim) return;

    const elapsed = Date.now() - this._actionAnim.startTime;
    const progress = Math.min(1, elapsed / this._actionAnim.duration);
    const alpha = 1 - progress;

    ctx.globalAlpha = alpha;

    switch (this._actionAnim.type) {
      case 'feed':
        // 食物图标上浮
        ctx.font = '24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🍖', 0, -bodyR - 20 - progress * 30);
        break;
      case 'bath':
        // 水泡
        for (let i = 0; i < 5; i++) {
          const angle = (i / 5) * Math.PI * 2;
          const dist = bodyR + 10 + progress * 20;
          ctx.beginPath();
          ctx.arc(Math.cos(angle) * dist, Math.sin(angle) * dist, 4, 0, Math.PI * 2);
          ctx.fillStyle = '#4ecdc4';
          ctx.fill();
        }
        break;
      case 'play':
        // 星星
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('✨', -bodyR - 10, -bodyR + progress * 20);
        ctx.fillText('✨', bodyR + 10, -bodyR + progress * 20);
        break;
      case 'sleep':
        // Zzz
        ctx.font = `${16 + progress * 8}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = COLORS.accent;
        ctx.fillText('Z', bodyR * 0.5 + progress * 20, -bodyR - progress * 30);
        break;
    }

    ctx.globalAlpha = 1;
  }

  private drawZzzParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this._zzzParticles) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha * 0.7;
      ctx.font = '14px sans-serif';
      ctx.fillStyle = COLORS.accent;
      ctx.textAlign = 'center';
      ctx.fillText('z', p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }

  private getStageScale(): number {
    switch (this._growthStage) {
      case GrowthStage.EGG: return 0.5;
      case GrowthStage.BABY: return 0.7;
      case GrowthStage.CHILD: return 0.85;
      case GrowthStage.ADULT: return 1.0;
    }
  }

  private drawStatsPanel(ctx: CanvasRenderingContext2D, w: number): void {
    const panelY = 400;
    const panelH = 130;
    const panelX = 16;
    const panelW = w - 32;

    // 面板背景
    ctx.fillStyle = COLORS.panelBg;
    ctx.strokeStyle = COLORS.panelBorder;
    ctx.lineWidth = 1;
    this.roundRect(ctx, panelX, panelY, panelW, panelH, 12);
    ctx.fill();
    ctx.stroke();

    // 标题
    ctx.font = 'bold 13px "Segoe UI", sans-serif';
    ctx.fillStyle = COLORS.textSecondary;
    ctx.textAlign = 'center';
    ctx.fillText('— 属性面板 —', w / 2, panelY + 20);

    // 属性条
    const barStartY = panelY + 32;
    const barH = 18;
    const barPadding = 5;
    const barX = panelX + 50;
    const barW = panelW - 100;

    for (let i = 0; i < STAT_PANELS.length; i++) {
      const panel = STAT_PANELS[i];
      const y = barStartY + i * (barH + barPadding);
      const value = this._stats[panel.key];
      const isSelected = i === this._selectedPanel;

      // 选中高亮
      if (isSelected) {
        ctx.fillStyle = COLORS.selectedBg;
        ctx.strokeStyle = COLORS.selectedBorder;
        ctx.lineWidth = 1;
        this.roundRect(ctx, panelX + 4, y - 2, panelW - 8, barH + 4, 6);
        ctx.fill();
        ctx.stroke();
      }

      // 图标
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(panel.icon, panelX + 12, y + barH - 4);

      // 标签
      ctx.font = '11px "Segoe UI", sans-serif';
      ctx.fillStyle = COLORS.textSecondary;
      ctx.fillText(panel.label, panelX + 32, y + barH - 4);

      // 进度条背景
      ctx.fillStyle = COLORS.barBg;
      this.roundRect(ctx, barX, y + 2, barW, barH - 4, 4);
      ctx.fill();

      // 进度条填充
      const fillW = (value / STAT_MAX) * barW;
      if (fillW > 0) {
        const barGrad = ctx.createLinearGradient(barX, 0, barX + fillW, 0);
        barGrad.addColorStop(0, panel.color);
        barGrad.addColorStop(1, panel.color + 'aa');
        ctx.fillStyle = barGrad;
        this.roundRect(ctx, barX, y + 2, fillW, barH - 4, 4);
        ctx.fill();
      }

      // 数值
      ctx.font = 'bold 11px "Segoe UI", monospace';
      ctx.fillStyle = COLORS.textPrimary;
      ctx.textAlign = 'right';
      ctx.fillText(Math.round(value).toString(), panelX + panelW - 12, y + barH - 4);
    }
  }

  private drawActionBar(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const actionY = 545;
    const btnW = (w - 32 - 15) / 4; // 4 buttons with gaps
    const btnH = 50;
    const startX = 16;

    for (let i = 0; i < ACTION_BUTTONS.length; i++) {
      const btn = ACTION_BUTTONS[i];
      const x = startX + i * (btnW + 5);
      const isOnCooldown = this._cooldowns[btn.key] > 0;
      const isDisabled = this._isSleeping && btn.key !== 'sleep';
      const isActionDisabled = this._isSick && btn.key !== 'sleep' && btn.key !== 'feed';

      // 按钮背景
      ctx.fillStyle = (isOnCooldown || isDisabled || isActionDisabled)
        ? 'rgba(60, 40, 80, 0.5)'
        : 'rgba(80, 50, 120, 0.8)';
      ctx.strokeStyle = (isOnCooldown || isDisabled || isActionDisabled)
        ? 'rgba(255, 255, 255, 0.1)'
        : 'rgba(0, 229, 255, 0.4)';
      ctx.lineWidth = 1;
      this.roundRect(ctx, x, actionY, btnW, btnH, 8);
      ctx.fill();
      ctx.stroke();

      // 图标
      ctx.font = '20px sans-serif';
      ctx.textAlign = 'center';
      ctx.globalAlpha = (isOnCooldown || isDisabled || isActionDisabled) ? 0.4 : 1;
      ctx.fillText(btn.icon, x + btnW / 2, actionY + 25);

      // 标签
      ctx.font = '10px "Segoe UI", sans-serif';
      ctx.fillStyle = COLORS.textSecondary;
      ctx.fillText(btn.label, x + btnW / 2, actionY + 42);

      // 快捷键
      ctx.font = '9px "Segoe UI", sans-serif';
      ctx.fillStyle = COLORS.textDim;
      ctx.fillText(`[${btn.hotkey}]`, x + btnW / 2, actionY + 18);

      ctx.globalAlpha = 1;
    }
  }

  private drawInfoBar(ctx: CanvasRenderingContext2D, w: number): void {
    const y = 610;

    // 心情
    const moodLabels: Record<Mood, string> = {
      [Mood.HAPPY]: '😊 开心',
      [Mood.NORMAL]: '😐 普通',
      [Mood.SAD]: '😢 难过',
      [Mood.SICK]: '🤒 生病',
    };
    const moodColors: Record<Mood, string> = {
      [Mood.HAPPY]: COLORS.moodHappy,
      [Mood.NORMAL]: COLORS.moodNormal,
      [Mood.SAD]: COLORS.moodSad,
      [Mood.SICK]: COLORS.moodSick,
    };

    ctx.font = 'bold 12px "Segoe UI", sans-serif';
    ctx.fillStyle = moodColors[this._mood];
    ctx.textAlign = 'left';
    ctx.fillText(`心情: ${moodLabels[this._mood]}`, 20, y);

    // 成长阶段
    const stageLabels: Record<GrowthStage, string> = {
      [GrowthStage.EGG]: '🥚 蛋',
      [GrowthStage.BABY]: '🐣 幼年',
      [GrowthStage.CHILD]: '🐥 少年',
      [GrowthStage.ADULT]: '🐔 成年',
    };
    ctx.font = '12px "Segoe UI", sans-serif';
    ctx.fillStyle = COLORS.accentGold;
    ctx.textAlign = 'center';
    ctx.fillText(stageLabels[this._growthStage], w / 2, y);

    // 时间
    const seconds = Math.floor(this._totalOnlineTime / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    ctx.font = '11px "Segoe UI", sans-serif';
    ctx.fillStyle = COLORS.textDim;
    ctx.textAlign = 'right';
    ctx.fillText(`${mins}:${secs.toString().padStart(2, '0')}`, w - 20, y);

    // 睡觉提示
    if (this._isSleeping) {
      ctx.font = 'bold 12px "Segoe UI", sans-serif';
      ctx.fillStyle = COLORS.accent;
      ctx.textAlign = 'center';
      ctx.fillText('💤 睡觉中... 按 [4] 唤醒', w / 2, y + 20);
    }
  }

  /** 圆角矩形辅助 */
  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number, r: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  // ========== 输入处理 ==========

  handleKeyDown(key: string): void {
    if (this._status !== 'playing') return;

    switch (key) {
      case '1':
        this.performAction('feed');
        break;
      case '2':
        this.performAction('bath');
        break;
      case '3':
        this.performAction('play');
        break;
      case '4':
        this.performAction('sleep');
        break;
      case 'ArrowLeft':
        this._selectedPanel = Math.max(0, this._selectedPanel - 1);
        this.emit('stateChange');
        break;
      case 'ArrowRight':
        this._selectedPanel = Math.min(STAT_PANELS.length - 1, this._selectedPanel + 1);
        this.emit('stateChange');
        break;
      case 'ArrowUp':
        this._selectedPanel = Math.max(0, this._selectedPanel - 1);
        this.emit('stateChange');
        break;
      case 'ArrowDown':
        this._selectedPanel = Math.min(STAT_PANELS.length - 1, this._selectedPanel + 1);
        this.emit('stateChange');
        break;
    }
  }

  handleKeyUp(_key: string): void {
    // Virtual Pet 无需处理 keyUp
  }

  // ========== 状态序列化 ==========

  getState(): VirtualPetState {
    return {
      stats: { ...this._stats },
      mood: this._mood,
      growthStage: this._growthStage,
      totalOnlineTime: this._totalOnlineTime,
      isSick: this._isSick,
      selectedPanel: this._selectedPanel,
      score: this._score,
      level: this._level,
    };
  }

  /**
   * 从状态恢复
   */
  loadState(state: Partial<VirtualPetState>): void {
    if (state.stats) {
      for (const [key, value] of Object.entries(state.stats)) {
        const statKey = key as StatKey;
        if (statKey in this._stats) {
          this._stats[statKey] = this.clampStat(value);
        }
      }
    }
    if (state.mood) this._mood = state.mood;
    if (state.growthStage) this._growthStage = state.growthStage;
    if (state.totalOnlineTime !== undefined) this._totalOnlineTime = state.totalOnlineTime;
    if (state.isSick !== undefined) this._isSick = state.isSick;
    if (state.selectedPanel !== undefined) this._selectedPanel = state.selectedPanel;
    this.emit('stateChange');
  }
}
