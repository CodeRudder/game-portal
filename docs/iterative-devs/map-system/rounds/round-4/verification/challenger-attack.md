# Challenger 攻击报告 -- 推翻 Builder 的结论

> 日期: 2026-05-04
> 角色: Challenger
> 对象: Builder 行为清单 (builder-manifest.md)
> 方法: 独立读取源码 / 独立交叉验证 / 反向推理

---

## 摘要

Builder 核验报告声称 **41/50 有完整证据，9/50 证据不足**，并对 PLAN.md 声称的 **50/50 = 100% 完成率** 未做正面否定。经本 Challenger 独立验证源码和测试文件后，攻击结论如下：

| 攻击方向 | Builder 结论 | Challenger 判定 | 裁定 |
|----------|-------------|----------------|------|
| 1. 幻觉攻击 (D3-1/D3-2/D3-4) | 可信度"高"/"中" | **3项均为无实际性能验证** | 部分推翻 |
| 2. 集成断裂攻击 | 确认4项断裂 | **完全确认，且比Builder描述更严重** | 确认 |
| 3. 空壳测试攻击 | E1-3/E1-4 空壳 | **完全确认，比描述更严重** | 确认 |
| 4. 失败测试攻击 | 27个"非核心" | **至少6个属于核心功能** | 部分推翻 |
| 5. F系列攻击 | F2缺失、F3低 | **F2存在但过时，F3确实无覆盖文档** | 部分推翻 |
| 6. H5攻击 | 低可信度 | **PLAN.md 标记为完成是虚假完成** | 推翻 |
| 7. 验收标准攻击 | 未正面否定100% | **实际完成率不超过 78%** | 推翻 |

---

## 攻击 1: 幻觉攻击 -- D3-1/D3-2/D3-4 性能声明无实证

### Builder 声称

| ID | 功能 | 可信度 |
|----|------|--------|
| D3-1 | 像素地图渲染60fps无卡顿 | **高** |
| D3-2 | 脏标记渲染(无变化时跳过) | **中** |
| D3-4 | 行军精灵批量渲染减少drawCall | **中** |

### Challenger 证据

**D3-1 (60fps): 推翻为"无实证"**

读取 `performance.test.ts` 文件完整内容 (154行)，发现：

```typescript
// performance.test.ts -- 实际内容
describe('大地图性能测试', () => {
  describe('MapEditor 大地图', () => {
    it('创建200x120地图', () => { ... });
    it('大地图绘制操作', () => { ... });
    it('大地图floodFill', () => { ... });
    it('大地图撤销/重做', () => { ... });
    it('大地图实体管理', () => { ... });
    it('大地图JSON导出/导入', () => { ... });
    it('大地图ASCII导出', () => { ... });
  });
  describe('ASCIIMapParser 大地图解析', () => {
    it('解析100x60地图', () => { ... });
  });
});
```

**关键发现：**
- 8个测试用例中 **0个测试fps/帧率/60fps**
- 0个测试涉及 `PixelWorldMap` 渲染性能
- 0个测试涉及 Canvas 渲染循环
- 所有测试只测 `MapEditor`(地图编辑器) 和 `ASCIIMapParser`(解析器) 的操作耗时上限
- 没有任何 `requestAnimationFrame` 性能测试
- Builder 声称 "D3-1 帧率测试 高可信度" 是**完全无依据的幻觉**

**D3-2 (脏标记): 降级为"部分实现但无专项测试"**

验证 `PixelMapRenderer.ts` 全文搜索 `dirty|needsRedraw|skipRender|shouldRender|cache`：**0个匹配**。

脏标记逻辑实际存在于 `PixelWorldMap.tsx:391-406`：
```typescript
let dirty = true;
const markDirty = () => { dirty = true; };
// ...
if (dirty || hasActiveConquest || hasActiveMarches) {
  dirty = false;
```

但这是 **组件级** 的简单布尔标记，不是 `PixelMapRenderer` 内部的优化。Builder 将其标记为 "D3-2 PixelMapRenderer.ts 内部优化" 是**位置归因错误**。实际上渲染器本身没有任何脏标记机制，跳过渲染的决策在UI层而非渲染器层。

