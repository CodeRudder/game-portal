# R2-Builder: 三国霸业 Tech 模块 — 补充测试流程分支树

> **Builder**: TreeBuilder Agent (R2)  
> **日期**: 2025-07-09  
> **基于**: R1-verdict.md 仲裁裁决  
> **R2目标**: P0=0, 所有维度≥8.5, 综合≥9.0

---

## 一、R1缺陷修复确认

### 1.1 已确认代码缺陷（需开发修复）

| BUG ID | 描述 | 修复方案 | 测试前提 |
|--------|------|----------|----------|
| 🔴 BUG-MUTEX-01 | 互斥节点可同时入队 | `startResearch`中增加互斥组队列检查：同mutexGroup已有节点在队列中则拒绝 | 假设已修复，测试防护 |
| 🔴 BUG-EFFECT-01 | all+specific效果重复计算 | `getAttackBonus(target)`只匹配`target=specific`，不再匹配`all`；或`getBattleBonuses`中troopAtk排除all | 假设已修复，验证正确叠加 |
| 🔴 BUG-SPEED-01 | syncResearchSpeedBonus从未调用 | `engine-tech-deps.ts`中增加科技完成→同步速度加成的回调连接 | 假设已修复，验证E2E |
| 🟡 ARCH-SAVE-01 | FusionTechSystem.deserialize未同步联动 | deserialize末尾调用syncFusionLinksToLinkSystem | 假设已修复 |
| 🟡 ARCH-FUSION-01 | 融合科技效果不聚合到TechEffectSystem | TechEffectSystem.rebuildCache同时读取FusionTechSystem | 假设已修复 |

### 1.2 R2测试策略

- **修复验证测试**: 验证上述5个BUG的修复正确性
- **补充遗漏测试**: 覆盖R1 Challenger指出的28个遗漏点
- **增强链路测试**: 追踪数据从定义→聚合→分发→应用的完整路径

---

## 二、R2新增测试分支

### 维度 F-Normal: 补充3个分支

```
N-09: 研究速度加成完整E2E链路 [修复验证 BUG-SPEED-01]
  N-09-01: 文化科技→研究速度加成同步
    步骤: 
      1. 初始状态, researchSpeedBonus=0
      2. 完成cul_t2_academy(研究速度+15%)
      3. 验证pointSystem.syncResearchSpeedBonus(15)被调用
      4. 验证pointSystem.getResearchSpeedMultiplier() = 1.15
    覆盖: syncResearchSpeedBonus调用链

  N-09-02: 研究速度加成→实际研究时间缩短
    步骤:
      1. 完成cul_t2_academy(研究速度+15%)
      2. startResearch('mil_t2_charge'), baseTime=300s
      3. 验证actualTime = 300 / 1.15 ≈ 260.87s
      4. 验证endTime - startTime ≈ 260870ms
    覆盖: TechResearchSystem.startResearch speedMultiplier应用

  N-09-03: 多层研究速度叠加
    步骤:
      1. 完成cul_t2_academy(+15%) + cul_t3_scholar(+25%)
      2. 验证researchSpeedBonus = 40
      3. 验证multiplier = 1.40
      4. startResearch → actualTime = baseTime / 1.40

N-10: T1层互斥节点初始化与锁定 [修复验证 BUG-MUTEX-01]
  N-10-01: T1层双节点初始状态
    验证: mil_t1_attack.status='available', mil_t1_defense.status='available'
    (T1无前置依赖, refreshAllAvailability后应为available)

  N-10-02: T1互斥节点完成一个→另一个锁定
    步骤: completeNode('mil_t1_attack') → refreshAllAvailability
    验证: 
      - chosenMutexNodes = {mil_t1: 'mil_t1_attack'}
      - mil_t1_defense.status = 'locked'
      - canResearch('mil_t1_defense') = {can: false, reason: '互斥分支已选择其他节点'}

  N-10-03: T1互斥节点同时startResearch防护 [BUG-MUTEX-01修复验证]
    步骤:
      1. mil_t1_attack和mil_t1_defense都available
      2. startResearch('mil_t1_attack') → success
      3. 立即startResearch('mil_t1_defense')
    预期(修复后): 
      - 第二次被拒绝(reason: '互斥分支已有节点在研究中' 或类似)
    预期(修复前): 
      - 第二次成功(BUG)

N-11: TechDetailProvider完整详情验证
  N-11-01: locked节点详情
    验证: prerequisites列表含completed=false项, cost.sufficient可能为false

  N-11-02: available节点详情
    验证: prerequisites全部completed=true, cost.sufficient取决于科技点

  N-11-03: researching节点详情
    验证: status='researching', researchTime含speedBonus

  N-11-04: completed节点详情
    验证: effects列表完整, linkEffects包含联动信息
```

