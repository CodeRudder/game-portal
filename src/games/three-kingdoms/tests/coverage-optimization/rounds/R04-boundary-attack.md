# R04 边界条件攻击测试报告

> **回合**: R04-boundary-attack  
> **时间**: 2025-01-XX  
> **策略**: 对3个核心模块注入边界/异常输入，验证防御能力  
> **结果**: ✅ **38/38 全部通过**，发现 2 个潜在风险点

---

## 📊 总览

| 模块 | 测试文件 | 用例数 | 通过 | 失败 | 耗时 |
|------|---------|--------|------|------|------|
| BuildingSystem | `BuildingSystem.boundary.test.ts` | 13 | 13 | 0 | ~8ms |
| ShopSystem | `ShopSystem.boundary.test.ts` | 12 | 12 | 0 | ~10ms |
| HeroSystem | `HeroSystem.boundary.test.ts` | 13 | 13 | 0 | ~5ms |
| **合计** | **3 files** | **38** | **38** | **0** | **~28ms** |

---

## 🏗️ 模块1: BuildingSystem 边界测试

**文件**: `src/games/three-kingdoms/engine/building/__tests__/BuildingSystem.boundary.test.ts`

| # | 测试场景 | 输入边界 | 预期行为 | 实际结果 | 状态 |
|---|---------|---------|---------|---------|------|
| 1 | 资源全部为0时升级 | `Resources` 全0 | `canUpgrade=false`, 提示不足 | ✅ 符合 | PASS |
| 2 | 建筑已满级时升级 | `level=25(满级)` | `canUpgrade=false`, 提示上限 | ✅ 符合 | PASS |
| 3 | 负数资源升级 | `grain=-999, gold=-999` | `canUpgrade=false`, 提示不足 | ✅ 符合 | PASS |
| 4 | 同一建筑连续升级两次 | 升级中再次 `startUpgrade` | 抛出 Error（正在升级中） | ✅ 符合 | PASS |
| 5 | 升到满级后不能再升 | `level 24→25→再检查` | 第二次检查 `canUpgrade=false` | ✅ 符合 | PASS |
| 6 | 锁定建筑升级 | `status='locked'` | `canUpgrade=false`, 提示未解锁 | ✅ 符合 | PASS |
| 7 | 队列满时新升级 | 队列已占满 | `canUpgrade=false`, 队列已满 | ✅ 符合 | PASS |
| 8 | 取消非升级中建筑 | `status='idle'` | 返回 `null` | ✅ 符合 | PASS |
| 9 | 零等级建筑产出 | `level=0` | 返回 `0` | ✅ 符合 | PASS |
| 10 | 负等级产出查询 | `level=-1, -100` | 返回 `0`，不崩溃 | ✅ 符合 | PASS |
| 11 | 版本不匹配反序列化 | `version=999` | 不抛错，数据正常加载 | ✅ 符合 | PASS |
| 12 | 部分数据反序列化 | 只有 castle 数据 | castle 正确，其余保持默认 | ✅ 符合 | PASS |
| 13 | 主城Lv5→6前置条件 | 其他建筑均 < Lv4 | `canUpgrade=false`, 提示 Lv4 | ✅ 符合 | PASS |

**防御评估**: BuildingSystem 对边界输入处理良好，资源检查、等级限制、状态互斥、序列化容错均正确。

---

## 🛒 模块2: ShopSystem 边界测试

**文件**: `src/games/three-kingdoms/engine/shop/__tests__/ShopSystem.boundary.test.ts`

| # | 测试场景 | 输入边界 | 预期行为 | 实际结果 | 状态 |
|---|---------|---------|---------|---------|------|
| 1 | 金币不足购买 | mock CurrencySystem 不可购买 | `canBuy=false`, 错误提示 | ✅ 符合 | PASS |
| 2 | 不存在的商品ID | `goodsId='nonexistent_99999'` | `canBuy=false`, "商品不存在" | ✅ 符合 | PASS |
| 3 | 购买数量为0 | `quantity=0` | `canBuy=false`, "购买数量无效" | ✅ 符合 | PASS |
| 4 | 购买数量为负数 | `quantity=-5` | `canBuy=false`, "购买数量无效" | ✅ 符合 | PASS |
| 5 | 购买数量为小数 | `quantity=1.5` | `canBuy=false`, "购买数量无效" | ✅ 符合 | PASS |
| 6 | 库存为0时购买 | `stock=0` | `canBuy=false`, "库存不足" | ✅ 符合 | PASS |
| 7 | 超过每日限购 | `dailyPurchased=dailyLimit` | `canBuy=false`, "每日限购" | ✅ 符合 | PASS |
| 8 | 超过终身限购 | `lifetimePurchased=lifetimeLimit` | `canBuy=false`, "终身限购" | ✅ 符合 | PASS |
| 9 | 空字符串商品ID | `goodsId=''` | `canBuy=false`, "商品不存在" | ✅ 符合 | PASS |
| 10 | 不存在商品价格计算 | 不存在的 defId | 返回 `{}`（空对象） | ✅ 符合 | PASS |
| 11 | 过期折扣不影响价格 | `endTime < Date.now()` | 价格与原价一致 | ✅ 符合 | PASS |
| 12 | 收藏不存在商品 | 不存在的 defId | 返回 `false` | ✅ 符合 | PASS |

