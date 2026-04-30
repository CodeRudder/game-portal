# Campaign模块仲裁裁决 — Round 1

> 仲裁者: TreeArbiter (PM Agent)
> 裁决时间: 2025-06-18
> 依据文件: round-1-tree.md, round-1-challenges.md

---

## 评分

| 维度 | 分数 | 说明 |
|------|------|------|
| 完备性 | **7.5/10** | 树覆盖了10个子系统、298个节点、94个公开API中的约74个（79%）。核心系统（CampaignSerializer/campaign-config/campaign-utils/challenge-stages）API覆盖率达100%。CampaignProgressSystem 93%、RewardDistributor 92%。但存在明显盲区：①跨系统交互30节点中16个missing（覆盖率47%），②数据生命周期18节点中9个missing（覆盖率50%），③20个API完全未出现在树中。VIPSystem与SweepSystem/ChallengeStageSystem的集成是最突出的遗漏——VIP特权（免费扫荡、额外扫荡令）在SweepSystem中完全没有体现。 |
| 准确性 | **8.0/10** | 已枚举节点的描述与源码逻辑高度吻合。星级评定规则（★=通关, ★★=存活≥4, ★★★=存活≥4+回合≤6）、奖励倍率（★×1.0, ★★×1.5, ★★★×2.0）、扫荡条件（三星通关）、章节解锁链（前置章节BOSS关通关→下一章解锁）等关键参数描述准确。扣分项：①树中RD-calc-004标注stars=0时starMultiplier=0，但源码实际是STAR_MULTIPLIERS[0]=0，准确；②XI-009 VIP→免费扫荡标missing但源码中SweepSystem完全没有VIP集成代码，这是设计层面的缺失而非测试缺失；③部分跨系统节点（XI-015 serialize→deserialize→completeStage）标missing但CampaignSerializer.test.ts有部分间接覆盖。 |
| 优先级 | **8.5/10** | P0/P1/P2分布合理：P0=112(37.6%)、P1=134(45.0%)、P2=52(17.4%)。核心进度路径（初始化、通关、解锁、星级评定、奖励计算）均标记为P0。挑战者识别的6个结构性风险全部为P0级，与树中优先级一致。扣分项：①XI-009 VIP→免费扫荡标P0正确，但XI-010 VIP→额外扫荡令仅标P1，作为VIP付费核心功能应提升至P0；②APE-exec-010 simulateBattle异常标P0正确，但源码中progress.isRunning卡在true的风险未在树中体现；③部分campaign-config查询节点标P0偏高（getStage不存在返回undefined是P1级别的防御性检查）。 |
| 可测试性 | **8.0/10** | 节点设计质量高：每个节点包含ID、类型、描述、前置条件、预期结果、测试状态、优先级七要素，可直接转化为测试用例。ID命名规范（系统前缀-功能-序号）便于追踪。五种类型分类清晰。扣分项：①跨系统交互节点缺少"验证步骤"（如XI-009仅说"VIP→免费扫荡"但未说明VIPSystem和SweepSystem如何集成）；②部分lifecycle节点（LC-008全系统reset）范围模糊，未明确reset的调用者；③missing节点未提供"关键断言点"或"最小复现代码"。 |
| 挑战应对 | **7.0/10** | 挑战者发现了重要的结构性遗漏：①F-Error遗漏24项——最突出的是6个P0级null防护缺失（CampaignProgressSystem/RewardDistributor/SweepSystem/ChallengeStageSystem/CampaignSerializer的deserialize传入null）；②F-Boundary遗漏24项——stars=NaN导致星级变为NaN、概率=1掉落、空掉落表等；③F-Cross遗漏15项——VIP→免费扫荡、进度→扫荡→推图完整链路、存档恢复后继续游戏等核心交互缺失；④F-Lifecycle遗漏12项——扫荡系统完整生命周期、VIP完整生命周期、全系统reset等。挑战者还识别了6个结构性风险并提供了源码级别分析。扣分项：①挑战者对部分已有间接测试覆盖的场景标为missing存在虚报（XI-015在CampaignSerializer.test.ts有部分覆盖）；②未识别"SweepSystem与VIPSystem集成缺失是设计问题还是测试问题"——源码中SweepSystem完全没有VIPSystem依赖注入，这不仅是测试缺失而是功能缺失。 |

| **总分** | **7.4/10** | |

---

## 裁决

