# Responsive R1 仲裁裁决

> Arbiter Agent | 2026-05-01

## 裁决总览

| 挑战 | Builder声称 | Challenger声称 | 裁决 | 理由 |
|------|------------|---------------|------|------|
| CH-1 | P0-1: NaN绕过省电触发 ⚠️ | NaN batteryLevel永不触发省电 | ✅ **P0确认** | 无NaN防护，Auto模式永久失效 |
| CH-2 | P0-3: Math.max(0,NaN)=NaN ⚠️ | 经典NaN防护误区 | ✅ **P0确认** | Math.max(0,NaN)=NaN是ES规范，防护无效 |
| CH-3 | P0-4: 0起始距离Infinity ⚠️ | handlePinchMove Infinity缩放 | ⚠️ **降级为P1** | `> 0`守卫在NaN时为false，实际不产生Infinity，但缩放功能失效 |
| CH-4 | — (Builder遗漏) | NaN绕过<=0守卫 | ✅ **P0确认** | `NaN <= 0` = false是经典模式9案例，返回NaN缩放值 |
| CH-5 | P0-5: null解构崩溃 ⚠️ | null params导致TypeError | ✅ **P0确认** | spread null直接崩溃，运行时P0 |
| CH-6 | — (Builder遗漏) | targetFps=0导致Infinity interval | ✅ **P0确认** | 1000/0=Infinity，永远跳帧，游戏卡死 |
| CH-7 | P1-1: NaN viewport ⚠️ | calculateCanvasScale NaN传播 | ✅ **P1确认** | NaN传播到渲染管线 |
| CH-8 | — (Builder遗漏) | calculateMobileLayout NaN sceneHeight | ✅ **P1确认** | Math.max(0,NaN)=NaN |
| CH-9 | — (Builder遗漏) | pushBreadcrumb空字符串 | ⚠️ **低风险** | 空字符串不影响运行时稳定性 |
| CH-10 | P1-5: null as GestureType ⚠️ | 类型不安全 | ✅ **P1确认** | 运行时返回null但类型声明为GestureType |
| CH-11 | — (Builder遗漏) | NaN targetFps | ✅ **P1确认** | 与CH-6同源，但需在updateConfig入口防护 |
| CH-12 | — (Builder遗漏) | NaN autoTriggerBatteryLevel | ✅ **P1确认** | NaN阈值导致Auto模式失效 |
| CH-13 | P2-1: 双系统省电 ⚠️ | 状态不一致风险 | ✅ **P2确认** | 设计问题，非运行时崩溃 |
| CH-14 | P2-2: 双系统手势 ⚠️ | 逻辑不一致 | ✅ **P2确认** | 设计问题 |
| CH-15 | P2-3: _navDepth不同步 ⚠️ | breadcrumbs长度不一致 | ✅ **P2确认** | 边界问题 |
| CH-16 | P2-4: navigateToBreadcrumb边界 ⚠️ | 越界风险 | ⚠️ **低风险** | 有findIndex保护 |

## 裁决统计

- **P0 确认**: 5个（CH-1, CH-2, CH-4, CH-5, CH-6）
- **P1 确认**: 6个（CH-3降级, CH-7, CH-8, CH-10, CH-11, CH-12）
- **P2 确认**: 3个（CH-13, CH-14, CH-15）
- **低风险**: 2个（CH-9, CH-16）
- **降级**: 1个（CH-3: P0→P1）

## P0 详细裁决

### P0-1 (CH-1): PowerSaveSystem.updateBatteryStatus NaN绕过 — 确认

**证据链**:
1. `powerSave.setLevel(PowerSaveLevel.Auto)` 
2. `powerSave.updateBatteryStatus(NaN, false)`
3. `_batteryLevel = NaN`（无校验，PowerSaveSystem.ts:160）
4. `_updateActiveState()` → `NaN <= 20` = `false` → `isActive = false`
5. 省电模式永不触发

**修复方案**: 
```typescript
updateBatteryStatus(batteryLevel: number, isCharging: boolean): void {
    if (!Number.isFinite(batteryLevel) || batteryLevel < 0 || batteryLevel > 100) return;
    this._batteryLevel = batteryLevel;
    this._isCharging = isCharging;
    if (this._level === PowerSaveLevel.Auto) {
      this._updateActiveState();
    }
}
```

