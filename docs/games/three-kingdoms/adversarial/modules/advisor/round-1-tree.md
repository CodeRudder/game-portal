# Advisor 流程分支树 Round 1

> Builder: TreeBuilder v1.8 | Time: 2026-05-01
> 模块: advisor | 文件: 3 | 源码: ~350行 | API: ~14

## 统计

| 子系统 | 节点数 | API数 | covered | uncovered | todo | P0 | P1 |
|--------|--------|-------|---------|-----------|------|----|----|
| AdvisorSystem | 68 | 11 | 22 | 46 | 0 | 16 | 30 |
| AdvisorTriggerDetector | 32 | 3 | 10 | 22 | 0 | 8 | 14 |
| advisor.types | 8 | 0 | 8 | 0 | 0 | 0 | 0 |
| **总计** | **108** | **14** | **40** | **68** | **0** | **24** | **44** |

## 子系统覆盖

| 子系统 | 文件 | 行数 | API数 | 节点数 | covered | uncovered | 覆盖率 |
|--------|------|------|-------|--------|---------|-----------|--------|
| AdvisorSystem | AdvisorSystem.ts | ~230 | 11 | 68 | 22 | 46 | 32.4% |
| AdvisorTriggerDetector | AdvisorTriggerDetector.ts | ~120 | 3 | 32 | 10 | 22 | 31.3% |
| advisor.types | advisor.types.ts | ~110 | 0 | 8 | 8 | 0 | 100% |
| index.ts | index.ts | ~10 | 0 | 0 | 0 | 0 | — |

## 跨系统链路覆盖

| 链路域 | 链路数 | covered | uncovered |
|--------|--------|---------|-----------|
| Advisor↔EventBus（init注册/execute发射） | 2 | 1 | 1 |
| Advisor↔Engine（ISubsystem生命周期） | 3 | 2 | 1 |
| Advisor↔Save（serialize/loadSaveData） | 2 | 1 | 1 |
| Advisor↔Calendar（dayChanged事件） | 1 | 0 | 1 |
| Advisor↔Detector（detectAllTriggers委托） | 1 | 1 | 0 |
| **总计** | **9** | **5** | **4** |

---

## 1. AdvisorSystem（AdvisorSystem.ts — ~230行）

### 1.1 构造器 & ISubsystem 适配

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| AS-001 | `constructor()` | 初始状态：allSuggestions=[], dailyCount=0, lastDailyReset=today | P1 | ✅ covered | createInitialState()隐含 |
| AS-002 | `init(deps)` | deps 注入后注册 calendar:dayChanged 事件 | P0 | ⚠️ uncovered | 无init测试 |
| AS-003 | `init(deps)` | deps.eventBus 为 null/undefined → 崩溃 | 🔴 P0 | ⚠️ uncovered | null防护 |
| AS-004 | `update(dt)` | 调用 cleanExpired() 清理过期建议 | P1 | ⚠️ uncovered | 无update测试 |
| AS-005 | `getState()` | 返回浅拷贝 state（allSuggestions引用共享） | P1 | ⚠️ uncovered | 无getState测试 |
| AS-006 | `reset()` | 重置 state 和 suggestionCounter | P1 | ⚠️ uncovered | 无reset测试 |

### 1.2 触发检测 — `detectTriggers()`

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| AS-010 | `detectTriggers(snapshot)` | 正常快照 → 返回匹配建议列表 | P1 | ✅ covered | detectAllTriggers隐含 |
| AS-011 | `detectTriggers(snapshot)` | 不修改内部状态（纯函数语义） | P1 | ⚠️ uncovered | 无副作用验证 |
| AS-012 | `detectTriggers(snapshot)` | **null防护**: snapshot=null → 崩溃（findOverflowResource访问null.resources） | 🔴 P0 | ⚠️ uncovered | null防护（规则10） |
| AS-013 | `detectTriggers(snapshot)` | **null防护**: snapshot.resources=undefined → 崩溃 | 🔴 P0 | ⚠️ uncovered | null防护 |
| AS-014 | `detectTriggers(snapshot)` | **NaN防护**: snapshot.resources.grain=NaN → NaN/cap>0.8→false→跳过（安全但误判） | P1 | ⚠️ uncovered | NaN行为 |

