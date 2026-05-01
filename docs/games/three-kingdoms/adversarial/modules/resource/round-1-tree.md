# Resource 模块 R1 对抗式测试 — Builder 流程树

> 版本: v1.0 | 日期: 2026-05-01 | Builder Agent
> 源码: `src/games/three-kingdoms/engine/resource/` (8 files, 1812 lines)

## 模块概览

| 子系统 | 文件 | 行数 | 职责 |
|--------|------|------|------|
| ResourceSystem | ResourceSystem.ts | 463 | 资源聚合根：状态管理、产出/消耗/上限、序列化 |
| resource-calculator | resource-calculator.ts | 157 | 纯计算：加成乘数、上限查表、容量警告 |
| OfflineEarningsCalculator | OfflineEarningsCalculator.ts | 174 | 离线收益计算（简化版，完整版在 offline 域） |
| CopperEconomySystem | copper-economy-system.ts | 270 | 铜钱经济：被动产出、日常任务、商店、升级消耗 |
| MaterialEconomySystem | material-economy-system.ts | 402 | 材料经济：突破石&技能书获取途径 |
| resource-config | resource-config.ts | 196 | 数值配置常量 |
| resource.types | resource.types.ts | 127 | 类型定义+re-export |
| index | index.ts | 23 | 统一导出 |

---

## 流程树

### F1: ResourceSystem — 资源状态管理

#### F1.1 资源读取
| 节点ID | API | 维度 | 场景 | 优先级 | 状态 |
|--------|-----|------|------|--------|------|
| F1.1-N01 | getResources() | F-Normal | 正常获取所有资源副本 | P2 | covered |
| F1.1-N02 | getAmount(type) | F-Normal | 获取指定资源数量 | P2 | covered |
| F1.1-N03 | getAmount(type) | F-Error | type 为无效 ResourceType | P1 | covered |
| F1.1-N04 | getAmount(type) | F-Boundary | 资源为 0 时返回 0 | P2 | covered |
| F1.1-N05 | getProductionRates() | F-Normal | 获取产出速率副本 | P2 | covered |
| F1.1-N06 | getCaps() | F-Normal | 获取上限副本 | P2 | covered |

#### F1.2 资源产出 (tick)
| 节点ID | API | 维度 | 场景 | 优先级 | 状态 |
|--------|-----|------|------|--------|------|
| F1.2-N01 | tick(deltaMs) | F-Normal | 正常 tick 产出资源 | P2 | covered |
| F1.2-N02 | tick(deltaMs=0) | F-Boundary | deltaMs=0 不产出 | P2 | covered |
| F1.2-N03 | tick(deltaMs<0) | F-Error | 负数 deltaMs | P1 | covered |
| F1.2-N04 | tick(deltaMs=NaN) | F-Error | **NaN deltaMs → deltaSec=NaN → gain=NaN** | **P0** | **uncovered** |
| F1.2-N05 | tick(deltaMs=Infinity) | F-Error | Infinity deltaMs | P1 | covered |
| F1.2-N06 | tick + bonuses | F-Normal | 有加成时产出正确 | P2 | covered |
| F1.2-N07 | tick + bonuses=NaN | F-Error | **bonus value=NaN → multiplier=NaN → gain=NaN** | **P0** | **uncovered** |
| F1.2-N08 | tick + rate=0 | F-Boundary | 速率为 0 时跳过 | P2 | covered |

#### F1.3 资源增加 (addResource)
| 节点ID | API | 维度 | 场景 | 优先级 | 状态 |
|--------|-----|------|------|--------|------|
| F1.3-N01 | addResource(type, amount) | F-Normal | 正常增加资源 | P2 | covered |
| F1.3-N02 | addResource(type, amount=0) | F-Boundary | amount=0 返回 0 | P2 | covered |
| F1.3-N03 | addResource(type, amount<0) | F-Error | 负数 amount 返回 0 | P2 | covered |
| F1.3-N04 | addResource(type, amount=NaN) | F-Error | **NaN amount: `NaN <= 0` = false，绕过守卫** | **P0** | **uncovered** |
| F1.3-N05 | addResource(type, amount=Infinity) | F-Error | Infinity amount + cap | P1 | covered |
| F1.3-N06 | addResource 溢出 | F-Boundary | 超上限截断+事件 | P2 | covered |
| F1.3-N07 | addResource cap=null | F-Normal | 无上限资源不截断 | P2 | covered |
| F1.3-N08 | addResource cap=0 | F-Error | **cap=0 → Math.min(before+amount, 0) → actual=0** | P1 | covered |

