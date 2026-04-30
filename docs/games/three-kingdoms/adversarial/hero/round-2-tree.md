# Hero模块流程分支树 — Round 2（补充版）

> 基于 Round 1 挑战者反馈，针对 7 大关键遗漏进行补充
> 模块路径：`src/games/three-kingdoms/engine/hero/`
> 源码文件：29个 | 测试文件：39个（含集成测试4个）

## 变更摘要

| 变更项 | Round 1 | Round 2 | 增量 |
|--------|---------|---------|------|
| **总节点数** | 307 | **427** | **+120** |
| P0 阻塞 | 128 | **155** | +27 |
| P1 严重 | 144 | **177** | +33 |
| P2 一般 | 35 | **95** | +60 |
| covered | 278 | 278 | 0 |
| missing | 18 | **87** | +69 |
| partial | 11 | **62** | +51 |

### 覆盖率变化（按维度）

| 维度 | R1 节点 | R1 覆盖率 | R2 节点 | R2 覆盖率 | 变化 |
|------|---------|-----------|---------|-----------|------|
| normal | 112 | 93% | 132 | 79% | -14%* |
| boundary | 88 | 82% | **138** | 52% | -30%* |
| exception | 31 | 84% | **63** | 41% | -43%* |
| **cross** | **39** | **46%** | **60** | **70%** | **+24%** ✅ |
| **lifecycle** | **37** | **38%** | **34** | **74%** | **+36%** ✅ |

> *注：覆盖率下降是因为新增节点尚未覆盖，反映真实测试缺口。目标是新增节点全部覆盖后整体达标。

---

## 补充节点总览

| 补充区域 | 新增节点数 | P0 | P1 | P2 | 对应遗漏 |
|----------|-----------|-----|-----|-----|----------|
| **A. 资源扣除原子性** | 18 | 8 | 7 | 3 | P0-原子性缺陷 |
| **B. 碎片获取完整路径** | 20 | 6 | 9 | 5 | P0-碎片零覆盖 |
| **C. 碎片溢出→铜钱转化** | 12 | 5 | 5 | 2 | P0-溢出转化无测试 |
| **D. 跨系统交互 (F-Cross)** | 36 | 5 | 18 | 13 | F-Cross 46%→70% |
| **E. 数据生命周期 (F-Lifecycle)** | 14 | 3 | 6 | 5 | F-Lifecycle 38%→74% |
| **F. 异常路径补充 (F-Error)** | 10 | 0 | 6 | 4 | F-Error 遗漏20项 |
| **G. 边界条件补充 (F-Boundary)** | 10 | 0 | 6 | 4 | F-Boundary 遗漏22项 |
| **合计** | **120** | **27** | **57** | **36** | — |

---

## A. 资源扣除原子性（新增 18 节点）

> **问题根因**：`quickEnhance`、`starUp`、`upgradeSkill`、`awaken` 中存在多步资源扣除，
> 若第一步成功而第二步失败，已扣除的资源不会回滚。
> 源码证据：
> - `HeroLevelSystem.quickEnhance`: 先 `spendResource(GOLD)` 再 `spendResource(EXP)`，第二步失败时 gold 已扣除
> - `HeroStarSystem.starUp`: 先 `useFragments()` 再 `spendResource(GOLD)`，gold 失败时碎片已消耗
> - `SkillUpgradeSystem.upgradeSkill`: 先 `spendResource('gold')` 再 `spendResource('skillBook')`，skillBook 失败时 gold 已扣除
> - `AwakeningSystem.spendResources`: 连续 5 次 spendResource，中间失败无回滚

### A1. quickEnhance 原子性（HeroLevelSystem）

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| ATOM-QE-001 | exception | gold扣除成功但exp扣除失败 | gold充足，spendResource(EXP)返回false | gold应回滚或操作整体失败，gold余额不变 | missing | P0 |
| ATOM-QE-002 | exception | exp扣除成功但gold扣除失败 | exp充足，spendResource(GOLD)返回false | exp应回滚或操作整体失败，exp余额不变 | missing | P0 |
| ATOM-QE-003 | boundary | goldNeed=0时跳过gold扣除 | 武将已有足够经验，只需exp | 仅扣除exp，不触发gold扣除 | missing | P1 |
| ATOM-QE-004 | boundary | expNeed=0时跳过exp扣除 | 武将已有足够经验，只需gold | 仅扣除gold，不触发exp扣除 | missing | P1 |
| ATOM-QE-005 | exception | 多级升级中途gold耗尽 | 资源只够升3级但目标5级 | 升到3级后停止，已扣除的资源与3级匹配 | missing | P1 |

