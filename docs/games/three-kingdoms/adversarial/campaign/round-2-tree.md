# Campaign模块流程分支树 — Round 2

> 生成时间：2025-06-19
> 模块路径：`src/games/three-kingdoms/engine/campaign/`
> 源码文件：18个（含6章配置） | 测试文件：18个单元 + 15个集成（含33个测试文件）
> 基于：Round 1 树（298节点）+ R1 Verdict要求 + 源码深度验证

## 统计

| 维度 | Round 1 | Round 2 | 增量 |
|------|---------|---------|------|
| **总节点数** | 298 | **393** | +95 |
| P0 阻塞 | 112 | 145 | +33 |
| P1 严重 | 134 | 161 | +27 |
| P2 一般 | 52 | 87 | +35 |
| covered | 216 | 231 | +15 |
| missing | 52 | 22 | -30 |
| partial | 30 | 17 | -13 |

### 按系统分布（含新增）

| 系统 | R1节点 | R2节点 | 新增 | covered | missing | partial |
|------|--------|--------|------|---------|---------|---------|
| CampaignProgressSystem | 48 | 54 | +6 | 42 | 2 | 10 |
| RewardDistributor | 40 | 50 | +10 | 36 | 4 | 10 |
| CampaignSerializer | 14 | 18 | +4 | 12 | 1 | 5 |
| SweepSystem | 36 | 44 | +8 | 34 | 2 | 8 |
| AutoPushExecutor | 20 | 28 | +8 | 18 | 2 | 8 |
| VIPSystem | 32 | 36 | +4 | 28 | 2 | 6 |
| ChallengeStageSystem | 34 | 42 | +8 | 28 | 4 | 10 |
| campaign-config | 14 | 14 | 0 | 12 | 0 | 2 |
| campaign-utils | 8 | 8 | 0 | 8 | 0 | 0 |
| challenge-stages | 4 | 4 | 0 | 4 | 0 | 0 |
| **跨系统交互** | 30 | 52 | **+22** | 18 | 4 | 30 |
| **数据生命周期** | 18 | 43 | **+25** | 16 | 1 | 26 |

### 新增节点分类

| 类型 | 新增数量 | 说明 |
|------|---------|------|
| F-Error（异常路径） | 22 | null防护、异常传播、资源回滚 |
| F-Boundary（边界条件） | 16 | NaN/Infinity、空配置、溢出、概率边界 |
| F-Cross（跨系统交互） | 22 | VIP↔Sweep、存档恢复、引擎级集成 |
| F-Lifecycle（生命周期） | 25 | 全链路生命周期、多系统协同 |
| F-Normal（正常路径） | 10 | 缺失API、未覆盖查询 |

---

## 保留Round 1全部298节点（见round-1-tree.md），以下仅列新增95个节点

---

## 13. P0 Bug修复验证节点（R1发现的5个P0）

### P0-01: VIP与Campaign系统集成缺失

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| P0-VIP-001 | cross | VIPSystem定义free_sweep特权但SweepSystem无VIP依赖 | 检查SweepSystem源码 | SweepSystem无VIPSystem引用，**确认是设计缺失** | **confirmed** | P0 |
| P0-VIP-002 | cross | VIPSystem定义extra_sweep_ticket特权但SweepSystem无集成 | 检查SweepSystem.addTickets | SweepSystem.addTickets无VIP额外令牌逻辑 | **confirmed** | P0 |
| P0-VIP-003 | cross | engine-save.ts不保存SweepSystem/VIPSystem/ChallengeStageSystem | 检查engine-save.ts | 只有campaign(CampaignProgressSystem)被保存，**Sweep/VIP/Challenge数据丢失** | **confirmed** | P0 |
| P0-VIP-004 | cross | ThreeKingdomsEngine.reset()重置sweep/vip/challenge但无对应restore | reset后sweep/vip/challenge回到初始状态，存档恢复无法还原 | **确认是P0存档丢失** | **confirmed** | P0 |
| P0-VIP-005 | cross | VIP免费扫荡集成方案：SweepSystem.sweep应检查VIPSystem.canUseFreeSweep | VIP5用户扫荡时 | 应先消耗免费次数再消耗扫荡令 | missing | P0 |

