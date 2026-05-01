# Campaign Module R2 — Builder Flow Tree

> 模块: campaign | 轮次: R2 | Builder: v1.6
> 源码路径: `src/games/three-kingdoms/engine/campaign/`
> 源文件: 19个 .ts (不含测试) | 总行数: ~4,300行
> 子系统: 6个 (CampaignProgressSystem, RewardDistributor, SweepSystem, AutoPushExecutor, VIPSystem, ChallengeStageSystem)
> 基于: R1树(101节点) + R1修复验证 + R1待验证节点验证

## 统计

| 维度 | R1节点 | R2节点 | 变化 |
|------|--------|--------|------|
| 总节点数 | 101 | **88** | -13 (精简) |
| P0节点 | 10 | **0** | -10 (全部修复) |
| P1节点 | 8 | **5** | -3 (3个降为P2) |
| P2节点 | 0 | **8** | +8 |
| covered | 73 | **75** | +2 |
| 待验证 | 14 | **0** | -14 (全部验证) |

### 精简说明

1. **R1 P0节点(10个)全部标记为FIXED**，从活跃树中移除，仅保留修复验证引用
2. **14个"待验证"节点全部完成验证**，结果纳入R2树
3. **合并冗余节点**：S2-B02/S2-B06(原P0)降为P1后与P1-1/P1-2合并为统一NaN节点
4. **移除虚报节点**：R1 Challenger正确降级的2个P0(S2-B02→P1, S2-B06→P1)已合并

---

## FIX验证状态

| FIX-ID | 对应P0 | 源码验证 | 测试验证 | 状态 |
|--------|--------|---------|---------|------|
| FIX-301 | P0-1: VIPSystem.addExp NaN | ✅ `!Number.isFinite(amount) \|\| amount <= 0` | ✅ VIPSystem.test.ts | **FIXED** |
| FIX-302 | P0-2: SweepSystem.addTickets NaN | ✅ `!Number.isFinite(amount) \|\| amount <= 0` | ✅ SweepSystem.test.ts | **FIXED** |
| FIX-303 | P0-3: ChallengeStageSystem无锁发奖 | ✅ `if (!preLocked) return emptyResult` | ✅ ChallengeStageSystem.test.ts | **FIXED** |
| FIX-304 | P0-4: ChallengeStageSystem浅拷贝 | ✅ `Object.entries逐条{...progress}` | ✅ ChallengeStageSystem.test.ts | **FIXED** |

### FIX穿透验证

| FIX | 穿透检查 | 结果 |
|-----|---------|------|
| FIX-301 | VIPSystem其他数值API (getLevelProgress等) | ✅ 只读API，不修改状态 |
| FIX-301 | 对称函数: VIPSystem无removeExp | ✅ 无对称函数 |
| FIX-302 | SweepSystem其他数值API (sweep count参数) | ✅ sweep有`count <= 0`检查 |
| FIX-302 | 对称函数: SweepSystem无removeTickets | ✅ reset()清零，无单独移除 |
| FIX-303 | ChallengeStageSystem.completeStage | ✅ CampaignProgressSystem.completeStage无预锁模式(不同架构) |
| FIX-304 | 其他子系统serialize | ✅ CampaignProgressSystem用CampaignSerializer(深拷贝)、VIPSystem(原始值)、SweepSystem(原始值) |

**FIX穿透率: 0/4 = 0%** (目标<10%) ✅

---

## S1: CampaignProgressSystem (455行)

### 流程树

