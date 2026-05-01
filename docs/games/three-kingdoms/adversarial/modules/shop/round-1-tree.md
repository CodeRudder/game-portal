# Shop 模块 R1 对抗式测试 — 流程树

> Builder Agent | 版本: v1.8 规则 | 日期: 2026-05-01
> 模块: `src/games/three-kingdoms/engine/shop/`
> 源文件: 2个引擎 + 4个核心 | 总行数: ~1,350行

## 模块概览

| 子系统 | 文件 | 行数 | 公开API数 | 序列化 |
|--------|------|------|-----------|--------|
| ShopSystem | ShopSystem.ts | ~480 | 24 | serialize/deserialize |
| shop.types | shop.types.ts | ~267 | — (纯类型) | N/A |
| shop-config | shop-config.ts | ~98 | 6常量 | N/A |
| goods-data | goods-data.ts | ~361 | 2映射 | N/A |

**总计公开API: 24个** | **ISubsystem方法: init/update/getState/reset**

---

## 公开API清单

| # | API | 签名 | 分类 |
|---|-----|------|------|
| 1 | init | (deps: ISystemDeps) => void | 生命周期 |
| 2 | update | (dt: number) => void | 生命周期 |
| 3 | getState | () => Record<ShopType, ShopState> | 查询 |
| 4 | reset | () => void | 生命周期 |
| 5 | setCurrencyOps | (ops: ShopCurrencyOps) => void | 依赖注入 |
| 6 | setCurrencySystem | (cs) => void | 依赖注入(deprecated) |
| 7 | setNPCDiscountProvider | (fn) => void | 依赖注入 |
| 8 | getShopGoods | (shopType) => GoodsItem[] | 查询 |
| 9 | getGoodsByCategory | (shopType, category) => GoodsItem[] | 查询 |
| 10 | getCategories | () => GoodsCategory[] | 查询 |
| 11 | getGoodsDef | (defId) => GoodsDef \| undefined | 查询 |
| 12 | getGoodsItem | (shopType, defId) => GoodsItem \| undefined | 查询 |
| 13 | filterGoods | (shopType, filter) => GoodsItem[] | 查询 |
| 14 | calculateFinalPrice | (defId, shopType, npcId?) => Record<string, number> | 定价 |
| 15 | addDiscount | (config: DiscountConfig) => void | 折扣 |
| 16 | cleanupExpiredDiscounts | () => number | 折扣 |
| 17 | validateBuy | (request: BuyRequest, npcId?) => BuyValidation | 购买 |
| 18 | executeBuy | (request: BuyRequest, npcId?) => BuyResult | 购买 |
| 19 | getStockInfo | (shopType, defId) => StockInfo \| null | 库存 |
| 20 | resetDailyLimits | () => void | 库存 |
| 21 | manualRefresh | () => { success, reason? } | 补货 |
| 22 | toggleFavorite | (defId) => boolean | 收藏 |
| 23 | isFavorite | (defId) => boolean | 收藏 |
| 24 | getFavorites | () => string[] | 收藏 |
| 25 | processOfflineRestock | () => void | 补货 |
| 26 | getShopLevel | (shopType) => number | 等级 |
| 27 | setShopLevel | (shopType, level) => void | 等级 |
| 28 | serialize | () => ShopSaveData | 序列化 |
| 29 | deserialize | (data: ShopSaveData) => void | 序列化 |

---

## F-0: 跨系统链路验证

### F-0.1: 保存/加载覆盖扫描 [BR-14/15]

| 检查点 | 状态 | 说明 |
|--------|------|------|
| serialize() | ✅ 已实现 | 包含shops/favorites/activeDiscounts/version |
| deserialize() | ✅ 已实现 | 含null防护、版本检查、rate过滤 |
| engine-save.ts引用 | ⚠️ 需验证 | 需确认buildSaveData中是否调用shop.serialize() |
| 六处同步 | ⚠️ 需验证 | GameSaveData/SaveContext/buildSaveData/toIGameState/fromIGameState/applySaveData |

### F-0.2: 依赖注入完整性

