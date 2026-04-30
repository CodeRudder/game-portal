# Hero 流程分支树 Round 1 — Part A（核心子系统）

> Builder: TreeBuilder | Time: 2026-05-01 | Scope: 10 core files

## 统计
| 指标 | 数值 |
|------|------|
| 源文件数 | 10 |
| 公开API数 | 118 |
| 总节点数 | 245 |
| P0节点 | 72 |
| P1节点 | 98 |
| P2节点 | 75 |

---

## 子系统 1: HeroSystem（武将系统主类）

**源文件**: `HeroSystem.ts`
**公开API**: 35个
**职责**: 武将状态管理、战力计算、碎片管理、序列化

### API列表
| # | 方法名 | 参数 | 返回值 | 说明 |
|---|--------|------|--------|------|
| 1 | setLevelCapGetter | fn | void | 注入等级上限回调 |
| 2 | setEquipmentPowerGetter | fn | void | 注入装备战力回调 |
| 3 | setBondMultiplierGetter | fn | void | 注入羁绊系数回调 |
| 4 | getMaxLevel | generalId | number | 获取武将等级上限 |
| 5 | init | deps | void | ISubsystem初始化 |
| 6 | update | dt | void | 帧更新（空） |
| 7 | getState | — | unknown | 获取状态快照 |
| 8 | reset | — | void | 重置为空状态 |
| 9 | addGeneral | generalId | GeneralData\|null | 添加武将 |
| 10 | removeGeneral | generalId | GeneralData\|null | 移除武将 |
| 11 | getGeneral | generalId | Readonly\<GeneralData\>\|undefined | 查询单个武将 |
| 12 | getAllGenerals | — | Readonly\<GeneralData\>[] | 查询全部武将 |
| 13 | hasGeneral | generalId | boolean | 武将是否已拥有 |
| 14 | getGeneralCount | — | number | 武将总数 |
| 15 | calculatePower | general, star?, equip?, bond? | number | 计算单个武将战力 |
| 16 | calculateTotalPower | — | number | 全体武将总战力 |
| 17 | calculateFormationPower | generalIds[], getStar?, bond? | number | 编队战力 |
| 18 | addFragment | generalId, count | number | 增加碎片 |
| 19 | useFragments | generalId, count | boolean | 消耗碎片 |
| 20 | getFragments | generalId | number | 查询碎片数 |
| 21 | getAllFragments | — | Record\<string,number\> | 查询全部碎片 |
| 22 | handleDuplicate | generalId, quality | number | 重复武将处理 |
| 23 | fragmentSynthesize | generalId | GeneralData\|null | 碎片合成武将 |
| 24 | getSynthesizeCost | generalId | number | 合成所需碎片数 |
| 25 | canSynthesize | generalId | boolean | 是否可合成 |
| 26 | getSynthesizeProgress | generalId | {current,required} | 合成进度 |
| 27 | getExpRequired | level | number | 等级所需经验 |
| 28 | getGoldRequired | level | number | 等级所需金币 |
| 29 | setLevelAndExp | generalId, level, exp | GeneralData\|undefined | 直接设置等级经验 |
| 30 | updateSkillLevel | generalId, skillIndex, newLevel | GeneralData\|undefined | 更新技能等级 |
| 31 | addExp | generalId, exp | {general,levelsGained}\|null | 增加经验 |
| 32 | getGeneralsByFaction | faction | GeneralData[] | 按阵营筛选 |
| 33 | getGeneralsByQuality | quality | GeneralData[] | 按品质筛选 |
| 34 | getGeneralsSortedByPower | descending? | GeneralData[] | 按战力排序 |
| 35 | serialize/deserialize | — | HeroSaveData/void | 序列化 |

### F-Normal
| ID | API | Description | Precondition | Expected | Status | Priority |
|----|-----|-------------|--------------|----------|--------|----------|
| HS-N01 | addGeneral | 添加已有武将 | 武将未拥有 | 返回GeneralData | covered | P0 |
| HS-N02 | addGeneral | 添加已拥有武将 | 武将已存在 | 返回null | covered | P0 |
| HS-N03 | removeGeneral | 移除已拥有武将 | 武将存在 | 返回GeneralData | covered | P1 |
| HS-N04 | getGeneral | 查询存在的武将 | 武将存在 | 返回GeneralData | covered | P0 |
| HS-N05 | calculatePower | 计算战力（含装备+羁绊） | 注入回调 | 正确战力值 | covered | P0 |
| HS-N06 | calculateTotalPower | 计算全体战力 | 多武将 | 总和正确 | covered | P1 |
| HS-N07 | addFragment/useFragments | 碎片增减循环 | 碎片充足 | 余额正确 | covered | P0 |
| HS-N08 | handleDuplicate | 重复武将转碎片 | quality=LEGENDARY | 返回碎片数 | covered | P0 |
| HS-N09 | fragmentSynthesize | 碎片合成新武将 | 碎片充足 | 返回新武将 | covered | P0 |
| HS-N10 | addExp | 经验增加升级 | exp足够升级 | levelsGained>0 | covered | P0 |
| HS-N11 | serialize/deserialize | 序列化往返 | 有武将数据 | 数据一致 | covered | P0 |

### F-Boundary
| ID | API | Description | Precondition | Expected | Status | Priority |
|----|-----|-------------|--------------|----------|--------|----------|
| HS-B01 | addGeneral | generalId不存在 | 无效ID | 返回null | covered | P0 |
| HS-B02 | calculatePower | star=0/负值 | 非法星级 | NaN或0 | uncovered | P0 |
| HS-B03 | calculatePower | equipmentPower=NaN | NaN注入 | NaN传播检查 | uncovered | P0 |
| HS-B04 | addFragment | count=0 | 零碎片 | 无变化 | covered | P1 |
| HS-B05 | useFragments | 碎片恰好等于消耗 | 边界值 | 余额=0 | covered | P1 |
| HS-B06 | fragmentSynthesize | 碎片刚好够 | 精确边界 | 成功 | covered | P1 |
| HS-B07 | addExp | exp=0 | 零经验 | 无升级 | covered | P1 |
| HS-B08 | getExpRequired | level=MAX_LEVEL | 最大等级 | 返回配置值 | covered | P2 |
| HS-B09 | setLevelAndExp | level超过MAX_LEVEL | 超限等级 | 行为待验证 | uncovered | P0 |
| HS-B10 | updateSkillLevel | skillIndex越界 | 无效索引 | 返回undefined | uncovered | P1 |
| HS-B11 | getMaxLevel | _getLevelCap未注入 | null回调 | fallback HERO_MAX_LEVEL | covered | P1 |

### F-Error
| ID | API | Description | Precondition | Expected | Status | Priority |
|----|-----|-------------|--------------|----------|--------|----------|
| HS-E01 | addGeneral | generalId=null | null输入 | 不崩溃 | uncovered | P0 |
| HS-E02 | addGeneral | generalId=undefined | undefined | 不崩溃 | uncovered | P0 |
| HS-E03 | addFragment | count=负数 | 负值 | 拒绝或0 | uncovered | P0 |
| HS-E04 | useFragments | count=负数 | 负值消耗 | 拒绝 | uncovered | P0 |
| HS-E05 | useFragments | 碎片不足 | 不足 | 返回false | covered | P0 |
| HS-E06 | calculatePower | general=null | null输入 | NaN或崩溃 | uncovered | P0 |
| HS-E07 | deserialize | data=null | null存档 | 崩溃检查 | uncovered | P0 |
| HS-E08 | addExp | exp=NaN | NaN输入 | NaN传播检查 | uncovered | P0 |
| HS-E09 | handleDuplicate | quality=undefined | 缺失品质 | 崩溃检查 | uncovered | P1 |