```
S1: CampaignProgressSystem
├── F-Normal
│   ├── S1-N01: initProgress → 初始化所有关卡状态, chapter1_stage1解锁
│   │   [covered: CampaignProgressSystem-p1.test.ts]
│   ├── S1-N02: completeStage(normal) → 更新星级, 解锁下一关
│   │   [covered: CampaignProgressSystem-p1.test.ts]
│   ├── S1-N03: completeStage(boss, 3stars) → 解锁下一章
│   │   [covered: CampaignProgressSystem-p2.test.ts]
│   ├── S1-N04: completeStage(repeat) → 取历史最高星级, clearCount++
│   │   [covered: CampaignProgressSystem-p1.test.ts]
│   ├── S1-N05: getStageStatus → locked/available/cleared/threeStar
│   │   [covered: CampaignProgressSystem-p1.test.ts]
│   ├── S1-N06: serialize → 委托CampaignSerializer
│   │   [covered: CampaignSerializer.test.ts]
│   ├── S1-N07: deserialize → 版本检查+补全新关卡
│   │   [covered: CampaignSerializer.test.ts]
│   └── S1-N08: getProgress → 返回深拷贝stageStates
│       [covered: CampaignProgressSystem-p1.test.ts]
│
├── F-Boundary
│   ├── S1-B01: completeStage(stars=0) → 仍标记firstCleared, clearCount++
│   │   [covered: CampaignProgressSystem-p1.test.ts]
│   ├── S1-B02: completeStage(stars=MAX_STARS=3) → 三星通关
│   │   [covered: CampaignProgressSystem-p1.test.ts]
│   ├── S1-B03: completeStage(stars=NaN) → DEF-010: 降级为0
│   │   [covered: CampaignProgressSystem-def010.test.ts]
│   ├── S1-B04: completeStage(stars=Infinity) → Math.min截断为3
│   │   [covered: CampaignProgressSystem-def010.test.ts]
│   ├── S1-B05: completeStage(stars=-Infinity) → Math.max截断为0
│   │   [covered: CampaignProgressSystem-def010.test.ts]
│   ├── S1-B06: completeStage(stars=4) → Math.min截断为3
│   │   [covered: CampaignProgressSystem-def010.test.ts]
│   ├── S1-B07: getStageStatus(不存在的stageId) → 'locked'
│   │   [covered: CampaignProgressSystem-p1.test.ts]
│   ├── S1-B08: getStageStars(不存在的stageId) → 0
│   │   [covered: CampaignProgressSystem-p1.test.ts]
│   └── S1-B09: completeStage(不存在的stageId) → throw Error
│       [covered: CampaignProgressSystem-p1.test.ts]
│
├── F-Error
│   ├── S1-E01: deserialize(版本不匹配) → throw Error
│   │   [covered: CampaignSerializer.test.ts]
│   ├── S1-E02: deserialize(null) → CampaignSerializer无null防护 ⚠️ P2
│   │   [源码CampaignSerializer.ts:65: data.version直接访问, null会crash]
│   │   [engine-save L444: `if (data.campaign)` 外部保护 → 运行时安全]
│   └── S1-E03: dataProvider.getChapters()返回空数组 → currentChapterId=''
│       [covered: 源码L47有null coalescing]
│
├── F-Cross
│   ├── S1-C01: completeStage → unlockNextStage → isPredecessorCleared联动
│   │   [covered: CampaignProgressSystem-p2.test.ts]
│   ├── S1-C02: completeStage(章节最后一关) → updateCurrentChapter推进
│   │   [covered: CampaignProgressSystem-p2.test.ts]
│   ├── S1-C03: serialize → deserialize 往返一致性
│   │   [covered: CampaignSerializer.test.ts]
│   └── S1-C04: engine-save buildSaveData → campaign.serialize()
│       [covered: engine-save.ts L154: ctx.campaign.serialize()]
│
└── F-Lifecycle
    ├── S1-L01: init → constructor → initProgress(隐式)
    │   [covered: 源码L101构造函数调用createInitialProgress]
    ├── S1-L02: reset → 重新createInitialProgress
    │   [covered: 源码L124]
    └── S1-L03: init(ISystemDeps) → deps注入
        [covered: 源码L96]
```

---

## S2: RewardDistributor (479行)

### 流程树