### 1.3 建议更新 — `updateSuggestions()`

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| AS-020 | `updateSuggestions(snapshot)` | 正常添加建议，dailyCount递增 | P0 | ✅ covered | 逻辑隐含 |
| AS-021 | `updateSuggestions(snapshot)` | 达到每日上限 ADVISOR_DAILY_LIMIT=15 → break | P0 | ⚠️ uncovered | 无上限测试 |
| AS-022 | `updateSuggestions(snapshot)` | 触发类型在冷却中 → skip | P1 | ⚠️ uncovered | 无冷却测试 |
| AS-023 | `updateSuggestions(snapshot)` | 同类型建议已存在 → skip | P1 | ⚠️ uncovered | 无重复测试 |
| AS-024 | `updateSuggestions(snapshot)` | 每日重置 → dailyCount归零 | P1 | ⚠️ uncovered | 无跨天测试 |
| AS-025 | `updateSuggestions(snapshot)` | **NaN防护**: dailyCount=NaN → NaN >= 15 为 false → 无上限 | 🔴 P0 | ⚠️ uncovered | NaN绕过（规则1） |

### 1.4 展示 — `getDisplayedSuggestions()`

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| AS-030 | `getDisplayedSuggestions()` | 返回最多 ADVISOR_MAX_DISPLAY=3 条 | P0 | ⚠️ uncovered | 无上限测试 |
| AS-031 | `getDisplayedSuggestions()` | 按优先级降序排列 | P1 | ⚠️ uncovered | 无排序测试 |
| AS-032 | `getDisplayedSuggestions()` | 清理过期建议后返回 | P1 | ⚠️ uncovered | 无过期清理测试 |
| AS-033 | `getDisplayedSuggestions()` | 空列表 → 返回 [] | P1 | ⚠️ uncovered | 无空测试 |
| AS-034 | `getDisplayedSuggestions()` | **NaN防护**: priority=NaN → 排序异常 | P1 | ⚠️ uncovered | NaN排序 |

### 1.5 展示状态 — `getDisplayState()`

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| AS-040 | `getDisplayState()` | 返回完整 AdvisorDisplayState | P1 | ⚠️ uncovered | 无此测试 |
| AS-041 | `getDisplayState()` | 冷却记录只包含未过期的 | P1 | ⚠️ uncovered | 无冷却过滤测试 |
| AS-042 | `getDisplayState()` | 调用 checkDailyReset() | P1 | ⚠️ uncovered | 无跨天测试 |

### 1.6 执行建议 — `executeSuggestion()`

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| AS-050 | `executeSuggestion(id)` | 有效id → 移除建议，emit事件，返回 {success:true} | P0 | ⚠️ uncovered | 无此测试 |
| AS-051 | `executeSuggestion(id)` | 无效id → 返回 {success:false, reason:'建议不存在'} | P0 | ⚠️ uncovered | 无此测试 |
| AS-052 | `executeSuggestion(id)` | emit 'advisor:suggestionExecuted' 事件 | P0 | ⚠️ uncovered | 无事件测试 |
| AS-053 | `executeSuggestion(id)` | **null防护**: id=null → findIndex比较 null !== s.id → -1 → 返回不存在 | P1 | ⚠️ uncovered | null防护 |
| AS-054 | `executeSuggestion(id)` | **NaN防护**: suggestion.triggerType=NaN → emit时triggerType为NaN | P1 | ⚠️ uncovered | NaN传播 |
| AS-055 | `executeSuggestion(id)` | deps未初始化 → this.deps.eventBus.emit 崩溃 | 🔴 P0 | ⚠️ uncovered | 未初始化防护 |

### 1.7 关闭建议 — `dismissSuggestion()`

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| AS-060 | `dismissSuggestion(id)` | 有效id → 移除建议，设置30min冷却 | P0 | ⚠️ uncovered | 无此测试 |
| AS-061 | `dismissSuggestion(id)` | 无效id → 返回 {success:false, reason:'建议不存在'} | P0 | ⚠️ uncovered | 无此测试 |
| AS-062 | `dismissSuggestion(id)` | 冷却时间 = Date.now() + ADVISOR_CLOSE_COOLDOWN_MS | P1 | ⚠️ uncovered | 无冷却值测试 |
| AS-063 | `dismissSuggestion(id)` | **NaN防护**: cooldownUntil=NaN → isInCooldown永远false | 🔴 P0 | ⚠️ uncovered | NaN传播 |

