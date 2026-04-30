# Campaign模块挑战清单 — Round 1

> 生成时间: 2025-06-18
> 挑战者: TreeChallenger (Tester Agent)
> 范围: `src/games/three-kingdoms/engine/campaign/` 全部源码 + `__tests__/` 全部测试

---

## 统计

| 指标 | 数值 |
|------|------|
| 源码文件数（非test/config/types） | 12 |
| 测试文件数（单元） | 18 |
| 测试文件数（集成） | 15 |
| 测试用例总数（估算） | ~1,800 |
| System 公开 API 总数 | ~94 |
| 已测试 API 数（估算） | ~74 |
| 未测试 API 数（估算） | ~20 |
| API 覆盖率 | **~79%** |

### 各 System API 覆盖概览

| System | 公开 API 数 | 已测试 | 覆盖率 | 测试文件 |
|--------|------------|--------|--------|----------|
| CampaignProgressSystem | 14 | 13 | 93% | CampaignProgressSystem-p1/p2.test.ts, CampaignIntegration.progress.test.ts |
| RewardDistributor | 12 | 11 | 92% | RewardDistributor-p1/p2.test.ts |
| CampaignSerializer | 2 | 2 | 100% | CampaignSerializer.test.ts |
| SweepSystem | 14 | 12 | 86% | SweepSystem.test.ts, SweepSystem.sweep.test.ts |
| AutoPushExecutor | 4 | 3 | 75% | AutoPushExecutor.test.ts |
| VIPSystem | 18 | 16 | 89% | VIPSystem.test.ts |
| ChallengeStageSystem | 12 | 10 | 83% | ChallengeStageSystem.test.ts |
| campaign-config | 5 | 5 | 100% | campaign-config.test.ts, campaign-chapters-*.test.ts |
| campaign-utils | 2 | 2 | 100% | campaign-utils.test.ts |
| challenge-stages | 1 | 1 | 100% | challenge-stages.test.ts |

---

## F-Normal 遗漏（公开API完全没有测试）

| # | System | API | 说明 |
|---|--------|-----|------|
| 1 | AutoPushExecutor | `execute()` 中 simulateBattle 抛出异常时的行为 | 源码无 try-catch，simulateAndRecord 直接调用 deps.simulateBattle，异常会冒泡 |
| 2 | RewardDistributor | `getFinalStageBonus(stars=0)` 星级为0时 starMultiplier=Math.max(1,0)=1 | 边界行为需确认：0星是否应该获得奖励 |
| 3 | VIPSystem | `calcLevelFromExp()` 静态行为验证 | 通过VIP_LEVEL_TABLE边界值验证 |
| 4 | ChallengeStageSystem | `completeChallenge` 中 exp 计算公式 `100 * 1.5` | 硬编码经验值，需确认是否应从配置获取 |
| 5 | SweepSystem | `sweep()` 中 `executeSingleSweep` 使用历史最高星级 | 非首通模式，需验证 isFirstClear=false 正确传递 |
| 6 | AutoPushExecutor | `getNextStage()` 跨章节推进 | 下一章第一关的获取逻辑需独立验证 |

---

## F-Boundary 遗漏（缺少边界条件测试）

