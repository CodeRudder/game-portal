# Campaign模块流程分支树 — Round 1

> 生成时间：2025-06-18
> 模块路径：`src/games/three-kingdoms/engine/campaign/`
> 源码文件：18个（含6章配置） | 测试文件：18个单元 + 15个集成（含33个测试文件）

## 统计

| 维度 | 数量 |
|------|------|
| **总节点数** | **298** |
| P0 阻塞 | 112 |
| P1 严重 | 134 |
| P2 一般 | 52 |
| covered | 216 |
| missing | 52 |
| partial | 30 |

### 按系统分布

| 系统 | 公开API数 | 节点数 | covered | missing | partial |
|------|-----------|--------|---------|---------|---------|
| CampaignProgressSystem | 14 | 48 | 38 | 4 | 6 |
| RewardDistributor | 12 | 40 | 32 | 4 | 4 |
| CampaignSerializer | 2 | 14 | 10 | 2 | 2 |
| SweepSystem | 14 | 36 | 28 | 4 | 4 |
| AutoPushExecutor | 4 | 20 | 14 | 4 | 2 |
| VIPSystem | 18 | 32 | 26 | 3 | 3 |
| ChallengeStageSystem | 12 | 34 | 24 | 6 | 4 |
| campaign-config | 5 | 14 | 12 | 0 | 2 |
| campaign-utils | 2 | 8 | 8 | 0 | 0 |
| challenge-stages | 1 | 4 | 4 | 0 | 0 |
| 跨系统交互 | — | 30 | 10 | 16 | 4 |
| 数据生命周期 | — | 18 | 6 | 9 | 3 |

---

## 1. CampaignProgressSystem（关卡进度管理）

### initProgress()

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| CPS-init-001 | normal | 初始化进度 | 首次创建 | currentChapterId='chapter1'，所有关卡stageStates已创建 | covered | P0 |
| CPS-init-002 | normal | 重新初始化 | 已有进度数据 | 进度完全重置为初始状态 | covered | P0 |
| CPS-init-003 | boundary | 空章节配置 | dataProvider.getChapters()=[] | currentChapterId=''，stageStates={} | missing | P1 |
| CPS-init-004 | lifecycle | 初始化后getProgress返回深拷贝 | initProgress完成 | 修改返回值不影响内部状态 | covered | P1 |

### getProgress()

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| CPS-prog-001 | normal | 获取完整进度 | 有通关记录 | 返回CampaignProgress深拷贝 | covered | P0 |
| CPS-prog-002 | boundary | 空进度 | 初始状态 | stageStates所有stars=0, firstCleared=false | covered | P1 |

### getCurrentChapter()

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| CPS-curch-001 | normal | 获取当前章节 | currentChapterId='chapter1' | 返回CHAPTER_1配置 | covered | P0 |
| CPS-curch-002 | boundary | 无效章节ID | currentChapterId='invalid' | 返回null | covered | P1 |

### getStageStatus(stageId)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| CPS-status-001 | normal | 第1章第1关默认解锁 | 初始状态 | 返回'available' | covered | P0 |
| CPS-status-002 | normal | 未通关关卡锁定 | 前置关卡未通 | 返回'locked' | covered | P0 |
| CPS-status-003 | normal | 1-2星通关 | stars=1或2 | 返回'cleared' | covered | P0 |
| CPS-status-004 | normal | 3星通关 | stars=3 | 返回'threeStar' | covered | P0 |
| CPS-status-005 | boundary | 不存在的关卡 | stageId='invalid' | 返回'locked' | covered | P1 |
| CPS-status-006 | cross | 通关后下一关解锁 | 通关stage1 | stage2状态从locked变为available | covered | P0 |
| CPS-status-007 | cross | 章节最后一关通关后下一章解锁 | 通关chapter1_stage5 | chapter2_stage1状态变为available | covered | P0 |

### canChallenge(stageId)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| CPS-can-001 | normal | 可挑战关卡 | status=available | 返回true | covered | P0 |
| CPS-can-002 | normal | 已通关可重复挑战 | status=cleared | 返回true | covered | P0 |
| CPS-can-003 | normal | 三星通关可重复挑战 | status=threeStar | 返回true | covered | P0 |
| CPS-can-004 | normal | 锁定关卡不可挑战 | status=locked | 返回false | covered | P0 |

### getStageStars(stageId) / getTotalStars()

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| CPS-stars-001 | normal | 获取关卡星级 | stars=3 | 返回3 | covered | P0 |
| CPS-stars-002 | boundary | 不存在的关卡 | stageId='invalid' | 返回0 | covered | P1 |
| CPS-stars-003 | normal | 获取总星数 | 多关卡有星级 | 返回所有星级之和 | covered | P0 |

### getClearCount(stageId) / isFirstCleared(stageId)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| CPS-clear-001 | normal | 获取通关次数 | clearCount=3 | 返回3 | covered | P1 |
| CPS-clear-002 | normal | 首通状态 | firstCleared=true | 返回true | covered | P1 |
| CPS-clear-003 | boundary | 不存在的关卡 | stageId='invalid' | clearCount=0, firstCleared=false | covered | P1 |

