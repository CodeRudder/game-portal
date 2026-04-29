# R07 — 路径覆盖测试报告

## 概要

为三国霸业引擎 3 个核心系统编写深度路径覆盖测试，覆盖复杂分支逻辑的罕见路径。

| 系统 | 测试文件 | 用例数 | 通过 | 失败 |
|------|---------|--------|------|------|
| BattleEngine | `battle/__tests__/BattleEngine.path-coverage.test.ts` | 21 | 21 | 0 |
| TechSystem | `tech/__tests__/TechSystem.path-coverage.test.ts` | 24 | 24 | 0 |
| AllianceSystem | `alliance/__tests__/AllianceSystem.path-coverage.test.ts` | 49 | 49 | 0 |
| **合计** | | **94** | **94** | **0** |

---

## 1. BattleEngine 路径覆盖（21 用例）

### 覆盖路径

| # | 测试场景 | 覆盖分支 | 优先级 |
|---|---------|---------|--------|
| 1 | 速度不等时高速方先行动 | `sortBySpeed` 主路径 | P1 |
| 2 | 速度相等时按ID字典序排列 | `speed === speed` → `localeCompare` 分支 | P2 |
| 3 | 一方速度为0时另一方先行动 | `speed=0` 边界值 | P1 |
| 4 | 高速度单位触发暴击路径 | 暴击率计算 `BASE_CRITICAL_RATE + speed/100` | P1 |
| 5 | 骑兵攻击步兵触发克制（1.5x） | `getRestraintMultiplier` 克制路径 | P1 |
| 6 | 弓兵对弓兵无克制（1.0x） | `RESTRAINT_NEUTRAL` 分支 | P2 |
| 7 | 怒气满时释放终极技能 | `rage >= rageCost` 技能释放路径 | P1 |
| 8 | 技能冷却中时使用普攻 | `currentCooldown > 0` → fallback 普攻 | P1 |
| 9 | 无主动技能时始终使用普攻 | `skills.length === 0` 空技能列表路径 | P2 |
| 10 | 敌方全灭 → VICTORY | `enemyAlive === 0` 全灭结算 | P0 |
| 11 | 我方全灭 → DEFEAT | `allyAlive === 0` 全灭结算 | P0 |
| 12 | 达到最大回合数 → DRAW | `currentTurn >= maxTurns` 超时判定 | P1 |
| 13 | 战斗已结束时 executeTurn 返回空数组 | `phase !== IN_PROGRESS` 提前退出 | P2 |
| 14 | 灼烧 DOT 持续伤害 | `BuffType.BURN` DOT 路径 | P1 |
| 15 | 中毒 DOT 持续伤害 | `BuffType.POISON` DOT 路径 | P1 |
| 16 | 冰冻控制无法行动 | `BuffType.FREEZE` → `skill=null` | P1 |
| 17 | 眩晕控制无法行动 | `BuffType.STUN` → `skill=null` | P1 |
| 18 | DOT 导致阵亡记录 | DOT 伤害 + `isAlive=false` 组合 | P2 |
| 19 | 三星评定（存活≥4 + 回合≤6） | `StarRating.THREE` 路径 | P1 |
| 20 | 二星评定（存活≥4 + 回合>6） | `StarRating.TWO` 路径 | P2 |
| 21 | 失败 → NONE 星 | `outcome !== VICTORY` → `StarRating.NONE` | P1 |

### 关键分支覆盖

- **速度排序**: 3 条路径（不等/相等/零值）
- **暴击+克制**: 3 条路径（暴击/克制叠加/无克制）
- **技能释放**: 3 条路径（终极技/冷却中/无技能）
- **战斗结束**: 4 条路径（胜利/失败/平局/已结束）
- **状态效果**: 5 条路径（灼烧/中毒/冰冻/眩晕/DOT阵亡）
- **星级评定**: 3 条路径（三星/二星/无星）

---

## 2. TechSystem 路径覆盖（24 用例）

### 覆盖路径