- **封版: NO**
- **原因:**

  1. **跨系统交互覆盖率严重不足**：30个跨系统节点中16个missing（47%），远低于封版要求的≥70%。最关键的缺失包括：VIP→免费扫荡集成（VIP付费核心功能）、进度→扫荡→推图完整链路（核心游戏循环）、存档恢复后继续游戏（存档可靠性）、多系统协同存档/恢复（数据完整性）。

  2. **VIPSystem与SweepSystem/ChallengeStageSystem集成缺失**：VIPSystem定义了免费扫荡（VIP5+）和额外扫荡令（VIP1+/VIP4+）特权，但SweepSystem完全没有引用VIPSystem。这是一个**设计层面的缺失**——VIP付费用户的核心特权在扫荡系统中无法生效。类似地，VIP特权对挑战关卡的影响也未定义。

  3. **P0级异常防护缺失**：
     - **6个系统的deserialize传入null会崩溃**：CampaignProgressSystem、SweepSystem、ChallengeStageSystem、CampaignSerializer、VIPSystem的deserialize在data=null时直接崩溃。这是存档损坏时的真实风险场景。
     - **RewardDistributor.distribute(null)崩溃**：公开API无null防护。
     - **AutoPushExecutor.simulateBattle异常导致progress.isRunning卡死**：异常后循环中断，isRunning永远为true。
     - **ChallengeStageSystem.preLockResources回滚竞态**：consumeResource抛出异常时资源泄漏。

  4. **数据生命周期覆盖率不足**：18个生命周期节点中9个missing（50%），低于封版要求的≥65%。扫荡系统完整生命周期、VIP系统完整生命周期、全系统reset、旧存档升级等核心生命周期缺失。

  5. **边界条件遗漏**：stars=NaN导致星级变为NaN是最严重的边界遗漏。虽然不会崩溃，但会导致关卡状态异常（cleared但星级为NaN）。概率=1掉落、空掉落表、minAmount>maxAmount等边界也需要覆盖。

---

## Round 2 要求

### 1. 优先补充（P0 — 必须完成）

| # | 内容 | 类型 | 预期新增节点 | 说明 |
|---|------|------|-------------|------|
| R2-01 | **null防护测试节点** | F-Error | ~12 | 为CampaignProgressSystem/RewardDistributor/SweepSystem/ChallengeStageSystem/CampaignSerializer/VIPSystem的deserialize分别补充null/undefined的异常路径节点 |
| R2-02 | **distribute null防护** | F-Error | ~4 | RewardDistributor.distribute传入null/undefined/不完整reward的异常路径 |
| R2-03 | **stars=NaN/Infinity防护** | F-Boundary | ~4 | completeStage传入NaN/Infinity/非数字的边界验证 |
| R2-04 | **VIP→免费扫荡集成** | F-Cross | ~6 | VIP5免费扫荡3次/日→SweepSystem集成→扫荡不消耗扫荡令。需确认是设计缺失还是测试缺失 |
| R2-05 | **VIP→额外扫荡令集成** | F-Cross | ~4 | VIP1+额外1扫荡令、VIP4+额外2扫荡令→SweepSystem每日领取 |
| R2-06 | **进度→扫荡→推图完整链路** | F-Cross | ~6 | CampaignProgressSystem.completeStage→SweepSystem.canSweep→AutoPushExecutor.execute端到端 |
| R2-07 | **存档恢复后继续游戏** | F-Cross | ~6 | serialize→deserialize→completeStage→canSweep→sweep，验证恢复后功能正常 |
| R2-08 | **AutoPushExecutor异常处理** | F-Error | ~4 | simulateBattle抛出异常→progress.isRunning正确重置→不卡死 |
| R2-09 | **扫荡系统完整生命周期** | F-Lifecycle | ~6 | addTickets→claimDaily→sweep→serialize→deserialize→sweep |
| R2-10 | **全系统reset生命周期** | F-Lifecycle | ~6 | 使用所有系统→reset→验证所有系统回到初始状态 |

### 2. 重点改进（P1 — 应完成）

| # | 内容 | 类型 | 预期新增节点 | 说明 |
|---|------|------|-------------|------|
| R2-11 | **VIP系统完整生命周期** | F-Lifecycle | ~6 | addExp→升级→特权→免费扫荡→serialize→deserialize |
| R2-12 | **概率=1掉落验证** | F-Boundary | ~3 | rollDropTable中probability=1必掉、probability=0必不掉 |
| R2-13 | **空掉落表/空奖励配置** | F-Boundary | ~4 | dropTable=[]、baseRewards={}、firstClearRewards={} |
| R2-14 | **preLockResources回滚安全** | F-Error | ~4 | consumeResource抛出异常时资源不泄漏 |
| R2-15 | **VIP存档恢复后特权校验** | F-Cross | ~4 | serialize→deserialize→hasPrivilege正确 |
| R2-16 | **多系统协同存档/恢复** | F-Cross | ~6 | Campaign+Sweep+VIP+Challenge全部serialize→deserialize→功能正常 |
| R2-17 | **ChallengeStageSystem→VIPSystem** | F-Cross | ~3 | VIP是否影响挑战次数/资源消耗 |
| R2-18 | **多次serialize/deserialize不丢失** | F-Lifecycle | ~4 | 连续序列化反序列化→数据完全一致 |
| R2-19 | **旧存档升级生命周期** | F-Lifecycle | ~4 | 旧版本存档→新版本反序列化→新关卡补全→旧进度保留 |

