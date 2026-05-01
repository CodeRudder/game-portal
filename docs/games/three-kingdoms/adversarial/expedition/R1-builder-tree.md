# R1: 远征模块(Expedition) 测试分支树 — Builder

> 构建者: PM Agent (Builder Role)  
> 日期: 2025-05-02  
> 源码范围: `engine/expedition/` 全部7个文件  
> 核心类: ExpeditionSystem, ExpeditionBattleSystem, ExpeditionRewardSystem, AutoExpeditionSystem, ExpeditionTeamHelper

---

## 1. 模块架构概览

```
ExpeditionSystem (主控)
├── ExpeditionTeamHelper (队伍编成委托)
├── ExpeditionBattleSystem (战斗模拟)
├── ExpeditionRewardSystem (奖励计算)
└── AutoExpeditionSystem (自动/离线远征)
```

**关键数据流**:  
创建队伍 → 派遣(dispatchTeam) → 推进节点(advanceToNextNode) → 战斗(executeBattle) → 奖励(calculateNodeReward) → 完成路线(completeRoute) → 扫荡(executeSweep) → 里程碑(checkMilestones)

---

## 2. 测试分支树

### 2.1 ExpeditionSystem — 路线管理 & 队伍调度

#### F-Normal: 正常流程
| ID | 分支路径 | 前置条件 | 预期结果 | 优先级 |
|----|---------|---------|---------|--------|
| N-01 | 创建队伍(3武将,蜀国,锋矢阵) | 有可用武将 | 队伍创建成功,返回totalPower | P0 |
| N-02 | 派遣队伍到已解锁路线 | 队伍空闲,路线已解锁,兵力充足 | isExpeditioning=true,兵力扣除 | P0 |
| N-03 | 推进到下一节点(无分支) | 队伍远征中,当前节点有nextNodeIds | 当前节点CLEARED,下一节点MARCHING | P0 |
| N-04 | 推进到下一节点(有分支,branchIndex=1) | 当前节点nextNodeIds.length>1 | 进入第二个分支节点 | P1 |
| N-05 | 处理休息点效果 | 当前节点type=REST | 兵力恢复healPercent×maxTroops | P1 |
| N-06 | 完成路线(3星) | 队伍到达终点节点 | clearedRouteIds添加,routeStars更新,队伍归位 | P0 |
| N-07 | 解锁路线(前置区域已通关) | 前置区域所有路线已清除 | route.unlocked=true | P0 |
| N-08 | 扫荡三星路线(普通扫荡) | routeStars>=3,未达日限 | sweepCounts+1,返回成功 | P1 |
| N-09 | 检查里程碑(首次通关) | clearedRouteIds.size=1 | 返回[FIRST_CLEAR] | P1 |
| N-10 | 快速重派(quickRedeploy) | lastDispatchConfig存在,有空闲队伍 | 使用上次配置重新派遣 | P1 |
| N-11 | 兵力恢复(recoverTroops) | elapsedSeconds>0 | 所有队伍按恢复量增加兵力 | P1 |
| N-12 | 序列化→反序列化 | 有完整远征状态 | 状态完全恢复一致 | P0 |

#### F-Boundary: 边界条件
| ID | 分支路径 | 输入/条件 | 预期结果 | 优先级 |
|----|---------|----------|---------|--------|
| B-01 | 创建队伍(0个武将) | heroIds=[] | valid=false,errors含"至少需要1名武将" | P0 |
| B-02 | 创建队伍(6个武将,超上限) | heroIds.length=6 | valid=false,errors含"不能超过5名" | P0 |
| B-03 | 创建队伍(恰好5个武将) | heroIds.length=5 | valid=true | P1 |
| B-04 | 派遣队伍(兵力恰好等于消耗) | troopCount=requiredTroops | 派遣成功,troopCount=0 | P1 |
| B-05 | 派遣队伍(兵力恰好少1) | troopCount=requiredTroops-1 | 派遣失败 | P1 |
| B-06 | 派遣队伍(所有槽位已满) | unlockedSlots=1,已有1队远征中 | 派遣失败 | P0 |
| B-07 | 完成路线(0星) | stars=0 | completeRoute返回false | P1 |
| B-08 | 完成路线(3星) | stars=3 | 成功 | P1 |
| B-09 | 完成路线(4星,超范围) | stars=4 | 返回false | P0 |
| B-10 | 扫荡(恰好达到日限) | sweepCounts=NORMAL:5 | 返回"今日扫荡次数已用完" | P1 |
| B-11 | updateSlots(castleLevel=0) | castleLevel=0 | 返回0个槽位 | P1 |
| B-12 | updateSlots(castleLevel=5) | castleLevel=5 | 返回1个槽位 | P1 |
| B-13 | updateSlots(castleLevel=100) | 超大等级 | 返回最大配置槽位 | P1 |
| B-14 | 兵力恢复(elapsedSeconds=299) | 小于recoveryInterval | recoveryCycles=0,不恢复 | P1 |
| B-15 | 兵力恢复(elapsedSeconds=300) | 恰好一个恢复周期 | 恢复1×recoveryAmount | P1 |
| B-16 | getRouteNodeProgress(空路线) | 无节点 | current=0,total=0,percentage=0 | P2 |
| B-17 | advanceToNextNode(branchIndex越界) | branchIndex=999 | 回退到nextNodeIds[0] | P1 |

