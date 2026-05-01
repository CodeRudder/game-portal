# Tech 模块 Round-1 流程树

> 版本: v1.0 | 日期: 2026-05-01
> 源码路径: `src/games/three-kingdoms/engine/tech/`
> Builder规则: v1.7 | P0模式库: v1.6 (21个模式)

---

## 模块概览

| 子系统 | 文件 | 行数 | 公开API数 | 状态 |
|--------|------|------|-----------|------|
| TechTreeSystem | TechTreeSystem.ts | 420 | 18 | ⚠️ 关键发现 |
| TechResearchSystem | TechResearchSystem.ts | 361 | 12 | ⚠️ 关键发现 |
| TechPointSystem | TechPointSystem.ts | 200 | 14 | ⚠️ 关键发现 |
| TechEffectSystem | TechEffectSystem.ts | 338 | 16 | ⚠️ NaN传播 |
| TechEffectApplier | TechEffectApplier.ts | 341 | 12 | ⚠️ NaN传播 |
| FusionTechSystem | FusionTechSystem.ts | 392 | 14 | 🔴 序列化缺失 |
| TechLinkSystem | TechLinkSystem.ts | 466 | 18 | 🔴 序列化缺失 |
| TechOfflineSystem | TechOfflineSystem.ts | 457 | 12 | 🔴 序列化缺失 |
| TechDetailProvider | TechDetailProvider.ts | 289 | 4 | ⚠️ 纯查询 |
| tech-config | tech-config.ts | 164 | 6 | ✅ 纯数据 |
| fusion-tech.types | fusion-tech.types.ts | 270 | — | ✅ 纯类型 |

**总计**: 8个子系统, ~126个公开API分支节点

---

## 🔴 P0 关键发现

### DEF-TECH-001: 三个子系统序列化未接入 engine-save（模式7/15）

**严重度**: P0 - 数据丢失  
**影响范围**: FusionTechSystem, TechLinkSystem, TechOfflineSystem  
**规则违反**: BR-014(保存/加载覆盖扫描), BR-024(deserialize覆盖验证)

**证据**:
- `engine-save.ts` L133-141: 仅序列化 `techTree`, `techResearch`, `techPoint`
- `engine-save.ts` L451-461: 仅反序列化上述三个子系统
- `FusionTechSystem.serialize()` L366-378: 存在但从未被调用
- `TechOfflineSystem.serialize()` L存在: 存在但从未被调用
- `TechLinkSystem`: 无serialize/deserialize方法，`completedTechIds`状态不持久化

**后果**:
1. 玩家完成融合科技后存档→读档，融合科技进度丢失
2. 联动效果注册表不持久化（默认配置可恢复，但动态注册丢失）
3. 离线研究快照不持久化→离线期间研究进度计算错误

**修复建议**: 
- SaveContext 添加 `fusionSystem`, `linkSystem`, `offlineSystem`
- buildSaveData 添加序列化调用
- applySaveData 添加反序列化调用
- GameSaveData 类型扩展

---

## 子系统流程树

### 1. TechTreeSystem（科技树系统）

#### 1.1 节点查询

| # | API | 分支 | 状态 | P0模式扫描 |
|---|-----|------|------|-----------|
| 1.1.1 | `getNodeDef(id)` | id不存在→undefined | ✅ covered | P1: null返回已处理 |
| 1.1.2 | `getNodeState(id)` | id不存在→undefined | ✅ covered | P1: null返回已处理 |
| 1.1.3 | `getAllNodeStates()` | 返回浅拷贝 | ✅ covered | P4: 浅拷贝但值不可变 |
| 1.1.4 | `getPathNodes(path)` | 无效path→空数组 | ✅ covered | P1: 安全 |
| 1.1.5 | `getTierNodes(path, tier)` | 无效参数→空数组 | ✅ covered | P1: 安全 |
| 1.1.6 | `getEdges()` | 返回静态数据 | ✅ covered | 安全 |
| 1.1.7 | `getAllNodeDefs()` | 返回静态数据 | ✅ covered | 安全 |

#### 1.2 状态变更

| # | API | 分支 | 状态 | P0模式扫描 |
|---|-----|------|------|-----------|
| 1.2.1 | `setResearching(id, start, end)` | id不存在→静默return | ⚠️ uncovered | **P9(NaN)**: start/end为NaN时写入NaN→getResearchProgress返回NaN |
| 1.2.2 | `completeNode(id)` | id不存在→静默return | ✅ covered | 安全 |
| 1.2.3 | `completeNode(id)` | 有mutexGroup→锁定同组 | ✅ covered | 安全 |
| 1.2.4 | `completeNode(id)` | 无mutexGroup→仅标记完成 | ✅ covered | 安全 |
| 1.2.5 | `cancelResearch(id)` | id不存在→静默return | ✅ covered | 安全 |
| 1.2.6 | `cancelResearch(id)` | status≠researching→静默return | ✅ covered | 安全 |

#### 1.3 前置依赖检查

| # | API | 分支 | 状态 | P0模式扫描 |
|---|-----|------|------|-----------|
| 1.3.1 | `arePrerequisitesMet(id)` | id不存在→false | ✅ covered | 安全 |
| 1.3.2 | `arePrerequisitesMet(id)` | 全部完成→true | ✅ covered | 安全 |
| 1.3.3 | `arePrerequisitesMet(id)` | 部分未完成→false | ✅ covered | 安全 |
| 1.3.4 | `getUnmetPrerequisites(id)` | id不存在→空数组 | ✅ covered | 安全 |

#### 1.4 互斥分支

| # | API | 分支 | 状态 | P0模式扫描 |
|---|-----|------|------|-----------|
| 1.4.1 | `isMutexLocked(id)` | 无mutexGroup→false | ✅ covered | 安全 |
| 1.4.2 | `isMutexLocked(id)` | 同组已选其他→true | ✅ covered | 安全 |
| 1.4.3 | `isMutexLocked(id)` | 同组选了自己→false | ✅ covered | 安全 |
| 1.4.4 | `getMutexAlternatives(id)` | 无mutexGroup→空数组 | ✅ covered | 安全 |
| 1.4.5 | `lockMutexAlternatives()` | researching状态不锁定 | ⚠️ uncovered | **P5(竞态)**: 研究中的互斥替代节点不会被锁定，可能导致同时完成 |

