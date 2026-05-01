# Shop 模块 Round-1 流程树

> 版本: v1.0 | 日期: 2026-05-01
> 源码路径: `src/games/three-kingdoms/engine/shop/`
> Builder规则: v1.8 | P0模式库: v1.8 (22个模式)

---

## 模块概览

| 子系统 | 文件 | 行数 | 公开API数 | 状态 |
|--------|------|------|-----------|------|
| ShopSystem | ShopSystem.ts | 480 | 24 | 🔴 关键发现 |
| shop.types | shop.types.ts | 267 | — | ✅ 纯类型 |
| shop-config | shop-config.ts | 98 | 6常量 | ✅ 纯数据 |
| goods-data | goods-data.ts | 361 | 2映射 | ✅ 纯数据 |

**总计**: 1个子系统, ~24个公开API, 8个私有方法, ~80个分支节点

---

## 🔴 P0 关键发现

### DEF-SHOP-001: setShopLevel 无NaN/负数/溢出防护（模式1/21）

**严重度**: P0 - 状态污染  
**影响范围**: `setShopLevel()` L424  
**规则违反**: BR-01(数值API入口NaN检查), BR-17(战斗数值安全→通用数值安全)

**证据**:
```typescript
// ShopSystem.ts L424
setShopLevel(shopType: ShopType, level: number): void {
  this.shops[shopType].shopLevel = level;
}
```
- 无 `!Number.isFinite(level) || level <= 0` 检查
- NaN写入后 → `getShopLevel()` 返回 NaN
- 负数写入后 → 商店等级为负数，影响商品品质判断
- Infinity写入后 → 序列化时可能出问题

**修复建议**: 添加 `if (!Number.isFinite(level) || level < 1) return;`

---

### DEF-SHOP-002: calculateFinalPrice 折扣率无NaN防护（模式1/21）

**严重度**: P0 - NaN传播  
**影响范围**: `calculateFinalPrice()` L209-232  
**规则违反**: BR-01(NaN检查), BR-17(数值安全)

**证据**:
```typescript
// ShopSystem.ts L226-228
const finalRate = Math.min(itemDiscount, npcRate, activeRate);
const result: Record<string, number> = {};
for (const [cur, price] of Object.entries(def.basePrice)) {
  result[cur] = Math.ceil(price * finalRate);
}
```
- `npcDiscountProvider` 返回NaN → `npcRate = NaN` → `finalRate = NaN` → 所有价格为NaN
- `addDiscount({ rate: NaN })` → `activeRate = NaN` → `finalRate = NaN`
- `Math.ceil(NaN)` = NaN，传播到 `validateBuy` 的 `finalPrice`
- NaN价格通过 `validateBuy` → `executeBuy` → `spendByPriority(NaN cost)` → 货币系统异常

**修复建议**: `const finalRate = Math.max(0, Math.min(1, Number.isFinite(r) ? r : 1))` 对每个rate做防护

---

### DEF-SHOP-003: executeBuy 购买后stock/dailyPurchased无溢出防护（模式12/21）

**严重度**: P0 - 状态不一致  
**影响范围**: `executeBuy()` L298-303  
**规则违反**: BR-12(溢出闭环)

**证据**:
```typescript
// ShopSystem.ts L298-303
if (item.stock !== -1) item.stock -= quantity;
item.dailyPurchased += quantity;
item.lifetimePurchased += quantity;
```
- `quantity = Number.MAX_SAFE_INTEGER` 通过验证（正整数）→ stock 溢出为负数
- `dailyPurchased += quantity` → 超过 `Number.MAX_SAFE_INTEGER` → 精度丢失
- `lifetimePurchased += quantity` → 同上

**修复建议**: 添加 `quantity` 上限检查（如 `quantity > 9999` 拒绝），或 `Math.min` 防溢出

---

### DEF-SHOP-004: addDiscount 无rate合法性验证（模式1/21）

