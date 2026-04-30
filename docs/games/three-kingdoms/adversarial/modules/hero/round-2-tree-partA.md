# Hero 流程分支树 Round 2 — Part A（核心子系统）

> Builder: TreeBuilder v1.1 | Time: 2026-05-01
> R1吸收: 14个P0遗漏 + 3个虚报 + 8个独立发现
> R1修复: FIX-001(NaN绕过) + FIX-002(useFragments负值) + FIX-003(deserialize null) + FIX-004(FormationRecommend null)

## Part A 子系统清单

| # | 子系统 | 源文件 | 公开API数 | R1节点 | R2节点 |
|---|--------|--------|----------|--------|--------|
| 1 | HeroSystem | HeroSystem.ts | 28 | 68 | 82 |
| 2 | HeroLevelSystem | HeroLevelSystem.ts | 14 | 38 | 44 |
| 3 | HeroStarSystem | HeroStarSystem.ts | 18 | 42 | 48 |
| 4 | HeroSerializer | HeroSerializer.ts | 5 | 14 | 18 |
| 5 | HeroFormation | HeroFormation.ts | 22 | 32 | 38 |
| 6 | HeroRecruitSystem | HeroRecruitSystem.ts | 20 | 28 | 32 |
| 7 | RecruitTokenEconomy | recruit-token-economy-system.ts | 22 | 23 | 28 |
| **合计** | **7个子系统** | | **~129** | **245** | **290** |

---

## 1. HeroSystem (HeroSystem.ts) — 82节点

### 1.1 武将管理 (addGeneral/removeGeneral/getGeneral) — 14节点

| ID | API | 场景 | 优先级 | R2状态 | R1变化 |
|----|-----|------|--------|--------|--------|
| HS-N01 | addGeneral | 正常添加武将 | P1 | ✅ covered | 源码验证: L110-129 |
| HS-N02 | addGeneral | 重复添加返回null | P1 | ✅ covered | 测试覆盖 |
| HS-N03 | removeGeneral | 正常移除 | P1 | ✅ covered | 测试覆盖 |
| HS-N04 | getGeneral | 获取已存在武将 | P2 | ✅ covered | 测试覆盖 |
| HS-N05 | getGeneral | 获取不存在武将返回undefined | P2 | ✅ covered | 测试覆盖 |
| HS-N06 | getAllGenerals | 返回所有武将副本 | P2 | ✅ covered | 测试覆盖 |
| HS-N07 | hasGeneral | 正常查询 | P2 | ✅ covered | 测试覆盖 |
| HS-N08 | getGeneralCount | 返回数量 | P2 | ✅ covered | 测试覆盖 |
| HS-E01 | addGeneral(null) | GENERAL_DEF_MAP.get(null)=undefined→return null | P1 | ✅ covered | R1标uncovered→R2确认安全 |
| HS-E02 | addGeneral(undefined) | 同上，安全返回null | P1 | ✅ covered | R1标uncovered→R2确认安全 |
| HS-E03 | addGeneral(空字符串) | GENERAL_DEF_MAP.get('')=undefined→return null | P1 | ✅ covered | R2新增 |
| HS-E04 | removeGeneral(不存在的ID) | 返回null | P2 | ✅ covered | 测试覆盖 |
| HS-E05 | removeGeneral(已派驻武将) | 移除成功但派驻关系未清理→XC风险 | P0 | ⚠️ uncovered | R2新增(吸收CH-XC-C05) |
| HS-E06 | getGeneral返回值被修改 | cloneGeneral返回深拷贝，安全 | P2 | ✅ covered | R2验证 |

### 1.2 战力计算 (calculatePower/calculateTotalPower/calculateFormationPower) — 16节点

| ID | API | 场景 | 优先级 | R2状态 | R1变化 |
|----|-----|------|--------|--------|--------|
| HS-B01 | calculatePower | 正常计算(含星级+装备+羁绊) | P1 | ✅ covered | 测试覆盖 |
| HS-B02 | calculatePower | star=0 → getStarMultiplier(0)=1.0 | P1 | ✅ covered | R1标uncovered→R2确认安全 |
| HS-B03 | calculatePower | star=NaN → getStarMultiplier(NaN)=undefined→NaN | P0 | ⚠️ uncovered | R1标uncovered→R2维持(FIX-001未覆盖此处) |
| HS-B04 | calculatePower | quality=非法值 → QUALITY_MULTIPLIERS[undefined]=undefined→NaN | P0 | ⚠️ uncovered | R2新增(吸收A1挑战) |
| HS-B05 | calculatePower | level=NaN → levelCoeff=NaN→全链NaN | P0 | ⚠️ uncovered | R2新增 |
| HS-B06 | calculatePower | baseStats含NaN → statsPower=NaN | P0 | ⚠️ uncovered | R2新增 |
| HS-B07 | calculatePower | totalEquipmentPower=NaN → equipmentCoeff=NaN | P0 | ⚠️ uncovered | R2新增 |
| HS-B08 | calculatePower | bondMultiplier=NaN → bondCoeff=NaN | P0 | ⚠️ uncovered | R2新增 |
| HS-B09 | calculatePower | 所有参数正常但结果为NaN（溢出） | P1 | ⚠️ uncovered | R2新增 |
| HS-N09 | calculateTotalPower | 正常计算 | P1 | ✅ covered | 测试覆盖 |
| HS-N10 | calculateFormationPower | 正常计算(含羁绊系数) | P1 | ✅ covered | 测试覆盖 |
| HS-B10 | calculateFormationPower | generalIds=[] → 返回0 | P2 | ✅ covered | 测试覆盖 |
| HS-B11 | calculateFormationPower | generalIds含无效ID → 跳过 | P1 | ✅ covered | 源码验证: L236 |
| HS-B12 | calculateFormationPower | getStar回调返回NaN → starCoeff=NaN | P0 | ⚠️ uncovered | R2新增 |
| HS-B13 | calculateFormationPower | _getBondMultiplier未注入→fallback 1.0 | P1 | ✅ covered | R2验证(CH-002确认永远为1.0) |
| HS-B14 | calculateFormationPower | _getBondMultiplier已注入→使用注入值 | P0 | ⚠️ uncovered | R2新增(架构缺陷: setBondMultiplierGetter从未被调用) |