### F-Cross
| ID | API | Description | Precondition | Expected | Status | Priority |
|----|-----|-------------|--------------|----------|--------|----------|
| HS-C01 | calculatePower | 装备战力回调注入 | setEquipmentPowerGetter | 装备加成生效 | covered | P0 |
| HS-C02 | calculatePower | 羁绊系数回调注入 | setBondMultiplierGetter | 羁绊加成生效 | covered | P0 |
| HS-C03 | getMaxLevel | 星级系统回调注入 | setLevelCapGetter | 返回星级上限 | covered | P0 |
| HS-C04 | fragmentSynthesize→addGeneral | 合成后武将加入 | 碎片足够 | 武将出现在getAllGenerals | covered | P0 |
| HS-C05 | handleDuplicate→addFragment | 重复武将转碎片 | 已有武将 | 碎片增加 | covered | P0 |

### F-Lifecycle
| ID | API | Description | Precondition | Expected | Status | Priority |
|----|-----|-------------|--------------|----------|--------|----------|
| HS-L01 | init→reset→getState | 初始化后重置 | 正常流程 | 空状态 | covered | P1 |
| HS-L02 | serialize→deserialize→serialize | 序列化往返一致性 | 有数据 | 两次序列化相同 | covered | P0 |
| HS-L03 | addGeneral→removeGeneral→addGeneral | 添加-删除-再添加 | 正常流程 | 可再添加 | covered | P1 |

---

## 子系统 2: HeroLevelSystem（武将等级系统）

**源文件**: `HeroLevelSystem.ts`
**公开API**: 18个
**职责**: 经验管理、升级消耗计算、一键强化、批量强化

### API列表
| # | 方法名 | 参数 | 返回值 | 说明 |
|---|--------|------|--------|------|
| 1 | init | deps | void | ISubsystem初始化 |
| 2 | update | dt | void | 帧更新（空） |
| 3 | getState | — | unknown | 状态快照 |
| 4 | reset | — | void | 重置 |
| 5 | setLevelDeps | LevelDeps | void | 注入依赖 |
| 6 | getHeroMaxLevel | generalId | number | 获取等级上限 |
| 7 | calculateExpToNextLevel | level, generalId? | number | 下一级经验 |
| 8 | calculateLevelUpCost | level, generalId? | number | 升级消耗 |
| 9 | calculateTotalExp | from, to, generalId? | number | 区间总经验 |
| 10 | calculateTotalGold | from, to, generalId? | number | 区间总金币 |
| 11 | addExp | generalId, amount | LevelUpResult\|null | 增加经验 |
| 12 | levelUp | generalId | LevelUpResult\|null | 单次升级 |
| 13 | getEnhancePreview | generalId, targetLevel | EnhancePreview\|null | 强化预览 |
| 14 | quickEnhance | generalId, targetLevel? | LevelUpResult\|null | 一键强化 |
| 15 | quickEnhanceAll | targetLevel? | BatchEnhanceResult | 批量强化全部 |
| 16 | getBatchEnhancePreview | targetLevel?, limit? | EnhancePreview[] | 批量预览 |
| 17 | calculateMaxAffordableLevel | general | number | 最大可负担等级 |
| 18 | getExpProgress | generalId | {current,required,pct}\|null | 经验进度 |
| 19 | canLevelUp | generalId | boolean | 是否可升级 |
| 20 | getUpgradableGeneralIds | — | string[] | 可升级武将列表 |
| 21 | serialize/deserialize | — | LevelSaveData/void | 序列化 |

### F-Normal
| ID | API | Description | Precondition | Expected | Status | Priority |
|----|-----|-------------|--------------|----------|--------|----------|
| HL-N01 | addExp | 经验增加未升级 | 经验不足一级 | levelsGained=0 | covered | P0 |
| HL-N02 | addExp | 经验增加触发升级 | 经验足够 | levelsGained>=1 | covered | P0 |
| HL-N03 | levelUp | 正常升级 | 资源充足 | 返回LevelUpResult | covered | P0 |
| HL-N04 | quickEnhance | 一键强化到目标等级 | 资源充足 | 正确等级 | covered | P0 |
| HL-N05 | quickEnhanceAll | 批量强化全部 | 多武将可升级 | BatchEnhanceResult | covered | P1 |
| HL-N06 | getEnhancePreview | 预览强化信息 | 有效武将 | 正确预览 | covered | P1 |
| HL-N07 | calculateTotalExp | 计算区间经验 | from<to | 正确总值 | covered | P0 |
| HL-N08 | canLevelUp | 可升级判断 | 资源充足 | true | covered | P1 |
| HL-N09 | getExpProgress | 经验进度查询 | 有效武将 | 正确百分比 | covered | P1 |

### F-Boundary
| ID | API | Description | Precondition | Expected | Status | Priority |
|----|-----|-------------|--------------|----------|--------|----------|
| HL-B01 | addExp | 经验恰好升级 | 精确边界 | levelsGained=1 | covered | P1 |
| HL-B02 | levelUp | 当前等级=MAX_LEVEL | 已满级 | 返回null | covered | P0 |
| HL-B03 | quickEnhance | targetLevel=当前等级 | 无升级空间 | 返回null | covered | P1 |
| HL-B04 | calculateTotalExp | from=to | 零区间 | 返回0 | covered | P1 |
| HL-B05 | calculateTotalExp | from>to | 反向区间 | 返回0或负值检查 | uncovered | P0 |
| HL-B06 | calculateMaxAffordableLevel | 资源为0 | 无资源 | 返回当前等级 | covered | P1 |
| HL-B07 | getUpgradableGeneralIds | 无可升级武将 | 全满级 | 返回空数组 | covered | P2 |

### F-Error
| ID | API | Description | Precondition | Expected | Status | Priority |
|----|-----|-------------|--------------|----------|--------|----------|
| HL-E01 | addExp | generalId不存在 | 无效ID | 返回null | covered | P0 |
| HL-E02 | addExp | amount=负数 | 负经验 | 拒绝或0 | uncovered | P0 |
| HL-E03 | addExp | amount=NaN | NaN经验 | NaN传播检查 | uncovered | P0 |
| HL-E04 | levelUp | deps未注入 | null deps | 返回null | covered | P0 |
| HL-E05 | quickEnhance | generalId=null | null输入 | 不崩溃 | uncovered | P0 |
| HL-E06 | calculateTotalExp | from=NaN | NaN输入 | NaN传播 | uncovered | P0 |
| HL-E07 | setLevelDeps | deps=null | null依赖 | 后续调用安全 | uncovered | P1 |

### F-Cross
| ID | API | Description | Precondition | Expected | Status | Priority |
|----|-----|-------------|--------------|----------|--------|----------|
| HL-C01 | addExp→HeroSystem.syncToHeroSystem | 经验同步到HeroSystem | 升级发生 | HeroSystem等级更新 | covered | P0 |
| HL-C02 | getHeroMaxLevel→StarSystem.getLevelCap | 星级系统等级上限 | 注入回调 | 返回星级上限 | covered | P0 |
| HL-C03 | quickEnhanceAll→ResourceSystem | 批量消耗资源 | 多武将 | 资源正确扣除 | covered | P0 |
| HL-C04 | levelUp→HeroSystem.setLevelAndExp | 升级写回 | 升级成功 | HeroSystem数据一致 | covered | P0 |

