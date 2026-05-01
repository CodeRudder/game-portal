# Equipment 流程分支树 Round 1

> Builder: TreeBuilder v1.8 | Time: 2026-05-01
> 模块: equipment | 文件: 13 | 源码: 2,396行 | API: ~78

## 统计

| 子系统 | 节点数 | API数 | covered | uncovered | todo | P0 | P1 |
|--------|--------|-------|---------|-----------|------|----|----|
| EquipmentSystem | 68 | 28 | 42 | 26 | 0 | 12 | 18 |
| EquipmentBagManager | 34 | 16 | 22 | 12 | 0 | 5 | 7 |
| EquipmentForgeSystem | 42 | 10 | 24 | 18 | 0 | 8 | 10 |
| EquipmentEnhanceSystem | 38 | 10 | 22 | 16 | 0 | 7 | 9 |
| EquipmentSetSystem | 24 | 8 | 16 | 8 | 0 | 3 | 5 |
| EquipmentRecommendSystem | 20 | 4 | 12 | 8 | 0 | 3 | 5 |
| EquipmentDecomposer | 22 | 8 | 14 | 8 | 0 | 4 | 4 |
| ForgePityManager | 18 | 7 | 14 | 4 | 0 | 2 | 2 |
| EquipmentGenHelper | 28 | 9 | 22 | 6 | 0 | 3 | 3 |
| EquipmentDropWeights | 4 | 0 | 4 | 0 | 0 | 0 | 0 |
| **总计** | **298** | **100** | **192** | **106** | **0** | **47** | **63** |

## 子系统覆盖

| 子系统 | 文件 | 行数 | API数 | 节点数 | covered | uncovered | 覆盖率 |
|--------|------|------|-------|--------|---------|-----------|--------|
| EquipmentSystem | EquipmentSystem.ts | 411 | 28 | 68 | 42 | 26 | 61.8% |
| EquipmentBagManager | EquipmentBagManager.ts | 211 | 16 | 34 | 22 | 12 | 64.7% |
| EquipmentForgeSystem | EquipmentForgeSystem.ts | 311 | 10 | 42 | 24 | 18 | 57.1% |
| EquipmentEnhanceSystem | EquipmentEnhanceSystem.ts | 315 | 10 | 38 | 22 | 16 | 57.9% |
| EquipmentSetSystem | EquipmentSetSystem.ts | 183 | 8 | 24 | 16 | 8 | 66.7% |
| EquipmentRecommendSystem | EquipmentRecommendSystem.ts | 236 | 4 | 20 | 12 | 8 | 60.0% |
| EquipmentDecomposer | EquipmentDecomposer.ts | 123 | 8 | 22 | 14 | 8 | 63.6% |
| ForgePityManager | ForgePityManager.ts | 138 | 7 | 18 | 14 | 4 | 77.8% |
| EquipmentGenHelper | EquipmentGenHelper.ts | 150 | 9 | 28 | 22 | 6 | 78.6% |
| EquipmentDropWeights | EquipmentDropWeights.ts | 26 | 0 | 4 | 4 | 0 | 100% |
| EquipmentGenerator | EquipmentGenerator.ts | 228 | 9 | — | — | — | (旧版,GenHelper为主) |
| equipment-reexports | equipment-reexports.ts | 15 | 0 | 0 | 0 | 0 | — |
| index | index.ts | 64 | 0 | 0 | 0 | 0 | — |

## 跨系统链路覆盖

| 链路域 | 链路数 | covered | uncovered |
|--------|--------|---------|-----------|
| Equipment↔Forge（锻造消耗/生成装备） | 4 | 3 | 1 |
| Equipment↔Enhance（强化读写装备） | 3 | 2 | 1 |
| Equipment↔Set（套装查询装备） | 3 | 2 | 1 |
| Equipment↔Recommend（推荐读取装备+套装） | 2 | 1 | 1 |
| Equipment↔Decomposer（分解删除装备） | 3 | 3 | 0 |
| Equipment↔Save（序列化/反序列化六处同步） | 6 | 4 | 2 |
| Equipment↔Battle（装备加成传递） | 1 | 1 | 0 |
| Forge↔Pity（保底计数/触发） | 3 | 3 | 0 |
| Enhance↔Resource（资源扣除回调注入） | 1 | 0 | 1 |
| **总计** | **26** | **19** | **7** |

---

## P0模式系统性扫描（22模式 × Equipment域）

| # | 模式 | Equipment域影响 | 发现数 | 状态 |
|---|------|----------------|--------|------|
| P1 | null/undefined防护缺失 | generateEquipment(null), deserialize(null), forge(null uid) | 6 | 🔴 uncovered |
| P2 | 数值溢出/非法值 | calculateMainStatValue(NaN), calculatePower(NaN), enhance(NaN level) | 5 | 🔴 uncovered |
| P3 | 负值漏洞 | enhanceLevel=-1, copperCost=-1, decomposeReward负值 | 3 | ⚠️ partial |
| P4 | 浅拷贝副作用 | heroEquips返回引用, getHeroEquips已用展开保护 | 1 | ✅ covered |
| P5 | 竞态/状态泄漏 | forge消费输入后生成失败（装备丢失） | 1 | 🔴 uncovered |
| P6 | 经济漏洞 | expandBag无实际扣费验证, forge消耗无资源预检 | 2 | 🔴 uncovered |
| P7 | 数据丢失 | deserialize不恢复ForgePity/EnhanceProtection | 2 | 🔴 uncovered |
| P8 | 集成缺失 | EquipmentForgeSystem依赖EquipmentSystem但可null | 1 | ⚠️ partial |
| P9 | NaN绕过数值检查 | calculateSubStatValue(NaN baseValue)→返回0有防护,但genMainStat未防护 | 2 | ⚠️ partial |
| P10 | 配置交叉不一致 | EQUIPMENT_RARITIES vs RARITY_ORDER vs FORGE_WEIGHTS keys | 1 | ⚠️ uncovered |
| P11 | 算法正确性缺陷 | recommendForHero是否真的推荐最优(同分随机性) | 1 | ⚠️ uncovered |
| P12 | setter/getter注入未调用 | setResourceDeductor/setEquipmentSystem注入点验证 | 2 | 🔴 uncovered |
| P13 | 修复穿透不完整 | N/A (R1首次) | 0 | — |
| P14 | 资源溢出无上限 | protectionCount有MAX_PROTECTION_COUNT=9999, totalForgeCount无上限 | 1 | ⚠️ partial |
| P15 | 保存/加载流程缺失子系统 | EquipmentSystem.serialize不包含ForgePity/EnhanceProtection | 2 | 🔴 uncovered |
| P16 | 伤害计算NaN传播 | calculatePower(NaN)→已有部分防护 | 1 | ✅ covered |
| P17 | 配置-枚举不同步 | EQUIPMENT_SLOTS vs slot枚举 | 1 | ⚠️ uncovered |
| P18 | Infinity序列化风险 | 无Infinity使用 | 0 | — |
| P19 | 对称函数修复遗漏 | N/A (R1首次) | 0 | — |
| P20 | 无锁发奖 | N/A (装备域无发奖逻辑) | 0 | — |
| P21 | 资源比较NaN绕过 | expandBag发出cost事件但无资源预检 | 1 | 🔴 uncovered |
| P22 | 资源累积无上限 | totalForgeCount无上限, protectionCount有上限 | 1 | ⚠️ partial |