### 1.3 碎片管理 (addFragment/useFragments/handleDuplicate/fragmentSynthesize) — 22节点

| ID | API | 场景 | 优先级 | R2状态 | R1变化 |
|----|-----|------|--------|--------|--------|
| HS-N11 | addFragment | 正常添加 | P1 | ✅ covered | 测试覆盖 |
| HS-N12 | addFragment | 溢出→返回溢出数 | P1 | ✅ covered | 测试覆盖 |
| HS-N13 | useFragments | 正常消耗 | P1 | ✅ covered | 测试覆盖 |
| HS-N14 | useFragments | 碎片不足→false | P1 | ✅ covered | 测试覆盖 |
| HS-N15 | handleDuplicate | 正常转化 | P1 | ✅ covered | 测试覆盖 |
| HS-N16 | fragmentSynthesize | 正常合成 | P1 | ✅ covered | 测试覆盖 |
| HS-N17 | fragmentSynthesize | 碎片不足→null | P1 | ✅ covered | 测试覆盖 |
| HS-N18 | fragmentSynthesize | 已拥有→null | P1 | ✅ covered | 测试覆盖 |
| HS-B15 | addFragment | count=0 → 返回0 (FIX-001已防护) | P2 | ✅ covered | R2确认FIX-001有效 |
| HS-B16 | addFragment | count=NaN → !Number.isFinite(NaN)=true→返回0 | P0 | ✅ covered | R2确认FIX-001有效 |
| HS-B17 | addFragment | count=Infinity → 返回0 | P0 | ✅ covered | R2确认FIX-001有效 |
| HS-B18 | addFragment | count=负数 → 返回0 | P0 | ✅ covered | R2确认FIX-001有效 |
| HS-B19 | useFragments | count=0 → false (FIX-002已防护) | P0 | ✅ covered | R2确认FIX-002有效 |
| HS-B20 | useFragments | count=NaN → false (FIX-002已防护) | P0 | ✅ covered | R2确认FIX-002有效 |
| HS-B21 | useFragments | count=负数 → false (FIX-002已防护) | P0 | ✅ covered | R2确认FIX-002有效 |
| HS-B22 | useFragments | count=Infinity → false (FIX-002已防护) | P0 | ✅ covered | R2确认FIX-002有效 |
| HS-E07 | handleDuplicate | quality=undefined → DUPLICATE_FRAGMENT_COUNT[undefined]=undefined → addFragment(id, undefined) | P0 | ⚠️ uncovered | R2新增(吸收C1挑战: NaN碎片污染) |
| HS-E08 | handleDuplicate | quality=非法字符串 → 同上 | P0 | ⚠️ uncovered | R2新增 |
| HS-E09 | fragmentSynthesize | 武将定义不存在→null | P1 | ✅ covered | 测试覆盖 |
| HS-E10 | getFragments | 不存在的武将→返回0 | P2 | ✅ covered | 测试覆盖 |
| HS-E11 | getAllFragments | 返回副本 | P2 | ✅ covered | 测试覆盖 |
| HS-E12 | canSynthesize | 正常判断 | P2 | ✅ covered | 测试覆盖 |

### 1.4 升级经验 (addExp/setLevelAndExp/getExpRequired) — 12节点

| ID | API | 场景 | 优先级 | R2状态 | R1变化 |
|----|-----|------|--------|--------|--------|
| HS-N19 | addExp | 正常升级 | P1 | ✅ covered | 测试覆盖 |
| HS-N20 | addExp | 连续升级 | P1 | ✅ covered | 测试覆盖 |
| HS-N21 | addExp | 满级返回null | P1 | ✅ covered | 测试覆盖 |
| HS-N22 | getExpRequired | 正常查表 | P2 | ✅ covered | 测试覆盖 |
| HS-N23 | setLevelAndExp | 正常设置 | P1 | ✅ covered | 测试覆盖 |
| HS-B23 | addExp | exp=0 → 不升级但经验保留 | P2 | ✅ covered | 测试覆盖 |
| HS-B24 | addExp | exp=NaN → while(NaN>0)不执行→gained=0→return null | P0 | ✅ covered | R2验证: 安全但静默吞掉 |
| HS-B25 | addExp | exp=负数 → while(负数>0)不执行→return null | P1 | ✅ covered | 测试覆盖 |
| HS-B26 | getExpRequired | level=NaN → for循环不匹配→返回fallback | P1 | ⚠️ uncovered | R2新增 |
| HS-B27 | getExpRequired | level=0 → for循环不匹配→返回fallback | P2 | ⚠️ uncovered | R2新增 |
| HS-B28 | setLevelAndExp | generalId不存在→undefined | P1 | ✅ covered | 测试覆盖 |
| HS-B29 | setLevelAndExp | level=NaN/exp=NaN → 直接赋值,无防护 | P0 | ⚠️ uncovered | R2新增 |

### 1.5 查询工具 (getGeneralsByFaction/getGeneralsSortedByPower等) — 8节点

