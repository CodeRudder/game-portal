# 装备模块对抗式测试报告

## 测试范围

装备模块（Equipment）全系统对抗式测试，覆盖 11 个源文件的公开 API。

## 源文件清单

| 文件 | 职责 |
|------|------|
| `EquipmentSystem.ts` | 装备管理聚合根：生成、穿戴/卸下、属性计算、分解、图鉴、序列化 |
| `EquipmentBagManager.ts` | 背包 CRUD、排序、筛选、分组、扩容 |
| `EquipmentEnhanceSystem.ts` | 强化系统：成功率/降级/保护符/自动强化/转移/一键强化 |
| `EquipmentForgeSystem.ts` | 炼制系统：基础/高级/定向炼制 |
| `EquipmentSetSystem.ts` | 套装系统：7 套套装效果计算 |
| `EquipmentRecommendSystem.ts` | 推荐系统：一键推荐最优装备 |
| `EquipmentDecomposer.ts` | 分解与图鉴管理器 |
| `ForgePityManager.ts` | 炼制保底计数器管理 |
| `EquipmentGenHelper.ts` | 装备生成辅助纯函数 |
| `EquipmentGenerator.ts` | 装备生成器（reexport） |
| `equipment-reexports.ts` | 向后兼容重导出 |

## 公开 API 清单

### EquipmentSystem（聚合根）
- `generateEquipment(slotOrTemplateId, rarity, source?, seed?)` — 生成装备
- `generateCampaignDrop(campaignType, seed?)` — 关卡掉落
- `generateFromSource(source, seed?)` — 按来源生成
- `calculateMainStatValue(eq)` — 计算主属性
- `calculateSubStatValue(subStat, rarity, enhanceLevel)` — 计算副属性
- `recalcStats(eq)` / `recalculateStats(eq)` — 重算属性
- `calculatePower(eq)` — 计算战力
- `getEnhanceCap(rarity)` — 品质强化上限
- `canEnhanceTo(rarity, level)` — 能否强化到指定等级
- `compareRarity(a, b)` — 品质比较
- `addToBag(equipment)` — 添加到背包
- `removeEquipment(uid)` / `removeFromBag(uid)` — 移除
- `getEquipment(uid)` — 获取单件
- `updateEquipment(eq)` — 更新
- `getAllEquipments()` — 获取全部
- `getBagUsedCount()` / `getBagSize()` / `getBagCapacity()` — 背包查询
- `isBagFull()` — 背包满检查
- `expandBag()` — 扩容
- `sortEquipments(mode)` / `getSortedEquipments(mode)` — 排序
- `filterEquipments(filter)` / `getFilteredEquipments(filter)` — 筛选
- `groupBySlot()` — 按部位分组
- `equipItem(heroId, equipmentUid)` — 穿戴
- `unequipItem(heroId, slot)` — 卸下
- `markEquipped(uid, heroId)` / `markUnequipped(uid)` — 标记穿戴
- `getHeroEquips(heroId)` — 获取武将装备栏
- `getHeroEquipItems(heroId)` — 获取武将装备实例
- `getHeroEquipments(heroId)` — 获取已穿戴装备列表
- `decompose(uidOrUids)` — 分解
- `batchDecompose(uids)` — 批量分解
- `decomposeAllUnequipped()` — 分解所有未穿戴
- `calculateDecomposeReward(eq)` — 计算分解奖励
- `getDecomposePreview(uid)` — 分解预览
- `isCodexDiscovered(templateId)` — 图鉴发现检查
- `getCodexEntry(templateId)` — 获取图鉴条目
- `serialize()` / `deserialize(data)` — 序列化
- `reset()` — 重置

### EquipmentEnhanceSystem
- `enhance(uid, useProtection?)` — 单次强化
- `autoEnhance(uid, config)` — 自动强化
- `transferEnhance(sourceUid, targetUid)` — 强化转移
- `batchEnhance(uids, useProtection?)` — 一键强化
- `getSuccessRate(level)` — 成功率查询
- `getCopperCost(level)` / `getStoneCost(level)` — 费用查询
- `getProtectionCost(level)` — 保护符消耗
- `addProtection(count)` / `getProtectionCount()` — 保护符管理
- `setResourceDeductor(fn)` — 注入资源扣除回调
- `serialize()` / `deserialize(data)` / `reset()` — 存档

### EquipmentForgeSystem
- `basicForge(inputUids?, rng?)` — 基础炼制
- `advancedForge(inputUids?, rng?)` — 高级炼制
- `targetedForge(...)` — 定向炼制
- `getPityState()` — 保底状态
- `getTotalForgeCount()` — 炼制计数
- `getForgeCostPreview(type)` / `getForgeCost(type)` — 费用预览
- `serialize()` / `deserialize(data)` / `reset()` — 存档

### EquipmentSetSystem
- `getAllSetDefs()` / `getSetDef(setId)` / `getAllSetIds()` — 套装定义
- `getSetCounts(heroId)` — 套装件数统计
- `getActiveSetBonuses(heroId)` — 激活效果
- `getTotalSetBonuses(heroId)` — 总套装加成
- `getClosestSetBonus(heroId)` — 最接近激活的套装
- `getSetCompletionEquipments(heroId)` — 可凑套装装备

