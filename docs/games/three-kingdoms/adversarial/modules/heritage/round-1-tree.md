# Heritage 流程分支树 Round 1

> Builder: TreeBuilder v1.8 | Time: 2026-05-01
> 模块: heritage | 文件: 4 | 源码: 713行 | API: ~22

## 统计

| 子系统 | 节点数 | API数 | covered | uncovered | todo | P0 | P1 |
|--------|--------|-------|---------|-----------|------|----|----|
| HeritageSystem | 98 | 14 | 52 | 46 | 0 | 16 | 30 |
| HeritageSimulation | 42 | 7 | 22 | 20 | 0 | 8 | 12 |
| HeritageHelpers | 6 | 2 | 4 | 2 | 0 | 0 | 2 |
| heritage-config | 12 | 8 | 12 | 0 | 0 | 0 | 0 |
| heritage.types | 6 | 0 | 6 | 0 | 0 | 0 | 0 |
| **总计** | **164** | **31** | **96** | **68** | **0** | **24** | **44** |

## 子系统覆盖

| 子系统 | 文件 | 行数 | API数 | 节点数 | covered | uncovered | 覆盖率 |
|--------|------|------|-------|--------|---------|-----------|--------|
| HeritageSystem | HeritageSystem.ts | 421 | 14 | 98 | 52 | 46 | 53.1% |
| HeritageSimulation | HeritageSimulation.ts | 249 | 7 | 42 | 22 | 20 | 52.4% |
| HeritageHelpers | HeritageHelpers.ts | 36 | 2 | 6 | 4 | 2 | 66.7% |
| heritage-config | heritage-config.ts | 155 | 8 | 12 | 12 | 0 | 100% |
| heritage.types | heritage.types.ts | 208 | 0 | 6 | 6 | 0 | 100% |
| index.ts | index.ts | 7 | 0 | 0 | 0 | 0 | — |

## 跨系统链路覆盖

| 链路域 | 链路数 | covered | uncovered |
|--------|--------|---------|-----------|
| Heritage↔Hero（武将传承查询/更新） | 4 | 2 | 2 |
| Heritage↔Equipment（装备传承查询/更新） | 3 | 1 | 2 |
| Heritage↔Resource（铜钱消耗） | 3 | 2 | 1 |
| Heritage↔Prestige（转生倍率依赖） | 1 | 0 | 1 |
| Heritage↔Save（序列化/反序列化） | 3 | 1 | 2 |
| Heritage↔Calendar（每日重置事件） | 1 | 1 | 0 |
| **总计** | **15** | **7** | **8** |

---

## 1. HeritageSystem（HeritageSystem.ts — 421行）

### 1.1 生命周期 & ISubsystem

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| HS-001 | `constructor()` | 初始 state = createInitialHeritageState() | P1 | ✅ covered | 源码隐含 |
| HS-002 | `init(deps)` | 注入 deps，注册 calendar:dayChanged 监听 | P1 | ⚠️ uncovered | 无init测试 |
| HS-003 | `update(dt)` | 空操作（传承不依赖帧更新） | P1 | ✅ covered | 源码:无操作 |
| HS-004 | `getState()` | 返回 state 深拷贝 | P1 | ⚠️ uncovered | 无getState测试 |
| HS-005 | `getAccelerationState()` | 返回 accelState 深拷贝 | P1 | ⚠️ uncovered | 无测试 |
| HS-006 | `reset()` | 重置 state 和 accelState | P1 | ⚠️ uncovered | 无reset测试 |

### 1.2 回调配置 — `setCallbacks()`

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| HS-010 | `setCallbacks(callbacks)` | 注入8个外部回调 | P1 | ⚠️ uncovered | 无setCallbacks测试 |
| HS-011 | `setCallbacks(callbacks)` | callbacks.getHero = undefined → heroCallback = undefined | P0 | ⚠️ uncovered | 规则6:注入点验证 |
| HS-012 | `setCallbacks(callbacks)` | callbacks.addResources = undefined → addResourcesCallback = undefined | P1 | ⚠️ uncovered | 注入点验证 |