**严重度**: P0-HIGH — 省电模式永久失效

**对称修复**: MobileSettingsSystem.updateBatteryStatus 需要相同修复（CH-2）

---

### P0-2 (CH-2): MobileSettingsSystem.updateBatteryStatus Math.max(0,NaN)=NaN — 确认

**证据链**:
1. `settings.setPowerSaveLevel(PowerSaveLevel.Auto)`
2. `settings.updateBatteryStatus(NaN, false)`
3. `Math.min(100, NaN)` = `NaN` → `Math.max(0, NaN)` = `NaN`（ES规范）
4. `_currentBatteryLevel = NaN`
5. `NaN <= 20` = `false` → 省电模式永不触发

**关键洞察**: 开发者错误地认为 `Math.max(0, Math.min(100, x))` 能防护NaN。实际上 `Math.max(0, NaN) = NaN` 是ES规范定义的行为。这是整个代码库中可能存在的系统性问题。

**修复方案**: 
```typescript
updateBatteryStatus(batteryLevel: number, isCharging: boolean): void {
    if (!Number.isFinite(batteryLevel)) batteryLevel = 100;
    this._currentBatteryLevel = Math.max(0, Math.min(100, batteryLevel));
    this._isCharging = isCharging;
    if (this._powerSaveLevel === PowerSaveLevel.Auto) {
      this._updatePowerSaveState();
    }
}
```

**严重度**: P0-HIGH — 与P0-1相同问题在不同类中

**关联规则**: Builder规则#1（所有数值API入口必须检查NaN）

---

### P0-3 (CH-4): TouchInteractionSystem.handlePinchMove NaN绕过<=0 — 确认

**证据链**:
1. `sys.handlePinchStart(NaN, 1)` → `_pinchStartDistance = NaN`
2. `sys.handlePinchMove(100)` → `NaN <= 0` = `false`（模式9经典案例）
3. 执行 `1 * (100 / NaN)` = `NaN`
4. 返回 NaN 作为缩放比例

**对比分析**: 
- TouchInputSystem 使用 `> 0` 守卫 → `NaN > 0` = `false` → 安全（不执行）
- TouchInteractionSystem 使用 `<= 0` 守卫 → `NaN <= 0` = `false` → **不安全**（继续执行）

**修复方案**:
```typescript
handlePinchMove(distance: number): number {
    if (!Number.isFinite(this._pinchStartDistance) || this._pinchStartDistance <= 0) return this._pinchStartScale;
    return this._pinchStartScale * (distance / this._pinchStartDistance);
}
```

**严重度**: P0-HIGH — NaN缩放值传播到渲染管线

**关联规则**: Builder规则#1, Builder规则#20（对称函数修复验证：TouchInputSystem也需检查）

---

### P0-4 (CH-5): TouchInputSystem.handleFormationTouch null解构崩溃 — 确认

**证据链**:
1. `touchInput.handleFormationTouch(FormationTouchAction.SelectHero, null as any)`
2. `{ action, ...null }` → TypeError: Cannot spread null/undefined
3. 运行时崩溃

**修复方案**:
```typescript
handleFormationTouch(
    action: FormationTouchAction,
    params: { heroId?: string; slotIndex?: number; secondSlotIndex?: number } = {},
): FormationTouchEvent | null {
    const event: FormationTouchEvent = { action, ...params };
    // ...
```

**严重度**: P0-CRITICAL — 运行时崩溃

---

### P0-5 (CH-6): PowerSaveSystem targetFps=0导致Infinity interval — 确认

**证据链**:
1. `powerSave.updateConfig({ targetFps: 0 })`
2. `powerSave.enable()` → `_isActive=true`, `_currentFps=0`
3. `getFrameInterval()` → `1000 / 0` = `Infinity`
4. `shouldSkipFrame(0, 100)` → `100 < Infinity` = `true` → 永远跳帧
5. 游戏完全卡死