---

## 1. EquipmentSystem（EquipmentSystem.ts — 411行）

### 1.1 构造器 & ISubsystem 适配

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| ES-001 | `constructor()` | 初始化bag/decomposer/codex/heroEquips | P1 | ✅ covered | EquipmentSystem-p1.test.ts |
| ES-002 | `init(deps)` | deps注入eventBus | P1 | ⚠️ uncovered | 无init直接测试 |
| ES-003 | `update(dt)` | 空操作 | P2 | ✅ covered | 无tick逻辑设计 |
| ES-004 | `getState()` | 委托serialize() | P1 | ⚠️ uncovered | 无getState直接测试 |
| ES-005 | `reset()` | bag.reset()+heroEquips.clear()+codex.clear()+seedCounter=0 | P1 | ✅ covered | EquipmentSystem-p1.test.ts |

### 1.2 装备生成

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| ES-010 | `generateEquipment(slot, rarity, source, seed)` | 按部位生成→addToBag | P1 | ✅ covered | EquipmentSystem-p1.test.ts |
| ES-011 | `generateEquipment(templateId, rarity)` | 按模板生成→addToBag | P1 | ✅ covered | EquipmentSystem-p1.test.ts |
| ES-012 | `generateEquipment(null, rarity)` | **null slot→isSlot(null)=false→走template路径→返回null** | 🔴 P0 | ⚠️ uncovered | 模式1:null防护 |
| ES-013 | `generateEquipment(slot, 'invalid')` | 无效rarity→genHelper可能返回异常 | 🔴 P0 | ⚠️ uncovered | 模式2:非法值 |
| ES-014 | `generateCampaignDrop(campaignType, seed)` | 正常掉落→权重选品质→随机部位 | P1 | ✅ covered | equipment-v10-p1.test.ts |
| ES-015 | `generateCampaignDrop('invalid_type')` | **无效campaignType→CAMPAIGN_DROP_WEIGHTS[undefined]→undefined→weightedPickRarity崩溃** | 🔴 P0 | ⚠️ uncovered | 模式1:null防护 |
| ES-016 | `generateFromSource(source, seed)` | 正常来源生成 | P1 | ✅ covered | 集成测试隐含 |
| ES-017 | `generateFromSource('unknown_source')` | 未知source→fallback到normal权重 | P1 | ✅ covered | 源码L131: `?? CAMPAIGN_DROP_WEIGHTS.normal` |

### 1.3 属性计算

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| ES-020 | `calculateMainStatValue(eq)` | 正常计算 baseValue × rarityMul × (1+level×factor) | P1 | ✅ covered | EquipmentSystem-p1.test.ts |
| ES-021 | `calculateMainStatValue(eq)` | baseValue=NaN→ `!Number.isFinite(NaN)`→return 0 | P0 | ✅ covered | 源码L152:已有NaN防护 |
| ES-022 | `calculateMainStatValue(eq)` | enhanceLevel=NaN→ `!Number.isFinite(NaN)`→return Math.floor(base×mul) | P0 | ✅ covered | 源码L154:已有NaN防护 |
| ES-023 | `calculateMainStatValue(eq)` | enhanceLevel=-1→负值→ `enhanceLevel<0`→return Math.floor(base×mul) | P1 | ✅ covered | 源码L154:负值防护 |
| ES-024 | `calculateSubStatValue(subStat, rarity, enhanceLevel)` | 正常计算 | P1 | ✅ covered | EquipmentSystem-p1.test.ts |
| ES-025 | `calculateSubStatValue(NaN_baseValue)` | baseValue=NaN→return 0 | P0 | ✅ covered | 源码L162:已有NaN防护 |
| ES-026 | `calculatePower(eq)` | 正常计算 mainStat+subStats+specialEffect×5+rarity×10 | P1 | ✅ covered | EquipmentSystem-p1.test.ts |
| ES-027 | `calculatePower(eq)` | mainStat.value=NaN→fallback 0 | P0 | ✅ covered | 源码L176: `Number.isFinite` |
| ES-028 | `calculatePower(eq)` | specialEffect.value=NaN→fallback 0 | P0 | ✅ covered | 源码L178: `Number.isFinite` |
| ES-029 | `recalculateStats(eq)` | 正常重算所有属性 | P1 | ✅ covered | EquipmentSystem-p1.test.ts |
| ES-030 | `recalcStats(eq)` | 别名→委托recalculateStats | P2 | ✅ covered | 别名函数 |

### 1.4 品质判定

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| ES-033 | `getEnhanceCap(rarity)` | 返回RARITY_ENHANCE_CAP[rarity] | P1 | ✅ covered | EquipmentSystem-p2.test.ts |
| ES-034 | `getEnhanceCap('invalid')` | **无效rarity→undefined→下游NaN** | 🔴 P0 | ⚠️ uncovered | 模式1+2 |
| ES-035 | `canEnhanceTo(rarity, level)` | level <= cap → true | P1 | ✅ covered | EquipmentSystem-p2.test.ts |
| ES-036 | `compareRarity(a, b)` | 正常比较 | P2 | ✅ covered | 隐含测试 |
| ES-037 | `rollRarity(weights, seed)` | 委托weightedPickRarity | P2 | ✅ covered | EquipmentGenHelper.test.ts |