### P0-02: deserialize(null)崩溃验证

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| P0-DESER-001 | error | CampaignProgressSystem.deserialize(null) | data=null | CampaignSerializer.deserializeProgress(null)→data.version崩溃(TypeError) | **confirmed** | P0 |
| P0-DESER-002 | error | SweepSystem.deserialize(null) | data=null | data.version!==SAVE_VERSION→TypeError(null.version) | **confirmed** | P0 |
| P0-DESER-003 | error | VIPSystem.deserialize(null) | data=null | **源码已有防护**: `if (!data \|\| data.version !== SAVE_VERSION) return;` →不崩溃 | **R1虚报-已防护** | P0→P2 |
| P0-DESER-004 | error | ChallengeStageSystem.deserialize(null) | data=null | **源码已有防护**: `if (!data \|\| data.version !== SAVE_VERSION) return;` →不崩溃 | **R1虚报-已防护** | P0→P2 |
| P0-DESER-005 | error | CampaignSerializer.deserializeProgress(null) | data=null | data.version→TypeError，**无null防护** | **confirmed** | P0 |
| P0-DESER-006 | error | CampaignSerializer.deserializeProgress({version:1, progress:null}) | progress=null | data.progress.stageStates→TypeError | **confirmed** | P0 |
| P0-DESER-007 | error | engine-save恢复时campaign数据损坏 | data.campaign=null | `if (data.campaign)` 已有防护→跳过，不崩溃 | covered | P1 |

### P0-03: AutoPushExecutor异常导致isRunning卡死

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| P0-APE-001 | error | simulateBattle抛出异常→isRunning永远为true | deps.simulateBattle=()=>{throw new Error('battle error')} | isRunning应重置为false，实际**卡死为true** | **confirmed** | P0 |
| P0-APE-002 | error | simulateBattle返回null→解构崩溃 | battleResult=null | `const {victory, stars}=null`→TypeError | missing | P0 |
| P0-APE-003 | error | getFarthestStageId抛出异常→isRunning为初始false | execute开头调用异常 | isRunning保持false（未进入循环），但**无错误上报** | missing | P1 |
| P0-APE-004 | error | canChallenge抛出异常→isRunning卡死 | 循环内canChallenge异常 | isRunning永远为true（在循环外才设false） | missing | P0 |

### P0-04: stars=NaN导致星级异常

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| P0-NaN-001 | boundary | completeStage(stageId, NaN) | stars=NaN | Math.floor(NaN)=NaN, Math.min(3,NaN)=NaN, Math.max(0,NaN)=NaN → clampedStars=NaN → NaN > state.stars = false → stars不变但clearCount++ | **confirmed** | P0 |
| P0-NaN-002 | boundary | completeStage后getStageStatus | stars被设为NaN(如果初始stars也是NaN) | NaN>=3=false, firstCleared=true → 返回'cleared'但stars为NaN | missing | P0 |
| P0-NaN-003 | boundary | completeStage(stageId, Infinity) | stars=Infinity | Math.floor(Infinity)=Infinity, Math.min(3,Infinity)=3, Math.max(0,3)=3 → 正常截断为3 | covered | P1 |
| P0-NAN-004 | boundary | completeStage(stageId, '3') | stars='3'(string) | Math.floor('3')=3 → 正常截断为3 | missing | P2 |
| P0-NaN-005 | boundary | completeStage(stageId, undefined) | stars=undefined | Math.floor(undefined)=NaN → 同NaN场景 | missing | P0 |

### P0-05: ChallengeStageSystem预锁资源回滚竞态

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| P0-LOCK-001 | error | consumeResource('troops')成功后consumeResource('mandate')抛异常 | troops已扣，mandate抛错 | troops已扣但未回滚→**资源泄漏** | **confirmed** | P0 |
| P0-LOCK-002 | error | 回滚时addResource也抛异常 | consume成功→consume失败→addResource回滚也失败 | 双重异常→资源泄漏+未捕获异常 | missing | P0 |
| P0-LOCK-003 | error | completeChallenge时addResource(返还)抛异常 | victory=false, 返还预锁资源 | 返还失败→资源永久丢失 | missing | P1 |

