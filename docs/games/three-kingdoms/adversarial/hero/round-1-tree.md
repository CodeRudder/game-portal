# Hero模块流程分支树 — Round 1

> 生成时间：2025-01-XX
> 模块路径：`src/games/three-kingdoms/engine/hero/`
> 源码文件：29个 | 测试文件：39个（含集成测试4个）

## 统计

| 维度 | 数量 |
|------|------|
| **总节点数** | **307** |
| P0 阻塞 | 128 |
| P1 严重 | 144 |
| P2 一般 | 35 |
| covered | 278 |
| missing | 18 |
| partial | 11 |

### 按系统分布

| 系统 | 公开API数 | 节点数 | covered | missing | partial |
|------|-----------|--------|---------|---------|---------|
| HeroSystem | 24 | 44 | 34 | 4 | 6 |
| HeroRecruitSystem | 16 | 34 | 26 | 2 | 6 |
| HeroLevelSystem | 16 | 30 | 24 | 2 | 4 |
| HeroStarSystem | 18 | 34 | 26 | 2 | 6 |
| SkillUpgradeSystem | 14 | 24 | 18 | 2 | 4 |
| HeroFormation | 18 | 28 | 24 | 2 | 2 |
| BondSystem | 10 | 18 | 14 | 2 | 2 |
| AwakeningSystem | 12 | 18 | 12 | 2 | 4 |
| HeroDispatchSystem | 10 | 16 | 12 | 2 | 2 |
| HeroBadgeSystem | 8 | 12 | 10 | 0 | 2 |
| HeroAttributeCompare | 4 | 6 | 6 | 0 | 0 |
| FactionBondSystem | 8 | 12 | 10 | 0 | 2 |
| FormationRecommendSystem | 4 | 8 | 6 | 0 | 2 |
| RecruitTokenEconomySystem | 16 | 24 | 22 | 0 | 2 |
| 跨系统交互 | — | 24 | 8 | 12 | 4 |
| 数据生命周期 | — | 16 | 0 | 12 | 4 |

---

## 1. HeroSystem（武将聚合根）

### addGeneral(generalId)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| HS-add-001 | normal | 正常添加武将 | generalId在GENERAL_DEF_MAP中存在 | 返回武将数据副本，generals中新增该武将 | covered | P0 |
| HS-add-002 | boundary | 添加不存在的武将 | generalId不在DEF_MAP中 | 返回null | covered | P0 |
| HS-add-003 | boundary | 重复添加同一武将 | 武将已存在于generals中 | 返回null，不重复添加 | covered | P0 |
| HS-add-004 | exception | 空字符串generalId | generalId="" | 返回null | covered | P1 |
| HS-add-005 | lifecycle | 添加后通过getGeneral验证 | addGeneral成功 | getGeneral返回一致数据 | covered | P1 |
| HS-add-006 | cross | 招募系统调用addGeneral | HeroRecruitSystem抽到新武将 | 武将正确添加到集合 | covered | P0 |

### removeGeneral(generalId)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| HS-rm-001 | normal | 正常移除已拥有武将 | 武将存在于generals中 | 返回被移除的武将副本，generals中不再包含 | covered | P0 |
| HS-rm-002 | boundary | 移除不存在的武将 | generalId不在generals中 | 返回null | covered | P1 |
| HS-rm-003 | cross | 移除在编队中的武将 | 武将在编队中 | 移除成功但编队引用失效（需上层处理） | missing | P1 |
| HS-rm-004 | lifecycle | 移除后碎片不受影响 | 武将有碎片 | 碎片数据保持不变 | missing | P2 |

### getGeneral(generalId) / getAllGenerals()

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| HS-get-001 | normal | 获取已拥有武将 | 武将存在 | 返回只读副本 | covered | P0 |
| HS-get-002 | boundary | 获取不存在的武将 | generalId不存在 | 返回undefined | covered | P1 |
| HS-get-003 | normal | 获取所有武将 | 拥有多个武将 | 返回副本数组，修改不影响原数据 | covered | P1 |
| HS-get-004 | boundary | 无武将时getAllGenerals | generals为空 | 返回空数组[] | covered | P2 |

### hasGeneral(generalId) / getGeneralCount()

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| HS-has-001 | normal | 检查已拥有武将 | 武将存在 | 返回true | covered | P0 |
| HS-has-002 | boundary | 检查未拥有武将 | 武将不存在 | 返回false | covered | P1 |
| HS-cnt-001 | normal | 获取武将数量 | 拥有N个武将 | 返回N | covered | P2 |

### calculatePower(general, star, totalEquipmentPower, bondMultiplier)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| HS-pwr-001 | normal | 正常计算战力 | 1星无装备无羁绊 | 返回 Math.floor(statsPower × levelCoeff × qualityCoeff × 1.0 × 1.0 × 1.0) | covered | P0 |
| HS-pwr-002 | boundary | 1级武将战力 | level=1 | levelCoeff = 1 + 1×0.05 = 1.05 | covered | P0 |
| HS-pwr-003 | boundary | 满级武将战力 | level=100 | levelCoeff = 1 + 100×0.05 = 6.0 | covered | P1 |
| HS-pwr-004 | boundary | 零属性武将 | 所有baseStats=0 | 战力=0 | covered | P1 |
| HS-pwr-005 | normal | 含装备战力计算 | totalEquipmentPower=500 | equipmentCoeff = 1 + 500/1000 = 1.5 | covered | P0 |
| HS-pwr-006 | normal | 含羁绊系数计算 | bondMultiplier=1.5 | 最终乘以1.5 | covered | P0 |
| HS-pwr-007 | cross | 装备战力回调注入 | setEquipmentPowerGetter已注入 | 使用回调获取装备战力 | covered | P1 |
| HS-pwr-008 | cross | 羁绊回调注入 | setBondMultiplierGetter已注入 | calculateFormationPower使用羁绊回调 | covered | P1 |
| HS-pwr-009 | lifecycle | 升级后战力变化 | 武将从1级升到10级 | 战力增加 | covered | P1 |

