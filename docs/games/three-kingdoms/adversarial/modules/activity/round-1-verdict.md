# Activity（活动域）R1 Arbiter 仲裁裁决

> Arbiter: ArbiterAgent | Time: 2026-05-01 | Phase: R1 对抗式测试
> 基于 Builder 流程树 + Challenger 挑战报告
> 仲裁标准: builder-rules.md v1.8 + arbiter-rules.md v1.6

---

## 仲裁总览

| 指标 | 数值 |
|------|------|
| Builder P0节点 | 57 |
| Challenger P0声称 | 33 |
| Challenger虚报 | 0 |
| Arbiter确认P0 | 28 |
| 降级P0→P1 | 5 |
| 架构级P0 | 2 |
| 需修复P0 | 28 |

---

## 5维度评分

| 维度 | 权重 | 得分 | 说明 |
|------|------|------|------|
| 完备性 | 25% | 8.5 | Builder覆盖了66个API中的62个(94%)，但跨系统链路覆盖不足 |
| 准确性 | 25% | 9.0 | Challenger虚报率0%，covered标注基本准确 |
| 优先级 | 15% | 8.0 | P0/P1/P2分配合理，5个降级为P1 |
| 可测试性 | 15% | 9.0 | 每个节点均可转化为测试用例 |
| 挑战应对 | 20% | 8.5 | Builder识别了系统性NaN问题，Challenger发现了架构级缺陷 |
| **加权总分** | | **8.6** | **未达封版线(9.0)，需R2迭代** |

---

## P0 裁决明细

### ✅ 确认P0（28个）

| ID | 模块 | 缺陷描述 | 模式 | 裁决 |
|----|------|---------|------|------|
| P0-001 | ActivitySystem | canStartActivity不检查分类型上限 | 模式11 | ✅ 确认 — 逻辑缺陷，filter回调始终return true |
| P0-002 | ActivitySystem | updateTaskProgress(NaN)进度损坏 | 模式9 | ✅ 确认 — NaN绕过 |
| P0-003 | ActivitySystem | updateTaskProgress(负值)倒刷 | 模式3 | ✅ 确认 — 负值漏洞 |
| P0-004 | ActivitySystem | claimTaskReward NaN传播 | 模式9 | ✅ 确认 — 积分/代币变NaN |
| P0-005 | ActivitySystem | checkMilestones NaN阻断 | 模式9 | ✅ 确认 — 与P0-004连锁 |
| P0-006 | OfflineCalc | calculateOfflineProgress NaN/负值 | 模式9+3 | ✅ 确认 |
| P0-007 | SignInSystem | signIn(now=NaN)异常 | 模式9 | ✅ 确认 — Date构造异常 |
| P0-008 | SignInSystem | retroactive(gold=NaN)免费补签 | 模式21 | ✅ 确认 — 经济漏洞 |
| P0-009 | SignInSystem | 补签连续性逻辑缺陷 | 模式11 | ✅ 确认 — 算法正确性 |
| P0-010 | TokenShop | purchaseItem(quantity=NaN) | 模式21 | ✅ 确认 — 双重绕过 |
| P0-011 | TokenShop | purchaseItem(quantity=负值) | 模式3+6 | ✅ 确认 — 刷代币 |
| P0-012 | TokenShop | rewards.resourceChanges undefined | 模式1 | ✅ 确认 — 运行时崩溃 |
| P0-013 | TokenShop | addTokens/spendTokens(NaN) | 模式9 | ✅ 确认 — 代币损坏 |
| P0-014 | TokenShop | addTokens(负值) | 模式3 | ✅ 确认 — 代币减少 |
| P0-015 | TokenShop | deserialize(null)崩溃 | 模式1 | ✅ 确认 |
| P0-016 | TimedActivity | createFlow(NaN时间) | 模式9 | ✅ 确认 |
| P0-017 | TimedActivity | updateLeaderboard NaN排名 | 模式9 | ✅ 确认 |
| P0-018 | TimedActivity | calculateOfflineProgress(NaN) | 模式9 | ✅ 确认 |
| P0-019 | TimedActivity | deserialize(null)崩溃 | 模式1 | ✅ 确认 |
| P0-020 | ActivityFactory | createActivityInstance(null) | 模式1 | ✅ 确认 |
| P0-021 | ActivityFactory | createActivityTask(null) | 模式1 | ✅ 确认 |
| P0-022 | SeasonHelper | getCurrentSeasonTheme(NaN) | 模式9 | ✅ 确认 — undefined越界 |
| P0-023 | SeasonHelper | updateSeasonRecord(NaN ranking) | 模式9 | ✅ 确认 |
| P0-024 | ActivitySystem | NaN序列化→null | 模式18 | ✅ 确认 — 存档损坏 |
| P0-025 | ActivitySystem | canStartActivity maxTotal=NaN | 模式9 | ✅ 确认 |
| P0-026 | ActivitySystem | updateActivityStatus now=NaN | 模式9 | ✅ 确认 — 活动永不到期 |
| **ARCH-001** | **架构** | **SaveContext无Activity引用** | **模式15** | ✅ **架构级P0** |
| **ARCH-002** | **架构** | **engine-save零引用Activity** | **模式15** | ✅ **架构级P0** |

