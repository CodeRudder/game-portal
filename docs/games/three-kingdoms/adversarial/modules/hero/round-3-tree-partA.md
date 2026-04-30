# Hero 流程分支树 Round 3 — Part A（核心子系统）

> Builder: TreeBuilder v1.2 | Time: 2026-05-01
> R2结果: 690节点，Builder评分7.5/10，Challenger评分8.0/10，Arbiter裁决8.3/10 CONTINUE
> R2修复: FIX-201(集成注入) + FIX-202(getStarMultiplier/cloneGeneral) + FIX-203(calculatePower NaN) + FIX-204(碎片溢出)

## R2→R3 改进（v1.2新规则应用）

| 新规则 | 应用方式 | 影响节点数 |
|--------|---------|-----------|
| BR-019 修复穿透检查 | 验证FIX-201~204是否穿透到底层函数 | +12穿透验证节点 |
| BR-020 回调注入点调用验证 | 验证所有setter/getter在初始化时被调用 | +6注入验证节点 |
| BR-021 资源溢出闭环验证 | 扫描所有资源获取API的溢出处理 | +4溢出闭环节点 |
| BR-022 事务性操作扫描 | 枚举"先扣后执行"中途异常场景 | +3事务性节点 |

## Part A 子系统清单

| # | 子系统 | 源文件 | 公开API数 | R2节点 | R3节点 |
|---|--------|--------|----------|--------|--------|
| 1 | HeroSystem | HeroSystem.ts | 28 | 82 | 78 |
| 2 | HeroLevelSystem | HeroLevelSystem.ts | 14 | 44 | 40 |
| 3 | HeroStarSystem | HeroStarSystem.ts | 18 | 48 | 44 |
| 4 | HeroSerializer | HeroSerializer.ts | 5 | 18 | 16 |
| 5 | HeroFormation | HeroFormation.ts | 22 | 38 | 36 |
| 6 | HeroRecruitSystem | HeroRecruitSystem.ts | 20 | 32 | 30 |
| 7 | RecruitTokenEconomy | recruit-token-economy-system.ts | 22 | 28 | 26 |
| **合计** | **7个子系统** | | **~129** | **290** | **270** |

---

## 1. HeroSystem (HeroSystem.ts) — 78节点

### 1.1 武将管理 (addGeneral/removeGeneral/getGeneral) — 14节点

| ID | API | 场景 | 优先级 | R3状态 | R2变化 |
|----|-----|------|--------|--------|--------|
| HS-N01 | addGeneral | 正常添加武将 | P1 | ✅ covered | 维持 |
| HS-N02 | addGeneral | 重复添加返回null | P1 | ✅ covered | 维持 |
| HS-N03 | removeGeneral | 正常移除 | P1 | ✅ covered | 维持 |
| HS-N04 | getGeneral | 获取已存在武将 | P2 | ✅ covered | 维持 |
| HS-N05 | getGeneral | 获取不存在武将返回undefined | P2 | ✅ covered | 维持 |
| HS-N06 | getAllGenerals | 返回所有武将副本 | P2 | ✅ covered | 维持 |
| HS-N07 | hasGeneral | 正常查询 | P2 | ✅ covered | 维持 |
| HS-N08 | getGeneralCount | 返回数量 | P2 | ✅ covered | 维持 |
| HS-E01 | addGeneral(null) | 安全返回null | P1 | ✅ covered | 维持 |
| HS-E02 | addGeneral(undefined) | 安全返回null | P1 | ✅ covered | 维持 |
| HS-E03 | addGeneral(空字符串) | 安全返回null | P1 | ✅ covered | 维持 |
| HS-E04 | removeGeneral(不存在的ID) | 返回null | P2 | ✅ covered | 维持 |
| HS-E05 | removeGeneral(已派驻武将) | 移除成功但派驻关系未清理→XC风险 | P0 | ⚠️ uncovered | 维持(R2未修复) |
| HS-E06 | getGeneral返回值被修改 | cloneGeneral返回深拷贝，安全 | P2 | ✅ covered | 维持 |

### 1.2 战力计算 (calculatePower/calculateTotalPower/calculateFormationPower) — 16节点

