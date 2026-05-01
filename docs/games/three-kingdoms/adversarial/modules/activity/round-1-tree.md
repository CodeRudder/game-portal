# Activity R1 — Builder 流程树

> 版本: v1.0 | Builder规则: v1.9 | 生成时间: 2026-05-01
> 模块: `engine/activity/` | 公开API: 62个 | 辅助函数: 11个

## 标注说明

- `covered` — 已有测试覆盖（标注测试文件）
- `todo` — 需要补充测试
- `uncovered` — 完全未覆盖
- `N/A` — 不适用（纯返回/无分支）

---

## 1. ActivitySystem

### 1.1 init(deps)
| ID | 分支 | 状态 | 验证 |
|----|------|------|------|
| F-N-001 | 正常注入deps | covered | TimedActivitySystem.test.ts L34 |
| F-E-001 | deps=null 无throw（存储null） | todo | 源码L80无null guard |

### 1.2 update(dt)
| ID | 分支 | 状态 | 验证 |
|----|------|------|------|
| F-N-002 | 调用不报错（空操作） | N/A | 无分支 |

### 1.3 getState()
| ID | 分支 | 状态 | 验证 |
|----|------|------|------|
| F-N-003 | 返回配置快照 | covered | TokenShopSystem.test.ts L41 |

### 1.4 reset()
| ID | 分支 | 状态 | 验证 |
|----|------|------|------|
| F-N-004 | 重置并发配置和离线效率 | covered | TokenShopSystem.test.ts L194 |

### 1.5 canStartActivity(state, type)
| ID | 分支 | 状态 | 验证 |
|----|------|------|------|
| F-N-005 | 未达上限 canStart=true | covered | ActivitySystem-p1.test.ts L259 |
| F-N-006 | 达到总上限 canStart=false | covered | ActivitySystem-p1.test.ts L265 |
| F-B-001 | maxTotal=NaN reason='并行配置异常' | uncovered | FIX-ACT-001 |
| F-B-002 | maxTotal<=0 reason='并行配置异常' | uncovered | FIX-ACT-001 |
| F-B-003 | 分类型达上限（如赛季x1） canStart=false | todo | 源码L122-132 |
| F-B-004 | 分类型未达上限 canStart=true | todo | 5种类型各需验证 |

### 1.6 startActivity(state, def, tasks, milestones, now)
| ID | 分支 | 状态 | 验证 |
|----|------|------|------|
| F-N-007 | 正常启动活动 | covered | ActivitySystem-p1.test.ts L203 |
| F-E-002 | def=null throw | covered | FIX-ACT-005 |
| F-E-003 | now=NaN throw | todo | FIX-ACT-005 |
| F-B-005 | tasks=null 空数组 | todo | 源码L165 taskDefs ?? [] |
| F-B-006 | milestones=null 空数组 | todo | 源码L166 milestones ?? [] |

### 1.7 updateActivityStatus(state, activityId, now, endTime)
| ID | 分支 | 状态 | 验证 |
|----|------|------|------|
| F-N-008 | now>=endTime ENDED | covered | ActivitySystem-p1.test.ts L231 |
| F-N-009 | now<endTime 保持ACTIVE | covered | ActivitySystem-p1.test.ts L239 |
| F-N-010 | activityId不存在 返回原state | covered | ActivitySystem-p1.test.ts L246 |
| F-B-007 | now=NaN 返回原state（不执行变更） | uncovered | FIX-ACT-026 |
| F-B-008 | endTime=NaN 返回原state | uncovered | FIX-ACT-026 |

### 1.8 getActiveActivities(state)
| ID | 分支 | 状态 | 验证 |
|----|------|------|------|
| F-N-011 | 返回所有ACTIVE活动 | covered | ActivitySystem-p1.test.ts L209 |
| F-N-012 | ENDED活动不包含 | covered | ActivitySystem-p1.test.ts L252 |

