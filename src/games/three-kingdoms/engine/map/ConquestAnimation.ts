/**
 * 攻城动画系统 (MAP-F04)
 *
 * 管理领土攻占的视觉动画效果:
 * - 领土颜色渐变过渡
 * - 旗帜更换动画
 * - 战斗结果文字弹出
 *
 * @module engine/map/ConquestAnimation
 */

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 攻城动画状态 */
export type ConquestAnimState = 'capturing' | 'flag_change' | 'result' | 'done';

/** 攻城动画数据 */
export interface ConquestAnim {
  /** 动画ID */
  id: string;
  /** 目标城市ID */
  cityId: string;
  /** 网格X */
  gridX: number;
  /** 网格Y */
  gridY: number;
  /** 原阵营 */
  fromFaction: string;
  /** 新阵营 */
  toFaction: string;
  /** 动画状态 */
  state: ConquestAnimState;
  /** 进度 0~1 */
  progress: number;
  /** 开始时间 */
  startTime: number;
  /** 持续时间(ms) */
  duration: number;
  /** 战斗结果 */
  result?: {
    success: boolean;
    troopsLost: number;
    general: string;
  };
}

/** 阵营颜色映射 */
export const FACTION_COLORS: Record<string, string> = {
  wei: '#2E5090',
  shu: '#8B2500',
  wu: '#2E6B3E',
  neutral: '#6B5B3E',
};

// ─────────────────────────────────────────────
// ConquestAnimationSystem
// ─────────────────────────────────────────────

/**
 * 攻城动画系统
 */
export class ConquestAnimationSystem {
  private animations: Map<string, ConquestAnim> = new Map();
  private listeners: Set<() => void> = new Set();