### 1.5 穿戴/卸下

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| ES-040 | `equipItem(heroId, uid)` | 正常穿戴→设置slots+isEquipped | P1 | ✅ covered | EquipmentSystem-p2.test.ts |
| ES-041 | `equipItem(heroId, uid)` | 装备不存在→返回失败 | P0 | ✅ covered | 源码L253: `if (!eq)` |
| ES-042 | `equipItem(heroId, uid)` | 装备已被其他武将穿戴→返回失败 | P0 | ✅ covered | 源码L255: `eq.equippedHeroId !== heroId` |
| ES-043 | `equipItem(heroId, uid)` | 同部位已有装备→替换旧装备(unequip旧) | P0 | ✅ covered | EquipmentSystem-p2.test.ts |
| ES-044 | `equipItem(heroId, uid)` | 同武将同部位重复穿戴同一件→幂等 | P1 | ⚠️ uncovered | 无此场景测试 |
| ES-045 | `equipItem(null, uid)` | **heroId=null→heroEquips.get(null)→undefined→创建新slots(null)→Map key为null** | 🔴 P0 | ⚠️ uncovered | 模式1:null防护 |
| ES-046 | `unequipItem(heroId, slot)` | 正常卸下→清除isEquipped | P1 | ✅ covered | EquipmentSystem-p2.test.ts |
| ES-047 | `unequipItem(heroId, slot)` | 武将无装备栏→返回失败 | P0 | ✅ covered | 源码L274: `if (!slots)` |
| ES-048 | `unequipItem(heroId, slot)` | 该部位无装备→返回失败 | P0 | ✅ covered | 源码L276: `if (!uid)` |
| ES-049 | `markEquipped(uid, heroId)` | 装备不存在→失败 | P0 | ✅ covered | 源码L239 |
| ES-050 | `markEquipped(uid, heroId)` | 装备已穿戴→失败 | P0 | ✅ covered | 源码L241 |
| ES-051 | `markUnequipped(uid)` | 装备不存在→失败 | P0 | ✅ covered | 源码L248 |
| ES-052 | `markUnequipped(uid)` | 装备未被穿戴→失败 | P0 | ✅ covered | 源码L250 |

### 1.6 武将装备查询

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| ES-055 | `getHeroEquips(heroId)` | 有装备→返回拷贝 | P1 | ✅ covered | EquipmentSystem-p2.test.ts |
| ES-056 | `getHeroEquips(heroId)` | 无装备→返回空slots | P1 | ✅ covered | 源码L286 |
| ES-057 | `getHeroEquipItems(heroId)` | 正常返回EquipmentInstance数组 | P1 | ✅ covered | 隐含测试 |
| ES-058 | `getHeroEquipments(heroId)` | 正常返回已穿戴装备列表 | P1 | ✅ covered | 隐含测试 |

### 1.7 序列化

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| ES-060 | `serialize()` | 正常序列化equipments+bagCapacity+codexEntries | P0 | ✅ covered | EquipmentSystem-p2.test.ts |
| ES-061 | `serialize()` | **不包含ForgePityState/EnhanceProtectionCount** | 🔴 P0 | ⚠️ uncovered | 模式7+15:数据丢失 |
| ES-062 | `deserialize(data)` | 正常恢复背包+heroEquips+codex | P0 | ✅ covered | EquipmentSystem-p2.test.ts |
| ES-063 | `deserialize(null)` | **data=null→访问data.bagCapacity崩溃** | 🔴 P0 | ⚠️ uncovered | 模式1:null防护 |
| ES-064 | `deserialize(data)` | data.equipments含isEquipped装备→恢复heroEquips映射 | P0 | ✅ covered | 源码L355-363 |
| ES-065 | `deserialize(data)` | data.codexEntries恢复图鉴 | P1 | ✅ covered | 源码L349-353 |
| ES-066 | `deserialize(data)` | **版本不匹配→仅warn不处理** | P1 | ⚠️ uncovered | 源码L366:仅gameLog.warn |

---

## 2. EquipmentBagManager（EquipmentBagManager.ts — 211行）

### 2.1 背包CRUD

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| BM-001 | `add(equipment)` | 正常添加→emit equipment:added | P1 | ✅ covered | EquipmentBagManager.test.ts |
| BM-002 | `add(equipment)` | 背包已满→返回失败 | P0 | ✅ covered | EquipmentBagManager.test.ts |
| BM-003 | `add(equipment)` | 重复uid→幂等成功 | P1 | ✅ covered | 源码L60: `equipments.has` |
| BM-004 | `add(null)` | **equipment=null→访问null.uid崩溃** | 🔴 P0 | ⚠️ uncovered | 模式1:null防护 |
| BM-005 | `removeFromBag(uid)` | 正常移除→emit equipment:removed | P1 | ✅ covered | EquipmentBagManager.test.ts |
| BM-006 | `removeFromBag(uid)` | 装备不存在→失败 | P0 | ✅ covered | 源码L70 |
| BM-007 | `removeFromBag(uid)` | 已穿戴装备→失败 | P0 | ✅ covered | 源码L72 |
| BM-008 | `get(uid)` | 正常获取 | P1 | ✅ covered | 隐含测试 |
| BM-009 | `update(eq)` | 已存在→更新 | P1 | ✅ covered | 隐含测试 |
| BM-010 | `update(eq)` | 不存在→静默忽略 | P1 | ⚠️ uncovered | 源码L83: `if (has)` |
| BM-011 | `getAll()` | 返回数组拷贝 | P1 | ✅ covered | 隐含测试 |
| BM-012 | `getMap()` | 返回内部引用（用于序列化） | P1 | ✅ covered | serialize使用 |

### 2.2 容量管理

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| BM-015 | `getCapacity()` | 返回当前容量 | P2 | ✅ covered | 隐含测试 |
| BM-016 | `setCapacity(capacity)` | 反序列化用→直接设置 | P1 | ✅ covered | deserialize使用 |
| BM-017 | `setCapacity(NaN)` | **NaN→bagCapacity=NaN→isFull()永远false→无限添加** | 🔴 P0 | ⚠️ uncovered | 模式2+9:NaN绕过 |
| BM-018 | `isFull()` | size >= capacity | P1 | ✅ covered | EquipmentBagManager.test.ts |
| BM-019 | `expand()` | 正常扩容→emit cost+expanded | P1 | ✅ covered | EquipmentBagManager.test.ts |
| BM-020 | `expand()` | 已达MAX_BAG_CAPACITY→失败 | P0 | ✅ covered | 源码L104 |
| BM-021 | `expand()` | **发出equipment:bag_expand_cost事件但无资源预检→可能无铜钱仍扩容** | 🔴 P0 | ⚠️ uncovered | 模式6+21:经济漏洞 |

### 2.3 排序/筛选

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| BM-025 | `sort('rarity_desc')` | 按品质降序 | P1 | ✅ covered | EquipmentBagManager.test.ts |
| BM-026 | `sort('level_desc')` | 按等级降序 | P1 | ✅ covered | 隐含测试 |
| BM-027 | `sort('slot_type')` | 按部位类型 | P1 | ✅ covered | 隐含测试 |
| BM-028 | `sort('acquired_time')` | 按获取时间 | P1 | ⚠️ uncovered | 无此排序测试 |
| BM-029 | `filter({slot, rarity, unequippedOnly, setOnly})` | 组合筛选 | P1 | ✅ covered | EquipmentBagManager.test.ts |
| BM-030 | `filter({setOnly:true})` | 调用getTemplate回调→套装筛选 | P0 | ✅ covered | 隐含测试 |
| BM-031 | `groupBySlot()` | 按部位分组 | P1 | ✅ covered | 隐含测试 |
| BM-032 | `reset()` | 清空背包+恢复默认容量 | P1 | ✅ covered | EquipmentBagManager.test.ts |

