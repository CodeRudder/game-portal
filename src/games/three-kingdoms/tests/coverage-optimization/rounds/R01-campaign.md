# Round 1: campaign 模块盲区扫描

## 扫描结果
- 发现无覆盖文件: 12个（排除已有测试的 CampaignProgressSystem、RewardDistributor、SweepSystem、campaign-config）
- 新增测试文件: 6个
- 新增测试用例: 165个

## 新增测试文件明细

### 1. VIPSystem.test.ts (59 tests)
- **初始状态与 ISubsystem 接口**: 新建实例初始状态、getState、reset、name、update
- **经验与等级**: addExp 正/零/负值、等级判定边界值(0~6+超限)、getNextLevelExp、getLevelProgress
- **特权校验**: 7种特权逐级验证、getExtraDailyTickets(VIP0/1/4/6)、getOfflineHoursBonus/Limit
- **免费扫荡**: VIP0无权限、VIP5有3次、每日重置、跨日重置、VIP5以下拒绝
- **GM命令**: gmSetLevel 正常/负数钳制/超限钳制、gmResetLevel、GM特权覆盖/恢复
- **序列化**: serialize/deserialize、版本不匹配忽略、null数据忽略、GM模式清除
- **静态方法**: getLevelTable、getLevelConfig 存在/不存在

### 2. ChallengeStageSystem.test.ts (51 tests)
- **初始化与查询**: 进度初始化、getStageConfigs/getStageConfig/getStageProgress、isFirstCleared、reset
- **前置校验**: 资源充足/不足(兵力/天命)、关卡不存在、每日次数用完、错误提示含数量
- **资源预锁**: 成功扣减、不存在关卡、重复预锁、兵力不足、天命不足、扣减失败回滚
- **挑战完成**: 胜利奖励/首通奖励/非首通/武将经验/碎片奖励、无预锁边界、失败返还/不增次数
- **概率掉落**: rng=0必触发、rng=1不触发、无掉落关卡
- **每日重置**: 跨日重置、同日不重置
- **序列化**: serialize/deserialize、版本不匹配、null数据、预锁清除
- **完整流程**: 校验→预锁→胜利→奖励、校验→预锁→失败→返还、序列化→反序列化→继续
- **默认配置**: DEFAULT_CHALLENGE_STAGES 加载

### 3. CampaignSerializer.test.ts (10 tests)
- **serializeProgress**: 空进度、含状态进度、深拷贝验证
- **deserializeProgress**: 有效数据、版本不匹配抛异常、新关卡补全、空存档初始化、深拷贝、round-trip
- **常量**: SAVE_VERSION

### 4. campaign-utils.test.ts (14 tests)
- **mergeResources**: 空目标/累加/零值/负值/undefined/多类型/空source/多次合并
- **mergeFragments**: 空目标/累加/零值/负值/多武将/空source

### 5. AutoPushExecutor.test.ts (19 tests)
- **初始化与进度**: 初始进度、ISubsystem接口(name/update/getState/reset)
- **执行**: 无最远关卡、三星用扫荡令、扫荡令不足模拟战斗、未三星模拟战斗、战斗失败停止、最大尝试次数、关卡不可挑战、跨章推进、进度标记、汇总资源
- **边界条件**: maxAttempts=0、最后一关无下一关、多次执行

### 6. challenge-stages.test.ts (12 tests)
- **配置数据完整性**: 8个关卡、ID格式/唯一性/范围、名称非空、消耗正数/递增、固定奖励/首通奖励/概率掉落

## 覆盖的源文件

| 源文件 | 覆盖的函数/方法 | 测试文件 |
|--------|----------------|----------|
| VIPSystem.ts | addExp, getExp, getBaseLevel, getEffectiveLevel, getNextLevelExp, getLevelProgress, hasPrivilege, canUseSpeed3x/Instant, canUseFreeSweep, getExtraDailyTickets, getOfflineHoursBonus/Limit, getFreeSweepRemaining, useFreeSweep, gmSetLevel, gmResetLevel, isGMMode, serialize, deserialize, getState, reset, getLevelTable, getLevelConfig | VIPSystem.test.ts |
| ChallengeStageSystem.ts | getStageConfigs, getStageConfig, getStageProgress, getDailyAttempts, getDailyRemaining, isFirstCleared, checkCanChallenge, preLockResources, completeChallenge, calculateRewards(间接), resetDailyIfNeeded(间接), serialize, deserialize, getState, reset | ChallengeStageSystem.test.ts |
| CampaignSerializer.ts | serializeProgress, deserializeProgress, SAVE_VERSION | CampaignSerializer.test.ts |
| campaign-utils.ts | mergeResources, mergeFragments | campaign-utils.test.ts |
| AutoPushExecutor.ts | execute, getProgress, resetProgress, getNextStage(间接), emptyResult(间接), getState, reset | AutoPushExecutor.test.ts |
| challenge-stages.ts | DEFAULT_CHALLENGE_STAGES 数据完整性 | challenge-stages.test.ts |

## 发现的问题

### P2 — 设计问题: ChallengeStageSystem.preLockResources 未传递 now 参数
- **位置**: `ChallengeStageSystem.ts` → `preLockResources()` 方法
- **复现步骤**: 调用 `preLockResources(stageId)` 时，内部调用 `checkCanChallenge(stageId)` 不传 `now`，导致使用 `Date.now()` 而非可控时间
- **预期行为**: `preLockResources` 应接受可选的 `now` 参数并传递给 `checkCanChallenge`
- **实际行为**: 始终使用 `Date.now()`，导致测试中无法精确控制每日重置
- **影响**: 在生产环境中不影响功能（均使用真实时间），但降低了可测试性
- **建议修复**: 
  ```typescript
  preLockResources(stageId: string, now?: number): boolean {
    // ...
    const check = this.checkCanChallenge(stageId, now);
    // ...
  }
  ```

### P3 — 设计观察: VIPSystem.init 接受 ISystemDeps 但未实际使用
- VIPSystem 的 `init(deps)` 存储了 `sysDeps` 但从未使用。当前为无操作设计，不影响功能。

## 评估指标
- Campaign模块 BSI (Blind Spot Index): 80% → 30%
  - 新增覆盖文件: 6个（VIPSystem, ChallengeStageSystem, CampaignSerializer, campaign-utils, AutoPushExecutor, challenge-stages）
  - 新增测试用例: 165个
  - 剩余未覆盖: campaign-chapter1~6 (数据文件), campaign.types (纯类型), sweep.types (纯类型), index (导出文件)
  - 注: 剩余未覆盖文件均为纯数据/类型/导出文件，不含可测试的业务逻辑
