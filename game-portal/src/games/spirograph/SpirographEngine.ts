import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  DEFAULT_OUTER_RADIUS,
  DEFAULT_INNER_RADIUS,
  DEFAULT_PEN_DISTANCE,
  MIN_OUTER_RADIUS,
  MAX_OUTER_RADIUS,
  MIN_INNER_RADIUS,
  MAX_INNER_RADIUS,
  MIN_PEN_DISTANCE,
  MAX_PEN_DISTANCE,
  INNER_RADIUS_STEP,
  PEN_DISTANCE_STEP,
  OUTER_RADIUS_STEP,
  DEFAULT_DRAW_SPEED,
  MIN_DRAW_SPEED,
  MAX_DRAW_SPEED,
  SPEED_STEP,
  COLOR_SCHEMES,
  DEFAULT_COLOR_SCHEME_INDEX,
  PRESETS,
  LINE_WIDTH,
  GEAR_LINE_WIDTH,
  GEAR_OPACITY,
  COLORS,
  HUD_HEIGHT,
  FONT_FAMILY,
  FONT_SIZE_HUD,
  FONT_SIZE_TITLE,
  closureAngle,
  hypotrochoidPoint,
  getGradientColor,
  ColorScheme,
  SpirographPreset,
} from './constants';

// ========== 类型定义 ==========

/** 曲线上的点 */
interface CurvePoint {
  x: number;
  y: number;
  color: string;
}

/** Spirograph 状态 */
interface SpirographState {
  outerRadius: number;
  innerRadius: number;
  penDistance: number;
  drawSpeed: number;
  colorSchemeIndex: number;
  isDrawing: boolean;
  currentAngle: number;
  maxAngle: number;
  pointsDrawn: number;
  totalPoints: number;
  isComplete: boolean;
  curveType: 'hypotrochoid' | 'epitrochoid';
}

// ========== Spirograph 万花尺引擎 ==========

export class SpirographEngine extends GameEngine {
  // 曲线参数
  private outerRadius: number = DEFAULT_OUTER_RADIUS;
  private innerRadius: number = DEFAULT_INNER_RADIUS;
  private penDistance: number = DEFAULT_PEN_DISTANCE;

  // 动画状态
  private drawSpeed: number = DEFAULT_DRAW_SPEED;
  private currentAngle: number = 0;
  private maxAngle: number = 0;
  private isDrawing: boolean = false;
  private isComplete: boolean = false;

  // 曲线数据
  private curvePoints: CurvePoint[] = [];
  private pointsDrawn: number = 0;
  private totalPoints: number = 0;

  // 颜色方案
  private colorSchemeIndex: number = DEFAULT_COLOR_SCHEME_INDEX;
  private currentColorScheme: ColorScheme = COLOR_SCHEMES[DEFAULT_COLOR_SCHEME_INDEX];

  // 曲线类型
  private curveType: 'hypotrochoid' | 'epitrochoid' = 'hypotrochoid';

  // 画布中心
  private centerX: number = CANVAS_WIDTH / 2;
  private centerY: number = CANVAS_HEIGHT / 2;

  // ========== 生命周期 ==========

  protected onInit(): void {
    this.resetCurve();
    this.recalculate();
  }

  protected onStart(): void {
    this.isDrawing = true;
    this.recalculate();
  }

  protected update(deltaTime: number): void {
    if (!this.isDrawing || this.isComplete) return;

    // 每帧推进多个步长（基于速度）
    const stepsPerFrame = Math.max(1, Math.round(this.drawSpeed * 200));
    const angleStep = this.drawSpeed;

    for (let i = 0; i < stepsPerFrame; i++) {
      if (this.currentAngle >= this.maxAngle) {
        this.isComplete = true;
        this.isDrawing = false;
        this._score = this.pointsDrawn;
        this.emit('scoreChange', this._score);
        break;
      }

      this.currentAngle += angleStep;
      this.addCurvePoint(this.currentAngle);
    }

    // 更新分数为已绘制点数
    this._score = this.pointsDrawn;
    this.emit('scoreChange', this._score);
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    this.drawBackground(ctx, w, h);

    // 中心标记
    this.drawCenterMark(ctx);

    // 曲线
    this.drawCurve(ctx);

    // 齿轮可视化
    if (this.isDrawing && !this.isComplete) {
      this.drawGears(ctx);
    }

    // HUD
    this.drawHUD(ctx, w);

    // 暂停提示
    if (this._status === 'paused') {
      this.drawPauseOverlay(ctx, w, h);
    }
  }

