# Campaign模块挑战清单 — Round 2

> 生成时间：2025-06-19
> 挑战者: TreeChallenger (Tester Agent)
> 范围: `src/games/three-kingdoms/engine/campaign/` 全部源码 + `engine-save.ts` + `ThreeKingdomsEngine.ts`
> 基于: Round 2树（393节点）+ 源码深度验证

---

## 统计

| 指标 | Round 1 | Round 2 | 变化 |
|------|---------|---------|------|
| 总节点数 | 298 | 393 | +95 |
| P0节点 | 112 | 145 | +33 |
| 虚报节点 | ≥3 | 2(已修正) | -1 |
| 新确认P0 | 0 | 6 | +6 |
| 跨系统覆盖率 | 47% | 65% | +18% |
| 生命周期覆盖率 | 50% | 63% | +13% |

---

## 一、源码验证结果

### 验证命令1: VIP与Campaign系统集成

```bash
grep -rn "VIPSystem\|vipLevel\|freeSweep" src/games/three-kingdoms/engine/campaign/ --include="*.ts" | grep -v test
```

**结果**: 空输出。SweepSystem.ts中**完全没有**VIPSystem/vipLevel/freeSweep的任何引用。

```bash
grep -rn "freeSweep\|free.*sweep\|vipSystem\|vip.*sweep" src/games/three-kingdoms/engine/campaign/SweepSystem.ts
```

**结果**: 空输出。SweepSystem.ts中**零VIP集成代码**。

**结论**: R1 P0-01 **确认真实**。VIPSystem定义了免费扫荡和额外扫荡令特权，但SweepSystem完全没有VIPSystem依赖注入。这是**设计/实现层面的缺失**，不仅仅是测试缺失。

### 验证命令2: deserialize(null)崩溃

```bash
# CampaignSerializer.deserializeProgress
grep -rn "deserializeProgress" src/games/three-kingdoms/engine/campaign/CampaignSerializer.ts
```

**源码分析**:
- `CampaignSerializer.deserializeProgress(data, dataProvider)`: `if (data.version !== SAVE_VERSION)` → **无null防护**，null.version会TypeError。**确认P0**。
- `SweepSystem.deserialize(data)`: `if (data.version !== SAVE_VERSION)` → **无null防护**。**确认P0**。
- `VIPSystem.deserialize(data)`: `if (!data || data.version !== SAVE_VERSION) return;` → **已有null防护**。**R1虚报，修正为P2**。
- `ChallengeStageSystem.deserialize(data)`: `if (!data || data.version !== SAVE_VERSION) return;` → **已有null防护**。**R1虚报，修正为P2**。

**结论**: R1声称6个系统deserialize(null)崩溃，实际只有2个（CampaignSerializer、SweepSystem）真正崩溃。VIPSystem和ChallengeStageSystem已有`!data`防护。CampaignProgressSystem通过CampaignSerializer间接调用，同样崩溃。

### 验证命令3: AutoPushExecutor isRunning

```bash
grep -rn "isRunning" src/games/three-kingdoms/engine/campaign/AutoPushExecutor.ts
```

**源码分析**:
- Line 102: `isRunning: true` — 进入循环前设置
- Line 182: `this.progress.isRunning = false;` — 循环结束后设置
- `simulateAndRecord()` 方法**无try-catch**
- 循环体内`canChallenge()`/`calculateRewards()`/`completeStage()`调用**无try-catch**

**结论**: R1 P0-03 **确认真实**。任何循环内的异常都会导致`isRunning`永远为true。且不仅是`simulateBattle`，`canChallenge`、`calculateRewards`、`completeStage`、`mergeResources`等调用都可能抛异常。

### 验证命令4: stars=NaN

```bash
grep -rn "stars\|completeStage" src/games/three-kingdoms/engine/campaign/CampaignProgressSystem.ts
```

**源码分析**:
```typescript
const clampedStars = Math.max(0, Math.min(MAX_STARS, Math.floor(stars))) as StarRating;
if (clampedStars > state.stars) {
  state.stars = clampedStars;
}
```

- `Math.floor(NaN)` = `NaN`
- `Math.min(3, NaN)` = `NaN`
- `Math.max(0, NaN)` = `NaN`
- `NaN > state.stars` = `false` → stars不更新
- 但`clearCount++`仍执行 → 通关次数增加但星级不变
- 如果`state.stars`初始为0，则不更新是安全的
- **但**: 如果后续有人直接设置`state.stars = NaN`（如反序列化损坏数据），则`getStageStatus`中`NaN >= 3` = `false`，`firstCleared = true` → 返回`'cleared'`但stars为NaN

**结论**: R1 P0-04 **部分确认**。NaN传入不会直接导致崩溃，但会导致`clearCount`增加而stars不更新。**真正的风险在于反序列化损坏数据导致stars=NaN**。

### 验证命令5: engine-save.ts存档覆盖范围