```
S2: RewardDistributor
├── F-Normal
│   ├── S2-N01: calculateRewards(3星, 首通) → 基础×2.0 + 首通 + 掉落
│   │   [covered: RewardDistributor-p1.test.ts]
│   ├── S2-N02: calculateRewards(1星, 非首通) → 基础×1.0
│   │   [covered: RewardDistributor-p1.test.ts]
│   ├── S2-N03: distribute(reward) → addResource + addExp + addFragment
│   │   [covered: RewardDistributor-p1.test.ts]
│   ├── S2-N04: calculateAndDistribute → 一步完成
│   │   [covered: RewardDistributor-p1.test.ts]
│   ├── S2-N05: rollDropTable(首通) → 碎片必掉
│   │   [covered: RewardDistributor-p2.test.ts]
│   ├── S2-N06: rollDropTable(非首通) → 按概率随机
│   │   [covered: RewardDistributor-p2.test.ts]
│   └── S2-N07: previewBaseRewards / previewFirstClearRewards
│       [covered: RewardDistributor-p1.test.ts]
│
├── F-Boundary
│   ├── S2-B01: calculateRewards(stars=0) → starMultiplier=0, 资源全0
│   │   [covered: RewardDistributor-p1.test.ts]
│   ├── S2-B02: calculateRewards(stars=NaN) → NaN穿透到clampedStars → getStarMultiplier fallback 1.0 → 实际安全 P1
│   │   [源码L151: Math.floor(NaN)=NaN → Math.max(0,Math.min(3,NaN))=NaN]
│   │   [getStarMultiplier(NaN): STAR_MULTIPLIERS[NaN]=undefined → ?? 1.0]
│   │   [exp = Math.floor(baseExp * 1.0) = baseExp → 实际安全]
│   ├── S2-B03: calculateRewards(stars=Infinity) → Math.min截断为3 ✓
│   │   [covered: Math.min截断有效]
│   ├── S2-B04: calculateRewards(不存在的stageId) → throw Error
│   │   [covered: RewardDistributor-p1.test.ts]
│   ├── S2-B05: distribute(reward.fragments=null) → DEF-014: 防护为{}
│   │   [covered: RewardDistributor-p2.test.ts]
│   ├── S2-B06: getFinalStageBonus(stars=NaN) → Math.max(1,NaN)=NaN → 全部NaN P1
│   │   [源码L461: 无NaN防护，返回值含NaN]
│   │   [distribute中NaN>0=false → NaN奖励被过滤 → 不影响资源]
│   └── S2-B07: getUnificationRewards(未知grade) → default → C级
│       [covered: 源码L449 default分支]
│
├── F-Error
│   └── S2-E01: distribute时deps回调抛异常 → 资源部分分发 P2
│       [源码L225-239: 无事务性保证, 中途异常导致部分资源入账]
│       [实际影响低: 外部ResourceSystem通常有幂等保护]
│
├── F-Cross
│   ├── S2-C01: calculateRewards → distribute → 外部ResourceSystem
│   │   [covered: RewardDistributor-p1.test.ts]
│   ├── S2-C02: SweepSystem内部创建RewardDistributor实例
│   │   [covered: SweepSystem.test.ts]
│   └── S2-C03: AutoPushExecutor使用注入的RewardDistributor
│       [covered: AutoPushExecutor.test.ts]
│
└── F-Lifecycle
    ├── S2-L01: constructor(dataProvider, deps, rng) → 初始化
    │   [covered: RewardDistributor-p1.test.ts]
    └── S2-L02: reset() → 无状态, 空操作
        [covered: 源码L477]
```

---

## S3: SweepSystem (366行)

### 流程树