  protected onPause(): void {
    // 暂停时停止绘制
  }

  protected onResume(): void {
    // 恢复时继续绘制
  }

  protected onReset(): void {
    this.resetCurve();
    this.recalculate();
  }

  protected onDestroy(): void {
    this.curvePoints = [];
  }

  protected onGameOver(): void {
    // Spirograph 没有 game over
  }

  // ========== 核心逻辑 ==========

  /** 重置曲线数据 */
  private resetCurve(): void {
    this.currentAngle = 0;
    this.curvePoints = [];
    this.pointsDrawn = 0;
    this.isDrawing = false;
    this.isComplete = false;
    this._score = 0;
  }

  /** 重新计算曲线参数 */
  private recalculate(): void {
    this.maxAngle = closureAngle(this.outerRadius, this.innerRadius);
    this.totalPoints = Math.ceil(this.maxAngle / this.drawSpeed);
    this.centerX = CANVAS_WIDTH / 2;
    this.centerY = CANVAS_HEIGHT / 2;
  }

  /** 添加曲线上的一个点 */
  private addCurvePoint(t: number): void {
    let point: { x: number; y: number };
    if (this.curveType === 'hypotrochoid') {
      point = hypotrochoidPoint(this.outerRadius, this.innerRadius, this.penDistance, t);
    } else {
      point = this.epitrochoidPoint(this.outerRadius, this.innerRadius, this.penDistance, t);
    }

    const progress = this.maxAngle > 0 ? t / this.maxAngle : 0;
    const color = getGradientColor(this.currentColorScheme.colors, progress);

    this.curvePoints.push({
      x: this.centerX + point.x,
      y: this.centerY + point.y,
      color,
    });
    this.pointsDrawn++;
  }

  /** 使用 epitrochoid 计算点 */
  private epitrochoidPoint(R: number, r: number, d: number, t: number): { x: number; y: number } {
    const sum = R + r;
    const ratio = r !== 0 ? sum / r : 0;
    return {
      x: sum * Math.cos(t) - d * Math.cos(ratio * t),
      y: sum * Math.sin(t) - d * Math.sin(ratio * t),
    };
  }

  // ========== 渲染方法 ==========