#### 1.5 可用性检查

| # | API | 分支 | 状态 | P0模式扫描 |
|---|-----|------|------|-----------|
| 1.5.1 | `canResearch(id)` | 不存在→false | ✅ covered | 安全 |
| 1.5.2 | `canResearch(id)` | 已完成→false | ✅ covered | 安全 |
| 1.5.3 | `canResearch(id)` | 研究中→false | ✅ covered | 安全 |
| 1.5.4 | `canResearch(id)` | 互斥锁定→false | ✅ covered | 安全 |
| 1.5.5 | `canResearch(id)` | 前置未满足→false | ✅ covered | 安全 |
| 1.5.6 | `canResearch(id)` | 全部满足→true | ✅ covered | 安全 |

#### 1.6 效果汇总

| # | API | 分支 | 状态 | P0模式扫描 |
|---|-----|------|------|-----------|
| 1.6.1 | `getAllCompletedEffects()` | 无完成→空数组 | ✅ covered | 安全 |
| 1.6.2 | `getEffectValue(type, target)` | 无匹配→0 | ✅ covered | 安全 |
| 1.6.3 | `getEffectValue(type, target)` | target='all'匹配 | ✅ covered | 安全 |
| 1.6.4 | `getTechBonusMultiplier()` | bonus=0→返回0 | ⚠️ uncovered | **P2(NaN)**: 如果effect.value为NaN，total累加NaN→bonus/100=NaN→乘数为NaN |

#### 1.7 序列化

| # | API | 分支 | 状态 | P0模式扫描 |
|---|-----|------|------|-----------|
| 1.7.1 | `serialize()` | 正常序列化 | ✅ covered | 安全 |
| 1.7.2 | `deserialize(data)` | data.completedTechIds含无效ID→跳过 | ✅ covered | 安全 |
| 1.7.3 | `deserialize(data)` | data.chosenMutexNodes为null | ⚠️ uncovered | **P1(null)**: L352 `if (data.chosenMutexNodes)` 有防护但未测试null |
| 1.7.4 | `deserialize(data)` | data=null/undefined | 🔴 uncovered | **P1(null)**: 无null防护，直接访问data.completedTechIds崩溃 |
| 1.7.5 | `deserialize(data)` | researchQueue中的节点未恢复researching状态 | ⚠️ uncovered | **P7(数据丢失)**: deserialize只恢复completed，不恢复researching状态 |

---

### 2. TechResearchSystem（研究系统）

#### 2.1 研究流程

| # | API | 分支 | 状态 | P0模式扫描 |
|---|-----|------|------|-----------|
| 2.1.1 | `startResearch(techId)` | 节点不存在→失败 | ✅ covered | 安全 |
| 2.1.2 | `startResearch(techId)` | canResearch=false→失败 | ✅ covered | 安全 |
| 2.1.3 | `startResearch(techId)` | 队列已满→失败 | ✅ covered | 安全 |
| 2.1.4 | `startResearch(techId)` | 已在队列中→失败 | ✅ covered | 安全 |
| 2.1.5 | `startResearch(techId)` | 科技点不足→失败 | ✅ covered | 安全 |
| 2.1.6 | `startResearch(techId)` | 正常启动 | ✅ covered | 安全 |
| 2.1.7 | `startResearch(techId)` | speedMultiplier=0 | 🔴 uncovered | **P2(除零)**: `actualTime = def.researchTime / 0` → Infinity |
| 2.1.8 | `startResearch(techId)` | speedMultiplier=NaN | 🔴 uncovered | **P9(NaN)**: `actualTime = def.researchTime / NaN` → NaN→endTime=NaN |

#### 2.2 取消研究

| # | API | 分支 | 状态 | P0模式扫描 |
|---|-----|------|------|-----------|
| 2.2.1 | `cancelResearch(techId)` | 不在队列中→失败 | ✅ covered | 安全 |
| 2.2.2 | `cancelResearch(techId)` | 正常取消+返还 | ✅ covered | 安全 |
| 2.2.3 | `cancelResearch(techId)` | def不存在→refundPoints=0 | ⚠️ uncovered | **P3(负值)**: refund(0)不造成伤害但语义不清 |

#### 2.3 研究进度

| # | API | 分支 | 状态 | P0模式扫描 |
|---|-----|------|------|-----------|
| 2.3.1 | `getResearchProgress(techId)` | 不在队列→0 | ✅ covered | 安全 |
| 2.3.2 | `getResearchProgress(techId)` | startTime=endTime(除零) | 🔴 uncovered | **P2(除零)**: `elapsed/total` 当total=0→NaN/Infinity |
| 2.3.3 | `getResearchProgress(techId)` | NaN时间戳 | 🔴 uncovered | **P9(NaN)**: NaN传播到进度值 |
| 2.3.4 | `getRemainingTime(techId)` | 不在队列→0 | ✅ covered | 安全 |
| 2.3.5 | `getRemainingTime(techId)` | 已过期→0 | ✅ covered | 安全 |

#### 2.4 加速机制

| # | API | 分支 | 状态 | P0模式扫描 |
|---|-----|------|------|-----------|
| 2.4.1 | `speedUp(techId, 'mandate', amount)` | 不在队列→失败 | ✅ covered | 安全 |
| 2.4.2 | `speedUp(techId, 'mandate', amount)` | 天命不足→失败 | ✅ covered | 安全 |
| 2.4.3 | `speedUp(techId, 'mandate', amount)` | spendMandate失败→失败 | ✅ covered | 安全 |
| 2.4.4 | `speedUp(techId, 'mandate', amount)` | amount=0 | ⚠️ uncovered | **P3(零值)**: timeReduced=0，无效果但成功执行 |
| 2.4.5 | `speedUp(techId, 'mandate', amount)` | amount=NaN | 🔴 uncovered | **P9(NaN)**: `NaN * MANDATE_SPEEDUP_SECONDS_PER_POINT * 1000` → NaN |
| 2.4.6 | `speedUp(techId, 'mandate', amount)` | amount=-1 | 🔴 uncovered | **P3(负值)**: timeReduced为负→endTime增加（反而延长研究时间） |
| 2.4.7 | `speedUp(techId, 'ingot', amount)` | 正常加速 | ✅ covered | 安全 |
| 2.4.8 | `speedUp(techId, 'ingot', amount)` | remaining≤0→已完成 | ✅ covered | 安全 |
| 2.4.9 | `speedUp(techId, unknown, amount)` | 未知方式→失败 | ✅ covered | 安全 |
| 2.4.10 | `speedUp()` | newEndTime < now | ⚠️ uncovered | **P5(竞态)**: `Math.max(newEndTime, now)` 防护了但未测试 |