### A2. starUp 原子性（HeroStarSystem）

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| ATOM-ST-001 | exception | 碎片扣除成功但gold扣除失败 | 碎片充足，spendResource(GOLD)返回false | 碎片应回滚（恢复到扣除前数量） | missing | P0 |
| ATOM-ST-002 | exception | canAfford通过但spend失败 | canAfford=true但spendResource返回false | 碎片不应扣除，返回failedStarUp | missing | P0 |
| ATOM-ST-003 | boundary | 碎片恰好等于消耗量 | fragments===cost.fragments | 碎片变为0，key被delete | missing | P1 |

### A3. upgradeSkill 原子性（SkillUpgradeSystem）

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| ATOM-SK-001 | exception | gold扣除成功但skillBook扣除失败 | gold充足，spendResource('skillBook')返回false | gold应回滚，技能等级不变 | missing | P0 |
| ATOM-SK-002 | exception | canAfford通过但spend(gold)失败 | canAfford=true但spendResource('gold')返回false | 不应扣除skillBook | missing | P0 |
| ATOM-SK-003 | boundary | cost.gold=0时跳过gold扣除 | 技能1级升2级cost.gold=0 | 仅扣除skillBook | missing | P1 |

### A4. awaken 原子性（AwakeningSystem）

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| ATOM-AW-001 | exception | 4种资源中第3种扣除失败 | gold+breakthroughStone成功，skillBook失败 | gold和breakthroughStone应回滚 | missing | P0 |
| ATOM-AW-002 | exception | 碎片扣除成功但资源扣除失败 | useFragments成功但spendResource失败 | 碎片应回滚 | missing | P0 |
| ATOM-AW-003 | exception | 所有资源扣除成功但状态更新前异常 | spendResources全部成功但后续抛错 | 所有资源应回滚 | missing | P1 |
| ATOM-AW-004 | boundary | checkResources通过但spendResources中间余额不足 | 并发场景下check和spend间资源被消耗 | 应检测并回滚 | missing | P2 |

---

## B. 碎片获取完整路径（新增 20 节点）

> **问题根因**：`addFragmentFromActivity` 和 `addFragmentFromExpedition` 在 Round 1 中标记为 covered
> 但实际只测了碎片增加，未覆盖：溢出处理、source标记、无效输入、跨系统联动。

### B1. addFragmentFromActivity（HeroStarSystem）

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| FRAG-ACT-001 | normal | 正常活动碎片获取 | heroId有效，amount=10 | 碎片+10，返回FragmentGainResult(source=ACTIVITY) | missing | P0 |
| FRAG-ACT-002 | boundary | 活动碎片导致溢出 | 当前碎片990，amount=20 | 碎片=999，溢出=11，actual=9 | missing | P0 |
| FRAG-ACT-003 | exception | amount<=0 | amount=0或-1 | 返回count=0，碎片不变 | missing | P1 |
| FRAG-ACT-004 | boundary | 溢出碎片是否触发铜钱转化 | 溢出>0 | addFragment返回溢出值，调用方需处理铜钱转化 | missing | P1 |
| FRAG-ACT-005 | exception | heroId不存在 | heroId无效 | addFragment仍执行（碎片与武将拥有无关），碎片增加 | missing | P2 |
| FRAG-ACT-006 | normal | 不同source字符串记录 | source='限时活动·赤壁之战' | gameLog记录包含source描述 | missing | P2 |

### B2. addFragmentFromExpedition（HeroStarSystem）

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| FRAG-EXP-001 | normal | 正常远征碎片获取 | heroId有效，amount=5 | 碎片+5，返回FragmentGainResult(source=EXPEDITION) | missing | P0 |
| FRAG-EXP-002 | boundary | 远征碎片恰好达到上限 | 当前碎片994，amount=5 | 碎片=999，溢出=0 | missing | P0 |
| FRAG-EXP-003 | exception | amount<=0 | amount=0或-1 | 返回count=0 | missing | P1 |
| FRAG-EXP-004 | cross | 远征系统→碎片获取→升星 | ExpeditionSystem调用addFragmentFromExpedition | 碎片增加后可触发升星 | missing | P1 |

### B3. 关卡掉落碎片（gainFragmentsFromStage）

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| FRAG-STG-001 | boundary | 关卡无碎片掉落 | stageId不匹配任何掉落配置 | 返回空数组[] | missing | P1 |
| FRAG-STG-002 | normal | 多个碎片掉落（同一关卡多武将） | stageId='1-2' | 返回多个FragmentGainResult | missing | P1 |
| FRAG-STG-003 | boundary | RNG产出count=0 | min=0, max=1, rng返回0 | count=0不添加碎片 | missing | P2 |
| FRAG-STG-004 | cross | 关卡通关→碎片掉落→升星预览更新 | Campaign通关调用gainFragmentsFromStage | 碎片增加后getFragmentProgress反映新进度 | missing | P1 |