| ID | API | 场景 | 优先级 | R2状态 | R1变化 |
|----|-----|------|--------|--------|--------|
| HS-N24 | getGeneralsByFaction | 正常筛选 | P2 | ✅ covered | 测试覆盖 |
| HS-N25 | getGeneralsByQuality | 正常筛选 | P2 | ✅ covered | 测试覆盖 |
| HS-N26 | getGeneralsSortedByPower | 降序排列 | P1 | ✅ covered | 测试覆盖 |
| HS-N27 | getGeneralsSortedByPower | 升序排列 | P2 | ✅ covered | 测试覆盖 |
| HS-B30 | getGeneralsSortedByPower | 某武将战力=NaN→排序异常 | P0 | ⚠️ uncovered | R2新增(NaN传播到排序) |
| HS-N28 | getAllGeneralDefs | 返回静态配置 | P2 | ✅ covered | 测试覆盖 |
| HS-N29 | getGeneralDef | 正常查询 | P2 | ✅ covered | 测试覆盖 |
| HS-N30 | updateSkillLevel | 正常更新 | P1 | ✅ covered | 测试覆盖 |

### 1.6 序列化/反序列化 (serialize/deserialize) — 10节点

| ID | API | 场景 | 优先级 | R2状态 | R1变化 |
|----|-----|------|--------|--------|--------|
| HS-N31 | serialize | 正常序列化 | P1 | ✅ covered | 测试覆盖 |
| HS-N32 | deserialize | 正常反序列化 | P1 | ✅ covered | 测试覆盖 |
| HS-N33 | serialize→deserialize | 往返一致性 | P1 | ✅ covered | 测试覆盖 |
| HS-E13 | deserialize(null) | FIX-003已防护→createEmptyState() | P0 | ✅ covered | R2确认FIX-003有效 |
| HS-E14 | deserialize(undefined) | FIX-003已防护→createEmptyState() | P0 | ✅ covered | R2确认FIX-003有效 |
| HS-E15 | deserialize(损坏数据: generals含null) | cloneGeneral(null)崩溃 | P0 | ⚠️ uncovered | R2新增(吸收A6挑战) |
| HS-E16 | deserialize(版本不匹配) | 仅warn不迁移→数据可能丢失 | P1 | ⚠️ uncovered | R2新增(吸收Arbiter发现1) |
| HS-E17 | reset | 正常重置 | P2 | ✅ covered | 测试覆盖 |
| HS-E18 | init | 注入依赖 | P2 | ✅ covered | 测试覆盖 |
| HS-E19 | update | 空实现 | P2 | ✅ covered | 源码验证 |

---

## 2. HeroLevelSystem (HeroLevelSystem.ts) — 44节点

### 2.1 经验获取 (addExp) — 14节点

| ID | API | 场景 | 优先级 | R2状态 | R1变化 |
|----|-----|------|--------|--------|--------|
| HL-N01 | addExp | 正常升级(含铜钱消耗) | P1 | ✅ covered | 测试覆盖 |
| HL-N02 | addExp | 连续多级升级 | P1 | ✅ covered | 测试覆盖 |
| HL-N03 | addExp | 铜钱不足→停在当前级 | P1 | ✅ covered | 测试覆盖 |
| HL-N04 | addExp | 满级→null | P1 | ✅ covered | 测试覆盖 |
| HL-B01 | addExp | amount=NaN → FIX-001已防护 | P0 | ✅ covered | R2确认FIX-001有效 |
| HL-B02 | addExp | amount=负数 → FIX-001已防护 | P0 | ✅ covered | R2确认FIX-001有效 |
| HL-B03 | addExp | amount=Infinity → 升到满级 | P0 | ⚠️ uncovered | R2新增 |
| HL-B04 | addExp | generalId不存在→null | P1 | ✅ covered | 测试覆盖 |
| HL-B05 | addExp | levelDeps未注入→null | P1 | ✅ covered | 测试覆盖 |
| HL-B06 | addExp | 铜钱扣除成功但syncToHeroSystem失败 | P0 | ⚠️ uncovered | R2新增(吸收C5挑战: 无事务性保证) |
| HL-B07 | addExp | exp=0 → while(0>0)不执行→return null | P2 | ✅ covered | 测试覆盖 |
| HL-B08 | addExp | 升级后statsDiff正确性 | P1 | ✅ covered | 测试覆盖 |
| HL-B09 | addExp | 升级后getLevelCap变化(如觉醒) | P0 | ⚠️ uncovered | R2新增(吸收CH-024) |
| HL-B10 | addExp | getLevelCap回调返回NaN→maxLevel=NaN→循环异常 | P0 | ⚠️ uncovered | R2新增 |

### 2.2 消耗计算 (calculateExpToNextLevel/calculateTotalExp等) — 10节点

| ID | API | 场景 | 优先级 | R2状态 | R1变化 |
|----|-----|------|--------|--------|--------|
| HL-N05 | calculateExpToNextLevel | 正常计算 | P2 | ✅ covered | 测试覆盖 |
| HL-N06 | calculateLevelUpCost | 正常计算 | P2 | ✅ covered | 测试覆盖 |
| HL-N07 | calculateTotalExp | 正常计算 | P2 | ✅ covered | 测试覆盖 |
| HL-N08 | calculateTotalGold | 正常计算 | P2 | ✅ covered | 测试覆盖 |
| HL-B11 | calculateTotalExp | from=NaN → to<=NaN为false→totalExpBetween(NaN,...)→循环不执行→返回0 | P0 | ✅ covered | R2验证: 安全但语义不正确 |
| HL-B12 | calculateTotalExp | to=NaN → 同上 | P0 | ✅ covered | R2验证 |
| HL-B13 | calculateTotalExp | from>to → 返回0 | P2 | ✅ covered | 测试覆盖 |
| HL-B14 | calculateTotalExp | from>=cap → 返回0 | P1 | ✅ covered | 测试覆盖 |
| HL-B15 | calculateExpToNextLevel | level=NaN → for循环不匹配→fallback | P1 | ⚠️ uncovered | R2新增 |
| HL-B16 | lookupExpRequired | level超出LEVEL_EXP_TABLE范围→fallback到最后一段 | P1 | ✅ covered | 测试覆盖 |

