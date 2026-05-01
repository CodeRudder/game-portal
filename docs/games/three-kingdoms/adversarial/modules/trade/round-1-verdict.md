# Trade 模块 R1 对抗式测试 — Arbiter 裁决

> Arbiter Agent | 2026-05-01
> 5维度评分 + P0确认 + 修复优先级

---

## P0 确认裁决

| ID | 描述 | Builder | Challenger | Arbiter裁决 | 理由 |
|----|------|---------|------------|-------------|------|
| P0-001 | ResourceTradeEngine NaN绕过 amount<=0 | FE-T04 | P0-001 | ✅ **确认P0** | NaN<=0===false，经典NaN绕过 |
| P0-002 | upgradeCaravan NaN/负值 | FE-T06/07 | P0-002 | ✅ **确认P0** | 属性污染，影响后续所有计算 |
| P0-003 | dispatch NaN cargo qty | FE-T08 | P0-003 | ✅ **确认P0** | NaN>capacity===false绕过载重 |
| P0-004 | calculateProfit NaN传播 | FE-T01/02/03 | P0-004 | ✅ **确认P0** | 4个NaN入口，利润全NaN |
| P0-005 | CaravanSystem save缺失 | FX-01 | P0-005 | ✅ **确认P0** | 6处全部缺失，数据丢失 |
| P0-006 | serialize caravans空数组 | FX-03 | P0-006 | ✅ **确认P0** | 与P0-005联动，即使接入也是空 |
| P0-007 | ResourceTradeEngine save缺失 | FX-02 | P0-007 | ⬇️ **降级P2** | 无状态引擎，无数据丢失 |
| P0-008 | TradeSystem deserialize null | FE-T11 | P0-008 | ✅ **确认P0** | 存档损坏时崩溃 |
| P0-009 | CaravanSystem deserialize null | FE-T11 | P0-009 | ✅ **确认P0** | 同上 |

**确认P0: 8个** (P0-007降级为P2)

### P1 确认

| ID | 描述 | 裁决 |
|----|------|------|
| P1-001 | 负数cargo qty绕过载重 | ✅ 确认P1 |
| P1-002 | Infinity amount | ✅ 确认P1 |
| P1-003 | 版本不匹配硬抛异常 | ✅ 确认P1 |

---

## 5维度评分

### D1: 节点覆盖率 (权重 25%)
- 公开API: 48个
- F-Normal: 28个 (每个API至少1个 ✅)
- F-Boundary: 20个
- F-Error: 15个
- F-CrossSystem: 10个 (N=3×2=6, 实际10 ✅)
- F-DataLifecycle: 6个
- **覆盖率**: 79/48 = 164% (超额覆盖)
- **评分**: **9.5/10**

### D2: P0发现质量 (权重 30%)
- NaN绕过发现: 4个独立入口 (tradeResource×2, calculateProfit, upgradeCaravan, dispatch)
- engine-save缺失: CaravanSystem 6处全缺 + TradeSystem caravans空数组
- deserialize null: 2个子系统
- 所有P0有源码行号支撑 ✅
- NaN专项扫描表完整 ✅
- **评分**: **9.5/10**

### D3: 源码验证深度 (权重 20%)
- 5个源文件全部读取 ✅
- engine-save.ts 交叉验证 ✅
- GameSaveData 类型定义验证 ✅
- trade-config.ts 常量验证 ✅
- BR-021 资源比较NaN防护扫描 ✅
- **评分**: **9.0/10**

### D4: 跨系统链路 (权重 15%)
- Trade ↔ engine-save: 发现2个缺失接入 ✅
- Trade ↔ Currency: 验证openRoute链路 ✅
- Caravan ↔ Trade: 验证completeTrade回调 ✅
- ResourceTrade ↔ Resource/Building: 验证setDeps注入 ✅
- Engine ↔ Trade init顺序: 验证initR11Systems ✅
- **评分**: **9.0/10**

### D5: 规则合规性 (权重 10%)
- BR-006 (NaN绕过): ✅ 发现4处违反
- BR-014 (保存/加载覆盖): ✅ 发现CaravanSystem缺失
- BR-015 (deserialize覆盖六处): ✅ 6处全验证
- BR-019 (Infinity序列化): ✅ 发现P1-002
- BR-021 (资源比较NaN防护): ✅ 扫描4处
- BR-022 (科技点上限): N/A (Trade无累积型资源)
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

| 优先级 | ID | 描述 | 预估复杂度 |
|--------|-----|------|-----------|
| 1 | P0-005 | CaravanSystem engine-save 接入 | 高(六处修改) |
| 2 | P0-006 | TradeSystem.serialize caravans处理 | 低 |
| 3 | P0-001 | ResourceTradeEngine NaN防护 | 低 |
| 4 | P0-002 | upgradeCaravan NaN/负值防护 | 低 |
| 5 | P0-003 | dispatch cargo NaN/负值防护 | 低 |
| 6 | P0-004 | calculateProfit NaN防护 | 低 |
| 7 | P0-008 | TradeSystem deserialize null安全 | 低 |
| 8 | P0-009 | CaravanSystem deserialize null安全 | 低 |

---

## 封版决策

**评分 9.3 ≥ 9.0 封版线** → ✅ **批准封版**

条件：所有8个P0必须在封版前修复完成，通过 `npx tsc --noEmit` 编译验证。

### 封版签署
- Builder: ✅ 流程树79节点，48 API全覆盖
- Challenger: ✅ 发现8个P0，均有源码验证
- Arbiter: ✅ 综合评分9.3，批准封版
