# Event Module R1 — Arbiter 仲裁裁决

> 模块: event | 轮次: R1 | Arbiter: v1.9
> Builder树: 15个P0 | Challenger挑战: 15个验证 + 5个新发现
> 裁决时间: R1

---

## 一、裁决总览

| 来源 | 数量 | 确认P0 | 降级 | 驳回 |
|------|------|--------|------|------|
| Builder P0 | 15 | 6 | 7 | 2 |
| Challenger NEW | 5 | 3 | 1 | 1 |
| **合计** | **20** | **9** | **8** | **3** |

---

## 二、逐项裁决

### Builder P0 裁决

| # | ID | Builder描述 | Challenger验证 | 裁决 | 理由 |
|---|-----|------------|---------------|------|------|
| 1 | P0-01 | S1-B07: resolveEvent(不存在instance) → null | ✅ 已有防护 | **非P0** | 正确返回null，不是bug |
| 2 | P0-02 | S1-B08: resolveEvent(非active) → null | ✅ 已有防护 | **非P0** | 正确返回null，不是bug |
| 3 | P0-03 | S1-B09: resolveEvent(不存在option) → null | ✅ 已有防护 | **非P0** | 正确返回null，不是bug |
| 4 | P0-04 | S1-E01: deserialize(null) → crash | ✅ 确认crash | **✅ P0 确认** | `data.activeEvents` 在data=null时crash |
| 5 | P0-05 | S4-B03: calculateProbability(NaN) → NaN | ✅ 确认NaN传播 | **✅ P0 确认** | Math.max(0, NaN)=NaN |
| 6 | P0-06 | S4-E01: modifiers含NaN → NaN | ✅ 确认NaN传播 | **✅ P0 确认** | reduce + NaN = NaN |
| 7 | P0-07 | S6-B01: deserialize null data | ⚠️ 有 `?? []` 防护 | **降级为P2** | null coalescing已防护 |
| 8 | P0-08 | S7-B08: EventChainSystem.deserialize null | ⚠️ 有 `?? []` 防护 | **降级为P2** | null coalescing已防护 |
| 9 | P0-09 | S8-B08: ChainEventSystem.import null | ⚠️ 有 `?? []` 防护 | **降级为P2** | null coalescing已防护 |
| 10 | P0-10 | S9-B08: StoryEventSystem.import null | ⚠️ 有 `?? []` 防护 | **降级为P2** | null coalescing已防护 |
| 11 | P0-11 | S10-E01: selectOption(空options) | ⚠️ 有早期return | **降级为P2** | `if (!def \|\| def.options.length === 0) return ''` |
| 12 | P0-12 | S12-B06: NotificationSystem.import null | ⚠️ 有if检查 | **降级为P2** | `if (data.banners)` 已防护 |
| 13 | P0-13 | S2-B04: evaluateTurnRange(NaN) | ✅ 确认NaN问题 | **✅ P0 确认** | `currentTurn < NaN` = false，条件静默通过 |
| 14 | P0-14 | S2-B05: compareValue(NaN) | ✅ 确认NaN问题 | **✅ P0 确认** | `actual >= NaN` = false，条件永远不通过 |
| 15 | P0-15 | S1-E03: 负数turn无检查 | ✅ 确认无校验 | **✅ P0 确认** | currentTurn可为负数/NaN |

### Challenger NEW-P0 裁决

| # | ID | Challenger描述 | 裁决 | 理由 |
|---|-----|---------------|------|------|
| 16 | NEW-P0-01 | OfflineEventHandler 空选项 throw | **✅ P0 确认** | throw中断整个离线处理流程 |
| 17 | NEW-P0-02 | Serialization cooldowns NaN注入 | **✅ P0 确认** | NaN导致冷却永久不解除 |
| 18 | NEW-P0-03 | 紧急度阈值逻辑反转 | **降级为P1** | 语义合理但注释不清，非crash |
| 19 | NEW-P0-04 | 无版本迁移 | **降级为P2** | 未来问题，当前不影响 |
| 20 | NEW-P0-05 | compareValue NaN默认0 | **驳回** | undefined→0是合理的默认行为 |

---

## 三、确认P0清单（需Fixer修复）

| # | ID | 子系统 | 描述 | 修复方案 |
|---|-----|--------|------|---------|
| F-01 | P0-04 | EventTriggerSystem | deserialize(null/undefined) crash | 入口添加null guard |
| F-02 | P0-05 | ProbabilityCalculator | baseProbability=NaN → NaN传播 | 入口添加Number.isNaN检查 |
| F-03 | P0-06 | ProbabilityCalculator | modifiers含NaN → NaN传播 | reduce中过滤NaN |
| F-04 | P0-13 | EventTriggerConditions | evaluateTurnRange(NaN minTurn) | Number.isFinite检查 |
| F-05 | P0-14 | EventTriggerConditions | compareValue(NaN expected) | Number.isFinite检查 |
| F-06 | P0-15 | EventTriggerSystem | 负数/NaN回合无校验 | checkAndTriggerEvents入口校验 |
| F-07 | NEW-P0-01 | OfflineEventHandler | autoChooseOption空选项throw | 改为安全返回 |
| F-08 | NEW-P0-02 | EventTriggerSerialization | cooldowns NaN注入 | 类型校验 |

---

## 四、修复分组策略

### Group A: deserialize null防护 (F-01)
- 文件: `EventTriggerSystem.ts` L312
- 方案: `deserialize(data: EventSystemSaveData | null)` → null guard

### Group B: NaN传播防护 (F-02, F-03, F-04, F-05, F-08)
- 文件: `EventProbabilityCalculator.ts`, `EventTriggerConditions.ts`, `EventTriggerSerialization.ts`
- 方案: 统一使用 `Number.isFinite()` 守卫

### Group C: 回合数校验 (F-06)
- 文件: `EventTriggerSystem.ts` L141
- 方案: `if (!Number.isFinite(currentTurn) || currentTurn < 0) return []`

### Group D: 空选项安全 (F-07)
- 文件: `OfflineEventHandler.ts` L130
- 方案: throw → return 默认AutoResolveResult

---

## 五、统计

| 类别 | 数量 |
|------|------|
| 总争议项 | 20 |
| 确认P0 (需修复) | 8 |
| 降级P1 | 1 |
| 降级P2 | 6 |
| 驳回 (非bug) | 3 |
| 已防护 (原正确) | 2 |
