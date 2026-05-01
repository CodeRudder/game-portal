# Expedition R1 流程树

> Builder Agent | 基于 builder-rules v1.8 | 2026-05-01

## 模块概况

| 指标 | 值 |
|------|------|
| 源文件数 | 8 |
| 总代码行数 | 2,251 |
| 子系统数 | 4 (ExpeditionSystem, ExpeditionBattleSystem, ExpeditionRewardSystem, AutoExpeditionSystem) |
| 公开API数 | 47 |
| 跨系统链路 | 6 |

## 子系统清单

### S1: ExpeditionSystem (487行)
- 路线管理、节点推进、队伍调度、队列槽位、路线解锁、扫荡、里程碑
- 有 serialize()/deserialize()

### S2: ExpeditionBattleSystem (338行)
- 全自动战斗模拟、阵型克制、星级评定
- 无持久状态，无 serialize()

### S3: ExpeditionRewardSystem (381行)
- 基础奖励、掉落表、首通奖励、里程碑奖励、扫荡奖励、离线奖励
- 无持久状态，无 serialize()

### S4: AutoExpeditionSystem (470行)
- 自动远征循环、离线远征收益、暂停恢复
- 有 remainingRepeats 内部状态但无 serialize()

### S5: ExpeditionTeamHelper (209行)
- 队伍编成、校验、阵营羁绊、战力计算、智能编队
- 纯静态方法，无状态

## 流程树

### F-Normal（正常流程基线）

| 节点ID | API | 路径描述 | covered |
|--------|-----|---------|---------|
| FN-01 | ExpeditionSystem.createTeam() | 创建队伍 → 校验通过 → 写入teams | ✅ ExpeditionSystem-adversarial.test.ts |
| FN-02 | ExpeditionSystem.dispatchTeam() | 派遣队伍 → 扣兵力 → 设路线 → isExpeditioning=true | ✅ ExpeditionSystem-adversarial.test.ts |
| FN-03 | ExpeditionSystem.advanceToNextNode() | 推进节点 → 清除当前 → 激活下一 | ✅ ExpeditionSystem-adversarial.test.ts |
| FN-04 | ExpeditionSystem.processNodeEffect() | 休息节点 → 恢复兵力 | ✅ ExpeditionSystem-adversarial.test.ts |
| FN-05 | ExpeditionSystem.completeRoute() | 完成路线 → 记录通关 → 记录星级 → 解锁新路线 | ✅ ExpeditionSystem-adversarial.test.ts |
| FN-06 | ExpeditionSystem.canUnlockRoute() | 检查路线解锁条件 | ✅ ExpeditionSystem-adversarial.test.ts |
| FN-07 | ExpeditionSystem.unlockRoute() | 解锁路线 → 设起始节点状态 | ✅ ExpeditionSystem-adversarial.test.ts |
| FN-08 | ExpeditionSystem.updateSlots() | 更新队伍槽位 | ✅ ExpeditionSystem-adversarial.test.ts |
| FN-09 | ExpeditionSystem.executeSweep() | 扫荡路线 → 检查三星 → 检查日限 | ✅ ExpeditionSystem-adversarial.test.ts |
| FN-10 | ExpeditionSystem.checkMilestones() | 检查里程碑 | ✅ ExpeditionSystem-adversarial.test.ts |
| FN-11 | ExpeditionSystem.recoverTroops() | 兵力自然恢复 | ✅ ExpeditionSystem-adversarial.test.ts |
| FN-12 | ExpeditionBattleSystem.executeBattle() | 执行战斗 → 模拟回合 → 评级 | ✅ ExpeditionBattleSystem.test.ts |
| FN-13 | ExpeditionBattleSystem.quickBattle() | 快速战斗 → 基于战力比 → 评级 | ✅ ExpeditionBattleSystem-adversarial.test.ts |
| FN-14 | ExpeditionRewardSystem.calculateNodeReward() | 计算节点奖励 | ✅ ExpeditionRewardSystem.test.ts |
| FN-15 | ExpeditionRewardSystem.calculateRouteReward() | 计算路线完成奖励 | ✅ ExpeditionRewardSystem.test.ts |
| FN-16 | ExpeditionRewardSystem.calculateSweepReward() | 计算扫荡奖励 | ✅ ExpeditionRewardSystem.test.ts |
| FN-17 | ExpeditionRewardSystem.calculateOfflineReward() | 计算离线远征奖励 | ✅ ExpeditionRewardSystem.test.ts |
| FN-18 | AutoExpeditionSystem.startAutoExpedition() | 启动自动远征 | ✅ AutoExpeditionSystem.test.ts |
| FN-19 | AutoExpeditionSystem.executeAutoStep() | 执行自动远征单步 | ✅ AutoExpeditionSystem.test.ts |
| FN-20 | AutoExpeditionSystem.executeAutoExpedition() | 执行完整自动远征循环 | ✅ AutoExpeditionSystem.test.ts |
| FN-21 | AutoExpeditionSystem.calculateOfflineExpedition() | 计算离线远征收益 | ✅ AutoExpeditionSystem.test.ts |
| FN-22 | ExpeditionTeamHelper.validateTeam() | 校验队伍编成 | ✅ ExpeditionTeamHelper.test.ts |
| FN-23 | ExpeditionTeamHelper.autoComposeTeam() | 智能编队 | ✅ ExpeditionTeamHelper.test.ts |
| FN-24 | ExpeditionSystem.quickRedeploy() | 快速重派 | ✅ ExpeditionSystem-adversarial.test.ts |