### F-Lifecycle
| ID | API | Description | Precondition | Expected | Status | Priority |
|----|-----|-------------|--------------|----------|--------|----------|
| HL-L01 | init→setLevelDeps→addExp | 完整初始化链 | 正常流程 | 功能正常 | covered | P0 |
| HL-L02 | serialize→deserialize | 序列化往返 | 有数据 | 版本匹配 | covered | P1 |

---

## 子系统 3: HeroStarSystem（武将星级系统）

**源文件**: `HeroStarSystem.ts`
**公开API**: 20个
**职责**: 星级管理、碎片获取、商店兑换、突破系统

### API列表
| # | 方法名 | 参数 | 返回值 | 说明 |
|---|--------|------|--------|------|
| 1 | init | deps | void | ISubsystem初始化 |
| 2 | update | dt | void | 帧更新 |
| 3 | getState | — | unknown | 状态快照 |
| 4 | reset | — | void | 重置 |
| 5 | setDeps | StarSystemDeps | void | 注入依赖 |
| 6 | setSkillUnlockCallback | callback | void | 技能解锁回调 |
| 7 | handleDuplicateFragments | generalId, quality | FragmentGainResult | 重复碎片处理 |
| 8 | gainFragmentsFromStage | stageId, rng? | FragmentGainResult[] | 关卡碎片 |
| 9 | exchangeFragmentsFromShop | generalId, count | ShopExchangeResult | 商店兑换碎片 |
| 10 | resetDailyExchangeLimits | — | void | 重置每日限购 |
| 11 | addFragmentFromActivity | heroId, source, amount | FragmentGainResult | 活动碎片 |
| 12 | addFragmentFromExpedition | heroId, amount | FragmentGainResult | 远征碎片 |
| 13 | getStarUpCost | currentStar | StarUpCost | 升星消耗 |
| 14 | getStarUpPreview | generalId | StarUpPreview\|null | 升星预览 |
| 15 | starUp | generalId | StarUpResult | 执行升星 |
| 16 | calculateStarStats | general, star | GeneralStats | 星级属性计算 |
| 17 | getFragmentProgress | generalId | FragmentProgress\|null | 碎片进度 |
| 18 | getAllFragmentProgress | — | FragmentProgress[] | 全部碎片进度 |
| 19 | getLevelCap | generalId | number | 获取等级上限 |
| 20 | getBreakthroughStage | generalId | number | 突破阶段 |
| 21 | getNextBreakthroughTier | generalId | BreakthroughTier\|null | 下一突破档位 |
| 22 | getBreakthroughPreview | generalId | BreakthroughPreview\|null | 突破预览 |
| 23 | breakthrough | generalId | BreakthroughResult | 执行突破 |
| 24 | canBreakthrough | generalId | boolean | 是否可突破 |
| 25 | getStar | generalId | number | 获取星级 |
| 26 | getAllStars | — | Record\<string,number\> | 全部星级 |
| 27 | serialize/deserialize | — | StarSystemSaveData/void | 序列化 |

### F-Normal
| ID | API | Description | Precondition | Expected | Status | Priority |
|----|-----|-------------|--------------|----------|--------|----------|
| HSt-N01 | starUp | 正常升星 | 碎片和金币充足 | success=true | covered | P0 |
| HSt-N02 | getStarUpCost | 获取升星消耗 | currentStar=1 | 正确消耗 | covered | P1 |
| HSt-N03 | getStarUpPreview | 升星预览 | 有效武将 | 正确预览 | covered | P1 |
| HSt-N04 | exchangeFragmentsFromShop | 商店兑换碎片 | 有日限购额度 | success=true | covered | P0 |
| HSt-N05 | handleDuplicateFragments | 重复碎片处理 | quality=LEGENDARY | 正确碎片数 | covered | P0 |
| HSt-N06 | gainFragmentsFromStage | 关卡获取碎片 | 有效关卡 | 返回碎片列表 | covered | P1 |
| HSt-N07 | addFragmentFromActivity | 活动碎片 | amount>0 | 正确结果 | covered | P1 |
| HSt-N08 | addFragmentFromExpedition | 远征碎片 | amount>0 | 正确结果 | covered | P1 |
| HSt-N09 | calculateStarStats | 星级属性计算 | star=5 | 正确倍率 | covered | P0 |
| HSt-N10 | breakthrough | 正常突破 | 满足条件 | success=true | covered | P0 |
| HSt-N11 | canBreakthrough | 可突破判断 | 满足条件 | true | covered | P1 |
| HSt-N12 | getLevelCap | 获取等级上限 | 不同星级 | 正确上限 | covered | P0 |
| HSt-N13 | resetDailyExchangeLimits | 重置日限购 | 有已兑换记录 | 清零 | covered | P0 |

### F-Boundary
| ID | API | Description | Precondition | Expected | Status | Priority |
|----|-----|-------------|--------------|----------|--------|----------|
| HSt-B01 | starUp | 星级=MAX_STAR_LEVEL | 已满星 | success=false | covered | P0 |
| HSt-B02 | exchangeFragmentsFromShop | 恰好达到日限购 | 剩余1次 | 成功后额度=0 | covered | P0 |
| HSt-B03 | exchangeFragmentsFromShop | 超过日限购 | 请求超量 | actualCount=remaining | covered | P0 |
| HSt-B04 | getStar | 不存在的武将 | 无效ID | 返回1（默认） | covered | P1 |
| HSt-B05 | calculateStarStats | star=0 | 零星级 | 倍率检查 | uncovered | P0 |
| HSt-B06 | calculateStarStats | star=NaN | NaN星级 | NaN传播检查 | uncovered | P0 |
| HSt-B07 | breakthrough | 最后突破阶段 | 已满突破 | 返回失败 | covered | P1 |
| HSt-B08 | addFragmentFromActivity | amount=0 | 零碎片 | count=0 | covered | P2 |

### F-Error
| ID | API | Description | Precondition | Expected | Status | Priority |
|----|-----|-------------|--------------|----------|--------|----------|
| HSt-E01 | starUp | generalId不存在 | 无效ID | success=false | covered | P0 |
| HSt-E02 | starUp | deps未注入 | null deps | success=false | covered | P0 |
| HSt-E03 | exchangeFragmentsFromShop | count=负数 | 负值 | success=false | covered | P0 |
| HSt-E04 | exchangeFragmentsFromShop | generalId无配置 | 无效武将 | success=false | covered | P0 |
| HSt-E05 | exchangeFragmentsFromShop | 金币不足 | 资源不足 | success=false | covered | P0 |
| HSt-E06 | addFragmentFromActivity | amount=负数 | 负值 | count=0 | uncovered | P0 |
| HSt-E07 | breakthrough | generalId=null | null输入 | 不崩溃 | uncovered | P0 |
| HSt-E08 | getStarUpPreview | generalId不存在 | 无效ID | 返回null | covered | P1 |
| HSt-E09 | deserialize | data=null | null存档 | 崩溃检查 | uncovered | P0 |