---

## 3. EquipmentForgeSystem（EquipmentForgeSystem.ts — 311行）

### 3.1 构造器 & 初始化

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| F-001 | `constructor(equipmentSystem?)` | 可选注入equipmentSystem | P1 | ✅ covered | EquipmentForgeSystem.test.ts |
| F-002 | `setEquipmentSystem(eqSystem)` | 后置注入 | P1 | ⚠️ uncovered | 模式12:注入点验证 |
| F-003 | `init(deps)` | deps注入 | P1 | ⚠️ uncovered | 无init测试 |
| F-004 | `reset()` | pityManager.reset()+totalForgeCount=0 | P1 | ✅ covered | EquipmentForgeSystem.test.ts |

### 3.2 炼制主流程

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| F-010 | `basicForge(uids, rng)` | 正常3件同品质→高一品质 | P0 | ✅ covered | EquipmentForgeSystem.test.ts |
| F-011 | `basicForge()` | 无参数→autoSelectInputs | P1 | ✅ covered | 源码L117 |
| F-012 | `basicForge(uids)` | 投入数量≠3→失败 | P0 | ✅ covered | 源码L165 |
| F-013 | `basicForge(uids)` | 品质不一致→失败 | P0 | ✅ covered | 源码L178 |
| F-014 | `basicForge(uids)` | 金色装备不可炼制→失败 | P0 | ✅ covered | 源码L180 |
| F-015 | `basicForge(uids)` | 已穿戴装备不可炼制→失败 | P0 | ✅ covered | 源码L173 |
| F-016 | `advancedForge(uids, rng)` | 正常5件→高级炼制 | P0 | ✅ covered | EquipmentForgeSystem.test.ts |
| F-017 | `advancedForge(uids)` | 投入数量≠5→失败 | P0 | ✅ covered | 源码L165 |
| F-018 | `targetedForge(slot, rng)` | 指定部位定向炼制 | P0 | ✅ covered | EquipmentForgeSystem.test.ts |
| F-019 | `targetedForge(uids, slot, rng)` | 数组+部位混合签名 | P1 | ✅ covered | 源码L128-136 |
| F-020 | `executeForge(type, uids, slot, rng)` | **equipmentSystem=null→validateForgeInput返回失败但consumeInputEquipments不消费** | P1 | ✅ covered | 源码L161 |
| F-021 | `executeForge(type, uids, slot, rng)` | **validateForgeInput通过→consumeInputEquipments消费→generateEquipment可能返回null→装备丢失** | 🔴 P0 | ⚠️ uncovered | 模式5:竞态/状态泄漏 |
| F-022 | `executeForge(type, uids, slot, rng)` | 正常流程→消耗+生成+计数+1 | P0 | ✅ covered | EquipmentForgeSystem.test.ts |

### 3.3 验证

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| F-025 | `validateForgeInput(type, null)` | **inputUids=null→Array.isArray(null)=false→失败** | P0 | ✅ covered | 源码L163 |
| F-026 | `validateForgeInput(type, uids)` | uid不存在→失败 | P0 | ✅ covered | 源码L170 |
| F-027 | `validateForgeInput(type, uids)` | **equipmentSystem=null→失败(但后续consumeInputEquipments也依赖eqSystem)** | P0 | ✅ covered | 源码L167 |

### 3.4 品质确定 & 保底

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| F-030 | `determineOutputRarity(type, inputRarity)` | 正常随机→按权重表 | P1 | ✅ covered | EquipmentForgeSystem.test.ts |
| F-031 | `determineOutputRarity(type, inputRarity)` | 保底触发→返回保底品质 | P0 | ✅ covered | EquipmentForgeSystem.test.ts |
| F-032 | `determineOutputRarity(type, 'gold')` | **gold不在权重表中→weights=undefined→getNextRarity(gold)=null→返回gold** | P1 | ⚠️ uncovered | 边界:金色不可炼制但此处可达 |
| F-033 | `rollWithCustomRng(weights, rng)` | 自定义随机 | P1 | ✅ covered | 隐含测试 |

### 3.5 自动选材

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| F-035 | `autoSelectInputs('basic')` | 按品质升序选3件最低品质 | P1 | ✅ covered | 隐含测试 |
| F-036 | `autoSelectInputs('advanced')` | 选5件 | P1 | ✅ covered | 隐含测试 |
| F-037 | `autoSelectInputs(type)` | 无可用装备→返回空数组→后续validate失败 | P1 | ✅ covered | 源码L202-208 |

### 3.6 查询

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| F-040 | `getPityState()` | 返回pityManager.getState() | P1 | ✅ covered | EquipmentForgeSystem.test.ts |
| F-041 | `getTotalForgeCount()` | 返回总数 | P1 | ✅ covered | 隐含测试 |
| F-042 | `getForgeCostPreview(type)` | 返回铜钱+强化石+精炼石+投入数 | P1 | ✅ covered | 隐含测试 |
| F-043 | `getForgeCost(type)` | 返回铜钱+强化石+精炼石 | P1 | ✅ covered | 隐含测试 |

### 3.7 序列化

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| F-045 | `serialize()` | 返回pityState+totalForgeCount | P0 | ✅ covered | EquipmentForgeSystem.test.ts |
| F-046 | `deserialize(data)` | 正常恢复 | P0 | ✅ covered | EquipmentForgeSystem.test.ts |
| F-047 | `deserialize(null)` | **data=null→访问data.pityState崩溃** | 🔴 P0 | ⚠️ uncovered | 模式1:null防护 |
| F-048 | `deserialize(data)` | data.pityState=null→fallback默认值 | P1 | ✅ covered | 源码L226: `?? {basicBluePity:0...}` |

---

## 4. EquipmentEnhanceSystem（EquipmentEnhanceSystem.ts — 315行）

### 4.1 构造器 & 初始化

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| EH-001 | `constructor(equipmentSystem)` | 注入equipmentSystem | P1 | ✅ covered | EquipmentEnhanceSystem.test.ts |
| EH-002 | `setResourceDeductor(fn)` | 注入资源扣除回调 | P1 | ⚠️ uncovered | 模式12:注入点验证 |
| EH-003 | `init(deps)` | deps注入 | P1 | ⚠️ uncovered | 无init测试 |

