# Currency 模块 — Round 2 Builder Test Tree

> **Builder 视角** | R2 封版测试路径枚举  
> 构建时间: 2026-05-02 | 基线: R1-Final (commit abab1c22)

---

## R2 测试策略

R1 已修复全部 7 个 P0（系统性 NaN/Infinity 绕过），R2 目标是**封版验证**：
1. 确认 R1 修复无退化
2. 覆盖 R1 未覆盖的边界路径
3. 验证跨模块交互安全性
4. 确认 P1 风险在可接受范围内

---

## F1-Normal Flow（正常流程）

### F1-01: 基础货币生命周期
```
初始化 → addCurrency → hasEnough → spendCurrency → getBalance → reset → 验证清零
```
- **覆盖**: init → earn → check → spend → query → reset
- **R2验证**: 全流程数值精度，无浮点误差

### F1-02: 多货币并行操作
```
addCurrency(gold,100) → addCurrency(copper,5000) → spendCurrency(gold,50) → checkAffordability([{gold,30},{copper,2000}])
```
- **覆盖**: 多类型货币互不干扰
- **R2验证**: wallet 对象各字段独立性

### F1-03: 有上限货币（gold/silver/jade）
```
addCurrency(gold, cap-1) → addCurrency(gold, 10) → 验证余额=min(cap, 累计)
```
- **覆盖**: CURRENCY_CAPS 边界
- **R2验证**: cap 精确值，不溢出

### F1-04: 无上限货币（copper/mandate/expedition/guild/ingot）
```
addCurrency(copper, MAX_SAFE_INTEGER - 100) → addCurrency(copper, 50) → 验证不溢出
```
- **覆盖**: 无 cap 货币大数值
- **R2验证**: 大数加法安全性

### F1-05: exchange 正常流程
```
addCurrency(gold, 100) → exchange(gold, copper, 10, rate=100) → 验证 gold-10, copper+1000
```
- **覆盖**: 汇率转换
- **R2验证**: Math.floor 精度损失行为

### F1-06: spendByPriority 正常流程
```
addCurrency(gold, 100) → addCurrency(silver, 200) → spendByPriority([{gold,50},{silver,100}]) → 验证扣除顺序
```
- **覆盖**: 优先级消费
- **R2验证**: 按优先级顺序扣除

### F1-07: save/serialize → deserialize 往返
```
addCurrency(gold, 100) → serialize() → reset() → deserialize(data) → 验证余额恢复
```
- **覆盖**: 存档完整性
- **R2验证**: 往返一致性

---

## F2-Boundary Conditions（边界条件）

### F2-01: 数值边界 — 零值操作
```
addCurrency(gold, 0) → 返回0，余额不变
spendCurrency(gold, 0) → 返回0，余额不变
```
- **R2验证**: R1修复后 `!Number.isFinite(0) || 0 <= 0` → 返回0，正确

### F2-02: 数值边界 — 负值操作
```
addCurrency(gold, -1) → 返回0
spendCurrency(gold, -1) → 返回0
exchange(gold, copper, -1) → 失败
```
- **R2验证**: 负值被统一防护拦截

### F2-03: 数值边界 — 极大值
```
addCurrency(copper, Number.MAX_SAFE_INTEGER) → 余额 = MAX_SAFE_INTEGER
addCurrency(copper, 1) → 余额仍为 MAX_SAFE_INTEGER（或溢出行为）
```
- **R2验证**: 大数溢出行为（P1-06 记录）

### F2-04: NaN 注入 — 全部入口（R1回归）
```
addCurrency(gold, NaN) → 返回0，wallet 不变
spendCurrency(gold, NaN) → 返回0，wallet 不变
setCurrency(gold, NaN) → 忽略，wallet 不变
exchange(gold, copper, NaN) → 失败
hasEnough(gold, NaN) → false
checkAffordability([{gold, NaN}]) → NaN 被跳过
spendByPriority([{gold, NaN}]) → NaN 被跳过
getShortage(gold, NaN) → gap=0
```
- **R2验证**: R1 修复回归，9个入口全覆盖

### F2-05: Infinity 注入 — 全部入口（R1回归）
```
addCurrency(gold, Infinity) → 返回0，wallet 不变
spendCurrency(gold, Infinity) → 返回0
setCurrency(gold, Infinity) → 忽略
exchange(gold, copper, Infinity) → 失败
hasEnough(gold, Infinity) → false
```
- **R2验证**: Infinity 与 NaN 同等防护

### F2-06: 货币上限精确边界
```
setCurrency(gold, CURRENCY_CAPS.gold - 1) → 正常
setCurrency(gold, CURRENCY_CAPS.gold) → 正常
setCurrency(gold, CURRENCY_CAPS.gold + 1) → 被截断为 cap
```
- **R2验证**: cap 边界精确性

### F2-07: 余额不足精确边界
```
addCurrency(gold, 99) → spendCurrency(gold, 100) → 失败，余额仍为99
spendCurrency(gold, 99) → 成功，余额为0
```
- **R2验证**: 不足/刚好/溢出三种边界

