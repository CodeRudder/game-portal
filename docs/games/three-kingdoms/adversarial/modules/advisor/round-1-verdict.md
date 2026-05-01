# Advisor R1 Verdict

> Arbiter: AdversarialArbiter v1.8 | Time: 2026-05-01
> Builder节点: 108 | Challenger P0: 10 | 判定: 10 P0 确认, 0 驳回

---

## 逐项裁决

### P0-001: 双冷却系统语义冲突 — ✅ 确认

**Builder覆盖**: TD-034（双系统一致性）
**Challenger论证**: 充分。源码验证两套冷却语义确实不同：
- AdvisorSystem: `cooldowns[type] = Date.now() + duration`（存结束时间）
- Detector: `cooldowns[type] = Date.now()`（存开始时间）
- dismissSuggestion 写入 until 模式，detectAllTriggers 用 since 模式读取
- **后果**: dismiss 后冷却值被 Detector 误解为"很久以前"（负数差值），冷却立即失效

**裁决**: 🔴 **P0 确认**。这是架构级缺陷，冷却机制完全失效。
**修复方案**: 统一为 until 模式（推荐），修改 Detector.isInCooldown 和 setCooldown。

---

### P0-002: serialize 不保存 allSuggestions — ✅ 确认

**Builder覆盖**: AS-082
**Challenger论证**: 充分。serialize() 确实不包含 allSuggestions，loadSaveData() 也不恢复。
**裁决**: 🔴 **P0 确认**。但需评估设计意图。

**设计评估**: 建议是临时性的（有过期时间），且依赖游戏状态快照重新生成。如果设计意图是"加载后重新生成"，则不算bug。但当前 loadSaveData 后不会自动触发 updateSuggestions，导致加载后建议列表为空直到下次主动调用。

**修复方案**: 在 serialize 中保存 allSuggestions，loadSaveData 中恢复并过滤过期项。备选方案：loadSaveData 后由 Engine 层触发一次 updateSuggestions。

**最终判定**: **确认P0**。serialize 应保存完整状态以符合 BR-014 规则。

---

### P0-003: loadSaveData null/undefined 防护缺失 — ✅ 确认

**Builder覆盖**: AS-084, AS-085
**Challenger论证**: 充分。无任何 null 检查。
**裁决**: 🔴 **P0 确认**。标准 deserialize 覆盖缺陷。

**修复方案**: 入口检查 `if (!data) return;`，对每个字段使用 fallback 默认值。

---

### P0-004: Infinity cooldownUntil 导致永久冷却 — ✅ 确认

**Builder覆盖**: AS-087
**Challenger论证**: 充分。`Date.now() < Infinity` 永远为 true。
**裁决**: 🔴 **P0 确认**。标准 Infinity 序列化风险（BR-019）。

**修复方案**: loadSaveData 中 `Number.isFinite(cd.cooldownUntil)` 验证。

---

### P0-005: NaN dailyCount 绕过每日上限 — ✅ 确认

**Builder覆盖**: AS-025
**Challenger论证**: 充分。`NaN >= 15` 为 false，上限失效。
**裁决**: 🔴 **P0 确认**。标准 NaN 绕过（BR-001）。

**修复方案**: loadSaveData 中 `Number.isFinite(data.dailyCount) && data.dailyCount >= 0` 验证。

---

### P0-006: NaN cooldownEnd 绕过冷却检查 — ✅ 确认

**Builder覆盖**: AS-073
**Challenger论证**: 充分。NaN 是 truthy，`!NaN` 为 false，不触发提前返回。`Date.now() < NaN` 为 false。
**裁决**: 🔴 **P0 确认**。NaN 是 truthy 是 JavaScript 陷阱。

**修复方案**: isInCooldown 中增加 `!Number.isFinite(cooldownEnd)` 检查。

---

### P0-007: detectTriggers/detectAllTriggers null snapshot 崩溃 — ✅ 确认

**Builder覆盖**: AS-012, AS-013, TD-030, TD-031, TD-032
**Challenger论证**: 充分。findOverflowResource 有 null 检查但 detectAllTriggers 没有。
**裁决**: 🔴 **P0 确认**。

**修复方案**: detectAllTriggers 入口 `if (!snapshot) return [];`，对 leavingNpcs/newFeatures 提供 `|| []` 默认值。

---

### P0-008: init 时 deps.eventBus 为 null 崩溃 — ✅ 确认

