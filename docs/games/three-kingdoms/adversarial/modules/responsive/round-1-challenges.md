# Responsive R1 挑战书（重审版）

> Challenger Agent | 2026-05-02 | 基于已修复源码重新审查

## 挑战总览

| # | 挑战目标 | 挑战类型 | 严重度 | 状态 |
|---|---------|---------|--------|------|
| CH-1 | PowerSaveSystem.shouldSkipFrame NaN timestamp | P0遗漏 | P0 | ✅ Builder已识别(P0-1) |
| CH-2 | PowerSaveSystem.updateBatteryStatus >100无上限 | P0遗漏 | P0 | ✅ Builder已识别(P0-2) |
| CH-3 | TouchInteractionSystem._recognizeTap null as GestureType | P0遗漏 | P0 | ✅ Builder已识别(P0-3) |
| CH-4 | MobileSettingsSystem.updateBatteryStatus >100不一致 | P0穿透 | P0 | ⚠️ Builder遗漏 |
| CH-5 | TouchInputSystem.handlePinchStart NaN distance存储 | P1穿透 | P1 | ⚠️ Builder遗漏 |
| CH-6 | MobileLayoutManager.updateBottomSheetHeight NaN传播 | P1遗漏 | P1 | ⚠️ Builder遗漏 |
| CH-7 | ResponsiveLayoutManager.updateViewport NaN viewportWidth存储 | P1遗漏 | P1 | ⚠️ Builder遗漏 |
| CH-8 | TouchInteractionSystem.handlePinchStart NaN scale存储 | P1穿透 | P1 | ⚠️ Builder遗漏 |

---

## 挑战详情

### CH-1: PowerSaveSystem.shouldSkipFrame NaN timestamp → ✅ Builder已识别

**Builder声称**: P0-1，NaN timestamp导致永不跳帧，省电失效

**Challenger验证**: ✅ 确认

**证据链**:
1. `powerSave.enable()` → `_isActive=true`, `_currentFps=30`
2. `powerSave.shouldSkipFrame(NaN, 1000)` → `interval = 1000/30 ≈ 33.3`
3. `1000 - NaN = NaN` → `NaN < 33.3 = false` → 不跳帧
4. 省电模式下帧率控制完全失效

**源码验证** (PowerSaveSystem.ts:247-249):
```typescript
shouldSkipFrame(lastFrameTime: number, currentTime: number): boolean {
    const interval = this.getFrameInterval();
    return currentTime - lastFrameTime < interval;
}
```
无任何NaN防护。

**裁决**: P0-HIGH — 省电模式帧率控制核心路径失效

---

### CH-2: PowerSaveSystem.updateBatteryStatus >100无上限 → ✅ Builder已识别

**Builder声称**: P0-2，batteryLevel>100无上限钳制

**Challenger验证**: ✅ 确认，但需补充穿透分析

**证据链**:
1. `powerSave.updateBatteryStatus(999, false)` → 通过 `!Number.isFinite(999) || 999 < 0` 检查
2. `_batteryLevel = 999`（无Math.min(100,...)钳制）
3. `batteryLevel` getter 返回 999，下游系统可能误用

**穿透分析**: MobileSettingsSystem.updateBatteryStatus 使用 `Math.max(0, Math.min(100, batteryLevel))` 有上限钳制。两个系统行为不一致：
- PowerSaveSystem: `batteryLevel=999` → 存储999
- MobileSettingsSystem: `batteryLevel=999` → 存储100

**裁决**: P0-MEDIUM — 数据完整性问题 + 双系统不一致

---

### CH-3: TouchInteractionSystem._recognizeTap null as GestureType → ✅ Builder已识别

**Builder声称**: P0-3，类型欺骗导致运行时行为与类型声明不一致

**Challenger验证**: ✅ 确认

**源码验证** (TouchInteractionSystem.ts:252):
```typescript
private _recognizeTap(endPoint: TouchPoint, now: number): GestureType {
    // ...
    if (this.shouldBounce(now)) return null as unknown as GestureType;  // 类型欺骗
    // ...
}
```

**额外发现**: `handleTouchEnd` 的返回类型是 `GestureType | null`，所以调用方可以正确处理null。但 `_recognizeTap` 的签名返回 `GestureType`（非null），这违反了TypeScript的类型安全。如果未来有人对 `_recognizeTap` 的返回值做类型窄化（如switch语句），会导致遗漏null分支。

**裁决**: P0-MEDIUM — 类型安全违规

---

### CH-4: MobileSettingsSystem.updateBatteryStatus NaN回退策略不一致 → ⚠️ Builder遗漏

**问题**: FIX-402将NaN回退到100（满电），而FIX-401（PowerSaveSystem）对NaN直接return（拒绝更新）。两个系统的NaN处理策略完全不同：

| 系统 | NaN处理 | 效果 |
|------|---------|------|
| PowerSaveSystem | `return`（拒绝） | 保持原值 |
| MobileSettingsSystem | `batteryLevel = 100` | 回退到满电 |

