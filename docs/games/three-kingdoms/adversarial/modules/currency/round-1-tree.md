# Currency 模块 R1 对抗式测试 — 流程分支树

> **Builder**: TreeBuilder | **日期**: 2025-07-11 | **模块**: CurrencySystem

## 模块概览

- **源文件**: `src/games/three-kingdoms/engine/currency/CurrencySystem.ts`
- **类型定义**: `src/games/three-kingdoms/core/currency/currency.types.ts`
- **配置常量**: `src/games/three-kingdoms/core/currency/currency-config.ts`
- **现有测试**: `src/games/three-kingdoms/engine/currency/__tests__/CurrencySystem.test.ts` (10 describe块, ~45 it)

## 公共 API 清单

| # | 方法 | 参数 | 返回值 | 分类 |
|---|------|------|--------|------|
| 1 | `init(deps)` | ISystemDeps | void | 生命周期 |
| 2 | `update(dt)` | number | void | 生命周期 |
| 3 | `getState()` | - | CurrencyWallet | 生命周期 |
| 4 | `reset()` | - | void | 生命周期 |
| 5 | `getWallet()` | - | CurrencyWallet | 查询 |
| 6 | `getBalance(type)` | CurrencyType | number | 查询 |
| 7 | `getCap(type)` | CurrencyType | number\|null | 查询 |
| 8 | `hasEnough(type, amount)` | CurrencyType, number | boolean | 查询 |
| 9 | `isPaidCurrency(type)` | CurrencyType | boolean | 查询 |
| 10 | `addCurrency(type, amount)` | CurrencyType, number | number | 变更 |
| 11 | `spendCurrency(type, amount)` | CurrencyType, number | number | 变更 |
| 12 | `setCurrency(type, amount)` | CurrencyType, number | void | 变更 |
| 13 | `spendByPriority(shopType, costs)` | string, Record | Record | 变更 |
| 14 | `getSpendPriority(shopType)` | string | CurrencyType[] | 优先级 |
| 15 | `getAllSpendPriorities()` | - | SpendPriorityConfig | 优先级 |
| 16 | `getShortage(currency, required)` | CurrencyType, number | CurrencyShortage | 不足检测 |
| 17 | `checkAffordability(costs)` | Record | {canAfford, shortages} | 不足检测 |
| 18 | `getExchangeRate(from, to)` | CurrencyType, CurrencyType | number | 汇率 |
| 19 | `exchange(request)` | ExchangeRequest | ExchangeResult | 汇率 |
| 20 | `serialize()` | - | CurrencySaveData | 序列化 |
| 21 | `deserialize(data)` | CurrencySaveData | void | 序列化 |

## 流程分支树

### T1: 余额查询 (5 nodes)

```
T1.1 getBalance — 正常查询各货币
T1.2 getWallet — 返回独立副本（修改不影响原）
T1.3 hasEnough — 边界：恰好等于 / 差1 / 0 / 负数
T1.4 getCap — 有上限 / 无上限(null)
T1.5 isPaidCurrency — 付费/免费货币判断
```

**现有覆盖**: ✅ T1.1~T1.5 全覆盖

### T2: addCurrency 增加货币 (8 nodes)

```
T2.1 正常增加 — 余额正确增长
T2.2 返回值 — 返回实际增加量
T2.3 上限约束 — 到达上限后截断，返回截断量
T2.4 上限约束 — 已达上限再增加，返回0
T2.5 无上限货币 — 可无限增加
T2.6 零值 — amount=0 返回0，余额不变
T2.7 负值 — amount<0 返回0，余额不变
T2.8 事件触发 — currency:changed 正确 emit
```

**现有覆盖**: ✅ T2.1~T2.3, T2.6~T2.8 | ⚠️ T2.4(已达上限再增加) 缺失 | ⚠️ T2.5(无上限大数) 缺失

### T3: spendCurrency 消耗货币 (8 nodes)

```
T3.1 正常消耗 — 余额正确减少
T3.2 返回值 — 返回消耗量
T3.3 余额不足 — 抛出异常，包含缺口信息
T3.4 余额恰好等于消耗量 — 边界
T3.5 零值 — amount=0 返回0，余额不变
T3.6 负值 — amount<0 返回0，余额不变
T3.7 事件触发 — currency:changed 正确 emit
T3.8 异常后余额不变 — 原子性保证
```

