# Trade 模块 R1 对抗式测试 — Challenger 审查

> Challenger Agent | 2026-05-01
> 审查策略：NaN绕过<=0检查、deserialize null、serialize缺失、负值漏洞、engine-save接入

---

## P0 确认清单

### P0-001: ResourceTradeEngine NaN 绕过 amount <= 0 检查
- **位置**: `ResourceTradeEngine.ts:164`, `ResourceTradeEngine.ts:243`
- **代码**: `if (amount <= 0)` 
- **问题**: `NaN <= 0` → `false`，NaN 绕过参数校验
- **影响**: `tradeResource(NaN)` → 绕过校验 → `currentAmount < NaN` → `false` → 执行 `consumeResource(from, NaN)` → 资源系统可能异常
- **源码行**: 
  ```typescript
  // Line 164: tradeResource
  if (amount <= 0) {  // NaN <= 0 === false → 绕过
  // Line 243: canTradeResource
  if (amount <= 0) {  // 同上
  ```
- **修复**: `if (!Number.isFinite(amount) || amount <= 0)`
- **BR规则**: BR-006 (NaN绕过教训)

### P0-002: CaravanSystem.upgradeCaravan NaN/负值污染属性
- **位置**: `CaravanSystem.ts:352`
- **代码**: `caravan.attributes[attribute] += value;`
- **问题**: 无 NaN/负值校验，`value = NaN` → 属性变 NaN，`value = -100` → 属性变负数
- **影响**: capacity 变 NaN → 载重检查失效；speedMultiplier 变 NaN → 运输时间变 NaN
- **源码行**:
  ```typescript
  // Line 348-353
  upgradeCaravan(caravanId: string, attribute: keyof CaravanAttributes, value: number): boolean {
    const caravan = this.caravans.get(caravanId);
    if (!caravan) return false;
    if (attribute === 'currentLoad') return false;
    caravan.attributes[attribute] += value;  // 无校验
    return true;
  }
  ```
- **修复**: 添加 `!Number.isFinite(value) || value <= 0` 校验

### P0-003: CaravanSystem.dispatch NaN 货物数量绕过载重检查
- **位置**: `CaravanSystem.ts:205-209`
- **代码**: `totalWeight += qty;` → `if (totalWeight > caravan.attributes.capacity)`
- **问题**: `qty = NaN` → `totalWeight = NaN` → `NaN > capacity` → `false` → 绕过载重限制
- **影响**: NaN 货物被装载，后续计算全部 NaN 污染
- **修复**: 在循环中添加 `if (!Number.isFinite(qty) || qty < 0) return error`

### P0-004: TradeSystem.calculateProfit NaN 传播
- **位置**: `TradeSystem.ts:195-208`
- **代码**: `bargainingPower - 1` / `guardCost` 直接参与计算
- **问题**: `bargainingPower = NaN` → `adjustedRevenue = NaN` → `profit = NaN` → `profitRate = NaN`
- **影响**: 返回 NaN 的利润数据，UI 显示异常
- **修复**: 添加参数校验 `!Number.isFinite(bargainingPower) || bargainingPower < 0` 等

### P0-005: CaravanSystem 未被 engine-save 覆盖 — 商队状态丢失
- **位置**: `engine-save.ts` — SaveContext、buildSaveData、applySaveData
- **代码**: SaveContext 无 `caravan` 字段；buildSaveData 无 `ctx.caravan?.serialize()`
- **问题**: CaravanSystem 有 serialize/deserialize 方法，但 engine-save 完全未接入
- **影响**: 
  - 商队派遣状态（traveling/returning）在 save/load 后丢失
  - 护卫互斥表（guardAssignments）在 save/load 后丢失
  - 商队升级属性在 save/load 后丢失
  - 新增商队在 save/load 后丢失
- **BR规则**: BR-014 (保存/加载覆盖扫描)、BR-015 (deserialize覆盖验证六处)
- **六处检查**:
  1. GameSaveData → ❌ 无 caravan 字段
  2. SaveContext → ❌ 无 caravan 字段
  3. buildSaveData → ❌ 无 ctx.caravan?.serialize()
  4. toIGameState → ❌ 无
  5. fromIGameState → ❌ 无
  6. applySaveData → ❌ 无 ctx.caravan?.deserialize()
- **修复**: 六处同步添加 caravan 支持

### P0-006: TradeSystem.serialize caravans 字段硬编码空数组
- **位置**: `TradeSystem.ts:295` (serialize方法)
- **代码**: `caravans: []`
- **问题**: serialize 总是写入空数组，deserialize 读取后也是空数组，但实际商队数据在 CaravanSystem 中
- **影响**: 即使 engine-save 接入了 TradeSystem，商队数据仍然丢失
- **修复**: TradeSystem 不应序列化 caravans（由 CaravanSystem 独立管理），或从 TradeSaveData 中移除 caravans 字段

