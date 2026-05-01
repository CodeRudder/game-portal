# Shop 模块 R1 对抗式测试 — Challenger 质询报告

> Challenger Agent | 版本: v1.8 规则 | 日期: 2026-05-01
> 目标: round-1-tree.md (93节点)

---

## 质询总览

| 维度 | Builder标注 | Challenger认可 | 质疑 | 裁定 |
|------|------------|---------------|------|------|
| Normal流 | 38 | 35 | 3 | → 2降级P2, 1维持 |
| Boundary | 18 | 15 | 3 | → 1升级P1, 2补充 |
| Error | 16 | 14 | 2 | → 1升级P0, 1补充 |
| P0 | 3 | 2 | 1(+1新增) | → 确认2个P0 |
| P1 | 4 | 3 | 1(+1新增) | → 确认 |
| P2 | 14 | 14 | 0 | → 维持 |

---

## C-1: P0 质询 — 新增缺陷

### C-1.1: executeBuy 事务性缺陷 — 货币扣除成功但库存扣减失败 [BR-13]

**对应节点**: F-3.2-N01  
**类型**: 事务性扫描  
**规则**: BR-13(事务性扫描：多步操作必须验证原子性)

**问题分析**:
executeBuy的执行流程：
1. validateBuy → 通过
2. currencyOps.spendByPriority() → 扣费（已扣）
3. item.stock -= quantity → 库存扣减
4. item.dailyPurchased += quantity → 限购更新

如果在步骤2和步骤3之间，item引用失效（如并发restockShop重建了goods数组），则：
- 货币已扣除
- 但getGoodsItem重新查找可能返回undefined（新数组中的新item）
- 原item引用指向旧数组中的孤立对象，修改无效果

**源码证据**:
```typescript
// L284: spendByPriority已扣费
try { this.currencyOps.spendByPriority(shopType, totalCost); }
catch (e) { return { success: false, ... }; }

// L290: getGoodsItem重新查找 → 如果restockShop在中间被调用，item可能失效
const item = this.getGoodsItem(shopType, goodsId);
if (item) {  // ← item可能为undefined，扣费不回滚
  if (item.stock !== -1) item.stock -= quantity;
```

**严重度**: P0 — 货币丢失  
**建议**: 在validateBuy阶段缓存item引用，executeBuy使用缓存引用而非重新查找；或添加回滚机制

### C-1.2: calculateFinalPrice basePrice含NaN传播 [DEF-SHOP-101确认]

**对应节点**: F-2.1-N12  
**类型**: 数值安全  
**规则**: BR-01(数值API入口NaN检查), BR-17(战斗数值安全→通用数值安全)

**问题分析**:
```typescript
// L189: basePrice来自GOODS_DEF_MAP静态配置
for (const [cur, price] of Object.entries(def.basePrice)) {
  result[cur] = Math.max(1, Math.ceil(price * finalRate));
  // price=NaN → NaN*finalRate=NaN → Math.ceil(NaN)=NaN → Math.max(1,NaN)=NaN
}
```

虽然GOODS_DEF_MAP是静态配置，但：
1. deserialize可能恢复被篡改的数据
2. 未来动态商品可能引入NaN
3. 违反防御性编程原则

**传播路径**: calculateFinalPrice → validateBuy(finalPrice) → executeBuy(totalCost) → spendByPriority(NaN)

**严重度**: P0 — NaN传播链

### C-1.3: validateBuy无currencyOps时不报错 [DEF-SHOP-NEW-01]

**对应节点**: F-3.1-N14  
**类型**: 安全漏洞  
**规则**: BR-01, FIX-SHOP-009一致性

**问题分析**:
- executeBuy在无currencyOps时有付费商品防护(FIX-SHOP-009) ✓
- 但validateBuy在无currencyOps时**跳过货币检查**，返回canBuy=true ✓
- 这意味着：validateBuy说"可以买"，但executeBuy说"货币系统未初始化"
- **前端会显示"购买"按钮可用，用户点击后报错** — UX缺陷

**严重度**: P1 — 前后端不一致（非P0，因为executeBuy有最终防线）

---

## C-2: P0 质询 — 对Builder标注的质疑

### C-2.1: DEF-SHOP-103 setShopLevel无上限 → 应为P1非P0

**Builder标注**: P0  
**Challenger意见**: 降级为P1

**理由**:
- shopLevel仅影响商品品质（注释说明），不影响核心购买流程
- 无溢出风险（level为number类型，JS安全整数范围内）
- 实际影响：可能显示超出配置的等级描述，但不导致崩溃或数据丢失
- 建议添加上限常量（如SHOP_LEVEL_CONFIG.length=5），但非P0

**裁定请求**: P0 → P1

### C-2.2: F-1.3-N06 priceRange含NaN → 应为P1

**Builder标注**: P1  
**Challenger意见**: 确认P1，补充说明

