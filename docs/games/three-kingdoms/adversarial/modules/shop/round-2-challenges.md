# Shop 模块 R2 对抗式测试 — Challenger 质询

> Challenger Agent | 版本: v1.8 规则 | 日期: 2026-05-01
> 质询对象: round-2-tree.md (Builder R2分支树)

---

## 质询总览

| # | 质询目标 | Builder结论 | Challenger立场 | 裁决建议 |
|---|----------|------------|---------------|----------|
| C-R2-1 | T-2.2 spendByPriority NaN间接防护 | ✅ 间接防护足够 | ⚠️ 需确认 | 维持P1 backlog |
| C-R2-2 | T-3 P1 backlog未恶化判定 | ✅ 无恶化 | ✅ 同意 | 不升级 |
| C-R2-3 | T-4 新增边界覆盖充分性 | ✅ 充分 | ✅ 同意 | 封版 |
| C-R2-4 | R2评分9.0合理性 | Builder建议9.0 | ✅ 合理 | 封版 |

---

## C-R2-1: spendByPriority NaN间接防护是否足够

**Builder主张**: FIX-SHOP-101已在上游拦截NaN，spendByPriority收到的costs安全。

**Challenger分析**:

1. **传播链验证**:
   - `calculateFinalPrice` → FIX-SHOP-101: `safePrice = Number.isFinite(price) && price > 0 ? price : 0`
   - `safePrice=0` → `Math.max(1, Math.ceil(0 * finalRate))` = 1
   - `totalCost[cur] = price * quantity` → price最小为1 → totalCost安全 ✅

2. **其他调用路径**:
   - spendByPriority仅在executeBuy中被ShopSystem调用
   - 无其他模块直接调用spendByPriority传入Shop相关costs
   - CurrencySystem自身调用spendByPriority的场景（如trade）有独立验证

3. **结论**: 间接防护链完整。spendByPriority自身添加NaN防护是防御性编程最佳实践，但不构成P0（上游已阻断）。

**Challenger裁决建议**: 维持P1 backlog建议，不升级。不影响封版。

---

## C-R2-2: P1 backlog未恶化判定

**逐项验证**:

| P1缺陷 | R1状态 | R2代码变更 | 恶化? |
|--------|--------|-----------|-------|
| FIX-SHOP-102 setShopLevel无上限 | P1 | 无变更 | ❌ 未恶化 |
| FIX-SHOP-103 validateBuy/executeBuy不一致 | P1 | 无变更 | ❌ 未恶化 |
| FIX-SHOP-104 deserialize favorited不一致 | P1 | 无变更 | ❌ 未恶化 |
| FIX-SHOP-105 filterGoods priceRange NaN | P1 | 无变更 | ❌ 未恶化 |
| FIX-SHOP-201 executeBuy重复查找 | P1 | 无变更 | ❌ 未恶化 |

**结论**: R1→R2间仅修复了FIX-SHOP-101(P0)，未触及P1相关代码路径。5个P1均未恶化。✅

---

## C-R2-3: T-4 新增边界覆盖充分性

**Challenger补充检查项**:

1. **T-4.1 calculateFinalPrice边界**:
   - ✅ 空basePrice已覆盖
   - ✅ 未知货币类型已覆盖
   - ✅ 折扣叠加已覆盖
   - **补充**: basePrice含0值 → safePrice=0(price>0为false) → result=1 ✅ 安全

2. **T-4.2 executeBuy边界**:
   - ✅ quantity边界已覆盖
   - ✅ stock边界已覆盖
   - **补充**: 同时购买stock=-1(无限库存)商品 → 正常扣减dailyPurchased ✅ 安全

3. **T-4.3 deserialize边界**:
   - ✅ null/undefined data已覆盖
   - ✅ 无效goodsId已覆盖
   - ✅ NaN rate已覆盖

4. **T-4.4 restockShop边界**:
   - ✅ 未初始化商店已覆盖
   - ✅ 缺失config已覆盖

**结论**: T-4覆盖充分，无遗漏的高风险边界。✅

---

## C-R2-4: R2评分9.0合理性

**评分依据分析**:

| 维度 | 得分 | 理由 |
|------|------|------|
| P0缺陷 | 10/10 | R1的1个P0已修复并验证穿透 ✅ |
| P1缺陷 | 8/10 | 5个P1 backlog未修复，但不影响核心功能 |
| 跨系统安全 | 9/10 | engine-save已接入，spendByPriority间接防护 |
| 代码质量 | 9/10 | executeBuy冗余查找(P1)为唯一质量扣分项 |
| 测试覆盖 | 9/10 | R1(93节点)+R2(43节点)=136节点覆盖 |

**综合评分**: (10+8+9+9+9)/5 = **9.0/10**

**Challenger意见**: 9.0评分合理。P1 backlog项均为非核心功能缺陷，不影响封版决策。

---

## Challenger 最终立场

- **无新P0发现** ✅
- **无P1升级** ✅
- **R1修复穿透验证通过** ✅
- **跨系统验证通过** ✅
- **同意封版，评分9.0** ✅

**签名**: Challenger Agent | 日期: 2026-05-01