### 1.3 武将传承 — `executeHeroHeritage()`

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| HS-020 | `executeHeroHeritage(req)` | 正常流程：源→目标传承成功 | P1 | ⚠️ uncovered | 无正常流程测试 |
| HS-021 | `executeHeroHeritage(req)` | dailyHeritageCount >= DAILY_HERITAGE_LIMIT → 失败 | P0 | ⚠️ uncovered | 每日限制 |
| HS-022 | `executeHeroHeritage(req)` | source = null → 失败"源武将不存在" | P0 | ⚠️ uncovered | null防护 |
| HS-023 | `executeHeroHeritage(req)` | target = null → 失败"目标武将不存在" | P0 | ⚠️ uncovered | null防护 |
| HS-024 | `executeHeroHeritage(req)` | source.id === target.id → 失败"不能自我传承" | P1 | ⚠️ uncovered | 自引用检查 |
| HS-025 | `executeHeroHeritage(req)` | source.quality < minSourceQuality → 失败 | P1 | ⚠️ uncovered | 品质检查 |
| HS-026 | `executeHeroHeritage(req)` | target.quality < minTargetQuality → 失败 | P1 | ⚠️ uncovered | 品质检查 |
| HS-027 | `executeHeroHeritage(req)` | **NaN防护**: source.exp=NaN → transferredExp=NaN, newTargetExp=NaN | 🔴 P0 | ⚠️ uncovered | 规则1/17:战斗数值安全 |
| HS-028 | `executeHeroHeritage(req)` | **NaN防护**: request.options.expEfficiency=NaN → efficiency=NaN | 🔴 P0 | ⚠️ uncovered | NaN传播 |
| HS-029 | `executeHeroHeritage(req)` | source.quality不在QUALITY_EXP_EFFICIENCY → baseEfficiency=0.5 (fallback) | P1 | ✅ covered | 源码: `?? 0.5` |
| HS-030 | `executeHeroHeritage(req)` | 同阵营 → sameFactionBonus +0.1 | P1 | ⚠️ uncovered | 无分支测试 |
| HS-031 | `executeHeroHeritage(req)` | 不同阵营 → diffFactionPenalty -0.1 | P1 | ⚠️ uncovered | 无分支测试 |
| HS-032 | `executeHeroHeritage(req)` | efficiency < 0 → Math.max(0,...) → 0 | P1 | ⚠️ uncovered | 边界值 |
| HS-033 | `executeHeroHeritage(req)` | transferSkillLevels=true → 目标获得源技能等级 | P1 | ⚠️ uncovered | 选项分支 |
| HS-034 | `executeHeroHeritage(req)` | transferFavorability=true → 目标获得源好感度 | P1 | ⚠️ uncovered | 选项分支 |
| HS-035 | `executeHeroHeritage(req)` | sourceAfterState='reset' → 源武将 level=1, exp=0 | P0 | ⚠️ uncovered | 状态变更验证 |
| HS-036 | `executeHeroHeritage(req)` | **copperCost**: source.level=NaN → copperCost=NaN → addResources({copper:NaN}) | 🔴 P0 | ⚠️ uncovered | 规则17:战斗数值安全 |

