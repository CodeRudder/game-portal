# Achievement R2 Test Branch Tree

> Builder: AdversarialTestTreeBuilder v2.0 | Time: 2026-05-01
> 模块: achievement | 基于: round-1-verdict.md + round-1-fixes.md

## 目标

在 R1 修复基础上，验证 P0 修复的穿透性，并覆盖 R1 遗留的 P1 场景。

---

## T1: Normal Flow（正常流程）— 权重 20%

### T1.1 完整生命周期
```
init → updateProgress(正常值) → 条件满足 → completed → claimReward → totalPoints 正确累加
```
**验证点**: totalPoints 精确值、dimensionStats 更新、completedAt 非空

### T1.2 链式成就流程
```
前置成就 completed+claimed → 后续成就自动 unlocked → updateProgress → completed → claimed
```
**验证点**: chainProgress 推进、completedChains 追加

### T1.3 批量进度更新
```
updateProgressFromSnapshot(snapshot) → 多维度同时更新 → 各维度独立判定
```
**验证点**: 每个维度成就独立完成、互不干扰

### T1.4 保存/加载往返
```
getSaveData() → 序列化 → loadSaveData() → 状态完全恢复
```
**验证点**: totalPoints、progress、status、completedChains 一致

---

## T2: Error Path（异常路径）— 权重 25%

### T2.1 loadSaveData 异常输入
```
loadSaveData(null) → 静默拒绝
loadSaveData(undefined) → 静默拒绝
loadSaveData({}) → 静默拒绝
loadSaveData({ state: null }) → 静默拒绝
loadSaveData({ state: {}, version: wrong }) → 版本不匹配拒绝
```
**验证点**: 系统状态不变、不抛异常

### T2.2 loadSaveData 字段缺失/异常
```
loadSaveData({ state: { achievements: null } }) → 拒绝加载
loadSaveData({ state: { dimensionStats: null } }) → 拒绝加载
loadSaveData({ state: { totalPoints: NaN } }) → fallback 0
loadSaveData({ state: { totalPoints: -1 } }) → fallback 0
loadSaveData({ state: { totalPoints: Infinity } }) → fallback 0
loadSaveData({ state: { completedChains: null } }) → fallback []
```
**验证点**: FIX-ACH-402 穿透验证

### T2.3 claimReward 异常积分
```
配置 achievementPoints = NaN → claimReward → totalPoints 不变
配置 achievementPoints = 0 → claimReward → totalPoints 不变
配置 achievementPoints = -1 → claimReward → totalPoints 不变
配置 achievementPoints = Infinity → claimReward → totalPoints 不变
```
**验证点**: FIX-ACH-406 穿透验证

### T2.4 updateProgress 异常值
```
updateProgress(type, NaN) → 拒绝更新
updateProgress(type, Infinity) → 拒绝更新
updateProgress(type, -1) → 拒绝更新
```
**验证点**: FIX-901 防护

### T2.5 已有 NaN 进度穿透
```
loadSaveData(含 NaN progress) → updateProgress(正常值) → 进度正确更新
```
**验证点**: FIX-ACH-403 穿透验证

---

## T3: Boundary（边界条件）— 权重 25%

### T3.1 进度边界值
```
progress = target - 1 → 未完成
progress = target → 完成
progress = target + 1 → 完成
progress = MAX_SAFE_INTEGER → 正常处理
```

### T3.2 totalPoints 边界
```
totalPoints = 0 → 正确
totalPoints = Number.MAX_SAFE_INTEGER → 正确
totalPoints = 0.5（浮点） → 正确处理
```

### T3.3 空状态边界
```
init 后无任何进度 → getSaveData 正确
空 achievements 对象 → loadSaveData 补全
无 completedChains → getSaveData 返回空数组
```

### T3.4 getSaveData 深拷贝验证
```
getSaveData() → 修改返回值的 progress → 内部状态不变
getSaveData() → 修改返回值的 status → 内部状态不变
```
**验证点**: FIX-ACH-404 穿透验证

---

## T4: Cross-System（跨系统交互）— 权重 15%

### T4.1 事件监听器覆盖
```
emit('battle:victory') → 对应成就进度更新
emit('hero:recruit') → 对应成就进度更新
emit('quest:complete') → 对应成就进度更新
emit('resource:gain') → 对应成就进度更新
emit('dimension:unlock') → 对应成就进度更新
```
**验证点**: 5 个事件全覆盖

### T4.2 保存/加载与进度交互
```
updateProgress → getSaveData → loadSaveData → updateProgress → 正确累积
```
**验证点**: 往返一致性

### T4.3 reset 跨系统一致性
```
完成成就 → reset → totalPoints=0, 所有成就=locked, completedChains=[]
```
**验证点**: reset 彻底性

---

## T5: Data Lifecycle（数据生命周期）— 权重 15%

### T5.1 引用隔离
```
getSaveData 返回值修改 → 不影响内部状态
getState 返回值修改 → 不影响内部状态
```
**验证点**: 不可变性

### T5.2 补全机制
```
loadSaveData(缺少部分成就) → 补全后成就数量 = ALL_ACHIEVEMENTS.length
loadSaveData(包含已删除成就) → 保留但不影响
```
**验证点**: FIX-ACH-402/405 补全逻辑

### T5.3 链式进度生命周期
```
链中部分完成 → 保存 → 加载 → 链进度恢复 → 继续完成 → 链完成
```
**验证点**: chainProgress 持久化

---

## R2 新增分支（针对 R1 P1 建议）

### T2.6 reset callback 清理
```
设置 rewardCallback → reset → rewardCallback 被清空
```
**验证点**: R1 P1-3 建议

### T4.4 rewardCallback NaN 防护
```
rewardCallback 返回 NaN → totalPoints 不受影响
```
**验证点**: R1 P1-4 建议

---

## 分支统计

| 类别 | 分支数 | R1 覆盖 | R2 新增 |
|------|--------|---------|---------|
| Normal | 4 | 4 | 0 |
| Error | 6 | 4 | 2 |
| Boundary | 4 | 3 | 1 |
| Cross | 4 | 3 | 1 |
| Lifecycle | 3 | 2 | 1 |
| **总计** | **21** | **16** | **5** |

R2 新增 5 个分支，重点验证 P0 修复穿透和 P1 遗留场景。