### 1.8 冷却检查 — `isInCooldown()`

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| AS-070 | `isInCooldown(type)` | 有冷却且未过期 → true | P1 | ⚠️ uncovered | 无此测试 |
| AS-071 | `isInCooldown(type)` | 无冷却记录 → false | P1 | ⚠️ uncovered | 无此测试 |
| AS-072 | `isInCooldown(type)` | 冷却已过期 → false | P1 | ⚠️ uncovered | 无此测试 |
| AS-073 | `isInCooldown(type)` | **NaN防护**: cooldownEnd=NaN → Date.now() < NaN 为 false → 无冷却 | 🔴 P0 | ⚠️ uncovered | NaN绕过 |

### 1.9 序列化 — `serialize()` / `loadSaveData()`

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| AS-080 | `serialize()` | 返回 AdvisorSaveData（version/cooldowns/dailyCount/lastDailyReset） | P0 | ⚠️ uncovered | 无此测试 |
| AS-081 | `serialize()` | 冷却记录只包含未过期的 | P1 | ⚠️ uncovered | 无过滤测试 |
| AS-082 | `serialize()` | **不保存 allSuggestions** — 建议列表在反序列化后丢失 | 🔴 P0 | ⚠️ uncovered | serialize覆盖（规则14） |
| AS-083 | `loadSaveData(data)` | 正常恢复 dailyCount/lastDailyReset/cooldowns | P0 | ⚠️ uncovered | 无此测试 |
| AS-084 | `loadSaveData(data)` | **null防护**: data=null → 崩溃（data.dailyCount） | 🔴 P0 | ⚠️ uncovered | null防护（规则10） |
| AS-085 | `loadSaveData(data)` | **null防护**: data.cooldowns=undefined → for...of崩溃 | 🔴 P0 | ⚠️ uncovered | null防护 |
| AS-086 | `loadSaveData(data)` | **NaN防护**: data.dailyCount=NaN → 后续上限检查失效 | 🔴 P0 | ⚠️ uncovered | NaN传播 |
| AS-087 | `loadSaveData(data)` | cooldownUntil 为 Infinity → Date.now() < Infinity = true → 永久冷却 | 🔴 P0 | ⚠️ uncovered | Infinity序列化（规则19） |
| AS-088 | `loadSaveData(data)` | 不恢复 allSuggestions — 需要重新 updateSuggestions | P1 | ⚠️ uncovered | 设计验证 |
| AS-089 | `loadSaveData(data)` | engine-save 覆盖验证：是否被 engine-save.ts 调用 | P0 | ⚠️ uncovered | serialize覆盖（规则14） |

### 1.10 内部方法

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| AS-090 | `createSuggestion()` | title 截断到20字 | P1 | ⚠️ uncovered | 无此测试 |
| AS-091 | `createSuggestion()` | description 截断到50字 | P1 | ⚠️ uncovered | 无此测试 |
| AS-092 | `createSuggestion()` | priority 从 ADVISOR_TRIGGER_PRIORITY 获取 | P1 | ⚠️ uncovered | 无此测试 |
| AS-093 | `createSuggestion()` | expiresAt = now + SUGGESTION_EXPIRE_MS | P1 | ⚠️ uncovered | 无此测试 |
| AS-094 | `cleanExpired()` | 移除 expiresAt <= now 的建议 | P1 | ⚠️ uncovered | 无此测试 |
| AS-095 | `cleanExpired()` | expiresAt=null → 不过期（保留） | P1 | ⚠️ uncovered | 无此测试 |
| AS-096 | `checkDailyReset()` | 跨天 → dailyCount归零 | P1 | ⚠️ uncovered | 无此测试 |
| AS-097 | `resetDaily()` | calendar:dayChanged 事件触发 → dailyCount归零 | P1 | ⚠️ uncovered | 无此测试 |

---

## 2. AdvisorTriggerDetector（AdvisorTriggerDetector.ts — ~120行）

### 2.1 冷却管理

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| TD-001 | `isInCooldown(state, type)` | 有冷却且未过期 → true | P1 | ⚠️ uncovered | 无此测试 |
| TD-002 | `isInCooldown(state, type)` | 无冷却记录 → false | P1 | ⚠️ uncovered | 无此测试 |
| TD-003 | `isInCooldown(state, type)` | **NaN防护**: cooldownEnd=NaN → Date.now()-NaN = NaN → NaN < ms 为 false | 🔴 P0 | ⚠️ uncovered | NaN绕过 |
| TD-004 | `setCooldown(state, type)` | 正常设置 cooldowns[type]=Date.now() | P1 | ⚠️ uncovered | 无此测试 |

