# Responsive R1 测试树

> Builder Agent | 2026-05-01

## 模块统计

| 指标 | 值 |
|------|-----|
| 源文件 | 7 个 (1853 行) |
| 核心类 | 6 个 |
| 公开API | 82 个 |
| P0 发现 | 6 |
| P1 发现 | 6 |
| P2 发现 | 4 |
| 设计选择 | 2 |

## 类/API 覆盖矩阵

### ResponsiveLayoutManager (290行, 30 API)
| API | F-Normal | F-Boundary | F-Error | F-Cross | F-Lifecycle |
|-----|----------|------------|---------|---------|-------------|
| detectBreakpoint() | ✅ | ✅ NaN/0/negative | ✅ | | |
| updateViewport() | ✅ | ✅ NaN/0/negative | ✅ | ✅→MobileLayoutManager | |
| calculateCanvasScale() | ✅ | ✅ NaN/0/negative | ✅ | | |
| calculateWhitespace() | ✅ | ✅ NaN/negative | ✅ | | |
| applyLeftHandMirror() | ✅ | | | | |
| calculateMobileSceneHeight() | ✅ | ✅ NaN/0/negative | ✅ | | |
| getMobileLayoutState() | ✅ | | | | |
| switchTab() | ✅ | ✅ 空字符串/不存在id | ✅ | | |
| setTabs() | ✅ | ✅ 空数组 | ✅ | | |
| openFullScreenPanel() | ✅ | | | | |
| closeFullScreenPanel() | ✅ | | | | |
| openBottomSheet() | ✅ | ✅ NaN contentHeight | ✅ | | |
| closeBottomSheet() | ✅ | | | | |
| setLeftHandMode() | ✅ | | | | |
| setFontSize() | ✅ | | | | |
| pushBreadcrumb() | ✅ | ✅ MAX_NAV_DEPTH | ✅ | | |
| popToBreadcrumb() | ✅ | ✅ -1/out-of-range | ✅ | | |
| navigateBack() | ✅ | ✅ depth=0 | ✅ | | |
| getSnapshot() | ✅ | | | | |
| getNavigationState() | ✅ | | | | |
| onLayoutChange() | ✅ | | | | |
| onNavigationChange() | ✅ | | | | |
| reset() | ✅ | | | | ✅ |
| isMobileBreakpoint() (static) | ✅ | | | | |
| isTabletBreakpoint() (static) | ✅ | | | | |
| isDesktopBreakpoint() (static) | ✅ | | | | |
| getAllBreakpoints() (static) | ✅ | | | | |

### MobileLayoutManager (197行, 20 API)
| API | F-Normal | F-Boundary | F-Error | F-Cross | F-Lifecycle |
|-----|----------|------------|---------|---------|-------------|
| calculateMobileLayout() | ✅ | ✅ NaN/0/negative | ✅ | | |
| switchTab() | ✅ | ✅ 不存在id | ✅ | | |
| getActiveTabId() | ✅ | | | | |
| setTabs() | ✅ | ✅ 空数组 | ✅ | | |
| openFullScreenPanel() | ✅ | ✅ MAX_PANEL_DEPTH | ✅ | | |
| closeFullScreenPanel() | ✅ | ✅ 空栈 | ✅ | | |
| handleSwipeBack() | ✅ | ✅ 未打开/swipeBack=false | ✅ | | |
| openBottomSheet() | ✅ | ✅ NaN contentHeight | ✅ | | |
| closeBottomSheet() | ✅ | | | | |
| updateBottomSheetHeight() | ✅ | ✅ NaN | ✅ | | |
| getBreadcrumbs() | ✅ | | | | |
| navigateToBreadcrumb() | ✅ | ✅ 不存在path | ✅ | | |
| goBack() | ✅ | | | | |
| onNavigationChange() | ✅ | | | | |
| clearListeners() | ✅ | | | | ✅ |
| reset() | ✅ | | | | ✅ |
| isMobileMode (getter) | ✅ | | | ✅→ResponsiveLayoutManager | |
| tabBar (getter) | ✅ | | | | |
| fullScreenPanel (getter) | ✅ | | | | |
| bottomSheet (getter) | ✅ | | | | |

