# Tech 科技模块 — 对抗式测试分析报告

## 1. 公开 API 清单

### TechTreeSystem（科技树聚合根）
| API | 功能 | 关键分支 |
|-----|------|---------|
| `getNodeDef(id)` | 获取节点定义 | 不存在→undefined |
| `getNodeState(id)` | 获取运行时状态 | 不存在→undefined |
| `getAllNodeStates()` | 所有节点状态 | — |
| `getPathNodes(path)` | 路线节点列表 | 无效path→空数组 |
| `getTierNodes(path, tier)` | 层级节点 | 无效参数→空数组 |
| `setResearching(id, start, end)` | 标记研究中 | 不存在→静默跳过 |
| `completeNode(id)` | 标记完成+互斥锁定 | 不存在→静默跳过 |
| `cancelResearch(id)` | 取消研究 | 非researching→静默跳过 |
| `arePrerequisitesMet(id)` | 前置检查 | 不存在→false |
| `getUnmetPrerequisites(id)` | 未满足前置 | 不存在→空数组 |
| `isMutexLocked(id)` | 互斥锁定检查 | 无mutexGroup→false |
| `getMutexAlternatives(id)` | 互斥替代节点 | — |
| `canResearch(id)` | 综合可研究检查 | 5个分支 |
| `getAllCompletedEffects()` | 完成效果列表 | — |
| `getEffectValue(type, target)` | 效果值汇总 | target匹配'all' |
| `getTechBonusMultiplier()` | 资源产出乘数 | — |
| `getPathProgress(path)` | 路线进度 | — |
| `serialize()` | 序列化 | — |
| `deserialize(data)` | 反序列化 | 恢复+刷新 |

### TechPointSystem（科技点系统）
| API | 功能 | 关键分支 |
|-----|------|---------|
| `syncAcademyLevel(level)` | 同步书院等级 | ≤0→不产出 |
| `getProductionRate()` | 每秒产出 | — |
| `syncResearchSpeedBonus(bonus)` | 研究速度加成 | — |
| `getResearchSpeedMultiplier()` | 速度乘数 | — |
| `canAfford(points)` | 检查科技点 | — |
| `spend(points)` | 直接消耗 | 防护：Math.max(0) |
| `refund(points)` | 退还 | 防护：Math.max(0) |
| `trySpend(points)` | 检查+消耗 | 不足→失败 |
| `canExchange(academyLevel)` | 铜钱兑换检查 | Lv<5→拒绝 |
| `exchangeGoldForTechPoints(gold, level)` | 铜钱兑换 | ≤0→拒绝 |

### TechResearchSystem（研究系统）
| API | 功能 | 关键分支 |
|-----|------|---------|
| `startResearch(techId)` | 开始研究 | 7步校验链 |
| `cancelResearch(techId)` | 取消研究 | 不在队列→失败 |
| `getQueue()` | 获取队列 | — |
| `getMaxQueueSize()` | 最大队列 | 书院等级映射 |
| `getResearchProgress(techId)` | 研究进度 | 不在队列→0 |
| `getRemainingTime(techId)` | 剩余时间 | 不在队列→0 |
| `isResearching(techId)` | 是否研究中 | — |
| `speedUp(techId, method, amount)` | 加速研究 | 天命/元宝分支 |
| `calculateIngotCost(techId)` | 元宝费用 | — |
| `calculateMandateCost(techId)` | 天命费用 | — |
| `serialize()` | 序列化 | — |
| `deserialize(data)` | 反序列化 | 兼容旧存档 |

### TechEffectSystem（效果系统）
| API | 功能 | 关键分支 |
|-----|------|---------|
| `setTechTree(techTree)` | 注入依赖 | — |
| `invalidateCache()` | 缓存失效 | — |
| `getEffectBonus(category, stat)` | 效果查询 | 缓存机制 |
| `getGlobalBonus(stat)` | 全局加成 | — |
| `getEffectValueByTarget(type, target)` | 按目标查询 | — |
| `getPathBonuses(category)` | 路线加成 | — |
| `getAllBonuses()` | 全部加成 | — |

### TechOfflineSystem（离线研究系统）
| API | 功能 | 关键分支 |
|-----|------|---------|
| `onGoOffline(timestamp)` | 开始离线 | — |
| `onComeBackOnline(timestamp)` | 回归计算 | 空快照→null |
| `calculateEffectiveSeconds(sec)` | 有效秒数 | 衰减分段 |
| `calculateOverallEfficiency(sec)` | 综合效率 | — |
| `calculateOfflineProgress(snapshot, sec)` | 离线进度 | — |
| `generateEfficiencyCurve(sec)` | 效率曲线 | — |

### FusionTechSystem（融合科技系统）
| API | 功能 | 关键分支 |
|-----|------|---------|
| `setTechTree(techTree)` | 注入依赖 | — |
| `arePrerequisitesMet(id)` | 前置检查 | 双路线完成 |
| `canResearch(id)` | 可研究检查 | — |
| `completeFusionNode(id)` | 完成 | — |
| `getActiveFusionLinkEffects()` | 活跃联动 | — |
| `refreshAllAvailability()` | 刷新可用性 | — |