| # | 测试场景 | 覆盖分支 | 优先级 |
|---|---------|---------|--------|
| 1 | 无前置依赖的 Tier1 科技默认可用 | `prerequisites.length === 0` → available | P1 |
| 2 | 前置科技未完成时无法解锁 Tier2 | `!arePrerequisitesMet()` → locked | P1 |
| 3 | 完成前置科技后 Tier2 变为可用 | 前置完成后 `refreshAllAvailability` | P1 |
| 4 | 多层前置依赖需逐级完成 | 3 级依赖链：t1 → t2 → t3 | P1 |
| 5 | 已完成节点不可再次研究 | `status === 'completed'` 拦截 | P1 |
| 6 | 不存在的节点返回不可研究 | `!def` 空值检查路径 | P2 |
| 7 | 资源足够时成功开始研究 | `canAfford() === true` 主路径 | P1 |
| 8 | 资源不足时拒绝研究 | `!canAfford()` → 失败原因 | P1 |
| 9 | 资源刚好够时成功研究（边界值） | 精确 50 点 = costPoints | P0 |
| 10 | 队列已满时拒绝研究 | `queue.length >= maxQueue` | P1 |
| 11 | 取消研究后可重新研究 | `cancelResearch()` → `status='available'` | P2 |
| 12 | 科技满级后不可继续升级 | `canResearch` → '已完成' | P1 |
| 13 | 单个科技效果正确计算 | `getEffectValue` 单效果查询 | P1 |
| 14 | 多个科技效果正确叠加 | 同目标 `target='all'` + `target='cavalry'` 叠加 | P1 |
| 15 | 科技加成百分比计算正确 | `getTechBonusMultiplier()` | P2 |
| 16 | 互斥分支选择后另一分支被锁定 | `lockMutexAlternatives()` | P1 |
| 17 | 路线进度统计正确 | `getPathProgress()` | P2 |
| 18 | 无已完成科技时效果值为 0 | 空状态边界值 | P2 |
| 19 | 融合科技前置条件未满足时锁定 | `status === 'locked'` | P2 |
| 20 | 部分前置满足时仍锁定 | 单路线满足 ≠ 全部满足 | P1 |
| 21 | 所有前置满足后融合科技解锁 | `pathA + pathB` 均完成 | P1 |
| 22 | 融合科技完成后效果汇总正确 | `completeFusionNode()` | P2 |
| 23 | 序列化与反序列化保持一致性 | `serialize()` ↔ `deserialize()` | P1 |
| 24 | 科技重置后所有节点回到初始状态 | `reset()` → `chosenMutexNodes={}` | P1 |

### 关键分支覆盖

- **前置依赖**: 6 条路径（无前置/未完成/完成/多级/已完成/不存在）
- **资源消耗**: 6 条路径（足够/不足/刚好/队列满/取消重研究/已完成）
- **效果计算**: 6 条路径（单效果/叠加/百分比/互斥/进度/空值）
- **融合科技**: 6 条路径（锁定/部分满足/全部满足/完成/序列化/重置）

---

## 3. AllianceSystem 路径覆盖（49 用例）

### 覆盖路径

| # | 测试场景 | 覆盖分支 | 优先级 |
|---|---------|---------|--------|
| **创建联盟（6）** | | | |
| 1 | 首次创建联盟成功 | 主路径：`!allianceId` → 创建 | P1 |
| 2 | 已在联盟中时创建失败 | `allianceId` 非空拦截 | P1 |
| 3 | 联盟名称过短时创建失败 | `name.length < nameMinLength` | P1 |
| 4 | 联盟名称过长时创建失败 | `name.length > nameMaxLength` | P1 |
| 5 | 简化版创建：元宝不足 | `getBalance() < costGold` | P1 |
| 6 | 简化版创建：元宝充足 | `spendCallback()` 成功 | P1 |
| **加入联盟（6）** | | | |
| 7 | 申请加入联盟成功 | 主路径 | P1 |
| 8 | 已在联盟中时申请失败 | `allianceId` 非空拦截 | P1 |
| 9 | 重复申请时失败 | `existing PENDING` 拦截 | P1 |
| 10 | 联盟成员已满时申请失败 | `memberCount >= maxMembers` | P1 |
| 11 | 审批申请成功 | `approveApplication` 主路径 | P1 |
| 12 | 审批已处理过的申请失败 | `status !== PENDING` 拦截 | P2 |
| **退出联盟（4）** | | | |
| 13 | 普通成员退出联盟成功 | `leaveAlliance` 主路径 | P1 |
| 14 | 盟主无法直接退出 | `playerId === leaderId` 拦截 | P1 |
| 15 | 非成员退出失败 | `!members[playerId]` 拦截 | P2 |
| 16 | 联盟解散（返回 null） | `remainingMembers.length === 0` | P2 |
| **权限管理（9）** | | | |
| 17 | 盟主拥有全部权限 | `LEADER` → 全部 true | P1 |
| 18 | 军师有审批/公告/踢人权限 | `ADVISOR` → 部分 true | P1 |
| 19 | 普通成员无管理权限 | `MEMBER` → 全部 false | P1 |
| 20 | 盟主踢出成员成功 | `kickMember` 主路径 | P1 |
| 21 | 不能踢出自己 | `operatorId === targetId` | P2 |
| 22 | 不能踢出盟主 | `targetId === leaderId` | P1 |
| 23 | 转让盟主成功 | `transferLeadership` 主路径 | P1 |
| 24 | 非盟主无法转让 | `leaderId !== operatorId` | P1 |
| 25 | 转让给自己失败 | `currentLeaderId === newLeaderId` | P2 |
| **公告频道（5）** | | | |
| 26 | 盟主发布公告成功 | `postAnnouncement` 主路径 | P1 |
| 27 | 置顶公告达到上限时失败 | `pinnedCount >= maxPinned` | P1 |
| 28 | 空内容公告失败 | `!content.trim()` | P2 |
| 29 | 频道消息超过上限时自动裁剪 | `messages.length > maxMessages` → splice | P2 |
| 30 | 非成员发送消息失败 | `!members[senderId]` | P2 |
| **等级经验（4）** | | | |
| 31 | 添加经验后联盟升级 | `newExp >= requiredExp` → `newLevel++` | P1 |
| 32 | 经验不足时不升级 | `newExp < requiredExp` → 保持 | P2 |
| 33 | 联盟等级福利计算正确 | `getBonuses()` 查询 | P2 |
| 34 | 联盟等级提升后成员上限增加 | `getMaxMembers()` 多等级验证 | P2 |
| **联盟任务（5）** | | | |
| 35 | 每日刷新生成任务 | `dailyRefresh()` 生成 3 个任务 | P1 |
| 36 | 更新任务进度至完成 | `currentProgress >= targetCount` → COMPLETED | P1 |
| 37 | 领取未完成任务奖励失败 | `status !== COMPLETED` 拦截 | P1 |
| 38 | 领取已完成任务奖励成功 | `claimTaskReward` 主路径 | P1 |
| 39 | 重复领取奖励失败 | `claimedPlayers.has(playerId)` | P2 |
| **联盟商店（7）** | | | |
| 40 | 公会币充足时购买成功 | `buyShopItem` 主路径 | P1 |
| 41 | 公会币不足时购买失败 | `guildCoins < guildCoinCost` | P1 |
| 42 | 联盟等级不足时购买失败 | `requiredAllianceLevel > level` | P1 |
| 43 | 限购商品达到上限时购买失败 | `purchased >= weeklyLimit` | P1 |
| 44 | 每周重置后限购恢复 | `resetShopWeekly()` → `purchased=0` | P2 |
| 45 | canBuy 检查不存在的商品 | `!item` 空值检查 | P2 |
| 46 | 批量购买正确计算 | `buyShopItemBatch` 批量路径 | P2 |
| **每日重置（1）** | | | |
| 47 | 每日重置清零成员日常数据 | `dailyReset` 主路径 | P2 |
| **序列化（2）** | | | |
| 48 | 序列化与反序列化保持一致 | `serialize` ↔ `deserialize` | P1 |
| 49 | 无联盟时序列化/反序列化 | `allianceData=null` 边界值 | P2 |