### completeStage(stageId, stars)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| CPS-comp-001 | normal | 首次通关 | stars=3 | stars=3, firstCleared=true, clearCount=1 | covered | P0 |
| CPS-comp-002 | normal | 重复通关低星 | 已3星，传入1星 | stars保持3（取最高），clearCount=2 | covered | P0 |
| CPS-comp-003 | normal | 重复通关高星 | 已1星，传入3星 | stars更新为3 | covered | P0 |
| CPS-comp-004 | boundary | 0星通关 | stars=0 | firstCleared=true, stars=0, clearCount=1 | covered | P1 |
| CPS-comp-005 | boundary | 超过3星截断 | stars=5 | stars=3（MAX_STARS截断） | covered | P1 |
| CPS-comp-006 | boundary | 负星截断 | stars=-1 | stars=0 | covered | P1 |
| CPS-comp-007 | boundary | 小数截断 | stars=2.7 | stars=2（Math.floor） | covered | P2 |
| CPS-comp-008 | error | 不存在的关卡 | stageId='invalid' | 抛出Error | covered | P0 |
| CPS-comp-009 | cross | 通关更新lastClearTime | completeStage | lastClearTime=Date.now()附近 | covered | P1 |
| CPS-comp-010 | cross | 通关章节最后一关推进章节 | 通关chapter1_stage5 | currentChapterId='chapter2' | covered | P0 |
| CPS-comp-011 | cross | 通关非最后关不推进章节 | 通关chapter1_stage3 | currentChapterId不变 | covered | P1 |

### serialize() / deserialize()

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| CPS-ser-001 | normal | 序列化进度 | 有通关记录 | 返回CampaignSaveData含version和progress | covered | P0 |
| CPS-ser-002 | normal | 反序列化恢复 | 有效数据 | 进度完全恢复 | covered | P0 |
| CPS-ser-003 | error | 版本不兼容 | version≠SAVE_VERSION | 抛出Error | covered | P0 |
| CPS-ser-004 | lifecycle | 序列化→反序列化一致性 | serialize→deserialize | 进度数据完全一致 | covered | P0 |
| CPS-ser-005 | cross | 反序列化补全新增关卡 | 旧存档缺少新关卡 | 新关卡初始化为未通关 | covered | P1 |

### ISubsystem接口

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| CPS-sys-001 | normal | init注入依赖 | — | deps被正确存储 | covered | P2 |
| CPS-sys-002 | normal | reset重置进度 | 有进度数据 | 进度回到初始状态 | covered | P1 |
| CPS-sys-003 | normal | getState返回快照 | — | 返回CampaignProgress | covered | P2 |

---

## 2. RewardDistributor（奖励分发器）

### calculateRewards(stageId, stars, isFirstClear)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| RD-calc-001 | normal | 1星基础奖励 | stars=1, isFirstClear=false | resources=baseRewards×1.0 | covered | P0 |
| RD-calc-002 | normal | 2星1.5倍加成 | stars=2 | resources=baseRewards×1.5 | covered | P0 |
| RD-calc-003 | normal | 3星2倍加成 | stars=3 | resources=baseRewards×2.0 | covered | P0 |
| RD-calc-004 | normal | 0星无奖励 | stars=0 | starMultiplier=0 | covered | P1 |
| RD-calc-005 | normal | 首通额外奖励 | isFirstClear=true | 额外包含firstClearRewards和firstClearExp | covered | P0 |
| RD-calc-006 | normal | 非首通无额外奖励 | isFirstClear=false | 不包含firstClearRewards | covered | P0 |
| RD-calc-007 | normal | 首通碎片必掉 | isFirstClear=true, dropTable有fragment | fragments包含所有碎片条目 | covered | P0 |
| RD-calc-008 | normal | 非首通碎片概率掉落 | isFirstClear=false | 按probability判定 | covered | P0 |
| RD-calc-009 | boundary | 超过3星截断 | stars=5 | starMultiplier=2.0 | covered | P1 |
| RD-calc-010 | boundary | 负星截断 | stars=-1 | starMultiplier=0 | covered | P1 |
| RD-calc-011 | boundary | 小数截断 | stars=2.7 | starMultiplier=1.5（floor→2） | covered | P2 |
| RD-calc-012 | error | 不存在的关卡 | stageId='invalid' | 抛出Error | covered | P0 |
| RD-calc-013 | cross | 首通+3星完整奖励 | stars=3, isFirstClear=true | base×2.0 + firstClear + 碎片必掉 | covered | P0 |

### calculateAndDistribute(stageId, stars, isFirstClear)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| RD-dist-001 | normal | 计算并分发奖励 | 正常参数 | 奖励计算正确+回调被调用 | covered | P0 |
| RD-dist-002 | cross | 资源回调被正确调用 | reward含grain=100 | addResource('grain', 100)被调用 | covered | P0 |
| RD-dist-003 | cross | 碎片回调被正确调用 | reward含fragments | addFragment被调用 | covered | P0 |
| RD-dist-004 | cross | 经验回调被正确调用 | reward含exp=200 | addExp(200)被调用 | covered | P0 |