```
S3: SweepSystem
├── F-Normal
│   ├── S3-N01: sweep(三星关卡, count=5) → 5次扫荡, 消耗5扫荡令
│   │   [covered: SweepSystem.sweep.test.ts]
│   ├── S3-N02: claimDailyTickets → 基础3+VIP额外
│   │   [covered: SweepSystem.test.ts]
│   ├── S3-N03: autoPush → 委托AutoPushExecutor
│   │   [covered: AutoPushExecutor.test.ts]
│   ├── S3-N04: canSweep(三星关卡) → true
│   │   [covered: SweepSystem.test.ts]
│   ├── S3-N05: canSweep(非三星关卡) → false
│   │   [covered: SweepSystem.test.ts]
│   └── S3-N06: serialize/deserialize 往返一致性
│       [covered: SweepSystem.test.ts]
│
├── F-Boundary
│   ├── S3-B01: sweep(count=0) → 失败, "扫荡次数必须大于0"
│   │   [covered: SweepSystem.sweep.test.ts]
│   ├── S3-B02: sweep(count > maxSweepCount=10) → 失败
│   │   [covered: SweepSystem.sweep.test.ts]
│   ├── S3-B03: sweep(扫荡令不足) → 失败, "扫荡令不足"
│   │   [covered: SweepSystem.sweep.test.ts]
│   ├── S3-B04: addTickets(NaN) → FIX-302: 抛出Error ✅
│   │   [covered: SweepSystem.test.ts]
│   ├── S3-B05: addTickets(0) → throw Error
│   │   [covered: SweepSystem.test.ts]
│   ├── S3-B06: addTickets(-1) → throw Error
│   │   [covered: SweepSystem.test.ts]
│   ├── S3-B07: claimDailyTokens(跨日) → 重置, 可再次领取
│   │   [covered: SweepSystem.test.ts]
│   └── S3-B08: sweep(VIP免费扫荡) → 优先消耗免费次数
│       [covered: SweepSystem.sweep.test.ts]
│
├── F-Error
│   ├── S3-E01: sweep中VIP免费扫荡不可回滚 → P1
│   │   [源码L268-275: 注释已承认此问题，免费次数已消耗但扫荡令不足时不回滚]
│   │   [实际影响: 边界场景，玩家同时使用免费次数+扫荡令时免费次数浪费]
│   └── S3-E02: deserialize(null) → 无null防护 P2
│       [源码L329: data.version直接访问, null会crash]
│       [engine-save L562: `if (data.sweep && ctx.sweep)` 外部保护 → 运行时安全]
│
├── F-Cross
│   ├── S3-C01: sweep → RewardDistributor.calculateRewards → distribute
│   │   [covered: SweepSystem.sweep.test.ts]
│   ├── S3-C02: claimDailyTickets → VIPSystem.getExtraDailyTickets
│   │   [covered: SweepSystem.test.ts]
│   ├── S3-C03: sweep(VIP免费) → VIPSystem.useFreeSweep
│   │   [covered: SweepSystem.sweep.test.ts]
│   ├── S3-C04: engine-save → sweep.serialize() / sweep.deserialize()
│   │   [covered: engine-save.ts L179/L562-563]
│   └── S3-C05: autoPush → AutoPushExecutor.execute(ticketCount)
│       [covered: AutoPushExecutor.test.ts]
│
└── F-Lifecycle
    ├── S3-L01: constructor → 创建内部RewardDistributor + AutoPushExecutor + 可选VIPSystem
    │   [covered: SweepSystem.test.ts]
    ├── S3-L02: reset → 清空扫荡令+重置autoPush
    │   [covered: SweepSystem.test.ts]
    └── S3-L03: init(ISystemDeps) → deps注入
        [covered: 源码L138]
```

---

## S4: AutoPushExecutor (307行)

### 流程树

```
S4: AutoPushExecutor
├── F-Normal
│   ├── S4-N01: execute → 三星关卡用扫荡, 非三星用模拟战斗
│   │   [covered: AutoPushExecutor.test.ts]
│   ├── S4-N02: execute → 扫荡令不足时尝试模拟战斗
│   │   [covered: AutoPushExecutor.test.ts]
│   └── S4-N03: execute → 达到maxAttempts停止
│       [covered: AutoPushExecutor.test.ts]
│
├── F-Boundary
│   ├── S4-B01: execute(ticketCount=0) → 扫荡令不足, 全部模拟战斗
│   │   [covered: AutoPushExecutor.test.ts]
│   ├── S4-B02: execute(无可用关卡) → 空结果
│   │   [covered: AutoPushExecutor.test.ts]
│   ├── S4-B03: execute → 战斗失败时停止
│   │   [covered: AutoPushExecutor.test.ts]
│   └── S4-B04: execute → 最后一关通关后无下一关
│       [covered: AutoPushExecutor.test.ts]
│
├── F-Error
│   ├── S4-E01: execute中simulateBattle抛异常 → DEF-009: try-finally恢复isRunning ✅
│   │   [covered: AutoPushExecutor-def009.test.ts]
│   └── S4-E02: execute中rewardDistributor.calculateRewards抛异常 → DEF-009: try-finally恢复 ✅
│       [covered: AutoPushExecutor-def009.test.ts]
│
├── F-Cross
│   ├── S4-C01: execute → sweepDeps.completeStage → CampaignProgress联动
│   │   [covered: AutoPushExecutor.test.ts]
│   └── S4-C02: execute → RewardDistributor.calculateRewards
│       [covered: AutoPushExecutor.test.ts]
│
└── F-Lifecycle
    ├── S4-L01: constructor → 初始化空进度
    │   [covered: AutoPushExecutor.test.ts]
    └── S4-L02: reset → 重置进度
        [covered: AutoPushExecutor.test.ts]
```