### 维度 F-Boundary: 补充7个分支

```
B-05: 互斥节点并发操作矩阵 [BUG-MUTEX-01全面验证]
  B-05-01: 同互斥组两节点同时available → 同时startResearch
    (同N-10-03, 修复验证)

  B-05-02: 同互斥组一节点researching → 另一节点startResearch
    步骤: startResearch(A) → startResearch(B)
    预期: B被拒绝

  B-05-03: 同互斥组一节点completed → 另一节点startResearch
    步骤: completeNode(A) → startResearch(B)
    预期: B被拒绝(isMutexLocked)

  B-05-04: 同互斥组一节点researching → 取消 → 另一节点startResearch
    步骤: startResearch(A) → cancelResearch(A) → startResearch(B)
    预期: B成功(A已取消, chosenMutexNodes未记录A)

B-06: 效果叠加精确验证 [BUG-EFFECT-01全面验证]
  B-06-01: all+specific不重复计算(攻击)
    步骤: 完成 mil_t1_attack(all+10%) + mil_t2_charge(cavalry+15%)
    验证(修复后): getBattleBonuses('cavalry').attackMultiplier = 1.25
    验证(修复前): = 1.35 (BUG)

  B-06-02: all+specific不重复计算(防御)
    步骤: 完成 mil_t1_defense(all+10%) + mil_t2_fortify(infantry+15%)
    验证: getBattleBonuses('infantry').defenseMultiplier = 1.25

  B-06-03: all+specific不重复计算(资源产出)
    步骤: 完成 eco_t3_marketplace(all+10%) + eco_t1_farming(grain+15%)
    验证: getProductionMultiplier('grain') = 1.25 (非1.35)

  B-06-04: 纯all效果不重复
    步骤: 完成 mil_t1_attack(all+10%) + mil_t3_blitz(all+20%)
    验证: getBattleBonuses('all').attackMultiplier = 1.30

  B-06-05: 纯specific效果不涉及all
    步骤: 完成 mil_t2_charge(cavalry+15%) (无all攻击加成)
    验证: getBattleBonuses('cavalry').attackMultiplier = 1.15
    验证: getBattleBonuses('infantry').attackMultiplier = 1.00

B-07: 队列大小非标准等级映射
  B-07-01: level=0 → queueSize=1 (BASE_RESEARCH_QUEUE_SIZE)
  B-07-02: level=3 → queueSize=1 (1≤3, 5>3)
  B-07-03: level=7 → queueSize=2 (5≤7, 10>7)
  B-07-04: level=25 → queueSize=5 (20≤25, 超最大值)
  B-07-05: level=-1 → 被syncAcademyLevel拒绝(NaN防护)

B-08: 铜钱兑换精度
  B-08-01: goldAmount=150 → pointsGained=1.5 (小数)
  B-08-02: goldAmount=1 → pointsGained=0.01
  B-08-03: goldAmount=0 → 拒绝(数量必须>0)

B-09: 融合科技前置条件边界
  B-09-01: 仅pathA完成 → arePrerequisitesMet=false
  B-09-02: 仅pathB完成 → arePrerequisitesMet=false
  B-09-03: pathA和pathB都完成 → arePrerequisitesMet=true
  B-09-04: pathA完成但pathB researching → arePrerequisitesMet=false

B-10: 研究速度边界
  B-10-01: researchSpeedBonus=0 → multiplier=1.0, actualTime=baseTime
  B-10-02: researchSpeedBonus=100 → multiplier=2.0, actualTime=baseTime/2
  B-10-03: researchSpeedBonus=NaN → syncResearchSpeedBonus拒绝
```

### 维度 F-Error: 补充5个分支

