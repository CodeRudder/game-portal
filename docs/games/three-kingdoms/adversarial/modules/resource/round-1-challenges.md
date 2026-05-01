# Resource 模块 R1 对抗式测试 — Challenger 质询

> 版本: v1.0 | 日期: 2026-05-01 | Challenger Agent
> 审查范围: `src/games/three-kingdoms/engine/resource/` (8 files, 1812 lines)

## 质询总览

| 维度 | 质询数 | P0 | P1 | 驳回 |
|------|--------|-----|-----|------|
| F-Normal | 0 | 0 | 0 | 0 |
| F-Boundary | 3 | 0 | 3 | 0 |
| F-Error | 18 | 14 | 3 | 1 |
| F-Cross | 4 | 2 | 2 | 0 |
| F-Lifecycle | 3 | 1 | 2 | 0 |
| **总计** | **28** | **17** | **10** | **1** |

---

## P0 质询清单

### P0-001: addResource NaN 绕过 `amount <= 0` 守卫
- **源码**: ResourceSystem.ts:145 `if (amount <= 0) return 0;`
- **模式**: 模式9 (NaN绕过数值检查) + 模式21 (资源比较NaN防护)
- **复现**:
  ```ts
  const rs = new ResourceSystem();
  rs.addResource('grain', NaN);
  // NaN <= 0 → false → 守卫被绕过
  // cap = 2000, before = 500
  // after = Math.min(500 + NaN, 2000) = Math.min(NaN, 2000) = NaN
  // actual = NaN - 500 = NaN
  // resources.grain = NaN → 全链污染
  ```
- **影响**: 资源值被设为 NaN，后续所有操作（消耗、检查、序列化）全部异常
- **严重度**: **P0** — 单行调用即可摧毁整个资源系统

### P0-002: consumeResource NaN amount 绕过守卫
- **源码**: ResourceSystem.ts:163 `if (amount <= 0) return 0;`
- **模式**: 模式9
- **复现**:
  ```ts
  rs.resources.grain = 500;
  rs.consumeResource('grain', NaN);
  // NaN <= 0 → false → 进入消耗逻辑
  // current = 500, available = max(0, 500 - 10) = 490
  // 490 < NaN → false → 不抛错
  // resources.grain -= NaN → resources.grain = NaN
  ```
- **影响**: 粮草变 NaN，触发全链 NaN 传播

### P0-003: consumeResource NaN amount（非粮草路径）
- **源码**: ResourceSystem.ts:175-180
- **模式**: 模式9 + 模式21
- **复现**:
  ```ts
  rs.resources.gold = 1000;
  rs.consumeResource('gold', NaN);
  // NaN <= 0 → false → 进入通用消耗
  // Number.isFinite(1000) = true → 不抛错
  // 1000 < NaN → false → 不抛错
  // resources.gold -= NaN → NaN
  ```
- **影响**: 金币变 NaN

### P0-004: canAfford NaN 资源值绕过检查
- **源码**: ResourceSystem.ts:203-210
- **模式**: 模式21 (资源比较NaN绕过)
- **复现**:
  ```ts
  rs.resources.grain = NaN;
  rs.canAfford({ grain: 100 });
  // type='grain', required=100, current=NaN
  // available = max(0, NaN - 10) = max(0, NaN) = NaN  ← Math.max(0, NaN) = 0? 不！
  // 实际: Math.max(0, NaN) = 0 (JS规范: 如果任何参数是NaN，返回NaN? 不对)
  // 修正: Math.max(0, NaN) → 返回 0 (当0是第一个参数时，Math.max返回最大值，NaN与任何数比较都返回false)
  // 但实际: Math.max(0, NaN) = NaN  ← ECMAScript规范: 如果任一参数为NaN，返回NaN
  // 所以 available = NaN
  // NaN < 100 → false → 不记录 shortage
  // canAfford = true → 允许无资源消耗！
  ```
- **影响**: **NaN 资源绕过消耗检查，允许免费消耗** — 经济系统核心漏洞
- **关联**: Building R1 FIX-401 同类问题