**Builder覆盖**: AS-003
**Challenger论证**: 充分。直接调用 `.on()` 无 null 检查。
**裁决**: 🔴 **P0 确认**。标准注入点验证（BR-006）。

**修复方案**: `if (this.deps.eventBus?.on)` 可选链调用。

---

### P0-009: executeSuggestion 在 deps 未初始化时崩溃 — ✅ 确认

**Builder覆盖**: AS-055
**Challenger论证**: 充分。`this.deps!` 使用非空断言。
**裁决**: 🔴 **P0 确认**。

**修复方案**: emit 前检查 `this.deps?.eventBus`，未初始化时仅移除建议不 emit。

---

### P0-010: 冷却配置不同步 — ✅ 确认（降级为 P1）

**Builder覆盖**: 无直接对应
**Challenger论证**: 合理但影响有限。
**裁决**: 🟡 **降级为 P1**。虽然配置分散，但只要 P0-001 修复（统一语义），配置不同步的影响有限。不同触发类型有不同冷却时间是合理设计。

**修复方案**: 在 advisor.types.ts 中定义统一的冷却时间配置，两处引用。

---

## 裁决总结

| Challenge | 判定 | 理由 |
|-----------|------|------|
| P0-001 双冷却系统不一致 | 🔴 P0 确认 | 架构级缺陷，冷却完全失效 |
| P0-002 serialize不保存建议 | 🔴 P0 确认 | BR-014 serialize覆盖 |
| P0-003 loadSaveData null防护 | 🔴 P0 确认 | 运行时崩溃 |
| P0-004 Infinity冷却 | 🔴 P0 确认 | BR-019 Infinity序列化 |
| P0-005 NaN dailyCount | 🔴 P0 确认 | BR-001 NaN绕过 |
| P0-006 NaN cooldownEnd | 🔴 P0 确认 | BR-001 NaN绕过 |
| P0-007 null snapshot | 🔴 P0 确认 | 运行时崩溃 |
| P0-008 init null防护 | 🔴 P0 确认 | BR-006 注入点验证 |
| P0-009 executeSuggestion未初始化 | 🔴 P0 确认 | BR-006 注入点验证 |
| P0-010 冷却配置不同步 | 🟡 降级P1 | 影响有限，非崩溃级 |
| **总计** | **9 P0 + 1 P1** | |

## 修复计划

| FIX ID | Challenge | 修复文件 | 修复类型 |
|--------|-----------|---------|---------|
| FIX-501 | P0-001 | AdvisorTriggerDetector.ts | 统一冷却为 until 模式 |
| FIX-502 | P0-002 | AdvisorSystem.ts | serialize/loadSaveData 增加 allSuggestions |
| FIX-503 | P0-003 | AdvisorSystem.ts | loadSaveData null 防护 |
| FIX-504 | P0-004 | AdvisorSystem.ts | loadSaveData Infinity 验证 |
| FIX-505 | P0-005 | AdvisorSystem.ts | loadSaveData NaN 验证 |
| FIX-506 | P0-006 | AdvisorSystem.ts | isInCooldown NaN 验证 |
| FIX-507 | P0-007 | AdvisorTriggerDetector.ts | detectAllTriggers null 防护 |
| FIX-508 | P0-008 | AdvisorSystem.ts | init null 防护 |
| FIX-509 | P0-009 | AdvisorSystem.ts | executeSuggestion 未初始化防护 |
| FIX-510 | P0-010 | advisor.types.ts | 统一冷却时间配置（P1） |

## 覆盖率评分

| 维度 | 评分 | 说明 |
|------|------|------|
| Normal flow | 65/100 | 基本流程有隐含覆盖，但无直接测试 |
| Boundary conditions | 20/100 | 无边界测试（上限、冷却、过期） |
| Error paths | 10/100 | 无 null/NaN/undefined 错误路径测试 |
| Cross-system | 40/100 | EventBus/Save 链路有设计但未验证 |
| Data lifecycle | 30/100 | serialize/loadSaveData 有实现但缺失严重 |
| **综合** | **33/100** | |

## R2 建议

1. 修复所有 9 个 P0 后进行 R2 回归验证
2. 补充单元测试覆盖核心 API
3. P0-001（双冷却）修复后需重点验证冷却行为一致性
4. P0-002（serialize建议列表）需确认 Engine 层调用链完整性
5. 检查 engine-save.ts 是否已接入 AdvisorSystem 的 serialize/loadSaveData