#### 2.5 序列化

| # | API | 分支 | 状态 | P0模式扫描 |
|---|-----|------|------|-----------|
| 2.5.1 | `serialize()` | 正常序列化 | ✅ covered | 安全 |
| 2.5.2 | `deserialize(data)` | researchQueue存在→恢复完整队列 | ✅ covered | 安全 |
| 2.5.3 | `deserialize(data)` | researchQueue不存在→兼容旧存档 | ✅ covered | 安全 |
| 2.5.4 | `deserialize(data)` | data=null/undefined | 🔴 uncovered | **P1(null)**: 无null防护 |
| 2.5.5 | `deserialize(data)` | activeResearch=null | ✅ covered | 安全 |

---

### 3. TechPointSystem（科技点系统）

#### 3.1 科技点产出

| # | API | 分支 | 状态 | P0模式扫描 |
|---|-----|------|------|-----------|
| 3.1.1 | `update(dt)` | academyLevel≤0→跳过 | ✅ covered | 安全 |
| 3.1.2 | `update(dt)` | dt=NaN | 🔴 uncovered | **P9(NaN)**: `production * NaN` → current=NaN→所有后续操作NaN |
| 3.1.3 | `update(dt)` | dt=Infinity | 🔴 uncovered | **P2(溢出)**: `production * Infinity` → current=Infinity |
| 3.1.4 | `update(dt)` | dt=-1 | ⚠️ uncovered | **P3(负值)**: current减少（但totalEarned也减少，不一致） |
| 3.1.5 | `syncAcademyLevel(level)` | level=NaN | 🔴 uncovered | **P9(NaN)**: getTechPointProduction(NaN)返回0（安全），但academyLevel被设为NaN |
| 3.1.6 | `getProductionRate()` | academyLevel=0→0 | ✅ covered | 安全 |

#### 3.2 科技点消耗

| # | API | 分支 | 状态 | P0模式扫描 |
|---|-----|------|------|-----------|
| 3.2.1 | `canAfford(points)` | points=NaN | 🔴 uncovered | **P21(NaN比较)**: `NaN >= points` → false→无法消费，但current可能已为NaN |
| 3.2.2 | `spend(points)` | points=NaN | 🔴 uncovered | **P9(NaN)**: `current -= NaN` → current=NaN→永久无法消费 |
| 3.2.3 | `spend(points)` | points=Infinity | 🔴 uncovered | **P2(溢出)**: current=-Infinity→Math.max(0,-Infinity)=0（被防护） |
| 3.2.4 | `spend(points)` | points=-100 | ⚠️ uncovered | **P3(负值)**: current增加100（spend变成earn） |
| 3.2.5 | `refund(points)` | points=NaN | 🔴 uncovered | **P9(NaN)**: 同spend |
| 3.2.6 | `refund(points)` | points=-100 | ⚠️ uncovered | **P3(负值)**: current减少100（refund变成spend） |
| 3.2.7 | `trySpend(points)` | points=0 | ⚠️ uncovered | canAfford(0)=true→spend(0)→无变化但totalSpent增加0 |
| 3.2.8 | `trySpend(points)` | points=-10 | 🔴 uncovered | **P21(NaN比较)+P3**: canAfford(-10)=true(current>=-10永远true)→spend(-10)→current增加10 |

#### 3.3 铜钱兑换

| # | API | 分支 | 状态 | P0模式扫描 |
|---|-----|------|------|-----------|
| 3.3.1 | `canExchange(academyLevel)` | level<5→不可兑换 | ✅ covered | 安全 |
| 3.3.2 | `canExchange(academyLevel)` | level≥5→可兑换 | ✅ covered | 安全 |
| 3.3.3 | `exchangeGoldForTechPoints(gold, level)` | goldAmount=0→失败 | ✅ covered | 安全 |
| 3.3.4 | `exchangeGoldForTechPoints(gold, level)` | goldAmount=NaN | 🔴 uncovered | **P9(NaN)**: `NaN/100` → pointsGained=NaN→current=NaN |
| 3.3.5 | `exchangeGoldForTechPoints(gold, level)` | goldAmount=-100 | 🔴 uncovered | **P3(负值)**: `goldAmount<=0` 检查防护了 |
| 3.3.6 | `exchangeGoldForTechPoints(gold, level)` | goldAmount=Infinity | 🔴 uncovered | **P2(溢出)**: pointsGained=Infinity→current=Infinity |

#### 3.4 研究速度加成

| # | API | 分支 | 状态 | P0模式扫描 |
|---|-----|------|------|-----------|
| 3.4.1 | `syncResearchSpeedBonus(bonus)` | bonus=NaN | 🔴 uncovered | **P9(NaN)**: researchSpeedBonus=NaN→getResearchSpeedMultiplier返回NaN |
| 3.4.2 | `syncResearchSpeedBonus(bonus)` | bonus=-100 | 🔴 uncovered | **P3(负值)**: multiplier=1+(-100)/100=0→除零 |
| 3.4.3 | `syncResearchSpeedBonus(bonus)` | bonus=Infinity | 🔴 uncovered | **P18(Infinity)**: multiplier=Infinity→研究时间=0 |

#### 3.5 序列化

| # | API | 分支 | 状态 | P0模式扫描 |
|---|-----|------|------|-----------|
| 3.5.1 | `serialize()` | 正常 | ✅ covered | 安全 |
| 3.5.2 | `deserialize(data)` | data.techPoints=null | 🔴 uncovered | **P1(null)**: L194 `data.techPoints` 无null防护→崩溃 |
| 3.5.3 | `deserialize(data)` | data.techPoints.current=NaN | ⚠️ uncovered | **P9(NaN)**: 直接赋值NaN→后续全部NaN |

---

### 4. TechEffectSystem（效果系统）

#### 4.1 缓存管理