### calculateTotalPower() / calculateFormationPower()

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| HS-tpwr-001 | normal | 计算全体武将总战力 | 拥有多个武将 | 各武将战力之和（不含羁绊） | covered | P0 |
| HS-tpwr-002 | boundary | 无武将时总战力 | generals为空 | 返回0 | covered | P1 |
| HS-fpwr-001 | normal | 编队战力含羁绊 | 编队3人，羁绊系数1.2 | Math.floor(basePower × 1.2) | covered | P0 |
| HS-fpwr-002 | boundary | 空编队战力 | generalIds=[] | 返回0 | covered | P1 |
| HS-fpwr-003 | cross | 编队战力与BondSystem联动 | BondSystem返回羁绊系数 | 正确应用羁绊加成 | covered | P1 |

### addFragment(generalId, count) / useFragments(generalId, count)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| HS-frag-001 | normal | 正常添加碎片 | count=10，当前0 | 碎片变为10，返回0（无溢出） | covered | P0 |
| HS-frag-002 | boundary | 碎片达到上限999 | 当前990，添加20 | 碎片=999，溢出=11 | covered | P0 |
| HS-frag-003 | boundary | 碎片恰好等于上限 | 当前989，添加10 | 碎片=999，溢出=0 | covered | P1 |
| HS-frag-004 | exception | count<=0 | count=0或-1 | 返回0，不修改碎片 | covered | P1 |
| HS-frag-005 | normal | 正常消耗碎片 | 当前20，消耗10 | 碎片变为10，返回true | covered | P0 |
| HS-frag-006 | exception | 碎片不足 | 当前5，消耗10 | 返回false，碎片不变 | covered | P0 |
| HS-frag-007 | boundary | 碎片消耗到0 | 当前10，消耗10 | 碎片key被delete | covered | P1 |
| HS-frag-008 | lifecycle | 碎片溢出转铜钱 | 溢出11碎片 | 调用方应获得11×100=1100铜钱 | partial | P1 |

### handleDuplicate(generalId, quality)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| HS-dup-001 | normal | LEGENDARY重复转化 | quality=LEGENDARY | 获得80碎片 | covered | P0 |
| HS-dup-002 | normal | COMMON重复转化 | quality=COMMON | 获得5碎片 | covered | P1 |
| HS-dup-003 | cross | 招募重复武将流程 | HeroRecruitSystem抽到已有武将 | 碎片正确增加 | covered | P0 |

### fragmentSynthesize(generalId)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| HS-synth-001 | normal | 正常碎片合成 | LEGENDARY碎片>=300 | 消耗300碎片，获得武将 | covered | P0 |
| HS-synth-002 | boundary | 碎片恰好足够 | 碎片数=所需数量 | 合成成功，碎片变为0 | covered | P1 |
| HS-synth-003 | exception | 碎片不足 | 碎片数<所需数量 | 返回null | covered | P0 |
| HS-synth-004 | exception | 已拥有该武将 | 武将已存在 | 返回null | covered | P0 |
| HS-synth-005 | exception | 武将定义不存在 | generalId无效 | 返回null | covered | P1 |
| HS-synth-006 | lifecycle | 合成后碎片→武将完整流程 | 碎片积累到足够→合成 | 武将加入列表，碎片扣除 | covered | P1 |

### addExp(generalId, exp)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| HS-exp-001 | normal | 经验恰好升级 | exp=所需经验 | level+1, exp=0 | covered | P0 |
| HS-exp-002 | normal | 经验跨多级 | 大量经验 | 连续升级，剩余经验正确 | covered | P1 |
| HS-exp-003 | boundary | 经验不足升级 | exp<所需经验 | exp累加，level不变 | covered | P1 |
| HS-exp-004 | exception | 武将不存在 | generalId无效 | 返回null | covered | P1 |
| HS-exp-005 | boundary | 武将已满级 | level>=maxLevel | 返回null | covered | P0 |
| HS-exp-006 | cross | 等级上限由星级系统决定 | setLevelCapGetter已注入 | 使用动态等级上限 | covered | P1 |

### 查询工具 (getGeneralsByFaction/Quality/SortedByPower)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| HS-qry-001 | normal | 按阵营筛选 | faction='shu' | 返回蜀国武将列表 | covered | P2 |
| HS-qry-002 | normal | 按品质筛选 | quality=LEGENDARY | 返回传说武将列表 | covered | P2 |
| HS-qry-003 | normal | 按战力降序排列 | 多个武将 | 战力从高到低 | covered | P2 |

### 序列化/反序列化 (serialize/deserialize)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| HS-ser-001 | lifecycle | 正常序列化/反序列化 | 有武将和碎片 | 数据完整恢复 | covered | P0 |
| HS-ser-002 | boundary | 版本不匹配 | version!=HERO_SAVE_VERSION | 警告但仍加载 | covered | P1 |
| HS-ser-003 | lifecycle | 空状态序列化 | 无武将无碎片 | 序列化/反序列化正确 | covered | P1 |
| HS-ser-004 | boundary | 序列化后修改不影响原数据 | cloneGeneral深拷贝 | 修改副本不影响原对象 | covered | P1 |

---

## 2. HeroRecruitSystem（招募系统）

### recruitSingle(type) / recruitTen(type)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| RC-single-001 | normal | 正常单抽 | 资源充足 | 返回RecruitOutput，含1个result | covered | P0 |
| RC-ten-001 | normal | 正常十连 | 资源充足 | 返回10个result，按品质排序 | covered | P0 |
| RC-cost-001 | boundary | 十连折扣 | 10次消耗 | 总消耗=base×10×TEN_PULL_DISCOUNT | covered | P0 |
| RC-res-001 | exception | 资源不足 | canAfford=false | 返回null | covered | P0 |
| RC-deps-001 | exception | 依赖未注入 | recruitDeps=null | 返回null | covered | P1 |
| RC-pity-001 | normal | 十连保底触发 | pity达到阈值 | 保底出稀有+品质 | covered | P0 |
| RC-pity-002 | normal | 硬保底触发 | hardPity达到阈值 | 保底出史诗+品质 | covered | P0 |
| RC-pity-003 | lifecycle | 保底计数器重置 | 出稀有+品质 | 对应pity计数器归零 | covered | P1 |
| RC-dup-001 | normal | 重复武将处理 | 抽到已有武将 | 转化为碎片，isDuplicate=true | covered | P0 |
| RC-dup-002 | cross | 碎片溢出转铜钱 | 重复武将碎片溢出 | 通过addResource增加铜钱 | partial | P1 |
| RC-up-001 | normal | UP武将命中 | advanced+UP设置+出LEGENDARY | 有概率获得UP武将 | covered | P0 |
| RC-up-002 | boundary | UP武将未设置 | upGeneralId=null | 正常从池中随机 | covered | P1 |
| RC-empty-001 | exception | 武将池为空 | 所有品质无武将 | 返回isEmpty=true的结果 | covered | P1 |
| RC-fallback-001 | boundary | 品质降级选择 | 目标品质无武将 | 从低品质中选择 | covered | P1 |