**现有覆盖**: ✅ T3.1~T3.3, T3.5~T3.7 | ⚠️ T3.4(恰好) 缺失 | ⚠️ T3.8(异常后余额不变) 缺失

### T4: setCurrency 设置货币 (6 nodes)

```
T4.1 正常设置 — 余额变为指定值
T4.2 上限约束 — 超过上限被截断
T4.3 负值 — 设为0（无上限货币）
T4.4 零值 — 设为0
T4.5 不触发事件 — setCurrency 用于加载存档
T4.6 上限货币设负值 — 设为0
```

**现有覆盖**: ✅ T4.1~T4.4 | ⚠️ T4.5(不触发事件) 缺失 | ⚠️ T4.6(上限货币负值) 缺失

### T5: spendByPriority 按优先级消耗 (12 nodes)

```
T5.1  单货币扣除 — 指定货币充足
T5.2  单货币不足 — 部分扣除+优先级补足
T5.3  全部不足 — 抛异常+回滚
T5.4  多货币混合扣除 — costs含多种货币
T5.5  costs含零值/负值 — 跳过
T5.6  未知shopType — 回退到 normal
T5.7  costs为空对象 — 返回空result
T5.8  扣除后余额正确 — 各货币独立验证
T5.9  回滚完整性 — 异常后所有货币恢复
T5.10 已处理货币不被重复扣除 — 优先级列表跳过
T5.11 limited_time 仅元宝 — 非元宝货币不参与
T5.12 VIP商店优先级 — ingot先扣
```

**现有覆盖**: ✅ T5.1, T5.3 | ⚠️ T5.2(部分补足) 缺失 | ⚠️ T5.4(多货币) 缺失 | ⚠️ T5.5(零值负值) 缺失 | ⚠️ T5.6(未知shopType) 缺失 | ⚠️ T5.7(空costs) 缺失 | ⚠️ T5.8(余额验证) 缺失 | ⚠️ T5.9(回滚完整性) 缺失 | ⚠️ T5.10(不重复扣) 缺失 | ⚠️ T5.11(仅元宝) 缺失 | ⚠️ T5.12(VIP优先) 缺失

### T6: 汇率查询 (6 nodes)

```
T6.1 相同货币 — 汇率=1
T6.2 直接汇率 — mandate→copper=100
T6.3 间接汇率 — copper→mandate（需反向计算）
T6.4 无汇率路径 — 返回0
T6.5 ingot→copper — 1000
T6.6 reputation→copper — 50
```

**现有覆盖**: ✅ T6.1, T6.2, T6.5 | ⚠️ T6.3(间接汇率) 缺失 | ⚠️ T6.4(无路径) 缺失 | ⚠️ T6.6(reputation) 缺失

### T7: exchange 汇率转换 (10 nodes)

```
T7.1  正常转换 — 成功扣源加目标
T7.2  余额不足 — 返回失败+reason
T7.3  相同货币 — success=true, spent=0, received=0
T7.4  目标货币达上限 — 部分转换
T7.5  目标货币已满 — 返回失败
T7.6  无汇率路径 — 返回失败
T7.7  转换后余额双端验证
T7.8  amount=0 — 边界行为
T7.9  大额转换 — 精度/溢出
T7.10 received 使用 Math.floor — 小数截断
```

**现有覆盖**: ✅ T7.1~T7.3 | ⚠️ T7.4(目标达上限部分转换) 缺失 | ⚠️ T7.5(目标已满) 缺失 | ⚠️ T7.6(无路径) 缺失 | ⚠️ T7.7(双端验证) 缺失 | ⚠️ T7.8(零值) 缺失 | ⚠️ T7.9(大额) 缺失 | ⚠️ T7.10(截断) 缺失

### T8: 货币不足检测 (6 nodes)

```
T8.1 getShortage 余额充足 — gap=0
T8.2 getShortage 余额不足 — 完整信息
T8.3 getShortage 余额为0 — gap=required
T8.4 checkAffordability 全部充足
T8.5 checkAffordability 部分不足
T8.6 checkAffordability 忽略零值负值
```

**现有覆盖**: ✅ T8.1~T8.6 全覆盖

### T9: 序列化/反序列化 (7 nodes)

```
T9.1 serialize — 包含版本号+钱包
T9.2 deserialize 正常恢复
T9.3 deserialize 版本不匹配 — 警告但仍恢复
T9.4 deserialize 钱包数据含超上限值 — 被截断
T9.5 reset — 恢复初始状态
T9.6 serialize 返回独立副本
T9.7 deserialize 缺失字段 — 默认为0
```

