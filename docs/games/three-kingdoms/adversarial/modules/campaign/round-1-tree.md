# Campaign Module R1 — Builder Flow Tree

> 模块: campaign | 轮次: R1 | Builder: v1.5
> 源码路径: `src/games/three-kingdoms/engine/campaign/`
> 源文件: 19个 .ts (不含测试) | 总行数: ~4,300行
> 子系统: 6个 (CampaignProgressSystem, RewardDistributor, SweepSystem, AutoPushExecutor, VIPSystem, ChallengeStageSystem)

## 模块架构

```
campaign/
├── campaign.types.ts        # 类型定义 (348行, 21 exports)
├── sweep.types.ts           # 扫荡类型 (224行, 11 exports)
├── campaign-config.ts       # 章节配置+查找 (156行, 12 exports)
├── campaign-chapter1~6.ts   # 6章关卡数据 (~1,035行)
├── campaign-utils.ts        # 共享工具 (44行, 2 exports)
├── CampaignSerializer.ts    # 序列化纯函数 (111行, 3 exports)
├── CampaignProgressSystem.ts # 关卡进度管理 (455行, 1 export)
├── RewardDistributor.ts     # 奖励分发器 (479行, 1 export)
├── SweepSystem.ts           # 扫荡系统 (366行, 1 export)
├── AutoPushExecutor.ts      # 自动推图 (307行, 1 export)
├── VIPSystem.ts             # VIP等级 (343行, 5 exports)
├── ChallengeStageSystem.ts  # 挑战关卡 (450行, 11 exports)
├── challenge-stages.ts      # 挑战关卡配置 (118行, 1 export)
└── index.ts                 # 统一导出 (99行, 14 exports)
```

## 子系统依赖图

```
CampaignProgressSystem ←── CampaignSerializer
       ↓                        ↑
       ├── ICampaignDataProvider (campaign-config)
       ↓
RewardDistributor ←── ICampaignDataProvider
       ↓
SweepSystem ←── RewardDistributor (内部创建)
       ├── AutoPushExecutor
       ├── VIPSystem (可选)
       └── SweepDeps (外部回调)
ChallengeStageSystem ←── ChallengeDeps (外部回调)
VIPSystem (独立)
```

## 跨系统链路 (6子系统 × 2 = 12条)

| # | 链路 | 路径 | 验证 |
|---|------|------|------|
| L1 | CampaignProgress → RewardDistributor | completeStage后调用calculateRewards | covered |
| L2 | RewardDistributor → 外部ResourceSystem | distribute() → deps.addResource() | covered |
| L3 | RewardDistributor → 外部HeroSystem | distribute() → deps.addFragment() | covered |
| L4 | SweepSystem → CampaignProgress | sweepDeps.getStageStars() | covered |
| L5 | SweepSystem → RewardDistributor | 内部创建实例, calculateRewards | covered |
| L6 | SweepSystem → VIPSystem | getFreeSweepRemaining/useFreeSweep | covered |
| L7 | AutoPushExecutor → SweepDeps | canChallenge/getStageStars/simulateBattle | covered |
| L8 | AutoPushExecutor → RewardDistributor | calculateRewards | covered |
| L9 | ChallengeStageSystem → 外部Resource | consumeResource/addResource | covered |
| L10 | ChallengeStageSystem → 外部Hero | addFragment/addExp | covered |
| L11 | VIPSystem → SweepSystem | claimDailyTickets获取额外扫荡令 | covered |
| L12 | engine-save → 所有campaign子系统 | buildSaveData/applySaveData | covered |

---

## S1: CampaignProgressSystem (455行)

### 公开API

| API | 行号 | 说明 |
|-----|------|------|
| initProgress() | L131 | 重置进度 |
| getProgress() | L148 | 获取完整进度(深拷贝) |
| getCurrentChapter() | L163 | 获取当前章节 |
| getStageStatus(stageId) | L184 | 获取关卡状态 |
| canChallenge(stageId) | L207 | 是否可挑战 |
| getStageStars(stageId) | L219 | 获取星级 |
| getTotalStars() | L229 | 总星数 |
| getClearCount(stageId) | L241 | 通关次数 |
| isFirstCleared(stageId) | L252 | 是否首通 |
| completeStage(stageId, stars) | L268 | 通关处理 |
| serialize() | L323 | 序列化 |
| deserialize(data) | L333 | 反序列化 |

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
│   ├── S1-E02: deserialize(null/undefined) → 需验证 ⚠️
│   │   [源码L333: data参数直接访问data.version, null会crash]
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
│       [covered: engine-save.ts L174: ctx.campaign.serialize()]
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

### 公开API

