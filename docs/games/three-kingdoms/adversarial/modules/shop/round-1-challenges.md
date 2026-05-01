# Shop 模块 R1 对抗式测试 — Challenger 审查

> Challenger Agent | 2026-05-01
> 审查策略：NaN绕过、折扣率篡改、serialize缺失、deserialize注入、经济漏洞、溢出闭环

---

## P0 确认清单

### P0-001: setShopLevel 无NaN/负数/Infinity防护
- **位置**: `ShopSystem.ts:424`
- **代码**: `this.shops[shopType].shopLevel = level;`
- **问题**: 无 `!Number.isFinite(level)` 检查
- **影响**: 
  - `level = NaN` → `getShopLevel()` 返回NaN → 后续等级判断逻辑异常
  - `level = -1` → 商店等级为负，可能解锁不应有的商品
  - `level = Infinity` → 序列化时 `JSON.stringify(Infinity)` = `null` → 反序列化后为null
- **源码行**:
  ```typescript
  setShopLevel(shopType: ShopType, level: number): void {
    this.shops[shopType].shopLevel = level; // 无任何校验
  }
  ```
- **修复**: `if (!Number.isFinite(level) || level < 1) return;`
- **BR规则**: BR-01 (数值API入口NaN检查), BR-17 (战斗数值安全→通用数值安全)

### P0-002: calculateFinalPrice 折扣率NaN传播链
- **位置**: `ShopSystem.ts:209-232`
- **代码**: `const finalRate = Math.min(itemDiscount, npcRate, activeRate);`
- **问题**: 三个折扣来源均可能产生NaN，且无防护
- **影响**:
  - 路径1: `npcDiscountProvider` 返回NaN → `npcRate = NaN` → `finalRate = NaN`
  - 路径2: `addDiscount({ rate: NaN })` → `activeRate = NaN` → `finalRate = NaN`
  - 路径3: `item.discount` 为NaN（通过deserialize注入）→ `itemDiscount = NaN` → `finalRate = NaN`
  - `Math.ceil(price * NaN)` = NaN → 传播到 `validateBuy` → `executeBuy` → `spendByPriority(NaN)`
  - **NaN穿透路径**: discount → price → validation → purchase → currency system
- **源码行**:
  ```typescript
  let npcRate = 1;
  if (npcId && this.npcDiscountProvider) npcRate = this.npcDiscountProvider(npcId); // 无NaN检查
  // ...
  const finalRate = Math.min(itemDiscount, npcRate, activeRate); // NaN污染所有
  result[cur] = Math.ceil(price * finalRate); // NaN传播
  ```
- **修复**: `const finalRate = Math.max(0.01, Math.min(1, Number.isFinite(itemDiscount) ? itemDiscount : 1, ...))`
- **BR规则**: BR-01, BR-06 (NaN绕过教训)

### P0-003: executeBuy 购买后stock/dailyPurchased溢出
- **位置**: `ShopSystem.ts:298-303`
- **代码**: `item.stock -= quantity; item.dailyPurchased += quantity;`
- **问题**: `validateBuy` 允许 `quantity = Number.MAX_SAFE_INTEGER`（正整数），导致溢出
- **影响**:
  - `stock -= 9007199254740991` → 精度丢失或负数
  - `dailyPurchased += 9007199254740991` → 超过安全整数范围
  - 后续 `dailyPurchased + quantity > dailyLimit` 比较可能因精度丢失而失效
- **源码行**:
  ```typescript
  if (item.stock !== -1) item.stock -= quantity;       // 无溢出检查
  item.dailyPurchased += quantity;                       // 无溢出检查
  item.lifetimePurchased += quantity;                    // 无溢出检查
  ```
- **修复**: 在 `validateBuy` 中添加 `if (quantity > 9999)` 上限检查
- **BR规则**: BR-12 (溢出闭环)

### P0-004: addDiscount 无rate合法性验证
- **位置**: `ShopSystem.ts:234`
- **代码**: `this.activeDiscounts.push(config);`
- **问题**: rate字段无任何校验
- **影响**:
  - `rate: 0` → 商品免费（`Math.ceil(price * 0) = 0`）→ 免费购买
  - `rate: -1` → 负数价格 → 购买倒赚
  - `rate: NaN` → NaN传播（见P0-002）
  - `rate: 2` → 价格翻倍（折扣率>1应为加价）
  - `startTime > endTime` → 折扣永不过期但也不生效（逻辑混乱）
- **源码行**:
  ```typescript
  addDiscount(config: DiscountConfig): void { this.activeDiscounts.push(config); }
  ```
- **修复**: 验证 `rate ∈ (0, 1]` 且 `!isNaN(rate)` 且 `startTime <= endTime`
- **BR规则**: BR-01, BR-17

### P0-005: serialize 遗漏 activeDiscounts — 折扣数据丢失
- **位置**: `ShopSystem.ts:428-430`
- **代码**: `return { shops: { ...this.shops }, favorites: [...this.favorites], version: ... };`
- **问题**: `activeDiscounts` 数组未序列化
- **影响**:
  - 限时折扣活动在 save/load 后全部丢失
  - 玩家看到的折扣消失，影响游戏体验
  - 运营活动折扣无法持久化
- **六处检查**:
  1. ShopSaveData 类型 → ❌ 无 `activeDiscounts` 字段
  2. serialize() → ❌ 未包含 `activeDiscounts`
  3. deserialize() → ❌ 未恢复 `activeDiscounts`
  4. ShopState 类型 → ✅ 有 `goods` (discount在item内)
  5. `lastUpdateTick` → ❌ 未持久化（影响定时补货）
  6. `npcDiscountProvider` → ✅ 回调函数，不持久化（可接受）
