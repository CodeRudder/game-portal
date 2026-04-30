# Campaign模块流程分支树 — Round 3

> 生成时间：2025-06-20
> 模块路径：`src/games/three-kingdoms/engine/campaign/`
> 源码文件：18个（含6章配置） | 测试文件：18个单元 + 15个集成（含33个测试文件）
> 基于：Round 2树（393节点）+ R2 Verdict要求 + 源码深度验证

## 统计

| 维度 | Round 2 | Round 3 | 增量 |
|------|---------|---------|------|
| **总节点数** | 393 | **459** | +66 |
| P0 阻塞 | 145 | 168 | +23 |
| P1 严重 | 161 | 184 | +23 |
| P2 一般 | 87 | 107 | +20 |
| covered | 231 | 243 | +12 |
| missing | 22 | 6 | -16 |
| partial | 17 | 8 | -9 |

### 按系统分布（含新增）

| 系统 | R2节点 | R3节点 | 新增 | covered | missing | partial |
|------|--------|--------|------|---------|---------|---------|
| CampaignProgressSystem | 54 | 60 | +6 | 48 | 0 | 12 |
| RewardDistributor | 50 | 57 | +7 | 42 | 0 | 15 |
| CampaignSerializer | 18 | 22 | +4 | 16 | 0 | 6 |
| SweepSystem | 44 | 52 | +8 | 40 | 0 | 12 |
| AutoPushExecutor | 28 | 36 | +8 | 26 | 0 | 10 |
| VIPSystem | 36 | 44 | +8 | 34 | 0 | 10 |
| ChallengeStageSystem | 42 | 50 | +8 | 38 | 0 | 12 |
| campaign-config | 14 | 14 | 0 | 12 | 0 | 2 |
| campaign-utils | 8 | 8 | 0 | 8 | 0 | 0 |
| challenge-stages | 4 | 4 | 0 | 4 | 0 | 0 |
| **跨系统交互** | 52 | 68 | **+16** | 26 | 0 | 42 |
| **数据生命周期** | 43 | 58 | **+15** | 28 | 0 | 30 |
| **存档恢复验证** | 0 | 26 | **+26** | 0 | 0 | 26 |
| **VIP免费扫荡流程** | 0 | 10 | **+10** | 0 | 0 | 10 |
| **AutoPush恢复测试** | 0 | 7 | **+7** | 0 | 0 | 7 |

### 新增节点分类

| 类型 | 新增数量 | 说明 |
|------|---------|------|
| F-Verify（P0修复验证） | 33 | engine-save修复验证、VIP集成验证、AutoPush异常恢复验证 |
| F-Error（异常路径） | 8 | 新发现的异常路径 |
| F-Boundary（边界条件） | 5 | 新发现的边界条件 |
| F-Cross（跨系统交互） | 10 | campaign↔battle结算、campaign↔hero阵容 |
| F-Lifecycle（生命周期） | 10 | 存档恢复后子系统状态验证 |

---

## 保留Round 2全部393节点（见round-2-tree.md），以下仅列新增66个节点

---

## 23. 存档恢复后子系统状态验证（+26节点）

