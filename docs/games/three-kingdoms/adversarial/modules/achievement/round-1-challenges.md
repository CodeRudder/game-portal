# Achievement 模块 R1 对抗式测试 — Challenger 审查

> Challenger Agent | 2026-05-01
> 审查策略：NaN绕过、进度污染、重复领取、序列化安全、事件监听泄漏、链状态不一致

---

## P0 确认清单

### P0-001: updateProgress NaN 值污染进度（NaN 绕过 Math.max）
- **位置**: `AchievementSystem.ts:148` (updateProgress方法)
- **代码**: `instance.progress[cond.type] = Math.max(instance.progress[cond.type], value);`
- **问题**: `Math.max(0, NaN)` = NaN。NaN 值直接写入 progress，后续 `NaN >= 10` = false，成就永远无法完成
- **影响**: 一旦传入 NaN，该成就进度永久被污染为 NaN，即使后续传入正常值也无法恢复（`Math.max(NaN, 100)` = NaN）
- **修复**: 在 updateProgress 入口添加 `if (!Number.isFinite(value) || value < 0) return;`
- **BR规则**: BR-006 (NaN绕过教训)、BR-017 (战斗数值安全)

### P0-002: updateProgress 负值进度覆盖
- **位置**: `AchievementSystem.ts:148`
- **问题**: 负值本身不会直接污染(Math.max保护)，但确认P0-001的严重性
- **修复**: 同 P0-001，添加 value < 0 检查
- **BR规则**: BR-001 (数值API入口检查)

### P0-003: claimReward 二次领取漏洞分析
- **位置**: `AchievementSystem.ts:170-173`
- **问题**: status=claimed时，claimed !== completed 返回失败。JavaScript单线程安全，但rewardCallback -> checkChainProgress -> rewardCallback递归链可能导致状态不一致
- **实际风险**: 中等。链完成奖励触发时回调中又调用claimReward
- **修复**: 在状态检查后立即标记
- **BR规则**: BR-013 (事务性扫描)

### P0-004: loadSaveData null/undefined 输入崩溃
- **位置**: `AchievementSystem.ts:247-254`
- **问题**: data=null时 data.version TypeError崩溃；data.state=null时 data.state.achievements TypeError崩溃
- **影响**: 存档损坏时游戏崩溃
- **修复**: 添加 `if (!data || !data.state) return;` 前置检查
- **BR规则**: BR-010 (deserialize覆盖验证)

### P0-005: loadSaveData version 不匹配时静默丢弃
- **位置**: `AchievementSystem.ts:248`
- **问题**: 版本不匹配时直接return，调用方无法知道加载失败
- **影响**: 玩家加载存档后成就数据全部丢失且无提示
- **修复**: 返回boolean或抛出错误
- **BR规则**: BR-013 (事务性扫描)

### P0-006: updateProgressFromSnapshot NaN 批量传播
- **位置**: `AchievementSystem.ts:162-165`
- **问题**: 无校验直接透传，NaN值触发P0-001
- **影响**: 单个NaN值可污染所有匹配该conditionType的成就进度
- **修复**: 循环内添加 `if (!Number.isFinite(value) || value < 0) continue;`
- **BR规则**: BR-006 (NaN绕过教训)

### P0-007: rewardCallback 抛异常导致 claimReward 状态不一致
- **位置**: `AchievementSystem.ts:185-187`
- **问题**: rewardCallback抛异常后，状态已修改为claimed+积分已加，但checkChainProgress和unlockDependentAchievements未执行
- **影响**: 成就链进度不更新、后续成就不解锁、状态不一致
- **修复**: 将rewardCallback调用包在try-catch中
- **BR规则**: BR-013 (事务性扫描)、BR-006 (注入点验证)

### P0-008: checkChainProgress 链完成奖励异常
- **位置**: `AchievementSystem.ts:318-326`
- **问题**: completedChains已推入但rewardCallback抛异常导致奖励未发放
- **修复**: try-catch包裹rewardCallback
- **BR规则**: BR-013 (事务性扫描)

### P0-009: reset() 未清理 eventBus 监听器
- **位置**: `AchievementSystem.ts:67-70`
- **问题**: reset只重置状态，5个事件监听器仍绑定。reset后再init注册第二组监听器
- **影响**: 每次reset+init后监听器翻倍，内存泄漏
- **修复**: init中保存unsubscribe函数，reset中调用
- **BR规则**: BR-008 (注入点验证)

### P0-010: getState 浅拷贝导致内部状态可被外部篡改
- **位置**: `AchievementSystem.ts:56-61`
- **问题**: achievements浅拷贝不保护内部AchievementInstance对象
- **影响**: 外部代码可绕过所有校验直接修改成就状态
- **修复**: 使用structuredClone深拷贝
- **BR规则**: BR-010 (deserialize覆盖验证)

---

## P1 确认清单

### P1-001: updateProgress Infinity 值立即完成成就
- Math.max(0, Infinity) = Infinity，Infinity >= targetValue = true，成就立即完成

### P1-002: getAchievementsByDimension 无效维度不报错
- 传入'invalid'返回空数组，调用方拼写错误难以发现

### P1-003: totalPoints 无上限溢出
- 理论上可溢出Number.MAX_SAFE_INTEGER

### P1-004: getSaveData 浅拷贝问题
- 与P0-010相同，存档数据可被篡改

### P1-005: init 未检查 deps.eventBus.on 是否存在
- eventBus为null时setupEventListeners崩溃

---

## NaN 专项扫描总结

| 入口点 | NaN行为 | 风险等级 | 关联P0 |
|--------|---------|----------|--------|
| updateProgress(value=NaN) | Math.max(x, NaN)=NaN，进度永久污染 | P0 | P0-001 |
| updateProgress(value=Infinity) | Math.max(x, Infinity)=Infinity，立即完成 | P1 | P1-001 |
| updateProgressFromSnapshot({k:NaN}) | 透传NaN | P0 | P0-006 |
| claimReward(points=NaN) | totalPoints += NaN | P1 | P1-003 |
| checkCompletion(current=NaN) | NaN >= target = false，永不完成 | 后果 | P0-001后果 |

## 事务性扫描总结

| 操作 | 原子性 | 风险 |
|------|--------|------|
| claimReward | 非原子 | P0-007 |
| checkChainProgress | 非原子 | P0-008 |
| loadSaveData | 部分原子 | P0-004 |

## 事件监听泄漏扫描

| 事件 | 清理机制 | 风险 |
|------|----------|------|
| battle:completed | 无清理 | P0-009 |
| building:upgraded | 无清理 | P0-009 |
| hero:recruited | 无清理 | P0-009 |
| rebirth:completed | 无清理 | P0-009 |
| prestige:levelUp | 无清理 | P0-009 |
