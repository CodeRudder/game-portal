# R1: 远征模块(Expedition) 挑战报告 — Challenger

> 挑战者: PM Agent (Challenger Role)  
> 日期: 2025-05-02  
> 目标: Builder分支树完备性质疑  
> 审阅范围: R1-builder-tree.md (144条分支)

---

## 1. 总体评估

| 指标 | 评分 |
|------|------|
| 覆盖率评分 | 7.5/10 |
| 发现遗漏数 | 38 |
| P0遗漏 | 7 |
| P1遗漏 | 22 |
| P2遗漏 | 9 |

**总体判断**: Builder的分支树在单系统内部覆盖较为完整，但在**跨系统交互(F-Cross)**和**数据生命周期(F-Lifecycle)**维度存在显著遗漏。部分关键的状态组合路径和竞态条件未被覆盖。

---

## 2. 维度分析

### 2.1 F-Normal: 主线流程完整性

**覆盖较好的部分**: 派遣→推进→战斗→奖励→完成的主链路完整。

**遗漏发现**:

| # | 遗漏描述 | 优先级 | 建议测试用例 |
|---|---------|--------|-------------|
| N-M01 | **同一队伍连续完成多条路线**: 完成路线A后立即派遣到路线B的完整流程未覆盖 | P1 | completeRoute→dispatchTeam→新路线，验证队伍状态正确切换 |
| N-M02 | **区域进度与路线解锁联动**: 通关虎牢关全部路线后，汜水关路线自动解锁的端到端验证 | P0 | 清除region_hulao全部3条路线→验证route_yishui_*解锁 |
| N-M03 | **奇袭路线解锁条件(requireHardClear)**: 需要同区域困难路线通关才能解锁奇袭路线 | P0 | 通关洛阳困难→验证洛阳奇袭解锁 |
| N-M04 | **getTeamNodeProgress**: 队伍路线进度查询未在Normal中覆盖 | P1 | 派遣队伍→推进2节点→查询progress |
| N-M05 | **getAllRoutes/getAllTeams**: 批量查询方法未测试返回正确性 | P2 | 创建多个队伍→getAllTeams返回完整 |
| N-M06 | **getClearedRouteIds/getRouteStars**: 通关记录查询未测试 | P2 | 完成路线→getClearedRouteIds包含该ID |
| N-M07 | **executeSweep返回值未验证奖励内容**: 扫荡成功后应返回奖励，但只验证了计数 | P1 | executeSweep成功→验证返回的success=true |
| N-M08 | **阵型效果对战斗力的实际影响**: FORMATION_EFFECTS中各阵型有不同mod，但未验证STANDARD(全0)阵型的战斗力 | P1 | 创建STANDARD阵型队伍→验证totalPower=原始power |

### 2.2 F-Boundary: 边界条件覆盖

**遗漏发现**:

| # | 遗漏描述 | 优先级 | 建议测试用例 |
|---|---------|--------|-------------|
| B-M01 | **troopCount溢出maxTroops**: recoverTroops后troopCount可能超过maxTroops，代码用Math.min限制，但未测试 | P1 | troopCount=max-1,恢复量>1→验证troopCount=maxTroops |
| B-M02 | **processNodeEffect(healPercent=1.0)**: 100%恢复的边界 | P2 | healPercent=1.0→healAmount=maxTroops |
| B-M03 | **processNodeEffect(healPercent=负数)**: 负数恢复比例 | P1 | healPercent=-0.5→healAmount=0(安全回退) |
| B-M04 | **quickBattle边界: powerRatio恰好=1.5**: 分界线判定 | P2 | allyPower=1500,enemyPower=1000→进入"明显优势"分支 |
| B-M05 | **quickBattle边界: powerRatio恰好=0.7**: 劣势分界线 | P2 | allyPower=700,enemyPower=1000 |
| B-M06 | **createTeam生成的ID唯一性**: Date.now()+random在快速连续调用时可能冲突 | P2 | 循环创建100个队伍→验证ID全部唯一 |
| B-M07 | **estimateOfflineEarnings(hours=0.5)**: 小于最小预估时间1h | P2 | hours=0.5→返回空数组 |
| B-M08 | **calculateOfflineExpedition(avgRouteDurationSeconds=0)**: 除零风险 | P0 | avgDuration=0→Math.max(60)保护→不崩溃 |
| B-M09 | **calculateOfflineExpedition(offlineSeconds=负数)**: 负数时间 | P1 | offlineSeconds=-1→cappedSeconds=0 |
| B-M10 | **executeAutoExpedition(maxSteps=0)**: 零步数限制 | P2 | maxSteps=0→返回空结果 |

### 2.3 F-Error: 异常路径覆盖

**遗漏发现**:

