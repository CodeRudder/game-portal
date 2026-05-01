# Currency 模块 — Round 1 Challenger 质询

> **Challenger 视角** | 对 `round-1-tree.md` 进行5维度挑战  
> 生成时间: 2026-05-02

---

## 质询总览

| 维度 | Builder覆盖 | Challenger质疑 | 新增P0 | 新增P1 |
|------|------------|---------------|--------|--------|
| F1-Normal | 30 | 3 | 0 | 1 |
| F2-Boundary | 25 | 6 | 2 | 2 |
| F3-Error | 28 | 8 | 3 | 2 |
| F4-Cross | 15 | 4 | 1 | 1 |
| F5-Lifecycle | 14 | 3 | 0 | 1 |
| **合计** | **112** | **24** | **6** | **7** |

---

## F1-Normal 质询

### C-F1-01: `getWallet()` 返回浅拷贝的引用泄漏
**质疑**: Builder标注"只读副本"，但 `{ ...this.wallet }` 是浅拷贝。CurrencyWallet 的值类型都是 number，浅拷贝确实安全。**确认安全**，但需标注：如果未来 wallet 值变为引用类型，浅拷贝将不安全。

**判定**: ✅ 无新P0，记录为P2防御性建议。

### C-F1-02: `spendByPriority` 正常路径中 costs 指定货币恰好等于余额
**质疑**: 当 `costs.copper = 1000`（恰好等于初始余额），`toSpend = Math.min(1000, 1000) = 1000`，扣除后 copper=0。此时 `unpaid = 0`，不会进入优先级补足。**但如果 costs.copper = 1000 且 balance = 1000，而后续优先级货币也需要扣除**——逻辑是先处理 costs 中指定的，再处理 remaining。如果 costs 中所有货币都够，remaining=0，不会进入优先级循环。**确认正确**。

**判定**: ✅ 无新问题。

### C-F1-03: `exchange` 中 `Math.floor(amount * rate)` 精度损失未告知调用方
**质疑**: exchange 返回 `received = Math.floor(amount * rate)`，但调用方无法知道被截断了多少。例如 `exchange({mandate→copper, amount:1})` → received=100（rate=100，无截断）。但若 rate=0.33，则 `Math.floor(10 * 0.33) = 3`，损失 0.3。**当前汇率表无小数rate，但未来可能添加**。

**判定**: P1-NEW-01：exchange 精度损失未在返回值中体现（建议 ExchangeResult 增加 `truncated` 字段）。

---

## F2-Boundary 质询

### C-F2-01: `addCurrency` 中 `amount` 为 NaN 时 `NaN > 0` 为 false → 返回 0
**质疑**: Builder 标注 `addCurrency(type, NaN)` → `NaN>0为false → 返回0（安全✓）`。**验证源码**：
```typescript
if (amount <= 0) return 0;
```
`NaN <= 0` 为 false，所以 **NaN 会绕过这个检查**，进入后续逻辑！

```typescript
const before = this.wallet[type]; // number
// cap !== null 路径:
const after = Math.min(before + NaN, cap); // Math.min(x, NaN) = NaN
const actual = NaN - before; // NaN
this.wallet[type] = NaN; // ⚠️ 钱包被污染！
return NaN; // 返回值也是NaN
```

**判定**: **P0-NEW-01**：`addCurrency(type, NaN)` 实际上会绕过 `amount <= 0` 检查（因为 `NaN <= 0` 为 false），导致 wallet 被设为 NaN！Builder 分析错误！

### C-F2-02: `spendCurrency` 中 `amount` 为 NaN
**质疑**: Builder 标注 `spendCurrency(type, NaN)` → `NaN>0为false → 返回0（安全✓）`。**验证源码**：
```typescript
if (amount <= 0) return 0;
```
同样 `NaN <= 0` 为 false！NaN 绕过检查，进入：
```typescript
const current = this.wallet[type];
if (current < amount) { // number < NaN → false！
  // 不会进入此分支
}
this.wallet[type] = current - NaN; // NaN！
return NaN;
```

**判定**: **P0-NEW-02**：`spendCurrency(type, NaN)` 同样绕过检查，wallet 被设为 NaN！Builder 分析错误！

### C-F2-03: `hasEnough(type, NaN)` → `balance >= NaN` → false
**质疑**: `hasEnough` 返回 false 表示"不够"，这是安全的——调用方不会继续操作。**确认安全**。

**判定**: ✅ 安全。