| # | API | 分支 | 状态 | P0模式扫描 |
|---|-----|------|------|-----------|
| 4.1.1 | `setTechTree(techTree)` | null注入 | ⚠️ uncovered | **P12(注入)**: techTree=null→ensureCache时rebuildCache跳过 |
| 4.1.2 | `invalidateCache()` | 科技完成时调用 | ✅ covered | 安全 |
| 4.1.3 | `ensureCache()` | techTree=null | ✅ covered | 安全（rebuildCache中有null检查） |

#### 4.2 效果查询

| # | API | 分支 | 状态 | P0模式扫描 |
|---|-----|------|------|-----------|
| 4.2.1 | `getEffectBonus(category, stat)` | 无匹配→0 | ✅ covered | 安全 |
| 4.2.2 | `getEffectBonus(category, stat)` | 无效category | ⚠️ uncovered | TypeScript编译防护但运行时可能undefined |
| 4.2.3 | `getGlobalBonus(stat)` | 无匹配→0 | ✅ covered | 安全 |
| 4.2.4 | `getEffectValueByTarget(type, target)` | techTree=null→0 | ✅ covered | 安全 |
| 4.2.5 | `getPathBonuses(category)` | 正常 | ✅ covered | 安全 |
| 4.2.6 | `getAllBonuses()` | 正常 | ✅ covered | 安全 |

#### 4.3 乘数接口

| # | API | 分支 | 状态 | P0模式扫描 |
|---|-----|------|------|-----------|
| 4.3.1 | `getAttackMultiplier(target)` | bonus=NaN | 🔴 uncovered | **P16(NaN)**: `1 + NaN/100` → NaN→攻击力变NaN |
| 4.3.2 | `getDefenseMultiplier(target)` | bonus=NaN | 🔴 uncovered | **P19(对称)**: 同attack |
| 4.3.3 | `getProductionMultiplier(target)` | bonus=NaN | 🔴 uncovered | **P16(NaN)**: 同上 |
| 4.3.4 | `getExpMultiplier()` | bonus=NaN | 🔴 uncovered | **P16(NaN)**: 同上 |
| 4.3.5 | `getResearchSpeedMultiplier()` | bonus=NaN | 🔴 uncovered | **P16(NaN)**: 同上 |

#### 4.4 缓存重建

| # | API | 分支 | 状态 | P0模式扫描 |
|---|-----|------|------|-----------|
| 4.4.1 | `rebuildCache()` | effect.value=NaN | 🔴 uncovered | **P9(NaN)**: `currentVal + NaN` → 缓存值NaN→所有查询返回NaN |
| 4.4.2 | `findNodeDefByEffect()` | 多个节点有相同effect | ⚠️ uncovered | 返回第一个匹配，可能归属错误路线 |

---

### 5. TechEffectApplier（效果应用器）

#### 5.1 战斗加成

| # | API | 分支 | 状态 | P0模式扫描 |
|---|-----|------|------|-----------|
| 5.1.1 | `getBattleBonuses(target)` | techEffect=null→默认值 | ✅ covered | 安全 |
| 5.1.2 | `getBattleBonuses(target)` | bonus值为NaN | 🔴 uncovered | **P16(NaN)**: `1 + NaN/100` → multiplier=NaN→伤害NaN |
| 5.1.3 | `applyAttackBonus(base, target)` | baseAttack=NaN | 🔴 uncovered | **P16(NaN)**: `Math.floor(NaN * multiplier)` → NaN |
| 5.1.4 | `applyAttackBonus(base, target)` | baseAttack=-100 | ⚠️ uncovered | **P3(负值)**: `Math.floor(-100 * 1.1)` → -110（负攻击力） |
| 5.1.5 | `applyDefenseBonus(base, target)` | baseDefense=NaN | 🔴 uncovered | **P19(对称)**: 同applyAttackBonus |
| 5.1.6 | `applyDefenseBonus(base, target)` | baseDefense=-100 | ⚠️ uncovered | **P19(对称)**: 同applyAttackBonus |
| 5.1.7 | `applyDamageBonus(base, target)` | baseDamage=NaN | 🔴 uncovered | **P16(NaN)**: 同上 |

#### 5.2 资源加成

| # | API | 分支 | 状态 | P0模式扫描 |
|---|-----|------|------|-----------|
| 5.2.1 | `getResourceBonuses()` | techEffect=null→默认值 | ✅ covered | 安全 |
| 5.2.2 | `getResourceBonuses()` | productionBonus=NaN | 🔴 uncovered | **P16(NaN)**: multiplier=NaN→资源产出NaN |
| 5.2.3 | `composeResourceBonuses()` | avgProdBonus=NaN | 🔴 uncovered | **P16(NaN)**: tech字段=NaN→资源系统收到NaN加成 |
| 5.2.4 | `getProductionMultiplier(rt)` | 正常 | ✅ covered | 安全 |
| 5.2.5 | `getStorageMultiplier(rt)` | 正常 | ✅ covered | 安全 |

#### 5.3 文化加成

| # | API | 分支 | 状态 | P0模式扫描 |
|---|-----|------|------|-----------|
| 5.3.1 | `getCultureBonuses()` | techEffect=null→默认值 | ✅ covered | 安全 |
| 5.3.2 | `applyExpBonus(baseExp)` | baseExp=NaN | 🔴 uncovered | **P16(NaN)**: `Math.floor(NaN * multiplier)` → NaN |
| 5.3.3 | `applyResearchSpeedBonus(baseTime)` | multiplier=0 | 🔴 uncovered | **P2(除零)**: `baseTime / 0` → Infinity |
| 5.3.4 | `applyRecruitDiscount(baseCost)` | discount>100 | ⚠️ uncovered | **P3(负值)**: `1 - discount/100` 为负→Math.max(0,负值)=0（防护了） |
| 5.3.5 | `applyRecruitDiscount(baseCost)` | baseCost=NaN | 🔴 uncovered | **P16(NaN)**: `Math.floor(NaN * (1-discount))` → NaN |

---

### 6. FusionTechSystem（融合科技系统）

#### 6.1 依赖注入

| # | API | 分支 | 状态 | P0模式扫描 |
|---|-----|------|------|-----------|
| 6.1.1 | `setTechTree(techTree)` | null注入 | ⚠️ uncovered | **P12(注入)**: techTree=null→arePrerequisitesMet返回false（安全） |
| 6.1.2 | `setLinkSystem(linkSystem)` | null注入 | ⚠️ uncovered | **P12(注入)**: linkSystem=null→syncFusionLinksToLinkSystem中null?.方法（安全） |

