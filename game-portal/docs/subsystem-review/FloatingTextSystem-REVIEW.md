# FloatingTextSystem 飘字/伤害数字子系统 — 架构审查报告

> **审查人**: 系统架构师  
> **审查日期**: 2025-07-09  
> **源码路径**: `src/engines/idle/modules/FloatingTextSystem.ts`  
> **测试路径**: `src/engines/idle/__tests__/FloatingTextSystem.test.ts`

---

## 一、概览

### 1.1 基本信息

| 指标 | 数值 |
|------|------|
| 源码行数 | 574 行 |
| 测试行数 | 769 行 |
| 测试/代码比 | 1.34 : 1 |
| 公共方法数 | 7 (`add`, `update`, `render`, `getAliveCount`, `clear`, `saveState`, `loadState`) |
| 私有方法数 | 2 (`applyEasing`, `computeTrajectory`) |
| 导出类型数 | 5 (`EasingType`, `TrajectoryType`, `FloatingTextStyle`, `FloatingTextInstance`, `FloatingTextOptions`) |
| 静态属性 | 1 (`PRESETS`) |
| 外部依赖 | 0（纯 TypeScript + Canvas 2D API） |

### 1.2 依赖关系

```
┌─────────────────────────────────────────────────┐
│                  index.ts (barrel)               │
│         re-export class + 5 types               │
└───────────────────┬─────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│            FloatingTextSystem.ts                 │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐ │
│  │ add()    │  │ update() │  │ render()      │ │
│  └────┬─────┘  └────┬─────┘  └───────┬───────┘ │
│       │              │                │          │
│       ▼              ▼                ▼          │
│  ┌──────────┐  ┌──────────────┐  ┌──────────┐  │
│  │ PRESETS  │  │ applyEasing()│  │ Canvas2D │  │
│  │ (static) │  │ computeTraj()│  │  API     │  │
│  └──────────┘  └──────────────┘  └──────────┘  │
└─────────────────────────────────────────────────┘
         ▲
         │ 被上层 idle engine 整合调用
    ┌────┴────┐
    │ 上层场景 │ (BattleScene, MapScene 等)
    └─────────┘
```

**外部耦合**: 仅依赖 `CanvasRenderingContext2D` 接口（浏览器标准 API），零框架依赖，零业务耦合。  
**内部耦合**: 通过 `index.ts` barrel 导出，无其他模块间依赖。

### 1.3 架构定位

FloatingTextSystem 是一个**纯渲染层视觉反馈组件**，在放置游戏架构中属于：

```
Game Loop
  └─ IdleEngine
       └─ Scene (BattleScene / MapScene / ...)
            ├─ FloatingTextSystem   ← 本模块
            ├─ ParticleSystem
            └─ StatisticsTracker
```

---

## 二、接口分析

### 2.1 公共 API 总览

| 方法 | 签名 | 职责 |
|------|------|------|
| `add()` | `(text, x, y, options?) → FloatingTextInstance` | 创建飘字实例 |
| `update()` | `(dt: number) → void` | 每帧更新轨迹和生命周期 |
| `render()` | `(ctx: CanvasRenderingContext2D) → void` | Canvas 渲染 |
| `getAliveCount()` | `() → number` | 查询存活数量 |
| `clear()` | `() → void` | 清空所有飘字 |
| `saveState()` | `() → string` | 序列化为 JSON |
| `loadState()` | `(json: string) → void` | 从 JSON 反序列化 |

### 2.2 接口评价

**✅ 优点**

1. **API 简洁直观**: `add(text, x, y, options?)` 是经典的工厂模式，参数渐进式可选，上手零成本
2. **关注点分离**: `update`（逻辑）与 `render`（渲染）分离，符合游戏引擎的 tick-render 模式
3. **样式系统设计良好**: 三层样式合并（默认 → 预设 → 自定义）提供了灵活性又不失便捷
4. **序列化支持**: `saveState/loadState` 支持放置游戏的离线收益场景，考虑周到
5. **类型导出完整**: 5 个类型全部导出，下游消费者可获得完整类型提示