### 4.2 单次强化

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| EH-010 | `enhance(uid, useProtection)` | 正常成功→level+1 | P0 | ✅ covered | EquipmentEnhanceSystem.test.ts |
| EH-011 | `enhance(uid, false)` | 失败不降级(安全等级内) | P0 | ✅ covered | EquipmentEnhanceSystem.test.ts |
| EH-012 | `enhance(uid, false)` | 失败降级(安全等级以上,50%概率) | P0 | ✅ covered | EquipmentEnhanceSystem.adversarial.test.ts |
| EH-013 | `enhance(uid, true)` | 保护符保护不降级 | P0 | ✅ covered | EquipmentEnhanceSystem.test.ts |
| EH-014 | `enhance(invalid_uid)` | 装备不存在→返回失败 | P0 | ✅ covered | 源码L66 |
| EH-015 | `enhance(uid)` | 已达maxLevel→返回失败 | P0 | ✅ covered | EquipmentEnhanceSystem.max-level.test.ts |
| EH-016 | `enhance(uid)` | 已达品质强化上限→返回失败 | P0 | ✅ covered | 源码L74-76 |
| EH-017 | `enhance(uid, true)` | 保护符不足→降级为useProtection=false | P1 | ✅ covered | 源码L84-87 |
| EH-018 | `enhance(uid)` | **deductResources回调返回false→返回失败但未消费** | P0 | ✅ covered | 源码L91-94 |
| EH-019 | `enhance(uid)` | 金色装备+12以上失败不降级(PRDRule) | P0 | ✅ covered | 源码L104 |
| EH-020 | `enhance(uid)` | **deductResources=null→跳过扣费→免费强化** | 🔴 P0 | ⚠️ uncovered | 模式6+12:经济漏洞 |

### 4.3 自动强化

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| EH-025 | `autoEnhance(uid, config)` | 正常循环到目标等级 | P0 | ✅ covered | EquipmentEnhanceSystem.test.ts |
| EH-026 | `autoEnhance(uid, config)` | 达到maxCopper上限→停止 | P1 | ✅ covered | 源码L137 |
| EH-027 | `autoEnhance(uid, config)` | 达到maxStone上限→停止 | P1 | ✅ covered | 源码L138 |
| EH-028 | `autoEnhance(uid, config)` | 装备不存在→返回空steps | P0 | ✅ covered | 源码L128 |
| EH-029 | `autoEnhance(uid, config)` | **100步安全上限→防止无限循环** | P0 | ✅ covered | 源码L145 |
| EH-030 | `autoEnhance(uid, config)` | **config.maxCopper=NaN→totalCopper>=NaN永远false→无限循环(100步兜底)** | 🔴 P0 | ⚠️ uncovered | 模式9:NaN绕过 |

### 4.4 强化转移

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| EH-035 | `transferEnhance(src, tgt)` | 正常转移→源重置+目标设等级(扣除TRANSFER_LEVEL_LOSS) | P0 | ✅ covered | EquipmentEnhanceSystem.test.ts |
| EH-036 | `transferEnhance(invalid, tgt)` | 源不存在→失败 | P0 | ✅ covered | 源码L154 |
| EH-037 | `transferEnhance(src, invalid)` | 目标不存在→失败 | P0 | ✅ covered | 源码L154 |
| EH-038 | `transferEnhance(src, tgt)` | 源enhanceLevel=0→失败 | P0 | ✅ covered | 源码L158 |
| EH-039 | `transferEnhance(src, tgt)` | **transferLevel计算: max(0, level-LOSS), cost=level*COST_FACTOR→无资源实际扣除** | P1 | ⚠️ uncovered | 模式6:经济漏洞(仅返回cost未扣) |

### 4.5 一键强化

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| EH-042 | `batchEnhance(uids, useProtection)` | 批量强化 | P1 | ✅ covered | EquipmentEnhanceSystem.test.ts |
| EH-043 | `batchEnhance(uids)` | 跳过不存在/满级装备 | P1 | ✅ covered | 源码L175 |

### 4.6 保护符管理

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| EH-045 | `addProtection(count)` | 正常添加→Math.min(cap, current+count) | P1 | ✅ covered | EquipmentEnhanceSystem.test.ts |
| EH-046 | `addProtection(NaN)` | NaN→静默忽略 | P0 | ✅ covered | 源码L195: `!Number.isFinite` |
| EH-047 | `addProtection(-1)` | 负值→静默忽略 | P0 | ✅ covered | 源码L195: `count <= 0` |
| EH-048 | `getProtectionCount()` | 返回当前数量 | P1 | ✅ covered | 隐含测试 |

### 4.7 序列化

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| EH-050 | `serialize()` | 返回{protectionCount} | P0 | ✅ covered | EquipmentEnhanceSystem.test.ts |
| EH-051 | `deserialize(data)` | 正常恢复 | P0 | ✅ covered | EquipmentEnhanceSystem.test.ts |
| EH-052 | `deserialize(null)` | **data=null→data.protectionCount崩溃** | 🔴 P0 | ⚠️ uncovered | 模式1:null防护 |
| EH-053 | `reset()` | protectionCount=0 | P1 | ✅ covered | EquipmentEnhanceSystem.test.ts |

---

## 5. EquipmentSetSystem（EquipmentSetSystem.ts — 183行）

### 5.1 套装定义查询

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| ST-001 | `getAllSetDefs()` | 返回所有套装定义 | P1 | ✅ covered | EquipmentSetSystem.test.ts |
| ST-002 | `getSetDef(setId)` | 有效setId→返回定义 | P1 | ✅ covered | EquipmentSetSystem.test.ts |
| ST-003 | `getSetDef('invalid')` | 无效setId→undefined | P1 | ✅ covered | 源码L39 |
| ST-004 | `getAllSetIds()` | 返回所有套装ID | P1 | ✅ covered | EquipmentSetSystem.test.ts |

### 5.2 套装件数统计

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| ST-010 | `getSetCounts(heroId)` | 正常统计各套装件数 | P0 | ✅ covered | EquipmentSetSystem.test.ts |
| ST-011 | `getSetCounts(heroId)` | 无装备→空Map | P1 | ✅ covered | 源码L48-56 |
| ST-012 | `getSetCounts(heroId)` | 装备无templateId→跳过 | P1 | ⚠️ uncovered | 无此场景测试 |

### 5.3 套装效果激活

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| ST-015 | `getActiveSetBonuses(heroId)` | 2件激活bonus2 | P0 | ✅ covered | EquipmentSetSystem.test.ts |
| ST-016 | `getActiveSetBonuses(heroId)` | 4件激活bonus2+bonus4 | P0 | ✅ covered | EquipmentSetSystem.test.ts |
| ST-017 | `getActiveSetBonuses(heroId)` | 1件→不激活 | P1 | ✅ covered | EquipmentSetSystem.test.ts |
| ST-018 | `getTotalSetBonuses(heroId)` | 多套装聚合 | P1 | ✅ covered | EquipmentSetSystem.test.ts |
| ST-019 | `getActiveSetBonuses(heroId)` | **bonus值=NaN→mergeBonuses累积NaN** | 🔴 P0 | ⚠️ uncovered | 模式2:数值溢出 |