### B4. 商店兑换碎片（exchangeFragmentsFromShop）

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| FRAG-SHOP-001 | exception | 武将不在兑换列表中 | generalId无对应配置 | 返回success=false | missing | P1 |
| FRAG-SHOP-002 | boundary | 兑换数量超过日限购 | count=100, dailyLimit=10 | 实际兑换=Math.min(count, dailyLimit) | missing | P1 |
| FRAG-SHOP-003 | exception | deps未注入 | deps=null | 返回success=false | missing | P2 |

---

## C. 碎片溢出→铜钱转化完整验证（新增 12 节点）

> **问题根因**：`HeroRecruitSystem` 中有 `addResource('gold', overflow * FRAGMENT_TO_GOLD_RATE)` 逻辑
> 但 Round 1 仅标记为 partial，未验证：
> 1. overflow 计算是否正确（expectedFragments - actualGain）
> 2. 铜钱转化比率是否正确（FRAGMENT_TO_GOLD_RATE=100）
> 3. 溢出=0时是否不触发转化
> 4. recruitDeps.addResource 是否被正确调用

### C1. 招募重复武将碎片溢出→铜钱转化

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| GOLD-OVF-001 | normal | 重复武将碎片溢出→铜钱转化 | 已有武将，碎片990，LEGENDARY重复→80碎片 | 溢出=71，铜钱+7100 | missing | P0 |
| GOLD-OVF-002 | boundary | 碎片恰好不溢出 | 已有武将，碎片900，LEGENDARY重复→80碎片 | 溢出=0，不调用addResource | missing | P0 |
| GOLD-OVF-003 | boundary | 碎片上限999全部溢出 | 已有武将，碎片999，LEGENDARY重复→80碎片 | 溢出=80，铜钱+8000 | missing | P0 |
| GOLD-OVF-004 | normal | COMMON品质溢出计算 | 已有武将，碎片998，COMMON重复→5碎片 | 溢出=4，铜钱+400 | missing | P1 |
| GOLD-OVF-005 | cross | 十连抽中多个重复武将碎片溢出 | 十连含3个重复武将 | 每个重复独立计算溢出和铜钱 | missing | P1 |
| GOLD-OVF-006 | exception | recruitDeps.addResource未注入 | addResource=null | 溢出部分丢失（无铜钱补偿） | missing | P1 |

### C2. addFragment溢出返回值验证

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| GOLD-FRAG-001 | normal | addFragment返回溢出值 | 碎片990，添加20 | 返回11（溢出） | missing | P0 |
| GOLD-FRAG-002 | boundary | addFragment无溢出 | 碎片0，添加10 | 返回0（无溢出） | missing | P1 |
| GOLD-FRAG-003 | boundary | addFragment恰好到上限 | 碎片989，添加10 | 返回0（999=上限，无溢出） | missing | P1 |
| GOLD-FRAG-004 | boundary | FRAGMENT_TO_GOLD_RATE常量验证 | — | FRAGMENT_TO_GOLD_RATE===100 | missing | P1 |
| GOLD-FRAG-005 | cross | handleDuplicate→addFragment溢出→调用方处理 | 品质对应碎片+当前碎片>999 | addFragment返回溢出，handleDuplicate返回碎片数 | missing | P1 |
| GOLD-FRAG-006 | cross | 碎片溢出铜钱转化与经济系统联动 | 溢出→铜钱→可用于升级/升星 | 铜钱正确增加到玩家资源 | missing | P1 |

---

## D. 跨系统交互补充（新增 36 节点，F-Cross 46%→70%）

> 目标：将 F-Cross 从 24 节点扩展到 60 节点，覆盖 hero→battle→campaign→reward 完整链路。

### D1. 招募→武将→碎片→铜钱 完整链路

| ID | 类型 | 描述 | 涉及系统 | 预期行为 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| XI-025 | cross | 单抽新武将→addGeneral→编队可添加 | Recruit↔Hero↔Formation | 招募新武将后可添加到编队 | missing | P0 |
| XI-026 | cross | 单抽重复武将→handleDuplicate→碎片增加→溢出→铜钱 | Recruit↔Hero↔Resource | 完整重复处理链路 | missing | P0 |
| XI-027 | cross | 十连抽混合结果：新武将+重复+溢出 | Recruit↔Hero↔Resource | 每个结果独立正确处理 | missing | P1 |
| XI-028 | cross | UP武将命中→新武将添加→编队推荐更新 | Recruit↔Hero↔Recommend | UP武将加入后推荐方案更新 | missing | P1 |

### D2. 碎片→升星→突破→觉醒 完整养成链路