```
E-05: 无效techId完成防护 [P0-COMPLETE-01降级验证]
  E-05-01: 队列中手动插入无效techId的slot → checkCompleted
    预期: completeNode返回(不崩溃), 科技点不丢失(已扣)
    建议: checkCompleted应在splice前验证techId有效性

  E-05-02: deserialize包含无效completedTechId
    预期: `if (this.nodes[id])` 跳过无效ID, 不崩溃

E-06: 融合科技取消研究
  E-06-01: 融合科技在researching状态 → cancelResearch
    验证: fusionSystem节点status恢复available
    注意: TechResearchSystem.cancelResearch调用treeSystem.cancelResearch,
          但融合科技在fusionSystem中, 需确认取消路径正确

  E-06-02: 融合科技取消后→科技点返还
    验证: refundPoints = fusionTechDef.costPoints

E-07: 退款金额验证
  E-07-01: 正常取消 → refundPoints = def.costPoints
  E-07-02: def为undefined(极端) → refundPoints = 0 (?? 操作符)

E-08: 离线时间异常
  E-08-01: onComeBackOnline(timestamp < offlineStartTime)
    预期: offlineMs < 0 → offlineSeconds = 0 → 返回null

  E-08-02: onComeBackOnline(offlineStartTime相同)
    预期: offlineMs = 0 → offlineSeconds = 0 → 返回null

E-09: deserialize中chosenMutexNodes验证
  E-09-01: chosenMutexNodes包含无效mutexGroup → 不崩溃
  E-09-02: chosenMutexNodes的nodeId不在completedTechIds中 → refreshAllAvailability仍锁定
```

### 维度 F-Cross: 补充6个分支

```
C-07: 研究速度加成同步链路 [BUG-SPEED-01 E2E]
  C-07-01: 文化科技完成 → pointSystem.syncResearchSpeedBonus被调用
    步骤:
      1. 完成cul_t2_academy(研究速度+15%)
      2. 验证engine层调用pointSystem.syncResearchSpeedBonus(15)
      3. 验证后续startResearch的actualTime缩短
    覆盖: engine-tech-deps → pointSystem同步链路

  C-07-02: 多个研究速度科技叠加
    步骤: 完成cul_t2_academy(+15%) + cul_t3_scholar(+25%) + cul_t4_wisdom(+30%)
    验证: researchSpeedBonus = 70, multiplier = 1.70

C-08: 科技完成→联动同步时序
  C-08-01: completeNode → 事件触发 → 外部同步联动
    步骤:
      1. 完成eco_t1_farming
      2. 验证economy:techCompleted事件触发
      3. 外部调用linkSystem.addCompletedTech('eco_t1_farming')
      4. 验证getBuildingLinkBonus('farm').productionBonus = 20
    覆盖: 事件→手动同步→联动生效

  C-08-02: 未同步联动时查询
    步骤: 完成eco_t1_farming但不调用syncCompletedTechIds
    验证: getBuildingLinkBonus('farm').productionBonus = 0 (联动未激活)

C-09: 融合科技效果聚合 [ARCH-FUSION-01修复验证]
  C-09-01: 完成融合科技→TechEffectSystem包含融合效果
    步骤:
      1. 完成mil_t2_charge + eco_t2_irrigation → fusion_mil_eco_1解锁
      2. 完成fusion_mil_eco_1(全军攻击+15%, 粮草产出+15%)
      3. 验证TechEffectSystem.getEffectBonus('military', 'attack') 包含+15%
    预期(修复后): 包含融合科技效果
    预期(修复前): 不包含

  C-09-02: 融合科技→TechEffectApplier分发
    验证: getBattleBonuses包含融合科技攻击加成
    验证: getResourceBonuses包含融合科技产出加成

C-10: 离线完成→后续节点解锁验证
  C-10-01: 离线完成T1科技→T2节点解锁但不自动研究
    步骤:
      1. 队列=[mil_t1_attack(剩余10s)], 离线30s
      2. onComeBackOnline → mil_t1_attack完成
      3. 验证mil_t2_charge.status='available'(非researching)

  C-10-02: 离线完成互斥科技→同组锁定
    步骤:
      1. 队列=[mil_t1_attack], 离线至完成
      2. 验证mil_t1_defense.status='locked'

C-11: 重置顺序一致性
  C-11-01: 全系统reset后联动归零
    步骤: 完成若干科技 → 全系统reset()
    验证: linkSystem.getState().activeLinks = 0
    验证: treeSystem.getAllCompletedEffects() = []

  C-11-02: 部分reset(仅TreeSystem)→效果系统缓存失效
    步骤: 完成科技 → treeSystem.reset() → effectSystem.invalidateCache()
    验证: effectSystem.getEffectBonus = 0

C-12: composeResourceBonuses精度验证
  C-12-01: 仅grain有加成 → tech字段被稀释
    步骤: 完成eco_t1_farming(grain+15%)
    验证: composeResourceBonuses().tech = 15/6 = 2.5
    (平均值计算, 非bug而是设计特性)

  C-12-02: 全资源加成 → tech字段正确
    步骤: 完成eco_t3_marketplace(all+10%)
    验证: 所有资源productionMultiplier都包含+10%
```