### EquipmentRecommendSystem
- `evaluateEquipment(equipment, heroId)` — 单件评分
- `recommendForHero(heroId)` — 一键推荐

### ForgePityManager
- `getState()` / `restore(state)` / `reset()` — 状态管理
- `shouldTrigger(type)` — 保底触发检查
- `getPityRarity(type)` — 保底品质
- `update(type, outputRarity)` — 更新保底
- `getThreshold(type)` / `getProgress(type)` — 进度查询

## 5 维度测试分支枚举

### F-Normal（正向流程）— 25 个测试用例

| ID | 流程 | API 调用链 |
|----|------|-----------|
| N01 | 按部位生成4种装备 | generateEquipment × 4 slots |
| N02 | 按模板生成装备 | generateEquipment(templateId, rarity) |
| N03 | 不存在的模板返回null | generateEquipment('nonexistent', 'white') |
| N04 | 自动加入背包 | generateEquipment → getEquipment |
| N05 | 5种品质全部生成 | generateEquipment × 5 rarities |
| N06 | 关卡掉落生成 | generateCampaignDrop |
| N07 | 按来源生成 | generateFromSource × 4 sources |
| N08 | 穿戴装备 | equipItem → getEquipment |
| N09 | 卸下装备 | equipItem → unequipItem |
| N10 | 四部位全部穿戴 | equipItem × 4 → getHeroEquips |
| N11 | 同部位替换 | equipItem × 2 same slot → replacedUid |
| N12 | 获取装备项 | getHeroEquipItems |
| N13 | 获取已穿戴列表 | getHeroEquipments |
| N14 | 强化返回有效结果 | enhance → outcome检查 |
| N15 | 强化成功等级+1 | enhance level 0→1 (100%) |
| N16 | 连续强化低等级 | enhance × 3 (100% success) |
| N17 | 自动强化到目标 | autoEnhance(targetLevel=5) |
| N18 | 一键强化多件 | batchEnhance × 2 |
| N19 | 单件分解 | decompose → reward |
| N20 | 批量分解 | batchDecompose × 3 |
| N21 | 分解所有未穿戴 | decomposeAllUnequipped |
| N22 | 分解预览 | getDecomposePreview |
| N23 | 高品质多奖励 | compare gold vs white reward |
| N24 | 空背包排序 | sortEquipments(空) |
| N25 | 空背包筛选 | filterEquipments(空) |

### F-Boundary（边界条件）— 22 个测试用例

| ID | 边界 | 预期行为 |
|----|------|---------|
| B01 | 默认背包容量 | = DEFAULT_BAG_CAPACITY(50) |
| B02 | 背包满时添加 | 返回 {success: false, reason: '背包已满'} |
| B03 | 扩容增加容量 | expandBag → capacity增大 |
| B04 | 容量不超过上限 | ≤ MAX_BAG_CAPACITY(500) |
| B05 | 最大容量后扩容失败 | {success: false, reason: '已达最大容量'} |
| B06 | 重复uid幂等 | addToBag(同uid) → success, count不变 |
| B07 | 白色强化上限=5 | enhance × 30 → level ≤ 5 |
| B08 | 绿色强化上限=8 | enhance × 30 → level ≤ 8 |
| B09 | 金色强化上限=15 | enhance × 50 → level ≤ 15 |
| B10 | 达上限后强化失败 | outcome=fail, level不变 |
| B11 | canEnhanceTo 边界 | white/5=true, white/6=false |
| B12 | getEnhanceCap 正确值 | white=5,green=8,blue=10,purple=12,gold=15 |
| B13 | 空背包getAll | [] |
| B14 | 空背包getCount | 0 |
| B15 | 空背包isFull | false |
| B16 | 空背包remove | false |
| B17 | 空背包get | undefined |
| B18 | 空背包sort | [] |
| B19 | 空背包filter | [] |
| B20 | 空背包groupBySlot | 全空分组 |
| B21 | 空背包decomposeAll | 空结果 |
| B22 | 所有排序模式 | 6种mode均正常 |

### F-Error（错误注入）— 30 个测试用例