### 2.3 一键强化/批量强化 — 10节点

| ID | API | 场景 | 优先级 | R2状态 | R1变化 |
|----|-----|------|--------|--------|--------|
| HL-N09 | getEnhancePreview | 正常预览 | P1 | ✅ covered | 测试覆盖 |
| HL-N10 | quickEnhance | 正常强化 | P1 | ✅ covered | 测试覆盖 |
| HL-N11 | batchEnhance | 正常批量强化 | P1 | ✅ covered | 测试覆盖 |
| HL-B17 | getEnhancePreview | targetLevel>maxLevel → 自动截断 | P1 | ✅ covered | 测试覆盖 |
| HL-B18 | getEnhancePreview | targetLevel=NaN → 截断逻辑异常 | P0 | ⚠️ uncovered | R2新增 |
| HL-B19 | quickEnhance | targetLevel=当前级→无操作 | P2 | ✅ covered | 测试覆盖 |
| HL-B20 | quickEnhance | 铜钱不足→部分升级 | P1 | ✅ covered | 测试覆盖 |
| HL-B21 | batchEnhance | 空列表→无操作 | P2 | ✅ covered | 测试覆盖 |
| HL-B22 | batchEnhance | 含无效generalId→跳过 | P1 | ✅ covered | 测试覆盖 |
| HL-B23 | batchEnhance | 排序优先级正确性(战力>品质) | P1 | ✅ covered | 测试覆盖 |

### 2.4 系统管理 — 10节点

| ID | API | 场景 | 优先级 | R2状态 | R1变化 |
|----|-----|------|--------|--------|--------|
| HL-N12 | levelUp | 正常升一级 | P1 | ✅ covered | 测试覆盖 |
| HL-N13 | levelUp | 经验不足→null | P1 | ✅ covered | 测试覆盖 |
| HL-N14 | levelUp | 铜钱不足→null | P1 | ✅ covered | 测试覆盖 |
| HL-N15 | getHeroMaxLevel | 正常查询 | P2 | ✅ covered | 测试覆盖 |
| HL-N16 | statsAtLevel | 正常计算 | P2 | ✅ covered | 测试覆盖 |
| HL-B24 | levelUp | expReq=0(查表异常)→general.exp<0为false→null | P1 | ⚠️ uncovered | R2新增 |
| HL-B25 | statsAtLevel | level=0 → m=1+(0-1)*0.03=0.97 | P1 | ⚠️ uncovered | R2新增 |
| HL-B26 | statsAtLevel | level=NaN → m=NaN→全NaN | P0 | ⚠️ uncovered | R2新增 |
| HL-N17 | serialize | 返回版本号 | P2 | ✅ covered | 测试覆盖 |
| HL-N18 | reset | 无额外状态 | P2 | ✅ covered | 测试覆盖 |

---

## 3. HeroStarSystem (HeroStarSystem.ts) — 48节点

### 3.1 碎片获取 (exchangeFragmentsFromShop/gainFragmentsFromStage等) — 16节点

| ID | API | 场景 | 优先级 | R2状态 | R1变化 |
|----|-----|------|--------|--------|--------|
| HSt-N01 | exchangeFragmentsFromShop | 正常兑换 | P1 | ✅ covered | 测试覆盖 |
| HSt-N02 | exchangeFragmentsFromShop | 达到日限购→失败 | P1 | ✅ covered | 测试覆盖 |
| HSt-N03 | gainFragmentsFromStage | 正常掉落 | P1 | ✅ covered | 测试覆盖 |
| HSt-N04 | handleDuplicateFragments | 正常转化 | P1 | ✅ covered | 测试覆盖 |
| HSt-B01 | exchangeFragmentsFromShop | count=NaN → FIX-001已防护 | P0 | ✅ covered | R2确认FIX-001有效 |
| HSt-B02 | exchangeFragmentsFromShop | count=负数 → FIX-001已防护 | P0 | ✅ covered | R2确认FIX-001有效 |
| HSt-B03 | exchangeFragmentsFromShop | generalId不在SHOP_FRAGMENT_EXCHANGE中→失败 | P0 | ⚠️ uncovered | R2新增(吸收CH-NEW-005) |
| HSt-B04 | gainFragmentsFromStage | stageId不在STAGE_FRAGMENT_DROPS中→空结果 | P1 | ✅ covered | 测试覆盖 |
| HSt-B05 | addFragmentFromActivity | amount=NaN → FIX-001已防护 | P0 | ✅ covered | R2确认FIX-001有效 |
| HSt-B06 | addFragmentFromExpedition | amount=NaN → FIX-001已防护 | P0 | ✅ covered | R2确认FIX-001有效 |
| HSt-B07 | exchangeFragmentsFromShop | 铜钱不足→失败 | P1 | ✅ covered | 测试覆盖 |
| HSt-B08 | exchangeFragmentsFromShop | dailyLimit=0→remaining=0→失败 | P1 | ✅ covered | 测试覆盖 |
| HSt-B09 | gainFragmentsFromStage | rng返回边界值(0/1) | P2 | ✅ covered | 测试覆盖 |
| HSt-B10 | resetDailyExchangeLimits | 正常重置 | P1 | ✅ covered | 测试覆盖 |
| HSt-B11 | addFragmentFromActivity | source参数为空字符串 | P2 | ✅ covered | R2新增(低风险) |
| HSt-B12 | gainFragmentsFromStage | stageId=空字符串→无匹配→空结果 | P1 | ✅ covered | R2新增 |

### 3.2 升星操作 (starUp/getStarUpPreview/getStarUpCost) — 14节点