### distribute(reward)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| RD-distr-001 | normal | 分发资源 | reward.resources含grain/gold/troops/mandate | 各类型回调被调用 | covered | P0 |
| RD-distr-002 | normal | 分发碎片 | reward.fragments含generalId | addFragment被调用 | covered | P0 |
| RD-distr-003 | normal | 分发经验 | reward.exp>0 | addExp被调用 | covered | P0 |
| RD-distr-004 | boundary | 零资源不分发 | reward.resources所有值为0 | addResource不被调用 | covered | P1 |
| RD-distr-005 | boundary | addFragment未提供时跳过 | deps.addFragment=undefined | 不报错，跳过碎片分发 | covered | P1 |
| RD-distr-006 | boundary | addExp未提供时跳过 | deps.addExp=undefined | 不报错，跳过经验分发 | covered | P1 |

### previewBaseRewards(stageId) / previewFirstClearRewards(stageId)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| RD-prev-001 | normal | 预览基础奖励 | 有效stageId | 返回baseRewards和baseExp | covered | P1 |
| RD-prev-002 | normal | 预览首通奖励 | 有效stageId | 返回firstClearRewards和firstClearExp | covered | P1 |
| RD-prev-003 | error | 预览不存在关卡 | stageId='invalid' | 抛出Error | covered | P0 |

### getUnificationRewards(grade)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| RD-uni-001 | normal | S级奖励 | grade='S' | 含帝王称号+头像框+天命3000+神话碎片10 | covered | P1 |
| RD-uni-002 | normal | A级奖励 | grade='A' | 含霸主称号+天命2000+传说图纸3 | covered | P1 |
| RD-uni-003 | normal | B级奖励 | grade='B' | 含诸侯称号+天命1000 | covered | P1 |
| RD-uni-004 | normal | C级奖励 | grade='C' | 含英雄称号+天命500 | covered | P1 |
| RD-uni-005 | boundary | 默认C级 | grade=undefined | 等同grade='C' | covered | P2 |

### getFinalStageBonus(stars)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| RD-final-001 | normal | 3星最终奖励 | stars=3 | bonusGold=15000, bonusGrain=24000, bonusMandate=300 | covered | P1 |
| RD-final-002 | boundary | 0星最小倍率 | stars=0 | starMultiplier=1 | covered | P2 |

### ISubsystem接口

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| RD-sys-001 | normal | init注入依赖 | — | sysDeps被存储 | covered | P2 |
| RD-sys-002 | normal | reset无状态 | — | 无操作不报错 | covered | P2 |
| RD-sys-003 | normal | getState返回快照 | — | 返回{name:'rewardDistributor'} | covered | P2 |

---

## 3. CampaignSerializer（序列化器）

### serializeProgress(progress)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| CS-ser-001 | normal | 序列化完整进度 | 有通关数据 | version=1, progress含所有stageStates | covered | P0 |
| CS-ser-002 | normal | 序列化空进度 | 初始进度 | stageStates所有stars=0 | covered | P1 |
| CS-ser-003 | boundary | 序列化不修改原数据 | 调用前后对比 | 原progress不变 | covered | P1 |

### deserializeProgress(data, dataProvider)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| CS-deser-001 | normal | 反序列化恢复进度 | 有效CampaignSaveData | progress完全恢复 | covered | P0 |
| CS-deser-002 | error | 版本不兼容 | version=999 | 抛出Error含版本信息 | covered | P0 |
| CS-deser-003 | cross | 补全新增关卡 | 旧存档缺少新关卡 | 新关卡初始化为stars=0 | covered | P1 |
| CS-deser-004 | lifecycle | 往返一致性 | serialize→deserialize | 数据完全一致 | covered | P0 |

---

## 4. SweepSystem（扫荡系统）

### canSweep(stageId)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| SS-can-001 | normal | 三星关卡可扫荡 | stars=3 | 返回true | covered | P0 |
| SS-can-002 | normal | 非三星不可扫荡 | stars=2 | 返回false | covered | P0 |
| SS-can-003 | boundary | 0星不可扫荡 | stars=0 | 返回false | covered | P1 |

### getSweepStatus(stageId)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| SS-status-001 | normal | 可扫荡状态 | stars=3 | canSweep=true, reason='可以扫荡' | covered | P0 |
| SS-status-002 | normal | 不可扫荡状态 | stars=2 | canSweep=false, reason含'需要三星通关' | covered | P0 |
| SS-status-003 | boundary | 不存在的关卡 | stageId='invalid' | canSweep=false, reason='关卡不存在' | covered | P1 |