**严重度**: P0 - 折扣篡改  
**影响范围**: `addDiscount()` L234  
**规则违反**: BR-01(NaN检查), BR-17(数值安全)

**证据**:
```typescript
// ShopSystem.ts L234
addDiscount(config: DiscountConfig): void { this.activeDiscounts.push(config); }
```
- `rate: 0` → 商品免费（`Math.ceil(price * 0) = 0`）
- `rate: -1` → `Math.ceil(price * -1)` = 负数价格 → 购买倒赚
- `rate: NaN` → NaN传播（见DEF-SHOP-002）
- `rate: Infinity` → `Math.ceil(price * Infinity)` = Infinity
- `startTime > endTime` → 折扣永远不生效（低风险但无验证）
- `applicableGoods` 含无效ID → 无影响但无验证

**修复建议**: 验证 `rate ∈ (0, 1]` 且 `!isNaN(rate)`

---

### DEF-SHOP-005: validateBuy quantity检查不防Infinity（模式1/21）

**严重度**: P0 - Infinity绕过  
**影响范围**: `validateBuy()` L244  
**规则违反**: BR-01(NaN检查), BR-19(Infinity序列化)

**证据**:
```typescript
// ShopSystem.ts L244-245
if (!quantity || quantity <= 0 || !Number.isInteger(quantity)) {
  return { canBuy: false, ... };
}
```
- `Number.isInteger(Infinity)` = false → **Infinity被正确拦截** ✅
- 但 `Number.isInteger(-Infinity)` = false → **-Infinity也被拦截** ✅
- **然而**: `Number.isInteger(NaN)` = false → NaN被拦截 ✅
- **实际风险**: 此处检查是安全的，但下游 `executeBuy` 依赖 `validateBuy` 的结果，若 `validateBuy` 被绕过（如直接修改返回值），则无二次防护

**实际风险降为P1**，但建议增加 `!Number.isFinite(quantity)` 显式检查

---

### DEF-SHOP-006: serialize/deserialize 无activeDiscounts持久化（模式7/15）

**严重度**: P0 - 数据丢失  
**影响范围**: `serialize()` L428-430, `deserialize()` L432-437  
**规则违反**: BR-14(保存/加载覆盖扫描), BR-15(deserialize覆盖验证)

**证据**:
```typescript
// ShopSystem.ts L428-430
serialize(): ShopSaveData {
  return { shops: { ...this.shops }, favorites: [...this.favorites], version: SHOP_SAVE_VERSION };
}
// activeDiscounts 未序列化！
```
```typescript
// ShopSystem.ts L432-437
deserialize(data: ShopSaveData): void {
  // ...
  // activeDiscounts 未反序列化！
}
```
- `activeDiscounts` 数组未包含在 `ShopSaveData` 类型中
- 限时折扣活动在存档→读档后丢失
- `npcDiscountProvider` 是回调函数，不持久化（可接受，但需文档说明）
- `lastUpdateTick` 未持久化（影响update中的定时补货判断）

**修复建议**: 
1. `ShopSaveData` 添加 `activeDiscounts` 字段
2. `serialize` 包含 `activeDiscounts`
3. `deserialize` 恢复 `activeDiscounts`

---

### DEF-SHOP-007: deserialize 无数据完整性验证（模式10/15）

**严重度**: P0 - 反序列化注入  
**影响范围**: `deserialize()` L432-437  
**规则违反**: BR-10(deserialize覆盖验证), BR-15

**证据**:
```typescript
// ShopSystem.ts L434-436
for (const type of SHOP_TYPES) {
  if (data.shops[type]) this.shops[type] = data.shops[type];
}
```
- `data.shops[type].goods` 可被注入为任意对象（含恶意stock/discount值）
- `data.shops[type].shopLevel` 可被注入为 NaN/负数/Infinity
- `data.shops[type].manualRefreshCount` 可被注入为负数
- `data.favorites` 可包含不存在的商品ID
- `data` 本身可为 null/undefined → 无null检查