### C-F2-04: `checkAffordability({copper:NaN})` → `NaN <= 0` 为 false → 进入比较
**质疑**: 源码：
```typescript
if (amount <= 0) continue; // NaN <= 0 → false → 不跳过！
const balance = this.wallet[currency] ?? 0;
if (balance < amount) { // number < NaN → false → 不认为不足！
  shortages.push(...);
}
```
结果：`canAfford = true`，但实际需要的金额是 NaN。调用方会认为"可以负担"，然后调用 `spendCurrency(copper, NaN)` → wallet 被污染。

**判定**: **P0-NEW-03**：`checkAffordability` 中 NaN 金额被误判为"可负担"，形成"检查通过→执行失败"的矛盾路径。

### C-F2-05: `spendByPriority` 中 costs 值为 NaN
**质疑**: 源码：
```typescript
for (const [currency, amount] of Object.entries(costs)) {
  if (amount <= 0) continue; // NaN <= 0 → false → 不跳过
  const balance = this.wallet[currency] ?? 0;
  const toSpend = Math.min(amount, balance); // Math.min(NaN, balance) = NaN
  if (toSpend > 0) { // NaN > 0 → false → 不执行扣除
    // ...
  }
  const unpaid = amount - toSpend; // NaN - NaN = NaN
  if (unpaid > 0) { // NaN > 0 → false
    remaining += unpaid; // 不会执行
  }
}
```
结果：NaN costs 被静默忽略，不扣除也不报错。remaining=0，返回空 result。**这不算数据损坏，但行为不正确**——应该报错或拒绝。

**判定**: P1-NEW-02：`spendByPriority` 静默忽略 NaN costs，应抛错。

### C-F2-06: `exchange` 中 `amount` 为 NaN
**质疑**: 源码：
```typescript
const balance = this.wallet[from];
if (balance < amount) { // number < NaN → false → 不拒绝
  // ...
}
const rate = this.getExchangeRate(from, to);
// rate > 0 → true (假设有汇率)
const received = Math.floor(NaN * rate); // Math.floor(NaN) = NaN
// 检查目标上限:
if (cap !== null && currentTo + NaN > cap) { // NaN > cap → false → 不进入
  // ...
}
// 正常路径:
this.wallet[from] -= NaN; // NaN！
this.wallet[to] += NaN; // NaN！
return { success: true, spent: NaN, received: NaN };
```

**判定**: **P0-NEW-04**：`exchange({amount:NaN})` 绕过所有检查，两个货币都被设为 NaN！

### C-F2-07: `addCurrency` 中 amount 为 Infinity
**质疑**: 源码：
```typescript
if (amount <= 0) return 0; // Infinity <= 0 → false → 不拦截
const cap = CURRENCY_CAPS[type];
const before = this.wallet[type];
if (cap !== null) {
  const after = Math.min(before + Infinity, cap); // Math.min(Infinity, cap) = cap
  // 有上限时安全
}
// 无上限时:
this.wallet[type] = before + Infinity; // Infinity
```

**判定**: **P0-NEW-05**：无上限货币（copper/mandate/expedition/guild/ingot）`addCurrency(type, Infinity)` 导致余额变为 Infinity。

### C-F2-08: `setCurrency(type, NaN)` → `Math.max(0, NaN)` = NaN
**质疑**: Builder 已识别（CU-P0-01），确认。

**判定**: ✅ 已覆盖。但需注意 **这是所有 NaN 问题的根源之一**——setCurrency 是 deserialize 的底层调用，如果 deserialize 数据被篡改含 NaN，wallet 将被污染。

---

## F3-Error 质询

### C-F3-01: `deserialize(null)` 崩溃路径
**质疑**: Builder 标注为 P0-06。验证源码：
```typescript
deserialize(data: CurrencySaveData): void {
  if (data.version !== CURRENCY_SAVE_VERSION) { // data=null → TypeError!
    // ...
  }
}
```

**判定**: ✅ 确认 P0。崩溃发生在 `data.version` 访问。

### C-F3-02: `deserialize({wallet: undefined})` 崩溃
**质疑**: `data.wallet[type]` → `undefined[type]` → TypeError。

**判定**: ✅ 确认 P0。与 C-F3-01 同类。

### C-F3-03: `deserialize` 中 `data.wallet` 含 NaN 值
**质疑**: `const amount = data.wallet[type]` → 如果存档被篡改为 `{wallet: {copper: NaN}}`，则 `this.setCurrency(type, NaN)` → `Math.max(0, NaN) = NaN` → wallet 被污染。

