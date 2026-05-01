# Currency 模块 — Round 1 对抗式测试流程树

> **Builder 视角** | 模块: `engine/currency/`  
> 生成时间: 2026-05-02 | 基于源码版本: v1.0

---

## 模块概览

### 核心文件
| 文件 | 职责 | 行数 |
|------|------|------|
| `CurrencySystem.ts` | 聚合根：8种货币余额管理、消耗优先级、汇率转换、序列化 | ~280 |
| `currency.types.ts` | 类型定义：CurrencyType(8种)、Wallet、Priority、Exchange、SaveData | ~160 |
| `currency-config.ts` | 零逻辑数值配置：初始钱包、上限、优先级、汇率表、获取提示 | ~60 |
| `index.ts` | 统一导出（re-export） | ~20 |

### 公开 API 清单（共 22 个公开方法）
| # | API | 分类 | 风险等级 |
|---|-----|------|----------|
| 1 | `init(deps)` | 生命周期 | 中 |
| 2 | `update(dt)` | 生命周期 | 低 |
| 3 | `getState()` | 读取 | 低 |
| 4 | `reset()` | 重置 | 中 |
| 5 | `getWallet()` | 读取 | 低 |
| 6 | `getBalance(type)` | 读取 | 低 |
| 7 | `getCap(type)` | 读取 | 低 |
| 8 | `hasEnough(type, amount)` | 检查 | **高** |
| 9 | `isPaidCurrency(type)` | 读取 | 低 |
| 10 | `addCurrency(type, amount)` | 写入 | **极高** |
| 11 | `spendCurrency(type, amount)` | 写入 | **极高** |
| 12 | `setCurrency(type, amount)` | 写入 | **高** |
| 13 | `spendByPriority(shopType, costs)` | 写入(复合) | **极高** |
| 14 | `getSpendPriority(shopType)` | 读取 | 低 |
| 15 | `getAllSpendPriorities()` | 读取 | 低 |
| 16 | `getShortage(currency, required)` | 读取 | 中 |
| 17 | `checkAffordability(costs)` | 检查(批量) | **高** |
| 18 | `getExchangeRate(from, to)` | 读取 | 中 |
| 19 | `exchange(request)` | 写入(复合) | **极高** |
| 20 | `serialize()` | 序列化 | **高** |
| 21 | `deserialize(data)` | 反序列化 | **极高** |
| 22 | `name`(getter) | 读取 | 低 |

---

## 测试流程树（5维度 × 分支枚举）

### F1: Normal Flow（正常流程）

```
F1-Normal
├── F1-01 初始化
│   ├── new CurrencySystem() → 8种货币初始余额
│   ├── init(deps) → eventBus 注入成功
│   ├── update(dt) → 无操作（空tick）
│   └── reset() → 恢复 INITIAL_WALLET
│
├── F1-02 余额查询
│   ├── getWallet() → 返回只读副本（独立引用）
│   ├── getBalance(type) → 返回每种货币余额
│   ├── getCap(type) → 返回上限或null
│   ├── hasEnough(type, amount) → true/false
│   └── isPaidCurrency(type) → 仅ingot=true
│
├── F1-03 余额增加
│   ├── addCurrency(copper, 500) → 返回500，余额增加
│   ├── addCurrency(recruit, 1000) → 受上限999约束，返回999
│   ├── addCurrency(copper, 0) → 返回0，无变化
│   └── addCurrency(copper, -1) → 返回0，无变化
│
├── F1-04 余额消耗
│   ├── spendCurrency(copper, 300) → 返回300，余额减少
│   ├── spendCurrency(copper, 1000) → 恰好等于余额，余额变0
│   ├── spendCurrency(copper, 0) → 返回0
│   └── spendCurrency(copper, -1) → 返回0
│
├── F1-05 设置余额（存档加载）
│   ├── setCurrency(copper, 5000) → 直接设置
│   ├── setCurrency(recruit, 2000) → 受上限999约束
│   └── setCurrency(copper, -100) → 保护为0
│
├── F1-06 消耗优先级
│   ├── getSpendPriority('normal') → ['copper','mandate']
│   ├── getSpendPriority('black_market') → ['reputation','copper']
│   ├── getSpendPriority('limited_time') → ['ingot']
│   ├── getSpendPriority('vip') → ['ingot','copper']
│   ├── getSpendPriority('unknown') → 回退到normal
│   ├── spendByPriority('normal', {copper:500}) → 直接扣除
│   ├── spendByPriority('normal', {copper:1050}) → 铜钱不足时从mandate补
│   └── spendByPriority('normal', {}) → 空结果
│
├── F1-07 汇率转换
│   ├── getExchangeRate(copper, copper) → 1
│   ├── getExchangeRate(mandate, copper) → 100
│   ├── getExchangeRate(ingot, copper) → 1000
│   ├── getExchangeRate(reputation, copper) → 50
│   ├── exchange({mandate→copper, 5}) → spent=5, received=500
│   ├── exchange({copper→copper, 100}) → success, spent=0, received=0
│   └── exchange({mandate→copper, amount>balance}) → fail
│
├── F1-08 货币不足检测
│   ├── getShortage(copper, 500) → gap=0（充足）
│   ├── getShortage(copper, 2000) → gap=1000（不足）
│   ├── checkAffordability({copper:500}) → canAfford=true
│   ├── checkAffordability({copper:500, mandate:10}) → canAfford=false
│   └── checkAffordability({copper:0, mandate:-1}) → canAfford=true（忽略≤0）
│
├── F1-09 序列化
│   ├── serialize() → {wallet, version}
│   ├── deserialize(validData) → 恢复余额
│   ├── deserialize(versionMismatch) → 警告但仍恢复
│   ├── deserialize(超上限数据) → 截断到上限
│   └── deserialize(缺失字段) → 默认为0
│
└── F1-10 事件系统
    ├── addCurrency → 触发 currency:changed
    ├── spendCurrency → 触发 currency:changed
    ├── exchange → 触发两次 currency:changed（from + to）
    └── setCurrency → 不触发事件
```