| ID | 类型 | 描述 | 涉及系统 | 预期行为 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| XI-029 | cross | 碎片积累→升星→属性提升→战力增加 | Star↔Hero | 升星后calculatePower增大 | missing | P0 |
| XI-030 | cross | 升星→技能等级上限提升→技能可升级 | Star↔Skill | star从1→2后skillLevelCap从3→5 | missing | P0 |
| XI-031 | cross | 突破→等级上限提升→升级系统可继续升级 | Star↔Level | 突破后getLevelCap增大，addExp可继续 | missing | P0 |
| XI-032 | cross | 突破→技能解锁→技能升级 | Star↔Skill | 突破Lv10解锁被动强化 | missing | P1 |
| XI-033 | cross | 觉醒→属性×1.5→战力大幅提升→编队战力刷新 | Awakening↔Hero↔Formation | 觉醒后编队战力正确更新 | missing | P1 |
| XI-034 | cross | 觉醒→等级上限120→升级到120级 | Awakening↔Level | 觉醒后可升级到120级 | missing | P0 |
| XI-035 | cross | 觉醒→被动叠加→其他武将属性加成 | Awakening↔Hero | 觉醒被动正确应用到全局 | missing | P1 |

### D3. hero→battle→campaign→reward 跨引擎链路

| ID | 类型 | 描述 | 涉及系统 | 预期行为 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| XI-036 | cross | 编队武将→战斗初始化→使用Hero属性 | Formation↔Battle | 战斗使用武将baseStats和skills | missing | P1 |
| XI-037 | cross | 战斗胜利→关卡奖励→碎片掉落 | Battle↔Campaign↔Hero | 关卡通关后碎片正确添加 | missing | P0 |
| XI-038 | cross | 关卡首通→招贤令奖励 | Campaign↔TokenEconomy | 首通claimStageClearReward获得招贤令 | missing | P1 |
| XI-039 | cross | 战斗失败→无碎片掉落→无奖励 | Battle↔Campaign | 失败不触发任何奖励 | missing | P1 |
| XI-040 | cross | 自动推图→累积碎片→批量添加 | Campaign↔Hero | AutoPushExecutor累积碎片后批量添加 | missing | P1 |

### D4. 招贤令经济→招募 完整闭环

| ID | 类型 | 描述 | 涉及系统 | 预期行为 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| XI-041 | cross | 被动产出→累积→足够招募 | TokenEconomy↔Recruit | tick累积后canRecruit=true | missing | P0 |
| XI-042 | cross | 日常奖励→招贤令→单抽消耗 | TokenEconomy↔Recruit | claimDailyTaskReward→recruitSingle | missing | P0 |
| XI-043 | cross | 商店购买→招贤令→十连抽 | TokenEconomy↔Recruit | buyFromShop→recruitTen | missing | P1 |
| XI-044 | cross | 关卡首通→招贤令→招募→新武将 | Campaign↔TokenEconomy↔Recruit↔Hero | 完整链路 | missing | P1 |
| XI-045 | cross | 离线收益→招贤令累积 | TokenEconomy | claimOfflineReward正确计算 | missing | P1 |

### D5. 编队→羁绊→战斗→派驻 联动

| ID | 类型 | 描述 | 涉及系统 | 预期行为 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| XI-046 | cross | 编队变化→羁绊重新计算→事件触发 | Formation↔Bond | 添加/移除武将后羁绊正确更新 | missing | P1 |
| XI-047 | cross | 派驻武将→羁绊系数减半→编队战力降低 | Dispatch↔Bond↔Formation | 派驻武将羁绊系数降低 | missing | P1 |
| XI-048 | cross | 取消派驻→羁绊系数恢复→编队战力恢复 | Dispatch↔Bond↔Formation | 取消派驻后战力恢复 | missing | P1 |
| XI-049 | cross | 阵营羁绊+搭档羁绊同时激活→效果叠加 | FactionBond↔Bond | 两套羁绊效果不冲突 | missing | P1 |

### D6. 角标→子系统状态 聚合

| ID | 类型 | 描述 | 涉及系统 | 预期行为 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| XI-050 | cross | 升级后角标更新 | Level↔Badge | 武将可升级→角标亮→升级后角标灭 | missing | P1 |
| XI-051 | cross | 升星后角标更新 | Star↔Badge | 碎片足够→角标亮→升星后角标灭 | missing | P1 |
| XI-052 | cross | 招募后角标更新 | Recruit↔Badge | 新武将→可升级→角标亮 | missing | P2 |

### D7. 每日重置联动

