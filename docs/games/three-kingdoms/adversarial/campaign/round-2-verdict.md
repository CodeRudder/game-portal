# Campaign模块仲裁裁决 — Round 2

> 仲裁者: TreeArbiter (Tester Agent)
> 裁决时间: 2025-06-19
> 依据文件: round-2-tree.md, round-2-challenges.md, round-1-tree.md, round-1-verdict.md

---

## 评分

| 维度 | R1分数 | R2分数 | 变化 | 说明 |
|------|--------|--------|------|------|
| 完备性 | 7.5 | **8.5** | +1.0 | 总节点从298增至393（+95），API覆盖率从79%提升至约88%。新增22个跨系统节点（VIP↔Sweep、引擎存档、装备/联盟/远征集成）和25个生命周期节点（扫荡/VIP/reset/存档恢复全链路）。最重大发现是engine-save.ts不保存SweepSystem/VIPSystem/ChallengeStageSystem数据，这是R1未识别的P0级数据丢失缺陷。扣分项：①联盟/远征与Campaign的集成在源码中无任何引用，4个节点标注"需PRD确认"无法直接测试；②装备系统集成只有间接引用（EquipmentDropWeights引用CampaignType），无直接交互测试节点。 |
| 准确性 | 8.0 | **8.5** | +0.5 | R2通过源码grep验证修正了R1的2个虚报（VIPSystem.deserialize和ChallengeStageSystem.deserialize已有null防护），新增节点均经过源码行级别验证。AutoPushExecutor异常分析从1个点扩展到7个异常卡死点，准确识别了循环内所有外部调用的风险。扣分项：①XI-ALLY-001~004和XI-EXP-001~004共8个节点标注"源码无引用，需PRD确认"，这些节点的预期结果不够明确；②P0-NaN-001的描述"stars不变但clearCount++"是正确的，但对实际游戏影响评估不足（实际上不影响游戏逻辑，因为stars保持原值）。 |
| 优先级 | 8.5 | **8.5** | 0 | P0/P1/P2分布合理：P0=145(36.9%)、P1=161(41.0%)、P2=87(22.1%)。R1的XI-010优先级已从P1提升至P0。新增P0节点主要集中在：engine-save存档缺失（4个）、VIP集成缺失（5个）、AutoPush异常卡死（4个）、deserialize null（2个）、rollDropTable异常（2个）。扣分项：①P0-NaN-004(string '3')标P2偏低，应标P1（类型混淆是常见运行时问题）；②XI-ALLY和XI-EXP节点标P2合理，因为源码无集成。 |
| 可测试性 | 8.0 | **8.5** | +0.5 | R2节点保持了R1的高质量设计（ID/类型/描述/前置条件/预期结果/状态/优先级七要素）。新增的P0验证节点（P0-VIP-001~005, P0-DESER-001~007, P0-APE-001~004, P0-NaN-001~005, P0-LOCK-001~003）结构清晰，每个都包含复现步骤和源码行引用。生命周期节点按系统分组（LC-SWEEP/LC-VIP/LC-RESET/LC-SAVE/LC-E2E），便于批量编写测试。扣分项：①部分跨系统节点（XI-ALLY/XI-EXP）因源码无集成而无法编写测试用例；②P0-LOCK-002（双重异常）缺少具体的mock方案。 |
| 挑战应对 | 7.0 | **8.0** | +1.0 | R2挑战者进行了深度源码验证，修正了R1的2个虚报，发现了R1未识别的最严重缺陷（engine-save存档缺失）。AutoPushExecutor异常分析从1个点扩展到7个点。新增6个P0级结构性风险（engine-save存档缺失、SweepSystem无VIP依赖、distribute fragments:null崩溃、rollDropTable rng异常值）。扣分项：①联盟/远征集成分析停留在"源码无引用"层面，未进一步分析PRD需求或UI层是否有集成；②对XI-EQP（装备集成）的分析不够深入，EquipmentSystem.generateCampaignDrop是已有的集成点但未被测试覆盖。 |

| **总分** | **7.4/10** | **8.4/10** | **+1.0** | |

---

## 维度覆盖率评估