### 3. 建议改进（P2 — 可选）

| # | 内容 | 说明 |
|---|------|------|
| R2-20 | 未覆盖查询API补充 | AutoPushExecutor.getProgress/isRunning等状态查询 |
| R2-21 | getUnificationRewards→称号系统集成 | 天下一统奖励发放 |
| R2-22 | 大量扫荡性能 | sweep(stageId, 10)×100次的性能基准 |
| R2-23 | 跨年日期处理 | claimDailyTickets跨年日期变化 |
| R2-24 | ticketCount溢出 | addTickets(Number.MAX_SAFE_INTEGER) |
| R2-25 | rng注入返回异常值 | rng返回NaN/>1/<0时的行为 |

### 4. 修正要求

| # | 内容 | 说明 |
|---|------|------|
| R2-FIX-01 | 明确VIP→免费扫荡是设计缺失还是测试缺失 | 源码中SweepSystem完全没有VIPSystem依赖，需确认PRD是否要求集成 |
| R2-FIX-02 | 提升XI-010 VIP→额外扫荡令优先级 | 从P1提升至P0，VIP付费核心功能 |
| R2-FIX-03 | 补充CPS-comp-001 stars=NaN预期行为 | NaN传入应明确预期：截断为0 or 抛出错误 |
| R2-FIX-04 | 补充rollDropTable概率=1行为分析 | 确认rng()是否可能返回1.0，以及>vs>=的影响 |
| R2-FIX-05 | 修正XI-015状态 | 从missing改为partial，CampaignSerializer.test.ts有部分间接覆盖 |
| R2-FIX-06 | 补充APE-exec-010 isRunning卡死风险 | simulateBattle异常时progress.isRunning=true应被识别为P0风险 |

---

## Round 2 封版门槛

| 指标 | Round 1 现状 | Round 2 门槛 |
|------|-------------|-------------|
| API覆盖率 | ~79% | ≥92% |
| 跨系统交互覆盖率 | 47% | ≥75% |
| 数据生命周期覆盖率 | 50% | ≥70% |
| P0节点covered率 | 90.2% | ≥98% |
| 虚报节点数 | ≥3 | 0 |
| null防护测试 | 0 | 核心deserialize全覆盖 |
| VIP集成测试 | 0 | 免费扫荡+额外令牌覆盖 |
| 异常路径simulateBattle | 0 | ≥2种场景 |

> **预期Round 2新增节点: ~70~85个，总节点数达到~370~385个。**

---

## 关键发现总结

### ✅ 做得好的
1. **核心进度/奖励逻辑测试充分**：CampaignProgressSystem 93%、RewardDistributor 92% API覆盖率，星级评定、解锁链路、奖励计算等核心逻辑测试完善
2. **配置系统100%覆盖**：campaign-config/campaign-utils/challenge-stages/CampaignSerializer全部100%覆盖
3. **集成测试链路丰富**：15个集成测试文件覆盖了campaign-map、formation-panel、battle-scene、combat、mode、result、core-loop、hero-sync、resource-sync、sweep、vip-e2e、offline、challenge、exception、mobile等维度
4. **章节配置完整**：6章30关完整配置，含碎片映射、掉落表、推荐战力等
5. **VIP系统独立测试充分**：18个API中16个已测试（89%），含GM命令、免费扫荡、特权校验

### ❌ 需要改进的
1. **VIP与Campaign系统集成是最大短板**：VIPSystem定义了免费扫荡和额外扫荡令特权，但SweepSystem完全没有引用VIPSystem。这可能是设计层面的缺失（PRD未明确集成方式）或实现层面的遗漏
2. **异常输入防护不足**：6个系统的deserialize传入null会崩溃，distribute传入null会崩溃，stars=NaN导致星级异常
3. **AutoPushExecutor异常安全不足**：simulateBattle异常导致isRunning卡死，缺少try-catch防护
4. **跨系统生命周期不完整**：扫荡系统完整生命周期、VIP完整生命周期、全系统reset等缺失
5. **预锁资源回滚竞态**：ChallengeStageSystem.preLockResources在consumeResource抛出异常时资源泄漏