### 2.2 资源检测

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| TD-010 | `findOverflowResource(snapshot)` | 资源/cap > 0.9 → 返回资源key | P1 | ⚠️ uncovered | 无此测试 |
| TD-011 | `findOverflowResource(snapshot)` | **null防护**: snapshot.resources=null → 返回null（有防护） | P1 | ⚠️ uncovered | null防护验证 |
| TD-012 | `findOverflowResource(snapshot)` | **NaN防护**: value=NaN → NaN/cap > 0.9 为 false → 跳过 | P1 | ⚠️ uncovered | NaN行为 |
| TD-013 | `findOverflowResource(snapshot)` | cap=0 → 跳过（除零保护） | P1 | ⚠️ uncovered | 除零保护 |
| TD-014 | `findOverflowResource(snapshot)` | **NaN防护**: cap=NaN → NaN > 0 为 false → 跳过（安全） | P1 | ⚠️ uncovered | NaN行为 |
| TD-015 | `findShortageResource(snapshot)` | 资源/cap < 0.1 → 返回资源key | P1 | ⚠️ uncovered | 无此测试 |
| TD-016 | `findShortageResource(snapshot)` | **null防护**: snapshot.resources=null → 返回null | P1 | ⚠️ uncovered | null防护验证 |
| TD-017 | `findShortageResource(snapshot)` | **NaN防护**: value=NaN → NaN/cap < 0.1 为 false → 跳过 | P1 | ⚠️ uncovered | NaN行为 |

### 2.3 触发检测 — `detectAllTriggers()`

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| TD-020 | `detectAllTriggers()` | resource_overflow 触发 | P1 | ✅ covered | 隐含 |
| TD-021 | `detectAllTriggers()` | resource_shortage 触发 | P1 | ✅ covered | 隐含 |
| TD-022 | `detectAllTriggers()` | building_idle 触发 | P1 | ✅ covered | 隐含 |
| TD-023 | `detectAllTriggers()` | hero_upgradeable 触发（带heroId） | P1 | ✅ covered | 隐含 |
| TD-024 | `detectAllTriggers()` | tech_idle 触发 | P1 | ✅ covered | 隐含 |
| TD-025 | `detectAllTriggers()` | army_full 触发 | P1 | ✅ covered | 隐含 |
| TD-026 | `detectAllTriggers()` | npc_leaving 触发（多个NPC，每个一条） | P1 | ⚠️ uncovered | 无多NPC测试 |
| TD-027 | `detectAllTriggers()` | new_feature_unlock 触发（多个功能，每个一条） | P1 | ⚠️ uncovered | 无多功能测试 |
| TD-028 | `detectAllTriggers()` | offline_overflow 触发（percent>50） | P1 | ✅ covered | 隐含 |
| TD-029 | `detectAllTriggers()` | offline_overflow 不触发（percent<=50） | P1 | ⚠️ uncovered | 无边界测试 |
| TD-030 | `detectAllTriggers()` | **null防护**: snapshot=null → 崩溃 | 🔴 P0 | ⚠️ uncovered | null防护 |
| TD-031 | `detectAllTriggers()` | **null防护**: snapshot.leavingNpcs=undefined → for...of崩溃 | 🔴 P0 | ⚠️ uncovered | null防护 |
| TD-032 | `detectAllTriggers()` | **null防护**: snapshot.newFeatures=undefined → for...of崩溃 | 🔴 P0 | ⚠️ uncovered | null防护 |
| TD-033 | `detectAllTriggers()` | **NaN防护**: offlineOverflowPercent=NaN → NaN > 50 为 false → 跳过 | P1 | ⚠️ uncovered | NaN行为 |
| TD-034 | `detectAllTriggers()` | **冷却一致性**: AdvisorSystem.isInCooldown vs Detector.isInCooldown 逻辑不同 | 🔴 P0 | ⚠️ uncovered | 双系统一致性（规则9） |

---