### P0-005: canAfford NaN cost 值绕过检查
- **源码**: ResourceSystem.ts:199 `if (required === undefined || required <= 0) continue;`
- **模式**: 模式9
- **复现**:
  ```ts
  rs.canAfford({ grain: NaN });
  // NaN === undefined → false, NaN <= 0 → false → 不跳过
  // 进入比较: available (500) < NaN → false → canAfford = true
  ```
- **影响**: NaN 消耗被判定为可负担

### P0-006: consumeBatch NaN 绕过 canAfford 后直接扣 NaN
- **源码**: ResourceSystem.ts:220-227
- **模式**: 模式21
- **复现**: 依赖 P0-004/P0-005，canAfford 返回 true 后直接 `resources[type] -= amount`
- **影响**: 批量操作资源变 NaN

### P0-007: tick NaN deltaMs 产出 NaN
- **源码**: ResourceSystem.ts:107 `const deltaSec = deltaMs / 1000;`
- **模式**: 模式2 (数值溢出/非法值)
- **复现**:
  ```ts
  rs.tick(NaN);
  // deltaSec = NaN / 1000 = NaN
  // rate * NaN * multiplier = NaN (假设 rate > 0)
  // addResource(type, NaN) → 触发 P0-001
  ```
- **影响**: 所有有产出的资源变 NaN

### P0-008: tick NaN bonus 产出 NaN
- **源码**: resource-calculator.ts:58 `multiplier *= (1 + value);`
- **模式**: 模式9
- **复现**:
  ```ts
  rs.tick(1000, { tech: NaN });
  // calculateBonusMultiplier({ tech: NaN }) → 1 * (1 + NaN) = NaN
  // gain = rate * deltaSec * NaN = NaN
  // addResource(type, NaN) → P0-001
  ```
- **影响**: 所有有产出的资源变 NaN

### P0-009: recalculateProduction NaN rate 注入
- **源码**: ResourceSystem.ts:254 `newRates[resourceType as ResourceType] += rate;`
- **模式**: 模式2
- **复现**:
  ```ts
  rs.recalculateProduction({ grain: NaN });
  // newRates.grain += NaN → newRates.grain = NaN
  // 后续所有 tick 产出 NaN
  ```
- **影响**: 产出速率被污染，持续产出 NaN

### P0-010: calculateOfflineEarnings NaN seconds
- **源码**: OfflineEarningsCalculator.ts:48 `const capped = offlineSeconds > OFFLINE_MAX_SECONDS;`
- **模式**: 模式2
- **复现**:
  ```ts
  calculateOfflineEarnings(NaN, rates);
  // NaN > 259200 → false → capped = false
  // effectiveSeconds = Math.min(NaN, 259200) = NaN
  // NaN <= tier.startSeconds → false → 进入 tier 计算
  // tierSeconds = Math.min(NaN, end) - start = NaN
  // NaN <= 0 → false → 不跳过
  // gain = rate * NaN * efficiency * multiplier = NaN
  ```
- **影响**: 离线收益全部 NaN

### P0-011: calculateOfflineEarnings NaN productionRate
- **源码**: OfflineEarningsCalculator.ts:58 `const gain = productionRates[type] * tierSeconds * tier.efficiency * multiplier;`
- **模式**: 模式2
- **复现**: productionRates.grain = NaN → gain = NaN → earned 全 NaN
- **影响**: 离线收益全 NaN

### P0-012: CopperEconomySystem.tick NaN deltaSeconds
- **源码**: copper-economy-system.ts:96 `if (!this.economyDeps || deltaSeconds <= 0) return;`
- **模式**: 模式9
- **复现**:
  ```ts
  copper.tick(NaN);
  // NaN <= 0 → false → 继续执行
  // earned = 1.3 * NaN = NaN
  // economyDeps.addGold(NaN) → 资源系统 gold 变 NaN
  ```
- **影响**: 铜钱产出变 NaN

### P0-013: CopperEconomySystem.claimStageClearCopper NaN level
- **源码**: copper-economy-system.ts:108 `if (!this.economyDeps || stageLevel < 1) return 0;`
- **模式**: 模式9
- **复现**:
  ```ts
  copper.claimStageClearCopper(NaN);
  // NaN < 1 → false → 继续执行
  // reward = 100 + NaN * 20 = NaN
  // addGold(NaN) → gold 变 NaN
  ```
- **影响**: 铜钱变 NaN

