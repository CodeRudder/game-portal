# R1 Challenger — 科技模块挑战报告

> 生成时间: Round 1 | 模块: engine/tech | Challenger Agent

## 总体评估
- 覆盖率评分: 7.2/10
- 发现遗漏数: 28
- P0遗漏: 5, P1遗漏: 18, P2遗漏: 5

---

## 维度分析

### F-Normal 遗漏 (8项)

#### [N-MISS-1] P0: 研究速度加成闭环未覆盖
**遗漏**: 文化路线科技(cul_t2_academy研究速度+15%, cul_t3_scholar研究速度+25%)完成后,需同步到TechPointSystem.syncResearchSpeedBonus(),再影响后续研究时间。Builder的N2.6只提到speedMultiplier公式,未覆盖同步闭环。
**建议**: 测试完成文化科技后,后续研究的actualTime是否正确缩短。

#### [N-MISS-2] P1: TechDetailProvider完全未覆盖
**遗漏**: Builder分支树未包含TechDetailProvider的任何测试。该系统提供科技详情数据(效果展示/前置展示/费用展示/联动展示),是UI层的关键数据源。
**建议**: 测试getTechDetail()返回正确的EffectDisplay/PrerequisiteDisplay/CostDisplay。

#### [N-MISS-3] P1: 融合科技研究流程未覆盖
**遗漏**: N9只覆盖融合科技的前置检查和事件,未覆盖融合科技的实际研究流程(startResearch for fusion)。融合科技的研究是否走TechResearchSystem还是FusionTechSystem的setResearching?
**建议**: 验证融合科技的研究流程: available → researching → completed完整路径。

#### [N-MISS-4] P1: 多级跨路线前置条件(MultiPathPrerequisite)未覆盖
**遗漏**: fusion-tech.types定义了MultiPathPrerequisite和PathPrerequisiteGroup,支持minCompleted语义,但Builder未覆盖此高级前置条件。
**建议**: 测试minCompleted=1时,requiredNodes中只需完成1个即可满足。

#### [N-MISS-5] P1: checkPrerequisitesDetailed详细检查未覆盖
**遗漏**: FusionTechSystem.checkPrerequisitesDetailed()返回每组PathGroupCheckResult,Builder未测试此接口。
**建议**: 测试返回结果包含正确的completedNodes/actualCompleted/met字段。

#### [N-MISS-6] P1: getPathPairProgress路线组合进度未覆盖
**遗漏**: FusionTechSystem.getPathPairProgress()返回total/available/completed/locked统计,Builder未覆盖。
**建议**: 测试指定路线组合的进度统计。

#### [N-MISS-7] P1: 联动系统事件通知(tech:linksChanged)未覆盖
**遗漏**: TechLinkSystem.syncCompletedTechIds()发出tech:linksChanged事件,Builder的N10只覆盖了查询接口。
**建议**: 测试科技完成后联动系统发出事件,携带正确的buildingLinks/heroLinks/resourceLinks计数。

#### [N-MISS-8] P1: TechEffectSystem缓存失效机制未覆盖
**遗漏**: N6.4提到缓存机制但未测试缓存失效场景: 科技完成时invalidateCache()是否被调用? 之后查询是否返回更新后的值?
**建议**: 测试: 完成科技→查询效果→完成新科技→查询效果是否更新。

---

### F-Boundary 遗漏 (6项)

#### [B-MISS-1] P0: 研究进度边界(恰好100%)
**遗漏**: getResearchProgress返回值范围是[0,1],但未测试恰好100%时(Math.min(1, ...))的行为,以及endTime恰好等于now时的完成检测。
**建议**: 测试endTime=now时checkCompleted是否正确触发。

#### [B-MISS-2] P1: 负值效果(闪电战防御-5%)的边界
**遗漏**: B4.3提到负面效果,但未测试负值效果在getEffectValue中的叠加行为。如果其他科技+25%防御,闪电战-5%,结果应为+20%。
**建议**: 测试正负效果叠加后的最终值。

#### [B-MISS-3] P1: 铜钱兑换科技点边界
**遗漏**: 未测试兑换金额为非100整数倍时的行为(如150铜钱→1.5科技点,浮点精度)。
**建议**: 测试goldAmount=150, 验证pointsGained=1.5。