### F-Boundary（边界条件）

| 节点ID | API | 边界条件 | covered |
|--------|-----|---------|---------|
| FB-01 | updateSlots(castleLevel) | castleLevel=0, 负数, NaN | ⚠️ 部分覆盖 |
| FB-02 | getSlotCount(castleLevel) | castleLevel<5 → 0 | ✅ |
| FB-03 | dispatchTeam() | 兵力刚好等于所需 | ✅ |
| FB-04 | dispatchTeam() | 兵力比所需少1 | ✅ |
| FB-05 | completeRoute(teamId, stars) | stars=0, 负数, NaN, Infinity | ⚠️ NaN未覆盖 |
| FB-06 | executeSweep() | 扫荡次数达上限 | ✅ |
| FB-07 | recoverTroops(elapsedSeconds) | elapsedSeconds=0, 负数, NaN | ⚠️ NaN未覆盖 |
| FB-08 | calculateTeamPower() | hero.power=0, 负数, NaN | ✅ |
| FB-09 | executeBattle() | allyPower=0, enemyPower=0 | ✅ |
| FB-10 | quickBattle() | allyPower=0, enemyPower=0 | ✅ |
| FB-11 | calculateOfflineExpedition() | offlineSeconds=0, 负数, 超过72h | ✅ |
| FB-12 | calculateNodeReward() | gradeMultiplier=0 | N/A (内部) |
| FB-13 | processNodeEffect() | healPercent=NaN → healAmount=NaN | ⚠️ 未覆盖 |
| FB-14 | advanceToNextNode() | branchIndex越界 | ✅ |
| FB-15 | createTeam() | heroIds.length=0, >MAX | ✅ |

### F-Error（异常路径）

| 节点ID | API | 异常场景 | covered |
|--------|-----|---------|---------|
| FE-01 | dispatchTeam() | teamId不存在 | ✅ |
| FE-02 | dispatchTeam() | routeId不存在 | ✅ |
| FE-03 | dispatchTeam() | route未解锁 | ✅ |
| FE-04 | dispatchTeam() | 槽位已满 | ✅ |
| FE-05 | advanceToNextNode() | teamId不存在 | ✅ |
| FE-06 | completeRoute() | teamId不存在 | ✅ |
| FE-07 | deserialize(null) | null输入 | ⚠️ 未覆盖 |
| FE-08 | deserialize({}) | 空对象输入 | ⚠️ 未覆盖 |
| FE-09 | quickBattle() | allyPower=NaN | ⚠️ 未覆盖 |
| FE-10 | executeAutoStep() | team.troopCount=NaN | ⚠️ 未覆盖 |
| FE-11 | createTeam() | heroDataMap中缺少武将 | ✅ |
| FE-12 | validateTeam() | 重复武将ID | ✅ |

### F-Cross（跨系统交互）