### 维度 F-Lifecycle: 补充7个分支

```
L-05: 研究中存档→读档→继续 [关键]
  L-05-01: 研究进行50% → 存档 → 读档 → update → checkCompleted
    步骤:
      1. startResearch, 经过50%时间
      2. serialize所有系统
      3. 全系统reset
      4. deserialize恢复
      5. update → checkCompleted → 研究继续
    验证: 进度正确, 最终能完成

  L-05-02: 研究进行90% → 存档 → 等待 → 读档 → 立即完成
    步骤:
      1. 研究剩余10%时间
      2. serialize
      3. 等待超过剩余时间
      4. deserialize → update → checkCompleted
    验证: 立即完成

  L-05-03: 设备时钟变化(快进) → 读档
    步骤: 存档时endTime=未来, 读档时Date.now()已超过endTime
    验证: checkCompleted立即完成

  L-05-04: 设备时钟变化(回退) → 读档
    步骤: 存档时endTime=T, 读档时Date.now() < T
    验证: 研究继续, 进度合理

L-06: 互斥选择持久化
  L-06-01: 完成互斥A → 存档 → 读档 → B仍locked
    验证: chosenMutexNodes恢复, B.status='locked'

  L-06-02: 完成互斥A → 存档 → 读档 → 尝试startResearch(B)
    验证: canResearch(B) = {can: false}

L-07: 融合科技序列化→联动恢复 [ARCH-SAVE-01修复验证]
  L-07-01: 完成融合科技 → serialize → reset → deserialize
    步骤:
      1. 完成fusion_mil_eco_1
      2. serialize所有系统
      3. 全系统reset
      4. deserialize恢复
    验证(修复后): 
      - fusionSystem节点status='completed'
      - linkSystem包含融合联动效果
      - fusionSystem.getFusionLinkEffects返回正确
    预期(修复前): 联动效果丢失

  L-07-02: 融合科技researching状态 → 存档 → 读档
    验证: 融合科技节点status恢复为researching

L-08: 效果缓存与序列化一致性
  L-08-01: 完成科技 → serialize → reset → deserialize → 查询效果
    步骤:
      1. 完成3个科技
      2. serialize
      3. reset
      4. deserialize
      5. effectSystem.invalidateCache() (如有)
      6. 查询getEffectBonus
    验证: 效果与完成状态一致

  L-08-02: 不调用invalidateCache → 查询旧缓存
    验证: 缓存可能返回旧值(需确认deserialize后缓存失效机制)

L-09: refund会计一致性
  L-09-01: spend(50) → refund(50) → current回到初始值
    验证: totalSpent=50(不减少), totalEarned不变, current正确

  L-09-02: 多次spend+refund
    步骤: spend(30) → spend(20) → refund(30) → refund(20)
    验证: current回到初始值, totalSpent=50, totalEarned不变

L-10: 离线研究存档→读档
  L-10-01: onGoOffline → serialize → (关游戏) → deserialize → onComeBackOnline
    步骤:
      1. 队列有活跃研究
      2. onGoOffline记录快照
      3. serialize包含offlineResearchData
      4. 全系统reset
      5. deserialize恢复offlineStartTime和researchSnapshot
      6. onComeBackOnline计算进度
    验证: 离线进度正确

L-11: 存档版本兼容
  L-11-01: v1存档(无researchQueue, 只有activeResearch) → 当前代码
    验证: 降级恢复单队列

  L-11-02: v1存档(无fusionTechData) → 当前代码
    验证: fusionTechData可选, 不影响主流程

  L-11-03: v1存档(无offlineResearchData) → 当前代码
    验证: offlineResearchData可选
```

---

## 三、R2完整统计

### 3.1 新增分支统计