| 注入点 | 类型 | 初始化检查 | 空值防护 |
|--------|------|-----------|---------|
| setCurrencyOps | ShopCurrencyOps | ❌ 无强制初始化 | ⚠️ executeBuy有部分防护(FIX-SHOP-009) |
| setNPCDiscountProvider | 回调函数 | ❌ 无强制初始化 | ✅ calculateFinalPrice中检查null |
| deps (ISystemDeps) | init注入 | ❌ 无强制初始化 | ⚠️ eventBus用try-catch |

### F-0.3: 跨系统链路枚举（N=2×2=4条）

| # | 链路 | 路径 | 验证状态 |
|---|------|------|---------|
| 1 | Shop→Currency | executeBuy→currencyOps.spendByPriority | ✅ 有null防护 |
| 2 | Shop→EventBus | executeBuy→eventBus.emit | ✅ try-catch |
| 3 | Shop→NPC | calculateFinalPrice→npcDiscountProvider | ✅ null检查 |
| 4 | Shop←Engine | update→restockShop | ✅ 正常 |

---

## F-1: 商品查询域 (APIs 8-13)

### F-1.1: getShopGoods(shopType) — 正常流

| 节点 | 类型 | 描述 | 优先级 |
|------|------|------|--------|
| F-1.1-N01 | F-Normal | 正常获取normal商店商品列表 | covered |
| F-1.1-N02 | F-Boundary | shopType不存在于shops → 返回undefined的goods → [] | P2 |
| F-1.1-N03 | F-Normal | 获取所有4种商店类型 | covered |

### F-1.2: getGoodsByCategory(shopType, category) — 过滤

| 节点 | 类型 | 描述 | 优先级 |
|------|------|------|--------|
| F-1.2-N01 | F-Normal | 按resource分类过滤 | covered |
| F-1.2-N02 | F-Boundary | category无匹配商品 → [] | P2 |
| F-1.2-N03 | F-Error | shopType无效 → this.shops[undefined] 抛异常 | P1 |

### F-1.3: filterGoods(shopType, filter) — 搜索/排序

| 节点 | 类型 | 描述 | 优先级 |
|------|------|------|--------|
| F-1.3-N01 | F-Normal | 关键词搜索匹配name | covered |
| F-1.3-N02 | F-Normal | priceRange过滤 [min, max] | covered |
| F-1.3-N03 | F-Normal | sortBy=price, sortOrder=asc | covered |
| F-1.3-N04 | F-Normal | sortBy=default排序（收藏→折扣→价格） | covered |
| F-1.3-N05 | F-Boundary | filter={} → 返回全部商品 | P2 |
| F-1.3-N06 | F-Error | priceRange含NaN → 比较结果异常 | P1 |

### F-1.4: getGoodsDef(defId) / getGoodsItem(shopType, defId)

| 节点 | 类型 | 描述 | 优先级 |
|------|------|------|--------|
| F-1.4-N01 | F-Normal | 有效defId返回GoodsDef | covered |
| F-1.4-N02 | F-Error | defId不存在 → undefined | covered |
| F-1.4-N03 | F-Normal | getGoodsItem有效shopType+defId | covered |
| F-1.4-N04 | F-Error | getGoodsItem商品不在商店中 → undefined | covered |

---

## F-2: 定价与折扣域 (APIs 14-16)

### F-2.1: calculateFinalPrice(defId, shopType, npcId?) — 核心定价