#### F-Error: 异常路径
| ID | 分支路径 | 输入/条件 | 预期结果 | 优先级 |
|----|---------|----------|---------|--------|
| E-01 | 派遣不存在的队伍 | teamId="nonexistent" | 返回false | P0 |
| E-02 | 派遣到未解锁路线 | route.unlocked=false | 返回false | P0 |
| E-03 | 派遣到不存在的路线 | routeId="nonexistent" | 返回false | P0 |
| E-04 | 推进非远征中队伍 | team.isExpeditioning=false | 返回null | P0 |
| E-05 | 推进已到终点的队伍 | nextNodeIds=[] | 返回null | P0 |
| E-06 | 创建队伍(武将已在其他队) | heroId重复 | valid=false | P0 |
| E-07 | 创建队伍(武将不存在) | heroDataMap无此ID | valid=false | P0 |
| E-08 | 解锁不存在的路线 | routeId="nonexistent" | canUnlock=false | P1 |
| E-09 | 解锁已解锁的路线 | route.unlocked=true | canUnlock=true(幂等) | P2 |
| E-10 | quickRedeploy(无上次配置) | lastDispatchConfig=null | 返回false | P1 |
| E-11 | quickRedeploy(原路线已锁定) | route.unlocked=false | 返回false | P1 |
| E-12 | updateSlots(NaN) | castleLevel=NaN | 返回当前unlockedSlots不变 | P0 |
| E-13 | updateSlots(负数) | castleLevel=-1 | 返回当前unlockedSlots不变 | P0 |
| E-14 | completeRoute(stars=NaN) | stars=NaN | 返回false | P0 |
| E-15 | completeRoute(stars=-1) | stars=-1 | 返回false | P1 |
| E-16 | recoverTroops(0) | elapsedSeconds=0 | 不恢复 | P2 |
| E-17 | recoverTroops(负数) | elapsedSeconds=-100 | 不恢复 | P2 |
| E-18 | 扫荡未三星路线 | routeStars<3 | 返回"需要三星通关才能扫荡" | P0 |
| E-19 | processNodeEffect(非休息节点) | node.type=BOSS | healed=false | P1 |
| E-20 | processNodeEffect(healPercent=0) | healPercent=0 | healAmount=0 | P2 |
| E-21 | processNodeEffect(healPercent=NaN) | healPercent=NaN | healAmount=0(安全回退) | P1 |

#### F-Cross: 跨系统交互
| ID | 分支路径 | 涉及系统 | 预期结果 | 优先级 |
|----|---------|---------|---------|--------|
| C-01 | 武将远征中锁定检查 | Expedition+外部系统 | getExpeditioningHeroIds返回正确集合 | P0 |
| C-02 | 派遣后武将锁定,不能再编入新队 | ExpeditionTeam | 第二次编入同一武将失败 | P0 |
| C-03 | 完成路线后自动解锁新路线 | Expedition内部 | checkAndUnlockNewRoutes触发 | P1 |
| C-04 | 完成路线后武将解锁 | Expedition+外部 | isHeroExpeditioning返回false | P0 |
| C-05 | 扫荡+奖励系统联动 | Expedition+Reward | calculateSweepReward正确计算 | P1 |
| C-06 | 里程碑+奖励系统联动 | Expedition+Reward | getMilestoneReward返回正确奖励 | P2 |
| C-07 | 自动远征+战斗系统联动 | AutoExpedition+Battle | quickBattle被正确调用 | P0 |
| C-08 | 自动远征+奖励系统联动 | AutoExpedition+Reward | calculateNodeReward被正确调用 | P0 |
| C-09 | 序列化→反序列化→操作 | Lifecycle+Normal | 反序列化后所有操作正常 | P0 |
| C-10 | reset后状态清空 | Lifecycle | 状态回到初始值 | P1 |