#### F1.4 资源消耗 (consumeResource)
| 节点ID | API | 维度 | 场景 | 优先级 | 状态 |
|--------|-----|------|------|--------|------|
| F1.4-N01 | consumeResource(type, amount) | F-Normal | 正常消耗资源 | P2 | covered |
| F1.4-N02 | consumeResource(type, amount=0) | F-Boundary | amount=0 返回 0 | P2 | covered |
| F1.4-N03 | consumeResource(type, amount<0) | F-Error | 负数 amount 返回 0 | P2 | covered |
| F1.4-N04 | consumeResource(grain, amount) | F-Normal | 粮草保护 MIN_GRAIN_RESERVE | P2 | covered |
| F1.4-N05 | consumeResource(grain, amount>available) | F-Error | 粮草不足抛错 | P2 | covered |
| F1.4-N06 | consumeResource(type, amount>current) | F-Error | 普通资源不足抛错 | P2 | covered |
| F1.4-N07 | consumeResource(type, NaN current) | F-Error | **current=NaN → !Number.isFinite(NaN)=true → 抛错** | P1 | covered |
| F1.4-N08 | consumeResource(type, amount=NaN) | F-Error | **amount=NaN → `NaN <= 0` = false，绕过守卫，进入消耗逻辑** | **P0** | **uncovered** |

#### F1.5 直接设置 (setResource)
| 节点ID | API | 维度 | 场景 | 优先级 | 状态 |
|--------|-----|------|------|--------|------|
| F1.5-N01 | setResource(type, amount) | F-Normal | 正常设置 | P2 | covered |
| F1.5-N02 | setResource(type, amount<0) | F-Error | 负值 → Math.max(0, amount) | P2 | covered |
| F1.5-N03 | setResource(type, amount=NaN) | F-Error | **NaN → Math.max(0, NaN) = 0** | P1 | covered |
| F1.5-N04 | setResource(type, amount>cap) | F-Boundary | 超上限截断 | P2 | covered |

#### F1.6 消耗检查 (canAfford)
| 节点ID | API | 维度 | 场景 | 优先级 | 状态 |
|--------|-----|------|------|--------|------|
| F1.6-N01 | canAfford(cost) | F-Normal | 资源充足 | P2 | covered |
| F1.6-N02 | canAfford(cost) | F-Normal | 资源不足 | P2 | covered |
| F1.6-N03 | canAfford(cost) | F-Normal | 粮草扣除保留量 | P2 | covered |
| F1.6-N04 | canAfford(cost=empty) | F-Boundary | 空消耗 canAfford=true | P2 | covered |
| F1.6-N05 | canAfford(cost) + resource=NaN | F-Error | **resource=NaN → NaN < required = false → canAfford=true** | **P0** | **uncovered** |
| F1.6-N06 | canAfford(cost) + cost.value=NaN | F-Error | **cost=NaN → NaN <= 0 = false → 进入比较** | **P0** | **uncovered** |

#### F1.7 批量消耗 (consumeBatch)
| 节点ID | API | 维度 | 场景 | 优先级 | 状态 |
|--------|-----|------|------|--------|------|
| F1.7-N01 | consumeBatch(cost) | F-Normal | 原子批量消耗 | P2 | covered |
| F1.7-N02 | consumeBatch(cost) | F-Error | 资源不足全部回滚 | P2 | covered |
| F1.7-N03 | consumeBatch(cost) + NaN | F-Error | **依赖 canAfford，NaN 绕过 canAfford 后直接扣 NaN** | **P0** | **uncovered** |