### ⬇️ 降级P0→P1（5个）

| ID | 原P0 | 降级原因 |
|----|------|---------|
| P0-017-orig | updatePhase就地修改flow | 设计如此（非不可变），风险可控 |
| P0-019-orig | updateLeaderboard就地修改entries | 浅拷贝后sorted已复制，但entry.rank仍修改原对象 |
| P0-015-orig | tokenBalance无上限 | 需大量操作才能累积，降为P1 |
| P0-029-orig | durationDays=NaN | createFestivalActivity内部调用createFlow，NaN传播已覆盖 |
| P0-030-orig | durationDays=0 | 0天活动是配置问题，非代码缺陷 |

---

## 架构级P0详情

### ARCH-001+002: Activity模块完全未接入保存/加载流程

**严重度**: 🔴 架构级P0（可玩性阻断项）

**发现**:
- `SaveContext` 接口（engine-save.ts:55-145）中**无任何Activity相关字段**
- `buildSaveData()` 函数中**零引用** ActivitySystem/SignInSystem/TokenShopSystem/TimedActivitySystem
- `applyLoadedState()` 中**零引用** Activity模块
- 搜索 `engine-save.ts` 全文，Activity相关关键词出现次数 = **0**

**影响**:
- ActivitySystem.serialize() 有实现但从未被调用 → 活动数据不存档
- SignInSystem 无独立serialize → 签到数据不存档
- TokenShopSystem.serialize() 有实现但从未被调用 → 代币/商品数据不存档
- TimedActivitySystem.serialize() 有实现但从未被调用 → 限时活动/排行榜不存档

**玩家影响**: 
- 签到数据：连续天数/补签次数 → 刷新页面后归零
- 活动进度：积分/代币/任务/里程碑 → 全部丢失
- 代币商店：余额/购买记录 → 全部归零
- 限时活动：排行榜/阶段 → 全部丢失

**修复方案**: 
1. SaveContext 增加 activitySystem/signInSystem/tokenShopSystem/timedActivitySystem 字段
2. buildSaveData() 增加四个子系统的序列化调用
3. applyLoadedState() 增加四个子系统的反序列化调用
4. GameSaveData 类型增加对应字段
5. engine-extended-deps.ts buildSaveCtx() 增加对应字段

**关联规则**: BR-014(保存/加载覆盖扫描)、BR-015(deserialize覆盖验证)

---

## 修复优先级排序

### Tier 1: 架构级（必须R1修复）
1. **ARCH-001+002**: Activity模块接入engine-save（6处同步）

### Tier 2: 经济漏洞（R1必须修复）
2. **P0-008**: retroactive(gold=NaN)免费补签
3. **P0-010**: purchaseItem(quantity=NaN)免费购买
4. **P0-011**: purchaseItem(quantity=负值)刷代币
5. **P0-014**: addTokens(负值)减代币