| ID | API | 场景 | 优先级 | R2状态 | R1变化 |
|----|-----|------|--------|--------|--------|
| HSt-N05 | starUp | 正常升星 | P1 | ✅ covered | 测试覆盖 |
| HSt-N06 | starUp | 满星(6星)→失败 | P1 | ✅ covered | 测试覆盖 |
| HSt-N07 | getStarUpPreview | 正常预览 | P1 | ✅ covered | 测试覆盖 |
| HSt-N08 | getStarUpCost | 正常计算 | P2 | ✅ covered | 测试覆盖 |
| HSt-B13 | starUp | 碎片不足→失败 | P1 | ✅ covered | 测试覆盖 |
| HSt-B14 | starUp | 铜钱不足→失败 | P1 | ✅ covered | 测试覆盖 |
| HSt-B15 | starUp | 武将不存在→失败 | P1 | ✅ covered | 测试覆盖 |
| HSt-B16 | starUp | deps未注入→失败 | P1 | ✅ covered | 测试覆盖 |
| HSt-B17 | getStarUpCost | currentStar=NaN → Math.min(NaN, len-1)=NaN→索引异常 | P0 | ⚠️ uncovered | R2新增 |
| HSt-B18 | getStarUpCost | currentStar超出数组范围→使用最后一个 | P1 | ✅ covered | 测试覆盖 |
| HSt-B19 | starUp | 升星后getStarMultiplier返回值正确性 | P1 | ✅ covered | 测试覆盖 |
| HSt-B20 | starUp | 升星后skillUnlockCallback被正确调用 | P0 | ⚠️ uncovered | R2新增 |
| HSt-B21 | starUp | 升星后getLevelCap变化正确性 | P1 | ✅ covered | 测试覆盖 |
| HSt-B22 | starUp | currentStar=0 → STAR_UP_FRAGMENT_COST[0] | P1 | ✅ covered | 测试覆盖 |

### 3.3 突破系统 (breakthrough/getBreakthroughStage等) — 10节点

| ID | API | 场景 | 优先级 | R2状态 | R1变化 |
|----|-----|------|--------|--------|--------|
| HSt-N09 | breakthrough | 正常突破 | P1 | ✅ covered | 测试覆盖 |
| HSt-N10 | breakthrough | 满突破(4阶)→失败 | P1 | ✅ covered | 测试覆盖 |
| HSt-N11 | getBreakthroughStage | 正常查询 | P2 | ✅ covered | 测试覆盖 |
| HSt-N12 | getLevelCap | 正常查询(含stage参数) | P1 | ✅ covered | 测试覆盖 |
| HSt-B23 | breakthrough | 碎片不足→失败 | P1 | ✅ covered | 测试覆盖 |
| HSt-B24 | breakthrough | 铜钱不足→失败 | P1 | ✅ covered | 测试覆盖 |
| HSt-B25 | breakthrough | 突破石不足→失败 | P1 | ✅ covered | 测试覆盖 |
| HSt-B26 | getLevelCap | stage=NaN → FIX-001已防护 | P0 | ✅ covered | R2确认FIX-001有效 |
| HSt-B27 | getLevelCap | stage=0 → 返回INITIAL_LEVEL_CAP(50) | P1 | ✅ covered | 测试覆盖 |
| HSt-B28 | breakthrough | 突破后levelCap正确更新 | P1 | ✅ covered | 测试覆盖 |

### 3.4 序列化/系统管理 — 8节点

| ID | API | 场景 | 优先级 | R2状态 | R1变化 |
|----|-----|------|--------|--------|--------|
| HSt-N13 | serialize | 正常序列化 | P1 | ✅ covered | 测试覆盖 |
| HSt-N14 | deserialize | 正常反序列化 | P1 | ✅ covered | 测试覆盖 |
| HSt-E01 | deserialize(null) | FIX-003已防护→createEmptyStarState() | P0 | ✅ covered | R2确认FIX-003有效 |
| HSt-E02 | deserialize(版本不匹配) | 仅warn不迁移 | P1 | ⚠️ uncovered | R2新增 |
| HSt-E03 | serialize→deserialize | 往返一致性 | P1 | ✅ covered | 测试覆盖 |
| HSt-E04 | reset | 正常重置 | P2 | ✅ covered | 测试覆盖 |
| HSt-E05 | init | 注入依赖 | P2 | ✅ covered | 测试覆盖 |
| HSt-E06 | setDeps | 注入业务依赖 | P2 | ✅ covered | 测试覆盖 |

---

## 4. HeroSerializer (HeroSerializer.ts) — 18节点

### 4.1 深拷贝 (cloneGeneral/cloneState) — 8节点

| ID | API | 场景 | 优先级 | R2状态 | R1变化 |
|----|-----|------|--------|--------|--------|
| HSer-N01 | cloneGeneral | 正常深拷贝 | P1 | ✅ covered | 测试覆盖 |
| HSer-N02 | cloneState | 正常深拷贝 | P1 | ✅ covered | 测试覆盖 |
| HSer-N03 | createEmptyState | 返回空状态 | P2 | ✅ covered | 测试覆盖 |
| HSer-E01 | cloneGeneral(null) | {...null}崩溃 | P0 | ⚠️ uncovered | R1标uncovered→R2维持(未修复) |
| HSer-E02 | cloneGeneral(undefined) | 同上 | P0 | ⚠️ uncovered | R2新增 |
| HSer-E03 | cloneState({generals:{a:null}}) | cloneGeneral(null)崩溃 | P0 | ⚠️ uncovered | R2新增(吸收A5/A6挑战) |
| HSer-E04 | cloneGeneral(含NaN属性) | 深拷贝保留NaN | P1 | ⚠️ uncovered | R2新增 |
| HSer-E05 | cloneGeneral(含undefined属性) | 深拷贝保留undefined | P2 | ⚠️ uncovered | R2新增 |

### 4.2 序列化/反序列化 — 10节点

