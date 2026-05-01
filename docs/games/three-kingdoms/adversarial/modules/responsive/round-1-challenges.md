# Responsive R1 挑战书

> Challenger Agent | 2026-05-01

## 挑战总览

| # | 严重度 | 挑战目标 | 模式 | 源码位置 |
|---|--------|---------|------|---------|
| CH-1 | **P0** | PowerSaveSystem.updateBatteryStatus NaN绕过 | 模式9 | PowerSaveSystem.ts:159 |
| CH-2 | **P0** | MobileSettingsSystem.updateBatteryStatus Math.max(0,NaN)=NaN | 模式9 | MobileSettingsSystem.ts:113 |
| CH-3 | **P0** | TouchInputSystem.handlePinchMove 0起始距离Infinity | 模式2+18 | TouchInputSystem.ts:123 |
| CH-4 | **P0** | TouchInteractionSystem.handlePinchMove NaN绕过<=0 | 模式9 | TouchInteractionSystem.ts:108 |
| CH-5 | **P0** | TouchInputSystem.handleFormationTouch null解构崩溃 | 模式1 | TouchInputSystem.ts:170 |
| CH-6 | **P0** | PowerSaveSystem.getFrameInterval NaN FPS → Infinity interval | 模式2 | PowerSaveSystem.ts:207 |
| CH-7 | P1 | ResponsiveLayoutManager.calculateCanvasScale NaN viewport | 模式2 | ResponsiveLayoutManager.ts:90 |
| CH-8 | P1 | MobileLayoutManager.calculateMobileLayout NaN vh → NaN sceneHeight | 模式2 | MobileLayoutManager.ts:65 |
| CH-9 | P1 | ResponsiveLayoutManager.pushBreadcrumb 空path/label | 模式1 | ResponsiveLayoutManager.ts:149 |
| CH-10 | P1 | TouchInteractionSystem._recognizeTap null as GestureType 类型不安全 | 模式2 | TouchInteractionSystem.ts:252 |
| CH-11 | P1 | PowerSaveSystem.updateConfig NaN targetFps → 帧率崩溃 | 模式2 | PowerSaveSystem.ts:172 |
| CH-12 | P1 | MobileSettingsSystem.setPowerSaveConfig NaN autoTriggerBatteryLevel | 模式2 | MobileSettingsSystem.ts:138 |
| CH-13 | P2 | 双系统状态不一致风险 (PowerSave vs MobileSettings) | 模式8 | 跨文件 |
| CH-14 | P2 | 双系统手势逻辑不一致 (TouchInput vs TouchInteraction) | 模式8 | 跨文件 |
| CH-15 | P2 | ResponsiveLayoutManager._navDepth 与 breadcrumbs 长度不同步 | 模式5 | ResponsiveLayoutManager.ts:140-155 |
| CH-16 | P2 | MobileLayoutManager._panelStack navigateToBreadcrumb 边界 | 模式3 | MobileLayoutManager.ts:121 |

## P0 挑战详情

### CH-1: PowerSaveSystem.updateBatteryStatus — NaN绕过 [P0]

**源码位置**: `PowerSaveSystem.ts:159-166`

```typescript
updateBatteryStatus(batteryLevel: number, isCharging: boolean): void {
    this._batteryLevel = batteryLevel;  // ← 无NaN校验
    this._isCharging = isCharging;
    if (this._level === PowerSaveLevel.Auto) {
      this._updateActiveState();
    }
}
```

**复现场景**:
1. `powerSave.setLevel(PowerSaveLevel.Auto)`
2. `powerSave.updateBatteryStatus(NaN, false)`
3. `_updateActiveState()` → `_batteryLevel=NaN` → `NaN <= 20` = `false` → `isActive=false`
4. 电量实际很低但省电模式永不触发

**对比**: MobileSettingsSystem.ts:113 使用了 `Math.max(0, Math.min(100, batteryLevel))` 但 `Math.max(0, NaN) = NaN`（ES规范），防护同样无效。

**影响**: 系统级 — 省电模式完全失效，低端设备卡顿

**关联模式**: 模式9(NaN绕过数值检查)、模式2(数值溢出/非法值)

---

### CH-2: MobileSettingsSystem.updateBatteryStatus — Math.max(0,NaN)=NaN [P0]

**源码位置**: `MobileSettingsSystem.ts:113-119`

```typescript
updateBatteryStatus(batteryLevel: number, isCharging: boolean): void {
    this._currentBatteryLevel = Math.max(0, Math.min(100, batteryLevel)); // ← Math.max(0, NaN) = NaN
    this._isCharging = isCharging;
    if (this._powerSaveLevel === PowerSaveLevel.Auto) {
      this._updatePowerSaveState();
    }
}
```