### Tier 3: NaN系统性问题（R1必须修复）
6. **P0-002**: updateTaskProgress(NaN)
7. **P0-004/005**: claimTaskReward NaN → checkMilestones连锁
8. **P0-006**: calculateOfflineProgress NaN/负值
9. **P0-007**: signIn(now=NaN)
10. **P0-013**: addTokens/spendTokens(NaN)
11. **P0-016**: createFlow(NaN)
12. **P0-017**: updateLeaderboard NaN
13. **P0-018**: calculateOfflineProgress(NaN)限时
14. **P0-022/023**: SeasonHelper NaN
15. **P0-025**: canStartActivity maxTotal=NaN
16. **P0-026**: updateActivityStatus now=NaN

### Tier 4: 逻辑缺陷（R1必须修复）
17. **P0-001**: canStartActivity不检查分类型上限
18. **P0-009**: 补签连续性逻辑

### Tier 5: Null防护（R1必须修复）
19. **P0-012**: rewards.resourceChanges undefined
20. **P0-015**: TokenShop deserialize(null)
21. **P0-019**: TimedActivity deserialize(null)
22. **P0-020/021**: Factory null def

### Tier 6: 序列化（R1必须修复）
23. **P0-024**: NaN序列化→null

### Tier 7: 负值（R1必须修复）
24. **P0-003**: updateTaskProgress(负值)

---

## 收敛判断

| 条件 | 状态 | 说明 |
|------|------|------|
| 评分 >= 9.0 | ❌ 8.6 | 未达标 |
| API覆盖率 >= 90% | ✅ 94% | 达标 |
| F-Cross覆盖率 >= 75% | ❌ ~50% | 跨系统链路不足 |
| F-Lifecycle覆盖率 >= 70% | ❌ ~60% | 保存/加载覆盖缺失 |
| P0节点覆盖 = 100% | ✅ | 所有P0已识别 |
| 虚报数 = 0 | ✅ | 0虚报 |
| 最终轮新P0 = 0 | ❌ | R1首轮，28个新P0 |
| 所有子系统覆盖 = 是 | ❌ | engine-save未覆盖Activity |

**结论**: **CONTINUE** — 需R2迭代。架构级P0（engine-save未覆盖Activity）必须R1修复后才能进入R2评估。

---

## 对称函数检查 (AR-012)

| 函数对 | 状态 | 说明 |
|--------|------|------|
| serialize ↔ deserialize (ActivitySystem) | ✅ | 两者实现匹配 |
| serialize ↔ deserialize (TokenShop) | ⚠️ | deserialize无null guard |
| serialize ↔ deserialize (TimedActivity) | ⚠️ | deserialize无null guard |
| addTokens ↔ spendTokens | ⚠️ | 两者都缺NaN/负值检查 |
| signIn ↔ retroactive | ✅ | 两者逻辑一致 |

---

## Rule Evolution Suggestions

### Arbiter规则更新建议
1. 新增AR-014: 模块接入验证 — 新增子系统时必须验证SaveContext/buildSaveData/applyLoadedState三处引用
2. 新增AR-015: 经济系统参数验证 — 购买/兑换类API的quantity参数必须验证NaN/负值/零值
3. 强化AR-011: covered标注验证需包含engine-save引用检查

### Builder规则更新建议
1. 新增BR-025: 时间参数NaN检查 — 所有接受时间戳的API必须验证!Number.isFinite(now)
2. 新增BR-026: 排行榜排序NaN防护 — 排序比较函数必须处理NaN

### P0模式库更新建议
1. 新增模式24: 时间参数NaN — Date构造函数不接受NaN，导致Invalid Date
2. 新增模式25: 购买quantity负值 — quantity=负值时totalCost为负，绕过余额检查
3. 新增模式26: 排行榜排序NaN — sort比较函数中NaN导致不确定排序