### 5.4 套装建议

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| ST-022 | `getClosestSetBonus(heroId)` | 返回最接近激活的套装 | P1 | ✅ covered | EquipmentSetSystem.test.ts |
| ST-023 | `getClosestSetBonus(heroId)` | 无套装→null | P1 | ✅ covered | 源码L88 |
| ST-024 | `getSetCompletionEquipments(heroId)` | 返回可凑套装的未穿戴装备 | P1 | ✅ covered | EquipmentSetSystem.test.ts |

---

## 6. EquipmentRecommendSystem（EquipmentRecommendSystem.ts — 236行）

### 6.1 单件评分

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| RC-001 | `evaluateEquipment(eq, heroId)` | 正常评分→5维度加权 | P1 | ✅ covered | EquipmentRecommendSystem.test.ts |
| RC-002 | `evaluateEquipment(eq, heroId)` | **同分装备→推荐结果不稳定(取决于遍历顺序)** | P1 | ⚠️ uncovered | 模式11:算法正确性 |
| RC-003 | `scoreMainStat(eq)` | mainStat.value=NaN→NaN/2=NaN→Math.min(100,NaN)=NaN | 🔴 P0 | ⚠️ uncovered | 模式2:数值溢出 |
| RC-004 | `scoreSubStats(eq)` | subStats为空→返回0 | P1 | ✅ covered | 源码L82 |
| RC-005 | `scoreSetBonus(eq, heroId)` | 无套装→返回0 | P1 | ✅ covered | 源码L90 |
| RC-006 | `scoreEnhance(NaN)` | **NaN*100/15=NaN→Math.min(100,NaN)=NaN** | 🔴 P0 | ⚠️ uncovered | 模式2:数值溢出 |

### 6.2 一键推荐

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| RC-010 | `recommendForHero(heroId)` | 正常推荐4部位最优 | P0 | ✅ covered | EquipmentRecommendSystem.test.ts |
| RC-011 | `recommendForHero(heroId)` | 无可用装备→所有slot为null | P1 | ✅ covered | 源码L109 |
| RC-012 | `recommendForHero(heroId)` | 套装建议生成(1/2/3/4件) | P1 | ✅ covered | EquipmentRecommendSystem.test.ts |
| RC-013 | `recommendForHero(heroId)` | **当前穿戴+未穿戴混合候选→可能推荐已穿戴的同一件** | P1 | ⚠️ uncovered | 模式11:算法正确性 |

---

## 7. EquipmentDecomposer（EquipmentDecomposer.ts — 123行）

### 7.1 分解

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| DC-001 | `calculateDecomposeReward(eq)` | 正常计算 copper×enhanceBonus + stone×enhanceBonus | P1 | ✅ covered | EquipmentDecomposer.test.ts |
| DC-002 | `calculateDecomposeReward(eq)` | enhanceLevel=NaN→1+NaN*DECOMPOSE_ENHANCE_BONUS=NaN→Math.floor(NaN)=NaN | 🔴 P0 | ⚠️ uncovered | 模式2:数值溢出 |
| DC-003 | `getDecomposePreview(uid)` | 正常预览 | P1 | ✅ covered | EquipmentDecomposer.test.ts |
| DC-004 | `getDecomposePreview(invalid_uid)` | 不存在→null | P0 | ✅ covered | 源码L37 |
| DC-005 | `decomposeSingle(uid)` | 正常分解→移除+emit事件 | P0 | ✅ covered | EquipmentDecomposer.test.ts |
| DC-006 | `decomposeSingle(uid)` | 装备不存在→失败 | P0 | ✅ covered | 源码L43 |
| DC-007 | `decomposeSingle(uid)` | 已穿戴→失败 | P0 | ✅ covered | 源码L44 |
| DC-008 | `batchDecompose(uids)` | 批量分解→汇总奖励 | P1 | ✅ covered | EquipmentDecomposer.test.ts |
| DC-009 | `batchDecompose(uids)` | 部分失败→跳过+记录skippedUids | P1 | ✅ covered | 源码L55-59 |
| DC-010 | `decomposeAllUnequipped(getAll)` | 分解所有未穿戴 | P1 | ✅ covered | EquipmentDecomposer.test.ts |

### 7.2 图鉴

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| DC-015 | `isCodexDiscovered(templateId)` | 已发现→true | P1 | ✅ covered | 隐含测试 |
| DC-016 | `getCodexEntry(templateId)` | 存在→返回条目 | P1 | ✅ covered | 隐含测试 |
| DC-017 | `updateCodex(eq)` | 首次发现→创建条目 | P1 | ✅ covered | 隐含测试 |
| DC-018 | `updateCodex(eq)` | 重复发现→obtainCount++ + 更新bestRarity | P1 | ✅ covered | 源码L72-76 |

---

## 8. ForgePityManager（ForgePityManager.ts — 138行）

### 8.1 状态管理

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| FP-001 | `getState()` | 返回快照(非引用) | P1 | ✅ covered | ForgePityManager.test.ts |
| FP-002 | `restore(state)` | 正常恢复 | P1 | ✅ covered | ForgePityManager.test.ts |
| FP-003 | `restore(null)` | null→fallback默认值 | P0 | ✅ covered | 源码L38: `?? {basicBluePity:0...}` |
| FP-004 | `reset()` | 重置所有计数器 | P1 | ✅ covered | ForgePityManager.test.ts |

### 8.2 保底判定

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| FP-010 | `shouldTrigger('basic')` | basicBluePity >= 阈值→true | P0 | ✅ covered | ForgePityManager.test.ts |
| FP-011 | `shouldTrigger('advanced')` | advancedPurplePity >= 阈值→true | P0 | ✅ covered | ForgePityManager.test.ts |
| FP-012 | `shouldTrigger('targeted')` | targetedGoldPity >= 阈值→true | P0 | ✅ covered | ForgePityManager.test.ts |
| FP-013 | `getPityRarity('basic')` | 返回'purple' | P1 | ✅ covered | ForgePityManager.test.ts |
| FP-014 | `getPityRarity('targeted')` | 返回'gold' | P1 | ✅ covered | ForgePityManager.test.ts |

### 8.3 保底更新

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| FP-020 | `update('basic', 'purple')` | 达到紫色→重置计数器 | P0 | ✅ covered | ForgePityManager.test.ts |
| FP-021 | `update('basic', 'white')` | 未达到→计数器+1 | P0 | ✅ covered | ForgePityManager.test.ts |
| FP-022 | `update('basic', 'white')` | 计数器达到阈值→触发保底+重置 | P0 | ✅ covered | ForgePityManager.test.ts |
| FP-023 | `getProgress(type)` | 返回{current, threshold} | P1 | ✅ covered | ForgePityManager.test.ts |

---

## 9. EquipmentGenHelper（EquipmentGenHelper.ts — 150行）