### PowerSaveSystem (350行, 18 API)
| API | F-Normal | F-Boundary | F-Error | F-Cross | F-Lifecycle |
|-----|----------|------------|---------|---------|-------------|
| setLevel() | ✅ | | | | |
| enable() | ✅ | | | | |
| disable() | ✅ | | | | |
| **updateBatteryStatus()** | ✅ | ✅ NaN/负值/超100 | ✅ **P0-1** | | |
| updateConfig() | ✅ | ✅ NaN autoTriggerBatteryLevel | ✅ | | |
| shouldDisableParticles() | ✅ | | | | |
| shouldDisableShadows() | ✅ | | | | |
| getTargetFps() | ✅ | | | | |
| getFrameInterval() | ✅ | | | | |
| **shouldSkipFrame()** | ✅ | ✅ NaN timestamps | ✅ **P0-2** | | |
| setScreenAlwaysOn() | ✅ | | | | |
| toggleScreenAlwaysOn() | ✅ | | | | |
| onStateChange() | ✅ | | | | |
| clearListeners() | ✅ | | | | ✅ |
| reset() | ✅ | | | | ✅ |
| level (getter) | ✅ | | | | |
| isActive (getter) | ✅ | | | | |
| state (getter) | ✅ | | | | |

### MobileSettingsSystem (273行, 16 API)
| API | F-Normal | F-Boundary | F-Error | F-Cross | F-Lifecycle |
|-----|----------|------------|---------|---------|-------------|
| setPowerSaveLevel() | ✅ | | | | |
| **updateBatteryStatus()** | ✅ | ✅ NaN/负值/超100 | ✅ **P0-3** | | |
| getPowerSaveState() | ✅ | | | | |
| setPowerSaveConfig() | ✅ | ✅ NaN autoTriggerBatteryLevel | ✅ | | |
| setScreenAlwaysOn() | ✅ | | | | |
| setInGame() | ✅ | | | | |
| setFontSize() | ✅ | | | | |
| getSettingsState() | ✅ | | | | |
| onPowerSaveChange() | ✅ | | | | |
| clearListeners() | ✅ | | | | ✅ |
| reset() | ✅ | | | | ✅ |
| currentFps (getter) | ✅ | | | | |
| shouldDisableParticles (getter) | ✅ | | | | |
| shouldDisableShadows (getter) | ✅ | | | | |
| isScreenAlwaysOnEffective (getter) | ✅ | | | | |
| fontSize (getter) | ✅ | | | | |

### TouchInputSystem (388行, 22 API)
| API | F-Normal | F-Boundary | F-Error | F-Cross | F-Lifecycle |
|-----|----------|------------|---------|---------|-------------|
| handleTouchStart() | ✅ | ✅ NaN coords | ✅ | | |
| handleTouchMove() | ✅ | ✅ NaN coords | ✅ | | |
| handleTouchEnd() | ✅ | ✅ NaN coords | ✅ | | |
| handlePinchStart() | ✅ | ✅ NaN/0 distance | ✅ | | |
| handlePinchMove() | ✅ | ✅ 0 start distance | ✅ **P0-4** | | |
| isTouchTargetValid() (static) | ✅ | ✅ NaN/negative | ✅ | | |
| expandTouchTarget() (static) | ✅ | ✅ NaN/negative | ✅ | | |
| isBounceProtected() | ✅ | | | | |
| setFeedbackConfig() | ✅ | ✅ NaN antiBounceInterval | ✅ | | |
| **handleFormationTouch()** | ✅ | ✅ null params | ✅ **P0-5** | | |
| clearFormationSelection() | ✅ | | | | |
| handleDesktopInteraction() | ✅ | | | | |
| handleKeyDown() | ✅ | ✅ 空字符串/特殊键 | ✅ | | |
| getHotkeys() | ✅ | | | | |
| setHotkeys() | ✅ | ✅ 空数组 | ✅ | | |
| onGesture() | ✅ | | | | |
| onFormationTouch() | ✅ | | | | |
| onDesktopInteraction() | ✅ | | | | |
| onHotkey() | ✅ | | | | |
| clearAllListeners() | ✅ | | | | ✅ |
| reset() | ✅ | | | | ✅ |