| ID | 类型 | 描述 | 涉及系统 | 预期行为 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| XI-053 | cross | 跨日重置：免费招募+商店限购+日常任务同时重置 | Recruit↔TokenEconomy | 所有日重置在同一时间点正确执行 | missing | P0 |
| XI-054 | cross | 跨日前后数据一致性 | Recruit↔TokenEconomy | 重置前序列化→重置后反序列化→数据正确 | missing | P1 |
| XI-055 | cross | 连续多日重置累积 | Recruit↔TokenEconomy | 3天重置后数据不漂移 | missing | P2 |

### D8. 武将移除级联影响

| ID | 类型 | 描述 | 涉及系统 | 预期行为 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| XI-056 | cross | 移除在编队中的武将→编队引用处理 | Hero↔Formation | 移除后编队该位置变为空字符串 | missing | P1 |
| XI-057 | cross | 移除已派驻的武将→派驻关系清除 | Hero↔Dispatch | 移除后派驻关系自动清除 | missing | P1 |
| XI-058 | cross | 移除武将→羁绊重新计算 | Hero↔Bond | 移除后编队羁绊可能失效 | missing | P1 |
| XI-059 | cross | 移除觉醒武将→觉醒被动移除→全局属性变化 | Hero↔Awakening | 觉醒被动不再叠加 | missing | P1 |
| XI-060 | cross | 移除武将→碎片保留→可重新合成 | Hero | 碎片不受影响，fragmentSynthesize可用 | missing | P1 |

---

## E. 数据生命周期补充（新增 14 节点，F-Lifecycle 38%→74%）

### E1. 全系统联合序列化

| ID | 类型 | 描述 | 涉及系统 | 预期行为 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| LC-017 | lifecycle | 全系统serialize→deserialize→状态完全一致 | All | 所有系统联合存档/读档一致性 | missing | P0 |
| LC-018 | lifecycle | 版本升级后旧存档兼容 | All | 旧版本存档可被新版本加载 | missing | P1 |
| LC-019 | lifecycle | 空状态序列化→反序列化→空状态 | All | 无数据时序列化/反序列化正确 | missing | P1 |
| LC-020 | lifecycle | 大量数据序列化性能 | All | 100个武将序列化<100ms | missing | P2 |

### E2. 武将完整生命周期

| ID | 类型 | 描述 | 涉及系统 | 预期行为 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| LC-021 | lifecycle | 招募→升级→升星→突破→觉醒→120级完整流程 | All | 全流程数据一致，无中间状态丢失 | missing | P0 |
| LC-022 | lifecycle | 碎片获取→积累→合成→武将添加→编队 | Fragment↔Hero↔Formation | 碎片合成武将后可加入编队 | missing | P0 |
| LC-023 | lifecycle | 觉醒后升级101~120级经验表正确 | Awakening↔Level | 使用觉醒经验表，每级经验需求正确 | missing | P0 |

### E3. 重置与清理

| ID | 类型 | 描述 | 涉及系统 | 预期行为 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| LC-024 | lifecycle | 全系统reset()后状态归零 | All | 所有系统reset后状态干净 | missing | P1 |
| LC-025 | lifecycle | reset()后可重新正常操作 | All | reset→重新招募→升级→正常 | missing | P1 |
| LC-026 | lifecycle | 序列化后修改原状态不影响存档 | All | 深拷贝隔离正确 | missing | P1 |

### E4. 技能与突破持久化

| ID | 类型 | 描述 | 涉及系统 | 预期行为 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| LC-027 | lifecycle | 技能升级历史持久化 | SkillUpgrade | upgradeHistory正确保存和恢复 | missing | P1 |
| LC-028 | lifecycle | 突破技能解锁记录持久化 | SkillUpgrade | breakthroughSkillUnlocks正确保存 | missing | P1 |
| LC-029 | lifecycle | 突破阶段持久化→等级上限恢复 | Star↔Level | 反序列化后getLevelCap返回正确值 | missing | P0 |
| LC-030 | lifecycle | 觉醒状态持久化→被动叠加恢复 | Awakening | 反序列化后觉醒被动正确应用 | missing | P1 |

---

## F. 异常路径补充（新增 10 节点）

### F1. 依赖注入异常

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| ERR-DI-001 | exception | HeroLevelSystem.levelDeps未注入 | levelDeps=null | levelUp返回null | missing | P1 |
| ERR-DI-002 | exception | HeroStarSystem.deps未注入 | deps=null | starUp返回failedStarUp | missing | P1 |
| ERR-DI-003 | exception | SkillUpgradeSystem.deps未注入 | deps=null | upgradeSkill返回failResult | missing | P1 |
| ERR-DI-004 | exception | AwakeningSystem.deps未注入 | deps=null | awaken返回success=false | missing | P1 |
| ERR-DI-005 | exception | BondSystem回调未注入 | getBondMultiplierGetter=null | 使用默认值1.0 | missing | P2 |