#### F1.8 产出速率管理
| 节点ID | API | 维度 | 场景 | 优先级 | 状态 |
|--------|-----|------|------|--------|------|
| F1.8-N01 | recalculateProduction(buildingProductions) | F-Normal | 正常重算产出 | P2 | covered |
| F1.8-N02 | recalculateProduction({}) | F-Boundary | 空输入重置为 0 | P2 | covered |
| F1.8-N03 | recalculateProduction + NaN rate | F-Error | **buildingProductions 含 NaN rate → 产出变 NaN** | **P0** | **uncovered** |
| F1.8-N04 | recalculateProduction + unknown key | F-Error | 未知资源类型键被忽略 | P1 | covered |
| F1.8-N05 | setProductionRate(type, rate) | F-Normal | 直接设置速率 | P2 | covered |
| F1.8-N06 | setProductionRate(type, NaN) | F-Error | **NaN rate → tick 产出 NaN** | **P0** | **uncovered** |

#### F1.9 上限管理
| 节点ID | API | 维度 | 场景 | 优先级 | 状态 |
|--------|-----|------|------|--------|------|
| F1.9-N01 | updateCaps(level, level) | F-Normal | 正常更新上限 | P2 | covered |
| F1.9-N02 | updateCaps + level=0 | F-Boundary | 等级 0 查表 | P1 | covered |
| F1.9-N03 | updateCaps + level<0 | F-Error | 负等级查表 | P1 | covered |
| F1.9-N04 | updateCaps + level=NaN | F-Error | **NaN 等级查表 → lookupCap 内排序异常** | **P0** | **uncovered** |
| F1.9-N05 | setCap(type, cap) | F-Normal | 设置上限 | P2 | covered |
| F1.9-N06 | setCap + cap 降低 | F-Boundary | 上限降低截断溢出 | P2 | covered |
| F1.9-N07 | enforceCaps | F-Normal | 截断超出上限资源 | P2 | covered |

#### F1.10 容量警告
| 节点ID | API | 维度 | 场景 | 优先级 | 状态 |
|--------|-----|------|------|--------|------|
| F1.10-N01 | getCapWarnings() | F-Normal | 正常获取警告 | P2 | covered |
| F1.10-N02 | getCapWarning(type) | F-Normal | 单资源警告 | P2 | covered |
| F1.10-N03 | getCapWarning + resource=NaN | F-Error | **NaN / cap = NaN → getWarningLevel(NaN)** | P1 | covered |
| F1.10-N04 | getCapWarning + cap=0 | F-Error | **current / 0 = Infinity → getWarningLevel(Infinity)** | P1 | covered |

#### F1.11 离线收益
| 节点ID | API | 维度 | 场景 | 优先级 | 状态 |
|--------|-----|------|------|--------|------|
| F1.11-N01 | calculateOfflineEarnings(seconds) | F-Normal | 正常计算 | P2 | covered |
| F1.11-N02 | calculateOfflineEarnings(seconds=0) | F-Boundary | 0 秒无收益 | P2 | covered |
| F1.11-N03 | calculateOfflineEarnings(seconds>MAX) | F-Boundary | 超过 72h 截断 | P2 | covered |
| F1.11-N04 | calculateOfflineEarnings(seconds=NaN) | F-Error | **NaN > OFFLINE_MAX_SECONDS = false → effectiveSeconds=NaN** | **P0** | **uncovered** |
| F1.11-N05 | applyOfflineEarnings | F-Normal | 正常应用 | P2 | covered |
| F1.11-N06 | applyOfflineEarnings + NaN | F-Error | NaN 收益进入 addResource | P1 | covered |

#### F1.12 序列化/反序列化
| 节点ID | API | 维度 | 场景 | 优先级 | 状态 |
|--------|-----|------|------|--------|------|
| F1.12-N01 | serialize() | F-Normal | 正常序列化 | P2 | covered |
| F1.12-N02 | deserialize(data) | F-Normal | 正常反序列化 | P2 | covered |
| F1.12-N03 | deserialize(data) + NaN values | F-Error | **NaN 资源值 → Math.max(0, NaN)=0 → 静默丢失** | P1 | covered |
| F1.12-N04 | deserialize(data) + undefined fields | F-Error | undefined 字段处理 | P1 | covered |
| F1.12-N05 | deserialize(data) + version mismatch | F-Normal | 版本不匹配兼容加载 | P2 | covered |
| F1.12-N06 | deserialize(null) | F-Error | **null 输入 → 崩溃** | **P0** | **uncovered** |
| F1.12-N07 | deserialize(undefined) | F-Error | **undefined 输入 → 崩溃** | **P0** | **uncovered** |