### 1.4 装备传承 — `executeEquipmentHeritage()`

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| HS-040 | `executeEquipmentHeritage(req)` | 正常流程：装备传承成功 | P1 | ⚠️ uncovered | 无正常流程测试 |
| HS-041 | `executeEquipmentHeritage(req)` | dailyHeritageCount >= LIMIT → 失败 | P0 | ⚠️ uncovered | 每日限制 |
| HS-042 | `executeEquipmentHeritage(req)` | source = null → 失败"源装备不存在" | P0 | ⚠️ uncovered | null防护 |
| HS-043 | `executeEquipmentHeritage(req)` | target = null → 失败"目标装备不存在" | P0 | ⚠️ uncovered | null防护 |
| HS-044 | `executeEquipmentHeritage(req)` | source.uid === target.uid → 失败"不能自我传承" | P1 | ⚠️ uncovered | 自引用检查 |
| HS-045 | `executeEquipmentHeritage(req)` | mustSameSlot=true & slot不同 → 失败 | P1 | ⚠️ uncovered | 部位检查 |
| HS-046 | `executeEquipmentHeritage(req)` | transferEnhanceLevel=false → rawLevel=0 | P1 | ⚠️ uncovered | 选项分支 |
| HS-047 | `executeEquipmentHeritage(req)` | **NaN防护**: source.enhanceLevel=NaN → rawLevel=NaN → transferredLevel=NaN | 🔴 P0 | ⚠️ uncovered | 规则1/17 |
| HS-048 | `executeEquipmentHeritage(req)` | rarityDiff计算：同品质/高1/高2/低1/低2 | P1 | ⚠️ uncovered | 无分支测试 |
| HS-049 | `executeEquipmentHeritage(req)` | **NaN防护**: copperCost=NaN (rawLevel=NaN) → addResources({copper:NaN}) | 🔴 P0 | ⚠️ uncovered | 规则17 |
| HS-050 | `executeEquipmentHeritage(req)` | sourceAfterState='consumed' → removeEquipCallback调用 | P0 | ⚠️ uncovered | 状态变更验证 |

### 1.5 经验传承 — `executeExperienceHeritage()`

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| HS-060 | `executeExperienceHeritage(req)` | 正常流程：经验传承成功 | P1 | ⚠️ uncovered | 无正常流程测试 |
| HS-061 | `executeExperienceHeritage(req)` | dailyHeritageCount >= LIMIT → 失败 | P0 | ⚠️ uncovered | 每日限制 |
| HS-062 | `executeExperienceHeritage(req)` | source = null → 失败 | P0 | ⚠️ uncovered | null防护 |
| HS-063 | `executeExperienceHeritage(req)` | target = null → 失败 | P0 | ⚠️ uncovered | null防护 |
| HS-064 | `executeExperienceHeritage(req)` | source.id === target.id → 失败 | P1 | ⚠️ uncovered | 自引用检查 |
| HS-065 | `executeExperienceHeritage(req)` | source.level < minSourceLevel → 失败 | P1 | ⚠️ uncovered | 等级检查 |
| HS-066 | `executeExperienceHeritage(req)` | expRatio > maxExpRatio → 被裁剪到 maxExpRatio | P1 | ⚠️ uncovered | 边界裁剪 |
| HS-067 | `executeExperienceHeritage(req)` | **NaN防护**: source.exp=NaN → rawExp=NaN → transferredExp=NaN | 🔴 P0 | ⚠️ uncovered | 规则1/17 |
| HS-068 | `executeExperienceHeritage(req)` | **NaN防护**: request.expRatio=NaN → rawExp=NaN | 🔴 P0 | ⚠️ uncovered | NaN传播 |
| HS-069 | `executeExperienceHeritage(req)` | newSourceExp可能为负数（rawExp > source.exp时） | P1 | ⚠️ uncovered | 欠验证 |
| HS-070 | `executeExperienceHeritage(req)` | copperCost = NaN (source.level=NaN) | 🔴 P0 | ⚠️ uncovered | 规则17 |

### 1.6 转生后加速 API

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| HS-080 | `claimInitialGift()` | 正常领取成功 | P1 | ⚠️ uncovered | 无测试 |
| HS-081 | `claimInitialGift()` | initialGiftClaimed=true → 失败"已领取过" | P1 | ⚠️ uncovered | 重复领取 |
| HS-082 | `executeRebuild(config?)` | 正常一键重建 | P1 | ⚠️ uncovered | 无测试 |
| HS-083 | `executeRebuild(config?)` | rebuildCompleted=true → 失败"已执行过" | P1 | ⚠️ uncovered | 重复执行 |
| HS-084 | `instantUpgrade(buildingId)` | 正常瞬间升级 | P1 | ⚠️ uncovered | 无测试 |
| HS-085 | `instantUpgrade(buildingId)` | 次数用完 → 失败 | P0 | ⚠️ uncovered | 次数限制 |
| HS-086 | `instantUpgrade(buildingId)` | 建筑已升级过 → 失败 | P1 | ⚠️ uncovered | 去重检查 |
| HS-087 | `instantUpgrade(buildingId)` | upgradeBuilding回调返回false → 失败 | P1 | ⚠️ uncovered | 回调失败 |
| HS-088 | `initRebirthAcceleration()` | 重置accelState | P1 | ⚠️ uncovered | 无测试 |