#### F-Lifecycle: 数据生命周期
| ID | 分支路径 | 阶段 | 预期结果 | 优先级 |
|----|---------|------|---------|--------|
| L-01 | 空状态序列化 | 创建 | 正确序列化默认值 | P1 |
| L-02 | 完整状态序列化 | 更新 | 所有字段正确保存 | P0 |
| L-03 | 反序列化后路线节点状态恢复 | 读取 | 节点状态正确恢复 | P0 |
| L-04 | 反序列化无routeNodeStatuses(旧存档) | 迁移 | 所有已清除路线节点设为CLEARED | P1 |
| L-05 | 反序列化sweepCounts恢复 | 读取 | 扫荡次数正确恢复 | P1 |
| L-06 | 反序列化teams恢复 | 读取 | 队伍数据完整 | P0 |
| L-07 | 反序列化lastDispatchConfig恢复 | 读取 | 快速重派配置正确 | P2 |
| L-08 | 反序列化缺失字段(向后兼容) | 迁移 | 使用默认值 | P1 |
| L-09 | reset清空所有运行时状态 | 销毁 | teams={},clearedRouteIds空 | P1 |

---

### 2.2 ExpeditionBattleSystem — 战斗模拟

#### F-Normal
| ID | 分支路径 | 预期结果 | 优先级 |
|----|---------|---------|--------|
| NB-01 | executeBattle(优势战斗) | 大捷/小胜,stars>=2 | P0 |
| NB-02 | executeBattle(劣势战斗) | 惜败/惨胜 | P0 |
| NB-03 | quickBattle(压倒性优势,powerRatio>=2.0) | allyHpPercent>85 | P0 |
| NB-04 | quickBattle(势均力敌,powerRatio≈1.0) | allyHpPercent 25~65 | P1 |
| NB-05 | quickBattle(压倒性劣势,powerRatio<0.7) | allyHpPercent<10 | P0 |
| NB-06 | 阵型克制(锋矢vs方圆) | counterBonus=+0.10 | P0 |
| NB-07 | 被克制(方圆vs锋矢) | counterBonus=-0.10 | P0 |
| NB-08 | 无克制关系(STANDARD vs OFFENSIVE) | counterBonus=0 | P1 |
| NB-09 | 评级: hpPercent>50且deaths=0 | GREAT_VICTORY | P0 |
| NB-10 | 评级: hpPercent=30,deaths=1 | MINOR_VICTORY | P1 |
| NB-11 | 评级: hpPercent=5,deaths=0(胜) | PYRRHIC_VICTORY | P1 |
| NB-12 | 评级: 战败 | NARROW_DEFEAT | P0 |
| NB-13 | BOSS节点难度倍率1.3 | calculateEnemyPower=enemyPower×1.3 | P1 |
| NB-14 | TREASURE/REST节点难度倍率0 | 不产生伤害 | P1 |

#### F-Boundary
| ID | 分支路径 | 预期结果 | 优先级 |
|----|---------|---------|--------|
| BB-01 | executeBattle(双方战力相等) | 可胜可负,合理范围 | P1 |
| BB-02 | quickBattle(enemyPower=0) | powerRatio=Infinity,压倒性优势 | P1 |
| BB-03 | quickBattle(allyPower=0) | 压倒性劣势 | P1 |
| BB-04 | 战斗恰好10回合 | turns=10 | P2 |
| BB-05 | allyHpPercent恰好50% | 边界判定: hpPercent>50 → GREAT需deaths=0 | P1 |
| BB-06 | allyHpPercent恰好10% | hpPercent>=10 → MINOR_VICTORY | P1 |