#### F1.13 重置
| 节点ID | API | 维度 | 场景 | 优先级 | 状态 |
|--------|-----|------|------|--------|------|
| F1.13-N01 | reset() | F-Normal | 正常重置到初始值 | P2 | covered |
| F1.13-N02 | reset() 后 getResources() | F-Normal | 重置后资源正确 | P2 | covered |

---

### F2: resource-calculator — 纯计算函数

#### F2.1 辅助工厂
| 节点ID | API | 维度 | 场景 | 优先级 | 状态 |
|--------|-----|------|------|--------|------|
| F2.1-N01 | zeroResources() | F-Normal | 创建全零资源对象 | P2 | covered |
| F2.1-N02 | cloneResources(r) | F-Normal | 正常克隆 | P2 | covered |
| F2.1-N03 | cloneResources(null) | F-Error | **null 输入 → 崩溃** | **P0** | **uncovered** |

#### F2.2 加成计算
| 节点ID | API | 维度 | 场景 | 优先级 | 状态 |
|--------|-----|------|------|--------|------|
| F2.2-N01 | calculateBonusMultiplier(bonuses) | F-Normal | 正常加成计算 | P2 | covered |
| F2.2-N02 | calculateBonusMultiplier(undefined) | F-Boundary | 无加成返回 1 | P2 | covered |
| F2.2-N03 | calculateBonusMultiplier({tech: NaN}) | F-Error | **NaN bonus → 1+NaN=NaN → multiplier=NaN** | **P0** | **uncovered** |
| F2.2-N04 | calculateBonusMultiplier({tech: -1}) | F-Error | **-1 bonus → 1+(-1)=0 → multiplier=0 → 产出归零** | P1 | covered |
| F2.2-N05 | calculateBonusMultiplier({tech: Infinity}) | F-Error | Infinity bonus | P1 | covered |

#### F2.3 上限查表 (lookupCap)
| 节点ID | API | 维度 | 场景 | 优先级 | 状态 |
|--------|-----|------|------|--------|------|
| F2.3-N01 | lookupCap(level, 'granary') | F-Normal | 正常查表 | P2 | covered |
| F2.3-N02 | lookupCap(level=1, table) | F-Boundary | 最低等级 | P2 | covered |
| F2.3-N03 | lookupCap(level=30, table) | F-Boundary | 最高定义等级 | P2 | covered |
| F2.3-N04 | lookupCap(level=100, table) | F-Boundary | 超过最大等级线性外推 | P1 | covered |
| F2.3-N05 | lookupCap(level=0, table) | F-Error | **level=0 → keys 全部 > 0 → result=capacityTable[1]** | P1 | covered |
| F2.3-N06 | lookupCap(level=NaN, table) | F-Error | **NaN level → key<=NaN 永远 false → result=capacityTable[1]** | P1 | covered |
| F2.3-N07 | lookupCap(level=-1, table) | F-Error | 负等级 | P1 | covered |

#### F2.4 容量警告
| 节点ID | API | 维度 | 场景 | 优先级 | 状态 |
|--------|-----|------|------|--------|------|
| F2.4-N01 | getWarningLevel(percentage) | F-Normal | 各阈值正确 | P2 | covered |
| F2.4-N02 | getWarningLevel(NaN) | F-Error | **NaN → 所有比较返回 false → 返回 'safe'** | P1 | covered |
| F2.4-N03 | getWarningLevel(Infinity) | F-Error | Infinity → 'full' | P1 | covered |
| F2.4-N04 | getWarningLevel(-1) | F-Error | 负百分比 | P1 | covered |
| F2.4-N05 | calculateCapWarnings | F-Normal | 正常计算 | P2 | covered |
| F2.4-N06 | calculateCapWarning(type) + cap=null | F-Boundary | 无上限返回 null | P2 | covered |