### 1.7 转生次数解锁 API

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| HS-090 | `getRebirthUnlocks()` | 正常返回解锁列表 | P1 | ⚠️ uncovered | 无测试 |
| HS-091 | `getRebirthUnlocks()` | rebirthCountCallback=undefined → currentCount=0 → 全部locked | P1 | ⚠️ uncovered | 回调null |
| HS-092 | `isUnlocked(unlockId)` | 已解锁 → true | P1 | ⚠️ uncovered | 无测试 |
| HS-093 | `isUnlocked(unlockId)` | 未解锁 → false | P1 | ⚠️ uncovered | 无测试 |
| HS-094 | `isUnlocked(unlockId)` | unlockId不存在 → false | P1 | ⚠️ uncovered | 无效ID |

### 1.8 收益模拟器 API

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| HS-100 | `simulateEarnings(params)` | 正常模拟 | P1 | ⚠️ uncovered | 无测试 |
| HS-101 | `simulateEarnings(params)` | **NaN防护**: dailyOnlineHours=NaN → earnings全NaN | 🔴 P0 | ⚠️ uncovered | 规则1 |
| HS-102 | `simulateEarnings(params)` | waitHours=0 → waitEarnings=immediateEarnings | P1 | ⚠️ uncovered | 边界值 |
| HS-103 | `simulateEarnings(params)` | waitHours > 30*24 → remainingDays=0 → waitEarnings全0 | P1 | ⚠️ uncovered | 边界值 |

### 1.9 存档 & 内部方法

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| HS-110 | `loadSaveData(data)` | 正常加载 | P1 | ⚠️ uncovered | 无测试 |
| HS-111 | `loadSaveData(data)` | **null防护**: data=null → 解构崩溃 | 🔴 P0 | ⚠️ uncovered | 规则10 |
| HS-112 | `loadSaveData(data)` | data.accelState=undefined → 不覆盖accelState | P1 | ⚠️ uncovered | 可选字段 |
| HS-113 | `loadSaveData(data)` | data.state含NaN值 → NaN注入state | 🔴 P0 | ⚠️ uncovered | 规则10 |
| HS-114 | `getSaveData()` | 正常序列化 | P1 | ⚠️ uncovered | 无测试 |
| HS-115 | `getSaveData()` | state含NaN → 序列化含NaN | 🔴 P0 | ⚠️ uncovered | 规则19 |
| HS-116 | `getMemorialRecord()` | 正常返回纪念记录 | P1 | ⚠️ uncovered | 无测试 |
| HS-117 | `recordHeritage()` | 事件emit heritage:completed | P1 | ⚠️ uncovered | 事件验证 |
| HS-118 | `checkDailyReset()` | 跨日重置dailyHeritageCount=0 | P1 | ⚠️ uncovered | 日期变更 |
| HS-119 | `resetDailyCount()` | calendar:dayChanged触发重置 | P1 | ⚠️ uncovered | 事件监听 |

---

## 2. HeritageSimulation（HeritageSimulation.ts — 249行）

### 2.1 claimInitialGift

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| SIM-001 | `claimInitialGift()` | initialGiftClaimed=false → 成功，resources含grain/copper/enhanceStone | P1 | ⚠️ uncovered | 无测试 |
| SIM-002 | `claimInitialGift()` | initialGiftClaimed=true → 失败 | P1 | ⚠️ uncovered | 无测试 |
| SIM-003 | `claimInitialGift()` | addResources回调=undefined → 不抛异常 | P1 | ⚠️ uncovered | 规则6 |
| SIM-004 | `claimInitialGift()` | 事件emit heritage:initialGiftClaimed | P1 | ⚠️ uncovered | 事件验证 |