### F-Cross
| ID | API | Description | Precondition | Expected | Status | Priority |
|----|-----|-------------|--------------|----------|--------|----------|
| HSt-C01 | starUp→HeroSystem.useFragments | 升星消耗碎片 | 升星成功 | HeroSystem碎片减少 | covered | P0 |
| HSt-C02 | starUp→deps.spendResource | 升星消耗金币 | 升星成功 | 金币扣除 | covered | P0 |
| HSt-C03 | exchangeFragmentsFromShop→HeroSystem.addFragment | 商店兑换增加碎片 | 兑换成功 | HeroSystem碎片增加 | covered | P0 |
| HSt-C04 | getLevelCap→HeroSystem.setLevelCapGetter | 等级上限传递 | 注入回调 | 战力计算正确 | covered | P0 |
| HSt-C05 | breakthrough→HeroSystem | 突破影响等级上限 | 突破成功 | 上限提升 | covered | P0 |

### F-Lifecycle
| ID | API | Description | Precondition | Expected | Status | Priority |
|----|-----|-------------|--------------|----------|--------|----------|
| HSt-L01 | init→setDeps→starUp | 完整初始化链 | 正常流程 | 功能正常 | covered | P0 |
| HSt-L02 | serialize→deserialize→getAllStars | 序列化往返 | 有星级数据 | 星级一致 | covered | P0 |
| HSt-L03 | exchangeFragments→resetDaily→exchange | 日重置周期 | 兑换后重置 | 可再次兑换 | covered | P0 |

---

## 子系统 4: HeroSerializer（武将序列化）

**源文件**: `HeroSerializer.ts`
**公开API**: 5个（纯函数）
**职责**: 武将状态序列化/反序列化/深拷贝

### API列表
| # | 方法名 | 参数 | 返回值 | 说明 |
|---|--------|------|--------|------|
| 1 | createEmptyState | — | HeroState | 创建空状态 |
| 2 | cloneGeneral | g: GeneralData | GeneralData | 深拷贝武将 |
| 3 | cloneState | state: HeroState | HeroState | 深拷贝状态 |
| 4 | serializeHeroState | state: HeroState | HeroSaveData | 序列化 |
| 5 | deserializeHeroState | data: HeroSaveData | HeroState | 反序列化 |

### F-Normal
| ID | API | Description | Precondition | Expected | Status | Priority |
|----|-----|-------------|--------------|----------|--------|----------|
| HSer-N01 | createEmptyState | 创建空状态 | — | 空generals和fragments | covered | P1 |
| HSer-N02 | cloneGeneral | 深拷贝武将 | 有效GeneralData | 独立副本 | covered | P0 |
| HSer-N03 | cloneState | 深拷贝状态 | 有效HeroState | 独立副本 | covered | P0 |
| HSer-N04 | serializeHeroState | 序列化 | 有武将数据 | 正确HeroSaveData | covered | P0 |
| HSer-N05 | deserializeHeroState | 反序列化 | 有效存档 | 正确HeroState | covered | P0 |

### F-Boundary
| ID | API | Description | Precondition | Expected | Status | Priority |
|----|-----|-------------|--------------|----------|--------|----------|
| HSer-B01 | serializeHeroState | 空状态序列化 | 空generals | 有效存档 | covered | P1 |
| HSer-B02 | deserializeHeroState | 版本不匹配 | 旧版本存档 | 降级处理或警告 | covered | P1 |
| HSer-B03 | cloneGeneral | 嵌套属性修改 | 修改副本skills | 原始不变 | covered | P0 |

### F-Error
| ID | API | Description | Precondition | Expected | Status | Priority |
|----|-----|-------------|--------------|----------|--------|----------|
| HSer-E01 | cloneGeneral | g=null | null输入 | 崩溃检查 | uncovered | P0 |
| HSer-E02 | cloneState | state=null | null输入 | 崩溃检查 | uncovered | P0 |
| HSer-E03 | deserializeHeroState | data=null | null存档 | 崩溃检查 | uncovered | P0 |
| HSer-E04 | deserializeHeroState | data.state.generals含null值 | 损坏数据 | 崩溃检查 | uncovered | P1 |
| HSer-E05 | serializeHeroState | state含NaN属性 | NaN数据 | NaN序列化检查 | uncovered | P1 |

### F-Cross
| ID | API | Description | Precondition | Expected | Status | Priority |
|----|-----|-------------|--------------|----------|--------|----------|
| HSer-C01 | serialize→deserialize | 往返一致性 | 有数据 | 数据完全一致 | covered | P0 |

### F-Lifecycle
| ID | API | Description | Precondition | Expected | Status | Priority |
|----|-----|-------------|--------------|----------|--------|----------|
| HSer-L01 | createEmptyState→serialize→deserialize | 空状态往返 | — | 仍为空 | covered | P1 |

---

## 子系统 5: HeroFormation（武将编队）

**源文件**: `HeroFormation.ts`
**公开API**: 18个
**职责**: 编队管理、编队切换、武将分配

### API列表
| # | 方法名 | 参数 | 返回值 | 说明 |
|---|--------|------|--------|------|
| 1 | init | deps | void | ISubsystem初始化 |
| 2 | update | dt | void | 帧更新（空） |
| 3 | getState | — | unknown | 状态快照 |
| 4 | setPrerequisites | FormationPrerequisites | void | 注入前置条件 |
| 5 | setMaxFormations | max | void | 设置编队上限 |
| 6 | getMaxFormations | — | number | 获取编队上限 |
| 7 | createFormation | id? | FormationData\|null | 创建编队 |
| 8 | getFormation | id | FormationData\|null | 查询编队 |
| 9 | getAllFormations | — | FormationData[] | 全部编队 |
| 10 | setFormation | id, generalIds[] | FormationData\|null | 设置编队阵容 |
| 11 | addToFormation | id, generalId | FormationData\|null | 添加武将到编队 |
| 12 | removeFromFormation | id, generalId | FormationData\|null | 从编队移除武将 |
| 13 | deleteFormation | id | boolean | 删除编队 |
| 14 | renameFormation | id, name | FormationData\|null | 重命名编队 |
| 15 | getActiveFormation | — | FormationData\|null | 获取激活编队 |
| 16 | setActiveFormation | id | boolean | 设置激活编队 |
| 17 | getActiveFormationId | — | string\|null | 激活编队ID |
| 18 | getFormationMemberCount | id | number | 编队成员数 |
| 19 | isGeneralInAnyFormation | generalId | boolean | 武将是否在编 |
| 20 | getFormationsContainingGeneral | generalId | string[] | 包含武将的编队 |
| 21 | getFormationCount | — | number | 编队总数 |
| 22 | serialize/deserialize/reset | — | — | 序列化/重置 |

### F-Normal
| ID | API | Description | Precondition | Expected | Status | Priority |
|----|-----|-------------|--------------|----------|--------|----------|
| HF-N01 | createFormation | 创建默认编队 | 未达上限 | 返回FormationData | covered | P0 |
| HF-N02 | addToFormation | 添加武将到编队 | 有空位 | 成功 | covered | P0 |
| HF-N03 | removeFromFormation | 从编队移除武将 | 武将在编 | 成功 | covered | P0 |
| HF-N04 | setFormation | 设置编队阵容 | 有效武将列表 | 成功 | covered | P0 |
| HF-N05 | setActiveFormation | 设置激活编队 | 编队存在 | true | covered | P0 |
| HF-N06 | deleteFormation | 删除编队 | 编队存在 | true | covered | P1 |
| HF-N07 | isGeneralInAnyFormation | 武将在编检查 | 武将在编 | true | covered | P1 |
| HF-N08 | getFormationsContainingGeneral | 查询武将所在编队 | 武将在编 | 正确编队ID列表 | covered | P1 |