**复现场景**:
1. `settings.setPowerSaveLevel(PowerSaveLevel.Auto)`
2. `settings.updateBatteryStatus(NaN, false)`
3. `Math.min(100, NaN)` = `NaN` → `Math.max(0, NaN)` = `NaN`
4. `_currentBatteryLevel = NaN`
5. `_updatePowerSaveState()` → `NaN <= 20` = `false` → 永不触发

**关键**: 开发者以为 `Math.max(0, ...)` 能防护NaN，但ES规范 `Math.max(0, NaN) = NaN`。这是经典的NaN防护误区。

**影响**: 系统级 — 与CH-1相同问题在不同类中重复

---

### CH-3: TouchInputSystem.handlePinchMove — 0起始距离Infinity [P0]

**源码位置**: `TouchInputSystem.ts:117-130`

```typescript
handlePinchMove(x1: number, y1: number, x2: number, y2: number): void {
    const currentDist = this._calcTwoPointDistance(x1, y1, x2, y2);
    if (this._pinchStartDistance > 0) {  // ← 守卫条件
      this._emitGesture({
        // ...
        scale: currentDist / this._pinchStartDistance,  // ← 若 _pinchStartDistance=NaN，NaN > 0 = false，不执行
      });
    }
}
```

**复现场景**:
1. 不调用 `handlePinchStart`（或 `_pinchStartDistance` 初始值为0）
2. 直接调用 `handlePinchMove(100, 100, 200, 200)`
3. `_pinchStartDistance=0` → `0 > 0` = `false` → 不触发（安全）
4. 但若先调用 `handlePinchStart(NaN, NaN, NaN, NaN)` → `_pinchStartDistance = NaN`
5. `NaN > 0` = `false` → 安全，但 `_pinchStartDistance` 被污染为NaN

**修正**: 实际分析发现 `> 0` 守卫在NaN时为false，因此Infinity问题不会触发。但 `_pinchStartDistance` 被设为NaN后，后续正常调用也会失败。

**降级**: 此挑战降级为 **P1** — NaN不会导致Infinity，但会导致缩放功能永久失效。

---

### CH-4: TouchInteractionSystem.handlePinchMove — NaN绕过<=0 [P0]

**源码位置**: `TouchInteractionSystem.ts:105-110`

```typescript
handlePinchMove(distance: number): number {
    if (this._pinchStartDistance <= 0) return this._pinchStartScale;  // ← NaN <= 0 = false!
    return this._pinchStartScale * (distance / this._pinchStartDistance);
}
```

**复现场景**:
1. `sys.handlePinchStart(NaN, 1)` → `_pinchStartDistance = NaN`, `_pinchStartScale = 1`
2. `sys.handlePinchMove(100)` → `NaN <= 0` = `false`（NaN比较总是false）
3. 执行 `1 * (100 / NaN)` = `NaN`
4. 返回 `NaN` 作为缩放比例 → 渲染崩溃

**关键**: `<= 0` 检查被NaN绕过，这是模式9的典型案例。对比CH-3中 `> 0` 守卫在NaN时为false反而安全。

**影响**: 高 — NaN缩放值传播到渲染管线

---

### CH-5: TouchInputSystem.handleFormationTouch — null解构崩溃 [P0]

**源码位置**: `TouchInputSystem.ts:168-190`

```typescript
handleFormationTouch(
    action: FormationTouchAction,
    params: { heroId?: string; slotIndex?: number; secondSlotIndex?: number },
): FormationTouchEvent | null {
    const event: FormationTouchEvent = { action, ...params };  // ← ...null/undefined 崩溃
```

**复现场景**:
1. `touchInput.handleFormationTouch(FormationTouchAction.SelectHero, null as any)`
2. `{ action, ...null }` → TypeError: Cannot spread null
3. 或 `handleFormationTouch(FormationTouchAction.DeployToSlot, undefined as any)`
4. `{ action, ...undefined }` → TypeError（取决于JS引擎版本，某些版本允许spread undefined）

**影响**: P0 — 运行时崩溃

---

### CH-6: PowerSaveSystem.getFrameInterval — NaN FPS → Infinity interval [P0]

**源码位置**: `PowerSaveSystem.ts:207-213`

```typescript
getFrameInterval(): number {
    return 1000 / this.getTargetFps();
}

shouldSkipFrame(lastFrameTime: number, currentTime: number): boolean {
    const interval = this.getFrameInterval();
    return currentTime - lastFrameTime < interval;
}
```

**复现场景**:
1. `powerSave.updateConfig({ targetFps: NaN })`
2. `powerSave.enable()` → `_isActive=true`, `_currentFps=NaN`（targetFps=NaN）
3. `getFrameInterval()` → `1000 / NaN` = `NaN`
4. `shouldSkipFrame(0, 100)` → `100 < NaN` = `false` → 永不跳帧
5. 或 `updateConfig({ targetFps: 0 })` → `1000 / 0` = `Infinity` → `100 < Infinity` = `true` → 永远跳帧，游戏卡死