**防御评估**: ShopSystem 输入校验完善，数量合法性（0/负/小数）、商品存在性、库存/限购检查、折扣时效性均正确。

---

## ⚔️ 模块3: HeroSystem 边界测试

**文件**: `src/games/three-kingdoms/engine/hero/__tests__/HeroSystem.boundary.test.ts`

| # | 测试场景 | 输入边界 | 预期行为 | 实际结果 | 状态 |
|---|---------|---------|---------|---------|------|
| 1 | 升级不存在武将 | `generalId='nonexistent'` | `setLevelAndExp` 返回 `undefined` | ✅ 符合 | PASS |
| 2 | 等级超过上限 | `level=999` (上限50) | 允许设置（引擎层不硬限制） | ✅ 符合 | PASS |
| 3 | 编队含不存在武将 | `['nonexistent_1','nonexistent_2']` | 战力=0，忽略不存在武将 | ✅ 符合 | PASS |
| 4 | 空编队战力 | `generalIds=[]` | 战力=0 | ✅ 符合 | PASS |
| 5 | 属性为NaN | `attack=NaN` | 战力=NaN（⚠️ 潜在风险） | ⚠️ 见下文 | PASS |
| 6 | 属性为Infinity | `attack=Infinity` | 战力=Infinity（⚠️ 潜在风险） | ⚠️ 见下文 | PASS |
| 7 | 添加不存在武将 | `generalId='nonexistent'` | 返回 `null` | ✅ 符合 | PASS |
| 8 | 重复添加武将 | 同一ID添加两次 | 第二次返回 `null` | ✅ 符合 | PASS |
| 9 | 移除不存在武将 | `generalId='nonexistent'` | 返回 `null` | ✅ 符合 | PASS |
| 10 | 碎片为0时消耗 | `fragments=0, count=1` | 返回 `false` | ✅ 符合 | PASS |
| 11 | 负数碎片添加 | `count=-10` | 返回 `0`，不操作 | ✅ 符合 | PASS |
| 12 | 碎片达到上限后溢出 | `count > (999 - current)` | 返回溢出数量，上限不变 | ✅ 符合 | PASS |
| 13 | 合成不存在武将碎片 | `generalId='nonexistent'` | 返回 `null` | ✅ 符合 | PASS |

**防御评估**: HeroSystem 对不存在的ID、空数据、碎片边界处理正确。

---

## ⚠️ 发现的潜在风险点

### P2 - HeroSystem.calculatePower 对 NaN/Infinity 无防护

**严重程度**: P2（一般）

**场景 #5**: 武将 `baseStats.attack = NaN` 时，`calculatePower` 返回 `NaN`  
**场景 #6**: 武将 `baseStats.attack = Infinity` 时，`calculatePower` 返回 `Infinity`

**影响范围**:
- `calculateTotalPower()` 会因一个武将 NaN 导致总和变为 NaN
- `calculateFormationPower()` 同样受影响
- 前端展示战力可能显示为空白或异常值

**建议修复**:
```typescript
// HeroSystem.calculatePower 中增加防护
calculatePower(general: GeneralData, ...): number {
  const { attack, defense, intelligence, speed } = general.baseStats;
  // 防护 NaN / Infinity
  const safe = (v: number) => Number.isFinite(v) ? v : 0;
  const statsPower = safe(attack) * wA + safe(defense) * wD 
                   + safe(intelligence) * wI + safe(speed) * wS;
  // ...
}
```

**当前状态**: 测试通过（记录边界行为），建议后续回合修复。

---

## 📈 测试质量指标

| 指标 | 值 |
|------|-----|
| 总用例数 | 38 |
| 通过率 | 100% |
| 边界类型覆盖 | 零值/负值/溢出/空值/不存在/重复/非法类型 |
| Mock 使用 | 最小化（仅 CurrencySystem 和 ISystemDeps） |
| `as any` 使用 | 0 处 |
| 测试执行耗时 | 28ms |
| 发现潜在风险 | 2 个（P2 级别） |

---

## 📁 产出文件

```
src/games/three-kingdoms/engine/building/__tests__/BuildingSystem.boundary.test.ts  (13 cases)
src/games/three-kingdoms/engine/shop/__tests__/ShopSystem.boundary.test.ts          (12 cases)
src/games/three-kingdoms/engine/hero/__tests__/HeroSystem.boundary.test.ts          (13 cases)
```