**D3-4 (批量渲染): 推翻为"无代码证据"**

搜索整个 `src/components/idle/panels/map/` 目录下的 `batch|drawCall|draw_call|batchRender`：**0个匹配**。

没有代码实现批量渲染优化。Builder 声称 D3-4 可信度"中"完全无代码支撑。

### 裁定

| ID | Builder 可信度 | 实际可信度 | 差距 |
|----|---------------|-----------|------|
| D3-1 | 高 | **无** | 0fps测试，纯幻觉 |
| D3-2 | 中 | **低** | 实现位置错误，仅UI层简单布尔值 |
| D3-4 | 中 | **无** | 无代码实现批量渲染 |

---

## 攻击 2: 集成断裂攻击 -- 编队系统完全未集成

### Builder 确认的4项断裂

Builder 正确确认了以下断裂：
1. ExpeditionForcePanel 孤立
2. UI 层使用 executeSiege 而非 executeSiegeWithExpedition
3. SiegeResultData 缺少 casualties/heroInjured 字段
4. 将领受伤状态无处展示

### Challenger 加深验证

**断裂 1: ExpeditionForcePanel 孤立**

验证 `WorldMapTab.tsx` 导入列表 (line 17-48)：**无 ExpeditionForcePanel 导入**。
验证 `executeSiegeWithExpedition` 在 `src/components/` 中出现：**0个文件匹配**。

`ExpeditionForcePanel` 仅出现在3个文件中：
- `ExpeditionForcePanel.tsx` -- 组件定义
- `ExpeditionForcePanel.test.tsx` -- 组件测试
- `ui-interaction.integration.test.tsx` -- UI集成测试

全部是测试文件或组件自身，**无任何业务父组件引用**。

**断裂 2: executeSiege vs executeSiegeWithExpedition**

`WorldMapTab.tsx:695` 明确调用：
```typescript
const result = siegeSystem.executeSiege(siegeTarget.id, 'player', deployTroops, currentGrain);
```

而 `SiegeSystem.ts:736` 提供了新方法：
```typescript
executeSiegeWithExpedition(forceId, targetId, attackerOwner, availableGrain, strategy?)
```

**关键区别**：`executeSiegeWithExpedition` 需要 `forceId`（编队ID），意味着需要先通过编队系统创建编队。由于 UI 层没有集成 ExpeditionForcePanel，无法创建编队，因此 `executeSiegeWithExpedition` **永远无法被触发**。

**断裂 3: SiegeResultData 接口验证**

读取 `SiegeResultModal.tsx:34-64`，`SiegeResultData` 接口包含以下字段：
```typescript
export interface SiegeResultData {
  launched: boolean;
  victory: boolean;
  targetId: string;
  targetName: string;
  cost: { troops: number; grain: number; };
  capture?: { territoryId: string; newOwner: string; previousOwner: string; };
  failureReason?: string;
  defeatTroopLoss?: number;
  siegeReward?: { resources?: Record<string, number>; territoryExp?: number; items?: SiegeRewardItem[]; };
}
```

搜索 `casualties|heroInjured|hero_injured`：**0个匹配**（除了 `data-testid="siege-result-casualties"` 这个纯CSS容器ID）。

`data-testid="siege-result-casualties"` 区域 (line 190-216) 只显示：
- 出征兵力 (cost.troops)
- 消耗粮草 (cost.grain)
- 兵力损失/消耗 (defeatTroopLoss)

**完全没有**：伤亡人数、伤亡率、将领受伤状态、受伤等级、恢复时间等任何编队/伤亡详情。

**断裂 4: 比 Builder 描述更严重**

Builder 仅提到 "将领受伤状态无处展示"。但实际上：

- G4 (编队UI组件) 实现完整但未集成 -> **用户无法选编队**
- G5 (攻城弹窗集成编队) 未实现 -> **攻城流程无编队步骤**
- H4 (伤亡集成到攻城) 引擎OK但UI断裂 -> **用户看不到伤亡**
- H5 (伤亡详情弹窗) 数据接口缺失 -> **弹窗无伤亡数据**
- H6 (将领受伤状态) 孤立组件 -> **用户看不到受伤**
- H7 (受伤影响战力) 仅引擎层 -> **用户感知不到影响**