---

### F3: OfflineEarningsCalculator — 离线收益

#### F3.1 计算离线收益
| 节点ID | API | 维度 | 场景 | 优先级 | 状态 |
|--------|-----|------|------|--------|------|
| F3.1-N01 | calculateOfflineEarnings(seconds, rates) | F-Normal | 正常计算 | P2 | covered |
| F3.1-N02 | calculateOfflineEarnings(seconds=0) | F-Boundary | 0 秒无收益 | P2 | covered |
| F3.1-N03 | calculateOfflineEarnings(seconds=NaN) | F-Error | **NaN > OFFLINE_MAX_SECONDS = false → effectiveSeconds=NaN → Math.min(NaN, MAX)=NaN** | **P0** | **uncovered** |
| F3.1-N04 | calculateOfflineEarnings(seconds<0) | F-Error | 负秒数 | P1 | covered |
| F3.1-N05 | calculateOfflineEarnings + rate=NaN | F-Error | **NaN rate → gain=NaN → earned 全 NaN** | **P0** | **uncovered** |
| F3.1-N06 | calculateOfflineEarnings + Infinity seconds | F-Boundary | 超过 MAX 截断 | P2 | covered |

#### F3.2 应用收益到资源
| 节点ID | API | 维度 | 场景 | 优先级 | 状态 |
|--------|-----|------|------|--------|------|
| F3.2-N01 | applyEarningsToResources(current, earnings, caps) | F-Normal | 正常叠加 | P2 | covered |
| F3.2-N02 | applyEarningsToResources + NaN earnings | F-Error | NaN 收益叠加 | P1 | covered |
| F3.2-N03 | applyEarningsToResources + cap 截断 | F-Boundary | 超上限截断 | P2 | covered |

#### F3.3 工具方法
| 节点ID | API | 维度 | 场景 | 优先级 | 状态 |
|--------|-----|------|------|--------|------|
| F3.3-N01 | formatOfflineTime(seconds) | F-Normal | 正常格式化 | P2 | covered |
| F3.3-N02 | formatOfflineTime(0) | F-Boundary | "刚刚" | P2 | covered |
| F3.3-N03 | formatOfflineTime(NaN) | F-Error | **NaN → NaN <= 0 = false → NaN < 60 = false → minutes=NaN** | P1 | covered |
| F3.3-N04 | getOfflineEfficiencyPercent(seconds) | F-Normal | 正常效率 | P2 | covered |
| F3.3-N05 | getOfflineEfficiencyPercent(NaN) | F-Error | **NaN <= 0 = false → clamped=NaN → totalEffective=NaN → NaN/NaN=NaN** | P1 | covered |

---

### F4: CopperEconomySystem — 铜钱经济

#### F4.1 被动产出
| 节点ID | API | 维度 | 场景 | 优先级 | 状态 |
|--------|-----|------|------|--------|------|
| F4.1-N01 | tick(deltaSeconds) | F-Normal | 正常被动产出 | P2 | covered |
| F4.1-N02 | tick(deltaSeconds=0) | F-Boundary | 0 秒不产出 | P2 | covered |
| F4.1-N03 | tick(deltaSeconds<0) | F-Error | 负数秒守卫 | P2 | covered |
| F4.1-N04 | tick(deltaSeconds=NaN) | F-Error | **NaN → NaN <= 0 = false → earned=NaN → addGold(NaN)** | **P0** | **uncovered** |
| F4.1-N05 | tick + economyDeps=null | F-Error | deps 未注入 | P1 | covered |

#### F4.2 日常任务
| 节点ID | API | 维度 | 场景 | 优先级 | 状态 |
|--------|-----|------|------|--------|------|
| F4.2-N01 | claimDailyTaskCopper() | F-Normal | 正常领取 | P2 | covered |
| F4.2-N02 | claimDailyTaskCopper() x2 | F-Error | 重复领取返回 0 | P2 | covered |
| F4.2-N03 | claimDailyTaskCopper + economyDeps=null | F-Error | deps 未注入 | P1 | covered |

