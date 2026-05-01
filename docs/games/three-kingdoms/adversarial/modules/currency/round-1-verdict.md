# Currency 模块 — Round 1 Arbiter 裁决

> **Arbiter 视角** | 综合 Builder Tree + Challenger 质询  
> 裁决时间: 2026-05-02 | 裁决版本: R1-Final

---

## 裁决总览

| 指标 | 值 |
|------|-----|
| Builder 发现 P0 | 8 |
| Challenger 新增 P0 | 6 |
| Arbiter 最终 P0 | **10** |
| Arbiter 最终 P1 | **7** |
| 需代码修复 | **7 个 P0** |
| 需测试补充 | **3 个 P0** |
| 架构问题（记录） | **1 个** |

---

## P0 裁决（按严重度排序）

### FIX-CU-001: `addCurrency` NaN 绕过 `amount <= 0` 检查
- **来源**: C-F2-01 (Challenger 发现，Builder CU-P0-02 分析错误)
- **严重度**: **CRITICAL** ⛔
- **根因**: `if (amount <= 0)` 中 `NaN <= 0` 为 false，NaN 绕过检查
- **影响**: wallet[type] 被设为 NaN，后续所有操作异常
- **修复方案**: 在 `addCurrency` 入口增加 `!Number.isFinite(amount) \|\| amount <= 0` 检查
- **穿透验证**: 同步检查 `spendCurrency`、`setCurrency`、`spendByPriority`、`exchange`、`checkAffordability`、`getShortage` 所有数值入口
- **BR 规则**: BR-01, BR-21

### FIX-CU-002: `spendCurrency` NaN 绕过检查
- **来源**: C-F2-02 (Challenger 发现)
- **严重度**: **CRITICAL** ⛔
- **根因**: 同 FIX-CU-001，`NaN <= 0` 为 false
- **影响**: wallet[type] 被设为 NaN
- **修复方案**: 同 FIX-CU-001 统一修复
- **穿透验证**: 与 FIX-CU-001 合并

### FIX-CU-003: `setCurrency` NaN/Infinity 无防护
- **来源**: Builder CU-P0-01/CU-P0-05
- **严重度**: **CRITICAL** ⛔
- **根因**: `Math.max(0, NaN) = NaN`，`Math.max(0, Infinity) = Infinity`
- **影响**: wallet 被设为 NaN 或 Infinity
- **修复方案**: `setCurrency` 入口增加 `!Number.isFinite(amount)` 检查，NaN→0，Infinity→cap 或 MAX_SAFE_INTEGER
- **穿透验证**: `deserialize` 调用 `setCurrency`，需确认 deserialize 的数据源防护

### FIX-CU-004: `exchange` NaN 绕过所有检查
- **来源**: C-F2-06 (Challenger 发现)
- **严重度**: **CRITICAL** ⛔
- **根因**: `balance < NaN` 为 false，`Math.floor(NaN * rate)` = NaN
- **影响**: 两个货币同时被设为 NaN
- **修复方案**: `exchange` 入口增加 `!Number.isFinite(amount) \|\| amount <= 0` 检查
- **穿透验证**: 检查 `getExchangeRate` 返回 NaN 的场景

### FIX-CU-005: `checkAffordability` NaN 误判为可负担
- **来源**: C-F2-04 (Challenger 发现)
- **严重度**: **HIGH** 🔴
- **根因**: `NaN <= 0` 为 false → 不跳过，`balance < NaN` 为 false → 不认为不足
- **影响**: 调用方认为可负担，后续 spend 操作失败或 wallet 污染
- **修复方案**: `checkAffordability` 中增加 `!Number.isFinite(amount)` 检查
- **穿透验证**: 检查所有调用 `checkAffordability` 的上层代码

### FIX-CU-006: `addCurrency` Infinity 导致无上限货币溢出
- **来源**: C-F2-07 (Challenger 发现)
- **严重度**: **HIGH** 🔴
- **根因**: `Infinity > 0` 为 true，无上限货币 `before + Infinity = Infinity`
- **影响**: copper/mandate/expedition/guild/ingot 余额变 Infinity
- **修复方案**: 与 FIX-CU-001 合并，统一使用 `!Number.isFinite(amount)` 检查
- **穿透验证**: 确认 `!Number.isFinite` 同时拦截 NaN 和 Infinity

### FIX-CU-007: `deserialize` null/undefined/NaN 防护缺失
- **来源**: Builder CU-P0-06/CU-P0-07 + C-F3-03 (Challenger)
- **严重度**: **HIGH** 🔴
- **根因**: 无 null/undefined 入口检查，无 NaN 值过滤
- **影响**: 运行时崩溃或 wallet 被污染
- **修复方案**: `deserialize` 入口增加 null/undefined 防护 + setCurrency 内部 NaN 防护（FIX-CU-003）
- **穿透验证**: 检查 engine 的 `applySaveData` 是否有外层防护