### TechLinkSystem（联动系统）
| API | 功能 | 关键分支 |
|-----|------|---------|
| `registerLink(link)` | 注册联动 | — |
| `syncCompletedTechIds(ids)` | 同步完成 | — |
| `getBuildingLinkBonus(type)` | 建筑联动 | — |
| `getHeroLinkBonus(skillId)` | 武将联动 | — |
| `getResourceLinkBonus(type)` | 资源联动 | — |
| `getTechBonus(system, stat)` | 统一查询 | — |

---

## 2. 五维流程分支枚举

### F-Normal: 正常研究流程
```
N1: 选择Tier1节点 → 消耗科技点 → 入队 → 等待 → 完成
N2: 完成Tier1 → Tier2解锁 → 可研究Tier2
N3: 完成Tier2 → Tier3解锁 → 选择互斥分支之一
N4: 完成Tier3 → Tier4解锁 → 可研究终极科技
N5: 三条路线并行研究不同节点
N6: 队列管理：研究完成自动出队
N7: 融合科技：两条路线各完成指定节点 → 解锁
```

### F-Boundary: 边界条件
```
B1: 科技点刚好等于消耗（50点→50点消耗）
B2: 科技点差1（49点→50点消耗，应失败）
B3: 队列刚好满（1/1 → 再加失败）
B4: 队列刚好有1空位（1/2 → 可再加1个）
B5: 同时研究互斥科技（同一mutexGroup两个节点）
B6: Tier1两个节点同时available（互斥组初始状态）
B7: 极端等级：书院Lv0, Lv1, Lv20, Lv99
B8: 研究时间刚好到（endTime == now）
B9: 研究时间差1ms完成
B10: 科技点为0时尝试兑换
B11: 铜钱兑换刚好100（最小单位）
B12: 离线0秒 / 离线刚好72h / 离线超过72h
```

### F-Error: 错误输入
```
E1: 科技点不足（0点 → 50点消耗）
E2: 前置未满足（跳过Tier1直接研究Tier2）
E3: 重复研究同一科技
E4: 队列满时尝试入队
E5: 不存在的techId
E6: 空字符串techId
E7: 取消不在队列中的科技
E8: 加速不在队列中的科技
E9: 天命不足时加速
E10: 负数科技点兑换
E11: 负数天命加速
E12: 零值加速
E13: 反序列化空数据/损坏数据
E14: 重复调用onComeBackOnline
E15: onComeBackOnline时无快照
```

### F-Cross: 跨系统交互
```
C1: 科技完成 → 效果系统缓存刷新
C2: 科技完成 → 联动系统激活
C3: 科技完成 → 互斥锁定其他路线节点
C4: 文化路线研究速度加成 → 影响研究时间
C5: 经济路线资源产出加成 → 影响资源系统
C6: 军事路线攻击加成 → 影响战斗系统
C7: 融合科技完成 → 同步联动效果
C8: 取消研究 → 返还科技点 → 余额恢复
C9: 离线研究完成 → 通知科技树completeNode
C10: 书院等级变化 → 队列大小变化
C11: 科技点产出（update循环）→ 累积
C12: 效果值叠加：多个已完成科技的同类型效果
```

### F-State: 状态转换
```
S1: locked → available（前置完成）
S2: available → researching（开始研究）
S3: researching → completed（时间到）
S4: researching → available（取消研究）
S5: available → locked（互斥锁定）
S6: locked → locked（前置未满足，互斥锁定）
S7: completed → completed（幂等）
S8: 未研究 → 离线完成 → completed
S9: researching → 取消 → 重新研究 → completed
S10: 互斥选择A → 取消A → B变为available → 研究B
```

---

## 3. 对抗式测试策略

### 互斥分支对抗
- 选择路线A后，路线B应被永久锁定
- 完成互斥节点后，替代节点的canResearch应返回互斥原因
- 同一互斥组三个节点（如果存在）的选择逻辑

### 前置条件链对抗
- 跳级研究（跳过Tier1直接Tier2）
- 部分前置完成（3个前置完成2个）
- 循环依赖（配置层面不存在，但需验证）
- 融合科技的双路线前置

### 科技点消耗对抗
- 负数消耗
- 零值消耗
- 浮点精度（科技点为浮点数）
- 溢出：极大值消耗

### 并发与时序对抗
- 同一帧内多次startResearch
- update与startResearch的时序
- 离线回归后立即开始新研究

---

## 4. 测试文件索引

| 文件 | 覆盖维度 | 说明 |
|------|---------|------|
| `tech-adversarial.mutex.test.ts` | F-Normal, F-Boundary | 互斥分支对抗 |
| `tech-adversarial.prereq-chain.test.ts` | F-Normal, F-Error | 前置条件链 |
| `tech-adversarial.points-boundary.test.ts` | F-Boundary, F-Error | 科技点边界 |
| `tech-adversarial.cross-system.test.ts` | F-Cross | 跨系统交互 |
| `tech-adversarial.state-transition.test.ts` | F-State | 状态转换 |
| `tech-adversarial.offline-edge.test.ts` | F-Boundary, F-Error | 离线研究边界 |
| `tech-adversarial.serialization.test.ts` | F-Error | 序列化对抗 |