### F-Boundary
| ID | API | Description | Precondition | Expected | Status | Priority |
|----|-----|-------------|--------------|----------|--------|----------|
| HF-B01 | createFormation | 达到编队上限 | 已满 | 返回null | covered | P0 |
| HF-B02 | addToFormation | 编队已满 | 无空位 | 返回null | covered | P0 |
| HF-B03 | setMaxFormations | max>5 | 超最大值 | 限制为5 | covered | P1 |
| HF-B04 | setMaxFormations | max<MAX_FORMATIONS | 低于默认 | 限制为MAX_FORMATIONS | covered | P1 |
| HF-B05 | setFormation | generalIds超过MAX_SLOTS | 超量武将 | 截断到MAX_SLOTS | covered | P0 |
| HF-B06 | addToFormation | 重复武将 | 已在编队 | 拒绝 | covered | P1 |
| HF-B07 | deleteFormation | 删除激活编队 | 激活中 | 清除activeId | covered | P1 |
| HF-B08 | getFormationMemberCount | 空编队 | 无成员 | 返回0 | covered | P2 |

### F-Error
| ID | API | Description | Precondition | Expected | Status | Priority |
|----|-----|-------------|--------------|----------|--------|----------|
| HF-E01 | addToFormation | formationId不存在 | 无效ID | 返回null | covered | P0 |
| HF-E02 | addToFormation | generalId不存在 | 无效武将 | 返回null | uncovered | P0 |
| HF-E03 | createFormation | prerequisites未满足 | 城堡等级不足 | 返回null | covered | P0 |
| HF-E04 | setActiveFormation | id不存在 | 无效编队 | 返回false | covered | P1 |
| HF-E05 | setFormation | generalIds=null | null输入 | 崩溃检查 | uncovered | P0 |
| HF-E06 | deserialize | data=null | null存档 | 崩溃检查 | uncovered | P0 |

### F-Cross
| ID | API | Description | Precondition | Expected | Status | Priority |
|----|-----|-------------|--------------|----------|--------|----------|
| HF-C01 | createFormation→prerequisites.spendCopper | 创建编队扣铜钱 | 条件满足 | 铜钱扣除 | covered | P0 |
| HF-C02 | addToFormation→HeroSystem.hasGeneral | 验证武将存在 | 添加武将 | 武将有效 | covered | P0 |
| HF-C03 | setActiveFormation→HeroSystem.calculateFormationPower | 激活编队战力 | 编队有效 | 正确战力 | covered | P1 |

### F-Lifecycle
| ID | API | Description | Precondition | Expected | Status | Priority |
|----|-----|-------------|--------------|----------|--------|----------|
| HF-L01 | create→addTo→setActive→delete | 编队完整生命周期 | 正常流程 | 状态正确 | covered | P0 |
| HF-L02 | serialize→deserialize→getAllFormations | 序列化往返 | 有编队 | 编队数据一致 | covered | P0 |
| HF-L03 | reset→createFormation | 重置后创建 | 重置状态 | 可正常创建 | covered | P1 |

---

## 子系统 6: HeroRecruitSystem（武将招募系统）

**源文件**: `HeroRecruitSystem.ts`
**公开API**: 20个
**职责**: 抽卡招募、保底机制、免费招募、UP武将管理

### API列表
| # | 方法名 | 参数 | 返回值 | 说明 |
|---|--------|------|--------|------|
| 1 | init | deps | void | ISubsystem初始化 |
| 2 | update | dt | void | 帧更新（检查日重置） |
| 3 | getState | — | unknown | 状态快照 |
| 4 | reset | — | void | 重置 |
| 5 | setRecruitDeps | RecruitDeps | void | 注入依赖 |
| 6 | setRng | rng | void | 注入随机数 |
| 7 | getUpManager | — | HeroRecruitUpManager | 获取UP管理器 |
| 8 | getRecruitCost | type, count | {resourceType,amount} | 招募消耗 |
| 9 | canRecruit | type, count | boolean | 是否可招募 |
| 10 | getGachaState | — | PityState | 保底状态 |
| 11 | getNextTenPullPity | type | number | 十连保底计数 |
| 12 | getNextHardPity | type | number | 硬保底计数 |
| 13 | getRecruitHistory | — | RecruitHistoryEntry[] | 招募历史 |
| 14 | getRecruitHistoryCount | — | number | 历史数量 |
| 15 | clearRecruitHistory | — | void | 清除历史 |
| 16 | setUpHero | generalId, rate? | void | 设置UP武将 |
| 17 | getUpHeroState | — | UpHeroState | UP武将状态 |
| 18 | clearUpHero | — | void | 清除UP武将 |
| 19 | getRemainingFreeCount | type | number | 剩余免费次数 |
| 20 | canFreeRecruit | type | boolean | 是否可免费招募 |
| 21 | freeRecruitSingle | type | RecruitOutput\|null | 免费单抽 |
| 22 | getFreeRecruitState | — | FreeRecruitState | 免费招募状态 |
| 23 | recruitSingle | type | RecruitOutput\|null | 单次招募 |
| 24 | recruitTen | type | RecruitOutput\|null | 十连招募 |
| 25 | serialize/deserialize | — | RecruitSaveData/void | 序列化 |

### F-Normal
| ID | API | Description | Precondition | Expected | Status | Priority |
|----|-----|-------------|--------------|----------|--------|----------|
| HR-N01 | recruitSingle | 正常单抽 | 资源充足 | 返回RecruitOutput | covered | P0 |
| HR-N02 | recruitTen | 正常十连 | 资源充足 | 返回10个结果 | covered | P0 |
| HR-N03 | freeRecruitSingle | 免费单抽 | 有免费次数 | 返回RecruitOutput | covered | P0 |
| HR-N04 | canRecruit | 资源充足检查 | 足够 | true | covered | P1 |
| HR-N05 | getRecruitCost | 获取消耗 | type=advanced | 正确消耗 | covered | P1 |
| HR-N06 | setUpHero | 设置UP武将 | 有效generalId | UP状态更新 | covered | P0 |
| HR-N07 | getGachaState | 获取保底状态 | 有保底计数 | 正确PityState | covered | P1 |
| HR-N08 | getRecruitHistory | 招募历史 | 有历史记录 | 正确列表 | covered | P1 |
| HR-N09 | clearRecruitHistory | 清除历史 | 有历史 | 清空 | covered | P2 |

### F-Boundary
| ID | API | Description | Precondition | Expected | Status | Priority |
|----|-----|-------------|--------------|----------|--------|----------|
| HR-B01 | recruitTen | 十连保底触发 | 保底计数=阈值 | 必出高品质 | covered | P0 |
| HR-B02 | recruitSingle | 硬保底触发 | 硬保底计数=阈值 | 必出LEGENDARY | covered | P0 |
| HR-B03 | freeRecruitSingle | 免费次数用尽 | 次数=0 | 返回null | covered | P0 |
| HR-B04 | getRecruitHistory | 历史达到MAX_HISTORY_SIZE | 满历史 | 保留最新20条 | covered | P1 |
| HR-B05 | canRecruit | count=0 | 零次招募 | 行为检查 | uncovered | P1 |
| HR-B06 | recruitTen | 资源恰好够十连 | 精确边界 | 成功 | covered | P1 |