### F2: Boundary（边界条件）

```
F2-Boundary
├── F2-01 余额边界
│   ├── 余额=0 → hasEnough(type, 0)=true, hasEnough(type, 1)=false
│   ├── 余额=上限 → addCurrency返回0
│   ├── 余额=MAX_SAFE_INTEGER → 不崩溃
│   ├── 余额=负数（篡改） → setCurrency保护为0
│   └── 余额=Infinity → addCurrency行为未定义（⚠️ P0发现）
│
├── F2-02 金额参数边界
│   ├── amount=0 → addCurrency/spendCurrency返回0
│   ├── amount=-1 → addCurrency/spendCurrency返回0
│   ├── amount=NaN → addCurrency(≤0检查通过NaN) → ⚠️ NaN绕过
│   ├── amount=Infinity → addCurrency(>0) → ⚠️ Infinity绕过
│   ├── amount=-Infinity → addCurrency(≤0)返回0
│   ├── amount=0.5（浮点） → addCurrency接受非整数
│   └── amount=1e-308（极小正数） → addCurrency接受
│
├── F2-03 上限边界
│   ├── recruit上限=999 → addCurrency精确到999
│   ├── summon上限=99 → addCurrency精确到99
│   ├── reputation上限=99999 → addCurrency精确到99999
│   ├── copper上限=null → 无限增长
│   ├── ingot上限=null → 无限增长（付费货币无上限⚠️）
│   └── 上限值+1 → addCurrency截断
│
├── F2-04 消耗优先级边界
│   ├── costs中含未知货币类型 → balance=undefined→?? ⚠️
│   ├── costs中amount=NaN → amount<=0为false → 进入扣除逻辑 ⚠️
│   ├── costs中amount=Infinity → Math.min(Infinity, balance)=balance
│   ├── shopType不在配置中 → 回退到normal
│   └── 空costs → 返回{}
│
├── F2-05 汇率边界
│   ├── from=to → 返回1，exchange无操作
│   ├── 无直接汇率且无间接路径 → 返回0
│   ├── rate=0 → exchange返回失败
│   ├── amount*rate 溢出 → Math.floor可能溢出 ⚠️
│   └── 目标货币恰好=上限 → exchange返回失败
│
└── F2-06 序列化边界
    ├── wallet中含额外字段 → deserialize忽略
    ├── wallet中缺少字段 → 默认0
    ├── version=null → warn+恢复
    ├── version=undefined → warn+恢复
    └── wallet=null → ⚠️ 运行时崩溃？
```

### F3: Error（错误路径/异常）