### P0-007: ResourceTradeEngine 未被 engine-save 覆盖
- **位置**: `engine-save.ts` — SaveContext、buildSaveData、applySaveData
- **问题**: ResourceTradeEngine 无内部状态（无状态引擎），但 engine-save 也未检查
- **影响**: 当前无实际影响（ResourceTradeEngine.reset() 为空），但违反 BR-014 规则
- **严重度降级**: P0 → P2（无状态引擎，无数据丢失风险）
- **修正**: 标记为 P2，不需要修复

### P0-008: TradeSystem.deserialize null/undefined 输入崩溃
- **位置**: `TradeSystem.ts:300-308`
- **代码**: 
  ```typescript
  deserialize(data: TradeSaveData): void {
    if (data.version !== TRADE_SAVE_VERSION) { throw ... }
    // data.routes 可能 undefined → Object.entries(undefined) 抛异常
    for (const [id, state] of Object.entries(data.routes)) ...
    for (const [id, price] of Object.entries(data.prices)) ...
  }
  ```
- **问题**: 如果 `data.routes` 或 `data.prices` 为 null/undefined，Object.entries 抛异常
- **影响**: 存档损坏时无法优雅降级
- **修复**: 添加 null 安全检查

### P0-009: CaravanSystem.deserialize null/undefined 输入崩溃
- **位置**: `CaravanSystem.ts:362-371`
- **代码**: `for (const c of data.caravans)` — data.caravans 可能为 null/undefined
- **问题**: 同 P0-008
- **修复**: 添加 null 安全检查

---

## P1 确认清单

### P1-001: 负数 cargo qty 在 dispatch 中未校验
- **位置**: `CaravanSystem.ts:205-209`
- **问题**: `qty = -5` → `totalWeight -= 5` → 可绕过载重上限
- **影响**: 玩家可装载超过上限的货物

### P1-002: Infinity 作为 amount 传入 tradeResource
- **位置**: `ResourceTradeEngine.ts:164`
- **问题**: `Infinity <= 0` → `false` → 绕过；`Infinity * 0.1` → `Infinity`；`Math.floor(Infinity)` → `Infinity`
- **影响**: Infinity 数值进入资源系统
- **BR规则**: BR-019 (Infinity序列化)

### P1-003: deserialize 版本不匹配硬抛异常
- **位置**: `TradeSystem.ts:301`, `CaravanSystem.ts:364`
- **问题**: 版本不匹配直接 throw，无降级处理
- **影响**: 未来版本升级后旧存档无法加载

---

## NaN 绕过专项扫描

| API | 检查方式 | NaN绕过? | 修复方案 |
|-----|---------|----------|---------|
| tradeResource amount | `amount <= 0` | ✅ 是 | `!Number.isFinite(amount) \|\| amount <= 0` |
| canTradeResource amount | `amount <= 0` | ✅ 是 | 同上 |
| calculateProfit bargainingPower | 无检查 | ✅ 是 | 添加校验 |
| calculateProfit guardCost | 无检查 | ✅ 是 | 添加校验 |
| calculateProfit cargo qty | 无检查 | ✅ 是 | 添加校验 |
| upgradeCaravan value | 无检查 | ✅ 是 | 添加校验 |
| dispatch cargo qty | 无检查 | ✅ 是 | 添加校验 |
| openRoute castleLevel | 无检查 | ❌ 间接比较 | 低风险 |
| dispatch request.cargo | `totalWeight > capacity` | ✅ 是 | NaN > capacity = false |

## engine-save 接入扫描

| 子系统 | SaveContext | buildSaveData | applySaveData | GameSaveData | 状态 |
|--------|-------------|---------------|---------------|--------------|------|
| TradeSystem | ✅ `trade?` | ✅ `ctx.trade?.serialize()` | ✅ `ctx.trade?.deserialize()` | ✅ `trade?` | ⚠️ caravans字段空 |
| CaravanSystem | ❌ | ❌ | ❌ | ❌ | **缺失** |
| ResourceTradeEngine | ❌ | ❌ | ❌ | ❌ | P2(无状态) |

## 资源比较 NaN 防护扫描 (BR-021)

| API | 比较语句 | NaN安全? |
|-----|---------|---------|
| tradeResource | `currentAmount < amount` | ❌ NaN绕过 |
| checkResourceProtection | `afterTrade < MIN_GRAIN_RESERVE` | ❌ NaN绕过 |
| checkResourceProtection | `currentAmount < GOLD_SAFETY_LINE` | ❌ 如果currentAmount是NaN |
| dispatch | `totalWeight > capacity` | ❌ NaN绕过 |

---

## 总结

| 级别 | 数量 | 关键问题 |
|------|------|---------|
| P0 | 9 | NaN绕过(4)、engine-save缺失(3)、deserialize null(2) |
| P1 | 3 | 负值漏洞、Infinity、版本兼容 |
| P2 | 2 | ResourceTradeEngine save(无状态)、依赖未注入 |

**最高风险**: P0-005 (CaravanSystem save缺失) — 玩家商队派遣/升级/护卫数据在每次存档后丢失。