## 3. advisor.types（advisor.types.ts — ~110行）

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| TY-001 | AdvisorTriggerType | 9种触发类型完整 | P1 | ✅ covered | 类型定义 |
| TY-002 | ADVISOR_TRIGGER_PRIORITY | 9种优先级与9种触发类型一一对应 | P0 | ✅ covered | 类型系统保证 |
| TY-003 | ADVISOR_MAX_DISPLAY | =3 | P1 | ✅ covered | 常量定义 |
| TY-004 | ADVISOR_DAILY_LIMIT | =15 | P1 | ✅ covered | 常量定义 |
| TY-005 | ADVISOR_CLOSE_COOLDOWN_MS | =30*60*1000 | P1 | ✅ covered | 常量定义 |
| TY-006 | ADVISOR_SAVE_VERSION | =1 | P1 | ✅ covered | 常量定义 |
| TY-007 | AdvisorConfidence | 'high'|'medium'|'low' | P1 | ✅ covered | 类型定义 |
| TY-008 | AdvisorSaveData | 包含 version/cooldowns/dailyCount/lastDailyReset | P1 | ✅ covered | 类型定义 |

---

## 特别关注项汇总

| # | 模式 | 严重度 | 影响范围 | 状态 |
|---|------|--------|---------|------|
| S-1 | 双冷却系统不一致（TD-034） | 🔴 P0 | AdvisorSystem.isInCooldown vs Detector.isInCooldown 语义不同（until vs since） | uncovered |
| S-2 | serialize不保存建议列表（AS-082） | 🔴 P0 | loadSaveData后allSuggestions为空，玩家看到的建议丢失 | uncovered |
| S-3 | loadSaveData null防护（AS-084/085） | 🔴 P0 | data=null/data.cooldowns=undefined → 崩溃 | uncovered |
| S-4 | Infinity冷却永久锁（AS-087） | 🔴 P0 | cooldownUntil=Infinity → 永久冷却 | uncovered |
| S-5 | NaN绕过每日上限（AS-025） | 🔴 P0 | dailyCount=NaN → 无上限 | uncovered |
| S-6 | NaN绕过冷却检查（AS-073） | 🔴 P0 | cooldownEnd=NaN → 永远不在冷却中 | uncovered |
| S-7 | init null防护（AS-003） | 🔴 P0 | deps.eventBus=null → 崩溃 | uncovered |
| S-8 | executeSuggestion未初始化（AS-055） | 🔴 P0 | deps未初始化 → emit崩溃 | uncovered |
| S-9 | detectTriggers null防护（AS-012/013） | 🔴 P0 | snapshot=null → 崩溃 | uncovered |
| S-10 | detectAllTriggers null防护（TD-030~032） | 🔴 P0 | snapshot=null/leavingNpcs=undefined → 崩溃 | uncovered |
| S-11 | NaN冷却传播（AS-063） | 🟡 P1 | dismissSuggestion后NaN冷却 | uncovered |
| S-12 | NaN priority排序（AS-034） | 🟡 P1 | priority=NaN → 排序异常 | uncovered |

## Top 10 P0 Uncovered 节点

| # | 节点 | 子系统 | 描述 |
|---|------|--------|------|
| 1 | TD-034 | Detector | 双冷却系统不一致：AdvisorSystem用until模式，Detector用since模式 |
| 2 | AS-082 | AdvisorSystem | serialize不保存allSuggestions，loadSaveData后建议列表丢失 |
| 3 | AS-084/085 | AdvisorSystem | loadSaveData(null)崩溃 |
| 4 | AS-087 | AdvisorSystem | cooldownUntil=Infinity → 永久冷却 |
| 5 | AS-025 | AdvisorSystem | dailyCount=NaN绕过每日上限 |
| 6 | AS-073 | AdvisorSystem | cooldownEnd=NaN → isInCooldown永远false |
| 7 | AS-003 | AdvisorSystem | init时deps.eventBus=null崩溃 |
| 8 | AS-055 | AdvisorSystem | executeSuggestion时deps未初始化崩溃 |
| 9 | AS-012/013 | AdvisorSystem | detectTriggers(snapshot=null)崩溃 |
| 10 | TD-030~032 | Detector | detectAllTriggers null输入崩溃 |

## NaN 防护覆盖全景

