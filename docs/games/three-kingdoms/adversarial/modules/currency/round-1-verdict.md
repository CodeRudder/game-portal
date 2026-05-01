# Currency 模块 R1 — Arbiter 最终裁决

> **Arbiter**: TreeArbiter | **日期**: 2025-07-11 | **封版线**: 9.0

## 评分

| 维度 | Builder 得分 | Challenger 质疑 | 裁决得分 |
|------|-------------|----------------|----------|
| F-Normal | 85% | C-N01, C-N02, C-N03 | 65% |
| F-Boundary | 45% | C-B01, C-B02, C-B03 | 35% |
| F-Error | 60% | C-E01, C-E02 | 55% |
| F-Cross | 30% | C-X01, C-X02 | 25% |
| F-Lifecycle | 57% | C-L01, C-L02 | 50% |

### 综合评分

```
节点覆盖率: 45/75 = 60.0% (目标 ≥95%)
P0 覆盖率:  ~70% (目标 100%)
维度均衡度: (0.65+0.35+0.55+0.25+0.50)/5 = 0.46 (目标 ≥0.7)
```

**R1 综合得分: 5.8 / 10** ❌ 未达封版线 (9.0)

---

## 裁决：BUG 确认

### 🔥 BUG-1: setCurrency 上限货币负值未保护 [C-B03]

**严重度**: P0 | **确认**: ✅ 确认

```typescript
// 当前代码 (CurrencySystem.ts setCurrency):
setCurrency(type: CurrencyType, amount: number): void {
  const cap = CURRENCY_CAPS[type];
  this.wallet[type] = cap !== null ? Math.min(amount, cap) : Math.max(0, amount);
}
```

**问题**: 有上限分支 `Math.min(amount, cap)` — 当 `amount = -100` 时结果为 `-100`，负值穿透。

**修复方案**:
```typescript
setCurrency(type: CurrencyType, amount: number): void {
  const cap = CURRENCY_CAPS[type];
  const clamped = Math.max(0, amount);
  this.wallet[type] = cap !== null ? Math.min(clamped, cap) : clamped;
}
```

### 🔥 BUG-2: exchange 不触发 currency:changed 事件 [C-X01]

**严重度**: P0 | **确认**: ✅ 确认

```typescript
// 当前代码 (exchange 方法):
this.wallet[from] -= amount;
this.wallet[to] += received;
// ❌ 缺少 emitChanged 调用
```

**修复方案**: 在 exchange 成功路径添加事件触发：
```typescript
// 正常转换路径
this.wallet[from] -= amount;
this.wallet[to] += received;
this.emitChanged(from, balance, this.wallet[from]);
this.emitChanged(to, currentTo, this.wallet[to]);
return { success: true, spent: amount, received };

// 部分转换路径
this.wallet[from] -= actualSpent;
this.wallet[to] = cap;
this.emitChanged(from, balance - actualSpent + actualSpent /* 需要正确记录before */, ...);
// 需要仔细处理 before 值
```

---

## 裁决：必须补充的测试用例

### P0 必须补充 (6项)

| # | 节点 | 测试用例 | 依据 |
|---|------|---------|------|
| 1 | T5.2 | spendByPriority 铜钱不足时从优先级货币补足 | C-N01 |
| 2 | T5.9 | spendByPriority 全部不足时回滚所有扣除 | C-N01 |
| 3 | T7.4 | exchange 目标货币接近上限时部分转换 | C-N02 |
| 4 | T7.5 | exchange 目标货币已满时返回失败 | C-N02 |
| 5 | T4.6 | setCurrency 上限货币设负值→应保护为0 (修复后) | C-B03 |
| 6 | T10.4 | exchange 成功后触发 currency:changed 事件 (修复后) | C-X01 |

### P1 应补充 (8项)

| # | 节点 | 测试用例 |
|---|------|---------|
| 7 | T2.4 | addCurrency 已达上限再增加返回0 |
| 8 | T3.4 | spendCurrency 恰好等于余额 |
| 9 | T3.8 | spendCurrency 异常后余额不变 |
| 10 | T5.4 | spendByPriority 多货币混合扣除 |
| 11 | T5.7 | spendByPriority 空costs返回空result |
| 12 | T6.3 | getExchangeRate 间接路径(确认返回0) |
| 13 | T9.4 | deserialize 钱包数据超上限被截断 |
| 14 | T9.7 | deserialize 缺失字段默认为0 |

### P2 锦上添花 (6项)

| # | 节点 |
|---|------|
| 15 | T4.5 setCurrency 不触发事件 |
| 16 | T5.11 limited_time 仅元宝 |
| 17 | T5.12 VIP优先级 |
| 18 | T7.6 exchange 无汇率路径 |
| 19 | T7.10 exchange Math.floor截断 |
| 20 | T9.6 serialize 独立副本 |

---

## 裁决：设计观察（非阻塞）

### OBS-1: 间接汇率不可用 [C-N03]

`getExchangeRate('copper', 'mandate')` 返回 0，因为汇率表只有 `to='copper'` 的直接路径。这不是 BUG（当前业务可能不需要反向汇率），但是设计局限。建议在后续迭代中补充反向汇率或使用矩阵计算。

**裁决**: 不阻塞，记录为 tech debt。

### OBS-2: exchange amount=0 语义 [C-B01]

`exchange({from:'copper', to:'mandate', amount:0})` 会因 rate=0 返回失败。语义上不太对，但实际业务不会传 0。

**裁决**: 不阻塞，记录为 edge case。

### OBS-3: addCurrency 已达上限触发无变化事件 [C-B02]

`emitChanged(type, 999, 999)` 触发了 before===after 的事件。不影响正确性但浪费。

**裁决**: 不阻塞，建议后续优化加 guard。

---

## 封版判定

| 条件 | 当前 | 目标 | 达标 |
|------|------|------|------|
| 节点覆盖率 | 60% | ≥95% | ❌ |
| P0覆盖率 | ~70% | 100% | ❌ |
| 维度均衡度 | 0.46 | ≥0.7 | ❌ |
| BUG修复 | 0/2 | 2/2 | ❌ |
| 综合得分 | 5.8 | ≥9.0 | ❌ |

### 结论

**R1 未达封版线。需要 Fixer 执行以下操作：**

1. ✅ 修复 BUG-1 (setCurrency 负值保护)
2. ✅ 修复 BUG-2 (exchange 事件触发)
3. ✅ 补充 P0 测试 (6项)
4. ✅ 补充 P1 测试 (8项)
5. ✅ 补充 P2 测试 (6项)

**预期修复后得分**: 9.2 / 10 ✅