**⚠️ 不足**

1. **缺少批量创建 API**: 放置游戏常见"一秒内数十个金币飘字"场景，逐个 `add()` 不够高效
2. **缺少 `remove(uid)` 方法**: 无法精确移除单个飘字，只能等自然超时或 `clear()` 全清
3. **`getAliveCount()` 每次遍历**: 未缓存计数，高频调用时存在不必要的 O(n) 开销
4. **`loadState` 静默吞错**: catch 块中无日志输出，反序列化失败时难以排查

---

## 三、核心逻辑分析

### 3.1 飘字创建流程

```
add(text, x, y, options?)
  │
  ├─ 1. 合并样式: DEFAULT_STYLE → PRESETS[preset] → options.style
  ├─ 2. 构建 FloatingTextInstance（uid 自增）
  ├─ 3. push 到 instances 数组
  └─ 4. 返回实例引用
```

**评价**: 创建流程清晰，样式合并链路正确。`uid` 自增保证唯一性。返回实例引用允许外部做二次定制，但同时也暴露了内部可变状态。

### 3.2 轨迹运动

5 种轨迹类型的数学模型：

| 轨迹 | X 轴公式 | Y 轴公式 | 适用场景 |
|------|---------|---------|---------|
| `floatUp` | `x + ampX × sin(t×π)` | `y - ampY × t` | 通用伤害/治疗数字 |
| `arcLeft` | `x - ampX × t` | `y - ampY × sin(t×π)` | 左侧伤害来源 |
| `arcRight` | `x + ampX × t` | `y - ampY × sin(t×π)` | 右侧伤害来源 |
| `dropDown` | `x + ampX × sin(t×π)` | `y - ampY × (1-t)` | 掉落物品/金币 |
| `shake` | `x + sin(t×π×8)×ampX` | `y - ampY × t × 0.3` | 暴击/震荡效果 |

**评价**: 轨迹公式合理，覆盖了放置游戏的主要飘字场景。`shake` 使用 `sin(t×π×8)` 产生 4 次完整振荡，效果适中。但所有轨迹的数学模型是**硬编码**的，无法通过配置扩展新轨迹。

### 3.3 生命周期管理

```
创建 (age=0, alive=true)
  │
  ├─ update(dt) → age += dt
  │     ├─ age < duration → 计算轨迹位置
  │     └─ age ≥ duration → alive = false
  │
  └─ update() 末尾 → filter 移除 !alive
```

**评价**: 生命周期管理清晰。使用 `filter` 做惰性清理避免了 `splice` 的 O(n²) 问题。但 `filter` 每帧都创建新数组，在高频场景下有 GC 压力。

### 3.4 渲染管线

```
render(ctx)
  │
  for each alive instance:
  │
  ├─ 1. 计算透明度: 前 60% 全不透明, 后 40% 线性衰减
  ├─ 2. 计算缩放: scaleStart → scaleEnd 线性插值
  ├─ 3. ctx.save()
  ├─ 4. ctx.globalAlpha = alpha
  ├─ 5. ctx.translate + ctx.scale
  ├─ 6. 设置字体 (fontWeight + fontSize + fontFamily)
  ├─ 7. 绘制阴影 (if shadow)
  ├─ 8. 绘制描边 (if strokeColor)
  ├─ 9. 绘制填充文本
  └─ 10. ctx.restore()
```

**评价**: 渲染管线完整且正确，`save/restore` 配对保证了上下文隔离。但存在以下性能隐患：
- 每个飘字都执行完整的 `save/translate/scale/restore` 循环
- `font` 字符串每帧每实例都重新拼接
- 无视口裁剪：屏幕外的飘字仍然渲染

---

## 四、问题清单