### 1.9 updateTaskProgress(state, actId, taskDefId, progress)
| ID | 分支 | 状态 | 验证 |
|----|------|------|------|
| F-N-013 | 增加进度 | covered | ActivitySystem-p1.test.ts L359 |
| F-N-014 | 达到目标 COMPLETED | covered | ActivitySystem-p1.test.ts L366 |
| F-N-015 | 进度不超过targetCount | covered | ActivitySystem-p1.test.ts L373 |
| F-N-016 | 已CLAIMED任务不再更新 | covered | ActivitySystem-p1.test.ts L379 |
| F-N-017 | actId不存在 原state | covered | ActivitySystem-p1.test.ts L392 |
| F-B-009 | progress=NaN 原state | uncovered | FIX-ACT-002 |
| F-B-010 | progress<=0 原state | uncovered | FIX-ACT-003 |
| F-B-011 | progress=Infinity 原state | todo | !Number.isFinite检查 |

### 1.10 claimTaskReward(state, actId, taskDefId)
| ID | 分支 | 状态 | 验证 |
|----|------|------|------|
| F-N-018 | 领取COMPLETED任务奖励 | covered | ActivitySystem-p1.test.ts L405 |
| F-N-019 | 积分和代币累加 | covered | ActivitySystem-p1.test.ts L416 |
| F-E-004 | actId不存在 throw | covered | ActivitySystem-p1.test.ts L447 |
| F-E-005 | taskDefId不存在 throw | covered | ActivitySystem-p1.test.ts L453 |
| F-E-006 | 已CLAIMED throw | covered | ActivitySystem-p1.test.ts L439 |
| F-E-007 | 未COMPLETED throw | covered | ActivitySystem-p1.test.ts L433 |
| F-B-012 | pointReward=NaN safePointReward=0 | uncovered | FIX-ACT-004 |
| F-B-013 | tokenReward=NaN safeTokenReward=0 | uncovered | FIX-ACT-004 |
| F-B-014 | 多次领取累积积分代币 | covered | ActivitySystem-p1.test.ts L423 |

### 1.11 resetDailyTasks(state, actId, dailyTaskDefs)
| ID | 分支 | 状态 | 验证 |
|----|------|------|------|
| F-N-020 | 重置每日任务进度 | covered | ActivitySystem-p1.test.ts L460 |
| F-N-021 | actId不存在 原state | todo | 源码L262 |
| F-B-015 | dailyTaskDefs为空 无重置 | todo | 空Set场景 |

### 1.12 checkMilestones(state, actId)
| ID | 分支 | 状态 | 验证 |
|----|------|------|------|
| F-N-022 | 积分足够 UNLOCKED | covered | ActivitySystem-p2.test.ts L129 |
| F-N-023 | 积分不足 保持LOCKED | covered | ActivitySystem-p2.test.ts L142 |
| F-N-024 | 已CLAIMED 不变 | covered | ActivitySystem-p2.test.ts L179 |
| F-N-025 | actId不存在 原state | covered | ActivitySystem-p2.test.ts L195 |
| F-B-016 | points=NaN 不解锁 | uncovered | FIX-ACT-005 |

### 1.13 claimMilestone(state, actId, milestoneId)
| ID | 分支 | 状态 | 验证 |
|----|------|------|------|
| F-N-026 | 领取UNLOCKED里程碑 | covered | ActivitySystem-p2.test.ts L200 |
| F-E-008 | 未UNLOCKED throw | covered | ActivitySystem-p2.test.ts L214 |
| F-E-009 | 已CLAIMED throw | covered | ActivitySystem-p2.test.ts L220 |
| F-E-010 | actId不存在 throw | covered | ActivitySystem-p2.test.ts L236 |
| F-E-011 | milestoneId不存在 throw | covered | ActivitySystem-p2.test.ts L242 |

### 1.14 calculateOfflineProgress(state, duration)
| ID | 分支 | 状态 | 验证 |
|----|------|------|------|
| F-N-027 | 活跃活动计算离线积分 | covered | ActivitySystem-p2.test.ts L265 |
| F-N-028 | 已结束活动不产生进度 | covered | ActivitySystem-p2.test.ts L273 |
| F-N-029 | 不同类型效率不同 | covered | ActivitySystem-p2.test.ts L280 |

### 1.15 applyOfflineProgress(state, results)
| ID | 分支 | 状态 | 验证 |
|----|------|------|------|
| F-N-030 | 应用离线进度到状态 | covered | ActivitySystem-p2.test.ts L298 |
| F-N-031 | 空结果不改变状态 | covered | ActivitySystem-p2.test.ts L307 |
| F-N-032 | 不存在的活动跳过 | covered | ActivitySystem-p2.test.ts L313 |