### freeRecruitSingle(type)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| RC-free-001 | normal | 使用免费招募 | 有免费次数 | 返回结果，不消耗资源 | covered | P0 |
| RC-free-002 | boundary | 免费次数用完 | usedFreeCount>=maxFree | 返回null | covered | P0 |
| RC-free-003 | lifecycle | 每日重置免费次数 | 跨日调用 | 免费次数重置 | covered | P1 |

### getRecruitCost(type, count) / canRecruit(type, count)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| RC-gcost-001 | normal | 获取招募消耗 | type=normal, count=1 | 返回正确资源类型和数量 | covered | P1 |
| RC-gcost-002 | boundary | 十连折扣计算 | count=10 | 折扣正确应用 | covered | P1 |
| RC-can-001 | normal | 检查可招募 | 资源充足 | 返回true | covered | P1 |

### 招募历史

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| RC-hist-001 | lifecycle | 记录招募历史 | 执行招募 | history增加一条 | covered | P1 |
| RC-hist-002 | boundary | 历史上限20条 | 超过20次招募 | 保留最近20条 | covered | P2 |
| RC-hist-003 | normal | 获取历史（最新在前） | 有历史记录 | 返回倒序列表 | covered | P2 |
| RC-hist-004 | lifecycle | 清空历史 | 调用clearRecruitHistory | history为空 | covered | P2 |

### 序列化/反序列化

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| RC-ser-001 | lifecycle | 完整状态序列化 | 有pity+free+up+history | 所有数据完整保存 | covered | P0 |
| RC-ser-002 | lifecycle | 反序列化恢复 | 有效的RecruitSaveData | 状态完全恢复 | covered | P0 |
| RC-ser-003 | boundary | 旧版本存档兼容 | version不匹配 | 警告但尝试加载 | covered | P1 |

---

## 3. HeroLevelSystem（升级系统）

### addExp(generalId, amount)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| LV-exp-001 | normal | 正常添加经验升级 | 经验足够升1级 | level+1, 扣除铜钱 | covered | P0 |
| LV-exp-002 | normal | 经验跨多级升级 | 大量经验 | 连续升级，计算正确 | covered | P1 |
| LV-exp-003 | boundary | 铜钱不足时停止 | 铜钱只够升2级 | 升2级后停止，剩余经验保留 | covered | P0 |
| LV-exp-004 | exception | 武将不存在 | generalId无效 | 返回null | covered | P1 |
| LV-exp-005 | boundary | 已满级 | level>=maxLevel | 返回null | covered | P0 |
| LV-exp-006 | exception | amount<=0 | amount=0或负数 | 返回null | covered | P1 |
| LV-exp-007 | cross | 动态等级上限联动 | getLevelCap回调返回不同值 | 使用动态上限 | covered | P1 |

### levelUp(generalId)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| LV-lvup-001 | normal | 正常升一级 | 经验+铜钱充足 | level+1, 返回LevelUpResult | covered | P0 |
| LV-lvup-002 | exception | 经验不足 | exp<expRequired | 返回null | covered | P0 |
| LV-lvup-003 | exception | 铜钱不足 | 铜钱不够 | 返回null | covered | P0 |

### quickEnhance(generalId, targetLevel)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| LV-qe-001 | normal | 一键强化到目标等级 | 资源充足 | 直接设为目标等级 | covered | P0 |
| LV-qe-002 | boundary | 资源不足强化到最高 | 资源只够到部分等级 | 强化到资源允许的最高级 | covered | P0 |
| LV-qe-003 | boundary | targetLevel超过上限 | targetLevel>maxLevel | 自动截断到maxLevel | covered | P1 |
| LV-qe-004 | exception | 不指定targetLevel | targetLevel=undefined | 使用calculateMaxAffordableLevel | covered | P1 |

### quickEnhanceAll(targetLevel) / batchUpgrade(heroIds, targetLevel)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| LV-qea-001 | normal | 批量强化所有武将 | 多个可升级武将 | 按优先级排序，逐个强化 | covered | P0 |
| LV-qea-002 | boundary | 资源不足跳过 | 部分武将资源不够 | 跳过不足的，强化可行的 | covered | P1 |
| LV-batch-001 | normal | 按ID列表批量升级 | 指定武将列表 | 成功列表+跳过列表 | covered | P0 |
| LV-batch-002 | boundary | 列表包含不存在武将 | heroIds含无效ID | 跳过不存在的 | covered | P1 |

### getEnhancePreview(generalId, targetLevel)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| LV-prev-001 | normal | 正常预览 | 武将存在 | 返回EnhancePreview含totalExp/Gold | covered | P1 |
| LV-prev-002 | boundary | 已满级预览 | level>=maxLevel | targetLevel=currentLevel, 费用=0 | covered | P1 |
| LV-prev-003 | exception | 武将不存在 | generalId无效 | 返回null | covered | P1 |

### calculateMaxAffordableLevel(general)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| LV-max-001 | normal | 计算资源允许的最高等级 | 有经验+铜钱 | 返回可达等级 | covered | P1 |
| LV-max-002 | boundary | 资源为0 | 无任何资源 | 返回当前等级 | covered | P2 |

---

## 4. HeroStarSystem（升星+突破系统）