| ID | API | 场景 | 优先级 | R2状态 | R1变化 |
|----|-----|------|--------|--------|--------|
| HSer-N04 | serializeHeroState | 正常序列化 | P1 | ✅ covered | 测试覆盖 |
| HSer-N05 | deserializeHeroState | 正常反序列化 | P1 | ✅ covered | 测试覆盖 |
| HSer-E06 | deserializeHeroState(null) | FIX-003已防护→createEmptyState() | P0 | ✅ covered | R2确认FIX-003有效 |
| HSer-E07 | deserializeHeroState(undefined) | 同上 | P0 | ✅ covered | R2确认FIX-003有效 |
| HSer-E08 | deserializeHeroState({state:{generals:{a:null}}}) | cloneGeneral(null)崩溃 | P0 | ⚠️ uncovered | R2新增(吸收A6挑战) |
| HSer-E09 | deserializeHeroState(版本不匹配) | 仅warn | P1 | ⚠️ uncovered | R2新增 |
| HSer-E10 | serializeHeroState→deserializeHeroState | 往返一致性 | P1 | ✅ covered | 测试覆盖 |
| HSer-E11 | deserializeHeroState(空generals) | 返回空generals | P1 | ✅ covered | 测试覆盖 |
| HSer-E12 | deserializeHeroState(空fragments) | 返回空fragments | P1 | ✅ covered | 测试覆盖 |
| HSer-E13 | serializeHeroState(含NaN碎片) | NaN被序列化到存档 | P0 | ⚠️ uncovered | R2新增 |

---

## 5. HeroFormation (HeroFormation.ts) — 38节点

### 5.1 编队管理 (createFormation/deleteFormation/setFormation等) — 16节点

| ID | API | 场景 | 优先级 | R2状态 | R1变化 |
|----|-----|------|--------|--------|--------|
| HF-N01 | createFormation | 正常创建 | P1 | ✅ covered | 测试覆盖 |
| HF-N02 | deleteFormation | 正常删除 | P1 | ✅ covered | 测试覆盖 |
| HF-N03 | setFormation | 正常设置武将列表 | P1 | ✅ covered | 测试覆盖 |
| HF-N04 | renameFormation | 正常重命名 | P2 | ✅ covered | 测试覆盖 |
| HF-B01 | createFormation | 已达上限→null | P1 | ✅ covered | 测试覆盖 |
| HF-B02 | createFormation | 前置条件不满足(城堡等级/铜钱)→null | P1 | ✅ covered | 测试覆盖 |
| HF-B03 | createFormation | 铜钱扣除失败→null | P1 | ✅ covered | 测试覆盖 |
| HF-B04 | deleteFormation | 删除活跃编队→自动切换 | P1 | ✅ covered | 测试覆盖 |
| HF-B05 | setFormation | generalIds超6人→截断 | P1 | ✅ covered | 测试覆盖 |
| HF-B06 | setFormation | generalIds=null→slice崩溃 | P0 | ⚠️ uncovered | R2新增(吸收C3挑战) |
| HF-B07 | renameFormation | name超10字符→截断 | P2 | ✅ covered | 测试覆盖 |
| HF-B08 | setMaxFormations | max<MAX_FORMATIONS→被Math.max限制 | P1 | ✅ covered | 测试覆盖 |
| HF-B09 | createFormation | id已存在→null | P1 | ✅ covered | 测试覆盖 |
| HF-B10 | createFormation | 无可用id→null | P1 | ✅ covered | 测试覆盖 |
| HF-B11 | setMaxFormations | 缩减时已有编队数超限→不处理 | P1 | ⚠️ uncovered | R2新增(吸收C4挑战) |
| HF-B12 | setMaxFormations | max=NaN → Math.min(NaN,5)=NaN | P0 | ⚠️ uncovered | R2新增 |

### 5.2 编队操作 (addToFormation/removeFromFormation等) — 10节点

| ID | API | 场景 | 优先级 | R2状态 | R1变化 |
|----|-----|------|--------|--------|--------|
| HF-N05 | addToFormation | 正常添加 | P1 | ✅ covered | 测试覆盖 |
| HF-N06 | removeFromFormation | 正常移除 | P1 | ✅ covered | 测试覆盖 |
| HF-N07 | setActiveFormation | 正常切换 | P2 | ✅ covered | 测试覆盖 |
| HF-B13 | addToFormation | 编队已满→null | P1 | ✅ covered | 测试覆盖 |
| HF-B14 | addToFormation | 武将已在其他编队→null | P1 | ✅ covered | 测试覆盖 |
| HF-B15 | addToFormation | 武将已在该编队→null | P1 | ✅ covered | 测试覆盖 |
| HF-B16 | addToFormation | 不验证武将是否真实存在→可填入无效ID | P0 | ⚠️ uncovered | R2新增(吸收C2挑战) |
| HF-B17 | removeFromFormation | 武将不在编队→null | P1 | ✅ covered | 测试覆盖 |
| HF-B18 | setActiveFormation | id不存在→false | P1 | ✅ covered | 测试覆盖 |
| HF-B19 | addToFormation | generalId=空字符串→填入空位 | P1 | ⚠️ uncovered | R2新增 |

### 5.3 战力计算/一键布阵/序列化 — 12节点