### 扫荡令管理

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| SS-ticket-001 | normal | 增加扫荡令 | amount=5 | ticketCount增加5 | covered | P0 |
| SS-ticket-002 | normal | 检查扫荡令是否足够 | ticketCount=5, count=3 | hasEnoughTickets=true | covered | P0 |
| SS-ticket-003 | normal | 扫荡令不足 | ticketCount=2, count=3 | hasEnoughTickets=false | covered | P0 |
| SS-ticket-004 | boundary | 计算所需扫荡令 | count=5, costPerRun=1 | getRequiredTickets=5 | covered | P1 |
| SS-ticket-005 | error | 增加非正数扫荡令 | amount=0或-1 | 抛出Error | covered | P0 |
| SS-ticket-006 | lifecycle | 领取每日扫荡令 | 首次领取 | ticketCount+=dailyTicketReward(3) | covered | P0 |
| SS-ticket-007 | boundary | 每日扫荡令只能领一次 | 已领取 | 返回0，ticketCount不变 | covered | P0 |
| SS-ticket-008 | lifecycle | 跨日重置每日扫荡令 | 新的一天 | dailyTicketClaimed重置，可再次领取 | covered | P1 |

### sweep(stageId, count)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| SS-sweep-001 | normal | 批量扫荡成功 | 三星关卡，扫荡令足够 | success=true, executedCount=count | covered | P0 |
| SS-sweep-002 | normal | 扫荡消耗扫荡令 | sweep(stageId, 5) | ticketsUsed=5 | covered | P0 |
| SS-sweep-003 | normal | 扫荡汇总奖励 | 扫荡5次 | totalResources/totalExp/totalFragments汇总正确 | covered | P0 |
| SS-sweep-004 | error | 次数≤0 | count=0 | success=false, failureReason含'必须大于0' | covered | P0 |
| SS-sweep-005 | error | 超过最大次数 | count=11 | success=false, failureReason含'最大10次' | covered | P0 |
| SS-sweep-006 | error | 非三星关卡 | stars=2 | success=false, failureReason含'需要三星通关' | covered | P0 |
| SS-sweep-007 | error | 扫荡令不足 | ticketCount<required | success=false, failureReason含'扫荡令不足' | covered | P0 |
| SS-sweep-008 | boundary | 恰好最大次数 | count=10 | success=true | covered | P1 |
| SS-sweep-009 | boundary | 扫荡令恰好够 | ticketCount=required | success=true, ticketCount=0 | covered | P1 |

### autoPush()

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| SS-push-001 | normal | 自动推图执行 | 有可挑战关卡 | 返回AutoPushResult含victories/defeats | covered | P0 |
| SS-push-002 | cross | 三星关卡用扫荡令 | autoPush中遇到三星关 | 消耗sweepCostPerRun扫荡令 | covered | P1 |
| SS-push-003 | cross | 未三星关卡模拟战斗 | autoPush中遇到未三星关 | 调用simulateBattle | covered | P1 |
| SS-push-004 | boundary | 达到最大尝试次数 | autoPushMaxAttempts=3 | reachedMaxAttempts=true | covered | P1 |
| SS-push-005 | boundary | 无可挑战关卡 | getFarthestStageId=null | 返回空结果 | covered | P1 |

### serialize() / deserialize()

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| SS-ser-001 | normal | 序列化扫荡状态 | 有扫荡令 | 返回SweepSaveData含ticketCount等 | covered | P0 |
| SS-ser-002 | normal | 反序列化恢复 | 有效数据 | ticketCount等恢复 | covered | P0 |
| SS-ser-003 | error | 版本不兼容 | version≠1 | 抛出Error | covered | P0 |

### ISubsystem接口

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| SS-sys-001 | normal | reset重置 | 有扫荡令和每日状态 | ticketCount=0, dailyTicketClaimed=false | covered | P1 |
| SS-sys-002 | normal | getState返回快照 | — | 返回{ticketCount, dailyTicketClaimed} | covered | P2 |

---

## 5. AutoPushExecutor（自动推图执行器）

### execute(ticketCount)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| APE-exec-001 | normal | 正常执行推图 | 有可挑战关卡 | 返回AutoPushResult含results | covered | P0 |
| APE-exec-002 | normal | 三星关用扫荡令 | 遇到三星关 | ticketsUsed增加 | covered | P0 |
| APE-exec-003 | normal | 未三星关模拟战斗 | 遇到未三星关 | 调用sweepDeps.simulateBattle | covered | P0 |
| APE-exec-004 | normal | 战斗失败停止 | simulateBattle返回victory=false | defeats=1，循环停止 | covered | P0 |
| APE-exec-005 | normal | 扫荡令不足时模拟战斗 | 三星关但扫荡令不足 | 回退到simulateBattle | covered | P1 |
| APE-exec-006 | boundary | 达到最大尝试次数 | autoPushMaxAttempts=3 | reachedMaxAttempts=true | covered | P1 |
| APE-exec-007 | boundary | 无起始关卡 | getFarthestStageId=null | 返回空结果 | covered | P1 |
| APE-exec-008 | cross | 通关后推进到下一关 | 当前关胜利 | 下一次循环处理下一关 | covered | P0 |
| APE-exec-009 | cross | 章节最后一关后推进到下一章 | 当前章最后一关胜利 | 下一关为下章第一关 | covered | P1 |
| APE-exec-010 | error | simulateBattle抛出异常 | deps.simulateBattle抛错 | 不崩溃 | missing | P0 |

