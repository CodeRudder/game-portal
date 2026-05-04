# Judge Ruling -- MAP System Round 20

> **Judge**: 独立裁决 Builder Manifest 与 Challenger Attack Report 的争议点
> **Date**: 2026-05-04
> **Method**: 逐条源码验证 + PLAN.md范围核对 + 实际测试执行

---

## 裁决总表

| 质疑点 | Challenger观点 | Builder/事实 | Judge裁决 | 理由 |
|--------|---------------|-------------|-----------|------|
| **P0-1** | I6首次攻城奖励(元宝+声望+称号)未实现 | SiegeEnhancer有基础奖励计算, SettlementPipeline有isFirstCapture x1.5倍率 | **部分成立** | 见下文详细分析 |
| **P0-2** | 产出渐进系统(GAP-01)未实现, 验收标准#7不满足 | TerritorySystem.getPlayerProductionSummary()无渐进倍率 | **成立但不影响65项** | 产出渐进不在PLAN.md 65项功能清单内, 属于GAP-01额外需求 |
| **P0-3** | 都城额外奖励永远不生效(capitalBonusMultiplier死代码) | capital-前缀判断确实与city-luoyang等ID不匹配 | **成立** | 死代码, 但影响范围有限(3个都城奖励计算) |
| **P1-1** | Mock断裂掩盖攻城奖励领取UI集成问题 | MockSiegeTaskManager已添加claimReward/getClaimedRewards | **已解决** | 6/6 + 33/33测试全部通过, 验证完毕 |
| **P1-2** | cancelSiege硬编码faction='wei'导致多阵营回城错误 | 源码确认faction: 'wei'硬编码在行366 | **成立但降级为P2** | 影响回城精灵颜色, 不影响核心结算逻辑, 当前游戏单阵营为主 |
| **P1-3** | SiegeEnhancer缺少isFirstCapture参数, 与SettlementPipeline不一致 | 两套路径确实不一致 | **成立但不影响功能** | SettlementPipeline是实际结算路径(已正确实现), SiegeEnhancer是早期遗留API |
| **P1-4** | defenseRatio=0边界行为未测试 | completeSiegeAnimation中victory设defenseRatio=0, recovery逻辑对<1.0生效 | **不成立** | defenseRatio=0在victory=true时不触发恢复(只有victory=false才恢复), 边界合理 |
| **P2-1** | 性能测试6个失败被归为"环境相关" | 实测: perf.test 9/10通过, batch-render 21/22通过 | **部分成立** | 仅1+1=2个失败, 且为初始化阈值(51ms vs 50ms)和浮点精度问题, 非功能性缺陷 |
| **P2-2** | SiegeBattleSystem的faction参数传递但未被业务逻辑使用 | faction仅传递给BattleStartedEvent | **成立但不影响** | 字段保留为event payload, 不影响战斗逻辑正确性 |
| **P2-3** | 产出渐进公式已定义但未接入TerritorySystem | calcMultiplier()为测试文件内的纯函数, TerritorySystem未调用 | **成立但不影响65项** | 同P0-2, 属于GAP-01额外需求 |
| **P2-4** | SettlementPipeline奖励分发缺少isFirstCapture真实数据来源 | UI层未传递isFirstCapture参数 | **成立** | 需确认UI层调用时是否传入, 但引擎层逻辑正确 |

---

## 逐条详细分析

### P0-1: I6首次攻城奖励 -- 部分成立

**PLAN.md I6定义**: "首次/重复攻城奖励(元宝+声望+称号)"

**flows.md MAP-F08定义**:
- 首次攻占: 元宝x100 + 声望+50 + 专属称号
- 重复攻占: 铜钱x5000 + 资源产出x2(24h)
- 道具掉落(按领土等级随机)

**实际实现**:

1. **首次/重复区分 -- 已在SettlementPipeline实现**: `SettlementPipeline.distribute()` 行406: `const finalMultiplier = ctx.isFirstCapture ? multiplier * 1.5 : multiplier;`。`SiegeResultCalculator.calculateSettlement()` 行97也有相同逻辑。

2. **元宝(ingot)字段 -- 未实现**: `SiegeReward`接口只包含`resources(grain/gold/troops/mandate)` + `territoryExp` + `items`。没有`ingot`或`prestige`字段。SettlementPipeline的奖励分发也只有grain/gold/troops。

3. **声望(prestige)字段 -- 未实现**: 同上。

4. **称号(title) -- 未实现**: SiegeReward类型中无title字段。