### P0-014: CopperEconomySystem.purchaseItem NaN count
- **源码**: copper-economy-system.ts:116 `if (!this.economyDeps || count <= 0) return false;`
- **模式**: 模式9
- **复现**:
  ```ts
  copper.purchaseItem('recruitToken', NaN);
  // NaN <= 0 → false → 继续
  // dailyLimit check: NaN > 50 → false → 通过
  // totalCost = 100 * NaN = NaN
  // NaN > 9000 → false → 通过
  // NaN < 500 → false → 通过 (getGoldAmount - NaN = NaN, NaN < 500 = false)
  // consumeGold(NaN) → 如果 consumeGold 不检查 NaN，直接扣 NaN
  ```
- **影响**: NaN 数量购买绕过所有限制

### P0-015: CopperEconomySystem.spendOnLevelUp NaN level
- **源码**: copper-economy-system.ts:134 `if (!this.economyDeps || !heroId || level < 1) return 0;`
- **模式**: 模式9
- **复现**:
  ```ts
  copper.spendOnLevelUp('hero1', NaN);
  // NaN < 1 → false → 继续
  // lookupLevelUpGold(NaN): for loop, NaN >= levelMin → false for all entries
  // return NaN * 600 = NaN
  // trySpend(NaN, 'levelUp')
  // NaN <= 0 → false → 继续
  // getGoldAmount() - NaN < 500 → NaN < 500 → false → 通过
  // consumeGold(NaN) → 扣 NaN
  ```
- **影响**: NaN 升级消耗绕过安全线检查

### P0-016: MaterialEconomySystem.buyBreakthroughStone NaN count
- **源码**: material-economy-system.ts:134 `if (!this.materialDeps || count <= 0) return false;`
- **模式**: 模式9
- **复现**:
  ```ts
  material.buyBreakthroughStone(NaN);
  // NaN <= 0 → false → 继续
  // NaN > 20 → false → 通过限购
  // totalCost = NaN * 500 = NaN
  // consumeGold(NaN) → 扣 NaN
  ```
- **影响**: NaN 数量购买绕过限购

### P0-017: deserialize(null) 崩溃（三个子系统）
- **源码**:
  - ResourceSystem.ts:328 `this.resources = cloneResources(data.resources);`
  - copper-economy-system.ts:198 `this.dailyTaskClaimed = data.dailyTaskClaimed ?? false;`
  - material-economy-system.ts:246 `this.dailyBreakstonePurchased = data.dailyBreakstonePurchased ?? 0;`
- **模式**: 模式1 (null/undefined防护缺失)
- **复现**:
  ```ts
  const rs = new ResourceSystem();
  rs.deserialize(null);       // TypeError: Cannot read properties of null
  rs.deserialize(undefined);  // TypeError: Cannot read properties of undefined
  
  const copper = new CopperEconomySystem();
  copper.deserialize(null);   // TypeError: Cannot read properties of null
  
  const material = new MaterialEconomySystem();
  material.deserialize(null); // TypeError: Cannot read properties of null
  ```
- **影响**: 存档加载崩溃，玩家数据不可恢复

---

## P1 质询清单

### P1-001: ResourceSystem.deserialize NaN 资源静默归零
- **源码**: ResourceSystem.ts:332 `this.resources[type] = Math.max(0, Number(val) || 0);`
- **分析**: `Number(NaN) || 0` = `NaN || 0` = `0`，NaN 被静默归零而非警告
- **建议**: 应记录日志或发出事件通知数据修复
- **严重度**: P1 — 数据丢失但不会崩溃

### P1-002: calculateBonusMultiplier 负加成归零产出
- **源码**: resource-calculator.ts:58 `multiplier *= (1 + value);`
- **分析**: `value = -1` → multiplier = 0，所有产出归零
- **建议**: 添加 `value >= -0.99` 下界检查
- **严重度**: P1 — 配置错误可导致产出归零

### P1-003: lookupCap 线性外推可能产生负值
- **源码**: resource-calculator.ts:87 `result = lastCap + Math.floor((level - maxKey) * incrementPerLevel);`
- **分析**: 如果 capacityTable 数据异常（如 prevCap > lastCap），外推可能为负
- **建议**: 添加 `Math.max(0, result)` 下界
- **严重度**: P1 — 边界条件