#### [B-MISS-4] P1: 队列中研究完成后的连续处理
**遗漏**: checkCompleted从后向前遍历队列(for i = length-1 → 0),但未测试队列中多个科技同时完成的情况。
**建议**: 测试队列中2个科技endTime都已过,是否都正确完成。

#### [B-MISS-5] P1: 书院等级为0时的科技点产出
**遗漏**: B1覆盖了科技点为0,但未测试academyLevel=0时update(dt)是否不产出科技点。
**建议**: 测试syncAcademyLevel(0)后, update(1000)不增加科技点。

#### [B-MISS-6] P2: 效果乘数下溢(防御-5%导致乘数<1)
**遗漏**: 闪电战防御-5%,乘数=0.95,但未测试极端情况下乘数是否可能<=0(如多个负面效果叠加)。
**建议**: 测试多个负面效果叠加后乘数是否仍>0。

---

### F-Error 遗漏 (6项)

#### [E-MISS-1] P0: 反序列化包含不存在节点ID时的处理
**遗漏**: E3.5提到空数据,但未测试completedTechIds包含不存在的ID(如"fake_tech")时,deserialize是否安全忽略。
**建议**: 测试deserialize({completedTechIds: ['nonexistent_id'], chosenMutexNodes: {}})不崩溃。

#### [E-MISS-2] P0: setResearching对已完成节点的处理
**遗漏**: setResearching()没有检查节点当前状态,如果对completed节点调用setResearching,会覆盖其状态为researching。
**建议**: 测试对completed节点调用setResearching是否被忽略或拒绝。

#### [E-MISS-3] P1: completeNode对不存在节点的处理
**遗漏**: completeNode()检查了state和def,但Builder未测试传入不存在的ID时的行为。
**建议**: 测试completeNode('nonexistent')不崩溃。

#### [E-MISS-4] P1: 融合科技对null techTree的处理
**遗漏**: FusionTechSystem在setTechTree之前调用arePrerequisitesMet会返回false,但未测试canResearch在techTree=null时的行为。
**建议**: 测试未注入techTree时canResearch返回正确错误。

#### [E-MISS-5] P1: 离线回归时timestamp早于offlineStartTime
**遗漏**: 未测试onComeBackOnline传入的时间戳早于onGoOffline的时间戳(时间回退)。
**建议**: 测试onComeBackOnline(offlineStartTime - 1000)返回null。

#### [E-MISS-6] P1: TechLinkSystem重复注册相同ID的联动效果
**遗漏**: registerLink使用Map.set(),相同ID会覆盖。未测试覆盖后查询结果是否正确。
**建议**: 测试注册相同ID的联动效果,后注册的值覆盖前者。

---

### F-Cross 遗漏 (4项)

#### [C-MISS-1] P0: 科技完成→联动→效果应用完整链路
**遗漏**: Builder的C1-C4分别测试了单向交互,但未覆盖完整链路: 科技完成→TechTreeSystem.completeNode()→TechLinkSystem.syncCompletedTechIds/addCompletedTech→联动效果查询→外部系统获取加成。
**建议**: 端到端测试: 完成eco_t1_farming→查询TechLinkSystem.getBuildingLinkBonus('farm')→验证productionBonus=20。

#### [C-MISS-2] P1: 融合科技完成→联动同步→TechLinkSystem
**遗漏**: C5.2提到联动同步但未测试具体流程: FusionTechSystem.completeFusionNode()→syncFusionLinksToLinkSystem()→TechLinkSystem收到联动效果。
**建议**: 测试融合科技完成后联动系统可查询到对应加成。

#### [C-MISS-3] P1: 研究速度加成→文化科技→后续研究时间缩短
**遗漏**: 文化路线的研究速度加成需要: 完成cul_t2_academy→TechEffectSystem查询research_speed→TechPointSystem.syncResearchSpeedBonus→后续研究时间缩短。此闭环未被覆盖。
**建议**: 完成文化科技→验证新研究的actualTime缩短。