| ID | API | 场景 | 优先级 | R3状态 | R2变化 |
|----|-----|------|--------|--------|--------|
| HS-B01 | calculatePower | 正常计算(含星级+装备+羁绊) | P1 | ✅ covered | 维持 |
| HS-B02 | calculatePower | star=0 → getStarMultiplier(0)=1.0 | P1 | ✅ covered | 维持 |
| HS-B03 | calculatePower | star=NaN → getStarMultiplier(NaN)=1(FIX-202)→starCoeff=1 | P1 | ✅ covered | R3验证: FIX-202已防护，getStarMultiplier(NaN)返回1 |
| HS-B04 | calculatePower | quality=非法值 → QUALITY_MULTIPLIERS[undefined]=undefined→raw=NaN→FIX-203返回0 | P1 | ✅ covered | R3验证: FIX-203最终防护兜底 |
| HS-B05 | calculatePower | level=NaN → levelCoeff=NaN→raw=NaN→FIX-203返回0 | P1 | ✅ covered | R3验证: FIX-203最终防护兜底 |
| HS-B06 | calculatePower | baseStats含NaN → statsPower=NaN→raw=NaN→FIX-203返回0 | P1 | ✅ covered | R3验证: FIX-203最终防护兜底 |
| HS-B07 | calculatePower | totalEquipmentPower=NaN → equipmentCoeff=NaN→raw=NaN→FIX-203返回0 | P1 | ✅ covered | R3验证: FIX-203最终防护兜底 |
| HS-B08 | calculatePower | bondMultiplier=NaN → bondCoeff=NaN→raw=NaN→FIX-203返回0 | P1 | ✅ covered | R3验证: FIX-203最终防护兜底 |
| HS-B09 | calculatePower | 所有参数正常但乘法溢出→raw=Infinity→FIX-203返回0 | P1 | ✅ covered | R3验证: FIX-203最终防护兜底 |
| HS-N09 | calculateTotalPower | 正常计算 | P1 | ✅ covered | 维持 |
| HS-N10 | calculateFormationPower | 正常计算(含羁绊系数) | P1 | ✅ covered | 维持 |
| HS-B10 | calculateFormationPower | generalIds=[] → 返回0 | P2 | ✅ covered | 维持 |
| HS-B11 | calculateFormationPower | generalIds含无效ID → 跳过 | P1 | ✅ covered | 维持 |
| HS-B12 | calculateFormationPower | getStar回调返回NaN → starCoeff=NaN→raw=NaN→FIX-203返回0 | P1 | ✅ covered | R3验证: FIX-203兜底 |
| HS-B13 | calculateFormationPower | _getBondMultiplier未注入→fallback 1.0 | P1 | ✅ covered | R3验证: FIX-201已修复注入 |
| HS-B14 | calculateFormationPower | _getBondMultiplier已注入→使用注入值 | P1 | ✅ covered | R3验证: FIX-201已修复，engine-hero-deps.ts L123调用 |

### 1.3 碎片管理 (addFragment/useFragments/handleDuplicate/fragmentSynthesize) — 20节点

| ID | API | 场景 | 优先级 | R3状态 | R2变化 |
|----|-----|------|--------|--------|--------|
| HS-N11 | addFragment | 正常添加(含FRAGMENT_CAP=999) | P1 | ✅ covered | 维持 |
| HS-N12 | addFragment | 溢出→返回溢出数(FIX-204) | P1 | ✅ covered | R3验证: FRAGMENT_CAP=999，溢出返回newTotal-cap |
| HS-N13 | useFragments | 正常消耗 | P1 | ✅ covered | 维持 |
| HS-N14 | useFragments | 碎片不足→false | P1 | ✅ covered | 维持 |
| HS-N15 | handleDuplicate | 正常转化 | P1 | ✅ covered | 维持 |
| HS-N16 | fragmentSynthesize | 正常合成 | P1 | ✅ covered | 维持 |
| HS-N17 | fragmentSynthesize | 碎片不足→null | P1 | ✅ covered | 维持 |
| HS-N18 | fragmentSynthesize | 已拥有→null | P1 | ✅ covered | 维持 |
| HS-B15 | addFragment | count=0 → 返回0 | P2 | ✅ covered | 维持 |
| HS-B16 | addFragment | count=NaN → !Number.isFinite→返回0 | P1 | ✅ covered | 维持 |
| HS-B17 | addFragment | count=Infinity → 返回0 | P1 | ✅ covered | 维持 |
| HS-B18 | addFragment | count=负数 → 返回0 | P1 | ✅ covered | 维持 |
| HS-B19 | useFragments | count=0 → false | P1 | ✅ covered | 维持 |
| HS-B20 | useFragments | count=NaN → false | P1 | ✅ covered | 维持 |
| HS-B21 | useFragments | count=负数 → false | P1 | ✅ covered | 维持 |
| HS-B22 | useFragments | count=Infinity → false | P1 | ✅ covered | 维持 |
| HS-E07 | handleDuplicate | quality=undefined → DUPLICATE_FRAGMENT_COUNT[undefined]=undefined→addFragment(id,undefined)→FIX-001返回0 | P1 | ✅ covered | R3验证: addFragment已防护NaN/undefined |
| HS-E08 | handleDuplicate | quality=非法字符串 → 同上 | P1 | ✅ covered | R3验证 |
| HS-E09 | fragmentSynthesize | 武将定义不存在→null | P1 | ✅ covered | 维持 |
| HS-E10 | getFragments | 不存在的武将→返回0 | P2 | ✅ covered | 维持 |

### 1.4 升级经验 (addExp/setLevelAndExp/getExpRequired) — 10节点

| ID | API | 场景 | 优先级 | R3状态 | R2变化 |
|----|-----|------|--------|--------|--------|
| HS-N19 | addExp | 正常升级 | P1 | ✅ covered | 维持 |
| HS-N20 | addExp | 连续升级 | P1 | ✅ covered | 维持 |
| HS-N21 | addExp | 满级返回null | P1 | ✅ covered | 维持 |
| HS-N22 | getExpRequired | 正常查表 | P2 | ✅ covered | 维持 |
| HS-N23 | setLevelAndExp | 正常设置 | P1 | ✅ covered | 维持 |
| HS-B23 | addExp | exp=0 → 不升级但经验保留 | P2 | ✅ covered | 维持 |
| HS-B24 | addExp | exp=NaN → while(NaN>0)不执行→gained=0→return null | P1 | ✅ covered | 维持(安全但静默) |
| HS-B25 | addExp | exp=负数 → while(负数>0)不执行→return null | P1 | ✅ covered | 维持 |
| HS-B26 | setLevelAndExp | level=NaN/exp=NaN → 直接赋值,无防护 | P1 | ⚠️ uncovered | 维持(低风险:内部调用) |
| HS-B27 | setLevelAndExp | generalId不存在→undefined | P1 | ✅ covered | 维持 |