| 节点ID | 链路 | 描述 | covered |
|--------|------|------|---------|
| FC-01 | ExpeditionSystem → ExpeditionTeamHelper | 队伍创建委托 | ✅ |
| FC-02 | AutoExpeditionSystem → ExpeditionBattleSystem | 战斗委托 | ✅ |
| FC-03 | AutoExpeditionSystem → ExpeditionRewardSystem | 奖励委托 | ✅ |
| FC-04 | ExpeditionSystem → engine-save | **serialize/deserialize是否被调用** | ❌ **未集成** |
| FC-05 | ExpeditionSystem → engine-getters | getter注册 | ✅ engine-getters.ts:255 |
| FC-06 | AutoExpeditionSystem → ExpeditionSystem | 状态共享(ExpeditionState) | ✅ |

### F-Lifecycle（数据生命周期）

| 节点ID | API | 生命周期场景 | covered |
|--------|-----|-------------|---------|
| FL-01 | serialize() → deserialize() | 往返一致性 | ✅ |
| FL-02 | deserialize() | null/undefined字段安全 | ⚠️ |
| FL-03 | reset() | 重置到初始状态 | ✅ |
| FL-04 | serialize() | teams深拷贝 | ✅ |
| FL-05 | **engine-save.buildSaveData()** | **ExpeditionSystem.serialize()是否被调用** | ❌ **P0** |
| FL-06 | **engine-save.applySaveData()** | **ExpeditionSystem.deserialize()是否被调用** | ❌ **P0** |
| FL-07 | **GameSaveData** | **是否有expedition字段** | ❌ **P0** |
| FL-08 | **SaveContext** | **是否有expedition引用** | ❌ **P0** |

## 跨系统链路枚举（N=4×2=8条）

| # | 链路 | 状态 |
|---|------|------|
| 1 | ExpeditionSystem ↔ engine-save (buildSaveData) | ❌ **断裂** |
| 2 | ExpeditionSystem ↔ engine-save (applySaveData) | ❌ **断裂** |
| 3 | ExpeditionSystem ↔ engine-getters (getExpeditionSystem) | ✅ 正常 |
| 4 | ExpeditionSystem ↔ engine-extended-deps (注册) | ✅ 正常 |
| 5 | AutoExpeditionSystem ↔ ExpeditionBattleSystem (战斗) | ✅ 正常 |
| 6 | AutoExpeditionSystem ↔ ExpeditionRewardSystem (奖励) | ✅ 正常 |
| 7 | ExpeditionSystem ↔ MailSystem (远征归来邮件) | ⚠️ 弱引用 |
| 8 | ExpeditionSystem ↔ ShopSystem (远征币) | ⚠️ 弱引用 |

## P0 高风险节点

| 节点ID | 严重度 | 描述 | 规则引用 |
|--------|--------|------|----------|
| **P0-1** | 🔴 CRITICAL | ExpeditionSystem.serialize/deserialize未被engine-save调用，存档后远征数据丢失 | BR-014, BR-015 |
| **P0-2** | 🟡 HIGH | completeRoute(stars) 未校验NaN/负值，NaN > prevStars 为false但NaN写入routeStars | BR-01, BR-17 |
| **P0-3** | 🟡 HIGH | recoverTroops(elapsedSeconds) 未校验NaN，NaN/TROOP_COST.recoveryIntervalSeconds → NaN → 恢复量NaN | BR-01 |
| **P0-4** | 🟡 HIGH | processNodeEffect() healPercent若为NaN则healAmount=NaN，troopCount变为NaN | BR-01, BR-17 |
| **P0-5** | 🟡 HIGH | updateSlots(castleLevel) 未校验NaN，NaN >= lvl 为false → 返回0 → unlockedSlots=0 | BR-01 |
| **P0-6** | 🟡 HIGH | quickBattle() allyPower=NaN时powerRatio=NaN，进入劣势分支但NaN比较可能异常 | BR-17 |
| **P0-7** | 🟡 HIGH | AutoExpeditionSystem.remainingRepeats 未持久化，重启后丢失 | BR-14 |

## 统计

| 维度 | 节点数 | covered | 未覆盖 | 覆盖率 |
|------|--------|---------|--------|--------|
| F-Normal | 24 | 24 | 0 | 100% |
| F-Boundary | 15 | 8 | 7 | 53% |
| F-Error | 12 | 8 | 4 | 67% |
| F-Cross | 6 | 4 | 2 | 67% |
| F-Lifecycle | 8 | 3 | 5 | 38% |
| **总计** | **65** | **47** | **18** | **72%** |