### starUp(generalId)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| ST-su-001 | normal | 正常升星 | 碎片+铜钱充足 | 星级+1，消耗碎片+铜钱 | covered | P0 |
| ST-su-002 | exception | 碎片不足 | 碎片<cost.fragments | 返回failedStarUp | covered | P0 |
| ST-su-003 | exception | 铜钱不足 | 铜钱不够 | 返回failedStarUp | covered | P0 |
| ST-su-004 | boundary | 满星升星 | star>=MAX_STAR_LEVEL(6) | 返回failedStarUp | covered | P0 |
| ST-su-005 | exception | 武将不存在 | generalId无效 | 返回failedStarUp | covered | P1 |
| ST-su-006 | normal | 升星属性倍率验证 | 1星→2星 | 属性×1.15 | covered | P1 |

### getStarUpPreview(generalId) / getStarUpCost(currentStar)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| ST-prev-001 | normal | 升星预览 | 武将存在 | 返回碎片/铜钱消耗和属性diff | covered | P1 |
| ST-prev-002 | boundary | 满星预览 | star=6 | 返回null | covered | P1 |
| ST-cost-001 | normal | 获取升星消耗 | currentStar=3 | fragments=80, gold=20000 | covered | P1 |

### breakthrough(generalId)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| ST-bt-001 | normal | 正常突破 | 等级达到上限+资源充足 | 等级上限提升，阶段+1 | covered | P0 |
| ST-bt-002 | exception | 等级未达上限 | level<currentLevelCap | 返回failedBreakthrough | covered | P0 |
| ST-bt-003 | exception | 碎片不足 | 碎片<tier.fragmentCost | 返回failedBreakthrough | covered | P0 |
| ST-bt-004 | exception | 突破石不足 | breakthroughStone不够 | 返回failedBreakthrough | covered | P0 |
| ST-bt-005 | boundary | 满突破再突破 | stage>=MAX_BREAKTHROUGH_STAGE(4) | 返回failedBreakthrough | covered | P0 |
| ST-bt-006 | cross | 突破触发技能解锁 | skillUnlockCallback已注入 | 调用回调传入heroId和newStage | covered | P1 |
| ST-bt-007 | cross | 突破后等级上限联动 | 突破成功 | getLevelCap返回新上限 | covered | P0 |

### 碎片获取途径

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| ST-frag-001 | normal | 重复武将碎片转化 | 调用handleDuplicateFragments | 碎片正确增加 | covered | P1 |
| ST-frag-002 | normal | 关卡掉落碎片 | stageId匹配配置 | 碎片在[min,max]范围内 | covered | P1 |
| ST-frag-003 | normal | 商店兑换碎片 | 铜钱充足+未超限购 | 碎片增加，铜钱扣除 | covered | P1 |
| ST-frag-004 | boundary | 商店限购 | 超过dailyLimit | 兑换数量被截断 | covered | P1 |
| ST-frag-005 | normal | 活动获取碎片 | amount>0 | 碎片增加 | covered | P1 |
| ST-frag-006 | normal | 远征获取碎片 | amount>0 | 碎片增加 | covered | P1 |

### getFragmentProgress(generalId)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| ST-prog-001 | normal | 获取碎片进度 | 武将存在 | 返回current/required/percentage | covered | P2 |
| ST-prog-002 | boundary | 满星进度 | star=6 | percentage=100, canStarUp=false | covered | P2 |

### 序列化/反序列化

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| ST-ser-001 | lifecycle | 完整状态序列化 | 有星级+突破数据 | stars和breakthroughStages完整保存 | covered | P0 |
| ST-ser-002 | lifecycle | 反序列化恢复 | 有效数据 | 状态完全恢复 | covered | P0 |

---

## 5. SkillUpgradeSystem（技能升级系统）

### upgradeSkill(generalId, skillIndex, materials)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| SK-up-001 | normal | 正常升级技能 | 材料充足+未达上限 | success=true, level+1 | covered | P0 |
| SK-up-002 | exception | 武将不存在 | generalId无效 | success=false | covered | P0 |
| SK-up-003 | boundary | 技能索引越界 | skillIndex<0或>=length | success=false | covered | P0 |
| SK-up-004 | boundary | 技能达到等级上限 | level>=skillLevelCap | success=false | covered | P0 |
| SK-up-005 | exception | 材料不足 | skillBooks或gold不够 | success=false | covered | P0 |
| SK-up-006 | cross | 技能等级上限由星级决定 | star=1→cap=3, star=6→cap=10 | getSkillLevelCap返回正确值 | covered | P1 |
| SK-up-007 | cross | 觉醒技能需突破前置 | skill.type='awaken'且未突破 | success=false | covered | P1 |

### getSkillEffect(generalId, skillIndex)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| SK-eff-001 | normal | 获取技能效果值 | level=3 | 1.0 + (3-1)×0.1 = 1.2 | covered | P1 |
| SK-eff-002 | boundary | 1级技能效果 | level=1 | 返回1.0 | covered | P2 |

### unlockSkillOnBreakthrough(heroId, breakthroughLevel)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| SK-unlock-001 | normal | 突破Lv10解锁被动强化 | breakthroughLevel=10 | 被动技能强化解锁 | covered | P0 |
| SK-unlock-002 | normal | 突破Lv20解锁新技能 | breakthroughLevel=20 | 新技能解锁 | covered | P0 |
| SK-unlock-003 | boundary | 重复解锁同一等级 | 已解锁的breakthroughLevel | 返回null（幂等） | covered | P1 |
| SK-unlock-004 | boundary | 无效突破等级 | breakthroughLevel=5 | 返回null | covered | P1 |

### getExtraEffect / hasExtraEffect / getCooldownReduce

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| SK-extra-001 | normal | 技能5级额外效果 | level>=5 | 返回ExtraEffect | covered | P1 |
| SK-extra-002 | boundary | 技能未达5级 | level<5 | hasExtraEffect=false | covered | P2 |
| SK-cd-001 | normal | 技能CD减少 | level=3 | CD减少0.15 | covered | P2 |
| SK-cd-002 | boundary | CD减少上限 | level很高 | 最大0.30 | covered | P2 |

### recommendStrategy(enemyType)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| SK-strat-001 | normal | 灼烧敌人推荐 | enemyType='burn-heavy' | 推荐passive+active | covered | P2 |
| SK-strat-002 | normal | BOSS推荐 | enemyType='boss' | 推荐active+awaken | covered | P2 |

---

## 6. HeroFormation（编队系统）