#### F4.3 关卡通关
| 节点ID | API | 维度 | 场景 | 优先级 | 状态 |
|--------|-----|------|------|--------|------|
| F4.3-N01 | claimStageClearCopper(level) | F-Normal | 正常领取 | P2 | covered |
| F4.3-N02 | claimStageClearCopper(level=0) | F-Error | level<1 返回 0 | P2 | covered |
| F4.3-N03 | claimStageClearCopper(level=NaN) | F-Error | **NaN < 1 = false → reward=NaN → addGold(NaN)** | **P0** | **uncovered** |
| F4.3-N04 | claimStageClearCopper(level=Infinity) | F-Error | Infinity level | P1 | covered |

#### F4.4 商店购买
| 节点ID | API | 维度 | 场景 | 优先级 | 状态 |
|--------|-----|------|------|--------|------|
| F4.4-N01 | purchaseItem(itemId, count) | F-Normal | 正常购买 | P2 | covered |
| F4.4-N02 | purchaseItem(itemId, count=0) | F-Error | count<=0 返回 false | P2 | covered |
| F4.4-N03 | purchaseItem + 日限购 | F-Boundary | 超日限购拒绝 | P2 | covered |
| F4.4-N04 | purchaseItem + 日消费上限 | F-Boundary | 超日消费上限拒绝 | P2 | covered |
| F4.4-N05 | purchaseItem + 安全线 | F-Boundary | 低于安全线拒绝 | P2 | covered |
| F4.4-N06 | purchaseItem(itemId=invalid) | F-Error | 无效物品 | P2 | covered |
| F4.4-N07 | purchaseItem + NaN count | F-Error | **NaN <= 0 = false → totalCost=NaN → NaN < SAFETY_LINE = false** | **P0** | **uncovered** |
| F4.4-N08 | purchaseItem + NaN price | F-Error | item price 为 NaN（配置问题） | P1 | covered |

#### F4.5 升级消耗
| 节点ID | API | 维度 | 场景 | 优先级 | 状态 |
|--------|-----|------|------|--------|------|
| F4.5-N01 | spendOnLevelUp(heroId, level) | F-Normal | 正常消耗 | P2 | covered |
| F4.5-N02 | spendOnLevelUp(heroId='', level) | F-Error | 空 heroId | P2 | covered |
| F4.5-N03 | spendOnLevelUp(heroId, level=NaN) | F-Error | **NaN level → lookupLevelUpGold(NaN) → NaN < levelMin = false → NaN > levelMax = false → NaN * goldPerLevel = NaN** | **P0** | **uncovered** |
| F4.5-N04 | spendOnStarUp(heroId, star) | F-Normal | 正常消耗 | P2 | covered |
| F4.5-N05 | spendOnStarUp(heroId, star=NaN) | F-Error | **NaN star → Math.min(NaN, len) = NaN → STAR_UP_GOLD_COST[NaN] = undefined** | P1 | covered |
| F4.5-N06 | spendOnBreakthrough(heroId, stage) | F-Normal | 正常消耗 | P2 | covered |
| F4.5-N07 | spendOnBreakthrough(heroId, stage=NaN) | F-Error | NaN stage | P1 | covered |
| F4.5-N08 | spendOnSkillUpgrade(heroId, skillLevel) | F-Normal | 正常消耗 | P2 | covered |
| F4.5-N09 | spendOnSkillUpgrade(heroId, skillLevel=NaN) | F-Error | NaN skillLevel | P1 | covered |

#### F4.6 序列化
| 节点ID | API | 维度 | 场景 | 优先级 | 状态 |
|--------|-----|------|------|--------|------|
| F4.6-N01 | serialize() | F-Normal | 正常序列化 | P2 | covered |
| F4.6-N02 | deserialize(data) | F-Normal | 正常反序列化 | P2 | covered |
| F4.6-N03 | deserialize(null) | F-Error | **null 输入 → 崩溃** | **P0** | **uncovered** |
| F4.6-N04 | deserialize({}) | F-Error | 空对象使用默认值 | P1 | covered |
| F4.6-N05 | deserialize + NaN values | F-Error | NaN 统计值 | P1 | covered |