```bash
grep -rn "sweep\|vip\|challenge" src/games/three-kingdoms/engine/engine-save.ts
```

**结果**: 空输出（exit code 1）。engine-save.ts中**完全没有**sweep/vip/challenge的引用。

**详细分析**:
- `buildSaveData()`: 只保存`ctx.campaign.serialize()`（CampaignProgressSystem）
- `restoreSaveData()`: 只恢复`ctx.campaign.deserialize(data.campaign)`
- SweepSystem、VIPSystem、ChallengeStageSystem的serialize/deserialize**从未被调用**
- ThreeKingdomsEngine.reset()确实重置了这三个系统（Line 528-529），但restore时不恢复

**结论**: **这是R2发现的最严重的P0缺陷**。SweepSystem的扫荡令、VIPSystem的VIP等级和经验、ChallengeStageSystem的挑战进度在引擎级保存/恢复时**完全丢失**。玩家每次重新加载游戏都会失去所有VIP等级、扫荡令和挑战进度。

---

## 二、R2挑战清单

### CH-R2-01: engine-save存档覆盖缺失（P0 — 新发现）

**严重程度**: P0（数据丢失）
**影响范围**: 所有使用SweepSystem/VIPSystem/ChallengeStageSystem的玩家

**复现步骤**:
1. 玩家通过VIPSystem.addExp升级到VIP5
2. 玩家通过SweepSystem获得扫荡令并扫荡
3. 玩家通过ChallengeStageSystem挑战关卡
4. 游戏调用buildSaveData()保存
5. 游戏重新加载调用restoreSaveData()
6. 检查VIPSystem.getEffectiveLevel() → 0（丢失）
7. 检查SweepSystem.getState().ticketCount → 0（丢失）
8. 检查ChallengeStageSystem的stageProgress → 全部重置（丢失）

**预期结果**: 所有系统状态应正确恢复
**实际结果**: 只有CampaignProgressSystem恢复，其他三个系统回到初始状态

**根因**: engine-save.ts的buildSaveData/restoreSaveData只处理了CampaignProgressSystem，未包含SweepSystem/VIPSystem/ChallengeStageSystem

### CH-R2-02: VIP免费扫荡无法生效（P0 — 确认R1）

**严重程度**: P0（付费功能失效）
**影响范围**: VIP5+付费用户

**复现步骤**:
1. VIPSystem.addExp升级到VIP5
2. VIPSystem.canUseFreeSweep() → true
3. SweepSystem.sweep(stageId, 1)
4. 检查SweepSystem.getState().ticketCount → 减少了1（消耗了扫荡令而非免费次数）

**预期结果**: 应优先消耗VIP免费扫荡次数，不消耗扫荡令
**实际结果**: SweepSystem不知道VIPSystem的存在，直接消耗扫荡令

**根因**: SweepSystem构造函数不接受VIPSystem参数，sweep()方法不检查VIP免费扫荡

### CH-R2-03: VIP额外扫荡令无法领取（P0 — 确认R1）

**严重程度**: P0（付费功能失效）
**影响范围**: VIP1+付费用户

**复现步骤**:
1. VIPSystem.addExp升级到VIP4
2. SweepSystem.claimDailyTickets()
3. 检查ticketCount → 3（只有基础扫荡令，无VIP额外）

**预期结果**: 基础3 + VIP额外3 = 6扫荡令
**实际结果**: 只有基础3扫荡令

**根因**: SweepSystem.claimDailyTickets()不查询VIPSystem.getExtraDailyTickets()

### CH-R2-04: AutoPushExecutor多处异常导致isRunning永久卡死（P0 — 扩展R1）

**严重程度**: P0（功能卡死）
**影响范围**: 使用自动推图功能的玩家

**R1只识别了simulateBattle异常，R2发现循环内所有外部调用都可能导致同样问题**:

| 调用点 | 异常场景 | isRunning卡死 |
|--------|---------|--------------|
| `sweepDeps.canChallenge(currentStageId)` | 返回异常 | ✅ |
| `sweepDeps.getStageStars(currentStageId)` | 返回异常 | ✅ |
| `this.rewardDistributor.calculateRewards(...)` | 计算异常 | ✅ |
| `this.simulateAndRecord(...)` 内部`simulateBattle` | 战斗异常 | ✅ |
| `this.simulateAndRecord(...)` 内部`completeStage` | 进度异常 | ✅ |
| `mergeResources/mergeFragments` | 合并异常 | ✅ |
| `this.getNextStage(currentStageId)` | 查询异常 | ✅ |

**修复建议**: 将整个for循环包裹在try-finally中，finally中确保`this.progress.isRunning = false`

### CH-R2-05: RewardDistributor.distribute(fragments:null)崩溃（P0 — 新发现）

**严重程度**: P0（运行时崩溃）

**源码**:
```typescript
distribute(reward: StageReward): void {
  // ...
  if (this.deps.addFragment) {
    for (const [generalId, count] of Object.entries(reward.fragments)) {
      // reward.fragments = null → Object.entries(null) → TypeError
    }
  }
}
```