**判定**: **P0-NEW-06**：`deserialize` 未对 NaN 值做防护，篡改存档可注入 NaN。

### C-F3-04: `getBalance('unknown')` 返回 undefined
**质疑**: `this.wallet['unknown']` → undefined。后续 `hasEnough('unknown', 100)` → `undefined >= 100` → false（安全）。但 `addCurrency('unknown', 100)` → `this.wallet['unknown'] = undefined + 100 = NaN`（如果之前是 undefined）。

等等，更仔细看：
```typescript
addCurrency(type: CurrencyType, amount: number): number {
  // amount=100, type='unknown'
  const cap = CURRENCY_CAPS[type]; // undefined
  const before = this.wallet[type]; // undefined
  if (cap !== null) { // undefined !== null → true!
    const after = Math.min(undefined + 100, undefined); // Math.min(NaN, undefined) = NaN
    // ...
  }
```

实际上 `CURRENCY_CAPS` 是 `Record<CurrencyType, number | null>`，访问不存在的键返回 undefined。`undefined !== null` 为 true，进入上限分支。`Math.min(NaN, undefined)` = NaN。wallet 被污染。

**判定**: P1-NEW-03：非法 CurrencyType 导致 wallet 污染（虽然 TypeScript 编译时阻止，但运行时无防护）。

### C-F3-05: `spendByPriority` 回滚时 result 中含无效货币
**质疑**: 如果 costs 中有 `unknown: 100`，`this.wallet['unknown']` = undefined，`Math.min(100, undefined)` = NaN，`NaN > 0` 为 false → 不扣除。但 `unpaid = 100 - NaN = NaN`，`NaN > 0` 为 false → 不累加到 remaining。最终 remaining=0，不抛错，返回空 result。**静默失败**。

**判定**: P1-NEW-04：无效货币类型在 spendByPriority 中静默失败。

### C-F3-06: `exchange` 中 `actualSpent > amount`（上限截断导致多扣）
**质疑**: 源码：
```typescript
const actualReceived = cap - currentTo;
const actualSpent = Math.ceil(actualReceived / rate);
this.wallet[from] -= actualSpent;
```
如果 `actualSpent > amount`（理论上不应发生，因为 `amount * rate > actualReceived` 时 `actualSpent = Math.ceil(actualReceived / rate) <= amount`）。验证：`actualReceived < amount * rate`，所以 `actualReceived / rate < amount`，`Math.ceil(x) <= amount` 当 x < amount。**安全**。

**判定**: ✅ 安全。

### C-F3-07: `getExchangeRate` 间接路径精度
**质疑**: `fromToCopper.rate * copperToTo.rate` 可能有浮点精度问题。当前汇率都是整数（100, 1000, 50），乘积也是整数。**安全**。

**判定**: ✅ 安全。

### C-F3-08: `emitChanged` 中 `this.deps?.eventBus?.emit` 安全性
**质疑**: 可选链 `?.` 确保了 deps 和 eventBus 为 null/undefined 时不崩溃。try-catch 包裹确保 emit 抛异常时不影响主流程。**确认安全**。

**判定**: ✅ 安全。

---

## F4-Cross 质询

### C-F4-01: Currency ↔ ResourceSystem 的 mandate 双系统问题
**质疑**: ResourceSystem 管理 `mandate`，CurrencySystem 也管理 `mandate`。两系统独立维护余额，可能不一致。集成测试 `chain3-shop-currency-inventory` 使用 ResourceSystem 的 `mandate`，而 `v8-currency-flow` 使用 CurrencySystem 的 `mandate`。**这是一个架构级问题**。

**判定**: **P0-NEW-07**：mandate 在两个系统中重复定义，可能导致余额不一致。（注：此为架构问题，可能需要跨模块协调修复，标记为 P0 但修复范围超出 Currency 模块）

### C-F4-02: engine.serialize() 是否包含 CurrencySystem
**质疑**: 需要验证 engine 的 `buildSaveData` / `applySaveData` 是否调用了 `currency.serialize()` / `currency.deserialize()`。

**判定**: P1-NEW-05：需验证六处同步（BR-024），确保 CurrencySystem 被 engine save/load 覆盖。

### C-F4-03: ShopSystem 购买时使用 CurrencySystem 还是 ResourceSystem
**质疑**: 从集成测试看，chain3 使用 ResourceSystem（gold/grain/troops），而 v8-currency-flow 使用 CurrencySystem。两个系统在不同场景下被使用，**但同一货币（如 mandate）可能被两个系统分别扣减**。