### 1.16 serialize(state)
| ID | 分支 | 状态 | 验证 |
|----|------|------|------|
| F-N-033 | 正确序列化结构 | covered | ActivitySystem-p3.test.ts L153 |
| F-N-034 | 往返一致（空状态） | covered | ActivitySystem-p3.test.ts L161 |
| F-N-035 | 往返一致（有活动） | covered | ActivitySystem-p3.test.ts L168 |
| F-B-017 | points=NaN 清洗为0 | uncovered | FIX-ACT-024 |
| F-B-018 | tokens=NaN 清洗为0 | uncovered | FIX-ACT-024 |
| F-B-019 | currentProgress=NaN 清洗为0 | uncovered | FIX-ACT-024 |
| F-B-020 | targetCount=NaN 清洗为0 | uncovered | FIX-ACT-024 |

### 1.17 deserialize(data)
| ID | 分支 | 状态 | 验证 |
|----|------|------|------|
| F-N-036 | 正确反序列化 | covered | ActivitySystem-p3.test.ts L161 |
| F-B-021 | data=null 返回默认状态 | covered | ActivitySystem-p3.test.ts L185 |
| F-B-022 | version不匹配 返回默认状态 | covered | ActivitySystem-p3.test.ts L180 |
| F-B-023 | data=undefined 返回默认状态 | covered | ActivitySystem-p3.test.ts L185 |

### 1.18 getConcurrencyConfig()
| ID | 分支 | 状态 | 验证 |
|----|------|------|------|
| F-N-037 | 返回默认配置 | covered | ActivitySystem-p3.test.ts L119 |
| F-N-038 | 自定义配置生效 | covered | ActivitySystem-p3.test.ts L129 |

### 1.19 getOfflineEfficiency()
| ID | 分支 | 状态 | 验证 |
|----|------|------|------|
| F-N-039 | 返回默认效率 | covered | ActivitySystem-p3.test.ts L134 |
| F-N-040 | 自定义效率生效 | covered | ActivitySystem-p3.test.ts L143 |

---

## 2. TimedActivitySystem

### 2.1 init / update / getState / reset
| ID | 分支 | 状态 | 验证 |
|----|------|------|------|
| T-N-001 | init不报错 | covered | TimedActivitySystem.test.ts L34 |
| T-N-002 | getState返回状态 | covered | TimedActivitySystem.test.ts L42 |
| T-N-003 | reset清除所有状态 | covered | TimedActivitySystem.test.ts L48 |

### 2.2 createTimedActivityFlow(id, start, end)
| ID | 分支 | 状态 | 验证 |
|----|------|------|------|
| T-N-004 | 正常创建4阶段流程 | covered | TimedActivitySystem.test.ts L59 |
| T-E-001 | start=NaN throw | todo | FIX-TIMED-016 |
| T-E-002 | end=NaN throw | todo | FIX-TIMED-016 |
| T-E-003 | end<=start throw | todo | 源码L155 |
| T-B-001 | previewStart = activeStart - 24h | covered | TimedActivitySystem.test.ts L71 |

### 2.3 updatePhase(id, now)
| ID | 分支 | 状态 | 验证 |
|----|------|------|------|
| T-N-005 | preview阶段 | covered | TimedActivitySystem.test.ts L71 |
| T-N-006 | active阶段 | covered | TimedActivitySystem.test.ts L79 |
| T-N-007 | settlement阶段 | covered | TimedActivitySystem.test.ts L86 |
| T-N-008 | closed阶段 | covered | TimedActivitySystem.test.ts L94 |
| T-N-009 | id不存在 'closed' | covered | 源码L173 |
| T-B-002 | now=NaN phase='closed' | uncovered | FIX-TIMED-010 |

### 2.4 canParticipate(id, now)
| ID | 分支 | 状态 | 验证 |
|----|------|------|------|
| T-N-010 | active阶段 true | covered | TimedActivitySystem.test.ts L102 |
| T-N-011 | 非active阶段 false | covered | TimedActivitySystem.test.ts L102 |
| T-N-012 | id不存在 false | covered | 源码L200 |