```
F3-Error
├── F3-01 NaN 注入（⚠️ 核心风险）
│   ├── addCurrency(type, NaN) → NaN>0为false → 返回0（安全✓）
│   ├── spendCurrency(type, NaN) → NaN>0为false → 返回0（安全✓）
│   ├── hasEnough(type, NaN) → balance>=NaN → false（安全✓）
│   ├── setCurrency(type, NaN) → Math.max(0,NaN)=NaN ⚠️ P0！
│   ├── spendByPriority(_, {copper:NaN}) → NaN<=0为false → 进入扣除 ⚠️ P0！
│   ├── checkAffordability({copper:NaN}) → NaN<=0为false → 进入比较 ⚠️
│   ├── exchange({amount:NaN}) → NaN>0 → exchange逻辑中 balance<NaN=false ⚠️
│   └── getShortage(type, NaN) → Math.max(0, NaN-current)=NaN ⚠️
│
├── F3-02 Infinity 注入
│   ├── addCurrency(type, Infinity) → Infinity>0 → 进入添加 ⚠️
│   ├── spendCurrency(type, Infinity) → Infinity>0 → balance<Infinity=true → 抛错（安全✓）
│   ├── setCurrency(type, Infinity) → Math.max(0,Infinity)=Infinity ⚠️
│   └── exchange({amount:Infinity}) → Infinity>0 → balance<Infinity=true → 抛错
│
├── F3-03 负值注入
│   ├── addCurrency(type, -100) → -100<=0 → 返回0（安全✓）
│   ├── spendCurrency(type, -100) → -100<=0 → 返回0（安全✓）
│   ├── setCurrency(type, -100) → Math.max(0,-100)=0（安全✓）
│   └── spendByPriority(_, {copper:-100}) → -100<=0 → skip（安全✓）
│
├── F3-04 货币类型异常
│   ├── getBalance('unknown') → undefined ⚠️
│   ├── hasEnough('unknown', 100) → undefined>=100 → false（安全✓）
│   ├── addCurrency('unknown', 100) → wallet[unknown]=undefined ⚠️
│   ├── spendCurrency('unknown', 100) → undefined<100 → 抛错但消息异常
│   └── setCurrency('unknown', 100) → wallet[unknown]写入 ⚠️
│
├── F3-05 序列化异常
│   ├── deserialize(null) → ⚠️ 运行时崩溃
│   ├── deserialize(undefined) → ⚠️ 运行时崩溃
│   ├── deserialize({}) → data.wallet undefined → ⚠️ 崩溃
│   ├── deserialize({wallet:null}) → ⚠️ data.wallet[type]崩溃
│   └── deserialize({wallet:{}}) → 所有type默认0（安全✓）
│
├── F3-06 spendByPriority 回滚异常
│   ├── 正常回滚 → 所有扣除恢复
│   ├── 回滚时wallet写入异常 → 无二次保护
│   └── costs中含无效货币 → 回滚时也加回undefined ⚠️
│
└── F3-07 exchange 异常路径
    ├── 无汇率路径 → 返回{success:false}
    ├── 余额不足 → 返回{success:false}
    ├── 目标已满 → 返回{success:false}
    └── 部分转换 → actualSpent按比例折算
```

### F4: Cross（跨系统交互）

```
F4-Cross
├── F4-01 Currency ↔ EventBus
│   ├── addCurrency → emit('currency:changed')
│   ├── spendCurrency → emit('currency:changed')
│   ├── exchange → emit两次（from+to）
│   ├── setCurrency → 不emit
│   └── deps未初始化 → try-catch静默
│
├── F4-02 Currency ↔ ShopSystem
│   ├── shopSystem.buy() → spendCurrency/spendByPriority
│   ├── shopType映射到消耗优先级
│   └── 购买失败 → 余额不变
│
├── F4-03 Currency ↔ ResourceSystem
│   ├── resourceSystem与currencySystem并存
│   ├── 资源系统管grain/gold/troops/mandate/techPoint/recruitToken
│   ├── 货币系统管8种CurrencyType
│   ├── mandate在两系统中重复定义 ⚠️
│   └── gold vs copper 命名不一致
│
├── F4-04 Currency ↔ Engine序列化
│   ├── engine.serialize() → 包含currency.serialize()
│   ├── engine.deserialize() → 包含currency.deserialize()
│   ├── engine.save/load → CurrencySaveData完整性
│   └── 六处同步检查（BR-024）
│
├── F4-05 Currency ↔ TradeSystem
│   ├── tradeSystem购买 → 消耗货币
│   ├── 折扣系统 → 影响实际消耗量
│   └── shop-discount-currency集成测试存在
│
└── F4-06 Currency ↔ ActivitySystem
│   ├── 活动代币 → currency类型扩展
│   ├── 代币过期 → 需要清零机制
│   └── v8-currency-flow集成测试存在
```

### F5: Lifecycle（数据生命周期）

```
F5-Lifecycle
├── F5-01 创建→初始化→使用→重置
│   ├── new CurrencySystem() → 初始钱包
│   ├── init(deps) → 注入eventBus
│   ├── 多次init() → 覆盖deps
│   ├── reset() → 恢复INITIAL_WALLET
│   └── 未init()直接使用 → emitChanged静默失败
│
├── F5-02 货币增减生命周期
│   ├── add → 受上限约束 → emit事件
│   ├── spend → 余额检查 → 扣除 → emit事件
│   ├── set → 无上限检查 → 无事件
│   └── exchange → 原子操作（先扣后加）
│
├── F5-03 存档生命周期
│   ├── 游戏中状态 → serialize()
│   ├── serialize() → JSON
│   ├── 加载 → deserialize()
│   ├── 版本迁移 → 警告但继续
│   ├── 超上限数据 → 截断
│   └── 缺失字段 → 默认0
│
├── F5-04 长时间运行
│   ├── 大量addCurrency → 无上限货币可能溢出 ⚠️
│   ├── 频繁serialize/deserialize → 无内存泄漏
│   ├── exchange精度损失 → Math.floor累积
│   └── spendByPriority高频调用 → 钱包一致性
│
└── F5-05 exchange生命周期
    ├── 检查余额 → 检查汇率 → 检查上限 → 扣除 → 增加 → emit
    ├── 部分转换：actualSpent折算 → 可能损失精度
    └── 失败路径：不修改钱包
```