**判定**: 与 C-F4-01 同源问题。

### C-F4-04: ActivitySystem 代币过期清零
**质疑**: v8-currency-flow 测试中提到 §9.4 活动代币过期结算，但 CurrencySystem 没有提供过期清零 API。如果活动系统需要清零某种货币，只能通过 `setCurrency(type, 0)` 实现。**功能缺失但非 Bug**。

**判定**: P2 建议，非 P0/P1。

---

## F5-Lifecycle 质询

### C-F5-01: `reset()` 后 exchangeRates 和 priorityConfig 状态
**质疑**: `reset()` 只重置 wallet，不重置 `exchangeRates` 和 `priorityConfig`。如果未来有 API 修改这些配置，reset 后不会恢复。**当前无修改 API，安全**。

**判定**: ✅ 当前安全，记录为防御性建议。

### C-F5-02: `serialize()` 返回的 wallet 是否是深拷贝
**质疑**: `{ ...this.wallet }` 是浅拷贝，但 wallet 的值都是 number（原始类型），**等价于深拷贝**。**确认安全**。

**判定**: ✅ 安全。

### C-F5-03: `deserialize` 后 eventBus 事件
**质疑**: `deserialize` 调用 `setCurrency`，而 `setCurrency` 不触发事件。**这是正确的行为**——加载存档不应触发大量 currency:changed 事件。**确认安全**。

**判定**: ✅ 安全。

---

## 质询汇总

### 新增 P0（Challenger 发现）
| ID | 来源 | 描述 | 严重度 |
|----|------|------|--------|
| CU-P0-NEW-01 | C-F2-01 | `addCurrency(type, NaN)` 绕过 `amount <= 0` 检查，wallet 被设为 NaN | **CRITICAL** |
| CU-P0-NEW-02 | C-F2-02 | `spendCurrency(type, NaN)` 绕过检查，wallet 被设为 NaN | **CRITICAL** |
| CU-P0-NEW-03 | C-F2-04 | `checkAffordability({copper:NaN})` 误判为可负担 | **HIGH** |
| CU-P0-NEW-04 | C-F2-06 | `exchange({amount:NaN})` 绕过所有检查，两个货币变 NaN | **CRITICAL** |
| CU-P0-NEW-05 | C-F2-07 | 无上限货币 `addCurrency(type, Infinity)` 导致余额变 Infinity | **HIGH** |
| CU-P0-NEW-06 | C-F3-03 | `deserialize` 中 NaN 值未防护，篡改存档可注入 NaN | **HIGH** |

### 新增 P1（Challenger 发现）
| ID | 来源 | 描述 |
|----|------|------|
| CU-P1-NEW-01 | C-F1-03 | exchange 精度损失未在返回值中体现 |
| CU-P1-NEW-02 | C-F2-05 | spendByPriority 静默忽略 NaN costs |
| CU-P1-NEW-03 | C-F3-04 | 非法 CurrencyType 导致 wallet 污染 |
| CU-P1-NEW-04 | C-F3-05 | 无效货币类型在 spendByPriority 中静默失败 |
| CU-P1-NEW-05 | C-F4-02 | 需验证 engine save/load 六处同步 |

### Builder 原有 P0 确认
| ID | Challenger 评估 | 备注 |
|----|----------------|------|
| CU-P0-01 | ✅ 确认 | setCurrency NaN 问题 |
| CU-P0-02 | ❌ 升级为 P0-NEW-01 | Builder 低估了 addCurrency 的 NaN 问题 |
| CU-P0-03 | ✅ 确认 | checkAffordability NaN |
| CU-P0-04 | ✅ 确认 | addCurrency Infinity |
| CU-P0-05 | ✅ 确认 | setCurrency Infinity |
| CU-P0-06 | ✅ 确认 | deserialize null |
| CU-P0-07 | ✅ 确认 | deserialize wallet null |
| CU-P0-08 | ⬇️ 降为 P2 | 浮点精度问题影响有限 |

### Challenger 对 Builder 的纠正
1. **CU-P0-02 纠正**：Builder 认为 `addCurrency(type, NaN)` 返回 0（安全），实际 `NaN <= 0` 为 false，NaN 绕过检查。**严重度升级**。
2. **CU-P0-08 降级**：浮点精度问题（0.5）在游戏货币系统中影响有限，降为 P2。
3. **新增 6 个 P0**：主要集中在 NaN 绕过 `amount <= 0` 检查的系统性问题。