| 节点 | 类型 | 描述 | 优先级 |
|------|------|------|--------|
| F-2.1-N01 | F-Normal | 正常计算，无折扣 → 返回basePrice | covered |
| F-2.1-N02 | F-Normal | 商品折扣0.8 → 价格×0.8 | covered |
| F-2.1-N03 | F-Normal | NPC折扣叠加 → 取最低rate | covered |
| F-2.1-N04 | F-Normal | 活跃折扣叠加 → 取最低rate | covered |
| F-2.1-N05 | F-Error | defId不存在 → 返回{} | covered |
| F-2.1-N06 | P0-NaN | 商品discount=NaN → safeRate(NaN)=1，已防护 | covered(FIX-SHOP-002) |
| F-2.1-N07 | P0-NaN | npcDiscountProvider返回NaN → safeRate(NaN)=1，已防护 | covered |
| F-2.1-N08 | P0-NaN | DiscountConfig.rate=NaN → addDiscount已拒绝 | covered(FIX-SHOP-004) |
| F-2.1-N09 | F-Boundary | 折扣率=0 → safeRate(0)=1（0不>0），回退无折扣 | P1 |
| F-2.1-N10 | F-Boundary | 折扣率=1.5 → safeRate(1.5)=1，回退无折扣 | covered |
| F-2.1-N11 | F-Boundary | basePrice含0值货币 → Math.max(1, 0)=1 | P2 |
| F-2.1-N12 | P0-NaN | basePrice含NaN → Math.max(1, Math.ceil(NaN))=Math.max(1,NaN)=NaN | **P0** |

### F-2.2: addDiscount(config) — 添加折扣

| 节点 | 类型 | 描述 | 优先级 |
|------|------|------|--------|
| F-2.2-N01 | F-Normal | rate=0.8正常添加 | covered |
| F-2.2-N02 | P0-NaN | rate=NaN → 已拒绝(FIX-SHOP-004) | covered |
| F-2.2-N03 | P0-负数 | rate=-0.5 → 已拒绝 | covered |
| F-2.2-N04 | P0-溢出 | rate=0 → 已拒绝(rate<=0) | covered |
| F-2.2-N05 | P0-溢出 | rate=Infinity → 已拒绝(!Number.isFinite) | covered |
| F-2.2-N06 | F-Boundary | rate=1 → 允许（无折扣） | P2 |
| F-2.2-N07 | F-Boundary | rate=0.001 → 允许（极低折扣） | P2 |
| F-2.2-N08 | F-Error | config.applicableGoods含无效ID → 不影响，运行时过滤 | P2 |

### F-2.3: cleanupExpiredDiscounts() — 清理过期

| 节点 | 类型 | 描述 | 优先级 |
|------|------|------|--------|
| F-2.3-N01 | F-Normal | 清理过期折扣，返回清理数量 | covered |
| F-2.3-N02 | F-Boundary | 无过期折扣 → 返回0 | P2 |
| F-2.3-N03 | F-Boundary | 全部过期 → 返回全部数量 | P2 |

---

## F-3: 购买流程域 (APIs 17-18) — 核心

### F-3.1: validateBuy(request, npcId?) — 购买校验

| 节点 | 类型 | 描述 | 优先级 |
|------|------|------|--------|
| F-3.1-N01 | F-Normal | 正常购买，库存充足、限购未达、货币充足 | covered |
| F-3.1-N02 | P0-NaN | quantity=NaN → 已拒绝(!quantity\|\|quantity<=0) | covered(FIX-SHOP-003) |
| F-3.1-N03 | P0-NaN | quantity=0 → 已拒绝(quantity<=0) | covered |
| F-3.1-N04 | P0-溢出 | quantity=10000 → 已拒绝(>9999) | covered(FIX-SHOP-003) |
| F-3.1-N05 | P0-溢出 | quantity=Infinity → 已拒绝(!Number.isInteger) | covered |
| F-3.1-N06 | F-Error | goodsId不存在 → 商品不存在 | covered |
| F-3.1-N07 | F-Error | 商品不在当前商店 → 错误 | covered |
| F-3.1-N08 | F-Normal | 库存不足 → 错误提示 | covered |
| F-3.1-N09 | F-Normal | 日限购达上限 → 错误提示 | covered |
| F-3.1-N10 | F-Normal | 终身限购达上限 → 错误提示 | covered |
| F-3.1-N11 | F-Normal | 货币不足 → checkAffordability返回不足信息 | covered |
| F-3.1-N12 | F-Boundary | quantity=9999 → 允许（上限边界） | P2 |
| F-3.1-N13 | F-Normal | 确认级别计算（五级策略） | covered |
| F-3.1-N14 | F-Error | 无currencyOps → 跳过货币检查（不报错） | P1 |

### F-3.2: executeBuy(request, npcId?) — 执行购买