**修复建议**: 
1. 添加 `if (!data) return;` 顶层防护
2. 对每个恢复的字段做 `Number.isFinite` 验证
3. favorites 做 `GOODS_DEF_MAP[id]` 存在性验证

---

### DEF-SHOP-008: manualRefresh 无currencyOps扣费（模式12/21）

**严重度**: P1 - 经济漏洞  
**影响范围**: `manualRefresh()` L370-377  
**规则违反**: BR-12(溢出闭环)

**证据**:
```typescript
// ShopSystem.ts L370-377
manualRefresh(): { success: boolean; reason?: string } {
  for (const type of SHOP_TYPES) {
    if (this.shops[type].manualRefreshCount >= this.shops[type].manualRefreshLimit)
      return { success: false, reason: '今日刷新次数已用完' };
  }
  // 无扣费逻辑！配置中有 manualRefreshCost: { copper: 500 }
  const now = Date.now();
  for (const type of SHOP_TYPES) {
    this.shops[type].manualRefreshCount++;
    this.restockShop(type, now);
  }
  return { success: true };
}
```
- `DEFAULT_RESTOCK_CONFIG.manualRefreshCost` 定义了 `{ copper: 500 }` 但从未使用
- 手动刷新不扣费 → 免费刷新所有商店

**修复建议**: 在刷新前调用 `currencyOps.spendByPriority` 扣费

---

## 子系统流程树

### 1. ShopSystem — 商品查询（#1, #5, #6）

| # | API | 分支 | 状态 | P0模式扫描 |
|---|-----|------|------|-----------|
| 1.1 | `getShopGoods(shopType)` | shopType不存在→undefined | ✅ covered | P1: JS可选链安全 |
| 1.2 | `getGoodsByCategory(shopType, cat)` | shopType无效→异常 | ⚠️ uncovered | P1: this.shops[undefined]会throw |
| 1.3 | `getCategories()` | 返回静态数据 | ✅ covered | 安全 |
| 1.4 | `getGoodsDef(defId)` | defId不存在→undefined | ✅ covered | P1: 安全 |
| 1.5 | `getGoodsItem(shopType, defId)` | 不存在→undefined | ✅ covered | P1: 安全 |
| 1.6 | `filterGoods(shopType, filter)` | keyword为null→crash | ⚠️ uncovered | **P1**: `filter.keyword.toLowerCase()` → NPE if null |
| 1.7 | `filterGoods` priceRange | priceRange含NaN→比较失败 | ⚠️ uncovered | P1: 不crash但结果错误 |

### 2. ShopSystem — 定价与折扣（#2, #7）

| # | API | 分支 | 状态 | P0模式扫描 |
|---|-----|------|------|-----------|
| 2.1 | `calculateFinalPrice(defId, shopType)` | defId不存在→{} | ✅ covered | 安全 |
| 2.2 | `calculateFinalPrice` itemDiscount | discount为NaN→NaN价格 | 🔴 **DEF-SHOP-002** | **P0模式1**: NaN传播 |
| 2.3 | `calculateFinalPrice` npcRate | provider返回NaN→NaN价格 | 🔴 **DEF-SHOP-002** | **P0模式1**: NaN传播 |
| 2.4 | `calculateFinalPrice` activeRate | discount.rate为NaN→NaN | 🔴 **DEF-SHOP-002** | **P0模式1**: NaN传播 |
| 2.5 | `addDiscount(config)` | rate无验证 | 🔴 **DEF-SHOP-004** | **P0模式1**: 无边界检查 |
| 2.6 | `cleanupExpiredDiscounts()` | 正常流程 | ✅ covered | 安全 |

### 3. ShopSystem — 购买逻辑（#3, #8）

