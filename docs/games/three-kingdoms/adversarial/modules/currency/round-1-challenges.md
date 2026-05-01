# Currency 模块 R1 — Challenger 质疑报告

> **Challenger**: TreeChallenger | **日期**: 2025-07-11 | **目标**: round-1-tree.md

## 总体评价

Builder 的分支树覆盖了主要 API，但存在 **6个严重遗漏** 和 **4个中等遗漏**。以下按5维度逐一质疑。

---

## F-Normal: 主线流程完整性

### 🔴 C-N01: spendByPriority 部分补足流程完全未测

**节点**: T5.2

Builder 标记为 ⚠️ 但未给出 P0 优先级。实际场景：玩家在集市买道具，铜钱不够，系统按优先级从 mandate 补足。这是核心支付链路。

```typescript
// 场景：copper=500, mandate=10, costs={copper: 600}
// 预期：先扣 copper 500，再从优先级列表补 100 mandate
// 但 mandate 只有 10，不够 100 → 应该抛异常+回滚
```

**严重度**: P0 — 核心支付逻辑

### 🔴 C-N02: exchange 目标货币上限场景缺失

**节点**: T7.4, T7.5

exchange 方法有完整的目标上限处理逻辑（actualReceived 折算），但测试完全未覆盖。这段逻辑包含 `Math.ceil(actualReceived / rate)` 反向折算，是复杂度最高的分支。

```typescript
// 场景：summon 上限99，已有98个
// 用 copper 换 summon，rate 可能导致 received=2，但 cap 只允许 1
// actualSpent = Math.ceil(1/rate) — 反向折算精度问题
```

**严重度**: P0 — 含精度陷阱

### 🟡 C-N03: getExchangeRate 间接路径未验证

**节点**: T6.3

BASE_EXCHANGE_RATES 只有4条直接汇率（全部 to='copper'）。从 copper 反向换算需要间接路径。但 `getExchangeRate('copper', 'mandate')` 需要找到 `copper→copper(1)` 和 `mandate→copper(100)`，间接计算 `1/100=0.01`？

**问题**: 代码逻辑是 `fromToCopper.rate * copperToTo.rate`，但 copper→mandate 的路径：
- `fromToCopper`: from='copper', to='copper' → rate=1 ✓
- `copperToTo`: from='copper', to='mandate' → 不存在！

**实际返回**: 0，不是 0.01。这是一个 **设计缺陷**——汇率表缺少反向路径。

**严重度**: P0 — 汇率系统不完整

---

## F-Boundary: 边界条件覆盖

### 🔴 C-B01: exchange amount=0 行为未定义

**节点**: T7.8

```typescript
exchange({ from: 'copper', to: 'mandate', amount: 0 })
```

代码路径：`from !== to` → `balance(1000) >= 0` → `rate = getExchangeRate('copper','mandate') = 0` → `rate <= 0` → 返回失败 "不支持该汇率转换"。

但语义上 amount=0 应该是空操作。这是 **API 语义不一致**。

**严重度**: P1 — 边界语义问题

### 🟡 C-B02: addCurrency 已达上限再增加

**节点**: T2.4

```typescript
// recruit 已满 999
cs.setCurrency('recruit', 999);
const added = cs.addCurrency('recruit', 1);
// 预期：added=0, balance=999
// 但 emitChanged 是否触发？ before=999, after=999 → 应该不触发？
```

代码：`after = Math.min(999+1, 999) = 999`, `actual = 999-999 = 0`，`wallet[type] = 999`，然后 `emitChanged(type, 999, 999)` — **事件仍触发**，但 before===after。这可能导致 UI 无谓刷新。

**严重度**: P2 — 性能浪费

### 🟡 C-B03: setCurrency 对有上限货币设负值

**节点**: T4.6

```typescript
setCurrency('recruit', -100)
```

代码：`cap=999`, `Math.min(-100, 999) = -100`。**负值未被保护！**

对比无上限货币：`Math.max(0, -100) = 0` ✓

**这是一个 BUG**：有上限货币走 `Math.min(amount, cap)` 分支，负值不会被 Math.max(0,...) 保护。

