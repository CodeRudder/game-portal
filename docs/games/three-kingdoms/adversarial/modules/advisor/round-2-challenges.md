# Advisor R2 Challenges

> Challenger: AdversarialChallenger v2.0 | Time: 2026-05-02
> 基于 R2 Tree（61 节点）+ R1 修复穿透验证

---

## 1. FIX 穿透完整性验证

### 1.1 FIX-501 冷却统一穿透 — ✅ 完整

**验证**: AdvisorTriggerDetector.ts L40-41 已改为 until 模式，`!Number.isFinite(cooldownEnd)` 防护到位。AdvisorSystem.isInCooldown L281 同步使用 until 模式 + NaN 防护。两处语义完全一致。

**残留风险**: 无。

### 1.2 FIX-502 serialize suggestions — ✅ 完整

**验证**: serialize() L304 输出 `suggestions` 字段，loadSaveData() L336-343 恢复并过滤过期项。过滤条件 `s && s.id && (s.expiresAt == null || s.expiresAt > now)` 合理。

**残留风险**: 无。

### 1.3 FIX-503 null 防护 — ✅ 完整

**验证**: L318 `if (!data) return;` 入口防护。cooldowns L328 `data.cooldowns || []` 默认值。

**残留风险**: 无。

### 1.4 FIX-504 Infinity 防护 — ✅ 完整

**验证**: L330 `Number.isFinite(cd.cooldownUntil) && cd.cooldownUntil > 0` 双重验证。

**残留风险**: 无。

### 1.5 FIX-505 NaN dailyCount — ✅ 完整

**验证**: L322 loadSaveData 入口 + L179 updateSuggestions 运行时双重防护。

**残留风险**: 无。

### 1.6 FIX-506 isInCooldown NaN — ✅ 完整

**验证**: L281 `!Number.isFinite(cooldownEnd)` 在 AdvisorSystem.isInCooldown。Detector 侧 L41 同步。

**残留风险**: 无。

### 1.7 FIX-507 detectAllTriggers null — ✅ 完整

**验证**: L91 `if (!snapshot) return [];`，L114/132/141 `|| []` 默认值。

**残留风险**: 无。

### 1.8 FIX-508 init null — ✅ 完整

**验证**: L136 `this.deps.eventBus?.on(...)` 可选链。

**残留风险**: 无。

### 1.9 FIX-509 executeSuggestion 未初始化 — ✅ 完整

**验证**: L246 `this.deps?.eventBus?.emit(...)` 双重可选链。

**残留风险**: 无。

---

## 2. R2 新维度探索

### CH-2.01: npc_leaving 多 NPC 冷却粒度问题 — 🟡 P1

**维度**: Normal flow / 业务逻辑

**发现**: detectAllTriggers 中，npc_leaving 冷却是按 `triggerType` 而非按 `npcId` 粒度。当多个 NPC 同时离开时：
```typescript
for (const npc of leavingNpcs) {
  if (!isInCooldown(state, 'npc_leaving')) {  // 所有 NPC 共享同一冷却
    suggestions.push(createSuggestion('npc_leaving', ...));
  }
}
```
- 第一个 NPC 触发后，后续所有 NPC 都被跳过（因为 `npc_leaving` 冷却已设置）
- **但**: AdvisorSystem.updateSuggestions 中同类型去重 (`some(s => s.triggerType === suggestion.triggerType)`) 也会跳过后续
- **结论**: 行为一致，但**只生成第一个离开 NPC 的建议**，后续 NPC 被忽略
- **影响**: 玩家可能错过重要限时 NPC

**严重度**: P1 — 设计决策，非崩溃。建议 R3 评估是否需要按 NPC ID 粒度冷却。

### CH-2.02: new_feature_unlock 同理 — 🟡 P1

**维度**: Normal flow / 业务逻辑

**发现**: 与 CH-2.01 相同的问题。多个新功能同时解锁时只生成第一个的建议。

**严重度**: P1 — 同上。

### CH-2.03: dismissSuggestion 冷却值溢出 — 🟢 P2

**维度**: Boundary conditions

**发现**: `Date.now() + ADVISOR_CLOSE_COOLDOWN_MS` 理论上可能溢出（`Date.now()` 接近 `Number.MAX_SAFE_INTEGER` 时）。但实际场景中 `Date.now()` 约 1.7×10¹²，远低于 `MAX_SAFE_INTEGER`（9×10¹⁵），加 30 分钟不影响。

**严重度**: P2 — 理论风险，实际不可能。

### CH-2.04: serialize 中 suggestions 浅拷贝 — 🟢 P2

**维度**: Data lifecycle

**发现**: serialize 中 `this.state.allSuggestions.map(s => ({ ...s }))` 是浅拷贝。如果 AdvisorSuggestion 包含嵌套对象（如 `metadata: Record<string, any>`），则嵌套引用共享。但当前 AdvisorSuggestion 类型全是原始类型字段（id, triggerType, title, description, actionLabel, actionTarget, confidence, priority, createdAt, expiresAt, relatedId），无嵌套对象。

**严重度**: P2 — 当前类型安全，未来扩展需注意。

### CH-2.05: loadSaveData 不验证 suggestions 中 triggerType 合法性 — 🟡 P1

**维度**: Error paths

**发现**: loadSaveData 恢复 suggestions 时只检查 `s && s.id && (s.expiresAt == null || s.expiresAt > now)`，不验证 `s.triggerType` 是否在合法的 `AdvisorTriggerType` 范围内。恶意/损坏存档可注入非法 triggerType，后续 `isInCooldown` 使用非法 key 时不会崩溃（Record<string, number> 允许任意 key），但 `ADVISOR_TRIGGER_PRIORITY[illegalType]` 返回 undefined，可能导致 priority 为 undefined。