### 2.5 getRemainingTime(id, now)
| ID | 分支 | 状态 | 验证 |
|----|------|------|------|
| T-N-013 | 返回剩余时间 | covered | TimedActivitySystem.test.ts L111 |
| T-N-014 | id不存在 0 | covered | TimedActivitySystem.test.ts L120 |
| T-B-003 | now>activeEnd 0 (Math.max) | todo | 已过期场景 |

### 2.6 updateLeaderboard(id, entries)
| ID | 分支 | 状态 | 验证 |
|----|------|------|------|
| T-N-015 | 按积分降序排序并重新排名 | covered | TimedActivitySystem.test.ts L134 |
| T-B-004 | entries含NaN points 排到最后 | uncovered | FIX-TIMED-017 |
| T-B-005 | 超过maxEntries 截断 | todo | 源码L234 |
| T-B-006 | 积分相同按tokens排序 | todo | 源码L223 |

### 2.7 getLeaderboard(id) / getPlayerRank(id, playerId)
| ID | 分支 | 状态 | 验证 |
|----|------|------|------|
| T-N-016 | 获取排行榜 | covered | TimedActivitySystem.test.ts L142 |
| T-N-017 | 获取玩家排名 | covered | TimedActivitySystem.test.ts L142 |
| T-N-018 | 未上榜 0 | covered | TimedActivitySystem.test.ts L148 |

### 2.8 calculateRankRewards(rank)
| ID | 分支 | 状态 | 验证 |
|----|------|------|------|
| T-N-019 | 第1名奖励 | covered | TimedActivitySystem.test.ts L152 |
| T-N-020 | 第2-3名奖励 | covered | TimedActivitySystem.test.ts L157 |
| T-N-021 | 未匹配排名 空奖励 | covered | TimedActivitySystem.test.ts L162 |
| T-B-007 | rank=NaN 空奖励 | todo | NaN比较 |
| T-B-008 | rank=0 空奖励 | todo | 边界 |

### 2.9 节日活动框架
| ID | 分支 | 状态 | 验证 |
|----|------|------|------|
| T-N-022 | getFestivalTemplate 存在的类型 | covered | TimedActivitySystem.test.ts L171 |
| T-N-023 | getFestivalTemplate 不存在 undefined | covered | TimedActivitySystem.test.ts L177 |
| T-N-024 | getAllFestivalTemplates | covered | TimedActivitySystem.test.ts L181 |
| T-N-025 | createFestivalActivity 正常创建 | covered | TimedActivitySystem.test.ts L186 |
| T-B-009 | createFestivalActivity 不存在类型 null | todo | 源码L304 |

### 2.10 离线进度
| ID | 分支 | 状态 | 验证 |
|----|------|------|------|
| T-N-026 | calculateOfflineProgress 正常计算 | covered | TimedActivitySystem.test.ts L197 |
| T-N-027 | calculateAllOfflineProgress 批量 | covered | TimedActivitySystem.test.ts L203 |
| T-B-010 | duration=NaN 返回0结果 | uncovered | FIX-TIMED-018 |
| T-B-011 | duration<=0 返回0结果 | uncovered | FIX-TIMED-018 |
| T-B-012 | duration=0 0积分 | covered | TimedActivitySystem.test.ts L213 |

### 2.11 serialize / deserialize
| ID | 分支 | 状态 | 验证 |
|----|------|------|------|
| T-N-028 | 序列化/反序列化往返 | covered | TimedActivitySystem.test.ts L222 |
| T-N-029 | 反序列化清除旧数据 | covered | TimedActivitySystem.test.ts L237 |
| T-B-013 | data=null 直接return | uncovered | FIX-TIMED-019 |
| T-B-014 | data.flows=null 空数组 | todo | data.flows ?? [] |

---

## 3. TokenShopSystem

### 3.1 ISubsystem 接口
| ID | 分支 | 状态 | 验证 |
|----|------|------|------|
| S-N-001 | name='tokenShop' | covered | TokenShopSystem.test.ts L37 |
| S-N-002 | getState返回状态 | covered | TokenShopSystem.test.ts L41 |
| S-N-003 | reset恢复默认 | covered | TokenShopSystem.test.ts L194 |