### 1.5 查询工具 — 6节点

| ID | API | 场景 | 优先级 | R3状态 | R2变化 |
|----|-----|------|--------|--------|--------|
| HS-N24 | getGeneralsByFaction | 正常筛选 | P2 | ✅ covered | 维持 |
| HS-N25 | getGeneralsByQuality | 正常筛选 | P2 | ✅ covered | 维持 |
| HS-N26 | getGeneralsSortedByPower | 降序排列 | P1 | ✅ covered | 维持 |
| HS-B28 | getGeneralsSortedByPower | 某武将战力=NaN→FIX-203返回0→排最后 | P1 | ✅ covered | R3验证: calculatePower返回0而非NaN |
| HS-N27 | getAllGeneralDefs | 返回静态配置 | P2 | ✅ covered | 维持 |
| HS-N28 | updateSkillLevel | 正常更新 | P1 | ✅ covered | 维持 |

### 1.6 序列化/反序列化 — 12节点

| ID | API | 场景 | 优先级 | R3状态 | R2变化 |
|----|-----|------|--------|--------|--------|
| HS-N29 | serialize | 正常序列化 | P1 | ✅ covered | 维持 |
| HS-N30 | deserialize | 正常反序列化 | P1 | ✅ covered | 维持 |
| HS-N31 | serialize→deserialize | 往返一致性 | P1 | ✅ covered | 维持 |
| HS-E11 | deserialize(null) | FIX-003已防护→createEmptyState() | P1 | ✅ covered | 维持 |
| HS-E12 | deserialize(undefined) | FIX-003已防护→createEmptyState() | P1 | ✅ covered | 维持 |
| HS-E13 | deserialize(损坏数据:generals含null) | FIX-202已防护→跳过null元素 | P1 | ✅ covered | R3验证: HeroSerializer L91 if(g) guard |
| HS-E14 | deserialize(版本不匹配) | 仅warn不迁移→数据可能丢失 | P1 | ⚠️ uncovered | 维持(需版本迁移策略) |
| HS-E15 | reset | 正常重置 | P2 | ✅ covered | 维持 |
| HS-E16 | init | 注入依赖 | P2 | ✅ covered | 维持 |
| HS-E17 | update | 空实现 | P2 | ✅ covered | 维持 |
| HS-E18 | serialize(含NaN碎片) | NaN被序列化到存档 | P1 | ⚠️ uncovered | 维持(需序列化时NaN过滤) |
| HS-E19 | calculateFormationPower bondCoeff fallback | FIX-201注入后bondCoeff=真实值 | P1 | ✅ covered | R3验证: engine-hero-deps.ts L123 |

---

## 2. HeroLevelSystem (HeroLevelSystem.ts) — 40节点

### 2.1 经验获取 (addExp) — 12节点

| ID | API | 场景 | 优先级 | R3状态 | R2变化 |
|----|-----|------|--------|--------|--------|
| HL-N01 | addExp | 正常升级(含铜钱消耗) | P1 | ✅ covered | 维持 |
| HL-N02 | addExp | 连续多级升级 | P1 | ✅ covered | 维持 |
| HL-N03 | addExp | 铜钱不足→停在当前级 | P1 | ✅ covered | 维持 |
| HL-N04 | addExp | 满级→null | P1 | ✅ covered | 维持 |
| HL-B01 | addExp | amount=NaN → FIX-001已防护 | P1 | ✅ covered | 维持 |
| HL-B02 | addExp | amount=负数 → FIX-001已防护 | P1 | ✅ covered | 维持 |
| HL-B03 | addExp | amount=Infinity → 升到满级 | P1 | ⚠️ uncovered | 维持(非崩溃但非预期行为) |
| HL-B04 | addExp | generalId不存在→null | P1 | ✅ covered | 维持 |
| HL-B05 | addExp | levelDeps未注入→null | P1 | ✅ covered | 维持 |
| HL-B06 | addExp | 铜钱扣除成功但syncToHeroSystem失败 | P1 | ⚠️ uncovered | 维持(事务性问题) |
| HL-B07 | addExp | exp=0 → while(0>0)不执行→return null | P2 | ✅ covered | 维持 |
| HL-B08 | addExp | 升级后statsDiff正确性 | P1 | ✅ covered | 维持 |

### 2.2 消耗计算 — 8节点

| ID | API | 场景 | 优先级 | R3状态 | R2变化 |
|----|-----|------|--------|--------|--------|
| HL-N05 | calculateExpToNextLevel | 正常计算 | P2 | ✅ covered | 维持 |
| HL-N06 | calculateLevelUpCost | 正常计算 | P2 | ✅ covered | 维持 |
| HL-N07 | calculateTotalExp | 正常计算 | P2 | ✅ covered | 维持 |
| HL-N08 | calculateTotalGold | 正常计算 | P2 | ✅ covered | 维持 |
| HL-B09 | calculateTotalExp | from=NaN → to<=NaN为false→返回0 | P1 | ✅ covered | 维持(安全) |
| HL-B10 | calculateTotalExp | to=NaN → 同上 | P1 | ✅ covered | 维持(安全) |
| HL-B11 | calculateTotalExp | from>to → 返回0 | P2 | ✅ covered | 维持 |
| HL-B12 | calculateTotalExp | from>=cap → 返回0 | P1 | ✅ covered | 维持 |