| 维度 | R1覆盖率 | R2覆盖率 | 门槛 | 达标 |
|------|---------|---------|------|------|
| API覆盖率 | 79% | **88%** | ≥92% | ❌ |
| 跨系统交互覆盖率 | 47% | **65%** | ≥75% | ❌ |
| 数据生命周期覆盖率 | 50% | **63%** | ≥70% | ❌ |
| P0节点covered率 | 90.2% | **91.0%** | ≥98% | ❌ |
| 虚报节点数 | ≥3 | **0** | 0 | ✅ |
| null防护测试 | 0 | **4/6系统** | 核心全覆盖 | ❌ |
| VIP集成测试 | 0 | **0（设计缺失）** | 免费扫荡+额外令牌 | ❌ |
| 异常路径simulateBattle | 0 | **7个异常点** | ≥2种场景 | ✅ |

---

## 裁决

- **封版: NO**
- **原因:**

### 1. 未达封版门槛（9.0分），总分8.4

总分8.4低于封版线9.0，主要因为API覆盖率(88%<92%)、跨系统交互覆盖率(65%<75%)、数据生命周期覆盖率(63%<70%)三项核心指标未达标。

### 2. 发现新的P0级生产缺陷

R2发现了一个R1未识别的**最严重缺陷**：

**engine-save.ts不保存SweepSystem/VIPSystem/ChallengeStageSystem数据**

- `buildSaveData()` 只保存 `ctx.campaign.serialize()`（CampaignProgressSystem）
- SweepSystem的扫荡令数量、VIPSystem的VIP等级和经验、ChallengeStageSystem的挑战进度**在引擎级保存时完全丢失**
- 玩家每次重新加载游戏都会失去所有VIP等级、扫荡令和挑战进度
- 这是**数据丢失级别**的生产缺陷，影响所有使用这些系统的玩家
- 修复需要在engine-save.ts中添加这三个系统的序列化/反序列化，并扩展GameSaveData类型

### 3. VIP付费功能无法生效

SweepSystem完全没有VIPSystem依赖注入：
- VIP5免费扫荡3次/日 → SweepSystem.sweep()直接消耗扫荡令
- VIP1+/VIP4+额外扫荡令 → SweepSystem.claimDailyTickets()不查询VIPSystem
- 这是**付费功能失效**级别缺陷，影响VIP付费用户体验

### 4. AutoPushExecutor异常安全不足

循环内7个外部调用点（canChallenge/getStageStars/calculateRewards/simulateBattle/completeStage/mergeResources/getNextStage）无任何try-catch保护，任何异常都导致isRunning永久为true。

### 5. R1的5个P0修复状态

| P0 | R1描述 | R2状态 | 说明 |
|----|--------|--------|------|
| P0-01 | VIP与Campaign集成缺失 | **确认，扩展** | 不仅SweepSystem无VIP集成，engine-save也不保存VIP数据 |
| P0-02 | 6个系统deserialize(null)崩溃 | **部分修正** | 实际只有2个崩溃（CampaignSerializer、SweepSystem），VIPSystem和ChallengeStageSystem已有null防护 |
| P0-03 | AutoPushExecutor isRunning卡死 | **确认，扩展** | 从1个异常点扩展到7个异常点 |
| P0-04 | stars=NaN导致星级异常 | **确认** | NaN传入不影响stars但增加clearCount，实际影响较低 |
| P0-05 | 预锁资源回滚竞态 | **确认** | consumeResource抛异常时资源泄漏 |

---

## Round 3 要求

### 1. 优先补充（P0 — 必须完成）

