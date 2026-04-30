# Resource（资源）模块对抗式测试报告

## 模块概览

| 文件 | 公开API | 测试文件 |
|------|---------|----------|
| ResourceSystem.ts | tick, addResource, consumeResource, setResource, canAfford, consumeBatch, recalculateProduction, setProductionRate, updateCaps, setCap, getCapWarnings, calculateOfflineEarnings, applyOfflineEarnings, serialize, deserialize, reset | ResourceSystem.adversarial.test.ts |
| copper-economy-system.ts | tick, claimDailyTaskCopper, claimStageClearCopper, purchaseItem, spendOnLevelUp, spendOnStarUp, spendOnBreakthrough, spendOnSkillUpgrade, serialize, deserialize, reset | CopperEconomy.adversarial.test.ts |
| material-economy-system.ts | claimStageBreakthroughStone, sweepStage, buyBreakthroughStone, claimAchievementReward, claimEventBreakthroughReward, claimDailyTaskSkillBook, claimExpeditionReward, claimEventSkillBookReward, claimStageFirstClearSkillBook, serialize, deserialize, reset | MaterialEconomy.adversarial.test.ts |
| OfflineEarningsCalculator.ts | calculateOfflineEarnings, applyEarningsToResources, formatOfflineTime, getOfflineEfficiencyPercent | (含在ResourceSystem测试中) |
| resource-calculator.ts | zeroResources, cloneResources, calculateBonusMultiplier, lookupCap, getWarningLevel, calculateCapWarnings, calculateCapWarning | (含在ResourceSystem测试中) |

## 五维度测试覆盖

### F-Normal: 主线流程完整性
- ✅ tick按速率产出资源
- ✅ 产出速率受加成影响
- ✅ 正常消耗资源
- ✅ 批量消耗原子操作
- ✅ addResource/setResource
- ✅ 被动铜钱产出
- ✅ 日常任务铜钱领取
- ✅ 关卡通关铜钱奖励
- ✅ 商店购买
- ✅ 升级/升星/突破/技能消耗
- ✅ 突破石6种获取途径
- ✅ 技能书5种获取途径

### F-Boundary: 边界条件覆盖
- ✅ 资源达到上限时截断
- ✅ 溢出事件发射
- ✅ 无上限资源不截断
- ✅ 上限降低时截断已有资源
- ✅ 粮草保护：始终保留MIN_GRAIN_RESERVE
- ✅ addResource负数返回0
- ✅ consumeResource负数返回0
- ✅ setResource负数设为0
- ✅ 极大数值不溢出
- ✅ 批量消耗刚好足够/差1不够
- ✅ canAfford精确检查（含粮草保留量）
- ✅ 铜钱安全线以下禁止消耗
- ✅ 商店日消耗上限
- ✅ 商品每日限购
- ✅ 突破石每日限购20个
- ✅ 远征每日2次限制
- ✅ 首通/成就去重

### F-Error: 异常路径覆盖
- ✅ NaN资源值deserialize修正为0
- ✅ 负数资源值deserialize修正为0
- ✅ undefined资源值deserialize修正为0
- ✅ consumeResource NaN防御
- ✅ 版本不匹配兼容加载
- ✅ 空消耗canAfford/consumeBatch
- ✅ 不存在的商品
- ✅ 空heroId/负数等级消耗
- ✅ 未通关关卡扫荡
- ✅ 空关卡ID/远征ID
- ✅ 铜钱不足购买失败
- ✅ economyDeps/materialDeps未设置

### F-Cross: 跨系统交互覆盖
- ✅ 多类型加成乘法叠加
- ✅ 离线收益计算正确
- ✅ 离线收益超过最大时长截断
- ✅ 离线收益应用受上限约束
- ✅ 容量警告正确分级
- ✅ 容量警告只包含有上限资源
- ✅ lookupCap线性外推
- ✅ 消耗分类统计
- ✅ 经济平衡检查
- ✅ 随机数注入影响结果
- ✅ 获取统计累计

### F-Lifecycle: 数据生命周期覆盖
- ✅ 序列化数据完整性
- ✅ 序列化后反序列化状态一致
- ✅ 序列化数据为深拷贝
- ✅ reset恢复初始状态
- ✅ deserialize后执行enforceCaps
- ✅ 每日重置清零日统计
- ✅ 累计统计不受每日重置影响
- ✅ 反序列化null安全

## 重点测试结果

### 资源产出公式
| 场景 | 结果 |
|------|------|
| 小数delta累积精度 | ✅ 通过（CloseTo验证） |
| 零速率不产出 | ✅ 通过 |
| 负速率不消耗 | ✅ 通过（rate<=0被跳过） |
| 长时间tick不超过上限 | ✅ 通过 |

### 上限截断
| 场景 | 结果 |
|------|------|
| 资源达到上限截断 | ✅ 通过 |
| 溢出事件发射 | ✅ 通过 |
| 无上限资源不截断 | ✅ 通过 |
| 上限降低截断已有资源 | ✅ 通过 |
| deserialize后enforceCaps | ✅ 通过 |

### 负数保护
| 场景 | 结果 |
|------|------|
| 消耗超过持有量抛出错误 | ✅ 通过 |
| 粮草始终保留MIN_GRAIN_RESERVE | ✅ 通过 |
| addResource负数返回0 | ✅ 通过 |
| consumeResource负数返回0 | ✅ 通过 |
| setResource负数设为0 | ✅ 通过 |

### 批量消耗原子性
| 场景 | 结果 |
|------|------|
| 部分不足时全部不扣 | ✅ 通过 |
| 成功后数量正确 | ✅ 通过 |
| canAfford与consumeBatch一致 | ✅ 通过 |

### 溢出处理
| 场景 | 结果 |
|------|------|
| 极大数值不溢出 | ✅ 通过 |
| NaN deserialize修正 | ✅ 通过 |
| undefined deserialize修正 | ✅ 通过 |

## 测试统计

| 维度 | 用例数 |
|------|--------|
| F-Normal | 22 |
| F-Boundary | 38 |
| F-Error | 24 |
| F-Cross | 20 |
| F-Lifecycle | 16 |
| **总计** | **120** |