**场景**: 
1. 初始状态：两个系统都是 `_batteryLevel = null/100`
2. 调用 `updateBatteryStatus(NaN, false)` 
3. PowerSaveSystem: 保持原值（null）
4. MobileSettingsSystem: 设为100
5. 如果先收到合法值50，再收到NaN：
   - PowerSaveSystem: 保持50
   - MobileSettingsSystem: 变为100

**严重度评估**: P0-MEDIUM — 两个并存系统对相同输入产生不同状态，违反一致性原则（Builder规则#4: 双系统并存时必须验证切换完整性）

**裁决建议**: P0 — 双系统数据不一致

---

### CH-5: TouchInputSystem.handlePinchStart NaN distance存储 → ⚠️ Builder遗漏

**问题**: `handlePinchStart(x1, y1, x2, y2)` 计算两点距离 `_pinchStartDistance = _calcTwoPointDistance(x1, y1, x2, y2)`，但无NaN输入校验。

**源码验证** (TouchInputSystem.ts:118-119):
```typescript
handlePinchStart(x1: number, y1: number, x2: number, y2: number): void {
    this._pinchStartDistance = this._calcTwoPointDistance(x1, y1, x2, y2);
}
```

如果 `x1=NaN`，则 `_pinchStartDistance = NaN`。后续 `handlePinchMove` 中：
```typescript
const currentDist = this._calcTwoPointDistance(x1, y1, x2, y2);
if (this._pinchStartDistance > 0) {  // NaN > 0 = false → 安全，不执行
```

**分析**: TouchInputSystem的 `> 0` 守卫天然防护NaN（`NaN > 0 = false`），不会产生Infinity。但 `_pinchStartDistance` 存储了NaN值，如果后续有代码直接读取此值（如序列化），会产生问题。

**严重度**: P1 — 当前安全但数据不干净，且与TouchInteractionSystem的防护模式不一致

---

### CH-6: MobileLayoutManager.updateBottomSheetHeight NaN传播 → ⚠️ Builder遗漏

**源码验证** (MobileLayoutManager.ts:110):
```typescript
updateBottomSheetHeight(contentHeight: number): void {
    if (this._sheet.isOpen) this._sheet.contentHeight = contentHeight;
}
```

`contentHeight=NaN` 被直接存储，无校验。影响下游渲染系统使用 `_sheet.contentHeight` 布局。

**严重度**: P1 — NaN传播到渲染层

---

### CH-7: ResponsiveLayoutManager.updateViewport NaN viewportWidth存储 → ⚠️ Builder遗漏

**源码验证** (ResponsiveLayoutManager.ts:78-84):
```typescript
updateViewport(width: number, height: number, devicePixelRatio = 1): boolean {
    const prev = this._bp;
    this._vw = width; this._vh = height; this._dpr = devicePixelRatio;
    // ...
}
```

`width=NaN, height=NaN` 被直接存储到 `_vw/_vh`。后续所有依赖 `_vw/_vh` 的计算（calculateCanvasScale、calculateWhitespace等）都会传播NaN。

**严重度**: P1 — NaN从入口传播到所有下游计算

---

### CH-8: TouchInteractionSystem.handlePinchStart NaN scale存储 → ⚠️ Builder遗漏

**源码验证** (TouchInteractionSystem.ts:100-102):
```typescript
handlePinchStart(distance: number, currentScale: number): void {
    this._pinchStartDistance = distance;
    this._pinchStartScale = currentScale;
}
```

`distance=NaN` 或 `currentScale=NaN` 被直接存储。虽然 `handlePinchMove` 有 `!Number.isFinite(this._pinchStartDistance)` 防护（FIX-403），但 `_pinchStartScale` 无防护。如果 `_pinchStartScale=NaN`，`handlePinchMove` 返回 `NaN * (distance / validStart)` = NaN。

**复现**:
```typescript
sys.handlePinchStart(100, NaN);  // _pinchStartScale = NaN
sys.handlePinchMove(200);         // NaN * (200/100) = NaN → 返回NaN缩放值
```

**严重度**: P1 — NaN缩放值传播到渲染管线（但需先通过handlePinchStart注入NaN scale）

---

## 挑战统计

| 严重度 | Builder已识别 | Builder遗漏 | 合计 |
|--------|-------------|------------|------|
| P0 | 3 | 1 (CH-4) | 4 |
| P1 | 0 | 4 (CH-5~8) | 4 |
| 合计 | 3 | 5 | 8 |

## 对Builder的评价

### 优点
1. 正确识别了shouldSkipFrame NaN问题（P0-1）
2. 发现了updateBatteryStatus >100不一致（P0-2）
3. 识别了_recognizeTap类型安全问题（P0-3）
4. API覆盖率100%，F-Normal维度完整

### 不足
1. **遗漏CH-4**: 双系统NaN处理策略不一致是P0级问题，Builder仅标记为P0-2的子描述，未独立评级
2. **遗漏CH-5~8**: 4个P1级NaN传播问题未在P1节点中列出
3. **跨系统分析不足**: C-3/C-4链路标记了⚠️但未深入追踪具体的数值不一致
4. **穿透验证不完整**: FIX-401/FIX-402的修复策略差异未被发现
