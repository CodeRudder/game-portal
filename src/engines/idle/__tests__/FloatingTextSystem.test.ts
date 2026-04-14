/**
 * FloatingTextSystem — 飘字效果子系统 单元测试
 *
 * 覆盖范围：
 * - 构造函数初始化
 * - PRESETS 预设样式（6 种，含字号校验）
 * - add() 添加飘字（含 preset / style 覆盖 / 全部选项）
 * - update() 轨迹运动 + 生命周期
 * - render() Canvas 渲染（透明度、缩放、描边、阴影）
 * - getAliveCount() / clear()
 * - applyEasing() 4 种缓动函数
 * - 5 种轨迹类型
 * - 序列化 / 反序列化
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  FloatingTextSystem,
  type FloatingTextInstance,
  type FloatingTextStyle,
  type FloatingTextOptions,
  type EasingType,
  type TrajectoryType,
} from "../modules/FloatingTextSystem";

// ============================================================
// 辅助：创建 mock CanvasRenderingContext2D
// ============================================================

function createMockCtx(): {
  ctx: CanvasRenderingContext2D;
  calls: Record<string, unknown[][]>;
} {
  const calls: Record<string, unknown[][]> = {};

  function track(name: string, ...args: unknown[]) {
    if (!calls[name]) calls[name] = [];
    calls[name].push(args);
  }

  const ctx = {
    save: () => track("save"),
    restore: () => track("restore"),
    translate: (x: number, y: number) => track("translate", x, y),
    scale: (x: number, y: number) => track("scale", x, y),
    rotate: (a: number) => track("rotate", a),
    fillText: (text: string, x: number, y: number) =>
      track("fillText", text, x, y),
    strokeText: (text: string, x: number, y: number) =>
      track("strokeText", text, x, y),
    beginPath: () => track("beginPath"),
    arc: (...args: unknown[]) => track("arc", ...args),
    fill: () => track("fill"),
    stroke: () => track("stroke"),
    font: "",
    textAlign: "",
    textBaseline: "",
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    lineJoin: "",
    globalAlpha: 1,
    globalCompositeOperation: "",
    shadowColor: "",
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    imageSmoothingEnabled: true,
    canvas: null,
  } as unknown as CanvasRenderingContext2D;

  return { ctx, calls };
}

// ============================================================
// 测试
// ============================================================

describe("FloatingTextSystem", () => {
  let system: FloatingTextSystem;

  beforeEach(() => {
    system = new FloatingTextSystem();
  });

  // ----------------------------------------------------------
  // 构造函数
  // ----------------------------------------------------------

  describe("constructor", () => {
    it("应正确初始化空实例", () => {
      const sys = new FloatingTextSystem();
      expect(sys.getAliveCount()).toBe(0);
    });
  });

  // ----------------------------------------------------------
  // PRESETS 预设样式
  // ----------------------------------------------------------

  describe("PRESETS", () => {
    it("应包含 6 种预设", () => {
      const keys = Object.keys(FloatingTextSystem.PRESETS);
      expect(keys).toContain("damage");
      expect(keys).toContain("heal");
      expect(keys).toContain("gold");
      expect(keys).toContain("exp");
      expect(keys).toContain("crit");
      expect(keys).toContain("levelUp");
      expect(keys.length).toBe(6);
    });

    it("damage 预设应为红色 24px", () => {
      const p = FloatingTextSystem.PRESETS.damage;
      expect(p.fontSize).toBe(24);
      expect(p.color).toBe("#ff4444");
      expect(p.fontWeight).toBe("bold");
      expect(p.strokeColor).toBeTruthy();
    });

    it("heal 预设应为绿色 22px", () => {
      const p = FloatingTextSystem.PRESETS.heal;
      expect(p.fontSize).toBe(22);
      expect(p.color).toBe("#44ff44");
    });

    it("gold 预设应为金色 20px", () => {
      const p = FloatingTextSystem.PRESETS.gold;
      expect(p.fontSize).toBe(20);
      expect(p.color).toBe("#ffd700");
    });

    it("exp 预设应为蓝色 18px", () => {
      const p = FloatingTextSystem.PRESETS.exp;
      expect(p.fontSize).toBe(18);
      expect(p.color).toBe("#88ccff");
    });

    it("crit 预设应为橙色 32px", () => {
      const p = FloatingTextSystem.PRESETS.crit;
      expect(p.fontSize).toBe(32);
      expect(p.color).toBe("#ff8800");
      expect(p.fontWeight).toBe("bolder");
    });

    it("levelUp 预设应为黄色 36px", () => {
      const p = FloatingTextSystem.PRESETS.levelUp;
      expect(p.fontSize).toBe(36);
      expect(p.color).toBe("#ffff00");
      expect(p.fontWeight).toBe("bolder");
    });
  });

  // ----------------------------------------------------------
  // add()
  // ----------------------------------------------------------

  describe("add", () => {
    it("应创建基本飘字实例", () => {
      const inst = system.add("Hello", 100, 200);
      expect(inst.text).toBe("Hello");
      expect(inst.x).toBe(100);
      expect(inst.y).toBe(200);
      expect(inst.currentX).toBe(100);
      expect(inst.currentY).toBe(200);
      expect(inst.alive).toBe(true);
      expect(inst.age).toBe(0);
      expect(inst.uid).toBeGreaterThan(0);
    });

    it("UID 应自增", () => {
      const a = system.add("A", 0, 0);
      const b = system.add("B", 0, 0);
      expect(b.uid).toBeGreaterThan(a.uid);
    });

    it("应使用默认值", () => {
      const inst = system.add("Test", 0, 0);
      expect(inst.trajectory).toBe("floatUp");
      expect(inst.duration).toBe(1.5);
      expect(inst.easing).toBe("easeOut");
      expect(inst.amplitudeX).toBe(0);
      expect(inst.amplitudeY).toBe(60);
      expect(inst.prefix).toBe("");
      expect(inst.scaleStart).toBe(1);
      expect(inst.scaleEnd).toBe(1);
    });

    it("应支持 preset 参数", () => {
      const inst = system.add("-50", 100, 100, { preset: "damage" });
      expect(inst.style.fontSize).toBe(24);
      expect(inst.style.color).toBe("#ff4444");
      expect(inst.style.strokeColor).toBe("#880000");
      expect(inst.style.strokeWidth).toBe(2);
    });

    it("应支持 style 覆盖 preset", () => {
      const inst = system.add("Test", 0, 0, {
        preset: "damage",
        style: { color: "#custom", fontSize: 50 },
      });
      expect(inst.style.color).toBe("#custom");
      expect(inst.style.fontSize).toBe(50);
      // 其他 preset 字段应保留
      expect(inst.style.strokeColor).toBe("#880000");
    });

    it("应支持全部 options", () => {
      const opts: FloatingTextOptions = {
        trajectory: "arcLeft",
        duration: 2.0,
        easing: "bounceOut",
        preset: "crit",
        style: { color: "#ff0000" },
        amplitudeX: 30,
        amplitudeY: 80,
        prefix: "-",
        scaleStart: 1.5,
        scaleEnd: 0.5,
      };
      const inst = system.add("100", 50, 60, opts);
      expect(inst.trajectory).toBe("arcLeft");
      expect(inst.duration).toBe(2.0);
      expect(inst.easing).toBe("bounceOut");
      expect(inst.style.color).toBe("#ff0000");
      expect(inst.style.fontSize).toBe(32); // from crit preset
      expect(inst.amplitudeX).toBe(30);
      expect(inst.amplitudeY).toBe(80);
      expect(inst.prefix).toBe("-");
      expect(inst.scaleStart).toBe(1.5);
      expect(inst.scaleEnd).toBe(0.5);
    });

    it("应增加存活数", () => {
      expect(system.getAliveCount()).toBe(0);
      system.add("A", 0, 0);
      expect(system.getAliveCount()).toBe(1);
      system.add("B", 0, 0);
      expect(system.getAliveCount()).toBe(2);
    });

    it("无效 preset 应使用默认样式", () => {
      const inst = system.add("Test", 0, 0, {
        preset: "nonexistent" as string,
      });
      // 应保持默认样式
      expect(inst.style.fontSize).toBe(18);
      expect(inst.style.color).toBe("#ffffff");
    });
  });

  // ----------------------------------------------------------
  // update()
  // ----------------------------------------------------------

  describe("update", () => {
    it("应在 duration 后标记死亡并清理", () => {
      const inst = system.add("Test", 100, 200, { duration: 1.0 });
      system.update(1.0);
      expect(inst.alive).toBe(false);
      expect(system.getAliveCount()).toBe(0);
    });

    it("应在 duration 前保持存活", () => {
      const inst = system.add("Test", 100, 200, { duration: 2.0 });
      system.update(1.0);
      expect(inst.alive).toBe(true);
      expect(system.getAliveCount()).toBe(1);
    });

    it("应更新 age", () => {
      const inst = system.add("Test", 0, 0, { duration: 5.0 });
      system.update(1.5);
      expect(inst.age).toBeCloseTo(1.5, 5);
    });

    it("floatUp 轨迹应向上移动", () => {
      const inst = system.add("Test", 100, 200, {
        trajectory: "floatUp",
        amplitudeY: 100,
        amplitudeX: 0,
        easing: "linear",
        duration: 1.0,
      });
      system.update(0.5);
      // t=0.5, linear easing => easedT=0.5
      // currentY = 200 - 100 * 0.5 = 150
      expect(inst.currentY).toBeCloseTo(150, 2);
      // currentX = 100 + 0 * sin(0.5*PI) = 100
      expect(inst.currentX).toBeCloseTo(100, 2);
    });

    it("arcLeft 轨迹应向左上方弧线运动", () => {
      const inst = system.add("Test", 100, 200, {
        trajectory: "arcLeft",
        amplitudeX: 50,
        amplitudeY: 80,
        easing: "linear",
        duration: 2.0,
      });
      system.update(1.0);
      // t=0.5, linear => easedT=0.5
      // currentX = 100 - 50 * 0.5 = 75
      // currentY = 200 - 80 * sin(0.5 * PI) = 200 - 80 = 120
      expect(inst.currentX).toBeCloseTo(75, 2);
      expect(inst.currentY).toBeCloseTo(120, 2);
    });

    it("arcRight 轨迹应向右上方弧线运动", () => {
      const inst = system.add("Test", 100, 200, {
        trajectory: "arcRight",
        amplitudeX: 50,
        amplitudeY: 80,
        easing: "linear",
        duration: 2.0,
      });
      system.update(1.0);
      // t=0.5, linear => easedT=0.5
      // currentX = 100 + 50 * 0.5 = 125
      // currentY = 200 - 80 * sin(0.5 * PI) = 200 - 80 = 120
      expect(inst.currentX).toBeCloseTo(125, 2);
      expect(inst.currentY).toBeCloseTo(120, 2);
    });

    it("dropDown 轨迹应从上方下落", () => {
      const inst = system.add("Test", 100, 200, {
        trajectory: "dropDown",
        amplitudeX: 0,
        amplitudeY: 100,
        easing: "linear",
        duration: 1.0,
      });
      system.update(0.0); // t=0 => currentY = 200 - 100*(1-0) = 100
      // age=0, 但 update(0) 不做任何事因为 dt=0
      // 需要一点 dt
      system.update(0.001);
      const t = 0.001;
      // easedT = t (linear)
      // currentY = 200 - 100 * (1 - t) ≈ 100.1
      expect(inst.currentY).toBeCloseTo(200 - 100 * (1 - t), 1);
    });

    it("shake 轨迹应水平抖动", () => {
      const inst = system.add("Test", 100, 200, {
        trajectory: "shake",
        amplitudeX: 10,
        amplitudeY: 50,
        easing: "linear",
        duration: 1.0,
      });
      system.update(0.25);
      // t=0.25, linear => easedT=0.25
      // currentX = 100 + sin(0.25 * PI * 8) * 10 = 100 + sin(2PI) * 10 = 100 + 0 = 100
      expect(inst.currentX).toBeCloseTo(100, 2);
      // currentY = 200 - 50 * 0.25 * 0.3 = 200 - 3.75 = 196.25
      expect(inst.currentY).toBeCloseTo(196.25, 2);
    });

    it("多个飘字应独立更新", () => {
      const a = system.add("A", 0, 0, { duration: 1.0 });
      const b = system.add("B", 0, 0, { duration: 3.0 });
      system.update(1.5);
      expect(a.alive).toBe(false);
      expect(b.alive).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // render()
  // ----------------------------------------------------------

  describe("render", () => {
    it("空系统不应报错", () => {
      const { ctx } = createMockCtx();
      expect(() => system.render(ctx)).not.toThrow();
    });

    it("应调用 save/restore 配对", () => {
      const { ctx, calls } = createMockCtx();
      system.add("Test", 100, 200, { duration: 2.0 });
      system.render(ctx);
      expect(calls.save?.length).toBe(calls.restore?.length);
      expect(calls.save?.length).toBeGreaterThan(0);
    });

    it("应设置字体并调用 fillText", () => {
      const { ctx, calls } = createMockCtx();
      system.add("Hello", 100, 200, { duration: 2.0 });
      system.render(ctx);
      expect(calls.fillText?.length).toBe(1);
      expect(calls.fillText?.[0][0]).toBe("Hello");
    });

    it("应添加 prefix 到显示文本", () => {
      const { ctx, calls } = createMockCtx();
      system.add("50", 100, 200, { prefix: "+", duration: 2.0 });
      system.render(ctx);
      expect(calls.fillText?.[0][0]).toBe("+50");
    });

    it("有描边时应调用 strokeText", () => {
      const { ctx, calls } = createMockCtx();
      system.add("Test", 100, 200, {
        preset: "damage",
        duration: 2.0,
      });
      system.render(ctx);
      expect(calls.strokeText?.length).toBe(1);
      expect(calls.fillText?.length).toBe(1);
    });

    it("无描边时不应调用 strokeText", () => {
      const { ctx, calls } = createMockCtx();
      system.add("Test", 100, 200, {
        style: { strokeColor: null, strokeWidth: 0 },
        duration: 2.0,
      });
      system.render(ctx);
      expect(calls.strokeText).toBeUndefined();
    });

    it("后半段应降低透明度", () => {
      const { ctx, calls } = createMockCtx();
      const inst = system.add("Fade", 100, 200, { duration: 1.0 });
      // 推进到 80% 生命周期（> 60% 淡出起点）
      system.update(0.8);
      expect(inst.alive).toBe(true);

      // 拦截 globalAlpha 设置
      let alphaValues: number[] = [];
      const origCtx = ctx;
      Object.defineProperty(origCtx, "globalAlpha", {
        set(v: number) {
          alphaValues.push(v);
        },
        get() {
          return 1;
        },
        configurable: true,
      });

      system.render(ctx);
      // 应有 alpha < 1
      const hasFaded = alphaValues.some((a) => a < 1);
      expect(hasFaded).toBe(true);
    });

    it("已死亡飘字不应渲染", () => {
      const { ctx, calls } = createMockCtx();
      system.add("Dead", 100, 200, { duration: 0.5 });
      system.update(1.0); // 超时
      system.render(ctx);
      expect(calls.fillText).toBeUndefined();
    });

    it("有阴影时应设置阴影属性", () => {
      const { ctx, calls } = createMockCtx();
      system.add("Shadow", 100, 200, {
        preset: "damage",
        duration: 2.0,
      });

      // 拦截 shadow 属性
      let shadowColorSet = false;
      Object.defineProperty(ctx, "shadowColor", {
        set(v: string) {
          if (v) shadowColorSet = true;
        },
        get() {
          return "";
        },
        configurable: true,
      });

      system.render(ctx);
      expect(shadowColorSet).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // getAliveCount()
  // ----------------------------------------------------------

  describe("getAliveCount", () => {
    it("初始应为 0", () => {
      expect(system.getAliveCount()).toBe(0);
    });

    it("添加后应增加", () => {
      system.add("A", 0, 0);
      system.add("B", 0, 0);
      system.add("C", 0, 0);
      expect(system.getAliveCount()).toBe(3);
    });

    it("超时后应减少", () => {
      system.add("A", 0, 0, { duration: 0.5 });
      system.add("B", 0, 0, { duration: 2.0 });
      system.update(1.0);
      expect(system.getAliveCount()).toBe(1);
    });
  });

  // ----------------------------------------------------------
  // clear()
  // ----------------------------------------------------------

  describe("clear", () => {
    it("应清除所有飘字", () => {
      system.add("A", 0, 0);
      system.add("B", 0, 0);
      system.clear();
      expect(system.getAliveCount()).toBe(0);
    });

    it("清除后应能继续添加", () => {
      system.add("A", 0, 0);
      system.clear();
      const inst = system.add("B", 10, 20);
      expect(system.getAliveCount()).toBe(1);
      expect(inst.text).toBe("B");
    });
  });

  // ----------------------------------------------------------
  // applyEasing（通过轨迹计算间接测试）
  // ----------------------------------------------------------

  describe("缓动函数", () => {
    it("linear: t 不变", () => {
      const inst = system.add("T", 0, 100, {
        trajectory: "floatUp",
        easing: "linear",
        amplitudeY: 100,
        amplitudeX: 0,
        duration: 1.0,
      });
      system.update(0.3);
      // easedT = 0.3, currentY = 100 - 100*0.3 = 70
      expect(inst.currentY).toBeCloseTo(70, 2);
    });

    it("easeOut: 后半段减速", () => {
      const inst = system.add("T", 0, 100, {
        trajectory: "floatUp",
        easing: "easeOut",
        amplitudeY: 100,
        amplitudeX: 0,
        duration: 1.0,
      });
      system.update(0.5);
      // easedT = 1 - (1-0.5)^2 = 0.75
      // currentY = 100 - 100*0.75 = 25
      expect(inst.currentY).toBeCloseTo(25, 2);
    });

    it("easeInOut: 中间段加速", () => {
      const inst = system.add("T", 0, 100, {
        trajectory: "floatUp",
        easing: "easeInOut",
        amplitudeY: 100,
        amplitudeX: 0,
        duration: 1.0,
      });
      system.update(0.25);
      // easedT = 2 * 0.25^2 = 0.125
      // currentY = 100 - 100*0.125 = 87.5
      expect(inst.currentY).toBeCloseTo(87.5, 2);
    });

    it("bounceOut: 弹跳效果", () => {
      const inst = system.add("T", 0, 100, {
        trajectory: "floatUp",
        easing: "bounceOut",
        amplitudeY: 100,
        amplitudeX: 0,
        duration: 1.0,
      });
      // t=0.1 => bounceOut 分支: t < 1/2.75 => n1*t*t
      system.update(0.1);
      const easedT = 7.5625 * 0.1 * 0.1;
      expect(inst.currentY).toBeCloseTo(100 - 100 * easedT, 2);
    });
  });

  // ----------------------------------------------------------
  // 轨迹类型完整覆盖
  // ----------------------------------------------------------

  describe("轨迹类型", () => {
    const trajectories: TrajectoryType[] = [
      "floatUp",
      "arcLeft",
      "arcRight",
      "dropDown",
      "shake",
    ];

    trajectories.forEach((traj) => {
      it(`${traj} 应正常更新位置`, () => {
        const inst = system.add("T", 100, 200, {
          trajectory: traj,
          amplitudeX: 30,
          amplitudeY: 60,
          easing: "linear",
          duration: 2.0,
        });
        system.update(0.5);
        expect(inst.alive).toBe(true);
        // 位置应该已从初始值改变（或保持合理的值）
        expect(isFinite(inst.currentX)).toBe(true);
        expect(isFinite(inst.currentY)).toBe(true);
      });
    });
  });

  // ----------------------------------------------------------
  // 缩放动画
  // ----------------------------------------------------------

  describe("缩放动画", () => {
    it("应设置 scaleStart 到 scaleEnd 的插值", () => {
      const { ctx, calls } = createMockCtx();
      system.add("Scale", 100, 200, {
        scaleStart: 2.0,
        scaleEnd: 0.5,
        duration: 1.0,
        easing: "linear",
      });
      system.update(0.5);
      system.render(ctx);

      // scale 应被调用，参数为 (1.25, 1.25)
      // scale = 2.0 + (0.5 - 2.0) * 0.5 = 2.0 - 0.75 = 1.25
      expect(calls.scale?.length).toBeGreaterThan(0);
      expect(calls.scale?.[0][0]).toBeCloseTo(1.25, 2);
      expect(calls.scale?.[0][1]).toBeCloseTo(1.25, 2);
    });
  });

  // ----------------------------------------------------------
  // 序列化 / 反序列化
  // ----------------------------------------------------------

  describe("saveState / loadState", () => {
    it("序列化后反序列化应恢复状态", () => {
      system.add("Hello", 100, 200, {
        preset: "damage",
        trajectory: "arcLeft",
        duration: 3.0,
        prefix: "-",
      });
      system.update(0.5);

      const json = system.saveState();
      const sys2 = new FloatingTextSystem();
      sys2.loadState(json);

      expect(sys2.getAliveCount()).toBe(1);
    });

    it("无效 JSON 不应崩溃", () => {
      expect(() => system.loadState("not json")).not.toThrow();
      expect(system.getAliveCount()).toBe(0);
    });

    it("空 JSON 对象不应崩溃", () => {
      expect(() => system.loadState("{}")).not.toThrow();
      expect(system.getAliveCount()).toBe(0);
    });

    it("反序列化后应可继续 update", () => {
      system.add("Test", 100, 200, { duration: 2.0 });
      system.update(0.5);

      const json = system.saveState();
      const sys2 = new FloatingTextSystem();
      sys2.loadState(json);

      expect(() => sys2.update(0.5)).not.toThrow();
      expect(sys2.getAliveCount()).toBe(1);
    });

    it("反序列化后应能正确渲染", () => {
      system.add("Render", 100, 200, { duration: 2.0, preset: "gold" });
      system.update(0.5);

      const json = system.saveState();
      const sys2 = new FloatingTextSystem();
      sys2.loadState(json);

      const { ctx, calls } = createMockCtx();
      expect(() => sys2.render(ctx)).not.toThrow();
      expect(calls.fillText?.length).toBe(1);
    });
  });

  // ----------------------------------------------------------
  // 边界条件
  // ----------------------------------------------------------

  describe("边界条件", () => {
    it("dt=0 不应导致问题", () => {
      system.add("T", 0, 0, { duration: 1.0 });
      expect(() => system.update(0)).not.toThrow();
      expect(system.getAliveCount()).toBe(1);
    });

    it("大量飘字应正常处理", () => {
      for (let i = 0; i < 200; i++) {
        system.add(`T${i}`, Math.random() * 800, Math.random() * 600, {
          duration: 2.0,
        });
      }
      expect(system.getAliveCount()).toBe(200);
      system.update(0.016);
      expect(system.getAliveCount()).toBe(200);
    });

    it("超长 duration 应正常工作", () => {
      const inst = system.add("Long", 0, 0, { duration: 9999 });
      system.update(1.0);
      expect(inst.alive).toBe(true);
      expect(inst.age).toBeCloseTo(1.0, 5);
    });

    it("负坐标应正常工作", () => {
      const inst = system.add("Neg", -100, -200, { duration: 1.0 });
      expect(inst.x).toBe(-100);
      expect(inst.y).toBe(-200);
    });
  });

  // ----------------------------------------------------------
  // 类型导出验证
  // ----------------------------------------------------------

  describe("类型导出", () => {
    it("EasingType 应包含 4 种类型", () => {
      const easings: EasingType[] = [
        "linear",
        "easeOut",
        "easeInOut",
        "bounceOut",
      ];
      easings.forEach((e) => {
        const inst = system.add("T", 0, 0, { easing: e, duration: 1.0 });
        expect(inst.easing).toBe(e);
      });
    });

    it("TrajectoryType 应包含 5 种类型", () => {
      const trajectories: TrajectoryType[] = [
        "floatUp",
        "arcLeft",
        "arcRight",
        "dropDown",
        "shake",
      ];
      trajectories.forEach((tr) => {
        const inst = system.add("T", 0, 0, {
          trajectory: tr,
          duration: 1.0,
        });
        expect(inst.trajectory).toBe(tr);
      });
    });
  });
});
