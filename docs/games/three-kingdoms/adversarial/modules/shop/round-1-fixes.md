# Shop 模块 R1 对抗式测试 — P0 修复报告

> 日期: 2026-05-01
> 依据: round-1-verdict.md (Arbiter裁决)

---

## 修复总览

| 修复ID | 严重度 | 描述 | 状态 |
|--------|--------|------|------|
| FIX-SHOP-101 | P0 | calculateFinalPrice basePrice NaN防护 | ✅ 已修复 |
| FIX-SHOP-201 | P1→降级 | executeBuy事务性(item引用) | ⏳ R2 backlog |

**本轮修复**: 1个P0

---

## FIX-SHOP-101: calculateFinalPrice basePrice NaN防护

### 缺陷描述

**DEF-ID**: DEF-SHOP-101  
**节点**: F-2.1-N12  
**规则违反**: BR-01(数值API入口NaN检查), BR-17(通用数值安全)

calculateFinalPrice中，basePrice的value直接参与算术运算，无NaN/非正常值防护：

```typescript
// 修复前 (L270)
for (const [cur, price] of Object.entries(def.basePrice)) {
  result[cur] = Math.max(1, Math.ceil(price * finalRate));
  // price=NaN → NaN*finalRate=NaN → Math.ceil(NaN)=NaN → Math.max(1,NaN)=NaN
}
```

**传播链**: basePrice(NaN) → calculateFinalPrice → validateBuy(finalPrice含NaN) → executeBuy(totalCost=NaN×quantity=NaN) → currencyOps.spendByPriority(NaN)

### 修复方案

在basePrice value参与运算前添加NaN/非正常值防护：

```typescript
// 修复后 (L270-273)
for (const [cur, price] of Object.entries(def.basePrice)) {
  // FIX-SHOP-101: 防护basePrice含NaN/非正常数值，防止NaN传播到购买流程
  const safePrice = Number.isFinite(price) && price > 0 ? price : 0;
  result[cur] = Math.max(1, Math.ceil(safePrice * finalRate));
}
```

**防护逻辑**:
- `Number.isFinite(price)`: 拒绝NaN、Infinity、-Infinity
- `price > 0`: 拒绝0和负数
- 不满足条件时回退为0 → `Math.max(1, Math.ceil(0 * finalRate))` = `Math.max(1, 0)` = 1
- 最终价格最低为1，防止免费漏洞

### 修复位置

- **文件**: `src/games/three-kingdoms/engine/shop/ShopSystem.ts`
- **行号**: L270-273 (calculateFinalPrice方法内)

### 验证

- ✅ TypeScript编译通过 (`npx tsc --noEmit` 无新增错误)
- ✅ 防护逻辑与FIX-SHOP-002(safeRate)风格一致
- ✅ 最低价格保证(Math.max(1, ...))保持不变
- ✅ 正常basePrice值不受影响(仅过滤NaN/非正常值)

---

## 未修复项 (R2 Backlog)

| 修复ID | 严重度 | 描述 | 原因 |
|--------|--------|------|------|
| FIX-SHOP-102 | P1 | setShopLevel无上限 | 非核心流程，R2处理 |
| FIX-SHOP-103 | P1 | validateBuy检查currencyOps一致性 | 前后端一致性问题 |
| FIX-SHOP-104 | P1 | deserialize后同步favorited | 状态一致性问题 |
| FIX-SHOP-105 | P1 | filterGoods priceRange NaN防护 | 搜索功能异常 |
| FIX-SHOP-201 | P1 | executeBuy避免重复查找item | 代码质量改进 |

---

## 穿透验证 [BR-10]

| 检查项 | 结果 |
|--------|------|
| calculateFinalPrice调用方(validateBuy) | ✅ 使用finalPrice计算totalCost，NaN已被FIX-SHOP-101拦截 |
| calculateFinalPrice调用方(executeBuy) | ✅ 同上 |
| currencyOps.spendByPriority | ⚠️ 应有独立NaN防护(跨系统，R2验证) |
| toCopperEq(price) | ✅ price已安全，amt*rate乘积安全 |
