/**
 * FloatingTextSystem — 飘字效果子系统
 *
 * 提供完整的飘字发射、轨迹运动、生命周期管理与 Canvas 渲染功能。
 * 适用于放置游戏中所有场景的数值飘字反馈（伤害、治疗、金币、经验等）。
 *
 * 设计原则：
 * - 零外部依赖，纯 TypeScript 实现
 * - 只使用 Canvas 2D API（实色文本 + 描边 + 阴影，不使用 neon/glow/闪烁效果）
 * - 支持 5 种轨迹类型（floatUp / arcLeft / arcRight / dropDown / shake）
 * - 支持 4 种缓动函数（linear / easeOut / easeInOut / bounceOut）
 * - 内置 6 种预设样式（damage / heal / gold / exp / crit / levelUp）
 * - 支持缩放动画、前缀文本、描边和阴影
 * - 完整的序列化 / 反序列化支持
 *
 * @module engines/idle/modules/FloatingTextSystem
 */

// ============================================================
// 类型定义
// ============================================================

/** 缓动函数类型 */
export type EasingType = "linear" | "easeOut" | "easeInOut" | "bounceOut";

/** 轨迹类型 */
export type TrajectoryType = "floatUp" | "arcLeft" | "arcRight" | "dropDown" | "shake";

/** 飘字样式配置 */
export interface FloatingTextStyle {
  /** 字号（px） */
  fontSize: number;
  /** 字重 */
  fontWeight: "normal" | "bold" | "bolder";
  /** 字体族 */
  fontFamily: string;
  /** 文字颜色（CSS 颜色字符串） */
  color: string;
  /** 描边颜色，null 表示不描边 */
  strokeColor: string | null;
  /** 描边宽度（px） */
  strokeWidth: number;
  /** 是否显示阴影 */
  shadow: boolean;
  /** 阴影 X 偏移（px） */
  shadowOffsetX: number;
  /** 阴影 Y 偏移（px） */
  shadowOffsetY: number;
  /** 阴影颜色 */
  shadowColor: string;
}

/** 飘字实例 */
export interface FloatingTextInstance {
  /** 唯一标识 */
  uid: number;
  /** 显示文本 */
  text: string;
  /** 初始 X 坐标 */
  x: number;
  /** 初始 Y 坐标 */
  y: number;
  /** 当前 X 坐标（每帧更新） */
  currentX: number;
  /** 当前 Y 坐标（每帧更新） */
  currentY: number;
  /** 轨迹类型 */
  trajectory: TrajectoryType;
  /** 总持续时间（秒） */
  duration: number;
  /** 已存活时间（秒） */
  age: number;
  /** 缓动函数 */
  easing: EasingType;
  /** 样式配置 */
  style: FloatingTextStyle;
  /** X 方向振幅（px） */
  amplitudeX: number;
  /** Y 方向振幅（px） */
  amplitudeY: number;
  /** 是否存活 */
  alive: boolean;
  /** 文本前缀（如 "+"、"-"、"×" 等） */
  prefix: string;
  /** 起始缩放比例 */
  scaleStart: number;
  /** 结束缩放比例 */
  scaleEnd: number;
}

/** add() 方法的可选参数 */
export interface FloatingTextOptions {
  /** 轨迹类型，默认 "floatUp" */
  trajectory?: TrajectoryType;
  /** 持续时间（秒），默认 1.5 */
  duration?: number;
  /** 缓动函数，默认 "easeOut" */
  easing?: EasingType;
  /** 样式预设名称，优先于 style */
  preset?: string;
  /** 自定义样式（部分字段），与默认样式合并 */
  style?: Partial<FloatingTextStyle>;
  /** X 方向振幅，默认 0 */
  amplitudeX?: number;
  /** Y 方向振幅，默认 60 */
  amplitudeY?: number;
  /** 文本前缀，默认 "" */
  prefix?: string;
  /** 起始缩放，默认 1 */
  scaleStart?: number;
  /** 结束缩放，默认 1 */
  scaleEnd?: number;
}

// ============================================================
// 默认样式
// ============================================================

/** 默认飘字样式 */
const DEFAULT_STYLE: FloatingTextStyle = {
  fontSize: 18,
  fontWeight: "bold",
  fontFamily: "Arial, sans-serif",
  color: "#ffffff",
  strokeColor: null,
  strokeWidth: 0,
  shadow: false,
  shadowOffsetX: 1,
  shadowOffsetY: 1,
  shadowColor: "rgba(0,0,0,0.5)",
};