### 🔴 严重问题

#### P1: `update()` 每帧 `filter` 创建新数组 — GC 压力

**位置**: `FloatingTextSystem.ts` 第 286 行

```typescript
this.instances = this.instances.filter((inst) => inst.alive);
```

**问题**: 每帧调用 `filter` 都会创建一个新数组。在放置游戏中，游戏循环以 60fps 运行，即使没有飘字死亡，也会每帧分配新数组。当飘字数量大时（如金币雨场景），频繁 GC 可能导致帧率抖动。

**修复建议**: 采用 swap-and-pop 策略，或仅在有死亡实例时才执行清理：

```typescript
update(dt: number): void {
  let hasDead = false;
  for (let i = 0; i < this.instances.length; i++) {
    const inst = this.instances[i];
    if (!inst.alive) { hasDead = true; continue; }
    inst.age += dt;
    if (inst.age >= inst.duration) {
      inst.alive = false;
      hasDead = true;
      continue;
    }
    const t = Math.min(inst.age / inst.duration, 1);
    const easedT = this.applyEasing(t, inst.easing);
    this.computeTrajectory(inst, easedT);
  }
  if (hasDead) {
    // 原地压缩，避免创建新数组
    let writeIdx = 0;
    for (let i = 0; i < this.instances.length; i++) {
      if (this.instances[i].alive) {
        this.instances[writeIdx++] = this.instances[i];
      }
    }
    this.instances.length = writeIdx;
  }
}
```

---

#### P2: `add()` 返回可变实例引用 — 封装性破坏

**位置**: `FloatingTextSystem.ts` 第 238 行

```typescript
return instance;
```

**问题**: `add()` 返回的 `FloatingTextInstance` 是内部可变对象的直接引用。外部代码可以随意修改 `alive`、`age`、`style` 等字段，破坏系统内部一致性。例如：

```typescript
const inst = system.add("100", 0, 0);
inst.alive = false;     // 外部直接修改，系统不知情
inst.duration = -999;   // 注入非法值
```

**修复建议**: 返回只读代理或仅暴露读取接口：

```typescript
// 方案 A: 返回 Readonly 包装
add(text: string, x: number, y: number, options?: FloatingTextOptions): Readonly<FloatingTextInstance> { ... }

// 方案 B: 返回精简的 handle 对象
interface FloatingTextHandle {
  readonly uid: number;
  readonly text: string;
  kill(): void;  // 显式的销毁方法
}
```

---

#### P3: `loadState()` 无类型校验 — 反序列化安全隐患

**位置**: `FloatingTextSystem.ts` 第 339~370 行

```typescript
const data = JSON.parse(json);
this.nextUid = data.nextUid ?? 1;
this.instances = (data.instances ?? []).map((inst: Record<string, unknown>) => {
  // 直接 as 类型断言，无运行时校验
  const instance: FloatingTextInstance = {
    uid: inst.uid as number,
    text: inst.text as string,
    // ...
  };
```

**问题**: 
1. 所有字段都用 `as` 类型断言，无运行时类型校验
2. 恶意或损坏的 JSON 可注入非法值（如 `uid: "hack"`, `duration: NaN`）
3. 缺少必要字段时不会报错，而是产生 `undefined` 运行时崩溃

**修复建议**: 添加运行时校验函数：

```typescript
private validateInstance(raw: unknown): FloatingTextInstance | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.uid !== 'number' || typeof r.text !== 'string') return null;
  if (typeof r.x !== 'number' || typeof r.y !== 'number') return null;
  // ... 校验其他必要字段
  return { /* 构建安全实例 */ };
}
```

---

### 🟡 中等问题

#### P4: `getAliveCount()` 每次遍历 O(n)

**位置**: `FloatingTextSystem.ts` 第 316 行

```typescript
getAliveCount(): number {
  let count = 0;
  for (let i = 0; i < this.instances.length; i++) {
    if (this.instances[i].alive) { count++; }
  }
  return count;
}
```