| API | 行号 | 说明 |
|-----|------|------|
| calculateRewards(stageId, stars, isFirstClear) | L145 | 计算奖励 |
| calculateAndDistribute(stageId, stars, isFirstClear) | L178 | 计算+分发 |
| distribute(reward) | L213 | 分发奖励 |
| previewBaseRewards(stageId) | L246 | 预览基础奖励 |
| previewFirstClearRewards(stageId) | L259 | 预览首通奖励 |
| getUnificationRewards(grade) | L434 | 天下一统奖励 |
| getFinalStageBonus(stars) | L459 | 最终关卡加成 |

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
│   ├── S2-N05: rollDropTable(首通) → 碎片必掉(P0-4修复)
│   │   [covered: RewardDistributor-p2.test.ts]
│   ├── S2-N06: rollDropTable(非首通) → 按概率随机
│   │   [covered: RewardDistributor-p2.test.ts]
│   └── S2-N07: previewBaseRewards / previewFirstClearRewards
│       [covered: RewardDistributor-p1.test.ts]
│
├── F-Boundary
│   ├── S2-B01: calculateRewards(stars=0) → starMultiplier=0, 资源全0
│   │   [covered: RewardDistributor-p1.test.ts]
│   ├── S2-B02: calculateRewards(stars=NaN) → ⚠️ NaN穿透
│   │   [源码L151: Math.floor(NaN)=NaN → Math.max(0,Math.min(3,NaN))=NaN]
│   │   [clampedStars=NaN → getStarMultiplier(NaN)=STAR_MULTIPLIERS[NaN]=undefined → 1.0]
│   │   [但exp = Math.floor(baseExp * NaN) = NaN → NaN传播到distribute]
│   ├── S2-B03: calculateRewards(stars=Infinity) → Math.floor(Infinity)=Infinity → Math.min(3,∞)=3 ✓
│   │   [covered: Math.min截断有效]
│   ├── S2-B04: calculateRewards(不存在的stageId) → throw Error
│   │   [covered: RewardDistributor-p1.test.ts]
│   ├── S2-B05: distribute(reward.fragments=null) → DEF-014: 防护为{}
│   │   [covered: RewardDistributor-p2.test.ts]
│   ├── S2-B06: getFinalStageBonus(stars=NaN) → Math.max(1,NaN)=NaN → 全部NaN ⚠️
│   │   [源码L461: 无NaN防护]
│   └── S2-B07: getUnificationRewards(未知grade) → default → C级
│       [covered: 源码L449 default分支]
│
├── F-Error
│   ├── S2-E01: distribute时deps回调抛异常 → 资源部分分发 ⚠️
│   │   [源码L225-239: 无事务性保证, 中途异常导致部分资源入账]
│   └── S2-E02: calculateRewards(stage.baseExp=NaN) → NaN传播
│       [需验证配置数据完整性]
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

### 公开API

| API | 行号 | 说明 |
|-----|------|------|
| canSweep(stageId) | L149 | 是否可扫荡 |
| getSweepStatus(stageId) | L156 | 扫荡状态详情 |
| getTicketCount() | L173 | 扫荡令数量 |
| addTickets(amount) | L177 | 增加扫荡令 |
| hasEnoughTickets(count) | L187 | 令是否足够 |
| claimDailyTickets(now) | L201 | 领取每日扫荡令 |
| sweep(stageId, count) | L231 | 批量扫荡 |
| autoPush() | L298 | 自动推图 |
| serialize() / deserialize(data) | L308-322 | 序列化 |

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
│   ├── S3-B04: addTickets(NaN) → ⚠️ NaN绕过 <= 0 检查
│   │   [源码L179: NaN <= 0 === false → ticketCount += NaN → NaN]
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
│   ├── S3-E01: sweep中VIPSystem.useFreeSweep已消耗但扫荡令不足 → 无法回滚免费次数 ⚠️
│   │   [源码L258-267: 注释已承认此问题]
│   └── S3-E02: deserialize(null) → 需验证
│       [源码L316: 直接访问data.version, null会crash]
│
├── F-Cross
│   ├── S3-C01: sweep → RewardDistributor.calculateRewards → distribute
│   │   [covered: SweepSystem.sweep.test.ts]
│   ├── S3-C02: claimDailyTickets → VIPSystem.getExtraDailyTickets
│   │   [covered: SweepSystem.test.ts]
│   ├── S3-C03: sweep(VIP免费) → VIPSystem.useFreeSweep
│   │   [covered: SweepSystem.sweep.test.ts]
│   ├── S3-C04: engine-save → sweep.serialize() / sweep.deserialize()
│   │   [covered: engine-save.ts L223/L570]
│   └── S3-C05: autoPush → AutoPushExecutor.execute(ticketCount)
│       [covered: AutoPushExecutor.test.ts]
│
└── F-Lifecycle
    ├── S3-L01: constructor → 创建内部RewardDistributor + AutoPushExecutor
    │   [covered: SweepSystem.test.ts]
    ├── S3-L02: reset → 清空扫荡令+重置autoPush
    │   [covered: SweepSystem.test.ts]
    └── S3-L03: init(ISystemDeps) → deps注入
        [covered: 源码L138]