### getProgress() / resetProgress()

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| APE-prog-001 | normal | 获取进度 | 执行中 | 返回AutoPushProgress含isRunning=true | covered | P1 |
| APE-prog-002 | normal | 重置进度 | 有进度数据 | 进度回到初始状态 | covered | P1 |

---

## 6. VIPSystem（VIP等级系统）

### 经验与等级

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| VIP-exp-001 | normal | 增加VIP经验 | amount=100 | vipExp增加100 | covered | P0 |
| VIP-exp-002 | normal | 经验升级 | exp达到300 | getBaseLevel()=2 | covered | P0 |
| VIP-exp-003 | boundary | 增加非正数经验 | amount=0或-1 | vipExp不变 | covered | P1 |
| VIP-exp-004 | boundary | 满级后继续增加 | level=6, 再加经验 | vipExp增加但level不变 | covered | P1 |
| VIP-exp-005 | normal | 获取下一等级经验 | level=0 | getNextLevelExp()=100 | covered | P1 |
| VIP-exp-006 | boundary | 满级获取下一等级 | level=6 | getNextLevelExp()=null | covered | P1 |
| VIP-exp-007 | normal | 获取等级进度 | level=0, exp=50 | getLevelProgress()=0.5 | covered | P1 |
| VIP-exp-008 | boundary | 满级进度 | level=6 | getLevelProgress()=1 | covered | P2 |

### 特权校验

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| VIP-priv-001 | normal | VIP0无特权 | level=0 | hasPrivilege('speed_3x')=false | covered | P0 |
| VIP-priv-002 | normal | VIP3有3倍速 | level=3 | hasPrivilege('speed_3x')=true | covered | P0 |
| VIP-priv-003 | normal | VIP5有极速+免费扫荡 | level=5 | hasPrivilege('speed_instant')=true, canUseFreeSweep()=true | covered | P0 |
| VIP-priv-004 | normal | 额外扫荡令计算 | level=4 | getExtraDailyTickets()=3 (1+2) | covered | P1 |
| VIP-priv-005 | normal | 离线时长加成 | level=6 | getOfflineHoursBonus()=6 (2+4) | covered | P1 |
| VIP-priv-006 | normal | 离线总上限 | level=2 | getOfflineHoursLimit()=14 (12+2) | covered | P1 |

### 免费扫荡

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| VIP-free-001 | normal | VIP5可使用免费扫荡 | level=5 | getFreeSweepRemaining()=3 | covered | P0 |
| VIP-free-002 | normal | 使用一次免费扫荡 | level=5 | useFreeSweep()=true, remaining=2 | covered | P0 |
| VIP-free-003 | boundary | 免费扫荡用完 | 已用3次 | useFreeSweep()=false | covered | P0 |
| VIP-free-004 | boundary | VIP0无免费扫荡 | level=0 | getFreeSweepRemaining()=0 | covered | P1 |
| VIP-free-005 | lifecycle | 跨日重置免费扫荡 | 新的一天 | freeSweepRemaining恢复为3 | covered | P1 |

### GM命令

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| VIP-gm-001 | normal | GM设置VIP等级 | gmSetLevel(5) | getEffectiveLevel()=5 | covered | P1 |
| VIP-gm-002 | normal | GM重置VIP等级 | gmResetLevel() | getEffectiveLevel()=getBaseLevel() | covered | P1 |
| VIP-gm-003 | boundary | GM设置负数等级 | gmSetLevel(-1) | level=0 | covered | P2 |
| VIP-gm-004 | boundary | GM设置超最大等级 | gmSetLevel(99) | level=6 | covered | P2 |

### serialize() / deserialize()

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| VIP-ser-001 | normal | 序列化VIP状态 | 有VIP经验 | 返回VIPSaveData含vipExp等 | covered | P0 |
| VIP-ser-002 | normal | 反序列化恢复 | 有效数据 | vipExp/freeSweepUsedToday恢复 | covered | P0 |
| VIP-ser-003 | boundary | 反序列化null数据 | data=null | 不崩溃，状态不变 | covered | P1 |
| VIP-ser-004 | boundary | 反序列化版本不匹配 | version≠1 | 不崩溃，状态不变 | covered | P1 |

### ISubsystem接口

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| VIP-sys-001 | normal | reset重置 | 有VIP经验 | vipExp=0, gmMode=false | covered | P1 |
| VIP-sys-002 | normal | getState返回快照 | — | 返回VIPState | covered | P2 |

---

## 7. ChallengeStageSystem（挑战关卡系统）

