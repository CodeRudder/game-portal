# v5.0 百家争鸣 — Round 2 玩游戏流程

> **版本**: v5.0 百家争鸣 | **轮次**: R2 | **日期**: 2026-04-23
> **引擎域**: engine/tech/ (13文件, 4,429行) | **UI面板**: panels/tech/ (4组件, 1,559行)

---

## 流程1: 科技树浏览
**入口**: 点击底部导航 → 科技Tab (data-testid="tech-tab")

### 操作步骤
1. 进入科技Tab → 看到三条路线Tab (军事/经济/文化)
2. 点击路线Tab (data-testid="tech-path-tab-{path}") → 切换路线视图
3. 查看路线列 (data-testid="tech-path-{path}") → 节点按层级排列
4. 点击科技节点 (data-testid="tech-node-{id}") → 打开详情弹窗

### 验证点
- [ ] 三条路线Tab切换正常，颜色标识正确(红/黄/紫)
- [ ] 节点状态正确: locked(灰) / available(亮) / researching(动画) / completed(勾)
- [ ] 前置依赖连线显示清晰
- [ ] 互斥分支节点标记明确(同层二选一)
- [ ] 每条路线4层 × 2节点 = 8节点，共24个基础节点

### 交叉验证
- 科技节点数量 = tech-config.ts 中 MIL(8) + ECO(8) + CUL(8) = 24个
- 互斥组: mil_t1, eco_t1, cul_t1, mil_t3, eco_t3, cul_t3 = 6组互斥

---

## 流程2: 科技研究
**入口**: 科技节点详情弹窗 (data-testid="tech-detail-overlay")

### 操作步骤
1. 选择 available 状态节点 → 打开详情弹窗
2. 查看消耗: 科技点 + 研究时间
3. 点击"开始研究" (data-testid="tech-detail-start") → 扣除科技点
4. 研究面板 (data-testid="tech-research-panel") 显示进度
5. 等待完成 / 使用加速:
   - 天命加速 (data-testid="tech-detail-speedup-mandate")
   - 元宝加速 (data-testid="tech-detail-speedup-ingot")
6. 研究完成 → 节点状态变为 completed → 效果生效

### 验证点
- [ ] 科技点扣除正确 (TechPointSystem.spend)
- [ ] 研究队列大小 = getQueueSizeForAcademyLevel(academyLevel)
- [ ] 加速消耗计算: 天命1点=60秒, 元宝1单位=600秒
- [ ] 研究完成回调触发 TechEffectSystem 刷新
- [ ] 研究中节点显示剩余时间倒计时

### 交叉验证
- 队列容量: academy L1=1槽, L5=2槽, L10=3槽, L15=4槽, L20=5槽
- 科技点产出: academy L1=0.01/s → L20=1.76/s (TechPointSystem.getProductionRate)

---

## 流程3: 互斥分支选择
**入口**: 科技树中同层互斥节点

### 操作步骤
1. 浏览 Tier 1 节点 → 看到互斥标记 (data-testid="tech-detail-mutex")
2. 选择并研究其中一个 (如 mil_t1_attack 锐兵术)
3. 研究完成后 → 同组另一节点 (mil_t1_defense 铁壁术) 永久锁定
4. Tier 3 同理: 闪电战 vs 持久战、大粮仓 vs 大集市、百家争鸣 vs 名将荟萃

### 验证点
- [ ] 互斥组内选择一个后，其余节点标记为 mutex-locked
- [ ] chosenMutexNodes 映射正确记录选择
- [ ] 互斥锁定不可逆（无重置功能，转生除外）
- [ ] Tier 2 节点不受互斥限制，可全部研究
- [ ] Tier 4 节点不受互斥限制（由Tier 3选择决定路径）

### 交叉验证
- 互斥组ID格式: {path}_t{tier} (如 mil_t1, eco_t3)
- getMutexGroups() 返回6组互斥配置
- TechTreeSystem.chooseMutexNode() 校验合法性

---

## 流程4: 科技点产出与联动
**入口**: 科技Tab → 研究面板浮层 (data-testid="tech-research-float")

### 操作步骤
1. 查看当前科技点余额和每秒产出
2. 升级书院建筑 → 科技点产出增加 (syncAcademyLevel)
3. 研究文化路线"书院扩建" → 研究速度+15% (syncResearchSpeedBonus)
4. 研究经济路线科技 → 建筑产出加成 (TechLinkSystem.getLinkBonus)
5. 研究军事路线科技 → 武将属性加成 (TechEffectApplier.getBattleBonuses)

### 验证点
- [ ] 科技点每秒累加正确 (update dt * productionRate)
- [ ] 文化科技"研究速度"效果正确缩短研究时间
- [ ] 经济科技"资源产出"效果通过 TechLinkSystem 传递给 ResourceSystem
- [ ] 军事科技"攻击/防御"效果通过 TechEffectApplier 传递给 BattleEngine

### 交叉验证矩阵
| 科技路线 | 联动目标 | 联动系统 | 验证方法 |
|----------|----------|----------|----------|
| 军事 | 战斗属性 | TechEffectApplier.getBattleBonuses() | 攻击/防御/生命乘数 |
| 经济 | 建筑产出 | TechLinkSystem.getLinkBonus('building') | 产出加成百分比 |
| 经济 | 资源产出 | TechLinkSystem.getLinkBonus('resource') | 粮草/铜钱增产 |
| 文化 | 武将经验 | TechEffectApplier.getCultureBonuses() | 经验加成乘数 |
| 文化 | 研究速度 | TechPointSystem.syncResearchSpeedBonus() | 研究时间缩短 |
| 融合 | 跨路线 | FusionTechSystem + TechLinkSystem | 组合效果叠加 |

---

## 流程5: 离线研究回归
**入口**: 离线回归弹窗 (data-testid="tech-offline-panel")

### 操作步骤
1. 有研究中科技时关闭游戏 → TechOfflineSystem.onGoOffline()
2. 离线期间研究继续，效率衰减:
   - 0~2h: 100% | 2~8h: 70% | 8~24h: 40% | >24h: 20% (封顶72h)
3. 回归游戏 → TechOfflineSystem.onComeBackOnline()
4. 查看离线研究面板 (data-testid="offline-duration")
5. 确认离线进度 → 科技点补发 (data-testid="offline-points")

### 验证点
- [ ] 离线开始时快照研究队列 (researchSnapshot)
- [ ] 效率衰减分段计算正确
- [ ] 回归面板显示: 离线时长、各科技进度、获得科技点
- [ ] 研究完成的科技自动标记 completed

---

## 汇总

| 流程 | 覆盖功能点 | data-testid数 | 状态 |
|------|-----------|:------------:|:----:|
| 科技树浏览 | #7节点详情 | 8 | ✅ |
| 科技研究 | #1融合,#5离线规则 | 12 | ✅ |
| 互斥分支 | 三路线×2层互斥 | 1 | ✅ |
| 科技点产出 | #2建筑联动,#3武将,#4资源 | 10 | ✅ |
| 离线回归 | #5离线规则,#6回归面板 | 10 | ✅ |
| **合计** | **8/20 P0功能点** | **31** | ✅ |