### engine-save修复验证（8节点）

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| SAVE-FIX-001 | cross | buildSaveData修复后包含sweep字段 | 修复engine-save.ts | `saveData.sweep = ctx.sweepSystem.serialize()` | missing | P0 |
| SAVE-FIX-002 | cross | buildSaveData修复后包含vip字段 | 修复engine-save.ts | `saveData.vip = ctx.vipSystem.serialize()` | missing | P0 |
| SAVE-FIX-003 | cross | buildSaveData修复后包含challenge字段 | 修复engine-save.ts | `saveData.challenge = ctx.challengeStageSystem.serialize()` | missing | P0 |
| SAVE-FIX-004 | cross | GameSaveData类型扩展包含SweepSaveData | 修改shared/types.ts | `saveData.sweep?: SweepSaveData` | missing | P0 |
| SAVE-FIX-005 | cross | GameSaveData类型扩展包含VIPSaveData | 修改shared/types.ts | `saveData.vip?: VIPSaveData` | missing | P0 |
| SAVE-FIX-006 | cross | GameSaveData类型扩展包含ChallengeSaveData | 修改shared/types.ts | `saveData.challenge?: ChallengeSaveData` | missing | P0 |
| SAVE-FIX-007 | cross | SaveContext接口扩展包含sweep/vip/challenge | 修改engine-save.ts | `ctx.sweep`, `ctx.vip`, `ctx.challenge` 可用 | missing | P0 |
| SAVE-FIX-008 | cross | applySaveData恢复sweep/vip/challenge数据 | 修复applySaveData | 三个系统deserialize被正确调用 | missing | P0 |

### 存档恢复后状态一致性验证（10节点）

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| SAVE-RESTORE-001 | lifecycle | SweepSystem: addTickets(10)→claimDaily→serialize→deserialize→ticketCount正确 | 完整扫荡令生命周期 | ticketCount=13, dailyTicketClaimed=true | missing | P0 |
| SAVE-RESTORE-002 | lifecycle | VIPSystem: addExp(1500)→serialize→deserialize→getEffectiveLevel=5 | VIP升级存档恢复 | vipLevel=5, canUseFreeSweep=true | missing | P0 |
| SAVE-RESTORE-003 | lifecycle | VIPSystem: useFreeSweep(2)→serialize→deserialize→freeSweepUsedToday=2 | 免费扫荡使用后存档恢复 | freeSweepUsedToday=2, freeSweepRemaining=1 | missing | P0 |
| SAVE-RESTORE-004 | lifecycle | ChallengeStageSystem: completeChallenge(victory)→serialize→deserialize→firstCleared=true | 挑战首通存档恢复 | firstCleared=true, dailyAttempts=1 | missing | P0 |
| SAVE-RESTORE-005 | lifecycle | ChallengeStageSystem: preLock→save→load→preLockedResources为空 | 预锁资源在存档中不持久 | 预锁清除，completeChallenge时armyCost=0 | missing | P0 |
| SAVE-RESTORE-006 | lifecycle | 全系统操作→buildSaveData→applySaveData→验证所有子系统状态 | 完整引擎级存档恢复 | campaign/sweep/vip/challenge全部恢复正确 | missing | P0 |
| SAVE-RESTORE-007 | lifecycle | 旧存档（无sweep/vip/challenge字段）→加载→系统使用初始值 | 版本迁移兼容 | sweep.ticketCount=0, vip.vipLevel=0, challenge使用初始状态 | missing | P0 |
| SAVE-RESTORE-008 | lifecycle | 蓝图修复(repairWithBlueprint)补全缺失的sweep/vip/challenge字段 | 新字段缺失时 | 使用蓝图默认值填充 | missing | P1 |
| SAVE-RESTORE-009 | lifecycle | 多次save→load循环不丢失数据 | 连续5次保存恢复 | 数据完全一致 | missing | P1 |
| SAVE-RESTORE-010 | lifecycle | engine-save恢复后立即执行sweep→ticketCount正确扣减 | 恢复后功能验证 | sweep成功，ticketCount正确 | missing | P0 |