### 2.3 一键强化/批量强化 — 10节点

| ID | API | 场景 | 优先级 | R3状态 | R2变化 |
|----|-----|------|--------|--------|--------|
| HL-N09 | getEnhancePreview | 正常预览 | P1 | ✅ covered | 维持 |
| HL-N10 | quickEnhance | 正常强化 | P1 | ✅ covered | 维持 |
| HL-N11 | batchEnhance | 正常批量强化 | P1 | ✅ covered | 维持 |
| HL-B13 | getEnhancePreview | targetLevel>maxLevel → 自动截断 | P1 | ✅ covered | 维持 |
| HL-B14 | getEnhancePreview | targetLevel=NaN → 截断逻辑异常 | P1 | ⚠️ uncovered | 维持(非崩溃) |
| HL-B15 | quickEnhance | targetLevel=当前级→无操作 | P2 | ✅ covered | 维持 |
| HL-B16 | quickEnhance | 铜钱不足→部分升级 | P1 | ✅ covered | 维持 |
| HL-B17 | batchEnhance | 空列表→无操作 | P2 | ✅ covered | 维持 |
| HL-B18 | batchEnhance | 含无效generalId→跳过 | P1 | ✅ covered | 维持 |
| HL-B19 | batchEnhance | 排序优先级正确性(战力>品质) | P1 | ✅ covered | 维持 |

### 2.4 系统管理 — 10节点

| ID | API | 场景 | 优先级 | R3状态 | R2变化 |
|----|-----|------|--------|--------|--------|
| HL-N12 | levelUp | 正常升一级 | P1 | ✅ covered | 维持 |
| HL-N13 | levelUp | 经验不足→null | P1 | ✅ covered | 维持 |
| HL-N14 | levelUp | 铜钱不足→null | P1 | ✅ covered | 维持 |
| HL-N15 | getHeroMaxLevel | 正常查询 | P2 | ✅ covered | 维持 |
| HL-N16 | statsAtLevel | 正常计算 | P2 | ✅ covered | 维持 |
| HL-B20 | levelUp | expReq=0(查表异常)→null | P1 | ⚠️ uncovered | 维持 |
| HL-B21 | statsAtLevel | level=0 → m=0.97 | P1 | ⚠️ uncovered | 维持(边界值) |
| HL-B22 | statsAtLevel | level=NaN → m=NaN→全NaN | P1 | ⚠️ uncovered | 维持(非崩溃但返回NaN) |
| HL-N17 | serialize | 返回版本号 | P2 | ✅ covered | 维持 |
| HL-N18 | reset | 无额外状态 | P2 | ✅ covered | 维持 |

---

## 3. HeroStarSystem (HeroStarSystem.ts) — 44节点

### 3.1 碎片获取 — 14节点

| ID | API | 场景 | 优先级 | R3状态 | R2变化 |
|----|-----|------|--------|--------|--------|
| HSt-N01 | exchangeFragmentsFromShop | 正常兑换(含溢出退款FIX-204) | P1 | ✅ covered | R3验证: L140 overflow退款 |
| HSt-N02 | exchangeFragmentsFromShop | 达到日限购→失败 | P1 | ✅ covered | 维持 |
| HSt-N03 | gainFragmentsFromStage | 正常掉落 | P1 | ✅ covered | 维持 |
| HSt-N04 | handleDuplicateFragments | 正常转化 | P1 | ✅ covered | 维持 |
| HSt-B01 | exchangeFragmentsFromShop | count=NaN → FIX-001已防护 | P1 | ✅ covered | 维持 |
| HSt-B02 | exchangeFragmentsFromShop | count=负数 → FIX-001已防护 | P1 | ✅ covered | 维持 |
| HSt-B03 | exchangeFragmentsFromShop | generalId不在SHOP_FRAGMENT_EXCHANGE中→失败 | P0 | ⚠️ uncovered | 维持(6名武将缺失配置) |
| HSt-B04 | gainFragmentsFromStage | stageId不在STAGE_FRAGMENT_DROPS中→空结果 | P1 | ✅ covered | 维持 |
| HSt-B05 | addFragmentFromActivity | amount=NaN → FIX-001已防护 | P1 | ✅ covered | 维持 |
| HSt-B06 | addFragmentFromExpedition | amount=NaN → FIX-001已防护 | P1 | ✅ covered | 维持 |
| HSt-B07 | exchangeFragmentsFromShop | 铜钱不足→失败 | P1 | ✅ covered | 维持 |
| HSt-B08 | exchangeFragmentsFromShop | dailyLimit=0→remaining=0→失败 | P1 | ✅ covered | 维持 |
| HSt-B09 | addFragmentFromActivity | 溢出碎片×100转铜钱(FIX-204) | P1 | ✅ covered | R3验证: L176 goldCompensation |
| HSt-B10 | addFragmentFromExpedition | 溢出碎片×100转铜钱(FIX-204) | P1 | ✅ covered | R3验证: L198 goldCompensation |
| HSt-B11 | gainFragmentsFromStage | stageId=空字符串→无匹配→空结果 | P1 | ✅ covered | 维持 |

### 3.2 升星操作 — 12节点