  /**
   * 创建攻城动画
   */
  create(
    cityId: string,
    gridX: number,
    gridY: number,
    fromFaction: string,
    toFaction: string,
    result?: ConquestAnim['result'],
  ): ConquestAnim {
    const id = `conquest_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const anim: ConquestAnim = {
      id,
      cityId,
      gridX,
      gridY,
      fromFaction,
      toFaction,
      state: 'capturing',
      progress: 0,
      startTime: Date.now(),
      duration: 3000, // 3秒总动画
      result,
    };

    this.animations.set(id, anim);
    this.notify();
    return anim;
  }

  /**
   * 更新所有动画
   */
  update(): void {
    const now = Date.now();
    const toRemove: string[] = [];

    for (const [id, anim] of this.animations) {
      const elapsed = now - anim.startTime;
      anim.progress = Math.min(1, elapsed / anim.duration);

      // 状态转换
      if (anim.progress < 0.4) {
        anim.state = 'capturing';
      } else if (anim.progress < 0.7) {
        anim.state = 'flag_change';
      } else if (anim.progress < 1) {
        anim.state = 'result';
      } else {
        anim.state = 'done';
        toRemove.push(id);
      }
    }

    for (const id of toRemove) {
      this.animations.delete(id);
    }

    if (toRemove.length > 0) {
      this.notify();
    }
  }

  /**
   * 获取所有活跃动画
   */
  getActive(): ConquestAnim[] {
    return Array.from(this.animations.values());
  }

  /**
   * 渲染动画到Canvas
   */
  render(ctx: CanvasRenderingContext2D, ts: number, offsetX: number, offsetY: number): void {
    for (const anim of this.animations) {
      this.renderAnimation(ctx, anim[1], ts, offsetX, offsetY);
    }
  }

  /**
   * 注册变更监听
   */
  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ── 内部方法 ─────────────────────────────────

  private renderAnimation(
    ctx: CanvasRenderingContext2D,
    anim: ConquestAnim,
    ts: number,
    offsetX: number,
    offsetY: number,
  ): void {
    const px = anim.gridX * ts - offsetX;
    const py = anim.gridY * ts - offsetY;
    const size = ts * 3; // 3x3 城市区域

    switch (anim.state) {
      case 'capturing': {
        // 领土颜色渐变
        const fromColor = FACTION_COLORS[anim.fromFaction] || FACTION_COLORS.neutral;
        const toColor = FACTION_COLORS[anim.toFaction] || FACTION_COLORS.neutral;
        const t = anim.progress / 0.4; // 0~1 within this phase

        ctx.save();
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = this.lerpColor(fromColor, toColor, t);
        ctx.fillRect(px, py, size, size);
        ctx.restore();

        // 战斗粒子效果
        this.renderBattleParticles(ctx, px, py, size, t);
        break;
      }

      case 'flag_change': {
        // 旗帜更换动画
        const toColor = FACTION_COLORS[anim.toFaction] || FACTION_COLORS.neutral;
        const t = (anim.progress - 0.4) / 0.3;

        // 新阵营色填充
        ctx.save();
        ctx.globalAlpha = 0.5 + t * 0.3;
        ctx.fillStyle = toColor;
        ctx.fillRect(px, py, size, size);
        ctx.restore();

        // 旗帜升起动画
        this.renderFlagChange(ctx, px, py, size, t, anim.toFaction);
        break;
      }

      case 'result': {
        // 战斗结果文字
        const toColor = FACTION_COLORS[anim.toFaction] || FACTION_COLORS.neutral;
        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = toColor;
        ctx.fillRect(px, py, size, size);
        ctx.restore();

        if (anim.result) {
          this.renderResultText(ctx, px, py, size, anim.result);
        }
        break;
      }
    }
  }

  private renderBattleParticles(
    ctx: CanvasRenderingContext2D,
    px: number, py: number, size: number, t: number,
  ): void {
    ctx.save();
    ctx.fillStyle = '#ff6600';
    const count = Math.floor(t * 8);
    for (let i = 0; i < count; i++) {
      // 随机位置的圆点(使用伪随机，基于索引和进度保证帧间一致)
      const seed = (i * 137 + Math.floor(t * 100) * 31) % 1000;
      const x = px + (seed / 1000) * size;
      const y = py + ((seed * 7 + 13) % 1000) / 1000 * size;
      const particleRadius = 1 + (seed % 3);
      ctx.globalAlpha = 1 - t;
      ctx.beginPath();
      ctx.arc(x, y, particleRadius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private renderFlagChange(
    ctx: CanvasRenderingContext2D,
    px: number, py: number, size: number,
    t: number, faction: string,
  ): void {
    const color = FACTION_COLORS[faction] || FACTION_COLORS.neutral;

    // 旗帜杆
    ctx.save();
    ctx.strokeStyle = '#8b6914';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px + size / 2, py + size);
    ctx.lineTo(px + size / 2, py + size * 0.2);
    ctx.stroke();

    // 旗帜(从下升起)
    const flagY = py + size * (1 - t * 0.6);
    const flagH = size * 0.3;
    ctx.fillStyle = color;
    ctx.fillRect(px + size / 2, flagY, size * 0.4, flagH);

    // 阵营文字
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.max(8, size * 0.15)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const labels: Record<string, string> = { wei: '魏', shu: '蜀', wu: '吴' };
    ctx.fillText(labels[faction] || '?', px + size / 2 + size * 0.2, flagY + flagH / 2);

    ctx.restore();
  }

  private renderResultText(
    ctx: CanvasRenderingContext2D,
    px: number, py: number, size: number,
    result: NonNullable<ConquestAnim['result']>,
  ): void {
    ctx.save();
    ctx.font = `bold ${Math.max(10, size * 0.2)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const text = result.success ? '攻占成功!' : '攻城失败';
    const color = result.success ? '#2ecc71' : '#e74c3c';

    // 文字阴影
    ctx.fillStyle = '#000000';
    ctx.fillText(text, px + size / 2 + 1, py + size / 2 + 1);

    // 文字
    ctx.fillStyle = color;
    ctx.fillText(text, px + size / 2, py + size / 2);

    ctx.restore();
  }

  private lerpColor(from: string, to: string, t: number): string {
    const f = this.hexToRgb(from);
    const toRgb = this.hexToRgb(to);
    if (!f || !toRgb) return from;

    const r = Math.round(f.r + (toRgb.r - f.r) * t);
    const g = Math.round(f.g + (toRgb.g - f.g) * t);
    const b = Math.round(f.b + (toRgb.b - f.b) * t);
    return `rgb(${r},${g},${b})`;
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const match = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    if (!match) return null;
    return {
      r: parseInt(match[1], 16),
      g: parseInt(match[2], 16),
      b: parseInt(match[3], 16),
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