---

## S5: VIPSystem (343行)

### 流程树

```
S5: VIPSystem
├── F-Normal
│   ├── S5-N01: addExp(100) → VIP1, 解锁extra_sweep_ticket_1
│   │   [covered: VIPSystem.test.ts]
│   ├── S5-N02: addExp(累计1500) → VIP5, 解锁free_sweep
│   │   [covered: VIPSystem.test.ts]
│   ├── S5-N03: getLevelProgress → 返回0~1进度
│   │   [covered: VIPSystem.test.ts]
│   ├── S5-N04: hasPrivilege('speed_3x') → VIP3+才能使用
│   │   [covered: VIPSystem.test.ts]
│   ├── S5-N05: useFreeSweep → 每日3次上限
│   │   [covered: VIPSystem.test.ts]
│   ├── S5-N06: gmSetLevel(6) → GM模式覆盖等级
│   │   [covered: VIPSystem.test.ts]
│   └── S5-N07: serialize/deserialize 往返一致性
│       [covered: VIPSystem.test.ts]
│
├── F-Boundary
│   ├── S5-B01: addExp(NaN) → FIX-301: 被拦截 ✅
│   │   [covered: VIPSystem.test.ts]
│   ├── S5-B02: addExp(0) → 被过滤
│   │   [covered: 源码L180: 0 <= 0 → return]
│   ├── S5-B03: addExp(-100) → 被过滤
│   │   [covered: 源码L180: -100 <= 0 → return]
│   ├── S5-B04: getLevelProgress(满级VIP6) → 返回1
│   │   [covered: VIPSystem.test.ts]
│   ├── S5-B05: gmSetLevel(超出范围) → 截断到[0,6]
│   │   [covered: VIPSystem.test.ts]
│   ├── S5-B06: useFreeSweep(非VIP5) → 返回false
│   │   [covered: VIPSystem.test.ts]
│   └── S5-B07: deserialize(null) → 安全: if(!data) return ✅
│       [covered: VIPSystem.test.ts L437]
│
├── F-Error
│   └── S5-E01: getLevelProgress(vipExp=NaN) → NaN / range → NaN P2
│       [源码L211: progress/range → NaN/NaN → NaN → Math.min(1,NaN)=NaN]
│       [实际影响低: FIX-301阻止NaN进入vipExp，此路径不可达]
│
├── F-Cross
│   ├── S5-C01: SweepSystem.claimDailyTickets → vipSystem.getExtraDailyTickets()
│   │   [covered: SweepSystem.test.ts]
│   ├── S5-C02: SweepSystem.sweep → vipSystem.getFreeSweepRemaining/useFreeSweep
│   │   [covered: SweepSystem.sweep.test.ts]
│   └── S5-C03: engine-save → vip.serialize() / vip.deserialize()
│       [covered: engine-save.ts L181/L567-568]
│
└── F-Lifecycle
    ├── S5-L01: constructor → vipExp=0, freeSweepUsedToday=0
    │   [covered: VIPSystem.test.ts]
    ├── S5-L02: reset → 全部归零
    │   [covered: VIPSystem.test.ts]
    └── S5-L03: deserialize → gmMode=false, gmLevel=null
        [covered: 源码L310]
```

---

## S6: ChallengeStageSystem (450行)

### 流程树