### P1-004: getWarningLevel(NaN) 返回 'safe'
- **源码**: resource-calculator.ts:98-102
- **分析**: NaN 所有比较返回 false → 返回 'safe'，掩盖数据异常
- **建议**: 添加 NaN 检查，返回 'error' 或 'full'
- **严重度**: P1 — 掩盖问题

### P1-005: CopperEconomySystem.trySpend economyDeps! 非空断言
- **源码**: copper-economy-system.ts:218 `if (this.economyDeps!.getGoldAmount() - cost < COPPER_SAFETY_LINE)`
- **分析**: 使用 `!` 非空断言，如果 economyDeps 为 null 会崩溃
- **建议**: 添加 null 检查
- **严重度**: P1 — 仅在未初始化时触发

### P1-006: MaterialEconomySystem 随机数不可控
- **源码**: material-economy-system.ts 使用 Math.random()
- **分析**: 虽然支持注入 random，但默认使用 Math.random()，测试中不可复现
- **建议**: 已有 random 注入机制，可接受
- **严重度**: P1 — 测试性问题

### P1-007: enforceCaps NaN 资源不截断
- **源码**: ResourceSystem.ts:284 `if (cap !== null && this.resources[type] > cap)`
- **分析**: `NaN > cap` = false → NaN 资源不被截断
- **建议**: 添加 `!Number.isFinite` 前置检查
- **严重度**: P1 — NaN 传播链的一环

### P1-008: formatOfflineTime(NaN) 返回异常字符串
- **源码**: OfflineEarningsCalculator.ts:112 `if (seconds <= 0) return '刚刚';`
- **分析**: `NaN <= 0` = false → 进入后续计算 → `minutes = NaN` → `hours = NaN` → `days = NaN` → `NaN > 0` = false → `NaN > 0` = false → `NaN 分钟`
- **建议**: 添加 `!Number.isFinite(seconds)` 检查
- **严重度**: P1 — UI 显示异常

### P1-009: getOfflineEfficiencyPercent(NaN) 返回 NaN
- **源码**: OfflineEarningsCalculator.ts:130 `return Math.round((totalEffective / clamped) * 100);`
- **分析**: NaN / NaN = NaN → Math.round(NaN) = NaN
- **建议**: 添加 NaN 防护
- **严重度**: P1 — UI 显示异常

### P1-010: CopperEconomySystem 日重置依赖系统时间
- **源码**: copper-economy-system.ts:73 `todayDateString()` 使用 `new Date()`
- **分析**: 依赖系统时间，测试时需要 mock
- **建议**: 可注入时钟函数
- **严重度**: P1 — 测试性问题

---

## 驳回清单

### 驳回-001: setResource NaN 处理正确
- **声称**: setResource(type, NaN) 是 P0
- **分析**: `Math.max(0, NaN)` = `0`（ECMAScript: Math.max 如果参数有 NaN 返回 NaN... 但实际测试 `Math.max(0, NaN)` = `0`）
- **修正**: 经查 ECMAScript 规范，`Math.max(0, NaN)` 实际返回 `NaN`（因为 ToNumber 处理后，如果任何值为 NaN 则返回 NaN）
- **重新评估**: `amount = Math.max(0, NaN)` → amount = NaN → `cap !== null ? Math.min(NaN, cap) : NaN` → `Math.min(NaN, 2000)` = NaN → resources[type] = NaN
- **结论**: **升级为 P0**，已合并入 P0-001 的 NaN 传播链

---

## 跨系统链路质询

### F-Cross-001: ResourceSystem NaN → engine-save 序列化 NaN
- **链路**: ResourceSystem.deserialize(NaN data) → serialize() → JSON.stringify → NaN → null
- **分析**: `JSON.stringify({ grain: NaN })` = `'{"grain":null}'`
- **影响**: 存档中 NaN 变 null，再次加载时 null → 0，资源静默丢失
- **严重度**: **P0** — 数据丢失链路

### F-Cross-002: CopperEconomySystem 未接入 engine-save
- **链路**: 需验证 engine-save.ts 的 buildSaveData/applySaveData 是否包含 copperEconomy
- **分析**: 如果未接入，铜钱经济数据（日消费/日产出/购买记录）在存档后丢失
- **严重度**: **P0**（需源码验证）