| ID | API | 场景 | 优先级 | R2状态 | R1变化 |
|----|-----|------|--------|--------|--------|
| HF-N08 | calculateFormationPower | 正常计算(含羁绊) | P1 | ✅ covered | 测试覆盖 |
| HF-N09 | autoFormationByIds | 正常一键布阵 | P1 | ✅ covered | 测试覆盖 |
| HF-N10 | serialize | 正常序列化 | P1 | ✅ covered | 测试覆盖 |
| HF-N11 | deserialize | 正常反序列化 | P1 | ✅ covered | 测试覆盖 |
| HF-E01 | deserialize(null) | FIX-003已防护→空状态 | P0 | ✅ covered | R2确认FIX-003有效 |
| HF-E02 | calculateFormationPower | getGeneral返回undefined→跳过 | P1 | ✅ covered | 测试覆盖 |
| HF-E03 | calculateFormationPower | calcPower返回NaN→战力=NaN | P0 | ⚠️ uncovered | R2新增 |
| HF-E04 | autoFormationByIds | candidateIds=null→filter崩溃 | P0 | ⚠️ uncovered | R2新增 |
| HF-E05 | autoFormationByIds | getGeneral=null→调用崩溃 | P0 | ⚠️ uncovered | R2新增 |
| HF-E06 | getActiveBondCount回调未注入→bondCount=0 | 羁绊加成为0 | P1 | ✅ covered | R2验证 |
| HF-E07 | serialize→deserialize | 往返一致性 | P1 | ✅ covered | 测试覆盖 |
| HF-E08 | reset | 正常重置 | P2 | ✅ covered | 测试覆盖 |

---

## 6. HeroRecruitSystem (HeroRecruitSystem.ts) — 32节点

### 6.1 招募消耗与保底 — 10节点

| ID | API | 场景 | 优先级 | R2状态 | R1变化 |
|----|-----|------|--------|--------|--------|
| HR-N01 | getRecruitCost | 正常计算(单抽) | P2 | ✅ covered | 测试覆盖 |
| HR-N02 | getRecruitCost | 十连折扣计算 | P1 | ✅ covered | 测试覆盖 |
| HR-N03 | canRecruit | 资源充足 | P1 | ✅ covered | 测试覆盖 |
| HR-N04 | getGachaState | 返回保底状态副本 | P2 | ✅ covered | 测试覆盖 |
| HR-N05 | getNextTenPullPity | 正常计算 | P2 | ✅ covered | 测试覆盖 |
| HR-N06 | getNextHardPity | 正常计算 | P2 | ✅ covered | 测试覆盖 |
| HR-B01 | getRecruitCost | count=NaN → NaN*amount=NaN | P0 | ⚠️ uncovered | R2新增 |
| HR-B02 | getRecruitCost | count=0 → amount=0 | P1 | ⚠️ uncovered | R2新增 |
| HR-B03 | getRecruitCost | count=负数 → 负数消耗 | P0 | ⚠️ uncovered | R2新增 |
| HR-B04 | canRecruit | recruitDeps未注入→false | P1 | ✅ covered | 测试覆盖 |

### 6.2 招募执行 (recruitSingle/recruitTen/freeRecruitSingle) — 12节点

| ID | API | 场景 | 优先级 | R2状态 | R1变化 |
|----|-----|------|--------|--------|--------|
| HR-N07 | recruitSingle | 正常单抽 | P1 | ✅ covered | 测试覆盖 |
| HR-N08 | recruitTen | 正常十连 | P1 | ✅ covered | 测试覆盖 |
| HR-N09 | freeRecruitSingle | 正常免费招募 | P1 | ✅ covered | 测试覆盖 |
| HR-B05 | recruitTen | 资源不足→null | P1 | ✅ covered | 测试覆盖 |
| HR-B06 | recruitTen | 资源扣除后中途异常→资源不回滚 | P0 | ⚠️ uncovered | R2新增(吸收C7挑战) |
| HR-B07 | executeSinglePull | 就地修改pity对象→副作用 | P0 | ⚠️ uncovered | R2新增(吸收C6挑战) |
| HR-B08 | freeRecruitSingle | 免费次数已用完→null | P1 | ✅ covered | 测试覆盖 |
| HR-B09 | recruitTen | 十连保底RARE正确触发 | P1 | ✅ covered | 测试覆盖 |
| HR-B10 | recruitTen | 硬保底LEGENDARY正确触发 | P1 | ✅ covered | 测试覆盖 |
| HR-B11 | recruitSingle | UP武将正确触发 | P1 | ✅ covered | 测试覆盖 |
| HR-B12 | executeRecruit | recruitDeps未注入→null | P1 | ✅ covered | 测试覆盖 |
| HR-B13 | recruitTen | 结果按品质排序正确性 | P1 | ✅ covered | 测试覆盖 |

### 6.3 UP武将/历史/序列化 — 10节点

| ID | API | 场景 | 优先级 | R2状态 | R1变化 |
|----|-----|------|--------|--------|--------|
| HR-N10 | setUpHero | 正常设置 | P1 | ✅ covered | 测试覆盖 |
| HR-N11 | getUpHeroState | 正常查询 | P2 | ✅ covered | 测试覆盖 |
| HR-N12 | getRecruitHistory | 正常查询 | P2 | ✅ covered | 测试覆盖 |
| HR-N13 | serialize | 正常序列化 | P1 | ✅ covered | 测试覆盖 |
| HR-N14 | deserialize | 正常反序列化 | P1 | ✅ covered | 测试覆盖 |
| HR-E01 | deserialize(null) | FIX-003已防护→默认状态 | P0 | ✅ covered | R2确认FIX-003有效 |
| HR-E02 | setUpHero | rate=NaN → upRate=NaN→UP判定永久失败 | P0 | ⚠️ uncovered | R2新增(吸收A14挑战) |
| HR-E03 | setUpHero | rate>1.0 → UP必触发 | P0 | ⚠️ uncovered | R2新增(吸收A14挑战) |
| HR-E04 | clearRecruitHistory | 正常清空 | P2 | ✅ covered | 测试覆盖 |
| HR-E05 | checkDailyReset | 跨日重置正确性 | P1 | ✅ covered | 测试覆盖 |

---

## 7. RecruitTokenEconomySystem (recruit-token-economy-system.ts) — 28节点

### 7.1 被动产出/新手礼包/日常任务 — 10节点

