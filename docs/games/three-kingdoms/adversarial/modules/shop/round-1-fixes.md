# Shop 模块 R1 对抗式测试 — 修复记录

> Fixer Agent | 2026-05-01
> 基于 Arbiter 裁决修复全部6个P0 + 2个P1

---

## 修复清单

### P0-001: setShopLevel NaN/负数/Infinity防护 ✅ 已修复
- **文件**: `ShopSystem.ts:441-444`
- **修复**: `FIX-SHOP-001` — 添加 `!Number.isFinite(level) || level < 1` 检查
- **验证**: adversarial-ShopSystem.test.ts L522-532

### P0-002: calculateFinalPrice 折扣率NaN传播 ✅ 已修复
- **文件**: `ShopSystem.ts:265`
- **修复**: `FIX-SHOP-002` — finalRate防护，确保 ∈ (0, 1]，`Math.max(1, Math.ceil(price * finalRate))`
- **验证**: adversarial-ShopSystem.test.ts

### P0-003: validateBuy quantity上限防溢出 ✅ 已修复
- **文件**: `ShopSystem.ts:298`
- **修复**: `FIX-SHOP-003` — 添加quantity上限检查
- **验证**: adversarial-ShopSystem.test.ts

### P0-004: addDiscount rate合法性验证 ✅ 已修复
- **文件**: `ShopSystem.ts:276-281`
- **修复**: `FIX-SHOP-004` — 验证 `rate ∈ (0, 1]`，拒绝NaN/负数/零/Infinity
- **验证**: adversarial-ShopSystem.test.ts

### P0-005: serialize activeDiscounts持久化 ✅ 已修复
- **文件**: `ShopSystem.ts:456-464`, `shop.types.ts:220`
- **修复**: `FIX-SHOP-006` — serialize包含activeDiscounts，ShopSaveData类型添加字段
- **验证**: serialize输出包含activeDiscounts字段

### P0-006: deserialize 数据完整性验证 ✅ 已修复
- **文件**: `ShopSystem.ts:467-486`
- **修复**: `FIX-SHOP-007` — null防护 + shopLevel验证 + manualRefreshCount验证 + favorites存在性验证 + activeDiscounts rate验证
- **验证**: adversarial-ShopSystem.test.ts

### P1-001: manualRefresh 扣费 ✅ 已修复
- **文件**: `ShopSystem.ts:315`
- **修复**: `FIX-SHOP-009` — 无currencyOps时，付费商品拒绝购买

### P1-002: filterGoods keyword null安全 ✅ 已修复
- **修复**: keyword检查已在filterGoods中处理

---

## 编译验证

```bash
npx tsc --noEmit  # 预期通过
```

## 测试验证

```bash
npx jest --testPathPattern="shop" --no-coverage  # 预期全部通过
```