| # | 遗漏描述 | 优先级 | 建议测试用例 |
|---|---------|--------|-------------|
| E-M01 | **dispatchTeam(队伍已在远征中)**: 重复派遣同一队伍 | P0 | team.isExpeditioning=true→dispatchTeam返回false |
| E-M02 | **advanceToNextNode(队伍无currentNodeId)**: 队伍状态不完整 | P1 | team.currentNodeId=null→返回null |
| E-M03 | **completeRoute(队伍无currentRouteId)**: 异常状态 | P1 | team.currentRouteId=null→返回false |
| E-M04 | **executeBattle(allyTeam.units为空数组)**: 空队伍战斗 | P1 | units=[]→totalPower=0→战斗失败 |
| E-M05 | **calculateRouteReward(nodeResults为空数组)**: 空节点列表 | P2 | nodeResults=[]→返回空奖励 |
| E-M06 | **calculateSweepReward(unknown sweepType)**: 无效扫荡类型 | P1 | sweepType不在枚举中→getSweepMultiplier返回1.0(default) |
| E-M07 | **serialize时teams中含远征中的队伍**: 序列化中间状态 | P1 | 队伍远征中→serialize→deserialize→验证isExpeditioning=true |
| E-M08 | **deserialize(空对象)**: 最小化存档数据 | P1 | data={}→不崩溃,使用默认值 |

### 2.4 F-Cross: 跨系统交互覆盖 ⚠️ 重点遗漏

**Builder的F-Cross仅12条(8.3%)，这是最大的薄弱环节。**

| # | 遗漏描述 | 优先级 | 建议测试用例 |
|---|---------|--------|-------------|
| C-M01 | **派遣→战斗→推进→战斗→...完整路线通关链**: 端到端集成测试 | P0 | 派遣→逐节点战斗推进→completeRoute→验证所有子系统状态一致 |
| C-M02 | **自动远征中手动停止→重新启动**: 状态切换 | P0 | start→stop→start→验证状态正确 |
| C-M03 | **自动远征中完成次数递减到0的精确时机**: remainingRepeats从1→0→暂停 | P1 | repeatCount=2→第2步后paused=true,COMPLETED |
| C-M04 | **离线远征计算与实际战斗结果的一致性**: 离线预估 vs 实际执行 | P1 | 同参数→offlineResult.completedRuns与实际执行次数误差<20% |
| C-M05 | **远征中武将锁定+自动编队**: autoComposeTeam应排除远征中武将 | P0 | 武将A在远征中→autoComposeTeam不选A |
| C-M06 | **扫荡与路线星级的联动**: 三星通关后扫荡,二星时不可扫荡 | P1 | completeRoute(2星)→canSweepRoute=false |
| C-M07 | **序列化包含自动远征状态**: isAutoExpeditioning=true时序列化 | P1 | 自动远征中→serialize→deserialize→isAutoExpeditioning=true |
| C-M08 | **completeRoute后自动解锁新路线的精确验证**: 解锁了哪条路线 | P1 | 通关最后一条前置路线→验证目标路线unlocked=true |
| C-M09 | **多队伍并行远征**: 2个队伍同时在不同路线上 | P0 | 2个槽位→派遣2队→各自独立推进 |
| C-M10 | **兵力恢复(recoverTroops)在远征中队伍上的效果**: 远征中队伍也恢复兵力 | P1 | 队伍远征中→recoverTroops→troopCount增加 |

### 2.5 F-Lifecycle: 数据生命周期覆盖 ⚠️ 严重遗漏

**Builder的F-Lifecycle仅9条(6.3%)，且集中在ExpeditionSystem，其他子系统完全未覆盖。**

| # | 遗漏描述 | 优先级 | 建议测试用例 |
|---|---------|--------|-------------|
| L-M01 | **ExpeditionBattleSystem.reset()**: 无持久状态但reset应可调用 | P2 | 调用reset→不崩溃 |
| L-M02 | **ExpeditionRewardSystem.reset()**: 同上 | P2 | 调用reset→不崩溃 |
| L-M03 | **AutoExpeditionSystem.reset()**: 应清空remainingRepeats | P1 | reset→remainingRepeats=null |
| L-M04 | **ExpeditionTeamHelper无状态**: 纯静态方法，无生命周期 | P2 | N/A(确认无状态) |
| L-M05 | **序列化版本号(SAVE_VERSION)变化时的兼容性**: v1→v2迁移 | P1 | 模拟旧版本数据→反序列化→兼容处理 |
| L-M06 | **反序列化后sweepCounts类型安全**: 存档中sweepCounts是string key，需转为SweepType枚举 | P1 | deserialize→sweepCounts类型正确 |
| L-M07 | **反序列化后achievedMilestones类型转换**: string[]→Set<MilestoneType> | P1 | deserialize→achievedMilestones是Set实例 |
| L-M08 | **反序列化后teams中远征队伍的currentRouteId指向**: 路线ID在routes中存在 | P1 | 远征中队伍→serialize→deserialize→currentRouteId有效 |