#### F-Error
| ID | 分支路径 | 预期结果 | 优先级 |
|----|---------|---------|--------|
| EB-01 | executeBattle(null allyTeam) | TypeScript编译期拦截/运行时异常 | P1 |
| EB-02 | quickBattle(enemyPower=NaN) | powerRatio=NaN,Math.max(NaN,1)=NaN | P1 |

---

### 2.3 ExpeditionRewardSystem — 奖励计算

#### F-Normal
| ID | 分支路径 | 预期结果 | 优先级 |
|----|---------|---------|--------|
| NR-01 | calculateNodeReward(普通+BOSS+大捷) | 基础奖励×1.5+BOSS掉落 | P0 |
| NR-02 | calculateNodeReward(首通) | 额外hero_fragment | P0 |
| NR-03 | calculateRouteReward(多节点汇总) | 合并所有节点奖励 | P1 |
| NR-04 | calculateSweepReward(普通扫荡) | 基础×1.0 | P1 |
| NR-05 | calculateSweepReward(高级扫荡) | 基础×1.5+保底稀有 | P1 |
| NR-06 | calculateSweepReward(免费扫荡) | 基础×0.5 | P2 |
| NR-07 | calculateOfflineReward(72h内) | completedRuns×0.85效率 | P1 |
| NR-08 | calculateOfflineReward(超过72h) | isTimeCapped=true,封顶72h | P1 |
| NR-09 | getMilestoneReward(FIRST_CLEAR) | 返回对应配置的奖励 | P2 |
| NR-10 | getMilestoneReward(不存在类型) | 返回null | P2 |

#### F-Boundary
| ID | 分支路径 | 预期结果 | 优先级 |
|----|---------|---------|--------|
| BR-01 | calculateOfflineReward(offlineSeconds=0) | completedRuns=0或1 | P1 |
| BR-02 | calculateOfflineReward(offlineSeconds=72h恰好) | 不封顶 | P2 |
| BR-03 | calculateOfflineReward(offlineSeconds=72h+1s) | 封顶 | P2 |
| BR-04 | 掉落表:所有item都未命中(rng=1.0) | drops=[] | P1 |
| BR-05 | 掉落表:所有item都命中(rng=0.0) | drops包含所有条目 | P1 |
| BR-06 | 高级扫荡保底(无掉落时) | drops含保底稀有材料 | P0 |

#### F-Error
| ID | 分支路径 | 预期结果 | 优先级 |
|----|---------|---------|--------|
| ER-01 | calculateNodeReward(unknown difficulty) | getBaseReward可能undefined | P1 |
| ER-02 | getMilestoneReward(无效类型) | 返回null | P2 |

---

### 2.4 AutoExpeditionSystem — 自动/离线远征

#### F-Normal
| ID | 分支路径 | 预期结果 | 优先级 |
|----|---------|---------|--------|
| NA-01 | startAutoExpedition(正常启动) | isAutoExpeditioning=true | P0 |
| NA-02 | executeAutoStep(成功) | success=true,reward有值 | P0 |
| NA-03 | executeAutoStep(失败) | consecutiveFailures++ | P0 |
| NA-04 | 连续失败2次自动暂停 | consecutiveFailures=2 | paused=true | P0 |
| NA-05 | 设定次数用完 | remainingRepeats=0 | paused=true,COMPLETED | P0 |
| NA-06 | stopAutoExpedition | isAutoExpeditioning=false | P1 |
| NA-07 | calculateOfflineExpedition(正常) | 合理的completedRuns和奖励 | P1 |
| NA-08 | estimateOfflineEarnings(24h) | 返回1/2/4/8/12/24h预估 | P2 |

#### F-Boundary
| ID | 分支路径 | 预期结果 | 优先级 |
|----|---------|---------|--------|
| BA-01 | startAutoExpedition(repeatCount=0,无限) | remainingRepeats=null | P1 |
| BA-02 | startAutoExpedition(repeatCount=1) | 执行1次后COMPLETED | P1 |
| BA-03 | executeAutoExpedition(maxSteps=1) | 只执行1步 | P2 |
| BA-04 | 兵力恰好耗尽 | TROOPS_EXHAUSTED暂停 | P0 |
| BA-05 | calculateOfflineExpedition(avgDuration=60s) | 至少完成1次 | P1 |
| BA-06 | calculateOfflineExpedition(avgDuration=极大) | completedRuns=1(保底) | P1 |