### 关键分支覆盖

- **创建联盟**: 6 条路径（成功/已加入/名称短/名称长/元宝不足/元宝充足）
- **加入联盟**: 6 条路径（成功/已加入/重复申请/已满/审批成功/已处理）
- **退出联盟**: 4 条路径（成员退出/盟主退出/非成员/联盟解散）
- **权限管理**: 9 条路径（三级权限×多操作 + 踢人/转让边界）
- **公告频道**: 5 条路径（发布/置顶上限/空内容/消息裁剪/非成员）
- **等级经验**: 4 条路径（升级/不升级/福利查询/成员上限）
- **联盟任务**: 5 条路径（刷新/完成/未完成领取/成功领取/重复领取）
- **联盟商店**: 7 条路径（购买成功/币不足/等级不足/限购/重置/不存在/批量）
- **每日重置**: 1 条路径
- **序列化**: 2 条路径（有联盟/无联盟）

---

## 测试策略总结

### 设计原则
1. **真实引擎对象**：直接使用 `BattleEngine`、`TechTreeSystem`、`AllianceSystem` 等真实类，最小 mock
2. **不使用 `as any`**：所有类型安全，通过正确的类型构造器创建测试数据
3. **边界值优先**：精确资源匹配（刚好够）、零值、超限等边界条件
4. **罕见路径覆盖**：联盟解散（null 返回）、DOT 阵亡记录、互斥锁定等低频路径

### Mock 策略
- **ISystemDeps**: 仅 mock `eventBus`、`config`、`registry` 基础设施
- **货币回调**: 通过 `setCurrencyCallbacks` 注入，不 mock 引擎内部
- **时间控制**: 使用 `vi.spyOn(Date, 'now')` 控制研究时间

### 验证命令

```bash
cd /mnt/user-data/workspace && pnpm vitest run \
  src/games/three-kingdoms/engine/battle/__tests__/BattleEngine.path-coverage.test.ts \
  src/games/three-kingdoms/engine/tech/__tests__/TechSystem.path-coverage.test.ts \
  src/games/three-kingdoms/engine/alliance/__tests__/AllianceSystem.path-coverage.test.ts \
  --reporter=verbose
```

### 执行结果

```
Test Files  3 passed (3)
     Tests  94 passed (94)
  Duration  ~4s
```