#### 6.2 前置条件检查

| # | API | 分支 | 状态 | P0模式扫描 |
|---|-----|------|------|-----------|
| 6.2.1 | `arePrerequisitesMet(id)` | id不存在→false | ✅ covered | 安全 |
| 6.2.2 | `arePrerequisitesMet(id)` | techTree=null→false | ✅ covered | 安全 |
| 6.2.3 | `arePrerequisitesMet(id)` | pathA完成+pathB未完成→false | ✅ covered | 安全 |
| 6.2.4 | `arePrerequisitesMet(id)` | 双路径完成→true | ✅ covered | 安全 |
| 6.2.5 | `checkPrerequisitesDetailed(id)` | id不存在 | ✅ covered | 安全 |
| 6.2.6 | `getUnmetPrerequisites(id)` | id不存在→{pathA:false,pathB:false} | ✅ covered | 安全 |

#### 6.3 状态变更

| # | API | 分支 | 状态 | P0模式扫描 |
|---|-----|------|------|-----------|
| 6.3.1 | `setResearching(id, start, end)` | id不存在→静默return | ⚠️ uncovered | **P9(NaN)**: start/end为NaN |
| 6.3.2 | `completeFusionNode(id)` | id不存在→静默return | ✅ covered | 安全 |
| 6.3.3 | `completeFusionNode(id)` | 正常完成+联动同步 | ✅ covered | 安全 |
| 6.3.4 | `cancelResearch(id)` | status≠researching→静默return | ✅ covered | 安全 |

#### 6.4 可用性检查

| # | API | 分支 | 状态 | P0模式扫描 |
|---|-----|------|------|-----------|
| 6.4.1 | `canResearch(id)` | 不存在→false | ✅ covered | 安全 |
| 6.4.2 | `canResearch(id)` | 已完成→false | ✅ covered | 安全 |
| 6.4.3 | `canResearch(id)` | 研究中→false | ✅ covered | 安全 |
| 6.4.4 | `canResearch(id)` | 前置未满足→false | ✅ covered | 安全 |
| 6.4.5 | `canResearch(id)` | 全部满足→true | ✅ covered | 安全 |

#### 6.5 联动效果

| # | API | 分支 | 状态 | P0模式扫描 |
|---|-----|------|------|-----------|
| 6.5.1 | `getFusionLinkEffects(id)` | id不存在→空数组 | ✅ covered | 安全 |
| 6.5.2 | `getActiveFusionLinkEffects()` | 无完成→空数组 | ✅ covered | 安全 |
| 6.5.3 | `getFusionLinkBonus(target, sub)` | 无匹配→0 | ✅ covered | 安全 |

#### 6.6 序列化 🔴

| # | API | 分支 | 状态 | P0模式扫描 |
|---|-----|------|------|-----------|
| 6.6.1 | `serialize()` | 正常 | ✅ covered | 安全（但**从未被engine-save调用**） |
| 6.6.2 | `deserialize(data)` | data=null | 🔴 uncovered | **P1(null)**: 无null防护 |
| 6.6.3 | `deserialize(data)` | data.completedFusionIds含无效ID | ✅ covered | 安全（跳过无效ID） |
| 6.6.4 | **engine-save集成** | **完全缺失** | 🔴 uncovered | **DEF-TECH-001**: 序列化存在但未被调用 |

---

### 7. TechLinkSystem（联动系统）

#### 7.1 联动注册

| # | API | 分支 | 状态 | P0模式扫描 |
|---|-----|------|------|-----------|
| 7.1.1 | `registerLink(link)` | 正常注册 | ✅ covered | 安全 |
| 7.1.2 | `registerLink(link)` | link.value=NaN | 🔴 uncovered | **P9(NaN)**: NaN存入→查询返回NaN |
| 7.1.3 | `registerLink(link)` | link.value=-10 | ⚠️ uncovered | **P3(负值)**: 负值加成→减少产出 |
| 7.1.4 | `registerLinks(links)` | 空数组→无操作 | ✅ covered | 安全 |
| 7.1.5 | `unregisterLink(id)` | id不存在→false | ✅ covered | 安全 |

#### 7.2 科技完成同步

| # | API | 分支 | 状态 | P0模式扫描 |
|---|-----|------|------|-----------|
| 7.2.1 | `syncCompletedTechIds(ids)` | 正常同步 | ✅ covered | 安全 |
| 7.2.2 | `syncCompletedTechIds(ids)` | ids含无效ID | ⚠️ uncovered | 无效ID存入Set但查询时无匹配link→无影响 |
| 7.2.3 | `addCompletedTech(techId)` | 重复添加→跳过 | ✅ covered | 安全 |
| 7.2.4 | `removeCompletedTech(techId)` | 不存在→无操作 | ✅ covered | 安全 |
| 7.2.5 | **engine-save集成** | **completedTechIds不持久化** | 🔴 uncovered | **DEF-TECH-001**: 读档后联动全部失效 |

#### 7.3 建筑联动

| # | API | 分支 | 状态 | P0模式扫描 |
|---|-----|------|------|-----------|
| 7.3.1 | `getBuildingLinkBonus(type)` | 无匹配→0 | ✅ covered | 安全 |
| 7.3.2 | `getBuildingLinkBonus(type)` | 多个link叠加 | ✅ covered | 安全 |
| 7.3.3 | `getBuildingLinkBonus(type)` | unlockFeature=true | ✅ covered | 安全 |
| 7.3.4 | `getAllBuildingBonuses()` | 正常 | ✅ covered | 安全 |

#### 7.4 武将联动

| # | API | 分支 | 状态 | P0模式扫描 |
|---|-----|------|------|-----------|
| 7.4.1 | `getHeroLinkBonus(skillId)` | 无匹配→0 | ✅ covered | 安全 |
| 7.4.2 | `getHeroLinkBonus(skillId)` | unlockSkill=true | ✅ covered | 安全 |
| 7.4.3 | `getAllHeroBonuses()` | 正常 | ✅ covered | 安全 |

#### 7.5 资源联动