| # | API | 分支 | 状态 | P0模式扫描 |
|---|-----|------|------|-----------|
| 3.1 | `validateBuy` quantity=0 | 返回不可购买 | ✅ covered | 安全 |
| 3.2 | `validateBuy` quantity<0 | 返回不可购买 | ✅ covered | 安全 |
| 3.3 | `validateBuy` quantity=NaN | 返回不可购买 | ✅ covered | 安全 |
| 3.4 | `validateBuy` quantity=Infinity | 返回不可购买 | ✅ covered | 安全 |
| 3.5 | `validateBuy` goodsId不存在 | 返回不可购买 | ✅ covered | 安全 |
| 3.6 | `validateBuy` 库存不足 | 返回不可购买 | ✅ covered | 安全 |
| 3.7 | `validateBuy` 日限购超限 | 返回不可购买 | ✅ covered | 安全 |
| 3.8 | `validateBuy` 终身限购超限 | 返回不可购买 | ✅ covered | 安全 |
| 3.9 | `validateBuy` 货币不足 | 返回不可购买 | ✅ covered | 安全 |
| 3.10 | `validateBuy` NaN价格 | NaN通过→executeBuy | 🔴 **DEF-SHOP-002** | **P0模式1**: NaN穿透 |
| 3.11 | `executeBuy` 验证不通过 | 返回失败 | ✅ covered | 安全 |
| 3.12 | `executeBuy` spendByPriority异常 | catch返回失败 | ✅ covered | 安全 |
| 3.13 | `executeBuy` 扣费后stock溢出 | stock变负数 | 🔴 **DEF-SHOP-003** | **P0模式12**: 溢出 |
| 3.14 | `executeBuy` eventBus.emit异常 | catch静默 | ✅ covered | 安全 |

### 4. ShopSystem — 库存与限购（#9）

| # | API | 分支 | 状态 | P0模式扫描 |
|---|-----|------|------|-----------|
| 4.1 | `getStockInfo(shopType, defId)` | item不存在→null | ✅ covered | 安全 |
| 4.2 | `resetDailyLimits()` | 正常重置 | ✅ covered | 安全 |
| 4.3 | `manualRefresh()` 次数用完 | 返回失败 | ✅ covered | 安全 |
| 4.4 | `manualRefresh()` 成功 | 无扣费 | 🔴 **DEF-SHOP-008** | P1: 经济漏洞 |

### 5. ShopSystem — 收藏管理

| # | API | 分支 | 状态 | P0模式扫描 |
|---|-----|------|------|-----------|
| 5.1 | `toggleFavorite(defId)` | defId不存在→false | ✅ covered | 安全 |
| 5.2 | `toggleFavorite(defId)` | def.favoritable=false→false | ✅ covered | 安全 |
| 5.3 | `toggleFavorite` 添加 | 返回true | ✅ covered | 安全 |
| 5.4 | `toggleFavorite` 移除 | 返回false | ✅ covered | 安全 |
| 5.5 | `isFavorite(defId)` | 正常查询 | ✅ covered | 安全 |
| 5.6 | `getFavorites()` | 返回拷贝 | ✅ covered | 安全 |

### 6. ShopSystem — 离线补货

| # | API | 分支 | 状态 | P0模式扫描 |
|---|-----|------|------|-----------|
| 6.1 | `processOfflineRestock()` 正常 | 补货+稀有概率 | ✅ covered | 安全 |
| 6.2 | `processOfflineRestock()` elapsed=0 | accumulated=0→跳过 | ✅ covered | 安全 |
| 6.3 | `processOfflineRestock()` 稀有折扣 | discount=0.7覆盖 | ✅ covered | 安全 |

### 7. ShopSystem — 商店等级

| # | API | 分支 | 状态 | P0模式扫描 |
|---|-----|------|------|-----------|
| 7.1 | `getShopLevel(shopType)` | 正常返回 | ✅ covered | 安全 |
| 7.2 | `setShopLevel(shopType, level)` | NaN/负数/Infinity | 🔴 **DEF-SHOP-001** | **P0模式1**: 无验证 |