- **修复**: ShopSaveData添加 `activeDiscounts` 字段，serialize/deserialize同步
- **BR规则**: BR-14 (保存/加载覆盖扫描), BR-15 (deserialize覆盖验证)

### P0-006: deserialize 无数据完整性验证 — 反序列化注入
- **位置**: `ShopSystem.ts:432-437`
- **代码**: `if (data.shops[type]) this.shops[type] = data.shops[type];`
- **问题**: 直接赋值，无任何验证
- **影响**:
  - `data.shops[type].shopLevel` 可注入 NaN/负数/Infinity
  - `data.shops[type].goods[].stock` 可注入负数（无限购买）
  - `data.shops[type].goods[].discount` 可注入0（免费）或负数（倒赚）
  - `data.shops[type].goods[].dailyPurchased` 可注入负数（重置限购）
  - `data.shops[type].manualRefreshCount` 可注入负数（无限刷新）
  - `data.favorites` 可包含不存在的商品ID
  - `data` 本身为 null/undefined → crash
- **源码行**:
  ```typescript
  deserialize(data: ShopSaveData): void {
    if (data.version !== SHOP_SAVE_VERSION) gameLog.warn(...); // 仅warn
    for (const type of SHOP_TYPES) {
      if (data.shops[type]) this.shops[type] = data.shops[type]; // 直接赋值
    }
    // 无null检查、无数值验证
  }
  ```
- **修复**: 
  1. `if (!data) return;` 顶层防护
  2. 对关键字段做 `Number.isFinite` 验证
  3. favorites 做 `GOODS_DEF_MAP[id]` 存在性验证
- **BR规则**: BR-10 (deserialize覆盖验证), BR-15

---

## P1 确认清单

### P1-001: manualRefresh 无扣费 — 经济漏洞
- **位置**: `ShopSystem.ts:370-377`
- **问题**: `DEFAULT_RESTOCK_CONFIG.manualRefreshCost` 定义了 `{ copper: 500 }` 但从未使用
- **影响**: 玩家可无限免费刷新所有商店
- **修复**: 刷新前调用 `currencyOps.spendByPriority` 扣费
- **BR规则**: BR-12 (溢出闭环)

### P1-002: filterGoods keyword为null时crash
- **位置**: `ShopSystem.ts:170`
- **代码**: `filter.keyword.toLowerCase()` → NPE if keyword is null/undefined
- **影响**: 传入 `{ keyword: null }` 时crash
- **修复**: `if (filter.keyword && typeof filter.keyword === 'string')`

### P1-003: validateBuy Infinity检查（实际安全但建议加固）
- **位置**: `ShopSystem.ts:244-245`
- **代码**: `!Number.isInteger(quantity)` → `Number.isInteger(Infinity)` = false → 已拦截
- **影响**: 实际安全，但建议显式添加 `!Number.isFinite(quantity)` 提高可读性
- **修复**: 添加显式检查

---

## NaN 绕过专项扫描

| API | 检查方式 | NaN绕过? | Infinity绕过? | 修复方案 |
|-----|---------|----------|--------------|---------|
| validateBuy quantity | `!quantity \|\| quantity <= 0 \|\| !Number.isInteger(quantity)` | ❌ 安全 | ❌ 安全 | 已安全 |
| executeBuy (via validateBuy) | 依赖validateBuy | ❌ 安全 | ❌ 安全 | 已安全 |
| setShopLevel level | 无检查 | ✅ 是 | ✅ 是 | `!Number.isFinite(level) \|\| level < 1` |
| calculateFinalPrice npcRate | 无检查 | ✅ 是 | ✅ 是 | Math.min前验证 |
| calculateFinalPrice activeRate | 无检查 | ✅ 是 | ✅ 是 | addDiscount时验证 |
| addDiscount rate | 无检查 | ✅ 是 | ✅ 是 | rate ∈ (0,1] |
| filterGoods priceRange | 无检查 | ✅ 是 | — | NaN比较返回false |
| manualRefresh | 无数值参数 | — | — | 安全 |

## 资源比较 NaN 防护扫描 (BR-021)

| API | 比较语句 | NaN安全? |
|-----|---------|---------|
| validateBuy stock | `item.stock < quantity` | ✅ stock从配置来，安全 |
| validateBuy dailyLimit | `dailyPurchased + quantity > dailyLimit` | ✅ quantity已验证 |
| validateBuy lifetimeLimit | `lifetimePurchased + quantity > lifetimeLimit` | ✅ 同上 |
| validateBuy currencyOps | `checkAffordability(totalCost)` | ❌ totalCost含NaN时 → 依赖CurrencySystem |
| calculateFinalPrice | `price * finalRate` | ❌ finalRate可为NaN |
| filterGoods priceRange | `p >= min && p <= max` | ❌ NaN比较=false，安全但结果错误 |

## engine-save 接入扫描

| 子系统 | serialize() | deserialize() | engine-save接入 | 状态 |
|--------|-------------|---------------|----------------|------|
| ShopSystem | ✅ 有（缺activeDiscounts） | ✅ 有（无验证） | 需验证 | ⚠️ 部分缺失 |

---

## 总结

| 级别 | 数量 | 关键问题 |
|------|------|---------|
| P0 | 6 | NaN传播(2)、溢出(1)、折扣篡改(1)、serialize缺失(1)、deserialize注入(1) |
| P1 | 3 | 经济漏洞(1)、NPE(1)、加固建议(1) |

**最高风险**: P0-002 (calculateFinalPrice NaN传播链) — 三入口NaN可穿透到货币系统，影响整个经济体系。