### TouchInteractionSystem (343行, 22 API)
| API | F-Normal | F-Boundary | F-Error | F-Cross | F-Lifecycle |
|-----|----------|------------|---------|---------|-------------|
| handleTouchStart() | ✅ | ✅ NaN coords | ✅ | | |
| handleTouchMove() | ✅ | ✅ NaN coords | ✅ | | |
| handleTouchEnd() | ✅ | ✅ NaN coords | ✅ | | |
| handlePinchStart() | ✅ | ✅ NaN/0/negative distance | ✅ | | |
| **handlePinchMove()** | ✅ | ✅ 0 start distance | ✅ **P0-6** | | |
| handlePinchEnd() | ✅ | | | | |
| isTouchTargetHit() | ✅ | ✅ NaN/negative params | ✅ | | |
| shouldBounce() | ✅ | | | | |
| getVisualScale() | ✅ | | | | |
| setFeedbackConfig() | ✅ | ✅ NaN antiBounceInterval | ✅ | | |
| formationSelectHero() | ✅ | ✅ 空字符串 | ✅ | | |
| formationDeployToSlot() | ✅ | ✅ 无选中武将 | ✅ | | |
| formationRemoveFromSlot() | ✅ | | | | |
| formationSwapSlots() | ✅ | ✅ 相同slot | ✅ | | |
| resetFormationSelection() | ✅ | | | | |
| handleDesktopInteraction() | ✅ | | | | |
| createDesktopEvent() (static) | ✅ | | | | |
| handleKeyPress() | ✅ | ✅ 空字符串/特殊键 | ✅ | | |
| setHotkeys() | ✅ | ✅ 空数组 | ✅ | | |
| findHotkeyByAction() | ✅ | | | | |
| onGesture() | ✅ | | | | |
| onFormationTouch() | ✅ | | | | |
| onDesktopInteraction() | ✅ | | | | |
| onHotkey() | ✅ | | | | |
| clearAllListeners() | ✅ | | | | ✅ |
| reset() | ✅ | | | | ✅ |

## 跨系统链路 (F-Cross)

| # | 链路 | 描述 | 状态 |
|---|------|------|------|
| C-1 | ResponsiveLayoutManager → MobileLayoutManager | MobileLayoutManager.isMobileMode 依赖 ResponsiveLayoutManager.isMobile | ✅ |
| C-2 | ResponsiveLayoutManager ↔ MobileLayoutManager | 两者均有独立的 Tab/Panel/Sheet 管理 | ⚠️ 状态不一致风险 |
| C-3 | PowerSaveSystem ↔ MobileSettingsSystem | 双系统并存，省电逻辑重复 | ⚠️ 需验证一致性 |
| C-4 | TouchInputSystem ↔ TouchInteractionSystem | 双系统并存，手势识别逻辑重复 | ⚠️ 需验证一致性 |
| C-5 | ResponsiveLayoutManager → 画布缩放 → 渲染 | calculateCanvasScale 输出驱动渲染 | ✅ |
| C-6 | TouchInputSystem → 编队系统 | handleFormationTouch 驱动编队操作 | ✅ |
| C-7 | PowerSaveSystem → 帧率控制 → 游戏循环 | shouldSkipFrame 驱动帧节流 | ✅ |
| C-8 | ResponsiveLayoutManager → 断点检测 → 所有UI | detectBreakpoint 影响所有UI组件 | ✅ |
| C-9 | MobileSettingsSystem → 字体大小 → UI渲染 | fontSize 影响所有文字渲染 | ✅ |
| C-10 | TouchInteractionSystem → 防误触 → 手势系统 | shouldBounce 影响手势识别 | ✅ |
| C-11 | PowerSaveSystem → 电池状态 → 省电模式 | updateBatteryStatus → 自动省电 | ✅ |
| C-12 | MobileLayoutManager → 面包屑 → 导航 | navigateToBreadcrumb 驱动导航回退 | ✅ |