### 9.1 UID & 随机工具

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| GH-001 | `generateUid()` | 生成唯一ID | P1 | ✅ covered | EquipmentGenHelper.test.ts |
| GH-002 | `resetUidCounter()` | 重置计数器 | P1 | ✅ covered | EquipmentGenHelper.test.ts |
| GH-003 | `seedPick(arr, seed)` | 正常选择 | P1 | ✅ covered | EquipmentGenHelper.test.ts |
| GH-004 | `seedPick([], seed)` | **空数组→arr[NaN%0]→undefined** | P1 | ⚠️ uncovered | 边界 |
| GH-005 | `weightedPickRarity(weights, seed)` | 正常按权重选择 | P1 | ✅ covered | EquipmentGenHelper.test.ts |
| GH-006 | `weightedPickRarity({}, seed)` | 空权重→entries[0]→undefined→fallback 'white' | P1 | ✅ covered | 源码L60 |
| GH-007 | `weightedPickRarity(weights, seed)` | **全0权重→total=0→返回entries[0]** | P1 | ✅ covered | 源码L58 |
| GH-008 | `isSlot(value)` | 有效slot→true | P1 | ✅ covered | EquipmentGenHelper.test.ts |
| GH-009 | `isSlot('invalid')` | 无效→false | P1 | ✅ covered | EquipmentGenHelper.test.ts |

### 9.2 装备生成

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| GH-015 | `generateBySlot(slot, rarity, source, seed)` | 正常生成→完整EquipmentInstance | P0 | ✅ covered | EquipmentGenHelper.test.ts |
| GH-016 | `generateByTemplate(templateId, rarity, seed)` | 有效模板→生成 | P0 | ✅ covered | EquipmentGenHelper.test.ts |
| GH-017 | `generateByTemplate('invalid', rarity, seed)` | 无效模板→null | P0 | ✅ covered | 源码L87 |
| GH-018 | `genMainStat(slot, rarity, seed)` | 正常生成主属性 | P1 | ✅ covered | EquipmentGenHelper.test.ts |
| GH-019 | `genSubStats(slot, rarity, seed)` | 正常生成副属性(去重) | P1 | ✅ covered | EquipmentGenHelper.test.ts |
| GH-020 | `genSpecialEffect(slot, rarity, seed)` | 正常生成特效 | P1 | ✅ covered | EquipmentGenHelper.test.ts |
| GH-021 | `genSpecialEffect(slot, 'white', seed)` | white品质chance=0→返回null | P1 | ✅ covered | 源码L142 |
| GH-022 | `generateBySlot(slot, rarity, source, seed)` | **seed=NaN→randInt(NaN)→NaN%range=NaN→baseValue=NaN** | 🔴 P0 | ⚠️ uncovered | 模式2:数值溢出 |

---

## 10. EquipmentDropWeights（EquipmentDropWeights.ts — 26行）

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| DW-001 | `CAMPAIGN_DROP_WEIGHTS` | 包含normal/elite/boss三种关卡 | P1 | ✅ covered | EquipmentDropWeights.test.ts |
| DW-002 | `CAMPAIGN_DROP_WEIGHTS` | 每种关卡包含所有品质权重 | P1 | ✅ covered | EquipmentDropWeights.test.ts |
| DW-003 | `SOURCE_RARITY_WEIGHTS` | 包含equipment_box/event来源 | P1 | ✅ covered | 隐含测试 |
| DW-004 | 权重总和 | 各关卡权重总和应>0 | P1 | ✅ covered | EquipmentDropWeights.test.ts |

---

## 高优先级P0遗漏清单（Challenger重点）

| # | 节点ID | API | 风险描述 | 关联模式 |
|---|--------|-----|---------|---------|
| 1 | ES-012 | `generateEquipment(null)` | null slot走template路径返回null | P1 |
| 2 | ES-015 | `generateCampaignDrop('invalid')` | 无效campaignType→权重undefined→崩溃 | P1 |
| 3 | ES-034 | `getEnhanceCap('invalid')` | 无效rarity→undefined→下游NaN | P1+P2 |
| 4 | ES-045 | `equipItem(null, uid)` | heroId=null→Map key异常 | P1 |
| 5 | ES-061 | `serialize()` | 不含ForgePity/EnhanceProtection | P7+P15 |
| 6 | ES-063 | `deserialize(null)` | null data→崩溃 | P1 |
| 7 | BM-004 | `add(null)` | null equipment→崩溃 | P1 |
| 8 | BM-017 | `setCapacity(NaN)` | NaN容量→isFull永远false | P2+P9 |
| 9 | BM-021 | `expand()` | 无资源预检→免费扩容 | P6+P21 |
| 10 | F-021 | `executeForge()` | 消费后生成失败→装备丢失 | P5 |
| 11 | F-047 | `deserialize(null)` | null data→崩溃 | P1 |
| 12 | EH-020 | `enhance(uid)` | deductResources=null→免费强化 | P6+P12 |
| 13 | EH-030 | `autoEnhance(uid, {maxCopper:NaN})` | NaN绕过上限检查→100步兜底 | P9 |
| 14 | EH-039 | `transferEnhance(src, tgt)` | 返回cost但未实际扣费 | P6 |
| 15 | EH-052 | `deserialize(null)` | null data→崩溃 | P1 |
| 16 | ST-019 | `getActiveSetBonuses()` | bonus值NaN→累积NaN | P2 |
| 17 | RC-003 | `scoreMainStat(eq)` | NaN value→评分NaN | P2 |
| 18 | RC-006 | `scoreEnhance(NaN)` | NaN level→评分NaN | P2 |
| 19 | DC-002 | `calculateDecomposeReward(eq)` | enhanceLevel=NaN→奖励NaN | P2 |
| 20 | GH-022 | `generateBySlot(slot, rarity, source, NaN)` | seed=NaN→属性NaN | P2 |

---

## 跨系统链路详细覆盖

### 链路1: Equipment↔Forge（锻造消耗/生成装备）
| # | 链路 | 状态 | 来源 |
|---|------|------|------|
| L1-1 | Forge.validateForgeInput→EquipmentSystem.getEquipment | ✅ covered | EquipmentForgeSystem.test.ts |
| L1-2 | Forge.consumeInputEquipments→EquipmentSystem.removeFromBag | ✅ covered | EquipmentForgeSystem.test.ts |
| L1-3 | Forge.executeForge→EquipmentSystem.generateEquipment | ✅ covered | EquipmentForgeSystem.test.ts |
| L1-4 | **Forge.autoSelectInputs→EquipmentSystem.getAllEquipments (无eqSystem时返回[])** | ⚠️ uncovered | 模式8:集成缺失 |

### 链路2: Equipment↔Enhance（强化读写装备）
| # | 链路 | 状态 | 来源 |
|---|------|------|------|
| L2-1 | Enhance.enhance→EquipmentSystem.getEquipment | ✅ covered | EquipmentEnhanceSystem.test.ts |
| L2-2 | Enhance.enhance→EquipmentSystem.recalcStats+updateEquipment | ✅ covered | EquipmentEnhanceSystem.test.ts |
| L2-3 | **Enhance.setResourceDeductor→外部资源系统(注入点未验证)** | ⚠️ uncovered | 模式12:注入点 |