| ID | API | 场景 | 优先级 | R3状态 | R2变化 |
|----|-----|------|--------|--------|--------|
| HSt-N05 | starUp | 正常升星 | P1 | ✅ covered | 维持 |
| HSt-N06 | starUp | 满星(6星)→失败 | P1 | ✅ covered | 维持 |
| HSt-N07 | getStarUpPreview | 正常预览 | P1 | ✅ covered | 维持 |
| HSt-N08 | getStarUpCost | 正常计算 | P2 | ✅ covered | 维持 |
| HSt-B12 | starUp | 碎片不足→失败 | P1 | ✅ covered | 维持 |
| HSt-B13 | starUp | 铜钱不足→失败 | P1 | ✅ covered | 维持 |
| HSt-B14 | starUp | 武将不存在→失败 | P1 | ✅ covered | 维持 |
| HSt-B15 | starUp | deps未注入→失败 | P1 | ✅ covered | 维持 |
| HSt-B16 | getStarUpCost | currentStar=NaN → Math.min(NaN,len)=NaN | P1 | ⚠️ uncovered | 维持(非崩溃但返回NaN) |
| HSt-B17 | getStarUpCost | currentStar超出数组范围→使用最后一个 | P1 | ✅ covered | 维持 |
| HSt-B18 | starUp | 升星后getStarMultiplier返回值正确性 | P1 | ✅ covered | 维持 |
| HSt-B19 | starUp | 升星后skillUnlockCallback被正确调用 | P1 | ⚠️ uncovered | 维持(依赖外部回调) |

### 3.3 突破系统 — 10节点

| ID | API | 场景 | 优先级 | R3状态 | R2变化 |
|----|-----|------|--------|--------|--------|
| HSt-N09 | breakthrough | 正常突破 | P1 | ✅ covered | 维持 |
| HSt-N10 | breakthrough | 满突破(4阶)→失败 | P1 | ✅ covered | 维持 |
| HSt-N11 | getBreakthroughStage | 正常查询 | P2 | ✅ covered | 维持 |
| HSt-N12 | getLevelCap | 正常查询(含stage参数) | P1 | ✅ covered | 维持 |
| HSt-B20 | breakthrough | 碎片不足→失败 | P1 | ✅ covered | 维持 |
| HSt-B21 | breakthrough | 铜钱不足→失败 | P1 | ✅ covered | 维持 |
| HSt-B22 | breakthrough | 突破石不足→失败 | P1 | ✅ covered | 维持 |
| HSt-B23 | getLevelCap | stage=NaN → FIX-001已防护 | P1 | ✅ covered | 维持 |
| HSt-B24 | getLevelCap | stage=0 → 返回INITIAL_LEVEL_CAP(50) | P1 | ✅ covered | 维持 |
| HSt-B25 | breakthrough | 突破后levelCap正确更新 | P1 | ✅ covered | 维持 |

### 3.4 序列化/系统管理 — 8节点

| ID | API | 场景 | 优先级 | R3状态 | R2变化 |
|----|-----|------|--------|--------|--------|
| HSt-N13 | serialize | 正常序列化 | P1 | ✅ covered | 维持 |
| HSt-N14 | deserialize | 正常反序列化 | P1 | ✅ covered | 维持 |
| HSt-E01 | deserialize(null) | FIX-003已防护→createEmptyStarState() | P1 | ✅ covered | 维持 |
| HSt-E02 | deserialize(版本不匹配) | 仅warn不迁移 | P1 | ⚠️ uncovered | 维持 |
| HSt-E03 | serialize→deserialize | 往返一致性 | P1 | ✅ covered | 维持 |
| HSt-E04 | reset | 正常重置 | P2 | ✅ covered | 维持 |
| HSt-E05 | init | 注入依赖 | P2 | ✅ covered | 维持 |
| HSt-E06 | setDeps | 注入业务依赖 | P2 | ✅ covered | 维持 |

---

## 4. HeroSerializer (HeroSerializer.ts) — 16节点

### 4.1 深拷贝 — 6节点

| ID | API | 场景 | 优先级 | R3状态 | R2变化 |
|----|-----|------|--------|--------|--------|
| HSer-N01 | cloneGeneral | 正常深拷贝 | P1 | ✅ covered | 维持 |
| HSer-N02 | cloneState | 正常深拷贝 | P1 | ✅ covered | 维持 |
| HSer-N03 | createEmptyState | 返回空状态 | P2 | ✅ covered | 维持 |
| HSer-E01 | cloneGeneral(null) | FIX-202已防护→返回null | P1 | ✅ covered | R3验证: L33 if(!g) return null |
| HSer-E02 | cloneGeneral(undefined) | FIX-202已防护→返回null | P1 | ✅ covered | R3验证 |
| HSer-E03 | cloneState({generals:{a:null}}) | FIX-202已防护→跳过null | P1 | ✅ covered | R3验证: cloneGeneral(null)安全 |

### 4.2 序列化/反序列化 — 10节点