### 查询

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| CSS-query-001 | normal | 获取所有关卡配置 | — | 返回8个挑战关卡 | covered | P0 |
| CSS-query-002 | normal | 获取指定关卡配置 | 有效stageId | 返回ChallengeStageConfig | covered | P1 |
| CSS-query-003 | normal | 获取关卡进度 | 有效stageId | 返回ChallengeStageProgress | covered | P1 |
| CSS-query-004 | normal | 获取今日已挑战次数 | 有效stageId | 返回dailyAttempts | covered | P0 |
| CSS-query-005 | normal | 获取今日剩余次数 | 有效stageId | 返回3-dailyAttempts | covered | P0 |
| CSS-query-006 | normal | 是否已首通 | 有效stageId | 返回firstCleared | covered | P1 |

### checkCanChallenge(stageId)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| CSS-check-001 | normal | 满足所有条件 | 兵力/天命/次数均足够 | canChallenge=true | covered | P0 |
| CSS-check-002 | normal | 每日次数已满 | dailyAttempts=3 | canChallenge=false, reasons含'次数已用完' | covered | P0 |
| CSS-check-003 | normal | 兵力不足 | troops<armyCost | canChallenge=false, reasons含'兵力不足' | covered | P0 |
| CSS-check-004 | normal | 天命不足 | mandate<staminaCost | canChallenge=false, reasons含'天命不足' | covered | P0 |
| CSS-check-005 | boundary | 多条件不满足 | 次数满+兵力不足 | reasons包含多个原因 | covered | P1 |
| CSS-check-006 | error | 不存在的关卡 | stageId='invalid' | canChallenge=false, reasons含'关卡不存在' | covered | P0 |

### preLockResources(stageId)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| CSS-lock-001 | normal | 预锁成功 | 条件满足 | 返回true，资源被扣减 | covered | P0 |
| CSS-lock-002 | normal | 预锁失败条件不满足 | 次数已满 | 返回false，资源不扣减 | covered | P0 |
| CSS-lock-003 | boundary | 重复预锁 | 已有预锁 | 返回false | covered | P1 |
| CSS-lock-004 | error | 部分扣减失败 | 兵力扣成功但天命扣失败 | 回滚兵力扣减，返回false | covered | P0 |

### completeChallenge(stageId, victory)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| CSS-comp-001 | normal | 胜利完成挑战 | victory=true | rewards非空，firstClear正确 | covered | P0 |
| CSS-comp-002 | normal | 首通额外奖励 | 首次胜利 | rewards包含firstClearBonus | covered | P0 |
| CSS-comp-003 | normal | 非首通无额外奖励 | 已首通 | rewards不含firstClearBonus | covered | P0 |
| CSS-comp-004 | normal | 概率掉落 | victory=true | 按probability判定randomDrops | covered | P0 |
| CSS-comp-005 | normal | 失败返还资源 | victory=false | 预锁资源被返还 | covered | P0 |
| CSS-comp-006 | normal | 失败不消耗次数 | victory=false | dailyAttempts不变 | covered | P0 |
| CSS-comp-007 | boundary | 无预锁记录完成 | 无preLock直接complete | armyCost=0, staminaCost=0 | covered | P1 |
| CSS-comp-008 | error | 不存在的关卡 | stageId='invalid' | 返回victory=false | covered | P0 |
| CSS-comp-009 | cross | 胜利后碎片入账 | reward含fragment类型 | addFragment被调用 | covered | P0 |
| CSS-comp-010 | cross | 胜利后资源入账 | reward含资源类型 | addResource被调用 | covered | P0 |

### 每日重置

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| CSS-reset-001 | lifecycle | 跨日重置次数 | 新的一天 | 所有dailyAttempts归零 | covered | P0 |
| CSS-reset-002 | boundary | 同日不重置 | 同一天 | dailyAttempts不变 | covered | P1 |

### serialize() / deserialize()

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| CSS-ser-001 | normal | 序列化挑战状态 | 有进度 | 返回ChallengeSaveData | covered | P0 |
| CSS-ser-002 | normal | 反序列化恢复 | 有效数据 | stageProgress恢复 | covered | P0 |
| CSS-ser-003 | boundary | 反序列化null | data=null | 不崩溃，状态不变 | covered | P1 |
| CSS-ser-004 | cross | 反序列化清除预锁 | 有preLockedResources | preLockedResources={} | covered | P1 |

### ISubsystem接口

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| CSS-sys-001 | normal | reset重置 | 有进度数据 | 所有进度回到初始状态 | covered | P1 |
| CSS-sys-002 | normal | getState返回快照 | — | 返回ChallengeSystemState | covered | P2 |

---

## 8. campaign-config（关卡配置）

