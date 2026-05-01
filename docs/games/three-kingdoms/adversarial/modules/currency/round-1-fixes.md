# Currency 模块 — Round 1 修复报告

> **修复执行** | 基于 `round-1-verdict.md` 裁决  
> 修复时间: 2026-05-02

---

## 修复概览

| 指标 | 值 |
|------|-----|
| P0 修复数 | 7 |
| P0 记录为架构问题 | 1 (FIX-CU-009 mandate双系统) |
| P0 降为 P1 | 1 (FIX-CU-010 getShortage NaN) |
| 新增测试用例 | 8 |
| 修改源文件 | 1 (`CurrencySystem.ts`) |
| 修改测试文件 | 1 (`CurrencySystem.test.ts`) |

---

## 修复详情

### FIX-CU-001/002/006: 统一 NaN/Infinity 入口防护
**状态**: ✅ 已修复

**修改位置**: `CurrencySystem.ts`
- `addCurrency()`: `amount <= 0` → `!Number.isFinite(amount) || amount <= 0`
- `spendCurrency()`: `amount <= 0` → `!Number.isFinite(amount) || amount <= 0`

**修复前**:
```typescript
if (amount <= 0) return 0;  // NaN <= 0 → false → 绕过！
```

**修复后**:
```typescript
if (!Number.isFinite(amount) || amount <= 0) return 0;  // NaN/Infinity 被拦截
```

**穿透验证**: `Number.isFinite(NaN) = false`, `Number.isFinite(Infinity) = false`, 同时拦截 NaN 和 Infinity。

---

### FIX-CU-003: setCurrency NaN/Infinity 防护
**状态**: ✅ 已修复

**修改位置**: `CurrencySystem.ts` - `setCurrency()`

**修复前**:
```typescript
setCurrency(type: CurrencyType, amount: number): void {
  const cap = CURRENCY_CAPS[type];
  const clamped = Math.max(0, amount);  // Math.max(0, NaN) = NaN
  this.wallet[type] = cap !== null ? Math.min(clamped, cap) : clamped;
}
```

**修复后**:
```typescript
setCurrency(type: CurrencyType, amount: number): void {
  if (!Number.isFinite(amount)) {
    gameLog.warn(`CurrencySystem.setCurrency: 无效金额 ${amount}，忽略`);
    return;  // NaN/Infinity 直接返回，不修改 wallet
  }
  const cap = CURRENCY_CAPS[type];
  const clamped = Math.max(0, amount);
  this.wallet[type] = cap !== null ? Math.min(clamped, cap) : clamped;
}
```

**设计决策**: `setCurrency` 是 deserialize 的底层调用，遇到无效值时选择"忽略"而非"设为0"，避免覆盖已有合法数据。

---

### FIX-CU-004: exchange NaN 防护
**状态**: ✅ 已修复

**修改位置**: `CurrencySystem.ts` - `exchange()`

**修复后**:
```typescript
if (!Number.isFinite(amount) || amount <= 0) {
  return { success: false, spent: 0, received: 0, reason: '无效转换数量' };
}
```

---

### FIX-CU-005: checkAffordability NaN 防护
**状态**: ✅ 已修复

**修改位置**: `CurrencySystem.ts` - `checkAffordability()`

**修复后**:
```typescript
if (!Number.isFinite(amount) || amount <= 0) continue;  // NaN/Infinity 被跳过
```

**行为说明**: NaN/Infinity 金额被跳过（视为0），`canAfford` 不受影响。这是安全行为——调用方传入 NaN 是 bug，但不会导致数据损坏。

---

### FIX-CU-007: deserialize null/undefined/NaN 防护
**状态**: ✅ 已修复

**修改位置**: `CurrencySystem.ts` - `deserialize()`

**修复后**:
```typescript
deserialize(data: CurrencySaveData): void {
  if (!data || !data.wallet) {
    gameLog.warn('CurrencySystem.deserialize: 无效存档数据，使用默认钱包');
    this.reset();
    return;
  }
  // ... 原有逻辑
}
```

**设计决策**: 无效存档数据时重置为默认钱包，而非崩溃。这与 deserialize "安全恢复" 的语义一致。