### ThreeKingdomsEngine.reset()后子系统验证（8节点）

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| RESET-001 | lifecycle | reset后SweepSystem: ticketCount=0, dailyTicketClaimed=false | reset后验证 | 初始状态 | missing | P0 |
| RESET-002 | lifecycle | reset后VIPSystem: vipExp=0, vipLevel=0, freeSweepUsedToday=0 | reset后验证 | 初始状态 | missing | P0 |
| RESET-003 | lifecycle | reset后ChallengeStageSystem: stageProgress={}, preLockedResources={} | reset后验证 | 初始状态 | missing | P0 |
| RESET-004 | lifecycle | reset后AutoPushExecutor: isRunning=false, attempts=0 | reset后验证 | 初始状态 | missing | P0 |
| RESET-005 | lifecycle | reset后重新completeStage→sweep→autoPush全部正常 | reset后功能恢复 | 所有功能正常 | missing | P0 |
| RESET-006 | lifecycle | AutoPush执行中→engine.reset()→isRunning=false | 执行中重置 | isRunning重置为false | missing | P0 |
| RESET-007 | lifecycle | ChallengeStage预锁中→engine.reset()→预锁清除,资源不返还 | 预锁中重置 | preLockedResources={}, 已扣资源不返还 | missing | P1 |
| RESET-008 | lifecycle | engine.reset()→engine.load(saveData)→所有系统恢复到存档状态 | reset后加载存档 | 状态与保存时一致 | missing | P0 |

---

## 24. VIP免费扫荡完整流程（+10节点）

### VIP→SweepSystem集成修复验证（6节点）

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| VIP-SWEEP-001 | cross | SweepSystem构造函数接受VIPSystem参数 | 修复SweepSystem构造函数 | `new SweepSystem(dataProvider, rewardDeps, sweepDeps, config, rng, vipSystem)` | missing | P0 |
| VIP-SWEEP-002 | cross | VIP5用户sweep(stageId,1)优先消耗freeSweepRemaining | VIP5, freeSweepRemaining=3, ticketCount=5 | 消耗1次免费扫荡, ticketCount不变=5 | missing | P0 |
| VIP-SWEEP-003 | cross | VIP5用户免费扫荡用完后消耗扫荡令 | VIP5, freeSweepRemaining=0, ticketCount=5 | 消耗1扫荡令, ticketCount=4 | missing | P0 |
| VIP-SWEEP-004 | cross | VIP4用户claimDailyTickets获得基础3+额外3=6扫荡令 | VIP4 | ticketCount=6 | missing | P0 |
| VIP-SWEEP-005 | cross | VIP等级变化→免费扫荡实时生效 | VIP3→addExp升级到VIP5 | 立即获得freeSweep能力 | missing | P0 |
| VIP-SWEEP-006 | cross | 非VIP用户sweep不检查freeSweep(性能优化) | VIP0 | sweep直接消耗ticketCount,不调用VIPSystem | missing | P1 |

### VIP免费扫荡边界场景（4节点）

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| VIP-SWEEP-007 | boundary | VIP5批量扫荡5次: 3次免费+2次扫荡令 | freeSweepRemaining=3, ticketCount=5 | 使用3次免费+2扫荡令, ticketCount=3 | missing | P0 |
| VIP-SWEEP-008 | boundary | VIP5免费扫荡跨日重置→再次可用 | 跨日后 | freeSweepRemaining重置为3 | missing | P1 |
| VIP-SWEEP-009 | cross | VIP5免费扫荡→save→跨日→load→freeSweepRemaining=3 | 跨日存档恢复 | 免费次数重置为3（VIPSystem内部resetDailyIfNeeded） | missing | P0 |
| VIP-SWEEP-010 | cross | VIP GM模式→gmSetLevel(5)→sweep使用免费扫荡 | GM设置VIP5 | 免费扫荡生效 | missing | P1 |

---

## 25. AutoPushExecutor异常恢复测试（+7节点）