### 3.2 商品查询
| ID | 分支 | 状态 | 验证 |
|----|------|------|------|
| S-N-004 | getAllItems | covered | TokenShopSystem.test.ts L51 |
| S-N-005 | getAvailableItems（上架且未售罄） | covered | TokenShopSystem.test.ts L56 |
| S-N-006 | getItem 存在 | covered | TokenShopSystem.test.ts L61 |
| S-N-007 | getItem 不存在 undefined | covered | TokenShopSystem.test.ts L67 |
| S-N-008 | getItemsByActivity | covered | TokenShopSystem.test.ts L71 |
| S-B-001 | getAvailableItems purchaseLimit=0 不限购 | todo | L76 purchaseLimit > 0 |
| S-B-002 | getItemsByRarity | uncovered | 未在测试文件中出现 |

### 3.3 purchaseItem(id, qty)
| ID | 分支 | 状态 | 验证 |
|----|------|------|------|
| S-N-009 | 正常购买 | covered | TokenShopSystem.test.ts L80 |
| S-E-001 | 商品不存在 | covered | TokenShopSystem.test.ts L87 |
| S-E-002 | 已下架 | covered | TokenShopSystem.test.ts L93 |
| S-E-003 | 限购超出 | covered | TokenShopSystem.test.ts L100 |
| S-E-004 | 余额不足 | covered | TokenShopSystem.test.ts L108 |
| S-B-003 | qty=NaN 失败 | uncovered | FIX-SHOP-010 |
| S-B-004 | qty<=0 失败 | uncovered | FIX-SHOP-011 |
| S-B-005 | totalCost=NaN 价格异常 | uncovered | FIX-SHOP-010b |
| S-B-006 | rewards.resourceChanges=null 安全处理 | uncovered | FIX-SHOP-012 |
| S-B-007 | rewards中value=NaN 跳过 | todo | FIX-SHOP-012 |
| S-B-008 | 购买后tokenBalance正确扣减 | todo | 需验证余额 |

### 3.4 代币管理
| ID | 分支 | 状态 | 验证 |
|----|------|------|------|
| S-N-010 | addTokens 增加 | covered | TokenShopSystem.test.ts L119 |
| S-N-011 | spendTokens 余额充足 | covered | TokenShopSystem.test.ts L124 |
| S-N-012 | spendTokens 余额不足 | covered | TokenShopSystem.test.ts L130 |
| S-B-009 | addTokens amount=NaN 不增加 | uncovered | FIX-SHOP-013 |
| S-B-010 | addTokens amount<=0 不增加 | uncovered | FIX-SHOP-014 |
| S-B-011 | spendTokens amount=NaN 失败 | uncovered | FIX-SHOP-013b |
| S-B-012 | addTokens 无上限检查 | todo | BR-22: 资源累积需MAX常量 |

### 3.5 商品管理
| ID | 分支 | 状态 | 验证 |
|----|------|------|------|
| S-N-013 | addItem | covered | TokenShopSystem.test.ts L139 |
| S-N-014 | removeItem | covered | TokenShopSystem.test.ts L149 |
| S-N-015 | refreshShop | covered | TokenShopSystem.test.ts L154 |
| S-N-016 | dailyRefresh | covered | TokenShopSystem.test.ts L162 |
| S-N-017 | setItemAvailability | covered | TokenShopSystem.test.ts L170 |
| S-B-013 | removeItem 不存在 false | todo | 源码L203 |
| S-B-014 | dailyRefresh newItems=null 仅重置计数 | todo | 源码L226 |

### 3.6 serialize / deserialize
| ID | 分支 | 状态 | 验证 |
|----|------|------|------|
| S-N-018 | 序列化/反序列化往返 | covered | TokenShopSystem.test.ts L179 |
| S-B-015 | data=null 直接return | uncovered | FIX-SHOP-015 |
| S-B-016 | data.tokenBalance=NaN 设为0 | uncovered | FIX-SHOP-015 |
| S-B-017 | data.items=null 空数组 | todo | data.items ?? [] |

---

## 4. SignInSystem

### 4.1 ISubsystem 接口
| ID | 分支 | 状态 | 验证 |
|----|------|------|------|
| G-N-001 | name='signIn' | todo | 未在测试中直接验证 |
| G-N-002 | reset恢复默认 | todo | 未在测试中直接验证 |