### F-Error
| ID | API | Description | Precondition | Expected | Status | Priority |
|----|-----|-------------|--------------|----------|--------|----------|
| HR-E01 | recruitSingle | 资源不足 | 不足 | 返回null | covered | P0 |
| HR-E02 | recruitSingle | deps未注入 | null deps | 返回null | covered | P0 |
| HR-E03 | recruitTen | 资源不足 | 不足 | 返回null | covered | P0 |
| HR-E04 | freeRecruitSingle | type=null | 无效类型 | 崩溃检查 | uncovered | P0 |
| HR-E05 | setUpHero | generalId=空字符串 | 无效ID | UP状态异常检查 | uncovered | P1 |
| HR-E06 | deserialize | data=null | null存档 | 崩溃检查 | uncovered | P0 |
| HR-E07 | deserialize | data.pity=null | 缺失pity | 默认值处理 | covered | P1 |

### F-Cross
| ID | API | Description | Precondition | Expected | Status | Priority |
|----|-----|-------------|--------------|----------|--------|----------|
| HR-C01 | recruitSingle→HeroRecruitExecutor.executeSinglePull | 委托执行器 | 正常招募 | 结果正确 | covered | P0 |
| HR-C02 | recruitSingle→HeroSystem.addGeneral/handleDuplicate | 新武将/重复 | 招募结果 | 正确处理 | covered | P0 |
| HR-C03 | recruitSingle→deps.spendResource | 扣除资源 | 招募成功 | 资源扣除 | covered | P0 |
| HR-C04 | freeRecruitSingle→HeroSystem | 免费招募 | 免费次数 | 武将获得 | covered | P0 |
| HR-C05 | setUpHero→HeroRecruitUpManager | UP武将同步 | 设置UP | UpManager更新 | covered | P0 |

### F-Lifecycle
| ID | API | Description | Precondition | Expected | Status | Priority |
|----|-----|-------------|--------------|----------|--------|----------|
| HR-L01 | init→setRecruitDeps→recruitSingle | 完整初始化链 | 正常流程 | 功能正常 | covered | P0 |
| HR-L02 | serialize→deserialize→getGachaState | 序列化往返 | 有保底数据 | 保底计数一致 | covered | P0 |
| HR-L03 | update→checkDailyReset | 日重置 | 跨日 | 免费次数重置 | covered | P0 |

---

## 子系统 7: HeroRecruitExecutor（招募执行器）

**源文件**: `HeroRecruitExecutor.ts`
**公开API**: 1个
**职责**: 单次抽卡核心逻辑（概率→保底→UP→武将选择→重复处理）

### API列表
| # | 方法名 | 参数 | 返回值 | 说明 |
|---|--------|------|--------|------|
| 1 | executeSinglePull | heroSystem, type, pity, upHero, rng | RecruitResult | 执行单次抽卡 |

### F-Normal
| ID | API | Description | Precondition | Expected | Status | Priority |
|----|-----|-------------|--------------|----------|--------|----------|
| HRE-N01 | executeSinglePull | 正常抽卡（新武将） | 武将未拥有 | isDuplicate=false | covered | P0 |
| HRE-N02 | executeSinglePull | 正常抽卡（重复武将） | 武将已拥有 | isDuplicate=true | covered | P0 |
| HRE-N03 | executeSinglePull | UP武将命中 | advanced+LEGENDARY+UP | 获得UP武将 | covered | P0 |

### F-Boundary
| ID | API | Description | Precondition | Expected | Status | Priority |
|----|-----|-------------|--------------|----------|--------|----------|
| HRE-B01 | executeSinglePull | 保底计数=阈值-1 | 即将触发保底 | 保底触发 | covered | P0 |
| HRE-B02 | executeSinglePull | UP武将无定义 | upGeneralId有效但无def | fallback选择 | covered | P1 |
| HRE-B03 | executeSinglePull | 所有品质无武将 | 极端空池 | general=null | covered | P1 |
| HRE-B04 | executeSinglePull | upHero.upGeneralId=null | 无UP武将 | 正常随机 | covered | P1 |

### F-Error
| ID | API | Description | Precondition | Expected | Status | Priority |
|----|-----|-------------|--------------|----------|--------|----------|
| HRE-E01 | executeSinglePull | heroSystem=null | null系统 | 崩溃检查 | uncovered | P0 |
| HRE-E02 | executeSinglePull | pity=null | null保底 | 崩溃检查 | uncovered | P0 |
| HRE-E03 | executeSinglePull | rng返回NaN | 异常随机数 | 崩溃检查 | uncovered | P1 |

### F-Cross
| ID | API | Description | Precondition | Expected | Status | Priority |
|----|-----|-------------|--------------|----------|--------|----------|
| HRE-C01 | executeSinglePull→heroSystem.hasGeneral | 检查武将是否已拥有 | 抽到武将 | 正确判断重复 | covered | P0 |
| HRE-C02 | executeSinglePull→heroSystem.handleDuplicate | 重复武将处理 | 已拥有 | 碎片获得 | covered | P0 |
| HRE-C03 | executeSinglePull→heroSystem.addGeneral | 新武将添加 | 未拥有 | 武将加入 | covered | P0 |

---

## 子系统 8: HeroRecruitUpManager（UP武将管理器）

**源文件**: `HeroRecruitUpManager.ts`
**公开API**: 8个
**职责**: UP武将状态管理、UP概率设置

### API列表
| # | 方法名 | 参数 | 返回值 | 说明 |
|---|--------|------|--------|------|
| 1 | init | deps | void | ISubsystem初始化 |
| 2 | update | dt | void | 帧更新（空） |
| 3 | getState | — | unknown | 状态快照 |
| 4 | reset | — | void | 重置 |
| 5 | setUpHero | generalId, rate? | void | 设置UP武将 |
| 6 | getUpHeroState | — | UpHeroState | UP武将状态 |
| 7 | clearUpHero | — | void | 清除UP武将 |
| 8 | getUpGeneralId | — | string\|null | UP武将ID |
| 9 | getUpRate | — | number | UP概率 |
| 10 | setUpRate | rate | void | 设置UP概率 |
| 11 | serializeUpHero | — | UpHeroState | 序列化 |
| 12 | deserializeUpHero | data | void | 反序列化 |

### F-Normal
| ID | API | Description | Precondition | Expected | Status | Priority |
|----|-----|-------------|--------------|----------|--------|----------|
| HRU-N01 | setUpHero | 设置UP武将 | 有效ID和概率 | 状态更新 | covered | P0 |
| HRU-N02 | getUpHeroState | 获取UP状态 | 已设置 | 正确UpHeroState | covered | P1 |
| HRU-N03 | clearUpHero | 清除UP | 已设置 | 恢复默认 | covered | P1 |
| HRU-N04 | setUpRate | 设置UP概率 | rate=0.5 | 概率更新 | covered | P1 |
| HRU-N05 | serializeUpHero | 序列化 | 有UP数据 | 正确UpHeroState | covered | P1 |

### F-Boundary
| ID | API | Description | Precondition | Expected | Status | Priority |
|----|-----|-------------|--------------|----------|--------|----------|
| HRU-B01 | setUpHero | generalId=null | 清除UP | 状态恢复默认 | covered | P1 |
| HRU-B02 | setUpRate | rate=0 | 零概率 | UP不触发 | uncovered | P1 |
| HRU-B03 | setUpRate | rate=1.0 | 满概率 | 必定UP | uncovered | P1 |
| HRU-B04 | setUpRate | rate>1.0 | 超限概率 | 行为检查 | uncovered | P0 |