| # | API | 分支 | 状态 | P0模式扫描 |
|---|-----|------|------|-----------|
| 7.5.1 | `getResourceLinkBonus(type)` | 无匹配→全0 | ✅ covered | 安全 |
| 7.5.2 | `getResourceLinkBonus(type)` | _storage后缀匹配 | ✅ covered | 安全 |
| 7.5.3 | `getResourceLinkBonus(type)` | _trade后缀匹配 | ✅ covered | 安全 |
| 7.5.4 | `getAllResourceBonuses()` | 正常 | ✅ covered | 安全 |

#### 7.6 统一查询

| # | API | 分支 | 状态 | P0模式扫描 |
|---|-----|------|------|-----------|
| 7.6.1 | `getTechBonus(system, stat)` | 无效system→0 | ✅ covered | 安全 |
| 7.6.2 | `getTechBonusMultiplier(system, stat)` | bonus=NaN | 🔴 uncovered | **P16(NaN)**: `1 + NaN/100` → NaN |
| 7.6.3 | `getTechLinkSnapshot(techId)` | 正常 | ✅ covered | 安全 |
| 7.6.4 | `getAllActiveBonuses()` | 正常 | ✅ covered | 安全 |

#### 7.7 序列化 🔴

| # | API | 分支 | 状态 | P0模式扫描 |
|---|-----|------|------|-----------|
| 7.7.1 | **serialize/deserialize** | **不存在** | 🔴 uncovered | **DEF-TECH-001**: 无序列化方法，completedTechIds不持久化 |
| 7.7.2 | **engine-save集成** | **完全缺失** | 🔴 uncovered | **DEF-TECH-001**: 读档后联动全部失效 |

---

### 8. TechOfflineSystem（离线研究系统）

#### 8.1 离线/上线生命周期

| # | API | 分支 | 状态 | P0模式扫描 |
|---|-----|------|------|-----------|
| 8.1.1 | `onGoOffline(timestamp)` | 无活跃研究→空快照 | ✅ covered | 安全 |
| 8.1.2 | `onGoOffline(timestamp)` | 有活跃研究→快照 | ✅ covered | 安全 |
| 8.1.3 | `onGoOffline(timestamp)` | timestamp=NaN | 🔴 uncovered | **P9(NaN)**: offlineStartTime=NaN→后续计算全NaN |
| 8.1.4 | `onGoOffline(timestamp)` | timestamp=0 | ⚠️ uncovered | epoch时间，功能正常但语义奇怪 |
| 8.1.5 | `onComeBackOnline(timestamp)` | 无离线记录→null | ✅ covered | 安全 |
| 8.1.6 | `onComeBackOnline(timestamp)` | 空快照→null | ✅ covered | 安全 |
| 8.1.7 | `onComeBackOnline(timestamp)` | offlineSeconds≤0→null | ✅ covered | 安全 |
| 8.1.8 | `onComeBackOnline(timestamp)` | 正常回归 | ✅ covered | 安全 |
| 8.1.9 | `onComeBackOnline(timestamp)` | timestamp < offlineStartTime | 🔴 uncovered | **P3(负值)**: offlineMs为负→Math.max(0,负值)=0→返回null（安全） |
| 8.1.10 | `onComeBackOnline(timestamp)` | 超过MAX_OFFLINE_RESEARCH_SECONDS | ✅ covered | 安全（封顶） |

#### 8.2 离线进度计算

| # | API | 分支 | 状态 | P0模式扫描 |
|---|-----|------|------|-----------|
| 8.2.1 | `calculateEffectiveSeconds(offlineSeconds)` | 正常分段计算 | ✅ covered | 安全 |
| 8.2.2 | `calculateEffectiveSeconds(offlineSeconds)` | offlineSeconds=0→0 | ✅ covered | 安全 |
| 8.2.3 | `calculateEffectiveSeconds(offlineSeconds)` | offlineSeconds=NaN | 🔴 uncovered | **P9(NaN)**: Math.min(NaN,...)→NaN→后续全NaN |
| 8.2.4 | `calculateOverallEfficiency(offlineSeconds)` | 正常 | ✅ covered | 安全 |
| 8.2.5 | `calculateOfflineProgress(snapshot, seconds)` | 正常 | ✅ covered | 安全 |
| 8.2.6 | `calculateOfflineProgress(snapshot, seconds)` | totalDurationMs≤0→跳过 | ✅ covered | 安全 |
| 8.2.7 | `calculateOfflineProgress(snapshot, seconds)` | effectiveSeconds=NaN | 🔴 uncovered | **P9(NaN)**: progressDelta=NaN→progressAfter=NaN |

#### 8.3 效率曲线

| # | API | 分支 | 状态 | P0模式扫描 |
|---|-----|------|------|-----------|
| 8.3.1 | `generateEfficiencyCurve(seconds)` | 正常 | ✅ covered | 安全 |
| 8.3.2 | `generateEfficiencyCurve(seconds)` | seconds=0 | ✅ covered | 安全 |
| 8.3.3 | `getEfficiencyAtTime(seconds)` | seconds超过72h | ✅ covered | 安全（返回最后一段效率） |

#### 8.4 进度应用

| # | API | 分支 | 状态 | P0模式扫描 |
|---|-----|------|------|-----------|
| 8.4.1 | `applyOfflineProgress(list)` | 科技完成→completeNode | ✅ covered | 安全 |
| 8.4.2 | `applyOfflineProgress(list)` | 科技未完成→无操作 | ⚠️ uncovered | **P7(数据丢失)**: 未完成的科技进度不更新endTime→进度丢失 |

#### 8.5 序列化 🔴

| # | API | 分支 | 状态 | P0模式扫描 |
|---|-----|------|------|-----------|
| 8.5.1 | `serialize()` | 正常 | ✅ covered | 安全（但**从未被engine-save调用**） |
| 8.5.2 | `deserialize(data)` | data=null | 🔴 uncovered | **P1(null)**: data?.offlineStartTime有防护但researchSnapshot无 |
| 8.5.3 | `deserialize(data)` | data.researchSnapshot含无效数据 | ⚠️ uncovered | 无效slot→恢复后getQueue返回无效数据 |
| 8.5.4 | **engine-save集成** | **完全缺失** | 🔴 uncovered | **DEF-TECH-001**: 离线快照不持久化 |

---

### 9. TechDetailProvider（详情提供者）

#### 9.1 详情获取