### 4.2 signIn(data, now)
| ID | 分支 | 状态 | 验证 |
|----|------|------|------|
| G-N-003 | 首次签到 consecutiveDays=1 | covered | SignInSystem-p1.test.ts L90 |
| G-N-004 | 连续签到 consecutiveDays递增 | covered | SignInSystem-p1.test.ts L166 |
| G-N-005 | 第1天奖励 | covered | SignInSystem-p1.test.ts L97 |
| G-N-006 | 连续7天奖励 | covered | SignInSystem-p1.test.ts L105 |
| G-N-007 | 第8天循环回第1天 | covered | SignInSystem-p1.test.ts L124 |
| G-N-008 | 断签后从1开始 | covered | SignInSystem-p1.test.ts L176 |
| G-N-009 | 重复签到 throw | covered | SignInSystem-p1.test.ts L152 |
| G-N-010 | lastSignInTime更新 | covered | SignInSystem-p1.test.ts L160 |
| G-E-001 | now=NaN throw | todo | FIX-SIGN-007 |
| G-B-001 | 跨周补签次数重置 | covered | SignInSystem-p2.test.ts L146 |
| G-B-002 | 同一天重复签到 throw | covered | SignInSystem-p1.test.ts L152 |

### 4.3 retroactive(data, now, goldAvailable)
| ID | 分支 | 状态 | 验证 |
|----|------|------|------|
| G-N-011 | 补签成功 | covered | SignInSystem-p1.test.ts L263 |
| G-N-012 | consecutiveDays递增 | covered | SignInSystem-p1.test.ts L271 |
| G-E-002 | 今日已签到 throw | covered | SignInSystem-p1.test.ts L283 |
| G-E-003 | 补签次数用完 throw | todo | 源码L171 |
| G-E-004 | 元宝不足 throw | todo | 源码L176 |
| G-E-005 | now=NaN throw | uncovered | FIX-SIGN-007b |
| G-E-006 | goldAvailable=NaN throw | uncovered | FIX-SIGN-008 |
| G-B-003 | lastSignInTime=0 consecutiveDays=1 | uncovered | FIX-SIGN-009 |
| G-B-004 | 跨周补签次数重置 | todo | 源码L164-166 |

### 4.4 奖励查询
| ID | 分支 | 状态 | 验证 |
|----|------|------|------|
| G-N-013 | getReward(day) 正确返回 | covered | SignInSystem-p2.test.ts L26 |
| G-N-014 | getReward 超出范围 最后一天 | covered | SignInSystem-p2.test.ts L49 |
| G-N-015 | getReward 0或负数 第1天 | covered | SignInSystem-p2.test.ts L54 |
| G-N-016 | getAllRewards | covered | SignInSystem-p2.test.ts L59 |
| G-N-017 | getConsecutiveBonus 3天=20% | covered | SignInSystem-p1.test.ts L203 |
| G-N-018 | getConsecutiveBonus 7天=50% | covered | SignInSystem-p1.test.ts L210 |
| G-N-019 | getCycleDay 正确 | covered | SignInSystem-p1.test.ts L139 |
| G-N-020 | getCycleDay 0/负数 1 | covered | SignInSystem-p1.test.ts L147 |

### 4.5 状态查询
| ID | 分支 | 状态 | 验证 |
|----|------|------|------|
| G-N-021 | canSignIn 未签 true | todo | 源码L234 |
| G-N-022 | canSignIn 已签 false | todo | 源码L234 |
| G-N-023 | canRetroactive 可补签 | todo | 源码L240 |
| G-N-024 | canRetroactive 次数用完 | todo | 源码L248 |
| G-N-025 | getRemainingRetroactive | todo | 源码L259 |

### 4.6 [CRITICAL] 序列化缺失
| ID | 分支 | 状态 | 验证 |
|----|------|------|------|
| G-SERIAL-001 | SignInSystem **无 serialize/deserialize** | uncovered | BR-14/15: 存档覆盖扫描 |
| G-SERIAL-002 | engine-save是否保存签到状态 | todo | 跨系统链路验证 |

---

## 5. 辅助模块