### FIX-CU-008: `spendByPriority` costs 中 NaN 金额静默忽略
- **来源**: C-F2-05 (Challenger 发现)
- **严重度**: **HIGH** 🔴
- **根因**: `NaN <= 0` 为 false → 不跳过，但 `Math.min(NaN, balance) = NaN`，`NaN > 0` 为 false → 不扣除
- **影响**: 静默失败，调用方不知道操作未执行
- **修复方案**: `spendByPriority` 中对每个 cost amount 增加 `!Number.isFinite(amount)` 检查，NaN 时抛错
- **穿透验证**: 检查 ShopSystem 调用 spendByPriority 时是否可能传入 NaN

### ~~FIX-CU-009~~: mandate 双系统重复定义
- **来源**: C-F4-01 (Challenger 发现)
- **严重度**: **ARCH** 🏗️（架构问题，非 R1 修复范围）
- **判定**: 记录为架构债务，不在本模块 R1 修复。建议在 Phase 5 架构审查中处理。
- **理由**: ResourceSystem 和 CurrencySystem 是两个独立子系统，mandate 的双系统问题是全局架构决策，Currency 模块无法独立解决。

### ~~FIX-CU-010~~: `getShortage(type, NaN)` gap=NaN
- **来源**: Builder CU-P1-07
- **严重度**: **MEDIUM**（降为 P1）
- **判定**: `getShortage` 是只读 API，NaN 结果不会污染 wallet。调用方如果使用 gap 做判断，可能产生逻辑错误，但不会导致数据损坏。
- **修复方案**: 与 FIX-CU-001 统一修复，入口增加 `!Number.isFinite(required)` 检查

---

## P1 裁决

| ID | 描述 | 判定 |
|----|------|------|
| CU-P1-01 | exchange 精度损失未在返回值中体现 | **确认P1**，建议 ExchangeResult 增加 truncated 字段 |
| CU-P1-02 | spendByPriority 静默忽略 NaN costs | **合并到 FIX-CU-008** |
| CU-P1-03 | 非法 CurrencyType 导致 wallet 污染 | **确认P1**，TypeScript 编译时阻止但运行时无防护 |
| CU-P1-04 | 无效货币类型在 spendByPriority 中静默失败 | **确认P1**，与 P1-03 同源 |
| CU-P1-05 | 需验证 engine save/load 六处同步 | **确认P1**，需代码审查 |
| CU-P1-06 | exchange amount*rate 溢出 MAX_SAFE_INTEGER | **确认P1**，当前汇率下不触发 |
| CU-P1-07 | getShortage NaN gap | **确认P1**，只读 API 影响有限 |

---

## 修复优先级排序

| 优先级 | FIX ID | 描述 | 修复复杂度 |
|--------|--------|------|-----------|
| 1 | FIX-CU-001/002/006 | 统一 NaN/Infinity 入口防护（addCurrency/spendCurrency） | 低（加一行检查） |
| 2 | FIX-CU-003 | setCurrency NaN/Infinity 防护 | 低 |
| 3 | FIX-CU-004 | exchange NaN 防护 | 低 |
| 4 | FIX-CU-005 | checkAffordability NaN 防护 | 低 |
| 5 | FIX-CU-007 | deserialize null/undefined/NaN 防护 | 中 |
| 6 | FIX-CU-008 | spendByPriority NaN 防护 | 中 |

---

## 裁决结论

### 核心发现
Currency 模块存在**系统性 NaN 绕过问题**：所有数值 API 入口使用 `amount <= 0` 检查，而 `NaN <= 0` 为 false，导致 NaN 绕过所有防护。这是一个**模式化缺陷**，影响 6 个公开 API。

### 修复策略
**统一修复方案**：创建一个 `isValidAmount(amount: number): boolean` 辅助函数，使用 `Number.isFinite(amount) && amount > 0` 检查，在所有数值入口统一替换 `amount <= 0` 检查。

### 测试策略
为每个被修复的 API 编写 NaN/Infinity 注入测试用例，确保：
1. NaN 被拒绝（返回 0 或抛错）
2. Infinity 被拒绝
3. wallet 不被污染

### Builder 准确性评估
- Builder 正确识别了 setCurrency 和 checkAffordability 的 NaN 问题
- **Builder 错误分析了 addCurrency 和 spendCurrency 的 NaN 行为**（认为返回 0 安全，实际 NaN 绕过检查）
- Challenger 纠正了 2 个 Builder 分析错误
- Builder 准确性评分: **75/100**（主要扣分在 NaN 绕过分析）

### Challenger 有效性评估
- 新增 6 个 P0（其中 4 个为 CRITICAL）
- 纠正 2 个 Builder 分析错误
- Challenger 有效性评分: **90/100**

---

## R1 最终分支覆盖率

| 维度 | R1前覆盖率 | R1后预估覆盖率 |
|------|-----------|---------------|
| F1-Normal | 93% | 97% |
| F2-Boundary | 56% | 88% |
| F3-Error | 43% | 85% |
| F4-Cross | 67% | 73% |
| F5-Lifecycle | 71% | 86% |
| **合计** | **66%** | **86%** |

R1 目标达成：P0 修复后预估覆盖率从 66% 提升至 86%。