| # | API | 分支 | 状态 | P0模式扫描 |
|---|-----|------|------|-----------|
| 9.1.1 | `getTechDetail(id)` | 普通科技 | ✅ covered | 安全 |
| 9.1.2 | `getTechDetail(id)` | 融合科技 | ✅ covered | 安全 |
| 9.1.3 | `getTechDetail(id)` | 不存在→null | ✅ covered | 安全 |
| 9.1.4 | `getTechDetails(ids)` | 空数组→空数组 | ✅ covered | 安全 |
| 9.1.5 | `getTechDetails(ids)` | 含无效ID→跳过 | ✅ covered | 安全 |

#### 9.2 依赖注入

| # | API | 分支 | 状态 | P0模式扫描 |
|---|-----|------|------|-----------|
| 9.2.1 | `setTechTree(null)` | null注入 | ⚠️ uncovered | **P12(注入)**: techTree=null→getNodeState返回undefined→status='locked' |
| 9.2.2 | `setFusionSystem(null)` | null注入 | ⚠️ uncovered | 同上 |
| 9.2.3 | `setLinkSystem(null)` | null注入 | ⚠️ uncovered | linkSystem=null→buildLinkEffects返回空数组（安全） |

---

### 10. tech-config（配置）

#### 10.1 配置查询

| # | API | 分支 | 状态 | P0模式扫描 |
|---|-----|------|------|-----------|
| 10.1.1 | `getNodesByPath(path)` | 无效path→空数组 | ✅ covered | 安全 |
| 10.1.2 | `getNodesByTier(path, tier)` | 无效tier→空数组 | ✅ covered | 安全 |
| 10.1.3 | `getMutexGroups()` | 正常 | ✅ covered | 安全 |
| 10.1.4 | `getQueueSizeForAcademyLevel(level)` | level=0→1 | ✅ covered | 安全 |
| 10.1.5 | `getQueueSizeForAcademyLevel(level)` | level=NaN | ⚠️ uncovered | **P9(NaN)**: `Number(lvl) <= NaN` 永远false→返回BASE=1（安全） |
| 10.1.6 | `getTechPointProduction(level)` | level=0→0 | ✅ covered | 安全 |
| 10.1.7 | `getTechPointProduction(level)` | level=NaN | ⚠️ uncovered | **P9(NaN)**: 同上→返回0（安全） |

#### 10.2 配置一致性

| # | 检查项 | 状态 | P0模式扫描 |
|---|--------|------|-----------|
| 10.2.1 | TECH_PATHS vs TECH_PATH_LABELS keys | ✅ covered | 一致 |
| 10.2.2 | TECH_PATHS vs TECH_PATH_COLORS keys | ✅ covered | 一致 |
| 10.2.3 | ACADEMY_QUEUE_SIZE_MAP keys连续性 | ⚠️ uncovered | 非连续：{1,5,10,15,20}→中间等级用最近低值 |
| 10.2.4 | ACADEMY_TECH_POINT_PRODUCTION keys连续性 | ✅ covered | 1-20全覆盖 |
| 10.2.5 | TechEffectType枚举 vs MILITARY_EFFECT_MAP | ⚠️ uncovered | **P17(枚举同步)**: `critRate`/`critDamage`/`damageBonus`在MILITARY_EFFECT_MAP中无对应→缓存重建时这些效果被丢弃 |
| 10.2.6 | TechEffectType枚举 vs ECONOMY_EFFECT_MAP | ⚠️ uncovered | **P17(枚举同步)**: `trade`在ECONOMY_EFFECT_MAP中无对应→trade效果被丢弃 |

---

## 跨系统链路

### C-1: TechTreeSystem → TechResearchSystem → TechPointSystem（研究流程）

| # | 链路 | 状态 | P0模式扫描 |
|---|------|------|-----------|
| C-1.1 | startResearch→canResearch→trySpend→setResearching | ✅ covered | 安全 |
| C-1.2 | checkCompleted→completeNode→refreshAllAvailability | ✅ covered | 安全 |
| C-1.3 | cancelResearch→cancelResearch(tree)→refund | ✅ covered | 安全 |
| C-1.4 | speedUp('mandate')→getMandate→spendMandate | ⚠️ uncovered | **P12(注入)**: 默认getMandate=()=>0, spendMandate=()=>false→天命加速永远失败 |

### C-2: TechTreeSystem → TechEffectSystem → TechEffectApplier（效果传递）

| # | 链路 | 状态 | P0模式扫描 |
|---|------|------|-----------|
| C-2.1 | completeNode→invalidateCache→rebuildCache | ⚠️ uncovered | **P12(注入)**: completeNode不调用invalidateCache→缓存可能过期 |
| C-2.2 | getBattleBonuses→getAttackBonus→getEffectValueByTarget | ✅ covered | 安全 |
| C-2.3 | composeResourceBonuses→getResourceBonuses→getProductionBonus | ✅ covered | 安全 |

### C-3: TechTreeSystem → FusionTechSystem（融合科技解锁）

| # | 链路 | 状态 | P0模式扫描 |
|---|------|------|-----------|
| C-3.1 | completeNode→refreshAllAvailability(fusion) | ⚠️ uncovered | **P12(注入)**: TechTreeSystem.completeNode不通知FusionTechSystem→融合科技不自动解锁 |
| C-3.2 | arePrerequisitesMet→getNodeState | ✅ covered | 安全 |

### C-4: FusionTechSystem → TechLinkSystem（联动同步）

| # | 链路 | 状态 | P0模式扫描 |
|---|------|------|-----------|
| C-4.1 | completeFusionNode→syncFusionLinksToLinkSystem | ✅ covered | 安全 |
| C-4.2 | getFusionLinkBonus→getActiveFusionLinkEffects | ✅ covered | 安全 |

### C-5: TechOfflineSystem → TechResearchSystem（离线进度）

| # | 链路 | 状态 | P0模式扫描 |
|---|------|------|-----------|
| C-5.1 | onComeBackOnline→calculateOfflineProgress→applyOfflineProgress | ✅ covered | 安全 |
| C-5.2 | applyOfflineProgress→treeSystem.completeNode | ✅ covered | 安全 |
| C-5.3 | 未完成科技的进度更新 | ⚠️ uncovered | **P7(数据丢失)**: applyOfflineProgress对未完成科技无操作→进度丢失 |