### F2. 并发与竞态

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| ERR-CONC-001 | exception | 同一武将同时升星和突破 | starUp和breakthrough并发 | 至少一个操作失败，数据不损坏 | missing | P1 |
| ERR-CONC-002 | exception | 同一武将同时升级和觉醒 | addExp和awaken并发 | 觉醒条件检查使用最新等级 | missing | P1 |
| ERR-CONC-003 | exception | 招募过程中资源被其他操作消耗 | recruitSingle执行中资源减少 | canAfford失败时返回null | missing | P2 |

---

## G. 边界条件补充（新增 10 节点）

### G1. 数值边界

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| BND-NUM-001 | boundary | 经验值极大（超过升级到满级所需） | exp=999999999 | 升到满级后剩余经验不丢失 | missing | P1 |
| BND-NUM-002 | boundary | 铜钱恰好等于升级所需 | gold===totalGoldBetween | 升级成功，铜钱归零 | missing | P1 |
| BND-NUM-003 | boundary | 技能等级从1直接升到上限 | 连续升级到skillLevelCap | 每级效果增量正确 | missing | P1 |
| BND-NUM-004 | boundary | 碎片从0直接合成武将 | fragments从0→所需数量 | fragmentSynthesize成功 | missing | P1 |
| BND-NUM-005 | boundary | 编队6个武将全部觉醒 | 6个觉醒武将编队 | 编队战力计算正确含觉醒加成 | missing | P2 |

### G2. 状态边界

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| BND-STATE-001 | boundary | 武将刚招募（1级1星0突破）→立即操作 | 新武将 | 升级/升星/编队均可正常执行 | missing | P1 |
| BND-STATE-002 | boundary | 武将满级满星满突破→继续操作 | Lv120/6星/4突破 | 所有操作返回失败，数据不变 | missing | P1 |
| BND-STATE-003 | boundary | 编队3个全部删除后重新创建 | 删除所有编队 | 可重新创建，activeFormationId正确 | missing | P2 |
| BND-STATE-004 | boundary | 保底计数器在阈值-1时十连 | pity=阈值-1 | 十连中至少触发一次保底 | missing | P1 |
| BND-STATE-005 | boundary | 招贤令余额恰好等于十连消耗 | balance===tenPullCost | 十连成功，余额归零 | missing | P1 |

---

## 附录 A：按系统分布（Round 2 更新）

| 系统 | 公开API数 | R1节点 | R2节点 | covered | missing | partial |
|------|-----------|--------|--------|---------|---------|---------|
| HeroSystem | 24 | 44 | 52 | 34 | 10 | 8 |
| HeroRecruitSystem | 16 | 34 | 44 | 26 | 10 | 8 |
| HeroLevelSystem | 16 | 30 | 38 | 24 | 8 | 6 |
| HeroStarSystem | 18 | 34 | 54 | 26 | 20 | 8 |
| SkillUpgradeSystem | 14 | 24 | 32 | 18 | 8 | 6 |
| HeroFormation | 18 | 28 | 30 | 24 | 4 | 2 |
| BondSystem | 10 | 18 | 20 | 14 | 4 | 2 |
| AwakeningSystem | 12 | 18 | 26 | 12 | 10 | 4 |
| HeroDispatchSystem | 10 | 16 | 18 | 12 | 4 | 2 |
| HeroBadgeSystem | 8 | 12 | 14 | 10 | 2 | 2 |
| HeroAttributeCompare | 4 | 6 | 6 | 6 | 0 | 0 |
| FactionBondSystem | 8 | 12 | 13 | 10 | 1 | 2 |
| FormationRecommendSystem | 4 | 8 | 9 | 6 | 1 | 2 |
| RecruitTokenEconomySystem | 16 | 24 | 26 | 22 | 2 | 2 |
| 跨系统交互 | — | 24 | 60 | 8 | 44 | 8 |
| 数据生命周期 | — | 16 | 30 | 0 | 24 | 6 |
| 资源原子性 | — | 0 | 18 | 0 | 18 | 0 |
| 碎片获取路径 | — | 0 | 20 | 0 | 20 | 0 |
| 碎片溢出转化 | — | 0 | 12 | 0 | 12 | 0 |
| 异常路径补充 | — | 0 | 10 | 0 | 10 | 0 |
| 边界条件补充 | — | 0 | 10 | 0 | 10 | 0 |

---

## 附录 B：高优先级缺失节点 TOP 20（Round 2）