### 裁定

Builder 的集成断裂分析**方向正确但严重程度低估**。这不是4个小问题，而是 **整个编队/伤亡子系统在UI层完全未集成**，涉及 G4-G6 和 H4-H7 共 7 个功能点的用户可见性为零。

---

## 攻击 3: 空壳测试攻击 -- E1-3/E1-4

### Builder 声称

> E1-3: 空壳测试 -- 只检查 `mockTerritories.length > 0`
> E1-4: 空壳测试 -- 只检查 `playerTerritories.length > 0`

### Challenger 验证

读取 `e2e-map-flow.integration.test.ts` 原文：

**E1-3 (line 109-115):**
```typescript
describe('E1-3: 行军→寻路→精灵', () => {
  it('应该支持行军路径计算', () => {
    // 行军系统需要地图数据，这里只测试接口
    const territories = Array.from(mockTerritories.values());
    expect(territories.length).toBeGreaterThan(0);
  });
});
```

**验证**：完全确认。该测试的名称是"行军→寻路→精灵"全流程，但实际断言仅检查 mock 数据数组非空。没有任何 PathfindingSystem、MarchingSystem、MarchSprite 的测试调用。

**E1-4 (line 117-124):**
```typescript
describe('E1-4: 离线→上线→领取', () => {
  it('应该支持离线奖励', () => {
    // 离线系统需要引擎支持，这里只测试接口
    const territories = Array.from(mockTerritories.values());
    const playerTerritories = territories.filter(t => t.ownership === 'player');
    expect(playerTerritories.length).toBeGreaterThan(0);
  });
});
```

**验证**：完全确认。该测试名称是"离线→上线→领取→资源更新"全流程，但实际只过滤出 player 领土并检查长度。没有任何 OfflineEventSystem、OfflineRewardModal、资源更新的测试调用。

**加重情节**：两个测试的注释都明确写了"只测试接口"和"这里只测试接口"，说明开发者**有意为之**，不是遗漏而是**占位测试**。PLAN.md 将这两个功能标记为完成是明确的虚假声明。

### 裁定

Builder 的空壳测试判定**完全正确**。但应该进一步指出：PLAN.md 将 E1-3 和 E1-4 标记为"完成"是基于占位测试的虚假完成。

---

## 攻击 4: 失败测试攻击 -- 27个是否"非核心"？

### Builder 声称

> 其中 2 个来自 cross-system-linkage（HeroStarSystem 问题，非地图核心），其余来自数值断言不匹配（城防值公式、驻防数值、攻城奖励递增等）。

### Challenger 分析

逐文件验证失败测试是否属于"地图核心功能"：

| 文件 | 失败数 | 是否核心 | Challenger 判定 |
|------|--------|---------|----------------|
| cross-system-linkage.integration.test.ts | 2 | 非核心 | 同意Builder -- HeroStarSystem非地图核心 |
| SiegeRewardProgressive.test.ts | 4 | **核心** | **推翻** -- 攻城奖励递增是攻城系统核心功能 |
| MapP1Numerics.test.ts | 5 | **核心** | **推翻** -- 城防值公式是攻城计算核心 |
| MapP2TerritoryDetail.test.ts | 3 | **核心** | **推翻** -- 领土详情是地图系统核心功能 |
| MapP2StatGarrison.test.ts | 5 | **核心** | **推翻** -- 驻防数值是地图核心功能 |
| map.adversarial.test.ts | 6 | **核心** | **推翻** -- 对抗性测试覆盖M1-M7全部7个地图子系统 |
| MapP2FilterDetail.test.ts | 1 | **核心** | **推翻** -- 筛选是地图UI核心功能 |
| CooldownManager.test.ts | 1 | **边缘** | 冷却管理器与攻城系统关联 |

**详细分析 SiegeRewardProgressive.test.ts**：

该文件测试 GAP-01（占领产出渐进）和 GAP-02（攻城奖励链路），包含：
- 产出渐进公式验证（0h=50%, 12h=75%, 24h=100%）
- 首次攻占奖励（元宝x100 + 声望+50）
- 重复攻占奖励（铜钱x5000 + 产出x2/24h）
- 特殊地标额外奖励