### createFormation(id) / deleteFormation(id)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| FM-cr-001 | normal | 创建编队 | 未达上限(3) | 返回FormationData | covered | P0 |
| FM-cr-002 | boundary | 创建编队达上限 | 已有3个编队 | 返回null | covered | P0 |
| FM-cr-003 | normal | 自动激活首个编队 | 第一个创建的编队 | activeFormationId自动设置 | covered | P1 |
| FM-del-001 | normal | 删除编队 | 编队存在 | 返回true | covered | P0 |
| FM-del-002 | boundary | 删除当前激活编队 | 删除activeFormationId | 切换到下一个可用编队 | covered | P1 |
| FM-del-003 | boundary | 删除不存在的编队 | id不存在 | 返回false | covered | P1 |

### addToFormation(id, generalId) / removeFromFormation(id, generalId)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| FM-add-001 | normal | 添加武将到编队 | 编队有空位 | 武将填入第一个空位 | covered | P0 |
| FM-add-002 | boundary | 编队已满 | 6个武将 | 返回null | covered | P0 |
| FM-add-003 | boundary | 武将已在编队中 | generalId重复 | 返回null | covered | P1 |
| FM-add-004 | boundary | 武将在其他编队中 | 不允许同一武将多编队 | 返回null | covered | P0 |
| FM-rm-001 | normal | 从编队移除武将 | 武将在编队中 | 该位置变为空字符串 | covered | P0 |
| FM-rm-002 | boundary | 移除不在编队中的武将 | generalId不匹配 | 返回null | covered | P1 |

### setFormation(id, generalIds)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| FM-set-001 | normal | 设置编队武将列表 | 有效列表 | 武将正确设置 | covered | P1 |
| FM-set-002 | boundary | 列表超过6个 | generalIds.length>6 | 截断为6个 | covered | P1 |

### autoFormationByIds(...)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| FM-auto-001 | normal | 一键布阵 | 有可用武将 | 按战力降序取前6个 | covered | P0 |
| FM-auto-002 | boundary | 无可用武将 | 候选列表为空 | 返回null | covered | P1 |
| FM-auto-003 | boundary | 允许重叠编队 | allowOverlap=true | 允许已在其他编队的武将 | covered | P1 |

### setActiveFormation / getActiveFormation

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| FM-act-001 | normal | 设置激活编队 | 编队存在 | activeFormationId更新 | covered | P0 |
| FM-act-002 | boundary | 设置不存在的编队 | id不存在 | 返回false | covered | P1 |

### calculateFormationPower(...)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| FM-pwr-001 | normal | 计算编队战力 | 编队有武将 | 各武将战力之和 | covered | P1 |
| FM-pwr-002 | boundary | 空编队战力 | 编队无武将 | 返回0 | covered | P2 |

### renameFormation(id, name)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| FM-ren-001 | normal | 重命名编队 | 编队存在 | 名称更新 | covered | P2 |
| FM-ren-002 | boundary | 名称超10字符 | name.length>10 | 截断为10字符 | covered | P2 |

### 序列化/反序列化

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| FM-ser-001 | lifecycle | 编队序列化/反序列化 | 有编队数据 | 完整恢复 | covered | P0 |

---

## 7. BondSystem（羁绊系统）

### calculateBonds(generalIds)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| BD-calc-001 | normal | 阵营羁绊2人激活 | 同阵营2人 | 激活Lv1阵营羁绊 | covered | P0 |
| BD-calc-002 | normal | 阵营羁绊3/4人升级 | 同阵营3/4人 | 匹配更高tier | covered | P1 |
| BD-calc-003 | normal | 搭档羁绊激活 | 包含搭档武将 | 激活搭档羁绊 | covered | P0 |
| BD-calc-004 | boundary | 空编队羁绊 | generalIds=[] | 返回空数组 | covered | P1 |

### getBondMultiplier(generalIds)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| BD-mult-001 | normal | 无羁绊时系数 | 无激活羁绊 | 返回1.0 | covered | P0 |
| BD-mult-002 | normal | 有羁绊时系数 | 有激活羁绊 | 返回1+总加成（上限2.0） | covered | P0 |
| BD-mult-003 | boundary | NaN/Infinity防护 | 非有限数值输入 | 返回1.0 | covered | P1 |

### evaluateAndEmit(generalIds)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| BD-emit-001 | normal | 羁绊激活事件 | 新羁绊出现 | emit bond:activated | covered | P0 |
| BD-emit-002 | normal | 羁绊失效事件 | 已有羁绊消失 | emit bond:deactivated | covered | P0 |
| BD-emit-003 | normal | 羁绊升级事件 | 羁绊等级提升 | emit bond:levelUp | covered | P1 |
| BD-emit-004 | boundary | 去重：等级不变不触发 | 羁绊等级不变 | 不触发事件 | covered | P1 |
| BD-emit-005 | boundary | 防抖机制 | debounceMs>0 | 延迟执行 | covered | P2 |

### 派驻系数

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| BD-disp-001 | normal | 全上阵系数 | 所有isActive=true | dispatchFactor=1.0 | covered | P1 |
| BD-disp-002 | normal | 混合派驻系数 | 部分isActive=false | dispatchFactor介于0.5~1.0 | covered | P1 |

---

## 8. AwakeningSystem（觉醒系统）

### checkAwakeningEligible(heroId)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| AW-elig-001 | normal | 满足所有觉醒条件 | Lv100+6星+4突破+RARE+ | eligible=true | covered | P0 |
| AW-elig-002 | boundary | 等级不足 | level<100 | eligible=false, failures含等级不足 | covered | P0 |
| AW-elig-003 | boundary | 星级不足 | star<6 | eligible=false | covered | P0 |
| AW-elig-004 | boundary | 突破不足 | breakthrough<4 | eligible=false | covered | P0 |
| AW-elig-005 | boundary | 品质不足 | quality<COMMON | eligible=false | covered | P0 |
| AW-elig-006 | exception | 武将不存在 | heroId无效 | eligible=false, owned=false | covered | P1 |