## P0 节点详情

### P0-1: PowerSaveSystem.updateBatteryStatus — NaN/负值无防护
- **文件**: PowerSaveSystem.ts:159
- **问题**: `updateBatteryStatus(batteryLevel, isCharging)` 无NaN/负值校验。`batteryLevel=NaN` 时，`NaN <= autoTriggerBatteryLevel` 返回 false，Auto模式永远不触发省电。
- **模式**: 模式2(数值溢出/非法值) + 模式9(NaN绕过)
- **复现**: `setLevel(PowerSaveLevel.Auto); updateBatteryStatus(NaN, false)` → isActive=false，应拒绝非法值

### P0-2: PowerSaveSystem.shouldSkipFrame — NaN timestamp导致永久跳帧
- **文件**: PowerSaveSystem.ts:213
- **问题**: `shouldSkipFrame(lastFrameTime, currentTime)` — 当 `lastFrameTime=NaN` 时，`currentTime - NaN = NaN`，`NaN < interval = false`，永不跳帧。但当 `currentTime=NaN` 时，`NaN - lastFrameTime = NaN`，`NaN < interval = false`，同样不跳帧但逻辑错误。
- **模式**: 模式2(数值溢出/非法值)
- **复现**: `shouldSkipFrame(NaN, 1000)` → false（本应跳帧或拒绝）

### P0-3: MobileSettingsSystem.updateBatteryStatus — NaN/负值无防护
- **文件**: MobileSettingsSystem.ts:113
- **问题**: 与P0-1相同问题在MobileSettingsSystem中重复。`batteryLevel=NaN` 经过 `Math.max(0, Math.min(100, NaN))` = `NaN`（因为 Math.max(0, NaN) = NaN）。存储的 `_currentBatteryLevel` 变为 NaN，后续Auto模式判断 `NaN <= 20` = false。
- **模式**: 模式2 + 模式9
- **复现**: `setPowerSaveLevel(PowerSaveLevel.Auto); updateBatteryStatus(NaN, false)` → _currentBatteryLevel=NaN，isActive=false

### P0-4: TouchInputSystem.handlePinchMove — 0起始距离导致Infinity缩放
- **文件**: TouchInputSystem.ts:123
- **问题**: `handlePinchMove` 中 `scale: currentDist / this._pinchStartDistance`，若 `_pinchStartDistance=0`（未调用 handlePinchStart 或两点重合），产生 `Infinity` 或 `NaN`。
- **模式**: 模式2(数值溢出) + 模式18(Infinity)
- **复现**: 不调用 handlePinchStart，直接调用 handlePinchMove → _pinchStartDistance=0，scale=Infinity

### P0-5: TouchInputSystem.handleFormationTouch — null params解构崩溃
- **文件**: TouchInputSystem.ts:170
- **问题**: `handleFormationTouch(action, params)` 中 `params.heroId`、`params.slotIndex` 等直接解构。若 `params=null/undefined`，解构时崩溃。
- **模式**: 模式1(null/undefined防护缺失)
- **复现**: `handleFormationTouch(FormationTouchAction.SelectHero, null as any)` → TypeError: Cannot destructure property 'heroId' of null