| 节点 | 类型 | 描述 | 优先级 |
|------|------|------|--------|
| F-3.2-N01 | F-Normal | 正常购买成功，扣费+减库存+更新限购 | covered |
| F-3.2-N02 | F-Normal | validateBuy失败 → 返回失败 | covered |
| F-3.2-N03 | P0-免费 | 无currencyOps但有价格 → 已拒绝(FIX-SHOP-009) | covered |
| F-3.2-N04 | F-Normal | currencyOps.spendByPriority抛异常 → 捕获返回失败 | covered |
| F-3.2-N05 | F-Normal | 库存无限(stock=-1) → 不减少 | covered |
| F-3.2-N06 | F-Normal | 事件发布 shop:goods_purchased | covered |
| F-3.2-N07 | F-Boundary | 免费商品(basePrice全0)+无currencyOps → 允许购买 | P2 |
| F-3.2-N08 | P0-NaN | finalPrice含NaN → totalCost=NaN×quantity=NaN → spendByPriority收到NaN | **P0** |

---

## F-4: 库存与限购域 (APIs 19-21, 25)

### F-4.1: getStockInfo(shopType, defId)

| 节点 | 类型 | 描述 | 优先级 |
|------|------|------|--------|
| F-4.1-N01 | F-Normal | 正常获取库存信息 | covered |
| F-4.1-N02 | F-Error | 商品不存在 → null | covered |

### F-4.2: resetDailyLimits()

| 节点 | 类型 | 描述 | 优先级 |
|------|------|------|--------|
| F-4.2-N01 | F-Normal | 重置所有商店日限购+刷新计数 | covered |

### F-4.3: manualRefresh()

| 节点 | 类型 | 描述 | 优先级 |
|------|------|------|--------|
| F-4.3-N01 | F-Normal | 正常手动刷新 | covered |
| F-4.3-N02 | F-Normal | 刷新次数达上限 → 拒绝 | covered |
| F-4.3-N03 | F-Boundary | 最后一次刷新 → 成功 | P2 |

### F-4.4: processOfflineRestock()

| 节点 | 类型 | 描述 | 优先级 |
|------|------|------|--------|
| F-4.4-N01 | F-Normal | 离线时间>interval → 补货1次 | covered |
| F-4.4-N02 | F-Normal | 离线时间>2×interval → 最多补货2次(maxAccumulation) | covered |
| F-4.4-N03 | F-Boundary | 离线时间<interval → 不补货 | P2 |
| F-4.4-N04 | F-Normal | 10%稀有折扣概率 | covered |
| F-4.4-N05 | F-Error | lastOfflineRestock在未来 → elapsed为负 → accumulated=0 | P2 |

---

## F-5: 收藏管理域 (APIs 22-24)

### F-5.1: toggleFavorite(defId)

| 节点 | 类型 | 描述 | 优先级 |
|------|------|------|--------|
| F-5.1-N01 | F-Normal | 添加收藏 | covered |
| F-5.1-N02 | F-Normal | 取消收藏 | covered |
| F-5.1-N03 | F-Error | defId不存在 → false | covered |
| F-5.1-N04 | F-Error | def存在但favoritable=false → false | P2 |

### F-5.2: isFavorite / getFavorites

| 节点 | 类型 | 描述 | 优先级 |
|------|------|------|--------|
| F-5.2-N01 | F-Normal | 正常查询 | covered |
| F-5.2-N02 | F-Boundary | 空收藏列表 → [] | P2 |

---

## F-6: 商店等级域 (APIs 26-27)

### F-6.1: getShopLevel / setShopLevel

| 节点 | 类型 | 描述 | 优先级 |
|------|------|------|--------|
| F-6.1-N01 | F-Normal | 获取等级 | covered |
| F-6.1-N02 | F-Normal | 设置等级=3 | covered |
| F-6.1-N03 | P0-NaN | level=NaN → 已拒绝(!Number.isFinite) | covered(FIX-SHOP-001) |
| F-6.1-N04 | P0-负数 | level=-1 → 已拒绝(level<1) | covered |
| F-6.1-N05 | P0-溢出 | level=Infinity → 已拒绝(!Number.isFinite) | covered |
| F-6.1-N06 | F-Boundary | level=0 → 已拒绝(level<1) | covered |
| F-6.1-N07 | F-Boundary | level=1 → 允许（最小有效值） | P2 |
| F-6.1-N08 | P1-溢出 | level=999999 → 允许，无上限检查 | **P1** |