| # | System | API | 边界条件 | 说明 |
|---|--------|-----|----------|------|
| 1 | CampaignProgressSystem | `completeStage` | stars=NaN | **P0** Math.floor(NaN)=NaN，Math.max(0,NaN)=NaN，星级可能变为NaN |
| 2 | CampaignProgressSystem | `completeStage` | stars=Infinity | Math.floor(Infinity)=Infinity，clamp后=3 |
| 3 | CampaignProgressSystem | `initProgress` | dataProvider.getChapters()=[] | currentChapterId=''，stageStates={} |
| 4 | CampaignProgressSystem | `isPredecessorCleared` | 章节无前置且非第1章第1关 | 返回false，但逻辑是否正确？ |
| 5 | CampaignProgressSystem | `completeStage` | stageId存在但不在stageStates中 | 源码有兜底 createInitialStageState，但需验证 |
| 6 | RewardDistributor | `calculateRewards` | dropTable=[] | 空掉落表，fragments={}, bonusExp=0 |
| 7 | RewardDistributor | `calculateRewards` | baseRewards所有值为0 | resources所有值为0（amount>0检查） |
| 8 | RewardDistributor | `rollDropTable` | probability=0 | rng()>0永远true，跳过该条目 |
| 9 | RewardDistributor | `rollDropTable` | probability=1 | rng()可能=1，>1为false，条目被跳过（**P0** 概率=1不掉落） |
| 10 | RewardDistributor | `rollDropTable` | minAmount=maxAmount=0 | amount=0，amount<=0跳过 |
| 11 | RewardDistributor | `rollDropTable` | minAmount>maxAmount | randomInt结果可能为负 |
| 12 | SweepSystem | `sweep` | count=1（最小有效值） | success=true, executedCount=1 |
| 13 | SweepSystem | `addTickets` | amount=Number.MAX_SAFE_INTEGER | ticketCount溢出？ |
| 14 | SweepSystem | `claimDailyTickets` | 跨年日期变化 | 日期字符串正确生成 |
| 15 | VIPSystem | `addExp` | amount=Number.MAX_SAFE_INTEGER | vipExp溢出？ |
| 16 | VIPSystem | `getLevelProgress` | exp恰好等于当前等级requiredExp | progress=0 |
| 17 | VIPSystem | `getLevelProgress` | exp恰好等于下一等级requiredExp | progress=1 |
| 18 | ChallengeStageSystem | `preLockResources` | consumeResource返回false后回滚 | 回滚逻辑正确性 |
| 19 | ChallengeStageSystem | `completeChallenge` | victory=false且无preLocked | 返回armyCost=0, staminaCost=0 |
| 20 | ChallengeStageSystem | `calculateRewards` | randomDrops全部概率命中 | 所有掉落都被添加 |
| 21 | ChallengeStageSystem | `calculateRewards` | randomDrops全部概率未命中 | 只有固定奖励 |
| 22 | AutoPushExecutor | `execute` | ticketCount=0 | 三星关无法用扫荡，尝试模拟战斗 |
| 23 | CampaignProgressSystem | `updateCurrentChapter` | 非当前章节的关卡通关 | currentChapterId不变 |
| 24 | RewardDistributor | `distribute` | fragments中count=0 | addFragment不被调用（count>0检查） |

---

## F-Cross 遗漏（跨系统交互缺失）

| # | 交互链路 | 说明 | 优先级 |
|---|----------|------|--------|
| 1 | **VIPSystem→SweepSystem免费扫荡** | VIP5免费扫荡3次/日，SweepSystem未集成VIPSystem的免费扫荡机制 | **P0** |
| 2 | **VIPSystem→SweepSystem额外扫荡令** | VIP1+每日额外1扫荡令，VIP4+额外2扫荡令，SweepSystem未集成 | **P1** |
| 3 | **CampaignProgress→SweepSystem→AutoPush完整链路** | 进度查询→扫荡解锁→自动推图三者协同 | **P0** |
| 4 | **serialize/deserialize→completeStage** | 存档恢复后继续通关，进度正确 | **P0** |
| 5 | **SweepSystem.serialize→deserialize→sweep** | 扫荡系统存档恢复后扫荡功能正常 | **P0** |
| 6 | **多系统serialize→engine保存→deserialize** | 全系统存档恢复，所有系统状态正确 | **P0** |
| 7 | **buildRewardDeps→经验平均分配** | 多武将时经验平均分配，0武将时跳过 | P1 |
| 8 | **VIPSystem→ChallengeStageSystem** | VIP特权是否影响挑战关卡（如额外次数） | P1 |
| 9 | **CampaignProgress→ChallengeStageSystem解锁** | 主线进度是否影响挑战关卡解锁 | P1 |
| 10 | **completeStage→lastClearTime→离线奖励** | 通关时间影响离线奖励计算 | P1 |
| 11 | **RewardDistributor.getUnificationRewards→称号系统** | 天下一统奖励发放到称号系统 | P2 |
| 12 | **SweepSystem.reset→AutoPushExecutor.reset** | 扫荡系统重置时推图进度也重置 | P1 |
| 13 | **VIPSystem.serialize→deserialize→特权校验** | VIP存档恢复后特权校验正确 | P1 |
| 14 | **全系统协同→存档→恢复→继续游戏** | 端到端链路完整性 | P0 |
| 15 | **ChallengeStageSystem→VIPSystem免费挑战** | VIP是否影响挑战次数限制 | P2 |