### C-6: engine-save → Tech子系统（保存/加载）

| # | 链路 | 状态 | P0模式扫描 |
|---|------|------|-----------|
| C-6.1 | buildSaveData→techTree.serialize | ✅ covered | 安全 |
| C-6.2 | buildSaveData→techResearch.serialize | ✅ covered | 安全 |
| C-6.3 | buildSaveData→techPoint.serialize | ✅ covered | 安全 |
| C-6.4 | buildSaveData→fusionSystem.serialize | 🔴 uncovered | **DEF-TECH-001**: 缺失 |
| C-6.5 | buildSaveData→offlineSystem.serialize | 🔴 uncovered | **DEF-TECH-001**: 缺失 |
| C-6.6 | applySaveData→fusionSystem.deserialize | 🔴 uncovered | **DEF-TECH-001**: 缺失 |
| C-6.7 | applySaveData→offlineSystem.deserialize | 🔴 uncovered | **DEF-TECH-001**: 缺失 |
| C-6.8 | applySaveData→linkSystem.syncCompletedTechIds | 🔴 uncovered | **DEF-TECH-001**: 缺失 |
| C-6.9 | SaveContext缺少fusion/link/offline字段 | 🔴 uncovered | **DEF-TECH-001**: 缺失 |

### C-7: TechPointSystem → TechResearchSystem（研究速度）

| # | 链路 | 状态 | P0模式扫描 |
|---|------|------|-----------|
| C-7.1 | syncResearchSpeedBonus→getResearchSpeedMultiplier→actualTime | ⚠️ uncovered | **P12(注入)**: syncResearchSpeedBonus从未被调用→multiplier永远1.0→文化科技研究速度加成不生效 |

### C-8: TechTreeSystem → TechLinkSystem（联动触发）

| # | 链路 | 状态 | P0模式扫描 |
|---|------|------|-----------|
| C-8.1 | completeNode→addCompletedTech(linkSystem) | ⚠️ uncovered | **P12(注入)**: TechTreeSystem.completeNode不调用linkSystem.addCompletedTech→联动不触发 |

---

## P0模式系统性扫描结果

| 模式 | 扫描结果 | 受影响API数 | 严重度 |
|------|----------|------------|--------|
| P1: null/undefined防护 | deserialize(null)无防护 | 4个deserialize | P0 |
| P2: 数值溢出/非法值 | dt=NaN/Infinity, 除零 | 6个API | P0 |
| P3: 负值漏洞 | spend(-x), speedUp负值 | 5个API | P1 |
| P4: 浅拷贝副作用 | getState浅拷贝但值不可变 | 0 | 安全 |
| P5: 竞态/状态泄漏 | researching互斥节点不锁定 | 1处 | P1 |
| P6: 经济漏洞 | exchangeGold无上限 | 1处 | P1 |
| P7: 数据丢失 | 3个子系统序列化未接入 | 3个子系统 | P0 |
| P8: 集成缺失 | 多处回调未注入 | 4处 | P0 |
| P9: NaN绕过 | 大量入口无NaN防护 | 15+个API | P0 |
| P10: 配置交叉 | 效果映射不完整 | 2处 | P1 |
| P11: 算法正确性 | findNodeDefByEffect可能归属错误 | 1处 | P2 |
| P12: setter/getter注入未调用 | syncResearchSpeedBonus等 | 4处 | P0 |
| P13: 修复穿透 | N/A（首次扫描） | — | — |
| P14: 资源溢出无上限 | techPoints无上限 | 1处 | P1 |
| P15: 保存/加载缺失子系统 | 3个子系统完全缺失 | 3个子系统 | P0 |
| P16: 伤害/效果NaN传播 | 所有乘数接口 | 10+个API | P0 |
| P17: 配置-枚举不同步 | MILITARY_EFFECT_MAP缺少3项 | 2处 | P1 |
| P18: Infinity序列化 | 无直接Infinity使用 | 0 | 安全 |
| P19: 对称函数修复 | attack/defense对称 | 2对 | P1 |
| P20: 无锁发奖 | N/A | 0 | — |
| P21: 资源比较NaN | canAfford(NaN) | 2处 | P0 |

---

## 统计摘要

| 指标 | 数值 |
|------|------|
| 总节点数 | 126 |
| ✅ covered | 72 (57.1%) |
| ⚠️ uncovered | 22 (17.5%) |
| 🔴 critical uncovered | 32 (25.4%) |
| P0缺陷预估 | 8-12个 |
| P1缺陷预估 | 10-15个 |
| 跨系统链路 | 9条 |
| 链路覆盖 | 4/9 (44.4%) |

## Top 10 优先修复项

| 优先级 | DEF-ID | 描述 | P0模式 |
|--------|--------|------|--------|
| 1 | DEF-TECH-001 | FusionTech/Link/Offline序列化未接入engine-save | P7/P15 |
| 2 | DEF-TECH-002 | TechPointSystem.update(dt)无NaN/Infinity防护 | P9/P2 |
| 3 | DEF-TECH-003 | TechPointSystem.spend/refund无NaN/负值防护 | P9/P3 |
| 4 | DEF-TECH-004 | TechEffectSystem乘数接口NaN传播 | P16 |
| 5 | DEF-TECH-005 | TechEffectApplier.apply*系列无NaN/负值防护 | P16/P3 |
| 6 | DEF-TECH-006 | syncResearchSpeedBonus从未被调用 | P12 |
| 7 | DEF-TECH-007 | TechTreeSystem.completeNode不通知FusionTech/LinkSystem | P12 |
| 8 | DEF-TECH-008 | 所有deserialize无null防护 | P1 |
| 9 | DEF-TECH-009 | speedUp(mandate)的amount无NaN/负值防护 | P9/P3 |
| 10 | DEF-TECH-010 | getResearchProgress除零风险 | P2 |

---

## 下一步：Round-1 Challenges

基于本流程树，Challenger应重点攻击：
1. **保存/加载路径** — 验证DEF-TECH-001是否可复现
2. **NaN注入链** — 从TechPointSystem.update(dt=NaN)开始追踪NaN传播
3. **回调注入缺失** — 验证syncResearchSpeedBonus/syncCompletedTechIds是否真的未被调用
4. **配置一致性** — 验证MILITARY_EFFECT_MAP缺失的效果是否真的被丢弃