| API | NaN入口点 | 当前防护 | 状态 |
|-----|----------|---------|------|
| detectTriggers | snapshot.resources.grain=NaN | ❌ 无检查 | uncovered |
| updateSuggestions | dailyCount=NaN | ❌ 无检查 | uncovered |
| getDisplayedSuggestions | priority=NaN | ❌ 无检查 | uncovered |
| isInCooldown | cooldownEnd=NaN | ❌ 无检查 | uncovered |
| dismissSuggestion | cooldownUntil=NaN | ❌ 无检查 | uncovered |
| loadSaveData | data.dailyCount=NaN | ❌ 无检查 | uncovered |
| loadSaveData | data.cooldowns[].cooldownUntil=NaN/Infinity | ❌ 无检查 | uncovered |
| findOverflowResource | value/cap=NaN | ❌ 无检查 | uncovered |
| findShortageResource | value/cap=NaN | ❌ 无检查 | uncovered |
| isInCooldown(Detector) | cooldownEnd=NaN | ❌ 无检查 | uncovered |

## Serialize 完整性检查

| 检查项 | 状态 | 说明 |
|--------|------|------|
| serialize() 输出包含 version | ✅ covered | ADVISOR_SAVE_VERSION |
| serialize() 输出包含 cooldowns | ✅ covered | 过滤未过期 |
| serialize() 输出包含 dailyCount | ✅ covered | state.dailyCount |
| serialize() 输出包含 lastDailyReset | ✅ covered | state.lastDailyReset |
| serialize() **不保存 allSuggestions** | ❌ uncovered | 设计决策？需验证 |
| loadSaveData() 恢复 dailyCount | ❌ uncovered | 无测试 |
| loadSaveData() 恢复 cooldowns | ❌ uncovered | 无测试 |
| loadSaveData() null 防护 | ❌ uncovered | data=null 崩溃 |
| loadSaveData() NaN 防护 | ❌ uncovered | dailyCount=NaN |
| loadSaveData() Infinity 防护 | ❌ uncovered | cooldownUntil=Infinity |
| engine-save 调用 serialize | ❌ uncovered | 未验证 |
| engine-save 调用 loadSaveData | ❌ uncovered | 未验证 |
| ADVISOR_SAVE_VERSION 正确 | ✅ covered | =1 |

## 配置一致性检查

| 检查项 | 状态 | 说明 |
|--------|------|------|
| AdvisorTriggerType(9) vs ADVISOR_TRIGGER_PRIORITY(9) | ✅ covered | 类型系统保证 |
| ADVISOR_MAX_DISPLAY > 0 | ✅ covered | =3 |
| ADVISOR_DAILY_LIMIT > 0 | ✅ covered | =15 |
| ADVISOR_CLOSE_COOLDOWN_MS > 0 | ✅ covered | =1800000 |
| Detector.COOLDOWN_MS 覆盖9种类型 | ✅ covered | 类型系统保证 |
| **AdvisorSystem冷却 vs Detector冷却语义一致** | ❌ uncovered | **不一致！** |

---

## 测试文件映射

| 测试文件 | 覆盖范围 | 行数 |
|----------|---------|------|
| advisor-recommend-enhance.integration.test.ts | Heritage↔Advisor集成 | ~100 |
| **总计** | | **~100** |

## 双冷却系统不一致（关键发现）

### 问题描述

AdvisorSystem 和 AdvisorTriggerDetector 实现了**两套独立的冷却系统**，且语义不同：

**AdvisorSystem.isInCooldown()**（until模式）：
```typescript
// 冷却记录 = 结束时间戳
this.state.cooldowns[triggerType] = Date.now() + ADVISOR_CLOSE_COOLDOWN_MS;
// 检查：当前时间 < 结束时间
return Date.now() < cooldownEnd;
```

**AdvisorTriggerDetector.isInCooldown()**（since模式）：
```typescript
// 冷却记录 = 开始时间戳
state.cooldowns[triggerType] = Date.now();
// 检查：当前时间 - 开始时间 < 冷却时长
return Date.now() - lastTime < (COOLDOWN_MS[triggerType] ?? 0);
```

**影响**：
1. AdvisorSystem.updateSuggestions() 调用 this.isInCooldown()（until模式）
2. detectAllTriggers() 调用 Detector.isInCooldown()（since模式）
3. 两套冷却互不干扰但语义不同，可能导致同一触发类型在一处冷却中、另一处不冷却
4. dismissSuggestion 设置 until 模式冷却，但 detectAllTriggers 使用 since 模式检查