```

---

## S4: AutoPushExecutor (307行)

### 公开API

| API | 行号 | 说明 |
|-----|------|------|
| getProgress() | L67 | 获取推图进度 |
| resetProgress() | L75 | 重置进度 |
| execute(ticketCount) | L88 | 执行自动推图 |

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
│   ├── S4-E01: execute中sweepDeps.simulateBattle抛异常 → try-finally恢复isRunning
│   │   [covered: AutoPushExecutor-def009.test.ts, DEF-009修复]
│   └── S4-E02: execute中rewardDistributor.calculateRewards抛异常 → try-finally恢复
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

### 公开API

| API | 行号 | 说明 |
|-----|------|------|
| addExp(amount) | L178 | 增加VIP经验 |
| getExp() / getBaseLevel() / getEffectiveLevel() | L183-189 | 查询 |
| getNextLevelExp() | L193 | 下一级所需经验 |
| getLevelProgress() | L204 | 进度百分比 |
| hasPrivilege(privilege) | L218 | 特权校验 |
| getFreeSweepRemaining(now) | L254 | 剩余免费扫荡 |
| useFreeSweep(now) | L261 | 使用免费扫荡 |
| gmSetLevel / gmResetLevel | L279-291 | GM命令 |
| serialize() / deserialize(data) | L297-310 | 存档 |

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
│   ├── S5-B01: addExp(NaN) → ⚠️ NaN绕过 <= 0, vipExp变为NaN
│   │   [源码L180: NaN <= 0 === false → this.vipExp += NaN → NaN]
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
│   └── S5-B07: deserialize(null) → 安全: if(!data) return
│       [covered: 源码L307]
│
├── F-Error
│   └── S5-E01: getLevelProgress(vipExp=NaN) → NaN / range → NaN
│       [源码L211: progress/range → NaN/NaN → NaN → Math.min(1,NaN)=NaN]
│
├── F-Cross
│   ├── S5-C01: SweepSystem.claimDailyTickets → vipSystem.getExtraDailyTickets()
│   │   [covered: SweepSystem.test.ts]
│   ├── S5-C02: SweepSystem.sweep → vipSystem.getFreeSweepRemaining/useFreeSweep
│   │   [covered: SweepSystem.sweep.test.ts]
│   └── S5-C03: engine-save → vip.serialize() / vip.deserialize()
│       [covered: engine-save.ts L225/L574]
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

### 公开API

| API | 行号 | 说明 |
|-----|------|------|
| checkCanChallenge(stageId, now) | L247 | 前置校验 |
| preLockResources(stageId) | L296 | 预锁资源 |
| completeChallenge(stageId, victory) | L341 | 完成挑战 |
| getDailyAttempts / getDailyRemaining | L230/237 | 次数查询 |
| isFirstCleared(stageId) | L243 | 首通查询 |
| serialize() / deserialize(data) | L433/439 | 存档 |

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
│   ├── S6-B03: completeChallenge(无预锁, victory=true) → ⚠️ 不消耗资源但发奖
│   │   [源码L355: preLocked=undefined → armyCost=0, staminaCost=0]
│   │   [源码L367: 仍然发放奖励, 经济漏洞!]
│   ├── S6-B04: preLockResources(重复预锁) → 返回false
│   │   [covered: 源码L306]
│   ├── S6-B05: preLockResources(扣减失败) → 回滚已扣减的
│   │   [covered: ChallengeStageSystem.test.ts]
│   └── S6-B06: completeChallenge(不存在的stageId) → 返回空结果
│       [covered: 源码L346]
│
├── F-Error
│   ├── S6-E01: serialize浅拷贝 → stageProgress内部对象被外部修改 ⚠️
│   │   [源码L435: { ...this.stageProgress } 只拷贝第一层]
│   │   [内部ChallengeStageProgress对象是引用共享]
│   ├── S6-E02: deserialize浅拷贝 → 同上
│   │   [源码L441: { ...data.stageProgress }]
│   └── S6-E03: completeChallenge中addFragment/addExp抛异常 → 资源已扣但奖励未完全发放 ⚠️
│       [源码L381-391: 无事务性保证]
│
├── F-Cross
│   ├── S6-C01: completeChallenge → deps.addResource/addFragment/addExp
│   │   [covered: ChallengeStageSystem.test.ts]
│   ├── S6-C02: preLockResources → deps.consumeResource/addResource(回滚)
│   │   [covered: ChallengeStageSystem.test.ts]
│   └── S6-C03: engine-save → challenge.serialize() / challenge.deserialize()
│       [covered: engine-save.ts L227/L578]
│
└── F-Lifecycle
    ├── S6-L01: constructor → 初始化所有关卡进度
    │   [covered: ChallengeStageSystem.test.ts]
    ├── S6-L02: reset → 清空进度+预锁
    │   [covered: ChallengeStageSystem.test.ts]
    └── S6-L03: deserialize → 清空preLockedResources
        [covered: 源码L442]
```