#### F4.7 日重置
| 节点ID | API | 维度 | 场景 | 优先级 | 状态 |
|--------|-----|------|------|--------|------|
| F4.7-N01 | checkDailyReset | F-Normal | 跨日重置 | P2 | covered |
| F4.7-N02 | checkDailyReset + 同日 | F-Normal | 同日不重置 | P2 | covered |

---

### F5: MaterialEconomySystem — 材料经济

#### F5.1 突破石获取
| 节点ID | API | 维度 | 场景 | 优先级 | 状态 |
|--------|-----|------|------|--------|------|
| F5.1-N01 | claimStageBreakthroughStone(stageId) | F-Normal | 正常掉落 | P2 | covered |
| F5.1-N02 | claimStageBreakthroughStone('') | F-Error | 空 stageId | P2 | covered |
| F5.1-N03 | sweepStage(stageId) | F-Normal | 正常扫荡 | P2 | covered |
| F5.1-N04 | sweepStage + 未通关关卡 | F-Error | 未通关关卡拒绝 | P2 | covered |
| F5.1-N05 | sweepStage + 50%概率 | F-Boundary | 概率判定 | P2 | covered |
| F5.1-N06 | buyBreakthroughStone(count) | F-Normal | 正常购买 | P2 | covered |
| F5.1-N07 | buyBreakthroughStone(count=0) | F-Error | count<=0 拒绝 | P2 | covered |
| F5.1-N08 | buyBreakthroughStone + 超日限购 | F-Boundary | 超限拒绝 | P2 | covered |
| F5.1-N09 | buyBreakthroughStone(NaN count) | F-Error | **NaN <= 0 = false → NaN > DAILY_BUY_LIMIT = false → totalCost=NaN** | **P0** | **uncovered** |
| F5.1-N10 | claimAchievementReward(id) | F-Normal | 正常领取 | P2 | covered |
| F5.1-N11 | claimAchievementReward(id) x2 | F-Error | 重复领取拒绝 | P2 | covered |
| F5.1-N12 | claimAchievementReward(invalid) | F-Error | 无效 ID | P2 | covered |
| F5.1-N13 | claimEventBreakthroughReward() | F-Normal | 正常活动奖励 | P2 | covered |

#### F5.2 技能书获取
| 节点ID | API | 维度 | 场景 | 优先级 | 状态 |
|--------|-----|------|------|--------|------|
| F5.2-N01 | claimDailyTaskSkillBook() | F-Normal | 正常领取 | P2 | covered |
| F5.2-N02 | claimDailyTaskSkillBook() x2 | F-Error | 重复领取拒绝 | P2 | covered |
| F5.2-N03 | claimExpeditionReward(id) | F-Normal | 正常远征 | P2 | covered |
| F5.2-N04 | claimExpeditionReward + 超次数 | F-Boundary | 超每日次数拒绝 | P2 | covered |
| F5.2-N05 | claimEventSkillBookReward() | F-Normal | 正常活动奖励 | P2 | covered |
| F5.2-N06 | claimStageFirstClearSkillBook(stageId) | F-Normal | 正常首通 | P2 | covered |
| F5.2-N07 | claimStageFirstClearSkillBook(stageId) x2 | F-Error | 重复首通拒绝 | P2 | covered |

#### F5.3 序列化
| 节点ID | API | 维度 | 场景 | 优先级 | 状态 |
|--------|-----|------|------|--------|------|
| F5.3-N01 | serialize() | F-Normal | 正常序列化 | P2 | covered |
| F5.3-N02 | deserialize(data) | F-Normal | 正常反序列化 | P2 | covered |
| F5.3-N03 | deserialize(null) | F-Error | **null 输入 → 崩溃** | **P0** | **uncovered** |
| F5.3-N04 | deserialize({}) | F-Error | 空对象使用默认值 | P1 | covered |
| F5.3-N05 | deserialize + NaN values | F-Error | NaN 统计值 | P1 | covered |

#### F5.4 日重置
| 节点ID | API | 维度 | 场景 | 优先级 | 状态 |
|--------|-----|------|------|--------|------|
| F5.4-N01 | checkDailyReset | F-Normal | 跨日重置 | P2 | covered |
| F5.4-N02 | checkDailyReset + 同日 | F-Normal | 同日不重置 | P2 | covered |