### F-Error
| ID | API | Description | Precondition | Expected | Status | Priority |
|----|-----|-------------|--------------|----------|--------|----------|
| HRU-E01 | setUpRate | rate=NaN | NaN概率 | NaN传播检查 | uncovered | P0 |
| HRU-E02 | setUpRate | rate=负数 | 负概率 | 行为检查 | uncovered | P0 |
| HRU-E03 | deserializeUpHero | data=null | null数据 | 崩溃检查 | uncovered | P0 |

### F-Cross
| ID | API | Description | Precondition | Expected | Status | Priority |
|----|-----|-------------|--------------|----------|--------|----------|
| HRU-C01 | setUpHero→HeroRecruitSystem.getUpManager | UP管理器被引用 | 设置UP | RecruitSystem可见 | covered | P0 |

### F-Lifecycle
| ID | API | Description | Precondition | Expected | Status | Priority |
|----|-----|-------------|--------------|----------|--------|----------|
| HRU-L01 | setUpHero→clearUpHero→setUpHero | UP武将切换 | 正常流程 | 状态正确 | covered | P1 |
| HRU-L02 | serializeUpHero→deserializeUpHero | 序列化往返 | 有UP数据 | 数据一致 | covered | P1 |

---

## 子系统 9: RecruitTokenEconomySystem（招贤令经济系统）

**源文件**: `recruit-token-economy-system.ts`
**公开API**: 20个
**职责**: 招贤令获取（被动产出、商店、新手礼包、日常、关卡首通、活动、离线）

### API列表
| # | 方法名 | 参数 | 返回值 | 说明 |
|---|--------|------|--------|------|
| 1 | init | deps | void | ISubsystem初始化 |
| 2 | update | dt | void | 帧更新（被动产出+日重置） |
| 3 | getState | — | unknown | 状态快照 |
| 4 | reset | — | void | 重置 |
| 5 | setEconomyDeps | RecruitTokenEconomyDeps | void | 注入依赖 |
| 6 | setRng | rng | void | 注入随机数 |
| 7 | tick | deltaSeconds | void | 被动产出tick |
| 8 | claimNewbiePack | — | number | 领取新手礼包(100令) |
| 9 | claimDailyTaskReward | — | number | 领取日常奖励(15令) |
| 10 | buyFromShop | count | boolean | 商店购买 |
| 11 | claimStageClearReward | stageId | number | 关卡首通奖励 |
| 12 | claimEventReward | — | number | 活动奖励 |
| 13 | calculateOfflineReward | offlineSeconds | number | 计算离线奖励 |
| 14 | claimOfflineReward | offlineSeconds | number | 领取离线奖励 |
| 15 | getDailyShopPurchased | — | number | 今日已购买数 |
| 16 | getDailyShopRemaining | — | number | 今日剩余可购 |
| 17 | getNewbiePackClaimed | — | boolean | 新手礼包状态 |
| 18 | getDailyTaskClaimed | — | boolean | 日常奖励状态 |
| 19 | getTotalPassiveEarned | — | number | 累计被动产出 |
| 20 | isStageRewardClaimed | stageId | boolean | 关卡奖励状态 |
| 21 | getClearedStageCount | — | number | 已通关卡数 |
| 22 | getPassiveRate | — | number | 被动产出速率 |
| 23 | getOfflineEfficiency | — | number | 离线效率(0.5) |
| 24 | serialize/deserialize | — | RecruitTokenEconomySaveData/void | 序列化 |

### F-Normal
| ID | API | Description | Precondition | Expected | Status | Priority |
|----|-----|-------------|--------------|----------|--------|----------|
| TE-N01 | claimNewbiePack | 领取新手礼包 | 未领取 | 返回100 | covered | P0 |
| TE-N02 | claimDailyTaskReward | 领取日常奖励 | 未领取 | 返回15 | covered | P0 |
| TE-N03 | buyFromShop | 商店购买10个 | 有铜钱+额度 | true | covered | P0 |
| TE-N04 | claimStageClearReward | 关卡首通 | 未领取 | 3~5令 | covered | P0 |
| TE-N05 | claimEventReward | 活动奖励 | deps已注入 | 10~20令 | covered | P1 |
| TE-N06 | calculateOfflineReward | 计算离线奖励 | 3600秒 | 正确值 | covered | P1 |
| TE-N07 | claimOfflineReward | 领取离线奖励 | 有离线时间 | 正确值 | covered | P1 |
| TE-N08 | tick | 被动产出 | 1秒 | 累加0.002 | covered | P1 |
| TE-N09 | getDailyShopRemaining | 剩余额度 | 已购买10 | 50-10=40 | covered | P1 |

### F-Boundary
| ID | API | Description | Precondition | Expected | Status | Priority |
|----|-----|-------------|--------------|----------|--------|----------|
| TE-B01 | buyFromShop | 恰好达到日限购 | 剩余=购买数 | 成功后额度=0 | covered | P0 |
| TE-B02 | buyFromShop | 请求超过剩余额度 | 超量 | actualCount=remaining | covered | P0 |
| TE-B03 | claimNewbiePack | 重复领取 | 已领取 | 返回0 | covered | P0 |
| TE-B04 | claimDailyTaskReward | 重复领取 | 已领取 | 返回0 | covered | P0 |
| TE-B05 | claimStageClearReward | 重复领取同关卡 | 已领取 | 返回0 | covered | P0 |
| TE-B06 | calculateOfflineReward | offlineSeconds=0 | 零离线 | 返回0 | covered | P1 |
| TE-B07 | buyFromShop | count=SHOP_DAILY_LIMIT | 购买最大量 | 成功 | covered | P1 |
| TE-B08 | tick | deltaSeconds=0 | 零时间 | 无产出 | covered | P2 |

### F-Error
| ID | API | Description | Precondition | Expected | Status | Priority |
|----|-----|-------------|--------------|----------|--------|----------|
| TE-E01 | buyFromShop | count=负数 | 负值 | 返回false | covered | P0 |
| TE-E02 | buyFromShop | count=0 | 零值 | 返回false | covered | P0 |
| TE-E03 | buyFromShop | economyDeps未注入 | null deps | 返回false | covered | P0 |
| TE-E04 | buyFromShop | 铜钱不足 | 不足 | 返回false | covered | P0 |
| TE-E05 | claimNewbiePack | economyDeps未注入 | null deps | 返回0 | covered | P0 |
| TE-E06 | claimStageClearReward | stageId=空字符串 | 空ID | 返回0 | covered | P0 |
| TE-E07 | claimStageClearReward | stageId=null | null输入 | 崩溃检查 | uncovered | P0 |
| TE-E08 | calculateOfflineReward | offlineSeconds=负数 | 负时间 | 行为检查 | uncovered | P0 |
| TE-E09 | calculateOfflineReward | offlineSeconds=NaN | NaN时间 | NaN传播检查 | uncovered | P0 |
| TE-E10 | deserialize | data=null | null存档 | 崩溃检查 | uncovered | P0 |

### F-Cross
| ID | API | Description | Precondition | Expected | Status | Priority |
|----|-----|-------------|--------------|----------|--------|----------|
| TE-C01 | buyFromShop→economyDeps.consumeGold | 扣除铜钱 | 购买成功 | 铜钱扣除 | covered | P0 |
| TE-C02 | buyFromShop→economyDeps.addRecruitToken | 增加招贤令 | 购买成功 | 令牌增加 | covered | P0 |
| TE-C03 | claimNewbiePack→economyDeps.addRecruitToken | 新手礼包令牌 | 领取成功 | +100令 | covered | P0 |
| TE-C04 | update→tick→checkDailyReset | 日重置联动 | 跨日 | 商店额度重置 | covered | P0 |
| TE-C05 | claimOfflineReward→economyDeps.addRecruitToken | 离线奖励令牌 | 领取成功 | 正确数量 | covered | P1 |