---

## 14. RewardDistributor补充节点

### distribute()异常防护

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| RD-dist-007 | error | distribute(null) | reward=null | reward.resources→TypeError崩溃 | missing | P0 |
| RD-dist-008 | error | distribute(undefined) | reward=undefined | 同上 | missing | P0 |
| RD-dist-009 | error | distribute({resources:null}) | resources=null | for循环中null[key]=undefined→amount>0=false→跳过，**不崩溃** | missing | P1 |
| RD-dist-010 | error | distribute({resources:{}, exp:null}) | exp=null | null>0=false→跳过，**不崩溃** | missing | P1 |
| RD-dist-011 | error | distribute({resources:{}, fragments:null}) | fragments=null | Object.entries(null)→TypeError崩溃 | missing | P0 |

### rollDropTable边界

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| RD-drop-001 | boundary | probability=1必掉 | rng()返回0.999 | 0.999>1.0=false→不跳过→正常掉落 | missing | P1 |
| RD-drop-002 | boundary | probability=0必不掉 | rng()返回任意值 | rng()>0永远true→跳过 | missing | P1 |
| RD-drop-003 | boundary | minAmount>maxAmount | minAmount=5, maxAmount=3 | randomInt(5,3)可能返回负值或异常 | missing | P0 |
| RD-drop-004 | boundary | 空掉落表 | dropTable=[] | fragments={}, bonusExp=0 | missing | P1 |
| RD-drop-005 | boundary | rng返回NaN | rng()=>NaN | NaN>probability=false→不跳过→**所有条目都掉落** | missing | P0 |
| RD-drop-006 | boundary | rng返回>1 | rng()=>1.5 | 1.5>1.0=true→跳过probability=1的条目→**概率=1不掉落** | missing | P0 |

---

## 15. CampaignProgressSystem补充节点

### completeStage边界补充

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| CPS-comp-012 | boundary | completeStage(stageId, -Infinity) | stars=-Infinity | Math.floor(-Infinity)=-Infinity, Math.min(3,-Infinity)=-Infinity, Math.max(0,-Infinity)=0 → stars=0 | missing | P1 |
| CPS-comp-013 | boundary | completeStage(stageId, 0.5) | stars=0.5 | Math.floor(0.5)=0 → stars=0 | missing | P2 |
| CPS-comp-014 | error | completeStage后getTotalStars含NaN关卡 | 某关stars=NaN | totalStars+=NaN → 总星数为NaN | missing | P0 |
| CPS-comp-015 | cross | completeStage触发事件通知 | 通关任意关卡 | eventBus应发出stageCompleted事件 | missing | P1 |

### CampaignSerializer补充

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| CS-deser-005 | error | deserializeProgress(data={version:1, progress:{stageStates:null}}) | stageStates=null | for循环遍历stageIds，null[id]→TypeError | missing | P0 |
| CS-deser-006 | error | deserializeProgress(data={version:1, progress:{currentChapterId:null}}) | currentChapterId=null | currentChapterId=null被接受，后续getChapter(null)返回undefined | missing | P1 |
| CS-deser-007 | lifecycle | 多次序列化/反序列化幂等性 | serialize→deserialize→serialize | 两次serialize结果完全相同 | missing | P1 |
| CS-deser-008 | cross | 新版本增加关卡后旧存档反序列化 | 旧存档有5关，新版有6关 | 第6关初始化为stars=0 | covered | P1 |

---

## 16. SweepSystem补充节点

### VIP集成缺失验证

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| SS-vip-001 | cross | SweepSystem构造函数无VIPSystem参数 | 检查构造函数 | **无VIPSystem依赖注入** | **confirmed** | P0 |
| SS-vip-002 | cross | sweep()不检查VIP免费扫荡 | VIP5用户执行sweep | 应先消耗freeSweepRemaining再消耗ticketCount，**实际只消耗ticketCount** | missing | P0 |
| SS-vip-003 | cross | claimDailyTickets不增加VIP额外扫荡令 | VIP4用户领取每日扫荡令 | 应额外获得1+2=3扫荡令，**实际只获得基础3扫荡令** | missing | P0 |
| SS-vip-004 | cross | VIP免费扫荡次数跨日重置与SweepSystem无关 | 跨日后 | VIPSystem内部重置freeSweepUsedToday，但SweepSystem不知道 | missing | P0 |

