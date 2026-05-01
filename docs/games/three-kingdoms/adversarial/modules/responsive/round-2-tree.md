# Responsive R2 测试树（Builder）

> Builder Agent | 2026-05-01 | R2 精简封版轮

## R2 策略

R1 修复 5 个 P0（FIX-401~405），R2 目标：验证修复完整性 + 精简残留树 + 9.0 封版判定。

**精简原则**：
- P0 已修复 → 收缩为回归验证节点（不展开子树）
- P1 未修复但低风险 → 降级为监控节点
- P2 设计问题 → 标记为 backlog，不阻塞封版

---

## 1. FIX 回归验证树（5 节点，不展开）

| FIX | 修复点 | 回归验证 | 状态 |
|-----|--------|---------|------|
| FIX-401 | PowerSaveSystem.updateBatteryStatus NaN/负值防护 | `updateBatteryStatus(NaN, false)` → 静默忽略 ✅ | ✅ 已验证 |
| FIX-402 | MobileSettingsSystem.updateBatteryStatus Math.max(0,NaN)防护 | `updateBatteryStatus(NaN, false)` → 回退100 ✅ | ✅ 已验证 |
| FIX-403 | TouchInteractionSystem.handlePinchMove NaN绕过<=0防护 | `handlePinchStart(NaN,1); handlePinchMove(100)` → 返回 startScale ✅ | ✅ 已验证 |
| FIX-404 | TouchInputSystem.handleFormationTouch null解构防护 | `handleFormationTouch(action, null)` → 不崩溃，默认空对象 ✅ | ✅ 已验证 |
| FIX-405 | PowerSaveSystem+MobileSettingsSystem targetFps=0/NaN防护 | `updateConfig({targetFps:0})` → 回退30 ✅ | ✅ 已验证 |

### 源码验证矩阵

| FIX | 文件 | 行号 | 守卫代码 | 验证 |
|-----|------|------|---------|------|
| FIX-401 | PowerSaveSystem.ts | L170 | `if (!Number.isFinite(batteryLevel) \|\| batteryLevel < 0) return;` | ✅ |
| FIX-402 | MobileSettingsSystem.ts | L123 | `if (!Number.isFinite(batteryLevel)) batteryLevel = 100;` | ✅ |
| FIX-403 | TouchInteractionSystem.ts | L153 | `if (!Number.isFinite(this._pinchStartDistance) \|\| this._pinchStartDistance <= 0)` | ✅ |
| FIX-404 | TouchInputSystem.ts | L195-196 | `params: {...} = {}` 默认参数 | ✅ |
| FIX-405a | PowerSaveSystem.ts | L186-191 | targetFps + autoTriggerBatteryLevel 双重校验 | ✅ |
| FIX-405b | MobileSettingsSystem.ts | L149-154 | targetFps + autoTriggerBatteryLevel 双重校验 | ✅ |

---

## 2. 穿透完整性验证

R1 Arbiter 指出穿透率 60%，Fixer 已补齐。R2 重新验证：

| 修复 | 直接文件 | 穿透目标 | 穿透状态 | 验证方法 |
|------|---------|---------|---------|---------|
| FIX-401 | PowerSaveSystem.updateBatteryStatus | MobileSettingsSystem.updateBatteryStatus | ✅ FIX-402 同步修复 | 源码 L123 |
| FIX-402 | MobileSettingsSystem.updateBatteryStatus | PowerSaveSystem.updateBatteryStatus | ✅ FIX-401 同步修复 | 源码 L170 |
| FIX-403 | TouchInteractionSystem.handlePinchMove | TouchInputSystem.handlePinchMove | ✅ 天然安全（>0 守卫） | 源码验证 |
| FIX-404 | TouchInputSystem.handleFormationTouch | TouchInteractionSystem 编队方法 | ✅ 无 spread 操作 | 源码验证 |
| FIX-405a | PowerSaveSystem.updateConfig | MobileSettingsSystem.setPowerSaveConfig | ✅ FIX-405b 同步修复 | 源码 L149-154 |
| FIX-405b | MobileSettingsSystem.setPowerSaveConfig | PowerSaveSystem.updateConfig | ✅ FIX-405a 同步修复 | 源码 L186-191 |

**穿透率**: 6/6 = **100%**（R1 为 60%，Fixer 已补齐所有穿透路径）

---

## 3. 残留 P1 监控节点（6 项，不阻塞封版）

R1 确认 6 个 P1，均为非崩溃性问题，标记为监控项：

| # | P1 | 影响 | 风险评估 | 建议 |
|---|-----|------|---------|------|
| P1-1 (CH-3↓) | TouchInputSystem.handlePinchMove 0起始距离 | 缩放失效，不崩溃 | 低 — `>0` 守卫阻止 NaN 传播 | R3 统一守卫模式 |
| P1-2 (CH-7) | ResponsiveLayoutManager.calculateCanvasScale NaN viewport | NaN 传播到渲染管线 | 中 — 但调用方 updateViewport 有校验 | R3 入口防护 |
| P1-3 (CH-8) | MobileLayoutManager.calculateMobileLayout NaN vh | NaN sceneHeight | 低 — 调用方有 viewport 校验 | R3 入口防护 |
| P1-4 (CH-10) | TouchInteractionSystem._recognizeTap null as GestureType | 类型不安全 | 低 — 运行时实际不返回 null | R3 类型收窄 |
| P1-5 (CH-11) | PowerSaveSystem.updateConfig NaN targetFps | 与 FIX-405 同源 | ✅ **已随 FIX-405 修复** | 可关闭 |
| P1-6 (CH-12) | MobileSettingsSystem.setPowerSaveConfig NaN autoTriggerBatteryLevel | 与 FIX-405 同源 | ✅ **已随 FIX-405 修复** | 可关闭 |

**关键发现**: P1-5 (CH-11) 和 P1-6 (CH-12) 已被 FIX-405 的 `autoTriggerBatteryLevel` 校验一并修复。实际残留 P1 = 4 项。

---

## 4. P2 Backlog（3 项，设计层面）

| # | P2 | 类型 | 建议 |
|---|-----|------|------|
| P2-1 (CH-13) | 双系统省电状态不一致 | 架构设计 | 重构为单一 PowerSaveManager |
| P2-2 (CH-14) | 双系统手势逻辑不一致 | 架构设计 | 统一 TouchInput 接口 |
| P2-3 (CH-15) | _navDepth 与 breadcrumbs 不同步 | 边界问题 | 添加同步断言 |

---

## 5. R2 精简树统计

| 指标 | R1 | R2 | 变化 |
|------|-----|-----|------|
| P0 活跃 | 5 | **0** | -5（全部修复） |
| P1 活跃 | 6 | **4** | -2（随 FIX-405 修复） |
| P2 活跃 | 3 | **3** | 不变（backlog） |
| 穿透率 | 60% | **100%** | +40% |
| 测试节点 | 82 API × 5 维度 | 5 FIX 回归 + 4 P1 监控 | 精简 95% |

---

## 6. 封版建议

**Builder 建议**: ✅ 封版

理由：
1. 5 个 P0 全部修复并源码验证通过
2. 穿透率 100%，无遗漏路径
3. 残留 4 个 P1 均为非崩溃性，不阻塞发布
4. P2 为架构设计问题，纳入 backlog
5. 虚报率 0%（R1 Builder 虚报 CH-3 为 P0 已被 Arbiter 降级为 P1，R2 不重复）
