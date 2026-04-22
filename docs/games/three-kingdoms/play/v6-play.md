# v6.0 天下大势 — Round 2 玩游戏流程

> **版本**: v6.0 天下大势 | **轮次**: R2 | **日期**: 2026-04-23
> **引擎域**: engine/map(7文件,2400行) + engine/event(17文件,5298行) + engine/npc(13文件,3991行) + engine/quest(5文件,1092行) + engine/leaderboard(2文件,339行)

---

## 流程1: 世界地图交互与驻防
**入口**: 点击底部导航 → 地图Tab (data-testid="map-tab")

### 操作步骤
1. 进入地图Tab → 看到60×40网格世界地图，三大区域(中原/江南/西蜀)
2. 点击己方领土 → 弹出领土详情面板 (data-testid="territory-detail")
3. 选择「驻防」按钮 (data-testid="territory-garrison-btn") → 打开驻防面板
4. 从可用武将列表选择武将 → 确认驻防 (data-testid="garrison-confirm")
5. 领土详情更新：防御+N%、产出+N%
6. 点击敌方领土 → 显示胜率预估 (data-testid="siege-win-rate")
7. 确认攻城 (data-testid="siege-confirm") → 扣除资源 → 战斗 → 占领/失败

### 验证点
- [ ] 驻防武将不可同时出战（编队互斥校验）
- [ ] 胜率预估考虑攻方战力+兵种克制 vs 守方驻防+城防+地形
- [ ] 攻城胜利：领土归属变更 + 奖励发放(资源+道具)
- [ ] 离线回归：领土得失摘要面板 (data-testid="offline-territory-summary")

### 交叉验证
- 驻防加成: GarrisonSystem.getGarrisonBonus() → TerritorySystem产出乘数
- 胜率公式: SiegeEnhancer.estimateWinRate() ∈ [0, 1]
- 离线上限: 最多丢失20%领土 (OfflineEventHandler)

---

## 流程2: NPC对话与送礼
**入口**: 地图上NPC图标 (data-testid="map-npc-icon")

### 操作步骤
1. 地图上发现NPC图标 → 点击 → NPC信息弹窗 (data-testid="npc-info-popup")
2. 查看NPC属性：名字/职业/好感度/位置
3. 选择「对话」(data-testid="npc-dialog-btn") → 打开对话面板
4. 选择对话选项 (data-testid="dialog-option-{id}") → 触发后果
5. 选择「赠送」(data-testid="npc-gift-btn") → 选择物品 → 好感度+N×倍率
6. 好感度提升 → 等级变化 → 解锁新交互选项

### 验证点
- [ ] NPC类型正确显示: 商人/谋士/武将/工匠/旅人
- [ ] 好感度5级: Lv1陌生人→Lv5挚友，每级解锁新选项
- [ ] 偏好物品倍率: GiftPreferenceCalculator.getMultiplier()
- [ ] 对话树分支正确，选项后果生效

### 交叉验证
- 好感度阈值: AFFINITY_THRESHOLDS = [0, 100, 300, 600, 1000]
- 好感度来源: 对话+10 / 偏好礼物×3倍 / 普通礼物×1倍 / 任务+50
- Lv.5解锁: NPC专属羁绊技能 (BondSkillDef)

---

## 流程3: 随机事件触发与处理
**入口**: 事件急报横幅 (data-testid="event-banner")

### 操作步骤
1. 游戏进行中 → 顶部滑入急报横幅 (data-testid="event-banner-{id}")
2. 点击横幅 → 打开随机遭遇弹窗 (data-testid="encounter-modal")
3. 查看事件描述 + 2~3个选项 + 后果预览
4. 选择选项 (data-testid="encounter-option-{id}") → 执行后果
5. Toast反馈 (data-testid="encounter-result") → 资源/好感度变化

### 验证点
- [ ] 事件类型: 随机/固定/连锁三类正确触发
- [ ] 急报横幅自动消失（5秒）或点击关闭
- [ ] 选项后果预览与实际执行一致
- [ ] 事件冷却时间生效，避免频繁触发
- [ ] 离线事件自动处理（选择最优选项）

### 交叉验证
- 触发条件: EventTriggerSystem.checkConditions() → 时间/概率/条件
- 冷却机制: EventTriggerEngine.cooldowns Map
- 离线处理: OfflineEventHandler.processOfflineEvents() → 最优选项策略

---

## 流程4: 任务系统
**入口**: 任务面板 (data-testid="quest-panel")

### 操作步骤
1. 打开任务面板 → 查看任务列表（主线/日常/联盟）
2. 接受任务 (data-testid="quest-accept-{id}") → 任务进入进行中
3. 完成任务目标 → 自动/手动提交 (data-testid="quest-complete-{id}")
4. 领取奖励 → 资源/道具/经验到账
5. 任务追踪器 (data-testid="quest-tracker") 实时显示进度

### 验证点
- [ ] QuestSystem管理任务完整生命周期
- [ ] ActivitySystem追踪活动进度
- [ ] QuestTrackerSystem事件监听正确触发进度更新
- [ ] 任务跳转映射(getJumpTarget)导航到对应UI

### 交叉验证
- 任务状态: locked → available → active → completed
- 事件驱动: QuestTrackerSystem监听EventBus → 匹配任务条件 → 更新进度

---

## 流程5: 排行榜与NPC聚合
**入口**: 排行榜Tab (data-testid="leaderboard-tab") + 地图NPC聚合

### 操作步骤
1. 打开排行榜Tab → 查看多维度排名
2. 排行维度: 战力/领土/财富/好感度
3. 地图上同区域多个NPC → 聚合气泡 (data-testid="npc-cluster-{region}")
4. 点击聚合气泡 → 展开NPC列表 → 选择NPC交互
5. NPC名册总览面板 (data-testid="npc-roster-panel") → PC端右侧滑出

### 验证点
- [ ] LeaderboardSystem排名计算正确，支持多维度排序
- [ ] NPCMapPlacer拥挤检测 → 聚合气泡折叠显示
- [ ] NPC名册显示所有已发现NPC列表
- [ ] 手机端地图支持触摸拖拽+缩放

### 交叉验证
- 排行榜数据源: LeaderboardSystem.getRankings() → 各子系统聚合
- NPC聚合阈值: NPCMapPlacer.clusterThreshold → 同区域≥3个NPC聚合
- 手机端: MapFilterSystem + viewport裁剪 → 仅渲染可见区域

---

## 汇总

| 流程 | 覆盖功能点 | data-testid数 | 状态 |
|------|-----------|:------------:|:----:|
| 世界地图交互与驻防 | #1~#6,#8 | 14 | ✅ |
| NPC对话与送礼 | #9~#11,#14~#18 | 12 | ✅ |
| 随机事件触发 | #21~#24 | 10 | ✅ |
| 任务系统 | Quest域 | 8 | ✅ |
| 排行榜与NPC聚合 | #12~#13,#19 | 8 | ✅ |
| **合计** | **20/24 P0+P1功能点** | **52** | ✅ |