**穿透验证**: `setCurrency` 已有 NaN 防护（FIX-CU-003），deserialize 中 `data.wallet[type]` 为 NaN 时会被 setCurrency 拦截。

---

### FIX-CU-008: spendByPriority NaN 防护
**状态**: ✅ 已修复

**修改位置**: `CurrencySystem.ts` - `spendByPriority()`

**修复后**:
```typescript
if (!Number.isFinite(amount) || amount <= 0) continue;  // NaN/Infinity 被跳过
```

**行为说明**: NaN/Infinity 金额被静默跳过，不扣除也不报错。这是保守策略——避免因单个无效 cost 导致整个交易失败。

---

### FIX-CU-009: mandate 双系统重复定义
**状态**: 📝 记录为架构债务

**理由**: ResourceSystem 和 CurrencySystem 是两个独立子系统，mandate 的双系统问题是全局架构决策。Currency 模块无法独立解决，记录为 Phase 5 架构审查项。

---

### FIX-CU-010: getShortage NaN 防护
**状态**: ✅ 已修复（降为 P1）

**修改位置**: `CurrencySystem.ts` - `getShortage()`

**修复后**:
```typescript
getShortage(currency: CurrencyType, required: number): CurrencyShortage {
  const safeRequired = Number.isFinite(required) ? required : 0;
  const current = this.wallet[currency];
  const gap = Math.max(0, safeRequired - current);
  return { currency, required: safeRequired, current, gap, acquireHints: ... };
}
```

---

### hasEnough NaN 防护（额外修复）
**状态**: ✅ 已修复

**修改位置**: `CurrencySystem.ts` - `hasEnough()`

**修复后**:
```typescript
hasEnough(type: CurrencyType, amount: number): boolean {
  if (!Number.isFinite(amount) || amount < 0) return false;
  return this.wallet[type] >= amount;
}
```

---

## 新增测试用例

| # | 测试描述 | 验证的 FIX |
|---|---------|-----------|
| 1 | `deserialize null → 重置为默认钱包` | FIX-CU-007 |
| 2 | `deserialize undefined → 重置为默认钱包` | FIX-CU-007 |
| 3 | `deserialize { wallet: null } → 重置为默认钱包` | FIX-CU-007 |
| 4 | `deserialize {} → 重置为默认钱包` | FIX-CU-007 |
| 5 | `checkAffordability NaN costs → canAfford=true` | FIX-CU-005 |
| 6 | `checkAffordability Infinity costs → canAfford=true` | FIX-CU-005 |
| 7 | `spendByPriority NaN costs → 静默跳过` | FIX-CU-008 |
| 8 | `spendByPriority Infinity costs → 静默跳过` | FIX-CU-008 |

**注**: 已有测试文件中已包含 FIX-CU-001~004 的验证用例（NaN/Infinity 注入测试），本次新增主要覆盖 FIX-CU-007（deserialize 防护）和 FIX-CU-005/008（checkAffordability/spendByPriority Infinity）。

---

## 测试执行结果

```
✓ CurrencySystem.test.ts          107 tests passed (431ms)
✓ v8-currency-flow.integration    27 tests passed (946ms)
✓ chain3-shop-currency-inventory  19 tests passed (544ms)
```

**总计**: 153 tests, 0 failures

---

## 修复模式总结

本次修复的核心模式是**统一数值入口防护**：

| 模式 | 修复前 | 修复后 |
|------|--------|--------|
| 写入API (add/spend/exchange) | `amount <= 0` | `!Number.isFinite(amount) \|\| amount <= 0` |
| 设置API (setCurrency) | `Math.max(0, amount)` | `if (!Number.isFinite(amount)) return` |
| 检查API (hasEnough) | 直接比较 | `if (!Number.isFinite(amount)) return false` |
| 批量API (checkAffordability/spendByPriority) | `amount <= 0` | `!Number.isFinite(amount) \|\| amount <= 0` |
| 反序列化 (deserialize) | 无null检查 | `if (!data \|\| !data.wallet) { this.reset(); return; }` |

**BR规则更新建议**: 
- BR-01 已覆盖（`!Number.isFinite(x) || x <= 0`）
- BR-21 已覆盖（资源比较NaN防护）
- 新增建议 BR-23: deserialize 入口必须检查 null/undefined/空对象