**严重度**: P1 — 存档篡改风险，但正常运行不触发。

**建议修复**: loadSaveData 中增加 `Object.values(ADVISOR_TRIGGER_PRIORITY).includes(s.triggerType)` 白名单验证。

### CH-2.06: getDisplayState 返回的 dailyCount 未做 NaN 防护 — 🟢 P2

**维度**: Error paths

**发现**: getDisplayState 直接返回 `this.state.dailyCount`，虽然 loadSaveData 和 updateSuggestions 都有 NaN 防护，但如果有代码路径直接修改 `state.dailyCount` 为 NaN（如外部模块通过 getState() 获取引用后修改），getDisplayState 会返回 NaN。

**严重度**: P2 — getState() 返回浅拷贝，外部修改不影响内部 state。风险极低。

### CH-2.07: suggestionCounter 模块级变量 — 🟡 P1（R1 已记录为 P1-001）

**维度**: Cross-system

**发现**: `suggestionCounter` 是模块级 `let` 变量（非类成员），`reset()` 中重置。多实例场景下所有实例共享同一计数器，导致 ID 冲突。但当前引擎设计为单实例，风险可控。

**严重度**: P1 — 已知限制，非 R2 封版阻塞。

### CH-2.08: detectTriggers 委托给 detectAllTriggers 但 snapshot null 防护重复 — 🟢 P2

**维度**: Cross-system

**发现**: detectTriggers 调用 detectAllTriggers，后者已有 `if (!snapshot) return [];` 防护。detectTriggers 本身无 null 检查，但委托层已防护。双重防护不造成问题。

**严重度**: P2 — 无风险，代码风格问题。

### CH-2.09: findOverflowResource 阈值 — 0.8 vs 0.9 不一致（R1 已记录为 P1-005）

**维度**: Boundary conditions

**发现**: AdvisorTriggerDetector.findOverflowResource 使用 `> 0.8`，AdvisorSystem.findOverflowResource（私有方法）也使用 `> 0.8`。两处一致。R1 中提到的 0.9 是误报（源码确认两处都是 0.8）。

**严重度**: 无 — R1 P1-005 可关闭。

### CH-2.10: updateSuggestions 中 candidates 可能为空数组但不影响 — 🟢 P2

**维度**: Normal flow

**发现**: `detectTriggers(snapshot)` 在 snapshot 正常但无触发条件时返回空数组，for 循环不执行。这是正常行为。

**严重度**: 无 — 正常行为。

---

## 3. R2 修复回归验证

### 3.1 P0-001 双冷却系统 — 回归通过 ✅

统一为 until 模式后：
- dismissSuggestion 设置 `cooldowns[type] = Date.now() + CLOSE_COOLDOWN`（until）
- isInCooldown 检查 `Date.now() < cooldownEnd`（until）
- Detector.isInCooldown 同步使用 until 模式
- **一致性**: ✅ 完全一致

### 3.2 P0-002 serialize 建议 — 回归通过 ✅

- serialize 输出 suggestions
- loadSaveData 恢复并过滤过期
- **往返一致性**: ✅

### 3.3 P0-003~009 null/NaN/Infinity 防护 — 回归通过 ✅

所有防护点已验证穿透，无遗漏。

---

## 4. Challenge 总结

| # | Challenge | 维度 | 严重度 | R2处理 |
|---|-----------|------|--------|--------|
| CH-2.01 | npc_leaving 冷却粒度 | Normal flow | 🟡 P1 | 记录，R3评估 |
| CH-2.02 | new_feature_unlock 冷却粒度 | Normal flow | 🟡 P1 | 记录，R3评估 |
| CH-2.03 | dismissSuggestion 冷却溢出 | Boundary | 🟢 P2 | 理论风险 |
| CH-2.04 | serialize 浅拷贝 | Data lifecycle | 🟢 P2 | 当前安全 |
| CH-2.05 | loadSaveData triggerType 白名单 | Error paths | 🟡 P1 | 记录，R3修复 |
| CH-2.06 | getDisplayState dailyCount NaN | Error paths | 🟢 P2 | 风险极低 |
| CH-2.07 | suggestionCounter 全局变量 | Cross-system | 🟡 P1 | 已知限制 |
| CH-2.08 | detectTriggers null 防护重复 | Cross-system | 🟢 P2 | 无风险 |
| CH-2.09 | findOverflowResource 阈值 | Boundary | 无 | R1误报关闭 |
| CH-2.10 | updateSuggestions 空候选 | Normal flow | 无 | 正常行为 |

**P0 发现: 0**（R1 全部修复，无新 P0）
**P1 发现: 4**（CH-2.01, CH-2.02, CH-2.05, CH-2.07）
**P2 发现: 4**（CH-2.03, CH-2.04, CH-2.06, CH-2.08）
**关闭: 2**（CH-2.09 误报, CH-2.10 正常行为）

---

## 5. 封版建议

**R2 封版判定**: ✅ **可封版**

理由：
1. R1 全部 9 个 P0 修复已穿透验证通过
2. R2 无新 P0 发现
3. 4 个 P1 均为设计优化项，非崩溃/数据损坏级别
4. 4 个 P2 为理论风险，正常运行不触发
5. 核心功能链路完整：触发检测 → 建议生成 → 展示 → 执行/关闭 → 序列化/反序列化
6. 防护体系完整：null/NaN/Infinity/未初始化 全覆盖