#### [C-MISS-4] P1: composeResourceBonuses与existingBonuses合并
**遗漏**: TechEffectApplier.composeResourceBonuses接受existingBonuses参数(如主城加成),未测试合并逻辑是否保留existingBonuses中的castle/hero等字段。
**建议**: 测试传入existingBonuses={castle: 10, hero: 5}时,返回的Bonuses保留这些值。

---

### F-Lifecycle 遗漏 (4项)

#### [L-MISS-1] P0: 研究中科技序列化后恢复,继续计时
**遗漏**: 序列化时研究队列保存startTime/endTime,反序列化后如果endTime已过,需要触发完成。Builder的L3.1未覆盖此场景。
**建议**: 测试: 开始研究→序列化→等待endTime过→反序列化→update()→科技完成。

#### [L-MISS-2] P1: 互斥选择反序列化后可用性刷新
**遗漏**: deserialize恢复chosenMutexNodes后,refreshAllAvailability是否正确锁定互斥替代节点?
**建议**: 测试反序列化含chosenMutexNodes后,同组其他节点状态为locked。

#### [L-MISS-3] P1: 离线系统序列化/反序列化
**遗漏**: L3.6提到离线快照持久化,但未测试离线中(onGoOffline后)序列化→反序列化→onComeBackOnline的完整流程。
**建议**: 测试离线状态序列化→反序列化→回归计算进度。

#### [L-MISS-4] P2: reset后联动系统状态清理
**遗漏**: TechLinkSystem.reset()只清除completedTechIds,不清除links注册。未测试reset后联动查询是否返回0加成。
**建议**: 测试reset()后getBuildingLinkBonus返回productionBonus=0。

---

## 建议新增的测试用例 (按优先级排序)

### P0 必须新增 (5项)
1. **[N-MISS-1]** 研究速度加成闭环: 完成文化科技→syncResearchSpeedBonus→验证后续研究时间缩短
2. **[B-MISS-1]** 研究进度恰好100%: endTime=Date.now()时checkCompleted触发
3. **[E-MISS-1]** 反序列化不存在节点ID: 安全忽略,不崩溃
4. **[E-MISS-2]** setResearching对已完成节点: 不应覆盖completed状态
5. **[C-MISS-1]** 科技完成→联动→效果完整链路

### P1 建议新增 (18项)
6. **[N-MISS-2]** TechDetailProvider.getTechDetail()
7. **[N-MISS-3]** 融合科技研究流程
8. **[N-MISS-4]** MultiPathPrerequisite.minCompleted语义
9. **[N-MISS-5]** checkPrerequisitesDetailed返回结构
10. **[N-MISS-6]** getPathPairProgress统计
11. **[N-MISS-7]** tech:linksChanged事件
12. **[N-MISS-8]** TechEffectSystem缓存失效
13. **[B-MISS-2]** 负值效果叠加
14. **[B-MISS-3]** 铜钱兑换浮点精度
15. **[B-MISS-4]** 多个科技同时完成
16. **[B-MISS-5]** academyLevel=0时无产出
17. **[E-MISS-3]** completeNode不存在ID
18. **[E-MISS-4]** FusionTechSystem未注入techTree
19. **[E-MISS-5]** 离线回归时间回退
20. **[E-MISS-6]** 联动效果重复注册覆盖
21. **[C-MISS-2]** 融合科技→联动同步
22. **[C-MISS-3]** 研究速度加成闭环
23. **[C-MISS-4]** composeResourceBonuses合并

### P2 建议新增 (5项)
24. **[B-MISS-6]** 效果乘数下溢
25. **[L-MISS-3]** 离线状态序列化往返
26. **[L-MISS-4]** reset后联动清理
27. (冗余覆盖项已合并)

---

## 维度均衡度分析

| 维度 | Builder原始 | Challenger补充 | 补充后总计 | 均衡度 |
|------|------------|---------------|-----------|--------|
| F-Normal | 47 | 8 | 55 | ✓ |
| F-Boundary | 18 | 6 | 24 | ✓ |
| F-Error | 19 | 6 | 25 | ✓ |
| F-Cross | 18 | 4 | 22 | ✓ |
| F-Lifecycle | 16 | 4 | 20 | ✓ |

**维度均衡度**: 0.78 (最低20/最高55 = 0.36, 需要补充F-Boundary和F-Lifecycle)