#### F-Error
| ID | 分支路径 | 预期结果 | 优先级 |
|----|---------|---------|--------|
| EA-01 | startAutoExpedition(已在自动远征中) | 返回false | P0 |
| EA-02 | startAutoExpedition(不存在的队伍) | 返回false | P0 |
| EA-03 | startAutoExpedition(兵力不足) | 返回false | P0 |
| EA-04 | startAutoExpedition(路线未解锁) | 返回false | P0 |
| EA-05 | executeAutoStep(兵力不足) | paused=true,TROOPS_EXHAUSTED | P0 |

#### F-Cross
| ID | 分支路径 | 涉及系统 | 预期结果 | 优先级 |
|----|---------|---------|---------|--------|
| CA-01 | 自动远征完整循环 | Auto+Battle+Reward+Expedition | 步骤结果正确汇总 | P0 |
| CA-02 | 离线远征+阵型克制 | Auto+Battle | counterBonus影响completedRuns | P1 |

---

### 2.5 ExpeditionTeamHelper — 队伍编成辅助

#### F-Normal
| ID | 分支路径 | 预期结果 | 优先级 |
|----|---------|---------|--------|
| NT-01 | validateTeam(3蜀将,锋矢阵) | valid=true,factionBond=true | P0 |
| NT-02 | validateTeam(混合阵营,无羁绊) | valid=true,factionBond=false,warnings有提示 | P1 |
| NT-03 | checkFactionBond(3同阵营) | 返回true | P0 |
| NT-04 | checkFactionBond(2同阵营) | 返回false | P1 |
| NT-05 | calculateTeamPower(含羁绊) | power×(1+0.10) | P0 |
| NT-06 | calculateTeamPower(无羁绊) | power×1.0 | P1 |
| NT-07 | autoComposeTeam(优先同阵营) | 优先选同阵营高战力 | P0 |
| NT-08 | autoComposeTeam(无同阵营3人) | 纯按战力排序 | P1 |
| NT-09 | calculateTroopCost(3武将) | 3×20=60 | P1 |

#### F-Boundary
| ID | 分支路径 | 预期结果 | 优先级 |
|----|---------|---------|--------|
| BT-01 | autoComposeTeam(无可用武将) | 返回[] | P1 |
| BT-02 | autoComposeTeam(1个可用武将) | 返回[id] | P1 |
| BT-03 | validateTeam(恰好FACTION_BOND_THRESHOLD人同阵营) | factionBond=true | P1 |

#### F-Error
| ID | 分支路径 | 预期结果 | 优先级 |
|----|---------|---------|--------|
| ET-01 | validateTeam(heroIds中含重复武将) | 不检查重复,valid=true(设计如此) | P2 |
| ET-02 | autoComposeTeam(activeHeroIds包含所有武将) | 返回[] | P1 |

---

## 3. 统计汇总

| 子系统 | F-Normal | F-Boundary | F-Error | F-Cross | F-Lifecycle | 合计 |
|--------|----------|------------|---------|---------|-------------|------|
| ExpeditionSystem | 12 | 17 | 21 | 10 | 9 | 69 |
| ExpeditionBattleSystem | 14 | 6 | 2 | 0 | 0 | 22 |
| ExpeditionRewardSystem | 10 | 6 | 2 | 0 | 0 | 18 |
| AutoExpeditionSystem | 8 | 6 | 5 | 2 | 0 | 21 |
| ExpeditionTeamHelper | 9 | 3 | 2 | 0 | 0 | 14 |
| **合计** | **53** | **38** | **32** | **12** | **9** | **144** |

### P0/P1/P2分布
| 优先级 | 数量 | 占比 |
|--------|------|------|
| P0 | 52 | 36.1% |
| P1 | 68 | 47.2% |
| P2 | 24 | 16.7% |

### 维度均衡度
- F-Normal: 53 (36.8%)
- F-Boundary: 38 (26.4%)
- F-Error: 32 (22.2%)
- F-Cross: 12 (8.3%)
- F-Lifecycle: 9 (6.3%)

> **Builder自评**: 分支树覆盖了5个子系统的全部公开方法，P0用例集中在核心派遣/战斗/奖励链路。F-Cross和F-Lifecycle占比偏低，可能需要Challenger补充跨系统联动的遗漏场景。
