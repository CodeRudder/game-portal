# Prestige（声望）模块对抗式测试报告

## 模块概览

| 文件 | 公开API | 测试文件 |
|------|---------|----------|
| PrestigeSystem.ts | addPrestigePoints, getPrestigePanel, getLevelInfo, getProductionBonus, claimLevelReward, getPrestigeQuests, getRebirthQuests, checkPrestigeQuestCompletion, getSaveData, loadSaveData | PrestigeSystem.adversarial.test.ts |
| PrestigeShopSystem.ts | buyGoods, canBuyGoods, getAllGoods, getUnlockedGoods, updatePrestigeInfo, loadPurchases, getPurchaseHistory | PrestigeShopSystem.adversarial.test.ts |
| RebirthSystem.ts | checkRebirthConditions, executeRebirth, getCurrentMultiplier, getNextMultiplier, getAcceleration, getEffectiveMultipliers, getUnlockContents, simulateEarnings, simulateEarningsV16 | RebirthSystem.adversarial.test.ts |
| RebirthSystem.helpers.ts | getInitialGift, getInstantBuildConfig, calculateBuildTime, getAutoRebuildPlan, getUnlockContentsV16, isFeatureUnlocked, generatePrestigeGrowthCurve, compareRebirthTiming, simulateEarningsV16 | RebirthSystem.helpers.adversarial.test.ts |

## 五维度测试覆盖

### F-Normal: 主线流程完整性
- ✅ 声望获取与累计
- ✅ 声望等级自动提升
- ✅ 产出加成随等级增长
- ✅ 声望分栏信息展示
- ✅ 商店商品展示与购买
- ✅ 转生条件检查与执行
- ✅ 转生倍率递增
- ✅ 转生加速效果
- ✅ 保留/重置规则
- ✅ v16.0深化功能（初始赠送、瞬间建筑、一键重建）

### F-Boundary: 边界条件覆盖
- ✅ 每日上限精确截断（刚好达到/超出1点）
- ✅ 无上限途径（dailyCap=-1）
- ✅ 0声望值获取
- ✅ 极大声望值（MAX_SAFE_INTEGER）
- ✅ 最大等级50后不再升级
- ✅ 刚好在升级阈值的声望值
- ✅ 连续跳级
- ✅ 商品限购精确达到
- ✅ 声望值刚好等于/差1于商品价格
- ✅ 转生条件刚好满足/差1不满足
- ✅ 加速天数衰减到0
- ✅ 倍率不超过最大值10.0
- ✅ 建筑等级边界（maxInstantLevel）

### F-Error: 异常路径覆盖
- ✅ 负数声望值
- ✅ NaN声望值（暴露未处理问题）
- ✅ Infinity声望值
- ✅ 重复领取等级奖励
- ✅ 等级不足领取奖励
- ✅ 无效等级奖励
- ✅ 无效声望来源类型
- ✅ 不存在的商品
- ✅ 等级不足购买
- ✅ 声望值为0/负数购买
- ✅ 条件不满足时转生
- ✅ 回调未设置时行为
- ✅ 未初始化系统调用

### F-Cross: 跨系统交互覆盖
- ✅ 事件监听（prestige:gain, calendar:dayChanged）
- ✅ 升级事件发射（prestige:levelUp）
- ✅ 奖励回调触发
- ✅ 转生状态回调
- ✅ 转生完成事件（rebirth:completed）
- ✅ 加速结束事件（rebirth:accelerationEnded）
- ✅ 商店等级解锁事件
- ✅ 购买事件发射
- ✅ 收益模拟器结果合理性
- ✅ v16收益模拟器增长曲线

### F-Lifecycle: 数据生命周期覆盖
- ✅ 存档数据结构完整性
- ✅ 存档加载恢复
- ✅ 版本不匹配拒绝加载
- ✅ 存档深拷贝不影响原状态
- ✅ reset恢复初始状态
- ✅ 声望任务进度存档
- ✅ 转生记录持久化
- ✅ 多次转生存档加载
- ✅ 购买记录加载
- ✅ 商店reset

## 发现的潜在问题

### P2: NaN声望值未防御
- **位置**: `PrestigeSystem.addPrestigePoints()`
- **复现**: `sys.addPrestigePoints('battle_victory', NaN)`
- **预期**: 返回0或抛出错误
- **实际**: 返回NaN，状态被NaN污染
- **建议**: 添加 `Number.isFinite(basePoints)` 检查

### P3: 声望值无上限
- **位置**: `PrestigeSystem.addPrestigePoints()`
- **复现**: `sys.addPrestigePoints('main_quest', Number.MAX_SAFE_INTEGER)`
- **预期**: 可能有软上限
- **实际**: currentPoints可无限增长
- **建议**: 评估是否需要声望值上限

## 测试统计

| 维度 | 用例数 |
|------|--------|
| F-Normal | 28 |
| F-Boundary | 32 |
| F-Error | 20 |
| F-Cross | 18 |
| F-Lifecycle | 15 |
| **总计** | **113** |