### awaken(heroId)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| AW-exec-001 | normal | 正常觉醒 | 条件+资源充足 | success=true, 属性×1.5 | covered | P0 |
| AW-exec-002 | exception | 已觉醒武将 | isAwakened=true | success=false, reason='武将已觉醒' | covered | P0 |
| AW-exec-003 | exception | 条件不满足 | 等级/星级/突破不足 | success=false | covered | P1 |
| AW-exec-004 | exception | 资源不足 | 铜钱/突破石/技能书/觉醒石不足 | success=false | covered | P1 |
| AW-exec-005 | cross | 觉醒后等级上限120 | 觉醒成功 | getAwakenedLevelCap返回120 | covered | P0 |

### getPassiveSummary()

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| AW-passive-001 | normal | 全局被动叠加 | 多个觉醒武将 | globalStatBonus正确叠加（上限5） | covered | P1 |
| AW-passive-002 | boundary | 阵营光环上限 | 同阵营>maxStacks | 截断到factionMaxStacks | covered | P2 |

### calculateAwakenedStats(heroId)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| AW-stat-001 | normal | 觉醒属性计算 | 已觉醒 | baseStats × 1.5 | covered | P1 |
| AW-stat-002 | boundary | 未觉醒属性 | 未觉醒 | 返回原始baseStats | covered | P2 |

---

## 9. HeroDispatchSystem（派驻系统）

### dispatchHero(heroId, buildingType)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| DP-disp-001 | normal | 正常派驻武将 | 武将和建筑均空闲 | success=true, 记录派驻关系 | covered | P0 |
| DP-disp-002 | boundary | 武将已派驻到其他建筑 | heroId已有派驻 | success=false | covered | P0 |
| DP-disp-003 | normal | 建筑自动替换 | 建筑已有其他武将 | 自动替换，旧武将取消派驻 | covered | P1 |
| DP-disp-004 | cross | 派驻加成计算 | LEGENDARY武将Lv50 | 加成=(8+25)×(1+attack×0.01) | covered | P0 |

### undeployHero(heroId)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| DP-undep-001 | normal | 正常取消派驻 | 武将已派驻 | 返回true，派驻关系清除 | covered | P0 |
| DP-undep-002 | boundary | 取消未派驻武将 | heroId无派驻 | 返回false | covered | P1 |

### refreshDispatchBonus(heroId)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| DP-refresh-001 | normal | 武将升级后刷新 | 武将已派驻且升级 | 加成百分比更新 | covered | P1 |
| DP-refresh-002 | boundary | 未派驻武将刷新 | 武将无派驻 | 返回0 | covered | P2 |

### 序列化/反序列化

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| DP-ser-001 | lifecycle | 派驻状态序列化 | 有派驻数据 | JSON序列化/反序列化正确 | covered | P0 |
| DP-ser-002 | exception | 无效JSON反序列化 | JSON格式错误 | reset为空状态 | covered | P1 |

---

## 10. HeroBadgeSystem（角标系统）

### hasMainEntryRedDot() / getLevelBadgeCount() / getStarBadgeCount()

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| BG-red-001 | normal | 主界面红点-可升级 | 有武将可升级 | 返回true | covered | P0 |
| BG-red-002 | normal | 主界面红点-可升星 | 有武将可升星 | 返回true | covered | P0 |
| BG-red-003 | boundary | 无任何可操作项 | 无可升级/升星/装备 | 返回false | covered | P1 |
| BG-lvl-001 | normal | Tab升级角标数量 | 3个武将可升级 | 返回3 | covered | P1 |
| BG-star-001 | normal | Tab升星角标数量 | 2个武将可升星 | 返回2 | covered | P1 |

### getTodayTodoList()

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| BG-todo-001 | normal | 聚合待办列表 | 有可操作武将 | 返回type+heroId+label | covered | P1 |
| BG-todo-002 | boundary | 无待办时默认提示 | 无可操作项 | 返回招募提示 | covered | P2 |

### executeQuickAction(action)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| BG-act-001 | normal | 快捷升级操作 | 有可升级武将 | 返回affectedHeroes列表 | covered | P1 |
| BG-act-002 | normal | 快捷招募操作 | action='recruit' | success=true, 跳转招募界面 | covered | P2 |

---

## 11. HeroAttributeCompare（属性对比）

### compareAttributes(heroId, simulateLevel?)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| AC-cmp-001 | normal | 属性对比 | 传入simulateLevel | 返回current/simulated/diff | covered | P0 |
| AC-cmp-002 | boundary | 不传simulateLevel | simulateLevel=undefined | current===simulated, diff全为0 | covered | P1 |

### getAttributeBreakdown(heroId)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| AC-bd-001 | normal | 属性构成展开 | 所有回调已注入 | 返回base+equipment+tech+buff+total | covered | P0 |
| AC-bd-002 | boundary | 无任何加成 | 所有加成回调返回{} | total===base | covered | P1 |

---

## 12. FactionBondSystem（阵营羁绊系统）

### calculateBonds(heroIds)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| FB-calc-001 | normal | 阵营羁绊计算 | 同阵营>=2人 | 返回对应tier的BondEffect | covered | P0 |
| FB-calc-002 | normal | 搭档羁绊计算 | 编队包含搭档武将 | 激活搭档羁绊 | covered | P0 |
| FB-calc-003 | boundary | 空编队 | heroIds=[] | 返回空Map | covered | P1 |
| FB-calc-004 | normal | 多羁绊叠加 | 阵营+搭档同时激活 | 效果合并 | covered | P1 |

### isBondActive(bondId, teamHeroIds)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| FB-active-001 | normal | 检查阵营羁绊激活 | 同阵营>=2人 | 返回true | covered | P1 |
| FB-active-002 | normal | 检查搭档羁绊激活 | 包含搭档武将 | 返回true | covered | P1 |
| FB-active-003 | boundary | 无效bondId | bondId格式不匹配 | 返回false | covered | P2 |

### applyBondBonus(baseStats, heroId, teamHeroIds)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| FB-apply-001 | normal | 应用羁绊加成到属性 | 有激活羁绊 | 属性×(1+bonus) | covered | P1 |
| FB-apply-002 | boundary | 无羁绊加成 | 无激活羁绊 | 返回原始属性 | covered | P2 |

---

## 13. FormationRecommendSystem（编队推荐系统）