// ============================================================
// FloatingTextSystem 实现
// ============================================================

/**
 * 飘字效果子系统
 *
 * 负责管理所有飘字实例，每帧执行：
 * 1. 轨迹运动计算（基于缓动函数）
 * 2. 生命周期管理（老化、移除）
 * 3. Canvas 渲染（缩放 + 透明度 + 描边 + 阴影）
 */
export class FloatingTextSystem {
  // ----------------------------------------------------------
  // 静态属性
  // ----------------------------------------------------------

  /** 预设样式集合 */
  static readonly PRESETS: Record<string, Partial<FloatingTextStyle>> = {
    damage: {
      fontSize: 24,
      fontWeight: "bold",
      color: "#ff4444",
      strokeColor: "#880000",
      strokeWidth: 2,
      shadow: true,
      shadowColor: "rgba(255,0,0,0.3)",
    },
    heal: {
      fontSize: 22,
      fontWeight: "bold",
      color: "#44ff44",
      strokeColor: "#008800",
      strokeWidth: 2,
      shadow: true,
      shadowColor: "rgba(0,255,0,0.3)",
    },
    gold: {
      fontSize: 20,
      fontWeight: "bold",
      color: "#ffd700",
      strokeColor: "#996600",
      strokeWidth: 2,
      shadow: true,
      shadowColor: "rgba(255,215,0,0.3)",
    },
    exp: {
      fontSize: 18,
      fontWeight: "normal",
      color: "#88ccff",
      strokeColor: "#004488",
      strokeWidth: 1,
      shadow: false,
    },
    crit: {
      fontSize: 32,
      fontWeight: "bolder",
      color: "#ff8800",
      strokeColor: "#663300",
      strokeWidth: 3,
      shadow: true,
      shadowColor: "rgba(255,136,0,0.4)",
    },
    levelUp: {
      fontSize: 36,
      fontWeight: "bolder",
      color: "#ffff00",
      strokeColor: "#888800",
      strokeWidth: 3,
      shadow: true,
      shadowColor: "rgba(255,255,0,0.4)",
    },
  };

  // ----------------------------------------------------------
  // 私有属性
  // ----------------------------------------------------------

  /** 所有飘字实例列表 */
  private instances: FloatingTextInstance[] = [];

  /** UID 自增计数器 */
  private nextUid: number = 1;

  // ----------------------------------------------------------
  // 构造函数
  // ----------------------------------------------------------

  /**
   * 创建 FloatingTextSystem 实例
   */
  constructor() {
    this.instances = [];
    this.nextUid = 1;
  }

  // ----------------------------------------------------------
  // 公共方法
  // ----------------------------------------------------------

  /**
   * 添加飘字实例
   *
   * 支持通过 preset 指定预设样式，也可通过 style 自定义样式。
   * preset 与 style 同时指定时，preset 作为基础，style 覆盖。
   *
   * @param text  显示文本
   * @param x     初始 X 坐标
   * @param y     初始 Y 坐标
   * @param options 可选参数
   * @returns 新创建的飘字实例
   */
  add(text: string, x: number, y: number, options?: FloatingTextOptions): FloatingTextInstance {
    // 合并样式：默认 → 预设 → 自定义
    let mergedStyle: FloatingTextStyle = { ...DEFAULT_STYLE };

    if (options?.preset && FloatingTextSystem.PRESETS[options.preset]) {
      mergedStyle = { ...mergedStyle, ...FloatingTextSystem.PRESETS[options.preset] };
    }

    if (options?.style) {
      mergedStyle = { ...mergedStyle, ...options.style };
    }

    const instance: FloatingTextInstance = {
      uid: this.nextUid++,
      text,
      x,
      y,
      currentX: x,
      currentY: y,
      trajectory: options?.trajectory ?? "floatUp",
      duration: options?.duration ?? 1.5,
      age: 0,
      easing: options?.easing ?? "easeOut",
      style: mergedStyle,
      amplitudeX: options?.amplitudeX ?? 0,
      amplitudeY: options?.amplitudeY ?? 60,
      alive: true,
      prefix: options?.prefix ?? "",
      scaleStart: options?.scaleStart ?? 1,
      scaleEnd: options?.scaleEnd ?? 1,
    };

    this.instances.push(instance);
    return instance;
  }