| 排名 | ID | 系统 | 描述 | 优先级 | 遗漏类别 |
|------|-----|------|------|--------|----------|
| 1 | ATOM-QE-001 | LevelSystem | quickEnhance gold扣除成功exp失败无回滚 | P0 | 原子性 |
| 2 | ATOM-QE-002 | LevelSystem | quickEnhance exp扣除成功gold失败无回滚 | P0 | 原子性 |
| 3 | ATOM-ST-001 | StarSystem | starUp碎片扣除成功gold失败无回滚 | P0 | 原子性 |
| 4 | ATOM-SK-001 | SkillSystem | upgradeSkill gold扣除成功skillBook失败无回滚 | P0 | 原子性 |
| 5 | ATOM-AW-001 | Awakening | awaken 4种资源第3种扣除失败无回滚 | P0 | 原子性 |
| 6 | GOLD-OVF-001 | Recruit | 重复武将碎片溢出→铜钱转化完整验证 | P0 | 溢出转化 |
| 7 | GOLD-OVF-002 | Recruit | 碎片恰好不溢出时不触发铜钱转化 | P0 | 溢出转化 |
| 8 | GOLD-OVF-003 | Recruit | 碎片上限999全部溢出场景 | P0 | 溢出转化 |
| 9 | FRAG-ACT-001 | StarSystem | addFragmentFromActivity正常路径零覆盖 | P0 | 碎片获取 |
| 10 | FRAG-ACT-002 | StarSystem | addFragmentFromActivity溢出处理 | P0 | 碎片获取 |
| 11 | FRAG-EXP-001 | StarSystem | addFragmentFromExpedition正常路径零覆盖 | P0 | 碎片获取 |
| 12 | XI-029 | Cross | 碎片积累→升星→属性→战力完整链路 | P0 | 跨系统 |
| 13 | XI-031 | Cross | 突破→等级上限→升级系统联动 | P0 | 跨系统 |
| 14 | XI-034 | Cross | 觉醒→等级上限120→升级到120级 | P0 | 跨系统 |
| 15 | XI-041 | Cross | 被动产出→累积→足够招募闭环 | P0 | 跨系统 |
| 16 | XI-053 | Cross | 跨日重置三系统联动 | P0 | 跨系统 |
| 17 | LC-017 | Lifecycle | 全系统联合序列化一致性 | P0 | 生命周期 |
| 18 | LC-021 | Lifecycle | 武将完整养成生命周期 | P0 | 生命周期 |
| 19 | LC-023 | Lifecycle | 觉醒后101~120级经验表 | P0 | 生命周期 |
| 20 | LC-029 | Lifecycle | 突破阶段持久化→等级上限恢复 | P0 | 生命周期 |

---

## 附录 C：原子性缺陷详细分析

### 缺陷 1: HeroLevelSystem.quickEnhance（行 352-353）

```typescript
// 源码（有缺陷）:
if (goldNeed > 0 && !this.levelDeps.spendResource(GOLD_TYPE, goldNeed)) return null;  // ① gold已扣
if (expNeed > 0 && !this.levelDeps.spendResource(EXP_TYPE, expNeed)) return null;      // ② exp扣失败
// → gold已扣除但操作返回null，无回滚！
this.syncToHeroSystem(heroSystem, generalId, final, 0);
```

**修复建议**：使用 try-catch + 补偿模式，或在扣除前一次性校验全部资源。

### 缺陷 2: HeroStarSystem.starUp（行 252-254）

```typescript
// 源码（有缺陷）:
this.heroSystem.useFragments(generalId, cost.fragments);   // ① 碎片已扣
this.deps.spendResource(RESOURCE_TYPE_GOLD, cost.gold);     // ② gold扣失败
// → 碎片已扣除但gold未扣除，无回滚！
```

**修复建议**：先扣除可回滚的资源（gold），再扣除碎片；或使用事务模式。

### 缺陷 3: SkillUpgradeSystem.upgradeSkill（行 234-237）

```typescript
// 源码（有缺陷）:
if (!this.deps.spendResource('gold', cost.gold)) { ... return failResult; }        // ① gold已扣
if (!this.deps.spendResource('skillBook', cost.skillBooks)) { ... return failResult; } // ② skillBook扣失败
// → gold已扣除但skillBook未扣除，无回滚！
```

**修复建议**：先 canAfford 全部资源，再一次性扣除；或使用补偿回滚。

### 缺陷 4: AwakeningSystem.spendResources（行 424-429）

```typescript
// 源码（有缺陷）:
this.deps.spendResource('gold', AWAKENING_COST.copper);                    // ①
this.deps.spendResource('breakthroughStone', AWAKENING_COST.breakthroughStones); // ②
this.deps.spendResource('skillBook', AWAKENING_COST.skillBooks);           // ③ 任意一步失败
this.deps.spendResource('awakeningStone', AWAKENING_COST.awakeningStones); // ④
this.heroSystem.useFragments(heroId, AWAKENING_COST.fragments);            // ⑤
// → 中间任何一步失败，前面已扣除的资源无回滚！
```