  /** 绘制背景 */
  private drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, w, h);
  }

  /** 绘制中心标记 */
  private drawCenterMark(ctx: CanvasRenderingContext2D): void {
    ctx.strokeStyle = COLORS.centerMark;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(this.centerX - 10, this.centerY);
    ctx.lineTo(this.centerX + 10, this.centerY);
    ctx.moveTo(this.centerX, this.centerY - 10);
    ctx.lineTo(this.centerX, this.centerY + 10);
    ctx.stroke();
  }

  /** 绘制曲线 */
  private drawCurve(ctx: CanvasRenderingContext2D): void {
    if (this.curvePoints.length < 2) return;

    ctx.lineWidth = LINE_WIDTH;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 分段绘制以实现渐变色
    for (let i = 1; i < this.curvePoints.length; i++) {
      const prev = this.curvePoints[i - 1];
      const curr = this.curvePoints[i];
      ctx.strokeStyle = curr.color;
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(curr.x, curr.y);
      ctx.stroke();
    }
  }

  /** 绘制齿轮可视化 */
  private drawGears(ctx: CanvasRenderingContext2D): void {
    const t = this.currentAngle;
    const R = this.outerRadius;
    const r = this.innerRadius;
    const d = this.penDistance;

    // 外圆
    ctx.strokeStyle = COLORS.outerGear;
    ctx.globalAlpha = GEAR_OPACITY;
    ctx.lineWidth = GEAR_LINE_WIDTH;
    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, R, 0, Math.PI * 2);
    ctx.stroke();

    // 内圆中心位置
    let innerCenterX: number, innerCenterY: number;
    if (this.curveType === 'hypotrochoid') {
      const diff = R - r;
      innerCenterX = this.centerX + diff * Math.cos(t);
      innerCenterY = this.centerY + diff * Math.sin(t);
    } else {
      const sum = R + r;
      innerCenterX = this.centerX + sum * Math.cos(t);
      innerCenterY = this.centerY + sum * Math.sin(t);
    }

    // 内圆
    ctx.strokeStyle = COLORS.innerGear;
    ctx.beginPath();
    ctx.arc(innerCenterX, innerCenterY, r, 0, Math.PI * 2);
    ctx.stroke();

    // 笔点
    let penX: number, penY: number;
    if (this.curveType === 'hypotrochoid') {
      const pt = hypotrochoidPoint(R, r, d, t);
      penX = this.centerX + pt.x;
      penY = this.centerY + pt.y;
    } else {
      const pt = this.epitrochoidPoint(R, r, d, t);
      penX = this.centerX + pt.x;
      penY = this.centerY + pt.y;
    }

    // 连接线
    ctx.strokeStyle = COLORS.connectingLine;
    ctx.beginPath();
    ctx.moveTo(innerCenterX, innerCenterY);
    ctx.lineTo(penX, penY);
    ctx.stroke();

    // 笔点
    ctx.globalAlpha = 1;
    ctx.fillStyle = COLORS.penDot;
    ctx.beginPath();
    ctx.arc(penX, penY, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1;
  }

  /** 绘制 HUD */
  private drawHUD(ctx: CanvasRenderingContext2D, w: number): void {
    // HUD 背景
    ctx.fillStyle = COLORS.hudBg;
    ctx.fillRect(0, 0, w, HUD_HEIGHT);

    // 分隔线
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, HUD_HEIGHT);
    ctx.lineTo(w, HUD_HEIGHT);
    ctx.stroke();

    ctx.textBaseline = 'middle';

    // 第一行：参数
    const y1 = 20;
    ctx.font = `bold ${FONT_SIZE_TITLE}px ${FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.textPrimary;
    ctx.fillText('SPIROGRAPH 万花尺', 10, y1);

    // 第二行：参数值
    const y2 = 45;
    ctx.font = `${FONT_SIZE_HUD}px ${FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.accent;
    ctx.fillText(`R:${this.outerRadius}`, 10, y2);
    ctx.fillStyle = COLORS.textSecondary;
    ctx.fillText(`r:${this.innerRadius}`, 80, y2);
    ctx.fillText(`d:${this.penDistance}`, 140, y2);

    // 速度
    ctx.fillStyle = COLORS.textMuted;
    ctx.fillText(`速度:${this.drawSpeed.toFixed(3)}`, 200, y2);

    // 颜色方案
    ctx.fillStyle = COLORS.textSecondary;
    ctx.fillText(`🎨${this.currentColorScheme.name}`, 310, y2);

    // 第三行：状态
    const y3 = 65;
    ctx.font = `${FONT_SIZE_HUD}px ${FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.textMuted;

    if (this.isComplete) {
      ctx.fillStyle = '#00b894';
      ctx.fillText('✓ 完成', 10, y3);
    } else if (this.isDrawing) {
      ctx.fillStyle = '#f0932b';
      ctx.fillText('● 绘制中', 10, y3);
    } else {
      ctx.fillStyle = COLORS.textMuted;
      ctx.fillText('○ 就绪', 10, y3);
    }

    // 进度
    const progress = this.maxAngle > 0 ? Math.min(1, this.currentAngle / this.maxAngle) : 0;
    ctx.fillStyle = COLORS.textSecondary;
    ctx.fillText(`${(progress * 100).toFixed(1)}%`, 100, y3);

    // 曲线类型
    ctx.fillStyle = COLORS.textMuted;
    ctx.fillText(this.curveType === 'hypotrochoid' ? '内摆线' : '外摆线', 170, y3);

    // 操作提示
    ctx.textAlign = 'right';
    ctx.fillStyle = COLORS.textMuted;
    ctx.fillText('←→ r  ↑↓ d  空格 绘制  R 重置', w - 10, y3);
  }

  /** 绘制暂停覆盖层 */
  private drawPauseOverlay(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = 'rgba(13, 13, 32, 0.4)';
    ctx.fillRect(0, HUD_HEIGHT, w, h - HUD_HEIGHT);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold 20px ${FONT_FAMILY}`;
    ctx.fillStyle = COLORS.textPrimary;
    ctx.shadowColor = COLORS.accent;
    ctx.shadowBlur = 15;
    ctx.fillText('⏸ 已暂停', w / 2, h / 2);
    ctx.shadowBlur = 0;

    ctx.font = `${FONT_SIZE_HUD}px ${FONT_FAMILY}`;
    ctx.fillStyle = COLORS.textMuted;
    ctx.fillText('空格 继续', w / 2, h / 2 + 28);
  }

  // ========== 参数调整 ==========

  /** 设置外圆半径 */
  setOuterRadius(R: number): void {
    this.outerRadius = Math.max(MIN_OUTER_RADIUS, Math.min(MAX_OUTER_RADIUS, R));
    this.onParametersChanged();
  }

  /** 设置内圆半径 */
  setInnerRadius(r: number): void {
    this.innerRadius = Math.max(MIN_INNER_RADIUS, Math.min(MAX_INNER_RADIUS, r));
    this.onParametersChanged();
  }

  /** 设置笔距 */
  setPenDistance(d: number): void {
    this.penDistance = Math.max(MIN_PEN_DISTANCE, Math.min(MAX_PEN_DISTANCE, d));
    this.onParametersChanged();
  }

  /** 设置绘制速度 */
  setDrawSpeed(speed: number): void {
    this.drawSpeed = Math.max(MIN_DRAW_SPEED, Math.min(MAX_DRAW_SPEED, speed));
  }

  /** 设置曲线类型 */
  setCurveType(type: 'hypotrochoid' | 'epitrochoid'): void {
    this.curveType = type;
    this.onParametersChanged();
  }

  /** 应用预设图案 */
  applyPreset(preset: SpirographPreset): void {
    this.outerRadius = preset.outerRadius;
    this.innerRadius = preset.innerRadius;
    this.penDistance = preset.penDistance;
    this.onParametersChanged();
  }

  /** 切换颜色方案 */
  cycleColorScheme(): void {
    this.colorSchemeIndex = (this.colorSchemeIndex + 1) % COLOR_SCHEMES.length;
    this.currentColorScheme = COLOR_SCHEMES[this.colorSchemeIndex];
    // 如果有已绘制的曲线，需要重新计算颜色
    this.recolorCurve();
  }

  /** 重新着色曲线 */
  private recolorCurve(): void {
    for (let i = 0; i < this.curvePoints.length; i++) {
      const progress = this.maxAngle > 0 ? (i * this.drawSpeed) / this.maxAngle : 0;
      this.curvePoints[i].color = getGradientColor(this.currentColorScheme.colors, progress);
    }
  }

  /** 参数变化时重置曲线 */
  private onParametersChanged(): void {
    this.resetCurve();
    this.recalculate();
  }

  /** 加速 */
  private speedUp(): void {
    this.drawSpeed = Math.min(MAX_DRAW_SPEED, this.drawSpeed + SPEED_STEP);
  }

  /** 减速 */
  private speedDown(): void {
    this.drawSpeed = Math.max(MIN_DRAW_SPEED, this.drawSpeed - SPEED_STEP);
  }

  // ========== 输入处理 ==========

  handleKeyDown(key: string): void {
    // 空格：开始/暂停绘制
    if (key === ' ') {
      if (this._status === 'idle') {
        this.start();
      } else if (this._status === 'playing') {
        if (this.isComplete) {
          // 完成后重新开始
          this.reset();
        } else {
          this.pause();
        }
      } else if (this._status === 'paused') {
        this.resume();
      }
      return;
    }

    // R：重置画布
    if (key === 'r' || key === 'R') {
      this.reset();
      return;
    }

    // 左键：减小内圆半径 r
    if (key === 'ArrowLeft') {
      this.setInnerRadius(this.innerRadius - INNER_RADIUS_STEP);
      return;
    }

    // 右键：增大内圆半径 r
    if (key === 'ArrowRight') {
      this.setInnerRadius(this.innerRadius + INNER_RADIUS_STEP);
      return;
    }

    // 上键：增大笔距 d
    if (key === 'ArrowUp') {
      this.setPenDistance(this.penDistance + PEN_DISTANCE_STEP);
      return;
    }

    // 下键：减小笔距 d
    if (key === 'ArrowDown') {
      this.setPenDistance(this.penDistance - PEN_DISTANCE_STEP);
      return;
    }

    // 数字键 1-5：预设图案
    const numKey = parseInt(key);
    if (numKey >= 1 && numKey <= PRESETS.length) {
      this.applyPreset(PRESETS[numKey - 1]);
      return;
    }

    // C：切换颜色方案
    if (key === 'c' || key === 'C') {
      this.cycleColorScheme();
      return;
    }

    // +/=：加速
    if (key === '+' || key === '=') {
      this.speedUp();
      return;
    }

    // -/_：减速
    if (key === '-' || key === '_') {
      this.speedDown();
      return;
    }

    // E：切换曲线类型
    if (key === 'e' || key === 'E') {
      this.setCurveType(
        this.curveType === 'hypotrochoid' ? 'epitrochoid' : 'hypotrochoid'
      );
      return;
    }

    // Q/W：调整外圆半径
    if (key === 'q' || key === 'Q') {
      this.setOuterRadius(this.outerRadius - OUTER_RADIUS_STEP);
      return;
    }
    if (key === 'w' || key === 'W') {
      this.setOuterRadius(this.outerRadius + OUTER_RADIUS_STEP);
      return;
    }
  }

  handleKeyUp(_key: string): void {
    // 不需要处理
  }

  getState(): Record<string, unknown> {
    const state: SpirographState = {
      outerRadius: this.outerRadius,
      innerRadius: this.innerRadius,
      penDistance: this.penDistance,
      drawSpeed: this.drawSpeed,
      colorSchemeIndex: this.colorSchemeIndex,
      isDrawing: this.isDrawing,
      currentAngle: this.currentAngle,
      maxAngle: this.maxAngle,
      pointsDrawn: this.pointsDrawn,
      totalPoints: this.totalPoints,
      isComplete: this.isComplete,
      curveType: this.curveType,
    };
    return state as unknown as Record<string, unknown>;
  }

  // ========== 公开方法（供测试和外部调用） ==========

  /** 获取外圆半径 */
  getOuterRadius(): number {
    return this.outerRadius;
  }

  /** 获取内圆半径 */
  getInnerRadius(): number {
    return this.innerRadius;
  }

  /** 获取笔距 */
  getPenDistance(): number {
    return this.penDistance;
  }

  /** 获取绘制速度 */
  getDrawSpeed(): number {
    return this.drawSpeed;
  }

  /** 获取颜色方案索引 */
  getColorSchemeIndex(): number {
    return this.colorSchemeIndex;
  }

  /** 获取当前颜色方案 */
  getColorScheme(): ColorScheme {
    return this.currentColorScheme;
  }

  /** 获取曲线类型 */
  getCurveType(): string {
    return this.curveType;
  }

  /** 获取当前角度 */
  getCurrentAngle(): number {
    return this.currentAngle;
  }

  /** 获取最大角度 */
  getMaxAngle(): number {
    return this.maxAngle;
  }

  /** 获取已绘制点数 */
  getPointsDrawn(): number {
    return this.pointsDrawn;
  }

  /** 获取总点数 */
  getTotalPoints(): number {
    return this.totalPoints;
  }

  /** 是否正在绘制 */
  getIsDrawing(): boolean {
    return this.isDrawing;
  }

  /** 是否绘制完成 */
  getIsComplete(): boolean {
    return this.isComplete;
  }

  /** 获取曲线点数据 */
  getCurvePoints(): CurvePoint[] {
    return [...this.curvePoints];
  }

  /** 导出当前参数 */
  exportParams(): {
    outerRadius: number;
    innerRadius: number;
    penDistance: number;
    drawSpeed: number;
    colorScheme: string;
    curveType: string;
  } {
    return {
      outerRadius: this.outerRadius,
      innerRadius: this.innerRadius,
      penDistance: this.penDistance,
      drawSpeed: this.drawSpeed,
      colorScheme: this.currentColorScheme.name,
      curveType: this.curveType,
    };
  }
}