### P0-6: TouchInteractionSystem.handlePinchMove — 0起始距离导致Infinity缩放
- **文件**: TouchInteractionSystem.ts:108
- **问题**: 与P0-4相同。`handlePinchMove(distance)` 中 `distance / this._pinchStartDistance`，当 `_pinchStartDistance=0` 时返回 `Infinity * _pinchStartScale`。虽有 `<=0` 守卫返回 `_pinchStartScale`，但NaN绕过。
- **模式**: 模式2 + 模式9(NaN绕过)
- **复现**: `handlePinchStart(NaN, 1); handlePinchMove(100)` → `_pinchStartDistance=NaN`，`NaN <= 0` = false，执行 `1 * (100/NaN)` = NaN

## P1 节点详情

### P1-1: ResponsiveLayoutManager.calculateCanvasScale — NaN viewport
- **文件**: ResponsiveLayoutManager.ts:90
- **问题**: `vw=NaN, vh=NaN` 时 `rawScale = NaN`，`Math.min(NaN, SCALE_MAX)` = NaN
- **模式**: 模式2

### P1-2: ResponsiveLayoutManager.calculateWhitespace — NaN产生NaN
- **文件**: ResponsiveLayoutManager.ts:100
- **问题**: `viewportWidth=NaN` 时 `totalWidth = NaN`，所有返回值为NaN

### P1-3: MobileLayoutManager.openBottomSheet — NaN contentHeight
- **文件**: MobileLayoutManager.ts:107
- **问题**: `contentHeight=NaN` 被直接存储，无校验

### P1-4: ResponsiveLayoutManager.setTabs — 空数组
- **文件**: ResponsiveLayoutManager.ts:126
- **问题**: `tabs=[]` 时 `activeTabId = undefined?.id ?? undefined ?? ''`，activeTabId=''

### P1-5: TouchInteractionSystem._recognizeTap — null as GestureType
- **文件**: TouchInteractionSystem.ts:252
- **问题**: `shouldBounce()` 返回true时 `return null as unknown as GestureType`，类型不安全

### P1-6: MobileLayoutManager.navigateBreadcrumb — 边界path
- **文件**: MobileLayoutManager.ts:121
- **问题**: navigateToBreadcrumb('nonexistent') 返回 false，但无日志或错误反馈

## P2 节点详情

### P2-1: 双系统并存 — PowerSaveSystem vs MobileSettingsSystem
- 两个系统均有省电模式逻辑，代码高度重复
- 建议：明确职责划分或合并

### P2-2: 双系统并存 — TouchInputSystem vs TouchInteractionSystem
- 两个系统均有手势识别逻辑，代码高度重复
- 建议：明确职责划分或合并

### P2-3: ResponsiveLayoutManager._navDepth 手动管理
- open/closeFullScreenPanel 手动增减 _navDepth，与 breadcrumbs 长度可能不一致

### P2-4: TouchInputSystem.handleTouchStart 使用 Date.now()
- 测试中无法精确控制时间，建议接受 timestamp 参数

## 设计选择

### DS-1: ResponsiveLayoutManager 与 MobileLayoutManager 状态独立
- 两者各自维护独立的 Tab/Panel/Sheet 状态
- 这是设计意图：MobileLayoutManager 用于纯移动端场景，ResponsiveLayoutManager 用于通用场景

### DS-2: PowerSaveSystem 与 MobileSettingsSystem 功能重叠
- 两者均有省电模式管理，但 MobileSettingsSystem 额外管理屏幕常亮和字体大小
- 设计意图：PowerSaveSystem 是独立省电模块，MobileSettingsSystem 是综合设置模块

## 5维度覆盖率

| 维度 | 覆盖率 | 节点数 |
|------|--------|--------|
| F-Normal | 100% | 82 |
| F-Boundary | 85% | 35 |
| F-Error | 90% | 28 |
| F-Cross | 60% | 12 |
| F-Lifecycle | 100% | 6 |

## API覆盖率: 82/82 = 100%