**严重度**: P0 — 🔥 数据完整性 BUG

---

## F-Error: 异常路径覆盖

### 🟡 C-E01: spendCurrency 异常后余额不变

**节点**: T3.8

虽然 spendCurrency 是原子操作（先检查再扣），但确认余额不变仍是必要测试。Builder 标记为缺失。

**严重度**: P1

### 🟡 C-E02: deserialize 缺失字段

**节点**: T9.7

```typescript
deserialize({ wallet: { copper: 5000 }, version: 1 })
// wallet 缺少 mandate, recruit 等字段
// 代码：data.wallet[type] ?? 0 → 默认0 ✓
```

需要确认所有8种货币在缺失时默认为0。

**严重度**: P1

---

## F-Cross: 跨系统交互

### 🔴 C-X01: exchange 不触发 currency:changed 事件

**节点**: T10.4

exchange 方法直接修改 `this.wallet[from]` 和 `this.wallet[to]`，**不经过 addCurrency/spendCurrency**，因此不触发 `emitChanged`。UI 层监听 `currency:changed` 事件将无法感知汇率转换。

**这是一个 BUG**：exchange 后 UI 不会更新。

**严重度**: P0 — 🔥 事件遗漏 BUG

### 🟡 C-X02: spendByPriority 与 exchange 的交互

如果通过 spendByPriority 消耗后立即 exchange，余额状态是否一致？Builder 未考虑组合操作。

**严重度**: P2

---

## F-Lifecycle: 数据生命周期

### 🟡 C-L01: serialize 返回独立副本

**节点**: T9.6

```typescript
const data = cs.serialize();
data.wallet.copper = 99999;
// cs.getBalance('copper') 应仍为原值
```

**严重度**: P1

### 🟡 C-L02: 大额货币值精度

**节点**: T2.5, T7.9

JavaScript number 精度问题：`Number.MAX_SAFE_INTEGER = 9007199254740991`。无上限货币理论上可以无限增长，但大数运算可能丢失精度。

```typescript
cs.setCurrency('copper', 1e16);
cs.addCurrency('copper', 1);
// 1e16 + 1 === 1e16 ? → 精度丢失
```

**严重度**: P2 — 理论风险

---

## 质疑总结

| 级别 | 编号 | 节点 | 描述 |
|------|------|------|------|
| 🔴 P0 | C-N01 | T5.2 | spendByPriority 部分补足未测 |
| 🔴 P0 | C-N02 | T7.4/5 | exchange 目标上限场景缺失 |
| 🔴 P0 | C-N03 | T6.3 | 间接汇率路径实际不可用 |
| 🔴 P0 | C-B03 | T4.6 | 🔥 setCurrency 上限货币负值BUG |
| 🔴 P0 | C-X01 | T10.4 | 🔥 exchange 不触发事件BUG |
| 🔴 P0 | C-B01 | T7.8 | exchange amount=0 语义问题 |
| 🟡 P1 | C-B02 | T2.4 | 已达上限再增加事件浪费 |
| 🟡 P1 | C-E01 | T3.8 | 异常后余额不变确认 |
| 🟡 P1 | C-E02 | T9.7 | deserialize 缺失字段 |
| 🟡 P1 | C-L01 | T9.6 | serialize 独立副本 |
| 🟡 P2 | C-X02 | T5+T7 | 组合操作 |
| 🟡 P2 | C-L02 | T2.5 | 大数精度 |

### 发现的 BUG

1. **🔥 C-B03**: `setCurrency` 对有上限货币设负值时，走 `Math.min(amount, cap)` 分支，负值不会被 `Math.max(0, ...)` 保护。修复：`Math.min(Math.max(0, amount), cap)` 或先 max 再 min。

2. **🔥 C-X01**: `exchange` 方法直接修改 wallet 而不触发 `currency:changed` 事件，UI 无法感知变化。修复：在 exchange 成功路径添加 `emitChanged` 调用。

### 修正后覆盖率预估

- 节点覆盖率：60% → 需补充 30 个节点 → 目标 95%+
- P0 覆盖率：需从 ~70% 提升到 100%
- 维度均衡度：0.55 → 需提升到 0.7+