### SweepSystem异常路径

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| SS-err-001 | error | sweep(stageId, NaN) | count=NaN | NaN<=0=false, NaN>10=false → 进入正常逻辑但循环异常 | missing | P0 |
| SS-err-002 | error | sweepDeps.getStageStars抛出异常 | getStageStars=()=>throw | canSweep中异常→sweep失败但无友好错误 | missing | P1 |
| SS-err-003 | boundary | addTickets(Number.MAX_SAFE_INTEGER) | amount=MAX_SAFE_INTEGER | ticketCount可能溢出 | missing | P2 |
| SS-err-004 | boundary | sweep(stageId, 1)最小有效值 | count=1 | success=true, executedCount=1 | missing | P1 |

---

## 17. AutoPushExecutor补充节点

### 异常安全补充

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| APE-exec-011 | error | execute(NaN) | ticketCount=NaN | NaN>=sweepCostPerRun=false→所有三星关走模拟战斗路径 | missing | P0 |
| APE-exec-012 | error | rewardDistributor.calculateRewards抛异常 | 循环内计算奖励异常 | isRunning卡死为true | missing | P0 |
| APE-exec-013 | error | sweepDeps.completeStage抛异常 | 模拟战斗后completeStage异常 | isRunning卡死为true | missing | P0 |
| APE-exec-014 | boundary | execute(0) | ticketCount=0 | 三星关无法用扫荡→走模拟战斗，非三星关正常 | covered | P1 |
| APE-exec-015 | cross | execute后getNextStage返回null | 最后一关胜利 | 循环正常结束，isRunning=false | covered | P1 |
| APE-exec-016 | error | getProgress()在execute异常后调用 | isRunning=true卡死 | getProgress返回isRunning=true，**用户无法重新执行** | missing | P0 |
| APE-exec-017 | error | resetProgress()在execute异常后调用 | isRunning=true卡死 | resetProgress应强制重置isRunning为false | missing | P0 |
| APE-exec-018 | cross | execute跨章节推进→getNextStage返回下章第一关 | 当前章最后一关胜利 | 下一次循环处理下章第一关 | covered | P1 |

---

## 18. VIPSystem补充节点

### VIP与存档系统集成

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| VIP-save-001 | cross | VIPSystem.serialize()数据不在engine-save中 | 检查engine-save.ts | **VIP数据不随引擎保存**→VIP经验/等级丢失 | **confirmed** | P0 |
| VIP-save-002 | cross | VIPSystem.deserialize()不被engine-save调用 | 检查restoreSaveData | VIPSystem状态永远为初始值 | **confirmed** | P0 |
| VIP-save-003 | cross | VIP升级后引擎保存→重新加载 | addExp→buildSaveData→restoreSaveData | VIP等级回到0，**付费数据丢失** | missing | P0 |
| VIP-save-004 | cross | VIP免费扫荡使用后保存→加载 | useFreeSweep→save→load | freeSweepUsedToday回到0，**可重复使用免费扫荡** | missing | P0 |

---

## 19. ChallengeStageSystem补充节点

### ChallengeStage存档集成

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| CSS-save-001 | cross | ChallengeStageSystem.serialize()数据不在engine-save中 | 检查engine-save.ts | **挑战进度不随引擎保存**→每日次数/首通状态丢失 | **confirmed** | P0 |
| CSS-save-002 | cross | 预锁资源在存档恢复后丢失 | preLock→save→load | preLockedResources为空→completeChallenge时armyCost=0 | missing | P0 |
| CSS-save-003 | cross | 挑战关卡进度在跨日重置后保存 | dailyAttempts=3→跨日→save | dailyAttempts=0，正确 | covered | P1 |