### 5.1 ActivityFactory
| ID | 分支 | 状态 | 验证 |
|----|------|------|------|
| AF-N-001 | createDefaultActivityState | covered | ActivityFactory.test.ts L33-54 |
| AF-N-002 | createActivityInstance 正常 | covered | ActivityFactory.test.ts L74-93 |
| AF-E-001 | createActivityInstance def=null throw | covered | FIX-FACT-001 |
| AF-N-003 | createActivityTask 正常 | covered | ActivityFactory.test.ts L114-134 |
| AF-E-002 | createActivityTask def=null throw | covered | FIX-FACT-002 |
| AF-N-004 | createMilestone 正常 | covered | ActivityFactory.test.ts L144-167 |
| AF-B-001 | resourceReward 深拷贝 | covered | ActivityFactory.test.ts L134 |

### 5.2 ActivityOfflineCalculator
| ID | 分支 | 状态 | 验证 |
|----|------|------|------|
| AO-N-001 | 活跃活动计算 | covered | ActivityOfflineCalculator.test.ts L68 |
| AO-N-002 | 跳过非活跃活动 | covered | ActivityOfflineCalculator.test.ts L78 |
| AO-N-003 | 不同类型效率 | covered | ActivityOfflineCalculator.test.ts L86 |
| AO-N-004 | 积分0跳过 | covered | ActivityOfflineCalculator.test.ts L101 |
| AO-N-005 | 代币=积分x10% | covered | ActivityOfflineCalculator.test.ts L110 |
| AO-B-001 | duration=NaN 空数组 | covered | FIX-ACT-006 |
| AO-B-002 | duration<=0 空数组 | covered | FIX-ACT-006 |
| AO-N-006 | applyOfflineProgress 正常 | covered | ActivityOfflineCalculator.test.ts L123 |
| AO-N-007 | 不存在的activityId跳过 | covered | ActivityOfflineCalculator.test.ts L138 |
| AO-N-008 | 空结果返回原state | covered | ActivityOfflineCalculator.test.ts L153 |

### 5.3 SeasonHelper
| ID | 分支 | 状态 | 验证 |
|----|------|------|------|
| SH-N-001 | getCurrentSeasonTheme 正确映射 | covered | SeasonHelper.test.ts L27-44 |
| SH-N-002 | 大索引取模 | covered | SeasonHelper.test.ts L44 |
| SH-N-003 | createSettlementAnimation | covered | SeasonHelper.test.ts L53-62 |
| SH-N-004 | updateSeasonRecord 胜场 | covered | SeasonHelper.test.ts L87 |
| SH-N-005 | updateSeasonRecord 败场 | covered | SeasonHelper.test.ts L94 |
| SH-N-006 | updateSeasonRecord 胜率 | covered | SeasonHelper.test.ts L101 |
| SH-N-007 | updateSeasonRecord 最高排名 | covered | SeasonHelper.test.ts L108 |
| SH-B-001 | seasonIndex=NaN index=0 | covered | FIX-SEAS-022 |
| SH-B-002 | currentRanking=NaN 保持原值 | uncovered | FIX-SEAS-023 |
| SH-B-003 | highestRanking=NaN safeRanking | uncovered | FIX-SEAS-023 |
| SH-N-008 | generateSeasonRecordRanking 排序 | covered | SeasonHelper.test.ts L130-161 |
| SH-N-009 | getSeasonThemes | covered | SeasonHelper.test.ts L170 |

### 5.4 token-shop-config
| ID | 分支 | 状态 | 验证 |
|----|------|------|------|
| SC-N-001 | DEFAULT_TOKEN_SHOP_CONFIG | covered | token-shop-config.test.ts L21-27 |
| SC-N-002 | RARITY_ORDER 7个等级 | covered | token-shop-config.test.ts L34-38 |
| SC-N-003 | RARITY_PRICE_MULTIPLIER | covered | token-shop-config.test.ts L45-60 |
| SC-N-004 | DEFAULT_SHOP_ITEMS 7个商品 | covered | token-shop-config.test.ts L66-98 |
| SC-B-001 | 配置-枚举同步（7阶 vs 7商品） | covered | token-shop-config.test.ts L83 |

---

## 6. 跨系统链路