---

### F6: 跨系统链路 (F-Cross)

| 节点ID | 链路 | 场景 | 优先级 | 状态 |
|--------|------|------|--------|------|
| F6-N01 | ResourceSystem.tick → addResource → cap 截断 → eventBus.emit | 产出-上限-事件闭环 | P2 | covered |
| F6-N02 | ResourceSystem → OfflineEarningsCalculator → addResource | 离线收益应用 | P2 | covered |
| F6-N03 | BuildingSystem → recalculateProduction → ResourceSystem.tick | 建筑-产出链路 | P2 | covered |
| F6-N04 | CopperEconomySystem → economyDeps.addGold → ResourceSystem.addResource | 铜钱经济注入链路 | P2 | covered |
| F6-N05 | MaterialEconomySystem → materialDeps.consumeGold → ResourceSystem.consumeResource | 材料经济消耗链路 | P2 | covered |
| F6-N06 | engine-save → ResourceSystem.serialize/deserialize | 存档完整性 | P1 | covered |
| F6-N07 | engine-save → CopperEconomySystem.serialize/deserialize | **铜钱经济存档完整性** | P1 | covered |
| F6-N08 | engine-save → MaterialEconomySystem.serialize/deserialize | **材料经济存档完整性** | P1 | covered |
| F6-N09 | ResourceSystem.deserialize + NaN → enforceCaps → NaN > cap | **NaN 资源绕过上限** | **P0** | **uncovered** |
| F6-N10 | CopperEconomySystem.trySpend → economyDeps.consumeGold 失败 | 消耗失败无回滚 | P1 | covered |

---

### F7: 生命周期 (F-Lifecycle)

| 节点ID | 场景 | 优先级 | 状态 |
|--------|------|--------|------|
| F7-N01 | ResourceSystem 构造 → init → tick → serialize → deserialize → reset | 完整生命周期 | P2 | covered |
| F7-N02 | CopperEconomySystem 构造 → setEconomyDeps → tick → serialize → deserialize | 完整生命周期 | P2 | covered |
| F7-N03 | MaterialEconomySystem 构造 → setMaterialDeps → claim* → serialize → deserialize | 完整生命周期 | P2 | covered |
| F7-N04 | 未调用 init/deps 注入直接使用 | **P0** | **uncovered** |
| F7-N05 | 多次 deserialize 不泄漏状态 | P1 | covered |
| F7-N06 | reset 后 serialize 输出正确 | P2 | covered |

---

## 统计

| 维度 | 节点数 | P0 | P1 | P2 |
|------|--------|-----|-----|-----|
| F1: ResourceSystem | 58 | 12 | 10 | 36 |
| F2: resource-calculator | 18 | 2 | 8 | 8 |
| F3: OfflineEarningsCalculator | 14 | 3 | 4 | 7 |
| F4: CopperEconomySystem | 31 | 5 | 6 | 20 |
| F5: MaterialEconomySystem | 24 | 2 | 3 | 19 |
| F6: F-Cross | 10 | 1 | 4 | 5 |
| F7: F-Lifecycle | 6 | 1 | 1 | 4 |
| **总计** | **161** | **26** | **36** | **99** |

### API 覆盖率
- ResourceSystem: 100% (所有公开方法)
- resource-calculator: 100% (所有导出函数)
- OfflineEarningsCalculator: 100% (所有导出函数)
- CopperEconomySystem: 100% (所有公开方法)
- MaterialEconomySystem: 100% (所有公开方法)

### P0 聚类分析

| P0 类别 | 数量 | 关联模式 |
|---------|------|----------|
| NaN 绕过 `<= 0` 守卫 | 12 | 模式9/21 |
| NaN 传播到计算链 | 6 | 模式2/9 |
| null/undefined deserialize 崩溃 | 4 | 模式1 |
| NaN 资源比较绕过 canAfford | 2 | 模式21 |
| 未注入 deps 直接使用 | 1 | 模式12 |
| NaN 离线收益计算 | 1 | 模式2 |