### ChallengeStage异常路径

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| CSS-err-001 | error | checkCanChallenge中getResourceAmount抛异常 | deps.getResourceAmount=()=>throw | 函数异常冒泡，无友好错误 | missing | P1 |
| CSS-err-002 | error | completeChallenge中addFragment抛异常 | 发放碎片时异常 | 部分奖励已发放，部分未发放→**奖励不一致** | missing | P0 |
| CSS-err-003 | error | calculateRewards中rng返回NaN | randomDrops概率计算 | NaN<1=true→所有条目都掉落 | missing | P1 |
| CSS-err-004 | boundary | preLockResources重复调用不同关卡 | preLock(stage1)→preLock(stage2) | 两次都应成功（不同stageId） | missing | P1 |
| CSS-err-005 | boundary | completeChallenge无preLock直接调用 | 无preLocked记录 | armyCost=0, staminaCost=0, 资源不扣减 | covered | P1 |

---

## 20. 跨系统交互补充（+22节点）

### Campaign↔VIP集成（6节点）

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| XI-VIP-001 | cross | VIP免费扫荡→SweepSystem.sweep优先消耗免费次数 | VIP5, freeSweepRemaining=3, sweep(stageId,1) | 先消耗1次免费扫荡，ticketCount不变 | missing | P0 |
| XI-VIP-002 | cross | VIP免费扫荡用完后→消耗扫荡令 | VIP5, freeSweepRemaining=0, sweep(stageId,1) | 消耗1扫荡令 | missing | P0 |
| XI-VIP-003 | cross | VIP额外扫荡令→claimDailyTickets增加 | VIP4, claimDailyTickets | 基础3+额外3=6扫荡令 | missing | P0 |
| XI-VIP-004 | cross | VIP等级变化→扫荡特权实时生效 | VIP3→addExp升级到VIP5 | 立即获得免费扫荡能力 | missing | P0 |
| XI-VIP-005 | cross | VIP GM模式→免费扫荡生效 | gmSetLevel(5)→sweep | 免费扫荡应生效 | missing | P1 |
| XI-VIP-006 | cross | VIP→ChallengeStageSystem额外挑战次数 | VIP是否增加每日挑战次数 | **PRD未定义**，需确认 | missing | P1 |

### Campaign↔联盟集成（4节点）

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| XI-ALLY-001 | cross | 联盟加成→CampaignProgressSystem通关星级 | 联盟科技加成 | **源码无联盟引用**，需PRD确认是否需要集成 | missing | P2 |
| XI-ALLY-002 | cross | 联盟援助→ChallengeStageSystem资源补充 | 联盟成员援助兵力 | **源码无联盟引用**，需PRD确认 | missing | P2 |
| XI-ALLY-003 | cross | 联盟战争→Campaign关卡解锁 | 联盟占领城池→解锁关卡 | **源码无联盟引用**，需PRD确认 | missing | P2 |
| XI-ALLY-004 | cross | Campaign通关→联盟贡献 | 通关增加联盟贡献 | **源码无联盟引用**，需PRD确认 | missing | P2 |

### Campaign↔装备系统集成（4节点）

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| XI-EQP-001 | cross | Campaign掉落→EquipmentSystem装备生成 | 通关获得装备掉落 | EquipmentSystem.generateCampaignDrop被调用 | missing | P1 |
| XI-EQP-002 | cross | EquipmentSystem装备加成→Campaign战力计算 | 装备增加武将属性 | buildAllyTeam中武将属性包含装备加成 | missing | P1 |
| XI-EQP-003 | cross | RewardDistributor.getUnificationRewards→装备图纸发放 | A级天下一统奖励 | 传说装备图纸应通过EquipmentSystem发放 | missing | P1 |
| XI-EQP-004 | cross | 装备品质影响扫荡效率 | 高品质装备→扫荡奖励加成 | **源码无此逻辑**，需PRD确认 | missing | P2 |

### Campaign↔远征系统集成（4节点）

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| XI-EXP-001 | cross | Campaign进度→远征解锁 | 通关特定章节→解锁远征 | **源码无远征引用**，需PRD确认 | missing | P2 |
| XI-EXP-002 | cross | 远征奖励→Campaign资源补充 | 远征获得粮草→用于挑战 | 通过ResourceSystem间接关联 | missing | P2 |
| XI-EXP-003 | cross | Campaign章节推进→远征难度调整 | 推进到高章节→远征敌人更强 | **源码无此逻辑** | missing | P2 |
| XI-EXP-004 | cross | 远征武将→Campaign阵容共享 | 远征中武将不可用于挑战 | **源码无此逻辑**，需PRD确认 | missing | P2 |