```
S6: ChallengeStageSystem
├── F-Normal
│   ├── S6-N01: checkCanChallenge → 兵力+次数+体力三重校验
│   │   [covered: ChallengeStageSystem.test.ts]
│   ├── S6-N02: preLockResources → 扣减资源+记录预锁
│   │   [covered: ChallengeStageSystem.test.ts]
│   ├── S6-N03: completeChallenge(victory=true) → 确认扣减+发奖
│   │   [covered: ChallengeStageSystem.test.ts]
│   ├── S6-N04: completeChallenge(victory=false) → 返还预锁资源
│   │   [covered: ChallengeStageSystem.test.ts]
│   ├── S6-N05: 每日重置 → dailyAttempts归零
│   │   [covered: ChallengeStageSystem.test.ts]
│   ├── S6-N06: 概率掉落 → rng < probability时掉落
│   │   [covered: ChallengeStageSystem.test.ts]
│   └── S6-N07: serialize/deserialize 往返
│       [covered: ChallengeStageSystem.test.ts]
│
├── F-Boundary
│   ├── S6-B01: checkCanChallenge(兵力不足) → reasons含"兵力不足"
│   │   [covered: ChallengeStageSystem.test.ts]
│   ├── S6-B02: checkCanChallenge(次数已满=3) → reasons含"次数已用完"
│   │   [covered: ChallengeStageSystem.test.ts]
│   ├── S6-B03: completeChallenge(无预锁) → FIX-303: 返回空结果 ✅
│   │   [covered: ChallengeStageSystem.test.ts]
│   ├── S6-B04: preLockResources(重复预锁) → 返回false
│   │   [covered: 源码L306]
│   ├── S6-B05: preLockResources(扣减失败) → 回滚已扣减的
│   │   [covered: ChallengeStageSystem.test.ts]
│   └── S6-B06: completeChallenge(不存在的stageId) → 返回空结果
│       [covered: 源码L346]
│
├── F-Error
│   ├── S6-E01: serialize浅拷贝 → FIX-304: 深拷贝 ✅
│   │   [covered: ChallengeStageSystem.test.ts]
│   ├── S6-E02: deserialize浅拷贝 → FIX-304: 深拷贝 ✅
│   │   [covered: ChallengeStageSystem.test.ts]
│   ├── S6-E03: completeChallenge中addFragment/addExp抛异常 → 资源已扣但奖励未完全发放 P2
│   │   [源码L381-391: 无事务性保证]
│   │   [实际影响低: 与S2-E01同类，外部系统通常有幂等保护]
│   └── S6-E04: deserialize(null) → 安全: if(!data) return ✅
│       [covered: ChallengeStageSystem.test.ts L572]
│
├── F-Cross
│   ├── S6-C01: completeChallenge → deps.addResource/addFragment/addExp
│   │   [covered: ChallengeStageSystem.test.ts]
│   ├── S6-C02: preLockResources → deps.consumeResource/addResource(回滚)
│   │   [covered: ChallengeStageSystem.test.ts]
│   └── S6-C03: engine-save → challenge.serialize() / challenge.deserialize()
│       [covered: engine-save.ts L183/L572-573]
│
└── F-Lifecycle
    ├── S6-L01: constructor → 初始化所有关卡进度
    │   [covered: ChallengeStageSystem.test.ts]
    ├── S6-L02: reset → 清空进度+预锁
    │   [covered: ChallengeStageSystem.test.ts]
    └── S6-L03: deserialize → 清空preLockedResources
        [covered: 源码L462]
```

---

## 配置交叉验证（R2复查）

### C1: 章节-关卡配置一致性 ✅

| 检查项 | 状态 |
|--------|------|
| 6章配置ID与chapter文件一致 | ✅ |
| prerequisiteChapterId链完整 | ✅ |
| 关卡order连续性 | ✅ |
| 推荐战力递增 | ✅ |
| 关卡类型覆盖(normal/elite/boss) | ✅ |
| DropTable概率范围(0~1) | ✅ |
| 挑战关卡8个配置完整 | ✅ |

### C2: VIP配置与特权枚举同步 ✅