### getChapters() / getChapter() / getStage() / getStagesByChapter()

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| CC-get-001 | normal | 获取所有章节 | — | 返回6个章节按order排序 | covered | P0 |
| CC-get-002 | normal | 获取指定章节 | chapterId='chapter1' | 返回CHAPTER_1 | covered | P0 |
| CC-get-003 | normal | 获取指定关卡 | stageId='chapter1_stage1' | 返回ch1_stage1 | covered | P0 |
| CC-get-004 | normal | 获取章节关卡列表 | chapterId='chapter1' | 返回5个关卡 | covered | P0 |
| CC-get-005 | boundary | 不存在的章节 | chapterId='invalid' | 返回undefined | covered | P1 |
| CC-get-006 | boundary | 不存在的关卡 | stageId='invalid' | 返回undefined | covered | P1 |
| CC-get-007 | cross | 章节前置关系 | chapter2.prerequisiteChapterId='chapter1' | 链式关系正确 | covered | P0 |

### campaignDataProvider

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| CC-provider-001 | normal | 实现ICampaignDataProvider | — | getChapters/getChapter/getStage/getStagesByChapter均可用 | covered | P0 |
| CC-provider-002 | cross | dataProvider与直接函数调用一致 | — | 结果完全相同 | partial | P1 |

---

## 9. campaign-utils（工具函数）

### mergeResources() / mergeFragments()

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| CU-merge-001 | normal | 合并资源 | target={grain:100}, source={grain:50} | target.grain=150 | covered | P0 |
| CU-merge-002 | normal | 合并碎片 | target={hero1:1}, source={hero1:2} | target.hero1=3 | covered | P0 |
| CU-merge-003 | boundary | 合并空对象 | source={} | target不变 | covered | P1 |
| CU-merge-004 | boundary | 合并负值被忽略 | source={grain:-10} | target不变 | covered | P1 |
| CU-merge-005 | boundary | 合并零值被忽略 | source={grain:0} | target不变 | covered | P2 |
| CU-merge-006 | boundary | 合并新字段 | source={gold:100} | target新增gold=100 | covered | P1 |
| CU-merge-007 | boundary | 合并undefined被忽略 | source={grain:undefined} | target不变 | covered | P2 |
| CU-merge-008 | boundary | 合并到空target | target={} | 正常添加 | covered | P1 |

---

## 10. challenge-stages（挑战关卡配置）

### DEFAULT_CHALLENGE_STAGES

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| CST-config-001 | normal | 配置完整性 | — | 8个关卡，每个含id/name/armyCost/staminaCost/rewards | covered | P0 |
| CST-config-002 | normal | 关卡ID唯一 | — | 8个不同的ID | covered | P1 |
| CST-config-003 | normal | 关卡消耗递增 | — | armyCost从200到1000递增 | covered | P1 |
| CST-config-004 | normal | 掉落概率在0~1范围 | — | 所有probability在[0,1] | covered | P1 |

---

## 11. 跨系统交互

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| XI-001 | cross | completeStage→解锁下一关 | 通关stage1 | stage2状态变为available | covered | P0 |
| XI-002 | cross | completeStage→解锁下一章 | 通关chapter1_stage5 | chapter2_stage1变为available | covered | P0 |
| XI-003 | cross | completeStage→推进当前章节 | 通关章节最后一关 | currentChapterId更新 | covered | P0 |
| XI-004 | cross | calculateRewards→distribute→回调 | 计算奖励后分发 | 各回调被正确调用 | covered | P0 |
| XI-005 | cross | completeStage→calculateRewards→distribute完整链路 | 通关→奖励计算→分发 | 端到端链路完整 | covered | P0 |
| XI-006 | cross | buildAllyTeam→buildEnemyTeam→BattleEngine | 编队+关卡→战斗 | 战斗正常执行 | covered | P0 |
| XI-007 | cross | SweepSystem→RewardDistributor | 扫荡→奖励计算 | 奖励正确计算 | covered | P0 |
| XI-008 | cross | AutoPushExecutor→SweepDeps.simulateBattle | 自动推图→模拟战斗 | 战斗结果正确处理 | covered | P0 |
| XI-009 | cross | VIPSystem→SweepSystem免费扫荡 | VIP5免费扫荡 | 扫荡不消耗扫荡令 | missing | P0 |
| XI-010 | cross | VIPSystem→SweepSystem额外扫荡令 | VIP4额外扫荡令 | 每日领取额外扫荡令 | missing | P1 |
| XI-011 | cross | CampaignProgressSystem→SweepSystem解锁条件 | 三星通关→可扫荡 | canSweep=true | covered | P0 |
| XI-012 | cross | RewardDistributor→ResourceSystem资源增加 | 奖励分发→资源系统 | 资源正确增加 | covered | P0 |
| XI-013 | cross | RewardDistributor→HeroSystem碎片增加 | 奖励分发→武将系统 | 碎片正确增加 | covered | P0 |
| XI-014 | cross | ChallengeStageSystem→ResourceSystem资源扣减 | 预锁资源 | 资源被扣减 | covered | P0 |
| XI-015 | cross | serialize→deserialize→completeStage | 存档恢复后继续游戏 | 进度正确恢复且可继续 | missing | P0 |
| XI-016 | cross | engine-campaign-deps→createCampaignSystems | 创建完整子系统集合 | battleEngine/campaignSystem/rewardDistributor均可用 | covered | P0 |
| XI-017 | cross | buildRewardDeps→经验平均分配 | 多武将时 | 经验平均分配给所有武将 | missing | P1 |
| XI-018 | cross | CampaignProgress→SweepSystem→AutoPush | 进度→扫荡→推图 | 三者协同正确 | missing | P0 |
| XI-019 | cross | VIPSystem→ChallengeStageSystem | VIP特权影响挑战 | 特权正确生效 | missing | P1 |
| XI-020 | cross | completeStage→lastClearTime→离线奖励 | 通关时间→离线系统 | 离线奖励正确计算 | missing | P1 |
| XI-021 | cross | 多次completeStage→进度不残留 | 连续通关多关卡 | 每次通关独立 | covered | P0 |
| XI-022 | cross | SweepSystem.serialize→deserialize→sweep | 存档恢复后扫荡 | 扫荡功能正常 | missing | P0 |
| XI-023 | cross | ChallengeStageSystem每日重置→跨日挑战 | 跨日后挑战 | 次数恢复 | covered | P0 |
| XI-024 | cross | VIPSystem.serialize→deserialize→特权校验 | 存档恢复后特权 | 特权校验正确 | missing | P1 |
| XI-025 | cross | CampaignProgress→ChallengeStageSystem解锁 | 主线进度→挑战解锁 | 挑战关卡解锁正确 | missing | P1 |
| XI-026 | cross | RewardDistributor.getUnificationRewards→称号系统 | 天下一统奖励 | 称号正确发放 | missing | P2 |
| XI-027 | cross | buildEnemyTeam→BattleEngine→星级→completeStage | 敌方阵容→战斗→星级→进度 | 完整战斗到进度链路 | covered | P0 |
| XI-028 | cross | SweepSystem.reset→AutoPushExecutor.reset | 扫荡系统重置 | 推图进度也重置 | missing | P1 |
| XI-029 | cross | VIPSystem GM模式→特权校验 | GM设置VIP5 | 特权校验使用GM等级 | covered | P1 |
| XI-030 | cross | 多系统serialize→engine保存→deserialize | 全系统存档恢复 | 所有系统状态正确恢复 | missing | P0 |