  /**
   * 每帧更新
   *
   * 遍历所有存活飘字，根据轨迹类型和缓动函数计算当前位置，
   * 并标记已超过生命周期的飘字为死亡。
   *
   * @param dt  距上一帧的时间间隔（秒）
   */
  update(dt: number): void {
    for (let i = 0; i < this.instances.length; i++) {
      const inst = this.instances[i];
      if (!inst.alive) continue;

      inst.age += dt;

      // 超过持续时间则标记死亡
      if (inst.age >= inst.duration) {
        inst.alive = false;
        continue;
      }

      // 计算进度比例 [0, 1]
      const t = Math.min(inst.age / inst.duration, 1);
      const easedT = this.applyEasing(t, inst.easing);

      // 根据轨迹类型计算偏移
      this.computeTrajectory(inst, easedT);
    }

    // 清理已死亡的飘字（惰性清理，避免每帧大量 splice）
    this.instances = this.instances.filter((inst) => inst.alive);
  }

  /**
   * 渲染所有存活飘字到 Canvas
   *
   * 渲染顺序：阴影 → 描边 → 填充文本。
   * 每个飘字根据 age/duration 计算透明度（后半段逐渐消失）和缩放。
   *
   * @param ctx  Canvas 2D 上下文
   */
  render(ctx: CanvasRenderingContext2D): void {
    for (let i = 0; i < this.instances.length; i++) {
      const inst = this.instances[i];
      if (!inst.alive) continue;

      const t = Math.min(inst.age / inst.duration, 1);

      // 透明度：前 60% 完全不透明，后 40% 线性衰减
      const fadeStart = 0.6;
      let alpha = 1;
      if (t > fadeStart) {
        alpha = 1 - (t - fadeStart) / (1 - fadeStart);
      }
      alpha = Math.max(0, Math.min(1, alpha));

      // 缩放：从 scaleStart 到 scaleEnd 线性插值
      const scale = inst.scaleStart + (inst.scaleEnd - inst.scaleStart) * t;

      // 保存上下文状态
      ctx.save();

      // 设置透明度
      ctx.globalAlpha = alpha;

      // 移动到飘字当前位置并缩放
      ctx.translate(inst.currentX, inst.currentY);
      ctx.scale(scale, scale);

      // 设置字体
      const fontStr = `${inst.style.fontWeight} ${inst.style.fontSize}px ${inst.style.fontFamily}`;
      ctx.font = fontStr;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const displayText = inst.prefix + inst.text;

      // 绘制阴影
      if (inst.style.shadow) {
        ctx.shadowOffsetX = inst.style.shadowOffsetX;
        ctx.shadowOffsetY = inst.style.shadowOffsetY;
        ctx.shadowColor = inst.style.shadowColor;
        ctx.shadowBlur = 0;
      }

      // 绘制描边
      if (inst.style.strokeColor !== null && inst.style.strokeWidth > 0) {
        ctx.strokeStyle = inst.style.strokeColor;
        ctx.lineWidth = inst.style.strokeWidth;
        ctx.lineJoin = "round";
        ctx.strokeText(displayText, 0, 0);
      }

      // 绘制填充文本
      ctx.fillStyle = inst.style.color;
      ctx.fillText(displayText, 0, 0);

      // 恢复上下文状态
      ctx.restore();
    }
  }

  /**
   * 获取当前存活飘字数量
   *
   * @returns 存活飘字数量
   */
  getAliveCount(): number {
    let count = 0;
    for (let i = 0; i < this.instances.length; i++) {
      if (this.instances[i].alive) {
        count++;
      }
    }
    return count;
  }

  /**
   * 清除所有飘字
   */
  clear(): void {
    this.instances = [];
  }

  /**
   * 序列化当前状态为 JSON 字符串
   *
   * 仅保存存活飘字的关键数据，不保存运行时派生字段。
   *
   * @returns JSON 字符串
   */
  saveState(): string {
    const aliveInstances = this.instances.filter((inst) => inst.alive);
    const data = {
      nextUid: this.nextUid,
      instances: aliveInstances.map((inst) => ({
        uid: inst.uid,
        text: inst.text,
        x: inst.x,
        y: inst.y,
        trajectory: inst.trajectory,
        duration: inst.duration,
        age: inst.age,
        easing: inst.easing,
        style: inst.style,
        amplitudeX: inst.amplitudeX,
        amplitudeY: inst.amplitudeY,
        prefix: inst.prefix,
        scaleStart: inst.scaleStart,
        scaleEnd: inst.scaleEnd,
      })),
    };
    return JSON.stringify(data);
  }