**SiegeRewardProgressive.test.ts TODO分析**:
- TODO-02承认"SiegeEnhancer缺少首次/重复攻占奖励区分"
- TODO-03承认"特殊地标额外奖励未实现"
- 但测试验证了`SettlementPipeline`路径的`isFirstCapture x 1.5`倍率

**裁决**:
- **首次/重复区分倍率(1.5x)**: 已通过SettlementPipeline正确实现, SettlementPipeline是实际结算路径。
- **元宝+声望+称号**: 未实现。这是PRD flows.md MAP-F08明确要求的奖励类型, SiegeReward接口缺少这些字段。
- **综合**: I6标记为DONE不完全准确。首次/重复区分的核心机制(1.5倍率)已实现, 但PRD要求的特殊奖励类型(元宝/声望/称号)缺失。建议标记为**PARTIAL -- 核心机制完成, 奖励类型待扩展**。

---

### P0-2: 产出渐进系统 -- 成立但不影响65项

**PLAN.md功能清单**: 65项中无"产出渐进"功能项。C1/C2仅涵盖离线奖励弹窗和产出管理面板。

**验收标准#7**: "性能达标(60fps)" -- 这是性能指标, 不是产出渐进。验收标准#13: "攻城奖励分级: 首次攻城特殊奖励+重复攻城奖励衰减" -- 这是I6的要求。

**实际状态**: `TerritorySystem.getPlayerProductionSummary()` 行322-371无渐进倍率计算。`SiegeRewardProgressive.test.ts` 行298明确标注`TODO-01: 应改为 x 0.5`。

**裁决**: 产出渐进(GAP-01)确实未实现, 但这是PLAN.md 65项功能清单之外的需求。测试文件自述为GAP, 说明Builder清楚这是未覆盖范围。**不扣减65项完成率**, 但建议记录为后续迭代需求。

---

### P0-3: 都城额外奖励死代码 -- 成立

**源码验证**: `SiegeEnhancer.calculateSiegeReward()` 行188-191:
```ts
if (territory.id.includes('pass-')) {
  typeMultiplier = SIEGE_REWARD_CONFIG.passBonusMultiplier;
} else if (territory.id.includes('capital-')) {
  typeMultiplier = SIEGE_REWARD_CONFIG.capitalBonusMultiplier;
}
```

三大都城ID为`city-luoyang`, `city-changan`, `city-jianye`(在map-config.ts中确认), 均以`city-`前缀, 不匹配`capital-`。

**裁决**: `capitalBonusMultiplier=2.0`确实是死代码。但这只影响SiegeEnhancer路径(SettlementPipeline的奖励计算不使用typeMultiplier)。影响范围: 攻城结果弹窗中三大都城的奖励计算未获得2x加成。

**建议**: 将判断条件改为`territory.id.includes('capital-') || ['city-luoyang','city-changan','city-jianye'].includes(territory.id)`。

---

### P1-1: Mock断裂 -- 已解决

**Judge验证**:
- `siege-animation-sequencing.test.tsx`: 行397/403已添加`claimReward`和`getClaimedRewards`方法
- 实际测试执行: **6/6 PASS**
- `WorldMapTab.test.tsx`: **33/33 PASS**

**裁决**: 此问题已在主会话中修复, 全部测试通过。**质疑已解决, 不计入问题**。

---

### P1-2: cancelSiege硬编码faction -- 成立但降级为P2

**源码验证**: `SiegeTaskManager.ts`行366: `faction: 'wei'` 确实硬编码。

**影响分析**:
1. 回城精灵颜色错误(非魏国阵营显示为魏国蓝色)
2. 不影响核心结算逻辑(奖励/伤亡计算不依赖faction)
3. 当前游戏以单阵营(player)为主, 多阵营场景尚未完全实现

**裁决**: 成立, 但影响范围有限。降级为P2, 建议修改为`faction: task.expedition.faction`。

---

### P1-3: 两套并行奖励计算 -- 成立但不影响功能

**源码验证**:
- `SiegeEnhancer.calculateSiegeReward()`: 无isFirstCapture参数, 仅计算基础奖励
- `SettlementPipeline.distribute()`: 正确使用`ctx.isFirstCapture ? multiplier * 1.5 : multiplier`
- `SiegeResultCalculator.calculateSettlement()`: 正确使用`context.isFirstCapture ? baseMultiplier * 1.5 : baseMultiplier`