**补充**:
```typescript
if (filter.priceRange) {
  const [min, max] = filter.priceRange;
  items = items.filter(i => {
    const p = ...;
    return p >= min && p <= max;  // min=NaN → NaN比较=false，过滤掉所有商品
  });
}
```
NaN比较返回false，导致所有商品被过滤掉 — 功能异常但不崩溃，P1正确。

---

## C-3: 遗漏节点补充

### C-3.1: restockShop折扣率无下限 [新增P1]

**位置**: restockShop() 私有方法  
**类型**: 数值安全  
**规则**: BR-01

**问题**:
```typescript
// restockShop L437
if (Math.random() < DEFAULT_RESTOCK_CONFIG.discountChance) {
  item.discount = 0.7 + Math.random() * 0.2;  // 范围 [0.7, 0.9]
}
```
虽然0.7+Math.random()*0.2在[0.7,0.9]范围内是安全的，但processOfflineRestock中：
```typescript
// L353
item.discount = 0.7; // 稀有折扣 — 固定值，安全
```
**结论**: 安全，无需修复。但建议添加注释说明范围保证。

### C-3.2: confirmLevel阈值配置验证 [新增P2]

**位置**: confirmLevel() 私有方法  
**类型**: 配置验证  
**规则**: BR-02(配置交叉验证)

**问题**: CONFIRM_THRESHOLDS的阈值应单调递增，但无验证：
```typescript
// shop-config.ts
none: 0, low: 1000, medium: 5000, high: 20000, critical: 100000
```
当前值正确（单调递增），但如果配置被修改为非单调（如high<medium），confirmLevel逻辑会错误。

**严重度**: P2 — 静态配置，运行时不变

### C-3.3: manualRefresh全商店统一计数逻辑 [新增P2]

**位置**: manualRefresh()  
**类型**: 逻辑审查  

**问题**:
```typescript
// L325: 检查所有商店是否达上限
for (const type of SHOP_TYPES) {
  if (this.shops[type].manualRefreshCount >= this.shops[type].manualRefreshLimit)
    return { success: false, reason: '今日刷新次数已用完' };
}
// L330: 增加所有商店的计数
for (const type of SHOP_TYPES) {
  this.shops[type].manualRefreshCount++;
  this.restockShop(type, now);
}
```
设计意图：一个刷新操作刷新所有商店，共享刷新次数。逻辑一致，无问题。

### C-3.4: deserialize后goods数组引用一致性 [新增P1]

**位置**: deserialize()  
**类型**: 状态一致性  
**规则**: BR-15

**问题**:
```typescript
// deserialize直接赋值
this.shops[type] = shop;  // shop是存档数据
```
反序列化后的ShopState.goods数组中GoodsItem的favorited字段可能与this.favorites Set不一致：
- deserialize先设置shops，再重建favorites
- 但shop.goods中的favorited字段来自存档，可能包含已不存在的defId
- 后续toggleFavorite依赖this.favorites而非item.favorited

**影响**: getShopGoods返回的item.favorited可能为true，但isFavorite返回false（或反之）

**严重度**: P1 — 显示不一致

---

## C-4: 跨系统质询

### C-4.1: engine-save.ts是否调用ShopSystem.serialize? [BR-14]

**需验证**: engine-save.ts的buildSaveData中是否包含shop字段  
**如果缺失**: 所有商店进度（购买记录、限购、收藏、折扣）在存档后丢失 → P0

### C-4.2: CurrencySystem.spendByPriority的NaN防护 [BR-10穿透]

**穿透路径**: executeBuy → currencyOps.spendByPriority(shopType, totalCost)  
**问题**: 如果totalCost含NaN（DEF-SHOP-101传播），spendByPriority是否有NaN防护？  
**如果无防护**: NaN传播到CurrencySystem → 货币数据污染

### C-4.3: eventBus.emit异常安全性

**位置**: executeBuy L293  
```typescript
try {
  this.deps?.eventBus?.emit('shop:goods_purchased', { ... });
} catch { /* ok */ }
```
try-catch覆盖了emit，但如果eventBus的某个监听器抛出异常：
- 购买已成功（货币已扣、库存已减）
- 异常被吞掉，购买结果正常返回
- **行为正确** — 不应因事件发布失败而回滚购买

---

## 质询结论

| 类别 | 数量 | 说明 |
|------|------|------|
| 新增P0 | 1 | C-1.1: executeBuy事务性缺陷(货币扣后item失效) |
| 确认P0 | 1 | C-1.2: basePrice NaN传播(DEF-SHOP-101) |
| 降级P0→P1 | 1 | C-2.1: setShopLevel无上限 |
| 新增P1 | 2 | C-1.3(validateBuy/executeBuy不一致) + C-3.4(deserialize favorited不一致) |
| 新增P2 | 1 | C-3.2(confirmLevel阈值验证) |
| 跨系统待验证 | 3 | C-4.1/C-4.2/C-4.3 |

**最终P0清单**:
1. DEF-SHOP-101: calculateFinalPrice basePrice NaN传播
2. DEF-SHOP-201: executeBuy事务性缺陷（货币扣除后item引用失效风险）