---

## 配置交叉验证

### C1: 章节-关卡配置一致性

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 6章配置ID与chapter文件一致 | ✅ | campaign-config.ts引用6个chapter文件 |
| prerequisiteChapterId链完整 | ✅ | chapter1→null, 2→1, 3→2, 4→3, 5→4, 6→5 |
| 关卡order连续性 | ✅ | 测试覆盖(campaign-chapters-1to3/4to6.test.ts) |
| 推荐战力递增 | ✅ | ch1:100~500 → ch6:10000~20000 |
| 关卡类型覆盖 | ✅ | normal/elite/boss三种 |
| DropTable概率范围 | ✅ | 0~1范围 |
| 挑战关卡8个配置完整 | ✅ | challenge_1~8, armyCost递增 |

### C2: VIP配置与特权枚举同步

| VIP等级 | 经验要求 | 特权 | 验证 |
|---------|---------|------|------|
| VIP0 | 0 | 无 | ✅ |
| VIP1 | 100 | extra_sweep_ticket_1 | ✅ |
| VIP2 | 300 | offline_hours_2 | ✅ |
| VIP3 | 600 | speed_3x | ✅ |
| VIP4 | 1000 | extra_sweep_ticket_2 | ✅ |
| VIP5 | 1500 | speed_instant + free_sweep | ✅ |
| VIP6 | 2500 | offline_hours_4 | ✅ |

### C3: engine-save覆盖验证

| 子系统 | serialize被buildSaveData引用 | deserialize被applySaveData调用 | 状态 |
|--------|------|------|------|
| CampaignProgressSystem | ✅ L174 | ✅ L463 | 完整 |
| SweepSystem | ✅ L223 (sweep?) | ✅ L570 | 完整 |
| VIPSystem | ✅ L225 (vip?) | ✅ L574 | 完整 |
| ChallengeStageSystem | ✅ L227 (challenge?) | ✅ L578 | 完整 |
| RewardDistributor | N/A (无状态) | N/A | 正确 |
| AutoPushExecutor | N/A (内嵌SweepSystem) | N/A | 正确 |

---

## 统计

| 维度 | 节点数 | P0 | P1 | covered | 待验证 |
|------|--------|----|----|---------|--------|
| S1: CampaignProgress | 20 | 0 | 1 | 17 | 2 |
| S2: RewardDistributor | 17 | 2 | 1 | 11 | 3 |
| S3: SweepSystem | 18 | 1 | 1 | 12 | 3 |
| S4: AutoPushExecutor | 11 | 0 | 0 | 10 | 1 |
| S5: VIPSystem | 18 | 1 | 1 | 12 | 2 |
| S6: ChallengeStageSystem | 17 | 2 | 1 | 11 | 3 |
| **合计** | **101** | **6** | **5** | **73** | **14** |

### P0节点清单

| ID | 子系统 | 维度 | 描述 | 源码位置 |
|----|--------|------|------|---------|
| S2-B02 | RewardDistributor | F-Boundary | calculateRewards(NaN stars) → NaN穿透到exp | RewardDistributor.ts:151 |
| S2-B06 | RewardDistributor | F-Boundary | getFinalStageBonus(NaN) → 全部NaN | RewardDistributor.ts:461 |
| S3-B04 | SweepSystem | F-Boundary | addTickets(NaN) → NaN绕过<=0 | SweepSystem.ts:179 |
| S5-B01 | VIPSystem | F-Boundary | addExp(NaN) → NaN绕过<=0 | VIPSystem.ts:180 |
| S6-B03 | ChallengeStageSystem | F-Boundary | completeChallenge无预锁直接胜利 → 免费发奖 | ChallengeStageSystem.ts:355-390 |
| S6-E01 | ChallengeStageSystem | F-Error | serialize/deserialize浅拷贝 → 数据泄漏 | ChallengeStageSystem.ts:435/441 |