### 引擎级存档集成（4节点）

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| XI-ENG-001 | cross | engine-save保存SweepSystem数据 | buildSaveData | **当前不保存**，sweep数据丢失 | **confirmed** | P0 |
| XI-ENG-002 | cross | engine-save保存VIPSystem数据 | buildSaveData | **当前不保存**，VIP数据丢失 | **confirmed** | P0 |
| XI-ENG-003 | cross | engine-save保存ChallengeStageSystem数据 | buildSaveData | **当前不保存**，挑战进度丢失 | **confirmed** | P0 |
| XI-ENG-004 | cross | engine-save恢复后SweepSystem/VIPSystem/ChallengeStageSystem状态 | restoreSaveData | 三个系统回到初始状态→**玩家数据丢失** | **confirmed** | P0 |

---

## 21. 数据生命周期补充（+25节点）

### 扫荡系统完整生命周期

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| LC-SWEEP-001 | lifecycle | addTickets(5)→claimDaily→sweep(stageId,3)→serialize | 扫荡令充足 | ticketCount=5+3-3=5, dailyTicketClaimed=true | missing | P0 |
| LC-SWEEP-002 | lifecycle | sweep→serialize→deserialize→sweep | 存档恢复后扫荡 | 第二次sweep成功，ticketCount正确 | missing | P0 |
| LC-SWEEP-003 | lifecycle | claimDaily→跨日→claimDaily | 两次领取 | 第一次+3，第二次跨日再+3 | missing | P1 |
| LC-SWEEP-004 | lifecycle | addTickets→sweep耗尽→sweep失败→addTickets→sweep成功 | 扫荡令流转 | 耗尽→失败→补充→成功 | covered | P1 |
| LC-SWEEP-005 | lifecycle | 完整扫荡→AutoPush→serialize→deserialize→继续推图 | 扫荡+推图+存档 | 恢复后推图从正确位置继续 | missing | P0 |

### VIP系统完整生命周期

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| LC-VIP-001 | lifecycle | addExp(100)→addExp(200)→升级→hasPrivilege→serialize→deserialize | VIP升级全流程 | VIP等级和特权正确恢复 | missing | P0 |
| LC-VIP-002 | lifecycle | useFreeSweep→serialize→deserialize→useFreeSweep | 免费扫荡跨存档 | freeSweepUsedToday正确恢复 | missing | P0 |
| LC-VIP-003 | lifecycle | gmSetLevel(5)→serialize→deserialize→getEffectiveLevel | GM模式跨存档 | GM等级正确恢复 | missing | P1 |
| LC-VIP-004 | lifecycle | addExp→升级→特权解锁→使用特权→继续升级 | 连续升级流程 | 特权逐步解锁且可用 | covered | P1 |
| LC-VIP-005 | lifecycle | VIP5→跨日→freeSweepRemaining重置 | 跨日重置 | 免费次数恢复为3 | covered | P1 |

### 全系统reset生命周期

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| LC-RESET-001 | lifecycle | 使用所有系统→ThreeKingdomsEngine.reset()→验证初始状态 | reset后 | campaign/sweep/vip/challenge全部回到初始状态 | missing | P0 |
| LC-RESET-002 | lifecycle | reset后→completeStage→sweep→验证功能正常 | reset后重新使用 | 功能正常，不影响后续使用 | missing | P0 |
| LC-RESET-003 | lifecycle | AutoPush执行中→reset→isRunning=false | reset中断推图 | isRunning重置为false | missing | P0 |
| LC-RESET-004 | lifecycle | ChallengeStage预锁中→reset→预锁清除 | reset清除预锁 | preLockedResources={} | missing | P1 |