### F-Lifecycle
| ID | API | Description | Precondition | Expected | Status | Priority |
|----|-----|-------------|--------------|----------|--------|----------|
| TE-L01 | init→setEconomyDeps→claimNewbiePack | 完整初始化链 | 正常流程 | 功能正常 | covered | P0 |
| TE-L02 | serialize→deserialize→getNewbiePackClaimed | 序列化往返 | 已领取 | 状态一致 | covered | P0 |
| TE-L03 | claimNewbiePack→claimDailyTaskReward→buyFromShop | 多来源获取 | 正常流程 | 各自独立 | covered | P1 |
| TE-L04 | reset→claimNewbiePack | 重置后可再领取 | 已重置 | 返回100 | covered | P0 |

---

## 子系统 10: hero.types（类型定义）

**源文件**: `hero.types.ts`
**公开API**: 15个（类型+常量）
**职责**: 武将域公共类型定义

### API列表
| # | 导出名 | 类型 | 说明 |
|---|--------|------|------|
| 1 | Quality | enum | 品质枚举(COMMON/FINE/RARE/EPIC/LEGENDARY) |
| 2 | QUALITY_ORDER | Record\<Quality,number\> | 品质排序映射 |
| 3 | QUALITY_TIERS | readonly Quality[] | 品质层级 |
| 4 | QUALITY_LABELS | Record\<Quality,string\> | 品质中文标签 |
| 5 | QUALITY_BORDER_COLORS | Record\<Quality,string\> | 品质边框颜色 |
| 6 | Faction | type (re-export) | 阵营类型 |
| 7 | FACTION_LABELS | Record\<Faction,string\> | 阵营标签 |
| 8 | FACTIONS | readonly Faction[] | 阵营列表 |
| 9 | GeneralStats | type (re-export) | 四维属性 |
| 10 | SkillType | type | 技能类型 |
| 11 | SkillData | interface | 技能数据 |
| 12 | GeneralData | interface | 武将数据 |
| 13 | FragmentData | interface | 碎片数据 |
| 14 | HeroState | interface | 武将系统状态 |
| 15 | HeroSaveData | interface | 存档数据 |

### F-Normal（类型级验证，由其他子系统覆盖）
| ID | API | Description | Precondition | Expected | Status | Priority |
|----|-----|-------------|--------------|----------|--------|----------|
| TY-N01 | Quality enum | 所有品质值可遍历 | — | 5个品质 | covered | P2 |
| TY-N02 | QUALITY_ORDER | 品质排序正确 | — | COMMON<LEGENDARY | covered | P2 |
| TY-N03 | FACTIONS | 阵营完整 | — | shu/wei/wu/qun | covered | P2 |

### F-Boundary
| ID | API | Description | Precondition | Expected | Status | Priority |
|----|-----|-------------|--------------|----------|--------|----------|
| TY-B01 | Quality | 非法品质字符串 | 'invalid' | 类型不匹配 | covered | P2 |

---

## Source Verification

| 子系统 | 文件 | 行数范围 | 验证方式 | 验证状态 |
|--------|------|----------|----------|----------|
| HeroSystem | HeroSystem.ts | L39-470 | grep+sed提取签名 | ✅ Verified |
| HeroLevelSystem | HeroLevelSystem.ts | L149-520 | grep+sed提取签名 | ✅ Verified |
| HeroStarSystem | HeroStarSystem.ts | L71-420 | grep+sed提取签名 | ✅ Verified |
| HeroSerializer | HeroSerializer.ts | L24-90 | grep提取export函数 | ✅ Verified |
| HeroFormation | HeroFormation.ts | L42-430 | grep+sed提取签名 | ✅ Verified |
| HeroRecruitSystem | HeroRecruitSystem.ts | L63-300 | grep+sed提取签名 | ✅ Verified |
| HeroRecruitExecutor | HeroRecruitExecutor.ts | L25-170 | grep+sed提取签名 | ✅ Verified |
| HeroRecruitUpManager | HeroRecruitUpManager.ts | L22-90 | grep+sed提取签名 | ✅ Verified |
| RecruitTokenEconomy | recruit-token-economy-system.ts | L136-480 | grep+sed提取签名 | ✅ Verified |
| hero.types | hero.types.ts | L22-201 | grep提取exports | ✅ Verified |

## New Discoveries

### 发现1: HeroRecruitExecutor仅1个公开API
- `executeSinglePull` 是唯一公开方法，其余3个均为private
- 该类由 HeroRecruitSystem 内部持有并委托调用
- **风险点**: executeSinglePull直接修改传入的pity对象（就地修改），外部调用者需注意

### 发现2: TokenEconomy tick在update中自动调用
- `update(dt)` 内部同时调用 `checkDailyReset()` 和 `tick(dt)`
- 被动产出速率为 0.002/秒（每500秒产出1招贤令）
- **风险点**: dt为负值或NaN时可能导致被动产出异常

### 发现3: HeroFormation动态上限机制
- 默认MAX_FORMATIONS=3，可通过setMaxFormations扩展到5
- 创建编队需要前置条件（城堡等级+铜钱）
- **风险点**: setMaxFormations传入小于当前编队数时的行为未明确

### 发现4: HeroLevelSystem双路径一致性（DEF-003相关）
- HeroSystem有 `getMaxLevel` 通过回调获取上限
- HeroLevelSystem有 `getHeroMaxLevel` 也通过回调获取上限
- 两条路径应返回相同值，需验证一致性

### 发现5: exchangeFragmentsFromShop日限购已修复（DEF-001）
- 代码中已有 `dailyExchangeCount` 跟踪和 `resetDailyExchangeLimits` 方法
- 但仍需验证：日重置是否由外部定时器调用，系统内部不自动重置

### 发现6: Serializer深拷贝实现
- `cloneGeneral` 和 `cloneState` 使用深拷贝
- 需验证嵌套对象（skills数组）是否真正独立

## Rule Evolution Suggestions

### 建议1: 增加就地修改参数检查规则
- **触发发现**: HeroRecruitExecutor.executeSinglePull 就地修改 pity 参数
- **建议**: 对所有接受可变对象参数的API，枚举"参数被意外修改"场景

### 建议2: 增加update/dt负值检查规则
- **触发发现**: TokenEconomy.update(dt) 和 tick(deltaSeconds) 未检查负值
- **建议**: 所有接受dt/deltaTime参数的API必须检查负值和NaN

### 建议3: 增加双路径一致性规则
- **触发发现**: HeroSystem.getMaxLevel 和 HeroLevelSystem.getHeroMaxLevel 双路径
- **建议**: 当两个子系统提供语义相同的方法时，必须枚举"路径不一致"场景

### 建议4: 增加日重置调用链验证规则
- **触发发现**: exchangeFragmentsFromShop的日重置依赖外部调用
- **建议**: 所有日限购机制必须验证"重置函数是否被正确调用"的集成场景

### 建议5: 增加编队上限缩减规则
- **触发发现**: setMaxFormations可动态调整上限
- **建议**: 当上限缩减到小于当前编队数时，枚举"超限编队处理"场景