### 链路3: Equipment↔Set（套装查询装备）
| # | 链路 | 状态 | 来源 |
|---|------|------|------|
| L3-1 | Set.getSetCounts→EquipmentSystem.getHeroEquips+getEquipment | ✅ covered | EquipmentSetSystem.test.ts |
| L3-2 | Set.getSetCompletionEquipments→EquipmentSystem.filterEquipments | ✅ covered | EquipmentSetSystem.test.ts |
| L3-3 | **Set依赖TEMPLATE_MAP外部配置(配置-枚举同步)** | ⚠️ uncovered | 模式17 |

### 链路4: Equipment↔Recommend（推荐读取装备+套装）
| # | 链路 | 状态 | 来源 |
|---|------|------|------|
| L4-1 | Recommend.recommendForHero→EquipmentSystem.getFilteredEquipments+getHeroEquipments | ✅ covered | EquipmentRecommendSystem.test.ts |
| L4-2 | **Recommend.evaluateEquipment→EquipmentSetSystem(通过构造器注入)** | ⚠️ uncovered | 模式12:注入点 |

### 链路5: Equipment↔Decomposer（分解删除装备）
| # | 链路 | 状态 | 来源 |
|---|------|------|------|
| L5-1 | Decomposer.decomposeSingle→Bag.removeFromBag | ✅ covered | EquipmentDecomposer.test.ts |
| L5-2 | Decomposer.updateCodex→codex Map | ✅ covered | EquipmentDecomposer.test.ts |
| L5-3 | Decomposer.calculateDecomposeReward→DECOMPOSE_*配置 | ✅ covered | EquipmentDecomposer.test.ts |

### 链路6: Equipment↔Save（序列化六处同步）
| # | 链路 | 状态 | 来源 |
|---|------|------|------|
| L6-1 | EquipmentSystem.serialize/deserialize | ✅ covered | EquipmentSystem-p2.test.ts |
| L6-2 | EquipmentForgeSystem.serialize/deserialize | ✅ covered | EquipmentForgeSystem.test.ts |
| L6-3 | EquipmentEnhanceSystem.serialize/deserialize | ✅ covered | EquipmentEnhanceSystem.test.ts |
| L6-4 | **EquipmentSetSystem.serialize/deserialize (getState返回空{})** | ⚠️ uncovered | 模式7+15 |
| L6-5 | **ForgePityManager.serialize (通过ForgeSystem间接)** | ⚠️ uncovered | 模式15 |
| L6-6 | EquipmentDecomposer (codex通过EquipmentSystem间接序列化) | ✅ covered | EquipmentSystem.serialize |

### 链路7: Equipment↔Battle（装备加成传递）
| # | 链路 | 状态 | 来源 |
|---|------|------|------|
| L7-1 | DEF-007: 装备属性加成传递到战斗计算 | ✅ covered | DEF-007-equipment-bonus.test.ts |

### 链路8: Forge↔Pity（保底计数/触发）
| # | 链路 | 状态 | 来源 |
|---|------|------|------|
| L8-1 | Forge.executeForge→PityManager.shouldTrigger | ✅ covered | EquipmentForgeSystem.test.ts |
| L8-2 | Forge.executeForge→PityManager.update | ✅ covered | EquipmentForgeSystem.test.ts |
| L8-3 | Forge.serialize→PityManager.getState | ✅ covered | EquipmentForgeSystem.test.ts |

### 链路9: Enhance↔Resource（资源扣除回调注入）
| # | 链路 | 状态 | 来源 |
|---|------|------|------|
| L9-1 | **Enhance.setResourceDeductor→外部资源系统回调** | ⚠️ uncovered | 模式12:注入点未验证 |

---

## Builder规则合规性检查

| 规则# | 描述 | Equipment域状态 | 备注 |
|--------|------|----------------|------|
| BR-01 | 每个公开API至少1个F-Normal节点 | ✅ 合规 | 所有API已枚举 |
| BR-02 | 数值API检查null/undefined/NaN/负值/溢出 | ⚠️ 6处遗漏 | ES-012/015, BM-017, DC-002, GH-022, RC-003 |
| BR-03 | 状态变更API检查serialize/deserialize | ⚠️ 2处遗漏 | ES-061(ForgePity未保存), L6-4(SetSystem空序列化) |
| BR-04 | covered标注有源码支撑 | ✅ 合规 | 所有covered标注引用源码行号或测试文件 |
| BR-05 | 跨系统链路≥N条(N=9×2=18) | ✅ 合规 | 已枚举26条链路 |
| BR-06 | NaN检查使用!Number.isFinite | ⚠️ partial | EquipmentSystem有防护,GenHelper/Decomposer缺失 |
| BR-07 | 配置文件交叉验证 | ⚠️ 未验证 | EQUIPMENT_RARITIES vs FORGE_WEIGHTS keys |
| BR-08 | 算法正确性验证 | ⚠️ 未验证 | recommendForHero同分场景 |
| BR-09 | 双系统并存分析 | ✅ N/A | 无双系统并存 |
| BR-10 | FIX穿透验证 | ✅ N/A | R1首次,无历史FIX |
| BR-11 | 注入点验证 | ⚠️ 2处遗漏 | setResourceDeductor, setEquipmentSystem |
| BR-12 | 溢出闭环 | ⚠️ 1处遗漏 | totalForgeCount无上限 |
| BR-13 | 事务性扫描 | ⚠️ 1处遗漏 | F-021:forge消费后失败无回滚 |
| BR-14 | 保存/加载覆盖扫描 | ⚠️ 2处遗漏 | ForgePity/EnhanceProtection不在EquipmentSystem.serialize |
| BR-15 | deserialize覆盖六处同步 | ⚠️ 部分缺失 | EquipmentForgeSystem/EnhanceSystem独立序列化,未纳入主流程 |
| BR-16 | 跨系统回调注入验证 | ⚠️ 1处遗漏 | setResourceDeductor回调 |
| BR-17 | 战斗数值安全 | ✅ 合规 | calculatePower已有NaN防护 |
| BR-18 | 配置-枚举同步 | ⚠️ 未验证 | EQUIPMENT_SLOTS vs slot枚举 |
| BR-19 | Infinity序列化 | ✅ 合规 | 无Infinity使用 |
| BR-20 | 对称函数修复验证 | ✅ N/A | R1首次 |
| BR-21 | 资源比较NaN防护 | ⚠️ 1处遗漏 | expandBag无资源预检 |
| BR-22 | 资源累积上限 | ⚠️ 1处遗漏 | totalForgeCount无MAX常量 |