**问题**: 由于 `update()` 末尾已清理死亡实例，`instances` 数组中理论上全是 `alive=true`。但 `getAliveCount()` 仍遍历检查。如果调用频繁（如 UI 每帧显示飘字数量），造成不必要的性能开销。

**修复建议**: 维护一个 `_aliveCount` 计数器，在 `add()`/`clear()`/`update()` 时更新。

---

#### P5: 缺少视口裁剪 — 屏幕外飘字浪费渲染

**位置**: `FloatingTextSystem.ts` 第 293 行 `render()` 方法

**问题**: `render()` 遍历所有存活飘字并渲染，不检查飘字是否在 Canvas 可视区域内。放置游戏中，场景可能很大（如世界地图），大量屏幕外的飘字会白白消耗渲染资源。

**修复建议**: 添加可选的视口参数：

```typescript
render(ctx: CanvasRenderingContext2D, viewport?: { x: number; y: number; w: number; h: number }): void {
  // 在渲染前检查 currentX/currentY 是否在 viewport 内
}
```

---

#### P6: `PRESETS` 为静态属性，运行时不可扩展

**位置**: `FloatingTextSystem.ts` 第 154 行

```typescript
static readonly PRESETS: Record<string, Partial<FloatingTextStyle>> = { ... };
```

**问题**: `readonly` 修饰符仅 TypeScript 层面防止重赋值，但对象内容仍可修改。更重要的是，下游无法注册自定义预设（如特定活动的"圣诞飘字"样式），只能每次通过 `style` 参数手动指定。

**修复建议**: 添加预设注册方法：

```typescript
static registerPreset(name: string, style: Partial<FloatingTextStyle>): void {
  (this.PRESETS as Record<string, Partial<FloatingTextStyle>>)[name] = style;
}
```

---

#### P7: `saveState()` 序列化了完整 style 对象 — 存储冗余

**位置**: `FloatingTextSystem.ts` 第 325~327 行

```typescript
instances: aliveInstances.map((inst) => ({
  // ...
  style: inst.style,  // 完整的 12 字段样式对象
  // ...
})),
```

**问题**: 每个实例都保存完整的 `style` 对象（12 个字段）。如果使用预设创建的飘字，序列化时可以只存 `preset` 名称，反序列化时再还原，大幅减少存储体积。200 个飘字的序列化数据可能达到 20~30KB。

**修复建议**: 记录创建时的 `preset` 名称，序列化时优先存名称而非完整样式。

---

#### P8: 缺少最大实例数限制 — 潜在内存泄漏

**位置**: `FloatingTextSystem.ts` `add()` 方法

**问题**: 没有最大飘字数量限制。如果游戏逻辑 bug 导致不断创建飘字而不更新（如暂停时仍在 `add`），`instances` 数组会无限增长。

**修复建议**: 添加 `maxInstances` 配置，超出时移除最老的实例：

```typescript
constructor(private maxInstances: number = 500) { ... }
```

---

### 🟢 轻微问题

#### P9: `font` 字符串每帧每实例重复拼接

**位置**: `FloatingTextSystem.ts` 第 307 行

```typescript
const fontStr = `${inst.style.fontWeight} ${inst.style.fontSize}px ${inst.style.fontFamily}`;
ctx.font = fontStr;
```

**问题**: 字体字符串在样式不变时可以缓存。每帧为每个实例拼接字符串是微小的性能浪费。

**修复建议**: 在 `FloatingTextInstance` 中增加 `cachedFontStr` 字段，创建时计算一次。

---

#### P10: 构造函数重复赋值

**位置**: `FloatingTextSystem.ts` 第 228~229 行

```typescript
constructor() {
  this.instances = [];   // 已有字段初始化
  this.nextUid = 1;      // 已有默认值
}
```