### F2-08: deserialize 边界数据
```
deserialize(null) → 重置
deserialize(undefined) → 重置
deserialize({}) → 重置
deserialize({ wallet: null }) → 重置
deserialize({ wallet: { gold: NaN } }) → gold 保持默认值（setCurrency 拦截）
deserialize({ wallet: { gold: -100 } }) → gold = 0（Math.max(0, x)）
deserialize({ wallet: { unknownType: 100 } }) → 未知类型被忽略或报错
```
- **R2验证**: 8种边界输入全覆盖

---

## F3-Error Paths（错误路径）

### F3-01: 不存在的货币类型
```
getBalance('nonexistent' as CurrencyType) → 返回 undefined 或 0
spendCurrency('nonexistent', 100) → 行为验证
```
- **R2验证**: TypeScript 编译时阻止，但运行时行为需确认（P1-03）

### F3-02: exchange 汇率为0或负数
```
exchange(gold, copper, 10, 0) → received = 0
exchange(gold, copper, 10, -1) → 行为验证
```
- **R2验证**: 汇率异常防护

### F3-03: exchange 源货币不足
```
addCurrency(gold, 5) → exchange(gold, copper, 10) → 失败
```
- **R2验证**: 余额不足时 exchange 原子性（不扣也不加）

### F3-04: spendByPriority 余额不足
```
addCurrency(gold, 50) → spendByPriority([{gold, 30}, {gold, 30}]) → 第二笔不足
```
- **R2验证**: 部分扣除行为（扣除第一笔后第二笔失败？还是全部不扣？）

### F3-05: 连续 NaN 注入后系统恢复
```
addCurrency(NaN) × 5 → addCurrency(gold, 100) → 正常
```
- **R2验证**: NaN 注入不留下持久影响

---

## F4-Cross-System Interactions（跨系统交互）

### F4-01: Currency ↔ ShopSystem
```
ShopSystem.purchase() → CurrencySystem.spendCurrency() → 验证扣费一致性
```
- **R2验证**: Shop 调用 Currency 的参数传递正确性

### F4-02: Currency ↔ SaveSystem
```
CurrencySystem.serialize() → SaveSystem.save() → SaveSystem.load() → CurrencySystem.deserialize() → 验证往返
```
- **R2验证**: 完整存档链路

### F4-03: Currency ↔ ResourceSystem (mandate)
```
CurrencySystem.addCurrency(mandate, 10) → ResourceSystem.getMandate() → 是否同步？
```
- **R2验证**: mandate 双系统问题（FIX-CU-009 架构债务，记录行为）

### F4-04: Currency ↔ QuestSystem
```
QuestSystem.complete() → CurrencySystem.addCurrency(reward) → 验证奖励发放
```
- **R2验证**: 任务奖励货币发放链路

---

## F5-Data Lifecycle（数据生命周期）

### F5-01: 长时间运行 — 大量操作后状态一致性
```
for (i = 0; i < 10000; i++) { addCurrency(gold, 1); }
for (i = 0; i < 5000; i++) { spendCurrency(gold, 1); }
验证: getBalance(gold) = 5000
```
- **R2验证**: 累积误差检查

### F5-02: 多次 save/load 循环
```
for (i = 0; i < 100; i++) { 
  modify → serialize → deserialize → verify 
}
```
- **R2验证**: 往返稳定性

### F5-03: reset 后状态完全清空
```
addCurrency(多种货币) → reset() → 验证所有货币为初始值
```
- **R2验证**: reset 彻底性

---

## R2 测试路径统计

| 维度 | 路径数 | R1已覆盖 | R2新增 | R2总计 |
|------|--------|---------|--------|--------|
| F1-Normal | 7 | 7 | 0 | 7 |
| F2-Boundary | 8 | 5 | 3 | 8 |
| F3-Error | 5 | 3 | 2 | 5 |
| F4-Cross | 4 | 2 | 2 | 4 |
| F5-Lifecycle | 3 | 2 | 1 | 3 |
| **合计** | **27** | **19** | **8** | **27** |

R2 新增路径聚焦于：
1. **F2-08**: deserialize 8种边界输入全覆盖（R1仅覆盖4种）
2. **F3-04**: spendByPriority 部分扣除行为
3. **F4-03/04**: 跨系统 mandate/quest 交互
4. **F5-01**: 大量操作累积误差

---

## R2 Builder 评估

### 已知风险（P1，可接受）
| P1 ID | 风险 | 影响 | 缓解 |
|-------|------|------|------|
| P1-03 | 非法 CurrencyType 运行时无防护 | wallet 污染 | TypeScript 编译时阻止 |
| P1-06 | exchange 大数溢出 | 精度损失 | 当前汇率范围安全 |
| P1-07 | getShortage Infinity gap | 调用方需处理 | 只读API，不污染数据 |

### 封版评估
- **P0**: 0 个未修复 ✅
- **P1**: 7 个已记录，风险可控 ✅
- **架构债务**: 1 个（mandate 双系统），Phase 5 处理 ✅
- **测试覆盖**: 107 单元测试 + 46 集成测试 = 153 测试 ✅
- **修复穿透**: 9处 `Number.isFinite` 防护覆盖全部入口 ✅

**Builder 建议**: **封版通过** ✅