  /**
   * 从 JSON 字符串恢复状态
   *
   * @param json  saveState() 输出的 JSON 字符串
   */
  loadState(json: string): void {
    try {
      const data = JSON.parse(json);
      this.nextUid = data.nextUid ?? 1;
      this.instances = (data.instances ?? []).map(
        (inst: Record<string, unknown>) => {
          const instance: FloatingTextInstance = {
            uid: inst.uid as number,
            text: inst.text as string,
            x: inst.x as number,
            y: inst.y as number,
            currentX: inst.x as number,
            currentY: inst.y as number,
            trajectory: inst.trajectory as TrajectoryType,
            duration: inst.duration as number,
            age: inst.age as number,
            easing: inst.easing as EasingType,
            style: inst.style as FloatingTextStyle,
            amplitudeX: inst.amplitudeX as number,
            amplitudeY: inst.amplitudeY as number,
            alive: true,
            prefix: inst.prefix as string,
            scaleStart: inst.scaleStart as number,
            scaleEnd: inst.scaleEnd as number,
          };
          // 恢复时重新计算当前位置
          const t = Math.min(instance.age / instance.duration, 1);
          const easedT = this.applyEasing(t, instance.easing);
          this.computeTrajectory(instance, easedT);
          return instance;
        }
      );
    } catch {
      // 解析失败时保持空状态
      this.instances = [];
      this.nextUid = 1;
    }
  }

  // ----------------------------------------------------------
  // 私有方法
  // ----------------------------------------------------------

  /**
   * 缓动函数
   *
   * @param t     进度 [0, 1]
   * @param type  缓动类型
   * @returns 缓动后的值
   */
  private applyEasing(t: number, type: EasingType): number {
    switch (type) {
      case "linear":
        return t;

      case "easeOut":
        return 1 - (1 - t) * (1 - t);

      case "easeInOut":
        if (t < 0.5) {
          return 2 * t * t;
        }
        return 1 - (-2 * t + 2) * (-2 * t + 2) / 2;

      case "bounceOut": {
        const n1 = 7.5625;
        const d1 = 2.75;
        if (t < 1 / d1) {
          return n1 * t * t;
        } else if (t < 2 / d1) {
          const t2 = t - 1.5 / d1;
          return n1 * t2 * t2 + 0.75;
        } else if (t < 2.5 / d1) {
          const t2 = t - 2.25 / d1;
          return n1 * t2 * t2 + 0.9375;
        } else {
          const t2 = t - 2.625 / d1;
          return n1 * t2 * t2 + 0.984375;
        }
      }

      default:
        return t;
    }
  }

  /**
   * 根据轨迹类型计算飘字当前位置
   *
   * @param inst    飘字实例
   * @param easedT  缓动后的进度值 [0, 1]
   */
  private computeTrajectory(inst: FloatingTextInstance, easedT: number): void {
    switch (inst.trajectory) {
      case "floatUp":
        // 向上浮动，可带水平偏移
        inst.currentX = inst.x + inst.amplitudeX * Math.sin(easedT * Math.PI);
        inst.currentY = inst.y - inst.amplitudeY * easedT;
        break;

      case "arcLeft":
        // 向左上方弧线运动
        inst.currentX = inst.x - inst.amplitudeX * easedT;
        inst.currentY =
          inst.y - inst.amplitudeY * Math.sin(easedT * Math.PI);
        break;

      case "arcRight":
        // 向右上方弧线运动
        inst.currentX = inst.x + inst.amplitudeX * easedT;
        inst.currentY =
          inst.y - inst.amplitudeY * Math.sin(easedT * Math.PI);
        break;

      case "dropDown":
        // 从上方下落
        inst.currentX = inst.x + inst.amplitudeX * Math.sin(easedT * Math.PI);
        inst.currentY = inst.y - inst.amplitudeY * (1 - easedT);
        break;

      case "shake":
        // 水平抖动 + 轻微上浮
        inst.currentX =
          inst.x + Math.sin(easedT * Math.PI * 8) * inst.amplitudeX;
        inst.currentY = inst.y - inst.amplitudeY * easedT * 0.3;
        break;

      default:
        inst.currentX = inst.x;
        inst.currentY = inst.y - inst.amplitudeY * easedT;
        break;
    }
  }
}