| 维度 | R1分支 | R2新增 | R2总计 | P0 | P1 | P2 |
|------|--------|--------|--------|----|----|-----|
| F-Normal | 33 | +8 | 41 | 3 | 4 | 1 |
| F-Boundary | 23 | +16 | 39 | 4 | 8 | 4 |
| F-Error | 19 | +10 | 29 | 1 | 5 | 4 |
| F-Cross | 16 | +12 | 28 | 3 | 6 | 3 |
| F-Lifecycle | 16 | +16 | 32 | 2 | 10 | 4 |
| **合计** | **107** | **+62** | **169** | **13** | **33** | **16** |

### 3.2 BUG修复验证覆盖

| BUG ID | 验证用例数 | 覆盖分支 |
|--------|-----------|----------|
| 🔴 BUG-MUTEX-01 | 4 | N-10-03, B-05-01~B-05-04 |
| 🔴 BUG-EFFECT-01 | 5 | B-06-01~B-06-05 |
| 🔴 BUG-SPEED-01 | 3 | N-09-01~N-09-03, C-07-01~C-07-02 |
| 🟡 ARCH-SAVE-01 | 2 | L-07-01~L-07-02 |
| 🟡 ARCH-FUSION-01 | 2 | C-09-01~C-09-02 |

### 3.3 关键链路覆盖

| 链路 | R1覆盖 | R2增强 |
|------|--------|--------|
| 文化科技→研究速度→时间缩短 | ❌ 未覆盖 | ✅ N-09 + C-07 完整E2E |
| 互斥节点→并发防护 | ❌ 未覆盖 | ✅ N-10 + B-05 矩阵覆盖 |
| all+specific效果叠加 | ❌ 未覆盖 | ✅ B-06 精确验证 |
| 融合科技→效果聚合 | ❌ 未覆盖 | ✅ C-09 修复验证 |
| 序列化→联动恢复 | ❌ 未覆盖 | ✅ L-07 修复验证 |
| 研究中存档→读档→继续 | ❌ 未覆盖 | ✅ L-05 完整生命周期 |
| 效果缓存→序列化一致性 | ❌ 未覆盖 | ✅ L-08 验证 |

### 3.4 R1遗漏覆盖情况

| 遗漏ID | R2覆盖分支 | 状态 |
|--------|-----------|------|
| N-01 (速度E2E) | N-09-01~N-09-03 | ✅ |
| N-02 (T1互斥初始化) | N-10-01~N-10-02 | ✅ |
| N-03 (DetailProvider) | N-11-01~N-11-04 | ✅ |
| B-01 (互斥并发) | B-05-01~B-05-04 | ✅ |
| B-02 (队列中间取消) | 已在R1 B-04-04 | ✅ |
| B-03 (速度0%) | B-10-01 | ✅ |
| B-04 (兑换精度) | B-08-01~B-08-03 | ✅ |
| B-05 (非标准等级) | B-07-01~B-07-05 | ✅ |
| B-06 (融合前置部分) | B-09-01~B-09-04 | ✅ |
| B-07 (all+specific) | B-06-01~B-06-05 | ✅ |
| E-01 (无效ID完成) | E-05-01~E-05-02 | ✅ |
| E-02 (退款金额) | E-07-01~E-07-02 | ✅ |
| E-03 (融合取消) | E-06-01~E-06-02 | ✅ |
| E-04 (离线时间异常) | E-08-01~E-08-02 | ✅ |
| E-05 (deserialize无效ID) | E-09-01~E-09-02 | ✅ |
| C-01 (速度同步) | C-07-01~C-07-02 | ✅ |
| C-02 (联动时序) | C-08-01~C-08-02 | ✅ |
| C-03 (融合效果聚合) | C-09-01~C-09-02 | ✅ |
| C-04 (离线解锁) | C-10-01~C-10-02 | ✅ |
| C-05 (资源精度) | C-12-01~C-12-02 | ✅ |
| C-06 (重置一致) | C-11-01~C-11-02 | ✅ |
| L-01 (研究存档) | L-05-01~L-05-04 | ✅ |
| L-02 (互斥持久化) | L-06-01~L-06-02 | ✅ |
| L-03 (融合序列化) | L-07-01~L-07-02 | ✅ |
| L-04 (离线存档) | L-10-01 | ✅ |
| L-05 (版本迁移) | L-11-01~L-11-03 | ✅ |
| L-06 (会计一致) | L-09-01~L-09-02 | ✅ |
| L-07 (缓存一致) | L-08-01~L-08-02 | ✅ |

**R1遗漏覆盖率: 28/28 = 100% ✅**