### 2.2 executeRebuild

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| SIM-010 | `executeRebuild()` | rebuildCompleted=false → 按优先级升级 | P1 | ⚠️ uncovered | 无测试 |
| SIM-011 | `executeRebuild()` | rebuildCompleted=true → 失败 | P1 | ⚠️ uncovered | 无测试 |
| SIM-012 | `executeRebuild()` | upgradeBuilding回调返回false → 跳过该建筑 | P1 | ⚠️ uncovered | 回调失败 |
| SIM-013 | `executeRebuild()` | config覆盖DEFAULT_REBUILD_CONFIG | P1 | ⚠️ uncovered | 配置合并 |
| SIM-014 | `executeRebuild()` | 事件emit heritage:rebuildCompleted | P1 | ⚠️ uncovered | 事件验证 |
| SIM-015 | `executeRebuild()` | **部分失败**: buildingPriority中部分升级成功部分失败 → upgradedBuildings只含成功的 | P1 | ⚠️ uncovered | 部分成功处理 |

### 2.3 instantUpgrade

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| SIM-020 | `instantUpgrade()` | 次数未满 & 建筑未升级 → 成功 | P1 | ⚠️ uncovered | 无测试 |
| SIM-021 | `instantUpgrade()` | instantUpgradeCount >= maxInstantUpgrades → 失败 | P0 | ⚠️ uncovered | 次数限制 |
| SIM-022 | `instantUpgrade()` | buildingId已存在instantUpgradedBuildings → 失败 | P1 | ⚠️ uncovered | 去重 |
| SIM-023 | `instantUpgrade()` | upgradeBuilding返回false → 失败 | P1 | ⚠️ uncovered | 回调失败 |
| SIM-024 | `instantUpgrade()` | getRebirthCount=undefined → rebirthCount=0 → maxInstantUpgrades=0 → 必失败 | 🔴 P0 | ⚠️ uncovered | 规则6:注入点 |
| SIM-025 | `instantUpgrade()` | 成功后instantUpgradeCount+1, buildingId加入列表 | P1 | ⚠️ uncovered | 状态更新 |

### 2.4 createInitialAccelState

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| SIM-030 | `createInitialAccelState()` | 返回默认值 | P1 | ✅ covered | 源码直接验证 |

### 2.5 getRebirthUnlocks / isHeritageUnlocked

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| SIM-040 | `getRebirthUnlocks(0)` | 全部unlocked=false | P1 | ⚠️ uncovered | 无测试 |
| SIM-041 | `getRebirthUnlocks(5)` | 全部unlocked=true | P1 | ⚠️ uncovered | 无测试 |
| SIM-042 | `isHeritageUnlocked('mandate_system', 1)` → true | P1 | ⚠️ uncovered | 无测试 |
| SIM-043 | `isHeritageUnlocked('nonexistent', 99)` → false | P1 | ⚠️ uncovered | 无效ID |

### 2.6 simulateEarnings

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| SIM-050 | `simulateEarnings(params)` | 正常参数 → 返回immediateMultiplier/waitMultiplier/earnings | P1 | ⚠️ uncovered | 无测试 |
| SIM-051 | `simulateEarnings(params)` | **NaN防护**: dailyOnlineHours=NaN → earnings全NaN (dailyHours/4=NaN) | 🔴 P0 | ⚠️ uncovered | 规则1 |
| SIM-052 | `simulateEarnings(params)` | waitHours=NaN → waitDays=NaN → remainingDays=NaN → earnings全NaN | 🔴 P0 | ⚠️ uncovered | 规则1 |
| SIM-053 | `simulateEarnings(params)` | currentRebirthCount=NaN → calcRebirthMultiplier(NaN) → 倍率异常 | 🔴 P0 | ⚠️ uncovered | 跨系统NaN传播 |
| SIM-054 | `simulateEarnings(params)` | confidence = min(1, dailyOnlineHours/8) → dailyOnlineHours=16 → 1.0 | P1 | ⚠️ uncovered | 上限裁剪 |
| SIM-055 | `simulateEarnings(params)` | findOptimalWaitTime → marginalGain < base*1.5 → return 0 | P1 | ⚠️ uncovered | 算法正确性 |
| SIM-056 | `simulateEarnings(params)` | findOptimalWaitTime → marginalGain >= base*1.5 → return threshold | P1 | ⚠️ uncovered | 算法正确性 |