**现有覆盖**: ✅ T9.1~T9.3, T9.5 | ⚠️ T9.4(超上限截断) 缺失 | ⚠️ T9.6(独立副本) 缺失 | ⚠️ T9.7(缺失字段) 缺失

### T10: 事件系统 (4 nodes)

```
T10.1 addCurrency 触发 changed 事件
T10.2 spendCurrency 触发 changed 事件
T10.3 未初始化不崩溃
T10.4 exchange 不触发 changed 事件（直接修改 wallet）
```

**现有覆盖**: ✅ T10.1~T10.3 | ⚠️ T10.4(exchange不触发事件) 缺失

### T11: ISubsystem 接口 (3 nodes)

```
T11.1 name='currency'
T11.2 update 不抛异常
T11.3 getState 返回 wallet
```

**现有覆盖**: ✅ T11.1~T11.3 全覆盖

## 统计

| 维度 | 总节点 | 已覆盖 | 未覆盖 | 覆盖率 |
|------|--------|--------|--------|--------|
| T1 查询 | 5 | 5 | 0 | 100% |
| T2 addCurrency | 8 | 6 | 2 | 75% |
| T3 spendCurrency | 8 | 6 | 2 | 75% |
| T4 setCurrency | 6 | 4 | 2 | 67% |
| T5 spendByPriority | 12 | 2 | 10 | 17% |
| T6 汇率查询 | 6 | 3 | 3 | 50% |
| T7 exchange | 10 | 3 | 7 | 30% |
| T8 不足检测 | 6 | 6 | 0 | 100% |
| T9 序列化 | 7 | 4 | 3 | 57% |
| T10 事件 | 4 | 3 | 1 | 75% |
| T11 接口 | 3 | 3 | 0 | 100% |
| **合计** | **75** | **45** | **30** | **60%** |

### P0（必须覆盖）缺失节点

| ID | 节点 | 理由 |
|----|------|------|
| P0-1 | T5.2 部分扣除+优先级补足 | 核心业务逻辑 |
| P0-2 | T5.9 回滚完整性 | 数据一致性 |
| P0-3 | T7.4 目标达上限部分转换 | 核心边界 |
| P0-4 | T7.5 目标已满失败 | 核心边界 |
| P0-5 | T9.4 deserialize 超上限截断 | 数据完整性 |
| P0-6 | T5.11 limited_time 仅元宝 | 业务规则 |

### P1（应覆盖）缺失节点

| ID | 节点 |
|----|------|
| P1-1 | T2.4 已达上限再增加 |
| P1-2 | T3.4 恰好等于消耗量 |
| P1-3 | T3.8 异常后余额不变 |
| P1-4 | T4.5 setCurrency 不触发事件 |
| P1-5 | T5.4 多货币混合扣除 |
| P1-6 | T5.7 空costs |
| P1-7 | T6.3 间接汇率 |
| P1-8 | T6.4 无汇率路径 |
| P1-9 | T7.6 无汇率路径 |
| P1-10 | T7.10 Math.floor截断 |
| P1-11 | T9.7 缺失字段默认0 |
| P1-12 | T10.4 exchange不触发事件 |

### P2（锦上添花）缺失节点

| ID | 节点 |
|----|------|
| P2-1 | T2.5 无上限大数 |
| P2-2 | T4.6 上限货币设负值 |
| P2-3 | T5.5 costs含零值负值 |
| P2-4 | T5.6 未知shopType spendByPriority |
| P2-5 | T5.10 不重复扣除 |
| P2-6 | T5.12 VIP优先 |
| P2-7 | T6.6 reputation汇率 |
| P2-8 | T7.7 双端验证 |
| P2-9 | T7.8 amount=0 |
| P2-10 | T7.9 大额转换 |
| P2-11 | T9.6 serialize独立副本 |
| P2-12 | T2.4 已达上限 |

## 维度均衡度

| 维度 | 覆盖率 | 权重 |
|------|--------|------|
| F-Normal | 85% | 高 |
| F-Boundary | 45% | 高 |
| F-Error | 60% | 中 |
| F-Cross | 30% | 中 |
| F-Lifecycle | 57% | 中 |

**维度均衡度**: (0.85 + 0.45 + 0.60 + 0.30 + 0.57) / 5 = **0.55** (< 0.7 阈值)