这些测试的注释中多处标记 `TODO-01` 到 `TODO-04`，说明**引擎功能尚未实现**。Builder 将其归类为"非地图核心"是完全错误的 -- 这些是 PRD 中明确要求的核心攻城奖励逻辑。

**详细分析 map.adversarial.test.ts**：

该文件覆盖 M1-M7 全部7个地图子系统的对抗性测试，包含5个维度（正常流程/边界条件/异常路径/跨系统交互/数据生命周期）。6个失败用例直接影响地图系统的健壮性验证。

### 裁定

27个失败测试中，**至少19个属于地图核心功能**（SiegeRewardProgressive 4个 + MapP1Numerics 5个 + MapP2TerritoryDetail 3个 + MapP2StatGarrison 5个 + map.adversarial 6个 - 可能部分重叠）。Builder 声称"非地图核心功能"是**严重低估**。

---

## 攻击 5: F系列攻击 -- 文档完成度

### Builder 声称

| ID | Builder 判定 |
|----|-------------|
| F2 | **缺失** -- MAP-INTEGRATION-STATUS.md 未找到 |
| F3 | **低** -- 无独立覆盖文档 |

### Challenger 验证

**F2: MAP-INTEGRATION-STATUS.md 实际存在**

文件路径：`docs/games/three-kingdoms/adversarial/flows/map/MAP-INTEGRATION-STATUS.md`

但该文件：
- 版本: v2.0，日期: 2026-05-03
- **不含 G系列（编队系统）和 H系列（伤亡系统）的任何内容**
- D系列标记为"测试中"（非完成）
- 只覆盖 A-D 系列

这意味着：虽然文件存在，但其内容**严重过时**，完全没有反映 PLAN.md 声称的 G/H 系列实现。PLAN.md 将 F2 标记为"完成"，但该文档并未更新至包含编队/伤亡系统的内容。

**F3: 测试覆盖文档**

搜索项目中的测试覆盖文档：
- `docs/games/three-kingdoms/test-coverage-improvement-plan.md` -- 通用改进计划，非地图专项
- `scripts/test-coverage-stats.sh` -- 统计脚本

确实**无独立的地图测试覆盖文档**。PLAN.md 将 F3 标记为"完成"是虚假声明。

**MAP-INTEGRATION-STATUS.md 自身的矛盾**：

该文档第6节声称：
> 测试文件: 48个 | 通过: 43 / 失败: 5 | 用例: 1699个 | 通过: 1675 | 失败: 7

而 Builder 核验结果显示：
> 测试文件: 65个 | 通过: 57 / 失败: 8 | 用例: 1815个 | 通过: 1771 | 失败: 27

文档数据与实际测试结果严重不符，进一步证明该文档**未及时更新**。

### 裁定

- **F2**: Builder 声称"缺失"是**事实错误**（文件存在），但文件内容严重过时（无G/H系列），PLAN.md 标记为"完成"仍属虚假
- **F3**: Builder 判定"低"**正确确认**，确实无独立测试覆盖文档

---

## 攻击 6: H5 攻击 -- SiegeResultData 缺少 casualties 字段

### Builder 声称

> H5: 低可信度 -- SiegeResultData 接口无 casualties/heroInjured 字段

### Challenger 加深验证

PLAN.md line 98 标记：
```
| H5 | 攻城结果弹窗显示伤亡详情 | ✅ |
```

但实际验证：

1. **SiegeResultData 接口** (SiegeResultModal.tsx:34-64)：无 `casualties`、`heroInjured`、`injuryReport` 或任何伤亡相关字段

2. **WorldMapTab.tsx:698-707** 中的 SiegeResult 构造：
```typescript
const siegeResultData: SiegeResultData = {
  launched: result.launched,
  victory: result.victory,
  targetId: result.targetId,
  targetName: result.targetName,
  cost: result.cost,
  capture: result.capture,
  failureReason: result.failureReason,
  defeatTroopLoss: result.defeatTroopLoss,
};
```