### 8. ShopSystem — 序列化

| # | API | 分支 | 状态 | P0模式扫描 |
|---|-----|------|------|-----------|
| 8.1 | `serialize()` 正常 | 包含shops+favorites | ✅ covered | 安全 |
| 8.2 | `serialize()` 遗漏activeDiscounts | 折扣丢失 | 🔴 **DEF-SHOP-006** | **P0模式7/15**: 数据丢失 |
| 8.3 | `deserialize()` 正常 | 恢复shops+favorites | ✅ covered | 安全 |
| 8.4 | `deserialize(null)` | null→crash | 🔴 **DEF-SHOP-007** | **P0模式10**: NPE |
| 8.5 | `deserialize()` 恶意数据 | 注入NaN/负数stock | 🔴 **DEF-SHOP-007** | **P0模式10**: 注入 |

### 9. ShopSystem — 依赖注入

| # | API | 分支 | 状态 | P0模式扫描 |
|---|-----|------|------|-----------|
| 9.1 | `setCurrencyOps(ops)` | 正常注入 | ✅ covered | 安全 |
| 9.2 | `setCurrencySystem(cs)` | deprecated兼容 | ✅ covered | 安全 |
| 9.3 | `setNPCDiscountProvider(fn)` | fn返回NaN | 🔴 **DEF-SHOP-002** | **P0模式1**: NaN传播 |
| 9.4 | `init(deps)` | deps含eventBus | ✅ covered | 安全 |

---

## 跨系统链路枚举

| # | 链路 | 路径 | 风险 |
|---|------|------|------|
| CS-1 | Shop→Currency | `executeBuy→currencyOps.spendByPriority` | ✅ 有try-catch |
| CS-2 | Shop→EventBus | `executeBuy→eventBus.emit('shop:goods_purchased')` | ✅ 有try-catch |
| CS-3 | Shop→NPC | `calculateFinalPrice→npcDiscountProvider` | 🔴 NaN传播 |
| CS-4 | Shop→Engine-Save | `serialize→buildSaveData` | 🔴 activeDiscounts丢失 |
| CS-5 | Shop→Engine-Load | `deserialize→applySaveData` | 🔴 无数据验证 |
| CS-6 | Shop→Update循环 | `update→restockShop` | ✅ 安全 |
| CS-7 | Shop→Trade | 外部集成（trade-currency-shop） | ✅ 有集成测试 |
| CS-8 | Shop→Inventory | `executeBuy` 后无库存交付 | ⚠️ P2: 购买后无物品交付逻辑 |

---

## P0 汇总

| ID | 严重度 | 描述 | 模式 | 修复复杂度 |
|----|--------|------|------|-----------|
| DEF-SHOP-001 | P0 | setShopLevel无NaN/负数防护 | 模式1 | 低（2行） |
| DEF-SHOP-002 | P0 | calculateFinalPrice折扣率NaN传播 | 模式1 | 中（6行） |
| DEF-SHOP-003 | P0 | executeBuy购买后stock溢出 | 模式12 | 低（3行） |
| DEF-SHOP-004 | P0 | addDiscount无rate验证 | 模式1 | 低（4行） |
| DEF-SHOP-005 | P1↓ | validateBuy Infinity检查（实际安全） | 模式1 | 低（1行加固） |
| DEF-SHOP-006 | P0 | serialize遗漏activeDiscounts | 模式7/15 | 中（类型+逻辑） |
| DEF-SHOP-007 | P0 | deserialize无数据完整性验证 | 模式10 | 中（验证逻辑） |
| DEF-SHOP-008 | P1 | manualRefresh无扣费 | 模式12 | 低（5行） |

**P0总数**: 6个（DEF-SHOP-001/002/003/004/006/007）  
**P1总数**: 2个（DEF-SHOP-005/008）