**复现**: 构造reward对象时fragments字段为null（如配置错误或反序列化损坏）

### CH-R2-06: rollDropTable rng异常值导致掉落逻辑错误（P0 — 新发现）

**严重程度**: P0（掉落逻辑错误）

**场景A: rng()返回NaN**
- `NaN > entry.probability` = `false` → 不跳过 → **所有条目都掉落**
- 玩家可能获得超出预期的掉落

**场景B: rng()返回>1**
- `1.5 > 1.0` = `true` → 跳过 → **probability=1的条目不掉落**
- 必掉物品不掉落

**根因**: `if (this.rng() > entry.probability)` 使用 `>` 而非 `>=`，且无rng返回值校验

### CH-R2-07: ChallengeStageSystem预锁回滚竞态确认（P0 — 确认R1）

**源码确认**:
```typescript
const armyOk = this.deps.consumeResource('troops', config.armyCost);
const mandateOk = this.deps.consumeResource('mandate', config.staminaCost);
if (!armyOk || !mandateOk) {
  if (armyOk) this.deps.addResource('troops', config.armyCost);
  if (mandateOk) this.deps.addResource('mandate', config.staminaCost);
  return false;
}
```

**竞态场景**: `consumeResource('mandate')` 抛出异常（非返回false）时：
- `armyOk = true`（已扣减）
- `mandateOk` 未赋值（异常跳过）
- 进入catch/冒泡 → troops已扣减但未回滚

**修复建议**: 使用try-catch包裹两次扣减，异常时回滚已成功的扣减

### CH-R2-08: R1虚报修正

| R1声称 | 实际情况 | 修正 |
|--------|---------|------|
| VIPSystem.deserialize(null)崩溃 | 源码`if (!data \|\| ...)`已有防护 | **虚报，降为P2** |
| ChallengeStageSystem.deserialize(null)崩溃 | 源码`if (!data \|\| ...)`已有防护 | **虚报，降为P2** |
| 6个系统deserialize(null)崩溃 | 实际只有2个（CampaignSerializer、SweepSystem） | **数量修正为2** |

---

## 三、结构性风险评估

### 风险等级: 🔴 Critical（最高）

| # | 风险 | 影响 | 修复难度 | 优先级 |
|---|------|------|---------|--------|
| 1 | **engine-save不保存Sweep/VIP/Challenge** | 所有玩家每次加载丢失VIP等级/扫荡令/挑战进度 | 中等（需修改engine-save.ts + GameSaveData类型） | P0 |
| 2 | **SweepSystem无VIPSystem依赖注入** | VIP付费用户无法使用免费扫荡和额外扫荡令 | 中等（需修改SweepSystem构造函数+sweep逻辑） | P0 |
| 3 | **AutoPushExecutor循环无try-finally** | 任何循环内异常导致isRunning永久卡死 | 简单（添加try-finally包裹） | P0 |

### 风险等级: 🟠 High

| # | 风险 | 影响 | 修复难度 | 优先级 |
|---|------|------|---------|--------|
| 4 | **CampaignSerializer.deserializeProgress无null防护** | 损坏存档导致崩溃 | 简单（添加null检查） | P0 |
| 5 | **RewardDistributor.distribute无null防护** | fragments=null导致崩溃 | 简单（添加null检查） | P0 |
| 6 | **ChallengeStageSystem预锁回滚竞态** | 资源泄漏 | 中等（需要try-catch回滚） | P0 |
| 7 | **rollDropTable rng异常值** | 掉落逻辑错误 | 简单（添加rng返回值校验） | P0 |

---

## 四、挑战评分

| 维度 | R1分数 | R2分数 | 变化 | 说明 |
|------|--------|--------|------|------|
| API覆盖率 | 7.5 | **8.5** | +1.0 | 新增95节点覆盖了缺失的API和跨系统交互。engine-save集成验证发现了最严重的存档丢失问题 |
| 边界遗漏 | 7.0 | **8.0** | +1.0 | 补充了NaN/Infinity/undefined星级、rng异常值、minAmount>maxAmount、空掉落表等边界 |
| 跨系统遗漏 | 5.5 | **7.5** | +2.0 | 新增22个跨系统节点，覆盖VIP↔Sweep、引擎级存档、装备/联盟/远征集成。但仍有4个联盟/远征节点需PRD确认 |
| 异常路径遗漏 | 6.0 | **8.0** | +2.0 | 新增22个异常路径节点，修正了2个R1虚报，发现AutoPushExecutor 7个异常卡死点 |
| 生命周期遗漏 | — | **7.5** | — | 新增25个生命周期节点，覆盖扫荡/VIP/reset/存档恢复全链路 |

| **综合评分** | **6.5** | **7.8** | **+1.3** | 最重大发现：engine-save不保存3个子系统数据，这是生产级数据丢失缺陷 |