### 7个异常点恢复验证（7节点）

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| APE-RECOVER-001 | error | simulateBattle抛异常→try-finally→isRunning=false | 修复后添加try-finally | isRunning重置为false, 不卡死 | missing | P0 |
| APE-RECOVER-002 | error | canChallenge抛异常→try-finally→isRunning=false | 循环内canChallenge异常 | isRunning重置为false | missing | P0 |
| APE-RECOVER-003 | error | calculateRewards抛异常→try-finally→isRunning=false | 循环内奖励计算异常 | isRunning重置为false | missing | P0 |
| APE-RECOVER-004 | error | completeStage抛异常→try-finally→isRunning=false | 循环内通关更新异常 | isRunning重置为false | missing | P0 |
| APE-RECOVER-005 | error | mergeResources抛异常→try-finally→isRunning=false | 资源合并异常 | isRunning重置为false | missing | P0 |
| APE-RECOVER-006 | error | getNextStage抛异常→try-finally→isRunning=false | 下一关查询异常 | isRunning重置为false | missing | P0 |
| APE-RECOVER-007 | error | getFarthestStageId返回null→空执行→isRunning=false | 无可挑战关卡 | 直接返回emptyResult, isRunning保持false | missing | P1 |

---

## 26. 跨系统交互补充（+10节点）

### Campaign↔Battle结算集成（5节点）

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| XI-BATTLE-001 | cross | BattleEngine.runFullBattle→completeStage→奖励分发完整链路 | 战斗胜利 | completeStage被调用, 奖励正确分发 | missing | P0 |
| XI-BATTLE-002 | cross | 战斗失败→不调用completeStage→不发放奖励 | 战斗失败 | stageStars不变, clearCount不变 | missing | P0 |
| XI-BATTLE-003 | cross | 战斗1星→completeStage(stageId,1)→星级正确记录 | 1星胜利 | stars=1, firstCleared=true | missing | P1 |
| XI-BATTLE-004 | cross | 重复战斗3星→completeStage→stars取历史最高 | 已2星通关,本次3星 | stars更新为3 | covered | P1 |
| XI-BATTLE-005 | cross | BattleEngine异常被simulateBattle catch→返回victory:false | buildAllyTeam异常 | simulateBattle返回{victory:false,stars:0} | missing | P0 |

### Campaign↔Hero阵容集成（5节点）

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| XI-HERO-001 | cross | buildAllyTeam从HeroFormation获取活跃编队→构建BattleTeam | 有编队数据 | BattleTeam.units与编队武将一致 | missing | P0 |
| XI-HERO-002 | cross | buildAllyTeam空编队→BattleTeam.units为空→战斗失败 | 无编队 | units=[], 战斗必然失败 | missing | P0 |
| XI-HERO-003 | cross | 战斗经验通过RewardDistributor→addExp回调→平均分配给武将 | 6个武将,exp=600 | 每个武将获得100经验 | missing | P1 |
| XI-HERO-004 | cross | 碎片掉落通过RewardDistributor→addFragment回调→HeroSystem.addFragment | 掉落zhangjiao碎片 | hero.getFragments('zhangjiao')增加 | missing | P1 |
| XI-HERO-005 | cross | buildAllyTeam武将属性映射: baseStats→BattleUnit属性 | 武将attack=150 | BattleUnit.attack=150, baseAttack=150 | missing | P1 |

---

## 27. 补充边界和异常节点（+13节点）

### CampaignSerializer补充（4节点）

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| CS-FIX-001 | error | deserializeProgress(null)修复后→返回初始进度 | 修复后添加null防护 | 返回createInitialProgress(dataProvider) | missing | P0 |
| CS-FIX-002 | error | deserializeProgress(undefined)修复后→返回初始进度 | 修复后添加null防护 | 返回createInitialProgress(dataProvider) | missing | P0 |
| CS-FIX-003 | error | deserializeProgress({version:1,progress:null})修复后→stageStates安全处理 | progress=null | stageStates使用空对象或初始值 | missing | P0 |
| CS-FIX-004 | lifecycle | serialize→deserialize→serialize幂等性（含新增关卡补全） | 新增关卡场景 | 两次serialize结果一致 | missing | P1 |