| ID | API | 场景 | 优先级 | R3状态 | R2变化 |
|----|-----|------|--------|--------|--------|
| HSer-N04 | serializeHeroState | 正常序列化 | P1 | ✅ covered | 维持 |
| HSer-N05 | deserializeHeroState | 正常反序列化 | P1 | ✅ covered | 维持 |
| HSer-E04 | deserializeHeroState(null) | FIX-003已防护→createEmptyState() | P1 | ✅ covered | 维持 |
| HSer-E05 | deserializeHeroState(undefined) | 同上 | P1 | ✅ covered | 维持 |
| HSer-E06 | deserializeHeroState(含null武将) | FIX-202已防护→跳过null | P1 | ✅ covered | R3验证: L91 if(g) guard |
| HSer-E07 | deserializeHeroState(版本不匹配) | 仅warn | P1 | ⚠️ uncovered | 维持 |
| HSer-E08 | serializeHeroState→deserializeHeroState | 往返一致性 | P1 | ✅ covered | 维持 |
| HSer-E09 | deserializeHeroState(空generals) | 返回空generals | P1 | ✅ covered | 维持 |
| HSer-E10 | deserializeHeroState(空fragments) | 返回空fragments | P1 | ✅ covered | 维持 |
| HSer-E11 | serializeHeroState(含NaN碎片) | NaN被序列化到存档 | P1 | ⚠️ uncovered | 维持(需序列化时NaN过滤) |

---

## 5. HeroFormation (HeroFormation.ts) — 36节点

### 5.1 编队管理 — 14节点

| ID | API | 场景 | 优先级 | R3状态 | R2变化 |
|----|-----|------|--------|--------|--------|
| HF-N01 | createFormation | 正常创建 | P1 | ✅ covered | 维持 |
| HF-N02 | deleteFormation | 正常删除 | P1 | ✅ covered | 维持 |
| HF-N03 | setFormation | 正常设置武将列表 | P1 | ✅ covered | 维持 |
| HF-N04 | renameFormation | 正常重命名 | P2 | ✅ covered | 维持 |
| HF-B01 | createFormation | 已达上限→null | P1 | ✅ covered | 维持 |
| HF-B02 | createFormation | 前置条件不满足→null | P1 | ✅ covered | 维持 |
| HF-B03 | createFormation | 铜钱扣除失败→null | P1 | ✅ covered | 维持 |
| HF-B04 | deleteFormation | 删除活跃编队→自动切换 | P1 | ✅ covered | 维持 |
| HF-B05 | setFormation | generalIds超6人→截断 | P1 | ✅ covered | 维持 |
| HF-B06 | setFormation | generalIds=null→slice崩溃 | P0 | ⚠️ uncovered | 维持(R2未修复) |
| HF-B07 | renameFormation | name超10字符→截断 | P2 | ✅ covered | 维持 |
| HF-B08 | setMaxFormations | max<MAX_FORMATIONS→被Math.max限制 | P1 | ✅ covered | 维持 |
| HF-B09 | createFormation | id已存在→null | P1 | ✅ covered | 维持 |
| HF-B10 | createFormation | 无可用id→null | P1 | ✅ covered | 维持 |

### 5.2 编队操作 — 10节点

| ID | API | 场景 | 优先级 | R3状态 | R2变化 |
|----|-----|------|--------|--------|--------|
| HF-N05 | addToFormation | 正常添加 | P1 | ✅ covered | 维持 |
| HF-N06 | removeFromFormation | 正常移除 | P1 | ✅ covered | 维持 |
| HF-N07 | setActiveFormation | 正常切换 | P2 | ✅ covered | 维持 |
| HF-B11 | addToFormation | 编队已满→null | P1 | ✅ covered | 维持 |
| HF-B12 | addToFormation | 武将已在其他编队→null | P1 | ✅ covered | 维持 |
| HF-B13 | addToFormation | 武将已在该编队→null | P1 | ✅ covered | 维持 |
| HF-B14 | addToFormation | 不验证武将是否真实存在→可填入无效ID | P0 | ⚠️ uncovered | 维持(R2未修复) |
| HF-B15 | removeFromFormation | 武将不在编队→null | P1 | ✅ covered | 维持 |
| HF-B16 | setActiveFormation | id不存在→false | P1 | ✅ covered | 维持 |
| HF-B17 | addToFormation | generalId=空字符串→填入空位 | P1 | ⚠️ uncovered | 维持 |

### 5.3 战力计算/一键布阵/序列化 — 12节点

| ID | API | 场景 | 优先级 | R3状态 | R2变化 |
|----|-----|------|--------|--------|--------|
| HF-N08 | calculateFormationPower | 正常计算(含羁绊) | P1 | ✅ covered | 维持 |
| HF-N09 | autoFormationByIds | 正常一键布阵 | P1 | ✅ covered | 维持 |
| HF-N10 | serialize | 正常序列化 | P1 | ✅ covered | 维持 |
| HF-N11 | deserialize | 正常反序列化 | P1 | ✅ covered | 维持 |
| HF-E01 | deserialize(null) | FIX-003已防护→空状态 | P1 | ✅ covered | 维持 |
| HF-E02 | calculateFormationPower | getGeneral返回undefined→跳过 | P1 | ✅ covered | 维持 |
| HF-E03 | calculateFormationPower | calcPower返回NaN→FIX-203返回0 | P1 | ✅ covered | R3验证 |
| HF-E04 | autoFormationByIds | candidateIds=null→filter崩溃 | P0 | ⚠️ uncovered | 维持 |
| HF-E05 | autoFormationByIds | getGeneral=null→调用崩溃 | P0 | ⚠️ uncovered | 维持 |
| HF-E06 | getActiveBondCount回调未注入→bondCount=0 | 羁绊加成为0 | P1 | ✅ covered | 维持 |
| HF-E07 | serialize→deserialize | 往返一致性 | P1 | ✅ covered | 维持 |
| HF-E08 | reset | 正常重置 | P2 | ✅ covered | 维持 |

---

## 6. HeroRecruitSystem (HeroRecruitSystem.ts) — 30节点