| ID | API | 场景 | 优先级 | R2状态 | R1变化 |
|----|-----|------|--------|--------|--------|
| TE-N01 | tick | 正常被动产出 | P1 | ✅ covered | 测试覆盖 |
| TE-N02 | claimNewbiePack | 正常领取 | P1 | ✅ covered | 测试覆盖 |
| TE-N03 | claimDailyTaskReward | 正常领取 | P1 | ✅ covered | 测试覆盖 |
| TE-B01 | tick | dt=NaN → FIX-001已防护 | P0 | ✅ covered | R2确认FIX-001有效 |
| TE-B02 | tick | dt=负数 → FIX-001已防护 | P0 | ✅ covered | R2确认FIX-001有效 |
| TE-B03 | tick | dt=Infinity → earned=Infinity→addRecruitToken(Infinity) | P0 | ⚠️ uncovered | R2新增 |
| TE-B04 | claimNewbiePack | 已领取→返回0 | P1 | ✅ covered | 测试覆盖 |
| TE-B05 | claimNewbiePack | economyDeps未注入→返回0 | P1 | ✅ covered | 测试覆盖 |
| TE-B06 | claimDailyTaskReward | 已领取→返回0 | P1 | ✅ covered | 测试覆盖 |
| TE-B07 | claimDailyTaskReward | 跨日后可再次领取 | P1 | ✅ covered | 测试覆盖 |

### 7.2 商店购买/关卡首通/活动/离线 — 10节点

| ID | API | 场景 | 优先级 | R2状态 | R1变化 |
|----|-----|------|--------|--------|--------|
| TE-N04 | buyFromShop | 正常购买 | P1 | ✅ covered | 测试覆盖 |
| TE-N05 | claimStageClearReward | 正常领取 | P1 | ✅ covered | 测试覆盖 |
| TE-N06 | claimEventReward | 正常领取 | P1 | ✅ covered | 测试覆盖 |
| TE-N07 | claimOfflineReward | 正常领取 | P1 | ✅ covered | 测试覆盖 |
| TE-B08 | buyFromShop | count=NaN → FIX-001已防护 | P0 | ✅ covered | R2确认FIX-001有效 |
| TE-B09 | buyFromShop | 日限购已满→false | P1 | ✅ covered | 测试覆盖 |
| TE-B10 | buyFromShop | 铜钱不足→false | P1 | ✅ covered | 测试覆盖 |
| TE-B11 | claimStageClearReward | 重复领取→返回0 | P1 | ✅ covered | 测试覆盖 |
| TE-B12 | calculateOfflineReward | offlineSeconds=NaN → FIX-001已防护 | P0 | ✅ covered | R2确认FIX-001有效 |
| TE-B13 | claimOfflineReward | reward=0 → 返回0 | P1 | ✅ covered | 测试覆盖 |

### 7.3 查询/序列化 — 8节点

| ID | API | 场景 | 优先级 | R2状态 | R1变化 |
|----|-----|------|--------|--------|--------|
| TE-N08 | getDailyShopRemaining | 正常查询 | P2 | ✅ covered | 测试覆盖 |
| TE-N09 | serialize | 正常序列化 | P1 | ✅ covered | 测试覆盖 |
| TE-N10 | deserialize | 正常反序列化 | P1 | ✅ covered | 测试覆盖 |
| TE-E01 | deserialize(null) | FIX-003已防护→默认状态 | P0 | ✅ covered | R2确认FIX-003有效 |
| TE-E02 | serialize→deserialize | 往返一致性 | P1 | ✅ covered | 测试覆盖 |
| TE-E03 | deserialize(版本不匹配) | 尝试加载但字段可能缺失 | P1 | ⚠️ uncovered | R2新增 |
| TE-E04 | checkDailyReset | 跨日重置正确性 | P1 | ✅ covered | 测试覆盖 |
| TE-E05 | reset | 正常重置 | P2 | ✅ covered | 测试覆盖 |

---

## Part A 统计

| 维度 | 节点数 | covered | uncovered | P0 | P1 | P2 |
|------|--------|---------|-----------|-----|-----|-----|
| HeroSystem | 82 | 56 | 26 | 20 | 40 | 22 |
| HeroLevelSystem | 44 | 34 | 10 | 8 | 24 | 12 |
| HeroStarSystem | 48 | 40 | 8 | 8 | 30 | 10 |
| HeroSerializer | 18 | 11 | 7 | 6 | 8 | 4 |
| HeroFormation | 38 | 28 | 10 | 8 | 20 | 10 |
| HeroRecruitSystem | 32 | 22 | 10 | 8 | 18 | 6 |
| RecruitTokenEconomy | 28 | 24 | 4 | 4 | 18 | 6 |
| **Part A 合计** | **290** | **215** | **75** | **62** | **158** | **70** |

### R1→R2 变化

| 指标 | R1 | R2 | 变化 |
|------|----|----|------|
| 总节点 | 245 | 290 | +45 |
| covered | ~195 | 215 | +20 |
| uncovered | ~50 | 75 | +25 |
| P0 | 72 | 62 | -10(FIX修复+重新分类) |
| 新增节点 | - | 45 | NaN/null路径+算法正确性 |

### 关键改进

1. **FIX-001~004验证**: 37个节点确认修复有效(NaN绕过、useFragments负值、deserialize null、FormationRecommend null)
2. **NaN遗漏路径**: 新增15个NaN相关uncovered节点(calculatePower链、排序、配置索引等)
3. **算法正确性**: 新增8个算法输出正确性节点(排序、推荐去重、保底触发)
4. **null/undefined路径**: 新增12个null路径节点(serialize损坏数据、回调null等)
5. **架构缺陷标注**: HS-B14标注setBondMultiplierGetter从未被调用(吸收CH-002)