---

## 3. HeritageHelpers（HeritageHelpers.ts — 36行）

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| HLP-001 | `createInitialHeritageState()` | 返回默认值，lastDailyReset=今天 | P1 | ✅ covered | 源码直接验证 |
| HLP-002 | `getTodayStr()` | 返回YYYY-MM-DD格式 | P1 | ✅ covered | 源码直接验证 |
| HLP-003 | `createInitialHeritageState()` | heritageHistory=[] | P1 | ✅ covered | 源码 |
| HLP-004 | `getTodayStr()` | 时区依赖：toISOString()返回UTC时间 | P1 | ⚠️ uncovered | 时区一致性 |

---

## 4. heritage-config（heritage-config.ts — 155行）

| # | 配置项 | 检查条件 | 优先级 | 状态 | 来源 |
|---|--------|---------|--------|------|------|
| CFG-001 | QUALITY_EXP_EFFICIENCY | 键1-5全覆盖 | P1 | ✅ covered | 源码验证 |
| CFG-002 | RARITY_DIFF_EFFICIENCY | 5种差异全覆盖 | P1 | ✅ covered | 源码验证 |
| CFG-003 | HERITAGE_REBIRTH_UNLOCKS | 4个解锁等级：1/2/3/5 | P1 | ✅ covered | 源码验证 |
| CFG-004 | DAILY_HERITAGE_LIMIT=10 | 上限常量存在 | P1 | ✅ covered | 规则22 |
| CFG-005 | SIMULATION_BASE_DAILY | gold/grain/prestige全正数 | P1 | ✅ covered | 源码验证 |
| CFG-006 | EXPERIENCE_HERITAGE_RULE.efficiency=0.7 | 0<efficiency<=1 | P1 | ✅ covered | 源码验证 |
| CFG-007 | HERO_HERITAGE_RULE.copperCostFactor=500 | 正数 | P1 | ✅ covered | 源码验证 |
| CFG-008 | EQUIPMENT_HERITAGE_RULE.levelLoss=1 | 非负数 | P1 | ✅ covered | 源码验证 |
| CFG-009 | **配置-枚举同步**: QUALITY_EXP_EFFICIENCY键 vs 品质枚举 | P1 | ⚠️ uncovered | 规则18 |
| CFG-010 | **配置-枚举同步**: RARITY_DIFF_EFFICIENCY键 vs 稀有度枚举 | P1 | ⚠️ uncovered | 规则18 |

---

## NaN防护全景

| API入口 | NaN注入点 | 防护状态 | 影响 |
|---------|----------|---------|------|
| executeHeroHeritage | source.exp | ❌ 无防护 | transferredExp=NaN → 目标exp=NaN |
| executeHeroHeritage | options.expEfficiency | ❌ 无防护 | efficiency计算含NaN |
| executeHeroHeritage | source.level (→copperCost) | ❌ 无防护 | addResources({copper:NaN}) |
| executeEquipmentHeritage | source.enhanceLevel | ❌ 无防护 | rawLevel=NaN → finalLevel=NaN |
| executeEquipmentHeritage | rawLevel (→copperCost) | ❌ 无防护 | addResources({copper:NaN}) |
| executeExperienceHeritage | source.exp | ❌ 无防护 | rawExp=NaN → transferredExp=NaN |
| executeExperienceHeritage | request.expRatio | ❌ 无防护 | ratio=NaN → rawExp=NaN |
| executeExperienceHeritage | source.level (→copperCost) | ❌ 无防护 | copperCost=NaN |
| simulateEarnings | dailyOnlineHours | ❌ 无防护 | earnings全NaN |
| simulateEarnings | waitHours | ❌ 无防护 | remainingDays=NaN |
| simulateEarnings | currentRebirthCount | ❌ 无防护 | calcRebirthMultiplier(NaN) |
| loadSaveData | data.state.* | ❌ 无防护 | NaN注入state |
| getSaveData | state含NaN | ❌ 无防护 | 序列化含NaN |
| loadSaveData | data=null | ❌ 无防护 | 解构崩溃 |
| **受影响API入口总计: 14** | | **0/14有防护** | |