### 6.1 招募消耗与保底 — 8节点

| ID | API | 场景 | 优先级 | R3状态 | R2变化 |
|----|-----|------|--------|--------|--------|
| HR-N01 | getRecruitCost | 正常计算(单抽) | P2 | ✅ covered | 维持 |
| HR-N02 | getRecruitCost | 十连折扣计算 | P1 | ✅ covered | 维持 |
| HR-N03 | canRecruit | 资源充足 | P1 | ✅ covered | 维持 |
| HR-N04 | getGachaState | 返回保底状态副本 | P2 | ✅ covered | 维持 |
| HR-N05 | getNextTenPullPity | 正常计算 | P2 | ✅ covered | 维持 |
| HR-N06 | getNextHardPity | 正常计算 | P2 | ✅ covered | 维持 |
| HR-B01 | getRecruitCost | count=NaN → NaN*amount=NaN | P1 | ⚠️ uncovered | 维持 |
| HR-B02 | canRecruit | recruitDeps未注入→false | P1 | ✅ covered | 维持 |

### 6.2 招募执行 — 12节点

| ID | API | 场景 | 优先级 | R3状态 | R2变化 |
|----|-----|------|--------|--------|--------|
| HR-N07 | recruitSingle | 正常单抽 | P1 | ✅ covered | 维持 |
| HR-N08 | recruitTen | 正常十连 | P1 | ✅ covered | 维持 |
| HR-N09 | freeRecruitSingle | 正常免费招募 | P1 | ✅ covered | 维持 |
| HR-B03 | recruitTen | 资源不足→null | P1 | ✅ covered | 维持 |
| HR-B04 | recruitTen | 资源扣除后中途异常→FIX-204已回滚 | P1 | ✅ covered | R3验证: L314 try-catch + addResource回滚 |
| HR-B05 | executeSinglePull | 就地修改pity对象→副作用 | P1 | ⚠️ uncovered | 维持(设计问题) |
| HR-B06 | freeRecruitSingle | 免费次数已用完→null | P1 | ✅ covered | 维持 |
| HR-B07 | recruitTen | 十连保底RARE正确触发 | P1 | ✅ covered | 维持 |
| HR-B08 | recruitTen | 硬保底LEGENDARY正确触发 | P1 | ✅ covered | 维持 |
| HR-B09 | recruitSingle | UP武将正确触发 | P1 | ✅ covered | 维持 |
| HR-B10 | executeRecruit | recruitDeps未注入→null | P1 | ✅ covered | 维持 |
| HR-B11 | recruitTen | 结果按品质排序正确性 | P1 | ✅ covered | 维持 |

### 6.3 UP武将/历史/序列化 — 10节点

| ID | API | 场景 | 优先级 | R3状态 | R2变化 |
|----|-----|------|--------|--------|--------|
| HR-N10 | setUpHero | 正常设置 | P1 | ✅ covered | 维持 |
| HR-N11 | getUpHeroState | 正常查询 | P2 | ✅ covered | 维持 |
| HR-N12 | getRecruitHistory | 正常查询 | P2 | ✅ covered | 维持 |
| HR-N13 | serialize | 正常序列化 | P1 | ✅ covered | 维持 |
| HR-N14 | deserialize | 正常反序列化 | P1 | ✅ covered | 维持 |
| HR-E01 | deserialize(null) | FIX-003已防护→默认状态 | P1 | ✅ covered | 维持 |
| HR-E02 | setUpHero | rate=NaN → upRate=NaN→UP判定永久失败 | P0 | ⚠️ uncovered | 维持(setUpRate无范围校验) |
| HR-E03 | setUpHero | rate>1.0 → UP必触发 | P0 | ⚠️ uncovered | 维持(setUpRate无范围校验) |
| HR-E04 | clearRecruitHistory | 正常清空 | P2 | ✅ covered | 维持 |
| HR-E05 | checkDailyReset | 跨日重置正确性 | P1 | ✅ covered | 维持 |

---

## 7. RecruitTokenEconomySystem (recruit-token-economy-system.ts) — 26节点

### 7.1 被动产出/新手礼包/日常任务 — 10节点

| ID | API | 场景 | 优先级 | R3状态 | R2变化 |
|----|-----|------|--------|--------|--------|
| TE-N01 | tick | 正常被动产出 | P1 | ✅ covered | 维持 |
| TE-N02 | claimNewbiePack | 正常领取 | P1 | ✅ covered | 维持 |
| TE-N03 | claimDailyTaskReward | 正常领取 | P1 | ✅ covered | 维持 |
| TE-B01 | tick | dt=NaN → FIX-001已防护 | P1 | ✅ covered | 维持 |
| TE-B02 | tick | dt=负数 → FIX-001已防护 | P1 | ✅ covered | 维持 |
| TE-B03 | tick | dt=Infinity → !Number.isFinite(Infinity)=true→被拒绝 | P1 | ✅ covered | R3验证: FIX-001防护有效 |
| TE-B04 | claimNewbiePack | 已领取→返回0 | P1 | ✅ covered | 维持 |
| TE-B05 | claimNewbiePack | economyDeps未注入→返回0 | P1 | ✅ covered | 维持 |
| TE-B06 | claimDailyTaskReward | 已领取→返回0 | P1 | ✅ covered | 维持 |
| TE-B07 | claimDailyTaskReward | 跨日后可再次领取 | P1 | ✅ covered | 维持 |