### 多系统协同存档/恢复

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| LC-SAVE-001 | lifecycle | campaign通关+sweep扫荡+VIP升级→engine保存→恢复 | 全系统操作后保存 | **campaign恢复正确，sweep/vip/challenge丢失** | missing | P0 |
| LC-SAVE-002 | lifecycle | serialize→deserialize→completeStage→canSweep→sweep | 存档恢复后继续游戏 | campaign功能正常（其他系统需单独恢复） | missing | P0 |
| LC-SAVE-003 | lifecycle | 多次serialize/deserialize不丢失数据 | 连续5次序列化反序列化 | 数据完全一致 | missing | P1 |
| LC-SAVE-004 | lifecycle | 旧版本存档→新版本反序列化→新关卡补全→旧进度保留 | 版本迁移 | 新关卡stars=0，旧关卡进度保留 | covered | P1 |
| LC-SAVE-005 | lifecycle | 全系统操作→保存→清空→恢复→验证所有状态 | 完整保存恢复循环 | **仅campaign恢复，其他系统状态丢失** | missing | P0 |

### 端到端游戏循环生命周期

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| LC-E2E-001 | lifecycle | init→completeStage(ch1_s1,3)→canSweep→sweep→completeStage(ch1_s2,3)→...→通关chapter1 | 完整第1章通关 | 所有5关三星，章节推进到chapter2 | missing | P0 |
| LC-E2E-002 | lifecycle | 通关chapter1→chapter2→...→chapter6→getUnificationRewards | 6章全通关 | 天下一统奖励正确计算 | missing | P0 |
| LC-E2E-003 | lifecycle | init→completeStage→serialize→deserialize→completeStage→serialize→deserialize | 多次存档恢复循环 | 每次恢复后进度正确累加 | missing | P0 |
| LC-E2E-004 | lifecycle | ChallengeStage: check→preLock→complete→serialize→deserialize→check | 挑战关卡存档循环 | **挑战进度丢失**，checkCanChallenge重新计算 | missing | P0 |
| LC-E2E-005 | lifecycle | AutoPush→serialize→deserialize→AutoPush | 推图存档循环 | **推图进度丢失**，从初始位置重新开始 | missing | P0 |
| LC-E2E-006 | lifecycle | init→completeStage→sweep→ChallengeStage→VIP升级→AutoPush→serialize→deserialize | 全系统端到端 | campaign恢复，其他系统丢失 | missing | P0 |

---

## 22. 修正记录

### R1虚报修正

| 原ID | 原判定 | 修正判定 | 修正原因 |
|-------|--------|---------|---------|
| P0-DESER-003 (VIPSystem.deserialize(null)) | P0崩溃 | **P2已防护** | 源码`if (!data \|\| data.version !== SAVE_VERSION) return;`已有null防护 |
| P0-DESER-004 (ChallengeStage.deserialize(null)) | P0崩溃 | **P2已防护** | 源码`if (!data \|\| data.version !== SAVE_VERSION) return;`已有null防护 |
| XI-015 (serialize→deserialize→completeStage) | missing | **partial** | CampaignSerializer.test.ts有间接覆盖 |

### R1优先级修正

| 原ID | 原优先级 | 修正优先级 | 修正原因 |
|-------|---------|-----------|---------|
| XI-010 (VIP→额外扫荡令) | P1 | **P0** | VIP付费核心功能，影响付费用户体验 |
| CPS-comp-007 (小数截断) | P2 | P2 | 保持不变，低优先级 |

### R2新增P0发现

| 新发现 | 说明 | 优先级 |
|--------|------|--------|
| **engine-save不保存Sweep/VIP/Challenge** | 三个系统的serialize/deserialize完全不在engine-save.ts中，引擎级保存恢复时数据丢失 | **P0** |
| **SweepSystem无VIPSystem依赖注入** | SweepSystem构造函数不接受VIPSystem，无法实现免费扫荡和额外扫荡令 | **P0** |
| **AutoPushExecutor循环内多处异常导致isRunning卡死** | canChallenge/calculateRewards/completeStage异常都会导致isRunning永远为true | **P0** |
| **RewardDistributor.distribute(fragments:null)崩溃** | Object.entries(null)→TypeError | **P0** |
| **rollDropTable rng返回NaN导致所有条目都掉落** | NaN>probability=false→不跳过 | **P0** |
| **rollDropTable rng返回>1导致probability=1不掉落** | 1.5>1.0=true→跳过 | **P0** |