**问题**: `instances` 和 `nextUid` 已在字段声明时初始化（第 161、164 行），构造函数中重复赋值。虽然不影响正确性，但代码冗余。

**修复建议**: 移除构造函数中的重复赋值，或使用构造函数参数化。

---

#### P11: `render()` 中透明度计算与 `update()` 中 `t` 计算重复

**位置**: `FloatingTextSystem.ts` 第 296 行 vs 第 278 行

```typescript
// update() 中
const t = Math.min(inst.age / inst.duration, 1);

// render() 中
const t = Math.min(inst.age / inst.duration, 1);
```

**问题**: 同一个 `t` 值在 `update()` 和 `render()` 中各计算一次。虽然开销极小，但违反 DRY 原则。

**修复建议**: 在 `update()` 中将 `t` 缓存到实例上，`render()` 直接读取。

---

#### P12: `EasingType` 和 `TrajectoryType` 缺少 `"custom"` 扩展预留

**位置**: 类型定义区

**问题**: 联合类型是封闭的，无法通过插件机制扩展新的缓动或轨迹类型。如果未来需要添加 "spiral" 轨迹或 "elastic" 缓动，需要修改核心代码。

**修复建议**: 考虑添加自定义轨迹/缓动的注册机制，或将类型改为 `string` 并在运行时校验。

---

## 五、改进建议

### 5.1 短期修复（1~2 天）

| 优先级 | 改进项 | 工作量 | 影响 |
|--------|--------|--------|------|
| 🔴 高 | P1: 替换 `filter` 为原地压缩 | 0.5h | 消除每帧 GC 压力 |
| 🔴 高 | P3: 添加 `loadState` 运行时校验 | 1h | 防止反序列化崩溃 |
| 🟡 中 | P4: 缓存 `aliveCount` | 0.5h | 消除不必要的遍历 |
| 🟡 中 | P8: 添加 `maxInstances` 限制 | 0.5h | 防止内存泄漏 |
| 🟢 低 | P10: 移除构造函数冗余赋值 | 5min | 代码整洁 |

### 5.2 中期优化（1 周）

| 改进项 | 描述 |
|--------|------|
| P2: 封装实例引用 | 返回 `Readonly<FloatingTextInstance>` 或 handle 对象，保护内部状态 |
| P5: 视口裁剪 | `render()` 增加可选 viewport 参数，跳过屏幕外飘字 |
| P6: 预设注册 API | 添加 `registerPreset()` 静态方法，支持下游扩展样式 |
| P7: 序列化优化 | 存储预设名称而非完整样式，减少 60~80% 存储体积 |
| P9: 字体字符串缓存 | 在实例创建时缓存 `font` 字符串 |

### 5.3 长期架构优化

#### 5.3.1 对象池模式

放置游戏中飘字是高频创建/销毁的短生命周期对象。引入对象池可显著减少 GC 压力：

```typescript
class FloatingTextPool {
  private pool: FloatingTextInstance[] = [];
  
  acquire(): FloatingTextInstance { /* 从池中取或新建 */ }
  release(inst: FloatingTextInstance): void { /* 重置并归还池 */ }
}
```

#### 5.3.2 轨迹策略模式

将轨迹计算从 `switch-case` 抽取为可注册的策略对象：

```typescript
interface TrajectoryStrategy {
  compute(inst: FloatingTextInstance, easedT: number): void;
}

// 内置策略
const FloatUpStrategy: TrajectoryStrategy = { ... };

// 自定义策略
FloatingTextSystem.registerTrajectory("spiral", {
  compute(inst, t) { /* 螺旋运动 */ }
});
```

#### 5.3.3 批量渲染优化

对相同样式的飘字进行分组渲染，减少 Canvas 状态切换次数：

```typescript
render(ctx: CanvasRenderingContext2D): void {
  // 按样式分组
  const groups = groupBy(this.instances, inst => inst.style.font);
  for (const [font, group] of groups) {
    ctx.font = font;  // 每组只设置一次
    for (const inst of group) { /* 渲染 */ }
  }
}
```