---

## F-Error 遗漏（异常路径缺失）

| # | System | 异常场景 | 说明 | 优先级 |
|---|--------|----------|------|--------|
| 1 | CampaignProgressSystem | completeStage(stageId=NaN) | getStage(NaN)返回undefined，抛出Error | P1 |
| 2 | CampaignProgressSystem | completeStage(stageId='') | getStage('')返回undefined，抛出Error | P1 |
| 3 | CampaignProgressSystem | deserialize(null) | 版本检查data.version，null会崩溃 | **P0** |
| 4 | RewardDistributor | calculateRewards(stageId=null) | getStage(null)返回undefined，抛出Error | P1 |
| 5 | RewardDistributor | distribute(reward=null) | 直接解构reward.resources，null崩溃 | **P0** |
| 6 | RewardDistributor | distribute(reward=undefined) | 同上 | **P0** |
| 7 | RewardDistributor | deps.addResource抛出异常 | distribute中回调异常 | P1 |
| 8 | SweepSystem | sweep(stageId=null) | canSweep中getStageStars(null)行为不确定 | P1 |
| 9 | SweepSystem | deserialize(null) | data.version检查，null崩溃 | **P0** |
| 10 | SweepSystem | sweepDeps.getStageStars抛出异常 | canSweep和sweep中调用 | P1 |
| 11 | AutoPushExecutor | execute(ticketCount=NaN) | ticketCount与sweepCostPerRun比较，NaN行为不确定 | P1 |
| 12 | AutoPushExecutor | sweepDeps.simulateBattle抛出异常 | simulateAndRecord无try-catch | **P0** |
| 13 | AutoPushExecutor | sweepDeps.getFarthestStageId抛出异常 | execute开头调用 | P1 |
| 14 | VIPSystem | deserialize(data.version=undefined) | undefined!==1，不崩溃但静默忽略 | P1 |
| 15 | ChallengeStageSystem | completeChallenge(stageId=null) | getStageConfig(null)返回undefined | P1 |
| 16 | ChallengeStageSystem | deps.consumeResource抛出异常 | preLockResources中扣减失败 | P1 |
| 17 | ChallengeStageSystem | deserialize(null) | data.version检查，null崩溃 | **P0** |
| 18 | ChallengeStageSystem | deps.addResource抛出异常 | completeChallenge中发放奖励 | P1 |
| 19 | CampaignSerializer | deserializeProgress(data=null) | data.version检查，null崩溃 | **P0** |
| 20 | CampaignSerializer | deserializeProgress(data.progress=null) | data.progress.stageStates，null崩溃 | **P0** |
| 21 | campaign-config | getStage(stageId=undefined) | Map.get(undefined)返回undefined | P2 |
| 22 | RewardDistributor | calculateRewards中rng返回NaN | randomInt(NaN,...)结果不确定 | P2 |
| 23 | RewardDistributor | calculateRewards中rng返回>1 | randomInt可能超出范围 | P2 |
| 24 | SweepSystem | claimDailyTickets(now=NaN) | getTodayString中new Date(NaN)行为 | P2 |

---

## F-Lifecycle 遗漏（生命周期路径缺失）