| ID | 异常 | 预期行为 |
|----|------|---------|
| E01 | 不存在uid getEquipment | undefined |
| E02 | 不存在uid remove | false |
| E03 | 不存在uid removeFromBag | {success:false, reason:'装备不存在'} |
| E04 | 不存在uid equipItem | {success:false, reason:'装备不存在'} |
| E05 | 无装备栏unequip | {success:false, reason:'武将无装备栏'} |
| E06 | 不存在uid markEquipped | {success:false} |
| E07 | 不存在uid markUnequipped | {success:false} |
| E08 | 不存在uid enhance | outcome=fail, level=0 |
| E09 | 不存在uid decompose | {success:false} |
| E10 | 不存在uid getDecomposePreview | null |
| E11 | 不存在uid transferEnhance | {success:false} |
| E12 | 不存在uid autoEnhance | steps=[], finalLevel=0 |
| E13 | 重复穿戴同一武将 | 幂等成功 |
| E14 | 穿戴到其他武将 | {success:false, reason:'装备已被其他武将穿戴'} |
| E15 | markEquipped已穿戴 | {success:false, reason:'装备已被穿戴'} |
| E16 | markUnequipped未穿戴 | {success:false, reason:'装备未被穿戴'} |
| E17 | 卸下空部位 | {success:false, reason:'该部位无装备'} |
| E18 | 已穿戴不可移除 | {success:false, reason:'已穿戴装备不可移除'} |
| E19 | 已穿戴不可分解 | {success:false} |
| E20 | 资源不足强化 | outcome=fail, level不变 |
| E21 | 未设资源扣除器 | 正常执行(不扣资源) |
| E22 | autoEnhance资源耗尽 | 提前停止 |
| E23 | 炼制不足3件 | {success:false} |
| E24 | 炼制品质不一致 | {success:false} |
| E25 | 炼制金色装备 | {success:false} |
| E26 | 炼制已穿戴装备 | {success:false} |
| E27 | 炼制不存在uid | {success:false} |
| E28 | 高级炼制不足5件 | {success:false} |
| E29 | 定向炼制空背包 | {success:false} |
| E30 | 转移源+0等级 | {success:false} |

### F-Cross（跨系统交互）— 25 个测试用例

| ID | 交互链 | 验证点 |
|----|--------|--------|
| C01 | 属性计算精确性 | mainStat = base × rarityMul × (1 + level × factor) |
| C02 | 副属性计算精确性 | subStat = base × rarityMul × (1 + level × factor) |
| C03 | recalcStats 同时更新 | 主+副属性均更新 |
| C04 | calculatePower 完整公式 | main + sub + special×5 + rarity×10 |
| C05 | 品质→战力排序 | gold > white |
| C06 | 强化→战力增加 | enhance后 power增大 |
| C07 | 穿戴4件完整性 | getHeroEquipItems 全部非null |
| C08 | 替换后旧装备属性保留 | enhanceLevel不变 |
| C09 | 卸下后装备栏清空 | weapon=null |
| C10 | 套装空状态 | getSetCounts → 空 |
| C11 | 套装定义数量 | 7套 |
| C12 | 套装ID列表 | 包含warrior/overlord/dragon |
| C13 | 2件套激活 | getActiveSetBonuses |
| C14 | 总套装加成 | getTotalSetBonuses |
| C15 | 无装备最接近套装 | null |
| C16 | 无装备凑套装 | [] |
| C17 | 保底初始状态 | 全0 |
| C18 | 炼制初始计数 | 0 |
| C19 | 炼制费用预览 | basic: 500/1/3 |
| C20 | 炼制费用比较 | advanced > basic |
| C21 | ForgePityManager独立 | 10次触发保底 |
| C22 | 保底重置 | 出紫后计数归0 |
| C23 | 保底序列化 | serialize/restore一致 |
| C24 | 图鉴自动更新 | 获取后自动发现 |
| C25 | 图鉴多次获取 | obtainCount递增 |

### F-State（状态转换）— 15 个测试用例

| ID | 状态链 | 验证点 |
|----|--------|--------|
| S01 | 生成→穿戴→强化→卸下→分解 | 完整生命周期 |
| S02 | 穿戴→卸下→重新穿戴 | 状态回退 |
| S03 | 分解后不可再操作 | 全部返回失败 |
| S04 | 多武将装备独立 | hero1≠hero2 |
| S05 | 序列化→反序列化→继续操作 | 状态恢复后可操作 |
| S06 | 强化→降级→强化 | 等级正确变化 |
| S07 | 强化→转移→强化 | 转移后可继续强化 |
| S08 | 一键强化互不影响 | 3件独立 |
| S09 | 连续炼制保底累计 | pityCount递增 |
| S10 | 炼制序列化保底保持 | serialize/deserialize一致 |
| S11 | 强化等级上限验证 | white≤5, gold≤15 |
| S12 | 分解奖励含强化加成 | copper = base × (1 + level × 0.1) |
| S13 | 图鉴bestRarity更新 | 高品质覆盖低品质 |
| S14 | 保护符序列化保持 | serialize/deserialize一致 |
| S15 | 系统reset清空所有 | bag=0, heroEquips=null |

## 测试统计

| 维度 | 用例数 | 文件 |
|------|--------|------|
| F-Normal | 25 | equipment-adversarial-p1.test.ts |
| F-Boundary | 22 | equipment-adversarial-p1.test.ts |
| F-Error | 30 | equipment-adversarial-p2.test.ts |
| F-Cross | 25 | equipment-adversarial-p3.test.ts |
| F-State | 15 | equipment-adversarial-p3.test.ts |
| **合计** | **117** | 3 个文件 |

## 运行命令

```bash
pnpm test:tk -- src/games/three-kingdoms/engine/equipment/__tests__/equipment-adversarial
```