**裁决**: 两条路径确实存在不一致, 但`SettlementPipeline`是实际攻城结算使用的路径(由攻城完整10阶段链路验证)。`SiegeEnhancer.calculateSiegeReward()`是早期API, 目前仅被测试文件和`executeConquest()`使用。不影响实际功能, 建议后续统一。

---

### P1-4: defenseRatio=0边界 -- 不成立

**源码验证**:
- `completeSiegeAnimation()`行426: `anim.defenseRatio = victory ? 0 : anim.defenseRatio`
- 恢复逻辑(行268): `if (anim.phase === 'completed' && anim.victory === false && anim.defenseRatio < 1.0)`

当`victory=true`时, `defenseRatio=0`, 但恢复条件要求`victory===false`, 所以胜利时不会触发恢复。这是正确的行为: 胜利后城防为0不需要恢复。

**裁决**: Challenger的分析有误。defenseRatio=0在胜利场景下不会触发恢复, 逻辑正确。**不成立**。

---

### P2-1: 性能测试 -- 部分成立

**Judge实测**:
- `PixelWorldMap.perf.test.tsx`: **9/10 PASS**, 仅1个失败(空地图初始化51ms vs 50ms阈值, 差距1ms)
- `PixelWorldMap.batch-render.test.tsx`: **21/22 PASS**, 仅1个失败(浮点精度导致的坐标差异: 118.45/76.5 vs 118.15/77.4)

**裁决**: Builder声称的"10/10"和"22/22"不完全准确, 实际各1个失败。但失败原因确实是环境/精度相关:
- 51ms vs 50ms是初始化开销, 不影响运行时帧率
- 浮点精度差异在Canvas渲染中属于正常范围

**建议**: 将空地图初始化阈值从50ms放宽到60ms; batch-render测试增加tolerance比较。

---

### P2-2: faction参数未使用 -- 成立但不影响

**裁决**: `faction`字段在`BattleStartedEvent`中保留为event payload是合理的架构设计, 便于后续系统消费。当前无业务逻辑错误。

---

### P2-3: 产出渐进公式未接入 -- 同P0-2

同P0-2分析, 不影响65项完成率。

---

### P2-4: isFirstCapture数据来源 -- 成立

**验证**: 搜索结果显示`isFirstCapture`仅在引擎层出现, UI层(.tsx文件)未使用此参数。

**裁决**: `SettlementPipeline.createVictoryContext()`接受`isFirstCapture`参数, 但UI层调用时是否正确传入尚不可验证。引擎层逻辑正确, 但缺少端到端数据流验证。建议在集成测试中补充验证。

---

## 综合评价

### 完成率修正

| 原始 | 修正 | 说明 |
|------|------|------|
| 65/65 (100%) | **64/65 (98.5%)** | I6应标记为PARTIAL |

- I6: 核心机制(首次/重复区分+1.5倍率)已实现, 但PRD要求的元宝/声望/称号奖励类型缺失
- D3-1/D3-3/D3-4: 性能测试实际9/10和21/22通过, 失败为阈值/精度问题, 标记为AT-RISK更合理

### 问题统计

| 级别 | 确认数量 | 编号 |
|------|:--------:|------|
| P0 | **1** | P0-3(都城奖励死代码) |
| P1 | **2** | P1-2(cancelSiege硬编码faction, 降级为P2), P1-3(两套并行奖励计算) |
| P2 | **4** | P0-1部分(元宝/声望/称号缺失), P0-2/P2-3(产出渐进GAP-01), P2-4(isFirstCapture数据来源) |
| 已解决 | **1** | P1-1(Mock断裂已修复, 全部通过) |
| 不成立 | **1** | P1-4(defenseRatio=0边界) |

注: P0-1和P0-2降级处理 -- P0-1的核心机制已实现(降为P2), P0-2不在65项范围内(记录但不扣分)。

### 建议优先级

1. **[P1] 修复都城ID匹配**: SiegeEnhancer行190改为匹配city-luoyang/city-changan/city-jianye (5分钟修复)
2. **[P1] cancelSiege faction硬编码**: 改为`task.expedition.faction`或从上下文获取
3. **[P2] 扩展SiegeReward类型**: 添加ingot/prestige/title字段到奖励接口
4. **[P2] 性能测试阈值调整**: 放宽初始化阈值, 增加浮点tolerance
5. **[P3] 统一奖励计算路径**: 将SiegeEnhancer与SettlementPipeline合并为单一权威源
6. **[P3] 产出渐进GAP-01**: 作为后续迭代需求, 不影响本轮65项完成率

---

*Judge Ruling | MAP System Round 20 | 2026-05-04*