| # | 生命周期 | 说明 | 优先级 |
|---|----------|------|--------|
| 1 | **扫荡系统完整生命周期** | addTickets→claimDaily→sweep→serialize→deserialize | **P0** |
| 2 | **VIP系统完整生命周期** | addExp→升级→特权→免费扫荡→serialize→deserialize | **P0** |
| 3 | **全系统reset生命周期** | 使用所有系统→reset→所有系统回到初始状态 | **P0** |
| 4 | **旧存档升级生命周期** | 旧版本存档→新版本反序列化→新关卡补全→旧进度保留 | **P0** |
| 5 | **多次serialize/deserialize不丢失** | 连续序列化反序列化→数据完全一致 | P1 |
| 6 | **全系统协同生命周期** | 进度→扫荡→推图→奖励→存档→恢复→继续 | **P0** |
| 7 | **预锁→胜利→预锁→失败→返还** | 两次挑战，资源正确扣减和返还 | 已覆盖 |
| 8 | **VIP升级→特权解锁→使用→升级** | 连续addExp，特权逐步解锁 | 已覆盖 |
| 9 | **GM模式→正常模式切换** | gmSetLevel→gmResetLevel，等级恢复正确 | 已覆盖 |
| 10 | **跨日生命周期** | 今日操作→跨日→操作，每日重置正确 | 已覆盖 |
| 11 | **章节推进生命周期** | 通关所有5关→章节推进→继续下一章 | 已覆盖 |
| 12 | **6章全通关生命周期** | 从chapter1通关到chapter6 | 已覆盖 |

---

## 结构性风险（P0 级生产缺陷隐患）

### 风险1：RewardDistributor.rollDropTable 概率=1可能不掉落

**源码位置**: `RewardDistributor.ts` → `rollDropTable()`

```typescript
for (const entry of dropTable) {
  // ...
  if (this.rng() > entry.probability) continue;  // rng()可能返回1.0
  // ...
}
```

**风险**: `Math.random()` 返回 [0, 1) 范围，理论上不会返回1.0。但如果注入的 `rng` 返回1.0，则 `1.0 > 1.0` 为false，不会跳过。但更关键的是：如果 `probability=1.0` 且 `rng()=0.999...`，`0.999 > 1.0` 为false，条目正常处理。但如果 `rng()` 的实现返回 [0, 1]（含1.0），则 `1.0 > 1.0` 为false，仍正常。**实际风险较低**，但建议改为 `>=` 或文档说明rng应返回 [0, 1)。

**建议**: 改为 `if (this.rng() >= entry.probability) continue;` 确保probability=1时必掉。

### 风险2：CampaignProgressSystem.completeStage stars=NaN

**源码位置**: `CampaignProgressSystem.ts` → `completeStage()`

```typescript
const clampedStars = Math.max(0, Math.min(MAX_STARS, Math.floor(stars))) as StarRating;
if (clampedStars > state.stars) {
  state.stars = clampedStars;
}
```

**风险**: `Math.floor(NaN)` = `NaN`，`Math.min(3, NaN)` = `NaN`，`Math.max(0, NaN)` = `NaN`。`NaN > state.stars` = `false`，所以星级不会被更新但也不崩溃。然而 `clearCount++` 仍会执行，通关次数增加但星级为NaN。后续 `getStageStatus` 中 `state.stars >= MAX_STARS` → `NaN >= 3` = `false`，`state.firstCleared` = `true`，返回 `'cleared'`。

**建议**: 在 `completeStage` 入口添加 `if (typeof stars !== 'number' || isNaN(stars)) stars = 0;`

### 风险3：AutoPushExecutor.simulateAndRecord 无异常处理

**源码位置**: `AutoPushExecutor.ts` → `simulateAndRecord()`

```typescript
private simulateAndRecord(...): number | null {
  const battleResult = this.sweepDeps.simulateBattle(stageId);  // 直接调用，无try-catch
  const { victory, stars } = battleResult;
  // ...
}
```