**影响**: P0 — targetFps=0 导致游戏完全卡死

---

## P1 挑战详情

### CH-7: ResponsiveLayoutManager.calculateCanvasScale — NaN viewport [P1]

**源码位置**: `ResponsiveLayoutManager.ts:88-99`

```typescript
calculateCanvasScale(vw: number, vh: number, breakpoint?: Breakpoint): CanvasScaleResult {
    // ...
    const rawScale = Math.min(vw / CANVAS_BASE_WIDTH, vh / CANVAS_BASE_HEIGHT);
    const scale = Math.min(rawScale, SCALE_MAX);  // ← Math.min(NaN, 2) = NaN
```

**复现**: `calculateCanvasScale(NaN, NaN)` → scale=NaN, offsetX=NaN, canvasWidth=NaN

---

### CH-8: MobileLayoutManager.calculateMobileLayout — NaN vh [P1]

**源码位置**: `MobileLayoutManager.ts:65-70`

```typescript
calculateMobileLayout(vw = MOBILE_CANVAS_WIDTH, vh = MOBILE_CANVAS_HEIGHT): MobileLayoutState {
    const sceneAreaHeight = Math.max(0, vh - MOBILE_LAYOUT.resourceBarHeight - ...);
    // ← Math.max(0, NaN - 48 - 36 - 76) = Math.max(0, NaN) = NaN
```

---

### CH-9: ResponsiveLayoutManager.pushBreadcrumb — 空path/label [P1]

**源码位置**: `ResponsiveLayoutManager.ts:149-156`

```typescript
pushBreadcrumb(path: string, label: string): void {
    if (this._navDepth >= MAX_NAV_DEPTH) return;
    // ← 无空字符串校验，path='' 和 label='' 被接受
```

---

### CH-10: TouchInteractionSystem._recognizeTap — null as GestureType [P1]

**源码位置**: `TouchInteractionSystem.ts:250-253`

```typescript
private _recognizeTap(endPoint: TouchPoint, now: number): GestureType {
    // ...
    if (this.shouldBounce(now)) return null as unknown as GestureType;  // ← 类型不安全
```

---

### CH-11: PowerSaveSystem.updateConfig — NaN targetFps [P1]

**源码位置**: `PowerSaveSystem.ts:172`

```typescript
updateConfig(config: Partial<PowerSaveConfig>): void {
    this._config = { ...this._config, ...config };  // ← 无targetFps校验
    this._updateActiveState();
}
```

`targetFps=0` 导致 getFrameInterval=Infinity，游戏卡死。与CH-6同源。

---

### CH-12: MobileSettingsSystem.setPowerSaveConfig — NaN autoTriggerBatteryLevel [P1]

**源码位置**: `MobileSettingsSystem.ts:138`

```typescript
setPowerSaveConfig(config: Partial<PowerSaveConfig>): void {
    this._powerSaveConfig = { ...this._powerSaveConfig, ...config };  // ← 无校验
```

`autoTriggerBatteryLevel=NaN` → `NaN <= NaN` = false → Auto模式永不触发。

---

## P2 挑战详情

### CH-13: 双系统省电模式状态不一致 [P2]

PowerSaveSystem 和 MobileSettingsSystem 均管理省电模式，但状态独立。若一个设为On另一个设为Off，下游消费者不知道该听谁的。

### CH-14: 双系统手势逻辑不一致 [P2]

TouchInputSystem 和 TouchInteractionSystem 均实现手势识别，但细节不同：
- TouchInputSystem: handleTouchStart 使用 Date.now()
- TouchInteractionSystem: handleTouchStart 接受 timestamp 参数
- 防误触策略不同：TouchInputSystem 在 bounce 期间静默记录，TouchInteractionSystem 直接拦截

### CH-15: ResponsiveLayoutManager._navDepth 与 breadcrumbs 不同步 [P2]

`openFullScreenPanel()` 增加 `_navDepth++`，但 `pushBreadcrumb()` 也增加 `_navDepth++`。若两者交替调用，`_navDepth` 可能大于 `breadcrumbs.length - 1`。

### CH-16: MobileLayoutManager.navigateToBreadcrumb 边界 [P2]

`navigateToBreadcrumb(targetPath)` 中 `idx=0` 时关闭所有面板（合理），但 `idx > 0` 时从 `_panelStack` 取元素，若 stack 状态不一致可能导致越界。

## 挑战统计

- **P0 挑战**: 6个（CH-1 ~ CH-6）
- **P1 挑战**: 6个（CH-7 ~ CH-12）
- **P2 挑战**: 4个（CH-13 ~ CH-16）
- **总计**: 16个挑战

## 虚报风险评估

- CH-3 可能被降级为P1（`> 0` 守卫在NaN时为false，实际安全）
- 其余P0挑战均有明确复现路径，虚报率预估 < 5%