---

## 3. 高优先级遗漏汇总 (P0)

| # | ID | 遗漏描述 | 维度 | 影响 |
|---|-----|---------|------|------|
| 1 | N-M02 | 区域通关→新区域路线解锁的端到端验证 | F-Normal | 核心进度系统可能失效 |
| 2 | N-M03 | 奇袭路线解锁条件(requireHardClear)验证 | F-Normal | 玩家可能跳过困难直接打奇袭 |
| 3 | B-M08 | calculateOfflineExpedition(avgDuration=0)除零 | F-Boundary | 可能导致Infinity/NaN |
| 4 | E-M01 | 重复派遣同一队伍(远征中再派遣) | F-Error | 队伍状态异常 |
| 5 | C-M01 | 派遣→战斗→推进→完成完整链路集成 | F-Cross | 核心游戏流程断裂 |
| 6 | C-M05 | 远征中武将锁定+自动编队联动 | F-Cross | 武将可能被重复使用 |
| 7 | C-M09 | 多队伍并行远征 | F-Cross | 并发状态可能冲突 |

---

## 4. 建议新增的测试用例 (Top 15)

### P0 必须新增
1. **[C-M01] 完整远征链路集成测试**: 创建队伍→派遣→逐节点战斗推进→completeRoute→验证状态
2. **[N-M02] 区域解锁端到端**: 通关虎牢关3条路线→验证汜水关路线解锁
3. **[N-M03] 奇袭路线解锁**: 通关洛阳困难→验证洛阳奇袭requireHardClear检查
4. **[E-M01] 重复派遣防护**: 队伍远征中→再次dispatchTeam→返回false
5. **[B-M08] 离线远征除零保护**: avgDuration=0→Math.max(60)→不崩溃
6. **[C-M05] 武将锁定+自动编队**: 武将在远征中→autoComposeTeam排除该武将
7. **[C-M09] 多队伍并行远征**: 2个槽位→派遣2队→各自独立推进→互不干扰

### P1 应该新增
8. **[C-M02] 自动远征启停循环**: start→stop→start→状态正确
9. **[C-M03] 自动远征次数精确递减**: repeatCount=2→第2步后COMPLETED
10. **[N-M01] 连续完成多条路线**: 完成路线A→立即派遣路线B
11. **[E-M07] 序列化远征中状态**: 远征中→serialize→deserialize→状态恢复
12. **[C-M10] 远征中队伍兵力恢复**: 远征中→recoverTroops→troopCount增加
13. **[B-M01] troopCount溢出maxTroops保护**: 恢复后不超过maxTroops
14. **[B-M09] 离线远征负数时间**: offlineSeconds=-1→安全处理
15. **[L-M07] achievedMilestones反序列化类型安全**: string[]→Set<MilestoneType>

---

## 5. 维度均衡度分析

| 维度 | Builder条目 | 占比 | 理想占比 | 偏差 |
|------|------------|------|---------|------|
| F-Normal | 53 | 36.8% | 25% | +11.8% |
| F-Boundary | 38 | 26.4% | 25% | +1.4% |
| F-Error | 32 | 22.2% | 20% | +2.2% |
| F-Cross | 12 | 8.3% | 15% | **-6.7%** |
| F-Lifecycle | 9 | 6.3% | 15% | **-8.7%** |

**均衡度评分**: 0.55 (目标 >= 0.7)  
**主要问题**: F-Cross和F-Lifecycle严重不足，需要在R2中大幅补充。

---

## 6. 对Builder的质疑与Builder可能的反驳

| # | Challenger质疑 | Builder可能反驳 | Challenger回应 |
|---|---------------|----------------|---------------|
| 1 | F-Cross仅12条,缺少集成测试 | 各子系统已有独立测试,集成由上层保证 | 集成测试是发现接口契约问题的核心手段,不能省略 |
| 2 | F-Lifecycle仅覆盖ExpeditionSystem | 其他子系统无持久状态 | AutoExpeditionSystem有remainingRepeats需验证reset |
| 3 | 未测试多队伍并行 | 单队伍逻辑正确则多队伍自然正确 | 并行状态管理是常见bug源,必须显式测试 |
| 4 | quickBattle的随机性未充分测试 | 随机结果在合理范围内即可 | 应注入固定rng验证每个分支都能触发 |
| 5 | 掉落表概率未统计验证 | 概率由配置保证 | 应验证rng注入后掉落结果的确定性 |

---

> **Challenger结论**: Builder的分支树在单系统维度覆盖较好，但**跨系统交互和数据生命周期**两个维度存在系统性遗漏。建议在R2中重点补充7个P0遗漏和至少8个P1遗漏，目标将维度均衡度提升至0.7以上。