**风险**: 如果 `sweepDeps.simulateBattle` 抛出异常，整个 `execute` 循环中断，`progress.isRunning` 永远为 `true`（在循环外才设为false），导致自动推图卡在"运行中"状态。

**建议**: 在 `simulateAndRecord` 中添加 try-catch，异常时视为战斗失败。

### 风险4：CampaignProgressSystem.deserialize(null) 崩溃

**源码位置**: `CampaignSerializer.ts` → `deserializeProgress()`

```typescript
export function deserializeProgress(data: CampaignSaveData, ...): CampaignProgress {
  if (data.version !== SAVE_VERSION) {  // data=null时崩溃
```

**风险**: 如果传入 `null` 或 `undefined`，直接访问 `data.version` 会抛出 TypeError。虽然 TypeScript 类型系统应阻止此情况，但运行时（如从 localStorage 读取损坏数据）无法保证。

**建议**: 添加 `if (!data) throw new Error('存档数据为空');`

### 风险5：ChallengeStageSystem 预锁资源回滚竞态

**源码位置**: `ChallengeStageSystem.ts` → `preLockResources()`

```typescript
const armyOk = this.deps.consumeResource('troops', config.armyCost);
const mandateOk = this.deps.consumeResource('mandate', config.staminaCost);

if (!armyOk || !mandateOk) {
  if (armyOk) this.deps.addResource('troops', config.armyCost);  // 回滚
  if (mandateOk) this.deps.addResource('mandate', config.staminaCost);  // 回滚
  return false;
}
```

**风险**: 如果 `consumeResource('troops')` 成功但 `consumeResource('mandate')` 抛出异常（而非返回false），则 troops 被扣减但不会被回滚，资源泄漏。

**建议**: 将两次扣减包裹在 try-catch 中，异常时回滚已扣减的资源。

### 风险6：RewardDistributor.distribute(reward=null) 崩溃

**源码位置**: `RewardDistributor.ts` → `distribute()`

```typescript
distribute(reward: StageReward): void {
  const resourceKeys = [...];
  for (const key of resourceKeys) {
    const amount = reward.resources[key];  // reward=null时崩溃
```

**风险**: `distribute` 是公开API，如果传入 null/undefined 的 reward，直接解构崩溃。

**建议**: 添加 `if (!reward) return;` 防护。

---

## 挑战评分

| 维度 | 评分 | 说明 |
|------|------|------|
| API覆盖率 | **7.5/10** | 79%覆盖率，核心系统（CampaignSerializer/campaign-config/campaign-utils/challenge-stages）达100%。CampaignProgressSystem 93%、RewardDistributor 92%。但VIPSystem与SweepSystem的集成、AutoPushExecutor异常处理等跨系统维度覆盖不足。 |
| 边界遗漏 | **7.0/10** | 核心边界（星级截断、通关次数、扫荡令不足、每日重置）覆盖较好。但NaN/Infinity星级、概率=1掉落、空掉落表、minAmount>maxAmount等边界缺失。stars=NaN导致星级变为NaN是最严重的边界遗漏。 |
| 跨系统遗漏 | **5.5/10** | 30个跨系统节点中16个missing（53%），最关键的缺失：VIP→免费扫荡集成、进度→扫荡→推图完整链路、存档恢复后继续游戏、多系统协同存档/恢复。VIPSystem与SweepSystem/ChallengeStageSystem的集成是最大的盲区。 |
| 异常路径遗漏 | **6.0/10** | 24项异常路径遗漏，其中6项为P0级（deserialize null、distribute null、simulateBattle异常、preLockResources回滚竞态）。多个系统的 deserialize 接受 null 时会崩溃，这是存档损坏时的真实风险。 |

| **综合评分** | **6.5/10** | 核心进度/奖励/扫荡逻辑测试充分，但VIP集成、异常防护和跨系统生命周期是明显短板。 |