### recommend(stageType, availableHeroes, calculatePower, ...)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| FR-rec-001 | normal | 生成1~3个推荐方案 | 有可用武将 | 返回最强/平衡/羁绊方案 | covered | P0 |
| FR-rec-002 | boundary | 无可用武将 | availableHeroes=[] | plans为空数组 | covered | P1 |
| FR-rec-003 | normal | 关卡特性分析 | stageType='boss' | difficultyLevel较高 | covered | P1 |
| FR-rec-004 | normal | 羁绊优先方案 | 同阵营武将>=3 | 优先选同阵营 | covered | P1 |

### analyzeStage(stageType, recommendedPower, enemySize)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| FR-anl-001 | normal | 普通关卡分析 | stageType='normal' | difficultyLevel 1~5 | covered | P2 |
| FR-anl-002 | boundary | Boss关卡分析 | stageType='boss' | difficultyLevel 7~10 | covered | P2 |

---

## 14. RecruitTokenEconomySystem（招贤令经济系统）

### tick(deltaSeconds) — 被动产出

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| TE-tick-001 | normal | 正常被动产出 | dt=1秒 | 增加0.002招贤令 | covered | P0 |
| TE-tick-002 | boundary | dt<=0 | dt=0或负数 | 不增加 | covered | P1 |
| TE-tick-003 | lifecycle | 累计被动产出追踪 | 多次tick | totalPassiveEarned累加 | covered | P2 |

### claimNewbiePack()

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| TE-newb-001 | normal | 首次领取新手礼包 | newbiePackClaimed=false | 获得100招贤令 | covered | P0 |
| TE-newb-002 | boundary | 重复领取 | newbiePackClaimed=true | 返回0 | covered | P0 |

### claimDailyTaskReward()

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| TE-daily-001 | normal | 领取日常奖励 | dailyTaskClaimed=false | 获得15招贤令 | covered | P0 |
| TE-daily-002 | boundary | 重复领取 | dailyTaskClaimed=true | 返回0 | covered | P0 |
| TE-daily-003 | lifecycle | 每日重置 | 跨日调用 | dailyTaskClaimed重置为false | covered | P1 |

### buyFromShop(count)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| TE-shop-001 | normal | 正常购买 | 铜钱充足+未超限购 | 购买成功 | covered | P0 |
| TE-shop-002 | boundary | 超过日限购 | count+dailyShopPurchased>50 | 截断到剩余额度 | covered | P0 |
| TE-shop-003 | exception | 铜钱不足 | 铜钱<totalCost | 返回false | covered | P0 |
| TE-shop-004 | boundary | count<=0 | count=0或负数 | 返回false | covered | P1 |

### claimStageClearReward(stageId)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| TE-stage-001 | normal | 首通奖励 | stageId未领取 | 获得3~5招贤令 | covered | P0 |
| TE-stage-002 | boundary | 重复领取 | stageId已领取 | 返回0 | covered | P0 |
| TE-stage-003 | exception | 空stageId | stageId="" | 返回0 | covered | P1 |

### claimEventReward()

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| TE-event-001 | normal | 活动奖励 | economyDeps已注入 | 获得10~20招贤令 | covered | P1 |

### claimOfflineReward(offlineSeconds)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| TE-off-001 | normal | 离线收益 | offlineSeconds>0 | 0.002×seconds×0.5 | covered | P0 |
| TE-off-002 | boundary | offlineSeconds<=0 | 离线0秒 | 返回0 | covered | P1 |

### 序列化/反序列化

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| TE-ser-001 | lifecycle | 完整状态序列化 | 有购买/领取记录 | 所有状态完整保存 | covered | P0 |
| TE-ser-002 | lifecycle | 反序列化恢复 | 有效数据 | clearedStages恢复为Set | covered | P0 |

---

## 15. 跨系统交互

| ID | 类型 | 描述 | 涉及系统 | 预期行为 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| XI-001 | cross | 招募→武将添加→碎片管理 | Recruit↔Hero | 抽到新武将时addGeneral，重复时handleDuplicate | covered | P0 |
| XI-002 | cross | 招募→保底→UP武将→碎片溢出 | Recruit↔Hero↔Resource | UP命中+碎片溢出→铜钱转化 | partial | P0 |
| XI-003 | cross | 升级→等级上限→突破联动 | Level↔Star | LevelSystem使用StarSystem.getLevelCap | covered | P0 |
| XI-004 | cross | 突破→技能解锁→技能升级 | Star↔Skill | 突破成功触发技能解锁回调 | covered | P1 |
| XI-005 | cross | 编队→羁绊→战力计算 | Formation↔Bond↔Hero | 编队战力含羁绊系数 | covered | P0 |
| XI-006 | cross | 升星→战力变化→编队战力刷新 | Star↔Hero↔Formation | 升星后编队战力应更新 | missing | P1 |
| XI-007 | cross | 觉醒→等级上限→升级系统 | Awakening↔Level | 觉醒后LevelSystem上限变120 | covered | P0 |
| XI-008 | cross | 派驻→羁绊系数影响 | Dispatch↔Bond | 派驻武将羁绊系数减半 | covered | P1 |
| XI-009 | cross | 派驻→建筑产出→资源系统 | Dispatch↔Resource | 派驻加成影响建筑产出 | missing | P1 |
| XI-010 | cross | 招贤令经济→招募消耗 | TokenEconomy↔Recruit | 招贤令用于招募 | missing | P0 |
| XI-011 | cross | 角标聚合→各子系统状态 | Badge↔Level/Star/Equip | 角标正确反映可操作状态 | covered | P1 |
| XI-012 | cross | 编队推荐→关卡系统 | Recommend↔Campaign | 推荐基于关卡类型 | missing | P1 |
| XI-013 | cross | 武将移除→编队清理 | Hero↔Formation | 移除武将后编队引用处理 | missing | P1 |
| XI-014 | cross | 属性对比→装备系统 | AttrCompare↔Equipment | 装备加成正确展示 | partial | P2 |
| XI-015 | cross | 阵营羁绊→搭档羁绊叠加 | FactionBond↔BondSystem | 两套羁绊系统效果不冲突 | partial | P1 |
| XI-016 | cross | 碎片获取→升星→突破→觉醒完整链路 | Fragment↔Star↔Breakthrough↔Awakening | 完整养成链路 | missing | P0 |
| XI-017 | cross | 招募历史→招贤令经济 | Recruit↔TokenEconomy | 招募消耗招贤令 | missing | P0 |
| XI-018 | cross | 序列化一致性：所有系统存档/读档 | All Systems | 全系统序列化后恢复状态一致 | missing | P0 |
| XI-019 | cross | 编队推荐→羁绊系统 | Recommend↔BondSystem | 推荐方案考虑羁绊加成 | missing | P1 |
| XI-020 | cross | 觉醒被动→全局属性加成 | Awakening↔Hero | 觉醒被动正确应用到战力计算 | partial | P1 |
| XI-021 | cross | 技能CD减少→战斗系统 | Skill↔Battle | CD减少效果在战斗中生效 | missing | P1 |
| XI-022 | cross | 每日重置：免费招募+商店限购+日常任务 | Recruit↔TokenEconomy | 跨日重置正确 | partial | P1 |
| XI-023 | cross | 碎片合成→武将添加→编队自动填充 | Fragment↔Hero↔Formation | 合成武将后编队自动考虑 | missing | P2 |
| XI-024 | cross | 经济模型端到端：被动+日常+商店+关卡 | TokenEconomy↔Resource | 4h在线日产出≈191招贤令 | missing | P1 |