| # | 内容 | 类型 | 预期新增节点 | 说明 |
|---|------|------|-------------|------|
| R3-01 | **engine-save集成修复验证** | F-Cross | ~8 | 修复engine-save.ts后验证：buildSaveData包含sweep/vip/challenge、restoreSaveData恢复三个系统、GameSaveData类型扩展、版本迁移兼容 |
| R3-02 | **VIP→SweepSystem集成修复验证** | F-Cross | ~8 | 修复SweepSystem构造函数接受VIPSystem后验证：免费扫荡优先消耗、额外扫荡令领取、VIP等级变化实时生效 |
| R3-03 | **AutoPushExecutor try-finally修复验证** | F-Error | ~7 | 修复后验证：7个异常点都不再导致isRunning卡死、resetProgress可强制重置 |
| R3-04 | **CampaignSerializer/SweepSystem null防护修复验证** | F-Error | ~4 | 修复后验证：deserialize(null)不崩溃、返回初始状态或抛出友好错误 |
| R3-05 | **RewardDistributor.distribute null防护修复验证** | F-Error | ~3 | 修复后验证：distribute(null/undefined/fragments:null)不崩溃 |
| R3-06 | **rollDropTable rng校验修复验证** | F-Error | ~3 | 修复后验证：rng返回NaN/>1/<0时不影响掉落逻辑 |

### 2. 重点改进（P1 — 应完成）

| # | 内容 | 类型 | 预期新增节点 | 说明 |
|---|------|------|-------------|------|
| R3-07 | **EquipmentSystem↔Campaign集成测试** | F-Cross | ~4 | EquipmentSystem.generateCampaignDrop被CampaignType驱动，需验证campaign掉落→装备生成链路 |
| R3-08 | **ChallengeStageSystem预锁try-catch修复验证** | F-Error | ~3 | 修复后验证：consumeResource异常时资源不泄漏 |
| R3-09 | **completeStage NaN防护修复验证** | F-Boundary | ~3 | 修复后验证：NaN/undefined/string传入时截断为0 |
| R3-10 | **跨系统交互补充覆盖** | F-Cross | ~6 | 覆盖剩余missing跨系统节点，使覆盖率≥75% |

### 3. 建议改进（P2 — 可选）

| # | 内容 | 说明 |
|---|------|------|
| R3-11 | 联盟/远征集成PRD确认 | 确认是否需要Campaign↔联盟/远征集成 |
| R3-12 | 大量扫荡性能基准 | sweep(stageId, 10)×100次性能测试 |
| R3-13 | ticketCount/vipExp溢出防护 | Number.MAX_SAFE_INTEGER边界 |
| R3-14 | 跨年日期处理 | claimDailyTickets跨年日期变化 |

---

## Round 3 封版门槛

| 指标 | Round 2 现状 | Round 3 门槛 |
|------|-------------|-------------|
| 总分 | 8.4 | ≥9.0 |
| API覆盖率 | 88% | ≥95% |
| 跨系统交互覆盖率 | 65% | ≥80% |
| 数据生命周期覆盖率 | 63% | ≥75% |
| P0节点covered率 | 91.0% | ≥98% |
| P0缺陷修复验证 | 0/6 | 6/6 |
| engine-save集成 | 缺失 | 完整 |
| VIP集成 | 缺失 | 完整 |
| AutoPush异常安全 | 0/7 | 7/7 |

> **预期Round 3新增节点: ~50~60个（以修复验证为主），总节点数达到~445~455个。**

---

## 关键发现总结

### ✅ R2改进

1. **虚报修正**: 修正了R1的2个虚报（VIPSystem.deserialize和ChallengeStageSystem.deserialize已有null防护），提高了准确性
2. **源码深度验证**: 通过grep/read_file对每个P0进行了源码行级别验证，确认了真实性
3. **最严重缺陷发现**: 发现engine-save.ts不保存Sweep/VIP/Challenge数据，这是R1未识别的最高优先级缺陷
4. **AutoPush分析深化**: 从1个异常点扩展到7个异常点，全面识别了循环内的风险
5. **跨系统覆盖大幅提升**: 从30个节点增至52个（+73%），从47%覆盖率提升至65%
6. **生命周期覆盖大幅提升**: 从18个节点增至43个（+139%），从50%覆盖率提升至63%

### ❌ 仍需改进

1. **engine-save存档缺失是最高优先级缺陷**: 影响所有玩家的数据丢失
2. **VIP付费功能无法生效**: SweepSystem无VIP依赖注入
3. **API覆盖率88%仍低于92%门槛**: 约12个API未覆盖
4. **跨系统交互65%仍低于75%门槛**: 需要更多装备/联盟/远征集成节点
5. **数据生命周期63%仍低于70%门槛**: 需要更多端到端生命周期节点
