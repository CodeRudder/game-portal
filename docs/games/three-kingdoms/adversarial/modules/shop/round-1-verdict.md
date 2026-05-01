# Shop 模块 R1 对抗式测试 — Arbiter 裁决

> Arbiter Agent | 2026-05-01
> 5维度评分 + P0确认 + 修复优先级

---

## P0 确认裁决

| ID | 描述 | Builder | Challenger | Arbiter裁决 | 理由 |
|----|------|---------|------------|-------------|------|
| P0-001 | setShopLevel无NaN/负数/Infinity防护 | DEF-SHOP-001 | P0-001 | ✅ **确认P0** | 直接写入无校验，NaN/负数/Infinity均可注入 |
| P0-002 | calculateFinalPrice折扣率NaN传播链 | DEF-SHOP-002 | P0-002 | ✅ **确认P0** | 三入口NaN穿透到货币系统，经济体系级风险 |
| P0-003 | executeBuy购买后stock溢出 | DEF-SHOP-003 | P0-003 | ✅ **确认P0** | MAX_SAFE_INTEGER绕过限购检查，精度丢失 |
| P0-004 | addDiscount无rate合法性验证 | DEF-SHOP-004 | P0-004 | ✅ **确认P0** | rate=0免费/负数倒赚/NaN传播，三重风险 |
| P0-005 | serialize遗漏activeDiscounts | DEF-SHOP-006 | P0-005 | ✅ **确认P0** | 折扣活动save/load后丢失，运营活动失效 |
| P0-006 | deserialize无数据完整性验证 | DEF-SHOP-007 | P0-006 | ✅ **确认P0** | 存档注入可篡改stock/discount/level，null crash |

**确认P0: 6个**

### P1 确认

| ID | 描述 | 裁决 |
|----|------|------|
| P1-001 | manualRefresh无扣费（经济漏洞） | ✅ 确认P1 — 配置定义了费用但未使用 |
| P1-002 | filterGoods keyword为null时NPE | ✅ 确认P1 — `.toLowerCase()` on null |
| P1-003 | validateBuy Infinity显式加固 | ✅ 确认P1 — 建议性加固，当前已安全 |

---

## 5维度评分

### D1: 节点覆盖率 (权重 25%)
- 公开API: 24个
- F-Normal: 24个 (每个API至少1个 ✅)
- F-Boundary: 18个
- F-Error: 12个
- F-CrossSystem: 8个 (N=4×2=8, 实际8 ✅)
- F-DataLifecycle: 5个
- **覆盖率**: 67/24 = 279% (超额覆盖)
- **评分**: **9.5/10**

### D2: P0发现质量 (权重 30%)
- NaN传播链: calculateFinalPrice三入口 (itemDiscount/npcRate/activeRate)
- 折扣篡改: addDiscount rate无验证 (0/负数/NaN/Infinity)
- serialize缺失: activeDiscounts未持久化
- deserialize注入: 6类可注入字段
- 溢出: quantity MAX_SAFE_INTEGER绕过限购
- 所有P0有源码行号支撑 ✅
- NaN专项扫描表完整 ✅
- **评分**: **9.5/10**

### D3: 源码验证深度 (权重 20%)
- ShopSystem.ts 全文读取 ✅
- index.ts 导出验证 ✅
- shop.types.ts 类型验证 ✅
- shop-config.ts 常量验证 ✅
- BR-021 资源比较NaN防护扫描 ✅
- engine-save接入验证 ✅
- **评分**: **9.0/10**

### D4: 跨系统链路 (权重 15%)
- Shop ↔ Currency: executeBuy→spendByPriority ✅
- Shop ↔ EventBus: emit('shop:goods_purchased') ✅
- Shop ↔ NPC: calculateFinalPrice→npcDiscountProvider ✅ (发现NaN风险)
- Shop ↔ Engine-Save: serialize/deserialize ✅ (发现activeDiscounts缺失)
- Shop ↔ Update循环: update→restockShop ✅
- Shop ↔ Trade: 外部集成 ✅
- Shop ↔ Inventory: 购买后无物品交付 ✅ (标记P2)
- **评分**: **9.0/10**

### D5: 规则合规性 (权重 10%)
- BR-01 (NaN检查): ✅ 发现3处违反 (setShopLevel/calculateFinalPrice/addDiscount)
- BR-06 (NaN绕过教训): ✅ 发现calculateFinalPrice NaN传播链
- BR-12 (溢出闭环): ✅ 发现executeBuy溢出
- BR-14 (保存/加载覆盖): ✅ 发现activeDiscounts缺失
- BR-15 (deserialize覆盖六处): ✅ 验证serialize/deserialize完整性
- BR-17 (数值安全): ✅ 发现setShopLevel/addDiscount
- BR-19 (Infinity序列化): ✅ setShopLevel可注入Infinity
- BR-21 (资源比较NaN防护): ✅ 扫描6处
- **评分**: **9.0/10**

---

## 综合评分

| 维度 | 权重 | 得分 | 加权 |
|------|------|------|------|
| D1 节点覆盖率 | 25% | 9.5 | 2.375 |
| D2 P0发现质量 | 30% | 9.5 | 2.850 |
| D3 源码验证深度 | 20% | 9.0 | 1.800 |
| D4 跨系统链路 | 15% | 9.0 | 1.350 |
| D5 规则合规性 | 10% | 9.0 | 0.900 |
| **综合** | **100%** | | **9.275** |

### **R1 评分: 9.3/10** ✅ ≥ 9.0 封版线

---

## 修复优先级排序

| 优先级 | ID | 描述 | 预估复杂度 | 修复行数 |
|--------|-----|------|-----------|---------|
| 1 | P0-002 | calculateFinalPrice NaN防护（经济体系级） | 中 | ~6行 |
| 2 | P0-004 | addDiscount rate合法性验证 | 低 | ~4行 |
| 3 | P0-001 | setShopLevel NaN/负数防护 | 低 | ~2行 |
| 4 | P0-003 | validateBuy quantity上限 | 低 | ~3行 |
| 5 | P0-005 | serialize activeDiscounts持久化 | 中 | 类型+逻辑 |
| 6 | P0-006 | deserialize 数据完整性验证 | 中 | ~15行 |
| 7 | P1-001 | manualRefresh 扣费 | 低 | ~5行 |
| 8 | P1-002 | filterGoods keyword null安全 | 低 | ~2行 |

---

## 封版决策

**评分 9.3 ≥ 9.0 封版线** → ✅ **批准封版**

条件：所有6个P0必须在封版前修复完成，通过 `npx tsc --noEmit` 编译验证。

### 封版签署
- Builder: ✅ 流程树67节点，24 API全覆盖，8跨系统链路
- Challenger: ✅ 发现6个P0 + 3个P1，均有源码验证
- Arbiter: ✅ 综合评分9.3，批准封版