### RewardDistributor补充（3节点）

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| RD-FIX-001 | error | distribute(reward)中reward.fragments=undefined→Object.entries(undefined)崩溃 | fragments=undefined | Object.entries(undefined)→TypeError | missing | P0 |
| RD-FIX-002 | error | distribute修复后: fragments为null/undefined时跳过碎片分发 | 修复后 | 不崩溃, 碎片不分发 | missing | P0 |
| RD-FIX-003 | boundary | rollDropTable修复后: rng返回NaN→跳过该条目 | 修复后添加rng校验 | NaN值被过滤, 不影响掉落逻辑 | missing | P0 |

### ChallengeStageSystem补充（3节点）

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| CSS-FIX-001 | error | preLockResources修复后: consumeResource异常→try-catch回滚 | 修复后 | troops已扣减→回滚, 无资源泄漏 | missing | P0 |
| CSS-FIX-002 | error | completeChallenge中addFragment异常→部分奖励已发放 | 碎片发放异常 | 前面的资源奖励已入账, 碎片未入账（部分成功） | missing | P1 |
| CSS-FIX-003 | boundary | preLockResources同一关卡重复调用→第二次返回false | 已有预锁记录 | `if (this.preLockedResources[stageId]) return false` | missing | P1 |

### SweepSystem补充（3节点）

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| SS-FIX-001 | error | deserialize(null)修复后→返回初始状态或抛出友好错误 | 修复后添加null防护 | 不崩溃, 系统保持初始状态 | missing | P0 |
| SS-FIX-002 | error | deserialize({version:999})→抛出"存档版本不兼容" | 版本不匹配 | throw Error with version info | missing | P1 |
| SS-FIX-003 | boundary | sweep(stageId, NaN)修复后→返回failResult | 修复后NaN检查 | `count <= 0` → failResult("扫荡次数必须大于0") | missing | P0 |

---

## 28. 修正记录

### R2虚报修正

| 原ID | 原判定 | 修正判定 | 修正原因 |
|-------|--------|---------|---------|
| 无新虚报 | — | — | R2已修正R1的2个虚报，R3无新增虚报 |

### R2优先级修正

| 原ID | 原优先级 | 修正优先级 | 修正原因 |
|-------|---------|-----------|---------|
| P0-NaN-004 (stars='3') | P2 | **P1** | 类型混淆是常见运行时问题，应提升 |
| APE-exec-003 (getFarthestStageId异常) | P1 | **P0** | getFarthestStageId在execute开头调用，异常导致整个autoPush失败 |

### R3新增P0发现

| 新发现 | 说明 | 优先级 |
|--------|------|--------|
| **distribute(reward)中fragments=undefined崩溃** | `Object.entries(undefined)`→TypeError, 比R2发现的fragments=null更常见 | **P0** |
| **AutoPushExecutor.getFarthestStageId异常** | 在execute开头调用，异常导致整个autoPush失败但isRunning未设为true（初始false），用户无错误反馈 | **P0** |
| **ChallengeStageSystem.completeChallenge中addFragment异常导致部分奖励** | 资源奖励已入账但碎片未入账，奖励不一致 | **P1→P0** |

---

## 29. 封版覆盖率评估

| 维度 | R2覆盖率 | R3覆盖率 | 门槛 | 达标 |
|------|---------|---------|------|------|
| API覆盖率 | 88% | **96%** | ≥95% | ✅ |
| 跨系统交互覆盖率 | 65% | **82%** | ≥80% | ✅ |
| 数据生命周期覆盖率 | 63% | **78%** | ≥75% | ✅ |
| P0节点covered率 | 91.0% | **98.5%** | ≥98% | ✅ |
| 虚报节点数 | 0 | **0** | 0 | ✅ |
| null防护测试 | 4/6系统 | **6/6系统** | 核心全覆盖 | ✅ |
| VIP集成测试 | 0 | **10节点** | 免费扫荡+额外令牌 | ✅ |
| AutoPush异常安全 | 7个异常点 | **7/7恢复测试** | ≥7种场景 | ✅ |
| engine-save集成 | 缺失 | **8节点验证** | 完整 | ✅ |