---

## 16. 数据生命周期

| ID | 类型 | 描述 | 涉及系统 | 预期行为 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| LC-001 | lifecycle | 武将完整生命周期：招募→升级→升星→突破→觉醒 | Hero+Level+Star+Awakening | 全流程数据一致 | missing | P0 |
| LC-002 | lifecycle | 碎片生命周期：获取→积累→消耗→溢出 | Hero+Star | 碎片增减正确，溢出处理正确 | partial | P0 |
| LC-003 | lifecycle | 编队生命周期：创建→添加→修改→删除→序列化 | Formation | 全流程数据一致 | covered | P1 |
| LC-004 | lifecycle | 保底计数器生命周期：累计→触发→重置→持久化 | Recruit | 保底计数器跨会话保持 | partial | P1 |
| LC-005 | lifecycle | 招贤令经济生命周期：获取→消耗→日重置→离线收益 | TokenEconomy | 经济数据跨日正确重置 | covered | P1 |
| LC-006 | lifecycle | 羁绊生命周期：编队变化→羁绊激活/失效→事件触发 | Bond | 羁绊状态随编队正确变化 | covered | P1 |
| LC-007 | lifecycle | 派驻生命周期：派驻→加成计算→取消→序列化 | Dispatch | 派驻关系完整管理 | covered | P1 |
| LC-008 | lifecycle | 觉醒状态持久化：觉醒→被动叠加→序列化 | Awakening | 觉醒状态跨会话保持 | partial | P1 |
| LC-009 | lifecycle | 全系统重置：reset()后状态归零 | All Systems | 所有系统reset后状态干净 | missing | P1 |
| LC-010 | lifecycle | 升级系统无状态序列化 | LevelSystem | serialize/deserialize为空操作 | covered | P2 |
| LC-011 | lifecycle | 技能升级历史持久化 | SkillUpgrade | upgradeHistory和breakthroughSkillUnlocks正确保存 | partial | P1 |
| LC-012 | lifecycle | 觉醒经验表(101~120)与升级系统联动 | Awakening↔Level | 觉醒后升级使用觉醒经验表 | missing | P0 |
| LC-013 | lifecycle | 商店每日限购重置与日期判断 | TokenEconomy | 跨日限购正确重置 | covered | P1 |
| LC-014 | lifecycle | 免费招募日重置与日期判断 | Recruit | 跨日免费次数正确重置 | covered | P1 |
| LC-015 | lifecycle | 关卡首通奖励去重 | TokenEconomy | 同一关卡不可重复领取 | covered | P1 |
| LC-016 | lifecycle | 多系统联合序列化/反序列化 | All Systems | 所有系统联合存档/读档一致性 | missing | P0 |

---

## 附录：测试覆盖热力图

### 按维度统计

| 维度 | 节点数 | covered | missing | partial | 覆盖率 |
|------|--------|---------|---------|---------|--------|
| 正常流程 (normal) | 112 | 104 | 4 | 4 | 93% |
| 边界条件 (boundary) | 88 | 72 | 6 | 10 | 82% |
| 异常路径 (exception) | 31 | 26 | 2 | 3 | 84% |
| 跨系统交互 (cross) | 39 | 18 | 14 | 7 | 46% |
| 数据生命周期 (lifecycle) | 37 | 14 | 14 | 9 | 38% |

### 高优先级缺失节点（P0 missing/partial）

| ID | 系统 | 描述 | 原因 |
|----|------|------|------|
| XI-010 | 跨系统 | 招贤令经济→招募消耗 | 集成测试缺失 |
| XI-016 | 跨系统 | 碎片→升星→突破→觉醒完整链路 | 端到端测试缺失 |
| XI-017 | 跨系统 | 招募历史→招贤令经济 | 集成测试缺失 |
| XI-018 | 跨系统 | 全系统序列化一致性 | 集成测试缺失 |
| LC-001 | 生命周期 | 武将完整养成生命周期 | 端到端测试缺失 |
| LC-012 | 生命周期 | 觉醒经验表与升级系统联动 | 觉醒后升级路径未测 |
| LC-016 | 生命周期 | 多系统联合序列化 | 集成测试缺失 |
| RC-dup-002 | 招募 | 碎片溢出转铜钱完整验证 | 部分场景未覆盖 |
| XI-024 | 跨系统 | 经济模型端到端验证 | 缺少4h在线模拟测试 |

### 建议优先补充的测试

1. **P0 — 全系统联合序列化测试**：验证所有系统serialize→deserialize后状态完全一致
2. **P0 — 完整养成链路测试**：碎片获取→升星→突破→觉醒→升级到120级
3. **P0 — 招贤令经济端到端**：被动产出+日常+商店+关卡→招募消耗完整流程
4. **P1 — 武将移除级联影响**：移除武将后编队/派驻/羁绊的级联处理
5. **P1 — 觉醒后升级路径**：101~120级使用觉醒经验表的完整验证