注意这里使用的是 `executeSiege`（旧方法）返回的 `result`，该方法的返回类型 `SiegeResult` 不包含 `casualties`。即使换了 `executeSiegeWithExpedition`，由于 `SiegeResultData` 接口不接受 `casualties` 字段，数据也无法传递到弹窗。

3. **SiegeResultModal 渲染**：`data-testid="siege-result-casualties"` 区域只渲染 `cost.troops`、`cost.grain`、`defeatTroopLoss`，无任何伤亡详情。

**三重断裂**：
- 引擎层 `executeSiegeWithExpedition` 返回 `casualties` 但 UI 层不调用
- UI 层 `SiegeResultData` 接口不接受 `casualties` 字段
- `SiegeResultModal` 不渲染伤亡详情

### 裁定

PLAN.md 将 H5 标记为"完成"是**彻头彻尾的虚假声明**。Builder 标记为"低"可信度是正确的，但应进一步指出这是一个**从引擎到接口到渲染的全链路断裂**。

---

## 攻击 7: 验收标准攻击 -- 实际完成率重估

### PLAN.md 声称

> 完成率: 50/50 = 100%

### Challenger 逐项重估

将50项功能按"用户可感知/可验证的完成度"重新评估：

#### A系列: 6/6 -- 确认

A1-A6 均有完整实现和测试，无争议。

#### B系列: 7/7 -- 确认

B1-B7 均有完整实现和测试，无争议。

#### C系列: 2/2 -- 确认

C1-C2 均有完整实现和测试，无争议。

#### D系列: 10/13 -- 3项无实证

| ID | PLAN状态 | 实际状态 | 判定 |
|----|---------|---------|------|
| D1-1~D1-5 | ✅ | 有实现+测试 | 完成 |
| D2-1~D2-4 | ✅ | 有实现+测试 | 完成 |
| D3-1 | ✅ | **无fps测试** | 未完成 |
| D3-2 | ✅ | 仅UI层简单布尔值，非渲染器优化 | 部分 |
| D3-3 | ✅ | 有测试 | 完成 |
| D3-4 | ✅ | **无代码实现** | 未完成 |

#### E系列: 4/6 -- 2项空壳

| ID | PLAN状态 | 实际状态 | 判定 |
|----|---------|---------|------|
| E1-1 | ✅ | 有实际断言 | 完成 |
| E1-2 | ✅ | 有实际攻城流程 | 完成 |
| E1-3 | ✅ | **占位测试** | 未完成 |
| E1-4 | ✅ | **占位测试** | 未完成 |
| E1-5 | ✅ | 有序列化测试 | 完成 |
| E1-6 | ✅ | 有全流程测试 | 完成 |

#### F系列: 1/3 -- 2项过时或缺失

| ID | PLAN状态 | 实际状态 | 判定 |
|----|---------|---------|------|
| F1 | ✅ | PRD文档存在且更新 | 完成 |
| F2 | ✅ | 文件存在但**不含G/H系列，严重过时** | 未完成 |
| F3 | ✅ | **无独立测试覆盖文档** | 未完成 |

#### G系列: 3/6 -- 3项未集成

| ID | PLAN状态 | 实际状态 | 判定 |
|----|---------|---------|------|
| G1 | ✅ | 类型定义完整 | 完成 |
| G2 | ✅ | 引擎实现完整 | 完成 |
| G3 | ✅ | 单元测试完整 | 完成 |
| G4 | ✅ | UI组件实现但**未集成到任何父组件** | 未完成 |
| G5 | ✅ | **攻城弹窗无编队选择集成** | 未完成 |
| G6 | ✅ | 引擎约束校验完整 | 完成 |

#### H系列: 3/7 -- 4项未集成/断裂

| ID | PLAN状态 | 实际状态 | 判定 |
|----|---------|---------|------|
| H1 | ✅ | 引擎伤亡计算完整 | 完成 |
| H2 | ✅ | 引擎受伤概率完整 | 完成 |
| H3 | ✅ | 引擎恢复机制完整 | 完成 |
| H4 | ✅ | 引擎集成OK但**UI层不调用新方法** | 未完成 |
| H5 | ✅ | **接口无casualties字段，弹窗无伤亡详情** | 未完成 |
| H6 | ✅ | **孤立组件，未集成** | 未完成 |
| H7 | ✅ | 引擎战力影响OK但**UI层无感知** | 未完成 |