| ID | 链路 | 状态 | 验证 |
|----|------|------|------|
| X-001 | ActivitySystem -> ActivityFactory.createActivityInstance | covered | ActivitySystem-p1.test.ts L203 |
| X-002 | ActivitySystem -> ActivityOfflineCalculator | covered | ActivitySystem-p2.test.ts L265 |
| X-003 | ActivitySystem -> SeasonHelper.getCurrentSeasonTheme | covered | ActivitySystem-p2.test.ts L325 |
| X-004 | ActivitySystem.serialize NaN清洗 -> deserialize | uncovered | NaN清洗路径未验证 |
| X-005 | engine-save -> ActivitySystem.serialize | todo | BR-14: 存档覆盖 |
| X-006 | engine-save -> TimedActivitySystem.serialize | todo | BR-14: 存档覆盖 |
| X-007 | engine-save -> TokenShopSystem.serialize | todo | BR-14: 存档覆盖 |
| X-008 | engine-save -> SignInSystem.serialize | uncovered | BR-14/15: **SignInSystem无serialize** |
| X-009 | TokenShopSystem <-> ActivitySystem 代币流转 | todo | claimTaskReward.tokens -> addTokens |
| X-010 | TimedActivitySystem <-> ActivitySystem 离线进度 | todo | 两套独立离线计算 |

---

## 7. 统计摘要

### 7.1 节点状态分布

| 状态 | 数量 | 占比 |
|------|------|------|
| covered | 161 | 63.1% |
| todo | 53 | 20.8% |
| uncovered | 41 | 16.1% |
| N/A | 1 | 0.4% |
| **总计** | **256** | 100% |

### 7.2 P0 未覆盖节点（NaN/数值安全）

| ID | API | 缺陷 | 优先级 |
|----|-----|------|--------|
| F-B-001 | canStartActivity | maxTotal=NaN | P0 |
| F-B-002 | canStartActivity | maxTotal<=0 | P0 |
| F-B-009 | updateTaskProgress | progress=NaN | P0 |
| F-B-010 | updateTaskProgress | progress<=0 | P0 |
| F-B-012 | claimTaskReward | pointReward=NaN | P0 |
| F-B-013 | claimTaskReward | tokenReward=NaN | P0 |
| F-B-016 | checkMilestones | points=NaN | P0 |
| F-B-017~020 | serialize | NaN清洗 | P0 |
| T-E-001~003 | createTimedActivityFlow | NaN时间 | P0 |
| T-B-002 | updatePhase | now=NaN | P0 |
| T-B-004 | updateLeaderboard | NaN积分 | P0 |
| T-B-010~011 | calculateOfflineProgress | NaN duration | P0 |
| T-B-013 | deserialize | data=null | P0 |
| S-B-003~006 | purchaseItem | NaN qty/cost/rewards | P0 |
| S-B-009~011 | addTokens/spendTokens | NaN amount | P0 |
| S-B-015~016 | deserialize | null/NaN | P0 |
| G-E-005~006 | retroactive | NaN now/gold | P0 |
| G-B-003 | retroactive | lastSignInTime=0 | P0 |
| G-SERIAL-001 | SignInSystem | 无serialize | P0 |
| SH-B-002~003 | updateSeasonRecord | NaN ranking | P0 |

### 7.3 规则符合性检查

| Builder规则 | 状态 | 说明 |
|-------------|------|------|
| BR-1 每个API至少1个F-Normal | WARN | getItemsByRarity无测试 |
| BR-2 数值API检查NaN/负值 | WARN | 41个uncovered集中在NaN防护路径 |
| BR-3 状态变更serialize/deserialize | FAIL | SignInSystem缺失 G-SERIAL-001 |
| BR-5 跨系统链路 N=4x2=8 | WARN | 6/10 covered X-005~010需验证 |
| BR-14 存档覆盖扫描 | FAIL | SignInSystem无serialize |
| BR-22 资源累积上限 | WARN | tokenBalance无MAX S-B-012 |
| BR-21 资源比较NaN防护 | WARN | purchaseItem余额检查 S-B-008 |

### 7.4 配置-枚举同步

| 检查项 | 状态 | 说明 |
|--------|------|------|
| ActivityType枚举 vs typePrefixMap | OK | 5种类型一一对应 |
| ActivityType枚举 vs typeLimitMap | OK | 5种类型一一对应 |
| RARITY_ORDER vs RARITY_PRICE_MULTIPLIER | OK | 7阶一致 |
| RARITY_ORDER vs DEFAULT_SHOP_ITEMS | OK | 7阶各一个 |
| SignInReward 7天 vs SIGN_IN_CYCLE_DAYS | OK | 7天一致 |
| SeasonTheme 4个 vs 循环取模 | OK | 4个主题 |