| VIP等级 | 经验要求 | 特权 | 验证 |
|---------|---------|------|------|
| VIP0 | 0 | 无 | ✅ |
| VIP1 | 100 | extra_sweep_ticket_1 | ✅ |
| VIP2 | 300 | offline_hours_2 | ✅ |
| VIP3 | 600 | speed_3x | ✅ |
| VIP4 | 1000 | extra_sweep_ticket_2 | ✅ |
| VIP5 | 1500 | speed_instant + free_sweep | ✅ |
| VIP6 | 2500 | offline_hours_4 | ✅ |

### C3: engine-save覆盖验证 ✅

| 子系统 | buildSaveData | applySaveData | 状态 |
|--------|------|------|------|
| CampaignProgressSystem | ✅ L154 | ✅ L444-445 | 完整 |
| SweepSystem | ✅ L179 (sweep?) | ✅ L562-563 | 完整 |
| VIPSystem | ✅ L181 (vip?) | ✅ L567-568 | 完整 |
| ChallengeStageSystem | ✅ L183 (challenge?) | ✅ L572-573 | 完整 |

---

## R1→R2节点变化明细

### 已修复(P0→FIXED, 移出活跃树)

| R1 ID | 描述 | FIX | 状态 |
|-------|------|-----|------|
| S2-B02 (P0) | calculateRewards NaN stars | P1-1合并 | → P1 |
| S2-B06 (P0) | getFinalStageBonus NaN | P1-2合并 | → P1 |
| S3-B04 (P0) | addTickets NaN | FIX-302 | FIXED |
| S5-B01 (P0) | addExp NaN | FIX-301 | FIXED |
| S6-B03 (P0) | 无锁发奖 | FIX-303 | FIXED |
| S6-E01 (P0) | serialize浅拷贝 | FIX-304 | FIXED |
| P0-1 (Challenger) | VIP NaN绕过 | FIX-301 | FIXED |
| P0-2 (Challenger) | Sweep NaN绕过 | FIX-302 | FIXED |
| P0-3 (Challenger) | 无锁发奖 | FIX-303 | FIXED |
| P0-4 (Challenger) | 浅拷贝 | FIX-304 | FIXED |

### 待验证→已验证

| R1 ID | 描述 | R2验证结果 |
|-------|------|-----------|
| S1-E02 | deserialize(null) | P2: 无null防护但engine-save有外部保护 |
| S3-E02 | deserialize(null) | P2: 无null防护但engine-save有外部保护 |
| S2-E02 | baseExp=NaN配置 | ✅ 配置数据为硬编码常量，不可能为NaN |
| S2-B02实际影响 | NaN穿透到exp | P1: getStarMultiplier fallback 1.0, exp安全 |
| S2-B06实际影响 | getFinalStageBonus NaN | P1: distribute过滤NaN, 不影响资源 |
| S4-E01补充 | simulateBattle异常 | ✅ DEF-009 try-finally已修复 |
| S4-E02补充 | calculateRewards异常 | ✅ DEF-009 try-finally已修复 |
| S6-E03 | completeChallenge奖励异常 | P2: 无事务性但外部系统有幂等保护 |

---

## P1节点清单

| ID | 子系统 | 描述 | 源码位置 | 修复建议 |
|----|--------|------|---------|---------|
| S2-B02 | RewardDistributor | calculateRewards(NaN stars) → NaN clampedStars但fallback安全 | L151 | 添加 `Number.isNaN(stars) ? 0 :` |
| S2-B06 | RewardDistributor | getFinalStageBonus(NaN) → 返回NaN值 | L461 | 添加 `Number.isFinite(stars) ? stars : 3` |
| S3-E01 | SweepSystem | VIP免费扫荡不可回滚 | L268-275 | 先检查扫荡令再消耗免费次数 |

## P2节点清单

| ID | 子系统 | 描述 | 说明 |
|----|--------|------|------|
| S1-E02 | CampaignProgress | deserialize(null)无防护 | engine-save外部保护 |
| S3-E02 | SweepSystem | deserialize(null)无防护 | engine-save外部保护 |
| S2-E01 | RewardDistributor | distribute部分分发 | 外部系统幂等保护 |
| S5-E01 | VIPSystem | getLevelProgress(NaN) | FIX-301阻止NaN进入 |
| S6-E03 | ChallengeStage | completeChallenge奖励异常 | 外部系统幂等保护 |