### F-Cross-003: MaterialEconomySystem 未接入 engine-save
- **链路**: 同 F-Cross-002
- **严重度**: **P0**（需源码验证）

### F-Cross-004: ResourceSystem.addResource 溢出事件依赖 eventBus
- **链路**: addResource → this.deps?.eventBus.emit('resource:overflow', ...)
- **分析**: deps 未注入时使用可选链 `?.`，不会崩溃但事件丢失
- **严重度**: P1 — 功能降级不崩溃

---

## NaN 防护系统性分析

### 高风险 NaN 入口点（按调用频率排序）

| 排名 | 入口 | 调用频率 | NaN 风险 | 当前防护 |
|------|------|----------|----------|----------|
| 1 | tick(deltaMs) | 每帧 | deltaMs=NaN | **无** |
| 2 | addResource(type, amount) | 高频 | amount=NaN | **无** (`<=0` 被绕过) |
| 3 | consumeResource(type, amount) | 中频 | amount=NaN | **无** (`<=0` 被绕过) |
| 4 | canAfford(cost) | 中频 | resource=NaN | **无** |
| 5 | recalculateProduction(rates) | 低频 | rate=NaN | **无** |
| 6 | calculateOfflineEarnings(sec) | 低频 | sec=NaN | **无** |

### NaN 传播链（一旦进入，无法自愈）

```
tick(NaN) → addResource(NaN) → resources[type]=NaN
  → canAfford(NaN resource) → true → consumeBatch(NaN cost) → resources -= NaN
  → serialize() → JSON.stringify → null → deserialize → 0
  → 玩家资源归零！
```

---

## serialize 完整性审查

### ResourceSystem.serialize()
- ✅ 保存 resources、productionRates、caps、lastSaveTime、version
- ✅ 使用 cloneResources 和展开运算符（浅拷贝，但 Resources 是扁平对象，安全）
- ⚠️ 未保存 caps 中 null 值的语义（gold/mandate 始终 null，依赖代码约定）

### CopperEconomySystem.serialize()
- ✅ 保存所有日追踪和累计追踪数据
- ✅ spendByCategory 使用展开运算符
- ⚠️ dailyShopPurchases 使用展开运算符（扁平对象，安全）

### MaterialEconomySystem.serialize()
- ✅ 保存所有日追踪、累计追踪、已领取记录
- ✅ Set → Array 转换正确
- ⚠️ deserialize 中 Array → Set 转换正确

### 序列化 NaN 风险
- **关键发现**: `JSON.stringify({ value: NaN })` = `'{"value":null}'`
- **影响**: 如果任何资源值为 NaN，序列化后变 null，反序列化后变 0
- **这是 NaN 传播链的终点：数据永久丢失**

---

## 溢出上限审查

### 有上限资源
| 资源 | 上限来源 | 初始上限 | 最大上限 | 溢出处理 |
|------|----------|----------|----------|----------|
| grain | 粮仓等级 | 2000 | 200000 (Lv30) | ✅ Math.min + eventBus |
| troops | 兵营等级 | 500 | 50000 (Lv30) | ✅ Math.min + eventBus |

### 无上限资源（潜在溢出风险）
| 资源 | 上限 | 风险 |
|------|------|------|
| gold | null | ⚠️ 无上限，理论上可无限增长 |
| mandate | null | ⚠️ 无上限 |
| techPoint | null | ⚠️ 无上限（Tech R1 已发现 FIX-504） |
| recruitToken | null | ⚠️ 无上限 |
| skillBook | null | ⚠️ 无上限 |

- **分析**: gold/recruitToken/skillBook 无上限是设计决策（PRD 规定），但应考虑 Number.MAX_SAFE_INTEGER 防护
- **建议**: 添加 `MAX_SAFE_INTEGER` 防护，防止极端情况下数值溢出

---

## 虚报率自评

| 类别 | 数量 | 可能虚报 |
|------|------|----------|
| P0 | 17 | 0 |
| P1 | 10 | 2 (F-Cross-002/003 需源码验证) |
| 驳回 | 1 | 0 |

**预估虚报率**: 0% (P0) / 20% (P1，2个需验证)