---

## F-7: 序列化域 (APIs 28-29)

### F-7.1: serialize()

| 节点 | 类型 | 描述 | 优先级 |
|------|------|------|--------|
| F-7.1-N01 | F-Normal | 正常序列化，包含shops/favorites/activeDiscounts | covered |
| F-7.1-N02 | F-Normal | 深拷贝防止引用泄漏(FIX-SHOP-010) | covered |

### F-7.2: deserialize(data)

| 节点 | 类型 | 描述 | 优先级 |
|------|------|------|--------|
| F-7.2-N01 | F-Normal | 正常反序列化 | covered |
| F-7.2-N02 | F-Error | data=null → 安全返回(FIX-SHOP-007) | covered |
| F-7.2-N03 | F-Error | data=undefined → 安全返回 | covered |
| F-7.2-N04 | F-Boundary | 版本不匹配 → 警告但继续 | covered |
| F-7.2-N05 | F-Error | data.shops缺少某类型 → 保留原shop | covered |
| F-7.2-N06 | F-Normal | activeDiscounts含无效rate → 过滤 | covered |
| F-7.2-N07 | F-Error | favorites含无效defId → 过滤(检查GOODS_DEF_MAP) | covered |
| F-7.2-N08 | F-Error | shop.shopLevel=NaN → 重置为1 | covered |
| F-7.2-N09 | F-Error | shop.manualRefreshCount为负 → 重置为0 | covered |

---

## F-8: 生命周期域 (APIs 1-4)

### F-8.1: init / update / reset

| 节点 | 类型 | 描述 | 优先级 |
|------|------|------|--------|
| F-8.1-N01 | F-Normal | init设置deps和lastUpdateTick | covered |
| F-8.1-N02 | F-Normal | update定时补货(8h间隔) | covered |
| F-8.1-N03 | F-Normal | reset清空所有商店状态 | covered |
| F-8.1-N04 | F-Boundary | update间隔不足8h → 不补货 | P2 |
| F-8.1-N05 | P1-注入 | deps未init时调用executeBuy → this.deps?.eventBus安全 | P1 |

---

## 统计

| 分类 | 数量 |
|------|------|
| F-Normal | 38 |
| F-Boundary | 18 |
| F-Error | 16 |
| **P0** | **3** |
| P1 | 4 |
| P2 | 14 |
| **总计** | **93** |

### P0 汇总

| ID | 节点 | 描述 | 状态 |
|----|------|------|------|
| DEF-SHOP-101 | F-2.1-N12 | calculateFinalPrice: basePrice含NaN → finalPrice含NaN传播到购买 | 🔴 未修复 |
| DEF-SHOP-102 | F-3.2-N08 | executeBuy: finalPrice含NaN → totalCost=NaN → spendByPriority收到NaN | 🔴 未修复 |
| DEF-SHOP-103 | F-6.1-N08 | setShopLevel: 无上限检查，level=999999允许设置 | 🟡 P1升级 |

### 已有FIX覆盖

| FIX ID | 位置 | 描述 |
|--------|------|------|
| FIX-SHOP-001 | setShopLevel | NaN/负数/Infinity防护 |
| FIX-SHOP-002 | calculateFinalPrice | 折扣率NaN防护(safeRate) |
| FIX-SHOP-003 | validateBuy | quantity上限9999 |
| FIX-SHOP-004 | addDiscount | rate范围验证 |
| FIX-SHOP-006 | serialize | 包含activeDiscounts |
| FIX-SHOP-007 | deserialize | null/undefined防护 |
| FIX-SHOP-009 | executeBuy | 无currencyOps时拒绝付费商品 |
| FIX-SHOP-010 | serialize | 深拷贝防引用泄漏 |
| FIX-SHOP-011 | processOfflineRestock | 更新lastOfflineRestock防重复 |