---

## 分支覆盖率矩阵

| 维度 | 总分支数 | 已有测试覆盖 | 新发现分支 | 覆盖率 |
|------|----------|-------------|-----------|--------|
| F1-Normal | 30 | 28 | 2 | 93% |
| F2-Boundary | 25 | 14 | 11 | 56% |
| F3-Error | 28 | 12 | 16 | 43% |
| F4-Cross | 15 | 10 | 5 | 67% |
| F5-Lifecycle | 14 | 10 | 4 | 71% |
| **合计** | **112** | **74** | **38** | **66%** |

### 已有测试文件覆盖情况
| 测试文件 | 覆盖维度 | 测试用例数 |
|----------|---------|-----------|
| `CurrencySystem.test.ts` | F1, F2, F3(部分) | ~75 |
| `v8-currency-flow.integration.test.ts` | F1, F4 | ~27 |
| `chain3-shop-currency-inventory.integration.test.ts` | F4 | ~20 |
| `shop-discount-currency.integration.test.ts` | F4 | ~10 |
| `trade-currency-shop.integration.test.ts` | F4 | ~10 |

---

## 高优先级测试用例（Builder推荐新增）

### P0 - 必须覆盖（安全漏洞/数据损坏风险）
| ID | 分支 | 描述 | 严重度 |
|----|------|------|--------|
| CU-P0-01 | F3-01 | `setCurrency(type, NaN)` → wallet[type]变为NaN，后续所有操作异常 | **CRITICAL** |
| CU-P0-02 | F3-01 | `spendByPriority(_, {copper:NaN})` → NaN<=0为false，进入扣除逻辑，wallet[copper]-NaN=NaN | **CRITICAL** |
| CU-P0-03 | F3-01 | `checkAffordability({copper:NaN})` → NaN<=0为false，进入比较，balance<NaN=false→认为可负担 | **HIGH** |
| CU-P0-04 | F3-02 | `addCurrency(type, Infinity)` → Infinity>0，进入添加，wallet[type]=Infinity | **HIGH** |
| CU-P0-05 | F3-02 | `setCurrency(type, Infinity)` → Math.max(0,Infinity)=Infinity，无上限货币变Infinity | **HIGH** |
| CU-P0-06 | F3-05 | `deserialize(null)` → 运行时崩溃（data.version访问null） | **HIGH** |
| CU-P0-07 | F3-05 | `deserialize({wallet:null})` → data.wallet[type]崩溃 | **HIGH** |
| CU-P0-08 | F2-02 | `addCurrency(type, 0.5)` → 非整数金额被接受，浮点精度问题 | **MEDIUM** |

### P1 - 应该覆盖
| ID | 分支 | 描述 |
|----|------|------|
| CU-P1-01 | F3-01 | `exchange({amount:NaN})` → balance<NaN=false，进入转换逻辑 |
| CU-P1-02 | F3-04 | `addCurrency('unknown' as CurrencyType, 100)` → wallet写入unknown键 |
| CU-P1-03 | F3-06 | `spendByPriority` costs含无效货币时回滚行为 |
| CU-P1-04 | F2-05 | `exchange` amount*rate溢出MAX_SAFE_INTEGER |
| CU-P1-05 | F5-04 | 大量addCurrency后wallet值超过MAX_SAFE_INTEGER |
| CU-P1-06 | F4-03 | mandate在ResourceSystem和CurrencySystem中的双系统一致性 |
| CU-P1-07 | F3-01 | `getShortage(type, NaN)` → gap=NaN |
| CU-P1-08 | F2-06 | `deserialize({version:'abc'})` → 非数字版本号处理 |

### P2 - 建议覆盖
| ID | 分支 | 描述 |
|----|------|------|
| CU-P2-01 | F5-03 | serialize/deserialize 1000次循环一致性 |
| CU-P2-02 | F4-01 | eventBus.emit抛异常时不影响主流程 |
| CU-P2-03 | F2-04 | spendByPriority costs中含NaN金额 |
| CU-P2-04 | F5-02 | exchange部分转换精度损失验证 |
| CU-P2-05 | F3-07 | exchange中actualSpent > amount（上限截断导致多扣） |