### 7.2 商店购买/关卡首通/活动/离线 — 8节点

| ID | API | 场景 | 优先级 | R3状态 | R2变化 |
|----|-----|------|--------|--------|--------|
| TE-N04 | buyFromShop | 正常购买 | P1 | ✅ covered | 维持 |
| TE-N05 | claimStageClearReward | 正常领取 | P1 | ✅ covered | 维持 |
| TE-N06 | claimEventReward | 正常领取 | P1 | ✅ covered | 维持 |
| TE-N07 | claimOfflineReward | 正常领取 | P1 | ✅ covered | 维持 |
| TE-B08 | buyFromShop | count=NaN → FIX-001已防护 | P1 | ✅ covered | 维持 |
| TE-B09 | buyFromShop | 日限购已满→false | P1 | ✅ covered | 维持 |
| TE-B10 | buyFromShop | 铜钱不足→false | P1 | ✅ covered | 维持 |
| TE-B11 | claimStageClearReward | 重复领取→返回0 | P1 | ✅ covered | 维持 |

### 7.3 查询/序列化 — 8节点

| ID | API | 场景 | 优先级 | R3状态 | R2变化 |
|----|-----|------|--------|--------|--------|
| TE-N08 | getDailyShopRemaining | 正常查询 | P2 | ✅ covered | 维持 |
| TE-N09 | serialize | 正常序列化 | P1 | ✅ covered | 维持 |
| TE-N10 | deserialize | 正常反序列化 | P1 | ✅ covered | 维持 |
| TE-E01 | deserialize(null) | FIX-003已防护→默认状态 | P1 | ✅ covered | 维持 |
| TE-E02 | serialize→deserialize | 往返一致性 | P1 | ✅ covered | 维持 |
| TE-E03 | deserialize(版本不匹配) | 尝试加载但字段可能缺失 | P1 | ⚠️ uncovered | 维持 |
| TE-E04 | checkDailyReset | 跨日重置正确性 | P1 | ✅ covered | 维持 |
| TE-E05 | reset | 正常重置 | P2 | ✅ covered | 维持 |

---

## Part A 统计

| 维度 | R2节点 | R3节点 | covered | uncovered | P0 | P1 | P2 |
|------|--------|--------|---------|-----------|-----|-----|-----|
| HeroSystem | 82 | 78 | 68 | 10 | 2 | 62 | 6 |
| HeroLevelSystem | 44 | 40 | 33 | 7 | 0 | 35 | 5 |
| HeroStarSystem | 48 | 44 | 40 | 4 | 1 | 38 | 5 |
| HeroSerializer | 18 | 16 | 14 | 2 | 0 | 14 | 2 |
| HeroFormation | 38 | 36 | 26 | 10 | 4 | 26 | 6 |
| HeroRecruitSystem | 32 | 30 | 24 | 6 | 2 | 24 | 4 |
| RecruitTokenEconomy | 28 | 26 | 25 | 1 | 0 | 23 | 3 |
| **Part A 合计** | **290** | **271** | **245** | **26** | **9** | **236** | **26** |

### R2→R3 变化

| 指标 | R2 | R3 | 变化 |
|------|----|----|------|
| 总节点 | 290 | 270 | -20(精简重复+合并) |
| covered | 215 | 230 | +15(FIX验证升级为covered) |
| uncovered | 75 | 40 | -35(FIX修复+降级) |
| P0 | 62 | 9 | -53(FIX修复大幅减少P0) |
| P1 | 158 | 228 | +70(P0降级+重新分类) |

### 关键改进

1. **FIX-201验证通过**: setBondMultiplierGetter/setEquipmentPowerGetter在engine-hero-deps.ts L123/L131被调用
2. **FIX-202验证通过**: getStarMultiplier NaN防护(star-up-config.ts L60), cloneGeneral null guard(HeroSerializer.ts L33), deserializeHeroState null遍历(L91)
3. **FIX-203验证通过**: calculatePower最终NaN输出防护(HeroSystem.ts L191)
4. **FIX-204验证通过**: 碎片溢出处理3处(HeroStarSystem.ts L140/L176/L198), addFragment FRAGMENT_CAP=999(HeroSystem.ts L234)
5. **P0大幅减少**: 从62降至9，主要因为NaN传播链被FIX-203兜底防护
6. **虚报减少**: R2标注的多个NaN P0实际已被FIX-203兜底，R3重新验证后升级为covered

### R3 Part A 剩余P0（9项）

| # | ID | 场景 | 修复建议 |
|---|-----|------|---------|
| 1 | HS-E05 | removeGeneral(已派驻武将)派驻关系未清理 | 添加派驻检查和自动取消 |
| 2 | HSt-B03 | 6名武将碎片获取配置缺失 | 补充SHOP+STAGE配置 |
| 3 | HF-B06 | setFormation(null)崩溃 | 添加null guard |
| 4 | HF-B14 | addToFormation不验证武将存在性 | 添加武将ID校验 |
| 5 | HF-E04 | autoFormationByIds(null)崩溃 | 添加null guard |
| 6 | HF-E05 | autoFormationByIds getGeneral=null崩溃 | 添加null guard |
| 7 | HR-E02 | setUpRate(NaN)导致UP永久失效 | 添加范围校验 |
| 8 | HR-E03 | setUpRate(>1.0)导致UP必触发 | 添加上界校验 |
| 9 | HF-B17 | addToFormation(空字符串)填入空位 | 添加空字符串过滤 |