**额外场景**: `targetFps=NaN` → `1000/NaN=NaN` → `100 < NaN` = `false` → 永不跳帧（反向问题）

**修复方案**:
```typescript
// 在 updateConfig 中添加校验
updateConfig(config: Partial<PowerSaveConfig>): void {
    if (config.targetFps !== undefined && (!Number.isFinite(config.targetFps) || config.targetFps <= 0)) {
      config.targetFps = POWER_SAVE_FPS; // 回退到安全默认值
    }
    if (config.autoTriggerBatteryLevel !== undefined && 
        (!Number.isFinite(config.autoTriggerBatteryLevel) || config.autoTriggerBatteryLevel < 0 || config.autoTriggerBatteryLevel > 100)) {
      config.autoTriggerBatteryLevel = DEFAULT_POWER_SAVE_CONFIG.autoTriggerBatteryLevel;
    }
    this._config = { ...this._config, ...config };
    this._updateActiveState();
}
```

**严重度**: P0-CRITICAL — targetFps=0导致游戏完全卡死

**对称修复**: MobileSettingsSystem.setPowerSaveConfig 需要相同修复

---

## 评分

### 5维度评分

| 维度 | 权重 | Builder得分 | Challenger得分 | 说明 |
|------|------|------------|---------------|------|
| 完备性 | 25% | 8.0 | 9.0 | Builder覆盖82个API但遗漏CH-4/CH-6 |
| 准确性 | 25% | 8.5 | 9.5 | Builder CH-3虚报为P0（实际P1），Challenger准确 |
| 优先级 | 15% | 8.0 | 9.0 | Builder优先级分配基本合理 |
| 可测试性 | 15% | 9.0 | 9.0 | 所有P0均有明确复现路径 |
| 挑战应对 | 20% | 7.5 | — | Builder遗漏2个P0（CH-4, CH-6） |

### Builder综合评分: 8.2 / 10
### Challenger综合评分: 9.1 / 10

### 封版判断: ❌ 不封版

**理由**: 
1. 5个P0需要修复
2. Builder遗漏2个P0（CH-4, CH-6），完备性不足
3. 需要进入R1 Fix阶段

## FIX穿透分析

| FIX | 直接修复 | 需穿透检查 | 穿透结果 |
|-----|---------|-----------|---------|
| FIX-401 (CH-1) | PowerSaveSystem.updateBatteryStatus | MobileSettingsSystem.updateBatteryStatus | ⚠️ 需同步修复(CH-2) |
| FIX-402 (CH-2) | MobileSettingsSystem.updateBatteryStatus | PowerSaveSystem.updateBatteryStatus | ✅ 已在FIX-401覆盖 |
| FIX-403 (CH-4) | TouchInteractionSystem.handlePinchMove | TouchInputSystem.handlePinchMove | ⚠️ 需同步检查(虽>0守卫安全，但应统一) |
| FIX-404 (CH-5) | TouchInputSystem.handleFormationTouch | TouchInteractionSystem编队方法 | ✅ TouchInteractionSystem使用独立方法，无spread |
| FIX-405 (CH-6) | PowerSaveSystem.updateConfig | MobileSettingsSystem.setPowerSaveConfig | ⚠️ 需同步修复 |

**穿透率**: 3/5 = 60% — 需要补齐穿透修复

## 规则进化建议

### 新增P0模式建议: 模式24 — Math.max/Math.min NaN穿透
- **描述**: `Math.max(0, NaN) = NaN`，`Math.min(100, NaN) = NaN`，开发者常误以为Math.max/min能防护NaN
- **出现频率**: 本次发现1处（MobileSettingsSystem），可能在其他模块中存在
- **检查方法**: 搜索所有 `Math.max(` 和 `Math.min(` 调用，验证输入是否有NaN前置检查
- **修复模式**: 在Math.max/min前添加 `if (!Number.isFinite(x)) x = defaultValue`

### Builder规则补充建议
- 新增规则#23: 所有通过Math.max/Math.min做范围约束的数值，必须先验证NaN（`!Number.isFinite`）
- 新增规则#24: 双系统并存时，修复一个系统时必须同步检查另一个系统的相同方法