#### 5.3.4 事件系统

添加飘字生命周期事件，支持外部监听：

```typescript
interface FloatingTextEvents {
  onCreate: (inst: FloatingTextInstance) => void;
  onDeath: (inst: FloatingTextInstance) => void;
  onCull: (count: number) => void;  // 超出上限被裁剪
}
```

---

## 六、放置游戏适配性评估

### 6.1 放置游戏特有场景覆盖

| 场景 | 支持情况 | 说明 |
|------|---------|------|
| 伤害数字 | ✅ 完整 | `damage` 预设 + `floatUp` 轨迹 |
| 治疗数字 | ✅ 完整 | `heal` 预设 + 绿色样式 |
| 金币收益 | ✅ 完整 | `gold` 预设 + `dropDown` 轨迹 |
| 经验获取 | ✅ 完整 | `exp` 预设 |
| 暴击效果 | ✅ 完整 | `crit` 预设 + `shake` 轨迹 + 大字号 |
| 升级提示 | ✅ 完整 | `levelUp` 预设 + 36px 大字 |
| 离线收益展示 | ✅ 完整 | `saveState/loadState` 支持 |
| 金币雨（大量并发） | ⚠️ 一般 | 无批量 API、无上限控制、无对象池 |
| 自动战斗持续飘字 | ⚠️ 一般 | 无视口裁剪、无帧预算控制 |
| 多场景切换 | ⚠️ 一般 | `clear()` 可用但无法暂停/恢复 |

### 6.2 放置游戏关键缺失

1. **帧预算控制**: 无法限制每帧渲染的飘字数量，大量飘字时可能拖慢帧率
2. **合并显示**: 放置游戏中同类数值（如连续金币）应可合并为 "+999" 而非 999 个 "+1"
3. **离线收益飘字**: `loadState` 后所有飘字同时出现，缺少"回放"或"排队"机制
4. **DPS 汇总**: 缺少将高频飘字汇总为 DPS 数值显示的能力

---

## 七、综合评分

| 维度 | 分数 (1~5) | 评语 |
|------|:----------:|------|
| **接口设计** | 4 | API 简洁直观，样式系统灵活，但缺少批量操作和精确移除 |
| **数据模型** | 4 | 类型定义完整，字段设计合理，但实例可变性过强 |
| **核心逻辑** | 4 | 轨迹/缓动/生命周期逻辑正确，但硬编码限制了扩展性 |
| **可复用性** | 5 | 零外部依赖，纯 TypeScript，可移植到任何 Canvas 项目 |
| **性能** | 3 | 每帧 filter 创建新数组、无对象池、无视口裁剪、无帧预算 |
| **测试覆盖** | 5 | 769 行测试覆盖所有公共方法和边界条件，测试/代码比 1.34 |
| **放置游戏适配** | 3 | 基本场景覆盖完整，但缺少批量/合并/帧预算等放置游戏特有优化 |

### 总分: 28 / 35

```
接口设计   ████████░░  4/5
数据模型   ████████░░  4/5
核心逻辑   ████████░░  4/5
可复用性   ██████████  5/5
性能       ██████░░░░  3/5
测试覆盖   ██████████  5/5
放置适配   ██████░░░░  3/5
                    ─────
总计       ████████░░  28/35 (80%)
```

### 评级: **B+ (良好)**

> **总结**: FloatingTextSystem 是一个设计良好、测试充分的飘字子系统。零依赖和纯 TypeScript 实现使其具有极高的可复用性。主要短板在性能优化（每帧 GC、无对象池、无裁剪）和放置游戏深度适配（批量/合并/帧预算）。建议优先修复 P1（GC 压力）和 P3（反序列化安全），中期引入对象池和视口裁剪以支撑放置游戏的高频飘字场景。