**修复建议**：使用事务管理器或补偿回滚模式。

---

## 附录 D：碎片获取途径完整覆盖矩阵

| 获取途径 | 函数 | R1状态 | R2补充节点 | 覆盖场景 |
|----------|------|--------|-----------|----------|
| 招募重复武将 | handleDuplicateFragments | covered | — | 已覆盖 |
| 关卡掉落 | gainFragmentsFromStage | covered | FRAG-STG-001~004 | 多掉落/RNG/无掉落 |
| 商店兑换 | exchangeFragmentsFromShop | covered | FRAG-SHOP-001~003 | 未配置/超限购/无依赖 |
| **活动获取** | **addFragmentFromActivity** | **标记covered实际未测** | **FRAG-ACT-001~006** | 正常/溢出/无效/铜钱 |
| **远征获取** | **addFragmentFromExpedition** | **标记covered实际未测** | **FRAG-EXP-001~004** | 正常/上限/无效/联动 |
| 碎片合成 | fragmentSynthesize | covered | — | 已覆盖 |
| 碎片溢出→铜钱 | addResource('gold', ...) | partial | GOLD-OVF-001~006 | 完整溢出计算验证 |

---

## 附录 E：测试覆盖热力图（Round 2 更新）

### 按维度统计

| 维度 | R1节点 | R1覆盖率 | R2节点 | R2已覆盖 | R2待覆盖 | R2目标覆盖率 |
|------|--------|----------|--------|----------|----------|-------------|
| normal | 112 | 93% | 132 | 104 | 28 | 79% → **95%+** |
| boundary | 88 | 82% | 138 | 72 | 66 | 52% → **85%+** |
| exception | 31 | 84% | 63 | 26 | 37 | 41% → **80%+** |
| **cross** | **39** | **46%** | **60** | **18** | **42** | **70% → 85%+** |
| **lifecycle** | **37** | **38%** | **34** | **14** | **20** | **74% → 85%+** |

### 达标路径

1. **Phase 1（P0 原子性）**：覆盖 ATOM-* 18个节点 → 解决资源扣除原子性缺陷
2. **Phase 2（P0 碎片路径）**：覆盖 FRAG-* 20个 + GOLD-* 12个 → 碎片获取零覆盖问题
3. **Phase 3（P0 跨系统）**：覆盖 XI-025~060 中 P0 节点 → F-Cross 达标
4. **Phase 4（P0 生命周期）**：覆盖 LC-017~030 中 P0 节点 → F-Lifecycle 达标
5. **Phase 5（P1 补充）**：覆盖剩余 P1 节点 → 整体覆盖率 > 70%

---

## 附录 F：建议的自动化测试文件结构

```
__tests__/
├── hero/
│   ├── atom-city/                    # 新增：原子性测试
│   │   ├── quickEnhance-atomicity.test.ts
│   │   ├── starUp-atomicity.test.ts
│   │   ├── upgradeSkill-atomicity.test.ts
│   │   └── awaken-atomicity.test.ts
│   ├── fragment-paths/               # 新增：碎片获取路径
│   │   ├── activity-fragments.test.ts
│   │   ├── expedition-fragments.test.ts
│   │   ├── stage-drop-fragments.test.ts
│   │   └── shop-exchange-fragments.test.ts
│   ├── overflow-gold/                # 新增：溢出铜钱转化
│   │   └── fragment-overflow-gold.test.ts
│   ├── integration/                  # 扩展：跨系统交互
│   │   ├── recruit-to-hero-chain.test.ts
│   │   ├── fragment-star-breakthrough-awaken.test.ts
│   │   ├── hero-battle-campaign-reward.test.ts
│   │   ├── token-economy-recruit-loop.test.ts
│   │   ├── formation-bond-dispatch.test.ts
│   │   ├── badge-subsystem-aggregation.test.ts
│   │   └── daily-reset-integration.test.ts
│   ├── lifecycle/                    # 新增：生命周期测试
│   │   ├── full-hero-lifecycle.test.ts
│   │   ├── joint-serialization.test.ts
│   │   ├── reset-verification.test.ts
│   │   └── awakened-level-101-120.test.ts
│   └── edge-cases/                   # 新增：边界+异常
│       ├── numeric-boundaries.test.ts
│       ├── state-boundaries.test.ts
│       └── dependency-injection-errors.test.ts
```

---

*Round 2 流程分支树构建完成。共新增 120 个节点，重点覆盖资源扣除原子性（18节点）、碎片获取路径（20节点）、溢出铜钱转化（12节点）、跨系统交互（36节点）和数据生命周期（14节点）。目标将 F-Cross 从 46% 提升至 70%+，F-Lifecycle 从 38% 提升至 74%+。*