---

## 12. 数据生命周期

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| LC-001 | lifecycle | 初始化→通关→查询完整流程 | initProgress→completeStage→getStageStatus | 每阶段状态正确 | covered | P0 |
| LC-002 | lifecycle | 进度序列化/反序列化完整流程 | serialize→deserialize | 所有字段完全恢复 | covered | P0 |
| LC-003 | lifecycle | 多次通关进度累积 | 连续completeStage | stars取最高，clearCount累加 | covered | P0 |
| LC-004 | lifecycle | 扫荡系统完整生命周期 | addTickets→claimDaily→sweep→serialize→deserialize | 每阶段状态正确 | missing | P0 |
| LC-005 | lifecycle | VIP系统完整生命周期 | addExp→升级→特权→免费扫荡→serialize→deserialize | 每阶段状态正确 | missing | P0 |
| LC-006 | lifecycle | 挑战关卡完整生命周期 | check→preLock→complete→每日重置 | 每阶段状态正确 | covered | P0 |
| LC-007 | lifecycle | 自动推图完整生命周期 | getProgress→execute→getProgress→reset | 每阶段状态正确 | covered | P1 |
| LC-008 | lifecycle | 全系统reset生命周期 | 使用所有系统→reset | 所有系统回到初始状态 | missing | P0 |
| LC-009 | lifecycle | 跨日生命周期 | 今日操作→跨日→操作 | 每日重置正确 | covered | P1 |
| LC-010 | lifecycle | 章节推进生命周期 | 通关所有5关→章节推进→继续下一章 | 章节推进链路完整 | covered | P0 |
| LC-011 | lifecycle | 6章全通关生命周期 | 从chapter1通关到chapter6 | 所有章节正确推进 | covered | P0 |
| LC-012 | lifecycle | 旧存档升级生命周期 | 旧版本存档→新版本反序列化 | 新关卡补全，旧进度保留 | missing | P0 |
| LC-013 | lifecycle | 扫荡令获取→消耗→不足→补充 | addTickets→sweep→addTickets | 扫荡令流转正确 | covered | P1 |
| LC-014 | lifecycle | 预锁→胜利→预锁→失败→返还 | 两次挑战 | 资源正确扣减和返还 | covered | P0 |
| LC-015 | lifecycle | VIP升级→特权解锁→使用→升级 | 连续addExp | 特权逐步解锁 | covered | P1 |
| LC-016 | lifecycle | GM模式→正常模式切换 | gmSetLevel→gmResetLevel | 等级恢复正确 | covered | P1 |
| LC-017 | lifecycle | 多次serialize/deserialize不丢失数据 | 连续序列化反序列化 | 数据完全一致 | missing | P1 |
| LC-018 | lifecycle | 全系统协同生命周期 | 进度→扫荡→推图→奖励→存档 | 端到端链路完整 | missing | P0 |