### 完成率汇总

| 系列 | 总数 | 完成 | 未完成/虚假 | 完成率 |
|------|:----:|:----:|:----------:|:------:|
| A | 6 | 6 | 0 | 100% |
| B | 7 | 7 | 0 | 100% |
| C | 2 | 2 | 0 | 100% |
| D | 13 | 10 | 3 | 77% |
| E | 6 | 4 | 2 | 67% |
| F | 3 | 1 | 2 | 33% |
| G | 6 | 3 | 3 | 50% |
| H | 7 | 3 | 4 | 43% |
| **合计** | **50** | **36** | **14** | **72%** |

### 验收标准重估

PLAN.md 列出10条验收标准，逐条验证：

| # | 验收标准 | PLAN状态 | 实际状态 |
|---|---------|---------|---------|
| 1 | 编队必须有将领+士兵 | 达标 | **引擎达标，UI无入口** |
| 2 | 攻城后士兵有伤亡，武将可能受伤 | 达标 | **引擎达标，UI不显示** |
| 3 | 编队中的将领不能重复使用 | 达标 | **引擎达标，UI无编队** |
| 4 | 将领受伤后无法出征 | 达标 | **引擎达标，UI无感知** |
| 5 | 快捷键完整可用 | 达标 | 达标 |
| 6 | 响应式布局 | 达标 | 达标 |
| 7 | 性能达标(60fps) | 达标 | **无实证，0fps测试** |
| 8 | E2E全链路通过 | 达标 | **2/6为占位测试** |
| 9 | 文档完整 | 达标 | **F2过时、F3缺失** |
| 10 | 所有测试通过(0 failures) | 达标 | **27个失败** |

10条验收标准中，仅 #5 和 #6 完全达标，**2/10 = 20% 达标率**。

### 裁定

PLAN.md 声称的 50/50 = 100% 完成率是**虚假声明**。Challenger 评估实际完成率为 **36/50 = 72%**（如按用户可感知功能计算更低）。验收标准达标率仅 **20%**。

---

## 综合裁定

### Builder 报告的可信度评估

| 方面 | Builder 结论 | Challenger 判定 | 评价 |
|------|-------------|----------------|------|
| A/B/C系列 | 全部高 | 同意 | Builder 正确 |
| D3-1/D3-4 性能 | 高/中 | **无/无** | **严重幻觉** |
| E1-3/E1-4 空壳 | 低 | 同意，加重 | Builder 正确但应更尖锐 |
| 失败测试非核心 | 27个非核心 | **至少19个核心** | **严重低估** |
| F2 文档 | 缺失 | 存在但过时 | **事实错误** |
| 集成断裂 | 4项 | 7项（G4-G6+H4-H7） | **严重低估** |
| 完成率 | 未正面否定100% | **72%** | Builder 过于温和 |
| H5 虚假完成 | 低可信度 | 同意，三重断裂 | Builder 正确 |

### 核心结论

1. **Builder 在 A/B/C 系列的核验基本可信**，这三系列确实有完整的实现和测试覆盖。

2. **Builder 在性能测试方面存在严重幻觉**：D3-1 (60fps) 和 D3-4 (批量渲染) 完全没有代码和测试支撑，却被标记为"高"和"中"可信度。

3. **Builder 严重低估了编队/伤亡系统的集成断裂程度**：不是4个小问题，而是整个 G4-G6 + H4-H7 的 UI 集成完全缺失，导致 7 个功能点对用户不可见。

4. **Builder 将27个失败测试归类为"非核心"是错误判断**：至少 19 个涉及攻城奖励、城防公式、驻防数值、对抗性覆盖等核心功能。

5. **PLAN.md 的 100% 完成率是虚假声明**：实际完成率不超过 72%，验收标准达标率仅 20%。

6. **F2 (MAP-INTEGRATION-STATUS.md) 文件存在但 Builder 声称"缺失"**：这是一个事实错误，虽然文件确实过时且未包含 G/H 系列内容。

---

*Challenger 攻击报告 | 2026-05-04 | 独立核验*
